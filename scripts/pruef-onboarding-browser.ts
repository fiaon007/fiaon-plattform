// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-ABNAHME: COCKPIT, PORTAL-SPERRE, PFLICHT-GATE, KNÖPFE
//
// `pruef-onboarding-pflicht.ts` prüft Regeln, Datenbank und Quelltext. Alle 146
// Prüfungen wären grün, wenn es für keine dieser Funktionen einen Knopf gäbe —
// genau das war am 11.08.2026 der Fall.
//
// Hier also: Seite öffnen, Knopf DRÜCKEN, Ergebnis am gerenderten Text messen.
// Und Screenshots, die ein Mensch ansieht — Desktop UND 380 px.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Jeder schreibende Aufruf geht in eine Attrappe. Kein Startgespräch wird echt
// abgeschlossen, kein Konto echt freigeschaltet, keine Mail verschickt.
// Zustimmungsstrecken enden VOR dem letzten Klick (AGENTS.md, 06.08.2026).
//
//   npx tsx scripts/pruef-onboarding-browser.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-onboarding";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}
/** Schließt überlagernde Fenster, damit Klicks die Seite erreichen. */
async function schliesseDialoge(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const dialog = page.locator("[role='dialog']:visible").first();
    if (await dialog.count() === 0) return;
    // Das Kreuz ZUERST: Ein Dialog wie „Profil vervollständigen" hat nur
    // einen weiterführenden Knopf — den zu drücken würde die Seite wechseln
    // und die Prüfung woandershin führen.
    const kreuz = dialog.getByRole("button", { name: /^Schließen$/i }).first();
    const zu = await kreuz.count() > 0 ? kreuz : dialog.getByRole("button", {
      name: /^(Los geht.s|Weiter|Verstanden|Alles klar|Zu meinem Konto|Weiter zu meinem Konto)$/i,
    }).first();
    if (await zu.count() > 0) await zu.click({ timeout: 3000 }).catch(() => {});
    else await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(700);
  }
}

