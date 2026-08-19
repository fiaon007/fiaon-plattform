// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ANRUFGRENZE WARNT, SIE SPERRT NICHT
//
// ── WARUM ES DIESEN LAUF GIBT (19.08.2026) ─────────────────────────────────
// Die Tagesgrenze je Absendernummer hat 26 Anrufe des Vertriebs verhindert. Sie
// ist auf Warnung umgebaut. Diese Prüfung hält den Zustand fest — sonst baut sie
// jemand beim nächsten Spam-Verdacht wieder als Wand ein, und das mit den besten
// Absichten.
//
// ── DIE DAUERHAFTE REGEL, DIE HIER GEPRÜFT WIRD ───────────────────────────
// KEIN Mechanismus außer fehlender Berechtigung, fehlender Richtlinien-Zusage
// und fehlender/unwählbarer Nummer darf einen Anruf verhindern (AGENTS.md).
//
// Geprüft wird in drei Richtungen, weil eine allein zu wenig beweist:
//   1. VERHALTEN: Bei überschrittener Schwelle liefert `nummerKontingent` die
//      Warnstufe UND einen Hinweis — und kein Feld, das jemand als Sperre lesen
//      könnte.
//   2. QUELLTEXT des Wählwegs: keine Ablehnung mehr, die aus der Grenze folgt.
//      Das ist die Prüfung, die rot wird, wenn jemand die Wand neu einbaut.
//   3. OBERFLÄCHE: Das Panel zeigt den Hinweis.
//
//   npx tsx scripts/pruef-anrufgrenze.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  nummerKontingent, nummerWarnungMelden, anrufHinweisSchwelle,
  ANRUF_HINWEIS_SCHWELLE_VORGABE, ANRUF_WARN_FAKTOR,
} from "../server/lib/fiaon-softphone";

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
/** Kommentare weg, bevor man auf ABWESENHEIT von Code prüft (AGENTS.md). */
const ohneKommentare = (q: string) => q.split("\n")
  .filter((z) => !/^\s*(\/\/|\*|\/\*|--)/.test(z)).join("\n");

