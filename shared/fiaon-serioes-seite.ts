// ═══════════════════════════════════════════════════════════════════════════
// DIE VERTRAUENSSEITE ALS SEITE VON FIAON GLOBAL (E-459, 29.10.2026)
//
// Justin (29.10.): „Die ganze Seite muss auf das Business-Konzept umgebaut werden, komplett — auch in unserem
// Apple-Design und alles auf Business.“ Die Seite ist darum ein Datensatz im Format der Business-Unterseiten
// (shared/fiaon-global-seiten/typen.ts) und erscheint in deren Vorlage (client/src/pages/site/global-seite.tsx):
// Kopf mit „Auf einen Blick“, Inhaltsverzeichnis, Abschnitte, Fragen, Gespräch — im Apple-Glas der Business-Welt.
// Sie steht NICHT im Register (ihre Adresse liegt außerhalb von /business, Menü und Prüfstand des Registers gelten
// dort nicht); der Server trägt sie selbst in die SEO-Tabelle ein (server/lib/fiaon-global-seo.ts).
//
// Fakten nur aus ihren einen Quellen: Firma (fiaon-firma.ts), Konto (fiaon-bank.ts), Pakete, Zusage und Pflicht-
// hinweise (fiaon-global.ts), Widerrufsfrist (fiaon-jahresvertrag.ts). Wortgrenzen von FIAON Global: kein „bis zu“,
// kein „beraten“, keine Zinsen, keine Kapitalzusage, kein Steuermodell; über Konto, Karte, Rahmen und Darlehen
// entscheidet das Institut. „Unternehmensberatung“ als Selbstbezeichnung erlaubt (E-439, nicht auf der AT-Seite).
// Die Bankverbindung steht bewusst im Text (E-445: woran Sie uns erkennen) — immer aus BANK, nie von Hand.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalSeite } from "./fiaon-global-seiten/typen";
import { FIAON_FIRMA as F } from "./fiaon-firma";
import { BANK, BANK_AED } from "./fiaon-bank";
import { GLOBAL_GELD_ZURUECK, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalPreisText } from "./fiaon-global";
import { WIDERRUFSFRIST_TAGE } from "./fiaon-jahresvertrag";
import { SERIOES_PFAD, SERIOES_STAND, SERIOES_KOPF, COMPANIES_HOUSE_URL } from "./fiaon-serioes";

const GZ = { de: GLOBAL_GELD_ZURUECK.de, en: GLOBAL_GELD_ZURUECK.en };

const QUELLEN_DE = [
  { titel: `Companies House (England and Wales): ${F.name}, Nr. ${F.companyNo}`, url: COMPANIES_HOUSE_URL },
  { titel: "§ 49b Bundesrechtsanwaltsordnung (BRAO) — Vergütung", url: "https://www.gesetze-im-internet.de/brao/__49b.html" },
  { titel: "§ 9 Steuerberatungsgesetz (StBerG) — Vergütung", url: "https://www.gesetze-im-internet.de/stberg/__9.html" },
  { titel: "§ 138 Abgabenordnung (AO) — Anzeige ausländischer Beteiligungen", url: "https://www.gesetze-im-internet.de/ao_1977/__138.html" },
  { titel: "Datenschutz-Grundverordnung (DSGVO), Art. 15 bis 17", url: "https://eur-lex.europa.eu/eli/reg/2016/679/oj" },
];

