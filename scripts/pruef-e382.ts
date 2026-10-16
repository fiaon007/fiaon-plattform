// Prüfstand E-382 (16.10.2026): Die KI schaltet sich nach dem Aufladen selbst wieder ein. Offline. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e382.ts
import { readFileSync } from "node:fs";
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }
async function main() {
  const K = await import("../server/lib/fiaon-ki-pause");
  ok(K.selbstHeilungErlaubt({ an: true, art: "abrechnung", von: "automatisch" }), "automatische Guthaben-Pause → heilt sich selbst");
  ok(!K.selbstHeilungErlaubt({ an: true, art: "hand", von: "Justin" }), "Hand-Pause → bleibt");
  ok(!K.selbstHeilungErlaubt({ an: true, art: "abrechnung", von: "Justin" }), "von Hand gesetzte Abrechnungs-Pause → bleibt");
  ok(!K.selbstHeilungErlaubt({ an: true, art: "zugang", von: "automatisch" }), "Zugang gesperrt (Schlüssel) → bleibt");
  ok(!K.selbstHeilungErlaubt({ an: false, art: "abrechnung", von: "automatisch" }), "keine Pause → nichts zu tun");
  const r = await K.selbstHeilung();
  ok(!r.geprueft && !r.aufgehoben, "außerhalb des Produktionsdienstes: keine Probe, nichts geändert");
  const routes = readFileSync(new URL("../server/routes.ts", import.meta.url), "utf8");
  const crons = readFileSync(new URL("../server/lib/fiaon-crons.ts", import.meta.url), "utf8");
  ok(/tageslauf\('ki_selbstheilung', .*selbstHeilung\(\), 10 \* 60 \* 1000/.test(routes), "Lauf alle 10 Minuten angemeldet");
  ok(/ki_selbstheilung: \{/.test(crons), "Lauf in LAUF_FOLGEN (Ausfall fällt auf)");
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
