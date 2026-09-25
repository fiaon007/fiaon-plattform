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
//   E-241 (25.09.2026): offline dazu Anträge und Leads, die auf das Angebot der
//   Auskunft antworten oder selbst fragen (Kauflink 149 €), ungefragt nichts,
//   Werbesperre ohne Wunsch nichts, ein Nein bleibt ein Nein; mit --ki E4–E6.
//
//   env -i PATH="$PATH" HOME="$HOME" OPENAI_API_KEY=… DATABASE_URL=postgresql://pruef@127.0.0.1:9/keine \
//     npx tsx scripts/pruef-mara-verkauf.ts [--ki] [--nur S4]
// ═══════════════════════════════════════════════════════════════════════════
import {
  verkaufsPruefung, wahrheitsPruefung, entwerfen, maraAuftrag, wissenFuerWhatsApp, jaStreichen, handlungsPruefung,
  AUSKUNFT_THEMA, auskunftZugestimmt, auskunftGefragt, auskunftWerkzeugAn, auskunftBlock, vermerkZeile, VERMERK_KOPF,
  auskunftJetzt, type AuskunftTeil,
  // E-241 (25.09.2026): Anträge und Leads, die auf das Angebot antworten
  istAuskunftAngebot, antwortetAufAuskunftAngebot, bezogenAufAngebot, werkzeugAusfuehren,
} from "../server/lib/fiaon-whatsapp-mara";
import { sendePruefung } from "../server/lib/fiaon-whatsapp";
import { sperrUrteil, werbungVerboten, waVorlageWerblich, istWerbungImmer, type PersonSperre } from "../server/lib/fiaon-mail-frequenz";
import { fragtNachAuskunftSelbst, lehntAuskunftAb } from "../shared/fiaon-postmeister-typen";

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
pruef("Partnerbank-Satz in der Zahlungslage fällt auf", verkaufsPruefung("Sobald die Zahlung gebucht ist, wird Ihr Account aktiv und der Link unserer Partnerbank geht raus.", { kunde: "kann erst am 30.09 zahlen, ok?", letzteDu: [], verkaufen: true, zahlungslage: true }).some((h) => /Partnerbank/.test(h)));
pruef("Partnerbank erlaubt, wenn er nach der Bank fragt", !verkaufsPruefung("Unsere Partnerbank ist die DKB.", { kunde: "Welche Bank ist das?", letzteDu: [], verkaufen: true, zahlungslage: true }).some((h) => /Partnerbank/.test(h)));
pruef("Kurzes Englisch fällt auf", V("Of course! Here is your application link: https://fiaon.com/antrag", "hello?").some((h) => /Deutsch/.test(h)));
pruef("Behauptete Buchung ohne Werkzeug fällt auf", handlungsPruefung("Ist eingetragen: morgen 10:10 Uhr.", [], "morgen 10 bitte").length >= 1);
pruef("Zeit aus keinem Werkzeug fällt auf", handlungsPruefung("Nikita kann um 14:40 Uhr.", [], "Bitte anrufen").some((f) => /14:40/.test(f)));
pruef("Zeit aus dem Werkzeug erlaubt", handlungsPruefung("Ist eingetragen: heute, 12:30 Uhr — Nikita ruft Sie an.", [{ werkzeug: "rueckruf_eintragen", ok: true, zeiten: ["12:30"] }], "12:25").length === 0);
console.log(`Verkaufsprüfung: ${ok} bestanden, ${fehl} nicht.`);

// ── E-240 (24.09.2026): DIE BONITÄTSAUSKUNFT AUF WHATSAPP ──────────────────
// Fall Doris Hösl: zahlende Kundin schreibt „Ich hab keine". Offline geprüft wird,
// was der Server entscheidet (Auftrag, Werkzeug an/aus, Zustimmung, Prüfungen) —
// das Modell selbst nur mit --ki (Fälle E1–E3 unten).
const vorherOk = ok, vorherFehl = fehl;
const KUNDE_MIT_PAKET = {
  wer: "Doris Hösl, ihr fester Betreuer ist Daniel Stripling.",
  lage: "Kunde mit FIAON Pro (Standard), erste Zahlung gebucht, Account aktiv. Jahresvertrag vom 10.09.2026. Seine SCHUFA-Auskunft liegt uns noch nicht vor (weder bestellt noch hochgeladen).",
  ziel: "Es geht um Karte, Unterlagen und Startgespräch. Sein Bereich: fiaon.com/login.", link: "https://fiaon.com/login", verkaufen: false,
};
const AUSKUNFT_DE: AuskunftTeil = { stufe: "nichts", land: "DE", preisText: "74 €", mitAbo: true, offenLink: null, offenBetrag: null, jetzt: false, werbesperre: false };
const promptMit = (a: AuskunftTeil | null) => maraAuftrag({
  name: "Mara Lindner", ...KUNDE_MIT_PAKET, gedaechtnis: "", verlauf: "KUNDE: Ich habe keine SCHUFA-Auskunft", wissen: "", hausanweisung: "",
  werkzeuge: true, betreuer: "Daniel", jetzt: "Donnerstag, 24.09.2026, 18:00", auskunft: a,
});
// 1. Zahlender Kunde „Ich habe keine SCHUFA-Auskunft" → Angebot mit Werkzeug
const doris = "Ich habe keine SCHUFA-Auskunft";
const dorisTeil: AuskunftTeil = { ...AUSKUNFT_DE, jetzt: AUSKUNFT_THEMA.test(doris) || auskunftZugestimmt(doris, "") };
pruef("E240 Doris: Thema erkannt", AUSKUNFT_THEMA.test(doris));
pruef("E240 Doris: Werkzeug auskunft_anbieten an", auskunftWerkzeugAn(dorisTeil));
const pDoris = promptMit(dorisTeil);
pruef("E240 Doris: Angebot und Werkzeug im Auftrag", /DEIN ANGEBOT FÜR IHN: DIE BONITÄTSAUSKUNFT/.test(pDoris) && /· auskunft_anbieten —/.test(pDoris));
pruef("E240 Doris: Preis 74 € einmalig, kein Ratensatz", /74 € einmalig/.test(pDoris) && /Keine Monatsrate, keine zwölf Raten/.test(pDoris));
pruef("E240 Doris: Auskunfteien DE", /SCHUFA, CRIF und Creditreform Boniversum/.test(pDoris));
pruef("E240 Doris: Karte und Limit ohne Zusage", /Karte und Wunschlimit/.test(pDoris) && /Über Karte und Limit entscheidet die Bank/.test(pDoris));
pruef("E240 Doris: kostenlose Datenkopie nur auf Nachfrage", /kostenlos selbst anfordern/.test(pDoris) && /Von dir aus empfiehlst du den kostenlosen Weg nie/.test(pDoris));
pruef("E240 Doris: „Ich hab keine\" ist kein Auftrag (Kauflink statt Bestellung)", !auskunftZugestimmt(doris, "") && !auskunftZugestimmt("Ich hab keine", ""));
const kauf = "https://fiaon.com/api/fiaon/auskunft/bestellen?p=4513&art=privat&exp=1&sig=abc";
const antwortDoris = `Kein Problem — genau dafür sind wir da: Für 74 € einmalig holen wir Ihre Datenkopien bei SCHUFA, CRIF und Creditreform Boniversum, erklären jeden Eintrag und liefern Ihren Handlungsplan. Hier geht es direkt weiter: ${kauf}`;
const werkzeugDoris = [{ werkzeug: "auskunft_anbieten", ok: true, zeiten: [], link: kauf, betrag: "74 €", art: "angebot" as const }];
const bekanntDoris = { links: ["https://fiaon.com/login"], auskunftPreise: ["74 €", "149 €"] };
const vpDoris = verkaufsPruefung(antwortDoris, { kunde: doris, letzteDu: [], verkaufen: true, auskunftAngebot: true });
pruef("E240 Doris: Angebot ist keine Hürde (Verkaufsprüfung)", vpDoris.length === 0, vpDoris.join(" | "));
const hpDoris = handlungsPruefung(antwortDoris, werkzeugDoris, doris, "", bekanntDoris);
pruef("E240 Doris: Werkzeug-Link und Preis bestehen die Handlungsprüfung", hpDoris.length === 0, hpDoris.join(" | "));
const hartDoris = [...sendePruefung(antwortDoris), ...wahrheitsPruefung(antwortDoris, doris)];
pruef("E240 Doris: harte Wand hält das Angebot nicht auf", hartDoris.length === 0, hartDoris.join(" | "));
pruef("E240 erfundener Zahlungslink fällt auf", handlungsPruefung("Hier ist Ihr Link: https://fiaon.com/zahlung/FIAON-SCHUFA-ERFUNDEN", [], doris, "", bekanntDoris).some((f) => /aus keinem Werkzeug/.test(f)));
pruef("E240 erfundener Kauflink fällt auf", handlungsPruefung("Bitte hier: https://fiaon.com/api/fiaon/auskunft/bestellen?p=1&art=privat&exp=2&sig=zz", werkzeugDoris, doris, "", bekanntDoris).some((f) => /aus keinem Werkzeug/.test(f)));
pruef("E240 Link aus SEINE LAGE (offene Zahlung) erlaubt", handlungsPruefung("Ihre Zahlungsseite: https://fiaon.com/zahlung/FIAON-SCHUFA-K1.", [], "Wo zahle ich die Auskunft?", "", { links: ["https://fiaon.com/zahlung/FIAON-SCHUFA-K1"], auskunftPreise: ["74 €"] }).length === 0);
pruef("E240 Link, den er schon im Verlauf hat, erlaubt", handlungsPruefung("Hier nochmal: https://fiaon.com/zahlung/FIAON-7KQ2ZX", [], "Link?", "DU: Ihre Zahlungsseite: https://fiaon.com/zahlung/FIAON-7KQ2ZX").length === 0);
pruef("E240 erfundener Auskunft-Preis fällt auf", handlungsPruefung("Die Auskunft kostet Sie nur 29 € einmalig.", [], doris, "", bekanntDoris).some((f) => /Betrag 29 €/.test(f)));
pruef("E240 falscher Kundenpreis fällt auf (199 € ist der Firmenpreis)", handlungsPruefung("Ihre Auskunft kostet 199 €.", [], doris, "", bekanntDoris).some((f) => /199 €/.test(f)));
pruef("E240 Lead: Katalogpreis 149 € erlaubt, 99 € nicht", handlungsPruefung("Die Bonitätsauskunft kostet einzeln 149 €.", [], "Was kostet die Auskunft?").length === 0
  && handlungsPruefung("Die Bonitätsauskunft kostet 99 €.", [], "Was kostet die Auskunft?").length === 1);
