// Prüfstand E-376 (15.10.2026): Die Bitte um Ausweis und Kontoauszug für eine BEZAHLTE Bonitätsauswertung ist Lieferung —
// die Versand-Tür sperrt sie nicht wegen gekündigtem Paket oder Werbesperre; eine gescheiterte erste Bitte holt die
// Plattform selbst nach (keine Team-Aufgabe mehr). Offline (reine Tür) + Quelltext-Belege. Aufruf:
//   env -i HOME=$HOME PATH=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine node_modules/.bin/tsx scripts/pruef-e376.ts
import { readFileSync } from "node:fs";

let gut = 0, schlecht = 0;
function ok(b: unknown, was: string) { if (b) { gut++; console.log(`  ✓ ${was}`); } else { schlecht++; console.log(`  ✗ ${was}`); } }

async function main() {
  const mf = await import("../server/lib/fiaon-mail-frequenz");
  const basis = { personId: 1, werbesperre: false, werbesperreSeit: null, vertriebssperre: false, test: false, gekuendigt: false, vertragVorbei: false } as any;
  const gekuendigt = [{ ...basis, gekuendigt: true, laufendUngekuendigt: false }];
  const werbesperre = [{ ...basis, werbesperre: true, laufendUngekuendigt: true }];
  const anlass = { angebot_text: "Das brauchen wir für Ihre FIAON-Bonitätsauswertung.", auskunft_modus: "" };
  const E = "documents_change_request";

  console.log("── 1 · Die Tür: Lieferung einer bezahlten Auswertung");
  ok(mf.sperrUrteil(E, gekuendigt, { manuell: false, nutzlast: { ...anlass, lieferung: "auswertung" } }) === null, "gekündigtes Paket, bezahlte Auswertung → Bitte geht raus");
  ok(/Gekündigt/.test(String(mf.sperrUrteil(E, gekuendigt, { manuell: false, nutzlast: { ...anlass } }))), "gekündigt OHNE Lieferung → bleibt gesperrt (Paket-Unterlagen)");
  ok(mf.sperrUrteil(E, werbesperre, { manuell: false, nutzlast: { ...anlass, lieferung: "auswertung" } }) === null, "Werbesperre, bezahlte Auswertung → reine Bitte geht raus");
  ok(/Werbesperre/.test(String(mf.sperrUrteil(E, werbesperre, { manuell: false, nutzlast: { ...anlass } }))), "Werbesperre mit Angebotstext OHNE Lieferung → bleibt gesperrt");
  ok(/Werbesperre/.test(String(mf.sperrUrteil(E, werbesperre, { manuell: false, nutzlast: { auskunft_modus: "angebot", lieferung: "" } }))), "echtes Kaufangebot bei Werbesperre → gesperrt");
  ok(/Testkonto/.test(String(mf.sperrUrteil(E, [{ ...basis, test: true }], { manuell: false, nutzlast: { lieferung: "auswertung" } }))), "Testkonto bleibt gesperrt, auch bei Lieferung");

  console.log("── 2 · Quelltext: Lieferung markiert, keine Team-Aufgabe, Nachholen");
  const ablauf = readFileSync(new URL("../server/lib/fiaon-bonitaet-ablauf.ts", import.meta.url), "utf8");
  const link = readFileSync(new URL("../server/lib/fiaon-unterlagen-link.ts", import.meta.url), "utf8");
  ok((ablauf.match(/lieferung: "auswertung"/g) ?? []).length >= 2, "Start und Erinnerung senden als Lieferung");
  ok(/lieferung: ein\.lieferung \?\? ""/.test(link), "unterlagenAnfrageSenden reicht die Lieferung an die Mail weiter");
  ok(!/titel: "Bonitätsauswertung bezahlt — Unterlagen anfordern"/.test(ablauf), "keine Team-Aufgabe „Unterlagen anfordern“ mehr");
  ok(/u\.mail_status = 'gesendet'\) AS bitten/.test(ablauf) && /NACHHOLEN_HOECHSTENS/.test(ablauf) && /bonitaet-unterlagen-fehlen:/.test(ablauf), "Erinnerung zählt nur Zugestelltes, holt die erste Bitte nach und schließt die alte Aufgabe");
  const a = await import("../server/lib/fiaon-bonitaet-ablauf");
  ok(a.NACHHOLEN_HOECHSTENS === 3 && a.NACHHOLEN_ABSTAND_MS === 2 * 3_600_000, "Nachholen: höchstens dreimal, frühestens nach 2 Stunden");

  console.log(`\n${schlecht ? "✗" : "✓"} ${gut}/${gut + schlecht} Prüfungen bestanden (offline)`);
  process.exit(schlecht ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
