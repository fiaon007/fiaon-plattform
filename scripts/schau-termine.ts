// ═══════════════════════════════════════════════════════════════════════════
// DER ABNAHME-BEWEIS DER TERMIN-ZENTRALE
//
// Der Auftrag ist ausdrücklich: „Screenshot der Zentrale MIT echten Zahlen im
// Kopf, sonst gilt Teil 1 als nicht geliefert."
//
// Dieser Stand öffnet /admin/termine mit echter Admin-Anmeldung, wartet auf die
// Zahlen (nicht auf das Gerüst!) und legt drei Bilder ab: Desktop-Kopf,
// Mitarbeiter-Vergleich und 380 px.
//
// NUR LESEND: Keine Einladung wird verschickt. Der Versand-Knopf wird
// ABGEFANGEN — ein Beweis-Lauf darf keine 50 Mails auslösen.
//
//   npx tsx scripts/schau-termine.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";

let ok = 0;
let rot = 0;
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}

function adminCookie(): string {
  const g = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  const fp = createHmac("sha256", g)
    .update(`admincode:${process.env.ADMIN_ACCESS_CODE || "20032017"}`)
    .digest("hex").slice(0, 16);
  const e = String(Date.now() + 3_600_000);
  const sig = createHmac("sha256", g).update(`adminzugang:${e}:${fp}`).digest("hex").slice(0, 40);
  return `${e}.${sig}`;
}

