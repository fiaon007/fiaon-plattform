// ═══════════════════════════════════════════════════════════════════════════
// DER KNOPF-DURCHGANG — die systematische Antwort auf „Buttons gehen nicht"
//
// ── WARUM NICHT EINZELFALL-JAGD ────────────────────────────────────────────
// „Buttons gehen nicht" ist keine Fehlermeldung, sondern eine Stimmung. Wer
// ihr einzeln nachjagt, findet drei Knöpfe und übersieht dreißig. Dieser Lauf
// DRÜCKT JEDEN sichtbaren Aktionsknopf auf den Kernseiten — je Rolle — und
// notiert, was passiert:
//
//   · Antwortete der Server mit 403/404/500?
//   · Warf der Browser einen Fehler (Handler kaputt)?
//   · Blieb die Seite stumm (kein Ladezustand, keine Rückmeldung)?
//
// Das Ergebnis ist eine BEFUNDLISTE, keine Vermutung.
//
// ── ES ENTSTEHT KEIN ECHTER VORGANG ────────────────────────────────────────
// Jeder schreibende Aufruf wird abgefangen (`page.route`) und mit einer
// Attrappe beantwortet. Kein Mail, keine Buchung, keine Unterschrift, kein
// Anruf. Am 06.08.2026 hat ein Playwright-Lauf eine echte
// Verpflichtungserklärung angenommen — diese Wand ist die Lehre daraus.
//
// Bestätigungsdialoge werden ANGENOMMEN: Ein Knopf, der nach dem Bestätigen
// nichts tut, ist genau der Fall, den wir suchen. Der Ruf dahinter landet in
// der Attrappe.
//
// VORAUSSETZUNG: ein laufender Server.
//   set -a && . ./.env && set +a && PORT=5188 npm run dev
//   npx tsx scripts/pruef-knopf-durchgang.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, type Page, type BrowserContext } from "playwright";
import { sqlPool } from "../server/lib/db-pool";
import { testkontoStilllegen } from "../server/lib/fiaon-mitarbeiter-sicht";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-knoepfe";

/** Wörter, hinter denen ein UNUMKEHRBARER Vorgang steht. Nicht drücken. */
const NIE_DRUECKEN = [
  "annehmen", "unterschreib", "signier", "verpflicht", "zusage",
  "löschen", "entfernen", "dsgvo", "kündigen",
  "abmelden", "ausloggen", "logout",
  "auszahlen", "überweisen", "stornieren", "widerruf",
  "als bezahlt", "bezahlt markieren", "verbuchen",
];

interface Befund {
  rolle: string;
  seite: string;
  knopf: string;
  art: "http" | "handler" | "stumm" | "ok" | "gesperrt";
  detail: string;
}

/**
 * Routen, die ein FRISCHES Testkonto zu Recht mit 403 abweisen.
 *
 * ── DER FEHLALARM IM ERSTEN LAUF (16.08.2026) ─────────────────────────────
 * Der Durchgang meldete sieben „Fehler". Alle sieben waren Zugangswände, die
 * korrekt griffen: Ein neu angelegtes Konto hat sein Onboarding nicht
 * abgeschlossen und keine Verpflichtungserklärung angenommen — und darf
 * deshalb nichts sehen.
 *
 * Diese Wände dürfen im Prüfstand NICHT echt durchlaufen werden: Am
 * 06.08.2026 hat ein Playwright-Lauf eine echte Verpflichtungserklärung
 * angenommen. Also müssen sie als ERWARTET erkannt werden.
 *
 * AGENTS.md: „Eine Bremse, die falsch auslöst, ist gefährlicher als keine."
 * Sieben Fehlalarme, und beim achten Lauf sieht keiner mehr hin.
 */
