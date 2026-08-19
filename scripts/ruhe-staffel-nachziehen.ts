// ═══════════════════════════════════════════════════════════════════════════
// DIE RUHE-STAFFEL AUF DEN BESTAND ANWENDEN
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Kunden, die bereits mehrfach erfolglos angerufen wurden, teilweise 10–12 Mal
// oder mehr, erscheinen trotzdem weiterhin weit oben."
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// 26 Personen mit neun und mehr erfolglosen Versuchen standen in der
// Arbeitsliste. Die Automatik feuerte nur EINMAL (Begründung in
// `server/lib/fiaon-nicht-erreicht.ts`), und Stufe A war dauerhaft ausgenommen.
//
// ── WAS DER LAUF TUT ───────────────────────────────────────────────────────
// Er wendet die neue Staffel auf den BESTAND an — die Automatik greift ab jetzt
// bei jedem neuen Fehlversuch, aber die 26 von heute ruft sie nie an, weil bei
// ihnen kein neuer Versuch mehr dokumentiert werden soll.
//
//   ab 9 Versuchen   ruhe_seit setzen, Wiedervorlage leeren  → RUHEND
//   3–8 Versuche     Wiedervorlage strecken, wenn sie fällig ist
//
// Er fasst NICHT an: gesperrte, zusammengeführte, DSGVO-gelöschte Personen und
// jeden, der einen Termin in der Zukunft hat — ein gebuchter Termin ist das
// Gegenteil von „nicht erreichbar".
//
//   npx tsx scripts/ruhe-staffel-nachziehen.ts              # Vorschau
//   npx tsx scripts/ruhe-staffel-nachziehen.ts --schreiben  # anwenden
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  SCHWELLE_RUHEND, SCHWELLE_STRECKEN, SCHWELLE_MAIL, SCHWELLE_LEITUNG,
  STRECKUNG_TAGE, STRECKUNG_TAGE_LANG, LEITUNG_WIEDERVORLAGE_TAGE,
  ruhtSql, stufeASql,
} from "../server/lib/fiaon-nicht-erreicht";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

/** Ein Termin in der Zukunft heißt: Der Kunde hat sich gemeldet. Finger weg. */
const HAT_TERMIN = `EXISTS (SELECT 1 FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW())`;

const LEBENDIG = `p.merged_into_person_id IS NULL
    AND COALESCE(p.is_blocked, FALSE) = FALSE
    AND NOT ${HAT_TERMIN}`;

