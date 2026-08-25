// Prüfstand §10: Jede der neun Lagen muss Schritte haben, jeder Schritt
// vollständig sein, jeder Reiter-Verweis auf einen echten Reiter zeigen.
import { GESPRAECHS_SCHRITTE, schritteFuer } from "../shared/fiaon-gespraechs-schritte";

const LAGEN = ["rate_ueberfaellig","zusage_gebrochen","rueckruf_faellig","bezahlt_ohne_termin",
  "zahlung_gemeldet","rechnung_offen","lead_ohne_antrag","termin_heute","alles_gut"];
const REITER = new Set(["antrag","daten","zahlungen","dokumente","gespraeche"]);

let fehler = 0;
for (const lage of LAGEN) {
  const s = GESPRAECHS_SCHRITTE[lage];
  if (!s || !s.length) { console.log(`✗ ${lage}: KEINE Schritte`); fehler++; continue; }
  for (const [i, x] of s.entries()) {
    if (!x.titel || x.titel.length < 5) { console.log(`✗ ${lage}[${i}]: Titel fehlt`); fehler++; }
    if (!x.satz || x.satz.length < 20) { console.log(`✗ ${lage}[${i}]: Satz zu dünn`); fehler++; }
    if (x.reiter && !REITER.has(x.reiter)) { console.log(`✗ ${lage}[${i}]: unbekannter Reiter „${x.reiter}"`); fehler++; }
    for (const t of [x.titel, x.satz]) {
      if (/berät|Garantie/i.test(t)) { console.log(`✗ ${lage}[${i}]: verbotenes Wort in „${t.slice(0,40)}"`); fehler++; }
    }
  }
  console.log(`ok ${lage}: ${s.length} Schritte`);
}
// Der Rückfall darf nie leer sein — auch nicht für eine Lage von übermorgen.
if (!schritteFuer("gibts_nicht").length) { console.log("✗ Rückfall leer"); fehler++; }
if (!schritteFuer(null).length) { console.log("✗ Rückfall (null) leer"); fehler++; }
console.log(fehler ? `\n${fehler} VERSTÖSSE` : "\nAlle neun Lagen vollständig, Rückfall trägt.");
process.exit(fehler ? 1 : 0);
