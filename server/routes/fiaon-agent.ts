// ═══════════════════════════════════════════════════════════════════
// FIAON Mitarbeiter-Portal (Rolle "Agent") — Vollausbau
// - Onboarding: Einladung (agent_invite), Passwort-Setup/-Reset (signierte Tokens)
// - Session-Epoch: Admin-Force-Reset invalidiert alle laufenden Sessions
// - Profil: Telefon, Avatar (client-seitig zugeschnitten), Bankdaten AES-256-GCM
//   verschlüsselt + maskiert + auditiert (Betrugsschutz-Banner beim Admin)
// - Attribution: Auto-Claim bei erster Aktion, 15-Min-Soft-Lock gegen Doppelanruf
// - Provisions-Engine: Satz wird am Eintrag EINGEFROREN, Beträge in Integer-Cents,
//   kaufmännische Rundung. Lebenszyklus bestaetigt → in_auszahlung → ausgezahlt;
//   Storno inkl. negativem Verrechnungs-Eintrag nach Auszahlung.
// - Auszahlungen: Antrag = NUR Anforderung, niemals Transaktion.
// - Skripte (Leitfäden) + Status→Kategorie-Mapping, Kalender + agent_callback_reminder.
// - Alle Admin-Endpoints in server/routes/fiaon-team.ts (Agent-403 via blockAgentsFromAdmin).
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { nameSauber } from "../../shared/fiaon-namen";
import bcrypt from "bcryptjs";
import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import PDFDocument from "pdfkit";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { renderInvoicePdf, signInvoiceUrl, ensureInvoiceNumber } from "../fiaon-invoice";
import { fiaonBaseUrl } from "../fiaon-base-url";
import { parseBerlinInput, formatBerlin, pruefeTerminZukunft } from "../lib/fiaon-time";
import { ERGEBNISSE, ergebnisAnwenden, type Ergebnis, pruefeNotiz } from "../lib/fiaon-kontakt-ergebnis";
import { nummerAusZeile } from "../lib/fiaon-telefon";
import { terminArtAusQuelle, terminArtRueckruf } from "../../shared/fiaon-termin-art";

const router = Router();

const AGENT_COOKIE = "fiaon_agent_token";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h Schicht
const EMAIL_LOCK_MS = 10 * 60 * 1000; // 10-Minuten-Sperre pro Kunde
const SOFT_LOCK_MIN = 15; // „in Bearbeitung durch …" beim Öffnen eines unzugewiesenen Kunden
const INVITE_TTL_MS = 48 * 60 * 60 * 1000; // Einladung 48h
const RESET_TTL_MS = 60 * 60 * 1000; // Passwort-Reset 1h

function agentSecret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
}

// Re-Export für Bestandsimporte (fiaon-team.ts) — einzige Quelle: fiaon-base-url.ts
export function baseUrl(): string {
  return fiaonBaseUrl();
}

// ── Geld: IMMER Integer-Cents, kaufmännische Rundung ─────────────────────────
// Math.round rundet für positive Werte halb auf (0,5 → 1) = kaufmännisch.
// Beispiel Testplan 6: 99,99 € × 15 % = 9999 × 1500 / 10000 = 1499,85 Cents → 1500 = 15,00 €.
export function eurToCents(v: string | number | null | undefined): number {
  const n = Number(v);
  if (!v || isNaN(n)) return 0;
  return Math.round(n * 100);
}

export function commissionCents(baseCents: number, rateBp: number): number {
  return Math.round((baseCents * rateBp) / 10000);
}

