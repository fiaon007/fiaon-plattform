// ═══════════════════════════════════════════════════════════════════════════
// E-IT-F (08.10.2026) — EINMAL-LAUF FÜR DEN AUFTRAGS-BESTAND
//
// Was der Deploy NICHT von selbst tut, und warum es eine Freigabe braucht:
//
//   1. KUNDE UND ART NACHTRAGEN. Das macht der Server nach dem Deploy auch
//      selbst (Tageslauf „auftraege-zuordnen", Listen beim Laden). Dieser Lauf
//      zeigt VORHER, was herauskommt: wie viele offene Mitarbeiter-Aufträge
//      danach einen Kundennamen tragen (gemessen am 07.10.: 47 % → Ziel ≥ 92 %),
//      woher die Person kommt (Link, WhatsApp-Schlüssel, Referenz, Mail-Marke)
//      und welche Art. „postmeister:<n>:aufgabe" wird NIE als Person gelesen
//      (<n> ist teils eine Mail-Kennung — 10 Fehlzuordnungen gemessen).
//
//   2. RÜCKWIRKEND AUTOMATISCH ERLEDIGEN. Die neuen Haken wirken ab dem Deploy.
//      Im Bestand stehen Aufträge, nach deren Eingang die Akte schon ein
//      passendes Ereignis zeigt (gemessen: 123 mit Kontaktergebnis nach der
//      letzten Neuigkeit; 71, wenn nur das Ergebnis des Zuständigen zählt).
//      Dieselben Regeln wie live (shared/fiaon-auftrag-arten.ts): nie
//      nurHand-Arten, nie mit offener Frage, nie bei neuerer Kundennachricht,
//      „Kunde hat geschrieben" nie bei wartendem Antwortentwurf.
//
//   3. LAGE ZEIGEN: Status-Konsistenz (nach Migration 102 muss sie 0 sein),
//      doppelte Systemzeilen (werden NICHT gelöscht — die Zeitleiste faltet sie).
//
// Aufruf (Standard ist der TROCKENLAUF — er schreibt nichts, Lesetransaktion):
//   npx tsx scripts/it-f-einmal.ts                         Vorschau
//   npx tsx scripts/it-f-einmal.ts --alle-kontakte         auch Kontakte von Kollegen (NICHT wie live)
//   npx tsx scripts/it-f-einmal.ts --ausfuehren            schreibt (nach Freigabe!)
//   npx tsx scripts/it-f-einmal.ts --ausfuehren --nur-zuordnung   nur Schritt 1
//
// Beim Ausführen: zuerst Sicherung (JSON) und Rückweg-SQL nach reports/, dann
// EINE Transaktion. Der Rückweg öffnet die nachgetragenen Erledigungen wieder
// (die Wand schreibt „Wieder offen: Rückweg …" in die Zeitleiste) — nichts wird
// gelöscht. Voraussetzung: Migration 102 ist gelaufen (Spalten + Wand).
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { auftragErledigen, statusWandDa, zuordnungFuer, type Zuordnung } from "../server/lib/fiaon-auftraege";
import { AUFTRAG_ARTEN, AUFTRAG_ART_LISTE, AUFTRAG_EREIGNISSE, artNachInhalt, artRegel, berlinTagZeit, type AuftragEreignis } from "../shared/fiaon-auftrag-arten";

const AUSFUEHREN = process.argv.includes("--ausfuehren");
// Wie live (Gegenprüfung 08.10.): Ein Kontakt schließt nur Aufträge des Handelnden selbst.
const NUR_ZUSTAENDIGER = !process.argv.includes("--alle-kontakte");
const NUR_ZUORDNUNG = process.argv.includes("--nur-zuordnung");
const STEMPEL = new Date().toISOString().replace(/[:.]/g, "-");
const MARKE = `Einmal-Lauf it-f ${STEMPEL.slice(0, 16)}`;
const log = (s = "") => console.log(s);
const titel = (t: string) => log(`\n${"═".repeat(78)}\n${t}\n${"═".repeat(78)}`);
type Lauf = typeof sqlPool;

