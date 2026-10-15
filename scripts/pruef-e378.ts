// Prüfstand E-378 (15.10.2026): Eigene Besuchermessung ohne Cookies + Cockpit Chefbüro › Besucher.
// Teil 1 offline (reine Regeln: Pfad, Roboter, Herkunft/Kanal, Nutzlast, Hash, Zeitraum, kein Speicher im
// Browser, Clarity-Sekunden). Teil 2 gegen eine LOKALE Test-DB (eigene, frisch aus der Vorlage, danach
// gelöscht): Aufnehmen, Sitzung, Ende, keine IP in der Tabelle, Antrags-Brücke, Trichter bis bezahlt,
// Filter, Verlauf, Live, Löschfrist. Aufruf:
//   createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e372_vorlage fiaon_e378
//   env -i HOME=$HOME PATH="$PATH" DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_e378 node_modules/.bin/tsx scripts/pruef-e378.ts
//   dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_e378
// Offline allein: DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, detail?: unknown) {
  if (b) { gut++; console.log(`  ✓ ${was}`); }
  else { schlecht++; console.log(`  ✗ ${was}${detail !== undefined ? `  → ${JSON.stringify(detail)}` : ""}`); }
}
const lies = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
/** Kommentare raus — wer die Abwesenheit von Code prüft, darf die Begründung nicht treffen (AGENTS.md). */
const ohneKommentare = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const UA_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const UA_ANDROID_TAB = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

