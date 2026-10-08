// ═══════════════════════════════════════════════════════════════════════════
// EINMAL-LAUF E-IT-B (08.10.2026): KONTO & KARTE ERNEUT, „WIRKSAM GEKÜNDIGT“
//
// Was der neue Code ab jetzt richtig schreibt, steht im Altbestand noch falsch.
// Dieser Lauf zieht es EINMAL nach — Standard ist der TROCKENLAUF.
//
// ── TEIL A — DIE EINLADUNGSZEILE TRÄGT DEN ERSTVERSAND ────────────────────
// Bis E-IT-B rückte Maras erneuter Versand (einladungSchicken, erneut-Zweig)
// fiaon_konto_karte.gesendet_am auf „jetzt“ vor — der Tag des Erstversands
// ging verloren (gemessen 07.10.: 17 Zeilen mit Erneut-Notiz). Seit E-IT-B
// bleibt gesendet_am der Erstversand; wie oft, wann zuletzt und von wem erneut
// geschickt wurde, steht in erneut_anzahl, zuletzt_erneut_am,
// zuletzt_erneut_von (Migration 098). Quelle ist das Mail-Protokoll
// (fiaon_mail_log, event konto_karte_einladung, versandt, echt):
//   gesendet_am        = erste versandte Einladungsmail, wenn die Zeile mehr als 10 Minuten
//                        später steht (sonst unverändert — die Zeile entsteht Sekunden nach der Mail)
//   erneut_anzahl      = Zahl der versandten Einladungsmails − 1 (mindestens 0)
//   zuletzt_erneut_am  = letzte versandte Einladungsmail (nur wenn mehr als eine)
//   zuletzt_erneut_von = ihr Auslöser (ausgeloest_von)
// agent_id, agent_name, bonus_cents und status bleiben UNBERÜHRT (Geld, E-067).
//
// ── TEIL B — KEIN ALTER RÜCKNAHMETAG NEBEN EINER GELTENDEN KÜNDIGUNG ──────
// kuendigungSetzen setzte kuendigung_zurueckgenommen_am bei einer erneuten
// Kündigung nicht zurück; elf Leser hielten den Menschen dann für ungekündigt.
// Seit E-IT-B setzt jede Kündigung ihn auf NULL. Hier die Altzeilen
// (gekuendigt_am UND kuendigung_zurueckgenommen_am gesetzt) — gemessen 08.10.: 0.
//
// ── TEIL D — ANTRÄGE, DIE EINE RÜCKNAHME ERLEDIGT HAT (Gegenprüfung 08.10.) ─
// kuendigungZuruecknehmen ließ den Formular-Antrag auf „pending“ stehen. Die
// Regel (KUENDIGUNG_ANTRAEGE_SQL) zählt ihn schon nicht mehr — aber im
// Chefbüro (Kündigungsanträge) stand er weiter als „Ausstehend“, und ein Klick
// auf „Bestätigen“ hätte einen Kunden gekündigt, der geblieben ist (Fall 11498,
// Antrag #85). Seit E-IT-B setzt die Rücknahme die Anträge des Menschen auf
// 'withdrawn' („Zurückgenommen“). Hier der Altbestand: offener Antrag, danach
// eine Rücknahme an einer Bestellung desselben Menschen.
//
// ── TEIL C — NUR BERICHT, NICHTS WIRD GESCHRIEBEN ─────────────────────────
//   · Die Liste „Konto & Karte“ vorher/nachher: wie viele bereite Menschen ohne
//     Einladung die alte Lesart zeigte (mit Ausgeschlossenen) und wie viele die
//     neue (ohne) — Erwartung 08.10.: 110 → 0.
//   · Nie gebuchte Kündigungsanträge (cancellation_requests offen, Bestellung
//     ohne gekuendigt_am): Sie zählen NICHT als wirksam (Justin, 08.10.) und
//     werden von Menschen über den E-213-Weg gebucht — Kundenzentrale, Filter
//     „Kündigung nicht gebucht“. Der Lauf bucht sie bewusst NICHT.
//
// ── REGELN ─────────────────────────────────────────────────────────────────
//   · Standard = TROCKENLAUF: zeigt jede geplante Änderung, schreibt nichts.
//   · Schreiben nur mit --ausfuehren: vorher Sicherung aller betroffenen Zeilen
//     (JSON) und ein Rückweg-SQL in den Ordner reports/ (oder NACHTRAG_ORDNER),
//     dann EINE Transaktion (lock_timeout 5 s, statement_timeout 60 s); weicht
//     die Zahl von der Vorschau ab, wird zurückgerollt. Kein Löschen.
//   · Ein zweiter Lauf findet 0.
//   · Braucht Migration 098 (Spalten erneut_anzahl …) — sonst Abbruch für Teil A.
//
//   npx tsx scripts/it-b-einmal.ts --extern                # Trockenlauf (Produktion, nur lesend)
//   npx tsx scripts/it-b-einmal.ts --extern --ausfuehren   # nach Freigabe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { KUENDIGUNG_WIRKSAM_SQL, KUENDIGUNG_UNGEBUCHT_SQL, KUENDIGUNG_ANTRAEGE_SQL } from "../shared/fiaon-kuendigung-regel";
import { produktkategorieSql } from "../shared/fiaon-produktkategorie";

