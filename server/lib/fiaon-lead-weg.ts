// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER LEAD-WEG: EIN KALENDER, DER BUCHT (E-476 Scheibe 3, 05.11.2026)
//
// Justin (05.11.2026, „4× A … Mach alles fix und fertig“), Entscheidung 1A: Das erste Gespräch mit einem neuen
// Business-Lead führt JUSTIN. Leads buchen in Justins Zeiten (30 Minuten, höchstens drei Lead-Gespräche am Tag);
// Daniel ruft trotzdem sofort an und trägt den Lead im Gespräch per Cockpit-Knopf bei Justin ein.
//
// ── DER BEFUND (Plan Lead-Weg 2.0, 04.11.) ────────────────────────────────────
// Der Global-Kalender war leer (die zuständige Person hatte keine Zeitfenster, Justins Kalender schon), der Danke-
// Bildschirm versprach trotzdem „Wählen Sie Tag und Uhrzeit“. Wer über /justin buchte, wurde eine PRIVAT-Person ohne
// Verbindung zum Firmen-Lead, bekam Privat-Mails, und Daniels Auftrag blieb offen.
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
//   · „Gespräche führt“ (global_kalender_agent_id): Vorgabe Justins Konto, „zustaendig“ = wie vor E-476. Eigener
//     Lead-Deckel (3/Tag) und Gesamtdeckel (5/Tag, /justin + Leads) — Startgespräche zahlender Kunden zählen nie mit.
//     Ein Testkonto (Justins Konto ist eines) ist als Gesprächsperson erlaubt (Gutachten 0, Mangel 21).
//   · Der persönliche Link je Anfrage (fiaon_lead_weg): fiaon.com/g/<code>, 10 Zeichen Zufall, 30 Tage. Der Klick
//     setzt ein HttpOnly-Cookie nur für /api/fiaon/global und führt auf die Seite — der Code steht nie in der Adresse
//     der Seite (kein Pixel, keine Statistik, kein Verlauf sieht ihn).
//   · Die Zuordnung jeder Lead-Buchung (fiaon_lead_gespraech): mit Link an DIESE Anfrage, ohne Link per Mail oder
//     Telefon an eine Anfrage der letzten 60 Tage (Gutachten 0, Mangel 17) — Anfrage auf „termin“, Daniels Auftrag
//     schließt sich selbst.
//   · Justin bekommt „Termin steht“ (D2) im Faden des Leads und 60 Minuten vorher die Anruf-Karte (D3) — über die
//     Läufe global_gespraeche (D3, D2-Nachholen), nie ARAS.
//   · Die Mara-Weiche (Postmeister Schritt 0c): Ein offener Global-Lead bekommt keine Mara-Antwort — außer er ist
//     zahlende Privatkundin/zahlender Privatkunde (Gutachten 0, Mangel 7; Gutachten 1, Mangel 1).
//   · Der Prüfversand der vier Global-Gesprächsmails (deutsch und englisch) an Justin (Gutachten 0, Mangel 16).
//
// Schema: Migration 129 + dieselbe DDL hier (leadWegSchema) — nie im Eingang, nie in der Buchungs-Transaktion.
// Mails nur im Betrieb (CRONS_AN) oder über die Prüfstand-Attrappe. Repo öffentlich: keine Kundendaten im Code.
// ═══════════════════════════════════════════════════════════════════════════
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { sqlPool } from "./db-pool";
import { CRONS_AN } from "./fiaon-crons";
import { absoluteUrl } from "../fiaon-base-url";
import {
  LEAD_WEG_SCHLUESSEL as S, LEAD_WEG_VORGABE as V, LEAD_CODE_ZEICHEN, LEAD_CODE_LAENGE, LEAD_GESPRAECH_HERKUENFTE,
  EINSCHAETZUNG_WORT, kalenderWahlLesen, deckelLesen, leadCodeForm, leadLinkUrl, gespraechsHilfe, istLeadGespraech,
  type KalenderWahl, type Einschaetzung,
} from "@shared/fiaon-lead-weg";
import {
  linksEntschaerfen, antwortZeile, TEMPERATUR_WORT, berlinZeit, firmaBrauchbar, fadenAntwortBetreff, landAusTelefon,
  telefonLesbar, leadAnzeigeName, fadenBetreff,
} from "@shared/fiaon-global-lead";
import { globalStartUrl } from "@shared/fiaon-global-wege";
import type { DossierBasis, Faden } from "./fiaon-lead-dossier";
import type { HintergrundErgebnis } from "./fiaon-lead-hintergrund";
import type { EigeneMail } from "./fiaon-brevo";
import type { GlobalZustaendig } from "./fiaon-global-termin";

type Lauf = typeof sqlPool;

const key9 = (tel: unknown) => { const d = String(tel ?? "").replace(/\D/g, ""); return d.length >= 7 ? d.slice(-9) : ""; };

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA (gleich Migration 129) — nie im Eingangs-Pfad, nie in der Buchungs-Transaktion
// ═══════════════════════════════════════════════════════════════════════════
let schemaBereit: Promise<void> | null = null;
export function leadWegSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_weg (
          anfrage_id INTEGER PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          code_bis TIMESTAMPTZ NOT NULL,
          firma_id INTEGER,
          klicks INTEGER NOT NULL DEFAULT 0,
          klick_am TIMESTAMPTZ,
          antwort_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_weg_firma_idx ON fiaon_lead_weg (firma_id) WHERE firma_id IS NOT NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_lead_gespraech (
          termin_id INTEGER PRIMARY KEY,
          anfrage_id INTEGER,
          firma_id INTEGER,
          person_id INTEGER,
          weg TEXT NOT NULL,
          eingetragen_von TEXT,
          erzaehlt TEXT,
          einschaetzung TEXT,
          faden_betreff TEXT,
          d2_am TIMESTAMPTZ,
          d2_id TEXT,
          d2_versuche INTEGER NOT NULL DEFAULT 0,
          d2_laeuft TIMESTAMPTZ,
          d3_am TIMESTAMPTZ,
          d3_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      // Nachbesserung (Gutachten Technik, Mangel 4): die Anruf-Karte D3 mit eigener Laufzeit-Marke (10 Minuten Verfall) — stirbt
      // der Prozess zwischen Marke und Versand, holt der nächste Takt sie nach (vorher war sie für immer verloren).
      await lauf`ALTER TABLE fiaon_lead_gespraech ADD COLUMN IF NOT EXISTS d3_laeuft TIMESTAMPTZ`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_gespraech_anfrage_idx ON fiaon_lead_gespraech (anfrage_id) WHERE anfrage_id IS NOT NULL`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_lead_gespraech_firma_idx ON fiaon_lead_gespraech (firma_id) WHERE firma_id IS NOT NULL`;
    })().catch((e) => { schemaBereit = null; throw e; });
  }
  return schemaBereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// „GESPRÄCHE FÜHRT“ UND DIE DECKEL
// ═══════════════════════════════════════════════════════════════════════════
export interface KalenderPerson {
  person: GlobalZustaendig | null;
  wahl: KalenderWahl["art"];
  /** justin = die Gesprächsperson ist Justins Konto (D2/D3 statt Auftrag) · team = jemand anderes · alt = wie vor E-476. */
  modus: "justin" | "team" | "alt";
  gruenderId: number;
  leadProTag: number;
  gesamtProTag: number;
}

async function gruenderId(): Promise<number> {
  try { return await (await import("../routes/fiaon-gruender-termin")).gruenderAgentId(); } catch { return V.kalenderAgentId; }
}

/** Ein Konto als Gesprächsperson — aktiv, nicht gesperrt; ein Testkonto ist erlaubt (Justins Konto ist eines). */
async function kontoAlsPerson(agentId: number, lauf: Lauf): Promise<GlobalZustaendig | null> {
  const [a] = (await lauf`
    SELECT id, COALESCE(NULLIF(first_name, ''), name) AS vorname, name, email, avatar
      FROM fiaon_agents WHERE id = ${agentId} AND active AND zugang_gesperrt_am IS NULL`.catch(() => [])) as any[];
  if (!a) return null;
  const bild = typeof a.avatar === "string" && a.avatar.startsWith("data:image/") ? a.avatar : null;
  return { id: Number(a.id), vorname: String(a.vorname || a.name || ""), name: String(a.name || a.vorname || ""), email: a.email ?? null, bild, wahl: "einstellung" };
}

/** Die Vorgabe „Gespräche führt“ aus der Umgebung (Render), wenn die Einstellung leer ist — sonst null. */
export function kalenderVorgabeAusUmgebung(): string | null {
  const v = String(process.env.GLOBAL_KALENDER_VORGABE ?? "").trim();
  return v ? v : null;
}

