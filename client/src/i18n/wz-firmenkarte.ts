// /werkzeuge/firmenkarte · /en/tools/business-card-check — Wörterbuch (09.09.2026, E-099)
// Vorbereitungsstand, KEINE Bewilligungsprognose. Über die Karte entscheidet
// immer das Kartenunternehmen oder die Bank.
const de = {
  metaTitel: "Firmenkarten-Check · Was vor dem Antrag fehlt",
  metaBeschreibung: "Sechs Fragen zu Rechtsform, Alter, Offenlegung, Konto und Einträgen – der Check zeigt, welche Unterlage vor einem Firmenkartenantrag noch fehlt. Kostenlos, ohne Anmeldung.",
  seoTitel: "Firmenkarten-Check: Was vor dem Antrag noch fehlt",
  seoBeschreibung: "Rechtsform, Unternehmensalter, Jahresabschluss, Geschäftskonto und Einträge prüfen – der Check nennt die Lücken in dieser Reihenfolge.",
  werkzeugName: "Firmenkarten-Check", krumeWerkzeuge: "Werkzeuge", krume: "Firmenkarten-Check",
  pille: "Werkzeug für Unternehmen · kostenlos, ohne Anmeldung",
  h1a: "Firmenkarte beantragen: ", h1b: "Was vorher auf dem Tisch liegen muss",
  lead: "Die meisten Absagen entstehen nicht am Umsatz, sondern an einer fehlenden Unterlage oder einem Eintrag, von dem der Inhaber nichts wusste. Sechs Fragen zeigen, was in Ihrem Fall noch offen ist – und in welcher Reihenfolge es sich abarbeiten lässt.",

  schritt1: "Schritt 1", frageRecht: "Welche Rechtsform?",
  rEinzel: "Einzelunternehmen oder Freiberufler", rEinzelHinweis: "Bank sieht Firma und Inhaber als eine Bonität",
  rPersonen: "GbR, OHG, KG oder GmbH & Co. KG", rPersonenHinweis: "Gesellschafter haften mit",
  rKapital: "GmbH, UG oder AG", rKapitalHinweis: "Eigene Bonität, eigene Offenlegungspflicht",

  schritt2: "Schritt 2", frageAlter: "Wie lange besteht das Unternehmen?",
  aJung: "Unter einem Jahr", aMittel: "Ein bis drei Jahre", aAlt: "Länger als drei Jahre",

  schritt3: "Schritt 3", frageAbschluss: "Ist der letzte Jahresabschluss offengelegt?",
  hinweisAbschluss: "Kapitalgesellschaften müssen spätestens ein Jahr nach dem Abschlussstichtag an das Unternehmensregister übermitteln (§ 325 HGB). Einzelunternehmen und die meisten Personengesellschaften trifft diese Pflicht nicht.",
  abJa: "Ja, fristgerecht", abSpaet: "Überfällig oder noch offen", abKeine: "Keine Offenlegungspflicht",

  schritt4: "Schritt 4", frageKonto: "Wie lange läuft das Geschäftskonto?",
  hinweisKonto: "Die Kontoführung ist der einzige Nachweis, den Sie ohne fremde Stelle selbst erbringen: Umsätze, keine Rückläufer, kein dauerhaft ausgereizter Rahmen.",
  kNeu: "Unter sechs Monaten", kMittel: "Sechs bis 24 Monate", kLang: "Länger als zwei Jahre",

  schritt5: "Schritt 5", frageEintrag: "Gibt es Negativmerkmale zu Firma oder Inhaber?",
  eKeine: "Keine bekannt", eErledigt: "Ja, aber erledigt", eOffen: "Ja, eine offene Forderung", eUnbekannt: "Weiß ich nicht",

  schritt6: "Schritt 6", frageIndex: "Kennen Sie Ihren Bonitätsindex?",
  iGut: "Unter 250", iMittel: "250 bis 299", iSchwach: "300 oder höher", iUnbekannt: "Nicht bekannt",

  ergebnisTitel: (offen: number) => offen === 0 ? "Die Unterlagen sind beisammen" : offen === 1 ? "Ein Punkt ist noch offen" : `${offen} Punkte sind noch offen`,
  stufeBereit: "Vorbereitet", stufeFast: "Fast vollständig", stufeLuecken: "Lücken",
  einleitungBereit: "Nach diesen Angaben fehlt keine der Unterlagen, die vor einem Firmenkartenantrag üblicherweise verlangt werden. Über die Karte und den Rahmen entscheidet trotzdem das Kartenunternehmen – dieser Check bereitet den Antrag vor, er nimmt die Entscheidung nicht vorweg.",
  einleitungLuecken: "Diese Punkte fällt eine Bank oder ein Kartenunternehmen als Erstes auf. Sie stehen in der Reihenfolge, in der sie sich sinnvoll abarbeiten lassen – der erste ist meist der schnellste.",

  lueckeUnbekannt: { t: "Sie kennen Ihren eigenen Datensatz nicht", x: "Solange Sie nicht wissen, was Creditreform, CRIF und die SCHUFA über Firma und Inhaber führen, beantragen Sie blind. Das ist der erste Schritt, weil jeder weitere davon abhängt – und weil er nichts kostet." },
  lueckeOffen: { t: "Eine offene Forderung steht im Raum", x: "Ein offenes Negativmerkmal wiegt bei Kartenanträgen schwerer als eine dünne Historie. Prüfen Sie zuerst, ob die Meldung überhaupt zulässig war: § 31 Abs. 2 BDSG verlangt Fälligkeit, zwei Mahnungen mit vier Wochen Abstand, den Hinweis auf die Meldung und eine nicht bestrittene Forderung." },
  lueckeAbschluss: { t: "Der Jahresabschluss ist überfällig", x: "Eine fehlende Offenlegung ist öffentlich sichtbar und fließt über die Bilanzbonität in den Bonitätsindex ein. Nachreichen ist mühsam, aber es ist der Punkt mit der größten Wirkung pro Aufwand – und das Ordnungsgeldverfahren nach § 335 HGB endet damit ebenfalls." },
  lueckeKonto: { t: "Das Geschäftskonto ist noch jung", x: "Unter sechs Monaten liegt kaum verwertbare Kontoführung vor. Das lässt sich nicht beschleunigen, nur überbrücken: eine Karte mit Sicherheitsleistung oder ein kleiner Startrahmen, der später aufgestockt wird." },
  lueckeJung: { t: "Das Unternehmen ist unter einem Jahr alt", x: "Unternehmensalter wiegt im Bonitätsindex vier Prozent, in der Kartenprüfung oft mehr. Gegen die Zeit hilft nichts – gegen die Wirkung schon: saubere Kontoführung, offengelegte Zahlen und die persönliche Bonität des Inhabers." },
  lueckeIndex: { t: "Der Bonitätsindex liegt bei 300 oder darüber", x: "In diesem Bereich verschlechtern sich Zahlungsbedingungen spürbar. Bevor ein Antrag Sinn ergibt, gehört geklärt, welche Merkmale den Wert tragen – und ob sie stimmen." },
  lueckeEinzel: { t: "Firma und Inhaber sind dieselbe Bonität", x: "Beim Einzelunternehmen prüft die Bank Ihre private Auskunft mit. Ein privater Eintrag, der mit dem Geschäft nichts zu tun hat, kippt hier den Antrag. Beide Auskünfte gehören deshalb zusammen auf den Tisch." },

  reihenfolge: "Was zuerst",
  reihenfolgeText: "Auskunft beschaffen, Einträge prüfen, Offenlegung nachholen, dann beantragen. Wer den Antrag an den Anfang stellt, sammelt Absagen – und jede Anfrage bleibt zwölf Monate gespeichert.",
  anfragen: "Ein Nebeneffekt, den viele übersehen",
  anfragenText: "Jede Kreditanfrage wird gespeichert. Mehrere Kartenanträge in kurzer Folge sind für die nächste Bank ein Muster. Eine Konditionsanfrage bleibt dagegen ohne Wirkung auf die Bewertung – fragen Sie ausdrücklich danach.",

  standTitel: "Stand und Quelle",
  stand: "§ 325 HGB (Offenlegung binnen eines Jahres nach dem Abschlussstichtag an das Unternehmensregister; vier Monate bei kapitalmarktorientierten Gesellschaften), § 335 HGB (Ordnungsgeld bei unterlassener Offenlegung), § 31 Abs. 2 BDSG (Voraussetzungen für die Meldung einer offenen Forderung), Creditreform-Gewichtung des Bonitätsindex. Stand: 9. September 2026.",
  grenze: "Was der Check nicht kann",
  grenzeText: "Er sagt keine Zusage und keinen Rahmen voraus. Über beides entscheidet das Kartenunternehmen nach eigenen Regeln, die keine Auskunftei und kein Werkzeug kennt. Der Check ordnet nur, was üblicherweise verlangt wird – damit Sie nicht mit einer fehlenden Unterlage in die Prüfung gehen.",

  fuss: "Der Check läuft vollständig in Ihrem Browser. Keine Eingabe verlässt Ihr Gerät, nichts wird gespeichert.",
  fragenTitel: "Häufige Fragen",
  fragen: [
    { f: "Warum lehnen Banken Firmenkarten trotz guter Umsätze ab?", a: "Weil Umsatz nur eines von mehreren Merkmalen ist. Häufiger scheitert es an einem nicht offengelegten Jahresabschluss, an einer kurzen Kontohistorie oder an einem Negativmerkmal beim Inhaber persönlich – gerade bei Einzelunternehmen und kleinen Gesellschaften, wo Privat- und Firmenbonität zusammen betrachtet werden." },
    { f: "Zählt meine private Bonität bei einer Firmenkarte mit?", a: "Bei Einzelunternehmen, Freiberuflern und kleinen Personengesellschaften in aller Regel ja. Bei einer GmbH steht formal die Gesellschaft im Vordergrund, doch bei jungen oder kleinen Gesellschaften wird die Bonität des Geschäftsführers regelmäßig mitgeprüft, weil die Gesellschaft selbst noch keine Historie hat." },
    { f: "Was bringt es, den Jahresabschluss nachzureichen?", a: "Zwei Dinge. Die Bilanzbonität trägt zehn Prozent des Bonitätsindex, und eine fehlende Offenlegung ist im Unternehmensregister für jeden sichtbar. Zusätzlich endet das Ordnungsgeldverfahren nach § 335 HGB, das sonst weiterläuft." },
    { f: "Schadet ein abgelehnter Antrag?", a: "Die Ablehnung selbst wird nicht gespeichert, die Anfrage schon – zwölf Monate lang. Mehrere Kartenanfragen in kurzer Folge lesen sich für die nächste Bank als Muster. Deshalb lohnt es, die Unterlagen vorher zu ordnen, statt der Reihe nach zu beantragen." },
    { f: "Gibt es eine Firmenkarte ohne Bonitätsprüfung?", a: "Nicht als echte Kreditkarte mit Rahmen. Was es gibt, sind Debit- und Prepaid-Karten auf Guthabenbasis sowie Karten gegen Sicherheitsleistung. Die tragen den Zahlungsverkehr, verschaffen aber kein Zahlungsziel – und genau darum geht es bei einer Firmenkarte meistens." },
  ],
  zwischenrufFett: "Erst die Auskunft, dann der Antrag.",
  zwischenruf: " FIAON beschafft Unternehmens- und Inhaberauskunft, erklärt jeden Eintrag und bereitet den Kartenantrag vor. Über die Karte entscheidet das Kartenunternehmen.",
  zwischenrufKnopf: "FIAON Business ansehen", weiterLink: "Eigene Auskunft anfordern",
};

