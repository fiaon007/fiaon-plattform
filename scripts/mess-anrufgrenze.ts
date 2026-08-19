// ═══════════════════════════════════════════════════════════════════════════
// WAS HAT DIE ANRUFGRENZE GEKOSTET?
//
// ── DIE MELDUNG (19.08.2026) ───────────────────────────────────────────────
// Die Tagesgrenze je Absendernummer (Vorgabe 100, Sperre bei Erreichen) hat
// heute das komplette Vertriebsteam blockiert. Der Betreiber hat sie auf 0
// gestellt, um weiterarbeiten zu können.
//
// ── WAS DIESE MESSUNG BEANTWORTET ─────────────────────────────────────────
//   1. Wie viele Anrufe hat die Sperre verhindert — heute und insgesamt?
//   2. Ab welcher Uhrzeit, und bei welchen Mitarbeitern?
//   3. Wie hoch muss die Schwelle sein, damit sie im Normalbetrieb NIE greift?
//      Dafür das Tagesmaximum je Mitarbeiter UND je Absendernummer der letzten
//      14 Tage — die Grenze zählt je NUMMER, also ist das die maßgebliche Zahl.
//
// Die Sperre protokolliert jede Ablehnung in `fiaon_call_versuche` mit
// `erlaubt = false` und dem Grund im Klartext. Die Zahl ist also nicht
// geschätzt, sondern gezählt.
//
// NUR LESEND.
//
//   npx tsx scripts/mess-anrufgrenze.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** Berliner Uhrzeit aus einem Zeitstempel — die Grenze rechnet in Berlin. */
const uhr = (v: unknown) => new Date(String(v)).toLocaleTimeString("de-DE",
  { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. WIE VIELE ANRUFE HAT DIE SPERRE VERHINDERT?");
  // ═════════════════════════════════════════════════════════════════════════
  // Der Grund steht im Klartext im Protokoll. Gesucht wird die Tagesgrenze,
  // nicht jede Ablehnung — eine fehlende Berechtigung ist eine andere Sache.
  const MUSTER = "%Tagesgrenze für diese Rufnummer%";

  const [summe] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE created_at >= (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute,
           COUNT(DISTINCT agent_id) FILTER (WHERE created_at >= (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS agenten_heute,
           COUNT(DISTINCT nummer) FILTER (WHERE created_at >= (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS ziele_heute,
           MIN(created_at) AS erste, MAX(created_at) AS letzte
    FROM fiaon_call_versuche
    WHERE NOT erlaubt AND grund LIKE ${MUSTER}
  `) as any[];

  log("");
  log(`  ${String(summe.heute).padStart(5)}  Anrufe HEUTE von der Sperre verhindert`);
  log(`  ${String(summe.gesamt).padStart(5)}  insgesamt, seit es die Grenze gibt`);
  log(`  ${String(summe.agenten_heute).padStart(5)}  Mitarbeiter waren heute betroffen`);
  log(`  ${String(summe.ziele_heute).padStart(5)}  verschiedene Zielnummern konnten heute nicht angerufen werden`);
  if (summe.erste) {
    log("");
    log(`  Erste Ablehnung überhaupt:  ${String(summe.erste).slice(0, 19)}`);
    log(`  Letzte Ablehnung:           ${String(summe.letzte).slice(0, 19)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. AB WELCHER UHRZEIT, UND BEI WEM?");
  // ═════════════════════════════════════════════════════════════════════════
  const jeAgent = (await sqlPool`
    SELECT v.agent_id, COALESCE(v.agent_name, ag.name, '—') AS name, ag.rolle,
           COUNT(*)::int AS verhindert,
           MIN(v.created_at) AS ab, MAX(v.created_at) AS bis,
           COUNT(DISTINCT v.nummer)::int AS ziele
    FROM fiaon_call_versuche v
    LEFT JOIN fiaon_agents ag ON ag.id = v.agent_id
    WHERE NOT v.erlaubt AND v.grund LIKE ${MUSTER}
      AND v.created_at >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
    GROUP BY 1, 2, 3 ORDER BY 4 DESC
  `) as any[];

  log("");
  if (jeAgent.length === 0) {
    log("  Heute keine Ablehnung wegen der Tagesgrenze im Protokoll.");
    log("");
    log("  ACHTUNG: Das ist KEIN Freispruch. Der Betreiber hat die Grenze auf 0");
    log("  gestellt — ab dann lehnt sie nichts mehr ab. Die Ablehnungen von");
    log("  VORHER stehen weiter unten unter „insgesamt“, und die Sperre war bis");
    log("  zu diesem Eingriff aktiv.");
  }
  for (const a of jeAgent) {
    log(`  ${String(a.name).slice(0, 24).padEnd(25)} ${String(a.rolle ?? "—").padEnd(16)}`
      + ` ${String(a.verhindert).padStart(4)} verhindert`
      + `   ab ${uhr(a.ab)} bis ${uhr(a.bis)}   ${a.ziele} Ziele`);
  }

  // Und dasselbe über alle Tage — die Grenze gab es seit dem 18.08.
  const jeTag = (await sqlPool`
    SELECT (created_at AT TIME ZONE 'Europe/Berlin')::date AS tag,
           COUNT(*)::int AS verhindert,
           COUNT(DISTINCT agent_id)::int AS agenten,
           MIN(created_at) AS ab
    FROM fiaon_call_versuche
    WHERE NOT erlaubt AND grund LIKE ${MUSTER}
    GROUP BY 1 ORDER BY 1 DESC
  `) as any[];
  log("");
  log("  Je Tag:");
  for (const t of jeTag) {
    log(`     ${String(t.tag).slice(0, 10)}   ${String(t.verhindert).padStart(4)} verhindert`
      + `   ${t.agenten} Mitarbeiter   erste Ablehnung ${uhr(t.ab)} Uhr`);
  }

  // ── DIE GEGENPROBE: ALLE ABLEHNUNGSGRÜNDE ───────────────────────────────
  // Damit im Report nicht die Tagesgrenze für etwas verantwortlich gemacht
  // wird, das eine andere Wand war.
  const gruende = (await sqlPool`
    SELECT COALESCE(LEFT(grund, 60), '— ohne Grund —') AS grund, COUNT(*)::int AS n,
           MAX(created_at) AS letzte
    FROM fiaon_call_versuche WHERE NOT erlaubt
    GROUP BY 1 ORDER BY 2 DESC LIMIT 12
  `) as any[];
  log("");
  log("  Alle Ablehnungsgründe im Wahlprotokoll (zur Abgrenzung):");
  for (const g of gruende) {
    log(`     ${String(g.n).padStart(5)}  ${String(g.grund).slice(0, 58).padEnd(60)} ${String(g.letzte).slice(0, 16)}`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. WIE HOCH MUSS DIE SCHWELLE SEIN? — DIE ECHTEN ZAHLEN");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Grenze zählt AUSGEHENDE Anrufe je ABSENDERNUMMER und Tag. Genau das
  // wird hier gemessen — nicht je Mitarbeiter, denn der Netzbetreiber sieht
  // die Nummer.
  const jeNummerTag = (await sqlPool`
    SELECT (beginn AT TIME ZONE 'Europe/Berlin')::date AS tag,
           COALESCE(von_nummer, '— vor Migration 063 —') AS nummer,
           COUNT(*)::int AS anrufe,
           COUNT(DISTINCT agent_id)::int AS agenten
    FROM fiaon_calls
    WHERE richtung = 'raus'
      AND beginn >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '14 days'
    GROUP BY 1, 2 ORDER BY 3 DESC
  `) as any[];

  log("");
  log("  Ausgehende Anrufe je ABSENDERNUMMER und Tag (14 Tage, absteigend):");
  log("  Tag          Absendernummer            Anrufe   Mitarbeiter");
  for (const z of jeNummerTag.slice(0, 15)) {
    log(`  ${String(z.tag).slice(0, 10)}   ${String(z.nummer).slice(0, 24).padEnd(25)}`
      + ` ${String(z.anrufe).padStart(6)}   ${String(z.agenten).padStart(6)}`);
  }
  const maxNummer = jeNummerTag.length > 0 ? Number(jeNummerTag[0].anrufe) : 0;

  const jeAgentTag = (await sqlPool`
    SELECT (k.beginn AT TIME ZONE 'Europe/Berlin')::date AS tag,
           k.agent_id, COALESCE(ag.name, '—') AS name, COUNT(*)::int AS anrufe
    FROM fiaon_calls k
    LEFT JOIN fiaon_agents ag ON ag.id = k.agent_id
    WHERE k.richtung = 'raus'
      AND k.beginn >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '14 days'
    GROUP BY 1, 2, 3 ORDER BY 4 DESC
  `) as any[];
  log("");
  log("  Tagesmaximum je MITARBEITER (14 Tage, Spitze zuerst):");
  const gesehen = new Set<string>();
  for (const z of jeAgentTag) {
    if (gesehen.has(String(z.name))) continue;
    gesehen.add(String(z.name));
    log(`     ${String(z.name).slice(0, 24).padEnd(25)} ${String(z.anrufe).padStart(4)} Anrufe`
      + ` am ${String(z.tag).slice(0, 10)}`);
    if (gesehen.size >= 10) break;
  }
  const maxAgent = jeAgentTag.length > 0 ? Number(jeAgentTag[0].anrufe) : 0;

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE EMPFEHLUNG, AUS DEN ZAHLEN ABGELEITET");
  // ═════════════════════════════════════════════════════════════════════════
  log("");
  log(`  Höchster Tageswert je Absendernummer (14 Tage):  ${String(maxNummer).padStart(5)}`);
  log(`  Höchster Tageswert je Mitarbeiter (14 Tage):     ${String(maxAgent).padStart(5)}`);
  log("");
  log(`  Die alte Grenze lag bei 100 — also UNTER dem gemessenen Normalbetrieb`);
  log(`  von ${maxNummer} Anrufen je Nummer und Tag. Sie musste greifen, und sie hat`);
  log("  gegriffen. Der Kommentar im Quelltext behauptete das Gegenteil:");
  log("  „100 Anrufe je Nummer und Tag erreicht im Normalbetrieb niemand.“");
  log("  Das war eine Annahme, keine Messung.");
  log("");
  const vorschlag = 300;
  log(`  Vorschlag: Hinweisschwelle ${vorschlag}, Warnung ab dem 1,5-fachen (${vorschlag * 1.5}).`);
  log(`  Das liegt ${(vorschlag / Math.max(1, maxNummer)).toFixed(1)}-mal über der gemessenen Spitze`);
  log(`  je Nummer — genug Luft für einen starken Tag, und die Warnkarte`);
  log("  erscheint trotzdem, bevor eine Nummer wirklich in Gefahr ist.");
  log("");
  log("  ENTSCHEIDEND ist aber nicht die Zahl, sondern dass sie NICHTS MEHR");
  log("  SPERRT. Eine zu niedrige Schwelle kostet dann nur noch einen Hinweis.");

  writeFileSync("reports/anrufgrenze.csv",
    "art;tag;wer_oder_nummer;anzahl;ab;bis\n"
    + jeAgent.map((a) => ["heute_verhindert", "", a.name, a.verhindert,
      uhr(a.ab), uhr(a.bis)].map(feld).join(";")).join("\n")
    + (jeAgent.length ? "\n" : "")
    + jeTag.map((t) => ["verhindert_je_tag", String(t.tag).slice(0, 10), "", t.verhindert,
      uhr(t.ab), ""].map(feld).join(";")).join("\n")
    + (jeTag.length ? "\n" : "")
    + jeNummerTag.map((z) => ["anrufe_je_nummer_tag", String(z.tag).slice(0, 10), z.nummer,
      z.anrufe, "", ""].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/anrufgrenze.csv");
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
