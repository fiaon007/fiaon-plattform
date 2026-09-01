// ═══════════════════════════════════════════════════════════════════════════
// GMAIL-ANBINDUNG — ein Dienstkonto, alle fiaon.com-Postfächer (01.09.2026)
//
// Google Workspace erlaubt einem Dienstkonto mit „domainweiter Delegierung",
// im Namen JEDES Postfachs der Domain zu handeln. Der Ablauf je Postfach:
//   1. Wir bauen ein JWT (RS256, signiert mit dem privaten Schlüssel des
//      Dienstkontos) mit `sub` = Postfachadresse.
//   2. Google tauscht es gegen ein Zugriffstoken (~1 h gültig, wird gecacht).
//   3. Damit sprechen wir die Gmail-REST-API — ohne Zusatzpakete, nur
//      crypto + fetch (dieselbe Linie wie die Wise-Anbindung).
//
// Env: GOOGLE_SA_KEY = das komplette Dienstkonto-JSON (eine Zeile).
// Scope: gmail.modify — lesen, labeln, senden, Entwürfe; KEIN Löschen.
// ═══════════════════════════════════════════════════════════════════════════

import { createSign } from "crypto";

const SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const GMAIL = "https://gmail.googleapis.com/gmail/v1";

interface Dienstkonto { client_email: string; private_key: string; token_uri: string }

function dienstkonto(): Dienstkonto | null {
  const roh = process.env.GOOGLE_SA_KEY;
  if (!roh) return null;
  try { return JSON.parse(roh); } catch { return null; }
}

export function gmailBereit(): boolean { return !!dienstkonto(); }

const b64url = (s: Buffer | string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Token-Cache je Postfach — Google stellt Stundentoken aus; wir erneuern
// fünf Minuten vor Ablauf, damit kein Lauf mitten im Takt abbricht.
const tokenCache = new Map<string, { token: string; bis: number }>();

async function zugriffstoken(postfach: string): Promise<string> {
  const im = tokenCache.get(postfach);
  if (im && im.bis > Date.now() + 5 * 60_000) return im.token;
  const sa = dienstkonto();
  if (!sa) throw new Error("GOOGLE_SA_KEY fehlt");
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const rumpf = b64url(JSON.stringify({
    iss: sa.client_email, sub: postfach, scope: SCOPE,
    aud: sa.token_uri, iat: jetzt, exp: jetzt + 3600,
  }));
  const signatur = b64url(createSign("RSA-SHA256").update(`${kopf}.${rumpf}`).sign(sa.private_key));
  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${kopf}.${rumpf}.${signatur}`,
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) {
    throw new Error(`Token für ${postfach}: HTTP ${res.status} ${JSON.stringify(j)?.slice(0, 200)}`);
  }
  tokenCache.set(postfach, { token: j.access_token, bis: Date.now() + Number(j.expires_in || 3600) * 1000 });
  return j.access_token;
}

async function api(postfach: string, pfad: string, init: RequestInit = {}): Promise<any> {
  const token = await zugriffstoken(postfach);
  const res = await fetch(`${GMAIL}/users/me${pfad}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (res.status === 204) return null;
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Gmail ${postfach} ${pfad}: HTTP ${res.status} ${JSON.stringify(j?.error || j)?.slice(0, 300)}`);
  return j;
}

// ── Lesen ───────────────────────────────────────────────────────────────────

export async function nachrichtenSuchen(postfach: string, q: string, max = 25, pageToken?: string | null):
  Promise<{ ids: string[]; nextPageToken: string | null; estimate: number }> {
  const p = new URLSearchParams({ q, maxResults: String(Math.min(100, max)) });
  if (pageToken) p.set("pageToken", pageToken);
  const j = await api(postfach, `/messages?${p.toString()}`);
  return {
    ids: (j?.messages || []).map((m: any) => String(m.id)),
    nextPageToken: j?.nextPageToken || null,
    estimate: Number(j?.resultSizeEstimate || 0),
  };
}

export interface GmailNachricht {
  id: string; threadId: string; labelIds: string[];
  von: string; vonAdresse: string; an: string; betreff: string;
  messageIdHeader: string | null; datum: Date;
  text: string; snippet: string;
  autoHinweis: boolean; // Auto-Submitted / Precedence bulk / mailer-daemon
}

function kopfWert(headers: any[], name: string): string {
  return String(headers?.find((h: any) => String(h.name).toLowerCase() === name.toLowerCase())?.value || "");
}

function textAusTeilen(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }
  for (const teil of payload.parts || []) {
    const t = textAusTeilen(teil);
    if (t) return t;
  }
  // Notnagel: HTML grob enttaggen
  if (payload.mimeType === "text/html" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8")
      .replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

export async function nachrichtLesen(postfach: string, id: string): Promise<GmailNachricht> {
  const j = await api(postfach, `/messages/${id}?format=full`);
  const h = j?.payload?.headers || [];
  const von = kopfWert(h, "From");
  const adresse = (von.match(/<([^>]+)>/)?.[1] || von).trim().toLowerCase();
  const auto = /auto-(submitted|generated)/i.test(kopfWert(h, "Auto-Submitted"))
    || /^(bulk|list|junk)$/i.test(kopfWert(h, "Precedence"))
    || /mailer-daemon|postmaster|no-?reply|noreply|do-?not-?reply/i.test(adresse)
    || !!kopfWert(h, "List-Unsubscribe");
  return {
    id: String(j.id), threadId: String(j.threadId), labelIds: j.labelIds || [],
    von, vonAdresse: adresse, an: kopfWert(h, "To"),
    betreff: kopfWert(h, "Subject"), messageIdHeader: kopfWert(h, "Message-ID") || null,
    datum: new Date(Number(j.internalDate || Date.now())),
    text: textAusTeilen(j.payload).slice(0, 20_000),
    snippet: String(j.snippet || ""), autoHinweis: auto,
  };
}

// ── Labels — der Postmeister legt seine Ordnung selbst an ───────────────────

const labelCache = new Map<string, Map<string, string>>(); // postfach → name→id

export async function labelSicherstellen(postfach: string, name: string): Promise<string> {
  let karte = labelCache.get(postfach);
  if (!karte) {
    const j = await api(postfach, "/labels");
    karte = new Map((j?.labels || []).map((l: any) => [String(l.name), String(l.id)] as [string, string]));
    labelCache.set(postfach, karte);
  }
  const da = karte.get(name);
  if (da) return da;
  const neu = await api(postfach, "/labels", {
    method: "POST",
    body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
  });
  karte.set(name, String(neu.id));
  return String(neu.id);
}

export async function nachrichtLabeln(postfach: string, id: string,
  hinzu: string[], weg: string[] = []): Promise<void> {
  await api(postfach, `/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: hinzu, removeLabelIds: weg }),
  });
}

