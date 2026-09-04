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
  /** Reply-To, falls gesetzt — Kunden über Weiterleitungsadressen erreichen wir sonst nie. */
  antwortAn: string | null;
  /** Vollständige References-Kette, damit Outlook die Antwort im Gespräch behält. */
  references: string | null;
  /** Dateien an der Mail (04.09.2026): Belege, Ausweise, Verträge — ein Mensch sähe sie, Mara auch. */
  anhaenge: GmailAnhang[];
}

export interface GmailAnhang { name: string; typ: string; groesse: number; attachmentId: string }

function anhaengeAusTeilen(payload: any, aus: GmailAnhang[] = []): GmailAnhang[] {
  if (!payload) return aus;
  if (payload.filename && payload.body?.attachmentId) {
    const typ = String(payload.mimeType || "application/octet-stream");
    const groesse = Number(payload.body.size || 0);
    // Signatur-Bildchen und Tracking-Pixel sind keine Anhänge.
    if (!(/^image\//.test(typ) && groesse < 8_000)) {
      aus.push({ name: String(payload.filename), typ, groesse, attachmentId: String(payload.body.attachmentId) });
    }
  }
  for (const teil of payload.parts || []) anhaengeAusTeilen(teil, aus);
  return aus;
}

/** Eine Datei aus einer Kundenmail holen — roh, als Buffer. */
export async function anhangLesen(postfach: string, messageId: string, attachmentId: string): Promise<Buffer> {
  const j = await api(postfach, `/messages/${messageId}/attachments/${attachmentId}`);
  return Buffer.from(String(j?.data || ""), "base64url");
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
    antwortAn: kopfWert(h, "Reply-To") || null,
    references: kopfWert(h, "References") || null,
    datum: new Date(Number(j.internalDate || Date.now())),
    text: textAusTeilen(j.payload).slice(0, 20_000),
    snippet: String(j.snippet || ""), autoHinweis: auto,
    anhaenge: anhaengeAusTeilen(j.payload),
  };
}

// ── Labels — der Postmeister legt seine Ordnung selbst an ───────────────────

const labelCache = new Map<string, Map<string, string>>(); // postfach → name→id

/** Labelnamen so vergleichen, wie Gmail sie für „gleich" hält: ohne Groß/Klein, Bindestrich = Unterstrich = Leerzeichen. */
function labelSchluessel(name: string): string {
  return name.toLowerCase().replace(/[-_\s]+/g, " ").trim();
}
function labelUnscharf(karte: Map<string, string>, name: string): string | null {
  const ziel = labelSchluessel(name);
  let treffer: string | null = null;
  // (`forEach` statt Map-Iteration — Übersetzerziel älter als ES2015, siehe AGENTS.md.)
  karte.forEach((id, n) => { if (!treffer && labelSchluessel(n) === ziel) treffer = id; });
  return treffer;
}

export async function labelSicherstellen(postfach: string, name: string): Promise<string> {
  let karte = labelCache.get(postfach);
  if (!karte) {
    const j = await api(postfach, "/labels");
    karte = new Map((j?.labels || []).map((l: any) => [String(l.name), String(l.id)] as [string, string]));
    labelCache.set(postfach, karte);
  }
  const da = karte.get(name) ?? labelUnscharf(karte, name);
  if (da) return da;
  try {
    const neu = await api(postfach, "/labels", {
      method: "POST",
      body: JSON.stringify({ name, labelListVisibility: "labelShow", messageListVisibility: "show" }),
    });
    karte.set(name, String(neu.id));
    return String(neu.id);
  } catch (e: any) {
    // 02.09.2026: „Label name exists or conflicts" (HTTP 409). Der Merkzettel
    // in `labelCache` ist dann älter als das Postfach — jemand hat das Label
    // inzwischen von Hand angelegt, oder ein zweiter Lauf war schneller.
    // Das ist kein Fehler, sondern ein veralteter Merkzettel: einmal frisch
    // einlesen und das vorhandene Label nehmen. Vorher scheiterte daran die
    // ganze Mail, obwohl nur ein Ordner schon existierte.
    if (!String(e?.message || "").includes("409")) throw e;
    const j = await api(postfach, "/labels");
    const frisch = new Map<string, string>();
    for (const l of (j?.labels || []) as any[]) frisch.set(String(l.name), String(l.id));
    labelCache.set(postfach, frisch);
    const gefunden = frisch.get(name);
    if (gefunden) return gefunden;
    // Gmail vergleicht Labelnamen ohne Rücksicht auf Groß- und Kleinschreibung:
    // „FIAON/Kein Kunde" und „fiaon/kein kunde" sind für Gmail dasselbe Label,
    // für unsere Map aber zwei. Deshalb hier noch einmal unscharf suchen —
    // sonst bliebe der 409 stehen, obwohl das Label längst da ist.
    // (`forEach` statt einer Schleife über die Map: Das Übersetzerziel des
    //  Hauses ist älter als ES2015 — Map-Iteration bricht den Bau, siehe AGENTS.md.)
    // 04.09.2026: Im Postfach heißt das Label „FIAON/Entwurf-wartet" (Bindestrich),
    // der Code wollte „FIAON/Entwurf wartet" (Leerzeichen) — für Gmail ein
    // Konflikt, für die Map zwei Namen. Seit dem 02.09. schlug deshalb jeder
    // Lauf mit 409 fehl und die Mail blieb ohne Ordner. Der Vergleich ist jetzt
    // unscharf: Groß/Klein, Bindestrich, Unterstrich und Leerzeichen zählen nicht.
    const treffer = labelUnscharf(frisch, name);
    if (treffer) { karte.set(name, treffer); return treffer; }
    throw e;
  }
}

