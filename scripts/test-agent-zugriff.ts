/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BEWEIS: Ein Agent kommt nicht an die Kunden eines anderen
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Geprüft wird über ECHTE HTTP-Aufrufe mit gültiger Agenten-Sitzung, nicht durch
 * Nachrechnen der SQL-Bedingung. Der Unterschied ist der Punkt der Übung: Eine
 * Prüfung, die dieselbe Bedingung noch einmal formuliert, übersieht genau den
 * Fall, der zählt — eine Route, die die Bedingung vergessen hat.
 *
 * Fünf Zusagen werden nachgewiesen:
 *   1. Eigene Person → 200
 *   2. Fremde Person → 404 (NICHT 403: ein 403 würde bestätigen, dass diese
 *      Person existiert, und über einen Durchlauf der IDs den Kundenbestand
 *      verraten)
 *   3. Fremde Person, Schreibzugriff → 404 (nicht nur Lesen ist geschützt)
 *   4. Ohne Sitzung → 401
 *   5. Die Liste enthält ausschliesslich eigene Personen
 *
 * Es wird NICHTS geschrieben: Der Schreibversuch in Punkt 3 gilt einer fremden
 * Person und muss scheitern — genau das ist der Nachweis.
 *
 * VORAUSSETZUNG: Ein laufender Server.
 *   PORT=5055 npm run dev
 *   npx tsx scripts/test-agent-zugriff.ts            # nutzt http://localhost:5055
 *   BASIS=https://… npx tsx scripts/test-agent-zugriff.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { signAgentToken, AGENT_COOKIE_NAME } from "../server/routes/fiaon-agent";

const BASIS = process.env.BASIS || "http://localhost:5055";

const log = (s = "") => console.log(s);
const linie = (z = "─") => log(z.repeat(74));

let bestanden = 0;
let gescheitert = 0;

function pruefe(text: string, erwartet: unknown, tatsaechlich: unknown) {
  const ok = erwartet === tatsaechlich;
  log(`  ${ok ? "BESTANDEN " : "GESCHEITERT"}  ${text}`);
  if (!ok) log(`               erwartet ${erwartet}, bekommen ${tatsaechlich}`);
  ok ? bestanden++ : gescheitert++;
}

