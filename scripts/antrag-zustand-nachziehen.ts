// ═══════════════════════════════════════════════════════════════════════════
// DEN ZUSTAND AUS DEM INHALT NACHZIEHEN
//
// ── WARUM DIESER LAUF NÖTIG IST ────────────────────────────────────────────
// `client/src/pages/antrag.tsx` schrieb bei Schritt 9 den Zustand „started" —
// den ERSTEN Schritt (Begründung in `shared/fiaon-antrag-schritte.ts`). Der
// Schreibfehler ist behoben; der Bestand ist damit nicht aufgeräumt.
//
// GEMESSEN am 19.08.2026: 25 Anträge tragen JEDES Pflichtfeld und stehen
// trotzdem auf einem Formularschritt. Ihre Agenten werden aufgefordert
// anzurufen und „beim Fertigstellen zu helfen" — bei Kunden, die nur auf ihre
// Rechnung warten.
//
// ── WAS DER LAUF TUT ───────────────────────────────────────────────────────
// Er setzt den Zustand auf `submitted` — den Wert, den `RECHNUNGSREIF` kennt und
// den `shared/fiaon-antrag-schritte.ts` für einen abgeschickten Antrag vorsieht.
// Nicht auf `completed`: Das würde behaupten, wir hätten den Antrag geprüft.
//
// ── WELCHE ER NICHT ANFASST ────────────────────────────────────────────────
//   · Anträge, denen ein Pflichtfeld fehlt (450 von 475) — dort ist der
//     Zustand RICHTIG, und die Karte benennt jetzt, was fehlt.
//   · Bezahlte, archivierte, zusammengeführte, DSGVO-gelöschte Zeilen.
//   · Anträge, deren Zustand schon rechnungsreif ist.
//
// Kein Hard-Delete, kein Überschreiben eines weiter FORTGESCHRITTENEN Zustands
// (AGENTS.md). Vorschau ohne Argument, geschrieben nur mit `--schreiben`.
//
//   npx tsx scripts/antrag-zustand-nachziehen.ts              # Vorschau
//   npx tsx scripts/antrag-zustand-nachziehen.ts --schreiben  # anwenden
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import {
  FORMULAR_SCHRITTE_SQL, antragVollstaendigSql, fehlendeFelder,
} from "../server/lib/fiaon-antrag-vollstaendig";

const SCHREIBEN = process.argv.includes("--schreiben");
const log = (s = "") => console.log(s);

/** Der Zustand, den ein inhaltlich fertiger Antrag bekommt. */
const ZIEL = "submitted";

