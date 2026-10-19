// ═══════════════════════════════════════════════════════════════════════════
// MARAS ENTSCHEIDUNGEN — EIN KLICK STATT EINER AUFGABE (15.10.2026, E-370)
//
// Justin, wörtlich: „Mara soll ALLES selbst machen können, nichts weitergeben an
// die Mitarbeiter – wenn sie ne Entscheidung braucht, dann soll ich es mit 1 Klick
// entscheiden können (übersichtlich, verständlich, einfach) – aber Mara soll nicht
// MEHR Arbeit schaffen."
//
// ── WAS EINE ENTSCHEIDUNG IST ─────────────────────────────────────────────
// Eine Karte: was los ist (ein, zwei Sätze), kurze Belege, Maras Empfehlung und
// ein bis drei Optionen. Jede Option nennt ein WERKZEUG mit Argumenten. Der Klick
// im Chefbüro (Mara-Steuerpult › Entscheidungen) führt genau dieses Werkzeug aus —
// und das Werkzeug ruft den BESTEHENDEN Hausweg auf (Kündigung buchen, Bankeingang
// buchen, Vorlagen einreichen …), nie einen zweiten. Danach steht das Ergebnis in
// der Karte („Erledigt: 3 Raten storniert, 147 €“).
//
// ── DIE DREI REGELN ───────────────────────────────────────────────────────
//   1. Nur echte Entscheidungen. Was Mara selbst erledigen darf, erledigt sie;
//      eine Karte entsteht nur, wo Geld oder Recht eine Wahl verlangen.
//   2. Idempotent über den Schlüssel. entscheidungAnlegen legt eine Karte je
//      Schlüssel an; eine offene wird aufgefrischt, eine entschiedene bleibt, wie
//      sie ist (kein zweites Mal fragen).
//   3. Jedes Werkzeug prüft die Lage direkt vor dem Ausführen erneut. Hat sie sich
//      erledigt, tut es nichts — die Karte geht auf „erledigt_von_selbst“.
//
// ── WER KARTEN ANLEGT ─────────────────────────────────────────────────────
// Die Detektoren hier (Raten nach Vertragsende, nie gebuchte Kündigungen,
// Postmeister-Mahnstopps, unverbuchtes Geld, Werbesperre auf eine Zahlungsmail,
// fehlende WhatsApp-Vorlagen). entscheidungenSammeln läuft beim Laden des Reiters,
// höchstens alle zehn Minuten — kein Dauerjob. Mara und der Postmeister legen
// später selbst Karten an (entscheidungAnlegen, werkzeugRegistrieren bzw.
// entscheidungWerkzeug, entscheidungErledigt, entscheidungArt sind dafür exportiert).
//
// Gelesen wird in den Detektoren nur über `lauf` — so lassen sie sich lesend
// gegen die Produktion messen (READ ONLY) und im Prüfstand gegen eine lokale DB.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { JAHRESVERTRAG_AB } from "@shared/fiaon-antrag-stand";
import {
  VERTRAGSENDE_SPALTEN_SQL, ratenNachVertragsende, KUENDIGUNG_ANTRAEGE_SQL, KUENDIGUNG_WIRKSAM_SQL, antragZiel, tagDe,
} from "@shared/fiaon-kuendigung-regel";
// E-401 (3/6): nur Typen — die Module selbst werden dynamisch geladen (kein Kreis).
import type { NachholZeile } from "./fiaon-bank-nachholen";
import type { MaraFund } from "./fiaon-mara-zahlung-suchen";

type Lauf = typeof sqlPool;

// ═══════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════
export type EntscheidungStatus = "offen" | "entschieden" | "erledigt_von_selbst" | "spaeter";
/** gut = bringt Geld oder räumt auf · neutral = lässt alles, wie es ist · vorsicht = endgültig oder rechtlich heikel. */
export type OptionTon = "gut" | "neutral" | "vorsicht";

export interface EntscheidungOption {
  /** Kurz und fest („stornieren“, „lassen“) — steht in `empfehlung` und `gewaehlt`. */
  key: string;
  /** Die Beschriftung des Knopfs. */
  label: string;
  /** Name eines Werkzeugs (entscheidungWerkzeug) — oder „link“, dann ist `link` die Adresse und nichts wird ausgeführt. */
  werkzeug: string;
  args?: Record<string, unknown>;
  ton?: OptionTon;
  /** Nur bei werkzeug „link“: wohin der Knopf führt. */
  link?: string | null;
  /** Ein Satz, was der Knopf bewirkt (Tooltip). */
  titel?: string | null;
}

export interface EntscheidungBeleg {
  /** „4.135 €“, „fällig 12.10.“, „Antrag vom 03.09.“ — oder die Kundenzeile. */
  text: string;
  /** chip (Vorgabe) · zitat (Kundenzeile, gekürzt) · zeile (Liste einer Sammelkarte). */
  art?: "chip" | "zitat" | "zeile";
  ton?: "gut" | "warn" | "krit";
  /** Für zitat: woher („Mail 04.09.“). Für zeile: der Name. */
  name?: string | null;
  personId?: number | null;
}

/** Was entscheidungAnlegen braucht. */
export interface EntscheidungNeu {
  /** Eindeutig je Lage („kuendigung_ungebucht:142“) — macht das Anlegen idempotent. */
  schluessel: string;
  art: string;
  personId?: number | null;
  ref?: string | null;
  titel: string;
  text: string;
  /** Der key der empfohlenen Option. */
  empfehlung: string;
  optionen: EntscheidungOption[];
  belege?: EntscheidungBeleg[];
  /** Geld/Recht vor Komfort: höher = weiter oben. Vorgabe aus der Art (ART), sonst 50. */
  gewicht?: number;
}

/** Eine Zeile der Tabelle (roh). */
export interface EntscheidungZeile {
  id: number; schluessel: string; art: string; person_id: number | null; ref: string | null;
  titel: string; text: string; empfehlung: string | null; optionen: EntscheidungOption[]; belege: EntscheidungBeleg[];
  gewicht: number; status: EntscheidungStatus; spaeter_bis: Date | null; entschieden_am: Date | null; entschieden_von: string | null;
  gewaehlt: string | null; ergebnis: string | null; fehler: string | null; created_at: Date; aktualisiert_am: Date;
  name?: string | null;
}

/** Was die Oberfläche bekommt — ohne die Argumente der Werkzeuge. */
export interface EntscheidungSicht {
  id: number; art: string; artText: string; gewicht: number;
  personId: number | null; name: string | null; ref: string | null;
  titel: string; text: string; empfehlung: string | null;
  optionen: { key: string; label: string; ton: OptionTon; link: string | null; titel: string | null }[];
  belege: EntscheidungBeleg[];
  status: EntscheidungStatus; spaeterBis: string | null; entschiedenAm: string | null; entschiedenVon: string | null;
  gewaehlt: string | null; gewaehltLabel: string | null; ergebnis: string | null; fehler: string | null; createdAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ARTEN — Etikett und Gewicht (Geld/Recht vor Komfort)
// ═══════════════════════════════════════════════════════════════════════════
const ART: Record<string, { text: string; gewicht: number }> = {
  kuendigung_ungebucht: { text: "Kündigung", gewicht: 90 },
  raten_nach_ende: { text: "Raten nach Vertragsende", gewicht: 85 },
  eingang_unverbucht: { text: "Geld eingegangen", gewicht: 80 },
  mahnstopp: { text: "Mahnstopp", gewicht: 70 },
  werbesperre_zahlungspost: { text: "Werbesperre", gewicht: 50 },
  wa_vorlagen: { text: "WhatsApp-Vorlagen", gewicht: 20 },
};
/** Ab diesem Gewicht zählt eine Karte als „Geld/Recht“ (Kopfzeile des Reiters). */
export const GEWICHT_GELD_RECHT = 60;

/** Eine neue Art bekannt machen (Etikett und Gewicht) — für Karten, die Mara oder der Postmeister selbst anlegen. */
export function entscheidungArt(art: string, text: string, gewicht = 50): void {
  ART[art] = { text, gewicht };
}
const artText = (art: string) => ART[art]?.text ?? (art.charAt(0).toUpperCase() + art.slice(1)).replace(/_/g, " ");

// ═══════════════════════════════════════════════════════════════════════════
// TABELLE
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function entscheidungTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_mara_entscheidungen (
          id BIGSERIAL PRIMARY KEY,
          schluessel TEXT NOT NULL UNIQUE,
          art TEXT NOT NULL,
          person_id INTEGER,
          ref TEXT,
          titel TEXT NOT NULL,
          text TEXT NOT NULL DEFAULT '',
          empfehlung TEXT,
          optionen JSONB NOT NULL DEFAULT '[]'::jsonb,
          belege JSONB NOT NULL DEFAULT '[]'::jsonb,
          gewicht INTEGER NOT NULL DEFAULT 50,
          status TEXT NOT NULL DEFAULT 'offen',
          spaeter_bis TIMESTAMPTZ,
          entschieden_am TIMESTAMPTZ,
          entschieden_von TEXT,
          gewaehlt TEXT,
          ergebnis TEXT,
          fehler TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_entscheidungen_status_idx ON fiaon_mara_entscheidungen (status, gewicht DESC, created_at)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_entscheidungen_art_idx ON fiaon_mara_entscheidungen (art, status)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// KLEINE HELFER
// ═══════════════════════════════════════════════════════════════════════════
export const euroText = (cents: number) =>
  `${(Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const kurz = (t: unknown, n: number) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()} …` : s;
};
/** „2026-10-12“ oder ein Zeitpunkt → „12.10.“ (Berlin). */
function tagKurz(v: unknown): string {
  if (v == null || v === "") return "";
  const s = typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date(v as any).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : "";
}
const json = <T>(v: unknown, vorgabe: T): T => {
  if (v == null) return vorgabe;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return vorgabe; } }
  return v as T;
};
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const epoche = (v: unknown): number => Math.floor(new Date(v as any).getTime() / 1000);
/** Name aus einer Personenzeile (Alias p) — als SQL-Ausdruck. */
const NAME_SQL = (p: string, a?: string) =>
  `NULLIF(TRIM(CONCAT_WS(' ', COALESCE(NULLIF(TRIM(${p}.first_name), '')${a ? `, ${a}.first_name` : ""}), COALESCE(NULLIF(TRIM(${p}.last_name), '')${a ? `, ${a}.last_name` : ""}))), '')`;

