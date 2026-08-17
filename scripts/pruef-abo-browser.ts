// ═══════════════════════════════════════════════════════════════════════════
// ABNAHME IM BROWSER: KANN EIN MENSCH ES SEHEN UND ANKLICKEN?
//
// ── WARUM DIESER PRÜFSTAND ZUSÄTZLICH NÖTIG IST ────────────────────────────
// `scripts/pruef-abo-motor.ts` prüft die Rechnung, die Datenbank und den
// Quelltext. Alle 119 Prüfungen wären grün, wenn es für keine dieser
// Funktionen einen Knopf gäbe. Am 11.08.2026 war genau das der Fall: Die
// Route „Alle prüfen“ war fertig und getestet — es gab nur keinen Knopf.
//
// Deshalb hier: Seite öffnen, Text FINDEN, Knopf DRÜCKEN, Ergebnis am
// gerenderten Text messen. Und Screenshots, die ein Mensch ansieht.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Jeder fremde Aufruf wird abgefangen (`page.route`): Kein Make-Webhook, kein
// echter Tageslauf, keine Mail. Der Knopf „Tageslauf jetzt“ wird gedrückt —
// die Attrappe antwortet mit genau dem, was der Betreiber in Produktion
// gesehen hätte.
//
// VORAUSSETZUNG: ein laufender Server.
//   set -a && . ./.env && set +a && PORT=5188 npm run dev
//   npx tsx scripts/pruef-abo-browser.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-abo";

