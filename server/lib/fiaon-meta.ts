// ═══════════════════════════════════════════════════════════════════════════
// META — DIE EINE TÜR ZUR GRAPH-SCHNITTSTELLE (22.09.2026, E-210)
//
// Justin: „ganz klar alles auf den offiziellen Meta-Weg … damit ich Make.com
// entfernen kann." Hier steht alles, was ein Gespräch mit Meta braucht — und
// nichts davon kennt einen Geheimwert im Quelltext:
//
//   META_APP_ID, META_APP_SECRET, META_SYSTEM_TOKEN   (Render-Umgebung)
//   optional META_LEADS_APP_ID/_SECRET/_TOKEN, falls Meta den Leads-
//   Anwendungsfall nicht in derselben App zulässt (dann zwei Apps)
//   optional META_GRAPH_URL (nur Prüfstand: ein Schein-Meta auf localhost)
//
// ── REGELN, DIE HIER HART STEHEN ───────────────────────────────────────────
// · Jede Anfrage trägt appsecret_proof — ein gestohlener Token allein reicht
//   dann nicht.
// · Kein Token, kein Geheimwert, keine Signatur in ein Log.
// · Fehler kommen als Klartext zurück („Zugang abgelaufen — neuen Token
//   erzeugen"), nicht als Meta-Fehlercode.
// · Der Prüf-Token für den Webhook ist aus dem App-Geheimwert ABGELEITET —
//   ein Wert weniger, den Justin irgendwo eintragen muss.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "node:crypto";

export const GRAPH_VERSION = "v25.0";

/** Die Rechte, die der Systemnutzer-Token tragen muss (Anleitung an Justin, 22.09.2026). */
export const PFLICHT_RECHTE = [
  "leads_retrieval", "pages_show_list", "pages_read_engagement", "pages_manage_metadata", "pages_manage_ads",
  "ads_management", "ads_read", "business_management", "whatsapp_business_management", "whatsapp_business_messaging",
] as const;

/** Welche Rechte wofür gebraucht werden — für die Klartext-Prüfliste. */
export const RECHT_ZWECK: Record<string, string> = {
  leads_retrieval: "Leads abrufen",
  pages_show_list: "Seite finden",
  pages_read_engagement: "Seite lesen",
  pages_manage_metadata: "Seite für Lead-Meldungen abonnieren",
  pages_manage_ads: "Lead-Formulare lesen",
  ads_management: "Kampagne, Anzeigengruppe und Anzeige zum Lead lesen",
  ads_read: "Werbekosten je Anzeige lesen",
  business_management: "Firmenkonto lesen",
  whatsapp_business_management: "WhatsApp-Konto und Vorlagen verwalten",
  whatsapp_business_messaging: "WhatsApp-Nachrichten senden",
};

const env = (k: string): string | null => {
  const v = String(process.env[k] ?? "").trim();
  return v ? v : null;
};

/** Welche der (höchstens zwei) Meta-Apps eine Anfrage stellt — kein Mitarbeiter-Begriff. */
export type MetaApp = "haupt" | "leads";

export interface MetaKonfig {
  /** Genug da, um Leads zu empfangen und abzurufen? */
  bereit: boolean;
  /** Welche Werte fehlen — nur Namen, nie Werte. */
  fehlt: string[];
  appId: string | null;
  /** Ist eine zweite App für Leads eingetragen? */
  zweiApps: boolean;
}

export function metaKonfig(): MetaKonfig {
  const fehlt: string[] = [];
  if (!env("META_APP_ID")) fehlt.push("META_APP_ID");
  if (!env("META_APP_SECRET")) fehlt.push("META_APP_SECRET");
  if (!env("META_SYSTEM_TOKEN")) fehlt.push("META_SYSTEM_TOKEN");
  return {
    bereit: fehlt.length === 0,
    fehlt,
    appId: env("META_APP_ID"),
    zweiApps: !!(env("META_LEADS_APP_ID") && env("META_LEADS_APP_SECRET") && env("META_LEADS_TOKEN")),
  };
}

/** Das Paar aus App und Token für eine Aufgabe. Leads nehmen die zweite App, wenn es eine gibt. */
function zugang(app: MetaApp): { appId: string | null; secret: string | null; token: string | null } {
  if (app === "leads" && env("META_LEADS_APP_ID") && env("META_LEADS_APP_SECRET") && env("META_LEADS_TOKEN")) {
    return { appId: env("META_LEADS_APP_ID"), secret: env("META_LEADS_APP_SECRET"), token: env("META_LEADS_TOKEN") };
  }
  return { appId: env("META_APP_ID"), secret: env("META_APP_SECRET"), token: env("META_SYSTEM_TOKEN") };
}

