/**
 * Trockenlauf des Agenten gegen ECHTE Fälle aus der Analyse — ohne Versand,
 * ohne Werkzeugausführung an echten Akten (personId/ref werden bewusst leer
 * gelassen, wo die Handlung Wirkung hätte).
 */
import { einordnen } from "../server/lib/fiaon-postmeister-agent";

const FAELLE: { name: string; betreff: string; text: string; erwartet: string[] }[] = [
  {
    name: "Kündigung im Zahlungs-Gewand (Fall #72 der Analyse)",
    betreff: "Re: Ihre Zahlung steht noch aus",
    text: "Guten Tag, ich habe doch bereits gekündigt. Warum bekomme ich weiter Rechnungen? Ich zahle nichts mehr.",
    erwartet: ["kuendigung"],
  },
  {
    name: "Bestreitet die Bestellung (Fall #127)",
    betreff: "Wer sind Sie?",
    text: "Ich habe bei Ihnen nie etwas bestellt. Bitte löschen Sie meine Daten sofort, sonst schalte ich einen Anwalt ein.",
    erwartet: ["bestreitet", "droht_anwalt", "rechtlich"],
  },
  {
    name: "Stopp-Wunsch",
    betreff: "Bitte keine Mails mehr",
    text: "Nehmen Sie mich bitte aus Ihrem Verteiler. Ich möchte keine weiteren E-Mails erhalten.",
    erwartet: ["stopp"],
  },
  {
    name: "Zahlung behauptet",
    betreff: "Zahlung",
    text: "Ich habe die Rate gestern überwiesen. Wann wird mein Konto freigeschaltet?",
    erwartet: ["zahlung_behauptet"],
  },
  {
    name: "Frage nach Kündigung — KEINE Kündigung",
    betreff: "Frage",
    text: "Wie lange läuft mein Vertrag und wie kann ich kündigen, falls ich das später möchte?",
    erwartet: ["kuendigung"], // Riegel setzt das Flag; die Willenserklärung prüft das Werkzeug
  },
  {
    name: "Zahlungsunfähigkeit",
    betreff: "Rate",
    text: "Ich bin gerade arbeitslos und kann die Rate diesen Monat nicht zahlen. Können wir etwas vereinbaren?",
    erwartet: ["zahlungsunfaehig"],
  },
];

(async () => {
  let fehler = 0;
  for (const f of FAELLE) {
    try {
      const e = await einordnen({ betreff: f.betreff, text: f.text, von: "kunde@example.org", alterTage: 1 });
      const gesetzt = Object.entries(e.flags).filter(([, v]) => v).map(([k]) => k);
      const fehlt = f.erwartet.filter((x) => !gesetzt.includes(x));
      if (fehlt.length) { fehler++; console.log(`FEHLER  ${f.name}\n        erwartet ${f.erwartet.join(",")} — gesetzt ${gesetzt.join(",") || "keine"}`); }
      else console.log(`ok      ${f.name}\n        Flags: ${gesetzt.join(", ")} | Kategorien: ${e.kategorien.join(", ")} | Fragen: ${e.fragen.length} | dringend: ${e.dringend}`);
    } catch (err: any) {
      fehler++;
      console.log(`FEHLER  ${f.name}: ${String(err?.message || err).slice(0, 180)}`);
    }
  }
  console.log(fehler ? `\n${fehler} Fälle fehlerhaft` : `\nALLE ${FAELLE.length} EINORDNUNGEN OK`);
  process.exit(fehler ? 1 : 0);
})();