/** Der Schlüssel einer Sammelkarte: die offene weiterführen, sonst eine neue Nummer (art#n). */
async function sammelSchluessel(art: string, lauf: Lauf): Promise<string> {
  // Ohne Tabelle (frische Datenbank, lesende Messung) die erste Nummer — eine fehlgeschlagene Abfrage bräche die Transaktion.
  const [t] = (await lauf.unsafe(`SELECT to_regclass('public.fiaon_mara_entscheidungen') IS NOT NULL AS da`)) as any[];
  if (!t?.da) return `${art}#1`;
  const z = (await lauf.unsafe(
    `SELECT (SELECT schluessel FROM fiaon_mara_entscheidungen WHERE art = $1 AND status IN ('offen', 'spaeter') ORDER BY id DESC LIMIT 1) AS offen,
            (SELECT COUNT(*)::int FROM fiaon_mara_entscheidungen WHERE art = $1) AS n`, [art]).catch(() => [])) as any[];
  return z[0]?.offen ? String(z[0].offen) : `${art}#${Number(z[0]?.n || 0) + 1}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN — idempotent über den Schlüssel
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Legt eine Entscheidung an oder frischt eine OFFENE (auch „später“) auf: Titel, Text, Belege, Optionen, Empfehlung.
 * Eine entschiedene oder von selbst erledigte Karte gleichen Schlüssels bleibt unberührt — dann `null`.
 * Wirft bei ungültiger Karte (keine Option, Empfehlung nicht unter den Optionen).
 */
export async function entscheidungAnlegen(e: EntscheidungNeu, lauf: Lauf = sqlPool): Promise<{ id: number; neu: boolean; status: EntscheidungStatus } | null> {
  const schluessel = String(e.schluessel ?? "").trim().slice(0, 200);
  if (!schluessel) throw new Error("[ENTSCHEIDUNG] Schlüssel fehlt.");
  if (!Array.isArray(e.optionen) || !e.optionen.length) throw new Error(`[ENTSCHEIDUNG] ${schluessel}: keine Option.`);
  const keys = new Set<string>();
  for (const o of e.optionen) {
    if (!o?.key || !o.label || !o.werkzeug) throw new Error(`[ENTSCHEIDUNG] ${schluessel}: Option ohne key, label oder werkzeug.`);
    if (keys.has(o.key)) throw new Error(`[ENTSCHEIDUNG] ${schluessel}: Option „${o.key}“ doppelt.`);
    keys.add(o.key);
  }
  if (!keys.has(e.empfehlung)) throw new Error(`[ENTSCHEIDUNG] ${schluessel}: Empfehlung „${e.empfehlung}“ steht nicht unter den Optionen.`);
  const gewicht = Number.isFinite(Number(e.gewicht)) ? Math.round(Number(e.gewicht)) : (ART[e.art]?.gewicht ?? 50);
  const [z] = (await lauf`
    INSERT INTO fiaon_mara_entscheidungen (schluessel, art, person_id, ref, titel, text, empfehlung, optionen, belege, gewicht)
    VALUES (${schluessel}, ${String(e.art).slice(0, 60)}, ${e.personId ?? null}, ${e.ref ?? null}, ${kurz(e.titel, 160)}, ${String(e.text ?? "").slice(0, 1200)},
            ${e.empfehlung}, ${JSON.stringify(e.optionen)}::text::jsonb, ${JSON.stringify(e.belege ?? [])}::text::jsonb, ${gewicht})
    ON CONFLICT (schluessel) DO UPDATE
       SET art = EXCLUDED.art, person_id = EXCLUDED.person_id, ref = EXCLUDED.ref, titel = EXCLUDED.titel, text = EXCLUDED.text,
           empfehlung = EXCLUDED.empfehlung, optionen = EXCLUDED.optionen, belege = EXCLUDED.belege, gewicht = EXCLUDED.gewicht,
           aktualisiert_am = NOW()
     WHERE fiaon_mara_entscheidungen.status IN ('offen', 'spaeter')
    RETURNING id, status, (xmax = 0) AS neu`) as any[];
  return z ? { id: Number(z.id), neu: z.neu === true, status: z.status } : null;
}

/** Eine offene Karte von außen schließen (die Lage hat sich erledigt) — für Karten, die Mara/Postmeister angelegt haben. */
export async function entscheidungErledigt(schluessel: string, text = "Hat sich von selbst erledigt.", lauf: Lauf = sqlPool): Promise<boolean> {
  const z = (await lauf`
    UPDATE fiaon_mara_entscheidungen SET status = 'erledigt_von_selbst', entschieden_am = NOW(), ergebnis = ${kurz(text, 400)},
           spaeter_bis = NULL, aktualisiert_am = NOW()
     WHERE schluessel = ${schluessel} AND status IN ('offen', 'spaeter') RETURNING id`) as any[];
  return z.length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS WERKZEUG-REGISTER — Name → Ausführer
//
// Ein Ausführer prüft die Lage zuerst neu, dann ruft er den bestehenden Weg.
// Sein Ergebnis: erledigt (Satz für die Karte), von_selbst (nichts mehr zu tun)
// oder fehler (die Karte bleibt offen, der Fehler steht darin).
// ═══════════════════════════════════════════════════════════════════════════
export interface EntscheidungKontext {
  /** Wer geklickt hat — „Justin Schwarzott“ oder „Chef #2“. */
  von: string;
  agentId: number | null;
  karte: EntscheidungZeile;
  lauf: Lauf;
}
export interface AusfuehrErgebnis { ergebnis: "erledigt" | "von_selbst" | "fehler"; text: string }
export interface EntscheidungWerkzeug {
  name: string;
  ausfuehren: (args: any, k: EntscheidungKontext) => Promise<AusfuehrErgebnis>;
}
const WERKZEUGE = new Map<string, EntscheidungWerkzeug>();
/** Ein Werkzeug anmelden (oder ersetzen). */
export function entscheidungWerkzeug(w: EntscheidungWerkzeug): void { WERKZEUGE.set(w.name, w); }
/** Dasselbe in der Form für Postmeister und Mara: werkzeugRegistrieren("entwurf_senden", async (args, k) => …). */
export type EntscheidungAusfuehrer = EntscheidungWerkzeug["ausfuehren"];
export function werkzeugRegistrieren(name: string, ausfuehrer: EntscheidungAusfuehrer): void {
  if (!String(name ?? "").trim() || name === "link") throw new Error(`[ENTSCHEIDUNG] Ungültiger Werkzeugname „${name}“.`);
  WERKZEUGE.set(name, { name, ausfuehren: ausfuehrer });
}
/** Die Ergebnisformen für eigene Ausführer: erledigt (Satz in die Karte), nichts mehr zu tun, Fehler (Karte bleibt offen). */
export const ausfuehrErgebnis = {
  erledigt: (text: string): AusfuehrErgebnis => ({ ergebnis: "erledigt", text }),
  vonSelbst: (text: string): AusfuehrErgebnis => ({ ergebnis: "von_selbst", text }),
  fehler: (text: string): AusfuehrErgebnis => ({ ergebnis: "fehler", text }),
};
export function entscheidungWerkzeugNamen(): string[] { return Array.from(WERKZEUGE.keys()).sort(); }

const erledigt = (text: string): AusfuehrErgebnis => ({ ergebnis: "erledigt", text });
const vonSelbst = (text: string): AusfuehrErgebnis => ({ ergebnis: "von_selbst", text });
const fehler = (text: string): AusfuehrErgebnis => ({ ergebnis: "fehler", text });

/** Ein Vermerk im Verlauf der Person (fiaon_contact_log, type system) — der übliche Ort. */
async function vermerk(lauf: Lauf, o: { personId: number | null; ref: string | null; von: string; text: string }): Promise<void> {
  if (!o.personId && !o.ref) return;
  await lauf`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
    VALUES (${o.ref}, ${o.personId}, NULL, ${`Mara (Entscheidung: ${o.von})`.slice(0, 120)}, 'system', ${o.text.slice(0, 1000)}, NOW())`.catch(() => {});
}

// „So lassen“ — nichts tun, nur festhalten.
entscheidungWerkzeug({ name: "nichts", async ausfuehren() { return erledigt("Bleibt, wie es ist."); } });

// ═══════════════════════════════════════════════════════════════════════════
// a) RATEN NACH VERTRAGSENDE (Altverträge vor dem 03.09.2026, gekündigt)
//
// Eine Sammelkarte. Geschuldet bleibt, was bis zum Vertragsende fällig ist
// (Justin: „offene Rechnung vor Kündigung bleibt“); storniert wird nur danach —
// ratenNachVertragsendeStornieren hält diese Grenze selbst in der Anweisung.
// Die Mahnungen dafür sind seit E-368 gestoppt; die Karte räumt die Bücher auf.
// ═══════════════════════════════════════════════════════════════════════════
const RATEN_NACH_ENDE_SQL = `
  SELECT a.ref, a.person_id, ${NAME_SQL("p", "a")} AS name, ${VERTRAGSENDE_SPALTEN_SQL("a")},
         (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'rate_nr', r.rate_nr, 'betrag_cents', r.betrag_cents,
                   'faellig_am', to_char(r.faellig_am, 'YYYY-MM-DD')) ORDER BY r.rate_nr), '[]'::json)
            FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offene
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
   WHERE a.merged_into IS NULL AND a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL
     AND (a.agb_stand IS NULL OR a.agb_stand < DATE '${JAHRESVERTRAG_AB}')
     AND EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)`;

interface RateKurz { id: number; rate_nr: number; betrag_cents: number; faellig_am: string | null }
interface NachEndeFall { ref: string; personId: number | null; name: string | null; ende: string; raten: RateKurz[]; bisEnde: RateKurz[] }

/** Die gekündigten Altverträge mit Raten nach dem Vertragsende — die eine Rechnung (ratenNachVertragsende). */
export async function ratenNachEndeFaelle(lauf: Lauf = sqlPool, refs: string[] | null = null): Promise<NachEndeFall[]> {
  const zeilen = (refs
    ? await lauf.unsafe(`${RATEN_NACH_ENDE_SQL} AND a.ref = ANY($1::text[]) ORDER BY a.ref`, [refs])
    : await lauf.unsafe(`${RATEN_NACH_ENDE_SQL} ORDER BY a.ref`)) as any[];
  const aus: NachEndeFall[] = [];
  for (const z of zeilen) {
    const offene = json<RateKurz[]>(z.offene, []).map((r) => ({ ...r, id: Number(r.id), rate_nr: Number(r.rate_nr), betrag_cents: Number(r.betrag_cents) || 0 }));
    const { ende, nachEnde } = ratenNachVertragsende(z, offene);
    if (!ende || !nachEnde.length) continue;
    aus.push({ ref: String(z.ref), personId: z.person_id != null ? Number(z.person_id) : null, name: z.name ?? null, ende, raten: nachEnde,
      bisEnde: offene.filter((r) => !nachEnde.includes(r)) });
  }
  return aus;
}

async function findeRatenNachEnde(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const faelle = await ratenNachEndeFaelle(lauf);
  if (!faelle.length) return [];
  const raten = faelle.reduce((n, f) => n + f.raten.length, 0);
  const cents = faelle.reduce((n, f) => n + f.raten.reduce((m, r) => m + r.betrag_cents, 0), 0);
  const bleiben = faelle.reduce((n, f) => n + f.bisEnde.length, 0);
  const personen = new Set(faelle.map((f) => f.personId ?? f.ref)).size;
  const belege: EntscheidungBeleg[] = [
    { text: `${personen} ${personen === 1 ? "Person" : "Personen"}` },
    { text: `${raten} ${raten === 1 ? "Rate" : "Raten"}` },
    { text: euroText(cents), ton: "warn" },
    ...(bleiben ? [{ text: `${bleiben} ${bleiben === 1 ? "Rate" : "Raten"} vor dem Ende bleiben offen` } as EntscheidungBeleg] : []),
    ...faelle.map((f) => ({
      art: "zeile" as const, personId: f.personId, name: f.name ?? f.ref,
      text: `${f.raten.length === 1 ? "Rate" : "Raten"} ${f.raten.map((r) => r.rate_nr).join(", ")} · ${euroText(f.raten.reduce((m, r) => m + r.betrag_cents, 0))} · Ende ${tagKurz(f.ende)}`,
    })),
  ];
  return [{
    schluessel: await sammelSchluessel("raten_nach_ende", lauf),
    art: "raten_nach_ende",
    titel: `Raten nach Vertragsende stornieren: ${personen} ${personen === 1 ? "Person" : "Personen"}, ${euroText(cents)}`,
    text: `Gekündigte Altverträge (vor 03.09.) haben noch ${raten} ${raten === 1 ? "Rate" : "Raten"}, die erst nach dem Vertragsende fällig sind — die schuldet niemand. `
      + "Gemahnt wird schon nicht mehr; der Klick räumt die Bücher auf. Raten bis zum Ende bleiben offen.",
    empfehlung: "stornieren",
    optionen: [
      { key: "stornieren", label: "Alle stornieren", werkzeug: "raten_nach_ende_stornieren", ton: "gut",
        titel: "Storniert nur Raten, die nach dem Vertragsende fällig sind.",
        args: { faelle: faelle.map((f) => ({ ref: f.ref, ids: f.raten.map((r) => r.id) })) } },
      { key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" },
    ],
    belege,
  }];
}

entscheidungWerkzeug({
  name: "raten_nach_ende_stornieren",
  async ausfuehren(args, k) {
    const { ratenNachVertragsendeStornieren } = await import("./fiaon-raten-storno");
    const gewollt = new Map<string, Set<number>>();
    for (const f of Array.isArray(args?.faelle) ? args.faelle : []) {
      const ref = String(f?.ref ?? "");
      if (ref) gewollt.set(ref, new Set((Array.isArray(f?.ids) ? f.ids : []).map(Number).filter((n: number) => Number.isInteger(n) && n > 0)));
    }
    if (!gewollt.size) return fehler("Die Karte nennt keine Raten.");
    // Die Lage JETZT — eine Rate, die inzwischen bezahlt, storniert oder wieder geschuldet ist, fällt heraus.
    const jetzt = await ratenNachEndeFaelle(k.lauf, Array.from(gewollt.keys()));
    let anzahl = 0, cents = 0, personen = 0;
    const fehlerRefs: string[] = [];
    for (const f of jetzt) {
      const ids = f.raten.map((r) => r.id).filter((id) => gewollt.get(f.ref)?.has(id));
      if (!ids.length) continue;
      try {
        const weg = await k.lauf.begin(async (tx: any) => {
          const w = await ratenNachVertragsendeStornieren(f.ref, ids, f.ende, tx);
          if (w.length) {
            const summe = w.reduce((m, r) => m + r.betrag_cents, 0);
            await tx`
              INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
              VALUES (${f.ref}, ${f.personId}, NULL, ${`Mara (Entscheidung: ${k.von})`.slice(0, 120)}, 'system',
                      ${`${w.length === 1 ? "Rate" : "Raten"} ${w.map((r) => r.rate_nr).join(", ")} (${euroText(summe)}) nach dem Vertragsende (${tagDe(f.ende)}) storniert — nicht geschuldet (Vertrag vor dem 03.09.2026, AGB § 6). Raten bis zum Vertragsende bleiben offen. Entscheidung im Mara-Steuerpult: ${k.von}.`}, NOW())`;
          }
          return w;
        });
        if (weg.length) { anzahl += weg.length; cents += weg.reduce((m: number, r: any) => m + r.betrag_cents, 0); personen++; }
      } catch (e) {
        console.error(`[ENTSCHEIDUNG] Storno nach Vertragsende ${f.ref}:`, String((e as Error)?.message ?? e).slice(0, 200));
        fehlerRefs.push(f.ref);
      }
    }
    if (!anzahl && !fehlerRefs.length) return vonSelbst("Nichts mehr offen — die Raten sind inzwischen bezahlt, storniert oder wieder geschuldet.");
    if (!anzahl) return fehler(`Storno gescheitert (${fehlerRefs.length} ${fehlerRefs.length === 1 ? "Bestellung" : "Bestellungen"}) — bitte noch einmal.`);
    return erledigt(`${anzahl} ${anzahl === 1 ? "Rate" : "Raten"} bei ${personen} ${personen === 1 ? "Person" : "Personen"} storniert, ${euroText(cents)}.`
      + (fehlerRefs.length ? ` ${fehlerRefs.length} gescheitert — erscheinen beim nächsten Prüfen wieder.` : ""));
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// b) KÜNDIGUNGEN, DIE NIE GEBUCHT WURDEN (cancellation_requests, E-IT-B)
//
// Gebucht wird über antragBuchen (routes/fiaon-kuendigung.ts) — derselbe Weg wie
// die Akte (/agent/kunden/:id/kuendigung, ausAntrag): Ziel aus antragZiel, zum
// Eingangstag, Quelle „formular“, Urkunde, Bestätigungsmail, Antrag geschlossen.
// „Ist keine Kündigung“ schließt den Antrag mit Grund (kuendigungsantragSchliessen).
//
// Die Empfehlung: Das Formular /kuendigung IST die Erklärung — „Die Kosten sind zu
// hoch" ist ein Grund, keine Frage. Nur wo der Text selbst zweifelt („würde“,
// „überlege“, „wie kann ich“, eine Frage) und istWillenserklaerung ihn nicht als
// Kündigung liest, empfiehlt Mara „Ist keine Kündigung“.
// ═══════════════════════════════════════════════════════════════════════════
const ZWEIFEL = /(würde|wuerde|überlege|ueberlege|vielleicht|eventuell|wie kann ich|wie kündige|wie kuendige|\bfalls\b|\?)/i;

/** Rein: Ist dieser Antragstext eine Kündigung? Formular = ja, außer der Text zweifelt selbst. */
export function antragIstKuendigung(text: string | null | undefined, istWillenserklaerung: (t: string) => boolean): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (istWillenserklaerung(t)) return true;
  return !ZWEIFEL.test(t);
}

async function findeKuendigungen(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const { istWillenserklaerung } = await import("./fiaon-kuendigung");
  const zeilen = (await lauf.unsafe(`
    SELECT kr_u.*, kr_u.antrag_am::timestamptz AS antrag_am_tz, ${NAME_SQL("p")} AS name,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
             WHERE a.person_id = kr_u.person_id AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS raten_offen,
           (SELECT COALESCE(SUM(r.betrag_cents), 0)::int FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
             WHERE a.person_id = kr_u.person_id AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS raten_cents
      FROM (${KUENDIGUNG_ANTRAEGE_SQL}) kr_u
      LEFT JOIN fiaon_persons p ON p.id = kr_u.person_id
     ORDER BY kr_u.antrag_am ASC, kr_u.antrag_id ASC`)) as any[];
  const jePerson = new Map<number, any[]>();
  const aus: EntscheidungNeu[] = [];
  for (const z of zeilen) {
    const pid = Number(z.person_id);
    if (!jePerson.has(pid)) {
      // Dieselben Bestellungen wie offeneKuendigungsantraege (fiaon-kuendigung.ts): auch zusammengeführte und Dubletten.
      jePerson.set(pid, (await lauf`
        SELECT ref, type, pack_key, pack_name, merged_into, payment_status, gekuendigt_am, created_at, archived_at, gdpr_deleted_at
          FROM fiaon_applications
         WHERE person_id = ${pid} OR person_id IN (SELECT d.id FROM fiaon_persons d WHERE d.merged_into_person_id = ${pid})`) as any[]);
    }
    const bestellungen = jePerson.get(pid)!;
    const ziel = antragZiel({ ref: z.antrag_ref, am: z.antrag_am }, bestellungen);
    const zb = ziel.ziel ? bestellungen.find((b) => String(b.ref) === ziel.ziel) : null;
    const paket = zb?.pack_name ? String(zb.pack_name).split("\n")[0] : "das Paket";
    const am = z.antrag_am_tz ?? z.antrag_am;
    const grund = z.antrag_grund ? String(z.antrag_grund) : "";
    const istKuendigung = antragIstKuendigung(grund, istWillenserklaerung);
    const identitaet = z.antrag_identitaet_offen === true;
    const optionen: EntscheidungOption[] = [];
    if (ziel.ziel) {
      optionen.push({
        key: "buchen", werkzeug: "kuendigung_buchen", ton: ziel.buchbar && !identitaet ? "gut" : "vorsicht",
        label: identitaet ? "Trotzdem buchen" : "Kündigung buchen",
        titel: `Bucht ${paket} zum Eingangstag (${tagDe(new Date(am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }))}) — Urkunde und Bestätigungsmail wie in der Akte.`,
        args: { antragId: Number(z.antrag_id), personId: pid, ziel: ziel.ziel, identitaetOffen: identitaet },
      });
    }
    optionen.push({
      key: "keine", werkzeug: "kuendigungsantrag_schliessen", ton: ziel.ziel ? "vorsicht" : "gut",
      label: ziel.ziel ? "Ist keine Kündigung" : "Antrag schließen",
      titel: "Schließt den Antrag ohne Kündigung — mit Grund im Verlauf.",
      args: { antragId: Number(z.antrag_id), personId: pid },
    });
    aus.push({
      schluessel: `kuendigung_ungebucht:${Number(z.antrag_id)}`,
      art: "kuendigung_ungebucht",
      personId: pid,
      ref: ziel.ziel ?? (z.antrag_ref ? String(z.antrag_ref) : null),
      titel: "Kündigung nie gebucht",
      text: ziel.ziel
        ? `Antrag über das Formular vom ${tagKurz(am)} — liegt seitdem ungebucht. ${ziel.buchbar ? `Gebucht wird ${paket} zum Eingangstag.` : ziel.satz}`
        : `Antrag vom ${tagKurz(am)} — am Eingangstag bestand kein Paket, das er meinen konnte. ${ziel.satz}`,
      empfehlung: ziel.ziel && istKuendigung ? "buchen" : "keine",
      optionen,
      belege: [
        { text: `Eingang ${tagKurz(am)}` },
        ...(Number(z.raten_offen) > 0 ? [{ text: `${Number(z.raten_offen)} ${Number(z.raten_offen) === 1 ? "Rate" : "Raten"} offen · ${euroText(Number(z.raten_cents))}` } as EntscheidungBeleg] : []),
        ...(z.antrag_wunsch ? [{ text: `Wunsch ${tagKurz(z.antrag_wunsch instanceof Date ? z.antrag_wunsch.toISOString().slice(0, 10) : String(z.antrag_wunsch).slice(0, 10))}` } as EntscheidungBeleg] : []),
        ...(identitaet ? [{ text: "Identität offen (ohne Geburtsdatum)", ton: "warn" } as EntscheidungBeleg] : []),
        ...(grund ? [{ art: "zitat", text: kurz(grund, 180), name: "Formular" } as EntscheidungBeleg] : []),
      ],
    });
  }
  return aus;
}

entscheidungWerkzeug({
  name: "kuendigung_buchen",
  async ausfuehren(args, k) {
    const { offeneKuendigungsantraege } = await import("./fiaon-kuendigung");
    const antragId = Number(args?.antragId), personId = Number(args?.personId);
    if (!Number.isInteger(antragId) || !Number.isInteger(personId)) return fehler("Die Karte nennt keinen Antrag.");
    const [antrag] = await offeneKuendigungsantraege(personId, antragId);
    if (!antrag) return vonSelbst("Der Antrag ist nicht mehr offen — schon gebucht, geschlossen oder zurückgenommen.");
    if (args?.ziel && antrag.ziel.ziel !== args.ziel) return fehler(`Das Ziel hat sich geändert (jetzt ${antrag.ziel.ziel ?? "keins"}) — bitte „Neu prüfen“.`);
    const { antragBuchen } = await import("../routes/fiaon-kuendigung");
    const erg = await antragBuchen(antrag, {
      grund: `${antrag.grund ? `${String(antrag.grund).slice(0, 160)} ` : ""}(Formular, gebucht im Mara-Steuerpult: ${k.von})`,
      personId, alsLeitung: true,
      // Querprüfung 08.10.2026: Ohne passendes Geburtsdatum bucht nur, wer vermerkt, dass er es verantwortet.
      identitaetVermerk: antrag.identitaetOffen ? `Buchung ohne Geburtsdatum vom Inhaber freigegeben (${k.von}, Mara-Steuerpult).` : null,
      unterzeichner: { name: k.von, rolle: "Geschäftsführung", agentId: k.agentId },
    });
    if (!erg?.ok) return fehler(String(erg?.error || erg?.grund || "Die Kündigung ging nicht durch.").slice(0, 300));
    const paket = antrag.zielPaket ?? erg.gebuchtAuf;
    return erledigt(`${paket} zum ${tagDe(new Date(antrag.am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }))} gekündigt`
      + `${erg.weg === "letzte_rate" && erg.letzteRateNr ? ` — Rate ${erg.letzteRateNr} bleibt fällig` : ""}`
      + `${erg.stornierteRaten ? `, ${erg.stornierteRaten} spätere ${erg.stornierteRaten === 1 ? "Rate entfällt" : "Raten entfallen"}` : ""}. `
      + `Urkunde ${erg.urkunde ? "ausgefertigt" : "fehlt"}, Bestätigung ${erg.mailGesendet ? "per Mail raus" : "nicht gesendet"}.`);
  },
});

entscheidungWerkzeug({
  name: "kuendigungsantrag_schliessen",
  async ausfuehren(args, k) {
    const { kuendigungsantragSchliessen } = await import("./fiaon-kuendigung");
    const antragId = Number(args?.antragId);
    if (!Number.isInteger(antragId)) return fehler("Die Karte nennt keinen Antrag.");
    const zu = await kuendigungsantragSchliessen(antragId, {
      von: k.von, grund: "Keine Kündigung — entschieden im Mara-Steuerpult", personId: Number(args?.personId) || null,
    });
    return zu ? erledigt("Antrag ohne Kündigung geschlossen — steht im Verlauf.") : vonSelbst("Der Antrag war schon erledigt.");
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// c) POSTMEISTER-MAHNSTOPPS — Erinnerungen angehalten, Raten offen
//
// Dieselbe Grenze wie E-368 (RATE_MAHNBAR_SQL, routes/fiaon-abo.ts): ein Mahnstopp,
// den jemand NACH der ersten Zahlung gesetzt hat (Mara/Postmeister: Kunde
// bestreitet, hat überwiesen, hat gekündigt). Die Raten, die er stoppt, wird
// niemand je anmahnen — also braucht es eine Entscheidung. Raten nach dem
// Vertragsende zählen hier nicht (die stehen auf der Sammelkarte a).
// ═══════════════════════════════════════════════════════════════════════════
const MAHNSTOPP_SQL = `
  SELECT a.ref, a.person_id, ${NAME_SQL("p", "a")} AS name, a.mahnstopp_am, ${VERTRAGSENDE_SPALTEN_SQL("a")},
         (SELECT COALESCE(json_agg(json_build_object('id', r.id, 'rate_nr', r.rate_nr, 'betrag_cents', r.betrag_cents,
                   'faellig_am', to_char(r.faellig_am, 'YYYY-MM-DD')) ORDER BY r.rate_nr), '[]'::json)
            FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offene,
         (SELECT c.agent_name || ': ' || c.note FROM fiaon_contact_log c
           WHERE (c.ref = a.ref OR c.person_id = a.person_id) AND c.voided_at IS NULL
             AND c.created_at BETWEEN a.mahnstopp_am - INTERVAL '3 minutes' AND a.mahnstopp_am + INTERVAL '3 minutes'
           ORDER BY (c.note ILIKE '%erinnerungen angehalten%') DESC, c.created_at DESC LIMIT 1) AS grund,
         (SELECT json_build_object('am', x.am, 'wo', x.wo, 'text', x.text) FROM (
             SELECT pm.empfangen_am AS am, 'Mail' AS wo, COALESCE(NULLIF(pm.zusammenfassung, ''), pm.betreff) AS text
               FROM fiaon_postmeister pm WHERE pm.person_id = a.person_id AND pm.empfangen_am IS NOT NULL
             UNION ALL
             SELECT w.empfangen_am, 'WhatsApp', w.text FROM fiaon_whatsapp w
              WHERE w.person_id = a.person_id AND w.richtung = 'rein' AND w.empfangen_am IS NOT NULL AND COALESCE(w.text, '') <> ''
           ) x ORDER BY x.am DESC LIMIT 1) AS letzte
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
   WHERE a.merged_into IS NULL AND a.payment_status = 'paid' AND a.archived_at IS NULL AND a.mahnstopp_am IS NOT NULL
     AND a.mahnstopp_am > COALESCE((SELECT MIN(r1.bezahlt_am) FROM fiaon_abo_raten r1 WHERE r1.ref = a.ref AND r1.status = 'bezahlt'), a.paid_at, a.created_at)
     AND NOT EXISTS (SELECT 1 FROM fiaon_persons pt WHERE pt.id = a.person_id AND pt.ist_test_am IS NOT NULL)
     AND EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)`;

/**
 * Rein: Was empfiehlt Mara bei einem Mahnstopp? Bestreitet der Kunde, droht er mit Anwalt/Betrug, sagt er „schon
 * bezahlt" oder „gekündigt“, bleibt der Stopp (eine Erinnerung verschärft das nur; Geld klärt die Karte „Geld
 * eingegangen"). Sonst: weiter erinnern — der Stopp ist dann nur liegen geblieben.
 */
export function mahnstoppEmpfehlung(text: string | null | undefined): { key: "erinnern" | "lassen"; warum: string } {
  const t = String(text ?? "").toLowerCase();
  if (/(anwalt|rechtlich|betrug|betrüg|abzocke|polizei|verbraucherzentrale|gericht|klage)/.test(t)) return { key: "lassen", warum: "Rechtliche Schritte angedroht — erinnern verschärft das." };
  if (/(bestreit|widersprich|widerspruch|nicht erhalten|keine leistung|keine karte|nie bestellt|kein vertrag|verweigert)/.test(t)) return { key: "lassen", warum: "Die Forderung ist bestritten." };
  if (/(überwiesen|ueberwiesen|bezahlt|gezahlt|zahlung gesendet|beleg|abgebucht)/.test(t)) return { key: "lassen", warum: "Angeblich schon gezahlt — erst den Eingang klären." };
  if (/(kündig|kuendig|storn|widerruf)/.test(t)) return { key: "lassen", warum: "Es geht um Kündigung oder Storno." };
  return { key: "erinnern", warum: "Kein Einwand erkennbar — der Stopp ist liegen geblieben." };
}

async function findeMahnstopps(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const zeilen = (await lauf.unsafe(`${MAHNSTOPP_SQL} ORDER BY a.mahnstopp_am DESC`)) as any[];
  const aus: EntscheidungNeu[] = [];
  for (const z of zeilen) {
    const offene = json<RateKurz[]>(z.offene, []).map((r) => ({ ...r, id: Number(r.id), rate_nr: Number(r.rate_nr), betrag_cents: Number(r.betrag_cents) || 0 }));
    const { nachEnde } = ratenNachVertragsende(z, offene);
    const geschuldet = offene.filter((r) => !nachEnde.includes(r));
    if (!geschuldet.length) continue;
    const cents = geschuldet.reduce((m, r) => m + r.betrag_cents, 0);
    const grund = z.grund ? String(z.grund) : "";
    const letzte = json<{ am?: string; wo?: string; text?: string } | null>(z.letzte, null);
    const empf = mahnstoppEmpfehlung(`${grund} ${letzte?.text ?? ""}`);
    const stoppAm = new Date(z.mahnstopp_am);
    aus.push({
      schluessel: `mahnstopp:${z.ref}:${epoche(stoppAm)}`,
      art: "mahnstopp",
      personId: z.person_id != null ? Number(z.person_id) : null,
      ref: String(z.ref),
      titel: "Erinnerungen angehalten — Raten offen",
      text: `Seit ${tagKurz(stoppAm)} keine Erinnerung mehr; offen ${geschuldet.length === 1 ? "ist eine Rate" : `sind ${geschuldet.length} Raten`} über ${euroText(cents)}. Mara: ${empf.warum}`,
      empfehlung: empf.key,
      optionen: [
        { key: "stornieren", label: "Raten stornieren (Kunde hat recht)", werkzeug: "einwand_anerkennen", ton: "vorsicht",
          titel: "Storniert die offenen Raten und stoppt das Abo — es kommt keine Rate mehr.",
          args: { ref: String(z.ref), mahnstoppAm: stoppAm.toISOString() } },
        { key: "erinnern", label: "Weiter erinnern", werkzeug: "mahnstopp_aufheben", ton: "gut",
          titel: "Hebt den Mahnstopp auf — die Erinnerungen laufen wieder im Takt.",
          args: { ref: String(z.ref), mahnstoppAm: stoppAm.toISOString() } },
        { key: "lassen", label: "So lassen", werkzeug: "nichts", ton: "neutral" },
      ],
      belege: [
        ...geschuldet.map((r) => ({ text: `Rate ${r.rate_nr} · ${euroText(r.betrag_cents)}${r.faellig_am ? ` · fällig ${tagKurz(r.faellig_am)}` : ""}` })),
        { text: `gestoppt ${tagKurz(stoppAm)}` },
        ...(z.gekuendigt_am ? [{ text: "gekündigt", ton: "warn" } as EntscheidungBeleg] : []),
        ...(grund ? [{ art: "zitat", name: "Grund", text: kurz(grund.replace(/^[^:]{0,40}:\s*/, ""), 200) } as EntscheidungBeleg] : []),
        ...(letzte?.text ? [{ art: "zitat", name: `${letzte.wo ?? "Nachricht"} ${tagKurz(letzte.am)}`, text: kurz(letzte.text, 200) } as EntscheidungBeleg] : []),
      ],
    });
  }
  return aus;
}

/** Steht der Mahnstopp noch so, wie die Karte ihn kennt? (Zeitstempel auf die Sekunde — die DB speichert Mikrosekunden.) */
async function mahnstoppLage(lauf: Lauf, ref: string, mahnstoppAm: unknown): Promise<any | null> {
  const t = new Date(String(mahnstoppAm ?? ""));
  if (!ref || Number.isNaN(t.getTime())) return null;
  const [a] = (await lauf`
    SELECT ref, person_id, mahnstopp_am, abo_gestoppt_am,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = fiaon_applications.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offen
      FROM fiaon_applications
     WHERE ref = ${ref} AND merged_into IS NULL
       AND mahnstopp_am BETWEEN ${t}::timestamptz - INTERVAL '1 second' AND ${t}::timestamptz + INTERVAL '1 second'`) as any[];
  return a ?? null;
}

entscheidungWerkzeug({
  name: "einwand_anerkennen",
  async ausfuehren(args, k) {
    const ref = String(args?.ref ?? "");
    const lage = await mahnstoppLage(k.lauf, ref, args?.mahnstoppAm);
    if (!lage) return vonSelbst("Der Mahnstopp steht so nicht mehr (aufgehoben oder neu gesetzt).");
    if (!Number(lage.offen)) return vonSelbst("Keine offene Rate mehr — inzwischen bezahlt oder storniert.");
    const { ratenStornieren } = await import("./fiaon-raten-storno");
    // Wie der Abo-Stopp der Verwaltung (POST /admin/abo/:ref/stoppen): Stopp und Storno in EINER Transaktion.
    const erg = await k.lauf.begin(async (tx: any) => {
      const [s] = (await tx`
        SELECT COALESCE(SUM(betrag_cents), 0)::int AS c FROM fiaon_abo_raten
         WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL`) as any[];
      await tx`
        UPDATE fiaon_applications SET abo_gestoppt_am = COALESCE(abo_gestoppt_am, NOW()),
               abo_stopp_grund = COALESCE(abo_stopp_grund, ${`Einwand anerkannt (Mara-Steuerpult, ${k.von})`.slice(0, 200)}), updated_at = NOW()
         WHERE ref = ${ref}`;
      const n = await ratenStornieren(ref, "einwand_anerkannt", tx);
      await tx`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${ref}, ${lage.person_id ?? null}, NULL, ${`Mara (Entscheidung: ${k.von})`.slice(0, 120)}, 'system',
                ${`Einwand anerkannt: ${n} offene ${n === 1 ? "Rate" : "Raten"} (${euroText(Number(s?.c || 0))}) storniert, Abo gestoppt — es kommt keine Rate mehr. Entscheidung im Mara-Steuerpult: ${k.von}.`}, NOW())`;
      return { n, c: Number(s?.c || 0) };
    });
    return erg.n
      ? erledigt(`${erg.n} ${erg.n === 1 ? "Rate" : "Raten"} storniert, ${euroText(erg.c)} — Abo gestoppt.`)
      : vonSelbst("Keine offene Rate mehr — nichts storniert.");
  },
});

entscheidungWerkzeug({
  name: "mahnstopp_aufheben",
  async ausfuehren(args, k) {
    const ref = String(args?.ref ?? "");
    const lage = await mahnstoppLage(k.lauf, ref, args?.mahnstoppAm);
    if (!lage) return vonSelbst("Der Mahnstopp steht so nicht mehr (aufgehoben oder neu gesetzt).");
    if (!Number(lage.offen)) return vonSelbst("Keine offene Rate mehr — nichts zu erinnern.");
    const w = (await k.lauf`
      UPDATE fiaon_applications SET mahnstopp_am = NULL, updated_at = NOW()
       WHERE ref = ${ref} AND mahnstopp_am BETWEEN ${new Date(lage.mahnstopp_am)}::timestamptz - INTERVAL '1 second'
                                               AND ${new Date(lage.mahnstopp_am)}::timestamptz + INTERVAL '1 second'
      RETURNING ref`) as any[];
    if (!w.length) return vonSelbst("Der Mahnstopp wurde gerade geändert — bitte neu prüfen.");
    await vermerk(k.lauf, { personId: lage.person_id ?? null, ref, von: k.von,
      text: `Mahnstopp aufgehoben — die Zahlungserinnerungen laufen wieder (${Number(lage.offen)} offene ${Number(lage.offen) === 1 ? "Rate" : "Raten"}). Entscheidung im Mara-Steuerpult: ${k.von}.` });
    return erledigt(`Mahnstopp aufgehoben — ${Number(lage.offen) === 1 ? "die Rate wird" : `${Number(lage.offen)} Raten werden`} wieder erinnert.`);
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// d) GELD AUF DEM KONTO, ABER NICHT VERBUCHT
//
// Die Liste ist die des Bankbuchs (nachholListe, fiaon-bank-nachholen.ts): jeder
// liegengebliebene Eingang mit Trockenprobe und Vorschlag — darunter die Treffer
// von eingangOffenSql (fiaon-zahlung-unverbucht.ts) und die Überzahlungen.
// Gebucht wird NUR über bankeingangBuchen / bankeingangZuordnen / bankeingangKeinKunde
// — derselbe Kern wie „Zubuchen“ auf /chef/s/konto (POST /admin/zahlungen/bankeingang-
// nachholen, E-327), mit dem Erwartungs-Stempel: Weicht die Lage beim Klick ab,
// bucht der Server nicht. Eindeutig heißt: die Trockenprobe bucht aus dem Zweck
// selbst, oder der Vorschlag ist „sicher“. Alles andere: „Im Konto zuordnen“ mit
// Vorauswahl (/chef/s/konto?eingang=<id>).
//
// E-401 (3/6, 19.10.2026): Meldet ein Kunde „habe bezahlt“ und findet zahlung_suchen
// (fiaon-mara-zahlung-suchen.ts) seinen Eingang, steht Maras Fund auf DIESER Karte —
// keine zweite Karte: Beleg „Kunde meldet Zahlung“, und fehlt ein Buchungsknopf, dazu
// „Zubuchen auf Rate N“ (nur wenn Maras Trockenprobe „würde buchen“ sagte). Mara legt
// die Karte sofort an (eingangKarteJetzt); gebucht wird nur mit dem Klick.
// ═══════════════════════════════════════════════════════════════════════════
async function findeEingaenge(_lauf: Lauf): Promise<EntscheidungNeu[]> {
  // nachholListe liest über den Pool — gegen die Produktion nur im Betrieb, nicht in der lesenden Messung.
  const { nachholListe } = await import("./fiaon-bank-nachholen");
  const zeilen = await nachholListe({ mitVorschlag: true });
  // E-401 (3/6): Maras Funde (Kunde meldet Zahlung, zahlung_suchen) gehören auf dieselbe Karte.
  const { maraFundeFuer } = await import("./fiaon-mara-zahlung-suchen");
  const funde = await maraFundeFuer(zeilen.map((z) => z.id)).catch(() => []);
  const aus: EntscheidungNeu[] = [];
  for (const z of zeilen) {
    const k = eingangKarte(z, funde.filter((f) => f.bankTxnId === z.id));
    if (k) aus.push(k);
  }
  return aus;
}


/**
 * Die Karte zu EINEM liegengebliebenen Eingang (null: schon verbucht). E-401 (3/6): Hat Mara den Eingang zu einer
 * gemeldeten Zahlung gefunden (`funde`), steht das als Beleg darauf („Kunde meldet Zahlung“) — und fehlt ein
 * Buchungsknopf, kommt „Zubuchen auf Rate N“ dazu, wenn ihre Trockenprobe „würde buchen“ sagte (Erwartungs-Stempel:
 * bankeingangBuchen prüft beim Klick noch einmal). Nennt der Vorschlag des Bankbuchs eine ANDERE Person, gibt es
 * keinen Knopf, nur die Warnung.
 */
export function eingangKarte(z: NachholZeile, funde: MaraFund[] = []): EntscheidungNeu | null {
  if (z.schonVerbucht) return null;
  const v = z.vorschlag;
  const optionen: EntscheidungOption[] = [];
  let empfehlung = "konto";
  let titel = "Eingang ohne Zuordnung";
  if (z.buchen && !z.unklar) {
    titel = "Geld da — noch nicht gebucht";
    optionen.push({ key: "buchen", label: `Buchen${z.rateNr ? `: Rate ${z.rateNr}` : z.ziel ? `: ${z.ziel}` : ""}`, werkzeug: "bankeingang_buchen", ton: "gut",
      titel: z.ergebnis, args: { id: z.id, ziel: null, dazu: [], erwartet: { regel: z.regel ?? null, ziel: z.ziel ?? null, rateId: z.rateId ?? null } } });
    empfehlung = "buchen";
  } else if (v?.aktion === "buchen" && v.sicherheit === "sicher" && v.ziel && v.erwartet) {
    titel = "Geld da — Zuordnung eindeutig";
    optionen.push({ key: "buchen", label: `Zubuchen auf ${v.rateNr ? `Rate ${v.rateNr}` : v.ziel}`, werkzeug: "bankeingang_buchen", ton: "gut",
      titel: v.text, args: { id: z.id, ziel: v.ziel, dazu: v.dazu ?? [], erwartet: v.erwartet } });
    empfehlung = "buchen";
  } else if (v?.aktion === "zuordnen" && v.sicherheit === "sicher" && v.ziel) {
    titel = "Schon gebucht — Beleg fehlt";
    optionen.push({ key: "zuordnen", label: "Nur zuordnen", werkzeug: "bankeingang_zuordnen", ton: "gut",
      titel: "Keine zweite Buchung — der Eingang wird der bezahlten Rate als Beleg zugeordnet.",
      args: { id: z.id, ziel: v.ziel, erwartet: v.erwartet ? { ziel: v.erwartet.ziel, rateId: v.erwartet.rateId } : null } });
    empfehlung = "zuordnen";
  } else if (v && (v.art === "ueberzahlung" || v.art === "rueckzahlung_noetig" || v.art === "teilzahlung")) {
    titel = v.art === "ueberzahlung" ? "Überzahlung" : v.art === "teilzahlung" ? "Teilzahlung" : "Rückzahlung nötig";
  }
  // ── E-401 (3/6): Maras Fund ───────────────────────────────────────────────
  const f = funde[0] ?? null;
  const vorschlagPerson = v?.personId ?? z.personId ?? null;
  const anderePerson = !!f && vorschlagPerson != null && vorschlagPerson !== f.personId;
  const maraBelege: EntscheidungBeleg[] = [];
  if (f) {
    maraBelege.push({ text: `Kunde meldet Zahlung (${f.kanal === "whatsapp" ? "WhatsApp" : f.kanal === "anliegen" ? "Anliegen" : "Mail"} ${tagKurz(f.am)})`, ton: "gut" });
    if (f.wege) maraBelege.push({ text: `Mara: ${kurz(f.wege, 50)}`, ...(f.stand === "moeglich" ? { ton: "warn" as const } : {}) });
    if (anderePerson) {
      maraBelege.push({ text: "Der Vorschlag des Bankbuchs nennt eine andere Person als den Kunden, der zahlte — bitte im Konto prüfen", ton: "warn" });
    } else if (!optionen.some((o) => o.key === "buchen" || o.key === "zuordnen") && f.erwartet && f.ziel) {
      titel = "Geld da — Kunde hat Zahlung gemeldet";
      optionen.unshift({ key: "buchen", label: `Zubuchen auf ${f.rateNr ? `Rate ${f.rateNr}` : f.ziel}`, werkzeug: "bankeingang_buchen", ton: "gut",
        // E-401 Nachbesserung: Den Knopf gibt es nur bei Referenz oder Zuordnung (nie bei „nur der Name“).
        titel: "Der Kunde hat diese Zahlung gemeldet; Betrag und Referenz (bzw. Zuordnung im Bankbuch) passen. Der Server prüft beim Klick noch einmal.",
        args: { id: z.id, ziel: f.ziel, dazu: [], erwartet: f.erwartet } });
      empfehlung = "buchen";
    } else if (titel === "Eingang ohne Zuordnung") {
      titel = f.stand === "moeglich" ? "Kunde meldet Zahlung — Eingang prüfen (nur der Name passt)"
        : f.stand === "abweichend" ? "Kunde hat gezahlt — Betrag weicht ab" : "Kunde hat gezahlt — bitte zuordnen";
    }
  }
  optionen.push({ key: "konto", label: "Im Konto zuordnen", werkzeug: "link", link: `/chef/s/konto?eingang=${z.id}`, ton: "neutral",
    titel: "Öffnet das Geschäftskonto mit diesem Eingang — Vorschlag, Kundensuche, Prüfen." });
  // Meldet ein Kunde genau diese Zahlung, ist sie Kundengeld — dann kein „Kein Kundengeld“.
  const unbekannt = !v?.personId && !z.personId && !f;
  if (unbekannt) {
    optionen.push({ key: "kein_kunde", label: "Kein Kundengeld", werkzeug: "bankeingang_kein_kunde", ton: "neutral",
      titel: "Kennzeichnet den Eingang als „Sonstiger Eingang“ — keine Buchung, jederzeit zurücknehmbar.", args: { id: z.id } });
    // Kleinbeträge ohne jeden Treffer (Prüfbetrag einer Bank, 0,18 €) sind kein Kundengeld.
    if (empfehlung === "konto" && z.betragCents < 100) empfehlung = "kein_kunde";
  }
  const grundText = kurz(v?.text || z.ergebnis || "Keine Bestellung erkannt.", 220);
  return {
    schluessel: `eingang:${z.id}`,
    art: "eingang_unverbucht",
    personId: v?.personId ?? z.personId ?? f?.personId ?? null,
    ref: v?.bestellung ?? z.bestellung ?? f?.bestellung ?? null,
    titel,
    text: `${euroText(z.betragCents)} am ${tagKurz(z.datum)}${z.absender ? ` von ${kurz(z.absender, 40)}` : ""}. `
      + (f ? (f.stand === "moeglich"
        ? "Ein Kunde meldet eine Zahlung — bei diesem Eingang passt nur der Name des Zahlers (keine Referenz); bitte prüfen, ob er zu ihm gehört. "
        : `Der Kunde meldet diese Zahlung (Mara hat sie im Bankbuch gefunden${f.ziel ? `: ${f.rateNr ? `Rate ${f.rateNr}` : f.ziel}` : ""}). `) : "")
      + grundText,
    empfehlung,
    optionen,
    belege: [
      { text: euroText(z.betragCents) },
      { text: `eingegangen ${tagKurz(z.datum)}` },
      ...maraBelege,
      ...(z.zweck ? [{ text: `Zweck „${kurz(z.zweck, 50)}“` } as EntscheidungBeleg] : []),
      ...(v ? [{ text: `Vorschlag ${v.sicherheit}`, ton: v.sicherheit === "sicher" ? "gut" : "warn" } as EntscheidungBeleg] : []),
      ...((v?.gruende ?? []).slice(0, 3).map((g) => ({ text: kurz(g, 60) }) as EntscheidungBeleg)),
      ...((v?.hinweise ?? z.hinweise ?? []).slice(0, 2).map((h) => ({ text: kurz(h, 90), ton: "warn" }) as EntscheidungBeleg)),
    ],
  };
}

/**
 * E-401 (3/6): Die Karte zu einem Eingang SOFORT anlegen bzw. auffrischen (Mara hat ihn eben gefunden) — nur, wenn
 * der Sammler ihn auch sähe (sonst schlösse er sie gleich wieder). Liefert das Ergebnis von entscheidungAnlegen.
 */
export async function eingangKarteJetzt(id: number): Promise<{ id: number; neu: boolean; status: EntscheidungStatus } | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  await entscheidungTabellen();
  const { nachholListe, NACHHOLEN_SEIT_VORGABE } = await import("./fiaon-bank-nachholen");
  // Dieselbe Auswahl wie nachholListe ohne ids (der Sammler).
  const [da] = (await sqlPool`
    SELECT 1 AS ja FROM fiaon_bank_txns
     WHERE id = ${id} AND NOT applied AND amount_cents > 0 AND booked_at >= ${NACHHOLEN_SEIT_VORGABE}::date
       AND COALESCE(note, '') NOT LIKE 'Airwallex: Geld ist UNTERWEGS%'
       AND COALESCE(match_status, '') <> 'ignored'`) as any[];
  if (!da) return null;
  const [z] = await nachholListe({ ids: [id], mitVorschlag: true });
  if (!z) return null;
  const { maraFundeFuer } = await import("./fiaon-mara-zahlung-suchen");
  const k = eingangKarte(z, await maraFundeFuer([id]).catch(() => []));
  return k ? entscheidungAnlegen(k) : null;
}

const WER_BANK = (von: string) => `Mara-Entscheidung (${von})`.slice(0, 80);
const schonVerbucht = (t: unknown) => /schon verbucht|kein Kundengeld|gibt es nicht|noch unterwegs/i.test(String(t ?? ""));

entscheidungWerkzeug({
  name: "bankeingang_buchen",
  async ausfuehren(args, k) {
    const { bankeingangBuchen } = await import("./fiaon-bank-nachholen");
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id <= 0) return fehler("Die Karte nennt keinen Eingang.");
    // bankeingangBuchen macht zuerst die Trockenprobe (die Lage JETZT) und bucht nur, wenn sie der Karte entspricht.
    const a: any = await bankeingangBuchen(id, {
      wer: WER_BANK(k.von), ziel: args?.ziel ?? null, dazu: Array.isArray(args?.dazu) ? args.dazu.map(Number) : [],
      erwartet: args?.erwartet ?? null, freigabe: k.von,
    });
    if (!a.ok) return schonVerbucht(a.error) ? vonSelbst(String(a.error)) : fehler(String(a.error || "Nicht gebucht.").slice(0, 300));
    const z = a.zeile;
    return erledigt(`${euroText(z?.summeCents ?? z?.betragCents ?? 0)} gebucht${z?.rateNr ? ` auf Rate ${z.rateNr}` : z?.ziel ? ` auf ${z.ziel}` : ""}${z?.kunde ? ` (${kurz(z.kunde, 40)})` : ""}.`);
  },
});

entscheidungWerkzeug({
  name: "bankeingang_zuordnen",
  async ausfuehren(args, k) {
    const { bankeingangZuordnen } = await import("./fiaon-bank-nachholen");
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id <= 0) return fehler("Die Karte nennt keinen Eingang.");
    const a: any = await bankeingangZuordnen(id, { ziel: args?.ziel ?? null, wer: WER_BANK(k.von), erwartet: args?.erwartet ?? null });
    if (!a.ok) return schonVerbucht(a.error) ? vonSelbst(String(a.error)) : fehler(String(a.error || "Nicht zugeordnet.").slice(0, 300));
    return erledigt(`Zugeordnet: ${args?.ziel ?? "die bezahlte Rate"} — keine zweite Buchung.`);
  },
});

entscheidungWerkzeug({
  name: "bankeingang_kein_kunde",
  async ausfuehren(args, k) {
    const { bankeingangKeinKunde } = await import("./fiaon-bank-nachholen");
    const id = Number(args?.id);
    if (!Number.isInteger(id) || id <= 0) return fehler("Die Karte nennt keinen Eingang.");
    const a = await bankeingangKeinKunde(id, { wer: WER_BANK(k.von), grund: "Kein Kundengeld — entschieden im Mara-Steuerpult" });
    if (!a.ok) return schonVerbucht(a.error) ? vonSelbst(String(a.error)) : fehler(String(a.error || "Ging nicht.").slice(0, 300));
    return erledigt("Als „kein Kundengeld“ gekennzeichnet — im Konto zurücknehmbar.");
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// e) WERBESPERRE AUF EINE ZAHLUNGSMAIL
//
// Der Postmeister setzt die Werbesperre nur auf ausdrücklichen Wunsch, mit Zitat
// (werbesperre_setzen, Vermerk „Kunde bittet um Stopp der Werbe- und
// Erinnerungsmails"). Kam dieser Wunsch als ANTWORT auf eine Zahlungsmail („Ihre
// Monatsrate …", „Ihre Zahlung steht noch aus …“), sperrt sie seitdem auch die
// Zahlungspost (Erstzahlungs-Erinnerung, Raten-WhatsApp) — bei einer offenen
// Forderung. Ob das eine Abmeldung war, entscheidet Justin.
//
// „Sperre aufheben (war keine Abmeldung)“ hebt sie für die ZAHLUNGSPOST auf: Die
// Herkunft wird die der Zahlungspost-Freigabe (werbesperre_quelle
// 'zahlungspost_freigabe', db/migrations/106) — Zahlungspost läuft wieder, Werbung
// bleibt aus (er hat um Ruhe gebeten; § 7 UWG). Dazu verliert genau diese
// Postfach-Mail ihr Merkmal „stopp“ (STOPP_KOEPFE_SQL), sonst hielte sie die
// Zahlungspost weiter an.
// ═══════════════════════════════════════════════════════════════════════════
const ZAHLUNGSPOST_BETREFF = "(ihre zahlung steht noch aus|ihre monatsrate)";
const WERBESPERRE_SQL = `
  WITH s AS (
    SELECT DISTINCT ON (c.person_id) c.person_id, c.created_at AS sperre_am, c.note
      FROM fiaon_contact_log c
     WHERE c.agent_name = 'Postmeister' AND c.note LIKE 'Kunde bittet um Stopp der Werbe- und Erinnerungsmails%'
       AND c.person_id IS NOT NULL AND c.voided_at IS NULL
     ORDER BY c.person_id, c.created_at DESC)
  SELECT s.person_id, s.sperre_am, s.note, p.werbung_gesperrt_am, ${NAME_SQL("p")} AS name,
         m.id AS postmeister_id, m.betreff, m.kategorie, m.empfangen_am,
         (SELECT COALESCE(SUM(r.betrag_cents), 0)::int FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
           WHERE a.person_id = s.person_id AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS raten_cents,
         (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = s.person_id AND a.merged_into IS NULL ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS ref,
         EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = s.person_id AND a.merged_into IS NULL AND a.archived_at IS NULL
                  AND a.payment_status IN ('pending_payment', 'claimed_paid')) AS erstzahlung_offen
    FROM s
    JOIN fiaon_persons p ON p.id = s.person_id
    JOIN LATERAL (SELECT pm.id, pm.betreff, pm.kategorie, pm.empfangen_am FROM fiaon_postmeister pm
                   WHERE pm.person_id = s.person_id AND pm.empfangen_am <= s.sperre_am + INTERVAL '5 minutes'
                   ORDER BY pm.empfangen_am DESC LIMIT 1) m ON TRUE
   WHERE p.werbung_gesperrt_am IS NOT NULL AND p.werbesperre_quelle IS DISTINCT FROM 'zahlungspost_freigabe'
     AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
     AND m.betreff ~* '${ZAHLUNGSPOST_BETREFF}' AND COALESCE(m.kategorie, '') <> 'kuendigung'
     AND (EXISTS (SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
                   WHERE a.person_id = s.person_id AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)
       OR EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = s.person_id AND a.merged_into IS NULL AND a.archived_at IS NULL
                   AND a.payment_status IN ('pending_payment', 'claimed_paid')))
     AND NOT ${KUENDIGUNG_WIRKSAM_SQL("s.person_id")}`;

/** „Re: Ihre Monatsrate 2 — FIAON-…“ → „Ihre Monatsrate 2 — FIAON-…“ (gekürzt). */
const betreffOhneAntwort = (b: unknown) => kurz(String(b ?? "").replace(/^((re|aw|wg|fwd?)\s*:\s*)+/i, ""), 60);

async function findeWerbesperren(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const zeilen = (await lauf.unsafe(`${WERBESPERRE_SQL} ORDER BY s.sperre_am DESC`)) as any[];
  return zeilen.map((z) => {
    const zitat = /„([^“”"]{3,})["“”]/.exec(String(z.note ?? ""))?.[1] ?? "";
    const offen = Number(z.raten_cents) > 0 ? `${euroText(Number(z.raten_cents))} Raten offen` : z.erstzahlung_offen ? "Erstzahlung offen" : "Forderung offen";
    return {
      schluessel: `werbesperre:${Number(z.person_id)}:${epoche(z.werbung_gesperrt_am)}`,
      art: "werbesperre_zahlungspost",
      personId: Number(z.person_id),
      ref: z.ref ? String(z.ref) : null,
      titel: "Werbesperre auf eine Zahlungsmail",
      text: `Auf „${betreffOhneAntwort(z.betreff)}“ kam am ${tagKurz(z.sperre_am)} die Bitte um keine Post mehr. `
        + "Seitdem gehen auch keine Zahlungserinnerung per WhatsApp und keine Erstzahlungs-Erinnerung mehr raus.",
      empfehlung: "lassen",
      optionen: [
        { key: "lassen", label: "Sperre lassen", werkzeug: "nichts", ton: "neutral", titel: "Ausdrücklich so gewünscht — es bleibt still." },
        { key: "aufheben", label: "Sperre aufheben (war keine Abmeldung)", werkzeug: "werbesperre_aufheben", ton: "vorsicht",
          titel: "Zahlungserinnerungen laufen wieder; Werbung bleibt aus.",
          args: { personId: Number(z.person_id), gesperrtAm: iso(z.werbung_gesperrt_am), postmeisterId: z.postmeister_id != null ? Number(z.postmeister_id) : null } },
      ],
      belege: [
        { text: offen, ton: "warn" },
        { text: `gesperrt ${tagKurz(z.werbung_gesperrt_am)}` },
        ...(zitat ? [{ art: "zitat", name: `Mail ${tagKurz(z.empfangen_am)}`, text: kurz(zitat, 200) } as EntscheidungBeleg] : []),
      ],
    } satisfies EntscheidungNeu;
  });
}

entscheidungWerkzeug({
  name: "werbesperre_aufheben",
  async ausfuehren(args, k) {
    const personId = Number(args?.personId);
    if (!Number.isInteger(personId) || personId <= 0) return fehler("Die Karte nennt keine Person.");
    const { KOPF_SQL, STOPP_KOEPFE_SQL, WERBESPERRE_QUELLE_FREIGABE } = await import("./fiaon-mail-frequenz");
    const w = (await k.lauf`
      UPDATE fiaon_persons SET werbesperre_quelle = ${WERBESPERRE_QUELLE_FREIGABE}, updated_at = NOW()
       WHERE id = ${personId} AND werbung_gesperrt_am IS NOT NULL AND werbesperre_quelle IS DISTINCT FROM ${WERBESPERRE_QUELLE_FREIGABE}
      RETURNING id`) as any[];
    if (!w.length) return vonSelbst("Die Werbesperre steht so nicht mehr (aufgehoben oder schon nur Werbung).");
    // Genau die Mail, auf die die Sperre ging, verliert ihr Merkmal „stopp“ — auch wenn flags doppelt als Text liegt (E-238).
    const pmId = Number(args?.postmeisterId);
    if (Number.isInteger(pmId) && pmId > 0) {
      await k.lauf`
        UPDATE fiaon_postmeister
           SET flags = jsonb_set(CASE WHEN jsonb_typeof(flags) = 'string' THEN (flags #>> '{}')::jsonb ELSE COALESCE(flags, '{}'::jsonb) END,
                                 '{stopp}', 'false'::jsonb, true),
               updated_at = NOW()
         WHERE id = ${pmId} AND person_id = ${personId}`.catch((e: any) => console.error("[ENTSCHEIDUNG] Stopp-Merkmal:", String(e?.message ?? e).slice(0, 160)));
    }
    const [st] = (await k.lauf.unsafe(`SELECT (${KOPF_SQL("$1::int")} IN ${STOPP_KOEPFE_SQL}) AS stopp`, [personId]).catch(() => [])) as any[];
    const [a] = (await k.lauf`SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
    await vermerk(k.lauf, { personId, ref: a?.ref ?? null, von: k.von,
      text: `Werbesperre auf eine Zahlungsmail: war keine Abmeldung — Zahlungspost läuft wieder, Werbung bleibt gesperrt. Entscheidung im Mara-Steuerpult: ${k.von}.` });
    return erledigt(st?.stopp
      ? "Zahlungspost wieder frei, Werbung bleibt aus. Achtung: ein weiteres „Stopp“ steht noch — WhatsApp bleibt deshalb still."
      : "Zahlungspost wieder frei, Werbung bleibt aus.");
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// f) WHATSAPP-VORLAGEN, DIE META NOCH NICHT KENNT
//
// Der Knopf ruft GENAU den Weg aus dem Reiter „Bonitätsauskunft“ (vorlagenEinreichenStarten,
// routes/fiaon-chef-auskunft.ts): nur die FEHLENDEN einreichen, nie „auffrischen“ (das
// schickte freigegebene Vorlagen zurück in die Prüfung). Vorlagen, die an der Hauswand
// scheitern, zählen nicht — sie ließen sich nie einreichen.
// ═══════════════════════════════════════════════════════════════════════════
async function findeWaVorlagen(lauf: Lauf): Promise<EntscheidungNeu[]> {
  const wa = await import("./fiaon-whatsapp");
  if (!wa.waKonfig().bereit) return [];
  if (wa.vorlagenLaufStand().laeuft) throw new Error("Einreichen läuft gerade — die Karte bleibt, wie sie ist.");
  const { einreichenStand } = await import("../routes/fiaon-chef-auskunft");
  if (einreichenStand().laeuft) throw new Error("Einreichen läuft gerade — die Karte bleibt, wie sie ist.");
  const { WA_VORLAGEN } = await import("@shared/fiaon-lead-texte");
  const da = new Set((await wa.vorlagenStand()).map((t) => t.name));
  const fehlen = WA_VORLAGEN.filter((v) => !da.has(v.name) && !wa.sendePruefung(v.text.replace(/\{\{\d\}\}/g, "Maria Muster")).length);
  if (!fehlen.length) return [];
  return [{
    schluessel: await sammelSchluessel("wa_vorlagen", lauf),
    art: "wa_vorlagen",
    titel: `${fehlen.length} WhatsApp-${fehlen.length === 1 ? "Vorlage fehlt" : "Vorlagen fehlen"} bei Meta`,
    text: "Ohne Freigabe durch Meta kann Mara sie nicht schicken. Einreichen dauert Sekunden, Meta prüft danach selbst (Minuten bis Stunden).",
    empfehlung: "einreichen",
    optionen: [
      { key: "einreichen", label: "Bei Meta einreichen", werkzeug: "wa_vorlagen_einreichen", ton: "gut", titel: "Reicht nur die fehlenden ein — freigegebene bleiben unberührt." },
      { key: "lassen", label: "Nicht einreichen", werkzeug: "nichts", ton: "neutral" },
    ],
    belege: fehlen.slice(0, 12).map((v) => ({ text: v.name })),
  }];
}

entscheidungWerkzeug({
  name: "wa_vorlagen_einreichen",
  async ausfuehren() {
    const { vorlagenEinreichenStarten } = await import("../routes/fiaon-chef-auskunft");
    const s = await vorlagenEinreichenStarten();
    if (s.abbruch) return /läuft gerade/i.test(s.abbruch) ? vonSelbst(s.abbruch) : fehler(s.abbruch);
    return erledigt(s.laeuft ? "Einreichen bei Meta läuft — Meta prüft danach selbst." : "Nichts einzureichen.");
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// DER SAMMLER — Detektoren laufen, Karten entstehen, Erledigtes schließt sich
// ═══════════════════════════════════════════════════════════════════════════
export interface Detektor {
  art: string;
  finden: (lauf: Lauf) => Promise<EntscheidungNeu[]>;
  /** Satz für eine Karte, deren Lage es nicht mehr gibt. */
  erledigtText: string;
}
export const DETEKTOREN: Detektor[] = [
  { art: "kuendigung_ungebucht", finden: findeKuendigungen, erledigtText: "Hat sich erledigt — der Antrag ist inzwischen gebucht, geschlossen oder zurückgenommen." },
  { art: "raten_nach_ende", finden: findeRatenNachEnde, erledigtText: "Hat sich erledigt — keine Rate nach Vertragsende mehr offen." },
  { art: "eingang_unverbucht", finden: findeEingaenge, erledigtText: "Hat sich erledigt — der Eingang ist inzwischen gebucht oder gekennzeichnet." },
  { art: "mahnstopp", finden: findeMahnstopps, erledigtText: "Hat sich erledigt — Mahnstopp aufgehoben oder Raten bezahlt/storniert." },
  { art: "werbesperre_zahlungspost", finden: findeWerbesperren, erledigtText: "Hat sich erledigt — Werbesperre aufgehoben oder Forderung beglichen." },
  { art: "wa_vorlagen", finden: findeWaVorlagen, erledigtText: "Hat sich erledigt — Meta kennt alle Vorlagen." },
];

/** E-371: Ein Detektor aus einem anderen Modul (Postmeister) — einmal je Art; ein zweiter Aufruf ersetzt ihn. */
export function detektorRegistrieren(d: Detektor): void {
  const i = DETEKTOREN.findIndex((x) => x.art === d.art);
  if (i >= 0) DETEKTOREN[i] = d; else DETEKTOREN.push(d);
}

// E-371 (15.10.2026): Module, die eigene Karten, Detektoren und Werkzeuge anmelden (Postmeister: Maras Mail-Entwürfe).
// Dynamisch geladen — ein statischer Import wäre ein Kreis (sie importieren dieses Modul).
let erweiterungen: Promise<void> | null = null;
function erweiterungenLaden(): Promise<void> {
  erweiterungen ??= import("./fiaon-postmeister-entscheidungen")
    .then(() => import("./fiaon-whatsapp-entscheidungen")) // E-372: Maras WhatsApp-Fälle (Karten und Werkzeuge)
    .then(() => import("./fiaon-jahresvertrag-entscheidung")) // E-396: Jahresverträge ohne belegte Annahme
    .then(() => undefined)
    .catch((e) => { erweiterungen = null; console.error("[ENTSCHEIDUNG] Postmeister-Karten nicht geladen:", String((e as Error)?.message ?? e).slice(0, 200)); });
  return erweiterungen;
}

export interface SammelErgebnis {
  am: string;
  je: Record<string, { karten: number; neu: number; erledigt: number; fehler?: string }>;
}

/**
 * Alle Detektoren einmal: Karten anlegen/auffrischen, Erledigtes auf „erledigt_von_selbst“, abgelaufenes „später“
 * zurück auf „offen“. Ein Detektor, der scheitert, schließt keine seiner Karten (Störung ≠ erledigt).
 */
export async function entscheidungenSammeln(opts: { nur?: string[] } = {}): Promise<SammelErgebnis> {
  await entscheidungTabellen();
  await erweiterungenLaden();
  const lauf = sqlPool;
  const erg: SammelErgebnis = { am: new Date().toISOString(), je: {} };
  await lauf`UPDATE fiaon_mara_entscheidungen SET status = 'offen', spaeter_bis = NULL, aktualisiert_am = NOW()
              WHERE status = 'spaeter' AND spaeter_bis <= NOW()`.catch(() => {});
  for (const d of DETEKTOREN) {
    if (opts.nur && !opts.nur.includes(d.art)) continue;
    const je = { karten: 0, neu: 0, erledigt: 0 } as SammelErgebnis["je"][string];
    erg.je[d.art] = je;
    let karten: EntscheidungNeu[];
    try { karten = await d.finden(lauf); }
    catch (e) {
      je.fehler = String((e as Error)?.message ?? e).slice(0, 200);
      console.error(`[ENTSCHEIDUNG] Detektor ${d.art}:`, je.fehler);
      continue;
    }
    const schluessel: string[] = [];
    for (const k of karten) {
      schluessel.push(k.schluessel);
      try {
        const r = await entscheidungAnlegen(k, lauf);
        je.karten++;
        if (r?.neu) je.neu++;
      } catch (e) { console.error(`[ENTSCHEIDUNG] Karte ${k.schluessel}:`, String((e as Error)?.message ?? e).slice(0, 200)); }
    }
    const zu = (await lauf`
      UPDATE fiaon_mara_entscheidungen
         SET status = 'erledigt_von_selbst', entschieden_am = NOW(), ergebnis = ${d.erledigtText}, spaeter_bis = NULL, aktualisiert_am = NOW()
       WHERE art = ${d.art} AND status IN ('offen', 'spaeter') AND NOT (schluessel = ANY(${schluessel}::text[]))
      RETURNING id`) as any[];
    je.erledigt = zu.length;
  }
  return erg;
}

// Höchstens alle zehn Minuten — der Reiter löst ihn aus, kein Dauerjob.
export const SAMMEL_ABSTAND_MS = 10 * 60_000;
let letzterLauf = 0;
let laufend: Promise<SammelErgebnis> | null = null;
let letztesErgebnis: SammelErgebnis | null = null;

/** Startet den Sammler, wenn er fällig ist (oder `jetzt`), und gibt den laufenden Lauf zurück — sonst null. */
export function entscheidungenSammelnWennFaellig(opts: { jetzt?: boolean } = {}): Promise<SammelErgebnis> | null {
  if (laufend) return laufend;
  if (!opts.jetzt && Date.now() - letzterLauf < SAMMEL_ABSTAND_MS) return null;
  letzterLauf = Date.now();
  laufend = entscheidungenSammeln()
    .then((e) => { letztesErgebnis = e; return e; })
    .catch((e) => { console.error("[ENTSCHEIDUNG] Sammler:", String((e as Error)?.message ?? e).slice(0, 200)); throw e; })
    .finally(() => { laufend = null; });
  return laufend;
}

// ═══════════════════════════════════════════════════════════════════════════
// LESEN — für den Reiter
// ═══════════════════════════════════════════════════════════════════════════
function sicht(z: EntscheidungZeile): EntscheidungSicht {
  const optionen = json<EntscheidungOption[]>(z.optionen, []);
  return {
    id: Number(z.id), art: z.art, artText: artText(z.art), gewicht: Number(z.gewicht),
    personId: z.person_id != null ? Number(z.person_id) : null, name: z.name ?? null, ref: z.ref ?? null,
    titel: z.titel, text: z.text, empfehlung: z.empfehlung,
    optionen: optionen.map((o) => ({ key: o.key, label: o.label, ton: o.ton ?? "neutral", link: o.werkzeug === "link" ? (o.link ?? null) : null, titel: o.titel ?? null })),
    belege: json<EntscheidungBeleg[]>(z.belege, []),
    status: z.status, spaeterBis: iso(z.spaeter_bis), entschiedenAm: iso(z.entschieden_am), entschiedenVon: z.entschieden_von ?? null,
    gewaehlt: z.gewaehlt ?? null, gewaehltLabel: optionen.find((o) => o.key === z.gewaehlt)?.label ?? null,
    ergebnis: z.ergebnis ?? null, fehler: z.fehler ?? null, createdAt: iso(z.created_at) ?? "",
  };
}

const SICHT_SQL = `SELECT e.*, ${NAME_SQL("p")} AS name FROM fiaon_mara_entscheidungen e LEFT JOIN fiaon_persons p ON p.id = e.person_id`;

export interface EntscheidungenStand {
  offen: EntscheidungSicht[];
  spaeter: EntscheidungSicht[];
  entschieden: EntscheidungSicht[];
  zaehler: { offen: number; geldRecht: number; spaeter: number };
  stand: { gesammeltAm: string | null; laeuft: boolean; fehler: Record<string, string> };
  /** E-397: „Heute N Entscheidungen, etwa M Minuten“ und die Sammelkarten (gleiche Fälle). */
  last: TagesLast;
  gruppen: SammelGruppe[];
}

/** Offen (Gewicht, dann Alter), später, und was in den letzten 7 Tagen entschieden wurde oder sich erledigt hat. */
export async function entscheidungenLesen(lauf: Lauf = sqlPool): Promise<EntscheidungenStand> {
  await entscheidungTabellen();
  const [offen, spaeter, entschieden] = await Promise.all([
    lauf.unsafe(`${SICHT_SQL} WHERE e.status = 'offen' OR (e.status = 'spaeter' AND e.spaeter_bis <= NOW()) ORDER BY e.gewicht DESC, e.created_at ASC, e.id ASC LIMIT 200`),
    lauf.unsafe(`${SICHT_SQL} WHERE e.status = 'spaeter' AND e.spaeter_bis > NOW() ORDER BY e.spaeter_bis ASC LIMIT 100`),
    lauf.unsafe(`${SICHT_SQL} WHERE e.status IN ('entschieden', 'erledigt_von_selbst') AND COALESCE(e.entschieden_am, e.aktualisiert_am) > NOW() - INTERVAL '7 days'
                 ORDER BY COALESCE(e.entschieden_am, e.aktualisiert_am) DESC LIMIT 100`),
  ]) as any[][];
  const o = offen.map(sicht);
  return {
    last: tagesLast(o.map((k) => ({ ...k, status: "offen" as EntscheidungStatus }))),
    gruppen: sammelGruppen(o.map((k) => ({ ...k, status: "offen" as EntscheidungStatus }))),
    offen: o, spaeter: spaeter.map(sicht), entschieden: entschieden.map(sicht),
    zaehler: { offen: o.length, geldRecht: o.filter((k) => k.gewicht >= GEWICHT_GELD_RECHT).length, spaeter: spaeter.length },
    stand: {
      gesammeltAm: letztesErgebnis?.am ?? null, laeuft: !!laufend,
      fehler: Object.fromEntries(Object.entries(letztesErgebnis?.je ?? {}).filter(([, v]) => v.fehler).map(([k, v]) => [k, String(v.fehler)])),
    },
  };
}

/** Für GET: den Sammler anstoßen, wenn fällig, höchstens `warten` ms auf ihn warten, dann lesen. */
export async function entscheidungenStand(opts: { warten?: number; jetzt?: boolean } = {}): Promise<EntscheidungenStand> {
  const lauf = entscheidungenSammelnWennFaellig({ jetzt: opts.jetzt });
  if (lauf && (opts.warten ?? 0) > 0) {
    await Promise.race([lauf.catch(() => null), new Promise((r) => setTimeout(r, opts.warten))]);
  }
  return entscheidungenLesen();
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTSCHEIDEN UND SPÄTER
// ═══════════════════════════════════════════════════════════════════════════
const inArbeit = new Set<number>();

/**
 * Justins Klick: die Option ausführen. Erledigt → „entschieden“, nichts mehr zu tun → „erledigt_von_selbst“, Fehler
 * → die Karte bleibt offen, der Fehler steht darin. Ein zweiter Klick auf eine entschiedene Karte tut nichts.
 */
export async function entscheiden(id: number, optionKey: string, opts: { von: string; agentId?: number | null; lauf?: Lauf }): Promise<{
  ok: boolean; status: number; error?: string; karte?: EntscheidungSicht; schon?: boolean;
}> {
  await entscheidungTabellen();
  await erweiterungenLaden();
  const lauf = opts.lauf ?? sqlPool;
  if (!Number.isInteger(id) || id <= 0) return { ok: false, status: 400, error: "Ungültige Karte." };
  if (inArbeit.has(id)) return { ok: false, status: 409, error: "Diese Entscheidung läuft schon." };
  inArbeit.add(id);
  try {
    const [z] = (await lauf.unsafe(`${SICHT_SQL} WHERE e.id = $1`, [id])) as any[];
    if (!z) return { ok: false, status: 404, error: "Diese Karte gibt es nicht." };
    if (z.status === "entschieden" || z.status === "erledigt_von_selbst") return { ok: true, status: 200, karte: sicht(z), schon: true };
    const optionen = json<EntscheidungOption[]>(z.optionen, []);
    const o = optionen.find((x) => x.key === optionKey);
    if (!o) return { ok: false, status: 400, error: "Diese Option gibt es auf der Karte nicht." };
    if (o.werkzeug === "link") return { ok: false, status: 400, error: "Das ist ein Link — er öffnet die Seite, er entscheidet nichts." };
    const w = WERKZEUGE.get(o.werkzeug);
    const karte: EntscheidungZeile = { ...z, optionen, belege: json(z.belege, []) };
    let erg: AusfuehrErgebnis;
    if (!w) erg = fehler(`Unbekanntes Werkzeug „${o.werkzeug}“.`);
    else {
      try { erg = await w.ausfuehren(o.args ?? {}, { von: opts.von, agentId: opts.agentId ?? null, karte, lauf }); }
      catch (e) {
        console.error(`[ENTSCHEIDUNG] ${o.werkzeug} (#${id}):`, e);
        erg = fehler(`Abgebrochen: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      }
    }
    if (erg.ergebnis === "fehler") {
      await lauf`UPDATE fiaon_mara_entscheidungen SET fehler = ${kurz(erg.text, 400)}, aktualisiert_am = NOW() WHERE id = ${id}`;
    } else {
      await lauf`
        UPDATE fiaon_mara_entscheidungen
           SET status = ${erg.ergebnis === "erledigt" ? "entschieden" : "erledigt_von_selbst"}, gewaehlt = ${o.key},
               entschieden_am = NOW(), entschieden_von = ${opts.von.slice(0, 120)}, ergebnis = ${kurz(erg.text, 600)}, fehler = NULL,
               spaeter_bis = NULL, aktualisiert_am = NOW()
         WHERE id = ${id}`;
      // Der Vermerk an der Person: was entschieden wurde (die Werkzeuge schreiben ihren eigenen Vermerk zur Wirkung).
      if (z.person_id) {
        await vermerk(lauf, { personId: Number(z.person_id), ref: z.ref ?? null, von: opts.von,
          text: `Entscheidung „${kurz(z.titel, 80)}“: ${o.label} — ${kurz(erg.text, 300)}` });
      }
    }
    const [neu] = (await lauf.unsafe(`${SICHT_SQL} WHERE e.id = $1`, [id])) as any[];
    return erg.ergebnis === "fehler"
      ? { ok: false, status: 409, error: erg.text, karte: sicht(neu) }
      : { ok: true, status: 200, karte: sicht(neu) };
  } finally {
    inArbeit.delete(id);
  }
}

/** „Später“: drei Tage aus der Liste. */
export async function entscheidungSpaeter(id: number, opts: { tage?: number; lauf?: Lauf } = {}): Promise<EntscheidungSicht | null> {
  await entscheidungTabellen();
  const lauf = opts.lauf ?? sqlPool;
  const tage = Math.max(1, Math.min(30, Math.round(Number(opts.tage) || 3)));
  const z = (await lauf`
    UPDATE fiaon_mara_entscheidungen SET status = 'spaeter', spaeter_bis = NOW() + make_interval(days => ${tage}::int), aktualisiert_am = NOW()
     WHERE id = ${id} AND status IN ('offen', 'spaeter') RETURNING id`) as any[];
  if (!z.length) return null;
  const [neu] = (await lauf.unsafe(`${SICHT_SQL} WHERE e.id = $1`, [id])) as any[];
  return neu ? sicht(neu) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-397 (19.10.2026) — KARTEN LEICHT MACHEN (Großer Hausputz, Baustein 2)
//
// Gemessen am 19.10.2026: 70 Karten offen (Mail-Entwürfe 24, „Kündigung ungebucht“
// 18, Mahnstopp 15), seit dem 16.10. keine entschieden — und Karten entstanden nur,
// wenn jemand das Steuerpult öffnete. Drei Dinge:
//   · tagesLast(): EINE Zeile „Heute N Entscheidungen, etwa M Minuten“ (Lagezimmer
//     und Kopf des Reiters) — Sammelkarten zählen als eine Entscheidung.
//   · sammelGruppen(): gleiche Fälle (gleiche Art UND gleiche Empfehlung) als EINE
//     Sammelkarte; entscheidenSammel() führt je Karte ihre EIGENE Empfehlung aus
//     (mit ihren eigenen Argumenten) — einzelne lassen sich vorher abwählen. Nur für
//     Arten, deren Empfehlung je Fall gleich gemeint ist; Geld (Eingänge, Raten,
//     Erstattungen) und Mail-Entwürfe bleiben Einzelkarten.
//   · Ein Lauf sammelt alle 30 Minuten (tageslauf in fiaon-aufgaben-lage.ts), damit die
//     Zahl stimmt, auch wenn niemand den Reiter öffnet. Ziel: keine Karte älter als 2 Tage.
// ═══════════════════════════════════════════════════════════════════════════

/** Arten, die als Sammelkarte kommen dürfen (gleiche Empfehlung = gleiche Handlung je Fall). */
export const SAMMEL_ARTEN: readonly string[] = ["kuendigung_ungebucht", "mahnstopp", "werbesperre_zahlungspost"];
/** Ab so vielen gleichen Fällen eine Sammelkarte. */
export const SAMMEL_AB = 2;
/** Ziel: keine Karte älter als so viele Tage. */
export const KARTE_ZIEL_TAGE = 2;

/** Geschätzte Sekunden je Einzelkarte (Lesen + Klick) — für „etwa M Minuten“. */
const SEKUNDEN_JE_ART: Record<string, number> = {
  postmeister_entwurf: 60, postmeister_altentwuerfe: 45, raten_nach_ende: 60, eingang_unverbucht: 45,
  kuendigung_ungebucht: 30, mahnstopp: 40, werbesperre_zahlungspost: 30, wa_vorlagen: 20,
};
const sekundenFuer = (art: string) => SEKUNDEN_JE_ART[art] ?? (art.startsWith("wa_") ? 40 : 40);

export interface SammelGruppe {
  schluessel: string; art: string; artText: string; empfehlung: string; empfehlungLabel: string;
  empfehlungTitel: string | null; ids: number[]; anzahl: number; aeltesteAm: string;
}

/** Gleiche Fälle bündeln — rein, auf der Sicht der offenen Karten. */
export function sammelGruppen(offen: EntscheidungSicht[]): SammelGruppe[] {
  const m = new Map<string, EntscheidungSicht[]>();
  for (const k of offen) {
    if (k.status !== "offen" || !SAMMEL_ARTEN.includes(k.art) || !k.empfehlung) continue;
    const o = k.optionen.find((x) => x.key === k.empfehlung);
    if (!o || o.link) continue;
    const key = `${k.art}|${k.empfehlung}`;
    m.set(key, [...(m.get(key) ?? []), k]);
  }
  const aus: SammelGruppe[] = [];
  for (const [key, karten] of Array.from(m.entries())) {
    if (karten.length < SAMMEL_AB) continue;
    const o = karten[0].optionen.find((x) => x.key === karten[0].empfehlung)!;
    const aelteste = karten.reduce((a, k) => (k.createdAt < a ? k.createdAt : a), karten[0].createdAt);
    aus.push({ schluessel: key, art: karten[0].art, artText: karten[0].artText, empfehlung: String(karten[0].empfehlung),
      empfehlungLabel: o.label, empfehlungTitel: o.titel, ids: karten.map((k) => k.id), anzahl: karten.length, aeltesteAm: aelteste });
  }
  return aus.sort((a, b) => b.anzahl - a.anzahl);
}

export interface TagesLast { entscheidungen: number; minuten: number; karten: number; sammelkarten: number; aelterAlsZiel: number; aeltesteTage: number }

/** „Heute N Entscheidungen, etwa M Minuten“ — Sammelkarten zählen als eine (30 s + 5 s je Fall). */
export function tagesLast(offen: EntscheidungSicht[], jetzt = Date.now()): TagesLast {
  const aktiv = offen.filter((k) => k.status === "offen");
  const gruppen = sammelGruppen(aktiv);
  const inGruppe = new Set(gruppen.flatMap((g) => g.ids));
  let sek = 0;
  for (const k of aktiv) if (!inGruppe.has(k.id)) sek += sekundenFuer(k.art);
  for (const g of gruppen) sek += 30 + 5 * g.anzahl;
  const alter = aktiv.map((k) => (jetzt - new Date(k.createdAt).getTime()) / 864e5).filter((t) => Number.isFinite(t));
  return {
    entscheidungen: aktiv.length - inGruppe.size + gruppen.length, minuten: aktiv.length ? Math.max(1, Math.ceil(sek / 60)) : 0,
    karten: aktiv.length, sammelkarten: gruppen.length,
    aelterAlsZiel: alter.filter((t) => t > KARTE_ZIEL_TAGE).length, aeltesteTage: alter.length ? Math.floor(Math.max(...alter)) : 0,
  };
}

/** Nur lesen (ohne den Sammler anzustoßen) — für das Lagezimmer (Stufe Leitung). */
export async function tagesLastLesen(lauf: Lauf = sqlPool): Promise<TagesLast & { gesammeltAm: string | null }> {
  await entscheidungTabellen();
  const offen = (await lauf.unsafe(`${SICHT_SQL} WHERE e.status = 'offen' OR (e.status = 'spaeter' AND e.spaeter_bis <= NOW()) ORDER BY e.gewicht DESC, e.created_at ASC LIMIT 400`)) as any[];
  return { ...tagesLast(offen.map(sicht).map((k) => ({ ...k, status: "offen" as EntscheidungStatus }))), gesammeltAm: letztesErgebnis?.am ?? null };
}

/**
 * Eine Sammelkarte entscheiden: je Karte IHRE Empfehlung (mit ihren eigenen Argumenten) — nacheinander, über
 * denselben Weg wie ein Einzelklick (entscheiden). Der Server prüft, dass alle Karten zur Gruppe gehören (gleiche
 * Sammel-Art, gleiche Empfehlung, offen). Abgewählte Karten schickt die Oberfläche gar nicht mit.
 */
export async function entscheidenSammel(ids: number[], gruppe: string, opts: { von: string; agentId?: number | null }): Promise<{
  ok: boolean; status: number; error?: string; erledigt: number; fehler: { id: number; text: string }[]; karten: EntscheidungSicht[];
}> {
  await entscheidungTabellen();
  const [art, empfehlung] = String(gruppe || "").split("|");
  const liste = Array.from(new Set((ids ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 100);
  if (!SAMMEL_ARTEN.includes(art) || !empfehlung || !liste.length) return { ok: false, status: 400, error: "Keine gültige Sammelkarte.", erledigt: 0, fehler: [], karten: [] };
  const zeilen = (await sqlPool.unsafe(`${SICHT_SQL} WHERE e.id = ANY($1::bigint[])`, [liste])) as any[];
  const fremd = zeilen.filter((z) => z.art !== art || z.empfehlung !== empfehlung);
  if (fremd.length || zeilen.length !== liste.length) return { ok: false, status: 409, error: "Die Auswahl passt nicht mehr zur Sammelkarte — bitte neu laden.", erledigt: 0, fehler: [], karten: [] };
  let erledigt = 0;
  const fehlerListe: { id: number; text: string }[] = [];
  const karten: EntscheidungSicht[] = [];
  for (const id of liste) {
    const r = await entscheiden(id, empfehlung, { von: opts.von, agentId: opts.agentId ?? null });
    if (r.karte) karten.push(r.karte);
    if (r.ok) erledigt += 1; else fehlerListe.push({ id, text: String(r.error || "Fehler") });
  }
  console.log(`[ENTSCHEIDUNG] Sammelkarte ${art} → ${empfehlung} (${opts.von}): ${erledigt} erledigt, ${fehlerListe.length} mit Fehler.`);
  return { ok: true, status: 200, erledigt, fehler: fehlerListe, karten };
}
