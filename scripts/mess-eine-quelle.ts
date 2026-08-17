// ═══════════════════════════════════════════════════════════════════════════
// INVENTUR: DAS DOPPEL-DATENMODELL IN ZAHLEN
//
// ── DER AUFTRAG ────────────────────────────────────────────────────────────
// „Das Doppel-Datenmodell muss STERBEN. Nie wieder ‚E-Mail am Antrag, aber
// nicht an der Person'."
//
// Stufe 1 ist die INVENTUR: Welche Kontakt-Spalten gibt es, wie weit
// auseinander stehen sie, und wie viele Code-Stellen lesen oder schreiben sie?
//
// Diese Zahlen entscheiden, ob eine Amputation ein Handgriff oder ein
// Großeingriff ist. Sie zu kennen, BEVOR man schneidet, ist der ganze Punkt.
//
// NUR LESEN. Dieses Skript schreibt nichts.
//
//   npx tsx scripts/mess-eine-quelle.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { execFileSync } from "node:child_process";
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

/** Zählt Treffer im Serverquelltext — ohne Kommentarzeilen. */
function grepZaehlen(muster: string): { treffer: number; dateien: number } {
  try {
    const raus = execFileSync("grep", ["-rn", "-E", muster, "server/", "--include=*.ts"],
      { encoding: "utf8", maxBuffer: 40e6 });
    const zeilen = raus.split("\n").filter((z) => {
      if (!z.trim()) return false;
      const inhalt = z.slice(z.indexOf(":", z.indexOf(":") + 1) + 1);
      // Kommentare zählen nicht: Sie greifen nicht zu.
      return !/^\s*(\/\/|\*|\/\*|--)/.test(inhalt);
    });
    return {
      treffer: zeilen.length,
      dateien: new Set(zeilen.map((z) => z.split(":")[0])).size,
    };
  } catch {
    return { treffer: 0, dateien: 0 };
  }
}

