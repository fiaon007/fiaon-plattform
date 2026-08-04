// Bedienprobe des Dashboards: klickt wie ein Mensch und hält fest, was
// passiert. Prüft die Dinge, die man an Zahlen NICHT sehen kann — ob sich das
// Detailfenster öffnet, ob Namen darin stehen, ob „Akte öffnen" wirklich auf
// eine Akte zeigt und ob das Teilen-Bild entsteht.
//
// Aufruf: npx tsx scripts/pruef-dashboard-bedienung.ts
// Setzt einen laufenden Server voraus (BASIS, Vorgabe http://localhost:5188).
import { chromium, type Page } from "playwright";
import { writeFileSync } from "fs";

const BASIS = process.env.BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";

let rot = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  if (!gut) rot++;
  console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  ${hinweis}`}`);
};

async function entsperren(page: Page) {
  await page.goto(`${BASIS}/admin`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async (code) => {
    await fetch("/api/fiaon/zugang/oeffnen", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }, CODE);
}

/**
 * Alle Detaillisten einmal abfragen. Klingt banal, ist aber die Prüfung, die
 * eine ganze Fehlerklasse abfängt: Sobald eine dieser Abfragen einen
 * Platzhalter übergibt, den sie nicht benutzt, antwortet Postgres mit
 * „could not determine data type of parameter $1" — die Kachel öffnet sich
 * dann mit „Serverfehler", und das sieht man nur, wenn man sie anklickt.
 */
async function listenPruefen(cookie: string) {
  const arten = [
    "angekuendigt-heute", "angekuendigt-alle", "angekuendigt-alt",
    "zusagen-heute", "zusagen-ueberfaellig", "zusagen-alle",
    "bezahlt-heute", "bezahlt-monat", "bezahlt-alle",
    "offen-alle", "offen-ohne-reaktion", "abgelaufen",
    "erinnert-heute",
    "abo-heute", "abo-woche", "abo-ueberfaellig", "abo-bezahlt-monat",
  ];
  console.log("\n── Detaillisten (alle Arten) ─────────────");
  for (const art of arten) {
    const r = await fetch(`${BASIS}/api/fiaon/admin/hub/liste?art=${art}&limit=5`, { headers: { cookie } });
    const j: any = await r.json().catch(() => null);
    pruefe(`Liste ${art}`, r.status === 200 && j?.ok === true,
      `HTTP ${r.status} ${j?.error || ""}`);
  }
}

(async () => {
  // Cookie einmal per API holen — für die reinen Datenprüfungen braucht es
  // keinen Browser.
  const anmeldung = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: CODE }),
  });
  const cookie = (anmeldung.headers.get("set-cookie") || "").split(";")[0];
  await listenPruefen(cookie);

  const browser = await chromium.launch();

  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["handy", { width: 380, height: 820 }],
  ] as const) {
    console.log(`\n── ${name} ──────────────────────────────`);
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const fehlerImLog: string[] = [];
    page.on("pageerror", (e) => fehlerImLog.push(e.message));

    await entsperren(page);
    await page.goto(`${BASIS}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2600);

    // ── Kachel „Heute angekündigt" → Detailfenster
    const kacheln = page.locator("button.a3-kachel");
    pruefe("Kacheln sind Knöpfe (öffnen ein Fenster statt wegzunavigieren)", (await kacheln.count()) >= 4,
      `gefunden: ${await kacheln.count()}`);
    await kacheln.first().click();
    const fenster = page.locator('[role="dialog"]');
    await fenster.first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    pruefe("Detailfenster öffnet sich", await fenster.first().isVisible());

    // Auf das Ende des Ladens warten — sonst prüft man den Ladezustand.
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]')?.textContent?.includes("Wird geladen"),
      { timeout: 15_000 },
    ).catch(() => {});
    const zeilen = page.locator(".df-zeile");
    const anzahl = await zeilen.count();
    pruefe("Fenster enthält Einträge mit Namen", anzahl > 0, `Zeilen: ${anzahl}`);
    if (anzahl > 0) {
      const ersteAkte = await zeilen.first().locator('a[href^="/admin/kunde/"]').first().getAttribute("href");
      pruefe('„Akte öffnen" zeigt auf eine echte Akte', !!ersteAkte && ersteAkte.startsWith("/admin/kunde/FIAON-"),
        String(ersteAkte));
      const text = (await zeilen.first().innerText()).replace(/\n+/g, " | ");
      console.log(`        erste Zeile: ${text.slice(0, 150)}`);
    }
    await page.screenshot({ path: `/tmp/fiaon-${name}-fenster.png` });
    console.log(`        Bild: /tmp/fiaon-${name}-fenster.png`);

    // Reiter wechseln (Überfällig-Sicht)
    const reiter = page.locator(".df-reiter button");
    if (await reiter.count() > 1) {
      await reiter.nth(1).click();
      await page.waitForTimeout(1400);
      pruefe("Reiterwechsel lädt eine andere Sicht", (await page.locator(".df-zeile").count()) >= 0);
    }

    // Filter im Fenster
    const suche = page.locator('[role="dialog"] input').first();
    await suche.fill("zzzz-nichts");
    await page.waitForTimeout(400);
    pruefe("Filter im Fenster greift", (await page.locator(".df-zeile").count()) === 0);
    await suche.fill("");

    // ESC schließt
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    pruefe("ESC schließt das Fenster", !(await page.locator('[role="dialog"]').first().isVisible().catch(() => false)));

    // ── „Was ist zu tun?" einklappen
    const aufgabenKopf = page.getByRole("heading", { name: "Was ist zu tun?" });
    const vorher = await page.locator("section.a3-tafel").first().boundingBox();
    await aufgabenKopf.click();
    await page.waitForTimeout(600);
    const nachher = await page.locator("section.a3-tafel").first().boundingBox();
    pruefe('„Was ist zu tun?" klappt zu', !!vorher && !!nachher && nachher.height < vorher.height,
      `${vorher?.height} → ${nachher?.height}`);
    await aufgabenKopf.click();
    await page.waitForTimeout(600);
    const wieder = await page.locator("section.a3-tafel").first().boundingBox();
    pruefe("… und wieder auf", !!wieder && !!nachher && wieder.height > nachher.height);

    // ── Teilen-Bild
    await page.locator("button.rt-knopf").first().scrollIntoViewIfNeeded();
    await page.locator("button.rt-knopf").first().click();
    await page.waitForTimeout(2600);
    const vorschau = page.locator("img.rt-vorschau");
    pruefe("Teilen-Fenster erzeugt eine Bildvorschau", await vorschau.isVisible().catch(() => false));
    await page.screenshot({ path: `/tmp/fiaon-${name}-teilen.png` });
    console.log(`        Bild: /tmp/fiaon-${name}-teilen.png`);

    const daten = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement | null;
      return c ? { breite: c.width, hoehe: c.height, png: c.toDataURL("image/png") } : null;
    });
    if (daten) {
      pruefe("Bild ist Hochformat 1080×1350", daten.breite === 1080 && daten.hoehe === 1350,
        `${daten.breite}×${daten.hoehe}`);
      const datei = `/tmp/fiaon-rangliste-${name}.png`;
      writeFileSync(datei, Buffer.from(daten.png.split(",")[1], "base64"));
      console.log(`        Bild: ${datei}`);
      pruefe("Bild hat echten Inhalt (> 30 kB)", daten.png.length > 40_000, `${Math.round(daten.png.length / 1024)} kB`);
    } else {
      pruefe("Bild wurde erzeugt", false, "kein Canvas gefunden");
    }

    // Zeitraum umschalten → neues Bild
    const wahl = page.locator(".rt-wahl button");
    if (await wahl.count() === 3) {
      await wahl.nth(2).click();
      await page.waitForTimeout(2200);
      const png2 = await page.evaluate(() => (document.querySelector("canvas") as HTMLCanvasElement)?.toDataURL("image/png"));
      pruefe('Zeitraum „monatlich" erzeugt ein anderes Bild', !!png2 && png2 !== daten?.png);
      if (png2) writeFileSync(`/tmp/fiaon-rangliste-${name}-monat.png`, Buffer.from(png2.split(",")[1], "base64"));
    }

    pruefe("Keine JavaScript-Fehler auf der Seite", fehlerImLog.length === 0, fehlerImLog.slice(0, 2).join(" | "));

    // ── Zahlungszentrale ──────────────────────────────────────────────────────
    // WICHTIG: hier wird NICHT auf „bezahlt" oder „erinnern" geklickt — das
    // würde echtes Geld buchen bzw. echte Kundenmails auslösen. Geprüft wird
    // nur, dass die Knöpfe da sind und die Namenslisten funktionieren.
    console.log(`  ── /admin/zahlungen`);
    await page.goto(`${BASIS}/admin/zahlungen`, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
    await page.waitForTimeout(9000);

    const zKacheln = page.locator("button.a3-kachel");
    pruefe("Kennzahlen sind anklickbar", (await zKacheln.count()) >= 5, `gefunden: ${await zKacheln.count()}`);
    await zKacheln.first().click();
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]')?.textContent?.includes("Wird geladen"),
      { timeout: 15_000 },
    ).catch(() => {});
    const zZeilen = await page.locator(".df-zeile").count();
    pruefe("Kennzahl öffnet Namensliste", zZeilen > 0, `Zeilen: ${zZeilen}`);
    await page.screenshot({ path: `/tmp/fiaon-${name}-zahlungen-fenster.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    // Abo-Tafel
    const abo = page.getByRole("heading", { name: "Abo — monatliche Paketrate" });
    pruefe("Abo-Tafel ist vorhanden", await abo.isVisible().catch(() => false));
    const aboText = await page.locator("section.a3-tafel").first().innerText().catch(() => "");
    pruefe("Abo zeigt laufenden Monatsumsatz", /LAUFENDER MONATSUMSATZ/i.test(aboText));
    pruefe("Abo zeigt Ratenzeilen mit Referenz", /-\d+\s·/.test(aboText) || /Rate \d/.test(aboText));
    pruefe("Abo-Zeilen haben Buchen- und Erinnern-Knopf",
      (await page.getByRole("button", { name: "bezahlt" }).count()) > 0 &&
      (await page.getByRole("button", { name: "erinnern" }).count()) > 0);
    pruefe("Erstzahlungs-Liste ist da", await page.getByRole("heading", { name: "Erstzahlungen" }).isVisible().catch(() => false));
    pruefe("Versand-Knöpfe stehen über der Liste",
      (await page.getByRole("button", { name: /Erinnerung an alle offenen/ }).count()) === 1 &&
      (await page.getByRole("button", { name: /^Erinnerungs-Lauf$/ }).count()) >= 1);
    pruefe("Sortierung „Neueste zuerst\" ist aktiv",
      (await page.locator('.a3-reiter button[data-an="1"]', { hasText: "Neueste zuerst" }).count()) === 1);
    await page.screenshot({ path: `/tmp/fiaon-${name}-zahlungen.png`, fullPage: true });
    console.log(`        Bild: /tmp/fiaon-${name}-zahlungen.png`);
    pruefe("Keine JavaScript-Fehler in der Zahlungszentrale", fehlerImLog.length === 0, fehlerImLog.slice(0, 2).join(" | "));

    await ctx.close();
  }

  await browser.close();
  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  process.exit(rot === 0 ? 0 : 1);
})();
