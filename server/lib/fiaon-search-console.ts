// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE SEARCH CONSOLE IM CHEFBÜRO (28.10.2026, E-454)
//
// Justin: „Ja Zugang — die Google-Zahlen landen automatisch im Chefbüro."
//
// Bis heute las jemand die Search Console von Hand im Browser ab. Jetzt holt ein
// Tageslauf früh am Morgen (Berlin) alles, was Justin dort ansieht, und legt es
// in der Datenbank ab (db/migrations/126). Das Chefbüro (Besucher › Google)
// liest NUR von dort — nie direkt bei Google.
//
// ── WAS GEHOLT WIRD ───────────────────────────────────────────────────────
//   1. searchAnalytics.query — Klicks, Impressionen, CTR, Position der letzten
//      28 Tage mit Daten und der 28 davor (Vergleich), Verlauf je Tag, die
//      Suchanfragen (daraus „Fast auf Seite 1“: Position 8–20 mit Impressionen),
//      Seiten, Länder, Geräte.
//   2. sitemaps.list — eingereichte Sitemaps, wann Google sie gelesen hat.
//   3. urlInspection.index.inspect — je Adresse aus der Sitemap: Ist sie bei
//      Google? Höchstens 150 Prüfungen am Tag (Google erlaubt 2.000 je Tag und
//      Eigenschaft); die mit höchster Priorität zuerst und öfter. Daraus
//      entstehen „Neu bei Google“ und „Noch nicht bei Google“.
//
// ── ZUGANG ────────────────────────────────────────────────────────────────
// Dasselbe Dienstkonto wie Gmail und Kalender (GOOGLE_SA_KEY), aber OHNE „sub“:
// Das Dienstkonto spricht für sich selbst und braucht in der Search Console
// eine eigene Freigabe (Nutzer mit Lesezugriff) — dazu muss im Google-Projekt
// die Search Console API eingeschaltet sein. Fehlt eins davon, antwortet Google
// mit 403. Das ist kein Absturz, sondern ein Zustand: „zugang_fehlt“ mit einem
// Satz, was fehlt. Der Raum zeigt dann „Zugang fehlt noch“ und holt von selbst
// nach, sobald der Zugang da ist.
//
// ── EIN LAUF OHNE DATEN MELDET KEINEN ERFOLG (Lehre Clarity, 27.08.) ──────
// Der Tageslauf wirft, wenn Google nichts geliefert hat — die Lauf-Ampel sieht
// das. Ein Fehlschlag überschreibt nie einen guten Stand desselben Tages.
//
// Die Datenbank wird nur innerhalb der Funktionen geladen: Die reinen Teile
// (Deuten, Rechnen, Auswählen) prüft scripts/pruef-search-console.ts ohne Netz
// und ohne Datenbank.
// ═══════════════════════════════════════════════════════════════════════════
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { berlinToday } from "./fiaon-time";

/** Die Eigenschaft in der Search Console (URL-Präfix). */
export const GSC_EIGENSCHAFT = String(process.env.GSC_PROPERTY || "https://fiaon.com/").trim();
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com";
/** Unser Deckel für URL-Prüfungen je Berliner Tag. Google erlaubt 2.000. */
export const PRUEF_TAGESBUDGET = 150;
/** „Fast auf Seite 1“: durchschnittliche Position von … bis … */
export const FAST_SEITE_1 = { von: 8, bis: 20 } as const;
/** Der Tageslauf holt ab dieser Berliner Stunde. */
export const FRUEH_STUNDE = 5;
/** Fehlt der Zugang, versucht der Lauf es höchstens alle drei Stunden neu. */
const NEUVERSUCH_STUNDEN = 3;
/** Wie viele URL-Prüfungen gleichzeitig laufen (Google: 600 je Minute). */
const PRUEF_PARALLEL = 3;
/** Nach so vielen Fehlern hintereinander hört die URL-Prüfung für heute auf. */
const PRUEF_FEHLER_STOPP = 5;

// ═══════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════
export type GscZustand = "ok" | "zugang_fehlt" | "fehler";
/** Eine Zeile, wie searchAnalytics.query sie liefert. */
export interface GscZeile { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }
export interface Kennzahlen { klicks: number; impressionen: number; ctr: number; position: number | null }
export interface Eintrag extends Kennzahlen { name: string }
export interface Zeitraum { von: string; bis: string; vorherVon: string; vorherBis: string; tage: number }
export interface SitemapStand {
  pfad: string; eingereicht: string | null; gelesen: string | null; wartet: boolean;
  warnungen: number; fehler: number; adressen: number | null;
}
export interface PruefErgebnis {
  adresse: string; urteil: string; abdeckung: string | null; indexierung: string | null; abruf: string | null;
  robots: string | null; letzterCrawl: string | null; kanonisch: string | null; indexiert: boolean; link: string | null;
}
export interface Kandidat { adresse: string; prio: number }
export interface Bekannt { zuletztGeprueft: Date | null; indexiert: boolean | null }

