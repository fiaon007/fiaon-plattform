// ═══════════════════════════════════════════════════════════════════════════
// DIE FEHLENDEN AKTENEINTRÄGE NACHTRAGEN
//
// ── WAS FEHLT UND WARUM ───────────────────────────────────────────────────
// Vom 19.08. bis zum 21.08.2026 lagen vier JS-Kommentarzeilen INNERHALB des
// SQL-Template-Literals in `rechnungStellen`. Damit war jedes
// `INSERT INTO fiaon_contact_log` ein Syntaxfehler — und das `.catch()`
// daneben hat ihn geschluckt.
//
// GEMESSEN (scripts/mess-rechnungen-luecke.ts):
//   63 erste Rechnungen gestellt, 63 versendet, 0 nicht versendet.
//   0 Akteneinträge „Erste Rechnung gestellt".
//
// Es fehlt also nur das Protokoll. Der Kunde hat seine Rechnung; der
// Mitarbeiter, der in die Akte sieht, findet nichts — und schickt ein zweites
// Mal.
//
// ── WARUM DER EINTRAG ALS REKONSTRUKTION GEKENNZEICHNET IST ───────────────
// Ich kenne den Zeitpunkt der Sendung (aus Zustellprotokoll bzw.
// `payment_email_sent_at`) und den Betrag. Ich kenne NICHT, wer gedrückt hat:
// Der Akteur stand im verlorenen Eintrag. Ein nachgetragener Eintrag, der einen
// Namen erfindet, wäre schlimmer als der fehlende — deshalb steht dort
// „rückwirkend rekonstruiert" und kein Mitarbeitername.
//
//   npx tsx scripts/akteneintraege-nachtragen.ts              # Vorschau
//   npx tsx scripts/akteneintraege-nachtragen.ts --schreiben  # nach Freigabe
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");
const AB_TAG = "2026-08-19";
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }

/** Die Marke, an der man einen nachgetragenen Eintrag erkennt — auch in fünf Jahren. */
const MARKE = "[rückwirkend rekonstruiert]";

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main(): Promise<void> {
  const fehlend = (await sqlPool`
    SELECT a.ref, a.person_id, a.amount_due, a.payment_reference, a.pack_name,
           a.payment_due_date, a.payment_email_sent_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           (SELECT MAX(l.created_at) FROM fiaon_mail_log l
             WHERE l.event = 'payment_details' AND l.status = 'versandt'
               AND l.person_id = a.person_id AND l.created_at >= ${AB_TAG}::date) AS mail_am,
           (SELECT l.empfaenger FROM fiaon_mail_log l
             WHERE l.event = 'payment_details' AND l.status = 'versandt'
               AND l.person_id = a.person_id AND l.created_at >= ${AB_TAG}::date
             ORDER BY l.created_at DESC LIMIT 1) AS empfaenger
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_due_date IS NOT NULL AND a.amount_due IS NOT NULL
      AND (a.payment_due_date - INTERVAL '7 days')::date >= ${AB_TAG}::date
      -- Nur was wirklich raus ist: sonst behauptet der Eintrag eine Sendung.
      AND (a.payment_email_sent_at IS NOT NULL
        OR EXISTS (SELECT 1 FROM fiaon_mail_log l
          WHERE l.event = 'payment_details' AND l.status = 'versandt'
            AND l.person_id = a.person_id AND l.created_at >= ${AB_TAG}::date))
      -- Und nur, wo der Eintrag fehlt. Zweimal laufen darf nichts verdoppeln.
      AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log cl
        WHERE cl.ref = a.ref AND cl.voided_at IS NULL
          AND cl.note ILIKE '%Erste Rechnung gestellt%')
    ORDER BY a.payment_due_date
  `) as any[];

  titel("WAS NACHGETRAGEN WIRD");
  log(`  ${String(fehlend.length).padStart(6)}  Akteneinträge fehlen und werden rekonstruiert\n`);
  for (const r of fehlend.slice(0, 12)) {
    const wann = r.mail_am ?? r.payment_email_sent_at;
    log(`  ${String(r.ref).padEnd(22)} ${String(r.name).slice(0, 24).padEnd(25)} `
      + `${String(r.amount_due ?? "?").padStart(7)} €  `
      + `versandt ${wann ? new Date(wann).toLocaleString("de-DE") : "?"}`);
  }
  if (fehlend.length > 12) log(`  … und ${fehlend.length - 12} weitere`);

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/akteneintraege-nachtrag.csv", "\uFEFF" + [
    ["ref", "person_id", "name", "betrag", "verwendungszweck", "versandt_am", "empfaenger"],
    ...fehlend.map((r) => [r.ref, r.person_id ?? "", r.name, r.amount_due ?? "",
      r.payment_reference ?? "",
      (r.mail_am ?? r.payment_email_sent_at)
        ? new Date(r.mail_am ?? r.payment_email_sent_at).toLocaleString("de-DE") : "",
      r.empfaenger ?? ""]),
  ].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log("\n  → reports/akteneintraege-nachtrag.csv");

  if (!SCHREIBEN) {
    titel("VORSCHAU — es wurde NICHTS geschrieben");
    log("  Mit --schreiben nachtragen.");
    await sqlPool.end();
    return;
  }

  titel("SCHREIBEN");
  let n = 0;
  for (const r of fehlend) {
    if (!r.person_id) continue;
    const wann = r.mail_am ?? r.payment_email_sent_at;
    const betrag = r.amount_due != null ? `${Number(r.amount_due).toFixed(2)} €` : "Betrag unbekannt";
    // `created_at` auf den Sendezeitpunkt: Ein Eintrag von heute würde
    // behaupten, die Rechnung sei heute gestellt worden.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${String(r.ref)}, ${Number(r.person_id)}, NULL, ${"System"}, 'note',
              ${`${MARKE} Erste Rechnung gestellt: ${betrag}, Verwendungszweck `
                + `${r.payment_reference ?? "unbekannt"} — verschickt an `
                + `${r.empfaenger ?? "die hinterlegte Adresse"}. `
                + "Der ursprüngliche Eintrag ging zwischen dem 19. und 21.08.2026 verloren "
                + "(Syntaxfehler im SQL, vom .catch() geschluckt). Wer gedrückt hat, ist "
                + "nicht rekonstruierbar und wird deshalb nicht behauptet."},
              ${wann ? new Date(wann) : new Date()})
    `;
    n++;
  }
  log(`  ${n} Einträge nachgetragen.`);

  // ── ZÄHLPROBE ─────────────────────────────────────────────────────────
  const [nach] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_contact_log
    WHERE note LIKE ${`${MARKE}%`}
  `) as any[];
  log(`  Zählprobe: ${nach.n} rekonstruierte Einträge in der Akte.`);
  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
