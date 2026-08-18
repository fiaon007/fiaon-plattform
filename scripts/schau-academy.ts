// ═══════════════════════════════════════════════════════════════════════════
// DER BROWSERTEST DER ACADEMY
//
// Reise durchblättern, Präsentationsmodus, 380 px — und die Screenshots werden
// ANGESEHEN, nicht nur erzeugt.
//
// Die Mail-Vorschauen werden abgefangen: Sie fragen Brevo, und ein Beweislauf
// soll keine fremde API belasten. Die Attrappe liefert dieselben Felder wie die
// echte Route (`ok`, `betreff`, `html`, `absender`).
//
//   npx tsx scripts/schau-academy.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { createHmac } from "node:crypto";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

function adminCookie(): string {
  const g = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  const fp = createHmac("sha256", g)
    .update(`admincode:${process.env.ADMIN_ACCESS_CODE || "20032017"}`)
    .digest("hex").slice(0, 16);
  const e = String(Date.now() + 3_600_000);
  return `${e}.${createHmac("sha256", g).update(`adminzugang:${e}:${fp}`).digest("hex").slice(0, 40)}`;
}

async function main(): Promise<void> {
  mkdirSync("reports/academy", { recursive: true });
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await kontext.addCookies([{
    name: "fiaon_admin", value: adminCookie(),
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    const seite = await kontext.newPage();
    // Die Brevo-Vorschau abfangen — mit ALLEN Feldern, die die Oberfläche liest.
    await seite.route("**/admin/mail/vorschau/**", async (r) => {
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          ok: true, absender: "FIAON <service@fiaon.de>",
          betreff: "Ihre Zahlungsdaten für FIAON",
          html: "<p style='font-family:sans-serif;padding:16px'>Guten Tag,<br>"
            + "hier sind Ihre Zahlungsdaten. Verwendungszweck: FIAONXXXXXX</p>",
        }),
      });
    });

    // ═══════════════════════════════════════════════════════════════════════
    titel("DIE BÜHNE");
    // ═══════════════════════════════════════════════════════════════════════
    await seite.goto(`${BASIS}/admin/schulung`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const karten = seite.locator('[data-fiaon="reise-karte"]');
    await karten.first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    pruef("Drei Reise-Karten sind da", await karten.count() === 3,
      `${await karten.count()}`);
    const t = (await seite.locator("body").innerText()).toLowerCase();
    for (const n of ["vertrieb", "onboarding", "forderungsmanagement"]) {
      pruef(`Die Reise „${n}“ steht auf der Bühne`, t.includes(n));
    }
    pruef("Dauer und Kapitelzahl stehen dabei", /~\d+ min · \d+ kapitel/.test(t),
      t.match(/~\d+ min · \d+ kapitel/)?.[0] ?? "—");
    pruef("Und der Hinweis, dass kein Ton läuft", t.includes("kein ton, kein autoplay"));
    await seite.screenshot({ path: "reports/academy/buehne.png", fullPage: false });
    console.log("        reports/academy/buehne.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("DIE REISE — durchblättern");
    // ═══════════════════════════════════════════════════════════════════════
    await karten.nth(1).click();   // Onboarding, die wichtigste
    await seite.waitForURL(/\/admin\/schulung\/onboarding/, { timeout: 15_000 }).catch(() => {});
    await seite.locator('[data-fiaon="kapitel"]').first()
      .waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    // ── DIE ZAHL KOMMT AUS DEN DATEN ─────────────────────────────────────
    // Ein erster Entwurf schrieb „15" hinein. Mit dem Abschluss-Kapitel wurden
    // es 16, und drei Prüfungen wurden rot, obwohl alles stimmte. Eine
    // Prüfung, die eine Zahl abschreibt, wird bei jeder Erweiterung rot.
    const { reise: reiseDaten } = await import("../shared/fiaon-academy");
    const soll = reiseDaten("onboarding")!.kapitel.length;
    const kapitel = seite.locator('[data-fiaon="kapitel"]');
    pruef(`Die Onboarding-Reise hat ${soll} Kapitel`, await kapitel.count() === soll,
      `${await kapitel.count()} von ${soll}`);
    const t2 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Die Fortschrittsleiste zählt", t2.includes(`kapitel 1 / ${soll}`),
      t2.match(/kapitel \d+ \/ \d+/)?.[0] ?? "—");
    pruef("Die Rolle steht am Kapitel", t2.includes("die automatik") || t2.includes("der kunde"));
    pruef("Die sieben Agenda-Schritte sind da",
      t2.includes("schritt 1 von 7") && t2.includes("schritt 7 von 7"));
    pruef("… inklusive der Abo-Klarheit", t2.includes("abo-klarheit"));

    // ── DIE PFEILTASTE BLÄTTERT ──────────────────────────────────────────
    await seite.keyboard.press("ArrowDown");
    await seite.waitForTimeout(900);
    const t3 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Die Pfeiltaste blättert weiter",
      new RegExp(`kapitel [2-9] / ${soll}`).test(t3),
      t3.match(/kapitel \d+ \/ \d+/)?.[0] ?? "—");

    // ── „WARUM DIESER SCHRITT“ KLAPPT AUF ────────────────────────────────
    const warum = seite.getByRole("button", { name: /Warum dieser Schritt\?/i }).first();
    pruef("Es gibt „Warum dieser Schritt?“", await warum.count() > 0);
    if (await warum.count() > 0) {
      await warum.click();
      await seite.waitForTimeout(350);
      pruef("… und es klappt auf",
        await seite.getByRole("button", { name: /zuklappen/i }).count() > 0);
    }

    // ── DIE MAIL-VORSCHAU ────────────────────────────────────────────────
    // Zum Kapitel mit Mail springen: „Der Kunde hat bezahlt" ist das erste.
    await seite.evaluate(() => {
      document.getElementById("kapitel-erinnerung")?.scrollIntoView({ block: "start" });
    });
    await seite.waitForTimeout(1400);
    const t4 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Ein Mail-Kapitel zeigt „Diese Mail geht raus“", t4.includes("diese mail geht raus"));
    pruef("… mit Absender und Betreff",
      t4.includes("fiaon <service@fiaon.de>") && t4.includes("ihre zahlungsdaten"),
      "die Attrappe liefert dieselben Felder wie die echte Route");
    pruef("… und der Rumpf steht in einem eigenen Rahmen",
      await seite.locator("iframe[srcdoc], iframe[title^='Vorschau']").count() > 0);

    // ── PARALLAX UND ZÄHLENDE ZAHLEN ─────────────────────────────────────
    const parallax = await seite.evaluate(() => {
      const el = document.querySelector(".fi-academy-parallax");
      if (!el) return { da: false, stufen: [] as string[] };
      const stufen = Array.from(el.children).slice(0, 5)
        .map((c) => getComputedStyle(c).animationDelay);
      return { da: true, stufen };
    });
    pruef("Der Kapitel-Eintritt ist versetzt", parallax.da
      && new Set(parallax.stufen).size >= 3,
      parallax.stufen.join(", ") || "kein Parallax-Behälter");
    // Die Zahl steht am Ende auf ihrem Endwert — der Weg dorthin ist Zierde,
    // das ERGEBNIS ist die Zusage.
    const zahlText = await seite.locator("text=/verpasst/").first().innerText()
      .catch(() => "");
    pruef("Die belegende Zahl steht am Ende richtig da",
      /43/.test(zahlText), zahlText.slice(0, 70) || "keine Zahl gefunden");

    await seite.screenshot({ path: "reports/academy/kapitel.png", fullPage: false });
    console.log("        reports/academy/kapitel.png");

    // ── DER PRÄSENTATIONSMODUS ───────────────────────────────────────────
    const knopf = seite.locator('[data-fiaon="praesentieren"]');
    pruef("Es gibt den Knopf „Präsentieren“", await knopf.count() > 0);
    await knopf.click();
    await seite.waitForTimeout(700);
    pruef("… und er schaltet um",
      /präsentation beenden/i.test(await seite.locator("body").innerText()));
    // ── DAS ECHTE VOLLBILD: DIE HÜLLE IST WEG ────────────────────────────
    const huelleWeg = await seite.evaluate(() => {
      const wurzel = document.documentElement;
      const hatKlasse = wurzel.classList.contains("fi-academy-vollbild");
      // Sichtbarkeit prüfen, nicht nur die Klasse: `display: none` ist die
      // Zusage, und nur eine gemessene Höhe von 0 beweist sie.
      const seiten = Array.from(document.querySelectorAll("aside, header"));
      const sichtbar = seiten.filter((e) => (e as HTMLElement).offsetHeight > 0).length;
      return { hatKlasse, sichtbar, seiten: seiten.length };
    });
    pruef("Vollbild: die Klasse sitzt am <html>", huelleWeg.hatKlasse);
    pruef("Vollbild: Navigation und Kopfleiste sind WEG",
      huelleWeg.sichtbar === 0,
      `${huelleWeg.sichtbar} von ${huelleWeg.seiten} noch sichtbar — nicht überdeckt, weg`);
    const breiteVoll = await seite.evaluate(() => {
      const el = document.querySelector('[data-fiaon="academy-reise"]') as HTMLElement | null;
      return el ? Math.round(el.getBoundingClientRect().width) : 0;
    });
    pruef("Vollbild: die Bühne nimmt die ganze Breite",
      breiteVoll >= 1400, `${breiteVoll} px von 1440`);
    await seite.screenshot({ path: "reports/academy/praesentation.png", fullPage: false });
    console.log("        reports/academy/praesentation.png");
    await seite.keyboard.press("Escape");
    await seite.waitForTimeout(500);
    // Nach Esc muss die Hülle zurück sein — sonst bleibt die Verwaltung
    // unsichtbar, und der Betreiber hält die Seite für kaputt.
    const huelleZurueck = await seite.evaluate(() =>
      !document.documentElement.classList.contains("fi-academy-vollbild")
      && Array.from(document.querySelectorAll("aside, header"))
           .some((e) => (e as HTMLElement).offsetHeight > 0));
    pruef("Nach Esc ist die Verwaltung wieder da", huelleZurueck);
    pruef("Esc beendet ihn",
      /präsentieren/i.test(await seite.locator("body").innerText())
        && !/präsentation beenden/i.test(await seite.locator("body").innerText()));

    // ═══════════════════════════════════════════════════════════════════════
    titel("380 PX");
    // ═══════════════════════════════════════════════════════════════════════
    const schmal = await kontext.newPage();
    await schmal.setViewportSize({ width: 380, height: 900 });
    await schmal.route("**/admin/mail/vorschau/**", async (r) => {
      await r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, absender: "FIAON", betreff: "Probe", html: "<p>Probe</p>" }) });
    });
    await schmal.goto(`${BASIS}/admin/schulung`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await schmal.locator('[data-fiaon="reise-karte"]').first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    pruef("380 px: die Karten sind da",
      await schmal.locator('[data-fiaon="reise-karte"]').count() === 3);
    const ueberlauf = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("380 px: kein waagerechtes Schieben", !ueberlauf);
    const knopfKasten = await schmal.locator('[data-fiaon="reise-karte"]').first().boundingBox();
    pruef("380 px: die Karte nimmt die Breite", (knopfKasten?.width ?? 0) > 300,
      `${Math.round(knopfKasten?.width ?? 0)} px`);
    await schmal.screenshot({ path: "reports/academy/schmal-buehne.png", fullPage: false });

    await schmal.goto(`${BASIS}/admin/schulung/vertrieb`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await schmal.locator('[data-fiaon="kapitel"]').first()
      .waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
    await schmal.waitForTimeout(600);
    const ueberlauf2 = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("380 px: auch die Reise schiebt nicht", !ueberlauf2);
    const punkte = await schmal.locator(".fi-academy-punkte").isVisible().catch(() => false);
    pruef("380 px: die Kapitel-Punkte sind weg", !punkte,
      "sie würden Text überdecken");
    await schmal.screenshot({ path: "reports/academy/schmal-reise.png", fullPage: false });
    console.log("        reports/academy/schmal-buehne.png, schmal-reise.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("REDUCED MOTION");
    // ═══════════════════════════════════════════════════════════════════════
    const ruhig = await kontext.newPage();
    await ruhig.emulateMedia({ reducedMotion: "reduce" });
    await ruhig.goto(`${BASIS}/admin/schulung`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ruhig.locator('[data-fiaon="reise-karte"]').first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    await ruhig.waitForTimeout(500);
    const bewegt = await ruhig.evaluate(() => {
      const alle = Array.from(document.querySelectorAll('[data-fiaon="academy-start"] *'));
      return alle.filter((e) => {
        const s = getComputedStyle(e);
        return s.animationName !== "none" && s.animationDuration !== "0s";
      }).length;
    });
    pruef("Bei reduced-motion läuft KEINE Animation", bewegt === 0,
      `${bewegt} Elemente animieren noch`);
    pruef("… und die Karten sind trotzdem sichtbar",
      await ruhig.locator('[data-fiaon="reise-karte"]').first().isVisible(),
      "harte Schnitte heißt sichtbar, nicht unsichtbar");
    await ruhig.screenshot({ path: "reports/academy/reduced-motion.png", fullPage: false });
    console.log("        reports/academy/reduced-motion.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  process.exit(rot > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
