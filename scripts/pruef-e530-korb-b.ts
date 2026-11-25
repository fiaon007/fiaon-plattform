// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-530 KORB B (25.11.2026) — Search Console und IndexNow
//
//   B1  Auswahl der URL-Prüfung: älteste Prüfung zuerst, nie geprüft ganz vorn,
//       Priorität nur bei Gleichstand (derselbe Berliner Tag), jede Adresse
//       spätestens nach sieben Tagen — auch wenn der Tageslauf sich verschiebt;
//       Tagesbudget 400; die Index-Zahl des Tages (Zählen, Gründe, überfällig,
//       alter Stand, Veränderung).
//   B2  Marken-Muster (Beispiele und Gegenbeispiele), Name, feste Suchwörter aus
//       der Umgebung (hier neutrale Platzhalter), anonym-Rechnung, Global gegen
//       Privat nach Seite mit eigenem Anteil anonym, Ampel.
//   B4  IndexNow: offen ist, was neuer ist als seine letzte ERFOLGREICHE Meldung;
//       Bündel zu höchstens 10.000; Pause nach Ablehnung; gemeldet wird nur im
//       Betrieb (nicht bei CRONS=aus); Melden gegen ein gefälschtes Netz mit
//       Protokoll-Attrappe.
//
// Ohne Netz, ohne Datenbank, ohne Läufe:
//   sh ~/Desktop/FIAON/10_Nacharbeit/werkzeuge/pruef-mit-sperre.sh <arbeitskopie> scripts/pruef-e530-korb-b.ts
// Dazu der Datenbank-Teil für das IndexNow-Protokoll (nur gegen eine LOKALE Datenbank):
//   … scripts/pruef-e530-korb-b.ts --db 'postgresql://fiaon@127.0.0.1:54329/<prüfdatenbank>?sslmode=require'
// ═══════════════════════════════════════════════════════════════════════════
const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i >= 0 ? String(process.argv[i + 1] ?? "") : null; };
const DB = arg("--db");
// db-pool verlangt beim Laden eine Adresse — ohne --db wird nie verbunden.
process.env.DATABASE_URL = DB || process.env.DATABASE_URL || "postgresql://pruef@127.0.0.1:9/keine";
delete process.env.NODE_ENV; // IndexNow meldet nur im Betrieb — hier nur dort, wo ein Fall es ausdrücklich einschaltet.
// Neutrale Platzhalter für die festen Suchwörter der Ampel (die echten stehen nur in der Server-Umgebung).
process.env.GSC_AMPEL_WOERTER = "alpha beta, gamma zeta ,delta";

const gsc = await import("../server/lib/fiaon-search-console");
const inow = await import("../server/lib/fiaon-indexnow");

let gut = 0, schlecht = 0;
const ok = (titel: string, bedingung: boolean, info?: unknown) => {
  if (bedingung) { gut++; console.log(`  ✓ ${titel}`); }
  else { schlecht++; console.log(`  ✗ ${titel}${info !== undefined ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : ""}`); }
};
const gleich = (titel: string, ist: unknown, soll: unknown) => ok(titel, JSON.stringify(ist) === JSON.stringify(soll), { ist, soll });
const gruppe = (t: string) => console.log(`\n── ${t}`);

// ═══════════════════════════════════════════════════════════════════════════
gruppe("B1 Auswahl der URL-Prüfung");
const jetzt = new Date("2026-11-26T04:10:00Z"); // 05:10 Berlin
const vor = (h: number) => new Date(jetzt.getTime() - h * 3_600_000);
type B = { zuletztGeprueft: Date | null; indexiert: boolean | null };

