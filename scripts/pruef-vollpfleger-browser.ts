// ═══════════════════════════════════════════════════════════════════════════
// BROWSERTEST: DER FLUSS AM BILDSCHIRM UND AM TELEFON
//
// ── WARUM ZUSÄTZLICH ZUM ROUTEN-PRÜFSTAND ──────────────────────────────────
// AGENTS.md, 11.08.2026: „Die Route existiert" war grün, während der Knopf
// fehlte — vier Prüfungen sahen nur in den Serverquelltext. Deshalb wird hier
// GEKLICKT: Knopf finden, Formular füllen, Dubletten-Hinweis abwarten, anlegen,
// die drei Abschluss-Schritte sehen.
//
// ── UND ES ENTSTEHT NICHTS ECHTES ──────────────────────────────────────────
// Die Anlage-Route wird abgefangen (`page.route`) — sie SOLL echte Kunden
// anlegen, und ein Browsertest darf das nicht (AGENTS.md, 06.08.2026: ein
// Testlauf nahm eine echte Verpflichtungserklärung an). Die Attrappe liefert
// genau die Felder, die der echte Server liefert; alles Lesende läuft echt.
//
//   npx tsx scripts/pruef-vollpfleger-browser.ts        (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const MARKE = `PRUEFBROWSER-${Date.now().toString(36).toUpperCase()}`;

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

let testAgentId: number | null = null;

/** Alles abfangen, was schreibt. Lesendes läuft echt. */
async function attrappen(seite: Page): Promise<void> {
  // Der Katalog kommt ECHT vom Server — sonst prüft der Stand seine eigene
  // Preisliste statt der aus shared/fiaon-pakete.ts.

  // Die Dublettenprüfung: einmal leer, dann ein Treffer. So lässt sich beides
  // sehen — der ungestörte Weg und die Warnung.
  let pruefRufe = 0;
  await seite.route("**/api/fiaon/agent/kunden/pruefen", async (r) => {
    pruefRufe++;
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(pruefRufe >= 2
        ? {
            ok: true, eindeutig: true,
            treffer: [{
              personId: 4242, name: "Max Doppelgänger", ref: "FIAON-PRUEF-DOPPEL",
              email: "doppel@example.invalid", phone: "+4917600000000",
              treffer: "E-Mail", bezahlt: true, agentName: "Nikita Boychenko",
            }],
          }
        : { ok: true, eindeutig: false, treffer: [] }),
    });
  });

  await seite.route("**/api/fiaon/agent/kunden/neu", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, ref: "FIAON-PRUEF-NEU-0001", personId: 9999,
        name: `Probe ${MARKE}`,
        paket: { key: "pro", label: "FIAON Pro (Standard)", preisEuro: 59.99 },
        zahlungsreferenz: "FIAONPRUEF1",
        weiter: {
          zahlungsdatenSenden: "/agent/customers/FIAON-PRUEF-NEU-0001/send-payment-email",
          rechnung: "/api/fiaon/invoice/FIAON-PRUEF-NEU-0001",
          akte: "/agent/kunden?ref=FIAON-PRUEF-NEU-0001",
        },
      }),
    });
  });
  await seite.route("**/send-payment-email", async (r) => {
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await seite.route("**/termin-anbieten", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, gesendet: true, an: "probe@example.invalid",
        link: `${BASIS}/termin/PRUEFTOKEN123`,
      }),
    });
  });
}

