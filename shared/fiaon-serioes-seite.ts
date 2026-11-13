// ═══════════════════════════════════════════════════════════════════════════
// DIE VERTRAUENSSEITE ALS SEITE VON FIAON GLOBAL (E-459, 29.10.2026 · neu gefasst E-510, 13.11.2026)
//
// Justin (29.10.): „Die ganze Seite muss auf das Business-Konzept umgebaut werden, komplett — auch in unserem
// Apple-Design und alles auf Business.“ Die Seite ist darum ein Datensatz im Format der Business-Unterseiten
// (shared/fiaon-global-seiten/typen.ts) und erscheint in deren Vorlage (client/src/pages/site/global-seite.tsx):
// Kopf mit „Auf einen Blick“, Inhaltsverzeichnis, Abschnitte, Fragen, Gespräch — im Apple-Glas der Business-Welt.
// Sie steht NICHT im Register (ihre Adresse liegt außerhalb von /business, Menü und Prüfstand des Registers gelten
// dort nicht); der Server trägt sie selbst in die SEO-Tabelle ein (server/lib/fiaon-global-seo.ts).
//
// E-510 (13.11.2026, Justin: „keine Magie, sondern knallharte Fakten“ — Sprachleitfaden FIAON Global):
// · Leitsatz „Prüfen Sie uns an Fakten, nicht an Versprechen.“ und drei belegte Tatsachen (Leitfaden 6): der Eintrag im
//   Companies House, der Vertrag vor der Unterschrift, die Zahlung per Rechnung statt Abbuchung.
// · Die festen Sätze (S1 bis S17), die Belege (6.2), der Rollen-Satz und die Positionierung kommen aus
//   shared/fiaon-global-saetze.ts — hier wird keiner ein zweites Mal getippt. Kein Betrag ist getippt (SAETZE_BETRAEGE).
// · Die Presse-Zeile steht NICHT in diesem Text: Die Vorlage setzt sie einmal je Seite im Vertrauens-Band
//   (global-seite.tsx → GlobalVertrauen). Ein zweites Mal wäre ein Verstoß (Leitfaden 6.1).
// · „Kein Kreditvermittler“: nur der Satz aus S8 („FIAON vergibt und vermittelt keine Kredite.“), S9 und S1 — kein
//   eigener Satz zum Honorar daneben (Vorbehalt V3). Das Honorar steht in den drei Zeilen aus S12, die Erstattung in S7.
// · Kein Partner bei der Arbeit im Präsens (V2): nur die Rollenwörter „Partner-Anwälte“, „US-Steuerberater (CPA) aus
//   unserem Partnernetz“, „in eigener Verantwortung“. Kein Wort dazu, wer für eine Finanzierung einsteht. Das
//   Widerrufsrecht steht hier nicht (Leitfaden 6.4, Vorbehalt V4) — nur der Verweis auf die Seite „Vertrag im Überblick“.
//
// Fakten nur aus ihren einen Quellen: Firma (fiaon-firma.ts), Konto (fiaon-bank.ts), Pflichthinweise (fiaon-global.ts),
// Sätze und Beträge (fiaon-global-saetze.ts). Wortgrenzen von FIAON Global: kein „bis zu“, kein „beraten“, keine
// Zinsen, keine Kapitalzusage, kein Steuermodell; über Konto, Karte und Finanzierung entscheidet das Institut.
// „Unternehmensberatung“ als Selbstbezeichnung erlaubt (E-439, nicht auf der AT-Seite).
// Die Bankverbindung steht bewusst im Text (E-445: woran Sie uns erkennen) — immer aus BANK, nie von Hand.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "./fiaon-global-seiten/typen";
import { FIAON_FIRMA as F } from "./fiaon-firma";
import { BANK, BANK_AED } from "./fiaon-bank";
import { GLOBAL_PFLICHTHINWEIS } from "./fiaon-global";
import { GELD_ZURUECK, SAETZE_BETRAEGE, beleg, satz, weitererSatz } from "./fiaon-global-saetze";
import { SERIOES_PFAD, SERIOES_KOPF, SERIOES_STAND, COMPANIES_HOUSE_URL } from "./fiaon-serioes";

/** Stand, Beschreibung und Einleitung kommen aus shared/fiaon-serioes.ts — eine Quelle für die Seite und die SEO-Tabelle. */
const STAND = SERIOES_STAND;
const KOPF = SERIOES_KOPF;