/** Was Google gemeldet hat, in einem Satz für Menschen. */
export interface GoogleDeutung { zustand: "zugang_fehlt" | "fehler" | "kontingent"; code: string; grund: string }

export class GoogleAntwortFehler extends Error {
  constructor(public status: number, public deutung: GoogleDeutung) { super(deutung.grund); }
}

// ═══════════════════════════════════════════════════════════════════════════
// REINE TEILE — ohne Netz, ohne Datenbank (geprüft in scripts/pruef-search-console.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deutet eine Fehlerantwort von Google. 403 heißt fast immer „Zugang fehlt“ —
 * aber zwei verschiedene Dinge können fehlen, und der Satz sagt, welches.
 * Kein Schlüssel, keine Projektnummer, keine Adresse aus der Antwort wandert
 * in den Satz (der steht in der Datenbank und im Chefbüro).
 */
export function googleFehlerDeuten(status: number, body: unknown): GoogleDeutung {
  const b = (body && typeof body === "object" ? body : {}) as any;
  const fehler = b.error && typeof b.error === "object" ? b.error : {};
  const text = [
    typeof b.error === "string" ? b.error : "", typeof b.error_description === "string" ? b.error_description : "",
    String(fehler.message ?? ""), String(fehler.status ?? ""),
    ...(Array.isArray(fehler.errors) ? fehler.errors.map((e: any) => `${e?.reason ?? ""} ${e?.message ?? ""}`) : []),
    ...(Array.isArray(fehler.details) ? fehler.details.map((d: any) => `${d?.reason ?? ""}`) : []),
  ].join(" ").toLowerCase();

  if (/service_disabled|accessnotconfigured|has not been used in project|it is disabled|api has not been used/.test(text)) {
    return { zustand: "zugang_fehlt", code: "api_aus", grund: "Die Search Console API ist im Google-Projekt noch ausgeschaltet." };
  }
  if (status === 403 && /sufficient permission|do not own this site|not part of this property|forbidden|permission_denied/.test(text)) {
    return { zustand: "zugang_fehlt", code: "keine_freigabe", grund: "Das Dienstkonto hat in der Search Console noch keinen Zugriff auf fiaon.com." };
  }
  if (status === 429 || /resource_exhausted|quota|ratelimitexceeded/.test(text)) {
    return { zustand: "kontingent", code: "kontingent", grund: "Google lässt heute keine weiteren Abrufe zu (Tageskontingent)." };
  }
  if (/invalid_grant|unauthorized_client|invalid_client|access_denied/.test(text)) {
    return { zustand: "fehler", code: "schluessel", grund: "Google nimmt den Schlüssel des Dienstkontos nicht an." };
  }
  if (status === 401) return { zustand: "fehler", code: "anmeldung", grund: "Google hat die Anmeldung abgelehnt (401)." };
  if (status === 403) return { zustand: "zugang_fehlt", code: "verboten", grund: "Google verweigert den Zugriff (403)." };
  return { zustand: "fehler", code: `http_${status || 0}`, grund: `Google antwortete mit ${status || "keiner Antwort"}.` };
}

/** Kalendertag plus n Tage — reine Datumsrechnung auf JJJJ-MM-TT. */
export function tagPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Die Berliner Stunde (0–23) — nie über Number(format()), siehe fiaon-zeit-berlin-falle. NaN gilt als Nacht. */
export function berlinStunde(at: Date = new Date()): number {
  const teil = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(at).find((p) => p.type === "hour")?.value;
  const h = Number(teil);
  return Number.isFinite(h) ? h : -1;
}

/**
 * Die zwei Zeiträume: die letzten 28 Tage, für die Google schon Daten hat, und
 * die 28 davor. Google meldet mit 1–3 Tagen Verzug — deshalb zählt der letzte
 * Tag MIT Daten, nicht „gestern“ (sonst wäre der Vergleich immer schief).
 */
export function zeitraeume(letzterTag: string, tage = 28): Zeitraum {
  const bis = letzterTag;
  const von = tagPlus(bis, -(tage - 1));
  const vorherBis = tagPlus(von, -1);
  return { von, bis, vorherVon: tagPlus(vorherBis, -(tage - 1)), vorherBis, tage };
}

const zahlOder0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Summen über Zeilen. Die Position ist der Durchschnitt, gewichtet mit den
 * Impressionen — so rechnet Google selbst (Mittelwert über alle Einblendungen).
 */
export function summen(zeilen: GscZeile[]): Kennzahlen {
  let klicks = 0, impressionen = 0, posGewicht = 0;
  for (const z of zeilen) {
    const i = zahlOder0(z.impressions);
    klicks += zahlOder0(z.clicks);
    impressionen += i;
    posGewicht += zahlOder0(z.position) * i;
  }
  return {
    klicks, impressionen,
    ctr: impressionen > 0 ? klicks / impressionen : 0,
    position: impressionen > 0 ? Math.round((posGewicht / impressionen) * 10) / 10 : null,
  };
}

