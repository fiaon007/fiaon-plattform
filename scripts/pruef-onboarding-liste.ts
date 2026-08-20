// ═══════════════════════════════════════════════════════════════════════════
// WAND: ONBOARDING SIEHT SEINE ARBEIT
//
// ── DER BEFUND (20.08.2026) ────────────────────────────────────────────────
// Viktoria Reichert und Rifka Rovcanin haben heute Startgespräche und sehen
// „0 Kunden". GEMESSEN:
//
//   Rifka Rovcanin    Betreuer bei 0 Kunden · 15 Termine · 5 HEUTE
//   Viktoria Reichert Betreuer bei 0 Kunden ·  6 Termine · 5 HEUTE
//
// Zwei Ursachen, beide in `/agent/kunden/liste`:
//   1. `p.assigned_agent_id = $1` — die Betreuung liegt beim Vertrieb.
//   2. `priority_tier BETWEEN 1 AND 3` — ein Kunde im Onboarding hat bezahlt
//      und steht auf Tier 0. Selbst mit richtiger Zuordnung wäre die Liste leer.
//
// Geprüft wird gegen die ECHTEN Konten (nur lesend) und mit einem Testkonto für
// die Grenzen. Kein Vorgang entsteht.
//
//   npx tsx scripts/pruef-onboarding-liste.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const BILDER = "reports/bilder-onboarding";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 52 - t.length))}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}

const stillzulegen: number[] = [];

