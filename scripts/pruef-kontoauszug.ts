// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE KONTOAUSZUG-ANALYSE AN EINEM ECHTEN AUSZUG — OHNE ZU SPEICHERN
//
// Aufruf:  set -a; source .env; set +a
//          DATABASE_URL="$DATABASE_URL_EXTERN" npx tsx scripts/pruef-kontoauszug.ts FIAON-XXXX [FIAON-YYYY …]
//
// Liest den Auszug der Bestellung, schickt ihn durch `kontoauszugProbe` (denselben
// Rechenweg wie die Live-Analyse) und zeigt Kopf, Zählung, Cent-Prüfung, feste
// Zahlungen, Kategorien, Warnungen und Merksätze. Es wird KEINE Zeile in
// fiaon_kontoauszug_analysen und kein Akteneintrag geschrieben.
//
// Ausgegeben werden Summen, Firmennamen und Kategorien — keine einzelnen
// Buchungen mit Verwendungszweck. Kostet je Auszug zwei bis vier Modellaufrufe.
//
// Entstanden am 11.09.2026 (E-178): Mit dieser Probe fiel auf, dass Dirk
// Ladewigs „Kontoauszug" eine Gehaltsabrechnung ist und dass das Modell bei
// Revolut Erstattungen als Ausgaben las — beides, bevor eine Zeile live war.
// ═══════════════════════════════════════════════════════════════════════════
import { kontoauszugProbe } from "../server/lib/fiaon-kontoauszug-analyse";
(async () => {
  for (const ref of process.argv.slice(2)) {
    const [a] = (await sqlPool`SELECT bank_statement_pdf FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
    if (!a?.bank_statement_pdf) { console.log(ref, "keine Datei"); continue; }
    const t0 = Date.now();
    const p = await kontoauszugProbe(Buffer.from(a.bank_statement_pdf));
    const s = Math.round((Date.now() - t0) / 1000);
    console.log(`\n=== ${ref} (${s}s) ===`);
    console.log("Status:", p.status, "| Bank:", p.bank, "| Zeitraum:", p.zeitraumVon, "-", p.zeitraumBis, "| Seiten:", p.seiten, "| Modell:", p.modell);
    if (p.status !== "fertig" || !p.z) { console.log("Fehler:", p.fehler); continue; }
    console.log("Saldo Anfang/Ende:", p.saldoAnfang, "/", p.saldoEnde, "| Buchungen:", p.buchungen.length, "| Pruefung:", JSON.stringify(p.pruefung));
    console.log("Einnahmen/Ausgaben/Gehalt:", p.z.einnahmen, "/", p.z.ausgaben, "/", p.z.gehalt, "| Dispo:", p.z.dispoGenutzt, p.z.tiefst, "| RLS:", p.z.ruecklastschriften);
    console.log("Monate:", JSON.stringify(p.z.monate));
    console.log("Fixkosten:", p.z.fixkosten.map((f) => `${f.name} ${f.betragCents}c ${f.rhythmus} Tag${f.tagImMonat} n=${f.anzahl} next=${f.naechsteAm}`).join(" || "));
    console.log("Kategorien:", p.z.kategorien.map((k) => `${k.name} ${k.betragCents}c ${Math.round(k.anteil * 100)}%`).join(" | "));
    console.log("Warnungen:", p.z.warnungen.map((w) => `[${w.art}] ${w.text}`).join(" || "));
    console.log("Merksaetze:", JSON.stringify(p.merksaetze));
    // Datumsverteilung: liegen alle Buchungen im Zeitraum?
    const ausserhalb = p.buchungen.filter((b) => (p.zeitraumVon && b.datum < p.zeitraumVon) || (p.zeitraumBis && b.datum > p.zeitraumBis));
    const tage = new Set(p.buchungen.map((b) => b.datum));
    console.log("Verschiedene Tage:", tage.size, "| ausserhalb Zeitraum:", ausserhalb.length, "| mit saldo_danach:", p.buchungen.filter((b) => b.saldoDanachCents != null).length, "| Kategorien genutzt:", Array.from(new Set(p.buchungen.map((b) => b.kategorie))).join(","));
  }
  process.exit(0);
})();
