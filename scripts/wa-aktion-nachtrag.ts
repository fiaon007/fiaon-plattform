// ═══════════════════════════════════════════════════════════════════════════
// NACHTRAG E-261 (29.09.2026): fiaon_wa_aktion.ok FOLGT DEM STATUS-WEBHOOK
//
// ── WAS FALSCH STEHT UND WARUM ────────────────────────────────────────────
// Meta nimmt eine Vorlage SYNCHRON an (wa_id kommt zurück → ok = TRUE) und meldet
// Sekunden später im Status-Webhook, dass sie scheiterte. Bis E-261 setzte der
// Webhook nur fiaon_whatsapp.status = 'fehler' — fiaon_wa_aktion.ok blieb TRUE.
// Folgen: Die Auskunft-Bilanz zählte diese Zeilen als „angeboten"
// (fiaon-mara-bilanz.ts, fiaon-auskunft-verkauf.ts, fiaon-chef-auskunft.ts), die
// Automatik als Stundenmenge (quelle = 'automatik' AND ok) und sendete weniger.
//
// GEMESSEN (Produktion, nur lesend, 29.09.2026): 115 Zeilen ok = TRUE, deren
// Nachricht bei Meta scheiterte — 131026 ×39, 131049 ×2, 131050 ×2 und 72
// Altzeilen ohne Code (vor E-244 stand der Code nicht im Fehlertext). Die 68
// Zeilen mit #131042 vom 28.09. stehen schon (von Hand, 29.09.) auf ok = FALSE —
// ihnen fehlt nur fehler_code (Teil B).
//
// ── WAS DIESER LAUF TUT ───────────────────────────────────────────────────
//   Teil A — ok = TRUE, Nachricht bei Meta gescheitert:
//            ok = FALSE, fehler_code (aus „(#code)" vorn im Fehlertext, sonst
//            NULL), fehler_am = Sendezeit (der Webhook kam Sekunden danach; die
//            genaue Zeit steht nirgends), grund = „Fehler: <Metas Text> — von Meta
//            nicht zugestellt (Status-Webhook); nachgetragen … (E-261)".
//   Teil B — ok = FALSE, aber fehler_code leer, obwohl der Fehlertext einen Code
//            trägt: nur fehler_code (+ fehler_am, falls leer). Grund bleibt.
// Derselbe Satz wie der Webhook seit E-261 (fiaon-whatsapp.ts, waEingang) —
// Präfix „Fehler: " wie die Lauf-Zählung der Zentrale.
//
// ── REGELN (AGENTS.md) ────────────────────────────────────────────────────
//   · Standard = VORSCHAU: CSV nach reports/, nichts wird geschrieben.
//   · Schreiben nur mit --schreiben: vorher eine Sicherung aller betroffenen
//     Zeilen als JSON (reports/), dann EINE Transaktion (lock_timeout 5 s,
//     statement_timeout 30 s); stimmt die Zahl nicht mit der Vorschau überein,
//     wird zurückgerollt. Kein Löschen. Ein zweiter Lauf findet 0.
//   · Braucht Migration 086 (Spalten fehler_code/fehler_am) — sonst Abbruch.
//
// ── WELCHE DATENBANK (Gegenprüfung 29.09.) ─────────────────────────────────
// In ~/Developer/fiaon-plattform/.env ist DATABASE_URL der INTERNE Render-Host
// (ohne Punkt, nur im Render-Netz erreichbar) — lokal bricht die Verbindung mit
// „getaddrinfo ENOTFOUND" ab. Von außen erreichbar ist die Produktion nur über
// DATABASE_URL_EXTERN (Frankfurt). Deshalb:
//   · --extern nimmt DATABASE_URL_EXTERN aus der .env (Hausregel wie
//     pruef-rollen.ts: DATABASE_URL="$DATABASE_URL_EXTERN" npx tsx … geht auch);
//   · das Skript nennt den Host, bevor es verbindet, und bricht bei einem
//     internen Host (ohne Punkt, nicht localhost) sofort mit dem richtigen Aufruf ab.
//
//   npx tsx scripts/wa-aktion-nachtrag.ts --extern               # Vorschau (Produktion)
//   npx tsx scripts/wa-aktion-nachtrag.ts --extern --schreiben   # nach Freigabe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

