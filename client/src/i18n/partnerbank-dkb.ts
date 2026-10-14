// ═══════════════════════════════════════════════════════════════════════════
// /partnerbank-dkb · /en/partner-bank-dkb — das Wörterbuch der Seite (14.10.2026)
// Beide Sprachen Schlüssel für Schlüssel; die Seite liest über useWoerter().
// Zahlen der Bank NUR aus shared/fiaon-partnerbank-dkb.ts (Stand dort) — die
// FAQ-Antworten sind reine Zeichenketten (der FAQ-Generator liest nur die) und
// nennen deshalb ihre Zahlen selbst: bei einer Konditionsänderung mitziehen.
// Keine Zusagen — über Konto, Karte und Rahmen entscheidet die Bank.
// Der FAQ-Generator teilt an „const en".
// ═══════════════════════════════════════════════════════════════════════════
import { DKB, DKB_AKTION } from "@shared/fiaon-partnerbank-dkb";
import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ, KARTE_ZEIT_KURZ } from "@shared/fiaon-karten-weg";

type Symbol = "konto" | "karte" | "uhr" | "blitz" | "wechsel" | "handy" | "schild" | "regler" | "schloss" | "glocke" | "zwei" | "stern" | "kind" | "link" | "pfad" | "auswertung" | "mensch" | "kiosk" | "notfall" | "rahmen";