/** Die Einstellungen des Lead-Wegs (ein Lesen). */
export async function leadWegEinstellungen(lauf: Lauf = sqlPool): Promise<{ kalender: string | null; leadProTag: number; gesamtProTag: number }> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${[S.kalenderAgent, S.leadProTag, S.gesamtProTag] as unknown as string[]})`.catch(() => [])) as any[];
  const w = new Map<string, string>(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
  return {
    kalender: w.get(S.kalenderAgent) ?? null,
    leadProTag: deckelLesen(w.get(S.leadProTag), V.leadProTag),
    gesamtProTag: deckelLesen(w.get(S.gesamtProTag), V.gesamtProTag),
  };
}

/**
 * Wer führt die Erstgespräche mit Business-Leads? Vorgabe: Justins Konto. Ist das gewählte Konto inaktiv oder gesperrt,
 * gilt das Verhalten vor E-476 (die zuständige Person) — der Kalender ist dann nicht still leer, und das Log sagt warum.
 */
export async function globalKalenderPerson(lauf: Lauf = sqlPool): Promise<KalenderPerson> {
  const e = await leadWegEinstellungen(lauf);
  const gid = await gruenderId();
  // Nachbesserung (Gutachten Technik Mangel 11 / Betreiber Mangel 7): Ist die Einstellung leer, darf eine Vorgabe aus der Umgebung
  // gelten (GLOBAL_KALENDER_VORGABE=zustaendig) — so bleibt der Kalender nach dem Deploy beim alten Weg, bis der Prüfversand
  // der vier Gesprächsmails gelesen ist; dann „Gespräche führt“ im Chefbüro auf Justin stellen (oder die Variable löschen).
  const wahl = kalenderWahlLesen(e.kalender ?? kalenderVorgabeAusUmgebung(), gid);
  const { globalZustaendig } = await import("./fiaon-global-termin");
  if (wahl.art !== "zustaendig") {
    const p = await kontoAlsPerson(wahl.agentId, lauf);
    if (p) return { person: p, wahl: wahl.art, modus: p.id === gid ? "justin" : "team", gruenderId: gid, leadProTag: e.leadProTag, gesamtProTag: e.gesamtProTag };
    console.warn(`[LEAD-WEG] „Gespräche führt“ = Konto #${wahl.agentId}, aber es ist inaktiv oder gesperrt — es gilt die zuständige Person.`);
  }
  const z = await globalZustaendig();
  return { person: z, wahl: "zustaendig", modus: "alt", gruenderId: gid, leadProTag: e.leadProTag, gesamtProTag: e.gesamtProTag };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER PERSÖNLICHE LINK (fiaon.com/g/<code>)
// ═══════════════════════════════════════════════════════════════════════════
function neuerLeadCode(): string {
  let code = "";
  while (code.length < LEAD_CODE_LAENGE) {
    for (const b of Array.from(randomBytes(16))) {
      if (b >= 224) continue; // gleichverteilt: 4 × 56 = 224
      code += LEAD_CODE_ZEICHEN[b % LEAD_CODE_ZEICHEN.length];
      if (code.length === LEAD_CODE_LAENGE) break;
    }
  }
  return code;
}

export interface LeadLink { code: string; bis: Date; url: string }

/**
 * Der Link einer Global-Anfrage — angelegt beim ersten Bedarf (Meta-Danke-Knopf, Cockpit, Lead-Mails), danach derselbe.
 * Läuft er in weniger als einem Tag ab, gibt es einen neuen (30 Tage). null = keine Global-Anfrage.
 */
export async function leadCodeSichern(anfrageId: number, opt: { firmaId?: number | null; lauf?: Lauf } = {}): Promise<LeadLink | null> {
  const lauf = opt.lauf ?? sqlPool;
  await leadWegSchema(lauf);
  const [a] = (await lauf`SELECT id FROM fiaon_anfragen WHERE id = ${anfrageId} AND art = 'global'`.catch(() => [])) as any[];
  if (!a) return null;
  const firmaId = opt.firmaId ?? (await firmaZurAnfrage(anfrageId, lauf));
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      const [neu] = (await lauf`
        INSERT INTO fiaon_lead_weg (anfrage_id, code, code_bis, firma_id)
        VALUES (${anfrageId}, ${neuerLeadCode()}, NOW() + ${V.codeTage}::int * INTERVAL '1 day', ${firmaId})
        ON CONFLICT (anfrage_id) DO NOTHING
        RETURNING code, code_bis`) as any[];
      if (neu) return { code: String(neu.code), bis: new Date(neu.code_bis), url: leadLinkUrl(String(neu.code)) };
      const [da] = (await lauf`SELECT code, code_bis, firma_id FROM fiaon_lead_weg WHERE anfrage_id = ${anfrageId}`) as any[];
      if (!da) continue;
      if (!da.firma_id && firmaId) await lauf`UPDATE fiaon_lead_weg SET firma_id = ${firmaId}, updated_at = NOW() WHERE anfrage_id = ${anfrageId} AND firma_id IS NULL`.catch(() => {});
      if (new Date(da.code_bis).getTime() > Date.now() + 86_400_000) return { code: String(da.code), bis: new Date(da.code_bis), url: leadLinkUrl(String(da.code)) };
      // Abgelaufen (oder fast): ein neuer Code, atomar — zwei gleichzeitige Aufrufe bekommen denselben.
      const [frisch] = (await lauf`
        UPDATE fiaon_lead_weg SET code = ${neuerLeadCode()}, code_bis = NOW() + ${V.codeTage}::int * INTERVAL '1 day', updated_at = NOW()
         WHERE anfrage_id = ${anfrageId} AND code = ${String(da.code)}
        RETURNING code, code_bis`) as any[];
      if (frisch) return { code: String(frisch.code), bis: new Date(frisch.code_bis), url: leadLinkUrl(String(frisch.code)) };
    } catch (e: any) {
      if (String(e?.code) !== "23505") throw e; // ein Zufallscode doppelt — fast unmöglich, dann ein neuer
    }
  }
  return null;
}

/** Die Firma (Firmen-Cockpit) einer Global-Anfrage — über die Mail oder die Person. */
async function firmaZurAnfrage(anfrageId: number, lauf: Lauf): Promise<number | null> {
  const [f] = (await lauf`
    SELECT f.id FROM fiaon_anfragen a
      JOIN fiaon_firmen_leads f ON (a.person_id IS NOT NULL AND f.person_id = a.person_id)
                                OR (COALESCE(a.email, '') <> '' AND LOWER(COALESCE(f.email, '')) = LOWER(a.email))
     WHERE a.id = ${anfrageId}
     ORDER BY (a.person_id IS NOT NULL AND f.person_id = a.person_id) DESC, f.id ASC LIMIT 1`.catch(() => [])) as any[];
  return f ? Number(f.id) : null;
}

export interface LeadVorlage {
  anfrageId: number; firmaId: number | null;
  name: string; firma: string; email: string; telefon: string; sprache: "de" | "en";
}

/**
 * Die Vorlage hinter einem Code: Name, Firma (nie ein Platzhalter), Mail, Telefon — nur, was der Lead uns selbst gegeben
 * hat, und nur an den, der seinen Link hat. Abgelaufen, vertippt, unbekannt → null (die Seite bleibt die normale Fläche).
 */
export async function leadCodeLesen(code: unknown, opt: { klick?: boolean; lauf?: Lauf; schema?: boolean } = {}): Promise<LeadVorlage | null> {
  if (!leadCodeForm(code)) return null;
  const lauf = opt.lauf ?? sqlPool;
  // In der Buchung (Eingang) läuft keine Tabellen-Anweisung — ohne Tabelle gibt es dort auch keinen Code.
  if (opt.schema !== false) await leadWegSchema(lauf);
  const [r] = (await lauf`
    SELECT w.anfrage_id, w.firma_id, a.name, a.firma, a.email, a.telefon, a.text
      FROM fiaon_lead_weg w JOIN fiaon_anfragen a ON a.id = w.anfrage_id AND a.art = 'global'
     WHERE w.code = ${code} AND w.code_bis > NOW()`.catch(() => [])) as any[];
  if (!r) return null;
  if (opt.klick) await lauf`UPDATE fiaon_lead_weg SET klicks = klicks + 1, klick_am = NOW(), updated_at = NOW() WHERE anfrage_id = ${r.anfrage_id}`.catch(() => {});
  const name = String(r.name ?? "").trim();
  const firmaRoh = String(r.firma ?? "").trim();
  return {
    anfrageId: Number(r.anfrage_id), firmaId: r.firma_id ? Number(r.firma_id) : await firmaZurAnfrage(Number(r.anfrage_id), lauf),
    name, firma: firmaBrauchbar(firmaRoh, name).brauchbar ? firmaRoh : "",
    email: String(r.email ?? "").trim(), telefon: String(r.telefon ?? "").trim(),
    sprache: /^Sprache:\s*Englisch/m.test(String(r.text ?? "")) ? "en" : "de",
  };
}

