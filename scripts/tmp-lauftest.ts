/** Trockenlauf: Zitat-Abschnitt und Fremdpost-Erkennung, ohne Gmail und ohne Modell. */
import { ohneZitat, istFremdpost } from "../server/lib/fiaon-postmeister-lauf";

const zitatFaelle: [string, string][] = [
  ["Ich habe gekündigt.\n\nAm 02.09.2026 schrieb FIAON <welcome@fiaon.com>:\n> Ihre Zahlung steht noch aus\n> IBAN DE86",
   "Ich habe gekündigt."],
  ["Danke!\n\n-----Ursprüngliche Nachricht-----\nVon: FIAON\nBetreff: Rechnung", "Danke!"],
  ["Nur Text ohne Zitat.", "Nur Text ohne Zitat."],
  ["Antwort oben.\n\nOn Tue, Sep 2, 2026 at 10:00 AM FIAON wrote:\n> alter Text", "Antwort oben."],
];

const fremdFaelle: [string, boolean, boolean][] = [
  // Adresse, autoHinweis, erwartet fremd
  ["no-reply@stripe.com", false, true],
  ["service@amazon.de", false, true],
  ["kunde@gmail.com", false, false],
  ["justin@fiaon.com", false, true],
  ["noreply@irgendwas.de", false, true],
  ["info@mail.google-partner-beratung.de", false, false],
  ["max@t-online.de", true, true],
];

let fehler = 0;
for (const [ein, erwartet] of zitatFaelle) {
  const g = ohneZitat(ein);
  if (g !== erwartet) { fehler++; console.log("ZITAT FEHLER:", JSON.stringify(g.slice(0, 60)), "erwartet", JSON.stringify(erwartet)); }
}
for (const [adresse, auto, erwartet] of fremdFaelle) {
  const g = istFremdpost({ vonAdresse: adresse, autoHinweis: auto } as any);
  if (g.fremd !== erwartet) { fehler++; console.log("FREMD FEHLER:", adresse, "→", g.fremd, g.grund, "erwartet", erwartet); }
}
console.log(fehler ? `${fehler} Fehler` : `ALLE ${zitatFaelle.length + fremdFaelle.length} FÄLLE OK (Zitat + Fremdpost)`);
process.exit(fehler ? 1 : 0);
