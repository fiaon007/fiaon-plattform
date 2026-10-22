// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER PERSÖNLICHE ZUGANG: DIE KRYPTOGRAFIE (E-423, 22.10.2026)
//
// Rein: node:crypto, keine Datenbank, kein Netz. Die Uhr ist Parameter — der
// Prüfstand (scripts/pruef-global-login.ts) rechnet Ablauf, Versuche und Sperre
// nach, ohne zu warten. Die Zahlen stehen in shared/fiaon-global-konto.ts.
//
// ── WAS WIE GESPEICHERT WIRD ──────────────────────────────────────────────
//   · Der Code (sechs Ziffern) liegt nie im Klartext in der Datenbank, sondern
//     als HMAC mit dem Server-Geheimnis UND dem Vorgang. Eine Million Codes
//     wären ohne Geheimnis in Sekunden durchgerechnet — mit ihm nicht.
//   · Der VORGANG ist ein Zufallswert (32 Byte), den nur der Browser hält, der
//     das Passwort richtig eingegeben hat. Gespeichert wird sein SHA-256.
//   · Die SITZUNG ist ebenfalls ein Zufallswert im httpOnly-Cookie; gespeichert
//     wird nur ihr SHA-256. Abmelden setzt beendet_am — die Zeile bleibt.
//   · Die LINKS (Einladung, neues Passwort) sind signiert und tragen eine
//     Einmal-Marke (nonce) des Kontos: Mit dem Einlösen wird die Marke
//     erneuert, und derselbe Link gilt nicht mehr.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  KONTO_CODE_MINUTEN, KONTO_CODE_NEU_HOECHSTENS, KONTO_CODE_NEU_SEKUNDEN, KONTO_CODE_STELLEN, KONTO_CODE_VERSUCHE,
  KONTO_FEHLVERSUCHE, KONTO_SPERRE_MINUTEN,
} from "@shared/fiaon-global-konto";

/** Das Geheimnis für Code-Hash und Link-Signatur. In der Produktion Pflicht — ohne es lieber laut scheitern. */
export function kontoGeheimnis(): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET fehlt — der Global-Zugang kann nichts signieren.");
  return "fiaon-dev-global-konto";
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const gleich = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// ── Code und Vorgang ─────────────────────────────────────────────────────────
/** Sechs Ziffern aus dem Zufallsgenerator des Systems — führende Nullen bleiben. */
export function kontoCodeErzeugen(): string {
  return String(randomInt(0, 10 ** KONTO_CODE_STELLEN)).padStart(KONTO_CODE_STELLEN, "0");
}
/** Ein Vorgang: 32 Zufallsbyte, Base64-URL (43 Zeichen). */
export function kontoVorgangErzeugen(): string {
  return randomBytes(32).toString("base64url");
}
export const KONTO_VORGANG_MUSTER = /^[A-Za-z0-9_-]{43}$/;
export function kontoVorgangHash(vorgang: string): string {
  return sha256(`global-konto-vorgang.${vorgang}`);
}
export function kontoCodeHash(vorgang: string, code: string): string {
  return createHmac("sha256", kontoGeheimnis()).update(`global-konto-code.${vorgang}.${code}`).digest("hex");
}
/** Nur Ziffern, genau sechs — Leerzeichen und Bindestriche aus dem Einfügen fallen weg. */
export function kontoCodeEingabe(roh: unknown): string | null {
  const c = String(roh ?? "").replace(/[\s-]/g, "");
  return new RegExp(`^\\d{${KONTO_CODE_STELLEN}}$`).test(c) ? c : null;
}

export type CodeUrteil = "ok" | "falsch" | "abgelaufen" | "verbraucht" | "gesperrt";
/**
 * Das Urteil über eine Code-Eingabe. `versuche` zählt die FALSCHEN Eingaben bisher. Nach der fünften falschen ist der
 * Vorgang gesperrt — auch der richtige Code hilft dann nicht mehr. `rest` = verbleibende Versuche NACH dieser Eingabe.
 */
export function kontoCodeUrteil(
  zeile: { code_hash: string; gueltig_bis: Date | string; versuche: number; eingeloest_am?: unknown; verworfen_am?: unknown },
  vorgang: string, eingabe: string | null, jetzt: number = Date.now(),
): { urteil: CodeUrteil; rest: number } {
  const versuche = Number(zeile.versuche || 0);
  if (zeile.eingeloest_am || zeile.verworfen_am) return { urteil: "verbraucht", rest: 0 };
  if (versuche >= KONTO_CODE_VERSUCHE) return { urteil: "gesperrt", rest: 0 };
  if (new Date(zeile.gueltig_bis).getTime() <= jetzt) return { urteil: "abgelaufen", rest: KONTO_CODE_VERSUCHE - versuche };
  if (eingabe && gleich(kontoCodeHash(vorgang, eingabe), String(zeile.code_hash))) return { urteil: "ok", rest: KONTO_CODE_VERSUCHE - versuche };
  const rest = Math.max(0, KONTO_CODE_VERSUCHE - versuche - 1);
  return { urteil: rest === 0 ? "gesperrt" : "falsch", rest };
}
export function kontoCodeGueltigBis(jetzt: number = Date.now()): Date {
  return new Date(jetzt + KONTO_CODE_MINUTEN * 60_000);
}