const AUSFUEHREN = process.argv.includes("--ausfuehren");
const EXTERN = process.argv.includes("--extern");
const ORDNER = process.env.NACHTRAG_ORDNER || "reports";
const log = (s = "") => console.log(s);

const AUFRUF = `npx tsx scripts/it-b-einmal.ts --extern${AUSFUEHREN ? " --ausfuehren" : ""}`;
const url = EXTERN ? process.env.DATABASE_URL_EXTERN : process.env.DATABASE_URL;
if (!url) {
  console.error(EXTERN ? "DATABASE_URL_EXTERN fehlt (in der .env im Projektordner)." : `DATABASE_URL fehlt. Für die Produktion: ${AUFRUF}`);
  process.exit(2);
}
const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
const lokal = /^(127\.0\.0\.1|localhost|::1)$/.test(host);
log(`Datenbank: ${host || "(Host unlesbar)"}${EXTERN ? " (DATABASE_URL_EXTERN)" : ""} · ${AUSFUEHREN ? "AUSFÜHREN" : "TROCKENLAUF (schreibt nichts)"}`);
if (!lokal && !host.includes(".")) {
  console.error(`Abbruch: ${host || "dieser Host"} ist ein interner Render-Host — von hier nicht erreichbar. Aufruf: ${AUFRUF}`);
  process.exit(2);
}
const sql = postgres(url, {
  ssl: /sslmode=disable/.test(url) ? false : "require", max: 1, onnotice: () => {},
  connection: { statement_timeout: 60_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 60_000, application_name: "it-b-einmal" },
});

/** Ein SQL-Literal für das Rückweg-Skript (Text, Zeit oder NULL). */
function lit(w: unknown): string {
  if (w === null || w === undefined) return "NULL";
  if (typeof w === "number") return Number.isFinite(w) ? String(w) : "NULL";
  const t = w instanceof Date ? w.toISOString() : String(w);
  return `'${t.replace(/'/g, "''")}'`;
}

