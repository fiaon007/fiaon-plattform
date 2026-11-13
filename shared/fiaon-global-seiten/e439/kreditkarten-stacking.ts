// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: VIELE KARTENANTRÄGE IN KURZER ZEIT (27.10.2026, E-439, FG · 45)
// Adresse und Dateiname tragen das Suchwort „Kreditkarten-Stacking“; sie bleiben.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): Das Suchwort steht auf der Seite
// genau EINMAL, in Anführungszeichen, als Name, unter dem andere die Praxis bewerben
// („Kurz beantwortet“) — die Wortwand lässt je Seite ein Vorkommen zu. Nicht in H1 und
// Beschreibung: Beide erscheinen auch auf anderen Seiten („Weiterlesen“). Die Abfolge
// der Kartenanträge trägt keinen eigenen Namen mehr; der Abschnitt über uns heißt
// „Was FIAON Global dabei übernimmt“ und kommt aus den festen Sätzen (Schritt 4 und 5,
// S7, S8, S9). Die Warnzeichen treffen das eigene Honorar nicht mehr (Leitfaden 5.6
// Nr. 12): Warnzeichen ist das Honorar, das mit jedem weiteren Kartenantrag wächst.
// Der Erklär-Satz zum Erfolgshonorar (S16) ist nicht freigegeben (Vorbehalt V3) — es
// steht S12. Der Einführungszeitraum ohne Sollzins steht als EIN Satz Marktwissen da.
//
// Lektorat des ganzen Texts (selber Tag, zweite Runde): Satzbau nach Leitfaden, Sachtitel als Überschriften. FIAON
// steht nur noch in der einen Zeile „Auf einen Blick“, im Abschnitt über uns, im Vermerk und in der Frage zum Honorar;
// der Satz „vergibt und vermittelt keine Kredite“ kommt allein aus dem festen Rollen-Satz im Vermerk. Im Abschnitt
// über uns stehen erst die Karten, dann in einem eigenen Absatz die Finanzierung mit der Erstattung. Hauptüberschrift,
// zweite Zeile und Augenzeile bleiben wortgleich — aus ihnen ist das Vorschaubild erzeugt (scripts/og-business-bilder.ts).
//
// Satellit zum Kapital-Pfeiler /business/wissen/us-funding (Recherche
// .arbeit/recherche/kw_de.md, Thema T7). Suchwort „Kreditkarten Stacking“,
// daneben Credit Card Stacking, Business Credit Card Stacking, US Kreditkarten
// LLC, Kreditkarten Funding. Der Winkel: was hinter dem Versprechen steckt —
// belegt mit dem Fall FTC v. Seek Capital (Entscheidung des U.S. District Court
// C.D. California vom 16.09.2025, Az. 2:24-cv-09511, selbst gelesen; abschließende
// Anordnung 01.10.2025; FTC-Mitteilung 17.11.2025), den Score-Faktoren nach myFICO,
// der CFPB-Erklärung zu harten Anfragen, Regulation Z, 18 U.S.C. § 1014,
// EO 14406 und § 34c GewO.
//
// Bewusst NICHT übernommen: Die Werbung mit „Darlehen/Kreditlinien“ für reine
// Kartenanträge hat das Gericht am 16.09.2025 NICHT als Täuschung festgestellt
// (Streit über Tatsachen offen) — deshalb steht hier nur, was es festgestellt hat.
// Wortwand wie in wissen-konto-karten.ts: kein Bankname, kein „bis zu“, kein
// Zinssatz als Zahl, keine Empfehlung, keine Zusage; über jede Karte entscheidet
// der Herausgeber, FIAON vermittelt keine Kredite.
//
// Fachprüfung 27.10.2026: Urteil (19 Seiten) und FTC-Mitteilung Satz für Satz
// gegengelesen. Belegt und neu aufgenommen: Bankschreiben 2022 gegen ein
// „credit card stacking scheme“ (Urteil S. 16, Name der Bank bewusst weggelassen),
// Kundenbeispiel 40.000 $ → über 60.000 $ (S. 10), Anordnung vom 01.10.2025 ist
// eine mit der FTC vereinbarte („stipulated“) Anordnung. EO 14406 ordnet keine
// Pflicht für Banken an, sondern weist das Finanzministerium zu einem Hinweis an
// Finanzinstitute an (Sec. 3(a)(vi)). Reg-Z-Kommentar 3-1 über die CFPB-Fassung
// belegt (eCFR war nicht abrufbar).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Das Erfolgshonorar richtet sich nach dem Kapitalrahmen, den der Klient
// selbst wählt. Die Sätze „kein Honorar nach Rahmen, keine Erfolgsgebühr“ (bis E-509 wahr) sind deshalb gestrichen.
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, beleg, satz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN as Q } from "../fakten";

