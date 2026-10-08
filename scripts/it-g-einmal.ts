// ═══════════════════════════════════════════════════════════════════════════
// GEBURTSDATUM: EINMAL-LAUF NACH DEM DEPLOY — E-IT-G (08.10.2026), Punkt (14)
//
// Was der Code seit E-IT-G dauerhaft regelt (shared/fiaon-geburtsdatum.ts,
// server/lib/fiaon-geburtsdatum-akte.ts, Migration 103), hat einen Altbestand,
// den nur ein Mensch oder ein einmaliger Lauf ordnet:
//
//   A  DIE WAND (Migration 103): Gibt es Werte, die nicht JJJJ-MM-TT sind oder
//      keinen echten Kalendertag haben? Stehen die Bedingungen, sind sie
//      geprüft (convalidated)? — nur Bericht.
//   B  ZWEI GEBURTSDATEN FÜR EINEN MENSCHEN (gemessen 07.10.: 15): KEINE
//      automatische Korrektur. Die Akte zeigt seit E-IT-G den Hinweis
//      „Geburtsdatum weicht ab“ mit Übernehmen-Knöpfen — hier nur die Liste
//      (CSV), damit jemand sie laut Ausweis abarbeitet.
//   C  LÜCKEN, NIE ÜBERSCHREIBEN (mit --ausfuehren):
//      C1 Bestellung ohne Geburtsdatum, die Person trägt GENAU EINES → an die
//         Bestellung (Chef-Akte, Konto & Karte, Auskunft-Bestellung lesen die
//         Bestellung zuerst; gemessen 07.10.: 176 Datensätze nur an der Person).
//      C2 Person ohne Geburtsdatum, ihre lebenden Bestellungen tragen GENAU
//         EINES → an die Person.
//      Nur Werte, die der Leser ohne Rückfrage annimmt (Kontext „akte“: 18 bis
//      94 Jahre). Alles andere bleibt für den Menschen (Liste B/„prüfen“).
//   D  KÜNDIGUNGSSEITE: Wie viele bezahlte Bestellungen wären vorher am
//      Geburtsdatum gescheitert, und wie viele werden jetzt über Name + E-Mail
//      angenommen (Team prüft)? — nur Bericht.
//
//   DATABASE_URL=… npx tsx scripts/it-g-einmal.ts               # Trockenlauf (Standard)
//   DATABASE_URL=… npx tsx scripts/it-g-einmal.ts --ausfuehren  # C schreiben, mit Sicherung
//   DATABASE_URL=… npx tsx scripts/it-g-einmal.ts --rueckweg    # nur das Rückweg-SQL zeigen
//
// Sicherung: Tabelle it_g_geburt_sicherung (je geänderter Zeile alt/neu). Der
// Rückweg setzt NUR zurück, was seit dem Lauf unverändert geblieben ist.
// Verbindung mit statement_timeout 60 s, lock_timeout 5 s (E-254).
// Ausgabe ohne Geburtsdaten (nur Nummern); die CSV in reports/ (gitignored)
// trägt die Werte für die Prüfung laut Ausweis.
// ═══════════════════════════════════════════════════════════════════════════
import postgres from "postgres";
import { mkdirSync, writeFileSync } from "node:fs";
import { geburtsdatumIso, geburtsdatumLesen } from "../shared/fiaon-geburtsdatum";
import { vollerNamePasst } from "../server/lib/fiaon-kuendigung-identitaet";

const AUSFUEHREN = process.argv.includes("--ausfuehren");
const NUR_RUECKWEG = process.argv.includes("--rueckweg");
const SICHERUNG = "it_g_geburt_sicherung";
const log = (s = "") => console.log(s);
const titel = (t: string) => log(`\n${"═".repeat(74)}\n${t}\n${"═".repeat(74)}`);
const MUSTER = "^(19|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$";

