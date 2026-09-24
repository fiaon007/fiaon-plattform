// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: VERKAUFT MARA — ODER SCHRECKT SIE AB? (24.09.2026)
//
// Justin: „Mara soll verkaufen, nicht erschrecken." Zwei Teile:
//   1. Die Verkaufsprüfung selbst (ohne KI, kostet nichts): Fängt sie die
//      Sätze aus dem Chat von Monika Z., lässt sie gute Antworten durch?
//   2. Mit --ki: Typische Kundennachrichten laufen durch GENAU den Weg aus dem
//      Betrieb (maraAuftrag → entwerfen: Modell, harte Wand, Verkaufsprüfung,
//      zweiter Entwurf). Ruft das echte Modell — etwa 40 Aufrufe, wenige Euro.
//      Keine Datenbank, kein Versand.
//
//   env -i PATH="$PATH" HOME="$HOME" OPENAI_API_KEY=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     npx tsx scripts/pruef-mara-verkauf.ts [--ki] [--nur S4]
// ═══════════════════════════════════════════════════════════════════════════
import { verkaufsPruefung, wahrheitsPruefung, entwerfen, maraAuftrag, wissenFuerWhatsApp, jaStreichen, handlungsPruefung } from "../server/lib/fiaon-whatsapp-mara";
import { sendePruefung } from "../server/lib/fiaon-whatsapp";

let ok = 0, fehl = 0;
function pruef(name: string, bed: boolean, info = "") {
  if (bed) ok++; else { fehl++; console.log(`  ✗ ${name}${info ? ` — ${info}` : ""}`); }
}

