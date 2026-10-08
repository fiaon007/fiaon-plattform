// ═══════════════════════════════════════════════════════════════════════════
// GEBURTSDATUM IN DER AKTE: EIN SCHREIBWEG, EIN LESEWEG
// E-IT-G (08.10.2026), Punkt (14)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Das Geburtsdatum eines Menschen stand an zwei Orten (Person und jede seiner
// Bestellungen), und jeder Weg schrieb einen anderen Teil:
//   · Agentenakte: die eine Bestellung + die Person (Fehler an der Person still
//     verschluckt), ein leerer Wert setzte die Bestellung auf NULL.
//   · Chef-Akte und Telefonkartei: NUR die Bestellung — die Agentenakte (liest
//     Person zuerst) zeigte danach weiter den alten Wert.
//   · Antrag: überschrieb die Bestellung, die Person behielt den ersten Wert.
// Gemessen 07.10.: 15 Menschen mit zwei verschiedenen Geburtsdaten, darunter
// einer mit 2025-11-15 an der Person und 1947-01-19 an der Bestellung.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Ein Mensch hat EIN Geburtsdatum. Wer es korrigiert (Mitarbeiter, Leitung),
// schreibt es in EINER Transaktion an die Person UND an jede lebende Bestellung
// dieser Person; ein Verlaufseintrag hält alt → neu fest. Das öffentliche
// Antragsformular schreibt NICHT über diesen Weg (Gegenprüfung 08.10.) — nur
// in der einen Ausnahme shared antragKorrigiertPerson. Gelesen wird überall
// „Person zuerst, sonst jüngste Bestellung“ (wie KARTE_SQL).
// Prüfstand: scripts/pruef-it-g.ts (Teil B, lokale Datenbank).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { geburtsdatumAnzeige, geburtsdatumIso } from "../../shared/fiaon-geburtsdatum";
import { vollerNamePasst } from "./fiaon-kuendigung-identitaet";

export interface GeburtStandAkte {
  personId: number | null;
  /** Was die Akte zeigt: Person zuerst, sonst jüngste Bestellung mit Datum. */
  wert: string | null;
  person: string | null;
  bestellungen: { ref: string; iso: string | null }[];
  /** Mehr als ein verschiedener Wert über Person und Bestellungen. */
  abweichend: boolean;
  /** Die verschiedenen Werte, zum Auswählen laut Ausweis. */
  werte: { iso: string; anzeige: string; quellen: string[]; fremderName?: boolean }[];
  /**
   * Gegenprüfung 08.10.: Trägt eine Bestellung mit Datum einen ANDEREN Namen als
   * die Person (gemeinsame E-Mail/Telefon — evtl. zwei Menschen)? Dann warnt die
   * Akte vor dem Vereinheitlichen; die Quelle nennt den Namen.
   */
  fremderName: boolean;
}

/** Wie steht das Geburtsdatum eines Menschen da — und widerspricht es sich? */
export async function geburtStandAkte(personId: number, lauf: any = sqlPool): Promise<GeburtStandAkte> {
  const [p] = (await lauf`SELECT id, birthdate, first_name, last_name FROM fiaon_persons WHERE id = ${personId}`) as any[];
  const best = (await lauf`
    SELECT ref, birthdate, first_name, last_name FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY created_at DESC
  `) as any[];
  const person = geburtsdatumIso(p?.birthdate);
  const personHatNamen = !!(p?.first_name || p?.last_name);
  const bestellungen = best.map((b) => ({
    ref: String(b.ref), iso: geburtsdatumIso(b.birthdate),
    fremd: personHatNamen && !vollerNamePasst({ first_name: p.first_name, last_name: p.last_name }, { firstName: b.first_name, lastName: b.last_name }),
    name: [b.first_name, b.last_name].filter(Boolean).join(" "),
  }));
  const karte = new Map<string, { quellen: string[]; fremderName: boolean }>();
  if (person) karte.set(person, { quellen: ["Person"], fremderName: false });
  for (const b of bestellungen) {
    if (!b.iso) continue;
    const e = karte.get(b.iso) ?? { quellen: [], fremderName: false };
    e.quellen.push(b.fremd && b.name ? `${b.ref} · ${b.name}` : b.ref);
    if (b.fremd) e.fremderName = true;
    karte.set(b.iso, e);
  }
  const werte = Array.from(karte.entries()).map(([iso, e]) => ({ iso, anzeige: geburtsdatumAnzeige(iso), quellen: e.quellen, ...(e.fremderName ? { fremderName: true } : {}) }));
  return {
    personId: p ? Number(p.id) : null,
    wert: person ?? bestellungen.find((b) => b.iso)?.iso ?? null,
    person, bestellungen: bestellungen.map((b) => ({ ref: b.ref, iso: b.iso })),
    abweichend: werte.length > 1,
    werte,
    fremderName: werte.length > 1 && werte.some((w) => w.fremderName),
  };
}

