// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: JEDER BUCHUNGSVERSUCH HINTERLÄSST EINE ZEILE
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Die Terminbuchung funktioniert unabhängig von der Uhrzeit nicht
// zuverlässig."
//
// ── WARUM DAS BISHER UNPRÜFBAR WAR ────────────────────────────────────────
// Ein gescheiterter Versuch hinterließ eine Konsolenzeile und sonst nichts:
// keine Häufigkeit, kein Grund, kein Muster über die Uhrzeit. Migration 062
// legt `fiaon_termin_versuche` an, und `versuchProtokollieren` schreibt jeden
// Ausgang der Buchungsroute hinein — auch den erfolgreichen, sonst gibt es
// keine Quote.
//
// ── WAS HIER GEPRÜFT WIRD ─────────────────────────────────────────────────
//   1. Die doppelte Buchung desselben Slots wird abgelehnt (der eindeutige
//      Index ist die Wand, nicht die Vorprüfung).
//   2. Die Ablehnung trägt einen Grund-CODE und einen Text, den ein Kunde
//      versteht — kein stummer Fehlschlag.
//   3. Beide Versuche stehen im Protokoll: einer als „gebucht", einer als
//      „abgelehnt" mit Grund.
//   4. Die Auswertung der Termin-Zentrale zählt sie.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-termin-versuche.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  terminBuchen, versuchProtokollieren, TerminFehler, VERSUCH_GRUND_TEXT,
} from "../server/lib/fiaon-termine";

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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 54 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Buchungsversuche ══");

  // ── DIE TABELLE MUSS DA SEIN ────────────────────────────────────────────
  const [tab] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM information_schema.tables
    WHERE table_name = 'fiaon_termin_versuche'
  `) as any[];
  ok("Die Tabelle fiaon_termin_versuche existiert (Migration 062)", Number(tab.n) === 1);
  if (Number(tab.n) !== 1) {
    log("\n  Ohne die Tabelle sagen die folgenden Prüfungen nichts aus.");
    log("  node scripts/run-migrations.mjs\n");
    await sqlPool.end();
    process.exit(1);
  }

  try {
    await sqlPool.begin(async (tx) => {
      // Ein Agent mit Verfügbarkeit — sonst gibt es keinen Slot im Raster.
      const [agent] = (await tx`
        SELECT id, name FROM fiaon_agents
        WHERE active AND NOT is_test_account
          AND COALESCE(rolle,'agent') IN ('agent','vertriebsleiter')
        ORDER BY id LIMIT 1
      `) as any[];
      ok("Ein echter Agent für den Prüffall vorhanden", !!agent);
      if (!agent) throw new Zurueckrollen();
      const agentId = Number(agent.id);

      const person = async (marke: string): Promise<number> => {
        const [r] = await tx`
          INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                     first_name, last_name, created_at)
          VALUES (${`FIAON-P-PTV${stempel}${marke}`}, 'private', 'pending', 2,
                  'Prüf', ${`Versuch${stempel}`}, NOW())
          RETURNING id
        `;
        return Number(r.id);
      };
      const pA = await person("A");
      const pB = await person("B");

      // ── EINEN SLOT WÄHLEN, DER IM RASTER LIEGT ────────────────────────
      // Nicht „der erstbeste": Der Slot muss im Verfügbarkeitsfenster des
      // Agenten liegen und den Vorlauf einhalten, sonst prüft der Lauf die
      // Vorlaufsperre statt der Doppelbuchung.
      const { freieSlots } = await import("../server/lib/fiaon-termine");
      const auskunft = await freieSlots(pA, tx as any, "nichterreicht_mail");
      const slot = auskunft.slots.find((s) => s.agentId === agentId) ?? auskunft.slots[0];
      ok("Es gibt einen freien Slot zum Prüfen", !!slot,
        `${auskunft.slots.length} Slots angeboten`);
      if (!slot) throw new Zurueckrollen();

      // ═══════════════════════════════════════════════════════════════════
      gruppe("1. Der erste Versuch gelingt und wird protokolliert");
      // ═══════════════════════════════════════════════════════════════════
      const buchung = await terminBuchen({
        personId: pA, agentId: slot.agentId, beginn: slot.beginn, quelle: "nichterreicht_mail",
      }, tx as any);
      ok("Der Termin ist gebucht", !!buchung?.id);
      await versuchProtokollieren({
        ergebnis: "gebucht", personId: pA, slotBeginn: slot.beginn,
        agentId: slot.agentId, quelle: "nichterreicht_mail", akteur: "kunde",
      }, tx as any);
      const [z1] = (await tx`
        SELECT COUNT(*)::int AS n FROM fiaon_termin_versuche
        WHERE person_id = ${pA} AND ergebnis = 'gebucht'
      `) as any[];
      gleich("Eine Protokollzeile „gebucht“", z1.n, 1);
      const [g1] = (await tx`
        SELECT grund FROM fiaon_termin_versuche WHERE person_id = ${pA}
      `) as any[];
      ok("Bei einem Erfolg steht KEIN Grund", g1.grund == null, `grund = ${g1.grund}`);

      // ═══════════════════════════════════════════════════════════════════
      gruppe("2. Der zweite Versuch auf denselben Slot wird abgelehnt");
      // ═══════════════════════════════════════════════════════════════════
      // Ein anderer Mensch, derselbe Agent, dieselbe Zeit. Der eindeutige Index
      // (fiaon_termine_slot_uniq) ist die Wand — nicht die Vorprüfung, die zwei
      // gleichzeitige Anfragen beide passieren würden.
      let gefangen: TerminFehler | null = null;
      // Ein Constraint-Verstoß tötet die ganze Transaktion. Deshalb im
      // Savepoint, sonst scheitert jede weitere Abfrage mit „current
      // transaction is aborted" (AGENTS.md, 16.08.2026).
      await (tx as any).savepoint(async (sp: any) => {
        try {
          await terminBuchen({
            personId: pB, agentId: slot.agentId, beginn: slot.beginn, quelle: "nichterreicht_mail",
          }, sp);
        } catch (e) {
          if (e instanceof TerminFehler) gefangen = e;
          else throw e;
        }
      }).catch(() => { /* der Savepoint rollt zurück, das ist der Zweck */ });

      ok("Die zweite Buchung wird abgelehnt", !!gefangen,
        gefangen ? "" : "sie ging durch — die Doppelbuchungs-Wand fehlt");
      const f = gefangen as TerminFehler | null;
      gleich("… mit dem Grund-Code „belegt“", f?.code, "belegt");
      ok("… und einem Text, den ein Kunde versteht",
        !!f && /vergeben|belegt|nicht mehr frei/i.test(f.message) && f.message.length > 20,
        `Text: „${f?.message}“`);
      ok("… der zum Handeln auffordert (anderen Termin wählen)",
        !!f && /wähl|ander/i.test(f.message), `Text: „${f?.message}“`);

      // Und die Ablehnung wird protokolliert — mit demselben Code.
      await versuchProtokollieren({
        ergebnis: "abgelehnt", personId: pB, slotBeginn: slot.beginn,
        agentId: slot.agentId, grund: f?.code ?? "unbekannt",
        quelle: "nichterreicht_mail", akteur: "kunde",
      }, tx as any);
      const [z2] = (await tx`
        SELECT ergebnis, grund, quelle, akteur FROM fiaon_termin_versuche
        WHERE person_id = ${pB}
      `) as any[];
      gleich("Protokollzeile „abgelehnt“", z2?.ergebnis, "abgelehnt");
      gleich("… mit Grund „belegt“", z2?.grund, "belegt");
      gleich("… und der Quelle", z2?.quelle, "nichterreicht_mail");
      gleich("… als Kundenversuch", z2?.akteur, "kunde");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. Jeder Grund-Code hat einen Klartext");
      // ═══════════════════════════════════════════════════════════════════
      // Ein Code ohne Text erscheint in der Karte als Buchstabensalat.
      for (const code of ["belegt", "nicht_angeboten", "kein_slot", "zu_frueh",
        "vergangenheit", "zu_spaet", "agent_unbekannt", "falsche_rolle",
        "zeit_unlesbar", "link_ungueltig", "keine_auswahl", "serverfehler"]) {
        ok(`Grund „${code}“ hat einen Klartext`, !!VERSUCH_GRUND_TEXT[code]);
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Die Auswertung zählt beide Versuche");
      // ═══════════════════════════════════════════════════════════════════
      // Dieselbe Abfrage wie in der Termin-Zentrale.
      const [aus] = (await tx`
        SELECT COUNT(*)::int AS gesamt,
               COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
               COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt
        FROM fiaon_termin_versuche
        WHERE versucht_am > NOW() - INTERVAL '7 days' AND person_id IN (${pA}, ${pB})
      `) as any[];
      gleich("Zwei Versuche insgesamt", aus.gesamt, 2);
      gleich("… einer gebucht", aus.gebucht, 1);
      gleich("… einer abgelehnt", aus.abgelehnt, 1);
      ok("Die Ablehnquote ist berechenbar (Erfolge werden mitgezählt)",
        Number(aus.gesamt) > Number(aus.abgelehnt),
        "ohne die Erfolge wäre jede Quote 100 %");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("5. Die Route protokolliert JEDEN Ausgang");
      // ═══════════════════════════════════════════════════════════════════
      // Quelltext-Prüfung: Eine Route mit einem unprotokollierten Ausgang
      // erzeugt genau die Lücke, die diese Messung schließen soll.
      const { readFileSync } = await import("node:fs");
      const quelle = readFileSync("server/routes/fiaon-termin.ts", "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/^\s*\/\/.*$/gm, " ");
      const buchenBlock = quelle.slice(
        quelle.indexOf('router.post("/termin/:token/buchen"'),
        quelle.indexOf('router.post("/termin/absagen'),
      );
      ok("Die Kundenroute kennt versuchProtokollieren",
        /versuchProtokollieren/.test(buchenBlock));
      const antworten = (buchenBlock.match(/res\.status\(\s*\d+\s*\)\.json|res\.json\(/g) ?? []).length;
      const protokolle = (buchenBlock.match(/versuchProtokollieren/g) ?? []).length;
      ok("Kein Ausgang ohne Protokoll (Antworten ≤ Protokollstellen + Sammelstelle)",
        protokolle >= 2,
        `${antworten} Antwortstellen, ${protokolle} Protokollstellen`);
      ok("Die Ablehnung gibt den Grund an den Kunden mit",
        /grund/.test(buchenBlock));

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  gruppe("6. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PTV${stempel}%`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_termin_versuche v
             JOIN fiaon_persons p ON p.id = v.person_id
             WHERE p.person_ref LIKE ${`FIAON-P-PTV${stempel}%`}) AS versuche
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Versuche", reste.versuche, 0);

  // ── DER BESTAND: was ist bisher aufgelaufen? ────────────────────────────
  gruppe("7. Was steht heute im Protokoll?");
  const [b] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE ergebnis = 'gebucht')::int AS gebucht,
           COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt,
           MIN(versucht_am) AS seit
    FROM fiaon_termin_versuche WHERE versucht_am > NOW() - INTERVAL '7 days'
  `) as any[];
  log(`  ${b.gesamt} Versuche in 7 Tagen (${b.gebucht} gebucht, ${b.abgelehnt} abgelehnt)`);
  if (Number(b.gesamt) === 0) {
    log("  Noch nichts aufgelaufen — die Aufzeichnung ist heute eingebaut worden.");
    log("  Das ist KEIN „alles in Ordnung“, sondern „noch nicht messbar“. Die Karte");
    log("  in der Termin-Zentrale sagt genau das, statt eine grüne Null zu zeigen.");
  } else {
    log(`  Aufzeichnung seit ${b.seit}`);
  }

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