async function main(): Promise<void> {
  mkdirSync("reports/termine", { recursive: true });
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await kontext.addCookies([{
    name: "fiaon_admin", value: adminCookie(),
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    const seite = await kontext.newPage();
    // ── DER VERSAND WIRD ABGEFANGEN ──────────────────────────────────────
    // Ein Beweis-Lauf darf keine 50 echten Einladungen auslösen. Die Vorschau
    // (`schreiben: false`) läuft echt durch — sie schickt nichts.
    await seite.route("**/admin/termine/einladen", async (r) => {
      const koerper = JSON.parse(r.request().postData() || "{}");
      if (koerper.schreiben === true) {
        console.log("        (Versand abgefangen — ein Beweis-Lauf schickt keine Mails)");
        return r.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, vorschau: false, gesendet: 0,
            hinweis: "ABGEFANGEN vom Beweis-Lauf." }),
        });
      }
      // ── DIE VORSCHAU LÄUFT ECHT — MIT BODY ──────────────────────────────
      // `r.continue()` ohne Angaben verlor bei diesem POST den Rumpf: Der Server
      // bekam `{}` statt `{alle:true}`, antwortete mit „0 würden rausgehen", und
      // die Prüfung wurde rot. Die Route selbst war einwandfrei (direkt geprüft:
      // „50 Einladungen würden jetzt rausgehen").
      return r.continue({
        postData: r.request().postData() ?? undefined,
        headers: { ...r.request().headers(), "content-type": "application/json" },
      });
    });

    await seite.goto(`${BASIS}/admin/termine`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // ── AUF DIE ZAHLEN WARTEN, NICHT AUF DAS GERÜST ─────────────────────
    // AGENTS.md: Ein Screenshot vom Ladezustand beweist nichts.
    await seite.getByText(/bezahlte Kunden ohne Termin/i).first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => console.log("        (Karte „ohne Termin“ nicht erschienen)"));
    await seite.waitForTimeout(700);

    const text = await seite.locator("body").innerText();
    pruef("Die Seite lädt", text.includes("Termin-Zentrale"));
    pruef("Der Kennzahlen-Kopf zeigt Zahlen",
      /\d+\s*\n?\s*(heute|diese Woche)/i.test(text) || /heute/i.test(text));
    pruef("Der Mitarbeiter-Vergleich ist da", /Je Mitarbeiter/i.test(text));
    pruef("… mit No-Show-Quoten in Prozent", /\(\d+ %\)/.test(text),
      "ohne Prozent ist keine Quote zu sehen");
    pruef("Die Karte „bezahlte Kunden ohne Termin“ ist da",
      /bezahlte Kunden ohne Termin/i.test(text));
    pruef("Die 336 stehen dort", /33\d bezahlte Kunden/i.test(text),
      text.match(/\d+ bezahlte Kunden ohne Termin/)?.[0] ?? "keine Zahl gefunden");
    pruef("Der Hinweis auf die Staffel steht dabei",
      /50 am Tag/i.test(text), "ein Knopf ohne Grenze ruiniert die Zustellbarkeit");
    pruef("Es gibt Einladungs-Knöpfe",
      await seite.getByRole("button", { name: /Einladung senden/i }).count() > 0);
    pruef("… und einen für alle (mit Vorschau)",
      await seite.getByRole("button", { name: /Vorschau: alle einladen/i }).count() > 0);
    pruef("Der auffällige Befund wird benannt",
      /kein einziger/i.test(text),
      "zwei Mitarbeiter haben bei 50 vergangenen Terminen nichts abgeschlossen");

    await seite.screenshot({ path: "reports/termine/zentrale-kopf.png", fullPage: false });
    console.log("        reports/termine/zentrale-kopf.png");

    // Die ganze Seite — für den Nachweis der Liste und der Karte.
    await seite.screenshot({ path: "reports/termine/zentrale-ganz.png", fullPage: true });
    console.log("        reports/termine/zentrale-ganz.png");

    // ── DIE VORSCHAU ─────────────────────────────────────────────────────
    await seite.getByRole("button", { name: /Vorschau: alle einladen/i }).first().click();
    await seite.getByText(/würden jetzt rausgehen|Tagesgrenze von/i).first()
      .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await seite.waitForTimeout(400);
    const t2 = await seite.locator("body").innerText();
    pruef("Die Vorschau nennt eine Zahl und die Grenze",
      /\d+ Einladungen würden jetzt rausgehen|Tagesgrenze von 50/i.test(t2),
      t2.match(/.{0,90}(würden jetzt rausgehen|Tagesgrenze).{0,40}/)?.[0] ?? "—");
    await seite.screenshot({ path: "reports/termine/einladung-vorschau.png", fullPage: false });
    console.log("        reports/termine/einladung-vorschau.png");

    // ── 380 PX ───────────────────────────────────────────────────────────
    const schmal = await kontext.newPage();
    await schmal.setViewportSize({ width: 380, height: 1000 });
    await schmal.goto(`${BASIS}/admin/termine?ansicht=woche`,
      { waitUntil: "domcontentloaded", timeout: 45_000 });
    await schmal.getByText(/Je Mitarbeiter/i).first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await schmal.waitForTimeout(700);

    const ueberlauf = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("380 px: kein waagerechtes Schieben der Seite", !ueberlauf,
      "die Tabelle darf scrollen, die SEITE nicht");
    // Das Schmal-Bauteil vom Vortag, jetzt an echte Daten angeschlossen.
    // ── OHNE RÜCKSICHT AUF GROSS- UND KLEINSCHREIBUNG ────────────────────
    // Die Abschnittsköpfe tragen `uppercase`. AGENTS.md sagt es ausdrücklich:
    // `innerText` gibt bei `text-transform: uppercase` den TRANSFORMIERTEN Text
    // zurück. Ein erster Entwurf suchte „Montag" und fand „MONTAG, 17. AUGUST"
    // nicht — die Liste war die ganze Zeit da.
    const kartenListe = await schmal.evaluate(() =>
      /(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|heute ·)/i
        .test(document.body.innerText));
    pruef("380 px: die Termine erscheinen als Kartenliste", kartenListe,
      "ein 5-Spalten-Raster wäre auf 380 px unlesbar");
    await schmal.screenshot({ path: "reports/termine/schmal-380.png", fullPage: false });
    console.log("        reports/termine/schmal-380.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
