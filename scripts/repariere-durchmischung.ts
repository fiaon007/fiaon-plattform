// ═══════════════════════════════════════════════════════════════════════════
// Reparatur: durchmischte Anruflisten
//
// Gemeldet am 05.08.2026 aus dem Team-Chat:
//   Florentine: „Doris Leidner und Matthias Hofer — die haben ja schon bei Dani
//               gezahlt, kannst du die bei mir rausnehmen?"
//   Lucas:      „Ich hab ‚zahlt sofort' geklickt. Warum ist sie dann nochmal
//               bei mir gelandet?"
//   Daniel:     „Hab in meiner Liste ‚Heute' sehr viele wo steht ‚abgelehnt' —
//               bringt ja nix die nochmal anzurufen."
//
// URSACHE (behoben in server/lib/tier.ts): Das Tier wurde nur von einem
// Handskript geschrieben. Nach einer Zahlung blieb die Person auf Tier 1 und
// wurde von der Verteilung an den nächsten freien Agenten weitergegeben.
//
// Dieses Skript bringt den Bestand auf denselben Stand:
//   1. Einstufung aller Personen neu berechnen (bezahlt → Tier 0)
//   2. Arbeitsdaten (Zusage/Wiedervorlage) bei Tier ≤ 0 löschen
//   3. Person folgt ihrer Bestellung (Kreuzzuweisungen auflösen)
//   4. „Abgelehnt" als letztes Ergebnis ⇒ gesperrt
//   5. Nachschub, damit die frei gewordenen Plätze wieder gefüllt werden
//
// Vorschau ist Standard; erst `--schreiben` ändert etwas.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { personTierSql, alleTierAktualisieren, personAgentSynchronisieren } from "../server/lib/tier";

const SCHREIBEN = process.argv.includes("--schreiben");
const heute = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); })();