/** Was Teil A ändern würde — eine Abfrage, nur lesend. */
async function teilAPlan(lauf: typeof sql) {
  return (await lauf`
    WITH m AS (
      SELECT person_id, MIN(created_at) AS erste, MAX(created_at) AS letzte, COUNT(*)::int AS n,
             (array_agg(COALESCE(NULLIF(ausgeloest_von, ''), 'Automatik') ORDER BY created_at DESC))[1] AS letzter_von
        FROM fiaon_mail_log
       WHERE event = 'konto_karte_einladung' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt' AND person_id IS NOT NULL
       GROUP BY person_id
    ), z AS (
      SELECT DISTINCT ON (k.person_id) k.id, k.person_id, k.gesendet_am, k.erneut_anzahl, k.zuletzt_erneut_am, k.zuletzt_erneut_von
        FROM fiaon_konto_karte k WHERE k.kanal <> 'gemeldet'
       ORDER BY k.person_id, k.gesendet_am DESC
    )
    SELECT z.id, z.person_id, z.gesendet_am AS alt_gesendet, z.erneut_anzahl AS alt_anzahl,
           z.zuletzt_erneut_am AS alt_zuletzt, z.zuletzt_erneut_von AS alt_von,
           -- Nur echte Verschiebungen: Die Zeile entsteht Sekunden NACH der Mail — das ist kein Fehler.
           CASE WHEN z.gesendet_am > m.erste + INTERVAL '10 minutes' THEN m.erste ELSE z.gesendet_am END AS neu_gesendet,
           GREATEST(m.n - 1, 0) AS neu_anzahl,
           CASE WHEN m.n > 1 THEN m.letzte ELSE z.zuletzt_erneut_am END AS neu_zuletzt,
           CASE WHEN m.n > 1 THEN m.letzter_von ELSE z.zuletzt_erneut_von END AS neu_von
      FROM z JOIN m ON m.person_id = z.person_id
     WHERE z.gesendet_am > m.erste + INTERVAL '10 minutes'
        OR z.erneut_anzahl IS DISTINCT FROM GREATEST(m.n - 1, 0)
        OR (m.n > 1 AND (z.zuletzt_erneut_am IS DISTINCT FROM m.letzte OR z.zuletzt_erneut_von IS DISTINCT FROM m.letzter_von))
     ORDER BY z.person_id`) as any[];
}

async function teilBPlan(lauf: typeof sql) {
  return (await lauf`
    SELECT ref, person_id, gekuendigt_am, kuendigung_zurueckgenommen_am FROM fiaon_applications
     WHERE gekuendigt_am IS NOT NULL AND kuendigung_zurueckgenommen_am IS NOT NULL ORDER BY ref`) as any[];
}

async function teilDPlan(lauf: typeof sql) {
  return (await lauf`
    SELECT c.id, c.ref, c.created_at, c.processed_at, c.updated_at, c.admin_note,
           (SELECT MAX(r.kuendigung_zurueckgenommen_am) FROM fiaon_applications r
             WHERE r.person_id = a.person_id AND r.kuendigung_zurueckgenommen_am >= c.created_at) AS zurueck_am
      FROM cancellation_requests c JOIN fiaon_applications a ON a.ref = c.ref AND a.person_id IS NOT NULL
     WHERE c.status = 'pending'
       AND EXISTS (SELECT 1 FROM fiaon_applications r WHERE r.person_id = a.person_id
                    AND r.kuendigung_zurueckgenommen_am IS NOT NULL AND r.kuendigung_zurueckgenommen_am >= c.created_at)
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications g WHERE g.person_id = a.person_id AND g.merged_into IS NULL
                        AND g.gekuendigt_am IS NOT NULL AND g.gekuendigt_am > c.created_at)
     ORDER BY c.id`) as any[];
}

