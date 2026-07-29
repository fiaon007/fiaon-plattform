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
      draft.primary_phone = String(row?.phone ?? row?.contact_phone ?? "").trim() || d;
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
