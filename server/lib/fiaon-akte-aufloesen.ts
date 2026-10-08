// ═══════════════════════════════════════════════════════════════════════════
// EINE AUFLÖSUNG FÜR ALLE TÜREN ZUR AKTE
// (E-IT-E, 08.10.2026, Punkt 5 „Akte aus dem Chefbüro: nicht gefunden")
//
// ── DER BEFUND (gemessen am 07.10.2026, nur lesend) ───────────────────────
// GET /admin/kunden/akte kannte eine Personen-Nummer nur über BESTELLUNGEN.
// Die Chef-Kundenliste zeigt aber PERSONEN — 52 % davon reine Interessenten.
// Für jeden von ihnen kam „Akte nicht gefunden" (3.024 von 5.781). Dasselbe
// galt für zusammengeführte Personen: WhatsApp-Gespräche, Anrufe, Termine und
// Postmeister-Fälle behalten nach dem Merge die Nummer des Verlierers, und die
// Akte folgte `merged_into_person_id` nicht. Ref-Ketten wurden nur einen
// Schritt verfolgt, `superseded_by` gar nicht.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Diese Datei ist die EINE Stelle, die aus einer Kennung eine Akte macht:
// Chef-Akte, Agenten-Akte (Kopf der Personen-Kette) und „Person zur
// Referenz" lesen sie. Jede Umleitung wird mit Grund zurückgegeben — die
// Oberfläche zeigt sie als Band, nie still.
//
// ── FREMDANKER (Gegenprüfung 07.10.2026) ──────────────────────────────────
// Der alte Lead-Zweig verankerte über E-Mail/Telefon an IRGENDEINER Bestellung.
// Für Interessenten mit Personen-Nummer hätte das 9 von 3.022 Akten mit der
// Bestellung eines ANDEREN Menschen geöffnet (fremde Zahlungsdaten), 3 weitere
// über `converted_order_id`. Deshalb: Trägt der Lead eine Personen-Nummer, darf
// NUR eine Bestellung desselben Personen-Kopfs Anker sein. Der Rückfall über
// E-Mail/Telefon gilt nur für Leads OHNE Personen-Nummer (Altbestand) — und
// auch dann mit Band „bitte prüfen".
//
// Nur lesend. Kein Einfluss auf Geld, Mails oder WhatsApp.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  kennungLesen, TEXT_KENNUNG_LEER,
  type AkteFehlerGrund, type Umleitung,
} from "../../shared/fiaon-akte-aufloesung";

type Lauf = typeof sqlPool;

/** Harte Obergrenze je Kette — eine Schleife ohne Grenze wäre bei einem Zyklus endlos. */
export const MAX_KETTE = 10;

/**
 * Telefon-Ziffern einer Bestellung (Vorwahl+Nummer, sonst contact_phone).
 * Steht hier, weil die Akte (fiaon-kunden.ts) und der Lead-Rückfall dieselbe
 * Regel brauchen — zwei Fassungen wären zwei Familien.
 */
export const APP_PHONE_SQL = `
  COALESCE(
    NULLIF(regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '\\D', '', 'g'), ''),
    NULLIF(regexp_replace(COALESCE(a.contact_phone,''), '\\D', '', 'g'), '')
  )`;

export type AkteZiel =
  | { art: "bestellung"; ref: string; personId: number | null }
  | { art: "lead"; leadId: number; personId: number | null };

export type Aufloesung =
  | {
      ok: true;
      eingabe: string;
      ziel: AkteZiel;
      /** Die Kennung, unter der die Akte ohne Umweg aufgeht (ref oder lead-N). */
      kanonisch: string;
      umleitungen: Umleitung[];
      /** War die Eingabe ein Lead, dessen Nummer — damit die Akte ihn sicher mitzeigt. */
      eingabeLeadId: number | null;
    }
  | {
      ok: false;
      eingabe: string;
      status: 400 | 404;
      grund: AkteFehlerGrund;
      text: string;
    };

export type PersonKopf =
  | { ok: true; kopfId: number; umleitungen: Umleitung[] }
  | { ok: false; grund: "person_fehlt" | "kette_kaputt"; text: string };

