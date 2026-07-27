/**
 * ═══════════════════════════════════════════════════════════════════
 * BLOCKIERTE AKTEN — Diagnose mit harten Grenzen (nur lesend)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Beantwortet zwei Fragen mit Daten statt Vermutung:
 *   B1  Welche Akten stehen auf „aktiv", obwohl sie es nicht mehr sein
 *       koennen (bezahlt, gemergt, aussortiert, konvertiert)?
 *   B2  Gibt es Rueckruf-Termine in der Vergangenheit — und wann wurden
 *       sie gespeichert? (Beobachtung: am 27.07. gesetzt, steht auf 12.07.)
 *
 * Grenzen: 5 s Verbindung, 10 s je Abfrage, 60 s Gesamtabbruch.
 * Verwendung: npx tsx scripts/akte-blockade.ts [FIAON-REF]
 */
import "dotenv/config";
import postgres from "postgres";

const start = Date.now();
const notbremse = setTimeout(() => {
  console.error("\n⏱  Gesamtlimit 60 s erreicht — Abbruch.");
  process.exit(2);
}, 60_000);
notbremse.unref();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: "require", max: 2, connect_timeout: 5, idle_timeout: 5,
  connection: { statement_timeout: 10_000 }, onnotice: () => {},
});

const t = () => `${((Date.now() - start) / 1000).toFixed(1)}s`;
const schritt = (s: string) => console.log(`[${t()}] ${s}`);
const fmt = (d: any) => (d ? new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—");

const OFFEN_APP = ["pending_payment", "claimed_paid"];
const OFFEN_LEAD = ["neu", "kontaktiert", "nicht_erreichbar"];

async function main() {
  const ref = process.argv[2];

  if (ref) {
    schritt(`Konkreter Fall: ${ref}`);
    const [a] = await sql`
      SELECT ref, payment_status, merged_into, dismissed_at,
             assigned_agent_id, opened_by_agent_id, opened_at, promised_pay_date
      FROM fiaon_applications WHERE ref = ${ref}
    `;
    if (!a) console.log("   Kein Antrag unter dieser Referenz.");
    else {
      console.log(`   Status ${a.payment_status} · gemergt ${a.merged_into || "nein"} · aussortiert ${fmt(a.dismissed_at)}`);
      console.log(`   zugewiesen an #${a.assigned_agent_id || "—"} · aktiv seit ${fmt(a.opened_at)} (durch #${a.opened_by_agent_id || "—"})`);
      console.log(`   ${a.opened_at ? "❌ Diese Akte blockiert den Agenten." : "✅ Nicht aktiv — blockiert nicht."}`);
      const log = await sql`
        SELECT type, outcome, note, scheduled_at, created_at FROM fiaon_contact_log
        WHERE ref = ${ref} AND voided_at IS NULL ORDER BY created_at DESC LIMIT 6
      `;
      console.log("   Letzte Eintraege:");
      for (const l of log) {
        console.log(`     ${fmt(l.created_at)} · ${l.type}${l.outcome ? `/${l.outcome}` : ""}${l.scheduled_at ? ` · Termin ${fmt(l.scheduled_at)}` : ""}`);
      }
    }
  }

  // ── B1 · Akten, die gar nicht mehr aktiv sein koennen ────────────────
  schritt("B1 · Aktive Akten, die es nicht mehr sein koennen");
  const geister = await sql`
    SELECT 'Antrag' AS art, a.ref AS id, a.opened_by_agent_id AS agent,
           a.payment_status AS grund_status, (a.merged_into IS NOT NULL) AS gemergt,
           (a.dismissed_at IS NOT NULL) AS aussortiert, a.opened_at
    FROM fiaon_applications a
    WHERE a.opened_at IS NOT NULL
      AND (a.payment_status <> ALL(${OFFEN_APP}) OR a.merged_into IS NOT NULL OR a.dismissed_at IS NOT NULL)
    UNION ALL
    SELECT 'Lead', l.id::text, l.opened_by_agent_id,
           l.status, FALSE, (l.dismissed_at IS NOT NULL), l.opened_at
    FROM fiaon_leads l
    WHERE l.opened_at IS NOT NULL
      AND (l.status <> ALL(${OFFEN_LEAD}) OR l.dismissed_at IS NOT NULL OR l.converted_order_id IS NOT NULL)
  `;
  if (geister.length === 0) console.log("   ✅ Keine.");
  for (const g of geister) {
    console.log(`   ❌ ${g.art} ${g.id} · Agent #${g.agent} · Status ${g.grund_status}${g.gemergt ? " · gemergt" : ""}${g.aussortiert ? " · aussortiert" : ""} · aktiv seit ${fmt(g.opened_at)}`);
  }

  // ── B1b · Aktive Akten MIT dokumentiertem Ergebnis (der eigentliche Bug) ──
  schritt("B1b · Aktive Antrags-Akten, obwohl ein Ergebnis dokumentiert ist");
  const trotzErgebnis = await sql`
    SELECT a.ref, a.opened_by_agent_id AS agent, a.opened_at,
           MAX(c.created_at) AS letztes_ergebnis, COUNT(*)::int AS anzahl
    FROM fiaon_applications a
    JOIN fiaon_contact_log c ON c.ref = a.ref AND c.type = 'result' AND c.voided_at IS NULL
    WHERE a.opened_at IS NOT NULL AND c.created_at >= a.opened_at
    GROUP BY a.ref, a.opened_by_agent_id, a.opened_at
    ORDER BY MAX(c.created_at) DESC
  `;
  if (trotzErgebnis.length === 0) console.log("   ✅ Keine.");
  for (const r of trotzErgebnis) {
    console.log(`   ❌ ${r.ref} · Agent #${r.agent} · aktiv seit ${fmt(r.opened_at)} · ${r.anzahl} Ergebnis(se), letztes ${fmt(r.letztes_ergebnis)}`);
  }

  // ── B2 · Rueckruf-Termine in der Vergangenheit ───────────────────────
  schritt("B2 · Rueckruf-Termine, die beim Speichern schon vergangen waren");
  const rueckblick = await sql`
    SELECT ref AS id, 'Antrag' AS art, scheduled_at, created_at, agent_name
    FROM fiaon_contact_log
    WHERE scheduled_at IS NOT NULL AND voided_at IS NULL AND scheduled_at < created_at
    UNION ALL
    SELECT lead_id::text, 'Lead', scheduled_at, created_at, agent_name
    FROM fiaon_lead_log
    WHERE scheduled_at IS NOT NULL AND scheduled_at < created_at
    ORDER BY created_at DESC LIMIT 15
  `;
  if (rueckblick.length === 0) console.log("   ✅ Keiner — alle Termine lagen bei der Eingabe in der Zukunft.");
  for (const r of rueckblick) {
    const tage = (new Date(r.created_at).getTime() - new Date(r.scheduled_at).getTime()) / 86_400_000;
    console.log(`   ❌ ${r.art} ${r.id} · gespeichert ${fmt(r.created_at)} · Termin ${fmt(r.scheduled_at)} (${tage.toFixed(1)} Tage in der Vergangenheit) · ${r.agent_name}`);
  }

  schritt("Fertig.");
}

main()
  .catch((err: any) => {
    console.error(`\n❌ ${err?.code || ""} ${err?.message || err}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end({ timeout: 5 }).catch(() => {});
    console.log(`\nGesamtlaufzeit: ${t()}`);
    process.exit(process.exitCode || 0);
  });