export async function nachrichtLabeln(postfach: string, id: string,
  hinzu: string[], weg: string[] = []): Promise<void> {
  await api(postfach, `/messages/${id}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds: hinzu, removeLabelIds: weg }),
  });
}

// ── Antworten und Entwürfe — immer im Thread, immer vom Postfach ────────────

/** Ein Anhang für eine Antwort — z. B. die Rechnung als PDF. */
export interface MailAnhang { dateiname: string; inhalt: Buffer; typ?: string }

export function mimeAntwort(opts: { von: string; an: string; betreff: string; text: string; html?: string | null; inReplyTo?: string | null; references?: string | null; anhaenge?: MailAnhang[] | null }): string {
  const betreff = opts.betreff.replace(/^((re|aw|fwd?):\s*)+/i, "");
  const kodiertBetreff = `=?UTF-8?B?${Buffer.from(`Re: ${betreff}`).toString("base64")}?=`;
  // ── ANTWORTEN IM HAUS-CI (02.09.2026, Justins Auftrag) ──────────────────
  // Eine Kundenantwort sah bisher aus wie eine Notiz: reiner Text, kein Kopf,
  // keine Knöpfe, kein Absender-Bild. Jetzt geht dieselbe Nachricht als
  // multipart/alternative raus — Textfassung für Zweifelsfälle, HTML für
  // alle üblichen Postfächer. Ohne `html` bleibt alles wie vorher.
  const references = [opts.references, opts.inReplyTo].filter(Boolean).join(" ").trim() || null;
  const kopf = [
    `From: ${opts.von}`,
    `To: ${opts.an}`,
    `Subject: ${kodiertBetreff}`,
    opts.inReplyTo ? `In-Reply-To: ${opts.inReplyTo}` : null,
    references ? `References: ${references}` : null,
    "MIME-Version: 1.0",
  ].filter((z) => z !== null) as string[];

  const anhaenge = (opts.anhaenge || []).filter((a) => a && a.inhalt && a.inhalt.length > 0);
  const grenze = `fiaon-${Buffer.from(String(opts.an) + betreff).toString("hex").slice(0, 24)}`;

  // Der Nachrichtenkörper: entweder nur Text, oder Text+HTML als multipart/alternative.
  // Ohne Anhang ist er die ganze Mail (wie bisher); mit Anhang wird er der erste
  // Teil eines multipart/mixed (04.09.2026: „Rechnung als PDF mitschicken").
  const koerperKopf: string[] = !opts.html
    ? ['Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64"]
    : [`Content-Type: multipart/alternative; boundary="${grenze}"`];
  const koerperRumpf: string[] = !opts.html
    ? [Buffer.from(opts.text).toString("base64")]
    : [
      `--${grenze}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64", "",
      Buffer.from(opts.text).toString("base64"), "",
      `--${grenze}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64", "",
      Buffer.from(opts.html).toString("base64"), "",
      `--${grenze}--`,
    ];

  if (anhaenge.length === 0) {
    return b64url([...kopf, ...koerperKopf, "", ...koerperRumpf, ""].join("\r\n"));
  }

  const mantel = `fiaon-mixed-${grenze.slice(6, 22)}`;
  const zeilen: string[] = [
    ...kopf,
    `Content-Type: multipart/mixed; boundary="${mantel}"`, "",
    `--${mantel}`,
    ...koerperKopf, "",
    ...koerperRumpf, "",
  ];
  for (const a of anhaenge) {
    const name = String(a.dateiname || "anhang.pdf").replace(/["\r\n]/g, "");
    const kodiertName = `=?UTF-8?B?${Buffer.from(name).toString("base64")}?=`;
    zeilen.push(
      `--${mantel}`,
      `Content-Type: ${a.typ || "application/pdf"}; name="${kodiertName}"`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${kodiertName}"`, "",
      // 76 Zeichen je Zeile — so wollen es die Mailregeln, und Gmail ist da streng.
      a.inhalt.toString("base64").replace(/(.{76})/g, "$1\r\n"), "",
    );
  }
  zeilen.push(`--${mantel}--`, "");
  return b64url(zeilen.join("\r\n"));
}

export async function antwortSenden(postfach: string, original: GmailNachricht, text: string, html?: string | null, anhaenge?: MailAnhang[] | null): Promise<string> {
  const j = await api(postfach, "/messages/send", {
    method: "POST",
    body: JSON.stringify({
      raw: mimeAntwort({ von: postfach, an: original.antwortAn || original.von, betreff: original.betreff, text, html, inReplyTo: original.messageIdHeader, references: original.references, anhaenge }),
      threadId: original.threadId,
    }),
  });
  return String(j?.id || "");
}

export async function entwurfAnlegen(postfach: string, original: GmailNachricht, text: string, html?: string | null, anhaenge?: MailAnhang[] | null): Promise<string> {
  const j = await api(postfach, "/drafts", {
    method: "POST",
    body: JSON.stringify({
      message: {
        raw: mimeAntwort({ von: postfach, an: original.antwortAn || original.von, betreff: original.betreff, text, html, inReplyTo: original.messageIdHeader, references: original.references, anhaenge }),
        threadId: original.threadId,
      },
    }),
  });
  return String(j?.id || "");
}

/** Eine FRISCHE Mail (kein Reply) — z. B. die Firmen-Info nach dem Erstanruf. */
export async function mailNeuSenden(postfach: string, an: string, betreff: string, text: string): Promise<string> {
  const kodiertBetreff = `=?UTF-8?B?${Buffer.from(betreff).toString("base64")}?=`;
  const zeilen = [
    `From: ${postfach}`,
    `To: ${an}`,
    `Subject: ${kodiertBetreff}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text).toString("base64"),
  ];
  const j = await api(postfach, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw: b64url(zeilen.join("\r\n")) }),
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