const de: GlobalSeite = {
  pfad: SERIOES_PFAD.de, sprache: "de", schwester: SERIOES_PFAD.en, art: "partner",
  seo: { titel: SERIOES_KOPF.de.titel, beschreibung: SERIOES_KOPF.de.beschreibung },
  stand: SERIOES_STAND, erschienen: "2026-10-28", kennung: "FG · Fakten",
  auge: "FIAON Global · Die Fakten",
  h1: SERIOES_KOPF.de.h1, h1b: SERIOES_KOPF.de.h1b, lead: SERIOES_KOPF.de.lead,
  ziffern: [
    { wert: F.companyNo, label: "Companies House, England and Wales" },
    { wert: "Festpreis", label: "je Paket, einmalig – vor der Beauftragung fest" },
    { wert: "Rechnung", label: "Zahlung nur per Überweisung an die FIAON LTD" },
  ],
  blick: [
    ["Vertragspartner", `${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Handelsregister", `Companies House (England and Wales), Nr. ${F.companyNo} – öffentlich einsehbar`],
    ["Leitung", `${F.director} (Director), Gründer`],
    ["Preis", "Festpreis je Paket, einmalig, alle Gebühren des Pakets inklusive"],
    ["Zahlung", `Per Rechnung, nur per Überweisung an ${BANK.empfaenger} – kein Abo, keine Abbuchung`],
    ["Vertrag", "Auf Deutsch, nach deutschem Recht; Mustervertrag vorab lesbar"],
    ["Ihre Unterlagen", "Server in Frankfurt am Main, verschlüsselt, nach DSGVO"],
    ["Kontakt", `${F.telefon} · ${F.email}`],
  ],
  kurz: `Prüfen Sie es an Fakten statt an Versprechen. FIAON Global ist ein Angebot der ${F.name}, eingetragen beim britischen Companies House unter der Nummer ${F.companyNo}. Sie zahlen einen Festpreis per Rechnung auf das Geschäftskonto der ${F.name}, den Vertrag lesen Sie vorab als Mustervertrag, und Sie haben einen festen Ansprechpartner, den Sie anrufen können.`,
  bloecke: [
    {
      typ: "karten", id: "wer", h2: "Wer hinter FIAON Global steht", spalten: 2,
      lead: `FIAON Global ist das Angebot der ${F.name} für Unternehmen, Gründer und Privatpersonen – eingetragen im britischen Handelsregister (Companies House, England and Wales) unter der Nummer ${F.companyNo}, Sitz ${F.strasse}, ${F.ortZeile}. Geschäftsführer (Director) ist der Gründer ${F.director}. Ihr Vertragspartner für den Auftrag ist die ${F.name}. ${GLOBAL_ROLLEN.de.partner}`,
      karten: [
        { tag: "Register", titel: "Registereintrag prüfen", text: `Companies House · Nr. ${F.companyNo} – kostenlos und ohne Anmeldung.`, pfad: COMPANIES_HOUSE_URL },
        { tag: "Pflichtangaben", titel: "Impressum", text: `Alle Pflichtangaben der ${F.name}.`, pfad: "/impressum?bereich=business" },
        { tag: "Team", titel: "Ihr Team", text: "Ihr Ansprechpartner und alle, die an Ihrem Auftrag mitarbeiten.", pfad: "/#auf-einen-blick" },
        { tag: "Privatkunden", titel: "FIAON für Bonität, Konto und Karte?", text: "Laufzeit, Monatsentgelt und Ablauf der Privatkunden-Pakete.", pfad: "/fiaon-erfahrungen" },
      ],
    },
    {
      typ: "tabelle", id: "zahlung", h2: "Wohin Sie zahlen – und woran Sie uns erkennen",
      lead: `Sie zahlen den Festpreis per Rechnung, ausschließlich per Überweisung auf das Geschäftskonto der ${BANK.empfaenger}. Es gibt keine Lastschrift, keine Kartenabbuchung und kein Abo: Jede Zahlung lösen Sie selbst aus. Jede Rechnung nennt Ihren Verwendungszweck und diese Bankverbindung.`,
      kopf: ["Angabe", "Bankverbindung"],
      zeilen: [["Empfänger", BANK.empfaenger], ["IBAN", BANK.ibanDisplay], ["BIC", BANK.bic], ["Bank", BANK.bank]],
      fuss: [
        `Für Zahlungen aus den Vereinigten Arabischen Emiraten nennen wir Ihnen auf Wunsch ein zweites Konto der ${BANK_AED.empfaenger} in ${BANK_AED.waehrung}: IBAN ${BANK_AED.ibanDisplay}, ${BANK_AED.bank}. Andere Konten gibt es nicht.`,
        "FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto. Fordert Sie jemand im Namen von FIAON dazu auf, zahlen Sie bitte nicht und melden Sie es uns sofort.",
      ],
    },
    {
      typ: "karten", id: "vertrag", h2: "Was vor der Beauftragung feststeht", spalten: 2,
      lead: `Preis, Leistungen und Vertrag kennen Sie, bevor Sie etwas unterschreiben. Der Vertrag ist auf Deutsch verfasst und folgt deutschem Recht. Beauftragen Sie als Privatperson und handeln dabei als Verbraucher, gilt zusätzlich das gesetzliche Widerrufsrecht von ${WIDERRUFSFRIST_TAGE} Tagen.`,
      karten: [
        { tag: "Festpreis", titel: "Ein Preis je Paket, einmalig", text: `Mit allen Gebühren des Pakets, per Rechnung, kein Abo – die Pakete beginnen bei ${globalPreisText("global_struktur", "de")} (für Unternehmen zuzüglich Umsatzsteuer, soweit sie anfällt).`, pfad: "/business/kosten" },
        { tag: "Vertrag", titel: "Mustervertrag vorab lesen", text: "Jede Ziffer des Auftrags, bevor Sie beauftragen.", pfad: "/business/mustervertrag" },
        { tag: "Zusage", titel: GZ.de.titel, text: `${GZ.de.text} ${GZ.de.bedingungen}` },
        { tag: "Jahr zwei", titel: "Jahresbetreuung nur auf Wunsch", text: "Ab dem zweiten Jahr zum festen Jahrespreis, jährlich im Voraus berechnet – sie verlängert sich nicht von selbst." },
      ],
    },
    {
      typ: "karten", id: "was", h2: "Was FIAON Global ist – und was nicht", spalten: 2,
      lead: "FIAON Global gründet Ihre US-Gesellschaft und begleitet Sie danach: EIN und ITIN, Registered Agent und US-Adresse, die Anträge für Geschäftskonto und Firmenkarten und die Etappen auf dem Weg zum Kapital – zum Festpreis, mit einem festen Ansprechpartner. FIAON Global versteht sich als Unternehmensberatung für diesen Weg.",
      karten: [
        { titel: "Keine Bank", text: "FIAON führt keine Konten und vergibt keine Kredite. Über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut." },
        { titel: "Kein Kreditvermittler", text: "FIAON vermittelt keine Kredite und sagt keinen Rahmen zu. Der Kapitalrahmen eines Pakets ist Ihr Ziel – er bestimmt, wie weit wir Sie begleiten. Sie zahlen nie einen Vorschuss für ein Darlehen, sondern den Festpreis für Leistungen, die in Ihrem Vertrag stehen." },
        { titel: "Kein Steuermodell", text: "Eine US-Gesellschaft, die aus Deutschland, Österreich oder der Schweiz geführt wird, bleibt dort steuerpflichtig. Unser Partner-Steuerberater prüft Ihren Fall vor der Gründung – das ist in jedem Paket enthalten." },
        { titel: "Keine Kanzlei", text: "Den Gesellschaftsvertrag (Operating Agreement) erstellt unser Partner-Anwalt. FIAON koordiniert Ihren Auftrag; Steuer- und Rechtsfragen klären unsere Partner auf Ihr Mandat." },
      ],
    },
    { typ: "hinweis", id: "wissen", h2: "Was Sie wissen müssen", punkte: [...GLOBAL_PFLICHTHINWEIS.de] },
    {
      typ: "text", id: "unterlagen", h2: "Was mit Ihren Unterlagen geschieht",
      absaetze: [
        "Ihre Unterlagen laden Sie in Ihrem persönlichen Kundenportal hoch. Sie liegen auf Servern in Frankfurt am Main, verschlüsselt bei der Übertragung und bei der Ablage. Weiter gehen sie nur dorthin, wo Ihr Auftrag es erfordert: an die US-Behörden, bei denen wir für Sie einreichen – etwa die Gründung beim Bundesstaat und den EIN-Antrag –, an den Registered Agent, an die Partner, die für Ihren Auftrag tätig werden, etwa für die ITIN oder die erste US-Meldung, und – soweit Sie es beauftragen – an Banken, Kartenherausgeber und Dienste wie D-U-N-S. Nie an Werbenetzwerke.",
        "Auskunft, Berichtigung und Löschung nach Art. 15 bis 17 DSGVO können Sie jederzeit verlangen. Nach dem Ende des Auftrags löschen wir Ihre Unterlagen auf Wunsch vollständig; nur Rechnungsdaten bewahren wir aus gesetzlichen Gründen auf.",
      ],
    },
    {
      typ: "karten", id: "partner", h2: "Für Partner: Steuerberater, Kanzleien, Finanzierer", spalten: 2,
      lead: "Viele Unternehmer kommen über ihre Steuerkanzlei, ihren Anwalt oder ihren Finanzierer zu uns. Für Partner gilt dieselbe Klarheit wie für Kunden.",
      karten: [
        { tag: "Vereinbarung", titel: "Alles schriftlich", text: "Jede Zusammenarbeit steht vorher in einer schriftlichen Vereinbarung – Leistungen und Bedingungen inklusive." },
        { tag: "Gutschrift", titel: "Abrechnung per Gutschrift", text: "Wer als Tippgeber oder Kooperationspartner vergütet wird, erhält eine Gutschrift mit Monatsbericht." },
        { tag: "Berufsrecht", titel: "Berufsrecht gewahrt", text: "Anwälte und Steuerberater erhalten für das Zuführen von Mandanten keine Vergütung und keinen sonstigen Vorteil (§ 49b Abs. 3 BRAO, § 9 StBerG). Arbeiten sie für Ihren Auftrag, trägt FIAON ihr Honorar für die Leistungen Ihres Pakets." },
        { tag: "Kontakt", titel: "Partner werden", text: `Schreiben Sie uns an ${F.email} – Bedingungen und Vereinbarung erhalten Sie schriftlich.`, pfad: `mailto:${F.email}?subject=Partnerschaft%20FIAON%20Global` },
      ],
    },
    {
      typ: "text", id: "kontakt", h2: "So erreichen Sie Menschen",
      absaetze: [
        `Telefonisch werktags unter ${F.telefon} (Deutsch und Englisch) und per E-Mail an ${F.email} – Antwort in der Regel am selben Werktag. Das Erstgespräch dauert dreißig Minuten, ist kostenfrei und ohne Verpflichtung; danach begleitet Sie ein fester Ansprechpartner.`,
        `Als Kunde sehen Sie in Ihrem Kundenportal jederzeit, was gerade geschieht und was als Nächstes kommt. Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "text", id: "verwechslung", h2: "Nicht verwechseln",
      absaetze: [
        `FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die ${F.name} in London. Bewertungen, Warnungen und Profile unter ähnlich klingenden Namen betreffen andere Unternehmen. Prüfen Sie bei jedem Eintrag, den Sie im Netz finden, Name und Anschrift – und fragen Sie uns direkt, wenn etwas nicht zusammenpasst.`,
      ],
    },
  ],
  fragen: [
    { f: "Ist FIAON Global seriös?", a: `Prüfen Sie es an Fakten statt an Versprechen: FIAON Global ist ein Angebot der ${F.name}, eingetragen beim Companies House (England and Wales) unter der Nummer ${F.companyNo}, Sitz ${F.strasse}, ${F.ortZeile}. Jedes Paket hat einen Festpreis, Sie zahlen per Rechnung auf das Geschäftskonto der ${F.name}, den Vertrag lesen Sie vorab als Mustervertrag, und Sie erreichen einen festen Ansprechpartner per Telefon und E-Mail.` },
    { f: "Wer steht hinter FIAON Global?", a: `Die ${F.name} mit Sitz in ${F.strasse}, ${F.ortZeile}, eingetragen beim Companies House unter der Nummer ${F.companyNo}. Geschäftsführer ist der Gründer ${F.director}. Den Eintrag können Sie kostenlos und ohne Anmeldung einsehen; alle Pflichtangaben stehen im Impressum. Ihr Vertragspartner für den Auftrag ist die ${F.name}. ${GLOBAL_ROLLEN.de.partner}` },
    { f: "Wohin zahle ich, und woran erkenne ich eine echte Rechnung?", a: `Sie zahlen nur per Überweisung an ${BANK.empfaenger}; die Bankverbindung steht auf dieser Seite und auf jeder Rechnung, zusammen mit Ihrem Verwendungszweck. Für Zahlungen aus den Vereinigten Arabischen Emiraten nennen wir Ihnen auf Wunsch ein zweites Konto der ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} (IBAN ${BANK_AED.ibanDisplay}); andere Konten gibt es nicht. FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto – erhalten Sie eine solche Aufforderung im Namen von FIAON, zahlen Sie bitte nicht und melden Sie sich bei ${F.email} oder unter ${F.telefon}.` },
    { f: "Was kostet FIAON Global, und gibt es ein Abo?", a: `Jedes Paket hat einen Festpreis, einmalig, mit allen Gebühren des Pakets; er steht fest, bevor Sie beauftragen. Die Pakete beginnen bei ${globalPreisText("global_struktur", "de")}, für Unternehmen zuzüglich Umsatzsteuer, soweit sie anfällt. Es gibt kein Abo: Ab dem zweiten Jahr können Sie die Jahresbetreuung zum festen Jahrespreis dazunehmen – sie wird jährlich im Voraus berechnet und verlängert sich nicht von selbst.` },
    { f: "Ist FIAON eine Bank oder ein Kreditvermittler?", a: "Nein. FIAON führt keine Konten, vergibt keine Kredite, vermittelt keine Kredite und sagt keinen Rahmen zu. Der Kapitalrahmen eines Pakets ist Ihr Ziel und bestimmt, wie weit wir Sie begleiten; über Konto, Karte, Rahmen und Darlehen entscheidet allein das jeweilige Institut. Sie zahlen den Festpreis für Leistungen, die in Ihrem Vertrag stehen – nie einen Vorschuss für ein Darlehen." },
    { f: "Spare ich mit einer US-Gesellschaft Steuern?", a: "Eine US-Gesellschaft ist kein Steuermodell. Wird sie aus Deutschland, Österreich oder der Schweiz geführt, bleibt sie dort steuerpflichtig; die Gründung ist dem Finanzamt zu melden. Unser Partner-Steuerberater prüft Ihren Fall vor der Gründung – das ist in jedem Paket enthalten." },
    { f: "Was passiert, wenn FIAON nicht liefert?", a: `${GZ.de.text} ${GZ.de.bedingungen}` },
    { f: "Was passiert mit meinen Unterlagen?", a: "Sie laden sie in Ihrem persönlichen Kundenportal hoch; sie liegen auf Servern in Frankfurt am Main, verschlüsselt bei Übertragung und Ablage. Weiter gehen sie nur, soweit Ihr Auftrag es erfordert – an die US-Behörden, bei denen wir für Sie einreichen, an den Registered Agent, an die Partner, die für Ihren Auftrag tätig werden, und – soweit Sie es beauftragen – an Banken und Kartenherausgeber –, und nie an Werbenetzwerke. Auskunft, Berichtigung und Löschung nach der DSGVO können Sie jederzeit verlangen; nach dem Ende des Auftrags löschen wir Ihre Unterlagen auf Wunsch vollständig, nur Rechnungsdaten bleiben aus gesetzlichen Gründen aufbewahrt." },
    { f: "Wie arbeite ich als Steuerberater, Kanzlei oder Finanzierer mit FIAON zusammen?", a: `Über eine schriftliche Vereinbarung, die vor dem Start feststeht. Wer als Tippgeber oder Kooperationspartner vergütet wird, erhält eine Gutschrift mit Monatsbericht. Anwälte und Steuerberater erhalten für das Zuführen von Mandanten keine Vergütung und keinen sonstigen Vorteil (§ 49b Abs. 3 BRAO, § 9 StBerG); arbeiten sie für den Auftrag eines Kunden, trägt FIAON ihr Honorar für die Leistungen des Pakets. Schreiben Sie uns an ${F.email} – Bedingungen und Vereinbarung erhalten Sie schriftlich.` },
    { f: "Warum finde ich Warnungen oder Bewertungen, die nicht zu FIAON passen?", a: `Weil es Unternehmen mit ähnlich klingenden Namen gibt. FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die ${F.name} in London. Warnlisten von Aufsichtsbehörden und Verbraucherportalen nennen Anbieter mit Namen und Anschrift – prüfen Sie beides genau. Wenn etwas nicht zusammenpasst, fragen Sie uns direkt.` },
  ],
  weiter: ["/business/was-ist-fiaon-global", "/business/kosten", "/business/ablauf", "/business/fragen"],
  quellen: QUELLEN_DE,
  schluss: { a: "Prüfen Sie uns. ", b: "Dann sprechen wir.", text: "Dreißig Minuten, kostenfrei und ohne Verpflichtung – mit Ihrem festen Ansprechpartner." },
  prio: 0.8,
};

