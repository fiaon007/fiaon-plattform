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
// Visa sind nicht Teil der Pakete (zielgruppen.ts) — der Antrag gehört dem Partner-Anwalt.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
import { GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q } from "../fakten";

const S = "2026-10-27";
const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? `${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}` : undefined;

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
    beschreibung: "E2 Visum für Deutsche, Österreicher und Schweizer: Voraussetzungen, Kosten, Ablauf beim Konsulat, Laufzeit, Familie und die Rolle der US-Firma.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 51",
  auge: "Wissen · Investorenvisum USA",
  h1: "Das E2 Visum.",
  h1b: "Ihre US-Firma als Grundlage.",
  lead: "Das E2 Visum (E-2 Treaty Investor) erlaubt Staatsangehörigen bestimmter Vertragsstaaten, in den USA ein Unternehmen aufzubauen und zu lenken, in das sie erheblich investiert haben. Deutschland, Österreich und die Schweiz gehören dazu. Hier stehen die Voraussetzungen nach dem Handbuch des US-Außenministeriums, der Ablauf beim Konsulat, Laufzeit und Familie — und wie eine sauber aufgebaute US-Gesellschaft die Grundlage bildet.",
  ziffern: [
    { wert: "50 %", label: "des Unternehmens mindestens in der Hand von Staatsangehörigen des Vertragsstaats" },
    { wert: "2 Jahre", label: "Aufenthalt höchstens je Zulassung, verlängerbar ohne Obergrenze der Anzahl" },
    { wert: "5 Jahre", label: "in der Regel der Zeitraum, in dem das Unternehmen mehr als einen minimalen Lebensunterhalt tragen soll" },
  ],
  blick: [
    ["Was es ist", "Visum für Investoren aus Vertragsstaaten, keine Green Card"],
    ["Vertragsstaaten", "Deutschland, Österreich und die Schweiz"],
    ["Investition", "Erheblich im Verhältnis zu den Kosten, eigenes Kapital im Risiko"],
    ["Unternehmen", "Echt, tätig und mehr als marginal"],
    ["Kontrolle", "In der Regel mindestens 50 % Eigentum oder die operative Leitung"],
    ["Familie", "Ehepartner und ledige Kinder unter 21 Jahren"],
    ["Mit FIAON Global", "Gesellschaft, EIN und geordnete Belege mit Ihrer Vollmacht; das Visum beantragt der Partner-Anwalt"],
  ],
  kurz: "Das E2 Visum steht Staatsangehörigen von Vertragsstaaten offen; Deutschland, Österreich und die Schweiz gehören dazu. Nach dem Handbuch des US-Außenministeriums (9 FAM 402.9) braucht es eine erhebliche Investition eigener Mittel, die im Risiko steht und unwiderruflich gebunden ist, ein echtes, tätiges Unternehmen, das mehr als nur einen minimalen Lebensunterhalt der Familie trägt, mindestens 50 Prozent des Unternehmens in der Hand von Staatsangehörigen des Vertragsstaats, Ihre Kontrolle über das Unternehmen und die Absicht, die USA am Ende des Status zu verlassen. Eine feste Mindestsumme gibt es nicht. Beantragt wird beim US-Konsulat, das allein entscheidet.",
  bloecke: [
    {
      typ: "text", id: "was-es-ist", h2: "Was das E2 Visum ist — und was nicht",
      absaetze: [
        "Das E-2-Visum ist ein Visum für einen vorübergehenden Aufenthalt. Das US-Einwanderungsgesetz sieht es für Staatsangehörige eines Landes vor, mit dem die USA einen Handels- und Schifffahrtsvertrag geschlossen haben, und zwar für den Investor, der ein Unternehmen entwickeln und lenken will, in das er einen erheblichen Betrag investiert hat oder gerade investiert (8 U.S.C. § 1101(a)(15)(E)(ii)). Gleichwertige Verträge zählen ebenso (22 CFR 41.51(b)(5)). Nach der Verordnung können auch Mitarbeiter derselben Staatsangehörigkeit ein E-2-Visum erhalten, wenn sie als Führungskraft, Aufsicht oder mit unverzichtbaren Fachkenntnissen tätig werden (22 CFR 41.51(b)(2)).",
        "Eine Green Card ist es nicht. Wer das Visum beantragt, muss die Absicht erklären, die USA am Ende des Status zu verlassen. Einen Wohnsitz in der Heimat muss er dafür nicht behalten: Nach dem Handbuch des Außenministeriums darf er seine Wohnung verkaufen und den Hausstand in die USA bringen (9 FAM 402.9-4(C)).",
        "Eine US-Gesellschaft zu besitzen, gibt für sich genommen kein Recht, in den USA zu wohnen oder zu arbeiten. Auch die ITIN, Ihre persönliche Steuernummer bei der IRS, ändert keinen Aufenthaltsstatus und erlaubt keine Arbeit. Für Gespräche, Messen und Termine reisen Staatsangehörige der Teilnehmerländer im Visa Waiver Program mit ESTA für geschäftliche Aufenthalte von höchstens 90 Tagen ohne Visum ein. Wer die Gesellschaft dauerhaft vor Ort aufbauen und führen will, braucht ein Visum — für Investoren aus Vertragsstaaten kommt dafür das E-2-Visum in Betracht.",
      ],
    },
    {
      typ: "tabelle", id: "vertragsstaaten", h2: "E2 Visum für Deutschland, Österreich und die Schweiz",
      lead: "Alle drei Länder stehen in der Liste der Vertragsstaaten des US-Außenministeriums, jeweils für E-1 (Handel) und E-2 (Investition).",
      kopf: ["Staatsangehörigkeit", "E-1 in Kraft seit", "E-2 in Kraft seit"],
      zeilen: [
        ["Deutschland", "14.07.1956", "14.07.1956"],
        ["Österreich", "27.05.1931", "27.05.1931"],
        ["Schweiz", "08.11.1855", "08.11.1855"],
      ],
      fuss: [
        "Quelle: 9 FAM 402.9-10, Fassung vom 17.02.2026. Maßgeblich ist die Staatsangehörigkeit, nicht der Wohnsitz und nicht der Ort, an dem die Gesellschaft gegründet ist (9 FAM 402.9-4(B)). Eine Ausnahme nennt das Gesetz: Wer die Staatsangehörigkeit durch eine Investition erworben und den E-Status noch nie erhalten hat, muss irgendwann vor dem Antrag mindestens drei Jahre ununterbrochen in diesem Land gewohnt haben (8 U.S.C. § 1101(a)(15)(E)).",
        "Wer zwei Staatsangehörigkeiten hat, wählt für das Unternehmen eine davon; Inhaber und alle E-Mitarbeiter treten dann mit dieser Staatsangehörigkeit auf. Anteile von Inhabern einer Green Card zählen bei der Staatsangehörigkeit des Unternehmens nicht mit.",
      ],
    },
    {
      typ: "tabelle", id: "voraussetzungen", h2: "E2 Visum: die Voraussetzungen im Überblick",
      lead: "Diese neun Punkte prüft das Konsulat bei einem E-2-Antrag; in dieser Reihenfolge nennt sie das Handbuch (9 FAM 402.9-6(A)). Die Beweislast liegt beim Antragsteller (9 FAM 402.9-2).",
      kopf: ["Voraussetzung", "Was das Konsulat prüft", "Fundstelle"],
      zeilen: [
        ["Vertragsstaat", "Zwischen den USA und Ihrem Land besteht ein passender Vertrag", "9 FAM 402.9-4(A), 402.9-10"],
        ["Staatsangehörigkeit", "Investor und Unternehmen haben die Staatsangehörigkeit des Vertragsstaats; beim Unternehmen zählen die Eigentümer, mindestens 50 Prozent", "9 FAM 402.9-4(B), 402.9-6(F)"],
        ["Investition", "Eigene Mittel, im Risiko, unwiderruflich gebunden, aus legaler Herkunft", "9 FAM 402.9-6(B); 22 CFR 41.51(b)(7)"],
        ["Echtes Unternehmen", "Tätig und auf Gewinn ausgerichtet, liefert Waren oder Leistungen, erfüllt die rechtlichen Anforderungen vor Ort; keine Papiergesellschaft", "9 FAM 402.9-6(C); 22 CFR 41.51(b)(8)"],
        ["Erhebliche Summe", "Im Verhältnis zu den Kosten des Unternehmens; keine feste Mindestsumme", "9 FAM 402.9-6(D)"],
        ["Nicht marginal", "Mehr als ein minimaler Lebensunterhalt für die Familie oder ein erheblicher wirtschaftlicher Beitrag", "9 FAM 402.9-6(E); 22 CFR 41.51(b)(10)"],
        ["Entwickeln und lenken", "In der Regel mindestens 50 Prozent Eigentum des Investors oder die operative Kontrolle", "9 FAM 402.9-6(F); 22 CFR 41.51(b)(11)"],
        ["Leitende Stellung", "Führungs- oder Aufsichtsposition oder für den Betrieb unverzichtbare Fachkenntnisse", "9 FAM 402.9-7(B), 402.9-7(C)"],
        ["Ausreiseabsicht", "Die Absicht, die USA bei Ende des Status zu verlassen", "9 FAM 402.9-4(C)"],
      ],
      fuss: ["Ein eigenes Büro ist keine Voraussetzung, kann bei der Prüfung aber eine Rolle spielen (9 FAM 402.9-4(D))."],
    },
    {
      typ: "text", id: "investition", h2: "Die Investition: was „erheblich“ heißt",
      absaetze: [
        "Eine feste Dollarsumme, ab der eine Investition als erheblich gilt, gibt es nicht. Das Handbuch des Außenministeriums sagt das ausdrücklich (9 FAM 402.9-6(D)). Geprüft wird im Verhältnis: Der Betrag Ihrer Investition wird an den Kosten des Unternehmens gemessen, wie auf einer umgekehrt gleitenden Skala. Je günstiger das Unternehmen, desto höher muss Ihr Anteil an den Kosten sein; bei einem sehr teuren Unternehmen kann ein kleinerer Anteil genügen. Als Beispiel nennt das Handbuch ein Unternehmen mit Startkosten von 100.000 $, das Sie vollständig selbst finanzieren — das gilt in der Regel als erheblich. Am anderen Ende kann eine Investition von 10 Millionen $ in ein Unternehmen, das 100 Millionen $ kostet, schon wegen ihrer Größe genügen. Als Kosten einer Neugründung gilt, was nötig ist, damit das Unternehmen betriebsbereit ist. Feste Mindestsummen, die im Internet kursieren, stehen weder in der Verordnung (22 CFR 41.51) noch im Handbuch.",
        "Die Mittel müssen Ihnen gehören und unter Ihrer Kontrolle stehen. Sie dürfen aus Ersparnissen, Schenkungen, einer Erbschaft oder anderen legalen Quellen stammen, auch aus einem Darlehen, das mit Ihrem eigenen Vermögen gesichert ist, etwa einer Grundschuld auf Ihre eigene Immobilie, oder aus einem ungesicherten Darlehen auf Ihre persönliche Unterschrift. Darlehen, die durch das Vermögen des Unternehmens gesichert sind, zählen dagegen nicht, auch wenn zusätzlich private Sicherheiten gestellt werden: Bei ihnen fehlt das Risiko (9 FAM 402.9-6(B)). Ob ein Rahmen, den Ihre Gesellschaft von einem Institut erhält, mitzählen kann, hängt deshalb davon ab, womit er gesichert ist — das prüft der Partner-Anwalt im Einzelfall. Die Herkunft der Mittel belegen Sie lückenlos.",
        "Investiert heißt: im Risiko und gebunden. Ein Guthaben auf dem Konto, das Sie jederzeit wieder abziehen könnten, genügt nicht; eine bloße Absicht ebenso wenig. Wer noch im Investieren ist, muss kurz vor dem Start des tatsächlichen Geschäftsbetriebs stehen; Verträge zu unterschreiben oder Standorte zu suchen, reicht dafür nicht. Ein Kauf, der unter der Bedingung des Visums steht, kann reichen, wenn die Mittel auf einem Treuhandkonto liegen und mit der Erteilung freigegeben werden. Miete und Leasing für Räume oder Geräte zählen nur in Höhe einer Monatszahlung, die Jahresmiete nur, wenn sie im Voraus bezahlt ist; Ausstattung und Warenbestand zählen mit ihrem Kaufpreis, sofern sie dem Geschäft dienen und nicht privaten Zwecken.",
      ],
    },
    {
      typ: "text", id: "unternehmen", h2: "Das Unternehmen: echt, tätig, mehr als marginal",
      absaetze: [
        "Das Unternehmen muss ein echtes, tätiges Unternehmen sein, das eine Ware oder Leistung hervorbringt. Unbebautes Land, Aktien, die Sie nur halten, ohne das Unternehmen zu lenken, oder eine Gesellschaft nur auf dem Papier reichen nicht, ebenso wenig gemeinnützige Organisationen (9 FAM 402.9-6(C)). Bei einer Neugründung muss das Konsulat überzeugt sein, dass daraus ein solches Unternehmen wird, sobald das Visum erteilt ist. Dazu muss es die rechtlichen Anforderungen an einen Geschäftsbetrieb an dem Ort erfüllen, an dem es tätig ist (22 CFR 41.51(b)(8)).",
        "Marginal ist ein Unternehmen, das weder heute noch künftig mehr als einen minimalen Lebensunterhalt für den Investor und seine Familie erwirtschaften kann. Wer heute oder künftig einen erheblichen wirtschaftlichen Beitrag leisten kann, ist nicht marginal. Dieser künftige Ertrag soll in der Regel innerhalb von fünf Jahren nach Beginn des normalen Geschäftsbetriebs erreichbar sein (22 CFR 41.51(b)(10)). Deshalb gehören ein nachvollziehbarer Geschäftsplan mit Zahlen und die Belege der ersten Schritte in jede Akte.",
        "Die Kontrolle zeigen Sie in der Regel durch mindestens 50 Prozent Eigentum. Auch die operative Leitung über eine Geschäftsführerstellung oder eine andere gesellschaftsrechtliche Gestaltung kann genügen; ein bloßer Titel ohne tatsächliche Kontrolle reicht nicht. Bei zwei gleichberechtigten Partnern mit je 50 Prozent erkennt das Handbuch in der Regel eine gemeinsame Kontrolle an, wenn beide die vollen Leitungsrechte behalten; bei mehr als zwei gleichen Partnern begründet das Eigentum allein keine Kontrolle (9 FAM 402.9-6(F)). Wo Sie gegründet haben — Florida, Delaware oder Wyoming —, spielt für die Staatsangehörigkeit des Unternehmens keine Rolle: Sie folgt den Eigentümern (9 FAM 402.9-4(B)).",
      ],
    },
    {
      typ: "karten", id: "laender", h2: "Die US-Firma je nach Herkunft", spalten: 3,
      lead: "Gründung, Meldungen und Steuern hängen auch davon ab, wo Sie heute leben.",
      karten: [
        { tag: "Deutschland", titel: "US-Firma aus Deutschland", text: "Gründung, Meldung nach § 138 AO und die Steuerpflicht zu Hause.", pfad: "/business/aus-deutschland" },
        { tag: "Österreich", titel: "US-Firma aus Österreich", text: "Der Weg für österreichische Unternehmer und die Regeln dort.", pfad: "/business/aus-oesterreich" },
        { tag: "Schweiz", titel: "US-Firma aus der Schweiz", text: "Gründung und Pflichten für Unternehmer aus der Schweiz.", pfad: "/business/aus-der-schweiz" },
      ],
    },
    {
      typ: "etappen", id: "ablauf", h2: "Der Ablauf beim Konsulat in sechs Schritten",
      lead: "Aus Deutschland, Österreich oder der Schweiz führt der Weg über das US-Konsulat oder die Botschaft. Über USCIS mit Form I-129 geht es nur, wenn Sie sich bereits rechtmäßig mit einem anderen Nichteinwanderer-Status in den USA aufhalten; wer im Ausland ist, kann diesen Weg nicht nutzen.",
      etappen: [
        { titel: "Gesellschaft aufbauen", dauer: "vor dem Antrag", text: "Gründung beim Bundesstaat, EIN, Operating Agreement mit klaren Eigentumsverhältnissen, Antrag auf ein Geschäftskonto — über das Konto entscheidet das Institut." },
        { titel: "Investition tätigen", dauer: "vor dem Antrag", text: "Mittel einzahlen und binden: Verträge, Rechnungen, Ausstattung, Warenbestand — alles belegt und auf die Gesellschaft bezogen." },
        { titel: "Akte zusammenstellen", dauer: "vor dem Antrag", text: "Nachweise zu Staatsangehörigkeit, Eigentum, Investition und Herkunft der Mittel, dazu der Geschäftsplan; das Handbuch nennt eine Liste möglicher Unterlagen (9 FAM 402.9-11(B)). Ungeprüfte Zahlen, die allein auf Ihren eigenen Angaben beruhen, genügen in der Regel nicht (9 FAM 402.9-6(D))." },
        { titel: "Formular DS-160", dauer: "online", text: "Der Investor beantwortet die Fragen des Formulars DS-156-E direkt im DS-160; Mitarbeiter reichen DS-156-E zusätzlich ein." },
        { titel: "Gespräch beim Konsulat", dauer: "persönlich", text: "Antragsteller zwischen 14 und 79 Jahren sprechen in der Regel persönlich vor (22 CFR 41.102). Das Konsulat kann jede weitere Unterlage verlangen." },
        { titel: "Entscheidung und Einreise", dauer: "nach dem Gespräch", text: "Mit dem Visum beantragen Sie die Einreise an der Grenze; dort entscheidet die Grenzbehörde CBP über die Zulassung." },
      ],
    },
    {
      typ: "text", id: "laufzeit", h2: "Laufzeit, Verlängerung und Familie",
      absaetze: [
        "Zwei Fristen sind auseinanderzuhalten. Das Visum im Pass bestimmt, bis wann Sie einreisen können; wie lange es ausgestellt wird, richtet sich nach dem Gegenseitigkeitsplan des Außenministeriums für Ihre Staatsangehörigkeit. Wie lange Sie bleiben dürfen, bestimmt die Zulassung bei der Einreise: höchstens zwei Jahre beim ersten Mal. Verlängerungen sind jeweils um höchstens zwei Jahre möglich, eine Obergrenze für ihre Anzahl gibt es nicht (USCIS). Wer ins Ausland reist und wieder einreist, erhält in der Regel einen neuen Zeitraum von zwei Jahren, wenn die Grenzbehörde ihn zulässt.",
        "Die Voraussetzungen gelten fort. Das Unternehmen muss tätig und mehr als marginal bleiben, die Staatsangehörigkeit des Unternehmens muss erhalten bleiben, und die Absicht zur Ausreise am Ende des Status bleibt Teil jeder Prüfung. Ist die Investition einmal als erheblich anerkannt, wird dieser Punkt in der Regel nicht erneut geprüft, solange sich die Eigentumsverhältnisse nicht ändern (9 FAM 402.9-6(D)). Manche Konsulate führen eine Registrierung von Unternehmen, die schon einmal anerkannt wurden; eine Überprüfung ist dort in der Regel mindestens alle fünf Jahre vorgesehen (9 FAM 402.9-7(D)).",
        "Ehepartner und ledige Kinder unter 21 Jahren können denselben Status erhalten; ihre Staatsangehörigkeit muss nicht mit Ihrer übereinstimmen. Der Ehepartner darf in den USA arbeiten — die Erlaubnis folgt aus dem Status, sein Einreisebeleg (Form I-94) trägt dafür den Vermerk E-2S. Kinder mit dem Vermerk E-2Y dürfen nicht arbeiten (9 FAM 402.9-9). Mitarbeiter der Gesellschaft können ein E-2-Visum erhalten, wenn sie Ihre Staatsangehörigkeit haben und als Führungskraft, Aufsicht oder mit unverzichtbaren Fachkenntnissen kommen.",
      ],
    },
    {
      typ: "text", id: "grenzen", h2: "E2 Visum abgelehnt — und was mit der Green Card ist",
      absaetze: [
        "Lehnt das Konsulat ein Visum ab, muss sich die Ablehnung auf eine gesetzliche Grundlage stützen. Das Konsulat nennt Ihnen den Grund, soweit das Gesetz die Mitteilung nicht ausschließt, und sagt, ob es einen Weg gibt, ihn auszuräumen; jede Ablehnung wird innerhalb des Konsulats überprüft (22 CFR 41.121). Lässt sich ein Grund mit weiteren Nachweisen beheben, können Sie diese nachreichen. Beim E-2-Antrag betreffen solche Nachweise die Prüfpunkte dieser Seite: gebundene Mittel, ihre belegte Herkunft und einen Geschäftsplan, der zeigt, dass das Unternehmen mehr als marginal wird. Deshalb gehört jeder Punkt vor dem Gespräch belegt in die Akte.",
        "Das E-2-Visum ist ein Visum für einen vorübergehenden Aufenthalt; das Gesetz führt es bei den Nichteinwanderern (8 U.S.C. § 1101(a)(15)(E)). Es wird nicht von selbst zur Green Card. Wer zugleich Begünstigter eines Einwanderungsantrags ist, muss das Konsulat davon überzeugen, dass er die USA am Ende seines Aufenthalts verlassen will (9 FAM 402.9-4(C)). Wer dauerhaft auswandern möchte, klärt seinen Weg deshalb mit dem Partner-Anwalt für Einwanderungsrecht, bevor die Gesellschaft für ein Visum aufgebaut wird.",
      ],
    },
    {
      typ: "text", id: "steuern", h2: "Steuern beim Umzug: zwei Länder, eine Prüfung vorab",
      absaetze: [
        "Ein Visum ist kein Steuermodell. Solange Sie Ihre US-Gesellschaft von Deutschland aus führen, liegt dort ihre Geschäftsleitung (§ 10 AO), und sie ist dort unbeschränkt körperschaftsteuerpflichtig, wenn sie als Körperschaft gilt (§ 1 KStG). Die Beteiligung ist dem Finanzamt mit der Steuererklärung mitzuteilen (§ 138 AO).",
        "Ziehen Sie in die USA, gelten Sie dort in der Regel steuerlich als ansässig, wenn Sie den Substantial Presence Test erfüllen: mindestens 31 Tage im laufenden Jahr und 183 Tage über drei Jahre, wobei die Tage der beiden Vorjahre nur zu einem Drittel und einem Sechstel zählen. Ausnahmen, etwa bei engerer Verbindung zu einem anderen Land, nennt die IRS selbst. Ansässige unterliegen mit ihrem Welteinkommen der US-Steuer (IRS).",
        "In Deutschland kann der Wegzug selbst eine Steuer auslösen: Wer in den letzten zwölf Jahren mindestens sieben Jahre unbeschränkt steuerpflichtig war und Anteile an einer Kapitalgesellschaft im Sinne des § 17 EStG hält, wird beim Wegzug so behandelt, als hätte er sie verkauft (§ 6 AStG). Je nach Einordnung kann dazu auch Ihre US-Gesellschaft gehören. Welcher Staat welche Einkünfte besteuert, regelt das Doppelbesteuerungsabkommen. Österreich und die Schweiz haben eigene Regeln — das alles gehört vor den Umzug auf den Tisch unseres Partner-Steuerberaters, nicht danach.",
      ],
    },
    {
      typ: "rollen", id: "rollen", h2: "Wer was tut auf dem Weg zum E2 Visum",
      lead: "Ein Ansprechpartner statt acht — und eine klare Grenze beim Visum.",
      fiaon: [
        "Gründung der US-Gesellschaft mit Ihrer Vollmacht, Eigentum und Leitung von Anfang an klar geregelt",
        "EIN, D-U-N-S-Nummer, Meldungen der Gesellschaft; ITIN-Antrag vorbereitet",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr",
        "Konto- und Kartenanträge vollständig vorbereitet",
        "Gründungsunterlagen und Belege geordnet im Dokumentenraum, bereit für die Akte des Anwalts",
      ],
      partner: [
        "Partner-Anwalt: Operating Agreement und Gründungsunterlagen",
        "Partner-Steuerberater: Prüfung vor der Gründung, auch mit Blick auf einen geplanten Umzug",
        "US-CPA: die erste jährliche US-Meldung",
        "Partner-Anwalt für Einwanderungsrecht: der Visumsantrag in Ihrem eigenen Mandat, nicht Teil der Pakete",
      ],
      sie: [
        "Die Investition aus eigenen, belegten Mitteln",
        "Geschäftsplan und Entscheidungen im Unternehmen",
        "Konto-, Karten- und Kreditanträge selbst unterschreiben und stellen",
        "Formular DS-160 und das Gespräch beim Konsulat",
      ],
    },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global die Grundlage für Ihr E2 Visum",
      absaetze: [
        "FIAON Global ist die Unternehmensberatung für Ihren Weg in die USA: ein Ansprechpartner statt acht. Mit Ihrer Vollmacht stellen wir die Anträge für Sie — Gründung beim Bundesstaat, EIN, D-U-N-S-Nummer und die Meldungen Ihrer Gesellschaft — und bereiten die ITIN vor. Registered Agent, US-Geschäftsadresse und US-Telefonnummer stellen wir für das erste Jahr. Nur Konto-, Karten- und Kreditanträge stellen Sie selbst; jeden davon bereiten wir vollständig vor.",
        "Für ein späteres E2 Visum bauen wir die Gesellschaft so, dass sie sich belegen lässt: Eigentum und Leitung stehen von Anfang an klar im Operating Agreement, das unser Partner-Anwalt entwirft, Name, Anschrift und Stammdaten der Gesellschaft stimmen in allen Unterlagen überein, und jeder Beleg liegt geordnet in Ihrem Dokumentenraum. Ob Investition und Geschäft für ein Visum genügen, entscheidet das Konsulat. Partner-Steuerberater, US-CPA und Partner-Anwälte arbeiten in Ihrem Mandat; ihre Honorare für die Leistungen Ihres Pakets trägt FIAON.",
        "Den Visumsantrag selbst stellt ein Partner-Anwalt für Einwanderungsrecht in Ihrem eigenen Mandat — er ist nicht Teil der Pakete. Wir stellen den Kontakt her und geben ihm mit Ihrer Zustimmung die Unterlagen der Gesellschaft. Mit Global VIP beginnt der Aufbau persönlich in Miami: Unser Team vor Ort begleitet Ihre Termine bei Behörden und Banken, dazu kommen unser Partnerstandort in Zürich und Ihr Vertragspartner, die FIAON LTD in London. Sie zahlen einen Festpreis, alle Gebühren des Pakets inklusive; ab dem zweiten Jahr ist die Jahresbetreuung freiwillig.",
      ],
      nach: GELD_ZURUECK,
    },
    { typ: "paket", id: "paket", h2: "Global VIP: der Aufbau in Miami, persönlich begleitet", lead: "Alles aus Global Kapital, dazu der Auftakt persönlich in Miami, Termine bei Behörden und Banken gemeinsam mit unserem Team und die Begleitung durch die Geschäftsführung — Global VIP.", paket: "global_vip" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Über jedes Visum entscheidet allein das Konsulat, über die Zulassung bei der Einreise die Grenzbehörde. Eine Zusage zu Visum, Laufzeit oder Verlängerung kann niemand geben.",
        "Der Visumsantrag ist nicht Teil der Pakete. Antrag und Einzelfall gehören in die Hand eines Partner-Anwalts für Einwanderungsrecht, der in Ihrem Mandat arbeitet und sein Honorar mit Ihnen vereinbart.",
        "Eine US-Gesellschaft gibt kein Recht, in den USA zu wohnen oder zu arbeiten; auch die ITIN erlaubt keine Arbeit.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        "FIAON ist keine Bank, vergibt und vermittelt keine Kredite. Der Kapitalrahmen eines Pakets ist ein Ziel, keine Zusage.",
        "Diese Seite gibt die Vorschriften mit Stand Oktober 2026 wieder; Regeln und Gebühren können sich ändern.",
      ],
    },
  ],
  fragen: [
    { f: "Welche Voraussetzungen hat das E2 Visum?", a: "Staatsangehörigkeit eines Vertragsstaats, eine erhebliche Investition eigener Mittel im Risiko, ein echtes, tätiges Unternehmen, das mehr als marginal ist, mindestens 50 Prozent des Unternehmens in der Hand von Staatsangehörigen des Vertragsstaats, Ihre Kontrolle über das Unternehmen und die Absicht, die USA am Ende des Status zu verlassen (9 FAM 402.9-6). Die Beweislast liegt beim Antragsteller." },
    { f: "Können Deutsche, Österreicher und Schweizer ein E2 Visum beantragen?", a: "Ja. Deutschland, Österreich und die Schweiz stehen in der Liste der Vertragsstaaten des US-Außenministeriums, jeweils für E-1 und E-2. Maßgeblich ist die Staatsangehörigkeit, nicht der Wohnsitz. Über den einzelnen Antrag entscheidet das Konsulat." },
    { f: "Wie viel muss ich für ein E2 Visum investieren?", a: "Eine feste Mindestsumme gibt es nicht. Das Konsulat misst Ihre Investition an den Kosten des Unternehmens: Je günstiger das Unternehmen, desto höher muss Ihr Anteil sein. Ein Unternehmen mit Startkosten von 100.000 $, das Sie vollständig selbst finanzieren, gilt nach dem Handbuch in der Regel als erheblich." },
    { f: "Reicht eine US-LLC für das E2 Visum?", a: "Eine LLC kann das Unternehmen sein, die Gründung allein genügt aber nicht. Es braucht eine gebundene Investition, ein tätiges Geschäft, das mehr als marginal ist, und Ihre Kontrolle. Eine Gesellschaft zu besitzen, gibt kein Recht, in den USA zu wohnen oder zu arbeiten." },
    { f: "Wie lange gilt das E2 Visum?", a: "Bei jeder Einreise werden Sie für höchstens zwei Jahre zugelassen; Verlängerungen um jeweils höchstens zwei Jahre sind möglich, ohne Obergrenze ihrer Anzahl. Wie lange das Visum im Pass gilt, richtet sich nach dem Gegenseitigkeitsplan für Ihre Staatsangehörigkeit. Eine Green Card ist das E-2-Visum nicht, und es wird auch nicht von selbst zu einer." },
    { f: "Darf mein Ehepartner mit dem E2 Visum arbeiten?", a: "Ja. Der Ehepartner eines E-2-Investors ist mit seinem Status zur Arbeit berechtigt; der Einreisebeleg trägt den Vermerk E-2S. Ledige Kinder unter 21 Jahren erhalten denselben Status, dürfen aber nicht arbeiten." },
    { f: "Was kostet der Antrag beim Konsulat?", a: "Die Gebührenordnung des Außenministeriums nennt für E-Visa eine Antragsgebühr von 315 $ (22 CFR 22.1, Stand Oktober 2026). Dazu kann je nach Staatsangehörigkeit eine Ausstellungsgebühr nach dem Grundsatz der Gegenseitigkeit kommen; weitere gesetzliche Gebühren sind möglich. Das Honorar des Anwalts für Einwanderungsrecht vereinbaren Sie mit ihm." },
    { f: "Übernimmt FIAON den Visumsantrag?", a: "Nein. Visa sind nicht Teil der Pakete. FIAON Global baut die US-Gesellschaft auf, die die Grundlage bildet, und ordnet ihre Unterlagen; den Antrag stellt ein Partner-Anwalt für Einwanderungsrecht in Ihrem Mandat." },
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
