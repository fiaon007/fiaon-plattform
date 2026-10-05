// ═══════════════════════════════════════════════════════════════════════════
// DIE PERSÖNLICHE FIAON-PIN (05.10.2026, E-282)
//
// Justin: „Nach der Bonitätsprüfung soll der Kunde einen 4-stelligen
// persönlichen Code auswählen … mit der wir ihn verifizieren können … er kann
// den jederzeit auf der Plattform ändern."
//
// ── WIE SIE GESPEICHERT WIRD ─────────────────────────────────────────────
// Nur als Hash in fiaon_applications.kunden_pin_hash (an der Antragszeile wie
// das Passwort — die Personen-Zusammenführung hängt Antragszeilen mit um, eine
// eigene Tabelle würde sie verlieren). Vier Ziffern sind nur 10.000 Werte; ein
// Salz allein schützt bei einem Datenbank-Leck kaum. Darum zusätzlich ein
// Geheimnis außerhalb der Datenbank („Pepper"): FIAON_PIN_PEPPER, sonst aus
// SESSION_SECRET abgeleitet. Welches benutzt wurde, steht im Hash selbst
// (Kennbuchstabe e/s) — ein späteres Eintragen von FIAON_PIN_PEPPER macht
// bestehende PINs also nicht ungültig.
//
// ── SPERRE ───────────────────────────────────────────────────────────────
// Fünf Fehlversuche (Telefon-Prüfung oder Ändern) sperren die Prüfung für 15
// Minuten. Gezählt wird in der Datenbank, nicht im Speicher.
//
// Die PIN ist KEINE Karten-PIN (die vergibt allein die Bank) und wird NIE
// angezeigt, gemailt oder protokolliert.
// ═══════════════════════════════════════════════════════════════════════════
import type { Request, Response } from "express";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { sqlPool } from "./db-pool";
import { pinPruefen, PIN_MAX_FEHLVERSUCHE, PIN_SPERRE_MINUTEN } from "@shared/fiaon-antrag-neu";

const N = 16384, R = 8, P = 1, LAENGE = 32;

function pepper(): { art: "e" | "s"; wert: string } {
  const eigen = process.env.FIAON_PIN_PEPPER;
  if (eigen && eigen.length >= 16) return { art: "e", wert: eigen };
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!s) throw new Error("Weder FIAON_PIN_PEPPER noch SESSION_SECRET gesetzt — PIN kann nicht sicher gespeichert werden.");
  return { art: "s", wert: createHmac("sha256", s).update("fiaon-kunden-pin-v1").digest("base64") };
}
function pepperFuer(art: string): string | null {
  if (art === "e") { const e = process.env.FIAON_PIN_PEPPER; return e && e.length >= 16 ? e : null; }
  if (art === "s") {
    const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
    return s ? createHmac("sha256", s).update("fiaon-kunden-pin-v1").digest("base64") : null;
  }
  return null;
}

/** pin1$<e|s>$salzB64$hashB64 */
export function pinHashen(pin: string): string {
  const p = pepper();
  const salz = randomBytes(16);
  const hash = scryptSync(`${p.wert}:${pin}`, salz, LAENGE, { N, r: R, p: P });
  return `pin1$${p.art}$${salz.toString("base64")}$${hash.toString("base64")}`;
}

export function pinPasst(gespeichert: unknown, eingabe: string): boolean {
  if (typeof gespeichert !== "string" || !gespeichert.startsWith("pin1$") || !/^\d{4}$/.test(eingabe)) return false;
  const [, art, salzB64, hashB64] = gespeichert.split("$");
  const pw = pepperFuer(art);
  if (!pw) return false;
  try {
    const erwartet = Buffer.from(hashB64, "base64");
    const ist = scryptSync(`${pw}:${eingabe}`, Buffer.from(salzB64, "base64"), erwartet.length, { N, r: R, p: P });
    return ist.length === erwartet.length && timingSafeEqual(ist, erwartet);
  } catch {
    return false;
  }
}

