// ═══════════════════════════════════════════════════════════════════════════
// BESTANDSLAUF: KONTAKTDATEN AN DIE PERSON
//
//   npx tsx scripts/eine-quelle-lauf.ts                nur Vorschau + CSV
//   npx tsx scripts/eine-quelle-lauf.ts --schreiben    führt den Umzug aus
//
// ── WAS DIESER LAUF TUT ────────────────────────────────────────────────────
// Er zieht die Kontaktwerte aus den Bestell- und Lead-Zeilen an die Person.
// GEMESSEN vorher: 2.387 Bestellungen mit einer Nummer, die an der Person
// fehlte, 293 mit einer E-Mail, 189 Leads mit einer E-Mail.
//
// ── WIE ────────────────────────────────────────────────────────────────────
// Nicht mit eigener Logik, sondern durch die Wand: `fiaon_kontakt_an_person()`
// aus Migration 059. Dieselbe Funktion, die ab jetzt bei jedem Schreibvorgang
// läuft. Zwei Fassungen derselben Regel wären ein neues Doppelmodell.
//
//   Person leer      → sie übernimmt den Wert
//   Person gleich    → nichts
//   Person abweichend→ sie behält, der Zeilenwert wird ALIAS (Suche findet ihn)
//
// ── UND DAS ARCHIV ─────────────────────────────────────────────────────────
// Vor dem Umzug wandert jeder Wert in `fiaon_kontakt_archiv` — die Forensik-
// Kopie für den späteren DROP. Sie wird von der Anwendung nie gelesen.
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
  // `fiaon_app_nummer` stand hier zuerst als CREATE-Anweisung im Skript. Das
  // war die falsche Stelle: Nach einem Neuaufsetzen der Datenbank hätte sie
  // gefehlt. Sie steht jetzt in Migration 060, wo alle sie finden.
  log(SCHREIBEN
    ? "\n  ⚠  SCHREIBMODUS — Kontaktdaten wandern an die Person."
    : "\n  VORSCHAU. Nichts wird geändert. Zum Schreiben: --schreiben");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE BETROFFENEN");
  // ═════════════════════════════════════════════════════════════════════════
  const [vorher] = (await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          AND fiaon_mail_norm(a.email) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(a.email))) AS mail_app,
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          AND fiaon_nummer_norm(a.phone) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9)
              = RIGHT(fiaon_nummer_norm(a.phone), 9))) AS nummer_app,
      (SELECT COUNT(*)::int FROM fiaon_leads le
        WHERE le.person_id IS NOT NULL AND fiaon_mail_norm(le.email) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = le.person_id
            AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(le.email))) AS mail_lead,
      (SELECT COUNT(*)::int FROM fiaon_leads le
        WHERE le.person_id IS NOT NULL AND fiaon_nummer_norm(le.telefon) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = le.person_id
            AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9)
              = RIGHT(fiaon_nummer_norm(le.telefon), 9))) AS nummer_lead
  `) as any[];
  zahl("Bestellungen: E-Mail fehlt an der Person", vorher.mail_app);
  zahl("Bestellungen: Nummer fehlt an der Person", vorher.nummer_app);
  zahl("Leads: E-Mail fehlt an der Person", vorher.mail_lead);
  zahl("Leads: Nummer fehlt an der Person", vorher.nummer_lead);

  // ── WIE VIELE PERSONEN SIND GANZ OHNE KONTAKT? ─────────────────────────
  // Das ist die Zahl, die den Versand blockiert: Wer keine E-Mail an der Person
  // hat, kann keine Mail bekommen — auch wenn eine am Antrag steht.
  const [ohne] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL
               AND fiaon_mail_norm(a.email) IS NOT NULL))::int AS aber_am_antrag,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.payment_status = 'paid'))::int AS bezahlt
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND fiaon_mail_norm(p.primary_email) IS NULL
  `) as any[];
  log("");
  zahl("Personen OHNE E-Mail an der Person", ohne.gesamt);
  zahl("… obwohl eine am Antrag steht", ohne.aber_am_antrag,
    "diese Menschen bekommen heute keine Mail — der Fall Bianco/Rechtsteiner");
  zahl("… davon zahlende Kunden", ohne.bezahlt, "das ist der teure Teil");

  log(`\n  CSV: ${csv("lauf-quelle-vorschau.csv", (await sqlPool`
    SELECT 'application' AS quelle, a.ref AS kennung, a.person_id,
           a.email AS mail_zeile,
           (SELECT p.primary_email FROM fiaon_persons p WHERE p.id = a.person_id) AS mail_person,
           CASE WHEN a.phone LIKE '+%' THEN a.phone
                WHEN COALESCE(a.phone_country_code,'') <> '' THEN a.phone_country_code || a.phone
                ELSE a.phone END AS nummer_zeile,
           (SELECT p.primary_phone FROM fiaon_persons p WHERE p.id = a.person_id) AS nummer_person,
           CASE WHEN (SELECT fiaon_mail_norm(p.primary_email) FROM fiaon_persons p WHERE p.id = a.person_id) IS NULL
                  AND fiaon_mail_norm(a.email) IS NOT NULL THEN 'Person UEBERNIMMT'
                WHEN fiaon_mail_norm(a.email) IS NOT NULL THEN 'wird ALIAS'
                ELSE '' END AS wirkung_mail,
           a.payment_status
    FROM fiaon_applications a
    WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
      AND ((fiaon_mail_norm(a.email) IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
              AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(a.email)))
        OR (fiaon_nummer_norm(a.phone) IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
              AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9) = RIGHT(fiaon_nummer_norm(a.phone), 9))))
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC
  `) as any[])}`);

  if (!SCHREIBEN) {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log("  Das war die VORSCHAU. Die CSV nennt je Zeile die Wirkung");
    log("  (\u201ePerson UEBERNIMMT\u201c oder \u201ewird ALIAS\u201c).");
    log("  Wenn sie stimmt:  npx tsx scripts/eine-quelle-lauf.ts --schreiben");
    log("");
    await sqlPool.end();
    return;
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("1. DAS ARCHIV FÜLLEN (Forensik für den späteren DROP)");
  // ═════════════════════════════════════════════════════════════════════════
  const [arch] = (await sqlPool`
    WITH neu AS (
      INSERT INTO fiaon_kontakt_archiv (quelle, kennung, person_id, feld, wert)
      SELECT 'application', a.ref, a.person_id, f.feld, f.wert
      FROM fiaon_applications a
      CROSS JOIN LATERAL (VALUES
        ('email', a.email), ('contact_email', a.contact_email),
        ('billing_email', a.billing_email), ('phone', a.phone),
        ('contact_phone', a.contact_phone)
      ) AS f(feld, wert)
      WHERE NULLIF(BTRIM(COALESCE(f.wert, '')), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_kontakt_archiv k
          WHERE k.quelle = 'application' AND k.kennung = a.ref
            AND k.feld = f.feld AND k.wert = f.wert)
      RETURNING 1
    ) SELECT COUNT(*)::int AS n FROM neu
  `) as any[];
  zahl("Werte aus Bestellungen gesichert", arch.n);

  const [archL] = (await sqlPool`
    WITH neu AS (
      INSERT INTO fiaon_kontakt_archiv (quelle, kennung, person_id, feld, wert)
      SELECT 'lead', le.id::text, le.person_id, f.feld, f.wert
      FROM fiaon_leads le
      CROSS JOIN LATERAL (VALUES ('email', le.email), ('telefon', le.telefon)) AS f(feld, wert)
      WHERE NULLIF(BTRIM(COALESCE(f.wert, '')), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_kontakt_archiv k
          WHERE k.quelle = 'lead' AND k.kennung = le.id::text
            AND k.feld = f.feld AND k.wert = f.wert)
      RETURNING 1
    ) SELECT COUNT(*)::int AS n FROM neu
  `) as any[];
  zahl("Werte aus Leads gesichert", archL.n);

  // ═════════════════════════════════════════════════════════════════════════
  titel("2. DER UMZUG — durch DIESELBE Funktion wie die Wand");
  // ═════════════════════════════════════════════════════════════════════════
  // Ein `UPDATE … SET email = email` löst den Trigger aus Migration 059 aus und
  // schreibt damit alles durch. Das ist bewusst so gebaut: Der Bestandslauf und
  // der laufende Betrieb benutzen exakt denselben Weg. Wäre hier eigene Logik,
  // gäbe es zwei Fassungen — und genau das soll sterben.
  //
  // In Blöcken, damit ein einzelner langer Lauf nicht in einen
  // Anweisungs-Zeitausfall läuft.
  let angefasst = 0;
  for (;;) {
    const zeilen = (await sqlPool`
      -- ── DIE SPALTEN MÜSSEN GENANNT WERDEN ──────────────────────────
      -- Erster Versuch: SET updated_at = a.updated_at. Der Trigger feuerte
      -- NICHT — er ist AFTER UPDATE OF email, phone, … und reagiert nur,
      -- wenn eine dieser Spalten in der Anweisung STEHT. Der Lauf meldete 98
      -- angefasste Zeilen und änderte nichts.
      --
      -- Jetzt werden die Spalten auf ihren eigenen Wert gesetzt: Das ändert
      -- keinen Inhalt, nennt aber die Spalten — und der Trigger schreibt durch.
      UPDATE fiaon_applications a SET
        email = a.email, contact_email = a.contact_email,
        billing_email = a.billing_email, phone = a.phone,
        contact_phone = a.contact_phone
      WHERE a.ref IN (
        SELECT a2.ref FROM fiaon_applications a2
        WHERE a2.merged_into IS NULL AND a2.gdpr_deleted_at IS NULL AND a2.person_id IS NOT NULL
          -- ── ZWEI GRÜNDE, EINE ZEILE ANZUFASSEN ────────────────────────
          -- (1) Die Person hat GAR KEINEN Wert → sie muss ihn bekommen. Das
          --     gilt auch, wenn schon ein Alias existiert: Ein Alias ist eine
          --     Nebenadresse, kein Hauptwert. Der erste Entwurf schloss solche
          --     Zeilen aus — 147 Personen blieben ohne E-Mail, obwohl eine am
          --     Antrag stand.
          -- (2) Der Wert ist an der Person weder Haupt noch Alias → er soll
          --     Alias werden, damit die Suche ihn findet.
          AND ((fiaon_mail_norm(a2.email) IS NOT NULL AND (
                 NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a2.person_id
                   AND fiaon_mail_norm(p.primary_email) IS NOT NULL)
                 OR (NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a2.person_id
                       AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(a2.email))
                     AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                       WHERE al.person_id = a2.person_id AND al.kind = 'email'
                         AND al.value_norm = fiaon_mail_norm(a2.email)))))
            OR (fiaon_nummer_norm(fiaon_app_nummer(a2.phone, a2.phone_country_code, a2.contact_phone)) IS NOT NULL AND (
                 NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a2.person_id
                   AND fiaon_nummer_norm(p.primary_phone) IS NOT NULL)
                 OR (NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a2.person_id
                       AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9)
                         = RIGHT(fiaon_nummer_norm(fiaon_app_nummer(a2.phone, a2.phone_country_code, a2.contact_phone)), 9))
                     AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                       WHERE al.person_id = a2.person_id AND al.kind = 'phone'
                         AND al.value_norm = fiaon_nummer_norm(fiaon_app_nummer(a2.phone, a2.phone_country_code, a2.contact_phone)))))))
        LIMIT 400
      )
      RETURNING a.ref
    `) as any[];
    if (zeilen.length === 0) break;
    angefasst += zeilen.length;
    log(`    … ${angefasst} Bestellungen durchgeschrieben`);
    if (zeilen.length < 400) break;
  }
  zahl("Bestellungen angefasst", angefasst);

  let leadsAn = 0;
  for (;;) {
    const zeilen = (await sqlPool`
      -- Dieselbe Begründung wie oben: Die Spalten nennen, damit der Trigger
      -- feuert. Der Inhalt bleibt unverändert.
      UPDATE fiaon_leads le SET email = le.email, telefon = le.telefon
      WHERE le.id IN (
        SELECT l2.id FROM fiaon_leads l2
        WHERE l2.person_id IS NOT NULL
          -- Dieselben zwei Gründe wie bei den Bestellungen.
          AND ((fiaon_mail_norm(l2.email) IS NOT NULL AND (
                 NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l2.person_id
                   AND fiaon_mail_norm(p.primary_email) IS NOT NULL)
                 OR (NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l2.person_id
                       AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(l2.email))
                     AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                       WHERE al.person_id = l2.person_id AND al.kind = 'email'
                         AND al.value_norm = fiaon_mail_norm(l2.email)))))
            OR (fiaon_nummer_norm(l2.telefon) IS NOT NULL AND (
                 NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l2.person_id
                   AND fiaon_nummer_norm(p.primary_phone) IS NOT NULL)
                 OR (NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = l2.person_id
                       AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9) = RIGHT(fiaon_nummer_norm(l2.telefon), 9))
                     AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                       WHERE al.person_id = l2.person_id AND al.kind = 'phone'
                         AND al.value_norm = fiaon_nummer_norm(l2.telefon))))))
        LIMIT 400
      )
      RETURNING le.id
    `) as any[];
    if (zeilen.length === 0) break;
    leadsAn += zeilen.length;
    log(`    … ${leadsAn} Leads durchgeschrieben`);
    if (zeilen.length < 400) break;
  }
  zahl("Leads angefasst", leadsAn);

  // ═════════════════════════════════════════════════════════════════════════
  titel("3. DIE ZÄHLPROBE");
  // ═════════════════════════════════════════════════════════════════════════
  // Nach dem Lauf darf KEINE lebende Zeile einen Kontaktwert tragen, der an der
  // Person weder als Hauptwert noch als Alias existiert.
  const [nach] = (await sqlPool`
    SELECT
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          AND fiaon_mail_norm(a.email) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(a.email))
          AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = a.person_id AND al.kind = 'email'
              AND al.value_norm = fiaon_mail_norm(a.email))) AS mail_app,
      (SELECT COUNT(*)::int FROM fiaon_applications a
        WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL
          -- Die ZUSAMMENGESETZTE Nummer, wie der Trigger sie schreibt.
          AND fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = a.person_id
            AND RIGHT(fiaon_nummer_norm(p.primary_phone), 9)
              = RIGHT(fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)), 9))
          AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = a.person_id AND al.kind = 'phone'
              AND al.value_norm = fiaon_nummer_norm(fiaon_app_nummer(a.phone, a.phone_country_code, a.contact_phone)))) AS nummer_app,
      (SELECT COUNT(*)::int FROM fiaon_leads le
        WHERE le.person_id IS NOT NULL AND fiaon_mail_norm(le.email) IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM fiaon_persons p WHERE p.id = le.person_id
            AND fiaon_mail_norm(p.primary_email) = fiaon_mail_norm(le.email))
          AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = le.person_id AND al.kind = 'email'
              AND al.value_norm = fiaon_mail_norm(le.email))) AS mail_lead
  `) as any[];
  zahl("Bestellungen mit unbekannter E-Mail", nach.mail_app,
    Number(nach.mail_app) === 0 ? "richtig" : "FEHLER");
  zahl("Bestellungen mit unbekannter Nummer", nach.nummer_app,
    Number(nach.nummer_app) === 0 ? "richtig" : "FEHLER");
  zahl("Leads mit unbekannter E-Mail", nach.mail_lead,
    Number(nach.mail_lead) === 0 ? "richtig" : "FEHLER");
  if (Number(nach.mail_app) + Number(nach.nummer_app) + Number(nach.mail_lead) > 0) {
    process.exitCode = 1;
  }

  // Und die Zahl, die den Versand betrifft:
  const [nachOhne] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL AND fiaon_mail_norm(p.primary_email) IS NULL
      AND EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = p.id AND a.merged_into IS NULL
          AND fiaon_mail_norm(a.email) IS NOT NULL)
  `) as any[];
  log("");
  zahl("Personen ohne Mail, obwohl eine am Antrag steht", nachOhne.n,
    Number(nachOhne.n) === 0 ? "richtig — der Versand findet jetzt jeden" : "FEHLER");
  if (Number(nachOhne.n) > 0) process.exitCode = 1;

  const [aliasN] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_person_aliases`) as any[];
  const [archN] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_kontakt_archiv`) as any[];
  log("");
  zahl("Aliase insgesamt", aliasN.n, "abweichende Werte bleiben auffindbar");
  zahl("Werte im Archiv", archN.n, "Forensik-Kopie für den späteren DROP");

  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
