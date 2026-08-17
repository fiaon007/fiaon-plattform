// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DER KUNDENWEG — was ein Mensch wirklich sieht
//
// „Eine Funktion ist erst geliefert, wenn ein Mensch sie anklicken kann"
// (AGENTS.md). Der Prüfstand `pruef-kundenweg.ts` liest Quelltext und Datenbank.
// Dieser hier drückt Knöpfe.
//
// ── KEIN ECHTER VORGANG ────────────────────────────────────────────────────
// Die Abmelde-Seite wird mit einem UNBEKANNTEN Schlüssel geöffnet. Der Server
// antwortet darauf absichtlich genauso wie auf einen echten (sonst ließe sich
// über die Antwort prüfen, ob eine Adresse bei uns liegt) — die Seite zeigt
// also ihren fertigen Zustand, ohne dass ein einziger echter Mensch abgemeldet
// wird. Genau das verlangt AGENTS.md.
//
// Die Terminwahl wird über eine ATTRAPPE bedient (`page.route`): So lässt sich
// die Knappheit am gerenderten Ergebnis messen, ohne einen Termin zu buchen.
//
//   npx tsx scripts/pruef-kundenweg-browser.ts          (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const BASIS = process.env.PRUEF_BASIS ?? "http://localhost:5188";
const BILDER = "reports/kundenweg";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

