// ═══════════════════════════════════════════════════════════════════════════
// RENDER-PROBE: sieht der Kunde jetzt seinen Namen und sein Paket richtig?
//
// ── WARUM DAS DIE EIGENTLICHE ABNAHME IST ──────────────────────────────────
// Der Prüfstand `pruef-datenkosmetik.ts` zählt Spalten. Aber der Auftrag kam
// aus einem BILD: „Guten Abend, Vitor Manuel ." mit hängendem Punkt und eine
// Paket-Kachel, in der nur „Maximum)" stand. Erledigt ist es erst, wenn genau
// dieses Bild anders aussieht.
//
// Der Prüffall ist deshalb DERSELBE KUNDE wie im Screenshot vom 19.08.2026 —
// nicht ein beliebiger, dem der Fehler nie passiert wäre.
//
// ── KEIN ECHTER VORGANG ────────────────────────────────────────────────────
// Das Portal wird über die Als-Kunde-Ansicht geöffnet: Nur-Lesen, jede
// schreibende Route lehnt ab. Es entsteht nichts außer einem
// Protokolleintrag „Ansicht gestartet" — der gehört dorthin.
//
//   npx tsx scripts/pruef-datenkosmetik-browser.ts     (Server auf 5188)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.PRUEF_BASIS ?? "http://localhost:5188";
const BILDER = "reports/datenkosmetik";

let ok = 0;
let rot = 0;
const fehler: string[] = [];

function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }

async function main(): Promise<void> {
  mkdirSync(BILDER, { recursive: true });

  // ── DEN PRÜFFALL AUS DEM SCREENSHOT WÄHLEN ──────────────────────────────
  // „Vitor Manuel Pereira Rieger" hatte BEIDE Fehler: Leerraum im Vornamen
  // und den Umbruch im Paketnamen. Ein Kunde, den es nicht traf, würde nichts
  // beweisen (AGENTS.md: der ungünstigste Fall, nicht der erstbeste).
  const [kunde] = (await sqlPool`
    SELECT a.ref, a.person_id, a.first_name, a.last_name, a.pack_name
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND a.first_name LIKE 'Vitor%'
    LIMIT 1
  `) as any[];
  if (!kunde) {
    // Rückfall: irgendein bezahlter Kunde mit Paket — die Prüfung gilt
    // trotzdem, nur der Bezug zum Screenshot fehlt.
    console.log("  (Der Kunde aus dem Screenshot ist nicht auffindbar — Rückfall.)");
  }
  const [prueffall] = kunde ? [kunde] : ((await sqlPool`
    SELECT a.ref, a.person_id, a.first_name, a.last_name, a.pack_name
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.person_id IS NOT NULL
      AND a.payment_status = 'paid' AND a.pack_name IS NOT NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY a.paid_at DESC NULLS LAST LIMIT 1
  `) as any[]);
  if (!prueffall) { console.log("  Kein Prüffall gefunden."); process.exit(1); }

  console.log(`  Prüffall: ${JSON.stringify(prueffall.first_name)} ${JSON.stringify(prueffall.last_name)}`);
  console.log(`            Paket: ${JSON.stringify(prueffall.pack_name)}`);

  // ── DIE DATEN SELBST ────────────────────────────────────────────────────
  pruef("Der Vorname trägt keinen Leerraum am Rand",
    String(prueffall.first_name ?? "") === String(prueffall.first_name ?? "").trim());
  pruef("Der Paketname ist einzeilig",
    !/[\r\n\t]/.test(String(prueffall.pack_name ?? "")));

  const browser = await chromium.launch();
  const { kundenansichtTokenBauen, KUNDENANSICHT_COOKIE } =
    await import("../server/lib/fiaon-kundenansicht");
  const { createHmac } = await import("node:crypto");
  const geheim = process.env.SESSION_SECRET || "fiaon-dev-admin-zugang-secret";
  const code = String(process.env.ADMIN_ACCESS_CODE || "20032017").trim();
  const fp = createHmac("sha256", geheim).update(`admincode:${code}`).digest("hex").slice(0, 16);
  const exp = Date.now() + 3600_000;
  const sig = createHmac("sha256", geheim).update(`adminzugang:${exp}:${fp}`).digest("hex").slice(0, 40);

  const kontext = await browser.newContext({ viewport: { width: 380, height: 1000 } });
  await kontext.addCookies([
    {
      name: KUNDENANSICHT_COOKIE,
      value: kundenansichtTokenBauen(Number(prueffall.person_id), String(prueffall.ref), "admin", 0),
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    },
    {
      name: "fiaon_admin", value: `${exp}.${sig}`,
      domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax",
    },
  ]);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DAS PORTAL — Begrüßung und Paket-Kachel");
  // ═════════════════════════════════════════════════════════════════════════
  const seite = await kontext.newPage();
  await seite.goto(`${BASIS}/als-kunde`, { waitUntil: "domcontentloaded" });

  // ERST WARTEN, DANN MESSEN (AGENTS.md): auf die Marke, nicht auf eine Zeit.
  const da = await seite.getByText(/du siehst das portal als/i).first()
    .waitFor({ state: "visible", timeout: 25_000 }).then(() => true).catch(() => false);
  pruef("Das Portal ist offen (Nur-Ansicht)", da,
    "ohne offenes Portal ist nichts zu messen");
  if (!da) {
    await seite.screenshot({ path: `${BILDER}/fehlschlag.png`, fullPage: true });
    console.log((await seite.locator("body").innerText().catch(() => "")).slice(0, 300));
  } else {
    // Die Begrüßung laden lassen — sie kommt aus einer eigenen Abfrage.
    await seite.getByText(/guten (morgen|tag|abend)/i).first()
      .waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    const roh = await seite.locator("body").innerText().catch(() => "");

    // ── DER HÄNGENDE PUNKT ────────────────────────────────────────────────
    // Genau das Bild aus dem Screenshot: „Guten Abend, Vitor Manuel ."
    const haengend = / \.\s/.test(roh) || / \.$/m.test(roh);
    pruef("Kein hängender Punkt in der Begrüßung", !haengend,
      `gefunden in: ${(roh.match(/.{0,40} \..{0,10}/) ?? [""])[0]}`);

    const grussZeile = (roh.match(/Guten (?:Morgen|Tag|Abend)[^\n]*/i) ?? [""])[0];
    console.log(`        Begrüßung: ${JSON.stringify(grussZeile)}`);
    pruef("Die Begrüßung nennt den Namen ohne Leerraum davor",
      !/,\s{2,}/.test(grussZeile) && !/ ,/.test(grussZeile));

    // ══════════════════════════════════════════════════════════════════
    // DIE PAKET-KACHEL — die Prüfung, die ich beim ersten Mal verpatzt habe
    //
    // ── WAS PASSIERT IST ─────────────────────────────────────────────
    // Der erste Entwurf prüfte mit einem weichen Regex und wurde GRÜN. Der
    // Screenshot zeigte danach „Maximum)" in der Kachel — der Fehler war
    // noch da. Ursache war nicht der Umbruch, sondern
    // `user.packName?.split(" ").pop()` im Dashboard: das letzte Wort samt
    // schließender Klammer.
    //
    // ── DIE LEHRE FÜR DIESE PRÜFUNG ──────────────────────────────────
    // Nicht „irgendwo ein verdächtiges Muster", sondern: Kommt eine
    // KLAMMER-WAISE im Text vor — ein „)" ohne zugehöriges „("? Das ist
    // eindeutig, und es trifft genau den Fall.
    // ══════════════════════════════════════════════════════════════════
    // ── DER VISUELLE UMBRUCH IST KEIN DATENFEHLER ────────────────────
    // Zweiter Anlauf: Die erste Fassung dieser Prüfung wurde rot mit „Das
    // Maximum)". Nachgesehen — im Bild stand vollständig „FIAON High End (Das
    // Maximum)", nur über ZWEI ZEILEN umgebrochen, weil die Kachel schmal ist.
    // `innerText` liefert diesen CSS-Umbruch als echten Zeilenumbruch, und der
    // Regex sah eine Waise, wo keine war.
    //
    // Also: Zeilen zusammenfügen, DANN Klammern zählen. Eine echte Waise
    // überlebt das Zusammenfügen — ein Umbruch nicht.
    const eineZeile = roh.replace(/\s*\n\s*/g, " ");
    // ── DRITTER ANLAUF: PAARWEISE ZÄHLEN, NICHT MIT REGEX SUCHEN ─────
    // Der zweite Entwurf benutzte `/(^|[^(]{0,30})\)/` und blieb rot: Er
    // blickt dreißig Zeichen zurück, und die öffnende Klammer von „(Das
    // Maximum)" stand weiter weg. Ein Regex kann Klammerpaare nicht zählen —
    // dafür braucht es einen Durchlauf mit Zähler. Das ist die einfache,
    // richtige Lösung, und sie hätte von Anfang an dort stehen sollen.
    let tiefe = 0;
    const waisen: string[] = [];
    for (let i = 0; i < eineZeile.length; i++) {
      const c = eineZeile[i];
      if (c === "(") tiefe++;
      else if (c === ")") {
        if (tiefe === 0) waisen.push(eineZeile.slice(Math.max(0, i - 24), i + 1).trim());
        else tiefe--;
      }
    }
    pruef("Keine Klammer-Waise im Portal", waisen.length === 0,
      `${waisen.slice(0, 3).map((w) => JSON.stringify(w)).join(", ")} `
      + "— ein „)“ ohne öffnende heißt: hier wurde ein Name abgeschnitten");

    // Und die Kachel muss eine sinnvolle Kurzform zeigen.
    const { paketKurz } = await import("../shared/fiaon-paketname");
    const erwartet = paketKurz(prueffall.pack_name);
    pruef("Die Paket-Kachel zeigt die richtige Kurzform",
      !!erwartet && roh.includes(erwartet),
      `erwartet „${erwartet}“ — im Portal nicht gefunden`);
    console.log(`        Kachel-Kurzform: ${JSON.stringify(erwartet)}`);

    // Und der Paketname muss VOLLSTÄNDIG dastehen.
    const teil = String(prueffall.pack_name ?? "").split(" (")[0];
    pruef("Der Paketname steht vollständig im Portal",
      teil.length > 0 && roh.toLowerCase().includes(teil.toLowerCase()),
      `„${teil}“ nicht gefunden`);

    await seite.screenshot({ path: `${BILDER}/portal-380.png`, fullPage: true });
    console.log(`        ${BILDER}/portal-380.png`);
  }
  await seite.close();

  // ═════════════════════════════════════════════════════════════════════════
  titel("DER ANTRAG — bleibt die Karte zweizeilig?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Sorge beim Trennen von Name und Beisatz: Die Verkaufskarte könnte
  // einzeilig werden und damit anders aussehen als vorher. Also nachsehen.
  const antrag = await browser.newPage({ viewport: { width: 380, height: 1100 } });
  await antrag.goto(`${BASIS}/antrag`, { waitUntil: "domcontentloaded" });
  await antrag.waitForTimeout(2500);
  const at = (await antrag.locator("body").innerText().catch(() => "")).toLowerCase();
  pruef("Die Antragsseite lädt", at.length > 50, at.slice(0, 120));
  if (at.includes("fiaon")) {
    pruef("Der Paketname steht da", /fiaon (starter|pro|ultra|high end)/.test(at));
    pruef("Der Beisatz steht da", /\((das fundament|standard|elite konto|das maximum)\)/.test(at),
      "die Karte soll beides zeigen — nur nicht in EINEM Datenfeld");
  }
  await antrag.screenshot({ path: `${BILDER}/antrag-380.png`, fullPage: true });
  console.log(`        ${BILDER}/antrag-380.png`);
  await antrag.close();

  await kontext.close();
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
