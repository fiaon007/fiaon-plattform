// ═══════════════════════════════════════════════════════════════════════════
// WIE VIELE KUNDEN SIND HEUTE GESPERRT, DIE SENDBAR WÄREN?
//
// ── DIE MELDUNG (Screenshot Hans Neumann, 21.08.2026) ─────────────────────
// „Antrag fertig — Rechnung offen", FIAON Ultra 79,99 €, Verwendungszweck
// FIAON-QQZAYT — und daneben „Zahlungsdaten: gesperrt", weil E-Mail, Tag des
// Gehaltseingangs, IBAN, AGB-, SCHUFA- und Vertragszustimmung fehlten.
//
// ── WAS DIESER LAUF MISST ─────────────────────────────────────────────────
//   1. Die Sperrgründe nach ALTER Regel (Antragszustand ODER 19 Pflichtfelder)
//      und nach NEUER (lebende unbezahlte Bestellung + Katalogpreis + Adresse).
//   2. Die Kreuztabelle: Wer wechselt wohin?
//   3. Die Zahl, um die es geht: Wie viele werden HEUTE gesperrt und wären
//      nach der neuen Regel sendbar?
//   4. Wie viele bleiben gesperrt — und woran wirklich.
//
// NUR LESEND. Schreibt eine CSV nach reports/.
//
//   npx tsx scripts/mess-rechnungsreif.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  sendeGrundSql, katalogpreisVorhandenSql, fehlendeFelderSql, zustimmungFehltSql,
} from "../server/lib/fiaon-massgebliche-bestellung";
import { antragVollstaendigSql } from "../server/lib/fiaon-antrag-vollstaendig";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`); }
const z = (n: number, b = 6) => String(n).padStart(b);

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvSchreiben(datei: string, kopf: string[], zeilen: unknown[][]): void {
  mkdirSync("reports", { recursive: true });
  writeFileSync(datei, "\uFEFF" + [kopf, ...zeilen].map((r) => r.map(csvFeld).join(";")).join("\n"));
  log(`\n  → ${datei} (${zeilen.length} Zeilen)`);
}

// ── DIE ALTE REGEL, WÖRTLICH ──────────────────────────────────────────────
// Sie steht hier nachgebaut und nicht importiert: Der Code IST die neue Regel.
// Ein Vorher-Nachher braucht beide Fassungen nebeneinander, und die alte gibt
// es nach der Änderung nur noch hier. Wörtlich aus dem Stand vor dem
// 21.08.2026 (git show 84dfa7f:server/lib/fiaon-massgebliche-bestellung.ts).
const REIF_ALT = "'completed','approved','submitted','documents_submitted',"
  + "'verifying','processing','pending_payment'";

function alteRegelSql(p = "p"): string {
  const empf = (a: string) =>
    `COALESCE(NULLIF(TRIM(${a}.email),''), NULLIF(TRIM(${a}.contact_email),''),`
    + ` NULLIF(TRIM(${a}.billing_email),''), NULLIF(TRIM(${p}.primary_email),''))`;
  const lebendOffen = (a: string) => `${a}.person_id IS NOT NULL
      AND ${a}.merged_into IS NULL AND ${a}.archived_at IS NULL
      AND ${a}.gdpr_deleted_at IS NULL AND ${a}.cancelled_at IS NULL
      AND ${a}.payment_status IN ('pending_payment', 'claimed_paid', 'expired')`;
  const reifOderVoll = (a: string) =>
    `(${a}.status IN (${REIF_ALT}) OR ${antragVollstaendigSql(a)})`;

  const offen = `EXISTS (SELECT 1 FROM fiaon_applications a1
    WHERE a1.person_id = ${p}.id AND ${lebendOffen("a1")})`;
  const offenMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a2
    WHERE a2.person_id = ${p}.id AND ${lebendOffen("a2")} AND ${empf("a2")} IS NOT NULL)`;
  const reif = `EXISTS (SELECT 1 FROM fiaon_applications a3
    WHERE a3.person_id = ${p}.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
      AND a3.gdpr_deleted_at IS NULL AND a3.payment_status = 'pending'
      AND ${reifOderVoll("a3")})`;
  const reifMitMail = `EXISTS (SELECT 1 FROM fiaon_applications a4
    WHERE a4.person_id = ${p}.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
      AND a4.gdpr_deleted_at IS NULL AND a4.payment_status = 'pending'
      AND ${reifOderVoll("a4")} AND ${empf("a4")} IS NOT NULL)`;
  const irgendeine = `EXISTS (SELECT 1 FROM fiaon_applications a5
    WHERE a5.person_id = ${p}.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
      AND a5.gdpr_deleted_at IS NULL)`;
  const bezahlt = `EXISTS (SELECT 1 FROM fiaon_applications a6
    WHERE a6.person_id = ${p}.id AND a6.merged_into IS NULL AND a6.archived_at IS NULL
      AND a6.gdpr_deleted_at IS NULL AND a6.payment_status = 'paid')`;
  return `CASE
    WHEN ${offenMitMail} THEN 'frei'
    WHEN ${offen} THEN 'keine_email'
    WHEN ${reifMitMail} THEN 'erste_rechnung'
    WHEN ${reif} THEN 'keine_email'
    WHEN ${bezahlt} THEN 'alles_bezahlt'
    WHEN ${irgendeine} THEN 'antrag_unfertig'
    ELSE 'keine_bestellung'
  END`;
}