/** Der Link einer Anfrage (für das Cockpit und die Lead-Mails) — legt ihn bei Bedarf an. */
export async function leadLinkFuerAnfrage(anfrageId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  return (await leadCodeSichern(anfrageId, { lauf }).catch(() => null))?.url ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUORDNUNG: welche Anfrage gehört zu einer Buchung?
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Eine Global-Anfrage der letzten 60 Tage zu Mail ODER Telefon (die letzten neun Ziffern) — die jüngste. Für Buchungen
 * ohne Link und für die /justin-Weiche (Gutachten 0, Mangel 17). Testanfragen zählen nie. null = keine.
 */
export async function offeneAnfrageFuer(email: string | null | undefined, telefon: string | null | undefined, lauf: Lauf = sqlPool): Promise<{ anfrageId: number; firmaId: number | null } | null> {
  const m = String(email ?? "").trim().toLowerCase();
  const k9 = key9(telefon);
  if (!m && !k9) return null;
  // E-476 Scheibe 4: eine Anfrage auf dem Privat-Weg (Beschwerde, Privatkunde) ist kein Business-Lead.
  const [a] = (await lauf`
    SELECT id FROM fiaon_anfragen
     WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) AND created_at > NOW() - ${V.anfrageTage}::int * INTERVAL '1 day'
       AND COALESCE(status, '') <> 'privat'
       AND ((${m} <> '' AND LOWER(COALESCE(email, '')) = ${m})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(telefon, ''), '\\D', '', 'g'), 9) = ${k9}))
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!a) return null;
  return { anfrageId: Number(a.id), firmaId: await firmaZurAnfrage(Number(a.id), lauf) };
}

/**
 * Hat dieser Kontakt schon ein kommendes Lead-Gespräch (z. B. über den Danke-Knopf gebucht, bevor seine Anfrage aus dem
 * Meta-Rückstand kam)? Dann ruft niemand „bitte anrufen“ hinterher — die Anfrage hängt sich an das Gespräch. Nur Lesen.
 */
export async function gebuchtesLeadGespraechFuer(email: string | null | undefined, telefon: string | null | undefined, lauf: Lauf = sqlPool): Promise<{ terminId: number; beginn: Date; personId: number; agentName: string | null } | null> {
  const m = String(email ?? "").trim().toLowerCase();
  const k9 = key9(telefon);
  if (!m && !k9) return null;
  const [t] = (await lauf`
    SELECT t.id, t.beginn, t.person_id, ag.name AS agent_name
      FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
     WHERE t.quelle = 'global' AND t.status = 'gebucht' AND t.beginn > NOW()
       AND COALESCE(t.herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})
       AND ((${m} <> '' AND LOWER(COALESCE(p.primary_email, '')) = ${m})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${k9}))
     ORDER BY t.beginn LIMIT 1`) as any[];
  return t ? { terminId: Number(t.id), beginn: new Date(t.beginn), personId: Number(t.person_id), agentName: t.agent_name ?? null } : null;
}

/**
 * Nachbesserung (Gutachten Betreiber, Mangel 1): Hat dieser Kontakt einen kommenden Termin bei uns — ein Global-Gespräch ODER
 * ein Gespräch über /justin (auch aus der Zeit vor E-476, als die /justin-Buchung eine eigene Privat-Person anlegte)? Über die
 * Mail ODER die letzten neun Ziffern der Nummer, jede Herkunft. Nur Lesen.
 */
export async function kommenderTerminFuerKontakt(email: string | null | undefined, telefon: string | null | undefined, lauf: Lauf = sqlPool): Promise<{ terminId: number; beginn: Date; personId: number; quelle: string } | null> {
  const m = String(email ?? "").trim().toLowerCase();
  const k9 = key9(telefon);
  if (!m && !k9) return null;
  const [t] = (await lauf`
    SELECT t.id, t.beginn, t.person_id, t.quelle
      FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.quelle IN ('global', 'gruender') AND t.status = 'gebucht' AND t.beginn > NOW()
       AND ((${m} <> '' AND LOWER(COALESCE(p.primary_email, '')) = ${m})
         OR (${k9} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${k9}))
     ORDER BY t.beginn LIMIT 1`.catch(() => [])) as any[];
  return t ? { terminId: Number(t.id), beginn: new Date(t.beginn), personId: Number(t.person_id), quelle: String(t.quelle) } : null;
}

export type LeadWegArt = "link" | "seite" | "agent" | "justin";

const WEG_SATZ: Readonly<Record<LeadWegArt, string>> = {
  link: "hat selbst über seinen persönlichen Link gebucht",
  seite: "hat selbst im Kalender auf fiaon.com gebucht",
  agent: "wurde im Gespräch eingetragen",
  justin: "hat über fiaon.com/justin gebucht",
};

/**
 * Nach einer Lead-Buchung: die Zeile in fiaon_lead_gespraech, die Anfrage auf „termin“ und Daniels Auftrag zu (ein
 * Stand statt drei). Wirft nie — der Termin steht schon. Gibt zurück, wessen Auftrag geschlossen wurde.
 */
export async function leadGespraechVerknuepfen(ein: {
  terminId: number; anfrageId: number | null; firmaId: number | null; personId: number | null; weg: LeadWegArt;
  eingetragenVon?: string | null; erzaehlt?: string | null; einschaetzung?: Einschaetzung | null; beginn: Date | string;
  /** false = keine Tabellen-Anweisung (Buchung: der Eingang wartet auf nichts Neues — Gutachten Technik, Mangel 7). */
  schema?: boolean;
}, lauf: Lauf = sqlPool): Promise<{ auftragBei: string | null }> {
  try {
    if (ein.schema !== false) await leadWegSchema(lauf);
    // Steht die Zeile schon (Buchung kam vor der Anfrage), bekommt sie nur, was ihr fehlt — nie etwas überschrieben.
    await lauf`
      INSERT INTO fiaon_lead_gespraech (termin_id, anfrage_id, firma_id, person_id, weg, eingetragen_von, erzaehlt, einschaetzung)
      VALUES (${ein.terminId}, ${ein.anfrageId}, ${ein.firmaId}, ${ein.personId}, ${ein.weg}, ${ein.eingetragenVon ?? null},
              ${ein.erzaehlt ?? null}, ${ein.einschaetzung ?? null})
      ON CONFLICT (termin_id) DO UPDATE SET
        anfrage_id = COALESCE(fiaon_lead_gespraech.anfrage_id, EXCLUDED.anfrage_id),
        firma_id = COALESCE(fiaon_lead_gespraech.firma_id, EXCLUDED.firma_id)`;
  } catch (e) {
    console.error(`[LEAD-WEG] Lead-Gespräch ${ein.terminId} nicht vermerkt:`, String((e as Error)?.message ?? e).slice(0, 200));
  }
  if (!ein.anfrageId) return { auftragBei: null };
  const z = berlinZeit(new Date(ein.beginn));
  const wann = `${z.wochentag}, ${z.datum} um ${String(z.stunde).padStart(2, "0")}:${String(z.minute).padStart(2, "0")} Uhr`;
  await lauf`
    UPDATE fiaon_anfragen SET status = 'termin', bearbeitet_am = NOW(), bearbeitet_von = ${ein.eingetragenVon ?? "System"}
     WHERE id = ${ein.anfrageId}`.catch((e) => console.error(`[LEAD-WEG] Anfrage #${ein.anfrageId} nicht auf „termin“:`, String(e).slice(0, 160)));
  const [t] = (await lauf`
    SELECT id, zustaendig_name FROM fiaon_betreiber_todos WHERE schluessel = ${`global-anfrage:${ein.anfrageId}`} AND status <> 'erledigt'`.catch(() => [])) as any[];
  if (!t) return { auftragBei: null };
  const satz = ein.weg === "agent"
    ? `${ein.eingetragenVon ?? "Das Team"} hat ihn bei Justin eingetragen: ${wann}.`
    : `Der Lead ${WEG_SATZ[ein.weg]}: Gespräch mit Justin ${wann}.`;
  try {
    const { auftragErledigen } = await import("./fiaon-auftraege");
    await auftragErledigen(Number(t.id), {
      art: "auto", von: "System", autorArt: "system",
      ergebnis: `${satz} Der Auftrag hat sich damit selbst geschlossen — Justin führt das Gespräch.`,
      ereignis: "Termin bei Justin",
    }, lauf);
  } catch (e) {
    console.error(`[LEAD-WEG] Auftrag zu Anfrage #${ein.anfrageId} nicht geschlossen:`, String(e).slice(0, 160));
  }
  return { auftragBei: t.zustaendig_name ? String(t.zustaendig_name) : null };
}

/** Was der Lead im Anruf selbst erzählt hat — eine Zeile im Verlauf der Firma (Art „global“, Ergebnis „erzaehlt“). */
export async function erzaehltVermerken(firmaId: number | null, text: string, wer: { id: number | null; name: string }, lauf: Lauf = sqlPool): Promise<void> {
  if (!firmaId || !text.trim()) return;
  await lauf`
    INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
    VALUES (${firmaId}, ${wer.id}, ${wer.name}, 'global', 'erzaehlt', ${text.slice(0, 2000)})`.catch(() => {});
}