gleich("Tagesbudget 400 (vorher 150)", gsc.PRUEF_TAGESBUDGET, 400);
gleich("Höchster Abstand sieben Tage, Spielraum 26 h", [gsc.PRUEF_HOECHSTENS_STUNDEN, gsc.PRUEF_SPIELRAUM_STUNDEN], [168, 26]);
gleich("Abstände: Kern drin 70 h, Rand drin 142 h (vorher 166), Kern fehlt 20 h, Rand fehlt 44 h, ungeprüft 44 h",
  [gsc.pruefAbstandStunden(0.95, true), gsc.pruefAbstandStunden(0.5, true), gsc.pruefAbstandStunden(0.85, false), gsc.pruefAbstandStunden(0.5, false), gsc.pruefAbstandStunden(0.5, null)],
  [70, 142, 20, 44, 44]);
{
  let alleFaellig = true, verschoben = true;
  // Der Fall aus der Prüfung: zuletzt 18.11. 08:30 Berlin (Neuversuch), Tageslauf 25.11. 05:00 Berlin.
  const spaet = new Date("2026-11-18T07:30:00Z"), lauf = new Date("2026-11-25T04:00:00Z");
  for (const prio of [0, 0.1, 0.5, 0.8, 0.9, 1]) {
    for (const indexiert of [true, false, null]) {
      const kand = [{ adresse: "/x", prio }];
      if (gsc.pruefAuswahl(kand, new Map<string, B>([["/x", { zuletztGeprueft: vor(168), indexiert }]]), jetzt, 10).length !== 1) alleFaellig = false;
      if (gsc.pruefAuswahl(kand, new Map<string, B>([["/x", { zuletztGeprueft: spaet, indexiert }]]), lauf, 10).length !== 1) verschoben = false;
      if (gsc.pruefAbstandStunden(prio, indexiert) > 168 - 24) alleFaellig = false;
    }
  }
  ok("Jede Adresse ist nach sieben Tagen wieder dran (alle Prioritäten, drin/nicht drin/ungeprüft), kein Abstand über 144 h", alleFaellig);
  ok("Auch wenn der letzte Lauf später lief (18.11. 08:30 → 25.11. 05:00 fällig, vorher erst am 26.11.)", verschoben);
}
{
  const kand = [{ adresse: "/kern-alt", prio: 1 }, { adresse: "/rand-nie", prio: 0.3 }, { adresse: "/kern-nie", prio: 0.9 }];
  const bek = new Map<string, B>([["/kern-alt", { zuletztGeprueft: vor(100), indexiert: false }]]);
  gleich("Nie geprüft ganz vorn, untereinander nach Priorität", gsc.pruefAuswahl(kand, bek, jetzt, 10), ["/kern-nie", "/rand-nie", "/kern-alt"]);
}
{
  const kand = [{ adresse: "/kern", prio: 1 }, { adresse: "/rand", prio: 0.5 }];
  const bek = new Map<string, B>([
    ["/kern", { zuletztGeprueft: vor(30), indexiert: false }],
    ["/rand", { zuletztGeprueft: vor(120), indexiert: false }],
  ]);
  gleich("Ältere Prüfung (anderer Tag) schlägt höhere Priorität", gsc.pruefAuswahl(kand, bek, jetzt, 10), ["/rand", "/kern"]);
}
{
  // Ein Lauf von 05:58 bis 06:03 Berlin (über eine Stundengrenze) gilt als ein Tag → Priorität entscheidet.
  const kand = [{ adresse: "/rand-0558", prio: 0.3 }, { adresse: "/kern-0601", prio: 1 }];
  const bek = new Map<string, B>([
    ["/rand-0558", { zuletztGeprueft: new Date("2026-11-24T04:58:00Z"), indexiert: false }],
    ["/kern-0601", { zuletztGeprueft: new Date("2026-11-24T05:01:00Z"), indexiert: false }],
  ]);
  gleich("Derselbe Berliner Tag, über eine Stundengrenze → Priorität entscheidet", gsc.pruefAuswahl(kand, bek, jetzt, 1), ["/kern-0601"]);
  const bek2 = new Map<string, B>([
    ["/rand-0558", { zuletztGeprueft: new Date("2026-11-24T04:58:00Z"), indexiert: false }],
    ["/kern-0601", { zuletztGeprueft: new Date("2026-11-24T05:01:00Z"), indexiert: false }],
  ]);
  const gleichePrio = [{ adresse: "/a-spaeter", prio: 0.5 }, { adresse: "/b-frueher", prio: 0.5 }];
  bek2.set("/a-spaeter", { zuletztGeprueft: new Date("2026-11-24T06:00:00Z"), indexiert: false });
  bek2.set("/b-frueher", { zuletztGeprueft: new Date("2026-11-24T05:30:00Z"), indexiert: false });
  gleich("Derselbe Tag, gleiche Priorität → ältere Prüfung zuerst", gsc.pruefAuswahl(gleichePrio, bek2, jetzt, 10), ["/b-frueher", "/a-spaeter"]);
}
gleich("Berliner Tag über formatToParts (Winter 23:30 UTC = nächster Tag, Sommer 22:30 UTC = nächster Tag)",
  [gsc.berlinTag(new Date("2026-11-24T23:30:00Z")), gsc.berlinTag(new Date("2026-07-01T22:30:00Z")), gsc.berlinTag(new Date("2026-11-24T22:59:00Z"))],
  ["2026-11-25", "2026-07-02", "2026-11-24"]);
{
  const kand = [{ adresse: "/kern-drin", prio: 0.95 }, { adresse: "/rand-fehlt", prio: 0.5 }];
  const bek = new Map<string, B>([
    ["/kern-drin", { zuletztGeprueft: vor(48), indexiert: true }],
    ["/rand-fehlt", { zuletztGeprueft: vor(30), indexiert: false }],
  ]);
  gleich("Noch nicht fällig → nicht dabei", gsc.pruefAuswahl(kand, bek, jetzt, 10), []);
}
{
  const kand = [{ adresse: "/kaputt", prio: 0.5 }, { adresse: "/frisch", prio: 1 }];
  const bek = new Map<string, B>([["/kaputt", { zuletztGeprueft: new Date("kein Datum"), indexiert: false }], ["/frisch", { zuletztGeprueft: vor(25), indexiert: false }]]);
  gleich("Ungültiges Datum gilt als nie geprüft", gsc.pruefAuswahl(kand, bek, jetzt, 10), ["/kaputt", "/frisch"]);
}
{
  // Der Fall vom 25.11.: 113 Randseiten über sieben Tage alt, 275 Kernseiten täglich fällig, Budget wie bisher 150.
  const kand: { adresse: string; prio: number }[] = [];
  const bek = new Map<string, B>();
  for (let i = 0; i < 275; i++) { kand.push({ adresse: `/kern-${i}`, prio: 0.9 }); bek.set(`/kern-${i}`, { zuletztGeprueft: vor(21 + (i % 3)), indexiert: false }); }
  for (let i = 0; i < 113; i++) { kand.push({ adresse: `/rand-${i}`, prio: 0.5 }); bek.set(`/rand-${i}`, { zuletztGeprueft: vor(190 + i), indexiert: i % 2 === 0 }); }
  const a150 = gsc.pruefAuswahl(kand, bek, jetzt, 150);
  ok("Überfällige Randseiten kommen vor täglich fälligen Kernseiten (alle 113 im Budget 150)",
    a150.filter((x) => x.startsWith("/rand-")).length === 113 && a150.slice(0, 113).every((x) => x.startsWith("/rand-")), a150.slice(0, 3));
  gleich("Die älteste Prüfung steht ganz vorn", a150[0], "/rand-112");
  gleich("Budget 400 nimmt alle 388 fälligen", gsc.pruefAuswahl(kand, bek, jetzt, gsc.PRUEF_TAGESBUDGET).length, 388);
  gleich("Budget begrenzt genau", gsc.pruefAuswahl(kand, bek, jetzt, 7).length, 7);
}
gleich("Budget 0, negativ, NaN → nichts", [gsc.pruefAuswahl([{ adresse: "/x", prio: 1 }], new Map(), jetzt, 0), gsc.pruefAuswahl([{ adresse: "/x", prio: 1 }], new Map(), jetzt, -3), gsc.pruefAuswahl([{ adresse: "/x", prio: 1 }], new Map(), jetzt, Number.NaN)], [[], [], []]);
gleich("Sitemap: lastmod wird zum Stand (nur das Datum), ohne lastmod kein Stand",
  gsc.sitemapAdressen(`<urlset><url><loc>https://fiaon.com/a</loc><lastmod>2026-11-13</lastmod><priority>0.8</priority></url><url><loc>https://fiaon.com/b</loc><lastmod>2026-11-20T10:00:00+00:00</lastmod></url><url><loc>https://fiaon.com/c</loc></url></urlset>`),
  [{ adresse: "https://fiaon.com/a", prio: 0.8, stand: "2026-11-13" }, { adresse: "https://fiaon.com/b", prio: 0.5, stand: "2026-11-20" }, { adresse: "https://fiaon.com/c", prio: 0.5 }]);