(async () => {
  console.log(`Berliner Stichtag: ${heute}\n`);

  // ── 1 + 2 · Einstufung ────────────────────────────────────────────────────
  const [abweichend] = await sqlPool.unsafe(`
    WITH t AS (${personTierSql()})
    SELECT count(*)::int AS c FROM fiaon_persons p JOIN t ON t.person_id = p.id
    WHERE p.priority_tier IS DISTINCT FROM t.priority_tier
       OR p.tier_reason IS DISTINCT FROM t.tier_reason`) as any[];
  console.log(`1. Einstufung: ${abweichend.c} Person(en) tragen ein veraltetes Tier`);

  const inListe = await sqlPool`
    SELECT p.id, ag.name AS agent,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.primary_email) AS name
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.assigned_agent_id IS NOT NULL
      AND (p.promised_payment_date <= ${heute}::date
           OR (p.follow_up_date IS NOT NULL AND p.follow_up_date <= ${heute}::date))
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND a.payment_status IN ('pending_payment', 'claimed_paid'))
  `;
  console.log(`2. Bezahlte Kunden in Anruflisten: ${inListe.length}`);
  for (const r of inListe as any[]) console.log(`     ${String(r.name).slice(0, 30).padEnd(32)} bei ${r.agent}`);

  // ── 3 · Kreuzzuweisungen ──────────────────────────────────────────────────
  const kreuz = await sqlPool`
    SELECT DISTINCT p.id, pa.name AS person_agent,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name) AS name
    FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
    LEFT JOIN fiaon_agents pa ON pa.id = p.assigned_agent_id
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND a.assigned_agent_id IS NOT NULL AND a.assigned_agent_id <> p.assigned_agent_id
      AND a.payment_status <> 'superseded'
  `;
  console.log(`3. Person und Bestellung bei verschiedenen Agenten: ${kreuz.length}`);

  // ── 4 · „Abgelehnt", aber nicht gesperrt ──────────────────────────────────
  // WICHTIG: Wer NACH der Ablehnung neu bestellt hat, ist zurückgekommen — den
  // zu sperren wäre der teuerste Fehler dieses Skripts. Deshalb zählt nur eine
  // Ablehnung, auf die keine neuere Bestellung folgt.
  const abgelehnt = await sqlPool`
    WITH letztes AS (
      SELECT p.id,
             (SELECT c.outcome FROM fiaon_contact_log c
                JOIN fiaon_applications ap ON ap.ref = c.ref
                WHERE ap.person_id = p.id AND c.type = 'result' AND c.voided_at IS NULL
                ORDER BY c.created_at DESC LIMIT 1) AS outcome,
             (SELECT MAX(c.created_at) FROM fiaon_contact_log c
                JOIN fiaon_applications ap ON ap.ref = c.ref
                WHERE ap.person_id = p.id AND c.type = 'result' AND c.voided_at IS NULL
                  AND c.outcome = 'erreicht_abgelehnt') AS abgelehnt_am
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked
    )
    SELECT l.id, ag.name AS agent,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name) AS name
    FROM letztes l
    JOIN fiaon_persons p ON p.id = l.id
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE l.outcome = 'erreicht_abgelehnt'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = l.id AND a.merged_into IS NULL
          AND a.created_at > l.abgelehnt_am
          AND a.payment_status IN ('pending_payment', 'claimed_paid', 'paid')
      )
  `;
  console.log(`4. Letztes Ergebnis „abgelehnt", trotzdem anrufbar: ${abgelehnt.length}`);

  if (!SCHREIBEN) {
    console.log("\nNur Vorschau — mit --schreiben ausführen.");
    await sqlPool.end();
    return;
  }

  // ═══ Schreiben ═════════════════════════════════════════════════════════════
  console.log("\n── Schreiben ──");
  const { geaendert } = await alleTierAktualisieren(sqlPool);
  console.log(`   Einstufung: ${geaendert} Person(en) neu eingestuft, Arbeitsdaten bei Tier ≤ 0 gelöscht`);

  let gefolgt = 0;
  for (const k of kreuz as any[]) {
    const erg = await personAgentSynchronisieren(sqlPool, { personId: k.id });
    if (erg) gefolgt++;
  }
  console.log(`   Zuweisung: ${gefolgt} Person(en) folgen jetzt ihrer Bestellung`);

  let gesperrt = 0;
  for (const a of abgelehnt as any[]) {
    await sqlPool`
      UPDATE fiaon_persons SET is_blocked = TRUE, follow_up_date = NULL, promised_payment_date = NULL, updated_at = NOW()
      WHERE id = ${a.id}
    `;
    gesperrt++;
  }
  console.log(`   Abgelehnt: ${gesperrt} Person(en) gesperrt (erscheinen in keiner Anrufliste mehr)`);

  // ── 5 · Nachschub: die frei gewordenen Plätze füllen ──────────────────────
  // Florentine hat es selbst gesagt: „dann hab ich wieder Platz für neue". Ohne
  // diesen Schritt hätte die Bereinigung ihre Liste nur kürzer gemacht.
  const { nachschub } = await import("../server/routes/fiaon-followup");
  const nach = await nachschub();
  console.log(`   Nachschub: +${nach.tier1} Tier-1, +${nach.tier2} Tier-2 verteilt`);

  // ── Kontrolle ─────────────────────────────────────────────────────────────
  const [restBezahlt] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND NOT p.is_blocked AND p.assigned_agent_id IS NOT NULL
      AND p.priority_tier BETWEEN 1 AND 2
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                    AND a.payment_status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                        AND a.payment_status IN ('pending_payment', 'claimed_paid'))
  `;
  // Eine Person kann nur EINEM Agenten gehören. Hat sie eine offene Bestellung
  // bei Lucas und eine bezahlte bei Nikita, bleibt eine Abweichung übrig — das
  // ist richtig: Die Arbeit liegt bei der offenen Bestellung, die Provision der
  // bezahlten bleibt beim Verkäufer. Gezählt wird deshalb nur, was WIRKLICH
  // falsch ist: Der Agent der Person passt zu KEINER ihrer Bestellungen.
  const [restFalsch] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a
                    WHERE a.person_id = p.id AND a.merged_into IS NULL
                      AND a.assigned_agent_id IS NOT NULL AND a.payment_status <> 'superseded')
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications a
                        WHERE a.person_id = p.id AND a.merged_into IS NULL
                          AND a.assigned_agent_id = p.assigned_agent_id)
  `;
  const [konflikte] = await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS c FROM fiaon_persons p
    JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
    WHERE p.merged_into_person_id IS NULL AND p.assigned_agent_id IS NOT NULL
      AND a.assigned_agent_id IS NOT NULL AND a.assigned_agent_id <> p.assigned_agent_id
      AND a.payment_status <> 'superseded'
  `;
  console.log("\n── Kontrolle ──");
  console.log(`   Bezahlte im Vertrieb: ${restBezahlt.c} (soll 0)`);
  console.log(`   Person gehört zu KEINER ihrer Bestellungen: ${restFalsch.c} (soll 0)`);
  console.log(`   Geteilte Kunden (offen bei A, bezahlt bei B): ${konflikte.c} — fachlich richtig, kein Fehler`);
  await sqlPool.end();
})().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
