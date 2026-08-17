// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSLAUF: DIE STUFE AN DIE ABLEITUNG ANPASSEN
//
//   npx tsx scripts/ablauf-bestand-lauf.ts                nur Vorschau + CSV
//   npx tsx scripts/ablauf-bestand-lauf.ts --schreiben    ändert wirklich
//
// ── WAS DIESER LAUF TUT ────────────────────────────────────────────────────
// Er setzt `onboarding_stufe` auf das, was `stufeAbleiten()` errechnet.
// GEMESSEN vorher: 364 von 365 bezahlten Bestellungen standen auf
// „voll_aktiv", ohne dass EIN EINZIGES Startgespräch geführt wurde.
//
// Nach dem Lauf sehen diese Menschen beim nächsten Login das Gate.
//
// ── DIE WAND, DIE VOR ALLEM ANDEREN KOMMT ──────────────────────────────────
// Ein Pflicht-Gate ohne buchbare Termine ist eine verschlossene Tür. Am
// 20.08.2026 war genau das der Zustand: kein Mitarbeiter mit der Rolle
// „onboarding", also null Slots für `onboarding_call`. Hätte dieser Lauf damals
// geschrieben, wären 364 zahlende Menschen ausgesperrt gewesen — buchen
// unmöglich, „Später" abgeschafft.
//
// Deshalb PRÜFT der Lauf zuerst, ob ein wartender Kunde wirklich buchen kann.
// Kann er nicht, bricht der Lauf ab. Eine Migration, die eine Tür zumacht,
// muss beweisen, dass es einen Schlüssel gibt.
//
// ── UND KEINE MAIL-FLUT ────────────────────────────────────────────────────
// Der Lauf verschickt NICHTS. Die Einladung übernimmt die bestehende
// `onboarding_einladung`-Staffel mit ihrer Grenze von 50 Mails am Tag. 364
// Mails in einer Minute wären für jeden Spamfilter ein Angriff — und für den
// Support ein Tag am Telefon.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { stufeAbleiten } from "../server/lib/fiaon-kundenstufe";

const SCHREIBEN = process.argv.includes("--schreiben");
/** Nur zum Prüfen der Wand selbst — überspringt die Slot-Sicherung. */
const OHNE_WAND = process.argv.includes("--ohne-slot-pruefung");

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }

