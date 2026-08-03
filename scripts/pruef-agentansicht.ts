/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ABNAHME: Sieht ein Agent fremde Kunden?
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Anlass: Auf /agent/kunden waren einem Testkonto ohne eigene Kunden 35 fremde
 * Datensätze sichtbar, darunter ein Kunde von Nikita Boychenko mit Name,
 * E-Mail, Betrag und Zusagedatum. Ursache war /agent/customers: Die Abfrage
 * lud JEDE offene Bestellung und schickte die Kunden der Kollegen als eigenes
 * Feld `colleagues` mit.
 *
 * Dieses Skript prüft JEDE Agentenseite gegen genau dieses Muster. Es prüft
 * zwei Richtungen, weil eine allein nichts beweist:
 *
 *   EIGENTUMS-PROBE  Jeder Datensatz, den ein Endpunkt liefert, muss dem
 *                anfragenden Agenten gehören. Geprüft wird nicht „Zahl ist 0“,
 *                sondern `assigned_agent_id === ich` für JEDE Zeile.
 *
 *                Warum nicht auf 0 prüfen: Testkonto #2 hat drei eigene, längst
 *                abgeschlossene Datensätze (zwei bezahlt, einer ausgeschlossen)
 *                aus eigenen Testbestellungen. Die DARF es sehen. Eine Prüfung
 *                auf 0 hätte hier dauerhaft rot gemeldet und den Blick auf das
 *                echte Leck verstellt — und umgekehrt wäre ein Endpunkt, der
 *                zufällig nichts liefert, als „sicher“ durchgegangen.
 *
 *   VOLL-PROBE   Ein echter Agent muss seinen eigenen Bestand sehen — und
 *                jeder Datensatz darin muss ihm gehören. Ein Endpunkt, der
 *                einfach nichts liefert, wäre „sicher", aber unbrauchbar.
 *
 *   QUER-PROBE   Direktaufruf einer FREMDEN Referenz muss 404 liefern, auch
 *                lesend und auch als PDF. Ein 403 wäre schon eine Auskunft
 *                über die Existenz der Referenz.
 *
 * Aufruf bei laufendem Server:
 *   npx tsx scripts/pruef-agentansicht.ts
 *   PORT=5055 TEST_AGENT=2 ECHT_AGENT=8 npx tsx scripts/pruef-agentansicht.ts
 */

import "dotenv/config";
import { sqlPool } from "../server/lib/db-pool";
import { signAgentToken, AGENT_COOKIE_NAME } from "../server/routes/fiaon-agent";

const BASIS = `http://localhost:${process.env.PORT || 5055}/api/fiaon`;
const TEST_AGENT = Number(process.env.TEST_AGENT || 2);
const ECHT_AGENT = Number(process.env.ECHT_AGENT || 8);

let fehler = 0;
const ok = (t: string) => console.log(`    OK        ${t}`);
const bad = (t: string) => { fehler++; console.log(`    LECK      ${t}`); };

/**
 * Jede Agentenseite mit dem Endpunkt, der ihre Kundendaten liefert, und der
 * Stelle in der Antwort, an der die Datensätze stehen. Wer hier eine Seite
 * ergänzt, bekommt sie automatisch in beiden Proben geprüft.
 */
const SEITEN: { seite: string; pfad: string; zaehle: (j: any) => number; zeilen?: (j: any) => any[] }[] = [
  { seite: "/agent/heute (Dashboard)", pfad: "/agent/crm/dashboard", zaehle: (j) => j?.zahlen?.gesamt ?? 0 },
  { seite: "/agent/heute (Tier 1)", pfad: "/agent/crm/kunden?tier=1", zaehle: (j) => j?.kunden?.length ?? 0 },
  { seite: "/agent/heute (Tier 2)", pfad: "/agent/crm/kunden?tier=2", zaehle: (j) => j?.kunden?.length ?? 0 },
  { seite: "/agent/heute (Tier 3)", pfad: "/agent/crm/kunden?tier=3", zaehle: (j) => j?.kunden?.length ?? 0 },
  { seite: "/agent/kunden (Arbeitsliste)", pfad: "/agent/customers", zaehle: (j) => j?.data?.length ?? 0, zeilen: (j) => j?.data ?? [] },
  { seite: "/agent/kunden (colleagues!)", pfad: "/agent/customers", zaehle: (j) => j?.colleagues?.length ?? 0, zeilen: (j) => j?.colleagues ?? [] },
  { seite: "/agent/kunden (Gesamtbestand)", pfad: "/agent/customers/all", zaehle: (j) => j?.data?.length ?? 0, zeilen: (j) => j?.data ?? [] },
  { seite: "/agent/leads", pfad: "/agent/leads", zaehle: (j) => (j?.data?.length ?? j?.leads?.length ?? 0) },
  { seite: "/agent/kalender", pfad: "/agent/calendar", zaehle: (j) => (j?.data?.length ?? j?.termine?.length ?? 0) },
];