gruppe("B1 Index-Zahl des Tages");
{
  const crawl = (iso: string) => new Date(iso);
  const zeilen = [
    { indexiert: true, abdeckung: "Gesendet und indexiert", zuletztGeprueft: vor(10), letzterCrawl: crawl("2026-09-23T10:00:00Z"), stand: "2026-11-13" }, // alter Stand
    { indexiert: true, abdeckung: null, zuletztGeprueft: vor(200), letzterCrawl: crawl("2026-11-14T10:00:00Z"), stand: "2026-11-13" },             // frisch genug
    { indexiert: false, abdeckung: "URL ist Google nicht bekannt", zuletztGeprueft: vor(5), letzterCrawl: null, stand: "2026-11-20" },
    { indexiert: false, abdeckung: "URL ist Google nicht bekannt", zuletztGeprueft: vor(30) },
    { indexiert: false, abdeckung: "Gefunden – zurzeit nicht indexiert", zuletztGeprueft: vor(30) },
    { indexiert: false, abdeckung: null, zuletztGeprueft: vor(1) },
    { indexiert: null, abdeckung: null, zuletztGeprueft: null },
  ];
  const s = gsc.indexStandZaehlen(zeilen, jetzt);
  gleich("Zählt gesamt, bei Google, nicht, ungeprüft", [s.gesamt, s.indexiert, s.nichtIndexiert, s.ungeprueft], [7, 2, 4, 1]);
  gleich("Gründe laut Google, häufigster zuerst, fehlender Grund = „ohne Angabe“", s.gruende,
    [{ grund: "URL ist Google nicht bekannt", anzahl: 2 }, { grund: "Gefunden – zurzeit nicht indexiert", anzahl: 1 }, { grund: "ohne Angabe", anzahl: 1 }]);
  gleich("Überfällig = älter als sieben Tage oder nie geprüft", s.ueberfaellig, 2);
  gleich("Alter Stand = bei Google, letzter Besuch vor lastmod (nur bei Google zählt)", s.alterStand, 1);
  gleich("Leere Tabelle → alles 0", gsc.indexStandZaehlen([], jetzt), { gesamt: 0, indexiert: 0, nichtIndexiert: 0, ungeprueft: 0, ueberfaellig: 0, alterStand: 0, gruende: [] });
}
{
  const verlauf = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]
    .map((tag, i) => ({ tag, indexiert: 50 + i }));
  gleich("Veränderung gegen den Tag sieben Tage davor", gsc.indexVeraenderung(verlauf), { delta: 7, seit: "2026-11-18" });
  gleich("Kurzer Verlauf → gegen den ältesten Tag", gsc.indexVeraenderung(verlauf.slice(-3)), { delta: 2, seit: "2026-11-23" });
  gleich("Ein Tag → keine Veränderung", gsc.indexVeraenderung(verlauf.slice(-1)), null);
}

// ═══════════════════════════════════════════════════════════════════════════
gruppe("B2 Marken-Muster");
const MARKE = ["fiaon", "FIAON", "fiaon ltd", "fiaon global", "fiaon kreditkarte", "fiaon seriös", "erfahrungen fiaon",
  "fion", "fianon", "fiaoon", "fiaonn", "fyaon", "faion", "fia on", "fia-on erfahrungen", "fiaonglobal", "fiaon.com", "www.fiaon.com login",
  "fiaonerfahrungen", "fiaonkredit", "fiaon24", "fionglobal"];
const KEINE = ["fiona", "fionas buch", "fionn", "fionn mac cool", "fiano", "finanzen", "infion", "fiat", "fon", "us llc gründen",
  "kreditkarte ohne schufa", "justin schwarzott", ""];
for (const q of MARKE) ok(`Marke: „${q}“`, gsc.istMarke(q));
for (const q of KEINE) ok(`keine Marke: „${q}“`, !gsc.istMarke(q));

gruppe("B2 Feste Suchwörter aus der Umgebung, Name, Art der Suche");
{
  const w = gsc.ampelWoerter();
  gleich("Drei Wörter aus GSC_AMPEL_WOERTER, neutrale Schlüssel", w.map((x) => x.schluessel), ["w1", "w2", "w3"]);
  const roh = process.env.GSC_AMPEL_WOERTER;
  delete process.env.GSC_AMPEL_WOERTER;
  const ohneUmgebung = gsc.ampelWoerter().length;
  process.env.GSC_AMPEL_WOERTER = roh;
  gleich("Ohne Angabe keine Wörter (Umgebung fehlt, leer, nur Kommas)", [ohneUmgebung, gsc.ampelWoerter("").length, gsc.ampelWoerter(" , ,").length], [0, 0, 0]);
  gleich("Höchstens fünf", gsc.ampelWoerter("a,b,c,d,e,f,g").length, 5);
  ok("Teile frei verbunden („alpha-beta“, „alphabeta“), nur ganze Wörter („alphabetisch“ nicht)",
    w[0].muster.test("alpha-beta") && w[0].muster.test("alphabeta") && w[0].muster.test("x alpha beta y") && !w[0].muster.test("alphabetisch"));
  ok("Sonderzeichen im Wort brechen das Muster nicht", gsc.ampelWoerter("a(b,[c]").length === 2 && gsc.ampelWoerter("a(b")[0].muster.test("a b"));
  const arten = ["fiaon", "justin schwarzott", "schwarzott", "fiaon justin schwarzott", "alpha beta partners", "alpha beta schwarzott", "us llc gründen", "delta erfahrungen", "adelta"]
    .map((q) => gsc.sucheArt(q, w));
  gleich("Art: Marke vor festen Wörtern vor Name, sonst ohne", arten, ["marke", "name", "name", "marke", "feste", "feste", "ohne", "feste", "ohne"]);
  gleich("Ohne feste Wörter fällt „alpha beta“ in „ohne Marke“", gsc.sucheArt("alpha beta", []), "ohne");
}