// NACHGEPRÜFT im Quelltext, nicht geraten: `customerDataGate`
// (server/routes/fiaon-onboarding.ts, Zeile 399) hängt vor JEDER Route unter
// „/agent/…" und antwortet mit 403, solange das Onboarding des Mitarbeiters
// nicht abgeschlossen ist. Für ein frisches Testkonto ist das ALLES außer den
// ausdrücklich freigegebenen Pfaden.
//
// Deshalb gilt: 403 auf einem „/agent/…"-Pfad ist bei einem Prüf-Testkonto
// erwartet. Ein 404 oder 500 ist es NIE — das bleibt ein Fehler.
//
// Die Liste nur zu verlängern, bis alles grün ist, wäre Wegdrücken. Sie ist
// deshalb an EINE nachgelesene Bedingung gebunden, nicht an gesammelte Pfade.
function istZugangswand(detail: string): boolean {
  if (!/\b403\b/.test(detail)) return false;
  if (/\b(404|500|502|503)\b/.test(detail)) return false;
  // Jeder genannte Pfad muss unter /agent/ oder /inkasso/ liegen.
  const pfade = detail.match(/\/[a-z0-9/_.*-]+/gi) ?? [];
  return pfade.length > 0
    && pfade.every((x) => x.includes("/agent/") || x.includes("/inkasso/"));
}

const befunde: Befund[] = [];
let gedrueckt = 0;
const log = (s = "") => console.log(s);

function nieDruecken(name: string): boolean {
  const n = name.toLowerCase();
  return NIE_DRUECKEN.some((w) => n.includes(w));
}

/**
 * Legt die Attrappen. ALLES, was schreibt, wird abgefangen.
 *
 * Lesende Aufrufe gehen durch — sonst prüft man eine Attrappe und nicht die
 * Anwendung. Genau dieser Fehler ist mir beim Abo-Prüfstand passiert: Ein
 * Platzhalter über „/admin/mail/**" fing auch das reine Lesen ab, und der
 * Prüfstand meldete seinen eigenen Fehlschlag.
 */
async function attrappen(kontext: BrowserContext, gesehen: Map<string, number>): Promise<void> {
  await kontext.route("**/api/**", async (route) => {
    const req = route.request();
    const methode = req.method();
    const url = req.url();
    if (methode === "GET" || methode === "HEAD") return route.fallback();

    // Schreibender Aufruf → Attrappe. Wir merken uns, WAS gerufen wurde:
    // Ein Knopf, der gar nichts ruft, ist ein anderer Befund als einer, der
    // ruft und scheitert.
    const pfad = new URL(url).pathname;
    gesehen.set(pfad, (gesehen.get(pfad) ?? 0) + 1);
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        ok: true, attrappe: true,
        meldung: "Attrappe im Knopf-Durchgang — es ist nichts passiert.",
      }),
    });
  });
}

