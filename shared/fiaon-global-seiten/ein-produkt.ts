// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS EINE PRODUKT IN DEN SEITENTEXTEN (Register E-509, 12.11.2026)
//
// Bis E-509 sprachen die Unterseiten von vier Paketen (Global Struktur, Banking, Kapital, VIP) mit je eigenem Preis und
// Ziel-Kapitalrahmen. Seit E-509 gibt es EIN Produkt — die US-Gesellschaft mit aktiver Betreuung —, und der Klient fordert
// sein Angebot im Honorarrechner an (shared/fiaon-global-verkauf.ts). Diese Datei hält die Sätze, die viele Seiten
// wortgleich brauchen: das Honorar, den Kapitalrahmen, wann was fällig wird.
//
// E-510 (13.11.2026, Sprachleitfaden FIAON Global): Die Sätze selbst stehen jetzt an EINER Stelle —
// shared/fiaon-global-saetze.ts (S1 bis S17 und die weiteren festen Wortlaute). Diese Datei reicht sie unter den
// gewohnten Namen weiter; die Namen der Felder bleiben, weil viele Seiten sie einbinden:
//   preisSatz, preisSatzKurz  = S12 (Honorar in drei Zeilen: mit Ihrem Auftrag · mit der Eintragung · ab dem zweiten Jahr)
//   erfolg                    = die beiden Sätze aus S12 zum Erfolgshonorar (der Erklär-Satz S16 ist noch nicht freigegeben)
//   rahmenSatz                = die Spanne mit S9, dem Miami-Satz und S1 — die Spanne steht nie ohne diese Sätze
//   geldZurueck               = S7 (Kurz-Form ohne das Hauptwort — so darf sie auf jeder Seite stehen, die von Finanzierung handelt)
//   partner                   = der Rollen-Satz (Leitfaden 5.11)
// Kein Betrag ist hier getippt — jeder kommt aus shared/fiaon-global-verkauf-preise.ts (über SAETZE_BETRAEGE).
//
// WORTGRENZEN wie überall: kein „bis zu“, kein „garantiert“ (auf den Unterseiten auch nicht das Hauptwort — hier heißt es
// „erstatten wir“), kein Zinssatz als Zahl, kein Bankname, keine Frist mit Ziffer, „mindestens“ statt „ab“. Recht und
// Steuern liegen bei Partner-Anwälten und US-Steuerberatern (CPA) aus dem Partnernetz; Anträge bei Institut und
// Kartenherausgeber stellt der Klient selbst; über die Finanzierung entscheidet das finanzierende Institut.
// LEITPLANKE (12.11.2026): Kein Satz dieser Datei nennt die Bürgschaft — sie steht nur im persönlichen Angebot
// (Vertrag der Fassung C). scripts/pruef-verkaufsmotor.ts und scripts/pruef-global-seiten.ts halten die Wand.
// ÖSTERREICH UND SCHWEIZ (Leitfaden 5.12): Für die beiden Länderseiten gibt es eigene Listen (enthaltenAT, enthaltenCH) —
// Österreich ohne Konto, Karte und Finanzierung, die Schweiz ohne Konto und Karten.
// ═══════════════════════════════════════════════════════════════════════════
import { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur } from "../fiaon-global-verkauf-preise";
import { SAETZE_BETRAEGE, satz, weitererSatz } from "../fiaon-global-saetze";

/** Die Sätze eines Textes (getrennt an „Punkt Leerzeichen“) — um einen Teil eines festen Satzes zu zeigen, ohne ihn neu zu tippen. */
const saetzeVon = (text: string): string[] => text.split(/(?<=\.)\s+/);