const en: GlobalSeite = {
  pfad: SERIOES_PFAD.en, sprache: "en", schwester: SERIOES_PFAD.de, art: "partner",
  seo: { titel: SERIOES_KOPF.en.titel, beschreibung: SERIOES_KOPF.en.beschreibung },
  stand: SERIOES_STAND, erschienen: "2026-10-28", kennung: "FG · Facts",
  auge: "FIAON Global · The facts",
  h1: SERIOES_KOPF.en.h1, h1b: SERIOES_KOPF.en.h1b, lead: SERIOES_KOPF.en.lead,
  ziffern: [
    { wert: F.companyNo, label: "Companies House, England and Wales" },
    { wert: "Fixed price", label: "per package, one-off — fixed before you commission us" },
    { wert: "Invoice", label: "payment by bank transfer to FIAON LTD only" },
  ],
  blick: [
    ["Contracting party", `${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}`],
    ["Company register", `Companies House (England and Wales), No. ${F.companyNo} — open to the public`],
    ["Management", `${F.director} (Director), founder`],
    ["Price", "Fixed price per package, one-off, all fees of the package included"],
    ["Payment", `By invoice, bank transfer to ${BANK.empfaenger} only — no subscription, no direct debit`],
    ["Contract", "In English or German, under German law; model contract available to read in advance"],
    ["Your documents", "Servers in Frankfurt am Main, encrypted, under the GDPR"],
    ["Contact", `${F.telefon} · ${F.email}`],
  ],
  kurz: `Judge us on facts, not promises. FIAON Global is a service of ${F.name}, registered with Companies House in the United Kingdom under number ${F.companyNo}. You pay a fixed price by invoice into the business account of ${F.name}, you read the contract in advance as a model contract, and you have a dedicated contact you can call.`,
  bloecke: [
    {
      typ: "karten", id: "wer", h2: "Who is behind FIAON Global", spalten: 2,
      lead: `FIAON Global is the service of ${F.name} for companies, founders and private individuals — registered with the UK company register (Companies House, England and Wales) under number ${F.companyNo}, registered office ${F.strasse}, ${F.ortZeile}. The Director is the founder, ${F.director}. Your contracting party for the mandate is ${F.name}. ${GLOBAL_ROLLEN.en.partner}`,
      karten: [
        { tag: "Register", titel: "Check the register entry", text: `Companies House · No. ${F.companyNo} — free of charge, no account needed.`, pfad: COMPANIES_HOUSE_URL },
        { tag: "Statutory details", titel: "Legal notice", text: `All statutory details of ${F.name}.`, pfad: "/impressum?bereich=business" },
        { tag: "Team", titel: "Your team", text: "Your contact and everyone who works on your mandate.", pfad: "/en#auf-einen-blick" },
        { tag: "Private customers", titel: "FIAON for credit standing, account and card?", text: "Term, monthly fee and process of the private customer plans.", pfad: "/en/how-fiaon-works" },
      ],
    },
    {
      typ: "tabelle", id: "zahlung", h2: "Where you pay — and how to recognise us",
      lead: `You pay the fixed price by invoice, by bank transfer only, into the business account of ${BANK.empfaenger}. There are no direct debits, no card charges and no subscription: you make every payment yourself. Every invoice states your payment reference and this account.`,
      kopf: ["Item", "Bank details"],
      zeilen: [["Recipient", BANK.empfaenger], ["IBAN", BANK.ibanDisplay], ["BIC", BANK.bic], ["Bank", BANK.bank]],
      fuss: [
        `For payments from the United Arab Emirates, we give you a second account of ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} on request: IBAN ${BANK_AED.ibanDisplay}, ${BANK_AED.bank}. There are no other accounts.`,
        "FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account. If anyone asks you to do so in FIAON's name, please do not pay and let us know straight away.",
      ],
    },
    {
      typ: "karten", id: "vertrag", h2: "What is fixed before you commission us", spalten: 2,
      lead: `You know the price, the services and the contract before you sign anything. The contract is available in English and German and is governed by German law. If you engage us as a private individual acting as a consumer, the statutory ${WIDERRUFSFRIST_TAGE}-day right of withdrawal also applies.`,
      karten: [
        { tag: "Fixed price", titel: "One price per package, one-off", text: `All fees of the package included, by invoice, no subscription — packages start at ${globalPreisText("global_struktur", "en")} (plus VAT for companies where applicable).`, pfad: "/en/business/costs" },
        { tag: "Contract", titel: "Read the model contract first", text: "Every clause of the mandate, before you commission us.", pfad: "/en/business/mustervertrag" },
        { tag: "Commitment", titel: GZ.en.titel, text: `${GZ.en.text} ${GZ.en.bedingungen}` },
        { tag: "Year two", titel: "Annual care only if you want it", text: "From the second year at a fixed annual price, invoiced a year in advance — it does not renew by itself." },
      ],
    },
    {
      typ: "karten", id: "was", h2: "What FIAON Global is — and what it is not", spalten: 2,
      lead: "FIAON Global forms your US company and supports you afterwards: EIN and ITIN, registered agent and US address, the applications for a business account and company cards, and the stages on the route to capital — at a fixed price, with a dedicated contact. FIAON Global sees itself as a business consultancy for this route.",
      karten: [
        { titel: "Not a bank", text: "FIAON holds no accounts and grants no loans. Decisions on account, card, limit and loan are made by the institution alone." },
        { titel: "No loan brokering", text: "FIAON does not broker loans and commits to no limit. A package's capital target is your goal — it sets how far we accompany you. You never pay an advance for a loan, only the fixed price for services set out in your contract." },
        { titel: "Not a tax scheme", text: "A US company managed from Germany, Austria or Switzerland remains taxable there. Our partner tax adviser reviews your case before formation — this is included in every package." },
        { titel: "Not a law firm", text: "Our partner lawyer drafts the operating agreement. FIAON coordinates your mandate; tax and legal questions are handled by our partners under your engagement." },
      ],
    },
    { typ: "hinweis", id: "wissen", h2: "What you need to know", punkte: [...GLOBAL_PFLICHTHINWEIS.en] },
    {
      typ: "text", id: "unterlagen", h2: "What happens to your documents",
      absaetze: [
        "You upload your documents in your personal client portal. They are stored on servers in Frankfurt am Main, encrypted in transit and at rest. They go only where your mandate requires: to the US authorities with which we file on your behalf — the formation with the state and the EIN application, for example — to the registered agent, to the partners who work on your mandate, such as for the ITIN or the first US filing, and — where you commission it — to banks, card issuers and services such as D-U-N-S. Never to advertising networks.",
        "You can request access, correction and erasure under Articles 15 to 17 GDPR at any time. Once the mandate has ended, we delete your documents in full on request; only invoicing records are kept, as the law requires.",
      ],
    },
    {
      typ: "karten", id: "partner", h2: "For partners: tax advisers, law firms, financiers", spalten: 2,
      lead: "Many business owners come to us through their tax firm, their lawyer or their financier. Partners get the same clarity as clients.",
      karten: [
        { tag: "Agreement", titel: "Everything in writing", text: "Every cooperation is set out beforehand in a written agreement — services and conditions included." },
        { tag: "Credit note", titel: "Settlement by credit note", text: "Anyone remunerated as an introducer or cooperation partner receives a credit note with a monthly report." },
        { tag: "Professional rules", titel: "Professional rules respected", text: "Lawyers and tax advisers receive no fee or other benefit for introducing clients (section 49b(3) BRAO, section 9 StBerG). Where they work on your mandate, FIAON pays their fees for the services in your package." },
        { tag: "Contact", titel: "Become a partner", text: `Write to us at ${F.email} — you receive the conditions and the agreement in writing.`, pfad: `mailto:${F.email}?subject=Partnership%20FIAON%20Global` },
      ],
    },
    {
      typ: "text", id: "kontakt", h2: "How to reach real people",
      absaetze: [
        `By phone on weekdays on ${F.telefon} (German and English) and by e-mail to ${F.email} — usually with a reply on the same working day. The introductory call takes thirty minutes, is free of charge and without obligation; after that, a dedicated contact supports you.`,
        `As a client, your client portal shows at any time what is happening now and what comes next. Post: ${F.name}, ${F.strasse}, ${F.ortZeile}, ${F.land}.`,
      ],
    },
    {
      typ: "text", id: "verwechslung", h2: "Do not confuse us",
      absaetze: [
        `FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is ${F.name} in London. Reviews, warnings and profiles under similar-sounding names concern other companies. Whatever entry you find online, check the name and the address — and ask us directly if something does not add up.`,
      ],
    },
  ],
  fragen: [
    { f: "Is FIAON Global legit?", a: `Judge us on facts, not promises: FIAON Global is a service of ${F.name}, registered with Companies House (England and Wales) under number ${F.companyNo}, registered office ${F.strasse}, ${F.ortZeile}. Every package has a fixed price, you pay by invoice into the business account of ${F.name}, you read the contract in advance as a model contract, and you can reach a dedicated contact by phone and e-mail.` },
    { f: "Who is behind FIAON Global?", a: `${F.name}, registered office ${F.strasse}, ${F.ortZeile}, registered with Companies House under number ${F.companyNo}. The Director is the founder, ${F.director}. You can view the entry free of charge and without an account; all statutory details are in the legal notice. Your contracting party for the mandate is ${F.name}. ${GLOBAL_ROLLEN.en.partner}` },
    { f: "Where do I pay, and how do I recognise a genuine invoice?", a: `You pay by bank transfer only, to ${BANK.empfaenger}; the account details are on this page and on every invoice, together with your payment reference. For payments from the United Arab Emirates, we give you a second account of ${BANK_AED.empfaenger} in ${BANK_AED.waehrung} on request (IBAN ${BANK_AED.ibanDisplay}); there are no other accounts. FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account — if you receive such a request in FIAON's name, please do not pay and contact ${F.email} or ${F.telefon}.` },
    { f: "What does FIAON Global cost, and is there a subscription?", a: `Every package has a fixed price, one-off, with all fees of the package included; it is fixed before you commission us. Packages start at ${globalPreisText("global_struktur", "en")}, plus VAT for companies where applicable. There is no subscription: from the second year you can add the annual care plan at a fixed annual price — it is invoiced a year in advance and does not renew by itself.` },
    { f: "Is FIAON a bank, or does it broker loans?", a: "No. FIAON holds no accounts, grants no loans, brokers no loans and commits to no limit. A package's capital target is your goal and sets how far we accompany you; decisions on account, card, limit and loan are made by the institution alone. You pay the fixed price for services set out in your contract — never an advance for a loan." },
    { f: "Does a US company save me tax?", a: "A US company is not a tax scheme. If it is managed from Germany, Austria or Switzerland, it remains taxable there, and its formation must be reported to the tax office. Our partner tax adviser reviews your case before formation — this is included in every package." },
    { f: "What happens if FIAON does not deliver?", a: `${GZ.en.text} ${GZ.en.bedingungen}` },
    { f: "What happens to my documents?", a: "You upload them in your personal client portal; they are stored on servers in Frankfurt am Main, encrypted in transit and at rest. They go only where your mandate requires — to the US authorities with which we file on your behalf, to the registered agent, to the partners who work on your mandate and — where you commission it — to banks and card issuers — and never to advertising networks. You can request access, correction and erasure under the GDPR at any time; once the mandate has ended, we delete your documents in full on request — only invoicing records are kept, as the law requires." },
    { f: "How do I work with FIAON as a tax adviser, law firm or financier?", a: `Through a written agreement that is fixed before we start. Anyone remunerated as an introducer or cooperation partner receives a credit note with a monthly report. Lawyers and tax advisers receive no fee or other benefit for introducing clients (section 49b(3) BRAO, section 9 StBerG); where they work on a client’s mandate, FIAON pays their fees for the services in the package. Write to us at ${F.email} — you receive the conditions and the agreement in writing.` },
    { f: "Why do I find warnings or reviews that do not fit FIAON?", a: `Because there are companies with similar-sounding names. FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is ${F.name} in London. Warning lists from regulators and consumer portals name providers with their name and address — check both carefully. If something does not add up, ask us directly.` },
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
