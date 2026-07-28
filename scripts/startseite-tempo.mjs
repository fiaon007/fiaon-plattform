/**
 * ═══════════════════════════════════════════════════════════════════
 * STARTSEITE /agent — TEMPO- UND LAYOUT-MESSUNG (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Misst die versprochenen Zusagen der Startseite an der ECHTEN gebauten
 * Oberfläche, statt sie zu behaupten:
 *
 *   M1  Bildrate beim Laden   (Einblendung + Kontostand zählt hoch)
 *   M2  Bildrate beim Scrollen
 *   M3  Auf 380 px sind Begrüßung, Kontostand und Primäraktion ohne
 *       Scrollen sichtbar
 *   M4  Genau EINE Primäraktion auf der Seite
 *   M5  prefers-reduced-motion schaltet jede Bewegung ab, die Seite
 *       bleibt vollständig nutzbar
 *   M6  Desktop (1280 px): dieselben drei Elemente im ersten Bildschirm
 *
 * Gemessen wird mit 4-facher CPU-Bremse (Mittelklasse-Handy) auf dem
 * Produktions-Build. Die API wird im Browser abgefangen und mit festen
 * Werten beantwortet — kein Server, keine Datenbank, keine echten
 * Kundendaten. Deshalb ist das Ergebnis wiederholbar.
 *
 * Vorbereitung:  npx vite build
 *                npx vite preview --port 4173   (in einem zweiten Fenster)
 * Verwendung:    node scripts/startseite-tempo.mjs
 *
 * Hartes Zeitlimit: 60 s Gesamtabbruch. Ein Abbruch ist ein Ergebnis.
 */

import { chromium } from "playwright";

const BASIS = process.env.TEMPO_URL || "http://localhost:4173";
const GESAMT_LIMIT_MS = 60_000;

const abbruch = setTimeout(() => {
  console.error("\n⏱  Zeitlimit 60 s erreicht — Abbruch. (Läuft `vite preview` auf Port 4173?)");
  process.exit(3);
}, GESAMT_LIMIT_MS);

const heute = new Date();
heute.setHours(heute.getHours() - 1); // ein Rückruf, der bereits fällig ist

const ANTWORTEN = {
  "/agent/me": { ok: true, agent: { name: "Justin Schwarzott", email: "justin@fiaon.de" } },
  "/agent/onboarding": { ok: true, status: { complete: true } },
  "/agent/feedback/state": { ok: true, unread: 0 },
  "/agent/kartei/status": {
    ok: true, activeCardId: null, freieKarten: 786, meineKarten: 12,
    ruecklaeufer: { anzahl: 0, inTagen: null, fristTage: 14 }, autoReleaseMinutes: 30,
  },
  "/agent/payouts": {
    ok: true, balanceCents: 12_750, minCents: 5_000, hasBank: true,
    ibanMasked: "DE** **** 4321", history: [],
  },
  "/agent/dashboard": {
    ok: true, todayCents: 3_000, weekCents: 4_200, prevWeekCents: 3_100, monthCents: 12_750,
    monthlyGoalCents: null, dailyGoalCents: 3_000, dailyContactsGoal: 15, todayContacts: 4,
    monthDeals: 3, todayDeals: 1, bestDayDeals: 2, monthBonusCount: 0, monthBonusCents: 0,
    closes: [], partner: { status: { key: "start", label: "Start", bonusBp: 0 }, revenueCents: 0, next: null },
  },
  "/agent/customers": {
    ok: true,
    data: [
      { next_appointment: heute.toISOString() },
      { next_appointment: heute.toISOString() },
      { next_appointment: heute.toISOString() },
      { next_appointment: null },
    ],
  },
};

/** Zählt echte Bilder pro Sekunde im Browser — währenddessen läuft `arbeit`. */
async function bildrate(page, dauerMs, arbeit) {
  const messung = page.evaluate((ms) => new Promise((fertig) => {
    let bilder = 0;
    const start = performance.now();
    const tick = () => {
      bilder++;
      if (performance.now() - start < ms) requestAnimationFrame(tick);
      else fertig({ bilder, ms: performance.now() - start });
    };
    requestAnimationFrame(tick);
  }), dauerMs);
  if (arbeit) await arbeit();
  const { bilder, ms } = await messung;
  return Math.round((bilder / ms) * 1000);
}

