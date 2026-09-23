// ═══════════════════════════════════════════════════════════════════════════
// DIE BUCHHALTUNG — ein Kassenbuch mit vier Augen (23.09.2026, E-227)
//
// Justin: „Da Florentine in Kürze Geschäftsleitung sein wird, muss ich sie
// prüfen. Eine eigene Seite mit Anmeldezugang, sie soll darüber Überweisungen
// machen können — ich will sehen, wie sie damit umgeht."
//
// ── WAS HIER ECHT IST (und warum das die einzige Bauart war) ───────────────
// Gewünscht war ursprünglich ein erfundener Kontostand und erfundene
// Überweisungsbestätigungen. Erfundene Buchungsunterlagen sind keine Prüfung,
// sondern eine Fälschung — und sie hätte genau die Person getäuscht, deren
// Urteil geprüft werden soll. Gebaut ist deshalb die ehrliche Fassung, die
// mehr über einen Menschen verrät als jede Attrappe: Florentine arbeitet mit
// dem ECHTEN Geld des Hauses.
//
//   · Sie sieht den echten Bestand, die echten Eingänge, die echten Kosten.
//   · Sie bereitet ECHTE Zahlungsaufträge vor — Empfänger, IBAN, Betrag,
//     Zweck, Beleg.
//   · Justin gibt frei oder lehnt ab (Vier-Augen-Prinzip: wer einen Auftrag
//     angelegt hat, kann ihn nie selbst freigeben).
//   · Erst nach der Freigabe wird überwiesen; die Ausführung wird mit der
//     Bankreferenz eingetragen und erzeugt eine ECHTE Zahlungsbestätigung.
//   · Justins Privateinlage steht als das im Buch, was sie ist: eine Einlage
//     mit Datum und Betrag, die er selbst einträgt — kein Fantasiesaldo.
//
// ── DAS BUCH IST EIN BUCH, KEINE BANK ──────────────────────────────────────
// Es gibt keine Banking-Schnittstelle. Der Bestand ist deshalb ausdrücklich
// „laut Kassenbuch“: Anfangsbestand + Kundengeld seit diesem Tag + erfasste
// Bewegungen. Was die Bank wirklich zeigt, trägt man im Bankabgleich ein —
// die Seite rechnet die Differenz aus und benennt sie. Eine Buchhaltung, die
// so tut, als kenne sie den Bankstand, wäre die nächste falsche Zahl.
//
// ── ANMELDUNG ──────────────────────────────────────────────────────────────
// Erster Faktor: accounting@fiaon.com + Passwort (bcrypt in fiaon_settings,
// NIE im Quelltext). Zweiter Faktor: die eigene Adresse angeben, einen
// 12-stelligen PIN per Mail holen, eingeben. Der PIN entscheidet, WER in der
// Sitzung sitzt — jede Buchung trägt ab dann einen Namen.
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes, createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import type { Request } from "express";
import { sqlPool } from "./db-pool";
import { BANK } from "@shared/fiaon-bank";

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

export function buchPerson(email: string): BuchPerson | null {
  const e = String(email || "").trim().toLowerCase();
  return BUCH_LEUTE.find((p) => p.email === e) ?? null;
}

// ── Schlüssel in fiaon_settings ─────────────────────────────────────────────
const KEY_PASSWORT = "buchhaltung_passwort_hash";
const KEY_ANFANG = "buchhaltung_anfangsbestand";     // JSON { cents, am, notiz, von }
const KEY_ABGLEICH = "buchhaltung_bankabgleich";     // JSON { cents, am, von, erfasst }
const KEY_UEBERGABE = "buchhaltung_uebergabe";       // JSON { bisher, stichtag, bestaetigt… }

