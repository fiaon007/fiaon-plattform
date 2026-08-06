// Prüfstand: „Anrufer blockiert" — Übergabe an den nächsten Vertriebler.
//
// Der Knopf greift in Zuweisungen ein, also in Arbeit und Geld. Zwei Dinge
// müssen deshalb belegt sein, nicht behauptet:
//
//   1. Der Kunde landet bei einem ECHTEN Kollegen, der bei ihm noch nicht
//      blockiert wurde — nie beim Testkonto, nie beim Abgebenden selbst, nie
//      bei jemandem, den derselbe Kunde schon blockiert hat.
//   2. Nichts geht verloren: Bestellungen ziehen mit, die Betreuungsspur
//      (betreuung_seit) bleibt, und die Übergabe steht im Protokoll.
//
// Der Prüfstand arbeitet an ECHTEN Daten und stellt am Ende alles zurück.
//
// Aufruf: npx tsx scripts/pruef-uebergabe.ts    (Server muss laufen)
import "dotenv/config";
import { createHmac } from "node:crypto";
import { sqlPool } from "../server/lib/db-pool";

const BASIS = process.env.BASIS || "http://localhost:5188";
let rot = 0, gruen = 0;
const pruefe = (name: string, gut: boolean, hinweis = "") => {
  gut ? gruen++ : rot++;
  console.log(`  ${gut ? "PASS" : "FAIL"}  ${name}${gut ? "" : `  → ${hinweis}`}`);
};

function cookie(id: number, epoch: number): string {
  const secret = process.env.SESSION_SECRET || "fiaon-dev-agent-secret";
  const payload = `${id}.${epoch}.${Date.now() + 3_600_000}`;
  return `fiaon_agent_token=${payload}.${createHmac("sha256", secret).update(`agent2:${payload}`).digest("hex").slice(0, 40)}`;
}

