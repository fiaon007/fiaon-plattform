// ═══════════════════════════════════════════════════════════════════════════
// „IST FIAON SERIÖS? DIE FAKTEN“ — die Texte der Seite, eine Quelle (28.10.2026, E-445)
//
// Befund Search Console (28.10.2026): Menschen suchen „fiaon seriös“, „fiaon kreditkarte erfahrungen“,
// „ist das abzocke“. fiaon.com steht für „fiaon seriös“ auf Platz 1 — direkt darunter aber fremde
// Warnlisten (unseriöse Kreditvermittler, Betrügerlisten, Aufsichtswarnungen) und Bewertungen einer
// Firma mit ähnlich klingendem Namen. Diese Seite legt die prüfbaren Fakten hin.
//
// Warum eine eigene Datei: Die Abschnitte stehen sichtbar auf der Seite UND im vorgerenderten Korpus
// (shared/fiaon-seo-seiten.ts, Regel 1: kein Text, den der Besucher nicht sieht). Beide lesen von hier.
// Firma und Bankverbindung kommen aus ihren einen Quellen — ändert sich das Konto, ändert sich die Seite.
// Wortregeln: Kunden gesiezt; keine Interna (Anbieter hinter dem Konto, Provisionen); die Kulanz wird nie
// beworben (AGB § 6 Abs. 4); kein „zinsfrei“, keine „Raten“ als Kredit (E-398) — es heißt Monatsentgelt.
// ═══════════════════════════════════════════════════════════════════════════
import { BANK } from "./fiaon-bank";
import { FIAON_FIRMA } from "./fiaon-firma";
import { ERSTLAUFZEIT_MONATE, WIDERRUFSFRIST_TAGE } from "./fiaon-jahresvertrag";

export const SERIOES_PFAD = { de: "/ist-fiaon-serioes", en: "/en/is-fiaon-legit" } as const;
/** Stand der Fakten auf der Seite (Sitemap lastmod in shared/fiaon-seo-seiten.ts). */
export const SERIOES_STAND = "2026-10-28";
/** Der amtliche Registereintrag — jeder kann ihn ohne Anmeldung öffnen. */
export const COMPANIES_HOUSE_URL = `https://find-and-update.company-information.service.gov.uk/company/${FIAON_FIRMA.companyNo}`;

export interface SerioesAbschnitt {
  id: string;
  /** Überschrift in zwei Teilen: der zweite Teil trägt auf der Seite den Farbverlauf. */
  h2a: string;
  h2b: string;
  text: string;
  punkte?: string[];
}

const zahlen = { monate: ERSTLAUFZEIT_MONATE, widerruf: WIDERRUFSFRIST_TAGE };