/** Der Prüf-Token für die Webhook-Anmeldung — abgeleitet, nie gespeichert. */
export function pruefToken(app: MetaApp = "haupt"): string | null {
  const s = zugang(app).secret;
  return s ? createHmac("sha256", s).update("fiaon-meta-webhook-v1").digest("hex").slice(0, 32) : null;
}

/** Passt ein angebotener Prüf-Token zu einer der Apps? */
export function pruefTokenPasst(angeboten: unknown): boolean {
  const a = String(angeboten ?? "");
  if (!a) return false;
  return (["haupt", "leads"] as MetaApp[]).some((r) => {
    const t = pruefToken(r);
    return !!t && t.length === a.length && timingSafeEqual(Buffer.from(t), Buffer.from(a));
  });
}

/**
 * Stimmt die Signatur (X-Hub-Signature-256) über die Bytes, wie sie ankamen?
 * Geprüft gegen jede eingetragene App — Meta signiert mit dem Geheimwert der
 * App, deren Abo die Meldung ausgelöst hat.
 */
export function signaturPruefen(rohBody: string | Buffer | undefined, kopf: unknown): boolean {
  const k = String(kopf ?? "");
  if (!k.startsWith("sha256=") || rohBody == null) return false;
  const bytes = Buffer.isBuffer(rohBody) ? rohBody : Buffer.from(String(rohBody), "utf8");
  const geheimnisse = [env("META_APP_SECRET"), env("META_LEADS_APP_SECRET")].filter(Boolean) as string[];
  return geheimnisse.some((g) => {
    const soll = "sha256=" + createHmac("sha256", g).update(bytes).digest("hex");
    return soll.length === k.length && timingSafeEqual(Buffer.from(soll), Buffer.from(k));
  });
}

/** Ein Meta-Fehler mit Klartext für Menschen und dem Code für die Regeln. */
export class MetaFehler extends Error {
  constructor(public klartext: string, public code: number | null, public status: number, public subcode: number | null = null) {
    super(klartext);
  }
}

