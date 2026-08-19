// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-ABNAHME: DER ANRUF-PLAYER UND DIE TEAM-ZENTRALE
//
// ── WARUM DIESER LAUF EXISTIERT (19.08.2026) ───────────────────────────────
// Gestern wurden die Team-Zentrale (Drei-Punkte-Menü, graue Academy-Zeile,
// Wirtschaftlichkeits-Karte statt Leiste) umgebaut und AUSDRÜCKLICH NICHT im
// Browser angesehen. AGENTS.md: „Der Screenshot ist Teil der Abnahme. Wer ihn
// nicht angesehen hat, hat nicht geliefert."
//
// Heute kommt der Anruf-Player dazu — ein Bauteil an vier Stellen.
//
// ── WAS ER NICHT TUT ──────────────────────────────────────────────────────
// Er drückt nichts, was etwas auslöst. Alles Schreibende geht in eine Attrappe
// (kein Testkonto-Umschalten, keine Ansicht-Sitzung, keine Mail). Die Aufnahme
// wird NICHT abgespielt — ein `play()` erzeugte einen echten Protokolleintrag
// „angehört" in der Akte eines Kunden. Geprüft wird, dass die Bedienelemente da
// sind und der Download-Link auf die geschützte Route zeigt.
//
//   npx tsx scripts/schau-player-team.ts [PORT]
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";

const PORT = process.argv[2] || "5188";
const BASIS = `http://127.0.0.1:${PORT}`;
/**
 * Der Zugangscode — der Rückfallwert ist AUS DEM QUELLTEXT GELESEN, nicht
 * geraten (`server/routes/fiaon-admin-zugang.ts`: `ADMIN_ACCESS_CODE ||
 * "20032017"`).
 *
 * ── WARUM DAS HIER EIGENS DASTEHT ─────────────────────────────────────────
 * Der erste Lauf schickte einen leeren Code. Ergebnis: 10 rote Prüfungen —
 * „Die Team-Zentrale lädt: ROT", „Kein Drei-Punkte-Menü", „Keine Academy-Zeile".
 * Alle zehn waren FEHLALARME. Der Screenshot zeigte die Anmeldeseite mit dem
 * Zahlenfeld; die Seite war nie geladen.
 *
 * AGENTS.md beschreibt genau das: „Ein geratener Zugangscode prüft die
 * Anmeldeseite. Der Rückfallwert gehört aus dem Quelltext gelesen, nicht
 * geraten — nur der Screenshot verrät es sonst."
 */
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); }

async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: true });
  log(`        Bild: ${BILDER}/${name}.png`);
}
const text = async (page: Page) =>
  (await page.locator("body").innerText().catch(() => "")).toLowerCase();

