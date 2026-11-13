// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WISSEN: DIE NACHTEILE EINER US-LLC — MIT QUELLEN UND STAND (27.10.2026, E-439)
// FG · 52 · Thema T15 aus .arbeit/recherche/kw_de.md
//
// Die Gegenrede zu Darstellungen, die nur Vorteile nennen. Abgrenzung:
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
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — kein Paketname.
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): EIN Abschnitt über uns („Was FIAON Global dabei übernimmt“,
// höchstens 120 Wörter: was wir tun · Ihr Teil · Bedingung). Feste Sätze (S2, S3, S8, S10, „Ihr Teil“ der Schritte 1 und 2)
// kommen aus shared/fiaon-global-saetze.ts. Nicht mehr hier: der Satz zur Erstattung (er gilt nur für die Finanzierung),
// die Honorarzeilen (sie stehen in der Karte „Ein Mandat“), „Prüfung vor der Gründung“ als enthaltene Leistung, „Team vor
// Ort“, Partnerstandort, ein Partner bei der Arbeit im Präsens. Der Sachteil (Normen, Zahlen Dritter) ist unverändert.
// Zweiter Durchgang am selben Tag: jeder sichtbare Text neu gefasst (Aussage · Bedingung · Entscheider, kurze Sätze im
// Aktiv, ein Wort je Sache, Fachwort beim ersten Mal erklärt). Die Überschriften sind Sachtitel ohne eigene Zählung — die
// Vorlage zählt römisch. Der Sachteil nennt FIAON nicht mehr: Die Blick-Zeile „Mit FIAON Global“ heißt jetzt „Sinnvoll“,
// die Antwort auf „Lohnt sich …?“ verweist auf den eigenen Steuerberater. Der Entscheider-Satz steht einmal je Abschnitt.
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_KAPITAL_FREI, GLOBAL_NICHT_INKLUSIVE } from "../../fiaon-global";
import { SCHRITTE_KOPF, SECHS_SCHRITTE, satz } from "../../fiaon-global-saetze";
import { EIN_PRODUKT } from "../ein-produkt";
import { QUELLEN_WISSEN as Q, QUELLEN_STAATEN, STAAT, IRS, MARKT, SCHWELLEN, FRISTEN, FAKTEN_STAND } from "../fakten";

const S = "2026-10-27";

/** Strafe der IRS ohne den Zusatz „je Formular und Jahr“ — für Kennziffer und Blick. */
const STRAFE_5472 = IRS.strafe5472.split(" je ")[0];

/** Wer Steuerfragen klärt — dieselbe Fassung wie auf den Länderseiten (zielgruppen.ts). */
const STEUERFRAGEN = "Steuerfragen liegen bei Partner-Steuerberatern, die in eigener Verantwortung arbeiten";
/** Das Kapital ist nicht an die USA gebunden (Justin, 19.09.2026) — der Satz aus der einen Quelle, dazu die Zuständigkeit für Steuerfragen. */
// Beide Sätze gehören zusammen (Justin, 19.09.2026; scripts/pruef-global-seiten.ts prüft das): eine Quelle, wortgleich wie im Vertrag.
const KAPITAL_FREI = `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`;

const P = EIN_PRODUKT.de;
/** „Ihr Teil“ und „Bedingung“ sowie die Schritte 1 und 2 der festen Erzählung (Leitfaden 2.1, 2.2). */
const TEIL = SCHRITTE_KOPF.de.teile;
const GRUENDUNG = SECHS_SCHRITTE.de.find((x) => x.nr === 1)!;
const UNTERLAGEN = SECHS_SCHRITTE.de.find((x) => x.nr === 2)!;
/** Die erste jährliche US-Meldung — Wortlaut des Vertrags (Ziffer 2), Rollenbezeichnung nach Leitplanke 5. */
const US_MELDUNG = "die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz";
/** Ab dem zweiten Jahr (Leitfaden 5.6) — ohne Betrag; der steht in der Karte „Ein Mandat“. */
const JAHRESBETREUUNG = "Ab dem zweiten Jahr können Sie die Jahresbetreuung beauftragen; sie verlängert sich nicht von selbst.";