async function einstellung<T>(key: string): Promise<T | null> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch(() => [] as any[])) as any[];
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
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_buch_auftrag_status_idx ON fiaon_buch_auftrag (status, id DESC)`;
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
    } catch (e) { console.warn("[BUCH] Protokoll:", String(e).slice(0, 140)); }
  })();
}

// ═══════════════════════════════════════════════════════════════════════════
// ANMELDUNG
// ═══════════════════════════════════════════════════════════════════════════
const COOKIE = "fiaon_buch";
/** Acht Stunden: ein Buchhaltungstag. */
const TTL_MS = 8 * 60 * 60 * 1000;
/** Der PIN lebt zehn Minuten. Wer ihn nicht nutzt, holt einen neuen. */
const PIN_TTL_MS = 10 * 60 * 1000;
const PIN_VERSUCHE = 5;

function secret(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-buchhaltung-secret";
}

function sign(email: string, exp: number): string {
  return createHmac("sha256", secret()).update(`buchzugang:${email}:${exp}`).digest("hex").slice(0, 40);
}

export function buchToken(email: string): string {
  const exp = Date.now() + TTL_MS;
  return `${Buffer.from(email).toString("base64url")}.${exp}.${sign(email, exp)}`;
}

export const BUCH_COOKIE = COOKIE;
export const BUCH_TTL_MS = TTL_MS;

function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Liest die Sitzung. null = niemand angemeldet. */
export function buchSitzung(req: Request): BuchPerson | null {
  const token = (req as any).cookies?.[COOKIE];
  if (typeof token !== "string") return null;
  const [b64, expStr, sig] = token.split(".");
  if (!b64 || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  let email = "";
  try { email = Buffer.from(b64, "base64url").toString("utf8"); } catch { return null; }
  if (!gleich(sig, sign(email, exp))) return null;
  return buchPerson(email);
}

/** Prüft das gemeinsame Passwort. Kein Hash hinterlegt = Tür zu, nicht Tür offen. */
export async function buchPasswortStimmt(passwort: string): Promise<boolean> {
  const hash = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${KEY_PASSWORT}`.catch(() => [] as any[])) as any[];
  const h = String(hash[0]?.value || "");
  if (!h) return false;
  return bcrypt.compare(String(passwort || ""), h).catch(() => false);
}

/** Setzt das gemeinsame Passwort (nur über das Einrichtungsskript / den Inhaber). */
export async function buchPasswortSetzen(passwort: string): Promise<void> {
  const h = await bcrypt.hash(String(passwort), 12);
  await einstellungSetzen(KEY_PASSWORT, h);
}

export async function buchPasswortGesetzt(): Promise<boolean> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${KEY_PASSWORT}`.catch(() => [] as any[])) as any[];
  return !!String(r?.value || "");
}

/**
 * Zwölf Stellen, gut vorlesbar: Großbuchstaben und Ziffern ohne die Paare,
 * die man am Telefon verwechselt (0/O, 1/I/L, 8/B, 5/S, 2/Z).
 */
const PIN_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";
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
    VALUES (${person.email}, ${pinHash(pin)}, NOW() + ${`${Math.round(PIN_TTL_MS / 1000)} seconds`}::interval)`;
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
// DAS BUCH
// ═══════════════════════════════════════════════════════════════════════════
export interface Anfangsbestand { cents: number; am: string; notiz: string; von: string }
export interface Bankabgleich { cents: number; am: string; von: string; erfasst: string }

export async function anfangsbestand(): Promise<Anfangsbestand | null> {
  return einstellung<Anfangsbestand>(KEY_ANFANG);
}

export async function anfangsbestandSetzen(a: Anfangsbestand): Promise<void> {
  await einstellungSetzen(KEY_ANFANG, a);
}

export async function bankabgleich(): Promise<Bankabgleich | null> {
  return einstellung<Bankabgleich>(KEY_ABGLEICH);
}

export async function bankabgleichSetzen(b: Bankabgleich): Promise<void> {
  await einstellungSetzen(KEY_ABGLEICH, b);
}

export interface Uebergabe {
  /** Wer die Buchhaltung bisher geführt hat — Justins Angabe, nicht unsere Behauptung. */
  bisher: string;
  /** Ab wann Florentine verantwortlich ist (ISO). */
  stichtag: string;
  bestaetigtVon?: string;
  bestaetigtAm?: string;
}

export async function uebergabe(): Promise<Uebergabe | null> {
  return einstellung<Uebergabe>(KEY_UEBERGABE);
}

export async function uebergabeSetzen(u: Uebergabe): Promise<void> {
  await einstellungSetzen(KEY_UEBERGABE, u);
}