gruppe("B2 anonym und Summen");
gleich("anonym = Klicks laut Google minus sichtbare (91 − 62 = 29)", gsc.anonymKlicks(91, 62), 29);
gleich("anonym nie unter 0", gsc.anonymKlicks(10, 12), 0);
gleich("anonym mit kaputten Zahlen = 0", gsc.anonymKlicks(Number.NaN, 5), 0);
{
  // Der Stand vom 25.11. (28.10.–24.11.): 91 Klicks, sichtbar nur Markensuchen mit 62 Klicks.
  const anfragen = [
    { keys: ["fiaon"], clicks: 38, impressions: 60 }, { keys: ["fiaon ltd"], clicks: 16, impressions: 20 },
    { keys: ["fiaon global"], clicks: 4, impressions: 9 }, { keys: ["fiaon kreditkarte"], clicks: 3, impressions: 8 },
    { keys: ["fiaon seriös"], clicks: 1, impressions: 2 }, { keys: ["llc gründen"], clicks: 0, impressions: 20 },
  ];
  const k = gsc.klickArten({ gesamtKlicks: 91, anfragen, anfrageSeiten: [], seiten: [] });
  gleich("Stand 25.11.: Marke 62, ohne Marke 0, anonym 29", [k.gesamt, k.sichtbar, k.marke, k.ohneMarke, k.anonym], [91, 62, 62, 0, 29]);
  ok("Anteil anonym ≈ 32 %", k.anteilAnonym != null && Math.abs(k.anteilAnonym - 29 / 91) < 1e-9, k.anteilAnonym);
  gleich("Ohne Klicks kein Anteil", gsc.klickArten({ gesamtKlicks: 0, anfragen: [], anfrageSeiten: [], seiten: [] }).anteilAnonym, null);
}

gruppe("B2 Global gegen Privat");
const GLOBAL = ["https://fiaon.com/", "https://fiaon.com/?utm_source=x", "https://fiaon.com/en", "https://fiaon.com/en/", "/business", "/business/wissen/ein-beantragen",
  "https://fiaon.com/en/business/knowledge/applying-for-an-ein", "/business-antrag", "/justin-schwarzott", "/en/justin-schwarzott", "/justin-schwarzott/"];
const PRIVAT = ["/privatkunden", "https://fiaon.com/ratgeber/schufa", "/en/careers", "/karriere?x=1", "/english", "/justin", "/kreditkarte",
  "/businessplan-vorlage", "/justin-schwarzott-interview"];
