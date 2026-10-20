// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Twilio-Zugang, Absendernummer, Signaturprüfung, Stream-Token (E-408)
//
// Eine Stelle für alles, was ARAS von Twilio braucht. Nur Namen von
// Umgebungsvariablen stehen hier, nie Werte.
//   ARAS_CALLER_ID   die ARAS-Nummer (Pflicht fürs Wählen; leer = Rückfall TWILIO_CALLER_ID)
//   ARAS_STREAM_HOST öffentlicher Host des ARAS-Dienstes für <Stream url> (leer = APP_BASE_URL)
//   TWILIO_*         vorhanden (Softphone)
//   SESSION_SECRET   signiert das Stream-Token (anruf|exp)
// ═══════════════════════════════════════════════════════════════════════════
import crypto from "node:crypto";
import type { Request } from "express";
import { fiaonBaseUrl, absoluteUrl } from "../fiaon-base-url";
import type { Land } from "../../shared/fiaon-aras";

export const ARAS_ENV = ["ARAS_CALLER_ID", "ARAS_STREAM_HOST", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "SESSION_SECRET", "OPENAI_API_KEY"] as const;

export function twilioBereit(): { ok: boolean; fehlt: string[] } {
  const fehlt = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"].filter((n) => !String(process.env[n] ?? "").trim());
  if (!arasCallerId("DE")) fehlt.push("ARAS_CALLER_ID");
  return { ok: fehlt.length === 0, fehlt };
}

/** Absendernummer nach Land des Kunden (aras_caller_id_at/_ch aus den Einstellungen, sonst ARAS_CALLER_ID, sonst TWILIO_CALLER_ID). */
export function arasCallerId(land: Land, eigene: { at?: string; ch?: string } = {}): string {
  const std = String(process.env.ARAS_CALLER_ID || process.env.TWILIO_CALLER_ID || "").trim();
  if (land === "AT" && eigene.at) return eigene.at;
  if (land === "CH" && eigene.ch) return eigene.ch;
  return std;
}

let client: any = null;
export async function twilioClient(): Promise<any> {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !tok) throw new Error("Twilio ist nicht eingerichtet (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN).");
  const twilio = (await import("twilio")).default as any;
  client = twilio(sid, tok);
  return client;
}

/** Der Host, an dem Twilio den Ton-Strom anliefert — wss://<ARAS_STREAM_HOST>/api/fiaon/aras/stream. */
export function streamUrl(): string {
  const host = String(process.env.ARAS_STREAM_HOST || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const basis = host ? `wss://${host}` : fiaonBaseUrl().replace(/^http/, "ws");
  return `${basis}/api/fiaon/aras/stream`;
}

/** Twilio-Rückruf-URLs — immer absolut, nie aus req.host. */
export function rueckrufUrl(pfad: string, anrufId: number, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({ anruf: String(anrufId), ...extra });
  return `${absoluteUrl(pfad)}?${q.toString()}`;
}

// ── Stream-Token: HMAC-SHA256 über „anruf|exp“, 10 Minuten ─────────────────
function geheimnis(): string {
  const s = process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "";
  if (!s) throw new Error("SESSION_SECRET fehlt — das Stream-Token kann nicht signiert werden.");
  return s;
}
export function streamToken(anrufId: number, lebensdauerMs = 10 * 60_000): string {
  const exp = Date.now() + lebensdauerMs;
  const sig = crypto.createHmac("sha256", geheimnis()).update(`${anrufId}|${exp}`).digest("hex");
  return `${exp}.${sig}`;
}
export function streamTokenPruefen(anrufId: number, token: string | null | undefined): boolean {
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(String(token ?? ""));
  if (!m) return false;
  const exp = Number(m[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  let soll: string;
  try { soll = crypto.createHmac("sha256", geheimnis()).update(`${anrufId}|${exp}`).digest("hex"); } catch { return false; }
  const a = Buffer.from(m[2], "hex"), b = Buffer.from(soll, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Twilio-Signatur (X-Twilio-Signature) — URL aus APP_BASE_URL, nie aus req.host ──
export function twilioSignaturPruefen(req: Request): { ok: boolean; grund?: string } {
  const tok = process.env.TWILIO_AUTH_TOKEN;
  if (!tok) return { ok: false, grund: "TWILIO_AUTH_TOKEN fehlt." };
  const sig = String(req.headers["x-twilio-signature"] ?? "");
  if (!sig) return { ok: false, grund: "Keine Twilio-Signatur." };
  const url = absoluteUrl(req.originalUrl);
  const body = (req.body && typeof req.body === "object") ? (req.body as Record<string, string>) : {};
  const ok = signaturGueltig(tok, sig, url, body);
  return ok ? { ok: true } : { ok: false, grund: "Twilio-Signatur passt nicht." };
}

/** Die Twilio-Rechnung: HMAC-SHA1 über URL + sortierte Formfelder, Base64 — ohne das SDK, damit Prüfstände sie nachrechnen. */
export function signaturGueltig(authToken: string, signatur: string, url: string, body: Record<string, string>): boolean {
  const soll = signaturBauen(authToken, url, body);
  const a = Buffer.from(signatur), b = Buffer.from(soll);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export function signaturBauen(authToken: string, url: string, body: Record<string, string>): string {
  const daten = url + Object.keys(body).sort().map((k) => `${k}${body[k]}`).join("");
  return crypto.createHmac("sha1", authToken).update(daten).digest("base64");
}

/** XML-sicher. */
export function xml(t: unknown): string {
  return String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** TwiML: Verbinde den Anruf mit unserem Ton-Strom. Nur <Parameter>, nie Query in der Stream-URL (Twilio erlaubt keine). */
export function twimlStream(anrufId: number, token: string, extra: Record<string, string> = {}): string {
  const params = [
    `<Parameter name="anruf" value="${xml(anrufId)}"/>`,
    `<Parameter name="t" value="${xml(token)}"/>`,
    ...Object.entries(extra).map(([k, v]) => `<Parameter name="${xml(k)}" value="${xml(v)}"/>`),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="${xml(streamUrl())}">${params}</Stream></Connect></Response>`;
}

/** TwiML: Übergabe an das Softphone eines Menschen — Kundennummer nie als callerId (Twilio erlaubt nur eigene Nummern). */
export function twimlUebergabe(e: { agentId: number; callerId: string; anrufId: number; personId: number | null; grund: string }): string {
  const action = rueckrufUrl("/api/fiaon/aras/uebergabe-ergebnis", e.anrufId);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${xml(e.callerId)}" timeout="20" action="${xml(action)}" method="POST">`
    + `<Client><Identity>agent-${xml(e.agentId)}</Identity>`
    + `<Parameter name="personId" value="${xml(e.personId ?? "")}"/><Parameter name="anruf" value="${xml(e.anrufId)}"/>`
    + `<Parameter name="von" value="aras"/><Parameter name="grund" value="${xml(e.grund)}"/></Client></Dial></Response>`;
}

export function twimlAuflegen(satz?: string): string {
  const say = satz ? `<Say language="de-DE" voice="Polly.Vicki">${xml(satz)}</Say>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${say}<Hangup/></Response>`;
}
