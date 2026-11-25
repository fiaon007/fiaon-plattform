// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-454 (28.10.2026): GOOGLE SEARCH CONSOLE IM CHEFBÜRO
//
//   A  REIN (immer, ohne Netz, ohne Datenbank): feste Beispielantworten von Google
//      → Deutung der Fehler (API aus / keine Freigabe / Kontingent), Zeiträume,
//      Summen mit gewichteter Position, „Fast auf Seite 1“, Sitemaps, URL-Prüfung,
//      Sitemap-Adressen, Auswahl der Tagesprüfung, Berliner Stunde, Token-Anfrage
//      (ohne „sub“, Signatur prüfbar) und gscHolen gegen ein GEFÄLSCHTES Google.
//   B  DATENBANK (--db, nur LOKAL): Tabellen anlegen, Abruf gegen gefälschtes Google,
//      jsonb wirklich Objekt/Liste, „Neu bei Google“-Übergang, Fehlschlag überschreibt
//      keinen guten Stand, Tageslauf nur ab 05:00 Berlin, gscStand für das Chefbüro.
//   C  LIVE (--live): EIN Token-Abruf und EIN sitemaps.list gegen Google mit dem
//      Schlüssel aus ~/Developer/fiaon-plattform/.env (nur GOOGLE_SA_KEY wird gelesen,
//      nie ausgegeben, keine Datenbank). Druckt nur Status und Deutung.
//
//   npx tsx scripts/pruef-search-console.ts
//   npx tsx scripts/pruef-search-console.ts --db 'postgresql://fiaon@127.0.0.1:54329/fiaon_pr_gsc?sslmode=require'
//   npx tsx scripts/pruef-search-console.ts --live
// ═══════════════════════════════════════════════════════════════════════════
import { generateKeyPairSync, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i >= 0 ? String(process.argv[i + 1] ?? "") : null; };
const DB = arg("--db");
const LIVE = process.argv.includes("--live");
// db-pool verlangt beim Laden eine Adresse — A und C verbinden nie.
process.env.DATABASE_URL = DB || "postgresql://pruef@127.0.0.1:9/keine";

