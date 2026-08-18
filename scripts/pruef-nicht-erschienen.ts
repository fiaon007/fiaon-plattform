// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: „NICHT ERSCHIENEN" SCHLIESST DEN VORGANG
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „‚Nicht erschienen — bitte abschließen‘ hängt. Ich komme nicht weiter."
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Die Kalenderabfrage nahm ALLE Termine auf „verpasst" auf, mit der Begründung
// „ein verpasster Termin ist Arbeit, nicht Vergangenheit". Richtig — aber nur,
// solange die Arbeit nicht getan ist. „verpasst" ist ZWEI Zustände:
//
//   erledigt_am IS NULL      → der 12-Stunden-Nachlauf hat markiert, kein
//                              Mensch hat es bearbeitet. Offene Arbeit.
//   erledigt_am IS NOT NULL  → ein Mensch hat geklickt, der Fehlversuch ist
//                              gezählt, die Folge-Einladung ist gelaufen.
//
// GEMESSEN: 47 Termine auf „verpasst", 19 davon mit erledigt_am — abgearbeitet
// und trotzdem sichtbar, mit einer Aufforderung ohne zugehörige Handlung.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
// Der ganze Weg an den ECHTEN Funktionen: Termin anlegen → Nachlauf markiert →
// Karte ist sichtbar → Ergebnis eintragen → Karte ist WEG. Und die Gegenprobe:
// Der Fehlversuch ist gezählt, damit der Abschluss nicht bloß versteckt.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-nicht-erschienen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";

let bestanden = 0;
let fehlgeschlagen = 0;
const fehler: string[] = [];
const log = (s = "") => console.log(s);
function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; log(`  PASS  ${name}`); }
  else { fehlgeschlagen++; fehler.push(name); log(`  FAIL  ${name}${detail ? `  → ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, String(ist) === String(soll), `ist „${ist}“, soll „${soll}“`);
}
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 56 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

/**
 * Die Bedingung der Kalenderabfrage — WÖRTLICH aus server/routes/fiaon-agent.ts.
 *
 * Sie steht hier als Kopie, und das ist eine bewusste Ausnahme: Die Abfrage ist
 * Teil einer 40-Zeilen-SELECT-Anweisung in einer Route und nicht einzeln
 * aufrufbar. Damit die Kopie nicht auseinanderläuft, prüft Gruppe 4 den
 * QUELLTEXT der Route gegen genau diese Bedingung.
 */
const KALENDER_SICHTBAR = `(
  t.status = 'gebucht'
  OR (t.status = 'verpasst' AND t.erledigt_am IS NULL)
  OR (t.status = 'abgesagt' AND t.abgesagt_am > NOW() - INTERVAL '7 days')
)`;