/** Was er selbst erzählt hat — die jüngsten Zeilen (Cockpit-Knopf, Anruf-Notizen ab Scheibe 5). */
export async function erzaehltLesen(firmaId: number | null, lauf: Lauf = sqlPool): Promise<{ text: string; wer: string; am: string }[]> {
  if (!firmaId) return [];
  const zeilen = (await lauf`
    SELECT notiz, agent_name, created_at FROM fiaon_firmen_log
     WHERE firma_id = ${firmaId} AND art = 'global' AND ergebnis = 'erzaehlt' AND COALESCE(notiz, '') <> ''
     ORDER BY created_at DESC LIMIT 3`.catch(() => [])) as any[];
  return zeilen.map((z) => ({ text: String(z.notiz), wer: String(z.agent_name || "Team"), am: new Date(z.created_at).toISOString() }));
}

// ═══════════════════════════════════════════════════════════════════════════
// D2 „TERMIN STEHT“ UND D3 „ANRUF-KARTE“ — an Justin, im Faden des Leads
// ═══════════════════════════════════════════════════════════════════════════
type Versand = (m: EigeneMail) => Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }>;
let versandAttrappe: Versand | null = null;
/** Prüfstand: den Versand ersetzen (null = Brevo über eigeneMailSenden). */
export function leadWegVersandSetzen(f: Versand | null): void { versandAttrappe = f; }
async function mailSenden(m: EigeneMail): Promise<{ ok: boolean; messageId: string | null; grund?: string; ohneKopfzeilen?: boolean }> {
  if (versandAttrappe) return versandAttrappe(m);
  const { eigeneMailSenden } = await import("./fiaon-brevo");
  return eigeneMailSenden(m);
}

/** Alles, was D2 und D3 über ein Lead-Gespräch wissen — ein Lesen. */
export interface LeadGespraechStand {
  terminId: number; beginn: Date; status: string; herkunft: string | null; agentId: number; agentName: string;
  personId: number; name: string; firma: string; email: string; telefon: string;
  anfrageId: number | null; firmaId: number | null; weg: LeadWegArt; eingetragenVon: string | null;
  erzaehlt: { text: string; wer: string; am: string }[]; einschaetzung: Einschaetzung | null;
  basis: DossierBasis | null; ki: HintergrundErgebnis | null; faden: Faden; stamm: string;
  cockpitUrl: string; d2Am: Date | null; d3Am: Date | null;
  /** Nachbesserung (Gutachten Betreiber, Mangel 3): Das Gespräch ist auf Englisch (Buchung auf /en oder Anfrage auf Englisch). */
  englisch?: boolean;
}

const jsonObjekt = (v: unknown): any => {
  let o: any = v;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  return o && typeof o === "object" ? o : null;
};

export async function leadGespraechLesen(terminId: number, lauf: Lauf = sqlPool): Promise<LeadGespraechStand | null> {
  await leadWegSchema(lauf);
  const [t] = (await lauf`
    SELECT t.id, t.beginn, t.status, t.herkunft, t.agent_id, t.person_id, ag.name AS agent_name, COALESCE(t.notiz, '') AS notiz,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name, '') AS name,
           COALESCE(p.company_name, '') AS firma, COALESCE(p.primary_email, '') AS email, COALESCE(p.primary_phone, '') AS telefon,
           g.anfrage_id, g.firma_id, g.weg, g.eingetragen_von, g.erzaehlt, g.einschaetzung, g.faden_betreff, g.d2_am, g.d3_am
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
      LEFT JOIN fiaon_lead_gespraech g ON g.termin_id = t.id
     WHERE t.id = ${terminId} AND t.quelle = 'global'`) as any[];
  if (!t) return null;
  const anfrageId = t.anfrage_id ? Number(t.anfrage_id) : null;
  const [af] = anfrageId ? ((await lauf`SELECT text FROM fiaon_anfragen WHERE id = ${anfrageId}`.catch(() => [])) as any[]) : [];
  const englisch = /^Sprache:\s*Englisch/m.test(String(t.notiz ?? "")) || /^Sprache:\s*Englisch/m.test(String(af?.text ?? ""));
  let firmaId = t.firma_id ? Number(t.firma_id) : null;
  if (!firmaId) {
    const [f] = (await lauf`SELECT id FROM fiaon_firmen_leads WHERE person_id = ${t.person_id} ORDER BY updated_at DESC LIMIT 1`.catch(() => [])) as any[];
    firmaId = f ? Number(f.id) : null;
  }
  // Das Dossier: das der Anfrage, sonst das der Buchung — fehlt beides, baut es D3 schnell selbst (ohne Netz, ohne KI;
  // Gutachten 1, Mangel 2: „D3 baut ein fehlendes Dossier spätestens 60 Minuten vor dem Gespräch“).
  const [d] = (await lauf`
    SELECT basis, ki, ki_status, faden_betreff FROM fiaon_lead_dossier
     WHERE (anlass = 'anfrage' AND anlass_id = ${anfrageId ?? 0}) OR (anlass = 'termin' AND anlass_id = ${terminId})
     ORDER BY (anlass = 'anfrage') DESC LIMIT 1`.catch(() => [])) as any[];
  let basis: DossierBasis | null = jsonObjekt(d?.basis);
  if (!basis || !basis.kontakt) {
    try {
      const { leadDossierBasis } = await import("./fiaon-lead-dossier");
      basis = await leadDossierBasis(anfrageId ? { anlass: "anfrage", anlassId: anfrageId } : { anlass: "termin", anlassId: terminId }, { lauf, netz: false, schreiben: false });
    } catch { basis = null; }
  }
  const ki = d && (d.ki_status === "fertig") ? (jsonObjekt(d.ki) as HintergrundErgebnis | null) : null;
  const { fadenLesen, stammFuer } = await import("./fiaon-lead-dossier");
  const faden = await fadenLesen(firmaId, lauf);
  const anzeige = leadAnzeigeName(t.firma, t.name);
  const stamm = faden.stamm || (t.faden_betreff ? String(t.faden_betreff) : null) || (basis ? stammFuer(basis) : fadenBetreff(anzeige, "heiss"));
  const erzaehlt = await erzaehltLesen(firmaId, lauf);
  if (t.erzaehlt && !erzaehlt.some((x) => x.text === String(t.erzaehlt))) erzaehlt.unshift({ text: String(t.erzaehlt), wer: String(t.eingetragen_von || "Team"), am: new Date().toISOString() });
  return {
    terminId: Number(t.id), beginn: new Date(t.beginn), status: String(t.status), herkunft: t.herkunft ? String(t.herkunft) : null,
    agentId: Number(t.agent_id), agentName: String(t.agent_name || ""), personId: Number(t.person_id),
    name: String(t.name || "").trim(), firma: String(t.firma || "").trim(), email: String(t.email || "").trim(), telefon: String(t.telefon || "").trim(),
    anfrageId, firmaId, weg: (t.weg as LeadWegArt) || (t.herkunft === "gruender_global" ? "justin" : t.herkunft === "agent_global" ? "agent" : t.herkunft === "global_link" ? "link" : "seite"),
    eingetragenVon: t.eingetragen_von ? String(t.eingetragen_von) : null, erzaehlt,
    einschaetzung: (t.einschaetzung as Einschaetzung) || null, basis, ki, faden, stamm,
    cockpitUrl: absoluteUrl(firmaId ? `/agent/firmen?firma=${firmaId}` : `/agent/firmen?person=${t.person_id}`),
    d2Am: t.d2_am ? new Date(t.d2_am) : null, d3Am: t.d3_am ? new Date(t.d3_am) : null, englisch,
  };
}

function wannText(d: Date): { lang: string; kurz: string; uhr: string } {
  const z = berlinZeit(d);
  const uhr = `${String(z.stunde).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}`;
  return { lang: `${z.wochentag}, ${z.datum} um ${uhr} Uhr`, kurz: `${z.wochentag.slice(0, 2)} ${z.datum}, ${uhr}`, uhr };
}

function telefonTeil(s: Pick<LeadGespraechStand, "telefon" | "basis">): { lesbar: string; e164: string | null } {
  if (s.basis?.kontakt?.tel?.e164) return { lesbar: s.basis.kontakt.telefonLesbar, e164: s.basis.kontakt.tel.e164 };
  const t = landAusTelefon(s.telefon);
  return { lesbar: telefonLesbar(t, s.telefon) || s.telefon, e164: t.e164 ?? null };
}

function erzaehltZeilen(s: Pick<LeadGespraechStand, "erzaehlt">): string[] {
  return s.erzaehlt.map((x) => {
    const z = berlinZeit(new Date(x.am));
    return `„${linksEntschaerfen(x.text.replace(/\n+/g, " · ").slice(0, 700))}“ (${linksEntschaerfen(x.wer)}, ${z.datum} ${String(z.stunde).padStart(2, "0")}:${String(z.minute).padStart(2, "0")})`;
  });
}

const WIE_D2: Readonly<Record<LeadWegArt, (s: LeadGespraechStand) => string>> = {
  link: () => "hat selbst über seinen persönlichen Link gebucht",
  seite: () => "hat selbst im Kalender auf fiaon.com gebucht",
  agent: (s) => `${s.eingetragenVon ?? "das Team"} hat ihn im Gespräch erreicht und eingetragen`,
  justin: () => "hat über fiaon.com/justin gebucht (Business-Lead — als Global-Gespräch geführt)",
};