for (const a of GLOBAL) gleich(`Global: ${a}`, gsc.seitenBereich(a), "global");
for (const a of PRIVAT) gleich(`Privat: ${a}`, gsc.seitenBereich(a), "privat");
gleich("Leere Adresse zählt nirgends", [gsc.seitenBereich(""), gsc.seitenBereich("   ")], [null, null]);
{
  const anfragen = [
    { keys: ["fiaon"], clicks: 30 }, { keys: ["fiaon ltd"], clicks: 10 }, { keys: ["fiaon kreditkarte"], clicks: 3 },
    { keys: ["us llc gründen"], clicks: 2 }, { keys: ["schufa auskunft"], clicks: 1 },
  ];
  const anfrageSeiten = [
    { keys: ["fiaon", "https://fiaon.com/"], clicks: 30 }, { keys: ["fiaon ltd", "https://fiaon.com/business/presse"], clicks: 10 },
    { keys: ["fiaon kreditkarte", "https://fiaon.com/kreditkarte"], clicks: 3 },
    { keys: ["us llc gründen", "https://fiaon.com/business/us-firmengruendung"], clicks: 2 },
    { keys: ["schufa auskunft", "https://fiaon.com/ratgeber/x"], clicks: 1 },
    { keys: ["kaputt", ""], clicks: 4 },
  ];
  const seiten = [
    { keys: ["https://fiaon.com/"], clicks: 40 }, { keys: ["https://fiaon.com/business/presse"], clicks: 12 }, { keys: ["https://fiaon.com/kreditkarte"], clicks: 5 },
    { keys: ["https://fiaon.com/business/us-firmengruendung"], clicks: 2 }, { keys: ["https://fiaon.com/ratgeber/x"], clicks: 1 },
  ];
  const k = gsc.klickArten({ gesamtKlicks: 60, anfragen, anfrageSeiten, seiten });
  gleich("Kennzahl: Klicks ohne Marke, Global (sichtbar) = 2", k.global?.ohneMarke, 2);
  gleich("Global: gesamt 54, Marke 40, ohne 2, anonym 12, Anteil 12/54", k.global, { gesamt: 54, marke: 40, name: 0, feste: 0, ohneMarke: 2, anonym: 12, anteilAnonym: 12 / 54 });
  gleich("Privat: gesamt 6, Marke 3, ohne 1, anonym 2, Anteil 2/6", k.privat, { gesamt: 6, marke: 3, name: 0, feste: 0, ohneMarke: 1, anonym: 2, anteilAnonym: 2 / 6 });
  gleich("Alle: sichtbar 46, Marke 43, ohne 3, anonym 14", [k.sichtbar, k.marke, k.ohneMarke, k.anonym], [46, 43, 3, 14]);
  gleich("Zeile ohne Seite zählt in keinem Bereich", (k.global?.ohneMarke ?? 0) + (k.privat?.ohneMarke ?? 0), 3);
}
{
  // Der Fall aus der Prüfung: Namenssuchen und feste Suchwörter blähten „ohne Marke, Global“ auf (8 statt 1).
  const anfragen = [{ keys: ["justin schwarzott"], clicks: 5, impressions: 9 }, { keys: ["alpha beta partners"], clicks: 2, impressions: 4 }, { keys: ["us llc gründen"], clicks: 1, impressions: 30 }];
  const anfrageSeiten = [
    { keys: ["justin schwarzott", "https://fiaon.com/justin-schwarzott"], clicks: 5, impressions: 9 },
    { keys: ["alpha beta partners", "https://fiaon.com/business/partner"], clicks: 2, impressions: 4 },
    { keys: ["us llc gründen", "https://fiaon.com/business/us-firmengruendung"], clicks: 1, impressions: 30 },
  ];
  const seiten = [{ keys: ["https://fiaon.com/justin-schwarzott"], clicks: 5 }, { keys: ["https://fiaon.com/business/partner"], clicks: 2 }, { keys: ["https://fiaon.com/business/us-firmengruendung"], clicks: 1 }];
  const k = gsc.klickArten({ gesamtKlicks: 8, anfragen, anfrageSeiten, seiten });
  gleich("Global ohne Marke = 1 (Name 5 und feste Wörter 2 getrennt)", [k.global?.ohneMarke, k.global?.name, k.global?.feste, k.global?.anonym], [1, 5, 2, 0]);
  gleich("Alle Seiten: Name 5, feste 2, ohne Marke 1, sichtbar 8", [k.name, k.feste, k.ohneMarke, k.sichtbar], [5, 2, 1, 8]);
  gleich("Namenssuchen: Klicks, Impressionen, Suchen", k.nameSuchen, { klicks: 5, impressionen: 9, suchen: 1 });
}
{
  // Global versteckt mehr: Privat 82 Klicks (80 sichtbar), Global 18 Klicks (1 sichtbar).
  const anfragen = [{ keys: ["fiaon"], clicks: 80 }, { keys: ["us llc gründen"], clicks: 1 }];
  const anfrageSeiten = [{ keys: ["fiaon", "https://fiaon.com/kreditkarte"], clicks: 80 }, { keys: ["us llc gründen", "https://fiaon.com/business/x"], clicks: 1 }];
  const seiten = [{ keys: ["https://fiaon.com/kreditkarte"], clicks: 82 }, { keys: ["https://fiaon.com/business/x"], clicks: 18 }];
  const k = gsc.klickArten({ gesamtKlicks: 100, anfragen, anfrageSeiten, seiten });
  ok("Anteil anonym Global 17/18 (≈ 94 %), alle Seiten 19 %", Math.abs((k.global?.anteilAnonym ?? 0) - 17 / 18) < 1e-9 && Math.abs((k.anteilAnonym ?? 0) - 0.19) < 1e-9, [k.global?.anteilAnonym, k.anteilAnonym]);
}
{
  const k = gsc.klickArten({ gesamtKlicks: 10, anfragen: [{ keys: ["fiaon"], clicks: 6 }], anfrageSeiten: null, seiten: [], hinweis: "Global gegen Privat fehlt heute: Kontingent" });
  gleich("Suche × Seite fehlt → Global/Privat null, Rest da, Hinweis steht", [k.global, k.privat, k.marke, k.anonym, k.hinweis], [null, null, 6, 4, "Global gegen Privat fehlt heute: Kontingent"]);
}

gruppe("B2 Ampel");
gleich("Grenzen: 0 grün, 1 gelb, 9 gelb, 10 rot, 25 rot", [0, 1, 9, 10, 25].map((n) => gsc.ampelStufe(n)), ["gruen", "gelb", "gelb", "rot", "rot"]);
gleich("Grenzen stehen auf gelb 1, rot 10", gsc.AMPEL_GRENZEN, { gelb: 1, rot: 10 });
{
  const a = gsc.bezugAmpel([
    { keys: ["alpha beta"], impressions: 3 }, { keys: ["gamma zeta erfahrungen"], impressions: 2 }, { keys: ["delta test"], impressions: 1 },
    { keys: ["gamma-zeta"], impressions: 1 }, { keys: ["adelta"], impressions: 50 }, { keys: ["deltas"], impressions: 9 }, { keys: ["fiaon"], impressions: 99 },
  ], gsc.ampelWoerter(), [
    { keys: ["alpha beta", "https://fiaon.com/business/partner"], impressions: 3 },
    { keys: ["gamma zeta erfahrungen", "https://fiaon.com/business/privatpersonen"], impressions: 2 },
    { keys: ["gamma-zeta", "https://fiaon.com/business/partner"], impressions: 1 },
    { keys: ["delta test", "https://fiaon.com/"], impressions: 1 },
    { keys: ["delta test", "https://andere.example/x"], impressions: 7 },
    { keys: ["fiaon", "https://fiaon.com/ratgeber/y"], impressions: 99 },
  ]);
  gleich("Nur ganze Wörter zählen (adelta, deltas nicht): 7 Impressionen aus 4 Suchen → gelb", [a?.impressionen, a?.suchen, a?.stufe], [7, 4, "gelb"]);
  gleich("Je Wort unter neutralem Schlüssel", a?.je, { w1: 3, w2: 3, w3: 1 });
  gleich("Seiten mit den meisten Impressionen, nur Pfade von fiaon.com, höchstens drei", a?.seiten,
    [{ pfad: "/business/partner", impressionen: 4 }, { pfad: "/business/privatpersonen", impressionen: 2 }, { pfad: "/", impressionen: 1 }]);
  ok("Die Ampel trägt keine Suchtexte und keine Wörter", !/erfahrungen|adelta|alpha|gamma|delta/.test(JSON.stringify(a)));
  gleich("Ab 10 rot", gsc.bezugAmpel([{ keys: ["DELTA"], impressions: 10 }])?.stufe, "rot");
  gleich("Nichts davon → grün mit 0", gsc.bezugAmpel([{ keys: ["fiaon"], impressions: 5 }]), { stufe: "gruen", impressionen: 0, suchen: 0, je: { w1: 0, w2: 0, w3: 0 }, seiten: [] });
  gleich("Ohne feste Wörter keine Ampel", [gsc.bezugAmpel([{ keys: ["alpha beta"], impressions: 5 }], []), gsc.klickArten({ gesamtKlicks: 1, anfragen: [], anfrageSeiten: [], seiten: [], woerter: [] }).ampel], [null, null]);
}