async function ruf(pfad: string, cookie: string | null, init?: RequestInit) {
  const res = await fetch(`${BASIS}/api/fiaon${pfad}`, {
    ...init,
    headers: {
      ...(cookie ? { Cookie: `${AGENT_COOKIE_NAME}=${cookie}` } : {}),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  linie("═");
  log("  ZUGRIFFSPRÜFUNG DER AGENTEN-APIS");
  log(`  Server: ${BASIS}`);
  linie("═");
  log();

  // ── Zwei Agenten, die beide eigene Personen haben ─────────────────────────
  const agenten = (await sqlPool`
    SELECT a.id, a.name, a.session_epoch,
           (SELECT p.id FROM fiaon_persons p
             WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL
             ORDER BY p.id LIMIT 1) AS eine_person
    FROM fiaon_agents a
    WHERE a.active AND NOT a.is_test_account
      AND EXISTS (SELECT 1 FROM fiaon_persons p
                   WHERE p.assigned_agent_id = a.id AND p.merged_into_person_id IS NULL)
    ORDER BY a.id
    LIMIT 2
  `) as any[];

  if (agenten.length < 2) {
    log("  ABBRUCH: Es braucht zwei Agenten mit eigenen Personen.");
    await sqlPool.end({ timeout: 5 });
    process.exit(1);
  }

  const [a, b] = agenten;
  const tokenA = signAgentToken(a.id, a.session_epoch ?? 0);
  log(`  Agent A: ${a.name} (#${a.id}), eigene Person ${a.eine_person}`);
  log(`  Agent B: ${b.name} (#${b.id}), eigene Person ${b.eine_person}`);
  log();
  linie();

  // ── 1 · Eigene Person ─────────────────────────────────────────────────────
  const eigen = await ruf(`/agent/crm/kunden/${a.eine_person}`, tokenA);
  pruefe("Agent A sieht seine eigene Person", 200, eigen.status);

  // ── 2 · Fremde Person, lesend ─────────────────────────────────────────────
  const fremd = await ruf(`/agent/crm/kunden/${b.eine_person}`, tokenA);
  pruefe("Agent A auf Person von Agent B → 404", 404, fremd.status);
  if (fremd.status === 403) {
    log("               ACHTUNG: 403 verrät die Existenz der Person.");
  }

  // ── 3 · Fremde Person, schreibend ─────────────────────────────────────────
  const schreib = await ruf(`/agent/crm/kunden/${b.eine_person}/aktivitaet`, tokenA, {
    method: "POST",
    body: JSON.stringify({ art: "notiz", notiz: "Zugriffstest — darf nicht ankommen" }),
  });
  pruefe("Agent A schreibt auf fremde Person → 404", 404, schreib.status);

  // ── 4 · Ohne Sitzung ──────────────────────────────────────────────────────
  const ohne = await ruf(`/agent/crm/kunden/${a.eine_person}`, null);
  pruefe("Ohne Sitzung → 401", 401, ohne.status);

  // ── 5 · Die Liste zeigt nur Eigenes ───────────────────────────────────────
  const liste = await ruf("/agent/crm/kunden", tokenA);
  if (liste.status !== 200) {
    pruefe("Liste abrufbar", 200, liste.status);
  } else {
    const ids: number[] = (liste.json?.kunden ?? []).map((k: any) => k.personId);
    const fremdeDrin = ids.length
      ? ((await sqlPool`
          SELECT count(*)::int AS anzahl FROM fiaon_persons
          WHERE id = ANY(${ids}) AND assigned_agent_id IS DISTINCT FROM ${a.id}
        `) as any[])[0].anzahl
      : 0;
    pruefe(`Liste (${ids.length} Kunden) enthält keine fremde Person`, 0, fremdeDrin);
  }

  // ── 6 · Dashboard antwortet und rechnet ───────────────────────────────────
  // Die Eskalations-Abfrage baut ein Intervall aus einer Zahl zusammen. So etwas
  // scheitert erst zur Laufzeit, nicht beim Übersetzen — deshalb hier geprüft.
  const dash = await ruf("/agent/crm/dashboard", tokenA);
  pruefe("Dashboard antwortet", 200, dash.status);
  if (dash.status === 200) {
    const z = dash.json?.zahlen ?? {};
    log(`               heute fällig ${z.heuteFaellig} · ohne Datum ${z.ohneDatum} · überfällig ${z.ueberfaellig}`);
    log(`               Eskalation ${z.eskalation} · Tier 1/2/3: ${z.tier1}/${z.tier2}/${z.tier3} · gesamt ${z.gesamt}`);
    pruefe("Dashboard liefert Zahlen statt undefined", true, typeof z.heuteFaellig === "number");
  }

  // ── 7 · Pflicht-Datum bei der Zusage ──────────────────────────────────────
  const ohneDatum = await ruf(`/agent/crm/kunden/${a.eine_person}/zusage`, tokenA, {
    method: "POST",
    body: JSON.stringify({}),
  });
  pruefe("Zusage ohne Datum → 400", 400, ohneDatum.status);

  // ── Gegenprobe: Der Schreibversuch hat nichts hinterlassen ────────────────
  const [spur] = (await sqlPool`
    SELECT count(*)::int AS anzahl
    FROM fiaon_contact_log c
    JOIN fiaon_applications ap ON ap.ref = c.ref
    WHERE ap.person_id = ${b.eine_person}
      AND c.note = 'Zugriffstest — darf nicht ankommen'
  `) as any[];
  pruefe("Der abgewiesene Schreibversuch hat keine Spur hinterlassen", 0, spur.anzahl);

  linie("═");
  log(`  ${bestanden} bestanden, ${gescheitert} gescheitert`);
  linie("═");

  await sqlPool.end({ timeout: 5 });
  process.exit(gescheitert === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("[TEST-AGENT-ZUGRIFF]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