function geburtAus(birthdate: unknown): { tag?: number; monat?: number; jahr?: number } | null {
  const m = String(birthdate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { jahr: Number(m[1]), monat: Number(m[2]), tag: Number(m[3]) } : null;
}

export type PinSetzenErgebnis =
  | { ok: true }
  | { ok: false; status: number; code: "SCHWACH" | "SCHON_GESETZT" | "UNBEKANNT"; meldung: string };

/**
 * Erste PIN im Antrag. Nur, solange noch keine gesetzt ist — sonst könnte jeder
 * mit dem 48-Stunden-Antrags-Cookie die PIN überschreiben. Ändern geht nur über
 * den Kundenbereich (pinAendern).
 */
export async function pinErstmalsSetzen(ref: string, pin: string): Promise<PinSetzenErgebnis> {
  const [z] = await sqlPool<{ birthdate: string | null; kunden_pin_hash: string | null }[]>`
    SELECT birthdate, kunden_pin_hash FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`;
  if (!z) return { ok: false, status: 404, code: "UNBEKANNT", meldung: "Diesen Antrag finden wir nicht." };
  if (z.kunden_pin_hash) return { ok: false, status: 409, code: "SCHON_GESETZT", meldung: "Ihre PIN ist schon festgelegt. Ändern können Sie sie in Ihrem Kundenbereich." };
  const grund = pinPruefen(pin, geburtAus(z.birthdate));
  if (grund) return { ok: false, status: 400, code: "SCHWACH", meldung: grund };
  const hash = pinHashen(pin);
  const r = await sqlPool`
    UPDATE fiaon_applications SET kunden_pin_hash = ${hash}, kunden_pin_gesetzt_am = NOW(),
      kunden_pin_fehlversuche = 0, kunden_pin_gesperrt_bis = NULL
    WHERE ref = ${ref} AND kunden_pin_hash IS NULL`;
  if (r.count === 0) return { ok: false, status: 409, code: "SCHON_GESETZT", meldung: "Ihre PIN ist schon festgelegt. Ändern können Sie sie in Ihrem Kundenbereich." };
  return { ok: true };
}

export type PinPruefErgebnis =
  | { ok: true; stimmt: boolean; gesperrt: false; restVersuche: number }
  | { ok: true; stimmt: false; gesperrt: true; gesperrtBis: string }
  | { ok: false; status: number; code: "KEINE_PIN" | "UNBEKANNT"; meldung: string };

/**
 * Prüft eine PIN gegen die Antragszeile (Telefon-Prüfung durch Mitarbeiter,
 * Ändern im Bereich). Zählt Fehlversuche und sperrt ab dem fünften für
 * 15 Minuten. Gibt nie einen Hinweis auf die PIN selbst.
 */
export async function pinVersuch(ref: string, eingabe: string): Promise<PinPruefErgebnis> {
  const [z] = await sqlPool<{ kunden_pin_hash: string | null; kunden_pin_gesperrt_bis: Date | null }[]>`
    SELECT kunden_pin_hash, kunden_pin_gesperrt_bis FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
  if (!z) return { ok: false, status: 404, code: "UNBEKANNT", meldung: "Diesen Kunden finden wir nicht." };
  if (!z.kunden_pin_hash) return { ok: false, status: 409, code: "KEINE_PIN", meldung: "Für diesen Kunden ist noch keine PIN festgelegt." };
  // ── DER VERSUCH WIRD VOR DEM VERGLEICH RESERVIERT (Gegenprüfung 05.10.2026) ──
  // Vorher: lesen → scrypt → Zähler erhöhen. Gleichzeitige Anfragen lasen alle
  // „nicht gesperrt“ und wurden alle geprüft — die Sperre nach fünf Versuchen
  // ließ sich mit parallelen Anfragen überspringen. Jetzt zählt EIN atomares
  // UPDATE den Versuch, bevor gerechnet wird; ist die Zeile gesperrt, kommt keine
  // Zeile zurück. Eine abgelaufene Sperre beginnt wieder bei null.
  const [r] = await sqlPool<{ kunden_pin_hash: string; kunden_pin_fehlversuche: number; kunden_pin_gesperrt_bis: Date | null }[]>`
    UPDATE fiaon_applications
       SET kunden_pin_fehlversuche = (CASE WHEN kunden_pin_gesperrt_bis IS NOT NULL THEN 0 ELSE COALESCE(kunden_pin_fehlversuche, 0) END) + 1,
           kunden_pin_gesperrt_bis = CASE
             WHEN (CASE WHEN kunden_pin_gesperrt_bis IS NOT NULL THEN 0 ELSE COALESCE(kunden_pin_fehlversuche, 0) END) + 1 >= ${PIN_MAX_FEHLVERSUCHE}
               THEN NOW() + make_interval(mins => ${PIN_SPERRE_MINUTEN}::int)
             ELSE NULL END
     WHERE ref = ${ref} AND kunden_pin_hash IS NOT NULL
       AND (kunden_pin_gesperrt_bis IS NULL OR kunden_pin_gesperrt_bis <= NOW())
     RETURNING kunden_pin_hash, kunden_pin_fehlversuche, kunden_pin_gesperrt_bis`;
  if (!r) {
    const bis = z.kunden_pin_gesperrt_bis ? new Date(z.kunden_pin_gesperrt_bis) : new Date(Date.now() + PIN_SPERRE_MINUTEN * 60000);
    const [neu] = await sqlPool<{ kunden_pin_gesperrt_bis: Date | null }[]>`SELECT kunden_pin_gesperrt_bis FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
    return { ok: true, stimmt: false, gesperrt: true, gesperrtBis: new Date(neu?.kunden_pin_gesperrt_bis ?? bis).toISOString() };
  }
  if (pinPasst(r.kunden_pin_hash, eingabe)) {
    await sqlPool`UPDATE fiaon_applications SET kunden_pin_fehlversuche = 0, kunden_pin_gesperrt_bis = NULL WHERE ref = ${ref}`;
    return { ok: true, stimmt: true, gesperrt: false, restVersuche: PIN_MAX_FEHLVERSUCHE };
  }
  if (r.kunden_pin_gesperrt_bis) {
    return { ok: true, stimmt: false, gesperrt: true, gesperrtBis: new Date(r.kunden_pin_gesperrt_bis).toISOString() };
  }
  return { ok: true, stimmt: false, gesperrt: false, restVersuche: Math.max(0, PIN_MAX_FEHLVERSUCHE - Number(r.kunden_pin_fehlversuche || 0)) };
}

