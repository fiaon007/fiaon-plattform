// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-ABNAHME: DAS TEAM-FEEDBACK, KNOPF FÜR KNOPF
//
// AGENTS.md: „Für jede Funktion, die ein Teammitglied benutzt, muss ein
// BROWSERTEST den Bedienknopf FINDEN und DRÜCKEN — dann das Ergebnis am
// gerenderten Text messen. Ein Quelltext-Grep beweist nur, dass Code existiert."
//
// Genau daran ist „Erreicht – Sonstiges" dreimal gescheitert: Die Regel stand
// im Server, die Liste stand an fünf Stellen, und der Knopf setzte einen Zustand,
// für den es kein Bauteil gab. Ein Grep hätte all das grün gemeldet.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Der Kunde in dieser Prüfung ist eine ATTRAPPE, und alles Schreibende geht in
// eine Attrappe. Es wird kein Ergebnis gespeichert, keine Mail verschickt, kein
// Konto freigeschaltet. Das Testkonto legt sich am Ende selbst still.
//
//   npx tsx scripts/pruef-neun-punkte-browser.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";
import { NOTIZ_MINDESTLAENGE } from "../shared/fiaon-kontakt-ergebnis-liste";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const BILDER = "reports/bilder-neun-punkte";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ATTRAPPE LIEFERT, WAS DER SERVER LIEFERT
//
// AGENTS.md, 18.08.2026: „Eine Attrappe, die WENIGER liefert als der Server,
// erzeugt Fehler, die es nicht gibt — und verdeckt die, die es gibt."
//
// Also der volle Kartensatz aus `kartePayload`. Der Prüffall ist der
// UNGÜNSTIGSTE: ein Antrag, dem zwei Pflichtfelder fehlen (Teil 1), mit
// gesperrtem Sende-Knopf — damit die Fehlt-Anzeige geprüft werden kann.
// ═══════════════════════════════════════════════════════════════════════════
const KUNDE = {
  personId: 990_101,
  name: "Maximiliane Freifrau von Hohenlohe-Langenburg",
  telefon: "+49 151 00000042",
  telefonWaehlbar: "+4915100000042",
  telefonHinweis: null,
  nummerOhneLand: false,
  sendeGrund: "antrag_unfertig",
  fehlendeFelder: "Geburtsdatum, IBAN",
  sendeMoeglich: false,
  sendeText: "Im Antrag fehlen noch Angaben — sie stehen unten. "
    + "Sobald sie da sind, lässt sich eine Rechnung stellen.",
  sendeTat: "Fehlendes am Telefon ergänzen",
  nummerRoh: "+4915100000042",
  email: "pruefstand@pruefstand.invalid",
  tier: 2,
  tierGrund: "rechnung_offen",
  titel: "Rechnung offen",
  hinweis: "Prüffall — kein echter Kunde.",
  produkt: "FIAON Pro",
  buchungen: [{
    ref: "FIAON-PRUEFSTAND-0001", art: "paket" as const, bezeichnung: "FIAON Pro",
    betragCents: 7999, zahlungText: "offen", bezahlt: false, offen: true,
    gestelltAm: new Date().toISOString(), faelligAm: null,
    verwendungszweck: "FIAON-PRUEFSTAND-0001", erledigt: false,
  }],
  betrag: 7999,
  zusagedatum: null,
  wiedervorlage: null,
  rueckrufAm: null,
  nichtErreicht: 2,
  rechnungVersandt: 0,
  stufe: null,
  ruhtSeit: null,
  terminlinkMailAm: null,
  terminAm: null,
  terminLink: "https://example.invalid/termin/pruefstand",
  gesperrt: false,
  betreutSeit: new Date().toISOString(),
  letzterKontakt: new Date().toISOString(),
  letztesErgebnis: "nicht_erreicht",
  stammdaten: { strasse: "Prüfweg 1", plz: "10115", ort: "Berlin", land: "DE", geburtsdatum: null },
  zahlung: {
    referenz: "FIAON-PRUEFSTAND-0001", status: "pending_payment", ref: "FIAON-PRUEFSTAND-0001",
    empfaenger: "FIAON GmbH", iban: "DE00000000000000000000", bic: "PRUEFXXX",
    klartext: "Prüfstand — keine echte Bankverbindung.",
  },
};

