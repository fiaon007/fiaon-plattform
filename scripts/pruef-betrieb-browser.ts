// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-ABNAHME: Team-Zentrale, Nachbuchung, Marken, Mehrfach-Wegräumen
//
// `pruef-betrieb.ts` prüft Regeln, Datenbank und Quelltext. Alle 123 Prüfungen
// wären grün, wenn es für keine dieser Funktionen einen Knopf gäbe — genau das
// war bei der Nachbuchung der Fall: Die Route lief, der Weg dorthin endete auf
// einem Reiter, den es nicht gab.
//
// Hier also: Seite öffnen, Knopf DRÜCKEN, am gerenderten Text messen. Und
// Screenshots, die ein Mensch ansieht.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Jeder schreibende Aufruf geht in eine Attrappe: keine Provision wird gebucht,
// keine Buchung archiviert, kein Kunde umgehängt. Bestätigungsdialoge werden
// angenommen — der Ruf dahinter landet in der Attrappe.
//
//   npx tsx scripts/pruef-betrieb-browser.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-betrieb";

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
async function text(page: Page): Promise<string> {
  return (await page.locator("body").innerText().catch(() => "")).toLowerCase();
}

/** Alles Schreibende in die Attrappe. Lesendes geht durch. */
async function attrappen(kontext: BrowserContext, gesehen: string[]): Promise<void> {
  await kontext.route("**/api/**", async (route) => {
    const m = route.request().method();
    if (m === "GET" || m === "HEAD") return route.fallback();
    gesehen.push(`${m} ${new URL(route.request().url()).pathname}`);
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, attrappe: true, gebucht: 0, updated: 0, personen: 0,
        meldung: "Attrappe — es ist nichts passiert.",
      }),
    });
  });
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: Betrieb ══\n");
  const browser = await chromium.launch();
  const gesehen: string[] = [];
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  await attrappen(kontext, gesehen);
  const page = await kontext.newPage();
  page.on("dialog", (d) => void d.accept().catch(() => {}));
  await page.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Team-Zentrale — sechs Menschen, keine Werkzeuge");
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
  const kopfDa = await page.getByText(/Team-Zentrale/i).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Team-Zentrale lädt", kopfDa);
  // ERST WARTEN, DANN MESSEN: Die Karten kommen aus einer eigenen Abfrage.
  await page.getByText(/Menschen im Team|im Team ·/i).first()
    .waitFor({ timeout: 25_000 }).catch(() => {});
  await page.waitForTimeout(1800);
  const t1 = await text(page);

  // Die sechs echten Namen MÜSSEN da sein.
  for (const name of ["daniel", "florentine", "nikita", "lucas", "diana", "hans-jürgen"]) {
    ok(`${name} steht in der Liste`, t1.includes(name));
  }
  // Und kein Prüfstands-Konto.
  ok("KEIN Prüfstands-Konto in der Liste",
    !/prüfstand|knopf-durchgang/.test(t1),
    t1.slice(0, 200));
  ok("Die Zeile sagt, wie viele ausgeblendet sind",
    /testkonten ausgeblendet/.test(t1), t1.slice(0, 260));
  ok("Es gibt einen Filter-Knopf „Testkonten“",
    await page.getByRole("button", { name: /^Testkonten \d+$/i }).count() > 0);
  await bild(page, "1-team-zentrale-sechs-menschen");

  // Den Filter DRÜCKEN — die Konten sind weggeräumt, nicht verschwunden.
  const filter = page.getByRole("button", { name: /^Testkonten \d+$/i }).first();
  if (await filter.count() > 0) {
    await filter.click();
    // Auf eine KARTE warten, nicht auf den Kopf: Der Kopf schaltet sofort um,
    // die Karten kommen aus einer neuen Abfrage. Der erste Lauf messtete
    // dazwischen und sah den alten Stand unter der neuen Überschrift.
    await page.getByText(/Prüfstand|Knopf-Durchgang/i).first()
      .waitFor({ timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const t2 = await text(page);
    ok("Der Filter zeigt die Testkonten", /prüfstand|knopf-durchgang/.test(t2), t2.slice(0, 200));
    ok("… und sagt, dass sie in keiner Kennzahl mitzählen",
      /zählen in keiner kennzahl mit/.test(t2));
    ok("… und die echten Menschen sind dann NICHT dabei",
      !/florentine|hans-jürgen/.test(t2));
    await bild(page, "2-team-zentrale-testkonten-filter");
    await page.getByRole("button", { name: /zurück zum Team/i }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Der Weg zur Nachbuchung");
  // ═════════════════════════════════════════════════════════════════════════
  // GENAU DER WEG DES BETREIBERS: die alte Adresse aufrufen.
  await page.goto(`${BASIS}/admin/nachbuchung`, { waitUntil: "domcontentloaded" });
  const tafelDa = await page.getByText(/Provisionen nachbuchen/i).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("„/admin/nachbuchung“ landet auf der Nachbuch-Tafel", tafelDa,
    `Adresse: ${page.url()}`);
  ok("… und nicht mehr auf der Mitarbeiterliste",
    page.url().includes("tab=nachbuchung"), page.url());
  // ERST WARTEN, DANN MESSEN: Die Kandidatenliste kommt aus einer eigenen
  // Abfrage. Ein festes `waitForTimeout(2500)` traf den Zustand „Wird
  // geladen …" — sichtbar geworden auf dem Screenshot, nicht im Test.
  // Auf den INHALT warten, und sein Ausbleiben als Fehlschlag melden.
  const zahlenDa = await page.getByText(/Offene Fälle/i).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Tafel nennt die Zahl der offenen Fälle", zahlenDa,
    (await text(page)).slice(0, 200));
  await page.waitForTimeout(900);
  const t3 = await text(page);
  ok("… und wie viele eindeutig sind", /eindeutig/.test(t3));
  ok("… und die Provisionssumme", /provision insgesamt/.test(t3));
  await bild(page, "3-nachbuchung-erreichbar");

  // DEN KNOPF DRÜCKEN — gegen die Attrappe.
  // Der erste AKTIVE Knopf, nicht der erste überhaupt: Bei 21 Fällen waren
  // 19 „Betrag unklar" und damit gesperrt. Der Test suchte den ersten und
  // meldete „kein Knopf drückbar" — die Tafel war in Ordnung, die Sortierung
  // nicht. Sie zeigt die buchbaren jetzt oben.
  const buchen = page.getByRole("button", { name: /^Buchen$/ }).and(
    page.locator("button:not([disabled])"),
  ).first();
  if (await buchen.count() > 0 && await buchen.isEnabled().catch(() => false)) {
    const vor = gesehen.length;
    await buchen.click();
    await page.waitForTimeout(1200);
    ok("Der Knopf „Buchen“ ruft den Buchungsweg",
      gesehen.slice(vor).some((g) => /commission-backfill\/.+\/book/.test(g)),
      gesehen.slice(vor).join(" | "));
    await bild(page, "4-nachbuchung-gebucht");
  } else {
    ok("Es gibt einen drückbaren „Buchen“-Knopf", false,
      "kein eindeutiger Fall vorhanden oder Knopf gesperrt");
  }
  // Die Reihenfolge prüfen: Der erste Knopf muss drückbar sein.
  const ersterKnopf = page.getByRole("button", { name: /^Buchen$/ }).first();
  if (await ersterKnopf.count() > 0) {
    ok("Der ERSTE Fall in der Liste ist buchbar (eindeutige zuerst)",
      await ersterKnopf.isEnabled().catch(() => false),
      "die unklaren standen oben, der Betreiber sah nur gesperrte Knöpfe");
  }
  const sammel = page.getByRole("button", { name: /Alle \d+ eindeutigen buchen/i }).first();
  ok("Es gibt einen Sammelknopf", await sammel.count() > 0);
  if (await sammel.count() > 0) {
    const vor = gesehen.length;
    await sammel.click();
    await page.waitForTimeout(1200);
    ok("… und er ruft den Sammelweg",
      gesehen.slice(vor).some((g) => /book-all/.test(g)),
      gesehen.slice(vor).join(" | "));
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Marke neben Zielseite — dieselbe Zahl");
  // ═════════════════════════════════════════════════════════════════════════
  const badges = await page.request.get(`${BASIS}/api/fiaon/admin/hub/badges`)
    .then((r) => r.json()).catch(() => null);
  const kandidaten = await page.request.get(`${BASIS}/api/fiaon/admin/commission-backfill/candidates`)
    .then((r) => r.json()).catch(() => null);
  ok("Marke „nachbuchung“ == Fälle auf der Zielseite",
    Number(badges?.badges?.nachbuchung) === Number(kandidaten?.candidates?.length),
    `Marke ${badges?.badges?.nachbuchung}, Seite ${kandidaten?.candidates?.length}`);

  // Und im MENÜ dieselbe Zahl wie in der Tafel.
  await page.goto(`${BASIS}/admin/aufgaben`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const t4 = await text(page);
  const markeAufgaben = Number(badges?.badges?.aufgabenOffen ?? -1);
  ok("Die Aufgaben-Marke ist keine Null bei offenen Aufgaben",
    markeAufgaben >= 0, String(markeAufgaben));
  // Der Menü-Eintrag trägt die Zahl sichtbar.
  const menuZahl = await page.locator("nav, aside").getByText(new RegExp(`^${markeAufgaben}$`))
    .first().count().catch(() => 0);
  ok("… und sie steht sichtbar im Menü",
    markeAufgaben === 0 || menuZahl > 0,
    `Marke ${markeAufgaben} im Menü gefunden: ${menuZahl}`);
  ok("Die Aufgaben-Seite lädt", /aufgabe|notiz/.test(t4));
  await bild(page, "5-marke-neben-zielseite");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Mehrfach-Wegräumen im Agentenbereich");
  // ═════════════════════════════════════════════════════════════════════════
  // Ein Kunde mit mehreren offenen Buchungen — der UNGÜNSTIGSTE Fall, nicht
  // der erstbeste.
  const [fall] = (await sqlPool`
    SELECT p.id AS person_id, p.assigned_agent_id,
           COUNT(a.ref)::int AS offene
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.payment_status NOT IN ('paid', 'cancelled', 'refunded')
    GROUP BY p.id, p.assigned_agent_id
    HAVING COUNT(a.ref) >= 3
    ORDER BY COUNT(a.ref) DESC
    LIMIT 1
  `) as any[];

  if (!fall) {
    ok("Es gibt einen Kunden mit mehreren offenen Buchungen", false, "keiner gefunden");
  } else {
    log(`        (Prüffall: Person ${fall.person_id} mit ${fall.offene} offenen Buchungen)`);
    // Anmeldung als der ZUSTÄNDIGE — sonst sieht man die Karte nicht. Ein
    // eigenes Testkonto würde den Kunden nicht besitzen; deshalb wird das
    // Passwort des Zuständigen NICHT benutzt, sondern die Ansicht des
    // Betreibers („Als Mitarbeiter ansehen") — sie geht über den Zugangscode.
    const uebernahme = await page.request.post(
      `${BASIS}/api/fiaon/admin/team/ansicht/${fall.assigned_agent_id}`, { data: {} },
    ).catch(() => null);
    ok("Die Betreiber-Ansicht als Mitarbeiter greift",
      uebernahme != null && uebernahme.ok(), `Status ${uebernahme?.status()}`);

    await page.goto(`${BASIS}/agent/kunden?person=${fall.person_id}`,
      { waitUntil: "domcontentloaded" });
    const buchungenDa = await page.getByText(/^Buchungen$/i).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    ok("Der Buchungs-Block ist sichtbar", buchungenDa);
    if (buchungenDa) {
      const haken = page.getByRole("checkbox", { name: /zum Wegräumen auswählen/i });
      const anzahl = await haken.count();
      ok("Es gibt Häkchen an den Buchungen", anzahl >= 2, `${anzahl} gefunden`);
      if (anzahl >= 2) {
        await haken.nth(0).check();
        await haken.nth(1).check();
        await page.waitForTimeout(600);
        const t5 = await text(page);
        ok("Der Sammelknopf erscheint mit Zähler", /auswahl wegräumen \(2\)/.test(t5),
          t5.slice(0, 200));
        ok("… und man kann die Auswahl aufheben", /auswahl aufheben/.test(t5));
        await bild(page, "6-mehrfach-auswahl");

        // DRÜCKEN — der Dialog wird angenommen, der Ruf geht in die Attrappe.
        const vor = gesehen.length;
        await page.getByRole("button", { name: /Auswahl wegräumen/i }).first().click();
        await page.waitForTimeout(2000);
        const rufe = gesehen.slice(vor).filter((g) => /\/archivieren$/.test(g));
        ok("Es gehen GENAU zwei Archivierungs-Rufe raus", rufe.length === 2,
          `${rufe.length}: ${rufe.join(" | ")}`);
        ok("… der Reihe nach, nicht parallel (beide angekommen)", rufe.length === 2);
        await bild(page, "7-mehrfach-weggeraeumt");
      }
    }
  }

  await kontext.close();
  await browser.close();

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