/** Tag der Erstveröffentlichung (E-439). */
const S = "2026-10-27";
const P = EIN_PRODUKT.de;
/** Schritt 4 (Kreditkarten auf Wunsch) und Schritt 5 (Finanzierung) der festen Erzählung — wortgleich aus der einen Quelle. */
const KARTEN = SECHS_SCHRITTE.de.find((x) => x.nr === 4)!;
const FINANZIERUNG = SECHS_SCHRITTE.de.find((x) => x.nr === 5)!;
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;

/** Quellen dieses Beitrags, die noch nicht in fakten.ts stehen (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  ficoAnfragen: { titel: "myFICO — Credit checks: what are credit inquiries and how do they affect your FICO Score", url: "https://www.myfico.com/credit-education/credit-reports/credit-checks-and-inquiries" },
  cfpbAnfrage: { titel: "Consumer Financial Protection Bureau — What is a credit inquiry?", url: "https://www.consumerfinance.gov/ask-cfpb/what-is-a-credit-inquiry-en-1317/" },
  usc1014: { titel: "18 U.S. Code § 1014 — Loan and credit applications generally", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  eo14406: { titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19.05.2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
  gewo34c: { titel: "§ 34c GewO — Erlaubnispflicht, unter anderem für die Vermittlung von Darlehensverträgen", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  regZ3Auslegung: { titel: "CFPB — Regulation Z § 1026.3 mit amtlicher Auslegung (Kommentar 3-1: § 1026.12(a) und (b) gelten für alle Kreditkarten)", url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/3/" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/kreditkarten-stacking",
  art: "wissen",
  seo: {
    titel: "„Kreditkarten-Stacking“: die Risiken — FIAON Global",
    beschreibung: "Viele Kreditkartenanträge in kurzer Zeit für die US-LLC: Folgen für Kreditakte und Haftung, das US-Urteil im Fall Seek Capital, der geordnete Aufbau.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 45",
  auge: "Wissen · Firmenkreditkarten",
  h1: "Viele Kartenanträge in kurzer Zeit.",
  h1b: "Akte, Haftung und ein US-Urteil.",
  lead: "Manche Anbieter beantragen in kurzer Zeit viele Kreditkarten und stellen die addierten Kartenrahmen als Startkapital dar. Teils wächst ihr Honorar mit jedem weiteren Kartenantrag. Dieser Artikel zeigt die Folgen für Ihre Kreditakte und Ihre Haftung. Er gibt wieder, was ein US-Bundesgericht im Fall Seek Capital auf Klage der Handelsaufsicht FTC festgestellt hat. Am Ende steht, in welcher Reihenfolge Kreditwürdigkeit entsteht.",
  ziffern: [
    { wert: "48,28 Mio. $", label: "Gebühren, die Kunden laut Urteil an Seek Capital zahlten" },
    { wert: "35 %", label: "Gewicht des Zahlungsverlaufs im FICO Score (myFICO)" },
    { wert: "1 Jahr", label: "so lange zählt eine harte Anfrage im FICO Score (myFICO)" },
  ],
  blick: [
    ["Was es ist", "Viele Kartenanträge in kurzer Zeit; die addierten Kartenrahmen dienen als Startkapital"],
    ["Wer haftet", "In der Regel der Inhaber persönlich, für jede Karte einzeln"],
    ["Was es kostet", "Zinsen und Gebühren der Herausgeber; bei manchen Anbietern ein Honorar, das mit jedem Kartenantrag wächst"],
    ["Folgen für die Akte", "Viele harte Anfragen, junge Konten, hohe Auslastung"],
    ["Der Fall", "FTC v. Seek Capital: Finanzierungsgeschäft seit Oktober 2025 dauerhaft untersagt"],
    ["Wer entscheidet", "Jeder Herausgeber, über Karte und Rahmen"],
    ["Mit FIAON Global", "Auf Wunsch bereiten wir jeden Antrag einzeln vor; Sie stellen ihn selbst"],
  ],
  kurz: "„Kreditkarten-Stacking“ nennen Anbieter viele Kartenanträge bei verschiedenen Herausgebern in kurzer Zeit, deren addierte Kartenrahmen als Startkapital dienen. Der Sache nach ist es persönlicher Kredit: Für Firmenkreditkarten haftet der Inhaber in der Regel persönlich, und jede Prüfung steht als harte Anfrage in der Kreditakte. Einem Anbieter, der dabei Kunden täuschte, ist das Finanzierungsgeschäft seit 2025 auf Klage der US-Handelsaufsicht FTC dauerhaft untersagt. Über jede Karte und jeden Rahmen entscheidet der Herausgeber.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "Die Praxis: viele Anträge auf einmal",
      absaetze: [
        "Der Antragsteller stellt in kurzer Zeit Anträge bei mehreren Kartenherausgebern — häufig für sich selbst und für die US-Gesellschaft zugleich. Die Rahmen der bewilligten Karten addiert er und setzt sie als Startkapital ein. Häufig wählt er dafür Karten mit einem Einführungszeitraum.",
        "Im deutschsprachigen Netz verkaufen Anbieter das Modell unter englischen Namen als Finanzierung für die US-LLC, teils auch als „Kreditlinie“. Es gibt das Modell als Kurs, als Mitgliedschaft oder als Dienstleistung, die die Anträge im Namen des Kunden stellt. Die Werbung verspricht Kapital ohne Bank. Es sind Kreditkarten, und für jede gilt:",
      ],
      punkte: [
        "Jede Karte ist ein eigener Kreditvertrag mit eigenem Herausgeber, eigenen Bedingungen und eigener Abrechnung.",
        "Für Firmenkreditkarten haftet der Inhaber in der Regel persönlich — für jede Karte einzeln.",
        "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.",
        "Über Ausgabe, Rahmen und Zins entscheidet jeder Herausgeber selbst, nach seiner Prüfung; der Plan eines Anbieters bindet ihn nicht.",
      ],
      nach: "Mehrere Karten zu besitzen, ist für sich genommen nicht ungewöhnlich. Das Risiko entsteht, wenn drei Dinge zusammenkommen: viele Anträge in kurzer Zeit, voll ausgeschöpfte Rahmen und eine Rückführung erst zum Ende der Einführungszeiträume.",
    },
    {
      typ: "tabelle", id: "seek", h2: "Seek Capital: Feststellungen des Gerichts",
      lead: "Seek Capital warb bei Gründern und Kleinunternehmern mit Unternehmensfinanzierung. Beantragt hat das Unternehmen für sie ausschließlich Kreditkarten, gestützt auf eine notariell beglaubigte Vollmacht der Kunden. Im September 2025 gab ein US-Bundesgericht der FTC in den meisten Punkten recht.",
      kopf: ["Werbeaussage oder Vertragsklausel von Seek", "Feststellung des Gerichts"],
      zeilen: [
        ["Besondere, direkte Beziehungen zu Kreditgebern; keine Vergütung von ihnen", "Beziehungen mit einem Vorteil für die Kunden bestanden nicht. Kreditgeber vergüteten Seek die Zuführung von Kunden. Banken forderten Seek schriftlich auf, die Antragspraxis zu unterlassen. Eine US-Bank bezeichnete sie 2022 als System serienweiser Kreditkartenanträge."],
        ["Karten mit der Funktion einer Kreditlinie", "Die Karten leisteten nicht mehr als gewöhnliche Kreditkarten. Sie boten etwa keinen Zugang zu Bargeld wie eine Kreditlinie."],
        ["„Keine Zinsen in den ersten zwölf bis achtzehn Monaten“", "Seek beantragte auch Karten ohne einen solchen Einführungszeitraum. Für einen Kunden waren es mindestens zehn Karten, viele davon ohne die beworbenen Bedingungen. Eine spätere Aufklärung heilt die erste Täuschung nicht."],
        ["„Keine Gebühr bis zur Finanzierung“", "Seek berechnete Gebühren für den vorzeitigen Ausstieg, bevor eine Finanzierung zugesagt war. Seek drängte Kunden zur Unterschrift und erklärte ihnen, sie müssten den Vertrag nicht lesen."],
        ["„Keine harten Anfragen“, kein Schaden für den Score", "Die Kartenanträge lösten harte Anfragen aus. Die Beklagten räumten ein, dass solche Anfragen den Score senken können."],
        ["Vertragsklausel gegen negative Bewertungen", "Die Klausel untersagte Kunden drei Jahre lang, negative Bewertungen oder Beschwerden über Seek im Netz zu veröffentlichen. Das verstößt gegen den Consumer Review Fairness Act."],
      ],
      fuss: [
        "FTC v. Seek Capital, LLC et al., U.S. District Court for the Central District of California, Az. 2:24-cv-09511, Entscheidung vom 16. September 2025; abschließende Anordnung vom 1. Oktober 2025; Mitteilung der FTC vom 17. November 2025.",
        "Das Gericht hat in dieser Entscheidung nicht abschließend beurteilt, ob die Werbung mit „Darlehen“ und „Kreditlinien“ für reine Kartenanträge irreführend war. US-Gerichte haben Kreditkarten als Kreditlinien und revolvierende Kredite eingeordnet. Kunden zeigten sich allerdings überrascht, dass ihre „Finanzierung“ aus Kreditkarten bestand.",
      ],
    },
    {
      typ: "text", id: "verbot", h2: "Gebühren, Haftung, Verbot: der Ausgang",
      absaetze: [
        "Seek berechnete eine Gebühr in Prozent der Kartenrahmen, die es für seine Kunden erreichte. Hinzu kamen Antragsgebühren und Gebühren für eine beschleunigte Bearbeitung. Auch Verhandlungen mit Banken und den vorzeitigen Ausstieg stellte Seek in Rechnung. Nach eigener Angabe beschaffte Seek in der Praxis rund 115 Prozent des Betrags, den der Vertrag als Finanzierungsvorschlag nannte. Mit dem höheren Rahmen wuchs die Gebühr. Ein Kunde wollte 40.000 US-Dollar für einen Anhänger seines Fuhrunternehmens; seine Rechnung wies mehr als 60.000 US-Dollar Rahmen aus. Ob das unlauter war, ließ das Gericht offen, weil der Vertrag einen Aufschlag erlaubte. Insgesamt zahlten Kunden 48.280.328,57 US-Dollar an Seek, nach Abzug von Gutschriften, Erstattungen und Rückbuchungen.",
        "Die abschließende Anordnung vom 1. Oktober 2025 ist mit der FTC vereinbart. Sie untersagt Seek Capital und seinem Gründer dauerhaft, Kredite, Darlehen oder andere Unternehmensfinanzierungen zu vermarkten oder anzubieten. Dasselbe gilt für Schuldenregulierung und Kreditreparatur. Das Geldurteil lautet auf 48.280.328 US-Dollar und ist teilweise ausgesetzt, weil die Beklagten es nicht vollständig leisten können. Schon im September hatte das Gericht den Gründer persönlich für Unterlassung und Zahlung haftbar erklärt.",
        "Für die Kunden heißt das: Die Gebühren blieben beim Anbieter. Die Karten, die Anfragen in der Akte und die persönliche Haftung für jeden Saldo blieben bei ihnen.",
      ],
    },
    {
      typ: "tabelle", id: "akte", h2: "Folgen vieler Anträge für die Kreditakte",
      lead: "Der FICO Score fasst die persönliche Kreditakte in fünf Gruppen von Daten zusammen. Viele Kartenanträge in kurzer Zeit berühren fast alle davon.",
      kopf: ["Daten", "Gewicht", "Wirkung vieler Anträge in kurzer Zeit"],
      zeilen: [
        ["Zahlungsverlauf", "35 %", "bleibt unbelastet, solange Sie jede Abrechnung pünktlich begleichen; ein Zahlungsengpass trifft viele Konten zugleich"],
        ["Offene Beträge und Auslastung", "30 %", "steigt, wenn Sie die Rahmen als Kapital ausschöpfen und die Karten in Ihrer persönlichen Akte stehen"],
        ["Länge der Historie", "15 %", "sinkt: viele neue Konten senken das Durchschnittsalter"],
        ["Neue Kredite", "10 %", "viele Anfragen und neue Konten in kurzer Zeit gelten als höheres Risiko"],
        ["Kreditmix", "10 %", "ändert sich kaum: es bleiben Karten"],
      ],
      fuss: ["Gewichte nach myFICO. Wie stark jede Gruppe zählt, kann von Person zu Person verschieden sein. Eine einzelne weitere Anfrage kostet die meisten Menschen weniger als fünf Punkte; viele Anfragen bedeuten nach myFICO ein höheres Risiko. Harte Anfragen können zwei Jahre in der Akte stehen und zählen im FICO Score ein Jahr lang."],
    },
    {
      typ: "text", id: "ende", h2: "Harte Anfragen und endende Einführungszeiträume",
      absaetze: [
        "Prüft ein Herausgeber für einen Kartenantrag Ihre Akte, steht dort eine harte Anfrage. Nach Angaben der US-Verbraucherschutzbehörde CFPB beeinflussen solche Anfragen den Score. Die meisten Modelle werten aus, wie oft und wie kürzlich jemand Kredit beantragt hat. Eine einzelne Anfrage wiegt wenig. Viele neue Konten in kurzer Zeit wertet FICO dagegen als Zeichen höheren Risikos. Jeder weitere Herausgeber sieht sie, bevor er entscheidet.",
        "Hinzu kommt der Zeitpunkt. Wer viele Karten in denselben Wochen eröffnet, dessen Einführungszeiträume enden auch in denselben Wochen. Danach gilt auf jeden offenen Saldo der reguläre Zins des jeweiligen Herausgebers. Wer dann umschichten will, braucht neue Karten. Jede bringt eine neue Anfrage, und die Akte ist inzwischen voll ausgelastet.",
        "Erzielt das Geschäft noch keinen Umsatz, zahlt der Inhaber die Salden aus seinem privaten Vermögen zurück. Viele Karten in kurzer Zeit sind damit persönlicher Kredit des Inhabers, keine Finanzierung der Gesellschaft.",
      ],
    },
    {
      typ: "text", id: "recht", h2: "Haftung und Recht: USA und Deutschland",
      absaetze: [
        "Für Firmenkreditkarten junger Gesellschaften verlangen Herausgeber in der Regel die persönliche Haftung des Inhabers („personal guarantee“). Bleibt die Gesellschaft eine Abrechnung schuldig, haftet er selbst. Die beschränkte Haftung der LLC schützt ihn dann nicht. Bei mehreren Karten gilt das für jede einzelne.",
        "Die Verbraucherschutzregeln der US-Regulation Z gelten für Kredit zu überwiegend geschäftlichen Zwecken nicht (12 CFR 1026.3(a)). Für Firmenkreditkarten gelten weiterhin vor allem die Regeln zur Ausgabe einer Karte und zur Haftung bei unbefugter Nutzung (12 CFR 1026.12 Abs. a und b; amtliche Auslegung zu § 1026.3, Kommentar 3-1). Was darüber hinaus gilt, steht im Kartenvertrag. Ihn legt der Herausgeber fest.",
        "Wer in einem Antrag an ein Institut mit US-Einlagensicherung wissentlich falsche Angaben macht, macht sich nach 18 U.S.C. § 1014 strafbar. Dazu zählt etwa, Umsatz oder Einkommen höher anzugeben, als sie sind. Das Gesetz sieht Geldstrafe von höchstens einer Million US-Dollar, Freiheitsstrafe von höchstens dreißig Jahren oder beides vor. Die Executive Order 14406 vom 19. Mai 2026 weist das US-Finanzministerium an, Finanzinstitute auf Warnzeichen hinzuweisen. Danach kann die Nutzung einer persönlichen Steuernummer (ITIN) statt einer Sozialversicherungsnummer (SSN) für Kreditprodukte als Risikofaktor gelten, wenn der US-Aufenthaltsstatus nicht geprüft ist. Ein solcher Risikofaktor verlangt eine vertiefte Prüfung.",
        "In Deutschland braucht eine Erlaubnis der zuständigen Behörde, wer gewerbsmäßig den Abschluss von Darlehensverträgen vermittelt (§ 34c Abs. 1 Satz 1 Nr. 2 GewO). Wer Ihnen eine Finanzierung verkauft, sollte sagen können, ob er Darlehen vermittelt und mit welcher Erlaubnis.",
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Anträge in Serie oder geordneter Aufbau",
      lead: "Ein geordneter Aufbau nutzt dieselben Produkte in anderer Reihenfolge und mit anderem Ziel. Das Ziel ist eine Zahlungshistorie, die mit jeder pünktlich beglichenen Abrechnung wächst.",
      kopf: ["", "Anträge in Serie", "Geordneter Aufbau"],
      hervor: 2,
      zeilen: [
        ["Anträge", "viele in kurzer Zeit", "wenige, in geordneter Reihenfolge und mit Abstand"],
        ["Wer den Antrag stellt", "teils ein Anbieter per Vollmacht", "Sie selbst, mit vollständigen Unterlagen"],
        ["Grundlage", "der addierte Rahmen", "echte Umsätze und pünktlich beglichene Abrechnungen"],
        ["Auslastung", "hoch, weil die Rahmen als Kapital dienen", "niedrig"],
        ["Einführungszeiträume", "enden etwa zur selben Zeit", "enden gestaffelt; die Rückführung ist aus dem Geschäft geplant"],
        ["Akte nach einem Jahr", "viele Anfragen, junge Konten, hohe Salden", "wachsende Historie pünktlicher Zahlungen"],
        ["Honorar", "wächst bei manchen Anbietern mit jedem Kartenantrag", "steht als Betrag fest, bevor Sie unterzeichnen"],
        ["Wer entscheidet", "jeder Herausgeber", "jeder Herausgeber"],
      ],
      fuss: ["Vereinfachte Gegenüberstellung."],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warnzeichen unseriöser Angebote", spalten: 3,
      karten: [
        { tag: "Warnzeichen", titel: "Honorar, das mit jedem Kartenantrag wächst", text: "Wer an jeder weiteren Karte verdient, hat einen Anreiz zu immer neuen Anträgen — auch wenn sie Ihrer Akte schaden. Seek Capital berechnete eine Gebühr auf die erreichten Kartenrahmen. Nach eigener Angabe beschaffte Seek mehr Rahmen, als der Vertrag als Finanzierung vorschlug." },
        { tag: "Warnzeichen", titel: "Besondere Beziehungen zu Banken", text: "Der Anbieter wirbt mit „direkten Kontakten“ und Konditionen, die andere nicht erhalten. Im Fall Seek bestanden solche Beziehungen nicht; Banken verlangten schriftlich, die Antragspraxis einzustellen. Jeder Herausgeber prüft nach eigenen Regeln." },
        { tag: "Warnzeichen", titel: "Rahmen und Zins vorab zugesagt", text: "Rahmen, Zins und Einführungszeitraum legt allein der Herausgeber fest. Eine Zusage dazu kann kein Anbieter halten. Ein Betrag, den Sie selbst wählen, ist ein Ziel und keine Zusage." },
        { tag: "Warnzeichen", titel: "„Keine Gebühr bis zur Finanzierung“", text: "Seek warb damit, erst nach der Finanzierung eine Gebühr zu berechnen. Tatsächlich berechnete Seek Ausstiegsgebühren, bevor eine Finanzierung zugesagt war. Wann ein Honorar fällig wird, muss im Vertrag stehen. Lesen Sie auch, was ein Ausstieg kostet, bevor Sie unterzeichnen." },
        { tag: "Warnzeichen", titel: "„Keine harte Anfrage“", text: "Prüft ein Herausgeber für einen Kartenantrag Ihre Akte, ist das in der Regel eine harte Anfrage. Seek verwies vor Gericht auf eine Vorprüfung ohne Wirkung auf den Score. Die Kartenanträge selbst lösten harte Anfragen aus." },
        { tag: "Warnzeichen", titel: "Zeitdruck, Vollmacht, Schweigeklausel", text: "Im Fall Seek kamen drei Dinge zusammen: Zeitdruck vor der Unterschrift, Kreditanträge in Serie per Vollmacht und eine Klausel gegen negative Bewertungen." },
      ],
    },
    {
      typ: "etappen", id: "leiter", h2: "Kreditwürdigkeit: der geordnete Aufbau",
      lead: "Kreditwürdigkeit entsteht in Schritten. Jeder baut auf dem vorigen auf. Über jede Karte entscheidet der Herausgeber.",
      etappen: [
        { titel: "Stammdaten und Grundlagen", text: "Am Anfang stehen die Gesellschaft, ihre Steuernummer (EIN) und Ihre ITIN. Hinzu kommen US-Anschrift, US-Telefonnummer, Geschäftskonto und D-U-N-S-Nummer. Die Stammdaten sind in jedem Register und jedem Antrag identisch." },
        { titel: "Erste Karte passend zur Historie", text: "Sie beginnen bei einem Herausgeber, dessen Anforderungen zu Ihrer Akte passen. Den Antrag stellen Sie vollständig und selbst." },
        { titel: "Pünktlich begleichen, wenig auslasten", text: "Sie begleichen jede Abrechnung vollständig und pünktlich und halten die Auslastung niedrig. Daraus entsteht der Zahlungsverlauf, den FICO am stärksten gewichtet." },
        { titel: "Abstand zwischen den Anträgen", text: "Weitere Herausgeber folgen in geordneter Reihenfolge, wenn Ihre Akte es zulässt. Die Anträge verteilen sich auf mehrere Monate." },
        { titel: "Umsatz und Lieferantenkonten", text: "Echte Umsätze über das Geschäftskonto und Lieferanten mit Zahlungsziel bauen auch die Kreditakte der Gesellschaft auf." },
        { titel: "Darlehen und Sicherheiten", text: "Für größere Beträge zählen Geschäftsjahre, Kennzahlen und Sicherheiten. Geordnete Abschlüsse sind die Grundlage für ein späteres Darlehen. Darüber entscheidet das finanzierende Institut." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      // Erst die Karten (ihr Schritt mit „Ihr Teil“ und seiner Bedingung), dann in einem eigenen Absatz die Finanzierung
      // (ihr Schritt mit dem Satz zum Kapitalrahmen und der Erstattung) — die Erstattung gilt für Karten nicht.
      absaetze: [
        `${KARTEN.satz} Wir bereiten jeden Kartenantrag einzeln und vollständig vor, nicht in Serie. Bei jedem Herausgeber unterzeichnen Sie selbst.`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
        `Honorar: ${beleg("honorarVorab")}`,
        `${TEIL.bedingung}: ${KARTEN.bedingung}`,
      ],
      nach: `${FINANZIERUNG.satz} ${satz("S9")} ${P.geldZurueck}`,
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.de[2],
        "Ein Einführungszeitraum endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo.",
        `${satz("S8")} FIAON sagt keinen Rahmen zu. ${satz("S9")}`,
        GLOBAL_PFLICHTHINWEIS.de[0],
        "Dieser Beitrag gibt die Rechtslage und den Fall Seek Capital nach den genannten Quellen wieder (Stand: Oktober 2026). Er ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.",
      ],
    },
  ],
  fragen: [
    { f: "Was bedeutet es, viele Kreditkarten auf einmal zu beantragen?", a: "Der Antragsteller beantragt in kurzer Zeit viele Kreditkarten bei verschiedenen Herausgebern und nutzt ihre Rahmen zusammen als Startkapital. Es sind Karten, keine Darlehen, und jede hat eigene Bedingungen. Für Firmenkreditkarten haftet der Inhaber in der Regel persönlich. Prüft ein Herausgeber für einen Antrag die Kreditakte, steht dort eine harte Anfrage." },
    { f: "Ist es in den USA erlaubt, viele Kreditkarten auf einmal zu beantragen?", a: "Mehrere Karten zu beantragen, ist für sich genommen nicht verboten. Strafbar sind wissentlich falsche Angaben in Kreditanträgen (18 U.S.C. § 1014). Täuschende Versprechen von Anbietern verfolgt die FTC: Seek Capital ist seit Oktober 2025 dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen. Banken sehen Anträge in Serie kritisch. Eine US-Bank verlangte 2022 schriftlich, dass Seek seine Antragspraxis einstellt. Über jede Karte entscheidet der Herausgeber." },
    { f: "Was ergab das Verfahren der FTC gegen Seek Capital?", a: "Ein US-Bundesgericht stellte im September 2025 auf Antrag der FTC fest, dass Seek Capital Kunden mit mehreren Aussagen getäuscht hatte. Es ging um Beziehungen zu Kreditgebern, eine Kreditlinien-Funktion der Karten und Zeiträume ohne Zinsen. Hinzu kamen die Aussagen „keine Gebühr bis zur Finanzierung“ und „keine harten Anfragen“. Seit Oktober 2025 sind Seek und sein Gründer dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen. Das Geldurteil über 48,28 Millionen US-Dollar ist teilweise ausgesetzt." },
    { f: "Wie stark wirken harte Anfragen auf den Score?", a: "Nach myFICO kostet eine einzelne weitere Anfrage die meisten Menschen weniger als fünf Punkte. Harte Anfragen können zwei Jahre in der Akte stehen und zählen im FICO Score ein Jahr lang. Viele neue Konten in kurzer Zeit gelten dagegen als Zeichen höheren Risikos. Jeder weitere Herausgeber sieht sie, bevor er entscheidet." },
    { f: "Hafte ich persönlich für die Kreditkarten meiner US-LLC?", a: "In der Regel ja. Für Firmenkreditkarten junger Gesellschaften verlangen Herausgeber die persönliche Haftung des Inhabers. Die beschränkte Haftung der LLC schützt Sie dann nicht. Bei mehreren Karten gilt das für jede einzeln." },
    { f: "Bekommt eine US-LLC Kreditkarten, wenn der Inhaber in Europa wohnt?", a: "Das entscheidet jeder Herausgeber. Bei jungen Gesellschaften prüft er in der Regel die persönliche US-Historie des Inhabers über SSN oder ITIN. Er verlangt außerdem die persönliche Haftung des Inhabers. Nach der Executive Order 14406 vom 19. Mai 2026 kann eine ITIN statt einer SSN ohne geprüften US-Aufenthaltsstatus als Risikofaktor gelten. Ein solcher Risikofaktor verlangt eine vertiefte Prüfung. Eine sorgfältig vorbereitete Akte zählt deshalb mehr als die Zahl der Anträge." },
    { f: "Was kostet FIAON Global — gibt es ein Erfolgshonorar?", a: `Ja. ${P.preisSatz} ${satz("S4")}` },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/business/wissen/us-funding", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/anbieter-pruefen"],
  quellen: [Q.ftcSeek, Q.ftcSeekUrteil, Q.ficoFaktoren, QUELLEN.ficoAnfragen, QUELLEN.cfpbAnfrage, Q.regZ3, QUELLEN.regZ3Auslegung, Q.regZ12, QUELLEN.usc1014, QUELLEN.eo14406, QUELLEN.gewo34c],
};
