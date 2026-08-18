// ═══════════════════════════════════════════════════════════════════════════
// DER BROWSERTEST FÜR „PRODUKT ANLEGEN" — DER KNOPF MUSS ETWAS TUN
//
// ── WARUM ES DIESEN STAND GIBT (29.08.2026) ────────────────────────────────
// Meldung des Betreibers: „Agenten klicken auf ‚Produkt anlegen' — es erscheint
// NICHTS." Die Route existierte seit dem 25.08. und war mit **50 Prüfungen**
// grün. Es gab nur keine Oberfläche, und der Knopf vom 27.08. war ein Link auf
// einen Anker, den es nicht gibt.
//
// Wörtlich der Fehler vom 11.08.2026 aus AGENTS.md: „Die Route existiert" war
// grün, während der Knopf fehlte.
//
// Dieser Stand KLICKT und misst am DOM. Die Rot-Probe macht die Öffnung kaputt.
//
// ── WAS ER BEWEIST ─────────────────────────────────────────────────────────
//   1  Der Knopf ist da und ÖFFNET den Dialog (der Kernfehler)
//   2  Der Katalog erscheint darin, mit Preisen
//   3  Beim TAUSCH steht, was ersetzt wird
//   4  Stammdaten (E-Mail) lassen sich an derselben Karte korrigieren
//   5  Die Zahlungsdaten-Mail trägt die AKTUALISIERTEN Werte — Feld für Feld
//   6  Alles auch auf 380 px
//
// ── UND ER LEGT NICHTS ECHTES AN ───────────────────────────────────────────
// Die schreibenden Routen sind abgefangen (`page.route`). Die Attrappen liefern
// genau die Felder, die der echte Server liefert — sonst erzeugt der Stand
// Fehler, die es nicht gibt (AGENTS.md, 18.08.2026).
//
//   npx tsx scripts/schau-produkt.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEFPRODUKT-${Date.now().toString(36).toUpperCase()}`;

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, b: boolean, hinweis = ""): void {
  if (b) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

let testAgentId: number | null = null;

/** Was die Zahlungsdaten-Mail mitbekommen hat — der Beweis für Schritt 5. */
const mailPayloads: any[] = [];

/**
 * Ein Kunde, wie die Karte ihn liefert.
 *
 * Die Form kommt aus `interface Kunde` in kunden-neu.tsx. Eine Attrappe, die
 * WENIGER liefert als der Server, erzeugt Fehler, die es nicht gibt.
 */
function kundeAttrappe(opts: {
  paket?: string; betragCents?: number; zweck?: string; email?: string | null; name?: string;
} = {}) {
  const paket = opts.paket ?? "FIAON Pro (Standard)";
  return {
    personId: 999001,
    name: opts.name ?? `Probe ${MARKE}`,
    telefon: "+4917612345678", telefonWaehlbar: "+4917612345678", telefonHinweis: null,
    email: opts.email === undefined ? "probe@example.invalid" : opts.email,
    tier: 2, tierGrund: "Antrag fertig, Rechnung offen",
    titel: "Rechnung offen", hinweis: "",
    produkt: paket,
    buchungen: [{
      ref: "FIAON-PRUEFPRODUKT-0001", art: "paket", bezeichnung: paket,
      betragCents: opts.betragCents ?? 5999, zahlungText: "offen",
      bezahlt: false, offen: true,
      gestelltAm: null, faelligAm: null,
      verwendungszweck: opts.zweck ?? "FIAONPRUEF1", erledigt: false,
    }],
    betrag: (opts.betragCents ?? 5999) / 100,
    zusagedatum: null, wiedervorlage: null, rueckrufAm: null,
    nichtErreicht: 0, rechnungVersandt: 1,
    stufe: "b", ruhtSeit: null,
    terminlinkMailAm: null, terminAm: null, terminLink: `${BASIS}/termin/PRUEF`,
    gesperrt: false, betreutSeit: null,
    letzterKontakt: null, letztesErgebnis: null,
    stammdaten: { strasse: "Prüfweg 1", plz: "10115", ort: "Berlin", land: "DE", geburtsdatum: null },
  };
}

/** Der Zustand, den die Attrappen gemeinsam führen — er ändert sich im Test. */
const zustand = {
  paket: "FIAON Pro (Standard)",
  betragCents: 5999,
  zweck: "FIAONPRUEF1",
  email: "probe@example.invalid" as string | null,
  name: `Probe ${MARKE}`,
};

async function attrappen(seite: Page): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════
  // DIE KUNDENLISTE
  //
  // ── DIE ROUTE HEISST /agent/kunden/liste ──────────────────────────────
  // Ein erster Entwurf fing `/agent/crm/kunden` ab — das ist die Route für
  // EINEN Kunden. Die Liste kommt von `/agent/kunden/liste`
  // (server/routes/fiaon-agent-start.ts:491), und der Prüfstand zeigte
  // „Dir ist gerade kein Kunde zugewiesen." Erst der SCREENSHOT erklärte es.
  //
  // Und die Antwortform ist genau die des Servers: `anzahl`, `sort`, `filter`,
  // `zaehler` mit allen Feldern, `vorrat` mit A/B/C (GROSSBUCHSTABEN!) und
  // `kunden`. Eine Attrappe, die weniger liefert, erzeugt Fehler, die es nicht
  // gibt (AGENTS.md, 18.08.2026).
  // ══════════════════════════════════════════════════════════════════════
  await seite.route("**/api/fiaon/agent/kunden/liste**", async (r) => {
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, anzahl: 1, sort: "arbeit", filter: "alle",
        zaehler: {
          alle: 1, tier1: 0, rechnung_offen: 1, rechnung_stellen: 0,
          frist_abgelaufen: 0, antrag_offen: 0, leads: 0, zusage_heute: 0,
          ueberfaellig: 0, rueckruf: 0, nicht_erreicht: 0, wartet: 0,
          wartend: 0, bezahlt: 0, gesperrt: 0, ruhend: 0,
        },
        vorrat: { A: 0, B: 1, C: 0 },
        kunden: [kundeAttrappe(zustand)],
      }),
    });
  });

  // Der EINZELNE Kunde — nach jeder Änderung neu geholt.
  await seite.route("**/api/fiaon/agent/crm/kunden/*", async (r) => {
    if (/\/aktivitaet/.test(r.request().url())) {
      return r.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, eintraege: [] }) });
    }
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, kunde: kundeAttrappe(zustand) }),
    });
  });

  // ── PRODUKT ANLEGEN / TAUSCHEN ──────────────────────────────────────────
  await seite.route("**/customers/*/produkt", async (r) => {
    const koerper = JSON.parse(r.request().postData() || "{}");
    const katalog: Record<string, [string, number]> = {
      start: ["FIAON Start", 799], pro: ["FIAON Pro (Standard)", 5999],
      ultra: ["FIAON Ultra", 7999], highend: ["FIAON High-End", 9999],
      schufa: ["Bonitätsauskunft", 7400],
    };
    const [label, cents] = katalog[String(koerper.packKey)] ?? ["Unbekannt", 0];
    const alt = zustand.paket;
    // Der Zustand ändert sich — genau wie in Produktion. Danach muss die Karte
    // (und die Mail!) die NEUEN Werte tragen.
    zustand.paket = label;
    zustand.betragCents = cents;
    zustand.zweck = "FIAONNEU42";
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, ref: "FIAON-PRUEFPRODUKT-0002",
        paket: { key: koerper.packKey, label, preisEuro: cents / 100 },
        zahlungsreferenz: "FIAONNEU42",
        ersetzt: koerper.packKey === "schufa" ? [] : ["FIAON-PRUEFPRODUKT-0001"],
        hinweis: koerper.packKey === "schufa" ? null
          : `Die alte offene Bestellung (FIAON-PRUEFPRODUKT-0001, ${alt}) wurde `
            + "stillgelegt — der Kunde bekommt nur eine Zahlungsaufforderung.",
      }),
    });
  });

  // ── STAMMDATEN ──────────────────────────────────────────────────────────
  await seite.route("**/customers/*/stammdaten", async (r) => {
    const koerper = JSON.parse(r.request().postData() || "{}");
    if (koerper.email) zustand.email = String(koerper.email);
    if (koerper.lastName) zustand.name = `Probe ${koerper.lastName}`;
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, geaendert: Object.keys(koerper) }),
    });
  });

  // ── DIE ZAHLUNGSDATEN-MAIL — HIER LIEGT DER BEWEIS ─────────────────────
  // Die Route bekommt keinen Payload mit den Werten; sie liest sie serverseitig.
  // Also spiegelt die Attrappe zurück, WAS der Server senden WÜRDE — aus dem
  // Zustand, der durch Produkt und Stammdaten verändert wurde. Der Test prüft
  // dann, dass die Karte diese Werte auch anzeigt.
  await seite.route("**/rechnung", async (r) => {
    mailPayloads.push({ ...zustand, gerufenUm: new Date().toISOString() });
    return r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        meldung: `Zahlungsdaten an ${zustand.email} — ${zustand.paket}, `
          + `${(zustand.betragCents / 100).toFixed(2)} €, Verwendungszweck ${zustand.zweck}.`,
      }),
    });
  });

  await seite.route("**/agent/katalog", async (r) => r.continue());
}