const SENDBAR = "IN ('frei', 'erste_rechnung')";
/** Nur echte Menschen im Arbeitsvorrat — dieselbe Grenze wie die Arbeitsliste. */
const BESTAND = `p.merged_into_person_id IS NULL AND COALESCE(p.is_blocked, FALSE) = FALSE`;

async function main(): Promise<void> {
  titel("1 — DIE SPERRGRÜNDE, ALT UND NEU");
  const verteilung = (await sqlPool.unsafe(`
    SELECT ${alteRegelSql("p")} AS alt, ${sendeGrundSql("p")} AS neu, COUNT(*)::int AS n
    FROM fiaon_persons p WHERE ${BESTAND}
    GROUP BY 1, 2 ORDER BY 3 DESC
  `)) as any[];
  log("  Anzahl  ALTE Regel          →  NEUE Regel");
  log("  " + "─".repeat(58));
  for (const r of verteilung) {
    log(`  ${z(r.n)}  ${String(r.alt).padEnd(18)} →  ${r.neu}`);
  }

  titel("2 — DIE ZAHL, UM DIE ES GEHT");
  const [k] = (await sqlPool.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE ${alteRegelSql("p")} ${SENDBAR})::int          AS sendbar_alt,
      COUNT(*) FILTER (WHERE ${sendeGrundSql("p")} ${SENDBAR})::int         AS sendbar_neu,
      COUNT(*) FILTER (WHERE NOT (${alteRegelSql("p")} ${SENDBAR})
                         AND ${sendeGrundSql("p")} ${SENDBAR})::int         AS befreit,
      COUNT(*) FILTER (WHERE ${alteRegelSql("p")} ${SENDBAR}
                         AND NOT (${sendeGrundSql("p")} ${SENDBAR}))::int   AS neu_gesperrt,
      COUNT(*) FILTER (WHERE ${alteRegelSql("p")} = 'antrag_unfertig')::int AS unfertig_alt
    FROM fiaon_persons p WHERE ${BESTAND}
  `)) as any[];
  log(`  ${z(Number(k.sendbar_alt))}  Kunden waren VORHER sendbar`);
  log(`  ${z(Number(k.sendbar_neu))}  Kunden sind NACHHER sendbar`);
  log(`  ${z(Number(k.befreit))}  davon neu freigegeben  ← das ist die Zahl`);
  log(`  ${z(Number(k.neu_gesperrt))}  neu gesperrt (muss 0 oder klein und begründet sein)`);
  log(`  ${z(Number(k.unfertig_alt))}  trugen den Sperrgrund „antrag_unfertig"`);

  titel("3 — WER BLEIBT GESPERRT, UND WORAN WIRKLICH?");
  const bleibt = (await sqlPool.unsafe(`
    SELECT ${sendeGrundSql("p")} AS grund, COUNT(*)::int AS n
    FROM fiaon_persons p
    WHERE ${BESTAND} AND NOT (${sendeGrundSql("p")} ${SENDBAR})
    GROUP BY 1 ORDER BY 2 DESC
  `)) as any[];
  for (const r of bleibt) log(`  ${z(r.n)}  ${r.grund}`);

  titel("4 — DER VERTRAG BLEIBT UNVOLLSTÄNDIG — UND DAS IST IN ORDNUNG");
  // Die zweite Auskunft: Wie viele der jetzt SENDBAREN Kunden haben noch eine
  // Vertragslücke? Sie ist der Arbeitsvorrat für den Zustimmungs-Link — und
  // der Beweis, dass die Trennung wirklich zwei Dinge sind.
  const [v] = (await sqlPool.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE ${fehlendeFelderSql("p")} IS NOT NULL)::int   AS vertrag_offen,
      COUNT(*) FILTER (WHERE ${zustimmungFehltSql("p")} IS NOT NULL)::int  AS zustimmung_offen
    FROM fiaon_persons p
    WHERE ${BESTAND} AND ${sendeGrundSql("p")} ${SENDBAR}
  `)) as any[];
  log(`  ${z(Number(v.vertrag_offen))}  sendbare Kunden haben eine offene VERTRAGS-Lücke`);
  log(`  ${z(Number(v.zustimmung_offen))}  davon fehlt mindestens eine ZUSTIMMUNG`);
  // Kein deutsches Schlusszeichen als ASCII-Anführungszeichen in einem
  // JS-String: Es beendet ihn. Genau daran ist der erste Entwurf gescheitert
  // („Unterminated string literal", esbuild). In Zeichenketten deshalb
  // Unicode-Fluchten, in Kommentaren ist es harmlos.
  log("          \u2192 f\u00fcr sie gibt es den Knopf \u201eZustimmungs-Link an den Kunden\u201c.");
  log("          → ein Mitarbeiter darf sie NICHT selbst setzen.");

  titel("5 — DIE UNBEZAHLTEN BESTELLUNGEN OHNE KATALOGPREIS");
  // Der einzige neue Sperrgrund. Wenn diese Zahl groß wäre, hätte die neue
  // Regel eine Lücke statt einer Wand.
  const ohnePreis = (await sqlPool.unsafe(`
    SELECT a.ref, a.type, a.pack_key, a.pack_name, a.payment_status, a.person_id
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE ${BESTAND} AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
      AND a.payment_status NOT IN ('paid', 'refunded', 'superseded')
      AND NOT (${katalogpreisVorhandenSql("a")})
    ORDER BY a.created_at DESC
  `)) as any[];
  log(`  ${z(ohnePreis.length)}  unbezahlte Bestellungen ohne Katalogpreis`);
  for (const r of ohnePreis.slice(0, 10)) {
    log(`          ${String(r.ref).padEnd(22)} type=${String(r.type ?? "-").padEnd(9)} pack_key=${r.pack_key ?? "(leer)"}`);
  }

  titel("6 — DIE BEFREITEN, NAMENTLICH");
  const befreit = (await sqlPool.unsafe(`
    SELECT p.id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                          p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent,
           ${alteRegelSql("p")} AS alt, ${sendeGrundSql("p")} AS neu,
           ${fehlendeFelderSql("p")} AS vertrag_fehlt,
           ${zustimmungFehltSql("p")} AS zustimmung_fehlt
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE ${BESTAND}
      AND NOT (${alteRegelSql("p")} ${SENDBAR}) AND ${sendeGrundSql("p")} ${SENDBAR}
    ORDER BY p.id
  `)) as any[];
  log("  Person   Name                          alt → neu");
  log("  " + "─".repeat(70));
  for (const r of befreit.slice(0, 15)) {
    log(`  ${String(r.id).padEnd(8)} ${String(r.name).slice(0, 28).padEnd(29)} ${r.alt} → ${r.neu}`);
  }
  if (befreit.length > 15) log(`  … und ${befreit.length - 15} weitere (alle in der CSV)`);

  csvSchreiben("reports/rechnungsreif-vorher-nachher.csv",
    ["person_id", "name", "betreuer", "grund_alt", "grund_neu", "vertrag_fehlt", "zustimmung_fehlt"],
    befreit.map((r) => [r.id, r.name, r.agent ?? "(niemand)", r.alt, r.neu,
      r.vertrag_fehlt ?? "", r.zustimmung_fehlt ?? ""]));

  await sqlPool.end();
}
main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
