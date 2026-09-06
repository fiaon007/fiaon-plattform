// ═══════════════════════════════════════════════════════════════════════════
// DAS ANTRAGS-COOKIE — Beweis, dass DIESER Browser den Antrag angelegt hat
// (06.09.2026, Lücken-Audit B7)
//
// ── DER BEFUND ──────────────────────────────────────────────────────────
// POST /antrag/:ref/einloggen setzte 48 Stunden lang eine volle 30-Tage-
// Kundensitzung gegen die bloße Referenz. Die Referenz ist aber kein
// Geheimnis: Sie steht in jedem Verwendungszweck, auf jeder Rechnung und in
// jeder Mail. Wer sie kannte, war angemeldet — und stand damit vor allen
// Kunden-Endpunkten, auch den sauber bewachten des neuen Bereichs.
//
// ── DIE REGEL ───────────────────────────────────────────────────────────
// Der Antragsteller bekommt beim Anlegen des Antrags (POST /application,
// erster Aufruf) ein signiertes, 48 Stunden gültiges Antrags-Cookie. Wer den
// Antrag schon VOR diesem Cookie begonnen hatte, bekommt es beim nächsten
// Speichern — sofern die Angaben im Formular zu denen im Antrag passen
// (Nachname plus E-Mail oder Geburtsdatum): Das weiß nur, wer sie selbst
// eingetippt hat. Der Weiter-Link aus der Erinnerungsmail setzt es ebenfalls,
// denn der Link ist selbst ein Nachweis.
//
// Das Cookie ist KEINE Kundensitzung. Es öffnet genau drei Wege, die aus der
// Antragsstrecke heraus gebraucht werden: Einloggen nach dem Vertrag,
// Vertrags-PDF, Termin-Link. Alles andere bleibt hinter requireKunde.
// ═══════════════════════════════════════════════════════════════════════════
import type { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { requireKunde, type KundeRequest } from "./fiaon-kunde-session";

const COOKIE = "fiaon_antrag";
const STUNDEN = 48;

function geheimnis(): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET fehlt — Antrags-Cookie kann nicht signiert werden.");
  return s;
}

function unterschrift(ref: string, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`antrag.${ref}.${exp}`).digest("base64url");
}

/** Cookie setzen bzw. gleitend verlängern. */
export function antragCookieSetzen(res: Response, ref: string): void {
  const sauber = String(ref || "").trim().toUpperCase();
  if (!sauber) return;
  try {
    const exp = Date.now() + STUNDEN * 3600_000;
    res.cookie(COOKIE, `${sauber}.${exp}.${unterschrift(sauber, exp)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STUNDEN * 3600_000,
      path: "/",
    });
  } catch (e: any) {
    // Ein fehlendes Geheimnis darf das Speichern des Antrags nie zum Scheitern bringen.
    console.error("[ANTRAG-COOKIE] nicht gesetzt:", e?.message || e);
  }
}

/** Referenz aus einem gültigen Antrags-Cookie — sonst null. */
export function antragAusCookie(req: Request): string | null {
  const roh = String((req as any).cookies?.[COOKIE] || "");
  const teile = roh.split(".");
  if (teile.length !== 3) return null;
  const [ref, expStr, sig] = teile;
  const exp = Number(expStr);
  if (!ref || !Number.isFinite(exp) || exp < Date.now() || !sig) return null;
  try {
    const erwartet = unterschrift(ref, exp);
    if (sig.length !== erwartet.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(erwartet))) return null;
    return ref;
  } catch {
    return null;
  }
}

/** Passt das Antrags-Cookie zur Referenz? */
export function antragPasst(req: Request, ref: string): boolean {
  const c = antragAusCookie(req);
  return !!c && c === String(ref || "").trim().toUpperCase();
}

/**
 * Passen die Angaben im Formular zu denen, die schon im Antrag stehen?
 * Nachname UND (E-Mail ODER Geburtsdatum). Leere Bestandswerte zählen nie
 * als Treffer — ein frisch angelegter Antrag bekommt sein Cookie beim Anlegen.
 */
export function angabenPassen(
  bestand: { lastName?: string | null; email?: string | null; birthdate?: string | null },
  body: any,
): boolean {
  const n = (x: unknown) => String(x ?? "").trim().toLowerCase();
  const nachname = n(bestand?.lastName);
  if (!nachname || nachname !== n(body?.lastName)) return false;
  const email = n(bestand?.email);
  if (email && email === n(body?.email)) return true;
  const geburt = String(bestand?.birthdate ?? "").slice(0, 10);
  const imBody = body?.birthYear && body?.birthMonth && body?.birthDay
    ? `${body.birthYear}-${String(body.birthMonth).padStart(2, "0")}-${String(body.birthDay).padStart(2, "0")}`
    : "";
  return !!geburt && geburt === imBody;
}

/** Tür für Wege aus der Antragsstrecke: Antrags-Cookie zur :ref ODER Kundensitzung. */
export async function requireKundeOderAntrag(req: KundeRequest, res: Response, next: NextFunction): Promise<void> {
  const ref = String(req.params?.ref || "").trim().toUpperCase();
  if (ref && antragPasst(req, ref)) {
    req.kundeRef = ref;
    next();
    return;
  }
  return requireKunde(req, res, next);
}