// ═══════════════════════════════════════════════════════════════════════════
gruppe("B4 IndexNow: was offen ist");
{
  const seiten = [
    { pfad: "/neu", stand: "2026-11-25" },        // nie gemeldet → offen
    { pfad: "/gleich", stand: "2026-11-13" },     // mit diesem Stand erfolgreich gemeldet → nicht offen
    { pfad: "/geaendert", stand: "2026-11-24" },  // zuletzt erfolgreich mit 13.11. → offen
    { pfad: "/gescheitert", stand: "2026-11-20" },// nur Fehlversuche → steht nicht in der Erfolgs-Liste → offen
    { pfad: "/alt", stand: "2026-09-01" },        // vor zwei Monaten erfolgreich → nicht offen (früher: nie gemeldet, weil > 3 Tage)
  ];
  const gemeldet = new Map([["/gleich", "2026-11-13"], ["/geaendert", "2026-11-13"], ["/alt", "2026-09-01"]]);
  const offen = inow.indexNowOffen(seiten, gemeldet);
  gleich("Offen: nie gemeldet, geändert, gescheitert — neuester Stand zuerst", offen.map((s) => s.pfad), ["/neu", "/geaendert", "/gescheitert"]);
  gleich("Ohne jede Meldung ist alles offen (auch alte Stände)", inow.indexNowOffen(seiten, new Map()).length, 5);
  gleich("Doppelter Pfad: einmal, höchster Stand", inow.indexNowOffen([{ pfad: "/a", stand: "2026-11-01" }, { pfad: "/a", stand: "2026-11-20" }], new Map([["/a", "2026-11-10"]])), [{ pfad: "/a", stand: "2026-11-20" }]);
  gleich("Ohne Stand: einmal melden, danach nicht wieder", [inow.indexNowOffen([{ pfad: "/x", stand: "" }], new Map()).length, inow.indexNowOffen([{ pfad: "/x", stand: "" }], new Map([["/x", ""]])).length], [1, 0]);
  gleich("Ein Stand älter als die Meldung ist nicht offen", inow.indexNowOffen([{ pfad: "/b", stand: "2026-11-01" }], new Map([["/b", "2026-11-05"]])).length, 0);
}
gleich("Erfolg = 2xx (200, 202 ja; 300, 400, 422, 429, keine Antwort nein)",
  [200, 202, 299, 300, 400, 422, 429, null].map((s) => inow.indexNowErfolg(s)), [true, true, true, false, false, false, false, false]);
gleich("Stand nur als Datum", [inow.standOderLeer("2026-11-25T10:00:00Z"), inow.standOderLeer("gestern"), inow.standOderLeer(null)], ["2026-11-25", "", ""]);
gleich("Startseite offen → /business und /en/business gehen mit", inow.indexNowMitUmzug([{ pfad: "/", stand: "2026-11-25" }]).map((s) => `${s.pfad}@${s.stand}`),
  ["/@2026-11-25", "/business@2026-11-25", "/en/business@2026-11-25"]);
gleich("Startseite nicht offen → kein Umzug", inow.indexNowMitUmzug([{ pfad: "/x", stand: "2026-11-25" }]).length, 1);
gleich("Adressen", [inow.indexNowAdresse("/business/presse"), inow.indexNowAdresse("https://fiaon.com/a")], ["https://fiaon.com/business/presse", "https://fiaon.com/a"]);

gruppe("B4 IndexNow: Bündel zu höchstens 10.000");
{
  const bei = [{ pfad: "/sitemap.xml", stand: "2026-11-25" }, { pfad: "/llms.txt", stand: "2026-11-25" }];
  gleich("Nichts offen → keine Meldung (auch kein Beifang)", inow.indexNowBuendel([], bei), []);
  const drei = inow.indexNowBuendel([{ pfad: "/a", stand: "" }, { pfad: "/b", stand: "" }, { pfad: "/c", stand: "" }], bei);
  gleich("Drei offen → eine Meldung mit Sitemap und llms.txt", drei.map((b) => b.map((s) => s.pfad)), [["/a", "/b", "/c", "/sitemap.xml", "/llms.txt"]]);
  const viele = Array.from({ length: 10_005 }, (_, i) => ({ pfad: `/s${i}`, stand: "2026-11-25" }));
  const b = inow.indexNowBuendel(viele, bei);
  gleich("10.005 offen → zwei Meldungen (10.000 + 7)", b.map((x) => x.length), [10_000, 7]);
  ok("Keine Meldung über 10.000, keine Seite verloren", b.every((x) => x.length <= inow.INDEXNOW_HOECHSTENS) && new Set(b.flat().map((s) => s.pfad)).size === 10_007);
  gleich("Grenze steht auf 10.000", inow.INDEXNOW_HOECHSTENS, 10_000);
}

gruppe("B4 IndexNow: Pause nach abgelehnter Meldung");
{
  const t = new Date("2026-11-25T12:00:00Z");
  const h = (n: number) => new Date(t.getTime() - n * 3_600_000).toISOString();
  gleich("Keine Meldung bisher → keine Pause", inow.indexNowPause(null, t), null);
  gleich("Letzte angenommen (200/202) → keine Pause", [inow.indexNowPause({ am: h(1), status: 200 }, t), inow.indexNowPause({ am: h(0.1), status: 202 }, t)], [null, null]);
  gleich("422 vor 2 h → Pause bis 6 h nach der Meldung", inow.indexNowPause({ am: h(2), status: 422 }, t)?.toISOString(), new Date(t.getTime() + 4 * 3_600_000).toISOString());
  gleich("Keine Antwort vor 5 h → noch Pause; vor 7 h → keine", [!!inow.indexNowPause({ am: h(5), status: null }, t), inow.indexNowPause({ am: h(7), status: null }, t)], [true, null]);
  gleich("429 vor 20 h → noch Pause (24 h); vor 25 h → keine", [!!inow.indexNowPause({ am: h(20), status: 429 }, t), inow.indexNowPause({ am: h(25), status: 429 }, t)], [true, null]);
  gleich("Kaputtes Datum → keine Pause", inow.indexNowPause({ am: "kein Datum", status: 500 }, t), null);
}

