// ═══════════════════════════════════════════════════════════════════════════
// DIE ZWEITE SPRACHE — Englisch auf eigenen Adressen (02.09.2026)
//
// Justin: „JEDE Seite auf DE und EN, perfektes Englisch, der Umschalter
// perfekt platziert." Entschieden (02.09.2026): britisches Englisch, Pfade
// unter /en/ (keine Subdomain), hreflang-Paare mit x-default auf Deutsch.
//
// ── WARUM ADRESSEN, NICHT NUR EIN SCHALTER ─────────────────────────────────
// Ein Schalter im Browser (localStorage) ist für Google unsichtbar: Der
// Crawler sieht immer die deutsche Fassung. Erst eine eigene Adresse macht
// die englische Seite auffindbar — und erst hreflang sagt der Suche, dass
// beide dieselbe Seite in zwei Sprachen sind (sonst: Dublette).
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
// Die Sprachlogik (Pfad → Sprache, Schwesteradresse) und die englischen
// Texte von Navigation und Fußzeile. Die englischen Seitenköpfe und -körper
// stehen als `en`-Objekt am jeweiligen Eintrag in shared/fiaon-seo-seiten.ts
// — eine Tabelle, zwei Sprachen. Seitentexte je Seite: client/src/i18n/.
//
// ── DIE REGELN FÜR DAS ENGLISCH ────────────────────────────────────────────
// · Britisch, konsequent: colour, organisation, licence, instalment.
// · Kein Wort-für-Wort: dieselbe Struktur, dieselben Zahlen, neu geschrieben.
// · Fachbegriffe bleiben deutsch mit Erklärung beim ersten Vorkommen:
//   SCHUFA (Germany's main credit bureau), KSV1870 (Austria), CRIF/Intrum
//   (Switzerland), Datenkopie (free data copy under Art. 15 GDPR),
//   Basiskonto (basic payment account under the German Payment Accounts Act).
// · Wortverbote gelten auch hier: no „guaranteed", no „advice", no
//   „improve your score", no „affiliate". Card, account and limit are goals,
//   never promises — the bank decides.
// · Rechtsangaben mit deutscher Norm in Klammern: „two written reminders at
//   least four weeks apart (Section 31(2) BDSG)".
// · Rechtstexte (Impressum, Privacy, AGB, Widerruf) nur anwaltlich geprüft;
//   bis dahin gilt: „The German version is legally binding."
// ═══════════════════════════════════════════════════════════════════════════

export type Sprache = "de" | "en";

/** Steht ein Pfad unter /en? */
export function spracheVonPfad(pfad: string): Sprache {
  const p = (pfad.split("?")[0] || "/").toLowerCase();
  return p === "/en" || p.startsWith("/en/") ? "en" : "de";
}

/** Die englische Navigation — Ziel ist die englische Schwester, wo es sie gibt (siehe schwesterPfad). */
export const EN_NAV: [string, string][] = [
  ["/", "Home"],
  ["/was-ist-fiaon", "What is FIAON"],
  ["/privatkunden", "Personal"],
  ["/bonitaet", "Credit report"],
  ["/business", "Business"],
  ["/ratgeber", "Guides"],
  ["/werkzeuge", "Free tools"],
  ["/preise", "Pricing & plans"],
  ["/kontakt", "Contact & support"],
];