async function text(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

/** Alles Schreibende in die Attrappe. Lesendes geht durch. */
async function attrappen(kontext: BrowserContext): Promise<void> {
  await kontext.route("**/api/**", async (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD") return route.fallback();
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, attrappe: true,
        hinweis: "Attrappe — es ist nichts passiert. Das Konto ist NICHT freigeschaltet.",
      }),
    });
  });
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: Onboarding-Cockpit, Portal, Gate ══\n");
  const browser = await chromium.launch();
  const angelegt: number[] = [];

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Das Onboarding-Cockpit");
  // ═════════════════════════════════════════════════════════════════════════
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-onb-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [konto] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES ('Prüfstand Onboarding (Testkonto)', ${mail},
            ${await bcrypt.hash(pass, 10)}, 'onboarding', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  angelegt.push(Number(konto.id));

  const kontext = await browser.newContext({ viewport: { width: 1280, height: 940 } });
  await attrappen(kontext);

  // Die zwei Zugangswände als Attrappe — NIE echt durchlaufen.
  await kontext.route("**/api/fiaon/agent/onboarding", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, status: { complete: true, schritte: [] } }),
    });
  });
  await kontext.route("**/api/fiaon/agent/onboarding/zusage", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, frei: true, zusage: { angenommen: true } }),
    });
  });

  // Ein Termin als Attrappe — kein echter Kunde wird angerufen oder
  // freigeschaltet. Der UNGÜNSTIGSTE Fall: langer Name, fehlende Unterlagen.
  const terminAttrappe = {
    ok: true,
    termine: [{
      id: 999_001, personId: 999_002,
      name: "Maximiliane Freifrau von Hohenlohe-Langenburg",
      telefon: "+4915100000042", email: "pruef@pruefstand.test",
      beginn: new Date(Date.now() + 3600_000).toISOString(),
      datum: new Date().toISOString().slice(0, 10),
      datumText: "morgen", uhrzeit: "10:30", dauerMin: 15,
      status: "gebucht", notiz: null, heute: true, vorbei: false,
    }],
  };
  await kontext.route("**/api/fiaon/agent/onboarding/termine", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(terminAttrappe) });
  });
  await kontext.route("**/api/fiaon/agent/onboarding/kennzahlen", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, dieseWoche: 4, offen: 1, erledigt: 3, verpasst: 1,
        heuteGeplant: 2, heuteErledigt: 1, heuteNoShow: 0,
        dauerSchnittMin: 17, freigeschaltetWoche: 3,
        erledigungsquote: 75, noShowQuote: 25, wartend: 349, wartendOhneTermin: 349,
      }),
    });
  });
  await kontext.route("**/api/fiaon/agent/onboarding/person/*/lage", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        lage: {
          paket: "FIAON Pro", zahlungsstand: "bezahlt am 01.08.",
          dokumente: { fehlt: ["Kontoauszug der letzten 3 Monate"], stand: "pending" },
          bonitaet: "nicht gekauft", stufe: "wartet_auf_onboarding",
        },
      }),
    });
  });

  const page = await kontext.newPage();
  const an = await page.request.post(`${BASIS}/api/fiaon/agent/login`, {
    data: { email: mail, password: pass },
  }).catch(() => null);
  ok("Das Prüf-Testkonto kann sich anmelden", an != null && an.ok(), `Status ${an?.status()}`);

  await page.goto(`${BASIS}/agent/startgespraeche`, { waitUntil: "domcontentloaded" });
  const kopfDa = await page.getByText(/Heute geplant/i).first()
    .waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
  ok("Der Kennzahlen-Kopf ist sichtbar", kopfDa);
  // ERST WARTEN, DANN MESSEN: Die Zahlen kommen aus einer eigenen Abfrage und
  // stehen zuerst als Skelett da. Der erste Lauf meldete „Ø-Dauer fehlt“ —
  // sie war nur noch nicht geladen. Auf die ZAHL warten, nicht auf die
  // Überschrift, und ihr Ausbleiben als Fehlschlag melden.
  const dauerDa = await page.getByText(/17\s*min/i).first()
    .waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
  ok("… die Ø-Dauer steht mit Zahl da", dauerDa);
  // Und die Einblend-Animation zu Ende laufen lassen, sonst zeigt der
  // Screenshot einen halb durchsichtigen Bildschirm.
  await page.waitForTimeout(1600);
  const t1 = await text(page);
  ok("… er nennt „heute erledigt“", /heute erledigt/.test(t1));
  ok("… und die Freischaltungen der Woche", /freigeschaltet \(7 tage\)/.test(t1));
  await bild(page, "1-onboarding-kennzahlen");

  // ── DER TERMIN AUFKLAPPEN UND INS COCKPIT ────────────────────────────
  const kunde = page.getByText(/Hohenlohe-Langenburg/).first();
  const kundeDa = await kunde.waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
  ok("Der Termin steht in der Liste", kundeDa);
  if (kundeDa) {
    await kunde.click().catch(() => {});
    await page.waitForTimeout(900);
    const knopf = page.getByRole("button", { name: /Gespräch führen/i }).first();
    const knopfDa = await knopf.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
    ok("Es gibt einen Knopf „Gespräch führen“", knopfDa);
    if (knopfDa) {
      await knopf.click();
      const buehneDa = await page.getByText(/Begrüßung & Erwartung klären/i).first()
        .waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      ok("Das Cockpit öffnet sich", buehneDa);
      const t2 = await text(page);
      ok("… alle sechs Agenda-Schritte stehen da",
        ["begrüßung", "plattform-tour", "fahrplan", "unterlagen", "bonitätsauskunft", "nächste schritte"]
          .every((s) => t2.includes(s)),
        t2.slice(0, 200));
      ok("… der Fortschritt steht auf 0 von 6", /0 von 6 schritten/.test(t2));
      ok("… die Uhr läuft", /\d{2}:\d{2}/.test(t2));
      ok("… es gibt einen Anrufen-Knopf",
        await page.getByRole("button", { name: /^Anrufen$/i }).count() > 0);
      ok("… die Lage des Kunden steht da (fehlende Unterlagen)",
        /kontoauszug der letzten 3 monate/.test(t2));
      ok("… und der Abschluss-Knopf ist da",
        await page.getByRole("button", { name: /abschließen & freischalten/i }).count() > 0);
      await bild(page, "2-cockpit-desktop");

      // ── WORTHYGIENE AUF DEM SCHIRM ──────────────────────────────────
      // Nicht im Quelltext, sondern in dem, was der Mitarbeiter LIEST.
      // Der Titel-Knopf, NICHT der Haken: beide trugen früher denselben Namen.
      const bonSchritt = page.getByRole("button", { name: /Bonitätsauskunft.*aufklappen/i }).first();
      if (await bonSchritt.count() > 0) {
        await bonSchritt.click();
        await page.waitForTimeout(500);
        const t3 = await text(page);
        ok("Der Bonitäts-Schritt sagt „Auskunft“", /auskunft/.test(t3));
        ok("… nennt die 74 €", /74\s*€/.test(t3));
        ok("… nennt den Verwendungszweck", /verwendungszweck/.test(t3));
        ok("… und sagt NICHT „Beratung“", !/wir beraten|beratung/.test(t3));
        await bild(page, "3-cockpit-worthygiene");
      }

      // ── DER ABSCHLUSS IST GESPERRT, SOLANGE NOTIZEN FEHLEN ─────────
      const abschluss = page.getByRole("button", { name: /abschließen & freischalten/i }).first();
      await abschluss.click().catch(() => {});
      await page.waitForTimeout(600);
      const t4 = await text(page);
      ok("Ohne Pflichtnotizen sagt der Abschluss, was fehlt",
        /es fehlt noch|noch offen/.test(t4), t4.slice(0, 200));
      ok("… und nennt die Begrüßung als fehlend", /begrüßung/.test(t4));
      ok("Das Konto wurde NICHT freigeschaltet (Attrappe)",
        !/voll freigeschaltet/.test(t4));
      await bild(page, "4-cockpit-abschluss-gesperrt");

      // ── EINEN SCHRITT ABHAKEN UND NOTIEREN ─────────────────────────
      const haken = page.getByRole("button", { name: /^Begrüßung & Erwartung klären abhaken$/i }).first();
      if (await haken.count() > 0) {
        await haken.click();
        await page.waitForTimeout(400);
        const t5 = await text(page);
        // Relativ messen: Vorher wurde in dieser Gruppe schon ein Schritt
        // abgehakt. Eine feste Zahl zu erwarten macht den Prüfstand von der
        // Reihenfolge seiner eigenen Klicks abhängig.
        const getan = Number((/(\d+) von 6 schritten/.exec(t5) ?? [])[1] ?? -1);
        ok("Ein abgehakter Schritt bewegt den Fortschritt", getan >= 1, `${getan} von 6`);
        const feld = page.getByLabel(/Notiz zu Begrüßung/i).first();
        if (await feld.count() > 0) {
          await feld.fill("Kunde will vor allem Klarheit über die Reihenfolge.");
          await page.waitForTimeout(300);
          ok("… und die Notiz wird angenommen",
            /steht im protokoll/.test(await text(page)));
        }
        await bild(page, "5-cockpit-schritt-abgehakt");
      }
    }
  }

  // ── 380 PX ────────────────────────────────────────────────────────────
  gruppe("2. Das Cockpit auf 380 px");
  const schmal = await kontext.newPage();
  await schmal.setViewportSize({ width: 380, height: 780 });
  await schmal.goto(`${BASIS}/agent/startgespraeche`, { waitUntil: "domcontentloaded" });
  const k2 = schmal.getByText(/Hohenlohe-Langenburg/).first();
  if (await k2.waitFor({ timeout: 20_000 }).then(() => true).catch(() => false)) {
    await k2.click().catch(() => {});
    await schmal.waitForTimeout(800);
    const f2 = schmal.getByRole("button", { name: /Gespräch führen/i }).first();
    if (await f2.count() > 0) {
      await f2.click();
      await schmal.waitForTimeout(1600);
      const abschlussSchmal = schmal.getByRole("button", { name: /abschließen & freischalten/i }).first();
      const sichtbar = await abschlussSchmal.isVisible().catch(() => false);
      ok("Der Abschluss-Knopf ist auch auf 380 px sichtbar", sichtbar);
      // Kein waagerechtes Scrollen: das Standardmaß für „passt".
      const ueberbreit = await schmal.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 2);
      ok("Es gibt kein waagerechtes Scrollen", !ueberbreit);
      await bild(schmal, "6-cockpit-380px");
    }
  }
  await schmal.close();
  await kontext.close();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Das Portal im Wartezustand");
  // ═════════════════════════════════════════════════════════════════════════
  // Über Attrappen der LESENDEN Routen: So sieht ein wartender Kunde sein
  // Portal. Kein echtes Kundenkonto wird verändert.
  const kontext2 = await browser.newContext({ viewport: { width: 1280, height: 940 } });
  await attrappen(kontext2);
  const REF = "FIAON-PRUEF-WARTEND";
  await kontext2.route("**/api/fiaon/kunde/*/startgespraech", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, faellig: false, banner: true, pflicht: false,
        vorname: "Otto", termin: null, erledigt: false, vollAktiv: false, token: null,
      }),
    });
  });
  const p2 = await kontext2.newPage();
  await p2.addInitScript((ref) => {
    sessionStorage.setItem("fiaon_user", JSON.stringify({
      ref, firstName: "Otto", lastName: "Onboarding",
      email: "otto@pruefstand.test", packName: "FIAON Pro",
    }));
    // ── DAS WILLKOMMENS-FENSTER IST SCHON GESEHEN ──────────────────────
    // Es liegt beim ERSTEN Besuch über der Seite und fängt jeden Klick ab
    // („intercepts pointer events" — daran ist der erste Lauf gescheitert).
    // Gesteuert wird es über localStorage; wir prüfen hier den WIEDERKEHRENDEN
    // Kunden, und der hat es weggeklickt. Das ist keine Umgehung der Prüfung,
    // sondern der Zustand, in dem ein Kunde sein Portal die nächsten Monate
    // benutzt.
    // Die Zustände heißen `first`, `active`, `review`, `incomplete`
    // (computeWelcomeState in dashboard.tsx). Geratene Namen wirken nicht —
    // beim ersten Versuch blieb „Willkommen zurück" stehen und fing jeden
    // Klick ab.
    for (const zustand of ["first", "active", "review", "incomplete"]) {
      for (let v = 1; v <= 12; v++) localStorage.setItem(`fiaon_welcome_${zustand}_v${v}`, "1");
    }
  }, REF);
  await p2.goto(`${BASIS}/dashboard`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(4000);

  // ── DAS WILLKOMMENS-FENSTER WEGKLICKEN ────────────────────────────────
  // Beim ersten Besuch liegt ein Dialog über der Seite und fängt jeden Klick
  // ab („intercepts pointer events"). Ein echter Kunde klickt ihn weg — der
  // Prüfstand muss dasselbe tun, sonst prüft er einen verdeckten Bildschirm.
  await schliesseDialoge(p2);

  const fahrplan = p2.getByRole("button", { name: /^Fahrplan$/i }).first();
  const fpDa = await fahrplan.count() > 0;
  ok("Der Menüpunkt „Fahrplan“ ist SICHTBAR (nicht versteckt)", fpDa);
  if (fpDa) {
    // Noch einmal: Das Fenster erscheint erst, wenn der Dokumentstand geladen
    // ist — also nach dem ersten Versuch, es zu schließen.
    await schliesseDialoge(p2);
    await fahrplan.click();
    const sperreDa = await p2.getByText(/Fahrplan wartet auf das Startgespräch/i).first()
      .waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    ok("… und zeigt eine SPERRKARTE, keine 404", sperreDa);
    const t6 = await text(p2);
    ok("… sie nennt den Grund", /gemeinsam durch|fünfzehn minuten/.test(t6));
    ok("… und zeigt den nächsten Schritt",
      await p2.getByRole("button", { name: /Termin wählen/i }).count() > 0);
    await p2.waitForTimeout(1400);
    await bild(p2, "7-portal-fahrplan-gesperrt");
  }

  // ── DER BANNER FÜR DEN BESTAND ────────────────────────────────────────
  const tBanner = await text(p2);
  ok("Der Bestands-Banner steht da („Startgespräch steht noch aus“)",
    /startgespräch steht noch aus/.test(tBanner), tBanner.slice(0, 160));

  // Was er SEHEN darf. Die Menüpunkte heißen im Portal „Dokumente",
  // „Kontoauszüge" und „Support" — nicht „Unterlagen", „Bank-Anleitung",
  // „Hilfe". Erwartete Namen zu erfinden, prüft die eigene Annahme.
  for (const [name, bereich] of [
    ["Dokumente", /^Dokumente/i],
    ["Mein Konto", /^Mein Konto$/i],
    ["Kontoauszüge", /^Kontoauszüge$/i],
    ["Support", /^Support$/i],
  ] as [string, RegExp][]) {
    const b = p2.getByRole("button", { name: bereich }).first();
    if (await b.count() === 0) { ok(`„${name}“ ist erreichbar`, false, "Menüpunkt fehlt"); continue; }
    await b.click();
    // 1,8 s: Die Seite blendet Bereiche mit einem Übergang ein. Wer früher
    // messtet, misst einen halb sichtbaren Bildschirm — der erste Screenshot
    // dieses Prüfstands entstand mitten in der Animation.
    await p2.waitForTimeout(1800);
    const t = await text(p2);
    ok(`„${name}“ ist OFFEN (keine Sperrkarte)`, !/wartet auf das startgespräch/.test(t));
  }
  await bild(p2, "8-portal-unterlagen-offen");
  await kontext2.close();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Das Pflicht-Gate — buchen oder ausloggen");
  // ═════════════════════════════════════════════════════════════════════════
  const kontext3 = await browser.newContext({ viewport: { width: 1280, height: 940 } });
  await attrappen(kontext3);
  await kontext3.route("**/api/fiaon/kunde/*/startgespraech", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, faellig: true, banner: false, pflicht: true,
        vorname: "Neuka", termin: null, erledigt: false, vollAktiv: false,
        token: "pruefstand-attrappe-token",
      }),
    });
  });
  await kontext3.route("**/api/fiaon/termin/*", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    const morgen = new Date(Date.now() + 26 * 3600_000);
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, slotMinuten: 15,
        slots: [10, 11, 14].map((h) => {
          const d = new Date(morgen); d.setHours(h, 0, 0, 0);
          return {
            beginn: d.toISOString(), datum: d.toISOString().slice(0, 10),
            uhrzeit: `${String(h).padStart(2, "0")}:00`,
            agentId: 1, agentVorname: "Lena",
          };
        }),
      }),
    });
  });
  const p3 = await kontext3.newPage();
  await p3.addInitScript(() => {
    sessionStorage.setItem("fiaon_user", JSON.stringify({
      ref: "FIAON-PRUEF-PFLICHT", firstName: "Neuka", lastName: "Neukunde",
      email: "neu@pruefstand.test", packName: "FIAON Ultra",
    }));
    // Auch hier: geprüft wird die PFLICHT-TAFEL, nicht das Willkommens-Fenster.
    // Im Portal erscheint das Gate ohnehin erst, wenn das Willkommen weg ist
    // (`!welcomeOpen` in dashboard.tsx) — die Reihenfolge ist so gewollt.
    // Die Zustände heißen `first`, `active`, `review`, `incomplete`
    // (computeWelcomeState in dashboard.tsx). Geratene Namen wirken nicht —
    // beim ersten Versuch blieb „Willkommen zurück" stehen und fing jeden
    // Klick ab.
    for (const zustand of ["first", "active", "review", "incomplete"]) {
      for (let v = 1; v <= 12; v++) localStorage.setItem(`fiaon_welcome_${zustand}_v${v}`, "1");
    }
  });
  await p3.goto(`${BASIS}/dashboard`, { waitUntil: "domcontentloaded" });
  await p3.waitForTimeout(4500);
  const t7 = await text(p3);
  ok("Die Pflicht-Tafel erscheint", /startgespräch/.test(t7), t7.slice(0, 200));
  ok("… es gibt KEIN „Später buchen“", !/später buchen/.test(t7));
  ok("… stattdessen „Abmelden“",
    await p3.getByRole("button", { name: /^Abmelden$/i }).count() > 0);
  ok("… und wählbare Zeiten stehen da", /10:00|11:00|14:00/.test(t7));
  // WICHTIG: Es wird NICHT gebucht. Der Screenshot endet vor dem letzten Klick.
  await bild(p3, "9-pflicht-gate");
  ok("Es wurde NICHT gebucht (der Prüfstand bucht keine Termine)", true);
  await kontext3.close();

  await browser.close();

  // Testkonto stilllegen — nicht löschen.
  // ── DIE EINE FUNKTION FÜR DEN ABSCHLUSS (AGENTS.md, 17.08.2026) ────────
  // Hier stand ein handgeschriebenes UPDATE. Drei Prüfstände hatten drei
  // Fassungen — und keine setzte die Marke is_test_account. Ergebnis: 43
  // Testkonten standen zwischen den sechs echten Menschen in der
  // Team-Zentrale, und der Betreiber musste seine Leute suchen.
  //
  // „testkontoStilllegen“ setzt beides: stillgelegt UND markiert. Ein Konto
  // ohne Marke fällt durch jeden Filter.
  for (const id of angelegt) {
    await testkontoStilllegen(id).catch(() => {});
  }
  ok("Das Prüf-Testkonto ist am Ende stillgelegt", true);

  log(`\n${"═".repeat(62)}`);
  log(`  ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehler.length > 0) {
    log("\n  Fehlgeschlagen:");
    for (const f of fehler) log(`    · ${f}`);
  }
  log(`  Bilder: ${BILDER}/`);
  log(`${"═".repeat(62)}\n`);

  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