const SCHREIBEN = process.argv.includes("--schreiben");
const EXTERN = process.argv.includes("--extern");
const ORDNER = process.env.NACHTRAG_ORDNER || "reports";
const HOECHSTENS = 5000;
const log = (s = "") => console.log(s);

const AUFRUF = `npx tsx scripts/wa-aktion-nachtrag.ts --extern${SCHREIBEN ? " --schreiben" : ""}`;
const url = EXTERN ? process.env.DATABASE_URL_EXTERN : process.env.DATABASE_URL;
if (!url) {
  console.error(EXTERN ? "DATABASE_URL_EXTERN fehlt (in der .env im Projektordner)." : `DATABASE_URL fehlt. Für die Produktion: ${AUFRUF}`);
  process.exit(2);
}
const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
const lokal = /^(127\.0\.0\.1|localhost|::1)$/.test(host);
console.log(`Datenbank: ${host || "(Host unlesbar)"}${EXTERN ? " (DATABASE_URL_EXTERN)" : ""}`);
if (!lokal && !host.includes(".")) {
  console.error(`Abbruch: ${host || "dieser Host"} ist ein interner Render-Host — von hier nicht erreichbar. Aufruf: ${AUFRUF}`);
  process.exit(2);
}
// Die Sitzung trägt die Zeitgrenzen selbst (E-254-Lehre: keine Lesung ohne Grenze auf der Produktion).
const sql = postgres(url, {
  ssl: /sslmode=disable/.test(url) ? false : "require", max: 1, onnotice: () => {},
  connection: { statement_timeout: 30_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 60_000, application_name: "wa-aktion-nachtrag-e261" },
});