export interface LeadMeldung { betreff: string; text: string; knoepfe: { text: string; url: string; leise?: boolean }[]; links: string[]; kopfzeilen: Record<string, string> | null }

/** D2 „Termin steht“ — kurz, im Faden des Leads. Rein (Prüfstand und Versand rendern dieselbe Mail). */
export function d2Mail(s: LeadGespraechStand): LeadMeldung {
  const w = wannText(s.beginn);
  const anzeige = linksEntschaerfen(leadAnzeigeName(s.firma, s.name));
  const tel = telefonTeil(s);
  const t: string[] = [];
  t.push(`TERMIN STEHT: ${w.lang} — ${WIE_D2[s.weg](s)}`, "");
  t.push("Hallo Justin,", "");
  const wer = linksEntschaerfen(s.name || anzeige);
  const firmaSatz = s.basis?.firma.brauchbar || (s.firma && firmaBrauchbar(s.firma, s.name).brauchbar) ? ` (${anzeige})` : "";
  t.push(`${wer}${firmaSatz} spricht ${w.lang} mit dir — ${WIE_D2[s.weg](s)}.`, "");
  const ez = erzaehltZeilen(s);
  if (ez.length) { t.push("WAS ER SELBST ERZÄHLT HAT"); for (const z of ez) t.push(`– ${z}`); t.push(""); }
  t.push("KURZ");
  if (s.englisch) t.push("Sprache: ENGLISCH — das Gespräch auf Englisch führen.");
  t.push(`Telefon: ${tel.lesbar || "—"}${s.email ? ` · E-Mail: ${s.email}` : ""}`);
  const einsch = s.einschaetzung ? `${EINSCHAETZUNG_WORT[s.einschaetzung]} (${linksEntschaerfen(s.eingetragenVon ?? "Team")})` : s.basis ? TEMPERATUR_WORT[s.basis.temperatur.wert] : null;
  if (einsch) t.push(`Einschätzung: ${einsch}`);
  if (s.basis?.antworten.length) t.push(`Antworten: ${s.basis.antworten.map((a) => linksEntschaerfen(a.antwort)).join(" · ")}`);
  else if (s.basis?.nachricht) t.push(`Nachricht: „${linksEntschaerfen(s.basis.nachricht.replace(/\s+/g, " ").slice(0, 240))}“`);
  if (s.basis) t.push(`Check: Firma ${s.basis.fakten.firma === "ja" ? "✓" : s.basis.fakten.firma === "nein" ? "✗" : "?"} · Mail ${s.basis.fakten.mail === "ja" ? "✓" : s.basis.fakten.mail === "nein" ? "✗" : "?"} · ${s.basis.fakten.telefonText}`);
  t.push("", "60 Minuten vorher bekommst du die Anruf-Karte mit allem fürs Gespräch.");
  const ersteMail = s.faden.erste;
  return {
    betreff: ersteMail ? `Termin steht: ${anzeige} — ${w.kurz}` : fadenAntwortBetreff(s.stamm),
    text: t.join("\n"),
    knoepfe: [{ text: "Im Firmen-Cockpit öffnen", url: s.cockpitUrl }],
    links: [s.cockpitUrl],
    kopfzeilen: s.faden.kopfzeilen,
  };
}

/** D3 „Anruf-Karte“ — 60 Minuten vor dem Gespräch. Rein. */
export function d3Mail(s: LeadGespraechStand, jetzt: Date = new Date()): LeadMeldung {
  const w = wannText(s.beginn);
  const anzeige = linksEntschaerfen(leadAnzeigeName(s.firma, s.name));
  const tel = telefonTeil(s);
  const b = s.basis;
  const ergebnisUrl = absoluteUrl("/chef/global-kunden?gespraeche=offen");
  const t: string[] = [];
  t.push(`ANRUF UM ${w.uhr} UHR: ${anzeige} — ${tel.lesbar || "keine Nummer"}`, "");
  t.push("Hallo Justin,", "");
  const minuten = Math.max(0, Math.round((s.beginn.getTime() - jetzt.getTime()) / 60_000));
  const firmaSatz = b?.firma.brauchbar ? ` (${linksEntschaerfen(b.firma.formular)})` : "";
  t.push(`in ${minuten} Minuten rufst du ${linksEntschaerfen(s.name || anzeige)}${firmaSatz} an — ${WIE_D2[s.weg](s)}.${b ? ` Einschätzung: ${TEMPERATUR_WORT[b.temperatur.wert]} (${linksEntschaerfen(b.temperatur.grund)}).` : ""}`, "");
  if (s.englisch) t.push("SPRACHE: ENGLISCH — er hat auf Englisch angefragt bzw. gebucht.", "");
  t.push("SEINE ANTWORTEN");
  if (b?.paketwunsch) t.push(`– Paketwunsch: ${linksEntschaerfen(b.paketwunsch)}`);
  for (const a of b?.antworten ?? []) t.push(`– ${linksEntschaerfen(antwortZeile(a))}`);
  if (b?.nachricht) t.push(`– Nachricht: „${linksEntschaerfen(b.nachricht.replace(/\s+/g, " ").slice(0, 400))}“`);
  if (!b?.paketwunsch && !b?.antworten.length && !b?.nachricht) t.push("– keine Auswahlfragen (Buchung ohne Formular)");
  t.push("");
  t.push("WAS ER SELBST ERZÄHLT HAT");
  const ez = erzaehltZeilen(s);
  if (ez.length) for (const z of ez) t.push(`– ${z}`);
  else t.push("– noch nichts notiert — Privates (Wohnort, Familie, Anteile) fragst du am besten selbst im Gespräch.");
  t.push("");
  t.push("HINTERGRUND");
  if (b) {
    t.push(`– Firma: ${b.fakten.firma === "ja" ? "✓" : b.fakten.firma === "nein" ? "✗" : "?"} ${linksEntschaerfen(b.fakten.firmaText)}`);
    t.push(`– Mail: ${b.fakten.mailText}`);
    t.push(`– Telefon: ${b.fakten.telefonText}`);
  }
  const quellen: string[] = [];
  if (s.ki) {
    const q = (url: string) => { let i = quellen.indexOf(url); if (i < 0) { quellen.push(url); i = quellen.length - 1; } return `[${i + 1}]`; };
    for (const a of s.ki.auffaelligkeiten) t.push(`– ${a.unbestaetigt ? "Hinweis (unbestätigt)" : "ACHTUNG"}: ${a.text} ${q(a.url)}`);
    if (s.ki.kurz) t.push(`– Wer: ${s.ki.kurz.text} ${q(s.ki.kurz.url)}`);
    if (s.ki.mitarbeiter || s.ki.umsatz) t.push(`– Größe: ${[s.ki.mitarbeiter ? `${s.ki.mitarbeiter.text} ${q(s.ki.mitarbeiter.url)}` : null, s.ki.umsatz ? `${s.ki.umsatz.text} ${q(s.ki.umsatz.url)}` : null].filter(Boolean).join(" · ")}`);
    if (s.ki.usBezug) t.push(`– US-Bezug: ${s.ki.usBezug.text} ${q(s.ki.usBezug.url)}`);
  } else if (!b) t.push("– kein Dossier vorhanden");
  t.push("");
  const hilfe = gespraechsHilfe({ antworten: b?.antworten ?? [], temperatur: b?.temperatur.wert ?? "offen", nachricht: b?.nachricht ?? null });
  const auftragsLink = hilfe.paket ? globalStartUrl(hilfe.paket.key) : null;
  t.push("FÜR DEIN GESPRÄCH");
  t.push(`– Einstieg: ${hilfe.einstieg}`);
  hilfe.fragen.forEach((f, i) => t.push(`– Frage ${i + 1}: ${f}`));
  if (hilfe.paket) t.push(`– Paket-Idee: ${hilfe.paket.name} — ${linksEntschaerfen(hilfe.paket.grund)}. Auftragslink zum Schicken: ${auftragsLink}`);
  t.push("");
  t.push("NACH DEM GESPRÄCH");
  t.push(`– Ergebnis eintragen: Chefbüro › Global-Kunden › Gespräche — ${ergebnisUrl}`);
  t.push("– Steht am nächsten Werktag um 9 Uhr kein Ergebnis da, fragt die zuständige Person bei dir nach (keine Aufgabe für dich).");
  if (quellen.length) { t.push("", "QUELLEN"); quellen.forEach((q, i) => t.push(`[${i + 1}] ${q}`)); }
  const knoepfe: LeadMeldung["knoepfe"] = [];
  if (tel.e164) knoepfe.push({ text: `Jetzt anrufen: ${tel.lesbar}`, url: `tel:${tel.e164}` });
  knoepfe.push({ text: "Im Firmen-Cockpit öffnen", url: s.cockpitUrl, leise: true });
  knoepfe.push({ text: "Ergebnis eintragen", url: ergebnisUrl, leise: true });
  return {
    betreff: s.faden.erste ? `${w.uhr} Anruf: ${anzeige} — ${tel.lesbar || "Telefon im Cockpit"}` : fadenAntwortBetreff(s.stamm),
    text: t.join("\n"),
    knoepfe,
    links: [s.cockpitUrl, ergebnisUrl, ...(auftragsLink ? [auftragsLink] : []), ...quellen].filter(Boolean),
    kopfzeilen: s.faden.kopfzeilen,
  };
}