/** Meta-Fehlercodes → ein Satz, der sagt, was zu tun ist. */
export function fehlerKlartext(code: number | null, subcode: number | null, roh: string): string {
  if (code === 190) return "Der Zugang ist ungültig oder abgelaufen — im Business-Manager einen neuen Systemnutzer-Token (Ablauf: nie) erzeugen und in Render eintragen.";
  if (code === 10 || code === 200 || (code !== null && code >= 200 && code < 300)) return `Meta verweigert ein Recht (${roh.slice(0, 160)}). Prüfe die Rechte des Tokens und den Leadzugriff der Seite.`;
  if (code === 4 || code === 17 || code === 32 || code === 613 || code === 80004) return "Meta bremst gerade (zu viele Anfragen). Der nächste Lauf versucht es von selbst erneut.";
  if (code === 100 && subcode === 33) return "Das Objekt gibt es nicht oder der Token darf es nicht sehen (falsche Seite, falsches Formular oder fehlender Leadzugriff).";
  if (code === 100) return `Meta lehnt die Anfrage ab: ${roh.slice(0, 200)}`;
  if (code === 368) return "Meta hat die Aktion vorübergehend gesperrt (Richtlinie). Im Business-Manager unter Kontoqualität nachsehen.";
  return roh.slice(0, 240) || "Unbekannter Fehler von Meta.";
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Eine Anfrage an die Graph-Schnittstelle. Wiederholt bei Netzfehlern, 5xx und
 * Bremse (drei Versuche), wirft sonst MetaFehler mit Klartext.
 */
export async function graph(
  pfad: string,
  opt: {
    methode?: "GET" | "POST" | "DELETE";
    params?: Record<string, string | number | boolean | undefined | null>;
    app?: MetaApp;
    /** Ein anderer Token (z. B. Seiten-Token) — appsecret_proof wird dafür berechnet. */
    token?: string;
    /** App-Token (app_id|app_secret) statt Nutzer-Token — für App-Abos. */
    appToken?: boolean;
    zeitMs?: number;
  } = {},
): Promise<any> {
  const z = zugang(opt.app ?? "haupt");
  const token = opt.appToken ? (z.appId && z.secret ? `${z.appId}|${z.secret}` : null) : (opt.token ?? z.token);
  if (!token) throw new MetaFehler("Meta-Zugang fehlt (META_APP_ID / META_APP_SECRET / META_SYSTEM_TOKEN in Render).", null, 0);
  const basis = (env("META_GRAPH_URL") ?? "https://graph.facebook.com").replace(/\/+$/, "");
  const url = new URL(`${basis}/${GRAPH_VERSION}/${pfad.replace(/^\/+/, "")}`);
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(opt.params ?? {})) if (v !== undefined && v !== null) params[k] = String(v);
  params.access_token = token;
  if (!opt.appToken && z.secret) params.appsecret_proof = createHmac("sha256", z.secret).update(token).digest("hex");
  const methode = opt.methode ?? "GET";
  let body: string | undefined;
  if (methode === "GET" || methode === "DELETE") {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  } else {
    body = new URLSearchParams(params).toString();
  }
  let letzter: unknown = null;
  for (let versuch = 0; versuch < 3; versuch++) {
    try {
      const r = await fetch(url, {
        method: methode,
        headers: body ? { "Content-Type": "application/x-www-form-urlencoded" } : undefined,
        body,
        signal: AbortSignal.timeout(opt.zeitMs ?? 15_000),
      });
      const text = await r.text();
      let j: any = null;
      try { j = text ? JSON.parse(text) : null; } catch { j = null; }
      if (r.ok && !(j && j.error)) return j;
      const e = j?.error ?? {};
      const code = typeof e.code === "number" ? e.code : null;
      const sub = typeof e.error_subcode === "number" ? e.error_subcode : null;
      const fehler = new MetaFehler(fehlerKlartext(code, sub, String(e.message ?? text ?? "")), code, r.status, sub);
      const wiederholbar = r.status >= 500 || code === 4 || code === 17 || code === 32 || code === 613 || code === 2 || code === 1;
      if (!wiederholbar) throw fehler;
      letzter = fehler;
    } catch (err) {
      if (err instanceof MetaFehler && !(err.status >= 500 || [1, 2, 4, 17, 32, 613].includes(err.code ?? -1))) throw err;
      letzter = err;
    }
    await warte(versuch === 0 ? 1000 : 3000);
  }
  if (letzter instanceof MetaFehler) throw letzter;
  throw new MetaFehler(`Meta nicht erreichbar: ${letzter instanceof Error ? letzter.message : String(letzter)}`, null, 0);
}

/** Alle Seiten einer Liste (paging.next), bis `hoechstens` Einträge. */
export async function graphAlle(
  pfad: string,
  opt: Parameters<typeof graph>[1] & { hoechstens?: number } = {},
): Promise<any[]> {
  const alle: any[] = [];
  let seite = await graph(pfad, opt);
  const grenze = opt.hoechstens ?? 5000;
  for (let runde = 0; runde < 200; runde++) {
    for (const x of seite?.data ?? []) { alle.push(x); if (alle.length >= grenze) return alle; }
    const nach = seite?.paging?.cursors?.after;
    if (!seite?.paging?.next || !nach) break;
    seite = await graph(pfad, { ...opt, params: { ...(opt.params ?? {}), after: nach } });
  }
  return alle;
}

const seitenTokens = new Map<string, { token: string; bis: number }>();

/** Der Seiten-Token — vom Systemnutzer abgeleitet, 50 Minuten zwischengespeichert. */
export async function seitenToken(seiteId: string, app: MetaApp = "leads"): Promise<string> {
  const schluessel = `${app}:${seiteId}`;
  const da = seitenTokens.get(schluessel);
  if (da && da.bis > Date.now()) return da.token;
  const j = await graph(seiteId, { params: { fields: "access_token" }, app });
  const token = String(j?.access_token ?? "");
  if (!token) throw new MetaFehler("Kein Seiten-Token — hat der Systemnutzer die Seite mit voller Kontrolle zugewiesen bekommen?", null, 0);
  seitenTokens.set(schluessel, { token, bis: Date.now() + 50 * 60_000 });
  return token;
}

/** Nur für den Prüfstand: gemerkte Seiten-Tokens vergessen. */
export function seitenTokensVergessen(): void { seitenTokens.clear(); }
