// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: US FUNDING (27.10.2026, E-439) · FG · 43
//
// Der Pfeiler zu Justins Kernbegriff. „US Funding“ ist ein DACH-Suchwort (Recherche
// .arbeit/recherche/kw_de.md, T1): Kapital über eine eigene US-Gesellschaft. Die
// Treffer zum Wort kommen fast nur aus der „steuerfrei / Kartenstapeln“-Szene, ohne
// Primärquellen. Diese Seite ordnet ruhig und belegt ein: drei Ebenen, eine ehrliche
// Reihenfolge, die Warnzeichen — gemessen am Fall FTC v. Seek Capital — und der
// SBA-Ausschluss seit 01.03.2026.
//
// Selbst nachgeprüft am 27.10.2026:
// · FTC-Mitteilung 17.11.2025; Gerichtsentscheidung C.D. Cal. vom 16.09.2025 (Az.
//   2:24-cv-09511): Seek beantragte ausschließlich Kreditkarten, per notarieller
//   Vollmacht im Namen der Kunden; Gebühren u. a. in Prozent der erzielten Kartenrahmen,
//   Antrags-, Eil- und Kündigungsgebühren; Kunden zahlten 48.280.328,57 $; abschließende
//   Anordnung (Vergleich) 01.10.2025; Geldurteil 48.280.328 $, teilweise ausgesetzt.
//   Fachprüfung 27.10.2026: Als Täuschung festgestellt hat das Gericht NUR fünf Punkte —
//   Kreditgeber-Beziehungen, „Kreditlinien-Funktion“ der Karten, Zinsbedingungen,
//   „keine Gebühr bis zur Finanzierung“, Wirkung auf den Score. Zu „Kredite und
//   Kreditlinien“ und zu den Bewertungen blieb der Streit offen (kein Befund) — nie
//   anders schreiben. Klauseln gegen negative Bewertungen: Verstoß gegen den CRFA.
// · SBA Procedural Notice 5000-876626, veröffentlicht 11.02.2026, gültig ab 01.03.2026:
//   100 % der direkten und indirekten Eigentümer US-Bürger oder US-Nationals mit
//   Hauptwohnsitz in den USA; Green Card nicht mehr ausreichend; jede beteiligte
//   Gesellschaft muss in den USA gegründet sein (eine GmbH als Gesellschafterin schließt aus).
// · Executive Order 14406 vom 19.05.2026, Sec. 3(a)(vi): Auftrag an das Finanzministerium
//   für eine Warnung an Institute; ITIN statt SSN bei Antragstellern ohne nachgewiesenen
//   Aufenthaltsstatus „may be identified as a risk factor requiring enhanced due diligence“.
//   Keine unmittelbare Pflicht der Institute — so auch im Text.
// · myFICO (Mindestbedingungen, Faktoren), Dun & Bradstreet (D-U-N-S kostenlos, neun
//   Ziffern; PAYDEX 1–100, ab 80 geringes Risiko laut „Business Credit Scores and Ratings“),
//   § 34c GewO, § 10 AO, § 1 KStG, § 138 Abs. 5 AO, 18 U.S.C. § 1014, 12 CFR 1026.3.
// Bewusst weggelassen: die Aussage der Recherche, eine GAO-Entscheidung (B-338157) habe
// eine 5-%-Ausnahme aufgehoben — die GAO stellte nur fest, dass die SBA-Hinweise Regeln
// im Sinne des Congressional Review Act sind.
//
// Wortwand: kein „bis zu“, kein Bankname, keine Frist mit Ziffer, kein Zinssatz, kein
// „Kredite vermitteln“, kein Steuerversprechen; Paketpreise nur über den Baustein „paket“.
// „Unternehmensberatung“ als Selbstbezeichnung erlaubt seit E-439 (Justin, 27.10.2026).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite, GlobalQuelle } from "../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q, IRS } from "../fakten";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