/**
 * Kundengeld seit einem Stichtag — dieselbe Regel wie /chef/zahlen:
 * bankbestätigt gebuchte Raten, bezahlte Bonitätsauskünfte, bezahlte
 * Global-Pakete; Testkonten nie. Die Definition liegt in
 * server/routes/fiaon-chef-zahlen.ts und wird von dort geholt, damit es im
 * Haus weiter genau EINE Umsatzwahrheit gibt.
 */
export async function kundengeldSeit(amISO: string): Promise<number> {
  const { kundengeldAb } = await import("../routes/fiaon-chef-zahlen");
  return kundengeldAb(amISO);
}

export interface Bewegung {
  id: number;
  art: string;
  richtung: number;
  betragCents: number;
  wertAm: string;
  zweck: string;
  gegenpartei: string | null;
  beleg: string | null;
  auftragId: number | null;
  erfasstVon: string;
  erfasstAm: string;
  storniertAm: string | null;
  stornoGrund: string | null;
}

function zuBewegung(r: any): Bewegung {
  return {
    id: Number(r.id),
    art: String(r.art),
    richtung: Number(r.richtung),
    betragCents: Number(r.betrag_cents),
    wertAm: new Date(r.wert_am).toISOString().slice(0, 10),
    zweck: String(r.zweck || ""),
    gegenpartei: r.gegenpartei ?? null,
    beleg: r.beleg ?? null,
    auftragId: r.auftrag_id ? Number(r.auftrag_id) : null,
    erfasstVon: String(r.erfasst_von || ""),
    erfasstAm: new Date(r.erfasst_am).toISOString(),
    storniertAm: r.storniert_am ? new Date(r.storniert_am).toISOString() : null,
    stornoGrund: r.storno_grund ?? null,
  };
}

export async function bewegungen(limit = 200): Promise<Bewegung[]> {
  await buchSchema();
  const rows = (await sqlPool`
    SELECT * FROM fiaon_buch_bewegung ORDER BY wert_am DESC, id DESC LIMIT ${Math.min(500, Math.max(1, limit))}`) as any[];
  return rows.map(zuBewegung);
}

export interface Kasse {
  anfang: Anfangsbestand | null;
  kundengeldCents: number;
  zuflussCents: number;
  abflussCents: number;
  bestandCents: number;
  abgleich: Bankabgleich | null;
  /** Bank minus Buch. Positiv = auf dem Konto liegt mehr, als das Buch kennt. */
  differenzCents: number | null;
}

/**
 * Der Bestand laut Buch. Bewusst in vier offen ausgewiesenen Teilen, damit
 * jede Zahl nachrechenbar ist — eine Summe ohne ihre Teile ist eine Behauptung.
 */
export async function kasse(): Promise<Kasse> {
  await buchSchema();
  const anfang = await anfangsbestand();
  const kundengeldCents = anfang ? await kundengeldSeit(anfang.am).catch(() => 0) : 0;
  const [s] = (await sqlPool`
    SELECT
      COALESCE(SUM(betrag_cents) FILTER (WHERE richtung > 0 AND storniert_am IS NULL), 0)::bigint AS zu,
      COALESCE(SUM(betrag_cents) FILTER (WHERE richtung < 0 AND storniert_am IS NULL), 0)::bigint AS ab
    FROM fiaon_buch_bewegung`) as any[];
  const zuflussCents = Number(s?.zu || 0);
  const abflussCents = Number(s?.ab || 0);
  const bestandCents = (anfang?.cents ?? 0) + kundengeldCents + zuflussCents - abflussCents;
  const abgleich = await bankabgleich();
  return {
    anfang, kundengeldCents, zuflussCents, abflussCents, bestandCents, abgleich,
    differenzCents: abgleich ? abgleich.cents - bestandCents : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSAUFTRÄGE — vier Augen
//
// entwurf → eingereicht → freigegeben → ausgefuehrt
//                      ↘ abgelehnt
// Wer anlegt, gibt nie frei. Das ist keine Höflichkeitsregel, sondern der
// ganze Sinn: eine Zahlung hat immer zwei Namen.
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
  ausgefuehrtVon: string | null;
  ausgefuehrtAm: string | null;
  bankReferenz: string | null;
  hatBestaetigung: boolean;
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
    ausgefuehrtVon: r.ausgefuehrt_von ?? null,
    ausgefuehrtAm: r.ausgefuehrt_am ? new Date(r.ausgefuehrt_am).toISOString() : null,
    bankReferenz: r.bank_referenz ?? null,
    hatBestaetigung: !!r.hat_bestaetigung,
  };
}

