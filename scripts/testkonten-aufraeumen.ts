// ═══════════════════════════════════════════════════════════════════════════
// TESTKONTEN AUFRÄUMEN — meine eigene Altlast
//
// ── WOHER SIE KOMMEN ───────────────────────────────────────────────────────
// Jeder Browser-Prüfstand braucht eine Anmeldung, und er darf keine echte
// benutzen (AGENTS.md, Vorfall 06.08.2026: Ein Playwright-Lauf hat eine echte
// Verpflichtungserklärung angenommen). Also legt jeder Lauf ein Testkonto an.
//
// GEMESSEN am 17.08.2026: **43 Testkonten neben 6 echten Menschen.** Der
// Betreiber sah 11 Karten in seiner Team-Zentrale und musste seine Leute
// dazwischen suchen. Fünf der Testkonten waren noch aktiv.
//
// ── WAS DIESER LAUF TUT ────────────────────────────────────────────────────
// Er legt sie still und markiert sie: `active = FALSE`, `is_test_account =
// TRUE`, kein Passwort, keine Verteilung. NICHT löschen — an einem Konto
// hängen Provisionen, Stunden und Verlaufseinträge, und ein Zugang, der
// existiert hat, gehört ins Protokoll.
//
// ── VORSCHAU ZUERST ────────────────────────────────────────────────────────
//   npx tsx scripts/testkonten-aufraeumen.ts              (nur ansehen)
//   npx tsx scripts/testkonten-aufraeumen.ts --schreiben  (ausführen)
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  echteMitarbeiterSql, istTestkontoSql, testkontoStilllegen,
} from "../server/lib/fiaon-mitarbeiter-sicht";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);

