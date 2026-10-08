// ═══════════════════════════════════════════════════════════════════════════
// EINMAL-LAUF E-IT-C (08.10.2026): Unterlagen-Bestand + Ausweis-Urteile
//
// STANDARD IST DER TROCKENLAUF — er liest nur und schreibt nichts.
// Mit --ausfuehren schreibt er, legt VORHER eine Sicherung und das Rückweg-SQL
// ab (Ordner backups/it-c-einmal-<Zeit>/, per .gitignore nie im Repo).
//
// Teil A — Bestand übernehmen (Punkt 3):
//   Jede Unterlage, die vor dem 08.10.2026 in einer Spalte lag (bank_statement_pdf,
//   id_card_pdf, schufa_pdf), wird EINE Datei in fiaon_dokumente (art 'unterlage',
//   herkunft 'bestand') — damit „Hinzufügen" an den Bestand anhängt und Kunde wie
//   Akte die Datei in der Liste sehen. Die Spalten selbst werden NICHT verändert.
//   Wand: Die Zahl „liegt vor" je Kategorie (Personen mit LENGTH > 0) und die Zahl
//   der Personen mit Kontoauszug UND Ausweis (Karte-Tor) sind vorher = nachher.
//   0-Byte-Spalten (2 Bestellungen) werden nicht übernommen.
//   Ohne diesen Lauf übernimmt der Server den Bestand je Person beim ersten
//   Schreiben selbst (bestandUebernehmen) — der Lauf macht es für alle auf einmal.
//
// Teil B — Ausweis-Urteile neu bewerten (Punkt 13 D):
//   Die alten KI-Urteile sagten 34 von 34 Mal „unvollständig", 30-mal „Rückseite"
//   (auch beim Reisepass). Neu bewertet wird mit der festen Regel
//   (shared/fiaon-unterlagen.ts, ausweisBewerten) über die Textschicht — OHNE KI,
//   ohne Texterkennung (keine Ausweisbilder an eine KI), ohne Mail, ohne WhatsApp.
//   Es ändert sich nur der Hinweis im Kundenbereich und in der Akte.
//
// Teil C — EINE Sammel-Aufgabe „Ausweise aus dem Bestand von Hand ansehen“ (E-IT-C Nachbesserung):
//   0 KYC-Freigaben im Bestand — „von der Verwaltung geprüft“ entsteht nur noch über „Geprüft“. Ein
//   Bestand-Ausweis steht für den Kunden weiter auf „liegt vor“ (wie bisher), das Office liest an der
//   Kategorie „bitte einmal ansehen und Geprüft setzen“. Damit das abgearbeitet wird, legt Teil C EINE
//   offene Aufgabe für die Verwaltung an (fiaon_vermerke, ohne ref = allgemeiner Vermerk) mit allen
//   betroffenen Referenzen. Keine Mail, kein WhatsApp. Gibt es schon eine offene, entsteht keine zweite.
//
// Aufruf (der Integrator, NICHT gegen die Produktion ohne Freigabe):
//   DATABASE_URL=… npx tsx scripts/it-c-einmal.ts                 # Trockenlauf
//   DATABASE_URL=… npx tsx scripts/it-c-einmal.ts --ausfuehren    # schreibt, mit Sicherung
//   Optionen: --nur=bestand | --nur=ausweis | --nur=aufgabe, --grenze=N (Personen je Lauf, Standard alle)
//
// Sperren (E-254): jede Verbindung mit statement_timeout 60 s, lock_timeout 5 s,
// idle_in_transaction 60 s. Nur INSERT in fiaon_dokumente/fiaon_unterlagen_akte und
// UPDATE einzelner Zeilen in fiaon_dokument_pruefungen — keine Tabellensperre.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const ARGS = process.argv.slice(2);
const AUSFUEHREN = ARGS.includes("--ausfuehren");
const NUR = (ARGS.find((a) => a.startsWith("--nur=")) || "").slice(6) || null;
const GRENZE = Number((ARGS.find((a) => a.startsWith("--grenze=")) || "").slice(9)) || 0;
const url = String(process.env.DATABASE_URL || "");
if (!url) { console.error("DATABASE_URL fehlt."); process.exit(2); }
// Keine KI, keine Mail — auch nicht versehentlich.
for (const k of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN"]) delete process.env[k];

const lokal = /@(127\.0\.0\.1|localhost):/.test(url);
const sql = postgres(url, {
  ssl: "require", max: 1, onnotice: () => {},
  connection: { statement_timeout: 60_000, lock_timeout: 5_000, idle_in_transaction_session_timeout: 60_000, application_name: "it-c-einmal" },
}) as any;

const { unterlagenBereit, bestandUebernehmen, traegerRef, ausweisKontextFuerRef } = await import("../server/lib/fiaon-unterlagen");
const { dokumentPruefen } = await import("../server/lib/fiaon-dokument-pruefung");

const zeit = new Date().toISOString().replace(/[:.]/g, "-");
const ordner = path.resolve("backups", `it-c-einmal-${zeit}`);
const rueckweg: string[] = [];
const sicherung: Record<string, unknown> = { erstellt: new Date().toISOString(), lokal, ausfuehren: AUSFUEHREN };

console.log(`E-IT-C Einmal-Lauf — ${AUSFUEHREN ? "AUSFÜHREN (schreibt)" : "TROCKENLAUF (liest nur)"} — Datenbank ${lokal ? "lokal" : "ENTFERNT"}`);
if (AUSFUEHREN) fs.mkdirSync(ordner, { recursive: true });

const KATS = [
  { k: "kontoauszug" as const, spalte: "bank_statement_pdf" },
  { k: "ausweis" as const, spalte: "id_card_pdf" },
  { k: "schufa" as const, spalte: "schufa_pdf" },
];

async function wandZahlen(): Promise<Record<string, number>> {
  const [z] = (await sql`
    SELECT
      (SELECT count(DISTINCT person_id) FROM fiaon_applications WHERE gdpr_deleted_at IS NULL AND LENGTH(bank_statement_pdf) > 0)::int AS kontoauszug,
      (SELECT count(DISTINCT person_id) FROM fiaon_applications WHERE gdpr_deleted_at IS NULL AND LENGTH(id_card_pdf) > 0)::int AS ausweis,
      (SELECT count(DISTINCT person_id) FROM fiaon_applications WHERE gdpr_deleted_at IS NULL AND LENGTH(schufa_pdf) > 0)::int AS schufa,
      (SELECT count(*) FROM fiaon_persons p
        WHERE EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL AND a.bank_statement_pdf IS NOT NULL)
          AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL AND a.id_card_pdf IS NOT NULL))::int AS karte_tor`) as any[];
  return { kontoauszug: z.kontoauszug, ausweis: z.ausweis, schufa: z.schufa, karte_tor: z.karte_tor };
}

let fehler = 0;

// ═══ TEIL A — BESTAND ═══════════════════════════════════════════════════════
if (!NUR || NUR === "bestand") {
  console.log("\nA · Bestand übernehmen");
  if (!(await unterlagenBereit(sql))) { console.error("  Migration 099 fehlt — erst die Migration, dann dieser Lauf."); process.exit(2); }
  const vorher = await wandZahlen();
  console.log(`  vorher „liegt vor“: Kontoauszug ${vorher.kontoauszug}, Ausweis ${vorher.ausweis}, Auskunft ${vorher.schufa}; Karte-Tor (beides) ${vorher.karte_tor}`);
  const eingefuegt: { personId: number; kategorie: string; ids: number[] }[] = [];
  for (const { k, spalte } of KATS) {
    const kandidaten = (await sql.unsafe(`
      SELECT a.person_id, count(DISTINCT encode(sha256(a.${spalte}), 'hex'))::int AS fassungen, SUM(LENGTH(a.${spalte}))::bigint AS bytes
        FROM fiaon_applications a
       WHERE a.gdpr_deleted_at IS NULL AND a.person_id IS NOT NULL AND LENGTH(a.${spalte}) > 0
         AND NOT EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = a.person_id AND d.art = 'unterlage' AND d.kategorie = $1
                           AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL)
       GROUP BY a.person_id ORDER BY a.person_id ${GRENZE ? `LIMIT ${GRENZE}` : ""}`, [k])) as any[];
    const gespalten = kandidaten.filter((x) => Number(x.fassungen) > 1);
    const mb = kandidaten.reduce((n, x) => n + Number(x.bytes || 0), 0) / 1024 / 1024;
    console.log(`  ${k}: ${kandidaten.length} Personen, ${kandidaten.reduce((n, x) => n + Number(x.fassungen), 0)} Fassungen, ${mb.toFixed(1)} MB` +
      (gespalten.length ? ` — ${gespalten.length} mit mehreren Fassungen (Personen ${gespalten.map((x) => x.person_id).slice(0, 10).join(", ")})` : ""));
    if (!AUSFUEHREN) continue;
    for (const kand of kandidaten) {
      const personId = Number(kand.person_id);
      const vor = (await sql`SELECT id FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k}`) as any[];
      try {
        await bestandUebernehmen(personId, k, sql);
        // Die Fassung an der Trägerbestellung gilt danach als „unsere“ Bindung — eine spätere Änderung von außen fällt auf.
        const traeger = await traegerRef(personId, sql);
        const [h] = (await sql.unsafe(`SELECT encode(sha256(${spalte}), 'hex') AS h FROM fiaon_applications WHERE ref = $1 AND LENGTH(${spalte}) > 0`, [traeger ?? ""])) as any[];
        const [n] = (await sql`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
        const [vorAkte] = (await sql`SELECT 1 FROM fiaon_unterlagen_akte WHERE person_id = ${personId} AND kategorie = ${k}`) as any[];
        await sql`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, ref, akte_hash, dateien, gebunden_am, updated_at)
                  VALUES (${personId}, ${k}, ${traeger}, ${h?.h ?? null}, ${Number(n?.n || 0)}, NOW(), NOW())
                  ON CONFLICT (person_id, kategorie) DO NOTHING`;
        const nach = (await sql`SELECT id FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k}`) as any[];
        const neu = nach.map((r: any) => Number(r.id)).filter((id: number) => !vor.some((v: any) => Number(v.id) === id));
        eingefuegt.push({ personId, kategorie: k, ids: neu });
        if (neu.length) rueckweg.push(`DELETE FROM fiaon_dokumente WHERE id IN (${neu.join(", ")}) AND art = 'unterlage' AND herkunft IN ('bestand', 'fremd');`);
        if (!vorAkte) rueckweg.push(`DELETE FROM fiaon_unterlagen_akte WHERE person_id = ${personId} AND kategorie = '${k}';`);
      } catch (e) {
        fehler++;
        console.error(`  Person ${personId}/${k}:`, String((e as Error)?.message || e).slice(0, 200));
      }
    }
  }
  sicherung.bestand = eingefuegt;
  const nachher = await wandZahlen();
  const gleich = Object.keys(vorher).every((k) => vorher[k] === nachher[k]);
  console.log(`  nachher „liegt vor“: Kontoauszug ${nachher.kontoauszug}, Ausweis ${nachher.ausweis}, Auskunft ${nachher.schufa}; Karte-Tor ${nachher.karte_tor} — ${gleich ? "WAND HÄLT" : "WAND GEBROCHEN"}`);
  if (!gleich) fehler++;
  if (AUSFUEHREN) console.log(`  übernommen: ${eingefuegt.reduce((n, e) => n + e.ids.length, 0)} Dateien bei ${eingefuegt.length} Person/Kategorie-Paaren`);
}

// ═══ TEIL B — AUSWEIS-URTEILE ═══════════════════════════════════════════════
if (!NUR || NUR === "ausweis") {
  console.log("\nB · Ausweis-Urteile neu bewerten (ohne KI, ohne Mail)");
  const zeilen = (await sql`
    SELECT id, ref, urteil FROM fiaon_dokument_pruefungen
     WHERE art = 'ausweis' AND jsonb_typeof(urteil) = 'object'
       AND (urteil->>'quelle' = 'ki' OR urteil->>'hinweisKunde' IS NOT NULL)
     ORDER BY id ${GRENZE ? sql`LIMIT ${GRENZE}` : sql``}`) as any[];
  let rueckseiteWeg = 0; let geaendert = 0; let ohneDatei = 0;
  const alt: unknown[] = [];
  for (const z of zeilen) {
    // Die Datei an der Bestellung, die den Ausweis TRÄGT (personenweit, wie dokumentTraeger).
    const [d] = (await sql`
      SELECT y.id_card_pdf AS pdf FROM fiaon_applications y
       WHERE y.gdpr_deleted_at IS NULL AND LENGTH(y.id_card_pdf) > 0
         AND (y.ref = ${z.ref} OR y.person_id = (SELECT x.person_id FROM fiaon_applications x WHERE x.ref = ${z.ref} LIMIT 1))
       ORDER BY (y.ref = ${z.ref}) DESC, (y.merged_into IS NULL) DESC, y.documents_uploaded_at DESC NULLS LAST LIMIT 1`) as any[];
    if (!d?.pdf) { ohneDatei++; continue; }
    const pdf: Buffer = Buffer.isBuffer(d.pdf) ? d.pdf : Buffer.from(d.pdf);
    const ctx = await ausweisKontextFuerRef(String(z.ref), sql).catch(() => ({ erklaert: [], aufenthaltstitelUnterWeitere: false }));
    const neu = await dokumentPruefen("ausweis", pdf.subarray(0, 4).toString("latin1") === "%PDF" ? pdf : await (async () => {
      const { bildAlsPdf } = await import("../server/lib/fiaon-bild-zu-pdf");
      return bildAlsPdf(pdf, "ausweis.jpg");
    })(), { ...ctx, ohneOcr: true });
    const vorherSatz = String(z.urteil?.hinweisKunde ?? "—");
    const nachherSatz = String(neu.hinweisKunde ?? "—");
    if (/Rückseite/.test(vorherSatz) && !/Rückseite/.test(nachherSatz)) rueckseiteWeg++;
    if (vorherSatz !== nachherSatz || z.urteil?.vollstaendig !== neu.vollstaendig) geaendert++;
    console.log(`  ${z.ref}: „${vorherSatz.slice(0, 70)}“ → „${nachherSatz.slice(0, 70)}“ (vollständig ${z.urteil?.vollstaendig} → ${neu.vollstaendig})`);
    if (AUSFUEHREN) {
      alt.push({ id: Number(z.id), ref: z.ref, urteil: z.urteil });
      rueckweg.push(`UPDATE fiaon_dokument_pruefungen SET urteil = '${JSON.stringify(z.urteil).replace(/'/g, "''")}'::jsonb, updated_at = NOW() WHERE id = ${Number(z.id)};`);
      await sql`UPDATE fiaon_dokument_pruefungen SET urteil = ${sql.json(neu as any)}, updated_at = NOW() WHERE id = ${z.id}`;
    }
  }
  sicherung.ausweisUrteile = alt;
  console.log(`  ${zeilen.length} Urteile, ${geaendert} ändern sich, ${rueckseiteWeg} Rückseiten-Hinweise verschwinden, ${ohneDatei} ohne Datei übersprungen.`);
}

