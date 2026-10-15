// Prüfstand E-377 (15.10.2026): Die Besucher-Seite (Clarity) entpackt doppelt verpackte Rohdaten. Offline. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e377.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }
async function main() {
  const c = await import("../server/routes/fiaon-chef-clarity");
  const liste = [{ metricName: "Traffic", information: [{ totalSessionCount: "120", distinctUserCount: "100", totalBotSessionCount: "2", pagesPerSessionPercentage: 1.4 }] }];
  ok(c.rohListe(liste).length === 1, "Liste bleibt Liste");
  ok(c.rohListe(JSON.stringify(liste)).length === 1, "JSON-Text wird entpackt");
  ok(c.rohListe(JSON.stringify(JSON.stringify(liste))).length === 1, "doppelt verpackter Text (wie in der Tabelle) wird entpackt");
  ok(c.rohListe("kaputt").length === 0 && c.rohListe(null).length === 0, "Unsinn → leere Liste, kein Absturz");
  const a = c.auswerten({ geholt_am: new Date(), tage: 3, gesamt: JSON.stringify(JSON.stringify(liste)), seiten: "\"[]\"", aufschluessel: null });
  ok(a.kopf.sitzungen === 120 && a.kopf.menschen === 100, "auswerten liest die Kopfzahlen aus dem doppelt verpackten Abruf");
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