let gut = 0, schlecht = 0;
const ok = (titel: string, bedingung: boolean, info?: unknown) => {
  if (bedingung) { gut++; console.log(`  ✓ ${titel}`); }
  else { schlecht++; console.log(`  ✗ ${titel}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const gleich = (titel: string, ist: unknown, soll: unknown) => ok(titel, JSON.stringify(ist) === JSON.stringify(soll), { ist, soll });
const gruppe = (t: string) => console.log(`\n── ${t}`);

const gsc = await import("../server/lib/fiaon-search-console");

// ── Ein Schlüsselpaar nur für diesen Lauf ───────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PRUEF_SA = {
  client_email: "pruefstand@beispiel.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  token_uri: "https://oauth2.googleapis.com/token",
};

// ── Ein gefälschtes Google ──────────────────────────────────────────────────
interface Anfrage { url: string; methode: string; body: any }
function falschesGoogle(antworten: {
  analyse?: (body: any) => { status?: number; json: any };
  sitemaps?: () => { status?: number; json: any };
  pruefen?: (body: any) => { status?: number; json: any };
}) {
  const anfragen: Anfrage[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    const body = init?.body && typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : init?.body;
    anfragen.push({ url: u, methode: String(init?.method ?? "GET"), body });
    const antwort = (status: number, json: any) => new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
    if (u.startsWith("https://oauth2.googleapis.com/token")) return antwort(200, { access_token: "prueftoken", expires_in: 3600 });
    if (u.includes("/searchAnalytics/query")) { const a = antworten.analyse?.(body) ?? { json: { rows: [] } }; return antwort(a.status ?? 200, a.json); }
    if (u.endsWith("/sitemaps")) { const a = antworten.sitemaps?.() ?? { json: {} }; return antwort(a.status ?? 200, a.json); }
    if (u.includes("/urlInspection/index:inspect")) { const a = antworten.pruefen?.(body) ?? { json: {} }; return antwort(a.status ?? 200, a.json); }
    return antwort(404, { error: { code: 404, message: "unbekannt" } });
  }) as typeof fetch;
  return { f, anfragen };
}

// ── Feste Beispiele (so wie Google sie schickt) ─────────────────────────────
const API_AUS = {
  error: {
    code: 403, status: "PERMISSION_DENIED",
    message: "Google Search Console API has not been used in project 123456789012 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=123456789012 then retry.",
    details: [{ "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "SERVICE_DISABLED", domain: "googleapis.com" }],
  },
};
const ALT_API_AUS = { error: { code: 403, message: "Access Not Configured.", errors: [{ domain: "usageLimits", reason: "accessNotConfigured", message: "Access Not Configured." }] } };
const KEINE_FREIGABE = {
  error: {
    code: 403, status: "PERMISSION_DENIED",
    message: "User does not have sufficient permission for site 'https://fiaon.com/'. See also: https://support.google.com/webmasters/answer/2451999.",
    errors: [{ message: "User does not have sufficient permission for site 'https://fiaon.com/'.", domain: "global", reason: "forbidden" }],
  },
};
const PRUEF_NICHT_EIGEN = { error: { code: 403, status: "PERMISSION_DENIED", message: "You do not own this site, or the inspected URL is not part of this property." } };
const KONTINGENT = { error: { code: 429, status: "RESOURCE_EXHAUSTED", message: "Quota exceeded for quota metric 'URL Inspection requests' and limit 'per day'." } };

/** 60 Tage Datumszeilen bis 26.10.2026 — Daten bis 25.10. (Google hinkt nach), Lücke am 10.10. */
function datumZeilen(): any[] {
  const zeilen: any[] = [];
  for (let t = "2026-08-28"; t <= "2026-10-25"; t = gsc.tagPlus(t, 1)) {
    if (t === "2026-10-10") continue;
    const jetzt = t >= "2026-09-28";
    zeilen.push({ keys: [t], clicks: jetzt ? 8 : 4, impressions: jetzt ? 30 : 20, ctr: 0, position: jetzt ? 6 : 9 });
  }
  return zeilen;
}
const ANFRAGEN = [
  { keys: ["fiaon"], clicks: 88, impressions: 150, ctr: 0.58, position: 1.2 },
  { keys: ["llc registration"], clicks: 0, impressions: 6, ctr: 0, position: 7.8 },
  { keys: ["registered agent"], clicks: 0, impressions: 12, ctr: 0, position: 11 },
  { keys: ["us gesellschaft gründen"], clicks: 1, impressions: 40, ctr: 0.025, position: 14.4 },
  { keys: ["itin beantragen"], clicks: 0, impressions: 9, ctr: 0, position: 20 },
  { keys: ["us steuernummer beantragen"], clicks: 0, impressions: 10, ctr: 0, position: 20.1 },
];
/** E-530 B2: Suche × Seite — zwei Schlüssel [Suche, Seite]. */
const ANFRAGE_SEITEN = [
  { keys: ["fiaon", "https://fiaon.com/"], clicks: 88, impressions: 150, ctr: 0.58, position: 1.2 },
  { keys: ["us gesellschaft gründen", "https://fiaon.com/business/us-firmengruendung"], clicks: 1, impressions: 40, ctr: 0.025, position: 14.4 },
  { keys: ["registered agent", "https://fiaon.com/ratgeber/x"], clicks: 0, impressions: 12, ctr: 0, position: 11 },
];
const SEITEN = [
  { keys: ["https://fiaon.com/"], clicks: 100, impressions: 300, position: 2 },
  { keys: ["https://fiaon.com/business/us-firmengruendung"], clicks: 5, impressions: 60, position: 9 },
  { keys: ["https://fiaon.com/ratgeber/x"], clicks: 3, impressions: 40, position: 12 },
];
/** Die Zeilen des gefälschten Google je Dimension (Suche × Seite getrennt von Suche). */
function zeilenFuer(b: any): any[] {
  const d = (b?.dimensions ?? []).join(",");
  return d === "date" ? datumZeilen() : d === "query" ? ANFRAGEN : d === "query,page" ? ANFRAGE_SEITEN : d === "page" ? SEITEN
    : d === "country" ? [{ keys: ["deu"], clicks: 150, impressions: 600, position: 5 }] : [{ keys: ["MOBILE"], clicks: 120, impressions: 500, ctr: 0.24, position: 6 }];
}
const SITEMAPS = {
  sitemap: [{
    path: "https://fiaon.com/sitemap.xml", lastSubmitted: "2026-10-28T07:12:00.000Z", isPending: false, isSitemapsIndex: false,
    type: "sitemap", lastDownloaded: "2026-10-28T07:15:00.000Z", warnings: "0", errors: "0",
    contents: [{ type: "web", submitted: "348", indexed: "0" }],
  }],
};
const pruefAntwort = (verdict: string, coverage: string, crawl = "2026-10-27T10:00:00Z") => ({
  inspectionResult: {
    inspectionResultLink: "https://search.google.com/search-console/inspect?resource_id=x&id=y",
    indexStatusResult: { verdict, coverageState: coverage, robotsTxtState: "ALLOWED", indexingState: "INDEXING_ALLOWED", lastCrawlTime: crawl, pageFetchState: "SUCCESSFUL", googleCanonical: "https://fiaon.com/business" },
  },
});

async function teilA() {
  gruppe("A1 Fehler deuten (feste Beispiele)");
  const a = gsc.googleFehlerDeuten(403, API_AUS);
  gleich("API aus → zugang_fehlt/api_aus", [a.zustand, a.code], ["zugang_fehlt", "api_aus"]);
  ok("Satz trägt keine Projektnummer", !/\d{6,}/.test(a.grund), a.grund);
  gleich("Alte Form accessNotConfigured → api_aus", gsc.googleFehlerDeuten(403, ALT_API_AUS).code, "api_aus");
  const f = gsc.googleFehlerDeuten(403, KEINE_FREIGABE);
  gleich("Keine Freigabe → zugang_fehlt/keine_freigabe", [f.zustand, f.code], ["zugang_fehlt", "keine_freigabe"]);
  gleich("URL-Prüfung „do not own“ → keine_freigabe", gsc.googleFehlerDeuten(403, PRUEF_NICHT_EIGEN).code, "keine_freigabe");
  gleich("429 → kontingent", gsc.googleFehlerDeuten(429, KONTINGENT).zustand, "kontingent");
  gleich("Token invalid_grant → fehler/schluessel", [gsc.googleFehlerDeuten(400, { error: "invalid_grant", error_description: "Invalid JWT Signature." }).zustand, gsc.googleFehlerDeuten(400, { error: "invalid_grant" }).code], ["fehler", "schluessel"]);
  gleich("500 ohne Text → fehler/http_500", gsc.googleFehlerDeuten(500, null).code, "http_500");
  gleich("403 ohne Text → zugang_fehlt", gsc.googleFehlerDeuten(403, {}).zustand, "zugang_fehlt");

  gruppe("A2 Zeiträume und Datumsrechnung");
  gleich("tagPlus über Monatsgrenze", gsc.tagPlus("2026-10-31", 1), "2026-11-01");
  gleich("tagPlus über Zeitumstellung (25.10.)", gsc.tagPlus("2026-10-24", 2), "2026-10-26");
  gleich("zeitraeume(25.10.)", gsc.zeitraeume("2026-10-25"),
    { von: "2026-09-28", bis: "2026-10-25", vorherVon: "2026-08-31", vorherBis: "2026-09-27", tage: 28 });
  gleich("Berliner Stunde im Winter (04:30 UTC → 5)", gsc.berlinStunde(new Date("2026-10-28T04:30:00Z")), 5);
  gleich("Berliner Stunde im Sommer (03:00 UTC → 5)", gsc.berlinStunde(new Date("2026-07-01T03:00:00Z")), 5);
  gleich("Berliner Stunde Mitternacht (23:10 UTC im Winter → 0)", gsc.berlinStunde(new Date("2026-10-28T23:10:00Z")), 0);

  gruppe("A3 Summen, Verlauf, Fast auf Seite 1");
  const s = gsc.summen([{ clicks: 10, impressions: 100, position: 2 }, { clicks: 0, impressions: 300, position: 10 }]);
  gleich("Position mit Impressionen gewichtet (8,0), CTR 2,5 %", [s.klicks, s.impressionen, s.position, s.ctr], [10, 400, 8, 0.025]);
  gleich("Ohne Impressionen keine Position", gsc.summen([]).position, null);
  const z = gsc.zeitraeume("2026-10-25");
  const aus = gsc.auswerten(datumZeilen(), z);
  gleich("Jetzt: 27 Tage mit Daten (Lücke 10.10.) → 216 Klicks, 810 Impr., Pos 6", [aus.jetzt.klicks, aus.jetzt.impressionen, aus.jetzt.position], [216, 810, 6]);
  gleich("Davor: 28 Tage → 112 Klicks, 560 Impr., Pos 9", [aus.vorher.klicks, aus.vorher.impressionen, aus.vorher.position], [112, 560, 9]);
  const v = gsc.verlaufJeTag(datumZeilen(), z);
  gleich("Verlauf hat 28 Tage, die Lücke steht mit 0", [v.length, v.find((t) => t.tag === "2026-10-10")?.klicks], [28, 0]);
  const fast = gsc.fastSeiteEins(gsc.eintraege(ANFRAGEN));
  gleich("Fast auf Seite 1: 8–20, nach Impressionen", fast.map((e) => e.name), ["us gesellschaft gründen", "registered agent", "itin beantragen"]);

  gruppe("A4 Sitemaps, URL-Prüfung, Sitemap-Adressen");
  gleich("sitemaps.list: Zahlen statt Text", gsc.sitemapStand(SITEMAPS)[0],
    { pfad: "https://fiaon.com/sitemap.xml", eingereicht: "2026-10-28T07:12:00.000Z", gelesen: "2026-10-28T07:15:00.000Z", wartet: false, warnungen: 0, fehler: 0, adressen: 348 });
  gleich("sitemaps.list leer → []", gsc.sitemapStand({}), []);
  const p = gsc.pruefungDeuten("https://fiaon.com/business", pruefAntwort("PASS", "Gesendet und indexiert"));
  gleich("PASS = bei Google", [p.indexiert, p.abdeckung, p.letzterCrawl], [true, "Gesendet und indexiert", "2026-10-27T10:00:00Z"]);
  gleich("PARTIAL = bei Google", gsc.pruefungDeuten("x", pruefAntwort("PARTIAL", "…")).indexiert, true);
  const n = gsc.pruefungDeuten("x", pruefAntwort("NEUTRAL", "Gefunden – zurzeit nicht indexiert", "1970-01-01T00:00:00Z"));
  gleich("NEUTRAL = nicht bei Google, Crawl 1970 = nie", [n.indexiert, n.letzterCrawl], [false, null]);
  gleich("Leere Antwort = nicht bei Google", gsc.pruefungDeuten("x", {}).indexiert, false);
  const xml = `<urlset><url><loc>https://fiaon.com/</loc><priority>1.0</priority></url>
    <url><loc>https://fiaon.com/a?x=1&amp;y=2</loc><priority>0.6</priority></url>
    <url><loc>https://fiaon.com/</loc><priority>0.3</priority></url><url><loc>https://fiaon.com/ohne</loc></url></urlset>`;
  gleich("Sitemap: &amp; entpackt, doppelt raus, ohne Priorität 0,5", gsc.sitemapAdressen(xml),
    [{ adresse: "https://fiaon.com/", prio: 1 }, { adresse: "https://fiaon.com/a?x=1&y=2", prio: 0.6 }, { adresse: "https://fiaon.com/ohne", prio: 0.5 }]);

  gruppe("A5 Auswahl der Tagesprüfung");
  const jetzt = new Date("2026-10-29T05:10:00Z");
  const std = (h: number) => new Date(jetzt.getTime() - h * 3_600_000);
  const kand = [
    { adresse: "/kern-neu", prio: 0.9 }, { adresse: "/kern-drin", prio: 0.9 }, { adresse: "/kern-fehlt", prio: 0.8 },
    { adresse: "/rand-fehlt", prio: 0.5 }, { adresse: "/rand-drin", prio: 0.5 }, { adresse: "/rand-nie", prio: 0.5 },
  ];
  const bek = new Map<string, { zuletztGeprueft: Date | null; indexiert: boolean | null }>([
    ["/kern-drin", { zuletztGeprueft: std(48), indexiert: true }],     // drin, Kern: erst nach 70 h
    ["/kern-fehlt", { zuletztGeprueft: std(21), indexiert: false }],   // fehlt, Kern: täglich → fällig
    ["/rand-fehlt", { zuletztGeprueft: std(30), indexiert: false }],   // fehlt, Rand: alle 44 h → nicht fällig
    ["/rand-drin", { zuletztGeprueft: std(200), indexiert: true }],    // drin, Rand: nach 166 h → fällig
  ]);
  // E-530 B1 (25.11.2026): älteste Prüfung zuerst, Priorität nur bei Gleichstand (vorher Priorität zuerst).
  gleich("Fällige nach Alter der Prüfung, nie geprüft vorn (Priorität bei Gleichstand)", gsc.pruefAuswahl(kand, bek, jetzt, 10), ["/kern-neu", "/rand-nie", "/rand-drin", "/kern-fehlt"]);
  gleich("Budget begrenzt", gsc.pruefAuswahl(kand, bek, jetzt, 2), ["/kern-neu", "/rand-nie"]);
  gleich("Budget 0 → nichts", gsc.pruefAuswahl(kand, bek, jetzt, 0), []);

  gruppe("A6 Token-Anfrage (ohne sub, Signatur echt)");
  const t = gsc.tokenAnfrage(PRUEF_SA, 1_800_000_000);
  const assertion = new URLSearchParams(t.body).get("assertion") ?? "";
  const [kopf, rumpf, sig] = assertion.split(".");
  const daten = JSON.parse(Buffer.from(rumpf, "base64url").toString("utf8"));
  gleich("Ziel ist token_uri", t.ziel, "https://oauth2.googleapis.com/token");
  ok("Kein „sub“ (Dienstkonto spricht für sich)", !("sub" in daten), daten);
  gleich("Scope nur lesen", daten.scope, "https://www.googleapis.com/auth/webmasters.readonly");
  gleich("Laufzeit eine Stunde", daten.exp - daten.iat, 3600);
  ok("Signatur prüft mit dem öffentlichen Schlüssel", createVerify("RSA-SHA256").update(`${kopf}.${rumpf}`).verify(publicKey, Buffer.from(sig, "base64url")));

  gruppe("A7 gscHolen gegen ein gefälschtes Google (kein Netz)");
  process.env.GOOGLE_SA_KEY = JSON.stringify(PRUEF_SA);
  const echt = gsc.gscTechnik.fetch;
  const g = falschesGoogle({ analyse: (b) => ({ json: { rows: zeilenFuer(b) } }), sitemaps: () => ({ json: SITEMAPS }) });
  gsc.gscTechnik.fetch = g.f;
  const h = await gsc.gscHolen(new Date("2026-10-28T06:00:00Z"));
  const datumAnfrage = g.anfragen.find((x) => x.body?.dimensions?.[0] === "date")?.body;
  gleich("Datumsanfrage: 60 Tage bis gestern, dataState all", [datumAnfrage?.startDate, datumAnfrage?.endDate, datumAnfrage?.dataState], ["2026-08-29", "2026-10-27", "all"]);
  gleich("Zeitraum am letzten Tag MIT Daten (25.10.)", [h.zeitraum.von, h.zeitraum.bis], ["2026-09-28", "2026-10-25"]);
  const qa = g.anfragen.find((x) => x.body?.dimensions?.[0] === "query")?.body;
  // E-530 B2: alle sichtbaren Suchen (höchstens 25.000), sonst stimmt „anonym“ nicht; abgelegt werden weiter 500.
  gleich("Suchanfragen im selben Zeitraum, 25.000 Zeilen", [qa?.startDate, qa?.endDate, qa?.rowLimit], ["2026-09-28", "2026-10-25", 25000]);
  ok("Eigenschaft richtig kodiert", g.anfragen.some((x) => x.url.includes("/webmasters/v3/sites/https%3A%2F%2Ffiaon.com%2F/searchAnalytics/query")));
  // E-530 B2: dazu Suche × Seite (Global gegen Privat) → sieben Anfragen.
  ok("Token mit Bearer benutzt (keine Anfrage ohne)", g.anfragen.filter((x) => !x.url.includes("oauth2")).length === 7);
  gleich("Summen aus den Datumszeilen", [h.summen.jetzt.klicks, h.summen.vorher.klicks], [216, 112]);
  gleich("Sitemaps übernommen", h.sitemaps[0]?.adressen, 348);
  gleich("Geräte/Länder/Seiten da", [h.geraete[0]?.name, h.laender[0]?.name, h.seiten[0]?.name], ["MOBILE", "deu", "https://fiaon.com/"]);
  // E-530 B2: Suche × Seite kommt mit zwei Schlüsseln [Suche, Seite] — daraus Global gegen Privat.
  const qp = g.anfragen.find((x) => x.body?.dimensions?.join(",") === "query,page")?.body;
  gleich("Suche × Seite: gleicher Zeitraum, 25.000 Zeilen", [qp?.startDate, qp?.endDate, qp?.rowLimit], ["2026-09-28", "2026-10-25", 25000]);
  gleich("Global aus Suche × Seite: gesamt 105, Marke 88, ohne Marke 1, anonym 16",
    [h.klickArten.global?.gesamt, h.klickArten.global?.marke, h.klickArten.global?.ohneMarke, h.klickArten.global?.anonym], [105, 88, 1, 16]);
  gleich("Privat: 3 Klicks, alle anonym", [h.klickArten.privat?.gesamt, h.klickArten.privat?.anonym, h.klickArten.privat?.anteilAnonym], [3, 3, 1]);
  gleich("Alle: sichtbar 89 von 216, kein Hinweis", [h.klickArten.sichtbar, h.klickArten.gesamt, h.klickArten.anonym, h.klickArten.hinweis], [89, 216, 127, null]);

  // Scheitert NUR Suche × Seite (Kontingent), laufen die Kernzahlen weiter.
  const g429 = falschesGoogle({
    analyse: (b) => (b.dimensions.join(",") === "query,page" ? { status: 429, json: KONTINGENT } : { json: { rows: zeilenFuer(b) } }),
    sitemaps: () => ({ json: SITEMAPS }),
  });
  gsc.gscTechnik.fetch = g429.f;
  let h429: any = null, w429: unknown = null;
  try { h429 = await gsc.gscHolen(new Date("2026-10-28T06:00:00Z")); } catch (e) { w429 = e; }
  ok("429 nur bei Suche × Seite → kein Wurf, Kacheln da", !w429 && h429?.summen?.jetzt?.klicks === 216, String(w429));
  gleich("… Global/Privat null, Marke und anonym trotzdem da, Hinweis mit Grund",
    [h429?.klickArten?.global, h429?.klickArten?.privat, h429?.klickArten?.marke, h429?.klickArten?.anonym, /Global gegen Privat fehlt heute: .*Tageskontingent/.test(String(h429?.klickArten?.hinweis))],
    [null, null, 88, 127, true]);

  const g403 = falschesGoogle({ analyse: () => ({ status: 403, json: API_AUS }) });
  gsc.gscTechnik.fetch = g403.f;
  let fehler: any = null;
  try { await gsc.gscHolen(); } catch (e) { fehler = e; }
  ok("403 API aus → GoogleAntwortFehler mit zugang_fehlt, kein Absturz",
    fehler instanceof gsc.GoogleAntwortFehler && fehler.deutung.zustand === "zugang_fehlt" && fehler.deutung.code === "api_aus", String(fehler));
  gsc.gscTechnik.fetch = echt;
}

// ═══════════════════════════════════════════════════════════════════════════
async function teilB(url: string) {
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { ok("Teil B nur gegen eine LOKALE Datenbank", false, url.replace(/:[^@/]*@/, ":***@")); return; }
  const { sqlPool } = await import("../server/lib/db-pool");
  process.env.GOOGLE_SA_KEY = JSON.stringify(PRUEF_SA);
  gruppe("B1 Tabellen");
  await gsc.ensureGscTabellen();
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_gsc_tage') AS t, to_regclass('public.fiaon_gsc_adressen') AS a`) as any[];
  ok("fiaon_gsc_tage und fiaon_gsc_adressen stehen", !!t?.t && !!t?.a);
  // E-530 Korb B: die neuen Spalten — zweimal ohne Fehler (IF NOT EXISTS, DDL-Wache).
  gleich("Neue Spalten (E-530) da, auch beim zweiten Mal", [await gsc.gscSpalten(), await gsc.gscSpalten()], [true, true]);
  const sp = (await sqlPool`SELECT table_name || '.' || column_name AS s FROM information_schema.columns
     WHERE (table_name = 'fiaon_gsc_tage' AND column_name IN ('klickarten', 'index_stand')) OR (table_name = 'fiaon_gsc_adressen' AND column_name = 'sitemap_stand')
     ORDER BY 1`) as any[];
  gleich("klickarten, index_stand, sitemap_stand", sp.map((r) => r.s), ["fiaon_gsc_adressen.sitemap_stand", "fiaon_gsc_tage.index_stand", "fiaon_gsc_tage.klickarten"]);
  await sqlPool`DELETE FROM fiaon_gsc_tage`; await sqlPool`DELETE FROM fiaon_gsc_adressen`;

  gruppe("B1b Adressen aus derselben Quelle wie /sitemap.xml");
  const echteKand = await gsc.sitemapKandidaten();
  ok("Mindestens 200 Adressen aus der Sitemap", echteKand.length >= 200, echteKand.length);
  gleich("Startseite mit Priorität 1 vorn", [echteKand[0]?.adresse, echteKand[0]?.prio], ["https://fiaon.com/", 1]);
  ok("Stand (lastmod) als JJJJ-MM-TT bei den meisten Adressen", echteKand.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k.stand ?? ""))).length >= echteKand.length * 0.9);
  ok("Nur fiaon.com-Adressen", echteKand.every((k) => k.adresse.startsWith("https://fiaon.com/")));

  gruppe("B2 Zugang fehlt → Zustand, kein Absturz");
  const echt = gsc.gscTechnik.fetch;
  gsc.gscTechnik.fetch = falschesGoogle({ analyse: () => ({ status: 403, json: API_AUS }) }).f;
  // Die Startseite trägt einen Stand NACH dem letzten Google-Besuch (27.10.) → „alter Stand“ (B1).
  const kand = [{ adresse: "https://fiaon.com/", prio: 1, stand: "2026-10-28" }, { adresse: "https://fiaon.com/business", prio: 0.9 }, { adresse: "https://fiaon.com/ratgeber/x", prio: 0.7 }];
  const e1 = await gsc.gscAbruf({ jetzt: new Date(), kandidaten: kand });
  gleich("Ergebnis zugang_fehlt/api_aus", [e1.zustand, e1.code], ["zugang_fehlt", "api_aus"]);
  const s1: any = await gsc.gscStand();
  gleich("Stand: zugang_fehlt, keine Summen", [s1.zustand, s1.summen, s1.stand], ["zugang_fehlt", null, null]);

  gruppe("B3 Abruf mit Daten");
  let runde = 1;
  const pruefung = (b: any) => {
    const u = String(b.inspectionUrl);
    if (u.endsWith("/business")) return { json: pruefAntwort(runde === 1 ? "NEUTRAL" : "PASS", runde === 1 ? "Gefunden – zurzeit nicht indexiert" : "Gesendet und indexiert") };
    if (u.endsWith("/ratgeber/x")) return { status: 500, json: { error: { code: 500, message: "intern" } } };
    return { json: pruefAntwort("PASS", "Gesendet und indexiert") };
  };
  const gDaten = () => falschesGoogle({
    analyse: (b) => ({ json: { rows: ["date", "query", "query,page", "page"].includes(b.dimensions.join(",")) ? zeilenFuer(b) : [] } }),
    sitemaps: () => ({ json: SITEMAPS }), pruefen: pruefung,
  });
  gsc.gscTechnik.fetch = gDaten().f;
  const e2 = await gsc.gscAbruf({ kandidaten: kand });
  gleich("Ergebnis ok, 2 geprüft, 1 Fehler", [e2.zustand, e2.pruefung?.geprueft, e2.pruefung?.fehler], ["ok", 2, 1]);
  const [typ] = (await sqlPool`SELECT jsonb_typeof(summen) s, jsonb_typeof(anfragen) a, jsonb_typeof(verlauf) v, jsonb_typeof(pruefung) p, zustand FROM fiaon_gsc_tage ORDER BY tag DESC LIMIT 1`) as any[];
  gleich("jsonb echt (Objekt/Liste, kein Text)", [typ?.s, typ?.a, typ?.v, typ?.p, typ?.zustand], ["object", "array", "array", "object", "ok"]);
  const s2: any = await gsc.gscStand();
  gleich("Stand: Kacheln und Fast auf Seite 1", [s2.zustand, s2.summen?.jetzt?.klicks, s2.fastSeiteEins?.length], ["ok", 216, 3]);
  gleich("Adressen: 1 bei Google, 1 noch nicht, 1 mit Fehler ungeprüft", [s2.adressen.beiGoogle, s2.adressen.nicht, s2.adressen.ungeprueft, s2.adressen.heute], [1, 1, 1, 3]);
  gleich("Startseite beim ersten Blick schon drin → NICHT „neu“", s2.adressen.neu.length, 0);
  gleich("„Noch nicht bei Google“ mit Googles Grund", s2.adressen.fehlt.map((x: any) => [x.adresse, x.abdeckung]), [["https://fiaon.com/business", "Gefunden – zurzeit nicht indexiert"]]);
  // E-530 Korb B: klickarten und index_stand wirklich als jsonb-Objekt, sitemap_stand gespiegelt.
  const [neu] = (await sqlPool`SELECT jsonb_typeof(klickarten) k, jsonb_typeof(index_stand) i, jsonb_typeof(klickarten->'global') g FROM fiaon_gsc_tage ORDER BY tag DESC LIMIT 1`) as any[];
  gleich("klickarten und index_stand sind Objekte (kein Text), Global gesetzt", [neu?.k, neu?.i, neu?.g], ["object", "object", "object"]);
  gleich("Stand: Global ohne Marke 1, Marke 88", [s2.klickArten?.global?.ohneMarke, s2.klickArten?.marke], [1, 88]);
  gleich("Stand: Index-Zahl des Tages (1 bei Google, 1 nicht, 1 ungeprüft), noch keine Veränderung",
    [s2.index?.indexiert, s2.index?.nichtIndexiert, s2.index?.ungeprueft, s2.index?.veraenderung], [1, 1, 1, null]);
  gleich("Alter Stand: Startseite zuletzt 27.10. besucht, Sitemap-Stand 28.10.", s2.index?.alterStand, 1);
  const [st] = (await sqlPool`SELECT to_char(sitemap_stand, 'YYYY-MM-DD') s FROM fiaon_gsc_adressen WHERE adresse = 'https://fiaon.com/'`) as any[];
  gleich("sitemap_stand der Startseite gespiegelt", st?.s, "2026-10-28");
  // Ein Tag eine Woche davor mit 0 bei Google → Veränderung +1 seit diesem Tag.
  const tagHeute = String(s2.index?.tag ?? "");
  const wocheVorher = gsc.tagPlus(tagHeute, -7);
  await sqlPool`INSERT INTO fiaon_gsc_tage (tag, geholt_am, zustand, eigenschaft, index_stand)
    VALUES (${wocheVorher}, NOW(), 'ok', ${gsc.GSC_EIGENSCHAFT}, ${JSON.stringify({ gesamt: 3, indexiert: 0, nichtIndexiert: 1, ungeprueft: 2, ueberfaellig: 0, alterStand: 0, gruende: [] })}::text::jsonb)
    ON CONFLICT (tag) DO UPDATE SET index_stand = EXCLUDED.index_stand`;
  const s2b: any = await gsc.gscStand();
  gleich("Veränderung gegen den Tag eine Woche davor", s2b.index?.veraenderung, { delta: 1, seit: wocheVorher });
  await sqlPool`DELETE FROM fiaon_gsc_tage WHERE tag = ${wocheVorher}`;

  gruppe("B4 Fehlschlag überschreibt keinen guten Stand");
  gsc.gscTechnik.fetch = falschesGoogle({ analyse: () => ({ status: 403, json: KEINE_FREIGABE }) }).f;
  const e3 = await gsc.gscAbruf({ kandidaten: kand, vonHand: true });
  gleich("Ergebnis zugang_fehlt/keine_freigabe", [e3.zustand, e3.code], ["zugang_fehlt", "keine_freigabe"]);
  const [nach] = (await sqlPool`SELECT zustand, jsonb_typeof(summen) s FROM fiaon_gsc_tage ORDER BY tag DESC LIMIT 1`) as any[];
  gleich("Tageszeile bleibt ok mit Daten", [nach?.zustand, nach?.s], ["ok", "object"]);

  gruppe("B5 Übergang „noch nicht“ → „bei Google“ = Neu bei Google");
  runde = 2;
  // Die Prüfung von gestern liegt 25 h zurück — dann ist die Kernseite wieder dran.
  await sqlPool`UPDATE fiaon_gsc_adressen SET zuletzt_geprueft = NOW() - INTERVAL '25 hours'`;
  gsc.gscTechnik.fetch = gDaten().f;
  const e4 = await gsc.gscAbruf({ kandidaten: kand });
  ok("Zweiter Abruf ok", e4.zustand === "ok", e4);
  const s4: any = await gsc.gscStand();
  gleich("/business jetzt „Neu bei Google“", s4.adressen.neu.map((x: any) => x.adresse), ["https://fiaon.com/business"]);
  gleich("Nichts mehr „noch nicht“", s4.adressen.fehlt.length, 0);
  const [adr] = (await sqlPool`SELECT indexiert, neu_beobachtet, indexiert_seit IS NOT NULL AS seit FROM fiaon_gsc_adressen WHERE adresse = 'https://fiaon.com/'`) as any[];
  gleich("Startseite: drin, nicht neu, mit Datum", [adr?.indexiert, adr?.neu_beobachtet, adr?.seit], [true, false, true]);

  gruppe("B6 Tageslauf");
  gleich("Vor 05:00 Berlin: nichts", await gsc.gscTageslauf(new Date("2026-10-28T03:30:00Z")), undefined);
  gleich("Heute schon ok: nichts", await gsc.gscTageslauf(new Date()), undefined);
  await sqlPool`DELETE FROM fiaon_gsc_tage`;
  gsc.gscTechnik.fetch = falschesGoogle({ analyse: () => ({ status: 403, json: API_AUS }) }).f;
  if (gsc.berlinStunde(new Date()) < 5) {
    console.log("  (Zwischen 0 und 5 Uhr Berlin ruht der Lauf — Wurf und Pause hier nicht prüfbar.)");
  } else {
    let wurf: string | null = null;
    try { await gsc.gscTageslauf(new Date()); } catch (e) { wurf = String((e as Error).message); }
    ok("Ohne Zugang wirft der Lauf (kein Erfolg in der Ampel)", !!wurf && wurf.includes("ausgeschaltet"), wurf ?? "kein Wurf");
    gleich("Gleich danach: kein neuer Versuch (3 h Pause)", await gsc.gscTageslauf(new Date()), undefined);
  }

  gsc.gscTechnik.fetch = echt;
  await (sqlPool as any).end?.({ timeout: 2 }).catch?.(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
async function teilC() {
  gruppe("C Live gegen Google (Schlüssel nie ausgeben)");
  const { parse } = await import("dotenv");
  const env = parse(readFileSync(`${homedir()}/Developer/fiaon-plattform/.env`, "utf8"));
  if (!env.GOOGLE_SA_KEY) { ok("GOOGLE_SA_KEY in der .env", false); return; }
  process.env.GOOGLE_SA_KEY = env.GOOGLE_SA_KEY;
  try {
    const tok = await gsc.gscToken();
    ok("Token geholt (Länge > 20, Inhalt nicht gezeigt)", tok.length > 20);
  } catch (e) {
    const d = e instanceof gsc.GoogleAntwortFehler ? e.deutung : null;
    ok("Token geholt", false, d ? `${d.code}: ${d.grund}` : String((e as Error).message).slice(0, 120));
    return;
  }
  try {
    const h = await gsc.gscHolen();
    console.log(`  → Zugang da: ${h.summen.jetzt.klicks} Klicks, ${h.summen.jetzt.impressionen} Impressionen (${h.zeitraum.von} – ${h.zeitraum.bis})`);
    ok("Search Console antwortet", true);
  } catch (e) {
    const d = e instanceof gsc.GoogleAntwortFehler ? e : null;
    console.log(`  → Google: HTTP ${d?.status ?? "?"} · ${d?.deutung.code ?? "?"} · ${d?.deutung.grund ?? String((e as Error).message).slice(0, 120)}`);
    ok("Antwort wird als Zustand gedeutet (kein Absturz)", !!d && ["zugang_fehlt", "fehler", "kontingent"].includes(d.deutung.zustand));
  }
}

await teilA();
if (DB) await teilB(DB); else console.log("\n(Teil B übersprungen — ohne --db läuft nur der reine Teil.)");
if (LIVE) await teilC();
console.log(`\n══ ${gut} Prüfungen bestanden, ${schlecht} rot ══`);
process.exit(schlecht ? 1 : 0);
