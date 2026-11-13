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
    titel: "US-Kreditkarten in Serie beantragen: Risiken — FIAON Global",
    beschreibung: "Viele Kreditkartenanträge in kurzer Zeit für die US-LLC: was Anbieter versprechen, was ein US-Gericht im Fall Seek Capital feststellte, was die Akte trägt.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 45",
  auge: "Wissen · Firmenkreditkarten",
  h1: "Viele Kartenanträge in kurzer Zeit.",
  h1b: "Akte, Haftung und ein US-Urteil.",
  lead: "Manche Anbieter beantragen in kurzer Zeit viele Kreditkarten und stellen die addierten Rahmen als Startkapital dar — teils gegen ein Honorar, das mit jedem weiteren Kartenantrag wächst. Hier steht, was dabei in Ihrer Kreditakte und in Ihrer Haftung geschieht, was ein US-Bundesgericht auf Klage der Handelsaufsicht FTC im Fall Seek Capital festgestellt hat und in welcher Reihenfolge Kreditwürdigkeit entsteht.",
  ziffern: [
    { wert: "48,28 Mio. $", label: "Gebühren, die Kunden an Seek Capital zahlten" },
    { wert: "35 %", label: "Gewicht des Zahlungsverlaufs im FICO Score" },
    { wert: "1 Jahr", label: "so lange zählt eine harte Anfrage im FICO Score" },
  ],
  blick: [
    ["Was es ist", "Viele Kartenanträge in kurzer Zeit, die Rahmen als Startkapital"],
    ["Wer haftet", "In der Regel der Inhaber persönlich, für jede Karte einzeln"],
    ["Was es kostet", "Teils ein Honorar, das mit jedem Kartenantrag wächst; dazu Zins und Gebühren der Herausgeber"],
    ["Spuren in der Akte", "Viele harte Anfragen, junge Konten, hohe Auslastung"],
    ["Der Maßstab", "FTC v. Seek Capital: dauerhaftes Verbot seit Oktober 2025"],
    ["Wer entscheidet", "Jeder Herausgeber selbst, über Karte und Rahmen"],
    ["Mit FIAON Global", "Jeder Antrag einzeln vorbereitet — auf Wunsch; Sie stellen ihn selbst"],
  ],
  kurz: "In kurzer Zeit viele Kreditkarten bei verschiedenen Herausgebern zu beantragen und die Rahmen zusammen als Startkapital zu nutzen, wird im Netz als „Kreditkarten-Stacking“ beworben. Der Sache nach ist es persönlicher Kredit: Für Firmenkarten haftet der Inhaber in der Regel persönlich, jede Prüfung wird als harte Anfrage in der Kreditakte vermerkt, und die Einführungszeiträume enden etwa zur selben Zeit. Auf Klage der US-Handelsaufsicht FTC ist einem Anbieter, der gegen hohe Gebühren Karten beantragte und dabei Beziehungen zu Kreditgebern und Zeiträume ohne Zinsen behauptete, seit 2025 das Finanzierungsgeschäft dauerhaft untersagt. Kreditwürdigkeit entsteht in Schritten: wenige Anträge mit Abstand, pünktlich beglichene Abrechnungen, echte Umsätze. Über jede Karte und jeden Rahmen entscheidet der Herausgeber.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "Die Praxis: viele Anträge auf einmal",
      absaetze: [
        "In kurzer Zeit werden Anträge bei mehreren Kartenherausgebern gestellt, häufig für die eigene Person und für die US-Gesellschaft zugleich. Die Rahmen der bewilligten Karten werden addiert und als Startkapital ausgegeben, häufig gezielt bei Karten mit einem Einführungszeitraum.",
        "Im deutschsprachigen Netz wird das Modell unter englischen Namen als Finanzierung für die US-LLC verkauft, teils auch als „Kreditlinie“: als Kurs, als Mitgliedschaft oder als Dienstleistung, die die Anträge im Namen des Kunden stellt. Das Versprechen klingt nach Kapital ohne Bank. Tatsächlich sind es Karten — mit allem, was zu Karten gehört:",
      ],
      punkte: [
        "Jede Karte ist ein eigener Kreditvertrag mit eigenem Herausgeber, eigenen Bedingungen und eigener Abrechnung.",
        "Über Ausgabe, Rahmen und Zins entscheidet jeder Herausgeber selbst — nach seiner Prüfung, nicht nach dem Plan eines Anbieters.",
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
        ["Besondere, direkte Beziehungen zu Kreditgebern, kein Geld von ihnen", "Beziehungen, die Kunden einen Vorteil brachten, gab es nicht. Seek ließ sich von Kreditgebern für die Zuführung von Kunden vergüten. Banken forderten Seek schriftlich auf, seine Antragspraxis zu unterlassen; eine US-Bank bezeichnete sie 2022 als System serienweiser Kreditkartenanträge."],
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
        "Für die Kunden heißt das: Die Gebühren blieben beim Anbieter. Die Karten, die Anfragen in der Akte und die persönliche Haftung für jeden Saldo blieben bei ihnen.",
      ],
    },
    {
      typ: "tabelle", id: "akte", h2: "Was viele Anträge in Ihrer Kreditakte hinterlassen",
      lead: "Der FICO Score fasst die persönliche Kreditakte in fünf Gruppen von Daten zusammen. Viele Kartenanträge in kurzer Zeit berühren fast alle davon.",
      kopf: ["Daten", "Gewicht", "Wirkung vieler Anträge in kurzer Zeit"],
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
        "Ist das Geld in ein Geschäft geflossen, das noch keinen Umsatz trägt, kommt die Rückführung aus der eigenen Tasche. An dieser Stelle zeigt sich: Viele Karten auf einmal sind keine Finanzierung der Gesellschaft, sondern persönlicher Kredit des Inhabers.",
      ],
    },
    {
      typ: "text", id: "recht", h2: "Haftung und Recht: was in den USA und in Deutschland gilt",
      absaetze: [
        "Für Firmenkarten junger Gesellschaften verlangen Herausgeber in der Regel eine persönliche Haftung des Inhabers („personal guarantee“). Bleibt die Gesellschaft eine Abrechnung schuldig, haftet er selbst; die beschränkte Haftung der LLC schützt ihn dann nicht. Bei mehreren Karten gilt das für jede einzelne.",
        "Die Verbraucherschutzregeln der US-Regulation Z gelten für Kredit zu überwiegend geschäftlichen Zwecken nicht (12 CFR 1026.3(a)). Für Firmenkarten bleiben vor allem die Regeln zur Ausgabe einer Karte und zur Haftung bei unbefugter Nutzung (12 CFR 1026.12 Abs. a und b; amtliche Auslegung zu § 1026.3, Kommentar 3-1). Was darüber hinaus gilt, steht im Kartenvertrag — und den legt der Herausgeber fest.",
        "Wer in einem Antrag an ein Institut mit US-Einlagensicherung wissentlich falsche Angaben macht, etwa Umsatz oder Einkommen schönt, macht sich nach 18 U.S.C. § 1014 strafbar; das Gesetz sieht Geldstrafe von höchstens einer Million US-Dollar, Freiheitsstrafe von höchstens dreißig Jahren oder beides vor. Die Executive Order 14406 vom 19. Mai 2026 weist zudem das US-Finanzministerium an, Finanzinstitute auf Warnzeichen hinzuweisen: Die Nutzung einer ITIN statt einer SSN, um Kreditprodukte zu erhalten, kann danach ohne geprüften US-Aufenthaltsstatus als Risikofaktor gelten, der eine vertiefte Prüfung verlangt.",
        "In Deutschland braucht eine Erlaubnis der zuständigen Behörde, wer gewerbsmäßig den Abschluss von Darlehensverträgen vermittelt (§ 34c Abs. 1 Satz 1 Nr. 2 GewO). Ein Anbieter, der Ihnen eine Finanzierung verkauft, sollte sagen können, ob er Darlehen vermittelt — und wenn ja, mit welcher Erlaubnis. FIAON vergibt und vermittelt keine Kredite.",
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Anträge in Serie oder geplanter Aufbau",
      lead: "Ein geplanter Aufbau nutzt dieselben Produkte, aber in anderer Reihenfolge und mit anderem Ziel: eine Historie, die mit jeder pünktlich beglichenen Abrechnung wächst, statt eines Rahmens, der auf einmal ausgeschöpft ist.",
      kopf: ["", "Anträge in Serie", "Geplanter Aufbau"],
      hervor: 2,
      zeilen: [
        ["Anträge", "viele in kurzer Zeit", "wenige, mit Abstand und nach Plan"],
        ["Wer den Antrag stellt", "teils ein Anbieter per Vollmacht", "Sie selbst, vollständig vorbereitet"],
        ["Grundlage", "der addierte Rahmen", "echte Umsätze und pünktlich beglichene Abrechnungen"],
        ["Auslastung", "hoch — die Rahmen sind das Kapital", "niedrig gehalten"],
        ["Einführungszeiträume", "enden gemeinsam", "gestaffelt, mit Plan für die Rückführung aus dem Geschäft"],
        ["Akte nach einem Jahr", "viele Anfragen, junge Konten, hohe Salden", "wachsende Historie mit pünktlichen Zahlungen"],
        ["Honorar", "bei manchen Anbietern wachsend mit jedem Kartenantrag", "bei FIAON Global: Honorar und Leistungen stehen fest, bevor Sie unterzeichnen"],
        ["Wer entscheidet", "jeder Herausgeber", "jeder Herausgeber"],
      ],
      fuss: ["Vereinfachte Gegenüberstellung. Über jede Karte und jeden Rahmen entscheidet der Herausgeber."],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Woran Sie unseriöse Angebote erkennen", spalten: 3,
      karten: [
        { tag: "Warnzeichen", titel: "Honorar, das mit jedem Kartenantrag wächst", text: "Wer an jeder weiteren Karte verdient, hat einen Anreiz zu immer neuen Anträgen — auch wenn sie Ihrer Akte schaden. Seek Capital berechnete eine Gebühr auf die erreichten Kartenrahmen und beschaffte nach eigener Angabe mehr Rahmen, als der Vertrag als Finanzierung vorschlug." },
        { tag: "Warnzeichen", titel: "Besondere Beziehungen zu Banken", text: "„Direkte Kontakte“ und Konditionen, die es sonst nicht gibt: Im Fall Seek gab es sie nicht — Banken verlangten stattdessen schriftlich, die Antragspraxis einzustellen. Jeder Herausgeber prüft nach eigenen Regeln." },
        { tag: "Warnzeichen", titel: "Rahmen und Zins vorab zugesagt", text: "Höhe, Zins und Einführungszeitraum legt allein der Herausgeber fest, nach seiner Prüfung. Wer sie zusagt, sagt zu, was er nicht halten kann. Ein Ziel dürfen Sie selbst wählen — eine Zusage ist es nicht." },
        { tag: "Warnzeichen", titel: "„Keine Gebühr bis zur Finanzierung“", text: "Lesen Sie, was beim Ausstieg fällig wird. Seek warb damit, erst nach der Finanzierung eine Gebühr zu berechnen, und berechnete Ausstiegsgebühren, bevor eine Finanzierung zugesagt war. Wann ein Honorar fällig wird, muss im Vertrag stehen, bevor Sie unterzeichnen." },
        { tag: "Warnzeichen", titel: "„Keine harte Anfrage“", text: "Ein Kartenantrag mit Prüfung Ihrer Akte ist in der Regel eine harte Anfrage. Seek verwies vor Gericht auf eine Vorprüfung ohne Wirkung auf den Score — die Kartenanträge selbst lösten harte Anfragen aus." },
        { tag: "Warnzeichen", titel: "Eile, Vollmacht, Schweigeklausel", text: "Zeitdruck vor der Unterschrift, Kreditanträge per Vollmacht in Serie und eine Klausel gegen negative Bewertungen standen im Fall Seek nebeneinander." },
      ],
    },
    {
      typ: "etappen", id: "leiter", h2: "Der Aufbau in sechs Schritten",
      lead: "Kreditwürdigkeit entsteht in Schritten. Jeder baut auf dem vorigen auf; über jede Karte entscheidet der Herausgeber.",
      etappen: [
        { titel: "Grundlage legen", text: "Gesellschaft, EIN, ITIN, US-Anschrift und US-Telefon, Geschäftskonto und D-U-N-S-Nummer — mit identischen Stammdaten in jedem Register und jedem Antrag." },
        { titel: "Erste Karte passend zur Historie", text: "Ein Herausgeber, dessen Prüfung zu Ihrer Akte passt. Der Antrag ist vollständig vorbereitet; Sie stellen ihn selbst." },
        { titel: "Pünktlich begleichen, wenig auslasten", text: "Jede Abrechnung vollständig und pünktlich begleichen, die Auslastung niedrig halten. Daraus entsteht der Zahlungsverlauf, den FICO am stärksten gewichtet." },
        { titel: "Abstand zwischen den Anträgen", text: "Weitere Herausgeber folgen in geplanter Reihenfolge, wenn die Akte es trägt — nicht alle im selben Monat." },
        { titel: "Umsatz und Lieferantenkonten", text: "Echte Umsätze über das Geschäftskonto und Lieferanten mit Zahlungsziel bauen auch die Akte der Gesellschaft auf." },
        { titel: "Bank und Sicherheiten", text: "Für größere Beträge zählen Geschäftsjahre, Kennzahlen und Sicherheiten. Geordnete Abschlüsse sind die Grundlage für ein späteres Bankdarlehen; darüber entscheidet die Bank." },
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        `${KARTEN.satz} Wir bereiten jeden Kartenantrag einzeln und vollständig vor; Anträge in Serie bereiten wir nicht vor. Niemand unterzeichnet in Ihrem Namen bei einem Kartenherausgeber.`,
        `${FINANZIERUNG.satz} ${satz("S9")}`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${KARTEN.ihrTeil}`,
        `${TEIL.bedingung}: ${KARTEN.bedingung}`,
        `Honorar: ${beleg("honorarVorab")}`,
        P.geldZurueck,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        GLOBAL_PFLICHTHINWEIS.de[2],
        "Ein Einführungszeitraum endet zu einem festen Datum; danach gilt der reguläre Zins des Herausgebers auf den offenen Saldo.",
        `${satz("S8")} FIAON sagt keinen Rahmen zu. ${satz("S9")}`,
        GLOBAL_PFLICHTHINWEIS.de[0],
        "Dieser Beitrag gibt die Rechtslage und den Fall Seek Capital nach den genannten Quellen wieder, Stand Oktober 2026; er ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.",
      ],
    },
  ],
  fragen: [
    { f: "Was bedeutet es, viele Kreditkarten auf einmal zu beantragen?", a: "In kurzer Zeit werden viele Kreditkarten bei verschiedenen Herausgebern beantragt und ihre Rahmen zusammen als Startkapital genutzt. Es sind Karten, keine Darlehen: Jede hat eigene Bedingungen, für Firmenkarten haftet der Inhaber in der Regel persönlich, und jede Prüfung wird in der Kreditakte vermerkt." },
    { f: "Ist es in den USA erlaubt, viele Kreditkarten auf einmal zu beantragen?", a: "Mehrere Karten zu beantragen, ist für sich genommen nicht verboten. Strafbar sind wissentlich falsche Angaben in Kreditanträgen (18 U.S.C. § 1014); täuschende Versprechen von Anbietern verfolgt die FTC — Seek Capital ist seit Oktober 2025 dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen. Banken sehen solche Serien kritisch: Eine US-Bank verlangte 2022 schriftlich, dass Seek seine Antragspraxis einstellt. Über jede Karte entscheidet der Herausgeber." },
    { f: "Was ergab das Verfahren der FTC gegen Seek Capital?", a: "Auf Antrag der FTC stellte ein US-Bundesgericht im September 2025 fest, dass Seek Capital mit Beziehungen zu Kreditgebern, einer Kreditlinien-Funktion der Karten, Zeiträumen ohne Zinsen, „keiner Gebühr bis zur Finanzierung“ und „keinen harten Anfragen“ getäuscht hatte. Seit Oktober 2025 sind Seek und sein Gründer dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen; das Geldurteil über 48,28 Millionen US-Dollar ist teilweise ausgesetzt." },
    { f: "Wie stark wirken harte Anfragen auf den Score?", a: "Nach myFICO kostet eine einzelne weitere Anfrage die meisten Menschen weniger als fünf Punkte. Harte Anfragen können zwei Jahre in der Akte stehen und zählen im FICO Score ein Jahr lang. Viele neue Konten in kurzer Zeit gelten dagegen als Zeichen höheren Risikos — und jeder weitere Herausgeber sieht sie, bevor er entscheidet." },
    { f: "Hafte ich persönlich für die Kreditkarten meiner US-LLC?", a: "In der Regel ja. Für Firmenkarten junger Gesellschaften verlangen Herausgeber eine persönliche Haftung des Inhabers; die beschränkte Haftung der LLC greift dann nicht. Bei mehreren Karten gilt das für jede Karte einzeln." },
    { f: "Bekommt eine US-LLC Kreditkarten, wenn der Inhaber in Europa wohnt?", a: "Das entscheidet jeder Herausgeber. Bei jungen Gesellschaften prüft er in der Regel die persönliche US-Historie des Inhabers über SSN oder ITIN und verlangt seine persönliche Haftung. Nach der Executive Order 14406 vom 19. Mai 2026 kann eine ITIN statt einer SSN ohne geprüften US-Aufenthaltsstatus zudem als Risikofaktor für eine vertiefte Prüfung gelten. Eine sorgfältig vorbereitete Akte zählt deshalb mehr als die Zahl der Anträge." },
    { f: "Was kostet FIAON Global — gibt es ein Erfolgshonorar?", a: `Ja. ${P.preisSatz} Kreditkartenanträge bereiten wir auf Wunsch vor, ohne zusätzliches Honorar von FIAON.` },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/business/wissen/us-funding", "/business/wissen/us-firmenkarte-beantragen", "/business/wissen/us-bonitaet-aufbauen", "/business/wissen/anbieter-pruefen"],
  quellen: [Q.ftcSeek, Q.ftcSeekUrteil, Q.ficoFaktoren, QUELLEN.ficoAnfragen, QUELLEN.cfpbAnfrage, Q.regZ3, QUELLEN.regZ3Auslegung, Q.regZ12, QUELLEN.usc1014, QUELLEN.eo14406, QUELLEN.gewo34c],
};