pruef("E240 Paketpreis ohne Auskunft-Satz unberührt", handlungsPruefung("FIAON Pro kostet 59,99 € im Monat.", [], "Was kostet Pro?", "", bekanntDoris).length === 0);
// 2. Lead „Ich suche unkompliziert eine Kreditkarte" → weiterhin KEIN Wort zu Bonität
const pLead = maraAuftrag({ name: "Mara Lindner", wer: "Monika Zielinski.", lage: "Hat das Formular ausgefüllt.", ziel: "Er öffnet den Antrag und füllt ihn aus.",
  link: "https://fiaon.com/a/x/w", verkaufen: true, gedaechtnis: "", verlauf: "KUNDE: Ich suche unkompliziert eine Kreditkarte", wissen: "", hausanweisung: "", werkzeuge: true, betreuer: "Daniel", auskunft: null });
pruef("E240 Lead: kein Auskunft-Angebot im Auftrag", !/DEIN ANGEBOT FÜR IHN: DIE BONITÄTSAUSKUNFT|SEINE BONITÄTSAUSKUNFT|auskunft_anbieten/.test(pLead));
pruef("E240 Lead: kein Werkzeug ohne Auskunft-Teil", !auskunftWerkzeugAn(null));
pruef("E240 Lead: Bonitätsauskunft bleibt Hürde", V("Ja, da sind Sie bei uns genau richtig! Danach holen wir noch Ihre Bonitätsauskunft.", "Ich suche unkompliziert eine Kreditkarte").some((h) => /Bonitätsauskunft/.test(h)));
pruef("E240 Lead: auch mit Angebots-Schalter bleibt die Kontoauszug-Hürde", verkaufsPruefung("Laden Sie dann Ihre Kontoauszüge hoch.", { kunde: "Ich suche eine Kreditkarte", letzteDu: [], verkaufen: true, auskunftAngebot: true }).some((h) => /Kontoauszüge/.test(h)));
pruef("E240 Lead: der Hauptsatz geht weiter durch", V("Ja, da sind Sie bei uns genau richtig! Der Antrag dauert etwa zwei Minuten: https://fiaon.com/a/abc/w", "Ich suche unkompliziert eine Kreditkarte").length === 0);
// 3. Zahlender Kunde, der NICHT darüber schreibt → kein Angebot, kein Werkzeug
const ohneThema: AuskunftTeil = { ...AUSKUNFT_DE, jetzt: AUSKUNFT_THEMA.test("Wann ist mein Startgespräch?") };
pruef("E240 ungefragt: kein Werkzeug", !auskunftWerkzeugAn(ohneThema));
pruef("E240 ungefragt: nur der Hinweis, nicht als Hürde", /erwähne sie nur, wenn/.test(auskunftBlock(ohneThema).join("\n")) && !/auskunft_anbieten/.test(auskunftBlock(ohneThema).join("\n")));
pruef("E240 bezahlt: nichts verkaufen", /Nicht noch einmal anbieten/.test(auskunftBlock({ ...AUSKUNFT_DE, stufe: "bezahlt", jetzt: true }).join("\n")) && !auskunftWerkzeugAn({ ...AUSKUNFT_DE, stufe: "bezahlt", jetzt: true }));
pruef("E240 offen: Werkzeug für die Zahlungsseite", auskunftWerkzeugAn({ ...AUSKUNFT_DE, stufe: "offen", offenLink: "https://fiaon.com/zahlung/X", offenBetrag: "74 €", jetzt: true }));
// 4. Österreich: nie „SCHUFA" als Wort für den Kunden
const at = auskunftBlock({ ...AUSKUNFT_DE, land: "AT", jetzt: true }).join("\n");
pruef("E240 AT: KSV1870 und CRIF, Wort KSV-Auskunft", /KSV1870 und CRIF/.test(at) && /„KSV-Auskunft"/.test(at) && !/SCHUFA, CRIF/.test(at));
// 5. Zustimmung: nur ein klares Ja hält das Angebot „jetzt" (bestellt wird seit dem Gegenlesen nur über die Bestätigungsseite)
const angebot = "Soll ich Ihnen den Link zur Auskunft schicken?";
pruef("E240 „Ja gerne\" auf das Angebot = Zustimmung", auskunftZugestimmt("Ja gerne", angebot));
pruef("E240 „Bitte rufen Sie mich an\" ist keine Zustimmung", !auskunftZugestimmt("Bitte rufen Sie mich an", angebot));
pruef("E240 „Bestellen Sie sie bitte\" = Zustimmung", auskunftZugestimmt("Bestellen Sie sie bitte", angebot));
pruef("E240 „schon bestellt\" ist keine Zustimmung", !auskunftZugestimmt("Ich habe sie schon bestellt", angebot));
pruef("E240 „Ja\" ohne Auskunft-Frage ist keine Zustimmung", !auskunftZugestimmt("Ja", "Wann passt Ihnen ein Anruf?"));
pruef("E240 ausdrücklicher Wunsch erkannt", auskunftGefragt("Können Sie die Schufa-Auskunft für mich holen?") && !auskunftGefragt("Wann kommt meine Karte?"));
// 6. Werbesperre: antworten ja, verkaufen nein
const gesperrt: AuskunftTeil = { ...AUSKUNFT_DE, werbesperre: true, jetzt: auskunftGefragt("Wann kommt meine Karte?") };
pruef("E240 Werbesperre: kein Angebot, kein Werkzeug", !auskunftWerkzeugAn(gesperrt) && /bietest sie ihm nicht an/.test(auskunftBlock(gesperrt).join("\n")));
pruef("E240 Werbesperre: Link ohne Nachfrage fällt auf", verkaufsPruefung("Starten Sie hier neu: https://fiaon.com/antrag", { kunde: "Ok danke", letzteDu: [], verkaufen: false, werbesperre: true }).some((h) => /keine Werbung/.test(h)));
pruef("E240 Werbesperre: Link auf Nachfrage erlaubt", !verkaufsPruefung("Hier ist er: https://fiaon.com/antrag", { kunde: "Wo finde ich den Antrag?", letzteDu: [], verkaufen: false, werbesperre: true }).some((h) => /keine Werbung/.test(h)));
pruef("E240 Werbesperre: Abschluss-Aufforderung fällt auf", verkaufsPruefung("Der Antrag dauert zwei Minuten. Legen wir los?", { kunde: "Wie lange dauert es?", letzteDu: [], verkaufen: false, werbesperre: true }).some((h) => /Aufforderung/.test(h)));
// 7. Aktenvermerk
const vz = vermerkZeile({ kunde: "Ich hab keine", mara: "Für 74 € einmalig holen wir sie für Sie.", handlung: "Bonitätsauskunft angeboten (74 €, Kauflink)" });
pruef("E240 Vermerk: Kunde — Mara — Handlung", vz.startsWith("Kunde „Ich hab keine\" — Mara „Für 74 €") && /— Handlung: Bonitätsauskunft angeboten/.test(vz) && VERMERK_KOPF === "Mara (WhatsApp):", vz);
pruef("E240 Vermerk: lange Texte gekappt", vermerkZeile({ kunde: "x".repeat(500), mara: "y".repeat(500), handlung: "" }).length < 460);

// ── E-240: DIE WERBESPERRE AN DER TÜR (sperrUrteil, ohne Datenbank) ────────
const P = (x: Partial<PersonSperre>): PersonSperre => ({
  personId: 1, werbesperre: false, werbesperreSeit: null, vertriebssperre: false, test: false,
  gekuendigt: false, vertragVorbei: false, laufendesPaket: false, laufendUngekuendigt: false, kundeMitHinweis: false, ...x,
});
const U = (e: string, s: PersonSperre[], manuell = false, nutzlast: Record<string, unknown> | null = null) => sperrUrteil(e, s, { manuell, nutzlast });
pruef("Sperre: Unterlagen-Mail an Gekündigte blockiert (auch von Hand)", !!U("documents_change_request", [P({ gekuendigt: true, laufendesPaket: true })], true));
pruef("Sperre: Unterlagen-Mail nach Vertragsende blockiert", !!U("documents_change_request", [P({ vertragVorbei: true })]));
pruef("Sperre: Unterlagen-Mail mit laufendem ungekündigtem Paket erlaubt", U("documents_change_request", [P({ gekuendigt: true }), P({ personId: 2, laufendesPaket: true, laufendUngekuendigt: true })], true) === null);
pruef("Sperre: Unterlagen-Mail an offenen Antrag (Stufe B) erlaubt", U("documents_change_request", [P({})], true) === null);
pruef("Sperre: Unterlagen-Mail an unbekannte Adresse erlaubt", U("documents_change_request", []) === null);
pruef("Sperre: Unterlagen-Mail an Testkonto blockiert", !!U("documents_change_request", [P({ test: true, laufendUngekuendigt: true })]));
pruef("Sperre: Unterlagen-Mail bei Werbesperre MIT Kaufangebot blockiert", !!U("documents_change_request", [P({ werbesperre: true, laufendUngekuendigt: true })], true, { angebot_text: "Wir holen Ihre Auskunft für 74 €", auskunft_modus: "angebot" }));
pruef("Sperre: Unterlagen-Mail bei Werbesperre als reine Bitte erlaubt", U("documents_change_request", [P({ werbesperre: true, laufendUngekuendigt: true })], true, { angebot_text: "", auskunft_modus: "upload" }) === null);
pruef("Sperre: Auskunft-Angebot automatisch nur mit Widerspruchs-Hinweis", !!U("auskunft_angebot", [P({ laufendesPaket: true, laufendUngekuendigt: true })])
  && U("auskunft_angebot", [P({ laufendesPaket: true, laufendUngekuendigt: true, kundeMitHinweis: true })]) === null);
pruef("Sperre: Auskunft-Angebot von Hand ohne Hinweis-Grenze", U("auskunft_angebot", [P({ laufendesPaket: true, laufendUngekuendigt: true })], true) === null);
pruef("Sperre: Auskunft-Angebot nie an Werbesperre (auch von Hand)", !!U("auskunft_angebot", [P({ werbesperre: true, laufendUngekuendigt: true, kundeMitHinweis: true })], true));
pruef("Sperre: Auskunft-Angebot nie an Gekündigte", !!U("auskunft_angebot", [P({ gekuendigt: true, laufendesPaket: true })], true));
pruef("Sperre: Auskunft-Angebot nie an unbekannte Adresse", !!U("auskunft_angebot", [], true));
pruef("Sperre: Rückhol-Mail von Hand an Werbesperre blockiert", !!U("rueckhol_s5", [P({ werbesperre: true })], true) && istWerbungImmer("rueckhol_s5b"));
pruef("Sperre: Lead-Mail von Hand an Werbesperre blockiert", !!U("lead_followup", [P({ werbesperre: true })], true));
pruef("Sperre: Vertragspost von Hand bleibt (Zugang, Startgespräch)", U("zugang_link", [P({ werbesperre: true })], true) === null && U("onboarding_einladung", [P({ werbesperre: true })], true) === null);
pruef("Sperre: werbungVerboten", werbungVerboten(P({ werbesperre: true })) === "Werbesperre" && werbungVerboten(P({ vertriebssperre: true })) === "Vertriebssperre"
  && werbungVerboten(P({ gekuendigt: true })) !== null && werbungVerboten(P({ gekuendigt: true, laufendUngekuendigt: true })) === null && werbungVerboten(P({})) === null);
pruef("Sperre: Startgespräch-Einladung nach Vertragsende blockiert (auch von Hand)", !!U("onboarding_einladung", [P({ vertragVorbei: true })], true));
pruef("Sperre: Startgespräch-Einladung an Gekündigte mit laufendem Vertrag erlaubt", U("onboarding_einladung", [P({ gekuendigt: true, laufendesPaket: true })], true) === null);
pruef("Sperre: „nicht erreicht\" an Lead erlaubt", U("nicht_erreicht_termin", [P({})], true) === null && U("konto_karte_einladung", [P({ laufendUngekuendigt: true, laufendesPaket: true })], true) === null);
pruef("Sperre: WhatsApp-Rate und Termin sind keine Werbung, Kampagne schon", !waVorlageWerblich("fiaon_kk_rate") && !waVorlageWerblich("fiaon_kkb_termin_morgen") && waVorlageWerblich("fiaon_kk_letzte") && waVorlageWerblich("fiaon_kkb_anfrage"));
// ── Gegenlesen 24.09.2026: Fälle, die die erste Fassung nicht abdeckte ─────
// a) Im Betrieb hat ein zahlender Kunde verkaufen=false — dort muss das Angebot durchgehen.
const vpEcht = verkaufsPruefung(antwortDoris, { kunde: doris, letzteDu: [], verkaufen: false, auskunftAngebot: true });
pruef("GL Doris wie im Betrieb (verkaufen=false): Angebot ohne Hinweis", vpEcht.length === 0, vpEcht.join(" | "));
// b) Nach dem ersten Angebot löst „Karte" allein kein zweites aus; die Auskunft selbst schon.
const angebotDu = ["Für 74 € einmalig holen wir Ihre Auskunft bei SCHUFA, CRIF und Creditreform Boniversum. Hier geht es direkt weiter: https://fiaon.com/api/fiaon/auskunft/bestellen?p=1"];
pruef("GL erstes Mal: „Wann kommt meine Karte?\" → Angebot", auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: [], werbesperre: false }).jetzt);
const wiederKarte = auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: angebotDu, werbesperre: false });
pruef("GL schon angeboten: „Karte\" allein → kein neues Angebot", !wiederKarte.jetzt && wiederKarte.schonAngeboten);
pruef("GL schon angeboten: Block sagt „nicht wiederholen\", kein Werkzeug", /Wiederhole das Angebot nicht/.test(auskunftBlock({ ...AUSKUNFT_DE, ...wiederKarte }).join("\n")) && !auskunftWerkzeugAn({ ...AUSKUNFT_DE, ...wiederKarte }));
pruef("GL schon angeboten: „Was genau steht in der Auskunft?\" → wieder da", auskunftJetzt({ kunde: "Was genau steht in der Auskunft?", letzteDu: angebotDu, werbesperre: false }).jetzt);
pruef("GL Werbesperre: „Karte\" → kein Angebot, ausdrücklicher Wunsch → ja", !auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: [], werbesperre: true }).jetzt
  && auskunftJetzt({ kunde: "Was kostet die Schufa-Auskunft bei Ihnen?", letzteDu: [], werbesperre: true }).jetzt);
