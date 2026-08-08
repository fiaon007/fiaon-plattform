// ═══════════════════════════════════════════════════════════════════════════
// VERWENDUNGSZWECK-BACKFILL — jede Bestellung bekommt ihre Referenz
//
// Der Verwendungszweck ist das einzige, was einen Bankeingang mit einem Menschen
// verbindet. 5 754 Bestellungen im Bestand hatten keinen, weil er früher erst
// beim Aufruf der Zahlungsseite entstand — ein Kunde ohne E-Mail kam dort nie an
// und überwies ohne Referenz. In der Buchhaltung landete Geld ohne Namen.
//
// EINE VORSICHTSMASSNAHME, DIE NICHT ÜBERSPRUNGEN WERDEN DARF
// `payment_reference IS NULL` war nicht nur eine Lücke, sondern ein Merkmal:
// `fiaon-truth.ts` erkannte daran den ALT-BESTAND (69 bezahlte Import-Zeilen,
// 767,91 €), der nie in den Umsatz fließen darf. Diese Zeilen werden deshalb
// ZUERST in der Spalte `alt_bestand` markiert (Migration 038). Ohne diesen
// Schritt hätte der Backfill 767,91 € aus dem Nichts in den Umsatz gehoben.
//
// Der Lauf prüft das selbst: Umsatzbasis vorher und nachher müssen gleich sein.
//
// Erzeugt wird über `fiaon_verwendungszweck_neu()` in der Datenbank — dieselbe
// Funktion, die auch der Trigger benutzt. Es gibt genau einen Erzeuger.
//
//   npx tsx scripts/verwendungszweck-backfill.ts              → Vorschau + CSV
//   npx tsx scripts/verwendungszweck-backfill.ts --schreiben  → ausführen
// ═══════════════════════════════════════════════════════════════════════════
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { sqlPool } from "../server/lib/db-pool";

const SCHREIBEN = process.argv.includes("--schreiben");

