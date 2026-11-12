// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS EINE PRODUKT IN DEN SEITENTEXTEN (Register E-509, 12.11.2026)
//
// Bis E-509 sprachen die Unterseiten von vier Paketen (Global Struktur, Banking, Kapital, VIP) mit je eigenem Preis und
// Ziel-Kapitalrahmen. Seit E-509 gibt es EIN Produkt — die US-Gesellschaft mit aktiver Betreuung —, und der Kunde stellt
// sein Angebot im Konfigurator selbst zusammen (shared/fiaon-global-verkauf.ts). Diese Datei hält die Sätze, die viele
// Seiten wortgleich brauchen: den einen Preis, den Kapitalrahmen, wann was fällig wird. Kein Betrag ist hier getippt —
// jeder kommt aus shared/fiaon-global-verkauf-preise.ts (dieselbe Quelle wie Startseite, Konfigurator und Vertrag).
//
// WORTGRENZEN wie überall: kein „bis zu“, kein „garantiert“ (auf den Unterseiten auch nicht das Hauptwort — die Wortwand
// lässt es nur am Vertrag zu; hier heißt es „Geld zurück“), kein Zinssatz als Zahl, kein Bankname, keine Frist mit Ziffer.
// Recht und Steuern leisten Partner-Anwälte und US-Steuerberater aus dem Partnernetz; Anträge bei Bank und
// Kartenherausgeber stellt der Kunde selbst; über die Finanzierung entscheidet das finanzierende Institut.
// LEITPLANKE (12.11.2026): Kein Satz dieser Datei nennt die Bürgschaft — sie steht nur im persönlichen Angebot
// (Vertrag der Fassung C). scripts/pruef-verkaufsmotor.ts und scripts/pruef-global-seiten.ts halten die Wand.
// ═══════════════════════════════════════════════════════════════════════════
import { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur } from "../fiaon-global-verkauf-preise";

const de = {
  name: "US-Gesellschaft mit aktiver Betreuung",
  preis: verkaufEur(VERKAUF_PREISE.gruendungCents, "de"),
  fastTrack: verkaufEur(VERKAUF_PREISE.fastTrackCents, "de"),
  jahres: verkaufEur(VERKAUF_PREISE.jahresCents, "de"),
  rahmenAb: `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} US-Dollar`,
  rahmenEnde: `${VERKAUF_RAHMEN.maxUsd.toLocaleString("de-DE")} US-Dollar`,
};
const en = {
  name: "US company, actively managed",
  preis: verkaufEur(VERKAUF_PREISE.gruendungCents, "en"),
  fastTrack: verkaufEur(VERKAUF_PREISE.fastTrackCents, "en"),
  jahres: verkaufEur(VERKAUF_PREISE.jahresCents, "en"),
  rahmenAb: `US$${VERKAUF_RAHMEN.minUsd.toLocaleString("en-GB")}`,
  rahmenEnde: `US$${VERKAUF_RAHMEN.maxUsd.toLocaleString("en-GB")}`,
};

/** Der Preis in einem Absatz: was wann fällig wird — ein Wortlaut je Sprache für preisSatz und preisSatzKurz. */
const PREIS_SATZ = {
  de: `Mit Ihrem Auftrag zahlen Sie ${de.preis} für die Gründung und die aktive Betreuung im ersten Jahr. Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig; es richtet sich nach Ihrem Kapitalrahmen — Ihren Preis zeigt der Konfigurator. Ab dem zweiten Jahr können Sie die Jahresbetreuung für ${de.jahres} im Jahr buchen. Alle Beträge sind Endpreise.`,
  en: `With your order you pay ${en.preis} for formation and active management in the first year. The success fee falls due when your company is registered; it follows your capital range — the configurator shows your price. From the second year you can book annual care for ${en.jahres} a year. All amounts are final prices.`,
} as const;

