// ═══════════════════════════════════════════════════════════════════════════
// DIE NUMMER-ANFRAGEN VON FRÜHER IN DEN WARTEZUSTAND
//
//   npx tsx scripts/warten-bestand.ts                nur Vorschau + CSV
//   npx tsx scripts/warten-bestand.ts --schreiben    setzt den Wartezustand
//
// ── DER BEFUND (24.08.2026) ────────────────────────────────────────────────
// Der Wartezustand existiert seit dem 16.08.2026 (`server/lib/fiaon-warten.ts`):
// Wer per Mail um seine Nummer gebeten wird, verschwindet für sieben Tage aus
// der Tagesliste und kommt von selbst zurück — durch Antwort oder Ablauf.
//
// Die Fälle von VORHER haben ihn nie bekommen. GEMESSEN: 11 Bestellungen mit
// einer Nummern-Anfrage im Kontakt-Log, davon **7 stehen heute in der
// Tagesliste** — bei einem Kunden, dessen Nummer nicht stimmt. Der Agent kann
// dort nichts tun als überblättern.
//
// ── WAS DIESER LAUF NICHT TUT ──────────────────────────────────────────────
// Er verschickt KEINE Mail. Die Anfrage ist längst raus (deshalb steht sie im
// Log) — eine zweite wäre eine Belästigung. Er setzt nur den Zustand, der
// damals gefehlt hat.
//
// ── UND ER BENUTZT DIE BESTEHENDE FUNKTION ─────────────────────────────────
// `wartenAufKunde()` statt eines eigenen UPDATE. Sie kennt die Regel „nur nach
// hinten verschieben" und setzt `wartet_auf`, `wartet_seit` und
// `follow_up_date` gemeinsam. Ein eigenes UPDATE hier wäre eine zweite Fassung
// derselben Regel — genau das, was in diesem Repo mehrfach schiefgegangen ist.
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { wartenAufKunde, WARTE_TAGE } from "../server/lib/fiaon-warten";

const SCHREIBEN = process.argv.includes("--schreiben");

const log = (s = "") => console.log(s);
function titel(t: string): void { log(`\n${"═".repeat(72)}\n${t}\n${"═".repeat(72)}`); }
function zahl(name: string, v: unknown, hinweis = ""): void {
  log(`  ${String(v).padStart(8)}  ${name}${hinweis ? `  — ${hinweis}` : ""}`);
}