/** Eigene Quellen dieses Beitrags (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  sbaNotice: {
    titel: "SBA Procedural Notice 5000-876626 — Eigentümer, Staatsbürgerschaft und Wohnsitz bei 7(a)- und 504-Krediten (gültig ab 01.03.2026)",
    url: "https://www.sba.gov/document/procedural-notice-5000-876626-revised-applicant-ownership-citizenship-residency-requirements-7a-504-loans",
  },
  eo14406: {
    titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19.05.2026)",
    url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/",
  },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
  gewo34c: { titel: "§ 34c GewO — Erlaubnispflicht unter anderem für Darlehensvermittler", url: "https://www.gesetze-im-internet.de/gewo/__34c.html" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  paydexRisiko: { titel: "Dun & Bradstreet — Business Credit Scores and Ratings (PAYDEX-Risikoklassen)", url: "https://www.dnb.com/en-us/smb/resources/credit-scores/db-credit-scores-ratings.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/us-funding",
  art: "wissen",
  seo: {
    titel: "US Funding: was es ist, was seriös ist — FIAON Global",
    beschreibung: "US Funding erklärt: drei Ebenen (ITIN-Bonität, Firmenbonität, Sicherheiten), eine ehrliche Reihenfolge und die Warnzeichen unseriöser Programme.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 43",
  auge: "Wissen · Kapital",
  h1: "US Funding.",
  h1b: "Was es ist — und was seriös ist.",
  lead: "„US Funding“ heißt im deutschsprachigen Markt: Kapital über eine eigene US-Gesellschaft — Firmenkarten, Business Credit, eine Bankbeziehung mit Sicherheiten, Eigenkapital. Das Wort wird oft mit Versprechen verkauft, die kein Anbieter halten kann. Hier steht, worauf US Funding wirklich beruht, in welcher Reihenfolge es wächst und woran Sie ein seriöses Angebot erkennen.",
  ziffern: [
    { wert: "3 Ebenen", label: "persönliche Bonität, Bonität der Firma, Sicherheiten" },
    { wert: "01.03.2026", label: "seitdem SBA-Kredite nur noch, wenn alle Eigentümer US-Bürger mit Wohnsitz in den USA sind" },
    { wert: "48,28 Mio. $", label: "Geldurteil gegen einen Funding-Anbieter, FTC 2025" },
  ],
  blick: [
    ["Was es meint", "Kapital über eine US-Gesellschaft, nicht über Ihre Person in Europa"],
    ["Ebene 1", "Persönliche US-Bonität über die ITIN"],
    ["Ebene 2", "Bonität der Firma: EIN, D-U-N-S-Nummer, Lieferantenkonten"],
    ["Ebene 3", "Sicherheiten für größere Summen: Einlage, Muttergesellschaft, Vermögen"],
    ["Nicht offen", "SBA-Kredite für Eigentümer aus Europa, seit dem 1. März 2026"],
    ["Wer entscheidet", "Allein das Institut — über Konto, Karte, Rahmen und Darlehen"],
    ["Mit FIAON Global", "Ein Ansprechpartner statt acht: Struktur, Bonität, vorbereitete Anträge — zum Festpreis"],
  ],
  kurz: "US Funding bezeichnet im deutschsprachigen Raum den Aufbau von Kapital über eine eigene US-Gesellschaft: Firmenkarten, Business Credit, eine Bankbeziehung mit Sicherheiten und Eigenkapital. Es wächst auf drei Ebenen — persönliche US-Bonität über die ITIN, Bonität der Firma über EIN, D-U-N-S-Nummer und Lieferantenkonten, Sicherheiten für größere Summen — und braucht Monate bis Jahre, nicht Wochen. Seriös ist ein Angebot, das Gebühren vorab nennt, weder Rahmen noch Zins verspricht, die persönliche Haftung erklärt und sagt: Über jeden Kredit entscheidet allein das Institut.",
  bloecke: [
    {
      typ: "text", id: "begriff", h2: "Was „US Funding“ im deutschsprachigen Markt meint",
      absaetze: [
        "Im Englischen meint „US funding“ meist Fördermittel oder Wagniskapital. Im deutschsprachigen Markt steht das Wort für etwas anderes: Unternehmer gründen eine US-Gesellschaft, meist eine LLC, und bauen über sie Zugang zu Kapital bei US-Instituten auf. Kapital über eine US-Firma umfasst vier Dinge, die oft in einem Atemzug genannt werden, aber ganz verschieden funktionieren:",
      ],
      punkte: [
        "Firmenkarten — Kreditkarten auf die Gesellschaft, in der Regel mit persönlicher Haftung des Inhabers",
        "Business Credit — die eigene Kreditgeschichte der Gesellschaft bei Wirtschaftsauskunfteien, aus der Lieferantenkredit und später Kreditlinien entstehen",
        "eine Bankbeziehung mit Sicherheiten — Kreditlinien und Darlehen gegen Einlage, Bürgschaft einer Muttergesellschaft oder Vermögen",
        "Eigenkapital — Mittel der Inhaber oder von Investoren, die in die Gesellschaft eingelegt werden",
      ],
      nach: "Die US-Gesellschaft ist dabei das Gefäß, nicht die Quelle: Kapital entsteht erst, wenn ein Institut auf Grundlage von Historie, Umsatz oder Sicherheit zusagt. Eine „US Funding LLC“, die aus sich heraus Kapital bringt, gibt es nicht. Viele Programme verkaufen US Funding mit Kreditkarten als ganze Lösung; Karten sind aber nur die erste Schicht.",
    },
    {
      typ: "tabelle", id: "ebenen", h2: "Die drei Ebenen von US Funding",
      lead: "Jede Ebene beruht auf einer anderen Grundlage und trägt eine andere Größenordnung. Die Ebenen bauen aufeinander auf; keine ersetzt die andere.",
      kopf: ["Ebene", "Grundlage", "Schlüssel", "Was sie trägt", "Wer entscheidet"],
      zeilen: [
        ["1 · Persönliche US-Bonität", "Ihre Kreditakte bei Equifax, Experian und TransUnion", "ITIN oder SSN, US-Anschrift, US-Telefonnummer", "erste Karten mit kleinem Rahmen, später größere", "der Kartenherausgeber"],
        ["2 · Bonität der Firma", "die Akte der Gesellschaft bei Wirtschaftsauskunfteien", "EIN, D-U-N-S-Nummer, Geschäftskonto, Lieferantenkonten", "Lieferantenkredit, Firmenkarten, später Kreditlinien", "Lieferant, Herausgeber, Bank"],
        ["3 · Sicherheiten", "Vermögen, auf das ein Institut zugreifen kann", "Einlage, Bürgschaft einer Muttergesellschaft, Depot, Immobilie", "größere Kreditlinien und Darlehen", "die Bank nach eigener Prüfung"],
      ],
      fuss: ["Vereinfachte Übersicht. Bedingungen, Höhe und Zins legt jedes Institut selbst fest; über jeden Kredit entscheidet allein das Institut."],
    },
    {
      typ: "text", id: "ebene1", h2: "Ebene 1: Ihre persönliche US-Bonität mit ITIN",
      absaetze: [
        "Ihre Einträge bei SCHUFA, KSV1870 oder CRIF stehen nicht in den Akten der drei landesweiten US-Auskunfteien Equifax, Experian und TransUnion; dort beginnt Ihre Kreditgeschichte in aller Regel ohne Einträge. Ohne Sozialversicherungsnummer (SSN) führt der Weg über die ITIN, die neunstellige Steuernummer der IRS für Personen, die keine SSN erhalten können. Einen FICO Score kann es frühestens geben, wenn mindestens ein Konto sechs Monate oder älter ist und mindestens ein Konto in den letzten sechs Monaten an eine Auskunftei gemeldet wurde.",
        "Diese Ebene zählt mehr, als viele Programme sagen: Bei einer jungen Gesellschaft schauen Kartenherausgeber auf die Person dahinter und verlangen in der Regel ihre persönliche Haftung. Dazu kommt eine neue Vorgabe: Die Executive Order 14406 vom 19. Mai 2026 beauftragt das US-Finanzministerium, Institute vor Missbrauch zu warnen. Darin nennt sie die Nutzung einer ITIN anstelle einer SSN bei Kredit- und Kontoanträgen von Antragstellern ohne nachgewiesenen Aufenthaltsstatus als möglichen Risikofaktor, der eine vertiefte Prüfung verlangt. Wie ein Institut das umsetzt, legt es selbst fest. Wer mit ITIN beantragt, sollte mit Rückfragen rechnen — und sie mit vollständigen, widerspruchsfreien Angaben beantworten.",
      ],
    },
    {
      typ: "text", id: "ebene2", h2: "Ebene 2: Business Credit in den USA — die Bonität Ihrer Gesellschaft",
      absaetze: [
        "Neben Ihrer persönlichen Akte kann die Gesellschaft eine eigene Kreditgeschichte bei Wirtschaftsauskunfteien wie Dun & Bradstreet und Experian aufbauen. Grundlage sind die EIN der IRS, einheitliche Stammdaten — Name, Anschrift und Telefonnummer überall identisch — und die neunstellige D-U-N-S-Nummer, die Dun & Bradstreet kostenlos vergibt.",
        "Gefüllt wird die Akte durch Lieferantenkonten mit Zahlungsziel, die ihre Erfahrungen an die Auskunfteien melden. Der PAYDEX von Dun & Bradstreet bewertet die Pünktlichkeit auf einer Skala von 1 bis 100; ab 80 gilt das Risiko eines Verzugs als gering. In den Wert gehen nur Zahlungserfahrungen ein, die Lieferanten tatsächlich an Dun & Bradstreet melden.",
        "Die Grenze dieser Ebene sagen wir offen: Eine Firmenbonität wächst über Jahre. Bei jungen Gesellschaften ersetzt sie die persönliche Haftung nicht, und für eine Kreditlinie der Bank zählen am Ende Umsatz, Abschlüsse und Rücklagen — nicht ein Score allein.",
      ],
    },
    {
      typ: "text", id: "ebene3", h2: "Ebene 3: Sicherheiten für größere Summen",
      absaetze: [
        "Größere Beträge entstehen in den USA wie in Europa aus Sicherheiten. Eine Bank kann eine Kreditlinie gegen eine Einlage auf ihrem Konto einräumen, gegen die Bürgschaft einer Muttergesellschaft in Europa — dann prüft sie vor allem deren Bilanz —, gegen ein Wertpapierdepot oder eine Immobilie. Dazu kommt Eigenkapital der Inhaber, das in die Gesellschaft eingelegt wird.",
        "Ein Weg ist für Gesellschaften mit Inhabern aus Europa seit dem 1. März 2026 versperrt: Staatlich gestützte Kleinunternehmerkredite der SBA aus den Programmen 7(a) und 504 setzen nach der Procedural Notice 5000-876626 voraus, dass alle direkten und indirekten Eigentümer US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind. Auch Inhaber einer Green Card sind ausgeschlossen, ebenso US-Bürger mit Hauptwohnsitz im Ausland. Jede beteiligte Gesellschaft muss zudem in den USA gegründet sein — eine GmbH oder AG als Gesellschafterin schließt den Kredit ebenfalls aus. Wer Ihrer LLC aus Europa einen SBA-Kredit in Aussicht stellt, kennt die Regel nicht oder verschweigt sie.",
      ],
    },
    {
      typ: "etappen", id: "reihenfolge", h2: "Eine realistische Reihenfolge — ohne Zusage",
      lead: "So wächst US Funding in der Praxis. Die Dauern sind Behördenangaben und Erfahrungswerte, keine Zusage; wie schnell eine Etappe geht, bestimmen Behörden, Auskunfteien und Institute.",
      etappen: [
        { titel: "Struktur", dauer: "erste Wochen", text: `Gesellschaft im passenden Bundesstaat, Registered Agent, Operating Agreement und die EIN der IRS — beim Antrag aus dem Ausland ${IRS.einDauer}. Zu Hause wird die Gründung dem Finanzamt gemeldet, in Deutschland nach § 138 AO zusammen mit der Steuererklärung.` },
        { titel: "Identität und Präsenz", dauer: "parallel", text: `ITIN mit Form W-7, US-Anschrift und US-Telefonnummer, in jedem Antrag identisch geschrieben. Für die ITIN nennt die IRS ${IRS.itinDauer}.` },
        { titel: "Konto und Stammdaten", dauer: "nach der EIN", text: "Geschäftskonto der Gesellschaft, D-U-N-S-Nummer, einheitliche Stammdaten bei allen Stellen. Das Konto ist die Grundlage für alles Weitere: Zahlungsplattformen zahlen darauf aus, und Umsätze werden dort sichtbar." },
        { titel: "Erste Karte und Lieferantenkonten", dauer: "erste Monate", text: "Ein gut vorbereiteter erster Kartenantrag und Lieferantenkonten aus dem echten Geschäft. Jede Abrechnung pünktlich, die Rahmen nur zu einem kleinen Teil genutzt." },
        { titel: "Erster Score, weitere Herausgeber", dauer: "ab etwa sechs Monaten", text: "Ist ein Konto sechs Monate alt und gemeldet, erfüllt die Akte die Mindestbedingungen für einen FICO Score. Weitere Anträge folgen geplant und mit Abstand: Jede Anfrage steht in der Akte, und mehrere neue Konten in kurzer Zeit gelten bei FICO als höheres Risiko." },
        { titel: "Umsatz und Abschlüsse", dauer: "laufend", text: "Echter Umsatz über das US-Konto, saubere Zahlen, Rücklagen. Darauf schauen Zahlungsplattformen und Banken bei jeder größeren Entscheidung." },
        { titel: "Bank und Sicherheiten", dauer: "mit gewachsener Historie", text: "Kreditlinie oder Darlehen auf Grundlage von Geschäftsjahren, Umsatz oder Sicherheit. Den Antrag stellen Sie; die Bank prüft nach ihren Regeln und entscheidet allein." },
      ],
    },
    {
      typ: "text", id: "seek", h2: "Ein Fall der US-Handelsaufsicht: FTC v. Seek Capital",
      absaetze: [
        "Wie US Funding nicht aussehen darf, hat ein US-Gericht ausführlich festgehalten. Die Handelsaufsicht FTC verklagte im November 2024 einen Anbieter, der Gründern Unternehmensfinanzierung versprach. Nach der Entscheidung des U.S. District Court for the Central District of California vom 16. September 2025 beantragte das Unternehmen in Wahrheit ausschließlich Kreditkarten — per notarieller Vollmacht im Namen seiner Kunden, teils über mehr Kredit, als diese ausdrücklich freigegeben hatten. Es berechnete Gebühren in Prozent der erzielten Kartenrahmen, dazu Antragsgebühren, Aufschläge für Eile und Gebühren beim Ausstieg vor der „Finanzierung“. Zusammen flossen so rund 48,28 Millionen US-Dollar von den Kunden an den Anbieter.",
        "Fünf Werbeaussagen wertete das Gericht schon ohne Hauptverhandlung als Täuschung: besondere Beziehungen zu Kreditgebern, Karten „mit Kreditlinien-Funktion“, Zeiträume „ohne Zinsen“, „keine Gebühr bis zur Finanzierung“ und die Erklärung, der Score leide nicht — obwohl bei den Kartenanträgen harte Anfragen gestellt wurden. Ein Formularvertrag untersagte Kunden zudem drei Jahre lang negative Bewertungen; auch das verstieß nach dem Gericht gegen US-Recht. Ob schon das Versprechen von „Krediten und Kreditlinien“ täuschte, ließ das Gericht offen, weil Kreditkarten rechtlich als Kreditlinie gelten können.",
        "Mit der abschließenden Anordnung vom 1. Oktober 2025, einem Vergleich mit der FTC, ist dem Anbieter und seinem Chef dauerhaft verboten, Kredite und Unternehmensfinanzierung anzubieten; die FTC gab das am 17. November 2025 bekannt. Das Geldurteil über 48.280.328 US-Dollar ist teilweise ausgesetzt, weil die Beklagten es nicht begleichen können. Der Fall beschreibt Punkt für Punkt, woran sich jedes Funding-Programm messen lassen muss — auch FIAON.",
      ],
    },
    {
      typ: "karten", id: "warnzeichen", h2: "Warnzeichen unseriöser Funding-Programme", spalten: 3,
      karten: [
        { tag: "Warnzeichen", titel: "Gebühren fürs Kartenstapeln", text: "Honorare in Prozent der erzielten Rahmen machen jeden weiteren Antrag zum Geschäft des Anbieters — auch wenn er Ihrer Akte schadet. Viele Anträge auf einmal heißen viele harte Anfragen; mehrere neue Konten in kurzer Zeit wertet FICO als höheres Risiko, vor allem bei kurzer Historie — und alle Einführungszeiträume enden zur selben Zeit." },
        { tag: "Warnzeichen", titel: "Behauptete Kreditgeber-Beziehungen", text: "„Unsere Banken geben unseren Kunden mehr“: Über jeden Antrag entscheidet das Institut nach seinen eigenen Regeln. Genau diese Behauptung hat das Gericht im Fall der FTC als Täuschung gewertet." },
        { tag: "Warnzeichen", titel: "Zinsversprechen", text: "Wer „zinsfrei“ oder einen festen Zinssatz verspricht, verspricht, was nur ein Herausgeber festlegen kann. Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest." },
        { tag: "Warnzeichen", titel: "„Steuerfrei“-Versprechen", text: "Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, bleibt dort steuerpflichtig. Wer „steuerfrei“ verkauft, verschweigt das Steuerrecht zu Hause — in Deutschland etwa § 10 AO und § 1 KStG — und die Meldepflicht nach § 138 AO." },
        { tag: "Warnzeichen", titel: "Ein Rahmen als Zahl", text: "Beispielrahmen in Dollar, „sechsstellig in einem Jahr“: Über jeden Rahmen entscheidet der Herausgeber. Wer eine Höhe in Aussicht stellt, stellt in Aussicht, was er nicht halten kann." },
        { tag: "Warnzeichen", titel: "SBA-Kredit für Ausländer", text: "Seit dem 1. März 2026 sind Gesellschaften, deren Eigentümer nicht ausnahmslos US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind, von SBA-Krediten der Programme 7(a) und 504 ausgeschlossen. Wer sie trotzdem anbietet, arbeitet mit veraltetem Wissen." },
      ],
    },
    {
      typ: "tabelle", id: "pruefliste", h2: "Checkliste: So prüfen Sie, ob ein US-Funding-Angebot seriös ist",
      lead: "Zehn Fragen, die ein seriöses Angebot schriftlich beantwortet. Bleibt eine Antwort aus, ist auch das eine Antwort.",
      kopf: ["Frage an den Anbieter", "Seriöse Antwort", "Warnsignal"],
      zeilen: [
        ["Wer ist Ihr Vertragspartner?", "Name, Rechtsform, Register und Anschrift stehen im Vertrag", "nur eine Marke, ein Kanal im Messenger, kein Rechtsträger"],
        ["Was kostet es, vollständig?", "Festpreis vorab, alle Gebühren genannt", "Honorar in Prozent des Rahmens, Gebühren im Kleingedruckten"],
        ["Wer entscheidet über Kredit und Rahmen?", "allein das Institut", "„sichere Rahmen dank Kontakten zu Banken“"],
        ["Werden Zinsen versprochen?", "nein — die Bedingungen legt jeder Herausgeber selbst fest", "„zinsfrei“ über lange Zeit, feste Zinssätze"],
        ["Wer stellt Konto-, Karten- und Kreditanträge?", "Sie selbst, mit vollständig vorbereiteten Unterlagen", "der Anbieter, per Vollmacht, in Ihrem Namen"],
        ["Wie viele Anträge, in welchem Abstand?", "geplante Reihenfolge, Anträge mit Abstand", "viele Anträge an einem Tag"],
        ["Was geschieht mit Ihrer Bonität?", "harte Anfragen und neue Konten werden offen erklärt", "„Ihr Score leidet nicht“"],
        ["Wer haftet für die Karten?", "die persönliche Haftung des Inhabers wird benannt", "kein Wort dazu"],
        ["Was ist mit Steuern?", "Steuerpflicht zu Hause, Prüfung durch einen Steuerberater vor der Gründung", "„steuerfrei“ oder „ohne Finanzamt“"],
        ["Dürfen Sie das Angebot bewerten?", "ja, ohne Einschränkung", "Klauseln gegen negative Bewertungen"],
      ],
      fuss: ["Die Fragen greifen auf, was das Gericht im Fall FTC v. Seek Capital beanstandet hat, und die Pflichthinweise von FIAON Global."],
    },
    {
      typ: "text", id: "recht", h2: "Drei Rechtsregeln, die jedes Funding-Angebot berühren",
      absaetze: [
        "In Deutschland braucht eine Erlaubnis der Behörde, wer gewerbsmäßig den Abschluss von Darlehensverträgen vermittelt (§ 34c Abs. 1 Satz 1 Nr. 2 GewO). FIAON Global vermittelt keine Kredite und erhält kein Honorar nach Rahmen; wir bauen die Grundlage, auf der Institute entscheiden.",
        "In den USA sind wissentlich falsche Angaben strafbar, die eine Entscheidung über Kredit bei einer Bank mit US-Einlagensicherung oder bei der SBA beeinflussen sollen (18 U.S.C. § 1014). Ein erfundener Umsatz, eine geschönte Geschäftsbeschreibung, ein falscher Verwendungszweck: Was ein Anbieter „optimiert“, unterschreiben Sie.",
        "Und für Firmenkarten gilt der US-Verbraucherschutz nur eingeschränkt. Kredit für geschäftliche Zwecke ist von den meisten Regeln der Regulation Z ausgenommen (12 CFR 1026.3); es zählt vor allem der Vertrag des Herausgebers.",
        "Wie diese Regeln in Ihrem Fall wirken, klären die Partner-Anwälte und Partner-Steuerberater in Ihrem Mandat — FIAON ist keine Kanzlei.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global den Weg zu US Funding",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für Unternehmer aus Deutschland, Österreich und der Schweiz, die eine US-Gesellschaft aufbauen. Unser Grundsatz: ein Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir alle Anträge für Sie — Gründung im Bundesstaat, EIN, die Vorbereitung der ITIN, D-U-N-S-Nummer und die erste jährliche US-Meldung — und stellen Registered Agent, US-Adresse und US-Telefonnummer für das erste Jahr. Konto-, Karten- und Kreditanträge stellen Sie selbst; wir bereiten jeden davon vollständig vor.",
        "So begleiten wir den Weg zu US Funding in der richtigen Reihenfolge: zuerst die Struktur, dann der Aufbau der Bonität auf beiden Ebenen, dann vollständig vorbereitete Anträge, die Sie selbst stellen, und die Kennzahlen-Mappe für ein späteres Bankdarlehen. Über jeden Antrag entscheidet das Institut. Der Kapitalrahmen Ihres Pakets ist ein Ziel, auf das wir gemeinsam hinarbeiten, keine Zusage.",
        GLOBAL_ROLLEN.de.partner,
        "Sie zahlen einen Festpreis, der vor dem Auftrag feststeht, mit allen Gebühren des Pakets — ohne Honorar nach Rahmen und ohne Anteil am Kapital. Vertragspartner ist die FIAON LTD in London; unser Team vor Ort in Miami übernimmt Termine und Einreichungen, Zürich ist unser Partnerstandort. Ab dem zweiten Jahr können Sie die Jahresbetreuung wählen — freiwillig und ohne automatische Verlängerung.",
        `${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "karten", id: "vertiefen", h2: "Jede Ebene im Einzelnen", spalten: 3,
      karten: [
        { tag: "Leistung", titel: "Firmenkarten und Kapitalaufbau", text: "Die Kartenleiter von FIAON Global und der Kapitalrahmen je Paket als Ziel.", pfad: "/business/firmenkarten-kapital" },
        { tag: "Ebene 1", titel: "US-Bonität aufbauen", text: "Wie der FICO Score entsteht und was ein erster Score braucht.", pfad: "/business/wissen/us-bonitaet-aufbauen" },
        { tag: "Ebene 1", titel: "ITIN beantragen", text: "Form W-7 aus dem Ausland, Unterlagen und Bearbeitungsdauer.", pfad: "/business/wissen/itin-beantragen" },
        { tag: "Ebene 2", titel: "Business Credit", text: "D-U-N-S-Nummer, PAYDEX und Lieferantenkonten.", pfad: "/business/wissen/business-credit-usa" },
        { tag: "Karten", titel: "US-Firmenkarte beantragen", text: "Prüfung, persönliche Haftung, Einführungszeitraum.", pfad: "/business/wissen/us-firmenkarte-beantragen" },
        { tag: "Ebene 3", titel: "Finanzierungswege", text: "Sechs Wege einer US-Gesellschaft nach Tempo und Grundlage.", pfad: "/business/wissen/finanzierungswege-usa" },
        { tag: "SBA", titel: "SBA-Kredit als Ausländer", text: "Die Regel seit dem 1. März 2026 und die Wege, die bleiben.", pfad: "/business/wissen/sba-kredit-auslaender" },
        { tag: "Vorsicht", titel: "Kreditkarten-Stacking", text: "Was hinter dem Versprechen gestapelter Karten steckt.", pfad: "/business/wissen/kreditkarten-stacking" },
        { tag: "Prüfliste", titel: "Anbieter prüfen", text: "Woran Sie einen seriösen LLC-Anbieter erkennen.", pfad: "/business/wissen/anbieter-pruefen" },
      ],
    },
    { typ: "paket", id: "paket", h2: "Der ganze Weg im Paket", lead: "Struktur, Begleitung über mehrere Herausgeber, vorbereitete Anträge und die Kennzahlen-Mappe für ein späteres Bankdarlehen — Global Kapital.", paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut.",
        "Der Kapitalrahmen eines Pakets ist ein Ziel, keine Zusage. Einen bestimmten Rahmen, Score oder Zins kann niemand zusagen.",
        "Jeder Kartenantrag hinterlässt in der Regel eine Anfrage in Ihrer Akte; neue Konten senken das Durchschnittsalter Ihrer Historie.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Was ist US Funding?", a: "Im deutschsprachigen Markt der Aufbau von Kapital über eine eigene US-Gesellschaft: Firmenkarten, Business Credit, eine Bankbeziehung mit Sicherheiten und Eigenkapital. Es beruht auf drei Ebenen — persönliche US-Bonität, Bonität der Firma, Sicherheiten — und wächst über Monate und Jahre. Über jeden Kredit entscheidet das Institut." },
    { f: "Ist US Funding seriös?", a: "Der Weg selbst ist legal und üblich. Unseriös sind Programme, die Rahmen oder Zinsen versprechen, Gebühren in Prozent der Kartenrahmen verlangen, Beziehungen zu Kreditgebern behaupten oder „steuerfrei“ verkaufen. Die US-Handelsaufsicht FTC hat einem solchen Anbieter 2025 das Geschäft dauerhaft untersagen lassen." },
    { f: "Bekommt meine US-LLC einen SBA-Kredit, wenn ich in Europa wohne?", a: "Nein. Seit dem 1. März 2026 müssen alle direkten und indirekten Eigentümer US-Staatsbürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626). Auch eine Green Card genügt nicht, und eine GmbH oder AG als Gesellschafterin schließt den Kredit ebenfalls aus." },
    { f: "Wie viel Kapital bringt eine US Funding LLC?", a: "Eine feste Höhe kann niemand nennen. Die Gesellschaft ist das Gefäß; Kapital entsteht, wenn Institute auf Grundlage von Historie, Umsatz oder Sicherheiten zusagen. Karten tragen meist kleinere Rahmen, größere Mittel brauchen Umsatz, Geschichte oder eine Sicherheit." },
    { f: "Bekommt man als Ausländer einen US-Firmenkredit?", a: "SBA-Kredite sind seit dem 1. März 2026 ausgeschlossen. Offen bleiben Wege, die nicht an die Staatsangehörigkeit geknüpft sind: Firmenkarten mit persönlicher Haftung, Lieferantenkredit aus Business Credit, Kreditlinien gegen Einlage, Bürgschaft einer Muttergesellschaft oder Vermögen. Ob und zu welchen Bedingungen, entscheidet allein das jeweilige Institut nach seinen eigenen Regeln." },
    { f: "Wie lange dauert es, bis US Funding trägt?", a: "Gesellschaft und EIN stehen meist nach wenigen Wochen. Einen FICO Score kann es frühestens nach sechs Monaten mit gemeldetem Konto geben, eine belastbare Firmenbonität wächst über Jahre. Kreditlinien der Bank setzen meist Geschäftsjahre, Umsatz oder eine Sicherheit voraus. Wer Kapital in wenigen Wochen in Aussicht stellt, verspricht, was nur Institute entscheiden." },
    { f: "Beschafft FIAON Global das Kapital?", a: "Nein. FIAON ist keine Bank, vergibt keine Kredite und vermittelt keine Kredite. Als Unternehmensberatung stellen wir mit Ihrer Vollmacht alle Anträge rund um Ihre Gesellschaft und bereiten jeden Konto-, Karten- und Kreditantrag vollständig vor; diese stellen Sie selbst, und das Institut entscheidet. Der Kapitalrahmen Ihres Pakets ist ein Ziel, keine Zusage." },
    { f: GLOBAL_KAPITAL_FREI.de.frage, a: GLOBAL_KAPITAL_FREI.de.antwort },
  ],
  paket: "global_kapital",
  weiter: ["/business/wissen/finanzierungswege-usa", "/business/wissen/sba-kredit-auslaender", "/business/wissen/kreditkarten-stacking", "/business/firmenkarten-kapital"],
  quellen: [
    Q.ftcSeek,
    Q.ftcSeekUrteil,
    QUELLEN.sbaNotice,
    QUELLEN.eo14406,
    Q.ftcAuskunft,
    Q.ficoMindest,
    Q.ficoFaktoren,
    Q.itinUebersicht,
    Q.itin,
    Q.ss4,
    Q.duns,
    Q.paydex,
    QUELLEN.paydexRisiko,
    Q.experian,
    Q.regZ3,
    QUELLEN.usc1014,
    QUELLEN.gewo34c,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    Q.ao138,
  ],
};