async function main(): Promise<void> {
  titel(`RUHE-STAFFEL NACHZIEHEN — ${SCHREIBEN ? "SCHREIBEND" : "VORSCHAU"}`);
  log(`  Staffel: ab ${SCHWELLE_STRECKEN} Versuchen +${STRECKUNG_TAGE} Tage, `
    + `ab ${SCHWELLE_MAIL} +${STRECKUNG_TAGE_LANG} Tage, ab ${SCHWELLE_RUHEND} RUHEND.`);

  // ══════════════════════════════════════════════════════════════════════════
  // GRUPPE 0: STUFE A ZURÜCKHOLEN (19.08.2026, Betreiber)
  //
  // „Kunden mit GEMELDETER Zahlung ruhen NIE automatisch. Die bereits ruhenden
  // Stufe-A-Fälle entsprechend zurückholen."
  //
  // Die neue `ruhtSql` nimmt Stufe A ohnehin aus der Ruhe-Bedingung — sie stehen
  // also ab dem Deploy wieder in der Liste. Die MARKE `ruhe_seit` bleibt aber in
  // der Zeile stehen, und eine Marke, die nichts mehr bedeutet, ist eine Lüge in
  // der Datenbank: Der nächste Leser (oder die nächste Abfrage) hält den Fall
  // für ruhend. Also wird sie entfernt.
  //
  // Die Wiedervorlage wird auf HEUTE gesetzt, nicht geleert: Diese Menschen
  // wurden wochenlang nicht angerufen, weil sie unsichtbar waren. Sie gehören
  // heute bearbeitet.
  //
  // ── NUR DIE RUHENDEN, NICHT ALLE MIT ZUKUNFTSDATUM ──────────────────────
  // Der erste Entwurf dieser Abfrage lautete
  // `ruhe_seit IS NOT NULL OR follow_up_date > CURRENT_DATE` und traf **114**
  // Menschen. Das war falsch und wäre teuer geworden: Ein Stufe-A-Kunde, der
  // „ich zahle am 25." zugesagt hat, trägt eine Wiedervorlage in der Zukunft —
  // das ist eine VEREINBARUNG, keine Ruhe. Sie auf heute zu ziehen hätte 114
  // Zusagen zerstört und die Leute zu früh angerufen.
  //
  // Der Betreiber hat „die bereits ruhenden Fälle" gesagt. Ruhend heißt
  // `ruhe_seit IS NOT NULL` — nur die.
  // ══════════════════════════════════════════════════════════════════════════
  const stufeAZurueck = (await sqlPool.unsafe(`
    SELECT p.id, p.unreachable_count AS v, p.ruhe_seit, p.follow_up_date,
           p.promised_payment_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE p.merged_into_person_id IS NULL
       AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND ${stufeASql("p")}
       AND p.ruhe_seit IS NOT NULL
     ORDER BY p.unreachable_count DESC
  `)) as any[];

  log(`\n  ${stufeAZurueck.length} Stufe-A-Fälle (gemeldete Zahlung) tragen eine Ruhe-Marke`);
  log("  — sie werden zurückgeholt:");
  log("  Versuche  Betreuer             Kunde");
  log("  " + "─".repeat(62));
  for (const r of stufeAZurueck) {
    log(`  ${String(r.v ?? 0).padStart(8)}  ${String(r.agent ?? "(niemand)").padEnd(20)} ${r.name}`);
  }

  // Und wie viele davon brauchen zusätzlich eine Entscheidung der Leitung?
  const [entscheiden] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND ${stufeASql("p")} AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_LEITUNG}
  `)) as any[];
  log(`\n  ${entscheiden.n} davon haben >= ${SCHWELLE_LEITUNG} Fehlversuche — sie brauchen eine`);
  log(`  Aufgabe an die Vertriebsleitung (Wiedervorlage +${LEITUNG_WIEDERVORLAGE_TAGE} Tage).`);

  // ── GRUPPE 1: RUHEND (ohne Stufe A) ─────────────────────────────────────
  // `NOT ruhtSql(p)` allein genügt hier NICHT mehr: Seit Stufe A aus der
  // Ruhe-Bedingung ausgenommen ist, erfüllen genau die 38 Stufe-A-Fälle
  // „gilt nicht als ruhend" — und dieser Lauf hätte ihnen `ruhe_seit` gesetzt.
  // Also genau das, was der Betreiber verboten hat, im Namen der Umsetzung.
  // Gefunden in der Vorschau, bevor geschrieben wurde.
  const ruhend = (await sqlPool.unsafe(`
    SELECT p.id, p.unreachable_count AS v, p.priority_tier, p.ruhe_seit, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE ${LEBENDIG}
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_RUHEND}
       AND NOT ${stufeASql("p")}
       AND NOT ${ruhtSql("p")}
     ORDER BY p.unreachable_count DESC
  `)) as any[];

  log(`\n  ${ruhend.length} Personen mit >= ${SCHWELLE_RUHEND} Versuchen stehen noch in der Tagesliste:`);
  log("  Versuche  Stufe  Betreuer             Kunde");
  log("  " + "─".repeat(70));
  for (const r of ruhend) {
    log(`  ${String(r.v).padStart(8)}  ${String(r.priority_tier ?? "-").padStart(5)}  `
      + `${String(r.agent ?? "(niemand)").padEnd(20)} ${r.name}`);
  }

  // ── GRUPPE 2: WIEDERVORLAGE STRECKEN ────────────────────────────────────
  // Auch hier ohne Stufe A: Eine gemeldete Zahlung wird nicht um drei Tage
  // nach hinten geschoben — dort ist die Frage offen, nicht der Kontakt.
  const strecken = (await sqlPool.unsafe(`
    SELECT p.id, p.unreachable_count AS v, p.follow_up_date,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name
      FROM fiaon_persons p
     WHERE ${LEBENDIG}
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_STRECKEN}
       AND COALESCE(p.unreachable_count, 0) < ${SCHWELLE_RUHEND}
       AND NOT ${stufeASql("p")}
       AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
     ORDER BY p.unreachable_count DESC
  `)) as any[];
  log(`\n  ${strecken.length} Personen mit ${SCHWELLE_STRECKEN}–${SCHWELLE_RUHEND - 1} Versuchen sind fällig`);
  log("  und bekommen eine gestreckte Wiedervorlage.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/ruhe-staffel-nachziehen.csv", "\uFEFF"
    + ["person_id;name;betreuer;versuche;stufe;wirkung"]
      .concat(ruhend.map((r) => `${r.id};${r.name};${r.agent ?? ""};${r.v};${r.priority_tier ?? ""};RUHEND`))
      .concat(strecken.map((r) => `${r.id};${r.name};;${r.v};;Wiedervorlage gestreckt`))
      .join("\n"));
  log(`\n  → reports/ruhe-staffel-nachziehen.csv (${ruhend.length + strecken.length} Zeilen)`);

  if (!SCHREIBEN) {
    log("\n  Das ist die VORSCHAU. Es wurde nichts geändert.");
    log("  Anwenden mit: npx tsx scripts/ruhe-staffel-nachziehen.ts --schreiben");
    await zaehlprobe();
    await sqlPool.end();
    return;
  }

  // ── GRUPPE 0 SCHREIBEN: Stufe A zurückholen ─────────────────────────────
  let zurueck = 0;
  let aufgaben = 0;
  for (const r of stufeAZurueck) {
    // Eine ZUSAGE in der Zukunft schlägt die Wiedervorlage: Wer „ich zahle am
    // 25." gesagt hat, wird nicht am 20. angerufen. Nur wo keine Zusage steht,
    // holt der Lauf den Fall auf heute.
    const erg = await sqlPool`
      UPDATE fiaon_persons
         SET ruhe_seit = NULL,
             follow_up_date = CASE
               WHEN promised_payment_date IS NOT NULL AND promised_payment_date > CURRENT_DATE
                 THEN promised_payment_date
               ELSE CURRENT_DATE
             END,
             updated_at = NOW()
       WHERE id = ${r.id} AND COALESCE(priority_tier, 3) = 1
    `;
    if ((erg as any).count > 0) zurueck++;
  }
  log(`\n  ${zurueck} Stufe-A-Fälle zurückgeholt (Ruhe-Marke entfernt, Wiedervorlage heute).`);

  // Und für die mit >= 9 Versuchen die Aufgabe an die Leitung — über DIESELBE
  // Funktion, die die Automatik benutzt. Ein zweiter Weg hier wäre eine zweite
  // Fassung derselben Regel.
  //
  // NICHT über `automatikNachFehlversuch`: Die verschickt ab dem 6. Fehlversuch
  // eine Terminlink-Mail, und dieser Lauf würde damit bis zu 38 echte Mails
  // auslösen. `stufeAAnLeitung` sendet nichts.
  const brauchtEntscheidung = (await sqlPool.unsafe(`
    SELECT p.id FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND ${stufeASql("p")} AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_LEITUNG}
  `)) as any[];
  const { stufeAAnLeitung } = await import("../server/lib/fiaon-nicht-erreicht");
  for (const p of brauchtEntscheidung) {
    const w = await stufeAAnLeitung(Number(p.id));
    if (w.aufgabe) aufgaben++;
  }
  // „sichergestellt", nicht „angelegt": Beim zweiten Lauf wird die bestehende
  // Aufgabe nur auf den neuen Versuchsstand gebracht. Ein Lauf, der beim
  // zweiten Mal „38 angelegt" meldet, obwohl 38 dastehen, erzählt eine falsche
  // Geschichte — und beim dritten Mal glaubt niemand mehr den Zahlen.
  log(`  ${aufgaben} Aufgaben an die Vertriebsleitung sichergestellt `
    + "(angelegt oder auf den neuen Stand gebracht — eine je Person, nicht je Versuch).");

  let a = 0;
  for (const r of ruhend) {
    const erg = await sqlPool`
      UPDATE fiaon_persons
         SET ruhe_seit = COALESCE(ruhe_seit, NOW()), follow_up_date = NULL, updated_at = NOW()
       WHERE id = ${r.id} AND COALESCE(unreachable_count, 0) >= ${SCHWELLE_RUHEND}
    `;
    if ((erg as any).count > 0) a++;
  }
  log(`\n  ${a} Personen auf RUHEND gesetzt.`);

  let b = 0;
  for (const r of strecken) {
    const tage = Number(r.v) >= SCHWELLE_MAIL ? STRECKUNG_TAGE_LANG : STRECKUNG_TAGE;
    const erg = await sqlPool`
      UPDATE fiaon_persons
         SET follow_up_date = (CURRENT_DATE + ${tage}::int), updated_at = NOW()
       WHERE id = ${r.id}
         AND (follow_up_date IS NULL OR follow_up_date < (CURRENT_DATE + ${tage}::int))
    `;
    if ((erg as any).count > 0) b++;
  }
  log(`  ${b} Wiedervorlagen gestreckt.`);

  await zaehlprobe();
  await sqlPool.end();
}

/**
 * Der Beweis, den der Auftrag verlangt: Die Tagesliste enthält keinen Kunden
 * mit neun oder mehr Versuchen ohne Termin.
 */
async function zaehlprobe(): Promise<void> {
  titel("ZÄHLPROBE — Tagesliste, Personen mit >= 9 Versuchen ohne Termin");
  // ── DIE PROBE ZÄHLT STUFE A NICHT MIT (19.08.2026) ──────────────────────
  // Sie SOLL dort stehen: gemeldete Zahlung ruht nie. Eine Probe, die sie
  // mitzählt, wäre ab jetzt dauerhaft rot — und beim dritten Lauf schaltet sie
  // jemand ab (AGENTS.md). Stufe A wird deshalb getrennt gezählt und als Zahl
  // ausgewiesen, nicht als Fehler.
  const [z] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL
       AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_RUHEND}
       AND NOT ${stufeASql("p")}
       AND NOT ${HAT_TERMIN}
       AND NOT ${ruhtSql("p")}
       AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
  `)) as any[];
  const n = Number(z?.n ?? -1);
  log(`\n  ${n} ohne Stufe A — ${n === 0 ? "Zählprobe bestanden." : "NICHT bestanden."}`);

  // Die Gegenprobe: Stufe A MUSS sichtbar sein, und jeder Fall MUSS eine
  // Aufgabe haben. Eine Regel, die nur wegnimmt, ist halb umgesetzt.
  const [sa] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS sichtbar,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_vermerke v
              WHERE v.art = 'aufgabe' AND v.status = 'offen' AND v.entfernt_am IS NULL
                AND v.text LIKE 'Zahlung gemeldet, %'
                AND v.ref IN (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id)
           ))::int AS ohne_aufgabe
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL
       AND COALESCE(p.is_blocked, FALSE) = FALSE
       AND ${stufeASql("p")}
       AND COALESCE(p.unreachable_count, 0) >= ${SCHWELLE_LEITUNG}
  `)) as any[];
  log(`  ${sa.sichtbar} Stufe-A-Fälle mit >= ${SCHWELLE_LEITUNG} Versuchen — sie BLEIBEN sichtbar (so gewollt).`);
  log(`  ${sa.ohne_aufgabe} davon ohne Aufgabe an die Leitung — `
    + `${Number(sa.ohne_aufgabe) === 0 ? "Gegenprobe bestanden." : "NICHT bestanden."}`);

  const [ruht] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL AND ${stufeASql("p")} AND ${ruhtSql("p")}
  `)) as any[];
  log(`  ${ruht.n} Stufe-A-Fälle gelten als ruhend — `
    + `${Number(ruht.n) === 0 ? "richtig (sie ruhen nie)." : "FALSCH."}`);
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