const de = {
  metaTitel: "DKB Konto & Visa Karte über FIAON · Alle Vorteile",
  metaBeschreibung: "Girokonto und Visa Kreditkarte unserer Partnerbank DKB: kostenlose Kontoführung ab 700 € Eingang, Aktivstatus, Echtzeitüberweisung — begleitet von FIAON.",
  pille: "Partnerbank · DKB",
  h1a: "Konto und Karte. ", h1b: "Mit unserer Partnerbank.",
  lead: "Das Girokonto der DKB mit Visa Debitkarte, dazu auf Wunsch die Visa Kreditkarte — für FIAON-Kunden mit persönlichem Link, in der richtigen Reihenfolge und mit Ihrem Betreuer an der Seite.",
  knopfStart: "Mit FIAON starten", knopfVorteile: "Alle Vorteile",
  symbolbild: "Symbolbild",
  karteDebit: "Visa Debit", karteKredit: "Visa Kredit", karteKonto: "Girokonto", karteKarte: "Kreditkarte",
  chips: [
    { s: "blitz" as Symbol, t: `Echtzeit · ${DKB.echtzeitSekunden} Sekunden` },
    { s: "handy" as Symbol, t: "Apple Pay & Google Pay" },
    { s: "konto" as Symbol, t: `0 € Kontoführung ab ${DKB.geldeingangEuro} €` },
    { s: "stern" as Symbol, t: "Weltweit kostenlos mit Aktivstatus" },
  ],
  zahlen: [
    { wert: "0 €", label: `Kontoführung ab ${DKB.geldeingangEuro} € Geldeingang im Monat oder unter ${DKB.freiBisAlter}` },
    { wert: "0 €", label: "Jahresgebühr für die Visa Debitkarte" },
    { wert: `${DKB.echtzeitSekunden} s`, label: "Echtzeitüberweisung auf andere SEPA-Konten, rund um die Uhr" },
    { wert: `${DKB.einlagensicherungEuro} €`, label: "gesetzliche Einlagensicherung" },
  ],

  kontoPille: "Das Girokonto", kontoH2a: "Ein Konto, ", kontoH2b: "das einfach funktioniert.",
  kontoLead: "Online eröffnet, in der App geführt, weltweit einsetzbar. Das sind die Leistungen, die die DKB zum Girokonto nennt.",
  konto: [
    { s: "konto" as Symbol, titel: "Kostenlose Kontoführung", text: `Ab ${DKB.geldeingangEuro} € Geldeingang im Monat oder für alle unter ${DKB.freiBisAlter} Jahren. Mehrere Eingänge zählen zusammen.` },
    { s: "karte" as Symbol, titel: "Visa Debitkarte inklusive", text: "Ohne Jahresgebühr. Jede Zahlung geht direkt vom Konto ab — volle Kostenkontrolle. PIN nach Wunsch im Banking." },
    { s: "uhr" as Symbol, titel: `In rund ${DKB.eroeffnungMinuten} Minuten eröffnet`, text: "Online und ohne Papier. Die Identität bestätigen Sie per Video mit Personalausweis oder Reisepass." },
    { s: "blitz" as Symbol, titel: "Echtzeitüberweisung", text: `Geld in ${DKB.echtzeitSekunden} Sekunden auf anderen SEPA-Konten — rund um die Uhr, auch am Wochenende.` },
    { s: "wechsel" as Symbol, titel: "Kontowechsel-Service", text: `Kostenlos und digital: Ihre Zahlungspartner erfahren in unter ${DKB.wechselMinuten} Minuten von Ihrer neuen IBAN.` },
    { s: "handy" as Symbol, titel: "Apple Pay & Google Pay", text: "Bezahlen mit Smartphone, Uhr oder Tablet — kontaktlos, ohne die Karte aus der Tasche zu holen." },
  ],

  aktivPille: "Der Aktivstatus", aktivH2a: `Ab ${DKB.geldeingangEuro} € im Monat `, aktivH2b: "öffnet sich die Welt.",
  aktivLead: `Wer jeden Monat mindestens ${DKB.geldeingangEuro} € Geldeingang hat oder unter ${DKB.freiBisAlter} ist, bekommt den Aktivstatus. Neukunden haben ihn die ersten ${DKB.aktivStartMonate} Monate automatisch.`,
  schalterMit: "Mit Aktivstatus", schalterOhne: "Ohne Aktivstatus", schalterAria: "Aktivstatus vergleichen",
  aktivZeilen: [
    { label: "Kontoführung", mit: "kostenlos", ohne: `${DKB.kontoGebuehrEuro} € im Monat` },
    { label: "Bezahlen", mit: "weltweit kostenlos", ohne: "kostenlos im Euroraum" },
    { label: "Bargeld abheben", mit: "fast überall auf der Welt kostenlos", ohne: "kostenlos im Euroraum" },
    { label: "Fremdwährung", mit: "kein Umrechnungsentgelt", ohne: `${DKB.fremdwaehrungOhne} % Umrechnungsentgelt` },
    { label: "Dispozins", mit: `${DKB.dispoAktiv} % p. a., variabel`, ohne: `${DKB.dispoOhne} % p. a., variabel` },
    { label: "Notfallkarte im Ausland", mit: "kostenlos", ohne: `${DKB.notfallkarteEuro} €` },
    { label: "Notfallbargeld im Ausland", mit: "kostenlos", ohne: `${DKB.notfallbargeldEuro} €` },
  ],
  aktivFuss: `Bestandskunden: ${DKB.aktivStartMonate} Monate in Folge mindestens ${DKB.geldeingangEuro} € Geldeingang, danach laufend — die Bank prüft jeden Monat. Zinsgutschriften und Rückbuchungen zählen nicht mit.`,

  kartePille: "Die Visa Kreditkarte", karteH2a: "Die Karte ", karteH2b: "zum Konto.",
  karteLead: `Auf Wunsch dazu: die Visa Kreditkarte für ${DKB.kreditkarteMonatEuro} € im Monat. Sie wird im Banking dazugebucht, sobald das Konto steht, und einmal im Monat in einer Summe vom Girokonto abgerechnet.`,
  karteVorteile: [
    { s: "uhr" as Symbol, titel: "Einmal im Monat abgerechnet", text: `Am ${DKB.abrechnungTag}. des Monats, in einer Summe vom Girokonto. Kein Saldo, der sich über Monate aufbaut.` },
    { s: "rahmen" as Symbol, titel: "Rahmen, der mitwächst", text: "Das Limit richtet sich unter anderem nach regelmäßigen Gehaltseingängen und lässt sich im Banking anpassen." },
    { s: "handy" as Symbol, titel: "Apple Pay & Google Pay", text: "Kontaktlos mit Smartphone, Uhr oder Tablet. Die Kartendaten liegen weder auf dem Gerät noch beim Händler." },
    { s: "notfall" as Symbol, titel: "Notfallpaket inklusive", text: "Karte im Ausland verloren? Notfallkarte oder Notfallbargeld gibt es kostenlos." },
    { s: "schild" as Symbol, titel: "Visa Secure & Push", text: "Online-Zahlungen geben Sie in der App frei, und jeder Umsatz meldet sich sofort auf dem Smartphone." },
    { s: "kiosk" as Symbol, titel: "Digitaler Kiosk", text: "Drei digitale Ausgaben im Monat aus über 1.100 Zeitungen und Magazinen — kostenlos zur Karte." },
  ],
  aktion: `Aktion der DKB bis 31.12.2026: ${DKB_AKTION.bonusEuro} € Bonus für die erste Visa Kreditkarte — bei ${DKB_AKTION.zahlungen} Zahlungen ab ${DKB_AKTION.abEuro} € in den ersten ${DKB_AKTION.wochen} Wochen. Es gelten die Aktionsbedingungen der DKB.`,
  vergleichTitel: "Debit oder Kredit?",
  vergleich: [
    { kopf: "Visa Debitkarte", preis: "inklusive", punkte: ["Ohne Jahresgebühr", "Jede Zahlung sofort vom Konto", "Für den Alltag, an der Kasse und online"] },
    { kopf: "Visa Kreditkarte", preis: `${DKB.kreditkarteMonatEuro} € im Monat`, punkte: ["Optional, ohne Mindestlaufzeit", "Abrechnung einmal im Monat", "Für Reisen, Buchungen und Kautionen"] },
  ],

  sicherPille: "Sicherheit", sicherH2a: "Ihre Karte. ", sicherH2b: "Ihre Regeln.",
  sicherLead: "Alles Wichtige steuern Sie selbst in der App der DKB — in Sekunden, ohne Anruf.",
  sicher: [
    { s: "regler" as Symbol, titel: "Card Control", text: "Sie bestimmen, wo die Karte gilt: an der Kasse, online, am Automaten, in welchen Ländern." },
    { s: "schloss" as Symbol, titel: "Sperren per App", text: "Karte vorübergehend oder dauerhaft sperren — jederzeit, mit einem Fingertipp." },
    { s: "glocke" as Symbol, titel: "Push-Mitteilungen", text: "Jede Kontobewegung sofort auf dem Smartphone." },
    { s: "schild" as Symbol, titel: `Einlagensicherung bis ${DKB.einlagensicherungEuro} €`, text: "Guthaben ist über die gesetzliche Einlagensicherung geschützt." },
  ],

  kontenPille: "Für jede Lebenslage", kontenH2a: "Das passende ", kontenH2b: "Konto.",
  konten: [
    { s: "zwei" as Symbol, titel: "Gemeinschaftskonto", text: "Das Haushaltskonto für Paare und WGs: zwei Kontoinhaber, zwei Visa Debitkarten." },
    { s: "stern" as Symbol, titel: `Unter ${DKB.freiBisAlter}`, text: `Kostenlose Kontoführung bis zum ${DKB.freiBisAlter}. Geburtstag — auch ohne ${DKB.geldeingangEuro} € Geldeingang.` },
    { s: "kind" as Symbol, titel: "Konto u18", text: "Eigene Visa Debitkarte auf den Namen des Kindes, und die Eltern behalten im Banking den Überblick." },
  ],

  szeneTitel: "Zwei Ufer. Eine Brücke.",
  szeneText: "FIAON entwickelt Ihre Bonität, die DKB führt Ihr Konto. Zusammen wird daraus der Weg zur Karte.",

  partnerPille: "Unsere Partnerschaft", partnerH2a: "Exklusiv für ", partnerH2b: "FIAON-Kunden.",
  partnerLead: "Das Konto der DKB kann jeder beantragen. Was FIAON-Kunden zusätzlich haben, ist der begleitete Weg: die richtige Reihenfolge, der fertige Link und ein Mensch, der weiß, wo Sie stehen.",
  partnerPlus: [
    { s: "link" as Symbol, titel: "Ihr persönlicher Link", text: KARTE_LINK_SATZ },
    { s: "pfad" as Symbol, titel: "Die richtige Reihenfolge", text: "Erst das Konto, dann die Karte. Wer andersherum beantragt, riskiert eine Ablehnung und eine unnötige Anfrage in der Auskunft." },
    { s: "auswertung" as Symbol, titel: "Ihre Bonität, vorher entwickelt", text: "Mit der FIAON-Bonitätsauswertung wissen Sie vor dem Antrag, wo Sie stehen — Ampel, Finanzwert und Plan." },
    { s: "mensch" as Symbol, titel: "Ihr Betreuer an Ihrer Seite", text: "Ein fester Ansprechpartner begleitet Antrag, Konto und Karte — und hilft, wenn unterwegs eine Frage offen ist." },
  ],
  wegTitel: "So läuft es ab",
  weg: [
    { titel: "FIAON beantragen", dauer: "rund 5 Minuten", text: "Sie stellen Ihren Antrag bei FIAON und wählen Ihr Paket." },
    { titel: "Account aktiv", dauer: "mit der ersten Zahlung", text: "Mit Ihrer ersten gebuchten Zahlung ist Ihr Account aktiv — der Link unserer Partnerbank kommt direkt per Mail." },
    { titel: "Konto eröffnen", dauer: `rund ${DKB.eroeffnungMinuten} Minuten`, text: "Online, ohne Papier, Identität per Video. Über die Eröffnung entscheidet die Bank." },
    { titel: "Karte dazubuchen", dauer: "im Banking", text: "Steht das Konto, buchen Sie die Visa Kreditkarte im Banking der DKB dazu." },
    { titel: "Karte in der Hand", dauer: KARTE_ZEIT_KURZ, text: KARTE_ZEIT_SATZ },
  ],

  offenPille: "Offen gesagt",
  offen: [
    "FIAON ist Kooperationspartner der DKB. Eröffnet die DKB über unseren Link ein Konto, erhält FIAON dafür eine Vergütung. Für Sie entstehen keine Kosten, und Ihr Paketpreis hängt davon nicht ab.",
    "Den Antrag stellen Sie selbst und im eigenen Namen bei der DKB. Über Konto, Karte und Kartenrahmen entscheidet allein die Bank.",
    "FIAON vermittelt keine Kredite und ist kein Kreditinstitut.",
  ],
  quelle: (stand: string) => `Konditionen laut dkb.de, Stand ${stand}. Verbindlich ist das Preis- und Leistungsverzeichnis der DKB.`,
  quelleLink: "Zu den Konditionen der DKB",

  fragenPille: "Häufige Fragen",
  fragen: [
    { f: "Ist das Konto wirklich kostenlos?", a: "Ja, wenn jeden Monat mindestens 700 Euro eingehen oder Sie unter 28 sind. Sonst kostet die Kontoführung 4,50 Euro im Monat. Die Visa Debitkarte ist immer ohne Jahresgebühr dabei." },
    { f: "Was bringt der Aktivstatus?", a: "Kostenloses Bezahlen und Geldabheben fast überall auf der Welt, keinen Aufschlag auf Fremdwährungen, einen günstigeren Dispozins und ein kostenloses Notfallpaket bei Kartenverlust im Ausland. Neukunden haben ihn die ersten drei Monate automatisch." },
    { f: "Wann bekomme ich den Link der Partnerbank?", a: "Sobald Ihr Account aktiv ist, also mit Ihrer ersten gebuchten Zahlung, bekommen Sie direkt den fertigen Link unserer Partnerbank per Mail." },
    { f: "Bekomme ich die Kreditkarte sofort?", a: "Erst das Konto, dann die Karte: Die Visa Kreditkarte buchen Sie im Banking dazu, sobald das Konto steht. Über Karte und Rahmen entscheidet die Bank. Nach der Zusage ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, meist können Sie sie schon vorher in der App mit Apple Pay nutzen." },
    { f: "Warum über FIAON und nicht direkt?", a: "Direkt geht auch, das Konto steht jedem offen. Über FIAON kommt der Antrag zur richtigen Zeit: mit entwickelter Bonität, in der richtigen Reihenfolge und mit Ihrem Betreuer an der Seite." },
    { f: "Verdient FIAON an meiner Kontoeröffnung?", a: "Ja, und das sagen wir offen: Eröffnet die DKB über unseren Link ein Konto, erhält FIAON eine Vergütung. Sie zahlen dafür nichts, und Ihr Paketpreis hängt nicht davon ab." },
    { f: "Ist mein Geld bei der DKB sicher?", a: "Guthaben ist über die gesetzliche Einlagensicherung bis 100.000 Euro geschützt." },
  ],

  abschlussA: "Konto, Karte, Bonität. ", abschlussB: "Ein Weg.",
  abschlussText: "Starten Sie mit FIAON — den Link unserer Partnerbank bekommen Sie, sobald Ihr Account aktiv ist.",
  termin: "Startgespräch buchen",
};

