// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: EINE BONITÄTS-WAHRHEIT
//
// ── DER BEFUND (22.08.2026) ────────────────────────────────────────────────
// Drei Teilwahrheiten, und jede Anzeige mischte sie anders:
//   30 zahlende Kunden hatten BEZAHLT, aber kein Dokument — das Portal
//      forderte sie weiter zum Kaufen auf.
//   31 hatten SELBST hochgeladen und sahen ebenfalls „kaufen".
//   35 Dokumente lagen zur Prüfung, 0 waren geprüft.
//   60 Code-Stellen lasen die drei Felder einzeln.
//
// ── WAS BEWIESEN WIRD ──────────────────────────────────────────────────────
//   1  Die Ableitung liefert für JEDE Konstellation genau eine Stufe.
//   2  „darfKaufen" ist nur wahr, wenn wirklich nichts da ist.
//   3  Einzel- und Sammelfassung stimmen überein (am echten Bestand).
//   4  Die Route liefert die neue Stufe UND die alten Feldnamen weiter.
//   5  Das Portal zeigt den Selbst-Upload.
//
//   npx tsx scripts/pruef-bonitaet.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { readFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  bonitaetAbleiten, bonitaetFuer, bonitaetFuerViele,
  BONITAET_MARKE, BONITAET_TON, type BonitaetStufe,
} from "../server/lib/fiaon-bonitaet-status";