const de = {
  stand: "28. Oktober 2026",
  h1a: "Ist FIAON seriös? ",
  h1b: "Die Fakten.",
  lead: "Bevor Sie jemandem Ihre Unterlagen anvertrauen, wollen Sie wissen, mit wem Sie es zu tun haben – zu Recht. Hier steht alles, was Sie selbst nachprüfen können: wer hinter FIAON steht, wohin Sie zahlen, was FIAON ist und was nicht, wie Laufzeit und Kündigung geregelt sind, was mit Ihren Daten geschieht und wie Sie uns erreichen.",
  blickH2: "Auf einen Blick",
  blick: [
    ["Vertragspartner", `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`],
    ["Handelsregister", `Companies House (England and Wales), Nr. ${FIAON_FIRMA.companyNo} – öffentlich einsehbar`],
    ["Geschäftsführung", `${FIAON_FIRMA.director} (Director), Gründer`],
    ["Zahlung", `Nur per Überweisung an ${BANK.empfaenger} – keine Abbuchung, keine gespeicherten Kartendaten`],
    ["Laufzeit", `${zahlen.monate} Monate Mindestlaufzeit, danach monatlich kündbar; ${zahlen.widerruf} Tage Widerrufsrecht`],
    ["Ihre Daten", "Server in Frankfurt am Main, verschlüsselt, nach DSGVO – kein Verkauf von Daten"],
    ["Kontakt", `${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}`],
    ["Für wen", "Kunden in Deutschland, Österreich und der Schweiz"],
  ] as [string, string][],
  abschnitte: [
    {
      id: "wer", h2a: "Wer hinter ", h2b: "FIAON steht.",
      text: `FIAON wird betrieben von der ${FIAON_FIRMA.name}, eingetragen im britischen Handelsregister (Companies House, England and Wales) unter der Nummer ${FIAON_FIRMA.companyNo}, eingetragener Sitz ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}. Geschäftsführer (Director) ist der Gründer ${FIAON_FIRMA.director}. Den Registereintrag können Sie selbst prüfen – kostenlos und ohne Anmeldung beim Companies House. Alle Pflichtangaben stehen im Impressum, das Team mit Namen und Aufgaben auf der Teamseite.`,
    },
    {
      id: "zahlung", h2a: "Wohin Sie zahlen – ", h2b: "und woran Sie uns erkennen.",
      text: `Bei FIAON zahlen Sie ausschließlich per Überweisung auf das Geschäftskonto der ${BANK.empfaenger}. Es gibt keine Lastschrift und keine Kartenabbuchung: Jede Zahlung lösen Sie selbst in Ihrer Banking-App aus. Jede Zahlungsaufforderung nennt Ihren persönlichen Verwendungszweck und diese Bankverbindung: Empfänger ${BANK.empfaenger}, IBAN ${BANK.ibanDisplay}, BIC ${BANK.bic}, ${BANK.bank}.`,
      punkte: [
        "FIAON verlangt nie eine Zahlung per Gutschein, Kryptowährung, Bargeldtransfer oder auf ein privates Konto.",
        "Fordert Sie jemand im Namen von FIAON dazu auf, zahlen Sie bitte nicht und melden Sie es uns sofort.",
      ],
    },
    {
      id: "was", h2a: "Was FIAON ist – ", h2b: "und was nicht.",
      text: "FIAON ist eine Plattform für Bonität und Zugang: Ihre Bonitätsauswertung aus Ihren eigenen Kontoauszügen, die Prüfung Ihrer Einträge aus Ihrer Datenkopie von SCHUFA, KSV oder CRIF, der Schriftwechsel mit Auskunfteien und Gläubigern nach Ihrer Freigabe und die Vorbereitung von Konto und Visa-Kreditkarte bei unserer Partnerbank, der DKB. Unter dem Namen FIAON Global begleitet FIAON Unternehmen und Privatpersonen bei ihrer US-Gesellschaft – zum Festpreis.",
      punkte: [
        "Keine Bank: Ihr Konto und Ihre Karte führt die Partnerbank – FIAON bereitet Ihren Antrag mit Ihnen vor, über den Antrag entscheidet die Bank.",
        "Kein Kreditvermittler: FIAON vermittelt keine Kredite und verlangt keine Gebühr für einen Kredit. Warnlisten über unseriöse Kreditvermittler betreffen Anbieter, die vorab Geld für ein Darlehen nehmen, das nie kommt – bei FIAON zahlen Sie ein Monatsentgelt für Leistungen, die in Ihrem Vertrag stehen.",
        "Keine Kanzlei: FIAON ersetzt keine Rechtsberatung; wo Recht gefragt ist, sagen wir es Ihnen.",
      ],
    },
    {
      id: "laufzeit", h2a: "Laufzeit und Kündigung – ", h2b: "vorher klar.",
      text: `Vor dem Abschluss sehen Sie in der Bestellübersicht Paket, Monatsentgelt, Gesamtbetrag, Laufzeit und Kündigungsregel; dieselben Angaben stehen in Ihrer Vertragsbestätigung. Pakete für Privatkunden haben eine Mindestlaufzeit von ${zahlen.monate} Monaten und sind danach jederzeit mit einer Frist von einem Monat kündbar. Zum Ende der Mindestlaufzeit kündigen Sie mit einem Monat Frist – formlos per E-Mail oder im Kundenbereich unter „Abo & Zahlungen“. Zusätzlich gilt das gesetzliche Widerrufsrecht von ${zahlen.widerruf} Tagen ab Vertragsschluss. FIAON Global arbeitet mit Festpreisen je Paket, die vor der Beauftragung feststehen.`,
    },
    {
      id: "daten", h2a: "Was mit Ihren Daten ", h2b: "geschieht.",
      text: "Ihre Akte liegt auf Servern in Frankfurt am Main, verschlüsselt bei der Übertragung und bei der Ablage. FIAON verarbeitet nur, was Sie selbst hochladen, und verschickt kein Schreiben ohne Ihre Freigabe. Ihre Bonitätsdaten werden nicht verkauft und gehen nie an Werbenetzwerke. Auskunft, Berichtigung und Löschung nach Art. 15 bis 17 DSGVO können Sie jederzeit verlangen; nach Vertragsende löschen wir Ihre Unterlagen auf Wunsch vollständig – nur Rechnungsdaten bewahren wir aus gesetzlichen Gründen auf.",
    },
    {
      id: "kontakt", h2a: "So erreichen Sie ", h2b: "Menschen.",
      text: `Telefonisch werktags unter ${FIAON_FIRMA.telefon} (Deutsch und Englisch), per E-Mail an ${FIAON_FIRMA.email} mit Antwort in der Regel am selben Werktag, als Kunde im Kundenbereich unter „Hilfe“ – jede Antwort bleibt in Ihrer Akte – und für Dringendes über „Dringend melden“ auf der Kontaktseite, direkt an die Geschäftsführung. Post: ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}.`,
    },
    {
      id: "verwechslung", h2a: "Nicht ", h2b: "verwechseln.",
      text: "FIAON schreibt sich F-I-A-O-N, die Internetadresse ist fiaon.com, Vertragspartner ist die FIAON LTD in London. Bewertungen, Warnungen und Profile unter ähnlich klingenden Namen betreffen andere Unternehmen. Prüfen Sie bei jedem Eintrag, den Sie im Netz finden, Name und Adresse – und fragen Sie uns direkt, wenn etwas nicht zusammenpasst.",
    },
  ] as SerioesAbschnitt[],
};