const en: typeof de = {
  metaTitel: "Business card check · what is missing before you apply",
  metaBeschreibung: "Six questions on legal form, age, filing, banking and entries – the check shows which document is still missing before a business card application. Free, no sign-up.",
  seoTitel: "Business card check: what is missing before you apply",
  seoBeschreibung: "Check legal form, company age, annual accounts, business account and entries – the check names the gaps in the order they are best closed.",
  werkzeugName: "Business card check", krumeWerkzeuge: "Tools", krume: "Business card check",
  pille: "Tool for companies · free, no sign-up",
  h1a: "Applying for a business card: ", h1b: "what has to be on the table first",
  lead: "Most refusals arise not from turnover but from a missing document or an entry the owner knew nothing about. Six questions show what is still open in your case – and in what order it can be worked through.",

  schritt1: "Step 1", frageRecht: "Which legal form?",
  rEinzel: "Sole trader or freelancer", rEinzelHinweis: "The bank treats firm and owner as one standing",
  rPersonen: "Partnership (GbR, OHG, KG, GmbH & Co. KG)", rPersonenHinweis: "Partners are liable too",
  rKapital: "Limited company (GmbH, UG, AG)", rKapitalHinweis: "Own standing, own filing duty",

  schritt2: "Step 2", frageAlter: "How long has the company existed?",
  aJung: "Under one year", aMittel: "One to three years", aAlt: "More than three years",

  schritt3: "Step 3", frageAbschluss: "Have the latest annual accounts been filed?",
  hinweisAbschluss: "Limited companies must file with the company register within one year of the balance sheet date (Section 325 HGB). Sole traders and most partnerships are not caught by this duty.",
  abJa: "Yes, on time", abSpaet: "Overdue or still open", abKeine: "No filing duty",

  schritt4: "Step 4", frageKonto: "How long has the business account been running?",
  hinweisKonto: "Account conduct is the only evidence you can produce yourself without a third party: turnover, no returned payments, no permanently exhausted facility.",
  kNeu: "Under six months", kMittel: "Six to 24 months", kLang: "More than two years",

  schritt5: "Step 5", frageEintrag: "Are there negative entries on the company or the owner?",
  eKeine: "None known", eErledigt: "Yes, but settled", eOffen: "Yes, an open claim", eUnbekannt: "I do not know",

  schritt6: "Step 6", frageIndex: "Do you know your business credit index?",
  iGut: "Under 250", iMittel: "250 to 299", iSchwach: "300 or higher", iUnbekannt: "Not known",

  ergebnisTitel: (offen: number) => offen === 0 ? "The documents are together" : offen === 1 ? "One point is still open" : `${offen} points are still open`,
  stufeBereit: "Prepared", stufeFast: "Nearly complete", stufeLuecken: "Gaps",
  einleitungBereit: "On these details, none of the documents usually required before a business card application is missing. The card and the limit are still decided by the card company – this check prepares the application, it does not anticipate the decision.",
  einleitungLuecken: "These are the points a bank or card company notices first. They appear in the order in which they are sensibly worked through – the first is usually the quickest.",

  lueckeUnbekannt: { t: "You do not know your own record", x: "As long as you do not know what Creditreform, CRIF and SCHUFA hold on the company and the owner, you are applying blind. This is the first step because everything else depends on it – and because it costs nothing." },
  lueckeOffen: { t: "An open claim is on the table", x: "An open negative entry weighs more heavily on card applications than a thin history. Check first whether the report was permissible at all: Section 31(2) BDSG requires the claim to be due, two reminders four weeks apart, notice of the intended report, and a claim that is not disputed." },
  lueckeAbschluss: { t: "The annual accounts are overdue", x: "Missing accounts are publicly visible and feed into the credit index through balance sheet standing. Filing late is tedious, but it is the point with the greatest effect per unit of effort – and it also ends the penalty procedure under Section 335 HGB." },
  lueckeKonto: { t: "The business account is still young", x: "Under six months there is barely any usable account conduct. That cannot be accelerated, only bridged: a card against a security deposit, or a small starting limit raised later." },
  lueckeJung: { t: "The company is under a year old", x: "Company age carries four per cent in the credit index and often more in card assessment. Nothing helps against time – but plenty helps against its effect: clean account conduct, filed figures and the owner's personal standing." },
  lueckeIndex: { t: "The credit index is 300 or above", x: "In this range payment conditions deteriorate noticeably. Before an application makes sense, it is worth establishing which features carry the value – and whether they are correct." },
  lueckeEinzel: { t: "Firm and owner are one and the same standing", x: "For a sole trader the bank reviews your private report as well. A private entry with nothing to do with the business will sink the application here. Both reports therefore belong on the table together." },

  reihenfolge: "What comes first",
  reihenfolgeText: "Obtain the reports, check the entries, catch up on filing, then apply. Put the application first and you collect refusals – and every enquiry stays on file for twelve months.",
  anfragen: "A side effect many overlook",
  anfragenText: "Every credit enquiry is recorded. Several card applications in quick succession read as a pattern to the next bank. A conditions enquiry, by contrast, has no effect on the assessment – ask for one expressly.",

  standTitel: "Source and date",
  stand: "Section 325 HGB (filing within one year of the balance sheet date with the company register; four months for capital-market oriented companies), Section 335 HGB (penalty payment for failure to file), Section 31(2) BDSG (conditions for reporting an open claim), Creditreform's published weighting of the credit index. As at 9 September 2026.",
  grenze: "What the check cannot do",
  grenzeText: "It predicts neither approval nor a limit. Both are decided by the card company under its own rules, which no agency and no tool knows. The check only orders what is usually required – so that you do not enter the assessment with a document missing.",

  fuss: "The check runs entirely in your browser. Nothing you enter leaves your device, nothing is stored.",
  fragenTitel: "Common questions",
  fragen: [
    { f: "Why do banks refuse business cards despite good turnover?", a: "Because turnover is only one of several features. More often it fails on annual accounts that were not filed, a short account history, or a negative entry on the owner personally – particularly for sole traders and small partnerships, where private and business standing are looked at together." },
    { f: "Does my private standing count for a business card?", a: "For sole traders, freelancers and small partnerships, as a rule yes. For a limited company the entity is formally in the foreground, yet with young or small companies the managing director's standing is regularly reviewed too, because the company itself has no history." },
    { f: "What does filing the annual accounts achieve?", a: "Two things. Balance sheet standing carries ten per cent of the credit index, and missing accounts are visible to anyone in the company register. On top of that, the penalty procedure under Section 335 HGB ends, which otherwise continues." },
    { f: "Does a refused application do damage?", a: "The refusal itself is not recorded, the enquiry is – for twelve months. Several card enquiries in quick succession read as a pattern to the next bank. That is why it pays to order the documents first rather than applying one after another." },
    { f: "Is there a business card without a credit check?", a: "Not as a real credit card with a limit. What exists are debit and prepaid cards on a balance basis, and cards against a security deposit. Those carry the payment traffic but provide no payment term – which is usually the whole point of a business card." },
  ],
  zwischenrufFett: "The report first, then the application.",
  zwischenruf: " FIAON obtains the company and owner reports, explains every entry and prepares the card application. The card company decides on the card.",
  zwischenrufKnopf: "See FIAON Business", weiterLink: "Request your own report",
};

export const WZ_FIRMENKARTE_WOERTER = { de, en };
