// ═══════════════════════════════════════════════════════════════════════════
// GRÜNDUNGSBOGEN — DIE ZWEI LINKS (E-526, 17.11.2026)
//
// Der GEMEINSAME Link trägt die Bogen-id, ein Ablaufdatum (90 Tage) und eine HMAC-Signatur;
// der PERSÖNLICHE Link trägt die Mitglied-id, ein Ablaufdatum (14 Tage) und eine Signatur
// über Bogen-id UND Mitglied-id — er gilt nur zusammen mit seinem Bogen. Ein Mitglied kann
// mit seinem Link also nie die Seite eines anderen Mitglieds öffnen, und ein Link aus einem
// Bogen öffnet keinen anderen Bogen.
//
// Form: „<id base36>-<Ablauf base36>-<Signatur 32 hex>“ — ohne Punkt, damit die Adresse nie
// wie eine Datei aussieht (der Server liefert Pfade mit Punkt nicht als Seite aus).
//
// Geheimnis wie bei den übrigen signierten Links des Hauses (SESSION_SECRET, sonst die
// Rückfälle aus fiaon-global-auftrag.ts), aber mit EIGENER Ableitung: Aus dem Geheimnis wird
// zuerst ein Schlüssel nur für Gründungsbögen gerechnet. Ein Token aus einem anderen Weg (Auftrag,
// Angebot, Abschluss) ist hier nie gültig — und umgekehrt.
//
// REIN bis auf node:crypto: keine Datenbank, kein Netz — der Prüfstand lädt diese Datei direkt.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "node:crypto";
import { GB_BOGEN_TOKEN_TAGE, GB_MITGLIED_TOKEN_TAGE } from "@shared/fiaon-global-gruendungsbogen";

const TAG_MS = 24 * 60 * 60 * 1000;

function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
/** Der eigene Schlüssel der Gründungsbögen — abgeleitet, nie das Geheimnis selbst. */
function schluessel(geheim: string): Buffer {
  return createHmac("sha256", geheim).update("fiaon-gruendungsbogen.v1").digest();
}
function signatur(nachricht: string, geheim: string): string {
  return createHmac("sha256", schluessel(geheim)).update(nachricht).digest("hex").slice(0, 32);
}
function gleich(a: string, b: string): boolean {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function zerlegen(token: unknown): { id: number; exp: number; sig: string } | null {
  const m = /^([0-9a-z]{1,10})-([0-9a-z]{6,12})-([0-9a-f]{32})$/.exec(String(token ?? ""));
  if (!m) return null;
  const id = parseInt(m[1], 36); const exp = parseInt(m[2], 36);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(exp) || exp <= 0) return null;
  return { id, exp, sig: m[3] };
}

export type GbTokenErgebnis = { id: number; status: "gueltig" | "abgelaufen" } | null;

/** Der gemeinsame Link eines Bogens (90 Tage). */
export function gbBogenToken(bogenId: number, jetzt: number = Date.now(), geheim: string = geheimnis(), tage = GB_BOGEN_TOKEN_TAGE): string {
  const exp = jetzt + tage * TAG_MS;
  return `${bogenId.toString(36)}-${exp.toString(36)}-${signatur(`bogen.${bogenId}.${exp}`, geheim)}`;
}
/** null = gefälscht oder kaputt; sonst die Bogen-id und ob der Link noch gilt. */
export function gbBogenTokenPruefen(token: unknown, jetzt: number = Date.now(), geheim: string = geheimnis()): GbTokenErgebnis {
  const t = zerlegen(token);
  if (!t || !gleich(signatur(`bogen.${t.id}.${t.exp}`, geheim), t.sig)) return null;
  return { id: t.id, status: t.exp < jetzt ? "abgelaufen" : "gueltig" };
}

/** Der persönliche Link eines Mitglieds (14 Tage) — an Bogen UND Mitglied gebunden. */
export function gbMitgliedToken(bogenId: number, mitgliedId: number, jetzt: number = Date.now(), geheim: string = geheimnis(), tage = GB_MITGLIED_TOKEN_TAGE): string {
  const exp = jetzt + tage * TAG_MS;
  return `${mitgliedId.toString(36)}-${exp.toString(36)}-${signatur(`mitglied.${bogenId}.${mitgliedId}.${exp}`, geheim)}`;
}
export function gbMitgliedTokenPruefen(bogenId: number, token: unknown, jetzt: number = Date.now(), geheim: string = geheimnis()): GbTokenErgebnis {
  const t = zerlegen(token);
  if (!t || !gleich(signatur(`mitglied.${bogenId}.${t.id}.${t.exp}`, geheim), t.sig)) return null;
  return { id: t.id, status: t.exp < jetzt ? "abgelaufen" : "gueltig" };
}
/** Bis wann ein Token gilt (für den Text der Mail). */
export function gbTokenAblauf(token: unknown): Date | null {
  const t = zerlegen(token);
  return t ? new Date(t.exp) : null;
}

/** Die Pfade der beiden Seiten. */
export function gbGemeinsamPfad(bogenToken: string): string {
  return `/business/gruendung/${encodeURIComponent(bogenToken)}`;
}
export function gbPersoenlichPfad(bogenToken: string, mitgliedToken: string): string {
  return `/business/gruendung/${encodeURIComponent(bogenToken)}/m/${encodeURIComponent(mitgliedToken)}`;
}