/** Zeilen einer Dimension als Einträge (name = erster Schlüssel). */
export function eintraege(zeilen: GscZeile[] | undefined): Eintrag[] {
  return (zeilen ?? []).map((z) => ({
    name: String(z.keys?.[0] ?? ""),
    klicks: zahlOder0(z.clicks),
    impressionen: zahlOder0(z.impressions),
    ctr: zahlOder0(z.ctr),
    position: z.position == null ? null : Math.round(zahlOder0(z.position) * 10) / 10,
  })).filter((e) => e.name !== "");
}

/** Suchanfragen auf Position 8–20 mit Impressionen — die kleinste Arbeit mit dem größten Sprung. */
export function fastSeiteEins(anfragen: Eintrag[], grenzen = FAST_SEITE_1): Eintrag[] {
  return anfragen
    .filter((a) => a.impressionen > 0 && a.position != null && a.position >= grenzen.von && a.position <= grenzen.bis)
    .sort((a, b) => b.impressionen - a.impressionen || (a.position ?? 99) - (b.position ?? 99));
}

/** Verlauf je Tag im aktuellen Zeitraum — Tage ohne Daten mit 0, damit die Linie keine Lücke verschweigt. */
export function verlaufJeTag(datumZeilen: GscZeile[], z: Zeitraum): (Kennzahlen & { tag: string })[] {
  const nachTag = new Map(datumZeilen.map((r) => [String(r.keys?.[0] ?? ""), r]));
  const raus: (Kennzahlen & { tag: string })[] = [];
  for (let t = z.von; t <= z.bis; t = tagPlus(t, 1)) {
    const r = nachTag.get(t);
    raus.push({ tag: t, ...summen(r ? [r] : []) });
  }
  return raus;
}

/** Datumszeilen in einem Bereich (einschließlich). */
export function imBereich(datumZeilen: GscZeile[], von: string, bis: string): GscZeile[] {
  return datumZeilen.filter((r) => { const t = String(r.keys?.[0] ?? ""); return t >= von && t <= bis; });
}

/** Die Antwort von sitemaps.list, ohne Zahlen als Text. */
export function sitemapStand(antwort: unknown): SitemapStand[] {
  const liste = Array.isArray((antwort as any)?.sitemap) ? (antwort as any).sitemap : [];
  return liste.map((s: any) => {
    const inhalte = Array.isArray(s?.contents) ? s.contents : [];
    const eingereicht = inhalte.reduce((n: number, c: any) => n + zahlOder0(c?.submitted), 0);
    return {
      pfad: String(s?.path ?? ""),
      eingereicht: s?.lastSubmitted ? String(s.lastSubmitted) : null,
      gelesen: s?.lastDownloaded ? String(s.lastDownloaded) : null,
      wartet: s?.isPending === true,
      warnungen: zahlOder0(s?.warnings),
      fehler: zahlOder0(s?.errors),
      adressen: inhalte.length ? eingereicht : null,
    };
  }).filter((s: SitemapStand) => s.pfad);
}

/** Die Antwort einer URL-Prüfung. PASS und PARTIAL heißen: Die Seite ist bei Google. */
export function pruefungDeuten(adresse: string, antwort: unknown): PruefErgebnis {
  const r = (antwort as any)?.inspectionResult ?? {};
  const s = r.indexStatusResult ?? {};
  const urteil = String(s.verdict ?? "VERDICT_UNSPECIFIED");
  return {
    adresse,
    urteil,
    abdeckung: s.coverageState ? String(s.coverageState).slice(0, 200) : null,
    indexierung: s.indexingState ? String(s.indexingState) : null,
    abruf: s.pageFetchState ? String(s.pageFetchState) : null,
    robots: s.robotsTxtState ? String(s.robotsTxtState) : null,
    letzterCrawl: s.lastCrawlTime && !String(s.lastCrawlTime).startsWith("1970") ? String(s.lastCrawlTime) : null,
    kanonisch: s.googleCanonical ? String(s.googleCanonical) : null,
    indexiert: urteil === "PASS" || urteil === "PARTIAL",
    link: r.inspectionResultLink ? String(r.inspectionResultLink) : null,
  };
}

/** Adressen und Priorität aus einer Sitemap (urlset). */
export function sitemapAdressen(xml: string): Kandidat[] {
  const raus: Kandidat[] = [];
  const gesehen = new Set<string>();
  const ent = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const muster = /<url>([\s\S]*?)<\/url>/g;
  for (let m = muster.exec(String(xml)); m; m = muster.exec(String(xml))) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(m[1])?.[1];
    if (!loc) continue;
    const adresse = ent(loc);
    if (gesehen.has(adresse)) continue;
    gesehen.add(adresse);
    const p = Number(/<priority>\s*([\d.]+)\s*<\/priority>/.exec(m[1])?.[1]);
    raus.push({ adresse, prio: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5 });
  }
  return raus;
}

/**
 * Wie lange nach der letzten Prüfung eine Adresse wieder dran ist (Stunden).
 * Was noch nicht bei Google ist, wollen wir am Tag sehen, an dem es hineinkommt —
 * die Kernseiten (Priorität ab 0,8) täglich, den Rest jeden zweiten Tag. Was
 * schon drin ist, reicht alle drei (Kern) bzw. sieben Tage.
 */