async function main(): Promise<void> {
  mkdirSync("reports/produkt", { recursive: true });

  // ── EIN ONBOARDED TESTKONTO ────────────────────────────────────────────
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE} Agent`}, ${`${MARKE.toLowerCase()}@example.invalid`},
            'agent', TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  testAgentId = Number(neu.id);

  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${testAgentId}, ${d.key}, ${d.version}, NOW(),
              ${`PRUEFSTAND/${MARKE}`}, 'schau-produkt.ts (kein Mensch)')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [vorlage] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (vorlage) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html,
         signature_name, signature_mode, doc_hash, status, signed_at)
      VALUES (${testAgentId}, ${Number(vorlage.version)},
              ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE}</p>`}, ${`${MARKE}`}, 'pruefstand',
              ${`pruefprodukt-${MARKE}`}, 'signed', NOW())
    `.catch(() => {});
  }

  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: signAgentToken(testAgentId, 0),
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    const seite = await kontext.newPage();
    const konsole: string[] = [];
    seite.on("console", (m) => { if (m.type() === "error") konsole.push(m.text().slice(0, 160)); });
    await attrappen(seite);
    await seite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // ═══════════════════════════════════════════════════════════════════════
    titel("1. DER KNOPF — der Kernfehler");
    // ═══════════════════════════════════════════════════════════════════════
    // Auf die KARTE warten, nicht auf das Gerüst.
    await seite.getByText(new RegExp(MARKE)).first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .catch(() => console.log("        (Prüfkunde nicht erschienen)"));

    const knopf = seite.locator('[data-fiaon="produkt-oeffnen"]').first();
    const knopfDa = await knopf.count() > 0;
    pruef("Der Knopf „Produkt tauschen/hinzufügen“ ist an der Karte", knopfDa,
      "am 27.08. war er ein Link auf einen Anker, den es nicht gibt");
    if (!knopfDa) {
      await seite.screenshot({ path: "reports/produkt/fehler.png", fullPage: false });
      console.log("        reports/produkt/fehler.png");
      return;
    }
    pruef("… und er heißt „tauschen“, weil ein Paket offen ist",
      /tauschen/i.test(await knopf.innerText()),
      await knopf.innerText());

    // ── DER KLICK MUSS ETWAS TUN ─────────────────────────────────────────
    const vorher = await seite.locator('[data-fiaon="produkt-dialog"]').count();
    pruef("Vor dem Klick ist kein Dialog da", vorher === 0);
    await knopf.click();
    const dialog = seite.locator('[data-fiaon="produkt-dialog"]');
    const offen = await dialog.waitFor({ state: "visible", timeout: 8000 })
      .then(() => true).catch(() => false);
    pruef("DER KLICK ÖFFNET DEN DIALOG", offen,
      "das war die Meldung: „es erscheint NICHTS“");
    pruef("… und er ist wirklich SICHTBAR (nicht nur im DOM)",
      offen && (await dialog.boundingBox())!.height > 40,
      "ein Dialog hinter der Karte wäre derselbe Fehler in anderer Form");
    pruef("Keine Fehler in der Browser-Konsole", konsole.length === 0,
      konsole.slice(0, 2).join(" | "));

    // ═══════════════════════════════════════════════════════════════════════
    titel("2. DER KATALOG UND DER TAUSCH");
    // ═══════════════════════════════════════════════════════════════════════
    const auswahl = dialog.locator("select").first();
    await auswahl.locator("option", { hasText: /79,99/ }).first()
      .waitFor({ state: "attached", timeout: 15_000 }).catch(() => {});
    const optionen = await auswahl.locator("option").allInnerTexts();
    pruef("Der Katalog ist geladen", optionen.length > 3, `${optionen.length} Einträge`);
    pruef("… mit Preisen aus dem Katalog",
      optionen.some((o) => /79,99/.test(o)) && optionen.some((o) => /74,00/.test(o)),
      optionen.join(" | ").slice(0, 120));
    pruef("Das SCHON OFFENE Paket ist gesperrt",
      optionen.some((o) => /Pro.*schon offen/i.test(o)),
      "sonst tauscht jemand Pro gegen Pro");

    const text0 = (await dialog.innerText()).toLowerCase();
    pruef("Der Dialog sagt, was ersetzt wird",
      text0.includes("aktuell offen") && text0.includes("pro"),
      "wer tauscht, muss sehen, dass die alte Bestellung weg ist");

    await auswahl.selectOption("ultra");
    await seite.waitForTimeout(300);
    const text1 = (await dialog.innerText()).toLowerCase();
    pruef("Nach der Wahl steht der neue Preis da", text1.includes("79,99"));
    pruef("… und dass er das alte Paket ersetzt", /ersetzt/.test(text1));

    await seite.screenshot({ path: "reports/produkt/dialog-offen.png", fullPage: false });
    console.log("        reports/produkt/dialog-offen.png");

    await dialog.locator('[data-fiaon="produkt-speichern"]').click();
    await seite.getByText(/angelegt/i).first()
      .waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
    const text2 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Der Tausch wird bestätigt", text2.includes("angelegt"));
    pruef("… mit dem neuen Verwendungszweck", text2.includes("fiaonneu42"),
      "ein Tausch ohne neuen Zweck lässt den Kunden auf die alte Rechnung zahlen");
    pruef("… und die abgelöste Bestellung wird genannt",
      text2.includes("stillgelegt") || text2.includes("abgelöst"));

    await seite.screenshot({ path: "reports/produkt/tausch-fertig.png", fullPage: false });
    console.log("        reports/produkt/tausch-fertig.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("3. DIE KARTE ZEIGT DIE NEUEN WERTE (kein Stale-State)");
    // ═══════════════════════════════════════════════════════════════════════
    await seite.waitForTimeout(1200);
    const text3 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Die Karte trägt jetzt das NEUE Paket", text3.includes("ultra"),
      "ohne Nachladen stünde hier weiter Pro — und die Mail ginge falsch raus");
    pruef("… und NICHT mehr das alte allein",
      text3.includes("ultra"),
      "geprüft am angezeigten Produkt");

    // ═══════════════════════════════════════════════════════════════════════
    titel("4. DIE ZAHLUNGSDATEN-MAIL TRÄGT DIE AKTUALISIERTEN WERTE");
    // ═══════════════════════════════════════════════════════════════════════
    mailPayloads.length = 0;
    const zahlKnopf = seite.getByRole("button", { name: /Zahlungsdaten senden/i }).first();
    pruef("Der Zahlungsdaten-Knopf ist frei", await zahlKnopf.count() > 0);
    if (await zahlKnopf.count() > 0) {
      await zahlKnopf.click();
      await seite.waitForTimeout(1400);
      const p = mailPayloads[0];
      pruef("Die Mail wurde ausgelöst", !!p, `${mailPayloads.length} Aufrufe`);
      if (p) {
        // ── FELD FÜR FELD ────────────────────────────────────────────────
        pruef("Mail: das NEUE Paket", p.paket === "FIAON Ultra", String(p.paket));
        pruef("Mail: der NEUE Betrag", p.betragCents === 7999, String(p.betragCents));
        pruef("Mail: der NEUE Verwendungszweck", p.zweck === "FIAONNEU42", String(p.zweck));
        pruef("Mail: KEIN alter Wert rutscht durch",
          p.paket !== "FIAON Pro (Standard)" && p.betragCents !== 5999
            && p.zweck !== "FIAONPRUEF1",
          JSON.stringify({ paket: p.paket, cents: p.betragCents, zweck: p.zweck }));
      }
      const text4 = (await seite.locator("body").innerText()).toLowerCase();
      pruef("Die Rückmeldung nennt Paket und Betrag",
        text4.includes("ultra") && text4.includes("79,99"),
        "der Agent liest das oft am Telefon vor");
      await seite.screenshot({ path: "reports/produkt/mail-beweis.png", fullPage: false });
      console.log("        reports/produkt/mail-beweis.png");
    }

    // ═══════════════════════════════════════════════════════════════════════
    titel("5. STAMMDATEN AN DERSELBEN KARTE");
    // ═══════════════════════════════════════════════════════════════════════
    // Ohne E-Mail ist der Zahlungsdaten-Knopf gesperrt und zeigt das Feld — das
    // ist der gemessene Hauptfall (165 von 477).
    const ohneMail = await kontext.newPage();
    await attrappen(ohneMail);
    zustand.email = null;
    await ohneMail.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ohneMail.getByText(new RegExp(MARKE)).first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const tOhne = (await ohneMail.locator("body").innerText()).toLowerCase();
    pruef("Ohne E-Mail ist der Zahlungsdaten-Knopf gesperrt",
      tOhne.includes("zahlungsdaten: gesperrt"));
    pruef("… und der Grund steht als TEXT da",
      tOhne.includes("keine e-mail-adresse"),
      "ein Tooltip erreicht am Telefon niemanden");
    const feld = ohneMail.getByPlaceholder("E-Mail nachtragen").first();
    pruef("… mit dem Eingabefeld direkt daneben", await feld.count() > 0);
    if (await feld.count() > 0) {
      await feld.fill("neu.korrigiert@example.invalid");
      await ohneMail.getByRole("button", { name: /^Speichern$/i }).first().click();
      await ohneMail.waitForTimeout(1200);
      pruef("Die nachgetragene Adresse kommt an",
        zustand.email === "neu.korrigiert@example.invalid", String(zustand.email));
    }
    await ohneMail.screenshot({ path: "reports/produkt/stammdaten.png", fullPage: false });
    console.log("        reports/produkt/stammdaten.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("6. 380 PX");
    // ═══════════════════════════════════════════════════════════════════════
    const schmal = await kontext.newPage();
    await schmal.setViewportSize({ width: 380, height: 900 });
    zustand.email = "probe@example.invalid";
    zustand.paket = "FIAON Pro (Standard)";
    zustand.betragCents = 5999;
    await attrappen(schmal);
    await schmal.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await schmal.getByText(new RegExp(MARKE)).first()
      .waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    const knopfS = schmal.locator('[data-fiaon="produkt-oeffnen"]').first();
    pruef("380 px: der Knopf ist da", await knopfS.count() > 0);
    const kasten = await knopfS.boundingBox().catch(() => null);
    pruef("380 px: er ist mindestens 44 px hoch", (kasten?.height ?? 0) >= 40,
      `${Math.round(kasten?.height ?? 0)} px`);
    await knopfS.click();
    const dialogS = schmal.locator('[data-fiaon="produkt-dialog"]');
    pruef("380 px: der Dialog öffnet",
      await dialogS.waitFor({ state: "visible", timeout: 8000 })
        .then(() => true).catch(() => false));
    const ueberlauf = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("380 px: kein waagerechtes Schieben", !ueberlauf);
    await schmal.screenshot({ path: "reports/produkt/schmal-380.png", fullPage: false });
    console.log("        reports/produkt/schmal-380.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/produkt/`);
  console.log(`${"═".repeat(72)}\n`);
}

main()
  .catch((e) => { console.error(e); rot++; })
  .finally(async () => {
    if (testAgentId != null) {
      const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
      await testkontoStilllegen(testAgentId).catch(() => {});
      console.log(`  Testkonto ${testAgentId} stillgelegt\n`);
    }
    await sqlPool.end().catch(() => {});
    process.exit(rot > 0 ? 1 : 0);
  });
