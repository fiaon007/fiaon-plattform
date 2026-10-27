// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: DIE NACHTEILE EINER US-LLC — OFFEN GESAGT (27.10.2026, E-439)
// FG · 52 · Thema T15 aus .arbeit/recherche/kw_de.md
//
// Die ehrliche Gegenrede zu den Vorteil-Seiten der „steuerfrei“-Szene. Abgrenzung:
// /business/wissen/us-llc-steuern bleibt die Frage „Spart sie Steuern?“,
// /business/wissen/us-llc-wohnsitz-deutschland die Pflichten im Einzelnen — hier
// steht die Abwägung: Nachteile, Strafen, wann sie nicht passt, wann sie sinnvoll ist.
//
// Geprüft am 27.10.2026 an den amtlichen Texten:
//   · gesetze-im-internet.de: § 10, § 42 Abs. 1 und 2, § 138 Abs. 2 und 5, § 379 Abs. 2
//     und 7 AO (Bußgeld höchstens 25.000 Euro); § 1 KStG; § 13b Abs. 7 UStG.
//   · RIS: § 1 Abs. 2 KStG 1988 (Geschäftsleitung oder Sitz im Inland, § 27 BAO).
//   · IRS: Instructions for Form 5472 (25.000 $; nach 90 Tagen ab Mitteilung je
//     angefangene 30 Tage weitere 25.000 $; Einlagen/Entnahmen meldepflichtig; pro forma
//     Form 1120), Single Member LLCs (Einpersonen-LLC transparent, Mehrpersonen-LLC
//     partnership, Wahl per Form 8832), Partnership Withholding (Section 1446),
//     FBAR-Seite der IRS (LLC ist US-Person; 10.000 $; 15. April / 15. Oktober).
//   · Cornell LII: 26 U.S.C. § 1361(b)(1)(C) (keine S-Corporation mit nonresident
//     alien), 31 CFR 1020.220 (CIP: Identifikationsnummer, Pass mit Ausstellerstaat,
//     physischer Standort der Gesellschaft).
//   · myFICO (Mindestanforderungen Score), White House EO 14406 Sec. 3(a)(vi),
//     USCIS E-2 Treaty Investors (substanzielle Investition, nicht marginal),
//     Florida Statutes 2026 § 605.0714 (Auflösung von Amts wegen, sechzig Tage).
// Fachprüfung 27.10.2026 (zweiter Durchgang, alle Quellen geöffnet):
//   · Form 5472: Pflicht hängt am meldepflichtigen Geschäft mit dem Inhaber (Part V: Gründung,
//     Einlagen, Entnahmen), nicht am Umsatz — Text danach genauer gefasst.
//   · § 138 Abs. 2 AO: Nr. 2 (Personengesellschaft, ohne Schwelle) neben Nr. 3 (Körperschaft,
//     10 % oder 150.000 €) und Nr. 4; Abs. 1 meldet an die Gemeinde, nicht ans Finanzamt.
//   · § 379 AO: nur bei Vorsatz oder Leichtfertigkeit. § 42 AO: Wortlaut genauer.
//   · EO 14406 Sec. 3(a)(vi): Auftrag ans Finanzministerium (Advisory), Warnzeichen bei ITIN
//     ohne geprüften Aufenthaltsstatus — kein unmittelbares Bankrecht; Text abgeschwächt.
//   · Florida § 605.0714: Bericht bis 3. Freitag im September, Auflösung am 4. Freitag.
//   · Neu: SBA Procedural Notice 5000-876626 (seit 01.03.2026 nur 100 % US-Eigentümer mit
//     Hauptwohnsitz in den USA), Florida § 605.0304 (Haftungstrennung), Wyoming-FAQ (60 Tage).
//   · BMF-Server (usth.bundesfinanzministerium.de, DBA-PDF) am 27.10.2026 mit 503 nicht
//     erreichbar; BMF-Schreiben 19.03.2004 über BFH I B 75/20 bestätigt, Art. 1 Abs. 7 DBA
//     (transparente Gesellschaften) aus der Neufassung BGBl. 2008 II S. 611 — Quelle bleibt.
// Nicht übernommen (an der Primärquelle nicht prüfbar): FBAR-Pflicht ausdrücklich für
// transparente Einpersonen-LLCs, Strafhöhe beim FBAR, Steuerberaterhonorare in DACH
// als Zahl, „reasonable cause“ als Ausweg bei Form 5472.
// Wortwand: kein „bis zu“ (Bußgeld als „höchstens“), kein Bankname, keine Frist mit
// Ziffer als Zusage, kein Zinssatz, kein Steuerversprechen (Mythos nur in „…“), keine
// Paketpreise als Zahl (Baustein "paket"), kein „Nr. 1“ (Superlativ-Prüfung).
// „Unternehmensberatung“ als Selbstbezeichnung erlaubt seit E-439 (Justin, 27.10.2026).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalQuelle, GlobalSeite } from "../typen";
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_GELD_ZURUECK, GLOBAL_ROLLEN, GLOBAL_NICHT_INKLUSIVE } from "../../fiaon-global";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, STAAT, IRS, MARKT, SCHWELLEN, FRISTEN, FAKTEN_STAND } from "../fakten";

const S = "2026-10-27";

/** Strafe der IRS ohne den Zusatz „je Formular und Jahr“ — für Kennziffer und Blick. */
const STRAFE_5472 = IRS.strafe5472.split(" je ")[0];

const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

