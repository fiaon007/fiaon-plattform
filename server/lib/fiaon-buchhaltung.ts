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
  { email: "florentine@fiaon.com", name: "Florentine Lombardi", rolle: "buchhaltung", titel: "Künftige Geschäftsführung" },
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

export async function tanAnfordern(person: BuchPerson, zweck: string, ziel: string, beschreibung: string): Promise<{ ok: true } | { ok: false; grund: string }> {
  await buchSchema();
  const tan = String(100000 + (randomBytes(4).readUInt32BE(0) % 900000));
  await sqlPool`UPDATE fiaon_buch_tan SET benutzt_am = NOW() WHERE person = ${person.email} AND zweck = ${zweck} AND benutzt_am IS NULL`;
  await sqlPool`
    INSERT INTO fiaon_buch_tan (person, zweck, ziel, tan_hash, gueltig_bis)
    VALUES (${person.email}, ${zweck}, ${ziel}, ${tanHash(tan, ziel)}, NOW() + ${`${TAN_TTL_S} seconds`}::interval)`;
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
  };
}

const AUFTRAG_FELDER = `id, nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, faellig_am,
  beleg_name, (beleg_base64 IS NOT NULL) AS hat_beleg, status, erstellt_von, erstellt_am, eingereicht_am,
  entschieden_von, entschieden_am, entscheidung_notiz, freigabe_art, ausgefuehrt_von, ausgefuehrt_am,
  bank_referenz, (bestaetigung_base64 IS NOT NULL) AS hat_bestaetigung, payout_id`;

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

/** Darf diese Person diesen Auftrag jetzt freigeben? (ohne TAN-Prüfung) */
export function freigabeMoeglich(a: Auftrag, von: BuchPerson): { ok: true; art: "vier_augen" | "einzel" } | { ok: false; grund: string } {
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
  const t = await tanPruefen(von, "freigabe", freigabeZiel(a), tan);
  if (!t.ok) return t;
  const rows = (await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET status = 'freigegeben', entschieden_von = ${von.email}, entschieden_am = NOW(),
           freigabe_art = ${darf.art}, eingereicht_am = COALESCE(eingereicht_am, NOW())
     WHERE id = ${id} AND status IN ('entwurf', 'eingereicht')
    RETURNING id`) as any[];
  if (!rows.length) return { ok: false, grund: "Der Auftrag hat sich inzwischen verändert. Bitte neu laden." };
  buchProtokoll(von.email, darf.art === "einzel" ? "Auftrag freigegeben (Einzelzeichnung)" : "Auftrag freigegeben", a.nummer, `TAN bestätigt · ${geldText(a.betragCents)}`);
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
  if (von.rolle !== "inhaber") return { ok: false, grund: "Ablehnen darf nur der Inhaber." };
  if (a.status !== "eingereicht") return { ok: false, grund: "Es lassen sich nur eingereichte Aufträge ablehnen." };
  if (!String(notiz || "").trim()) return { ok: false, grund: "Eine Ablehnung braucht einen Grund." };
  await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET status = 'abgelehnt', entschieden_von = ${von.email}, entschieden_am = NOW(), entscheidung_notiz = ${notiz}
     WHERE id = ${id} AND status = 'eingereicht'`;
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
  const ref = String(bankReferenz || "").trim();
  if (!ref) return { ok: false, grund: "Bitte die Referenz der Bank eintragen — ohne sie ist die Ausführung nicht belegt." };
  const tag = (wertAm && /^\d{4}-\d{2}-\d{2}$/.test(wertAm)) ? wertAm : new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

  let hinweis: string | undefined;
  if (a.payoutId) {
    const [p] = (await sqlPool`SELECT status FROM fiaon_payouts WHERE id = ${a.payoutId}`) as any[];
    if (!p) return { ok: false, grund: "Die zugehörige Auszahlung gibt es nicht mehr." };
    if (p.status === "abgelehnt") return { ok: false, grund: "Die zugehörige Auszahlung wurde abgelehnt — bitte den Auftrag zurückziehen." };
    // Erst den Auftrag beanspruchen — ein Doppelklick darf die Auszahlung nicht zweimal abschließen.
    const beansprucht = (await sqlPool`
      UPDATE fiaon_buch_auftrag
         SET status = 'ausgefuehrt', ausgefuehrt_von = ${von.email}, ausgefuehrt_am = NOW(), bank_referenz = ${ref}
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
           SET status = 'ausgefuehrt', ausgefuehrt_von = ${von.email}, ausgefuehrt_am = NOW(), bank_referenz = ${ref}
         WHERE id = ${id} AND status = 'freigegeben'
        RETURNING id`) as any[];
      if (!beansprucht.length) return false;
      await tx`
        INSERT INTO fiaon_buch_bewegung (art, richtung, betrag_cents, wert_am, zweck, gegenpartei, beleg, auftrag_id, erfasst_von)
        VALUES ('ausgabe', -1, ${a.betragCents}, ${tag}, ${a.zweck}, ${a.empfaenger}, ${a.nummer}, ${id}, ${von.email})`;
      return true;
    });
    if (!erfolgt) return { ok: false, grund: "Dieser Auftrag wurde bereits ausgeführt." };
  }
  buchProtokoll(von.email, "Überweisung ausgeführt", a.nummer, `Bankreferenz ${ref}`);

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
