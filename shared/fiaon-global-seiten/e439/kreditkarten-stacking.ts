// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: KREDITKARTEN-STACKING (27.10.2026, E-439, FG · 45)
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
import { GLOBAL_GELD_ZURUECK, GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q } from "../fakten";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];

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
    titel: "Kreditkarten-Stacking: Was dahinter steckt — FIAON Global",
    beschreibung: "Kreditkarten-Stacking für die US-LLC: was Programme versprechen, was ein US-Gericht im Fall Seek Capital feststellte und was Ihre Akte trägt.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 45",
  auge: "Wissen · Kapital",
  h1: "Kreditkarten-Stacking.",
  h1b: "Was hinter dem Versprechen steckt.",
  lead: "Kreditkarten-Stacking heißt: in kurzer Zeit viele Kreditkarten beantragen und ihre Rahmen zusammen als Startkapital nutzen — teils über ein Programm, das dafür eine Gebühr in Prozent des Rahmens verlangt. Hier steht, was dabei in Ihrer Kreditakte und in Ihrer Haftung geschieht, was ein US-Bundesgericht auf Klage der Handelsaufsicht FTC im Fall Seek Capital festgestellt hat und wie ein Weg zu Kapital aussieht, der auch in Jahren noch trägt.",
  ziffern: [
    { wert: "48,28 Mio. $", label: "Gebühren, die Kunden an Seek Capital zahlten" },
    { wert: "35 %", label: "Gewicht des Zahlungsverlaufs im FICO Score" },
    { wert: "1 Jahr", label: "so lange zählt eine harte Anfrage im FICO Score" },
  ],
  blick: [
    ["Was es ist", "Viele Kartenanträge in kurzer Zeit, die Rahmen als Startkapital"],
    ["Wer haftet", "In der Regel der Inhaber persönlich, für jede Karte einzeln"],
    ["Was es kostet", "Bei Programmen teils eine Gebühr in Prozent des Rahmens, danach der reguläre Zins"],
    ["Spuren in der Akte", "Viele harte Anfragen, junge Konten, hohe Auslastung"],
    ["Der Maßstab", "FTC v. Seek Capital: dauerhaftes Verbot seit Oktober 2025"],
    ["Wer entscheidet", "Jeder Herausgeber selbst, über Karte und Rahmen"],
    ["Mit FIAON Global", "Festpreis vorab, Kartenleiter mit Abstand, kein Honorar nach Rahmen"],
  ],
  kurz: "Kreditkarten-Stacking bedeutet, in kurzer Zeit viele Kreditkarten bei verschiedenen Herausgebern zu beantragen und die Rahmen zusammen als Startkapital zu nutzen. Für Firmenkarten haftet der Inhaber in der Regel persönlich, jede Prüfung wird als harte Anfrage in der Kreditakte vermerkt, und die Einführungszeiträume enden etwa zur selben Zeit. Auf Klage der US-Handelsaufsicht FTC ist einem Anbieter, der gegen hohe Gebühren Karten beantragte und dabei Beziehungen zu Kreditgebern und Zeiträume ohne Zinsen behauptete, seit 2025 das Finanzierungsgeschäft dauerhaft untersagt. Belastbarer ist eine Kartenleiter über Zeit: wenige Anträge mit Abstand, pünktlich bezahlte Abrechnungen, echte Umsätze.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "Was Kreditkarten-Stacking ist",
      absaetze: [
        "Beim Kreditkarten-Stacking — englisch Credit Card Stacking oder Business Credit Card Stacking — werden in kurzer Zeit Anträge bei mehreren Kartenherausgebern gestellt, häufig für die eigene Person und für die US-Gesellschaft zugleich. Die Rahmen der bewilligten Karten werden addiert und als Startkapital ausgegeben, gern gezielt bei Karten mit einem Einführungszeitraum ohne Sollzins.",
        "Im deutschsprachigen Netz wird das Modell häufig als „US-Funding“, „Kreditkarten-Funding“ oder „Credit Stacking“ für die US-LLC verkauft, teils auch als „Kreditlinie“: als Kurs, als Mitgliedschaft oder als Dienstleistung, die die Anträge im Namen des Kunden stellt. Das Versprechen klingt nach Kapital ohne Bank. Tatsächlich sind es Karten — mit allem, was zu Karten gehört:",
      ],
      punkte: [
        "Jede Karte ist ein eigener Kreditvertrag mit eigenem Herausgeber, eigenen Bedingungen und eigener Abrechnung.",
        "Über Ausgabe, Rahmen und Zins entscheidet jeder Herausgeber selbst — nach seiner Prüfung, nicht nach dem Plan eines Programms.",
        "Für Firmenkarten haftet der Inhaber in der Regel persönlich, und zwar für jede Karte einzeln.",
        "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.",
      ],
      nach: "Mehrere Karten zu besitzen, ist für sich genommen nichts Ungewöhnliches. Heikel wird es, wenn viele Anträge auf einmal gestellt, die Rahmen voll ausgeschöpft und die Rückführung auf das Ende der Einführungszeiträume verschoben wird.",
    },
    {
      typ: "tabelle", id: "seek", h2: "Der Fall Seek Capital: was das Gericht festgestellt hat",
      lead: "Seek Capital warb bei Gründern und Kleinunternehmern mit Unternehmensfinanzierung und beantragte für sie ausschließlich Kreditkarten — gestützt auf eine notariell beglaubigte Vollmacht der Kunden. Im September 2025 gab ein US-Bundesgericht der FTC in den meisten Punkten recht.",
      kopf: ["Versprechen und Vertrag von Seek", "Was das Gericht feststellte"],
      zeilen: [
        ["Besondere, direkte Beziehungen zu Kreditgebern, kein Geld von ihnen", "Beziehungen, die Kunden einen Vorteil brachten, gab es nicht. Seek ließ sich von Kreditgebern für die Zuführung von Kunden vergüten. Banken forderten Seek schriftlich auf, seine Antragspraxis zu unterlassen; eine US-Bank nannte sie 2022 ein „credit card stacking scheme“."],
        ["Karten mit der Funktion einer Kreditlinie", "Die Karten konnten nicht mehr als gewöhnliche Kreditkarten — etwa keinen Zugang zu Bargeld wie bei einer Kreditlinie."],
        ["„Keine Zinsen in den ersten zwölf bis achtzehn Monaten“", "Seek beantragte auch Karten ohne einen solchen Einführungszeitraum, für einen Kunden mindestens zehn Karten, viele davon ohne die beworbenen Bedingungen. Eine spätere Aufklärung heilt die erste Täuschung nicht."],
        ["„Keine Gebühr bis zur Finanzierung“", "Seek berechnete Gebühren für den vorzeitigen Ausstieg, bevor überhaupt eine Finanzierung zugesagt war. Kunden wurden zur Unterschrift gedrängt und hörten, sie müssten den Vertrag nicht lesen."],
        ["„Keine harten Anfragen“, kein Schaden für den Score", "Bei den Kartenanträgen wurden harte Anfragen gestellt. Die Beklagten räumten ein, dass solche Anfragen den Score senken können."],
        ["Vertragsklausel gegen negative Bewertungen", "Kunden durften drei Jahre lang keine negativen Bewertungen oder Beschwerden über Seek im Netz veröffentlichen — ein Verstoß gegen den Consumer Review Fairness Act."],
      ],
      fuss: [
        "FTC v. Seek Capital, LLC et al., U.S. District Court for the Central District of California, Az. 2:24-cv-09511, Entscheidung vom 16. September 2025; abschließende Anordnung vom 1. Oktober 2025; Mitteilung der FTC vom 17. November 2025.",
        "Ob die Werbung mit „Darlehen“ und „Kreditlinien“ für reine Kartenanträge irreführend war, hat das Gericht in dieser Entscheidung nicht abschließend beurteilt: US-Gerichte haben Kreditkarten als Kreditlinien und revolvierende Kredite eingeordnet. Kunden zeigten sich allerdings überrascht, dass ihre „Finanzierung“ aus Kreditkarten bestand.",
      ],
    },
    {
      typ: "text", id: "verbot", h2: "Gebühren, Haftung, Verbot: wie der Fall endete",
      absaetze: [
        "Seek berechnete eine Gebühr in Prozent der Kartenrahmen, die es für seine Kunden erreichte. Dazu kamen Antragsgebühren, Gebühren für eine beschleunigte Bearbeitung, für Verhandlungen mit Banken und für den vorzeitigen Ausstieg. Nach eigener Angabe beschaffte Seek in der Praxis rund 115 Prozent des Betrags, den der Vertrag als Finanzierungsvorschlag nannte — und die Gebühr wuchs mit dem höheren Rahmen. Ein Kunde wollte 40.000 US-Dollar für einen Anhänger seines Fuhrunternehmens; seine Rechnung wies mehr als 60.000 US-Dollar Rahmen aus. Ob das unlauter war, ließ das Gericht offen, weil der Vertrag einen Aufschlag erlaubte. Insgesamt zahlten Kunden 48.280.328,57 US-Dollar an Seek, nach Abzug von Gutschriften, Erstattungen und Rückbuchungen.",
        "Mit der abschließenden, mit der FTC vereinbarten Anordnung vom 1. Oktober 2025 ist Seek Capital und seinem Gründer dauerhaft untersagt, Kredite, Darlehen oder andere Unternehmensfinanzierungen, Schuldenregulierung oder Kreditreparatur zu vermarkten oder anzubieten. Das Geldurteil lautet auf 48.280.328 US-Dollar und ist teilweise ausgesetzt, weil die Beklagten es nicht vollständig leisten können. Schon im September hatte das Gericht den Gründer persönlich für Unterlassung und Zahlung haftbar erklärt.",
        "Für die Kunden heißt das: Die Gebühren lagen beim Programm. Die Karten, die Anfragen in der Akte und die persönliche Haftung für jeden Saldo blieben bei ihnen.",
      ],
    },
    {
      typ: "tabelle", id: "akte", h2: "Was ein Stapel in Ihrer Kreditakte hinterlässt",
      lead: "Der FICO Score fasst die persönliche Kreditakte in fünf Gruppen von Daten zusammen. Kreditkarten-Stacking berührt fast alle davon.",
      kopf: ["Daten", "Gewicht", "Was ein Stapel damit macht"],
      zeilen: [
        ["Zahlungsverlauf", "35 %", "bleibt sauber, solange jede Abrechnung pünktlich beglichen wird — ein Engpass trifft aber viele Konten zugleich"],
        ["Offene Beträge und Auslastung", "30 %", "steigt, wenn die Rahmen als Kapital ausgeschöpft werden und die Karten in Ihrer persönlichen Akte stehen"],
        ["Länge der Historie", "15 %", "sinkt: viele neue Konten senken das Durchschnittsalter"],
        ["Neue Kredite", "10 %", "viele Anfragen und neue Konten in kurzer Zeit gelten als höheres Risiko"],
        ["Kreditmix", "10 %", "ändert sich kaum: es bleiben Karten"],
      ],
      fuss: ["Gewichte nach myFICO; wie stark jede Gruppe zählt, kann von Person zu Person verschieden sein. Eine einzelne weitere Anfrage kostet die meisten Menschen weniger als fünf Punkte; viele Anfragen bedeuten nach myFICO ein höheres Risiko. Harte Anfragen können zwei Jahre in der Akte stehen und zählen im FICO Score ein Jahr lang."],
    },
    {
      typ: "text", id: "ende", h2: "Harte Anfragen und das gemeinsame Ende",
      absaetze: [
        "Jeder Kartenantrag, bei dem ein Herausgeber Ihre Akte prüft, wird dort als harte Anfrage vermerkt. Die US-Verbraucherschutzbehörde CFPB erklärt, dass solche Anfragen den Score beeinflussen, weil die meisten Modelle darauf schauen, wie oft und wie kürzlich jemand Kredit beantragt. Eine einzelne Anfrage wiegt wenig. Viele neue Konten in kurzer Zeit wertet FICO dagegen als Zeichen höheren Risikos — und jeder weitere Herausgeber sieht sie, bevor er entscheidet.",
        "Dazu kommt der Kalender. Wer viele Karten in denselben Wochen eröffnet, hat Einführungszeiträume, die in denselben Wochen enden. Danach gilt auf jeden offenen Saldo der reguläre Zins des jeweiligen Herausgebers. Wer dann umschichten will, braucht neue Karten — mit neuen Anfragen, in einer Akte, die inzwischen voll ausgelastet ist.",
        "Ist das Geld in ein Geschäft geflossen, das noch keinen Umsatz trägt, kommt die Rückführung aus der eigenen Tasche. Genau an dieser Stelle zeigt sich, dass Kreditkarten-Stacking keine Finanzierung der Gesellschaft ist, sondern persönlicher Kredit mit einem Firmennamen darauf.",
      ],
    },
    {
      typ: "text", id: "recht", h2: "Haftung und Recht: was in den USA und in Deutschland gilt",
      absaetze: [
        "Für Firmenkarten junger Gesellschaften verlangen Herausgeber in der Regel eine persönliche Haftung des Inhabers („personal guarantee“). Bleibt die Gesellschaft eine Abrechnung schuldig, haftet er selbst; die beschränkte Haftung der LLC schützt ihn dann nicht. Beim Stacking gilt das für jede einzelne Karte.",
        "Die Verbraucherschutzregeln der US-Regulation Z gelten für Kredit zu überwiegend geschäftlichen Zwecken nicht (12 CFR 1026.3(a)). Für Firmenkarten bleiben vor allem die Regeln zur Ausgabe einer Karte und zur Haftung bei unbefugter Nutzung (12 CFR 1026.12 Abs. a und b; amtliche Auslegung zu § 1026.3, Kommentar 3-1). Was darüber hinaus gilt, steht im Kartenvertrag — und den legt der Herausgeber fest.",
        "Wer in einem Antrag an ein Institut mit US-Einlagensicherung wissentlich falsche Angaben macht, etwa Umsatz oder Einkommen schönt, macht sich nach 18 U.S.C. § 1014 strafbar; das Gesetz sieht Geldstrafe von höchstens einer Million US-Dollar, Freiheitsstrafe von höchstens dreißig Jahren oder beides vor. Die Executive Order 14406 vom 19. Mai 2026 weist zudem das US-Finanzministerium an, Finanzinstitute auf Warnzeichen hinzuweisen: Die Nutzung einer ITIN statt einer SSN, um Kreditprodukte zu erhalten, kann danach ohne geprüften US-Aufenthaltsstatus als Risikofaktor gelten, der eine vertiefte Prüfung verlangt.",
        "In Deutschland braucht eine Erlaubnis der zuständigen Behörde, wer gewerbsmäßig den Abschluss von Darlehensverträgen vermittelt (§ 34c Abs. 1 Satz 1 Nr. 2 GewO). Ein Anbieter, der Ihnen „Funding“ verkauft, sollte sagen können, ob er vermittelt — und wenn ja, mit welcher Erlaubnis. FIAON vermittelt keine Kredite.",
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Stapel oder Kartenleiter: der Unterschied",
      lead: "Eine Kartenleiter nutzt dieselben Produkte, aber in anderer Reihenfolge und mit anderem Ziel: eine Historie, die mit jeder pünktlich beglichenen Abrechnung wächst, statt eines Rahmens, der auf einmal ausgeschöpft ist.",
      kopf: ["", "Kreditkarten-Stacking", "Kartenleiter über Zeit"],
      hervor: 2,
      zeilen: [
        ["Anträge", "viele in kurzer Zeit", "wenige, mit Abstand und nach Plan"],
        ["Wer den Antrag stellt", "teils ein Programm per Vollmacht", "Sie selbst, vollständig vorbereitet"],
        ["Grundlage", "der addierte Rahmen", "echte Umsätze und pünktlich beglichene Abrechnungen"],
        ["Auslastung", "hoch — die Rahmen sind das Kapital", "niedrig gehalten"],
        ["Einführungszeiträume", "enden gemeinsam", "gestaffelt, mit Plan für die Rückführung aus dem Geschäft"],
        ["Akte nach einem Jahr", "viele Anfragen, junge Konten, hohe Salden", "wachsende Historie mit pünktlichen Zahlungen"],
        ["Gebühr", "bei Programmen teils in Prozent des Rahmens", "bei FIAON Global: Festpreis vorab"],
        ["Wer entscheidet", "jeder Herausgeber", "jeder Herausgeber"],
      ],
      fuss: ["Vereinfachte Gegenüberstellung. Über jede Karte und jeden Rahmen entscheidet der Herausgeber."],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Woran Sie unseriöse Programme für Kreditkarten-Stacking erkennen", spalten: 3,
      karten: [
        { tag: "Warnzeichen", titel: "Gebühr in Prozent des Rahmens", text: "Wer am Rahmen verdient, verdient an jedem weiteren Antrag — auch wenn er Ihrer Akte schadet. Seek Capital rechnete so ab und beschaffte nach eigener Angabe mehr Rahmen, als der Vertrag als Finanzierung vorschlug." },
        { tag: "Warnzeichen", titel: "Besondere Beziehungen zu Banken", text: "„Direkte Kontakte“ und Programme, die es sonst nicht gibt: Im Fall Seek gab es sie nicht — Banken verlangten stattdessen schriftlich, die Antragspraxis einzustellen. Jeder Herausgeber prüft nach eigenen Regeln." },
        { tag: "Warnzeichen", titel: "Rahmen und Zins vorab versprochen", text: "Eine bestimmte Höhe oder einen Zeitraum ohne Sollzins legt allein der Herausgeber fest, nach seiner Prüfung. Beispielrahmen in Dollar sind Werbung, kein Ergebnis." },
        { tag: "Warnzeichen", titel: "„Keine Gebühr bis zur Finanzierung“", text: "Lesen Sie, was beim Ausstieg fällig wird. Seek warb mit einem Honorar nach Erfolg und berechnete Ausstiegsgebühren, bevor irgendetwas zugesagt war." },
        { tag: "Warnzeichen", titel: "„Keine harte Anfrage“", text: "Ein Kartenantrag mit Prüfung Ihrer Akte ist in der Regel eine harte Anfrage. Seek verwies vor Gericht auf eine Vorprüfung ohne Wirkung auf den Score — die Kartenanträge selbst lösten harte Anfragen aus." },
        { tag: "Warnzeichen", titel: "Eile, Vollmacht, Schweigeklausel", text: "Druck zur schnellen Unterschrift, Kreditanträge per Vollmacht in Serie und eine Klausel gegen negative Bewertungen standen im Fall Seek nebeneinander." },
      ],
    },
    {
      typ: "etappen", id: "leiter", h2: "Die Kartenleiter Schritt für Schritt",
      lead: "Belastbar entsteht Kapital über Karten nur in Etappen. Jede baut auf der vorigen auf; über jede Karte entscheidet der Herausgeber.",
      etappen: [
        { titel: "Grundlage legen", text: "Gesellschaft, EIN, ITIN, US-Anschrift und US-Telefon, Geschäftskonto und D-U-N-S-Nummer — mit identischen Stammdaten in jedem Register und jedem Antrag." },
        { titel: "Erste Karte passend zur Historie", text: "Ein Herausgeber, dessen Prüfung zu Ihrer Akte passt. Der Antrag ist vollständig vorbereitet; Sie stellen ihn selbst." },
        { titel: "Pünktlich begleichen, wenig auslasten", text: "Jede Abrechnung vollständig und pünktlich begleichen, die Auslastung niedrig halten. Daraus entsteht der Zahlungsverlauf, den FICO am stärksten gewichtet." },
        { titel: "Abstand zwischen den Anträgen", text: "Weitere Herausgeber folgen in geplanter Reihenfolge, wenn die Akte es trägt — nicht alle im selben Monat." },
        { titel: "Umsatz und Lieferantenkonten", text: "Echte Umsätze über das Geschäftskonto und Lieferanten mit Zahlungsziel bauen auch die Akte der Gesellschaft auf." },
        { titel: "Bank und Sicherheiten", text: "Für größere Beträge zählen Geschäftsjahre, Kennzahlen und Sicherheiten. Dafür entsteht die Kennzahlen-Mappe für ein späteres Bankdarlehen." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global den Weg zu Kapital — ohne Stapel",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für Unternehmer, die eine US-Gesellschaft aufbauen — mit einem Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir die Anträge für Sie: Gründung, EIN, die Vorbereitung der ITIN, D-U-N-S-Nummer, die Meldungen, Registered Agent sowie US-Anschrift und US-Telefon für das erste Jahr. Konto-, Karten- und Kreditanträge stellen Sie selbst — vollständig von uns vorbereitet. Niemand unterschreibt in Ihrem Namen bei einem Kartenherausgeber.",
        "Statt eines Stapels planen wir die Kartenleiter: den ersten Herausgeber passend zu Ihrer Akte, die Reihenfolge der weiteren, den Abstand zwischen den Anträgen und einen monatlichen Durchgang mit Ihrem Ansprechpartner. Mit Global Kapital führen wir den Weg weiter über mehrere Herausgeber bis zur Kennzahlen-Mappe für ein späteres Bankdarlehen.",
        "Sie kennen den Preis, bevor Sie beauftragen: ein Festpreis, alle Gebühren des Pakets inklusive. Es gibt kein Honorar nach Rahmen, keine Erfolgsgebühr und keinen Anteil am Kapital. Partner-Steuerberater, US-CPA und Partner-Anwälte arbeiten in Ihrem Mandat; ihre Honorare für die Leistungen Ihres Pakets trägt FIAON. Unser Team arbeitet vor Ort in Miami, unser Partnerstandort ist Zürich, Ihr Vertragspartner ist die FIAON LTD in London. Die Jahresbetreuung ab dem zweiten Jahr ist freiwillig.",
        "Über jede Karte, jeden Rahmen und jedes Darlehen entscheidet das Institut. FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu; der Kapitalrahmen Ihres Pakets ist ein Ziel.",
        KAPITAL_FREI,
        ...GELD_ZURUECK,
      ],
    },
    { typ: "paket", id: "paket", h2: "Der ganze Weg im Paket", lead: "Gründung, Konto, Kartenleiter über mehrere Herausgeber und die Unterlagen für ein späteres Bankdarlehen — Global Kapital zum Festpreis.", paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.de[2],
        "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest. Nach ihrem Ende gilt der reguläre Zins auf den offenen Saldo.",
        "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Der Kapitalrahmen eines Pakets ist ein Ziel, keine Zusage.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        "Dieser Beitrag gibt die Rechtslage und den Fall Seek Capital nach den genannten Quellen wieder, Stand Oktober 2026. Ihren Einzelfall prüfen Partner-Steuerberater und Partner-Anwalt in Ihrem Mandat.",
      ],
    },
  ],
  fragen: [
    { f: "Was ist Kreditkarten-Stacking?", a: "Kreditkarten-Stacking (englisch Credit Card Stacking) heißt, in kurzer Zeit viele Kreditkarten bei verschiedenen Herausgebern zu beantragen und ihre Rahmen zusammen als Startkapital zu nutzen. Es sind Karten, keine Darlehen: Jede hat eigene Bedingungen, für Firmenkarten haftet der Inhaber in der Regel persönlich, und jede Prüfung wird in der Kreditakte vermerkt." },
    { f: "Ist Kreditkarten-Stacking in den USA erlaubt?", a: "Mehrere Karten zu beantragen, ist für sich genommen nicht verboten. Strafbar sind wissentlich falsche Angaben in Kreditanträgen (18 U.S.C. § 1014); täuschende Versprechen von Anbietern verfolgt die FTC — Seek Capital ist seit Oktober 2025 dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen. Banken sehen solche Serien kritisch: Eine US-Bank verlangte 2022, Seeks „credit card stacking scheme“ einzustellen. Über jede Karte entscheidet der Herausgeber." },
    { f: "Was ergab das Verfahren der FTC gegen Seek Capital?", a: "Auf Antrag der FTC stellte ein US-Bundesgericht im September 2025 fest, dass Seek Capital mit Beziehungen zu Kreditgebern, einer Kreditlinien-Funktion der Karten, Zeiträumen ohne Zinsen, „keiner Gebühr bis zur Finanzierung“ und „keinen harten Anfragen“ getäuscht hatte. Seit Oktober 2025 sind Seek und sein Gründer dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen; das Geldurteil über 48,28 Millionen US-Dollar ist teilweise ausgesetzt." },
    { f: "Wie stark wirken harte Anfragen auf den Score?", a: "Nach myFICO kostet eine einzelne weitere Anfrage die meisten Menschen weniger als fünf Punkte. Harte Anfragen können zwei Jahre in der Akte stehen und zählen im FICO Score ein Jahr lang. Viele neue Konten in kurzer Zeit gelten dagegen als Zeichen höheren Risikos — und jeder weitere Herausgeber sieht sie, bevor er entscheidet." },
    { f: "Hafte ich persönlich für die Kreditkarten meiner US-LLC?", a: "In der Regel ja. Für Firmenkarten junger Gesellschaften verlangen Herausgeber eine persönliche Haftung des Inhabers; die beschränkte Haftung der LLC greift dann nicht. Beim Kreditkarten-Stacking gilt das für jede Karte einzeln." },
    { f: "Bekommt eine US-LLC Kreditkarten, wenn der Inhaber in Europa wohnt?", a: "Das entscheidet jeder Herausgeber. Bei jungen Gesellschaften prüft er in der Regel die persönliche US-Historie des Inhabers über SSN oder ITIN und verlangt seine persönliche Haftung. Nach der Executive Order 14406 vom 19. Mai 2026 kann eine ITIN statt einer SSN ohne geprüften US-Aufenthaltsstatus zudem als Risikofaktor für eine vertiefte Prüfung gelten. Eine sorgfältig vorbereitete Akte zählt deshalb mehr als die Zahl der Anträge." },
    { f: "Was kostet FIAON Global — gibt es eine Erfolgsgebühr?", a: "Einen Festpreis, der vor dem Auftrag feststeht; alle Gebühren des Pakets sind enthalten, auch die Honorare der Partner für die Leistungen Ihres Pakets. Ein Honorar nach Rahmen, eine Erfolgsgebühr oder einen Anteil am Kapital gibt es nicht. Über jede Karte und jeden Rahmen entscheidet der Herausgeber." },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/business/wissen/us-funding", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/anbieter-pruefen"],
  quellen: [Q.ftcSeek, Q.ftcSeekUrteil, Q.ficoFaktoren, QUELLEN.ficoAnfragen, QUELLEN.cfpbAnfrage, Q.regZ3, QUELLEN.regZ3Auslegung, Q.regZ12, QUELLEN.usc1014, QUELLEN.eo14406, QUELLEN.gewo34c],
};