export const EN_FUSS: { titel: string; links: [string, string][] }[] = [
  { titel: "Knowledge", links: [
    ["/schufa-eintrag-loeschen", "Removing a SCHUFA entry"],
    ["/bonitaet-verbessern", "Strengthening your credit file"],
    ["/kredit-ohne-schufa", "Loans without SCHUFA — the truth"],
    ["/auskunfteien", "Credit bureaus compared"],
    ["/schufa-score-verstehen", "Understanding the SCHUFA score"],
    ["/bonitaetsauskunft-beantragen", "Requesting your credit report"],
    ["/inkasso-brief-erhalten", "Received a debt collection letter?"],
    ["/eintrag-verjaehrung", "Entries and limitation periods"],
    ["/girokonto-trotz-negativer-bonitaet", "A current account despite a poor record"],
    ["/ratenzahlung-und-bonitaet", "Instalments and creditworthiness"],
    ["/selbstauskunft-checkliste", "Self-disclosure checklist"],
    ["/schufa-neutral-anfragen", "SCHUFA-neutral enquiries"],
    ["/glossar-bonitaet", "Credit glossary A–Z"],
  ] },
  { titel: "Platform", links: [
    ["/", "Home"],
    ["/ratgeber", "Guides"],
    ["/werkzeuge", "Free tools"],
    ["/preise", "Pricing & plans"],
    ["/kreditkarte", "A credit card despite an entry"],
    ["/privatkunden", "Personal"],
    ["/business", "Business"],
    ["/oesterreich", "FIAON in Austria"],
    ["/schweiz", "FIAON in Switzerland"],
  ] },
  { titel: "Company", links: [
    ["/was-ist-fiaon", "About FIAON"],
    ["/fiaon-erfahrungen", "How FIAON works"],
    ["/sicherheit", "Privacy & security"],
    ["/team", "Team"],
    ["/karriere", "Careers"],
    ["/partner", "Partners"],
    ["/presse", "Press"],
    ["/investoren", "Investors"],
    ["/kontakt", "Contact & support"],
  ] },
  { titel: "Legal", links: [
    ["/impressum", "Legal notice (Impressum)"],
    ["/privacy", "Privacy policy"],
    ["/agb", "Terms and conditions"],
    ["/widerrufsbelehrung", "Right of withdrawal"],
  ] },
];

/** Kurze Oberflächentexte für Navigation und Fußzeile — beide Sprachen an einem Ort. */
export const UI: Record<Sprache, Record<string, string>> = {
  de: {
    kontoEroeffnen: "Konto eröffnen", login: "Login", meinBereich: "Mein Bereich",
    menueAuf: "Menü öffnen", menueZu: "Menü schließen",
    fuerKunden: "Für Kunden", unternehmen: "Unternehmen", ihrKonto: "Ihr Konto",
    kontoSatz: "Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie begleitet.",
    vertrauen: "SEPA-Lastschrift · EU-Hosting · Anwaltlich geprüft",
    sprache: "Sprache", zurAnderenSprache: "Read this page in English", spracheKurz: "EN",
    fussMission: "Das Betriebssystem für Bonität: Einsicht, Aktion, Zugang. Für Deutschland, Österreich und die Schweiz.",
    fussAbzeichen: "Hosted in EU / DSGVO Compliant",
    fussPlattform: "Plattform", fussUnternehmen: "Unternehmen", fussRecht: "Rechtliches",
    fussWissen: "Wissen von A bis Z", fussWissenZahl: "Ratgeber-Themen", fussEinklappen: "Einklappen", fussAlle: "Alle Themen zeigen",
    demoBand: "Sehen Sie den Kundenbereich, wie er gemeint ist – eine geführte Präsentation in fünfzehn Stationen.",
    demoFuer: "Für Investoren und Partner:", demoKnopf: "Präsentation ansehen",
  },
  en: {
    kontoEroeffnen: "Open an account", login: "Log in", meinBereich: "My account",
    menueAuf: "Open menu", menueZu: "Close menu",
    fuerKunden: "For customers", unternehmen: "Company", ihrKonto: "Your account",
    kontoSatz: "An account in two minutes. Your credit report within 24 hours. A person who stays with you.",
    vertrauen: "SEPA direct debit · Hosted in the EU · Reviewed by lawyers",
    sprache: "Language", zurAnderenSprache: "Diese Seite auf Deutsch lesen", spracheKurz: "DE",
    fussMission: "The operating system for creditworthiness: insight, action, access. For Germany, Austria and Switzerland.",
    fussAbzeichen: "Hosted in the EU / GDPR compliant",
    fussPlattform: "Platform", fussUnternehmen: "Company", fussRecht: "Legal",
    fussWissen: "Knowledge from A to Z", fussWissenZahl: "guide topics", fussEinklappen: "Collapse", fussAlle: "Show all topics",
    demoBand: "See the customer area as it is meant to be — a guided presentation in fifteen stations.",
    demoFuer: "For investors and partners:", demoKnopf: "View the presentation",
  },
};
