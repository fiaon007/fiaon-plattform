// ═══════════════════════════════════════════════════════════════════════════
// WÄCHTER: GESPEICHERTE STUFE = ABLEITUNG
//
// ── DER BEFUND (30.08.2026) ────────────────────────────────────────────────
// 188 gespeicherte Stufen wichen von der Ableitung ab, darunter 142 Kunden mit
// OFFENER RECHNUNG im kalten Fach. Der Nachzug lag längst im Tageslauf — er ist
// nur nie gelaufen: `followup_last_run` stand auf 2026-08-03, der Kalender zeigte
// den 18.08. FÜNFZEHN TAGE.
//
// Die Ursache waren nicht die Funktion und nicht der Takt, sondern drei
// Rückgaben ÜBER dem Nachzug: Der Lauf darf nur in der 6-Uhr-Stunde (Wien)
// weitermachen. Wer in dieser einen Stunde nicht läuft — Neustart, Deploy, ein
// schlafender Dienst —, hat den Tag verloren. Die Einstufung steht seit dem
// 30.08.2026 VOR den Sperren und läuft bei jedem Takt.
//
// ── WARUM ES DIESEN WÄCHTER GIBT ──────────────────────────────────────────
// Weil der Fehler unsichtbar war. Niemand hat 15 Tage lang etwas gemerkt: Die
// Listen sahen normal aus, sie waren nur falsch. Ein Schaden, den man nicht
// sieht, braucht eine Prüfung, die ihn ansieht.
//
// GEDACHT FÜR DEN TÄGLICHEN LAUF. Er schreibt nichts und braucht keine
// Testdaten — er stellt eine Frage und beantwortet sie mit einer Zahl.
//
//   npx tsx scripts/pruef-stufen-waechter.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { personTierSql, antragBasisSql } from "../server/lib/tier";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}