export const EIN_PRODUKT = {
  de: {
    ...de,
    /** „50.000 bis 1.000.000 US-Dollar“ */
    rahmen: `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} bis ${de.rahmenEnde}`,
    /** „50.000 – 1.000.000 US-$“ — für Kennziffern. */
    rahmenKurz: `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} – ${VERKAUF_RAHMEN.maxUsd.toLocaleString("de-DE")} US-$`,
    /** Kurz, für Kennziffern und Merkblatt. */
    preisLabel: "mit Ihrem Auftrag — Gründung und aktive Betreuung im ersten Jahr",
    /** Der Preis in einem Absatz: was wann fällig wird. */
    preisSatz: PREIS_SATZ.de,
    /** Derselbe Absatz (bis 12.11.2026 der einzige ohne das Wort „Bürgschaft“; seit der Leitplanke lauten beide gleich). */
    preisSatzKurz: PREIS_SATZ.de,
    /** Nur das Erfolgshonorar. */
    erfolg: "Das Erfolgshonorar wird mit der Eintragung Ihrer Gesellschaft fällig; es richtet sich nach Ihrem Kapitalrahmen. Ihren Preis zeigt der Konfigurator.",
    /** Der Kapitalrahmen in einem Absatz. */
    rahmenSatz: `Ihren Kapitalrahmen wählen Sie selbst: ${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} bis ${de.rahmenEnde}. Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami, darunter läuft alles aus der Ferne. Über die Finanzierung entscheidet das finanzierende Institut.`,
    /** Geld zurück — ohne das Wort „Garantie“ (Wortwand der Unterseiten). */
    geldZurueck: "Kommt die Auszahlung Ihrer Finanzierung nicht binnen acht Wochen ab Ihrem Auftrag, erhalten Sie alles zurück, was Sie an uns gezahlt haben. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags; über die Finanzierung entscheidet das finanzierende Institut.",
    /** Wer was leistet — der Satz zu den Partnern ohne das Wort „Paket“. */
    partner: "Steuerberater, US-Steuerberater (CPA) und Anwälte aus unserem Partnernetz arbeiten auf Ihr Mandat — ihre Honorare für die Leistungen Ihres Auftrags trägt FIAON.",
    /**
     * Überschrift und Lead des Bausteins „Ein Mandat“ (wo früher eine Paketkarte oder alle vier standen). Der Lead wiederholt die
     * Karte darunter nicht (sie zählt Gründung, Steuernummern, US-Büro … selbst auf) — er sagt, was der eine Auftrag heißt.
     */
    karteH2: "Ein Mandat",
    karteLead: "Ein Auftrag, ein Ansprechpartner. Ihr Preis steht fest, bevor Sie unterschreiben.",
    /** Was im ersten Jahr enthalten ist (Vertrag, Ziffer 2 und 3) — für Listen. */
    enthalten: [
      "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Operating Agreement und Gründungsunterlagen",
      "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      "Assistenz Ihrer Gesellschaft im ersten Jahr: Post, Anrufe und Termine",
      "Die erste jährliche US-Meldung durch einen US-Steuerberater (CPA) aus unserem Partnernetz",
      "Pflichtenkalender und die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Privates US-Konto, private US-Karten, Geschäftskonto und Firmenkreditkarte: jeder Antrag vollständig vorbereitet",
      "Begleitung bis zur Finanzierung in Ihrem Kapitalrahmen",
    ],
  },
  en: {
    ...en,
    /** “US$50,000 to US$1,000,000” */
    rahmen: `${en.rahmenAb} to ${en.rahmenEnde}`,
    rahmenKurz: `${en.rahmenAb} – ${en.rahmenEnde}`,
    preisLabel: "with your order — formation and active management in the first year",
    preisSatz: PREIS_SATZ.en,
    preisSatzKurz: PREIS_SATZ.en,
    erfolg: "The success fee falls due when your company is registered; it follows your capital range. The configurator shows your price.",
    rahmenSatz: `You choose your capital range yourself: ${en.rahmenAb} to ${en.rahmenEnde}. From US$1 million we work with you in person in Miami; below that, everything runs remotely. The financing institution decides on the financing.`,
    geldZurueck: "If the payout of your financing does not arrive within eight weeks of your order, you receive back everything you have paid to us. The conditions are in clause 4 of your agreement; the financing institution decides on the financing.",
    partner: "Tax advisers, US accountants (CPAs) and lawyers from our partner network act under your engagement — FIAON pays their fees for the services in your order.",
    karteH2: "One mandate",
    karteLead: "One order, one contact. Your price is set before you sign.",
    enthalten: [
      "Filing with the state, state fee included",
      "Operating agreement and formation documents",
      "EIN and ITIN applications (the ITIN after our ITIN check)",
      "Registered agent, US business address and US phone number in the first year",
      "Assistance for your company in the first year: post, calls and appointments",
      "The first annual US filing by a US accountant (CPA) from our partner network",
      "Compliance calendar and the first annual report to the state, state fee included",
      "Personal US account, personal US cards, business account and company credit card: every application fully prepared",
      "Support through to financing within your capital range",
    ],
  },
} as const;