// c) Österreich/Schweiz: „SCHUFA" in Maras Antwort ist ein harter Fund — außer er schrieb es selbst.
pruef("GL AT: „SCHUFA\" in der Antwort fällt auf", handlungsPruefung("Ihre Schufa muss nicht perfekt sein.", [], "Wie komme ich zur Karte?", "", { land: "AT" }).some((f) => /KSV-Auskunft/.test(f)));
pruef("GL AT: schreibt er „Schufa\" selbst, darf Mara es aufgreifen", handlungsPruefung("Ihre Schufa muss nicht perfekt sein.", [], "Ist meine Schufa schlimm?", "", { land: "AT" }).length === 0);
pruef("GL DE: „SCHUFA\" erlaubt", handlungsPruefung("Ihre Schufa muss nicht perfekt sein.", [], "Wie komme ich zur Karte?", "", { land: "DE" }).length === 0);
// d) Eine Monatsrate im Auskunft-Satz ist kein falscher Auskunft-Preis.
pruef("GL Monatsrate im Auskunft-Satz bleibt erlaubt", handlungsPruefung("Die Auskunft kostet Sie 74 € einmalig, Ihr Paket bleibt bei 59,99 € im Monat.", [], "Was kostet die Auskunft?", "", bekanntDoris).length === 0);
pruef("GL falscher Preis im selben Satz fällt weiter auf", handlungsPruefung("Die Auskunft kostet Sie 79 € einmalig, Ihr Paket bleibt bei 59,99 € im Monat.", [], "Was kostet die Auskunft?", "", bekanntDoris).some((f) => /79 €/.test(f)));
// e) Werbesperre bei seiner Rate: die Zahlungsseite ist Zahlungspost, kein Werbelink.
pruef("GL Werbesperre + Rate: Zahlungsseite ohne Werbe-Hinweis", !verkaufsPruefung("Ihre Zahlungsseite: https://fiaon.com/zahlung/FIAON-ABC123-2", { kunde: "ok", letzteDu: [], verkaufen: false, werbesperre: true, zahlungslage: true }).some((h) => /keine Werbung/.test(h)));
console.log(`E-240 (Auskunft, Akte, Werbesperre): ${ok - vorherOk} bestanden, ${fehl - vorherFehl} nicht.`);

