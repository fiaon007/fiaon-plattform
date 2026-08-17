// ═══════════════════════════════════════════════════════════════════════════
// RENDER-PROBE: DIE GATE-BÜHNE UND DIE AKTE
//
// ── WAS BEWIESEN WERDEN MUSS ───────────────────────────────────────────────
//   1  Die Gate-Bühne zeigt BEIDE Karten gleichzeitig (Desktop + 380 px)
//   2  Die Fortschrittsleiste nennt vier Stationen, Zahlung erledigt
//   3  Kein „Später" — buchen oder abmelden
//   4  Das Portal zeigt NICHT mehr „Aktiv · Freigeschaltet" ohne Gespräch
//   5  Die Akte trägt die Ablauf-Leiste und den nächsten Schritt
//
// ── KEIN ECHTER VORGANG ────────────────────────────────────────────────────
// Das Portal wird über die Als-Kunde-Ansicht geöffnet: Nur-Lesen, jede
// schreibende Route lehnt ab. Kein Termin wird gebucht, keine Auskunft
// bestellt — die Screenshots enden VOR dem letzten Klick (AGENTS.md).
//
//   npx tsx scripts/pruef-ablauf-browser.ts      (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium, type BrowserContext } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS ?? "http://localhost:5188";
const BILDER = "reports/ablauf";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

/** Ein Browser-Zusammenhang mit Kundensicht UND Verwaltungszugang. */
async function mitAnsicht(browser: any, personId: number, ref: string, breite: number): Promise<BrowserContext> {
  const { kundenansichtTokenBauen, KUNDENANSICHT_COOKIE } =
    await import("../server/lib/fiaon-kundenansicht");
  const { createHmac } = await import("node:crypto");
  const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  const code = String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
  const fp = createHmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
  const exp = Date.now() + 3600_000;
  const sig = createHmac("sha256", geheim).update(`adminzugang:${exp}:${fp}`).digest("hex").slice(0, 40);

  const kontext = await browser.newContext({ viewport: { width: breite, height: 1100 } });
  await kontext.addCookies([
    {
      name: KUNDENANSICHT_COOKIE, value: kundenansichtTokenBauen(personId, ref, "admin", 0),
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    },
    {
      name: "fiaon_admin", value: `${exp}.${sig}`,
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    },
  ]);
  return kontext;
}