const feld = (v: unknown): string => {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

async function umsatzlage(): Promise<{ anzahl: number; summe: string }> {
  const [r] = await sqlPool`
    SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(amount_due), 0)::text AS summe
    FROM fiaon_applications
    WHERE payment_status = 'paid' AND merged_into IS NULL
      AND NOT COALESCE(alt_bestand, FALSE)
  `.catch(() => [{ anzahl: 0, summe: "0" }] as any);
  return { anzahl: Number(r.anzahl), summe: String(r.summe) };
}

async function main(): Promise<void> {
  console.log("\n══ Verwendungszweck-Backfill ══\n");

  const [spalte] = await sqlPool`
    SELECT 1 AS da FROM information_schema.columns
    WHERE table_name = 'fiaon_applications' AND column_name = 'alt_bestand'
  `;
  if (!spalte) {
    console.log("  ABBRUCH: Die Spalte `alt_bestand` fehlt. Erst `node scripts/run-migrations.mjs`");
    console.log("  laufen lassen — sonst würden 69 bezahlte Alt-Zeilen in den Umsatz wandern.\n");
    await sqlPool.end();
    process.exit(1);
  }

  const vorher = await umsatzlage();
  const [altBestand] = await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE COALESCE(alt_bestand, FALSE)
  `;

  // Kandidat gleich mit abfragen: EINE Abfrage statt 5 759 Einzelrunden nach
  // Oregon. Der erste Entwurf holte jede Referenz einzeln — das lief 19 Minuten
  // für eine Vorschau, die niemand so lange ansehen würde.
  const offen = await sqlPool`
    SELECT a.ref, a.payment_status, a.ist_entwurf, a.archived_at, a.created_at,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    NULLIF(TRIM(a.company_name), ''), NULLIF(TRIM(a.contact_name), ''),
                    a.email, a.ref) AS kunde,
           COALESCE(NULLIF(a.email, ''), NULLIF(a.contact_email, ''), NULLIF(a.billing_email, '')) AS mail,
           NULLIF(CONCAT(COALESCE(a.phone_country_code, ''), COALESCE(a.phone, '')), '') AS telefon,
           fiaon_verwendungszweck_kandidat() AS kandidat
    FROM fiaon_applications a
    WHERE a.payment_reference IS NULL
    ORDER BY a.created_at DESC
  `;

  console.log(`  Alt-Bestand markiert (nie Umsatz):     ${altBestand.n}`);
  console.log(`  Umsatzbasis vorher:                    ${vorher.anzahl} Bestellungen, ${vorher.summe} €`);
  console.log(`  Bestellungen ohne Verwendungszweck:    ${offen.length}`);
  const ohneKontakt = (offen as any[]).filter((o) => !o.mail && !o.telefon).length;
  console.log(`    davon ohne jeden Kontaktweg:         ${ohneKontakt} (Funnel-Abbrecher)`);
  console.log(`    davon erreichbar:                    ${offen.length - ohneKontakt}`);

  if (offen.length === 0) {
    console.log("\n  Nichts zu tun — jede Bestellung hat einen Verwendungszweck.\n");
    await sqlPool.end();
    return;
  }

  // ── Vorschau: welche Referenz jede Zeile bekäme ────────────────────────
  // Für die CSV wird die Referenz PROBEWEISE gezogen (ohne Schreiben). Beim
  // Ausführen wird neu gezogen — die CSV ist eine Arbeitsliste, kein Vertrag.
  const kopf = ["ref", "kunde", "email", "telefon", "zahlungsstand", "entwurf", "neue_referenz"];
  const zeilen = (offen as any[]).map((o) => [
    o.ref, o.kunde, o.mail ?? "", o.telefon ?? "", o.payment_status,
    o.ist_entwurf ? "ja" : "nein", o.kandidat,
  ].map(feld).join(";"));
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/verwendungszweck-backfill.csv", `${kopf.join(";")}\n${zeilen.join("\n")}\n`, "utf8");
  console.log(`\n  Vorschau: reports/verwendungszweck-backfill.csv (${zeilen.length} Zeilen)`);

  if (!SCHREIBEN) {
    console.log("  Nur Vorschau. Ausführen mit --schreiben.\n");
    await sqlPool.end();
    return;
  }

  // ── Ausführen ────────────────────────────────────────────────────────
  // Die Schleife läuft IN der Datenbank, nicht hier. Zwei Gründe: 5 759 Runden
  // über den Atlantik dauern zwanzig Minuten, und jede Zeile braucht einen
  // eigenen eindeutigen Wert — ein einzelnes Mengen-UPDATE sieht die Referenzen
  // nicht, die es selbst gerade erzeugt (Kollisionsgefahr rund zwei Prozent).
  console.log("  Schreibe …");
  const [erg] = await sqlPool.unsafe(`
    DO $$
    DECLARE zeile RECORD; gesetzt INT := 0;
    BEGIN
      FOR zeile IN SELECT ref FROM fiaon_applications WHERE payment_reference IS NULL LOOP
        UPDATE fiaon_applications
           SET payment_reference = fiaon_verwendungszweck_neu(), updated_at = NOW()
         WHERE ref = zeile.ref;
        gesetzt := gesetzt + 1;
      END LOOP;
      RAISE NOTICE 'ergaenzt: %', gesetzt;
    END $$;
    SELECT 1 AS fertig;
  `).then(() => sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE payment_reference IS NULL`);
  const gesetzt = offen.length - Number(erg.n);

  const nachher = await umsatzlage();
  const rest = { n: Number(erg.n) };

  console.log(`\n  Ergänzt:                               ${gesetzt}`);
  console.log(`  Noch ohne Verwendungszweck:            ${rest.n}`);
  console.log(`  Umsatzbasis nachher:                   ${nachher.anzahl} Bestellungen, ${nachher.summe} €`);

  const gleich = nachher.anzahl === vorher.anzahl && Number(nachher.summe) === Number(vorher.summe);
  console.log(`  Umsatz unverändert:                    ${gleich ? "JA" : "NEIN — BITTE PRÜFEN"}`);
  if (!gleich) {
    console.log("\n  ACHTUNG: Die Umsatzbasis hat sich verändert. Das darf dieser Lauf nicht tun.");
    process.exitCode = 1;
  }
  console.log("");
  await sqlPool.end();
}

main().catch((err) => {
  console.error("[VERWENDUNGSZWECK-BACKFILL]", err);
  process.exit(1);
});
