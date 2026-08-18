// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ZUTEILUNG UND DIE ROLLEN
//
// ── WARUM ES DIESEN PRÜFSTAND GIBT ─────────────────────────────────────────
// Am 30.08.2026 sollte die Lücke „bezahlte Kunden ohne Betreuer" geschlossen
// werden (gemessen: 88 Personen). Zwei Änderungen waren nötig:
//   1. Stufe 0 (bezahlt) nimmt an der Zuteilung teil.
//   2. Greift der Besitzschutz, wird der dokumentierte Betreuer EINGETRAGEN,
//      statt die Person bei niemandem zu lassen.
//
// Der erste Entwurf von (2) hat dabei prompt einen Schaden angerichtet: Er
// fragte nur „aktiv und kein Testkonto" und schrieb daraufhin 28 bezahlte
// Kunden dem FORDERUNGSMANAGEMENT zu (Hans-Jürgen Gerhold, Diana Zeller). Denn
// `betreuerVon` liest JEDEN dokumentierten Kontakt — und wer eine Rate
// eingetrieben hat, steht eben auch im Verlauf.
//
// Das widerspricht einer Regel, die seit dem 11.08.2026 im Code steht: „Das
// Forderungsmanagement hat NUR die Kunden, die ihr Abo nicht bezahlt haben."
// Die 28 wurden zurückgenommen und neu verteilt.
//
// Ein Fehler, den ich selbst gemacht habe, braucht keine Erinnerung, sondern
// eine Wand. Dieser Prüfstand ist die Wand.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-zuteilung-rollen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { sofortZuteilen } from "../server/lib/fiaon-zuteilung";
import { personTierSql } from "../server/lib/tier";

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
const REF = (s: string) => `FIAON-PZR${stempel}-${s}`;