// ── Bankdaten-Verschlüsselung (AES-256-GCM, Server-Key aus SESSION_SECRET) ──
function bankKey(): Buffer {
  return createHash("sha256").update(`${agentSecret()}:fiaon-bank-v1`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", bankKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(enc: string | null): string | null {
  if (!enc) return null;
  try {
    const [v, ivB64, tagB64, dataB64] = enc.split(":");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", bankKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function maskIban(iban: string): string {
  const clean = iban.replace(/\s+/g, "").toUpperCase();
  if (clean.length < 8) return "••••";
  return `${clean.slice(0, 4)} •••• •••• ${clean.slice(-4)}`;
}

// IBAN-Prüfsummen-Check (MOD-97-10, ISO 13616)
export function ibanChecksumValid(input: string): boolean {
  const iban = input.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const val = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of val) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

// ── Passwort-Policy (F2): min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe ───
export function passwordPolicyError(pw: string): string | null {
  if (typeof pw !== "string" || pw.length < 10) return "Passwort: mindestens 10 Zeichen";
  if (!/[0-9]/.test(pw)) return "Passwort: mindestens eine Zahl";
  if (!/[a-z]/.test(pw)) return "Passwort: mindestens ein Kleinbuchstabe";
  if (!/[A-Z]/.test(pw)) return "Passwort: mindestens ein Großbuchstabe";
  return null;
}

export function hashToken(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

// ── Tabellen & Migrationen (idempotent) ──────────────────────────────────────
let tablesEnsured = false;
export async function ensureAgentTables(): Promise<void> {
  if (tablesEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agents (
      id SERIAL PRIMARY KEY,
      name VARCHAR NOT NULL,
      email VARCHAR NOT NULL UNIQUE,
      password_hash VARCHAR,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // F/G/H: Konto-, Provisions- und Onboarding-Felder
  await sqlPool`ALTER TABLE fiaon_agents ALTER COLUMN password_hash DROP NOT NULL`;
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_agents
      ADD COLUMN IF NOT EXISTS first_name VARCHAR,
      ADD COLUMN IF NOT EXISTS last_name VARCHAR,
      ADD COLUMN IF NOT EXISTS phone VARCHAR,
      ADD COLUMN IF NOT EXISTS avatar TEXT,
      ADD COLUMN IF NOT EXISTS commission_rate_bp INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_goal_cents INTEGER,
      ADD COLUMN IF NOT EXISTS bank_holder_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_iban_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_bic_enc TEXT,
      ADD COLUMN IF NOT EXISTS bank_iban_masked VARCHAR,
      ADD COLUMN IF NOT EXISTS bank_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS bank_change_ack BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS invite_token_hash VARCHAR,
      ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR,
      ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS session_epoch INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS recruited_by INTEGER,
      ADD COLUMN IF NOT EXISTS override_rate_bp INTEGER,
      ADD COLUMN IF NOT EXISTS distribution_active BOOLEAN NOT NULL DEFAULT TRUE,
      -- Rolle im Vertrieb: 'agent' oder 'vertriebsleiter'. Gehört hierher und
      -- nicht in einen einzelnen Endpunkt: Jede Abfrage, die a.rolle liest,
      -- setzt voraus, dass es die Spalte gibt.
      ADD COLUMN IF NOT EXISTS rolle TEXT NOT NULL DEFAULT 'agent'
  `);
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_contact_log (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      agent_id INTEGER,
      agent_name VARCHAR NOT NULL,
      type VARCHAR NOT NULL,            -- note | result | email_sent | claim | system
      outcome VARCHAR,
      note TEXT,
      scheduled_at TIMESTAMPTZ,
      promised_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_contact_log
      ADD COLUMN IF NOT EXISTS done_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS voided_by INTEGER
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_ref_idx ON fiaon_contact_log(ref)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_contact_log_agent_idx ON fiaon_contact_log(agent_id, created_at)`;
  // G2: Attribution + Soft-Lock am Kunden
  // P2-B: commission_basis dokumentiert TRANSPARENT, warum es Provision gab
  // oder nicht ('betreut' | 'direktzahler' | 'admin') + Klartext-Begründung.
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS locked_by_agent_id INTEGER,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS commission_basis VARCHAR,
      ADD COLUMN IF NOT EXISTS commission_basis_note TEXT
  `);
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_applications_assigned_idx ON fiaon_applications(assigned_agent_id)`;
  // G3: Provisionseinträge — Satz + Basis werden EINGEFROREN (Integer-Cents/Basispunkte)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_commissions (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      ref VARCHAR NOT NULL,
      payment_reference VARCHAR,
      pack_name VARCHAR,
      base_amount_cents INTEGER NOT NULL,
      rate_bp INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,     -- kann negativ sein (Storno-Verrechnung)
      status VARCHAR NOT NULL DEFAULT 'bestaetigt',  -- bestaetigt | in_auszahlung | ausgezahlt | storniert
      payout_id INTEGER,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_commissions_agent_idx ON fiaon_commissions(agent_id, status)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_commissions_ref_idx ON fiaon_commissions(ref)`;
  // Paket AE2: Provisionstyp 'own' | 'override' (Team-Umsatzbeteiligung, EXAKT eine Ebene)
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_commissions
      ADD COLUMN IF NOT EXISTS kind VARCHAR NOT NULL DEFAULT 'own',
      ADD COLUMN IF NOT EXISTS source_agent_id INTEGER
  `);
  // Paket AE3: Partner-Programm — erreichte Meilensteine + Prämien-Aufgaben für den Admin
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_partner_milestones (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      milestone_key VARCHAR NOT NULL,      -- senior | executive | managing
      achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      prize_status VARCHAR NOT NULL DEFAULT 'offen',  -- offen | erledigt
      prize_done_at TIMESTAMPTZ,
      UNIQUE (agent_id, milestone_key)
    )
  `;
  // Paket AE4: „Partner vorschlagen“ — kontrollierter Rekrutierungs-Flow (KEIN Auto-Anlegen)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_partner_suggestions (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,           -- vorschlagender Agent
      first_name VARCHAR NOT NULL,
      last_name VARCHAR NOT NULL,
      email VARCHAR NOT NULL,
      phone VARCHAR,
      reason TEXT,
      status VARCHAR NOT NULL DEFAULT 'offen',  -- offen | angenommen | abgelehnt
      decision_reason TEXT,
      created_agent_id INTEGER,            -- bei Annahme: der angelegte Agent
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      decided_at TIMESTAMPTZ
    )
  `;
  // H: Auszahlungs-Anforderungen (Bankdaten-Snapshot verschlüsselt)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_payouts (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'angefordert', -- angefordert | ausgezahlt | abgelehnt
      bank_holder_enc TEXT,
      bank_iban_enc TEXT,
      bank_bic_enc TEXT,
      iban_masked VARCHAR,
      reject_reason TEXT,
      requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;
  // I: Gesprächsvorlagen/Skripte (Soft-Delete)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_scripts (
      id SERIAL PRIMARY KEY,
      title VARCHAR NOT NULL,
      category VARCHAR NOT NULL,
      content_html TEXT,
      file_data TEXT,
      file_name VARCHAR,
      file_mime VARCHAR,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  // Einstellungen (Key-Value) + Agent-Ereignisse (Audit ohne Kundenbezug)
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_settings (
      key VARCHAR PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_events (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      type VARCHAR NOT NULL,   -- invited | invite_resent | password_set | password_reset_requested | password_changed | force_reset | bank_changed | phone_changed | avatar_changed | payout_requested | payout_paid | payout_rejected | commission_created | commission_cancelled | login
      meta TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_events_agent_idx ON fiaon_agent_events(agent_id, created_at)`;
  tablesEnsured = true;
  console.log("[FIAON-AGENT] Agent-/Provisions-Tabellen sichergestellt");
}

// ── Einstellungen mit Defaults ───────────────────────────────────────────────
const SETTING_DEFAULTS: Record<string, string> = {
  default_commission_rate_bp: "1500", // 15,00 %
  payout_min_cents: "5000",           // 50,00 € — Mindestbetrag Selbst-Auszahlung (Vertrag: Minimum Payout Threshold)
  payout_max_retained_cents: "100000",// 1.000,00 € — Obergrenze Guthaben; darüber zahlt FIAON den Überschuss aus (Vertrag: Maximum Retained Balance)
  script_status_map: "{}",            // z. B. {"pending_payment":"Eröffnung","claimed_paid":"Abschluss"}
  // Paket V: tägliche Reminder-Engine (payment_reminder)
  max_reminders: "6",                 // Obergrenze automatischer Erinnerungen pro Bestellung
  reminder_window_start: "10",        // Versandfenster-Beginn (Stunde, Europe/Berlin)
  reminder_window_end: "11",          // Versandfenster-Ende (exklusiv)
  reminder_engine_enabled: "1",       // Not-Aus-Schalter ("1" = an)
  // ── Abo (monatliche Paketrate) ─────────────────────────────────────────────
  abo_motor_enabled: "1",             // Erinnerungs-Motor an/aus ("0" = aus)
  abo_fenster_start: "8",             // Versandfenster Beginn (Stunde, Europe/Berlin)
  abo_fenster_ende: "20",             // Versandfenster Ende (exklusiv) — schützt vor Nachtmails
  abo_stichtag: "",                   // wird beim ersten Motorlauf gesetzt (YYYY-MM-DD)
  // Vorab-Erinnerung X Tage vor Fälligkeit. „0" schaltet sie ab.
  //
  // Sie hebt die Zahlquote — aber ob die Kunden zweimal im Monat von uns hören,
  // ist die Entscheidung des Betreibers und keine Zahl im Quelltext. Deshalb
  // hier und nicht dort.
  abo_vorab_tage: "3",

  // ── KNAPPE TERMINE (18.08.2026) ───────────────────────────────────────
  // Höchstens so viele freie Zeiten je Tag, gleichmäßig über den Tag gestreut.
  // GEMESSEN vorher: 27 Zeiten pro Tag. Siebenundzwanzig freie Termine sagen
  // dem Kunden „hier ist nichts los"; fünf sagen „da ist Betrieb".
  //
  // Die Zahl steht hier und nicht im Quelltext, weil sie eine Entscheidung des
  // Betreibers ist. Grenzen 1–12 prüft `slotsProTag` — ein Tippfehler darf die
  // Terminwahl nicht unbrauchbar machen.
  slots_pro_tag: "5",
  // ── ÜBERHOLT SEIT 19.08.2026 ────────────────────────────────────────────
  // Dieser Schlüssel war die SPERRE („höchstens so viele Anrufe je Nummer und
  // Tag", 429 bei Erreichen). Sie hat am 19.08. 26 Anrufe des Vertriebs
  // verhindert, und der Betreiber musste sie auf 0 stellen.
  //
  // Er wird nicht mehr gelesen. Er bleibt hier stehen, damit niemand ihn für
  // einen vergessenen Wert hält und wieder auf 100 setzt — und weil ein
  // gelöschter Schlüssel bei einem Bestand, der ihn noch trägt, wie ein Fehler
  // aussieht. Die Nachfolge steht direkt darunter.
  max_anrufe_je_nummer_tag: "0",
  // Ab wie vielen Anrufen je Absendernummer und Tag erscheint ein HINWEIS?
  // Ab dem 1,5-fachen wird der Betreiber gewarnt. Gesperrt wird NIE.
  // 0 = keine Hinweise. Kalibrierung in server/lib/fiaon-softphone.ts.
  anruf_hinweis_schwelle: "300",

  // ── DIE EWIGE LEAD-STRECKE (18.08.2026) ───────────────────────────────
  // „1" = die ewige Strecke fährt (Kadenz T+1,3,7,14,30, danach monatlich, ohne
  // Ende). „0" = der alte Sechser-Nachfass, der nach Mail 6 auf „tot" setzt.
  // GEMESSEN vorher: 1.483 Leads standen am Ende der alten Strecke und bekamen
  // nichts mehr; 23 Kunden kamen erst nach der achten Mail.
  lead_strecke_ewig: "1",
  // Wie viele Strecken-Mails am Tag? Gestaffelt, damit nicht 2.700 Mails in
  // einer Stunde rausgehen — das wäre für jeden Spamfilter ein Angriff.
  lead_strecke_pro_tag: "200",

  // ── ONBOARDING-VERGÜTUNG (18.08.2026) ─────────────────────────────────
  // Was ist ein erledigtes Startgespräch dem Haus wert? In Cent, damit keine
  // Kommastelle verloren geht. 0 heißt ausdrücklich „keine Vergütung".
  // Genau EINE Gutschrift je Kunde — erzwungen durch einen Teilindex
  // (db/migrations/057), nicht durch eine Prüfung, die zwei gleichzeitige
  // Abschlüsse beide passieren würden.
  onboarding_verguetung_cent: "1500",
  // ── Kontoabgleich (CSV-Import + Bank-Zuordnung) ───────────────────────────
  // Abgeschaltet am 04.08.2026: Zahlungen werden manuell in der Zahlungszentrale
  // gebucht. Code und Daten bleiben; Zurückschalten = 'true' setzen.
  kontoabgleich_enabled: "false",
  // Nacharbeit zum Kontoabgleich. Abgeschaltet am 05.08.2026: keine offenen
  // Altfälle mehr (262 Eingänge, 211 verbucht, 0 offen). Daten bleiben.
  verbuchung_enabled: "false",
  // Paket AE1: automatische Kundenverteilung (Round-Robin auf aktive Agents)
  distribution_enabled: "1",          // Verteilung an/aus
  distribution_cap: "50",             // Obergrenze offener zugewiesener Kunden pro Agent
  distribution_last_agent_id: "0",    // Rotations-Zeiger (intern)
  // Paket BB: Lead-Nachfass-Automatik (lead_followup)
  lead_followup_enabled: "1",         // Not-Aus-Schalter ("1" = an)
  lead_followup_days: "1,2,4,7,14,21", // Nachfass an Lead-Alter-Tagen (aufsteigend; danach wöchentlich-artig)
  lead_followup_window_start: "9",    // CB (Alt): Soft-Sendefenster-Beginn — durch Sendezeiten ersetzt, bleibt für Abwärtskompat.
  lead_followup_window_end: "18",     // CB (Alt): Soft-Sendefenster-Ende; hartes Limit 08–20 bleibt aktiv.
  max_lead_followups: "6",            // CB: Obergrenze automatischer Nachfässe pro Lead → danach 'tot'
  // Paket CF: klarer Zeitplan (mehrere feste Sendezeiten + Wochentage)
  lead_followup_times: "09:15,19:10", // HH:MM (Europe/Berlin), komma-getrennt; zu diesen Zeiten startet der Auto-Lauf
  lead_followup_weekdays: "1,2,3,4,5,6", // ISO-Wochentage 1=Mo … 7=So; Default Mo–Sa (So aus)
  lead_followup_last_run_slot: "",    // interner Merker "YYYY-M-D HH:MM" gegen Doppelläufe pro Sendezeitpunkt
  // Paket BC2: Lead-Verteilung (eigener Rotations-Zeiger, gleiche Engine)
  lead_distribution_enabled: "1",     // Lead-Verteilung an/aus
  lead_distribution_last_agent_id: "0", // Rotations-Zeiger (intern)
  // Paket AE2: Standard-Override-Satz für Werber (pro Beziehung überschreibbar)
  partner_override_bp: "500",         // 5,00 %
  // Phase 2B (V1): Stichtag der neuen Provisionsregel. Bestellungen, die VOR
  // diesem Zeitpunkt erstellt wurden, laufen nach dem ALTEN Modell (Zuweisung
  // genügt). Leer = Altmodell für ALLE (neue Regel noch nicht scharf).
  // Wird beim Scharfstellen per Skript/Admin auf den Deploy-Zeitpunkt gesetzt.
  commission_cutoff_at: "",
  // Phase 2B (V2): offene Akte ohne Kontakt-Ergebnis wird nach X Minuten
  // automatisch freigegeben (Deadlock-Schutz). 0 = nie. Gilt jetzt auch für die
  // offene Kartei (Leads UND Kunden — eine Regel, ein Wert).
  akte_auto_release_min: "30",
  // ── OFFENE KARTEI ──────────────────────────────────────────────────────────
  // Übernommene Akte OHNE dokumentierten Kontakt geht nach X Tagen zurück in die
  // freie Kartei (Hortungs-Schutz). 0 = nie. Akten MIT Betreuung bleiben immer.
  kartei_hoarding_days: "7",
  // Vorwarnung im Portal, X Tage bevor eine Akte zurückläuft.
  kartei_hoarding_warn_days: "2",
  // Nur vollständig kontaktierbare Karten in die FREIE Kartei legen
  // (Vorgesetzten-Sichtbarkeitsregel aus Phase 3: Name + Telefon + E-Mail).
  // "0" lockert die Regel auf „mindestens ein Kontaktweg".
  kartei_require_full_contact: "1",
  // „Zahlung angekündigt" steht standardmäßig immer ganz oben (Teil C).
  kartei_vorrang_zahlung: "1",
  // Paket AE3: Partner-Programm — Meilenstein-Schwellen (kumulierter bestätigter
  // EIGENumsatz in Cents) + Provisions-Zuschlag in Basispunkten. Admin-editierbar.
  partner_thresholds: JSON.stringify([
    { key: "senior", label: "Senior Partner", minCents: 2_500_000, bonusBp: 200 },
    { key: "executive", label: "Executive Partner", minCents: 7_500_000, bonusBp: 400 },
    { key: "managing", label: "Managing Partner", minCents: 20_000_000, bonusBp: 600 },
  ]),
  // Sachprämien je Meilenstein (Titel/Beschreibung; KEINE automatische Geldbuchung)
  partner_prizes: JSON.stringify({
    senior: { title: "Business-Dinner mit der Geschäftsführung", description: "Persönliche Einladung nach Erreichen des Meilensteins." },
    executive: { title: "MacBook Pro oder iPhone Pro Max", description: "Gerät nach Wahl — Auslieferung über das Admin-Team." },
    managing: { title: "Reise-Voucher 3.000 € + Einladung zum Führungskreis-Event", description: "Voucher und Event-Einladung werden persönlich übergeben." },
  }),
};

export async function getSettings(): Promise<Record<string, string>> {
  await ensureAgentTables();
  const rows = await sqlPool`SELECT key, value FROM fiaon_settings`;
  const out = { ...SETTING_DEFAULTS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
  `;
}

export function agentRateBp(agentRow: { commission_rate_bp: number | null }, settings: Record<string, string>): number {
  return agentRow.commission_rate_bp ?? Number(settings.default_commission_rate_bp) ?? 1500;
}

/** Name des Sitzungs-Cookies. Exportiert, damit Integrationstests ihn setzen können. */
export const AGENT_COOKIE_NAME = AGENT_COOKIE;

// ── Token mit Session-Epoch (Force-Reset invalidiert laufende Sessions) ─────
//
// `signAgentToken` ist exportiert, weil die Zugriffsprüfung der Agenten-APIs
// nur über einen echten HTTP-Aufruf mit gültiger Sitzung beweisbar ist
// (`scripts/test-agent-zugriff.ts`). Eine Prüfung, die nur die SQL-Bedingung
// nachrechnet, würde genau den Fall übersehen, der zählt: eine Route, die die
// Bedingung vergessen hat.
//
// Kein zusätzliches Risiko: Die Funktion lief immer im selben Prozess, und wer
// dieses Modul importieren kann, hat ohnehin Zugriff auf Datenbank und Secret.
export function signAgentToken(agentId: number, epoch: number): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `${agentId}.${epoch}.${exp}`;
  const sig = createHmac("sha256", agentSecret()).update(`agent2:${payload}`).digest("hex").slice(0, 40);
  return `${payload}.${sig}`;
}

// Exportiert seit dem 19.08.2026: Die Als-Kunde-Ansicht bindet ihr Token an die
// Anmeldung des Ansehenden — sonst wäre ein weitergegebenes Cookie ein
// Dauerzugang in ein fremdes Kundenkonto. Dafür muss sie prüfen können, ob
// dieselbe Person noch angemeldet ist. Eine zweite Fassung dieser Prüfung wäre
// die gefährlichere Lösung.
export function verifyAgentToken(token: string | undefined): { id: number; epoch: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [idStr, epochStr, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || exp < Date.now()) return null;
  const expected = createHmac("sha256", agentSecret()).update(`agent2:${idStr}.${epochStr}.${expStr}`).digest("hex").slice(0, 40);
  if (expected !== sig) return null;
  const id = Number(idStr);
  const epoch = Number(epochStr);
  return Number.isInteger(id) && id > 0 && Number.isInteger(epoch) ? { id, epoch } : null;
}

export function issueAgentCookie(res: Response, agentId: number, epoch: number): void {
  res.cookie(AGENT_COOKIE, signAgentToken(agentId, epoch), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TOKEN_TTL_MS,
    path: "/",
  });
}

// ── Middleware ───────────────────────────────────────────────────────────────
export interface AgentRequest extends Request {
  agent?: {
    id: number; name: string; email: string; first_name: string | null;
    avatar?: string | null; rolle?: string;
    is_test_account?: boolean; pruefkonto?: boolean;
    /** Nur-Ansicht: Der Vorgesetzte sieht zu, der Mensch hat sich nicht angemeldet. */
    ansicht?: boolean; ansichtBis?: string | null;
  };
}

export async function requireAgent(req: AgentRequest, res: Response, next: NextFunction) {
  try {
    await ensureAgentTables();
    // ── ANSICHTS-SITZUNG (11.08.2026) ────────────────────────────────────
    // Der Vorgesetzte sieht das Portal mit den Augen eines Mitarbeiters. Das
    // Ansichts-Token ist ein EIGENES — niemals das echte Cookie des Menschen.
    // Es trägt nur seine Kennung und läuft nach 30 Minuten ab.
    //
    // HIER und nicht in jeder Route: `requireAgent` ist die einzige Stelle,
    // durch die jede Team-Route läuft. Eine zweite Prüfung woanders wäre eine
    // zweite Stelle, die jemand vergisst.
    const { ansichtTokenPruefen, ANSICHT_COOKIE } = await import("../lib/fiaon-ansicht");
    const ansicht = ansichtTokenPruefen(req.cookies?.[ANSICHT_COOKIE]);

    let tok = ansicht
      ? { id: ansicht.agentId, epoch: -1 }
      : verifyAgentToken(req.cookies?.[AGENT_COOKIE]);

    // ══════════════════════════════════════════════════════════════════════
    // DER VORGESETZTE BRAUCHT DAS TELEFON — ABER NICHT EIN FREMDES PORTAL
    //
    // ── MEIN FEHLER VON HEUTE MITTAG ──────────────────────────────────────
    // Um dem Vorgesetzten das Telefon im Verwaltungsbereich zu geben, habe ich
    // hier bei gültigem Admin-Code auf „den ersten Vertriebsleiter" geschaltet.
    // Der erste Vertriebsleiter nach Kennung ist Daniel Stripling (ID 8).
    //
    // Die Folge: Wer den Admin-Code hatte und /agent öffnete, war Daniel
    // Stripling — mit seinen Kunden, seinen Zahlen, seinem Space. Und er kam
    // nicht heraus, weil der Admin-Code bleibt.
    //
    // Der Vorgesetzte: „Ich bin die ganze Zeit als Daniel Stripling angemeldet,
    // wenn ich auf /agent gehe — ich kann mich nicht ausloggen."
    //
    // ── DIE GRENZE LIEGT AN DEN ROUTEN, NICHT AM MENSCHEN ─────────────────
    // Das Telefon braucht eine Absenderkennung — das war der richtige
    // Gedanke. Aber es braucht sie NUR für die Telefon-Routen. Ein
    // Kundenportal, eine Arbeitsliste, ein Space gehören einem Menschen; sie
    // einem anderen zu zeigen ist keine Bequemlichkeit, sondern eine
    // Verwechslung.
    //
    // Deshalb: Die Ersatzkennung gilt ausschließlich unter /telefon/. Alles
    // andere antwortet mit 401 und schickt zur Anmeldung — dort gehört der
    // Vorgesetzte hin, wenn er das Portal sehen will. Für „mit den Augen eines
    // Mitarbeiters" gibt es die Ansichts-Sitzung, die sich sichtbar ankündigt
    // und nach 30 Minuten endet.
    // ══════════════════════════════════════════════════════════════════════
    if (!tok && req.path.startsWith("/telefon/")) {
      const { hasAdminCode } = await import("./fiaon-admin-zugang");
      if (hasAdminCode(req as any)) {
        const [chef] = (await sqlPool`
          SELECT id FROM fiaon_agents
          WHERE active AND rolle = 'vertriebsleiter' AND NOT COALESCE(is_test_account, FALSE)
          ORDER BY id LIMIT 1
        `) as any[];
        if (chef) tok = { id: Number(chef.id), epoch: -1 };
      }
    }

    if (!tok) return res.status(401).json({ ok: false, error: "Nicht angemeldet" });
    // AVATAR UND ROLLE GEHÖREN DAZU (11.08.2026): Der Vorgesetzte hatte ein
    // Profilbild hinterlegt und sah trotzdem überall nur seine Initialen —
    // weil die Anmeldung das Bild nie mitlud. Jede Seite hätte es einzeln
    // nachladen müssen; keine tat es. Hier geladen, stimmt es überall.
    const rows = await sqlPool`
      SELECT id, name, email, first_name, active, session_epoch, avatar, rolle,
             is_test_account, pruefkonto
      FROM fiaon_agents WHERE id = ${tok.id}
    `;
    if (rows.length === 0 || !rows[0].active) {
      return res.status(401).json({ ok: false, error: "Zugang deaktiviert" });
    }
    // Session-Epoch-Vergleich: nach Force-Reset sind alte Tokens ungültig.
    // Eine Ansichts-Sitzung (epoch -1) ist davon ausgenommen — sie hat mit
    // der Anmeldung des Menschen nichts zu tun und darf nicht davon abhängen,
    // ob er zwischendurch sein Passwort geändert hat.
    if (tok.epoch !== -1 && Number(rows[0].session_epoch) !== tok.epoch) {
      return res.status(401).json({ ok: false, error: "Sitzung abgelaufen — bitte neu anmelden" });
    }
    req.agent = {
      id: rows[0].id, name: rows[0].name, email: rows[0].email,
      first_name: rows[0].first_name, avatar: rows[0].avatar ?? null,
      rolle: String(rows[0].rolle || "agent"),
      is_test_account: !!rows[0].is_test_account,
      pruefkonto: !!rows[0].pruefkonto,
      // Läuft gerade eine Ansicht? Die Oberfläche zeigt daraufhin den Banner
      // und der Server lehnt jedes Schreiben ab.
      ansicht: !!ansicht,
      ansichtBis: ansicht ? new Date(ansicht.bis).toISOString() : null,
    };
    next();
  } catch (err) {
    console.error("[FIAON-AGENT] auth:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
}

/**
 * Rollentrennung serverseitig: Requests MIT gültigem Agent-Token auf
 * Admin-Routen werden mit 403 abgelehnt (nicht nur im UI versteckt).
 * In server/routes.ts VOR den fiaon-Routern auf /api/fiaon eingehängt.
 */
/**
 * Liegt ein gültiges Agent-Token vor? Wird vom Admin-Zugang gebraucht, um einem
 * angemeldeten Mitarbeiter die Rollen-Erklärung zu zeigen statt der Code-Tastatur
 * — er soll nicht einmal erfahren, dass es einen Zugangscode gibt.
 */
export function hasAgentToken(req: Request): boolean {
  return !!verifyAgentToken((req as any).cookies?.[AGENT_COOKIE]);
}

export function blockAgentsFromAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/admin") && verifyAgentToken((req as any).cookies?.[AGENT_COOKIE])) {
    return res.status(403).json({ ok: false, error: "Kein Zugriff: Agent-Rolle hat keine Admin-Berechtigung" });
  }
  next();
}

export async function logAction(ref: string, agent: { id: number; name: string }, type: string, fields: {
  outcome?: string | null; note?: string | null; scheduledAt?: string | null; promisedDate?: string | null;
} = {}): Promise<any> {
  const rows = await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, scheduled_at, promised_date)
    VALUES (${ref}, ${agent.id}, ${agent.name}, ${type}, ${fields.outcome || null}, ${fields.note || null},
            ${parseBerlinInput(fields.scheduledAt)}, ${parseBerlinInput(fields.promisedDate)})
    RETURNING *
  `;
  return rows[0];
}

export async function logAgentEvent(agentId: number, type: string, meta?: Record<string, unknown>): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta)
    VALUES (${agentId}, ${type}, ${meta ? JSON.stringify(meta) : null})
  `;
}

// ═══════════════ PROVISIONS-ENGINE (G3) — nur serverseitig ═══════════════

// ── Paket AE3: Partner-Programm (Meilensteine, KEINE „Level“) ────────────────
export type PartnerThreshold = { key: string; label: string; minCents: number; bonusBp: number };

export function partnerThresholds(settings: Record<string, string>): PartnerThreshold[] {
  try {
    const arr = JSON.parse(settings.partner_thresholds || "[]");
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((t: any) => t && t.key && Number(t.minCents) > 0)
        .map((t: any) => ({ key: String(t.key), label: String(t.label || t.key), minCents: Number(t.minCents), bonusBp: Number(t.bonusBp) || 0 }))
        .sort((a: PartnerThreshold, b: PartnerThreshold) => a.minCents - b.minCents);
    }
  } catch { /* Fallback unten */ }
  return JSON.parse(SETTING_DEFAULTS.partner_thresholds);
}

/**
 * Kumulierter bestätigter EIGENumsatz (Kundenumsatz der eigenen Abschlüsse).
 * Overrides (kind='override') zählen NICHT für den Partnerstatus — Status
 * entsteht ausschließlich aus Eigenleistung. Clawbacks (negative Einträge)
 * mindern den Umsatz wieder.
 */
export async function ownRevenueCents(agentId: number): Promise<number> {
  const rows = await sqlPool`
    SELECT COALESCE(SUM(CASE WHEN amount_cents > 0 THEN base_amount_cents ELSE -base_amount_cents END), 0) AS s
    FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND kind = 'own' AND status != 'storniert'
  `;
  return Math.max(0, Number(rows[0].s));
}

/** Aktueller Partnerstatus aus Eigenumsatz: höchster erreichter Meilenstein (oder Basis „Partner“). */
export function partnerStatusFor(revenueCents: number, thresholds: PartnerThreshold[]): { key: string; label: string; bonusBp: number } {
  let current = { key: "partner", label: "Partner", bonusBp: 0 };
  for (const t of thresholds) {
    if (revenueCents >= t.minCents) current = { key: t.key, label: t.label, bonusBp: t.bonusBp };
  }
  return current;
}

/**
 * WER HAT ANSPRUCH AUF DIE PROVISION?
 *
 * Bis zum 03.08.2026 stand diese Entscheidung mitten in `onCustomerPaid` und war
 * damit nur durch eine echte Buchung beobachtbar. Für die Buchungs-Vorschau der
 * Verbuchungs-Seite braucht der Admin die Antwort VOR dem Klick — ohne dass eine
 * zweite Kopie der Regeln entsteht, die auseinanderlaufen kann. Deshalb liegt die
 * Entscheidung hier, lesend und ohne Nebenwirkung, und wird von beiden benutzt.
 *
 * Reihenfolge der Prüfung (bewusst, siehe Kommentar in `onCustomerPaid`):
 *   1. Admin-Entscheid (`opts.forceAgentId`) übersteuert alles.
 *   2. Bestellungen VOR dem Stichtag: Zuweisung genügt (Altmodell, kein
 *      rückwirkender Regelwechsel).
 *   3. Ab Stichtag: letzter dokumentierter Kontakt über die ganze Bestell-Familie.
 *   4. Nichts davon → kein Anspruch, der Kunde gilt als Direktzahler.
 */
export type ProvisionsAnspruch = {
  agentId: number | null;
  basisNote: string;
  basisKind: "admin" | "betreut" | "altmodell";
};

export async function ermittleProvisionsAnspruch(
  app: { ref: string; email?: string | null; created_at: any; assigned_agent_id?: number | null },
  opts?: { forceAgentId?: number; forceReason?: string },
): Promise<ProvisionsAnspruch> {
  const ref = app.ref;
  let agentId: number | null = null;
  let basisNote = "";
  let basisKind: "admin" | "betreut" | "altmodell" = "betreut";

  if (opts?.forceAgentId) {
    return {
      agentId: opts.forceAgentId,
      basisKind: "admin",
      basisNote: opts.forceReason || "Admin-Entscheidung (manuelle Nachbuchung)",
    };
  }

  const settingsEarly = await getSettings();
  // ── V1 STICHTAG (Phase 2B): Kein rückwirkender Regelwechsel. Bestellungen,
  // die VOR dem Stichtag erstellt wurden, laufen nach dem ALTEN Modell weiter:
  // Zuweisung genügt für den Anspruch (der Agent hat evtl. telefoniert, ohne
  // zu dokumentieren — die Dokumentationspflicht galt damals noch nicht).
  // Leerer Stichtag = neue Regel noch nicht scharf → Altmodell für alle.
  const cutoffRaw = String(settingsEarly.commission_cutoff_at || "").trim();
  const cutoff = cutoffRaw ? new Date(cutoffRaw) : null;
  const isLegacy = !cutoff || isNaN(cutoff.getTime()) || new Date(app.created_at) < cutoff;
  if (isLegacy && app.assigned_agent_id) {
    // ── DER BETREUER SCHLÄGT DIE ZUWEISUNG (05.08.2026) ─────────────────────
    // Im Altmodell genügte die Zuweisung. Seit es Vertriebsleiter gibt, die
    // Kunden umziehen dürfen, ist das eine offene Flanke: Ein Umzug hätte den
    // Anspruch mitgenommen, obwohl ein anderer die Arbeit gemacht hat.
    // Deshalb gilt auch hier: Gibt es einen dokumentierten Kontakt, gehört der
    // Anspruch dem, der ihn dokumentiert hat. Nur wenn NIEMAND etwas
    // dokumentiert hat, bleibt die Zuweisung die einzige Spur — und dann gilt
    // sie weiter (kein rückwirkender Regelwechsel für die alte Zeit).
    const [dok] = await sqlPool`
      SELECT cl.agent_id, cl.created_at, ag.name
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      LEFT JOIN fiaon_agents ag ON ag.id = cl.agent_id
      WHERE a.person_id = (SELECT person_id FROM fiaon_applications WHERE ref = ${ref})
        AND cl.type = 'result' AND cl.voided_at IS NULL AND cl.agent_id IS NOT NULL
      ORDER BY cl.created_at DESC
      LIMIT 1
    `;
    if (dok?.agent_id && Number(dok.agent_id) !== Number(app.assigned_agent_id)) {
      return {
        agentId: Number(dok.agent_id),
        basisKind: "betreut",
        basisNote: `Altmodell, aber dokumentierte Betreuung schlägt die Zuweisung: letzter Kontakt am `
          + `${new Date(dok.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} durch ${dok.name || `Agent ${dok.agent_id}`}`
          + ` (zugewiesen ist Agent ${app.assigned_agent_id} — eine Umzuweisung nimmt den Anspruch nicht mit).`,
      };
    }
    agentId = Number(app.assigned_agent_id);
    basisKind = "altmodell";
    basisNote = cutoff
      ? `Altmodell: Bestellung vom ${new Date(app.created_at).toLocaleDateString("de-DE")} liegt vor dem Stichtag ${cutoff.toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} → Zuweisung genügt`
      : "Altmodell: Stichtag der neuen Provisionsregel noch nicht gesetzt → Zuweisung genügt";
    return { agentId, basisNote, basisKind };
  }

  // Neue Regel (ab Stichtag): letzter dokumentierter Kontakt vor Zahlung.
  // V3.6 (Dubletten): Kontakte zählen über die GANZE Bestell-Familie —
  // gleiche E-Mail bzw. per merged_into/superseded_by verknüpfte Schwester-
  // Bestellungen. Der Agent betreute den KUNDEN, nicht eine einzelne ref.
  const contacts = await sqlPool`
    WITH familie AS (
      SELECT a2.ref FROM fiaon_applications a2
      WHERE a2.ref = ${ref}
         OR a2.merged_into = ${ref}
         OR (${app.email || null}::text IS NOT NULL AND ${app.email || null}::text <> ''
             AND LOWER(a2.email) = LOWER(${app.email || ""}))
    )
    SELECT agent_id, agent_name, created_at FROM (
      SELECT c.agent_id, c.agent_name, c.created_at
      FROM fiaon_contact_log c
      WHERE c.ref IN (SELECT ref FROM familie) AND c.agent_id IS NOT NULL AND c.voided_at IS NULL
        AND c.type IN ('result', 'email_sent')
      UNION ALL
      SELECT g.agent_id, g.agent_name, g.created_at
      FROM fiaon_lead_log g
      JOIN fiaon_leads l ON l.id = g.lead_id
      WHERE l.converted_order_id IN (SELECT ref FROM familie) AND g.agent_id IS NOT NULL
        AND g.type IN ('result', 'email_sent')
    ) x ORDER BY created_at DESC LIMIT 1
  `;
  if (contacts.length > 0) {
    agentId = Number(contacts[0].agent_id);
    basisNote = `Dokumentierter Kontakt durch ${contacts[0].agent_name} am ${new Date(contacts[0].created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} → Anspruch`;
  }
  return { agentId, basisNote, basisKind };
}

/**
 * Hook aus mark-paid (fiaon-antrag.ts): legt beim Übergang zu `paid` den festen
 * Provisionseintrag an — Satz des Agents wird JETZT eingefroren. Idempotent.
 *
 * Paket AE3: Der Provisionssatz enthält den Meilenstein-Zuschlag des Partner-
 * Programms (auf Basis des Eigenumsatzes VOR diesem Abschluss) — Einfrier-
 * Prinzip bleibt: spätere Statuswechsel ändern bestehende Einträge NIE.
 *
 * Paket AE2 — HARTE REGEL: Team-Umsatzbeteiligung (Override) gibt es für EXAKT
 * EINE Ebene: den direkten Werber (recruited_by) des abschließenden Agents.
 * KEINE Ketten, KEINE Mehrfach-Ebenen, KEINE Rekursion — wirbt der Geworbene
 * später selbst jemanden, erhält NUR er dessen Override, nicht der ursprüngliche
 * Werber. Rechtlicher Grund: klare Abgrenzung zu unzulässigen mehrstufigen
 * Vertriebssystemen. Diese Regel ist bewusst und darf nicht aufgeweicht werden.
 */
export async function onCustomerPaid(ref: string, opts?: { forceAgentId?: number; forceReason?: string }): Promise<void> {
  await ensureAgentTables();
  const apps = await sqlPool`
    SELECT ref, payment_reference, pack_name, amount_due, assigned_agent_id, created_at, email
    FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (apps.length === 0) return;
  const app = apps[0];

  // ── Abo-Kette anlegen (monatliche Paketrate) ────────────────────────────────
  // Bewusst HIER, vor allen weiteren Abbruchbedingungen dieser Funktion: unten
  // gibt es mehrere frühe `return` (Provision schon gebucht, Direktzahler,
  // Betrag 0). Stünde der Aufruf weiter unten, hätte ein Direktzahler kein Abo
  // — und damit nie wieder eine Rechnung. Fire-and-forget: eine Zahlung darf
  // nicht daran scheitern, dass das Abo-Modul etwas nicht anlegen kann.
  import("./fiaon-abo")
    .then((m) => m.aboBeiZahlungAnlegen(ref))
    .catch((e) => console.error("[FIAON-ABO] Anlage nach Zahlung:", e));

  // ── DIE ONBOARDING-STUFE ─────────────────────────────────────────────────
  // Die Geschäftsregel: „Zahlung gebucht → Kunde bekommt Zugang → PFLICHT-
  // Termin mit dem Onboarding-Team → erst nach ERLEDIGTEM Startgespräch wird
  // der Account voll freigeschaltet."
  //
  // Aus demselben Grund wie das Abo an DIESER Stelle: Hier gehen ALLE
  // Buchungswege durch (mark-paid, Kontoabgleich, Buchung der
  // Vertriebsleitung). Weiter unten stehen mehrere frühe `return` — ein
  // Direktzahler hätte dort keine Stufe bekommen und wäre sofort voll aktiv
  // gewesen, ohne je ein Gespräch geführt zu haben.
  //
  // Fire-and-forget: Eine Zahlung darf nicht daran scheitern.
  import("../lib/fiaon-kontostufe")
    .then((m) => m.aufWartestufeSetzen(ref))
    .catch((e) => console.error("[KONTOSTUFE] nach Zahlung:", e));

  // ── DIE PERSON VERLÄSST DEN VERTRIEB ───────────────────────────────────────
  // Ebenfalls VOR allen frühen `return` dieser Funktion. Das Tier war fachlich
  // korrekt berechnet, wurde aber nur von einem Handskript in die Tabelle
  // geschrieben. Zwischen zwei Läufen blieb ein bezahlter Kunde auf Tier 1
  // („Zahlung angekündigt") — mit zwei Folgen, die die Agenten am 05.08.2026
  // gemeldet haben:
  //   1. Er stand am nächsten Tag wieder in der Anrufliste.
  //   2. Die Verteilung greift Tier 1 und 2 — er wurde also an den nächsten
  //      freien Agenten weitergegeben, obwohl er längst bezahlt hatte.
  // Zusätzlich folgt die Person ihrer Bestellung: Zuständig ist, wem die
  // Bestellung gehört, nicht wer sie zufällig aus der Verteilung bekam.
  try {
    const { personTierAktualisieren, personAgentSynchronisieren } = await import("../lib/tier");
    await personAgentSynchronisieren(sqlPool, { ref });
    const t = await personTierAktualisieren(sqlPool, { ref });
    if (t) console.log(`[FIAON-AGENT] Person ${t.personId} nach Zahlung → Tier ${t.tier} (${t.grund})`);
  } catch (e) {
    console.error("[FIAON-TIER] Aktualisierung nach Zahlung:", e);
  }

  // Idempotenz: pro Kunde maximal EIN positiver, nicht-stornierter Eintrag (own + override zusammen)
  const existing = await sqlPool`
    SELECT id FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'
  `;
  if (existing.length > 0) return;

  // ── P2-B (Stichtag: gilt nur für Abschlüsse AB Deploy; bestehende Provisionen
  // bleiben unangetastet — kein Clawback): PROVISION WIRD VERDIENT, NICHT VERLOST.
  // Anspruch NUR bei dokumentierter Betreuung: letzter Agent mit Kontakt-Ergebnis
  // oder dokumentierter Kundenmail VOR der Zahlung (Kunden-Log + Lead-Log).
  // Notizen und das bloße Öffnen der Akte zählen NICHT.
  // Grenzfälle (SYSTEM_DIAGNOSE.md, Phase 2):
  //  - Lead zugewiesen, nie geöffnet/kontaktiert → kein Anspruch (Direktzahler).
  //  - Agent kontaktierte, Kunde zahlt Tage später selbst → Anspruch (Verkauf).
  //  - Mehrere Agenten → letzter dokumentierter Kontakt vor Zahlung gewinnt.
  //  - Admin-Entscheid (Nachbuchungs-Center/manuelle Buchung) übersteuert via opts.
  const anspruch = await ermittleProvisionsAnspruch(app as any, opts);
  const agentId = anspruch.agentId;
  const basisNote = anspruch.basisNote;
  const basisKind = anspruch.basisKind;

  if (!agentId) {
    // DIREKTZAHLER: Kunde hat ohne dokumentierte Agenten-Arbeit gezahlt → keine Provision.
    await sqlPool`
      UPDATE fiaon_applications SET
        commission_basis = 'direktzahler',
        commission_basis_note = 'Kein dokumentierter Agenten-Kontakt vor Zahlung → Direktzahler, keine Provision',
        updated_at = NOW()
      WHERE ref = ${ref} AND commission_basis IS DISTINCT FROM 'direktzahler'
    `;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system',
              'Zahlung ohne dokumentierte Betreuung → Direktzahler, keine Provision (P2-B). Admin kann im Nachbuchungs-Center anders entscheiden.')
    `.catch(() => {});
    console.log(`[FIAON-COMMISSION] ${ref}: Direktzahler — keine dokumentierte Betreuung, keine Provision`);
    return;
  }

  // Attribution folgt der Betreuung: der Agent mit dem letzten dokumentierten
  // Kontakt wird (falls abweichend/leer) als zuständiger Agent gesetzt.
  if (Number(app.assigned_agent_id) !== agentId) {
    await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${agentId}, updated_at = NOW() WHERE ref = ${ref}
    `;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system',
              ${`Attribution folgt der Betreuung (P2-B): zuständiger Agent auf #${agentId} gesetzt (letzter dokumentierter Kontakt vor Zahlung)`})
    `.catch(() => {});
  }
  await sqlPool`
    UPDATE fiaon_applications SET
      commission_basis = ${basisKind},
      commission_basis_note = ${basisNote},
      updated_at = NOW()
    WHERE ref = ${ref}
  `;
  app.assigned_agent_id = agentId;

  const agents = await sqlPool`SELECT id, name, commission_rate_bp, recruited_by, override_rate_bp FROM fiaon_agents WHERE id = ${app.assigned_agent_id}`;
  if (agents.length === 0) return;
  const settings = await getSettings();
  const thresholds = partnerThresholds(settings);
  // Meilenstein-Zuschlag auf Basis des Eigenumsatzes VOR diesem Abschluss
  const revenueBefore = await ownRevenueCents(app.assigned_agent_id);
  const statusBefore = partnerStatusFor(revenueBefore, thresholds);
  const rateBp = agentRateBp(agents[0] as any, settings) + statusBefore.bonusBp;
  const baseCents = eurToCents(app.amount_due);
  const amountCents = commissionCents(baseCents, rateBp);
  if (amountCents <= 0) return;
  await sqlPool`
    INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind,
                                   note)
    VALUES (${app.assigned_agent_id}, ${ref}, ${app.payment_reference}, ${app.pack_name}, ${baseCents}, ${rateBp}, ${amountCents}, 'bestaetigt', 'own',
            ${statusBefore.bonusBp > 0 ? `inkl. ${statusBefore.bonusBp / 100} Prozentpunkte ${statusBefore.label}-Zuschlag` : null})
  `;
  await logAgentEvent(app.assigned_agent_id, "commission_created", { ref, amount_cents: amountCents, rate_bp: rateBp });
  console.log(`[FIAON-COMMISSION] bestätigt: ${ref} → Agent ${app.assigned_agent_id}, ${(amountCents / 100).toFixed(2)} € (${rateBp / 100} %)`);

  // ── Der Space erfährt davon ──────────────────────────────────────────────
  // HIER, im Geschäftsvorgang — nicht in einem Tageslauf, der abends
  // zusammenfasst. Ein Erfolg, von dem das Team erst am nächsten Morgen
  // erfährt, ist eine Statistik; einer, der zehn Minuten später im Feed steht,
  // ist ein Erfolg.
  //
  // Der Post enthält NUR den Vornamen des Kollegen und eine Zahl. Keine
  // Kundendaten — der Space sieht jede Rolle im Haus.
  //
  // Ein Fehler hier darf die Provisionsbuchung nicht umwerfen: Die ist die
  // wichtigere Wahrheit.
  try {
    const { postAbschluss } = await import("../lib/fiaon-space-engine");
    await postAbschluss(Number(app.assigned_agent_id));
  } catch (e) {
    console.error("[FIAON-COMMISSION] Space-Post:", e);
  }

  // ── Paket AE2: Override für den direkten Werber — EXAKT EINE EBENE (s. o.) ──
  if (agents[0].recruited_by) {
    const recruiter = await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${agents[0].recruited_by}`;
    if (recruiter.length > 0) {
      // Override-Satz: pro Beziehung am GEWORBENEN Agent hinterlegt (override_rate_bp),
      // sonst globaler Default. Basis ist der KUNDENumsatz, nicht die Provision.
      const overrideBp = agents[0].override_rate_bp ?? Number(settings.partner_override_bp) ?? 500;
      const overrideCents = commissionCents(baseCents, overrideBp);
      if (overrideCents > 0) {
        await sqlPool`
          INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
          VALUES (${recruiter[0].id}, ${ref}, ${app.payment_reference}, ${app.pack_name}, ${baseCents}, ${overrideBp}, ${overrideCents}, 'bestaetigt', 'override', ${app.assigned_agent_id},
                  ${`Team-Umsatzbeteiligung: Abschluss von ${agents[0].name}`})
        `;
        await logAgentEvent(recruiter[0].id, "override_created", { ref, amount_cents: overrideCents, rate_bp: overrideBp, source_agent_id: app.assigned_agent_id });
        console.log(`[FIAON-OVERRIDE] ${ref}: Werber ${recruiter[0].id} erhält ${(overrideCents / 100).toFixed(2)} € (${overrideBp / 100} % vom Kundenumsatz, eine Ebene)`);
      }
    }
  }

  // ── Paket AE3: Meilenstein-Erreichung prüfen (nach diesem Abschluss) ──
  try {
    const revenueAfter = await ownRevenueCents(app.assigned_agent_id);
    for (const t of thresholds) {
      if (revenueBefore < t.minCents && revenueAfter >= t.minCents) {
        const inserted = await sqlPool`
          INSERT INTO fiaon_partner_milestones (agent_id, milestone_key)
          VALUES (${app.assigned_agent_id}, ${t.key})
          ON CONFLICT (agent_id, milestone_key) DO NOTHING
          RETURNING id
        `;
        if (inserted.length > 0) {
          await logAgentEvent(app.assigned_agent_id, "milestone_reached", { milestone: t.key, revenue_cents: revenueAfter });
          console.log(`[FIAON-PARTNER] Meilenstein erreicht: Agent ${app.assigned_agent_id} → ${t.label} (${(revenueAfter / 100).toFixed(2)} € Eigenumsatz)`);
        }
      }
    }
  } catch (err) {
    console.error("[FIAON-PARTNER] Meilenstein-Check:", err);
  }
}

