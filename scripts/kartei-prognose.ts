/**
 * ═══════════════════════════════════════════════════════════════════
 * KARTEI — PROGNOSE VOR DER MIGRATION (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Beantwortet die Pflichtfragen des Vorgesetzten, BEVOR geschrieben wird:
 *
 *   F1  Wie viele der zurückgehenden Datensätze erscheinen tatsächlich
 *       als freie Karte? (Die Migration löst die Zuweisung — sichtbar wird
 *       eine Karte aber nur, wenn sie die strenge Kontaktregel erfüllt.)
 *   F2  Wie viele fallen wegen der strengen Regel raus, warum genau —
 *       und laufen sie weiter in der Nachfass-Sequenz? (Muss so sein.)
 *   F3  Wie sieht die Kartei nach der Migration aus: frei / vergeben / gesamt?
 *
 * Die Kartei-Definition wird aus dem Produktivmodul importiert, damit die
 * Prognose nicht an einer eigenen Kopie der Abfrage vorbeirechnet.
 *
 * Verwendung: npx tsx scripts/kartei-prognose.ts
 */

import "dotenv/config";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL fehlt.");
  process.exit(2);
}
const sql = postgres(process.env.DATABASE_URL, {
  ssl: "require",
  max: 2,
  connect_timeout: 20,
  // Die Kartei-CTE ist teuer. Lieber ehrlich abbrechen als scheinbar hängen.
  connection: { statement_timeout: 120000 },
});