export function pruefAbstandStunden(prio: number, indexiert: boolean | null): number {
  if (indexiert === true) return prio >= 0.9 ? 70 : 166;
  return prio >= 0.8 ? 20 : 44;
}

/**
 * Welche Adressen heute geprüft werden: alle fälligen, höchste Priorität zuerst,
 * bei gleicher Priorität die am längsten nicht geprüften (nie geprüft = ganz vorn).
 */
export function pruefAuswahl(kandidaten: Kandidat[], bekannt: Map<string, Bekannt>, jetzt: Date, budget: number): string[] {
  if (budget <= 0) return [];
  const faellig = kandidaten.filter((k) => {
    const b = bekannt.get(k.adresse);
    if (!b?.zuletztGeprueft) return true;
    return jetzt.getTime() - b.zuletztGeprueft.getTime() >= pruefAbstandStunden(k.prio, b.indexiert) * 3_600_000;
  });
  const alter = (a: string) => bekannt.get(a)?.zuletztGeprueft?.getTime() ?? -Infinity;
  return faellig
    .sort((a, b) => b.prio - a.prio || alter(a.adresse) - alter(b.adresse))
    .slice(0, budget)
    .map((k) => k.adresse);
}

/** Was die Kacheln zeigen: Summen jetzt und davor, aus den Datumszeilen. */
export function auswerten(datumZeilen: GscZeile[], z: Zeitraum): { jetzt: Kennzahlen; vorher: Kennzahlen } {
  return { jetzt: summen(imBereich(datumZeilen, z.von, z.bis)), vorher: summen(imBereich(datumZeilen, z.vorherVon, z.vorherBis)) };
}

// ═══════════════════════════════════════════════════════════════════════════
// NETZ — Token und Anfragen
// ═══════════════════════════════════════════════════════════════════════════

/** Austauschbar nur für den Prüfstand (gefälschtes Google ohne Netz). */
export const gscTechnik: { fetch: typeof fetch } = { fetch: (...a: Parameters<typeof fetch>) => fetch(...a) };

