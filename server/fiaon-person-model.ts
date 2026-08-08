/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DAS PERSONENMODELL — EINE PERSON = EIN DATENSATZ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WARUM ES DIESES MODUL GIBT
 * `fiaon_applications` vermischt zwei Dinge, die nichts miteinander zu tun
 * haben: WER jemand ist (Konto, Passwort, Kontaktdaten, Betreuung) und WAS er
 * bestellt hat (Paket, Bonitäts-Check, künftig Abo-Monate). Gemessen am
 * 29.07.2026 (SYSTEM_DIAGNOSE.md, Phase 0): 5.963 Zeilen für 2.142 Menschen —
 * 2,78 Zeilen je Mensch, 12 Zeilen im Extremfall.
 *
 * Daraus folgt jedes der gemeldeten Symptome:
 *   · Login-Ausfall — die jüngste Zeile war die Bonitäts-Bestellung ohne Passwort.
 *   · Doppelzählung — 264 bezahlte Zeilen, aber nur 254 bezahlte Menschen.
 *   · Datenverlust beim Zusammenführen — die unterlegene Adresse war weg.
 *   · „Verschwundene" Kunden — sie lagen unter einer anderen Zeile derselben Person.
 *
 * Dieses Modul trennt Person von Bestellung — ADDITIV. Keine bestehende Zeile
 * wird gelöscht oder inhaltlich verändert; sie bekommt nur ein `person_id`.
 *
 * WAS DIESES MODUL NICHT TUT
 *   · Keine Zahlungs- oder Provisionslogik. `onCustomerPaid`, Stichtag und
 *     Direktzahler-Regel bleiben unberührt (Attribution ist Phase 4).
 *   · Kein automatisches Zusammenführen bei blosser Telefon-Gleichheit —
 *     49 Nummern verbinden 139 verschiedene E-Mail-Familien (Haushalte, Firmen-
 *     zentralen). Solche Treffer sind VORSCHLÄGE, nie Automatik (Lehre aus D5).
 *   · Keine Deaktivierung. Es gibt keinen Zustand, aus dem jemand „reaktiviert"
 *     werden müsste — Direktive des Betreibers. `account_status='suspended'`
 *     bleibt allein der Admin-Not-Aus.
 */

import { sqlPool } from "./lib/db-pool";
import { randomBytes } from "crypto";
import { isAddonOrderRow, pickAccountRow, storedPasswordOf } from "./fiaon-login-logic";
import { waehlbareNummer } from "./lib/fiaon-telefon";

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 1 — REINE LOGIK (keine Datenbank, testbar ohne Verbindung)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * E-Mail-Normalisierung — BUCHSTABENGLEICH zur Login-Familienauflösung
 * (`loadLoginFamily`: `LOWER(TRIM(...))`). Weicht sie ab, findet der Login
 * eine andere Person als die Kartei — genau der Fehler, den wir beseitigen.
 */
export function normEmail(v: unknown): string | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || !s.includes("@") || !s.includes(".")) return null;
  return s;
}

/** Nur die Ziffern einer Rufnummer. */
export function phoneDigits(...parts: unknown[]): string {
  return parts.map((p) => String(p ?? "")).join("").replace(/\D/g, "");
}

/**
 * Vergleichsschlüssel einer Rufnummer: die letzten NEUN Ziffern. Damit sind
 * `+49 170 1234567`, `0049170 1234567` und `0170 1234567` derselbe Schlüssel —
 * identisch zur Regel in fiaon-kunden.ts und fiaon-kartei.ts. Unter sieben
 * Ziffern ist eine Nummer kein belastbarer Schlüssel (Durchwahlen, Fragmente).
 */
export function phoneKey9(...parts: unknown[]): string | null {
  const d = phoneDigits(...parts);
  if (d.length < 7) return null;
  return d.slice(-9);
}

/** Alle normalisierten E-Mail-Adressen einer Antragszeile (kann leer sein). */
export function rowEmails(row: any): string[] {
  const list = [row?.email, row?.contact_email, row?.billing_email]
    .map(normEmail)
    .filter((v): v is string => v !== null);
  return Array.from(new Set(list));
}

/** Alle Telefon-Schlüssel einer Antragszeile (kann leer sein). */
export function rowPhoneKeys(row: any): string[] {
  const list = [
    phoneKey9(row?.phone_country_code, row?.phone),
    phoneKey9(row?.contact_phone),
  ].filter((v): v is string => v !== null);
  return Array.from(new Set(list));
}

/** Anzeigename einer Zeile — Privatperson vor Firma, sonst null. */
export function rowName(row: any): { first: string | null; last: string | null; company: string | null } {
  const first = String(row?.first_name ?? "").trim() || null;
  const last = String(row?.last_name ?? "").trim() || null;
  const company = String(row?.company_name ?? "").trim() || null;
  return { first, last, company };
}

/** Vergleichbarer Namensschlüssel (klein, getrimmt) — für Konflikterkennung. */
export function nameKey(row: any): string | null {
  const { first, last, company } = rowName(row);
  const person = [first, last].filter(Boolean).join(" ").trim().toLowerCase();
  if (person) return person;
  const firma = (company ?? String(row?.contact_name ?? "")).trim().toLowerCase();
  return firma || null;
}

export { isAddonOrderRow, pickAccountRow, storedPasswordOf };

/**
 * Die Zeile, aus der die STAMMDATEN der Person stammen.
 *
 * Bewusst dieselbe Rangfolge wie beim Login (`pickAccountRow`): nicht gemergt
 * schlägt gemergt, Konto schlägt Zusatzbestellung, freigeschaltet/bezahlt
 * schlägt offen. Es wäre ein Fehler, hier eine zweite, eigene Rangfolge zu
 * erfinden — dann zeigte die Kundenakte andere Daten als das Kundenportal.
 */
export function pickPersonSourceRow(family: any[]): any | null {
  return pickAccountRow(family);
}

/** Felder, die von der Bestellung an die Person wandern. */
const PERSON_FIELDS = [
  "first_name", "last_name", "company_name", "contact_name",
  "birthdate", "street", "zip", "city", "country", "nationality",
] as const;

export interface PersonDraft {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  contact_name: string | null;
  birthdate: string | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  country: string | null;
  nationality: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  phone_key9: string | null;
  password: string | null;
  kind: string;
}