const t0 = Date.now();
function step(msg: string): void {
  process.stderr.write(`  · ${msg} (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
}

const OPEN_LEAD_STATUS = ["neu", "kontaktiert", "nicht_erreichbar"];
const OPEN_PAYMENT_STATUS = ["pending_payment", "claimed_paid"];
const CONTACT_TYPES = ["result", "note", "email_sent"];

const WEIGHTS_STRICT = {
  wFresh: 40, wValue: 25, wReact: 50, wContact: 30, fairnessNth: 4,
  hoardingDays: 7, hoardingWarnDays: 2, autoReleaseMin: 30, requireFullContact: true,
};
const WEIGHTS_LOOSE = { ...WEIGHTS_STRICT, requireFullContact: false };

// Die gelockerte Kartei ist um ein Vielfaches teurer: die Lead-Menge wächst
// stark, und für jeden Lead läuft die korrelierte Dubletten-Prüfung gegen alle
// Bestellungen (inkl. Telefon-Normalisierung per regexp). Deshalb nur auf
// ausdrückliche Anforderung — sie wird laut Auftrag nur gebraucht, falls die
// Kartei zu klein ausfällt.
const WITH_VERGLEICH = process.argv.includes("--vergleich");

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}
function padL(s: string | number, n: number): string {
  return String(s).padStart(n);
}

async function main(): Promise<void> {
  const mod = await import("../server/routes/fiaon-kartei");
  const buildCte: (w: any) => string = (mod as any).__karteiCteForTests;
  if (typeof buildCte !== "function") {
    console.error("fiaon-kartei.ts exportiert __karteiCteForTests nicht.");
    process.exit(2);
  }
  const cteStrict = buildCte(WEIGHTS_STRICT);

  // Die Kartei-CTE ist teuer, deshalb läuft sie GENAU EINMAL; alles Weitere
  // wird im Speicher gerechnet.
  step("Lese Kartei nach strenger Regel …");
  const strictRows = await sql.unsafe(
    `${cteStrict} SELECT k.card_id, (k.assigned_agent_id IS NULL) AS frei FROM kartei k`,
  );
  step(`Kartei streng: ${strictRows.length} Karten`);

  const strictFrei = new Map<string, boolean>(strictRows.map((r: any) => [r.card_id, r.frei]));

  let looseRows: any[] | null = null;
  if (WITH_VERGLEICH) {
    step("Lese Kartei nach gelockerter Regel … (dauert deutlich länger)");
    looseRows = await sql.unsafe(
      `${buildCte(WEIGHTS_LOOSE)} SELECT k.card_id, (k.assigned_agent_id IS NULL) AS frei FROM kartei k`,
    );
    step(`Kartei gelockert: ${looseRows.length} Karten`);
  }

  // ── Die Datensätze, die die Migration freigeben würde (identische Bedingung
  //    wie scripts/kartei-migration.ts) ────────────────────────────────────
  const releaseLeads = await sql`
    SELECT l.id::text AS target_id, 'lead-' || l.id AS card_id, l.assigned_agent_id,
           ag.name AS agent_name,
           (COALESCE(l.telefon,'') <> '') AS hat_tel,
           (COALESCE(l.email,'') <> '')   AS hat_mail,
           (COALESCE(l.vorname,'') <> '' OR COALESCE(l.nachname,'') <> '') AS hat_name,
           l.in_sequence
    FROM fiaon_leads l
    LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
    WHERE l.assigned_agent_id IS NOT NULL
      AND l.status = ANY(${OPEN_LEAD_STATUS})
      AND l.dismissed_at IS NULL
      AND l.converted_order_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_lead_log g WHERE g.lead_id = l.id AND g.type = ANY(${CONTACT_TYPES}))
  `;
  const releaseApps = await sql`
    SELECT a.ref AS target_id, a.ref AS card_id, a.assigned_agent_id, ag.name AS agent_name
    FROM fiaon_applications a
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.assigned_agent_id IS NOT NULL
      AND a.payment_status = ANY(${OPEN_PAYMENT_STATUS})
      AND a.merged_into IS NULL
      AND a.dismissed_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_contact_log c
        WHERE c.ref = a.ref AND c.type = ANY(${CONTACT_TYPES}) AND c.voided_at IS NULL
      )
  `;
  const releaseCardIds = [
    ...releaseLeads.map((r: any) => r.card_id),
    ...releaseApps.map((r: any) => r.card_id),
  ];
  const totalBack = releaseCardIds.length;
  step(`Freizugebende Akten: ${totalBack}`);

  // ── Mengenrechnung im Speicher statt einer weiteren teuren Abfrage ───────
  const visibleSet = new Set(releaseCardIds.filter((id: string) => strictFrei.has(id)));
  const visible = visibleSet.size;
  const hidden = totalBack - visible;

  const nowState = {
    gesamt: strictRows.length,
    frei: strictRows.filter((r: any) => r.frei).length,
    vergeben: strictRows.filter((r: any) => !r.frei).length,
  };

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(" KARTEI — PROGNOSE VOR DER MIGRATION (nichts wird verändert)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log("F1 · WIE VIELE DER ZURÜCKGEHENDEN AKTEN WERDEN WIRKLICH SICHTBAR?\n");
  console.log(`  Die Migration löst die Zuweisung bei ........... ${padL(totalBack, 6)} Akten`);
  console.log(`     davon Leads .................................. ${padL(releaseLeads.length, 6)}`);
  console.log(`     davon offene Bestellungen .................... ${padL(releaseApps.length, 6)}`);
  console.log(`  Davon erfüllen die strenge Kontaktregel ........ ${padL(visible, 6)}  → erscheinen als FREIE KARTE`);
  console.log(`  Davon erfüllen sie NICHT ...................... ${padL(hidden, 6)}  → bleiben unsichtbar\n`);

  // ── F2: Warum genau fallen sie raus? ─────────────────────────────────────
  const hiddenLeads = releaseLeads.filter((r: any) => !visibleSet.has(r.card_id));
  const hiddenApps = releaseApps.filter((r: any) => !visibleSet.has(r.card_id));

  let keinTel = 0, keineMail = 0, keinName = 0, mehrfach = 0;
  for (const l of hiddenLeads as any[]) {
    const fehlt = [!l.hat_tel, !l.hat_mail, !l.hat_name].filter(Boolean).length;
    if (fehlt > 1) mehrfach++;
    else if (!l.hat_tel) keinTel++;
    else if (!l.hat_mail) keineMail++;
    else if (!l.hat_name) keinName++;
  }
  const inSeq = (hiddenLeads as any[]).filter((l) => l.in_sequence === true).length;

  console.log("F2 · WARUM FALLEN SIE RAUS — UND LAUFEN SIE WEITER?\n");
  console.log(`  Unsichtbare Leads .............................. ${padL(hiddenLeads.length, 6)}`);
  console.log(`     nur Telefon fehlt ........................... ${padL(keinTel, 6)}`);
  console.log(`     nur E-Mail fehlt ............................ ${padL(keineMail, 6)}`);
  console.log(`     nur Name fehlt .............................. ${padL(keinName, 6)}`);
  console.log(`     mehreres fehlt .............................. ${padL(mehrfach, 6)}`);
  console.log(`  Unsichtbare Bestellungen ....................... ${padL(hiddenApps.length, 6)}`);
  console.log(`\n  Davon weiterhin in der Nachfass-Sequenz ........ ${padL(inSeq, 6)} von ${hiddenLeads.length} Leads`);
  console.log(`  → Die Nachfass-Auswahl filtert NICHT nach assigned_agent_id.`);
  console.log(`    Die Migration ändert ausschließlich assigned_agent_id.`);
  console.log(`    Folglich kann sie die Sequenz nicht beeinflussen.\n`);

  // Gegenprobe: zählt die echte Nachfass-Bedingung vorher/nachher gleich viele?
  const [seqNow] = await sql`
    SELECT COUNT(*)::int AS c FROM fiaon_leads l
    WHERE l.status IN ('neu','kontaktiert','nicht_erreichbar')
      AND l.in_sequence = TRUE
      AND COALESCE(NULLIF(l.email,''), NULLIF(l.telefon,'')) IS NOT NULL
  `;
  console.log(`  Gegenprobe — Leads, die die Nachfass-Bedingung erfüllen: ${seqNow.c}`);
  console.log(`  (Diese Zahl muss nach der Migration identisch sein.)\n`);

  // ── F3: Kartei nach der Migration ────────────────────────────────────────
  console.log("F3 · KARTEI NACH DER MIGRATION\n");
  console.log("                        vorher     nachher");
  console.log("  ------------------  --------   ---------");
  console.log(`  frei                ${padL(nowState.frei, 8)}   ${padL(nowState.frei + visible, 9)}`);
  console.log(`  vergeben            ${padL(nowState.vergeben, 8)}   ${padL(nowState.vergeben - visible, 9)}`);
  console.log(`  gesamt              ${padL(nowState.gesamt, 8)}   ${padL(nowState.gesamt, 9)}`);
  console.log(`\n  Die Gesamtzahl bleibt gleich — die Kartei-Zugehörigkeit hängt an den`);
  console.log(`  Kontaktdaten, nicht an der Zuweisung. Die Migration verschiebt nur`);
  console.log(`  von „vergeben" nach „frei".\n`);

  // ── Was bei gelockerter Regel entstünde (nur zur Information) ────────────
  if (looseRows) {
    const looseFrei = new Map<string, boolean>(looseRows.map((r: any) => [r.card_id, r.frei]));
    const looseGesamt = looseRows.length;
    const looseFreiJetzt = looseRows.filter((r: any) => r.frei).length;
    const looseVisibleCount = releaseCardIds.filter((id: string) => looseFrei.has(id)).length;
    console.log("ZUM VERGLEICH — wenn die strenge Regel abgeschaltet würde (Vorgesetzter entscheidet):\n");
    console.log(`  kartei_require_full_contact = 0  →  gesamt ${looseGesamt}, frei danach ${looseFreiJetzt + looseVisibleCount}`);
    console.log(`  (Diese Karten hätten teils nur Telefon ODER nur E-Mail.)\n`);
  } else {
    console.log("Vergleichszahl für eine gelockerte Regel nicht berechnet.");
    console.log("Bei Bedarf: npx tsx scripts/kartei-prognose.ts --vergleich\n");
  }

  // ── Betreuungs-Nachweis je Agent: was bleibt eigen? ──────────────────────
  const perAgent = new Map<string, { back: number; visible: number }>();
  for (const r of [...(releaseLeads as any[]), ...(releaseApps as any[])]) {
    const key = r.agent_name || `Agent #${r.assigned_agent_id}`;
    const e = perAgent.get(key) || { back: 0, visible: 0 };
    e.back++;
    if (visibleSet.has(r.card_id)) e.visible++;
    perAgent.set(key, e);
  }
  console.log("JE AGENT — was zurückgeht und was davon sichtbar wird:\n");
  console.log(`  ${pad("Agent", 26)} ${padL("zurück", 8)} ${padL("davon sichtbar", 15)}`);
  console.log(`  ${"-".repeat(26)} ${"-".repeat(8)} ${"-".repeat(15)}`);
  for (const [name, e] of [...perAgent.entries()].sort((a, b) => b[1].back - a[1].back)) {
    console.log(`  ${pad(name, 26)} ${padL(e.back, 8)} ${padL(e.visible, 15)}`);
  }

  console.log("\nNichts verändert. Prognose beendet.\n");
  await sql.end();
}

main().catch(async (err) => {
  console.error("Prognose fehlgeschlagen:", err);
  await sql.end().catch(() => {});
  process.exit(1);
});