async function main(): Promise<void> {
  log(`\n══ Testkonten aufräumen ${SCHREIBEN ? "(SCHREIBT)" : "(VORSCHAU)"} ══\n`);

  const test = (await sqlPool.unsafe(`
    SELECT a.id, a.name, a.email, COALESCE(a.rolle, 'agent') AS rolle,
           a.active, COALESCE(a.is_test_account, FALSE) AS markiert,
           a.password_hash IS NOT NULL AS hat_passwort,
           COALESCE(a.distribution_active, FALSE) AS verteilung,
           a.created_at::date AS seit,
           (SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = a.id) AS kunden,
           (SELECT COUNT(*)::int FROM fiaon_commissions c WHERE c.agent_id = a.id) AS provisionen,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r
             WHERE r.inkasso_agent_id = a.id AND r.status <> 'bezahlt') AS raten
    FROM fiaon_agents a
    WHERE ${istTestkontoSql()}
    ORDER BY a.active DESC, a.id
  `)) as any[];

  const [echt] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_agents a WHERE ${echteMitarbeiterSql()}
  `)) as any[];

  log(`  ${String(test.length).padStart(5)}  Testkonten`);
  log(`  ${String(echt.n).padStart(5)}  echte Menschen im Team`);
  log(`  ${String(test.filter((a) => a.active).length).padStart(5)}  Testkonten noch AKTIV`);
  log(`  ${String(test.filter((a) => !a.markiert).length).padStart(5)}  … ohne die Marke is_test_account`);
  log(`  ${String(test.filter((a) => a.hat_passwort).length).padStart(5)}  … mit gültigem Passwort`);
  log(`  ${String(test.filter((a) => a.verteilung).length).padStart(5)}  … in der Kundenverteilung`);

  // ── DIE GEFÄHRLICHEN: HÄNGT ETWAS ECHTES DARAN? ─────────────────────────
  const mitLast = test.filter((a) => Number(a.kunden) > 0 || Number(a.raten) > 0
    || Number(a.provisionen) > 0);
  if (mitLast.length > 0) {
    log(`\n  ACHTUNG — an ${mitLast.length} Testkonten hängt etwas Echtes:`);
    for (const a of mitLast) {
      log(`    ${String(a.id).padStart(4)}  ${String(a.name).slice(0, 34).padEnd(34)} `
        + `${a.kunden} Kunden · ${a.raten} offene Raten · ${a.provisionen} Provisionen`);
    }
    log("    Diese werden GESCHONT: Sie bleiben nutzbar und behalten ihre Last. Eine");
    log("    Entscheidung über echte Kunden gehört in die Team-Zentrale („Kunden");
    log("    umhängen“ im Mitarbeiter-Detail), nicht in einen Aufräum-Lauf.");
  }

  // ══════════════════════════════════════════════════════════════════════
  // ZWEI SORTEN TESTKONTEN — und nur eine wird stillgelegt
  //
  // ── DER BEFUND IN DER VORSCHAU (17.08.2026) ───────────────────────────
  // Unter den 43 Konten sind zwei, die dem BETREIBER gehören („Justin
  // Schwarzott", Kennungen 2 und 7). An ihnen hängen 6 echte Kunden und 6
  // Provisionen — er benutzt sie, um die Plattform aus der Sicht eines
  // Mitarbeiters zu prüfen.
  //
  // Sie stillzulegen hätte ihm seinen eigenen Zugang genommen. Der Auftrag
  // sagt ausdrücklich: „Justin-Testkonten bleiben als Test markiert."
  //
  // Also:
  //   Prüfstands-Konten   → stilllegen UND markieren (sie sind Werkzeug)
  //   Konten des Betreibers → NUR markieren (sie sind sein Zugang)
  //   Konten mit echter Last → NUR markieren (eine Entscheidung über echte
  //                           Kunden gehört in die Team-Zentrale, nicht in
  //                           einen Aufräum-Lauf)
  //
  // Beide verschwinden aus dem Team-Bild — dafür genügt die Marke. Stilllegen
  // ist die schärfere Maßnahme und braucht einen Grund.
  // ══════════════════════════════════════════════════════════════════════
  const istPruefstand = (a: any) =>
    /prüfstand|pruefstand|knopf-durchgang|probelauf/i.test(String(a.name || ""))
    || /@pruefstand/i.test(String(a.email || ""));
  const hatLast = (a: any) =>
    Number(a.kunden) > 0 || Number(a.raten) > 0 || Number(a.provisionen) > 0;

  const stilllegen = test.filter((a) =>
    istPruefstand(a) && !hatLast(a) && (a.active || a.hat_passwort || a.verteilung));
  const nurMarkieren = test.filter((a) => !a.markiert && !stilllegen.includes(a));
  const geschont = test.filter((a) =>
    (a.active || a.hat_passwort) && !stilllegen.includes(a));

  log(`\n  ${stilllegen.length} Prüfstands-Konten werden STILLGELEGT und markiert:`);
  for (const a of stilllegen) {
    log(`    ${String(a.id).padStart(4)}  ${String(a.name).slice(0, 40).padEnd(40)} `
      + `${a.active ? "aktiv " : "      "}${a.hat_passwort ? "mit Passwort " : ""}`
      + `${a.verteilung ? "in Verteilung" : ""}`);
  }
  if (nurMarkieren.length > 0) {
    log(`\n  ${nurMarkieren.length} Konten bekommen NUR die Marke (bleiben nutzbar):`);
    for (const a of nurMarkieren) log(`    ${String(a.id).padStart(4)}  ${a.name}`);
  }
  if (geschont.length > 0) {
    log(`\n  ${geschont.length} Konten werden GESCHONT — sie bleiben aktiv:`);
    for (const a of geschont) {
      log(`    ${String(a.id).padStart(4)}  ${String(a.name).slice(0, 34).padEnd(34)} `
        + `${hatLast(a) ? `${a.kunden} Kunden, ${a.provisionen} Provisionen` : ""}`
        + `${!istPruefstand(a) ? "  (kein Prüfstands-Konto)" : ""}`);
    }
    log("    Sie sind aus dem Team-Bild verschwunden — dafür genügt die Marke.");
  }
  const zuTun = stilllegen;

  mkdirSync("reports", { recursive: true });
  const kopf = "id;name;email;rolle;aktiv;markiert;hat_passwort;verteilung;kunden;raten;provisionen";
  writeFileSync("reports/testkonten.csv",
    `${[kopf, ...test.map((a) => [a.id, a.name, a.email, a.rolle, a.active, a.markiert,
      a.hat_passwort, a.verteilung, a.kunden, a.raten, a.provisionen]
      .map((v) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v)))
      .join(";"))].join("\n")}\n`, "utf8");
  log("\n  CSV: reports/testkonten.csv");

  if (!SCHREIBEN) {
    log("\n  Das war die VORSCHAU. Es wurde nichts geändert.");
    log("  Ausführen mit: npx tsx scripts/testkonten-aufraeumen.ts --schreiben\n");
    await sqlPool.end();
    return;
  }

  let getan = 0;
  for (const a of stilllegen) {
    const erg = await testkontoStilllegen(Number(a.id));
    if (erg.stillgelegt) getan++;
  }
  let markiert = 0;
  for (const a of nurMarkieren) {
    const r = (await sqlPool`
      UPDATE fiaon_agents SET is_test_account = TRUE
      WHERE id = ${Number(a.id)} RETURNING id
    `) as any[];
    if (r.length > 0) markiert++;
  }
  log(`\n  ${getan} Prüfstands-Konten stillgelegt und markiert.`);
  if (markiert > 0) log(`  ${markiert} weitere nur markiert — sie bleiben nutzbar.`);
  if (geschont.length > 0) {
    log(`  ${geschont.length} Konten geschont (Zugang des Betreibers bzw. echte Last daran).`);
  }

  // ── ZÄHLPROBEN ──────────────────────────────────────────────────────────
  const [nach] = (await sqlPool.unsafe(`
    SELECT COUNT(*) FILTER (WHERE ${istTestkontoSql()} AND a.active)::int AS test_aktiv,
           COUNT(*) FILTER (WHERE ${istTestkontoSql()}
             AND NOT COALESCE(a.is_test_account, FALSE))::int AS ohne_marke,
           COUNT(*) FILTER (WHERE ${istTestkontoSql()} AND a.password_hash IS NOT NULL)::int AS mit_passwort,
           COUNT(*) FILTER (WHERE ${echteMitarbeiterSql()} AND a.active)::int AS echte_aktiv
    FROM fiaon_agents a
  `)) as any[];
  const [pruef] = (await sqlPool.unsafe(`
    SELECT COUNT(*) FILTER (WHERE a.active)::int AS aktiv,
           COUNT(*) FILTER (WHERE a.password_hash IS NOT NULL)::int AS mit_passwort
    FROM fiaon_agents a
    WHERE (a.name ILIKE '%prüfstand%' OR a.name ILIKE '%pruefstand%'
           OR a.name ILIKE '%knopf-durchgang%' OR a.email ILIKE '%@pruefstand%')
  `)) as any[];
  log("\n  ZÄHLPROBEN:");
  log(`    ${String(pruef.aktiv).padStart(5)}  PRÜFSTANDS-Konten noch aktiv (soll 0)`);
  log(`    ${String(pruef.mit_passwort).padStart(5)}  … mit Passwort               (soll 0)`);
  log(`    ${String(nach.ohne_marke).padStart(5)}  Testkonten ohne Marke        (soll 0)`);
  log(`    ${String(nach.test_aktiv).padStart(5)}  Testkonten aktiv insgesamt   (geschonte des Betreibers)`);
  log(`    ${String(nach.echte_aktiv).padStart(5)}  ECHTE Menschen aktiv         (soll 6 — unberührt)`);

  const fehler = Number(pruef.aktiv) + Number(pruef.mit_passwort) + Number(nach.ohne_marke);
  if (fehler > 0) log("\n  NICHT VOLLSTÄNDIG — bitte reports/testkonten.csv ansehen.");
  else log("\n  Das Team-Bild gehört wieder dem Team.\n");

  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