function csvFeld(w: unknown): string {
  const s = w == null ? "" : w instanceof Date ? w.toISOString() : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Die Fälle — dieselbe Abfrage für Vorschau, Sicherung und die Probe in der Transaktion. */
const FAELLE_SQL = `
  SELECT a.id, a.erstellt_am, a.quelle, a.gruppe, a.vorlage, a.person_id, a.wa_id, a.ok, a.grund, a.fehler_code, a.fehler_am,
         w.fehler AS wa_fehler, COALESCE(w.gesendet_am, w.created_at) AS wa_am,
         substring(w.fehler from '^\\(#(\\d+)\\)')::int AS code_neu,
         CASE WHEN a.ok THEN 'A' ELSE 'B' END AS teil
    FROM fiaon_wa_aktion a
    JOIN fiaon_whatsapp w ON w.wa_id = a.wa_id
   WHERE a.wa_id IS NOT NULL AND w.status = 'fehler'
     AND (a.ok OR (a.fehler_code IS NULL AND w.fehler ~ '^\\(#[0-9]+\\)'))
   ORDER BY a.id
   LIMIT ${HOECHSTENS + 1}`;

async function main(): Promise<void> {
  log(`Nachtrag E-261 — fiaon_wa_aktion.ok folgt dem Status-Webhook (${SCHREIBEN ? "SCHREIBEN" : "Vorschau"}, ${lokal ? "lokale DB" : "entfernte DB"})`);
  const [spalten] = (await sql`
    SELECT COUNT(*)::int AS n FROM information_schema.columns
     WHERE table_name = 'fiaon_wa_aktion' AND column_name IN ('fehler_code', 'fehler_am')`) as any[];
  if (Number(spalten?.n || 0) < 2) {
    console.error("Migration 086 fehlt (fiaon_wa_aktion.fehler_code / fehler_am) — erst ausrollen, dann nachtragen.");
    process.exitCode = 3;
    return;
  }
  const faelle = (await sql.unsafe(FAELLE_SQL)) as any[];
  if (faelle.length > HOECHSTENS) {
    console.error(`Mehr als ${HOECHSTENS} Fälle — das ist nicht der gemessene Stand (≈ 115). Abbruch, bitte erst nachsehen.`);
    process.exitCode = 4;
    return;
  }
  const teilA = faelle.filter((f) => f.teil === "A");
  const teilB = faelle.filter((f) => f.teil === "B");
  const jeCode = new Map<string, number>();
  for (const f of faelle) {
    const k = `${f.teil} · ${f.code_neu ?? "ohne Code"} · ${f.quelle}`;
    jeCode.set(k, (jeCode.get(k) ?? 0) + 1);
  }
  log(`\nTeil A (ok = TRUE, bei Meta gescheitert): ${teilA.length}`);
  log(`Teil B (ok = FALSE, fehler_code fehlt):    ${teilB.length}`);
  for (const [k, n] of Array.from(jeCode.entries()).sort((a, b) => b[1] - a[1])) log(`  ${k}: ${n}`);

  mkdirSync(ORDNER, { recursive: true });
  const stempel = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const kopf = ["teil", "id", "erstellt_am", "quelle", "gruppe", "vorlage", "person_id", "ok_vorher", "code_neu", "wa_fehler"];
  const csv = [kopf.join(";"), ...faelle.map((f) => [f.teil, f.id, f.erstellt_am, f.quelle, f.gruppe, f.vorlage, f.person_id, f.ok, f.code_neu, f.wa_fehler].map(csvFeld).join(";"))].join("\n");
  const csvDatei = join(ORDNER, `wa-aktion-nachtrag-${stempel}.csv`);
  writeFileSync(csvDatei, `${csv}\n`, "utf8");
  log(`\nVorschau: ${csvDatei}`);

  if (!SCHREIBEN) {
    log(`\nNichts geschrieben. Zum Schreiben: npx tsx scripts/wa-aktion-nachtrag.ts${EXTERN ? " --extern" : ""} --schreiben`);
    return;
  }
  if (!faelle.length) { log("\nNichts zu tun — 0 Fälle."); return; }

  // Sicherung VOR dem Schreiben: der Vorher-Stand jeder betroffenen Zeile.
  const sicherung = join(ORDNER, `wa-aktion-nachtrag-sicherung-${stempel}.json`);
  writeFileSync(sicherung, JSON.stringify(faelle.map((f) => ({
    id: Number(f.id), ok: f.ok, grund: f.grund, fehler_code: f.fehler_code, fehler_am: f.fehler_am, teil: f.teil,
  })), null, 1), "utf8");
  log(`Sicherung: ${sicherung}`);

  const datum = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  const idsA = teilA.map((f) => Number(f.id));
  const idsB = teilB.map((f) => Number(f.id));
  const erg = await sql.begin(async (tx) => {
    const a = (await tx`
      UPDATE fiaon_wa_aktion x
         SET ok = FALSE,
             fehler_code = substring(w.fehler from '^\\(#(\\d+)\\)')::int,
             fehler_am = COALESCE(x.fehler_am, w.gesendet_am, w.created_at),
             grund = LEFT(COALESCE(x.grund || ' · ', '') || 'Fehler: ' || COALESCE(NULLIF(w.fehler, ''), 'abgelehnt')
                          || ' — von Meta nicht zugestellt (Status-Webhook); nachgetragen ' || ${datum} || ' (E-261)', 300)
        FROM fiaon_whatsapp w
       WHERE w.wa_id = x.wa_id AND w.status = 'fehler' AND x.ok AND x.id = ANY(${idsA}::bigint[])
       RETURNING x.id`) as any[];
    const b = (await tx`
      UPDATE fiaon_wa_aktion x
         SET fehler_code = substring(w.fehler from '^\\(#(\\d+)\\)')::int,
             fehler_am = COALESCE(x.fehler_am, w.gesendet_am, w.created_at)
        FROM fiaon_whatsapp w
       WHERE w.wa_id = x.wa_id AND w.status = 'fehler' AND NOT x.ok AND x.fehler_code IS NULL
         AND w.fehler ~ '^\\(#[0-9]+\\)' AND x.id = ANY(${idsB}::bigint[])
       RETURNING x.id`) as any[];
    if (a.length !== idsA.length || b.length !== idsB.length) {
      throw new Error(`Zahl weicht von der Vorschau ab (A ${a.length}/${idsA.length}, B ${b.length}/${idsB.length}) — zurückgerollt, nichts geschrieben.`);
    }
    return { a: a.length, b: b.length };
  });
  log(`\nGeschrieben: Teil A ${erg.a} Zeilen (ok = FALSE), Teil B ${erg.b} Zeilen (fehler_code). Ein zweiter Lauf findet 0.`);
}

main()
  .catch((e) => { console.error("Nachtrag abgebrochen:", e?.message || e); process.exitCode = 1; })
  .finally(() => sql.end({ timeout: 5 }));
