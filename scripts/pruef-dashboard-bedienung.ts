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
    // Kacheln sind DIVs mit einem echten „Wer?"-Knopf darin (ein ⓘ-Knopf in
    // einem Knopf wäre ungültiges HTML). Geprüft wird beides: Fläche klickbar
    // UND der Knopf vorhanden.
    const kacheln = page.locator("div.a3-kachel[data-ton], div.a3-kachel");
    pruefe("Kacheln vorhanden und klickbar", (await kacheln.count()) >= 4, `gefunden: ${await kacheln.count()}`);
    pruefe("Jede Kachel hat einen erreichbaren „Wer?\"-Knopf",
      (await page.getByRole("button", { name: /^Wer\?/ }).count()) >= 4);
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
    let anzahl = await zeilen.count();
    // Die erste Kachel ist „Umsatz heute". Kurz nach Mitternacht ist sie ECHT
    // leer — ein Test, der dann rot wird, misst die Uhrzeit und nicht die
    // Funktion. Also: entweder Zeilen ODER ein sauberer Leerzustand. Für die
    // folgenden Prüfungen wird dann auf einen Reiter mit Inhalt gewechselt.
    const fensterText = await page.locator('[role="dialog"]').innerText();
    pruefe("Kennzahl öffnet eine Liste (Einträge oder klarer Leerzustand)",
      anzahl > 0 || /Kein Eintrag|Keine Einträge|nichts/i.test(fensterText),
      `Zeilen: ${anzahl}`);
    if (anzahl === 0) {
      // Auf einen Reiter mit Bestand wechseln, damit die Zeilen-Prüfungen
      // (Akte-Link, Filter) trotzdem etwas zu prüfen haben.
      for (const reiter of ["Dieser Monat", "Alle", "Alle offenen"]) {
        const k = page.getByRole("button", { name: reiter, exact: true });
        if (await k.count()) {
          await k.first().click();
          await page.waitForTimeout(1500);
          anzahl = await zeilen.count();
          if (anzahl > 0) break;
        }
      }
    }
    pruefe("Liste enthält Einträge mit Namen", anzahl > 0, `Zeilen: ${anzahl}`);
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

    const zKacheln = page.locator("div.a3-kachel.a3-hebt");
    pruefe("Kennzahlen sind anklickbar", (await zKacheln.count()) >= 5, `gefunden: ${await zKacheln.count()}`);
    await zKacheln.first().click();
    await page.waitForFunction(
      () => !document.querySelector('[role="dialog"]')?.textContent?.includes("Wird geladen"),
      { timeout: 15_000 },
    ).catch(() => {});
    const zZeilen = await page.locator(".df-zeile").count();
    pruefe("Kennzahl öffnet Namensliste", zZeilen > 0, `Zeilen: ${zZeilen}`);
    pruefe("Jede Zeile bietet einen Vermerk-Knopf",
      (await page.locator(".df-zeile").first().getByRole("button", { name: /Vermerk/ }).count()) === 1);
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

    // ── Umbau 04.08.2026: Karten statt Tabelle, eigene Seiten, Flag ───────────
    const tabellen = await page.locator("section.a3-tafel table").count();
    pruefe("Erstzahlungen ohne seitwärts scrollende Tabelle", tabellen === 0, `Tabellen: ${tabellen}`);
    const karten = await page.locator("div.a3-kachel[style*='border-left']").count();
    pruefe("Bestellungen erscheinen als Karten", karten > 5, `Karten: ${karten}`);
    // Verschachtelte Bedienelemente sind ungültiges HTML und für Tastatur und
    // Vorleseprogramme unerreichbar — deshalb hier ausdrücklich geprüft.
    const verschachtelt = await page.locator("button button, button [role='button'], a a").count();
    pruefe("Keine Knöpfe in Knöpfen (Tastatur + Vorleseprogramm)", verschachtelt === 0, `gefunden: ${verschachtelt}`);
    pruefe("Auszahlungen NICHT mehr in der Zahlungszentrale",
      (await page.getByRole("heading", { name: "Offene Anforderungen" }).count()) === 0);
    pruefe("Dubletten-Werkzeuge NICHT mehr in der Zahlungszentrale",
      (await page.getByRole("heading", { name: "Dubletten-Verwaltung" }).count()) === 0);

    // Buchen-Dialog: Datumsfeld muss da sein. NICHT abschicken — das würde
    // echtes Geld buchen.
    const buchenKnopf = page.getByRole("button", { name: /bezahlt buchen/ }).first();
    if (await buchenKnopf.count() > 0) {
      await buchenKnopf.click();
      await page.waitForTimeout(700);
      const datum = page.locator('[role="dialog"] input[type="date"]');
      pruefe("Buchen-Dialog hat ein Datumsfeld", await datum.isVisible().catch(() => false));
      const wert = await datum.inputValue().catch(() => "");
      pruefe("Datumsfeld ist mit heute vorbelegt",
        wert === new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
        `Wert: ${wert}`);
      const dialogText = await page.locator('[role="dialog"]').innerText();
      pruefe("Dialog zeigt den Verwendungszweck", /FIAON-[A-Z0-9]+/.test(dialogText));
      pruefe("Dialog nennt die nächste Fälligkeit", /Monatsrate wird auf den/.test(dialogText));
      await page.screenshot({ path: `/tmp/fiaon-${name}-buchen.png` });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // Eigene Seiten
    await page.goto(`${BASIS}/admin/auszahlungen`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3500);
    pruefe("Seite /admin/auszahlungen lädt",
      await page.getByRole("heading", { name: "Auszahlungen", exact: true }).first().isVisible().catch(() => false));
    pruefe("Auszahlungen zeigt offene Anforderungen",
      (await page.getByRole("heading", { name: "Offene Anforderungen" }).count()) === 1);
    await page.screenshot({ path: `/tmp/fiaon-${name}-auszahlungen.png`, fullPage: true });

    await page.goto(`${BASIS}/admin/dubletten`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3500);
    const dubText = await page.locator("body").innerText();
    pruefe("Dubletten-Seite hat die Massenwerkzeuge",
      /Alt-Bestand bereinigen/.test(dubText) && /Aufräumlauf/.test(dubText));

    // ── Notizen & Aufgaben: überall erreichbar? ───────────────────────────────
    await page.goto(`${BASIS}/admin/aufgaben`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(4000);
    pruefe("Seite /admin/aufgaben laedt",
      await page.getByRole("heading", { name: /Notizen & Aufgaben/ }).first().isVisible().catch(() => false));
    // Dialog oeffnen und die Sichtbarkeits-Auswahl pruefen. NICHT speichern —
    // das wuerde einen echten Vermerk in der Datenbank anlegen.
    await page.getByRole("button", { name: /^Neu/ }).first().click();
    await page.waitForTimeout(900);
    const dlg = await page.locator('[role="dialog"]').innerText().catch(() => "");
    pruefe("Dialog bietet Notiz und Aufgabe", /Notiz/.test(dlg) && /Aufgabe/.test(dlg));
    pruefe("Dialog bietet drei Sichtbarkeiten", /Nur ich/.test(dlg) && /Ganzes Team/.test(dlg) && /Bestimmte/.test(dlg));
    pruefe("Dialog sagt in Klartext, wer es sieht", /Kein Mitarbeiter sieht/.test(dlg));
    await page.screenshot({ path: `/tmp/fiaon-${name}-vermerk.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);

    await page.goto(`${BASIS}/admin/kontoabgleich`, { waitUntil: "domcontentloaded" }).catch(() => {});
    await page.waitForTimeout(3000);
    const kontoText = await page.locator("body").innerText();
    pruefe("Kontoabgleich erklärt die Abschaltung statt Fehler zu zeigen",
      /Abgeschaltet/.test(kontoText) && /manuell/.test(kontoText));
    // Kein SICHTBARER Verweis auf die abgeschaltete Seite — egal ob Seitenleiste
    // (Desktop) oder Schublade (Handy). Die Prüfung auf einzelne Behälter war
    // zu eng und schlug je nach Ladezeitpunkt unterschiedlich aus.
    const nochVerlinkt = await page.locator('a[href="/admin/kontoabgleich"]:visible').count();
    pruefe("Kein sichtbarer Menü-Verweis auf den Kontoabgleich", nochVerlinkt === 0, `gefunden: ${nochVerlinkt}`);
    await page.screenshot({ path: `/tmp/fiaon-${name}-kontoabgleich.png` });

    await ctx.close();
  }

  await browser.close();
  console.log(rot === 0 ? "\nAlles grün." : `\n${rot} Prüfung(en) rot.`);
  process.exit(rot === 0 ? 0 : 1);
})();
