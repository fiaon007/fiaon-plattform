// Prüfstand E-385 (16.10.2026): Kein Ratgeber-Anlass zweimal in 14 Tagen. Offline, mit den echten Titeln vom 15./16.10. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e385.ts
let gut = 0, schlecht = 0;
function ok(b: unknown, was: string, extra = "") { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}${extra ? ` — ${extra}` : ""}`); } }
async function main() {
  const R = await import("../server/lib/fiaon-ratgeber-redaktion");
  const jetzt = Date.parse("2026-10-16T08:00:00Z");
  const gestern = "2026-10-15T14:55:00Z";
  const privat = [{ titel: "Neue Scoring-Regeln ab 20. November 2026: Diese Daten sind bei Bonitätsprüfungen tabu", keyword: "scoring regeln november 2026", slug: "a", am: gestern }];
  const business = [{ titel: "BOI Report für US-LLC: Was DACH-Gründer 2026 wirklich melden müssen", keyword: "boi report us llc", slug: "b", am: gestern }];
  const p = R.anlassDoppelt({ titel: "Ratenkauf ab November 2026: Wann „Später bezahlen“ zur Bonitätsprüfung wird", keyword: "ratenkauf november 2026" }, privat, jetzt);
  ok(!!p && /november/.test(p), "Privat 16.10.: derselbe Anlass (November-Regeln) erkannt", String(p));
  const b = R.anlassDoppelt({ titel: "Wirtschaftlich Berechtigte beim US-Konto: Was die BOI-Ausnahme 2026 wirklich ändert", keyword: "boi ausnahme us konto" }, business, jetzt);
  ok(!!b && /boi/.test(b), "Business 16.10.: derselbe Anlass (BOI) erkannt", String(b));
  ok(R.anlassDoppelt({ titel: "Kontopfändung: Neue Freibeträge ab Juli 2026 und was Sie jetzt beantragen", keyword: "pfändungsfreibetrag 2026" }, privat, jetzt) === null, "anderer Anlass (Pfändungsfreibetrag) → frei");
  ok(R.anlassDoppelt({ titel: "Inkasso-Schreiben prüfen: Was ein Urteil des BGH vom Oktober 2026 ändert", keyword: "inkasso bgh urteil" }, privat, jetzt) === null, "Inkasso-Urteil → frei (Feldwörter wie Bonität sperren nicht)");
  ok(R.anlassDoppelt({ titel: "Delaware Franchise Tax: Was Gründer bis März zahlen müssen", keyword: "delaware franchise tax" }, business, jetzt) === null, "Business: anderes Thema (Delaware Franchise Tax) → frei");
  const alt = [{ ...business[0], am: "2026-09-20T10:00:00Z" }];
  ok(R.anlassDoppelt({ titel: "BOI-Ausnahme: Was jetzt gilt", keyword: "boi ausnahme" }, alt, jetzt) === null, "nach 14 Tagen darf der Anlass wiederkommen");
  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