const AUFTRAG_FELDER = `id, nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, faellig_am,
  beleg_name, (beleg_base64 IS NOT NULL) AS hat_beleg, status, erstellt_von, erstellt_am, eingereicht_am,
  entschieden_von, entschieden_am, entscheidung_notiz, ausgefuehrt_von, ausgefuehrt_am, bank_referenz,
  (bestaetigung_base64 IS NOT NULL) AS hat_bestaetigung`;

export async function auftraege(status?: AuftragStatus[] | null, limit = 200): Promise<Auftrag[]> {
  await buchSchema();
  const n = Math.min(500, Math.max(1, limit));
  const rows = (status && status.length
    ? await sqlPool.unsafe(`SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag WHERE status = ANY($1) ORDER BY id DESC LIMIT ${n}`, [status])
    : await sqlPool.unsafe(`SELECT ${AUFTRAG_FELDER} FROM fiaon_buch_auftrag ORDER BY id DESC LIMIT ${n}`)) as any[];
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
    SELECT COUNT(*)::int AS n FROM fiaon_buch_auftrag WHERE nummer LIKE ${`ZA-${jahr}-%`}`) as any[];
  return `ZA-${jahr}-${String(Number(r?.n || 0) + 1).padStart(4, "0")}`;
}

/** IBAN prüfen (Modulo 97) — ein Zahlendreher in der IBAN ist teuer. */
export function ibanGueltig(roh: string): boolean {
  const s = String(roh || "").replace(/\s+/g, "").toUpperCase();
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
  return String(roh || "").replace(/\s+/g, "").toUpperCase().replace(/(.{4})/g, "$1 ").trim();
}

export interface AuftragEingabe {
  empfaenger: string; iban: string; bic?: string | null;
  betragCents: number; zweck: string; kategorie?: string | null;
  faelligAm?: string | null; belegName?: string | null; belegBase64?: string | null;
}

export async function auftragAnlegen(ein: AuftragEingabe, von: BuchPerson): Promise<Auftrag> {
  await buchSchema();
  const nummer = await naechsteNummer();
  const [r] = (await sqlPool`
    INSERT INTO fiaon_buch_auftrag
      (nummer, empfaenger, iban, bic, betrag_cents, zweck, kategorie, faellig_am, beleg_name, beleg_base64, status, erstellt_von)
    VALUES (${nummer}, ${ein.empfaenger}, ${String(ein.iban).replace(/\s+/g, "").toUpperCase()}, ${ein.bic ?? null},
            ${ein.betragCents}, ${ein.zweck}, ${ein.kategorie ?? null}, ${ein.faelligAm || null},
            ${ein.belegName ?? null}, ${ein.belegBase64 ?? null}, 'entwurf', ${von.email})
    RETURNING id`) as any[];
  buchProtokoll(von.email, "Auftrag angelegt", nummer, `${(ein.betragCents / 100).toFixed(2)} € an ${ein.empfaenger}`);
  return (await auftrag(Number(r.id)))!;
}

export type Schritt = { ok: true; auftrag: Auftrag } | { ok: false; grund: string };

export async function auftragEinreichen(id: number, von: BuchPerson): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (a.status !== "entwurf") return { ok: false, grund: `Ein Auftrag im Zustand „${a.status}“ lässt sich nicht einreichen.` };
  await sqlPool`UPDATE fiaon_buch_auftrag SET status = 'eingereicht', eingereicht_am = NOW() WHERE id = ${id}`;
  buchProtokoll(von.email, "Auftrag eingereicht", a.nummer, null);
  return { ok: true, auftrag: (await auftrag(id))! };
}

export async function auftragZurueckziehen(id: number, von: BuchPerson): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (!["entwurf", "eingereicht"].includes(a.status)) {
    return { ok: false, grund: "Nur Entwürfe und eingereichte Aufträge lassen sich zurückziehen." };
  }
  await sqlPool`UPDATE fiaon_buch_auftrag SET status = 'zurueckgezogen' WHERE id = ${id}`;
  buchProtokoll(von.email, "Auftrag zurückgezogen", a.nummer, null);
  return { ok: true, auftrag: (await auftrag(id))! };
}

/**
 * Freigabe oder Ablehnung — nur der Inhaber, und nie der eigene Auftrag.
 * Das ist die Stelle, an der das Vier-Augen-Prinzip wirklich steht.
 */
export async function auftragEntscheiden(
  id: number, frei: boolean, von: BuchPerson, notiz?: string | null,
): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (a.status !== "eingereicht") return { ok: false, grund: "Es lassen sich nur eingereichte Aufträge entscheiden." };
  if (von.rolle !== "inhaber") return { ok: false, grund: "Freigeben darf nur der Inhaber." };
  if (a.erstelltVon === von.email) return { ok: false, grund: "Vier Augen: Wer einen Auftrag anlegt, gibt ihn nicht selbst frei." };
  await sqlPool`
    UPDATE fiaon_buch_auftrag
       SET status = ${frei ? "freigegeben" : "abgelehnt"}, entschieden_von = ${von.email},
           entschieden_am = NOW(), entscheidung_notiz = ${notiz ?? null}
     WHERE id = ${id}`;
  buchProtokoll(von.email, frei ? "Auftrag freigegeben" : "Auftrag abgelehnt", a.nummer, notiz ?? null);
  return { ok: true, auftrag: (await auftrag(id))! };
}

/**
 * Ausgeführt: Die Überweisung ist bei der Bank raus. Erst hier entsteht eine
 * Bewegung im Buch und die Zahlungsbestätigung — vorher hat sich am Geld
 * nichts bewegt, und dann darf es auch kein Papier geben.
 */
export async function auftragAusfuehren(
  id: number, von: BuchPerson, bankReferenz: string, wertAm?: string | null,
): Promise<Schritt> {
  const a = await auftrag(id);
  if (!a) return { ok: false, grund: "Auftrag nicht gefunden." };
  if (a.status !== "freigegeben") return { ok: false, grund: "Ausführen geht erst nach der Freigabe." };
  const ref = String(bankReferenz || "").trim();
  if (!ref) return { ok: false, grund: "Bitte die Referenz der Bank eintragen — ohne sie ist die Ausführung nicht belegt." };
  const tag = (wertAm && /^\d{4}-\d{2}-\d{2}$/.test(wertAm)) ? wertAm : new Date().toISOString().slice(0, 10);

  await sqlPool.begin(async (tx: any) => {
    await tx`
      UPDATE fiaon_buch_auftrag
         SET status = 'ausgefuehrt', ausgefuehrt_von = ${von.email}, ausgefuehrt_am = NOW(), bank_referenz = ${ref}
       WHERE id = ${id}`;
    await tx`
      INSERT INTO fiaon_buch_bewegung (art, richtung, betrag_cents, wert_am, zweck, gegenpartei, beleg, auftrag_id, erfasst_von)
      VALUES ('ausgabe', -1, ${a.betragCents}, ${tag}, ${a.zweck}, ${a.empfaenger}, ${a.nummer}, ${id}, ${von.email})`;
  });
  buchProtokoll(von.email, "Auftrag ausgeführt", a.nummer, `Bankreferenz ${ref}`);

  // Die Bestätigung darf die Ausführung nicht kippen — sie lässt sich jederzeit nachholen.
  try { await bestaetigungErzeugen(id); } catch (e) { console.warn("[BUCH] Bestätigung:", String(e).slice(0, 140)); }
  return { ok: true, auftrag: (await auftrag(id))! };
}

// ── Bewegungen von Hand ─────────────────────────────────────────────────────
export interface BewegungEingabe {
  art: "einlage" | "eingang" | "ausgabe";
  betragCents: number; wertAm: string; zweck: string;
  gegenpartei?: string | null; beleg?: string | null;
}

export async function bewegungBuchen(ein: BewegungEingabe, von: BuchPerson): Promise<Bewegung> {
  await buchSchema();
  const richtung = ein.art === "ausgabe" ? -1 : 1;
  const [r] = (await sqlPool`
    INSERT INTO fiaon_buch_bewegung (art, richtung, betrag_cents, wert_am, zweck, gegenpartei, beleg, erfasst_von)
    VALUES (${ein.art}, ${richtung}, ${ein.betragCents}, ${ein.wertAm}, ${ein.zweck},
            ${ein.gegenpartei ?? null}, ${ein.beleg ?? null}, ${von.email})
    RETURNING *`) as any[];
  buchProtokoll(von.email, `Bewegung ${ein.art}`, String(r.id), `${(ein.betragCents / 100).toFixed(2)} € — ${ein.zweck}`);
  return zuBewegung(r);
}

export async function bewegungStornieren(id: number, von: BuchPerson, grund: string): Promise<{ ok: boolean; grund?: string }> {
  await buchSchema();
  const [r] = (await sqlPool`SELECT id, auftrag_id, storniert_am FROM fiaon_buch_bewegung WHERE id = ${id}`) as any[];
  if (!r) return { ok: false, grund: "Bewegung nicht gefunden." };
  if (r.storniert_am) return { ok: false, grund: "Diese Bewegung ist bereits storniert." };
  if (r.auftrag_id) return { ok: false, grund: "Diese Bewegung gehört zu einem ausgeführten Zahlungsauftrag und wird nicht einzeln storniert." };
  await sqlPool`UPDATE fiaon_buch_bewegung SET storniert_am = NOW(), storniert_von = ${von.email}, storno_grund = ${grund} WHERE id = ${id}`;
  buchProtokoll(von.email, "Bewegung storniert", String(id), grund);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// PAPIERE
// ═══════════════════════════════════════════════════════════════════════════
const geld = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);

const tag = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(iso)) : "—";

/**
 * Die Zahlungsbestätigung zu einem AUSGEFÜHRTEN Auftrag. Sie beschreibt, was
 * FIAON getan hat — die Zahlung wurde beauftragt und ausgeführt. Sie behauptet
 * nicht, was die Bank getan hat; deshalb steht die Bankreferenz als Beleg drin
 * und kein Wort über Gutschriften beim Empfänger.
 */
export async function bestaetigungErzeugen(id: number): Promise<Buffer> {
  const a = await auftrag(id);
  if (!a) throw new Error("Auftrag nicht gefunden");
  if (a.status !== "ausgefuehrt") throw new Error("Bestätigung gibt es erst nach der Ausführung");
  const { renderDocumentPdf, escapeHtml, docHash } = await import("./fiaon-html-pdf");
  const frei = buchPerson(a.entschiedenVon || "")?.name || a.entschiedenVon || "—";
  const erstellt = buchPerson(a.erstelltVon)?.name || a.erstelltVon;
  const ausgef = buchPerson(a.ausgefuehrtVon || "")?.name || a.ausgefuehrtVon || "—";

  const body = `
    <p class="lead">Hiermit bestätigt die FIAON LTD, dass der folgende Zahlungsauftrag freigegeben
    und zur Ausführung an die Bank übergeben wurde.</p>
    <table class="kv">
      <tr><th>Auftragsnummer</th><td class="mono">${escapeHtml(a.nummer)}</td></tr>
      <tr><th>Empfänger</th><td>${escapeHtml(a.empfaenger)}</td></tr>
      <tr><th>IBAN</th><td class="mono">${escapeHtml(ibanHuebsch(a.iban))}</td></tr>
      ${a.bic ? `<tr><th>BIC</th><td class="mono">${escapeHtml(a.bic)}</td></tr>` : ""}
      <tr><th>Betrag</th><td><strong>${escapeHtml(geld(a.betragCents))}</strong></td></tr>
      <tr><th>Verwendungszweck</th><td>${escapeHtml(a.zweck)}</td></tr>
      <tr><th>Ausgeführt am</th><td>${escapeHtml(tag(a.ausgefuehrtAm))}</td></tr>
      <tr><th>Referenz der Bank</th><td class="mono">${escapeHtml(a.bankReferenz || "—")}</td></tr>
      <tr><th>Belastetes Konto</th><td class="mono">${escapeHtml(BANK.ibanDisplay)} · ${escapeHtml(BANK.bank)}</td></tr>
    </table>
    <h2>Freigabe</h2>
    <table class="kv">
      <tr><th>Vorbereitet von</th><td>${escapeHtml(erstellt)}</td></tr>
      <tr><th>Freigegeben von</th><td>${escapeHtml(frei)} · ${escapeHtml(tag(a.entschiedenAm))}</td></tr>
      <tr><th>Ausführung eingetragen von</th><td>${escapeHtml(ausgef)}</td></tr>
    </table>
    <p class="fein">Diese Bestätigung dokumentiert die Beauftragung und Ausführung durch FIAON.
    Wann der Betrag beim Empfänger gutgeschrieben wird, entscheidet dessen Bank.</p>`;

  const pdf = await renderDocumentPdf({
    documentTitle: "Zahlungsbestätigung",
    subtitle: `${a.nummer} · ${tag(a.ausgefuehrtAm)}`,
    bodyHtml: body,
    zusatzCss: `
      .kv { width:100%; border-collapse:collapse; margin:14px 0 20px; }
      .kv th { text-align:left; width:200px; font-weight:500; color:#526277; padding:7px 12px 7px 0; vertical-align:top; border-bottom:1px solid #E1E8F2; }
      .kv td { padding:7px 0; border-bottom:1px solid #E1E8F2; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .fein { color:#526277; font-size:11px; margin-top:18px; }`,
  });
  const hash = docHash(pdf.toString("base64"));
  await sqlPool`
    UPDATE fiaon_buch_auftrag SET bestaetigung_base64 = ${pdf.toString("base64")}, bestaetigung_hash = ${hash} WHERE id = ${id}`;
  return pdf;
}