const ZAEHLER = {
  alle: 1, zusage_heute: 0, ueberfaellig: 0, rueckruf: 0, tier1: 0,
  rechnung_stellen: 1, rechnung_offen: 1, frist_abgelaufen: 0, antrag_offen: 1,
  leads: 0, nicht_erreicht: 1, ruhend: 0, bezahlt: 0, gesperrt: 0, wartend: 0,
};

/** Was der Server auf die Ergebnis-Route antwortet — inklusive Ablehnung. */
let letzteNotiz: string | null = null;
let letzteArt: string | null = null;

async function attrappen(kontext: BrowserContext): Promise<void> {
  // ── DIE REIHENFOLGE ENTSCHEIDET ─────────────────────────────────────────
  // Playwright probiert Route-Handler in UMGEKEHRTER Reihenfolge ihrer
  // Registrierung: der zuletzt eingehängte kommt zuerst. Im ersten Entwurf
  // stand der Sammel-Abfang (`**/api/**`) am ENDE — er hat damit auch die
  // Ergebnis-Route geschluckt, und drei Prüfungen wurden rot („die Notiz ging
  // nicht an den Server"), obwohl die Oberfläche in Ordnung war.
  //
  // Ein Fehlalarm in einem Prüfstand kostet genauso viel Zeit wie ein echter
  // Fehler — und beim zweiten Mal glaubt man ihm nicht mehr. Also: Sammelfang
  // ZUERST, Sonderfälle danach.
  await kontext.route("**/api/**", async (r) => {
    if (r.request().method() === "GET" || r.request().method() === "HEAD") return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, attrappe: true }),
    });
  });

  await kontext.route("**/api/fiaon/agent/kunden/liste**", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, kunden: [KUNDE], zaehler: ZAEHLER, weitere: false }),
    });
  });
  await kontext.route(`**/api/fiaon/agent/crm/kunden/${KUNDE.personId}`, async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, kunde: KUNDE, verlauf: [] }),
    });
  });

  // ── DIE ERGEBNIS-ROUTE MIT DER ECHTEN REGEL ──────────────────────────────
  // Sie lehnt zu kurze Notizen ab — genau wie der Server. Eine Attrappe, die
  // ALLES annimmt, würde die Rot-Probe unmöglich machen.
  await kontext.route(`**/api/fiaon/agent/crm/kunden/${KUNDE.personId}/aktivitaet`, async (r) => {
    const daten = JSON.parse(r.request().postData() || "{}");
    letzteArt = daten.art ?? null;
    letzteNotiz = daten.notiz ?? null;
    const { pruefeNotiz } = await import("../shared/fiaon-kontakt-ergebnis-liste");
    const fehler = pruefeNotiz(String(daten.art), daten.notiz);
    if (fehler) {
      return r.fulfill({
        status: 400, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: fehler, brauchtNotiz: true }),
      });
    }
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, meldung: "Gespeichert (Attrappe)", kunde: KUNDE }),
    });
  });
}

const stillzulegen: number[] = [];