async function main(): Promise<void> {
  log("\n══ Prüfstand: Zuteilung und Rollen ══");

  try {
    await sqlPool.begin(async (tx) => {
      // Ein Inkasso-Mensch und ein Vertriebs-Mensch, beide echt und aktiv.
      const [inkasso] = (await tx`
        SELECT id, name FROM fiaon_agents
        WHERE rolle = 'inkasso' AND active AND NOT is_test_account ORDER BY id LIMIT 1
      `) as any[];
      const [vertrieb] = (await tx`
        SELECT id, name FROM fiaon_agents
        WHERE COALESCE(rolle,'agent') IN ('agent','vertriebsleiter')
          AND active AND distribution_active AND NOT is_test_account ORDER BY id LIMIT 1
      `) as any[];
      ok("Ein Inkasso-Mensch für den Prüffall vorhanden", !!inkasso);
      ok("Ein verteilender Vertriebs-Mensch vorhanden", !!vertrieb);
      if (!inkasso || !vertrieb) throw new Zurueckrollen();

      const person = async (felder: Record<string, unknown>): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons ${tx({
            person_ref: `FIAON-P-PZR${stempel}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
            kind: "private", account_status: "pending", ...felder,
          } as any)} RETURNING id
        `;
        return Number(r.id);
      };
      const bestellung = async (ref: string, personId: number, status: string) => {
        await tx`
          INSERT INTO fiaon_applications (ref, person_id, type, status, payment_status,
                                          pack_key, pack_name, amount_due, created_at)
          VALUES (${ref}, ${personId}, 'private', 'completed', ${status},
                  'ultra', 'FIAON Ultra', '79.99', NOW())
        `;
      };
      const kontakt = async (ref: string, agentId: number, name: string) => {
        await tx`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, created_at)
          VALUES (${ref}, ${agentId}, ${name}, 'result', 'erreicht', 'Prüfstand', NOW())
        `;
      };

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Ein BEZAHLTER ohne Betreuer bekommt einen");
      // ═══════════════════════════════════════════════════════════════════
      // Das war die Lücke: Stufe 0 war von der Zuteilung ausgeschlossen.
      const pBezahlt = await person({
        first_name: "Prüf", last_name: `Bezahlt${stempel}`, priority_tier: 0, tier_reason: "bezahlt",
      });
      await bestellung(REF("BEZAHLT"), pBezahlt, "paid");
      const eBezahlt = await sofortZuteilen(pBezahlt, tx as any);
      ok("Stufe 0 wird zugeteilt", eBezahlt.zugeteilt, `grund: ${eBezahlt.grund}`);
      const [nachBezahlt] = (await tx`
        SELECT p.assigned_agent_id, ag.rolle FROM fiaon_persons p
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id WHERE p.id = ${pBezahlt}
      `) as any[];
      ok("… an einen Vertriebsmenschen",
        ["agent", "vertriebsleiter"].includes(String(nachBezahlt?.rolle)),
        `Rolle: ${nachBezahlt?.rolle}`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. DIE WAND: ein Inkasso-Kontakt macht niemanden zum Betreuer");
      // ═══════════════════════════════════════════════════════════════════
      // Genau der Schaden vom 30.08.2026. Die Person hat `betreuung_seit` und
      // im Verlauf NUR einen Inkasso-Menschen. Sie darf NICHT ihm zufallen.
      const pInkasso = await person({
        first_name: "Prüf", last_name: `Inkassokontakt${stempel}`,
        priority_tier: 0, tier_reason: "bezahlt", betreuung_seit: new Date().toISOString(),
      });
      await bestellung(REF("INK"), pInkasso, "paid");
      await kontakt(REF("INK"), Number(inkasso.id), String(inkasso.name));
      const eInkasso = await sofortZuteilen(pInkasso, tx as any);
      const [nachInkasso] = (await tx`
        SELECT p.assigned_agent_id, ag.rolle, ag.name FROM fiaon_persons p
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id WHERE p.id = ${pInkasso}
      `) as any[];
      ok("Die Person wird zugeteilt (nicht liegengelassen)", eInkasso.zugeteilt,
        `grund: ${eInkasso.grund}`);
      ok("NICHT an das Forderungsmanagement",
        String(nachInkasso?.rolle) !== "inkasso",
        `zugeteilt an ${nachInkasso?.name} (${nachInkasso?.rolle})`);
      ok("… sondern an einen Vertriebsmenschen",
        ["agent", "vertriebsleiter"].includes(String(nachInkasso?.rolle)),
        `Rolle: ${nachInkasso?.rolle}`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Ein VERTRIEBS-Kontakt wird sehr wohl nachgetragen");
      // ═══════════════════════════════════════════════════════════════════
      // Die Wand darf nicht zu breit sein: Wer dokumentiert vom Vertrieb
      // betreut wurde, gehört ihm — und das soll auch eingetragen werden,
      // statt die Person der kleinsten Last zu geben.
      const pVertrieb = await person({
        first_name: "Prüf", last_name: `Vertriebskontakt${stempel}`,
        priority_tier: 0, tier_reason: "bezahlt", betreuung_seit: new Date().toISOString(),
      });
      await bestellung(REF("VER"), pVertrieb, "paid");
      await kontakt(REF("VER"), Number(vertrieb.id), String(vertrieb.name));
      const eVertrieb = await sofortZuteilen(pVertrieb, tx as any);
      ok("Wird zugeteilt", eVertrieb.zugeteilt, `grund: ${eVertrieb.grund}`);
      gleich("… und zwar an den dokumentierten Vertriebs-Betreuer",
        eVertrieb.agentId, Number(vertrieb.id));

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Stufe 3 bleibt draußen (Lead-Verteilung ist zuständig)");
      // ═══════════════════════════════════════════════════════════════════
      const pLead = await person({
        first_name: "Prüf", last_name: `Lead${stempel}`, priority_tier: 3, tier_reason: "nur_lead",
      });
      const eLead = await sofortZuteilen(pLead, tx as any);
      ok("Stufe 3 wird NICHT über diese Zuteilung vergeben", !eLead.zugeteilt,
        `grund: ${eLead.grund}`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Zahlung erzwingt die Stufe — die Ableitung garantiert es");
      // ═══════════════════════════════════════════════════════════════════
      // Die harte Garantie, die der Auftrag verlangt: Eine gemeldete Zahlung
      // darf niemals auf Stufe C führen. Geprüft an der ABLEITUNG, nicht an der
      // gespeicherten Spalte — die Spalte ist ein Merker, keine Wahrheit.
      const faelle: Array<[string, string, number]> = [
        ["claimed_paid", "Zahlung gemeldet", 1],
        ["paid", "Zahlung eingegangen", 0],
        ["pending_payment", "Rechnung offen", 2],
      ];
      for (const [status, titel, sollStufe] of faelle) {
        const pid = await person({
          first_name: "Prüf", last_name: `Stufe${status}${stempel}`,
          priority_tier: 3, tier_reason: "nur_lead",
        });
        await bestellung(REF(`ST-${status}`), pid, status);
        const [abgeleitet] = (await tx.unsafe(`
          WITH soll AS (${personTierSql()})
          SELECT priority_tier, tier_reason FROM soll WHERE person_id = $1
        `, [pid])) as any[];
        gleich(`${titel} → Stufe ${sollStufe}`, abgeleitet?.priority_tier, sollStufe);
        ok(`${titel} führt NIE auf Stufe 3 (kalt)`,
          Number(abgeleitet?.priority_tier) !== 3,
          `abgeleitet: ${abgeleitet?.priority_tier} (${abgeleitet?.tier_reason})`);
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("6. Der Bestand: keine Vertriebskunden bei Sonderrollen");
  // ═════════════════════════════════════════════════════════════════════════
  // Bestandsprüfung, getrennt nach Alt und Frisch (AGENTS.md): Der Altbestand
  // muss sauber sein, frischer Zugang wird gemeldet.
  const [sonder] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE p.assigned_at < NOW() - INTERVAL '1 hour'
                              OR p.assigned_at IS NULL)::int AS alt
    FROM fiaon_persons p JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND COALESCE(ag.rolle, 'agent') NOT IN ('agent', 'vertriebsleiter')
      AND ag.active AND NOT ag.is_test_account
      AND p.priority_tier BETWEEN 0 AND 2
  `) as any[];
  log(`  ${sonder.gesamt} Personen bei einer Sonderrolle (${sonder.alt} davon Altbestand)`);
  ok("Höchstens eine Handvoll bei Sonderrollen (Bestand, geduldet)",
    Number(sonder.gesamt) < 10,
    `${sonder.gesamt} — bei mehr als 10 hat die Zuteilung wieder Rollen vermischt`);

  const [ohne] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.assigned_agent_id IS NULL AND NOT p.is_blocked
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id
                  AND a.merged_into IS NULL AND a.payment_status IN ('paid','claimed_paid'))
  `) as any[];
  gleich("Bezahlte ohne Zuständigen", ohne.n, 0);

  const [drift] = (await sqlPool.unsafe(`
    WITH soll AS (${personTierSql()})
    SELECT COUNT(*)::int AS n
    FROM fiaon_persons p JOIN soll s ON s.person_id = p.id
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
      AND p.updated_at < NOW() - INTERVAL '1 hour'
      AND p.priority_tier IS DISTINCT FROM s.priority_tier
  `)) as any[];
  gleich("Altbestand: gespeicherte Stufe = Ableitung", drift.n, 0);

  gruppe("7. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PZR${stempel}%`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_applications WHERE ref LIKE ${`FIAON-PZR${stempel}%`}) AS bestellungen
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Bestellungen", reste.bestellungen, 0);

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
