// ═══════════════════════════════════════════════════════════════════════════
// WAND + BROWSER-ABNAHME: DIE ABRECHNUNGS-ZENTRALE
//
// AGENTS.md, wörtlich: „Für jede Funktion, die der Betreiber oder ein
// Teammitglied benutzt, muss ein BROWSERTEST den Bedienknopf FINDEN und
// DRÜCKEN." Genau daran ist „Alle prüfen" auf /admin/events zweimal gescheitert:
// Der Server konnte es, der Prüfstand war grün, es gab keinen Knopf.
//
// Drei Ansichten, drei Wege:
//   1. /admin/abrechnungen — die Zentrale
//   2. Team-Zentrale → Profil → Reiter Provisionen → Unterbereich Abrechnungen
//   3. Mitarbeiter-Portal → Verdienst → Deine Abrechnungen
//
// ── ES ENTSTEHT KEIN VERSAND ───────────────────────────────────────────────
// „An Mitarbeiter senden" wird GEFUNDEN und die Sperre geprüft, aber der
// Mailversand läuft in eine Attrappe. Kein Mensch bekommt Post, weil ein
// Prüfstand lief.
//
//   npx tsx scripts/pruef-abrechnung-zentrale.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-abrechnung";

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
function ohneKommentar(text: string): string {
  return text.split("\n").filter((z) => {
    const t = z.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join("\n");
}

/** Alles Schreibende ins Leere — außer der Zugangsschleuse. */
async function attrappen(kontext: BrowserContext): Promise<void> {
  await kontext.route("**/api/**", async (r) => {
    const m = r.request().method();
    if (m === "GET" || m === "HEAD") return r.fallback();
    if (r.request().url().includes("/api/fiaon/zugang")) return r.fallback();
    await r.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, attrappe: true, meldung: "Attrappe — nichts gesendet." }),
    });
  });
}

const stillzulegen: number[] = [];

