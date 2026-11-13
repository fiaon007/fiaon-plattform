// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE FESTEN SÄTZE AN EINER STELLE (Register E-510, 13.11.2026)
//
// WAS IST DAS?
//   Die Sätze, die auf jeder öffentlichen Seite von FIAON Global WORTGLEICH stehen müssen — deutsch und englisch:
//   die festen Sätze S1 bis S17, die sechs Schritte, die Kurzfassung in vier Schritten, das Vertrauens-Band,
//   die Presse-Zeile und die Fassungen für Österreich und die Schweiz. Sie kommen aus dem Sprachleitfaden
//   FIAON Global (Endfassung vom 13.11.2026; die Nummer in Klammern nennt jeweils den Abschnitt dort).
//
// WER BENUTZT ES?
//   Jede öffentliche Global-Seite: Startseite, Honorarrechner, Unterseiten, Landingpages, Fuß, Menü,
//   der Text für Suchmaschinen, /llms.txt und die Vorschaubilder. Wer einen dieser Sätze braucht, holt ihn
//   von hier — er wird nirgends ein zweites Mal getippt.
//
// WAS WIRD NIE GEÄNDERT, OHNE DEN LEITFADEN ZU ÄNDERN?
//   · Der Wortlaut jedes Satzes. Erst der Leitfaden, dann diese Datei — nie umgekehrt.
//   · Die Schalter in SAETZE_VORBEHALTE. Sie stehen auf „nein“, solange die Sache dahinter nicht steht
//     (V1: der Prüfschritt im Selbstabschluss · V3: der Erklär-Satz zum Erfolgshonorar · V4: die Lang-Form der
//     Geld-zurück-Garantie). Umlegen darf sie nur, wer Justins Wort und die Freigabe des Anwalts hat.
//   · Was unter SAETZE_NICHT_FREIGEGEBEN liegt, benutzt KEINE Seite. Die Wortwand
//     (scripts/pruef-global-leitfaden.ts) schlägt an, sobald einer dieser Sätze irgendwo auftaucht.
//
// KEIN BETRAG IST GETIPPT.
//   Jeder Betrag kommt aus der Preisquelle (shared/fiaon-global-verkauf-preise.ts). Eine Ausnahme in Cent:
//   der Mindestbetrag des Erfolgshonorars. Er steht im Vertragsmotor (Staffel E-505), und den darf diese
//   Datei nicht einbinden (siehe unten). Deshalb steht er hier als Spiegel — die Wortwand vergleicht ihn bei
//   jedem Lauf mit dem Vertragsmotor und bricht ab, wenn die beiden auseinanderlaufen.
//
// KEIN KREIS.
//   Diese Datei bindet nur zwei Blätter ein, die selbst nichts einbinden: die Preisquelle und die Firmendaten.
//   Deshalb darf JEDE andere Datei sie einbinden (auch ein-produkt.ts, die Suchmaschinen-Tabelle und die
//   Seitentexte). Bitte so lassen: hier nie eine Seitendatei, den Vertragsmotor oder fiaon-global-verkauf.ts
//   einbinden.
//
// WORTGRENZEN (Leitfaden, Leitplanken 1 bis 10): keine Zusage zu Konto, Karte oder Finanzierung — darüber
// entscheidet das jeweilige Institut; nie „garantiert“, kein „bis zu“, keine Zinszahl, kein Bankname, kein
// Steuerversprechen. FIAON ist keine Kanzlei und vergibt und vermittelt keine Kredite. Österreich: kein Wort zu
// Konto, Karte, Finanzierung, kein Honorar-Betrag, nicht das Wort „Unternehmensberatung“.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, type VerkaufSprache } from "./fiaon-global-verkauf-preise";

/** Sprache eines Satzes — dieselben zwei Werte wie überall im Verkaufsmotor. */
export type SatzSprache = VerkaufSprache;
/** Für welches Land eine Seite spricht. „ANDERES“ = außerhalb von Deutschland, Österreich und der Schweiz. */
export type SatzLand = "DE" | "CH" | "AT" | "ANDERES";

