#!/usr/bin/env node
/**
 * ============================================================================
 * KUNDEN-DASHBOARD — Prüfung des Bonitäts-Bereichs
 * ============================================================================
 * Prüft die Zusagen des Umbaus an der ECHTEN gebauten Oberfläche:
 *
 *   K1  Bonitäts-Bereich ist auf 380 px MIT Handlungsknopf ohne Scrollen sichtbar
 *   K2  Der Knopf führt in die bestehende Kaufstrecke (Bestell-Popup)
 *   K3  Alle vier Zustände korrekt: nicht gekauft · Zahlung offen · in Arbeit ·
 *       Auskunft da/Auswertung fertig
 *   K4  Produkt und Verwaltung sind getrennt; keine Aufgabe erscheint doppelt
 *   K5  Volltextprüfung: keine unzulässigen Versprechen
 *   K6  Bildrate beim Laden und Scrollen (4-fache CPU-Bremse)
 *   K7  prefers-reduced-motion schaltet jede Bewegung ab
 *   K8  Desktop (1440 px) nutzt die Fläche statt einer schmalen Spalte
 *
 * Die API wird im Browser abgefangen und mit festen Werten beantwortet — kein
 * Server, keine Datenbank, keine echten Kundendaten.
 *
 * Vorbereitung:  npx vite build
 *                npx vite preview --port 4173   (zweites Fenster)
 * Verwendung:    node scripts/dashboard-bonitaet.mjs
 * ============================================================================
 */
import { chromium } from "playwright";

const BASIS = process.env.TEMPO_URL || "http://localhost:4173";
const GESAMT_LIMIT_MS = 60_000;

const abbruch = setTimeout(() => {
  console.error("\n⏱  Zeitlimit 60 s erreicht — Abbruch. (Läuft `vite preview` auf Port 4173?)");
  process.exit(3);
}, GESAMT_LIMIT_MS);

const KUNDE = {
  ref: "FIAON-2026-TEST01",
  firstName: "Marina",
  lastName: "Kellner",
  email: "marina@example.de",
  packName: "FIAON Pro",
  approvedLimit: 5000,
};

/** Grundzustand: Profil offen, Dokumente fehlen, Bonitäts-Check nicht gekauft. */
const STUB = {
  "/kyc-status": {
    hasBankStatement: false, hasIdCard: false, hasSchufa: false,
    documentsUploadedAt: null, status: "submitted", kycStatus: "pending",
    accountStatus: "pending", adminNote: null, reuploadBankStatement: false,
    reuploadIdCard: false, adminProfileNote: null, profileChangesRequested: false,
    profileCompletedAt: null,
  },
  "/bonitaet-status": {
    ok: true, zustand: "offen", preisEuro: 74, bestellung: null,
    analyse: "keine", fahrplanSchritte: 0,
  },
  "/profile": { ok: true, approvedLimit: 5000, packName: "FIAON Pro" },
  "/roadmap": { ok: true, greeting: null },
};

const LADE_ZAEHLER = () => {
  window.__bilder = 0;
  window.__start = performance.now();
  const tick = () => { window.__bilder++; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};

async function ladeBildrate(page) {
  const { bilder, ms } = await page.evaluate(() => ({
    bilder: window.__bilder || 0,
    ms: performance.now() - (window.__start || performance.now()),
  }));
  return ms > 0 ? Math.round((bilder / ms) * 1000) : 0;
}

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
 * Öffnet das Dashboard mit angemeldetem Testkunden. Die Anmeldung sitzt in
 * `sessionStorage` — genau dort sucht die Seite den Kunden.
 */
async function dashboardOeffnen(browser, {
  reducedMotion = "no-preference",
  viewport = { width: 380, height: 780 },
  mobil = true,
  bonitaet = {},
  kyc = {},
  bremse = 4,
} = {}) {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: mobil ? 2 : 1, isMobile: mobil, hasTouch: mobil, reducedMotion,
  });
  await context.addInitScript(LADE_ZAEHLER);
  await context.addInitScript((k) => {
    try {
      sessionStorage.setItem("fiaon_user", JSON.stringify(k));
      // Willkommens-Popup und Neuerungs-Hinweise unterdrücken: sie legen sich
      // sonst über den zu prüfenden Bereich.
      for (let v = 1; v <= 12; v++) {
        localStorage.setItem(`fiaon_welcome_first_v${v}`, "true");
        for (const s of ["active", "review", "incomplete"]) localStorage.setItem(`fiaon_welcome_${s}_v${v}`, "true");
      }
    } catch { /* egal */ }
  }, KUNDE);

  const page = await context.newPage();
  const bonitaetAntwort = { ...STUB["/bonitaet-status"], ...bonitaet };
  const kycAntwort = { ...STUB["/kyc-status"], ...kyc };

  await page.route("**/api/fiaon/**", (route) => {
    const pfad = new URL(route.request().url()).pathname.replace("/api/fiaon", "");
    let body = { ok: true };
    if (pfad.startsWith("/kyc-status")) body = kycAntwort;
    else if (pfad.startsWith("/bonitaet-status")) body = bonitaetAntwort;
    else if (pfad.startsWith("/profile")) body = STUB["/profile"];
    else if (pfad.startsWith("/roadmap")) body = STUB["/roadmap"];
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: bremse });
  return { context, page };
}