function leer(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/**
 * Stammdaten aus einer Zeile in den Entwurf übernehmen.
 *
 * HARTE REGEL: Ein bereits gesetzter Wert wird NIEMALS überschrieben. Nur
 * leere Felder werden gefüllt. Genau das Gegenteil geschah bisher beim
 * Zusammenführen — die spätere Zeile überschrieb die frühere, und die Adresse
 * des Kunden war weg. Abweichende Varianten gehen nicht verloren: sie landen
 * als Alias (siehe `collectAliases`).
 */
export function fillFromRow(draft: PersonDraft, row: any): PersonDraft {
  for (const f of PERSON_FIELDS) {
    if (leer((draft as any)[f]) && !leer(row?.[f])) {
      (draft as any)[f] = String(row[f]).trim();
    }
  }
  if (leer(draft.primary_email)) {
    const mails = rowEmails(row);
    if (mails.length > 0) draft.primary_email = mails[0];
  }
  if (leer(draft.primary_phone)) {
    const d = phoneDigits(row?.phone_country_code, row?.phone) || phoneDigits(row?.contact_phone);
    if (d.length >= 7) {
      // ── LÄNDERVORWAHL MITNEHMEN (Meldung 05.08.2026) ───────────────────────
      // Vorher wurde hier `row.phone` übernommen — die nationale Nummer OHNE die
      // Vorwahl, die in `phone_country_code` daneben stand. Ergebnis: 2.058 von
      // 4.521 Personen hatten eine Nummer, mit der kein Anruf möglich war, und
      // jede neue Bestellung legte die nächste an. Der einmalige Reparaturlauf
      // hätte das Problem also nur verschoben; hier ist die Quelle.
      const tel = waehlbareNummer(
        [
          { nummer: row?.phone, vorwahl: row?.phone_country_code },
          { nummer: row?.contact_phone },
        ],
        row?.country,
      );
      draft.primary_phone = tel.waehlbar || tel.anzeige
        || String(row?.phone ?? row?.contact_phone ?? "").trim() || d;
      // Der Vergleichsschlüssel bleibt die letzte NEUN Ziffern — die Vorwahl
      // ändert daran nichts, alle Dubletten-Vergleiche gelten unverändert.
      draft.phone_key9 = d.slice(-9);
    }
  }
  // Das Passwort kommt ausschliesslich von der Konto-Zeile — eine
  // Bonitäts-Bestellung hat keines, und ein leerer Wert darf ein
  // vorhandenes Passwort niemals verdrängen (Ursache des Login-Ausfalls).
  if (leer(draft.password)) {
    const pw = storedPasswordOf(row);
    if (pw) draft.password = pw;
  }
  if (draft.kind !== "business" && String(row?.type ?? "").toLowerCase() === "business") {
    draft.kind = "business";
  }
  return draft;
}

/** Leerer Entwurf. */
export function emptyDraft(): PersonDraft {
  return {
    first_name: null, last_name: null, company_name: null, contact_name: null,
    birthdate: null, street: null, zip: null, city: null, country: null, nationality: null,
    primary_email: null, primary_phone: null, phone_key9: null, password: null,
    kind: "private",
  };
}

/**
 * Die Stammdaten einer Person aus ihrer gesamten Familie bilden.
 * Reihenfolge: zuerst die Konto-Zeile (sie gewinnt bei jedem Feld), danach die
 * übrigen Zeilen chronologisch — sie füllen nur, was noch leer ist.
 */
export function buildPersonDraft(family: any[]): PersonDraft {
  const draft = emptyDraft();
  const account = pickPersonSourceRow(family);
  if (account) fillFromRow(draft, account);
  const rest = family
    .filter((r) => r !== account)
    .slice()
    .sort((a, b) => new Date(a?.created_at ?? 0).getTime() - new Date(b?.created_at ?? 0).getTime());
  for (const r of rest) fillFromRow(draft, r);
  return draft;
}

export interface AliasEntry {
  kind: "email" | "phone";
  valueNorm: string;
  valueRaw: string | null;
  source: string;
}

/**
 * JEDE je verwendete E-Mail-Adresse und Rufnummer der Familie — auch die, die
 * nicht primär wird. Das ist der Kern des Versprechens „beim Zusammenführen
 * geht nichts verloren": Sucht jemand später nach der alten Adresse, findet er
 * die Person trotzdem.
 */
export function collectAliases(family: any[]): AliasEntry[] {
  const out: AliasEntry[] = [];
  const seen = new Set<string>();
  for (const row of family) {
    const source = `app:${row?.ref ?? "?"}`;
    for (const raw of [row?.email, row?.contact_email, row?.billing_email]) {
      const norm = normEmail(raw);
      if (!norm || seen.has(`email:${norm}`)) continue;
      seen.add(`email:${norm}`);
      out.push({ kind: "email", valueNorm: norm, valueRaw: String(raw).trim(), source });
    }
    const paare: Array<[string | null, unknown]> = [
      [phoneKey9(row?.phone_country_code, row?.phone), row?.phone],
      [phoneKey9(row?.contact_phone), row?.contact_phone],
    ];
    for (const [norm, raw] of paare) {
      if (!norm || seen.has(`phone:${norm}`)) continue;
      seen.add(`phone:${norm}`);
      out.push({ kind: "phone", valueNorm: norm, valueRaw: raw ? String(raw).trim() : null, source });
    }
  }
  return out;
}

/** Personen-Referenz: FIAON-P-XXXXXX, ohne verwechselbare Zeichen (kein 0/1/O/I/L). */
const REF_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newPersonRef(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += REF_CHARSET[bytes[i] % REF_CHARSET.length];
  return `FIAON-P-${out}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 2 — SCHEMA (idempotent, additiv, nichts wird entfernt)
// ═══════════════════════════════════════════════════════════════════════════

let personTablesEnsured = false;

/**
 * Legt Personen-Tabellen und die `person_id`-Spalten an. Idempotent.
 *
 * INDIZES LAUFEN BEWUSST ENTKOPPELT (siehe `ensurePersonIndizes`): Nach dem
 * Kartei-Absturz gilt hier die Lehre — ein Index ist eine Beschleunigung, kein
 * Funktionsbestandteil. Er darf niemals im kritischen Pfad liegen und niemals
 * eine ganze Route mitreissen, wenn er fehlschlägt.
 */
export async function ensurePersonTables(): Promise<void> {
  if (personTablesEnsured) return;

  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_persons (
      id SERIAL PRIMARY KEY,
      person_ref VARCHAR NOT NULL UNIQUE,
      kind VARCHAR NOT NULL DEFAULT 'private',      -- private | business

      first_name VARCHAR,
      last_name VARCHAR,
      company_name VARCHAR,
      contact_name VARCHAR,
      birthdate VARCHAR,

      primary_email VARCHAR,                         -- normalisiert (klein, getrimmt)
      primary_phone VARCHAR,                         -- wie eingegeben
      phone_key9 VARCHAR,                            -- letzte 9 Ziffern (Vergleich)

      street VARCHAR,
      zip VARCHAR,
      city VARCHAR,
      country VARCHAR,
      nationality VARCHAR,

      password VARCHAR,                              -- von der Konto-Zeile
      account_status VARCHAR NOT NULL DEFAULT 'pending', -- pending | active | suspended

      assigned_agent_id INTEGER,
      agent_conflict BOOLEAN NOT NULL DEFAULT FALSE, -- mehrere Agenten in der Familie
      quality_flags JSONB,                           -- name_conflict, phone_bridge, no_password …

      first_source VARCHAR,                          -- Quelle des Erstkontakts
      first_campaign VARCHAR,
      first_seen_at TIMESTAMPTZ,

      -- Phase 3 (GoCardless/SEPA): das Mandat gehört an die PERSON, nicht an
      -- die Bestellung. Bis dahin bleiben die Felder leer.
      gc_customer_ref VARCHAR,
      gc_mandate_ref VARCHAR,
      gc_mandate_status VARCHAR,

      merge_batch_id VARCHAR,                        -- Stapel des Backfills (--undo)
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Alias-Ablage: JEDE je verwendete Adresse und Nummer. Nichts geht verloren.
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_person_aliases (
      id SERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL,
      kind VARCHAR NOT NULL,          -- email | phone
      value_norm VARCHAR NOT NULL,    -- normalisiert (Suchschlüssel)
      value_raw VARCHAR,              -- wie der Kunde es geschrieben hat
      source VARCHAR,                 -- app:<ref> | lead:<id> | manual
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Protokoll jedes Backfill-Stapels — Grundlage für --undo und den Bericht.
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_person_batches (
      batch_id VARCHAR PRIMARY KEY,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      persons_created INTEGER NOT NULL DEFAULT 0,
      apps_linked INTEGER NOT NULL DEFAULT 0,
      leads_linked INTEGER NOT NULL DEFAULT 0,
      conflicts INTEGER NOT NULL DEFAULT 0,
      orphans INTEGER NOT NULL DEFAULT 0,
      undone_at TIMESTAMPTZ,
      note TEXT
    )
  `;

  // Die Zuordnung selbst — nullable, damit keine bestehende Zeile bricht.
  await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS person_id INTEGER`;
  await sqlPool`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS person_id INTEGER`;

  // Ein Lauf bindet Zeilen auch an Personen an, die es SCHON GAB (neue
  // Bestellung eines bestehenden Kunden). Diese Zeilen hängen an einer Person
  // aus einem früheren Stapel — ohne die folgenden drei Spalten würde `--undo`
  // sie übersehen und das Versprechen „vollständig umkehrbar" wäre gebrochen.
  // Zusammengeführte Personen werden NICHT gelöscht, sondern zeigen auf die
  // Person, in der sie aufgegangen sind. So bleibt jede frühere Verknüpfung
  // nachvollziehbar und ein falscher Zusammenschluss wieder auflösbar.
  await sqlPool`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS merged_into_person_id INTEGER`;

  // ── Entwurf oder Kunde? ──────────────────────────────────────────────────
  // 3.235 Antragszeilen (54 % des Bestands) haben WEDER E-Mail NOCH Telefon:
  // Der Funnel speichert bei jedem Schritt, und wer vor dem Kontaktschritt
  // abbricht, hinterlässt so eine Zeile. Sie sind kein Kunde, kein Lead und
  // kein Interessent — man kann sie nicht einmal erreichen.
  //
  // Bisher zählten sie überall mit. Das ist der Grund, warum keine Zahl im
  // Dashboard stimmte. Ein Flag statt einer wiederholten WHERE-Bedingung: Eine
  // Bedingung, die an zwanzig Stellen abgeschrieben wird, weicht irgendwann an
  // einer davon ab — und dann stimmt wieder nichts.
  await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS ist_entwurf BOOLEAN NOT NULL DEFAULT FALSE`;

  await sqlPool`ALTER TABLE fiaon_person_batches ADD COLUMN IF NOT EXISTS linked_refs JSONB`;
  await sqlPool`ALTER TABLE fiaon_person_batches ADD COLUMN IF NOT EXISTS linked_lead_ids JSONB`;
  await sqlPool`ALTER TABLE fiaon_person_aliases ADD COLUMN IF NOT EXISTS merge_batch_id VARCHAR`;

  personTablesEnsured = true;
  console.log("[FIAON-PERSON] Personen-Tabellen sichergestellt");

  void ensurePersonIndizes();
}

let indizesVersucht = false;

/**
 * Beschleunigung + die eine STRUKTURELLE Garantie.
 *
 * `fiaon_person_email_unique` ist kein Tempo-Index, sondern die Zusage „keine
 * zwei Personen teilen eine normalisierte E-Mail" — in der Datenbank
 * durchgesetzt statt in einem Skript geprüft. Er wird VOR dem Backfill
 * angelegt: Ein fehlerhafter Lauf scheitert dann an der Datenbank, statt
 * stillschweigend Dubletten zu erzeugen.
 *
 * Jeder Index einzeln abgesichert — schlägt einer fehl, läuft der Rest weiter.
 */
async function ensurePersonIndizes(): Promise<void> {
  if (indizesVersucht) return;
  indizesVersucht = true;

  const indizes: [string, string][] = [
    ["fiaon_person_email_unique",
      `CREATE UNIQUE INDEX IF NOT EXISTS fiaon_person_email_unique
         ON fiaon_person_aliases (value_norm) WHERE kind = 'email'`],
    ["fiaon_person_alias_person_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_person_alias_person_idx
         ON fiaon_person_aliases (person_id, kind)`],
    ["fiaon_person_alias_lookup_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_person_alias_lookup_idx
         ON fiaon_person_aliases (kind, value_norm)`],
    ["fiaon_persons_email_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_persons_email_idx ON fiaon_persons (primary_email)`],
    ["fiaon_persons_phone_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_persons_phone_idx ON fiaon_persons (phone_key9)`],
    ["fiaon_persons_agent_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_persons_agent_idx ON fiaon_persons (assigned_agent_id)`],
    ["fiaon_persons_created_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_persons_created_idx ON fiaon_persons (created_at DESC)`],
    ["fiaon_apps_person_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_apps_person_idx ON fiaon_applications (person_id)`],
    ["fiaon_leads_person_idx",
      `CREATE INDEX IF NOT EXISTS fiaon_leads_person_idx ON fiaon_leads (person_id)`],
  ];

  for (const [name, stmt] of indizes) {
    try {
      await sqlPool.unsafe(stmt);
    } catch (err: any) {
      console.warn(`[FIAON-PERSON] Index ${name} nicht angelegt (${err?.code || "?"}): ${err?.message}`);
    }
  }
  console.log("[FIAON-PERSON] Index-Durchlauf beendet");
}

/** Nur für Tests/Skripte: erzwingt einen erneuten Durchlauf. */
export function __resetPersonEnsureForTests(): void {
  personTablesEnsured = false;
  indizesVersucht = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 3 — DAUERSCHUTZ (P1-C): DIE PERSON WIRD GEFUNDEN, NICHT NEU ERFUNDEN
// ═══════════════════════════════════════════════════════════════════════════
//
// Der Backfill war eine Momentaufnahme. Ohne diesen Teil entsteht ab der
// nächsten Bestellung wieder eine Zeile ohne Person — gemessen rund 90 pro Tag
// (`scripts/person-nachlauf.ts`). Dann wäre der ganze Aufwand umsonst gewesen.
//
// JEDER Schreibpfad, der eine Antragszeile oder einen Lead anlegt, ruft
// `personFuerZeile()`. Die Funktion sucht über die normalisierte E-Mail UND
// die Rufnummer — einschliesslich aller je verwendeten Aliase — und legt nur
// dann eine Person an, wenn wirklich keine passt.
//
// WAS SIE NIEMALS TUT
//   · Kein vorhandenes Stammdatenfeld überschreiben. Nur leere Felder füllen.
//   · Kein Passwort überschreiben oder löschen. Das war die Ursache des
//     Login-Ausfalls; die Regel ist hier dieselbe wie im Antrags-Speicher.
//   · Keinen Agenten umhängen. Bei zwei Agenten wird MARKIERT, nicht entschieden.
//   · Nichts löschen. Auch beim Zusammenführen bleibt die unterlegene Person
//     als Datensatz bestehen und zeigt per `merged_into_person_id` auf die neue.

export interface PersonZuordnung {
  personId: number;
  personRef: string;
  /** Wurde in diesem Aufruf eine neue Person angelegt? */
  angelegt: boolean;
  /** IDs der Personen, die dabei zusammengeführt wurden (meist leer). */
  zusammengefuehrt: number[];
  /** Mehrere Agenten beteiligt — markiert, nicht entschieden. */
  agentKonflikt: boolean;
  /**
   * Die Zeile traf mehrere bestehende Personen. Hier stehen sie — die
   * Entscheidung trifft ein Mensch am Dubletten-Arbeitsplatz.
   */
  mehrdeutig?: number[];
}

export interface PersonEingabe {
  /** Alle Adressen der Zeile, roh. Wird normalisiert. */
  emails?: unknown[];
  /** Alle Rufnummern der Zeile, roh. Wird auf die letzten 9 Ziffern verkürzt. */
  phones?: unknown[];
  /** Stammdaten — füllen nur, was an der Person noch leer ist. */
  stammdaten?: Partial<PersonDraft>;
  /** Betreuender Agent, falls bekannt. */
  agentId?: number | null;
  /** Herkunft für die Alias-Ablage: `app:FIAON-…` oder `lead:123`. */
  quelle: string;
  /** Erstkontakt — nur gesetzt, wenn die Person noch keinen früheren trägt. */
  firstSeenAt?: Date | null;
  /**
   * Was tun, wenn die Zeile MEHRERE bestehende Personen trifft?
   *
   *   "aeltester" — an die älteste Person hängen (Anträge: dort trägt die
   *                 Zeile Stammdaten, die zu einer bestehenden Akte gehören).
   *   "neu"       — eine neue Person anlegen (Lead-Intake). Ein falsches
   *                 Zusammenlegen ist teurer als eine Dublette: Der
   *                 Dubletten-Arbeitsplatz zeigt das Paar sofort, ein
   *                 verschmolzener Kunde ist nur mit Aufwand zu trennen.
   *
   * Vorgabe ist "aeltester" — das entspricht dem Verhalten vor dem 08.08.2026,
   * ABER OHNE das automatische Zusammenführen (siehe `aufloesen`).
   */
  beiMehrdeutigkeit?: "aeltester" | "neu";
}

/** Postgres: Verstoss gegen einen eindeutigen Index. */
const UNIQUE_VIOLATION = "23505";

/**
 * Die Person zu einer Zeile finden oder anlegen.
 *
 * Gibt `null` zurück, wenn die Zeile weder E-Mail noch Rufnummer hat. Das ist
 * kein Fehler, sondern der Funnel-Abbrecher: 3.235 solcher Entwurfszeilen gibt
 * es im Bestand, und sie sollen ausdrücklich KEINE Person bekommen.
 */
export async function personFuerZeile(ein: PersonEingabe): Promise<PersonZuordnung | null> {
  await ensurePersonTables();

  const emails = Array.from(new Set((ein.emails ?? []).map(normEmail).filter((v): v is string => !!v)));
  const phones = Array.from(new Set((ein.phones ?? []).map((p) => phoneKey9(p)).filter((v): v is string => !!v)));
  if (emails.length === 0 && phones.length === 0) return null;

  try {
    return await aufloesen(ein, emails, phones);
  } catch (err: any) {
    // Zwei gleichzeitige Anfragen mit derselben neuen Adresse: eine legt die
    // Person an, die andere läuft in den eindeutigen Index. Kein Fehlerfall —
    // die Person existiert jetzt ja. Einmal neu auflösen genügt.
    if (err?.code === UNIQUE_VIOLATION) {
      console.warn(`[FIAON-PERSON] Gleichzeitiger Anlauf für ${ein.quelle} — löse erneut auf`);
      return await aufloesen(ein, emails, phones);
    }
    throw err;
  }
}

async function aufloesen(ein: PersonEingabe, emails: string[], phones: string[]): Promise<PersonZuordnung> {
  // ── 1. Wem gehören diese Adressen bereits? ──────────────────────────────
  // E-Mail und Telefon werden GEMEINSAM abgefragt: Genau daraus entsteht der
  // Sonderfall, bei dem eine Zeile zwei bisher getrennte Personen verbindet.
  // Gemergte Personen sind Wegweiser, keine Treffer — eine neue Zeile darf sich
  // nicht an einen Wegweiser hängen (sonst ist der Kunde in keiner Liste).
  const treffer = await sqlPool`
    SELECT DISTINCT a.person_id, p.created_at
    FROM fiaon_person_aliases a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE p.merged_into_person_id IS NULL
      AND ((a.kind = 'email' AND a.value_norm = ANY(${emails}::text[]))
        OR (a.kind = 'phone' AND a.value_norm = ANY(${phones}::text[])))
    ORDER BY p.created_at ASC NULLS FIRST, a.person_id ASC
  `;
  const ids = Array.from(new Set((treffer as any[]).map((r) => Number(r.person_id))));

  if (ids.length === 0) {
    return await neuePersonAnlegen(ein, emails, phones);
  }

  // ── 2. Mehrere Treffer: markieren, NICHT entscheiden ────────────────────
  //
  // Bis zum 08.08.2026 wurden die überzähligen Personen hier automatisch
  // zusammengeführt. Die Begründung war plausibel: Eine Zeile, die E-Mail UND
  // Rufnummer zweier bisher getrennter Personen trägt, beweise, dass es derselbe
  // Mensch ist.
  //
  // Sie ist widerlegt. Im Bestand trug eine E-Mail zwei Menschen — ein Antrag
  // lief unter „Magdalena" und gehörte zu Konstantinos Nikoloudis. Dann verbindet
  // die Zeile nicht zwei Datensätze eines Menschen, sondern zwei Menschen. Und
  // ein automatisch verschmolzener Kunde ist nur mit Aufwand zu trennen, während
  // eine Dublette seit Teil A auf einem Arbeitsplatz liegt, an dem ein Mensch
  // sie in zehn Sekunden entscheidet.
  //
  // Falsches Zusammenlegen ist teurer als eine Dublette. Also: nichts merken
  // außer der Mehrdeutigkeit selbst.
  const mehrdeutig = ids.length > 1 ? ids.slice() : undefined;
  if (mehrdeutig) {
    await mehrdeutigkeitMerken(ids, ein);
    if ((ein.beiMehrdeutigkeit ?? "aeltester") === "neu") {
      // Lead-Intake: eine eigene Person. Die Aliase werden trotzdem gesetzt —
      // dieselbe Adresse darf an zwei Personen hängen, genau das macht das Paar
      // als Kandidat sichtbar.
      const neuePerson = await neuePersonAnlegen(ein, emails, phones);
      return { ...neuePerson, mehrdeutig };
    }
  }

  // Die älteste Person gewinnt — sie trägt die längste Geschichte.
  const zielId = ids[0];

  // ── 3. Fehlende Aliase ergänzen ─────────────────────────────────────────
  // Bei Mehrdeutigkeit NUR die Adressen, die noch keiner anderen lebenden Person
  // gehören: Sonst würde die eine Person über die Nummer der anderen findbar —
  // ein Datenmix, den später niemand mehr auseinanderbekommt.
  if (mehrdeutig) {
    const eigene = await unbeanspruchte(emails, phones, zielId);
    await aliaseErgaenzen(zielId, eigene.emails, eigene.phones, ein.quelle);
  } else {
    await aliaseErgaenzen(zielId, emails, phones, ein.quelle);
  }

  // ── 4. Leere Stammdatenfelder füllen — niemals überschreiben ────────────
  await stammdatenErgaenzen(zielId, ein);

  // ── 5. Agent: nie umhängen, bei Abweichung markieren ────────────────────
  const agentKonflikt = await agentPruefen(zielId, ein.agentId ?? null);

  const [p] = await sqlPool`SELECT person_ref FROM fiaon_persons WHERE id = ${zielId}`;
  return {
    personId: zielId,
    personRef: String(p?.person_ref ?? ""),
    angelegt: false,
    zusammengefuehrt: [],
    agentKonflikt,
    mehrdeutig,
  };
}

/** Adressen, die noch keiner ANDEREN lebenden Person gehören. */
async function unbeanspruchte(
  emails: string[], phones: string[], zielId: number,
): Promise<{ emails: string[]; phones: string[] }> {
  const belegt = await sqlPool`
    SELECT a.kind, a.value_norm FROM fiaon_person_aliases a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE p.merged_into_person_id IS NULL AND a.person_id <> ${zielId}
      AND ((a.kind = 'email' AND a.value_norm = ANY(${emails}::text[]))
        OR (a.kind = 'phone' AND a.value_norm = ANY(${phones}::text[])))
  `;
  const fremd = new Set((belegt as any[]).map((r) => `${r.kind}:${r.value_norm}`));
  return {
    emails: emails.filter((e) => !fremd.has(`email:${e}`)),
    phones: phones.filter((t) => !fremd.has(`phone:${t}`)),
  };
}

/**
 * Eine Mehrdeutigkeit festhalten — damit sie nicht nur im Logfile steht.
 *
 * Der Dubletten-Arbeitsplatz findet das Paar ohnehin (gleiche Nummer oder
 * gleiche E-Mail sind Stufe a und b). Dieser Eintrag sagt zusätzlich, WANN und
 * WODURCH es entstanden ist — sonst rätselt später jemand, warum zwei
 * gleichnamige Personen am selben Tag angelegt wurden.
 */
async function mehrdeutigkeitMerken(ids: number[], ein: PersonEingabe): Promise<void> {
  console.warn(`[FIAON-PERSON] ${ein.quelle}: mehrdeutiger Treffer auf Personen ${ids.join(", ")} — nicht zusammengeführt`);
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (${ein.agentId ?? null}, 'person_mehrdeutig',
            ${JSON.stringify({ personen: ids, quelle: ein.quelle, strategie: ein.beiMehrdeutigkeit ?? "aeltester" })},
            'System (Eingang)',
            ${`Eingang traf ${ids.length} bestehende Personen — Entscheidung am Dubletten-Arbeitsplatz`})
  `.catch((e) => console.error("[FIAON-PERSON] Mehrdeutigkeit protokollieren:", e));
}

async function neuePersonAnlegen(ein: PersonEingabe, emails: string[], phones: string[]): Promise<PersonZuordnung> {
  const s = ein.stammdaten ?? {};
  const personRef = newPersonRef();
  const [row] = await sqlPool`
    INSERT INTO fiaon_persons (
      person_ref, kind, first_name, last_name, company_name, contact_name, birthdate,
      primary_email, primary_phone, phone_key9,
      street, zip, city, country, nationality,
      password, account_status, assigned_agent_id, first_seen_at
    ) VALUES (
      ${personRef}, ${s.kind ?? "private"},
      ${s.first_name ?? null}, ${s.last_name ?? null}, ${s.company_name ?? null},
      ${s.contact_name ?? null}, ${s.birthdate ?? null},
      ${emails[0] ?? null}, ${s.primary_phone ?? null}, ${phones[0] ?? null},
      ${s.street ?? null}, ${s.zip ?? null}, ${s.city ?? null},
      ${s.country ?? null}, ${s.nationality ?? null},
      ${s.password ?? null}, 'pending', ${ein.agentId ?? null},
      ${ein.firstSeenAt ?? new Date()}
    )
    RETURNING id, person_ref
  `;
  const personId = Number(row.id);
  await aliaseErgaenzen(personId, emails, phones, ein.quelle);
  console.log(`[FIAON-PERSON] Neue Person ${row.person_ref} (#${personId}) aus ${ein.quelle}`);
  return { personId, personRef: String(row.person_ref), angelegt: true, zusammengefuehrt: [], agentKonflikt: false };
}

/** Aliase anlegen, die es noch nicht gibt. Mehrfach aufrufbar ohne Wirkung. */
async function aliaseErgaenzen(personId: number, emails: string[], phones: string[], quelle: string): Promise<void> {
  const vorhanden = await sqlPool`
    SELECT kind, value_norm FROM fiaon_person_aliases WHERE person_id = ${personId}
  `;
  const da = new Set((vorhanden as any[]).map((r) => `${r.kind}:${r.value_norm}`));
  const neu: Array<{ kind: string; value_norm: string; source: string }> = [];
  for (const e of emails) if (!da.has(`email:${e}`)) neu.push({ kind: "email", value_norm: e, source: quelle });
  for (const p of phones) if (!da.has(`phone:${p}`)) neu.push({ kind: "phone", value_norm: p, source: quelle });
  if (neu.length === 0) return;

  for (const a of neu) {
    try {
      await sqlPool`
        INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
        VALUES (${personId}, ${a.kind}, ${a.value_norm}, ${a.value_norm}, ${a.source})
      `;
    } catch (err: any) {
      // Die Adresse gehört inzwischen jemand anderem. Nicht abbrechen: Der
      // Antrag des Kunden darf an einer Alias-Kollision nicht scheitern.
      if (err?.code === UNIQUE_VIOLATION) {
        console.warn(`[FIAON-PERSON] Alias ${a.kind}:${a.value_norm} gehört bereits einer anderen Person — übergangen (${quelle})`);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Leere Felder füllen. Ein gesetzter Wert bleibt IMMER stehen.
 * `COALESCE(spalte, neu)` heisst genau das: Die Spalte gewinnt, wenn sie etwas
 * enthält. Beim Passwort ist das nicht Kosmetik, sondern die Lehre aus dem
 * Login-Ausfall — ein leerer Wert darf ein vorhandenes Passwort nie verdrängen.
 */
async function stammdatenErgaenzen(personId: number, ein: PersonEingabe): Promise<void> {
  const s = ein.stammdaten ?? {};
  const leer = (v: unknown) => v === null || v === undefined || String(v).trim() === "";
  const wert = (v: unknown) => (leer(v) ? null : String(v).trim());

  await sqlPool`
    UPDATE fiaon_persons SET
      first_name   = COALESCE(first_name,   ${wert(s.first_name)}),
      last_name    = COALESCE(last_name,    ${wert(s.last_name)}),
      company_name = COALESCE(company_name, ${wert(s.company_name)}),
      contact_name = COALESCE(contact_name, ${wert(s.contact_name)}),
      birthdate    = COALESCE(birthdate,    ${wert(s.birthdate)}),
      street       = COALESCE(street,       ${wert(s.street)}),
      zip          = COALESCE(zip,          ${wert(s.zip)}),
      city         = COALESCE(city,         ${wert(s.city)}),
      country      = COALESCE(country,      ${wert(s.country)}),
      nationality  = COALESCE(nationality,  ${wert(s.nationality)}),
      primary_phone = COALESCE(primary_phone, ${wert(s.primary_phone)}),
      password     = COALESCE(password,     ${wert(s.password)}),
      kind         = CASE WHEN ${s.kind ?? null} = 'business' THEN 'business' ELSE kind END,
      first_seen_at = LEAST(COALESCE(first_seen_at, ${ein.firstSeenAt ?? null}), COALESCE(${ein.firstSeenAt ?? null}, first_seen_at)),
      updated_at   = NOW()
    WHERE id = ${personId}
  `;
}

/**
 * Der Agent wird NIE umgehängt.
 *
 * Hat die Person noch keinen, bekommt sie diesen. Hat sie bereits einen
 * anderen, ist das ein Konflikt für die Betreiber-Liste — keine Entscheidung
 * für den Automaten. Wer den Lead gewonnen hat, behält seinen Kunden sichtbar.
 */
async function agentPruefen(personId: number, agentId: number | null): Promise<boolean> {
  if (agentId == null) {
    const [p] = await sqlPool`SELECT agent_conflict FROM fiaon_persons WHERE id = ${personId}`;
    return Boolean(p?.agent_conflict);
  }
  const [p] = await sqlPool`
    SELECT assigned_agent_id, agent_conflict, quality_flags FROM fiaon_persons WHERE id = ${personId}
  `;
  if (!p) return false;

  if (p.assigned_agent_id == null) {
    await sqlPool`
      UPDATE fiaon_persons SET assigned_agent_id = ${agentId}, updated_at = NOW() WHERE id = ${personId}
    `;
    return Boolean(p.agent_conflict);
  }
  if (Number(p.assigned_agent_id) === agentId) return Boolean(p.agent_conflict);

  const flags = (typeof p.quality_flags === "string" ? JSON.parse(p.quality_flags) : p.quality_flags) ?? {};
  const agenten: number[] = Array.from(new Set([...(Array.isArray(flags.agents) ? flags.agents.map(Number) : [Number(p.assigned_agent_id)]), agentId]));
  await sqlPool`
    UPDATE fiaon_persons SET
      agent_conflict = TRUE,
      quality_flags = COALESCE(quality_flags, '{}'::jsonb) || ${JSON.stringify({ agents: agenten })}::jsonb,
      updated_at = NOW()
    WHERE id = ${personId}
  `;
  console.log(`[FIAON-PERSON] Agenten-Konflikt an Person #${personId}: ${agenten.join(", ")} — markiert, nicht entschieden`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZWEI ANSCHLÜSSE, DIE DIE ROUTEN AUFRUFEN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Eine Antragszeile an ihre Person binden.
 *
 * Wird nach JEDEM Speichern aufgerufen — der Funnel speichert bei jedem
 * Schritt. Das ist bewusst so: Beim ersten Aufruf ohne Kontaktdaten passiert
 * nichts, sobald E-Mail oder Telefon da sind, greift die Zuordnung. Jeder
 * weitere Aufruf ist wirkungslos, weil `person_id` dann schon steht.
 *
 * Trägt die Zeile bereits eine Person, wird NICHT neu aufgelöst — sonst könnte
 * eine nachträglich geänderte E-Mail den Kunden einer anderen Person zuordnen.
 * Ergänzt werden dann nur fehlende Aliase und leere Stammdatenfelder.
 */
export async function bindePersonAnAntrag(ref: string): Promise<PersonZuordnung | null> {
  await ensurePersonTables();
  const [row] = await sqlPool`
    SELECT ref, type, person_id, assigned_agent_id, created_at,
           email, contact_email, billing_email,
           phone, phone_country_code, contact_phone,
           first_name, last_name, company_name, contact_name, birthdate,
           street, zip, city, country, nationality, password, utm::text AS utm_string
    FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
  `;
  if (!row) return null;

  const emails = [row.email, row.contact_email, row.billing_email];
  const phones = [phoneDigits(row.phone_country_code, row.phone), row.contact_phone];
  const stammdaten: Partial<PersonDraft> = {
    first_name: row.first_name, last_name: row.last_name,
    company_name: row.company_name, contact_name: row.contact_name,
    birthdate: row.birthdate, street: row.street, zip: row.zip, city: row.city,
    country: row.country, nationality: row.nationality,
    primary_phone: row.phone ?? row.contact_phone ?? null,
    // Nur die Konto-Zeile bringt ein Passwort mit. Eine Bonitäts-Bestellung
    // hat keines — und darf das vorhandene niemals verdrängen.
    password: storedPasswordOf(row),
    kind: String(row.type ?? "").toLowerCase() === "business" ? "business" : "private",
  };

  if (row.person_id != null) {
    const personId = Number(row.person_id);
    const e = Array.from(new Set(emails.map(normEmail).filter((v): v is string => !!v)));
    const p = Array.from(new Set(phones.map((x) => phoneKey9(x)).filter((v): v is string => !!v)));
    if (e.length > 0 || p.length > 0) {
      await aliaseErgaenzen(personId, e, p, `app:${ref}`);
      await stammdatenErgaenzen(personId, { quelle: `app:${ref}`, stammdaten });
    }
    const [pr] = await sqlPool`SELECT person_ref, agent_conflict FROM fiaon_persons WHERE id = ${personId}`;
    return {
      personId,
      personRef: String(pr?.person_ref ?? ""),
      angelegt: false,
      zusammengefuehrt: [],
      agentKonflikt: Boolean(pr?.agent_conflict),
    };
  }

  const zuordnung = await personFuerZeile({
    emails,
    phones,
    stammdaten,
    agentId: row.assigned_agent_id != null ? Number(row.assigned_agent_id) : null,
    quelle: `app:${ref}`,
    firstSeenAt: row.created_at ? new Date(row.created_at) : null,
  });

  // Keine Person = kein Kontaktweg = Entwurf. Diese Zeile darf in keiner
  // Zählung und keiner Liste als Kunde auftauchen. Das Kennzeichen wird bei
  // JEDEM Speichern neu gesetzt: Trägt der Kunde im nächsten Schritt seine
  // E-Mail ein, ist es beim nächsten Aufruf von allein wieder FALSE.
  await sqlPool`
    UPDATE fiaon_applications SET ist_entwurf = ${zuordnung === null}
    WHERE ref = ${ref} AND ist_entwurf IS DISTINCT FROM ${zuordnung === null}
  `;
  if (!zuordnung) return null;

  // `person_id IS NULL` in der Bedingung: Zwei gleichzeitige Speichervorgänge
  // dürfen sich nicht gegenseitig überschreiben.
  await sqlPool`
    UPDATE fiaon_applications SET person_id = ${zuordnung.personId}
    WHERE ref = ${ref} AND person_id IS NULL
  `;
  return zuordnung;
}

/**
 * Einen Lead an seine Person binden.
 *
 * DER ÜBERGANG LEAD → ANTRAG: Meldet sich ein Lead später mit einem Antrag,
 * findet `personFuerZeile` über E-Mail oder Rufnummer dieselbe Person. Agent,
 * Verlauf und Betreuungsnachweis bleiben damit an EINER Akte — der Agent, der
 * den Lead gewonnen hat, sieht seinen Kunden weiterhin bei sich, einschliesslich
 * „Zahlung angekündigt". Vorher zerfiel derselbe Mensch in Lead- und Kundenkarte.
 */
export async function bindePersonAnLead(
  leadId: number,
  opts: { beiMehrdeutigkeit?: "aeltester" | "neu" } = {},
): Promise<PersonZuordnung | null> {
  await ensurePersonTables();
  const [row] = await sqlPool`
    SELECT id, person_id, vorname, nachname, email, telefon, assigned_agent_id, erstellt_am
    FROM fiaon_leads WHERE id = ${leadId} LIMIT 1
  `;
  if (!row) return null;
  if (row.person_id != null) {
    const [pr] = await sqlPool`SELECT person_ref, agent_conflict FROM fiaon_persons WHERE id = ${Number(row.person_id)}`;
    return {
      personId: Number(row.person_id),
      personRef: String(pr?.person_ref ?? ""),
      angelegt: false,
      zusammengefuehrt: [],
      agentKonflikt: Boolean(pr?.agent_conflict),
    };
  }

  const zuordnung = await personFuerZeile({
    emails: [row.email],
    phones: [row.telefon],
    stammdaten: {
      first_name: row.vorname, last_name: row.nachname,
      primary_phone: row.telefon ?? null,
    },
    agentId: row.assigned_agent_id != null ? Number(row.assigned_agent_id) : null,
    quelle: `lead:${leadId}`,
    firstSeenAt: row.erstellt_am ? new Date(row.erstellt_am) : null,
    // Beim Lead-Eingang gilt: nur ein EINDEUTIGER Treffer wird angehängt.
    beiMehrdeutigkeit: opts.beiMehrdeutigkeit ?? "neu",
  });
  if (!zuordnung) return null;

  await sqlPool`
    UPDATE fiaon_leads SET person_id = ${zuordnung.personId}
    WHERE id = ${leadId} AND person_id IS NULL
  `;
  return zuordnung;
}

/**
 * STILLGELEGT AM 08.08.2026 — wird nicht mehr aufgerufen.
 *
 * Diese Funktion war das automatische Zusammenführen bei mehrdeutigen Treffern
 * (siehe `aufloesen`). Sie bleibt als Beleg stehen, WIE es früher lief, und weil
 * ihre Sorgfalt (Aliase mitnehmen, nichts löschen) in die menschlich entschiedene
 * Nachfolgerin eingegangen ist: `server/lib/fiaon-person-merge.ts` mit
 * Transaktion, Zählprobe und Protokoll.
 *
 * Wer hier wieder einen automatischen Aufruf einbaut, hebt Teil A auf.
 *
 * ── Ursprüngliche Beschreibung ──────────────────────────────────────────────
 * Zwei Personen zusammenführen — der Sonderfall „Lead ohne E-Mail".
 *
 * NICHTS WIRD GELÖSCHT. Die unterlegene Person bleibt als Datensatz bestehen
 * und zeigt per `merged_into_person_id` auf die neue. Damit ist jede frühere
 * Verknüpfung nachvollziehbar, und ein falscher Zusammenschluss lässt sich
 * ohne Datenverlust wieder auflösen.
 *
 * Aliase wandern mit — das ist der Kern des Versprechens „beim Zusammenführen
 * geht nichts verloren". Wer später nach der alten Adresse sucht, findet die
 * Person weiterhin.
 */
async function personenZusammenfuehren(zielId: number, verliererId: number, quelle: string): Promise<void> {
  if (zielId === verliererId) return;

  const [ziel] = await sqlPool`SELECT * FROM fiaon_persons WHERE id = ${zielId}`;
  const [verlierer] = await sqlPool`SELECT * FROM fiaon_persons WHERE id = ${verliererId}`;
  if (!ziel || !verlierer) return;

  // Stammdaten: nur Lücken des Ziels füllen. Der Gewinner behält alles Eigene.
  await sqlPool`
    UPDATE fiaon_persons SET
      first_name   = COALESCE(first_name,   ${verlierer.first_name}),
      last_name    = COALESCE(last_name,    ${verlierer.last_name}),
      company_name = COALESCE(company_name, ${verlierer.company_name}),
      contact_name = COALESCE(contact_name, ${verlierer.contact_name}),
      birthdate    = COALESCE(birthdate,    ${verlierer.birthdate}),
      street       = COALESCE(street,       ${verlierer.street}),
      zip          = COALESCE(zip,          ${verlierer.zip}),
      city         = COALESCE(city,         ${verlierer.city}),
      country      = COALESCE(country,      ${verlierer.country}),
      nationality  = COALESCE(nationality,  ${verlierer.nationality}),
      primary_email = COALESCE(primary_email, ${verlierer.primary_email}),
      primary_phone = COALESCE(primary_phone, ${verlierer.primary_phone}),
      phone_key9   = COALESCE(phone_key9,   ${verlierer.phone_key9}),
      password     = COALESCE(password,     ${verlierer.password}),
      first_seen_at = LEAST(COALESCE(first_seen_at, ${verlierer.first_seen_at}), COALESCE(${verlierer.first_seen_at}, first_seen_at)),
      account_status = CASE
        WHEN account_status = 'suspended' OR ${verlierer.account_status} = 'suspended' THEN 'suspended'
        WHEN account_status = 'active' OR ${verlierer.account_status} = 'active' THEN 'active'
        ELSE account_status END,
      updated_at = NOW()
    WHERE id = ${zielId}
  `;

  // Aliase übernehmen — sie machen die Person unter jeder je genutzten Adresse
  // auffindbar. Ohne diesen Schritt wäre das Zusammenführen ein Datenverlust.
  await sqlPool`
    UPDATE fiaon_person_aliases SET person_id = ${zielId}
    WHERE person_id = ${verliererId}
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_person_aliases x
        WHERE x.person_id = ${zielId} AND x.kind = fiaon_person_aliases.kind
          AND x.value_norm = fiaon_person_aliases.value_norm
      )
  `;

  // Bestellungen und Leads zeigen ab jetzt auf den Gewinner.
  await sqlPool`UPDATE fiaon_applications SET person_id = ${zielId} WHERE person_id = ${verliererId}`;
  await sqlPool`UPDATE fiaon_leads SET person_id = ${zielId} WHERE person_id = ${verliererId}`;

  // Zwei Agenten? Markieren, nicht entscheiden.
  const agenten = Array.from(new Set(
    [ziel.assigned_agent_id, verlierer.assigned_agent_id].filter((v) => v != null).map(Number),
  ));
  if (agenten.length > 1) {
    await sqlPool`
      UPDATE fiaon_persons SET
        agent_conflict = TRUE,
        quality_flags = COALESCE(quality_flags, '{}'::jsonb) || ${JSON.stringify({ agents: agenten })}::jsonb,
        updated_at = NOW()
      WHERE id = ${zielId}
    `;
  } else if (ziel.assigned_agent_id == null && verlierer.assigned_agent_id != null) {
    await sqlPool`
      UPDATE fiaon_persons SET assigned_agent_id = ${verlierer.assigned_agent_id}, updated_at = NOW()
      WHERE id = ${zielId}
    `;
  }

  // Die unterlegene Person bleibt bestehen — als Wegweiser, nicht als Leiche.
  await sqlPool`
    UPDATE fiaon_persons SET
      merged_into_person_id = ${zielId},
      account_status = 'merged',
      updated_at = NOW()
    WHERE id = ${verliererId}
  `;
  console.log(
    `[FIAON-PERSON] Person #${verliererId} in #${zielId} zusammengeführt (Auslöser: ${quelle}) — ` +
    `Aliase übernommen, nichts gelöscht${agenten.length > 1 ? `, Agenten-Konflikt ${agenten.join("/")}` : ""}`,
  );
}
