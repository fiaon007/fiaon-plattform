// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG DER OFFENEN RESTE
//
// Fünf Themen, die in den letzten Aufträgen offen ausgewiesen wurden. Erst
// messen, dann beheben — die Zahlen entscheiden über die Reihenfolge.
//
//   npx tsx scripts/mess-reste.ts
//
// NUR LESEN.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(8)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}
const befund: Record<string, unknown> = {};

function feld(v: unknown): string {
  const s = v == null ? "" : String(v).replace(/[\r\n]+/g, " ");
  return /[",;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csv(name: string, zeilen: Record<string, unknown>[]): string {
  mkdirSync("reports", { recursive: true });
  const pfad = `reports/${name}`;
  if (zeilen.length === 0) { writeFileSync(pfad, "keine Treffer\n", "utf8"); return pfad; }
  const kopf = Object.keys(zeilen[0]);
  writeFileSync(pfad, `${[kopf.join(";"), ...zeilen.map((z) => kopf.map((k) => feld(z[k])).join(";"))].join("\n")}\n`, "utf8");
  return pfad;
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 1 — DIE DREI SCHUFA-TEILWAHRHEITEN");
  // ═════════════════════════════════════════════════════════════════════════
  // (1) Produkt bezahlt: eine eigene Bestellzeile type='schufa'
  // (2) Dokument da:     schufa_pdf am Kundendatensatz
  // (3) Dokument geprüft: schufa_status
  const [s] = (await sqlPool`
    SELECT
      COUNT(*)::int AS kunden,
      COUNT(*) FILTER (WHERE schufa_pdf IS NOT NULL)::int AS mit_dokument,
      COUNT(*) FILTER (WHERE schufa_status = 'approved')::int AS geprueft_ok,
      COUNT(*) FILTER (WHERE schufa_status = 'changes_requested')::int AS beanstandet,
      COUNT(*) FILTER (WHERE COALESCE(schufa_status, 'pending') = 'pending'
        AND schufa_pdf IS NOT NULL)::int AS liegt_zur_pruefung,
      -- Der Widerspruch: geprüft, aber kein Dokument da.
      COUNT(*) FILTER (WHERE schufa_status = 'approved' AND schufa_pdf IS NULL)::int AS geprueft_ohne_dokument
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
  `) as any[];
  zahl("Kundendatensätze", s.kunden);
  zahl("… mit hochgeladenem SCHUFA-Dokument", s.mit_dokument);
  zahl("… Dokument geprüft und freigegeben", s.geprueft_ok);
  zahl("… beanstandet", s.beanstandet);
  zahl("… liegt zur Prüfung", s.liegt_zur_pruefung);
  zahl("… WIDERSPRUCH: freigegeben ohne Dokument", s.geprueft_ohne_dokument,
    Number(s.geprueft_ohne_dokument) > 0 ? "das kann nicht sein" : "gut");

  const [b] = (await sqlPool`
    SELECT COUNT(*)::int AS bestellungen,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
           COUNT(*) FILTER (WHERE payment_status IN ('pending_payment','claimed_paid'))::int AS offen,
           COUNT(*) FILTER (WHERE person_id IS NOT NULL)::int AS mit_person
    FROM fiaon_applications
    WHERE (COALESCE(type,'') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      AND merged_into IS NULL
  `) as any[];
  log("");
  zahl("SCHUFA-Bestellungen", b.bestellungen);
  zahl("… bezahlt", b.bezahlt);
  zahl("… Zahlung offen", b.offen);
  zahl("… mit person_id verknüpft", b.mit_person,
    "seit dem Kontakt-Umzug — vorher lief die Zuordnung nur über die E-Mail");

  // ── DER WIDERSPRUCH, DER DIE ANZEIGEN AUSEINANDERTREIBT ────────────────
  // Bezahlt, aber kein Dokument: Das Portal fordert weiter zum Kaufen auf,
  // während in der Akte „erledigt" steht.
  const [w] = (await sqlPool`
    WITH bestellung AS (
      SELECT DISTINCT ON (person_id) person_id, payment_status, ref AS best_ref
      FROM fiaon_applications
      WHERE (COALESCE(type,'') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
        AND person_id IS NOT NULL AND merged_into IS NULL
      ORDER BY person_id, created_at DESC
    )
    SELECT
      COUNT(*) FILTER (WHERE bs.payment_status = 'paid' AND a.schufa_pdf IS NULL)::int AS bezahlt_ohne_dokument,
      COUNT(*) FILTER (WHERE bs.payment_status = 'paid' AND a.schufa_pdf IS NOT NULL)::int AS bezahlt_mit_dokument,
      COUNT(*) FILTER (WHERE bs.person_id IS NULL AND a.schufa_pdf IS NOT NULL)::int AS dokument_ohne_kauf
    FROM fiaon_applications a
    LEFT JOIN bestellung bs ON bs.person_id = a.person_id
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND COALESCE(a.type,'') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.payment_status = 'paid'
  `) as any[];
  log("");
  log("  DIE WIDERSPRÜCHE (bei zahlenden Paket-Kunden):");
  zahl("Auskunft bezahlt, aber kein Dokument da", w.bezahlt_ohne_dokument,
    "das Portal forderte hier weiter zum Kaufen auf");
  zahl("Auskunft bezahlt UND Dokument da", w.bezahlt_mit_dokument);
  zahl("Dokument selbst hochgeladen, nichts gekauft", w.dokument_ohne_kauf,
    "diese Menschen brauchen keinen Kauf — das muss die Anzeige wissen");
  befund.schufa = { ...s, ...b, ...w };

  // ── DIE VIER GEMELDETEN NAMEN ──────────────────────────────────────────
  log("\n  DIE VIER GEMELDETEN NAMEN:");
  const namen = ["Imzerovic", "Felkovic", "Gammow", "Stefanescu"];
  const vier: Record<string, unknown>[] = [];
  for (const n of namen) {
    const treffer = (await sqlPool`
      SELECT a.ref, a.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.company_name) AS name,
             a.payment_status, a.pack_name,
             a.schufa_pdf IS NOT NULL AS hat_dokument,
             COALESCE(a.schufa_status, 'pending') AS dok_status,
             a.kyc_status, a.account_status,
             (SELECT sb.payment_status FROM fiaon_applications sb
               WHERE (COALESCE(sb.type,'') = 'schufa' OR sb.ref LIKE 'FIAON-SCHUFA-%')
                 AND sb.person_id = a.person_id AND sb.merged_into IS NULL
               ORDER BY sb.created_at DESC LIMIT 1) AS kauf_status
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND (a.last_name ILIKE ${`%${n}%`} OR a.company_name ILIKE ${`%${n}%`})
        AND COALESCE(a.type,'') <> 'schufa'
      ORDER BY a.created_at DESC
    `) as any[];
    log(`\n  ── ${n} ──`);
    if (treffer.length === 0) { log("     nicht gefunden"); continue; }
    for (const t of treffer) {
      log(`     ${String(t.ref).padEnd(24)} ${String(t.name ?? "").padEnd(24)} `
        + `Zahlung: ${String(t.payment_status ?? "—").padEnd(16)} `
        + `Dokument: ${t.hat_dokument ? "ja " : "nein"} · Prüfung: ${String(t.dok_status).padEnd(18)} `
        + `Kauf: ${t.kauf_status ?? "keiner"}`);
      vier.push({ suche: n, ...t, schufa_pdf: undefined });
    }
  }
  log(`\n  CSV: ${csv("mess-reste-schufa.csv", vier)}`);

  // ── WIE VIELE ANZEIGEN LESEN DIE TEILWAHRHEITEN EINZELN? ───────────────
  log("");
  const { execFileSync } = await import("node:child_process");
  for (const [name, muster] of [
    ["schufa_pdf direkt gelesen", "schufa_pdf"],
    ["schufa_status direkt gelesen", "schufa_status"],
    ["hasSchufa in der Oberfläche", "hasSchufa"],
    ["bonitaet-status-Route abgefragt", "bonitaet-status"],
  ] as [string, string][]) {
    try {
      const raus = execFileSync("grep", ["-rn", muster, "server/", "client/src/", "--include=*.ts", "--include=*.tsx"],
        { encoding: "utf8", maxBuffer: 20e6 });
      const zeilen = raus.split("\n").filter((z) => z.trim() && !/^\S+:\d+:\s*(\/\/|\*)/.test(z));
      const dateien = new Set(zeilen.map((z) => z.split(":")[0]));
      zahl(name, zeilen.length, `in ${dateien.size} Dateien`);
    } catch { zahl(name, 0); }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 2 — DIE ZAHLUNGS-EINZELFÄLLE");
  // ═════════════════════════════════════════════════════════════════════════
  for (const n of ["Toth", "Branics", "Brannix", "Bauer", "Kovic"]) {
    const treffer = (await sqlPool`
      SELECT a.ref, a.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.company_name) AS name,
             a.pack_name, a.amount_due, a.payment_status,
             a.pack_key, a.created_at::date AS am,
             -- Der IST-Wert steht NICHT am Antrag, sondern am Bankeingang.
             -- Genau das ist der Fall Toth: Die Meldung „nicht korrekt
             -- überwiesen“ kommt aus amount_ok in fiaon_bank_txns, und die
             -- wird beim Zuordnen EINMAL berechnet und dann nie wieder.
             (SELECT (t.amount_cents / 100.0)::numeric(10,2) FROM fiaon_bank_txns t
               WHERE t.matched_ref = a.ref ORDER BY t.id DESC LIMIT 1) AS bank_betrag,
             (SELECT t.amount_ok FROM fiaon_bank_txns t
               WHERE t.matched_ref = a.ref ORDER BY t.id DESC LIMIT 1) AS betrag_ok
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND (a.last_name ILIKE ${`%${n}%`} OR a.company_name ILIKE ${`%${n}%`})
        AND COALESCE(a.type,'') <> 'schufa'
        AND a.payment_status IN ('paid', 'claimed_paid', 'pending_payment')
      ORDER BY a.created_at DESC LIMIT 6
    `) as any[];
    log(`\n  ── ${n} ──`);
    if (treffer.length === 0) { log("     keine bezahlten/offenen Bestellungen"); continue; }
    for (const t of treffer) {
      log(`     ${String(t.ref).padEnd(24)} ${String(t.name ?? "").padEnd(24)} `
        + `Paket: ${String(t.pack_name ?? "— OHNE BEZEICHNUNG —").padEnd(30)} `
        + `Soll: ${String(t.amount_due ?? "—").padStart(7)} `
        + `Bank: ${String(t.bank_betrag ?? "—").padStart(7)} `
        + `· betrag_ok=${t.betrag_ok === null ? "—" : t.betrag_ok} · ${t.payment_status}`);
    }
  }

  // ── BEZAHLT OHNE PAKETBEZEICHNUNG ──────────────────────────────────────
  const [ohne] = (await sqlPool`
    SELECT COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(pack_key,'')),'') IS NOT NULL)::int AS aber_tier,
           COUNT(*) FILTER (WHERE amount_due IS NOT NULL)::int AS aber_betrag
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND payment_status = 'paid'
      AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NULLIF(TRIM(COALESCE(pack_name, '')), '') IS NULL
  `) as any[];
  log("");
  zahl("BEZAHLT, aber ohne Paketbezeichnung", ohne.n, "der Fall Bauer/Kovic");
  zahl("… hat aber einen Paket-Schlüssel (pack_key)", ohne.aber_tier, "daraus lässt sich der Name ableiten");
  zahl("… hat aber einen Betrag", ohne.aber_betrag, "auch daraus");

  log(`\n  CSV: ${csv("mess-reste-ohne-paket.csv", (await sqlPool`
    SELECT ref, person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), company_name) AS name,
           pack_key, amount_due, created_at::date AS am
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL AND payment_status = 'paid'
      AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NULLIF(TRIM(COALESCE(pack_name, '')), '') IS NULL
    ORDER BY created_at DESC
  `) as any[])}`);

  // ── SOLLWERT-ABWEICHUNG (der Fall Toth) ────────────────────────────────
  // „nicht korrekt überwiesen — erhalten 59,99" bei Pro 59,99: Der Vergleich
  // meldet eine Abweichung, wo keine ist.
  // ── DER FALL TOTH: `amount_ok` IST EINE MOMENTAUFNAHME ─────────────────
  // `amount_ok` wird beim Zuordnen berechnet (appAmountCents === amount_cents)
  // und danach NIE wieder. Ändert sich `amount_due` später — etwa durch einen
  // Preistausch —, bleibt die alte Bewertung stehen und die Anzeige behauptet
  // eine Abweichung, die es nicht mehr gibt.
  const [abw] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE t.amount_ok = FALSE)::int AS als_abweichend_markiert,
           -- Und jetzt die Gegenrechnung: Stimmt es HEUTE doch?
           COUNT(*) FILTER (WHERE t.amount_ok = FALSE
             AND ROUND((t.amount_cents / 100.0)::numeric, 2)
               = ROUND(a.amount_due::numeric, 2))::int AS stimmt_heute_doch,
           COUNT(*) FILTER (WHERE t.amount_ok = FALSE
             AND ROUND((t.amount_cents / 100.0)::numeric, 2)
               <> ROUND(a.amount_due::numeric, 2))::int AS weicht_wirklich_ab
    FROM fiaon_bank_txns t
    JOIN fiaon_applications a ON a.ref = t.matched_ref AND a.merged_into IS NULL
    WHERE t.matched_ref IS NOT NULL AND a.amount_due IS NOT NULL
  `.catch(() => [{ gesamt: 0, als_abweichend_markiert: 0, stimmt_heute_doch: 0, weicht_wirklich_ab: 0 }])) as any[];
  log("");
  zahl("Zugeordnete Bankeingänge", abw.gesamt);
  zahl("… als abweichend markiert", abw.als_abweichend_markiert);
  zahl("… STIMMT HEUTE DOCH", abw.stimmt_heute_doch,
    "der Fall Toth: die Marke ist von damals, der Betrag passt");
  zahl("… weicht wirklich ab", abw.weicht_wirklich_ab, "hier lohnt ein Blick");
  befund.zahlungen = { ohnePaket: ohne, abweichung: abw };

  // ═════════════════════════════════════════════════════════════════════════
  titel("TEIL 3 — WARTEZUSTAND UND LISTEN-SONSTIGES");
  // ═════════════════════════════════════════════════════════════════════════
  const [nr] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE COALESCE(status,'') = 'offen')::int AS offen,
           COUNT(DISTINCT person_id)::int AS personen
    FROM fiaon_contact_log
    WHERE ergebnis = 'number_update_request'
  `.catch(() => [{ gesamt: 0, offen: 0, personen: 0 }])) as any[];
  zahl("Kontaktversuche „falsche Nummer“", nr.gesamt);
  zahl("… betroffene Personen", nr.personen);

  // Wie viele davon stehen NICHT auf „wartet auf Kunde"?
  const [warte] = (await sqlPool`
    SELECT COUNT(DISTINCT c.person_id)::int AS n
    FROM fiaon_contact_log c
    WHERE c.ergebnis = 'number_update_request'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = c.person_id AND a.merged_into IS NULL
          AND COALESCE(a.wartet_auf, '') <> ''
      )
  `.catch(() => [{ n: -1 }])) as any[];
  zahl("… ohne Wartezustand", warte.n,
    Number(warte.n) < 0 ? "Spalte wartet_auf fehlt noch" : "sie stehen in Daniels Tagesliste");
  befund.wartezustand = { ...nr, ohneWarte: warte.n };

  await sqlPool.end();
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-reste.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-reste.json\n");
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
