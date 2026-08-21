// ═══════════════════════════════════════════════════════════════════════════
// LANDET DAS STARTGESPRÄCH BEIM VERTRIEB?
//
// ── DIE MELDUNG (Betrieb, 21.08.2026) ─────────────────────────────────────
// „Kunden buchen ein Startgespräch, der Termin landet beim Vertrieb."
//
// ── WAS DIESER LAUF MISST ─────────────────────────────────────────────────
//   1. Buchungen der letzten drei Tage: Quelle × Rolle des Zuständigen.
//   2. Die falsch zugeordneten NAMENTLICH, mit Uhrzeit — nur so lässt sich
//      sagen, WANN es aufgehört hat.
//   3. Die Ablehnungen aus `fiaon_termin_versuche` nach Tag und Grund.
//   4. Ob heute überhaupt Onboarding-Zeiten frei wären — die Frage, die die
//      neue Rückfall-Regel stellt.
//   5. DIE LISTE FÜR DEN BETREIBER: falsch zugeordnete Startgespräche der
//      nächsten sieben Tage. Sie werden NICHT automatisch umgehängt.
//
// NUR LESEND. Schreibt eine CSV nach reports/.
//
//   npx tsx scripts/mess-startgespraech-zuordnung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { rollenFuerBuchung, freieSlots } from "../server/lib/fiaon-termine";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);
const dt = (d: unknown) => d
  ? new Date(d as string).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "-";

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSchreiben(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  writeFileSync(datei, "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

async function main(): Promise<void> {
  titel("1 — BUCHUNGEN DER LETZTEN DREI TAGE: QUELLE × ROLLE");
  const kreuz = (await sqlPool`
    SELECT t.quelle, COALESCE(ag.rolle, '(kein Konto)') AS rolle, COUNT(*)::int AS n
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.created_at > NOW() - INTERVAL '3 days'
    GROUP BY 1, 2 ORDER BY 3 DESC
  `) as any[];
  log("  Anzahl  Quelle                  Rolle des Zuständigen");
  log("  " + "─".repeat(62));
  for (const r of kreuz) {
    const falsch = String(r.quelle) === "onboarding_call" && String(r.rolle) !== "onboarding";
    log(`  ${z(r.n)}  ${String(r.quelle).padEnd(22)} ${String(r.rolle).padEnd(18)}${falsch ? "  ← FALSCH" : ""}`);
  }

  titel("2 — DIE FALSCH ZUGEORDNETEN, NAMENTLICH (3 Tage)");
  const falsch = (await sqlPool`
    SELECT t.id, t.created_at, t.beginn, t.status, t.vertretung,
           ag.name AS agent, ag.rolle,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS kunde
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    WHERE t.created_at > NOW() - INTERVAL '3 days'
      AND t.quelle = 'onboarding_call'
      AND COALESCE(ag.rolle, 'agent') <> 'onboarding'
    ORDER BY t.created_at
  `) as any[];
  log(`  ${z(falsch.length)}  Startgespräche mit einem Zuständigen aus einer anderen Rolle`);
  for (const r of falsch) {
    log(`  #${String(r.id).padEnd(5)} gebucht ${dt(r.created_at).padEnd(20)} `
      + `${String(r.agent ?? "-").padEnd(20)} ${String(r.rolle ?? "-").padEnd(9)} ${r.kunde}`);
  }
  if (falsch.length > 0) {
    log(`\n  Zuletzt passiert: ${dt(falsch[falsch.length - 1].created_at)}`);
  }

  titel("3 — DIE ABLEHNUNGEN NACH TAG (fiaon_termin_versuche, 7 Tage)");
  const versuche = (await sqlPool`
    SELECT to_char(versucht_am AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag,
           ergebnis, COALESCE(grund, '-') AS grund, COUNT(*)::int AS n
    FROM fiaon_termin_versuche
    WHERE versucht_am > NOW() - INTERVAL '7 days' AND quelle = 'onboarding_call'
    GROUP BY 1, 2, 3 ORDER BY 1 DESC, 4 DESC
  `) as any[];
  log("  Tag         Anzahl  Ergebnis    Grund");
  log("  " + "─".repeat(58));
  for (const r of versuche) {
    log(`  ${r.tag}  ${z(r.n)}  ${String(r.ergebnis).padEnd(11)} ${r.grund}`);
  }

  titel("4 — WÄREN HEUTE ONBOARDING-ZEITEN FREI?");
  // Genau die Frage, die die neue Rückfall-Regel stellt. Vorher wurde nur
  // gefragt, ob es ein KONTO gibt.
  const onboarder = (await sqlPool`
    SELECT id, name FROM fiaon_agents
    WHERE active AND NOT COALESCE(is_test_account, FALSE) AND rolle = 'onboarding'
    ORDER BY id
  `) as any[];
  log(`  ${z(onboarder.length)}  aktive Onboarding-Konten: `
    + (onboarder.map((a) => a.name).join(", ") || "keine"));

  // Ein echter Prüffall aus dem Bestand: ein Kunde, der ein Startgespräch
  // braucht. Nicht „LIMIT 1" auf irgendeine Liste (AGENTS.md), sondern der
  // dienstälteste bezahlte Kunde ohne erledigtes Startgespräch.
  const [pruef] = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          'Ohne Namen') AS name
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.payment_status = 'paid'
      AND a.merged_into IS NULL AND a.archived_at IS NULL
    WHERE p.merged_into_person_id IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    ORDER BY a.created_at LIMIT 1
  `) as any[];
  if (pruef) {
    const entscheid = await rollenFuerBuchung("onboarding_call", Number(pruef.id));
    const auskunft = await freieSlots(Number(pruef.id), sqlPool, "onboarding_call");
    log(`\n  Prüffall: ${pruef.name} (Person ${pruef.id})`);
    log(`  Entscheid: rollen=[${(entscheid.rollen ?? []).join(", ")}] `
      + `rueckfall=${entscheid.rueckfall} grund=${entscheid.grund}`);
    log(`  Angebotene Zeiten: ${auskunft.slots.length}`
      + (auskunft.vertretung ? "  (als VERTRETUNG)" : ""));
    if (auskunft.slots.length > 0) {
      const s = auskunft.slots[0];
      log(`  Erste: ${s.datum} ${s.uhrzeit} bei ${s.agentVorname} (Agent ${s.agentId})`);
    }
  }

  titel("5 — DIE LISTE FÜR DEN BETREIBER: NÄCHSTE 7 TAGE");
  // Ausdrücklich NICHT automatisch umgehängt. Ein Termin, den ein Lauf ohne
  // Rückfrage verschiebt, überrascht zwei Menschen gleichzeitig: den Kunden,
  // der eine Bestätigung mit einem anderen Namen hat, und den Kollegen, dem
  // plötzlich ein Gespräch im Kalender steht.
  const kommend = (await sqlPool`
    SELECT t.id, t.beginn, t.status, t.vertretung, t.uebergeben_am,
           ag.name AS agent, COALESCE(ag.rolle, '-') AS rolle,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS kunde,
           p.id AS person_id,
           COALESCE(NULLIF(TRIM(p.primary_email), ''), '') AS email
    FROM fiaon_termine t
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    WHERE t.quelle = 'onboarding_call' AND t.abgesagt_am IS NULL
      AND t.beginn BETWEEN NOW() AND NOW() + INTERVAL '7 days'
      AND COALESCE(ag.rolle, 'agent') <> 'onboarding'
    ORDER BY t.beginn
  `) as any[];
  if (kommend.length === 0) {
    log("  Keine. Alle Startgespräche der nächsten sieben Tage liegen beim Onboarding.");
  }
  for (const r of kommend) {
    log(`  #${String(r.id).padEnd(5)} ${dt(r.beginn).padEnd(20)} ${String(r.agent ?? "-").padEnd(20)} `
      + `${String(r.rolle).padEnd(16)} ${r.kunde}${r.vertretung ? "  [Vertretung]" : ""}`);
  }

  csvSchreiben("reports/startgespraech-falsch-zugeordnet.csv",
    ["termin_id", "beginn", "zustaendig", "rolle", "als_vertretung_markiert",
      "person_id", "kunde", "email", "status"],
    kommend.map((r) => [
      r.id, dt(r.beginn), r.agent ?? "", r.rolle, r.vertretung ? "ja" : "nein",
      r.person_id, r.kunde, r.email, r.status,
    ]));

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