/**
 * Storno/Erstattung (G3.5): Provision stornieren; war sie bereits ausgezahlt,
 * entsteht ein NEGATIVER Verrechnungs-Eintrag (mindert künftiges Guthaben).
 */
export async function onCustomerRefunded(ref: string): Promise<{ cancelled: number; clawback: number }> {
  await ensureAgentTables();
  const result = { cancelled: 0, clawback: 0 };
  const rows = await sqlPool`
    SELECT * FROM fiaon_commissions WHERE ref = ${ref} AND amount_cents > 0 AND status != 'storniert'
  `;
  for (const c of rows) {
    if (c.status === "ausgezahlt") {
      // bereits ausgezahlt → negativer Saldo-Eintrag, Original bleibt (Buchhaltungs-Spur)
      // Paket AE2: Verrechnungs-Eintrag erbt kind/source — Override-Clawback trifft den Werber
      await sqlPool`
        INSERT INTO fiaon_commissions (agent_id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, source_agent_id, note)
        VALUES (${c.agent_id}, ${ref}, ${c.payment_reference}, ${c.pack_name}, ${c.base_amount_cents}, ${c.rate_bp}, ${-c.amount_cents}, 'bestaetigt', ${c.kind || "own"}, ${c.source_agent_id || null},
                ${`Storno nach Auszahlung — Verrechnung mit künftigen Provisionen (Ursprung #${c.id})`})
      `;
      result.clawback++;
    } else {
      const wasPayout = c.payout_id;
      await sqlPool`UPDATE fiaon_commissions SET status = 'storniert', payout_id = NULL, updated_at = NOW(), note = COALESCE(note, 'Zahlung erstattet/storniert') WHERE id = ${c.id}`;
      result.cancelled++;
      // hing an offener Auszahlung → Betrag neu berechnen, ggf. Anforderung schließen
      if (wasPayout) {
        const sum = await sqlPool`SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions WHERE payout_id = ${wasPayout} AND status = 'in_auszahlung'`;
        const newAmount = Number(sum[0].s);
        if (newAmount <= 0) {
          await sqlPool`UPDATE fiaon_payouts SET status = 'abgelehnt', reject_reason = 'Alle Positionen storniert (Erstattung)', processed_at = NOW() WHERE id = ${wasPayout} AND status = 'angefordert'`;
        } else {
          await sqlPool`UPDATE fiaon_payouts SET amount_cents = ${newAmount} WHERE id = ${wasPayout} AND status = 'angefordert'`;
        }
      }
    }
    await logAgentEvent(c.agent_id, "commission_cancelled", { ref, amount_cents: c.amount_cents, was_status: c.status });
  }
  return result;
}

// ═══════════════ PAKET AC — Stammdaten-Korrektur (Agent + Admin) ═══════════════

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Telefon-Normalisierung: 0049/0-Präfixe → +49…, nur Ziffern; leere Eingabe erlaubt. */
export function normalizePhone(raw: string): string | null {
  let p = String(raw || "").replace(/[\s\-()./]/g, "");
  if (!p) return "";
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+49" + p.slice(1);
  if (!/^\+\d{7,15}$/.test(p)) return null;
  return p;
}

/**
 * Gemeinsamer Kern für Agent- und Admin-Bearbeitung der Kundenstammdaten
 * (Vorname, Nachname, E-Mail, Telefon). NIEMALS Paket/Betrag/Status/Referenz —
 * diese Felder werden hier bewusst nicht einmal gelesen.
 *
 * E-Mail-Änderung zieht den Kunden-Login automatisch mit: der Login sucht den
 * Antrag PER E-MAIL (fiaon-antrag.ts POST /login), das Passwort liegt am selben
 * Datensatz (utm.password) — beides ändert sich in EINEM atomaren UPDATE.
 *
 * Jede Feldänderung erzeugt einen Audit-Eintrag in fiaon_contact_log
 * (type 'edit', „E-Mail korrigiert durch …: alt → neu") für die Kunden-Timeline.
 */
export async function updateCustomerContact(
  ref: string,
  body: any,
  actor: { id: number | null; name: string },
): Promise<{
  error?: { code: number; msg: string };
  changes?: Array<{ field: string; from: string; to: string }>;
  duplicate?: { ref: string; payment_status: string; name: string } | null;
  loginEmailChanged?: boolean;
}> {
  const rows = await sqlPool`
    SELECT ref, first_name, last_name, email, phone, phone_country_code, contact_phone, street, zip, city, utm::text AS utm_string, password
    FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL
  `;
  if (rows.length === 0) return { error: { code: 404, msg: "Kunde nicht gefunden" } };
  const cur = rows[0];

  // Explizite Abwehr: Versuche, geschützte Felder zu ändern, werden hart abgelehnt (Testplan AC).
  const FORBIDDEN = ["packName", "pack_name", "packKey", "pack_key", "amountDue", "amount_due", "paymentStatus", "payment_status", "paymentReference", "payment_reference", "status", "ref"];
  for (const k of FORBIDDEN) {
    if (body[k] !== undefined) return { error: { code: 403, msg: `Feld '${k}' darf hier nicht geändert werden` } };
  }

  // ── EINE REINIGUNG, NICHT ZWEI (19.08.2026) ───────────────────────────
  // Hier stand `String(...).trim()`. Das räumt den Rand, aber nicht doppelte
  // Leerzeichen innen — und es war eine zweite Fassung derselben Regel neben
  // der im Antrag. `nameSauber` ist die eine (shared/fiaon-namen.ts).
  const firstName = body.firstName !== undefined ? nameSauber(body.firstName) : null;
  const lastName = body.lastName !== undefined ? nameSauber(body.lastName) : null;
  const emailRaw = body.email !== undefined ? String(body.email).trim().toLowerCase() : null;
  const phoneRaw = body.phone !== undefined ? String(body.phone) : null;
  // Paket DE: Adresse (Straße/PLZ/Ort) — leere Eingabe = Feld leeren (erlaubt)
  const street = body.street !== undefined ? String(body.street).trim().slice(0, 160) : null;
  const zip = body.zip !== undefined ? String(body.zip).trim().slice(0, 10) : null;
  const city = body.city !== undefined ? String(body.city).trim().slice(0, 80) : null;

  // ── EIN FELD, DAS NUR LEERRAUM ENTHIELT, IST LEER ─────────────────────
  // `nameSauber` gibt dafür `null` zurück. Die alte Prüfung („!firstName")
  // fing den Leerstring; jetzt muss sie unterscheiden, ob das Feld ÜBERGEBEN
  // wurde (dann ist leer ein Fehler) oder nicht (dann bleibt der alte Wert).
  if (body.firstName !== undefined && !firstName) {
    return { error: { code: 400, msg: "Vorname darf nicht leer sein" } };
  }
  if (body.lastName !== undefined && !lastName) {
    return { error: { code: 400, msg: "Nachname darf nicht leer sein" } };
  }
  if (emailRaw !== null && !EMAIL_RE.test(emailRaw)) return { error: { code: 400, msg: "E-Mail-Format ungültig" } };
  if (zip !== null && zip && !/^[0-9]{4,5}$/.test(zip)) return { error: { code: 400, msg: "PLZ ungültig (4–5 Ziffern)" } };
  let phone: string | null = null;
  if (phoneRaw !== null) {
    phone = normalizePhone(phoneRaw);
    if (phone === null) return { error: { code: 400, msg: "Telefonnummer ungültig — bitte mit Vorwahl (+49 …)" } };
  }

  const changes: Array<{ field: string; from: string; to: string }> = [];
  if (firstName !== null && firstName !== (cur.first_name || "")) changes.push({ field: "Vorname", from: cur.first_name || "—", to: firstName });
  if (lastName !== null && lastName !== (cur.last_name || "")) changes.push({ field: "Nachname", from: cur.last_name || "—", to: lastName });
  if (emailRaw !== null && emailRaw !== String(cur.email || "").trim().toLowerCase()) changes.push({ field: "E-Mail", from: cur.email || "—", to: emailRaw });
  const curPhone = `${cur.phone_country_code || ""}${cur.phone || ""}` || cur.contact_phone || "";
  if (phone !== null && phone !== curPhone) changes.push({ field: "Telefon", from: curPhone || "—", to: phone || "—" });
  if (street !== null && street !== (cur.street || "")) changes.push({ field: "Straße", from: cur.street || "—", to: street || "—" });
  if (zip !== null && zip !== (cur.zip || "")) changes.push({ field: "PLZ", from: cur.zip || "—", to: zip || "—" });
  if (city !== null && city !== (cur.city || "")) changes.push({ field: "Ort", from: cur.city || "—", to: city || "—" });
  if (changes.length === 0) return { changes: [], duplicate: null, loginEmailChanged: false };

  // Duplikat-Warnung (Paket AC5): Kollision mit anderem Kunden derselben E-Mail?
  let duplicate: { ref: string; payment_status: string; name: string } | null = null;
  if (emailRaw !== null && changes.some((c) => c.field === "E-Mail")) {
    const dup = await sqlPool`
      SELECT ref, payment_status, first_name, last_name, contact_name FROM fiaon_applications
      WHERE LOWER(TRIM(email)) = ${emailRaw} AND ref != ${ref} AND merged_into IS NULL
      ORDER BY created_at DESC LIMIT 1
    `;
    if (dup.length > 0) {
      duplicate = {
        ref: dup[0].ref,
        payment_status: dup[0].payment_status,
        name: [dup[0].first_name, dup[0].last_name].filter(Boolean).join(" ") || dup[0].contact_name || dup[0].ref,
      };
    }
  }

  // Atomares UPDATE — E-Mail + Login wandern zusammen (Passwort bleibt am Datensatz).
  await sqlPool`
    UPDATE fiaon_applications SET
      first_name = ${firstName !== null ? firstName : cur.first_name},
      last_name = ${lastName !== null ? lastName : cur.last_name},
      email = ${emailRaw !== null ? emailRaw : cur.email},
      phone = ${phone !== null ? (phone || null) : cur.phone},
      phone_country_code = ${phone !== null ? "" : cur.phone_country_code},
      street = ${street !== null ? (street || null) : cur.street},
      zip = ${zip !== null ? (zip || null) : cur.zip},
      city = ${city !== null ? (city || null) : cur.city},
      updated_at = NOW()
    WHERE ref = ${ref}
  `;

  // ══════════════════════════════════════════════════════════════════════
  // DIE ÄNDERUNG MUSS AN DER PERSON ANKOMMEN — SONST SIEHT SIE NUR EINER
  //
  // ── DER BEFUND (16.08.2026) ─────────────────────────────────────────────
  // Team: „Kollege sieht die alte Nummer."
  //
  // Hier wurde ausschließlich `fiaon_applications` beschrieben. Die PERSON
  // (`fiaon_persons.primary_phone`, `primary_email`) blieb, wie sie war.
  // Jede Liste, jede Suche und jeder Mailversand, die über die Person gehen,
  // zeigten weiter den alten Wert. Gemessen: 89 Bestellungen trugen eine
  // andere Nummer als ihre Person, 99 eine andere E-Mail.
  //
  // Zwei Wahrheiten über die Rufnummer eines Menschen sind keine Redundanz,
  // sondern eine Verabredung darüber, wer sich irrt.
  //
  // ── DER ALTE WERT GEHT NICHT VERLOREN ───────────────────────────────────
  // Er wandert als ALIAS in `fiaon_person_aliases`. Ruft der Kunde von der
  // alten Nummer an, wird er weiter erkannt; schrieb er von der alten
  // Adresse, findet ihn die Suche. Ein überschriebener Wert wäre ein
  // Hard-Delete mit anderem Namen.
  await personDurchschreiben(ref, {
    firstName, lastName, email: emailRaw, phone,
    street, zip, city,
  }, actor).catch((e) => {
    // Ein Fehler hier darf die Korrektur nicht umwerfen — aber er muss
    // auffallen, sonst laufen die beiden Wahrheiten wieder auseinander.
    console.error(`[FIAON-CONTACT-EDIT] Person-Durchschrift für ${ref} fehlgeschlagen:`, e);
  });

  // Audit: ein Timeline-Eintrag pro geändertem Feld (alt → neu, Akteur, Zeit)
  for (const c of changes) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${actor.id}, ${actor.name}, 'edit',
              ${`${c.field} korrigiert durch ${actor.name}: ${c.from} → ${c.to}`})
    `;
  }

  // Hat der Kunde bereits ein Konto mit Passwort? → Hinweis „meldet sich künftig mit neuer E-Mail an"
  let hasPassword = Boolean(cur.password);
  if (!hasPassword && cur.utm_string) {
    try { hasPassword = Boolean(JSON.parse(cur.utm_string)?.password); } catch { /* ignorieren */ }
  }
  const loginEmailChanged = hasPassword && changes.some((c) => c.field === "E-Mail");

  console.log(`[FIAON-CONTACT-EDIT] ${ref} durch ${actor.name}: ${changes.map((c) => c.field).join(", ")}${duplicate ? ` (DUBLETTE mit ${duplicate.ref})` : ""}`);
  return { changes, duplicate, loginEmailChanged };
}

/**
 * Schreibt eine Stammdaten-Korrektur auf die PERSON durch.
 *
 * Was hier passiert, und warum in dieser Reihenfolge:
 *   1. Der bisherige Wert wird als Alias gesichert (E-Mail und Telefon).
 *      Erst sichern, dann überschreiben — andersherum wäre der alte Wert
 *      zwischen zwei Anweisungen weg.
 *   2. Die Person bekommt den neuen Wert, inklusive `phone_key9`. Ohne den
 *      Schlüssel erkennt die Anrufzuordnung die neue Nummer nicht, und der
 *      nächste Rückruf landet wieder bei niemandem.
 *   3. Ein Vermerk im Verlauf der Person, nicht nur an der Bestellung.
 *
 * Leere Werte löschen NICHTS an der Person: Wer an einer von vier
 * Bestellungen das Adressfeld leert, hat damit keine Aussage über den
 * Menschen getroffen.
 */
async function personDurchschreiben(
  ref: string,
  neu: {
    firstName: string | null; lastName: string | null; email: string | null;
    phone: string | null; street: string | null; zip: string | null; city: string | null;
  },
  actor: { id: number | null; name: string },
): Promise<void> {
  const [p] = (await sqlPool`
    SELECT p.id, p.first_name, p.last_name, p.primary_email, p.primary_phone
    FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!p) return; // Ein Entwurf ohne Person — dann ist die Bestellzeile alles.

  const alias = async (kind: "email" | "phone", wert: unknown) => {
    const roh = String(wert ?? "").trim();
    if (!roh) return;
    const norm = kind === "email" ? roh.toLowerCase() : roh.replace(/[^\d+]/g, "");
    if (!norm) return;
    await sqlPool`
      INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source)
      SELECT ${p.id}, ${kind}, ${norm}, ${roh}, ${`edit:${ref}`}
      WHERE NOT EXISTS (
        SELECT 1 FROM fiaon_person_aliases
        WHERE person_id = ${p.id} AND kind = ${kind} AND value_norm = ${norm}
      )
    `;
  };

  if (neu.email && neu.email !== String(p.primary_email ?? "").toLowerCase()) {
    await alias("email", p.primary_email);
    await sqlPool`UPDATE fiaon_persons SET primary_email = ${neu.email}, updated_at = NOW() WHERE id = ${p.id}`;
  }
  if (neu.phone && neu.phone !== String(p.primary_phone ?? "")) {
    await alias("phone", p.primary_phone);
    // `phone_key9` ist die indexierte Vergleichsspalte für eingehende Anrufe
    // und die Anrufzuordnung. Sie hier zu vergessen hieße: neue Nummer
    // gespeichert, Kunde beim Rückruf trotzdem unbekannt.
    const kern = neu.phone.replace(/\D/g, "").slice(-9) || null;
    await sqlPool`
      UPDATE fiaon_persons
      SET primary_phone = ${neu.phone}, phone_key9 = ${kern}, updated_at = NOW()
      WHERE id = ${p.id}
    `;
  }
  if (neu.firstName) {
    await sqlPool`UPDATE fiaon_persons SET first_name = ${neu.firstName}, updated_at = NOW() WHERE id = ${p.id}`;
  }
  if (neu.lastName) {
    await sqlPool`UPDATE fiaon_persons SET last_name = ${neu.lastName}, updated_at = NOW() WHERE id = ${p.id}`;
  }
  if (neu.street) await sqlPool`UPDATE fiaon_persons SET street = ${neu.street}, updated_at = NOW() WHERE id = ${p.id}`;
  if (neu.zip) await sqlPool`UPDATE fiaon_persons SET zip = ${neu.zip}, updated_at = NOW() WHERE id = ${p.id}`;
  if (neu.city) await sqlPool`UPDATE fiaon_persons SET city = ${neu.city}, updated_at = NOW() WHERE id = ${p.id}`;

  await sqlPool`
    INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
    VALUES (${p.id}, ${ref}, ${actor.id}, ${actor.name}, 'edit',
            ${`Stammdaten der Person aktualisiert (${actor.name}). Der bisherige Wert bleibt als Alias erhalten.`})
  `.catch(() => {});
}

// ═══════════════ PAKET AE1 — Automatische Kundenverteilung (Round-Robin) ═══════════════

/**
 * Verteilt unzugewiesene offene Bestellungen fair auf alle aktiven Agents mit
 * distribution_active=TRUE. Rotations-Zeiger in fiaon_settings; Obergrenze
 * offener zugewiesener Kunden pro Agent (distribution_cap, 0 = unbegrenzt).
 * Läuft nach jeder Bestellanlage + stündlich (fail-safe). Bestehendes
 * Auto-Claim für Altbestände und manuelle Admin-Neuzuweisung bleiben erhalten.
 */
export async function distributeUnassignedOrders(): Promise<number> {
  // ── P2-B: ABGESCHALTET. Bestellungen werden NICHT mehr per Round-Robin
  // „verlost" — das erzeugte Provisions-Ansprüche ohne Arbeit (SYSTEM_DIAGNOSE.md,
  // D2: 24 Bestellungen mit anderem Agent als der betreuende Lead-Agent).
  // Attribution entsteht jetzt ausschließlich durch:
  //  1. Lead→Kunde-Konversion (überträgt den betreuenden Agent, fiaon-leads.ts),
  //  2. dokumentierte Betreuung (onCustomerPaid, letzter Kontakt vor Zahlung),
  //  3. Auto-Claim bei aktiver Arbeit am Kunden bzw. manuelle Admin-Zuweisung.
  // Round-Robin verteilt weiterhin NUR LEADS (distributeUnassignedLeads).
  // Sichtbarkeit leidet nicht: /agent/customers zeigt offene Bestellungen allen.
  return 0;
}

// ═══════════════ KALENDER-ERINNERUNGEN (J2) — stündlicher Cron ═══════════════

/** Termine der nächsten 60 Minuten → Make `agent_callback_reminder` (einmalig, atomarer Claim). */
export async function runCallbackReminders(): Promise<number> {
  await ensureAgentTables();
  const claimed = await sqlPool`
    UPDATE fiaon_contact_log SET reminder_sent_at = NOW()
    WHERE scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '60 minutes'
      AND done_at IS NULL AND reminder_sent_at IS NULL AND voided_at IS NULL AND agent_id IS NOT NULL
    RETURNING id, ref, agent_id, scheduled_at
  `;
  let sent = 0;
  for (const entry of claimed) {
    const agents = await sqlPool`SELECT email, first_name, name FROM fiaon_agents WHERE id = ${entry.agent_id} AND active = TRUE`;
    if (agents.length === 0) continue;
    const apps = await sqlPool`SELECT first_name, last_name, contact_name, company_name FROM fiaon_applications WHERE ref = ${entry.ref}`;
    const a = apps[0] || {};
    const kunde = a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || entry.ref;
    await sendMakeWebhook("agent_callback_reminder", {
      email: agents[0].email,
      agent_email: agents[0].email,
      vorname: agents[0].first_name || agents[0].name,
      kunde_name: kunde,
      referenz: entry.ref,
      termin_zeit: new Date(entry.scheduled_at).toISOString(),
      // Klartext in deutscher Zeit — für die E-Mail an den Agenten (Ticket #13).
      termin_zeit_text: formatBerlin(entry.scheduled_at),
    });
    sent++;
  }
  if (sent) console.log(`[FIAON-AGENT] Rückruf-Erinnerungen versendet: ${sent}`);
  return sent;
}

// Anbindung an den bestehenden Stunden-Rhythmus (fail-safe, unabhängig vom Payment-Cron).
// Nur im Betrieb — ein Entwicklungsserver darf keine echten Erinnerungen
// verschicken (siehe server/lib/fiaon-crons.ts, Vorfall vom 08.08.2026).
import("../lib/fiaon-crons").then(({ tageslauf }) => {
  tageslauf("agent-rueckruf-erinnerungen", () => {
    runCallbackReminders().catch((err) => console.error("[FIAON-AGENT] Reminder-Cron:", err));
  }, 60 * 60 * 1000);

  // ── DIE NUMMERN-ANFRAGEN, TÄGLICH (27.08.2026) ──────────────────────────
  // Der Bestandslauf hat am 24.08. sieben Fälle nachgetragen; drei Tage später
  // standen ZWEI wieder da — ihre alte Wiedervorlage (+3 Tage aus der Zeit vor
  // dem Wartezustand) war fällig geworden.
  //
  // Ein Bestandslauf, den ein Mensch aufrufen muss, wird beim dritten Mal
  // vergessen. Die Funktion ist idempotent: Sie fasst nur an, wer keinen
  // Wartezustand trägt und heute in der Tagesliste stünde. Ein zweiter Lauf
  // findet niemanden.
  //
  // Einmal am Tag genügt — die Wiedervorlagen werden auf Tagesebene fällig.
  // `beimStartNach` fängt die Fälle vom Vortag gleich beim Neustart ein.
  tageslauf("warten-nummern-nachtragen", () => {
    void import("../lib/fiaon-warten")
      .then(({ nummernAnfragenNachtragen }) => nummernAnfragenNachtragen())
      .catch((err) => console.error("[FIAON-AGENT] Warten-Nachlauf:", err));
  }, 24 * 60 * 60 * 1000, { beimStartNach: 90_000 });
});

// ═══════════════ AGENT: Auth (Login + Setup + Reset) ═══════════════

router.post("/agent/login", async (req, res) => {
  try {
    await ensureAgentTables();
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich" });
    const rows = await sqlPool`SELECT * FROM fiaon_agents WHERE LOWER(email) = ${String(email).trim().toLowerCase()}`;
    if (rows.length === 0 || !rows[0].active || !rows[0].password_hash || !(await bcrypt.compare(password, rows[0].password_hash))) {
      return res.status(401).json({ ok: false, error: "Anmeldedaten ungültig oder Zugang deaktiviert" });
    }
    await sqlPool`UPDATE fiaon_agents SET last_login_at = NOW() WHERE id = ${rows[0].id}`;
    logAgentEvent(rows[0].id, "login").catch(() => {});
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    console.log(`[FIAON-AGENT] Login: ${rows[0].name} (${rows[0].email})`);
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] login:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/ansicht/beenden — die Ansichts-Sitzung verlassen.
 *
 * Die EINZIGE schreibende Route, die während einer Ansicht erlaubt ist
 * (siehe `ansichtNurLesen`). Ohne sie käme man nicht mehr heraus, denn jedes
 * andere POST wird abgelehnt.
 */
router.post("/agent/ansicht/beenden", async (req, res) => {
  try {
    const { ANSICHT_COOKIE, ansichtTokenPruefen, ansichtProtokoll } =
      await import("../lib/fiaon-ansicht");
    const tok = ansichtTokenPruefen(req.cookies?.[ANSICHT_COOKIE]);
    res.clearCookie(ANSICHT_COOKIE, { path: "/" });
    if (tok) await ansichtProtokoll(tok.agentId, "beendet");
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] ansicht beenden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/logout — abmelden.
 *
 * ── DER BEFUND (11.08.2026) ────────────────────────────────────────────────
 * Der Vorgesetzte: „Ich bin die ganze Zeit als Daniel Stripling angemeldet,
 * wenn ich auf /agent gehe — ich kann mich nicht ausloggen."
 *
 * Hier wurde NUR das Agenten-Cookie gelöscht. Die ANSICHTS-Sitzung blieb
 * stehen — und `requireAgent` prüft sie ZUERST. Nach dem Abmelden war er also
 * sofort wieder derselbe Mensch, weil das zweite Cookie ihn dorthin
 * zurückbrachte.
 *
 * Eine Abmeldung, die nur eine von zwei Türen schließt, ist keine Abmeldung.
 * Sie ist schlimmer als keine: Man glaubt, gegangen zu sein.
 */
router.post("/agent/logout", async (_req, res) => {
  res.clearCookie(AGENT_COOKIE, { path: "/" });
  // Auch die Ansichts-Sitzung. Wer sich abmeldet, will WEG — nicht in eine
  // andere Rolle rutschen.
  const { ANSICHT_COOKIE } = await import("../lib/fiaon-ansicht");
  res.clearCookie(ANSICHT_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/agent/me", requireAgent, (req: AgentRequest, res) => {
  res.json({ ok: true, agent: req.agent });
});

// F2: Einladungs-Token prüfen (Setup-Seite lädt Name zur Begrüßung)
router.get("/agent/setup/validate", async (req, res) => {
  try {
    await ensureAgentTables();
    const token = String(req.query.token || "");
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const rows = await sqlPool`
      SELECT id, first_name, name, email FROM fiaon_agents
      WHERE invite_token_hash = ${hashToken(token)} AND invite_expires_at > NOW() AND active = TRUE
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Einladung ungültig oder abgelaufen — bitte neue Einladung anfordern" });
    res.json({ ok: true, firstName: rows[0].first_name || rows[0].name, email: rows[0].email });
  } catch (err) {
    console.error("[FIAON-AGENT] setup validate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// F2: Passwort festlegen (einmaliger Token, danach direkt eingeloggt)
router.post("/agent/setup", async (req, res) => {
  try {
    await ensureAgentTables();
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const policyErr = passwordPolicyError(String(password || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(password), 10);
    // Atomar: Token einlösen + entwerten (einmalige Nutzung)
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        password_hash = ${hash},
        invite_token_hash = NULL, invite_expires_at = NULL,
        last_login_at = NOW()
      WHERE invite_token_hash = ${hashToken(String(token))} AND invite_expires_at > NOW() AND active = TRUE
      RETURNING id, name, email, session_epoch
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Einladung ungültig oder abgelaufen" });
    await logAgentEvent(rows[0].id, "password_set");
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    console.log(`[FIAON-AGENT] Passwort-Setup abgeschlossen: ${rows[0].email}`);
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] setup:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// F2: Passwort vergessen — IMMER dieselbe Antwort (Anti-Enumeration)
router.post("/agent/forgot-password", async (req, res) => {
  try {
    await ensureAgentTables();
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (email) {
      const rows = await sqlPool`SELECT id, first_name, name, email FROM fiaon_agents WHERE LOWER(email) = ${email} AND active = TRUE`;
      if (rows.length > 0) {
        const token = randomBytes(32).toString("hex");
        await sqlPool`
          UPDATE fiaon_agents SET reset_token_hash = ${hashToken(token)}, reset_expires_at = ${new Date(Date.now() + RESET_TTL_MS)}
          WHERE id = ${rows[0].id}
        `;
        await logAgentEvent(rows[0].id, "password_reset_requested");
        sendMakeWebhook("agent_password_reset", {
          email: rows[0].email,
          vorname: rows[0].first_name || rows[0].name,
          reset_url: `${baseUrl()}/agent/passwort?token=${token}`,
        }).catch(() => {});
      }
    }
    // Keine Auskunft, ob die E-Mail existiert
    res.json({ ok: true, message: "Falls ein Konto existiert, wurde eine E-Mail versendet." });
  } catch (err) {
    console.error("[FIAON-AGENT] forgot:", err);
    res.json({ ok: true, message: "Falls ein Konto existiert, wurde eine E-Mail versendet." });
  }
});

// F2: Passwort per Reset-Token setzen (1h gültig, invalidiert alte Sessions)
router.post("/agent/reset-password", async (req, res) => {
  try {
    await ensureAgentTables();
    const { token, password } = req.body || {};
    if (!token) return res.status(400).json({ ok: false, error: "Token fehlt" });
    const policyErr = passwordPolicyError(String(password || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(password), 10);
    const rows = await sqlPool`
      UPDATE fiaon_agents SET
        password_hash = ${hash},
        reset_token_hash = NULL, reset_expires_at = NULL,
        session_epoch = session_epoch + 1,
        last_login_at = NOW()
      WHERE reset_token_hash = ${hashToken(String(token))} AND reset_expires_at > NOW() AND active = TRUE
      RETURNING id, name, email, session_epoch
    `;
    if (rows.length === 0) return res.status(410).json({ ok: false, error: "Link ungültig oder abgelaufen — bitte erneut anfordern" });
    await logAgentEvent(rows[0].id, "password_changed", { via: "reset" });
    issueAgentCookie(res, rows[0].id, Number(rows[0].session_epoch));
    res.json({ ok: true, agent: { name: rows[0].name, email: rows[0].email } });
  } catch (err) {
    console.error("[FIAON-AGENT] reset:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Profil (F3) ═══════════════

router.get("/agent/profile", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      SELECT id, name, first_name, last_name, email, phone, avatar,
             bank_iban_masked, bank_holder_enc IS NOT NULL AS has_bank,
             monthly_goal_cents, created_at, last_login_at
      FROM fiaon_agents WHERE id = ${req.agent!.id}
    `;
    const r = rows[0];
    res.json({
      ok: true,
      profile: {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        name: r.name,
        email: r.email,
        phone: r.phone,
        avatar: r.avatar,
        ibanMasked: r.bank_iban_masked,
        hasBank: r.has_bank,
        bankHolder: r.has_bank ? decryptSecret((await sqlPool`SELECT bank_holder_enc FROM fiaon_agents WHERE id = ${r.id}`)[0].bank_holder_enc) : null,
        monthlyGoalCents: r.monthly_goal_cents,
        createdAt: r.created_at,
      },
    });
  } catch (err) {
    console.error("[FIAON-AGENT] profile:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Telefonnummer (selbst änderbar; E-Mail/Name nur durch Admin)
router.post("/agent/profile/phone", requireAgent, async (req: AgentRequest, res) => {
  try {
    const phone = String(req.body?.phone || "").trim().slice(0, 40);
    await sqlPool`UPDATE fiaon_agents SET phone = ${phone || null} WHERE id = ${req.agent!.id}`;
    await logAgentEvent(req.agent!.id, "phone_changed", { phone });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] phone:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Profilbild: Client schneidet quadratisch zu + verkleinert auf 256px (Canvas),
// Server validiert Format + Größe (Roh-Upload-Limit 2 MB greift clientseitig).
router.post("/agent/profile/avatar", requireAgent, async (req: AgentRequest, res) => {
  try {
    const dataUrl = String(req.body?.avatar || "");
    if (dataUrl === "") {
      await sqlPool`UPDATE fiaon_agents SET avatar = NULL WHERE id = ${req.agent!.id}`;
      await logAgentEvent(req.agent!.id, "avatar_changed", { removed: true });
      return res.json({ ok: true });
    }
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
      return res.status(400).json({ ok: false, error: "Ungültiges Bildformat" });
    }
    const bytes = Math.floor((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
    if (bytes > 600 * 1024) return res.status(400).json({ ok: false, error: "Bild zu groß — bitte erneut versuchen" });
    await sqlPool`UPDATE fiaon_agents SET avatar = ${dataUrl} WHERE id = ${req.agent!.id}`;
    await logAgentEvent(req.agent!.id, "avatar_changed", { bytes });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] avatar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Passwort ändern (altes Passwort erforderlich)
router.post("/agent/profile/password", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { oldPassword, newPassword } = req.body || {};
    const rows = await sqlPool`SELECT password_hash, session_epoch FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    if (!rows[0].password_hash || !(await bcrypt.compare(String(oldPassword || ""), rows[0].password_hash))) {
      return res.status(401).json({ ok: false, error: "Aktuelles Passwort ist falsch" });
    }
    const policyErr = passwordPolicyError(String(newPassword || ""));
    if (policyErr) return res.status(400).json({ ok: false, error: policyErr });
    const hash = await bcrypt.hash(String(newPassword), 10);
    const updated = await sqlPool`
      UPDATE fiaon_agents SET password_hash = ${hash}, session_epoch = session_epoch + 1
      WHERE id = ${req.agent!.id} RETURNING session_epoch
    `;
    await logAgentEvent(req.agent!.id, "password_changed", { via: "profile" });
    // eigene Sitzung nahtlos fortsetzen (neues Cookie mit neuer Epoch)
    issueAgentCookie(res, req.agent!.id, Number(updated[0].session_epoch));
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] password change:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Auszahlungsdaten: IBAN-Prüfsumme validieren, AES-256-GCM verschlüsselt speichern,
// maskiert anzeigen; jede Änderung → Audit + Admin-Hinweis (bank_change_ack = FALSE).
router.post("/agent/profile/bank", requireAgent, async (req: AgentRequest, res) => {
  try {
    const holder = String(req.body?.holder || "").trim().slice(0, 120);
    const ibanRaw = String(req.body?.iban || "").replace(/\s+/g, "").toUpperCase();
    const bic = String(req.body?.bic || "").trim().toUpperCase().slice(0, 11);
    if (!holder) return res.status(400).json({ ok: false, error: "Kontoinhaber erforderlich" });
    if (!ibanChecksumValid(ibanRaw)) return res.status(400).json({ ok: false, error: "IBAN ungültig (Prüfsumme fehlgeschlagen)" });
    if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) return res.status(400).json({ ok: false, error: "BIC ungültig" });
    const masked = maskIban(ibanRaw);
    // Alt-IBAN (maskiert) + IP für den Betrugsschutz-Trail festhalten (ändert NICHT,
    // was der Agent sieht — nur der Admin-Audit gewinnt alt→neu + Herkunft).
    const prev = await sqlPool`SELECT bank_iban_masked FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    const oldMasked = prev[0]?.bank_iban_masked || null;
    const ip = String((req.headers["x-forwarded-for"] as string || "").split(",")[0].trim() || req.socket?.remoteAddress || "");
    await sqlPool`
      UPDATE fiaon_agents SET
        bank_holder_enc = ${encryptSecret(holder)},
        bank_iban_enc = ${encryptSecret(ibanRaw)},
        bank_bic_enc = ${bic ? encryptSecret(bic) : null},
        bank_iban_masked = ${masked},
        bank_updated_at = NOW(),
        bank_change_ack = FALSE
      WHERE id = ${req.agent!.id}
    `;
    await logAgentEvent(req.agent!.id, "bank_changed", { old_iban_masked: oldMasked, iban_masked: masked, ip });
    res.json({ ok: true, ibanMasked: masked });
  } catch (err) {
    console.error("[FIAON-AGENT] bank:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Kundenliste (NUR unbezahlte) ═══════════════

// Alle Felder mit a.-Präfix — Queries joinen fiaon_agents (Namens-Kollisionen: first_name, email, phone, created_at)
const AGENT_CUSTOMER_FIELDS = `
  a.ref, a.type, a.first_name, a.last_name, a.contact_name, a.company_name,
  COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email,
  a.phone, a.phone_country_code, a.contact_phone, a.country,
  a.pack_name, a.pack_key, a.amount_due, a.currency, a.payment_reference, a.payment_status,
  a.payment_due_date, a.claimed_paid_at, a.promised_pay_date, a.agent_email_sent_at,
  a.invoice_number, a.created_at, a.number_corrected_at
`;

router.get("/agent/customers", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    // SICHERHEITSFIX 03.08.2026: `a.assigned_agent_id = $1` ist neu.
    //
    // Vorher lieferte diese Abfrage JEDE offene Bestellung — unabhängig davon,
    // wem sie gehört. Aufgeteilt wurde erst danach im Speicher, und BEIDE
    // Hälften gingen an den Browser: `data` (eigene und herrenlose) und
    // `colleagues` (die der Kollegen, samt deren Namen). Ein Testkonto ohne
    // einen einzigen eigenen Kunden sah so 35 fremde mit Name, E-Mail, Betrag
    // und Zusagedatum.
    //
    // Das war im Modell der offenen Kartei gewollt. Mit der Zuweisung über
    // Tiering ist es ein Datenleck. Gefiltert wird jetzt in der WHERE-Bedingung,
    // nicht im Anwendungscode: Was der Server nicht lädt, kann keine Ansicht
    // versehentlich anzeigen.
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS},
        a.assigned_agent_id, a.locked_by_agent_id, a.locked_until,
        ag.name AS assigned_agent_name, lg.name AS locked_by_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      LEFT JOIN fiaon_agents lg ON lg.id = a.locked_by_agent_id
      WHERE a.merged_into IS NULL
        AND a.dismissed_at IS NULL
        AND (
          a.assigned_agent_id = $1
          -- ── LÜCKE GESCHLOSSEN (Meldung 04.08.2026) ────────────────────────
          -- Agenten fanden in „Heute" Kunden, die sie unter „Meine Kunden" nicht
          -- aufrufen konnten. Ursache: „Heute" arbeitet mit PERSONEN, diese Liste
          -- mit BESTELLUNGEN. Ist die Person dem Agenten zugewiesen, die
          -- Bestellung aber (noch) nicht, fiel sie hier heraus — gemessen 3 bis 4
          -- Fälle je Agent, also täglich.
          -- Die Zuweisung der Person ist derselbe Besitznachweis wie die der
          -- Bestellung; es werden also keine fremden Daten sichtbar.
          OR EXISTS (
            SELECT 1 FROM fiaon_persons p
            WHERE p.id = a.person_id AND p.merged_into_person_id IS NULL
              AND p.assigned_agent_id = $1
          )
        )
        AND a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
      ORDER BY (a.payment_status = 'claimed_paid') DESC, (a.payment_status = 'expired'),
               a.claimed_paid_at ASC NULLS LAST, a.created_at ASC
    `, [me]);
    const refs = rows.map((r: any) => r.ref);
    let lastLogByRef: Record<string, any> = {};
    let openAppointments: Record<string, string> = {};
    if (refs.length > 0) {
      const logs = await sqlPool`
        SELECT DISTINCT ON (ref) ref, type, outcome, note, agent_name, scheduled_at, created_at
        FROM fiaon_contact_log WHERE ref = ANY(${refs}) AND voided_at IS NULL
        ORDER BY ref, created_at DESC
      `;
      for (const l of logs) lastLogByRef[l.ref] = l;
      const appts = await sqlPool`
        SELECT DISTINCT ON (ref) ref, scheduled_at FROM fiaon_contact_log
        WHERE ref = ANY(${refs}) AND scheduled_at IS NOT NULL AND done_at IS NULL AND voided_at IS NULL AND scheduled_at > NOW() - INTERVAL '1 day'
        ORDER BY ref, scheduled_at ASC
      `;
      for (const a of appts) openAppointments[a.ref] = a.scheduled_at;
    }
    const now = Date.now();
    const enrich = (r: any) => ({
      ...r,
      // Wählbare Nummer aus derselben Regel wie in „Heute": Vorwahl und Nummer
      // werden zusammengesetzt, notfalls über das Land ergänzt. Vorher wurden
      // sie im Browser nur aneinandergehängt — fehlte die Vorwahl, entstand ein
      // Link, der nichts wählt.
      ...(() => { const t = nummerAusZeile(r); return { phoneWaehlbar: t.waehlbar, phoneAnzeige: t.anzeige, phoneHinweis: t.hinweis }; })(),
      last_contact: lastLogByRef[r.ref] || null,
      next_appointment: openAppointments[r.ref] || null,
      locked_by_name: r.locked_by_agent_id && r.locked_by_agent_id !== me && r.locked_until && new Date(r.locked_until).getTime() > now ? r.locked_by_name : null,
    });
    // `colleagues` gibt es nicht mehr. Es war der eigentliche Leckpfad: eine
    // ausdrückliche Liste der Kunden ANDERER Agenten im selben Antwortobjekt.
    // Das leere Feld bleibt erhalten, damit ältere Clients nicht auf undefined
    // laufen — gefüllt wird es nie wieder.
    res.json({ ok: true, data: rows.map(enrich), colleagues: [] });
  } catch (err) {
    console.error("[FIAON-AGENT] customers:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EIGENTUMSRIEGEL für /agent/customers/:ref — Sicherheitsfix 03.08.2026
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BEFUND: Sämtliche :ref-Endpunkte suchten die Bestellung allein über die
 * Referenz. Ein Agent konnte damit jeden offenen Kunden eines Kollegen
 * abrufen (Name, E-Mail, Adresse, Betrag, Provisionsbasis), dessen Rechnung
 * als PDF herunterladen, ihm eine Zahlungsmail schicken, Notizen schreiben
 * und sein Zahlungsdatum überschreiben.
 *
 * URSACHE: Das Modell der offenen Kartei war „ein gemeinsamer Bestand, jeder
 * sieht alles". Mit der Zuweisung über Tiering gilt das Gegenteil — die
 * Endpunkte sind aber nie nachgezogen worden.
 *
 * REGEL: Nur der zugewiesene Agent. Nicht zugewiesene Bestellungen gehören
 * NIEMANDEM und sind für Agenten unsichtbar; die Zuteilung macht der
 * Tageslauf, nicht ein Direktaufruf.
 *
 * 404 statt 403: Ein 403 bestätigt, dass die Referenz existiert. Das ist
 * schon eine Auskunft — dieselbe Regel wie in /agent/crm.
 */
// ── DIE ZWEITE DEFINITION, DIE HIER STAND (behoben 16.08.2026) ─────────────
// Diese Prüfung kannte nur EINE Regel: „assigned_agent_id ist mein" oder „die
// Person gehört mir". Das ist die Regel für die Rolle `agent` — und sie galt
// hier für ALLE.
//
// Folge, und genau das meldete der Betreiber mit „Kundendaten können nicht
// bearbeitet werden — all sowas":
//   · Die VERTRIEBSLEITUNG bekam 404 bei jedem Kunden, den sie nicht selbst
//     zugeteilt hatte — obwohl sie laut `darfAnKunde` alle sehen darf.
//   · Das FORDERUNGSMANAGEMENT bekam 404 bei jedem seiner Inkasso-Fälle. Es
//     durfte den Menschen anrufen, aber seine Telefonnummer nicht korrigieren
//     — bei einer falschen Nummer also genau nichts tun.
//   · ONBOARDING ebenso, für seine Startgespräch-Kunden.
//
// Es gab die richtige Antwort längst: `darfAnKunde` in
// server/lib/fiaon-kundenzugriff.ts kennt alle fünf Rollen. Zwei Definitionen
// derselben Frage sind schlimmer als eine fehlende — bei der fehlenden merkt
// man es sofort.
async function requireEigenerKunde(req: AgentRequest, res: Response, next: NextFunction) {
  try {
    const ref = String(req.params.ref || "");
    const [app] = await sqlPool`
      SELECT a.assigned_agent_id, a.person_id
      FROM fiaon_applications a
      WHERE a.ref = ${ref} AND a.merged_into IS NULL
      LIMIT 1
    `;
    if (!app) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    // Der direkte Besitz an der BESTELLUNG bleibt: Ein Entwurf ohne
    // `person_id` hat keine Person, über die `darfAnKunde` urteilen könnte.
    if (app.assigned_agent_id === req.agent!.id) return next();

    if (app.person_id != null) {
      const { darfAnKunde, rolleVon } = await import("../lib/fiaon-kundenzugriff");
      const rolle = await rolleVon(req.agent!.id);
      if (await darfAnKunde(req.agent!.id, rolle, Number(app.person_id))) return next();
    }
    // 404 statt 403: Ein 403 bestätigt, dass die Referenz existiert. Das ist
    // schon eine Auskunft — dieselbe Regel wie in /agent/crm.
    return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
  } catch (err) {
    console.error("[FIAON-AGENT] Eigentumsprüfung:", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
}

// ═══════════════ PAKET DA — Gesamtbestand „Meine Kunden (Alle)" ═══════════════
// Antwort auf „Kunden verschwinden": ALLE je zugewiesenen Kunden des Agents,
// unabhängig vom Zahlungsstatus (auch bezahlt/abgelaufen/ersetzt) — read-only
// für geschlossene. Die Arbeitsliste (/agent/customers) bleibt unverändert.
// WICHTIG: MUSS vor /agent/customers/:ref registriert sein (Express-Reihenfolge).
router.get("/agent/customers/all", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS},
        a.assigned_agent_id, a.completed_at, a.superseded_by
      FROM fiaon_applications a
      WHERE a.assigned_agent_id = $1 AND a.merged_into IS NULL
      ORDER BY a.updated_at DESC NULLS LAST, a.created_at DESC
      LIMIT 500
    `, [me]);
    const refs = rows.map((r: any) => r.ref);
    const lastLogByRef: Record<string, any> = {};
    if (refs.length > 0) {
      const logs = await sqlPool`
        SELECT DISTINCT ON (ref) ref, type, outcome, note, agent_name, scheduled_at, created_at
        FROM fiaon_contact_log WHERE ref = ANY(${refs}) AND voided_at IS NULL
        ORDER BY ref, created_at DESC
      `;
      for (const l of logs) lastLogByRef[l.ref] = l;
    }
    res.json({ ok: true, data: rows.map((r: any) => ({ ...r, last_contact: lastLogByRef[r.ref] || null })) });
  } catch (err) {
    console.error("[FIAON-AGENT] customers/all:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET DC — Serverseitige Suche (Kunden + Leads) ═══════════════

/** Telefonsuche: Eingabe auf signifikante Ziffern reduzieren (0049/49/0-Präfixe weg). */
export function normalizeSearchDigits(raw: string): string | null {
  let d = String(raw || "").replace(/\D/g, "");
  if (d.length < 5) return null;
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("49")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  return d.length >= 5 ? d : null;
}

/**
 * Gemeinsame Suche für Agent (eigener Bestand + unzugewiesene offene) und
 * Admin (global, agentId = null). Findet Kunden UND Leads:
 * - Telefon: normalisiert, Ziffern-Teilstring-Match (+49/0049/0 egal, Formatierung egal)
 * - Text: tokenisiert (Wortreihenfolge egal) über Vor-/Nachname, Firma, E-Mail, Referenz
 * Serverseitig mit LIMIT — kein Full-Table-Load im Client.
 */
export async function searchCustomersAndLeads(q: string, opts: { agentId?: number | null; limit?: number } = {}): Promise<{ customers: any[]; leads: any[]; mode: string }> {
  await ensureAgentTables();
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 50);
  const me = opts.agentId ?? null;
  const digits = normalizeSearchDigits(q);
  const custParams: any[] = [];
  const leadParams: any[] = [];
  let custCond: string;
  let leadCond: string;
  if (digits) {
    custParams.push(`%${digits}%`);
    custCond = `(
      regexp_replace(COALESCE(a.phone_country_code,'') || COALESCE(a.phone,''), '[^0-9]', '', 'g') LIKE $1
      OR regexp_replace(COALESCE(a.contact_phone,''), '[^0-9]', '', 'g') LIKE $1
    )`;
    leadParams.push(`%${digits}%`);
    leadCond = `regexp_replace(COALESCE(l.telefon,''), '[^0-9]', '', 'g') LIKE $1`;
  } else {
    const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
    if (tokens.length === 0) return { customers: [], leads: [], mode: "leer" };
    const cc: string[] = [];
    const lc: string[] = [];
    for (const t of tokens) {
      custParams.push(`%${t}%`);
      const p = `$${custParams.length}`;
      cc.push(`(a.first_name ILIKE ${p} OR a.last_name ILIKE ${p} OR a.contact_name ILIKE ${p} OR a.company_name ILIKE ${p} OR a.email ILIKE ${p} OR a.contact_email ILIKE ${p} OR a.ref ILIKE ${p} OR a.payment_reference ILIKE ${p})`);
      leadParams.push(`%${t}%`);
      const lp = `$${leadParams.length}`;
      lc.push(`(l.vorname ILIKE ${lp} OR l.nachname ILIKE ${lp} OR l.email ILIKE ${lp})`);
    }
    custCond = cc.join(" AND ");
    leadCond = lc.join(" AND ");
  }
  // Sichtbarkeits-Scope: Agent = eigener Bestand (ALLE Status) + unzugewiesene offene
  let custScope = "";
  let leadScope = "";
  if (me != null) {
    // Direktive „Kein Kunde verschwindet": eigener Bestand (alle Status) PLUS jede
    // unzugewiesene Bestellung (auch ABGELAUFEN) — nur echte Dubletten (superseded)
    // bleiben ausgeblendet. So bleibt z. B. eine abgelaufene, unzugewiesene Kundin
    // jederzeit über die Suche auffindbar und reaktivierbar.
    custParams.push(me);
    custScope = ` AND (a.assigned_agent_id = $${custParams.length} OR (a.assigned_agent_id IS NULL AND a.payment_status <> 'superseded'))`;
    leadParams.push(me);
    leadScope = ` AND (l.assigned_agent_id = $${leadParams.length} OR l.assigned_agent_id IS NULL)`;
  }
  custParams.push(limit);
  const customers = await sqlPool.unsafe(`
    SELECT a.ref, a.first_name, a.last_name, a.contact_name, a.company_name,
           COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS email,
           a.phone, a.phone_country_code, a.contact_phone, a.pack_name, a.amount_due,
           a.payment_reference, a.payment_status, a.created_at, a.completed_at,
           -- ══════════════════════════════════════════════════════════════════
           -- DIE ZUSTÄNDIGKEIT STEHT AN DER PERSON, NICHT AN DER BESTELLUNG
           --
           -- ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────
           -- „Zahlung eingegangen — ohne Betreuer."
           --
           -- Hier stand nur „a.assigned_agent_id". Die Bestellung trägt eine
           -- eigene Abschrift der Zuständigkeit, und die läuft auseinander:
           -- Nach einer Zusammenführung hängen die Bestellungen an der neuen
           -- Person, ihre Agentenspalte bleibt aber stehen.
           --
           -- GEMESSEN an 662 bezahlten Bestellungen: 59 haben an der Bestellung
           -- einen anderen Agenten als an der Person, und bei 36 hat NUR die
           -- Person einen. Genau diese 36 zeigten „ohne Betreuer", obwohl ein
           -- Zuständiger eingetragen war — die Anzeige hat die falsche Quelle
           -- gelesen, es fehlte niemand.
           --
           -- Die Person ist die Wahrheit (Migration 033 zieht die Bestellungen
           -- über einen Trigger nach). Die Bestellung bleibt als Rückfall
           -- stehen, damit eine Bestellung ohne Person nicht plötzlich
           -- zuständigkeitslos wird.
           -- ══════════════════════════════════════════════════════════════════
           COALESCE(p.assigned_agent_id, a.assigned_agent_id) AS assigned_agent_id,
           COALESCE(agp.name, ag.name) AS assigned_agent_name,
           -- Woher der Name kommt — damit ein Auseinanderlaufen sichtbar ist
           -- und nicht stillschweigend überdeckt wird.
           CASE WHEN p.assigned_agent_id IS NOT NULL THEN 'person'
                WHEN a.assigned_agent_id IS NOT NULL THEN 'bestellung'
                ELSE NULL END AS agent_quelle,
           -- ── PROVISION ODER WAND, ABER NIE EIN LEERES FELD ────────────────
           -- „Wenn eine Provision existiert, wird sie angezeigt; wenn die Wand
           -- griff (Selbstzahler), steht DAS da — nie ein leeres Feld."
           -- GEMESSEN: 409 bezahlte Bestellungen, 244 mit Provision, 104 als
           -- Direktzahler vermerkt, 61 ohne beides. Für die 61 sagt die Anzeige
           -- jetzt ausdrücklich, dass es keinen Vermerk gibt — eine sichtbare
           -- Lücke ist ehrlich, eine gefüllte wäre eine Behauptung.
           a.commission_basis, a.commission_basis_note,
           (SELECT SUM(k.amount_cents)::int FROM fiaon_commissions k
             WHERE k.ref = a.ref AND k.status <> 'storniert') AS provision_cents
    FROM fiaon_applications a
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents agp ON agp.id = p.assigned_agent_id
    WHERE a.merged_into IS NULL AND ${custCond}${custScope}
    ORDER BY (a.payment_status IN ('pending_payment','claimed_paid')) DESC, a.created_at DESC
    LIMIT $${custParams.length}
  `, custParams);
  let leads: any[] = [];
  try {
    leadParams.push(limit);
    leads = await sqlPool.unsafe(`
      SELECT l.id, l.vorname, l.nachname, l.email, l.telefon, l.quelle, l.status, l.erstellt_am,
             l.assigned_agent_id, ag.name AS assigned_agent_name, l.converted_order_id
      FROM fiaon_leads l
      LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
      WHERE ${leadCond}${leadScope}
      ORDER BY l.erstellt_am DESC
      LIMIT $${leadParams.length}
    `, leadParams);
  } catch { /* Lead-Tabellen ggf. noch nicht angelegt — Suche liefert dann nur Kunden */ }
  return { customers, leads, mode: digits ? "telefon" : "text" };
}

router.get("/agent/search", requireAgent, async (req: AgentRequest, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, customers: [], leads: [], mode: "leer" });
    const result = await searchCustomersAndLeads(q, { agentId: req.agent!.id });
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[FIAON-AGENT] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * G2-Guard für Aktionen: Kunde muss unbezahlt sein; ist er einem KOLLEGEN
 * zugewiesen → 403; hält ein Kollege gerade den Soft-Lock → 423.
 * Unzugewiesene Kunden werden bei der ersten Aktion automatisch geclaimt.
 */
async function claimOrGuard(ref: string, agent: { id: number; name: string }): Promise<{ error?: { code: number; msg: string }; claimed?: boolean }> {
  const rows = await sqlPool`
    SELECT ref, assigned_agent_id, locked_by_agent_id, locked_until FROM fiaon_applications
    WHERE ref = ${ref} AND payment_status IN ('pending_payment', 'claimed_paid') AND merged_into IS NULL
  `;
  if (rows.length === 0) return { error: { code: 404, msg: "Kunde nicht gefunden oder bereits bezahlt" } };
  const r = rows[0];
  if (r.assigned_agent_id && r.assigned_agent_id !== agent.id) {
    return { error: { code: 403, msg: "Dieser Kunde wird von einem Kollegen betreut (nur Lesezugriff)" } };
  }
  if (!r.assigned_agent_id && r.locked_by_agent_id && r.locked_by_agent_id !== agent.id && r.locked_until && new Date(r.locked_until) > new Date()) {
    return { error: { code: 423, msg: "Kunde ist gerade in Bearbeitung durch einen Kollegen" } };
  }
  if (!r.assigned_agent_id) {
    // Auto-Claim: atomar, nur wenn weiterhin unzugewiesen
    const claimed = await sqlPool`
      UPDATE fiaon_applications SET assigned_agent_id = ${agent.id}, locked_by_agent_id = NULL, locked_until = NULL, updated_at = NOW()
      WHERE ref = ${ref} AND assigned_agent_id IS NULL
      RETURNING ref
    `;
    if (claimed.length === 0) return { error: { code: 403, msg: "Kunde wurde soeben einem Kollegen zugewiesen" } };
    await logAction(ref, agent, "claim", { note: `Automatisch zugewiesen an ${agent.name} (erste dokumentierte Aktion)` });
    return { claimed: true };
  }
  return {};
}

// Detail: Kunde + Historie + passende Gesprächsleitfäden (I2).
// Öffnen eines UNZUGEWIESENEN Kunden setzt den 15-Min-Soft-Lock (G2).
router.get("/agent/customers/:ref", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    // Paket DA: EIGENE Kunden bleiben auch nach Bezahlung/Ablauf sichtbar (read-only) —
    // fremde/unzugewiesene Kunden weiterhin nur solange offen.
    const rows = await sqlPool.unsafe(`
      SELECT ${AGENT_CUSTOMER_FIELDS}, a.street, a.zip, a.city, a.completed_at, a.superseded_by,
        a.assigned_agent_id, a.locked_by_agent_id, a.locked_until,
        a.commission_basis, a.commission_basis_note,
        ag.name AS assigned_agent_name, lg.name AS locked_by_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      LEFT JOIN fiaon_agents lg ON lg.id = a.locked_by_agent_id
      WHERE a.ref = $1 AND a.merged_into IS NULL
        AND (a.payment_status IN ('pending_payment', 'claimed_paid')
             OR a.assigned_agent_id = $2
             OR (a.assigned_agent_id IS NULL AND a.payment_status <> 'superseded'))
    `, [req.params.ref, me]);
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const r: any = rows[0];
    const closed = !['pending_payment', 'claimed_paid'].includes(r.payment_status);
    const readOnly = !!(r.assigned_agent_id && r.assigned_agent_id !== me) || closed;
    const foreignLock = !r.assigned_agent_id && r.locked_by_agent_id && r.locked_by_agent_id !== me && r.locked_until && new Date(r.locked_until) > new Date();
    // Soft-Lock setzen/verlängern (nur wenn unzugewiesen und nicht fremd-gelockt)
    if (!r.assigned_agent_id && !foreignLock) {
      await sqlPool`
        UPDATE fiaon_applications SET locked_by_agent_id = ${me}, locked_until = NOW() + make_interval(mins => ${SOFT_LOCK_MIN})
        WHERE ref = ${req.params.ref} AND assigned_agent_id IS NULL
      `;
    }
    const log = await sqlPool`
      SELECT id, agent_id, type, outcome, note, agent_name, scheduled_at, promised_date, done_at, voided_at, created_at
      FROM fiaon_contact_log WHERE ref = ${req.params.ref}
      ORDER BY created_at DESC
    `;
    // I2: Kontext-Skripte gemäß Status→Kategorie-Mapping
    const settings = await getSettings();
    let contextScripts: any[] = [];
    try {
      const map = JSON.parse(settings.script_status_map || "{}");
      const category = map[r.payment_status];
      if (category) {
        contextScripts = await sqlPool`
          SELECT id, title, category, content_html, file_name FROM fiaon_scripts
          WHERE active = TRUE AND deleted_at IS NULL AND category = ${category}
          ORDER BY sort_order ASC, id ASC
        `;
      }
    } catch (e) {
      // Ein leeres `catch` stand hier. Die Gespraechsleitfaeden fehlten dann
      // stillschweigend in der Akte — und der Mitarbeiter hielt es fuer
      // „es gibt keine".
      console.error("[FIAON-AGENT] Skripte zur Akte nicht geladen:", e);
    }
    // Reaktivierbar: abgelaufene Bestellung, die mir gehört oder unzugewiesen ist
    // (Direktive „Kein Kunde verschwindet" — Agent kann selbst wieder aktivieren).
    const canReactivate = r.payment_status === "expired" && (!r.assigned_agent_id || r.assigned_agent_id === me);
    res.json({
      ok: true,
      data: { ...r, locked_by_name: foreignLock ? r.locked_by_name : null },
      log,
      readOnly: readOnly || !!foreignLock,
      canReactivate,
      contextScripts,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] customer detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET AC — Agent: Stammdaten korrigieren ═══════════════
// Editierbar: Vorname, Nachname, E-Mail, Telefon. NICHT editierbar (Server
// lehnt hart ab): Paket, Betrag, Zahlungsstatus, Referenz. Antwort enthält
// duplicate (Dubletten-Warnung) + loginEmailChanged (Hinweis-Dialog).
router.patch("/agent/customers/:ref/contact-data", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const result = await updateCustomerContact(req.params.ref, req.body || {}, { id: req.agent!.id, name: req.agent!.name });
    if (result.error) return res.status(result.error.code).json({ ok: false, error: result.error.msg });
    res.json({ ok: true, changes: result.changes, duplicate: result.duplicate, loginEmailChanged: result.loginEmailChanged });
  } catch (err) {
    console.error("[FIAON-AGENT] contact-data:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET DD — Verlaufseintrag als irrtümlich markieren ═══════════════
// Soft-Delete (KEIN hartes Löschen): nur EIGENE Notizen/Kontakt-Ergebnisse.
// Der Eintrag bleibt durchgestrichen sichtbar; Kalender/Zuletzt-Anzeigen
// ignorieren ihn (voided_at-Filter). Audit-Eintrag dokumentiert die Korrektur.
router.post("/agent/log/:id/void", requireAgent, async (req: AgentRequest, res) => {
  try {
    const id = Number(req.params.id);
    const rows = await sqlPool`
      UPDATE fiaon_contact_log SET voided_at = NOW(), voided_by = ${req.agent!.id}
      WHERE id = ${id} AND agent_id = ${req.agent!.id} AND voided_at IS NULL AND type IN ('note', 'result')
      RETURNING ref, type, outcome, note
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Eintrag nicht gefunden, fremd oder bereits korrigiert" });
    const label = rows[0].type === "note" ? "Notiz" : `Kontakt-Ergebnis „${rows[0].outcome || "—"}"`;
    const entry = await logAction(rows[0].ref, req.agent!, "system", {
      note: `${label} (Eintrag #${id}) als irrtümlich markiert durch ${req.agent!.name}`,
    });
    res.json({ ok: true, entry });
  } catch (err) {
    console.error("[FIAON-AGENT] log void:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Notizen + Kontakt-Ergebnisse ═══════════════

// Freitext-Notiz (append-only). Erste Aktion an unzugewiesenem Kunden = Auto-Claim (G2).
router.post("/agent/customers/:ref/notes", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const note = String(req.body?.note || "").trim();
    if (!note) return res.status(400).json({ ok: false, error: "Notiz darf nicht leer sein" });
    if (note.length > 4000) return res.status(400).json({ ok: false, error: "Notiz zu lang (max. 4000 Zeichen)" });
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    const entry = await logAction(req.params.ref, req.agent!, "note", { note });
    res.json({ ok: true, entry, claimed: guard.claimed || false });
  } catch (err) {
    console.error("[FIAON-AGENT] note:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── #15/#22: „Aus meiner Liste entfernen" für KUNDEN (kein echtes Löschen) ──
// Der Kunde verschwindet aus der Arbeitsliste/Warteschlange, bleibt aber
// vollständig in der DB (Historie erhalten), im Admin unter „Aussortiert"
// sichtbar und jederzeit zurückholbar. Berührt keine Zahlung/Provision.
const CUST_DISMISS_REASON_LABEL: Record<string, string> = {
  keine_nummer: "keine Telefonnummer",
  nummer_ungueltig: "ungültige Nummer",
  abgelehnt: "100 % abgelehnt",
  kein_interesse: "kein Interesse",
  dublette: "Dublette",
};

router.post("/agent/customers/:ref/dismiss", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const ref = req.params.ref;
    const reason = String(req.body?.reason || "").trim();
    if (!CUST_DISMISS_REASON_LABEL[reason]) {
      return res.status(400).json({ ok: false, error: "Bitte einen Grund wählen (keine Nummer, ungültige Nummer, 100 % abgelehnt, kein Interesse, Dublette)." });
    }
    // Nur eigene bzw. unzugewiesene Kunden dürfen aussortiert werden (kein Eingriff in Kollegen-Bestand).
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        dismissed_at = NOW(), dismissed_by = ${me}, dismissed_reason = ${reason},
        locked_by_agent_id = NULL, locked_until = NULL,
        -- Aussortieren beendet die aktive Akte. Fehlte bisher: Ein aussortierter
        -- Kunde blieb als „aktive Akte" stehen und sperrte die ganze Kartei.
        opened_at = NULL,
        assigned_agent_id = COALESCE(assigned_agent_id, ${me}),
        updated_at = NOW()
      WHERE ref = ${ref} AND merged_into IS NULL AND dismissed_at IS NULL
        AND (assigned_agent_id IS NULL OR assigned_agent_id = ${me})
      RETURNING ref
    `;
    if (rows.length === 0) {
      return res.status(409).json({ ok: false, error: "Kunde nicht gefunden, bereits aussortiert oder von einem Kollegen betreut." });
    }
    // ── DER ZWEITE TEIL DESSELBEN FEHLERS (Meldung 04.08.2026) ──────────────
    // „In Heute habe ich Kundenkontakte, die ich in Meine Kunden gar nicht
    // finde." Ursache: Aussortieren betraf nur die BESTELLUNG. Die PERSON blieb
    // in der Tagesliste — der Agent hatte „100 % abgelehnt" geklickt und bekam
    // den Kunden am nächsten Morgen wieder vorgelegt, ohne ihn irgendwo öffnen
    // zu können. Gemessen: 3 bis 4 solcher Fälle pro Agent.
    //
    // Jetzt zieht das Aussortieren die Person mit — je nach Grund
    // unterschiedlich, denn „abgelehnt" und „keine Nummer" sind nicht dasselbe.
    const [app] = await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref}`;
    if (app?.person_id) {
      if (reason === "abgelehnt" || reason === "kein_interesse") {
        // Ein „nein" ist ein Ergebnis. Der Kunde erscheint in keiner Anrufliste
        // mehr — dieselbe Wirkung wie „Erreicht – abgelehnt".
        await sqlPool`
          UPDATE fiaon_persons SET is_blocked = TRUE, follow_up_date = NULL, updated_at = NOW()
          WHERE id = ${app.person_id}
        `;
      } else if (reason === "keine_nummer" || reason === "nummer_ungueltig") {
        // Nicht sperren: Der Kunde will vielleicht zahlen, wir erreichen ihn nur
        // nicht. Drei Tage Ruhe, bis die Nummer-Update-Mail wirken kann.
        await sqlPool`
          UPDATE fiaon_persons SET follow_up_date = CURRENT_DATE + 3, updated_at = NOW()
          WHERE id = ${app.person_id}
        `;
      }
      // „dublette" bleibt bewusst ohne Personen-Wirkung: Das Zusammenführen
      // entscheidet, welche Person weiterlebt.
    }

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, ${me}, ${req.agent!.name}, 'system',
              ${`Aus der Arbeitsliste entfernt (Grund: ${CUST_DISMISS_REASON_LABEL[reason]}) durch ${req.agent!.name}. Wird NIE gelöscht — bleibt vollständig gespeichert und ist im Admin unter „Aussortiert" jederzeit zurückholbar.`})
    `.catch(() => {});
    console.log(`[FIAON-AGENT] Kunde aussortiert: ${ref} (${reason}) durch #${me}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] customer dismiss:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Die erlaubten Ergebnisse stehen jetzt in server/lib/fiaon-kontakt-ergebnis.ts —
// derselbe Satz, den auch die Tagesliste („Heute") verwendet. Zwei getrennte
// Listen waren der Grund, warum in „Heute" drei Ergebnisse fehlten.
const VALID_OUTCOMES = new Set<string>(ERGEBNISSE);

// Kontakt-Ergebnis (je Klick ein neuer Log-Eintrag; Termin-/Zusage-Daten optional)
router.post("/agent/customers/:ref/contact-result", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const { outcome, scheduledAt, promisedDate, note } = req.body || {};
    if (!VALID_OUTCOMES.has(outcome)) return res.status(400).json({ ok: false, error: "Ungültiges Kontakt-Ergebnis" });
    // ── DIE NOTIZPFLICHT STEHT IM SERVER, NICHT IN DER OBERFLÄCHE ─────────
    // Sie stand in Softphone.tsx und kunden-neu.tsx, aber NICHT im Listen-Weg
    // (kunden.tsx) — und in keinem Fall im Server. Eine Pflicht, die drei
    // Oberflächen einzeln kennen müssen, wird an der vierten vergessen.
    const notizFehler = pruefeNotiz(String(outcome), note);
    if (notizFehler) return res.status(400).json({ ok: false, error: notizFehler });
    if (outcome === "rueckruf_termin" && !scheduledAt) return res.status(400).json({ ok: false, error: "Termin-Datum erforderlich" });
    if (outcome === "erreicht_zahlt_am" && !promisedDate) return res.status(400).json({ ok: false, error: "Zusage-Datum erforderlich" });
    // Ein Rueckruf ist eine Wiedervorlage. Ein Termin in der Vergangenheit kann
    // nie faellig werden und verschwindet lautlos. Gemessener Fall: am 27.07.
    // gespeichert, Termin stand auf dem 12.07. — 15 Tage zurueck, unbemerkt.
    const terminFehler = pruefeTerminZukunft(outcome, scheduledAt);
    if (terminFehler) return res.status(400).json({ ok: false, error: terminFehler });
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });

    const entry = await logAction(req.params.ref, req.agent!, "result", {
      outcome,
      note: note ? String(note).slice(0, 4000) : null,
      scheduledAt: scheduledAt || null,
      promisedDate: promisedDate || null,
    });

    // ── DER GEMELDETE FEHLER (04.08.2026) ──────────────────────────────────
    // Vorher wurde hier NUR `fiaon_applications.promised_pay_date` gesetzt. Die
    // Tagesliste „Heute" filtert aber auf `fiaon_persons` (follow_up_date,
    // promised_payment_date, is_blocked). Ein Ergebnis aus „Meine Kunden" hatte
    // deshalb null Wirkung auf „Heute": Der Kunde stand am nächsten Morgen
    // wieder da. Gemessen: 890 solcher Ergebnisse in 14 Tagen.
    //
    // Jetzt läuft beides über EINE Funktion — dieselbe, die „Heute" benutzt.
    const wirkung = await ergebnisAnwenden({
      ref: req.params.ref,
      ergebnis: outcome,
      zusageDatum: promisedDate || null,
      terminDatum: scheduledAt || null,
    });

    // #23: „Falsche Nummer" → optionale Selbst-Update-Mail (nur wenn E-Mail da,
    // max. 1×/Tag). Fire-and-forget; blockiert das Kontakt-Ergebnis nie.
    let numberUpdateMail: { sent: boolean; reason?: string } | undefined;
    if (outcome === "nummer_falsch") {
      const [c] = await sqlPool`
        SELECT COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email,
               COALESCE(first_name, contact_name) AS first_name
        FROM fiaon_applications WHERE ref = ${req.params.ref}
      `;
      const { maybeSendNumberUpdateMail } = await import("../fiaon-number-update");
      numberUpdateMail = await maybeSendNumberUpdateMail("app", req.params.ref, { email: c?.email, firstName: c?.first_name });
    }

    // ── DER BUG: Das dokumentierte Ergebnis SCHLIESST die aktive Akte. ──
    // Im Lead-Pfad stand das seit jeher, im Kunden-Pfad fehlte es. Die Kartei
    // umfasst aber BEIDE Kartenarten — also blieb der Agent nach jedem
    // Kunden-Kontakt haengen („Du hast eine Akte in Bearbeitung"), obwohl das
    // Ergebnis sauber im Verlauf stand. Gemessen an FIAON-MS245V2U-XJVT:
    // zwei Ergebnisse um 21:32 und 21:34, Akte trotzdem noch aktiv.
    // Nur `opened_at` wird genullt — die ZUWEISUNG bleibt beim Agenten,
    // Beziehung und Provisionsanspruch sind unberuehrt.
    await sqlPool`
      UPDATE fiaon_applications SET opened_at = NULL, updated_at = NOW()
      WHERE ref = ${req.params.ref}
    `;

    res.json({
      ok: true, entry, claimed: guard.claimed || false, akteClosed: true, numberUpdateMail,
      // Damit der Agent SIEHT, was sein Klick bewirkt hat — vorher blieb offen,
      // wann der Kunde wieder auf der Liste erscheint.
      wirkung,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] contact-result:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── „Akte ohne Ergebnis schliessen" fuer KUNDEN ──────────────────────────────
// Gab es bisher nur fuer Leads. Der Agent darf sich nie ausgesperrt fuehlen:
// Kurze Begruendung Pflicht, alles im Verlauf. Zaehlt NICHT als Betreuung —
// es wird KEIN 'result' geschrieben und `letzter_kontakt_am` bleibt unberuehrt,
// damit kein Provisionsanspruch aus einem Abbruch entsteht.
router.post("/agent/customers/:ref/close-akte", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const ref = req.params.ref;
    const reason = String(req.body?.reason || "").trim();
    if (reason.length < 3) {
      return res.status(400).json({ ok: false, error: "Bitte kurz begründen (z. B. „Feierabend“, „Kunde legte auf“)." });
    }
    const rows = await sqlPool`
      UPDATE fiaon_applications SET opened_at = NULL, updated_at = NOW()
      WHERE ref = ${ref} AND opened_by_agent_id = ${me} AND opened_at IS NOT NULL
      RETURNING ref
    `;
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: "Keine offene Akte von dir unter dieser Referenz." });
    }
    await logAction(ref, req.agent!, "system", {
      note: `Akte ohne Kontakt-Ergebnis geschlossen durch ${req.agent!.name}. Begründung: ${reason.slice(0, 500)}. Zählt nicht als Betreuung.`,
    }).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] close-akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── ADMIN-NOTAUSGANG fuer Kunden-Akten ───────────────────────────────────────
// Pendant zu /admin/leads/:id/release-akte. Fehlte, wodurch eine blockierte
// Kunden-Akte (z. B. Agent im Urlaub) nur direkt in der Datenbank loesbar war.
router.post("/admin/customers/:ref/release-akte", async (req: Request, res: Response) => {
  try {
    const ref = req.params.ref;
    const rows = await sqlPool`
      UPDATE fiaon_applications a SET opened_at = NULL, updated_at = NOW()
      FROM fiaon_agents ag
      WHERE a.ref = ${ref} AND a.opened_at IS NOT NULL AND ag.id = a.opened_by_agent_id
      RETURNING a.ref, ag.name AS agent_name
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Keine offene Akte unter dieser Referenz." });
    await logAction(ref, { id: null as any, name: "Admin" }, "system", {
      note: `Akte durch Admin freigegeben (war offen bei ${rows[0].agent_name}). Die Zuweisung bleibt bestehen.`,
    }).catch(() => {});
    res.json({ ok: true, releasedFrom: rows[0].agent_name });
  } catch (err) {
    console.error("[FIAON-AGENT] admin release-akte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Ein-Klick-Mail „Wie soeben besprochen" ═══════════════
// KEINE Direkt-Mail — feuert Make-Webhook `agent_payment_reminder`.

router.post("/agent/customers/:ref/send-payment-email", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const guard = await claimOrGuard(req.params.ref, req.agent!);
    if (guard.error) return res.status(guard.error.code).json({ ok: false, error: guard.error.msg });
    // Paket AD2 (doppelter Boden): keine Agent-Mail an E-Mail-Adressen mit
    // bezahlter Schwester-Bestellung — außer der Admin hat den Zweitkauf-Override gesetzt.
    const paidSister = await sqlPool`
      SELECT p.ref FROM fiaon_applications c
      JOIN fiaon_applications p ON LOWER(TRIM(p.email)) = LOWER(TRIM(c.email)) AND p.ref != c.ref
      WHERE c.ref = ${req.params.ref} AND c.allow_reminders_despite_paid = FALSE
        AND c.email IS NOT NULL AND TRIM(c.email) != ''
        AND p.payment_status = 'paid'
      LIMIT 1
    `;
    if (paidSister.length > 0) {
      return res.status(409).json({ ok: false, error: "Kunde hat bereits eine bezahlte Bestellung (Dublette) — keine Zahlungs-Mail. Admin kann in der Detailansicht einen echten Zweitkauf freigeben." });
    }
    // Doppelklick-/Spam-Schutz: 10-Minuten-Sperre pro Kunde (atomarer Claim)
    // last_reminder_at: kanalübergreifende 20h-Dedupe (Paket V) — die Agent-Mail
    // zählt wie Engine/Bulk als Erinnerung, damit der Kunde nicht doppelt am Tag hört.
    const claimed = await sqlPool`
      UPDATE fiaon_applications SET agent_email_sent_at = NOW(), last_reminder_at = NOW()
      WHERE ref = ${req.params.ref}
        AND payment_status IN ('pending_payment', 'claimed_paid')
        AND (agent_email_sent_at IS NULL OR agent_email_sent_at < NOW() - INTERVAL '10 minutes')
      RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email,
                pack_name, payment_reference, amount_due, agent_email_sent_at
    `;
    if (claimed.length === 0) {
      const row = await sqlPool`SELECT agent_email_sent_at FROM fiaon_applications WHERE ref = ${req.params.ref}`;
      const lockedUntil = row[0]?.agent_email_sent_at
        ? new Date(new Date(row[0].agent_email_sent_at).getTime() + EMAIL_LOCK_MS).toISOString()
        : null;
      return res.status(429).json({ ok: false, error: "E-Mail wurde vor Kurzem gesendet (10-Minuten-Sperre)", lockedUntil });
    }

    // ══════════════════════════════════════════════════════════════════════
    // DIE ADRESSE KANN AN DER PERSON STEHEN, NICHT AN DER BESTELLUNG
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Bei mehreren Datensätzen ist keine E-Mail-Adresse hinterlegt.
    // Selbst wenn ich die E-Mail im aktuellen Datensatz manuell eintrage und
    // speichere, funktioniert der Versand der Zahlungsdaten anschließend nicht."
    //
    // Gemessen an Maik Matzke: `fiaon_applications.email` ist LEER,
    // `fiaon_persons.primary_email` gefüllt. Diese Route las nur die
    // Bestellzeile — `makePayloadFromRow` setzte `email: ""`, und die Mail ging
    // mit leerem Empfänger an Make. Dort verschwand sie lautlos.
    //
    // Der Agent hat also alles richtig gemacht und trotzdem verloren.
    //
    // ── WARUM DIE PERSON DER BESSERE ORT IST ──────────────────────────────
    // Eine Bestellung ist ein Vorgang, eine Person ein Mensch. Wer seine
    // Adresse ändert, ändert sie am Menschen — nicht an einem alten Vorgang.
    // `mailSenden` in fiaon-mail-senden.ts macht es seit Wochen richtig
    // (COALESCE über Person, dann Bestellung); nur diese Route wich ab.
    // ══════════════════════════════════════════════════════════════════════
    const [personMail] = (await sqlPool`
      SELECT NULLIF(TRIM(COALESCE(p.primary_email, '')), '') AS email
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.ref = ${req.params.ref}
    `) as any[];

    const roh = makePayloadFromRow(claimed[0]);
    const empfaenger = roh.email || personMail?.email || "";

    // ── OHNE ADRESSE WIRD NICHTS VERSCHICKT, UND ES WIRD GESAGT ───────────
    // Vorher ging die Anfrage mit leerem `email` raus und der Agent bekam
    // „ok". Eine Rückmeldung, die Erfolg meldet, ohne dass etwas passiert,
    // ist schlimmer als ein Fehler.
    //
    // Die Sperre wird zurückgenommen: Wer nichts verschickt hat, soll es nach
    // dem Nachtragen der Adresse gleich versuchen dürfen, nicht erst in zehn
    // Minuten.
    if (!empfaenger) {
      await sqlPool`
        UPDATE fiaon_applications SET agent_email_sent_at = NULL WHERE ref = ${req.params.ref}
      `.catch(() => {});
      return res.status(400).json({
        ok: false,
        error: "Bei diesem Kunden ist keine E-Mail-Adresse hinterlegt — weder an der "
          + "Bestellung noch am Kundendatensatz. Trage sie in der Kundenakte ein, oder "
          + "gib die Bankdaten mit dem Verwendungszweck am Telefon durch.",
      });
    }

    const payload = {
      ...roh,
      email: empfaenger,
      agent_name: req.agent!.name,
      invoice_url: claimed[0].payment_reference ? signInvoiceUrl(claimed[0].payment_reference) : null,
    };
    // ══════════════════════════════════════════════════════════════════════
    // HIER WURDE ERFOLG GEMELDET, OHNE ZU WISSEN, OB ETWAS RAUSGING
    //
    // ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ───────────────────────
    // „Es erscheint keine Fehlermeldung und es ist nicht ersichtlich, ob die
    // Rechnung bzw. Zahlungsdaten tatsächlich versendet wurden. Teilweise
    // kommt beim Kunden offenbar auch keine E-Mail an."
    //
    // ── WAS HIER STAND ───────────────────────────────────────────────────
    //     sendMakeWebhook("agent_payment_reminder", payload).catch(() => {});
    //     res.json({ ok: true, … });
    //
    // Zwei Fehler in einer Zeile: Der Aufruf wurde NICHT abgewartet, und sein
    // Fehler wurde verworfen. Danach ging in JEDEM Fall ein „ok: true" an die
    // Oberfläche — auch wenn Make nie geantwortet hat. Der Agent sah eine
    // Bestätigung, der Kunde bekam nichts, und im Verlauf stand „ausgelöst".
    //
    // Jetzt: abwarten, den Grund übernehmen, und den Ausgang benennen.
    // ══════════════════════════════════════════════════════════════════════
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const versand = await sendMakeWebhookMitGrund("agent_payment_reminder", payload as any);
    await logAction(req.params.ref, req.agent!, "email_sent", {
      note: versand.ok
        ? `Zahlungsdaten-Mail an ${empfaenger} verschickt (agent_payment_reminder)`
        : `Zahlungsdaten-Mail an ${empfaenger} FEHLGESCHLAGEN: ${versand.grund}`,
    });

    if (!versand.ok) {
      // 502: Nicht wir haben falsch gefragt, die Gegenseite hat nicht geliefert
      // (AGENTS.md: „Statuscodes nach VERURSACHER trennen").
      return res.status(502).json({
        ok: false,
        error: `Die Mail ging nicht raus: ${versand.grund}. `
          + "Der Vorgang steht im Verlauf — du kannst die Bankdaten am Telefon durchgeben.",
      });
    }
    res.json({
      ok: true, empfaenger,
      lockedUntil: new Date(Date.now() + EMAIL_LOCK_MS).toISOString(),
    });
  } catch (err) {
    console.error("[FIAON-AGENT] send-payment-email:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Abgelaufenen Kunden reaktivieren ═══════════════
// Geschäftsleitungs-Direktive: Kunden werden NIE deaktiviert. „Abgelaufen" ist nur
// ein Zahlungsfenster-Zustand. Nach einem erfolgreichen Anruf/Abschluss kann der
// Agent den Kunden selbst reaktivieren (neue 7-Tage-Frist) — unzugewiesene werden
// ihm dabei zugeordnet (er hat gerade den Abschluss gemacht). Löst Ticket #10/#12.
router.post("/agent/customers/:ref/reactivate", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const ref = req.params.ref;
    const [app] = await sqlPool`
      SELECT ref, assigned_agent_id, payment_status FROM fiaon_applications
      WHERE ref = ${ref} AND merged_into IS NULL
    `;
    if (!app) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (app.assigned_agent_id && app.assigned_agent_id !== me) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von einem Kollegen betreut" });
    }
    if (app.payment_status === "paid") {
      return res.status(400).json({ ok: false, error: "Kunde hat bereits bezahlt — keine Reaktivierung nötig" });
    }
    if (app.payment_status !== "expired") {
      return res.status(400).json({ ok: false, error: "Nur abgelaufene Bestellungen können reaktiviert werden" });
    }
    const antrag = await import("./fiaon-antrag");
    const data = await antrag.reactivateOrderByRef(ref, { assignAgentId: me });
    if (!data) return res.status(400).json({ ok: false, error: "Reaktivierung fehlgeschlagen" });
    await logAction(ref, req.agent!, "reactivate", {
      note: "Reaktiviert nach Kontakt/Zusage — neue 7-Tage-Zahlungsfrist, Zahlungsdaten erneut gesendet",
    });
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[FIAON-AGENT] reactivate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Rechnung (Download) ═══════════════

router.get("/agent/customers/:ref/invoice.pdf", requireAgent, requireEigenerKunde, async (req: AgentRequest, res) => {
  try {
    // Paket DA: auch für geschlossene/bezahlte Bestellungen abrufbar (read-only Detail)
    const rows = await sqlPool`
      SELECT * FROM fiaon_applications
      WHERE ref = ${req.params.ref} AND merged_into IS NULL
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    let row = rows[0];
    if (!row.invoice_number) {
      await ensureInvoiceNumber(sqlPool, row.ref);
      row = (await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${req.params.ref}`)[0];
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${row.invoice_number || "FIAON-Rechnung"}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);
    renderInvoicePdf(doc, row);
    doc.end();
  } catch (err) {
    console.error("[FIAON-AGENT] invoice:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Verdienst (G4) ═══════════════

router.get("/agent/earnings", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const agentRow = await sqlPool`SELECT commission_rate_bp, monthly_goal_cents FROM fiaon_agents WHERE id = ${me}`;
    const rateBp = agentRateBp(agentRow[0] as any, settings);
    // Potenziell (Anzeige, kein Anspruch): zugewiesene, noch unbezahlte Kunden × Satz
    const potential = await sqlPool`
      SELECT COALESCE(SUM(ROUND(ROUND(COALESCE(amount_due::numeric,0) * 100) * ${rateBp} / 10000.0)),0) AS s, COUNT(*) AS c
      FROM fiaon_applications
      WHERE assigned_agent_id = ${me} AND payment_status IN ('pending_payment','claimed_paid') AND merged_into IS NULL
    `;
    const sums = await sqlPool`
      SELECT status, COALESCE(SUM(amount_cents),0) AS s, COUNT(*) AS c
      FROM fiaon_commissions WHERE agent_id = ${me} GROUP BY status
    `;
    const byStatus: Record<string, { sum: number; count: number }> = {};
    for (const r of sums) byStatus[r.status] = { sum: Number(r.s), count: Number(r.c) };
    // Monatsziel-Fortschritt: nicht-stornierte Einträge dieses Kalendermonats
    const month = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND status != 'storniert' AND created_at >= date_trunc('month', NOW())
    `;
    const entries = await sqlPool`
      SELECT c.id, c.ref, c.payment_reference, c.pack_name, c.base_amount_cents, c.rate_bp, c.amount_cents,
             c.status, c.note, c.created_at, c.kind,
             a.first_name, a.last_name, a.contact_name, a.company_name
      FROM fiaon_commissions c
      LEFT JOIN fiaon_applications a ON a.ref = c.ref
      WHERE c.agent_id = ${me} ORDER BY c.created_at DESC LIMIT 50
    `;
    // Paket AE2: Team-Umsatzbeteiligung getrennt ausweisen (fließt ins selbe Guthaben)
    const overrides = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s, COUNT(*) FILTER (WHERE amount_cents > 0) AS c
      FROM fiaon_commissions WHERE agent_id = ${me} AND kind = 'override' AND status != 'storniert'
    `;
    res.json({
      ok: true,
      rateBp,
      potentialCents: Number(potential[0].s),
      potentialCount: Number(potential[0].c),
      confirmedCents: byStatus.bestaetigt?.sum || 0,
      inPayoutCents: byStatus.in_auszahlung?.sum || 0,
      paidOutCents: byStatus.ausgezahlt?.sum || 0,
      monthCents: Number(month[0].s),
      monthlyGoalCents: agentRow[0].monthly_goal_cents,
      overrideCents: Number(overrides[0].s),
      overrideCount: Number(overrides[0].c),
      entries,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] earnings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Auszahlung (H1) ═══════════════
// Der Antrag erzeugt AUSSCHLIESSLICH eine Anforderung — NIEMALS eine Transaktion.

router.get("/agent/payouts", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const balance = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND status = 'bestaetigt'
    `;
    const bank = await sqlPool`SELECT bank_iban_masked FROM fiaon_agents WHERE id = ${me}`;
    const history = await sqlPool`
      SELECT id, amount_cents, status, iban_masked, reject_reason, requested_at, processed_at
      FROM fiaon_payouts WHERE agent_id = ${me} ORDER BY requested_at DESC LIMIT 50
    `;
    res.json({
      ok: true,
      balanceCents: Number(balance[0].s),
      minCents: Number(settings.payout_min_cents),
      hasBank: !!bank[0]?.bank_iban_masked,
      ibanMasked: bank[0]?.bank_iban_masked || null,
      history,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] payouts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/payouts/request", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const minCents = Number(settings.payout_min_cents);
    const agentRows = await sqlPool`SELECT bank_holder_enc, bank_iban_enc, bank_bic_enc, bank_iban_masked FROM fiaon_agents WHERE id = ${me}`;
    if (!agentRows[0]?.bank_iban_enc) return res.status(400).json({ ok: false, error: "Bitte zuerst Auszahlungsdaten (IBAN) im Profil hinterlegen" });
    // Nur EINE offene Anforderung gleichzeitig
    const open = await sqlPool`SELECT id FROM fiaon_payouts WHERE agent_id = ${me} AND status = 'angefordert'`;
    if (open.length > 0) return res.status(409).json({ ok: false, error: "Es läuft bereits eine Auszahlungs-Anforderung" });
    // IMMER volles verfügbares Guthaben (keine Teilbeträge)
    const rows = await sqlPool`SELECT id, amount_cents FROM fiaon_commissions WHERE agent_id = ${me} AND status = 'bestaetigt'`;
    const total = rows.reduce((s: number, r: any) => s + Number(r.amount_cents), 0);
    if (total < minCents) return res.status(400).json({ ok: false, error: `Mindestbetrag ${(minCents / 100).toFixed(2)} € nicht erreicht` });
    const payout = await sqlPool`
      INSERT INTO fiaon_payouts (agent_id, amount_cents, bank_holder_enc, bank_iban_enc, bank_bic_enc, iban_masked)
      VALUES (${me}, ${total}, ${agentRows[0].bank_holder_enc}, ${agentRows[0].bank_iban_enc}, ${agentRows[0].bank_bic_enc}, ${agentRows[0].bank_iban_masked})
      RETURNING id, amount_cents, requested_at
    `;
    await sqlPool`
      UPDATE fiaon_commissions SET status = 'in_auszahlung', payout_id = ${payout[0].id}, updated_at = NOW()
      WHERE agent_id = ${me} AND status = 'bestaetigt'
    `;
    await logAgentEvent(me, "payout_requested", { payout_id: payout[0].id, amount_cents: total });
    console.log(`[FIAON-PAYOUT] Anforderung #${payout[0].id}: Agent ${me}, ${(total / 100).toFixed(2)} €`);
    res.json({ ok: true, payout: payout[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] payout request:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET AE3/AE4 — Partner-Programm (Agent-Seite) ═══════════════

router.get("/agent/partner-program", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const settings = await getSettings();
    const thresholds = partnerThresholds(settings);
    let prizes: Record<string, { title: string; description?: string }> = {};
    try { prizes = JSON.parse(settings.partner_prizes || "{}"); } catch { /* leer */ }

    const revenue = await ownRevenueCents(me);
    const status = partnerStatusFor(revenue, thresholds);
    const next = thresholds.find((t) => revenue < t.minCents) || null;

    const milestones = await sqlPool`
      SELECT milestone_key, achieved_at, prize_status FROM fiaon_partner_milestones WHERE agent_id = ${me} ORDER BY achieved_at ASC
    `;

    // „Mein Team“: geworbene Agents — anonym aggregiert (Anzahl, Abschlüsse, Umsatz),
    // plus eigene Team-Umsatzbeteiligung. EXAKT eine Ebene (AE2).
    const team = await sqlPool`
      SELECT COUNT(*)::int AS members FROM fiaon_agents WHERE recruited_by = ${me} AND active = TRUE
    `;
    const teamRevenue = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE c.amount_cents > 0)::int AS deals,
             COALESCE(SUM(CASE WHEN c.amount_cents > 0 THEN c.base_amount_cents ELSE -c.base_amount_cents END),0) AS revenue
      FROM fiaon_commissions c
      JOIN fiaon_agents a ON a.id = c.agent_id
      WHERE a.recruited_by = ${me} AND c.kind = 'own' AND c.status != 'storniert'
    `;
    const myOverride = await sqlPool`
      SELECT COALESCE(SUM(amount_cents),0) AS s FROM fiaon_commissions
      WHERE agent_id = ${me} AND kind = 'override' AND status != 'storniert'
    `;

    const suggestions = await sqlPool`
      SELECT id, first_name, last_name, status, created_at, decided_at FROM fiaon_partner_suggestions
      WHERE agent_id = ${me} ORDER BY created_at DESC LIMIT 20
    `;

    res.json({
      ok: true,
      status,
      revenueCents: revenue,
      next: next ? { key: next.key, label: next.label, minCents: next.minCents, bonusBp: next.bonusBp, remainingCents: next.minCents - revenue } : null,
      thresholds: thresholds.map((t) => ({ ...t, prize: prizes[t.key] || null })),
      milestones,
      team: {
        members: Number(team[0].members),
        deals: Number(teamRevenue[0].deals),
        revenueCents: Math.max(0, Number(teamRevenue[0].revenue)),
        overrideCents: Number(myOverride[0].s),
      },
      suggestions,
    });
  } catch (err) {
    console.error("[FIAON-AGENT] partner-program:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Paket AE4: „Partner vorschlagen“ — erzeugt AUSSCHLIESSLICH eine Admin-Anfrage.
// BEWUSSTE DESIGN-ENTSCHEIDUNG: Es gibt KEINE Prämie/Bonus für das Vorschlagen
// selbst — der Werber profitiert ausschließlich über den umsatzbasierten
// Override (AE2), sobald der Geworbene tatsächlich verkauft.
router.post("/agent/partner-suggestions", requireAgent, async (req: AgentRequest, res) => {
  try {
    const { firstName, lastName, email, phone, reason } = req.body || {};
    if (!firstName || !lastName || !email) return res.status(400).json({ ok: false, error: "Vorname, Nachname und E-Mail erforderlich" });
    if (!EMAIL_RE.test(String(email).trim().toLowerCase())) return res.status(400).json({ ok: false, error: "E-Mail-Format ungültig" });
    const phoneNorm = phone ? normalizePhone(String(phone)) : "";
    if (phoneNorm === null) return res.status(400).json({ ok: false, error: "Telefonnummer ungültig" });
    // Doppelte offene Vorschläge für dieselbe E-Mail vermeiden
    const open = await sqlPool`
      SELECT id FROM fiaon_partner_suggestions WHERE LOWER(email) = ${String(email).trim().toLowerCase()} AND status = 'offen'
    `;
    if (open.length > 0) return res.status(409).json({ ok: false, error: "Für diese E-Mail liegt bereits ein offener Vorschlag vor" });
    const rows = await sqlPool`
      INSERT INTO fiaon_partner_suggestions (agent_id, first_name, last_name, email, phone, reason)
      VALUES (${req.agent!.id}, ${String(firstName).trim()}, ${String(lastName).trim()},
              ${String(email).trim().toLowerCase()}, ${phoneNorm || null}, ${reason ? String(reason).trim().slice(0, 2000) : null})
      RETURNING id, created_at
    `;
    await logAgentEvent(req.agent!.id, "partner_suggested", { suggestion_id: rows[0].id, email: String(email).trim().toLowerCase() });
    console.log(`[FIAON-PARTNER] Vorschlag #${rows[0].id} von Agent ${req.agent!.id}`);
    res.json({ ok: true, suggestion: rows[0] });
  } catch (err) {
    console.error("[FIAON-AGENT] partner-suggestion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Skripte (I2) ═══════════════

router.get("/agent/scripts", requireAgent, async (_req: AgentRequest, res) => {
  try {
    await ensureAgentTables();
    const scripts = await sqlPool`
      SELECT id, title, category, content_html, file_name, file_mime, updated_at
      FROM fiaon_scripts WHERE active = TRUE AND deleted_at IS NULL
      ORDER BY category ASC, sort_order ASC, id ASC
    `;
    const settings = await getSettings();
    res.json({ ok: true, data: scripts, statusMap: JSON.parse(settings.script_status_map || "{}") });
  } catch (err) {
    console.error("[FIAON-AGENT] scripts:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/scripts/:id/file", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      SELECT file_data, file_name, file_mime FROM fiaon_scripts
      WHERE id = ${Number(req.params.id)} AND active = TRUE AND deleted_at IS NULL
    `;
    if (rows.length === 0 || !rows[0].file_data) return res.status(404).json({ ok: false, error: "Datei nicht gefunden" });
    const buf = Buffer.from(rows[0].file_data, "base64");
    res.setHeader("Content-Type", rows[0].file_mime || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${(rows[0].file_name || "skript.pdf").replace(/[^\w.\-]/g, "_")}"`);
    res.send(buf);
  } catch (err) {
    console.error("[FIAON-AGENT] script file:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: Kalender (J1) ═══════════════

router.get("/agent/calendar", requireAgent, async (req: AgentRequest, res) => {
  try {
    const me = req.agent!.id;
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date(Date.now() + 28 * 24 * 3600 * 1000);
    // Eigene Rückruf-Termine + Zahlungs-Zusagen; Überfälliges (bis 14 Tage) bleibt sichtbar
    const rows = await sqlPool`
      SELECT l.id, l.ref, l.outcome, l.scheduled_at, l.promised_date, l.done_at, l.note, l.created_at,
             a.first_name, a.last_name, a.contact_name, a.company_name, a.payment_status, a.payment_reference,
             a.phone, a.phone_country_code, a.contact_phone
      FROM fiaon_contact_log l
      JOIN fiaon_applications a ON a.ref = l.ref
      WHERE l.agent_id = ${me} AND l.done_at IS NULL AND l.voided_at IS NULL
        AND (
          (l.scheduled_at IS NOT NULL AND l.scheduled_at BETWEEN ${from} AND ${to})
          OR (l.promised_date IS NOT NULL AND l.scheduled_at IS NULL AND l.promised_date BETWEEN ${from} AND ${to})
        )
      ORDER BY COALESCE(l.scheduled_at, l.promised_date) ASC
    `;

    // ══════════════════════════════════════════════════════════════════════
    // DIE VOM KUNDEN SELBST GEBUCHTEN TERMINE
    //
    // ── DER ANLASS ────────────────────────────────────────────────────────
    // Der Vorgesetzte: „Wenn er dann den Termin bucht, hat der Agent einen
    // Kalendereintrag!"
    //
    // Hatte er nicht. Diese Route las AUSSCHLIESSLICH `fiaon_contact_log` —
    // also nur, was ein Agent selbst eingetragen hat. Die Termine, die ein
    // Kunde über seinen Buchungslink selbst wählt, stehen in `fiaon_termine`
    // und tauchten im Agenten-Kalender NICHT auf.
    //
    // Die Wirkung war die schlimmste Art von Lücke: Der Kunde bekam eine
    // Bestätigung mit Uhrzeit, hielt sie ein — und der Agent wusste nichts
    // davon. Ein Termin, von dem nur eine Seite weiß, ist kein Termin.
    //
    // Bewusst eine ZWEITE Abfrage und kein UNION: Die beiden Quellen haben
    // verschiedene Schlüssel (`fiaon_contact_log.id` gegen
    // `fiaon_termine.id`), und ein UNION über zwei Zahlenräume erzeugt
    // doppelte Kennungen. Der Client unterscheidet über `quelle`.
    // ══════════════════════════════════════════════════════════════════════
    const gebucht = await sqlPool`
      SELECT t.id, t.person_id, t.beginn AS scheduled_at, t.dauer_min, t.status,
             t.quelle AS buchungsquelle, t.storno_token,
             t.abgesagt_am, t.abgesagt_von, t.erledigt_am,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = t.person_id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS ref,
             p.first_name, p.last_name, p.company_name, p.contact_name,
             p.primary_phone AS phone, p.primary_email
      FROM fiaon_termine t
      JOIN fiaon_persons p ON p.id = t.person_id
      WHERE t.agent_id = ${me}
        -- ══════════════════════════════════════════════════════════════════
        -- ABGESAGTE TERMINE VERSCHWINDEN NICHT MEHR
        --
        -- Hier stand „status = 'gebucht'". Sagte ein Kunde ab, war der Termin
        -- im selben Augenblick aus jeder Ansicht verschwunden — der
        -- Zuständige erfuhr es nie und saß zur vereinbarten Zeit da.
        -- GEMESSEN: 10 abgesagte Termine, keiner davon je jemandem gemeldet.
        --
        -- Sieben Tage sichtbar, dann ist die Absage Geschichte.
        --
        -- ── „VERPASST" IST ZWEI ZUSTÄNDE, NICHT EINER (30.08.2026) ────────
        -- Hier stand „t.status IN ('gebucht', 'verpasst')" mit der Begründung:
        -- „Ein Termin, den der Kunde platzen ließ, ist Arbeit, nicht
        -- Vergangenheit." Das ist richtig — aber nur, solange die Arbeit noch
        -- nicht getan ist.
        --
        -- Das Team meldete: „Nicht erschienen — bitte abschließen hängt."
        -- GEMESSEN: 47 Termine auf „verpasst", davon 19 mit gesetztem
        -- erledigt_am. Genau diese 19 waren ABGEARBEITET und standen trotzdem
        -- weiter da, mit einer Aufforderung, die niemand erfüllen konnte:
        -- Ein weiterer Klick auf „Nicht erschienen" schrieb denselben Zustand
        -- noch einmal, die Karte verschwand kurz und kam beim nächsten Laden
        -- zurück. Bei Lucas Böhnert lagen 26 solche Karten.
        --
        -- Die Unterscheidung steckt in erledigt_am:
        --   · erledigt_am IS NULL  → der 12-Stunden-Nachlauf
        --     (runVerpassteTermine in fiaon-startgespraech.ts) hat den Termin
        --     als verpasst markiert. Ein Mensch hat ihn NICHT bearbeitet, die
        --     Folge-Einladung ist nicht gelaufen. Das ist offene Arbeit — die
        --     Karte bleibt, und der Klick erledigt sie.
        --   · erledigt_am IS NOT NULL → ein Mensch hat geklickt, der
        --     Fehlversuch ist gezählt und die Folge-Einladung ist gelaufen.
        --     Fertig. Die Karte geht.
        -- ══════════════════════════════════════════════════════════════════
        AND (
          t.status = 'gebucht'
          OR (t.status = 'verpasst' AND t.erledigt_am IS NULL)
          OR (t.status = 'abgesagt' AND t.abgesagt_am > NOW() - INTERVAL '7 days')
        )
        AND t.beginn BETWEEN ${from} AND ${to}
        AND p.merged_into_person_id IS NULL
      ORDER BY t.beginn ASC
    `;

    res.json({
      ok: true,
      data: (rows as any[]).map((r) => ({
        ...r,
        // ── DER EINDEUTIGE SCHLÜSSEL ──────────────────────────────────────
        // Beide Tabellen zählen ihre Kennungen ab 1 hoch. GEMESSEN: 101
        // Termine tragen eine Kennung, die auch ein Verlaufseintrag trägt —
        // bei 33 davon gehört der Verlaufseintrag einem ANDEREN Menschen.
        // Ein Klick auf den Haken hätte den Rückruf eines fremden Kunden
        // erledigt. Deshalb reist die Herkunft ab jetzt MIT der Kennung.
        art: "verlauf",
        schluessel: `verlauf:${r.id}`,
        // ── DIE TERMIN-ART (30.08.2026) ──────────────────────────────────
        // `art` ist hier schon belegt (Herkunft: Verlauf oder Termin) und
        // bleibt es — sie steckt in `schluessel` und entscheidet, welche Route
        // der Haken anspricht. Die ART DES GESPRÄCHS kommt als eigenes Feld
        // daneben. Ein Verlaufseintrag ist immer ein selbst notierter Rückruf.
        terminArt: terminArtRueckruf().art,
        terminArtText: terminArtRueckruf().text,
        terminArtTon: terminArtRueckruf().ton,
        terminArtErklaerung: terminArtRueckruf().erklaerung,
      })),
      // Getrennt geliefert, damit der Client sie eigens kennzeichnen kann:
      // Ein Termin, den der KUNDE gewählt hat, ist verbindlicher als eine
      // Notiz, die der Agent sich selbst gemacht hat.
      gebuchteTermine: (gebucht as any[]).map((t) => ({
        ...t,
        outcome: "kunde_hat_gebucht",
        quelle: "termin",
        art: "termin",
        schluessel: `termin:${t.id}`,
        // Die Art kommt aus der ECHTEN Quelle (buchungsquelle), nicht aus dem
        // Wort „termin" darüber: Ein Startgespräch und ein Beratungsgespräch
        // sind beide „vom Kunden gebucht" und trotzdem zwei Gespräche.
        terminArt: terminArtAusQuelle(t.buchungsquelle).art,
        terminArtText: terminArtAusQuelle(t.buchungsquelle).text,
        terminArtTon: terminArtAusQuelle(t.buchungsquelle).ton,
        terminArtErklaerung: terminArtAusQuelle(t.buchungsquelle).erklaerung,
        abgesagt: t.status === "abgesagt",
        // Der Klartext, der auf der Karte steht — an einer Stelle formuliert.
        absageText: t.status === "abgesagt" && t.abgesagt_am
          ? `Abgesagt am ${new Date(t.abgesagt_am).toLocaleString("de-DE", {
              timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })} Uhr${t.abgesagt_von === "kunde" ? " durch den Kunden" : t.abgesagt_von ? ` durch ${t.abgesagt_von}` : ""}`
          : null,
      })),
    });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Termin erledigen (aus Kalender) — erzeugt Log-Eintrag
router.post("/agent/calendar/:logId/done", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`
      UPDATE fiaon_contact_log SET done_at = NOW()
      WHERE id = ${Number(req.params.logId)} AND agent_id = ${req.agent!.id} AND done_at IS NULL
      RETURNING ref, scheduled_at, promised_date
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Termin nicht gefunden" });
    await logAction(rows[0].ref, req.agent!, "note", { note: "Termin als erledigt markiert" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar done:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Termin verschieben — erzeugt Log-Eintrag, Reminder wird erneut fällig
router.post("/agent/calendar/:logId/reschedule", requireAgent, async (req: AgentRequest, res) => {
  try {
    const newAt = parseBerlinInput(req.body?.scheduledAt);
    if (!newAt || isNaN(newAt.getTime())) return res.status(400).json({ ok: false, error: "Neuer Zeitpunkt erforderlich" });
    const rows = await sqlPool`
      UPDATE fiaon_contact_log SET scheduled_at = ${newAt}, promised_date = CASE WHEN scheduled_at IS NULL THEN ${newAt} ELSE promised_date END, reminder_sent_at = NULL
      WHERE id = ${Number(req.params.logId)} AND agent_id = ${req.agent!.id} AND done_at IS NULL
      RETURNING ref
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Termin nicht gefunden" });
    await logAction(rows[0].ref, req.agent!, "note", { note: `Termin verschoben auf ${formatBerlin(newAt)}` });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-AGENT] calendar reschedule:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
