// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DIE BUCHUNGSSEITE AUS KUNDENSICHT
//
// ── DIE MELDUNG (Herr Hertel, telefonisch, 19.08.2026) ─────────────────────
// Ein Kunde kann im Startgespräch-Kalender keine Zeit auswählen.
//
// ── WARUM AUS KUNDENSICHT UND NICHT AUS DER VERWALTUNG ────────────────────
// Der Fehler war NICHT, dass keine Zeiten da waren — es gab 55. Er lag zwischen
// Anzeige und Buchung: Die Seite bot Zeiten von Vertriebsleuten an, die Buchung
// wies sie ab (`falsche_rolle`, 38 Mal bei Herrn Hertel). Das sieht man nur,
// wenn man die Seite so öffnet wie er: mit seinem Token, ohne Anmeldung.
//
// ── UND ES ENTSTEHT KEIN TERMIN ────────────────────────────────────────────
// Die Buchungsroute ist abgefangen (AGENTS.md, 06.08.2026: „Ein Browser-Test
// erzeugt NIE eine echte Buchung"). Was NICHT abgefangen wird: das LADEN der
// Zeiten. Genau das ist der Prüfgegenstand.
//
// Der Token gehört einem ECHTEN wartenden Kunden — lesend ist das unbedenklich,
// und nur so stimmen die Slots.
//
//   npx tsx scripts/pruef-terminseite-kunde.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

/** Die Buchung abfangen — sie würde einen echten Termin anlegen. */
async function attrappen(seite: Page, antwort: "ok" | "belegt" = "ok"): Promise<void> {
  await seite.route("**/api/fiaon/termin/*/buchen", async (r) => {
    if (antwort === "belegt") {
      // Die verständliche Ablehnung prüfen — genau der Text, den die Route
      // seit dem 30.08.2026 liefert.
      await r.fulfill({
        status: 409, contentType: "application/json",
        body: JSON.stringify({
          ok: false, grund: "nicht_angeboten",
          error: "Dieser Termin wurde gerade vergeben — bitte wähle einen anderen. "
            + "Es stehen noch 54 Zeiten zur Auswahl.",
        }),
      });
      return;
    }
    await r.fulfill({
      status: 200, contentType: "application/json",
      // Alle Felder, die die Seite liest (AGENTS.md, 18.08.2026).
      body: JSON.stringify({
        ok: true,
        termin: {
          datumText: "Donnerstag, 20. August", uhrzeit: "09:00",
          agentVorname: "Angelique", stornoToken: "PRUEFSTAND-KEIN-ECHTER-TOKEN",
        },
      }),
    });
  });
}