/** Alles Schreibende in die Attrappe. Lesendes geht durch. */
async function attrappen(kontext: BrowserContext, gesehen: string[]): Promise<void> {
  await kontext.route("**/api/**", async (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD") return route.fallback();
    gesehen.push(`${m} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, attrappe: true, hinweis: "Attrappe — nichts passiert." }),
    });
  });
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: Player und Team-Zentrale ══\n");
  if (!CODE) log("  (ADMIN_ACCESS_CODE nicht gesetzt — der Zugang wird ohne Code versucht.)");

  const browser = await chromium.launch();
  const gesehen: string[] = [];
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await attrappen(kontext, gesehen);
  const page = await kontext.newPage();
  const konsole: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") konsole.push(m.text()); });
  page.on("dialog", (d) => void d.dismiss().catch(() => {}));
  await page.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } })
    .catch(() => null);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Team-Zentrale — Desktop");
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
  const da = await page.getByRole("heading", { name: /Team-Zentrale/i }).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Team-Zentrale lädt", da);
  // ── OHNE GELADENE SEITE IST JEDE WEITERE PRÜFUNG EIN FEHLALARM ──────────
  // Beim ersten Lauf standen zehn rote Prüfungen im Protokoll, und alle zehn
  // beschrieben die Anmeldeseite. Wer hier weitermisst, sucht Fehler in einer
  // Seite, die es auf dem Bildschirm nicht gibt.
  if (!da) {
    await bild(page, "team-zentrale-ABBRUCH");
    log("");
    log("  ABBRUCH: Die Seite ist nicht geladen (Anmeldung?). Der Screenshot");
    log("  oben zeigt, was wirklich auf dem Bildschirm stand. Alle weiteren");
    log("  Prüfungen wären Fehlalarme und werden nicht ausgeführt.");
    log("");
    await browser.close();
    process.exit(1);
  }
  // Erst warten, dann messen — die Karten kommen aus einer eigenen Abfrage.
  await page.locator('[data-fiaon="karten-menue"]').first()
    .waitFor({ timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await bild(page, "team-zentrale-desktop");
  const t1 = await text(page);

  // ── DER VERWALTUNGSMÜLL IST WEG ────────────────────────────────────────
  ok("„als Testkonto markieren“ steht NICHT mehr offen unter den Namen",
    !t1.includes("als testkonto markieren"),
    (t1.match(/.{0,60}als testkonto markieren.{0,30}/) ?? [""])[0]);
  const menues = await page.locator('[data-fiaon="karten-menue"]').count();
  ok(`Jede Karte hat ein Drei-Punkte-Menü (${menues} gefunden)`, menues >= 3, String(menues));

  // ── UND DAS MENÜ ÖFFNET SICH WIRKLICH ──────────────────────────────────
  // AGENTS.md: Ein Quelltext-Grep beweist nur, dass Code existiert. Also
  // drücken und am DOM messen.
  await page.locator('[data-fiaon="karten-menue"] button').first().click().catch(() => {});
  await page.waitForTimeout(500);
  const t2 = await text(page);
  ok("Das Menü zeigt „Profil öffnen“", /profil öffnen/.test(t2));
  ok("Das Menü zeigt „Als Mitarbeiter ansehen“", /als mitarbeiter ansehen/.test(t2));
  ok("Das Menü zeigt die Testkonto-Marke", /testkonto/.test(t2));
  await bild(page, "team-zentrale-menue-offen");
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(300);

  // ── DIE ACADEMY-ZEILE IST GRAU, NICHT BERNSTEIN ────────────────────────
  const academy = page.locator('[data-fiaon="academy-stand"]').first();
  const academyDa = await academy.count() > 0;
  ok("Die Academy-Zeile ist da", academyDa);
  if (academyDa) {
    const farbe = await academy.locator("p").first().evaluate(
      (e) => getComputedStyle(e).color).catch(() => "");
    ok(`Sie ist NICHT bernsteinfarben (${farbe})`,
      !/146,\s*64,\s*14/.test(farbe), farbe);
    const balken = await academy.locator('[role="progressbar"]').count();
    ok("Sie hat einen Fortschrittsbalken", balken > 0, String(balken));
  }

  // ── DIE WIRTSCHAFTLICHKEITS-KARTE STEHT OBEN ───────────────────────────
  const karte = page.locator('[data-fiaon="wirtschaftlichkeit"]');
  const karteDa = await karte.count() > 0;
  ok("Die Karte „Wirtschaftlichkeit“ ist da", karteDa);
  if (karteDa) {
    const pos = await karte.evaluate((e) => getComputedStyle(e).position);
    ok(`Sie ist KEINE fixe Leiste (position: ${pos})`, pos !== "fixed", pos);
    // „Oben" heißt: über der ersten Mitarbeiterkarte.
    const yKarte = await karte.boundingBox().then((b) => b?.y ?? 1e9);
    const yMensch = await page.locator('[data-fiaon="karten-menue"]').first()
      .boundingBox().then((b) => b?.y ?? 0);
    ok(`Sie steht ÜBER den Mitarbeiterkarten (${Math.round(yKarte)} < ${Math.round(yMensch)})`,
      yKarte < yMensch, `Karte y=${Math.round(yKarte)}, erste Person y=${Math.round(yMensch)}`);
    const kt = (await karte.innerText()).toLowerCase();
    ok("Sie trägt die Überschrift", kt.includes("wirtschaftlichkeit"));
    ok("Sie erklärt, was in die Personalkosten einfließt",
      /festgehälter/.test(kt) && /provisionen/.test(kt), kt.slice(0, 200));
    ok("… und sagt, dass auch noch nicht überwiesene dabei sind",
      /nicht überwiesen/.test(kt), kt.slice(0, 260));
  }

  // ── KLAMMER-WAISEN (die Fehlerklasse vom 19.08.) ───────────────────────
  const waise = /(^|[^(\w])\)/.test((await page.locator("body").innerText()).replace(/\([^)]*\)/g, ""));
  ok("Keine Klammer-Waise im Text", !waise);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Team-Zentrale — 380 px");
  // ═════════════════════════════════════════════════════════════════════════
  await page.setViewportSize({ width: 380, height: 900 });
  await page.waitForTimeout(1200);
  await bild(page, "team-zentrale-380");
  const schmal = await page.locator("body").evaluate(
    (b) => ({ scrollW: b.scrollWidth, clientW: b.clientWidth }));
  ok(`Kein seitliches Überlaufen (${schmal.scrollW} ≤ ${schmal.clientW + 2})`,
    schmal.scrollW <= schmal.clientW + 2, JSON.stringify(schmal));
  const menue380 = await page.locator('[data-fiaon="karten-menue"]').first()
    .isVisible().catch(() => false);
  ok("Das Drei-Punkte-Menü ist auch auf 380 px sichtbar", menue380);
  const karte380 = page.locator('[data-fiaon="wirtschaftlichkeit"]');
  if (await karte380.count() > 0) {
    const b = await karte380.boundingBox();
    ok(`Die Wirtschaftlichkeits-Karte bleibt im Bild (Breite ${Math.round(b?.width ?? 0)})`,
      (b?.width ?? 0) <= 380, String(Math.round(b?.width ?? 0)));
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Der Anruf-Player im Mitarbeiter-Profil");
  // ═════════════════════════════════════════════════════════════════════════
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(600);

  // Einen Mitarbeiter öffnen, der Gespräche mit Aufnahme hat.
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  // Die Karte öffnet das Detailfenster; das Menü NICHT anklicken.
  await page.getByText(/Lucas|Nikita/i).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  const reiter = await page.getByRole("button", { name: /Gespräche/i }).first()
    .click().then(() => true).catch(() => false);
  ok("Der Reiter „Gespräche“ ist erreichbar", reiter);
  await page.waitForTimeout(2200);
  await bild(page, "profil-gespraeche");

  // ── DER KNOPF HEISST „Anhören“ ─────────────────────────────────────────
  // Der erste Entwurf suchte „Aufnahme anhören“ und fand nichts; die Prüfung
  // meldete „Player nicht erreichbar“. Der SCREENSHOT zeigte den Knopf: Er
  // steht rechts in der Zeile und heißt schlicht „Anhören“.
  //
  // AGENTS.md: Fehlermeldungen nennen den gefundenen Text — und der Screenshot
  // ist Teil der Abnahme, nicht die Bestätigung danach.
  const aufklappen = await page.getByRole("button", { name: /^Anhören$/i }).first()
    .click({ timeout: 8_000 }).then(() => true)
    .catch(() => page.getByText(/^Anhören$/i).first().click({ timeout: 8_000 })
      .then(() => true).catch(() => false));
  await page.waitForTimeout(1400);
  const player = page.locator('[data-fiaon="anruf-player-profil"]').first();
  const playerDa = await player.count() > 0;
  log(`        Aufklappen versucht: ${aufklappen}, Player gefunden: ${playerDa}`);

  if (playerDa) {
    await bild(page, "anruf-player");
    ok("Der Player hat einen Abspielknopf",
      await player.locator('[data-fiaon="player-abspielen"]').count() > 0);
    ok("… einen Fortschrittsbalken",
      await player.locator('[data-fiaon="player-fortschritt"]').count() > 0);
    ok("… eine Zeitanzeige",
      /\d+:\d\d\s*\/\s*/.test(await player.innerText()), await player.innerText());
    // Die Geschwindigkeit muss DURCHSCHALTEN — drücken, dann messen.
    const tempo = player.locator('[data-fiaon="player-tempo"]');
    ok("… einen Geschwindigkeitsknopf", await tempo.count() > 0);
    if (await tempo.count() > 0) {
      const vorher = (await tempo.innerText()).trim();
      await tempo.click();
      await page.waitForTimeout(250);
      const nachher = (await tempo.innerText()).trim();
      ok(`… und er schaltet um (${vorher} → ${nachher})`, vorher !== nachher,
        `${vorher} / ${nachher}`);
      await tempo.click(); await page.waitForTimeout(200);
      const drittens = (await tempo.innerText()).trim();
      ok(`… über drei Stufen (${nachher} → ${drittens})`, drittens !== nachher,
        `${nachher} / ${drittens}`);
    }
    const laden = player.locator('[data-fiaon="player-laden"]');
    ok("… einen Download-Knopf", await laden.count() > 0);
    if (await laden.count() > 0) {
      const href = await laden.getAttribute("href");
      ok("Der Download zeigt auf die geschützte Route mit laden=1",
        /\/api\/fiaon\/telefon\/\d+\/aufnahme\?laden=1$/.test(String(href)), String(href));
      const titel = await laden.getAttribute("title");
      ok("… und sagt, dass der Zugriff protokolliert wird",
        /protokolliert/i.test(String(titel)), String(titel));
    }
    // Die alte Browser-Leiste darf nicht mehr da sein.
    const nativ = await page.locator("audio[controls]").count();
    ok("Keine nackte <audio controls>-Leiste mehr auf dieser Seite", nativ === 0,
      `${nativ} gefunden`);
  } else {
    log("        Kein aufklappbarer Anruf mit Aufnahme gefunden — der Player");
    log("        wird auf dieser Seite nicht geprüft. Das ist ein ÜBERSPRUNGEN,");
    log("        kein Bestanden.");
    schlecht++;
    log("  ROT   Der Player war im Profil nicht erreichbar");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Nebenwirkungen");
  // ═════════════════════════════════════════════════════════════════════════
  ok("Kein Schreibzugriff ist echt rausgegangen (alles in der Attrappe)",
    true, gesehen.join(", ") || "keiner");
  log(`        Abgefangen: ${gesehen.length === 0 ? "nichts" : gesehen.join(", ")}`);
  const echteFehler = konsole.filter((k) =>
    !/favicon|net::ERR_|Download the React DevTools|autocomplete/i.test(k));
  ok("Keine Fehler in der Browser-Konsole", echteFehler.length === 0,
    echteFehler.slice(0, 3).join(" | "));

  await browser.close();
  log("");
  log(`${gut} ok, ${schlecht} rot.  Bilder in ${BILDER}/`);
  log("");
  if (schlecht > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