const de = {
  name: "US-Gesellschaft mit aktiver Betreuung",
  preis: verkaufEur(VERKAUF_PREISE.gruendungCents, "de"),
  fastTrack: verkaufEur(VERKAUF_PREISE.fastTrackCents, "de"),
  jahres: verkaufEur(VERKAUF_PREISE.jahresCents, "de"),
  rahmenAb: `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} US-Dollar`,
  rahmenEnde: `${VERKAUF_RAHMEN.maxUsd.toLocaleString("de-DE")} US-Dollar`,
};
const en = {
  name: "US company, formed and administered",
  preis: verkaufEur(VERKAUF_PREISE.gruendungCents, "en"),
  fastTrack: verkaufEur(VERKAUF_PREISE.fastTrackCents, "en"),
  jahres: verkaufEur(VERKAUF_PREISE.jahresCents, "en"),
  rahmenAb: `US$${VERKAUF_RAHMEN.minUsd.toLocaleString("en-GB")}`,
  rahmenEnde: `US$${VERKAUF_RAHMEN.maxUsd.toLocaleString("en-GB")}`,
};

/** Das Honorar in einem Absatz: was wann fällig wird — S12, ein Wortlaut je Sprache für preisSatz und preisSatzKurz. */
const PREIS_SATZ = { de: satz("S12", "de"), en: satz("S12", "en") } as const;
/** Nur das Erfolgshonorar: der zweite und dritte Satz aus S12 (fällig mit der Eintragung · richtet sich nach dem Kapitalrahmen, mindestens …). */
const ERFOLG = { de: saetzeVon(PREIS_SATZ.de).slice(1, 3).join(" "), en: saetzeVon(PREIS_SATZ.en).slice(1, 3).join(" ") } as const;

