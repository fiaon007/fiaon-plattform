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
        { tag: "Tag 0–2", titel: "Die erste Zahlung – immer direkt", wer: "Kunde", text: "Die erste Zahlung ist immer eine direkte Überweisung mit Zahlungsreferenz (Zahlungsdaten im Bereich und per E-Mail, QR-Code). Nie Lastschrift für die erste Rate. Klickt er „Ich habe überwiesen“, wird er Stufe A – Beleg holen, nicht glauben.", system: "Kommt binnen 48 h kein Geld: automatische Erinnerung mit Terminlink; du siehst ihn unter „wartet auf Zahlung“." },
        { tag: "Tag 1–3", titel: "Kontoabgleich", wer: "Back-Office", text: "Der Wise-Auszug wird täglich eingespielt, Zuordnungen bestätigt. Erst jetzt heißt es „Bezahlt“.", system: "Event `payment_confirmed` (einmalig, richtiger Betrag). Provision „rate“ entsteht für dich – bankbestätigt." },
        { tag: "Tag 2–5", titel: "Das Startgespräch", wer: "Du", text: "Pflicht, 15 Minuten, feste Agenda. Danach ist der Bereich voll aktiv. Wer vorher einen Termin gebucht hat, braucht keinen zweiten.", system: "Terminbestätigung, Erinnerung 24 h und 1 h vorher, Zeit in Europe/Berlin. Nur Zeiten aus deinem Wochenplan." },
        { tag: "Tag 5–30", titel: "Auskunft und Analyse", wer: "FIAON", text: "Vollmacht, Beschaffung der Auskunft (SCHUFA / KSV1870 / CRIF / Betreibungsregister), Einsicht etwa 24 Stunden nach Eingang. Unterlagen: Kontoauszug, Ausweis.", system: "Events `schufa_requested`/`schufa_approved`; Einträge in der Akte mit Bewertung; du prüfst, bevor der Kunde sie sieht." },
        { tag: "Monat 1–12", titel: "Schreiben und Fristen", wer: "Kunde gibt frei · Back-Office versendet · du hältst nach", text: "Datenkopie, Löschantrag, Widerspruch, Nachweisanforderung, Ratenangebot – per Einschreiben, mit Frist. Antworten werden bewertet, die nächste Stufe vorgeschlagen.", system: "Ticket an das Back-Office aus der Akte; Status kommt zurück; Fristenkalender." },
        { tag: "Jeden Monat", titel: "Die Rate", wer: "System", text: "Am Monatstag der ersten Zahlung entsteht die nächste Rate – ab Rate 2 per SEPA-Lastschrift (GoCardless) oder Überweisung. In der Akte steht, was dafür passiert ist.", system: "Abo-Motor: `rate_faellig` Tag −3, Erinnerungen Tag 0/3/7, Lastschrift-Wiederholung." },
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
          ["A", "„Ich habe überwiesen“ geklickt, kein Termin", "Der Termin – und der Beleg (das Geld ist noch nicht bankbestätigt)", "Willkommensanruf nach Leitfaden A: herzlich willkommen, die Karte als Ziel oben halten, Termin zur Aktivierung sofort aus deiner Availability eintragen, die eingeleitete Zahlung beiläufig bestätigen lassen. Beleg erbitten, Kontoabgleich entscheidet. Kommt binnen 48 h nichts: automatische Erinnerung mit Terminlink."],
          ["B", "Antrag fertig, Rechnung offen", "Das Geld – hier liegt das meiste", "Leitfaden B: an den Antrag anknüpfen (Kreditkarte, FIAON-Konzept), Termin sofort eintragen, auf die Rechnung hinweisen, Zahlungsdaten mit Referenz per Mail schicken (erste Zahlung immer direkt). Abbruch-Erinnerungen bringen Terminlinks; gebuchte Gespräche werden gehalten."],
          ["C", "Facebook-Lead ohne Antrag", "Alles – Interesse, Antrag, Zahlung", "Speed-to-Lead ≤ 5 Minuten, Vorab-Nachricht mit deinem Namen, Anruf von erwarteter Nummer. Leitfaden C: Daten aufnehmen, Vertrag am Telefon (Einwilligung zur Aufnahme, Annahmesatz, Bestätigung in Textform), Zugänge schicken, Termin, Rechnung vor dem Termin. Nicht erreicht in 24 h → der Lead wandert zurück in den Pool."],
        ),
        p("Die Statuswahrheit (eine Regel, sieben Zustände): Das Wort „bezahlt“ tragen ausschließlich bankbestätigte Zahlungen. Sagt der Kunde, er habe überwiesen, heißt es „Kunde meldet Zahlung – noch nicht bankbestätigt“. Dieser Zusatz darf nie fehlen. Zwei Mitarbeiter sahen einmal verschiedene Texte für denselben Zustand und riefen denselben Menschen an – das ist der Grund für diese Regel."),
        merk("Ein undokumentiertes Gespräch hat für das System nicht stattgefunden: keine Wiedervorlage, kein Besitzanspruch, kein Schutz vor dem Doppelanruf eines Kollegen. Nach jedem Gespräch ein Klick."),
        ul(
          "Arbeitsweise: Deine Arbeitsliste zeigt immer genau 6 frische Kunden (2 je Gruppe) – anrufen, Ergebnis festhalten, der Nächste rückt nach. So bleibt es aufgeräumt, und es kommen endlos neue Kunden. Dein Bestand wächst dabei mit: Du kannst bis zu 500 Kunden gleichzeitig betreuen, erst danach gibst du ab. Übergibst du einen Kunden freiwillig an einen Kollegen, geht der Anspruch auf dessen Provision mit über. Termine zählen separat: Deine eingetragene Availability soll mit Terminen komplett ausgelastet sein. Für deinen Verdienst gibt es keinen Deckel.",
          "Termine vergibst du sofort im Gespräch aus deiner eigenen Availability und trägst sie ein – der Slot ist dann wirklich blockiert. Kein „ich schicke Ihnen einen Link“.",
          "Fairness: Die Geschäftsführung sieht, wer wie viele Leads und Termine bekam, Quote und Kapazität – und kann Gewichte setzen (neue Kollegen weniger).",
          "Das Back-Office erhält keine Leads.",
        ),
      ],
    },
    zahlung: {
      einleitung: "Geld folgt dem Geld: Deine Provision entsteht, wenn Geld bei FIAON ankommt – nicht, wenn jemand es verspricht.",
      bloecke: [
        schritte("So läuft eine Zahlung",
          ["Zahlungsdaten", "Die erste Zahlung ist IMMER direkt: Überweisung mit Zahlungsreferenz – Empfänger, IBAN, Verwendungszweck (Pflicht), QR-Code (EPC) zum Scannen, Kopieren-Knopf; die Zahlungsdaten gehen zusätzlich per E-Mail raus (aus der Akte: Zahlungsdaten senden). Nie Lastschrift für die erste Rate. GoCardless (SEPA-Lastschrift) nur für die Folgeraten – Geld landet direkt auf dem FIAON-Konto bei Wise."],
          ["Der Kunde zahlt", "Überweisung dauert einen Bankarbeitstag, Lastschrift zieht am Fälligkeitstag. Klickt er „Ich habe überwiesen“, ist er Stufe A."],
          ["Kontoabgleich", "Das Back-Office spielt täglich den Wise-Auszug ein und bestätigt Zuordnungen (Betrag + Verwendungszweck). Fehlt der Verwendungszweck, dauert es – deshalb ist er Pflicht."],
          ["Bestätigung", "Status „Bezahlt“, Event `payment_confirmed` an den Kunden, Provision „rate“ für dich. Jetzt: Startgespräch buchen (falls nicht schon ein Termin steht)."],
        ),
        warn(`Falsche Beträge kommen vor: Der Kunde wollte die Bonitätsauskunft (${schufa}) und überweist ${preis("ultra")} – oder umgekehrt. Nie stillschweigend umbuchen. Anrufen, klären, Differenz über das Back-Office erstatten oder anrechnen, Entscheidung in die Akte.`),
        ul(
          "Kein Stripe, kein Zahlungsdienstleister, der Guthaben einbehalten kann (E-037). Liquidität bleibt direkt bei FIAON.",
          "Merksatz: Rate 1 = Überweisung mit Referenz. Rate 2 bis 12 = GoCardless-Lastschrift (Mandat richtet der Kunde im Bereich ein) oder Überweisung.",
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
          ["14", "Du rufst an – weich, mit Entschuldigung (Reaktivierungs-Leitfaden). Zwei Wege: Zahlung erreichen (Reaktivierungsbonus 50 % des Zahlungswerts) oder die Rate einen Monat aussetzen (0 €, aber vorgestellt + Onboarding-Termin gebucht)", "Du"],
          ["14 / 21", "`rate_mahnung`: strenger im Inhalt, nicht im Ton; Frist, Sperrhinweis", "System"],
          ["30", "Back-Office: letzte Mahnung, Sperre des Bereichs (`account_suspended`), Übergabe, Titel", "Diana"],
          ["nach Zahlung", "`payment_reactivated`: Bereich wieder offen, Provision entsteht", "System"],
        ),
        p("Haltequote aus den Daten (Plan §10.3): 80 Prozent zahlen Rate 2, danach 92 Prozent je Folgemonat. Jeder Prozentpunkt, den du durch ein gutes Startgespräch und einen freundlichen Tag-14-Anruf gewinnst, ist dein Geld – und der Quartalsbonus (≥ 85 % pünktlich) hängt genau daran."),
        merk("Wir sprechen mit Menschen, die Geld schulden – nicht mit Schuldnern. Der Tag-14-Anruf ist ein Hilfsangebot mit Datum, keine Mahnung mit Stimme."),
      ],
    },
    provision: {
      einleitung: "Vier Bausteine (E-042): 25 Prozent jeder bankbestätigten Paket-Rate (30 Prozent mit Academy-Zertifikat) · 10 € je SCHUFA-Zahlung im Onboarding · Reaktivierungsbonus 50 Prozent · Boni. Ohne Deckel.",
      bloecke: [
        tab(["Baustein", "Was du bekommst", "Wann"],
          ["Laufende Provision", "25 % jeder bankbestätigten Paket-Rate deiner Kunden (30 % mit Academy-Zertifikat) – ab der Startzahlung, zwölf Monate, auch in der Verlängerung", "bei jedem Kontoabgleich"],
          ["SCHUFA-Zahlung im Onboarding", `10 € je ${schufa}-Bonitätsauskunft, die dein Kunde im Onboarding zahlt – das ist das Ziel jedes Onboarding-Termins. Entfällt bei Altkunden, die schon gezahlt haben: dann trotzdem Onboarding führen, dein Verdienst läuft über die laufenden Provisionen.`, "bei bankbestätigter Zahlung"],
          ["Reaktivierungsbonus", "50 % des Zahlungswerts, wenn ein Kunde mit überfälliger Rate durch dein Gespräch zahlt", "bei bankbestätigter Zahlung"],
          ["Aussetzen statt Druck", "0 € – du darfst die überfällige Rate einen Monat aussetzen. Dafür hast du dich vorgestellt und den Onboarding-Termin gebucht: Der Kunde bleibt, und ab der nächsten Rate läuft deine Provision wieder.", "deine Entscheidung im Gespräch"],
        ),
        tab(["Paket", "Rate", "Für dich je Rate (25 %)", "Mit Zertifikat (30 %)", "Über 12 Monate (25 %)"],
          ...PAKETE.filter((x) => x.abo).map((x) => [x.label, eur(x.preisCents), eur(Math.round(x.preisCents * 0.25)), eur(Math.round(x.preisCents * 0.3)), eur(Math.round(x.preisCents * 0.25) * 12)]),
          ["Bonitätsauskunft (Onboarding)", schufa, "10,00 € fest", "10,00 € fest", "–"],
        ),
        ul(
          "Boni: 250 € je Quartal bei ≥ 85 % pünktlichen Raten im eigenen Stamm · 500 € bei 50 aktiven Kunden · 1.000 € bei 100 aktiven Kunden (einmalig je Schwelle).",
          "Auszahlung monatlich, nur auf bankbestätigte Eingänge. Das Wallet zeigt den Stand in Echtzeit; die Provisionsabrechnung kommt per Mail, Summen = Wallet.",
          "Zertifizierte Bonitätsmanager (diese Academy bestanden): 30 statt 25 Prozent (Basis + 5 Prozentpunkte).",
          "Kein Deckel: Dein Stamm darf beliebig groß werden. Wächst er über das, was du allein betreuen kannst, bekommst du Unterstützung – keine Abzüge.",
          "Das Back-Office (Forderungen & Zahlungen) hat keinen Provisionsanteil – ein eigenes Vergütungsmodell folgt.",
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
    frage("Wie zahlt der Kunde die ERSTE Rate?", ["Per SEPA-Lastschrift über GoCardless", "Immer direkt per Überweisung mit Zahlungsreferenz – Zahlungsdaten im Bereich und per E-Mail", "Per Stripe", "Bar"], 1, "Erste Zahlung immer direkt; GoCardless nur für Folgeraten."),
    frage("Ein überfälliger Kunde zahlt seine Rate nach deinem Anruf. Was bekommst du?", ["Nichts extra", "Den Reaktivierungsbonus: 50 % des Zahlungswerts – zusätzlich läuft die normale Provision weiter", "Die ganze Rate", "10 €"], 1, "E-042: Reaktivierung wird stark belohnt."),
    frage("Was ist das Ziel jedes Onboarding-Termins – und was bringt es dir?", ["Ein Upgrade", `Die Bonitätsauskunft (${schufa}): zahlt der Kunde sie im Onboarding, bekommst du 10 € (entfällt bei Altkunden, die schon gezahlt haben)`, "Eine Kündigung vermeiden", "Nichts"], 1, "10 € je SCHUFA-Zahlung im Onboarding."),
    frage("Wie viele frische Kunden zeigt deine Arbeitsliste gleichzeitig – und wie groß darf dein Bestand werden?", ["Alle offenen Kunden auf einmal · Bestand unbegrenzt", "6 (2 je Gruppe) · Bestand bis 500, dann wird abgegeben", "10 · Bestand bis 50", "1 · Bestand bis 100"], 1, "Die Arbeitsliste bleibt mit 6 Karten aufgeräumt; betreuen kannst du bis zu 500 Kunden, erst dann gibst du ab."),
    frage("Der Kunde schickt einen Überweisungs-Screenshot. Was ist richtig?", ["Status auf „Bezahlt“ setzen", "Status bleibt „Kunde meldet Zahlung“; der Kontoabgleich entscheidet", "Provision sofort auszahlen", "Den Screenshot löschen"], 1, "Zahlungen werden bestätigt, nicht geglaubt."),
  ],
};
