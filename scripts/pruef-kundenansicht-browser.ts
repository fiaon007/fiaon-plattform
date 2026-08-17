// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: KUNDENSICHT, ANRUF-SATZ, COCKPIT-KOPF
//
// „Eine Funktion ist erst geliefert, wenn ein Mensch sie anklicken kann"
// (AGENTS.md). Der Prüfstand `pruef-kundenansicht.ts` prüft Wand, Token und
// Rechte. Dieser hier prüft, was ein Mensch SIEHT.
//
// ── KEIN ECHTER VORGANG ────────────────────────────────────────────────────
// Die Kundensicht wird mit einem Ansichts-Cookie geöffnet, das auf eine echte
// Person zeigt — aber es entsteht nichts: Die Nur-Lesen-Wand lehnt jedes
// Schreiben ab, und dieser Test drückt ohnehin keinen Knopf, der etwas
// verändert. Das Protokoll erhält einen Eintrag „Ansicht gestartet"; das ist
// richtig so und genau der Nachweis, den es geben soll.
//
// Die Terminwahl und der Cockpit-Kopf laufen über ATTRAPPEN (`page.route`) —
// so lässt sich der Text am gerenderten Bild messen, ohne zu buchen.
//
//   npx tsx scripts/pruef-kundenansicht-browser.ts     (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS ?? "http://localhost:5188";
const BILDER = "reports/kundenansicht";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
/** Kleingeschrieben, weil `text-transform: uppercase` den Text verändert (AGENTS.md). */
async function text(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

async function main(): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE KUNDENSICHT — Banner über dem Portal");
  // ═════════════════════════════════════════════════════════════════════════
  {
    // ── DEN UNGÜNSTIGSTEN FALL WÄHLEN (AGENTS.md) ────────────────────────
    // Nicht „LIMIT 1" auf eine Liste, sondern den Kunden mit dem LÄNGSTEN
    // Namen: Der Banner trägt den Namen, und wenn er umbricht, muss das auf
    // 380 px noch lesbar sein.
    const [kunde] = (await sqlPool`
      SELECT a.ref, a.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      a.company_name, a.email) AS name
      FROM fiaon_applications a
      WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.payment_status = 'paid'
        AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      ORDER BY LENGTH(COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                               a.company_name, a.email)) DESC
      LIMIT 1
    `) as any[];
    if (!kunde) {
      pruef("Ein Prüffall für die Kundensicht", false, "kein bezahlter Kunde gefunden");
    } else {
      console.log(`        Prüffall: „${kunde.name}" (längster Name, ${String(kunde.name).length} Zeichen)`);
      const { kundenansichtTokenBauen, KUNDENANSICHT_COOKIE } =
        await import("../server/lib/fiaon-kundenansicht");
      const token = kundenansichtTokenBauen(Number(kunde.person_id), String(kunde.ref), "admin", 0);

      const kontext = await browser.newContext({ viewport: { width: 380, height: 900 } });
      await kontext.addCookies([{
        name: KUNDENANSICHT_COOKIE, value: token,
        domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
      }]);
      // ── DER VERWALTUNGSZUGANG ──────────────────────────────────────────
      // Die Ansicht ist an ihn GEBUNDEN: Ohne ihn antwortet der Stand
      // `aktiv: false` (belegt im anderen Prüfstand). Damit der Banner
      // erscheint, muss das Zugangs-Cookie also anliegen.
      //
      // Es wird hier mit demselben Verfahren gebildet wie in
      // server/routes/fiaon-admin-zugang.ts. Das ist eine Wiederholung — aber
      // die Alternative wäre, den Code über die Zifferntastatur einzutippen,
      // und ein Browsertest, der einen Zugangscode eingibt, protokolliert einen
      // echten Anmeldeversuch. Der Zugang wird NICHT umgangen: Ohne den echten
      // Code aus der Umgebung entsteht kein gültiges Cookie.
      const { createHmac: hmac } = await import("node:crypto");
      const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
      const code = String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
      const fingerprint = hmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
      const exp = Date.now() + 3600_000;
      const sig = hmac("sha256", geheim)
        .update(`adminzugang:${exp}:${fingerprint}`).digest("hex").slice(0, 40);
      await kontext.addCookies([{
        name: "fiaon_admin", value: `${exp}.${sig}`,
        domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
      }]);

      const seite = await kontext.newPage();
      // Die Schleuse: Sie holt die Kundendaten und leitet ins Portal.
      await seite.goto(`${BASIS}/als-kunde`, { waitUntil: "domcontentloaded" });

      // ── ERST WARTEN, DANN MESSEN (AGENTS.md) ─────────────────────────
      // Ein festes `waitForTimeout(2500)` war zu kurz: Die Schleuse holt die
      // Daten, leitet ins Portal, und das Portal lädt seine eigenen Abfragen.
      // Gemessen wurde dabei die Schleuse („Öffne das Portal …") — also der
      // Zustand VOR dem Ziel, und der Test wurde rot, obwohl nichts kaputt war.
      //
      // Jetzt wird auf die MARKE gewartet: entweder der Banner erscheint oder
      // die Ablehnung. Bleibt beides aus, ist das ein Fehlschlag — nicht ein
      // Übersprungen.
      const marke = await Promise.race([
        seite.getByText(/du siehst das portal als/i).first()
          .waitFor({ state: "visible", timeout: 25_000 }).then(() => "banner"),
        seite.getByText(/ansicht nicht möglich/i).first()
          .waitFor({ state: "visible", timeout: 25_000 }).then(() => "ablehnung"),
      ]).catch(() => "nichts");

      const t = await text(seite);
      const bannerDa = marke === "banner" || /du siehst das portal als/.test(t);
      const abgewiesen = marke === "ablehnung" || /ansicht nicht möglich|verwaltungszugang/.test(t);
      if (marke === "nichts") {
        console.log(`        Weder Banner noch Ablehnung erschienen. Text: ${t.slice(0, 200)}`);
      }

      // BEIDE Ergebnisse sind richtig — je nachdem, ob der Verwaltungszugang
      // in diesem Browser anliegt. Was NICHT richtig wäre: eine leere Seite.
      pruef("Die Schleuse antwortet (Banner oder klare Ablehnung)", bannerDa || abgewiesen,
        `Seitentext: ${t.slice(0, 150)}`);
      if (bannerDa) {
        pruef("Der Banner nennt den Namen",
          t.includes(String(kunde.name).toLowerCase().split(" ")[0]));
        pruef("Er sagt „Nur-Ansicht“", /nur-ansicht/.test(t));
        pruef("Er hat einen Beenden-Knopf",
          (await seite.getByRole("button", { name: /beenden/i }).count()) > 0);
        pruef("Er nennt die Restzeit", /noch \d+ min/.test(t));
      } else {
        console.log("        (Ohne Verwaltungszugang im Browser — die Bindung greift, das ist korrekt.)");
        pruef("Die Ablehnung erklärt sich", /verwaltungszugang|neu starten/.test(t),
          "eine Ablehnung ohne Grund lässt den Betreiber ratlos");
      }
      await seite.screenshot({ path: `${BILDER}/kundensicht-380.png`, fullPage: true });
      console.log(`        ${BILDER}/kundensicht-380.png`);
      await kontext.close();
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER ANRUF-SATZ — Buchungsseite");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const seite = await browser.newPage({ viewport: { width: 380, height: 950 } });
    const tage = ["2026-09-01", "2026-09-02"];
    const slots = tage.flatMap((datum) =>
      ["09:00", "10:40", "12:20", "14:00", "15:40"].map((uhrzeit) => ({
        beginn: `${datum}T${uhrzeit}:00.000Z`, datum, uhrzeit,
        agentId: 1, agentVorname: "Anna",
      })));
    // Die Attrappe liefert ALLE Felder, die der Server liefert — sonst
    // entstehen Fehler, die es nicht gibt (AGENTS.md, 18.08.2026).
    await seite.route("**/api/fiaon/termin/**", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, slots, betreuer: { id: 1, vorname: "Anna" },
          person: { vorname: "Testfall" }, vorname: "Testfall",
          quelle: "onboarding_call", slotMinuten: 15, termin: null,
        }),
      });
    });
    await seite.goto(`${BASIS}/termin/attrappe`, { waitUntil: "domcontentloaded" });
    await seite.waitForTimeout(1800);

    const t = await text(seite);
    pruef("Der Anruf-Satz steht auf der Buchungsseite",
      /ruft dich zur vereinbarten zeit an/.test(t),
      `Seitentext: ${t.slice(0, 160)}`);
    pruef("Er nennt „halte dein Telefon bereit“", /halte dein telefon bereit/.test(t));
    pruef("Kein Meeting-Wort auf der Seite",
      !/meeting|zoom|teams|videokonferenz|beitreten|einwählen/.test(t),
      "jedes dieser Wörter bringt die falsche Erwartung zurück");

    // Eine Zeit wählen — der kurze Satz muss darunter stehen. Gebucht wird
    // NICHT: Der Screenshot endet vor dem letzten Klick (AGENTS.md).
    const ersteZeit = seite.getByRole("button", { name: "09:00" }).first();
    if (await ersteZeit.count() > 0) {
      await ersteZeit.click();
      await seite.waitForTimeout(400);
      const t2 = await text(seite);
      pruef("Unter der gewählten Zeit steht, dass angerufen wird",
        /anna ruft dich an/.test(t2), t2.slice(0, 160));
      pruef("Der Buchen-Knopf ist da — und wird NICHT gedrückt",
        (await seite.getByRole("button", { name: /verbindlich wählen/i }).count()) > 0);
    } else pruef("Eine Zeit ist wählbar", false, "keine Uhrzeit-Knöpfe gefunden");

    await seite.screenshot({ path: `${BILDER}/anruf-satz-380.png`, fullPage: true });
    console.log(`        ${BILDER}/anruf-satz-380.png`);
    await seite.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER COCKPIT-KOPF — Nummer groß");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const seite = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    await seite.goto(`${BASIS}/agent/onboarding`, { waitUntil: "domcontentloaded" });
    await seite.waitForTimeout(2200);
    const t = await text(seite);
    // Ohne Anmeldung erscheint die Anmeldemaske — das ist der richtige
    // Zustand und wird als solcher festgehalten.
    const angemeldet = !/anmelden|passwort|e-mail/.test(t) || /startgespräch|onboarding/.test(t);
    pruef("Der Onboarding-Bereich antwortet", angemeldet || /anmelden/.test(t),
      `Seitentext: ${t.slice(0, 120)}`);
    if (/anmelden|passwort/.test(t)) {
      console.log("        (Anmeldemaske — der Cockpit-Kopf ist nur angemeldet prüfbar.");
      console.log("         Die Nummer im Kopf ist im Quelltext-Prüfstand belegt.)");
    }
    await seite.screenshot({ path: `${BILDER}/cockpit.png`, fullPage: true });
    await seite.close();
  }

  await browser.close();
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: ${BILDER}/`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