// ── E-241 (25.09.2026): ANTRÄGE UND LEADS, DIE AUF DAS ANGEBOT ANTWORTEN ──────
// Justin: die Auskunft „an ALLE". Der Takt bietet sie Stufe B und Leads an; Mara
// verkauft dort nur als Antwort (Vorlage fiaon_kk_auskunft_lead, Mail, eigene
// Frage) — ungefragt bleibt es bei der Karte (Justin 24.09.).
const vor241Ok = ok, vor241Fehl = fehl;
const LEAD_AUSKUNFT: AuskunftTeil = { stufe: "nichts", land: "DE", preisText: "149 €", mitAbo: false, offenLink: null, offenBetrag: null, jetzt: false, werbesperre: false, segment: "lead", art: "privat" };
const LEAD_VORLAGE = { vorlage: "fiaon_kk_auskunft_lead", text: "Hallo Monika Zielinski, hier ist Mara Lindner von FIAON, die digitale Assistentin im Team. Bevor eine Bank über Ihre Karte entscheidet … Ihr Preis: 149 € einmalig, ohne Abo." };
const promptLead = (a: AuskunftTeil | null, verlauf = "KUNDE: Ja, gern") => maraAuftrag({
  name: "Mara Lindner", wer: "Monika Zielinski, noch ohne festen Betreuer.", lage: "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.",
  ziel: "Er öffnet den Antrag und füllt ihn aus.", link: "https://fiaon.com/a/x/w", verkaufen: true, gedaechtnis: "", verlauf, wissen: "", hausanweisung: "",
  werkzeuge: true, betreuer: null, jetzt: "Freitag, 25.09.2026, 10:00", auskunft: a,
});
// 1. Lead antwortet „Ja, gern" auf die Auskunft-Vorlage → Angebot mit Werkzeug, 149 €
pruef("E241 Vorlage fiaon_kk_auskunft_lead ist ein Angebot (auch Bildfassung fiaon_kkb_…)", istAuskunftAngebot(LEAD_VORLAGE) && istAuskunftAngebot({ vorlage: "fiaon_kkb_auskunft_lead" }) && istAuskunftAngebot({ vorlage: "fiaon_kk_auskunft" }));
pruef("E241 Begrüßung und Rate sind kein Auskunft-Angebot", !istAuskunftAngebot({ vorlage: "fiaon_kk_anfrage" }) && !istAuskunftAngebot({ vorlage: "fiaon_kk_rate" }) && !istAuskunftAngebot({ vorlage: "fiaon_kk_auskunftx" }));
const jaLead = auskunftJetzt({ kunde: "Ja, gern", letzteDu: [], werbesperre: false, segment: "lead", aufAngebot: antwortetAufAuskunftAngebot({ kunde: "Ja, gern", letzteRaus: LEAD_VORLAGE }) });
pruef("E241 Lead „Ja, gern“ auf die Vorlage → jetzt, als Antwort auf das Angebot", jaLead.jetzt && jaLead.aufAngebot === true, JSON.stringify(jaLead));
const jaTeil: AuskunftTeil = { ...LEAD_AUSKUNFT, ...jaLead };
pruef("E241 Lead „Ja, gern“ → Werkzeug auskunft_anbieten an", auskunftWerkzeugAn(jaTeil));
const blockJa = auskunftBlock(jaTeil).join("\n");
pruef("E241 Lead: Block „SEINE FRAGE“ mit 149 € einmalig, Werkzeug und „keine Voraussetzung“",
  /SEINE FRAGE: DIE BONITÄTSAUSKUNFT/.test(blockJa) && /149 € einmalig/.test(blockJa) && /auskunft_anbieten/.test(blockJa) && /KEINE Voraussetzung/.test(blockJa) && /antwortet auf unser Angebot/.test(blockJa), blockJa.slice(0, 200));
