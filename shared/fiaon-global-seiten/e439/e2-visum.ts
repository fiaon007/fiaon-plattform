// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: E2 VISUM MIT EIGENER US-FIRMA (27.10.2026, E-439)
//
// Grundzüge des E-2-Treaty-Investor-Visums für Staatsangehörige von Deutschland,
// Österreich und der Schweiz — strikt als Information. Recherche:
// .arbeit/recherche/kw_de.md T14 und kw_en.md 5.2; dort offene Punkte selbst geprüft.
//
// Am 27.10.2026 an den amtlichen Texten belegt:
// · 9 FAM 402.9 (Fassung CT:VISA-2190 vom 17.02.2026): Voraussetzungen 402.9-6(A),
//   Staatsangehörigkeit und 50-Prozent-Regel 402.9-4(B), Ausreiseabsicht 402.9-4(C),
//   kein Büro nötig 402.9-4(D), Investition 402.9-6(B), echtes Unternehmen 402.9-6(C),
//   keine Mindestsumme / Verhältnisprüfung 402.9-6(D), nicht marginal 402.9-6(E),
//   Kontrolle 402.9-6(F), Familie 402.9-9, Vertragsstaaten 402.9-10 (Deutschland
//   14.07.1956, Österreich 27.05.1931, Schweiz 08.11.1855 — je E-1 und E-2),
//   Formulare 402.9-11(A): Der E-2-Investor beantwortet die DS-156-E-Fragen im DS-160.
// · 22 CFR 41.51(b), 22 CFR 41.102 (Gespräch 14 bis 79 Jahre), 22 CFR 22.1 Nr. 21(c) (315 $) und
//   Nr. 23 (Ausstellungsgebühr nach Gegenseitigkeit), 22 CFR 41.121 (Ablehnung: Grund, Überprüfung).
// · Fachprüfung 27.10.2026 (eCFR-Fassung 01.10.2026, 9 FAM CT:VISA-2190): neunter Prüfpunkt
//   (402.9-6(A)(8)) ergänzt, 50-Prozent-Regel getrennt von der Kontrolle, Ausnahme für
//   Staatsangehörigkeit durch Investition (8 U.S.C. § 1101(a)(15)(E)), Mitarbeiter nach 22 CFR 41.51(b)(2).
// · USCIS E-2: zwei Jahre je Zulassung, Verlängerung ohne Obergrenze der Anzahl,
//   Ehepartner arbeitsberechtigt (E-2S), I-129 nur im Inland.
// · IRS Substantial Presence Test und Taxation of Resident Aliens; § 6 AStG; CBP VWP.
// NICHT übernommen (nicht amtlich belegbar): Gültigkeit des Visums je Land nach dem
// Gegenseitigkeitsplan (travel.state.gov 403), Ausstellungsgebühren je Land, zuständige
// Konsulate je Land, „Visa Integrity Fee“, Mindestsummen und Erfolgsquoten der Kanzleien.
// Visa sind nicht Teil des Auftrags (zielgruppen.ts) — der Antrag gehört dem Partner-Anwalt.
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein „Global VIP“ mehr (kein Preis, kein Reiseversprechen); ab 1 Mio.
// US-Dollar Kapitalrahmen begleiten wir persönlich in Miami. Die alte Geld-zurück-Zusage je Paket entfällt.
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): ein Abschnitt „Was FIAON Global dabei übernimmt“ aus den Schritten 1
// und 2 der festen Erzählung (shared/fiaon-global-saetze.ts); kein Partner bei der Arbeit im Präsens, kein „Team vor Ort“,
// kein Partnerstandort, keine D-U-N-S-Nummer als Leistung (der Vertrag nennt sie nicht), keine Zusage zum Visum —
// über das Visum entscheidet das Konsulat, der Antrag liegt bei einem Partner-Anwalt für Einwanderungsrecht.
// Runde zwei zum Sprachleitfaden: jeder sichtbare Text neu gefasst (Aussage, Bedingung, Entscheider; kurze Sätze; Sachtitel).
// Fakten, Zahlen, Fundstellen und Quellen unverändert. Die Sachabschnitte erklären das Recht ohne FIAON; FIAON steht erst
// ab dem Baustein „rollen“. Im Fließtext heißt es „Anwalt für Einwanderungsrecht“ (der Beruf), bei FIAON „Partner-Anwälte“
// (die Rolle, nie bei der Arbeit). Kein Satz stellt ein Visum in Aussicht: Es entscheidet allein die US-Behörde.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
import { GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN as Q } from "../fakten";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz, weitererSatz, type Schritt, type SchrittNr } from "../../fiaon-global-saetze";

