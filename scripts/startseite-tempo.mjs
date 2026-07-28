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
 *   M6  Desktop (1280 px): erste Elemente im ersten Bildschirm, Fläche genutzt
 *   M7  Begrüßung zu FESTGESETZTEN Uhrzeiten (Regression zum 09:30-„Abend")
 *   M8  Bestands-Segmente: Zahlen, Filter-Verlinkung, leerer Zustand
 *   M9  Menü-Zähler: aussen = Summe innen, in mehreren Zuständen
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

const ABSCHLUESSE = [
  { id: 91, ref: "FIAON-A1", pack_name: "Premium", amount_cents: 4_500, kind: "own", status: "bestaetigt", is_bonus: false, created_at: "2026-07-27T09:00:00Z", first_name: "Marina", last_name: "Kellner", contact_name: null, company_name: null },
  { id: 90, ref: "FIAON-A2", pack_name: "Bonitätsauszug", amount_cents: 2_200, kind: "own", status: "bestaetigt", is_bonus: false, created_at: "2026-07-26T09:00:00Z", first_name: null, last_name: null, contact_name: null, company_name: "Nordlicht GmbH" },
  { id: 89, ref: "FIAON-A3", pack_name: "Starter", amount_cents: 800, kind: "own", status: "bestaetigt", is_bonus: false, created_at: "2026-07-25T09:00:00Z", first_name: "Tobias", last_name: "Reh", contact_name: null, company_name: null },
  // Bonus: darf in „Zuletzt abgeschlossen" NICHT auftauchen — kein Verkauf.
  { id: 88, ref: "FIAON-A4", pack_name: null, amount_cents: 1_500, kind: "feedback_bonus", status: "bestaetigt", is_bonus: true, created_at: "2026-07-24T09:00:00Z", first_name: null, last_name: null, contact_name: null, company_name: null },
];

/** Grundzustand der API-Antworten; einzelne Pfade werden pro Prüfung überschrieben. */
const STUB = {
  "/agent/me": { ok: true, agent: { name: "Justin Schwarzott", email: "justin@fiaon.de" } },
  "/agent/onboarding": { ok: true, status: { complete: true } },
  "/agent/feedback/state": { ok: true, unread: 0 },
  "/agent/kartei/status": {
    ok: true, activeCardId: null, freieKarten: 786, meineKarten: 12,
    ruecklaeufer: { anzahl: 0, inTagen: null, fristTage: 14 }, autoReleaseMinutes: 30,
  },
  "/agent/kartei/segmente": { ok: true, betreuung: 9, angekuendigt: 4, abgeschlossen: 27 },
  "/agent/payouts": {
    ok: true, balanceCents: 12_750, minCents: 5_000, hasBank: true,
    ibanMasked: "DE** **** 4321", history: [],
  },
  "/agent/dashboard": {
    ok: true, todayCents: 3_000, weekCents: 4_200, prevWeekCents: 3_100, monthCents: 12_750,
    monthlyGoalCents: null, monthDeals: 3, todayDeals: 1, bestDayDeals: 2,
    monthBonusCount: 1, monthBonusCents: 1_500,
    closes: ABSCHLUESSE, partner: { status: { key: "start", label: "Start", bonusBp: 0 }, revenueCents: 0, next: null },
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

/**
 * Bildzähler, der AB DOKUMENTSTART mitläuft. Wichtig: Wird die Messung erst
 * nach `goto` gestartet, kann sie in den alten Ausführungskontext fallen und
 * zählt dann null Bilder — ein Messfehler, kein Ruckeln.
 */
const LADE_ZAEHLER = () => {
  window.__bilder = 0;
  window.__start = performance.now();
  const tick = () => { window.__bilder++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

/** Bildrate der Ladephase (Dokumentstart bis jetzt). */
async function ladeBildrate(page) {
  const { bilder, ms } = await page.evaluate(() => ({
    bilder: window.__bilder || 0,
    ms: performance.now() - (window.__start || performance.now()),
  }));
  return ms > 0 ? Math.round((bilder / ms) * 1000) : 0;
}

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

/**
 * Ein frischer Browser-Zustand je Prüfung.
 *  - `daten`      überschreibt einzelne API-Antworten
 *  - `zeitpunkt`  setzt eine FESTE Uhrzeit im Browser (Date), Timer laufen weiter
 */
async function seiteOeffnen(browser, {
  reducedMotion = "no-preference",
  viewport = { width: 380, height: 780 },
  mobil = true,
  daten = {},
  zeitpunkt = null,
  bremse = 4,
} = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobil ? 2 : 1,
    isMobile: mobil,
    hasTouch: mobil,
    reducedMotion,
  });
  if (zeitpunkt) await context.clock.setFixedTime(zeitpunkt);
  await context.addInitScript(LADE_ZAEHLER);
  const page = await context.newPage();
  const antworten = { ...STUB, ...daten };
  // API im Browser abfangen: feste Werte, kein Server, keine echten Daten.
  await page.route("**/api/fiaon/**", (route) => {
    const pfad = new URL(route.request().url()).pathname.replace("/api/fiaon", "");
    const body = antworten[pfad] ?? { ok: true };
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: bremse }); // Mittelklasse-Gerät
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
  const { context, page } = await seiteOeffnen(browser);

  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  await page.waitForSelector(".agent-tile", { timeout: 20_000 });
  await page.waitForTimeout(1_500); // Einblendung + Kontostand zählt hoch
  const ladeFps = await ladeBildrate(page);
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
    /^(Guten (Morgen|Tag|Abend)|Hallo), Justin$/.test(text.trim()) && untertitel.includes("786"),
    "M4b · Begrüßung, Kundenzahl und Rückrufe",
    `„${text.trim()}" · „${untertitel.trim()}" · Rückruf-Zeile: ${rueckruf === 1 ? "vorhanden" : "fehlt"}`,
  );

  // ── M8: Bestand — Zahlen, Verlinkung, kein Arbeitsvorrat ──
  const kacheln = page.locator(".agent-tile");
  const zahlen = (await kacheln.allInnerTexts()).map((t) => t.split("\n")[0].trim());
  const ziele = await kacheln.evaluateAll((els) => els.map((e) => e.getAttribute("href")));
  sage(
    zahlen.join("|") === "9|4|27"
      && ziele.join(" ") === "/agent/meine-kunden?filter=offen /agent/meine-kunden?filter=angekuendigt /agent/meine-kunden?filter=bezahlt",
    "M8 · Bestands-Segmente mit Filter-Verlinkung",
    `${zahlen.join(" · ")} → ${ziele.map((z) => z.split("=")[1]).join(" · ")}`,
  );

  const abschluss = await page.locator("section:has-text('Mein Bestand') li").allInnerTexts();
  const bonusDrin = abschluss.some((z) => z.includes("15,00"));
  sage(
    abschluss.length === 3 && abschluss[0].includes("Marina Kellner") && abschluss[1].includes("Nordlicht GmbH") && !bonusDrin,
    "M8b · Zuletzt abgeschlossen: 3 echte Abschlüsse, kein Bonus",
    `${abschluss.map((z) => z.replace(/\n/g, " · ")).join(" | ")}`,
  );

  const arbeitsknoepfe = await page.locator("section:has-text('Mein Bestand') a[href^='tel:'], section:has-text('Mein Bestand') button").count();
  sage(arbeitsknoepfe === 0, "M8c · Bestand ist Rückblick, kein Arbeitsvorrat", `${arbeitsknoepfe} Anruf-/Aktions-Knöpfe im Bestand`);

  // Einmal-Hinweis auf neue Neuerungen wegtippen — er liegt als Blatt über
  // der Primäraktion und würde das Bildschirmfoto verdecken.
  await page.getByRole("button", { name: "Verstanden" }).click({ timeout: 2_000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/agent-startseite-380.png" });
  await context.close();
}

// ── Bewegung reduziert ─────────────────────────────────────────────────────
{
  const { context, page } = await seiteOeffnen(browser, { reducedMotion: "reduce" });
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

// ── M7: Begrüßung zu festgesetzten Uhrzeiten (deutsche Zeit) ───────────────
// Der Fehler vom 28.07.2026: um 09:30 Uhr stand „Guten Abend" da, weil die
// Stunde als NaN heraus kam und die Bedingungskette auf den letzten Zweig
// durchfiel. Diese Prüfung fängt genau das wieder ab — im echten Browser.
{
  const zeiten = [
    ["2026-07-28T07:30:00Z", "09:30 Sommerzeit", "Guten Morgen"],
    ["2026-07-28T04:30:00Z", "06:30 Sommerzeit", "Guten Morgen"],
    ["2026-07-28T11:15:00Z", "13:15 Sommerzeit", "Guten Tag"],
    ["2026-07-28T18:05:00Z", "20:05 Sommerzeit", "Guten Abend"],
    ["2026-07-28T22:10:00Z", "00:10 Mitternacht", "Guten Abend"],
    ["2026-01-15T08:30:00Z", "09:30 Winterzeit", "Guten Morgen"],
  ];
  const ergebnisse = [];
  let alleGut = true;
  for (const [iso, wann, soll] of zeiten) {
    const { context, page } = await seiteOeffnen(browser, { zeitpunkt: new Date(iso), bremse: 1 });
    await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
    await page.waitForSelector("h1", { timeout: 20_000 });
    const ist = (await page.locator("h1").first().innerText()).trim();
    const gut = ist === `${soll}, Justin`;
    if (!gut) alleGut = false;
    ergebnisse.push(`${wann} → „${ist}"${gut ? "" : ` (erwartet „${soll}")`}`);
    await context.close();
  }
  sage(alleGut, "M7 · Begrüßung zu festgesetzten Uhrzeiten", ergebnisse.join(" · "));
}

// ── M8d: leerer Bestand ist motivierend, nicht leer ───────────────────────
{
  const { context, page } = await seiteOeffnen(browser, {
    bremse: 1,
    daten: {
      "/agent/kartei/segmente": { ok: true, betreuung: 0, angekuendigt: 0, abgeschlossen: 0 },
      "/agent/dashboard": { ...STUB["/agent/dashboard"], closes: [] },
    },
  });
  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  await page.waitForSelector("section:has-text('Mein Bestand')", { timeout: 20_000 });
  const bestand = await page.locator("section:has-text('Mein Bestand')").first().innerText();
  const kachelnLeer = await page.locator(".agent-tile").count();
  sage(
    bestand.includes("Noch keine eigene Akte") && bestand.includes("Kartei") && kachelnLeer === 0,
    "M8d · Leerer Bestand: Weg nach vorne statt leerer Fläche",
    `„${bestand.split("\n").slice(1, 3).join(" ").trim()}"`,
  );
  await context.close();
}

// ── M9: Menü-Zähler — aussen = Summe innen, in mehreren Zuständen ─────────
{
  /** Liest den Zähler am Auslöser und alle Zähler im geöffneten Menü. */
  const zaehlerLesen = async (page) => {
    const ausloeser = page.locator('button[aria-label="Menü öffnen"]');
    const aussenText = (await ausloeser.innerText()).trim();
    const aussen = aussenText === "" ? 0 : Number(aussenText);
    await ausloeser.click();
    await page.waitForSelector('[role="dialog"][aria-label="Menü"]', { timeout: 10_000 });
    const innen = await page.locator('[role="dialog"][aria-label="Menü"] nav a').evaluateAll((links) =>
      links.map((a) => {
        const badge = a.querySelector("span:last-child");
        const zahl = badge && /^\d+$/.test(badge.textContent.trim()) ? Number(badge.textContent.trim()) : 0;
        return { ziel: a.getAttribute("href"), zahl };
      }),
    );
    await page.keyboard.press("Escape");
    return { aussen, innen, summe: innen.reduce((s, i) => s + i.zahl, 0) };
  };

  const zustaende = [
    { name: "gemischt (Antwort 1 + Rückläufer 2)", feedback: 1, ruecklaeufer: 2 },
    { name: "nur Rückläufer (3)", feedback: 0, ruecklaeufer: 3 },
    { name: "nur Antworten (2)", feedback: 2, ruecklaeufer: 0 },
    { name: "nichts offen", feedback: 0, ruecklaeufer: 0 },
  ];

  const zeilen = [];
  let alleGleich = true;
  for (const z of zustaende) {
    const { context, page } = await seiteOeffnen(browser, {
      bremse: 1,
      daten: {
        "/agent/feedback/state": { ok: true, unread: z.feedback },
        "/agent/kartei/status": {
          ...STUB["/agent/kartei/status"],
          ruecklaeufer: { anzahl: z.ruecklaeufer, inTagen: 2, fristTage: 14 },
        },
      },
    });
    await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
    await page.waitForSelector(".agent-cta", { timeout: 20_000 });
    // Neuerungen als gelesen melden — genau das Ereignis, das auch die Seite
    // „Updates" auslöst. Danach müssen BEIDE Zähler sofort sinken.
    await page.evaluate(() => window.dispatchEvent(new Event("agent-updates-seen")));
    await page.waitForTimeout(150);

    const { aussen, innen, summe } = await zaehlerLesen(page);
    const kartei = innen.find((i) => i.ziel === "/agent/kartei")?.zahl ?? 0;
    const mehr = innen.find((i) => i.ziel === "/agent/mehr")?.zahl ?? 0;
    const stimmt = aussen === summe && kartei === z.ruecklaeufer && mehr === z.feedback;
    if (!stimmt) alleGleich = false;
    zeilen.push(`${z.name}: aussen ${aussen} = innen ${summe} (Kartei ${kartei}, Mehr ${mehr})${stimmt ? "" : " ← FALSCH"}`);
    await context.close();
  }
  sage(alleGleich, "M9 · Menü-Zähler: aussen = Summe innen", zeilen.join(" · "));
}

// ── Desktop: dieselben Elemente, aber die Fläche wird genutzt ──────────────
{
  const { context, page } = await seiteOeffnen(browser, {
    viewport: { width: 1280, height: 900 },
    mobil: false,
    bremse: 1,
  });
  await page.goto(`${BASIS}/agent`, { waitUntil: "commit" });
  await page.waitForSelector(".agent-cta", { timeout: 20_000 });
  const konto = await page.locator("section.agent-glass-strong").first().boundingBox();
  const cta = await page.locator(".agent-cta").first().boundingBox();
  const bestand = await page.locator("section.agent-lift").first().boundingBox();
  const untersteKante = Math.max(cta.y + cta.height, bestand.y + bestand.height);
  sage(
    untersteKante <= 900,
    "M6 · Desktop: alles im ersten Bildschirm",
    `unterste Kante bei ${Math.round(untersteKante)} px von 900 px`,
  );
  // Nebeneinander heißt: der Bestand beginnt rechts vom Kontostand, nicht darunter.
  const nebeneinander = bestand.x > konto.x + konto.width - 8 && bestand.y < konto.y + konto.height;
  const genutzt = Math.round(((bestand.x + bestand.width - konto.x) / 1280) * 100);
  sage(
    nebeneinander && genutzt >= 60,
    "M6b · Desktop: Kontostand und Bestand nebeneinander",
    `Inhalt nutzt ${genutzt} % der Fensterbreite (vorher eine schmale Spalte)`,
  );
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
