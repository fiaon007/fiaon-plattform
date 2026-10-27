// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: SBA-KREDIT ALS AUSLÄNDER (27.10.2026, E-439)
//
// Pfeiler zur SBA-Regel seit 01.03.2026, aus Sicht eines Eigentümers aus
// Deutschland, Österreich oder der Schweiz — und die Kapitalwege, die bleiben.
// Geprüft am 27.10.2026 an den Primärtexten:
//   · SBA Procedural Notice 5000-876626 (Volltext, 5 Seiten, veröffentlicht
//     11.02.2026, gültig ab 01.03.2026): Abschnitt F „Citizenship and Residency
//     Requirements“, Anhang 3 „Ineligible Person“ (Nr. 1–8), „Principal Residence“
//     nach IRS Publication 523, Übergang (R1-Status bis 28.02.2026, 23:59 Uhr
//     Ostküstenzeit), Sechs-Monats-Rückblick, begrenzte Zusatzbürgschaft,
//     Ehepartner und minderjährige Kinder zusammengerechnet.
//   · SBA Policy Notice 5000-876441 (02.02.2026; hebt Procedural Notice
//     5000-872050 vom 19.12.2025 mit der Fünf-Prozent-Ausnahme auf).
//   · GAO B-338157 (01.07.2026, Volltext): Notices sind eine Regel im Sinne des
//     Congressional Review Act; SBA hat keinen Bericht vorgelegt. Dort auch:
//     SOP 50 10 8 vom 01.06.2025, Info Notice 5000-877673 (31.03.2026, keine
//     Erhöhung bestehender Kredite), rund 45 Mrd. $ an 7(a)/504 im FJ 2025,
//     verbürgter Anteil 85 %/75 %, 504: CDC-Anteil höchstens 40 %.
//   · sba.gov 7(a) (Höchstbetrag 5 Mio. $) und 504 (Verwendung, Aufbau).
//   · Prüfung 27.10.2026 (Fachprüfer): SBA Information Notice 5000-880695
//     (14.08.2026) — SOP 50 10 8.1 gilt seit 01.10.2026 für jede Kreditnummer ab
//     diesem Tag und übernimmt beide Notices. SOP 50 10 8.1 (Word-Datei der SBA)
//     selbst gelesen: Absatz F und Anhang 3 wortgleich mit 5000-876626 (E-Tran
//     heißt dort „SBA Loan System“); 504-Grenze: Debenture höchstens 5 Mio. $ je
//     Unternehmen, 5,5 Mio. $ je Projekt für Hersteller und Energieprojekte.
//   · 18 U.S.C. § 1014 nennt die SBA nur zum Small Business Investment Act →
//     auf „Institute mit FDIC-Einlagensicherung“ begrenzt.
// Stand 27.10.2026: keine Aufhebung und kein Beschluss des Kongresses gefunden.
// Nicht belegt und deshalb weggelassen: ältere 51-Prozent-Fassungen, Zahlen zu
// Bankkrediten ohne SBA, Förderprogramme europäischer Förderbanken, der Inhalt
// der Info Notice 5000-877673 im Original (PDF-Link der SBA liefert 404; Inhalt
// nach dem Zitat in GAO B-338157, Seite 8).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { IRS, QUELLEN_WISSEN as Q } from "../fakten";

const S = "2026-10-27";
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

