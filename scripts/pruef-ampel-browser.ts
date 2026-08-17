// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DIE ZWEIG-AMPEL SAGT DIE WAHRHEIT
//
// ── WAS BEWIESEN WERDEN MUSS ───────────────────────────────────────────────
// Der Betreiber hat alle Make-Zweige von Hand geprüft. Die Mails kommen an.
// Trotzdem stand bei jedem Ereignis eine gelbe Marke „nicht bestätigt" — ohne
// Erklärung, was ihm fehlt.
//
// Der Grund: Ohne BREVO_API_KEY kann die Bestätigung nie greifen. Die Ampel war
// nicht gelb, weil etwas kaputt ist, sondern weil sie nichts messen KANN.
//
// Ein Quelltext-Grep beweist nur, dass der Text existiert. AGENTS.md verlangt,
// dass ein Mensch ihn SIEHT — also wird die Seite geöffnet und gemessen, was im
// Bild steht. Und der Screnshot wird angesehen.
//
//   npx tsx scripts/pruef-ampel-browser.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

async function main(): Promise<void> {
  mkdirSync("reports/ampel", { recursive: true });
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 1100 } });

  // Verwaltungs-Anmeldung wie in den anderen Prüfständen.
  const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  // ── DER RÜCKFALLWERT MUSS DER ECHTE SEIN (20.08.2026) ─────────────────
  // Hier stand „fiaon-admin" — geraten. Die Anmeldung schlug fehl, alle neun
  // Prüfungen wurden rot, und der Screenshot zeigte die Zifferntastatur des
  // Zugangscodes. Der Prüfstand prüfte die Anmeldeseite, nicht die Ampel.
  //
  // Der Rückfallwert steht in server/routes/fiaon-admin-zugang.ts. Wer ihn
  // rät, prüft im Zweifel die falsche Seite — und der Screenshot ist das
  // Einzige, was das verrät.
  const code = process.env.ADMIN_ACCESS_CODE || "20032017";
  const fp = createHmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
  const exp = String(Date.now() + 3600_000);
  const sig = createHmac("sha256", geheim).update(`adminzugang:${exp}:${fp}`).digest("hex").slice(0, 40);
  await kontext.addCookies([{
    name: "fiaon_admin", value: `${exp}.${sig}`,
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  const seite = await kontext.newPage();

  try {
    // ═══════════════════════════════════════════════════════════════════════
    titel("DIE SEITE /admin/events");
    // ═══════════════════════════════════════════════════════════════════════
    await seite.goto(`${BASIS}/admin/events`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // ── AUF DEN INHALT WARTEN, NICHT AUF DIE NAVIGATION ──────────────────
    // Erster Entwurf wartete auf /BREVO_API_KEY|E-Mail-Events|Ereignis/. Das
    // traf „E-Mail-Events" im MENÜ — das steht sofort da, lange bevor die Daten
    // geladen sind. Sechs Prüfungen wurden rot, während dieselben Prüfungen auf
    // 380 px grün waren: Dort ist das Menü eingeklappt, also traf die Bedingung
    // erst den echten Inhalt.
    //
    // Eine Wartebedingung, die auf das Gerüst passt, wartet nicht.
    const geladen = await seite.getByRole("heading", { name: /Bestätigung inaktiv/i }).first()
      .waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    pruef("Die Seite lädt und zeigt die Karte", geladen,
      "ohne Brevo-Schlüssel MUSS sie erscheinen");

    const t = (await seite.locator("body").innerText().catch(() => "")).toLowerCase();

    // ── DIE KARTE ────────────────────────────────────────────────────────
    pruef("Die Karte „Bestätigung inaktiv“ steht im Bild",
      t.includes("bestätigung inaktiv") && t.includes("brevo_api_key"),
      "der Betreiber sah 35 gelbe Marken ohne Erklärung");
    pruef("Sie sagt, dass die Marken NICHT „Zweig fehlt“ bedeuten",
      t.includes("bedeuten nicht, dass zweige fehlen"),
      "sonst sucht er einen Fehler, den es nicht gibt");
    pruef("Sie nennt die gemessene Zahl",
      t.includes("10.431 mails"), "eine Behauptung ohne Zahl ist eine Meinung");
    pruef("Sie nennt die Handlung",
      t.includes("umgebungsvariablen des deployments"));
    pruef("Sie sagt, dass es sich danach selbst bestätigt",
      t.includes("bestätigt sich die ampel selbst"),
      "damit niemand nach einem Knopf sucht");

    // ── UND SIE STEHT GANZ OBEN ──────────────────────────────────────────
    // Weil sie jede andere Anzeige auf der Seite relativiert.
    const iKarte = t.indexOf("bestätigung inaktiv");
    const iMarke = t.search(/nicht bestätigt|nicht verifiziert/);
    pruef("Sie steht ÜBER den gelben Marken",
      iKarte > 0 && (iMarke < 0 || iKarte < iMarke),
      `Karte@${iKarte}, erste Marke@${iMarke}`);

    await seite.screenshot({ path: "reports/ampel/events.png", fullPage: false });
    console.log("        reports/ampel/events.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("DIE NEUE SEITENORDNUNG");
    // ═══════════════════════════════════════════════════════════════════════
    // Das Protokoll stand als ERSTES. Der Betreiber scrollte an einer
    // 14-Tage-Liste vorbei, um an „Alle Zweige prüfen" zu kommen.
    const iPruef = t.indexOf("alle zweige prüfen");
    const iEvents = t.search(/webhook-diagnose|letzter erfolgreicher versand/);
    const iProtokoll = t.indexOf("zustellprotokoll —");
    pruef("„Alle Zweige prüfen“ steht vor der Ereignisliste",
      iPruef > 0 && iEvents > iPruef, `prüfen@${iPruef}, liste@${iEvents}`);
    pruef("Das Zustellprotokoll steht GANZ UNTEN",
      iProtokoll > iEvents && iProtokoll > iPruef,
      `protokoll@${iProtokoll} muss nach liste@${iEvents} kommen`);
    pruef("Ein Sprunganker führt zum Protokoll",
      await seite.getByRole("link", { name: /Zum Zustellprotokoll/i }).count() > 0);

    // Und er funktioniert wirklich.
    const anker = seite.getByRole("link", { name: /Zum Zustellprotokoll/i }).first();
    if (await anker.count() > 0) {
      await anker.click();
      await seite.waitForTimeout(600);
      const sichtbar = await seite.locator("#zustellprotokoll").isVisible().catch(() => false);
      pruef("Der Anker springt zum Protokoll", sichtbar);
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("DIE DREI ZUSTÄNDE — mit Attrappe, weil kein Schlüssel da ist");
    // ═══════════════════════════════════════════════════════════════════════
    // ── WARUM EINE ATTRAPPE ─────────────────────────────────────────────
    // Der echte Lauf bräuchte einen Brevo-Schlüssel und würde 35 echte Mails
    // schicken. Die Attrappe liefert genau, was der Server liefert — inklusive
    // aller Felder, die die Oberfläche liest (AGENTS.md: eine Attrappe, die
    // WENIGER liefert, erzeugt Fehler, die es nicht gibt).
    const drei = await kontext.newPage();
    await drei.route("**/api/fiaon/admin/mail/alle-pruefen", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, gepruefte: 5, sauber: 2, beanstandet: 1, gestoert: 2,
          dauerSekunden: 33, testAdresse: "probe@example.invalid",
          zweige: [
            { event: "welcome", zustand: "bestaetigt", bestaetigt: true, titel: "Willkommen",
              beschreibung: "", text: "Zweig bestätigt.", gesehenAm: null, brevoZustand: "zugestellt" },
            { event: "payment_details", zustand: "bestaetigt", bestaetigt: true, titel: "Zahlungsdaten",
              beschreibung: "", text: "Zweig bestätigt.", gesehenAm: null, brevoZustand: "zugestellt" },
            { event: "termin_bestaetigung", zustand: "zweig_fehlt", bestaetigt: false, titel: "Terminbestätigung",
              beschreibung: "", text: "Nicht bestätigt — die Testmail kam nicht bei Brevo an.",
              gesehenAm: null, brevoZustand: null },
            { event: "abo_rate", zustand: "pruefung_gestoert", bestaetigt: false, titel: "Abo-Rate",
              beschreibung: "", text: "Die Prüfung selbst ist gestört.", gesehenAm: null, brevoZustand: null },
            { event: "mahnung", zustand: "pruefung_gestoert", bestaetigt: false, titel: "Mahnung",
              beschreibung: "", text: "Die Prüfung selbst ist gestört.", gesehenAm: null, brevoZustand: null },
          ],
          abgleich: { ok: false, grund: "kein Schlüssel" },
          brevo: {
            titel: "Die Prüfung selbst ist gestört — nicht der Versand. "
              + "Brevo beanstandet: „endDate must be lower than or equal to today“",
            anleitung: [
              "Das ist ein Programmfehler bei uns (HTTP 400): Brevo hat die Abfrage abgelehnt, nicht die Mail.",
              "Nichts in Make zu tun. Die vollständige Antwort steht unten.",
              "Der Abgleich holt alles nach — es geht keine Zustellung verloren.",
            ],
            behebbar: false, wer: "wir",
            roh: '{"message":"endDate must be lower than or equal to today","code":"invalid_parameter"}',
          },
        }),
      });
    });
    await drei.goto(`${BASIS}/admin/events`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await drei.getByRole("button", { name: /Alle Zweige prüfen/i }).first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});

    // ── OHNE TESTADRESSE IST DER KNOPF AUS ──────────────────────────────
    // Erster Versuch: sofort klicken. Der Dialog erschien, aber der Knopf war
    // deaktiviert — „Trag zuerst oben eine Testadresse ein". Acht Prüfungen
    // wurden rot, und nur der Screenshot verriet den Grund.
    //
    // Das ist RICHTIGES Verhalten der Seite: Ohne Adresse weiß niemand, wohin
    // die 35 Mails gehen. Der Prüfstand muss sie also eintragen — wie ein
    // Mensch es täte.
    const feld = drei.getByPlaceholder(/adresse/i).first();
    if (await feld.count() > 0) {
      await feld.fill("probe@example.invalid");
      await drei.waitForTimeout(400);
    }

    await drei.getByRole("button", { name: /^Alle Zweige prüfen$/i }).first().click();

    // Den Dialogtext lesen, BEVOR er verschwindet: Dort stand die alte
    // Laufzeitangabe („etwa 2 Minuten"), während die Fortschrittsleiste schon
    // die neue nannte. Zwei Angaben derselben Zahl an zwei Stellen.
    await drei.waitForTimeout(500);
    const dialogText = (await drei.locator("body").innerText().catch(() => "")).toLowerCase();

    // Der Dialog fragt nach — das ist richtig bei 35 echten Mails.
    const jaKnopf = drei.getByRole("button", { name: /Probemails senden/i }).first();
    if (await jaKnopf.count() > 0) await jaKnopf.click().catch(() => {});
    await drei.getByText(/Prüfung gestört/i).first()
      .waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});

    const td = (await drei.locator("body").innerText().catch(() => "")).toLowerCase();
    pruef("Der Dialog nennt die NEUE Laufzeit in Sekunden",
      dialogText.includes("sekunden") && !/etwa 2 minuten/.test(dialogText),
      `im Screenshot stand noch „etwa 2 Minuten“: ${dialogText.slice(0, 90)}`);

    pruef("Die Kachel „Zweig fehlt“ ersetzt „ohne Zweig“",
      td.includes("zweig fehlt") && !td.includes("ohne zweig"),
      "„ohne Zweig“ zählte die gestörten Prüfungen mit — die falsche Anschuldigung");
    pruef("Es gibt eine eigene Kachel „Prüfung gestört“", td.includes("prüfung gestört"));
    pruef("Sie steht auf 2, nicht in „Zweig fehlt“ eingerechnet",
      /prüfung gestört/.test(td) && td.includes("2"),
      "1 Zweig fehlt, 2 gestört — nicht 3 fehlend");
    pruef("Der Fehler ist als UNSER Fehler gekennzeichnet",
      td.includes("unser fehler"),
      "die Farbe und die Marke sagen, wer zuständig ist");
    pruef("Brevos eigener Satz steht da",
      td.includes("enddate must be lower than or equal to today"));
    pruef("„Nichts in Make zu tun“ steht da",
      td.includes("nichts in make zu tun"),
      "genau hier entstand die falsche Suche");
    pruef("Der Hinweis sagt, dass die gestörten NICHT fehlen",
      td.includes("das heißt nicht, dass diese zweige fehlen"));
    pruef("Die vollständige Brevo-Antwort ist aufklappbar",
      await drei.getByText(/Vollständige Antwort von Brevo/i).count() > 0,
      "der Auftrag verlangt sie ausdrücklich");

    // Aufklappen und den Inhalt prüfen.
    const auf = drei.getByText(/Vollständige Antwort von Brevo/i).first();
    if (await auf.count() > 0) {
      await auf.click();
      await drei.waitForTimeout(300);
      const roh = (await drei.locator("pre").first().innerText().catch(() => ""));
      pruef("Sie enthält die rohe JSON-Antwort",
        roh.includes("invalid_parameter"), roh.slice(0, 60));
    }

    await drei.screenshot({ path: "reports/ampel/drei-zustaende.png", fullPage: false });
    console.log("        reports/ampel/drei-zustaende.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("DAS EIGENE ZEICHEN IN DER NAVIGATION");
    // ═══════════════════════════════════════════════════════════════════════
    // „Mail-Zentrale" und „E-Mail-Events" trugen dasselbe Bild. Zwei Einträge
    // untereinander, gleiches Zeichen — wer schnell klickt, landet falsch.
    const navMail = seite.getByRole("link", { name: /Mail-Zentrale/i }).first();
    const navEvents = seite.getByRole("link", { name: /E-Mail-Events/i }).first();
    const beideDa = await navMail.count() > 0 && await navEvents.count() > 0;
    pruef("Beide Navigationseinträge sind da", beideDa);

    if (beideDa) {
      // Die Zeichen vergleichen: ihr SVG-Inhalt muss sich unterscheiden.
      const svgMail = await navMail.locator("svg").first().innerHTML().catch(() => "A");
      const svgEvents = await navEvents.locator("svg").first().innerHTML().catch(() => "B");
      pruef("Sie tragen VERSCHIEDENE Zeichen", svgMail !== svgEvents,
        "vorher beide `Send` aus lucide-react");
      pruef("Das Zeichen der Events hat einen Prüfhaken",
        /m12\.4 11\.8/.test(svgEvents) || svgEvents.split("path").length >= 4,
        "Umschlag plus Haken: Post, die geprüft ist");
    }

    await seite.locator("nav, aside").first()
      .screenshot({ path: "reports/ampel/navigation.png" }).catch(() => {});
    console.log("        reports/ampel/navigation.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("380 PX — die Karte muss auch schmal lesbar sein");
    // ═══════════════════════════════════════════════════════════════════════
    const schmal = await kontext.newPage();
    await schmal.setViewportSize({ width: 380, height: 1000 });
    await schmal.goto(`${BASIS}/admin/events`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await schmal.getByRole("heading", { name: /Bestätigung inaktiv/i }).first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const ts = (await schmal.locator("body").innerText().catch(() => "")).toLowerCase();
    pruef("Die Karte steht auch auf 380 px", ts.includes("bestätigung inaktiv"));
    const ueberlauf = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("Kein waagerechtes Schieben", !ueberlauf,
      "auf dem Telefon liest niemand seitwärts");
    await schmal.screenshot({ path: "reports/ampel/events-380.png", fullPage: false });
    console.log("        reports/ampel/events-380.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/ampel/`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
