// ═══════════════════════════════════════════════════════════════════════════
// DOPPELGÄNGER FINDEN — DAS MUSTER „ANTRAG HAT NUMMER, LEAD HAT MAIL"
//
//   npx tsx scripts/doppelgaenger-lauf.ts                 nur suchen + CSV
//   npx tsx scripts/doppelgaenger-lauf.ts --schreiben     Kandidaten eintragen
//
// ── DIE GEMELDETEN FÄLLE ───────────────────────────────────────────────────
// Bianco:  Antrag (Person 3598, nur Nummer) + Lead (Person 5564, nur Mail)
// Matzke:  Antrag (Person 3815, nur Nummer) + Lead (Person 5738, nur Mail)
// Schlabs: Antrag (Person 4782, nur Nummer) + Lead (Person 6474, nur Mail)
//
// Der Antrag bringt die Telefonnummer, der Lead die E-Mail. Sie haben KEIN
// gemeinsames Merkmal — deshalb verbindet das Eingangs-Dedupe sie nicht, und es
// entstehen zwei Personen für einen Menschen.
//
// ── WIE MAN SIE TROTZDEM FINDET ────────────────────────────────────────────
// Über den NAMEN, aber nur mit zwei Sicherungen:
//   1. Vor- UND Nachname müssen übereinstimmen (nach Kleinschreibung und
//      Leerraum-Reinigung). „Bauer" allein genügt nicht — den Namen gibt es
//      im Bestand 22-mal.
//   2. Der eine Datensatz muss die Nummer haben, der andere die Mail. Zwei
//      Menschen mit gleichem Namen, die BEIDE eine Mail haben, sind zwei
//      Menschen — sonst hätte das Dedupe sie längst verbunden.
//
// ── UND KEIN AUTOMATIK-MERGE ───────────────────────────────────────────────
// Der Lauf schreibt KANDIDATEN, keine Zusammenführungen. Ein Merge ist
// unumkehrbar (er zieht Bestellungen, Termine, Provisionen mit), und
// Namensgleichheit ist kein Beweis: Vater und Sohn heißen gleich. Die
// Entscheidung braucht Augen — das System liefert den Hinweis und die
// Begründung.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(8)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}

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
  log(SCHREIBEN
    ? "\n  ⚠  SCHREIBMODUS — Kandidaten werden eingetragen (KEINE Zusammenführung)."
    : "\n  SUCHE. Nichts wird geändert. Zum Eintragen: --schreiben");

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DAS MUSTER: gleicher Name, einer hat die Nummer, einer die Mail");
  // ═════════════════════════════════════════════════════════════════════════
  const paare = (await sqlPool`
    WITH menschen AS (
      SELECT p.id,
             LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p.first_name, ''), ' {2,}', ' ', 'g'))) AS vor,
             LOWER(BTRIM(REGEXP_REPLACE(COALESCE(p.last_name, ''), ' {2,}', ' ', 'g'))) AS nach,
             fiaon_mail_norm(p.primary_email) AS mail,
             fiaon_nummer_norm(p.primary_phone) AS nummer,
             p.first_name, p.last_name, p.primary_email, p.primary_phone,
             p.assigned_agent_id,
             (SELECT COUNT(*)::int FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL) AS bestellungen,
             (SELECT COUNT(*)::int FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.payment_status = 'paid') AS bezahlt,
             (SELECT COUNT(*)::int FROM fiaon_leads le WHERE le.person_id = p.id) AS leads
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NULLIF(BTRIM(COALESCE(p.first_name, '')), '') IS NOT NULL
        AND NULLIF(BTRIM(COALESCE(p.last_name, '')), '') IS NOT NULL
    )
    SELECT a.id AS person_a, b.id AS person_b,
           a.first_name AS vorname, a.last_name AS nachname,
           a.primary_email AS mail_a, a.primary_phone AS nummer_a,
           b.primary_email AS mail_b, b.primary_phone AS nummer_b,
           a.bestellungen AS best_a, a.bezahlt AS bez_a, a.leads AS leads_a,
           b.bestellungen AS best_b, b.bezahlt AS bez_b, b.leads AS leads_b,
           a.assigned_agent_id AS agent_a, b.assigned_agent_id AS agent_b
    FROM menschen a
    JOIN menschen b ON b.vor = a.vor AND b.nach = a.nach AND b.id > a.id
    -- ── DIE ZWEITE SICHERUNG ────────────────────────────────────────────
    -- Einer hat die Nummer, der andere die Mail — sonst wären es zwei Menschen,
    -- die das Dedupe längst verbunden hätte.
    WHERE ((a.mail IS NULL AND a.nummer IS NOT NULL AND b.mail IS NOT NULL)
        OR (b.mail IS NULL AND b.nummer IS NOT NULL AND a.mail IS NOT NULL))
      -- Und sie dürfen sich nicht widersprechen: Zwei verschiedene Nummern
      -- bei gleichem Namen können Vater und Sohn sein.
      AND (a.nummer IS NULL OR b.nummer IS NULL
        OR RIGHT(a.nummer, 9) = RIGHT(b.nummer, 9))
    ORDER BY (a.bezahlt + b.bezahlt) DESC, a.last_name
  `) as any[];

  zahl("Kandidaten-Paare über den Namen", paare.length);

  // ═════════════════════════════════════════════════════════════════════════
  // DAS EINDEUTIGE MUSTER: DIESELBE E-MAIL BEI ZWEI LEBENDEN PERSONEN
  //
  // ── WARUM ES ERST JETZT AUFTAUCHT (20.08.2026) ──────────────────────────
  // Vorher hatte Person 3598 (Bianco, aus dem Antrag) KEINE E-Mail — sie stand
  // nur an der Bestellzeile. Der Umzugslauf hat sie an die Person gebracht, und
  // damit ist sichtbar geworden, was vorher verborgen war: Zwei Personen tragen
  // dieselbe Adresse.
  //
  // Das ist das STÄRKSTE Signal für einen Doppelgänger — stärker als der Name.
  // Eine E-Mail-Adresse gehört einem Postfach, und ein Postfach gehört einem
  // Menschen. (Ausnahmen gibt es: info@firma.de bei Eheleuten. Deshalb bleibt
  // es ein Kandidat, keine Zusammenführung.)
  // ═════════════════════════════════════════════════════════════════════════
  const gleicheMail = (await sqlPool`
    SELECT a.id AS person_a, b.id AS person_b,
           a.first_name AS vorname, a.last_name AS nachname,
           a.primary_email AS mail_a, a.primary_phone AS nummer_a,
           b.primary_email AS mail_b, b.primary_phone AS nummer_b,
           (SELECT COUNT(*)::int FROM fiaon_applications x WHERE x.person_id = a.id AND x.merged_into IS NULL) AS best_a,
           (SELECT COUNT(*)::int FROM fiaon_applications x WHERE x.person_id = a.id AND x.merged_into IS NULL AND x.payment_status = 'paid') AS bez_a,
           (SELECT COUNT(*)::int FROM fiaon_leads le WHERE le.person_id = a.id) AS leads_a,
           (SELECT COUNT(*)::int FROM fiaon_applications x WHERE x.person_id = b.id AND x.merged_into IS NULL) AS best_b,
           (SELECT COUNT(*)::int FROM fiaon_applications x WHERE x.person_id = b.id AND x.merged_into IS NULL AND x.payment_status = 'paid') AS bez_b,
           (SELECT COUNT(*)::int FROM fiaon_leads le WHERE le.person_id = b.id) AS leads_b
    FROM fiaon_persons a
    JOIN fiaon_persons b
      ON fiaon_mail_norm(b.primary_email) = fiaon_mail_norm(a.primary_email) AND b.id > a.id
    WHERE a.merged_into_person_id IS NULL AND b.merged_into_person_id IS NULL
      AND a.ist_test_am IS NULL AND b.ist_test_am IS NULL
      AND fiaon_mail_norm(a.primary_email) IS NOT NULL
    ORDER BY a.last_name
  `) as any[];
  zahl("Kandidaten-Paare über dieselbe E-MAIL", gleicheMail.length,
    "das stärkste Signal — eine Adresse, ein Postfach, ein Mensch");
  for (const p of gleicheMail.slice(0, 12)) {
    log(`    ${String(p.person_a).padStart(6)} + ${String(p.person_b).padStart(6)}  `
      + `${String(`${p.vorname} ${p.nachname}`).padEnd(28)} ${p.mail_a}`);
  }
  if (gleicheMail.length > 12) log(`    … und ${gleicheMail.length - 12} weitere`);

  // Beide Mengen zusammen — ohne Doppelnennung.
  const schlüssel = new Set(paare.map((p) => `${p.person_a}-${p.person_b}`));
  for (const g of gleicheMail) {
    if (!schlüssel.has(`${g.person_a}-${g.person_b}`)) {
      paare.push({ ...g, ueberMail: true });
      schlüssel.add(`${g.person_a}-${g.person_b}`);
    }
  }
  log("");
  zahl("Kandidaten insgesamt (ohne Doppelnennung)", paare.length);
  log("\n  DIE FUNDE (Person A · Person B · Merkmale):");
  for (const p of paare.slice(0, 30)) {
    log(`    ${String(p.person_a).padStart(6)} + ${String(p.person_b).padStart(6)}  `
      + `${String(`${p.vorname} ${p.nachname}`).padEnd(28)} `
      + `A: ${String(p.mail_a ?? p.nummer_a ?? "—").padEnd(30)} `
      + `B: ${String(p.mail_b ?? p.nummer_b ?? "—")}`);
  }
  if (paare.length > 30) log(`    … und ${paare.length - 30} weitere (siehe CSV)`);

  const mitZahlung = paare.filter((p) => Number(p.bez_a) + Number(p.bez_b) > 0);
  log("");
  zahl("… davon mit mindestens einer bezahlten Bestellung", mitZahlung.length,
    "die sind zuerst dran");

  log(`\n  CSV: ${csv("lauf-doppelgaenger.csv", paare)}`);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DIE GEMELDETEN FÄLLE — sind sie dabei?");
  // ═════════════════════════════════════════════════════════════════════════
  for (const name of ["Bianco", "Matzke", "Schlabs", "Rechtsteiner"]) {
    const treffer = paare.filter((p) => String(p.nachname).toLowerCase().includes(name.toLowerCase()));
    if (treffer.length === 0) {
      // Warum nicht? Das ist die interessantere Antwort.
      const personen = (await sqlPool`
        SELECT p.id, p.first_name, p.last_name, p.primary_email, p.primary_phone
        FROM fiaon_persons p
        WHERE p.merged_into_person_id IS NULL AND p.last_name ILIKE ${`%${name}%`}
        ORDER BY p.id
      `) as any[];
      log(`\n  ── ${name}: nicht als Paar erkannt ──`);
      for (const p of personen) {
        log(`     Person ${String(p.id).padStart(6)}  ${String(`${p.first_name} ${p.last_name}`).padEnd(26)} `
          + `${String(p.primary_email ?? "keine Mail").padEnd(30)} ${p.primary_phone ?? "keine Nummer"}`);
      }
      if (personen.length < 2) log("     → nur eine Person, also kein Doppelgänger (mehr).");
      continue;
    }
    log(`\n  ── ${name}: ${treffer.length} Paar(e) erkannt ──`);
    for (const t of treffer) {
      log(`     ${t.person_a} + ${t.person_b}  ${t.vorname} ${t.nachname}`);
      log(`       A: ${t.mail_a ?? "keine Mail"} · ${t.nummer_a ?? "keine Nummer"} `
        + `· ${t.best_a} Bestellungen (${t.bez_a} bezahlt) · ${t.leads_a} Leads`);
      log(`       B: ${t.mail_b ?? "keine Mail"} · ${t.nummer_b ?? "keine Nummer"} `
        + `· ${t.best_b} Bestellungen (${t.bez_b} bezahlt) · ${t.leads_b} Leads`);
    }
  }

  if (SCHREIBEN) {
    // ═══════════════════════════════════════════════════════════════════════
    titel("3. EINTRAGEN (Kandidaten, keine Zusammenführung)");
    // ═══════════════════════════════════════════════════════════════════════
    let neu = 0;
    for (const p of paare) {
      // Über die E-Mail gefundene Paare tragen die Adresse als Merkmal — sie
      // ist der Beweis. Über den Namen gefundene tragen den Namen.
      const merkmal = p.ueberMail ? "email" : "name";
      const wert = p.ueberMail
        ? String(p.mail_a).toLowerCase()
        : `${String(p.vorname).toLowerCase()} ${String(p.nachname).toLowerCase()}`;
      const zeilen = (await sqlPool`
        INSERT INTO fiaon_doppelgaenger (person_a, person_b, merkmal, wert, quelle, notiz)
        VALUES (${p.person_a}, ${p.person_b}, ${merkmal}, ${wert}, 'lauf',
                ${`Gleicher Name; einer hat die Nummer, der andere die E-Mail. `
                  + `A: ${p.mail_a ?? "keine Mail"} / ${p.nummer_a ?? "keine Nummer"}. `
                  + `B: ${p.mail_b ?? "keine Mail"} / ${p.nummer_b ?? "keine Nummer"}.`})
        ON CONFLICT DO NOTHING
        RETURNING id
      `) as any[];
      neu += zeilen.length;
    }
    zahl("Neue Kandidaten eingetragen", neu);
    const [gesamt] = (await sqlPool`
      SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE stand = 'offen')::int AS offen
      FROM fiaon_doppelgaenger
    `) as any[];
    zahl("Kandidaten insgesamt", gesamt.n);
    zahl("… offen", gesamt.offen, "sie warten auf eine Entscheidung");
    log("\n  KEINE Zusammenführung. Ein Merge ist unumkehrbar; Namensgleichheit");
    log("  ist kein Beweis (Vater und Sohn heißen gleich). Die Entscheidung");
    log("  gehört in die Dubletten-Ansicht.");
  } else {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log("  Das war die SUCHE. Zum Eintragen der Kandidaten:");
    log("  npx tsx scripts/doppelgaenger-lauf.ts --schreiben");
  }

  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