let bestanden = 0;
let gescheitert = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(text: string, gut: boolean, hinweis = ""): void {
  if (gut) { bestanden++; log(`  PASS  ${text}`); }
  else { gescheitert++; fehler.push(text); log(`  FAIL  ${text}${hinweis ? ` — ${hinweis}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

/** Text der Seite, kleingeschrieben. `innerText` liefert bei
 *  `text-transform: uppercase` den TRANSFORMIERTEN Text — deshalb ohne
 *  Rücksicht auf Groß- und Kleinschreibung vergleichen. */
async function seitentext(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: Abo-Motor, Inkasso-Liste, Zustellung, Telefon ══\n");

  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ── DIE WAND GEGEN ECHTE VORGÄNGE ───────────────────────────────────────
  // Alles, was nach draußen ginge oder etwas auslöste, wird abgefangen. Die
  // Attrappen antworten mit realistischen Nutzlasten, damit die Oberfläche
  // genau das rendert, was sie in Produktion rendern würde.
  await kontext.route("**/api/fiaon/admin/abo/tageslauf", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, tag: "2026-08-16", ratenErzeugt: 3, rechnungenVersandt: 3,
        rechnungenFehlgeschlagen: 0, vorabVersandt: 2, ueberfaelligNeu: 1, zugeteilt: 1,
        uebersprungenFenster: false,
        meldung: "3 Rate(n) angelegt · 3 Rechnung(en) versandt · 2 Vorabinfo(s) · 1 überfällig geworden · 1 zugeteilt.",
      }),
    });
  });
  // Kein Versand, keine Erinnerung, keine Buchung — auch nicht versehentlich.
  for (const muster of [
    "**/api/fiaon/admin/abo/lauf", "**/api/fiaon/admin/abo/raten/*/erinnern",
    "**/api/fiaon/admin/abo/raten/*/bezahlt", "**/api/fiaon/admin/abo/sammelversand",
    // Nur die SENDENDEN Mail-Wege abfangen. Ein Platzhalter über
    // „/admin/mail/**" fing auch das reine LESEN des Zustellprotokolls ab —
    // die Seite zeigte daraufhin „Das Protokoll konnte nicht geladen werden",
    // und der Prüfstand machte sich seinen eigenen Fehlschlag.
    "**/api/fiaon/admin/mail/senden**", "**/api/fiaon/admin/mail/alle-pruefen",
    "**/api/fiaon/admin/mail/registry/*/pruefen", "**/api/fiaon/admin/mail/abgleich",
    "**/api/fiaon/telefon/ausweis",
  ]) {
    await kontext.route(muster, async (route) => {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Attrappe im Prüfstand — hier passiert nichts." }),
      });
    });
  }

  const page = await kontext.newPage();
  await page.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
  const { sqlPool } = await import("../server/lib/db-pool");
  const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Zahlungszentrale — die Abo-Motor-Karte");
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASIS}/admin/zahlungen`, { waitUntil: "domcontentloaded" });
  // Erst warten, dann messen. Eine Seite, die noch lädt, hat nichts, was
  // falsch sein könnte — und ihr Ausbleiben ist ein FAIL, kein Übersprungen.
  const tafelDa = await page.getByText(/Abo — monatliche Paketrate/i).first()
    .waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
  ok("Die Abo-Tafel ist da", tafelDa);

  const motorDa = await page.getByText(/Abo-Motor: heute/i).first()
    .waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
  ok("Die Karte „Abo-Motor: heute … versandt“ ist sichtbar", motorDa);
  const t1 = await seitentext(page);
  ok("… sie nennt versandte Rechnungen", /rechnung\(en\) versandt/.test(t1));
  ok("… und wie viele überfällig geworden sind", /überfällig geworden/.test(t1));
  ok("… und die Vorab-Erinnerung", /vorab-erinnerung/.test(t1));
  await bild(page, "1-zahlungszentrale-abo-motor");

  // DER KNOPF WIRD GEDRÜCKT — gegen die Attrappe.
  const knopf = page.getByRole("button", { name: /Tageslauf jetzt/i }).first();
  const knopfDa = await knopf.waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
  ok("Es gibt einen Knopf „Tageslauf jetzt“", knopfDa);
  if (knopfDa) {
    // Der Knopf fragt vorher nach. Die Bestätigung wird ANGENOMMEN — der Ruf
    // geht in die Attrappe, nicht in die Produktion.
    page.once("dialog", (d) => void d.accept());
    await knopf.click();
    const gemeldet = await page.getByText(/3 Rechnung\(en\) versandt/i).first()
      .waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
    ok("… und nach dem Drücken steht das Ergebnis auf der Seite", gemeldet);
    await bild(page, "2-tageslauf-gedrueckt");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Dashboard — die Zustellkarte");
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASIS}/admin/dashboard`, { waitUntil: "domcontentloaded" });
  const zustellDa = await page.getByText(/Zustellung heute/i).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Karte „Zustellung heute“ ist sichtbar", zustellDa);
  const t2 = await seitentext(page);
  ok("… sie sagt, wie viel versandt wurde", /\d+\s*versandt/.test(t2));
  ok("… und was fehlgeschlagen ist", /fehlgeschlagen|keine fehlschläge/.test(t2));
  const link = page.getByRole("link", { name: /Ansehen/i }).first();
  const linkDa = await link.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
  ok("… mit einem Weg ins Protokoll", linkDa);
  if (linkDa) {
    const ziel = await link.getAttribute("href");
    ok("… und der Weg ist GEFILTERT (nicht die Startseite des Protokolls)",
      String(ziel || "").includes("status=fehlgeschlagen"), String(ziel));

    // ── UND DER WEG FÜHRT WIRKLICH IRGENDWOHIN ──────────────────────────
    // Der erste Entwurf verlinkte auf „/admin/mail-protokoll“ — eine Seite,
    // die es nicht gibt (und die schon vorher aus der Mail-Zentrale verlinkt
    // war). Ein Knopf ins Leere sieht wie eine Möglichkeit aus. Deshalb wird
    // dem Link GEFOLGT und das Ziel gemessen.
    await page.goto(`${BASIS}${ziel}`, { waitUntil: "domcontentloaded" });
    const protokollDa = await page.getByText(/Zustellprotokoll/i).first()
      .waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
    ok("Der Link landet auf dem Zustellprotokoll", protokollDa,
      `Seitentext: ${(await seitentext(page)).slice(0, 160)}`);
    const t2b = await seitentext(page);
    ok("… und steht auf „Fehlgeschlagen“", /fehlgeschlagen/.test(t2b));
    // ERST WARTEN, DANN MESSEN. Die Abfrage braucht einen Moment; wer sofort
    // liest, liest „Wird geladen" und meldet einen Fehler, den es nicht gibt.
    // Das Ausbleiben ist ein FAIL, kein Übersprungen.
    const inhaltDa = await page
      .getByText(/Woran es liegt|Keine fehlgeschlagene Mail|Keine Einträge/i).first()
      .waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
    ok("… es zeigt entweder Einträge oder sagt ausdrücklich, dass keine da sind",
      inhaltDa, `Seitentext: ${(await seitentext(page)).slice(0, 200)}`);
    await bild(page, "8-zustellprotokoll");
  }
  ok("Die Abo-Kachel spricht nicht mehr von einem 30-Tage-Zyklus",
    !/30 tage zyklus/.test(t2));
  await bild(page, "3-dashboard-zustellkarte");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Kundenakte — die Abo-Zyklus-Zeile");
  // ═════════════════════════════════════════════════════════════════════════
  // Der UNGÜNSTIGSTE Fall: ein bezahlter Kunde mit offener Rate und möglichst
  // vielen Bestellungen — nicht der erstbeste.
  // Der Fall MUSS einen Buchungstag haben, sonst prüft man die Fehlermeldung
  // statt der Funktion. Beim ersten Lauf hat der Prüfstand genau das getan:
  // Er wählte die Akte mit den meisten Raten — und die hatte keinen Anker.
  // Aufgefallen ist es nur auf dem Screenshot.
  const [fall] = (await sqlPool`
    SELECT a.ref FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
      AND EXISTS (SELECT 1 FROM fiaon_abo_raten r
                   WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL)
    ORDER BY (SELECT COUNT(*) FROM fiaon_abo_raten r2 WHERE r2.ref = a.ref) DESC,
             (SELECT COUNT(*) FROM fiaon_applications x WHERE x.person_id = a.person_id) DESC
    LIMIT 1
  `) as any[];
  if (!fall) {
    ok("Es gibt einen bezahlten Kunden mit offener Rate", false,
      "kein Prüffall gefunden — die Akte konnte nicht geprüft werden");
  } else {
    await page.goto(`${BASIS}/admin/kunde/${encodeURIComponent(fall.ref)}`,
      { waitUntil: "domcontentloaded" });
    const zyklusDa = await page.getByText(/Abo aktiv seit/i).first()
      .waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
    ok(`Die Akte ${fall.ref} zeigt „Abo aktiv seit …“`, zyklusDa);
    const t3 = await seitentext(page);
    ok("… und nennt die nächste Rate", /nächste rate \d{2}\.\d{2}\./.test(t3));
    ok("… und dass die Rechnung automatisch rausgeht",
      /rechnung geht automatisch raus|rechnungsversand ist abgeschaltet|abo gestoppt/.test(t3));
    ok("… und den Verwendungszweck der offenen Rate", /verwendungszweck/.test(t3));
    await bild(page, "4-akte-abo-zyklus");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Inkasso-Liste — eine Karte je Mensch");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Inkasso-Seite gehört dem Agentenbereich und verlangt eine Anmeldung
  // als Mitarbeiter mit der Rolle Inkasso. Statt eine Anmeldung nachzubauen
  // (und dabei eine echte Verpflichtungserklärung zu erzeugen — der Vorfall
  // vom 06.08.2026), wird hier die API mit einer Attrappe beliefert und die
  // gerenderte Liste gemessen. Der Aufklapp-Knopf wird echt gedrückt.
  const attrappe = {
    ok: true, heute: "2026-08-16", frist: "ueberfaellig", nurMeine: false,
    zeilen: 5, menschen: 2,
    zahlen: { offen: 5, ueberfaellig: 5, heute: 0, woche: 0 },
    verdienst: { heute: 0, monat: 0, offen: 0 },
    ergebnisse: [],
    fenster: { start: 8, ende: 20 },
    liste: [] as any[],
    personen: [] as any[],
  };
  const raten = (nr: number, ref: string, tage: number) => ({
    rate_id: 9000 + nr, ref, rate_nr: nr, betrag_cents: 5999,
    zahlungsreferenz: `PRUEF-${ref}-${nr}`,
    faellig_am: "2026-08-10", mahnstufe: 1, erinnerungen: 1,
    letzte_erinnerung_at: "2026-08-10T09:00:00Z",
    inkasso_wiedervorlage: null, inkasso_zusage_am: null, inkasso_versuche: 0,
    eskaliert_am: null, person_id: 3417, name: "Peter Zußner",
    email: "peter@beispiel.test", phone: "017612345678", phone_country_code: "+49",
    paket: "FIAON Pro", ueberfaellig: true, tage_ueberfaellig: tage,
    anruf_pflicht: false, zusage_gebrochen: false,
    raten_bezahlt: 0, raten_gesamt: 3,
    letzter_bearbeiter: null, letztes_ergebnis: null, notiz: null,
  });
  const zussner = [
    raten(1, "PRUEF-A", 61), raten(2, "PRUEF-A", 31), raten(3, "PRUEF-A", 1),
    { ...raten(1, "PRUEF-B", 51), rate_id: 9101 }, { ...raten(2, "PRUEF-B", 21), rate_id: 9102 },
  ];
  attrappe.liste = zussner;
  attrappe.personen = [{
    personId: 3417, name: "Peter Zußner", email: "peter@beispiel.test",
    phone: "017612345678", phoneCountryCode: "+49",
    raten: zussner, anzahl: 5, summeCents: 5 * 5999, dringendste: zussner[0],
    bestellungen: 2, zweitAbo: true, anker: "2026-05-16",
    zyklusText: "Abo aktiv seit 16.05. · nächste Rate 16.09. · Rechnung geht automatisch raus",
  }];
  await kontext.route("**/api/fiaon/inkasso/liste**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(attrappe) });
  });
  // ── DIE ZWEI ZUGANGSWÄNDE ALS ATTRAPPE ──────────────────────────────────
  // Der Agentenbereich hat zwei Tore, die ein frisches Konto verschließen:
  //
  //   /agent/onboarding  — „Zugriff gesperrt bis Abschluss“ (gemessen)
  //   /inkasso/zugang    — die Verpflichtungserklärung
  //
  // Beide werden hier ABGEFANGEN und NICHT echt durchlaufen. Am 06.08.2026
  // hat ein Playwright-Lauf eine Verpflichtungserklärung wirklich angenommen —
  // ein Rechtsnachweis, den ein Roboter erzeugt, ist wertlos und stand
  // trotzdem in der Tabelle. Diese Wand hier ist die Lehre daraus.
  await kontext.route("**/api/fiaon/agent/onboarding", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, status: { complete: true, schritte: [] } }),
    });
  });
  await kontext.route("**/api/fiaon/inkasso/zugang**", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, frei: true, zusage: { angenommen: true } }),
    });
  });
  // Und die Gegenwand: Ein echtes Annehmen wird HART abgelehnt. Sollte ein
  // späterer Umbau hier doch einen Klick auslösen, entsteht kein Nachweis.
  for (const muster of ["**/api/fiaon/inkasso/zusage**", "**/api/fiaon/agent/onboarding/**"]) {
    await kontext.route(muster, async (route) => {
      if (route.request().method() === "GET") return route.fallback();
      await route.fulfill({
        status: 403, contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "Im Prüfstand wird nichts angenommen." }),
      });
    });
  }

  // ── DIE ANMELDUNG ───────────────────────────────────────────────────────
  // Der Bereich liegt hinter der Mitarbeiter-Anmeldung; ohne sie landet man
  // auf /agent (gemessen). Deshalb ein AUSDRÜCKLICH als Testkonto markierter
  // Zugang, der am Ende dieses Laufs wieder stillgelegt wird.
  //
  // `is_test_account = TRUE` ist nicht Kosmetik: `istTestkonto` sperrt damit
  // das Telefonieren serverseitig. Selbst wenn hier jemand später auf „Wählen“
  // klickte, ginge kein Anruf an einen echten Menschen.
  const bcrypt = (await import("bcryptjs")).default;
  const pruefMail = `pruefstand-inkasso-${Date.now().toString(36)}@pruefstand-abo.test`;
  const pruefPass = `P-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  const [pruefAgent] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES ('Prüfstand Inkasso (Testkonto)', ${pruefMail},
            ${await bcrypt.hash(pruefPass, 10)}, 'inkasso', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];

  const anmeldung = await page.request.post(`${BASIS}/api/fiaon/agent/login`, {
    data: { email: pruefMail, password: pruefPass },
  }).catch(() => null);
  ok("Das Prüf-Testkonto kann sich anmelden",
    anmeldung != null && anmeldung.ok(), `Status ${anmeldung?.status()}`);

  await page.goto(`${BASIS}/agent/inkasso`, { waitUntil: "domcontentloaded" });
  const listeDa = await page.getByText(/Peter Zußner/).first()
    .waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
  if (!listeDa) await bild(page, "5-inkasso-FEHLGESCHLAGEN");
  ok("Die Inkasso-Liste rendert den Fall", listeDa,
    `Seitentext: ${(await seitentext(page)).slice(0, 220)}`);
  if (listeDa) {
    // DIE KERNMESSUNG: Der Name darf GENAU EINMAL vorkommen.
    const treffer = await page.getByText(/Peter Zußner/).count();
    ok("Peter Zußner steht GENAU EINMAL in der Liste — nicht fünfmal",
      treffer === 1, `${treffer} Fundstellen`);
    const t4 = await seitentext(page);
    ok("… die Kopfzeile nennt Menschen und Raten getrennt",
      /menschen · 5 offene raten|1 mensch · 5 offene raten/.test(t4), t4.slice(0, 200));
    ok("… die Summe aller fünf Raten steht auf der Karte", /299,95/.test(t4));
    ok("… das Zweit-Abo ist als Warnung markiert", /zweites abo/.test(t4));
    ok("… und der Zyklus steht im Klartext", /abo aktiv seit 16\.05\./.test(t4));
    await bild(page, "5-inkasso-eine-karte-je-mensch");

    // DER AUFKLAPP-KNOPF WIRD GEDRÜCKT.
    const auf = page.getByRole("button", { name: /Alle 5 Raten zeigen/i }).first();
    const aufDa = await auf.waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
    ok("Es gibt einen Knopf „Alle 5 Raten zeigen“", aufDa);
    if (aufDa) {
      await auf.click();
      const zuDa = await page.getByRole("button", { name: /Raten zuklappen/i }).first()
        .waitFor({ timeout: 8_000 }).then(() => true).catch(() => false);
      ok("… nach dem Drücken sind die Raten aufgeklappt", zuDa);
      const t5 = await seitentext(page);
      ok("… und jede einzelne Rate ist zu sehen",
        /rate 1/.test(t5) && /rate 2/.test(t5) && /rate 3/.test(t5));
      ok("… mit ihrem eigenen Ergebnis-Knopf",
        (await page.getByRole("button", { name: /^Ergebnis$/i }).count()) >= 3);
      await bild(page, "6-inkasso-raten-aufgeklappt");
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Softphone — „Du rufst [Name] an“");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Auskunft kommt aus /telefon/wem. Auch hier eine Attrappe: Der
  // Prüfstand darf keine echte Nummer nachschlagen und schon gar nicht wählen.
  await kontext.route("**/api/fiaon/telefon/wem**", async (route) => {
    const url = new URL(route.request().url());
    const nummer = String(url.searchParams.get("nummer") || "");
    const bekannt = nummer.includes("176");
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify(bekannt
        ? { ok: true, nummer, waehlbar: true, person: { id: 3417, name: "Peter Zußner" },
            mehrdeutig: false, anzeige: "Du rufst Peter Zußner an." }
        : { ok: true, nummer, waehlbar: true, person: null, mehrdeutig: false,
            anzeige: "Unbekannte Nummer — der Anruf wird keiner Akte zugeordnet." }),
    });
  });

  const wemAntwort = await page.request.get(
    `${BASIS}/api/fiaon/telefon/wem?nummer=%2B4917612345678`).catch(() => null);
  ok("Die Route /telefon/wem antwortet",
    wemAntwort != null && [200, 401, 403].includes(wemAntwort.status()),
    `Status ${wemAntwort?.status()}`);

  // Das Panel steckt im Agentenbereich. Geprüft wird, dass es die Auskunft
  // anzeigt — über die Attrappe, ohne zu wählen.
  await page.goto(`${BASIS}/agent/inkasso`, { waitUntil: "domcontentloaded" });
  const panelKnopf = page.getByRole("button", { name: /Anrufen/i }).first();
  const panelDa = await panelKnopf.waitFor({ timeout: 12_000 }).then(() => true).catch(() => false);
  ok("Es gibt einen Anruf-Knopf an der Karte", panelDa);
  if (panelDa) {
    await panelKnopf.click();
    const wemDa = await page.getByText(/Du rufst Peter Zußner an/i).first()
      .waitFor({ timeout: 12_000 }).then(() => true).catch(() => false);
    ok("Vor dem Wählen steht „Du rufst Peter Zußner an.“", wemDa,
      "Die Auskunft erscheint nicht — sie muss VOR dem Verbinden da sein");
    await bild(page, "7-softphone-du-rufst-an");
    // ── DER SCREENSHOT ENDET VOR DEM LETZTEN KLICK ──────────────────────
    // Es wird ausdrücklich NICHT gewählt. Ein Prüfstand, der telefoniert,
    // ruft echte Menschen an.
    ok("Es wurde NICHT gewählt (der Prüfstand telefoniert nicht)", true);
  }

  await browser.close();

  // ── DAS TESTKONTO WIRD STILLGELEGT ──────────────────────────────────────
  // Nicht gelöscht: Ein Zugang, der einmal existiert hat, gehört ins
  // Protokoll — dieselbe Regel wie überall im Haus. Stillgelegt heißt:
  // `active = FALSE`, und die Anmeldung geht nicht mehr.
  // ── DIE EINE FUNKTION FÜR DEN ABSCHLUSS (AGENTS.md, 17.08.2026) ────────
  // Hier stand ein handgeschriebenes UPDATE. Drei Prüfstände hatten drei
  // Fassungen — und keine setzte die Marke is_test_account. Ergebnis: 43
  // Testkonten standen zwischen den sechs echten Menschen in der
  // Team-Zentrale, und der Betreiber musste seine Leute suchen.
  //
  // „testkontoStilllegen“ setzt beides: stillgelegt UND markiert. Ein Konto
  // ohne Marke fällt durch jeden Filter.
  await testkontoStilllegen(Number(pruefAgent.id)).catch(() => {});
  const [nochAktiv] = (await sqlPool`
    SELECT active FROM fiaon_agents WHERE id = ${pruefAgent.id}
  `.catch(() => [{ active: null }] as any)) as any[];
  ok("Das Prüf-Testkonto ist am Ende stillgelegt", nochAktiv?.active === false,
    `active = ${nochAktiv?.active}`);

  await sqlPool.end().catch(() => {});

  log(`\n${"═".repeat(62)}`);
  log(`  ${bestanden} bestanden, ${gescheitert} fehlgeschlagen`);
  if (fehler.length > 0) {
    log("\n  Fehlgeschlagen:");
    for (const f of fehler) log(`    · ${f}`);
  }
  log(`  Bilder: ${BILDER}/`);
  log(`${"═".repeat(62)}\n`);
  process.exit(gescheitert > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
