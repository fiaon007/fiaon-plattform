// Smoke-Test (nur lesend): führt die Leistungs-Aggregation (P4-C) einmal gegen
// die echte DB aus und druckt die Team-Summen — gleicher Code-Pfad wie die Seite.
// Aufruf: npx tsx scripts/smoke-leistung.ts
import "dotenv/config";
import { computeLeistung } from "../server/routes/fiaon-leistung";

async function main() {
  const to = new Date();
  const from = new Date(Date.now() - 30 * 864e5);
  const data = await computeLeistung(from, to);
  console.log("Zeitraum:", data.range);
  console.log("Agenten sichtbar:", data.agents.length);
  for (const a of data.agents) {
    console.log(
      `- ${a.name}: Akten ${a.akten} · Kontakte ${a.kontakte} · Links ${a.links} · Konv. ${a.konversionen} · Abschl. ${a.abschluesse} · Umsatz ${(a.umsatzCents / 100).toFixed(2)} € · Reaktion ${a.reaktionStunden ?? "—"} h · Rückgabe ${a.rueckgabeQuote ?? "—"} % · Direktz. ${a.direktzahlerQuote ?? "—"} %`,
    );
  }
  console.log("Summen:", { ...data.totals, umsatzEur: (data.totals.umsatzCents / 100).toFixed(2) });
  console.log("Quellen:", data.sources.slice(0, 5));
  console.log("Serien-Punkte:", data.series.kontakte.length, "Kontakt-Tage /", data.series.abschluesse.length, "Abschluss-Tage");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