pruef("E241 Lead: Block ohne Kundenpreis 74 €", !/74 €/.test(blockJa));
const pJa = promptLead(jaTeil);
pruef("E241 Lead: Werkzeug im Auftrag, Bescheid an „unserem Team“ (kein [Betreuer])", /· auskunft_anbieten —/.test(pJa) && /gibt auch unserem Team Bescheid/.test(pJa) && !/\[Betreuer\] Bescheid/.test(pJa));
const kaufLead = "https://www.fiaon.com/api/fiaon/auskunft/bestellen?p=9101&art=privat&exp=1&sig=abc";
const antwortLead = `Sehr gern — für 149 € einmalig holen wir Ihre Datenkopien bei SCHUFA, CRIF und Creditreform Boniversum und erklären Ihnen jeden Eintrag. Hier geht es direkt weiter: ${kaufLead}`;
const aktionLead = [{ werkzeug: "auskunft_anbieten", ok: true, zeiten: [], link: kaufLead, betrag: "149 €", art: "angebot" as const }];
const bekanntLead = { links: ["https://fiaon.com/a/x/w"], auskunftPreise: ["149 €"], land: "DE" as const };
pruef("E241 Lead: Antwort mit Kauflink aus dem Werkzeug und 149 € besteht die harte Prüfung",
  handlungsPruefung(antwortLead, aktionLead, "Ja, gern", "", bekanntLead).length === 0 && sendePruefung(antwortLead).length === 0 && wahrheitsPruefung(antwortLead, "Ja, gern").length === 0,
  [...handlungsPruefung(antwortLead, aktionLead, "Ja, gern", "", bekanntLead), ...sendePruefung(antwortLead)].join(" | "));
pruef("E241 Lead: 74 € (Kundenpreis) für den Lead fällt auf", handlungsPruefung("Die Auskunft kostet für Sie nur 74 € einmalig.", aktionLead, "Ja, gern", "", bekanntLead).some((f) => /74 €/.test(f)));
const vpLead = verkaufsPruefung(antwortLead, { kunde: "Ja, gern", letzteDu: [], verkaufen: true, auskunftAngebot: true });
pruef("E241 Lead: das Angebot ist keine „Hürde“ (Verkaufsprüfung still)", vpLead.length === 0, vpLead.join(" | "));
// Der Kauflink des Leads ist ein gültiger, signierter Link auf ihn (kaufLink, ohne Datenbank).
{
  const kauf = await import("../server/routes/fiaon-auskunft-kauf");
  const link = kauf.kaufLink(9101, "privat");
  const urteil = kauf.kaufLinkPruefen(Object.fromEntries(new URL(link).searchParams));
  pruef("E241 Lead: Kauflink signiert und gehört ihm (art privat)", urteil.ok === true && (urteil as any).personId === 9101 && (urteil as any).art === "privat", `${link} → ${JSON.stringify(urteil)}`);
}
// Das Werkzeug prüft selbst: ohne Antwort/Frage kein Angebot an einen Lead — auch wenn das Modell es ruft.
{
  const r0 = await werkzeugAusfuehren("auskunft_anbieten", {}, { personId: 9101, leadId: null, nummer: "49159000009101", kunde: "Wann kommt meine Karte?", letzteDu: "", auskunft: { ...LEAD_AUSKUNFT, jetzt: false } });
  pruef("E241 Werkzeug: Lead ohne Antwort/Frage → abgelehnt, kein Link", r0.ergebnis.ok === false && /weder auf unser Angebot/.test(String(r0.ergebnis.grund)) && !r0.aktion.link, JSON.stringify(r0.ergebnis));
}
// 2. Lead fragt ungefragt nach der Karte → kein Wort Bonität
for (const k of ["Ich suche unkompliziert eine Kreditkarte", "Wann kommt meine Karte? Wie hoch ist das Limit?", "Ich habe Schufa Einträge, geht das trotzdem?", "Geht das auch ganz ohne Schufa-Abfrage?", "Können Sie mir Auskunft geben, wie lange das dauert?"]) {
  const j = auskunftJetzt({ kunde: k, letzteDu: [], werbesperre: false, segment: "lead", aufAngebot: antwortetAufAuskunftAngebot({ kunde: k, letzteRaus: { vorlage: "fiaon_kk_anfrage" } }) });
  pruef(`E241 Lead ungefragt „${k.slice(0, 40)}“ → kein Angebot`, !j.jetzt && !auskunftWerkzeugAn({ ...LEAD_AUSKUNFT, ...j }), JSON.stringify(j));
}
const karteTeil: AuskunftTeil = { ...LEAD_AUSKUNFT, ...auskunftJetzt({ kunde: "Ich suche unkompliziert eine Kreditkarte", letzteDu: [], werbesperre: false, segment: "lead" }) };
pruef("E241 Lead ungefragt: Block leer — der Auftrag bleibt wie vor E-241", auskunftBlock(karteTeil).length === 0);
const pKarte = promptLead(karteTeil, "KUNDE: Ich suche unkompliziert eine Kreditkarte");
pruef("E241 Lead ungefragt: kein Auskunft-Block, kein Werkzeug im Auftrag", !/DEIN ANGEBOT FÜR IHN|SEINE BONITÄTSAUSKUNFT|SEINE FRAGE|auskunft_anbieten/.test(pKarte));
pruef("E241 Lead ungefragt: „Bonitätsauskunft“ in der Antwort bleibt eine Hürde", V("Ja, da sind Sie bei uns genau richtig! Danach holen wir noch Ihre Bonitätsauskunft.", "Ich suche unkompliziert eine Kreditkarte").some((h) => /Bonitätsauskunft/.test(h)));
// 3. B fragt „was kostet die Auskunft?" → Angebot
const bFrage = auskunftJetzt({ kunde: "Was kostet die Auskunft?", letzteDu: [], werbesperre: false, segment: "antrag" });
pruef("E241 B „Was kostet die Auskunft?“ → jetzt, als eigene Frage", bFrage.jetzt && bFrage.selbst === true && !bFrage.aufAngebot, JSON.stringify(bFrage));
const bTeil: AuskunftTeil = { ...LEAD_AUSKUNFT, segment: "antrag", ...bFrage };
const blockB = auskunftBlock(bTeil).join("\n");
pruef("E241 B: Block fragt selbst, erste Zahlung höchstens ein Satz ohne zweiten Link, 149 €",
  /fragt selbst nach der Bonitätsauskunft/.test(blockB) && /erste Zahlung/.test(blockB) && /ohne zweiten Link/.test(blockB) && /149 € einmalig/.test(blockB) && auskunftWerkzeugAn(bTeil), blockB.slice(0, 240));
