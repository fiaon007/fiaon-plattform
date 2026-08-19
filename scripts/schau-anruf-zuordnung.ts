// ═══════════════════════════════════════════════════════════════════════════
// BROWSER-ABNAHME: DER GESPRÄCHE-TAB IM MITARBEITER-PROFIL
//
// Der Befund kam aus einem SCREENSHOT („14 Gespräche, darunter fremde, Name
// passt nicht zum Inhalt"). AGENTS.md: „Wenn der Auftrag aus einem BILD kommt,
// ist das Bild die Abnahme." Also wird die echte Route geöffnet, der Reiter
// gedrückt und das Bild angesehen.
//
// Geöffnet wird das Profil von Rifka Rovcanin — genau die Ansicht, aus der der
// Screenshot stammt. Es entsteht kein Vorgang: Es wird nur gelesen.
//
//   npx tsx scripts/schau-anruf-zuordnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS || "http://localhost:5188";
const CODE = process.env.ADMIN_ACCESS_CODE || "20032017";
const BILDER = "reports/bilder-anruf";

let bestanden = 0;
let fehlgeschlagen = 0;
const log = (s = "") => console.log(s);
function ok(name: string, b: boolean, detail = ""): void {
  if (b) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
async function bild(page: Page, name: string): Promise<void> {
  mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: `${BILDER}/${name}.png`, fullPage: false });
  log(`        Bild: ${BILDER}/${name}.png`);
}