gruppe("B4 IndexNow: gemeldet wird nur im Betrieb");
{
  const env = (werte: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(werte)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    return inow.indexNowAus();
  };
  const alt = { NODE_ENV: process.env.NODE_ENV, CRONS: process.env.CRONS, INDEXNOW_AUS: process.env.INDEXNOW_AUS };
  gleich("Ohne NODE_ENV=production → „nur im Betrieb“", env({ NODE_ENV: undefined, CRONS: undefined, INDEXNOW_AUS: undefined }), "nur im Betrieb");
  gleich("NODE_ENV=production + CRONS=aus (z. B. Server auf Datenkopie) → „ausgeschaltet“", env({ NODE_ENV: "production", CRONS: "aus", INDEXNOW_AUS: undefined }), "ausgeschaltet");
  gleich("NODE_ENV=production + CRONS=AUS (groß) → „ausgeschaltet“", env({ NODE_ENV: "production", CRONS: "AUS" }), "ausgeschaltet");
  gleich("NODE_ENV=production + INDEXNOW_AUS=1 → „ausgeschaltet“", env({ NODE_ENV: "production", CRONS: undefined, INDEXNOW_AUS: "1" }), "ausgeschaltet");
  gleich("CRONS=an ohne production → „nur im Betrieb“ (lokal nie an Bing)", env({ NODE_ENV: undefined, CRONS: "an", INDEXNOW_AUS: undefined }), "nur im Betrieb");
  gleich("NODE_ENV=production ohne Schalter → meldet", [env({ NODE_ENV: "production", CRONS: undefined, INDEXNOW_AUS: undefined }), inow.indexNowAktiv()], [null, true]);
  env(alt);

  let gerufen = 0;
  const echt = { ...inow.indexNowTechnik };
  inow.indexNowTechnik.fetch = (async () => { gerufen++; throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
  inow.indexNowTechnik.protokoll = async () => { gerufen++; };
  env({ NODE_ENV: undefined });
  const r = await inow.indexNowMelden(["/business/presse"], "Prüfstand");
  await inow.indexNowNachStart();
  env({ NODE_ENV: "production", CRONS: "aus", INDEXNOW_AUS: undefined });
  const r2 = await inow.indexNowMelden(["/business/presse"], "Prüfstand");
  await inow.indexNowNachStart();
  env({ NODE_ENV: "production", CRONS: undefined, INDEXNOW_AUS: "1" });
  const r3 = await inow.indexNowMelden(["/business/presse"], "Prüfstand");
  env(alt);
  Object.assign(inow.indexNowTechnik, echt);
  gleich("Außerhalb des Betriebs, bei CRONS=aus und bei INDEXNOW_AUS=1: kein Abruf, kein Protokoll, kein Ergebnis", [r, r2, r3, gerufen], [null, null, null, 0]);
}

gruppe("B4 IndexNow: Melden im Betrieb, gefälschtes Netz, Protokoll-Attrappe (ohne Datenbank)");
{
  const alt = { NODE_ENV: process.env.NODE_ENV, CRONS: process.env.CRONS, INDEXNOW_AUS: process.env.INDEXNOW_AUS };
  process.env.NODE_ENV = "production"; delete process.env.CRONS; delete process.env.INDEXNOW_AUS;
  const echt = { ...inow.indexNowTechnik };
  const heute = new Date().toISOString().slice(0, 10);
  let antwort: () => Response | Promise<Response> = () => new Response("", { status: 200 });
  const bodies: any[] = [];
  const protokolle: { seiten: { pfad: string; stand: string }[]; status: number | null; anlass: string; fehler: string | null }[] = [];
  inow.indexNowTechnik.fetch = (async (_u: string | URL, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body ?? "{}"))); return antwort(); }) as typeof fetch;
  inow.indexNowTechnik.protokoll = async (seiten, status, anlass, _am, fehler) => { protokolle.push({ seiten, status, anlass, fehler }); };

  const r1 = await inow.indexNowMelden(["/a", "/a", "https://fiaon.com/a", { pfad: "/b", stand: "kaputt" }, { pfad: "/c", stand: "2026-11-13" }, ""], "Prüfstand");
  gleich("Doppelte raus (auch volle Adresse), leerer Pfad raus", bodies[0]?.urlList, ["https://fiaon.com/a", "https://fiaon.com/b", "https://fiaon.com/c"]);
  gleich("Schlüssel und Host in der Meldung", [bodies[0]?.host, bodies[0]?.key === inow.INDEXNOW_KEY, String(bodies[0]?.keyLocation).endsWith(`${inow.INDEXNOW_KEY}.txt`)], ["fiaon.com", true, true]);
  gleich("Text-Pfad und kaputter Stand bekommen heute, echter Stand bleibt", protokolle[0]?.seiten, [{ pfad: "/a", stand: heute }, { pfad: "/b", stand: heute }, { pfad: "/c", stand: "2026-11-13" }]);
  gleich("200 → Ergebnis mit Status und Anzahl, Protokoll ohne Fehler", [r1?.status, r1?.anzahl, r1?.anlass, protokolle[0]?.status, protokolle[0]?.fehler], [200, 3, "Prüfstand", 200, null]);

  antwort = () => new Response("Unprocessable  Entity\n url not in host", { status: 422 });
  const r2 = await inow.indexNowMelden(["/x", "/y"], "Prüfstand");
  gleich("422 → Status 422, Anzahl 2, Fehlertext ins Protokoll (Leerraum zusammengezogen)", [r2?.status, r2?.anzahl, protokolle[1]?.status, protokolle[1]?.fehler], [422, 2, 422, "Unprocessable Entity url not in host"]);

  antwort = () => { throw new Error("ECONNRESET"); };
  const r3 = await inow.indexNowMelden(["/z"], "Prüfstand");
  gleich("Netzfehler → Status null (keine Antwort), Fehler im Protokoll", [r3?.status, protokolle[2]?.status, protokolle[2]?.fehler], [null, null, "ECONNRESET"]);

  antwort = () => new Response("", { status: 202 });
  inow.indexNowTechnik.protokoll = async () => { throw new Error("Datenbank weg"); };
  const r4 = await inow.indexNowMelden(["/p"], "Prüfstand");
  gleich("Scheitert das Protokoll, kommt das Ergebnis trotzdem (still, kein Wurf)", r4?.status, 202);

  const viele = Array.from({ length: 10_003 }, (_, i) => `/v${i}`);
  inow.indexNowTechnik.protokoll = async () => {};
  bodies.length = 0;
  const r5 = await inow.indexNowMelden(viele, "Prüfstand");
  gleich("Mehr als 10.000 → genau 10.000 in einer Meldung", [bodies[0]?.urlList?.length, r5?.anzahl], [10_000, 10_000]);
  gleich("Nichts zu melden → null, kein Abruf", [await inow.indexNowMelden([], "Prüfstand"), await inow.indexNowMelden([""], "Prüfstand"), bodies.length], [null, null, 1]);

  Object.assign(inow.indexNowTechnik, echt);
  for (const [k, v] of Object.entries(alt)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
}