/** Quellen dieses Beitrags (Stand 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  policy: { titel: "SBA Policy Notice 5000-876441 — Citizenship and Residency Requirements (veröffentlicht 02.02.2026, gültig ab 01.03.2026)", url: "https://www.sba.gov/document/policy-notice-5000-876441-update-sop-50-10-8-citizenship-residency-requirements-recission-procedural-notice-5000-872050" },
  procedural: { titel: "SBA Procedural Notice 5000-876626 — Revised Applicant Ownership, Citizenship, and Residency Requirements for 7(a) and 504 Loans (11.02.2026)", url: "https://www.sba.gov/document/procedural-notice-5000-876626-revised-applicant-ownership-citizenship-residency-requirements-7a-504-loans" },
  proceduralText: { titel: "SBA Procedural Notice 5000-876626 — Volltext (PDF der SBA)", url: "https://legacy.sba.gov/sites/default/files/2026-02/Procedural%20Notice%205000-876626%20-%20Revised%20Applicant%20Ownership%20Citizenship%20and%20Residency%20%20OFA%202.11.pdf" },
  sop81: { titel: "SBA Information Notice 5000-880695 — Issuance of SOP 50 10 8.1 (veröffentlicht 14.08.2026, gültig ab 01.10.2026)", url: "https://www.sba.gov/document/information-notice-5000-880695-issuance-sop-50-10-81" },
  sop: { titel: "SBA SOP 50 10 — Lender and Development Company Loan Programs (Fassung 8.1, gültig ab 01.10.2026)", url: "https://www.sba.gov/document/sop-50-10-lender-development-company-loan-programs" },
  fuenfProzent: { titel: "SBA Procedural Notice 5000-872050 — Fünf-Prozent-Ausnahme (19.12.2025, aufgehoben)", url: "https://www.sba.gov/document/procedural-notice-5000-872050-procedural-notice-5000-872050-update-sop-50-10-8-citizenship-residency-requirements" },
  gao: { titel: "GAO B-338157 — Applicability of the Congressional Review Act to SBA Notices (01.07.2026)", url: "https://www.gao.gov/products/b-338157" },
  gaoText: { titel: "GAO B-338157 — Entscheidung im Volltext (PDF)", url: "https://www.gao.gov/assets/890/886932.pdf" },
  sba7a: { titel: "U.S. Small Business Administration — 7(a) Loans", url: "https://www.sba.gov/loans/7a-loans/" },
  sba504: { titel: "U.S. Small Business Administration — 504 Loans", url: "https://www.sba.gov/loans/504-loans/" },
  p523: { titel: "IRS Publication 523 — Selling Your Home (Main Home)", url: "https://www.irs.gov/publications/p523" },
  usc1014: { titel: "18 U.S. Code § 1014 — False statements in loan and credit applications", url: "https://www.law.cornell.edu/uscode/text/18/1014" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/sba-kredit-auslaender",
  art: "wissen",
  seo: {
    titel: "SBA-Kredit als Ausländer: was seit 2026 gilt — FIAON Global",
    beschreibung: "SBA-Kredit als Ausländer: Seit 1. März 2026 gibt es 7(a) und 504 nur für US-Eigentümer mit US-Wohnsitz. Was gilt und welche Kapitalwege bleiben.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 44",
  auge: "Wissen · Kapital",
  h1: "SBA-Kredit als Ausländer.",
  h1b: "Diese Tür ist zu. Andere Wege bleiben.",
  lead: "Seit dem 1. März 2026 gibt es Kredite aus den Programmen 7(a) und 504 der US-Mittelstandsbehörde SBA nur noch für Gesellschaften, deren Eigentümer ausnahmslos US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind. Auch Inhaber einer Green Card sind ausgeschlossen. Hier steht, was die Regel genau sagt, was sie für Unternehmer aus Deutschland, Österreich und der Schweiz bedeutet und welche Kapitalwege einer US-Gesellschaft offen bleiben.",
  ziffern: [
    { wert: "1. März 2026", label: "seitdem gilt die verschärfte SBA-Regel" },
    { wert: "100 %", label: "der Eigentümer: US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA" },
    { wert: "rund 45 Mrd. $", label: "SBA-verbürgte 7(a)- und 504-Kredite im Fiskaljahr 2025" },
  ],
  blick: [
    ["Gilt seit", "1. März 2026 (Procedural Notice 5000-876626), seit 1. Oktober 2026 Teil der SOP 50 10 8.1"],
    ["Betrifft", "Alle Spielarten von 7(a) sowie 504"],
    ["Zugelassen", "Nur US-Bürger und US-Staatsangehörige mit Hauptwohnsitz in den USA"],
    ["Ausgeschlossen", "Wohnsitz im Ausland, Green Card, Visum, ausländische Muttergesellschaft"],
    ["Was bleibt", "Firmenbonität, Firmenkarten, Bank mit Sicherheiten, Eigenkapital, Hausbank"],
    ["Wer entscheidet", "Über jeden Kredit allein das Institut"],
    ["Mit FIAON Global", "Ein Ansprechpartner, jeder Antrag vorbereitet, Festpreis"],
  ],
  kurz: "Nein — wer in Deutschland, Österreich oder der Schweiz lebt, bekommt für seine US-Gesellschaft keinen SBA-Kredit. Seit dem 1. März 2026 müssen 100 Prozent der direkten und indirekten Eigentümer US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626, seit 1. Oktober 2026 Teil der SOP 50 10 8.1); Green Card, Visum, Wohnsitz im Ausland oder eine ausländische Muttergesellschaft schließen 7(a) und 504 aus. Offen bleiben Firmenbonität und Firmenkarten, ein Bankkredit gegen Sicherheiten, Eigenkapital und die Hausbank in Europa — über jeden Kredit entscheidet das Institut.",
  bloecke: [
    {
      typ: "text", id: "regel", h2: "SBA-Kredit als Ausländer: die Regel seit dem 1. März 2026",
      absaetze: [
        "In den Programmen 7(a) und 504 vergibt die Small Business Administration (SBA) die Kredite nicht selbst. Sie sichert Kredite ab, die Banken und andere zugelassene Kreditgeber an kleine und mittlere Unternehmen vergeben: Fällt der Kredit aus, teilen sich Kreditgeber und SBA den Verlust nach dem Anteil, den die SBA verbürgt hat. Welche Unternehmen in diese Programme dürfen, steht in ihrer Verfahrensordnung SOP 50 10. Seit dem 1. Oktober 2026 gilt die Fassung 8.1 für jeden Antrag, der ab diesem Tag eine SBA-Kreditnummer erhält.",
        "Am 2. Februar 2026 hat die SBA mit der Policy Notice 5000-876441 die Eigentümerregel verschärft, am 11. Februar 2026 hat sie die Änderung mit der Procedural Notice 5000-876626 in die Verfahrensordnung übernommen. Seit dem 1. März 2026 lautet der Kernsatz sinngemäß: SBA-Finanzierung gibt es nur für Antragsteller, deren direkte und indirekte Eigentümer zu 100 Prozent — und deren von der SBA verlangte Bürgen — US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA, ihren Territorien oder Besitzungen sind. Die neue Fassung SOP 50 10 8.1 enthält diesen Satz im selben Wortlaut.",
        "Zwei Zusätze machen die Regel für Unternehmer aus dem deutschsprachigen Raum endgültig: Jede Gesellschaft, die direkt oder indirekt beteiligt ist, muss in den USA gegründet sein. Und den Hauptwohnsitz bestimmt die SBA nach der IRS Publication 523: Jeder Mensch hat nur einen Hauptwohnsitz. Wer mehrere Wohnungen hat, für den zählt vor allem, wo er die meiste Zeit verbringt; daneben zählen die Anschrift bei Post, Wahlregister, Steuererklärungen und Führerschein sowie die Nähe zu Arbeitsplatz, Bank und Familie.",
      ],
      punkte: [
        "Der Kreditgeber muss im System der SBA alle direkten und indirekten Eigentümer erfassen und nach bestem Wissen bestätigen, dass weder einer von ihnen noch einer der verlangten Bürgen ausgeschlossen ist.",
        "Auch der Antragsteller bestätigt mit seiner Unterschrift, dass keiner seiner direkten oder indirekten Eigentümer und Bürgen ausgeschlossen ist.",
        "Anteile von Ehepartnern und minderjährigen Kindern werden zusammengerechnet.",
        "Wer in den sechs Monaten vor der Vergabe der SBA-Kreditnummer beteiligt war und nicht berechtigt ist, macht die Gesellschaft unzulässig — es sei denn, er hat seinen Anteil vorher vollständig abgegeben.",
      ],
    },
    {
      typ: "tabelle", id: "wer", h2: "Wer seit März 2026 Eigentümer sein darf — und wer nicht",
      lead: "Die Verfahrensordnung zählt in Anhang 3 auf, wer als „Ineligible Person“ gilt — ausdrücklich nicht abschließend. Für Eigentümer aus Deutschland, Österreich und der Schweiz sind fünf dieser Gruppen entscheidend.",
      kopf: ["Eigentümer", "SBA-Kredit möglich?", "Fundstelle in der SOP 50 10 8.1"],
      zeilen: [
        ["US-Bürger mit Hauptwohnsitz in den USA", "ja", "Absatz F, Ziffer 1"],
        ["Eingebürgerte US-Bürger mit Hauptwohnsitz in den USA", "ja, ohne zusätzliche Prüfung", "Absatz F, Ziffer 3"],
        ["US-Staatsangehörige ohne Bürgerrecht (U.S. Nationals) mit Hauptwohnsitz in den USA", "ja, der Status wird belegt", "Absatz F, Ziffer 2"],
        ["Deutsche, Österreicher und Schweizer ohne US-Staatsbürgerschaft", "nein", "Anhang 3, Ziffer 3"],
        ["US-Bürger mit Hauptwohnsitz in Deutschland, Österreich oder der Schweiz", "nein", "Anhang 3, Ziffer 4"],
        ["Inhaber einer Green Card, auch mit bedingtem Status", "nein", "Anhang 3, Ziffer 7"],
        ["Inhaber eines Visums, etwa des E-2-Visums", "nein", "Anhang 3, Ziffer 2"],
        ["GmbH, AG oder andere im Ausland gegründete Gesellschaft als Gesellschafterin", "nein", "Anhang 3, Ziffer 5"],
      ],
      hervor: 1,
      fuss: [
        "Quelle: SBA SOP 50 10 8.1 (gültig seit 01.10.2026), Abschnitt A, Kapitel 1, Absatz F und Anhang 3 — gleichlautend mit der Procedural Notice 5000-876626 vom 11.02.2026. US-Staatsangehörige ohne Bürgerrecht sind Personen, die etwa in Amerikanisch-Samoa geboren sind.",
        "Eine Ausnahme betrifft nur Bürgen: Verlangt der Kreditgeber eine begrenzte Zusatzbürgschaft, darf sie auch eine ausgeschlossene Person stellen. Eigentümer darf diese Person nicht sein.",
      ],
    },
    {
      typ: "text", id: "programme", h2: "Was das für 7(a) und 504 heißt",
      absaetze: [
        "Das Programm 7(a) ist der Hauptweg der SBA für Unternehmenskredite. Ein Kreditgeber vergibt den Kredit, die SBA sichert einen Teil ab: bei den meisten Spielarten höchstens 85 Prozent bei Krediten von höchstens 150.000 $ und höchstens 75 Prozent darüber. Der Höchstbetrag eines 7(a)-Kredits liegt bei 5 Mio. $. Finanziert werden Betriebsmittel, Maschinen und Ausstattung, Immobilien, die Ablösung bestehender Schulden und der Kauf eines Unternehmens. Die Notice ändert ausdrücklich auch die Antragsunterlagen der Spielarten 7(a) Small, SBA Express, CAPLines, Export Express, Export Working Capital und International Trade — die Eigentümerregel gilt für alle.",
        "Das Programm 504 finanziert langfristig große Anlagegüter: Grundstücke, Gebäude und Maschinen mit einer Restnutzungsdauer von mindestens zehn Jahren. Ein privater Kreditgeber, eine Certified Development Company (CDC) und der Unternehmer selbst teilen sich die Finanzierung; der Anteil der CDC liegt bei höchstens 40 Prozent, und diesen Anteil sichert die SBA vollständig ab. Er ist auf 5 Mio. $ je Unternehmen begrenzt, für Hersteller und bestimmte Energieprojekte auf 5,5 Mio. $ je Projekt. Für 504 gilt dieselbe Eigentümerregel wie für 7(a).",
        "Welches Gewicht beide Programme haben, zeigt eine Zahl aus der Entscheidung des US-Rechnungshofs GAO: Im Fiskaljahr 2025 hat die SBA 7(a)- und 504-Kredite über rund 45 Mrd. $ an mehr als 85.000 kleine Unternehmen abgesichert. Kredite, die vor dem 1. März 2026 genehmigt wurden, dürfen weiter betreut werden; erhöht werden dürfen sie nach einem Hinweis der SBA vom 31. März 2026 nicht, wenn die Gesellschaft die neue Regel nicht erfüllt.",
      ],
    },
    {
      typ: "etappen", id: "verlauf", h2: "Wie es zu der Regel kam",
      lead: "Für Eigentümer, die in Europa leben, war der SBA-Kredit schon vor 2026 kaum erreichbar. Die neue Regel hat auch die letzten Ausnahmen geschlossen.",
      etappen: [
        { titel: "Verfahrensordnung SOP 50 10 8", dauer: "1. Juni 2025", text: "Alle Eigentümer müssen US-Bürger, US-Staatsangehörige oder Inhaber einer Green Card sein, mit Hauptwohnsitz in den USA. Wer in Deutschland, Österreich oder der Schweiz lebt, ist damit schon ausgeschlossen." },
        { titel: "Fünf-Prozent-Ausnahme", dauer: "19. Dezember 2025", text: "Die Procedural Notice 5000-872050 erlaubt Ausländern mit Wohnsitz außerhalb der USA, US-Bürgern und Green-Card-Inhabern mit Hauptwohnsitz im Ausland sowie Inhabern einer bedingten Green Card zusammen höchstens fünf Prozent der Anteile — für Kredite, die die SBA ab dem 1. Januar 2026 genehmigt." },
        { titel: "Policy Notice 5000-876441", dauer: "2. Februar 2026", text: "Die SBA kündigt an: Ab dem 1. März 2026 entfällt die Fünf-Prozent-Ausnahme, und Inhaber einer Green Card dürfen keinen Anteil mehr halten." },
        { titel: "Procedural Notice 5000-876626", dauer: "11. Februar 2026", text: "Die Änderung wird Teil der Verfahrensordnung. Anträge im nicht delegierten Verfahren mit Green-Card-Eigentümern, die bis zum 28. Februar 2026, 23:59 Uhr Ostküstenzeit, den Prüfstatus R1 im System der SBA erreicht hatten, bearbeitet die SBA noch." },
        { titel: "Die Regel gilt", dauer: "1. März 2026", text: "Im delegierten Verfahren zählt die Vergabe der SBA-Kreditnummer ab diesem Tag, im nicht delegierten Verfahren der Tag, an dem der Antrag im System der SBA den Status R1 erreicht. Seitdem sind nur noch Gesellschaften mit 100 Prozent US-Eigentum zugelassen." },
        { titel: "Entscheidung des US-Rechnungshofs", dauer: "1. Juli 2026", text: "Die GAO stellt in B-338157 fest: Beide Notices sind eine Regel im Sinne des Congressional Review Act und hätten vor ihrem Inkrafttreten dem Kongress und dem Leiter der GAO vorgelegt werden müssen. Die SBA hatte keinen solchen Bericht vorgelegt und auf die Anfrage der GAO inhaltlich nicht geantwortet." },
        { titel: "Neue Fassung SOP 50 10 8.1", dauer: "1. Oktober 2026", text: "Die SBA übernimmt beide Notices in die neue Fassung ihrer Verfahrensordnung. Sie gilt für jeden Antrag, der ab diesem Tag eine SBA-Kreditnummer erhält; die Eigentümerregel steht dort im selben Wortlaut." },
        { titel: "Heute", dauer: "Stand 27. Oktober 2026", text: "Die Regel wird angewendet. Eine Aufhebung durch die SBA oder einen Beschluss des Kongresses haben wir nicht gefunden." },
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Kapital für Ihre US-LLC: die Wege, die bleiben", spalten: 3,
      lead: "Ein US-Kredit für eine Firma in ausländischem Besitz ist damit nicht ausgeschlossen — er läuft nur nicht mehr über die SBA. Jeder Weg beruht auf etwas anderem, und über jeden entscheidet das Institut.",
      karten: [
        { tag: "Firmenbonität", titel: "Business Credit aufbauen", text: "D-U-N-S-Nummer bei der Wirtschaftsauskunftei, erste Lieferantenkonten mit Zahlungsziel, früh bezahlt: Daraus entsteht ein eigenes Kreditprofil der Gesellschaft, das Kreditgeber prüfen können.", pfad: "/business/wissen/business-credit-usa" },
        { tag: "Firmenkarten", titel: "Karten nach Guthaben und Historie", text: "Manche Firmenkarten richten den Rahmen am Kontostand der Gesellschaft aus. In der Regel verlangen sie die persönliche Haftung des Inhabers; die Bedingungen legt jeder Herausgeber selbst fest.", pfad: "/business/wissen/us-firmenkarte-beantragen" },
        { tag: "Bank", titel: "Kredit gegen Sicherheiten", text: "Ohne SBA trägt die Bank das Ausfallrisiko allein. Sie sieht dann auf Geschäftsjahre, Umsatz und Sicherheiten: eine Einlage, eine Bürgschaft der Muttergesellschaft oder eine Immobilie.", pfad: "/business/wissen/finanzierungswege-usa" },
        { tag: "Eigenkapital", titel: "Einlage oder Gesellschafterdarlehen", text: "Sie oder Ihre Muttergesellschaft statten die US-Gesellschaft selbst aus. Gehört die LLC allein einem ausländischen Eigentümer, meldet sie jede Einlage und jedes Darlehen mit der jährlichen Form 5472.", pfad: "/business/tochtergesellschaft-usa" },
        { tag: "Europa", titel: "Die Hausbank zu Hause", text: "Ihre Bank in Deutschland, Österreich oder der Schweiz kennt Ihre Zahlen seit Jahren. Ein Kredit an Sie oder Ihre GmbH kann als Kapital in die US-Gesellschaft fließen." },
        { tag: "Objekt", titel: "Immobilie finanzieren", text: "Für Mietobjekte gibt es Finanzierungen, die vor allem prüfen, ob die Miete die Rate deckt — mit Eigenkapital und Reserven aus eigenen Mitteln.", pfad: "/business/wissen/us-immobilie-finanzieren" },
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Mit SBA und ohne SBA: was sich für die Bank ändert",
      lead: "Der SBA-Kredit war für viele Banken attraktiv, weil die Behörde einen Teil des Risikos trägt. Fällt dieser Teil weg, ändert sich nicht die Frage der Bank, sondern ihr Maßstab.",
      kopf: ["", "SBA-Kredit (7(a) oder 504)", "Bankkredit ohne SBA"],
      zeilen: [
        ["Wer trägt das Ausfallrisiko", "Kreditgeber und SBA, nach den Regeln des Programms", "die Bank allein"],
        ["Eigentümer", "nur US-Bürger und US-Staatsangehörige mit Hauptwohnsitz in den USA", "legt jede Bank selbst fest"],
        ["Was geprüft wird", "Regeln der SBA und die eigene Prüfung der Bank", "die eigene Prüfung: Geschäftsjahre, Umsatz, Sicherheiten"],
        ["Höchstbetrag", "7(a): 5 Mio. $; 504: Anteil der CDC 5 Mio. $ je Unternehmen", "legt jede Bank selbst fest"],
        ["Für Eigentümer mit Wohnsitz in Europa", "ausgeschlossen", "möglich, wenn die Bank zustimmt"],
      ],
      hervor: 2,
      fuss: ["Allgemeine Übersicht, Stand Oktober 2026. Bedingungen, Höhe und Sicherheiten legt jedes Institut selbst fest."],
    },
    {
      typ: "text", id: "europa", h2: "Eigenkapital und Hausbank: der Weg über Europa",
      absaetze: [
        "Für viele Unternehmer aus dem deutschsprachigen Raum liegt das stärkste Kapital nicht in den USA, sondern zu Hause: in der eigenen GmbH, in Rücklagen, in einer Bankbeziehung über viele Jahre. Die US-Gesellschaft lässt sich aus diesen Mitteln ausstatten — als Einlage, die das Eigenkapital erhöht, oder als Darlehen der Gesellschafterin an ihre Tochter.",
        `Beides hat Folgen, die vorher geklärt sein müssen. In Deutschland gilt für ein Darlehen zwischen Ihnen oder Ihrer GmbH und der US-Gesellschaft der Fremdvergleich: Mindern Bedingungen, die unabhängige Dritte so nicht vereinbart hätten, Ihre Einkünfte, werden diese steuerlich so angesetzt wie unter Dritten (§ 1 AStG). In den USA meldet eine LLC, die allein einem ausländischen Eigentümer gehört, jede Einlage, jede Ausschüttung und jedes Darlehen im Verhältnis zu diesem Eigentümer mit Form 5472; wer das versäumt, riskiert eine Strafe von ${IRS.strafe5472}.`,
        KAPITAL_FREI,
      ],
    },
    {
      typ: "text", id: "vorsicht", h2: "Vorsicht, wenn „Funding“ den SBA-Kredit ersetzen soll",
      absaetze: [
        "Wo ein offizieller Weg schließt, wachsen Angebote, die schnelles Kapital ohne Prüfung versprechen — oft mit Beispielrahmen in Dollar und gestapelten Kreditkarten. Die US-Handelsaufsicht FTC hat am 17. November 2025 bekannt gemacht, dass der Anbieter Seek Capital und sein Geschäftsführer zur Beilegung ihrer Vorwürfe dauerhaft aus dem Geschäft mit Unternehmensfinanzierung verbannt sind. Nach Darstellung der FTC hatte das Unternehmen mit besonderen Beziehungen zu Kreditgebern und günstigen Konditionen geworben, Unternehmern dann aber Tausende Dollar allein dafür berechnet, Kreditkarten zu eröffnen; das kostete die Betroffenen Millionen und schadete ihrer Kreditwürdigkeit.",
        "Der Maßstab daraus gilt für jeden Anbieter, auch für uns: Gebühren vorher nennen, keine Beziehung zu Kreditgebern behaupten, die es nicht gibt, keinen Rahmen zusagen und offen erklären, wie jeder Antrag auf die Kreditakte wirkt.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global Ihren Weg zum Kapital",
      absaetze: [
        "Am Anfang steht eine ehrliche Bestandsaufnahme: Wir legen Ihre Eigentümerstruktur neben die veröffentlichten Regeln der SBA und halten schriftlich fest, auf welchen Wegen wir Ihren Kapitalaufbau planen. Für Eigentümer, die in Deutschland, Österreich oder der Schweiz leben, heißt das heute: kein SBA-Kredit — und deshalb von Anfang an der Aufbau auf den Wegen, die bleiben. Bleibt im Einzelfall eine Rechtsfrage offen, klären sie unsere Partner-Anwälte in Ihrem Mandat.",
        "Danach gilt: ein Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir alle Anträge für Sie — Gründung der Gesellschaft, EIN, die Vorbereitung Ihrer ITIN, die D-U-N-S-Nummer, die laufenden Meldungen. Registered Agent, US-Geschäftsadresse und US-Telefonnummer stellen wir für das erste Jahr. Konto-, Karten- und Kreditanträge stellen Sie selbst, vollständig von uns vorbereitet und in jedem Antrag mit denselben Angaben. Wir planen die Reihenfolge der Institute, stellen die Kennzahlen-Mappe für Ihre Hausbank zusammen und bereiten die Unterlagen vor, die eine Bank für einen Kredit gegen Sicherheiten sehen will. Verlangt ein Institut einen Termin vor Ort, ist unser Team in Miami an Ihrer Seite; im Paket Global Kapital haben Ihre Termine Vorrang.",
        "Ob Einlage oder Gesellschafterdarlehen und wie Ihre Struktur zu Hause steuerlich behandelt wird, klärt unser Partner-Steuerberater mit Ihnen; die jährliche Form 5472 erstellt unser US-CPA, Operating Agreement und Gründungsunterlagen erstellen unsere Partner-Anwälte. Sie alle arbeiten in Ihrem Mandat, ihre Honorare für die Leistungen des Pakets trägt FIAON. Alle Gebühren des Pakets sind im Festpreis enthalten. Unser Team sitzt in Miami, unser Partnerstandort ist Zürich, Ihr Vertragspartner ist die FIAON LTD in London. Ab dem zweiten Jahr können Sie die Jahresbetreuung wählen, sie ist freiwillig.",
        "FIAON Global ist eine Unternehmensberatung für den Weg in die USA, keine Bank: Wir vergeben und vermitteln keine Kredite und sagen keinen Rahmen zu.",
      ],
    },
    { typ: "paket", id: "paket", h2: "Der ganze Weg zum Kapital im Paket", lead: "Gesellschaft, Steuernummern, Firmenbonität, Konto, Firmenkarten Schritt für Schritt und die Unterlagen für ein Bankdarlehen — Global Kapital. Der Kapitalrahmen des Pakets ist Ihr Ziel, keine Zusage.", paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "FIAON ist keine Bank, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das Institut; der Kapitalrahmen eines Pakets ist ein Ziel.",
        "Ob die SBA-Regel Bestand hat, ist politisch offen. Maßgeblich ist die Fassung, die am Tag Ihres Antrags gilt — sie prüft der Kreditgeber.",
        "Eine Eigentümerstruktur nur auf dem Papier, etwa ein US-Bürger als vorgeschobener Inhaber, wäre eine Falschangabe. 18 U.S.C. § 1014 stellt wissentlich falsche Angaben in Kreditanträgen unter Strafe, unter anderem gegenüber Instituten mit FDIC-Einlagensicherung.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Kann ich als Ausländer einen SBA-Kredit bekommen?", a: "Nein, wenn Sie in Deutschland, Österreich oder der Schweiz leben. Seit dem 1. März 2026 müssen alle direkten und indirekten Eigentümer US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein. Das gilt für 7(a) und 504 (SBA Procedural Notice 5000-876626)." },
    { f: "Bekommen Green-Card-Inhaber noch einen SBA-Kredit?", a: "Nein. Seit dem 1. März 2026 dürfen Inhaber einer Green Card, auch mit bedingtem Status, keinen Anteil an einer Gesellschaft halten, die einen 7(a)- oder 504-Kredit beantragt. Nur Anträge im nicht delegierten Verfahren, die bis zum 28. Februar 2026, 23:59 Uhr Ostküstenzeit, den Prüfstatus R1 erreicht hatten, hat die SBA noch bearbeitet." },
    { f: "Ich bin US-Bürger, wohne aber in Deutschland. Geht es dann?", a: "Nein. Auch US-Bürger und US-Staatsangehörige mit Hauptwohnsitz außerhalb der USA gelten als ausgeschlossen. Den Hauptwohnsitz bestimmt die SBA nach der IRS Publication 523: Es zählt die Wohnung, in der Sie die meiste Zeit leben." },
    { f: "Kann meine GmbH für ihre US-Tochter einen SBA-Kredit beantragen?", a: "Nein. Jede Gesellschaft, die direkt oder indirekt an der Antragstellerin beteiligt ist, muss in den USA gegründet sein. Eine GmbH, AG oder Stiftung aus Europa als Gesellschafterin schließt den Antrag aus." },
    { f: "Hilft ein E-2-Visum mit Wohnsitz in Miami?", a: "Für den SBA-Kredit nicht. Visuminhaber zählen ausdrücklich zu den ausgeschlossenen Personen, auch wenn sie in den USA wohnen. Das E-2-Visum kann für Ihre Arbeit in den USA wichtig sein, den SBA-Weg öffnet es nicht. Ob es für Sie in Frage kommt, prüfen Einwanderungsanwälte im Einzelfall." },
    { f: "Reicht es, wenn ein US-Partner die Mehrheit hält?", a: "Nein. Die Regel verlangt 100 Prozent, ein einziger nicht berechtigter Eigentümer genügt für den Ausschluss. In Frage kommt die Gesellschaft erst, wenn diese Person ihren Anteil vor der Vergabe der SBA-Kreditnummer vollständig abgegeben hat. Ein Inhaber nur auf dem Papier wäre eine Falschangabe." },
    { f: "Hat der GAO-Entscheid die Regel aufgehoben?", a: "Nein. Der US-Rechnungshof GAO hat am 1. Juli 2026 festgestellt, dass die Notices eine Regel im Sinne des Congressional Review Act sind und dem Kongress hätten vorgelegt werden müssen. Eine Aufhebung haben wir bis zum 27. Oktober 2026 nicht gefunden. Im Gegenteil: Seit dem 1. Oktober 2026 steht die Regel in der neuen Fassung SOP 50 10 8.1 der Verfahrensordnung." },
    { f: "Welche Finanzierung bleibt meiner US-LLC stattdessen?", a: "Firmenbonität mit D-U-N-S-Nummer und Lieferantenkonten, Firmenkarten, ein Bankkredit gegen Sicherheiten wie Einlage, Bürgschaft der Muttergesellschaft oder Immobilie, Eigenkapital und Kredite Ihrer Hausbank in Europa. Über jeden Kredit entscheidet das Institut; FIAON bereitet den Weg und jeden Antrag vor." },
  ],
  paket: "global_kapital",
  weiter: ["/business/wissen/finanzierungswege-usa", "/business/wissen/business-credit-usa", "/business/wissen/us-funding", "/business/wissen/e2-visum"],
  quellen: [
    QUELLEN.procedural,
    QUELLEN.proceduralText,
    QUELLEN.sop81,
    QUELLEN.sop,
    QUELLEN.policy,
    QUELLEN.fuenfProzent,
    QUELLEN.gao,
    QUELLEN.gaoText,
    QUELLEN.sba7a,
    QUELLEN.sba504,
    QUELLEN.p523,
    Q.i5472,
    Q.astg1,
    Q.ao138,
    Q.duns,
    Q.ftcSeek,
    QUELLEN.usc1014,
  ],
};