/** Der eigene Nachteil zuerst (Leitfaden 3.1, Regel 10) — derselbe Satz wie auf der Kostenseite. */
const EHRLICH = "Wer nur eine Gesellschaft braucht und alles selbst koordiniert, zahlt weniger als bei uns.";

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
    titel: "Nachteile einer US-LLC: mit Quellen und Stand — FIAON Global",
    beschreibung: "Die Nachteile einer US-LLC: Steuerpflicht im Wohnsitzland, Meldungen in zwei Ländern, laufende Kosten. Dazu die Strafen — und wann sie sinnvoll ist.",
  },
  stand: "2026-11-13",
  erschienen: S,
  kennung: "FG · 52",
  auge: "Wissen · Vor der Gründung",
  h1: "Die Nachteile einer US-LLC.",
  h1b: "Mit Quellen und Stand.",
  lead: "Die Nachteile einer US-LLC sollten vor der Gründung bekannt sein. Diese Seite nennt sechs und belegt jeden mit seiner Fundstelle. Die Steuerpflicht bleibt im Wohnsitzland, Meldungen fallen in zwei Ländern an, Kosten entstehen in jedem Jahr. Hinzu kommen zwei steuerliche Einordnungen, der Zugang zu Konto und Karten ohne US-Historie und Strafen bei Versäumnis. Am Schluss stehen die Fälle, in denen eine LLC nicht passt, und die Fälle, in denen sie sinnvoll ist.",
  ziffern: [
    { wert: STRAFE_5472, label: "Strafe der IRS je versäumter Form 5472" },
    { wert: "14 Monate", label: "Meldung nach § 138 AO: mit der Steuererklärung, spätestens nach dieser Frist" },
    { wert: "§ 10 AO", label: "Der Ort der Geschäftsleitung bestimmt die Steuerpflicht" },
  ],
  blick: [
    ["Steuerpflicht", "Besteht dort, wo die LLC geführt wird: in der Regel im Wohnsitzland"],
    ["Meldungen", "Form 5472 an die IRS, Meldung nach § 138 AO ans Finanzamt"],
    ["Laufende Kosten", "Staatsgebühr, Registered Agent und US-Steuerberater (CPA), in jedem Jahr"],
    ["Strafen", `${STRAFE_5472} je versäumter Form 5472`],
    ["Konto und Karten", "Ohne US-Historie zunächst kein Score; es entscheidet das jeweilige Institut"],
    ["Passt nicht", "Ohne Geschäft in den USA oder allein aus Steuermotiv"],
    ["Sinnvoll", "Für Geschäft in den USA: Kunden, Plattformen, Markteintritt"],
  ],
  kurz: `Die Nachteile einer US-LLC: Wer sie von Deutschland, Österreich oder der Schweiz aus führt, bleibt dort in der Regel steuerpflichtig (§ 10 AO, § 1 Abs. 2 KStG 1988, Art. 50 DBG). Hinzu kommen Meldungen in zwei Ländern: in Deutschland die Meldung nach § 138 AO, in den USA Form 5472 an die US-Steuerbehörde IRS. Fehlt das Formular, kann die IRS eine Strafe von ${IRS.strafe5472} festsetzen. Kosten fallen in jedem Jahr an. Sinnvoll ist eine LLC für Geschäft in den USA, nicht als Steuermodell.`,
  bloecke: [
    {
      typ: "text", id: "steuerpflicht", h2: "Nachteile einer US-LLC: die Steuerpflicht",
      absaetze: [
        "Die US-LLC gilt vielen als „steuerfreie“ Gesellschaft. Richtig ist ein Teil davon: Die IRS behandelt eine LLC mit nur einem ausländischen Gesellschafter in der Regel nicht als eigenes Steuersubjekt. Ohne Geschäft in den USA fällt dort oft keine Bundessteuer an. Über die Steuer in Ihrem Wohnsitzland sagt das nichts.",
        "Deutschland knüpft an den Ort der Geschäftsleitung an, den Mittelpunkt der geschäftlichen Oberleitung (§ 10 AO). Wer die wichtigen Entscheidungen seiner LLC in Deutschland trifft, hat ihre Geschäftsleitung in Deutschland. Ordnet das Finanzamt die LLC wie eine Kapitalgesellschaft ein, ist sie hier unbeschränkt körperschaftsteuerpflichtig, mit sämtlichen Einkünften (§ 1 KStG). Ordnet es sie als steuerlich transparent ein, rechnet es ihren Gewinn unmittelbar Ihnen zu. Österreich knüpft ebenso an Geschäftsleitung oder Sitz im Inland an (§ 1 Abs. 2 KStG 1988 mit § 27 BAO). Die Schweiz knüpft an Sitz oder tatsächliche Verwaltung an (Art. 50 DBG).",
        "Das Doppelbesteuerungsabkommen zwischen Deutschland und den USA ändert daran im Grundsatz nichts. Es verteilt Besteuerungsrechte und vermeidet, dass derselbe Gewinn zweimal besteuert wird. Eine von Deutschland aus geleitete Gesellschaft wird durch das Abkommen nicht allein in den USA steuerpflichtig. Hinzu kommt § 42 AO: Durch Missbrauch von Gestaltungsmöglichkeiten des Rechts kann das Steuergesetz nicht umgangen werden. Führt eine unangemessene Gestaltung zu einem gesetzlich nicht vorgesehenen Vorteil bei der Steuer, entsteht die Steuer wie bei einer angemessenen Gestaltung. Das gilt nicht, wenn der Steuerpflichtige außersteuerliche Gründe nachweist; sie müssen nach dem Gesamtbild beachtlich sein.",
        "Auch die Umsatzsteuer folgt der Geschäftsleitung. Ein Unternehmer mit Sitz, Geschäftsleitung oder Betriebsstätte im Inland gilt umsatzsteuerlich nicht als im Ausland ansässig (§ 13b Abs. 7 UStG). Das betrifft auch eine LLC, die von Deutschland aus geleitet wird. Ihre Rechnungen an deutsche Unternehmen tragen dann in der Regel deutsche Umsatzsteuer statt des Hinweises auf die Steuerschuldnerschaft des Leistungsempfängers.",
      ],
    },
    {
      typ: "tabelle", id: "ueberblick", h2: "Vor- und Nachteile einer US-LLC",
      lead: "Acht Themen, jeweils mit Vorteil und Nachteil — aus Sicht eines Unternehmers mit Wohnsitz in Deutschland, Österreich oder der Schweiz.",
      kopf: ["Thema", "Vorteil", "Nachteil"],
      zeilen: [
        ["Gründung", `Gründungsgebühr ${STAAT.wyoming.gruendung} in Wyoming, ${STAAT.florida.gruendung} in Florida`, "Die Gründung ist der kleinste Posten; die Pflichten fallen in jedem Jahr an"],
        ["Steuern", "In den USA oft keine Bundessteuer, solange dort kein Geschäft besteht", "Vom Wohnsitzland aus geführt, in der Regel dort steuerpflichtig (§ 10 AO)"],
        ["Meldungen", "Keine Meldung der wirtschaftlich Berechtigten (BOI) mehr für in den USA gegründete Gesellschaften (FinCEN, August 2026)", "Form 5472 an die IRS, sobald Geld zwischen Ihnen und der LLC fließt, auch ohne Umsatz; dazu die Meldung nach § 138 AO ans Finanzamt"],
        ["Einordnung", "In den USA wählbar: steuerlich transparent oder wie eine Corporation besteuert", "IRS und Finanzamt ordnen unabhängig voneinander ein; die Ergebnisse können voneinander abweichen"],
        ["Haftung", "Für Schulden der Gesellschaft haftet grundsätzlich die Gesellschaft, nicht der Gesellschafter (in Florida § 605.0304)", "Für Firmenkreditkarten verlangen Herausgeber in der Regel Ihre persönliche Haftung"],
        ["Konto und Karten", "Ein US-Konto kann Zahlungen von US-Kunden in US-Dollar erleichtern", "Ohne US-Kredithistorie zunächst kein Score; die staatlich abgesicherten SBA-Kreditprogramme stehen nicht offen; es entscheidet das jeweilige Institut"],
        ["Kosten", "Überschaubare Staatsgebühren, amtlich festgelegt (Beträge in der Tabelle unten)", "In jedem Jahr: Staatsgebühr, Registered Agent und US-Steuerberater (CPA); dazu Ihr Steuerberater im Wohnsitzland"],
        ["Aufenthalt", "Kann Teil eines Antrags auf ein Investorenvisum sein, wenn ein echtes Unternehmen mit substanzieller Investition besteht; das prüft ein US-Einwanderungsanwalt", "Die Gesellschaft allein gibt kein Recht, in den USA zu leben oder zu arbeiten"],
      ],
      fuss: ["Vereinfachte Übersicht, Stand Oktober 2026. Ob ein Punkt für Sie Vorteil oder Nachteil ist, hängt von Ihrem Geschäft ab. Die steuerliche Seite beurteilt Ihr Steuerberater im Einzelfall."],
    },
    {
      typ: "text", id: "meldepflichten", h2: "Meldepflichten in zwei Ländern",
      absaetze: [
        `In den USA gilt eine Einpersonen-LLC mit ausländischem Inhaber für die Meldepflicht nach Section 6038A als Corporation. Sie reicht Form 5472 ein, angehängt an ein vereinfachtes Form 1120 (pro forma). Die Pflicht besteht für jedes Jahr mit einem meldepflichtigen Geschäft zwischen der LLC und Ihnen. Dazu zählen schon Zahlungen bei der Gründung, Einlagen in die Gesellschaft und Entnahmen aus ihr. Umsatz oder ein Konto setzt die Pflicht nicht voraus. Frist ist bei Kalenderjahr der ${IRS.frist5472}. Die LLC führt außerdem Bücher, die diese Zahlen belegen.`,
        "In Deutschland teilen Sie die Beteiligung an der LLC dem Finanzamt mit (§ 138 Abs. 2 AO). Je nach Einordnung ist es die Beteiligung an einer ausländischen Personengesellschaft oder an einer ausländischen Körperschaft. Bei der Körperschaft gilt die Pflicht ab zehn Prozent oder ab Anschaffungskosten von mehr als 150.000 Euro. Sie gilt außerdem beim erstmaligen beherrschenden Einfluss auf eine Gesellschaft außerhalb von EU und EFTA. Die Meldung geben Sie mit der Steuererklärung für das Jahr der Gründung ab, spätestens vierzehn Monate nach dessen Ablauf (§ 138 Abs. 5 AO). Leiten Sie die LLC von Deutschland aus, kann eine Anzeige nach § 138 Abs. 1 AO hinzukommen. Die Anzeige über die Eröffnung eines gewerblichen Betriebs oder einer Betriebsstätte geht an die Gemeinde; diese unterrichtet das Finanzamt. In Österreich zeigen Sie dem Finanzamt binnen einem Monat Umstände an, die eine Abgabepflicht begründen oder ändern (§§ 120, 121 BAO).",
        `Hält die LLC Konten außerhalb der USA, etwa ein Euro-Konto in Europa, kann eine dritte Meldung hinzukommen. Das ist der FBAR, der Bericht über ausländische Bank- und Finanzkonten. Als US-Person gilt dafür auch eine in den USA gegründete Limited Liability Company. Übersteigt der Gesamtwert ihrer ausländischen Konten im Jahr ${SCHWELLEN.fbar}, ist der Bericht an die US-Behörde FinCEN fällig. Frist ist der ${FRISTEN.fbar}.`,
        "Jede dieser Meldungen ist für sich überschaubar. Der Nachteil liegt in der Summe: zwei Länder, mehrere Stellen, verschiedene Termine. Die Zahlen müssen in beiden Ländern übereinstimmen.",
      ],
    },
    {
      typ: "tabelle", id: "kosten", h2: "Laufende Kosten in jedem Jahr",
      lead: "Diese Kosten trägt eine LLC ab dem zweiten Jahr, auch ohne Umsatz. Die Staatsgebühren stammen aus den amtlichen Gebührenordnungen. Die übrigen Werte sind Marktspannen aus veröffentlichten Angaben mehrerer Anbieter.",
      kopf: ["Posten", "Betrag", "Wann"],
      zeilen: [
        ["Annual Report (Jahresmeldung), Florida", STAAT.florida.jahr, STAAT.florida.jahrFrist],
        ["Annual Report mit License Tax, Wyoming", `${STAAT.wyoming.jahr} (${STAAT.wyoming.jahrDetail})`, STAAT.wyoming.jahrFrist],
        ["Annual Tax der LLC, Delaware", STAAT.delaware.jahr, STAAT.delaware.jahrFrist],
        ["Registered Agent (vorgeschriebene Zustellanschrift im Bundesstaat)", MARKT.agent, "in jedem Jahr; Florida, Wyoming und Delaware schreiben ihn vor"],
        ["US-CPA für Form 5472 mit Form 1120", MARKT.cpa5472, "in jedem Jahr, zur Frist der IRS"],
        ["Steuerberater in Deutschland, Österreich oder der Schweiz", "nach Aufwand", "in jedem Jahr, mit Ihrer Steuererklärung"],
      ],
      fuss: [
        `Delaware: ${STAAT.delaware.jahrAlt}`,
        `Registered Agent und US-CPA: Marktspannen, Stand ${FAKTEN_STAND}, keine amtlichen Werte. Je nach Geschäft kommen die laufende Buchhaltung und Registrierungen zur Umsatzsteuer (Sales Tax) in einzelnen Bundesstaaten hinzu.`,
      ],
    },
    {
      typ: "text", id: "einordnung", h2: "Zwei Länder, zwei Einordnungen",
      absaetze: [
        `In den USA ist eine LLC mit einem Gesellschafter steuerlich nicht von ihrem Inhaber getrennt (disregarded entity). Eine LLC mit zwei oder mehr Gesellschaftern gilt als Personengesellschaft (partnership). Beide können mit Form 8832 wählen, wie eine Corporation besteuert zu werden. Dann zahlt die LLC in den USA ${IRS.koerperschaftsteuer} Bundes-Körperschaftsteuer auf ihren dort steuerpflichtigen Gewinn. Sie gibt außerdem eine vollständige Form 1120 ab.`,
        `Die Personengesellschaft hat eigene Pflichten. Sie gibt Form 1065 ab, bei Kalenderjahr fällig am ${FRISTEN.f1065}. Erzielt sie Einkünfte aus einem Geschäft in den USA, behält sie auf den Anteil ausländischer Gesellschafter Steuer ein (Section 1446). Der Einbehalt beträgt ${SCHWELLEN.abzug1446}. Der Gesellschafter gibt dann selbst eine US-Erklärung ab, als Privatperson mit Form 1040-NR. Die S-Corporation, die amerikanische Ratgeber oft nennen, kommt nicht in Betracht. Sie darf keinen Gesellschafter haben, der als Ausländer nicht in den USA ansässig ist (26 U.S.C. § 1361(b)(1)(C)).`,
        "In Deutschland ist die amerikanische Einordnung nicht maßgeblich. Das Finanzamt prüft in einem Typenvergleich, ob die LLC nach ihrem rechtlichen Aufbau eher einer Kapitalgesellschaft oder einer Personengesellschaft entspricht. Die Merkmale nennt das BMF-Schreiben vom 19. März 2004. Entscheidend ist das Gesamtbild; die Merkmale haben unterschiedliches Gewicht (BFH, Beschluss vom 18. Mai 2021, I B 75/20). Auch Österreich ordnet die LLC im Einzelfall nach einem Typenvergleich ein; die amerikanische Einordnung ist auch dort nicht maßgeblich (BMF Österreich, EAS 1413). Viele dieser Merkmale regelt das Operating Agreement, der Gesellschaftsvertrag der LLC. Wer es unverändert aus einer Vorlage übernimmt, legt damit auch Merkmale für die Einordnung fest.",
        "Der Nachteil liegt im Zusammenwirken beider Einordnungen. Die LLC kann in den USA steuerlich transparent und in Deutschland eine Kapitalgesellschaft sein, oder umgekehrt. Dann müssen Steuerberater und US-CPA beide Seiten abstimmen, damit beide Länder dieselben Zahlen erhalten. Für solche Gesellschaften enthält das Doppelbesteuerungsabkommen eine eigene Regel (Art. 1 Abs. 7).",
      ],
    },
    {
      typ: "text", id: "bank", h2: "Konto und Karten ohne US-Historie",
      absaetze: [
        `Eine US-Bank erhebt vor jeder Kontoeröffnung Name, Anschrift und eine Identifikationsnummer und prüft diese Angaben. Bei Ausländern kann das die Nummer des Reisepasses mit Ausstellerstaat sein. Für die Gesellschaft verlangt die Regel eine Hauptniederlassung, ein örtliches Büro oder einen anderen physischen Standort (31 CFR 1020.220). Die Bank identifiziert außerdem die wirtschaftlich Berechtigten: jeden, der ${SCHWELLEN.eigentuemer} oder mehr hält (31 CFR 1010.230).`,
        "Für Karten zählt die Kredithistorie in den USA. Einen FICO-Score (Bonitätswert) gibt es erst unter zwei Bedingungen. Mindestens ein Konto besteht seit sechs Monaten oder länger, und es wurde in den letzten sechs Monaten an die Auskunftei gemeldet. Wer neu in den USA ist, hat deshalb zunächst keinen Score. Mit der Executive Order 14406 vom 19. Mai 2026 hat der Präsident zudem das US-Finanzministerium angewiesen, Banken auf Warnzeichen hinzuweisen. Ein Warnzeichen für Banken ist danach die Nutzung einer ITIN (persönliche US-Steuernummer) für Konto- oder Kreditanträge durch Antragsteller ohne geprüften Aufenthaltsstatus in den USA. Eine ITIN anstelle einer Sozialversicherungsnummer kann nach der Anordnung als Risikofaktor gelten, der eine vertiefte Prüfung durch das Institut auslöst.",
        "Die Kreditprogramme 7(a) und 504 sichert die Small Business Administration (SBA) ab, eine US-Bundesbehörde. Einer LLC, deren Inhaber außerhalb der USA lebt, stehen sie nicht offen. Seit dem 1. März 2026 müssen die direkten und indirekten Eigentümer zu 100 Prozent US-Bürger oder US-Staatsangehörige mit Hauptwohnsitz in den USA sein (SBA Procedural Notice 5000-876626).",
        `${GLOBAL_PFLICHTHINWEIS.de[2]} Die Haftungstrennung der LLC schützt Sie nicht bei Verbindlichkeiten, für die Sie persönlich haften.`,
      ],
    },
    {
      typ: "tabelle", id: "strafen", h2: "Strafen bei Versäumnis",
      lead: "Sechs Pflichten und die Folge, wenn eine ausbleibt. Die Grundlage steht in der letzten Spalte.",
      kopf: ["Versäumt", "Folge", "Grundlage"],
      zeilen: [
        ["Form 5472 nicht oder nicht rechtzeitig eingereicht, Aufzeichnungen nicht geführt", `${IRS.strafe5472}; dauert das Versäumnis nach einer Mitteilung der IRS mehr als neunzig Tage an, je angefangene dreißig Tage weitere 25.000 US-Dollar`, "IRS, Instructions for Form 5472"],
        ["Meldung nach § 138 Abs. 2 AO nicht, unvollständig oder verspätet, vorsätzlich oder leichtfertig", "Bußgeld von höchstens 25.000 Euro", "§ 379 Abs. 2 und 7 AO"],
        ["Annual Report in Florida", `${STAAT.florida.jahrVerzug}; fehlt der Bericht am dritten Freitag im September, löst der Staat die LLC am vierten Freitag im September von Amts wegen auf`, "Florida Statutes, §§ 607.193 und 605.0714"],
        ["Annual Report in Wyoming", STAAT.wyoming.jahrVerzug, "Wyoming Secretary of State"],
        ["Annual Tax in Delaware", STAAT.delaware.jahrVerzug, "Delaware Code, Title 6, § 18-1107"],
        ["Kein Registered Agent", "in Florida ein Grund für die Auflösung von Amts wegen; nach der Ankündigung bleiben sechzig Tage, um den Mangel zu beheben", "Florida Statutes, § 605.0714"],
      ],
      fuss: ["Stand Oktober 2026. Gebühren und Folgen der Bundesstaaten nach deren amtlichen Angaben. In Florida lässt sich eine aufgelöste LLC wieder in Kraft setzen; dafür sind alle offenen Gebühren und Strafen zu zahlen (Florida Statutes, § 605.0715)."],
    },
    {
      typ: "karten", id: "nicht-passt", h2: "Wann eine US-LLC nicht passt", spalten: 3,
      lead: "Sechs Fälle, in denen die Nachteile einer LLC ihren Nutzen in der Regel überwiegen.",
      karten: [
        { tag: "Passt nicht", titel: "Kein Geschäft in den USA", text: "Ohne US-Kunden, US-Verträge oder US-Plattformen hat die LLC keine Aufgabe. Ihr bleiben dann Pflichten und Kosten in zwei Ländern." },
        { tag: "Passt nicht", titel: "Steuern als einziger Grund", text: "Wer die LLC vor allem gründet, um im Wohnsitzland weniger Steuern zu zahlen, geht von einer falschen Annahme aus. Steuerpflichtig ist die LLC dort, wo sie geführt wird (§ 10 AO). Dient eine unangemessene Gestaltung vor allem der Steuer und fehlen beachtliche außersteuerliche Gründe, kann sie als Missbrauch nach § 42 AO gelten.", pfad: "/business/wissen/us-llc-steuern" },
        { tag: "Passt nicht", titel: "Kunden nur im deutschsprachigen Raum", text: "Eine LLC, die von Deutschland aus geleitet wird, rechnet gegenüber deutschen Unternehmen in der Regel mit deutscher Umsatzsteuer ab (§ 13b Abs. 7 UStG). Für ein reines Inlandsgeschäft entstehen zusätzliche Pflichten in den USA, meist ohne Nutzen." },
        { tag: "Passt nicht", titel: "Aufenthaltsrecht als Ziel", text: "Eine LLC allein berechtigt nicht, in den USA zu leben oder zu arbeiten. Das E-2-Visum etwa setzt die Staatsangehörigkeit eines Vertragsstaats und eine substanzielle Investition in ein echtes Unternehmen voraus. Das Unternehmen muss mehr als einen bescheidenen Lebensunterhalt erwirtschaften können. Ob ein Visum in Ihrem Fall in Betracht kommt, prüft ein US-Einwanderungsanwalt.", pfad: "/business/wissen/e2-visum" },
        { tag: "Passt nicht", titel: "Pflichten ohne Zeit und Budget", text: "Die jährlichen Pflichten kosten Zeit und Geld: Form 5472, die Jahresmeldung beim Bundesstaat, die Steuererklärung im Wohnsitzland. Hinzu kommt der Registered Agent. Wer Zeit und Geld dafür nicht einplant, riskiert die Strafen aus der Tabelle oben." },
        { tag: "Passt nicht", titel: "Anonymität als Ziel", text: `Banken identifizieren jeden, der ${SCHWELLEN.eigentuemer} oder mehr hält. Das Finanzamt erfährt von der Gesellschaft durch die Meldung nach § 138 AO. Anonymität bietet eine LLC damit nicht.` },
      ],
    },
    {
      typ: "text", id: "sinnvoll", h2: "Wann eine US-LLC sinnvoll ist",
      absaetze: [
        "Die Nachteile wiegen leichter, wenn die Gesellschaft ein Geschäft in den USA betreibt. Dann steht den Meldungen und Kosten ein Nutzen gegenüber. Sechs typische Fälle:",
      ],
      punkte: [
        "Sie haben Kunden in den USA, die einen US-Vertragspartner, eine US-Rechnung und Zahlungen in US-Dollar erwarten.",
        "Sie verkaufen über US-Plattformen oder Zahlungsdienste, die eine US-Gesellschaft mit Steuernummer (EIN) und US-Konto verlangen.",
        "Sie bauen ein Team, ein Lager oder ein Büro in den USA auf, oder Ihr Unternehmen braucht eine Tochtergesellschaft für den Markteintritt.",
        "Sie wollen über Jahre die Bonität und die Zahlungshistorie der Gesellschaft in den USA aufbauen. Das verlangt Zeit, geordnete Zahlen und in der Regel Ihre persönliche Haftung bei den ersten Karten.",
        "Sie planen eine Investition in ein echtes US-Unternehmen, das später Teil eines Visumsantrags sein kann. Ob das in Ihrem Fall ausreicht, prüft ein US-Einwanderungsanwalt.",
        `Sie wollen für die Gesellschaft in den USA Konten, Karten oder eine Finanzierung beantragen. Über jeden Antrag entscheidet das jeweilige Institut. ${KAPITAL_FREI}`,
      ],
      nach: "Ein Nachteil aus älteren Darstellungen ist entfallen: In den USA gegründete Gesellschaften geben seit August 2026 keine BOI-Meldung an FinCEN mehr ab.",
    },
    { typ: "zitat", id: "ehrlich", text: EHRLICH, quelle: "FIAON Global" },
    {
      typ: "text", id: "fiaon", h2: "Was FIAON Global dabei übernimmt",
      absaetze: [
        `Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein und beantragen die Steuernummern. Im ersten Jahr enthalten: der Pflichtenkalender, die erste Jahresmeldung beim Bundesstaat und ${US_MELDUNG} (Form 5472 mit Form 1120).`,
        JAHRESBETREUUNG,
      ],
      punkte: [
        `${TEIL.ihrTeil}: ${GRUENDUNG.ihrTeil} ${UNTERLAGEN.ihrTeil}`,
        `Konto und Karten: ${satz("S2", "de")}`,
        `${TEIL.bedingung}: ${satz("S3", "de")}`,
      ],
    },
    { typ: "paket", id: "mandat", h2: P.karteH2, lead: P.karteLead, paket: "global_struktur" },
    {
      typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen",
      punkte: [
        `Diese Seite erklärt Grundlagen (Stand Oktober 2026) und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls. ${STEUERFRAGEN}. Fragen zu Visum und Aufenthalt klärt ein US-Einwanderungsanwalt.`,
        GLOBAL_PFLICHTHINWEIS.de[0],
        GLOBAL_PFLICHTHINWEIS.de[1],
        `Nicht in Ihrem Mandat enthalten: ${GLOBAL_NICHT_INKLUSIVE.de[1]}.`,
        satz("S8", "de"),
        satz("S10", "de"),
      ],
    },
  ],
  fragen: [
    { f: "Welche Nachteile hat eine US-LLC für Unternehmer aus Deutschland?", a: `Vor allem fünf. Die Steuerpflicht bleibt in Deutschland, wenn Sie die LLC von dort aus leiten (§ 10 AO). Meldepflichten bestehen in zwei Ländern: Form 5472 an die IRS, die Meldung nach § 138 AO ans Finanzamt. In jedem Jahr fallen Kosten für Staatsgebühr, Registered Agent und US-CPA an. Ohne US-Historie gibt es zunächst keinen Score; über Konto und Karten entscheidet das jeweilige Institut. Für ein Versäumnis kann die IRS ${STRAFE_5472} je fehlender Form 5472 festsetzen.` },
    { f: "Lohnt sich eine US-LLC?", a: "Mit einem Geschäft in den USA können die Vorteile überwiegen, etwa bei US-Kunden, US-Plattformen oder einem Markteintritt mit Team. Als Steuermodell lohnt sie sich nicht. Wer sie vom Wohnsitzland aus führt, bleibt dort steuerpflichtig und trägt zusätzlich Pflichten und Kosten in den USA. Ihren Einzelfall beurteilt Ihr Steuerberater." },
    { f: "Ist eine US-LLC „steuerfrei“?", a: "Nein. Eine LLC mit einem ausländischen Gesellschafter zahlt in den USA oft keine Bundessteuer, solange sie dort kein Geschäft hat. Steuerpflichtig ist sie dort, wo sie geführt wird. Das folgt in Deutschland aus § 10 AO, in Österreich aus § 1 Abs. 2 KStG 1988, in der Schweiz aus Art. 50 DBG." },
    { f: "Was kostet eine US-LLC jedes Jahr?", a: `Drei Posten in den USA: die Staatsgebühr, der Registered Agent (${MARKT.agent}) und der US-CPA für Form 5472 (${MARKT.cpa5472}). Die beiden letzten Werte sind Marktspannen, Stand ${FAKTEN_STAND}. Die Staatsgebühr beträgt in Florida ${STAAT.florida.jahr}, in Wyoming ${STAAT.wyoming.jahr}, in Delaware ${STAAT.delaware.jahr}. Hinzu kommt Ihr Steuerberater im Wohnsitzland. Diese Kosten fallen auch ohne Umsatz an.` },
    { f: "Was passiert, wenn ich Form 5472 nicht einreiche?", a: `Die IRS kann eine Strafe von ${IRS.strafe5472} festsetzen. Dasselbe gilt, wenn die vorgeschriebenen Aufzeichnungen fehlen. Dauert das Versäumnis nach ihrer Mitteilung mehr als neunzig Tage an, kommen je angefangene dreißig Tage weitere 25.000 US-Dollar hinzu. Die Pflicht hängt nicht vom Umsatz ab: Schon Zahlungen bei der Gründung, Einlagen und Entnahmen sind meldepflichtig.` },
    { f: "Komme ich mit einer US-LLC zu einem US-Konto und zu Kreditkarten?", a: "Darüber entscheidet das jeweilige Institut. Ohne US-Historie gibt es zunächst keinen FICO-Score. Herausgeber verlangen für Firmenkreditkarten in der Regel Ihre persönliche Haftung. Nach der Executive Order 14406 kann eine ITIN statt einer Sozialversicherungsnummer als Warnzeichen gelten, das eine vertiefte Prüfung durch das Institut auslöst. Vollständige Unterlagen ohne Widersprüche zählen deshalb mehr als die Zahl der Anträge." },
    { f: "Darf ich mit einer US-LLC in den USA leben und arbeiten?", a: "Nein, die Gesellschaft allein berechtigt nicht dazu; dafür brauchen Sie ein Visum. Das E-2-Visum für Investoren etwa setzt die Staatsangehörigkeit eines Vertragsstaats und eine substanzielle Investition in ein echtes Unternehmen voraus. Das Unternehmen muss mehr als einen bescheidenen Lebensunterhalt erwirtschaften können. Ob das Visum in Ihrem Fall in Betracht kommt, prüft ein US-Einwanderungsanwalt." },
    { f: "Wann passt eine US-LLC nicht?", a: `Wenn es kein Geschäft in den USA gibt oder wenn Steuern der einzige Grund sind. Ebenso, wenn die Kunden nur in Deutschland, Österreich oder der Schweiz sitzen oder wenn Zeit und Budget für die jährlichen Pflichten fehlen. ${EHRLICH}` },
  ],
  paket: "global_struktur",
  weiter: ["/business/wissen/us-llc-steuern", "/business/wissen/llc-oder-gmbh", "/business/wissen/us-llc-wohnsitz-deutschland", "/business/kosten"],
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