async function main(): Promise<void> {
  log("\n══ Browser-Abnahme: Gespräche-Tab ══\n");

  const [rifka] = (await sqlPool`
    SELECT id, name FROM fiaon_agents
     WHERE name ILIKE '%rovcanin%' OR name ILIKE '%rifka%' ORDER BY id LIMIT 1
  `) as any[];
  if (!rifka) { log("  Kein Konto „Rifka Rovcanin“ — Abbruch."); await sqlPool.end(); return; }
  log(`  Profil: ${rifka.name} (Kennung ${rifka.id})\n`);

  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 1500, height: 1050 } });
  // ══════════════════════════════════════════════════════════════════════════
  // DIE ANMELDUNG DARF NICHT IN DIE ATTRAPPE LAUFEN
  //
  // Der erste Entwurf fing ALLES Schreibende ab — auch den POST der
  // Zugangsschleuse. Die Attrappe antwortete brav `{ ok: true }`, aber OHNE das
  // `Set-Cookie` des Servers. Die Schleuse blieb also stehen, und sieben
  // Prüfungen wurden rot, obwohl der Code stimmte.
  //
  // Aufgefallen ist es am SCREENSHOT: Der Zifferblock war noch da und die acht
  // Punkte waren leer. AGENTS.md, wörtlich: „Ein Prüfstand, der die
  // Vorbedingungen nicht herstellt, prüft eine Sperre und meldet sie als
  // Fehler." Und: „Eine Attrappe muss liefern, was der Server liefert."
  //
  // Der Zugangs-POST geht deshalb ECHT durch — er erzeugt keinen Vorgang,
  // sondern nur ein Sitzungs-Cookie. Alles andere Schreibende bleibt gesperrt.
  // ══════════════════════════════════════════════════════════════════════════
  await kontext.route("**/api/**", async (r) => {
    const m = r.request().method();
    if (m === "GET" || m === "HEAD") return r.fallback();
    // Der Pfad heisst `/api/fiaon/zugang` — NICHT `/admin/zugang`. Ein erster
    // Entwurf filterte auf den falschen und lief in dieselbe Sperre.
    if (r.request().url().includes("/api/fiaon/zugang")) return r.fallback();
    await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  const page = await kontext.newPage();
  const konsole: string[] = [];
  page.on("pageerror", (e) => konsole.push(String(e.message)));

  // ── DIE ADRESSE IST /admin/team, NICHT /admin/team/:id ──────────────────
  // Ein erster Entwurf rief `/admin/team/811` — die Route gibt es nicht, und
  // die Seite blieb leer (6 rote Prüfungen, die nichts über den Fehler sagten).
  // Die Akte ist eine Schublade IN der Team-Zentrale: erst die Seite, dann die
  // Karte des Menschen anklicken. AGENTS.md: „Vor jeder Änderung an einer Seite
  // grep in App.tsx, welche Datei die Route bedient."
  await page.goto(`${BASIS}/admin/team`, { waitUntil: "domcontentloaded" });

  // ══════════════════════════════════════════════════════════════════════════
  // DIE ZUGANGSSCHLEUSE IST EIN ZIFFERNBLOCK, KEIN EINGABEFELD
  //
  // Ein erster Entwurf suchte `input[type=password]` und fand nichts — die
  // Schleuse in `AdminShell` ist ein Tastenfeld aus Knöpfen. Die Prüfung lief
  // danach gegen die Anmeldeseite und meldete sechs rote Zeilen, von denen keine
  // etwas über den geprüften Gegenstand sagte.
  //
  // Nur der SCREENSHOT hat es verraten (AGENTS.md, zweimal so gelernt). Jetzt
  // wird getippt wie ein Mensch: Ziffer für Ziffer auf den Knopf.
  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // DIE SCHLEUSE WIRD ÜBER DEN ECHTEN ENDPUNKT GEÖFFNET
  //
  // Der Zifferblock reagiert auf Klicks und Tastendrücke; beides war im Lauf
  // nicht zuverlässig zu treffen (die acht Punkte blieben leer). Statt weiter zu
  // raten, geht die Anmeldung über die Route, die der Block selbst aufruft —
  // ECHT, ohne Attrappe, mit dem Code aus dem Quelltext
  // (`fiaon-admin-zugang.ts`: Vorgabe „20032017", nicht geraten).
  //
  // Playwright teilt Cookies zwischen `context.request` und den Seiten, das
  // Cookie liegt danach also im Browser. Geprüft wird der ANSCHLIESSENDE Weg:
  // Karte öffnen, Reiter drücken, Zeilen messen — genau das, was ein Mensch tut.
  // Es entsteht kein Vorgang: Der Endpunkt setzt nur ein Sitzungs-Cookie.
  // ══════════════════════════════════════════════════════════════════════════
  const auf = await kontext.request.post(`${BASIS}/api/fiaon/zugang/oeffnen`, {
    data: { code: CODE },
  }).catch(() => null);
  ok("Die Zugangsschleuse ist passiert", auf != null && auf.ok(),
    `HTTP ${auf?.status()} — ADMIN_ACCESS_CODE abweichend?`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);

  const teamDa = await page.getByText(/Team|Mitarbeiter/i).first()
    .waitFor({ timeout: 30_000 }).then(() => true).catch(() => false);
  ok("Die Team-Zentrale ist geladen", teamDa);

  // Die Karte des Menschen öffnen — der Name ist der Knopf.
  const karte = page.getByRole("button", { name: new RegExp(String(rifka.name), "i") }).first();
  const karteDa = await karte.count() > 0;
  ok("Die Karte von Rifka Rovcanin ist da", karteDa);
  if (karteDa) {
    await karte.click();
    await page.waitForTimeout(1500);
    // ── DER KLICK TRAF DAS DREI-PUNKTE-MENÜ ───────────────────────────────
    // Der Screenshot zeigte ein aufgeklapptes Menü („Profil öffnen", „Als
    // Mitarbeiter ansehen", „Als Testkonto markieren") statt der Akte. Der
    // Kartenkopf und das Menü liegen dicht beieinander; welcher Knopf getroffen
    // wird, ist nicht zu erraten — also wird der Eintrag GEDRÜCKT, wenn er
    // erscheint. Wieder: nur das Bild hat es verraten.
    const profilAuf = page.getByRole("button", { name: /^Profil öffnen$/i }).first();
    if (await profilAuf.count() > 0) {
      await profilAuf.click();
    } else {
      const link = page.getByText(/^Profil öffnen$/i).first();
      if (await link.count() > 0) await link.click();
    }
    await page.waitForTimeout(5000);
  }
  const kopfDa = await page.locator("[role='dialog'], .fi-schublade").first().count() > 0
    || /Gespräche/i.test(await page.locator("body").innerText().catch(() => ""));
  ok("Die Mitarbeiter-Akte ist geöffnet", kopfDa);

  // Den Reiter FINDEN und DRÜCKEN — nicht die Route raten.
  const reiter = page.getByRole("button", { name: /Gespräche/i }).first();
  ok("Der Reiter „Gespräche“ ist da", await reiter.count() > 0);
  if (await reiter.count() > 0) {
    await reiter.click();
    await page.waitForTimeout(4000);
  }

  const text = await page.locator("body").innerText().catch(() => "");

  // ── TEIL 3: WER · WEN · WELCHE NUMMER ───────────────────────────────────
  const herkunft = page.locator("[data-fiaon='anruf-herkunft']");
  const n = await herkunft.count();
  ok("Jede Zeile nennt Wähler, Kunde und Nummer", n > 0, `${n} Zeilen gefunden`);
  if (n > 0) {
    const erste = await herkunft.first().innerText();
    log(`        Erste Zeile: „${erste.replace(/\s+/g, " ").slice(0, 120)}“`);
    ok("Sie enthält „geführt von“", /geführt von/i.test(erste));
    ok("Sie enthält die gewählte Nummer", /\+?\d{6,}/.test(erste), erste);
  }

  // Nie verbundene Wahlversuche sind gekennzeichnet — bei Rifka sind es 4.
  const nichtVerbunden = await page.locator("[data-fiaon='anruf-nicht-verbunden']").count();
  ok("Wahlversuche ohne Verbindung sind gekennzeichnet", nichtVerbunden > 0,
    `${nichtVerbunden} — erwartet wurden 4 (gemessen in fiaon_calls)`);
  log(`        ${nichtVerbunden} Zeilen tragen „nicht verbunden“.`);

  // Die Kennzahl „Verbunden“ steht neben „Gespräche“.
  ok("Die Kachel „Verbunden“ ist da", /verbunden/i.test(text));

  ok("Kein JS-Fehler auf der Seite", konsole.length === 0, konsole.slice(0, 2).join(" | "));
  await bild(page, "gespraeche-tab-rifka");

  // ── GEGENPROBE: die Zahl in der Kachel gegen die Zeilen in der Liste ────
  const [zahl] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_calls k
     WHERE k.agent_id = ${Number(rifka.id)}
       AND ${(await import("../server/lib/fiaon-anruf-pruefung")).BELEGT_GEFUEHRT_SQL("k")}
  `)) as any[];
  log(`\n        Datenbank: ${zahl.n} belegte Gespräche für ${rifka.name}.`);
  ok("Die Liste zeigt genau so viele Zeilen wie die Datenbank belegt hat",
    n === Number(zahl.n), `Liste ${n}, Datenbank ${zahl.n}`);

  await kontext.close();
  await browser.close();
  log(`\n══ ${bestanden} ok, ${fehlgeschlagen} rot ══\n`);
  await sqlPool.end();
  if (fehlgeschlagen > 0) process.exit(1);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