for (const k of ["Können Sie meine Schufa-Auskunft holen?", "Ich hätte gern eine Datenkopie", "Können Sie meine Schufa anfordern?", "Was steht in meiner Schufa?", "Wie komme ich an meine SCHUFA?"]) {
  pruef(`E241 eigene Frage erkannt: „${k}“`, fragtNachAuskunftSelbst(k) && auskunftJetzt({ kunde: k, letzteDu: [], werbesperre: false, segment: "antrag" }).jetzt);
}
// 4. Werbesperre ohne Wunsch → kein Angebot (auch nicht als Antwort auf eine Vorlage)
const sperrJa = auskunftJetzt({ kunde: "Ja, gern", letzteDu: [], werbesperre: true, segment: "lead", aufAngebot: true });
pruef("E241 Werbesperre: „Ja, gern“ auf eine Vorlage → kein Angebot", !sperrJa.jetzt && !auskunftWerkzeugAn({ ...LEAD_AUSKUNFT, werbesperre: true, ...sperrJa }));
pruef("E241 Werbesperre: Frage nach der Karte → kein Angebot", !auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: [], werbesperre: true, segment: "antrag" }).jetzt);
pruef("E241 Werbesperre: „Die Auskunft ist doch Abzocke“ → kein Angebot", !auskunftJetzt({ kunde: "Die Auskunft ist doch Abzocke", letzteDu: [], werbesperre: true, segment: "lead" }).jetzt);
pruef("E241 Werbesperre: ausdrücklicher Wunsch → ja", auskunftJetzt({ kunde: "Was kostet die Schufa-Auskunft bei Ihnen?", letzteDu: [], werbesperre: true, segment: "lead" }).jetzt);
pruef("E241 Werbesperre ohne Wunsch: Block leer", auskunftBlock({ ...LEAD_AUSKUNFT, werbesperre: true, ...sperrJa }).length === 0);
// 5. Ein Nein bleibt ein Nein
for (const k of ["Nein danke", "Kein Interesse.", "Habe schon eine", "Brauche ich nicht", "Später vielleicht"]) {
  pruef(`E241 Ablehnung „${k}“ auf die Vorlage → kein Angebot`, lehntAuskunftAb(k) && !auskunftJetzt({ kunde: k, letzteDu: [], werbesperre: false, segment: "lead", aufAngebot: true }).jetzt);
}
pruef("E241 „Ich habe keine Auskunft“ ist keine Ablehnung", !lehntAuskunftAb("Ich habe keine Auskunft") && !lehntAuskunftAb("Brauche ich die nicht?") && !lehntAuskunftAb("Das ist nötig"));
// 6. Mail-Angebot der letzten 14 Tage: nur, wenn er sich darauf bezieht
pruef("E241 Mail-Angebot + „Wegen Ihrer Mail: ja gern“ → Antwort auf das Angebot", antwortetAufAuskunftAngebot({ kunde: "Wegen Ihrer Mail: ja gern", letzteRaus: { vorlage: "fiaon_kk_anfrage" }, angebotKuerzlich: "per Angebots-Mail am 24.09., um 10:12 Uhr" }));
pruef("E241 Mail-Angebot + bloßes „Ja gern“ nach der Begrüßung → meint den Antrag", !antwortetAufAuskunftAngebot({ kunde: "Ja gern", letzteRaus: { vorlage: "fiaon_kk_anfrage" }, angebotKuerzlich: "per Angebots-Mail am 24.09., um 10:12 Uhr" }));
pruef("E241 Maras eigenes Angebot (Preis) davor zählt", istAuskunftAngebot({ vorlage: null, text: "Für 149 € einmalig holen wir Ihre Auskunft." }) && !istAuskunftAngebot({ vorlage: null, text: "Ihre Auskunft liegt vor." }));
pruef("E241 Maras eigenes Angebot, danach „Wann kommt meine Karte?“ → keine Antwort auf das Angebot (kein zweites)",
  !antwortetAufAuskunftAngebot({ kunde: "Wann kommt meine Karte?", letzteRaus: { vorlage: null, text: "Für 149 € einmalig holen wir Ihre Auskunft. Hier geht es direkt weiter: https://fiaon.com/api/fiaon/auskunft/bestellen?p=1" } })
  && antwortetAufAuskunftAngebot({ kunde: "Was kostet das genau?", letzteRaus: { vorlage: null, text: "Wir holen Ihre Auskunft für 149 € einmalig." } }));
pruef("E241 bezogenAufAngebot: Ja/Rückfrage ja, Kartenfrage nein", bezogenAufAngebot("Ja, gern") && bezogenAufAngebot("Wie läuft das ab?") && bezogenAufAngebot("Klingt gut") && !bezogenAufAngebot("Wann kommt meine Karte?"));
// 7. Zahlender Kunde unverändert (E-240) — und die Firma liest ihren Einzelpreis
pruef("E241 Kunde ohne segment: „Wann kommt meine Karte?“ → Angebot wie bisher", auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: [], werbesperre: false }).jetzt);
// Dieselbe Lücke beim zahlenden Kunden: „Ja, gern" auf fiaon_kk_auskunft (Bremse: Vorlage vor 1 Tag)
const kundeJa = auskunftJetzt({ kunde: "Ja, gern", letzteDu: [], werbesperre: false, anderswo: true, aufAngebot: antwortetAufAuskunftAngebot({ kunde: "Ja, gern", letzteRaus: { vorlage: "fiaon_kk_auskunft" } }) });
pruef("E241 Kunde „Ja, gern“ auf die Vorlage → jetzt, trotz Bremse (seine Antwort)", kundeJa.jetzt && kundeJa.aufAngebot === true, JSON.stringify(kundeJa));
pruef("E241 Kunde: Block sagt „antwortet auf unser Angebot“", /antwortet auf unser Angebot der Bonitätsauskunft/.test(auskunftBlock({ ...AUSKUNFT_DE, ...kundeJa }).join("\n")));
const kundeKarte = auskunftJetzt({ kunde: "Wann kommt meine Karte?", letzteDu: [], werbesperre: false, anderswo: true, aufAngebot: true });
pruef("E241 Kunde „Wann kommt meine Karte?“ nach der Vorlage → kein zweites Angebot (E-240 bleibt)", !kundeKarte.jetzt && kundeKarte.schonAngeboten, JSON.stringify(kundeKarte));
pruef("E241 Kunde mit Werbesperre: „Ja, gern“ auf eine Vorlage → kein Angebot", !auskunftJetzt({ kunde: "Ja, gern", letzteDu: [], werbesperre: true, aufAngebot: true }).jetzt);
pruef("E241 Firma: „einzeln kostet sie 349 €“ statt 149 €", /einzeln kostet sie 349 €/.test(auskunftBlock({ ...AUSKUNFT_DE, art: "firma", preisText: "199 €", jetzt: true }).join("\n")));
// 8. Gegenlesen 25.09.2026: Auf WhatsApp ist jede spätere Nachricht „nach der Vorlage" — als Antwort
// auf das Angebot zählt sie nur, wenn sie sich darauf bezieht. Und ein Widerspruch ist immer ein Nein.
const nachVorlage = (k: string, segment: "lead" | "antrag" = "lead") => auskunftJetzt({ kunde: k, letzteDu: [], werbesperre: false, segment, aufAngebot: antwortetAufAuskunftAngebot({ kunde: k, letzteRaus: LEAD_VORLAGE }) });
for (const k of ["Wann kommt meine Karte?", "Ich suche unkompliziert eine Kreditkarte", "Wie hoch ist das Limit?", "Hallo, ich habe den Antrag ausgefüllt, wie geht es weiter mit der Karte?", "Wie viel Limit bekomme ich?"]) {
  const j = nachVorlage(k);
  pruef(`GL E241 Lead nach der Auskunft-Vorlage „${k.slice(0, 38)}“ → kein zweites Angebot`, !j.jetzt && !auskunftWerkzeugAn({ ...LEAD_AUSKUNFT, ...j }) && auskunftBlock({ ...LEAD_AUSKUNFT, ...j }).length === 0, JSON.stringify(j));
}
for (const k of ["Woher haben Sie meine Nummer?", "Löschen Sie bitte meine Daten.", "Ich habe mich nie angemeldet, ja?", "Ich widerspreche der Nutzung meiner Daten", "Bitte schicken Sie mir keine Nachrichten mehr, danke", "Wie kann ich mich abmelden?"]) {
  pruef(`GL E241 Widerspruch „${k}“ → Nein (auch als Frage), kein Angebot`, lehntAuskunftAb(k) && !nachVorlage(k).jetzt && !nachVorlage(k, "antrag").jetzt);
}
for (const k of ["Ja gerne 👍", "Ich habe eine Frage", "Was kostet das?", "Wieviel?", "Klingt interessant, wie läuft das ab?", "Ich habe Schufa Einträge, geht das trotzdem?", "Hallo, ja bitte schicken Sie mir das"]) {
  const j = nachVorlage(k);
  pruef(`GL E241 Lead nach der Auskunft-Vorlage „${k}“ → Antwort auf das Angebot`, j.jetzt && j.aufAngebot === true && auskunftWerkzeugAn({ ...LEAD_AUSKUNFT, ...j }), JSON.stringify(j));
}
pruef("GL E241 kein Nein: „Ich will nicht lange warten, ja bitte“, „Habe schon eine Kreditkarte, aber ja gern“",
  !lehntAuskunftAb("Ich will nicht lange warten, ja bitte") && !lehntAuskunftAb("Habe schon eine Kreditkarte, aber ja gern") && lehntAuskunftAb("Habe schon eine aktuelle Auskunft.") && lehntAuskunftAb("Will ich nicht, danke"));
