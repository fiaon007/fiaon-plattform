// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Der FIAON Copilot — Knopf finden, Knopf drücken (30.08.2026)
//
// Was hier bewiesen wird (AGENTS.md: „Eine Funktion ist erst geliefert, wenn
// ein Mensch sie anklicken kann"):
//   1. Ein Mitarbeiter meldet sich durch die ECHTE Tür an und öffnet
//      /agent/assistent — das Deck rendert.
//   2. Ein Auftrag streamt eine Antwort; ein „frei“-Werkzeug (kunde_suchen)
//      läuft ECHT über den bestehenden Endpunkt und die Karte wird „erledigt“.
//   3. Ein „bestaetigen“-Werkzeug erzeugt die Bestätigungskarte: Der
//      „Ausführen“-Knopf wird GEFUNDEN (sichtbar, bedienbar) — GEDRÜCKT wird
//      „Abbrechen“: Die Karte zeigt „verworfen“. Der letzte Klick einer
//      Sendestrecke bleibt aus (AGENTS.md: der Dialog wird gezeigt, nicht
//      bestätigt) — es entsteht KEINE echte Mail.
//   4. Die Wortverbots-Wand: Ein Kundentext mit „Garantie“ wird serverseitig
//      geblockt — die Karte wird „fehlgeschlagen“ mit Klartext.
//   5. Das Deck auf 375 px.
//   6. Die zehn Themenseiten: H1, Antrag-Knopf, Compliance-Satz, JSON-LD,
//      Screenshot je Breite — plus die interaktiven Kerne (Checker,
//      Checkliste, Umschalter, Glossar-Suche).
//
// ── WIE HIER NICHTS ECHTES PASSIERT ────────────────────────────────────────
// · Das MODELL ist eine Attrappe: ein lokaler OpenAI-kompatibler SSE-Server
//   (ASSISTENT_BASIS_URL zeigt darauf). Kein externer Aufruf, kein Schlüssel.
// · Das „frei“-Werkzeug sucht einen Kunden, den es nicht gibt — lesend.
// · Die Mail wird nur VORBEREITET (die Vorschau-Route rendert, sendet nicht);
//   gedrückt wird Abbrechen. Termin/Bestellung/Sperre werden nie ausgelöst.
// · Das Testkonto trägt is_test_account = TRUE von der ERSTEN Sekunde und
//   legt sich am Ende über testkontoStilllegen selbst still.
//
// Aufruf (Server startet dieses Skript selbst):
//   set -a && . ./.env && set +a && \
//   DATABASE_URL="$DATABASE_URL_EXTERN" npx tsx scripts/pruef-assistent.ts
// Rot-Probe (der Prüfstand muss rot werden können):
//   … ROT_PROBE=1 npx tsx scripts/pruef-assistent.ts
// ═══════════════════════════════════════════════════════════════════════════
import { mkdirSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const PORT = 5188;
const MODELL_PORT = 5599;
const BASIS = `http://localhost:${PORT}`;
const BILDER = "reports/bilder-assistent";
const ROT_PROBE = process.env.ROT_PROBE === "1";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden += 1; log(`  PASS  ${name}`); }
  else { fehlgeschlagen += 1; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`); }
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}

const stillzulegen: number[] = [];

/** Onboarding-Schranke fürs Testkonto öffnen — Muster: pruef-akte-haken.ts.
 *  Die Verpflichtungserklärung der LEITUNG wird NICHT angenommen (AGENTS.md). */
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

// ═══════════════════════════════════════════════════════════════════════════
// Die Modell-Attrappe: OpenAI-kompatibel, streamt SSE, entscheidet am
// Auftragstext. Sie sitzt dort, wo sonst die echte API sitzt — Registry,
// SSE-Verarbeitung, Werkzeug-Schleife und Karten laufen ECHT durch.
// ═══════════════════════════════════════════════════════════════════════════
function modellAttrappe(personId: number): Server {
  const stueck = (res: any, delta: Record<string, unknown>, ende: string | null = null) => {
    res.write(`data: ${JSON.stringify({ id: "pruef", object: "chat.completion.chunk", choices: [{ index: 0, delta, finish_reason: ende }] })}\n\n`);
  };
  return createServer((req, res) => {
    let roh = "";
    req.on("data", (d) => { roh += String(d); });
    req.on("end", () => {
      let body: any = {};
      try { body = JSON.parse(roh || "{}"); } catch { /* leer */ }
      const nachrichten: any[] = Array.isArray(body.messages) ? body.messages : [];
      const letzterNutzer = [...nachrichten].reverse().find((m) => m.role === "user")?.content ?? "";
      const hatWerkzeugAntwort = nachrichten.some((m) => m.role === "tool");
      res.writeHead(200, { "content-type": "text/event-stream" });

      const text = (satz: string) => {
        stueck(res, { role: "assistant" });
        for (const teil of satz.match(/.{1,18}/g) || []) stueck(res, { content: teil });
        stueck(res, {}, "stop");
        res.end("data: [DONE]\n\n");
      };
      const werkzeug = (name: string, argumente: Record<string, unknown>) => {
        const json = JSON.stringify(argumente);
        stueck(res, { role: "assistant", tool_calls: [{ index: 0, id: "aufruf_pruef_1", type: "function", function: { name, arguments: json.slice(0, 12) } }] });
        stueck(res, { tool_calls: [{ index: 0, function: { arguments: json.slice(12) } }] });
        stueck(res, {}, "tool_calls");
        res.end("data: [DONE]\n\n");
      };

      if (String(letzterNutzer).includes("PRUEFSTAND-SUCHE")) {
        if (!hatWerkzeugAntwort) return werkzeug("kunde_suchen", { suchtext: "PRUEFSTAND-UNAUFFINDBAR-9317" });
        return text("Die Suche ist abgeschlossen: kein Treffer zu diesem Namen.");
      }
      if (String(letzterNutzer).includes("PRUEFSTAND-MAIL")) {
        if (!hatWerkzeugAntwort) {
          return werkzeug("mail_freitext_senden", {
            personId,
            betreff: "Ihre Unterlagen bei FIAON",
            text: "Sehr geehrte Damen und Herren,\n\nIhre Unterlagen liegen vollständig vor. Den aktuellen Stand sehen Sie jederzeit in Ihrem Kundenbereich.\n\nFreundliche Grüße\nIhr FIAON-Team",
          });
        }
        return text("Die E-Mail ist vorbereitet — bitte unten auf der Karte bestätigen oder abbrechen.");
      }
      if (String(letzterNutzer).includes("PRUEFSTAND-VERBOT")) {
        if (!hatWerkzeugAntwort) {
          return werkzeug("mail_freitext_senden", {
            personId,
            betreff: "Wir garantieren die Löschung",
            text: "Sehr geehrte Damen und Herren, wir garantieren Ihnen die Löschung aller Einträge.",
          });
        }
        return text("Verstanden — dieser Text ist nicht zulässig.");
      }
      return text("Ich habe keinen passenden Prüffall erkannt.");
    });
  }).listen(MODELL_PORT, "127.0.0.1");
}

// ═══════════════════════════════════════════════════════════════════════════
// Der Anwendungsserver — vom Prüfstand selbst gestartet, mit der Attrappe
// als Modellzugang. Erst „serving on port“, dann geht es los (AGENTS.md).
// ═══════════════════════════════════════════════════════════════════════════
async function serverStarten(): Promise<ChildProcess> {
  const kind = spawn("npx", ["tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "development",
      ASSISTENT_API_KEY: "pruefstand-schluessel",
      ASSISTENT_MODELL: "pruefstand-modell",
      ASSISTENT_BASIS_URL: `http://127.0.0.1:${MODELL_PORT}/v1`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((fertig, kaputt) => {
    const zeit = setTimeout(() => kaputt(new Error("Der Server hat nie „serving on port“ gemeldet.")), 120_000);
    const lauschen = (d: Buffer) => {
      if (String(d).includes("serving on port")) { clearTimeout(zeit); fertig(); }
    };
    kind.stdout?.on("data", lauschen);
    kind.stderr?.on("data", lauschen);
    kind.on("exit", (code) => { clearTimeout(zeit); kaputt(new Error(`Server-Prozess endete vorzeitig (Code ${code}).`)); });
  });
  return kind;
}