async function main(): Promise<void> {
  // ══════════════════════════════════════════════════════════════════════════
  // DDL VOR DER TRANSAKTION — SONST WARTEN BEIDE AUFEINANDER
  //
  // `logDiagnostic` ruft intern `ensureTable()` und führt damit CREATE TABLE
  // über den GLOBALEN Pool aus, also auf einer zweiten Verbindung. Hat der
  // Prüfstand in seiner Transaktion schon geschrieben, warten beide bis zum
  // Statement-Zeitlimit — ohne Fehlermeldung, die das erklärt.
  //
  // Genau das ist beim ersten Lauf passiert: Der Prüfstand hing still. AGENTS.md
  // beschreibt die Falle („Ein Prüfstand in einer Transaktion trifft auf drei
  // Fallen", Punkt 1); sie kostet Minuten, wenn man sie kennt.
  //
  // Ein harmloser Info-Eintrag legt die Tabelle an, bevor die Transaktion
  // aufgeht. Er ist ausdrücklich als Prüfstands-Spur erkennbar.
  {
    const { logDiagnostic } = await import("../server/lib/fiaon-diagnostics");
    logDiagnostic({
      severity: "info", category: "system", code: "pruefstand_anrufgrenze",
      message: "PRUEFSTAND anrufgrenze: Tabelle vor der Transaktion angelegt.",
    });
    // Kurz warten, damit das Anlegen durch ist — logDiagnostic ist bewusst
    // nicht abwartbar (es darf nie einen Aufrufer aufhalten).
    await new Promise((f) => setTimeout(f, 1500));
  }

  titel("1. DIE KALIBRIERUNG");
  log("");
  const schwelleJetzt = await anrufHinweisSchwelle();
  log(`  Vorgabe im Quelltext:      ${ANRUF_HINWEIS_SCHWELLE_VORGABE}`);
  log(`  Wirksam (mit Einstellung): ${schwelleJetzt}`);
  log(`  Warnfaktor:                ${ANRUF_WARN_FAKTOR}`);
  ok("Die Vorgabe liegt über der gemessenen Spitze von 252 Anrufen je Nummer",
    ANRUF_HINWEIS_SCHWELLE_VORGABE > 252, String(ANRUF_HINWEIS_SCHWELLE_VORGABE));
  ok("Die Warnschwelle liegt über der Hinweisschwelle", ANRUF_WARN_FAKTOR > 1);

  // ═══════════════════════════════════════════════════════════════════════
  titel("2. VERHALTEN — SCHWELLE ERREICHT, ANRUF GEHT TROTZDEM");
  // ═══════════════════════════════════════════════════════════════════════
  // Der Prüffall entsteht in einer Transaktion, die zurückgerollt wird: eine
  // Absendernummer, die es nicht gibt, mit genügend Anrufen darüber. Eine echte
  // Nummer würde die Zählung des Betriebs verfälschen.
  const marke = `+49000${Date.now().toString().slice(-7)}`;

  await sqlPool.begin(async (tx: any) => {
    // Die Schwelle in der Transaktion klein setzen, damit der Prüffall nicht
    // 300 Zeilen braucht. Das prüft dieselbe Logik mit weniger Daten.
    await tx`
      INSERT INTO fiaon_settings (key, value) VALUES ('anruf_hinweis_schwelle', '4')
      ON CONFLICT (key) DO UPDATE SET value = '4'
    `;
    const s = await anrufHinweisSchwelle(tx);
    ok("Die Einstellung wirkt (Schwelle 4 im Prüffall)", s === 4, String(s));

    const anlegen = async (n: number) => {
      for (let i = 0; i < n; i++) {
        await tx`
          INSERT INTO fiaon_calls (agent_id, nummer, richtung, beginn, status, von_nummer,
                                   zuordnung_herkunft)
          VALUES (1, '+49301112223', 'raus', NOW(), 'beendet', ${marke}, 'gewaehlt')
        `;
      }
    };

    // ── UNTER DER SCHWELLE: NICHTS ────────────────────────────────────────
    await anlegen(2);
    const ruhig = await nummerKontingent(marke, tx);
    ok("Unter der Schwelle: Stufe „ruhig“", ruhig.stufe === "ruhig", ruhig.stufe);
    ok("… und KEIN Hinweistext (eine Zahl, die immer dasteht, liest niemand)",
      ruhig.hinweis === null, String(ruhig.hinweis));

    // ── AB DER SCHWELLE: HINWEIS, ABER KEINE SPERRE ───────────────────────
    await anlegen(2);
    const hinweis = await nummerKontingent(marke, tx);
    ok(`Ab der Schwelle: Stufe „hinweis“ (${hinweis.heute} Anrufe)`,
      hinweis.stufe === "hinweis", `${hinweis.stufe} bei ${hinweis.heute}`);
    ok("… mit einem Satz für das Panel", !!hinweis.hinweis, String(hinweis.hinweis));
    ok("… der ausdrücklich sagt, dass weitergearbeitet werden darf",
      /weiterarbeiten/i.test(hinweis.hinweis || ""), String(hinweis.hinweis));

    // ── DIE ENTSCHEIDENDE PRÜFUNG ─────────────────────────────────────────
    // Es darf KEIN Feld geben, das eine Sperre ausdrückt. Vorher hieß es
    // `erschoepft` — und die Route hat es abgefragt.
    const felder = Object.keys(hinweis);
    ok("Der Stand trägt kein Feld „erschoepft“ mehr",
      !felder.includes("erschoepft"), felder.join(", "));
    ok("… und auch kein „frei“ / „grenze“ (die Sprache der alten Sperre)",
      !felder.includes("frei") && !felder.includes("grenze"), felder.join(", "));

    // ── AB DEM 1,5-FACHEN: WARNUNG FÜR DEN BETREIBER ──────────────────────
    await anlegen(3);
    const warnung = await nummerKontingent(marke, tx);
    ok(`Ab dem 1,5-fachen: Stufe „warnung“ (${warnung.heute} von ${warnung.warnSchwelle})`,
      warnung.stufe === "warnung", `${warnung.stufe} bei ${warnung.heute}`);
    ok("… der Agent liest weiterhin denselben ruhigen Satz",
      /weiterarbeiten/i.test(warnung.hinweis || ""), String(warnung.hinweis));

    // `nichtSenden`: KEINE echte Mail an den Betreiber (AGENTS.md).
    const gemeldet = await nummerWarnungMelden(marke, warnung, tx, { nichtSenden: true });
    ok("Die Betreiber-Warnung wird ausgelöst", gemeldet.gewarnt, gemeldet.grund);
    ok("… und der Prüfstand hat dabei KEINE Mail verschickt",
      /unterdrückt/.test(gemeldet.grund), gemeldet.grund);
    log(`        ${gemeldet.grund}`);
    // Zweimal warnen an einem Tag wäre bei jedem weiteren Anruf eine Mail.
    const nochmal = await nummerWarnungMelden(marke, warnung, tx, { nichtSenden: true });
    ok("Ein zweiter Aufruf am selben Tag warnt NICHT erneut", !nochmal.gewarnt,
      nochmal.grund);

    // ── UND BEI ABGESCHALTETER SCHWELLE ───────────────────────────────────
    await tx`UPDATE fiaon_settings SET value = '0' WHERE key = 'anruf_hinweis_schwelle'`;
    const aus = await nummerKontingent(marke, tx);
    ok("Bei Schwelle 0: Stufe „ruhig“, kein Hinweis",
      aus.stufe === "ruhig" && aus.hinweis === null, `${aus.stufe} / ${aus.hinweis}`);
    ok("… und der Tagesstand wird trotzdem gezählt", aus.heute >= 7, String(aus.heute));

    throw new Error("ROLLBACK-ABSICHT");
  }).catch((e: unknown) => {
    if (!(e instanceof Error) || e.message !== "ROLLBACK-ABSICHT") throw e;
  });

  // ═══════════════════════════════════════════════════════════════════════
  titel("3. QUELLTEXT — KEINE SPERRE IM WÄHLWEG");
  // ═══════════════════════════════════════════════════════════════════════
  // Das ist die Prüfung, die rot wird, wenn jemand die Wand neu einbaut. Sie
  // schneidet den Block der Ausweis-Route heraus und sieht NUR dort nach —
  // eine Suche über die ganze Datei träfe die Berechtigungsprüfungen mit, und
  // die sollen bleiben.
  const routen = lies("server/routes/fiaon-telefonie.ts");
  const start = routen.indexOf('router.post("/telefon/ausweis"');
  const ende = routen.indexOf("router.", start + 10);
  const waehlweg = ohneKommentare(routen.slice(start, ende > start ? ende : start + 12_000));
  ok("Der Wählweg wurde gefunden", start > 0 && waehlweg.length > 500,
    `start=${start}, laenge=${waehlweg.length}`);

  ok("Der Wählweg fragt kein „erschoepft“ mehr ab",
    !/erschoepft/.test(waehlweg));
  ok("Er antwortet nicht mehr mit HTTP 429",
    !/\b429\b/.test(waehlweg), (waehlweg.match(/.{0,60}429.{0,40}/) ?? [""])[0]);
  ok("Er lehnt nichts wegen einer Tagesgrenze ab",
    !/Tagesgrenze/.test(waehlweg), (waehlweg.match(/.{0,50}Tagesgrenze.{0,50}/) ?? [""])[0]);
  // Und positiv: Der Stand wird geholt und die Warnung gemeldet.
  ok("Er holt den Tagesstand", /nummerKontingent\(/.test(waehlweg));
  ok("Er meldet die Warnung an den Betreiber",
    /nummerWarnungMelden\(/.test(waehlweg));

  // ── DIE DREI ERLAUBTEN WÄNDE MÜSSEN STEHEN BLEIBEN ────────────────────
  // Eine Prüfung, die nur „nichts sperrt" verlangt, würde grün, wenn jemand
  // die Berechtigungsprüfung entfernt. Das wäre schlimmer als die Sperre.
  ok("Die Berechtigung sperrt weiter (darfAnKunde)", /darfAnKunde\(/.test(waehlweg));
  ok("Die Richtlinien-Zusage sperrt weiter (darfWaehlen)", /darfWaehlen\(/.test(waehlweg));
  ok("Die Nummernprüfung sperrt weiter (wahlPruefen)", /wahlPruefen\(/.test(waehlweg));

  // ═══════════════════════════════════════════════════════════════════════
  titel("4. DAS VERSANDZENTRUM — DIESELBE BAUWEISE, DERSELBE UMBAU");
  // ═══════════════════════════════════════════════════════════════════════
  const versand = ohneKommentare(lies("server/lib/fiaon-versand.ts"));
  ok("Das Tageslimit lehnt nicht mehr ab",
    !/erlaubt: false, grund: `Tageslimit/.test(versand),
    (versand.match(/.{0,40}Tageslimit.{0,60}/) ?? [""])[0]);
  ok("Es gibt ein Feld „warnung“ neben „grund“", /warnung: string \| null/.test(versand));
  ok("Die echten Wände bleiben (DSGVO, Kontaktsperre, fehlende Adresse)",
    /DSGVO/.test(versand) && /Kontaktsperre/.test(versand)
    && /Keine E-Mail-Adresse hinterlegt/.test(versand));

  // ═══════════════════════════════════════════════════════════════════════
  titel("5. DIE OBERFLÄCHE ZEIGT DEN HINWEIS");
  // ═══════════════════════════════════════════════════════════════════════
  const panel = lies("client/src/components/Softphone.tsx");
  ok("Das Panel liest den Tagesstand", /stand\.kontingent\?\.hinweis/.test(panel));
  ok("… und hat ein Kennzeichen für den Browsertest",
    /data-fiaon="anruf-tagesstand"/.test(panel));
  ok("Der Hinweis kommt vom SERVER und wird nicht im Client gebaut",
    !/Heute bereits \$\{/.test(panel));

  // ═══════════════════════════════════════════════════════════════════════
  titel("6. DIE HAUSREGEL STEHT IN AGENTS.md");
  // ═══════════════════════════════════════════════════════════════════════
  const regeln = lies("AGENTS.md");
  ok("Die Regel ist aufgeschrieben",
    /Schutzmechanismus, der die Kernarbeit anhält/.test(regeln));
  ok("… mit der gemessenen Zahl der verhinderten Anrufe", /26\s*\*\*?\s*Anrufe|\*\*26/.test(regeln));
  ok("… und mit der Abgrenzung „nur bei Sicherheit oder Recht“",
    /Sicherheit oder Recht/.test(regeln));

  log("");
  log(`${gut} ok, ${schlecht} rot.`);
  log("");
  await sqlPool.end();
  if (schlecht > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