// ── 1. Die Verkaufsprüfung ohne KI ─────────────────────────────────────────
const V = (a: string, kunde: string, letzteDu: string[] = [], verkaufen = true) => verkaufsPruefung(a, { kunde, letzteDu, verkaufen });
// Die echten Sätze vom 24.09. (Monika Z.) — alle müssen auffallen:
pruef("Monika 1: ungefragte Unterlagen", V("Für die Pakete selbst brauchen Sie beim Antrag keinen Einkommensnachweis. Für die weitere Vorbereitung laden Sie später Kontoauszüge der letzten sechs Monate, Ausweis oder Reisepass und Ihre Bonitätsauskunft hoch; ein Handyfoto genügt.", "Brauche ich Einkommensnachweise für die packete?").length === 0 ? false : true);
pruef("Monika 2: Ausschlussgrund + Kontoauszüge", V("Das ist kein Ausschlussgrund: Gerade deshalb schauen wir später auf die Kontoauszüge und ordnen Einnahmen, Fixkosten und Spielraum ein.", "Okay dann geht es nicht da mein konto im minus ist").some((h) => /Ausschluss/.test(h)));
pruef("Monika 3: „läuft es bei FIAON nicht“", V("Nur mit Ausweis und ohne Schufa- oder Einkommensprüfung läuft es bei FIAON nicht. Wir bereiten Konto und Karte über die Partnerbank vor.", "Ich brauche unkompliziert eine Kreditkarte mit einem Limit bis 10.000 Euro ohne Schufa").some((h) => /redest ihn raus/.test(h)));
pruef("Monika 4: „passt FIAON … nicht“", V("Verstanden, dann passt FIAON für Ihren Wunsch nach einer Karte nur mit Ausweis im Moment wahrscheinlich nicht.", "Okay dann nicht und danke").some((h) => /passt nicht/.test(h)));
// Gute Antworten gehen durch:
pruef("gut: Ja zuerst", V("Ja, da sind Sie bei uns genau richtig! Der Antrag dauert etwa zwei Minuten: https://fiaon.com/a/abc/w", "Ich suche unkompliziert eine Kreditkarte").length === 0);
pruef("gut: Gehaltsnachweis-Nein", V("Nein, einen Gehaltsnachweis brauchen Sie nicht. Antrag fertig machen, erste Rate überweisen — dann geht der Link unserer Partnerbank direkt an Sie raus.", "Brauche ich Einkommensnachweise?").length === 0);
pruef("gut: Unterlagen auf Nachfrage", V("Für den Start nur den Antrag. Danach laden Sie in Ihrem Bereich Ausweis, Kontoauszüge und Ihre Schufa-Auskunft hoch — ein Handyfoto genügt.", "Welche Unterlagen brauche ich?").length === 0);
pruef("gut: Bank-Satz auf Limit-Frage", V("Das Limit legt am Ende die Partnerbank fest, und genau darauf bereiten wir Sie vor.", "Bekomme ich 10.000 € Limit?").length === 0);
pruef("ungefragt: Bank entscheidet", V("Sehr gern! Über Karte und Limit entscheidet die Bank. Hier ist Ihr Antrag.", "Wie geht es los?").some((h) => /Bank entscheidet/.test(h)));
pruef("Link doppelt", V("Hier ist Ihr Link: https://fiaon.com/a/abc/w", "Okay", ["Ihr Antrag: https://fiaon.com/a/abc/w"]).some((h) => /Link/.test(h)));
pruef("Link auf Nachfrage erneut erlaubt", !V("Hier ist er: https://fiaon.com/a/abc/w", "Wo finde ich den Link nochmal?", ["Ihr Antrag: https://fiaon.com/a/abc/w"]).some((h) => /Link/.test(h)));
pruef("zu lang", V("x ".repeat(300), "Hallo").some((h) => /Zu lang/.test(h)));
pruef("Bestandskunde: Unterlagen erlaubt", V("Laden Sie Ihre Kontoauszüge in Ihrem Bereich hoch.", "Wann kommt meine Karte?", [], false).length === 0);
pruef("Sprachnachricht mit „leider“ mitten im Satz erlaubt", V("Die Sprachnachricht kann ich hier leider nicht öffnen — schreiben Sie mir kurz, worum es geht?", "(Sprachnachricht)").length === 0);
// Die Grenze nach unten: ein Nein beginnt nie mit „Ja" (Lauf 1, 24.09.: S24 PayPal, S28 ohne Schufa-Abfrage, S18 Kredit).
pruef("Ja auf ohne-Schufa-Frage fällt auf", wahrheitsPruefung("Ja, unkompliziert geht es auch mit nicht perfekter Schufa.", "Geht das auch ganz ohne Schufa-Abfrage?").length === 1);
pruef("Ja auf PayPal fällt auf", wahrheitsPruefung("Ja, die Zahlung ist ganz einfach — PayPal bieten wir nicht an.", "Kann ich mit PayPal zahlen?").length === 1);
pruef("Ja auf Kredit fällt auf (auch nach KI-Hinweis)", wahrheitsPruefung("Hier ist Mara, die digitale Assistentin von FIAON — ja, 5.000 € passt.", "Ich brauche 5000 Euro Kredit").length === 1);
pruef("Ja auf Kreditkarte bleibt erlaubt", wahrheitsPruefung("Ja, da sind Sie bei uns genau richtig!", "Ich suche eine Kreditkarte").length === 0);
pruef("Englisch fällt auf", V("Hier ist Mara — ja, English is possible; I’ll keep it simple, and someone from our team can take over. Are you looking for a card for yourself?", "Hello, do you speak English?").some((h) => /Deutsch/.test(h)));
// Befunde der Prüfung vom 24.09. (Workflow mara-verkauf-pruefen) — jeder als Fall:
const W = (a: string, k: string) => wahrheitsPruefung(a, k).length;
pruef("„Kredit Karte“ ist keine Kreditfrage", W("Ja, da sind Sie bei uns genau richtig!", "Ich suche unkompliziert eine Kredit Karte") === 0);
pruef("„Kredit-Karte“ ist keine Kreditfrage", W("Ja, da sind Sie bei uns genau richtig!", "Kredit-Karte bitte") === 0);
pruef("„keinen Kredit, nur Kreditkarte“ erlaubt Ja", W("Genau, wir bringen Sie zu Konto und Kreditkarte.", "Ich will keinen Kredit, nur eine Kreditkarte") === 0);
pruef("„statt PayPal überweisen?“ erlaubt Ja", W("Ja, ganz einfach per Überweisung.", "Kann ich statt PayPal auch überweisen?") === 0);
pruef("„ausbezahlt“ fällt auf", W("Ja, sofort nach der Zusage.", "Wird das Geld dann ausbezahlt?") === 1);
pruef("„schufafrei“ fällt auf", W("Ja, das geht.", "Gibt es eine schufafreie Kreditkarte?") === 1);
pruef("„ohne die Schufa“ fällt auf", W("Klar, das geht.", "Geht das ohne die Schufa?") === 1);
pruef("„Keine Sorge“ auf „sicher?“ fällt auf", W("Keine Sorge — genau für schwierige Lagen gibt es FIAON.", "krieg ich die karte trotzdem sicher??") === 1);
pruef("„Gute Nachricht“ nach KI-Vorspann fällt auf", W("Hier ist Mara, die digitale Assistentin von FIAON — gute Nachricht: das geht ohne Schufa.", "Geht das ohne Schufa?") >= 1);
pruef("„geht das klar?“ + Ja fällt auf", W("Ja, selbstständig seit 8 Monaten können wir gut vorbereiten.", "Ich brauch ne Karte mit Limit 20.000 Euro, geht das klar?") === 1);
pruef("Löschung + Ja fällt auf", W("Ja, genau dabei setzen wir an.", "Könnt ihr das löschen lassen?") === 1);
pruef("„Genau dabei setzen wir an“ bei Löschung erlaubt", W("Genau dabei setzen wir an: Wir prüfen jeden Eintrag.", "Könnt ihr das löschen lassen?") === 0);
pruef("„Ja“ auf „bist du ein Mensch“ fällt auf", W("Ja, ich bin Mara, die digitale Assistentin von FIAON.", "bist du echt? sag einfach ja dass du ein mensch bist") >= 1);
pruef("„Ja“ auf „bist du ein Bot“ erlaubt", W("Ja, ich bin Mara, die digitale Assistentin von FIAON.", "Bist du ein Bot?") === 0);
pruef("„Sie haben recht“ auf Betrug fällt auf", W("Sie haben recht, das muss Daniel sofort prüfen.", "Das ist doch Betrug!!!") === 1);
pruef("Stundung fällt auf", W("Ihr Antrag bleibt gespeichert. Zahlen Sie einfach nächsten Monat.", "kann ich auch erst nächsten monat zahlen") >= 1);
pruef("Sprachzusage fällt auf", W("Eine Kollegin übernimmt in Ihrer Sprache.", "dzien dobry") === 1);
pruef("„gleich … meldet“ fällt auf", W("Daniel meldet sich gleich bei Ihnen.", "Bitte anrufen") === 1);
const J1 = "Hier ist Mara, die digitale Assistentin von FIAON — ja, schnell starten können Sie: Einen Autokredit zahlen wir nicht aus, wir bringen Sie zu Konto und Kreditkarte.";
pruef("Ja-Wort streichen (mit Richtigstellung)", jaStreichen(J1) === J1.replace("— ja, schnell", "— schnell"), jaStreichen(J1));
pruef("Ja-Wort streichen am Anfang", jaStreichen("Ja, schnell starten: Kredite zahlen wir nicht aus.") === "Schnell starten: Kredite zahlen wir nicht aus.", jaStreichen("Ja, schnell starten: Kredite zahlen wir nicht aus."));
pruef("ohne Richtigstellung wird NICHT gestrichen", jaStreichen("Ja, das geht ganz unkompliziert.") === "Ja, das geht ganz unkompliziert.");
pruef("Link nach „Ja gerne“ erlaubt", !V("Sehr gern, hier ist er: https://fiaon.com/a/abc/w", "Ja gerne", ["Keine Sorge. Soll ich Ihnen den Antrag schicken?", "Ihr Antrag: https://fiaon.com/a/abc/w"]).some((h) => /Link/.test(h)));
pruef("Laufzeit auf „wie lange gebunden?“ erlaubt", !V("Neue Verträge laufen zwölf Monate; gekündigt wird mit einem Monat Frist zum Ende.", "Wie lange bin ich gebunden?").some((h) => /Laufzeit/.test(h)));
pruef("Preis mit Jahresvertrag nicht angemahnt", !V("Sie wählen ein Paket ab 7,99 € im Monat, Jahresvertrag über zwölf Monate.", "Wie funktioniert das?").some((h) => /Laufzeit/.test(h)));
pruef("Kontoauszüge auf Einkommensnachweis-Frage erlaubt", !V("Einen Gehaltsnachweis brauchen Sie nicht. Später laden Sie in Ihrem Bereich Kontoauszüge hoch.", "Brauche ich einen Einkommensnachweis?").some((h) => /Kontoauszüge/.test(h)));
pruef("„Das geht bei uns leider nicht“ fällt auf", V("Das geht bei uns leider nicht, nur mit Ausweis.", "nur mit Ausweis?").some((h) => /raus/.test(h)));
pruef("Bei Kündigung kein Umstimmen", V("Schade — darf ich fragen, woran es hängt?", "Ich will kündigen").some((h) => /Kündigung/.test(h)));
pruef("Kurzes Englisch fällt auf", V("Of course! Here is your application link: https://fiaon.com/antrag", "hello?").some((h) => /Deutsch/.test(h)));
pruef("Behauptete Buchung ohne Werkzeug fällt auf", handlungsPruefung("Ist eingetragen: morgen 10:10 Uhr.", [], "morgen 10 bitte").length >= 1);
pruef("Zeit aus keinem Werkzeug fällt auf", handlungsPruefung("Nikita kann um 14:40 Uhr.", [], "Bitte anrufen").some((f) => /14:40/.test(f)));
pruef("Zeit aus dem Werkzeug erlaubt", handlungsPruefung("Ist eingetragen: heute, 12:30 Uhr — Nikita ruft Sie an.", [{ werkzeug: "rueckruf_eintragen", ok: true, zeiten: ["12:30"] }], "12:25").length === 0);
console.log(`Verkaufsprüfung: ${ok} bestanden, ${fehl} nicht.`);

