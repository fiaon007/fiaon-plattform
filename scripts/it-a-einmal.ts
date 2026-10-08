// ═══════════════════════════════════════════════════════════════════════════
// E-IT-A (08.10.2026) — EINMAL-BEREINIGUNG ZUR WIEDERVORLAGE-REGEL
//
// Die neue Regel (shared/fiaon-wiedervorlage.ts) wirkt ab dem Deploy auf jedes
// NEUE Ergebnis. Zwei Altlasten heilt sie nicht von selbst:
//
//   A  ALTE RÜCKRUFE OHNE ABSCHLUSS. Rückrufe galten nur über den Kalender-
//      Knopf als erledigt. Gemessen am 07.10.2026: 22 offene, überfällige
//      Rückrufe, 20 davon mit einem SPÄTEREN Gesprächsergebnis. Die Arbeitsliste
//      liest sie seit E-IT-A schon richtig (rueckrufOffenSql) — aber Kalender
//      und Erinnerungsleiste zeigen sie weiter als offen. Der Lauf setzt
//      done_at, wo NACH der vereinbarten Zeit ein Ergebnis gebucht wurde.
//      Seit E-IT-A tut ergebnisAnwenden dasselbe bei jedem neuen Ergebnis.
//
//   B  DOPPELT GEZÄHLTE FEHLVERSUCHE. Softphone UND Akte buchten denselben
//      Anruf; beide Wege zählten unreachable_count hoch (Nikita: 131 von 653
//      binnen 30 Minuten). Seit E-IT-A zählt ein zweiter Fehlversuch binnen
//      30 Minuten nicht mehr (fiaon-fehlversuch.ts). Der Lauf zieht die alten
//      Doppelzählungen ab — VORSICHTIG:
//        · gezählt werden nur „nicht_erreicht"/„mailbox" NACH dem letzten
//          Gespräch (erreicht_*, Rückruf, erreichtes Ratenergebnis);
//          'rate_nicht_erreicht' ist nur der Verlaufsvermerk des Ratenwegs und
//          hat nie gezählt;
//        · eine Doppelbuchung ist ein Fehlversuch binnen 30 Minuten nach dem
//          zuletzt GEZÄHLTEN (dieselbe Regel wie die neue Marke);
//        · abgezogen wird NUR, wenn der gespeicherte Zähler mindestens so groß
//          ist wie die Zahl dieser Zeilen (dann hat er sie nachweislich alle
//          gezählt — sonst gab es dazwischen einen Rücksetzer ohne Verlaufs-
//          zeile, z. B. eine Terminbuchung, und der Lauf lässt die Finger davon);
//        · nur nach unten, nie unter die entdoppelte Zahl.
//      Wer dadurch unter 9 fällt, ruht nicht mehr (ruhtSql zählt den Zähler)
//      und steht wieder in „Wieder dran" — so, wie es ohne die Doppelzählung
//      gewesen wäre.
//
// NICHT im Lauf (die neue Lese-Seite arbeitet es von selbst ab, ohne Daten
// anzufassen): abgelaufene Zusagen (zusageOffenSql), „zahlt am" mit leerer
// Wiedervorlage, die gelöschten Wiedervorlagen der Ratenkunden (nicht
// wiederherstellbar — beim nächsten Ergebnis setzt die Regel sie neu).
//
// ── BEDIENUNG ─────────────────────────────────────────────────────────────
//   npx tsx scripts/it-a-einmal.ts                      # TROCKENLAUF (Standard): Vorschau, schreibt NICHTS
//   npx tsx scripts/it-a-einmal.ts --ausfuehren         # schreibt — in EINER Transaktion
//   … --nur=A | --nur=B                                  # nur ein Teil
//   … --ausgabe=<ordner>                                 # Standard: reports/it-a-einmal-<zeit>/
//
// Jeder Lauf legt im Ausgabeordner ab:
//   vorschau.csv   je Zeile: teil, id, person_id, vorher, nachher, grund
//   sicherung.json die alten Werte (vor dem Schreiben gelesen)
//   rueckweg.sql   macht genau diesen Lauf rückgängig (nur Zeilen, die seither
//                  niemand geändert hat — Bedingung auf den geschriebenen Wert)
// Geschrieben wird nur, wo der Wert noch dem der Vorschau entspricht (kein
// Wettlauf mit dem Betrieb). Zeitgrenzen: statement_timeout 60 s,
// lock_timeout 5 s (E-254).
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { ENTPRELLUNG_MINUTEN } from "../shared/fiaon-wiedervorlage";

const AUSFUEHREN = process.argv.includes("--ausfuehren");
const NUR = (process.argv.find((a) => a.startsWith("--nur=")) ?? "").split("=")[1]?.toUpperCase() ?? "";
const STEMPEL = new Date().toISOString().replace(/[:.]/g, "-");
const AUSGABE = (process.argv.find((a) => a.startsWith("--ausgabe=")) ?? "").split("=")[1] || `reports/it-a-einmal-${STEMPEL}`;
const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL fehlt."); process.exit(2); }
const lokal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
const sql = postgres(url, {
  ssl: "require", max: 1, onnotice: () => {},
  connection: { statement_timeout: 60_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 60_000, application_name: "it-a-einmal" },
});

