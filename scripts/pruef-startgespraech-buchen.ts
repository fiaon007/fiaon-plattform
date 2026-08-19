// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER KUNDE KANN DIE ANGEBOTENE ZEIT AUCH BUCHEN
//
// ── DIE MELDUNG (Herr Hertel, telefonisch, 19.08.2026) ─────────────────────
// Ein Kunde kann im Startgespräch-Kalender keine Zeit auswählen.
//
// ── DER BEFUND, MIT 38 BELEGEN ─────────────────────────────────────────────
// Jens Hertel (Person 4540) hat es heute um 08 Uhr ACHTUNDDREISSIG MAL versucht.
// Jeder Versuch steht im Protokoll (Migration 062), jeder mit demselben Grund:
// `falsche_rolle`. Bestandsweit 220 von 222 Ablehnungen.
//
// Die gewählten Ansprechpartner: Lucas (98×), Nikita (51×), Florentine (44×),
// Daniel (27×) — alle aus Vertrieb und Leitung.
//
// ── DIE URSACHE ───────────────────────────────────────────────────────────
// Ist kein Onboarding-Konto aktiv, bietet `freieSlots` bewusst Zeiten aus
// Vertrieb und Leitung an (`rollenMitRueckfall`). Die Rollenprüfung in
// `terminBuchen` kannte diesen Rückfall NICHT und verglich stur gegen
// `rolleFuerQuelle`. Sie lehnte damit ab, was die Anzeige eine Zeile vorher
// angeboten hatte.
//
// ── DIE REGEL, DIE HIER GEPRÜFT WIRD ──────────────────────────────────────
// JEDER Slot, den `freieSlots` anbietet, MUSS über `terminBuchen` buchbar sein.
// Die Erwartung ist unabhängig formuliert: Sie leitet sich nicht aus der
// Rollenregel ab, sondern aus dem Angebot. Genau deshalb wird sie rot, wenn die
// Prüfung strenger wird als die Anzeige.
//
// ALLES IN EINER TRANSAKTION, DIE AM ENDE ZURÜCKGEROLLT WIRD.
//
//   npx tsx scripts/pruef-startgespraech-buchen.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import {
  freieSlots, terminBuchen, rollenMitRueckfall, rolleFuerQuelle, TerminFehler,
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
function gruppe(t: string): void { log(`\n── ${t} ${"─".repeat(Math.max(0, 50 - t.length))}`); }

class Zurueckrollen extends Error {}
const stempel = Date.now().toString(36).toUpperCase();

