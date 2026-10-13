// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Zugang, Sitzungen, TAN, Zahlungsaufträge (E-227 → E-228)
//
// 23.09.2026, E-227: Justin will Florentine prüfen, bevor sie die
// Geschäftsleitung übernimmt. Gebaut wurde bewusst die ECHTE Fassung — kein
// erfundener Kontostand, keine Bestätigungen für Zahlungen, die es nicht gibt.
// Florentine arbeitet mit dem echten Geld des Hauses; Justin gibt frei.
//
// 23.09.2026 abends, E-228: „Das ist das FIAON Banking. Das muss EXTREM sicher
// aussehen — Bank System eben. Den Kontostand kann ich bewegen, nicht
// Florentine." Daraus in dieser Datei:
//
//   · SITZUNGEN sind jetzt Datensätze, nicht nur ein signiertes Cookie. Damit
//     gibt es eine Abmeldung nach Untätigkeit (serverseitig 15 Minuten, die
//     Oberfläche meldet nach 10 ab), eine Höchstdauer, eine Liste aktiver
//     Sitzungen mit Gerät und Adresse — und einen Knopf, der sie beendet.
//   · TAN wie bei einer Bank: Freigaben und jede Bewegung des Kontostands
//     brauchen eine 6-stellige TAN per Mail. Die TAN ist an GENAU diesen
//     Vorgang gebunden (Betrag, Empfänger, Datum) — eine TAN für 50 € gibt
//     keine 5.000 € frei.
//   · DER KONTOSTAND gehört dem Inhaber. Anfangsbestand, Einlage, Eingang,
//     Ausgabe, Korrektur und Bankabgleich darf nur Justin setzen.
//   · EINZELZEICHNUNG: Justin kann eigene Aufträge mit seiner TAN selbst
//     freigeben — er ist der Inhaber und hält den Bankzugang. Florentines
//     Aufträge brauchen IMMER seine Freigabe. Die Regel „Wer anlegt, gibt nie
//     selbst frei" gilt weiter für jeden außer dem Inhaber.
//   · AUSZAHLUNGEN AN MITARBEITER laufen als Zahlungsauftrag. Wird die
//     Überweisung bestätigt, passiert exakt dasselbe wie mit „Als überwiesen
//     markieren" in /admin/payouts — über dieselbe Funktion
//     (auszahlungUeberwiesen), nicht über eine zweite Kopie.
//   · EMPFÄNGER-KARTEI: Wer einmal bezahlt wurde, steht beim nächsten Tippen
//     als Vorschlag da — samt IBAN und BIC. Mitarbeiter mit hinterlegter
//     Bankverbindung ebenso.
//
// Was sich NICHT geändert hat: Das Buch behauptet keinen Bankstand, den es
// nicht kennt (siehe server/lib/fiaon-banking.ts), und kein Papier entsteht
// für Geld, das sich nicht bewegt hat.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, createHash, timingSafeEqual, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { sqlPool } from "./db-pool";

// ── Wer hier arbeiten darf ──────────────────────────────────────────────────
// Bewusst eine feste, kurze Liste im Quelltext: Wer Zugriff auf das Geld des
// Hauses bekommt, wird nicht über eine Oberfläche eingeladen.
export type BuchRolle = "inhaber" | "buchhaltung";

export interface BuchPerson {
  email: string;
  name: string;
  rolle: BuchRolle;
  titel: string;
}

export const BUCH_LEUTE: readonly BuchPerson[] = [
  { email: "js@fiaon.com", name: "Justin Schwarzott", rolle: "inhaber", titel: "Inhaber" },
  { email: "florentine@fiaon.com", name: "Florentine Lombardi", rolle: "buchhaltung", titel: "Geschäftsführerin" },
] as const;

/** Die gemeinsame Anmeldeadresse — erster Faktor, sagt noch nicht, wer kommt. */
export const BUCH_LOGIN = "accounting@fiaon.com";

/** Das Postfach, aus dem PIN, TAN und Hinweise kommen. */
const ABSENDER = "js@fiaon.com";

export function buchPerson(email: string): BuchPerson | null {
  const e = String(email || "").trim().toLowerCase();
  return BUCH_LEUTE.find((p) => p.email === e) ?? null;
}

export const inhaber = (): BuchPerson => BUCH_LEUTE.find((p) => p.rolle === "inhaber")!;

// ── Schlüssel in fiaon_settings ─────────────────────────────────────────────
const KEY_PASSWORT = "buchhaltung_passwort_hash";
const KEY_ANFANG = "buchhaltung_anfangsbestand";     // JSON Anfangsbestand
const KEY_ABGLEICH = "buchhaltung_bankabgleich";     // JSON Bankabgleich
const KEY_UEBERGABE = "buchhaltung_uebergabe";       // JSON Uebergabe
const KEY_SPERRE = "buchhaltung_sperre";             // JSON string[] gesperrter Adressen

async function einstellung<T>(key: string): Promise<T | null> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch((e: unknown) => {
    console.warn(`[BANKING] Einstellung ${key}:`, String(e).slice(0, 120));
    return [] as any[];
  })) as any[];
  if (!r?.value) return null;
  try { return JSON.parse(String(r.value)) as T; } catch { return null; }
}