/** Die Sätze eines festen Wortlauts (getrennt an „Punkt Leerzeichen“) — um einen Teil zu zeigen, ohne ihn neu zu tippen. */
const saetzeVon = (text: string): string[] => text.split(/(?<=\.)\s+/);
const B = SAETZE_BETRAEGE;
/** Das Honorar in Kurzform (Leitfaden 1.3, Antwort „Was kostet es — und wann?“) — immer alle drei Teile, Beträge aus der Preisquelle. */
const HONORAR = {
  de: `${B.de.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr auf Wunsch ${B.de.jahresbetreuung} im Jahr.`,
  en: `${B.en.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.en.erfolgMin}. From the second year, on request, ${B.en.jahresbetreuung} a year.`,
};
/** Der Schluss derselben Antwort: Alle Beträge stehen im Angebot, bevor der Klient unterzeichnet. */
const HONORAR_VORAB = {
  de: "Alle Beträge sind Endpreise und stehen in Ihrem Angebot, bevor Sie unterzeichnen.",
  en: "All fees are stated in full in your proposal before you sign.",
};
/** S12, vierter Satz: die Jahresbetreuung ab dem zweiten Jahr — auf Wunsch, verlängert sich nicht von selbst. */
const JAHRESBETREUUNG = { de: saetzeVon(satz("S12"))[3], en: saetzeVon(satz("S12", "en"))[3] };
/** S8 in seinen drei Sätzen: keine Bank, keine Kanzlei · keine Kredite · Recht und Steuern bei Partnern in eigener Verantwortung. */
const S8 = { de: saetzeVon(satz("S8")), en: saetzeVon(satz("S8", "en")) };
/** Der Rollen-Satz zu den Partnern (Leitfaden 5.11); sein zweiter Satz sagt, wer ihre Honorare trägt. */
const ROLLEN = { de: weitererSatz("ROLLEN"), en: weitererSatz("ROLLEN", "en") };
const HONORARE_DER_PARTNER = { de: saetzeVon(ROLLEN.de)[1], en: saetzeVon(ROLLEN.en)[1] };

// Geld zurück, wenn die Finanzierung ausbleibt: die Kurz-Form S7 (Vertrag, Ziffer 4) mit ihrer Augenzeile — ohne das
// Hauptwort, das auf Unterseiten nicht steht (Leitfaden 5.7). S7 nennt Fristbeginn, Ziffer 4 und das Institut.
const GZ = {
  de: { titel: GELD_ZURUECK.de.auge, text: GELD_ZURUECK.de.kurz },
  en: { titel: GELD_ZURUECK.en.auge, text: GELD_ZURUECK.en.kurz },
};