async function main(): Promise<void> {
  log("\n══ Wächter: Einstufung ══\n");

  // ── 1. ALT GEGEN FRISCH ─────────────────────────────────────────────────
  // Der Altbestand muss deckungsgleich sein. Frisch Angefasste werden GEMELDET,
  // nicht gewertet: Zwischen einer Zahlung und dem nächsten Takt liegen bis zu
  // 20 Minuten, und ein Prüfstand, der den laufenden Betrieb mitmisst, wird
  // beim dritten Fehlalarm abgeschaltet (AGENTS.md).
  const [d] = (await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    SELECT
      COUNT(*) FILTER (WHERE p.updated_at < NOW() - INTERVAL '1 hour')::int AS alt,
      COUNT(*) FILTER (WHERE p.updated_at >= NOW() - INTERVAL '1 hour')::int AS frisch
    FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND (p.priority_tier IS DISTINCT FROM t.priority_tier
        OR p.tier_reason IS DISTINCT FROM t.tier_reason)
  `)) as any[];

  ok("Altbestand: 0 Abweichungen zwischen Spalte und Ableitung", Number(d.alt) === 0,
    `${d.alt} Personen — der Nachzug läuft nicht. Sofort prüfen: `
    + "scripts/tier-backfill.ts (Probelauf) und das Log auf „[FIAON-FOLLOWUP] !! Einstufung“");
  if (Number(d.frisch) > 0) {
    log(`  ${String(d.frisch).padStart(5)}  frisch angefasst — gemeldet, nicht gewertet (der Takt holt sie)`);
  }

  // ── 2. DIE HARTE GARANTIE ───────────────────────────────────────────────
  // Eine gemeldete oder eingegangene Zahlung darf NIE auf Stufe 3 (kalt) führen.
  // Das ist die Zusage aus dem Auftrag, und sie wird am BESTAND geprüft, nicht
  // an einem Prüffall.
  //
  // ── UND ZWAR IM SELBEN AUSSCHNITT WIE DIE ABLEITUNG ─────────────────────
  // Der erste Entwurf zählte JEDE Bestellung mit `payment_status = 'paid'` und
  // wurde rot: Person 5123 stand auf Stufe 3 mit einer bezahlten Bestellung.
  // Nachgesehen — die Ableitung sagt für sie ebenfalls Stufe 3, und zwar zu
  // Recht: Die bezahlte Bestellung ist ARCHIVIERT. `antragBasisSql` schließt
  // archivierte, zusammengeführte, ersetzte, DSGVO-gelöschte und Entwürfe aus,
  // weil sie fachlich nicht mehr existieren.
  //
  // Eine Prüfung mit einem WEITEREN Begriff als die geprüfte Regel meldet
  // Fehler, die es nicht gibt — und ein Wächter mit Fehlalarmen wird
  // abgeschaltet. Also derselbe Ausschnitt, aus derselben Funktion.
  const [kalt] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.priority_tier = 3
      AND p.updated_at < NOW() - INTERVAL '1 hour'
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id
          AND a.payment_status IN ('paid', 'claimed_paid')
          AND ${antragBasisSql("a")}
      )
  `)) as any[];
  ok("Keine Person mit Zahlung steht auf Stufe C (kalt)", Number(kalt.n) === 0,
    `${kalt.n} Personen`);

  // ── 3. BEZAHLTE HABEN EINEN ZUSTÄNDIGEN ─────────────────────────────────
  // Derselbe Ausschnitt wie oben: eine archivierte Zahlung macht niemanden zum
  // Kunden, der einen Zustaendigen braucht.
  const [ohne] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.assigned_agent_id IS NULL AND NOT p.is_blocked
      AND EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id
          AND a.payment_status IN ('paid', 'claimed_paid')
          AND ${antragBasisSql("a")}
      )
  `)) as any[];
  ok("Kein bezahlter Kunde ohne Zuständigen", Number(ohne.n) === 0, `${ohne.n} Personen`);

  // ── 4. LÄUFT DER TAGESLAUF ÜBERHAUPT? ───────────────────────────────────
  // Die Frage, die 15 Tage niemand gestellt hat. `followup_last_run` ist der
  // einzige Beleg dafür, dass der Lauf durchgekommen ist.
  const [s] = (await sqlPool`
    SELECT value FROM fiaon_settings WHERE key = 'followup_last_run'
  `) as any[];
  const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
  const stand = String(s?.value ?? "nie");
  const tageHer = stand === "nie" ? 9999
    : Math.round((new Date(`${heute}T00:00:00Z`).getTime() - new Date(`${stand}T00:00:00Z`).getTime()) / 86_400_000);
  log("");
  log(`  followup_last_run = ${stand}  (heute: ${heute}, Abstand ${tageHer === 9999 ? "nie gelaufen" : `${tageHer} Tage`})`);
  // Zwei Tage Toleranz: Ein Deploy am Morgen kostet legitim einen Lauf.
  ok("Der Tageslauf ist in den letzten 2 Tagen durchgekommen", tageHer <= 2,
    `letzter vollständiger Lauf vor ${tageHer === 9999 ? "— nie —" : `${tageHer} Tagen`}. `
    + "Die Einstufung läuft seit dem 30.08.2026 unabhängig davon (vor den Sperren), "
    + "aber Verteilung und Mahn-Staffel hängen weiter am 6-Uhr-Fenster.");

  // ── 5. DIE EINSTUFUNG HÄNGT NICHT AM TAGESFENSTER ───────────────────────
  // Quelltext-Prüfung: Der Nachzug muss VOR den Rückgaben stehen. Ein reiner
  // Datentest würde das nicht bemerken — er wäre grün, solange irgendwer den
  // Backfill von Hand angestoßen hat.
  const { readFileSync } = await import("node:fs");
  const q = readFileSync("server/routes/fiaon-followup.ts", "utf8");
  const iTier = q.indexOf("alleTierAktualisieren");
  const iStunde = q.indexOf("wienStunde !== LAUF_STUNDE");
  const iLock = q.indexOf('holeLock("followup_lock")');
  ok("Die Einstufung steht VOR der Stundensperre",
    iTier > 0 && iStunde > 0 && iTier < iStunde,
    `Einstufung bei ${iTier}, Stundensperre bei ${iStunde}`);
  ok("Die Einstufung steht VOR dem Lock",
    iTier > 0 && iLock > 0 && iTier < iLock,
    `Einstufung bei ${iTier}, Lock bei ${iLock}`);
  ok("Ein Fehler der Einstufung wird nicht verschluckt",
    /!! Einstufung fehlgeschlagen/.test(q));

  log(`\n══ Ergebnis: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen ══\n`);
  if (fehler.length > 0) {
    log("Fehlgeschlagen:");
    for (const f of fehler) log(`  · ${f}`);
    log("");
  }
  await sqlPool.end();
  process.exit(fehlgeschlagen > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
