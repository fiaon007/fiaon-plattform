// ═══════════════════════════════════════════════════════════════════════════
// „FIAON PRO 10 €" — WO KOMMT DER BETRAG HER?
//
// ── DIE MELDUNG (Daniel Stripling, 20.08.2026, 12:19) ──────────────────────
// Ein Kunde mit „FIAON Pro" und 10,00 €.
//
// ── NUR LESEND. ES WIRD NICHTS KORRIGIERT — UND ZWAR MIT GRUND ────────────
// Der Auftrag sagt: „Bei Bestellung im Bestand: auf Katalogpreis korrigieren."
// Das wird hier NICHT getan, weil die Messung etwas anderes zeigt als erwartet:
// Alle vier abweichenden Bestellungen sind BEZAHLT.
//
// `amount_due` einer bezahlten Bestellung von 10 € auf 59,99 € zu setzen ist
// keine Korrektur eines Anzeigefehlers — es ist die Behauptung, es seien 59,99 €
// geflossen. Was tatsächlich floss, steht in keiner Tabelle dieses Systems
// (es gibt keine Zahlungstabelle mit Betrag; die Provision wurde auf 10,00 €
// Bemessungsgrundlage gebucht). Ein Skript, das hier schreibt, erfindet eine
// Zahlung oder eine Forderung — beides gehört dem Betreiber entschieden, nicht
// einem Automatismus.
//
// Der Lauf liefert deshalb die VORSCHAU und benennt je Zeile, was zu klären ist.
//
//   npx tsx scripts/mess-preis-abweichung.ts
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";
import { katalogpreisCents } from "../server/lib/fiaon-massgebliche-bestellung";

const log = (s = "") => console.log(s);
const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";

async function main(): Promise<void> {
  log("\n══ Bestellungen mit abweichendem Betrag ══\n");

  const alle = (await sqlPool`
    SELECT a.id, a.ref, a.pack_key, a.pack_name, a.type, a.amount_due,
           a.payment_status, a.status, a.created_at, a.person_id,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, 'Ohne Namen') AS kunde
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND a.amount_due IS NOT NULL
     ORDER BY a.created_at DESC
  `) as any[];

  // ── DIE FUNKTION BRAUCHT `pack_key`, NICHT `pack_name` ──────────────────
  // Ein erster Entwurf uebergab `String(x.pack_name)`. `katalogpreisCents` liest
  // aber `zeile.pack_key` und gab deshalb fuer JEDE Bestellung `null` zurueck —
  // der Lauf meldete „0 Abweichungen" und haette den gemeldeten Fall verdeckt.
  // Ein Messfehler, der genau das Gegenteil des Befunds behauptet.
  let mitPreis = 0;
  const ab: any[] = [];
  for (const x of alle) {
    const soll = katalogpreisCents(x);
    if (soll == null) continue;
    mitPreis++;
    const ist = Math.round(Number(x.amount_due) * 100);
    if (ist !== soll) ab.push({ ...x, ist, soll });
  }

  log(`  ${alle.length} lebende Bestellungen mit Betrag`);
  log(`  ${mitPreis} davon haben einen Katalogpreis (${alle.length - mitPreis} ohne — `
    + `eigene Positionen, Altbestand)`);
  log(`  ${ab.length} weichen ab\n`);

  if (ab.length > 0) {
    log("  Referenz               Paket      ist        soll       Zahlung   Kunde");
    log("  " + "─".repeat(88));
    for (const x of ab) {
      log(`  ${String(x.ref).padEnd(22)} ${String(x.pack_key).padEnd(10)} `
        + `${eur(x.ist).padStart(10)} ${eur(x.soll).padStart(10)} `
        + `${String(x.payment_status).padEnd(9)} ${String(x.kunde).slice(0, 24)}`);
    }
    const bezahlt = ab.filter((x) => String(x.payment_status) === "paid").length;
    log(`\n  Davon BEZAHLT: ${bezahlt} von ${ab.length}.`);

    // Was hängt an den abweichenden Bestellungen?
    log("\n  Was daran hängt:");
    for (const x of ab) {
      const prov = (await sqlPool`
        SELECT amount_cents, base_amount_cents, rate_bp, status FROM fiaon_commissions
         WHERE payment_reference = ${x.ref} OR ref = ${x.ref}
      `) as any[];
      const summe = prov.reduce((s, p) => s + Number(p.amount_cents || 0), 0);
      log(`    ${String(x.ref).padEnd(22)} ${prov.length} Provision(en)`
        + (prov.length
          ? ` über ${eur(summe)} · Bemessungsgrundlage ${eur(Number(prov[0].base_amount_cents || 0))}`
          : ""));
    }

    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/preis-abweichung.csv", "\uFEFF"
      + ["ref;paket;ist_eur;soll_eur;differenz_eur;zahlung;status;kunde;angelegt;zu_klaeren"]
        .concat(ab.map((x) => [
          x.ref, x.pack_key, (x.ist / 100).toFixed(2), (x.soll / 100).toFixed(2),
          ((x.soll - x.ist) / 100).toFixed(2), x.payment_status, x.status, x.kunde,
          new Date(x.created_at).toISOString().slice(0, 10),
          String(x.payment_status) === "paid"
            ? "BEZAHLT — wurde der Katalogpreis oder dieser Betrag ueberwiesen?"
            : "offen — Betrag korrigierbar",
        ].join(";"))).join("\n"));
    log(`\n  → reports/preis-abweichung.csv`);
  }

  // ═════════════════════════════════════════════════════════════════════════
  log("\n── WARUM DIE WAND AUS MIGRATION 065 NICHT GRIFF ────────────────────");
  // ═════════════════════════════════════════════════════════════════════════
  const [m] = (await sqlPool`
    SELECT filename, applied_at FROM schema_migrations WHERE filename LIKE '065%'
  `.catch(() => [] as any[])) as any[];
  log(`  Die Wand wurde angewendet am: ${m ? new Date(m.applied_at)
    .toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "(unbekannt)"}`);
  for (const x of ab) {
    log(`  ${String(x.ref).padEnd(22)} angelegt ${new Date(x.created_at)
      .toLocaleDateString("de-DE")} — ${m && new Date(x.created_at) < new Date(m.applied_at)
      ? "VOR der Wand" : "nach der Wand"}`);
  }
  log("");
  log("  ZWEITER GRUND, und der wichtigere: Die Wand hat einen ausdrücklichen");
  log("  Freibrief für bezahlte Bestellungen —");
  log("      IF COALESCE(NEW.payment_status, '') = 'paid' THEN RETURN NEW; END IF;");
  log("  Das ist ABSICHT und richtig: Bei einer bezahlten Bestellung ist der");
  log("  Betrag eine Tatsache (das Geld ist geflossen), keine Sollgröße. Eine");
  log("  Wand, die dort eingreift, würde Buchhaltung verändern.");
  log("");
  log("  Beide abweichenden Fälle sind also nicht durch die Wand gerutscht —");
  log("  sie liegen außerhalb ihres Zwecks. Für UNBEZAHLTE Bestellungen greift");
  log(`  sie: gemessen ${ab.filter((x) => String(x.payment_status) !== "paid").length} `
    + "unbezahlte Abweichung(en) im ganzen Bestand.");

  await sqlPool.end();
}

main().catch(async (e) => { console.error(e); await sqlPool.end(); process.exit(1); });