// ═══════════════════════════════════════════════════════════════════════════
// --db: das IndexNow-Protokoll gegen eine LOKALE Datenbank (die Abnahme lässt das laufen)
// ═══════════════════════════════════════════════════════════════════════════
async function teilDb(url: string) {
  if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url)) { ok("Datenbank-Teil nur gegen eine LOKALE Datenbank", false, url.replace(/:[^@/]*@/, ":***@")); return; }
  const { sqlPool } = await import("../server/lib/db-pool");
  gruppe("DB IndexNow-Protokoll (lokal)");
  await inow.ensureIndexNowTabelle();
  await inow.ensureIndexNowTabelle();
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_indexnow_meldungen') IS NOT NULL AS da`) as any[];
  ok("Tabelle steht (zweimal anlegen ohne Fehler)", t?.da === true);
  await sqlPool`DELETE FROM fiaon_indexnow_meldungen WHERE pfad LIKE '/pruef-%'`;

  const vorher = new Date(Date.now() - 60_000);
  await inow.indexNowTechnik.protokoll([{ pfad: "/pruef-a", stand: "2026-11-20" }, { pfad: "/pruef-ohne", stand: "" }], 200, "Prüfstand", vorher, null);
  const zeilen = (await sqlPool`SELECT pfad, to_char(stand, 'YYYY-MM-DD') AS stand, http_status FROM fiaon_indexnow_meldungen WHERE pfad LIKE '/pruef-%' ORDER BY pfad`) as any[];
  gleich("Zwei Zeilen, leerer Stand wird NULL", zeilen.map((z) => [z.pfad, z.stand, z.http_status]), [["/pruef-a", "2026-11-20", 200], ["/pruef-ohne", null, 200]]);
  await inow.indexNowTechnik.protokoll([{ pfad: "/pruef-a", stand: "2026-11-24" }], 422, "Prüfstand", new Date(Date.now() - 30_000), "abgelehnt");
  const erfolge = await inow.indexNowLetzteErfolge();
  gleich("Letzte Erfolge: Fehlversuch zählt nicht, NULL-Stand = leer", [erfolge.get("/pruef-a"), erfolge.get("/pruef-ohne")], ["2026-11-20", ""]);

  const startAm = new Date();
  await inow.indexNowTechnik.protokoll([{ pfad: "/pruef-start", stand: "2026-11-25" }], 429, inow.INDEXNOW_ANLASS_START, startAm, "Too Many Requests");
  const s = await inow.indexNowStand();
  gleich("Stand: letzte Meldung 429 mit 1 Adresse", [s.letzte?.status, s.letzte?.anzahl, s.letzte?.anlass], [429, 1, inow.INDEXNOW_ANLASS_START]);
  ok("Stand: zuletzt angenommen = die 200er-Meldung", s.letzterErfolg != null && Math.abs(new Date(s.letzterErfolg).getTime() - vorher.getTime()) < 1000, s.letzterErfolg);
  ok("Stand: Pause bis 24 h nach der 429-Meldung", s.pauseBis != null && Math.abs(new Date(s.pauseBis).getTime() - (startAm.getTime() + 24 * 3_600_000)) < 1000, s.pauseBis);
  ok("Stand: offen ist eine Zahl", typeof s.offen === "number", s.offen);

  const alt = { NODE_ENV: process.env.NODE_ENV, CRONS: process.env.CRONS, INDEXNOW_AUS: process.env.INDEXNOW_AUS };
  process.env.NODE_ENV = "production"; delete process.env.CRONS; delete process.env.INDEXNOW_AUS;
  const echt = inow.indexNowTechnik.fetch;
  let gerufen = 0;
  inow.indexNowTechnik.fetch = (async () => { gerufen++; return new Response("", { status: 200 }); }) as typeof fetch;
  await inow.indexNowNachStart();
  inow.indexNowTechnik.fetch = echt;
  for (const [k, v] of Object.entries(alt)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  gleich("Nach dem Start in der Pause: kein Abruf", gerufen, 0);

  await sqlPool`DELETE FROM fiaon_indexnow_meldungen WHERE pfad LIKE '/pruef-%'`;
  await (sqlPool as any).end?.({ timeout: 2 }).catch?.(() => {});
}
if (DB) await teilDb(DB); else console.log("\n(Datenbank-Teil übersprungen — ohne --db läuft nur der reine Teil.)");

console.log(`\n${gut + schlecht} Prüfungen, ${schlecht} Fehler.`);
process.exit(schlecht ? 1 : 0);