interface Dienstkonto { client_email: string; private_key: string; token_uri?: string }
function dienstkonto(): Dienstkonto | null {
  try {
    const j = process.env.GOOGLE_SA_KEY ? JSON.parse(process.env.GOOGLE_SA_KEY) : null;
    return j?.client_email && j?.private_key ? j : null;
  } catch { return null; }
}
const b64url = (s: Buffer | string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Die signierte Anfrage für den Token — ohne „sub“: Das Dienstkonto spricht für sich selbst. */
export function tokenAnfrage(sa: Dienstkonto, jetztSek: number): { ziel: string; body: string } {
  const ziel = sa.token_uri || "https://oauth2.googleapis.com/token";
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const rumpf = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: ziel, iat: jetztSek, exp: jetztSek + 3600 }));
  const sig = b64url(createSign("RSA-SHA256").update(`${kopf}.${rumpf}`).sign(sa.private_key));
  return { ziel, body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${kopf}.${rumpf}.${sig}` };
}

let tokenSpeicher: { konto: string; token: string; bis: number } | null = null;
export async function gscToken(): Promise<string> {
  const sa = dienstkonto();
  if (!sa) {
    throw new GoogleAntwortFehler(0, { zustand: "zugang_fehlt", code: "schluessel_fehlt", grund: "Der Schlüssel des Google-Dienstkontos fehlt (GOOGLE_SA_KEY)." });
  }
  if (tokenSpeicher && tokenSpeicher.konto === sa.client_email && tokenSpeicher.bis > Date.now() + 5 * 60_000) return tokenSpeicher.token;
  const { ziel, body } = tokenAnfrage(sa, Math.floor(Date.now() / 1000));
  const res = await gscTechnik.fetch(ziel, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new GoogleAntwortFehler(res.status, googleFehlerDeuten(res.status, j));
  tokenSpeicher = { konto: sa.client_email, token: String(j.access_token), bis: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return tokenSpeicher.token;
}

async function google(methode: "GET" | "POST", pfad: string, body?: unknown): Promise<any> {
  const token = await gscToken();
  const res = await gscTechnik.fetch(`${API}${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new GoogleAntwortFehler(res.status, googleFehlerDeuten(res.status, j));
  return j ?? {};
}

const eigenschaftPfad = () => `/webmasters/v3/sites/${encodeURIComponent(GSC_EIGENSCHAFT)}`;

async function analyse(von: string, bis: string, dimensionen: string[], zeilen: number): Promise<GscZeile[]> {
  const j = await google("POST", `${eigenschaftPfad()}/searchAnalytics/query`, {
    startDate: von, endDate: bis, dimensions: dimensionen, type: "web", dataState: "all", rowLimit: zeilen,
  });
  return Array.isArray(j?.rows) ? j.rows : [];
}

export interface GscDaten {
  zeitraum: Zeitraum;
  summen: { jetzt: Kennzahlen; vorher: Kennzahlen };
  verlauf: (Kennzahlen & { tag: string })[];
  anfragen: Eintrag[]; seiten: Eintrag[]; laender: Eintrag[]; geraete: Eintrag[];
  sitemaps: SitemapStand[];
}

/** Alles aus searchAnalytics und sitemaps — fünf Anfragen plus eine. Wirft GoogleAntwortFehler. */
export async function gscHolen(jetzt: Date = new Date()): Promise<GscDaten> {
  const gestern = tagPlus(berlinToday(jetzt), -1);
  // 60 Tage je Tag — daraus der letzte Tag mit Daten und beide Zeiträume.
  const datum = await analyse(tagPlus(gestern, -59), gestern, ["date"], 100);
  const letzter = datum.map((r) => String(r.keys?.[0] ?? "")).filter(Boolean).sort().pop() ?? gestern;
  const z = zeitraeume(letzter);
  const [anfragen, seiten, laender, geraete, karten] = await Promise.all([
    analyse(z.von, z.bis, ["query"], 500),
    analyse(z.von, z.bis, ["page"], 100),
    analyse(z.von, z.bis, ["country"], 30),
    analyse(z.von, z.bis, ["device"], 5),
    google("GET", `${eigenschaftPfad()}/sitemaps`),
  ]);
  return {
    zeitraum: z,
    summen: auswerten(datum, z),
    verlauf: verlaufJeTag(datum, z),
    anfragen: eintraege(anfragen),
    seiten: eintraege(seiten),
    laender: eintraege(laender),
    geraete: eintraege(geraete),
    sitemaps: sitemapStand(karten),
  };
}

/** Eine Adresse bei Google prüfen. Wirft GoogleAntwortFehler. */
export async function gscAdressePruefen(adresse: string): Promise<PruefErgebnis> {
  const j = await google("POST", "/v1/urlInspection/index:inspect", { inspectionUrl: adresse, siteUrl: GSC_EIGENSCHAFT, languageCode: "de-DE" });
  return pruefungDeuten(adresse, j);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
async function db() { return (await import("./db-pool")).sqlPool; }
/** jsonb immer als Text übergeben und in SQL umwandeln — sonst legt postgres.js einen JSON-TEXT ab (E-377). */
const j = (x: unknown) => JSON.stringify(x ?? null);

let bereit: Promise<void> | null = null;
export function ensureGscTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const sqlPool = await db();
      const r = (await sqlPool`SELECT to_regclass('public.fiaon_gsc_adressen') AS a, to_regclass('public.fiaon_gsc_tage') AS t`) as any[];
      if (r[0]?.a && r[0]?.t) return;
      const datei = path.resolve(process.cwd(), "db", "migrations", "126_google_search_console.sql");
      // SET ohne LOCAL bliebe an der Verbindung des Pools hängen — hier nur für diese Transaktion.
      const text = readFileSync(datei, "utf8").replace(/^SET lock_timeout\b/m, "SET LOCAL lock_timeout");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(text);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Die Adressen der Sitemap, aus denselben Funktionen, die /sitemap.xml baut. */
export async function sitemapKandidaten(): Promise<Kandidat[]> {
  const { sitemapEintraege } = await import("./fiaon-seiten-seo");
  const { sitemapXml } = await import("../routes/fiaon-ratgeber");
  const statisch = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEintraege()}\n</urlset>`;
  return sitemapAdressen(await sitemapXml(statisch));
}

/** Wie viele URL-Prüfungen heute (Berliner Tag) schon liefen. */
async function heuteGeprueft(): Promise<number> {
  const sqlPool = await db();
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_gsc_adressen
     WHERE (zuletzt_geprueft AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  return Number(r?.n ?? 0);
}

/** Ein Ergebnis ablegen — mit dem Übergang „war nicht drin → ist drin“ (Neu bei Google). */
async function pruefungAblegen(e: PruefErgebnis): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    UPDATE fiaon_gsc_adressen SET
      zuerst_geprueft  = COALESCE(zuerst_geprueft, NOW()),
      zuletzt_geprueft = NOW(),
      urteil = ${e.urteil}, abdeckung = ${e.abdeckung}, indexierung = ${e.indexierung}, abruf = ${e.abruf},
      robots = ${e.robots}, letzter_crawl = ${e.letzterCrawl}, kanonisch = ${e.kanonisch}, pruef_link = ${e.link},
      fehler = NULL,
      indexiert_seit = CASE WHEN ${e.indexiert} THEN COALESCE(CASE WHEN indexiert THEN indexiert_seit END, NOW()) ELSE NULL END,
      neu_beobachtet = CASE WHEN ${e.indexiert} THEN (CASE WHEN indexiert THEN neu_beobachtet ELSE indexiert IS NOT NULL END) ELSE FALSE END,
      indexiert = ${e.indexiert}
    WHERE adresse = ${e.adresse}`;
}

async function pruefFehlerAblegen(adresse: string, grund: string): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    UPDATE fiaon_gsc_adressen SET zuerst_geprueft = COALESCE(zuerst_geprueft, NOW()), zuletzt_geprueft = NOW(), fehler = ${grund.slice(0, 300)}
     WHERE adresse = ${adresse}`;
}

/** Die Sitemap in die Adresstabelle spiegeln: neue anlegen, Priorität nachziehen, verschwundene markieren. */
async function adressenSpiegeln(kandidaten: Kandidat[]): Promise<void> {
  if (!kandidaten.length) return;
  const sqlPool = await db();
  const adressen = kandidaten.map((k) => k.adresse);
  const prios = kandidaten.map((k) => k.prio);
  await sqlPool`
    INSERT INTO fiaon_gsc_adressen (adresse, prio, in_sitemap)
    SELECT a, p, TRUE FROM unnest(${adressen}::text[], ${prios}::numeric[]) AS x(a, p)
    ON CONFLICT (adresse) DO UPDATE SET prio = EXCLUDED.prio, in_sitemap = TRUE`;
  await sqlPool`UPDATE fiaon_gsc_adressen SET in_sitemap = FALSE WHERE in_sitemap AND NOT (adresse = ANY(${adressen}::text[]))`;
}

export interface PruefLauf { geprueft: number; fehler: number; gestoppt: string | null; budgetRest: number }

/** Die URL-Prüfung des Tages: höchstens bis zum Tagesbudget, nach Priorität. */
async function adressenPruefen(kandidaten: Kandidat[], jetzt: Date): Promise<PruefLauf> {
  const sqlPool = await db();
  await adressenSpiegeln(kandidaten);
  const budget = Math.max(0, PRUEF_TAGESBUDGET - (await heuteGeprueft()));
  const zeilen = (await sqlPool`SELECT adresse, zuletzt_geprueft, indexiert FROM fiaon_gsc_adressen WHERE in_sitemap`) as any[];
  const bekannt = new Map<string, Bekannt>(zeilen.map((z) => [String(z.adresse), {
    zuletztGeprueft: z.zuletzt_geprueft ? new Date(z.zuletzt_geprueft) : null,
    indexiert: z.indexiert == null ? null : Boolean(z.indexiert),
  }]));
  const auswahl = pruefAuswahl(kandidaten, bekannt, jetzt, budget);
  let geprueft = 0, fehler = 0, inFolge = 0;
  let gestoppt: string | null = null;
  let i = 0;
  const arbeiter = async () => {
    while (!gestoppt && i < auswahl.length) {
      const adresse = auswahl[i++];
      try {
        await pruefungAblegen(await gscAdressePruefen(adresse));
        geprueft++; inFolge = 0;
      } catch (e) {
        const d = e instanceof GoogleAntwortFehler ? e.deutung : null;
        if (d && (d.zustand === "zugang_fehlt" || d.zustand === "kontingent")) { gestoppt = d.grund; break; }
        fehler++; inFolge++;
        await pruefFehlerAblegen(adresse, d?.grund ?? (e instanceof Error ? e.message : String(e))).catch(() => {});
        if (inFolge >= PRUEF_FEHLER_STOPP) gestoppt = `${PRUEF_FEHLER_STOPP} Fehler hintereinander — für heute aufgehört.`;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PRUEF_PARALLEL, auswahl.length) }, arbeiter));
  return { geprueft, fehler, gestoppt, budgetRest: Math.max(0, budget - geprueft - fehler) };
}

/** Zählt den Stand der Adressen (für Schnappschuss und Anzeige). */
async function adressenZahlen(): Promise<{ gesamt: number; beiGoogle: number; nicht: number; ungeprueft: number; heute: number }> {
  const sqlPool = await db();
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE indexiert IS TRUE)::int AS bei_google,
           COUNT(*) FILTER (WHERE indexiert IS FALSE)::int AS nicht,
           COUNT(*) FILTER (WHERE indexiert IS NULL)::int AS ungeprueft,
           COUNT(*) FILTER (WHERE (zuletzt_geprueft AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute
      FROM fiaon_gsc_adressen WHERE in_sitemap`) as any[];
  return { gesamt: Number(r?.gesamt ?? 0), beiGoogle: Number(r?.bei_google ?? 0), nicht: Number(r?.nicht ?? 0), ungeprueft: Number(r?.ungeprueft ?? 0), heute: Number(r?.heute ?? 0) };
}