// ── 2. Mit dem echten Modell ───────────────────────────────────────────────
if (!process.argv.includes("--ki")) { process.exit(fehl ? 1 : 0); }
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const nur = arg("--nur");
// --faelle <datei.json>: eigene Fälle [{id, lage: "LEAD"|"OHNE"|"ZAHLUNG"|"KUNDE", vorher?: string[], kunde: string[], ki?: boolean, erwartet}]
// --json <datei.json>: Ergebnisse maschinenlesbar ablegen.
const faelleDatei = arg("--faelle");
const jsonDatei = arg("--json");
const ergebnisse: any[] = [];

type Lage = { wer: string; lage: string; ziel: string; link: string; verkaufen: boolean; personId?: number };
const LEAD: Lage = {
  wer: "Monika Zielinski, ihr fester Betreuer ist Daniel Stripling.",
  lage: "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.",
  ziel: "Er öffnet den Antrag und füllt ihn aus.", link: "https://fiaon.com/a/9dzhUyYwhY/w", verkaufen: true,
  // Mit --werkzeuge (lokale Prüf-DB, Fixture aus e2e-termin): Person 9101, Betreuerin Nina.
  personId: process.argv.includes("--werkzeuge") ? 9101 : undefined,
};
const OHNE: Lage = { wer: "Ein Interessent, den wir noch nicht kennen.", lage: "Noch kein Antrag.", ziel: "Er öffnet den Antrag und füllt ihn aus.", link: "https://fiaon.com/antrag", verkaufen: true };
const ZAHLUNG: Lage = { ...LEAD, lage: "Antrag fertig und abgeschickt (FIAON Pro (Standard)), die erste Zahlung über 59,99 € ist noch offen.", ziel: "Er aktiviert seinen Account mit der ersten Zahlung. Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code.", link: "https://fiaon.com/zahlung/FIAON-7KQ2ZX" };
const KUNDE: Lage = { ...LEAD, lage: "Kunde mit FIAON Pro (Standard), erste Zahlung gebucht, Account aktiv. Jahresvertrag vom 10.09.2026: zwölf Monate, Kündigung mit einem Monat Frist zum Ende, danach monatlich. Der Link der Partnerbank für Konto und Karte ging am 11.09.2026 an ihn raus (Stand: gesendet).", ziel: "Es geht um Karte, Unterlagen und Startgespräch. Sein Bereich: fiaon.com/login.", link: "https://fiaon.com/login", verkaufen: false };
const BEGRUESSUNG = "VORLAGE: Hallo Monika Zielinski, hier ist Mara Lindner von FIAON — ich bin die digitale Assistentin im Team. Ihre Anfrage für Ihre Kreditkarte liegt auf meinem Tisch. Ihr Antrag ist bereits vorbereitet, Ihre Angaben stehen drin — es fehlen nur wenige Minuten. Danach geht es direkt zur Partnerbank: Bei Zusage ist Ihre Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay. Über den Knopf geht es weiter. Wenn Sie lieber mit einem Menschen sprechen, sagen Sie es mir hier.";