const QUELLEN_DE = [
  { titel: `Companies House (England and Wales): ${F.name}, Nr. ${F.companyNo}`, url: COMPANIES_HOUSE_URL },
  { titel: "§ 49b Bundesrechtsanwaltsordnung (BRAO) — Vergütung", url: "https://www.gesetze-im-internet.de/brao/__49b.html" },
  { titel: "§ 9 Steuerberatungsgesetz (StBerG) — Vergütung", url: "https://www.gesetze-im-internet.de/stberg/__9.html" },
  { titel: "§ 138 Abgabenordnung (AO) — Anzeige ausländischer Beteiligungen", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  { titel: "Datenschutz-Grundverordnung (DSGVO), Art. 15 bis 17", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
];

const de: GlobalSeite = {
  pfad: SERIOES_PFAD.de, sprache: "de", schwester: SERIOES_PFAD.en, art: "partner",
  seo: { titel: SERIOES_KOPF.de.titel, beschreibung: KOPF.de.beschreibung },
  stand: STAND, erschienen: "2026-10-28", kennung: "FG · Fakten",
  auge: "FIAON Global · Die Fakten",
  h1: SERIOES_KOPF.de.h1, h1b: SERIOES_KOPF.de.h1b, lead: KOPF.de.lead,
  ziffern: [
    { wert: F.companyNo, label: "Companies House (England und Wales)" },
    { wert: "Vertrag", label: "vollständig lesbar, bevor Sie unterzeichnen" },
    { wert: "Rechnung", label: `Zahlung nur per Überweisung an die ${F.name}` },
  ],
  blick: [
    ["Vertragspartner", `${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Register", `Companies House (England und Wales), Nr. ${F.companyNo} — öffentlich einsehbar`],
    ["Leitung", `${F.director} (Director), Gründer`],
    ["Honorar", HONORAR.de],
    ["Zahlung", `Per Rechnung, nur per Überweisung an ${BANK.empfaenger} — kein Abo, keine Abbuchung`],
    ["Vertrag", "Auf Deutsch, nach deutschem Recht; vollständig lesbar, bevor Sie unterzeichnen"],
    ["Ihre Unterlagen", "Server in Frankfurt am Main, verschlüsselt, nach DSGVO"],
    ["Kontakt", `${F.telefon} · ${F.email}`],
  ],
  kurz: `${weitererSatz("LEITSATZ")} FIAON Global ist die Unternehmensberatung der ${F.name}, eingetragen im Companies House (England und Wales) unter Nr. ${F.companyNo}. Ihren vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen. ${weitererSatz("ZAHLUNG")}`,
  bloecke: [
    {
      typ: "karten", id: "wer", h2: "Wer hinter FIAON Global steht", spalten: 2,
      lead: `FIAON Global ist die Unternehmensberatung der ${F.name} für Unternehmen, Gründer und Privatpersonen, die eine US-Gesellschaft gründen. Die ${F.name}, eingetragen im Companies House (England und Wales) unter Nr. ${F.companyNo}, hat ihren Sitz in ${F.strasse}, ${F.ortZeile}. Geschäftsführer (Director) ist der Gründer ${F.director}. Ihr Vertragspartner ist in jedem Fall die ${F.name}. ${ROLLEN.de}`,
      karten: [
        { tag: "Register", titel: "Registereintrag prüfen", text: `Companies House · Nr. ${F.companyNo} — öffentlich einsehbar, ohne Anmeldung.`, pfad: COMPANIES_HOUSE_URL },
        { tag: "Pflichtangaben", titel: "Impressum", text: `Alle Pflichtangaben der ${F.name}.`, pfad: "/impressum?bereich=business" },
        { tag: "Überblick", titel: "Auf einen Blick", text: "Was geschieht, was es kostet, was Sie selbst tun und was gilt, wenn etwas ausbleibt.", pfad: "/#auf-einen-blick" },
        { tag: "Privatkunden", titel: "FIAON für Privatkunden", text: "Bonität, Konto und Karte: Laufzeit, Monatsentgelt und Ablauf stehen auf einer eigenen Seite.", pfad: "/fiaon-erfahrungen" },
      ],
    },
    {
      typ: "tabelle", id: "zahlung", h2: "Wohin Sie zahlen — und woran Sie uns erkennen",
      lead: `${beleg("zahlung")} Sie überweisen auf das Geschäftskonto der ${BANK.empfaenger}; es gibt keine Lastschrift, keine Kartenabbuchung und kein Abo. Jede Zahlung lösen Sie selbst aus. Jede Rechnung nennt Ihren Verwendungszweck und diese Bankverbindung.`,
      kopf: ["Angabe", "Bankverbindung"],
      zeilen: [["Empfänger", BANK.empfaenger], ["IBAN", BANK.ibanDisplay], ["BIC", BANK.bic], ["Bank", BANK.bank]],
      fuss: [
        `Für Zahlungen aus den Vereinigten Arabischen Emiraten nennen wir Ihnen auf Wunsch ein zweites Konto der ${BANK_AED.empfaenger} in ${BANK_AED.waehrung}. IBAN: ${BANK_AED.ibanDisplay}, ${BANK_AED.bank}. Andere Konten gibt es nicht.`,
        "FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto. Fordert Sie jemand im Namen von FIAON dazu auf, zahlen Sie bitte nicht und melden Sie es uns umgehend.",
      ],
    },
    {
      typ: "karten", id: "vertrag", h2: "Was vor Ihrer Unterschrift feststeht", spalten: 2,
      lead: "Honorar, Leistungen und Vertrag kennen Sie, bevor Sie unterzeichnen. Der Vertrag ist auf Deutsch verfasst und folgt deutschem Recht. Seinen Aufbau zeigt die Seite „Vertrag im Überblick“; dort steht auch, was für Verbraucher gilt.",
      karten: [
        { tag: "Honorar", titel: "Honorar vorab", text: `${HONORAR.de} ${HONORAR_VORAB.de}`, pfad: "/business/kosten" },
        { tag: "Vertrag", titel: "Ihr Vertrag im Überblick", text: "Was der Vertrag regelt. Den vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.", pfad: "/business/mustervertrag" },
        { tag: "Erstattung", titel: GZ.de.titel, text: GZ.de.text },
        { tag: "Jahr zwei", titel: "Jahresbetreuung nur auf Wunsch", text: `${JAHRESBETREUUNG.de} Berechnet wird sie jährlich im Voraus.` },
      ],
    },
    {
      typ: "karten", id: "was", h2: "Was FIAON Global ist — und was nicht", spalten: 2,
      lead: `${weitererSatz("POSITIONIERUNG")} Wir gründen, bereiten vor und begleiten. Die Anträge stellen Sie selbst. Es entscheiden Behörden und Institute.`,
      karten: [
        { titel: "Keine Bank", text: `FIAON führt keine Konten und gibt keine Karten aus. ${beleg("keinZugriff")} Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut.` },
        { titel: "Kein Kreditvermittler", text: `${S8.de[1]} ${satz("S9")} ${satz("S1")}` },
        { titel: "Kein Steuermodell", text: `${satz("S10")} Die Gründung melden Sie dem Finanzamt Ihres Wohnsitzlandes, in Deutschland nach § 138 AO.` },
        { titel: "Keine Kanzlei", text: `FIAON koordiniert Ihr Mandat. ${S8.de[2]} ${HONORARE_DER_PARTNER.de}` },
      ],
    },
    { typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen", punkte: [...GLOBAL_PFLICHTHINWEIS.de] },
    {
      typ: "text", id: "unterlagen", h2: "Was mit Ihren Unterlagen geschieht",
      absaetze: [
        `Ihre Unterlagen laden Sie in Ihrem Portal hoch. ${beleg("daten")} Verschlüsselt sind sie bei der Übertragung und bei der Ablage. Wir geben Ihre Unterlagen nur weiter, soweit Ihr Mandat es erfordert:`,
      ],
      punkte: [
        "an die US-Behörden, bei denen wir einreichen: den Bundesstaat für die Gründung und die US-Steuerbehörde für die Steuernummern",
        "an den Registered Agent Ihrer Gesellschaft",
        "an Partner-Anwälte und US-Steuerberater (CPA) aus unserem Partnernetz, soweit Ihr Vertrag ihre Leistung vorsieht",
        "an Institute und Kartenherausgeber — nur, soweit Sie uns damit beauftragen",
      ],
      nach: "An Werbenetzwerke geben wir nichts weiter. Auskunft, Berichtigung und Löschung nach Art. 15 bis 17 DSGVO können Sie jederzeit verlangen. Nach dem Ende des Mandats löschen wir Ihre Unterlagen auf Wunsch vollständig; nur Rechnungsdaten bewahren wir aus gesetzlichen Gründen auf.",
    },
    {
      typ: "karten", id: "partner", h2: "Für Partner: Steuerberater, Anwälte, Finanzierer", spalten: 2,
      lead: "Für Steuerberater, Anwälte und Finanzierer, die FIAON Global für ihre Mandanten prüfen, gilt dasselbe wie für Klienten. Jede Vereinbarung steht vorab schriftlich fest.",
      karten: [
        { tag: "Vereinbarung", titel: "Alles schriftlich", text: "Jede Zusammenarbeit steht vorher in einer schriftlichen Vereinbarung, mit Leistungen und Bedingungen." },
        { tag: "Gutschrift", titel: "Abrechnung per Gutschrift", text: "Wer als Tippgeber oder Kooperationspartner vergütet wird, erhält eine Gutschrift mit Monatsbericht." },
        { tag: "Berufsrecht", titel: "Unabhängigkeit der Partner", text: "Anwälte und Steuerberater erhalten für das Zuführen von Mandanten keine Vergütung und keinen sonstigen Vorteil (§ 49b Abs. 3 BRAO, § 9 StBerG). Wirken sie an den Leistungen eines Vertrags mit, trägt FIAON ihre Honorare dafür." },
        { tag: "Kontakt", titel: "Partner werden", text: `Schreiben Sie uns an ${F.email} — Bedingungen und Vereinbarung erhalten Sie schriftlich.`, pfad: `mailto:${F.email}?subject=Partnerschaft%20FIAON%20Global` },
      ],
    },
    {
      typ: "text", id: "kontakt", h2: "So erreichen Sie uns",
      absaetze: [
        `Telefonisch werktags unter ${F.telefon} (Deutsch und Englisch) und per E-Mail an ${F.email}. Das Erstgespräch dauert dreißig Minuten, ist kostenfrei und ohne Verpflichtung. Danach begleitet ein fester Ansprechpartner Ihr Mandat.`,
        `Als Klient sehen Sie in Ihrem Portal, welcher Schritt läuft und was als Nächstes folgt. Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "text", id: "verwechslung", h2: "Nicht verwechseln",
      absaetze: [
        `FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die ${F.name} in London. Erfahrungsberichte, Warnungen und Profile unter ähnlich klingenden Namen betreffen andere Unternehmen. Prüfen Sie bei jedem Eintrag, den Sie im Netz finden, Name und Anschrift. Fragen Sie uns direkt, wenn etwas nicht zusammenpasst.`,
      ],
    },
  ],
  fragen: [
    { f: "Ist FIAON Global seriös?", a: `Prüfen Sie es an Fakten statt an Versprechen. FIAON Global ist die Unternehmensberatung der ${F.name}, eingetragen im Companies House (England und Wales) unter Nr. ${F.companyNo}. Der Sitz der Gesellschaft ist ${F.strasse}, ${F.ortZeile}. Ihr Honorar und Ihren vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen. ${beleg("zahlung")}` },
    { f: "Wer steht hinter FIAON Global?", a: `Die ${F.name} mit Sitz in ${F.strasse}, ${F.ortZeile}, eingetragen im Companies House unter Nr. ${F.companyNo}. Geschäftsführer ist der Gründer ${F.director}. Den Eintrag können Sie ohne Anmeldung einsehen; alle Pflichtangaben stehen im Impressum. Ihr Vertragspartner ist in jedem Fall die ${F.name}. ${ROLLEN.de}` },
    { f: "Wohin zahle ich, und woran erkenne ich eine echte Rechnung?", a: `Sie zahlen nur per Überweisung an ${BANK.empfaenger}; die Bankverbindung steht auf dieser Seite und auf jeder Rechnung, zusammen mit Ihrem Verwendungszweck. Für Zahlungen aus den Vereinigten Arabischen Emiraten nennen wir Ihnen auf Wunsch ein zweites Konto der ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} (IBAN ${BANK_AED.ibanDisplay}). Andere Konten gibt es nicht. FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto. Erhalten Sie eine solche Aufforderung im Namen von FIAON, zahlen Sie bitte nicht. Melden Sie sich bei ${F.email} oder unter ${F.telefon}.` },
    { f: "Was kostet FIAON Global, und verlängert sich etwas von selbst?", a: `${satz("S12")} ${saetzeVon(weitererSatz("ZAHLUNG"))[1]}` },
    { f: "Ist FIAON eine Bank oder ein Kreditvermittler?", a: `Nein. ${S8.de[0]} ${S8.de[1]} ${satz("S2")} ${satz("S9")} ${satz("S1")}` },
    { f: "Spare ich mit einer US-Gesellschaft Steuern?", a: `Nein. ${satz("S10")} Die Gründung melden Sie dem Finanzamt Ihres Wohnsitzlandes, in Deutschland nach § 138 AO. ${S8.de[2]}` },
    { f: "Was gilt, wenn die Finanzierung ausbleibt?", a: GZ.de.text },
    { f: "Was passiert mit meinen Unterlagen?", a: `Sie laden sie in Ihrem Portal hoch. ${beleg("daten")} Wir geben sie nur weiter, soweit Ihr Mandat es erfordert. Empfänger sind die US-Behörden, bei denen wir einreichen, der Registered Agent und Partner, deren Leistung Ihr Vertrag vorsieht. An Institute und Kartenherausgeber gehen sie nur, soweit Sie uns damit beauftragen, an Werbenetzwerke nie. Auskunft, Berichtigung und Löschung nach der DSGVO können Sie jederzeit verlangen.` },
    { f: "Wie arbeite ich als Steuerberater, Anwalt oder Finanzierer mit FIAON zusammen?", a: `Über eine schriftliche Vereinbarung, die vor dem Beginn feststeht. Wer als Tippgeber oder Kooperationspartner vergütet wird, erhält eine Gutschrift mit Monatsbericht. Anwälte und Steuerberater erhalten für das Zuführen von Mandanten keine Vergütung und keinen sonstigen Vorteil (§ 49b Abs. 3 BRAO, § 9 StBerG). Wirken sie an den Leistungen eines Vertrags mit, trägt FIAON ihre Honorare dafür. Schreiben Sie uns an ${F.email}.` },
    { f: "Warum finde ich Warnungen oder Erfahrungsberichte, die nicht zu FIAON passen?", a: `Weil es Unternehmen mit ähnlich klingenden Namen gibt. FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die ${F.name} in London. Warnlisten von Aufsichtsbehörden und Verbraucherportalen nennen Anbieter mit Namen und Anschrift. Prüfen Sie beides genau, und fragen Sie uns direkt, wenn etwas nicht zusammenpasst.` },
  ],
  weiter: ["/business/was-ist-fiaon-global", "/business/kosten", "/business/ablauf", "/business/fragen"],
  quellen: QUELLEN_DE,
  schluss: { a: "Prüfen Sie uns. ", b: "Dann sprechen wir.", text: "Dreißig Minuten, kostenfrei und ohne Verpflichtung — mit Ihrem festen Ansprechpartner." },
  prio: 0.8,
};

const en: GlobalSeite = {
  pfad: SERIOES_PFAD.en, sprache: "en", schwester: SERIOES_PFAD.de, art: "partner",
  seo: { titel: SERIOES_KOPF.en.titel, beschreibung: KOPF.en.beschreibung },
  stand: STAND, erschienen: "2026-10-28", kennung: "FG · Facts",
  auge: "FIAON Global · The facts",
  h1: SERIOES_KOPF.en.h1, h1b: SERIOES_KOPF.en.h1b, lead: KOPF.en.lead,
  ziffern: [
    { wert: F.companyNo, label: "Companies House, England and Wales" },
    { wert: "Agreement", label: "readable in full before you sign" },
    { wert: "Invoice", label: `payment by bank transfer to ${F.name} only` },
  ],
  blick: [
    ["Contracting party", `${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Register", `Companies House (England and Wales), company number ${F.companyNo} — open to the public`],
    ["Management", `${F.director} (Director), founder`],
    ["Fees", HONORAR.en],
    ["Payment", `By invoice, bank transfer to ${BANK.empfaenger} only — no subscription, no direct debit`],
    ["Agreement", "In German, under German law; readable in full before you sign"],
    ["Your documents", "Servers in Frankfurt am Main, encrypted, under the GDPR"],
    ["Contact", `${F.telefon} · ${F.email}`],
  ],
  kurz: `${weitererSatz("LEITSATZ", "en")} FIAON Global is the business consultancy of ${F.name}, registered in England and Wales under company number ${F.companyNo}. You read your complete agreement in your personal proposal before you sign. ${weitererSatz("ZAHLUNG", "en")}`,
  bloecke: [
    {
      typ: "karten", id: "wer", h2: "Who is behind FIAON Global", spalten: 2,
      lead: `FIAON Global is the business consultancy of ${F.name} for companies, founders and private individuals forming a US company. ${F.name}, registered in England and Wales under company number ${F.companyNo}, has its registered office at ${F.strasse}, ${F.ortZeile}. The Director is the founder, ${F.director}. Your contracting party is always ${F.name}. ${ROLLEN.en}`,
      karten: [
        { tag: "Register", titel: "Check the register entry", text: `Companies House · company number ${F.companyNo} — open to the public, no account needed.`, pfad: COMPANIES_HOUSE_URL },
        { tag: "Statutory details", titel: "Legal notice", text: `All statutory details of ${F.name}.`, pfad: "/impressum?bereich=business" },
        { tag: "Overview", titel: "At a glance", text: "What happens, what it costs, what you do yourself and what applies if something does not come about.", pfad: "/en#auf-einen-blick" },
        { tag: "Personal clients", titel: "FIAON for personal clients", text: "Credit standing, account and card: term, monthly fee and process are set out on a separate page.", pfad: "/en/how-fiaon-works" },
      ],
    },
    {
      typ: "tabelle", id: "zahlung", h2: "Where you pay — and how to recognise us",
      lead: `${beleg("zahlung", "en")} You transfer the amount to the business account of ${BANK.empfaenger}; there are no direct debits, no card charges and no subscription. You make every payment yourself. Every invoice states your payment reference and this account.`,
      kopf: ["Item", "Bank details"],
      zeilen: [["Recipient", BANK.empfaenger], ["IBAN", BANK.ibanDisplay], ["BIC", BANK.bic], ["Bank", BANK.bank]],
      fuss: [
        `For payments from the United Arab Emirates, we give you a second account of ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} on request. IBAN: ${BANK_AED.ibanDisplay}, ${BANK_AED.bank}. There are no other accounts.`,
        "FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account. If anyone asks you to do so in FIAON’s name, please do not pay and let us know straight away.",
      ],
    },
    {
      typ: "karten", id: "vertrag", h2: "What is fixed before you sign", spalten: 2,
      lead: "You know the fees, the services and the agreement before you sign. The agreement is in German and is governed by German law. Its structure is shown on the page “Agreement at a glance”, which also sets out what applies to consumers.",
      karten: [
        { tag: "Fees", titel: "Fees in advance", text: `${HONORAR.en} ${HONORAR_VORAB.en}`, pfad: "/en/business/costs" },
        { tag: "Agreement", titel: "Your agreement at a glance", text: "What the agreement covers. You read your complete agreement in your personal proposal before you sign.", pfad: "/en/business/mustervertrag" },
        { tag: "Refund", titel: GZ.en.titel, text: GZ.en.text },
        { tag: "Year two", titel: "Annual administration on request", text: `${JAHRESBETREUUNG.en} It is invoiced annually in advance.` },
      ],
    },
    {
      typ: "karten", id: "was", h2: "What FIAON Global is — and what it is not", spalten: 2,
      lead: `${weitererSatz("POSITIONIERUNG", "en")} We form, prepare and support. You submit the applications yourself. Authorities and institutions decide.`,
      karten: [
        { titel: "Not a bank", text: `FIAON holds no accounts and issues no cards. ${beleg("keinZugriff", "en")} Decisions on accounts, cards and financing rest with the institution concerned.` },
        { titel: "Does not broker loans", text: `${S8.en[1]} ${satz("S9", "en")} ${satz("S1", "en")}` },
        { titel: "Not a tax scheme", text: `${satz("S10", "en")} You report the formation to the tax office in your country of residence, in Germany under section 138 AO.` },
        { titel: "Not a law firm", text: `FIAON coordinates your engagement. ${S8.en[2]} ${HONORARE_DER_PARTNER.en}` },
      ],
    },
    { typ: "hinweis", id: "wissen", h2: "What you need to know", punkte: [...GLOBAL_PFLICHTHINWEIS.en] },
    {
      typ: "text", id: "unterlagen", h2: "What happens to your documents",
      absaetze: [
        `You upload your documents in your portal. ${beleg("daten", "en")} Encryption applies in transit and at rest. We pass your documents on only where your engagement requires it:`,
      ],
      punkte: [
        "to the US authorities with which we file: the state for the formation and the US tax authority for the tax identification numbers",
        "to your company’s registered agent",
        "to partner lawyers and US certified public accountants (CPAs) from our partner network, where your agreement provides for their services",
        "to institutions and card issuers — only where you instruct us to do so",
      ],
      nach: "We pass nothing on to advertising networks. You may request access, correction and erasure under Articles 15 to 17 GDPR at any time. Once the engagement has ended, we delete your documents in full on request; only invoicing records are kept, as the law requires.",
    },
    {
      typ: "karten", id: "partner", h2: "For partners: tax advisers, lawyers, financiers", spalten: 2,
      lead: "For tax advisers, lawyers and financiers looking into FIAON Global for their own clients, the same applies as for our clients. Every arrangement is set out in writing beforehand.",
      karten: [
        { tag: "Agreement", titel: "Everything in writing", text: "Every cooperation is set out beforehand in a written agreement, with its services and conditions." },
        { tag: "Credit note", titel: "Settlement by credit note", text: "Anyone remunerated as an introducer or cooperation partner receives a credit note with a monthly report." },
        { tag: "Professional rules", titel: "Independence of the partners", text: "Lawyers and tax advisers receive no fee or other benefit for introducing clients (section 49b(3) BRAO, section 9 StBerG). Where they contribute to the services in an agreement, FIAON bears their fees for those services." },
        { tag: "Contact", titel: "Become a partner", text: `Write to us at ${F.email} — you receive the conditions and the agreement in writing.`, pfad: `mailto:${F.email}?subject=Partnership%20FIAON%20Global` },
      ],
    },
    {
      typ: "text", id: "kontakt", h2: "How to reach us",
      absaetze: [
        `By telephone on weekdays on ${F.telefon} (German and English) and by email to ${F.email}. The initial call takes thirty minutes, is free of charge and without obligation. After that, one dedicated contact leads your engagement.`,
        `As a client, you can see in your portal which step is under way and what follows next. Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "text", id: "verwechslung", h2: "Do not confuse us",
      absaetze: [
        `FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is ${F.name} in London. Reviews, warnings and profiles under similar-sounding names concern other companies. Whatever entry you find online, check the name and the address. Ask us directly if something does not add up.`,
      ],
    },
  ],
  fragen: [
    { f: "Is FIAON Global legit?", a: `Check it against facts rather than promises. FIAON Global is the business consultancy of ${F.name}, registered in England and Wales under company number ${F.companyNo}. Its registered office is ${F.strasse}, ${F.ortZeile}. You read your fees and your complete agreement in your personal proposal before you sign. ${beleg("zahlung", "en")}` },
    { f: "Who is behind FIAON Global?", a: `${F.name}, with its registered office at ${F.strasse}, ${F.ortZeile}, registered in England and Wales under company number ${F.companyNo}. The Director is the founder, ${F.director}. You can view the entry without an account; all statutory details are in the legal notice. Your contracting party is always ${F.name}. ${ROLLEN.en}` },
    { f: "Where do I pay, and how do I recognise a genuine invoice?", a: `You pay by bank transfer only, to ${BANK.empfaenger}; the account details are on this page and on every invoice, together with your payment reference. For payments from the United Arab Emirates, we give you a second account of ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} on request (IBAN ${BANK_AED.ibanDisplay}). There are no other accounts. FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account. If such a request reaches you in FIAON’s name, please do not pay. Contact ${F.email} or ${F.telefon}.` },
    { f: "What does FIAON Global cost, and does anything renew automatically?", a: `${satz("S12", "en")} ${saetzeVon(weitererSatz("ZAHLUNG", "en"))[1]}` },
    { f: "Is FIAON a bank, or does it broker loans?", a: `No. ${S8.en[0]} ${S8.en[1]} ${satz("S2", "en")} ${satz("S9", "en")} ${satz("S1", "en")}` },
    { f: "Does a US company save me tax?", a: `No. ${satz("S10", "en")} You report the formation to the tax office in your country of residence, in Germany under section 138 AO. ${S8.en[2]}` },
    { f: "What applies if the financing does not arrive?", a: GZ.en.text },
    { f: "What happens to my documents?", a: `You upload them in your portal. ${beleg("daten", "en")} We pass them on only where your engagement requires it. The recipients are the US authorities with which we file, the registered agent and partners whose services your agreement provides for. They go to institutions and card issuers only where you instruct us to do so, and never to advertising networks. You may request access, correction and erasure under the GDPR at any time.` },
    { f: "How do I work with FIAON as a tax adviser, lawyer or financier?", a: `Through a written agreement that is fixed before we begin. Anyone remunerated as an introducer or cooperation partner receives a credit note with a monthly report. Lawyers and tax advisers receive no fee or other benefit for introducing clients (section 49b(3) BRAO, section 9 StBerG). Where they contribute to the services in an agreement, FIAON bears their fees for those services. Write to us at ${F.email}.` },
    { f: "Why do I find warnings or reviews that do not fit FIAON?", a: `Because there are companies with similar-sounding names. FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is ${F.name} in London. Warning lists from regulators and consumer portals name providers with their name and address. Check both carefully, and ask us directly if something does not add up.` },
  ],
  weiter: ["/en/business/what-is-fiaon-global", "/en/business/costs", "/en/business/process", "/en/business/faq"],
  quellen: [
    { titel: `Companies House (England and Wales): ${F.name}, No. ${F.companyNo}`, url: COMPANIES_HOUSE_URL },
    { titel: "Section 49b Federal Lawyers' Act (BRAO) — remuneration", url: "https://www.gesetze-im-internet.de/brao/__49b.html" },
    { titel: "Section 9 Tax Advisers Act (StBerG) — remuneration", url: "https://www.gesetze-im-internet.de/stberg/__9.html" },
    { titel: "Section 138 Fiscal Code (AO) — reporting foreign holdings", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
    { titel: "General Data Protection Regulation (GDPR), Articles 15 to 17", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
  ],
  schluss: { a: "Check us. ", b: "Then let us talk.", text: "Thirty minutes, free of charge and without obligation — with your dedicated contact." },
  prio: 0.7,
};

/** Die Vertrauensseite in beiden Sprachen — eine Quelle für Seite, Vorab-HTML und FAQ. */
export const SERIOES_SEITE = { de, en } as const;