const RUECKWEG_SQL = `-- Rückweg E-IT-G Einmal-Lauf (setzt nur zurück, was seitdem unverändert blieb)
BEGIN;
UPDATE fiaon_applications a SET birthdate = NULL
  FROM ${SICHERUNG} s
 WHERE s.tabelle = 'fiaon_applications' AND s.schluessel = a.ref AND s.alt IS NULL AND a.birthdate = s.neu;
UPDATE fiaon_persons p SET birthdate = NULL
  FROM ${SICHERUNG} s
 WHERE s.tabelle = 'fiaon_persons' AND s.schluessel = p.id::text AND s.alt IS NULL AND p.birthdate = s.neu;
UPDATE fiaon_contact_log SET voided_at = NOW()
 WHERE type = 'system' AND voided_at IS NULL AND note LIKE 'Geburtsdatum aus % übernommen (E-IT-G%';
COMMIT;
-- Nur falls die Wand selbst zurück muss (Migration 103):
-- ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_app_geburt_iso;
-- ALTER TABLE fiaon_persons DROP CONSTRAINT IF EXISTS fiaon_person_geburt_iso;
-- ALTER TABLE fiaon_agents DROP CONSTRAINT IF EXISTS fiaon_agent_geburt_ab_1900;
`;

function csvFeld(w: unknown): string {
  const s = w == null ? "" : String(w);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type Mensch = { personId: number; person: string | null; personRoh: string | null; vor: string | null; nach: string | null; bestellungen: { ref: string; iso: string | null; roh: string | null; namePasst: boolean }[] };
const werteVon = (m: Mensch) => new Set([m.person, ...m.bestellungen.map((b) => b.iso)].filter(Boolean) as string[]);
const ohneRueckfrage = (iso: string) => geburtsdatumLesen(iso, "akte").stand === "ok";

/**
 * Teil C als reine Rechnung (Prüfstand: scripts/pruef-it-g.ts). Gefüllt wird
 * nur eine LÜCKE, und nur mit einem Datum, das der Mensch selbst trägt: an der
 * Person oder an einer Bestellung mit SEINEM Namen. Gegenprüfung 08.10.: Stand
 * das eine Datum nur an der Bestellung eines anderen Namens (Partnerin mit
 * gemeinsamer E-Mail), hätte C1 es sonst an seine eigene leere Bestellung
 * geschrieben.
 */
export function lueckenPlanen(menschen: Mensch[]): {
  c1: { ref: string; personId: number; neu: string }[];
  c2: { personId: number; neu: string }[];
  vonHand: { personId: number; grund: string }[];
} {
  const c1: { ref: string; personId: number; neu: string }[] = [];
  const c2: { personId: number; neu: string }[] = [];
  const vonHand: { personId: number; grund: string }[] = [];
  for (const m of menschen) {
    const werte = werteVon(m);
    if (werte.size !== 1) continue;
    const [wert] = Array.from(werte);
    if (!ohneRueckfrage(wert)) { vonHand.push({ personId: m.personId, grund: "unplausibel (Rückfrage nötig)" }); continue; }
    const eigenBelegt = m.person === wert || m.bestellungen.some((b) => b.namePasst && b.iso === wert);
    if (!eigenBelegt) { vonHand.push({ personId: m.personId, grund: "Datum nur an einer Bestellung mit anderem Namen — zwei Menschen? (nichts gefüllt)" }); continue; }
    // C2 nur, wenn jede Bestellung mit Datum denselben Namen wie die Person trägt.
    if (!m.person && !m.personRoh) {
      if (m.bestellungen.filter((b) => b.iso).every((b) => b.namePasst)) c2.push({ personId: m.personId, neu: wert });
      else vonHand.push({ personId: m.personId, grund: "anderer Name an einer Bestellung — zwei Menschen? (Person bleibt leer)" });
    }
    for (const b of m.bestellungen) {
      if (b.iso || b.roh) continue;
      if (b.namePasst) c1.push({ ref: b.ref, personId: m.personId, neu: wert });
      else vonHand.push({ personId: m.personId, grund: `anderer Name an ${b.ref} — zwei Menschen? (Bestellung bleibt leer)` });
    }
  }
  return { c1, c2, vonHand };
}

async function main(): Promise<void> {
  if (NUR_RUECKWEG) { log(RUECKWEG_SQL); return; }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL fehlt."); process.exitCode = 1; return; }
  const sql = postgres(url, {
    ssl: /sslmode=disable/.test(url) ? false : "require", max: 1, onnotice: () => {},
    connection: { statement_timeout: 60000, lock_timeout: 5000, idle_in_transaction_session_timeout: 60000, application_name: "it-g-einmal" },
  });
  try {
    log(`E-IT-G Einmal-Lauf Geburtsdatum — ${AUSFUEHREN ? "AUSFÜHREN" : "Trockenlauf"} — Ziel ${url.replace(/\/\/[^@]*@/, "//…@")}`);

    // ── A: DIE WAND ────────────────────────────────────────────────────────
    titel("A  Wand (Migration 103)");
    const [a] = (await sql.unsafe(`
      SELECT
        (SELECT COUNT(*) FROM fiaon_applications WHERE birthdate IS NOT NULL AND birthdate !~ '${MUSTER}')::int AS app_muster,
        (SELECT COUNT(*) FROM fiaon_applications WHERE birthdate ~ '${MUSTER}' AND to_char(to_date(birthdate,'YYYY-MM-DD'),'YYYY-MM-DD') <> birthdate)::int AS app_kalender,
        (SELECT COUNT(*) FROM fiaon_persons WHERE birthdate IS NOT NULL AND birthdate !~ '${MUSTER}')::int AS person_muster,
        (SELECT COUNT(*) FROM fiaon_persons WHERE birthdate ~ '${MUSTER}' AND to_char(to_date(birthdate,'YYYY-MM-DD'),'YYYY-MM-DD') <> birthdate)::int AS person_kalender,
        (SELECT COUNT(*) FROM fiaon_agents WHERE birth_date < DATE '1900-01-01')::int AS agent_vor_1900
    `)) as any[];
    const bedingungen = (await sql`
      SELECT conname, convalidated FROM pg_constraint
       WHERE conname IN ('fiaon_app_geburt_iso', 'fiaon_person_geburt_iso', 'fiaon_agent_geburt_ab_1900') ORDER BY conname
    `) as any[];
    log(`  Bestellungen: ${a.app_muster} nicht JJJJ-MM-TT, ${a.app_kalender} falscher Kalendertag`);
    log(`  Personen:     ${a.person_muster} nicht JJJJ-MM-TT, ${a.person_kalender} falscher Kalendertag`);
    log(`  Mitarbeiter:  ${a.agent_vor_1900} vor 1900`);
    log(`  Bedingungen:  ${bedingungen.length ? bedingungen.map((b) => `${b.conname}${b.convalidated ? " (geprüft)" : " (NICHT geprüft)"}`).join(", ") : "keine — Migration 103 lief noch nicht"}`);
    const wandOffen = a.app_muster + a.app_kalender + a.person_muster + a.person_kalender + a.agent_vor_1900;
    if (wandOffen) log(`  ACHTUNG: ${wandOffen} Verstöße — sie blockieren nichts (Migration 103 meldet sie nur), aber die Bedingung bleibt NOT VALID, bis sie von Hand (laut Ausweis) behoben sind.`);
    // Gegenprüfung 08.10.: VALIDATE in 103 ist nicht mehr tödlich — ungeprüfte Bedingungen hier nachholen.
    const tabelleZu: Record<string, string> = { fiaon_app_geburt_iso: "fiaon_applications", fiaon_person_geburt_iso: "fiaon_persons", fiaon_agent_geburt_ab_1900: "fiaon_agents" };
    for (const b of bedingungen.filter((x) => !x.convalidated)) {
      log(`  Nachholen, sobald 0 Verstöße: ALTER TABLE ${tabelleZu[b.conname]} VALIDATE CONSTRAINT ${b.conname};`);
    }

    // ── B/C: ALLE WERTE JE MENSCH ──────────────────────────────────────────
    const zeilen = (await sql`
      SELECT p.id AS person_id, p.birthdate AS person_geb, p.first_name AS p_vor, p.last_name AS p_nach,
             a.ref, a.birthdate AS app_geb, a.payment_status, a.first_name AS a_vor, a.last_name AS a_nach
        FROM fiaon_persons p
        JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
       WHERE p.merged_into_person_id IS NULL
         -- Alle lebenden Bestellungen jedes Menschen, der IRGENDWO ein Geburtsdatum trägt (auch die leeren — die sind die Lücke).
         AND (p.birthdate IS NOT NULL OR EXISTS (SELECT 1 FROM fiaon_applications x
               WHERE x.person_id = p.id AND x.merged_into IS NULL AND x.birthdate IS NOT NULL))
       ORDER BY p.id, a.created_at
    `) as any[];
    // Gegenprüfung 08.10.: Eine Person kann zwei Menschen tragen (gemeinsame E-Mail/Telefon, 17 Personen mit
    // verschiedenen Vornamen). Gefüllt wird darum nur, wo der Name der Bestellung zur Person passt.
    const menschen = new Map<number, Mensch>();
    for (const z of zeilen) {
      const id = Number(z.person_id);
      const m = menschen.get(id) ?? { personId: id, person: geburtsdatumIso(z.person_geb), personRoh: z.person_geb ?? null, vor: z.p_vor ?? null, nach: z.p_nach ?? null, bestellungen: [] };
      const namePasst = !m.vor && !m.nach ? true : vollerNamePasst({ first_name: m.vor, last_name: m.nach }, { firstName: z.a_vor, lastName: z.a_nach });
      m.bestellungen.push({ ref: String(z.ref), iso: geburtsdatumIso(z.app_geb), roh: z.app_geb ?? null, namePasst });
      menschen.set(id, m);
    }

    const abweichend = Array.from(menschen.values()).filter((m) => werteVon(m).size > 1);
    titel("B  Zwei Geburtsdaten für einen Menschen — von Hand laut Ausweis (Akte: „Geburtsdatum weicht ab“)");
    log(`  ${abweichend.length} Menschen. Personen-Nummern: ${abweichend.slice(0, 40).map((m) => m.personId).join(", ")}${abweichend.length > 40 ? " …" : ""}`);

    const { c1, c2, vonHand } = lueckenPlanen(Array.from(menschen.values()));
    titel("C  Lücken füllen (nie überschreiben)");
    log(`  C1  ${c1.length} Bestellungen ohne Geburtsdatum bekommen das eine Datum ihres Menschen`);
    log(`  C2  ${c2.length} Personen ohne Geburtsdatum bekommen das ihrer Bestellungen`);
    log(`      ${vonHand.length} Fälle bleiben unberührt (unplausibler Wert oder anderer Name an der Person — siehe CSV „prüfen“)`);

    // ── D: KÜNDIGUNGSSEITE ──────────────────────────────────────────────────
    titel("D  Kündigungsseite /abo-kuendigen");
    const [d] = (await sql`
      SELECT COUNT(*) FILTER (WHERE a.birthdate IS NULL)::int AS ohne_an_bestellung,
             COUNT(*) FILTER (WHERE a.birthdate IS NULL AND p.birthdate IS NOT NULL)::int AS person_hat_es,
             COUNT(*) FILTER (WHERE a.birthdate IS NULL AND p.birthdate IS NULL)::int AS nirgends,
             COUNT(*)::int AS bezahlt
        FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
    `) as any[];
    log(`  ${d.bezahlt} bezahlte Bestellungen; ${d.ohne_an_bestellung} ohne Geburtsdatum an der Bestellung`);
    log(`  davon ${d.person_hat_es} jetzt über die Person erkannt, ${d.nirgends} ohne jedes Geburtsdatum → Annahme über Name + E-Mail, Team prüft`);

    // ── CSV (gitignored) ─────────────────────────────────────────────────────
    mkdirSync("reports", { recursive: true });
    const csv = [
      ["teil", "person_id", "ref", "person_geburtsdatum", "bestellung_geburtsdatum", "neu", "grund"],
      ...abweichend.flatMap((m) => m.bestellungen.map((b) => ["B", m.personId, b.ref, m.person ?? m.personRoh ?? "", b.iso ?? b.roh ?? "", "", "weicht ab — laut Ausweis wählen"])),
      ...c1.map((x) => ["C1", x.personId, x.ref, "", "", x.neu, "Lücke an der Bestellung"]),
      ...c2.map((x) => ["C2", x.personId, "", "", x.neu, x.neu, "Lücke an der Person"]),
      ...vonHand.map((x) => ["prüfen", x.personId, "", "", "", "", x.grund]),
    ];
    const datei = `reports/it-g-geburtsdatum-${new Date().toISOString().slice(0, 10)}.csv`;
    writeFileSync(datei, "﻿" + csv.map((r) => r.map(csvFeld).join(";")).join("\n"));
    log(`\n  Vorschau: ${datei} (${csv.length - 1} Zeilen, mit Geburtsdaten — nicht weitergeben)`);

    if (!AUSFUEHREN) {
      log("\nTrockenlauf — nichts geschrieben. Schreiben mit --ausfuehren; Rückweg mit --rueckweg.");
      return;
    }

    // ── SCHREIBEN: eine Transaktion, je Einheit genau ───────────────────────
    titel("Schreiben");
    const erg = await sql.begin(async (tx: any) => {
      await tx.unsafe(`CREATE TABLE IF NOT EXISTS ${SICHERUNG} (
        id SERIAL PRIMARY KEY, tabelle TEXT NOT NULL, schluessel TEXT NOT NULL,
        alt TEXT, neu TEXT, lauf_am TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      let n1 = 0, n2 = 0;
      for (const x of c1) {
        const r = (await tx`
          UPDATE fiaon_applications SET birthdate = ${x.neu}
           WHERE ref = ${x.ref} AND merged_into IS NULL AND birthdate IS NULL
          RETURNING ref`) as any[];
        if (r.length !== 1) continue; // inzwischen gefüllt — nichts tun
        n1++;
        await tx`INSERT INTO ${tx(SICHERUNG)} (tabelle, schluessel, alt, neu) VALUES ('fiaon_applications', ${x.ref}, NULL, ${x.neu})`;
        await tx`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
                 VALUES (${x.ref}, NULL, 'System', 'system', 'Geburtsdatum aus der Akte übernommen (E-IT-G Einmal-Lauf: Lücke an der Bestellung, nichts überschrieben)')`;
      }
      for (const x of c2) {
        const r = (await tx`
          UPDATE fiaon_persons SET birthdate = ${x.neu}, updated_at = NOW()
           WHERE id = ${x.personId} AND merged_into_person_id IS NULL AND birthdate IS NULL
          RETURNING id`) as any[];
        if (r.length !== 1) continue;
        n2++;
        await tx`INSERT INTO ${tx(SICHERUNG)} (tabelle, schluessel, alt, neu) VALUES ('fiaon_persons', ${String(x.personId)}, NULL, ${x.neu})`;
        const [ziel] = (await tx`SELECT ref FROM fiaon_applications WHERE person_id = ${x.personId} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`) as any[];
        if (ziel) {
          await tx`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
                   VALUES (${ziel.ref}, NULL, 'System', 'system', 'Geburtsdatum aus der Bestellung übernommen (E-IT-G Einmal-Lauf: Lücke an der Person, nichts überschrieben)')`;
        }
      }
      return { n1, n2 };
    });
    log(`  C1: ${erg.n1} von ${c1.length} Bestellungen gefüllt`);
    log(`  C2: ${erg.n2} von ${c2.length} Personen gefüllt`);
    log(`  Sicherung: ${SICHERUNG}. Rückweg:\n`);
    log(RUECKWEG_SQL);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Nur als Skript starten — der Prüfstand lädt lueckenPlanen ohne Datenbank.
if (/it-g-einmal\.ts$/.test(process.argv[1] ?? "")) {
  main().catch((e) => { console.error("FEHLER:", e?.message || e); process.exitCode = 1; });
}