export type PinAendernErgebnis =
  | { ok: true }
  | { ok: false; status: number; code: "SCHWACH" | "ALT_FALSCH" | "GESPERRT" | "ALT_NOETIG" | "UNBEKANNT"; meldung: string; restVersuche?: number };

/**
 * PIN ändern im Kundenbereich. Ohne bestehende PIN darf sie gesetzt werden.
 * Mit bestehender PIN braucht es die alte PIN — oder eine frische Anmeldung
 * über den Anmelde-Link (frisch = true, „PIN vergessen").
 */
export async function pinAendern(ref: string, ein: { alt?: string | null; neu: string; frisch?: boolean }): Promise<PinAendernErgebnis> {
  const [z] = await sqlPool<{ birthdate: string | null; kunden_pin_hash: string | null }[]>`
    SELECT birthdate, kunden_pin_hash FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
  if (!z) return { ok: false, status: 404, code: "UNBEKANNT", meldung: "Ihr Konto finden wir gerade nicht." };
  const grund = pinPruefen(ein.neu, geburtAus(z.birthdate));
  if (grund) return { ok: false, status: 400, code: "SCHWACH", meldung: grund };
  if (z.kunden_pin_hash && !ein.frisch) {
    if (!ein.alt) return { ok: false, status: 400, code: "ALT_NOETIG", meldung: "Bitte geben Sie zuerst Ihre bisherige PIN ein." };
    const v = await pinVersuch(ref, String(ein.alt));
    if (!v.ok) return { ok: false, status: v.status, code: "UNBEKANNT", meldung: v.meldung };
    if (v.gesperrt) return { ok: false, status: 423, code: "GESPERRT", meldung: `Zu viele Versuche. Bitte versuchen Sie es nach ${PIN_SPERRE_MINUTEN} Minuten noch einmal – oder nutzen Sie „PIN vergessen“.` };
    if (!v.stimmt) return { ok: false, status: 400, code: "ALT_FALSCH", meldung: "Die bisherige PIN stimmt nicht.", restVersuche: v.restVersuche };
  }
  await sqlPool`
    UPDATE fiaon_applications SET kunden_pin_hash = ${pinHashen(ein.neu)},
      kunden_pin_gesetzt_am = COALESCE(kunden_pin_gesetzt_am, NOW()), kunden_pin_geaendert_am = NOW(),
      kunden_pin_fehlversuche = 0, kunden_pin_gesperrt_bis = NULL
    WHERE ref = ${ref}`;
  return { ok: true };
}

/** Hat diese Antragszeile eine PIN? (für /kunde/:ref/bereich → pinGesetzt) */
export async function pinGesetzt(ref: string): Promise<boolean> {
  const [z] = await sqlPool<{ ja: boolean }[]>`SELECT kunden_pin_hash IS NOT NULL AS ja FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
  return !!z?.ja;
}

// ── „PIN vergessen": frische Anmeldung über den Anmelde-Link ────────────────
// Der Anmelde-Link (app_login_link) beweist, dass der Mensch das Postfach hat.
// Wer gerade über ihn hereinkam, darf 15 Minuten lang eine neue PIN festlegen,
// ohne die alte zu kennen.
const FRISCH_COOKIE = "fiaon_frisch";
const FRISCH_MINUTEN = 15;
function frischSignatur(ref: string, exp: number): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "";
  return createHmac("sha256", s).update(`frisch.${ref}.${exp}`).digest("base64url");
}
export function frischCookieSetzen(res: Response, ref: string): void {
  try {
    const sauber = String(ref || "").trim().toUpperCase();
    if (!sauber || !(process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET)) return;
    const exp = Date.now() + FRISCH_MINUTEN * 60000;
    res.cookie(FRISCH_COOKIE, `${sauber}.${exp}.${frischSignatur(sauber, exp)}`, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: FRISCH_MINUTEN * 60000, path: "/",
    });
  } catch (e) { console.error("[KUNDEN-PIN] frisch-Cookie:", e); }
}
export function frischPasst(req: Request, ref: string): boolean {
  const roh = String((req as any).cookies?.[FRISCH_COOKIE] || "");
  const [r, expStr, sig] = roh.split(".");
  const exp = Number(expStr);
  if (!r || !sig || !Number.isFinite(exp) || exp < Date.now() || r !== String(ref || "").trim().toUpperCase()) return false;
  try {
    const erwartet = frischSignatur(r, exp);
    return sig.length === erwartet.length && timingSafeEqual(Buffer.from(sig), Buffer.from(erwartet));
  } catch { return false; }
}
