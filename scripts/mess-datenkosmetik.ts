// ═══════════════════════════════════════════════════════════════════════════
// MESSUNG VOR DEN FIXES — Paketnamen, Personennamen, Portal-Zugang
//
// NUR LESEN. Dieses Skript schreibt nichts.
//
//   npx tsx scripts/mess-datenkosmetik.ts
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
  const s = v == null ? "" : String(v).replace(/[\r\n]+/g, "⏎");
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
  titel("1. DIE PAKETNAMEN — wo steckt der Zeilenumbruch?");
  // ═════════════════════════════════════════════════════════════════════════
  const spalten = (await sqlPool`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'fiaon_applications'
      AND (column_name LIKE '%pack%' OR column_name LIKE '%paket%' OR column_name LIKE '%label%')
  `) as any[];
  log(`  Spalten mit Paket-Bezug: ${spalten.map((s) => s.column_name).join(", ")}`);
  log("  (Der Auftrag nennt „package_label\u201c — die Spalte heißt hier pack_name.)");

  const [p] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE pack_name ~ E'[\\n\\r]')::int AS umbruch,
           COUNT(*) FILTER (WHERE pack_name <> TRIM(pack_name))::int AS rand,
           COUNT(*) FILTER (WHERE pack_name ~ '  ')::int AS doppelt,
           COUNT(*) FILTER (WHERE NULLIF(TRIM(COALESCE(pack_name, '')), '') IS NULL)::int AS leer
    FROM fiaon_applications WHERE merged_into IS NULL
  `) as any[];
  zahl("Bestellungen insgesamt", p.gesamt);
  zahl("… mit ZEILENUMBRUCH im Paketnamen", p.umbruch,
    "im Portal steht dann nur der Teil nach dem Umbruch");
  zahl("… mit Leerzeichen am Rand", p.rand);
  zahl("… mit doppeltem Leerzeichen", p.doppelt);
  zahl("… ohne Paketnamen", p.leer, "Zusatzprodukte und Entwürfe");

  const formen = (await sqlPool`
    SELECT pack_name, COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND pack_name IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 14
  `) as any[];
  log("\n  DIE VORKOMMENDEN FORMEN (⏎ = Zeilenumbruch):");
  for (const f of formen) {
    log(`    ${String(f.n).padStart(5)} ×  ${JSON.stringify(f.pack_name).replace(/\\n/g, "⏎")}`);
  }

  // Wie sähe die einzeilige Form aus? Das ist die Vorschau des Laufs.
  const vorschau = (await sqlPool`
    SELECT pack_name AS alt,
           REGEXP_REPLACE(BTRIM(REGEXP_REPLACE(pack_name, E'[\\n\\r\\t]+', ' ', 'g')), ' {2,}', ' ', 'g') AS neu,
           COUNT(*)::int AS n
    FROM fiaon_applications
    WHERE merged_into IS NULL AND pack_name IS NOT NULL
      AND pack_name <> REGEXP_REPLACE(BTRIM(REGEXP_REPLACE(pack_name, E'[\\n\\r\\t]+', ' ', 'g')), ' {2,}', ' ', 'g')
    GROUP BY 1, 2 ORDER BY 3 DESC
  `) as any[];
  log("\n  SO WÜRDE DER LAUF ÄNDERN:");
  for (const v of vorschau) {
    log(`    ${String(v.n).padStart(5)} ×  ${JSON.stringify(v.alt).replace(/\\n/g, "⏎")}`);
    log(`             →  ${JSON.stringify(v.neu)}`);
  }
  const summe = vorschau.reduce((s, v) => s + Number(v.n), 0);
  log("");
  zahl("Zeilen, die der Lauf anfasst", summe);
  zahl("Verschiedene Formen", vorschau.length,
    "so wenige, weil der Umbruch aus der Paketdefinition kommt — nicht aus Tippfehlern");
  log(`\n  CSV: ${csv("mess-paketnamen.csv", vorschau.map((v) => ({
    anzahl: v.n, alt: v.alt, neu: v.neu,
  })))}`);
  befund.paketnamen = { ...p, betroffen: summe, formen: vorschau.length };

  // ── UND DIE QUELLE? ────────────────────────────────────────────────────
  // Ein Bestandslauf ohne Quellfix repariert einmal und dann nie wieder.
  const [neuste] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
    WHERE merged_into IS NULL AND pack_name ~ E'[\\n\\r]'
      AND created_at > NOW() - INTERVAL '7 days'
  `) as any[];
  zahl("Davon aus den letzten 7 TAGEN", neuste.n,
    Number(neuste.n) > 0 ? "die Quelle liefert es weiter — ein Bestandslauf allein genügt nicht" : "");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE PERSONENNAMEN — Leerraum am Rand");
  // ═════════════════════════════════════════════════════════════════════════
  const [n] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE first_name <> BTRIM(first_name))::int AS vor_rand,
           COUNT(*) FILTER (WHERE last_name <> BTRIM(last_name))::int AS nach_rand,
           COUNT(*) FILTER (WHERE first_name ~ '  ' OR last_name ~ '  ')::int AS innen_doppelt,
           COUNT(*) FILTER (WHERE first_name ~ E'[\\n\\r\\t]' OR last_name ~ E'[\\n\\r\\t]')::int AS umbruch
    FROM fiaon_applications WHERE merged_into IS NULL
  `) as any[];
  zahl("Bestellungen", n.gesamt);
  zahl("… Vorname mit Leerraum am Rand", n.vor_rand, "daraus wird „Guten Abend, Justin .“");
  zahl("… Nachname mit Leerraum am Rand", n.nach_rand);
  zahl("… doppeltes Leerzeichen INNEN", n.innen_doppelt);
  zahl("… Umbruch/Tabulator im Namen", n.umbruch);

  const [np] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE first_name <> BTRIM(first_name)
             OR last_name <> BTRIM(last_name)
             OR contact_name <> BTRIM(contact_name)
             OR company_name <> BTRIM(company_name))::int AS rand
    FROM fiaon_persons WHERE merged_into_person_id IS NULL
  `) as any[];
  log("");
  zahl("Personen", np.gesamt);
  zahl("… mit Leerraum am Rand (irgendein Namensfeld)", np.rand);

  const beispiele = (await sqlPool`
    SELECT ref, first_name, last_name FROM fiaon_applications
    WHERE merged_into IS NULL
      AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
        OR first_name ~ '  ' OR last_name ~ '  ')
    ORDER BY created_at DESC LIMIT 8
  `) as any[];
  log("\n  BEISPIELE (in Anführungszeichen, damit der Leerraum sichtbar ist):");
  for (const b of beispiele) {
    log(`    ${JSON.stringify(b.first_name)} · ${JSON.stringify(b.last_name)}`);
  }
  log(`\n  CSV: ${csv("mess-namen.csv", (await sqlPool`
    SELECT ref, first_name, last_name,
           BTRIM(REGEXP_REPLACE(COALESCE(first_name, ''), ' {2,}', ' ', 'g')) AS vorname_neu,
           BTRIM(REGEXP_REPLACE(COALESCE(last_name, ''), ' {2,}', ' ', 'g')) AS nachname_neu
    FROM fiaon_applications
    WHERE merged_into IS NULL
      AND (first_name <> BTRIM(first_name) OR last_name <> BTRIM(last_name)
        OR first_name ~ '  ' OR last_name ~ '  ')
    ORDER BY created_at DESC
  `) as any[])}`);
  befund.namen = { ...n, personen: Number(np.rand) };

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DER PORTAL-ZUGANG — wer sieht sein Konto, ohne bezahlt zu haben?");
  //
  // NUR MESSEN. Die Geschäftsregel lautet: Zugang nach Zahlung. Ob sie
  // rückwirkend hart gezogen wird, entscheidet der Betreiber — 349 Menschen
  // an einem Morgen auszusperren ist eine Entscheidung, kein Wartungsschritt.
  // ═════════════════════════════════════════════════════════════════════════
  // Der Login lässt herein, wenn der Status in LOGIN_ACCESS_STATUSES steht
  // ODER bezahlt ist (siehe server/fiaon-login-logic.ts). Die interessante
  // Menge ist also: Status reicht, Zahlung fehlt.
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt,
           COUNT(*) FILTER (WHERE payment_status <> 'paid'
             AND status IN ('completed', 'documents_submitted', 'payment_completed'))::int AS zugang_ohne_zahlung,
           COUNT(*) FILTER (WHERE payment_status = 'claimed_paid'
             AND status IN ('completed', 'documents_submitted', 'payment_completed'))::int AS gemeldet,
           COUNT(*) FILTER (WHERE account_status = 'suspended')::int AS gesperrt
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
  `) as any[];
  zahl("Konten MIT Passwort (also anmeldbar)", z.gesamt);
  zahl("… bezahlt", z.bezahlt, "regelkonform");
  zahl("… ZUGANG OHNE ZAHLUNG", z.zugang_ohne_zahlung, "das ist die Frage des Betreibers");
  zahl("… davon „habe überwiesen“ gemeldet", z.gemeldet, "wartet auf den Kontoabgleich");
  zahl("… ausdrücklich gesperrt", z.gesperrt);

  // ── DIE HERKUNFT: welcher Status öffnet die Tür? ───────────────────────
  const wege = (await sqlPool`
    SELECT status, payment_status, COUNT(*)::int AS n,
           TO_CHAR(MIN(created_at), 'DD.MM.YY') AS aeltest,
           TO_CHAR(MAX(created_at), 'DD.MM.YY') AS neuest
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
      AND payment_status <> 'paid'
      AND status IN ('completed', 'documents_submitted', 'payment_completed')
    GROUP BY 1, 2 ORDER BY 3 DESC
  `) as any[];
  log("\n  WELCHER WEG VERGIBT ZUGANG VOR DER ZAHLUNG:");
  for (const w of wege) {
    log(`    ${String(w.n).padStart(5)} ×  status=${String(w.status).padEnd(20)} `
      + `zahlung=${String(w.payment_status).padEnd(16)} ${w.aeltest} … ${w.neuest}`);
  }

  // Altbestand oder frisch? Das entscheidet, ob eine Regel reicht oder ein Lauf.
  const [alt] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days')::int AS aelter_90,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS juenger_30,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS juenger_7,
           COUNT(*) FILTER (WHERE COALESCE(alt_bestand, FALSE))::int AS markiert_alt
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
      AND payment_status <> 'paid'
      AND status IN ('completed', 'documents_submitted', 'payment_completed')
  `) as any[];
  log("");
  zahl("… älter als 90 Tage", alt.aelter_90, "Altbestand");
  zahl("… jünger als 30 Tage", alt.juenger_30);
  zahl("… jünger als 7 Tage", alt.juenger_7,
    Number(alt.juenger_7) > 0 ? "es entsteht WEITER — nicht nur Altlast" : "es entsteht nichts Neues mehr");
  zahl("… als Altbestand markiert", alt.markiert_alt);

  // Was sehen diese Menschen? Vollen Zugang oder eine Sperrkarte?
  const [stufe] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE onboarding_stufe = 'voll_aktiv')::int AS voll,
           COUNT(*) FILTER (WHERE onboarding_stufe = 'wartet_auf_onboarding')::int AS wartet,
           COUNT(*) FILTER (WHERE onboarding_stufe IS NULL)::int AS ohne
    FROM fiaon_applications
    WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(password, '')), '') IS NOT NULL
      AND payment_status <> 'paid'
      AND status IN ('completed', 'documents_submitted', 'payment_completed')
  `) as any[];
  log("\n  UND WAS SEHEN SIE?");
  zahl("voll aktiv", stufe.voll, "volles Dashboard, wie im Screenshot des Betreibers");
  zahl("wartet auf Onboarding", stufe.wartet, "eingeschränkt");
  zahl("ohne Stufe", stufe.ohne, "der Altbestand kennt die Stufen nicht");

  log(`\n  CSV: ${csv("mess-zugang-ohne-zahlung.csv", (await sqlPool`
    SELECT a.ref, a.payment_reference, a.status, a.payment_status,
           a.onboarding_stufe, a.pack_name, a.amount_due,
           a.created_at::date AS angelegt,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, a.email) AS kunde,
           a.email
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND NULLIF(TRIM(COALESCE(a.password, '')), '') IS NOT NULL
      AND a.payment_status <> 'paid'
      AND a.status IN ('completed', 'documents_submitted', 'payment_completed')
    ORDER BY a.created_at DESC
  `) as any[])}`);
  befund.zugang = { ...z, ...alt, ...stufe };

  log("\n  KEINE ÄNDERUNG. Diese Zahlen sind zur ENTSCHEIDUNG des Betreibers da.");

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-datenkosmetik.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-datenkosmetik.json\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