export const EIN_PRODUKT = {
  de: {
    ...de,
    /** „50.000 bis 1.000.000 US-Dollar“ — steht nie ohne rahmenSatz (S9 und der Miami-Satz) im selben Blick. */
    rahmen: SAETZE_BETRAEGE.de.rahmen,
    /** „50.000 – 1.000.000 US-$“ — für Kennziffern. */
    rahmenKurz: `${VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE")} – ${VERKAUF_RAHMEN.maxUsd.toLocaleString("de-DE")} US-$`,
    /** Kurz, für Kennziffern und Merkblatt. */
    preisLabel: "mit Ihrem Auftrag — Gründung und aktive Betreuung im ersten Jahr",
    /** Das Honorar in einem Absatz: was wann fällig wird (S12). */
    preisSatz: PREIS_SATZ.de,
    /** Derselbe Absatz (bis 12.11.2026 der einzige ohne das Wort „Bürgschaft“; seit der Leitplanke lauten beide gleich). */
    preisSatzKurz: PREIS_SATZ.de,
    /** Nur das Erfolgshonorar. */
    erfolg: ERFOLG.de,
    /** Der Kapitalrahmen in einem Absatz: die Spanne, S9, der Miami-Satz, S1. */
    rahmenSatz: `Ihr Kapitalrahmen: ${SAETZE_BETRAEGE.de.rahmen}. ${satz("S9", "de")} ${weitererSatz("MIAMI", "de")} ${satz("S1", "de")}`,
    /** Geld zurück — die Kurz-Form S7, ohne das Hauptwort (Wortwand der Unterseiten). Nur bei der Finanzierung. */
    geldZurueck: satz("S7", "de"),
    /** Wer Recht und Steuern verantwortet und wer die Honorare trägt — der Rollen-Satz. */
    partner: weitererSatz("ROLLEN", "de"),
    /**
     * Überschrift und Einleitung des Bausteins „Ein Mandat“ (wo früher eine Paketkarte oder alle vier standen). Die Einleitung
     * wiederholt die Karte darunter nicht (sie zählt Gründung, Steuernummern, US-Büro … selbst auf) — sie sagt, was das eine Mandat heißt.
     */
    karteH2: "Ein Mandat",
    karteLead: "Ein Mandat, ein Vertrag, ein Ansprechpartner. Ihr Honorar steht fest, bevor Sie unterzeichnen.",
    /** Was im ersten Jahr enthalten ist (Vertrag, Ziffer 2 und 3) — für Listen. Der letzte Punkt nennt, wer entscheidet. */
    enthalten: [
      "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Operating Agreement und Gründungsunterlagen",
      "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      weitererSatz("UEBERGANG-ASSISTENZ", "de"),
      "Die erste jährliche US-Meldung Ihrer Gesellschaft",
      "Pflichtenkalender und die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Privates US-Konto, Geschäftskonto und, auf Wunsch, Kreditkarten: jeder Antrag vollständig vorbereitet",
      "Vollständig vorbereitete Finanzierungsanträge und unsere Begleitung bis zur Entscheidung des finanzierenden Instituts",
      "Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut",
    ],
    /** Dieselbe Liste für die Schweiz-Seite: ohne Konto und Karten (dort steht im Fließtext nur der eine Satz KONTO-CH). */
    enthaltenCH: [
      "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Operating Agreement und Gründungsunterlagen",
      "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      weitererSatz("UEBERGANG-ASSISTENZ", "de"),
      "Die erste jährliche US-Meldung Ihrer Gesellschaft",
      "Pflichtenkalender und die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Vollständig vorbereitete Finanzierungsanträge und unsere Begleitung bis zur Entscheidung des finanzierenden Instituts",
      satz("S1", "de"),
    ],
    /** Dieselbe Liste für die Österreich-Seite: nur Gründung, Unterlagen und Pflichten — danach folgt S17. */
    enthaltenAT: [
      "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Operating Agreement und Gründungsunterlagen",
      "Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check)",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      weitererSatz("UEBERGANG-ASSISTENZ", "de"),
      "Die erste jährliche US-Meldung Ihrer Gesellschaft",
      "Pflichtenkalender und die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
      satz("S3", "de", "AT"),
    ],
  },
  en: {
    ...en,
    /** “US$50,000 to US$1,000,000” — never without rahmenSatz (S9 and the Miami sentence) in the same view. */
    rahmen: SAETZE_BETRAEGE.en.rahmen,
    rahmenKurz: `${en.rahmenAb} – ${en.rahmenEnde}`,
    preisLabel: "on engagement — formation and administration in the first year",
    preisSatz: PREIS_SATZ.en,
    preisSatzKurz: PREIS_SATZ.en,
    erfolg: ERFOLG.en,
    rahmenSatz: `Your funding target: ${SAETZE_BETRAEGE.en.rahmen}. ${satz("S9", "en")} ${weitererSatz("MIAMI", "en")} ${satz("S1", "en")}`,
    geldZurueck: satz("S7", "en"),
    partner: weitererSatz("ROLLEN", "en"),
    karteH2: "One engagement",
    karteLead: "One engagement, one agreement, one dedicated contact. Your fees are set out in full before you sign.",
    enthalten: [
      "Filing with the state, state fee included",
      "Operating agreement and formation documents",
      "EIN and ITIN applications (the ITIN following our ITIN check)",
      "Registered agent, US business address and US telephone number in the first year",
      weitererSatz("UEBERGANG-ASSISTENZ", "en"),
      "The first annual US filing for your company",
      "Compliance calendar and the first annual report to the state, state fee included",
      "Personal US account, business account and, on request, credit cards: every application prepared in full",
      "Fully prepared financing applications and our support through to the lender’s decision",
      "Decisions on accounts, cards and financing rest with the institution concerned",
    ],
    enthaltenCH: [
      "Filing with the state, state fee included",
      "Operating agreement and formation documents",
      "EIN and ITIN applications (the ITIN following our ITIN check)",
      "Registered agent, US business address and US telephone number in the first year",
      weitererSatz("UEBERGANG-ASSISTENZ", "en"),
      "The first annual US filing for your company",
      "Compliance calendar and the first annual report to the state, state fee included",
      "Fully prepared financing applications and our support through to the lender’s decision",
      satz("S1", "en"),
    ],
    enthaltenAT: [
      "Filing with the state, state fee included",
      "Operating agreement and formation documents",
      "EIN and ITIN applications (the ITIN following our ITIN check)",
      "Registered agent, US business address and US telephone number in the first year",
      weitererSatz("UEBERGANG-ASSISTENZ", "en"),
      "The first annual US filing for your company",
      "Compliance calendar and the first annual report to the state, state fee included",
      satz("S3", "en", "AT"),
    ],
  },
} as const;