async function main(): Promise<void> {
  log("\n══ Onboarding sieht seine Arbeit ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Die Ursache ist behoben, im Quelltext");
  // ═════════════════════════════════════════════════════════════════════════
  const start = readFileSync("server/routes/fiaon-agent-start.ts", "utf8");
  ok("Die Liste kennt die Rolle Onboarding", /const onboarding = await istOnboarding\(me\)/.test(start));
  ok("Für Onboarding zählt der TERMIN, nicht die Betreuung",
    /onboarding \? ONBOARDING_ZUSTAENDIG : "p\.assigned_agent_id = \$1"/.test(start));
  ok("Die Grenze steht in der WHERE-Bedingung (t.agent_id = $1)",
    /t\.agent_id = \$1/.test(start));
  ok("Der Tier-Filter greift bei Onboarding nicht",
    /else if \(onboarding\) \{[\s\S]{0,300}?NOT p\.is_blocked/.test(start));
  ok("Die Karte trägt Uhrzeit und Art des Termins", /AS termin_beginn/.test(start));
  ok("Die Antwort nennt die Rolle und den nächsten Termin",
    /rolle: onboarding \? "onboarding" : "agent"/.test(start) && /naechsterTermin,/.test(start));
  const kunden = readFileSync("client/src/pages/agent/kunden-neu.tsx", "utf8");
  ok("Der Leerzustand sagt nicht mehr „kein Kunde zugewiesen“",
    /Keine Startgespräche geplant/.test(kunden) && /Nächstes Startgespräch/.test(kunden));
  const vertrieb = readFileSync("server/routes/fiaon-vertrieb.ts", "utf8");
  ok("Die Akten-Route ist für Onboarding geöffnet",
    /leitungOderOnboarding/.test(vertrieb));
  ok("Und begrenzt auf die EIGENEN Terminkunden",
    /FROM fiaon_termine[\s\S]{0,200}?agent_id = \$\{Number\(req\.agent!\.id\)\}/.test(vertrieb));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Die Menge, gegen die geprüft wird");
  // ═════════════════════════════════════════════════════════════════════════
  const onboarder = (await sqlPool`
    SELECT id, name FROM fiaon_agents
     WHERE active AND rolle = 'onboarding' AND NOT COALESCE(is_test_account, FALSE)
     ORDER BY id
  `) as any[];
  const ONB = `EXISTS (
    SELECT 1 FROM fiaon_termine t
     WHERE t.person_id = p.id AND t.agent_id = $1 AND t.abgesagt_am IS NULL
       AND (t.beginn AT TIME ZONE 'Europe/Berlin')::date
           >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '14 days')`;
  for (const o of onboarder) {
    const [alt] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_persons WHERE assigned_agent_id = ${Number(o.id)}
    `) as any[];
    const neu = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM fiaon_persons p
       WHERE (${ONB}) AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
         AND NOT p.is_blocked`, [Number(o.id)])) as any[];
    log(`        ${String(o.name).padEnd(20)} vorher ${alt.n} · jetzt ${neu[0].n}`);
    ok(`${o.name} sieht jetzt Kunden`, Number(neu[0].n) > 0,
      "die Liste bleibt leer — der Fix greift für diesen Menschen nicht");
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Im Browser: als Onboarding-Konto");
  // ═════════════════════════════════════════════════════════════════════════
  // ── WARUM EIN TESTKONTO UND NICHT VIKTORIAS ZUGANG ────────────────────────
  // AGENTS.md verbietet die Anmeldung mit einem echten Zugang. Das Testkonto
  // bekommt DIE TERMINE VON VIKTORIA NICHT — es bekommt eigene, auf echte
  // Kunden zeigende Termine, die im selben Lauf entfernt werden. Damit prüft der
  // Lauf den WEG (Liste → Akte), ohne an echten Terminen zu rühren.
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-onb-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [k] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES ('Prüfstand Onboarding (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)},
            'onboarding', TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  const agentId = Number(k.id);
  stillzulegen.push(agentId);

  // ── DIE SCHRANKE MUSS AUF SEIN, SONST PRUEFT MAN DIE SCHRANKE ────────────
  // Erster Lauf: acht rote Zeilen, alle mit „Onboarding nicht abgeschlossen".
  // Das ist `customerDataGate` und richtig so — nur beschreibt es keinen echten
  // Mitarbeiter: Wer Startgespraeche fuehrt, hat das Onboarding hinter sich.
  // Die Verpflichtungserklaerung der VERTRIEBSLEITUNG wird NICHT angenommen
  // (AGENTS.md) — sie ist fuer diese Rolle auch nicht noetig.
  const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${agentId}, ${d.key}, ${d.version}, NOW(), '127.0.0.1', 'PRUEFSTAND')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [vv] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `) as any[];
  if (vv) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html, signature_name,
         signature_mode, signed_at, ip, user_agent, doc_hash, status)
      VALUES (${agentId}, ${vv.version}, '{}', '<p>PRUEFSTAND</p>', 'PRUEFSTAND',
              'typed', NOW(), '127.0.0.1', 'PRUEFSTAND', 'PRUEFSTAND', 'signed')
    `.catch(() => {});
  }

  // Drei echte, bezahlte Kunden — der ungünstigste Fall (Tier 0, also genau die,
  // die der alte Filter weggeworfen hätte).
  const ziele = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          p.company_name, 'Ohne Namen') AS name
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
       AND p.priority_tier = 0
     ORDER BY p.id DESC LIMIT 3
  `) as any[];
  ok("Drei bezahlte Kunden als Prüffall (Tier 0)", ziele.length === 3, `${ziele.length}`);

  const terminIds: number[] = [];
  for (let i = 0; i < ziele.length; i++) {
    const [t] = (await sqlPool`
      INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, created_at)
      VALUES (${Number(ziele[i].id)}, ${agentId},
              (NOW() AT TIME ZONE 'Europe/Berlin')::date + TIME '13:00' + (${i} || ' hours')::interval,
              30, 'gebucht', 'onboarding_call', NOW())
      RETURNING id
    `) as any[];
    terminIds.push(Number(t.id));
  }
  log(`        ${terminIds.length} Prüftermine angelegt (heute, werden entfernt).`);

  const browser = await chromium.launch();
  for (const [name, breite, hoehe] of [["desktop", 1400, 1000], ["schmal", 380, 900]] as const) {
    const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } });
    // Nur lesend: alles Schreibende ins Leere, ausser der Anmeldung.
    await kontext.route("**/api/**", async (r) => {
      const m = r.request().method();
      if (m === "GET" || m === "HEAD") return r.fallback();
      if (r.request().url().includes("/agent/login")) return r.fallback();
      await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    const page = await kontext.newPage();
    const fehler: string[] = [];
    page.on("pageerror", (e) => fehler.push(String(e.message)));

    const an = await kontext.request.post(`${BASIS}/api/fiaon/agent/login`,
      { data: { email: mail, password: pass } });
    ok(`[${name}] Anmeldung`, an.ok(), `HTTP ${an.status()}`);

    // ── DIE ROUTE DIREKT: WAS LIEFERT SIE? ────────────────────────────────
    const liste = await kontext.request.get(`${BASIS}/api/fiaon/agent/kunden/liste`);
    const jl = await liste.json().catch(() => null);
    if (name === "desktop") {
      ok("Die Liste antwortet", liste.ok(), `HTTP ${liste.status()} ${jl?.error ?? ""}`);
      ok("Sie nennt die Rolle onboarding", jl?.rolle === "onboarding", String(jl?.rolle));
      ok("Sie enthält die drei Terminkunden", (jl?.kunden ?? []).length >= 3,
        `${jl?.kunden?.length ?? 0} Kunden`);
      const mitTermin = (jl?.kunden ?? []).filter((x: any) => x.termin);
      ok("Jede Zeile trägt einen Termin", mitTermin.length >= 3, `${mitTermin.length} mit Termin`);
      // ── DER ZAEHLER DARF NICHT 0 SAGEN, WENN DIE LISTE VOLL IST ─────────
      // Im ersten Screenshot stand ueber drei Startgespraechen „0 Kunden
      // gehoeren dir" — genau der Satz, mit dem der Ausfall gemeldet wurde.
      ok("Der Zähler nennt dieselbe Zahl wie die Liste",
        Number(jl?.zaehlerUeberschrieben?.alle ?? -1) === (jl?.kunden ?? []).length,
        `Zähler ${jl?.zaehlerUeberschrieben?.alle}, Liste ${jl?.kunden?.length}`);
      // Sortierung: heute nach Uhrzeit aufsteigend.
      const zeiten = mitTermin.map((x: any) => new Date(x.termin.beginn).getTime());
      const sortiert = [...zeiten].sort((a, b) => a - b);
      ok("Heutige Termine stehen nach Uhrzeit aufsteigend",
        JSON.stringify(zeiten.slice(0, 3)) === JSON.stringify(sortiert.slice(0, 3)),
        `${zeiten.slice(0, 3)}`);

      // ── DIE AKTE ─────────────────────────────────────────────────────────
      const akte = await kontext.request.get(
        `${BASIS}/api/fiaon/agent/vertrieb/person/${Number(ziele[0].id)}`);
      ok("Die Kundenakte öffnet für Onboarding (kein 403/404)", akte.ok(),
        `HTTP ${akte.status()} — vorher antwortete nurLeitung mit 404`);
      const ja = await akte.json().catch(() => null);
      ok("Und sie enthält die Person", !!ja?.person?.name, String(ja?.error ?? ""));

      // ── ROT-PROBE: EIN FREMDER KUNDE ─────────────────────────────────────
      const [fremd] = (await sqlPool`
        SELECT p.id FROM fiaon_persons p
         WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
           AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
                            WHERE t.person_id = p.id AND t.agent_id = ${agentId})
         ORDER BY p.id DESC LIMIT 1
      `) as any[];
      const verboten = await kontext.request.get(
        `${BASIS}/api/fiaon/agent/vertrieb/person/${Number(fremd.id)}`);
      ok("Rot-Probe: ein Kunde OHNE eigenen Termin wird verweigert (403)",
        verboten.status() === 403,
        `HTTP ${verboten.status()} — bei 200 sähe Onboarding den ganzen Bestand`);
    }

    // ── DIE SEITE ─────────────────────────────────────────────────────────
    await page.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded" });
    const da = await page.locator("[data-fiaon='karte-termin']").first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    ok(`[${name}] Die Liste zeigt Karten mit Termin`, da);
    if (da) {
      const t = await page.locator("[data-fiaon='karte-termin']").first().innerText();
      ok(`[${name}] Die Zeile nennt Uhrzeit und Art`,
        /Heute \d{2}:\d{2}/.test(t) && /Startgespräch/i.test(t), t.replace(/\s+/g, " "));
      log(`        Zeile: „${t.replace(/\s+/g, " ")}“`);
      const n = await page.locator("[data-fiaon='karte-termin']").count();
      log(`        ${n} Karten mit Termin sichtbar.`);
      const kopf = await page.locator("body").innerText();
      ok(`[${name}] Die Überschrift sagt nicht „0 Kunden gehören dir“`,
        !/0 Kunden gehören dir/.test(kopf) && /Startgespräche in deiner Liste/.test(kopf),
        (kopf.match(/[^\n]*(gehören dir|in deiner Liste)[^\n]*/) ?? ["nicht gefunden"])[0]);
    }
    ok(`[${name}] Kein JS-Fehler`, fehler.length === 0, fehler.slice(0, 2).join(" | "));
    if (name === "schmal") {
      const b = await page.evaluate("document.documentElement.scrollWidth") as number;
      ok("[schmal] Kein waagerechtes Scrollen", Number(b) <= 382, `${b} px`);
    }
    await bild(page, `liste-${name}`);
    await kontext.close();
  }
  await browser.close();

  await aufraeumen(terminIds);
  log(`\n        Prüftermine und Testkonto entfernt.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

/** Läuft immer — auch wenn eine Prüfung fällt. */
async function aufraeumen(terminIds: number[] = []): Promise<void> {
  for (const id of terminIds) {
    await sqlPool`DELETE FROM fiaon_termine WHERE id = ${id}`.catch(() => {});
  }
  for (const id of stillzulegen) {
    await sqlPool`DELETE FROM fiaon_termine WHERE agent_id = ${id}`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_contracts WHERE agent_id = ${id} AND doc_hash = 'PRUEFSTAND'`.catch(() => {});
    await sqlPool`DELETE FROM fiaon_agent_consents WHERE agent_id = ${id} AND user_agent = 'PRUEFSTAND'`.catch(() => {});
    await testkontoStilllegen(id).catch(() => {});
  }
}

main().catch(async (e) => {
  console.error(e);
  await aufraeumen();
  await sqlPool.end();
  process.exit(1);
});