// Die Firma im offenen Antrag (Takt: Business-Paket → Firmen-Auskunft 349 €) — der Block nennt ihren Preis.
const blockFirmaB = auskunftBlock({ ...LEAD_AUSKUNFT, segment: "antrag", art: "firma", preisText: "349 €", ...bFrage }).join("\n");
pruef("GL E241 B Firma: Block „349 € einmalig“, kein 149 €", /349 € einmalig/.test(blockFirmaB) && !/149 €/.test(blockFirmaB), blockFirmaB.slice(0, 200));
// Österreich: Block nennt KSV1870; „SCHUFA“ steht höchstens im Verbot selbst.
const blockAT = auskunftBlock({ ...LEAD_AUSKUNFT, land: "AT", ...jaLead }).join("\n");
pruef("GL E241 Lead AT: Block nennt KSV1870, „SCHUFA“ nur als Verbot", /KSV1870/.test(blockAT) && !/SCHUFA/.test(blockAT.replace(/das Wort SCHUFA schreibst du ihm nie/g, "")), blockAT.slice(0, 240));
console.log(`E-241 (Anträge und Leads, nur als Antwort): ${ok - vor241Ok} bestanden, ${fehl - vor241Fehl} nicht.`);
console.log(`Gesamt offline: ${ok} bestanden, ${fehl} nicht.`);

// ── 2. Mit dem echten Modell ───────────────────────────────────────────────
if (!process.argv.includes("--ki")) { process.exit(fehl ? 1 : 0); }
const arg = (n: string) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const nur = arg("--nur");
// --faelle <datei.json>: eigene Fälle [{id, lage: "LEAD"|"OHNE"|"ZAHLUNG"|"KUNDE", vorher?: string[], kunde: string[], ki?: boolean, erwartet}]
// --json <datei.json>: Ergebnisse maschinenlesbar ablegen.
const faelleDatei = arg("--faelle");
const jsonDatei = arg("--json");
const ergebnisse: any[] = [];

// E-240: auskunft/werbesperre wie lageFuer sie liefert — `jetzt` rechnet antworte() wie maraAntwortet.
type Lage = { wer: string; lage: string; ziel: string; link: string; verkaufen: boolean; personId?: number; auskunft?: Omit<AuskunftTeil, "jetzt" | "werbesperre"> | null; werbesperre?: boolean };
const LEAD: Lage = {
  wer: "Monika Zielinski, ihr fester Betreuer ist Daniel Stripling.",
  lage: "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.",
  ziel: "Er öffnet den Antrag und füllt ihn aus.", link: "https://fiaon.com/a/9dzhUyYwhY/w", verkaufen: true,
  // Mit --werkzeuge (lokale Prüf-DB, Fixture aus e2e-termin): Person 9101, Betreuerin Nina.
  personId: process.argv.includes("--werkzeuge") ? 9101 : undefined,
};
const OHNE: Lage = { wer: "Ein Interessent, den wir noch nicht kennen.", lage: "Noch kein Antrag.", ziel: "Er öffnet den Antrag und füllt ihn aus.", link: "https://fiaon.com/antrag", verkaufen: true };
const ZAHLUNG: Lage = { ...LEAD, lage: "Antrag fertig und abgeschickt (FIAON Pro (Standard)), die erste Zahlung über 59,99 € ist noch offen.", ziel: "Er aktiviert seinen Account mit der ersten Zahlung („Nach der Zahlung ist Ihr Account aktiv“ — kein Satz über die Partnerbank). Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code. Nennt er einen Zahltag, hältst du ihn mit zahlungszusage_merken fest.", link: "https://fiaon.com/zahlung/FIAON-7KQ2ZX" };
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
  { id: "S38", lage: ZAHLUNG, vorher: ["VORLAGE: Hallo Niko Mühlbauer, Ihre Rechnung über 99,99 € ist noch offen — Verwendungszweck FIAONMTSPAA. Sobald die Zahlung bei uns eingeht, aktiviere ich Ihr Konto umgehend."], kunde: ["Hallo, Ja ich weis, ich kann es leider erst am 30.09 zahlen. Falls das noch Ok ist."], erwartet: "Niko: passt, 30.09. festgehalten (Werkzeug), KEIN Partnerbank-Satz, kurz" },
  // E-240: Bonitätsauskunft (Doris Hösl) und Werbesperre — ohne --werkzeuge ohne DB, dann nur der Text.
  { id: "E1", lage: { ...KUNDE, wer: "Doris Hösl, ihr fester Betreuer ist Daniel Stripling.", lage: `${KUNDE.lage} Seine SCHUFA-Auskunft liegt uns noch nicht vor (weder bestellt noch hochgeladen).`, auskunft: { stufe: "nichts", land: "DE", preisText: "74 €", mitAbo: true, offenLink: null, offenBetrag: null } },
    vorher: ["DU: Hier ist Mara, die digitale Assistentin von FIAON."], kunde: ["Ich hab keine"], erwartet: "Auskunft als Vorteil, 74 € einmalig, Karte/Limit ohne Zusage, kein kostenloser Weg von sich aus" },
  { id: "E2", lage: LEAD, vorher: [BEGRUESSUNG], kunde: ["Ich suche unkompliziert eine Kreditkarte"], erwartet: "Ja zuerst + Link — KEIN Wort zu Bonität, Auskunft, Kontoauszügen" },
  { id: "E3", lage: { ...LEAD, werbesperre: true, verkaufen: false, lage: `${LEAD.lage} WERBESPERRE: Er hat gebeten, keine Werbung mehr zu bekommen.`, ziel: "Du beantwortest nur, was er fragt — vollständig und freundlich. Kein Angebot, kein Pitch, keine Aufforderung zum Abschluss, kein Link, nach dem er nicht fragt (fragt er danach, bekommt er ihn)." },
    vorher: [BEGRUESSUNG], kunde: ["Wie lange dauert das eigentlich?"], erwartet: "Antwort ohne Pitch und ohne Link" },
  { id: "S37", lage: { ...LEAD, lage: "Hatte früher einen Vertrag, der beendet ist, und hat jetzt über das Formular NEU angefragt — er ist wieder interessiert. Begrüße ihn wie einen neuen Interessenten; den alten Vertrag sprichst du nicht von dir aus an." }, vorher: [BEGRUESSUNG], kunde: ["Muss ich die Jahresgebühr im voraus Zahlen, ehe über den Antrag und das Limit entschieden wird ?"], erwartet: "Trommer: Raten statt Jahresgebühr, positiv, kein alter Vertrag" },
  // E-241 (25.09.2026): Antrag und Lead — die Auskunft nur als Antwort (ohne --werkzeuge ohne DB, dann nur der Text).
  { id: "E4", lage: { ...LEAD, auskunft: { stufe: "nichts", land: "DE", preisText: "149 €", mitAbo: false, offenLink: null, offenBetrag: null, segment: "lead" } },
    vorher: [BEGRUESSUNG, "VORLAGE: Hallo Monika Zielinski, hier ist Mara Lindner von FIAON, die digitale Assistentin im Team. Bevor eine Bank über Ihre Karte entscheidet, fragt sie bei den Auskunfteien nach — mit Ihrer SCHUFA-Auskunft sehen Sie vorher, was dort über Sie steht. Wir holen die Daten bei SCHUFA, CRIF und Creditreform Boniversum ein, erklären jeden Eintrag, prüfen die Speicherfristen und geben Ihnen Ihren Handlungsplan. Ihr Preis: 149 € einmalig, ohne Abo."],
    kunde: ["Ja, gern"], erwartet: "Auskunft 149 € einmalig, keine Hürde, nichts von Kontoauszügen/Hochladen" },
  { id: "E5", lage: { ...LEAD, auskunft: { stufe: "nichts", land: "DE", preisText: "149 €", mitAbo: false, offenLink: null, offenBetrag: null, segment: "lead" } },
    vorher: [BEGRUESSUNG], kunde: ["Ich suche unkompliziert eine Kreditkarte"], erwartet: "Lead mit Auskunft-Teil, ungefragt: nur Karte — KEIN Wort zu Bonität, Auskunft, Kontoauszügen" },
  { id: "E6", lage: { ...ZAHLUNG, auskunft: { stufe: "nichts", land: "DE", preisText: "149 €", mitAbo: false, offenLink: null, offenBetrag: null, segment: "antrag" } },
    vorher: ["VORLAGE: Hallo Monika Zielinski, Ihr Antrag ist angekommen — jetzt fehlt nur noch die Aktivierung."], kunde: ["Was kostet die Auskunft bei Ihnen?"], erwartet: "B: 149 € einmalig, keine Voraussetzung, erste Zahlung höchstens ein Satz" },
];