export interface AbrufErgebnis { zustand: GscZustand; grund: string | null; code: string | null; pruefung: PruefLauf | null }

/** Einen Zustand ohne Daten ablegen — überschreibt nie einen guten Stand desselben Tages. */
async function zustandAblegen(tag: string, zustand: Exclude<GscZustand, "ok">, d: GoogleDeutung, vonHand: boolean): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    INSERT INTO fiaon_gsc_tage (tag, geholt_am, zustand, grund_code, grund, von_hand, eigenschaft)
    VALUES (${tag}, NOW(), ${zustand}, ${d.code}, ${d.grund}, ${vonHand}, ${GSC_EIGENSCHAFT})
    ON CONFLICT (tag) DO UPDATE SET geholt_am = NOW(), zustand = EXCLUDED.zustand, grund_code = EXCLUDED.grund_code,
      grund = EXCLUDED.grund, von_hand = EXCLUDED.von_hand
    WHERE fiaon_gsc_tage.zustand <> 'ok'`;
}

/**
 * Der ganze Abruf: Zahlen holen, Tag ablegen, Adressen prüfen.
 * Wirft nie wegen Google — das Ergebnis sagt, wie es ausging.
 */
export async function gscAbruf(opts: { vonHand?: boolean; jetzt?: Date; kandidaten?: Kandidat[] } = {}): Promise<AbrufErgebnis> {
  await ensureGscTabellen();
  const jetzt = opts.jetzt ?? new Date();
  const tag = berlinToday(jetzt);
  const vonHand = !!opts.vonHand;
  let daten: GscDaten;
  try {
    daten = await gscHolen(jetzt);
  } catch (e) {
    const d: GoogleDeutung = e instanceof GoogleAntwortFehler
      ? (e.deutung.zustand === "kontingent" ? { ...e.deutung, zustand: "fehler" } : e.deutung)
      : { zustand: "fehler", code: "netz", grund: `Google war nicht erreichbar: ${String((e as Error)?.message || e).slice(0, 160)}` };
    const zustand = d.zustand === "zugang_fehlt" ? "zugang_fehlt" : "fehler";
    await zustandAblegen(tag, zustand, d, vonHand);
    console.log(`[GSC] Abruf ohne Daten (${d.code}): ${d.grund}`);
    return { zustand, grund: d.grund, code: d.code, pruefung: null };
  }

  const sqlPool = await db();
  const schreiben = async (pruefung: unknown) => sqlPool`
    INSERT INTO fiaon_gsc_tage (tag, geholt_am, zustand, grund_code, grund, von_hand, eigenschaft,
                                zeitraum, summen, verlauf, anfragen, seiten, laender, geraete, sitemaps, pruefung)
    VALUES (${tag}, NOW(), 'ok', NULL, NULL, ${vonHand}, ${GSC_EIGENSCHAFT},
            ${j(daten.zeitraum)}::text::jsonb, ${j(daten.summen)}::text::jsonb, ${j(daten.verlauf)}::text::jsonb,
            ${j(daten.anfragen.slice(0, 500))}::text::jsonb, ${j(daten.seiten)}::text::jsonb, ${j(daten.laender)}::text::jsonb,
            ${j(daten.geraete)}::text::jsonb, ${j(daten.sitemaps)}::text::jsonb, ${j(pruefung)}::text::jsonb)
    ON CONFLICT (tag) DO UPDATE SET geholt_am = NOW(), zustand = 'ok', grund_code = NULL, grund = NULL,
      von_hand = EXCLUDED.von_hand, eigenschaft = EXCLUDED.eigenschaft, zeitraum = EXCLUDED.zeitraum, summen = EXCLUDED.summen,
      verlauf = EXCLUDED.verlauf, anfragen = EXCLUDED.anfragen, seiten = EXCLUDED.seiten, laender = EXCLUDED.laender,
      geraete = EXCLUDED.geraete, sitemaps = EXCLUDED.sitemaps, pruefung = EXCLUDED.pruefung`;
  // Erst die Zahlen ablegen — die URL-Prüfung dauert eine Minute, die Kacheln sollen nicht darauf warten.
  await schreiben(null);

  let pruefung: PruefLauf | null = null;
  try {
    const kandidaten = opts.kandidaten ?? await sitemapKandidaten();
    pruefung = await adressenPruefen(kandidaten, jetzt);
  } catch (e) {
    pruefung = { geprueft: 0, fehler: 0, gestoppt: `URL-Prüfung gescheitert: ${String((e as Error)?.message || e).slice(0, 160)}`, budgetRest: 0 };
  }
  const stand = await adressenZahlen().catch(() => null);
  await sqlPool`UPDATE fiaon_gsc_tage SET pruefung = ${j({ ...pruefung, ...(stand ?? {}) })}::text::jsonb WHERE tag = ${tag}`;
  console.log(`[GSC] Abruf abgelegt (${vonHand ? "von Hand" : "Tageslauf"}): ${daten.summen.jetzt.klicks} Klicks, `
    + `${pruefung.geprueft} Adressen geprüft${pruefung.gestoppt ? ` — ${pruefung.gestoppt}` : ""}`);
  return { zustand: "ok", grund: pruefung.gestoppt, code: null, pruefung };
}

// ── EIN Abruf zur Zeit in diesem Prozess (Tageslauf und Knopf teilen ihn) ──
let laufend: Promise<AbrufErgebnis> | null = null;
let handErgebnis: { am: string; ergebnis: AbrufErgebnis } | null = null;
export const gscLaeuft = () => laufend !== null;
export const gscHandErgebnis = () => handErgebnis;

export function gscAbrufEinmal(opts: { vonHand?: boolean; jetzt?: Date } = {}): Promise<AbrufErgebnis> {
  if (laufend) return laufend;
  laufend = gscAbruf(opts)
    .then((e) => { if (opts.vonHand) handErgebnis = { am: new Date().toISOString(), ergebnis: e }; return e; })
    .catch((e) => {
      const ergebnis: AbrufErgebnis = { zustand: "fehler", grund: String((e as Error)?.message || e).slice(0, 200), code: "intern", pruefung: null };
      if (opts.vonHand) handErgebnis = { am: new Date().toISOString(), ergebnis };
      throw e;
    })
    .finally(() => { laufend = null; });
  return laufend;
}

/**
 * Der Tageslauf (stündlicher Takt, nurMitErgebnis): ab 05:00 Berlin einmal am Tag.
 * Gibt true zurück, wenn er Daten geholt hat; nichts, wenn nichts zu tun war;
 * wirft, wenn Google nichts geliefert hat (Lauf-Ampel).
 */
export async function gscTageslauf(jetzt: Date = new Date()): Promise<boolean | undefined> {
  if (berlinStunde(jetzt) < FRUEH_STUNDE) return undefined;
  await ensureGscTabellen();
  const sqlPool = await db();
  const [heute] = (await sqlPool`SELECT zustand, geholt_am FROM fiaon_gsc_tage WHERE tag = ${berlinToday(jetzt)}`) as any[];
  if (heute?.zustand === "ok") return undefined;
  if (heute?.geholt_am && jetzt.getTime() - new Date(heute.geholt_am).getTime() < NEUVERSUCH_STUNDEN * 3_600_000) return undefined;
  const e = await gscAbrufEinmal({ vonHand: false, jetzt });
  if (e.zustand !== "ok") throw new Error(`Google Search Console ohne Daten: ${e.grund ?? e.zustand}`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// FÜR DAS CHEFBÜRO — liest nur aus der Datenbank
// ═══════════════════════════════════════════════════════════════════════════
const zeitText = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
/** jsonb tolerant lesen — auch alte doppelt verpackte Zeilen (E-377). */
const jsonLesen = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  try { return JSON.parse(v); } catch { return null; }
};

export async function gscStand(): Promise<Record<string, unknown>> {
  await ensureGscTabellen();
  const sqlPool = await db();
  const [letzter] = (await sqlPool`
    SELECT tag, geholt_am, zustand, grund_code, grund, von_hand FROM fiaon_gsc_tage ORDER BY tag DESC LIMIT 1`) as any[];
  const [gut] = (await sqlPool`
    SELECT * FROM fiaon_gsc_tage WHERE zustand = 'ok' ORDER BY tag DESC LIMIT 1`) as any[];
  const neu = (await sqlPool`
    SELECT adresse, indexiert_seit, letzter_crawl FROM fiaon_gsc_adressen
     WHERE in_sitemap AND indexiert IS TRUE AND neu_beobachtet AND indexiert_seit > NOW() - INTERVAL '14 days'
     ORDER BY indexiert_seit DESC LIMIT 50`) as any[];
  const fehlt = (await sqlPool`
    SELECT adresse, prio, abdeckung, letzter_crawl, zuletzt_geprueft, pruef_link FROM fiaon_gsc_adressen
     WHERE in_sitemap AND indexiert IS FALSE
     ORDER BY prio DESC, adresse LIMIT 400`) as any[];
  const zahlen = await adressenZahlen();

  const anfragen = (jsonLesen(gut?.anfragen) as Eintrag[] | null) ?? [];
  return {
    eigenschaft: GSC_EIGENSCHAFT,
    zustand: letzter ? String(letzter.zustand) : "leer",
    grund: letzter?.grund ?? null,
    grundCode: letzter?.grund_code ?? null,
    letzterVersuch: zeitText(letzter?.geholt_am),
    stand: zeitText(gut?.geholt_am),
    zeitraum: jsonLesen(gut?.zeitraum),
    summen: jsonLesen(gut?.summen),
    verlauf: jsonLesen(gut?.verlauf) ?? [],
    fastSeiteEins: fastSeiteEins(anfragen).slice(0, 40),
    anfragen: anfragen.slice(0, 25),
    seiten: ((jsonLesen(gut?.seiten) as Eintrag[] | null) ?? []).slice(0, 25),
    laender: jsonLesen(gut?.laender) ?? [],
    geraete: jsonLesen(gut?.geraete) ?? [],
    sitemaps: jsonLesen(gut?.sitemaps) ?? [],
    pruefung: jsonLesen(gut?.pruefung),
    adressen: {
      ...zahlen,
      budget: PRUEF_TAGESBUDGET,
      neu: neu.map((r) => ({ adresse: String(r.adresse), seit: zeitText(r.indexiert_seit), crawl: zeitText(r.letzter_crawl) })),
      fehlt: fehlt.map((r) => ({
        adresse: String(r.adresse), prio: Number(r.prio), abdeckung: r.abdeckung ?? null,
        crawl: zeitText(r.letzter_crawl), geprueft: zeitText(r.zuletzt_geprueft), link: r.pruef_link ?? null,
      })),
    },
  };
}
