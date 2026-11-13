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
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname, Honorar und Kapitalrahmen aus EIN_PRODUKT.
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): Der eine Abschnitt über uns heißt „Was FIAON Global dabei übernimmt“ und
// kommt aus den festen Sätzen (Schritt 5 in der Fassung „heute“, S7, S8, S9) — shared/fiaon-global-saetze.ts. Die Bürgen des
// SBA-Kredits und die Bürgschaft einer Muttergesellschaft sind Marktwissen; kein Satz sagt, dass FIAON oder eine verbundene
// Gesellschaft bürgt. Nie hier: „bis zur Auszahlung“ (es heißt: bis zur Entscheidung des finanzierenden Instituts), ein Partner
// bei der Arbeit im Präsens, ein Ort der Partner, ein Land im Abschnitt über Konto, Karte und Finanzierung.
// Runde zwei des Sprachleitfadens: jeder sichtbare Text neu gefasst (kurze Sätze, Sachtitel, FIAON nur im Abschnitt „fiaon“
// und im Vermerk „wissen“). Der Kapital-Satz (GLOBAL_KAPITAL_FREI) steht deshalb im Vermerk, nicht mehr im Abschnitt „europa“.
// Kein Satz nennt Österreich oder die Schweiz zusammen mit Konto, Karte oder Finanzierung.
import { GLOBAL_KAPITAL_FREI, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { IRS, QUELLEN_WISSEN as Q } from "../fakten";

/** Tag der Erstveröffentlichung (E-439). */
const S = "2026-10-27";
const P = EIN_PRODUKT.de;
/** Schritt 5 der festen Erzählung (Leitfaden 2.2, Fassung „heute“) — wortgleich aus der einen Quelle. */
const FINANZIERUNG = SECHS_SCHRITTE.de.find((x) => x.nr === 5)!;
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Die ersten zwei Sätze der Rolle (S8): keine Bank, keine Kanzlei; vergibt und vermittelt keine Kredite. */
const ROLLE = satz("S8").split(/(?<=\.)\s+/).slice(0, 2).join(" ");
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
    titel: "SBA-Kredit als Ausländer: die Regel seit 2026 — FIAON Global",
    beschreibung: "SBA-Kredit als Ausländer: Seit 1. März 2026 gibt es 7(a) und 504 nur für US-Eigentümer mit US-Wohnsitz. Regel und Alternativen, mit Quellen und Stand.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 44",
  auge: "Wissen · Finanzierung",
  h1: "SBA-Kredit als Ausländer.",
  h1b: "Seit März 2026 ausgeschlossen. Alternativen bleiben.",
  lead: "Ein SBA-Kredit als Ausländer ist seit dem 1. März 2026 ausgeschlossen. In den Programmen 7(a) und 504 lässt die US-Mittelstandsbehörde SBA nur Gesellschaften zu, deren Eigentümer alle US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sind. Auch Inhaber einer Green Card sind ausgeschlossen. Der Artikel erklärt die Regel, ihre Folgen für Eigentümer mit Wohnsitz in Europa und die Finanzierungswege, die einer US-Gesellschaft bleiben.",
  ziffern: [
    { wert: "1. März 2026", label: "seitdem gilt die verschärfte Eigentümerregel der SBA" },
    { wert: "100 %", label: "der Eigentümer: US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA" },
    { wert: "rund 45 Mrd. $", label: "von der SBA abgesicherte 7(a)- und 504-Kredite im Fiskaljahr 2025, laut US-Rechnungshof GAO" },
  ],
  blick: [
    ["Gilt seit", "1. März 2026 (Procedural Notice 5000-876626), seit 1. Oktober 2026 Teil der SOP 50 10 8.1"],
    ["Betrifft", "7(a) in allen Varianten und 504"],
    ["Zugelassen", "Nur US-Bürger und US-Staatsangehörige mit Hauptwohnsitz in den USA"],
    ["Ausgeschlossen", "Wohnsitz im Ausland, Green Card, Visum, ausländische Muttergesellschaft"],
    ["Was bleibt", "Firmenbonität, Firmenkarten, Bankkredit gegen Sicherheiten, Eigenkapital, Hausbank"],
    ["Wer entscheidet", "Über jeden Kredit das jeweilige Institut"],
    ["Mit FIAON Global", "Jeder Antrag vollständig vorbereitet, Begleitung bis zur Entscheidung des Instituts"],
  ],
  kurz: "Nein. Ein SBA-Kredit als Ausländer ist seit dem 1. März 2026 ausgeschlossen. In 7(a) und 504 müssen 100 Prozent der direkten und indirekten Eigentümer US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein. Quelle: SBA Procedural Notice 5000-876626, seit 1. Oktober 2026 Teil der SOP 50 10 8.1. Offen bleiben Firmenbonität, ein Bankkredit gegen Sicherheiten und Eigenkapital. Über jeden Kredit entscheidet das Institut.",
  bloecke: [
    {
      typ: "text", id: "regel", h2: "SBA-Kredit als Ausländer: die Regel",
      absaetze: [
        "Wer einen SBA-Kredit als Ausländer erwägt, sollte zuerst den Aufbau der Programme kennen. Die Kredite der Programme 7(a) und 504 vergeben Banken und andere zugelassene Kreditgeber an kleine und mittlere Unternehmen. Die Small Business Administration (SBA) sichert diese Kredite anteilig ab. Fällt ein Kredit aus, teilen Kreditgeber und SBA den Verlust nach dem abgesicherten Anteil. Welche Unternehmen zugelassen sind, regelt die Verfahrensordnung SOP 50 10 der SBA. Seit dem 1. Oktober 2026 gilt die Fassung 8.1 für jeden Antrag, der ab diesem Tag eine SBA-Kreditnummer erhält.",
        "Am 2. Februar 2026 hat die SBA die Eigentümerregel mit der Policy Notice 5000-876441 verschärft. Am 11. Februar 2026 hat sie die Änderung mit der Procedural Notice 5000-876626 in die Verfahrensordnung übernommen. Seit dem 1. März 2026 gilt sinngemäß dieser Kernsatz: SBA-Finanzierung erhalten nur Antragsteller, deren direkte und indirekte Eigentümer zu 100 Prozent US-Bürger oder US-Staatsangehörige sind. Der Hauptwohnsitz jedes Eigentümers muss in den USA, ihren Territorien oder Besitzungen liegen. Dieselben Anforderungen gelten für jeden Bürgen, den die SBA verlangt. Die Fassung SOP 50 10 8.1 enthält den Kernsatz im selben Wortlaut.",
        "Zwei Zusätze betreffen Eigentümer aus Europa unmittelbar. Erstens muss jede direkt oder indirekt beteiligte Gesellschaft in den USA gegründet sein. Zweitens bestimmt die SBA den Hauptwohnsitz nach der IRS Publication 523: Jeder Mensch hat nur einen. Bei mehreren Wohnungen zählt vor allem, wo die Person die meiste Zeit verbringt. Daneben zählen die verwendete Anschrift (Post, Wahlregister, Steuererklärungen, Führerschein) und die Nähe zu Arbeitsplatz, Bank und Familie.",
      ],
      punkte: [
        "Der Kreditgeber muss im System der SBA alle direkten und indirekten Eigentümer erfassen. Er bestätigt nach bestem Wissen, dass kein Eigentümer und kein verlangter Bürge ausgeschlossen ist.",
        "Auch der Antragsteller bestätigt mit seiner Unterschrift, dass keiner seiner direkten oder indirekten Eigentümer und Bürgen ausgeschlossen ist.",
        "Die SBA rechnet Anteile von Ehepartnern und minderjährigen Kindern zusammen.",
        "War in den sechs Monaten vor der Vergabe der SBA-Kreditnummer eine nicht berechtigte Person beteiligt, ist die Gesellschaft unzulässig. Das gilt nicht, wenn diese Person ihren Anteil vorher vollständig abgegeben hat.",
      ],
    },
    {
      typ: "tabelle", id: "wer", h2: "Zugelassene und ausgeschlossene Eigentümer",
      lead: "Die Tabelle zeigt, wer seit dem 1. März 2026 Eigentümer sein darf. Anhang 3 der Verfahrensordnung zählt auf, wer als „Ineligible Person“ gilt; die Liste ist ausdrücklich nicht abschließend. Für Eigentümer aus Deutschland, Österreich und der Schweiz sind fünf dieser Gruppen maßgeblich.",
      kopf: ["Eigentümer", "Als Eigentümer zugelassen", "Fundstelle in der SOP 50 10 8.1"],
      zeilen: [
        ["US-Bürger mit Hauptwohnsitz in den USA", "ja", "Absatz F, Ziffer 1"],
        ["Eingebürgerte US-Bürger mit Hauptwohnsitz in den USA", "ja, ohne zusätzliche Prüfung", "Absatz F, Ziffer 3"],
        ["US-Staatsangehörige ohne Bürgerrecht (U.S. Nationals) mit Hauptwohnsitz in den USA", "ja, mit Beleg des Status", "Absatz F, Ziffer 2"],
        ["Deutsche, Österreicher und Schweizer ohne US-Staatsbürgerschaft", "nein", "Anhang 3, Ziffer 3"],
        ["US-Bürger mit Hauptwohnsitz in Deutschland, Österreich oder der Schweiz", "nein", "Anhang 3, Ziffer 4"],
        ["Inhaber einer Green Card, auch mit bedingtem Status", "nein", "Anhang 3, Ziffer 7"],
        ["Inhaber eines Visums, etwa des E-2-Visums", "nein", "Anhang 3, Ziffer 2"],
        ["GmbH, AG oder andere im Ausland gegründete Gesellschaft als Gesellschafterin", "nein", "Anhang 3, Ziffer 5"],
      ],
      hervor: 1,
      fuss: [
        "Quelle: SBA SOP 50 10 8.1 (gültig seit 01.10.2026), Abschnitt A, Kapitel 1, Absatz F und Anhang 3. Der Wortlaut entspricht der Procedural Notice 5000-876626 vom 11.02.2026. US-Staatsangehörige ohne Bürgerrecht sind Personen, die etwa in Amerikanisch-Samoa geboren sind.",
        "Eine Ausnahme betrifft nur Bürgen: Verlangt der Kreditgeber eine begrenzte Zusatzbürgschaft, darf sie auch eine ausgeschlossene Person stellen. Eigentümer darf diese Person nicht sein.",
      ],
    },
    {
      typ: "text", id: "programme", h2: "Folgen für 7(a) und 504",
      absaetze: [
        "Das Programm 7(a) ist das Hauptprogramm der SBA für Unternehmenskredite. Ein Kreditgeber vergibt den Kredit, die SBA sichert einen Teil ab. In den meisten Varianten sind das höchstens 85 Prozent bei Krediten von höchstens 150.000 $ und höchstens 75 Prozent darüber. Der Höchstbetrag eines 7(a)-Kredits liegt bei 5 Mio. $. Zulässige Zwecke sind Betriebsmittel, Maschinen und Ausstattung, Immobilien, die Ablösung bestehender Schulden und der Kauf eines Unternehmens. Die Notice ändert ausdrücklich auch die Antragsunterlagen der Varianten 7(a) Small, SBA Express, CAPLines, Export Express, Export Working Capital und International Trade. Die Eigentümerregel gilt damit für alle Varianten.",
        "Das Programm 504 finanziert langfristig große Anlagegüter: Grundstücke, Gebäude und Maschinen mit einer Restnutzungsdauer von mindestens zehn Jahren. Ein privater Kreditgeber, eine Certified Development Company (CDC) und der Unternehmer teilen sich die Finanzierung. Der Anteil der CDC liegt bei höchstens 40 Prozent; diesen Anteil sichert die SBA vollständig ab. Er ist auf 5 Mio. $ je Unternehmen begrenzt, für Hersteller und bestimmte Energieprojekte auf 5,5 Mio. $ je Projekt. Für 504 gilt dieselbe Eigentümerregel wie für 7(a).",
        "Den Umfang beider Programme nennt der US-Rechnungshof GAO in seiner Entscheidung. Im Fiskaljahr 2025 hat die SBA 7(a)- und 504-Kredite über rund 45 Mrd. $ an mehr als 85.000 kleine Unternehmen abgesichert. Kredite, die vor dem 1. März 2026 genehmigt wurden, dürfen weiter betreut werden. Erhöht werden dürfen sie nach einem Hinweis der SBA vom 31. März 2026 nicht, wenn die Gesellschaft die neue Regel nicht erfüllt.",
      ],
    },
    {
      typ: "etappen", id: "verlauf", h2: "Entstehung der Regel",
      lead: "Für Eigentümer mit Wohnsitz in Europa war der SBA-Kredit schon vor 2026 kaum erreichbar. Die neue Regel hat die verbliebenen Ausnahmen aufgehoben.",
      etappen: [
        { titel: "Verfahrensordnung SOP 50 10 8", dauer: "1. Juni 2025", text: "Alle Eigentümer müssen US-Bürger, US-Staatsangehörige oder Inhaber einer Green Card sein, mit Hauptwohnsitz in den USA. Wer in Deutschland, Österreich oder der Schweiz lebt, ist damit bereits ausgeschlossen." },
        { titel: "Fünf-Prozent-Ausnahme", dauer: "19. Dezember 2025", text: "Die Procedural Notice 5000-872050 lässt für drei Gruppen zusammen höchstens fünf Prozent der Anteile zu. Das sind Ausländer mit Wohnsitz außerhalb der USA, US-Bürger und Green-Card-Inhaber mit Hauptwohnsitz im Ausland sowie Inhaber einer bedingten Green Card. Die Ausnahme gilt für Kredite, die die SBA ab dem 1. Januar 2026 genehmigt." },
        { titel: "Policy Notice 5000-876441", dauer: "2. Februar 2026", text: "Die SBA kündigt an: Ab dem 1. März 2026 entfällt die Fünf-Prozent-Ausnahme, und Inhaber einer Green Card dürfen keinen Anteil mehr halten." },
        { titel: "Procedural Notice 5000-876626", dauer: "11. Februar 2026", text: "Die Änderung wird Teil der Verfahrensordnung. Für Anträge mit Green-Card-Eigentümern im nicht delegierten Verfahren gilt ein Übergang. Die SBA bearbeitet sie noch, wenn sie bis zum 28. Februar 2026, 23:59 Uhr Ostküstenzeit, den Prüfstatus R1 im System der SBA erreicht hatten." },
        { titel: "Inkrafttreten", dauer: "1. März 2026", text: "Im delegierten Verfahren gilt die Regel für jede SBA-Kreditnummer, die ab diesem Tag vergeben wird. Im nicht delegierten Verfahren zählt der Tag, an dem der Antrag im System der SBA den Status R1 erreicht. Seitdem sind nur Gesellschaften mit 100 Prozent US-Eigentum zugelassen." },
        { titel: "Entscheidung des US-Rechnungshofs", dauer: "1. Juli 2026", text: "Die GAO stellt in B-338157 fest: Beide Notices sind eine Regel im Sinne des Congressional Review Act. Die SBA hätte sie vor dem Inkrafttreten dem Kongress und dem Leiter der GAO vorlegen müssen. Sie hatte keinen solchen Bericht vorgelegt und auf die Anfrage der GAO inhaltlich nicht geantwortet." },
        { titel: "Neue Fassung SOP 50 10 8.1", dauer: "1. Oktober 2026", text: "Die SBA übernimmt beide Notices in die neue Fassung ihrer Verfahrensordnung. Sie gilt für jeden Antrag, der ab diesem Tag eine SBA-Kreditnummer erhält. Die Eigentümerregel steht dort im selben Wortlaut." },
        { titel: "Unverändert in Kraft", dauer: "Stand 27. Oktober 2026", text: "Die Regel gilt. Eine Aufhebung durch die SBA oder ein Beschluss des Kongresses ist zu diesem Stand nicht ersichtlich." },
      ],
    },
    {
      typ: "karten", id: "wege", h2: "Finanzierungswege ohne SBA", spalten: 3,
      lead: "Ein US-Kredit für eine Gesellschaft in ausländischem Besitz bleibt auch nach März 2026 möglich, nur ohne die SBA. Jeder der sechs Wege hat eine eigene Grundlage. Über Karten und Kredite entscheidet das jeweilige Institut.",
      karten: [
        { tag: "Firmenbonität", titel: "Business Credit: das Kreditprofil der Gesellschaft", text: "Grundlage sind die D-U-N-S-Nummer der Wirtschaftsauskunftei und erste Lieferantenkonten mit Zahlungsziel. Zahlt die Gesellschaft früh, entsteht ein eigenes Kreditprofil, das Kreditgeber prüfen können.", pfad: "/business/wissen/business-credit-usa" },
        { tag: "Firmenkarten", titel: "Karten nach Kontostand der Gesellschaft", text: "Manche Herausgeber richten den Kartenrahmen am Kontostand der Gesellschaft aus. In der Regel verlangen sie die persönliche Haftung des Inhabers. Die Bedingungen legt jeder Herausgeber selbst fest.", pfad: "/business/wissen/us-firmenkarte-beantragen" },
        { tag: "Bank", titel: "Kredit gegen Sicherheiten", text: "Ohne SBA trägt die Bank das Ausfallrisiko allein. Sie bewertet Geschäftsjahre, Umsatz und Sicherheiten. Als Sicherheit kommen eine Einlage, die Haftung der Muttergesellschaft oder eine Immobilie in Betracht.", pfad: "/business/wissen/finanzierungswege-usa" },
        { tag: "Eigenkapital", titel: "Einlage oder Gesellschafterdarlehen", text: "Sie oder Ihre Muttergesellschaft statten die US-Gesellschaft mit eigenen Mitteln aus. Gehört die LLC allein einem ausländischen Eigentümer, meldet sie jede Einlage und jedes Darlehen mit der jährlichen Form 5472.", pfad: "/business/tochtergesellschaft-usa" },
        { tag: "Europa", titel: "Hausbank im Wohnsitzland", text: "Ihre Hausbank kennt Ihre Zahlen aus der laufenden Geschäftsbeziehung. Mit einem Kredit an Sie oder Ihre GmbH können Sie die US-Gesellschaft ausstatten." },
        { tag: "Objekt", titel: "Finanzierung von Mietobjekten", text: "Bei Mietobjekten prüfen manche Kreditgeber vor allem, ob die Miete die Rate deckt. Sie verlangen Eigenkapital und Reserven aus eigenen Mitteln.", pfad: "/business/wissen/us-immobilie-finanzieren" },
      ],
    },
    {
      typ: "tabelle", id: "vergleich", h2: "Bankkredit mit und ohne SBA",
      lead: "Beim SBA-Kredit trägt die Behörde einen Teil des Ausfallrisikos. Ohne diesen Anteil trägt die Bank das Risiko allein und legt ihren Maßstab selbst fest.",
      kopf: ["", "SBA-Kredit (7(a) oder 504)", "Bankkredit ohne SBA"],
      zeilen: [
        ["Ausfallrisiko", "Kreditgeber und SBA, nach den Regeln des Programms", "die Bank allein"],
        ["Eigentümer", "nur US-Bürger und US-Staatsangehörige mit Hauptwohnsitz in den USA", "legt jede Bank selbst fest"],
        ["Was die Bank prüft", "die Regeln der SBA und ihre eigenen Maßstäbe", "ihre eigenen Maßstäbe: Geschäftsjahre, Umsatz, Sicherheiten"],
        ["Höchstbetrag", "7(a): 5 Mio. $; 504: Anteil der CDC 5 Mio. $ je Unternehmen", "legt jede Bank selbst fest"],
        ["Für Eigentümer mit Wohnsitz in Europa", "ausgeschlossen", "möglich, wenn die Bank zustimmt"],
      ],
      hervor: 2,
      fuss: ["Allgemeine Übersicht, Stand Oktober 2026. Bedingungen, Höhe und Sicherheiten legt jedes Institut selbst fest."],
    },
    {
      typ: "text", id: "europa", h2: "Eigenkapital und Hausbank in Europa",
      absaetze: [
        "Viele Unternehmer aus dem deutschsprachigen Raum haben ihre Mittel im Wohnsitzland: in der eigenen GmbH, in Rücklagen und in der Geschäftsbeziehung zu ihrer Hausbank. Aus diesen Mitteln können sie die US-Gesellschaft ausstatten. Zwei Formen kommen in Betracht: eine Einlage, die das Eigenkapital erhöht, oder ein Darlehen der Gesellschafterin an ihre Tochter.",
        `Beide Formen haben Folgen, die vor der Zahlung zu klären sind. In Deutschland gilt für ein Darlehen zwischen Ihnen oder Ihrer GmbH und der US-Gesellschaft der Fremdvergleich (§ 1 AStG). Mindern Bedingungen, die unabhängige Dritte so nicht vereinbart hätten, Ihre Einkünfte, setzt das Finanzamt diese steuerlich so an wie unter Dritten. In den USA gilt für eine LLC, die allein einem ausländischen Eigentümer gehört, eine Meldepflicht. Sie meldet jede Einlage, jede Ausschüttung und jedes Darlehen im Verhältnis zu diesem Eigentümer mit Form 5472. Wer die Meldung versäumt, riskiert eine Strafe von ${IRS.strafe5472}.`,
      ],
    },
    {
      typ: "text", id: "vorsicht", h2: "Ersatzangebote für den SBA-Kredit",
      absaetze: [
        "Manche Anbieter stellen Kapital ohne Prüfung durch ein Institut in Aussicht, oft mit zugesagten Rahmen und Kartenanträgen in Serie. Die US-Handelsaufsicht FTC hat am 17. November 2025 einen solchen Fall bekannt gemacht. Der Anbieter Seek Capital und sein Geschäftsführer sind zur Beilegung der Vorwürfe der FTC dauerhaft vom Geschäft mit Unternehmensfinanzierung ausgeschlossen. Nach Darstellung der FTC hatte das Unternehmen mit besonderen Beziehungen zu Kreditgebern und vorteilhaften Konditionen geworben. Unternehmern berechnete es dann Tausende Dollar allein dafür, Kreditkarten zu eröffnen. Das kostete die Betroffenen Millionen und schadete ihrer Kreditwürdigkeit.",
        "Daraus folgen vier Anforderungen an jeden Anbieter. Er nennt Honorar und Leistungen vorab schriftlich. Er behauptet keine Beziehung zu Kreditgebern, die es nicht gibt, und sagt keinen Rahmen zu. Er erklärt, wie jeder Antrag auf die Kreditakte wirkt.",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        "Eigentümer mit Hauptwohnsitz außerhalb der USA sind von SBA-Krediten ausgeschlossen. Wir gründen Ihre US-Gesellschaft, beantragen die EIN und, nach unserem ITIN-Check, die ITIN. Konto- und Kartenanträge bereiten wir vollständig vor; die Anträge stellen Sie selbst.",
        `${FINANZIERUNG.satz} ${satz("S9")}`,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${FINANZIERUNG.ihrTeil}`,
        "Steuern: Steuerfragen zu Einlage, Gesellschafterdarlehen und Struktur liegen bei Partner-Steuerberatern, die in eigener Verantwortung arbeiten.",
        `${TEIL.bedingung}: ${ROLLE}`,
        P.geldZurueck,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: `${P.karteLead} ${satz("S9")}`, paket: "global_kapital" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        `${satz("S8")} FIAON sagt keinen Rahmen zu.`,
        "Ob die SBA-Regel Bestand hat, ist politisch offen. Maßgeblich ist die Fassung, die am Tag Ihres Antrags gilt. Der Kreditgeber prüft sie.",
        "Eine Eigentümerstruktur nur auf dem Papier, etwa ein US-Bürger als vorgeschobener Inhaber, wäre eine Falschangabe. 18 U.S.C. § 1014 stellt wissentlich falsche Angaben in Kreditanträgen unter Strafe, unter anderem gegenüber Instituten mit FDIC-Einlagensicherung.",
        KAPITAL_FREI,
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[2],
      ],
    },
  ],
  fragen: [
    { f: "Kann ich als Ausländer einen SBA-Kredit bekommen?", a: "Nein. Seit dem 1. März 2026 müssen alle direkten und indirekten Eigentümer US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein. Das gilt für 7(a) und 504 (SBA Procedural Notice 5000-876626). Wer in Deutschland, Österreich oder der Schweiz lebt, erfüllt die Anforderung an den Hauptwohnsitz nicht." },
    { f: "Bekommen Green-Card-Inhaber noch einen SBA-Kredit?", a: "Nein. Seit dem 1. März 2026 dürfen Inhaber einer Green Card keinen Anteil an einer Gesellschaft halten, die einen 7(a)- oder 504-Kredit beantragt. Das gilt auch bei bedingtem Status. Die SBA hat nur noch Anträge im nicht delegierten Verfahren bearbeitet, die bis zum 28. Februar 2026, 23:59 Uhr Ostküstenzeit, den Prüfstatus R1 erreicht hatten." },
    { f: "Ich bin US-Bürger, wohne aber in Deutschland. Geht es dann?", a: "Nein. Auch US-Bürger und US-Staatsangehörige mit Hauptwohnsitz außerhalb der USA sind ausgeschlossen. Den Hauptwohnsitz bestimmt die SBA nach der IRS Publication 523: Es zählt vor allem die Wohnung, in der Sie die meiste Zeit verbringen." },
    { f: "Kann meine GmbH für ihre US-Tochter einen SBA-Kredit beantragen?", a: "Nein. Jede Gesellschaft, die direkt oder indirekt an der Antragstellerin beteiligt ist, muss in den USA gegründet sein. Eine GmbH, AG oder Stiftung aus Europa als Gesellschafterin schließt den Antrag aus." },
    { f: "Hilft ein E-2-Visum mit Wohnsitz in Miami?", a: "Nein, nicht für den SBA-Kredit. Visuminhaber zählen ausdrücklich zu den ausgeschlossenen Personen, auch mit Wohnsitz in den USA. Das E-2-Visum kann für Ihre Arbeit in den USA wichtig sein. An der Eigentümerregel der SBA ändert es nichts. Ob es für Sie in Frage kommt, beurteilen Einwanderungsanwälte im Einzelfall." },
    { f: "Reicht es, wenn ein US-Partner die Mehrheit hält?", a: "Nein. Die Regel verlangt 100 Prozent; ein einziger nicht berechtigter Eigentümer schließt die Gesellschaft aus. Zulässig wird sie erst, wenn diese Person ihren Anteil vor der Vergabe der SBA-Kreditnummer vollständig abgegeben hat. Ein Inhaber nur auf dem Papier wäre eine Falschangabe." },
    { f: "Hat der GAO-Entscheid die Regel aufgehoben?", a: "Nein. Der US-Rechnungshof GAO hat am 1. Juli 2026 festgestellt: Die Notices sind eine Regel im Sinne des Congressional Review Act. Die SBA hätte sie dem Kongress vorlegen müssen. Eine Aufhebung ist bis zum 27. Oktober 2026 nicht ersichtlich. Seit dem 1. Oktober 2026 steht die Regel in der Fassung SOP 50 10 8.1 der Verfahrensordnung." },
    { f: "Welche Finanzierung bleibt meiner US-LLC stattdessen?", a: "In den USA bleiben Firmenbonität mit D-U-N-S-Nummer und Lieferantenkonten, Firmenkarten und ein Bankkredit gegen Sicherheiten. Aus Europa kommen Eigenkapital und Kredite Ihrer Hausbank hinzu. Als Sicherheit kommen eine Einlage, die Haftung der Muttergesellschaft oder eine Immobilie in Betracht. Über Karten und Kredite entscheidet das jeweilige Institut." },
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