async function main(): Promise<void> {
  log("\n══ Prüfstand: Startgespräch buchen ══");

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("1. Der Befund im Protokoll — steht er noch da?");
  // ═════════════════════════════════════════════════════════════════════════
  const [h] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE grund = 'falsche_rolle')::int AS rolle
    FROM fiaon_termin_versuche WHERE person_id = 4540
  `) as any[];
  log(`  Jens Hertel (Person 4540): ${h.n} Versuche, ${h.rolle} davon „falsche_rolle“`);
  ok("Der Befund ist im Protokoll nachlesbar", Number(h.n) > 0,
    "ohne das Protokoll wäre die Ursache nicht auffindbar gewesen");

  const [gesamt] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt,
           COUNT(*) FILTER (WHERE grund = 'falsche_rolle')::int AS rolle
    FROM fiaon_termin_versuche
  `) as any[];
  log(`  Bestandsweit: ${gesamt.rolle} von ${gesamt.abgelehnt} Ablehnungen aus diesem Grund`);

  // ═════════════════════════════════════════════════════════════════════════
  gruppe("2. Anzeige und Prüfung benutzen DIESELBE Regel");
  // ═════════════════════════════════════════════════════════════════════════
  const r = await rollenMitRueckfall("onboarding_call");
  log(`  rollenMitRueckfall: ${JSON.stringify(r)}`);
  log(`  rolleFuerQuelle:    ${rolleFuerQuelle("onboarding_call")}`);
  const { readFileSync } = await import("node:fs");
  const q = readFileSync("server/lib/fiaon-termine.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ");
  // Der Abschnitt der Buchung — ab `terminBuchen`.
  const von = q.indexOf("export async function terminBuchen");
  const buchBlock = q.slice(von, von + 3000);
  ok("Die Buchung benutzt rollenMitRueckfall",
    /rollenMitRueckfall\(/.test(buchBlock),
    "sonst prüft sie eine andere Regel als die Anzeige — genau der Fehler");
  ok("Sie vergleicht NICHT mehr stur gegen rolleFuerQuelle",
    !/String\(agent\.rolle \|\| "agent"\) !== nurRolle/.test(buchBlock),
    "diese Zeile war die Ursache der 220 Ablehnungen");
  ok("Die Ablehnung nennt einen Weg weiter",
    /wähl eine andere Zeit/i.test(readFileSync("server/lib/fiaon-termine.ts", "utf8")),
    "„Diese Person führt keine Startgespräche“ allein hilft einem Kunden nicht");

  try {
    await sqlPool.begin(async (tx) => {
      // ═══════════════════════════════════════════════════════════════════
      gruppe("3. DIE REGEL: jeder angebotene Slot ist buchbar");
      // ═══════════════════════════════════════════════════════════════════
      const [person] = (await tx`
        INSERT INTO fiaon_persons (person_ref, kind, account_status, priority_tier,
                                   first_name, last_name, created_at)
        VALUES (${`FIAON-P-PSB${stempel}`}, 'private', 'paid', 0,
                'Prüf', ${`Start${stempel}`}, NOW())
        RETURNING id
      `) as any[];
      const personId = Number(person.id);

      for (const quelle of ["onboarding_call", "nichterreicht_mail"] as const) {
        const auskunft = await freieSlots(personId, tx as any, quelle);
        log("");
        log(`  Quelle „${quelle}“: ${auskunft.slots.length} angebotene Zeiten`);
        ok(`${quelle}: es gibt überhaupt Zeiten`, auskunft.slots.length > 0,
          "ohne Angebot sagt die Prüfung nichts — und der Kunde sieht einen leeren Kalender");
        if (auskunft.slots.length === 0) continue;

        // Die drei ersten Slots — je einer je Agent, wenn möglich. Nicht der
        // erstbeste (AGENTS.md): Der Fehler trat bei BESTIMMTEN Agenten auf.
        const jeAgent = new Map<number, any>();
        for (const s of auskunft.slots) if (!jeAgent.has(s.agentId)) jeAgent.set(s.agentId, s);
        const proben = Array.from(jeAgent.values()).slice(0, 4);
        log(`  ${proben.length} Ansprechpartner im Angebot: `
          + Array.from(jeAgent.keys()).join(", "));

        for (const s of proben) {
          const [ag] = (await tx`
            SELECT name, COALESCE(rolle, 'agent') AS rolle FROM fiaon_agents WHERE id = ${s.agentId}
          `) as any[];
          let gebucht = false;
          let grund: string | null = null;
          await (tx as any).savepoint(async (sp: any) => {
            try {
              await terminBuchen({
                personId, agentId: s.agentId, beginn: s.beginn, quelle,
              }, sp);
              gebucht = true;
            } catch (e) {
              grund = e instanceof TerminFehler ? e.code : String(e).slice(0, 60);
            }
            // Immer zurückrollen: Der nächste Slot soll denselben Ausgangspunkt
            // haben, und es soll kein Termin entstehen.
            throw new Zurueckrollen();
          }).catch(() => { /* der Savepoint rollt zurück, das ist der Zweck */ });

          ok(`${quelle}: Slot von ${String(ag?.name).slice(0, 20)} (${ag?.rolle}) ist buchbar`,
            gebucht, `abgelehnt mit „${grund}“ — die Anzeige hat ihn angeboten`);
        }
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3b. HERTELS LAGE, NACHGESTELLT: kein Onboarding-Konto aktiv");
      // ═══════════════════════════════════════════════════════════════════
      // ── WARUM DIESE GRUPPE ENTSCHEIDEND IST ───────────────────────────
      // Heute sind zwei Onboarding-Kräfte aktiv (Angelique und Rifka), also
      // greift der Rückfall nicht mehr — und beide Regeln verhalten sich
      // gleich. Der Fehler von heute morgen wäre damit NICHT reproduzierbar,
      // und die Rot-Probe würde nur die Quelltext-Prüfung treffen.
      //
      // Deshalb wird die Lage hergestellt: Die Onboarding-Konten werden IN DER
      // TRANSAKTION stillgelegt. Dann fällt `freieSlots` auf Vertrieb und
      // Leitung zurück — genau wie um 08 Uhr —, und es zeigt sich, ob die
      // Buchung diesen Zeiten folgt.
      //
      // Die Stilllegung wird mit der Transaktion zurückgerollt. Kein echtes
      // Konto bleibt angefasst.
      const onboardingKonten = (await tx`
        SELECT id, name FROM fiaon_agents
        WHERE active AND COALESCE(rolle, 'agent') = 'onboarding'
          AND NOT COALESCE(is_test_account, FALSE)
      `) as any[];
      log(`  ${onboardingKonten.length} aktive Onboarding-Konten werden für diese Prüfung stillgelegt:`);
      for (const o of onboardingKonten) log(`     ${o.id} ${o.name}`);
      if (onboardingKonten.length > 0) {
        await tx`
          UPDATE fiaon_agents SET active = FALSE
          WHERE id = ANY(${onboardingKonten.map((o) => Number(o.id))})
        `;
      }

      const rueck = await rollenMitRueckfall("onboarding_call", tx as any);
      log(`  rollenMitRueckfall jetzt: ${JSON.stringify(rueck)}`);
      ok("Ohne Onboarding-Konto greift der Rückfall", rueck.rueckfall === true,
        `rueckfall=${rueck.rueckfall} — ohne ihn sieht der Kunde einen leeren Kalender`);

      const rueckAuskunft = await freieSlots(personId, tx as any, "onboarding_call");
      log(`  Angebotene Zeiten im Rückfall: ${rueckAuskunft.slots.length}`);
      ok("Der Rückfall bietet Zeiten an", rueckAuskunft.slots.length > 0,
        "sonst bleibt der Kunde ohne jeden Weg");

      const jeAgentR = new Map<number, any>();
      for (const s of rueckAuskunft.slots) if (!jeAgentR.has(s.agentId)) jeAgentR.set(s.agentId, s);
      for (const s of Array.from(jeAgentR.values()).slice(0, 4)) {
        const [ag] = (await tx`
          SELECT name, COALESCE(rolle, 'agent') AS rolle FROM fiaon_agents WHERE id = ${s.agentId}
        `) as any[];
        let gebucht = false;
        let grund: string | null = null;
        await (tx as any).savepoint(async (sp: any) => {
          try {
            await terminBuchen({ personId, agentId: s.agentId, beginn: s.beginn, quelle: "onboarding_call" }, sp);
            gebucht = true;
          } catch (e) {
            grund = e instanceof TerminFehler ? e.code : String(e).slice(0, 60);
          }
          throw new Zurueckrollen();
        }).catch(() => {});
        // DAS ist der Prüffall von heute morgen: Lucas, Nikita, Florentine oder
        // Daniel im Angebot — und die Frage, ob die Buchung ihnen folgt.
        ok(`RÜCKFALL: Slot von ${String(ag?.name).slice(0, 20)} (${ag?.rolle}) ist buchbar`,
          gebucht,
          `abgelehnt mit „${grund}“ — GENAU der Fehler, an dem Jens Hertel `
          + "38 Mal gescheitert ist");
      }

      // ═══════════════════════════════════════════════════════════════════
      gruppe("3c. KEIN EINZIGER SLOT: bleibt der Kunde ohne Weg?");
      // ═══════════════════════════════════════════════════════════════════
      // Der Fall, den es heute nicht gibt und morgen geben kann: Alle, die
      // Zeiten anbieten könnten, sind stillgelegt. Dann darf der Kunde nicht
      // vor einer leeren Fläche stehen — es muss eine Aufgabe entstehen.
      const alleKonten = (await tx`
        SELECT id FROM fiaon_agents WHERE active AND NOT COALESCE(is_test_account, FALSE)
      `) as any[];
      await tx`
        UPDATE fiaon_agents SET active = FALSE
        WHERE id = ANY(${alleKonten.map((a) => Number(a.id))})
      `;
      const leer = await freieSlots(personId, tx as any, "onboarding_call");
      gleich("Ohne jeden aktiven Mitarbeiter: 0 Zeiten", leer.slots.length, 0);
      ok("Das ist der Fall, für den die Aufgabe gebaut ist", leer.slots.length === 0);
      // Die Aufgabe entsteht in der ROUTE, nicht hier — geprüft wird, dass der
      // Quelltext sie anlegt und dass die Bedingung Doppelte verhindert.
      const { readFileSync: lies2 } = await import("node:fs");
      const routeQ = lies2("server/routes/fiaon-termin.ts", "utf8");
      ok("Die Route legt bei 0 Zeiten eine Aufgabe an",
        /auskunft\.slots\.length === 0/.test(routeQ) && /INSERT INTO fiaon_vermerke/.test(routeQ));
      ok("… mit 24-Stunden-Frist", /INTERVAL '24 hours'\)::date/.test(routeQ));
      ok("… und höchstens einer je Person und Tag",
        /WHERE NOT EXISTS/.test(routeQ) && /created_at > NOW\(\) - INTERVAL '24 hours'/.test(routeQ),
        "sonst erzeugt fünfmal Neuladen fünf Aufgaben");

      // ═══════════════════════════════════════════════════════════════════
      gruppe("4. Die Wand steht weiter: ein NICHT angebotener Agent");
      // ═══════════════════════════════════════════════════════════════════
      // ACHTUNG: Gruppe 3c hat alle Konten stillgelegt. Für diese Gruppe wird
      // der Stand wiederhergestellt — sonst prüft sie eine Welt ohne
      // Mitarbeiter und wäre grün, ohne etwas zu zeigen.
      await tx`
        UPDATE fiaon_agents SET active = TRUE
        WHERE id = ANY(${alleKonten.map((a) => Number(a.id))})
      `;
      // Der Rückfall darf die Prüfung nicht abschaffen. Wer die Anfrage selbst
      // baut und einen Inkasso-Mitarbeiter einsetzt, muss abgewiesen werden.
      const [inkasso] = (await tx`
        SELECT id, name FROM fiaon_agents
        WHERE active AND COALESCE(rolle, 'agent') = 'inkasso'
          AND NOT COALESCE(is_test_account, FALSE) LIMIT 1
      `) as any[];
      if (!inkasso) {
        log("  Kein aktiver Inkasso-Mitarbeiter — diese Prüfung entfällt.");
        ok("Ein Inkasso-Konto für die Gegenprobe vorhanden", false,
          "ohne es ist nicht belegt, dass die Wand noch steht");
      } else {
        const auskunft = await freieSlots(personId, tx as any, "onboarding_call");
        const slot = auskunft.slots[0];
        let abgewiesen = false;
        let grund: string | null = null;
        if (slot) {
          await (tx as any).savepoint(async (sp: any) => {
            try {
              await terminBuchen({
                personId, agentId: Number(inkasso.id), beginn: slot.beginn,
                quelle: "onboarding_call",
              }, sp);
            } catch (e) {
              abgewiesen = true;
              grund = e instanceof TerminFehler ? e.code : "unbekannt";
            }
            throw new Zurueckrollen();
          }).catch(() => {});
        }
        ok(`Ein Inkasso-Mitarbeiter (${String(inkasso.name).slice(0, 18)}) wird abgewiesen`,
          abgewiesen, `Grund „${grund}“`);
      }

      throw new Zurueckrollen();
    });
  } catch (e) {
    if (!(e instanceof Zurueckrollen)) throw e;
  }

  gruppe("5. Gegenprobe: nichts zurückgeblieben");
  const [reste] = (await sqlPool`
    SELECT (SELECT COUNT(*)::int FROM fiaon_persons WHERE person_ref LIKE ${`FIAON-P-PSB${stempel}%`}) AS personen,
           (SELECT COUNT(*)::int FROM fiaon_termine t
             JOIN fiaon_persons p ON p.id = t.person_id
             WHERE p.person_ref LIKE ${`FIAON-P-PSB${stempel}%`}) AS termine
  `) as any[];
  gleich("Zurückgerollt: Personen", reste.personen, 0);
  gleich("Zurückgerollt: Termine", reste.termine, 0);

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