const en: typeof de = {
  stand: "28 October 2026",
  h1a: "Is FIAON legit? ",
  h1b: "The facts.",
  lead: "Before you entrust anyone with your documents, you want to know who you are dealing with — rightly so. Here is everything you can check for yourself: who is behind FIAON, where you pay, what FIAON is and what it is not, how the term and cancellation work, what happens to your data and how to reach us.",
  blickH2: "At a glance",
  blick: [
    ["Contracting party", `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}`],
    ["Company register", `Companies House (England and Wales), No. ${FIAON_FIRMA.companyNo} — open to the public`],
    ["Management", `${FIAON_FIRMA.director} (Director), founder`],
    ["Payment", `By bank transfer to ${BANK.empfaenger} only — no direct debits, no stored card details`],
    ["Term", `${zahlen.monate}-month minimum term, then cancellable monthly; ${zahlen.widerruf}-day right of withdrawal`],
    ["Your data", "Servers in Frankfurt am Main, encrypted, under the GDPR — no data is ever sold"],
    ["Contact", `${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}`],
    ["Who it is for", "Customers in Germany, Austria and Switzerland"],
  ],
  abschnitte: [
    {
      id: "wer", h2a: "Who is behind ", h2b: "FIAON.",
      text: `FIAON is operated by ${FIAON_FIRMA.name}, registered with the UK company register (Companies House, England and Wales) under number ${FIAON_FIRMA.companyNo}, registered office ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}. The Director is the founder, ${FIAON_FIRMA.director}. You can check the register entry yourself — free of charge and without an account at Companies House. All statutory details are in the legal notice (Impressum); the team, with names and roles, is on the team page.`,
    },
    {
      id: "zahlung", h2a: "Where you pay — ", h2b: "and how to recognise us.",
      text: `At FIAON you pay by bank transfer only, to the business account of ${BANK.empfaenger}. There are no direct debits and no card charges: you make every payment yourself in your banking app. Every payment request states your personal payment reference and this account: recipient ${BANK.empfaenger}, IBAN ${BANK.ibanDisplay}, BIC ${BANK.bic}, ${BANK.bank}.`,
      punkte: [
        "FIAON never asks for payment by voucher, cryptocurrency, cash transfer or into a private account.",
        "If anyone asks you to do so in FIAON's name, please do not pay and let us know straight away.",
      ],
    },
    {
      id: "was", h2a: "What FIAON is — ", h2b: "and what it is not.",
      text: "FIAON is a platform for credit standing and access: your credit assessment from your own bank statements, a check of the entries in the data copy you obtain from SCHUFA, KSV or CRIF, correspondence with credit bureaus and creditors once you have approved it, and the preparation of your account and Visa credit card with our partner bank, DKB. Under the name FIAON Global, FIAON supports companies and private individuals with their US company — at a fixed price.",
      punkte: [
        "Not a bank: your account and your card are provided by the partner bank — FIAON prepares your application with you, and the bank decides on it.",
        "Not a credit broker: FIAON does not broker loans and never charges a fee for a loan. Warning lists about dubious credit brokers concern providers who take money up front for a loan that never arrives — at FIAON you pay a monthly fee for services set out in your contract.",
        "Not a law firm: FIAON is no substitute for a lawyer; where the law is the question, we tell you so.",
      ],
    },
    {
      id: "laufzeit", h2a: "Term and cancellation — ", h2b: "clear from the start.",
      text: `Before you sign, the order summary shows the plan, the monthly fee, the total amount, the term and the cancellation rule; the same details are repeated in your contract confirmation. Plans for private customers have a minimum term of ${zahlen.monate} months and can then be cancelled at any time with one month's notice. To end the contract at the close of the minimum term, give one month's notice — informally by e-mail or in your customer area under “Subscription & payments”. In addition, the statutory ${zahlen.widerruf}-day right of withdrawal applies from the conclusion of the contract. FIAON Global works with a fixed price per package, set before you commission us.`,
    },
    {
      id: "daten", h2a: "What happens to ", h2b: "your data.",
      text: "Your file is stored on servers in Frankfurt am Main, encrypted in transit and at rest. FIAON processes only what you upload yourself and sends no letter without your approval. Your credit data is never sold and never goes to advertising networks. You can request access, correction and erasure under Articles 15 to 17 GDPR at any time; once the contract has ended, we delete your documents in full on request — only invoicing records are kept, as the law requires.",
    },
    {
      id: "kontakt", h2a: "How to reach ", h2b: "real people.",
      text: `By phone on weekdays on ${FIAON_FIRMA.telefon} (German and English), by e-mail to ${FIAON_FIRMA.email} with a reply usually on the same working day, as a customer in your customer area under “Help” — every reply stays in your file — and for anything urgent via “Report urgently” on the contact page, straight to the management. Post: ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}.`,
    },
    {
      id: "verwechslung", h2a: "Do not ", h2b: "confuse us.",
      text: "FIAON is spelt F-I-A-O-N, the web address is fiaon.com, and the contracting party is FIAON LTD in London. Reviews, warnings and profiles under similar-sounding names concern other companies. Whatever entry you find online, check the name and the address — and ask us directly if something does not add up.",
    },
  ],
};

export const SERIOES_TEXTE = { de, en };
export type SerioesTexte = typeof de;