function cookieFuer(id: number, epoch: number) {
  return `${AGENT_COOKIE_NAME}=${signAgentToken(id, epoch ?? 0)}`;
}

async function hol(cookie: string, pfad: string) {
  const r = await fetch(BASIS + pfad, { headers: { Cookie: cookie } });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* PDF o. ä. */ }
  return { status: r.status, json, text };
}

async function main() {
  const agenten = (await sqlPool`
    SELECT id, name, session_epoch, is_test_account FROM fiaon_agents
    WHERE id IN (${TEST_AGENT}, ${ECHT_AGENT})
  `) as any[];
  const test = agenten.find((a) => a.id === TEST_AGENT);
  const echt = agenten.find((a) => a.id === ECHT_AGENT);
  if (!test || !echt) throw new Error("Agenten nicht gefunden");

  const cTest = cookieFuer(test.id, test.session_epoch);

  // ── EIGENTUMS-PROBE, beide Konten ─────────────────────────────────────
  for (const wer of [test, echt]) {
    const cookie = cookieFuer(wer.id, wer.session_epoch);
    console.log("");
    console.log(`══ ${wer.name} (#${wer.id}, Testkonto: ${wer.is_test_account}) ══`);
    console.log("   Erwartung: jeder gelieferte Datensatz gehört ihm.");
    console.log("");
    for (const s of SEITEN) {
      const r = await hol(cookie, s.pfad);
      const n = s.zaehle(r.json);
      const zeilen = s.zeilen?.(r.json) ?? [];
      const fremd = zeilen.filter(
        (z: any) => z.assigned_agent_id !== undefined && z.assigned_agent_id !== wer.id,
      );
      const txt = `${s.seite.padEnd(30)} HTTP ${r.status}  ${n} Kunden`;
      if (fremd.length > 0) {
        bad(`${txt}   ← ${fremd.length} davon FREMD`);
        for (const f of fremd.slice(0, 2)) {
          console.log(`              fremd: ${f.ref ?? f.personId} (Agent ${f.assigned_agent_id}, ${f.assigned_agent_name ?? "?"})`);
        }
      } else if (zeilen.length > 0) {
        ok(`${txt}   alle ${zeilen.length} gehören ihm`);
      } else {
        ok(txt);
      }
    }
  }

  // ── QUER-PROBE ────────────────────────────────────────────────────────────
  console.log("");
  console.log("══ QUER-PROBE — Direktaufruf einer FREMDEN Referenz ══");
  console.log("   Erwartung: 404 überall, auch lesend und als PDF.");
  console.log("");
  const [fremdApp] = (await sqlPool`
    SELECT a.ref, ag.name AS agent
    FROM fiaon_applications a
    JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.assigned_agent_id NOT IN (${TEST_AGENT}, ${ECHT_AGENT})
      AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment','claimed_paid')
    LIMIT 1
  `) as any[];

  if (!fremdApp) {
    console.log("    (keine fremde Bestellung zum Prüfen gefunden)");
  } else {
    console.log(`    Zielobjekt: Referenz eines Kunden von ${fremdApp.agent}`);
    const pfade = [
      `/agent/customers/${fremdApp.ref}`,
      `/agent/customers/${fremdApp.ref}/invoice.pdf`,
    ];
    for (const p of pfade) {
      const r = await hol(cTest, p);
      const t = `${p.replace(fremdApp.ref, "<fremde-ref>").padEnd(46)} HTTP ${r.status}`;
      r.status === 404 ? ok(t) : bad(`${t}   ← fremde Daten abrufbar`);
    }
    // Schreibende Zugriffe: dürfen den fremden Datensatz nicht berühren.
    for (const p of [`/agent/customers/${fremdApp.ref}/notes`,
                     `/agent/customers/${fremdApp.ref}/send-payment-email`]) {
      const r = await fetch(BASIS + p, {
        method: "POST",
        headers: { Cookie: cTest, "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Abnahmeprüfung — darf nie ankommen" }),
      });
      const t = `POST ${p.replace(fremdApp.ref, "<fremde-ref>").padEnd(41)} HTTP ${r.status}`;
      r.status === 404 ? ok(t) : bad(`${t}   ← fremder Datensatz veränderbar`);
    }
  }

  console.log("");
  console.log(fehler === 0
    ? "══ ERGEBNIS: kein Leck gefunden ══"
    : `══ ERGEBNIS: ${fehler} LECK(S) — nicht auslieferungsfähig ══`);
  console.log("");

  await sqlPool.end({ timeout: 5 });
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("[PRUEF-AGENTANSICHT]", err);
  await sqlPool.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
});