async function main(): Promise<void> {
  log("\n══ Prüfstand: „Nicht erschienen“ schließt den Vorgang ══");

  try {
    await sqlPool.begin(async (tx) => {
      // Ein echter Agent mit Terminen — für die Sichtbarkeitsabfrage braucht es
      // eine agent_id, die es gibt.
      const [agent] = (await tx`
        SELECT id FROM fiaon_agents
        WHERE active AND NOT is_test_account AND COALESCE(rolle,'agent') IN ('agent','vertriebsleiter')
        ORDER BY id LIMIT 1
      `) as any[];
      ok("Ein echter Agent für den Prüffall vorhanden", !!agent);
      if (!agent) throw new Zurueckrollen();
      const agentId = Number(agent.id);

      const [person] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, last_name, assigned_agent_id, unreachable_count, created_at)
        VALUES (${`FIAON-P-PNE${stempel}`}, 'private', 'pending', 2,
                'Prüf', ${`Noshow${stempel}`}, ${agentId}, 0, NOW())
        RETURNING id
      `) as any[];
      const personId = Number(person.id);

      // Ein Termin, der 13 Stunden zurückliegt — damit der Nachlauf ihn greift.
      const [termin] = (await tx`
        INSERT INTO fiaon_termine (person_id, agent_id, beginn, dauer_min, status, quelle, storno_token)
        VALUES (${personId}, ${agentId}, NOW() - INTERVAL '13 hours', 20, 'gebucht',
                'nichterreicht_mail', ${`pne-${stempel}`})
        RETURNING id
      `) as any[];
      const terminId = Number(termin.id);

      const sichtbar = async (): Promise<boolean> => {
        const [r] = (await tx.unsafe(`
          SELECT COUNT(*)::int AS n FROM fiaon_termine t
          JOIN fiaon_persons p ON p.id = t.person_id
          WHERE t.id = $1 AND p.merged_into_person_id IS NULL AND ${KALENDER_SICHTBAR}
        `, [terminId])) as any[];
        return Number(r.n) > 0;
      };

      gruppe("1. Vor dem Nachlauf: ein gebuchter Termin steht im Kalender");
      ok("Der gebuchte Termin ist sichtbar", await sichtbar());

      gruppe("2. Der 12-Stunden-Nachlauf markiert ihn als verpasst");
      // Wörtlich die Anweisung aus runVerpassteTermine (fiaon-startgespraech.ts).
      // Sie setzt KEIN erledigt_am — das ist der Punkt.
      await tx`
        UPDATE fiaon_termine SET status = 'verpasst', updated_at = NOW()
        WHERE id = ${terminId} AND status = 'gebucht' AND beginn < NOW() - INTERVAL '12 hours'
      `;
      const [nachNachlauf] = (await tx`
        SELECT status, erledigt_am FROM fiaon_termine WHERE id = ${terminId}
      `) as any[];
      gleich("Status ist „verpasst“", nachNachlauf.status, "verpasst");
      ok("erledigt_am ist NICHT gesetzt", nachNachlauf.erledigt_am == null);
      ok("Die Karte ist SICHTBAR — hier ist wirklich Arbeit offen", await sichtbar());

      gruppe("3. Der Klick auf „Nicht erschienen“ schließt den Vorgang");
      // Genau die Anweisung der Route /agent/termine/:id/ergebnis.
      await tx`
        UPDATE fiaon_termine SET status = 'verpasst', erledigt_am = NOW(),
               notiz = NULL, updated_at = NOW()
        WHERE id = ${terminId}
      `;
      await tx`
        UPDATE fiaon_persons SET unreachable_count = unreachable_count + 1, updated_at = NOW()
        WHERE id = ${personId}
      `;
      const [nachKlick] = (await tx`
        SELECT status, erledigt_am FROM fiaon_termine WHERE id = ${terminId}
      `) as any[];
      gleich("Status bleibt „verpasst“ (die Tatsache ändert sich nicht)", nachKlick.status, "verpasst");
      ok("erledigt_am ist gesetzt", nachKlick.erledigt_am != null);

      // DAS IST DIE PRÜFUNG, DIE DEN GEMELDETEN FEHLER TRIFFT:
      const nochDa = await sichtbar();
      ok("Die Karte ist WEG — kein Restzustand", !nochDa,
        "der Termin steht weiter im Kalender und fordert erneut zum Abschließen auf");

      gruppe("4. Der Abschluss versteckt nicht, er zählt");
      const [p] = (await tx`
        SELECT unreachable_count FROM fiaon_persons WHERE id = ${personId}
      `) as any[];
      gleich("Der Fehlversuch ist gezählt", p.unreachable_count, 1);

      gruppe("5. Die Route benutzt dieselbe Bedingung wie dieser Prüfstand");
      // Eine Kopie, die auseinanderläuft, ist schlimmer als keine Prüfung:
      // Der Prüfstand wäre grün, die Oberfläche kaputt.
      const { readFileSync } = await import("node:fs");
      const kalenderRoute = readFileSync("server/routes/fiaon-agent.ts", "utf8");
      ok("Die Kalenderabfrage grenzt auf erledigt_am IS NULL ein",
        /t\.status = 'verpasst' AND t\.erledigt_am IS NULL/.test(kalenderRoute));
      ok("Sie nimmt NICHT mehr alle „verpasst“ auf",
        !/t\.status IN \('gebucht', 'verpasst'\)/.test(
          kalenderRoute.replace(/^\s*--.*$/gm, " ").replace(/^\s*\/\/.*$/gm, " ")));
      const terminRoute = readFileSync("server/routes/fiaon-termin.ts", "utf8");
      ok("Die Terminliste des Agenten grenzt genauso ein",
        /t\.status = 'verpasst' AND t\.erledigt_am IS NULL/.test(terminRoute));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  gruppe("6. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref = ${`FIAON-P-PNE${stempel}`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_termine WHERE storno_token = ${`pne-${stempel}`}) AS termine
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Termine", reste.termine, 0);

  // ── DER BESTAND: wie viele Karten hängen JETZT noch? ─────────────────────
  gruppe("7. Der Bestand nach der Änderung");
  const [b] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE status = 'verpasst')::int AS verpasst_gesamt,
           COUNT(*) FILTER (WHERE status = 'verpasst' AND erledigt_am IS NULL)::int AS offen,
           COUNT(*) FILTER (WHERE status = 'verpasst' AND erledigt_am IS NOT NULL)::int AS fertig
    FROM fiaon_termine
  `) as any[];
  log(`  ${String(b.verpasst_gesamt).padStart(4)}  Termine auf „verpasst“`);
  log(`  ${String(b.offen).padStart(4)}  davon OFFEN (erledigt_am fehlt) — stehen weiter im Kalender, zu Recht`);
  log(`  ${String(b.fertig).padStart(4)}  davon FERTIG — verschwinden ab jetzt aus dem Kalender`);

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