function tagText(v: unknown): string {
  const d = v ? new Date(v as any) : null;
  if (!d || Number.isNaN(d.getTime())) return "unbekannt";
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Datum und Akteur der Personen-Merges aus dem Protokoll nachtragen.
 * `reason` hat seit dem 08.08.2026 die feste Form „Person V in Person G
 * zusammengeführt" (fiaon-person-merge.ts) — über den Index (type, created_at)
 * sind das rund 850 Zeilen, keine Volltabelle.
 */
async function mergeProtokollNachtragen(umleitungen: Umleitung[], lauf: Lauf): Promise<void> {
  const personen = umleitungen.filter((u) => u.grund === "person_zusammengefuehrt");
  if (personen.length === 0) return;
  const gruende = personen.map((u) => `Person ${u.von} in Person ${u.nach} zusammengeführt`);
  try {
    const zeilen = (await lauf`
      SELECT reason, created_at, actor FROM fiaon_agent_events
      WHERE type = 'person_merge' AND reason = ANY(${gruende})
      ORDER BY created_at DESC
    `) as any[];
    for (const u of personen) {
      const z = zeilen.find((r) => r.reason === `Person ${u.von} in Person ${u.nach} zusammengeführt`);
      if (z) {
        u.am = z.created_at ? new Date(z.created_at).toISOString() : null;
        u.wer = z.actor ? String(z.actor) : null;
      }
    }
  } catch (e) {
    // Ohne Datum steht das Band trotzdem — es nennt dann nur Verlierer und Gewinner.
    console.error("[AKTE-AUFLOESEN] Merge-Protokoll:", (e as Error).message);
  }
}

/**
 * Den Kopf einer Personen-Kette finden: `merged_into_person_id` bis zum Ende,
 * höchstens MAX_KETTE Schritte, mit Zyklusschutz.
 *
 * Wird auch von den Agenten-Akten benutzt (GET /agent/crm/kunden/:id,
 * GET /agent/vertrieb/person/:id): Erst den Kopf auflösen, DANN die
 * Berechtigung am KOPF prüfen — sonst umginge die Umleitung den Zugriffsschutz.
 */
export async function personKopf(personId: number, lauf: Lauf = sqlPool, mitProtokoll = true): Promise<PersonKopf> {
  if (!Number.isFinite(personId) || personId <= 0) {
    return { ok: false, grund: "person_fehlt", text: `Eine Person mit der Nummer ${personId} gibt es nicht.` };
  }
  const umleitungen: Umleitung[] = [];
  const pfad: number[] = [];
  let id = personId;
  for (let schritt = 0; schritt <= MAX_KETTE; schritt++) {
    if (pfad.includes(id)) {
      return {
        ok: false, grund: "kette_kaputt",
        text: `Person ${personId}: Die Zusammenführung zeigt im Kreis (${[...pfad, id].join(" → ")}). ` +
          "Bitte die Leitung informieren — die Kette muss von Hand gelöst werden.",
      };
    }
    pfad.push(id);
    const [p] = (await lauf`SELECT id, merged_into_person_id FROM fiaon_persons WHERE id = ${id}`) as any[];
    if (!p) {
      if (id === personId) {
        return { ok: false, grund: "person_fehlt", text: `Eine Person mit der Nummer ${personId} gibt es nicht.` };
      }
      return {
        ok: false, grund: "kette_kaputt",
        text: `Person ${personId} ist in Person ${id} aufgegangen — die gibt es aber nicht. ` +
          "Bitte die Leitung informieren — die Kette muss von Hand gelöst werden.",
      };
    }
    if (p.merged_into_person_id == null) {
      if (mitProtokoll) await mergeProtokollNachtragen(umleitungen, lauf);
      return { ok: true, kopfId: Number(p.id), umleitungen };
    }
    const nach = Number(p.merged_into_person_id);
    umleitungen.push({ grund: "person_zusammengefuehrt", von: String(id), nach: String(nach), am: null, wer: null });
    id = nach;
  }
  return {
    ok: false, grund: "kette_kaputt",
    text: `Person ${personId}: mehr als ${MAX_KETTE} Zusammenführungen hintereinander (${pfad.join(" → ")}). ` +
      "Die Kette muss von Hand geprüft werden.",
  };
}

/** Die beste Bestellung einer Person — dieselbe Ordnung wie die Akte seit dem 27.08.2026. */
async function besteBestellung(personId: number, lauf: Lauf): Promise<string | null> {
  const [beste] = (await lauf`
    SELECT a.ref FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL
     ORDER BY (a.payment_status = 'paid') DESC,
              (a.ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
              a.created_at DESC
     LIMIT 1`) as any[];
  return beste?.ref ? String(beste.ref) : null;
}

interface BestellZeile { ref: string; person_id: number | null; merged_into: string | null; superseded_by: string | null }

async function bestellungPerRef(wert: string, lauf: Lauf): Promise<BestellZeile | null> {
  const [z] = (await lauf`
    SELECT ref, person_id, merged_into, superseded_by FROM fiaon_applications
    WHERE ref = ${wert} OR ref = ${wert.toUpperCase()}
    LIMIT 1`) as any[];
  return z ?? null;
}

async function bestellungPerVerwendungszweck(wert: string, lauf: Lauf): Promise<BestellZeile | null> {
  const [z] = (await lauf`
    SELECT ref, person_id, merged_into, superseded_by FROM fiaon_applications
    WHERE payment_reference = ${wert} OR payment_reference = ${wert.toUpperCase()}
    LIMIT 1`) as any[];
  return z ?? null;
}

/**
 * Einer Bestellung bis zum Kopf folgen: zuerst `merged_into`, dann
 * `superseded_by` — höchstens MAX_KETTE Schritte. Fehlt ein Kettenziel (im
 * Bestand 76 Bestellungen, u. a. Prüfstand-Marker), bleibt die Akte am letzten
 * existierenden Glied und sagt es. Ein Zyklus hält an — ohne Fehler: Eine
 * Akte, die aufgeht, ist besser als ein „nicht gefunden".
 */
async function bestellKette(start: BestellZeile, lauf: Lauf): Promise<{ zeile: BestellZeile; umleitungen: Umleitung[] }> {
  const umleitungen: Umleitung[] = [];
  const besucht = new Set<string>([start.ref]);
  let z = start;
  for (let schritt = 0; schritt < MAX_KETTE; schritt++) {
    const naechste = z.merged_into || z.superseded_by;
    if (!naechste) break;
    const grund = z.merged_into ? "bestellung_zusammengefuehrt" : "bestellung_ersetzt";
    if (besucht.has(naechste)) break;
    // `superseded_by` trägt im Bestand BEVORZUGT den Verwendungszweck der
    // ersetzenden Bestellung (fiaon-antrag.ts, fiaon-produkt-hygiene.ts) —
    // gemessen 08.10.2026: 31 von 35 Zeigern, keiner als Referenz. Deshalb
    // erst die Referenz, dann der Verwendungszweck; „fehlt" nur, wenn beides leer ist.
    const n = (await bestellungPerRef(String(naechste), lauf))
      ?? (await bestellungPerVerwendungszweck(String(naechste), lauf));
    if (!n) {
      umleitungen.push({ grund: "kettenziel_fehlt", von: z.ref, nach: String(naechste), am: null, wer: null });
      break;
    }
    if (besucht.has(n.ref)) break;
    umleitungen.push({ grund, von: z.ref, nach: n.ref, am: null, wer: null });
    besucht.add(n.ref);
    z = n;
  }
  return { zeile: z, umleitungen };
}

function fehler(eingabe: string, status: 400 | 404, grund: AkteFehlerGrund, text: string): Aufloesung {
  return { ok: false, eingabe, status, grund, text };
}

function gefunden(eingabe: string, ziel: AkteZiel, umleitungen: Umleitung[], eingabeLeadId: number | null = null): Aufloesung {
  return {
    ok: true, eingabe, ziel, umleitungen, eingabeLeadId,
    kanonisch: ziel.art === "bestellung" ? ziel.ref : `lead-${ziel.leadId}`,
  };
}

/** Personen-Nummer → Kopf → beste Bestellung, sonst jüngster Interessenten-Eintrag. */
async function ausPerson(eingabe: string, personId: number, lauf: Lauf, vorher: Umleitung[] = []): Promise<Aufloesung> {
  const kopf = await personKopf(personId, lauf);
  if (!kopf.ok) return fehler(eingabe, 404, kopf.grund, kopf.text);
  const umleitungen = [...vorher, ...kopf.umleitungen];
  const kopfId = kopf.kopfId;

  const beste = await besteBestellung(kopfId, lauf);
  if (beste) return gefunden(eingabe, { art: "bestellung", ref: beste, personId: kopfId }, umleitungen);

  // Nur zusammengeführte Bestellungen? Dann der Kette der jüngsten folgen —
  // ein Bestell-Merge fasst Bestellungen DESSELBEN Menschen zusammen.
  const [gemergt] = (await lauf`
    SELECT ref, person_id, merged_into, superseded_by FROM fiaon_applications
    WHERE person_id = ${kopfId} ORDER BY created_at DESC LIMIT 1`) as any[];
  if (gemergt) {
    const k = await bestellKette(gemergt, lauf);
    return gefunden(eingabe, { art: "bestellung", ref: k.zeile.ref, personId: kopfId }, [...umleitungen, ...k.umleitungen]);
  }

  // Interessent: jüngster Lead der Person, ein aussortierter nur, wenn es keinen anderen gibt.
  const [lead] = (await lauf`
    SELECT id FROM fiaon_leads WHERE person_id = ${kopfId}
    ORDER BY (dismissed_at IS NULL) DESC, erstellt_am DESC NULLS LAST, id DESC
    LIMIT 1`) as any[];
  if (lead) {
    return gefunden(eingabe, { art: "lead", leadId: Number(lead.id), personId: kopfId }, [
      ...umleitungen,
      { grund: "person_ohne_bestellung", von: String(kopfId), nach: `lead-${Number(lead.id)}`, am: null, wer: null },
    ]);
  }

  const [p] = (await lauf`SELECT created_at FROM fiaon_persons WHERE id = ${kopfId}`) as any[];
  return fehler(eingabe, 404, "person_ohne_vorgang",
    `Person ${kopfId} ist angelegt (seit ${tagText(p?.created_at)}), hat aber weder Antrag noch ` +
    "Interessenten-Eintrag — es gibt keine Akte.");
}

/** lead-N → Bestellung derselben Person, sonst der Lead selbst. */
async function ausLead(eingabe: string, leadId: number, lauf: Lauf): Promise<Aufloesung> {
  const [l] = (await lauf`
    SELECT id, person_id, converted_order_id, email, telefon FROM fiaon_leads WHERE id = ${leadId}`) as any[];
  if (!l) return fehler(eingabe, 404, "lead_fehlt", `Einen Interessenten-Eintrag lead-${leadId} gibt es nicht.`);
  const von = `lead-${leadId}`;

  if (l.person_id != null) {
    const kopf = await personKopf(Number(l.person_id), lauf);
    if (!kopf.ok) {
      // Person fehlt oder Kette kaputt: Der Lead bleibt die Akte — er existiert.
      return gefunden(eingabe, { art: "lead", leadId, personId: null }, [], leadId);
    }
    // Hat der Lead eine Bestellung, die zum SELBEN Kopf gehört? Dann die.
    if (l.converted_order_id) {
      const start = await bestellungPerRef(String(l.converted_order_id), lauf);
      if (start) {
        const k = await bestellKette(start, lauf);
        const zielPerson = k.zeile.person_id != null ? await personKopf(Number(k.zeile.person_id), lauf, false) : null;
        if (zielPerson?.ok && zielPerson.kopfId === kopf.kopfId) {
          return gefunden(eingabe, { art: "bestellung", ref: k.zeile.ref, personId: kopf.kopfId }, [
            ...kopf.umleitungen,
            { grund: "lead_konvertiert", von, nach: k.zeile.ref, am: null, wer: null },
            ...k.umleitungen,
          ], leadId);
        }
      }
    }
    const beste = await besteBestellung(kopf.kopfId, lauf);
    if (beste) {
      return gefunden(eingabe, { art: "bestellung", ref: beste, personId: kopf.kopfId }, [
        ...kopf.umleitungen,
        { grund: "lead_zur_person", von, nach: beste, am: null, wer: null },
      ], leadId);
    }
    return gefunden(eingabe, { art: "lead", leadId, personId: kopf.kopfId }, kopf.umleitungen, leadId);
  }

  // ── Altbestand: Lead OHNE Personen-Nummer ─────────────────────────────
  if (l.converted_order_id) {
    const start = await bestellungPerRef(String(l.converted_order_id), lauf);
    if (start) {
      const k = await bestellKette(start, lauf);
      return gefunden(eingabe, { art: "bestellung", ref: k.zeile.ref, personId: k.zeile.person_id ?? null }, [
        { grund: "lead_konvertiert", von, nach: k.zeile.ref, am: null, wer: null },
        ...k.umleitungen,
      ], leadId);
    }
  }
  const em = String(l.email || "").trim().toLowerCase();
  const ph = String(l.telefon || "").replace(/\D/g, "");
  if (em || ph.length >= 7) {
    const [cand] = (await lauf.unsafe(`
      SELECT a.ref, a.person_id FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND (
        ($1 <> '' AND LOWER(TRIM(a.email)) = $1)
        OR ($2 <> '' AND LENGTH($2) >= 7 AND RIGHT(COALESCE(${APP_PHONE_SQL},''),9) = RIGHT($2,9))
      )
      ORDER BY (a.payment_status = 'paid') DESC, a.created_at ASC LIMIT 1`, [em, ph])) as any[];
    if (cand?.ref) {
      return gefunden(eingabe, { art: "bestellung", ref: String(cand.ref), personId: cand.person_id ?? null }, [
        { grund: "lead_kontaktgleich", von, nach: String(cand.ref), am: null, wer: null },
      ], leadId);
    }
  }
  return gefunden(eingabe, { art: "lead", leadId, personId: null }, [], leadId);
}

/** Referenz, Verwendungszweck oder Personen-Kennung (FIAON-P-…). */
async function ausText(eingabe: string, wert: string, lauf: Lauf): Promise<Aufloesung> {
  const start = (await bestellungPerRef(wert, lauf)) ?? (await bestellungPerVerwendungszweck(wert, lauf));
  if (start) {
    const k = await bestellKette(start, lauf);
    return gefunden(eingabe, { art: "bestellung", ref: k.zeile.ref, personId: k.zeile.person_id ?? null }, k.umleitungen);
  }
  const [p] = (await lauf`
    SELECT id FROM fiaon_persons WHERE person_ref = ${wert} OR person_ref = ${wert.toUpperCase()} LIMIT 1`) as any[];
  if (p) return ausPerson(eingabe, Number(p.id), lauf);
  return fehler(eingabe, 404, "bestellung_fehlt",
    `Zu „${wert.slice(0, 80)}“ gibt es keine Bestellung, keinen Verwendungszweck und keine Personen-Kennung.`);
}

/**
 * Aus einer Kennung die Akte machen. Gibt NIE eine stille Umleitung zurück —
 * jede steht in `umleitungen` und gehört sichtbar über die Akte.
 */
export async function akteAufloesen(eingabeRoh: unknown, lauf: Lauf = sqlPool): Promise<Aufloesung> {
  const eingabe = String(eingabeRoh ?? "").trim().slice(0, 200);
  const k = kennungLesen(eingabe);
  switch (k.art) {
    case "leer": return fehler(eingabe, 400, "kennung_leer", TEXT_KENNUNG_LEER);
    case "person": return ausPerson(eingabe, k.personId, lauf);
    case "lead": return ausLead(eingabe, k.leadId, lauf);
    case "text": return ausText(eingabe, k.wert, lauf);
  }
}
