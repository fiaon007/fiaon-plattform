// Kalibrierprobe: die zehn Messwerte aus dem Seobility-Bericht vom 02.09.2026.
import { titelPixel, beschreibungPixel } from "../shared/fiaon-pixel";
const TITEL: [string, number][] = [
  ["So funktioniert FIAON: Plattform-Konzept Tag für Tag", 473],
  ["How FIAON works: the platform concept day by day | FIAON", 541],
  ["SCHUFA-Eintrag ohne Mahnung: Rechte & Löschung (§ 31 BDSG)", 601],
  ["Ratenzahlung vereinbaren: So gelingt Ihr Angebot (SCHUFA, Inkasso)", 628],
  ["SCHUFA Beschwerde: Ombudsmann, Datenschutzbehörde, Klage", 595],
  ["Kredit ohne SCHUFA: Was wirklich funktioniert (Warnsignale, Wege)", 611],
  ["Negativer SCHUFA-Eintrag: Bedeutung, Dauer, Alltag – Übersicht", 586],
  ["Restschuldbefreiung SCHUFA: Löschung nach 6 Monaten (BGH 2023)", 633],
  ["SCHUFA 100-Tage-Regel: Eintrag nach 18 Monaten weg | FIAON", 587],
  ["SCHUFA-Score verstehen: Basisscore, Branchenscores, Scoreklassen", 636],
];
const BESCHR: [string, number][] = [
  ["Wie FIAON mit Ihren sensibelsten Daten umgeht: EU-Hosting, Verschlüsselung, Vollmacht vor jeder Auskunft, Freigabe vor jedem Schreiben, Löschung auf Wunsch", 1012],
  ["Fünf Fragen, eine ehrliche Einschätzung: Ob Ihr SCHUFA-, KSV- oder CRIF-Eintrag gelöscht werden kann – nach § 31 BDSG und Löschfristen. Ohne Anmeldung.", 1001],
];
let summeAbw = 0;
for (const [t, soll] of TITEL) { const ist = titelPixel(t); const abw = Math.abs(ist - soll) / soll * 100; summeAbw += abw; console.log(`${ist.toString().padStart(4)} statt ${soll}  (${abw.toFixed(1)} %)  ${t.slice(0, 42)}`); }
for (const [t, soll] of BESCHR) { const ist = beschreibungPixel(t); const abw = Math.abs(ist - soll) / soll * 100; summeAbw += abw; console.log(`${ist.toString().padStart(4)} statt ${soll}  (${abw.toFixed(1)} %)  BESCHREIBUNG`); }
console.log(`\nMittlere Abweichung: ${(summeAbw / (TITEL.length + BESCHR.length)).toFixed(2)} %`);