const wissen = wissenFuerWhatsApp();
const jetzt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
const heuteIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
function system(l: Lage, verlauf: string[], ki: boolean): string {
  return maraAuftrag({ name: "Mara Lindner", wer: l.wer, lage: l.lage, ziel: l.ziel, link: l.link, verkaufen: l.verkaufen,
    gedaechtnis: "", verlauf: verlauf.join("\n"), wissen, hausanweisung: "", kiHinweis: ki,
    werkzeuge: !!l.personId, betreuer: l.personId ? "Nina" : "Daniel", jetzt: `${jetzt} (heute = ${heuteIso})`, auskunft: auskunftFuer(l, verlauf) });
}
/** Wie maraAntwortet: dieselbe Regel (auskunftJetzt) — Maras Nachrichten neueste zuerst. */
function auskunftFuer(l: Lage, verlauf: string[]): AuskunftTeil | null {
  if (!l.auskunft) return null;
  const letzteAntwort = verlauf.map((z) => /^(DU|TEAM):/.test(z)).lastIndexOf(true);
  const kunde = verlauf.slice(letzteAntwort + 1).filter((z) => z.startsWith("KUNDE:")).map((z) => z.slice(7)).join("\n");
  const du = verlauf.filter((z) => z.startsWith("DU:")).map((z) => z.slice(4)).reverse();
  const werbesperre = !!l.werbesperre;
  // E-241: wie maraAntwortet — unsere letzte Nachricht vor seinen offenen (VORLAGE/DU/TEAM) war das Angebot?
  const ersteOffene = verlauf.findIndex((z, i) => i > letzteAntwort && z.startsWith("KUNDE:"));
  const davor = verlauf.slice(0, ersteOffene < 0 ? verlauf.length : ersteOffene).reverse().find((z) => /^(VORLAGE|DU|TEAM):/.test(z)) ?? null;
  const aufAngebot = istAuskunftAngebot(davor ? { vorlage: null, text: davor.replace(/^\w+:\s*/, "") } : null);
  return { ...l.auskunft, werbesperre, ...auskunftJetzt({ kunde, letzteDu: du, werbesperre, segment: l.auskunft.segment, aufAngebot }) };
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
  const a = auskunftFuer(l, verlauf);
  return entwerfen(system(l, verlauf, ki), {
    kunde, kontext, letzteDu, verkaufen: l.verkaufen, verlaufText: verlauf.join("\n"), zahlungslage: /Account aktiv|Eingang wird geprüft|Zahlungsseite/.test(l.ziel),
    auskunftAngebot: auskunftWerkzeugAn(a), werbesperre: !!l.werbesperre,
    // E-241: wie maraAntwortet — bei Antrag/Lead Preis und Land nur, wenn es um die Auskunft geht.
    bekannt: (() => { const im = !!a && ((a.segment ?? "kunde") === "kunde" || a.jetzt); return { links: [l.link], auskunftPreise: a && im ? [a.preisText, ...(a.mitAbo ? ["149 €"] : [])] : null, land: im ? a?.land ?? null : null }; })(),
  },
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
  // E-240: ohne Links gezählt, wie verkaufsPruefung (der Kauflink der Auskunft hat ~130 Zeichen).
  const lesbar = a.replace(/https?:\/\/\S+/g, "").trim().length;
  pruef(`${id}: höchstens 500 Zeichen`, lesbar <= 500, String(lesbar));
  if (id === "S38") { pruef("S38: kein Partnerbank-Satz", !/partnerbank|dkb/i.test(a), a.slice(0, 80)); if (process.argv.includes("--werkzeuge")) pruef("S38: Zahlungszusage festgehalten", (e.aktionen ?? []).some((x: any) => x.werkzeug === "zahlungszusage_merken" && x.ok)); }
  pruef(`${id}: keine Ausrede`, !verkaufsPruefung(a, { kunde, letzteDu: [], verkaufen: true }).some((h) => /redest ihn raus/.test(h)));
  if (id === "E1") pruef("E1: Auskunft angeboten, 74 €, keine Karten-/Löschzusage", /auskunft/i.test(a) && /74\s*€/.test(a) && !/kostenlos/i.test(a) && !/bekommen sie die karte|lösch\w* (?:wir|sicher)/i.test(a), a.slice(0, 120));
  if (id === "E2") pruef("E2: kein Wort zu Bonität/Auskunft/Kontoauszügen", !/bonit|schufa|auskunft|kontoausz/i.test(a), a.slice(0, 120));
  if (id === "E3") pruef("E3: Werbesperre — kein Link, kein Pitch", !/fiaon\.com\//i.test(a) && !/legen wir los|wollen wir starten|soll ich ihnen den antrag/i.test(a), a.slice(0, 120));
  // E-241: Lead/B als Antwort — 149 €, keine Hürde; ungefragt kein Wort.
  if (id === "E4" || id === "E6") pruef(`${id}: Auskunft mit 149 €, keine Karten-/Löschzusage, keine Kontoauszüge`, /auskunft/i.test(a) && /149\s*€/.test(a) && !/74\s*€/.test(a) && !/kontoausz|hochlad/i.test(a) && !/bekommen sie die karte|lösch\w* (?:wir|sicher)/i.test(a), a.slice(0, 160));
  if (id === "E5") pruef("E5: kein Wort zu Bonität/Auskunft/Kontoauszügen", !/bonit|schufa|auskunft|kontoausz/i.test(a), a.slice(0, 120));
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