let fehler = 0;
const sage = (ok, titel, detail) => {
  if (!ok) fehler++;
  console.log(`${ok ? "✅" : "❌"} ${titel}`);
  if (detail) console.log(`     ${detail}`);
};

const browser = await chromium.launch();

// ── K1/K2/K6: Normalfall auf dem Handy ─────────────────────────────────────
{
  const { context, page } = await dashboardOeffnen(browser);
  await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
  await page.waitForSelector(".db-hero", { timeout: 20_000 });
  await page.waitForTimeout(1_500);

  const ladeFps = await ladeBildrate(page);
  sage(ladeFps >= 50, "K6 · Bildrate beim Laden", `${ladeFps} Bilder/s (4-fache CPU-Bremse, Ziel ≥ 50)`);

  const scrollFps = await bildrate(page, 1800, async () => {
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 140); await page.waitForTimeout(110); }
    await page.mouse.wheel(0, -1200);
  });
  sage(scrollFps >= 50, "K6b · Bildrate beim Scrollen", `${scrollFps} Bilder/s (Ziel ≥ 50)`);

  await page.evaluate(() => window.scrollTo(0, 0));
  const held = await page.locator(".db-hero").first().boundingBox();
  const knopf = await page.locator(".db-hero .db-act").first().boundingBox();
  const untersteKante = knopf.y + knopf.height;
  sage(
    untersteKante <= 780,
    "K1 · Bonitäts-Bereich inkl. Knopf ohne Scrollen sichtbar (380 px)",
    `Knopf-Unterkante bei ${Math.round(untersteKante)} px von 780 px · Bereich ${Math.round(held.height)} px hoch`,
  );
  sage(knopf.height >= 44, "K1b · Handlungsknopf ist ein Touch-Ziel", `${Math.round(knopf.height)} px hoch (Ziel ≥ 44 px)`);

  // Der Bonitäts-Bereich muss VOR der Karte/den Kennzahlen stehen.
  const kennzahlen = await page.locator(".fiaon-glass-panel, [class*='PremiumStat']").first().boundingBox().catch(() => null);
  const vorDerKarte = !kennzahlen || held.y < kennzahlen.y;
  sage(vorDerKarte, "K1c · Bonitäts-Bereich steht vor Kennzahlen und Karte", vorDerKarte ? "ja" : "nein — steht darunter");

  // K2: Führt der Knopf in die bestehende Kaufstrecke?
  await page.locator(".db-hero .db-act").first().click();
  await page.waitForTimeout(400);
  const popupText = await page.locator("body").innerText();
  const kaufstrecke = /SCHUFA-Vollauskunft bestellen|Vollauskunft/i.test(popupText) && /74/.test(popupText);
  sage(kaufstrecke, "K2 · Knopf öffnet die bestehende Bestellstrecke", kaufstrecke ? "Bestell-Popup mit Preis erscheint" : "Popup nicht gefunden");

  await page.keyboard.press("Escape").catch(() => {});
  await page.screenshot({ path: "/tmp/dashboard-bonitaet-380.png" });
  await context.close();
}