/** Ein Lauf über eine Seite: jeden Knopf finden, prüfen, drücken. */
async function seiteDurchgehen(
  page: Page, rolle: string, seite: string, gesehen: Map<string, number>,
): Promise<void> {
  const httpFehler: string[] = [];
  const jsFehler: string[] = [];
  const aufAntwort = (r: any) => {
    const s = r.status();
    if (s >= 400 && r.url().includes("/api/")) {
      httpFehler.push(`${s} ${new URL(r.url()).pathname}`);
    }
  };
  const aufSeitenfehler = (e: Error) => jsFehler.push(e.message);
  page.on("response", aufAntwort);
  page.on("pageerror", aufSeitenfehler);
  // Bestätigungsdialoge annehmen — der Ruf geht in die Attrappe.
  page.on("dialog", (d) => void d.accept().catch(() => {}));

  try {
    // 90 Sekunden, nicht 40: /admin/events lädt Ereignis-Registry UND
    // Zustellprotokoll. Ein Zeitlimit, das die eigene Seite reißt, meldet
    // einen Fehler, den es nicht gibt — und der nächste Lauf wird ignoriert.
    await page.goto(`${BASIS}${seite}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    // ERST WARTEN, DANN MESSEN: Eine Seite, die noch lädt, hat keine Knöpfe.
    await page.waitForTimeout(3500);

    const knoepfe = page.locator("button:visible, a[role='button']:visible");
    const anzahl = Math.min(await knoepfe.count(), 40);
    if (anzahl === 0) {
      befunde.push({
        rolle, seite, knopf: "—", art: "stumm",
        detail: "Kein sichtbarer Knopf. Seite leer, gesperrt oder nicht geladen.",
      });
      return;
    }

    for (let i = 0; i < anzahl; i++) {
      const k = knoepfe.nth(i);
      let name = "";
      try {
        name = ((await k.innerText({ timeout: 1500 })) || await k.getAttribute("aria-label") || "").trim();
      } catch { continue; }
      if (!name) name = (await k.getAttribute("title")) || "(ohne Beschriftung)";
      name = name.replace(/\s+/g, " ").slice(0, 60);

      if (nieDruecken(name)) continue;
      if (!(await k.isEnabled().catch(() => false))) continue;

      const vorHttp = httpFehler.length;
      const vorJs = jsFehler.length;
      const vorRufe = Array.from(gesehen.values()).reduce((a, b) => a + b, 0);

      try {
        await k.click({ timeout: 3000, noWaitAfter: true });
        gedrueckt++;
      } catch { continue; }
      await page.waitForTimeout(700);

      const nachRufe = Array.from(gesehen.values()).reduce((a, b) => a + b, 0);
      if (jsFehler.length > vorJs) {
        befunde.push({
          rolle, seite, knopf: name, art: "handler",
          detail: jsFehler.slice(vorJs).join(" | ").slice(0, 300),
        });
      } else if (httpFehler.length > vorHttp) {
        const detail = httpFehler.slice(vorHttp).join(" | ").slice(0, 300);
        befunde.push({
          rolle, seite, knopf: name,
          art: istZugangswand(detail) ? "gesperrt" : "http",
          detail: istZugangswand(detail)
            ? `Zugangswand greift (erwartet): ${detail}`
            : detail,
        });
      } else if (nachRufe === vorRufe) {
        // Kein schreibender Ruf — aber hat sich WAS GEZEIGT? Ein Knopf, der
        // einen Dialog oder eine Ebene öffnet, hat gewirkt; er ruft nur noch
        // nichts. Ohne diese Unterscheidung stünden 141 harmlose Reiter in
        // derselben Spalte wie ein toter Knopf.
        const zeigtWas = await page.locator(
          "[role='dialog']:visible, .fi-ebene:visible, [data-ebene]:visible, dialog[open]",
        ).count().catch(() => 0);
        befunde.push({
          rolle, seite, knopf: name, art: zeigtWas > 0 ? "ok" : "stumm",
          detail: zeigtWas > 0
            ? "Kein Serveraufruf, aber eine Ebene/ein Dialog hat sich geöffnet."
            : "Kein Serveraufruf und nichts sichtbar geöffnet. Reiter/Anzeige — oder wirkungslos.",
        });
      } else {
        befunde.push({ rolle, seite, knopf: name, art: "ok", detail: "Ruf ging raus." });
      }

      // Ein geöffneter Dialog verdeckt die nächsten Knöpfe. Escape.
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(200);
    }
  } catch (e) {
    befunde.push({
      rolle, seite, knopf: "—", art: "handler",
      detail: `Seite nicht durchlaufbar: ${(e as Error).message.slice(0, 200)}`,
    });
  } finally {
    page.off("response", aufAntwort);
    page.off("pageerror", aufSeitenfehler);
  }
}

/** Ein Testkonto je Rolle — ausdrücklich markiert, am Ende stillgelegt. */
async function testkonto(rolle: string): Promise<{ id: number; mail: string; pass: string }> {
  const bcrypt = (await import("bcryptjs")).default;
  const mail = `pruef-knopf-${rolle}-${Date.now().toString(36)}@pruefstand.test`;
  const pass = `P-${Math.random().toString(36).slice(2)}`;
  const [a] = (await sqlPool`
    INSERT INTO fiaon_agents (name, email, password_hash, rolle, active, is_test_account,
                              distribution_active, created_at)
    VALUES (${`Knopf-Durchgang ${rolle} (Testkonto)`}, ${mail},
            ${await bcrypt.hash(pass, 10)}, ${rolle}, TRUE, TRUE, FALSE, NOW())
    RETURNING id
  `) as any[];
  return { id: Number(a.id), mail, pass };
}

async function main(): Promise<void> {
  log("\n══ Knopf-Durchgang: jeder Knopf, jede Rolle, keine echten Vorgänge ══\n");
  mkdirSync(BILDER, { recursive: true });

  const browser = await chromium.launch();
  const angelegt: number[] = [];

  // ── DIE VERWALTUNG (Zugangscode, keine Rolle) ─────────────────────────
  {
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const gesehen = new Map<string, number>();
    await attrappen(kontext, gesehen);
    const page = await kontext.newPage();
    await page.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, { data: { code: CODE } }).catch(() => null);
    const seiten = [
      "/admin/dashboard", "/admin/kunden", "/admin/zahlungen", "/admin/events",
      "/admin/aufgaben", "/admin/dubletten", "/admin/team-zentrale", "/admin/einstellungen",
    ];
    for (const s of seiten) {
      log(`  … Verwaltung ${s}`);
      await seiteDurchgehen(page, "verwaltung", s, gesehen);
    }
    await page.screenshot({ path: `${BILDER}/verwaltung.png` }).catch(() => {});
    await kontext.close();
  }

  // ── DIE VIER MITARBEITER-ROLLEN ───────────────────────────────────────
  const rollenSeiten: Record<string, string[]> = {
    agent: ["/agent/start", "/agent/kunden", "/agent/kalender", "/agent/aufgaben", "/agent/profil"],
    vertriebsleiter: ["/agent/start", "/agent/vertrieb", "/agent/kunden", "/agent/kalender"],
    onboarding: ["/agent/start", "/agent/startgespraeche", "/agent/kalender"],
    inkasso: ["/agent/start", "/agent/inkasso", "/agent/kalender"],
  };

  for (const [rolle, seiten] of Object.entries(rollenSeiten)) {
    const konto = await testkonto(rolle);
    angelegt.push(konto.id);
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const gesehen = new Map<string, number>();
    await attrappen(kontext, gesehen);

    // Die zwei Zugangswände als Attrappe. Sie werden NIE echt durchlaufen:
    // Ein Rechtsnachweis, den ein Roboter erzeugt, ist wertlos.
    await kontext.route("**/api/fiaon/agent/onboarding", async (r) => {
      if (r.request().method() !== "GET") return r.fallback();
      await r.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, status: { complete: true, schritte: [] } }),
      });
    });
    for (const pfad of ["**/api/fiaon/inkasso/zugang**", "**/api/fiaon/agent/vertrieb/zusage**",
                        "**/api/fiaon/agent/onboarding/zusage**"]) {
      await kontext.route(pfad, async (r) => {
        if (r.request().method() !== "GET") return r.fallback();
        await r.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({ ok: true, frei: true, zusage: { angenommen: true } }),
        });
      });
    }

    const page = await kontext.newPage();
    const an = await page.request.post(`${BASIS}/api/fiaon/agent/login`, {
      data: { email: konto.mail, password: konto.pass },
    }).catch(() => null);
    if (!an?.ok()) {
      befunde.push({
        rolle, seite: "(Anmeldung)", knopf: "—", art: "http",
        detail: `Anmeldung fehlgeschlagen: ${an?.status()}`,
      });
    } else {
      for (const s of seiten) {
        log(`  … ${rolle} ${s}`);
        await seiteDurchgehen(page, rolle, s, gesehen);
      }
      await page.screenshot({ path: `${BILDER}/${rolle}.png` }).catch(() => {});
    }
    await kontext.close();
  }

  await browser.close();

  // ── DIE TESTKONTEN WERDEN STILLGELEGT ─────────────────────────────────
  // Nicht gelöscht: Ein Zugang, der existiert hat, gehört ins Protokoll.
  // ── DIE EINE FUNKTION FÜR DEN ABSCHLUSS (AGENTS.md, 17.08.2026) ────────
  // Hier stand ein handgeschriebenes UPDATE. Drei Prüfstände hatten drei
  // Fassungen — und keine setzte die Marke is_test_account. Ergebnis: 43
  // Testkonten standen zwischen den sechs echten Menschen in der
  // Team-Zentrale, und der Betreiber musste seine Leute suchen.
  //
  // „testkontoStilllegen“ setzt beides: stillgelegt UND markiert. Ein Konto
  // ohne Marke fällt durch jeden Filter.
  for (const id of angelegt) {
    await testkontoStilllegen(id).catch(() => {});
  }

  // ── DIE BEFUNDLISTE ───────────────────────────────────────────────────
  const kaputt = befunde.filter((b) => b.art === "handler" || b.art === "http");
  const stumm = befunde.filter((b) => b.art === "stumm");
  const gut = befunde.filter((b) => b.art === "ok");
  const gesperrt = befunde.filter((b) => b.art === "gesperrt");

  log(`\n${"═".repeat(72)}`);
  log(`  ${gedrueckt} Knöpfe gedrückt · ${gut.length} mit Wirkung · `
    + `${stumm.length} ohne Wirkung · ${gesperrt.length} durch Zugangswand (erwartet) · `
    + `${kaputt.length} FEHLERHAFT`);
  log(`${"═".repeat(72)}`);

  if (gesperrt.length > 0) {
    log("\n── ZUGANGSWAND GREIFT (kein Fehler) ────────────────────────────");
    log("  `customerDataGate` sperrt JEDE Route unter /agent/, bis das Onboarding");
    log("  des Mitarbeiters abgeschlossen ist. Ein Prüf-Testkonto darf das NICHT");
    log("  echt durchlaufen (Vorfall 06.08.2026) — diese 403 sind also richtig.");
    for (const b of gesperrt.slice(0, 8)) log(`  [${b.rolle}] ${b.seite} · „${b.knopf}“`);
  }

  if (kaputt.length > 0) {
    log("\n── FEHLERHAFT (jeder Fund gehört behoben) ──────────────────────");
    for (const b of kaputt) {
      log(`  [${b.rolle}] ${b.seite} · „${b.knopf}“`);
      log(`      ${b.art.toUpperCase()}: ${b.detail}`);
    }
  }
  if (stumm.length > 0) {
    log("\n── OHNE SERVERAUFRUF (Reiter/Anzeige — oder wirkungslos) ────────");
    const jeSeite = new Map<string, string[]>();
    for (const b of stumm) {
      const k = `${b.rolle} ${b.seite}`;
      if (!jeSeite.has(k)) jeSeite.set(k, []);
      jeSeite.get(k)!.push(b.knopf);
    }
    for (const [k, v] of Array.from(jeSeite.entries())) {
      log(`  ${k}: ${v.slice(0, 12).join(", ")}${v.length > 12 ? ` … (+${v.length - 12})` : ""}`);
    }
  }

  mkdirSync("reports", { recursive: true });
  const kopf = "rolle;seite;knopf;art;detail";
  const zeilen = befunde.map((b) => [b.rolle, b.seite, b.knopf, b.art, b.detail]
    .map((v) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
    .join(";"));
  writeFileSync("reports/knopf-durchgang.csv", `${[kopf, ...zeilen].join("\n")}\n`, "utf8");
  log(`\n  CSV: reports/knopf-durchgang.csv`);
  log(`  Bilder: ${BILDER}/\n`);

  await sqlPool.end();
  process.exit(kaputt.length > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