const GELD_ZURUECK = GLOBAL_GELD_ZURUECK.aktiv ? [`${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}`] : [];

/** Der Satz, den wir auch im Gespräch sagen (Ehrlichkeits-Signal, Auftrag E-439). */
const EHRLICH = "Wer nur die Gesellschaft braucht, zahlt bei einem reinen Gründungsdienst weniger — das sagen wir Ihnen auch im Gespräch.";

/** Quellen dieses Beitrags (geprüft am 27.10.2026). */
const QUELLEN: Record<string, GlobalQuelle> = {
  ao10: { titel: "§ 10 AO — Geschäftsleitung", url: "https://www.gesetze-im-internet.de/ao_1977/__10.html" },
  ao42: { titel: "§ 42 AO — Missbrauch von rechtlichen Gestaltungsmöglichkeiten", url: "https://www.gesetze-im-internet.de/ao_1977/__42.html" },
  ao379: { titel: "§ 379 AO — Steuergefährdung", url: "https://www.gesetze-im-internet.de/ao_1977/__379.html" },
  kstg1: { titel: "§ 1 KStG — Unbeschränkte Steuerpflicht", url: "https://www.gesetze-im-internet.de/kstg_1977/__1.html" },
  ustg13b: { titel: "§ 13b UStG — Leistungsempfänger als Steuerschuldner", url: "https://www.gesetze-im-internet.de/ustg_1980/__13b.html" },
  bmf: { titel: "BMF-Schreiben vom 19.03.2004 zur US-LLC (KStH 2022, Anlage 10)", url: "https://usth.bundesfinanzministerium.de/ksth/2022/B-Anlagen/Anlage-10/inhalt.html" },
  bfh: { titel: "BFH, Beschluss vom 18.05.2021, I B 75/20 — Einordnung einer US-LLC", url: "https://www.bundesfinanzhof.de/en/entscheidungen/entscheidungen-online/decision-detail/STRE202150148/" },
  kstg1at: { titel: "§ 1 KStG 1988 — Unbeschränkte und beschränkte Steuerpflicht (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10004569&Paragraf=1" },
  bao27: { titel: "§ 27 BAO — Sitz und Ort der Geschäftsleitung (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=27" },
  bao120: { titel: "§ 120 BAO — Anzeigepflichten (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=120" },
  bao121: { titel: "§ 121 BAO — Frist für Anzeigen (RIS)", url: "https://www.ris.bka.gv.at/NormDokument.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10003940&Paragraf=121" },
  eas1413: { titel: "BMF Österreich, EAS 1413 vom 04.02.1999 — Steuerliche Behandlung einer US-Limited Liability Company (findok)", url: "https://findok.bmf.gv.at/findok/resources/pdf/1691f422-2c75-4ed3-9271-ed18e5cce2b7/30137.1.1.0.pdf" },
  dbg50: { titel: "Art. 50 DBG — Persönliche Zugehörigkeit (fedlex)", url: "https://www.fedlex.admin.ch/eli/cc/1991/1184_1184_1184/de#art_50" },
  usc1361: { titel: "26 U.S. Code § 1361 — S corporation defined", url: "https://www.law.cornell.edu/uscode/text/26/1361" },
  irsFbar: { titel: "IRS — Report of Foreign Bank and Financial Accounts (FBAR)", url: "https://www.irs.gov/businesses/small-businesses-self-employed/report-of-foreign-bank-and-financial-accounts-fbar" },
  eo14406: { titel: "The White House — Executive Order 14406, Restoring Integrity to America’s Financial System (19.05.2026)", url: "https://www.whitehouse.gov/presidential-actions/2026/05/restoring-integrity-to-americas-financial-system/" },
  fl605715: { titel: "Florida Statutes 2026, § 605.0715 — Wiederinkraftsetzung nach Auflösung von Amts wegen", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0715" },
  e2: { titel: "USCIS — E-2 Treaty Investors", url: "https://www.uscis.gov/working-in-the-united-states/temporary-workers/e-2-treaty-investors" },
  fl605304: { titel: "Florida Statutes 2026, § 605.0304 — Haftung von Gesellschaftern und Managern", url: "https://www.flsenate.gov/Laws/Statutes/2026/605.0304" },
  sba: { titel: "SBA Procedural Notice 5000-876626 — Revised Applicant Ownership, Citizenship, and Residency Requirements for 7(a) and 504 Loans (gültig ab 01.03.2026)", url: "https://legacy.sba.gov/sites/default/files/2026-02/Procedural%20Notice%205000-876626%20-%20Revised%20Applicant%20Ownership%20Citizenship%20and%20Residency%20%20OFA%202.11.pdf" },
};
const QL = QUELLEN;

export const SEITE: GlobalSeite = {
  pfad: "/business/wissen/nachteile-us-llc",
  art: "wissen",
  seo: {
    titel: "Nachteile einer US-LLC: offen gesagt — FIAON Global",
    beschreibung: "Die Nachteile einer US-LLC: Steuerpflicht zu Hause, Meldungen in zwei Ländern, laufende Kosten, Strafen — und wann sie trotzdem sinnvoll ist.",
  },
  stand: S,
  erschienen: S,
  kennung: "FG · 52",
  auge: "Wissen · Vor der Gründung",
  h1: "Die Nachteile einer US-LLC.",
  h1b: "Offen gesagt, mit Fundstellen.",
  lead: "Wer eine US-LLC gründen will, liest meist nur die Vorteile. Hier stehen die Nachteile einer US-LLC, jeweils mit Fundstelle: die Steuerpflicht, die zu Hause bleibt, Meldepflichten in zwei Ländern, laufende Kosten in jedem Jahr, Strafen bei Versäumnis und ein schwieriger Zugang zu Bank und Karten ohne US-Historie. Dazu die Fälle, in denen eine LLC nicht passt — und die, in denen sie sinnvoll ist.",
  ziffern: [
    { wert: STRAFE_5472, label: "Strafe der IRS je versäumter Form 5472" },
    { wert: "14 Monate", label: "spätestens: Meldung nach § 138 AO, mit der Steuererklärung" },
    { wert: "§ 10 AO", label: "Ort der Geschäftsleitung entscheidet über die Steuerpflicht" },
  ],
  blick: [
    ["Steuerpflicht", "Bleibt dort, wo die LLC geführt wird — meist zu Hause"],
    ["Meldungen", "Form 5472 an die IRS, § 138 AO ans Finanzamt"],
    ["Laufende Kosten", "Staatsgebühr, Registered Agent, US-CPA — jedes Jahr"],
    ["Strafen", `${STRAFE_5472} je versäumter Form 5472`],
    ["Bank und Karten", "Ohne US-Historie zunächst kein Score; persönliche Haftung üblich"],
    ["Passt nicht", "Ohne echtes Geschäft in den USA, nur aus Steuermotiv"],
    ["Mit FIAON Global", "Ein Ansprechpartner statt acht, Prüfung vor der Gründung"],
  ],
  kurz: `Die wichtigsten Nachteile einer US-LLC: Wer sie von Deutschland, Österreich oder der Schweiz aus führt, bleibt dort in der Regel steuerpflichtig (§ 10 AO, § 1 Abs. 2 KStG 1988, Art. 50 DBG). Dazu kommen Meldepflichten in zwei Ländern — Form 5472 an die IRS, deren Versäumnis ${STRAFE_5472} je Formular kosten kann, und in Deutschland die Meldung nach § 138 AO —, laufende Kosten für Staat, Registered Agent und US-CPA sowie ein schwieriger Zugang zu Bank und Karten ohne US-Historie. Sinnvoll ist eine LLC für echtes Geschäft in den USA, nicht als Steuermodell.`,
  bloecke: [
    {
      typ: "text", id: "steuerpflicht", h2: "Der erste Nachteil einer US-LLC: Die Steuerpflicht bleibt zu Hause",
      absaetze: [
        "Ein verbreiteter Irrtum ist der Ruf der US-LLC als „steuerfreie“ Gesellschaft. Richtig ist nur ein Teil: Eine LLC mit einem einzigen ausländischen Gesellschafter behandelt die IRS in der Regel nicht als eigenes Steuersubjekt, und ohne Geschäft in den USA fällt dort oft keine Bundessteuer an. Über die Steuer in Ihrem Wohnsitzland sagt das nichts.",
        "Deutschland knüpft an den Ort der Geschäftsleitung an, den Mittelpunkt der geschäftlichen Oberleitung (§ 10 AO). Wer die wichtigen Entscheidungen seiner LLC am Schreibtisch in Deutschland trifft, hat ihre Geschäftsleitung in Deutschland. Wird die LLC wie eine Kapitalgesellschaft eingeordnet, ist sie dann hier unbeschränkt körperschaftsteuerpflichtig, mit sämtlichen Einkünften (§ 1 KStG); wird sie als transparent eingeordnet, wird ihr Gewinn Ihnen unmittelbar zugerechnet. Österreich knüpft ebenso an Geschäftsleitung oder Sitz im Inland an (§ 1 Abs. 2 KStG 1988 mit § 27 BAO), die Schweiz an Sitz oder tatsächliche Verwaltung (Art. 50 DBG).",
        "Das Doppelbesteuerungsabkommen zwischen Deutschland und den USA ändert daran nichts Grundsätzliches. Es verteilt Besteuerungsrechte und vermeidet, dass derselbe Gewinn zweimal besteuert wird; aus einer Gesellschaft, die von Deutschland aus geleitet wird, macht es keine, die nur in den USA steuerpflichtig ist. Hinzu kommt § 42 AO: Durch Missbrauch von Gestaltungsmöglichkeiten des Rechts kann das Steuergesetz nicht umgangen werden. Führt eine unangemessene Gestaltung zu einem gesetzlich nicht vorgesehenen Vorteil bei der Steuer, entsteht die Steuer so, wie sie bei einer angemessenen Gestaltung entstünde — es sei denn, es werden außersteuerliche Gründe nachgewiesen, die nach dem Gesamtbild beachtlich sind.",
        "Auch die Umsatzsteuer folgt der Geschäftsleitung. Ein Unternehmer mit Sitz, Geschäftsleitung oder Betriebsstätte im Inland gilt umsatzsteuerlich nicht als im Ausland ansässig (§ 13b Abs. 7 UStG) — das betrifft auch eine LLC, die von Deutschland aus geleitet wird. Rechnungen an deutsche Unternehmen tragen dann in der Regel deutsche Umsatzsteuer statt des Hinweises auf die Steuerschuldnerschaft des Kunden.",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Vor- und Nachteile einer US-LLC im Überblick",
      lead: "Was für eine US-LLC spricht und was dagegen, jeweils aus Sicht eines Unternehmers mit Wohnsitz in Deutschland, Österreich oder der Schweiz.",
      kopf: ["Thema", "Vorteil", "Nachteil"],
      zeilen: [
        ["Gründung", `Schnell und überschaubar: Gründungsgebühr ${STAAT.wyoming.gruendung} in Wyoming, ${STAAT.florida.gruendung} in Florida`, "Die Gründung ist der kleinste Posten; die Pflichten kommen in jedem Jahr"],
        ["Steuern", "In den USA oft keine Bundessteuer, solange dort kein Geschäft besteht", "Von zu Hause geführt, in der Regel zu Hause steuerpflichtig (§ 10 AO)"],
        ["Meldungen", "Keine BOI-Meldung mehr für in den USA gegründete Gesellschaften (FinCEN, August 2026)", "Form 5472 an die IRS, sobald Geld zwischen Ihnen und der LLC fließt — auch ohne Umsatz; dazu die Meldung nach § 138 AO ans Finanzamt"],
        ["Einordnung", "Wählbar: transparent oder wie eine Corporation besteuert", "IRS und Finanzamt ordnen unabhängig voneinander ein; die Ergebnisse können auseinanderfallen"],
        ["Haftung", "Für Schulden der Gesellschaft haftet grundsätzlich die Gesellschaft, nicht der Gesellschafter (in Florida § 605.0304)", "Für Firmenkarten verlangen Herausgeber in der Regel Ihre persönliche Haftung"],
        ["Bank und Karten", "Ein US-Konto kann Zahlungen von US-Kunden in US-Dollar erleichtern", "Ohne US-Kredithistorie zunächst kein Score; SBA-Programme verschlossen; jedes Institut entscheidet selbst"],
        ["Kosten", "Überschaubare Staatsgebühren", "Jedes Jahr Staatsgebühr, Registered Agent und US-CPA, dazu Ihre Steuerkanzlei zu Hause"],
        ["Aufenthalt", "Kann Teil eines Investorenvisums sein, wenn ein echtes Unternehmen mit substanzieller Investition dahintersteht — das prüft ein US-Einwanderungsanwalt", "Die Gesellschaft allein gibt kein Recht, in den USA zu leben oder zu arbeiten"],
      ],
      fuss: ["Vereinfachte Übersicht, Stand Oktober 2026. Ob ein Punkt für Sie Vorteil oder Nachteil ist, hängt von Ihrem Geschäft ab; die steuerliche Seite prüft der Steuerberater im Einzelfall."],
    },
    {
      typ: "text", id: "meldepflichten", h2: "Der zweite Nachteil: Meldepflichten in zwei Ländern",
      absaetze: [
        `In den USA gilt eine Einpersonen-LLC mit ausländischem Inhaber für die Meldepflicht nach Section 6038A als Corporation. Sie reicht Form 5472 ein, angehängt an ein Form 1120 in vereinfachter Form (pro forma), und zwar für jedes Jahr, in dem es ein meldepflichtiges Geschäft zwischen der LLC und Ihnen gibt. Dazu zählen ausdrücklich schon Zahlungen bei der Gründung, Einlagen in die Gesellschaft und Entnahmen aus ihr — Umsatz oder ein Konto sind dafür nicht nötig. Frist ist bei Kalenderjahr der ${IRS.frist5472}. Dazu gehören Bücher, die diese Zahlen belegen.`,
        "In Deutschland ist die Beteiligung an der LLC dem Finanzamt mitzuteilen (§ 138 Abs. 2 AO): je nach Einordnung als Beteiligung an einer ausländischen Personengesellschaft oder an einer ausländischen Körperschaft (dort ab zehn Prozent oder ab Anschaffungskosten von mehr als 150.000 Euro), außerdem beim erstmaligen beherrschenden Einfluss auf eine Gesellschaft außerhalb von EU und EFTA. Die Mitteilung geht mit der Steuererklärung für das Jahr der Gründung ein, spätestens 14 Monate nach dessen Ablauf (§ 138 Abs. 5 AO). Wird die LLC von hier aus geleitet, kann zudem eine Anzeige nach § 138 Abs. 1 AO hinzukommen: Die Eröffnung eines gewerblichen Betriebs oder einer Betriebsstätte geht an die Gemeinde, die das Finanzamt unterrichtet. In Österreich zeigen Sie dem Finanzamt Umstände, die eine Abgabepflicht begründen oder ändern, binnen einem Monat an (§§ 120, 121 BAO).",
        `Hält die LLC Konten außerhalb der USA, etwa ein Euro-Konto in Europa, kann eine dritte Meldung hinzukommen. Als US-Person gilt für den FBAR auch eine in den USA gegründete Limited Liability Company. Übersteigt der Gesamtwert ihrer ausländischen Konten im Jahr ${SCHWELLEN.fbar}, ist der Bericht an FinCEN fällig, Frist ${FRISTEN.fbar}.`,
        "Jede dieser Meldungen ist für sich einfach. Der Nachteil liegt darin, dass sie in zwei Ländern, bei verschiedenen Stellen und zu verschiedenen Terminen anfallen — und dass die Zahlen in beiden Ländern zueinander passen müssen.",
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Der dritte Nachteil: laufende Kosten in jedem Jahr",
      lead: "Was eine LLC ab dem zweiten Jahr kostet, auch wenn sie keinen Umsatz macht. Die Staatsgebühren stammen aus den amtlichen Gebührenordnungen; die übrigen Werte sind veröffentlichte Preise mehrerer Anbieter.",
      kopf: ["Posten", "Betrag", "Wann"],
      zeilen: [
        ["Annual Report, Florida", STAAT.florida.jahr, STAAT.florida.jahrFrist],
        ["Annual Report mit License Tax, Wyoming", `${STAAT.wyoming.jahr} (${STAAT.wyoming.jahrDetail})`, STAAT.wyoming.jahrFrist],
        ["Annual Tax der LLC, Delaware", STAAT.delaware.jahr, STAAT.delaware.jahrFrist],
        ["Registered Agent", MARKT.agent, "in jedem Jahr; Florida, Wyoming und Delaware schreiben ihn vor"],
        ["US-CPA für Form 5472 mit Form 1120", MARKT.cpa5472, "in jedem Jahr, zur Frist der IRS"],
        ["Steuerkanzlei in Deutschland, Österreich oder der Schweiz", "nach Aufwand", "in jedem Jahr, mit Ihrer Steuererklärung"],
      ],
      fuss: [
        `Delaware: ${STAAT.delaware.jahrAlt}`,
        `Registered Agent und US-CPA: Marktspannen, Stand ${FAKTEN_STAND}, keine amtlichen Werte. Laufende Buchhaltung und Umsatzsteuer-Registrierungen in einzelnen Bundesstaaten kommen gegebenenfalls hinzu.`,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Der vierte Nachteil: zwei Länder, zwei Einordnungen",
      absaetze: [
        `In den USA ist eine LLC mit einem Gesellschafter steuerlich nicht von ihrem Inhaber getrennt (disregarded entity); eine LLC mit zwei oder mehr Gesellschaftern gilt als Personengesellschaft (partnership). Beide können mit Form 8832 wählen, wie eine Corporation besteuert zu werden. Dann zahlt die LLC in den USA ${IRS.koerperschaftsteuer} Bundes-Körperschaftsteuer auf ihren dort steuerpflichtigen Gewinn und gibt eine vollständige Form 1120 ab.`,
        `Die Personengesellschaft bringt eigene Pflichten mit: Form 1065, bei Kalenderjahr fällig am ${FRISTEN.f1065}. Erzielt sie Einkünfte aus einem Geschäft in den USA, behält sie auf den Anteil ausländischer Gesellschafter Steuer ein (Section 1446) — ${SCHWELLEN.abzug1446} —, und der Gesellschafter gibt selbst eine US-Erklärung ab (als Privatperson: Form 1040-NR). Ein Weg, der in amerikanischen Ratgebern oft steht, ist zudem verschlossen: Eine S-Corporation darf keinen Gesellschafter haben, der als Ausländer nicht in den USA ansässig ist (26 U.S.C. § 1361(b)(1)(C)).`,
        "In Deutschland zählt die amerikanische Einordnung nicht. Das Finanzamt prüft in einem Typenvergleich, ob die LLC nach ihrem rechtlichen Aufbau eher einer Kapitalgesellschaft oder einer Personengesellschaft entspricht. Die Merkmale stehen im BMF-Schreiben vom 19. März 2004; entscheidend ist das Gesamtbild, und die Merkmale wiegen nicht gleich schwer (BFH, Beschluss vom 18. Mai 2021, I B 75/20). Auch Österreich ordnet die LLC im Einzelfall nach einem Typenvergleich ein; die amerikanische Einordnung ist auch dort nicht entscheidend (BMF Österreich, EAS 1413). Viele dieser Merkmale regelt das Operating Agreement — wer es ungeprüft aus einer Vorlage übernimmt, beeinflusst die Einordnung, ohne es zu merken.",
        "Der Nachteil liegt im Zusammenspiel. Ist die LLC in den USA transparent und in Deutschland eine Kapitalgesellschaft, oder umgekehrt, müssen Steuerberater und US-CPA beide Seiten so abstimmen, dass dieselben Zahlen in beiden Ländern stimmig gemeldet werden. Für solche Gesellschaften enthält das Doppelbesteuerungsabkommen eine eigene Regel (Art. 1 Abs. 7).",
      ],
    },
    {
      typ: "text", id: "bank", h2: "Der fünfte Nachteil: Bank und Karten ohne US-Historie",
      absaetze: [
        `Eine US-Bank erhebt vor jeder Kontoeröffnung Name, Anschrift und eine Identifikationsnummer und prüft sie. Bei Ausländern kann das die Nummer des Reisepasses mit Ausstellerstaat sein; für die Gesellschaft verlangt die Regel eine Hauptniederlassung, ein örtliches Büro oder einen anderen physischen Standort (31 CFR 1020.220). Dazu kommen die wirtschaftlich Berechtigten: Wer ${SCHWELLEN.eigentuemer} oder mehr hält, wird identifiziert (31 CFR 1010.230). Ob ein Konto entsteht und zu welchen Bedingungen, legt jedes Institut selbst fest.`,
        "Für Karten zählt die Vorgeschichte. Einen FICO-Score gibt es erst, wenn mindestens ein Konto seit sechs Monaten oder länger besteht und in den letzten sechs Monaten an die Auskunftei gemeldet wurde. Wer neu in den USA ist, hat also zunächst keinen Score. Mit der Executive Order 14406 vom 19. Mai 2026 hat der Präsident zudem das US-Finanzministerium angewiesen, Banken auf Warnzeichen hinzuweisen. Dazu zählt die Nutzung einer ITIN für Konto- oder Kreditanträge durch Antragsteller ohne geprüften Aufenthaltsstatus in den USA; eine ITIN anstelle einer Sozialversicherungsnummer kann danach als Risikofaktor gelten, der eine vertiefte Prüfung auslöst.",
        "Auch die Kreditprogramme 7(a) und 504, die die Small Business Administration (SBA) absichert, stehen einer LLC mit Inhaber in Deutschland, Österreich oder der Schweiz nicht offen: Seit dem 1. März 2026 müssen die direkten und indirekten Eigentümer zu 100 Prozent US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626).",
        `${GLOBAL_PFLICHTHINWEIS.de[2]} Für Verbindlichkeiten, für die Sie persönlich haften, schützt Sie die Haftungstrennung der LLC nicht.`,
      ],
    },
    {
      typ: "tabelle", id: "strafen", h2: "Der sechste Nachteil: Strafen bei Versäumnis",
      lead: "Die Pflichten sind einzeln überschaubar. Teuer wird es, wenn eine davon liegen bleibt.",
      kopf: ["Versäumt", "Folge", "Grundlage"],
      zeilen: [
        ["Form 5472 nicht oder nicht rechtzeitig eingereicht, Aufzeichnungen nicht geführt", `${IRS.strafe5472}; dauert das Versäumnis nach einer Mitteilung der IRS mehr als 90 Tage an, je angefangene 30 Tage weitere 25.000 US-Dollar`, "IRS, Instructions for Form 5472"],
        ["Meldung nach § 138 Abs. 2 AO nicht, unvollständig oder verspätet, vorsätzlich oder leichtfertig", "Bußgeld von höchstens 25.000 Euro", "§ 379 Abs. 2 und 7 AO"],
        ["Annual Report in Florida", `${STAAT.florida.jahrVerzug}; fehlt der Bericht am dritten Freitag im September, wird die LLC am vierten Freitag im September von Amts wegen aufgelöst`, "Florida Statutes, §§ 607.193 und 605.0714"],
        ["Annual Report in Wyoming", STAAT.wyoming.jahrVerzug, "Wyoming Secretary of State"],
        ["Annual Tax in Delaware", STAAT.delaware.jahrVerzug, "Delaware Code, Title 6, § 18-1107"],
        ["Kein Registered Agent", "in Florida ein Grund für die Auflösung von Amts wegen; nach der Ankündigung bleiben sechzig Tage, um ihn zu beheben", "Florida Statutes, § 605.0714"],
      ],
      fuss: ["Stand Oktober 2026; Gebühren und Folgen der Bundesstaaten nach deren amtlichen Angaben, geprüft im Oktober 2026. In Florida lässt sich eine aufgelöste LLC wieder in Kraft setzen — mit allen offenen Gebühren und Strafen (Florida Statutes, § 605.0715)."],
    },
    {
      typ: "karten", id: "nicht-passt", h2: "Wann eine US-LLC nicht passt", spalten: 3,
      lead: "Sechs Lagen, in denen die Nachteile einer LLC ihren Nutzen in der Regel überwiegen.",
      karten: [
        { tag: "Passt nicht", titel: "Kein Geschäft in den USA", text: "Ohne US-Kunden, US-Verträge oder US-Plattformen hat die LLC keine Aufgabe. Sie trägt dann nur Pflichten und Kosten in zwei Ländern." },
        { tag: "Passt nicht", titel: "Nur das Steuermotiv", text: "Wer die LLC vor allem gründet, um zu Hause weniger Steuern zu zahlen, baut auf einem Missverständnis: Steuerpflichtig ist sie dort, wo sie geführt wird (§ 10 AO). Eine unangemessene Gestaltung, die vor allem der Steuer dient und keine beachtlichen außersteuerlichen Gründe hat, kann zudem als Missbrauch nach § 42 AO gewertet werden.", pfad: "/business/wissen/us-llc-steuern" },
        { tag: "Passt nicht", titel: "Kunden nur in DACH", text: "Eine LLC, die von Deutschland aus geleitet wird, rechnet gegenüber deutschen Unternehmen in der Regel mit deutscher Umsatzsteuer ab (§ 13b Abs. 7 UStG). Für ein reines Inlandsgeschäft bringt sie in der Regel keinen Nutzen, nur einen zweiten Satz Pflichten." },
        { tag: "Passt nicht", titel: "Ein Aufenthaltsrecht als Ziel", text: "Eine LLC allein berechtigt nicht, in den USA zu leben oder zu arbeiten. Das E-2-Visum etwa setzt die Staatsangehörigkeit eines Vertragsstaats und eine substanzielle Investition in ein echtes Unternehmen voraus, das mehr als einen bescheidenen Lebensunterhalt erwirtschaften kann. Ob ein Visum in Ihrem Fall in Betracht kommt, prüft allein ein US-Einwanderungsanwalt.", pfad: "/business/wissen/e2-visum" },
        { tag: "Passt nicht", titel: "Kein Platz für Pflichten", text: "Form 5472, Jahresmeldung beim Bundesstaat, Registered Agent, Steuererklärung zu Hause: Wer dafür weder Zeit noch Budget einplanen will, riskiert genau die Strafen aus der Tabelle oben." },
        { tag: "Passt nicht", titel: "Der Wunsch nach Anonymität", text: `Banken identifizieren jeden, der ${SCHWELLEN.eigentuemer} oder mehr hält, und das Finanzamt erfährt von der Gesellschaft über die Meldung nach § 138 AO. Eine LLC als Versteck gibt es nicht.` },
      ],
    },
    {
      typ: "text", id: "sinnvoll", h2: "Wann eine US-LLC sinnvoll ist",
      absaetze: [
        "Die Nachteile wiegen leichter, wenn die Gesellschaft echte Arbeit in den USA hat. Dann sind Meldungen und Kosten der Preis für einen Zugang, den es anders nicht gibt. Typische Lagen:",
      ],
      punkte: [
        "Sie haben Kunden in den USA, die einen US-Vertragspartner, eine US-Rechnung und Zahlungen in US-Dollar erwarten.",
        "Sie verkaufen über US-Plattformen oder Zahlungsdienste, die eine US-Gesellschaft mit EIN und US-Konto verlangen.",
        "Sie bauen ein Team, ein Lager oder ein Büro in den USA auf, oder Ihr Unternehmen braucht eine Tochter für den Markteintritt.",
        "Sie wollen über Jahre eine US-Bonität und eine Kartenhistorie der Gesellschaft aufbauen — mit allem, was dazugehört: Geduld, saubere Zahlen und persönliche Haftung bei den ersten Karten.",
        `Sie wollen für die Gesellschaft in den USA Konten, Karten oder Finanzierungen beantragen — über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut. ${KAPITAL_FREI}`,
        "Sie planen eine Investition in ein echtes US-Unternehmen, das später Teil eines Visumsantrags sein kann; ob das in Ihrem Fall trägt, prüft ein US-Einwanderungsanwalt.",
      ],
      nach: "Ein Nachteil, der auf vielen Seiten noch steht, ist entfallen: In den USA gegründete Gesellschaften müssen seit August 2026 keine BOI-Meldung an FinCEN mehr abgeben.",
    },
    { typ: "zitat", id: "ehrlich", text: EHRLICH, quelle: "FIAON Global" },
    {
      typ: "text", id: "fiaon", h2: "So übernimmt FIAON Global die Pflichten, die eine LLC mit sich bringt",
      absaetze: [
        "FIAON Global ist eine Unternehmensberatung für den Weg in die USA, mit einem Grundsatz: ein Ansprechpartner statt acht. Viele Nachteile einer US-LLC sind keine Frage des Rechts, sondern der Organisation — acht Stellen, zwei Länder, verschiedene Termine. Mit Ihrer Vollmacht stellen wir die Anträge für Sie: Gründung, EIN, die Vorbereitung der ITIN, D-U-N-S-Nummer, Meldungen, Registered Agent, US-Adresse und US-Telefon im ersten Jahr. Nur Konto-, Karten- und Kreditanträge stellen Sie selbst; wir bereiten sie vollständig vor.",
        `Bevor die Gesellschaft gegründet wird, prüft unser Partner-Steuerberater Ihren Fall auf Ihr Mandat: Ort der Geschäftsleitung, Einordnung nach dem Typenvergleich, Meldung nach § 138 AO — und ob die LLC steuerlich zu Ihrem Vorhaben passt. Auf dieses Ergebnis hin schreibt unser Partner-Anwalt das Operating Agreement; die erste Form 5472 mit Form 1120 übernimmt unser US-CPA. ${GLOBAL_ROLLEN.de.partner}`,
        "Sie zahlen einen Festpreis, alle Gebühren des Pakets inklusive. Unser Team vor Ort in Miami erledigt die Termine in den USA, Partnerstandort ist Zürich, Vertragspartner die FIAON LTD in London. Ab dem zweiten Jahr können Sie freiwillig die Jahresbetreuung dazubuchen: Dann übernehmen wir Registered Agent, US-Adresse und US-Telefon, die Jahresmeldung beim Bundesstaat samt Staatsgebühr und die US-Meldung durch unseren US-CPA — mit einem Pflichtenkalender, damit Sie jede Frist im Blick haben.",
        "Und wenn schon im Erstgespräch erkennbar ist, dass eine LLC nicht zu Ihrem Vorhaben passt — etwa weil es kein Geschäft in den USA gibt —, sagen wir Ihnen das vor dem Auftrag. Wer nur die Gesellschaft braucht, ohne Prüfung, Partner und Begleitung, ist bei einem reinen Gründungsdienst günstiger aufgehoben.",
        ...GELD_ZURUECK,
      ],
    },
    { typ: "paket", id: "paket", h2: "Der saubere Start, alle Pflichten im Blick", lead: "Gründung, EIN und ITIN, Registered Agent, US-Adresse und US-Telefon im ersten Jahr, Operating Agreement durch unseren Partner-Anwalt, Prüfung vor der Gründung durch unseren Partner-Steuerberater, die erste US-Meldung durch unseren US-CPA und der erste Konto- und Kartenantrag, vollständig vorbereitet — Global Struktur.", paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        "Dieser Beitrag erklärt die gesetzlichen Grundlagen, Stand Oktober 2026. Er ersetzt nicht die Prüfung Ihres Falls; die übernimmt der Steuerberater auf Ihr Mandat, Fragen zu Visum und Aufenthalt klärt ein US-Einwanderungsanwalt.",
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        `Nicht im Festpreis: ${GLOBAL_NICHT_INKLUSIVE.de[1]}.`,
        GLOBAL_ROLLEN.de.fiaon,
        "FIAON vergibt keine Kredite und vermittelt keine Kredite. Eine US-LLC ist kein Steuermodell: Wer sie von zu Hause aus leitet, versteuert sie in der Regel dort.",
      ],
    },
  ],
  fragen: [
    { f: "Welche Nachteile hat eine US-LLC für Unternehmer aus Deutschland?", a: `Vor allem fünf: Die Steuerpflicht bleibt in Deutschland, wenn die LLC von hier aus geleitet wird (§ 10 AO). Es gibt Meldepflichten in zwei Ländern — Form 5472 an die IRS, die Meldung nach § 138 AO ans Finanzamt. In jedem Jahr fallen Staatsgebühr, Registered Agent und US-CPA an. Ohne US-Historie sind Konto und Karten schwerer zu erreichen. Und Versäumnisse kosten: ${STRAFE_5472} je fehlender Form 5472.` },
    { f: "Lohnt sich eine US-LLC?", a: "Wenn sie echtes Geschäft in den USA hat — US-Kunden, US-Plattformen, ein Team oder einen Markteintritt —, können die Vorteile überwiegen. Als reines Steuermodell lohnt sie sich nicht: Wer sie von zu Hause aus führt, bleibt dort steuerpflichtig und trägt zusätzlich Pflichten und Kosten in den USA. Ihren Fall prüft vor der Gründung der Steuerberater." },
    { f: "Ist eine US-LLC „steuerfrei“?", a: "Nein. Eine LLC mit einem ausländischen Gesellschafter zahlt in den USA oft keine Bundessteuer, solange sie dort kein Geschäft hat. Steuerpflichtig ist sie aber dort, wo sie geführt wird: in Deutschland nach § 10 AO, in Österreich nach § 1 Abs. 2 KStG 1988, in der Schweiz nach Art. 50 DBG." },
    { f: "Was kostet eine US-LLC jedes Jahr?", a: `Die Staatsgebühr — in Florida ${STAAT.florida.jahr}, in Wyoming ${STAAT.wyoming.jahr}, in Delaware ${STAAT.delaware.jahr} —, der Registered Agent (Marktpreise ${MARKT.agent}) und der US-CPA für Form 5472 (${MARKT.cpa5472}). Dazu kommt Ihre Steuerkanzlei zu Hause. Diese Kosten fallen auch ohne Umsatz an.` },
    { f: "Was passiert, wenn ich Form 5472 nicht einreiche?", a: `Die IRS kann eine Strafe von ${IRS.strafe5472} festsetzen, ebenso, wenn die vorgeschriebenen Aufzeichnungen fehlen. Dauert das Versäumnis nach ihrer Mitteilung mehr als 90 Tage an, kommen je angefangene 30 Tage weitere 25.000 US-Dollar hinzu. Die Pflicht hängt nicht am Umsatz: Schon Zahlungen bei der Gründung, Einlagen und Entnahmen sind meldepflichtig.` },
    { f: "Komme ich mit einer US-LLC zu einem US-Konto und zu Kreditkarten?", a: "Das entscheidet allein das jeweilige Institut. Ohne US-Historie gibt es zunächst keinen FICO-Score, für Firmenkarten wird in der Regel Ihre persönliche Haftung verlangt, und nach der Executive Order 14406 kann eine ITIN statt einer Sozialversicherungsnummer als Warnzeichen gelten, das eine vertiefte Prüfung auslöst. Vollständige, widerspruchsfreie Unterlagen zählen deshalb mehr als die Zahl der Anträge." },
    { f: "Darf ich mit einer US-LLC in den USA leben und arbeiten?", a: "Nicht allein aufgrund der Gesellschaft; dafür braucht es ein Visum. Das E-2-Visum für Investoren etwa setzt die Staatsangehörigkeit eines Vertragsstaats und eine substanzielle Investition in ein echtes Unternehmen voraus, das mehr als einen bescheidenen Lebensunterhalt erwirtschaften kann. Ob es in Ihrem Fall in Betracht kommt, prüft ein US-Einwanderungsanwalt." },
    { f: "Wann passt eine US-LLC nicht?", a: `Wenn es kein Geschäft in den USA gibt, wenn das Steuermotiv der eigentliche Grund ist, wenn die Kunden nur in Deutschland, Österreich oder der Schweiz sitzen oder wenn für die jährlichen Pflichten weder Zeit noch Budget da ist. ${EHRLICH}` },
  ],
  paket: "global_struktur",
  weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/wissen/us-llc-wohnsitz-deutschland", "/business/paket-finder"],
  quellen: [
    QL.ao10, QL.kstg1, Q.ao138, QL.ao379, QL.ao42, QL.ustg13b, QL.bmf, QL.bfh,
    QL.kstg1at, QL.bao27, QL.bao120, QL.bao121, QL.eas1413, QL.dbg50, Q.dba,
    Q.i5472, Q.smllc, Q.f8832, Q.i1120, Q.i1065, Q.abzug1446, Q.i1040nr, QL.usc1361,
    QL.irsFbar, Q.fbar, Q.boiEnde,
    Q.cip, Q.cdd, Q.ficoMindest, QL.eo14406, QL.sba, QL.e2,
    QUELLEN_STAATEN.florida[0], QUELLEN_STAATEN.florida[1], QUELLEN_STAATEN.florida[2], QUELLEN_STAATEN.florida[3], QL.fl605304, Q.floridaAufloesung, QL.fl605715,
    QUELLEN_STAATEN.wyoming[0], QUELLEN_STAATEN.wyoming[1], QUELLEN_STAATEN.wyoming[2], QUELLEN_STAATEN.delaware[0], QUELLEN_STAATEN.delaware[1], Q.delawareAgent,
  ],
};