const log = (s = "") => console.log(s);
const csv = (v: unknown) => { const t = v == null ? "" : String(v); return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
interface Zeile { teil: "A" | "B"; id: number; personId: number | null; vorher: string; nachher: string; grund: string }

/** Gesprächsergebnisse, die den Zähler zurücksetzen (wie erreichtZuruecksetzen / ERREICHT in fiaon-anrufversuche.ts). */
const ERREICHT = (o: string) => `(${o} LIKE 'erreicht%' OR ${o} = 'rueckruf_termin'
  OR (LEFT(${o}, 5) = 'rate_' AND ${o} NOT IN ('rate_nicht_erreicht', 'rate_nummer_blockiert')))`;

async function teilA(): Promise<Zeile[]> {
  const rows = (await sql.unsafe(`
    SELECT cl.id, a.person_id, cl.scheduled_at,
           (SELECT MIN(x.created_at) FROM (
              SELECT c2.created_at FROM fiaon_contact_log c2 JOIN fiaon_applications a2 ON a2.ref = c2.ref
               WHERE a2.person_id = a.person_id AND c2.type = 'result' AND c2.voided_at IS NULL
                 AND c2.created_at > cl.scheduled_at AND c2.id <> cl.id
              UNION ALL
              SELECT c3.created_at FROM fiaon_contact_log c3
               WHERE c3.person_id = a.person_id AND c3.type = 'result' AND c3.voided_at IS NULL
                 AND c3.created_at > cl.scheduled_at AND c3.id <> cl.id) x) AS spaeter
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
     WHERE cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL AND cl.voided_at IS NULL
       AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at < NOW()
       AND a.person_id IS NOT NULL
     ORDER BY cl.id`)) as any[];
  return rows.filter((r) => r.spaeter).map((r) => ({
    teil: "A" as const, id: Number(r.id), personId: Number(r.person_id),
    vorher: "done_at=NULL", nachher: "done_at=Laufzeit",
    grund: `Rückruf ${new Date(r.scheduled_at).toISOString()}, späteres Ergebnis ${new Date(r.spaeter).toISOString()}`,
  }));
}

async function teilB(): Promise<Zeile[]> {
  const personen = (await sql.unsafe(`
    SELECT p.id, p.unreachable_count AS zaehler
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND COALESCE(p.unreachable_count, 0) > 1`)) as any[];
  if (personen.length === 0) return [];
  const ids = personen.map((p) => Number(p.id));
  // Alle Ergebnisse dieser Menschen, über person_id UND über ihre Bestellungen, je Zeile einmal.
  const ergebnisse = (await sql.unsafe(`
    SELECT DISTINCT ON (e.id) e.id, e.person_id, e.outcome, e.created_at FROM (
      SELECT cl.id, a.person_id, cl.outcome, cl.created_at FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
       WHERE a.person_id = ANY($1::int[]) AND cl.type = 'result' AND cl.voided_at IS NULL AND cl.outcome IS NOT NULL
      UNION ALL
      SELECT cl.id, cl.person_id, cl.outcome, cl.created_at FROM fiaon_contact_log cl
       WHERE cl.person_id = ANY($1::int[]) AND cl.type = 'result' AND cl.voided_at IS NULL AND cl.outcome IS NOT NULL) e
     ORDER BY e.id`, [ids])) as any[];
  const erreichtSql = (await sql.unsafe(`SELECT x AS o, ${ERREICHT("x")} AS erreicht FROM unnest($1::text[]) x`,
    [Array.from(new Set(ergebnisse.map((e) => String(e.outcome))))])) as any[];
  const istErreicht = new Map(erreichtSql.map((r) => [String(r.o), r.erreicht === true]));
  const jePerson = new Map<number, { outcome: string; am: number }[]>();
  for (const e of ergebnisse) {
    const l = jePerson.get(Number(e.person_id)) ?? [];
    l.push({ outcome: String(e.outcome), am: new Date(e.created_at).getTime() });
    jePerson.set(Number(e.person_id), l);
  }
  const fenster = ENTPRELLUNG_MINUTEN * 60_000;
  const aus: Zeile[] = [];
  for (const p of personen) {
    const liste = (jePerson.get(Number(p.id)) ?? []).sort((a, b) => a.am - b.am);
    const letzteErreicht = Math.max(-Infinity, ...liste.filter((e) => istErreicht.get(e.outcome)).map((e) => e.am));
    const fehl = liste.filter((e) => e.am > letzteErreicht && (e.outcome === "nicht_erreicht" || e.outcome === "mailbox"));
    let gezaehlt = 0; let marke = -Infinity;
    for (const f of fehl) { if (f.am - marke > fenster) { gezaehlt++; marke = f.am; } }
    const zaehler = Number(p.zaehler);
    const doppel = fehl.length - gezaehlt;
    // Nur wo der Zähler nachweislich alle Zeilen gezählt hat — sonst gab es einen Rücksetzer ohne Verlaufszeile.
    if (doppel > 0 && zaehler >= fehl.length) {
      aus.push({
        teil: "B", id: Number(p.id), personId: Number(p.id), vorher: String(zaehler), nachher: String(zaehler - doppel),
        grund: `${fehl.length} Fehlversuch-Zeilen seit dem letzten Gespräch, davon ${doppel} binnen ${ENTPRELLUNG_MINUTEN} Min. doppelt${zaehler >= 9 && zaehler - doppel < 9 ? " — ruht danach NICHT mehr" : ""}`,
      });
    }
  }
  return aus;
}

async function main(): Promise<void> {
  log(`E-IT-A Einmal-Bereinigung — ${AUSFUEHREN ? "AUSFÜHREN (schreibt)" : "TROCKENLAUF (schreibt nichts)"} · Datenbank ${lokal ? "LOKAL" : "ENTFERNT"} · Ausgabe ${AUSGABE}`);
  const a = NUR && NUR !== "A" ? [] : await teilA();
  const b = NUR && NUR !== "B" ? [] : await teilB();
  mkdirSync(AUSGABE, { recursive: true });
  const alle = [...a, ...b];
  writeFileSync(`${AUSGABE}/vorschau.csv`, ["teil;id;person_id;vorher;nachher;grund",
    ...alle.map((z) => [z.teil, z.id, z.personId, z.vorher, z.nachher, z.grund].map(csv).join(";"))].join("\n") + "\n");
  writeFileSync(`${AUSGABE}/sicherung.json`, JSON.stringify({ stempel: STEMPEL, teilA: a, teilB: b }, null, 1));
  const unterNeun = b.filter((z) => Number(z.vorher) >= 9 && Number(z.nachher) < 9).length;
  log(`  A  alte Rückrufe mit späterem Ergebnis: ${a.length}`);
  log(`  B  Zähler mit Doppelzählung: ${b.length} (abgezogen zusammen ${b.reduce((s, z) => s + Number(z.vorher) - Number(z.nachher), 0)}; ${unterNeun} fallen dadurch unter 9 und ruhen nicht mehr)`);
  if (!AUSFUEHREN) {
    log(`  Vorschau: ${AUSGABE}/vorschau.csv — nichts geschrieben. Ausführen mit --ausfuehren.`);
    return;
  }
  let erledigtA = 0, erledigtB = 0; let zeit = "";
  await sql.begin(async (tx: any) => {
    const [n] = await tx`SELECT NOW()::text AS jetzt`; zeit = String(n.jetzt);
    if (a.length) {
      // NOW() ist in der Transaktion fest — derselbe Wert wie „zeit" oben, in voller
      // Genauigkeit (ein JS-Date hätte die Mikrosekunden abgeschnitten, und der
      // Rückweg fände seine Zeilen nicht mehr — gefunden im lokalen Probelauf).
      const r = await tx.unsafe(`
        UPDATE fiaon_contact_log SET done_at = NOW()
         WHERE id = ANY($1::int[]) AND done_at IS NULL AND outcome = 'rueckruf_termin' RETURNING id`, [a.map((z) => z.id)]);
      erledigtA = r.length;
    }
    for (const z of b) {
      const r = await tx`UPDATE fiaon_persons SET unreachable_count = ${Number(z.nachher)}, updated_at = NOW()
                          WHERE id = ${z.id} AND unreachable_count = ${Number(z.vorher)} RETURNING id`;
      erledigtB += r.length;
    }
  });
  const rueckweg = [
    `-- Rückweg E-IT-A Einmal-Bereinigung, Lauf ${zeit}. Nur Zeilen, die seither niemand geändert hat.`,
    "BEGIN;",
    a.length ? `UPDATE fiaon_contact_log SET done_at = NULL WHERE id IN (${a.map((z) => z.id).join(", ")}) AND done_at = '${zeit}'::timestamptz;` : "-- Teil A: nichts",
    ...b.map((z) => `UPDATE fiaon_persons SET unreachable_count = ${Number(z.vorher)} WHERE id = ${z.id} AND unreachable_count = ${Number(z.nachher)};`),
    "COMMIT;",
  ].join("\n");
  writeFileSync(`${AUSGABE}/rueckweg.sql`, rueckweg + "\n");
  log(`  Geschrieben: A ${erledigtA} von ${a.length}, B ${erledigtB} von ${b.length}. Rückweg: ${AUSGABE}/rueckweg.sql`);
}

main().then(() => sql.end({ timeout: 5 })).catch(async (e) => { console.error("FEHLER:", e?.message || e); await sql.end({ timeout: 5 }); process.exit(1); });