// ── K3: alle vier Zustände ─────────────────────────────────────────────────
{
  const faelle = [
    {
      name: "nicht gekauft",
      bonitaet: { zustand: "offen" },
      muss: ["Ihr Bonitäts-Check", "Bonitäts-Check starten", "74"],
      darfNicht: ["Zahlung abschließen", "Zum Fahrplan"],
    },
    {
      name: "Zahlung offen",
      bonitaet: {
        zustand: "zahlung_offen",
        bestellung: { paymentReference: "FIAON-PAY-TEST", status: "pending_payment", betrag: "74.00", faelligAm: "2026-08-04T00:00:00Z", bestelltAm: "2026-07-28T09:00:00Z" },
      },
      muss: ["Nur die Zahlung fehlt noch", "Zahlung abschließen", "04. August 2026"],
      darfNicht: ["Bonitäts-Check starten"],
    },
    {
      name: "bezahlt, in Arbeit",
      bonitaet: { zustand: "bezahlt", bestellung: { paymentReference: "FIAON-PAY-TEST", status: "paid", betrag: "74.00", faelligAm: null, bestelltAm: null } },
      muss: ["Wir beschaffen Ihre Auskunft", "Zahlung eingegangen", "nichts weiter tun"],
      darfNicht: ["Bonitäts-Check starten", "Zahlung abschließen"],
    },
    {
      name: "Auswertung fertig",
      bonitaet: { zustand: "geliefert", analyse: "fertig", fahrplanSchritte: 6 },
      muss: ["Ihr Fahrplan steht bereit", "Zum Fahrplan"],
      darfNicht: ["Bonitäts-Check starten", "Zahlung abschließen"],
    },
  ];

  const zeilen = [];
  let alleGut = true;
  for (const f of faelle) {
    const { context, page } = await dashboardOeffnen(browser, { bremse: 1, bonitaet: f.bonitaet });
    await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
    await page.waitForSelector(".db-hero", { timeout: 20_000 });
    const text = await page.locator(".db-hero").first().innerText();
    const fehlt = f.muss.filter((m) => !text.includes(m));
    const zuviel = f.darfNicht.filter((m) => text.includes(m));
    const gut = fehlt.length === 0 && zuviel.length === 0;
    if (!gut) alleGut = false;
    zeilen.push(`${f.name}: ${gut ? "richtig" : `FEHLT [${fehlt.join(", ")}] ÜBRIG [${zuviel.join(", ")}]`}`);
    if (f.name === "nicht gekauft") await page.screenshot({ path: "/tmp/dashboard-bonitaet-zustand-offen.png" });
    await context.close();
  }
  sage(alleGut, "K3 · Alle vier Zustände korrekt dargestellt", zeilen.join(" · "));
}

// ── K4: Produkt und Verwaltung getrennt, keine Doppelung ───────────────────
{
  const { context, page } = await dashboardOeffnen(browser, {
    bremse: 1,
    kyc: { profileChangesRequested: true, adminProfileNote: "Bitte Reisepass prüfen", kycStatus: "changes_requested", adminNote: "Kontoauszug unlesbar" },
  });
  await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
  await page.waitForSelector(".db-hero", { timeout: 20_000 });
  await page.waitForTimeout(300);

  const weg = await page.locator("section:has-text('Ihr Weg')").count();
  const verwaltung = await page.locator("section:has-text('Noch zu erledigen')").count();
  sage(weg === 1 && verwaltung === 1, "K4 · Produkt und Verwaltung sind zwei getrennte Bereiche", `„Ihr Weg": ${weg} · „Noch zu erledigen": ${verwaltung}`);

  // Die Bonitätsauskunft darf NICHT mehr in der Verwaltungsliste stehen.
  const verwaltungsText = await page.locator("section:has-text('Noch zu erledigen')").first().innerText();
  const keinSchufaInListe = !/SCHUFA|Bonitätsaus/i.test(verwaltungsText);
  sage(keinSchufaInListe, "K4b · Bonitätsauskunft steht nicht mehr in der Pflichtliste", keinSchufaInListe ? "korrekt getrennt" : "erscheint doppelt");

  // Dieselbe Aufgabe darf nicht zusätzlich als Balken oben stehen.
  const seitenText = await page.locator("body").innerText();
  const balkenDoppelt = seitenText.includes("Profil unvollständig:") || seitenText.includes("Nachricht von FIAON:");
  sage(!balkenDoppelt, "K4c · Keine Aufgabe doppelt (Balken + Liste)", balkenDoppelt ? "Balken erscheint zusätzlich" : "nur in „Noch zu erledigen\"");

  // Rückfragen müssen sichtbar bleiben — nur eben an einer Stelle.
  const rueckfrageDrin = /Reisepass prüfen/.test(verwaltungsText) && /Kontoauszug unlesbar/.test(verwaltungsText);
  sage(rueckfrageDrin, "K4d · Rückfragen von FIAON bleiben sichtbar", rueckfrageDrin ? "beide Rückfragen in der Liste" : "Rückfrage verloren");

  await page.screenshot({ path: "/tmp/dashboard-bonitaet-aufgaben.png" });
  await context.close();
}

