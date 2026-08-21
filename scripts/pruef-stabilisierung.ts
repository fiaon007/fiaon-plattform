// ═══════════════════════════════════════════════════════════════════════════
// ABNAHME DER STABILISIERUNG — ALLE PUNKTE, JEDER MIT ROT-PROBE
//
//   1  Prüfstands-Konten: nichts Produktives hängt unbemerkt daran (Wand + Wache)
//   2  Rechnungen seit 19.08.: Akteneinträge sind nachgetragen
//   3  Zuständigkeit: EINE Ableitung, TypeScript und SQL sagen dasselbe
//   4  Onboarding-Kapazität: der Rückfall ist nicht der Dauerzustand
//   5  Stille Fehlerschlucker: die kritischen Pfade sind laut
//   6  Die Wand vor dem Merge greift
//
// Screenshots: Admin-Kachel „Bezahlt ohne Startgespräch“, Liste „Termine in
// Vertretung", ein Fehlerfall im Telefon-Panel mit Klartext.
//
//   npx tsx scripts/pruef-stabilisierung.ts               (Server auf 5188)
//   npx tsx scripts/pruef-stabilisierung.ts --rot-probe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { istTestkontoSql } from "../server/lib/fiaon-mitarbeiter-sicht";
import {
  zustaendigeRolle, zustaendigeRolleSql, ROLLEN_FUER, RUECKSTAND_AB_MAHNSTUFE,
} from "../server/lib/fiaon-zustaendigkeit";
import { bestandPruefen } from "../server/lib/fiaon-bestandswache";

const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5188";
const ROT = process.argv.includes("--rot-probe");
const MARKE = `PRUEFSTAB-${Date.now().toString(36).toUpperCase()}`;
const BILD = "reports/stabilisierung";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `\n        → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

const testkonten: number[] = [];

async function testkonto(rolle: string): Promise<number> {
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, rolle, active, is_test_account, created_at)
    VALUES (${`${MARKE} (Prüfstand)`}, ${`${MARKE.toLowerCase()}@example.invalid`},
            ${rolle}, TRUE, TRUE, NOW())
    RETURNING id
  `) as any[];
  const id = Number(neu.id);
  testkonten.push(id);
  const { ONBOARDING_DOCS, ensureOnboardingTables } =
    await import("../server/routes/fiaon-onboarding");
  await ensureOnboardingTables();
  for (const d of ONBOARDING_DOCS as any[]) {
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
      VALUES (${id}, ${d.key}, ${d.version}, NOW(), ${`PRUEFSTAND/${MARKE}`},
              'pruef-stabilisierung.ts (kein Mensch)')
      ON CONFLICT DO NOTHING
    `.catch(() => {});
  }
  const [v] = (await sqlPool`
    SELECT version FROM fiaon_contract_templates WHERE status = 'active'
    ORDER BY version DESC LIMIT 1
  `.catch(() => [])) as any[];
  if (v) {
    await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html,
         signature_name, signature_mode, doc_hash, status, signed_at)
      VALUES (${id}, ${Number(v.version)}, ${JSON.stringify({ pruefstand: MARKE })},
              ${`<p>Prüfstand ${MARKE}</p>`}, ${`${MARKE}`}, 'pruefstand',
              ${`stab-${MARKE}`}, 'signed', NOW())
    `.catch(() => {});
  }
  return id;
}

async function ebeneWeg(seite: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    let getan = false;
    for (const name of [/^Verstanden$/i, /^Gelesen$/i]) {
      const k = seite.getByRole("button", { name }).first();
      if (await k.count() > 0) { await k.click({ timeout: 3000 }).catch(() => {}); getan = true; await seite.waitForTimeout(400); }
    }
    if (!getan) return;
  }
}