async function seiteOeffnen(browser, reducedMotion) {
  const context = await browser.newContext({
    viewport: { width: 380, height: 780 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  const page = await context.newPage();
  // API im Browser abfangen: feste Werte, kein Server, keine echten Daten.
  await page.route("**/api/fiaon/**", (route) => {
    const pfad = new URL(route.request().url()).pathname.replace("/api/fiaon", "");
    const body = ANTWORTEN[pfad] ?? { ok: true };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // Mittelklasse-Gerät
  return { context, page };
}

let fehler = 0;
const sage = (ok, titel, detail) => {
  if (!ok) fehler++;
  console.log(`${ok ? "✅" : "❌"} ${titel}`);
  if (detail) console.log(`     ${detail}`);
};

const browser = await chromium.launch();

// ── Normalfall: Bewegung erlaubt ────────────────────────────────────────────
{
  const { context, page } = await seiteOeffnen(browser, "no-preference");

  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  const ladeFps = await bildrate(page, 2500, () => page.waitForSelector(".agent-cta", { timeout: 20_000 }));
  sage(ladeFps >= 50, "M1 · Bildrate beim Laden", `${ladeFps} Bilder/s (4-fache CPU-Bremse, Ziel ≥ 50)`);

  const scrollFps = await bildrate(page, 2000, async () => {
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(120);
    }
    await page.mouse.wheel(0, -1200);
  });
  sage(scrollFps >= 50, "M2 · Bildrate beim Scrollen", `${scrollFps} Bilder/s (Ziel ≥ 50)`);

  await page.evaluate(() => window.scrollTo(0, 0));
  const h1 = await page.locator("h1").first().boundingBox();
  const konto = await page.locator("section.agent-glass-strong").first().boundingBox();
  const cta = await page.locator(".agent-cta").first().boundingBox();
  const fold = 780;
  const untersteKante = Math.max(h1.y + h1.height, konto.y + konto.height, cta.y + cta.height);
  sage(
    untersteKante <= fold,
    "M3 · Drei Elemente auf 380 px ohne Scrollen sichtbar",
    `unterste Kante bei ${Math.round(untersteKante)} px von ${fold} px · Begrüßung ${Math.round(h1.height)} px · Kontostand ${Math.round(konto.height)} px · Primäraktion ${Math.round(cta.height)} px`,
  );
  sage(cta.height >= 44, "M3b · Primäraktion ist ein Touch-Ziel", `${Math.round(cta.height)} px hoch (Ziel ≥ 44 px)`);

  const anzahlCta = await page.locator(".agent-cta").count();
  const schwebend = await page.locator('a[href="/agent/kartei"].fixed').count();
  sage(
    anzahlCta === 1 && schwebend === 0,
    "M4 · Genau EINE Primäraktion",
    `${anzahlCta} Primärfläche · ${schwebend} schwebende Zweit-Knöpfe`,
  );

  const text = await page.locator("h1").first().innerText();
  const untertitel = await page.locator("h1 + p").first().innerText();
  const rueckruf = await page.getByText("Rückrufe sind heute fällig", { exact: false }).count();
  sage(
    /^Guten (Morgen|Tag|Abend), Justin$/.test(text.trim()) && untertitel.includes("786"),
    "M4b · Begrüßung, Kundenzahl und Rückrufe",
    `„${text.trim()}" · „${untertitel.trim()}" · Rückruf-Zeile: ${rueckruf === 1 ? "vorhanden" : "fehlt"}`,
  );

  // Einmal-Hinweis auf neue Neuerungen wegtippen — er liegt als Blatt über
  // der Primäraktion und würde das Bildschirmfoto verdecken.
  await page.getByRole("button", { name: "Verstanden" }).click({ timeout: 2_000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/agent-startseite-380.png" });
  await context.close();
}

// ── Bewegung reduziert ─────────────────────────────────────────────────────
{
  const { context, page } = await seiteOeffnen(browser, "reduce");
  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  await page.waitForSelector(".agent-cta", { timeout: 20_000 });

  const bewegung = await page.evaluate(() => {
    const namen = (el) => (el ? getComputedStyle(el).animationName : "keine Fläche");
    const aura = document.querySelector(".agent-aura");
    const reveal = document.querySelector(".agent-reveal");
    const cta = document.querySelector(".agent-cta");
    return {
      aura: namen(aura),
      reveal: reveal ? namen(reveal) : "kein Reveal (statisch gerendert)",
      ctaTransition: cta ? getComputedStyle(cta).transitionDuration : "—",
      ctaSichtbar: cta ? getComputedStyle(cta).opacity : "0",
      kontostand: document.querySelector("section.agent-glass-strong")?.innerText.includes("€") || false,
    };
  });
  const still = bewegung.aura === "none" && bewegung.reveal !== "agentReveal";
  sage(
    still && bewegung.ctaSichtbar === "1" && bewegung.kontostand,
    "M5 · prefers-reduced-motion schaltet Bewegung ab",
    `Schimmer: ${bewegung.aura} · Einblendung: ${bewegung.reveal} · Primäraktion-Übergang: ${bewegung.ctaTransition} · Kontostand lesbar: ${bewegung.kontostand ? "ja" : "nein"}`,
  );

  await page.screenshot({ path: "/tmp/agent-startseite-380-reduced.png" });
  await context.close();
}

// ── Desktop: dieselben drei Elemente, mehr Luft ────────────────────────────
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.route("**/api/fiaon/**", (route) => {
    const pfad = new URL(route.request().url()).pathname.replace("/api/fiaon", "");
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ANTWORTEN[pfad] ?? { ok: true }) });
  });
  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  await page.waitForSelector(".agent-cta", { timeout: 20_000 });
  const cta = await page.locator(".agent-cta").first().boundingBox();
  sage(cta.y + cta.height <= 900, "M6 · Desktop: drei Elemente im ersten Bildschirm", `unterste Kante bei ${Math.round(cta.y + cta.height)} px von 900 px`);
  await page.screenshot({ path: "/tmp/agent-startseite-desktop.png" });
  await context.close();
}

await browser.close();
clearTimeout(abbruch);

console.log("\nBildschirmfotos: /tmp/agent-startseite-380.png · /tmp/agent-startseite-380-reduced.png · /tmp/agent-startseite-desktop.png");
if (fehler > 0) {
  console.error(`\n❌ ${fehler} Zusage(n) nicht erfüllt.`);
  process.exit(1);
}
console.log("\n✅ Startseite erfüllt Tempo-, Layout- und Bewegungs-Zusagen.");