// ── K5: Volltextprüfung auf unzulässige Versprechen ────────────────────────
{
  // Formulierungen, die im Kundenbereich NICHT vorkommen dürfen: garantierte
  // Score-Verbesserung, Löschung von Einträgen, Kreditzusagen.
  const VERBOTEN = [
    /schufa[- ]frei/i,
    /einträge?\s+(zu\s+)?löschen/i,
    /löschen\s+(wir\s+)?(ihre\s+)?einträge/i,
    /garantiert(e|er|es)?\s+(score|verbesserung|kredit)/i,
    /score[- ]garantie/i,
    /garantierte?\s+bewilligung/i,
    /kredit\s+garantiert/i,
    /100\s*%\s*(erfolg|sicher|garantie)/i,
    /sicher(er)?\s+kredit/i,
  ];

  const zustaende = [
    { zustand: "offen" },
    { zustand: "zahlung_offen", bestellung: { paymentReference: "P", status: "pending_payment", betrag: "74.00", faelligAm: null, bestelltAm: null } },
    { zustand: "bezahlt" },
    { zustand: "geliefert", analyse: "fertig", fahrplanSchritte: 4 },
  ];

  const treffer = [];
  for (const b of zustaende) {
    const { context, page } = await dashboardOeffnen(browser, { bremse: 1, bonitaet: b });
    await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
    await page.waitForSelector(".db-hero", { timeout: 20_000 });
    await page.waitForTimeout(200);
    const text = await page.locator("main").innerText();
    for (const muster of VERBOTEN) {
      const m = text.match(muster);
      if (m) treffer.push(`${b.zustand}: „${m[0]}"`);
    }
    await context.close();
  }
  sage(treffer.length === 0, "K5 · Keine unzulässigen Versprechen im Text", treffer.length === 0 ? `${VERBOTEN.length} Muster geprüft, in 4 Zuständen — kein Treffer` : treffer.join(" · "));
}

// ── K7: prefers-reduced-motion ─────────────────────────────────────────────
{
  const { context, page } = await dashboardOeffnen(browser, { reducedMotion: "reduce", bremse: 1 });
  await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
  await page.waitForSelector(".db-hero", { timeout: 20_000 });
  await page.waitForTimeout(300);

  const bewegung = await page.evaluate(() => {
    const stil = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
    const licht = stil(".db-light");
    const rise = stil(".db-rise");
    const act = stil(".db-act");
    return {
      licht: licht ? licht.animationName : "keine Fläche",
      riseName: rise ? rise.animationName : "kein Auftritt",
      riseSichtbar: rise ? rise.opacity : "0",
      actUebergang: act ? act.transitionDuration : "—",
      textLesbar: (document.querySelector(".db-hero")?.innerText || "").includes("Bonitäts-Check"),
    };
  });
  const still = bewegung.licht === "none" && bewegung.riseName !== "dbRise";
  sage(
    still && bewegung.riseSichtbar === "1" && bewegung.textLesbar,
    "K7 · prefers-reduced-motion schaltet Bewegung ab",
    `Licht: ${bewegung.licht} · Auftritt: ${bewegung.riseName} · Knopf-Übergang: ${bewegung.actUebergang} · Inhalt sichtbar: ${bewegung.riseSichtbar}`,
  );
  await context.close();
}

// ── K8: Desktop nutzt die Fläche ───────────────────────────────────────────
{
  const { context, page } = await dashboardOeffnen(browser, {
    viewport: { width: 1440, height: 900 }, mobil: false, bremse: 1,
  });
  await page.goto(`${BASIS}/dashboard`, { waitUntil: "commit" });
  await page.waitForSelector(".db-hero", { timeout: 20_000 });
  await page.waitForTimeout(400);

  const held = await page.locator(".db-hero").first().boundingBox();
  const knopf = await page.locator(".db-hero .db-act").first().boundingBox();
  sage(knopf.y + knopf.height <= 900, "K8 · Desktop: Bonitäts-Bereich im ersten Bildschirm", `Knopf-Unterkante bei ${Math.round(knopf.y + knopf.height)} px von 900 px`);

  const weg = await page.locator("section:has-text('Ihr Weg')").first().boundingBox();
  const verwaltung = await page.locator("section:has-text('Noch zu erledigen')").first().boundingBox();
  const nebeneinander = verwaltung.x > weg.x + weg.width - 8 && verwaltung.y < weg.y + weg.height;
  const genutzt = Math.round(((held.x + held.width - held.x) / 1440) * 100);
  sage(
    nebeneinander && genutzt >= 60,
    "K8b · Desktop: Weg und Verwaltung nebeneinander, Fläche genutzt",
    `Inhalt nutzt ${genutzt} % der Fensterbreite · nebeneinander: ${nebeneinander ? "ja" : "nein"}`,
  );

  await page.screenshot({ path: "/tmp/dashboard-bonitaet-desktop.png" });
  await context.close();
}

await browser.close();
clearTimeout(abbruch);

console.log("\nBildschirmfotos: /tmp/dashboard-bonitaet-380.png · /tmp/dashboard-bonitaet-zustand-offen.png · /tmp/dashboard-bonitaet-aufgaben.png · /tmp/dashboard-bonitaet-desktop.png");
if (fehler > 0) {
  console.error(`\n❌ ${fehler} Zusage(n) nicht erfüllt.`);
  process.exit(1);
}
console.log("\n✅ Bonitäts-Bereich erfüllt Sichtbarkeits-, Zustands-, Sprach- und Tempo-Zusagen.");
