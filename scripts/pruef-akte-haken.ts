// ═══════════════════════════════════════════════════════════════════════════
// WAND: DIE KUNDENAKTE ÖFFNET — OHNE REACT-FEHLER
//
// ── DER NOTFALL (20.08.2026) ───────────────────────────────────────────────
// React #310, „Rendered more hooks than during the previous render". Die
// Kundenakte ging bei KEINEM Kunden mehr auf; das ganze Team stand.
//
// Ursache: `const [bestaetigen, setBestaetigen] = useState(false)` stand in
// `agent/vertrieb.tsx` rund 200 Zeilen UNTER zwei frühen Ausstiegen. Die
// Schublade öffnet mit `laedt: true` → erster Durchgang 9 Haken, zweiter
// Durchgang 10 → Absturz.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
// Nicht der Quelltext (das tut ESLint mit `rules-of-hooks`), sondern die
// WIRKUNG: drei echte Kunden, Akte geöffnet, Konsole gelesen. AGENTS.md: „Der
// Screenshot ist Teil der Abnahme."
//
//   npx tsx scripts/pruef-akte-haken.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const BILDER = "reports/bilder-akte";

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

const stillzulegen: number[] = [];

/** Die Verpflichtungserklärung der Leitung wird NICHT angenommen (AGENTS.md). */
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

/**
 * Die Attrappe für die Kundenliste — mit DREI echten Kunden.
 *
 * Warum eine Attrappe und nicht die echte Route: Die Vertriebs-Routen antworten
 * mit 403, solange die Verpflichtungserklärung offen ist, und die darf kein
 * Roboter annehmen. Die Attrappe liefert deshalb die Listendaten; die AKTE
 * selbst kommt echt vom Server — sie ist der Prüfgegenstand.
 */
async function attrappen(kontext: BrowserContext, kunden: any[]): Promise<void> {
  await kontext.route("**/api/**", async (r) => {
    const m = r.request().method();
    if (m === "GET" || m === "HEAD") return r.fallback();
    // ── DIE ANMELDUNG DARF NICHT IN DIE ATTRAPPE LAUFEN ──────────────────
    // Sie ist ein POST. Ein Sammel-Abfang über alle schreibenden Aufrufe
    // schluckt sie und antwortet `ok: true` OHNE das Sitzungs-Cookie — die
    // Seite bleibt dann leer, und der Prüfstand meldet einen Fehler, den es
    // nicht gibt. Genau das ist beim ersten Lauf passiert.
    if (r.request().url().includes("/agent/login")) return r.fallback();
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await kontext.route("**/api/fiaon/agent/vertrieb/zusage", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, offen: false, frei: true }),
    });
  });
  await kontext.route("**/api/fiaon/agent/vertrieb/uebersicht**", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, zahlen: { kunden: kunden.length }, agenten: [] }),
    });
  });
  await kontext.route("**/api/fiaon/agent/vertrieb/service**", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, zahlen: {}, pipeline: null }),
    });
  });
  await kontext.route("**/api/fiaon/agent/vertrieb/personen**", async (r) => {
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, personen: kunden }),
    });
  });
  // ── DIE AKTE: ERST LÄDT SIE, DANN KOMMEN DATEN ─────────────────────────
  // Genau diese Folge hat den Absturz erzeugt (Durchgang 1 ohne `person`,
  // Durchgang 2 mit). Die Attrappe stellt sie ABSICHTLICH her — mit einer
  // Verzögerung, damit der Ladezustand wirklich gerendert wird.
  await kontext.route("**/api/fiaon/agent/vertrieb/person/*", async (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    const id = Number(r.request().url().split("/").pop());
    const k = kunden.find((x) => x.personId === id) ?? kunden[0];
    await new Promise((f) => setTimeout(f, 700));
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        person: {
          personId: k.personId, name: k.name, email: k.email, telefon: k.telefon,
          ref: k.ref, tier: k.tier, tierGrund: k.tierGrund, produkt: k.produkt,
          betrag: k.betrag, gesperrt: false, stammdaten: null, zahlung: null,
          buchungen: [], betreutSeit: null, letzterKontakt: null,
        },
        bestellungen: [], verlauf: [], zuweisungen: [],
      }),
    });
  });
}

