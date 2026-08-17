// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — der eine Ablauf, Stufen, Bestand, SCHUFA-nur
//
// NUR LESEN. Dieses Skript schreibt nichts.
//
//   npx tsx scripts/mess-ablauf.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const log = (s = "") => console.log(s);
function titel(t: string): void {
  log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`);
}
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
  titel("1. DIE STUFE — steht in der Spalte, was aus dem Ablauf folgt?");
  //
  // Heute liest `stufeVon()` die SPALTE `onboarding_stufe`. Der Auftrag
  // verlangt eine ABLEITUNG: Zahlung + erledigtes Startgespräch ergeben die
  // Stufe. Die Frage ist also: Wie oft weicht die Spalte von der Wahrheit ab?
  // ═════════════════════════════════════════════════════════════════════════
  const [s] = (await sqlPool`
    SELECT COUNT(*)::int AS bezahlt,
           COUNT(*) FILTER (WHERE onboarding_stufe = 'voll_aktiv')::int AS spalte_voll,
           COUNT(*) FILTER (WHERE onboarding_stufe = 'wartet_auf_onboarding')::int AS spalte_wartet,
           COUNT(*) FILTER (WHERE onboarding_stufe IS NULL)::int AS spalte_leer,
           -- Die WAHRHEIT: gibt es ein erledigtes Startgespräch?
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status = 'erledigt'))::int AS gespraech_erledigt
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
  `) as any[];
  zahl("Bezahlte Paket-Bestellungen", s.bezahlt);
  zahl("… Spalte sagt „voll_aktiv“", s.spalte_voll);
  zahl("… Spalte sagt „wartet_auf_onboarding“", s.spalte_wartet);
  zahl("… Spalte ist leer", s.spalte_leer, "Altbestand vor der Migration");
  zahl("… Startgespräch WIRKLICH erledigt", s.gespraech_erledigt, "das ist die Wahrheit");

  // ── DIE ABWEICHUNG ─────────────────────────────────────────────────────
  // Das ist der Screenshot-Fehler in einer Zahl: „Status: Aktiv ·
  // Freigeschaltet" bei einem Kunden ohne erledigtes Gespräch.
  const [ab] = (await sqlPool`
    SELECT COUNT(*)::int AS falsch_voll,
           COUNT(*) FILTER (WHERE onboarding_pflicht)::int AS mit_pflicht
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND COALESCE(a.onboarding_stufe, 'voll_aktiv') = 'voll_aktiv'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
  `) as any[];
  log("");
  zahl("ZEIGEN „VOLL AKTIV“ OHNE ERLEDIGTES GESPRÄCH", ab.falsch_voll,
    "genau der Fehler aus dem Screenshot");
  zahl("… davon mit gesetzter Onboarding-Pflicht", ab.mit_pflicht);

  // Wie viele davon haben wenigstens einen GEBUCHTEN Termin?
  const [g] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status = 'gebucht' AND t.beginn > NOW()))::int AS gebucht,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status = 'verpasst'))::int AS verpasst,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'))::int AS nie
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
  `) as any[];
  log("\n  DIE BETROFFENEN, GENAUER:");
  zahl("… Termin gebucht, steht noch aus", g.gebucht);
  zahl("… Termin verpasst", g.verpasst);
  zahl("… NIE einen Termin gehabt", g.nie, "die brauchen die Einladung");
  befund.stufen = { ...s, ...ab, ...g };

  log(`\n  CSV: ${csv("mess-ablauf-bestand.csv", (await sqlPool`
    SELECT a.ref, a.payment_reference, a.onboarding_stufe, a.onboarding_pflicht,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.email) AS kunde,
           a.email, a.pack_name, a.completed_at::date AS bezahlt_am,
           (SELECT COUNT(*)::int FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call') AS termine,
           (SELECT STRING_AGG(DISTINCT t.status, '/') FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call') AS termin_stand
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND COALESCE(a.onboarding_stufe, 'voll_aktiv') = 'voll_aktiv'
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt')
    ORDER BY a.completed_at DESC NULLS LAST
  `) as any[])}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. SCHUFA-NUR-BESTELLUNGEN — 74 € ohne Paket");
  // ═════════════════════════════════════════════════════════════════════════
  // Diese Menschen haben eine Bonitätsauskunft gekauft, aber kein Paket. Sie
  // dürfen kein Abo bekommen und kein Gate sehen — sie haben nichts, wofür ein
  // Startgespräch nötig wäre.
  const [sn] = (await sqlPool`
    WITH schufa AS (
      SELECT DISTINCT a.person_id, a.email
      FROM fiaon_applications a
      WHERE (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
        AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
    )
    SELECT COUNT(*)::int AS mit_auskunft,
           COUNT(*) FILTER (WHERE NOT EXISTS (
             SELECT 1 FROM fiaon_applications p
             WHERE p.merged_into IS NULL AND p.gdpr_deleted_at IS NULL
               AND p.type IS DISTINCT FROM 'schufa' AND p.ref NOT LIKE 'FIAON-SCHUFA-%'
               AND (p.person_id = schufa.person_id
                 OR LOWER(TRIM(COALESCE(p.email, ''))) = LOWER(TRIM(COALESCE(schufa.email, ''))))
           ))::int AS ohne_paket
    FROM schufa
  `) as any[];
  zahl("Menschen mit Auskunft-Bestellung", sn.mit_auskunft);
  zahl("… davon OHNE jede Paket-Bestellung", sn.ohne_paket,
    "SCHUFA-nur: kein Abo, kein Gate");

  const [sz] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
           COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')::int AS gemeldet,
           COUNT(*) FILTER (WHERE payment_status NOT IN ('paid', 'claimed_paid'))::int AS offen
    FROM fiaon_applications
    WHERE (type = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%')
      AND merged_into IS NULL AND gdpr_deleted_at IS NULL
  `) as any[];
  log("");
  zahl("Auskunft-Bestellungen insgesamt", sz.gesamt);
  zahl("… bezahlt", sz.bezahlt);
  zahl("… als bezahlt gemeldet", sz.gemeldet);
  zahl("… offen", sz.offen);

  // Erzeugen SCHUFA-Bestellungen versehentlich ein Abo?
  const [abo] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
  `.catch(() => [{ n: 0 }] as any[])) as any[];
  zahl("Abo-Raten an Auskunft-Bestellungen", abo.n,
    Number(abo.n) === 0 ? "richtig — eine Auskunft ist kein Abo" : "FEHLER: Auskunft hat ein Abo erzeugt");
  befund.schufaNur = { ...sn, ...sz, aboRaten: Number(abo.n) };

  log(`\n  CSV: ${csv("mess-ablauf-schufa-nur.csv", (await sqlPool`
    SELECT a.ref, a.payment_reference, a.payment_status,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.email) AS kunde,
           a.email, a.created_at::date AS bestellt_am
    FROM fiaon_applications a
    WHERE (a.type = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
      AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications p
        WHERE p.merged_into IS NULL AND p.type IS DISTINCT FROM 'schufa'
          AND p.ref NOT LIKE 'FIAON-SCHUFA-%'
          AND (p.person_id = a.person_id
            OR LOWER(TRIM(COALESCE(p.email, ''))) = LOWER(TRIM(COALESCE(a.email, '')))))
    ORDER BY a.created_at DESC
  `) as any[])}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DER ABLAUF IN ZAHLEN — wo stehen die Menschen?");
  // ═════════════════════════════════════════════════════════════════════════
  const stationen: [string, string][] = [
    ["Antrag begonnen, nicht abgeschickt",
      "status IN ('started','personal_data','employment','documents') AND payment_status <> 'paid'"],
    ["Antrag da, Zahlung offen",
      "status = 'completed' AND payment_status IN ('pending_payment','pending')"],
    ["„Ich habe überwiesen“ gemeldet", "payment_status = 'claimed_paid'"],
    ["Zahlung gebucht", "payment_status = 'paid'"],
    ["Zahlung abgelaufen", "payment_status = 'expired'"],
  ];
  for (const [name, bedingung] of stationen) {
    const [r] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
        AND type IS DISTINCT FROM 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
        AND ${bedingung}
    `)) as any[];
    zahl(name, r.n);
  }

  const [ab2] = (await sqlPool`
    SELECT COUNT(*)::int AS ketten,
           COUNT(*) FILTER (WHERE status = 'offen')::int AS offen,
           COUNT(*) FILTER (WHERE status = 'bezahlt')::int AS bezahlt,
           COUNT(*) FILTER (WHERE status = 'offen' AND faellig_am < CURRENT_DATE)::int AS ueberfaellig
    FROM fiaon_abo_raten
  `.catch(() => [{ ketten: 0, offen: 0, bezahlt: 0, ueberfaellig: 0 }] as any[])) as any[];
  log("");
  zahl("Abo-Raten insgesamt", ab2.ketten);
  zahl("… offen", ab2.offen);
  zahl("… bezahlt", ab2.bezahlt);
  zahl("… ÜBERFÄLLIG (T+1 und später)", ab2.ueberfaellig, "gehören ins Forderungsmanagement");
  befund.ablauf = { ...ab2 };

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. DIE AKTE — zwei Fassungen oder eine?");
  // ═════════════════════════════════════════════════════════════════════════
  const { readFileSync } = await import("node:fs");
  const lies = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
  const akte = lies("client/src/pages/admin-kunde.tsx");
  const schublade = lies("client/src/pages/agent/vertrieb.tsx");
  zahl("Zeilen in der Verwaltungs-Akte", akte.split("\n").length);
  zahl("Zeilen im Vertriebs-Cockpit", schublade.split("\n").length);
  log("\n  Beide zeichnen denselben Kunden — mit eigenem Quelltext. Eine Änderung");
  log("  an einer Stelle erreicht die andere nicht. Das ist der Grund für Teil 2.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-ablauf.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-ablauf.json\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