async function main(): Promise<void> {
  log(`\n${"═".repeat(74)}`);
  log(`ZUSTAND AUS DEM INHALT NACHZIEHEN — ${SCHREIBEN ? "SCHREIBEND" : "VORSCHAU"}`);
  log("═".repeat(74));

  // Die Auswahl benutzt die SQL-Fassung der Regel; die Bewertung darunter die
  // TypeScript-Fassung. Weichen sie ab, fällt es HIER auf (die Zählprobe unten
  // vergleicht beide) und nicht erst beim nächsten Agenten.
  const treffer = (await sqlPool.unsafe(`
    SELECT a.ref, a.person_id, a.type, a.status, a.current_step, a.payment_status,
           a.billing_method, a.created_at, a.updated_at,
           a.first_name, a.last_name, a.birthdate, a.phone, a.street, a.zip, a.city,
           a.country, a.nationality, a.employment, a.employed_since, a.housing,
           a.purpose, a.email, a.salary_receipt_day, a.iban,
           a.consent_agb, a.consent_schufa, a.consent_contract,
           a.company_name, a.contact_name, a.contact_email, a.contact_phone,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS name,
           ag.name AS agent_name
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
     WHERE a.merged_into IS NULL
       AND a.archived_at IS NULL
       AND a.gdpr_deleted_at IS NULL
       AND a.payment_status NOT IN ('paid', 'refunded')
       AND a.status IN (${FORMULAR_SCHRITTE_SQL})
       AND ${antragVollstaendigSql("a")}
     ORDER BY a.updated_at DESC NULLS LAST
  `)) as any[];

  log(`\n  ${treffer.length} Anträge stehen auf einem Formularschritt und sind inhaltlich FERTIG.`);

  // ── ZÄHLPROBE: TYPESCRIPT GEGEN SQL ─────────────────────────────────────
  // AGENTS.md: Zwei Fassungen derselben Regel sind nur zulässig, wenn etwas sie
  // gegeneinander hält. Hier ist die Stelle, an der es zählt — ein Lauf, der
  // nach einer falschen Regel schreibt, ist schlimmer als keiner.
  const uneinig = treffer.filter((t) => fehlendeFelder(t).length > 0);
  if (uneinig.length > 0) {
    log(`\n  ABBRUCH: Bei ${uneinig.length} Zeilen sagt die SQL-Fassung „vollständig"`);
    log("  und die TypeScript-Fassung nicht. Die Regel ist uneinig — es wird nichts");
    log("  geschrieben. Betroffen:");
    for (const u of uneinig.slice(0, 10)) {
      log(`    ${u.ref}: fehlt laut TypeScript ${fehlendeFelder(u).join(", ")}`);
    }
    await sqlPool.end();
    process.exit(1);
  }
  log("  Zählprobe: SQL- und TypeScript-Fassung stimmen bei allen Treffern überein.");

  log("\n  Referenz             Zustand         Schritt  Betreuer            Kunde");
  log("  " + "─".repeat(88));
  for (const t of treffer) {
    log(`  ${String(t.ref).padEnd(20)} ${String(t.status).padEnd(15)} `
      + `${String(t.current_step ?? "-").padEnd(8)} `
      + `${String(t.agent_name ?? "(niemand)").padEnd(19)} ${t.name}`);
  }

  mkdirSync("reports", { recursive: true });
  const csv = "\uFEFF" + ["ref;person_id;name;agent;alter_zustand;schritt;neuer_zustand"]
    .concat(treffer.map((t) => [
      t.ref, t.person_id ?? "", t.name, t.agent_name ?? "", t.status,
      t.current_step ?? "", ZIEL,
    ].join(";"))).join("\n");
  writeFileSync("reports/antrag-zustand-nachziehen.csv", csv);
  log(`\n  → reports/antrag-zustand-nachziehen.csv (${treffer.length} Zeilen)`);

  if (!SCHREIBEN) {
    log("\n  Das ist die VORSCHAU. Es wurde nichts geändert.");
    log("  Anwenden mit: npx tsx scripts/antrag-zustand-nachziehen.ts --schreiben");
    await sqlPool.end();
    return;
  }

  let geschrieben = 0;
  for (const t of treffer) {
    // Die Bedingung steht NOCH EINMAL im UPDATE: Zwischen Auswahl und Schreiben
    // liegt Zeit, und in dieser Zeit arbeitet der Betrieb weiter. Ein Antrag,
    // der inzwischen bezahlt oder weitergerückt ist, wird nicht zurückgesetzt.
    const erg = await sqlPool`
      UPDATE fiaon_applications
         SET status = ${ZIEL}, updated_at = NOW()
       WHERE ref = ${t.ref}
         AND status = ${t.status}
         AND payment_status NOT IN ('paid', 'refunded')
         AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL
    `;
    if ((erg as any).count > 0) {
      geschrieben++;
      if (t.person_id) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
          VALUES (${t.ref}, ${t.person_id}, NULL, 'System', 'system',
                  ${`Antragszustand nachgezogen: „${t.status}" → „${ZIEL}". `
                    + "Alle Pflichtfelder waren vorhanden; der Zustand war durch einen "
                    + "verlorenen Formularschritt zurückgefallen."}, NOW())
        `.catch((e) => console.error(`[NACHZIEHEN] Verlaufseintrag ${t.ref}:`, e));
      }
    }
  }
  log(`\n  ${geschrieben} von ${treffer.length} Anträgen nachgezogen.`);
  if (geschrieben < treffer.length) {
    log(`  ${treffer.length - geschrieben} haben sich zwischenzeitlich geändert — richtig so.`);
  }

  // ── DER ZWEITE TERMIN ───────────────────────────────────────────────────
  // AGENTS.md: „Ein Bestandslauf braucht einen zweiten Termin. Zwischen Commit
  // und Deploy schreibt die alte Fassung weiter."
  log("\n  BETREIBER-TODO: Bis die neue Fassung von antrag.tsx ausgeliefert ist,");
  log("  erzeugt das Formular weiter Anträge mit zurückgefallenem Zustand. Diesen");
  log("  Lauf nach dem Deploy ein zweites Mal aufrufen.");

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