async function main(): Promise<void> {
  log(SCHREIBEN
    ? `\n  ⚠  SCHREIBMODUS — Wartezustand für ${WARTE_TAGE} Tage, KEINE Mails.`
    : "\n  VORSCHAU. Nichts wird geändert. Zum Schreiben: --schreiben");

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE BETROFFENEN");
  // ═════════════════════════════════════════════════════════════════════════
  const zeilen = (await sqlPool`
    SELECT DISTINCT ON (p.id)
           a.ref, p.id AS person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name) AS name,
           p.wartet_auf, p.follow_up_date,
           (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE) AS in_tagesliste,
           MAX(c.created_at) OVER (PARTITION BY p.id) AS anfrage_am,
           a.payment_status
    FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE (c.note ILIKE '%number_update%' OR c.type ILIKE '%number_update%')
      -- Wer schon wartet, bleibt unangetastet.
      AND p.wartet_auf IS NULL
      -- Und wer nicht in der Tagesliste steht, stört auch niemanden. Ihn
      -- anzufassen würde seine Wiedervorlage nach hinten schieben, ohne Nutzen.
      AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
    ORDER BY p.id, c.created_at DESC
  `) as any[];

  // Zum Vergleich: der ganze Kreis.
  const [alle] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS personen,
           COUNT(DISTINCT p.id) FILTER (WHERE p.wartet_auf IS NOT NULL)::int AS schon_wartend,
           COUNT(DISTINCT p.id) FILTER (WHERE p.follow_up_date IS NULL
             OR p.follow_up_date <= CURRENT_DATE)::int AS in_tagesliste
    FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE c.note ILIKE '%number_update%' OR c.type ILIKE '%number_update%'
  `) as any[];
  zahl("Personen mit einer Nummern-Anfrage", alle.personen);
  zahl("… schon im Wartezustand", alle.schon_wartend, "die lässt der Lauf in Ruhe");
  zahl("… heute in der Tagesliste", alle.in_tagesliste,
    "hier kann der Agent nichts tun als überblättern");
  log("");
  zahl("DIESER LAUF FASST AN", zeilen.length);

  log("\n  IM EINZELNEN:");
  for (const z of zeilen) {
    log(`    ${String(z.ref).padEnd(22)} ${String(z.name ?? "").padEnd(24)} `
      + `Person ${String(z.person_id).padEnd(6)} `
      + `Anfrage ${String(z.anfrage_am ?? "").slice(0, 10)} · ${z.payment_status}`);
  }

  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/lauf-warten-bestand.csv",
    `ref;name;person_id;anfrage_am;zahlung;wirkung\n${zeilen.map((z) =>
      [z.ref, z.name, z.person_id, String(z.anfrage_am ?? "").slice(0, 10), z.payment_status,
       `Wartezustand nummer, ${WARTE_TAGE} Tage, KEINE Mail`].join(";")).join("\n")}\n`, "utf8");
  log("\n  CSV: reports/lauf-warten-bestand.csv");

  if (!SCHREIBEN) {
    log("\n  ─────────────────────────────────────────────────────────────────");
    log(`  Das war die VORSCHAU. ${zeilen.length} Personen kommen für ${WARTE_TAGE} Tage`);
    log("  aus der Tagesliste — und von selbst zurück (Antwort oder Ablauf).");
    log("  Es wird KEINE Mail verschickt: Die Anfrage ist längst raus.");
    log("  Wenn das stimmt:  npx tsx scripts/warten-bestand.ts --schreiben");
    log("");
    await sqlPool.end();
    return;
  }

  // ═════════════════════════════════════════════════════════════════════════
  titel("SETZEN");
  // ═════════════════════════════════════════════════════════════════════════
  let gesetzt = 0;
  for (const z of zeilen) {
    const { bis } = await wartenAufKunde(Number(z.person_id), "nummer");
    gesetzt++;
    // Jede Bestandsänderung braucht eine Spur — und zwar eine, die den GRUND
    // nennt, damit in einem halben Jahr niemand rätselt.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${z.ref}, NULL, 'System', 'system',
              ${`Wartezustand nachgetragen (Nummer, bis ${bis}). Die Nummern-Anfrage `
                + `ging am ${String(z.anfrage_am ?? "").slice(0, 10)} raus, der Wartezustand `
                + `wurde damals noch nicht gesetzt (er existiert erst seit 16.08.2026). `
                + `Es wurde KEINE neue Mail verschickt.`})
    `.catch(() => {});
    log(`    ${String(z.name ?? "").padEnd(24)} → wartet bis ${bis}`);
  }
  zahl("Gesetzt", gesetzt);

  // ═════════════════════════════════════════════════════════════════════════
  titel("DIE ZÄHLPROBE — steht noch jemand in der Tagesliste?");
  // ═════════════════════════════════════════════════════════════════════════
  const [nach] = (await sqlPool`
    SELECT COUNT(DISTINCT p.id)::int AS n
    FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE (c.note ILIKE '%number_update%' OR c.type ILIKE '%number_update%')
      AND p.wartet_auf IS NULL
      AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
  `) as any[];
  zahl("Nummern-Anfragen ohne Wartezustand in der Tagesliste", nach.n,
    Number(nach.n) === 0 ? "richtig — die Tagesliste ist frei davon" : "FEHLER");
  if (Number(nach.n) > 0) process.exitCode = 1;

  const [wartend] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_persons
    WHERE merged_into_person_id IS NULL AND wartet_auf IS NOT NULL
  `) as any[];
  zahl("Personen im Wartezustand insgesamt", wartend.n,
    "sichtbar unter dem Filter „Wartend“, nicht verschwunden");

  log("");
  await sqlPool.end();
}

main().catch(async (e) => {
  console.error(e);
  await sqlPool.end().catch(() => {});
  process.exit(1);
});