async function anJustinAdresse(lauf: Lauf): Promise<string> {
  const { dossierEinstellungen } = await import("./fiaon-lead-dossier");
  return (await dossierEinstellungen(lauf)).anAdresse;
}

/**
 * D2 senden — atomar beansprucht, höchstens drei Versuche (der Lauf global_gespraeche holt nach). Nur, wenn Justin das
 * Gespräch führt (Gesprächsperson = sein Konto); im Team-Modus meldet der Auftrag wie bisher. Wirft nie.
 */
export async function terminStehtMelden(terminId: number, lauf: Lauf = sqlPool): Promise<"gesendet" | "nicht_noetig" | "uebersprungen" | "fehler"> {
  try {
    await leadWegSchema(lauf);
    const [frei] = (await lauf`
      UPDATE fiaon_lead_gespraech SET d2_versuche = d2_versuche + 1, d2_laeuft = NOW()
       WHERE termin_id = ${terminId} AND d2_am IS NULL AND d2_versuche < 3
         AND (d2_laeuft IS NULL OR d2_laeuft < NOW() - INTERVAL '10 minutes')
      RETURNING termin_id`) as any[];
    if (!frei) return "uebersprungen";
    const s = await leadGespraechLesen(terminId, lauf);
    const gid = await gruenderId();
    if (!s || s.agentId !== gid || s.status !== "gebucht" || s.beginn.getTime() < Date.now()) {
      await lauf`UPDATE fiaon_lead_gespraech SET d2_am = NOW(), d2_id = 'nicht_noetig', d2_laeuft = NULL WHERE termin_id = ${terminId}`.catch(() => {});
      return "nicht_noetig";
    }
    const m = d2Mail(s);
    const an = await anJustinAdresse(lauf);
    const v = await mailSenden({
      an, name: "Justin", betreff: m.betreff, text: m.text, knoepfe: m.knoepfe, kopfzeilen: m.kopfzeilen ?? undefined,
      antwortAn: { email: an, name: "Justin" }, verlinken: m.links, abschnitteFett: true,
    });
    if (!v.ok) throw new Error(v.grund ?? "Versand fehlgeschlagen");
    await lauf`
      UPDATE fiaon_lead_gespraech SET d2_am = NOW(), d2_id = ${v.messageId}, d2_laeuft = NULL, faden_betreff = COALESCE(faden_betreff, ${s.stamm})
       WHERE termin_id = ${terminId}`;
    if (s.firmaId) {
      await lauf`INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
                 VALUES (${s.firmaId}, NULL, 'System', 'global', 'termin_steht', ${`„Termin steht“ an Justin: ${wannText(s.beginn).lang}.`})`.catch(() => {});
    }
    return "gesendet";
  } catch (e) {
    console.error(`[LEAD-WEG] D2 zu Termin ${terminId}:`, String((e as Error)?.message ?? e).slice(0, 200));
    await lauf`UPDATE fiaon_lead_gespraech SET d2_laeuft = NULL WHERE termin_id = ${terminId}`.catch(() => {});
    return "fehler";
  }
}

/** Der Anstoß nach einer Lead-Buchung — nie abgewartet, nur im Betrieb (CRONS_AN). */
export function terminStehtAnstossen(terminId: number): void {
  if (!CRONS_AN) return;
  void terminStehtMelden(terminId).catch(() => {});
}

/**
 * D3: die Anruf-Karte 60 Minuten vor jedem Lead-Gespräch bei Justin. Nachbesserung (Gutachten Technik, Mangel 4): atomar über
 * eine EIGENE Laufzeit-Marke (fiaon_lead_gespraech.d3_laeuft, 10 Minuten Verfall) statt agent_erinnert_am vor dem Versand —
 * stirbt der Prozess zwischen Marke und Versand, holt der nächste Takt die Karte nach. Nach dem Versand stehen d3_am und
 * agent_erinnert_am (die allgemeine Termin-Erinnerung lässt Lead-Gespräche bei Justin ohnehin aus). Gibt die Zahl gesendeter
 * Karten zurück.
 */
export async function anrufKartenSenden(jetzt: Date = new Date(), lauf: Lauf = sqlPool): Promise<number> {
  await leadWegSchema(lauf);
  const gid = await gruenderId();
  const kandidaten = (await lauf`
    SELECT t.id, t.herkunft FROM fiaon_termine t
     WHERE t.quelle = 'global' AND t.status = 'gebucht' AND t.agent_id = ${gid} AND t.agent_erinnert_am IS NULL
       AND COALESCE(t.herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})
       AND t.beginn > ${jetzt} AND t.beginn <= ${new Date(jetzt.getTime() + 62 * 60_000)}
       AND NOT EXISTS (SELECT 1 FROM fiaon_lead_gespraech g WHERE g.termin_id = t.id
                        AND (g.d3_am IS NOT NULL OR (g.d3_laeuft IS NOT NULL AND g.d3_laeuft > NOW() - INTERVAL '10 minutes')))
     ORDER BY t.beginn LIMIT 10`.catch(() => [])) as any[];
  let gesendet = 0;
  for (const k of kandidaten) {
    const weg: LeadWegArt = k.herkunft === "gruender_global" ? "justin" : k.herkunft === "agent_global" ? "agent" : k.herkunft === "global_link" ? "link" : "seite";
    const [frei] = (await lauf`
      INSERT INTO fiaon_lead_gespraech (termin_id, weg, d3_laeuft) VALUES (${k.id}, ${weg}, NOW())
      ON CONFLICT (termin_id) DO UPDATE SET d3_laeuft = NOW()
       WHERE fiaon_lead_gespraech.d3_am IS NULL AND (fiaon_lead_gespraech.d3_laeuft IS NULL OR fiaon_lead_gespraech.d3_laeuft < NOW() - INTERVAL '10 minutes')
      RETURNING termin_id`.catch(() => [])) as any[];
    if (!frei) continue;
    try {
      const s = await leadGespraechLesen(Number(k.id), lauf);
      if (!s) { await lauf`UPDATE fiaon_lead_gespraech SET d3_laeuft = NULL WHERE termin_id = ${k.id}`.catch(() => {}); continue; }
      const m = d3Mail(s, jetzt);
      const an = await anJustinAdresse(lauf);
      const v = await mailSenden({
        an, name: "Justin", betreff: m.betreff, text: m.text, knoepfe: m.knoepfe, kopfzeilen: m.kopfzeilen ?? undefined,
        antwortAn: { email: an, name: "Justin" }, verlinken: m.links, abschnitteFett: true,
      });
      if (!v.ok) throw new Error(v.grund ?? "Versand fehlgeschlagen");
      await lauf`
        UPDATE fiaon_lead_gespraech SET d3_am = NOW(), d3_id = ${v.messageId}, d3_laeuft = NULL,
               anfrage_id = COALESCE(anfrage_id, ${s.anfrageId}), firma_id = COALESCE(firma_id, ${s.firmaId}), person_id = COALESCE(person_id, ${s.personId}),
               faden_betreff = COALESCE(faden_betreff, ${s.stamm})
         WHERE termin_id = ${s.terminId}`;
      await lauf`UPDATE fiaon_termine SET agent_erinnert_am = COALESCE(agent_erinnert_am, NOW()) WHERE id = ${s.terminId}`.catch(() => {});
      gesendet++;
    } catch (e) {
      console.error(`[LEAD-WEG] Anruf-Karte zu Termin ${k.id} nicht gesendet — nächster Takt:`, String((e as Error)?.message ?? e).slice(0, 200));
      await lauf`UPDATE fiaon_lead_gespraech SET d3_laeuft = NULL WHERE termin_id = ${k.id}`.catch(() => {});
    }
  }
  return gesendet;
}