/**
 * DER EINE SCHREIBWEG. `iso` = neues Datum (bereits über shared geprüft) oder
 * null = entfernen (nur Leitung — die Route prüft das, nicht diese Funktion).
 * Gibt den bisherigen Akten-Wert zurück; bei „nichts zu tun“ geaendert:false.
 */
export async function geburtsdatumSetzen(
  ref: string,
  iso: string | null,
  akteur: { id: number | null; name: string },
  opt: { verlauf?: boolean; zusatz?: string } = {},
): Promise<{ geaendert: boolean; vorher: string | null; nachher: string | null; personId: number | null; bestellungen: number }> {
  return sqlPool.begin(async (tx: any) => {
    const [a] = (await tx`SELECT ref, person_id, birthdate FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL`) as any[];
    if (!a) throw Object.assign(new Error("Kunde nicht gefunden"), { code: 404 });
    const personId = a.person_id != null ? Number(a.person_id) : null;
    const stand = personId ? await geburtStandAkte(personId, tx) : null;
    const vorher = stand ? stand.wert : geburtsdatumIso(a.birthdate);
    // „Gleich“ heißt: Person und JEDE lebende Bestellung tragen schon genau diesen Wert
    // (leere Bestellungen werden mit gefüllt — ein Mensch, ein Geburtsdatum).
    const ganzGleich = stand
      ? stand.person === iso && stand.bestellungen.every((b) => b.iso === iso)
      : geburtsdatumIso(a.birthdate) === iso;
    if (ganzGleich) return { geaendert: false, vorher, nachher: iso, personId, bestellungen: 0 };

    const zeilen = (await tx`
      UPDATE fiaon_applications SET birthdate = ${iso}, updated_at = NOW()
       WHERE merged_into IS NULL
         AND (ref = ${ref} ${personId ? tx`OR person_id = ${personId}` : tx``})
         AND birthdate IS DISTINCT FROM ${iso}
      RETURNING ref
    `) as any[];
    if (personId) {
      await tx`UPDATE fiaon_persons SET birthdate = ${iso}, updated_at = NOW() WHERE id = ${personId} AND birthdate IS DISTINCT FROM ${iso}`;
    }
    if (opt.verlauf !== false && vorher !== iso) {
      const text = iso
        ? `Geburtsdatum korrigiert durch ${akteur.name}: ${vorher ? geburtsdatumAnzeige(vorher) : "—"} → ${geburtsdatumAnzeige(iso)}`
        : `Geburtsdatum entfernt durch ${akteur.name}: ${vorher ? geburtsdatumAnzeige(vorher) : "—"} → —`;
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, ${akteur.id}, ${akteur.name}, 'edit', ${opt.zusatz ? `${text} (${opt.zusatz})` : text})
      `;
    } else if (opt.verlauf !== false && stand?.abweichend && iso) {
      // Der Akten-Wert bleibt, aber die Abweichung ist aufgelöst — auch das gehört in den Verlauf.
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, ${akteur.id}, ${akteur.name}, 'edit',
                ${`Geburtsdatum vereinheitlicht durch ${akteur.name}: ${stand.werte.map((w) => w.anzeige).join(" / ")} → ${geburtsdatumAnzeige(iso)}`})
      `;
    }
    return { geaendert: true, vorher, nachher: iso, personId, bestellungen: zeilen.length };
  });
}

/** Leitung im Mitarbeiter-Portal (fiaon_agents.rolle) — nur sie darf ein Geburtsdatum entfernen. */
export function istLeitungsRolle(rolle: unknown): boolean {
  return rolle === "vertriebsleiter" || rolle === "admin";
}