// ═══════════════════════════════════════════════════════════════════════════
// 1  DIE SCHALTER — welche Fassung heute gilt (Leitfaden 0.3)
//    false = noch nicht freigegeben. Heute stehen alle drei auf false: Überall gilt die Zeile „heute“.
// ═══════════════════════════════════════════════════════════════════════════
export const SAETZE_VORBEHALTE: Readonly<Record<"V1" | "V3" | "V4", boolean>> = {
  /** V1 — „unsere Prüfung (Due Diligence)“ als echter Schritt im Selbstabschluss. Solange false: S5-B und Schritt 5 „Finanzierung“. */
  V1: false,
  /** V3 — der Erklär-Satz S16 zum Erfolgshonorar. Solange false: die drei Honorarzeilen aus S12. */
  V3: false,
  /** V4 — die Lang-Form der Geld-zurück-Garantie. Solange false: Kurz-Form (S7) und Mittel-Form. */
  V4: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// 2  DIE BETRÄGE — die Platzhalter aus dem Leitfaden (0.5), eingesetzt aus der Preisquelle
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Mindestbetrag des Erfolgshonorars in Cent — SPIEGEL von KAPITAL_C_STAFFEL.mindestCents (Staffel E-505, Vertragsmotor).
 * Nie von Hand ändern: Die Staffel selbst wird nie geändert, und die Wortwand vergleicht beide Zahlen bei jedem Lauf.
 */
export const SAETZE_ERFOLG_MIN_CENTS = 299_000;

export interface SatzBetraege {
  /** {HONORAR_AUFTRAG} — fällig mit dem Auftrag: Gründung und aktive Betreuung im ersten Jahr. */
  honorarAuftrag: string;
  /** {FAST_TRACK} — auf Wunsch. */
  fastTrack: string;
  /** {JAHRESBETREUUNG} — ab dem zweiten Jahr, auf Wunsch, je Jahr. */
  jahresbetreuung: string;
  /** {ERFOLG_MIN} — Mindestbetrag des Erfolgshonorars. Immer mit „mindestens“, nie mit „ab“. */
  erfolgMin: string;
  /** {RAHMEN} — die Spanne des Kapitalrahmens. Steht nie ohne den Miami-Satz (WEITERE_SAETZE.MIAMI). */
  rahmen: string;
}
const betraege = (s: SatzSprache): SatzBetraege => ({
  honorarAuftrag: verkaufEur(VERKAUF_PREISE.gruendungCents, s),
  fastTrack: verkaufEur(VERKAUF_PREISE.fastTrackCents, s),
  jahresbetreuung: verkaufEur(VERKAUF_PREISE.jahresCents, s),
  erfolgMin: verkaufEur(SAETZE_ERFOLG_MIN_CENTS, s),
  rahmen: s === "en"
    ? `US$${VERKAUF_RAHMEN.minUsd.toLocaleString("en-GB")} to US$${VERKAUF_RAHMEN.maxUsd.toLocaleString("en-GB")}`
    : `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} bis ${VERKAUF_RAHMEN.maxUsd.toLocaleString("de-DE")} US-Dollar`,
});
/** Die fertigen Beträge je Sprache — für jeden Text, der einen Betrag nennt. Beispiel: SAETZE_BETRAEGE.de.erfolgMin */
export const SAETZE_BETRAEGE: Readonly<Record<SatzSprache, SatzBetraege>> = { de: betraege("de"), en: betraege("en") };
const B = SAETZE_BETRAEGE;

/** „FIAON LTD“ und die Registernummer — aus den Firmendaten, nie getippt. */
const FIRMA = FIAON_FIRMA.name;
const REGISTER_NR = FIAON_FIRMA.companyNo;

// ═══════════════════════════════════════════════════════════════════════════
// 3  DIE FESTEN SÄTZE S1 BIS S17 (Leitfaden 5.3) — wortgleich, deutsch und englisch
// ═══════════════════════════════════════════════════════════════════════════
/** Die Nummern der freigegebenen Sätze, wie sie im Leitfaden heißen. S5-A und S16 fehlen hier mit Absicht. */
export type SatzNr =
  | "S1" | "S2" | "S3" | "S4" | "S5-B" | "S5-C" | "S6" | "S7" | "S8" | "S8-AT"
  | "S9" | "S10" | "S11" | "S12" | "S13" | "S14" | "S15" | "S17";

export interface FesterSatz {
  /** Wofür der Satz steht — eine Notiz für uns, kein Seitentext. */
  wofuer: string;
  de: string;
  en: string;
}

export const FESTE_SAETZE: Readonly<Record<SatzNr, FesterSatz>> = {
  S1: {
    wofuer: "Institut und Finanzierung — steht in jedem Block, der von Finanzierung handelt",
    de: "Über die Finanzierung entscheidet das finanzierende Institut.",
    en: "All financing decisions rest with the lender.",
  },
  S2: {
    wofuer: "Anträge, Konto und Karte",
    de: "Die Anträge stellen Sie selbst; wir bereiten sie vollständig vor. Über Konto, Karte und Rahmen entscheidet das jeweilige Institut.",
    en: "You submit each application yourself; we prepare it in full. Each institution makes its own decision on accounts, cards and limits.",
  },
  S3: {
    wofuer: "Behörden: Eintragung und Steuernummern",
    de: "Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde.",
    en: "Registration is decided by the state; the EIN and the ITIN by the US tax authority.",
  },
  S4: {
    wofuer: "Kreditkarten auf Wunsch",
    de: "Auf Wunsch bereiten wir auch Ihre Kreditkartenanträge vor — ohne zusätzliches Honorar von FIAON. Über jede Karte entscheidet der Herausgeber.",
    en: "On request, we also prepare your credit card applications — at no additional fee from FIAON. Each card issuer makes its own decision.",
  },
  "S5-B": {
    wofuer: "Finanzierung — die Fassung, die heute gilt (solange V1 offen ist)",
    de: "Wir bereiten jeden Antrag für die Finanzierung im gewählten Kapitalrahmen vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts. Vor Beginn unserer Arbeit stellen wir Ihre Identität fest und gleichen Ihre Angaben mit den Sanktionslisten ab. Was FIAON für Ihre Finanzierung einbringt, steht verbindlich in Ihrem persönlichen Angebot.",
    en: "We prepare every application for financing within the funding target you have chosen and support your company through to the lender’s decision. Before work begins, we verify your identity and screen your details against the applicable sanctions lists. What FIAON contributes to your financing is set out in your personal proposal and forms part of your agreement.",
  },
  "S5-C": {
    wofuer: "Zeile im Honorarblatt des Honorarrechners",
    de: "Was FIAON für Ihre Finanzierung einbringt, steht verbindlich in Ihrem persönlichen Angebot.",
    en: "What FIAON contributes to your financing is set out in your personal proposal and forms part of your agreement.",
  },
  S6: {
    wofuer: "Umschuldung und Aufstockung — ein Vorgehen, kein Ergebnis",
    de: "Ab dem achtzehnten Monat prüfen wir mit Ihnen, ob eine Umschuldung die Finanzierungskosten senken oder eine Aufstockung Ihren Spielraum für Investitionen erweitern kann. Voraussetzung ist die laufende Jahresbetreuung. Ob und zu welchen Bedingungen, entscheidet das jeweilige Institut.",
    en: "From the eighteenth month, we review with you whether refinancing could reduce your financing costs or an increase could widen your scope for investment. This requires annual administration to be in place. Whether, and on what terms, is for the lender concerned to decide.",
  },
  S7: {
    wofuer: "Geld zurück, Kurz-Form — auf jeder Seite verwendbar, die von Finanzierung handelt (ohne das Hauptwort)",
    de: "Kommt die Auszahlung Ihrer Finanzierung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags; über die Finanzierung entscheidet das finanzierende Institut.",
    en: "If the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us. The conditions are set out in clause 4 of your agreement; all financing decisions rest with the lender.",
  },
  S8: {
    wofuer: "Rolle — der Satz im Fuß jeder Seite",
    de: "FIAON ist keine Bank und keine Kanzlei. FIAON vergibt und vermittelt keine Kredite. Recht und Steuern liegen bei Partner-Anwälten und US-Steuerberatern (CPA) aus unserem Partnernetz; sie arbeiten in eigener Verantwortung.",
    en: "FIAON is neither a bank nor a law firm. FIAON does not lend and does not broker loans. Legal and tax matters rest with partner lawyers and US certified public accountants (CPAs) from our partner network, who act in their own professional capacity.",
  },
  "S8-AT": {
    wofuer: "Rolle — der Satz im Fuß der Österreich-Seite",
    de: "FIAON ist keine Bank und keine Kanzlei. Recht und Steuern liegen bei Partnern, die in eigener Verantwortung arbeiten.",
    en: "FIAON is neither a bank nor a law firm. Legal and tax matters rest with partners acting in their own professional capacity.",
  },
  S9: {
    wofuer: "Kapitalrahmen — steht immer im selben Blick wie die Zahl",
    de: "Ein Kapitalrahmen ist ein Ziel, kein Versprechen. Sie wählen ihn selbst.",
    en: "A funding target is a goal, not a promise. You choose it yourself.",
  },
  S10: {
    wofuer: "Steuern",
    de: "Eine US-Gesellschaft ist kein Steuermodell. Ihre Steuerpflicht im Wohnsitzland bleibt bestehen.",
    en: "A US company is not a tax scheme. Your tax liability in your country of residence remains.",
  },
  S11: {
    wofuer: "Haftung bei Firmenkreditkarten",
    de: "Firmenkreditkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.",
    en: "Business credit cards generally require a personal guarantee from the owner.",
  },
  S12: {
    wofuer: "Honorar in drei Zeilen — immer zusammen: mit Ihrem Auftrag · mit der Eintragung · ab dem zweiten Jahr",
    de: `Mit Ihrem Auftrag zahlen Sie ${B.de.honorarAuftrag} für die Gründung und die aktive Betreuung im ersten Jahr. Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig. Es richtet sich nach Ihrem Kapitalrahmen, beträgt mindestens ${B.de.erfolgMin} und steht als Betrag in Ihrem Angebot, bevor Sie unterzeichnen. Ab dem zweiten Jahr können Sie die Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr beauftragen; sie verlängert sich nicht von selbst. Alle Beträge sind Endpreise.`,
    en: `On engagement you pay ${B.en.honorarAuftrag} for formation and administration in the first year. The success fee falls due on registration of your company. It is set by your funding target, is at least ${B.en.erfolgMin} and is stated as an amount in your proposal before you sign. From the second year you may continue with annual administration for ${B.en.jahresbetreuung} a year; it does not renew automatically. All fees are stated in full; nothing is added.`,
  },
  S13: {
    wofuer: "Verbundene Gesellschaft — eine Pflicht-Angabe, nur dort, wo die Schwarzott Group genannt wird (Partnerseite)",
    de: `Die Schwarzott Group ist mit FIAON über unseren Gründer Justin Schwarzott verbunden. Ihr Vertragspartner ist in jedem Fall die ${FIRMA}.`,
    en: `Schwarzott Group is connected to FIAON through our founder Justin Schwarzott. Your contracting party is always ${FIRMA}.`,
  },
  S14: {
    wofuer: "Presse — genau diese Zeile, immer mit dem Link aus PRESSE_ZEILE.adresse, je Seite höchstens einmal",
    de: "Zitiert in Die Presse (02.11.2026)",
    en: "Quoted in Die Presse (2 November 2026)",
  },
  S15: {
    wofuer: "Dauern — nur in der Tabelle der Ablaufseite und bei Erfahrungswerten",
    de: "Wie lange ein Schritt dauert, bestimmen Behörden und Institute. Unsere Angaben dazu sind Erfahrungswerte, keine Fristen.",
    en: "Authorities and institutions determine how long each step takes. Our timings are based on experience; they are not deadlines.",
  },
  S17: {
    wofuer: "Österreich — der eine Satz nach Schritt 1 und 2",
    de: "Ihr weiteres Vorhaben besprechen wir persönlich.",
    en: "We discuss your further plans with you in person.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 4  NOCH NICHT FREIGEGEBEN — liegt hier, steht auf KEINER Seite (Leitfaden 0.3)
//    Die Wortwand kennt jeden dieser Sätze und meldet ihn als SPERRE, sobald er irgendwo sonst auftaucht.
// ═══════════════════════════════════════════════════════════════════════════
export const SAETZE_NICHT_FREIGEGEBEN = {
  /** S5-A — Zielfassung von Schritt 5. Gilt erst, wenn es den Prüfschritt im Ablauf und im Vertrag gibt (V1). */
  "S5-A": {
    vorbehalt: "V1",
    wofuer: "Prüfung und Finanzierung — Zielfassung",
    de: "Fällt unsere Prüfung (Due Diligence) positiv aus, begleiten wir Ihre Gesellschaft bis zur Finanzierung im gewählten Kapitalrahmen. Was FIAON dafür einbringt, steht verbindlich in Ihrem persönlichen Angebot. Über die Finanzierung entscheidet das finanzierende Institut.",
    en: "Subject to satisfactory due diligence, we support your company through to financing within the funding target you have chosen. What FIAON contributes to that end is set out in your personal proposal and forms part of your agreement. All financing decisions rest with the lender.",
  },
  /** Schritt 5 in der Zielfassung (Leitfaden 2.2 und 2.3) — Titel, Satz, Bedingung. */
  "SCHRITT-5": {
    vorbehalt: "V1",
    wofuer: "Schritt 5 der Erzählung — Zielfassung",
    de: {
      titel: "Prüfung und Finanzierung",
      satz: "Fällt unsere Prüfung (Due Diligence) positiv aus, begleiten wir Ihre Gesellschaft bis zur Finanzierung im gewählten Kapitalrahmen.",
      bedingung: "Was FIAON dafür einbringt, steht verbindlich in Ihrem persönlichen Angebot. Über die Finanzierung entscheidet das finanzierende Institut; den Darlehensvertrag schließt Ihre Gesellschaft im eigenen Namen.",
    },
    en: {
      titel: "Due diligence and financing",
      satz: "Subject to satisfactory due diligence, we support your company through to financing within the funding target you have chosen.",
      bedingung: "What FIAON contributes to that end is set out in your personal proposal and forms part of your agreement. All financing decisions rest with the lender; your company enters into the loan agreement in its own name.",
    },
  },
  /** Platz 3 der Kurzfassung in vier Schritten (Leitfaden 2.5) — Zielfassung. */
  "KURZ-3": {
    vorbehalt: "V1",
    wofuer: "Kurzfassung, Platz 3 — Zielfassung",
    de: {
      titel: "Prüfung und Finanzierung",
      text: "Fällt unsere Prüfung (Due Diligence) positiv aus, begleiten wir Ihre Gesellschaft bis zur Finanzierung im gewählten Kapitalrahmen. Über die Finanzierung entscheidet das finanzierende Institut.",
    },
    en: {
      titel: "Due diligence and financing",
      text: "Subject to satisfactory due diligence, we support your company through to financing within the funding target you have chosen. All financing decisions rest with the lender.",
    },
  },
  /** Die Zeile, die sagt, WAS geprüft wird (Leitfaden 2.6) — erst mit dem Prüfschritt. */
  "PRUEF-ZEILE": {
    vorbehalt: "V1",
    wofuer: "Was unsere Prüfung umfasst",
    de: "Wir prüfen Identität, Unterlagen und Vorhaben, bevor wir uns festlegen.",
    en: "We verify identity, documents and the purpose of your company before we commit.",
  },
  /** S16 — der Erklär-Satz zum Erfolgshonorar. Erst nach Freigabe durch den Anwalt (V3). Bis dahin gilt S12. */
  S16: {
    vorbehalt: "V3",
    wofuer: "Erfolgshonorar erklärt",
    de: "Das Erfolgshonorar wird mit der Eintragung Ihrer Gesellschaft fällig — nicht erst mit der Auszahlung. Es richtet sich nach dem Kapitalrahmen, den Sie selbst wählen, und steht als Betrag in Ihrem Angebot, bevor Sie unterzeichnen. Es wächst nicht mit der Zahl der Anträge. Kommt es nicht zur Eintragung, entfällt es. Unter welchen Bedingungen Sie es zurückerhalten, regelt Ziffer 4 Ihres Vertrags.",
    en: "The success fee falls due on registration of your company, not on disbursement. It is set by the funding target you choose and is stated as an amount in your proposal before you sign. It does not rise with the number of applications. If the company is not registered, no success fee is payable. Clause 4 of your agreement sets out the conditions on which it is refunded.",
  },
  /** Die Lang-Form der Geld-zurück-Garantie (Leitfaden 5.7). Erst nach Freigabe durch den Anwalt (V4). */
  "GARANTIE-LANG": {
    vorbehalt: "V4",
    wofuer: "Geld zurück, Lang-Form — wann die Frist ruht und wann die Erstattung entfällt",
    de: "Die Frist ruht, solange Ihre Rechnung zum Auftrag nicht bezahlt ist und bis Ihr Reisepass vorliegt. Sie ruht außerdem nur für die Tage, um die Sie die Frist von sieben Tagen für nachgeforderte Unterlagen überschreiten. Sie ruht auch, solange Ihrer Gesellschaft ein Finanzierungsangebot zu den Bedingungen Ihres Vertrags zur Annahme offensteht — ohne weitere Sicherheiten oder Kosten für Sie. Der Anspruch auf Erstattung entfällt, wenn Ihre Gesellschaft ein solches Angebot ablehnt oder verfallen lässt, und bei vorsätzlich falschen Angaben. Für Konto und Karten gilt er nicht. Maßgeblich ist Ziffer 4 Ihres Vertrags.",
    en: "The period is suspended for as long as the invoice issued on engagement is unpaid and until we have your passport. It is otherwise suspended only for the days by which you exceed the seven days allowed for additional documents. It is also suspended while a financing offer on the terms of your agreement is open for your company to accept — with no further security or cost to you. The right to a refund lapses if your company declines such an offer or lets it expire, or if false information is given deliberately. It does not extend to accounts and cards. Clause 4 of your agreement prevails.",
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// 5  WEITERE FESTE WORTLAUTE aus dem Leitfaden (Abschnitt in Klammern)
// ═══════════════════════════════════════════════════════════════════════════
export type WeitererSatzNr =
  | "LEITSATZ" | "PRODUKTNAME" | "POSITIONIERUNG" | "POSITIONIERUNG-AT" | "DEFINITION" | "ROLLEN" | "MIAMI" | "ZAHLUNG"
  | "HONORAR-LANDINGPAGE" | "HONORAR-AT" | "HONORAR-SCHLUSS" | "KONTO-CH" | "UNTERLAGEN-ZUERST" | "SCHRITT-6-TAKT" | "SCHRITT-6-ZINSABSICHT"
  | "UEBERGANG-ITIN" | "UEBERGANG-ASSISTENZ" | "UEBERGANG-EINREICHUNG" | "SCHLUSS";

export const WEITERE_SAETZE: Readonly<Record<WeitererSatzNr, FesterSatz>> = {
  LEITSATZ: {
    wofuer: "Leitsatz, öffentlich (0.1)",
    de: "Prüfen Sie uns an Fakten, nicht an Versprechen.",
    en: "Judge us on facts, not promises.",
  },
  PRODUKTNAME: {
    wofuer: "Name des einen Produkts (1.1)",
    de: "Ihre US-Gesellschaft — mit aktiver Betreuung",
    en: "Your US company — formed and administered",
  },
  POSITIONIERUNG: {
    wofuer: "Positionierung in einem Satz (1.1) — nicht auf der Österreich-Seite",
    de: "FIAON Global ist die Unternehmensberatung, die Ihre US-Gesellschaft gründet, betreut und bis zur Entscheidung über ihre Finanzierung begleitet — in einem Mandat, mit klar benannten Zuständigkeiten.",
    en: "FIAON Global is the business consultancy that forms and administers your US company and supports it through to the lender’s decision on its financing — under one engagement, with clear responsibilities.",
  },
  "POSITIONIERUNG-AT": {
    wofuer: "Positionierung auf der Österreich-Seite (1.1)",
    de: "FIAON Global gründet Ihre US-Gesellschaft, holt jede Unterlage ein und übernimmt im ersten Jahr Fristen und Meldungen. Ihr weiteres Vorhaben besprechen wir persönlich.",
    en: "FIAON Global forms your US company, assembles its documents in full and handles deadlines and filings in the first year. We discuss your further plans with you in person.",
  },
  DEFINITION: {
    wofuer: "Definitionssatz für Datenblock und /llms.txt (9.4) — ohne Länder; Österreich wird getrennt geführt",
    de: `FIAON Global ist die Unternehmensberatung der ${FIRMA} (London, Companies House Nr. ${REGISTER_NR}). Sie gründet US-Gesellschaften, übernimmt deren laufende Betreuung und begleitet sie bis zur Entscheidung über ihre Finanzierung. Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut. FIAON ist keine Bank und keine Kanzlei und vermittelt keine Kredite.`,
    en: `FIAON Global is the business consultancy of ${FIRMA} (London, registered in England and Wales, company number ${REGISTER_NR}). It forms US companies, administers them and supports them through to the lender’s decision on their financing. Decisions on accounts, cards and financing rest with the institution concerned. FIAON is neither a bank nor a law firm and does not broker loans.`,
  },
  ROLLEN: {
    wofuer: "Rollen-Satz zu den Partnern (5.11) — ersetzt „arbeiten auf Ihr Mandat“",
    de: "Partner-Anwälte und US-Steuerberater (CPA) aus unserem Partnernetz arbeiten in eigener Verantwortung. Deren Honorare für die Leistungen Ihres Vertrags trägt FIAON.",
    en: "Partner lawyers and US certified public accountants (CPAs) from our partner network act in their own professional capacity. FIAON bears their fees for the services in your agreement.",
  },
  MIAMI: {
    wofuer: "Der Satz, der immer bei der Spanne des Kapitalrahmens steht (5.8)",
    de: "Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami.",
    en: "From US$1 million, we work with you in person in Miami.",
  },
  ZAHLUNG: {
    wofuer: "Zahlung (5.6 Nr. 11)",
    de: `Sie zahlen per Rechnung und Überweisung an die ${FIRMA}. Kein Abo, keine Abbuchung.`,
    en: `You pay by invoice and bank transfer to ${FIRMA}. No subscription, no direct debit.`,
  },
  "HONORAR-LANDINGPAGE": {
    wofuer: "Honorar-Satz der Landingpages (7.6) — nennt beide Teile des Honorars",
    de: `${B.de.honorarAuftrag} mit Ihrem Auftrag. Wählen Sie zusätzlich einen Kapitalrahmen, kommt mit der Eintragung das Erfolgshonorar hinzu — mindestens ${B.de.erfolgMin}. Ohne Kapitalrahmen erhalten Sie Ihr Angebot persönlich.`,
    en: `${B.en.honorarAuftrag} on engagement. If you also choose a funding target, the success fee follows on registration — at least ${B.en.erfolgMin}. Without a funding target, you receive your proposal from us in person.`,
  },
  "HONORAR-AT": {
    wofuer: "Honorar auf der Österreich-Seite (5.12) — ohne Betrag",
    de: "Ihr Honorar steht in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.",
    en: "Your fees are set out in your personal proposal before you sign.",
  },
  "HONORAR-SCHLUSS": {
    wofuer: "Letzte Zeile der Honorarübersicht im Honorarrechner (8.4)",
    de: "Alle Beträge sind Endpreise. Kommt es nicht zur Eintragung, entfällt das Erfolgshonorar.",
    en: "All fees are stated in full; nothing is added. If the company is not registered, no success fee is payable.",
  },
  "KONTO-CH": {
    // Der englische Wortlaut steht nicht im Leitfaden; er ist aus dessen Wörtern gebaut (Schritt 2 und S2) und sagt weniger zu als S2.
    wofuer: "Schweiz-Seite: der eine Satz zu Konto und Karte im Fließtext (2.8, 5.12)",
    de: "Wir stellen die Unterlagen Ihrer Gesellschaft für Ihre eigenen Anträge zusammen; es entscheidet das jeweilige Institut.",
    en: "We assemble your company’s documents for your own applications; each institution makes its own decision.",
  },
  "UNTERLAGEN-ZUERST": {
    wofuer: "Persönlicher Weg mit Prüfung der Unterlagen, etwa bei einer bestehenden Gesellschaft (2.6)",
    de: "Wir prüfen zuerst Ihre Unterlagen. Danach erhalten Sie Ihr Angebot.",
    en: "We review your documents first. You then receive your proposal.",
  },
  "SCHRITT-6-TAKT": {
    wofuer: "Zusatz zu Schritt 6, wenn der Takt gezeigt werden soll (2.7) — genau dieser eine Satz",
    de: "Wir prüfen erstmals ab dem achtzehnten Monat, danach auf Ihren Wunsch erneut. Die Jahresbetreuung verlängert sich nicht von selbst.",
    en: "We carry out this review for the first time from the eighteenth month, and again thereafter at your request. Annual administration does not renew automatically.",
  },
  "SCHRITT-6-ZINSABSICHT": {
    wofuer: "Die einzige erlaubte Zins-Absicht (2.7) — nur in Präsentation oder Fragen-Antwort, nur zusätzlich zu S6 und mit S1 im selben Block; nie in Überschrift, Bühne, Kachel oder Trefferzeile",
    de: "mit dem Ziel, die Zinslast zu begrenzen",
    en: "with the aim of containing interest costs",
  },
  "UEBERGANG-ITIN": {
    wofuer: "Übergangssatz, bis die Partner feststehen (5.11)",
    de: "Für Ihre ITIN prüfen wir vorab, ob die Voraussetzungen vorliegen (ITIN-Check).",
    en: "For your ITIN, we first check that the requirements are met (ITIN check).",
  },
  "UEBERGANG-ASSISTENZ": {
    wofuer: "Übergangssatz, bis die Partner feststehen (5.11)",
    de: "Post, Anrufe und Termine Ihrer Gesellschaft koordiniert Ihr Ansprechpartner.",
    en: "Your dedicated contact coordinates post, calls and appointments for your company.",
  },
  "UEBERGANG-EINREICHUNG": {
    wofuer: "Übergangssatz, bis die Partner feststehen (5.11) — ersetzt „Team vor Ort“",
    de: "Wir reichen die Gründung über unsere Partner in den USA ein.",
    en: "We file the formation through our partners in the United States.",
  },
  SCHLUSS: {
    wofuer: "Schluss-Satz der Startseite (7.1)",
    de: "Ihr Honorar sehen Sie, bevor Sie sich festlegen.",
    en: "You see your fees before you commit.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 6  DIE HANDLUNGEN — überall gleich benannt (Leitfaden 7)
// ═══════════════════════════════════════════════════════════════════════════
export type HandlungNr = "angebot" | "gespraech" | "mandat";
export const HANDLUNGEN: Readonly<Record<HandlungNr, { wofuer: string; de: string; en: string }>> = {
  angebot: { wofuer: "Haupt-Handlung: Bühne, Kopf, Karte, Schluss, Handy-Leiste", de: "Angebot anfordern", en: "Request your proposal" },
  gespraech: { wofuer: "Zweite Handlung; auf der Österreich-Seite und für andere Länder die einzige", de: "Gespräch vereinbaren", en: "Arrange a call" },
  mandat: { wofuer: "Im persönlichen Angebot, beim Unterzeichnen", de: "Mandat erteilen", en: "Instruct us" },
};

// ═══════════════════════════════════════════════════════════════════════════
// 7  DIE SECHS SCHRITTE (Leitfaden 2.2 deutsch, 2.3 englisch) — Schritt 5 in der Fassung „heute“ (2.6), Schritt 6 nach 2.7
// ═══════════════════════════════════════════════════════════════════════════
export type SchrittNr = 1 | 2 | 3 | 4 | 5 | 6;

export interface Schritt {
  nr: SchrittNr;
  /** Der Titel — ein Hauptwort, kein Spruch. */
  titel: string;
  /** Kurzwort für Zeitstrahl und Handy (2.5). */
  kurz: string;
  /** „Was wir tun“. Steht nie ohne die Bedingung im selben Blick. */
  satz: string;
  /** Wer entscheidet, was gilt. Darf auf keiner Fläche fehlen. */
  bedingung: string;
  /** Was der Klient selbst tut. */
  ihrTeil: string;
  /** Was FIAON abliefert — immer ein Arbeitsergebnis, nie die Entscheidung eines Dritten. */
  ihrErgebnis: string;
  /** Wer entscheidet — die Rolle, nie ein Name (5.4). */
  entscheidet: string;
  /** Die Zeile des Schritts in der Tabelle „Wer macht was“ (2.4). */
  werMachtWas: { fiaon: string; sie: string; wennEsAusbleibt: string };
  /** Nur Schritt 5: der Satz, falls die Finanzierung ausbleibt — gehört zu Schritt 5 und nur dorthin. */
  ausbleiben?: { titel: string; text: string };
}

const SCHRITT_5_HEUTE: Record<SatzSprache, Pick<Schritt, "titel" | "satz" | "bedingung">> = {
  de: {
    titel: "Finanzierung",
    satz: "Wir bereiten jeden Antrag für die Finanzierung im gewählten Kapitalrahmen vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts.",
    bedingung: "Vor Beginn unserer Arbeit stellen wir Ihre Identität fest und gleichen Ihre Angaben mit den Sanktionslisten ab (Ziffer 8 Ihres Vertrags). Was FIAON für Ihre Finanzierung einbringt, steht verbindlich in Ihrem persönlichen Angebot. Über die Finanzierung entscheidet das finanzierende Institut.",
  },
  en: {
    titel: "Financing",
    satz: "We prepare every application for financing within the funding target you have chosen and support your company through to the lender’s decision.",
    bedingung: "Before work begins, we verify your identity and screen your details against the applicable sanctions lists (clause 8 of your agreement). What FIAON contributes to your financing is set out in your personal proposal and forms part of your agreement. All financing decisions rest with the lender.",
  },
};
/** Schritt 5: Titel, Satz und Bedingung in der Fassung, die der Schalter V1 vorgibt — heute immer „heute“. */
const schritt5 = (s: SatzSprache): Pick<Schritt, "titel" | "satz" | "bedingung"> =>
  SAETZE_VORBEHALTE.V1 ? SAETZE_NICHT_FREIGEGEBEN["SCHRITT-5"][s] : SCHRITT_5_HEUTE[s];

export const SECHS_SCHRITTE: Readonly<Record<SatzSprache, readonly Schritt[]>> = {
  de: [
    {
      nr: 1,
      titel: "Gründung",
      kurz: "Gründung",
      satz: "Wir gründen Ihre US-Gesellschaft (LLC) in Delaware, Florida oder Wyoming. Sie gehört allein Ihnen.",
      bedingung: "Über die Eintragung entscheidet der Bundesstaat.",
      ihrTeil: "Sie wählen den Namen und unterzeichnen online.",
      ihrErgebnis: "Die Anmeldung beim Bundesstaat, Staatsgebühr enthalten; nach der Eintragung die Gründungsunterlagen in Ihrem Portal.",
      entscheidet: "der Bundesstaat",
      werMachtWas: {
        fiaon: "meldet die Gesellschaft an, trägt die Staatsgebühr",
        sie: "wählen den Namen, unterzeichnen online",
        wennEsAusbleibt: "Kommt es nicht zur Eintragung, entfällt das Erfolgshonorar (Ziffer 6 Absatz 2).",
      },
    },
    {
      nr: 2,
      titel: "Unterlagen",
      kurz: "Unterlagen",
      satz: "Wir holen jede Unterlage ein: Gründungsunterlagen, Operating Agreement, Registered Agent, US-Geschäftsadresse und US-Telefonnummer. Die Steuernummer Ihrer Gesellschaft (EIN) beantragen wir, Ihre persönliche Steuernummer (ITIN) nach unserem ITIN-Check.",
      bedingung: "Über EIN und ITIN entscheidet die US-Steuerbehörde. Die ITIN beantragen wir nur, wenn die Voraussetzungen vorliegen.",
      ihrTeil: "Sie laden Ihren Reisepass hoch und unterzeichnen die Unterlagen, die wir vorlegen.",
      ihrErgebnis: "Die vollständige Akte Ihrer Gesellschaft und Ihr Pflichtenkalender.",
      entscheidet: "die US-Steuerbehörde",
      werMachtWas: {
        fiaon: "holt die Unterlagen ein, beantragt EIN und ITIN",
        sie: "reichen Reisepass und Angaben ein, unterzeichnen",
        wennEsAusbleibt: "Liegen die Voraussetzungen für eine ITIN nicht vor, zeigen wir Ihnen die Wege ohne ITIN (Ziffer 2).",
      },
    },
    {
      nr: 3,
      titel: "Konten",
      kurz: "Konten",
      satz: "Wir bereiten mit Ihnen die Eröffnung Ihrer privaten und geschäftlichen US-Konten vor und begleiten Sie bis zur Entscheidung des Instituts.",
      bedingung: "Die Anträge stellen Sie selbst. Über jedes Konto entscheidet das jeweilige Institut. FIAON erhält keine Vollmacht über Ihr Konto.",
      ihrTeil: "Sie stellen jeden Antrag selbst.",
      ihrErgebnis: "Vollständig vorbereitete Kontoanträge.",
      entscheidet: "das jeweilige Institut",
      werMachtWas: {
        fiaon: "bereitet jeden Antrag vollständig vor, begleitet",
        sie: "stellen den Antrag selbst",
        wennEsAusbleibt: "Die Erstattung nach Ziffer 4 gilt für Konten nicht (Ziffer 3).",
      },
    },
    {
      nr: 4,
      titel: "Kreditkarten auf Wunsch",
      kurz: "Karten",
      satz: "Auf Wunsch bereiten wir auch Ihre Kreditkartenanträge vor — privat und für Ihre Gesellschaft, ohne zusätzliches Honorar von FIAON.",
      bedingung: "Über jede Karte und ihren Rahmen entscheidet der Herausgeber; seine Gebühren und Zinsen legt er selbst fest, und Sie tragen sie. Firmenkreditkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.",
      ihrTeil: "Sie stellen jeden Antrag selbst.",
      ihrErgebnis: "Vollständig vorbereitete Kartenanträge.",
      entscheidet: "der Kartenherausgeber",
      werMachtWas: {
        fiaon: "bereitet jeden Antrag vor, ohne zusätzliches Honorar",
        sie: "stellen den Antrag selbst, haften in der Regel persönlich",
        wennEsAusbleibt: "Die Erstattung nach Ziffer 4 gilt für Karten nicht (Ziffer 3).",
      },
    },
    {
      nr: 5,
      ...schritt5("de"),
      kurz: "Finanzierung",
      ihrTeil: "Sie wählen den Kapitalrahmen. Ihre Gesellschaft stellt den Antrag und entscheidet über jedes Angebot des Instituts.",
      ihrErgebnis: "Vollständig vorbereitete Finanzierungsanträge und unsere Begleitung bis zur Entscheidung des Instituts.",
      entscheidet: "das finanzierende Institut",
      werMachtWas: {
        fiaon: SAETZE_VORBEHALTE.V1 ? "prüft, bereitet die Anträge vor, begleitet" : "bereitet die Anträge vor, begleitet",
        sie: "wählen den Kapitalrahmen; Ihre Gesellschaft stellt den Antrag und entscheidet über jedes Angebot des Instituts",
        wennEsAusbleibt: "Kommt die Auszahlung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir alles, was Sie an uns gezahlt haben (Ziffer 4).",
      },
      ausbleiben: {
        titel: "Wenn die Finanzierung ausbleibt",
        text: "Kommt die Auszahlung Ihrer Finanzierung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags.",
      },
    },
    {
      nr: 6,
      titel: "Umschuldung und Aufstockung",
      kurz: "Umschuldung",
      satz: "Ab dem achtzehnten Monat prüfen wir mit Ihnen, ob eine Umschuldung die Finanzierungskosten senken oder eine Aufstockung Ihren Spielraum für Investitionen erweitern kann.",
      bedingung: "Voraussetzung ist die laufende Jahresbetreuung. Ob und zu welchen Bedingungen, entscheidet das jeweilige Institut.",
      ihrTeil: "Sie entscheiden, ob Ihre Gesellschaft einen Antrag stellt.",
      ihrErgebnis: "Eine Entscheidungsgrundlage für Sie; auf Ihren Wunsch bereiten wir die Anträge vor.",
      entscheidet: "das jeweilige Institut",
      werMachtWas: {
        fiaon: "prüft mit Ihnen, bereitet auf Wunsch die Anträge vor",
        sie: "entscheiden; Ihre Gesellschaft stellt den Antrag",
        wennEsAusbleibt: "Keine Zusage; es bleibt bei Ihrem bestehenden Darlehensvertrag.",
      },
    },
  ],
  en: [
    {
      nr: 1,
      titel: "Formation",
      kurz: "Formation",
      satz: "We form your US company (LLC) in Delaware, Florida or Wyoming. It belongs to you alone.",
      bedingung: "Registration is decided by the state.",
      ihrTeil: "You choose the name and sign online.",
      ihrErgebnis: "The state filing, state fee included; once registered, the formation documents in your portal.",
      entscheidet: "the state",
      werMachtWas: {
        fiaon: "files the company, pays the state fee",
        sie: "choose the name, sign online",
        wennEsAusbleibt: "If the company is not registered, no success fee is payable (clause 6(2)).",
      },
    },
    {
      nr: 2,
      titel: "Documents",
      kurz: "Documents",
      satz: "We assemble every document: formation documents, operating agreement, registered agent, US business address and US telephone number. We apply for your company’s tax identification number (EIN) and, following our ITIN check, for your personal number (ITIN).",
      bedingung: "The US tax authority decides on both numbers. We apply for the ITIN only where the requirements are met.",
      ihrTeil: "You upload your passport and sign the documents we present.",
      ihrErgebnis: "A complete company file and your compliance calendar.",
      entscheidet: "the US tax authority",
      werMachtWas: {
        fiaon: "assembles the documents, applies for EIN and ITIN",
        sie: "provide your passport and details, sign",
        wennEsAusbleibt: "Where the requirements for an ITIN are not met, we show you the routes without an ITIN (clause 2).",
      },
    },
    {
      nr: 3,
      titel: "Accounts",
      kurz: "Accounts",
      satz: "Together with you, we prepare the opening of your personal and business US accounts and support you until each institution has decided.",
      bedingung: "You submit every application yourself. Each institution makes its own decision. FIAON holds no authority over your account.",
      ihrTeil: "You submit every application yourself.",
      ihrErgebnis: "Fully prepared account applications.",
      entscheidet: "each institution",
      werMachtWas: {
        fiaon: "prepares every application in full, supports you",
        sie: "submit the application yourself",
        wennEsAusbleibt: "The refund under clause 4 does not extend to accounts (clause 3).",
      },
    },
    {
      nr: 4,
      titel: "Credit cards on request",
      kurz: "Cards",
      satz: "On request, we also prepare your personal and business credit card applications — at no additional fee from FIAON.",
      bedingung: "Each card issuer decides on the card and its limit and sets its own charges and interest, which you bear. Business credit cards generally require a personal guarantee from the owner.",
      ihrTeil: "You submit every application yourself.",
      ihrErgebnis: "Fully prepared card applications.",
      entscheidet: "the card issuer",
      werMachtWas: {
        fiaon: "prepares every application, at no additional fee",
        sie: "submit the application yourself; a personal guarantee is generally required",
        wennEsAusbleibt: "The refund under clause 4 does not extend to cards (clause 3).",
      },
    },
    {
      nr: 5,
      ...schritt5("en"),
      kurz: "Financing",
      ihrTeil: "You choose the funding target. Your company submits the application and decides on any financing offer from the lender.",
      ihrErgebnis: "Fully prepared financing applications and our support through to the lender’s decision.",
      entscheidet: "the lender",
      werMachtWas: {
        fiaon: SAETZE_VORBEHALTE.V1 ? "reviews, prepares the applications, supports your company" : "prepares the applications, supports your company",
        sie: "choose the funding target; your company submits the application and decides on any financing offer",
        wennEsAusbleibt: "If the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us (clause 4).",
      },
      ausbleiben: {
        titel: "If the financing does not arrive",
        text: "If the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us. The conditions are set out in clause 4 of your agreement.",
      },
    },
    {
      nr: 6,
      titel: "Refinancing and increase",
      kurz: "Refinancing",
      satz: "From the eighteenth month, we review with you whether refinancing could reduce your financing costs or an increase could widen your scope for investment.",
      bedingung: "This requires annual administration to be in place. Whether, and on what terms, is for the lender concerned to decide.",
      ihrTeil: "You decide whether your company applies.",
      ihrErgebnis: "A basis for your decision; at your request we prepare the applications.",
      entscheidet: "the lender concerned",
      werMachtWas: {
        fiaon: "reviews with you, prepares the applications at your request",
        sie: "decide; your company submits the application",
        wennEsAusbleibt: "No commitment; your existing loan agreement continues unchanged.",
      },
    },
  ],
};

/**
 * Kopf des Abschnitts „Sechs Schritte“ (Leitfaden 8.3), die Titel der vier festen Teile (2.1 bis 2.3) und die Spalten der
 * Tabelle „Wer macht was“ (2.4). Für „Was wir tun“ nennt der Leitfaden nur das deutsche Wort; “What we do” ist seine Übersetzung.
 */
export const SCHRITTE_KOPF: Readonly<Record<SatzSprache, {
  auge: string; h2: string; lead: string;
  teile: { satz: string; bedingung: string; ihrTeil: string; ihrErgebnis: string };
  spalten: { schritt: string; fiaon: string; sie: string; entscheidet: string; wennEsAusbleibt: string };
}>> = {
  de: {
    auge: "Ablauf",
    h2: "Sechs Schritte. Jeder mit seiner Bedingung.",
    lead: "Jeder Schritt hat einen Verantwortlichen, eine Bedingung und ein Ergebnis.",
    teile: { satz: "Was wir tun", bedingung: "Bedingung", ihrTeil: "Ihr Teil", ihrErgebnis: "Ihr Ergebnis" },
    spalten: { schritt: "Schritt", fiaon: "FIAON", sie: "Sie", entscheidet: "Es entscheidet", wennEsAusbleibt: "Wenn es ausbleibt" },
  },
  en: {
    auge: "Process",
    h2: "Six steps. Each with its condition.",
    lead: "Each step has an owner, a condition and an outcome.",
    teile: { satz: "What we do", bedingung: "Condition", ihrTeil: "Your part", ihrErgebnis: "Your outcome" },
    spalten: { schritt: "Step", fiaon: "FIAON", sie: "You", entscheidet: "Decided by", wennEsAusbleibt: "If it does not come about" },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 8  DIE KURZFASSUNG IN VIER SCHRITTEN (Leitfaden 2.5) — Folie, Vorschaubild, Bogen am Handy
// ═══════════════════════════════════════════════════════════════════════════
export interface KurzSchritt { nr: 1 | 2 | 3 | 4; titel: string; kurz: string; text: string }

const KURZ_3_HEUTE: Record<SatzSprache, { titel: string; text: string }> = {
  de: { titel: "Finanzierung", text: "Wir bereiten jeden Antrag vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts." },
  en: { titel: "Financing", text: "We prepare every application in full and support your company through to the lender’s decision." },
};
const kurz3 = (s: SatzSprache): { titel: string; text: string } => (SAETZE_VORBEHALTE.V1 ? SAETZE_NICHT_FREIGEGEBEN["KURZ-3"][s] : KURZ_3_HEUTE[s]);

export const VIER_SCHRITTE: Readonly<Record<SatzSprache, readonly KurzSchritt[]>> = {
  de: [
    { nr: 1, titel: "Gründung und Unterlagen", kurz: "Gründung", text: "Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein und beantragen die Steuernummern. Über Eintragung und Nummern entscheiden Bundesstaat und US-Steuerbehörde." },
    { nr: 2, titel: "Konten — Karten auf Wunsch", kurz: "Konten", text: "Wir bereiten Ihre Kontoanträge mit Ihnen vor, privat und für Ihre Gesellschaft. Auf Wunsch auch Ihre Kreditkartenanträge — ohne zusätzliches Honorar von FIAON. Die Anträge stellen Sie selbst; es entscheidet das jeweilige Institut." },
    { nr: 3, ...kurz3("de"), kurz: "Finanzierung" },
    { nr: 4, titel: "Umschuldung und Aufstockung", kurz: "Umschuldung", text: "Ab dem achtzehnten Monat prüfen wir mit Ihnen Umschuldung oder Aufstockung, sofern die Jahresbetreuung läuft. Ob und zu welchen Bedingungen, entscheidet das Institut." },
  ],
  en: [
    { nr: 1, titel: "Formation and documents", kurz: "Formation", text: "We form your US company, assemble every document and apply for the tax identification numbers. Registration and numbers are decided by the state and the US tax authority." },
    { nr: 2, titel: "Accounts — cards on request", kurz: "Accounts", text: "We prepare your account applications with you, personal and business. On request, your credit card applications too — at no additional fee from FIAON. You submit the applications yourself; each institution decides." },
    { nr: 3, ...kurz3("en"), kurz: "Financing" },
    { nr: 4, titel: "Refinancing and increase", kurz: "Refinancing", text: "From the eighteenth month, with annual administration in place, we review with you whether refinancing or an increase is appropriate. Whether, and on what terms, is for the lender to decide." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 9  DIE LÄNDER (Leitfaden 2.8 und 5.12) — was auf welcher Länderseite stehen darf
// ═══════════════════════════════════════════════════════════════════════════
export interface LaenderRegel {
  /** Selbstabschluss oder persönlicher Weg. */
  weg: "selbstabschluss" | "persoenlich";
  /** Der eine Haupt-Knopf der Seite. */
  hauptHandlung: HandlungNr;
  /** Die Schritte der Erzählung, die sichtbar stehen. */
  schritte: readonly SchrittNr[];
  /** Konto und Karte in Überschrift, Trefferzeile, Karte „Ein Mandat“ und Vorschaubild erlaubt? */
  kontoKarteImBlickfang: boolean;
  /** Konto und Karte im Fließtext: der Satz S2, nur der eine Schweiz-Satz oder gar nichts. */
  kontoKarteImFliesstext: "S2" | "KONTO-CH" | "nichts";
  /** Finanzierung auf der Seite: mit S5 und S1, nur der Satz S17, oder erst im Gespräch. */
  finanzierung: "S5 und S1" | "nur S17" | "im Gespräch";
  /** Darf das Wort „Unternehmensberatung“ / “business consultancy” stehen? */
  unternehmensberatung: boolean;
  /** Der Rollen-Satz im Fuß. */
  rollenSatz: "S8" | "S8-AT";
  /** Darf der Geld-zurück-Satz stehen (nur bei der Finanzierung)? */
  geldZurueck: boolean;
  /** Das Honorar: die drei Zeilen aus S12 — oder ohne Betrag (WEITERE_SAETZE["HONORAR-AT"]). */
  honorar: "S12" | "HONORAR-AT";
}
// „ANDERES“ (außerhalb von Deutschland, Österreich, Schweiz) regelt der Leitfaden nur für Weg, Knopf und Finanzierung
// (persönlich · Gespräch vereinbaren · im Gespräch); für alles Übrige gilt dort die allgemeine Fassung.
export const LAENDER_REGELN: Readonly<Record<SatzLand, LaenderRegel>> = {
  DE: { weg: "selbstabschluss", hauptHandlung: "angebot", schritte: [1, 2, 3, 4, 5, 6], kontoKarteImBlickfang: true, kontoKarteImFliesstext: "S2", finanzierung: "S5 und S1", unternehmensberatung: true, rollenSatz: "S8", geldZurueck: true, honorar: "S12" },
  CH: { weg: "selbstabschluss", hauptHandlung: "angebot", schritte: [1, 2, 5, 6], kontoKarteImBlickfang: false, kontoKarteImFliesstext: "KONTO-CH", finanzierung: "S5 und S1", unternehmensberatung: true, rollenSatz: "S8", geldZurueck: true, honorar: "S12" },
  AT: { weg: "persoenlich", hauptHandlung: "gespraech", schritte: [1, 2], kontoKarteImBlickfang: false, kontoKarteImFliesstext: "nichts", finanzierung: "nur S17", unternehmensberatung: false, rollenSatz: "S8-AT", geldZurueck: false, honorar: "HONORAR-AT" },
  ANDERES: { weg: "persoenlich", hauptHandlung: "gespraech", schritte: [1, 2, 3, 4, 5, 6], kontoKarteImBlickfang: true, kontoKarteImFliesstext: "S2", finanzierung: "im Gespräch", unternehmensberatung: true, rollenSatz: "S8", geldZurueck: true, honorar: "S12" },
};

/** Die Adressen der beiden Länderseiten mit eigener Fassung (deutsch und englisch). Die Wortwand gleicht sie mit dem Register ab. */
export const LAENDER_SEITEN: Readonly<Record<"AT" | "CH", readonly string[]>> = {
  AT: ["/business/aus-oesterreich", "/en/business/from-austria"],
  CH: ["/business/aus-der-schweiz", "/en/business/from-switzerland"],
};

/** Welche Sätze auf der Österreich-Seite stehen dürfen. Alle anderen nennen Konto, Karte, Finanzierung oder einen Betrag. */
const SAETZE_AT: readonly SatzNr[] = ["S3", "S8-AT", "S10", "S13", "S14", "S15", "S17"];
/** Welche Sätze auf der Schweiz-Seite NICHT stehen: Konto und Karte gibt es dort nur als den einen Satz KONTO-CH. */
const SAETZE_NICHT_CH: readonly SatzNr[] = ["S4", "S11"];

// ═══════════════════════════════════════════════════════════════════════════
// 10  VERTRAUENS-BAND (Leitfaden 6.1), PRESSE-ZEILE (6.3), EINZELNE BELEGE (6.2), GELD ZURÜCK (5.7)
// ═══════════════════════════════════════════════════════════════════════════
export interface PresseZeile { de: string; en: string; adresse: string }
/** Die eine Presse-Zeile. Sichtbar steht nur dieser Wortlaut, als Link — kein Logo, kein „bekannt aus“, je Seite höchstens einmal. */
export const PRESSE_ZEILE: Readonly<PresseZeile> = {
  de: FESTE_SAETZE.S14.de,
  en: FESTE_SAETZE.S14.en,
  adresse: "https://www.diepresse.com/41410319",
};

export interface BandZeile {
  /** Welche der vier Tatsachen. */
  art: "register" | "presse" | "vertrag" | "zahlung";
  /** Der sichtbare Wortlaut der Zeile. */
  text: string;
  /** Der Text des Verweises daneben — null heißt: Die ganze Zeile ist der Verweis. */
  verweisText: string | null;
  /** Wohin der Verweis führt: eine Adresse im Netz oder ein Pfad der Seite. */
  adresse: string;
  /** true = fremde Seite (neues Fenster, rel="noopener"). */
  extern: boolean;
}
/** Der Eintrag im britischen Register — aus der Registernummer gebaut, nie getippt. */
const REGISTER_ADRESSE = `https://find-and-update.company-information.service.gov.uk/company/${REGISTER_NR}`;

const band = (s: SatzSprache): readonly BandZeile[] => (s === "en"
  ? [
    { art: "register", text: `${FIRMA}, London · registered in England and Wales, company number ${REGISTER_NR}`, verweisText: "entry in the UK register", adresse: REGISTER_ADRESSE, extern: true },
    { art: "presse", text: PRESSE_ZEILE.en, verweisText: null, adresse: PRESSE_ZEILE.adresse, extern: true },
    // Die Seite „Agreement at a glance“ beschreibt den Aufbau; der Vertrag selbst ist deutsch.
    { art: "vertrag", text: "You read your complete agreement before you sign", verweisText: "Agreement at a glance", adresse: "/en/business/mustervertrag", extern: false },
    { art: "zahlung", text: `Payment by invoice to ${FIRMA} only`, verweisText: null, adresse: "/en/is-fiaon-legit", extern: false },
  ]
  : [
    { art: "register", text: `${FIRMA}, London · eingetragen im Companies House (England und Wales), Nr. ${REGISTER_NR}`, verweisText: "Eintrag im britischen Register", adresse: REGISTER_ADRESSE, extern: true },
    { art: "presse", text: PRESSE_ZEILE.de, verweisText: null, adresse: PRESSE_ZEILE.adresse, extern: true },
    { art: "vertrag", text: "Ihren vollständigen Vertrag lesen Sie, bevor Sie unterzeichnen", verweisText: "Vertrag im Überblick", adresse: "/business/mustervertrag", extern: false },
    { art: "zahlung", text: `Zahlung nur per Rechnung an die ${FIRMA}`, verweisText: null, adresse: "/ist-fiaon-serioes", extern: false },
  ]);

/** Das Vertrauens-Band: vier Tatsachen an Haarlinien, jede mit ihrem Verweis. Steht unter der Bühne und über dem Schlussband. */
export const VERTRAUENS_BAND: Readonly<Record<SatzSprache, readonly BandZeile[]>> = { de: band("de"), en: band("en") };
/**
 * Das Band der Österreich-Seite: dieselben vier Zeilen. Die Presse-Zeile steht dort NUR als Zeile mit Link — nie mit dem
 * Wortlaut oder dem Titel des Artikels. Eine eigene Fassung, damit sie eigens geändert werden kann.
 */
export const VERTRAUENS_BAND_AT: Readonly<Record<SatzSprache, readonly BandZeile[]>> = { de: band("de"), en: band("en") };

export type BelegNr = "zahlung" | "keinZugriff" | "eigentum" | "pruefungVorBeginn" | "honorarVorab" | "fuerWenNicht" | "rolle" | "daten";
/** Einzelne Belege und ihr Platz (Leitfaden 6.2) — kleine Beweise, die der Leser selbst nachprüfen kann. */
export const BELEGE: Readonly<Record<BelegNr, FesterSatz>> = {
  zahlung: {
    wofuer: "Honorarblatt · Vertrauensseite · Fragen",
    de: `Bezahlt wird nach der Unterschrift, per Rechnung an die ${FIRMA} — nie auf ein privates Konto.`,
    en: `Payment follows signature, by invoice to ${FIRMA} — never to a private account.`,
  },
  keinZugriff: {
    wofuer: "Schritt 3 · Bereich „Konten und Karten“",
    de: "FIAON erhält keine Vollmacht über Ihr Konto und nimmt nie Geld für Sie entgegen.",
    en: "FIAON holds no authority over your account and never receives money on your behalf.",
  },
  eigentum: {
    wofuer: "Schritt 1 · Bereich „Gründung“ · Fragen",
    de: "Ihre Gesellschaft gehört allein Ihnen. FIAON erwirbt keine Anteile.",
    en: "Your company belongs to you alone. FIAON acquires no interest in it.",
  },
  pruefungVorBeginn: {
    wofuer: "Schritt 5 · Vertrauensseite",
    de: "Vor Beginn gleichen wir jeden Klienten mit den Sanktionslisten der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs und der USA ab. Wir reichen keine Unterlagen ein, deren Angaben wir für unzutreffend halten.",
    en: "Before work begins, we screen every client against the sanctions lists of the European Union, the United Nations, the United Kingdom and the United States. We do not file documents containing information we believe to be incorrect.",
  },
  honorarVorab: {
    wofuer: "Bühne · Honorarrechner · Kostenseite",
    de: "Ihr Honorar steht als Betrag in Ihrem Angebot, bevor Sie unterzeichnen.",
    en: "Your fees are stated as amounts in your proposal before you sign.",
  },
  fuerWenNicht: {
    wofuer: "Fragen (weit oben) · Zielgruppen-Seiten",
    de: "Für Vorhaben ohne tatsächliche Geschäftstätigkeit ist das Mandat nicht geeignet. Sind Sie unsicher, vereinbaren Sie ein Gespräch — wir sagen es Ihnen auch dann, wenn die Antwort ein Nein ist.",
    en: "The engagement is not suited to ventures without genuine business activity. If you are unsure, arrange a call — we tell you so even where the answer is no.",
  },
  rolle: {
    wofuer: "Startseite vor den Fragen · Leistungsseiten",
    de: "Was FIAON ist — und was nicht: keine Bank, kein Kreditvermittler, kein Steuermodell, keine Kanzlei.",
    en: "What FIAON is — and is not: not a bank, does not broker loans, not a tax scheme, not a law firm.",
  },
  daten: {
    wofuer: "Vertrauensseite · Honorarrechner (Datenschutz-Zeile)",
    de: "Ihre Daten liegen verschlüsselt auf Servern in Frankfurt am Main.",
    en: "Your data is held encrypted on servers in Frankfurt am Main.",
  },
};

export interface GeldZurueckTexte {
  /** Der Name der Garantie — nur auf Startseite und im Honorarrechner (dazu Angebot und Vertrag). Auf Unterseiten gilt die Kurz-Form ohne den Namen. */
  name: string;
  /** Die Augenzeile über dem Abschnitt. */
  auge: string;
  /** Kurz-Form = S7. Für jede Seite, die von Finanzierung handelt. */
  kurz: string;
  /** Kurz-Form mit dem Namen — nur Startseite und Honorarblatt. */
  kurzMitNamen: string;
  /** Mittel-Form: drei Zeilen an Linien, darunter S1 — Startseite, Kostenseite, Finanzierungs-Seite. */
  mittel: readonly [string, string, string];
}
/** Geld zurück in den freigegebenen Formen (Leitfaden 5.7). Die Lang-Form liegt unter SAETZE_NICHT_FREIGEGEBEN. */
export const GELD_ZURUECK: Readonly<Record<SatzSprache, GeldZurueckTexte>> = {
  de: {
    name: "Geld-zurück-Garantie",
    auge: "Wenn die Finanzierung ausbleibt",
    kurz: FESTE_SAETZE.S7.de,
    kurzMitNamen: "Geld-zurück-Garantie: Kommt die Auszahlung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags.",
    mittel: [
      "Frist: acht Wochen ab Ihrem Auftrag.",
      "Erstattung: alles, was Sie an uns gezahlt haben — binnen vierzehn Tagen nach Fristende.",
      "Ihre Gesellschaft bleibt Ihnen; auf Ihren Wunsch lösen wir sie auf und tragen die Kosten dafür.",
    ],
  },
  en: {
    name: "Money-back commitment",
    auge: "If the financing does not arrive",
    kurz: FESTE_SAETZE.S7.en,
    kurzMitNamen: "Money-back commitment: if the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us. The conditions are set out in clause 4 of your agreement.",
    mittel: [
      "Period: eight weeks from your engagement.",
      "Refund: everything you have paid to us — within fourteen days of the end of that period.",
      "Your company remains yours; at your request we dissolve it and bear the cost.",
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// 11  LESE-FUNKTIONEN — so holen die Seiten ihre Sätze
// ═══════════════════════════════════════════════════════════════════════════
/** Die Nummer, unter der eine Seite einen festen Satz anfragt. „S5“ = die Fassung von Schritt 5, die heute gilt. */
export type SatzWahl = SatzNr | "S5";

const norm = (pfad: string): string => (String(pfad ?? "").split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();

/** Das Land einer Seite aus ihrer Adresse: „AT“ und „CH“ für die beiden Länderseiten, sonst „DE“. */
export function satzLand(pfad: string): SatzLand {
  const p = norm(pfad);
  if (LAENDER_SEITEN.AT.includes(p)) return "AT";
  if (LAENDER_SEITEN.CH.includes(p)) return "CH";
  return "DE";
}

/** Die Nummer, die für dieses Land wirklich gilt — oder null, wenn der Satz dort nicht stehen darf. */
function satzFuerLand(nr: SatzWahl, land: SatzLand): SatzNr | "S5-A" | "KONTO-CH" | null {
  if (land === "AT") {
    const at: SatzWahl = nr === "S8" ? "S8-AT" : nr;
    return at !== "S5" && SAETZE_AT.includes(at) ? at : null;
  }
  const wahl: SatzNr | "S5-A" = nr === "S5" ? (SAETZE_VORBEHALTE.V1 ? "S5-A" : "S5-B") : nr;
  if (land === "CH") {
    if (wahl === "S2") return "KONTO-CH";
    if (wahl !== "S5-A" && SAETZE_NICHT_CH.includes(wahl)) return null;
  }
  return wahl;
}

/** true = dieser Satz darf auf einer Seite für dieses Land stehen. Beispiel: satzGibtEs("S7", "AT") → false */
export function satzGibtEs(nr: SatzWahl, land: SatzLand = "DE"): boolean {
  return satzFuerLand(nr, land) !== null;
}

/**
 * Ein fester Satz in der Fassung, die heute gilt.
 *   satz("S1")                 → „Über die Finanzierung entscheidet das finanzierende Institut.“
 *   satz("S5", "en")           → S5-B englisch (solange V1 offen ist)
 *   satz("S8", "de", "AT")     → S8-AT
 *   satz("S2", "de", "CH")     → der eine Schweiz-Satz zu Konto und Karte
 *   satz("S7", "de", "AT")     → "" — auf der Österreich-Seite steht dieser Satz nicht
 * Eine leere Zeichenkette heißt immer: Für dieses Land gibt es den Satz nicht. Die Seite zeigt dann nichts.
 */
export function satz(nr: SatzWahl, sprache: SatzSprache = "de", land: SatzLand = "DE"): string {
  const wahl = satzFuerLand(nr, land);
  if (wahl === null) return "";
  if (wahl === "S5-A") return SAETZE_NICHT_FREIGEGEBEN["S5-A"][sprache];
  if (wahl === "KONTO-CH") return WEITERE_SAETZE["KONTO-CH"][sprache];
  return FESTE_SAETZE[wahl][sprache];
}

/** Ein weiterer fester Wortlaut. Beispiel: weitererSatz("DEFINITION", "en") */
export function weitererSatz(nr: WeitererSatzNr, sprache: SatzSprache = "de"): string {
  return WEITERE_SAETZE[nr][sprache];
}

/** Ein einzelner Beleg. Beispiel: beleg("keinZugriff", "de") */
export function beleg(nr: BelegNr, sprache: SatzSprache = "de"): string {
  return BELEGE[nr][sprache];
}

/** Der Name einer Handlung. Beispiel: handlung("angebot", "en") → “Request your proposal” */
export function handlung(nr: HandlungNr, sprache: SatzSprache = "de"): string {
  return HANDLUNGEN[nr][sprache];
}

/** Der eine Haupt-Knopf einer Seite für dieses Land. Beispiel: hauptHandlung("de", "AT") → „Gespräch vereinbaren“ */
export function hauptHandlung(sprache: SatzSprache = "de", land: SatzLand = "DE"): string {
  return HANDLUNGEN[LAENDER_REGELN[land].hauptHandlung][sprache];
}

export interface SchritteFuerLand<T> {
  /** Die Schritte, die auf einer Seite für dieses Land sichtbar stehen — mit ihrer festen Nummer. */
  schritte: readonly T[];
  /** Der eine Satz danach: Österreich S17, Schweiz der Satz zu Konto und Karte für den Fließtext. Sonst null. */
  zusatz: string | null;
}
const zusatzFuerLand = (sprache: SatzSprache, land: SatzLand): string | null =>
  land === "AT" ? FESTE_SAETZE.S17[sprache] : land === "CH" ? WEITERE_SAETZE["KONTO-CH"][sprache] : null;

/**
 * Die sechs Schritte für eine Seite.
 *   sechsSchritte("de")        → alle sechs
 *   sechsSchritte("de", "CH")  → Schritt 1, 2, 5, 6 und der Satz für den Fließtext
 *   sechsSchritte("en", "AT")  → Schritt 1 und 2, danach S17
 */
export function sechsSchritte(sprache: SatzSprache = "de", land: SatzLand = "DE"): SchritteFuerLand<Schritt> {
  const erlaubt = LAENDER_REGELN[land].schritte;
  return { schritte: SECHS_SCHRITTE[sprache].filter((x) => erlaubt.includes(x.nr)), zusatz: zusatzFuerLand(sprache, land) };
}

/**
 * Die Kurzfassung in vier Schritten für eine Seite. Österreich: nur Platz 1, danach S17. Schweiz: ohne Platz 2
 * (Konten und Karten stehen dort nie in einem Titel).
 */
export function vierSchritte(sprache: SatzSprache = "de", land: SatzLand = "DE"): SchritteFuerLand<KurzSchritt> {
  const erlaubt: readonly number[] = land === "AT" ? [1] : land === "CH" ? [1, 3, 4] : [1, 2, 3, 4];
  return { schritte: VIER_SCHRITTE[sprache].filter((x) => erlaubt.includes(x.nr)), zusatz: zusatzFuerLand(sprache, land) };
}

/**
 * Die Kurzwörter für Zeitstrahl und Handy (Leitfaden 2.5) — sechs oder vier Plätze.
 *   kurzwoerter("de")            → Gründung · Unterlagen · Konten · Karten · Finanzierung · Umschuldung
 *   kurzwoerter("de", "DE", 4)   → Gründung · Konten · Finanzierung · Umschuldung
 *   kurzwoerter("de", "AT")      → Gründung · Unterlagen
 */
export function kurzwoerter(sprache: SatzSprache = "de", land: SatzLand = "DE", plaetze: 6 | 4 = 6): readonly string[] {
  if (land === "AT" || plaetze === 6) return sechsSchritte(sprache, land).schritte.map((x) => x.kurz);
  return vierSchritte(sprache, land).schritte.map((x) => x.kurz);
}

/** Das Vertrauens-Band für eine Seite. Beispiel: vertrauensBand("de", "AT") */
export function vertrauensBand(sprache: SatzSprache = "de", land: SatzLand = "DE"): readonly BandZeile[] {
  return (land === "AT" ? VERTRAUENS_BAND_AT : VERTRAUENS_BAND)[sprache];
}

/** Die Presse-Zeile mit ihrem Link. Beispiel: presseZeile("en") → { text: “Quoted in Die Presse (2 November 2026)”, adresse: … } */
export function presseZeile(sprache: SatzSprache = "de"): { text: string; adresse: string } {
  return { text: PRESSE_ZEILE[sprache], adresse: PRESSE_ZEILE.adresse };
}

/** Geld zurück in den freigegebenen Formen — oder null, wenn das Land den Satz nicht führt (Österreich). */
export function geldZurueck(sprache: SatzSprache = "de", land: SatzLand = "DE"): GeldZurueckTexte | null {
  return LAENDER_REGELN[land].geldZurueck ? GELD_ZURUECK[sprache] : null;
}