// ═══════════════════════════════════════════════════════════════════════════
async function copilotPruefen(browser: Browser, mail: string, pass: string): Promise<void> {
  gruppe("2. Der Copilot am Rechner (1440 px)");
  const kontext = await browser.newContext({ viewport: { width: 1440, height: 940 } });
  // Die Verfügbarkeits-Erinnerung der OfficeShell (liest NUR ok+vollstaendig
  // aus GET /agent/arbeitszeiten) würde mitten im Ablauf ein Fenster über die
  // Knöpfe legen — beim zweiten Lauf hat sie genau den Abbrechen-Klick
  // geschluckt, und nur der Screenshot hat es verraten. Die Attrappe liefert
  // die Felder, die die Shell liest.
  const arbeitszeitenAttrappe = (k: BrowserContext) => k.route("**/api/fiaon/agent/arbeitszeiten", (r) => {
    if (r.request().method() !== "GET") return r.fallback();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, vollstaendig: true }) });
  });
  await arbeitszeitenAttrappe(kontext);
  const page = await kontext.newPage();
  const reactFehler: string[] = [];
  page.on("pageerror", (e) => reactFehler.push(String(e.message)));
  page.on("console", (m) => {
    if (m.type() === "error" && /Rendered more hooks|Rules of Hooks|#310/i.test(m.text())) reactFehler.push(m.text());
  });

  // Anmeldung durch die echte Tür — ihr Ergebnis wird geprüft.
  const an = await kontext.request.post(`${BASIS}/api/fiaon/agent/login`,
    { data: { email: mail, password: pass } }).catch(() => null);
  ok("Das Testkonto ist angemeldet", an != null && an.ok(), `HTTP ${an?.status()}`);

  // Rundgang UND Einführung würden als Erstes aufgehen und die Knöpfe
  // verdecken (die Einführung hat es beim ersten Lauf getan — nur der
  // Screenshot hat es verraten). Beide werden vorab über ihre echten Routen
  // als gesehen markiert; falls trotzdem ein Fenster steht, wird es
  // übersprungen.
  await kontext.request.post(`${BASIS}/api/fiaon/agent/rundgaenge/assistent`, { data: {} }).catch(() => null);
  await kontext.request.post(`${BASIS}/api/fiaon/agent/einfuehrung`, { data: {} }).catch(() => null);

  await page.goto(`${BASIS}/agent/assistent`, { waitUntil: "domcontentloaded" });
  const ueberspringen = page.getByText(/^Überspringen$/i).first();
  if (await ueberspringen.isVisible().catch(() => false)) {
    await ueberspringen.click().catch(() => {});
    await page.waitForTimeout(400);
  }
  const deckDa = await page.locator("[data-fiaon='assistent-eingabe']")
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  if (!deckDa) {
    await bild(page, "fehlgriff-deck");
    const t = await page.locator("body").innerText().catch(() => "");
    log(`        Seitentext: ${t.slice(0, 240).replace(/\s+/g, " ")}`);
  }
  ok("Das Command-Deck rendert (Eingabefeld da)", deckDa);
  ok("Die Vorschlags-Chips stehen auf dem Deck",
    await page.locator(".asx-vorschlag").count().then((n) => n >= 6).catch(() => false));
  ok("Die Werkzeug-Legende ist da und ehrlich",
    await page.locator("[data-fiaon='assistent-legende']").innerText()
      .then((t) => /Werkzeuge/i.test(t)).catch(() => false));
  await bild(page, "copilot-deck-desktop");

  // ── Fluss 1: ein freies Werkzeug läuft echt ───────────────────────────────
  const eingabe = page.locator("[data-fiaon='assistent-eingabe']");
  await eingabe.fill("PRUEFSTAND-SUCHE: Such bitte den Kunden PRUEFSTAND-UNAUFFINDBAR.");
  await eingabe.press("Enter");
  ok("Werkzeug-Karte „Kunden suchen“ erscheint und wird erledigt",
    await page.locator("[data-fiaon='assistent-karte-werkzeug']").getByText(/erledigt/i).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false));
  ok("Die Antwort streamt als Text",
    await page.getByText(/Suche ist abgeschlossen/i).first()
      .waitFor({ timeout: 20_000 }).then(() => true).catch(() => false));
  await bild(page, "copilot-werkzeug-frei");

  // ── Fluss 2: Bestätigungskarte — finden, ansehen, ABBRECHEN drücken ──────
  await eingabe.fill("PRUEFSTAND-MAIL: Bereite die Unterlagen-Mail vor.");
  await eingabe.press("Enter");
  const karte = page.locator("[data-fiaon='assistent-karte-bestaetigung']").last();
  const knopfName = ROT_PROBE ? "Losführen" : "Ausführen";
  const ausfuehren = karte.getByRole("button", { name: new RegExp(knopfName, "i") });
  ok(`Der „${knopfName}“-Knopf ist da und bedienbar (gefunden, nicht gedrückt)`,
    await ausfuehren.waitFor({ timeout: 30_000 })
      .then(async () => ausfuehren.isEnabled()).catch(() => false),
    "ohne diesen Knopf kann kein Mensch bestätigen");
  ok("Die echte Mail-Vorschau hängt an der Karte (iframe)",
    await karte.locator("iframe").first().waitFor({ timeout: 20_000 })
      .then(() => true).catch(() => false));
  await bild(page, "copilot-bestaetigung");

  const abbrechen = karte.getByRole("button", { name: /Abbrechen/i });
  await abbrechen.click().catch(() => {});
  ok("„Abbrechen“ gedrückt → die Karte zeigt „verworfen“",
    await karte.getByText(/verworfen/i).first()
      .waitFor({ timeout: 15_000 }).then(() => true).catch(() => false));
  await bild(page, "copilot-verworfen");

  // ── Fluss 3: die Wortverbots-Wand ────────────────────────────────────────
  await eingabe.fill("PRUEFSTAND-VERBOT: Schreib ihm, dass wir die Löschung garantieren.");
  await eingabe.press("Enter");
  ok("Verbotener Kundentext wird serverseitig geblockt (Karte fehlgeschlagen)",
    await page.locator("[data-fiaon='assistent-karte-werkzeug']")
      .getByText(/nicht erlaubte Formulierungen/i).first()
      .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false));
  await bild(page, "copilot-wortverbot");

  ok("Die Sitzung steht links in der Leiste",
    await page.locator("[data-fiaon='assistent-sitzungen'] .asx-sitzung").count()
      .then((n) => n >= 1).catch(() => false));
  ok("Kein React-Haken-Fehler in der Konsole", reactFehler.length === 0, reactFehler[0] || "");
  await kontext.close();

  gruppe("3. Der Copilot am Telefon (375 px)");
  const schmal = await browser.newContext({ viewport: { width: 375, height: 800 } });
  await arbeitszeitenAttrappe(schmal);
  const seite = await schmal.newPage();
  const an2 = await schmal.request.post(`${BASIS}/api/fiaon/agent/login`,
    { data: { email: mail, password: pass } }).catch(() => null);
  ok("Anmeldung auch im schmalen Fenster", an2 != null && an2.ok());
  await schmal.request.post(`${BASIS}/api/fiaon/agent/rundgaenge/assistent`, { data: {} }).catch(() => null);
  await schmal.request.post(`${BASIS}/api/fiaon/agent/einfuehrung`, { data: {} }).catch(() => null);
  await seite.goto(`${BASIS}/agent/assistent`, { waitUntil: "domcontentloaded" });
  const ueberspringen2 = seite.getByText(/^Überspringen$/i).first();
  if (await ueberspringen2.isVisible().catch(() => false)) {
    await ueberspringen2.click().catch(() => {});
    await seite.waitForTimeout(400);
  }
  ok("Das Deck wird zur Chatansicht (Eingabe sichtbar, nichts ragt heraus)",
    await seite.locator("[data-fiaon='assistent-eingabe']").waitFor({ timeout: 30_000 })
      .then(async () => {
        const breiter = await seite.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
        return breiter;
      }).catch(() => false));
  await bild(seite, "copilot-deck-375");
  await schmal.close();
}

