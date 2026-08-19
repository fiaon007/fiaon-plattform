// ═══════════════════════════════════════════════════════════════════════════
// ANRUFE ZUR RICHTIGEN PERSON — ODER EHRLICH ALS „UNKLAR"
//
// ── DER AUFTRAG (19.08.2026) ───────────────────────────────────────────────
// „Wochenlang wurde person_id aus der offenen Karte gespeichert statt aus der
// gewählten Nummer. Die Anzeige ist repariert — die ALTEN Zeilen nicht.
// Eindeutige Nummer-Treffer umhängen, kein Treffer → Marke ‚Zuordnung unklar'."
//
// ── DIE MESSUNG WIDERSPRICHT DER ERWARTUNG ────────────────────────────────
// Erwartet wurde ein Massenbestand. GEMESSEN über alle 1.608 Anrufe
// (`scripts/mess-anruf-vertauscht.ts`):
//
//     1.584  Nummer gehört zur verknüpften Person
//         3  gehört NICHT dazu
//        19  ohne Person (unbekannte Nummer — kein Fehler)
//
// Nach Tagen: Abweichungen am 10., 11. und 12.08., danach 0 %. Der Fix vom
// 17.08. (Commit 7a91c8c) wirkt — und die drei Fälle liegen davor.
//
// Und keiner der drei lässt sich umhängen: Zu keiner der drei gewählten Nummern
// gehört eine Person im Bestand. Es gibt also nichts zu „reparieren", nur etwas
// zu KENNZEICHNEN.
//
// Der Lauf bleibt trotzdem — er ist die Hand zur Wand: Findet
// `pruef-anruf-zuordnung.ts` morgen neue Abweichungen, hängt dieser Lauf sie um
// oder markiert sie.
//
//   npx tsx scripts/anruf-zuordnung-bereinigen.ts              # Vorschau
//   npx tsx scripts/anruf-zuordnung-bereinigen.ts --schreiben  # anwenden
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { sqlPool } from "../server/lib/db-pool";
import { NUMMER_PASST_SQL, key9Sql } from "../server/lib/fiaon-anruf-pruefung";

const SCHREIBEN = process.argv.includes("--schreiben");
const STAPEL = `anruf-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString("hex")}`;
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }

async function main(): Promise<void> {
  titel(`ANRUF-ZUORDNUNG BEREINIGEN — ${SCHREIBEN ? "SCHREIBEND" : "VORSCHAU"}`);
  if (SCHREIBEN) log(`  Stapel: ${STAPEL} (Rückabwicklung über person_vorher_id)`);

  // Jede falsch verknüpfte Zeile mit ihrem Ziel — oder ohne.
  const faelle = (await sqlPool.unsafe(`
    WITH falschzu AS (
      SELECT k.id, k.beginn, k.nummer, k.person_id, k.agent_id, k.richtung, k.ref,
             ${key9Sql("k.nummer")} AS key9,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, '(ohne Namen)') AS falscher_name
        FROM fiaon_calls k
        LEFT JOIN fiaon_persons p ON p.id = k.person_id
       WHERE k.person_id IS NOT NULL
         AND (${NUMMER_PASST_SQL("k", "p")}) IS FALSE
         AND k.zuordnung_unklar_am IS NULL
         AND k.umgehaengt_am IS NULL
    )
    SELECT f.*, t.treffer, t.ziel_id, t.ziel_name, t.ziel_ref
      FROM falschzu f
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS treffer,
               MIN(kd.id) AS ziel_id,
               MIN(COALESCE(NULLIF(TRIM(CONCAT_WS(' ', kd.first_name, kd.last_name)), ''),
                            kd.company_name)) AS ziel_name,
               MIN((SELECT a.ref FROM fiaon_applications a
                     WHERE a.person_id = kd.id AND a.merged_into IS NULL
                     ORDER BY a.created_at DESC LIMIT 1)) AS ziel_ref
          FROM fiaon_persons kd
         WHERE kd.merged_into_person_id IS NULL
           AND LENGTH(f.key9) = 9
           AND (kd.phone_key9 = f.key9
                OR ${key9Sql("kd.primary_phone")} = f.key9
                OR EXISTS (SELECT 1 FROM fiaon_person_aliases al
                            WHERE al.person_id = kd.id AND al.kind = 'phone'
                              AND ${key9Sql("al.value_norm")} = f.key9))
      ) t ON TRUE
     ORDER BY f.beginn DESC
  `)) as any[];

  const umhaengen = faelle.filter((f) => Number(f.treffer) === 1 && f.ziel_id);
  const unklar = faelle.filter((f) => Number(f.treffer ?? 0) !== 1 || !f.ziel_id);

  log(`\n  ${faelle.length} Anrufe tragen eine Person, deren Nummer nicht die gewählte ist.`);
  log(`  ${umhaengen.length} davon EINDEUTIG umhängbar (die Nummer trifft genau eine Person).`);
  log(`  ${unklar.length} bekommen die Marke „Zuordnung unklar".`);

  if (faelle.length > 0) {
    log("\n  Anruf  Datum        gewählte Nummer      steht bei                 Wirkung");
    log("  " + "─".repeat(88));
    for (const f of faelle) {
      const d = new Date(f.beginn).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
      const wirkung = Number(f.treffer) === 1 && f.ziel_id
        ? `→ ${String(f.ziel_name ?? f.ziel_id).slice(0, 26)}`
        : Number(f.treffer ?? 0) === 0 ? "Marke unklar (keine Person zur Nummer)"
          : `Marke unklar (${f.treffer} Personen zur Nummer)`;
      log(`  ${String(f.id).padStart(5)}  ${d.padEnd(11)}  ${String(f.nummer ?? "").padEnd(20)} `
        + `${String(f.falscher_name).slice(0, 24).padEnd(25)} ${wirkung}`);
    }
  }

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/anruf-zuordnung-bereinigen.csv", "\uFEFF"
    + ["anruf_id;beginn;nummer;steht_bei_person;steht_bei_name;treffer;ziel_person;ziel_name;wirkung"]
      .concat(faelle.map((f) => [f.id,
        new Date(f.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }),
        f.nummer, f.person_id, f.falscher_name, f.treffer ?? 0,
        Number(f.treffer) === 1 ? f.ziel_id : "", Number(f.treffer) === 1 ? (f.ziel_name ?? "") : "",
        Number(f.treffer) === 1 ? "umgehaengt" : "Marke unklar"].join(";")))
      .join("\n"));
  log(`\n  → reports/anruf-zuordnung-bereinigen.csv (${faelle.length} Zeilen)`);

  if (!SCHREIBEN) {
    log("\n  Das ist die VORSCHAU. Es wurde nichts geändert.");
    log("  Anwenden mit: npx tsx scripts/anruf-zuordnung-bereinigen.ts --schreiben");
    await zaehlprobe();
    await sqlPool.end();
    return;
  }

  // ── UMHÄNGEN: DER ANRUF UND ALLES, WAS AN IHM HÄNGT ─────────────────────
  // Aufnahme, Transkript und Zusammenfassung stehen in DERSELBEN Zeile — sie
  // wandern also mit, ohne dass man sie anfassen muss. Was NICHT in der Zeile
  // steht, ist der Verlaufseintrag: Der hängt über `ref` an der Bestellung der
  // falschen Person und muss einzeln umgesetzt werden.
  let a = 0;
  let vl = 0;
  for (const f of umhaengen) {
    const erg = await sqlPool`
      UPDATE fiaon_calls
         SET person_id = ${Number(f.ziel_id)},
             ref = ${f.ziel_ref ?? null},
             person_vorher_id = ${Number(f.person_id)},
             umgehaengt_am = NOW(),
             umgehaengt_stapel = ${STAPEL},
             updated_at = NOW()
       WHERE id = ${Number(f.id)} AND person_id = ${Number(f.person_id)}
    `;
    if ((erg as any).count === 0) continue;
    a++;

    // Der Verlaufseintrag an der FALSCHEN Akte: soft entfernen (kein
    // Hard-Delete, AGENTS.md) und an der richtigen neu setzen.
    if (f.ref) {
      const weg = await sqlPool`
        UPDATE fiaon_contact_log
           SET voided_at = NOW(),
               note = COALESCE(note, '') || ' [Zuordnung korrigiert: Der Anruf gehörte '
                      || 'zu einer anderen Person — Stapel ${sqlPool.unsafe(STAPEL)}]'
         WHERE ref = ${f.ref} AND voided_at IS NULL
           AND created_at BETWEEN ${f.beginn}::timestamptz - INTERVAL '5 minutes'
                              AND ${f.beginn}::timestamptz + INTERVAL '45 minutes'
      `.catch((e) => { console.error(`[BEREINIGEN] Verlauf ${f.ref}:`, e); return { count: 0 } as any; });
      vl += Number((weg as any).count || 0);
    }
    if (f.ziel_ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${f.ziel_ref}, ${Number(f.ziel_id)}, ${f.agent_id ?? null}, 'System', 'system',
                ${`Anruf vom ${new Date(f.beginn).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} `
                  + `(Nummer ${f.nummer}) wurde hierher umgehängt — er stand bei „${f.falscher_name}". `
                  + `Ursache: Bis zum 17.08.2026 speicherte die Wähl-Route die offene Karte statt der `
                  + `gewählten Nummer. Stapel ${STAPEL}.`}, NOW())
      `.catch((e) => console.error(`[BEREINIGEN] Neuer Verlaufseintrag ${f.ziel_ref}:`, e));
    }
  }
  log(`\n  ${a} Anrufe umgehängt (samt Aufnahme, Transkript und Zusammenfassung).`);
  log(`  ${vl} Verlaufseinträge an fremden Akten zurückgezogen und neu gesetzt.`);

  // ── MARKE FÜR DIE UNENTSCHEIDBAREN ──────────────────────────────────────
  let m = 0;
  for (const f of unklar) {
    const grund = Number(f.treffer ?? 0) === 0
      ? `Die gewählte Nummer ${f.nummer} gehört zu keiner Person im Bestand. `
        + `Der Anruf stand bei „${f.falscher_name}" — das war die Karte, die beim `
        + "Wählen offen war (Fehler bis 17.08.2026), nicht der angerufene Mensch."
      : `Die gewählte Nummer ${f.nummer} gehört zu ${f.treffer} Personen. `
        + "Ein Umhängen wäre geraten, und ein geratener Anruf ist schlimmer als ein unklarer.";
    const erg = await sqlPool`
      UPDATE fiaon_calls
         SET zuordnung_unklar_am = NOW(), zuordnung_unklar_grund = ${grund}, updated_at = NOW()
       WHERE id = ${Number(f.id)} AND zuordnung_unklar_am IS NULL
    `;
    if ((erg as any).count > 0) m++;
  }
  log(`  ${m} Anrufe als „Zuordnung unklar" gekennzeichnet — sie zeigen keinen Namen mehr.`);

  await zaehlprobe();
  await sqlPool.end();
}

/** Nach dem Lauf darf keine Zeile mehr falsch verknüpft UND unmarkiert sein. */
async function zaehlprobe(): Promise<void> {
  titel("ZÄHLPROBE");
  const [z] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS offen
      FROM fiaon_calls k
      LEFT JOIN fiaon_persons p ON p.id = k.person_id
     WHERE k.person_id IS NOT NULL
       AND (${NUMMER_PASST_SQL("k", "p")}) IS FALSE
       AND k.zuordnung_unklar_am IS NULL
  `)) as any[];
  const n = Number(z.offen);
  log(`\n  ${n} Anrufe sind falsch verknüpft UND ohne Marke — `
    + `${n === 0 ? "Zählprobe bestanden." : "NICHT bestanden."}`);
  const [m] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE zuordnung_unklar_am IS NOT NULL
  `) as any[];
  const [u] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_calls WHERE umgehaengt_am IS NOT NULL
  `) as any[];
  log(`  ${m.n} mit Marke „Zuordnung unklar" · ${u.n} umgehängt (insgesamt, über alle Läufe).`);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