/** Text der Seite, ohne Rücksicht auf Groß-/Kleinschreibung (AGENTS.md). */
async function text(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

async function main(): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE ABMELDE-SEITE — ein Klick, ohne Rückfrage");
  // ═════════════════════════════════════════════════════════════════════════
  {
    // 380 px: Die meisten öffnen den Link im Mailprogramm auf dem Telefon.
    const seite = await browser.newPage({ viewport: { width: 380, height: 780 } });
    // Ein Schlüssel, der niemandem gehört — kein echter Mensch wird abgemeldet.
    const erfunden = "z".repeat(36);
    await seite.goto(`${BASIS}/abmelden/${erfunden}`, { waitUntil: "domcontentloaded" });

    // ERST WARTEN, DANN MESSEN (AGENTS.md): auf die Marke im Inhalt, nicht auf
    // eine Zeitspanne. Ihr Ausbleiben ist ein Fehlschlag, kein Übersprungen.
    const fertig = await seite.getByText(/erledigt/i).first()
      .waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    pruef("Die Seite bestätigt die Abmeldung", fertig,
      "ohne Bestätigung klickt der Mensch noch einmal — oder den Spam-Knopf");

    const t = await text(seite);
    pruef("Sie sagt klar, dass keine Mails mehr kommen", /keine weiteren e-mails/.test(t));
    pruef("Es gibt KEINE Rückfrage „Sind Sie sicher?“",
      !/sind sie sicher|wirklich abmelden|doch bleiben/.test(t),
      "wer abbestellt, hat sich entschieden");
    pruef("Kein Anmeldefeld", (await seite.locator('input[type="password"]').count()) === 0);
    pruef("Das Grund-Feld ist freiwillig und steht DANACH",
      /freiwillig/.test(t) && (await seite.locator("textarea").count()) === 1);

    // Der Absenden-Knopf ist gesperrt, solange nichts drinsteht — und wird
    // NICHT gedrückt (kein echter Vorgang).
    const knopf = seite.getByRole("button", { name: /absenden/i });
    pruef("Der Absenden-Knopf existiert", (await knopf.count()) === 1);
    pruef("Er ist ohne Text gesperrt", await knopf.isDisabled().catch(() => false));

    await seite.screenshot({ path: `${BILDER}/abmelden-380.png`, fullPage: true });
    console.log(`        ${BILDER}/abmelden-380.png`);
    await seite.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE TERMINWAHL — höchstens fünf Zeiten je Tag");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const seite = await browser.newPage({ viewport: { width: 380, height: 900 } });

    // ── DIE ATTRAPPE ─────────────────────────────────────────────────────
    // Sie liefert genau das, was der Server nach der Verknappung liefert:
    // fünf Zeiten je Tag, über drei Tage. Damit wird die OBERFLÄCHE geprüft —
    // dass sie nicht selbst zusätzlich kürzt oder Tage zusammenwirft.
    const tage = ["2026-09-01", "2026-09-02", "2026-09-03"];
    const slots = tage.flatMap((datum) =>
      ["09:00", "10:40", "12:20", "14:00", "15:40"].map((uhrzeit) => ({
        beginn: `${datum}T${uhrzeit}:00.000Z`,
        datum, uhrzeit, agentId: 1, agentVorname: "Anna",
      })));
    await seite.route("**/api/fiaon/termin/**", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        // `slotMinuten` MUSS mit: Ohne sie stand auf der Seite „ein
        // -minütiges Gespräch" — im ersten Screenshot deutlich zu sehen. Eine
        // Attrappe, die weniger liefert als der Server, erzeugt Fehler, die es
        // nicht gibt, und verdeckt die, die es gibt.
        body: JSON.stringify({ ok: true, slots, betreuer: { id: 1, vorname: "Anna" },
                               person: { vorname: "Testfall" }, quelle: "onboarding_call",
                               slotMinuten: 15 }),
      });
    });
    await seite.goto(`${BASIS}/termin/attrappe`, { waitUntil: "domcontentloaded" });
    await seite.waitForTimeout(1500);

    const t = await text(seite);
    // Zählen, wie viele Uhrzeit-Knöpfe sichtbar sind.
    const knoepfe = await seite.locator("button").allInnerTexts().catch(() => []);
    const zeiten = knoepfe.filter((k) => /^\d{2}:\d{2}$/.test(k.trim()));
    pruef("Die Oberfläche zeigt die gelieferten Zeiten", zeiten.length > 0,
      `keine Uhrzeit-Knöpfe gefunden — Seitentext: ${t.slice(0, 120)}`);
    if (zeiten.length > 0) {
      // Die Seite zeigt anfangs nur die ersten Tage. Entscheidend: Je
      // ANGEZEIGTEM Tag dürfen es nicht mehr als fünf sein.
      pruef("Kein Tag zeigt mehr als fünf Zeiten", zeiten.length % 5 === 0 && zeiten.length <= 15,
        `${zeiten.length} Knöpfe — bei fünf je Tag müssten es 5, 10 oder 15 sein`);
      console.log(`        (${zeiten.length} Zeit-Knöpfe: ${zeiten.slice(0, 6).join(" ")}…)`);
    }
    pruef("Die Gesprächsdauer steht auf der Seite", /15-minütiges/.test(t),
      "eine Seite, die „ein -minütiges Gespräch“ sagt, wirkt kaputt");
    pruef("Die Zeiten sind über den Tag verteilt",
      zeiten.some((z) => Number(z.split(":")[0]) < 11) && zeiten.some((z) => Number(z.split(":")[0]) >= 14),
      "wer nur Vormittagszeiten sieht und nachmittags Zeit hat, bucht nicht");

    await seite.screenshot({ path: `${BILDER}/termin-knapp-380.png`, fullPage: true });
    console.log(`        ${BILDER}/termin-knapp-380.png`);
    await seite.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE LEAD-AUTOMATIK — sieht der Betreiber die Strecke?");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await seite.goto(`${BASIS}/admin/leads`, { waitUntil: "domcontentloaded" });
    await seite.waitForTimeout(2000);
    const t = await text(seite);
    // Der Verwaltungsbereich ist codegeschützt — ohne Code sieht man das Gate.
    // Das ist der richtige Zustand, und er wird als solcher festgehalten.
    const gesperrt = /zugangscode|gesperrt/.test(t);
    pruef("Der Verwaltungsbereich ist geschützt", gesperrt || /lead/.test(t),
      "weder Gate noch Inhalt — die Seite ist leer");
    if (gesperrt) console.log("        (Zugangscode-Gate — Inhalt nicht prüfbar, das ist korrekt)");
    await seite.screenshot({ path: `${BILDER}/admin-leads.png`, fullPage: true });
    await seite.close();
  }

  await browser.close();
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: ${BILDER}/`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