// ═══════════════════════════════════════════════════════════════════════════
const SEITEN: Array<{ pfad: string; h1: RegExp; extra?: (page: Page) => Promise<void> }> = [
  { pfad: "/schufa-score-verstehen", h1: /SCHUFA-Score verstehen/i },
  { pfad: "/bonitaetsauskunft-beantragen", h1: /Bonitätsauskunft beantragen/i },
  { pfad: "/inkasso-brief-erhalten", h1: /Inkasso-Brief erhalten/i },
  {
    pfad: "/eintrag-verjaehrung", h1: /SCHUFA-Eintrag nach Jahren/i,
    extra: async (page) => {
      await page.locator("[data-fiaon='verjaehrungs-checker'] input[type='date']").fill("2021-01-15");
      ok("Der Verjährungs-Checker rechnet (abgelaufene Frist erkannt)",
        await page.getByText(/abgelaufen/i).first().waitFor({ timeout: 10_000 })
          .then(() => true).catch(() => false));
    },
  },
  { pfad: "/girokonto-trotz-negativer-bonitaet", h1: /Girokonto trotz negativer Bonität/i },
  { pfad: "/ratenzahlung-und-bonitaet", h1: /Ratenzahlung und Bonität/i },
  {
    pfad: "/selbstauskunft-checkliste", h1: /Selbstauskunft lesen/i,
    extra: async (page) => {
      await page.locator(".sx-punkt").first().click();
      ok("Die Checkliste hakt ab und zählt",
        await page.getByText(/1 von 10 Punkten/i).first().waitFor({ timeout: 10_000 })
          .then(() => true).catch(() => false));
    },
  },
  {
    pfad: "/schufa-neutral-anfragen", h1: /SCHUFA-neutral anfragen/i,
    extra: async (page) => {
      await page.getByRole("tab", { name: /^Kreditanfrage$/i }).click();
      ok("Der Umschalter hebt die Kreditanfrage-Karte hervor",
        await page.locator(".sx-vergleich .dk-glas.an").getByText(/10 Tage/i).first()
          .waitFor({ timeout: 10_000 }).then(() => true).catch(() => false));
    },
  },
  { pfad: "/fiaon-erfahrungen", h1: /So arbeitet/i },
  {
    pfad: "/glossar-bonitaet", h1: /Bonitäts-Glossar/i,
    extra: async (page) => {
      await page.locator("[data-fiaon='glossar-suche']").fill("Inkasso");
      ok("Die Glossar-Suche filtert",
        await page.locator(".sx-begriff").count().then((n) => n >= 1 && n <= 6).catch(() => false));
    },
  },
];