async function main() {
  // ── Voraussetzung Teil A: Migration 098 ──────────────────────────────────
  const spalten = new Set(((await sql`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'fiaon_konto_karte'`) as any[]).map((r) => String(r.column_name)));
  const hat098 = ["erneut_anzahl", "zuletzt_erneut_am", "zuletzt_erneut_von"].every((c) => spalten.has(c));

  // ── Teil C (Bericht) ─────────────────────────────────────────────────────
  log("\n── C · Bericht (schreibt nie) ─────────────────────────────────────────");
  const [c1] = (await sql.unsafe(`
    SELECT COUNT(*)::int AS gekuendigt_alt_lesart,
           COUNT(*) FILTER (WHERE ${KUENDIGUNG_WIRKSAM_SQL("p.id")})::int AS gekuendigt_regel
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
                     AND a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL)`)) as any[];
  log(`  Gekündigt (alte Lesart, jede Bestellung): ${c1?.gekuendigt_alt_lesart} · davon nach der Regel (Stufenpaket, kein neuer Vertrag): ${c1?.gekuendigt_regel}`);
  // Nachbesserung 08.10.: dieselbe Quelle wie Liste und Akte (Personenebene, auch zusammengeführte Bestellungen).
  const ungebucht = (await sql.unsafe(`
    SELECT u.antrag_id AS id, u.antrag_ref AS ref, u.person_id, u.antrag_am::date AS am
      FROM (${KUENDIGUNG_ANTRAEGE_SQL}) u ORDER BY u.antrag_am`)) as any[];
  const [c2] = (await sql.unsafe(`SELECT COUNT(*)::int AS n FROM fiaon_persons p WHERE p.merged_into_person_id IS NULL AND ${KUENDIGUNG_UNGEBUCHT_SQL("p.id")}`)) as any[];
  log(`  Nie gebuchte Kündigungsanträge: ${ungebucht.length} Anträge, ${c2?.n} Menschen — NICHT gebucht von diesem Lauf;`);
  log("    Arbeit: Kundenzentrale → Filter „Kündigung nicht gebucht“ → Akte → „Jetzt buchen“ (E-213) oder ablehnen.");
  for (const u of ungebucht.slice(0, 40)) log(`    · Antrag #${u.id} ${u.ref} (Person ${u.person_id ?? "—"}) vom ${String(u.am).slice(0, 10)}`);
  const [c3] = (await sql.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
     WHERE a.merged_into IS NULL AND a.gekuendigt_am IS NOT NULL AND ${produktkategorieSql("a")} = 'auskunft'
       AND EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.person_id = a.person_id AND b.merged_into IS NULL
                     AND b.payment_status = 'paid' AND b.gekuendigt_am IS NULL AND ${produktkategorieSql("b")} = 'konto')`)) as any[];
  log(`  Nur Auskunft gekündigt, Stufenpaket läuft (galten bisher überall als „gekündigt“): ${c3?.n}`);

  // ── Teil A ───────────────────────────────────────────────────────────────
  log("\n── A · Einladungszeilen: Erstversand und Zähler aus dem Mail-Protokoll ──");
  let planA: any[] = [];
  if (!hat098) {
    log("  ÜBERSPRUNGEN: Migration 098 fehlt (Spalten erneut_anzahl, zuletzt_erneut_am, zuletzt_erneut_von). Erst deployen, dann erneut laufen lassen.");
  } else {
    planA = await teilAPlan(sql);
    log(`  ${planA.length} Zeile(n) zu ändern.`);
    for (const z of planA.slice(0, 60)) {
      log(`    · Zeile ${z.id} (Person ${z.person_id}): gesendet_am ${new Date(z.alt_gesendet).toISOString()} → ${new Date(z.neu_gesendet).toISOString()}, `
        + `erneut ${z.alt_anzahl} → ${z.neu_anzahl}${z.neu_zuletzt ? `, zuletzt ${new Date(z.neu_zuletzt).toISOString()} von ${z.neu_von}` : ""}`);
    }
  }

  // ── Teil B ───────────────────────────────────────────────────────────────
  log("\n── B · Rücknahmetag neben geltender Kündigung ─────────────────────────");
  const planB = await teilBPlan(sql);
  log(`  ${planB.length} Bestellung(en) zu ändern.`);
  for (const b of planB) log(`    · ${b.ref} (Person ${b.person_id ?? "—"}): gekündigt ${new Date(b.gekuendigt_am).toISOString()}, Rücknahmetag ${new Date(b.kuendigung_zurueckgenommen_am).toISOString()} → NULL`);

  // ── Teil D ───────────────────────────────────────────────────────────────
  log("\n── D · Offene Anträge, die eine spätere Rücknahme erledigt hat ─────────");
  const planD = await teilDPlan(sql);
  log(`  ${planD.length} Antrag/Anträge → 'withdrawn' („Zurückgenommen“).`);
  for (const d of planD) log(`    · Antrag #${d.id} ${d.ref} vom ${new Date(d.created_at).toISOString().slice(0, 10)} — Rücknahme ${new Date(d.zurueck_am).toISOString().slice(0, 10)}`);

  if (!AUSFUEHREN) {
    log("\nTROCKENLAUF — nichts geschrieben. Ausführen (nach Freigabe): " + `npx tsx scripts/it-b-einmal.ts${EXTERN ? " --extern" : ""} --ausfuehren`);
    return;
  }
  if (!planA.length && !planB.length && !planD.length) { log("\nNichts zu tun."); return; }

  // ── Sicherung + Rückweg, DANN schreiben ──────────────────────────────────
  mkdirSync(ORDNER, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, "-");
  const sicherung = join(ORDNER, `it-b-einmal-sicherung-${stempel}.json`);
  const rueckweg = join(ORDNER, `it-b-einmal-rueckweg-${stempel}.sql`);
  writeFileSync(sicherung, JSON.stringify({ host, am: new Date().toISOString(), teilA: planA, teilB: planB, teilD: planD }, null, 1));
  const zeilen: string[] = [
    "-- Rückweg für scripts/it-b-einmal.ts (E-IT-B) — stellt die Werte VOR dem Lauf wieder her.",
    `-- Lauf: ${new Date().toISOString()} gegen ${host}`,
    "BEGIN;", "SET LOCAL lock_timeout = '5s';",
    ...planA.map((z) => `UPDATE fiaon_konto_karte SET gesendet_am = ${lit(z.alt_gesendet)}, erneut_anzahl = ${lit(Number(z.alt_anzahl ?? 0))}, `
      + `zuletzt_erneut_am = ${lit(z.alt_zuletzt)}, zuletzt_erneut_von = ${lit(z.alt_von)} WHERE id = ${Number(z.id)};`),
    ...planB.map((b) => `UPDATE fiaon_applications SET kuendigung_zurueckgenommen_am = ${lit(b.kuendigung_zurueckgenommen_am)} WHERE ref = ${lit(b.ref)};`),
    ...planD.map((d) => `UPDATE cancellation_requests SET status = 'pending', processed_at = ${lit(d.processed_at)}, updated_at = ${lit(d.updated_at)}, `
      + `admin_note = ${lit(d.admin_note)} WHERE id = ${Number(d.id)} AND status = 'withdrawn';`),
    "COMMIT;",
  ];
  writeFileSync(rueckweg, zeilen.join("\n") + "\n");
  log(`\nSicherung: ${sicherung}\nRückweg:   ${rueckweg}`);

  await sql.begin(async (tx) => {
    await tx`SET LOCAL lock_timeout = '5s'`;
    // Dieselbe Abfrage noch einmal IN der Transaktion — weicht die Menge ab, zurückrollen.
    const a2 = hat098 ? await teilAPlan(tx as any) : [];
    const b2 = await teilBPlan(tx as any);
    const d2 = await teilDPlan(tx as any);
    if (a2.length !== planA.length || b2.length !== planB.length || d2.length !== planD.length) {
      throw new Error(`Menge hat sich seit der Vorschau geändert (A ${planA.length}→${a2.length}, B ${planB.length}→${b2.length}, D ${planD.length}→${d2.length}) — zurückgerollt, bitte neu starten.`);
    }
    for (const z of a2) {
      await tx`
        UPDATE fiaon_konto_karte
           SET gesendet_am = ${z.neu_gesendet}, erneut_anzahl = ${Number(z.neu_anzahl)},
               zuletzt_erneut_am = ${z.neu_zuletzt}, zuletzt_erneut_von = ${z.neu_von},
               notiz = TRIM(BOTH E'\n' FROM COALESCE(notiz || E'\n', '') || 'E-IT-B 08.10.2026: Erstversand und Zähler aus dem Mail-Protokoll nachgetragen.')
         WHERE id = ${Number(z.id)}`;
    }
    for (const b of b2) {
      await tx`UPDATE fiaon_applications SET kuendigung_zurueckgenommen_am = NULL, updated_at = NOW()
                WHERE ref = ${b.ref} AND gekuendigt_am IS NOT NULL`;
    }
    for (const d of d2) {
      await tx`UPDATE cancellation_requests SET status = 'withdrawn', processed_at = NOW(), updated_at = NOW(),
                      admin_note = COALESCE(admin_note, '') || ' [E-IT-B 08.10.2026: Kündigung danach zurückgenommen]'
                WHERE id = ${Number(d.id)} AND status = 'pending'`;
    }
  });
  log(`\nGeschrieben: Teil A ${planA.length} Zeile(n), Teil B ${planB.length} Bestellung(en), Teil D ${planD.length} Antrag/Anträge. Ein zweiter Lauf muss 0 finden.`);
}

main()
  .catch((e) => { console.error("FEHLER:", e instanceof Error ? e.message : e); process.exitCode = 1; })
  .finally(() => sql.end({ timeout: 5 }));