function feld(v: unknown): string {
  const s = v == null ? "" : String(v).replace(/[\r\n]+/g, " ");
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  log(SCHREIBEN
    ? "\n  ⚠  SCHREIBMODUS — Stufen werden gesetzt."
    : "\n  VORSCHAU. Nichts wird geändert. Zum Schreiben: --schreiben");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE WAND: kann ein wartender Kunde überhaupt buchen?");
  // ═════════════════════════════════════════════════════════════════════════
  const { freieSlots, rollenMitRueckfall } = await import("../server/lib/fiaon-termine");
  const rollen = await rollenMitRueckfall("onboarding_call");
  log(`  Slots kommen von: ${rollen.rollen?.join(", ") ?? "dem zuständigen Betreuer"}`
    + `${rollen.rueckfall ? "  (RÜCKFALL — kein Onboarding-Mitarbeiter vorhanden)" : ""}`);

  const [prueffall] = (await sqlPool`
    SELECT person_id FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL AND person_id IS NOT NULL
      AND type IS DISTINCT FROM 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY completed_at DESC NULLS LAST LIMIT 1
  `) as any[];
  let slots = 0;
  let tage = 0;
  if (prueffall?.person_id) {
    const a = await freieSlots(Number(prueffall.person_id), sqlPool, "onboarding_call");
    slots = a.slots.length;
    tage = new Set(a.slots.map((s) => s.datum)).size;
  }
  log(`  Ein echter wartender Kunde bekommt: ${slots} Zeiten über ${tage} Tage.`);

  if (slots === 0 && !OHNE_WAND) {
    log("\n  ✘ ABBRUCH. Es gibt keine buchbaren Zeiten für das Startgespräch.");
    log("    Würde dieser Lauf schreiben, stünden alle Betroffenen vor einem");
    log("    Pflicht-Gate ohne Termine — buchen unmöglich, „Später\u201c abgeschafft.");
    log("\n    Zu tun: einen Mitarbeiter mit der Rolle „onboarding\u201c anlegen ODER");
    log("    Verfügbarkeitsfenster bei Vertrieb/Leitung eintragen (/agent/termine).");
    await sqlPool.end();
    process.exit(2);
  }
  if (slots > 0) log("  ✔ Die Tür hat einen Schlüssel. Weiter.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE BETROFFENEN");
  // ═════════════════════════════════════════════════════════════════════════
  // ALLE Bestellungen prüfen, nicht nur die bezahlten: Auch eine Zeile, die
  // fälschlich „wartet_auf_onboarding" trägt, ohne bezahlt zu sein, gehört
  // korrigiert — sonst zeigt die Akte einen Zustand, den es nicht gibt.
  // ── ZUERST DIE SAMMELABFRAGE, DANN DIE EINZELPRÜFUNG ──────────────────
  // Ein erster Entwurf rief `stufeAbleiten()` für jede der 6.825 Bestellungen —
  // also 6.825 Abfragen über eine Netzverbindung nach Oregon. Nach zwanzig
  // Sekunden war er bei 1.000.
  //
  // Jetzt rechnet EINE Abfrage die Sollstufe für alle (`stufenFuerListe`, die
  // SQL-Fassung derselben Regel) und vergleicht sie mit der Spalte. Nur die
  // Abweichungen werden einzeln abgeleitet — für den Grund, der in die CSV
  // gehört. Das sind wenige hundert statt siebentausend.
  //
  // Dass beide Fassungen dasselbe ergeben, prüft der Prüfstand an jeder
  // Konstellation. Eine geprüfte Wiederholung ist besser als ein Umweg, den
  // jemand baut, weil der richtige Weg zu langsam ist.
  const alle = (await sqlPool`
    SELECT ref, COALESCE(onboarding_stufe, '(leer)') AS spalte
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
    ORDER BY created_at DESC
  `) as any[];
  log(`  ${alle.length} Bestellungen werden geprüft (Sammelabfrage) …`);

  const { stufenFuerListe } = await import("../server/lib/fiaon-kundenstufe");
  const soll = new Map<string, string>();
  // In Blöcken, damit die Parameterliste nicht überläuft.
  for (let i = 0; i < alle.length; i += 2000) {
    const block = alle.slice(i, i + 2000).map((z) => String(z.ref));
    for (const [ref, w] of Array.from((await stufenFuerListe(block)).entries())) {
      soll.set(ref, w.stufe === "kein_zugang" ? "(leer)" : w.stufe);
    }
  }

  const abweichend = alle.filter((z) => soll.get(String(z.ref)) !== String(z.spalte));
  log(`  ${abweichend.length} weichen ab — für die wird der Grund einzeln ermittelt.`);

  const aenderungen: {
    ref: string; von: string; nach: string; grund: string;
    naechster: string; bezahlt: string;
  }[] = [];
  let geprueft = 0;
  for (const z of abweichend) {
    geprueft++;
    if (geprueft % 200 === 0) log(`    … ${geprueft} von ${abweichend.length}`);
    const lage = await stufeAbleiten(String(z.ref));
    if (!lage || !lage.spalteWeichtAb) continue;
    aenderungen.push({
      ref: lage.ref,
      von: lage.spalte ?? "(leer)",
      nach: lage.stufe === "kein_zugang" ? "(leer)" : lage.stufe,
      grund: lage.grund,
      naechster: lage.naechsterSchritt,
      bezahlt: lage.bezahlt ? "ja" : "nein",
    });
  }

  log(`\n  ${aenderungen.length} Bestellungen weichen von der Ableitung ab.`);
  const jeUebergang = new Map<string, number>();
  for (const a of aenderungen) {
    const k = `${a.von} → ${a.nach}`;
    jeUebergang.set(k, (jeUebergang.get(k) ?? 0) + 1);
  }
  log("\n  DIE ÜBERGÄNGE:");
  for (const [k, n] of Array.from(jeUebergang.entries()).sort((a, b) => b[1] - a[1])) {
    log(`    ${String(n).padStart(5)} ×  ${k}`);
  }

  // ── WIE VIELE MENSCHEN SEHEN NEU DAS GATE? ──────────────────────────────
  // Das ist die Zahl, die zählt: Nicht „wie viele Zeilen ändern sich", sondern
  // „wie viele zahlende Menschen finden morgen eine Pflichtaufgabe vor".
  const neuImGate = aenderungen.filter((a) => a.nach === "wartet_auf_onboarding");
  log("");
  log(`  ${neuImGate.length} zahlende Menschen sehen beim nächsten Login das Gate.`);
  log("  Sie bekommen KEINE Mail aus diesem Lauf — die Einladung übernimmt die");
  log("  bestehende Staffel (höchstens 50 am Tag).");

  log(`\n  CSV: ${csv("lauf-ablauf-stufen.csv", aenderungen)}`);

  if (SCHREIBEN && aenderungen.length > 0) {
    titel("SCHREIBEN");
    // Je Übergang eine Anweisung — nachvollziehbar und schnell.
    let geschrieben = 0;
    for (const [uebergang] of Array.from(jeUebergang.entries())) {
      const [, nach] = uebergang.split(" → ");
      const refs = aenderungen.filter((a) => `${a.von} → ${a.nach}` === uebergang).map((a) => a.ref);
      const soll = nach === "(leer)" ? null : nach;
      const treffer = (await sqlPool`
        UPDATE fiaon_applications
        SET onboarding_stufe = ${soll}, updated_at = NOW()
        WHERE ref = ANY(${refs})
        RETURNING ref
      `) as any[];
      geschrieben += treffer.length;
      log(`    ${String(treffer.length).padStart(5)} ×  ${uebergang}`);
    }
    log(`\n  ${geschrieben} Stufen gesetzt.`);

    // ── DIE ZÄHLPROBE ─────────────────────────────────────────────────────
    // Nach dem Lauf darf KEINE Bestellung mehr von der Ableitung abweichen.
    // Zweiter Durchlauf über dieselben Zeilen — eine Zahl, die man nach dem
    // Schreiben nicht nachzählt, ist eine Hoffnung.
    let abweichend = 0;
    for (const a of aenderungen) {
      const lage = await stufeAbleiten(a.ref);
      if (lage?.spalteWeichtAb) abweichend++;
    }
    log(`  ZÄHLPROBE: ${abweichend} Abweichungen übrig `
      + `${abweichend === 0 ? "— richtig." : "— FEHLER, der Lauf ist unvollständig."}`);
    if (abweichend > 0) process.exitCode = 1;

    // Und die Gegenprobe in der Datenbank selbst: Steht irgendwo noch
    // „voll_aktiv" ohne erledigtes Gespräch und ohne Ausnahme?
    const [falsch] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND a.onboarding_stufe = 'voll_aktiv'
        AND a.payment_status = 'paid'
        AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
          WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
        AND NULLIF(TRIM(COALESCE(a.onboarding_ausnahme_grund, '')), '') IS NULL
    `) as any[];
    log(`  GEGENPROBE: ${falsch.n} × „voll aktiv“ ohne Gespräch und ohne Ausnahme `
      + `${Number(falsch.n) === 0 ? "— richtig." : "— FEHLER."}`);
    if (Number(falsch.n) > 0) process.exitCode = 1;
  }

  if (!SCHREIBEN) {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log("  Das war die VORSCHAU. Die CSV zeigt jede Änderung mit Grund.");
    log("  Wenn sie stimmt:  npx tsx scripts/ablauf-bestand-lauf.ts --schreiben");
  }
  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