async function ruf(pfad: string, ck: string, init?: RequestInit) {
  const res = await fetch(`${BASIS}${pfad}`, {
    ...init,
    headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), cookie: ck },
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

(async () => {
  console.log("\n══ Anrufer blockiert — Übergabe an den nächsten Vertriebler ══\n");

  // Ein echter Agent mit Bestand und eine Person, die ihm gehört.
  const [agent] = await sqlPool`
    SELECT a.id, a.name, a.session_epoch FROM fiaon_agents a
    WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
      AND EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.assigned_agent_id = a.id
                    AND p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked)
    ORDER BY a.id LIMIT 1
  `;
  const [person] = await sqlPool`
    SELECT p.id, p.assigned_agent_id, p.betreuung_seit, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name) AS name
    FROM fiaon_persons p
    WHERE p.assigned_agent_id = ${agent.id} AND p.merged_into_person_id IS NULL
      AND p.priority_tier BETWEEN 1 AND 3 AND NOT p.is_blocked
      AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL)
    ORDER BY p.id LIMIT 1
  `;
  if (!agent || !person) { console.log("Keine geeigneten Testdaten."); process.exit(1); }
  console.log(`Bezug: ${agent.name} (#${agent.id}) gibt „${person.name}" (Person ${person.id}) ab\n`);

  const ck = cookie(Number(agent.id), Number(agent.session_epoch || 0));
  const vorherBetreuung = person.betreuung_seit;

  const r = await ruf(`/api/fiaon/agent/crm/kunden/${person.id}/aktivitaet`, ck, {
    method: "POST",
    body: JSON.stringify({ art: "nummer_blockiert", notiz: "Prüfstand — Nummer blockiert" }),
  });
  pruefe("Ergebnis wird angenommen", r.status === 200 && r.body?.ok, `Status ${r.status} ${r.body?.error || ""}`);
  pruefe("Übergabe hat stattgefunden", r.body?.uebergabe?.ok === true, JSON.stringify(r.body?.uebergabe || {}));
  pruefe("die Antwort nennt den neuen Betreuer", !!r.body?.uebergabe?.an, String(r.body?.meldung));
  pruefe("die Karte verschwindet aus der eigenen Liste", r.body?.kunde === null, "Karte kam zurück");

  const [nachher] = await sqlPool`
    SELECT p.assigned_agent_id, p.betreuung_seit, p.follow_up_date, p.is_blocked, ag.name AS agent,
           COALESCE(ag.is_test_account, FALSE) AS test
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.id = ${person.id}
  `;
  pruefe("Zuständigkeit gewechselt", Number(nachher.assigned_agent_id) !== Number(agent.id),
    `steht weiter bei ${nachher.agent}`);
  pruefe("nicht an ein Testkonto", nachher.test === false, String(nachher.agent));
  pruefe("Kunde NICHT gesperrt (er soll ja angerufen werden)", nachher.is_blocked === false);
  // Der Treiber liefert ein Date-Objekt, kein ISO-Wort. Ortszeit vergleichen,
  // sonst schlägt die Prüfung abends fälschlich an (UTC ist dann schon morgen).
  const alsTag = (v: unknown) => {
    const d = v instanceof Date ? v : new Date(String(v));
    return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const heute = alsTag(new Date());
  pruefe("Wiedervorlage steht auf heute", alsTag(nachher.follow_up_date) === heute,
    `${alsTag(nachher.follow_up_date)} statt ${heute}`);
  pruefe("Betreuungsspur unverändert (Besitzschutz)",
    String(vorherBetreuung ?? "") === String(nachher.betreuung_seit ?? "") || (!vorherBetreuung && !!nachher.betreuung_seit),
    `${vorherBetreuung} → ${nachher.betreuung_seit}`);

  const [apps] = await sqlPool`
    SELECT COUNT(*)::int AS abweichend FROM fiaon_applications
    WHERE person_id = ${person.id} AND merged_into IS NULL
      AND COALESCE(assigned_agent_id, 0) <> ${Number(nachher.assigned_agent_id)}
  `;
  pruefe("Bestellungen ziehen mit", Number(apps.abweichend) === 0, `${apps.abweichend} abweichend`);

  const [log] = await sqlPool`
    SELECT cl.outcome, cl.agent_id FROM fiaon_contact_log cl
    JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${person.id} ORDER BY cl.id DESC LIMIT 1
  `;
  pruefe("Blockade steht beim Abgebenden im Verlauf",
    log?.outcome === "nummer_blockiert" && Number(log.agent_id) === Number(agent.id),
    JSON.stringify(log || {}));
  const [ev] = await sqlPool`
    SELECT actor, from_agent_id, to_agent_id FROM fiaon_agent_events
    WHERE type = 'uebergabe_blockiert' ORDER BY id DESC LIMIT 1
  `;
  pruefe("Übergabe protokolliert mit Akteur und Richtung",
    !!ev && String(ev.actor) === `agent:${agent.id}` && Number(ev.to_agent_id) === Number(nachher.assigned_agent_id),
    JSON.stringify(ev || {}));

  // ── Zweite Runde: derselbe Kunde blockiert auch den neuen Betreuer ────────
  const [neuerAgent] = await sqlPool`
    SELECT id, name, session_epoch FROM fiaon_agents WHERE id = ${nachher.assigned_agent_id}
  `;
  const ck2 = cookie(Number(neuerAgent.id), Number(neuerAgent.session_epoch || 0));
  const r2 = await ruf(`/api/fiaon/agent/crm/kunden/${person.id}/aktivitaet`, ck2, {
    method: "POST", body: JSON.stringify({ art: "nummer_blockiert", notiz: "Prüfstand — auch hier blockiert" }),
  });
  const zweiterEmpfaenger = r2.body?.uebergabe?.an;
  pruefe("zweite Übergabe wird entschieden (weiter oder klare Absage)",
    r2.status === 200 && r2.body?.ok, `Status ${r2.status}`);
  pruefe("landet NICHT wieder beim ersten Agenten",
    zweiterEmpfaenger !== agent.name, String(zweiterEmpfaenger));
  pruefe("landet NICHT wieder beim zweiten Agenten",
    zweiterEmpfaenger !== neuerAgent.name, String(zweiterEmpfaenger));
  if (!r2.body?.uebergabe?.ok) {
    pruefe("Absage ist ein verständlicher Satz", /Kollege|Mitarbeiter/i.test(String(r2.body?.meldung)),
      String(r2.body?.meldung));
  }

  // ── Aufräumen: Zuweisung, Wiedervorlage und Prüf-Einträge zurücknehmen ────
  await sqlPool`
    UPDATE fiaon_persons SET assigned_agent_id = ${agent.id}, follow_up_date = ${person.follow_up_date}
    WHERE id = ${person.id}
  `;
  await sqlPool`
    UPDATE fiaon_applications SET assigned_agent_id = ${agent.id}
    WHERE person_id = ${person.id} AND merged_into IS NULL
  `;
  await sqlPool`
    DELETE FROM fiaon_contact_log WHERE id IN (
      SELECT cl.id FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      WHERE a.person_id = ${person.id} AND cl.note LIKE 'Prüfstand%')
  `;
  await sqlPool`DELETE FROM fiaon_agent_events WHERE type = 'uebergabe_blockiert' AND meta::text LIKE ${`%"person_id":${person.id}%`}`;
  console.log("\n  (Zuweisung, Wiedervorlage und Prüf-Einträge zurückgesetzt)");

  console.log(`\n${rot === 0 ? "ALLES GRÜN" : `${rot} FEHLER`} — ${gruen} Prüfungen bestanden, ${rot} offen\n`);
  await sqlPool.end?.();
  process.exit(rot === 0 ? 0 : 1);
})().catch((e) => { console.error("Abbruch:", e); process.exit(1); });