async function seitenPruefen(browser: Browser): Promise<void> {
  gruppe("4. Die zehn Themenseiten — Desktop und 375 px");
  for (const s of SEITEN) {
    const name = s.pfad.replace(/\//g, "");
    for (const [breite, hoehe, kennung] of [[1440, 940, "desktop"], [375, 800, "375"]] as const) {
      const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe } });
      const page = await kontext.newPage();
      await page.goto(`${BASIS}${s.pfad}`, { waitUntil: "domcontentloaded" });
      const h1Da = await page.getByRole("heading", { level: 1 }).filter({ hasText: s.h1 }).first()
        .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
      ok(`[${kennung}] ${s.pfad} — H1 trifft die Suchintention`, h1Da);
      if (!h1Da) { await bild(page, `fehlgriff-${name}-${kennung}`); await kontext.close(); continue; }
      if (kennung === "desktop") {
        ok(`[${kennung}] ${s.pfad} — „Jetzt Antrag starten“ führt zu /antrag`,
          await page.locator("a[href='/antrag']").first().isVisible().catch(() => false));
        const text = await page.locator("body").innerText().catch(() => "");
        ok(`[${kennung}] ${s.pfad} — der Compliance-Satz steht auf der Seite`,
          /keine Rechtsberatung/i.test(text));
        ok(`[${kennung}] ${s.pfad} — JSON-LD ist gesetzt`,
          await page.locator("script[type='application/ld+json']").count().then((n) => n >= 1).catch(() => false));
        if (s.extra) await s.extra(page).catch((e) => ok(`${s.pfad} — Extra-Prüfung lief`, false, String(e?.message || e)));
      } else {
        ok(`[${kennung}] ${s.pfad} — nichts ragt seitlich heraus`,
          await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1).catch(() => false));
      }
      await bild(page, `seite-${name}-${kennung}`);
      await kontext.close();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  log(`\n══ Wand: der FIAON Copilot und die zehn Themenseiten ${ROT_PROBE ? "— ROT-PROBE" : ""} ══`);
  let attrappe: Server | null = null;
  let server: ChildProcess | null = null;
  let browser: Browser | null = null;
  try {
    gruppe("1. Prüffall und Bühne");
    // Der Prüffall fürs Mail-Werkzeug: ein unzugewiesener Mensch mit E-Mail
    // und Bestellung (die Vorschau braucht eine Akte, an der sie rendert).
    const [person] = (await sqlPool`
      SELECT p.id FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT p.is_blocked AND p.assigned_agent_id IS NULL
        AND COALESCE(p.primary_email, '') <> ''
        AND EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL)
      ORDER BY p.id DESC LIMIT 1
    `) as any[];
    ok("Ein Prüffall-Kunde ist gefunden (lesend)", !!person, "ohne Kunden keine Mail-Vorschau");
    if (!person) throw new Error("Kein Prüffall — Abbruch.");

    const bcrypt = (await import("bcryptjs")).default;
    const mail = `pruef-copilot-${Date.now().toString(36)}@pruefstand.test`;
    const pass = `P-${Math.random().toString(36).slice(2)}A1a`;
    const [konto] = (await sqlPool`
      INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                                distribution_active, created_at)
      VALUES ('Prüfstand Copilot (Testkonto)', ${mail}, ${await bcrypt.hash(pass, 10)},
              'agent', TRUE, TRUE, FALSE, NOW())
      RETURNING id
    `) as any[];
    stillzulegen.push(Number(konto.id));
    await schrankeOeffnen(Number(konto.id));
    ok("Testkonto angelegt (is_test_account von der ersten Sekunde)", !!konto?.id);

    attrappe = modellAttrappe(Number(person.id));
    log("        Modell-Attrappe lauscht auf 127.0.0.1:" + MODELL_PORT);
    server = await serverStarten();
    ok("Der Server meldet „serving on port“", true);

    browser = await chromium.launch();
    await copilotPruefen(browser, mail, pass);
    await seitenPruefen(browser);
  } catch (err: any) {
    ok("Der Prüfstand lief bis zum Ende", false, String(err?.message || err));
  } finally {
    for (const id of stillzulegen) {
      await testkontoStilllegen(id).catch(() => {});
      log(`        Testkonto ${id} stillgelegt.`);
    }
    await browser?.close().catch(() => {});
    server?.kill("SIGTERM");
    attrappe?.close();
    await sqlPool.end({ timeout: 5 }).catch(() => {});
  }
  log(`\n══ Ergebnis: ${bestanden} PASS · ${fehlgeschlagen} FAIL ══\n`);
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main();