const en: typeof de = {
  metaTitel: "DKB account & Visa card via FIAON · All benefits",
  metaBeschreibung: "Current account and Visa credit card from our partner bank DKB: no account fee from €700 a month, Active status, real-time transfers — guided by FIAON.",
  pille: "Partner bank · DKB",
  h1a: "Account and card. ", h1b: "With our partner bank.",
  lead: "DKB's current account with a Visa debit card and, if you wish, the Visa credit card — for FIAON customers with a personal link, in the right order and with your account manager at your side.",
  knopfStart: "Start with FIAON", knopfVorteile: "All benefits",
  symbolbild: "Illustration",
  karteDebit: "Visa Debit", karteKredit: "Visa Credit", karteKonto: "Current account", karteKarte: "Credit card",
  chips: [
    { s: "blitz", t: `Real-time · ${DKB.echtzeitSekunden} seconds` },
    { s: "handy", t: "Apple Pay & Google Pay" },
    { s: "konto", t: `€0 account fee from €${DKB.geldeingangEuro}` },
    { s: "stern", t: "Free worldwide with Active status" },
  ],
  zahlen: [
    { wert: "€0", label: `account fee with €${DKB.geldeingangEuro} paid in each month, or under ${DKB.freiBisAlter}` },
    { wert: "€0", label: "annual fee for the Visa debit card" },
    { wert: `${DKB.echtzeitSekunden} s`, label: "real-time transfers to other SEPA accounts, around the clock" },
    { wert: `€${DKB.einlagensicherungEuro.replace(".", ",")}`, label: "statutory deposit protection" },
  ],

  kontoPille: "The current account", kontoH2a: "An account ", kontoH2b: "that simply works.",
  kontoLead: "Opened online, run in the app, usable worldwide. These are the features DKB lists for its current account.",
  konto: [
    { s: "konto", titel: "No account fee", text: `With at least €${DKB.geldeingangEuro} paid in each month, or for everyone under ${DKB.freiBisAlter}. Several payments count together.` },
    { s: "karte", titel: "Visa debit card included", text: "No annual fee. Every payment leaves the account straight away — full control of your spending. Choose your own PIN in online banking." },
    { s: "uhr", titel: `Opened in about ${DKB.eroeffnungMinuten} minutes`, text: "Online and paperless. You confirm your identity by video with your ID card or passport." },
    { s: "blitz", titel: "Real-time transfers", text: `Money arrives on other SEPA accounts in ${DKB.echtzeitSekunden} seconds — around the clock, weekends included.` },
    { s: "wechsel", titel: "Account switching service", text: `Free and digital: your payment partners learn your new IBAN in under ${DKB.wechselMinuten} minutes.` },
    { s: "handy", titel: "Apple Pay & Google Pay", text: "Pay with your phone, watch or tablet — contactless, without taking the card out." },
  ],

  aktivPille: "Active status", aktivH2a: `From €${DKB.geldeingangEuro} a month, `, aktivH2b: "the world opens up.",
  aktivLead: `Anyone with at least €${DKB.geldeingangEuro} paid in each month, or under ${DKB.freiBisAlter}, receives DKB's Active status (Aktivstatus). New customers have it automatically for the first ${DKB.aktivStartMonate} months.`,
  schalterMit: "With Active status", schalterOhne: "Without Active status", schalterAria: "Compare Active status",
  aktivZeilen: [
    { label: "Account fee", mit: "free", ohne: `€${DKB.kontoGebuehrEuro.replace(",", ".")} a month` },
    { label: "Paying", mit: "free worldwide", ohne: "free in the euro area" },
    { label: "Cash withdrawals", mit: "free almost everywhere in the world", ohne: "free in the euro area" },
    { label: "Foreign currency", mit: "no conversion fee", ohne: `${DKB.fremdwaehrungOhne.replace(",", ".")}% conversion fee` },
    { label: "Overdraft rate", mit: `${DKB.dispoAktiv.replace(",", ".")}% p.a., variable`, ohne: `${DKB.dispoOhne.replace(",", ".")}% p.a., variable` },
    { label: "Emergency card abroad", mit: "free", ohne: `€${DKB.notfallkarteEuro}` },
    { label: "Emergency cash abroad", mit: "free", ohne: `€${DKB.notfallbargeldEuro}` },
  ],
  aktivFuss: `Existing customers: at least €${DKB.geldeingangEuro} paid in for ${DKB.aktivStartMonate} months in a row, then on an ongoing basis — the bank checks every month. Interest credits and reversals do not count.`,

  kartePille: "The Visa credit card", karteH2a: "The card ", karteH2b: "to match the account.",
  karteLead: `If you wish: the Visa credit card for €${DKB.kreditkarteMonatEuro.replace(",", ".")} a month. You add it in online banking once the account is open, and it is settled once a month in a single sum from the current account.`,
  karteVorteile: [
    { s: "uhr", titel: "Settled once a month", text: `On the ${DKB.abrechnungTag}nd of each month, in a single sum from the current account. No balance that builds up over months.` },
    { s: "rahmen", titel: "A limit that grows with you", text: "The limit depends, among other things, on regular salary payments and can be adjusted in online banking." },
    { s: "handy", titel: "Apple Pay & Google Pay", text: "Contactless with your phone, watch or tablet. Your card details are stored neither on the device nor with the merchant." },
    { s: "notfall", titel: "Emergency package included", text: "Lost your card abroad? An emergency card or emergency cash is free of charge." },
    { s: "schild", titel: "Visa Secure & push alerts", text: "You approve online payments in the app, and every transaction shows up on your phone at once." },
    { s: "kiosk", titel: "Digital newsstand", text: "Three digital issues a month from more than 1,100 newspapers and magazines — free with the card." },
  ],
  aktion: `DKB promotion until 31 December 2026: a €${DKB_AKTION.bonusEuro} bonus for your first Visa credit card — with ${DKB_AKTION.zahlungen} payments of €${DKB_AKTION.abEuro} or more in the first ${DKB_AKTION.wochen} weeks. DKB's promotion terms apply.`,
  vergleichTitel: "Debit or credit?",
  vergleich: [
    { kopf: "Visa debit card", preis: "included", punkte: ["No annual fee", "Every payment straight from the account", "For everyday use, in shops and online"] },
    { kopf: "Visa credit card", preis: `€${DKB.kreditkarteMonatEuro.replace(",", ".")} a month`, punkte: ["Optional, no minimum term", "Settled once a month", "For travel, bookings and deposits"] },
  ],

  sicherPille: "Security", sicherH2a: "Your card. ", sicherH2b: "Your rules.",
  sicherLead: "You manage everything important yourself in DKB's app — in seconds, without a phone call.",
  sicher: [
    { s: "regler", titel: "Card Control", text: "You decide where the card works: in shops, online, at cash machines, and in which countries." },
    { s: "schloss", titel: "Block in the app", text: "Block the card temporarily or permanently — at any time, with one tap." },
    { s: "glocke", titel: "Push notifications", text: "Every account movement on your phone straight away." },
    { s: "schild", titel: `Deposit protection up to €${DKB.einlagensicherungEuro.replace(".", ",")}`, text: "Balances are protected by statutory deposit insurance." },
  ],

  kontenPille: "For every stage of life", kontenH2a: "The right ", kontenH2b: "account.",
  konten: [
    { s: "zwei", titel: "Joint account", text: "The household account for couples and flatshares: two account holders, two Visa debit cards." },
    { s: "stern", titel: `Under ${DKB.freiBisAlter}`, text: `No account fee until your ${DKB.freiBisAlter}th birthday — even without €${DKB.geldeingangEuro} paid in.` },
    { s: "kind", titel: "Account for under-18s", text: "A Visa debit card in the child's own name, while parents keep an overview in online banking." },
  ],

  szeneTitel: "Two shores. One bridge.",
  szeneText: "FIAON develops your credit profile, DKB runs your account. Together they form the route to the card.",

  partnerPille: "Our partnership", partnerH2a: "Exclusively for ", partnerH2b: "FIAON customers.",
  partnerLead: "Anyone can apply for a DKB account. What FIAON customers have on top is the guided route: the right order, the ready-made link and a person who knows where you stand.",
  partnerPlus: [
    { s: "link", titel: "Your personal link", text: "As soon as your account is activated, you receive the ready-made link from our partner bank for your card application." },
    { s: "pfad", titel: "The right order", text: "First the account, then the card. Applying the other way round risks a rejection and an unnecessary enquiry on your credit file." },
    { s: "auswertung", titel: "Your credit profile, developed first", text: "With the FIAON credit assessment you know where you stand before you apply — traffic light, financial score and plan." },
    { s: "mensch", titel: "Your account manager at your side", text: "A dedicated contact accompanies application, account and card — and helps whenever a question comes up along the way." },
  ],
  wegTitel: "How it works",
  weg: [
    { titel: "Apply to FIAON", dauer: "about 5 minutes", text: "You submit your FIAON application and choose your package." },
    { titel: "Account active", dauer: "with the first payment", text: "With your first booked payment your account is active — the link from our partner bank arrives by email straight away." },
    { titel: "Open the account", dauer: `about ${DKB.eroeffnungMinuten} minutes`, text: "Online, paperless, identity by video. The bank decides on the opening." },
    { titel: "Add the card", dauer: "in online banking", text: "Once the account is open, you add the Visa credit card in DKB's online banking." },
    { titel: "Card in hand", dauer: "usually 2–5 working days after the bank's approval", text: "After the bank's approval the card usually reaches you within 2–5 working days, and you can mostly use it with Apple Pay in the bank's app before then." },
  ],

  offenPille: "In plain words",
  offen: [
    "FIAON is a cooperation partner of DKB. If DKB opens an account via our link, FIAON receives a fee for it. This costs you nothing, and your package price does not depend on it.",
    "You submit the application yourself and in your own name at DKB. Only the bank decides on the account, the card and the card limit.",
    "FIAON does not arrange loans and is not a credit institution.",
  ],
  quelle: (stand: string) => `Conditions according to dkb.de, as of ${stand}. DKB's schedule of prices and services (Preis- und Leistungsverzeichnis) is binding.`,
  quelleLink: "DKB's conditions",

  fragenPille: "Frequently asked questions",
  fragen: [
    { f: "Is the account really free of charge?", a: "Yes, if at least 700 euros are paid in each month or you are under 28. Otherwise the account fee is 4.50 euros a month. The Visa debit card always comes without an annual fee." },
    { f: "What does Active status bring?", a: "Free payments and cash withdrawals almost everywhere in the world, no surcharge on foreign currencies, a lower overdraft rate and a free emergency package if you lose your card abroad. New customers have it automatically for the first three months." },
    { f: "When do I receive the partner bank's link?", a: "As soon as your account is active, that is with your first booked payment, you receive the ready-made link from our partner bank by email." },
    { f: "Do I get the credit card straight away?", a: "First the account, then the card: you add the Visa credit card in online banking once the account is open. The bank decides on the card and the limit. After approval the card usually reaches you within 2–5 working days, and you can mostly use it with Apple Pay in the app before then." },
    { f: "Why via FIAON rather than directly?", a: "Applying directly works too; the account is open to everyone. Via FIAON the application comes at the right time: with a developed credit profile, in the right order and with your account manager at your side." },
    { f: "Does FIAON earn from my account opening?", a: "Yes, and we say so openly: if DKB opens an account via our link, FIAON receives a fee. You pay nothing for it, and your package price does not depend on it." },
    { f: "Is my money safe with DKB?", a: "Balances are protected by statutory deposit insurance up to 100,000 euros." },
  ],

  abschlussA: "Account, card, credit profile. ", abschlussB: "One route.",
  abschlussText: "Start with FIAON — you receive the link from our partner bank as soon as your account is active.",
  termin: "Book an introductory call",
};

export const PARTNERBANK_WOERTER = { de, en };
export type { Symbol as PartnerbankSymbol };