const S = "2026-10-27";
const P = EIN_PRODUKT.de;
/** Schritt 1 und 2 der festen Erzählung (Leitfaden 2.2) — Satz und „Ihr Teil“ wortgleich aus der einen Quelle, nie getippt. */
const schritt = (nr: SchrittNr): Schritt => SECHS_SCHRITTE.de.find((x) => x.nr === nr)!;
const GRUENDUNG = schritt(1);
const UNTERLAGEN = schritt(2);
/** Die Namen der festen Teile eines Schritts: „Ihr Teil“, „Bedingung“ (Leitfaden 2.1). */
const TEIL = SCHRITTE_KOPF.de.teile;
/** Der Rollen-Satz aus dem Fuß jeder Seite, seine ersten beiden Sätze: keine Bank, keine Kanzlei · keine Kredite — importiert, nie getippt. */
const [KEINE_BANK, KEINE_KREDITE] = satz("S8", "de").split(/(?<=\.)\s+/);

/** Quellen dieses Beitrags, selbst abgerufen am 27.10.2026. */
const QUELLEN: Record<string, GlobalQuelle> = {
  fam: { titel: "U.S. Department of State — 9 FAM 402.9, Treaty Traders and Investors (E-Visa), Fassung vom 17.02.2026", url: "https://fam.state.gov/fam/09FAM/09FAM040209.html" },
  cfr4151: { titel: "22 CFR 41.51 — Treaty Trader, Treaty Investor", url: "https://www.law.cornell.edu/cfr/text/22/41.51" },
  usc1101: { titel: "8 U.S. Code § 1101(a)(15)(E) — Treaty Trader und Treaty Investor", url: "https://www.law.cornell.edu/uscode/text/8/1101" },
  uscisE2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  cfr41102: { titel: "22 CFR 41.102 — Persönliche Vorsprache und Gespräch beim Konsulat", url: "https://www.law.cornell.edu/cfr/text/22/41.102" },
  cfr221: { titel: "22 CFR 22.1 — Gebührenordnung des US-Außenministeriums", url: "https://www.law.cornell.edu/cfr/text/22/22.1" },
  cfr41121: { titel: "22 CFR 41.121 — Ablehnung eines Nichteinwanderervisums", url: "https://www.law.cornell.edu/cfr/text/22/41.121" },
  cbpVwp: { titel: "U.S. Customs and Border Protection — Visa Waiver Program", url: "https://www.cbp.gov/travel/international-visitors/visa-waiver-program" },
  irsSpt: { titel: "IRS — Substantial Presence Test", url: "https://www.irs.gov/individuals/international-taxpayers/substantial-presence-test" },
  irsResident: { titel: "IRS — Taxation of Resident Aliens", url: "https://www.irs.gov/individuals/international-taxpayers/taxation-of-resident-aliens" },
  astg6: { titel: "§ 6 AStG — Besteuerung des Vermögenszuwachses beim Wegzug", url: "https://www.gesetze-im-internet.de/astg/__6.html" },
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
};

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/e2-visum",
  art: "wissen",
  seo: {
    titel: "E2 Visum mit eigener US-Firma — FIAON Global",
    beschreibung: "E2 Visum für Deutsche, Österreicher und Schweizer: Voraussetzungen, Kosten, Antrag beim Konsulat, Laufzeit und Familie. Es entscheidet das Konsulat.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 51",
  auge: "Wissen · Investorenvisum USA",
  h1: "Das E2 Visum.",
  h1b: "Voraussetzungen, Antrag und Entscheidung.",
  lead: "Das E2 Visum (E-2 Treaty Investor) erlaubt Staatsangehörigen bestimmter Vertragsstaaten, in den USA ein Unternehmen aufzubauen und zu lenken. Voraussetzung ist eine erhebliche Investition in dieses Unternehmen. Deutschland, Österreich und die Schweiz gehören zu den Vertragsstaaten. Diese Seite nennt die Voraussetzungen nach dem Handbuch des US-Außenministeriums, den Ablauf des Antrags, Laufzeit und Familie. Über jeden Antrag entscheidet allein die US-Behörde.",
  ziffern: [
    { wert: "50 %", label: "Mindestanteil der Staatsangehörigen des Vertragsstaats am Unternehmen" },
    { wert: "2 Jahre", label: "Höchstdauer des Aufenthalts je Zulassung; die Zahl der Verlängerungen ist nicht begrenzt" },
    { wert: "5 Jahre", label: "Zeitraum, in dem das Unternehmen in der Regel mehr als einen minimalen Lebensunterhalt tragen soll" },
  ],
  blick: [
    ["Was es ist", "Visum für Investoren aus Vertragsstaaten; vorübergehender Aufenthalt, keine Green Card"],
    ["Vertragsstaaten", "Deutschland, Österreich und die Schweiz gehören dazu"],
    ["Investition", "Erheblich im Verhältnis zu den Kosten des Unternehmens; eigene Mittel im Risiko"],
    ["Unternehmen", "Echt, tätig und mehr als marginal"],
    ["Kontrolle", "In der Regel mindestens 50 % Eigentum oder die operative Leitung"],
    ["Familie", "Ehepartner und ledige Kinder unter 21 Jahren"],
    ["Wer entscheidet", "Das US-Konsulat über das Visum, die Grenzbehörde CBP über die Einreise"],
    ["FIAON Global übernimmt", "Gründung, Unterlagen und Anträge für EIN und ITIN; der Visumsantrag ist nicht Teil des Mandats"],
  ],
  kurz: "Das E2 Visum ist ein US-Visum für Investoren aus Vertragsstaaten; Deutschland, Österreich und die Schweiz gehören dazu. Das Handbuch des US-Außenministeriums (9 FAM 402.9) verlangt eine erhebliche Investition eigener Mittel, die im Risiko steht und unwiderruflich gebunden ist. Das Unternehmen muss echt und tätig sein und mehr als einen minimalen Lebensunterhalt der Familie tragen. Mindestens 50 Prozent des Unternehmens gehören Staatsangehörigen des Vertragsstaats; Sie lenken es und erklären Ihre Ausreiseabsicht. Eine feste Mindestsumme gibt es nicht. Es entscheidet allein das US-Konsulat.",
  bloecke: [
    {
      typ: "text", id: "was-es-ist", h2: "Das E2 Visum: Einordnung und Grenzen",
      absaetze: [
        "Das E-2-Visum ist ein Visum für einen vorübergehenden Aufenthalt. Das US-Einwanderungsgesetz sieht es für Staatsangehörige eines Landes vor, mit dem die USA einen Handels- und Schifffahrtsvertrag geschlossen haben. Gemeint ist der Investor, der ein Unternehmen entwickeln und lenken will. In dieses Unternehmen hat er einen erheblichen Betrag investiert oder investiert ihn gerade (8 U.S.C. § 1101(a)(15)(E)(ii)). Gleichwertige Verträge zählen ebenso (22 CFR 41.51(b)(5)). Nach der Verordnung können auch Mitarbeiter derselben Staatsangehörigkeit ein E-2-Visum erhalten: als Führungskraft, als Aufsicht oder mit unverzichtbaren Fachkenntnissen (22 CFR 41.51(b)(2)).",
        "Eine Green Card ist es nicht. Wer das Visum beantragt, erklärt die Absicht, die USA am Ende des Status zu verlassen. Einen Wohnsitz im Heimatland muss er dafür nicht behalten. Nach dem Handbuch des Außenministeriums darf er seine Wohnung verkaufen und den Hausstand in die USA bringen (9 FAM 402.9-4(C)).",
        "Der Besitz einer US-Gesellschaft gibt für sich genommen kein Recht, in den USA zu wohnen oder zu arbeiten. Auch die ITIN ändert keinen Aufenthaltsstatus und erlaubt keine Arbeit; sie ist Ihre persönliche Steuernummer bei der US-Steuerbehörde IRS. Für Gespräche, Messen und Termine gilt das Visa Waiver Program. Staatsangehörige der Teilnehmerländer reisen mit ESTA für geschäftliche Aufenthalte von höchstens 90 Tagen ohne Visum ein. Wer die Gesellschaft dauerhaft vor Ort aufbauen und führen will, braucht ein Visum. Für Investoren aus Vertragsstaaten kommt das E-2-Visum in Betracht.",
      ],
    },
    {
      typ: "tabelle", id: "vertragsstaaten", h2: "E2 Visum: Deutschland, Österreich, Schweiz",
      lead: "Das US-Außenministerium führt alle drei Länder in seiner Liste der Vertragsstaaten, jeweils für E-1 (Handel) und E-2 (Investition).",
      kopf: ["Staatsangehörigkeit", "E-1 in Kraft seit", "E-2 in Kraft seit"],
      zeilen: [
        ["Deutschland", "14.07.1956", "14.07.1956"],
        ["Österreich", "27.05.1931", "27.05.1931"],
        ["Schweiz", "08.11.1855", "08.11.1855"],
      ],
      fuss: [
        "Quelle: 9 FAM 402.9-10, Fassung vom 17.02.2026. Maßgeblich ist die Staatsangehörigkeit. Der Wohnsitz und der Gründungsort der Gesellschaft zählen dafür nicht (9 FAM 402.9-4(B)). Das Gesetz nennt eine Ausnahme: Wer die Staatsangehörigkeit durch eine Investition erworben und den E-Status noch nie erhalten hat, muss zu irgendeinem Zeitpunkt vor dem Antrag mindestens drei Jahre ununterbrochen in diesem Land gewohnt haben (8 U.S.C. § 1101(a)(15)(E)).",
        "Wer zwei Staatsangehörigkeiten hat, wählt für das Unternehmen eine davon. Inhaber und alle E-Mitarbeiter treten dann mit dieser Staatsangehörigkeit auf. Anteile von Inhabern einer Green Card zählen für die Staatsangehörigkeit des Unternehmens nicht mit.",
      ],
    },
    {
      typ: "tabelle", id: "voraussetzungen", h2: "E2 Visum: die neun Voraussetzungen",
      lead: "Das Konsulat prüft bei einem E-2-Antrag neun Punkte. Das Handbuch nennt sie in dieser Reihenfolge (9 FAM 402.9-6(A)). Die Beweislast liegt beim Antragsteller (9 FAM 402.9-2).",
      kopf: ["Voraussetzung", "Was das Konsulat prüft", "Fundstelle"],
      zeilen: [
        ["Vertragsstaat", "Zwischen den USA und Ihrem Land besteht ein passender Vertrag", "9 FAM 402.9-4(A), 402.9-10"],
        ["Staatsangehörigkeit", "Investor und Unternehmen haben die Staatsangehörigkeit des Vertragsstaats; beim Unternehmen zählen die Eigentümer, mindestens 50 Prozent", "9 FAM 402.9-4(B), 402.9-6(F)"],
        ["Investition", "Eigene Mittel, im Risiko, unwiderruflich gebunden, aus legaler Herkunft", "9 FAM 402.9-6(B); 22 CFR 41.51(b)(7)"],
        ["Echtes Unternehmen", "Tätig und auf Gewinn ausgerichtet, liefert Waren oder Leistungen, erfüllt die rechtlichen Anforderungen vor Ort; keine Gesellschaft nur auf dem Papier", "9 FAM 402.9-6(C); 22 CFR 41.51(b)(8)"],
        ["Erhebliche Summe", "Im Verhältnis zu den Kosten des Unternehmens; keine feste Mindestsumme", "9 FAM 402.9-6(D)"],
        ["Nicht marginal", "Mehr als ein minimaler Lebensunterhalt für die Familie oder ein erheblicher wirtschaftlicher Beitrag", "9 FAM 402.9-6(E); 22 CFR 41.51(b)(10)"],
        ["Entwickeln und lenken", "In der Regel mindestens 50 Prozent Eigentum des Investors oder die operative Kontrolle", "9 FAM 402.9-6(F); 22 CFR 41.51(b)(11)"],
        ["Leitende Stellung", "Führungs- oder Aufsichtsposition oder für den Betrieb unverzichtbare Fachkenntnisse", "9 FAM 402.9-7(B), 402.9-7(C)"],
        ["Ausreiseabsicht", "Die Absicht, die USA bei Ende des Status zu verlassen", "9 FAM 402.9-4(C)"],
      ],
      fuss: ["Ein eigenes Büro ist keine Voraussetzung. Das Konsulat kann es bei seiner Entscheidung berücksichtigen (9 FAM 402.9-4(D))."],
    },
    {
      typ: "text", id: "investition", h2: "Die Investition: was „erheblich“ heißt",
      absaetze: [
        "Eine feste Dollarsumme, ab der eine Investition als erheblich gilt, gibt es nicht. Das Handbuch des Außenministeriums sagt das ausdrücklich (9 FAM 402.9-6(D)). Das Konsulat misst den Betrag Ihrer Investition an den Kosten des Unternehmens; das Handbuch nennt das eine umgekehrt gleitende Skala. Je geringer die Kosten des Unternehmens, desto höher muss Ihr Anteil daran sein. Bei einem Unternehmen mit hohen Kosten kann ein kleinerer Anteil genügen. Als Beispiel nennt das Handbuch ein Unternehmen mit Startkosten von 100.000 $, das Sie vollständig selbst finanzieren: Das gilt in der Regel als erheblich. Umgekehrt kann eine Investition von 10 Millionen $ in ein Unternehmen, das 100 Millionen $ kostet, schon wegen ihrer Größe genügen. Als Kosten einer Neugründung gilt, was nötig ist, damit das Unternehmen betriebsbereit ist. Die Verordnung (22 CFR 41.51) und das Handbuch nennen keine Mindestsumme.",
        "Die Mittel müssen Ihnen gehören und unter Ihrer Kontrolle stehen. Sie dürfen aus Ersparnissen, Schenkungen, einer Erbschaft oder anderen legalen Quellen stammen. Dazu zählt ein Darlehen, das mit Ihrem eigenen Vermögen gesichert ist, etwa mit einer Grundschuld auf Ihre eigene Immobilie. Ebenso zählt ein ungesichertes Darlehen auf Ihre persönliche Unterschrift. Darlehen, die durch das Vermögen des Unternehmens gesichert sind, zählen nicht; das gilt auch bei zusätzlichen privaten Sicherheiten. Diesen Darlehen fehlt das Risiko (9 FAM 402.9-6(B)). Ob ein Darlehen eines Instituts an Ihre Gesellschaft mitzählt, hängt deshalb von seiner Sicherheit ab. Das beurteilt das Konsulat; die Einordnung vorab gehört zu einem Anwalt für Einwanderungsrecht. Die Herkunft der Mittel belegen Sie lückenlos.",
        "Investiert heißt: im Risiko und gebunden. Ein Bankguthaben, das Sie jederzeit wieder abziehen könnten, genügt nicht. Eine bloße Absicht genügt ebenso wenig. Wer noch investiert, muss kurz vor dem Beginn des tatsächlichen Geschäftsbetriebs stehen. Verträge zu unterzeichnen oder Standorte zu suchen, reicht dafür nicht. Ein Kauf unter der Bedingung des Visums kann reichen, wenn die Mittel auf einem Treuhandkonto liegen und mit der Erteilung freigegeben werden. Miete und Leasing für Räume oder Geräte zählen nur in Höhe einer Monatszahlung. Eine Jahresmiete zählt nur, wenn sie im Voraus bezahlt ist. Ausstattung und Warenbestand zählen mit ihrem Kaufpreis, sofern sie dem Geschäft dienen und nicht privaten Zwecken.",
      ],
    },
    {
      typ: "text", id: "unternehmen", h2: "Das Unternehmen: echt, tätig, nicht marginal",
      absaetze: [
        "Das Unternehmen muss echt und tätig sein und eine Ware oder Leistung hervorbringen. Unbebautes Land reicht nicht, ebenso wenig Aktien, die Sie nur halten, ohne das Unternehmen zu lenken. Dasselbe gilt für eine Gesellschaft nur auf dem Papier und für gemeinnützige Organisationen (9 FAM 402.9-6(C)). Bei einer Neugründung muss das Konsulat überzeugt sein, dass daraus mit der Erteilung des Visums ein solches Unternehmen wird. Das Unternehmen muss außerdem die rechtlichen Anforderungen an einen Geschäftsbetrieb am Ort seiner Tätigkeit erfüllen (22 CFR 41.51(b)(8)).",
        "Marginal ist ein Unternehmen, das weder heute noch künftig mehr als einen minimalen Lebensunterhalt für den Investor und seine Familie erwirtschaften kann. Ein Unternehmen, das heute oder künftig einen erheblichen wirtschaftlichen Beitrag leisten kann, ist nicht marginal. Den künftigen Ertrag soll es in der Regel innerhalb von fünf Jahren nach Beginn des normalen Geschäftsbetriebs erreichen können (22 CFR 41.51(b)(10)). Zur Akte gehören deshalb ein nachvollziehbarer Geschäftsplan mit Zahlen und die Belege der ersten Schritte.",
        "Die Kontrolle zeigen Sie in der Regel durch mindestens 50 Prozent Eigentum. Auch die operative Leitung kann genügen, etwa über eine Geschäftsführerstellung oder eine andere gesellschaftsrechtliche Gestaltung. Ein Titel ohne tatsächliche Kontrolle reicht nicht. Bei zwei gleichberechtigten Partnern mit je 50 Prozent erkennt das Handbuch in der Regel eine gemeinsame Kontrolle an, wenn beide die vollen Leitungsrechte behalten. Bei mehr als zwei gleichen Partnern begründet das Eigentum allein keine Kontrolle (9 FAM 402.9-6(F)). Der Bundesstaat der Gründung ändert die Staatsangehörigkeit des Unternehmens nicht, ob Florida, Delaware oder Wyoming. Die Staatsangehörigkeit folgt den Eigentümern (9 FAM 402.9-4(B)).",
      ],
    },
    {
      typ: "karten", id: "laender", h2: "Die US-Gesellschaft nach Wohnsitzland", spalten: 3,
      lead: "Gründung, Meldungen und Steuern richten sich auch nach Ihrem Wohnsitzland.",
      karten: [
        { tag: "Deutschland", titel: "US-Firma aus Deutschland", text: "Gründung, Meldung nach § 138 AO und Steuerpflicht in Deutschland.", pfad: "/business/aus-deutschland" },
        { tag: "Österreich", titel: "US-Firma aus Österreich", text: "Gründung und die Regeln für Unternehmer aus Österreich.", pfad: "/business/aus-oesterreich" },
        { tag: "Schweiz", titel: "US-Firma aus der Schweiz", text: "Gründung und Pflichten für Unternehmer aus der Schweiz.", pfad: "/business/aus-der-schweiz" },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "Der Antrag in sechs Schritten",
      lead: "Wer sich außerhalb der USA aufhält, stellt den Antrag beim US-Konsulat oder bei der Botschaft. Der Antrag bei USCIS mit Form I-129 setzt voraus, dass Sie sich bereits rechtmäßig mit einem anderen Nichteinwanderer-Status in den USA aufhalten.",
      etappen: [
        { titel: "Gesellschaft aufbauen", dauer: "vor dem Antrag", text: "Gründung beim Bundesstaat, Steuernummer der Gesellschaft (EIN) und Operating Agreement, der Gesellschaftsvertrag mit den Eigentumsverhältnissen. Dazu der Antrag auf ein Geschäftskonto; über das Konto entscheidet das jeweilige Institut." },
        { titel: "Investition tätigen", dauer: "vor dem Antrag", text: "Mittel einzahlen und binden: Verträge, Rechnungen, Ausstattung und Warenbestand. Jeder Vorgang ist belegt und der Gesellschaft zugeordnet." },
        { titel: "Akte zusammenstellen", dauer: "vor dem Antrag", text: "Nachweise zu Staatsangehörigkeit, Eigentum, Investition und Herkunft der Mittel, dazu der Geschäftsplan. Das Handbuch nennt eine Liste möglicher Unterlagen (9 FAM 402.9-11(B)). Ungeprüfte Zahlen, die allein auf Ihren eigenen Angaben beruhen, genügen in der Regel nicht (9 FAM 402.9-6(D))." },
        { titel: "Formular DS-160", dauer: "online", text: "Der Investor beantwortet die Fragen des Formulars DS-156-E direkt im DS-160. Mitarbeiter reichen das Formular DS-156-E zusätzlich ein." },
        { titel: "Gespräch beim Konsulat", dauer: "persönlich", text: "Antragsteller zwischen 14 und 79 Jahren sprechen in der Regel persönlich vor (22 CFR 41.102). Das Konsulat kann jede weitere Unterlage verlangen." },
        { titel: "Entscheidung und Einreise", dauer: "nach dem Gespräch", text: "Über das Visum entscheidet das Konsulat. Mit einem Visum beantragen Sie die Einreise an der Grenze; über die Zulassung entscheidet dort die Grenzbehörde CBP." },
      ],
    },
    {
      typ: "text", id: "laufzeit", h2: "Laufzeit, Verlängerung und Familie",
      absaetze: [
        "Das Visum und die Dauer des Aufenthalts haben je eine eigene Frist. Das Visum im Pass bestimmt, bis wann Sie einreisen können. Seine Gültigkeit richtet sich nach dem Gegenseitigkeitsplan des Außenministeriums für Ihre Staatsangehörigkeit. Wie lange Sie bleiben dürfen, bestimmt die Zulassung bei der Einreise: beim ersten Mal höchstens zwei Jahre. Verlängerungen sind jeweils um höchstens zwei Jahre möglich; ihre Anzahl ist nicht begrenzt (USCIS). Wer ins Ausland reist und wieder einreist, erhält in der Regel einen neuen Zeitraum von zwei Jahren, wenn die Grenzbehörde ihn zulässt.",
        "Die Voraussetzungen gelten für die Dauer des Status fort. Das Unternehmen muss tätig und mehr als marginal bleiben; seine Staatsangehörigkeit muss erhalten bleiben. Die Absicht zur Ausreise am Ende des Status bleibt Gegenstand jedes Antrags. Ist die Investition einmal als erheblich anerkannt, wird dieser Punkt in der Regel nicht erneut beurteilt, solange die Eigentumsverhältnisse gleich bleiben (9 FAM 402.9-6(D)). Manche Konsulate führen ein Register der Unternehmen, die sie schon einmal anerkannt haben. Dort ist eine Überprüfung in der Regel mindestens alle fünf Jahre vorgesehen (9 FAM 402.9-7(D)).",
        "Ehepartner und ledige Kinder unter 21 Jahren können denselben Status erhalten. Ihre Staatsangehörigkeit muss nicht mit Ihrer übereinstimmen. Der Ehepartner darf in den USA arbeiten: Die Erlaubnis folgt aus dem Status, und sein Einreisebeleg (Form I-94) trägt dafür den Vermerk E-2S. Kinder mit dem Vermerk E-2Y dürfen nicht arbeiten (9 FAM 402.9-9). Mitarbeiter der Gesellschaft können ein E-2-Visum erhalten, wenn sie Ihre Staatsangehörigkeit haben. Sie kommen als Führungskraft, als Aufsicht oder mit unverzichtbaren Fachkenntnissen.",
      ],
    },
    {
      typ: "text", id: "grenzen", h2: "E2 Visum: Ablehnung und Green Card",
      absaetze: [
        "Lehnt das Konsulat ein Visum ab, muss sich die Ablehnung auf eine gesetzliche Grundlage stützen. Das Konsulat nennt Ihnen den Grund, soweit das Gesetz die Mitteilung nicht ausschließt. Es sagt auch, ob sich der Grund ausräumen lässt. Jede Ablehnung überprüft das Konsulat intern (22 CFR 41.121). Lässt sich ein Grund mit weiteren Nachweisen beheben, können Sie diese nachreichen. Beim E-2-Antrag betreffen solche Nachweise die Prüfpunkte dieser Seite: gebundene Mittel, ihre belegte Herkunft und den Geschäftsplan. Der Plan zeigt, dass das Unternehmen mehr als marginal wird. Jeder Punkt gehört deshalb belegt in die Akte, bevor das Gespräch stattfindet.",
        "Das Gesetz führt das E-2-Visum bei den Nichteinwanderern (8 U.S.C. § 1101(a)(15)(E)). Es wird nicht von selbst zur Green Card. Wer zugleich Begünstigter eines Einwanderungsantrags ist, muss das Konsulat überzeugen, dass er die USA am Ende seines Aufenthalts verlassen will (9 FAM 402.9-4(C)). Wer dauerhaft auswandern möchte, klärt diese Frage vor der Gründung der Gesellschaft mit einem Anwalt für Einwanderungsrecht.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Steuern beim Umzug: zwei Staaten",
      absaetze: [
        "Ein Visum ist kein Steuermodell. Solange Sie Ihre US-Gesellschaft von Deutschland aus führen, liegt dort ihre Geschäftsleitung (§ 10 AO). Gilt sie als Körperschaft, ist sie dort unbeschränkt körperschaftsteuerpflichtig (§ 1 KStG). Die Beteiligung teilen Sie dem Finanzamt mit der Steuererklärung mit (§ 138 AO).",
        "Ziehen Sie in die USA, gelten Sie dort in der Regel als steuerlich ansässig, wenn Sie den Substantial Presence Test erfüllen. Der Test verlangt mindestens 31 Tage im laufenden Jahr und 183 Tage über drei Jahre. Die Tage der beiden Vorjahre zählen dabei nur zu einem Drittel und zu einem Sechstel. Die IRS nennt Ausnahmen, etwa bei engerer Verbindung zu einem anderen Land. Ansässige unterliegen mit ihrem Welteinkommen der US-Steuer (IRS).",
        "In Deutschland kann der Wegzug selbst eine Steuer auslösen. Betroffen ist, wer Anteile an einer Kapitalgesellschaft im Sinne des § 17 EStG hält. Weitere Voraussetzung: Er war in den letzten zwölf Jahren mindestens sieben Jahre unbeschränkt steuerpflichtig. Das Gesetz behandelt ihn beim Wegzug, als hätte er die Anteile verkauft (§ 6 AStG). Je nach Einordnung können dazu auch die Anteile an Ihrer US-Gesellschaft gehören. Welcher Staat welche Einkünfte besteuert, regelt das Doppelbesteuerungsabkommen. Österreich und die Schweiz haben eigene Regeln. Steuerfragen gehören vor dem Umzug zu einem Steuerberater.",
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "E2 Visum: wer was verantwortet",
      lead: "Gesellschaft, Visumsantrag und Entscheidung haben je eine eigene Zuständigkeit.",
      fiaon: [
        "Anmeldung der US-Gesellschaft beim Bundesstaat, Staatsgebühr enthalten",
        "Operating Agreement und Gründungsunterlagen; Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "Die erste jährliche US-Meldung Ihrer Gesellschaft",
        "Kontoanträge und, auf Wunsch, Kreditkartenanträge: jeder Antrag vollständig vorbereitet",
        "Die Unterlagen Ihrer Gesellschaft, geordnet in Ihrem Portal",
      ],
      partner: [
        weitererSatz("ROLLEN", "de"),
        "Steuerfragen im Wohnsitzland, auch vor einem geplanten Umzug: Partner-Steuerberater, in eigener Verantwortung",
        "Visumsantrag und Fragen des Einwanderungsrechts: Partner-Anwälte für Einwanderungsrecht, in eigener Verantwortung; das Honorar dafür vereinbaren Sie mit dem Anwalt selbst",
      ],
      sie: [
        "Die Investition aus eigenen, belegten Mitteln",
        "Geschäftsplan und Entscheidungen im Unternehmen",
        "Die Anträge bei den Instituten selbst stellen; über Konto, Karte und Rahmen entscheidet das jeweilige Institut",
        "Formular DS-160 und das Gespräch beim Konsulat; über das Visum entscheidet das Konsulat",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        `${GRUENDUNG.satz} ${UNTERLAGEN.satz}`,
        "Eigentum und Leitung der Gesellschaft stehen im Operating Agreement. Beides prüft das Konsulat bei einem Antrag auf ein E2 Visum.",
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        "Visum: Der Antrag ist nicht Teil Ihres Mandats. Fragen des Einwanderungsrechts liegen bei Partner-Anwälten, in eigener Verantwortung.",
        `${TEIL.bedingung}: ${satz("S3", "de")} Über das Visum entscheidet allein die US-Behörde.`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: `${P.karteLead} ${weitererSatz("MIAMI", "de")}`, paket: "global_vip" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Über jeden Antrag entscheidet allein die US-Behörde: das Konsulat, bei einem Antrag im Inland USCIS. Über die Zulassung bei der Einreise entscheidet die Grenzbehörde. Eine Zusage zu Visum, Laufzeit oder Verlängerung kann niemand geben.",
        "Der Visumsantrag ist nicht Teil Ihres Mandats. FIAON leistet keine Rechtsdienstleistungen, auch nicht im Einwanderungsrecht. Antrag und Einzelfall liegen bei Partner-Anwälten für Einwanderungsrecht; sie arbeiten in eigener Verantwortung. Das Honorar dafür vereinbaren Sie mit dem Anwalt selbst.",
        "Eine US-Gesellschaft gibt kein Recht, in den USA zu wohnen oder zu arbeiten. Auch die ITIN erlaubt keine Arbeit.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        `${KEINE_BANK} ${KEINE_KREDITE} ${satz("S9", "de")} ${satz("S1", "de")}`,
        "Stand der Vorschriften: Oktober 2026. Regeln und Gebühren können sich ändern. Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.",
      ],
    },
  ],
  fragen: [
    { f: "Welche Voraussetzungen hat das E2 Visum?", a: "Das Handbuch des US-Außenministeriums nennt neun Punkte (9 FAM 402.9-6). Dazu gehören die Staatsangehörigkeit eines Vertragsstaats, eine erhebliche Investition eigener Mittel im Risiko und ein Unternehmen, das echt, tätig und mehr als marginal ist. Mindestens 50 Prozent des Unternehmens gehören Staatsangehörigen des Vertragsstaats. Sie lenken das Unternehmen und erklären die Absicht, die USA am Ende des Status zu verlassen. Die Beweislast liegt beim Antragsteller." },
    { f: "Können Deutsche, Österreicher und Schweizer ein E2 Visum beantragen?", a: "Ja. Deutschland, Österreich und die Schweiz stehen in der Liste der Vertragsstaaten des US-Außenministeriums, jeweils für E-1 und E-2. Maßgeblich ist die Staatsangehörigkeit, nicht der Wohnsitz. Über jeden Antrag entscheidet das Konsulat." },
    { f: "Wie viel muss ich für ein E2 Visum investieren?", a: "Eine feste Mindestsumme gibt es nicht. Das Konsulat misst Ihre Investition an den Kosten des Unternehmens: Je geringer diese Kosten, desto höher muss Ihr Anteil daran sein. Bei Startkosten von 100.000 $, die Sie vollständig selbst finanzieren, gilt die Investition nach dem Handbuch in der Regel als erheblich." },
    { f: "Reicht eine US-LLC für das E2 Visum?", a: "Eine LLC kann das Unternehmen im Sinne der Regeln sein; die Gründung allein genügt aber nicht. Hinzu kommen eine gebundene Investition, ein tätiges Geschäft, das mehr als marginal ist, und Ihre Kontrolle. Der Besitz einer Gesellschaft gibt kein Recht, in den USA zu wohnen oder zu arbeiten." },
    { f: "Wie lange gilt das E2 Visum?", a: "Die Zulassung bei der Einreise gilt jeweils für höchstens zwei Jahre. Verlängerungen um jeweils höchstens zwei Jahre sind möglich; ihre Anzahl ist nicht begrenzt. Wie lange das Visum im Pass gilt, richtet sich nach dem Gegenseitigkeitsplan für Ihre Staatsangehörigkeit. Das E-2-Visum ist keine Green Card und wird nicht von selbst zu einer." },
    { f: "Darf mein Ehepartner mit dem E2 Visum arbeiten?", a: "Ja. Der Ehepartner eines E-2-Investors ist mit seinem Status zur Arbeit berechtigt; der Einreisebeleg trägt den Vermerk E-2S. Ledige Kinder unter 21 Jahren können denselben Status erhalten, dürfen aber nicht arbeiten." },
    { f: "Was kostet der Antrag beim Konsulat?", a: "Die Gebührenordnung des Außenministeriums nennt für E-Visa eine Antragsgebühr von 315 $ (22 CFR 22.1, Stand Oktober 2026). Je nach Staatsangehörigkeit kann eine Ausstellungsgebühr nach dem Grundsatz der Gegenseitigkeit hinzukommen. Weitere gesetzliche Gebühren sind möglich. Das Honorar eines Anwalts für Einwanderungsrecht vereinbaren Sie mit ihm selbst." },
    { f: "Übernimmt FIAON den Visumsantrag?", a: "Nein. Der Visumsantrag ist nicht Teil Ihres Mandats. FIAON Global gründet die US-Gesellschaft und holt ihre Unterlagen ein. Fragen des Einwanderungsrechts liegen bei Partner-Anwälten; sie arbeiten in eigener Verantwortung. Über das Visum entscheidet allein die US-Behörde." },
  ],
  paket: "global_vip",
  weiter: ["/business/miami", "/business/wissen/markteintritt-usa", "/business/wissen/us-llc-wohnsitz-deutschland", "/business/aus-oesterreich"],
  quellen: [
    QUELLEN.fam,
    QUELLEN.cfr4151,
    QUELLEN.usc1101,
    QUELLEN.uscisE2,
    QUELLEN.cfr41102,
    QUELLEN.cfr221,
    QUELLEN.cfr41121,
    QUELLEN.cbpVwp,
    Q.itinUebersicht,
    QUELLEN.irsSpt,
    QUELLEN.irsResident,
    QUELLEN.astg6,
    QUELLEN.ao10,
    QUELLEN.kstg1,
    Q.ao138,
    Q.dba,
  ],
};