/** Darf jetzt ein neuer Code verschickt werden? (frühestens nach 60 s, höchstens dreimal je Vorgang) */
export function kontoCodeNeuUrteil(letzterVersand: Date | string, schonNeu: number, jetzt: number = Date.now()): { erlaubt: boolean; warten: number; genug: boolean } {
  if (Number(schonNeu || 0) >= KONTO_CODE_NEU_HOECHSTENS) return { erlaubt: false, warten: 0, genug: true };
  const seit = (jetzt - new Date(letzterVersand).getTime()) / 1000;
  if (seit < KONTO_CODE_NEU_SEKUNDEN) return { erlaubt: false, warten: Math.ceil(KONTO_CODE_NEU_SEKUNDEN - seit), genug: false };
  return { erlaubt: true, warten: 0, genug: false };
}

// ── Links: Einladung und neues Passwort ───────────────────────────────────────
export type KontoLinkArt = "einladung" | "passwort";
const ART_KUERZEL: Record<KontoLinkArt, string> = { einladung: "e", passwort: "p" };
function linkSignatur(kuerzel: string, kontoId: number, exp: number, nonce: string): string {
  return createHmac("sha256", kontoGeheimnis()).update(`global-konto-link.${kuerzel}.${kontoId}.${exp}.${nonce}`).digest("base64url").slice(0, 32);
}
/** `e.<konto>.<ablauf>.<marke>.<signatur>` — ohne Adresse, ohne Namen. */
export function kontoLinkErzeugen(art: KontoLinkArt, kontoId: number, nonce: string, ttlMs: number, jetzt: number = Date.now()): string {
  const exp = jetzt + ttlMs;
  const k = ART_KUERZEL[art];
  return `${k}.${kontoId}.${exp}.${nonce}.${linkSignatur(k, kontoId, exp, nonce)}`;
}
export function kontoLinkPruefen(token: unknown, jetzt: number = Date.now()):
  { ok: true; art: KontoLinkArt; kontoId: number; exp: number; nonce: string } | { ok: false; grund: "ungueltig" | "abgelaufen" } {
  const teile = String(token ?? "").trim().split(".");
  if (teile.length !== 5) return { ok: false, grund: "ungueltig" };
  const [k, idRoh, expRoh, nonce, sig] = teile;
  const art = (Object.keys(ART_KUERZEL) as KontoLinkArt[]).find((a) => ART_KUERZEL[a] === k);
  const kontoId = Number(idRoh); const exp = Number(expRoh);
  if (!art || !Number.isInteger(kontoId) || kontoId <= 0 || !Number.isFinite(exp) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return { ok: false, grund: "ungueltig" };
  if (!gleich(linkSignatur(k, kontoId, exp, nonce), sig)) return { ok: false, grund: "ungueltig" };
  if (exp <= jetzt) return { ok: false, grund: "abgelaufen" };
  return { ok: true, art, kontoId, exp, nonce };
}
/** Eine frische Einmal-Marke für Einladung oder Passwort-Link. */
export function kontoNonceErzeugen(): string {
  return randomBytes(18).toString("base64url");
}

// ── Sitzung ──────────────────────────────────────────────────────────────────
export const KONTO_COOKIE = "fiaon_global_sitzung";
export function kontoSitzungErzeugen(): string {
  return randomBytes(32).toString("base64url");
}
export function kontoSitzungHash(token: string): string {
  return sha256(`global-konto-sitzung.${token}`);
}

// ── Bremsen im Arbeitsspeicher (wie jede Drossel im Haus; ein Neustart vergisst sie) ──
/** Ein gleitendes Fenster: `zaehlen(schluessel)` gibt true zurück, wenn der Deckel schon erreicht ist (dann zählt es nicht). */
export function kontoFenster(deckel: number, fensterMs: number) {
  const m = new Map<string, number[]>();
  let pflege = 0;
  return {
    zuViel(schluessel: string, jetzt: number = Date.now()): boolean {
      if (jetzt - pflege > 5 * 60_000) { pflege = jetzt; m.forEach((z, k) => { if (!z.some((t) => jetzt - t < fensterMs)) m.delete(k); }); }
      const frisch = (m.get(schluessel) ?? []).filter((t) => jetzt - t < fensterMs);
      if (frisch.length >= deckel) { m.set(schluessel, frisch); return true; }
      frisch.push(jetzt); m.set(schluessel, frisch);
      return false;
    },
    leeren(): void { m.clear(); pflege = 0; },
  };
}

/**
 * Die Sperre nach falschen Passwörtern — je ADRESSE, für bekannte und unbekannte gleich (sonst verriete sie, welche
 * Adresse ein Konto hat). Fünf Fehlversuche in 15 Minuten → 15 Minuten Pause ab dem fünften.
 */
export function kontoSperre(deckel = KONTO_FEHLVERSUCHE, minuten = KONTO_SPERRE_MINUTEN) {
  const fenster = minuten * 60_000;
  const m = new Map<string, number[]>();
  const schl = (email: string) => sha256(`global-konto-sperre.${email}`);
  return {
    gesperrt(email: string, jetzt: number = Date.now()): boolean {
      const z = (m.get(schl(email)) ?? []).filter((t) => jetzt - t < fenster);
      return z.length >= deckel;
    },
    fehlversuch(email: string, jetzt: number = Date.now()): number {
      const k = schl(email);
      const z = (m.get(k) ?? []).filter((t) => jetzt - t < fenster);
      z.push(jetzt); m.set(k, z);
      return z.length;
    },
    loeschen(email: string): void { m.delete(schl(email)); },
    leeren(): void { m.clear(); },
  };
}