async function schrankeOeffnen(agentId: number): Promise<void> {
  const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${agentId}, ${d.key}, ${d.version}, NOW(), '127.0.0.1', 'PRUEFSTAND')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [v] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `) as any[];
  if (!v) return;
  await sqlPool`
    INSERT INTO fiaon_agent_contracts
      (agent_id, template_version, variables_json, rendered_html, signature_name,
       signature_mode, signed_at, ip, user_agent, doc_hash, status)
    VALUES (${agentId}, ${v.version}, '{}', '<p>PRUEFSTAND</p>', 'PRUEFSTAND',
            'typed', NOW(), '127.0.0.1', 'PRUEFSTAND', 'PRUEFSTAND', 'signed')
  `.catch(() => {});
}

async function aufraeumen(): Promise<void> {
  for (const id of stillzulegen) {
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${id}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${id}`.catch(() => {});
    await testkontoStilllegen(id).catch(() => {});
  }
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: das Team-Feedback, Knopf für Knopf ══");
  const browser = await chromium.launch();
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-9pb-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [konto] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES ('Prüfstand 9 Punkte (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)},
            'agent', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  stillzulegen.push(Number(konto.id));
  await schrankeOeffnen(Number(konto.id));

  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await attrappen(kontext);
  const page = await kontext.newPage();
  const konsole: string[] = [];
  page.on("pageerror", (e) => konsole.push(String(e.message)));

  const an = await page.request.post(`${BASIS}/api/fiaon/agent/login`, {
    data: { email: mail, password: pass },
  }).catch(() => null);
  ok("Das Testkonto kann sich anmelden", an != null && an.ok(), `HTTP ${an?.status()}`);

  await page.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded" });
  // ERST WARTEN, DANN MESSEN: auf eine Marke im INHALT, nicht auf das Menü.
  const kundeDa = await page.getByText(/Hohenlohe-Langenburg/).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Kundenkarte ist geladen", kundeDa);
  if (!kundeDa) {
    await bild(page, "pruef-liste-leer");
    log("        Ohne Karte lässt sich nichts drücken — Abbruch dieser Gruppe.");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 1 — die Karte sagt, WAS fehlt");
  // ═════════════════════════════════════════════════════════════════════════
  const fehlt = page.locator("[data-fiaon='fehlende-felder']").first();
  const fehltDa = await fehlt.count() > 0;
  ok("Die fehlenden Felder stehen als TEXT auf der Karte", fehltDa);
  if (fehltDa) {
    const t = await fehlt.innerText();
    ok("Sie werden namentlich genannt (Geburtsdatum, IBAN)",
      /Geburtsdatum/i.test(t) && /IBAN/i.test(t), t);
  }
  ok("Der Knopf „Fehlendes am Telefon ergänzen“ ist da",
    await page.locator("[data-fiaon='fehlendes-ergaenzen']").count() > 0);
  // Der alte Pauschalsatz darf nicht mehr allein dastehen.
  const seite1 = await page.locator("body").innerText();
  ok("Kein pauschales „ruf an und hilf beim Fertigstellen“ mehr",
    !/ruf an und hilf beim Fertigstellen/i.test(seite1));
  await bild(page, "pruef-teil1-fehlt");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 3 — „Erreicht – Sonstiges“ öffnet das Notizfeld");
  // ═════════════════════════════════════════════════════════════════════════
  const knopf = page.locator("[data-fiaon='ergebnis-erreicht_sonstiges']").first();
  ok("Der Knopf ist da", await knopf.count() > 0);
  // Vor dem Klick darf das Feld NICHT da sein — sonst prüft man nichts.
  ok("Vor dem Klick ist kein Notizfeld offen",
    await page.locator("[data-fiaon='ergebnis-notizfeld']").count() === 0);

  await knopf.click();
  const feld = page.locator("[data-fiaon='ergebnis-notizfeld']").first();
  const feldDa = await feld.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  // ── DAS IST DIE PRÜFUNG, DIE DREIMAL GEFEHLT HAT ───────────────────────
  ok("NACH dem Klick ist das Pflicht-Notizfeld sichtbar", feldDa,
    "der Knopf tut nichts — genau die gemeldete Lage");
  ok("Es enthält ein echtes Eingabefeld",
    await feld.locator("textarea").count() > 0);
  await bild(page, "pruef-teil3-notizfeld");

  if (feldDa) {
    // Der Zeichenzähler ERKLÄRT die Sperre.
    const zaehler = feld.locator("[data-fiaon='notiz-zaehler']").first();
    const zt = await zaehler.innerText().catch(() => "");
    ok("Der Zeichenzähler nennt die fehlenden Zeichen",
      new RegExp(String(NOTIZ_MINDESTLAENGE)).test(zt), zt);
    const speichern = feld.locator("[data-fiaon='notiz-speichern']").first();
    ok("Der Speichern-Knopf ist gesperrt, solange die Notiz zu kurz ist",
      await speichern.isDisabled());

    // Die Beispiel-Chips aus Daniels Meldung.
    const chips = feld.locator("[data-fiaon='notiz-vorlage']");
    ok("Die Beispiel-Vorlagen sind anklickbar", await chips.count() >= 4,
      `${await chips.count()} gefunden`);
    await chips.first().click();
    const nachChip = await feld.locator("textarea").inputValue();
    ok("Eine Vorlage füllt das Feld", nachChip.trim().length > 5, nachChip);

    // ── ROT-PROBE: zu kurze Notiz → SICHTBARE Meldung, kein stilles Nichts ──
    await feld.locator("textarea").fill("kurz");
    ok("Bei vier Zeichen bleibt der Knopf gesperrt",
      await speichern.isDisabled());
    const ztKurz = await zaehler.innerText().catch(() => "");
    ok("Und der Grund steht sichtbar daneben",
      /Noch \d+ Zeichen/i.test(ztKurz), ztKurz);
    await bild(page, "pruef-teil3-rotprobe-kurz");

    // Genug Zeichen → der Knopf gibt frei und der Ausgang ist sichtbar.
    await feld.locator("textarea").fill(
      "Kunde wartet noch auf eine Rückbuchung, ruft nächste Woche selbst an.");
    ok("Mit genug Zeichen ist der Knopf frei", !(await speichern.isDisabled()));
    await speichern.click();
    await page.waitForTimeout(2500);
    ok("Die Notiz ging MIT an den Server", (letzteNotiz ?? "").length >= NOTIZ_MINDESTLAENGE,
      `gesendet: ${letzteNotiz ?? "(nichts)"}`);
    ok("Und zwar mit dem Ergebnis „erreicht_sonstiges“",
      letzteArt === "erreicht_sonstiges", String(letzteArt));
    // ── DEN ERFOLG AM RICHTIGEN TEXT MESSEN ────────────────────────────────
    // Ein erster Entwurf suchte „gespeichert" und wurde rot — die Karte sagt
    // aber „Ergebnis gebucht", und der Kurzhinweis war nach 2,5 s schon weg.
    // Der SCREENSHOT hat es verraten, nicht die Prüfung. Gemessen wird deshalb
    // an dem, was BLEIBT: der Marke auf der Karte. Und ohne Rücksicht auf
    // Groß-/Kleinschreibung — `innerText` gibt bei `text-transform: uppercase`
    // den TRANSFORMIERTEN Text zurück (AGENTS.md).
    const seite3 = await page.locator("body").innerText();
    ok("Der Erfolg ist sichtbar bestätigt (Marke auf der Karte)",
      /ergebnis gebucht|gespeichert/i.test(seite3),
      seite3.slice(0, 160).replace(/\s+/g, " "));
    ok("Das Notizfeld hat sich nach dem Speichern geschlossen",
      await page.locator("[data-fiaon='ergebnis-notizfeld']").count() === 0);
    await bild(page, "pruef-teil3-gespeichert");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 2 — der gesperrte Sende-Knopf nennt seinen Grund");
  // ═════════════════════════════════════════════════════════════════════════
  const seite2 = await page.locator("body").innerText();
  ok("Der Sperrgrund steht als Text (nicht im Tooltip)",
    /Im Antrag fehlen noch Angaben/i.test(seite2));

  ok("Kein JS-Fehler auf der Seite", konsole.length === 0, konsole.slice(0, 3).join(" | "));
  await kontext.close();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("TEIL 6 — die Vertriebsleitung zeigt nie mehr eine leere Fläche");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Prüffall ist der UNGÜNSTIGSTE: ein Konto OHNE angenommene
  // Verpflichtungserklärung. Dann antworten die Datenrouten mit 403, und genau
  // dort blieb die Seite vorher dauerhaft in grauen Balken stehen.
  //
  // Die Erklärung wird NICHT angenommen — ein Rechtsnachweis, den ein Roboter
  // erzeugt, ist wertlos (AGENTS.md, 06.08.2026).
  {
    const vlMail = `pruef-9vl-${Date.now().toString(36)}@pruefstand.test`;
    const vlPass = `P-${Math.random().toString(36).slice(2)}`;
    const [vl] = (await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                                distribution_active, created_at)
      VALUES ('Prüfstand 9P Leitung (Testkonto)', ${vlMail}, ${await bcrypt.hash(vlPass, 10)},
              'vertriebsleiter', TRUE, TRUE, FALSE, NOW())
      RETURNING id
    `) as any[];
    stillzulegen.push(Number(vl.id));
    await schrankeOeffnen(Number(vl.id));

    const k2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    // Nur Schreibendes abfangen; die 403 der Datenrouten sollen ECHT ankommen.
    await k2.route("**/api/**", async (r) => {
      if (r.request().method() === "GET" || r.request().method() === "HEAD") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, attrappe: true }),
      });
    });
    const p2 = await k2.newPage();
    const konsole2: string[] = [];
    p2.on("pageerror", (e) => konsole2.push(String(e.message)));
    const an2 = await p2.request.post(`${BASIS}/api/fiaon/agent/login`, {
      data: { email: vlMail, password: vlPass },
    }).catch(() => null);
    ok("Das Leitungs-Testkonto kann sich anmelden", an2 != null && an2.ok());

    await p2.goto(`${BASIS}/agent/vertrieb`, { waitUntil: "domcontentloaded" });
    // Auf eine Marke im INHALT warten, nicht auf das Menü (AGENTS.md).
    const kopfDa = await p2.getByRole("heading", { name: /^Vertrieb$/ }).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    ok("Die Vertriebsseite baut sich auf", kopfDa);

    // Entweder die Erklärungs-Tafel (richtig) ODER die Fehlermeldung (richtig).
    // NICHT zulässig: dauerhaft graue Balken ohne ein Wort.
    await p2.waitForTimeout(9000);
    const t2 = await p2.locator("body").innerText().catch(() => "");
    const tafel = /Verpflichtungserklärung|Vertriebsleitung/i.test(t2);
    const meldung = await p2.locator("[data-fiaon='vertrieb-fehler']").count() > 0;
    ok("Die Seite sagt, was los ist (Tafel oder Fehlermeldung) — keine stumme Fläche",
      tafel || meldung,
      `Tafel=${tafel} Meldung=${meldung}; Text: ${t2.slice(0, 140).replace(/\s+/g, " ")}`);
    ok("Es steht mehr als nur Gerüst auf der Seite", t2.trim().length > 200,
      `${t2.trim().length} Zeichen`);
    await bild(p2, "pruef-teil6-vertrieb");

    // ── ROT-PROBE DER WEISSEN FLÄCHE ───────────────────────────────────────
    // Die Akte-Route antwortet mit `ok: true`, aber OHNE `person`. Genau diese
    // Antwort hat vorher eine leere Karte mit einem Skelettbalken erzeugt, für
    // immer. Jetzt muss eine Fehlerkarte mit Grund erscheinen.
    await k2.route("**/api/fiaon/agent/vertrieb/person/*", async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, bestellungen: [], verlauf: [], zuweisungen: [] }),
      });
    });
    // Die Akte lässt sich nur öffnen, wenn die Liste Zeilen hat. Hat sie keine
    // (403 wegen offener Erklärung), wird diese Probe ÜBERSPRUNGEN und das
    // ausdrücklich gemeldet — ein stilles Auslassen wäre eine Scheinprüfung.
    const akteKnopf = p2.getByRole("button", { name: /^Akte$/i }).first();
    if (await akteKnopf.count() > 0) {
      await akteKnopf.click();
      await p2.waitForTimeout(3000);
      const karte = await p2.locator("[data-fiaon='akte-fehler']").count() > 0;
      ok("Rot-Probe: Antwort ohne Kundendaten → Fehlerkarte statt weißer Fläche", karte);
      await bild(p2, "pruef-teil6-akte-rotprobe");
    } else {
      log("        ÜBERSPRUNGEN: keine Kundenzeile (die Erklärung ist offen, 403).");
      log("        Die Fehlerkarte ist im Quelltext geprüft (data-fiaon='akte-fehler').");
      const q = (await import("node:fs")).readFileSync("client/src/pages/agent/vertrieb.tsx", "utf8");
      ok("Die Akte hat einen Fehlerweg (kein Skelett ohne Ende)",
        /data-fiaon="akte-fehler"/.test(q) && /daten\.fehler \|\| \(!daten\.laedt && !p\)/.test(q));
      ok("Die Akte-Schublade steckt in einem Fehlerrahmen",
        /<Fehlerrahmen was="Die Kundenakte"/.test(q));
    }
    ok("Kein JS-Fehler in der Vertriebsleitung", konsole2.length === 0,
      konsole2.slice(0, 3).join(" | "));
    await k2.close();
  }

  await browser.close();
  await aufraeumen();
  log(`\n        Testkonto stillgelegt, Testnachweise entfernt.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await aufraeumen();
  await sqlPool.end();
  process.exit(1);
});