async function main(): Promise<void> {
  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DIE SPALTEN — wo liegen Kontaktdaten doppelt?");
  // ═════════════════════════════════════════════════════════════════════════
  const spalten = (await sqlPool`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_name IN ('fiaon_applications', 'fiaon_leads', 'fiaon_persons')
      AND (column_name ~ 'email|phone|telefon'
        OR column_name IN ('first_name', 'last_name', 'contact_name', 'company_name',
                           'vorname', 'nachname', 'street', 'zip', 'city'))
      -- Zeitstempel sind keine Kontaktdaten, sie merken nur, wann gesendet wurde.
      AND column_name NOT LIKE '%_sent_at'
    ORDER BY table_name, column_name
  `) as any[];
  for (const t of ["fiaon_persons", "fiaon_applications", "fiaon_leads"]) {
    const s = spalten.filter((x) => x.table_name === t).map((x) => x.column_name);
    log(`  ${t.padEnd(20)} ${s.join(", ")}`);
  }
  log("\n  fiaon_persons ist die WAHRHEIT. Die anderen beiden halten Kopien.");

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE ABWEICHUNG — wie weit stehen die Kopien auseinander?");
  // ═════════════════════════════════════════════════════════════════════════
  const [a] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person,
           -- Der Fall aus dem Auftrag: Wert am Antrag, aber nicht an der Person.
           COUNT(*) FILTER (WHERE person_id IS NOT NULL
             AND NULLIF(TRIM(COALESCE(a.email, '')), '') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM fiaon_persons p
               WHERE p.id = a.person_id
                 AND LOWER(TRIM(COALESCE(p.primary_email, ''))) = LOWER(TRIM(a.email))))::int AS mail_fehlt_person,
           COUNT(*) FILTER (WHERE person_id IS NOT NULL
             AND NULLIF(TRIM(COALESCE(a.phone, '')), '') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM fiaon_persons p
               WHERE p.id = a.person_id
                 AND REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '[^0-9]', '', 'g')
                   = REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g')))::int AS nummer_fehlt_person
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
  `) as any[];
  zahl("Lebende Bestellungen", a.gesamt);
  zahl("… ohne Person", a.ohne_person, "Formularentwürfe, sie haben keinen Menschen");
  zahl("… E-Mail am Antrag, NICHT an der Person", a.mail_fehlt_person,
    "genau der Fall aus dem Auftrag");
  zahl("… Nummer am Antrag, NICHT an der Person", a.nummer_fehlt_person);

  const [l] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person,
           COUNT(*) FILTER (WHERE person_id IS NOT NULL
             AND NULLIF(TRIM(COALESCE(le.email, '')), '') IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM fiaon_persons p
               WHERE p.id = le.person_id
                 AND LOWER(TRIM(COALESCE(p.primary_email, ''))) = LOWER(TRIM(le.email))))::int AS mail_fehlt_person
    FROM fiaon_leads le WHERE le.status <> 'tot'
  `) as any[];
  log("");
  zahl("Leads", l.gesamt);
  zahl("… ohne Person", l.ohne_person, "ein Lead ohne Person ist ein Zettel");
  zahl("… E-Mail am Lead, NICHT an der Person", l.mail_fehlt_person);
  befund.abweichung = { ...a, leads: l };

  log(`\n  CSV: ${csv("mess-quelle-abweichung.csv", (await sqlPool`
    SELECT a.ref, a.person_id, a.email AS mail_zeile,
           (SELECT p.primary_email FROM fiaon_persons p WHERE p.id = a.person_id) AS mail_person,
           a.phone AS nummer_zeile,
           (SELECT p.primary_phone FROM fiaon_persons p WHERE p.id = a.person_id) AS nummer_person,
           a.payment_status
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
      AND ((NULLIF(TRIM(COALESCE(a.email, '')), '') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
              AND LOWER(TRIM(COALESCE(p.primary_email, ''))) = LOWER(TRIM(a.email))))
        OR (NULLIF(TRIM(COALESCE(a.phone, '')), '') IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
              AND REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '[^0-9]', '', 'g')
                = REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g'))))
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC
  `) as any[])}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE CODE-STELLEN — was kostet die Amputation?");
  //
  // Das ist die Zahl, die entscheidet, ob geschnitten werden darf. Eine
  // Amputation VOR dem Code-Umzug bedeutet: Der Server startet nicht mehr.
  // ═════════════════════════════════════════════════════════════════════════
  const muster: [string, string][] = [
    ["a.email (SQL-Zugriff)", "a\\.email"],
    ["email in SELECT/INSERT/UPDATE", "(SELECT|INSERT|UPDATE|VALUES)[^;]*\\bemail\\b"],
    ["contact_email", "contact_email"],
    ["billing_email", "billing_email"],
    ["a.phone / phone_country_code", "(a\\.phone|phone_country_code)"],
    ["contact_phone", "contact_phone"],
    ["le.email / l.email (Leads)", "l[e]?\\.email"],
    ["l.telefon (Leads)", "l[e]?\\.telefon"],
    ["first_name / last_name", "(first_name|last_name)"],
    ["contact_name / company_name", "(contact_name|company_name)"],
  ];
  const tabelle: Record<string, unknown>[] = [];
  let summe = 0;
  for (const [name, m] of muster) {
    const { treffer, dateien } = grepZaehlen(m);
    summe += treffer;
    tabelle.push({ spalte: name, treffer, dateien });
    log(`  ${String(treffer).padStart(5)} Treffer in ${String(dateien).padStart(3)} Dateien  ${name}`);
  }
  log("");
  zahl("SUMME der Zugriffe (ohne Kommentare)", summe);
  befund.codeStellen = { summe, tabelle };
  log(`  CSV: ${csv("mess-quelle-codestellen.csv", tabelle)}`);

  // Wie viele Dateien insgesamt sind betroffen?
  const alle = grepZaehlen("(a\\.email|contact_email|billing_email|a\\.phone|contact_phone|l[e]?\\.email|l[e]?\\.telefon)");
  log("");
  zahl("Betroffene Serverdateien", alle.dateien);

  // ── DIE KRITISCHEN WEGE ────────────────────────────────────────────────
  // Nicht jede Stelle ist gleich gefährlich. Diese hier sperren Kunden aus
  // oder halten Geld an, wenn sie brechen.
  log("\n  DIE KRITISCHEN WEGE (brechen = Kunde ausgesperrt oder Geld hängt):");
  const kritisch: [string, string][] = [
    ["Kunden-Login", "server/fiaon-login-logic.ts"],
    ["Antrag + Zahlung", "server/routes/fiaon-antrag.ts"],
    ["Rechnungen", "server/fiaon-invoice.ts"],
    ["Mail-Versand", "server/lib/fiaon-mail-senden.ts"],
    ["Make-Payloads", "server/make-webhook.ts"],
    ["Empfänger-Auflösung", "server/lib/fiaon-empfaenger.ts"],
  ];
  for (const [name, datei] of kritisch) {
    try {
      const raus = execFileSync("grep", ["-c", "-E",
        "(a\\.email|\\bemail\\b|contact_email|billing_email|phone)", datei],
        { encoding: "utf8" });
      log(`  ${String(raus.trim()).padStart(5)} Treffer  ${name.padEnd(24)} ${datei}`);
    } catch {
      log(`      0 Treffer  ${name.padEnd(24)} ${datei}`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("4. GIBT ES SCHON EINE AUFLÖSUNGSFUNKTION?");
  // ═════════════════════════════════════════════════════════════════════════
  // Wenn ja, ist der Code-Umzug ein Umleiten statt eines Neubaus.
  for (const [name, datei, suche] of [
    ["Empfänger-Auflösung", "server/lib/fiaon-empfaenger.ts", "export async function"],
    ["Personen-Durchschreiben", "server/routes/fiaon-agent.ts", "personDurchschreiben"],
    ["Alias-Verwaltung", "server/lib/fiaon-person-alias.ts", "export"],
  ] as [string, string, string][]) {
    try {
      const raus = execFileSync("grep", ["-c", suche, datei], { encoding: "utf8" });
      log(`  ✔ ${name}: ${raus.trim()} Stellen in ${datei}`);
    } catch {
      log(`  ✘ ${name}: ${datei} nicht gefunden oder ohne Treffer`);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("5. DIE GEMELDETEN FÄLLE");
  // ═════════════════════════════════════════════════════════════════════════
  const namen = ["Bianco", "Rechtsteiner", "Matzke", "Schlabs", "Toth", "Brannix",
                 "Bauer", "Kovic", "Imzerovic", "Felkovic", "Gammow", "Stefanescu"];
  const gefunden: Record<string, unknown>[] = [];
  for (const n of namen) {
    const treffer = (await sqlPool`
      SELECT 'antrag' AS art, a.ref AS kennung, a.person_id,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.company_name) AS name,
             a.email, a.phone, a.payment_status, a.pack_name
      FROM fiaon_applications a
      WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND (a.last_name ILIKE ${`%${n}%`} OR a.company_name ILIKE ${`%${n}%`}
          OR a.contact_name ILIKE ${`%${n}%`})
      UNION ALL
      SELECT 'lead', le.id::text, le.person_id,
             CONCAT_WS(' ', le.vorname, le.nachname), le.email, le.telefon,
             le.status, NULL
      FROM fiaon_leads le
      WHERE le.nachname ILIKE ${`%${n}%`}
    `) as any[];
    log(`\n  ── ${n} ──`);
    if (treffer.length === 0) { log("     nicht gefunden"); continue; }
    for (const t of treffer) {
      log(`     ${String(t.art).padEnd(7)} ${String(t.kennung).padEnd(24)} `
        + `Person ${String(t.person_id ?? "—").padEnd(6)} ${String(t.name ?? "").padEnd(26)} `
        + `${String(t.email ?? "keine Mail").padEnd(32)} ${t.phone ?? "keine Nummer"}`);
      gefunden.push({ suche: n, ...t });
    }
  }
  log(`\n  CSV: ${csv("mess-quelle-faelle.csv", gefunden)}`);
  befund.faelle = gefunden.length;

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/mess-eine-quelle.json", `${JSON.stringify(befund, null, 2)}\n`, "utf8");
  log("\n  reports/mess-eine-quelle.json\n");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