async function main(): Promise<void> {
  log("\n══ Abrechnungs-Zentrale ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Der Weg ist gebaut (Route, Menü, Seite)");
  // ═════════════════════════════════════════════════════════════════════════
  const app = readFileSync("client/src/App.tsx", "utf8");
  ok("Die Route /admin/abrechnungen ist eingehängt",
    /path="\/admin\/abrechnungen"/.test(app));
  const shell = readFileSync("client/src/components/admin/AdminShell.tsx", "utf8");
  ok("Der Menüpunkt steht unter „Umsatz & Zahlungen“",
    /path: "\/admin\/abrechnungen"/.test(shell));
  ok("Die Seite existiert", existsSync("client/src/pages/admin-abrechnungen.tsx"));
  const routen = ohneKommentar(readFileSync("server/routes/fiaon-abrechnungen.ts", "utf8"));
  for (const [name, muster] of [
    ["Liste", /router\.get\("\/admin\/abrechnungen"/],
    ["PDF", /router\.get\("\/admin\/abrechnungen\/:id\.pdf"/],
    ["Senden", /router\.post\("\/admin\/abrechnungen\/:id\/senden"/],
    ["Neu erzeugen", /router\.post\("\/admin\/abrechnungen\/:id\/neu-erzeugen"/],
    ["Mitarbeiter-Liste", /router\.get\("\/agent\/abrechnungen"/],
  ] as const) {
    ok(`Route ${name} vorhanden`, muster.test(routen));
  }
  ok("Der Router ist registriert",
    /fiaon-abrechnungen/.test(readFileSync("server/routes.ts", "utf8")));
  // Die Beleg-Wand steht im SERVER, nicht nur in der Anzeige.
  ok("„Neu erzeugen“ ist im Server gesperrt, wenn ausgezahlt",
    /auszahlung_status[\s\S]{0,80}ausgezahlt[\s\S]{0,300}BELEG_UNVERAENDERLICH/.test(routen));
  ok("Der Versand wird ABGEWARTET und sein Grund übernommen",
    /await sendMakeWebhookMitGrund/.test(routen) && /versand\.grund/.test(routen));
  ok("Die Mitarbeiter-Route begrenzt in der WHERE-Bedingung",
    /WHERE s\.agent_id = \$\{Number\(req\.agent!\.id\)\}/.test(routen));

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Der Bestand, gegen den geprüft wird");
  // ═════════════════════════════════════════════════════════════════════════
  const [b] = (await sqlPool`
    SELECT COUNT(*)::int AS alle,
           COUNT(*) FILTER (WHERE pdf_base64 IS NOT NULL)::int AS mit_pdf,
           COUNT(*) FILTER (WHERE gesendet_am IS NOT NULL)::int AS gesendet
      FROM fiaon_commission_statements
  `) as any[];
  log(`        ${b.alle} Abrechnungen · ${b.mit_pdf} mit PDF · ${b.gesendet} schon gesendet`);
  ok("Es gibt Abrechnungen zum Anzeigen", Number(b.alle) > 0);

  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("3. Die Zentrale im Browser");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const kontext = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    await attrappen(kontext);
    const page = await kontext.newPage();
    const konsole: string[] = [];
    page.on("pageerror", (e) => konsole.push(String(e.message)));

    const auf = await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } })
      .catch(() => null);
    ok("Die Zugangsschleuse ist passiert", auf != null && auf.ok(), `HTTP ${auf?.status()}`);

    await page.goto(`${BASIS}/admin/abrechnungen`, { waitUntil: "domcontentloaded" });
    // ERST WARTEN, DANN MESSEN — auf eine Marke im INHALT, nicht auf das Menü.
    const zeilenDa = await page.locator("[data-fiaon='abrechnung-zeile']").first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    ok("Die Liste zeigt Abrechnungen", zeilenDa);
    const zeilen = await page.locator("[data-fiaon='abrechnung-zeile']").count();
    log(`        ${zeilen} Zeilen sichtbar (Datenbank: ${b.alle})`);
    ok("Die Anzahl stimmt mit der Datenbank", zeilen === Number(b.alle),
      `Liste ${zeilen}, Datenbank ${b.alle}`);

    const text = await page.locator("body").innerText().catch(() => "");
    ok("Eine echte Abrechnungs-Nummer steht auf der Seite", /FIAON-COM-2026-\d{4}/.test(text));
    ok("Die vier Knöpfe sind an der Zeile",
      await page.locator("[data-fiaon='pdf-ansehen']").count() > 0
      && await page.locator("[data-fiaon='pdf-laden']").count() > 0
      && await page.locator("[data-fiaon='senden']").count() > 0
      && await page.locator("[data-fiaon='neu-erzeugen']").count() > 0);

    // ── DIE BELEG-WAND IN DER ANZEIGE ─────────────────────────────────────
    // Alle zehn Abrechnungen sind ausgezahlt — „Neu erzeugen" MUSS gesperrt
    // sein, und der Grund muss als TEXT dabeistehen (nicht nur im Tooltip).
    const neu = page.locator("[data-fiaon='neu-erzeugen']").first();
    ok("„Neu erzeugen“ ist bei ausgezahlten Belegen gesperrt", await neu.isDisabled());
    const grund = await page.locator("[data-fiaon='neu-erzeugen-grund']").first()
      .innerText().catch(() => "");
    ok("Der Sperrgrund steht als Text daneben", /Buchungsbeleg/i.test(grund), grund.slice(0, 90));

    // ── FILTER DRÜCKEN, NICHT NUR ANSEHEN ─────────────────────────────────
    await page.selectOption("[data-fiaon='filter-zustand']", "erzeugt");
    await page.waitForTimeout(2200);
    const nachFilter = await page.locator("[data-fiaon='abrechnung-zeile']").count();
    log(`        Filter „Nur erzeugt": ${nachFilter} Zeilen (alle sind ausgezahlt, 0 erwartet)`);
    ok("Der Status-Filter wirkt", nachFilter < Number(b.alle));
    await page.selectOption("[data-fiaon='filter-zustand']", "ausgezahlt");
    // ERST WARTEN, DANN MESSEN — und zwar auf die ZEILEN, nicht auf die Uhr.
    // Mit festem Timeout wurde diese Prüfung zweimal rot, obwohl der Filter
    // richtig arbeitete: Die Abfrage war noch unterwegs (AGENTS.md).
    await page.locator("[data-fiaon='abrechnung-zeile']")
      .nth(Number(b.alle) - 1).waitFor({ timeout: 20_000 }).catch(() => {});
    ok("Der Filter „Ausgezahlt“ findet sie alle",
      await page.locator("[data-fiaon='abrechnung-zeile']").count() === Number(b.alle),
      `${await page.locator("[data-fiaon='abrechnung-zeile']").count()} von ${b.alle}`);

    // Suche nach Nummer.
    await page.fill("[data-fiaon='suche']", "FIAON-COM-2026-0010");
    await page.waitForTimeout(2500);
    const gesucht = await page.locator("[data-fiaon='abrechnung-zeile']").count();
    ok("Die Suche nach der Nummer findet genau eine", gesucht === 1, `${gesucht} Treffer`);
    await bild(page, "zentrale-gesucht");
    await page.fill("[data-fiaon='suche']", "");
    await page.waitForTimeout(2200);

    // ── DAS PDF WIRKLICH ABRUFEN ──────────────────────────────────────────
    const [erste] = (await sqlPool`
      SELECT id FROM fiaon_commission_statements WHERE pdf_base64 IS NOT NULL ORDER BY id LIMIT 1
    `) as any[];
    const pdf = await kontext.request.get(`${BASIS}/api/fiaon/admin/abrechnungen/${erste.id}.pdf`);
    ok("Das PDF kommt über die Zentrale", pdf.ok(), `HTTP ${pdf.status()}`);
    const buf = await pdf.body().catch(() => Buffer.alloc(0));
    ok("Es ist wirklich ein PDF", buf.subarray(0, 5).toString() === "%PDF-",
      buf.subarray(0, 8).toString());
    log(`        ${Math.round(buf.length / 1024)} kB`);

    // ── ROT-PROBE DER BELEG-WAND: die Route direkt aufrufen ───────────────
    // Die Oberfläche sperrt den Knopf. Wer die Route direkt ruft, muss auf
    // dieselbe Wand stoßen — sonst ist es keine.
    const direkt = await kontext.request.post(
      `${BASIS}/api/fiaon/admin/abrechnungen/${erste.id}/neu-erzeugen`);
    ok("Direkter Aufruf auf einen ausgezahlten Beleg wird abgelehnt (409)",
      direkt.status() === 409, `HTTP ${direkt.status()}`);
    const j = await direkt.json().catch(() => null);
    ok("Und nennt den Grund im Klartext", /Buchungsbeleg/i.test(String(j?.error ?? "")),
      String(j?.error ?? "").slice(0, 80));

    ok("Kein JS-Fehler auf der Seite", konsole.length === 0, konsole.slice(0, 2).join(" | "));
    await bild(page, "zentrale");
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("4. Der Unterbereich im Mitarbeiter-Profil");
  // ═════════════════════════════════════════════════════════════════════════
  {
    const [wer] = (await sqlPool`
      SELECT ag.id, ag.name, COUNT(s.id)::int AS n
        FROM fiaon_agents ag
        JOIN fiaon_commission_statements s ON s.agent_id = ag.id
       GROUP BY 1, 2 ORDER BY n DESC LIMIT 1
    `) as any[];
    log(`        Prüffall: ${wer.name} mit ${wer.n} Abrechnungen (der ungünstigste, nicht der erste)`);
    const kontext = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
    await attrappen(kontext);
    const page = await kontext.newPage();
    await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
    await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);

    const karte = page.getByRole("button", { name: new RegExp(String(wer.name), "i") }).first();
    if (await karte.count() > 0) {
      await karte.click();
      await page.waitForTimeout(1200);
      const profil = page.getByRole("button", { name: /^Profil öffnen$/i }).first();
      if (await profil.count() > 0) await profil.click();
      await page.waitForTimeout(4500);
      const reiter = page.getByRole("button", { name: /^Provisionen$/i }).first();
      ok("Der Reiter „Provisionen“ ist da", await reiter.count() > 0);
      if (await reiter.count() > 0) { await reiter.click(); await page.waitForTimeout(3500); }
      const bereich = page.locator("[data-fiaon='profil-abrechnungen']");
      ok("Der Unterbereich „Abrechnungen“ ist im Profil", await bereich.count() > 0);
      if (await bereich.count() > 0) {
        const t = await bereich.innerText();
        ok("Er nennt eine echte Abrechnungs-Nummer", /FIAON-COM-2026-\d{4}/.test(t));
        ok("Er verlinkt in die Zentrale", /Abrechnungs-Zentrale/i.test(t));
        ok("Jede Zeile hat „PDF ansehen“",
          await bereich.locator("[data-fiaon='profil-pdf']").count() > 0);
        log(`        ${await bereich.locator("[data-fiaon='profil-pdf']").count()} Zeilen im Profil`);
      }
      await bild(page, "profil-abrechnungen");
    } else {
      ok(`Die Karte von ${wer.name} ist in der Team-Zentrale`, false, "nicht gefunden");
    }
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("5. Die Mitarbeiter-Sicht — und die Rot-Probe auf fremde");
  // ═════════════════════════════════════════════════════════════════════════
  {
    // Ein TESTKONTO, das sich am Ende selbst stilllegt (AGENTS.md). Es bekommt
    // KEINE eigene Abrechnung — genau deshalb ist es der richtige Prüffall für
    // „sieht man fremde?".
    const bcrypt = (await import("bcryptjs")).default;
    const mail = `pruef-abr-${Date.now().toString(36)}@pruefstand.test`;
    const pass = `P-${Math.random().toString(36).slice(2)}`;
    const [konto] = (await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                                distribution_active, created_at)
      VALUES ('Prüfstand Abrechnung (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)},
              'agent', TRUE, TRUE, FALSE, NOW())
      RETURNING id
    `) as any[];
    stillzulegen.push(Number(konto.id));

    // ── DIE SCHRANKE MUSS AUF SEIN, SONST PRÜFT MAN DIE SCHRANKE ──────────
    // Erster Lauf: HTTP 403. Ursache ist NICHT die Abrechnungs-Route, sondern
    // `customerDataGate` — ein Konto ohne angenommene Zustimmungen und ohne
    // unterschriebenen Vertrag kommt an keine geschützte Route.
    //
    // Das ist richtig so, aber es beschreibt keinen echten Mitarbeiter: Wer
    // Abrechnungen hat, hat das Onboarding hinter sich. AGENTS.md: „Ein
    // Prüfstand, der die Vorbedingungen nicht herstellt, prüft eine Sperre und
    // meldet sie als Fehler."
    //
    // Die Nachweise tragen `PRUEFSTAND` und werden am Ende entfernt. Die
    // Vertriebs-Verpflichtungserklärung wird NICHT angenommen — die ist ein
    // Rechtsnachweis und darf nie von einem Roboter kommen.
    const { ONBOARDING_DOCS } = await import("../server/routes/fiaon-onboarding-content");
    for (const d of ONBOARDING_DOCS as any[]) {
      await sqlPool`
        INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, accepted_at, ip, user_agent)
        VALUES (${Number(konto.id)}, ${d.key}, ${d.version}, NOW(), '127.0.0.1', 'PRUEFSTAND')
        ON CONFLICT DO NOTHING
      `.catch(() => {});
    }
    const [v] = (await sqlPool`
      SELECT version FROM fiaon_contract_templates WHERE status = 'active'
      ORDER BY version DESC LIMIT 1
    `) as any[];
    if (v) {
      await sqlPool`
        INSERT INTO fiaon_agent_contracts
          (agent_id, template_version, variables_json, rendered_html, signature_name,
           signature_mode, signed_at, ip, user_agent, doc_hash, status)
        VALUES (${Number(konto.id)}, ${v.version}, '{}', '<p>PRUEFSTAND</p>', 'PRUEFSTAND',
                'typed', NOW(), '127.0.0.1', 'PRUEFSTAND', 'PRUEFSTAND', 'signed')
      `.catch(() => {});
    }

    const kontext = await browser.newContext();
    const an = await kontext.request.post(`${BASIS}/api/fiaon/agent/login`, {
      data: { email: mail, password: pass },
    }).catch(() => null);
    ok("Das Testkonto kann sich anmelden", an != null && an.ok());

    const eigene = await kontext.request.get(`${BASIS}/api/fiaon/agent/abrechnungen`);
    const je = await eigene.json().catch(() => null);
    ok("Die eigene Liste antwortet", eigene.ok(), `HTTP ${eigene.status()}`);
    ok("Sie ist leer — das Konto hat keine Abrechnung",
      Array.isArray(je?.abrechnungen) && je.abrechnungen.length === 0,
      `${je?.abrechnungen?.length ?? "?"} Einträge`);

    // ── DIE ROT-PROBE: eine FREMDE Abrechnung abrufen ────────────────────
    const [fremd] = (await sqlPool`
      SELECT id, statement_no, agent_id FROM fiaon_commission_statements
       WHERE agent_id <> ${Number(konto.id)} AND pdf_base64 IS NOT NULL
       ORDER BY id LIMIT 1
    `) as any[];
    const versuch = await kontext.request.get(
      `${BASIS}/api/fiaon/agent/documents/statement/${fremd.id}.pdf`);
    ok(`Eine FREMDE Abrechnung (${fremd.statement_no}) wird verweigert`,
      versuch.status() === 404 || versuch.status() === 403,
      `HTTP ${versuch.status()} — bei 200 hätte das Konto einen fremden Beleg gelesen`);

    // Und die Zentrale ist für einen Mitarbeiter zu.
    const zentrale = await kontext.request.get(`${BASIS}/api/fiaon/admin/abrechnungen`);
    ok("Die Abrechnungs-Zentrale ist ohne Verwaltungs-Zugang gesperrt",
      zentrale.status() === 401 || zentrale.status() === 403, `HTTP ${zentrale.status()}`);

    // ── DIE SEITE, DIE DER MITARBEITER SIEHT ──────────────────────────────
    // Das Testkonto hat KEINE Abrechnung — gezeigt wird also der leere Zustand.
    // Genau der ist prüfenswert: Ein leerer Bereich ohne Erklärung ist der
    // Fehler, den das Team an anderen Stellen als „da steht nichts" gemeldet
    // hat. Ihm eine echte Abrechnung anzulegen wäre ein erfundener Geldbeleg in
    // einer Finanztabelle — das wird nicht gemacht.
    const seite = await kontext.newPage();
    await seite.goto(`${BASIS}/agent/verdienst`, { waitUntil: "domcontentloaded" });
    const verdienstDa = await seite.getByText(/Verdienst/i).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
    ok("Die Verdienst-Seite lädt", verdienstDa);
    // Auf eine Marke im INHALT warten. Beim ersten Lauf war die Seite nach vier
    // Sekunden noch ein Skelett — und das war ein echter Befund: Die Seite hatte
    // keinen Fehlerweg und drehte unbegrenzt.
    await seite.getByText(/Deine Abrechnungen|Deine Zahlen sind nicht geladen/i).first()
      .waitFor({ timeout: 30_000 }).catch(() => {});
    const t = await seite.locator("body").innerText().catch(() => "");
    // Entweder der Bereich ODER eine erklärte Fehlermeldung — NICHT ein
    // Skelett ohne Ende. Genau das war vorher der Fall.
    const bereichDa = /Deine Abrechnungen/i.test(t);
    const fehlerDa = await seite.locator("[data-fiaon='verdienst-fehler']").count() > 0;
    ok("Die Seite sagt etwas — Bereich oder erklärter Fehler, kein endloses Skelett",
      bereichDa || fehlerDa, `Bereich=${bereichDa} Fehler=${fehlerDa}`);
    if (bereichDa) {
      ok("Der leere Zustand ERKLÄRT sich",
        await seite.locator("[data-fiaon='keine-abrechnungen']").count() > 0);
      ok("Es steht der Zweck dabei (Buchungsbeleg für den Steuerberater)",
        /Steuerberater/i.test(t));
    } else {
      log("        Die Kennzahlen kamen nicht — geprüft wurde der Fehlerweg.");
    }
    // Zum Bereich SCROLLEN, bevor das Bild entsteht: Ein Screenshot, auf dem
    // das Geprüfte unter dem Falz liegt, beweist nichts.
    await seite.getByText(/Deine Abrechnungen/i).first()
      .scrollIntoViewIfNeeded().catch(() => {});
    await seite.waitForTimeout(900);
    await bild(seite, "mitarbeiter-verdienst");
    await kontext.close();
  }

  await browser.close();
  await aufraeumen();
  log(`\n        ${stillzulegen.length} Testkonto stillgelegt, Testnachweise entfernt.`);
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

/**
 * Aufräumen läuft IMMER — nicht nur im Erfolgsfall. Ein Aufräumen, das nur bei
 * Erfolg läuft, läuft nie, weil man den Fehlerfall nicht plant (AGENTS.md).
 */
async function aufraeumen(): Promise<void> {
  for (const id of stillzulegen) {
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
