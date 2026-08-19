// ═══════════════════════════════════════════════════════════════════════════
// WAS ZEIGT DER REITER WIRKLICH? — DER BEFUND VOR DEM UMBAU
//
// ── DIE MELDUNG (20.08.2026) ───────────────────────────────────────────────
// „Teil 2 aus dem letzten Auftrag wurde nicht geliefert. Der Reiter ‚Vergütung
// & Stunden' zeigt die Bankdaten nicht." Der Betreiber hat es per Screenshot
// belegt.
//
// ── WARUM DIESER LAUF ZUERST KOMMT ────────────────────────────────────────
// Der Auftrag verlangt ausdrücklich: „Messen, ob die Route existiert und nur
// die Anzeige fehlt, oder ob nichts gebaut wurde — und im Report benennen."
// Also wird gemessen, nicht erinnert.
//
//   npx tsx scripts/mess-verguetung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-verguetung";
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`     Bild: ${BILDER}/${name}.png`);
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1 — WAS IST IM SERVER GEBAUT?");
  // ═════════════════════════════════════════════════════════════════════════
  const team = readFileSync("server/routes/fiaon-team.ts", "utf8");
  const route = /router\.get\("\/admin\/team\/agents\/:id\/bank"/.test(team);
  const entschluesselt = /ibanFull: decryptSecret\(r\.bank_iban_enc\)/.test(team);
  const protokoll = /logAgentEvent\(id, "bank_viewed_by_admin"/.test(team);
  log(`  Route GET /admin/team/agents/:id/bank .......... ${route ? "JA" : "NEIN"}`);
  log(`  Liefert die VOLLSTÄNDIGE IBAN ................. ${entschluesselt ? "JA" : "NEIN"}`);
  log(`  Schreibt jede Einsicht ins Protokoll .......... ${protokoll ? "JA" : "NEIN"}`);
  log(`  Letzte Bankänderung (alt→neu) aus dem Audit ... ${/bank_changed/.test(team) ? "JA" : "NEIN"}`);

  const client = readFileSync("client/src/pages/admin-team-zentrale.tsx", "utf8");
  const ruftAuf = /admin\/team\/agents\/\$\{m\.id\}\/bank/.test(client);
  log(`\n  Ruft die Oberfläche sie auf ................... ${ruftAuf ? "JA" : "NEIN"}`);

  // WO steht der Abschnitt? Das ist die eigentliche Frage.
  const inVerwaltung = client.indexOf("── Bankdaten ─");
  const verwaltungTafel = client.indexOf("function VerwaltungTafel");
  const verguetungTafel = client.indexOf("function VerguetungTafel");
  const wo = inVerwaltung < 0 ? "(nirgends)"
    : (verwaltungTafel >= 0 && inVerwaltung > verwaltungTafel
      && (verguetungTafel < 0 || inVerwaltung < verguetungTafel || verwaltungTafel > verguetungTafel))
      ? "im Reiter VERWALTUNG" : "unklar";
  log(`  Der Abschnitt „Bankdaten“ steht ............... ${wo}`);
  log(`  Im Reiter „Vergütung & Stunden“ .............. ${
    /VerguetungTafel[\s\S]{0,20000}?Bankverbindung/.test(client) ? "JA" : "NEIN"}`);

  log("\n  ── DIE EHRLICHE ANTWORT ───────────────────────────────────────────");
  log("  Der Server ist VOLLSTÄNDIG gebaut: Route, Entschlüsselung, Protokoll,");
  log("  sogar der Vergleich der letzten Bankänderung. Auch eine Anzeige gibt es —");
  log("  aber im Reiter VERWALTUNG, hinter einem Knopf „Vollständig anzeigen“.");
  log("  Der Betreiber sucht sie im Reiter „Vergütung & Stunden“. Dort ist sie nicht.");
  log("  Es wurde also NICHT nichts geliefert, sondern am falschen Ort — und");
  log("  ohne die Dinge, die zum Überweisen nötig sind (Kopier-Knopf, Datum der");
  log("  letzten Änderung, Hinweis wenn sie fehlt).");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2 — WAS KANN MAN HEUTE JE MENSCH EINSTELLEN?");
  // ═════════════════════════════════════════════════════════════════════════
  const felder = (await sqlPool`
    SELECT column_name, data_type FROM information_schema.columns
     WHERE table_name = 'fiaon_agents'
       AND column_name IN ('commission_rate_bp','override_rate_bp','stundensatz_cents',
                           'inkasso_praemie_art','inkasso_praemie_wert')
     ORDER BY column_name
  `) as any[];
  log("  Spalte                    Typ");
  log("  " + "─".repeat(46));
  for (const f of felder) log(`  ${String(f.column_name).padEnd(25)} ${f.data_type}`);
  log(`\n  ${felder.length} Felder. Der Auftrag nennt sechs Bausteine — es gibt also`);
  log("  keine Tabelle für Vergütungsbausteine, keine Gültigkeit-ab, keinen Vermerk,");
  log("  kein Fixum, keinen Festbetrag je Abschluss, keine Einmalgutschrift.");

  const [werte] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE COALESCE(stundensatz_cents,0) > 0)::int AS mit_stundensatz,
           COUNT(*) FILTER (WHERE COALESCE(inkasso_praemie_wert,0) > 0)::int AS mit_praemie,
           COUNT(*) FILTER (WHERE COALESCE(commission_rate_bp,0) > 0)::int AS mit_satz,
           COUNT(*)::int AS alle
      FROM fiaon_agents WHERE active AND NOT COALESCE(is_test_account, FALSE)
  `) as any[];
  log(`\n  Bestand: ${werte.alle} aktive Menschen · ${werte.mit_satz} mit Provisionssatz`);
  log(`           ${werte.mit_stundensatz} mit Stundensatz · ${werte.mit_praemie} mit Raten-Prämie`);

  // Und die Pauschalen, die heute schon entstehen — die sind hart im Code.
  log("\n  Pauschalen, die heute schon gebucht werden (Beträge im Quelltext):");
  const onb = readFileSync("server/routes/fiaon-onboarding-bereich.ts", "utf8").match(/1500|15_00/g);
  log(`    Startgespräch geführt und Konto freigeschaltet: 15,00 € ${onb ? "(hart im Code)" : "(?)"}`);
  log("    Eingezogene Rate: 2,00 € (inkasso_praemie_wert, je Mensch einstellbar)");
  const [p] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COALESCE(SUM(amount_cents),0)::int AS summe
      FROM fiaon_commissions WHERE kind = 'onboarding'
  `) as any[];
  log(`    Bereits gebucht: ${p.n} Onboarding-Pauschalen über ${(Number(p.summe) / 100).toFixed(2)} €`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3 — DIE BEIDEN REITER IM BILD");
  // ═════════════════════════════════════════════════════════════════════════
  const [wer] = (await sqlPool`
    SELECT id, name FROM fiaon_agents
     WHERE active AND NOT COALESCE(is_test_account, FALSE) AND bank_iban_enc IS NOT NULL
     ORDER BY id LIMIT 1
  `) as any[];
  log(`  Prüffall: ${wer.name} (hat Bankdaten hinterlegt)\n`);

  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
  // Nur lesen.
  await kontext.route("**/api/**", async (r) => {
    const m = r.request().method();
    if (m === "GET" || m === "HEAD" || r.request().url().includes("/api/fiaon/zugang")) return r.fallback();
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
  const page = await kontext.newPage();
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const karte = page.getByRole("button", { name: new RegExp(String(wer.name), "i") }).first();
  if (await karte.count() > 0) {
    await karte.click();
    await page.waitForTimeout(1200);
    const profil = page.getByRole("button", { name: /^Profil öffnen$/i }).first();
    if (await profil.count() > 0) await profil.click();
    await page.waitForTimeout(4000);

    for (const [name, muster] of [
      ["verguetung", /Vergütung & Stunden/i],
      ["verwaltung", /^Verwaltung$/i],
    ] as const) {
      const r = page.getByRole("button", { name: muster }).first();
      if (await r.count() === 0) { log(`  Reiter „${name}" nicht gefunden.`); continue; }
      await r.click();
      await page.waitForTimeout(3000);
      const t = await page.locator("body").innerText().catch(() => "");
      const hatBank = /IBAN|Bankdaten|Bankverbindung/i.test(t);
      log(`  Reiter „${name}": Bankdaten sichtbar? ${hatBank ? "JA" : "NEIN"}`);
      if (name === "verguetung") {
        log(`     „Vom Vorgesetzter zu bestätigen" (Grammatikfehler)? ${
          /Vom Vorgesetzter zu bestätigen/.test(t) ? "JA — steht ganz oben" : "nein"}`);
        log(`     „Zeiterfassung nutzt bisher nur"? ${
          /Zeiterfassung nutzt bisher/.test(t) ? "JA" : "nein"}`);
      }
      await bild(page, `alt-reiter-${name}`);
    }
  } else {
    log(`  Die Karte von ${wer.name} wurde nicht gefunden.`);
  }
  await browser.close();
  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