async function main(): Promise<void> {
  mkdirSync(BILDER, { recursive: true });

  // ── DEN PRÜFFALL WÄHLEN ─────────────────────────────────────────────────
  // Ein wartender Kunde: bezahlt, kein erledigtes Startgespräch. Nach der
  // Migration sind das 364 — der Normalfall, nicht ein Sonderfall.
  const [kunde] = (await sqlPool`
    SELECT a.ref, a.person_id, a.onboarding_stufe,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.email) AS name
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.onboarding_stufe = 'wartet_auf_onboarding'
      -- Der ungünstigste Fall: noch keine Auskunft gekauft, also stehen BEIDE
      -- Karten mit offener Aufgabe da.
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications s
        WHERE (s.type = 'schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
          AND s.payment_status = 'paid' AND s.person_id = a.person_id)
    ORDER BY a.completed_at DESC NULLS LAST LIMIT 1
  `) as any[];
  if (!kunde) { console.log("  Kein wartender Kunde gefunden."); process.exit(1); }
  console.log(`  Prüffall: „${kunde.name}" (${kunde.ref}, Stufe ${kunde.onboarding_stufe})`);

  const browser = await chromium.launch();

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE GATE-BÜHNE — beide Karten (Desktop)");
  // ═════════════════════════════════════════════════════════════════════════
  for (const [name, breite] of [["desktop", 1280], ["schmal", 380]] as [string, number][]) {
    const kontext = await mitAnsicht(browser, Number(kunde.person_id), String(kunde.ref), breite);
    const seite = await kontext.newPage();
    await seite.goto(`${BASIS}/als-kunde`, { waitUntil: "domcontentloaded" });

    // ERST WARTEN, DANN MESSEN (AGENTS.md): auf die Marke der Bühne.
    const da = await seite.getByText(/willkommen bei fiaon|dein start/i).first()
      .waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    if (!da) {
      pruef(`Gate erscheint (${name})`, false,
        (await seite.locator("body").innerText().catch(() => "")).slice(0, 200));
      await seite.screenshot({ path: `${BILDER}/gate-${name}-FEHLSCHLAG.png`, fullPage: true });
      await kontext.close();
      continue;
    }
    pruef(`Gate erscheint (${name})`, true);

    // ══════════════════════════════════════════════════════════════════
    // NUR IN DER BÜHNE MESSEN, NICHT IM GANZEN BILD
    //
    // ── DER FALSCH-GRÜNE TEST (20.08.2026) ──────────────────────────
    // Die Prüfung „Karte Bonitätsauskunft da" las den `innerText` des ganzen
    // Body — und wurde GRÜN durch einen Satz, der im DASHBOARD HINTER der
    // Bühne steht („Wir beschaffen deine vollständige Bonitätsauskunft …").
    // Meine Karte in der Bühne war zu diesem Zeitpunkt noch nicht da.
    //
    // Aufgefallen ist es erst, als die 74-€-Prüfung rot blieb und ihre
    // Fehlermeldung den gefundenen Text ausgab. Eine Prüfung, die nur „rot"
    // sagt, hätte mich auf die falsche Suche geschickt.
    //
    // ── DIE LEHRE ───────────────────────────────────────────────────
    // Wer eine Tafel im Vordergrund prüft, misst IN der Tafel. Der Body
    // enthält alles, auch das Verdeckte.
    // ══════════════════════════════════════════════════════════════════
    const buehne = seite.locator('[role="dialog"][aria-labelledby="start-titel"]');

    // ── ERST WARTEN, DANN MESSEN — UND ZWAR AUF DIE ZWEITE KARTE ────────
    // Ein `waitForTimeout(1200)` war zu kurz: Die Bonitätskarte holt ihren
    // Stand über eine eigene Abfrage (`/bonitaet-status/...`) und erscheint
    // danach. Der Screenshot zeigte eine leere rechte Spalte, und die Prüfung
    // „die 74 € stehen dabei" wurde rot — obwohl die Karte im HTML längst da
    // war, nur eine Sekunde später.
    //
    // Also: auf ihre Marke warten. Bleibt sie aus, ist DAS der Fehlschlag.
    const karteDa = await buehne.getByText(/grundstein/i).first()
      .waitFor({ state: "visible", timeout: 20_000 }).then(() => true).catch(() => false);
    pruef(`${name}: die zweite Karte erscheint`, karteDa,
      "eine Karte, die still verschwindet, ist ein Angebot, das niemand sieht");
    // Und die Slots brauchen ihren eigenen Moment.
    await buehne.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first()
      .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

    // Nur die Bühne, nicht der Body: siehe die Begründung oben.
    const t = (await buehne.innerText().catch(() => "")).toLowerCase();

    // ── BEIDE KARTEN ──────────────────────────────────────────────────────
    pruef(`${name}: Karte „Startgespräch“ da`,
      /startgespräch|wann passt es|uhrzeit/.test(t));
    pruef(`${name}: Karte „Bonitätsauskunft“ da`,
      /bonitätsauskunft|grundstein/.test(t),
      "beide Karten sollen GLEICHZEITIG stehen");
    // Der Preis — mit Ausgabe des echten Textes, falls er fehlt. Eine
    // Prüfung, die nur „rot" sagt, schickt einen auf die Suche.
    const preisZeile = (t.match(/[^\n]*bonitätsauskunft[^\n]*/) ?? [""])[0];
    pruef(`${name}: die 74 € stehen dabei`, /74\s*€/.test(t),
      `Zeile: „${preisZeile.trim()}"`);

    // ── DIE FORTSCHRITTSLEISTE ───────────────────────────────────────────
    for (const station of ["zahlung", "startgespräch", "auskunft", "freischaltung"]) {
      pruef(`${name}: Fortschritt nennt „${station}“`, t.includes(station));
    }
    pruef(`${name}: die Auskunft ist als freiwillig gekennzeichnet`,
      /freiwillig/.test(t),
      "sonst glaubt der Kunde, er müsse 74 € zahlen, um sein Konto zu öffnen");

    // ── KEIN „SPÄTER" ────────────────────────────────────────────────────
    const spaeter = await buehne.getByRole("button", { name: /später|überspringen/i }).count();
    pruef(`${name}: kein „Später“-Knopf`, spaeter === 0,
      `${spaeter} gefunden — die Pflicht wäre eine Bitte`);
    pruef(`${name}: Abmelden bleibt möglich`,
      (await buehne.getByRole("button", { name: /abmelden/i }).count()) > 0,
      "eine Tafel, aus der man nicht herauskommt, ist eine Falle");

    // ── SLOTS: höchstens fünf je Tag ─────────────────────────────────────
    const zeiten = (await buehne.locator("button").allInnerTexts().catch(() => []))
      .filter((k) => /^\d{2}:\d{2}$/.test(k.trim()));
    pruef(`${name}: Zeiten werden angeboten`, zeiten.length > 0,
      "ein Pflicht-Gate ohne Termine ist eine verschlossene Tür");
    if (zeiten.length > 0) {
      pruef(`${name}: höchstens fünf je Tag`, zeiten.length % 5 === 0 && zeiten.length <= 15,
        `${zeiten.length} Zeit-Knöpfe`);
    }

    await seite.screenshot({ path: `${BILDER}/gate-${name}.png`, fullPage: true });
    console.log(`        ${BILDER}/gate-${name}.png`);
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DAS PORTAL — steht dort noch „Aktiv · Freigeschaltet“?");
  // ═════════════════════════════════════════════════════════════════════════
  // Das war der Screenshot-Fehler: Ein Kunde ohne Startgespräch sah „Aktiv ·
  // Freigeschaltet". Die Status-Kachel liest jetzt die Ableitung.
  //
  // Um sie zu SEHEN, muss die Gate-Tafel geschlossen sein — sie liegt darüber.
  // Deshalb: Tafel wegklicken geht nicht (kein „Später"), also wird der
  // Zustand über die Route geprüft, die die Kachel füllt. Das ist keine
  // Ausrede: Die Kachel liest genau diesen Wert, und der Prüfstand
  // `pruef-ablauf.ts` belegt die Verdrahtung im Quelltext.
  {
    const kontext = await mitAnsicht(browser, Number(kunde.person_id), String(kunde.ref), 1280);
    const seite = await kontext.newPage();
    const antwort = await seite.request.get(
      `${BASIS}/api/fiaon/kunde/${encodeURIComponent(String(kunde.ref))}/startgespraech`,
    ).then((r) => r.json()).catch(() => null);
    pruef("Die Route liefert die abgeleitete Stufe", antwort?.stufe === "wartet_auf_onboarding",
      `stufe=${antwort?.stufe}`);
    pruef("Sie liefert NICHT „voll aktiv“", antwort?.vollAktiv === false,
      "genau das stand im Screenshot");
    pruef("Sie nennt den nächsten Schritt", typeof antwort?.naechsterSchritt === "string"
      && antwort.naechsterSchritt.length > 10, String(antwort?.naechsterSchritt));
    pruef("Sie liefert den Ablauf-Stand", antwort?.ablauf?.zahlung === true
      && antwort?.ablauf?.startgespraech === false);
    console.log(`        Stufe: ${antwort?.stufe} · „${antwort?.naechsterSchritt}"`);
    await kontext.close();
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE AKTE — Ablauf-Leiste im Kopf");
  // ═════════════════════════════════════════════════════════════════════════
  {
    // ── OHNE KUNDENSICHT-COOKIE ─────────────────────────────────────────
    // Der erste Entwurf benutzte denselben Zusammenhang wie das Portal — mit
    // Kundensicht-Banner oben. Der trägt den Namen des Kunden, und das
    // `waitFor` auf den Namen griff DORT: gemessen wurde eine Akte, die noch
    // „Akte lädt …" zeigte. Der Screenshot bewies es.
    //
    // Hier nur der Verwaltungszugang, und gewartet wird auf eine Marke, die
    // ausschließlich die fertige Akte hat.
    const { createHmac } = await import("node:crypto");
    const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
    const code = String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
    const fp = createHmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
    const exp = Date.now() + 3600_000;
    const sig = createHmac("sha256", geheim).update(`adminzugang:${exp}:${fp}`).digest("hex").slice(0, 40);
    const kontext = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    await kontext.addCookies([{
      name: "fiaon_admin", value: `${exp}.${sig}`,
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    }]);
    const seite = await kontext.newPage();
    await seite.goto(`${BASIS}/admin/kunde/${encodeURIComponent(String(kunde.ref))}`,
      { waitUntil: "domcontentloaded" });
    // Auf „Nächster Schritt" warten — das steht NUR in der fertigen Akte.
    const da = await seite.getByText(/nächster schritt/i).first()
      .waitFor({ state: "visible", timeout: 30_000 }).then(() => true).catch(() => false);
    pruef("Die Akte lädt", da,
      (await seite.locator("body").innerText().catch(() => "")).slice(0, 200));
    if (da) {
      await seite.waitForTimeout(800);
      const t = (await seite.locator("body").innerText().catch(() => "")).toLowerCase();
      pruef("Die Akte zeigt die Ablauf-Leiste",
        /antrag/.test(t) && /zahlung/.test(t) && /startgespräch/.test(t),
        "jeder soll in einer Sekunde sehen, wo der Kunde steht");
      pruef("Sie nennt den nächsten Schritt", /nächster schritt/.test(t));
      pruef("Sie zeigt die Stufe „wartet auf startgespräch“",
        /wartet auf startgespräch/.test(t),
        "und NICHT „Aktiv“ — das war der Fehler");
      await seite.screenshot({ path: `${BILDER}/akte.png`, fullPage: true });
      console.log(`        ${BILDER}/akte.png`);
    }
    await kontext.close();
  }

  await browser.close();
  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`  Screenshots: ${BILDER}/`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