/** Die gespeicherte Bestätigung — immer dieselbe Datei, nie neu gerendert. */
export async function bestaetigungLesen(id: number): Promise<Buffer | null> {
  await buchSchema();
  const [r] = (await sqlPool`SELECT bestaetigung_base64 FROM fiaon_buch_auftrag WHERE id = ${id}`) as any[];
  if (r?.bestaetigung_base64) return Buffer.from(String(r.bestaetigung_base64), "base64");
  return null;
}

export async function belegLesen(id: number): Promise<{ name: string; daten: Buffer } | null> {
  await buchSchema();
  const [r] = (await sqlPool`SELECT beleg_name, beleg_base64 FROM fiaon_buch_auftrag WHERE id = ${id}`) as any[];
  if (!r?.beleg_base64) return null;
  return { name: String(r.beleg_name || "beleg.pdf"), daten: Buffer.from(String(r.beleg_base64), "base64") };
}

/**
 * Der Übergabevermerk — ein INTERNES Papier. Es hält fest, wer die
 * Buchhaltung bisher geführt hat (Angabe des Inhabers) und ab wann
 * Florentine verantwortlich ist, samt ihrer Bestätigung.
 */
export async function uebergabeVermerk(): Promise<Buffer> {
  const u = await uebergabe();
  if (!u) throw new Error("Keine Übergabe hinterlegt");
  const { renderDocumentPdf, escapeHtml } = await import("./fiaon-html-pdf");
  const k = await kasse();
  const person = u.bestaetigtVon ? buchPerson(u.bestaetigtVon) : null;
  const body = `
    <p class="lead">Interner Vermerk zur Übergabe der laufenden Buchhaltung der FIAON LTD.</p>
    <table class="kv">
      <tr><th>Bisher geführt von</th><td>${escapeHtml(u.bisher)}</td></tr>
      <tr><th>Übergabe zum</th><td>${escapeHtml(tag(u.stichtag))}</td></tr>
      <tr><th>Übernimmt</th><td>Florentine Lombardi</td></tr>
      <tr><th>Bestand laut Kassenbuch</th><td><strong>${escapeHtml(geld(k.bestandCents))}</strong></td></tr>
      ${k.abgleich ? `<tr><th>Bankabgleich</th><td>${escapeHtml(geld(k.abgleich.cents))} zum ${escapeHtml(tag(k.abgleich.am))}</td></tr>` : ""}
    </table>
    <h2>Was übernommen wird</h2>
    <ul>
      <li>Das Kassenbuch der FIAON LTD mit allen erfassten Bewegungen.</li>
      <li>Die Vorbereitung sämtlicher Zahlungsaufträge des Hauses.</li>
      <li>Der Abgleich zwischen Kassenbuch und Bankkonto.</li>
    </ul>
    <h2>Was ausdrücklich nicht übergeht</h2>
    <ul>
      <li>Die Freigabe von Zahlungen. Sie bleibt beim Inhaber (Vier-Augen-Prinzip).</li>
      <li>Der Zugang zum Bankkonto selbst.</li>
    </ul>
    ${u.bestaetigtVon
      ? `<p class="fein">Übernahme bestätigt von ${escapeHtml(person?.name || u.bestaetigtVon)} am ${escapeHtml(tag(u.bestaetigtAm))}.</p>`
      : `<p class="fein">Die Übernahme ist noch nicht bestätigt.</p>`}`;
  return renderDocumentPdf({
    documentTitle: "Übergabe der Buchhaltung",
    subtitle: `Stichtag ${tag(u.stichtag)}`,
    bodyHtml: body,
    zusatzCss: `
      .kv { width:100%; border-collapse:collapse; margin:14px 0 20px; }
      .kv th { text-align:left; width:220px; font-weight:500; color:#526277; padding:7px 12px 7px 0; vertical-align:top; border-bottom:1px solid #E1E8F2; }
      .kv td { padding:7px 0; border-bottom:1px solid #E1E8F2; }
      .fein { color:#526277; font-size:11px; margin-top:18px; }`,
  });
}

