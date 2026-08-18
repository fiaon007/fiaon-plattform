// ═══════════════════════════════════════════════════════════════════════════
// DOPPELPRÄFIX AUS DEN ROHWERTEN ENTFERNEN
//
// ── DER BEFUND (scripts/mess-doppelpraefix.ts, 30.08.2026) ─────────────────
// 39 Personen tragen in `primary_phone` eine Nummer wie „+49491787164939" —
// die Ländervorwahl steht zweimal drin. 0 Bestellungen sind betroffen.
//
// ── WIE DAS ENTSTANDEN IST ────────────────────────────────────────────────
// Nicht in der Oberfläche, sondern beim Zusammensetzen von Nummer und getrennter
// Vorwahl: `waehlbareNummer` Regel 2 hängt die Vorwahl vor die nationale Nummer
// und verwirft dabei nur eine führende NULL. Trug die Nummer die Vorwahl schon
// ohne „+" („491787164939") und stand daneben „+49", wurde daraus
// „+49" + „491787164939". Die Regel ist für den Normalfall richtig; sie hat nur
// den Fall nicht gekannt, in dem die Nummer die Vorwahl bereits enthält.
//
// ── WAS DIESER LAUF TUT ───────────────────────────────────────────────────
// Er entfernt die DOPPELTE Vorwahl, nichts anderes. Konkret: „+4949…" → „+49…",
// „+4343…" → „+43…". Und nur dann, wenn danach eine plausible Nummer übrig
// bleibt (Länge und Vorwahl passen zusammen) — sonst bleibt der Wert stehen und
// wird gemeldet.
//
// ── WARUM NICHT EINFACH `waehlbareNummer` DRÜBERLAUFEN LASSEN ─────────────
// Weil die Funktion einen Wert mit „+" ausdrücklich übernimmt (Regel 1) und
// dabei nur die Nichtziffern entfernt. Sie REPARIERT ein Doppelpräfix nicht —
// sie erhält es. Das ist auch richtig: Sie soll nicht raten, welches der beiden
// „+49" gemeint war. Hier wird ausdrücklich entschieden, und zwar einmal.
//
// ── SICHERHEITEN ──────────────────────────────────────────────────────────
//   1. Ohne `--schreiben` passiert nichts. Vorschau als CSV.
//   2. Alles in EINER Transaktion.
//   3. Zählprobe: danach 0 Werte mit Doppelpräfix im Altbestand.
//   4. Der alte Wert wird als Alias gesichert (nichts geht verloren, AGENTS.md).
//   5. Frischer Zugang (in der letzten Stunde angefasst) wird GEMELDET, nicht
//      gewertet — der Produktionsserver läuft möglicherweise noch mit dem
//      alten Code.
//
//   npx tsx scripts/doppelpraefix-bereinigen.ts              → Vorschau
//   npx tsx scripts/doppelpraefix-bereinigen.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Die Vorwahlen, in denen FIAON arbeitet — nur diese werden entdoppelt. */
const VORWAHLEN = ["49", "43", "41"];

/**
 * Entfernt eine doppelte Ländervorwahl. Gibt `null` zurück, wenn nichts zu tun
 * ist oder das Ergebnis nicht plausibel wäre.
 *
 * Plausibel heißt: Nach dem Kürzen bleiben mindestens 6 und höchstens 14 Ziffern
 * hinter der Vorwahl. Eine Nummer, die danach zu kurz ist, war nicht doppelt
 * präfixiert, sondern etwas anderes — und wird nicht angefasst.
 */