async function einstellungSetzen(key: string, wert: unknown): Promise<void> {
  const v = typeof wert === "string" ? wert : JSON.stringify(wert);
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${v}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${v}, updated_at = NOW()`;
}

// ── Schema ──────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function buchSchema(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_bewegung (
          id BIGSERIAL PRIMARY KEY,
          art VARCHAR NOT NULL,
          richtung SMALLINT NOT NULL,
          betrag_cents BIGINT NOT NULL,
          wert_am DATE NOT NULL,
          zweck TEXT NOT NULL,
          gegenpartei TEXT,
          beleg TEXT,
          auftrag_id BIGINT,
          erfasst_von TEXT NOT NULL,
          erfasst_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          storniert_am TIMESTAMPTZ,
          storniert_von TEXT,
          storno_grund TEXT
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_bewegung_am_idx ON fiaon_buch_bewegung (wert_am DESC, id DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_auftrag (
          id BIGSERIAL PRIMARY KEY,
          nummer VARCHAR UNIQUE,
          empfaenger TEXT NOT NULL,
          iban TEXT NOT NULL,
          bic TEXT,
          betrag_cents BIGINT NOT NULL,
          zweck TEXT NOT NULL,
          kategorie TEXT,
          faellig_am DATE,
          beleg_name TEXT,
          beleg_base64 TEXT,
          status VARCHAR NOT NULL DEFAULT 'entwurf',
          erstellt_von TEXT NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          eingereicht_am TIMESTAMPTZ,
          entschieden_von TEXT,
          entschieden_am TIMESTAMPTZ,
          entscheidung_notiz TEXT,
          ausgefuehrt_von TEXT,
          ausgefuehrt_am TIMESTAMPTZ,
          bank_referenz TEXT,
          bestaetigung_base64 TEXT,
          bestaetigung_hash TEXT
        )`;
      // E-228: Auszahlungsbezug und die Art der Freigabe (vier Augen oder Einzelzeichnung).
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS payout_id INTEGER`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS freigabe_art VARCHAR`;
      // 13.10.2026 (Auszahlung über die Buchhaltung): Florentine gibt mit TAN frei, die Buchhaltung führt per SEPA aus
      // und bestätigt über einen eigenen Link — erst dann wird ausgebucht.
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS ausfuehrung_extern TEXT`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS freigabe_mail_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS extern_token_hash TEXT`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS extern_gesendet_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS extern_bestaetigt_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS extern_wert_am DATE`;
      await sqlPool`ALTER TABLE fiaon_buch_auftrag ADD COLUMN IF NOT EXISTS extern_notiz TEXT`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_auftrag_extern_idx ON fiaon_buch_auftrag (extern_token_hash) WHERE extern_token_hash IS NOT NULL`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_auftrag_status_idx ON fiaon_buch_auftrag (status, id DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_auftrag_payout_idx ON fiaon_buch_auftrag (payout_id)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_pin (
          id BIGSERIAL PRIMARY KEY,
          person TEXT NOT NULL,
          pin_hash TEXT NOT NULL,
          gueltig_bis TIMESTAMPTZ NOT NULL,
          benutzt_am TIMESTAMPTZ,
          versuche SMALLINT NOT NULL DEFAULT 0,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_log (
          id BIGSERIAL PRIMARY KEY,
          person TEXT,
          aktion TEXT NOT NULL,
          ziel TEXT,
          notiz TEXT,
          zeit TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_log_zeit_idx ON fiaon_buch_log (zeit DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_sitzung (
          sid TEXT PRIMARY KEY,
          person TEXT NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zuletzt_aktiv TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          ip TEXT,
          geraet TEXT,
          beendet_am TIMESTAMPTZ,
          beendet_grund TEXT
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_sitzung_person_idx ON fiaon_buch_sitzung (person, erstellt_am DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_tan (
          id BIGSERIAL PRIMARY KEY,
          person TEXT NOT NULL,
          zweck TEXT NOT NULL,
          ziel TEXT NOT NULL,
          tan_hash TEXT NOT NULL,
          gueltig_bis TIMESTAMPTZ NOT NULL,
          benutzt_am TIMESTAMPTZ,
          versuche SMALLINT NOT NULL DEFAULT 0,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_empfaenger (
          id BIGSERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          iban TEXT NOT NULL,
          bic TEXT,
          kategorie TEXT,
          notiz TEXT,
          erstellt_von TEXT NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          zuletzt_genutzt TIMESTAMPTZ,
          geloescht_am TIMESTAMPTZ
        )`;
      await sqlPool`
        CREATE UNIQUE INDEX IF NOT EXISTS fiaon_buch_empfaenger_iban_uq
          ON fiaon_buch_empfaenger (iban) WHERE geloescht_am IS NULL`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_buch_dauerauftrag (
          id BIGSERIAL PRIMARY KEY,
          empfaenger TEXT NOT NULL,
          iban TEXT NOT NULL,
          bic TEXT,
          betrag_cents BIGINT NOT NULL,
          zweck TEXT NOT NULL,
          kategorie TEXT,
          tag_im_monat SMALLINT NOT NULL,
          naechste_am DATE NOT NULL,
          erstellt_von TEXT NOT NULL,
          erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          beendet_am TIMESTAMPTZ,
          beendet_von TEXT,
          letzter_auftrag_id BIGINT
        )`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Protokoll. Feuert und vergisst — ein Protokollfehler darf nie eine Buchung kippen. */
export function buchProtokoll(person: string | null, aktion: string, ziel?: string | null, notiz?: string | null): void {
  void (async () => {
    try {
      await buchSchema();
      await sqlPool`INSERT INTO fiaon_buch_log (person, aktion, ziel, notiz) VALUES (${person}, ${aktion}, ${ziel ?? null}, ${notiz ?? null})`;
    } catch (e) { console.warn("[BANKING] Protokoll:", String(e).slice(0, 140)); }
  })();
}

// ── Mitteilungen ────────────────────────────────────────────────────────────
/**
 * Eine kurze Mail an eine Person des Bankings. Feuert und vergisst — eine
 * Freigabe darf nie daran scheitern, dass eine Benachrichtigung hängt.
 */
export function benachrichtigen(an: string, betreff: string, zeilen: string[]): void {
  void (async () => {
    try {
      const { mailNeuSenden, gmailBereit } = await import("./fiaon-gmail");
      if (!gmailBereit()) { console.warn("[BANKING] Hinweis nicht versendbar — GOOGLE_SA_KEY fehlt"); return; }
      await mailNeuSenden(ABSENDER, an, betreff, [...zeilen, "", "FIAON Banking · https://fiaon.com/buchhaltung"].join("\n"));
    } catch (e) { console.warn("[BANKING] Hinweis an", an, String(e).slice(0, 140)); }
  })();
}

const geldText = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

// ═══════════════════════════════════════════════════════════════════════════
// ANMELDUNG — erster Faktor Passwort, zweiter Faktor PIN
// ═══════════════════════════════════════════════════════════════════════════
function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-buchhaltung-secret";
}

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Prüft das gemeinsame Passwort. Kein Hash hinterlegt = Tür zu, nicht Tür offen. */
export async function buchPasswortStimmt(passwort: string): Promise<boolean> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${KEY_PASSWORT}`.catch(() => [] as any[])) as any[];
  const h = String(r?.value || "");
  if (!h) return false;
  return bcrypt.compare(String(passwort || ""), h).catch(() => false);
}

export async function buchPasswortSetzen(passwort: string): Promise<void> {
  await einstellungSetzen(KEY_PASSWORT, await bcrypt.hash(String(passwort), 12));
}

export async function buchPasswortGesetzt(): Promise<boolean> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${KEY_PASSWORT}`.catch(() => [] as any[])) as any[];
  return !!String(r?.value || "");
}

// ── Zugang sperren (Inhaber) ────────────────────────────────────────────────
export async function gesperrte(): Promise<string[]> {
  return (await einstellung<string[]>(KEY_SPERRE)) ?? [];
}

export async function istGesperrt(email: string): Promise<boolean> {
  return (await gesperrte()).includes(String(email).toLowerCase());
}

export async function sperreSetzen(email: string, gesperrt: boolean, von: BuchPerson): Promise<void> {
  const e = String(email).toLowerCase();
  const alt = await gesperrte();
  const neu = gesperrt ? Array.from(new Set([...alt, e])) : alt.filter((x) => x !== e);
  await einstellungSetzen(KEY_SPERRE, neu);
  if (gesperrt) await sitzungenBeenden(e, null, "Zugang gesperrt");
  buchProtokoll(von.email, gesperrt ? "Zugang gesperrt" : "Zugang entsperrt", e, null);
}

// ── PIN ─────────────────────────────────────────────────────────────────────
/**
 * Zwölf Stellen, gut vorlesbar: Großbuchstaben und Ziffern ohne die Paare,
 * die man am Telefon verwechselt (0/O, 1/I/L, 8/B, 5/S, 2/Z).
 */
const PIN_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
const PIN_TTL_S = 10 * 60;
const PIN_VERSUCHE = 5;

export function pinErzeugen(): string {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += PIN_ALPHABET[bytes[i] % PIN_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

const pinHash = (pin: string) => createHash("sha256").update(`${secret()}:${pin.replace(/-/g, "").toUpperCase()}`).digest("hex");

// ── Bankreferenz (E-229, 23.09.2026) ────────────────────────────────────────
// Justin trägt die Referenz von Hand bei Airwallex ein. Sie muss je Überweisung
// eindeutig und variabel sein, damit der Rücklauf im Konto sauber zuzuordnen
// ist. 14 Zeichen aus dem gleichen unverwechselbaren Alphabet wie der PIN
// (ohne O/0, I/1, B/8, S/5 …) — kein Feld mehr zum Tippen.
const REF_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
export function bankReferenzErzeugen(): string {
  const bytes = randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) out += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return out;
}
/** Eine Referenz, die es im Buch noch nicht gibt. */
async function freieBankReferenz(): Promise<string> {
  for (let versuch = 0; versuch < 6; versuch++) {
    const ref = bankReferenzErzeugen();
    const [da] = (await sqlPool`SELECT 1 FROM fiaon_buch_auftrag WHERE bank_referenz = ${ref} LIMIT 1`) as any[];
    if (!da) return ref;
  }
  return `${bankReferenzErzeugen().slice(0, 8)}${Date.now().toString(36).toUpperCase().slice(-6)}`.slice(0, 14);
}

/** Legt einen frischen PIN an und macht alle älteren derselben Person ungültig. */
export async function pinAnlegen(person: BuchPerson): Promise<string> {
  await buchSchema();
  const pin = pinErzeugen();
  await sqlPool`UPDATE fiaon_buch_pin SET benutzt_am = NOW() WHERE person = ${person.email} AND benutzt_am IS NULL`;
  await sqlPool`
    INSERT INTO fiaon_buch_pin (person, pin_hash, gueltig_bis)
    VALUES (${person.email}, ${pinHash(pin)}, NOW() + ${`${PIN_TTL_S} seconds`}::interval)`;
  return pin;
}

export type PinErgebnis = { ok: true } | { ok: false; grund: string };

export async function pinPruefen(person: BuchPerson, pin: string): Promise<PinErgebnis> {
  await buchSchema();
  const [r] = (await sqlPool`
    SELECT id, pin_hash, versuche FROM fiaon_buch_pin
    WHERE person = ${person.email} AND benutzt_am IS NULL AND gueltig_bis > NOW()
    ORDER BY id DESC LIMIT 1`) as any[];
  if (!r) return { ok: false, grund: "Der PIN ist abgelaufen. Bitte einen neuen anfordern." };
  if (Number(r.versuche) >= PIN_VERSUCHE) {
    await sqlPool`UPDATE fiaon_buch_pin SET benutzt_am = NOW() WHERE id = ${r.id}`;
    return { ok: false, grund: "Zu viele Fehlversuche. Bitte einen neuen PIN anfordern." };
  }
  const sauber = String(pin || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (sauber.length !== 12 || !gleich(String(r.pin_hash), pinHash(sauber))) {
    await sqlPool`UPDATE fiaon_buch_pin SET versuche = versuche + 1 WHERE id = ${r.id}`;
    return { ok: false, grund: "PIN falsch." };
  }
  await sqlPool`UPDATE fiaon_buch_pin SET benutzt_am = NOW() WHERE id = ${r.id}`;
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// SITZUNGEN
//
// Das Cookie trägt nur eine Sitzungsnummer mit Unterschrift. Ob die Sitzung
// gilt, entscheidet die Tabelle: nicht beendet, zuletzt aktiv vor weniger als
// 15 Minuten, nicht älter als 8 Stunden, Person nicht gesperrt. Dadurch lässt
// sich eine Sitzung von außen beenden — mit einem signierten Ablaufdatum im
// Cookie allein ginge das nicht.
// ═══════════════════════════════════════════════════════════════════════════
export const BUCH_COOKIE = "fiaon_buch";
export const LEERLAUF_MIN = 15;
export const HOECHSTDAUER_H = 8;

const sidSig = (sid: string) => createHmac("sha256", secret()).update(`buchsitzung:${sid}`).digest("hex").slice(0, 40);

export interface Sitzung { sid: string; person: BuchPerson }

function geraetBeschreiben(ua: string): string {
  const s = String(ua || "");
  const browser = /Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "Browser";
  const system = /iPhone|iPad/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Mac OS X/.test(s) ? "macOS" : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "unbekannt";
  return `${browser} auf ${system}`;
}

export function clientIp(req: Request): string {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || "unbekannt";
}

export async function sitzungAnlegen(person: BuchPerson, req: Request): Promise<string> {
  await buchSchema();
  const sid = randomUUID();
  await sqlPool`
    INSERT INTO fiaon_buch_sitzung (sid, person, ip, geraet)
    VALUES (${sid}, ${person.email}, ${clientIp(req)}, ${geraetBeschreiben(String(req.headers["user-agent"] || ""))})`;
  return `${sid}.${sidSig(sid)}`;
}

/** Liest und prüft die Sitzung. Verlängert sie (höchstens alle 30 s ein Schreibzugriff). */
export async function sitzungPruefen(req: Request): Promise<Sitzung | null> {
  const token = (req as any).cookies?.[BUCH_COOKIE];
  if (typeof token !== "string") return null;
  const [sid, sig] = token.split(".");
  if (!sid || !sig || !gleich(sig, sidSig(sid))) return null;
  await buchSchema();
  const [r] = (await sqlPool`
    SELECT person, erstellt_am, zuletzt_aktiv, beendet_am FROM fiaon_buch_sitzung WHERE sid = ${sid}`) as any[];
  if (!r || r.beendet_am) return null;
  const jetzt = Date.now();
  if (jetzt - new Date(r.zuletzt_aktiv).getTime() > LEERLAUF_MIN * 60_000) {
    await sqlPool`UPDATE fiaon_buch_sitzung SET beendet_am = NOW(), beendet_grund = 'Untätigkeit' WHERE sid = ${sid} AND beendet_am IS NULL`;
    return null;
  }
  if (jetzt - new Date(r.erstellt_am).getTime() > HOECHSTDAUER_H * 3_600_000) {
    await sqlPool`UPDATE fiaon_buch_sitzung SET beendet_am = NOW(), beendet_grund = 'Höchstdauer' WHERE sid = ${sid} AND beendet_am IS NULL`;
    return null;
  }
  const person = buchPerson(String(r.person));
  if (!person) return null;
  if (await istGesperrt(person.email)) return null;
  if (jetzt - new Date(r.zuletzt_aktiv).getTime() > 30_000) {
    await sqlPool`UPDATE fiaon_buch_sitzung SET zuletzt_aktiv = NOW() WHERE sid = ${sid}`;
  }
  return { sid, person };
}

export async function sitzungBeenden(sid: string, grund: string): Promise<void> {
  await buchSchema();
  await sqlPool`UPDATE fiaon_buch_sitzung SET beendet_am = NOW(), beendet_grund = ${grund} WHERE sid = ${sid} AND beendet_am IS NULL`;
}

/** Beendet alle Sitzungen einer Person — außer der genannten (oder alle, wenn null). */
export async function sitzungenBeenden(email: string, ausser: string | null, grund: string): Promise<number> {
  await buchSchema();
  const rows = (await sqlPool`
    UPDATE fiaon_buch_sitzung SET beendet_am = NOW(), beendet_grund = ${grund}
     WHERE person = ${email} AND beendet_am IS NULL AND (${ausser}::text IS NULL OR sid <> ${ausser})
    RETURNING sid`) as any[];
  return rows.length;
}

export interface SitzungZeile {
  sid: string; person: string; name: string; erstelltAm: string; zuletztAktiv: string;
  ip: string; geraet: string; aktiv: boolean; beendetAm: string | null; beendetGrund: string | null; diese: boolean;
}

/** Sitzungen der letzten 30 Tage. Der Inhaber sieht alle, die Buchhaltung nur die eigenen. */
export async function sitzungenListe(ich: Sitzung): Promise<SitzungZeile[]> {
  await buchSchema();
  const rows = (ich.person.rolle === "inhaber"
    ? await sqlPool`SELECT * FROM fiaon_buch_sitzung WHERE erstellt_am > NOW() - INTERVAL '30 days' ORDER BY erstellt_am DESC LIMIT 60`
    : await sqlPool`SELECT * FROM fiaon_buch_sitzung WHERE person = ${ich.person.email} AND erstellt_am > NOW() - INTERVAL '30 days' ORDER BY erstellt_am DESC LIMIT 30`) as any[];
  const grenze = Date.now() - LEERLAUF_MIN * 60_000;
  return rows.map((r) => ({
    sid: String(r.sid).slice(0, 8),
    person: String(r.person),
    name: buchPerson(String(r.person))?.name ?? String(r.person),
    erstelltAm: new Date(r.erstellt_am).toISOString(),
    zuletztAktiv: new Date(r.zuletzt_aktiv).toISOString(),
    // Adressen nur gekürzt — wer mehr braucht, schaut ins Server-Log.
    ip: String(r.ip || "").replace(/(\d+)\.(\d+)\.\d+\.\d+/, "$1.$2.•.•").replace(/^([0-9a-f]+:[0-9a-f]+):.*$/i, "$1:…"),
    geraet: String(r.geraet || ""),
    aktiv: !r.beendet_am && new Date(r.zuletzt_aktiv).getTime() > grenze,
    beendetAm: r.beendet_am ? new Date(r.beendet_am).toISOString() : null,
    beendetGrund: r.beendet_grund ?? null,
    diese: String(r.sid) === ich.sid,
  }));
}

/** Die vorletzte Anmeldung einer Person — für „Letzte Anmeldung" wie bei einer Bank. */
export async function letzteAnmeldung(email: string, ausser: string): Promise<{ am: string; geraet: string } | null> {
  await buchSchema();
  const [r] = (await sqlPool`
    SELECT erstellt_am, geraet FROM fiaon_buch_sitzung
     WHERE person = ${email} AND sid <> ${ausser}
     ORDER BY erstellt_am DESC LIMIT 1`) as any[];
  return r ? { am: new Date(r.erstellt_am).toISOString(), geraet: String(r.geraet || "") } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// TAN — an genau einen Vorgang gebunden
//
// Die TAN wird für einen ZWECK („freigabe", „kasse", „sperre") und ein ZIEL
// erzeugt, das den Vorgang vollständig beschreibt (z. B. „auftrag:12:123456").
// Die Mail nennt den Vorgang im Klartext. Wer eine TAN für einen anderen
// Vorgang benutzt, bekommt „TAN passt nicht zu diesem Vorgang".
// ═══════════════════════════════════════════════════════════════════════════
const TAN_TTL_S = 5 * 60;
const TAN_VERSUCHE = 3;
const tanHash = (tan: string, ziel: string) =>
  createHash("sha256").update(`${secret()}:tan:${ziel}:${String(tan).replace(/\D/g, "")}`).digest("hex");

/** Legt eine TAN an (frühere offene TANs desselben Zwecks verfallen) und gibt sie im Klartext zurück — nur für die Mail. */
async function tanErzeugen(person: BuchPerson, zweck: string, ziel: string, ttlS: number): Promise<string> {
  await buchSchema();
  const tan = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  await sqlPool`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE person = ${person.email} AND zweck = ${zweck} AND benutzt_am IS NULL`;
  await sqlPool`
    INSERT INTO fiaon_buch_tan (person, zweck, ziel, tan_hash, gueltig_bis)
    VALUES (${person.email}, ${zweck}, ${ziel}, ${tanHash(tan, ziel)}, NOW() + ${`${ttlS} seconds`}::interval)`;
  return tan;
}

export async function tanAnfordern(person: BuchPerson, zweck: string, ziel: string, beschreibung: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  const tan = await tanErzeugen(person, zweck, ziel, TAN_TTL_S);
  try {
    const { mailNeuSenden, gmailBereit } = await import("./fiaon-gmail");
    if (!gmailBereit()) return { ok: false, grund: "Der TAN-Versand ist gerade nicht möglich (Mailzugang fehlt)." };
    await mailNeuSenden(ABSENDER, person.email, `TAN ${tan.slice(0, 3)} ${tan.slice(3)} · FIAON Banking`, [
      `Hallo ${person.name.split(" ")[0]},`,
      "",
      "deine TAN für diesen Vorgang:",
      "",
      `    ${beschreibung}`,
      "",
      `    TAN: ${tan.slice(0, 3)} ${tan.slice(3)}`,
      "",
      "Sie gilt 5 Minuten und nur für genau diesen Vorgang.",
      "Stimmt der Vorgang nicht mit dem überein, was du gerade tun wolltest: TAN nicht eingeben.",
      "",
      "FIAON Banking",
    ].join("\n"));
  } catch (e) {
    console.error("[BANKING] TAN-Versand:", String(e).slice(0, 160));
    return { ok: false, grund: "Die TAN konnte nicht versendet werden." };
  }
  buchProtokoll(person.email, "TAN angefordert", ziel, beschreibung);
  return { ok: true };
}

export async function tanPruefen(person: BuchPerson, zweck: string, ziel: string, tan: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  await buchSchema();
  const [r] = (await sqlPool`
    SELECT id, ziel, tan_hash, versuche FROM fiaon_buch_tan
     WHERE person = ${person.email} AND zweck = ${zweck} AND benutzt_am IS NULL AND gueltig_bis > NOW()
     ORDER BY id DESC LIMIT 1`) as any[];
  if (!r) return { ok: false, grund: "Keine gültige TAN. Bitte eine neue anfordern." };
  if (String(r.ziel) !== ziel) return { ok: false, grund: "Diese TAN gehört zu einem anderen Vorgang. Bitte eine neue anfordern." };
  if (Number(r.versuche) >= TAN_VERSUCHE) {
    await sqlPool`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE id = ${r.id}`;
    return { ok: false, grund: "Zu viele Fehlversuche. Bitte eine neue TAN anfordern." };
  }
  const sauber = String(tan || "").replace(/\D/g, "");
  if (sauber.length !== 6 || !gleich(String(r.tan_hash), tanHash(sauber, ziel))) {
    await sqlPool`UPDATE fiaon_buch_tan SET versuche = versuche + 1 WHERE id = ${r.id}`;
    return { ok: false, grund: "TAN falsch." };
  }
  await sqlPool`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE id = ${r.id}`;
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// KASSE — gehört dem Inhaber
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Der Anfangsbestand ist der ENDSTAND eines Tages: „Am Ende des 22.09. standen
 * X € auf dem Konto." Gezählt wird ab dem Folgetag. So gibt es keine doppelt
 * gezählten Eingänge des Stichtags — bei „Stand jetzt" wäre das nicht sauber
 * zu trennen, weil die Bank Eingänge nur mit Datum, nicht mit Uhrzeit liefert.
 */
export interface Anfangsbestand { cents: number; am: string; notiz: string; von: string }
/** Der Bankabgleich ist ebenfalls ein Tagesendstand — verglichen wird mit dem Buch am selben Tag. */
export interface Bankabgleich { cents: number; am: string; von: string; erfasst: string }
export interface Uebergabe { bisher: string; stichtag: string; bestaetigtVon?: string; bestaetigtAm?: string }

export const anfangsbestand = () => einstellung<Anfangsbestand>(KEY_ANFANG);
export const bankabgleich = () => einstellung<Bankabgleich>(KEY_ABGLEICH);
export const uebergabe = () => einstellung<Uebergabe>(KEY_UEBERGABE);

export async function anfangsbestandSetzen(a: Anfangsbestand): Promise<void> { await einstellungSetzen(KEY_ANFANG, a); }
export async function bankabgleichSetzen(b: Bankabgleich): Promise<void> { await einstellungSetzen(KEY_ABGLEICH, b); }
export async function uebergabeSetzen(u: Uebergabe): Promise<void> { await einstellungSetzen(KEY_UEBERGABE, u); }

// ── Bewegungen von Hand ─────────────────────────────────────────────────────
export type BewegungArt = "einlage" | "eingang" | "ausgabe" | "korrektur";
export const BEWEGUNG_ARTEN: readonly BewegungArt[] = ["einlage", "eingang", "ausgabe", "korrektur"];

export interface BewegungEingabe {
  art: BewegungArt;
  /** Bei „korrektur" mit Vorzeichen, sonst positiv. */
  betragCents: number;
  wertAm: string;
  zweck: string;
  gegenpartei?: string | null;
  beleg?: string | null;
}

export async function bewegungBuchen(ein: BewegungEingabe, von: BuchPerson): Promise<number> {
  await buchSchema();
  const richtung = ein.art === "ausgabe" ? -1 : ein.art === "korrektur" ? (ein.betragCents < 0 ? -1 : 1) : 1;
  const [r] = (await sqlPool`
    INSERT INTO fiaon_buch_bewegung (art, richtung, betrag_cents, wert_am, zweck, gegenpartei, beleg, erfasst_von)
    VALUES (${ein.art}, ${richtung}, ${Math.abs(ein.betragCents)}, ${ein.wertAm}, ${ein.zweck},
            ${ein.gegenpartei ?? null}, ${ein.beleg ?? null}, ${von.email})
    RETURNING id`) as any[];
  buchProtokoll(von.email, `Buchung ${ein.art}`, `buch:${r.id}`, `${richtung < 0 ? "−" : "+"}${geldText(Math.abs(ein.betragCents))} — ${ein.zweck}`);
  return Number(r.id);
}

export async function bewegungStornieren(id: number, von: BuchPerson, grund: string): Promise<{ ok: boolean; grund?: string }> {
  await buchSchema();
  const [r] = (await sqlPool`SELECT id, auftrag_id, storniert_am FROM fiaon_buch_bewegung WHERE id = ${id}`) as any[];
  if (!r) return { ok: false, grund: "Buchung nicht gefunden." };
  if (r.storniert_am) return { ok: false, grund: "Diese Buchung ist bereits storniert." };
  if (r.auftrag_id) return { ok: false, grund: "Diese Buchung gehört zu einem ausgeführten Zahlungsauftrag und wird nicht einzeln storniert." };
  await sqlPool`UPDATE fiaon_buch_bewegung SET storniert_am = NOW(), storniert_von = ${von.email}, storno_grund = ${grund} WHERE id = ${id}`;
  buchProtokoll(von.email, "Buchung storniert", `buch:${id}`, grund);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// IBAN
// ═══════════════════════════════════════════════════════════════════════════
export function ibanSauber(roh: string): string {
  return String(roh || "").replace(/\s+/g, "").toUpperCase();
}

/** Prüfziffer (Modulo 97) — ein Zahlendreher in der IBAN ist teuer. */
export function ibanGueltig(roh: string): boolean {
  const s = ibanSauber(roh);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(s)) return false;
  const um = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const z of um) {
    const wert = /\d/.test(z) ? z : String(z.charCodeAt(0) - 55);
    for (const d of wert) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

export function ibanHuebsch(roh: string): string {
  return ibanSauber(roh).replace(/(.{4})/g, "$1 ").trim();
}

export function ibanMaskiert(roh: string): string {
  const s = ibanSauber(roh);
  if (s.length < 8) return s;
  return `${s.slice(0, 4)} •••• •••• ${s.slice(-4)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPFÄNGER-KARTEI
// ═══════════════════════════════════════════════════════════════════════════
export interface Empfaenger {
  schluessel: string;              // "karte:12" | "mitarbeiter:13"
  quelle: "karte" | "mitarbeiter";
  name: string;
  iban: string;
  bic: string | null;
  kategorie: string | null;
  hinweis: string | null;
}

/** Legt einen Empfänger an oder frischt ihn auf (eine IBAN = ein Eintrag). */
export async function empfaengerMerken(e: { name: string; iban: string; bic?: string | null; kategorie?: string | null }, von: BuchPerson): Promise<void> {
  await buchSchema();
  const iban = ibanSauber(e.iban);
  if (!ibanGueltig(iban)) return;
  const [da] = (await sqlPool`SELECT id FROM fiaon_buch_empfaenger WHERE iban = ${iban} AND geloescht_am IS NULL LIMIT 1`) as any[];
  if (da) {
    await sqlPool`
      UPDATE fiaon_buch_empfaenger
         SET name = ${e.name}, bic = COALESCE(${e.bic ?? null}, bic), kategorie = COALESCE(${e.kategorie ?? null}, kategorie),
             zuletzt_genutzt = NOW()
       WHERE id = ${da.id}`;
    return;
  }
  await sqlPool`
    INSERT INTO fiaon_buch_empfaenger (name, iban, bic, kategorie, erstellt_von, zuletzt_genutzt)
    VALUES (${e.name}, ${iban}, ${e.bic ?? null}, ${e.kategorie ?? null}, ${von.email}, NOW())
    ON CONFLICT DO NOTHING`;
}

export async function empfaengerLoeschen(id: number, von: BuchPerson): Promise<void> {
  await buchSchema();
  await sqlPool`UPDATE fiaon_buch_empfaenger SET geloescht_am = NOW() WHERE id = ${id} AND geloescht_am IS NULL`;
  buchProtokoll(von.email, "Empfänger gelöscht", `empfaenger:${id}`, null);
}

export async function empfaengerKartei(): Promise<(Empfaenger & { id: number; zuletztGenutzt: string | null })[]> {
  await buchSchema();
  const rows = (await sqlPool`
    SELECT id, name, iban, bic, kategorie, zuletzt_genutzt FROM fiaon_buch_empfaenger
     WHERE geloescht_am IS NULL ORDER BY zuletzt_genutzt DESC NULLS LAST, name ASC LIMIT 200`) as any[];
  return rows.map((r) => ({
    id: Number(r.id), schluessel: `karte:${r.id}`, quelle: "karte" as const, name: String(r.name),
    iban: String(r.iban), bic: r.bic ?? null, kategorie: r.kategorie ?? null, hinweis: null,
    zuletztGenutzt: r.zuletzt_genutzt ? new Date(r.zuletzt_genutzt).toISOString() : null,
  }));
}

/**
 * Vorschläge beim Tippen: Kartei (bereits bezahlte Empfänger) und Mitarbeiter
 * mit hinterlegter Bankverbindung. Die IBAN der Mitarbeiter liegt
 * verschlüsselt vor und wird nur für diesen Vorschlag entschlüsselt.
 */
export async function empfaengerSuchen(q: string): Promise<Empfaenger[]> {
  await buchSchema();
  const text = String(q || "").trim();
  if (text.length < 2) return [];
  const muster = `%${text.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const ibanTeil = ibanSauber(text);
  const karte = (await sqlPool`
    SELECT id, name, iban, bic, kategorie FROM fiaon_buch_empfaenger
     WHERE geloescht_am IS NULL AND (name ILIKE ${muster} OR iban LIKE ${`%${ibanTeil}%`})
     ORDER BY zuletzt_genutzt DESC NULLS LAST LIMIT 8`) as any[];
  const leute = (await sqlPool`
    SELECT id, name, first_name, last_name, bank_holder_enc, bank_iban_enc, bank_bic_enc
      FROM fiaon_agents
     WHERE bank_iban_enc IS NOT NULL
       AND (name ILIKE ${muster} OR first_name ILIKE ${muster} OR last_name ILIKE ${muster})
     ORDER BY active DESC NULLS LAST, name ASC LIMIT 8`) as any[];
  const { decryptSecret } = await import("../routes/fiaon-agent");
  const aus: Empfaenger[] = [];
  const gesehen = new Set<string>();
  for (const r of karte) {
    const iban = String(r.iban);
    gesehen.add(iban);
    aus.push({ schluessel: `karte:${r.id}`, quelle: "karte", name: String(r.name), iban, bic: r.bic ?? null, kategorie: r.kategorie ?? null, hinweis: "Bereits bezahlt" });
  }
  for (const r of leute) {
    const iban = ibanSauber(decryptSecret(r.bank_iban_enc) || "");
    if (!iban || gesehen.has(iban) || !ibanGueltig(iban)) continue;
    gesehen.add(iban);
    const inhaberName = String(decryptSecret(r.bank_holder_enc) || "").trim();
    const name = String(r.name || `${r.first_name || ""} ${r.last_name || ""}`).trim();
    aus.push({
      schluessel: `mitarbeiter:${r.id}`, quelle: "mitarbeiter", name: inhaberName || name, iban,
      bic: (decryptSecret(r.bank_bic_enc) || "").trim().toUpperCase() || null,
      kategorie: "Provision", hinweis: inhaberName && inhaberName !== name ? `Mitarbeiter: ${name}` : "Mitarbeiter",
    });
  }
  return aus.slice(0, 10);
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSAUFTRÄGE
//
// entwurf → eingereicht → freigegeben → ausgefuehrt
//                      ↘ abgelehnt        (zurueckgezogen aus entwurf/eingereicht)
//
// Freigabe: nur der Inhaber, immer mit TAN. Aufträge der Buchhaltung brauchen
// seine Freigabe (vier Augen); eigene Aufträge gibt er als Einzelzeichner frei.
// Ausführung: nur der Inhaber — er hält den Bankzugang, nur er kann die
// Bankreferenz wahrheitsgemäß eintragen.
// ═══════════════════════════════════════════════════════════════════════════
export type AuftragStatus = "entwurf" | "eingereicht" | "freigegeben" | "abgelehnt" | "ausgefuehrt" | "zurueckgezogen";

export interface Auftrag {
  id: number;
  nummer: string;
  empfaenger: string;
  iban: string;
  bic: string | null;
  betragCents: number;
  zweck: string;
  kategorie: string | null;
  faelligAm: string | null;
  belegName: string | null;
  hatBeleg: boolean;
  status: AuftragStatus;
  erstelltVon: string;
  erstelltAm: string;
  eingereichtAm: string | null;
  entschiedenVon: string | null;
  entschiedenAm: string | null;
  entscheidungNotiz: string | null;
  freigabeArt: "vier_augen" | "einzel" | null;
  ausgefuehrtVon: string | null;
  ausgefuehrtAm: string | null;
  bankReferenz: string | null;
  hatBestaetigung: boolean;
  payoutId: number | null;
  /** 13.10.2026: Ausführung durch die Buchhaltung (Adresse) statt durch den Inhaber im Geschäftskonto. */
  ausfuehrungExtern: string | null;
  /** Wann die Freigabe-Mail mit TAN an die Geschäftsführung ging. */
  freigabeMailAm: string | null;
  /** Wann der Auftrag an die Buchhaltung ging und wann sie die SEPA-Überweisung bestätigt hat. */
  externGesendetAm: string | null;
  externBestaetigtAm: string | null;
  externWertAm: string | null;
}

function zuAuftrag(r: any): Auftrag {
  return {
    id: Number(r.id),
    nummer: String(r.nummer || ""),
    empfaenger: String(r.empfaenger || ""),
    iban: String(r.iban || ""),
    bic: r.bic ?? null,
    betragCents: Number(r.betrag_cents),
    zweck: String(r.zweck || ""),
    kategorie: r.kategorie ?? null,
    faelligAm: r.faellig_am ? new Date(r.faellig_am).toISOString().slice(0, 10) : null,
    belegName: r.beleg_name ?? null,
    hatBeleg: !!r.hat_beleg,
    status: String(r.status || "entwurf") as AuftragStatus,
    erstelltVon: String(r.erstellt_von || ""),
    erstelltAm: new Date(r.erstellt_am).toISOString(),
    eingereichtAm: r.eingereicht_am ? new Date(r.eingereicht_am).toISOString() : null,
    entschiedenVon: r.entschieden_von ?? null,
    entschiedenAm: r.entschieden_am ? new Date(r.entschieden_am).toISOString() : null,
    entscheidungNotiz: r.entscheidung_notiz ?? null,
    freigabeArt: r.freigabe_art === "einzel" ? "einzel" : r.freigabe_art === "vier_augen" ? "vier_augen" : null,
    ausgefuehrtVon: r.ausgefuehrt_von ?? null,
    ausgefuehrtAm: r.ausgefuehrt_am ? new Date(r.ausgefuehrt_am).toISOString() : null,
    bankReferenz: r.bank_referenz ?? null,
    hatBestaetigung: !!r.hat_bestaetigung,
    payoutId: r.payout_id ? Number(r.payout_id) : null,
    ausfuehrungExtern: r.ausfuehrung_extern ?? null,
    freigabeMailAm: r.freigabe_mail_am ? new Date(r.freigabe_mail_am).toISOString() : null,
    externGesendetAm: r.extern_gesendet_am ? new Date(r.extern_gesendet_am).toISOString() : null,
    externBestaetigtAm: r.extern_bestaetigt_am ? new Date(r.extern_bestaetigt_am).toISOString() : null,
    externWertAm: r.extern_wert_am ? new Date(r.extern_wert_am).toISOString().slice(0, 10) : null,
  };
}

const AUFTRAG_FELDER = `id, nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, faellig_am,
  beleg_name, (beleg_base64 IS NOT NULL) AS hat_beleg, status, erstellt_von, erstellt_am, eingereicht_am,
  entschieden_von, entschieden_am, entscheidung_notiz, freigabe_art, ausgefuehrt_von, ausgefuehrt_am,
  bank_referenz, (bestaetigung_base64 IS NOT NULL) AS hat_bestaetigung, payout_id,
  ausfuehrung_extern, freigabe_mail_am, extern_gesendet_am, extern_bestaetigt_am, extern_wert_am`;

export async function auftraege(limit = 200): Promise<Auftrag[]> {
  await buchSchema();
  const n = Math.min(500, Math.max(1, limit));
  const rows = (await sqlPool.unsafe(`SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag ORDER BY id DESC LIMIT ${n}`)) as any[];
  return rows.map(zuAuftrag);
}

export async function auftrag(id: number): Promise<Auftrag | null> {
  await buchSchema();
  const [r] = (await sqlPool.unsafe(`SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag WHERE id = $1`, [id])) as any[];
  return r ? zuAuftrag(r) : null;
}

/** ZA-2026-0001 — fortlaufend je Jahr, aus der Tabelle, nicht aus einem Zähler. */
async function naechsteNummer(): Promise<string> {
  const jahr = new Date().getFullYear();
  const [r] = (await sqlPool`
    SELECT COALESCE(MAX(SUBSTRING(nummer FROM '[0-9]{4}$')::int), 0) AS n
      FROM fiaon_buch_auftrag WHERE nummer LIKE ${`ZA-${jahr}-%`}`) as any[];
  return `ZA-${jahr}-${String(Number(r?.n || 0) + 1).padStart(4, "0")}`;
}

export interface AuftragEingabe {
  empfaenger: string; iban: string; bic?: string | null;
  betragCents: number; zweck: string; kategorie?: string | null;
  faelligAm?: string | null; belegName?: string | null; belegBase64?: string | null;
  payoutId?: number | null;
}

export async function auftragAnlegen(ein: AuftragEingabe, von: BuchPerson): Promise<Auftrag> {
  await buchSchema();
  const nummer = await naechsteNummer();
  const iban = ibanSauber(ein.iban);
  const [r] = (await sqlPool`
    INSERT INTO fiaon_buch_auftrag
      (nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, faellig_am, beleg_name, beleg_base64, status, erstellt_von, payout_id)
    VALUES (${nummer}, ${ein.empfaenger}, ${iban}, ${ein.bic ?? null},
            ${ein.betragCents}, ${ein.zweck}, ${ein.kategorie ?? null}, ${ein.faelligAm || null},
            ${ein.belegName ?? null}, ${ein.belegBase64 ?? null}, 'entwurf', ${von.email}, ${ein.payoutId ?? null})
    RETURNING id`) as any[];
  buchProtokoll(von.email, "Auftrag angelegt", nummer, `${geldText(ein.betragCents)} an ${ein.empfaenger}`);
  // Die Kartei lernt mit — Auszahlungen an Mitarbeiter nicht, die kennt sie schon.
  if (!ein.payoutId) void empfaengerMerken({ name: ein.empfaenger, iban, bic: ein.bic, kategorie: ein.kategorie }, von).catch(() => {});
  return (await auftrag(Number(r.id)))!;
}

export type Schritt = { ok: true; auftrag: Auftrag } | { ok: false; grund: string };

export async function auftragEinreichen(id: number, von: BuchPerson): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (a.status !== "entwurf") return { ok: false, grund: `Ein Auftrag im Zustand „${a.status}“ lässt sich nicht einreichen.` };
  if (a.erstelltVon !== von.email) return { ok: false, grund: "Einreichen kann nur, wer den Auftrag angelegt hat." };
  await sqlPool`UPDATE fiaon_buch_auftrag SET status = 'eingereicht', eingereicht_am = NOW() WHERE id = ${id} AND status = 'entwurf'`;
  buchProtokoll(von.email, "Auftrag eingereicht", a.nummer, null);
  if (von.rolle !== "inhaber") {
    benachrichtigen(inhaber().email, `Freigabe erbeten: ${a.nummer} · ${geldText(a.betragCents)}`, [
      `${von.name} hat einen Zahlungsauftrag zur Freigabe eingereicht:`,
      "",
      `  ${a.nummer}`,
      `  ${geldText(a.betragCents)} an ${a.empfaenger}`,
      `  IBAN ${ibanMaskiert(a.iban)}`,
      `  Zweck: ${a.zweck}`,
      "",
      "Freigeben oder ablehnen im FIAON Banking unter „Aufträge“.",
    ]);
  }
  return { ok: true, auftrag: (await auftrag(id))! };
}

export async function auftragZurueckziehen(id: number, von: BuchPerson): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (!["entwurf", "eingereicht"].includes(a.status)) {
    return { ok: false, grund: "Nur Entwürfe und eingereichte Aufträge lassen sich zurückziehen." };
  }
  if (a.erstelltVon !== von.email && von.rolle !== "inhaber") return { ok: false, grund: "Zurückziehen kann nur, wer den Auftrag angelegt hat." };
  await sqlPool`UPDATE fiaon_buch_auftrag SET status = 'zurueckgezogen' WHERE id = ${id}`;
  await freigabeTanVerwerfen(id);
  buchProtokoll(von.email, "Auftrag zurückgezogen", a.nummer, null);
  return { ok: true, auftrag: (await auftrag(id))! };
}

/** Das TAN-Ziel einer Freigabe — Auftrag, Betrag und IBAN. Ändert sich eins, passt die TAN nicht mehr. */
export function freigabeZiel(a: Auftrag): string {
  return `auftrag:${a.id}:${a.betragCents}:${ibanSauber(a.iban)}`;
}

export function freigabeBeschreibung(a: Auftrag): string {
  return `Freigabe ${a.nummer}: ${geldText(a.betragCents)} an ${a.empfaenger} (${ibanMaskiert(a.iban)})`;
}

/**
 * Der TAN-Zweck einer Freigabe. Bei der Ausführung über die Buchhaltung gehört jede TAN zu GENAU EINEM Auftrag —
 * sonst entwertete die Freigabe-Mail für den zweiten Auftrag die TAN des ersten (eine offene TAN je Zweck).
 */
export function tanZweck(a: Auftrag): string {
  return a.ausfuehrungExtern ? `freigabe:${a.id}` : "freigabe";
}

/** Ein abgelehnter oder zurückgezogener Auftrag nimmt seine offene Freigabe-TAN (aus der Mail) mit. */
async function freigabeTanVerwerfen(id: number): Promise<void> {
  await sqlPool`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE zweck = ${`freigabe:${id}`} AND benutzt_am IS NULL`;
}

/** Darf diese Person diesen Auftrag jetzt freigeben? (ohne TAN-Prüfung) */
export function freigabeMoeglich(a: Auftrag, von: BuchPerson): { ok: true; art: "vier_augen" | "einzel" } | { ok: false; grund: string } {
  // 13.10.2026 (Justin): Auszahlungen über die Buchhaltung gibt die Geschäftsführung mit TAN frei — vier Augen:
  // angelegt vom Inhaber, freigegeben von ihr, ausgeführt und bestätigt von der Buchhaltung.
  if (a.ausfuehrungExtern && von.rolle === "buchhaltung") {
    if (a.erstelltVon === von.email) return { ok: false, grund: "Diesen Auftrag hast du selbst angelegt — freigeben muss eine zweite Person." };
    if (a.status !== "eingereicht") return { ok: false, grund: "Es lassen sich nur eingereichte Aufträge freigeben." };
    return { ok: true, art: "vier_augen" };
  }
  if (von.rolle !== "inhaber") return { ok: false, grund: "Freigeben darf nur der Inhaber." };
  const eigen = a.erstelltVon === von.email;
  if (eigen) {
    if (!["entwurf", "eingereicht"].includes(a.status)) return { ok: false, grund: "Dieser Auftrag lässt sich nicht mehr freigeben." };
    return { ok: true, art: "einzel" };
  }
  if (a.status !== "eingereicht") return { ok: false, grund: "Es lassen sich nur eingereichte Aufträge freigeben." };
  return { ok: true, art: "vier_augen" };
}

export async function auftragFreigeben(id: number, von: BuchPerson, tan: string): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  const darf = freigabeMoeglich(a, von);
  if (!darf.ok) return darf;
  const t = await tanPruefen(von, tanZweck(a), freigabeZiel(a), tan);
  if (!t.ok) return t;
  // E-229: Die eindeutige Bankreferenz entsteht mit der Freigabe — Justin
  // kopiert sie und hinterlegt sie bei Airwallex. Payout-Aufträge tragen die
  // vorhandene Referenz weiter, sonst wird eine frische erzeugt.
  const referenz = a.bankReferenz?.trim() || (await freieBankReferenz());
  const rows = (await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET status = 'freigegeben', entschieden_von = ${von.email}, entschieden_am = NOW(),
           freigabe_art = ${darf.art}, eingereicht_am = COALESCE(eingereicht_am, NOW()),
           bank_referenz = COALESCE(bank_referenz, ${referenz})
     WHERE id = ${id} AND status IN ('entwurf', 'eingereicht')
    RETURNING id`) as any[];
  if (!rows.length) return { ok: false, grund: "Der Auftrag hat sich inzwischen verändert. Bitte neu laden." };
  buchProtokoll(von.email, darf.art === "einzel" ? "Auftrag freigegeben (Einzelzeichnung)" : "Auftrag freigegeben", a.nummer, `TAN bestätigt · ${geldText(a.betragCents)}`);
  // Über die Buchhaltung: Auftrag an die Buchhaltung, Freigabebestätigung an den Freigebenden. Scheitert der
  // Versand, bleibt die Freigabe stehen — „Erneut an die Buchhaltung senden" holt ihn nach.
  if (a.ausfuehrungExtern) {
    const b = await externBeauftragen(id);
    if (!b.ok) console.warn(`[BANKING] ${a.nummer}: Auftrag an die Buchhaltung nicht versendet — ${b.grund}`);
    freigabeBestaetigen(id, von, b.ok);
    return { ok: true, auftrag: (await auftrag(id))! };
  }
  const ersteller = buchPerson(a.erstelltVon);
  if (ersteller && ersteller.email !== von.email) {
    benachrichtigen(ersteller.email, `Freigegeben: ${a.nummer} · ${geldText(a.betragCents)}`, [
      `${von.name} hat deinen Zahlungsauftrag freigegeben:`,
      "",
      `  ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger}`,
      "",
      "Die Überweisung erfolgt jetzt über das Geschäftskonto.",
    ]);
  }
  return { ok: true, auftrag: (await auftrag(id))! };
}

export async function auftragAblehnen(id: number, von: BuchPerson, notiz: string): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  const darfAblehnen = von.rolle === "inhaber" || (!!a.ausfuehrungExtern && von.rolle === "buchhaltung" && a.erstelltVon !== von.email);
  if (!darfAblehnen) return { ok: false, grund: "Ablehnen darf nur der Inhaber." };
  if (a.status !== "eingereicht") return { ok: false, grund: "Es lassen sich nur eingereichte Aufträge ablehnen." };
  if (!String(notiz || "").trim()) return { ok: false, grund: "Eine Ablehnung braucht einen Grund." };
  await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET status = 'abgelehnt', entschieden_von = ${von.email}, entschieden_am = NOW(), entscheidung_notiz = ${notiz}
     WHERE id = ${id} AND status = 'eingereicht'`;
  await freigabeTanVerwerfen(id);
  buchProtokoll(von.email, "Auftrag abgelehnt", a.nummer, notiz);
  const ersteller = buchPerson(a.erstelltVon);
  if (ersteller && ersteller.email !== von.email) {
    benachrichtigen(ersteller.email, `Abgelehnt: ${a.nummer}`, [
      `${von.name} hat deinen Zahlungsauftrag abgelehnt:`,
      "",
      `  ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger}`,
      `  Grund: ${notiz}`,
    ]);
  }
  return { ok: true, auftrag: (await auftrag(id))! };
}

/**
 * Ausgeführt: Die Überweisung ist bei der Bank raus. Erst hier entsteht eine
 * Bewegung im Buch und die Zahlungsbestätigung.
 *
 * Ein Auftrag zu einer Mitarbeiter-Auszahlung legt KEINE eigene Bewegung an:
 * Die Auszahlung selbst steht im Umsatz (aus fiaon_payouts), sonst zählte das
 * Buch das Geld doppelt. Stattdessen läuft auszahlungUeberwiesen() — derselbe
 * Weg wie „Als überwiesen markieren" in /admin/payouts.
 */
export async function auftragAusfuehren(
  id: number, von: BuchPerson, bankReferenz: string, wertAm?: string | null,
): Promise<Schritt & { hinweis?: string }> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (von.rolle !== "inhaber") return { ok: false, grund: "Die Überweisung trägt der Inhaber ein — er hält den Bankzugang." };
  if (a.status !== "freigegeben") return { ok: false, grund: "Ausführen geht erst nach der Freigabe." };
  // 13.10.2026: Über die Buchhaltung bestätigt NUR die Buchhaltung — sonst entstünde ein Beleg ohne ihre Bestätigung.
  if (a.ausfuehrungExtern) return { ok: false, grund: `Diese Auszahlung bestätigt die Buchhaltung (${a.ausfuehrungExtern}) über ihren Link. Fehlt ihr der Link: „Erneut an die Buchhaltung senden“.` };
  // E-229: Die Referenz steht seit der Freigabe fest. Der Handeintrag ist nur
  // noch Rückfallebene für Altaufträge ohne generierte Referenz.
  const ref = (a.bankReferenz && a.bankReferenz.trim()) || String(bankReferenz || "").trim() || (await freieBankReferenz());
  const tag = (wertAm && /^\d{4}-\d{2}-\d{2}$/.test(wertAm)) ? wertAm : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  return ausfuehrenKern(a, von.email, ref, tag);
}

/**
 * Der eine Ausführungsweg — für den Inhaber („Überweisung eintragen") und seit 13.10.2026 für die Buchhaltung
 * (Bestätigung über ihren Link). `wer` ist die Adresse, die ausgeführt hat.
 */
async function ausfuehrenKern(a: Auftrag, wer: string, ref: string, tag: string): Promise<Schritt & { hinweis?: string }> {
  const id = a.id;
  let hinweis: string | undefined;
  if (a.payoutId) {
    const [p] = (await sqlPool`SELECT status FROM fiaon_payouts WHERE id = ${a.payoutId}`) as any[];
    if (!p) return { ok: false, grund: "Die zugehörige Auszahlung gibt es nicht mehr." };
    if (p.status === "abgelehnt") return { ok: false, grund: "Die zugehörige Auszahlung wurde abgelehnt — bitte den Auftrag zurückziehen." };
    // Erst den Auftrag beanspruchen — ein Doppelklick darf die Auszahlung nicht zweimal abschließen.
    const beansprucht = (await sqlPool`
      UPDATE fiaon_buch_auftrag
         SET status = 'ausgefuehrt', ausgefuehrt_von = ${wer}, ausgefuehrt_am = NOW(), bank_referenz = ${ref}
       WHERE id = ${id} AND status = 'freigegeben'
      RETURNING id`) as any[];
    if (!beansprucht.length) return { ok: false, grund: "Dieser Auftrag wurde bereits ausgeführt." };
    if (p.status === "angefordert") {
      try {
        const { auszahlungUeberwiesen } = await import("../routes/fiaon-team");
        const erg = await auszahlungUeberwiesen(a.payoutId);
        if (!erg.ok) hinweis = erg.error;
      } catch (e) {
        hinweis = `Die Überweisung ist eingetragen, aber die Auszahlung ließ sich nicht abschließen: ${String(e).slice(0, 160)}. Bitte in /admin/payouts „Als überwiesen markieren“ drücken.`;
        console.error("[BANKING] Auszahlung abschließen:", e);
      }
    } else {
      hinweis = "Die Auszahlung war bereits als überwiesen gebucht — der Auftrag wird nur abgeschlossen.";
    }
  } else {
    const erfolgt = await sqlPool.begin(async (tx: any) => {
      const beansprucht = (await tx`
        UPDATE fiaon_buch_auftrag
           SET status = 'ausgefuehrt', ausgefuehrt_von = ${wer}, ausgefuehrt_am = NOW(), bank_referenz = ${ref}
         WHERE id = ${id} AND status = 'freigegeben'
        RETURNING id`) as any[];
      if (!beansprucht.length) return false;
      await tx`
        INSERT INTO fiaon_buch_bewegung (art, richtung, betrag_cents, wert_am, zweck, gegenpartei, beleg, auftrag_id, erfasst_von)
        VALUES ('ausgabe', -1, ${a.betragCents}, ${tag}, ${a.zweck}, ${a.empfaenger}, ${a.nummer}, ${id}, ${wer})`;
      return true;
    });
    if (!erfolgt) return { ok: false, grund: "Dieser Auftrag wurde bereits ausgeführt." };
  }
  buchProtokoll(wer, "Überweisung ausgeführt", a.nummer, `Bankreferenz ${ref}`);

  // Die Bestätigung darf die Ausführung nicht kippen — sie lässt sich jederzeit nachholen.
  try {
    const { bestaetigungErzeugen } = await import("./fiaon-banking-pdf");
    await bestaetigungErzeugen(id);
  } catch (e) { console.warn("[BANKING] Bestätigung:", String(e).slice(0, 140)); }
  return { ok: true, auftrag: (await auftrag(id))!, ...(hinweis ? { hinweis } : {}) };
}

// ── Auszahlung → Zahlungsauftrag ────────────────────────────────────────────
/**
 * Legt zu einer angeforderten Mitarbeiter-Auszahlung den Zahlungsauftrag an.
 * Die Bankverbindung kommt aus dem verschlüsselten Schnappschuss der
 * Auszahlung — also genau die, die der Mitarbeiter bei der Anforderung
 * hinterlegt hatte. Gibt es schon einen offenen Auftrag, wird er zurückgegeben.
 */
export async function auftragAusAuszahlung(payoutId: number, von: BuchPerson): Promise<Schritt> {
  await buchSchema();
  const [offen] = (await sqlPool`
    SELECT id FROM fiaon_buch_auftrag
     WHERE payout_id = ${payoutId} AND status NOT IN ('abgelehnt', 'zurueckgezogen')
     ORDER BY id DESC LIMIT 1`) as any[];
  if (offen) return { ok: true, auftrag: (await auftrag(Number(offen.id)))! };

  const [p] = (await sqlPool`
    SELECT p.id, p.status, p.amount_cents, p.bank_holder_enc, p.bank_iban_enc, p.bank_bic_enc, p.requested_at,
           a.name, a.first_name, a.last_name,
           EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.payout_id = p.id AND c.kind = 'gehalt') AS ist_gehalt
      FROM fiaon_payouts p LEFT JOIN fiaon_agents a ON a.id = p.agent_id
     WHERE p.id = ${payoutId}`) as any[];
  if (!p) return { ok: false, grund: "Auszahlung nicht gefunden." };
  if (p.status !== "angefordert") return { ok: false, grund: `Diese Auszahlung steht auf „${p.status}“ — anweisen lässt sich nur eine angeforderte.` };
  const { decryptSecret } = await import("../routes/fiaon-agent");
  const iban = ibanSauber(decryptSecret(p.bank_iban_enc) || "");
  if (!ibanGueltig(iban)) return { ok: false, grund: "Zu dieser Auszahlung ist keine gültige IBAN hinterlegt." };
  const name = String(p.name || `${p.first_name || ""} ${p.last_name || ""}`).trim() || `Mitarbeiter`;
  const halter = String(decryptSecret(p.bank_holder_enc) || "").trim() || name;
  const monat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" })
    .format(new Date(p.requested_at || Date.now()));
  return {
    ok: true,
    auftrag: await auftragAnlegen({
      empfaenger: halter,
      iban,
      bic: (decryptSecret(p.bank_bic_enc) || "").trim().toUpperCase() || null,
      betragCents: Number(p.amount_cents),
      zweck: `FIAON Auszahlung Nr. ${p.id} · ${p.ist_gehalt ? "Gehalt" : "Provision"} ${monat}`,
      kategorie: p.ist_gehalt ? "Gehalt / Vergütung" : "Provision",
      payoutId: Number(p.id),
    }, von),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUSZAHLUNG ÜBER DIE BUCHHALTUNG (13.10.2026)
//
// Justin: „Alle Provisionen, die offen sind, sollen ausgebucht werden — schicke Florentine für jede Transaktion
// eine TAN, die sie über einen Link in der Buchhaltung bestätigt … buchhaltung@schwarzott-global.com bekommt den
// Auftrag mit allen Details … sobald die das bestätigen, muss die Bestätigung an Florentine mit dem Beleg raus."
// Und: „baue mir als Unternehmensinhaber etwas ein, wo ich das an Florentine schicken kann — ‚Bitte geben Sie
// folgende Auszahlung frei'".
//
// Der Ablauf, je Auszahlung ein Zahlungsauftrag:
//   1. Der Inhaber schickt die Auszahlung zur Freigabe (zurFreigabeSenden). Der Auftrag entsteht in seinem Namen,
//      Ausführung „über die Buchhaltung“, und die Geschäftsführung bekommt EINE Mail: Details, TAN (72 h, nur für
//      diesen Betrag an diese IBAN) und den Link ins FIAON Banking — anmelden muss sie sich dort selbst.
//   2. Sie gibt mit der TAN frei (auftragFreigeben). Dann geht der Auftrag mit allen Details und einem eigenen
//      Bestätigungslink an die Buchhaltung (externBeauftragen); sie selbst bekommt die Freigabebestätigung.
//      Den Bestätigungslink sieht NUR die Buchhaltung — sonst könnte dieselbe Person freigeben und „ausgeführt“
//      melden.
//   3. Die Buchhaltung führt die SEPA-Überweisung aus und bestätigt (externBestaetigen). ERST JETZT wird über den
//      einen Weg ausgebucht (ausfuehrenKern → auszahlungUeberwiesen: Auszahlung und Provisionszeilen „ausgezahlt“,
//      Abrechnung, Nachricht an den Mitarbeiter), der Durchführungsbeleg entsteht und geht an die Geschäftsführung.
// Kein Beleg behauptet eine Überweisung, die niemand bestätigt hat (siehe Kopf dieser Datei).
// ═══════════════════════════════════════════════════════════════════════════

/** Die Stelle, die die SEPA-Überweisungen ausführt und bestätigt — Justins Vorgabe vom 13.10.2026. */
export const BUCHHALTUNG_AUSFUEHRUNG = "buchhaltung@schwarzott-global.com";
const FREIGABE_TAN_TTL_S = 72 * 60 * 60;
const SEITE = (process.env.PUBLIC_BASE_URL || "https://fiaon.com").replace(/\/+$/, "");

/** Wer Auszahlungen über die Buchhaltung freigibt: die Geschäftsführung (Rolle „buchhaltung“ im Banking). */
export function geschaeftsfuehrung(): BuchPerson {
  return BUCH_LEUTE.find((p) => p.rolle === "buchhaltung")!;
}

const externHash = (token: string) => createHash("sha256").update(`${secret()}:extern:${token}`).digest("hex");
const zeitText = (iso: string | null) => (iso
  ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—");
const tagText = (t: string | null) => (t ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(0, 4)}` : "—");
const nameVon = (email: string | null) => (email ? buchPerson(email)?.name ?? email : "—");
const titelVon = (email: string | null) => (email ? buchPerson(email)?.titel ?? "" : "");
/** Der Verwendungszweck für die Bank — mit der Bankreferenz, damit der Eingang beim Empfänger zuzuordnen ist. */
export function bankZweck(a: Auftrag): string {
  return a.bankReferenz ? `${a.zweck} · Ref ${a.bankReferenz}` : a.zweck;
}
const zeile = (l: string, w: string) => `  ${l.padEnd(19, " ")}${w}`;

/**
 * Nur der lokale Prüfstand (nie NODE_ENV=production): BANKING_MAIL_PROBE=<Ordner> legt jede Banking-Mail samt
 * Anhang dort ab, statt sie zu senden — so lässt sich der ganze Ablauf ohne Mailzugang durchspielen und lesen.
 */
export async function mailProbe(an: string, betreff: string, text: string, anhang?: { dateiname: string; inhalt: Buffer }): Promise<boolean> {
  const ordner = process.env.NODE_ENV !== "production" ? process.env.BANKING_MAIL_PROBE : undefined;
  if (!ordner) return false;
  const { mkdir, writeFile } = await import("fs/promises");
  const pfad = await import("path");
  await mkdir(ordner, { recursive: true });
  const stamm = `${Date.now()}-${an.replace(/[^a-z0-9]+/gi, "_")}`;
  await writeFile(pfad.join(ordner, `${stamm}.txt`), `An: ${an}\nBetreff: ${betreff}\n\n${text}\n`);
  if (anhang) await writeFile(pfad.join(ordner, `${stamm}-${anhang.dateiname}`), anhang.inhalt);
  return true;
}

async function gmailSenden(an: string, betreff: string, text: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  try {
    if (await mailProbe(an, betreff, text)) return { ok: true };
    const { mailNeuSenden, gmailBereit } = await import("./fiaon-gmail");
    if (!gmailBereit()) return { ok: false, grund: "Der Mailversand ist gerade nicht möglich (Mailzugang fehlt)." };
    await mailNeuSenden(ABSENDER, an, betreff, text);
    return { ok: true };
  } catch (e) {
    console.error("[BANKING] Mail an", an, String(e).slice(0, 160));
    return { ok: false, grund: "Die Mail konnte nicht versendet werden." };
  }
}

/** „Bitte geben Sie folgende Auszahlung frei“ — Details, TAN und Link ins Banking an die Geschäftsführung. */
export async function freigabeMailSenden(a: Auftrag): Promise<{ ok: true } | { ok: false; grund: string }> {
  if (!a.ausfuehrungExtern || a.status !== "eingereicht") return { ok: false, grund: "Nur eingereichte Aufträge über die Buchhaltung gehen zur Freigabe." };
  const gf = geschaeftsfuehrung();
  const tan = await tanErzeugen(gf, tanZweck(a), freigabeZiel(a), FREIGABE_TAN_TTL_S);
  const link = `${SEITE}/buchhaltung?reiter=auftraege&auftrag=${a.id}`;
  const text = [
    "Guten Tag,",
    "",
    "bitte geben Sie folgende Auszahlung frei:",
    "",
    zeile("Auftrag", a.nummer),
    zeile("Empfänger", a.empfaenger),
    zeile("IBAN", ibanMaskiert(a.iban)),
    zeile("Betrag", geldText(a.betragCents)),
    zeile("Verwendungszweck", a.zweck),
    ...(a.payoutId ? [zeile("Art", `${a.kategorie || "Auszahlung"} · Mitarbeiter-Auszahlung FIAON-AUS-${a.payoutId}`)] : []),
    zeile("Ausführung", `SEPA-Überweisung durch die Buchhaltung (${a.ausfuehrungExtern})`),
    "",
    "Ihre TAN für genau diese Auszahlung:",
    "",
    `      TAN  ${tan.slice(0, 3)} ${tan.slice(3)}`,
    "",
    "So geben Sie frei:",
    `  1. Link öffnen: ${link}`,
    "  2. Im FIAON Banking anmelden (Passwort und PIN).",
    "  3. „Mit TAN freigeben“ und die TAN eingeben.",
    "",
    "Die TAN gilt 72 Stunden und nur für diesen Betrag an diese IBAN. Stimmt etwas nicht, geben Sie die TAN nicht ein und lehnen Sie die Auszahlung im Banking ab.",
    "",
    "Nach Ihrer Freigabe geht der Auftrag an die Buchhaltung. Sobald sie die SEPA-Überweisung bestätigt, wird die Auszahlung ausgebucht und Sie erhalten den Durchführungsbeleg.",
    "",
    `${inhaber().name} · ${inhaber().titel}`,
    "FIAON Banking",
  ].join("\n");
  const m = await gmailSenden(gf.email, `Bitte freigeben: ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger}`, text);
  if (!m.ok) return m;
  await sqlPool`UPDATE fiaon_buch_auftrag SET freigabe_mail_am = NOW() WHERE id = ${a.id}`;
  buchProtokoll(inhaber().email, "Freigabe-Mail mit TAN an die Geschäftsführung", a.nummer, `${geldText(a.betragCents)} an ${a.empfaenger}`);
  return { ok: true };
}

/**
 * Eine angeforderte Auszahlung zur Freigabe an die Geschäftsführung schicken. Gibt es schon einen offenen Auftrag,
 * wird er weiterverwendet; hat ihn die Geschäftsführung selbst angelegt, entsteht er neu im Namen des Inhabers —
 * sonst müsste sie ihren eigenen Auftrag freigeben (vier Augen).
 */
export async function zurFreigabeSenden(payoutId: number, von: BuchPerson): Promise<(Schritt & { mail?: boolean; hinweis?: string })> {
  if (von.rolle !== "inhaber") return { ok: false, grund: "Zur Freigabe schicken darf nur der Inhaber." };
  await buchSchema();
  const [o] = (await sqlPool`
    SELECT id FROM fiaon_buch_auftrag
     WHERE payout_id = ${payoutId} AND status NOT IN ('abgelehnt', 'zurueckgezogen', 'ausgefuehrt')
     ORDER BY id DESC LIMIT 1`) as any[];
  let a = o ? await auftrag(Number(o.id)) : null;
  if (a?.status === "freigegeben") {
    return { ok: false, grund: a.ausfuehrungExtern ? `${a.nummer} ist bereits freigegeben und liegt bei der Buchhaltung.` : `${a.nummer} ist bereits freigegeben — die Überweisung trägst du unter „Aufträge“ ein.` };
  }
  if (a && a.erstelltVon !== von.email) {
    await sqlPool`UPDATE fiaon_buch_auftrag SET status = 'zurueckgezogen' WHERE id = ${a.id} AND status IN ('entwurf', 'eingereicht')`;
    await freigabeTanVerwerfen(a.id);
    buchProtokoll(von.email, "Auftrag zurückgezogen", a.nummer, "neu angelegt zur Freigabe durch die Geschäftsführung (vier Augen)");
    a = null;
  }
  if (!a) {
    const erg = await auftragAusAuszahlung(payoutId, von);
    if (!erg.ok) return erg;
    a = erg.auftrag;
  }
  await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET ausfuehrung_extern = ${BUCHHALTUNG_AUSFUEHRUNG}, status = 'eingereicht', eingereicht_am = COALESCE(eingereicht_am, NOW())
     WHERE id = ${a.id} AND status IN ('entwurf', 'eingereicht')`;
  a = (await auftrag(a.id))!;
  const m = await freigabeMailSenden(a);
  if (!m.ok) buchProtokoll(von.email, "Freigabe-Mail fehlgeschlagen", a.nummer, m.grund);
  return { ok: true, auftrag: (await auftrag(a.id))!, mail: m.ok, ...(m.ok ? {} : { hinweis: m.grund }) };
}

/** Alle angeforderten Auszahlungen, die noch nicht bei der Geschäftsführung oder der Buchhaltung liegen. */
export async function alleZurFreigabeSenden(von: BuchPerson): Promise<{ gesendet: string[]; ohneMail: string[]; uebersprungen: { id: number; grund: string }[] }> {
  await buchSchema();
  const offen = (await sqlPool`
    SELECT p.id, o.status AS auftrag_status, o.ausfuehrung_extern, o.freigabe_mail_am, z.status AS zuletzt_status, z.ausfuehrung_extern AS zuletzt_extern
      FROM fiaon_payouts p
      LEFT JOIN LATERAL (
        SELECT status, ausfuehrung_extern, freigabe_mail_am FROM fiaon_buch_auftrag
         WHERE payout_id = p.id AND status NOT IN ('abgelehnt', 'zurueckgezogen', 'ausgefuehrt') ORDER BY id DESC LIMIT 1
      ) o ON TRUE
      LEFT JOIN LATERAL (
        SELECT status, ausfuehrung_extern FROM fiaon_buch_auftrag WHERE payout_id = p.id ORDER BY id DESC LIMIT 1
      ) z ON TRUE
     WHERE p.status = 'angefordert'
     ORDER BY p.id`) as any[];
  const gesendet: string[] = [], ohneMail: string[] = [];
  const uebersprungen: { id: number; grund: string }[] = [];
  for (const p of offen) {
    if (p.auftrag_status === "freigegeben") { uebersprungen.push({ id: Number(p.id), grund: "bereits freigegeben" }); continue; }
    // Hat die Geschäftsführung abgelehnt, schickt „Alle“ sie nicht stumm erneut — das geht nur einzeln und bewusst.
    if (!p.auftrag_status && p.zuletzt_status === "abgelehnt" && p.zuletzt_extern) { uebersprungen.push({ id: Number(p.id), grund: "von der Geschäftsführung abgelehnt" }); continue; }
    if (p.ausfuehrung_extern && p.auftrag_status === "eingereicht" && p.freigabe_mail_am) { uebersprungen.push({ id: Number(p.id), grund: "wartet schon auf die Freigabe" }); continue; }
    const erg = await zurFreigabeSenden(Number(p.id), von);
    if (!erg.ok) { uebersprungen.push({ id: Number(p.id), grund: erg.grund }); continue; }
    (erg.mail ? gesendet : ohneMail).push(erg.auftrag.nummer);
  }
  buchProtokoll(von.email, "Auszahlungen zur Freigabe an die Geschäftsführung", null, `${gesendet.length} gesendet, ${ohneMail.length} ohne Mail, ${uebersprungen.length} übersprungen`);
  return { gesendet, ohneMail, uebersprungen };
}

/** Den freigegebenen Auftrag an die Buchhaltung: alle Details und ein eigener Bestätigungslink (jedes Mal neu). */
export async function externBeauftragen(id: number): Promise<{ ok: true } | { ok: false; grund: string }> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (!a.ausfuehrungExtern) return { ok: false, grund: "Dieser Auftrag wird nicht über die Buchhaltung ausgeführt." };
  if (a.status !== "freigegeben") return { ok: false, grund: "Nur freigegebene Aufträge gehen an die Buchhaltung." };
  const token = randomBytes(24).toString("base64url");
  await sqlPool`UPDATE fiaon_buch_auftrag SET extern_token_hash = ${externHash(token)} WHERE id = ${id} AND status = 'freigegeben'`;
  const link = `${SEITE}/auszahlung-ausfuehren/${token}`;
  const text = [
    "Guten Tag,",
    "",
    "die FIAON LTD beauftragt Sie mit folgender Auszahlung per SEPA-Überweisung:",
    "",
    zeile("Auftrag", a.nummer),
    zeile("Empfänger", a.empfaenger),
    zeile("IBAN", ibanHuebsch(a.iban)),
    zeile("BIC", a.bic || "nicht angegeben"),
    zeile("Betrag", `${(a.betragCents / 100).toFixed(2).replace(".", ",")} EUR`),
    zeile("Verwendungszweck", bankZweck(a)),
    ...(a.payoutId ? [zeile("Art", `${a.kategorie || "Auszahlung"} · Mitarbeiter-Auszahlung FIAON-AUS-${a.payoutId}`)] : []),
    "",
    zeile("Erfasst", `${nameVon(a.erstelltVon)}${titelVon(a.erstelltVon) ? `, ${titelVon(a.erstelltVon)}` : ""} · ${zeitText(a.erstelltAm)}`),
    zeile("Freigegeben", `${nameVon(a.entschiedenVon)}${titelVon(a.entschiedenVon) ? `, ${titelVon(a.entschiedenVon)}` : ""} · ${zeitText(a.entschiedenAm)} (mit TAN)`),
    "",
    "Bitte führen Sie die Überweisung aus und bestätigen Sie sie anschließend hier:",
    `  ${link}`,
    "",
    "Erst mit Ihrer Bestätigung wird die Auszahlung bei FIAON ausgebucht und der Durchführungsbeleg ausgestellt.",
    "Der Link gehört nur zu diesem Auftrag — bitte nicht weitergeben.",
    "",
    "Mit freundlichen Grüßen",
    "FIAON LTD · Zahlungsverkehr",
  ].join("\n");
  const m = await gmailSenden(a.ausfuehrungExtern, `Zahlungsauftrag ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger} — bitte per SEPA ausführen`, text);
  if (!m.ok) return m;
  await sqlPool`UPDATE fiaon_buch_auftrag SET extern_gesendet_am = NOW() WHERE id = ${id}`;
  buchProtokoll(null, "Auftrag an die Buchhaltung", a.nummer, `${geldText(a.betragCents)} an ${a.empfaenger} · ${a.ausfuehrungExtern}`);
  return { ok: true };
}

/** Freigabebestätigung an die Person, die freigegeben hat. Feuert und vergisst. */
function freigabeBestaetigen(id: number, von: BuchPerson, beauftragt: boolean): void {
  void (async () => {
    const a = await auftrag(id);
    if (!a) return;
    await gmailSenden(von.email, `Freigabe bestätigt: ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger}`, [
      "Guten Tag,",
      "",
      "Sie haben folgende Auszahlung mit TAN freigegeben:",
      "",
      zeile("Auftrag", a.nummer),
      zeile("Empfänger", `${a.empfaenger} · ${ibanMaskiert(a.iban)}`),
      zeile("Betrag", geldText(a.betragCents)),
      zeile("Verwendungszweck", bankZweck(a)),
      zeile("Freigegeben", `${zeitText(a.entschiedenAm)} (mit TAN)`),
      "",
      beauftragt
        ? `Der Auftrag ist an die Buchhaltung (${a.ausfuehrungExtern}) übermittelt. Sobald sie die SEPA-Überweisung bestätigt, wird die Auszahlung ausgebucht und Sie erhalten den Durchführungsbeleg.`
        : "Der Auftrag konnte noch nicht an die Buchhaltung übermittelt werden — im FIAON Banking unter „Aufträge“ erneut senden.",
      "",
      `FIAON Banking · ${SEITE}/buchhaltung`,
    ].join("\n"));
  })().catch((e) => console.warn("[BANKING] Freigabebestätigung:", String(e).slice(0, 140)));
}

export interface ExternAnsicht {
  nummer: string; empfaenger: string; iban: string; bic: string | null; betragCents: number; verwendungszweck: string;
  art: string | null; auszahlung: string | null; erfasst: string; freigegeben: string;
  stand: "offen" | "bestaetigt" | "ungueltig"; bestaetigtAm: string | null; wertAm: string | null;
}

async function externFinden(token: string): Promise<Auftrag | null> {
  const t = String(token || "").trim();
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(t)) return null;
  await buchSchema();
  const [r] = (await sqlPool`SELECT id FROM fiaon_buch_auftrag WHERE extern_token_hash = ${externHash(t)} LIMIT 1`) as any[];
  return r ? auftrag(Number(r.id)) : null;
}

/** Was die Buchhaltung über ihren Link sieht — volle IBAN, sie muss überweisen. */
export async function externLesen(token: string): Promise<ExternAnsicht | null> {
  const a = await externFinden(token);
  if (!a || !a.ausfuehrungExtern) return null;
  return {
    nummer: a.nummer, empfaenger: a.empfaenger, iban: ibanHuebsch(a.iban), bic: a.bic, betragCents: a.betragCents,
    verwendungszweck: bankZweck(a), art: a.kategorie, auszahlung: a.payoutId ? `FIAON-AUS-${a.payoutId}` : null,
    erfasst: `${nameVon(a.erstelltVon)} · ${zeitText(a.erstelltAm)}`,
    freigegeben: `${nameVon(a.entschiedenVon)} · ${zeitText(a.entschiedenAm)} (mit TAN)`,
    stand: a.status === "ausgefuehrt" ? "bestaetigt" : a.status === "freigegeben" ? "offen" : "ungueltig",
    bestaetigtAm: a.externBestaetigtAm, wertAm: a.externWertAm,
  };
}

/**
 * Die Buchhaltung bestätigt: Die SEPA-Überweisung ist ausgeführt. Erst jetzt wird ausgebucht (der eine Weg), der
 * Durchführungsbeleg entsteht und geht an die Geschäftsführung.
 */
export async function externBestaetigen(token: string, ein: { wertAm?: string | null; notiz?: string | null }): Promise<Schritt & { hinweis?: string }> {
  const a = await externFinden(token);
  if (!a || !a.ausfuehrungExtern) return { ok: false, grund: "Dieser Link ist ungültig oder abgelaufen." };
  if (a.status === "ausgefuehrt") return { ok: false, grund: `Bereits bestätigt am ${zeitText(a.externBestaetigtAm || a.ausgefuehrtAm)}.` };
  if (a.status !== "freigegeben") return { ok: false, grund: "Dieser Auftrag ist nicht (mehr) zur Ausführung freigegeben." };
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const wert = ein.wertAm && /^\d{4}-\d{2}-\d{2}$/.test(ein.wertAm) ? ein.wertAm : heute;
  if (wert > heute) return { ok: false, grund: "Das Ausführungsdatum liegt in der Zukunft — bitte erst nach der Überweisung bestätigen." };
  if (wert < (a.entschiedenAm ? new Date(a.entschiedenAm).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : wert)) {
    return { ok: false, grund: "Das Ausführungsdatum liegt vor der Freigabe." };
  }
  const notiz = ein.notiz ? String(ein.notiz).trim().slice(0, 200) : null;
  const vermerkt = (await sqlPool`
    UPDATE fiaon_buch_auftrag SET extern_bestaetigt_am = NOW(), extern_wert_am = ${wert}, extern_notiz = ${notiz}
     WHERE id = ${a.id} AND status = 'freigegeben' AND extern_bestaetigt_am IS NULL
    RETURNING id`) as any[];
  if (!vermerkt.length) return { ok: false, grund: "Dieser Auftrag wird gerade schon bestätigt." };
  const ref = (a.bankReferenz && a.bankReferenz.trim()) || (await freieBankReferenz());
  const erg = await ausfuehrenKern((await auftrag(a.id))!, a.ausfuehrungExtern, ref, wert);
  if (!erg.ok) {
    await sqlPool`UPDATE fiaon_buch_auftrag SET extern_bestaetigt_am = NULL, extern_wert_am = NULL, extern_notiz = NULL WHERE id = ${a.id} AND status = 'freigegeben'`;
    return erg;
  }
  buchProtokoll(a.ausfuehrungExtern, "SEPA-Überweisung bestätigt (Buchhaltung)", a.nummer, `ausgeführt am ${tagText(wert)}${notiz ? ` · ${notiz}` : ""}`);
  await durchfuehrungsbelegSenden(a.id).catch((e) => console.warn("[BANKING] Durchführungsbeleg-Mail:", String(e).slice(0, 140)));
  return erg;
}

/** Der Durchführungsbeleg (PDF) an die Person, die freigegeben hat — mit der SEPA-Auskunft im Text. */
export async function durchfuehrungsbelegSenden(id: number): Promise<{ ok: true } | { ok: false; grund: string }> {
  const a = await auftrag(id);
  if (!a || a.status !== "ausgefuehrt") return { ok: false, grund: "Einen Durchführungsbeleg gibt es erst nach der Ausführung." };
  const an = (a.entschiedenVon && buchPerson(a.entschiedenVon)?.email) || geschaeftsfuehrung().email;
  const { bestaetigungLesen, bestaetigungErzeugen } = await import("./fiaon-banking-pdf");
  const pdf = (await bestaetigungLesen(id)) ?? (await bestaetigungErzeugen(id));
  const betreff = `Ausgeführt: ${a.nummer} · ${geldText(a.betragCents)} an ${a.empfaenger} — Durchführungsbeleg`;
  const dateiname = `FIAON_Durchfuehrungsbeleg_${a.nummer}.pdf`;
  try {
    const text = [
      "Guten Tag,",
      "",
      "die Buchhaltung hat folgende Auszahlung per SEPA-Überweisung ausgeführt:",
      "",
      zeile("Auftrag", a.nummer),
      zeile("Empfänger", `${a.empfaenger} · ${ibanMaskiert(a.iban)}`),
      zeile("Betrag", geldText(a.betragCents)),
      zeile("Verwendungszweck", bankZweck(a)),
      zeile("Ausgeführt am", `${tagText(a.externWertAm)} (bestätigt von ${a.ausfuehrungExtern})`),
      "",
      "Die Auszahlung ist bei FIAON ausgebucht. Eine SEPA-Überweisung ist kein Echtzeitverfahren: Die Gutschrift beim Empfänger erfolgt in der Regel innerhalb von 1–3 Bankarbeitstagen.",
      "",
      "Der Durchführungsbeleg liegt als PDF bei und steht jederzeit im FIAON Banking unter „Aufträge“.",
      "",
      `FIAON Banking · ${SEITE}/buchhaltung`,
    ].join("\n");
    if (!(await mailProbe(an, betreff, text, { dateiname, inhalt: pdf }))) {
      const { mailNeuMitAnhang, gmailBereit } = await import("./fiaon-gmail");
      if (!gmailBereit()) return { ok: false, grund: "Der Mailversand ist gerade nicht möglich (Mailzugang fehlt)." };
      await mailNeuMitAnhang(ABSENDER, an, betreff, text, [{ dateiname, inhalt: pdf, typ: "application/pdf" }]);
    }
  } catch (e) {
    console.error("[BANKING] Durchführungsbeleg an", an, String(e).slice(0, 160));
    return { ok: false, grund: "Der Durchführungsbeleg konnte nicht versendet werden." };
  }
  buchProtokoll(null, "Durchführungsbeleg versendet", a.nummer, an);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DAUERAUFTRÄGE
//
// Ein Dauerauftrag überweist nie selbst. Am Fälligkeitstag legt er einen
// gewöhnlichen Zahlungsauftrag an und reicht ihn ein — die Freigabe mit TAN
// bleibt beim Inhaber, wie bei jeder anderen Zahlung.
// ═══════════════════════════════════════════════════════════════════════════
export interface Dauerauftrag {
  id: number;
  empfaenger: string;
  iban: string;
  bic: string | null;
  betragCents: number;
  zweck: string;
  kategorie: string | null;
  tagImMonat: number;
  naechsteAm: string;
  erstelltVon: string;
  erstelltAm: string;
  beendetAm: string | null;
  letzterAuftragId: number | null;
}

function zuDauerauftrag(r: any): Dauerauftrag {
  return {
    id: Number(r.id), empfaenger: String(r.empfaenger), iban: String(r.iban), bic: r.bic ?? null,
    betragCents: Number(r.betrag_cents), zweck: String(r.zweck), kategorie: r.kategorie ?? null,
    tagImMonat: Number(r.tag_im_monat),
    naechsteAm: r.naechste_am instanceof Date ? r.naechste_am.toISOString().slice(0, 10) : String(r.naechste_am).slice(0, 10),
    erstelltVon: String(r.erstellt_von), erstelltAm: new Date(r.erstellt_am).toISOString(),
    beendetAm: r.beendet_am ? new Date(r.beendet_am).toISOString() : null,
    letzterAuftragId: r.letzter_auftrag_id != null ? Number(r.letzter_auftrag_id) : null,
  };
}

/** Der nächste Termin nach `ab` für einen Tag im Monat — am 31. im Februar also der 28./29. */
export function naechsterTermin(tagImMonat: number, ab: string): string {
  const [j, m, t] = ab.split("-").map(Number);
  const inMonat = (jahr: number, monat: number) => {
    const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
    return `${jahr}-${String(monat).padStart(2, "0")}-${String(Math.min(tagImMonat, letzter)).padStart(2, "0")}`;
  };
  const diesen = inMonat(j, m);
  if (Number(diesen.slice(8)) >= t) return diesen;
  return m === 12 ? inMonat(j + 1, 1) : inMonat(j, m + 1);
}

export async function dauerauftraege(): Promise<Dauerauftrag[]> {
  await buchSchema();
  const rows = (await sqlPool`SELECT * FROM fiaon_buch_dauerauftrag ORDER BY beendet_am NULLS FIRST, naechste_am ASC, id DESC LIMIT 100`) as any[];
  return rows.map(zuDauerauftrag);
}

export async function dauerauftragAnlegen(ein: {
  empfaenger: string; iban: string; bic?: string | null; betragCents: number; zweck: string;
  kategorie?: string | null; tagImMonat: number; ab: string;
}, von: BuchPerson): Promise<Dauerauftrag> {
  await buchSchema();
  const naechste = naechsterTermin(ein.tagImMonat, ein.ab);
  const [r] = (await sqlPool`
    INSERT INTO fiaon_buch_dauerauftrag (empfaenger, iban, bic, betrag_cents, zweck, kategorie, tag_im_monat, naechste_am, erstellt_von)
    VALUES (${ein.empfaenger}, ${ibanSauber(ein.iban)}, ${ein.bic ?? null}, ${ein.betragCents}, ${ein.zweck},
            ${ein.kategorie ?? null}, ${ein.tagImMonat}, ${naechste}, ${von.email})
    RETURNING *`) as any[];
  buchProtokoll(von.email, "Dauerauftrag angelegt", `dauer:${r.id}`, `${geldText(ein.betragCents)} monatlich zum ${ein.tagImMonat}. an ${ein.empfaenger}`);
  void empfaengerMerken({ name: ein.empfaenger, iban: ein.iban, bic: ein.bic, kategorie: ein.kategorie }, von).catch(() => {});
  return zuDauerauftrag(r);
}

export async function dauerauftragBeenden(id: number, von: BuchPerson): Promise<{ ok: boolean; grund?: string }> {
  await buchSchema();
  const [r] = (await sqlPool`SELECT erstellt_von, beendet_am FROM fiaon_buch_dauerauftrag WHERE id = ${id}`) as any[];
  if (!r) return { ok: false, grund: "Dauerauftrag nicht gefunden." };
  if (r.beendet_am) return { ok: false, grund: "Dieser Dauerauftrag ist bereits beendet." };
  if (r.erstellt_von !== von.email && von.rolle !== "inhaber") return { ok: false, grund: "Beenden kann nur, wer ihn angelegt hat, oder der Inhaber." };
  await sqlPool`UPDATE fiaon_buch_dauerauftrag SET beendet_am = NOW(), beendet_von = ${von.email} WHERE id = ${id}`;
  buchProtokoll(von.email, "Dauerauftrag beendet", `dauer:${id}`, null);
  return { ok: true };
}

/** Der Takt: fällige Daueraufträge werden zu eingereichten Zahlungsaufträgen. */
export async function dauerauftraegeAusloesen(): Promise<number> {
  await buchSchema();
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const faellig = (await sqlPool`
    SELECT * FROM fiaon_buch_dauerauftrag WHERE beendet_am IS NULL AND naechste_am <= ${heute}::date ORDER BY id`) as any[];
  let angelegt = 0;
  for (const roh of faellig) {
    const d = zuDauerauftrag(roh);
    const person = buchPerson(d.erstelltVon);
    if (!person) continue;
    // Erst den Termin weiterschieben — fällt danach etwas um, entsteht kein zweiter Auftrag.
    const folgetag = new Date(new Date(`${d.naechsteAm}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
    const weiter = (await sqlPool`
      UPDATE fiaon_buch_dauerauftrag SET naechste_am = ${naechsterTermin(d.tagImMonat, folgetag)}
       WHERE id = ${d.id} AND naechste_am = ${d.naechsteAm}::date
      RETURNING id`) as any[];
    if (!weiter.length) continue;
    const monat = new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(`${d.naechsteAm}T12:00:00Z`));
    const neu = await auftragAnlegen({
      empfaenger: d.empfaenger, iban: d.iban, bic: d.bic, betragCents: d.betragCents,
      zweck: `${d.zweck} · ${monat}`, kategorie: d.kategorie, faelligAm: d.naechsteAm,
    }, person);
    await auftragEinreichen(neu.id, person);
    await sqlPool`UPDATE fiaon_buch_dauerauftrag SET letzter_auftrag_id = ${neu.id} WHERE id = ${d.id}`;
    buchProtokoll(null, "Dauerauftrag ausgelöst", neu.nummer, `aus Dauerauftrag ${d.id}`);
    if (person.rolle === "inhaber") {
      benachrichtigen(person.email, `Dauerauftrag fällig: ${neu.nummer} · ${geldText(d.betragCents)}`, [
        `Der Dauerauftrag an ${d.empfaenger} ist fällig. Der Zahlungsauftrag ${neu.nummer} liegt zur Freigabe bereit.`,
      ]);
    }
    angelegt += 1;
  }
  return angelegt;
}