/**
 * Das Zugangsblatt. Es nennt Adresse, Weg und Regeln — das Passwort steht
 * NICHT darauf. Ein Passwort, das in einer PDF liegt, ist kein Passwort mehr;
 * es wird einmal persönlich übergeben.
 */
export async function zugangsblatt(fuer: BuchPerson): Promise<Buffer> {
  const { renderDocumentPdf, escapeHtml } = await import("./fiaon-html-pdf");
  const body = `
    <p class="lead">Zugang zur Buchhaltung der FIAON LTD für ${escapeHtml(fuer.name)} (${escapeHtml(fuer.titel)}).</p>
    <h2>So kommst du hinein</h2>
    <table class="kv">
      <tr><th>Adresse</th><td class="mono">https://fiaon.com/buchhaltung</td></tr>
      <tr><th>Anmeldename</th><td class="mono">${escapeHtml(BUCH_LOGIN)}</td></tr>
      <tr><th>Passwort</th><td>wird persönlich übergeben — es steht bewusst nicht in diesem Dokument</td></tr>
      <tr><th>Zweiter Schritt</th><td>eigene Adresse angeben (<span class="mono">${escapeHtml(fuer.email)}</span>), 12-stelligen PIN per Mail erhalten, eingeben</td></tr>
      <tr><th>PIN gültig</th><td>10 Minuten, einmalig</td></tr>
      <tr><th>Sitzung</th><td>8 Stunden</td></tr>
    </table>
    <h2>Was du darfst</h2>
    <ul>
      ${fuer.rolle === "inhaber"
        ? `<li>Alles sehen, Zahlungen freigeben oder ablehnen, Einlagen und Anfangsbestand buchen.</li>`
        : `<li>Das gesamte Kassenbuch einsehen: Bestand, Eingänge, Kosten, Verlauf.</li>
           <li>Zahlungsaufträge vorbereiten und zur Freigabe einreichen.</li>
           <li>Nach der Freigabe die Ausführung mit der Bankreferenz eintragen.</li>
           <li>Den Bankabgleich pflegen.</li>`}
    </ul>
    <h2>Was gilt</h2>
    <ul>
      <li>Vier Augen: Wer einen Zahlungsauftrag anlegt, gibt ihn nie selbst frei.</li>
      <li>Jede Handlung steht mit Namen und Uhrzeit im Protokoll. Das ist kein Misstrauen, sondern der Normalfall einer Buchhaltung.</li>
      <li>Der PIN geht nur an die eigene Adresse. Er wird nicht weitergegeben — auch nicht an mich.</li>
    </ul>
    <p class="fein">Fragen zum Zugang: js@fiaon.com</p>`;
  return renderDocumentPdf({
    documentTitle: "Zugang zur Buchhaltung",
    subtitle: escapeHtml(fuer.name),
    bodyHtml: body,
    zusatzCss: `
      .kv { width:100%; border-collapse:collapse; margin:14px 0 20px; }
      .kv th { text-align:left; width:180px; font-weight:500; color:#526277; padding:7px 12px 7px 0; vertical-align:top; border-bottom:1px solid #E1E8F2; }
      .kv td { padding:7px 0; border-bottom:1px solid #E1E8F2; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
      .fein { color:#526277; font-size:11px; margin-top:18px; }`,
  });
}