async function main(): Promise<void> {
  mkdirSync("reports/vollpfleger", { recursive: true });

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
              ${`PRUEFSTAND/${MARKE}`}, 'pruef-vollpfleger-browser.ts (kein Mensch)')
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
              ${`<p>Prüfstand ${MARKE} — kein Vertrag, kein Mensch.</p>`},
              ${`${MARKE} (Prüfstand)`}, 'pruefstand', ${`pruefbrowser-${MARKE}`},
              'signed', NOW())
    `.catch(() => {});
  }

  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const token = signAgentToken(testAgentId, 0);

  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: token,
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    // ═══════════════════════════════════════════════════════════════════════
    titel("DESKTOP — der Knopf, das Formular, der Fluss");
    // ═══════════════════════════════════════════════════════════════════════
    const seite = await kontext.newPage();
    await attrappen(seite);
    await seite.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // ── AUF DEN INHALT WARTEN, NICHT AUF DAS GERÜST ──────────────────────
    const knopf = seite.getByRole("button", { name: /\+ Kunde anlegen/i }).first();
    const knopfDa = await knopf.waitFor({ state: "visible", timeout: 30_000 })
      .then(() => true).catch(() => false);
    pruef("Der Knopf „+ Kunde anlegen“ ist da", knopfDa,
      "am 23.08. gab es dafür nicht einmal eine Route");

    if (!knopfDa) {
      await seite.screenshot({ path: "reports/vollpfleger/fehler.png", fullPage: false });
      console.log("        reports/vollpfleger/fehler.png — ohne Knopf ist der Rest sinnlos");
      return;
    }

    await knopf.click();
    // ── IM BAUTEIL SUCHEN, NICHT AUF DER SEITE ───────────────────────────
    // `locator("select").first()` traf die Sortier-Auswahl der Kundenliste, und
    // `getByPlaceholder("E-Mail")` zusätzlich das Suchfeld („Name, E-Mail,
    // Nummer, Referenz"). Zwei Fehlalarme, die wie Fehler aussahen.
    const tafel = seite.locator('[data-fiaon="kunde-anlegen"]');
    await tafel.getByPlaceholder("Vorname").waitFor({ state: "visible", timeout: 10_000 });
    pruef("Das Formular klappt auf", true);

    // ── DIE FELDER ───────────────────────────────────────────────────────
    for (const feld of ["Vorname", "Nachname", "E-Mail", "Telefon"]) {
      pruef(`Feld „${feld}“ ist da`,
        await tafel.getByPlaceholder(feld).count() > 0);
    }
    const t = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Der Hinweis „E-Mail oder Telefon“ steht dabei",
      t.includes("oder") && t.includes("eines von beiden muss da sein"));

    // ── DER KATALOG KOMMT ECHT VOM SERVER ────────────────────────────────
    // ── ERST WARTEN, DANN MESSEN ────────────────────────────────────────
    // Der Katalog wird beim Aufklappen geladen (`/agent/katalog`). Ein erster
    // Entwurf las die Optionen sofort und fand nur „— noch kein Paket —" —
    // drei rote Prüfungen, obwohl die Route einwandfrei antwortet (nachgeprüft:
    // HTTP 200 mit allen neun Paketen).
    // 24.08.2026 (Justin, HIGH-END-Umbau): VORHER ein natives select mit
    // option-Zeilen — NACHHER Paketkarten (.pi-paket), weil der Browser ein
    // select in seinem eigenen Stil malt: eine weiße Liste im dunklen Glas.
    // Der Prüfstand misst dieselben drei Dinge, nur an den Karten.
    const karten = tafel.locator(".pi-paket");
    await karten.filter({ hasText: /59,99/ })
      .first().waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    const optionen = await karten.allInnerTexts();
    pruef("Die Paketauswahl ist gefüllt", optionen.length > 3, `${optionen.length} Karten`);
    pruef("… mit Preisen aus dem Katalog",
      optionen.some((o) => /59,99/.test(o)) && optionen.some((o) => /74,00/.test(o)),
      optionen.join(" | ").slice(0, 140));
    pruef("… und die Auskunft ist als einmalig gekennzeichnet",
      optionen.some((o) => /einmalig/i.test(o)),
      "sie ist kein Konto, sondern ein Einmalkauf");

    // Der Knopf muss gesperrt sein, solange Pflichtfelder fehlen.
    const anlegenKnopf = tafel.getByRole("button", { name: /^Kunde anlegen$/i }).first();
    pruef("Ohne Eingaben ist „Kunde anlegen“ gesperrt",
      await anlegenKnopf.isDisabled(), "sonst läuft der Agent in einen 400er");

    await tafel.getByPlaceholder("Vorname").fill("Probe");
    await tafel.getByPlaceholder("Nachname").fill(MARKE);
    pruef("Mit Namen allein bleibt er gesperrt", await anlegenKnopf.isDisabled(),
      "ohne Erreichbarkeit entsteht ein Datensatz, den niemand erreichen kann");

    await tafel.getByPlaceholder("E-Mail").fill(`probe.${MARKE.toLowerCase()}@example.invalid`);
    await seite.waitForTimeout(800);   // der Dubletten-Check hat 450 ms Verzug
    pruef("Mit E-Mail ist er frei", !(await anlegenKnopf.isDisabled()));

    // ── DER DUBLETTEN-HINWEIS ────────────────────────────────────────────
    // Der zweite Prüfruf der Attrappe liefert einen Treffer.
    await tafel.getByPlaceholder("Telefon").fill("+49 176 12345678");
    await seite.getByText(/Diesen Menschen gibt es schon/i).first()
      .waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    const t2 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Der Dubletten-Hinweis erscheint WÄHREND des Tippens",
      t2.includes("diesen menschen gibt es schon"),
      "wer alles eingetippt hat und dann hört „gibt es bereits“, hat umsonst gearbeitet");
    pruef("… mit dem Treffer-Merkmal", t2.includes("treffer über e-mail"));
    pruef("… mit dem betreuenden Kollegen", t2.includes("nikita boychenko"),
      "damit der Agent weiß, wen er fragen muss");
    pruef("… und einem Weg zur Akte",
      await tafel.getByRole("link", { name: /Akte öffnen/i }).count() > 0);
    pruef("… und der Warnung vor dem Doppelgänger",
      t2.includes("lässt sich nur mit aufwand zusammenführen"));

    await seite.screenshot({ path: "reports/vollpfleger/formular.png", fullPage: false });
    console.log("        reports/vollpfleger/formular.png");

    // ── ANLEGEN UND DER ABSCHLUSS ────────────────────────────────────────
    await karten.filter({ hasText: "FIAON Pro (Standard)" }).first().click();
    pruef("Die gewählte Paketkarte ist sichtbar markiert",
      await tafel.locator(".pi-paket.an").filter({ hasText: "FIAON Pro (Standard)" }).count() > 0,
      "eine Wahl, die man nicht sieht, ist keine Wahl");
    await anlegenKnopf.click();
    await seite.getByText(/ist angelegt/i).first()
      .waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
    const t3 = (await seite.locator("body").innerText()).toLowerCase();

    pruef("Nach dem Anlegen erscheint der Abschluss", t3.includes("ist angelegt"));
    pruef("… mit Paket und Verwendungszweck",
      t3.includes("fiaon pro") && t3.includes("fiaonpruef1"),
      "der Agent liest den Verwendungszweck oft am Telefon vor");
    pruef("Schritt 1: Zahlungsdaten senden",
      await tafel.getByRole("button", { name: /Zahlungsdaten senden/i }).count() > 0);
    pruef("… und kopieren (der WhatsApp-Weg)",
      await tafel.getByRole("button", { name: /Zahlungsdaten kopieren/i }).count() > 0,
      "ohne diesen Knopf tippt der Agent den Verwendungszweck ab — und vertippt sich");
    pruef("Schritt 2: Terminlink senden",
      await tafel.getByRole("button", { name: /Terminlink senden/i }).count() > 0);
    pruef("… und kopieren",
      await tafel.getByRole("button", { name: /Terminlink kopieren/i }).count() > 0);
    pruef("Die Begründung für den Termin steht dabei",
      t3.includes("alle 120 gebuchten termine kamen aus einem verschickten link"),
      "gemessen am 24.08.2026 — der Hebel wurde am Telefon nie angeboten");
    pruef("Schritt 3: zur Akte und nächster Kunde",
      await tafel.getByRole("link", { name: /Zur Akte/i }).count() > 0
        && await tafel.getByRole("button", { name: /Nächsten Kunden anlegen/i }).count() > 0);

    // Der Fluss endet wirklich: Terminlink senden.
    await tafel.getByRole("button", { name: /Terminlink senden/i }).first().click();
    await seite.getByText(/Terminlink ist unterwegs/i).first()
      .waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    const t4 = (await seite.locator("body").innerText()).toLowerCase();
    pruef("Der Versand wird bestätigt", t4.includes("terminlink ist unterwegs"));
    pruef("… mit der Adresse", t4.includes("probe@example.invalid"));

    await seite.screenshot({ path: "reports/vollpfleger/abschluss.png", fullPage: false });
    console.log("        reports/vollpfleger/abschluss.png");

    // ═══════════════════════════════════════════════════════════════════════
    titel("380 PX — derselbe Fluss am Telefon");
    // ═══════════════════════════════════════════════════════════════════════
    const schmal = await kontext.newPage();
    await schmal.setViewportSize({ width: 380, height: 900 });
    await attrappen(schmal);
    await schmal.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const knopfSchmal = schmal.getByRole("button", { name: /\+ Kunde anlegen/i }).first();
    await knopfSchmal.waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
    pruef("Der Knopf ist auf 380 px erreichbar", await knopfSchmal.count() > 0);

    // ── FINGERKUPPEN ─────────────────────────────────────────────────────
    const kasten = await knopfSchmal.boundingBox();
    pruef("Er ist mindestens 44 px hoch", (kasten?.height ?? 0) >= 44,
      `${Math.round(kasten?.height ?? 0)} px — darunter wird danebengetippt`);

    await knopfSchmal.click();
    const tafelS = schmal.locator('[data-fiaon="kunde-anlegen"]');
    await tafelS.getByPlaceholder("Vorname").waitFor({ state: "visible", timeout: 10_000 });
    await tafelS.getByPlaceholder("Vorname").fill("Handy");
    await tafelS.getByPlaceholder("Nachname").fill(MARKE);
    await tafelS.getByPlaceholder("E-Mail").fill(`handy.${MARKE.toLowerCase()}@example.invalid`);
    await schmal.waitForTimeout(700);

    const ueberlauf = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("Kein waagerechtes Schieben", !ueberlauf,
      "auf dem Telefon liest niemand seitwärts");

    // Die Felder stapeln sich, statt sich zu quetschen.
    const breiten = await schmal.evaluate(() =>
      Array.from(document.querySelectorAll(
        '[data-fiaon="kunde-anlegen"] input[placeholder="Vorname"], '
        + '[data-fiaon="kunde-anlegen"] input[placeholder="Nachname"]'))
        .map((e) => Math.round((e as HTMLElement).getBoundingClientRect().width)));
    pruef("Die Felder nehmen die ganze Breite", breiten.every((b) => b > 250),
      `${breiten.join(", ")} px — zwei Spalten wären hier je 160 px`);

    await tafelS.locator(".pi-paket").filter({ hasText: "FIAON Pro (Standard)" }).first().click();
    await tafelS.getByRole("button", { name: /^Kunde anlegen$/i }).first().click();
    await schmal.getByText(/ist angelegt/i).first()
      .waitFor({ state: "visible", timeout: 12_000 }).catch(() => {});
    const ts = (await schmal.locator("body").innerText()).toLowerCase();
    pruef("Der Abschluss erscheint auch schmal", ts.includes("ist angelegt"));
    pruef("… mit allen drei Schritten",
      ts.includes("zahlungsdaten") && ts.includes("termin anbieten") && ts.includes("zur akte"));

    const ueberlauf2 = await schmal.evaluate(() =>
      document.documentElement.scrollWidth > window.innerWidth + 2);
    pruef("Auch der Abschluss schiebt nicht", !ueberlauf2);

    await schmal.screenshot({ path: "reports/vollpfleger/schmal-380.png", fullPage: false });
    console.log("        reports/vollpfleger/schmal-380.png");

  } finally {
    await browser.close();
  }

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: reports/vollpfleger/`);
  console.log(`${"═".repeat(72)}\n`);
}

main()
  .catch((e) => { console.error(e); rot++; })
  .finally(async () => {
    // Das Testkonto legt sich still (AGENTS.md) — und die Attrappe hat nichts
    // angelegt, also gibt es keine Bestellungen aufzuräumen.
    if (testAgentId != null) {
      const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
      await testkontoStilllegen(testAgentId).catch(() => {});
      console.log(`  Testkonto ${testAgentId} stillgelegt\n`);
    }
    await sqlPool.end().catch(() => {});
    process.exit(rot > 0 ? 1 : 0);
  });
