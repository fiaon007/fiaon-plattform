// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSLAUF: UNBEZAHLTE BETRÄGE AUF DEN KATALOGPREIS
//
// ── WAS ER TUT ────────────────────────────────────────────────────────────
// Er setzt bei UNBEZAHLTEN Bestellungen den Betrag auf den Katalogpreis ihres
// Pakets. Bezahlte fasst er NICHT an — dort hängen Rechnung, Provision und
// Buchhaltung; sie stehen nur im Report.
//
// ── WAS ER GEMESSEN VORFINDET (19.08.2026) ────────────────────────────────
// Zwei Bonitätsauskünfte stehen auf 99,99 € statt 74,00 €. Beide tragen im
// pack_key „highend", weil der Dubletten-Merge es dort eingetragen hat, und
// eine Preisrechnung nach pack_key hat daraus den High-End-Preis gemacht.
// Beide Kunden wurden um 99,99 € für eine 74-€-Auskunft gebeten.
//
// Vier bezahlte Bestellungen weichen ebenfalls ab (79,99 € bei High End,
// zweimal 10,00 €). Sie bleiben, wie sie sind.
//
// ── DIE REIHENFOLGE IST NICHT BELIEBIG ────────────────────────────────────
// Dieser Lauf gehört VOR das Einspielen von Migration 065. Die Wand dort lehnt
// abweichende Beträge ab — eine unbezahlte Altzeile würde beim nächsten
// Schreibzugriff scheitern, und dann schaltet jemand die Wand ab
// (AGENTS.md: eine Wand, die man nicht benutzen kann, wird umgangen).
//
//   npx tsx scripts/katalogpreis-lauf.ts               # Vorschau
//   npx tsx scripts/katalogpreis-lauf.ts --schreiben   # und schreiben
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { katalogpreisCents } from "../server/lib/fiaon-massgebliche-bestellung";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(76)}\n${t}\n${"═".repeat(76)}`); }
const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

async function main(): Promise<void> {
  mkdirSync("reports", { recursive: true });

  const alle = (await sqlPool`
    SELECT a.ref, a.type, a.pack_key, a.pack_name, a.amount_due, a.payment_status,
           a.person_id, a.created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.person_ref, a.ref) AS name,
           p.primary_email, ag.name AS betreuer
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE a.amount_due IS NOT NULL
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.cancelled_at IS NULL
    ORDER BY a.created_at
  `) as any[];

  const abweichend = alle.flatMap((a) => {
    const soll = katalogpreisCents(a);
    if (soll == null) return [];
    const ist = Math.round(Number(a.amount_due) * 100);
    return ist === soll ? [] : [{ ...a, soll, ist }];
  });
  const offen = abweichend.filter((a) => a.payment_status !== "paid");
  const bezahlt = abweichend.filter((a) => a.payment_status === "paid");

  // ═════════════════════════════════════════════════════════════════════════
  titel(SCHREIBEN ? "SCHREIBLAUF" : "VORSCHAU — es wird nichts geschrieben");
  // ═════════════════════════════════════════════════════════════════════════
  log("");
  log(`  ${String(alle.length).padStart(5)}  lebende Bestellungen mit Betrag`);
  log(`  ${String(abweichend.length).padStart(5)}  weichen vom Katalogpreis ab`);
  log(`  ${String(offen.length).padStart(5)}  UNBEZAHLT — werden korrigiert`);
  log(`  ${String(bezahlt.length).padStart(5)}  BEZAHLT — bleiben unangetastet`);
  log("");
  for (const a of offen) {
    log(`  ${String(a.ref).padEnd(28)} ${String(a.name).slice(0, 24).padEnd(25)}`);
    log(`      ${String(a.pack_name ?? a.pack_key).slice(0, 40).padEnd(41)}`
      + ` ${eur(a.ist).padStart(10)} → ${eur(a.soll).padStart(10)}`
      + `   (${a.payment_status}, Betreuer ${a.betreuer ?? "—"})`);
  }
  if (bezahlt.length > 0) {
    log("");
    log("  BEZAHLT — nur zur Kenntnis, keine Änderung:");
    for (const a of bezahlt) {
      log(`     ${String(a.ref).padEnd(28)} ${String(a.name).slice(0, 22).padEnd(23)}`
        + ` ${String(a.pack_key).padEnd(10)} ${eur(a.ist).padStart(10)}`
        + `  (Katalog ${eur(a.soll)})`);
    }
  }

  writeFileSync("reports/katalogpreis-lauf.csv",
    "art;ref;name;paket;betrag_alt;betrag_neu;zahlungsstatus;betreuer;email\n"
    + offen.map((a) => ["wird_korrigiert", a.ref, a.name, a.pack_name ?? a.pack_key,
      (a.ist / 100).toFixed(2), (a.soll / 100).toFixed(2), a.payment_status,
      a.betreuer, a.primary_email].map(feld).join(";")).join("\n")
    + (offen.length && bezahlt.length ? "\n" : "")
    + bezahlt.map((a) => ["bezahlt_bleibt", a.ref, a.name, a.pack_name ?? a.pack_key,
      (a.ist / 100).toFixed(2), (a.soll / 100).toFixed(2), a.payment_status,
      a.betreuer, a.primary_email].map(feld).join(";")).join("\n") + "\n",
    "utf8");
  log("");
  log("  reports/katalogpreis-lauf.csv");

  // ═════════════════════════════════════════════════════════════════════════
  titel("WER HAT EINE MAIL MIT DEM FALSCHEN BETRAG BEKOMMEN?");
  // ═════════════════════════════════════════════════════════════════════════
  // Die Frage aus dem Auftrag. Maßstab ist NICHT „Betrag unter 5 €" (so einen
  // gibt es in 4.132 Mails nicht), sondern: Stand im Payload ein anderer Betrag
  // als der Katalogpreis der Bestellung? Das trifft genau die Menschen, die um
  // eine falsche Summe gebeten wurden.
  const refs = abweichend.map((a) => String(a.ref));
  const mails = refs.length === 0 ? [] : (await sqlPool`
    SELECT l.created_at, l.event, l.empfaenger, l.status,
           COALESCE(l.payload->>'betrag', (l.payload #>> '{}')::jsonb->>'betrag') AS betrag,
           COALESCE(l.payload->>'antrag_id', (l.payload #>> '{}')::jsonb->>'antrag_id') AS ref
    FROM fiaon_mail_log l
    WHERE COALESCE(l.payload->>'antrag_id', (l.payload #>> '{}')::jsonb->>'antrag_id')
          = ANY(${refs}::text[])
    ORDER BY l.created_at DESC
  `) as any[];
  const sollJeRef = new Map(abweichend.map((a) => [String(a.ref), a.soll as number]));
  const falsch = mails.filter((m) => {
    // Ohne Betrag im Payload gibt es keinen falschen Betrag. Ein erster Entwurf
    // zählte `null` mit (Number(null) ist 0) und stellte eine Willkommensmail
    // in die Liste der Korrekturmails — eine Mail, die nie einen Betrag nannte.
    if (m.betrag == null || String(m.betrag).trim() === "") return false;
    const soll = sollJeRef.get(String(m.ref));
    const b = Number(m.betrag);
    return soll != null && Number.isFinite(b) && Math.round(b * 100) !== soll;
  });
  log("");
  log(`  ${String(mails.length).padStart(5)}  Mails zu den abweichenden Bestellungen im Zustellprotokoll`);
  log(`  ${String(falsch.length).padStart(5)}  davon mit einem Betrag ≠ Katalogpreis — Kandidaten für`);
  log("         eine Korrekturmail");
  log("");
  for (const m of falsch) {
    log(`     ${String(m.created_at).slice(0, 19)}  ${String(m.empfaenger).slice(0, 32).padEnd(33)}`
      + ` ${String(m.event).padEnd(20)} ${String(m.betrag).padStart(8)} €`
      + `  (richtig: ${eur(sollJeRef.get(String(m.ref))!)})  ${m.ref}`);
  }
  writeFileSync("reports/katalogpreis-korrekturmails.csv",
    "gesendet_am;empfaenger;event;betrag_gesendet;betrag_richtig;ref\n"
    + falsch.map((m) => [String(m.created_at).slice(0, 19), m.empfaenger, m.event,
      m.betrag, (sollJeRef.get(String(m.ref))! / 100).toFixed(2), m.ref,
    ].map(feld).join(";")).join("\n") + "\n", "utf8");
  log("");
  log("  reports/katalogpreis-korrekturmails.csv");

  // ═════════════════════════════════════════════════════════════════════════
  if (!SCHREIBEN) {
    log("");
    log("  Vorschau. Mit --schreiben werden die unbezahlten Beträge gesetzt.");
    log("");
    await sqlPool.end();
    return;
  }

  titel("SCHREIBEN");
  let geschrieben = 0;
  for (const a of offen) {
    // Je Einheit exakt (AGENTS.md): Die Bedingung im UPDATE hält den alten Wert
    // fest. Hat ihn zwischen Messung und Schreiben jemand geändert, passiert
    // nichts — statt den fremden Wert zu überschreiben.
    const rows = await sqlPool`
      UPDATE fiaon_applications
      SET amount_due = ${(a.soll / 100).toFixed(2)}::numeric, updated_at = NOW()
      WHERE ref = ${a.ref}
        AND ROUND(amount_due * 100) = ${a.ist}
        AND COALESCE(payment_status, '') <> 'paid'
      RETURNING ref
    `;
    if (rows.length === 0) {
      log(`  übersprungen ${a.ref} — der Betrag hat sich zwischenzeitlich geändert.`);
      continue;
    }
    geschrieben++;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${a.ref}, ${a.person_id}, NULL, 'Bestandslauf', 'system',
              ${`Betrag auf den Katalogpreis gesetzt: ${eur(a.ist)} → ${eur(a.soll)}. `
                + `Grund: ${a.type === "schufa" ? "Bonitätsauskunft kostet 74,00 €; im pack_key stand "
                  + `„${a.pack_key}" (aus dem Dubletten-Merge), und die Preisrechnung folgte ihm.`
                  : `Der Betrag entsprach nicht dem Katalogpreis des Pakets „${a.pack_key}".`}`},
              NOW())
    `.catch(() => {});
    log(`  ${a.ref}: ${eur(a.ist)} → ${eur(a.soll)}`);
  }

  // ── ZÄHLPROBE ───────────────────────────────────────────────────────────
  const nachher = ((await sqlPool`
    SELECT a.ref, a.type, a.pack_key, a.amount_due
    FROM fiaon_applications a
    WHERE a.amount_due IS NOT NULL
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.cancelled_at IS NULL AND COALESCE(a.payment_status, '') <> 'paid'
  `) as any[]).filter((a) => {
    const soll = katalogpreisCents(a);
    return soll != null && Math.round(Number(a.amount_due) * 100) !== soll;
  });
  log("");
  log(`  ${geschrieben} geschrieben. Zählprobe: ${nachher.length} unbezahlte Abweichungen übrig.`);
  if (nachher.length > 0) {
    for (const a of nachher) log(`     ÜBRIG: ${a.ref} ${a.pack_key} ${a.amount_due}`);
  }
  log("");
  await sqlPool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