async function main() {
  const lokal = /127\.0\.0\.1:54329\/fiaon_e378\w*$/.test(String(process.env.DATABASE_URL));
  const B = await import("../shared/fiaon-besuch");

  console.log("── 1 · Der Pfad ist die Einheit (rein)");
  ok(B.besuchPfad("/antrag-neu?utm_source=fb&fbclid=XYZ#schritt2") === "/antrag-neu", "Abfrage und Anker weg");
  ok(B.besuchPfad("/Ratgeber/Schufa-Score-Verstehen/") === "/ratgeber/schufa-score-verstehen", "klein, ohne Schrägstrich am Ende");
  ok(B.besuchPfad("/") === "/" && B.besuchPfad("//start//") === "/start", "Wurzel bleibt, doppelte Schrägstriche fallen");
  ok(B.besuchPfad("/zahlung/FIAON-AB12-XY9/danke") === "/zahlung/…/danke" && B.besuchPfad("/zahlung/FIAON-AB12-XY9") === "/zahlung/…", "Zahlungslink: Referenz weg");
  ok(B.besuchPfad("/termin/eyJhbGciOiJIUzI1NiJ9.abc") === "/termin/…" && B.besuchPfad("/termin/justin") === "/termin/justin", "Terminlink: Token weg, Gründerseite bleibt");
  ok(B.besuchPfad("/termin/absagen/abc123") === "/termin/absagen/…", "Absage-Link: Token weg");
  ok(["/zustimmung/x1", "/unterlagen/abc", "/zugang/FIAON-1", "/abmelden/k3y", "/business/auftrag/FIAON-GL-1"].every((p) => (B.besuchPfad(p) ?? "").endsWith("/…")), "Zustimmung, Unterlagen, Zugang, Abmelden, Auftrag: Kennung weg");
  ok(B.besuchPfad("/ratgeber/kredit-ohne-schufa-2026") === "/ratgeber/kredit-ohne-schufa-2026", "Wort-Slug mit Jahreszahl bleibt");
  ok(B.besuchPfad("/irgendwo/a1b2c3d4e5f6g7h8i9") === "/irgendwo/…" && B.besuchPfad("/x/123456") === "/x/…", "unbekannte Kennungen (Token, lange Ziffern) werden zu …");
  ok(["/chef/besucher", "/admin", "/agent/kunden", "/akte/FIAON-1", "/Admindashboard", "/app/konto", "/dashboard", "/mein-bereich", "/als-kunde", "/business/angebot/t0k3n", "/zugang/uebergabe", "/auszahlung-ausfuehren/x", "/mitarbeiter/abschluss/x", "/banking"].every((p) => B.besuchPfad(p) === null),
    "intern, Kundenbereich und Seiten ohne Messung zählen nicht");
  ok(B.besuchPfad("relativ") === null && B.besuchPfad(null) === null && B.besuchPfad(42) === null, "Unsinn → null");
  ok(B.besuchPfad("/<script>alert(1)</script>") === "/scriptalert(1)/script", "spitze Klammern fallen weg", B.besuchPfad("/<script>alert(1)</script>"));
  ok((B.besuchPfad("/" + "a".repeat(400)) ?? "").length <= 160, "höchstens 160 Zeichen");

  // Dieselbe Grenze wie der Cookie-Hinweis (dort liest pruef-zugang-uebergabe den Text — eine Liste, zwei Orte).
  const ew = lies("client/src/components/site/EinwilligungsHinweis.tsx");
  const intern = new RegExp((ew.match(/const INTERN = \/(.*)\/;/)?.[1]) ?? "$^");
  const ohneMessung = new RegExp((ew.match(/const OHNE_MESSUNG = \/(.*)\/;/)?.[1]) ?? "$^");
  const proben = ["/agent", "/admin/x", "/chef", "/akte/1", "/Admindashboard", "/admindashboard", "/onboarding", "/inkasso", "/team-intern", "/buchhaltung", "/banking", "/business/angebot/x", "/zugang/uebergabe", "/auszahlung-ausfuehren/x", "/start", "/business", "/antrag"];
  ok(proben.every((p) => (intern.test(p) || ohneMessung.test(p)) === (B.BEREICH_INTERN.test(p) || B.BEREICH_OHNE_MESSUNG.test(p))),
    "Interne Bereiche = INTERN/OHNE_MESSUNG des Cookie-Hinweises", proben.filter((p) => (intern.test(p) || ohneMessung.test(p)) !== (B.BEREICH_INTERN.test(p) || B.BEREICH_OHNE_MESSUNG.test(p))));

  console.log("── 2 · Roboter, Gerät, Sprache (rein)");
  ok(B.istBesuchRoboter("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), "Googlebot");
  ok(B.istBesuchRoboter("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36"), "HeadlessChrome");
  ok(B.istBesuchRoboter("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)") && B.istBesuchRoboter("WhatsApp/2.23.20.0 A"), "Vorschau-Dienste (Facebook, WhatsApp)");
  ok(B.istBesuchRoboter("") && B.istBesuchRoboter("curl/8.4.0") && B.istBesuchRoboter("python-requests/2.31"), "leer, curl, python");
  ok(B.istBesuchRoboter("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)") && B.istBesuchRoboter("Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2)"), "bingbot, GPTBot");
  ok(!B.istBesuchRoboter(UA_IPHONE) && !B.istBesuchRoboter(UA_CHROME) && !B.istBesuchRoboter(UA_ANDROID_TAB), "iPhone, Chrome, Android-Tablet sind Menschen");
  ok(!B.istBesuchRoboter("Mozilla/5.0 (Linux; Android 12; Cubot X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"), "„Cubot X30“ ist ein Telefon, kein Roboter");
  ok(!B.istBesuchRoboter("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]"), "Facebook-In-App-Browser ist ein Mensch");
  ok(B.geraetAusKennung(UA_IPHONE) === "mobil" && B.geraetAusKennung(UA_CHROME) === "desktop" && B.geraetAusKennung(UA_ANDROID_TAB) === "tablet", "Gerät aus der Browserkennung");
  ok(B.spracheKurz("de-DE,de;q=0.9,en;q=0.8") === "de" && B.spracheKurz("en") === "en" && B.spracheKurz("*") === null && B.spracheKurz("") === null, "Sprache aus Accept-Language");

  console.log("── 3 · Herkunft und Kanal (rein)");
  ok(B.herkunftHost("www.google.com") === "google.com" && B.herkunftHost("l.instagram.com") === "instagram.com" && B.herkunftHost("lm.facebook.com") === "facebook.com", "Host gesäubert");
  ok(B.herkunftHost("fiaon.com") === null && B.herkunftHost("www.fiaon.com") === null && B.herkunftHost("fiaon-plattform.onrender.com") === null, "eigene Wirte sind keine Herkunft");
  ok(B.herkunftHost("evil<script>.com") === null && B.herkunftHost("https://google.com/suche?q=x") === null, "nur ein Host, nie eine Adresse");
  const K = (k: Partial<{ source: string; medium: string; campaign: string }>, extra: Partial<{ herkunft: string | null; fbclid: boolean; gclid: boolean }> = {}) =>
    B.besuchKanal({ herkunft: extra.herkunft ?? null, kampagne: { ...B.KAMPAGNE_LEER, ...k }, fbclid: !!extra.fbclid, gclid: !!extra.gclid });
  ok(K({ source: "facebook", medium: "paid", campaign: "Herbst" }) === "Meta-Anzeige" && K({ source: "ig", medium: "cpc" }) === "Meta-Anzeige", "utm bezahlt + Meta → Meta-Anzeige");
  ok(K({}, { fbclid: true }) === "Facebook/Instagram", "nur fbclid → Facebook/Instagram (Anzeige ODER Beitrag — ehrlich)");
  ok(K({}, { gclid: true }) === "Google-Anzeige" && K({}, { herkunft: "google.com" }) === "Suche", "gclid → Google-Anzeige, google.com → Suche");
  ok(K({}, { herkunft: "chatgpt.com" }) === "KI-Assistent" && K({}, { herkunft: "wl.co" }) === "WhatsApp" && K({}, { herkunft: "email.t-online.de" }) === "E-Mail", "KI, WhatsApp, Mail");
  ok(K({}) === "Direkt" && K({ source: "radar" }) === "Kampagne" && K({ source: "newsletter" }) === "E-Mail", "Direkt, sonstige Kampagne, Newsletter");
  ok(B.KANAELE.includes(K({}, { herkunft: "example.org" })), "jeder Kanal steht in der Liste", K({}, { herkunft: "example.org" }));

  console.log("── 4 · Was der Browser schicken darf (rein)");
  const n = B.besuchNutzlast({
    art: "ansicht", pfad: "/start", herkunft: "www.Google.com", fbclid: "IwAR-geheim", gclid: true, ip: "203.0.113.7", besucher: "x",
    kampagne: { source: "facebook", medium: "paid", campaign: "Herbst 2026", content: "max@example.com", term: "A\u0000B" },
  });
  ok(n?.art === "ansicht" && n.pfad === "/start" && n.herkunft === "google.com", "Grundform");
  ok(n?.fbclid === false && n?.gclid === true && !JSON.stringify(n).includes("IwAR"), "Klick-Kennung: nur „da/nicht da“, nie der Wert (und nur echtes true zählt)");
  ok(n?.kampagne.content === null && n?.kampagne.term === "AB" && n?.kampagne.campaign === "Herbst 2026", "E-Mail-Adresse in utm fällt weg, Steuerzeichen auch");
  ok(!("ip" in (n as object)) && !("besucher" in (n as object)) && !JSON.stringify(n).includes("203.0.113"), "fremde Felder (ip, besucher) fallen weg");
  ok(B.besuchNutzlast({ art: "ende", pfad: "/start", ms: -5 }) === null && B.besuchNutzlast({ art: "ende", pfad: "/start", ms: 9e9 })?.ms === B.BESUCH_ENDE_HOECHSTENS_MS, "Ende: negative Zeit abgelehnt, riesige gekappt");
  ok(B.besuchNutzlast(null) === null && B.besuchNutzlast([]) === null && B.besuchNutzlast({ art: "x", pfad: "/" }) === null && B.besuchNutzlast({ art: "ansicht", pfad: "start" }) === null, "Unsinn → null");
  ok(JSON.stringify(B.besuchFilterAus({ kanal: "Direkt", boese: "x", kampagne: "  ", land: "DE" })) === JSON.stringify({ kanal: "Direkt", land: "DE" }), "Filter: nur bekannte Schlüssel");

  console.log("── 5 · Kein Speicher im Browser, keine Fensterbreite (Quelltext ohne Kommentare)");
  const browser = ohneKommentare(lies("client/src/lib/besuch.ts"));
  ok(!/localStorage|sessionStorage|document\.cookie|indexedDB/.test(browser), "lib/besuch.ts: kein localStorage, sessionStorage, Cookie, IndexedDB");
  ok(!/innerWidth|screen\.|navigator\.language|matchMedia|userAgent/.test(browser), "lib/besuch.ts: liest weder Fensterbreite noch Sprache noch Browserkennung");
  ok(/sendBeacon/.test(browser) && /keepalive: true/.test(browser), "sendBeacon, sonst fetch keepalive");
  ok(/<BesuchMesser \/>/.test(lies("client/src/App.tsx")), "App-Rahmen meldet jeden Seitenwechsel (BesuchMesser)");
  ok(/antragBesuchVerknuepfen\(req, sitzung\)/.test(lies("server/routes/fiaon-antrag-neu.ts")), "Antragsmessung hängt sich an die Besuchs-Sitzung");
  const routen = lies("server/routes/fiaon-besuch.ts");
  ok(/router\.get\("\/chef\/besucher", requireChef\("leitung"\)/.test(routen) && /router\.get\("\/chef\/besucher\/live", requireChef\("leitung"\)/.test(routen), "Auswertung nur mit Chefbüro-Anmeldung (requireChef leitung)");
  ok(/res\.status\(204\)\.end\(\);\s*try/.test(routen), "Messung antwortet sofort (204), bevor sie arbeitet");
  ok(/id="reichweite"/.test(lies("client/src/pages/privacy.tsx")) && /III a\. Reichweitenmessung ohne Cookies/.test(lies("client/src/pages/privacy.tsx")), "Datenschutzerklärung III a steht");

  console.log("── 6 · Hash, Zeitraum, Clarity-Sekunden (rein)");
  const L = await import("../server/lib/fiaon-besuch");
  const h1 = L.besucherHash("salz-a", "203.0.113.7", UA_IPHONE, "fiaon.com");
  ok(h1 === L.besucherHash("salz-a", "203.0.113.7", UA_IPHONE, "FIAON.com") && /^[0-9a-f]{16}$/.test(h1), "gleicher Tag, gleicher Mensch → gleicher Hash (16 Zeichen)");
  ok(h1 !== L.besucherHash("salz-b", "203.0.113.7", UA_IPHONE, "fiaon.com"), "neues Tages-Salz → neuer Hash (Rotation)");
  ok(h1 !== L.besucherHash("salz-a", "203.0.113.8", UA_IPHONE, "fiaon.com") && h1 !== L.besucherHash("salz-a", "203.0.113.7", UA_CHROME, "fiaon.com"), "andere IP oder Browser → anderer Hash");
  ok(!h1.includes("203") && !h1.includes("113"), "die IP steckt nicht lesbar im Hash");
  const req = (h: Record<string, string>) => ({ headers: h, socket: { remoteAddress: "127.0.0.1" } }) as any;
  ok(L.besuchZaehltNicht(req({ "user-agent": UA_CHROME, cookie: "x=1; fiaon_chef=abc" })) === "team" && L.besuchZaehltNicht(req({ "user-agent": UA_CHROME, cookie: "fiaon_agent_token=t" })) === "team", "Chefbüro-/Mitarbeiter-Cookie → Team, kein Besuch");
  ok(L.besuchZaehltNicht(req({ "user-agent": UA_CHROME, "sec-gpc": "1" })) === "widerspruch" && L.besuchZaehltNicht(req({ "user-agent": UA_CHROME, dnt: "1" })) === "widerspruch", "GPC / DNT → Widerspruch, nicht gemessen");
  ok(L.besuchZaehltNicht(req({ "user-agent": "Googlebot/2.1" })) === "roboter" && L.besuchZaehltNicht(req({ "user-agent": UA_CHROME })) === null, "Roboter raus, Mensch zählt");
  const heute = "2026-10-15";
  const b7 = L.besuchBereich("7", null, null, heute);
  ok(b7.von === "2026-10-09" && b7.bis === heute && b7.tage === 7 && !b7.stunden, "7 Tage = heute und sechs davor");
  const bh = L.besuchBereich("heute", null, null, heute);
  ok(bh.von === heute && bh.bis === heute && bh.stunden, "heute → stündlich");
  ok(L.besuchBereich("gestern", null, null, heute).von === "2026-10-14", "gestern");
  const be = L.besuchBereich("eigen", "2026-10-20", "2026-10-01", heute);
  ok(be.von === "2026-10-01" && be.bis === heute && be.tage === 15, "eigener Zeitraum: vertauscht → sortiert, Zukunft gekappt", be);
  ok(L.besuchBereich("90", null, null, "2026-03-30").von === "2025-12-31", "90 Tage über den Jahreswechsel");
  const bv = L.besuchVorher(b7);
  ok(bv.von === "2026-10-02" && bv.bis === "2026-10-08" && bv.tage === 7, "Vergleich: gleich lang, direkt davor");
  ok(L.besuchBereich("unsinn", null, null, heute).tage === 7, "unbekannter Zeitraum → 7 Tage");
  ok(L.verlaufFuellen(b7, []).length === 7 && L.verlaufFuellen(bh, []).length === 24, "Verlauf lückenlos (7 Tage / 24 Stunden)");

  const c = await import("../server/routes/fiaon-chef-clarity");
  const zeit = [{ metricName: "Traffic", information: [{ totalSessionCount: "100", distinctUserCount: "90" }] }, { metricName: "EngagementTime", information: [{ totalTime: 106, activeTime: 44 }] }];
  const seiten = [
    { metricName: "Traffic", information: [{ Url: "https://fiaon.com/start", totalSessionCount: 30 }, { Url: "https://fiaon.com/start?utm_source=fb", totalSessionCount: 10 }] },
    { metricName: "EngagementTime", information: [{ Url: "https://fiaon.com/start", totalTime: 60, activeTime: 20 }, { Url: "https://fiaon.com/start?utm_source=fb", totalTime: 100, activeTime: 60 }] },
  ];
  const a = c.auswerten({ geholt_am: new Date(), tage: 3, gesamt: JSON.stringify(JSON.stringify(zeit)), seiten: JSON.stringify(seiten), aufschluessel: "[]" });
  ok(a.kopf.zeitGesamtMs === 106_000 && a.kopf.zeitAktivMs === 44_000, "Clarity-Zeiten sind Sekunden → 106 s / 44 s (nicht „0 s“)", a.kopf);
  const start = a.seiten.find((s: any) => s.pfad === "/start");
  ok(start?.zeit?.aktiv === 30_000 && start?.zeit?.gesamt === 70_000, "je Pfad mit Sitzungen gewichtet, nicht addiert (20 s×30 + 60 s×10 → 30 s)", start?.zeit);

  if (!lokal) {
    console.log("\n(Teil 2 übersprungen — nur gegen eine frische lokale Test-DB 127.0.0.1:54329/fiaon_e378…)");
  } else {
    console.log("── 7 · Aufnehmen, Sitzung, Ende, keine IP (lokale Test-DB)");
    const { sqlPool } = await import("../server/lib/db-pool");
    await L.ensureBesuchTabellen();
    await sqlPool`INSERT INTO fiaon_besuch_salz (tag, salz) VALUES ('2026-01-01', 'alt') ON CONFLICT DO NOTHING`;
    const s1 = await L.tagesSalz();
    const [salzZeilen] = await sqlPool`SELECT COUNT(*)::int AS n, MIN(tag)::text AS tag FROM fiaon_besuch_salz`;
    ok(salzZeilen.n === 1 && s1.salz.length === 64, "ein Salz für heute, das alte ist gelöscht", salzZeilen);

    const MENSCH = { "user-agent": UA_IPHONE, "cf-connecting-ip": "203.0.113.7", host: "fiaon.com", "cf-ipcountry": "AT", "accept-language": "de-AT,de;q=0.9" };
    const ANDERER = { "user-agent": UA_CHROME, "cf-connecting-ip": "198.51.100.23", host: "fiaon.com", "cf-ipcountry": "DE", "accept-language": "en-GB,en;q=0.8" };
    const nutz = (x: Record<string, unknown>) => B.besuchNutzlast({ art: "ansicht", ...x })!;
    const r1 = await L.besuchAufnehmen(req(MENSCH), nutz({ pfad: "/start?utm_source=facebook", herkunft: "l.instagram.com", fbclid: true, kampagne: { source: "facebook", medium: "paid", campaign: "Herbst", content: "Video A" } }));
    const r2 = await L.besuchAufnehmen(req(MENSCH), nutz({ pfad: "/antrag-neu" }));
    const r3 = await L.besuchAufnehmen(req(ANDERER), nutz({ pfad: "/ratgeber/schufa-score", herkunft: "www.google.de" }));
    const rIntern = await L.besuchAufnehmen(req(MENSCH), nutz({ pfad: "/chef/besucher" }));
    ok(r1?.neu === true && r2?.neu === false && r2?.sitzung === r1?.sitzung, "zweiter Aufruf desselben Menschen → dieselbe Sitzung");
    ok(r3?.neu === true && r3.sitzung !== r1?.sitzung, "anderer Mensch → eigene Sitzung");
    ok(rIntern === null, "interner Pfad wird nicht aufgenommen");
    const [s] = await sqlPool`SELECT * FROM fiaon_besuch_sitzungen WHERE sitzung = ${r1!.sitzung}`;
    ok(s.seiten === 2 && s.einstieg === "/start" && s.ausstieg === "/antrag-neu" && s.antrag === true, "Sitzung: 2 Seiten, Einstieg /start, Ausstieg /antrag-neu, Antrag gesehen", s);
    ok(s.kanal === "Meta-Anzeige" && s.utm_campaign === "Herbst" && s.utm_content === "Video A" && s.herkunft === "instagram.com" && s.fbclid === true, "Ursprung der Sitzung: Meta-Anzeige, Kampagne, Anzeige, Herkunft");
    ok(s.geraet === "mobil" && s.sprache === "de" && s.land === "AT", "Gerät, Sprache, Land aus den Kopfzeilen");
    const [s3] = await sqlPool`SELECT kanal, geraet, sprache, land FROM fiaon_besuch_sitzungen WHERE sitzung = ${r3!.sitzung}`;
    ok(s3.kanal === "Suche" && s3.geraet === "desktop" && s3.sprache === "en" && s3.land === "DE", "zweite Sitzung: Suche, Computer, en, DE", s3);

    ok(await L.besuchEnde(req(MENSCH), B.besuchNutzlast({ art: "ende", pfad: "/start", ms: 5000 })!), "Ende /start: 5 s");
    await L.besuchEnde(req(MENSCH), B.besuchNutzlast({ art: "ende", pfad: "/start", ms: 3000 })!);
    await L.besuchEnde(req(MENSCH), B.besuchNutzlast({ art: "ende", pfad: "/start", ms: 8000 })!);
    const [pv] = await sqlPool`SELECT dauer_ms FROM fiaon_besuche WHERE sitzung = ${r1!.sitzung} AND pfad = '/start'`;
    const [sd] = await sqlPool`SELECT dauer_ms::int AS d FROM fiaon_besuch_sitzungen WHERE sitzung = ${r1!.sitzung}`;
    ok(pv.dauer_ms === 8000 && sd.d === 8000, "Ende aufsummiert: verspätete kleinere Meldung zählt nicht, Sitzung bekommt nur den Zuwachs", { pv, sd });

    const [ipIrgendwo] = await sqlPool`
      SELECT (SELECT COUNT(*) FROM fiaon_besuch_sitzungen t WHERE row_to_json(t)::text ~ '203\\.0\\.113|198\\.51\\.100')::int
           + (SELECT COUNT(*) FROM fiaon_besuche t WHERE row_to_json(t)::text ~ '203\\.0\\.113|198\\.51\\.100')::int
           + (SELECT COUNT(*) FROM fiaon_besuch_salz t WHERE row_to_json(t)::text ~ '203\\.0\\.113|198\\.51\\.100')::int AS n`;
    ok(ipIrgendwo.n === 0, "keine IP in irgendeiner Zeile der Messung");
    const [spalten] = await sqlPool`
      SELECT COUNT(*)::int AS n FROM information_schema.columns
       WHERE table_name IN ('fiaon_besuch_sitzungen', 'fiaon_besuche', 'fiaon_besuch_antraege', 'fiaon_besuch_salz') AND column_name ~ '^(ip|ip_|user_agent|ua)'`;
    ok(spalten.n === 0, "keine Spalte für IP oder Browserkennung");

    console.log("── 8 · Antrags-Brücke und Trichter bis bezahlt (lokale Test-DB)");
    const SITZ_A = "pruefe378antrag01";
    await sqlPool`INSERT INTO fiaon_antrag_ereignisse (weg, sitzung, ereignis) VALUES ('neu', ${SITZ_A}, 'geoeffnet')`;
    const verkn = await L.antragBesuchVerknuepfen(req(MENSCH), SITZ_A);
    ok(verkn === r1!.sitzung, "Antrags-Sitzung hängt an der Besuchs-Sitzung desselben Menschen");
    ok(await L.antragBesuchVerknuepfen(req({ ...MENSCH, cookie: "fiaon_chef=x" }), "pruefe378team0001") === null, "Team-Anfrage wird nicht verknüpft");
    const REF = "FIAON-E378-PRF1";
    await sqlPool`INSERT INTO fiaon_antrag_ereignisse (weg, sitzung, ref, ereignis) VALUES ('neu', ${SITZ_A}, ${REF}, 'angelegt'), ('neu', ${SITZ_A}, ${REF}, 'angenommen')`;
    await sqlPool`INSERT INTO fiaon_applications (ref, type, status, current_step, payment_status, payment_reference, submitted_at, paid_at)
                  VALUES (${REF}, 'private', 'submitted', 8, 'paid', 'E378PRF1', NOW(), NOW())`;
    await sqlPool`INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am)
                  VALUES (${REF}, 1, 'E378PRF1-1', 9999, CURRENT_DATE, 'bezahlt', NOW()), (${REF}, 2, 'E378PRF1-2', 9999, CURRENT_DATE + 30, 'bezahlt', NOW())`;
    // Derselbe Antrag taucht später noch in einer zweiten Sitzung auf (zweiter Tab) — zählt trotzdem nur einmal.
    await sqlPool`INSERT INTO fiaon_besuch_antraege (sitzung, antrag_sitzung) VALUES (${r3!.sitzung}, ${SITZ_A}) ON CONFLICT DO NOTHING`;

    const heuteB = L.besuchBereich("heute");
    const r = await L.besuchRechnung(heuteB, {});
    ok(r.gesamt.sitzungen === 2 && r.gesamt.besucher === 2 && r.gesamt.seiten === 3, "Kopf: 2 Sitzungen, 2 Besucher, 3 Seiten", r.gesamt);
    ok(r.gesamt.geoeffnet === 2 && r.gesamt.angelegt === 1 && r.gesamt.abgeschickt === 1 && r.gesamt.bezahlt === 1, "Trichter: geöffnet 2 (beide verknüpft), 1 angelegt, 1 abgeschickt, 1 bezahlt — Antrag nur einmal", r.gesamt);
    ok(r.gesamt.umsatzCents === 19998, "Umsatz aus der einen Quelle: beide bezahlten Raten (2 × 99,99 €)", r.gesamt.umsatzCents);
    ok(r.gesamt.absprung === 50, "Absprungrate 50 % (eine Sitzung mit einer Seite)", r.gesamt.absprung);
    const meta = r.je.kanal.find((z) => z.name === "Meta-Anzeige");
    const suche = r.je.kanal.find((z) => z.name === "Suche");
    ok(meta?.bezahlt === 1 && suche?.bezahlt === 0, "Kauf zählt für den Erstkontakt (Meta-Anzeige), nicht für die spätere Sitzung (Suche)", { meta, suche });
    ok(r.je.kampagne.some((z) => z.name === "Herbst" && z.angelegt === 1) && r.je.kampagne.some((z) => z.name === B.OHNE), "Kampagnen-Zeile „Herbst“ mit Antrag, dazu „(ohne)“");
    ok(r.je.einstieg.some((z) => z.name === "/start") && r.je.ausstieg.some((z) => z.name === "/antrag-neu"), "Einstieg und Ausstieg");
    ok(r.je.land.length === 2 && r.je.geraet.some((z) => z.name === "mobil"), "Land und Gerät aufgeschlüsselt");
    ok(r.je.zeit.length >= 1 && r.je.heat.length >= 1, "Verlauf und Wochenkarte haben Zeilen");

    const rf = await L.besuchRechnung(heuteB, { kampagne: "Herbst" });
    ok(rf.gesamt.sitzungen === 1 && rf.gesamt.bezahlt === 1, "Filter Kampagne „Herbst“ → nur diese Sitzung, mit Kauf", rf.gesamt);
    const rd = await L.besuchRechnung(heuteB, { kanal: "Suche" });
    ok(rd.gesamt.sitzungen === 1 && rd.gesamt.bezahlt === 0, "Filter Kanal „Suche“ → eine Sitzung, kein Kauf", rd.gesamt);
    const ro = await L.besuchRechnung(heuteB, { kampagne: B.OHNE });
    ok(ro.gesamt.sitzungen === 1, "Filter „(ohne)“ → Sitzungen ohne Kampagne");
    const rs = await L.besuchRechnung(heuteB, { seite: "/antrag-neu" });
    ok(rs.gesamt.sitzungen === 1, "Filter Seite → Sitzungen, die diese Seite sahen");
    const rboese = await L.besuchRechnung(heuteB, { kanal: "x' OR 1=1 --" });
    ok(rboese.gesamt.sitzungen === 0, "Filterwert wird als Wert gebunden, nie als SQL");

    console.log("── 9 · Verlauf, Vergleich, Seiten, Live, Messbeginn (lokale Test-DB)");
    // Eine Sitzung vor drei Tagen, direkt geschrieben (Vergangenheit lässt sich nicht „aufnehmen").
    await sqlPool`INSERT INTO fiaon_besuch_sitzungen (sitzung, besucher, start, zuletzt, einstieg, ausstieg, seiten, kanal, geraet)
                  VALUES ('pruefe378alt0001', 'altbesucher00001', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days' + INTERVAL '2 minutes', '/kreditkarte', '/kreditkarte', 1, 'Direkt', 'desktop')`;
    await sqlPool`INSERT INTO fiaon_besuche (sitzung, am, pfad, erste) VALUES ('pruefe378alt0001', NOW() - INTERVAL '3 days', '/kreditkarte', TRUE)`;
    const aus = await L.besuchAuswertung("7", null, null, {}, true);
    ok(aus.verlauf.length === 7 && aus.verlaufVorher?.length === 7, "7-Tage-Verlauf und Vergleich je 7 Punkte");
    ok(aus.verlauf.reduce((s, z) => s + z.sitzungen, 0) === 3 && aus.kopf.sitzungen === 3, "Verlauf summiert sich zur Kopfzahl (3 Sitzungen)");
    ok(aus.vorher?.sitzungen === 0, "Vergleichszeitraum ohne Daten → 0, nichts erfunden");
    ok(aus.seiten[0]?.aufrufe >= 1 && aus.seiten.some((p) => p.pfad === "/start" && p.dauerMs === 8000), "Seiten mit Aufrufen und sichtbarer Zeit");
    ok(aus.live.jetzt === 2, "gerade da: 2 (die alte Sitzung zählt nicht)", aus.live);
    ok(typeof aus.messbeginn === "string" && aus.messbeginn! < L.besuchBereich("heute").von, "Messbeginn = Tag der ersten Sitzung", aus.messbeginn);
    ok(aus.heat.every((h) => h.wt >= 1 && h.wt <= 7 && h.std >= 0 && h.std <= 23), "Wochenkarte: Mo–So, 0–23 Uhr");

    console.log("── 10 · Löschfrist (lokale Test-DB)");
    await sqlPool`INSERT INTO fiaon_besuch_sitzungen (sitzung, besucher, start, zuletzt, einstieg, ausstieg, kanal)
                  VALUES ('pruefe378uralt01', 'uraltbesucher001', NOW() - INTERVAL '401 days', NOW() - INTERVAL '401 days', '/', '/', 'Direkt')`;
    await sqlPool`INSERT INTO fiaon_besuche (sitzung, am, pfad, erste) VALUES ('pruefe378uralt01', NOW() - INTERVAL '401 days', '/', TRUE)`;
    const weg = await L.besuchAufraeumen();
    const [rest] = await sqlPool`SELECT (SELECT COUNT(*) FROM fiaon_besuch_sitzungen WHERE sitzung = 'pruefe378uralt01')::int AS a,
                                        (SELECT COUNT(*) FROM fiaon_besuch_sitzungen)::int AS b`;
    ok(weg >= 2 && rest.a === 0 && rest.b === 3, "nach 400 Tagen gelöscht, alles Jüngere bleibt", { weg, rest });

    console.log("── 11 · Besucher je Tag statt Sitzungen (lokale Test-DB)");
    const vor = (await L.besuchRechnung(L.besuchBereich("heute"), {})).gesamt;
    // Derselbe Mensch kommt nach einer langen Pause wieder: neue Sitzung, derselbe Besucher.
    const [b1] = await sqlPool`SELECT besucher FROM fiaon_besuch_sitzungen WHERE sitzung = ${r1!.sitzung}`;
    await sqlPool`INSERT INTO fiaon_besuch_sitzungen (sitzung, besucher, start, zuletzt, einstieg, ausstieg, kanal)
                  VALUES ('pruefe378wieder1', ${b1.besucher}, NOW(), NOW(), '/preise', '/preise', 'Direkt')`;
    const nach = (await L.besuchRechnung(L.besuchBereich("heute"), {})).gesamt;
    ok(nach.sitzungen === vor.sitzungen + 1 && nach.besucher === vor.besucher, "zweite Sitzung desselben Besuchers: +1 Sitzung, Besucher bleibt", { vor, nach });
    await sqlPool.end();
  }

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden${lokal ? "" : " (offline)"}`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