let ok = 0;
let rot = 0;
const fehler: string[] = [];
function pruef(name: string, bedingung: boolean, hinweis = ""): void {
  if (bedingung) { ok++; console.log(`  ok    ${name}`); }
  else { rot++; fehler.push(name); console.log(`  ROT   ${name}${hinweis ? `  → ${hinweis}` : ""}`); }
}
function titel(t: string): void { console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`); }
const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE ABLEITUNG — jede Konstellation genau eine Stufe");
  // ═════════════════════════════════════════════════════════════════════════
  const faelle: [string, any, BonitaetStufe, boolean][] = [
    // Name                      Zeilen                                         Stufe                 darfKaufen
    ["nichts da",                {},                                            "nichts",             true],
    ["Zahlung offen",            { kauf_status: "pending_payment" },             "zahlung_offen",      false],
    ["Zahlung gemeldet",         { kauf_status: "claimed_paid" },                "zahlung_offen",      false],
    ["bezahlt, kein Dokument",   { kauf_status: "paid" },                        "beschaffung_laeuft", false],
    ["Dokument, nichts gekauft", { schufa_pdf_da: true },                        "liegt_zur_pruefung", false],
    ["Dokument UND bezahlt",     { schufa_pdf_da: true, kauf_status: "paid" },    "liegt_zur_pruefung", false],
    ["geprüft",                  { schufa_pdf_da: true, schufa_status: "approved" }, "geprueft",       false],
    ["beanstandet",              { schufa_pdf_da: true, schufa_status: "changes_requested" }, "beanstandet", false],
    // Die drei Schreibweisen, die die Verwaltung schreibt:
    ["beanstandet (rejected)",   { schufa_pdf_da: true, schufa_status: "rejected" }, "beanstandet",    false],
    ["beanstandet (requested)",  { schufa_pdf_da: true, schufa_status: "requested" }, "beanstandet",   false],
    // Der Kauf ist abgelaufen — das ist kein Kauf.
    ["Kauf abgelaufen",          { kauf_status: "expired" },                     "nichts",             true],
  ];
  for (const [name, z, erwartet, kaufen] of faelle) {
    const s = bonitaetAbleiten(z);
    pruef(`${name} → ${erwartet}`, s.stufe === erwartet, `ergab „${s.stufe}“`);
    pruef(`  … darfKaufen = ${kaufen}`, s.darfKaufen === kaufen,
      `ergab ${s.darfKaufen}`);
  }

  // ── DER KERN DES AUFTRAGS ──────────────────────────────────────────────
  pruef("Wer BEZAHLT hat, wird NICHT zum Kaufen aufgefordert",
    bonitaetAbleiten({ kauf_status: "paid" }).darfKaufen === false,
    "das war der Fall von 30 zahlenden Kunden");
  pruef("Wer SELBST hochgeladen hat, wird NICHT zum Kaufen aufgefordert",
    bonitaetAbleiten({ schufa_pdf_da: true }).darfKaufen === false,
    "das war der Fall von 31 Kunden");
  pruef("Wer bezahlt hat, darf trotzdem selbst hochladen",
    bonitaetAbleiten({ kauf_status: "paid" }).darfHochladen === true,
    "wenn er schneller ist als wir, soll ihn nichts hindern");
  pruef("Ein geprüftes Dokument beendet beides",
    bonitaetAbleiten({ schufa_pdf_da: true, schufa_status: "approved" }).darfHochladen === false);

  // ── JEDE STUFE HAT KLARTEXT ────────────────────────────────────────────
  const stufen: BonitaetStufe[] = ["nichts", "zahlung_offen", "beschaffung_laeuft",
    "liegt_zur_pruefung", "geprueft", "beanstandet"];
  for (const st of stufen) {
    pruef(`„${st}“ hat eine Marke und einen Farbton`,
      !!BONITAET_MARKE[st] && /^#[0-9a-f]{6}$/i.test(BONITAET_TON[st]));
  }
  for (const [name, z] of faelle.map((f) => [f[0], f[1]] as [string, any])) {
    const s = bonitaetAbleiten(z);
    pruef(`  „${name}“ nennt Grund, Kundentext und nächsten Schritt`,
      s.grund.length > 15 && s.fuerKunden.length > 15 && s.naechsterSchritt.length > 8,
      `grund=${s.grund.length}, kunde=${s.fuerKunden.length}, schritt=${s.naechsterSchritt.length}`);
  }
  // Der Kundentext darf kein Fachwort tragen.
  for (const st of faelle) {
    const s = bonitaetAbleiten(st[1]);
    pruef(`  „${st[0]}“ spricht den Kunden ohne Fachwort an`,
      !/schufa_|payment_status|pending|approved|null/i.test(s.fuerKunden),
      s.fuerKunden);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. EINZEL UND SAMMEL STIMMEN ÜBEREIN (echter Bestand)");
  // ═════════════════════════════════════════════════════════════════════════
  // Zwei Fassungen derselben Regel sind die Ursache der Widersprüche. Es gibt
  // hier nur EINE (bonitaetAbleiten) — aber zwei Abfragen, die sie füttern.
  // Also werden sie gegeneinander gehalten, am ungünstigsten Fall.
  const prueffaelle = (await sqlPool`
    SELECT a.ref FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY
      -- Der ungünstigste Fall zuerst: Dokument da UND Kauf da.
      (a.schufa_pdf IS NOT NULL) DESC,
      (EXISTS (SELECT 1 FROM fiaon_applications s
        WHERE (COALESCE(s.type,'')='schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
          AND s.person_id = a.person_id AND s.payment_status = 'paid')) DESC,
      a.created_at DESC
    LIMIT 40
  `) as any[];
  const refs = prueffaelle.map((p: any) => String(p.ref));
  const sammel = await bonitaetFuerViele(refs);
  let abweichungen = 0;
  for (const ref of refs) {
    const einzeln = await bonitaetFuer(ref);
    const s = sammel.get(ref);
    if (einzeln?.stufe !== s?.stufe) {
      abweichungen++;
      console.log(`        ${ref}: einzeln „${einzeln?.stufe}“ vs. sammel „${s?.stufe}“`);
    }
  }
  pruef(`Alle ${refs.length} Prüffälle stimmen überein`, abweichungen === 0,
    `${abweichungen} Abweichungen`);
  pruef("Die Sammelfassung findet alle Prüffälle", sammel.size === refs.length,
    `${sammel.size} von ${refs.length}`);

  // ── DIE GEMESSENEN GRUPPEN GIBT ES WIRKLICH ────────────────────────────
  const gruppen = new Map<string, number>();
  for (const s of sammel.values()) gruppen.set(s.stufe, (gruppen.get(s.stufe) ?? 0) + 1);
  console.log(`        Stufen unter den 40 Prüffällen: ${JSON.stringify(Object.fromEntries(gruppen))}`);
  pruef("Unter den Prüffällen ist mindestens ein Dokument-Fall",
    (gruppen.get("liegt_zur_pruefung") ?? 0) > 0,
    "sonst prüft der Stand nur den Leerfall");

  // ── UND DIE ZAHL, DIE DEN AUFTRAG AUSLÖSTE ─────────────────────────────
  const [w] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
      AND COALESCE(a.type,'') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.schufa_pdf IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications s
        WHERE (COALESCE(s.type,'')='schufa' OR s.ref LIKE 'FIAON-SCHUFA-%')
          AND s.person_id = a.person_id AND s.payment_status = 'paid')
  `) as any[];
  console.log(`        ${w.n} zahlende Kunden: Auskunft bezahlt, kein Dokument`);
  pruef("Diese Gruppe wird nicht mehr zum Kaufen aufgefordert",
    bonitaetAbleiten({ kauf_status: "paid" }).darfKaufen === false,
    `${w.n} Menschen betroffen`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE ROUTE — neue Stufe UND alte Feldnamen");
  // ═════════════════════════════════════════════════════════════════════════
  const antrag = lies("server/routes/fiaon-antrag.ts");
  pruef("Die Route benutzt die Ableitung",
    /await import\("\.\.\/lib\/fiaon-bonitaet-status"\)/.test(antrag)
      && /await bonitaetFuer\(ref\)/.test(antrag));
  pruef("Sie rechnet NICHT mehr selbst",
    !/const bezahlt = order\?\.payment_status === "paid"/.test(antrag),
    "die alte Eigenrechnung ist weg");
  pruef("Sie liefert `darfKaufen`", /darfKaufen: stand\.darfKaufen,/.test(antrag),
    "das Portal fragt dieses Feld, statt selbst zu rechnen");
  pruef("Sie liefert weiter `zustand` für die alten Leser",
    /zustand: stand\.stufe === "geprueft"/.test(antrag),
    "naechste-schritte.tsx und StartgespraechGate.tsx lesen es — ein Umbenennen hätte sie stumm kaputt gemacht");
  pruef("Sie liefert Klartext für den Kunden",
    /fuerKunden: stand\.fuerKunden,/.test(antrag));

  // ── DIE ZUORDNUNG LÄUFT ÜBER DIE PERSON ────────────────────────────────
  const abl = lies("server/lib/fiaon-bonitaet-status.ts");
  pruef("Die Zuordnung nimmt zuerst die person_id",
    /a\.person_id IS NOT NULL AND s\.person_id = a\.person_id/.test(abl),
    "die alte Route verband nur über die E-Mail");
  pruef("Die E-Mail bleibt als Rückfall",
    /s\.person_id IS NULL AND fiaon_mail_norm\(s\.email\)/.test(abl),
    "für die 9 alten Bestellungen ohne person_id");
  pruef("Eine bezahlte Bestellung schlägt eine offene",
    /ORDER BY \(s\.payment_status = 'paid'\) DESC/.test(abl),
    "wer zweimal bestellt und einmal bezahlt hat, hat bezahlt");

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DAS PORTAL — Selbst-Upload statt Kaufzwang");
  // ═════════════════════════════════════════════════════════════════════════
  const karte = lies("client/src/components/dashboard/naechste-schritte.tsx");
  pruef("Die Karte nennt den zweiten Weg",
    /Du hast deine Auskunft schon\?/.test(karte));
  pruef("Sie sagt ausdrücklich: du musst nichts kaufen",
    /du musst nichts kaufen/.test(karte));
  pruef("Sie verlinkt auf den Upload", /href="#dokumente"/.test(karte));
  pruef("Der Anker existiert im Dashboard",
    /id="dokumente"/.test(lies("client/src/pages/dashboard.tsx")),
    "ein Sprunganker ohne Ziel ist ein toter Klick");
  pruef("Der Anker hat scrollMarginTop",
    /id="dokumente" style=\{\{ scrollMarginTop: 90 \}\}/.test(lies("client/src/pages/dashboard.tsx")),
    "sonst verschwindet die Überschrift unter der Kopfzeile");

  console.log(`\n${"═".repeat(72)}`);
  console.log(`  ${ok} ok · ${rot} rot`);
  if (rot > 0) console.log(`\n  ROT:\n${fehler.map((f) => `    · ${f}`).join("\n")}`);
  console.log(`${"═".repeat(72)}\n`);
  await sqlPool.end();
  process.exit(rot > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