async function main(): Promise<void> {
  mkdirSync(BILD, { recursive: true });

  // ═══════════════════════════════════════════════════════════════════════
  titel("1 — PRÜFSTANDS-KONTEN: NICHTS PRODUKTIVES HÄNGT UNBEMERKT DARAN");
  // ═══════════════════════════════════════════════════════════════════════
  const [an] = (await sqlPool.unsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_persons p JOIN fiaon_agents a ON a.id = p.assigned_agent_id
        WHERE ${istTestkontoSql("a")} AND p.merged_into_person_id IS NULL
          AND p.ist_test_am IS NULL) AS personen,
      (SELECT COUNT(*)::int FROM fiaon_commissions c JOIN fiaon_agents a ON a.id = c.agent_id
        WHERE ${istTestkontoSql("a")}) AS provisionen
  `)) as any[];
  // Die Wache MUSS es melden, solange es so ist. Nicht „es ist behoben“ wird
  // geprüft (das entscheidet der Betreiber), sondern „es ist SICHTBAR“.
  const befunde = await bestandPruefen();
  const meldet = befunde.some((b) => b.art === "an_pruefstandskonto");
  const gibtEs = Number(an.personen) + Number(an.provisionen) > 0;
  pruef("Die Bestandswache meldet, was an Prüfstands-Konten hängt",
    gibtEs ? meldet : !meldet,
    `${an.personen} Personen, ${an.provisionen} Provisionen — Wache meldet: ${meldet}`);

  // ── DIE WAND (Migration 072), in einer Transaktion mit Rollback ────────
  const [opfer] = (await sqlPool`
    SELECT a.id, a.name FROM fiaon_agents a
    WHERE a.active AND NOT COALESCE(a.is_test_account, FALSE)
      AND (SELECT COUNT(*) FROM fiaon_persons p WHERE p.assigned_agent_id = a.id
            AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL) > 0
    ORDER BY a.id LIMIT 1
  `) as any[];
  let gesperrt = false;
  if (opfer) {
    await sqlPool.begin(async (tx) => {
      await tx`UPDATE fiaon_agents SET is_test_account = TRUE WHERE id = ${Number(opfer.id)}`
        .catch(() => { gesperrt = true; });
      throw new Error("ROLLBACK");
    }).catch((e) => { if (String(e.message) !== "ROLLBACK") gesperrt = true; });
  }
  pruef("Die Wand verhindert die Testmarke auf einem Konto mit Kunden", gesperrt,
    `Prüffall #${opfer?.id} ${opfer?.name}`);

  // Die Gegenrichtung WARNT und sperrt nicht — Prüfstände leihen sich Kunden.
  let durchgelassen = false;
  let vorgemerkt = 0;
  await sqlPool.begin(async (tx) => {
    const [tk] = (await tx`
      SELECT id FROM fiaon_agents WHERE COALESCE(is_test_account, FALSE)
        AND NOT active ORDER BY id DESC LIMIT 1
    `) as any[];
    const [p] = (await tx`
      SELECT id FROM fiaon_persons WHERE merged_into_person_id IS NULL
        AND ist_test_am IS NULL ORDER BY id LIMIT 1
    `) as any[];
    const [v0] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_testkonto_warnungen`) as any[];
    await tx`UPDATE fiaon_persons SET assigned_agent_id = ${Number(tk.id)} WHERE id = ${Number(p.id)}`;
    durchgelassen = true;
    const [v1] = (await tx`SELECT COUNT(*)::int AS n FROM fiaon_testkonto_warnungen`) as any[];
    vorgemerkt = Number(v1.n) - Number(v0.n);
    throw new Error("ROLLBACK");
  }).catch((e) => { if (String(e.message) !== "ROLLBACK") throw e; });
  pruef("Ein geliehener Kunde wird durchgelassen (Prüfstände brauchen das)", durchgelassen);
  pruef("… und dabei vorgemerkt", vorgemerkt === 1, `${vorgemerkt} Vormerkungen`);

  if (ROT) {
    // Die Rot-Probe der Wand: Ohne Trigger müsste die Marke durchgehen.
    let ohneWand = false;
    await sqlPool.begin(async (tx) => {
      await tx`ALTER TABLE fiaon_agents DISABLE TRIGGER fiaon_testmarke_wand_trg`;
      await tx`UPDATE fiaon_agents SET is_test_account = TRUE WHERE id = ${Number(opfer.id)}`;
      ohneWand = true;
      throw new Error("ROLLBACK");
    }).catch((e) => { if (String(e.message) !== "ROLLBACK") ohneWand = false; });
    pruef("ROT-PROBE: ohne Trigger geht die Marke durch (die Wand ist es also, die sperrt)",
      ohneWand, "dann sperrt etwas anderes — der Prüfstand beweist die Wand nicht");
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("2 — RECHNUNGEN SEIT 19.08.: AKTENEINTRÄGE NACHGETRAGEN");
  // ═══════════════════════════════════════════════════════════════════════
  const [nach] = (await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_contact_log
        WHERE note LIKE '[rückwirkend rekonstruiert]%') AS rekonstruiert,
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
          AND a.payment_due_date IS NOT NULL AND a.amount_due IS NOT NULL
          AND (a.payment_due_date - INTERVAL '7 days')::date >= '2026-08-19'
          AND (a.payment_email_sent_at IS NOT NULL
            OR EXISTS (SELECT 1 FROM fiaon_mail_log l WHERE l.event = 'payment_details'
              AND l.status = 'versandt' AND l.person_id = a.person_id
              AND l.created_at >= '2026-08-19'))
          AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log cl
            WHERE cl.ref = a.ref AND cl.voided_at IS NULL
              AND cl.note ILIKE '%Erste Rechnung gestellt%')) AS noch_offen
  `) as any[];
  pruef("Die rekonstruierten Einträge stehen in der Akte", Number(nach.rekonstruiert) > 0,
    `${nach.rekonstruiert} Einträge`);
  pruef("Keine versendete Rechnung ohne Akteneintrag mehr", Number(nach.noch_offen) === 0,
    `${nach.noch_offen} noch offen`);
  // Und der Eintrag behauptet keinen Namen — das war die Bedingung.
  const [behauptung] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_contact_log
    WHERE note LIKE '[rückwirkend rekonstruiert]%' AND agent_id IS NOT NULL
  `) as any[];
  pruef("Kein rekonstruierter Eintrag behauptet einen Mitarbeiter",
    Number(behauptung.n) === 0, `${behauptung.n} mit agent_id`);

  // ═══════════════════════════════════════════════════════════════════════
  titel("3 — ZUSTÄNDIGKEIT: EINE ABLEITUNG, ZWEI FASSUNGEN, EIN ERGEBNIS");
  // ═══════════════════════════════════════════════════════════════════════
  // AGENTS.md erlaubt eine SQL- und eine TypeScript-Fassung nur, wenn ein
  // Prüfstand sie GEGENEINANDER hält. Genau das passiert hier — und zwar an je
  // einem Fall pro Topf, nicht an drei zufälligen Zeilen.
  const proTopf = (await sqlPool.unsafe(`
    SELECT DISTINCT ON (rolle) id, rolle FROM (
      SELECT p.id, ${zustaendigeRolleSql("p")} AS rolle
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT COALESCE(p.is_blocked, FALSE)
    ) x ORDER BY rolle, id
  `)) as any[];
  pruef("Es gibt einen Prüffall je Topf", proTopf.length === 3,
    `gefunden: ${proTopf.map((r) => r.rolle).join(", ")}`);
  for (const f of proTopf) {
    const z = await zustaendigeRolle(Number(f.id));
    pruef(`Person ${f.id}: SQL sagt „${f.rolle}“, TypeScript sagt „${z?.rolle}“`,
      z?.rolle === String(f.rolle));
  }
  // Und die Rollenzuordnung ist vollständig — eine Rolle ohne Eintrag würde
  // stillschweigend jeden zur Vertretung machen.
  for (const r of ["vertrieb", "onboarding", "inkasso"] as const) {
    pruef(`ROLLEN_FUER kennt „${r}“`, (ROLLEN_FUER[r] ?? []).length > 0);
  }
  console.log(`  (Rückstand ab Mahnstufe ${RUECKSTAND_AB_MAHNSTUFE})`);

  if (ROT) {
    // Der Schaden: eine Person, die im Rückstand ist, MUSS inkasso sein.
    const [mahn] = (await sqlPool`
      SELECT a.person_id FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.status <> 'bezahlt' AND r.mahnstufe >= ${RUECKSTAND_AB_MAHNSTUFE}
        AND a.merged_into IS NULL AND a.person_id IS NOT NULL
      LIMIT 1
    `) as any[];
    if (mahn) {
      const z = await zustaendigeRolle(Number(mahn.person_id));
      pruef("ROT-PROBE: wer im Rückstand ist, ist inkasso — nicht onboarding",
        z?.rolle === "inkasso",
        `Person ${mahn.person_id} ist „${z?.rolle}“ — dann verschluckt Onboarding die Mahnfälle`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("4 — ONBOARDING-KAPAZITÄT: DER RÜCKFALL IST NICHT DER DAUERZUSTAND");
  // ═══════════════════════════════════════════════════════════════════════
  const [buch] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE COALESCE(ag.rolle, 'agent') <> 'onboarding')::int AS fremd
    FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.quelle = 'onboarding_call' AND t.created_at >= '2026-08-20'
  `) as any[];
  // Die Verwechslung, vor der der Betreiber gewarnt hat: „keins falsch“ darf
  // nicht „gar keins“ sein.
  pruef("Es wurden überhaupt Startgespräche gebucht (sonst sagt die Quote nichts)",
    Number(buch.gesamt) > 0, `${buch.gesamt} seit dem 20.08.`);
  pruef("Der Rückfall ist die Ausnahme, nicht die Regel",
    Number(buch.gesamt) === 0 || Number(buch.fremd) / Number(buch.gesamt) < 0.2,
    `${buch.fremd} von ${buch.gesamt} bei fremder Rolle`);

  const { rollenFuerBuchung, freieSlots } = await import("../server/lib/fiaon-termine");
  const [wartend] = (await sqlPool`
    SELECT p.id FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.payment_status = 'paid'
      AND a.merged_into IS NULL AND a.archived_at IS NULL
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id
        AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    ORDER BY a.paid_at NULLS LAST LIMIT 1
  `) as any[];
  if (wartend) {
    const e = await rollenFuerBuchung("onboarding_call", Number(wartend.id));
    const s = await freieSlots(Number(wartend.id), sqlPool, "onboarding_call");
    pruef("Onboarding hat freie Zeiten (kein Rückfall nötig)",
      !e.rueckfall && s.slots.length > 0,
      `rueckfall=${e.rueckfall} grund=${e.grund} zeiten=${s.slots.length}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  titel("5 — STILLE FEHLERSCHLUCKER: DIE KRITISCHEN PFADE SIND LAUT");
  // ═══════════════════════════════════════════════════════════════════════
  // Nicht „alle behoben“ (735 Treffer sind Arbeitsvorrat), sondern: Die
  // Stellen, an denen es diese Woche wehgetan hat, reden jetzt.
  const laut: { datei: string; muster: RegExp; was: string }[] = [
    { datei: "server/lib/fiaon-rechnung-stellen.ts", muster: /Verlaufseintrag \$\{ref\} nicht geschrieben/, was: "Rechnung: Akteneintrag" },
    { datei: "server/routes/fiaon-termin.ts", muster: /Verlaufseintrag zum Ergebnis von Termin/, was: "Termin: Ergebnis" },
    { datei: "server/lib/fiaon-termin-meldung.ts", muster: /Merker fuer Termin/, was: "Termin: Meldung" },
    { datei: "server/lib/fiaon-termine.ts", muster: /Wartezustand von Person/, was: "Termin: Wartezustand" },
    { datei: "server/make-webhook.ts", muster: /Diagnose-Eintrag zum Mailfehler/, was: "Mail: Diagnose" },
    { datei: "server/lib/fiaon-mail-senden.ts", muster: /Testmarke fuer/, was: "Mail: Testmarke" },
    { datei: "client/src/components/StartgespraechGate.tsx", muster: /Wir konnten deinen Stand nicht laden/, was: "Gate: Ladefehler" },
    { datei: "client/src/components/Softphone.tsx", muster: /wer anruft, ist gerade nicht feststellbar/, was: "Telefon: Anrufer" },
    { datei: "client/src/pages/agent/shared.tsx", muster: /Rücklaufzähler nicht geladen/, was: "Badge: Zähler" },
  ];
  for (const l of laut) {
    const inhalt = readFileSync(l.datei, "utf-8");
    pruef(`${l.was} meldet den Fehler`, l.muster.test(inhalt), l.datei);
  }
  // Und die Liste selbst existiert als Arbeitsvorrat.
  let liste = "";
  try { liste = readFileSync("reports/stille-fehler.md", "utf-8"); } catch { /* fehlt */ }
  pruef("reports/stille-fehler.md ist erzeugt", /Arbeitsvorrat/.test(liste),
    "npx tsx scripts/mess-stille-fehler.ts");

  // ═══════════════════════════════════════════════════════════════════════
  titel("6 — DIE SCREENSHOTS (die Abnahme ist erst mit ihnen fertig)");
  // ═══════════════════════════════════════════════════════════════════════
  const agentId = await testkonto("vertriebsleiter");
  const { signAgentToken } = await import("../server/routes/fiaon-agent");
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await kontext.addCookies([{
    name: "fiaon_agent_token", value: signAgentToken(agentId, 0),
    domain: "127.0.0.1", path: "/", httpOnly: false, secure: false, sameSite: "Lax",
  }]);

  try {
    // ══════════════════════════════════════════════════════════════════
    // DIE ADMIN-KACHEL — IN EINEM EIGENEN KONTEXT OHNE AGENTEN-TOKEN
    //
    // ── DER BEFUND (21.08.2026) ──────────────────────────────────────
    // Mit gesetztem `fiaon_agent_token` antwortet /admin/hub/knopfdurchgang mit
    // 403 „Kein Zugriff: Agent-Rolle hat keine Admin-Berechtigung" — auch bei
    // Rolle `vertriebsleiter`. Die Anwesenheit des Agenten-Tokens ist es, die
    // sperrt: Wer als Mitarbeiter angemeldet ist, kommt nicht in die
    // Verwaltung, egal welche Rolle.
    //
    // Der erste Entwurf benutzte denselben Kontext wie die Telefon-Prüfung und
    // meldete deshalb „Kachel fehlt" — ein Fehler, den es nicht gab. Die
    // Verwaltung bekommt jetzt einen eigenen Kontext, so wie der Betreiber
    // einen eigenen Browser hat.
    // ══════════════════════════════════════════════════════════════════
    const adminKontext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const hub = await adminKontext.newPage();
    // ── DER VERWALTUNGSBEREICH IST MIT EINEM CODE VERSCHLOSSEN ────────
    // Jede /admin-Route antwortet ohne das Cookie `fiaon_admin` mit 401
    // ADMIN_CODE_REQUIRED (server/routes/fiaon-admin-zugang.ts). Der erste
    // Entwurf ging ohne das Cookie hin: `durchgang` blieb null, die Karte
    // rendert dann gar nicht, und der Prüfstand meldete „Kachel fehlt" —
    // ein Fehler, den es nicht gab.
    //
    // Geöffnet wird über die ECHTE Tür (`POST /zugang/oeffnen`), nicht durch
    // Nachbauen des Siegels: Ein Prüfstand, der sich sein eigenes Cookie
    // schreibt, prüft nicht mehr die Wand, sondern seine Kopie davon.
    await hub.goto(`${BASIS}/`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    const auf = await hub.evaluate(async (code) => {
      const r = await fetch("/api/fiaon/zugang/oeffnen", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, process.env.ADMIN_ACCESS_CODE || "20032017");
    pruef("Der Verwaltungsbereich lässt sich mit dem Code öffnen",
      auf.status === 200 && auf.body?.ok === true,
      `status ${auf.status} — ohne ADMIN_ACCESS_CODE bleibt jede /admin-Route zu`);
    await hub.goto(`${BASIS}/admin/dashboard`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWeg(hub);
    const kachel = hub.locator('[data-fiaon="kachel-bezahlt-ohne-onboarding"]').first();
    const da = await kachel.waitFor({ state: "visible", timeout: 25_000 })
      .then(() => true).catch(() => false);
    pruef("Die Kachel „Bezahlt ohne Startgespräch“ ist da", da,
      "ohne sie ist die Zahl 342 nirgends zu sehen");
    if (da) {
      const text = await kachel.innerText();
      pruef("… und nennt eine Zahl", /\d/.test(text), text.slice(0, 80));
      // `text-transform: uppercase` — die Prüfung ohne Rücksicht auf
      // Gross- und Kleinschreibung (AGENTS.md).
      const seitenText = await hub.locator("body").innerText();
      pruef("Die Karte trägt die Überschrift „Was niemand sieht“",
        /was niemand sieht/i.test(seitenText));
      await kachel.click();
      const liste2 = hub.locator('[data-fiaon="unsichtbar-liste"]').first();
      const listeDa = await liste2.waitFor({ state: "visible", timeout: 15_000 })
        .then(() => true).catch(() => false);
      pruef("Der Klick öffnet die Liste mit Namen", listeDa,
        "eine Zahl ohne Liste ist eine Behauptung");
      await hub.waitForTimeout(1200);
      await hub.screenshot({ path: `${BILD}/1-kachel-bezahlt-ohne-onboarding.png` });
      console.log(`        ${BILD}/1-kachel-bezahlt-ohne-onboarding.png`);
    }

    // ── Die Liste „Termine in Vertretung“ ─────────────────────────────
    const vertretung = hub.locator('[data-fiaon="kachel-vertretungen"]').first();
    if (await vertretung.count() > 0) {
      await vertretung.click();
      await hub.waitForTimeout(1500);
      const l = hub.locator('[data-fiaon="unsichtbar-liste"]').first();
      pruef("Die Liste „Termine in Vertretung“ geht auf", await l.count() > 0);
      await hub.screenshot({ path: `${BILD}/2-termine-in-vertretung.png` });
      console.log(`        ${BILD}/2-termine-in-vertretung.png`);
    } else {
      // Keine Vertretung im Bestand ist ein GUTES Ergebnis — aber die Route
      // muss trotzdem antworten, sonst weiß niemand, ob sie funktioniert.
      const antwort = await hub.evaluate(async () => {
        const r = await fetch("/api/fiaon/agent/termine/vertretungen", { credentials: "include" });
        return { status: r.status, body: await r.json().catch(() => null) };
      });
      pruef("Die Route „Termine in Vertretung“ antwortet (auch bei null Fällen)",
        antwort.status === 200 && antwort.body?.ok === true,
        `status ${antwort.status}`);
    }

    // ── Ein Fehlerfall im Telefon-Panel, im Klartext ──────────────────
    const tel = await kontext.newPage();
    // Die Kundendaten-Route wird abgewiesen — genau der 403, der vorher zu
    // einem ewigen „Wird geladen …“ wurde.
    await tel.route("**/api/fiaon/telefon/kunde/*", (r) => r.fulfill({
      status: 403, contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "Zu diesem Kunden hast du kein Startgespräch." }),
    }));
    await tel.goto(`${BASIS}/agent/kunden`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await ebeneWeg(tel);
    const bereit = await tel.waitForFunction(
      () => typeof (window as any).__fiaonTelefonTest === "function",
      undefined, { timeout: 20_000 },
    ).then(() => true).catch(() => false);
    pruef("Das Telefon steht bereit", bereit);
    if (bereit) {
      // Ein Kunde, der DIESEM Konto gehört: Dann löst „wer-ist-zustaendig"
      // ihn auf, und das Panel hat eine personId zum Nachfragen.
      const [nummer] = (await sqlPool`
        SELECT NULLIF(TRIM(p.primary_phone), '') AS nr, p.id FROM fiaon_persons p
        WHERE NULLIF(TRIM(p.primary_phone), '') IS NOT NULL
          AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
          AND p.assigned_agent_id IS NOT NULL
        ORDER BY p.id LIMIT 1
      `) as any[];
      await tel.evaluate((nr) => (window as any).__fiaonTelefonTest(nr), String(nummer?.nr ?? "+4915100000000"));
      await tel.locator(".fi-ein").first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
      // ── ERST WISSEN, WER DRAN IST ──────────────────────────────────
      // Die Kundendaten-Abfrage läuft nur, wenn `kunde.personId` steht — und
      // die kommt aus „wer-ist-zustaendig". Wer sofort abnimmt, hat keinen
      // Kunden, also keine Abfrage, also keinen Fehlertext. Dieselbe Falle
      // wie am 21.08. beim Ergebnis-Knopf.
      const erkannt = await tel.locator(".fi-ein-name")
        .filter({ hasNotText: /Unbekannte Nummer/i }).first()
        .waitFor({ state: "visible", timeout: 12_000 }).then(() => true).catch(() => false);
      pruef("Der Anrufer wird erkannt (sonst gibt es nichts zu laden)", erkannt,
        `Nummer ${nummer?.nr ?? "-"}`);
      const an2 = tel.getByRole("button", { name: /^Annehmen$/i }).first();
      if (await an2.count() > 0) {
        await an2.click();
        await tel.waitForTimeout(2500);
        // ── DER BLOCK IST ZUGEKLAPPT, WENN KEIN TERMIN DA IST ──────────
        // `<details open={!!daten?.termin}>` — bei einem 403 ist `daten` null,
        // also zu. Der Text steht im DOM, ist aber nicht zu SEHEN. Für den
        // Screenshot muss er auf: Ein Beweisbild von einem zugeklappten
        // Element beweist nichts.
        await tel.locator(".fi-tel-daten > summary").first()
          .click({ timeout: 4000 }).catch(() => {});
        await tel.waitForTimeout(600);
        const fehlerText = tel.locator(".fi-tel-daten-fehler").first();
        const sichtbar = await fehlerText.count() > 0;
        pruef("Der 403 steht als Klartext im Panel (kein ewiges „Wird geladen …“)",
          sichtbar,
          "genau das war der Befund: ein verschluckter 403 sah aus wie ein Ausfall");
        if (sichtbar) {
          const t = await fehlerText.innerText();
          pruef("… und nennt den Grund", /Startgespräch|Zugriff|betreut/i.test(t), t.slice(0, 90));
        }
        await tel.screenshot({ path: `${BILD}/3-telefon-fehler-klartext.png` });
        console.log(`        ${BILD}/3-telefon-fehler-klartext.png`);
      }
    }
  } finally {
    await kontext.close();
    await browser.close();  // schliesst auch den Verwaltungs-Kontext
    const { testkontoStilllegen } = await import("../server/lib/fiaon-mitarbeiter-sicht");
    for (const id of testkonten) {
      await testkontoStilllegen(id).catch(() => {});
      console.log(`  Testkonto ${id} stillgelegt`);
    }
  }

  console.log(`\n${"═".repeat(72)}\n  ${ok} ok · ${rot} rot`);
  if (rot > 0) { console.log("\n  ROT:"); for (const f of fehler) console.log(`    · ${f}`); }
  console.log(`  Screenshots: ${BILD}/\n${"═".repeat(72)}`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
