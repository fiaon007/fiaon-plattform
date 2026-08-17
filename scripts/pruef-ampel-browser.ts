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