/** D2 nachholen (Störung, Neustart, Anstoß außerhalb des Betriebs) — höchstens drei Versuche, bis zwei Tage. */
export async function terminStehtNachholen(lauf: Lauf = sqlPool): Promise<number> {
  await leadWegSchema(lauf);
  const offen = (await lauf`
    SELECT termin_id FROM fiaon_lead_gespraech
     WHERE d2_am IS NULL AND d2_versuche < 3 AND created_at > NOW() - INTERVAL '2 days' AND created_at < NOW() - INTERVAL '1 minute'
       AND (d2_laeuft IS NULL OR d2_laeuft < NOW() - INTERVAL '10 minutes')
     ORDER BY created_at LIMIT 5`.catch(() => [])) as any[];
  let n = 0;
  for (const o of offen) if ((await terminStehtMelden(Number(o.termin_id), lauf)) === "gesendet") n++;
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE MARA-WEICHE (Postmeister Schritt 0c) — ein offener Global-Lead bekommt keine Mara-Antwort
// ═══════════════════════════════════════════════════════════════════════════
export interface GlobalLeadAbsender { anfrageId: number | null; firmaId: number | null; terminId: number | null; name: string; firma: string }

/**
 * Schreibt hier ein offener Global-Lead (Anfrage der letzten 60 Tage) oder ein Lead-Gesprächs-Kontakt? NICHT, wenn der
 * Absender eine BEZAHLTE Privat-Bestellung hat (dann antwortet Mara wie bisher — Gutachten 0, Mangel 7; Gutachten 1,
 * Mangel 1) oder schon Global-Kunde ist (die Global-Regel des Postmeisters gilt). Wirft bei einer Störung — die Zeile geht
 * auf „fehler“ und wird später neu geprüft, nie „im Zweifel antworten“ (Muster 0b).
 */
export async function globalLeadAbsender(email: string | null | undefined, lauf: Lauf = sqlPool): Promise<GlobalLeadAbsender | null> {
  const a = String(email ?? "").trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1");
  if (!a || !a.includes("@") || a.endsWith("@fiaon.com")) return null;
  // E-476 Scheibe 4: Der Privat-Weg (Beschwerde, Privatkunde über das Global-Formular) schaltet Mara nie stumm.
  const [anfrage] = (await lauf`
    SELECT id, name, firma FROM fiaon_anfragen
     WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) AND created_at > NOW() - ${V.anfrageTage}::int * INTERVAL '1 day'
       AND COALESCE(status, '') <> 'privat'
       AND LOWER(COALESCE(email, '')) = ${a}
     ORDER BY created_at DESC LIMIT 1`) as any[];
  const [termin] = (await lauf`
    SELECT t.id, t.person_id, COALESCE(p.company_name, '') AS firma,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.contact_name, '') AS name
      FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.quelle = 'global' AND COALESCE(t.herkunft, '') = ANY(${LEAD_GESPRAECH_HERKUENFTE as unknown as string[]})
       AND t.beginn > NOW() - ${V.anfrageTage}::int * INTERVAL '1 day' AND LOWER(COALESCE(p.primary_email, '')) = ${a}
     ORDER BY t.beginn DESC LIMIT 1`) as any[];
  if (!anfrage && !termin) return null;
  // Bezahlte Privat-Bestellung → Mara antwortet wie bisher (ihre Fragen zu Karte, Zahlung, Kündigung bleiben nie liegen).
  const [bezahlt] = (await lauf`
    SELECT 1 AS ja FROM fiaon_applications
     WHERE LOWER(COALESCE(email, '')) = ${a} AND merged_into IS NULL AND payment_status = 'paid' LIMIT 1`) as any[];
  if (bezahlt) return null;
  // Schon Global-Kunde (eine Global-Bestellung)? Dann gilt die Global-Regel des Postmeisters, nicht diese Weiche.
  const { produktkategorieSql } = await import("./fiaon-produktkategorie");
  const [kunde] = (await lauf.unsafe(`
    SELECT 1 AS ja FROM fiaon_applications a
     WHERE LOWER(COALESCE(a.email, '')) = $1 AND a.merged_into IS NULL AND ${produktkategorieSql("a")} = 'global' LIMIT 1`, [a])) as any[];
  if (kunde) return null;
  const anfrageId = anfrage ? Number(anfrage.id) : null;
  let firmaId = anfrageId ? await firmaZurAnfrage(anfrageId, lauf) : null;
  if (!firmaId && termin) {
    const [f] = (await lauf`SELECT id FROM fiaon_firmen_leads WHERE person_id = ${termin.person_id} ORDER BY updated_at DESC LIMIT 1`.catch(() => [])) as any[];
    firmaId = f ? Number(f.id) : null;
  }
  return {
    anfrageId, firmaId, terminId: termin ? Number(termin.id) : null,
    name: String(anfrage?.name ?? termin?.name ?? "").trim(), firma: String(anfrage?.firma ?? termin?.firma ?? "").trim(),
  };
}

/**
 * Die Mail eines Global-Leads an ein Mara-Postfach (Postmeister-Weiche 0c). Nachbesserung 05.11.2026 (Gutachten Lead-Sicht
 * Mangel 18, Sicherheit Mangel 6): DIESELBE Regel wie Antworten an js@ (leadAntwortBehandeln) — ein Rückruf-Auftrag an die
 * zuständige Person (keiner bei Termin, Kunde, offenem Auftrag, „bitte nicht anrufen“), Justin nur zur Kenntnis (ohne
 * „antworte selbst“); „keine Mails“ setzt die Sperre, „kein Interesse“ ist eine schriftliche Absage (kein Anruf mehr).
 * Ohne Anfrage (nur ein Lead-Gespräch): Verlauf im Cockpit und eine Zeile an Justin. Wirft nie.
 */
export async function leadAntwortVermerken(l: GlobalLeadAbsender, mail: { postfach: string; betreff: string; auszug: string; von: string }, lauf: Lauf = sqlPool): Promise<void> {
  try {
    await leadWegSchema(lauf);
    const versand = CRONS_AN || !!versandAttrappe;
    if (l.anfrageId) {
      await leadCodeSichern(l.anfrageId, { firmaId: l.firmaId, lauf }).catch(() => null);
      const lp = await import("./fiaon-global-lead-post");
      const lage = await lp.leadLageLesen(l.anfrageId, lauf).catch(() => null);
      if (lage) {
        const { leadAntwortArt } = await import("@shared/fiaon-global-lead-texte");
        const { antwortVorab } = await import("./fiaon-radar-faden");
        const art = leadAntwortArt({ kern: mail.auszug, betreff: mail.betreff, vorab: antwortVorab({ vonAdresse: mail.von, betreff: mail.betreff, text: mail.auszug }) });
        if (!versand) {
          // Ohne Betrieb (Prüfstand ohne Attrappe): nur der Vermerk, nichts geht hinaus.
          await lauf`UPDATE fiaon_lead_weg SET antwort_am = COALESCE(antwort_am, NOW()), updated_at = NOW() WHERE anfrage_id = ${l.anfrageId}`.catch(() => {});
          return;
        }
        await lp.leadAntwortBehandeln(lage, { quelle: mail.postfach, gmailId: null, threadId: null, betreff: mail.betreff, kern: mail.auszug, datum: new Date(), art }, lauf);
        return;
      }
    }
    if (l.firmaId) {
      await lauf`
        INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
        VALUES (${l.firmaId}, NULL, 'System', 'global', 'antwort',
                ${`Der Lead hat an ${mail.postfach} geschrieben: „${mail.betreff.slice(0, 140)}“ — Mara antwortet bewusst nicht (Business-Lead); Justin ist informiert.`})`.catch(() => {});
    }
    if (!versand) return;
    const { fadenLesen } = await import("./fiaon-lead-dossier");
    const faden = await fadenLesen(l.firmaId, lauf);
    const anzeige = linksEntschaerfen(leadAnzeigeName(l.firma, l.name));
    const cockpit = absoluteUrl(l.firmaId ? `/agent/firmen?firma=${l.firmaId}` : "/agent/firmen");
    const an = await anJustinAdresse(lauf);
    const text = [
      `ANTWORT DES LEADS an ${mail.postfach}: „${linksEntschaerfen(mail.betreff.slice(0, 160))}“`, "",
      "Hallo Justin,", "",
      `${linksEntschaerfen(l.name || anzeige)} hat an ${mail.postfach} geschrieben — er hat schon ein Gespräch bei dir, die Mail betrifft vermutlich `
        + `den Termin. Mara antwortet Business-Leads bewusst nicht; die Mail liegt ungelesen im Ordner „FIAON/Global-Lead“ von ${mail.postfach}.`, "",
      "AUSZUG",
      `„${linksEntschaerfen(mail.auszug.replace(/\s+/g, " ").trim().slice(0, 600))}“`,
    ].join("\n");
    const v = await mailSenden({
      an, name: "Justin", betreff: faden.stamm ? fadenAntwortBetreff(faden.stamm) : `Lead schreibt: ${anzeige}`, text,
      knoepfe: [{ text: "Im Firmen-Cockpit öffnen", url: cockpit }], kopfzeilen: faden.kopfzeilen ?? undefined,
      antwortAn: { email: an, name: "Justin" }, verlinken: [cockpit], abschnitteFett: true,
    });
    if (!v.ok) console.error(`[LEAD-WEG] Hinweis an Justin (Lead schreibt) nicht gesendet: ${v.grund}`);
  } catch (e) {
    console.error("[LEAD-WEG] Antwort des Leads nicht vermerkt:", String((e as Error)?.message ?? e).slice(0, 200));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER META-DANKE-KNOPF (/gb?lid=…) — Lead-Kennung → Anfrage → persönlicher Link
// ═══════════════════════════════════════════════════════════════════════════
// Nachbesserung (Gutachten Technik Mangel 10, Sicherheit Mangel 9): das Danke-Cookie ist GESTEMPELT (HMAC über Kennung und
// Ablauf) — ein selbst gesetztes Cookie mit einer fremden Meta-Kennung zählt nie; nach zwei Stunden gilt es nicht mehr.
function gbGeheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "fiaon-dev-lead-gb";
}
function gbStempel(lid: string, bis: number): string {
  return createHmac("sha256", gbGeheim()).update(`lead-gb.${lid}.${bis}`).digest("base64url").slice(0, 32);
}
/** Der Wert des Danke-Cookies: „<Kennung>.<Ablauf in Sekunden>.<Stempel>“. */
export function gbCookieWert(lid: string, jetzt: number = Date.now()): string {
  const bis = Math.floor(jetzt / 1000) + V.cookieStunden * 3600;
  return `${lid}.${bis}.${gbStempel(lid, bis)}`;
}
/** Die Meta-Kennung aus einem gestempelten, nicht abgelaufenen Danke-Cookie — sonst null. */
export function gbCookieLesen(wert: unknown, jetzt: number = Date.now()): string | null {
  const m = /^(\d{3,25})\.(\d{9,11})\.([A-Za-z0-9_-]{32})$/.exec(String(wert ?? "").trim());
  if (!m) return null;
  const bis = Number(m[2]);
  if (!Number.isFinite(bis) || bis * 1000 < jetzt) return null;
  const soll = Buffer.from(gbStempel(m[1], bis));
  const ist = Buffer.from(m[3]);
  return soll.length === ist.length && timingSafeEqual(soll, ist) ? m[1] : null;
}
/**
 * Holt den Meta-Lead (nur einmal gleichzeitig — die Anfrage entsteht über die Beanspruchung in fiaon-meta-leads.ts,
 * Gutachten 0, Mangel 4) und gibt die Anfrage zurück. Ohne `holen` nur nachsehen. „folgt“ = gerade in Arbeit.
 */
export async function metaDankeAufloesen(lid: string, opt: { holen: boolean; lauf?: Lauf; nurFrisch?: boolean }): Promise<{ anfrageId: number } | "folgt" | null> {
  const lauf = opt.lauf ?? sqlPool;
  const nachsehen = async () => {
    const [r] = (await lauf`SELECT global_anfrage_id, lead_id, weg, gesehen_am FROM fiaon_meta_leads WHERE meta_lead_id = ${lid}`.catch(() => [])) as any[];
    return r ?? null;
  };
  let r = await nachsehen();
  // Nachbesserung (Gutachten Sicherheit Mangel 9 / Technik Mangel 10): Die Meta-Kennung ist kein Ausweis ohne Ablauf — über das
  // Danke-Cookie gibt es die Vorlage nur, solange der Lead frisch ist (so lange wie das Cookie, 2 Stunden). Danach gilt nur der
  // persönliche Link aus der Mail.
  if (opt.nurFrisch && r?.gesehen_am && Date.now() - new Date(r.gesehen_am).getTime() > V.cookieStunden * 3_600_000) return null;
  if (r?.global_anfrage_id) return { anfrageId: Number(r.global_anfrage_id) };
  if (r) return r.lead_id || r.weg === "meta_test" || Date.now() - new Date(r.gesehen_am).getTime() > 3 * 60_000 ? null : "folgt";
  if (!opt.holen) return "folgt";
  const { metaKonfig, graph } = await import("./fiaon-meta");
  if (!metaKonfig().bereit) return null;
  const { LEAD_FELDER, metaLeadEinspielen } = await import("./fiaon-meta-leads");
  const roh = await graph(lid, { params: { fields: LEAD_FELDER }, app: "leads" });
  const erg = await metaLeadEinspielen(roh as any, "meta_danke", null);
  if (erg.globalAnfrageId) return { anfrageId: Number(erg.globalAnfrageId) };
  r = await nachsehen();
  return r?.global_anfrage_id ? { anfrageId: Number(r.global_anfrage_id) } : r && !r.lead_id ? "folgt" : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PRÜFVERSAND: die vier Global-Gesprächsmails, deutsch und englisch, an Justin (Gutachten 0, Mangel 16)
// ═══════════════════════════════════════════════════════════════════════════
export const GESPRAECH_MAILS = ["global_termin", "global_termin_erinnerung", "global_termin_kurz", "global_nicht_erreicht", "global_termin_absage"] as const;

/**
 * Rendert jede der vier Vorlagen mit den Beispieldaten der Registry (deutsch und englisch) und sendet sie direkt an
 * `an` (art = 'test' im Protokoll, zählt gegen kein Limit) — dieselbe Tür wie der Prüfversand im Mailwerk. Nur auf Knopf.
 */
export async function gespraechMailsPruefversand(an: string, wer: string): Promise<{ ok: boolean; gesendet: string[]; fehler: string[] }> {
  const adresse = String(an || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) return { ok: false, gesendet: [], fehler: ["keine gültige Zieladresse"] };
  const [{ MAKE_EVENT_REGISTRY }, motor, { mailProtokoll }] = await Promise.all([import("../make-events-registry"), import("../mail/motor"), import("./fiaon-mail-log")]);
  const gesendet: string[] = []; const fehler: string[] = [];
  for (const ev of GESPRAECH_MAILS) {
    const def = MAKE_EVENT_REGISTRY.find((e: any) => e.type === ev) as any;
    if (!def || !motor.hatVorlage(ev)) { fehler.push(`${ev}: keine Vorlage`); continue; }
    for (const sprache of ["de", "en"] as const) {
      const payload = { ...(def.example ?? {}), email: adresse, test: true, ...(sprache === "en" ? { sprache: "en" } : {}) };
      const erg = await motor.mailDirektSenden(ev, payload as Record<string, unknown>).catch((e: any) => ({ ok: false, grund: String(e?.message ?? e), messageId: null as string | null }));
      await mailProtokoll({ event: ev, empfaenger: adresse, status: erg.ok ? "versandt" : "fehlgeschlagen", grund: erg.ok ? null : (erg.grund ?? "unbekannt"), ausgeloestVon: `Prüfversand Global-Gespräche (${wer})`, brevoMessageId: (erg as any).messageId ?? null }).catch(() => {});
      await sqlPool`UPDATE fiaon_mail_log SET art = 'test' WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${ev})`.catch(() => {});
      (erg.ok ? gesendet : fehler).push(`${ev} (${sprache})${erg.ok ? "" : `: ${erg.grund ?? "unbekannt"}`}`);
    }
  }
  return { ok: fehler.length === 0, gesendet, fehler };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER KALENDEREINTRAG: Firma, Rahmen, Cockpit-Link (fiaon-kalender-abo.ts)
// ═══════════════════════════════════════════════════════════════════════════
/** Zu Lead-Gesprächen die Zusatzzeilen des Kalendereintrags — wirft nie (ohne Tabellen: leere Karte). */
export async function leadKalenderZusatz(termine: { id: number; quelle: string; herkunft: string | null; person_id: number }[], lauf: Lauf = sqlPool): Promise<Map<number, string[]>> {
  const karte = new Map<number, string[]>();
  const ids = termine.filter((t) => istLeadGespraech(t)).map((t) => t.id);
  if (!ids.length) return karte;
  try {
    const [da] = (await lauf`SELECT to_regclass('public.fiaon_lead_gespraech') IS NOT NULL AS g, to_regclass('public.fiaon_lead_dossier') IS NOT NULL AS d`) as any[];
    if (!da?.g || !da?.d) return karte;
    const zeilen = (await lauf`
      SELECT g.termin_id, g.firma_id, d.antworten, d.basis->'firma'->>'anzeige' AS firma
        FROM fiaon_lead_gespraech g
        LEFT JOIN LATERAL (
          SELECT antworten, basis FROM fiaon_lead_dossier
           WHERE (anlass = 'anfrage' AND anlass_id = g.anfrage_id) OR (anlass = 'termin' AND anlass_id = g.termin_id)
           ORDER BY (anlass = 'anfrage') DESC LIMIT 1) d ON TRUE
       WHERE g.termin_id = ANY(${ids})`) as any[];
    for (const z of zeilen) {
      const antworten = (jsonObjekt(z.antworten) ?? []) as { frage?: string; antwort?: string; code?: string | null; schluessel?: string | null }[];
      const rahmen = Array.isArray(antworten) ? antworten.find((a) => /^kapitalrahmen/.test(String(a.code ?? a.schluessel ?? "")) || /kapitalrahmen/i.test(String(a.frage ?? ""))) : null;
      const zeilenText = [
        z.firma ? `Firma: ${String(z.firma).slice(0, 120)}` : null,
        rahmen?.antwort ? `Rahmen (sein Ziel): ${String(rahmen.antwort).slice(0, 80)}` : null,
        z.firma_id ? `Firmen-Cockpit: ${absoluteUrl(`/agent/firmen?firma=${z.firma_id}`)}` : null,
      ].filter((x): x is string => !!x);
      if (zeilenText.length) karte.set(Number(z.termin_id), zeilenText);
    }
  } catch { /* der Kalender kommt ohne Zusatz */ }
  return karte;
}