/** Woher die Datenbank kommt — ohne Zugangsdaten. */
function ziel(): string {
  try { const u = new URL(String(process.env.DATABASE_URL)); return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`; } catch { return "(unbekannt)"; }
}

const EREIGNIS_SPALTE: Record<string, AuftragEreignis> = {
  kontakt: "ergebnis_erreicht", rueckruf: "rueckruf_erledigt", termin: "termin_gefuehrt", whatsapp: "whatsapp_beantwortet",
  karte: "kartenlink_gesendet", anforderung: "unterlage_angefordert", upload: "unterlage_erhalten", zahlung: "zahlung_gebucht",
};

interface Kandidat { id: number; art: string; titel: string; zustaendig: number | null; status: string; agentGelesenAm: string | null; ereignis: AuftragEreignis; am: string; wer: string }

async function zuordnungen(lauf: Lauf): Promise<Zuordnung[]> {
  const zeilen = (await lauf`
    SELECT id, link, schluessel, LEFT(text, 20000) AS text, titel, quelle, bereich, person_id, ref
      FROM fiaon_betreiber_todos WHERE zugeordnet_am IS NULL ORDER BY id`) as any[];
  const aus: Zuordnung[] = [];
  for (const z of zeilen) aus.push(await zuordnungFuer(z, lauf));
  return aus;
}

async function kandidatenFinden(lauf: Lauf, zu: Zuordnung[]): Promise<Kandidat[]> {
  const autoArten = AUFTRAG_ART_LISTE.filter((a) => !AUFTRAG_ARTEN[a].nurHand && AUFTRAG_ARTEN[a].schliesstBei.length > 0);
  const ids = zu.map((z) => z.id), pids = zu.map((z) => z.personId ?? 0), refs = zu.map((z) => z.ref ?? ""), arten = zu.map((z) => z.art as string);
  const zeilen = (await lauf`
    WITH neu AS (SELECT * FROM unnest(${ids}::int[], ${pids}::int[], ${refs}::text[], ${arten}::text[]) AS n(id, pid, ref, art)),
    t AS (
      SELECT t.id, t.titel, t.status, t.zustaendig_agent_id, t.agent_gelesen_am,
             t.schluessel, t.quelle, t.bereich, LEFT(t.text, 20000) AS text,
             (SELECT ag.name FROM fiaon_agents ag WHERE ag.id = t.zustaendig_agent_id) AS zust_name,
             COALESCE(t.art, neu.art) AS art,
             COALESCE(t.person_id, NULLIF(neu.pid, 0)) AS person_id,
             COALESCE(t.ref, NULLIF(neu.ref, '')) AS ref,
             -- Nach der letzten Neuigkeit UND nach einem Wieder-Öffnen: Wer selbst wieder geöffnet hat, will den Auftrag offen.
             GREATEST(COALESCE(t.eingang_am, t.created_at), COALESCE(t.neu_seit, t.created_at), COALESCE(t.wieder_offen_am, t.created_at)) AS basis
        FROM fiaon_betreiber_todos t LEFT JOIN neu ON neu.id = t.id
       WHERE t.status NOT IN ('erledigt', 'wartet') AND NOT t.frage_offen AND NOT t.frage_an_agent
         AND t.zustaendig_art = 'agent'),
    k AS (
      SELECT t.*,
             ARRAY(SELECT p.id FROM fiaon_persons p WHERE p.id = t.person_id OR p.merged_into_person_id = t.person_id) AS pids,
             ARRAY(SELECT a.ref FROM fiaon_applications a WHERE a.person_id = t.person_id) AS refs
        FROM t WHERE t.art = ANY(${autoArten}::text[]))
    SELECT k.id, k.art, k.titel, k.status, k.zustaendig_agent_id, k.agent_gelesen_am, k.basis, k.pids,
      k.schluessel, k.quelle, k.bereich, k.text,
      (SELECT json_build_object('am', c.created_at, 'wer', c.agent_name) FROM fiaon_contact_log c
        WHERE c.type = 'result' AND c.voided_at IS NULL AND c.created_at > k.basis
          AND (c.outcome LIKE 'erreicht%' OR c.outcome IN ('rueckruf_termin', 'rate_zahlt_am', 'rate_ueberwiesen_beleg', 'rate_ratenpause', 'rate_eskalation'))
          AND (c.person_id = ANY(k.pids) OR c.ref = ANY(k.refs))
          AND (NOT ${NUR_ZUSTAENDIGER} OR c.agent_id = k.zustaendig_agent_id)
        ORDER BY c.created_at ASC LIMIT 1) AS kontakt,
      (SELECT json_build_object('am', r.erledigt_am, 'wer', r.erledigt_von) FROM fiaon_rueckrufe r
        WHERE r.status = 'erledigt' AND r.erledigt_am > k.basis AND r.person_id = ANY(k.pids)
          AND (NOT ${NUR_ZUSTAENDIGER} OR r.erledigt_von = k.zust_name) ORDER BY r.erledigt_am LIMIT 1) AS rueckruf,
      (SELECT json_build_object('am', te.erledigt_am, 'wer', ag.name) FROM fiaon_termine te LEFT JOIN fiaon_agents ag ON ag.id = te.agent_id
        WHERE te.status = 'erledigt' AND te.erledigt_am > k.basis AND te.person_id = ANY(k.pids)
          AND (NOT ${NUR_ZUSTAENDIGER} OR te.agent_id = k.zustaendig_agent_id) ORDER BY te.erledigt_am LIMIT 1) AS termin,
      (SELECT json_build_object('am', w.created_at, 'wer', w.von) FROM fiaon_whatsapp w
        WHERE w.richtung = 'raus' AND w.vorlage IS NULL AND COALESCE(w.auto_antwort, FALSE) = FALSE
          AND w.von IS NOT NULL AND w.von NOT IN ('Mara', 'Mara Lindner', 'System')
          AND w.created_at > k.basis AND w.person_id = ANY(k.pids)
          AND (NOT ${NUR_ZUSTAENDIGER} OR w.von = k.zust_name) ORDER BY w.created_at LIMIT 1) AS whatsapp,
      (SELECT json_build_object('am', kk.gesendet_am, 'wer', kk.agent_name) FROM fiaon_konto_karte kk
        WHERE kk.gesendet_am > k.basis AND kk.person_id = ANY(k.pids)
          AND (NOT ${NUR_ZUSTAENDIGER} OR kk.agent_name IS NULL OR kk.agent_name = k.zust_name) ORDER BY kk.gesendet_am LIMIT 1) AS karte,
      (SELECT json_build_object('am', m.created_at, 'wer', COALESCE(m.ausgeloest_von, 'System')) FROM fiaon_mail_log m
        WHERE m.event = 'documents_change_request' AND m.status = 'versandt' AND m.created_at > k.basis AND m.person_id = ANY(k.pids)
        ORDER BY m.created_at LIMIT 1) AS anforderung,
      (SELECT json_build_object('am', a.documents_uploaded_at, 'wer', 'Kunde (Upload)') FROM fiaon_applications a
        WHERE a.documents_uploaded_at > k.basis AND a.person_id = ANY(k.pids) ORDER BY a.documents_uploaded_at LIMIT 1) AS upload,
      (SELECT json_build_object('am', z.am, 'wer', 'System') FROM (
         SELECT ra.bezahlt_am AS am FROM fiaon_abo_raten ra WHERE k.ref IS NOT NULL AND ra.ref = k.ref AND ra.status = 'bezahlt' AND ra.bezahlt_am > k.basis
         UNION ALL
         SELECT a.paid_at FROM fiaon_applications a WHERE k.ref IS NOT NULL AND a.ref = k.ref AND a.payment_status = 'paid' AND a.paid_at > k.basis
       ) z ORDER BY z.am LIMIT 1) AS zahlung
    FROM k ORDER BY k.id`) as any[];

  const aus: Kandidat[] = [];
  let entwurfFrei: Map<string, boolean> = new Map();
  for (const z of zeilen) {
    // Wie live (durchEreignisRoh): die Art aus dem JETZIGEN Titel und Text — Heikles (Widerruf, Beschwerde,
    // Löschwunsch, heikle Übergabegründe) ist nur von Hand und kommt nie in den Einmal-Lauf.
    const artJetzt = artNachInhalt(z.art, { schluessel: z.schluessel, quelle: z.quelle, bereich: z.bereich, titel: z.titel, text: z.text });
    const regel = artRegel(artJetzt);
    if (regel.nurHand) continue;
    const moeglich = Object.entries(EREIGNIS_SPALTE)
      .filter(([spalte, e]) => z[spalte] && regel.schliesstBei.includes(e))
      // Welche Unterlage kam/angefordert wurde, steht hier nicht — live schließt nur die passende (unterlagePasst).
      .filter(([spalte]) => !(z.art === "unterlage" && (spalte === "upload" || spalte === "anforderung")))
      .map(([spalte, e]) => ({ e, am: String(z[spalte].am), wer: String(z[spalte].wer || "System") }))
      .sort((a, b) => new Date(a.am).getTime() - new Date(b.am).getTime());
    if (!moeglich.length) continue;
    if (regel.nurOhneOffenenEntwurf) {
      const k = String(z.pids);
      if (!entwurfFrei.has(k)) {
        const [w] = (await lauf`
          SELECT 1 AS da FROM fiaon_postmeister p
           WHERE p.person_id = ANY(${z.pids}::int[]) AND p.gesendet_am IS NULL
             AND p.aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen', 'sendet')
             AND NOT (p.aktion = 'fehler' AND p.created_at < NOW() - INTERVAL '14 days') LIMIT 1`.catch(() => [{ da: 1 }])) as any[];
        entwurfFrei.set(k, !w);
      }
      if (!entwurfFrei.get(k)) continue;
    }
    const m = moeglich[0];
    aus.push({ id: Number(z.id), art: String(z.art), titel: String(z.titel || ""), zustaendig: z.zustaendig_agent_id ? Number(z.zustaendig_agent_id) : null, status: String(z.status), agentGelesenAm: z.agent_gelesen_am ? new Date(z.agent_gelesen_am).toISOString() : null, ereignis: m.e, am: m.am, wer: m.wer });
  }
  entwurfFrei = new Map();
  return aus;
}

async function lage(lauf: Lauf): Promise<void> {
  const [k] = (await lauf`
    SELECT COUNT(*) FILTER (WHERE status <> 'erledigt' AND (erledigt_am IS NOT NULL OR erledigt_von IS NOT NULL OR ergebnis IS NOT NULL))::int AS offen_mit_spuren,
           COUNT(*) FILTER (WHERE status = 'erledigt' AND erledigt_am IS NULL)::int AS erledigt_ohne_zeit,
           COUNT(*) FILTER (WHERE status <> 'erledigt' AND zustaendig_art = 'agent')::int AS offen_team
      FROM fiaon_betreiber_todos`) as any[];
  const [d] = (await lauf`
    SELECT COALESCE(SUM(n - 1), 0)::int AS doppelt FROM (
      SELECT COUNT(*) AS n FROM fiaon_betreiber_todo_beitraege WHERE autor_art = 'system' GROUP BY todo_id, md5(text) HAVING COUNT(*) > 1) x`) as any[];
  log(`  Offene Aufträge beim Team:                 ${k.offen_team}`);
  log(`  Offen MIT Erledigt-Spuren (soll 0):        ${k.offen_mit_spuren}`);
  log(`  Erledigt OHNE erledigt_am (soll 0):        ${k.erledigt_ohne_zeit}`);
  log(`  Überzählige gleiche Systemzeilen:          ${d.doppelt}  (bleiben stehen — die Zeitleiste faltet sie)`);
  log(`  Wand (Trigger fiaon_todo_status_wand):     ${(await statusWandDa(lauf)) ? "steht" : "FEHLT — Migration 102 zuerst!"}`);
}

async function main(): Promise<void> {
  titel(`E-IT-F EINMAL-LAUF — ${AUSFUEHREN ? "AUSFÜHREN" : "TROCKENLAUF (schreibt nichts)"} — ${ziel()}`);
  log(NUR_ZUSTAENDIGER ? "  Nur Kontakte (Ergebnis, Termin, Rückruf, WhatsApp) des zuständigen Mitarbeiters zählen — wie live."
    : "  --alle-kontakte: auch Kontakte von Kollegen zählen (weicht von der Live-Regel ab).");

  // ── Alles erst lesend: Zuordnung im Speicher, Kandidaten mit dieser Zuordnung ──
  const ergebnis = await sqlPool.begin("READ ONLY", async (tx: any) => {
    titel("LAGE");
    await lage(tx);
    const zu = await zuordnungen(tx);
    const kand = NUR_ZUORDNUNG ? [] : await kandidatenFinden(tx, zu);
    // Sichtbarkeit des Namens bei offenen Team-Aufträgen: vorher (Link-Rater) und nachher (person_id).
    const offen = (await tx`
      SELECT t.id, t.person_id, t.link FROM fiaon_betreiber_todos t
       WHERE t.status <> 'erledigt' AND t.zustaendig_art = 'agent'`) as any[];
    const nachZu = new Map(zu.map((z) => [z.id, z]));
    const mitPerson = offen.filter((o) => o.person_id || nachZu.get(Number(o.id))?.personId).length;
    return { zu, kand, offen: offen.length, mitPerson };
  });

  titel("1. KUNDE UND ART NACHTRAGEN");
  const jeQuelle = new Map<string, number>(); const jeArt = new Map<string, number>();
  for (const z of ergebnis.zu) { jeQuelle.set(z.quelle, (jeQuelle.get(z.quelle) || 0) + 1); jeArt.set(z.art, (jeArt.get(z.art) || 0) + 1); }
  log(`  Zeilen ohne Zuordnung: ${ergebnis.zu.length}`);
  log(`  Person gefunden über: ${Array.from(jeQuelle.entries()).map(([q, n]) => `${q} ${n}`).join(" · ") || "—"}`);
  log(`  Arten: ${Array.from(jeArt.entries()).sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a} ${n}`).join(" · ") || "—"}`);
  log(`  Offene Team-Aufträge mit Kunde danach: ${ergebnis.mitPerson} von ${ergebnis.offen} (${ergebnis.offen ? Math.round((ergebnis.mitPerson / ergebnis.offen) * 1000) / 10 : 0} %)`);

  if (!NUR_ZUORDNUNG) {
    titel("2. RÜCKWIRKEND AUTOMATISCH ERLEDIGEN (Kandidaten)");
    const jeEreignis = new Map<string, number>();
    for (const k of ergebnis.kand) jeEreignis.set(`${k.art} ← ${k.ereignis}`, (jeEreignis.get(`${k.art} ← ${k.ereignis}`) || 0) + 1);
    log(`  Kandidaten: ${ergebnis.kand.length}`);
    for (const [k, n] of Array.from(jeEreignis.entries()).sort((a, b) => b[1] - a[1])) log(`    ${String(n).padStart(4)}  ${k}`);
    for (const k of ergebnis.kand.slice(0, 40)) log(`    #${k.id}  ${k.art.padEnd(18)} ${AUFTRAG_EREIGNISSE[k.ereignis].label} – ${k.wer}, ${berlinTagZeit(k.am)}`);
    if (ergebnis.kand.length > 40) log(`    … und ${ergebnis.kand.length - 40} weitere (vollständig in der CSV).`);
  }

  mkdirSync("reports", { recursive: true });
  const csv = ["id;art;ereignis;am;wer;zustaendig", ...ergebnis.kand.map((k) => [k.id, k.art, k.ereignis, k.am, `"${k.wer.replace(/"/g, "'")}"`, k.zustaendig ?? ""].join(";"))].join("\n");
  writeFileSync(`reports/it-f-einmal-${STEMPEL}-kandidaten.csv`, csv);
  log(`\n  Kandidatenliste: reports/it-f-einmal-${STEMPEL}-kandidaten.csv`);

  if (!AUSFUEHREN) {
    log("\n  TROCKENLAUF — nichts geschrieben. Ausführen (nur nach Freigabe): --ausfuehren");
    await sqlPool.end();
    return;
  }
  if (!(await statusWandDa())) { log("\n  ABBRUCH: Migration 102 (Wand) fehlt."); process.exitCode = 1; await sqlPool.end(); return; }

  // ── Sicherung und Rückweg VOR dem Schreiben ──────────────────────────────
  const sicherung = { stempel: STEMPEL, marke: MARKE, ziel: ziel(), zuordnung: ergebnis.zu, erledigen: ergebnis.kand };
  writeFileSync(`reports/it-f-einmal-${STEMPEL}-sicherung.json`, JSON.stringify(sicherung, null, 1));
  const rueck = [
    `-- Rückweg ${MARKE} (nur mit Justins Go ausführen). Nichts wird gelöscht: die Wand schreibt „Wieder offen: …".`,
    "BEGIN;",
    ...ergebnis.kand.map((k) => `UPDATE fiaon_betreiber_todos SET status = '${k.status === "in_arbeit" ? "in_arbeit" : "offen"}', wieder_offen_grund = 'Rückweg ${MARKE}', agent_gelesen_am = ${k.agentGelesenAm ? `'${k.agentGelesenAm}'` : "NULL"} WHERE id = ${k.id} AND status = 'erledigt' AND erledigt_ereignis LIKE '%(${MARKE})%';`),
    ergebnis.zu.length ? `UPDATE fiaon_betreiber_todos SET person_id = NULL, ref = NULL, art = NULL, zugeordnet_am = NULL WHERE id IN (${ergebnis.zu.map((z) => z.id).join(",")}) AND zugeordnet_am >= '${new Date().toISOString()}';` : "-- keine Zuordnung",
    "COMMIT;",
  ].join("\n");
  writeFileSync(`reports/it-f-einmal-${STEMPEL}-rueckweg.sql`, rueck);
  log(`  Sicherung: reports/it-f-einmal-${STEMPEL}-sicherung.json`);
  log(`  Rückweg:   reports/it-f-einmal-${STEMPEL}-rueckweg.sql`);

  const geschrieben = await sqlPool.begin(async (tx: any) => {
    await tx`SET LOCAL lock_timeout = '5s'`;
    let zugeordnet = 0, erledigt = 0;
    for (const z of ergebnis.zu) {
      await tx`UPDATE fiaon_betreiber_todos SET person_id = ${z.personId}, ref = ${z.ref}, art = ${z.art}, zugeordnet_am = NOW() WHERE id = ${z.id} AND zugeordnet_am IS NULL`;
      zugeordnet += 1;
    }
    for (const k of ergebnis.kand) {
      const was = `${AUFTRAG_EREIGNISSE[k.ereignis].label} – ${k.wer}, ${berlinTagZeit(k.am)}`;
      const ok = await auftragErledigen(k.id, {
        art: "auto", von: k.wer, autorArt: "system",
        ereignis: `${was} (${MARKE})`,
        ergebnis: `Automatisch erledigt durch ${was} — nachgetragen beim Umbau E-IT-F (${MARKE}).`,
        beitragText: `Automatisch erledigt durch ${was} — nachgetragen beim Umbau E-IT-F (${MARKE}).`,
      }, tx);
      if (ok) erledigt += 1;
    }
    return { zugeordnet, erledigt };
  });
  titel("GESCHRIEBEN");
  log(`  Zugeordnet: ${geschrieben.zugeordnet} · automatisch erledigt (nachgetragen): ${geschrieben.erledigt}`);
  await sqlPool.end();
}

main().catch(async (e) => { console.error("FEHLER:", e); process.exitCode = 1; await sqlPool.end().catch(() => {}); });
