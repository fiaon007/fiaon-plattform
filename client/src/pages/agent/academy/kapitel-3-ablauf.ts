// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 3 — Der Ablauf Tag für Tag (23.08.2026, Plan §11)
// Quellen: Plan §1 (Ablauf), §3/§10.3 (Vergütung), §5 (Verteilung), §7 (Events),
// shared/fiaon-kundenstatus.ts (Stufen A/B/C, Statuswahrheit),
// shared/fiaon-onboarding-agenda.ts (Agenda), shared/fiaon-pakete.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, merk, warn, tab, schritte, frage } from "./typen";
import { AGENDA } from "@shared/fiaon-onboarding-agenda";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const eur = (c: number) => (c / 100).toFixed(2).replace(".", ",") + " €";
const preis = (key: string) => eur(PAKETE.find((x) => x.key === key)?.preisCents ?? 0);
const prov = (key: string) => eur(Math.round((PAKETE.find((x) => x.key === key)?.preisCents ?? 0) * 0.25));
const schufa = SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",") + " €";

export const KAPITEL_3: KapitelInhalt = {
  inhalte: {
    zeitleiste: {
      einleitung: "Klick dich an der Zeitleiste entlang – jede Station zeigt, wer handelt und was das System dabei tut. Erst wenn du alle Stationen geöffnet hast, gilt der Schritt als abgeschlossen.",
      uebung: { art: "zeitleiste", stationen: [
        { tag: "Minute 0", titel: "Der Lead entsteht", wer: "Kunde", text: "Ein Mensch füllt auf Facebook ein Formular aus (oder beginnt den Antrag auf fiaon.com, oder ruft an). Zwei Sekunden später ist er bei uns.", system: "Make-Szenario „FIAON Lead #1“ → POST /api/leads/intake. Zuweisung an einen Bonitätsmanager, der JETZT arbeitet (Status Online + Wochenplan); sonst an den, der als Nächster beginnt." },
        { tag: "Minute 1", titel: "Die Vorab-Nachricht", wer: "System in deinem Namen", text: "WhatsApp/SMS mit deinem Namen, deinem Foto und deinem Buchungslink. Der Kunde weiß, wer gleich anruft – und von welcher Nummer.", system: "Vorlage `vorab_lead` (Superchat heute, Twilio/WhatsApp Business künftig). Opt-in aus dem Formular." },
        { tag: "Minute 5", titel: "Dein Erstanruf", wer: "Du", text: "Speed-to-Lead ≤ 5 Minuten. Ziel: verstehen, was er will; erklären, was wir tun; einen nächsten Schritt verabreden – Antrag jetzt gemeinsam, oder Termin.", system: "Softphone im Office, Gesprächsblatt daneben. Nach dem Auflegen EIN Ergebnis klicken: Antrag gemacht, Termin, Rückruf, nicht erreicht, abgelehnt." },
        { tag: "Tag 0", titel: "Antrag und Vertrag", wer: "Kunde", text: "Zwei Minuten Antrag, Vertrag annehmen, Passwort. Dann zwei Karten: „Jetzt aktivieren“ oder „Zuerst sprechen“.", system: "Zustand „submitted“. Bei Abbruch: drei Erinnerungen mit Terminlink (nach 10 Minuten, dann Tages-Slots)." },
        { tag: "Tag 0–2", titel: "Zahlung", wer: "Kunde", text: "Überweisung mit QR-Code oder Lastschrift-Mandat. Klickt er „Ich habe überwiesen“, wird er Stufe A – Beleg holen, nicht glauben.", system: "Kommt binnen 48 h kein Geld: automatische Erinnerung mit Terminlink; du siehst ihn unter „wartet auf Zahlung“." },
        { tag: "Tag 1–3", titel: "Kontoabgleich", wer: "Back-Office", text: "Der Wise-Auszug wird täglich eingespielt, Zuordnungen bestätigt. Erst jetzt heißt es „Bezahlt“.", system: "Event `payment_confirmed` (einmalig, richtiger Betrag). Provision „rate“ entsteht für dich – bankbestätigt." },
        { tag: "Tag 2–5", titel: "Das Startgespräch", wer: "Du", text: "Pflicht, 15 Minuten, feste Agenda. Danach ist der Bereich voll aktiv. Wer vorher einen Termin gebucht hat, braucht keinen zweiten.", system: "Terminbestätigung, Erinnerung 24 h und 1 h vorher, Zeit in Europe/Berlin. Nur Zeiten aus deinem Wochenplan." },
        { tag: "Tag 5–30", titel: "Auskunft und Analyse", wer: "FIAON", text: "Vollmacht, Beschaffung der Auskunft (SCHUFA / KSV1870 / CRIF / Betreibungsregister), Einsicht etwa 24 Stunden nach Eingang. Unterlagen: Kontoauszug, Ausweis.", system: "Events `schufa_requested`/`schufa_approved`; Einträge in der Akte mit Bewertung; du prüfst, bevor der Kunde sie sieht." },
        { tag: "Monat 1–12", titel: "Schreiben und Fristen", wer: "Kunde gibt frei · Back-Office versendet · du hältst nach", text: "Datenkopie, Löschantrag, Widerspruch, Nachweisanforderung, Ratenangebot – per Einschreiben, mit Frist. Antworten werden bewertet, die nächste Stufe vorgeschlagen.", system: "Ticket an das Back-Office aus der Akte; Status kommt zurück; Fristenkalender." },
        { tag: "Jeden Monat", titel: "Die Rate", wer: "System", text: "Am Monatstag der ersten Zahlung entsteht die nächste Rate – Lastschrift oder Überweisung. In der Akte steht, was dafür passiert ist.", system: "Abo-Motor: `rate_faellig` Tag −3, Erinnerungen Tag 0/3/7, Lastschrift-Wiederholung." },
        { tag: "Tag 14 offen", titel: "Dein Anruf", wer: "Du", text: "Die bekannte Stimme ruft an: Grund erfahren, Lage einordnen, Zahlungsvereinbarung treffen. Kein Druck, keine Drohung.", system: "Collections zeigt dir, wer dran ist. Ergebnis klicken: zahlt am, Ratenplan, nicht erreicht." },
        { tag: "Tag 30 offen", titel: "Back-Office", wer: "Diana", text: "Letzte Mahnung, Sperre des Bereichs, Übergabe an externes Inkasso, Titel – würdevoll, nach Regeln.", system: "`rate_mahnung` Tag 14/21, `account_suspended`. Nach Zahlung: `payment_reactivated`." },
        { tag: "Monatsende", titel: "Deine Provision", wer: "Wallet", text: "25 % jeder bankbestätigten Rate deiner Kunden, plus Boni. Auszahlung monatlich. Kein Deckel.", system: "fiaon_commissions, Art „rate“. Provisionsabrechnung per Mail; Summen = Wallet." },
        { tag: "Monat 12", titel: "Die Verlängerung", wer: "Kunde", text: "FIAON fragt, ob er bleibt. Die Kurve beantwortet das. Bleibt er, läuft deine Provision weiter.", system: "Abo-Zyklus, Erinnerung vor der zwölften Rate." },
      ] },
    },
    "lead-klassen": {
      einleitung: "Drei Klassen, eine Reihenfolge. Die Pipeline sortiert, du arbeitest von oben nach unten: dort anfangen, wo am wenigsten fehlt.",
      bloecke: [
        tab(["Stufe", "Wer", "Was fehlt", "Was du tust"],
          ["A", "„Ich habe überwiesen“ geklickt", "Der Beleg – das Geld ist noch nicht bankbestätigt", "Beleg erbitten (Foto), im Kontoabgleich prüfen lassen. Kein Anruf mehr nötig, wenn die Zahlung im Fluss abgeschlossen ist (Lastschrift-Mandat). Kommt binnen 48 h nichts: automatische Erinnerung mit Terminlink."],
          ["B", "Antrag fertig, Rechnung offen", "Das Geld – hier liegt das meiste", "Zahlungsdaten senden oder am Telefon durchgeben, Zahlungsdatum vereinbaren. Abbruch-Erinnerungen bringen Terminlinks; gebuchte Gespräche werden gehalten."],
          ["C", "Facebook-Lead ohne Antrag", "Alles – Interesse, Antrag, Zahlung", "Speed-to-Lead ≤ 5 Minuten, Vorab-Nachricht mit deinem Namen, Anruf von erwarteter Nummer. Nicht erreicht in 24 h → der Lead wandert zurück in den Pool."],
        ),
        p("Die Statuswahrheit (eine Regel, sieben Zustände): Das Wort „bezahlt“ tragen ausschließlich bankbestätigte Zahlungen. Sagt der Kunde, er habe überwiesen, heißt es „Kunde meldet Zahlung – noch nicht bankbestätigt“. Dieser Zusatz darf nie fehlen. Zwei Mitarbeiter sahen einmal verschiedene Texte für denselben Zustand und riefen denselben Menschen an – das ist der Grund für diese Regel."),
        merk("Ein undokumentiertes Gespräch hat für das System nicht stattgefunden: keine Wiedervorlage, kein Besitzanspruch, kein Schutz vor dem Doppelanruf eines Kollegen. Nach jedem Gespräch ein Klick."),
        ul(
          "Kapazität: Wer viele aktive Kunden hat, bekommt weniger neue Leads (Richtwert 120 für die Verteilung). Für deinen Verdienst gibt es keinen Deckel.",
          "Fairness: Die Geschäftsführung sieht, wer wie viele Leads und Termine bekam, Quote und Kapazität – und kann Gewichte setzen (neue Kollegen weniger).",
          "Das Back-Office erhält keine Leads.",
        ),
      ],
    },
    zahlung: {
      einleitung: "Geld folgt dem Geld: Deine Provision entsteht, wenn Geld bei FIAON ankommt – nicht, wenn jemand es verspricht.",
      bloecke: [
        schritte("So läuft eine Zahlung",
          ["Zahlungsdaten", "Im Kundenbereich: Empfänger, IBAN, Verwendungszweck (Pflicht – die Referenz des Kunden), QR-Code (EPC) zum Scannen mit der Banking-App, Kopieren-Knopf. Alternativ: SEPA-Lastschrift-Mandat über GoCardless – Geld landet direkt auf dem FIAON-Konto bei Wise."],
          ["Der Kunde zahlt", "Überweisung dauert einen Bankarbeitstag, Lastschrift zieht am Fälligkeitstag. Klickt er „Ich habe überwiesen“, ist er Stufe A."],
          ["Kontoabgleich", "Das Back-Office spielt täglich den Wise-Auszug ein und bestätigt Zuordnungen (Betrag + Verwendungszweck). Fehlt der Verwendungszweck, dauert es – deshalb ist er Pflicht."],
          ["Bestätigung", "Status „Bezahlt“, Event `payment_confirmed` an den Kunden, Provision „rate“ für dich. Jetzt: Startgespräch buchen (falls nicht schon ein Termin steht)."],
        ),
        warn(`Falsche Beträge kommen vor: Der Kunde wollte die Bonitätsauskunft (${schufa}) und überweist ${preis("ultra")} – oder umgekehrt. Nie stillschweigend umbuchen. Anrufen, klären, Differenz über das Back-Office erstatten oder anrechnen, Entscheidung in die Akte.`),
        ul(
          "Kein Stripe, kein Zahlungsdienstleister, der Guthaben einbehalten kann (E-037). Liquidität bleibt direkt bei FIAON.",
          "Rücklastschriften (Konto nicht gedeckt) gehen an das Back-Office; der Zahlungsmotor wiederholt die Lastschrift und erinnert.",
          "Erstattungen: nur über das Back-Office, nie „aus der Kasse“. Eine Erstattung storniert die zugehörige Provision.",
        ),
      ],
    },
    startgespraech: {
      einleitung: "Das Startgespräch ist der Grund, warum der Kunde bleibt. 15 Minuten, sieben Schritte, Pflichtnotizen – die Agenda ist dieselbe wie im Office-Cockpit.",
      bloecke: [
        tab(["#", "Schritt", "Zweck"], ...AGENDA.map((a, i) => [String(i + 1), a.titel, a.zweck])),
        ...AGENDA.map((a) => ({ art: "kacheln" as const, kacheln: [{ titel: a.titel, text: a.punkte.join(" · ") + (a.notizPflicht ? " — Pflichtnotiz: " + (a.notizFrage || "") : "") }] })),
        merk("Erst wenn alle Pflichtschritte mit Notiz stehen, lässt sich das Gespräch abschließen – und erst dann ist der Bereich vollständig freigeschaltet. Erscheint der Kunde nicht, bekommt er eine neue Einladung, keine Mahnung."),
        p("Der häufigste Streitfall beginnt mit „Ich dachte, das war einmalig“. Deshalb Schritt 6: Betrag nennen, Datum der nächsten Abbuchung nennen, Kündigungsweg nennen (Abo & Zahlungen im Bereich oder formlos per E-Mail, zum Ende des laufenden Monats) – und die Antwort des Kunden wörtlich in die Notiz."),
      ],
    },
    raten: {
      einleitung: "Der Zahlungsmotor ersetzt das Telefon-Inkasso. Er erinnert, wiederholt, mahnt – und sagt dir, wann du dran bist.",
      bloecke: [
        tab(["Tag", "Was passiert", "Wer"],
          ["−3", "`rate_faellig`: Hinweis mit Betrag, Referenz, Zahlungslink", "System"],
          ["0", "Rate entsteht; Lastschrift zieht oder Überweisung wird erwartet", "System"],
          ["0 / 3 / 7", "`rate_erinnerung` per Mail, SMS, künftig WhatsApp; Lastschrift-Wiederholung", "System"],
          ["14", "Du rufst an – bekannte Stimme, Grund erfahren, Vereinbarung treffen, Ergebnis klicken", "Du"],
          ["14 / 21", "`rate_mahnung`: strenger im Inhalt, nicht im Ton; Frist, Sperrhinweis", "System"],
          ["30", "Back-Office: letzte Mahnung, Sperre des Bereichs (`account_suspended`), Übergabe, Titel", "Diana"],
          ["nach Zahlung", "`payment_reactivated`: Bereich wieder offen, Provision entsteht", "System"],
        ),
        p("Haltequote aus den Daten (Plan §10.3): 80 Prozent zahlen Rate 2, danach 92 Prozent je Folgemonat. Jeder Prozentpunkt, den du durch ein gutes Startgespräch und einen freundlichen Tag-14-Anruf gewinnst, ist dein Geld – und der Quartalsbonus (≥ 85 % pünktlich) hängt genau daran."),
        merk("Wir sprechen mit Menschen, die Geld schulden – nicht mit Schuldnern. Der Tag-14-Anruf ist ein Hilfsangebot mit Datum, keine Mahnung mit Stimme."),
      ],
    },
    provision: {
      einleitung: "Laufend, proportional zum Paket, ohne Deckel: 25 Prozent jeder bezahlten Rate deiner Kunden – ab der Startzahlung, zwölf Monate, auch in der Verlängerung.",
      bloecke: [
        tab(["Paket", "Rate", "Für dich je Rate", "Über 12 Monate"],
          ...PAKETE.filter((x) => x.abo).map((x) => [x.label, eur(x.preisCents), eur(Math.round(x.preisCents * 0.25)), eur(Math.round(x.preisCents * 0.25) * 12)]),
          ["Bonitätsauskunft (einmalig)", schufa, eur(Math.round(SCHUFA_PREIS_EURO * 100 * 0.25)), "–"],
        ),
        ul(
          "Boni: 250 € je Quartal bei ≥ 85 % pünktlichen Raten im eigenen Stamm · 500 € bei 50 aktiven Kunden · 1.000 € bei 100 aktiven Kunden (einmalig je Schwelle).",
          "Auszahlung monatlich, nur auf bankbestätigte Eingänge. Das Wallet zeigt den Stand in Echtzeit; die Provisionsabrechnung kommt per Mail, Summen = Wallet.",
          "Zertifizierte Bonitätsmanager (diese Academy bestanden): Basis + 5 Prozentpunkte.",
          "Kein Deckel: Dein Stamm darf beliebig groß werden. Wächst er über das, was du allein betreuen kannst, bekommst du Unterstützung – keine Abzüge.",
          `Beispiel: 5 Abschlüsse am Tag, Ø Rate 64,36 € (echter Paketmix Juli/August), Haltequote 80/92 % → Monat 1 rund 1.689 €, Monat 6 rund 7.449 €, Monat 12 rund 11.832 € (Rechenmodell, keine Zusage – siehe Earnings).`,
        ),
        merk(`Ein Pro-Kunde, der zwölf Raten zahlt, bringt dir ${eur(Math.round((PAKETE.find((x) => x.key === "pro")?.preisCents ?? 0) * 0.25) * 12)}. Ein Termin, der nicht zum Kunden wird, bringt nichts. Das Modell belohnt Begleitung, nicht Anrufe.`),
        p(`Zum Vergleich das alte Modell: 20 % der Startzahlung einmalig (Vertrieb) bzw. 15 € je gehaltenem Termin (Onboarding). Im ersten Monat gleichwertig – ab Monat 6 verdient ein Bonitätsmanager das Vier- bis Fünffache, weil jeder gehaltene Kunde weiterzahlt. Ein Start-Kunde bringt ${prov("start")} je Rate, ein Business-Enterprise-Kunde ${prov("business_enterprise")}.`),
      ],
    },
  },
  test: [
    frage("Ein Facebook-Lead kommt herein. Was geschieht, bevor du anrufst?", ["Nichts", "Eine Vorab-Nachricht mit deinem Namen, Foto und Buchungslink geht im System in deinem Namen raus", "Der Lead wird an das Back-Office gegeben", "Der Kunde erhält eine Rechnung"], 1, "So weiß der Kunde, wer gleich anruft – und von welcher Nummer."),
    frage("Der Kunde hat „Ich habe überwiesen“ geklickt. Welche Stufe, welcher Status?", ["Stufe C, „Lead“", "Stufe A, „Kunde meldet Zahlung – noch nicht bankbestätigt“", "Stufe B, „Bezahlt“", "Archiviert"], 1, "Beleg holen, Kontoabgleich abwarten. „Bezahlt“ nur bankbestätigt."),
    frage("Wann wird der Kundenbereich vollständig freigeschaltet?", ["Nach dem Antrag", "Nach Zahlung und abgeschlossenem Startgespräch mit allen Pflichtnotizen", "Nach der ersten Rate", "Nach der Auskunft"], 1, "Erst alle Pflichtschritte, dann Freischaltung."),
    frage("Welcher Schritt der Agenda räumt den häufigsten Streitfall aus?", ["Plattform-Tour", "Abo-Klarheit: Betrag, nächste Abbuchung, Kündigungsweg – Antwort wörtlich notieren", "Begrüßung", "Unterlagen"], 1, "„Ich dachte, das war einmalig“ – dieser Schritt verhindert es."),
    frage("Eine Rate ist seit 14 Tagen offen. Wer ruft an?", ["Das Back-Office", "Ein externes Inkasso", "Du – als bekannte Stimme, mit Hilfsangebot und Datum", "Die Geschäftsführung"], 2, "Tag 0–14 Zahlungsmotor, Tag 14 du, Tag 30 Back-Office."),
    frage(`Ein Kunde mit FIAON High-End zahlt Rate 4. Was bekommst du bei 25 %?`, [prov("start"), prov("pro"), prov("ultra"), prov("highend")], 3, "25 % jeder bezahlten Rate des eigenen Kunden."),
    frage("Der Kunde schickt einen Überweisungs-Screenshot. Was ist richtig?", ["Status auf „Bezahlt“ setzen", "Status bleibt „Kunde meldet Zahlung“; der Kontoabgleich entscheidet", "Provision sofort auszahlen", "Den Screenshot löschen"], 1, "Zahlungen werden bestätigt, nicht geglaubt."),
  ],
};