async function main(): Promise<void> {
  log("\n══ Wand: die Kundenakte öffnet ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Kein Haken-Verstoß im ganzen Client");
  // ═════════════════════════════════════════════════════════════════════════
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const lauf = promisify(execFile);
  let lintAusgabe = "";
  let lintFehler = 0;
  try {
    await lauf("npx", ["eslint", "client/src", "--no-warn-ignored"], { timeout: 180_000 });
  } catch (e: any) {
    lintAusgabe = String(e?.stdout ?? "") + String(e?.stderr ?? "");
    lintFehler = (lintAusgabe.match(/rules-of-hooks/g) ?? []).length;
  }
  ok("`react-hooks/rules-of-hooks` meldet keinen Verstoß", lintFehler === 0,
    `${lintFehler} Verstöße:\n${lintAusgabe.slice(0, 600)}`);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  ok("Die Regel hängt im Build (der Build bricht bei einem Verstoß ab)",
    /npm run haken/.test(String(pkg.scripts?.build ?? "")),
    String(pkg.scripts?.build ?? "").slice(0, 90));
  ok("Sie ist als FEHLER gesetzt, nicht als Warnung",
    /"react-hooks\/rules-of-hooks": "error"/.test(readFileSync("eslint.config.js", "utf8")));

  // Der Haken selbst steht wieder oben.
  const vt = readFileSync("client/src/pages/agent/vertrieb.tsx", "utf8");
  const iHaken = vt.indexOf("const [bestaetigen, setBestaetigen] = useState(false);");
  const iAusstieg = vt.indexOf("if (daten.laedt || !p) {");
  ok("Der Haken steht VOR dem frühen Ausstieg", iHaken > 0 && iHaken < iAusstieg,
    `Haken bei ${iHaken}, Ausstieg bei ${iAusstieg}`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Drei echte Kunden, Akte geöffnet");
  // ═════════════════════════════════════════════════════════════════════════
  const kunden = (await sqlPool`
    SELECT p.id AS "personId",
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           p.primary_email AS email, p.primary_phone AS telefon, p.priority_tier AS tier,
           COALESCE(p.tier_reason, 'unbekannt') AS "tierGrund",
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id
             ORDER BY a.created_at DESC LIMIT 1) AS ref,
           (SELECT a.pack_name FROM fiaon_applications a WHERE a.person_id = p.id
             ORDER BY a.created_at DESC LIMIT 1) AS produkt,
           0 AS betrag, NULL AS "betreuerName", NULL AS "agentName"
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND p.primary_email IS NOT NULL
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id)
     ORDER BY p.id DESC LIMIT 3
  `) as any[];
  ok("Drei echte Kunden als Prüffälle gefunden", kunden.length === 3, `${kunden.length}`);
  for (const k of kunden) log(`        ${k.name} (Person ${k.personId})`);

  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-akte-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [konto] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES ('Prüfstand Akte (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)},
            'vertriebsleiter', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  stillzulegen.push(Number(konto.id));
  await schrankeOeffnen(Number(konto.id));

  const browser = await chromium.launch();
  for (const [name, breite, hoehe] of [
    ["desktop", 1500, 1050], ["schmal", 380, 900],
  ] as const) {
    const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } });
    await attrappen(kontext, kunden);
    const page = await kontext.newPage();
    // ── DIE KONSOLE WIRD MITGELESEN, NICHT NUR DER BILDSCHIRM ────────────
    const reactFehler: string[] = [];
    page.on("pageerror", (e) => reactFehler.push(String(e.message)));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const t = m.text();
      if (/Rendered more hooks|Minified React error|#310|Rules of Hooks/i.test(t)) reactFehler.push(t);
    });
    await page.request.post(`${BASIS}/api/fiaon/agent/login`, { data: { email: mail, password: pass } })
      .catch(() => null);
    await page.goto(`${BASIS}/agent/vertrieb`, { waitUntil: "domcontentloaded" });

    const zeileDa = await page.getByText(new RegExp(String(kunden[0].name).slice(0, 12), "i")).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    if (!zeileDa) {
      log(`        Adresse: ${page.url()}`);
      // Ohne Liste gibt es keine Akte zu öffnen — der Grund gehört ins Bild,
      // nicht in eine Vermutung.
      await bild(page, `fehlgriff-liste-${name}`);
      const t = await page.locator("body").innerText().catch(() => "");
      log(`        Seitentext: ${t.slice(0, 220).replace(/\s+/g, " ")}`);
    }
    ok(`[${name}] Die Kundenliste ist geladen`, zeileDa);

    let geoeffnet = 0;
    for (const k of kunden) {
      const knopf = page.getByRole("button", { name: /^Akte$/i });
      const anzahl = await knopf.count();
      if (anzahl === 0) break;
      await knopf.nth(Math.min(geoeffnet, anzahl - 1)).click();
      // Auf einen INHALT der Akte warten — nicht auf die Uhr.
      const auf = await page.getByText(/Lage|Stammdaten|Verlauf/).first()
        .waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
      const rahmen = await page.locator("[data-fiaon='fehlerrahmen']").count();
      ok(`[${name}] Akte von ${String(k.name).slice(0, 24)} öffnet ohne Fehlerrahmen`,
        auf && rahmen === 0,
        rahmen > 0
          ? await page.locator("[data-fiaon='fehlerrahmen-grund']").innerText().catch(() => "Rahmen offen")
          : "Akte nicht aufgegangen");
      if (auf && rahmen === 0) geoeffnet++;
      if (geoeffnet === 1) await bild(page, `akte-${name}`);
      // Schließen für den nächsten Kunden.
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
    }
    log(`        ${geoeffnet} von ${kunden.length} Akten sauber geöffnet.`);
    ok(`[${name}] KEIN React-Fehler in der Konsole`, reactFehler.length === 0,
      reactFehler.slice(0, 2).join(" | "));
    if (name === "schmal") {
      const b = await page.evaluate("document.documentElement.scrollWidth") as number;
      ok("[schmal] Kein waagerechtes Scrollen bei 380 px", Number(b) <= 382, `${b} px`);
    }
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Der Notweg im Fehlerrahmen");
  // ═════════════════════════════════════════════════════════════════════════
  const fr = readFileSync("client/src/components/agent/Fehlerrahmen.tsx", "utf8");
  ok("Der Rahmen nennt die gescheiterte ANSICHT",
    /data-fiaon="fehlerrahmen-ansicht"/.test(fr));
  ok("Es gibt den Knopf „Als Liste öffnen“",
    /Als Liste öffnen/.test(fr) && /fehlerrahmen-notweg-knopf/.test(fr));
  ok("Die Akte übergibt Kerndaten als Notweg",
    /notweg=\{\(\(\) => \{/.test(vt) && /Kerndaten aus der Liste/.test(vt));
  ok("Der Notweg kommt aus der LISTE (also auch da, wenn die Akte nicht rendert)",
    /personen\.find\(\(x\) => x\.personId === akte\?\.personId\)/.test(vt));

  await browser.close();
  await aufraeumen();
  log(`\n        Testkonto stillgelegt, Testnachweise entfernt.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

async function aufraeumen(): Promise<void> {
  for (const id of stillzulegen) {
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${id}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${id}`.catch(() => {});
    await testkontoStilllegen(id).catch(() => {});
  }
}

main().catch(async (e) => {
  console.error(e);
  await aufraeumen();
  await sqlPool.end();
  process.exit(1);
});