export function entdoppeln(roh: string | null): string | null {
  if (!roh) return null;
  const d = String(roh).replace(/\D/g, "");
  for (const vw of VORWAHLEN) {
    if (!d.startsWith(vw + vw)) continue;
    const rest = d.slice(vw.length);          // eine Vorwahl entfernen
    const national = rest.slice(vw.length);   // was hinter der zweiten steht
    if (national.length < 6 || national.length > 14) return null;
    return `+${rest}`;
  }
  return null;
}

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });
  log("\n══ Doppelpräfix bereinigen ══\n");

  const kandidaten = (await sqlPool`
    SELECT id, person_ref, primary_phone, updated_at,
           (updated_at > NOW() - INTERVAL '1 hour') AS frisch
    FROM fiaon_persons
    WHERE merged_into_person_id IS NULL
      AND (primary_phone ~ '\\+.*\\+'
           OR regexp_replace(COALESCE(primary_phone, ''), '\\D', '', 'g') ~ '^(49|43|41)\\1')
    ORDER BY id
  `) as any[];

  const alt = kandidaten.filter((k) => !k.frisch);
  const frisch = kandidaten.filter((k) => k.frisch);

  interface Plan { id: number; ref: string; ist: string; soll: string }
  const plan: Plan[] = [];
  const unklar: any[] = [];
  for (const k of alt) {
    const soll = entdoppeln(k.primary_phone);
    if (!soll) { unklar.push(k); continue; }
    plan.push({ id: Number(k.id), ref: String(k.person_ref), ist: String(k.primary_phone), soll });
  }

  log(`  ${String(kandidaten.length).padStart(5)}  Personen mit Doppelpräfix`);
  log(`  ${String(alt.length).padStart(5)}  davon Altbestand (älter als eine Stunde)`);
  log(`  ${String(frisch.length).padStart(5)}  davon FRISCH — nur gemeldet, nicht gewertet`);
  log(`  ${String(plan.length).padStart(5)}  eindeutig zu bereinigen`);
  log(`  ${String(unklar.length).padStart(5)}  unklar — bleiben stehen`);
  log("");
  for (const p of plan.slice(0, 15)) {
    log(`   Person ${String(p.id).padStart(6)}  „${p.ist}“  →  „${p.soll}“`);
  }
  if (plan.length > 15) log(`   … und ${plan.length - 15} weitere`);
  for (const u of unklar) {
    log(`   ! Person ${u.id}: „${u.primary_phone}“ — nicht eindeutig entdoppelbar`);
  }
  if (frisch.length > 0) {
    log("");
    log("  FRISCHER ZUGANG (Betreiber-TODO — der Server läuft evtl. noch mit altem Code):");
    for (const f of frisch) log(`   Person ${f.id}: „${f.primary_phone}“ (${f.updated_at})`);
  }

  writeFileSync("reports/doppelpraefix-bereinigen.csv",
    `person_id;person_ref;ist;soll\n${plan.map((p) => [p.id, p.ref, p.ist, p.soll].map(feld).join(";")).join("\n")}\n`,
    "utf8");
  log("");
  log("  Vorschau: reports/doppelpraefix-bereinigen.csv");

  if (!SCHREIBEN) {
    log("\n  Nur Vorschau — es wurde nichts geändert. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }
  if (plan.length === 0) {
    log("\n  Nichts zu schreiben.\n");
    await sqlPool.end();
    return;
  }

  class Zurueck extends Error {}
  let geaendert = 0;
  try {
    await sqlPool.begin(async (tx) => {
      for (const p of plan) {
        // Den alten Wert sichern — auch einen kaputten. Wer später fragt „warum
        // steht hier eine andere Nummer als im Antrag", findet die Antwort.
        await tx`
          INSERT INTO fiaon_person_aliases (person_id, kind, value_norm, value_raw, source, quelle_person_id)
          VALUES (${p.id}, 'phone', ${p.ist.replace(/\D/g, "").slice(-9)}, ${p.ist},
                  'doppelpraefix-bereinigung 30.08.2026', ${p.id})
          ON CONFLICT DO NOTHING
        `.catch((e) => log(`   (Alias Person ${p.id}: ${e?.message ?? e})`));

        const r = await tx`
          UPDATE fiaon_persons
          SET primary_phone = ${p.soll},
              phone_key9 = RIGHT(regexp_replace(${p.soll}, '\\D', '', 'g'), 9),
              updated_at = NOW()
          WHERE id = ${p.id} AND primary_phone = ${p.ist}
          RETURNING id
        `;
        geaendert += (r as any[]).length;
      }

      // ── ZÄHLPROBE: kein Doppelpräfix mehr im Altbestand ──────────────────
      const uebrig = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_persons
        WHERE merged_into_person_id IS NULL
          AND updated_at < NOW() - INTERVAL '1 hour'
          AND (primary_phone ~ '\\+.*\\+'
               OR regexp_replace(COALESCE(primary_phone, ''), '\\D', '', 'g') ~ '^(49|43|41)\\1')
      `) as any[];
      if (Number(uebrig[0].n) > 0) {
        log(`\n  !! Zählprobe: noch ${uebrig[0].n} Werte mit Doppelpräfix. Nichts geändert.\n`);
        throw new Zurueck();
      }
      log(`\n  Zählprobe: 0 Werte mit Doppelpräfix im Altbestand. ✓`);
    });
    log(`  ${geaendert} Nummern bereinigt, alte Werte als Alias gesichert.\n`);
  } catch (e) {
    if (!(e instanceof Zurueck)) throw e;
    process.exitCode = 1;
  }
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