async function main(): Promise<void> {
  mkdirSync("reports/terminseite", { recursive: true });

  // ── EIN ECHTER WARTENDER KUNDE ─────────────────────────────────────────
  const [kunde] = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          p.company_name, p.person_ref) AS name
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
      AND a.payment_status = 'paid'
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id)
    ORDER BY a.paid_at ASC NULLS LAST LIMIT 1
  `) as any[];
  if (!kunde) { console.log("Kein wartender Kunde gefunden."); await sqlPool.end(); return; }

  const { terminTokenErzeugen } = await import("../server/lib/fiaon-termine");
  const token = terminTokenErzeugen(Number(kunde.id));
  console.log(`  Kunde: Person ${kunde.id} — ${kunde.name}`);

  const browser = await chromium.launch();
  try {
    // ═══════════════════════════════════════════════════════════════════════
    titel("1. DESKTOP — sieht der Kunde Zeiten?");
    // ═══════════════════════════════════════════════════════════════════════
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const seite = await kontext.newPage();
    await attrappen(seite);
    await seite.goto(`${BASIS}/termin/${token}?art=start`,
      { waitUntil: "domcontentloaded", timeout: 45_000 });

    // ── AUF DEN INHALT WARTEN, NICHT AUF DAS GERÜST ─────────────────────
    // GEMESSEN im ersten Lauf: Der Prüfstand wartete auf das Wort „Zeiten" —
    // das steht schon im Ladehinweis („Freie Zeiten werden geladen …"). Er
    // maß also einen Zustand, in dem noch nichts da sein KONNTE, und meldete
    // vier rote Prüfungen an einer Seite, die eine Sekunde später richtig war.
    // AGENTS.md: „Erst warten, dann messen."
    //
    // Gewartet wird jetzt auf einen ZEIT-KNOPF — die Marke, dass die Antwort da
    // und gezeichnet ist. Ihr Ausbleiben ist ein Fehlschlag, kein Übersprungen.
    const zeitKnoepfe = seite.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ });
    const geladen = await zeitKnoepfe.first()
      .waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
    pruef("Die Seite lädt und zeigt Zeiten", geladen,
      "bei 0 sieht der Kunde einen leeren Kalender — genau die Meldung");
    const anzahl = await zeitKnoepfe.count();
    pruef("Es werden Zeiten angeboten", anzahl > 0,
      `${anzahl} Zeit-Knöpfe — bei 0 sieht der Kunde einen leeren Kalender`);
    console.log(`        ${anzahl} wählbare Zeiten sichtbar`);

    // ── DIE TERMINART: 15 MINUTEN, NICHT 20 ─────────────────────────────
    // Der Link trägt `?art=start`. Wurde er gelesen, steht dort das
    // Startgespräch (15 Minuten) und ein Mensch mit Onboarding-Rolle.
    const kopf = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Der Link wird als STARTGESPRÄCH gelesen (15 Minuten)",
      /15-min|15 min/.test(kopf),
      kopf.replace(/\s+/g, " ").slice(0, 180)
      + " — bei „20-minütig“ wurde ?art=start ignoriert");
    await seite.screenshot({ path: "reports/terminseite/1-desktop.png", fullPage: false });
    console.log("        reports/terminseite/1-desktop.png");

    if (anzahl > 0) {
      // ── EINE ZEIT WÄHLEN ─────────────────────────────────────────────
      await zeitKnoepfe.first().click();
      await seite.waitForTimeout(600);
      const bestaetigen = seite.getByRole("button", { name: /verbindlich wählen|Termin/i }).first();
      const kam = await bestaetigen.waitFor({ state: "visible", timeout: 8000 })
        .then(() => true).catch(() => false);
      pruef("Eine Zeit lässt sich auswählen", kam,
        "der Bestätigungsknopf erscheint erst nach der Wahl");
      await seite.screenshot({ path: "reports/terminseite/2-gewaehlt.png" });
      console.log("        reports/terminseite/2-gewaehlt.png");

      if (kam) {
        await bestaetigen.click();
        await seite.waitForTimeout(2000);
        const t = (await seite.locator("body").innerText()).toLowerCase();
        pruef("Nach dem Bestätigen steht die Bestätigung da",
          /steht|gebucht|donnerstag|09:00/i.test(t), t.slice(0, 200));
        await seite.screenshot({ path: "reports/terminseite/3-gebucht.png" });
        console.log("        reports/terminseite/3-gebucht.png");
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("2. DER FEHLSCHLAG — nennt er den Grund und einen Weg?");
    // ═══════════════════════════════════════════════════════════════════════
    const k2 = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const s2 = await k2.newPage();
    await attrappen(s2, "belegt");
    await s2.goto(`${BASIS}/termin/${token}?art=start`,
      { waitUntil: "domcontentloaded", timeout: 45_000 });
    const z2 = s2.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ });
    await z2.first().waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
    if (await z2.count() > 0) {
      await z2.first().click();
      await s2.waitForTimeout(500);
      await s2.getByRole("button", { name: /verbindlich wählen|Termin/i }).first()
        .click().catch(() => {});
      // Warten, bis die Liste NACH dem Nachladen wieder steht — sonst misst der
      // Test den Ladezustand und meldet eine leere Seite (AGENTS.md).
      await s2.getByRole("alert").first()
        .waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      await s2.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first()
        .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
      const t2 = (await s2.locator("body").innerText()).toLowerCase();
      pruef("Der Grund steht im Klartext da",
        /vergeben|nicht mehr frei|wähle einen anderen/i.test(t2),
        t2.slice(0, 220));
      pruef("… und es werden Alternativen genannt",
        /\d+ zeiten|andere|auswahl/i.test(t2), t2.slice(0, 220));
      const nochDa = await s2.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).count();
      pruef("… und die Zeiten stehen weiter zur Wahl", nochDa > 0,
        `${nochDa} Zeiten — nach einem Fehlschlag darf die Seite nicht leer sein`);
      await s2.screenshot({ path: "reports/terminseite/4-fehlschlag.png" });
      console.log("        reports/terminseite/4-fehlschlag.png");
    } else {
      pruef("Für den Fehlschlag-Fall gibt es Zeiten", false, "keine Zeiten zum Anklicken");
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("3. 380 PIXEL — auf dem Telefon");
    // ═══════════════════════════════════════════════════════════════════════
    const k3 = await browser.newContext({
      viewport: { width: 380, height: 820 }, isMobile: true, hasTouch: true,
    });
    const s3 = await k3.newPage();
    await attrappen(s3);
    await s3.goto(`${BASIS}/termin/${token}?art=start`,
      { waitUntil: "domcontentloaded", timeout: 45_000 });
    await s3.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).first()
      .waitFor({ state: "visible", timeout: 25_000 }).catch(() => {});
    const z3 = await s3.locator("button").filter({ hasText: /^\d{1,2}:\d{2}$/ }).count();
    pruef("Auch auf 380 px werden Zeiten angeboten", z3 > 0, `${z3} Zeiten`);
    const ueberlauf = await s3.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("Kein waagerechtes Schieben", !ueberlauf,
      "auf dem Telefon liest niemand seitwärts");
    // Die Knöpfe müssen mit dem Daumen treffbar sein.
    const hoehen = await s3.evaluate(() =>
      Array.from(document.querySelectorAll("button"))
        .filter((b) => /^\d{1,2}:\d{2}$/.test((b.textContent || "").trim()))
        .map((b) => Math.round(b.getBoundingClientRect().height)));
    pruef("Die Zeit-Knöpfe sind mindestens 44 px hoch",
      hoehen.length > 0 && hoehen.every((h) => h >= 44),
      `Höhen: ${hoehen.slice(0, 6).join(", ")}`);
    await s3.screenshot({ path: "reports/terminseite/5-schmal-380.png", fullPage: false });
    console.log("        reports/terminseite/5-schmal-380.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/terminseite/`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => { console.error(e); await sqlPool.end().catch(() => {}); process.exit(1); });