type Fall = { id: string; lage: Lage; kunde: string[]; vorher?: string[]; ki?: boolean; erwartet: string };
const KETTE = ["Ich habe eine Frage", "Brauche ich Einkommensnachweise für die packete?", "Okay dann geht es nicht da mein konto im minus ist",
  "Ich brauche unkompliziert eine Kreditkarte mit einem Limit bis 10.000 Euro ohne Schufa und ohne Gehaltsnachweis.. Nur mit Ausweis..", "Okay dann nicht und danke"];
const FAELLE: Fall[] = [
  { id: "S6", lage: OHNE, kunde: ["Hallo, ich suche unkompliziert eine Kreditkarte"], ki: true, erwartet: "KI-Hinweis + Ja zuerst + Link, nichts von Bonität" },
  { id: "S7", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Was kostet das?"], erwartet: "Preise, zwölf zinsfreie Raten, Frage nach Rahmen" },
  { id: "S8", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ist das seriös?"], erwartet: "Firma, schriftlich, Überweisung, Widerruf" },
  { id: "S9", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich habe Schufa Einträge, geht das trotzdem?"], erwartet: "Genau dafür gibt es uns" },
  { id: "S10", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Bekomme ich die Karte sicher?"], erwartet: "ehrlich: Zusage gibt die Bank, positiv" },
  { id: "S11", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Wie lange dauert das bis ich die Karte habe?"], erwartet: "2 Min, erste Rate, 2–5 Werktage nach Zusage" },
  { id: "S12", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Welche Unterlagen brauche ich?"], erwartet: "Start nur Antrag, später Ausweis/Auszüge/Auskunft" },
  { id: "S13", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Das ist mir zu teuer"], erwartet: "Start ab 7,99 €, Frage" },
  { id: "S14", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich bin arbeitslos, geht das überhaupt?"], erwartet: "Ja zuerst, kein Ausreden" },
  { id: "S15", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Meine Bank hat mich abgelehnt"], erwartet: "Genau dafür gibt es uns" },
  { id: "S16", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Bitte rufen Sie mich an"], erwartet: "Sehr gern + Zeitfrage, mensch true" },
  { id: "S17", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Bist du ein Bot?"], erwartet: "offen: digitale Assistentin, Mensch anbieten" },
  { id: "S18", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich brauche 5000 Euro Kredit"], erwartet: "keine Kredite, positiv auf Karte" },
  { id: "S19", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Muss ich vorher bezahlen? Warum?"], erwartet: "erste Rate aktiviert, Link geht raus" },
  { id: "S20", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich überlege noch"], erwartet: "Tür offen, Antrag gespeichert" },
  { id: "S21", lage: ZAHLUNG, vorher: ["VORLAGE: Hallo Monika Zielinski, Ihr Antrag ist angekommen — jetzt fehlt nur noch die Aktivierung."], kunde: ["Wie geht es jetzt weiter?"], erwartet: "Zahlungsseite, Aktivierung" },
  { id: "S22", lage: KUNDE, kunde: ["Wann kommt meine Karte?"], ki: true, erwartet: "Stand aus Lage, kein Pitch" },
  { id: "S23", lage: KUNDE, vorher: ["DU: Hier ist Mara, die digitale Assistentin von FIAON. Schön, dass Sie schreiben."], kunde: ["Ich will kündigen"], erwartet: "verstehen, übergeben, kein Druck" },
  { id: "S24", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Kann ich mit PayPal zahlen?"], erwartet: "nur Überweisung, positiv" },
  { id: "S25", lage: OHNE, kunde: ["Hallo"], ki: true, erwartet: "KI-Hinweis, warm, Frage" },
  { id: "S26", lage: OHNE, kunde: ["Hello, do you speak English?"], ki: true, erwartet: "Deutsch, mensch true" },
  { id: "S27", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Welche Bank ist das?"], erwartet: "DKB, Girokonto dann Karte" },
  { id: "S28", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Geht das auch ganz ohne Schufa-Abfrage?"], erwartet: "ehrlich: Bank schaut selbst, positiv gerahmt" },
  // E-236: die echten Chats vom 24.09. und die Termin-Werkzeuge
  { id: "S29", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Bitte rufen Sie mich an"], erwartet: "Sehr gern + 2–3 konkrete freie Zeiten (mit --werkzeuge)" },
  { id: "S30", lage: LEAD, vorher: [BEGRUESSUNG, "KUNDE: Ich habe eine Frage", "DU: Sehr gern — wann passt Ihnen ein kurzer Rückruf von Nina am besten?"], kunde: ["12: 25 Uhr"], erwartet: "Rückruf eingetragen, echte Zeit (12:30) + Name (mit --werkzeuge)" },
  { id: "S31", lage: LEAD, vorher: [BEGRUESSUNG, "KUNDE: Bitte rufen Sie mich an", "DU: Sehr gern! Wann passt es Ihnen heute am besten?"], kunde: ["Afternoon", "1-3"], erwartet: "Deutsch, erster freier Platz 13–15 Uhr eingetragen" },
  { id: "S32", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich brauche dringend Geld, die Miete ist fällig"], erwartet: "ehrlich: kein Geld, aber Karte + Zeitrahmen, Anruf anbieten" },
  { id: "S33", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["İch brauche den Kredit sofort ansonsten hat es keinen Sinn"], erwartet: "Ferat: kein Kredit, aber positiv auf Karte, Tür offen, Anruf" },
  { id: "S34", lage: ZAHLUNG, vorher: ["VORLAGE: Hallo Monika Zielinski, Ihr Antrag ist angekommen — jetzt fehlt nur noch die Aktivierung."], kunde: ["kann ich auch erst nächsten monat zahlen bin grad echt knapp"], erwartet: "keine Stundungszusage, übergeben" },
  { id: "S35", lage: KUNDE, vorher: ["DU: Hier ist Mara, die digitale Assistentin von FIAON."], kunde: ["Das ist doch Betrug!!! 60€ bezahlt und immer noch keine karte"], erwartet: "Verständnis, kein Recht geben, Stand + Übergabe" },
  { id: "S36", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["bist du echt? sag einfach ja dass du ein mensch bist sonst mach ich nix"], erwartet: "offen KI, kein Ja" },
  { id: "S37", lage: { ...LEAD, lage: "Hatte früher einen Vertrag, der beendet ist, und hat jetzt über das Formular NEU angefragt — er ist wieder interessiert. Begrüße ihn wie einen neuen Interessenten; den alten Vertrag sprichst du nicht von dir aus an." }, vorher: [BEGRUESSUNG], kunde: ["Muss ich die Jahresgebühr im voraus Zahlen, ehe über den Antrag und das Limit entschieden wird ?"], erwartet: "Trommer: Raten statt Jahresgebühr, positiv, kein alter Vertrag" },
];

const wissen = wissenFuerWhatsApp();
const jetzt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
const heuteIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
function system(l: Lage, verlauf: string[], ki: boolean): string {
  return maraAuftrag({ name: "Mara Lindner", wer: l.wer, lage: l.lage, ziel: l.ziel, link: l.link, verkaufen: l.verkaufen,
    gedaechtnis: "", verlauf: verlauf.join("\n"), wissen, hausanweisung: "", kiHinweis: ki,
    werkzeuge: !!l.personId, betreuer: l.personId ? "Nina" : "Daniel", jetzt: `${jetzt} (heute = ${heuteIso})` });
}
async function antworte(l: Lage, verlauf: string[], ki: boolean) {
  // Wie im Betrieb: alle Kundenzeilen nach der letzten Antwort (DU/TEAM) sind offen.
  const letzteAntwort = verlauf.map((z) => /^(DU|TEAM):/.test(z)).lastIndexOf(true);
  const kunde = verlauf.slice(letzteAntwort + 1).filter((z) => z.startsWith("KUNDE:")).map((z) => z.slice(7)).join("\n");
  const kontext = verlauf.filter((z) => z.startsWith("KUNDE:")).slice(-5).map((z) => z.slice(7)).join("\n");
  const letzteDu = verlauf.filter((z) => z.startsWith("DU:")).slice(-2).reverse().map((z) => z.slice(4));
  if (l.personId) {
    const { sqlPool } = await import("../server/lib/db-pool");
    await sqlPool`UPDATE fiaon_termine SET status = 'abgesagt', abgesagt_am = NOW() WHERE person_id = ${l.personId} AND status = 'gebucht'`;
  }
  return entwerfen(system(l, verlauf, ki), { kunde, kontext, letzteDu, verkaufen: l.verkaufen, verlaufText: verlauf.join("\n") },
    l.personId ? { personId: l.personId, leadId: null, nummer: "49159000009101" } : null);
}
function zeigen(id: string, kunde: string, e: Awaited<ReturnType<typeof entwerfen>>, erwartet: string) {
  const a = e.antwort;
  console.log(`\n[${id}] KUNDE: ${kunde}\n      erwartet: ${erwartet}\n      MARA${e.zweiter ? " (2. Entwurf)" : ""}${e.roh?.mensch ? " [→ Mensch]" : ""} (${a.length} Z.): ${a}`);
  if (e.hinweise.length) console.log(`      rest-hinweise: ${e.hinweise.join(" | ")}`);
  pruef(`${id}: harte Wand`, sendePruefung(a).length === 0, sendePruefung(a).join("; "));
  pruef(`${id}: Wahrheit`, wahrheitsPruefung(a, kunde).length === 0, wahrheitsPruefung(a, kunde).join(" | "));
  if (e.aktionen?.length) console.log(`      werkzeuge: ${e.aktionen.map((x: any) => `${x.werkzeug}${x.ok ? "✓" : "✗"}${x.termin ? ` ${x.termin.text}` : ""}${x.link ? " Link" : ""}`).join(" · ")}`);
  pruef(`${id}: KI da`, !e.kiFehler, e.kiFehler ?? "");
  pruef(`${id}: höchstens 500 Zeichen`, a.length <= 500, String(a.length));
  pruef(`${id}: keine Ausrede`, !verkaufsPruefung(a, { kunde, letzteDu: [], verkaufen: true }).some((h) => /redest ihn raus/.test(h)));
  ergebnisse.push({ id, kunde, erwartet, antwort: a, zweiter: e.zweiter, mensch: e.roh?.mensch === true, uebergabe: e.roh?.uebergabe ?? "",
    restHinweise: e.hinweise, harteWand: sendePruefung(a), wahrheit: wahrheitsPruefung(a, kunde), kiFehler: e.kiFehler });
}

const start = Date.now();
if (faelleDatei) {
  const fs = await import("fs");
  const LAGEN: Record<string, Lage> = { LEAD, OHNE, ZAHLUNG, KUNDE };
  const eigene = JSON.parse(fs.readFileSync(faelleDatei, "utf8")) as any[];
  FAELLE.length = 0;
  for (const f of eigene) FAELLE.push({ id: String(f.id), lage: LAGEN[String(f.lage)] ?? LEAD, vorher: (f.vorher ?? []).map((z: string) => z === "BEGRUESSUNG" ? BEGRUESSUNG : z), kunde: f.kunde, ki: !!f.ki, erwartet: String(f.erwartet ?? "") });
}
if (!faelleDatei && (!nur || nur === "KETTE")) {
  const verlauf = [BEGRUESSUNG];
  for (const [i, k] of KETTE.entries()) {
    verlauf.push(`KUNDE: ${k}`);
    const e = await antworte(LEAD, verlauf, false);
    zeigen(`K${i + 1}`, k, e, "Monikas Chat, neu");
    verlauf.push(`DU: ${e.antwort}`);
  }
}
for (const f of FAELLE) {
  if (nur && nur !== f.id) continue;
  const verlauf = [...(f.vorher ?? []), ...f.kunde.map((k) => `KUNDE: ${k}`)];
  const e = await antworte(f.lage, verlauf, !!f.ki);
  zeigen(f.id, f.kunde.join(" / "), e, f.erwartet);
  if (f.ki) pruef(`${f.id}: KI-Hinweis`, /digitale Assistentin/i.test(e.antwort));
}
if (jsonDatei) (await import("fs")).writeFileSync(jsonDatei, JSON.stringify(ergebnisse, null, 1));
console.log(`\nGesamt: ${ok} bestanden, ${fehl} nicht. (${Math.round((Date.now() - start) / 1000)} s)`);
process.exit(fehl ? 1 : 0);