// ── Antworten und Entwürfe — immer im Thread, immer vom Postfach ────────────

function mimeAntwort(opts: { von: string; an: string; betreff: string; text: string; inReplyTo?: string | null }): string {
  const betreff = opts.betreff.replace(/^((re|aw|fwd?):\s*)+/i, "");
  const kodiertBetreff = `=?UTF-8?B?${Buffer.from(`Re: ${betreff}`).toString("base64")}?=`;
  const zeilen = [
    `From: ${opts.von}`,
    `To: ${opts.an}`,
    `Subject: ${kodiertBetreff}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    opts.inReplyTo ? `References: ${opts.inReplyTo}` : null,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(opts.text).toString("base64"),
  ].filter((z) => z !== null);
  return b64url(zeilen.join("\r\n"));
}

export async function antwortSenden(postfach: string, original: GmailNachricht, text: string): Promise<string> {
  const j = await api(postfach, "/messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: mimeAntwort({ von: postfach, an: original.von, betreff: original.betreff, text, inReplyTo: original.messageIdHeader }),
      threadId: original.threadId,
    }),
  });
  return String(j?.id || "");
}

export async function entwurfAnlegen(postfach: string, original: GmailNachricht, text: string): Promise<string> {
  const j = await api(postfach, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw: mimeAntwort({ von: postfach, an: original.von, betreff: original.betreff, text, inReplyTo: original.messageIdHeader }),
        threadId: original.threadId,
      },
    }),
  });
  return String(j?.id || "");
}

export async function entwurfLoeschen(postfach: string, draftId: string): Promise<void> {
  await api(postfach, `/drafts/${draftId}`, { method: "DELETE" });
}

/** Verbindungsprobe: Labels des Postfachs zählen — beweist Delegation + Scope. */
export async function postfachProbe(postfach: string): Promise<{ ok: boolean; labels?: number; fehler?: string }> {
  try {
    const j = await api(postfach, "/labels");
    return { ok: true, labels: (j?.labels || []).length };
  } catch (e: any) {
    return { ok: false, fehler: String(e?.message || e).slice(0, 300) };
  }
}