// ═══ TEIL C — EINE SAMMEL-AUFGABE: BESTAND-AUSWEISE ANSEHEN ═══════════════════
if (!NUR || NUR === "aufgabe") {
  console.log("\nC · Sammel-Aufgabe „Ausweise aus dem Bestand von Hand ansehen“ (ohne Mail)");
  // Personen mit Ausweis in einer Spalte, ohne KYC-Freigabe und ohne geprüfte Ausweis-Datei.
  const offen = (await sql`
    SELECT p.id, TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL AND a.merged_into IS NULL
             ORDER BY (a.payment_status = 'paid') DESC, (COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%') DESC, a.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p
     WHERE p.merged_into_person_id IS NULL
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL AND LENGTH(a.id_card_pdf) > 0)
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL AND a.kyc_status = 'approved')
       AND NOT EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = p.id AND d.art = 'unterlage' AND d.kategorie = 'ausweis'
                         AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL AND d.geprueft_am IS NOT NULL)
     ORDER BY p.id ${GRENZE ? sql`LIMIT ${GRENZE}` : sql``}`) as any[];
  const [schon] = (await sql`SELECT id FROM fiaon_vermerke WHERE art = 'aufgabe' AND status = 'offen' AND autor_art = 'system'
                               AND text LIKE 'Ausweise aus dem Bestand von Hand ansehen%' LIMIT 1`.catch(() => [])) as any[];
  const liste = offen.filter((o) => o.ref).map((o) => `${o.ref}${o.name ? ` (${o.name})` : ""}`);
  console.log(`  ${liste.length} Kunden mit ungeprüftem Bestand-Ausweis${schon ? ` — offene Sammel-Aufgabe ${schon.id} besteht schon, keine zweite` : ""}.`);
  if (AUSFUEHREN && liste.length && !schon) {
    const text = `Ausweise aus dem Bestand von Hand ansehen (${liste.length}): je Kunde Akte öffnen → Dokumente → Ausweis ansehen → „Geprüft“ setzen `
      + `(Reisepass: Datenseite genügt; Personalausweis: vorn und hinten; Aufenthaltstitel nur mit Reisepass). Der Kunde sieht „liegt vor“. Kunden: ${liste.join(", ")}`;
    const [neu] = (await sql`
      INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
      VALUES ('aufgabe', NULL, ${text}, 'betreiber', TRUE, FALSE, 'offen', 'system', 'System', ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 7))
      RETURNING id`) as any[];
    sicherung.sammelAufgabe = { id: Number(neu.id), kunden: liste.length };
    rueckweg.push(`DELETE FROM fiaon_vermerke WHERE id = ${Number(neu.id)} AND autor_art = 'system';`);
    console.log(`  Aufgabe ${neu.id} angelegt.`);
  }
}

if (AUSFUEHREN) {
  fs.writeFileSync(path.join(ordner, "sicherung.json"), JSON.stringify(sicherung, null, 1));
  fs.writeFileSync(path.join(ordner, "rueckweg.sql"), [
    "-- Rückweg E-IT-C Einmal-Lauf (" + new Date().toISOString() + ")",
    "-- Teil A: die übernommenen Bestandsdateien sind reine Kopien der Spalten — Löschen stellt den Zustand davor her.",
    "-- Teil B: die alten Ausweis-Urteile, Zeile für Zeile.",
    "-- Teil C: die Sammel-Aufgabe.",
    "BEGIN;", "SET LOCAL lock_timeout = '5s';", ...rueckweg, "COMMIT;", "",
  ].join("\n"));
  console.log(`\nSicherung und Rückweg: ${ordner}`);
}
await sql.end({ timeout: 5 });
console.log(fehler ? `\n${fehler} Fehler.` : "\nFertig, ohne Fehler.");
process.exit(fehler ? 1 : 0);
