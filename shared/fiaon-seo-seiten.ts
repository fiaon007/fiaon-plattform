// ═══════════════════════════════════════════════════════════════════════════
// DER SEITENKOPF UND -KORPUS JEDER ÖFFENTLICHEN SEITE — eine Quelle (E-079)
// (02.09.2026)
//
// ── DER BEFUND, DER DIESE DATEI AUSGELÖST HAT ─────────────────────────────
// Onpage-Report vom 02.09.2026 (100 gecrawlte Seiten): Technik 72 %,
// Struktur 47 %, Inhalt 53 %. Die Ursache war in JEDEM Punkt dieselbe:
//   · 18 Seiten trugen den Titel und die Beschreibung der Startseite, weil
//     sie nach dem 25.08. gebaut wurden und in der Server-Tabelle fehlten.
//   · 45 Seiten hatten keine H1 und 44 „keinen auswertbaren Text" — weil das
//     ausgelieferte HTML nur <div id="root"></div> enthielt. Der Text kam
//     erst per JavaScript. Google rendert das (verzögert), der Report-Crawler
//     nicht, Bing kaum, KI-Suchen (Perplexity, ChatGPT-Suche) gar nicht.
//   · 90 Seiten hatten „sehr wenige interne Links" — aus demselben Grund:
//     Navigation und Fußzeile existierten nur nach dem Rendern.
//
// ── WAS DIESE DATEI IST ───────────────────────────────────────────────────
// Für jede öffentliche Seite: Titel (≤ 60 Zeichen), Beschreibung (≤ 155),
// H1, Einleitung, Abschnitte, Weiterlesen-Links, Brotkrumen, Stand.
// Der Server (server/lib/fiaon-seiten-seo.ts) rendert daraus den Kopf UND
// einen lesbaren Korpus in #root — React ersetzt ihn beim Start.
// Der Client (DunkleBuehne.Dunkel) setzt aus derselben Tabelle den
// Dokumenttitel, damit Server-HTML und gerendertes DOM denselben Titel
// tragen. Zwei Titel für eine Seite wären wieder derselbe Fehler.
//
// ── DIE DREI REGELN ───────────────────────────────────────────────────────
// 1. Der Korpus spiegelt die SICHTBARE Seite: H1, Einleitung und Abschnitte
//    stehen so auch auf der gerenderten Seite. Kein Text, den der Besucher
//    nicht zu sehen bekommt (Cloaking ist ein Abstrafungsgrund).
// 2. FAQ kommen NIE von Hand hierher, sondern aus shared/fiaon-seo-fragen.ts
//    (generiert aus den Seitendateien, scripts/seo-fragen-erzeugen.ts).
// 3. Wer eine Seite ändert, zieht diese Tabelle nach — wie beim Rundgang
//    (E-063). Die Prüfung: npx tsx scripts/seo-pruefen.ts
//
// Hausregeln: Sie-Form, keine „Beratung", keine „Garantie", kein
// Versprechen zu Karte oder Rahmen — „die Bank entscheidet".
// ═══════════════════════════════════════════════════════════════════════════
import { SEO_FRAGEN, SEO_GLOSSAR, type SeoFrage } from "./fiaon-seo-fragen";

export const SEO_BASIS = "https://fiaon.com";

export type SeoArt = "start" | "produkt" | "land" | "pfeiler" | "werkzeug" | "unternehmen" | "recht" | "intern";

export interface SeoAbschnitt {
  h2: string;
  text: string;
  /** Kurze Aufzählung unter dem Absatz — z. B. Schritte oder Hebel. */
  punkte?: string[];
}

export interface SeoSeite {
  pfad: string;
  art: SeoArt;
  /** <title>. Höchstens 60 Zeichen, das Suchwort vorn. */
  titel: string;
  /** Meta-Description. 120–155 Zeichen, ein Nutzen und ein Grund zu klicken. */
  beschreibung: string;
  /** Die sichtbare H1 der Seite (ohne Zeilenumbrüche). */
  h1: string;
  /** Der sichtbare Einleitungstext unter der H1. */
  lead: string;
  abschnitte?: SeoAbschnitt[];
  /** Pfade, auf die die Seite als „Weiterlesen" verweist. */
  weiter?: string[];
  /** Brotkrumen unterhalb der Startseite. */
  krumen?: { name: string; pfad: string }[];
  /** robots-Anweisung; leer = index,follow. */
  robots?: string;
  /** Canonical auf eine andere Seite (Dublette). */
  canonical?: string;
  /** Datum der letzten inhaltlichen Änderung (Sitemap lastmod). */
  stand: string;
  /** Sitemap-Priorität 0.1–1.0. */
  prio: number;
  /** Name des Werkzeugs → WebApplication-Markup. */
  werkzeug?: string;
  /** Bild für Open Graph, falls die Seite ein eigenes hat. */
  bild?: string;
  /** Die Seite hat einen eigenen Vorrenderer (Ratgeber) — Tabelle liefert nur Titel/Beschreibung für den Client. */
  eigenerVorrenderer?: boolean;
  // ── Zweisprachigkeit (02.09.2026, shared/fiaon-sprache.ts) ──────────────
  /** Sprache des Eintrags — fehlt = Deutsch. Englische Einträge entstehen unten aus `en`. */
  sprache?: "de" | "en";
  /** Die Schwesterseite in der anderen Sprache (Pfad) — Grundlage für hreflang und den Umschalter. */
  schwester?: string;
  /** Die englische Fassung dieser Seite: eigener Pfad unter /en, eigener Kopf und Korpus. Britisches Englisch. */
  en?: SeoEnglisch;
}

export interface SeoEnglisch {
  /** Adresse unter /en — z. B. /en/pricing. */
  pfad: string;
  titel: string;
  beschreibung: string;
  h1: string;
  lead: string;
  abschnitte?: SeoAbschnitt[];
  /** Weiterlesen-Ziele (deutsche Pfade — der Renderer nimmt die englische Schwester, wo es sie gibt). */
  weiter?: string[];
  krumen?: { name: string; pfad: string }[];
}

// ── Die Navigation und die Fußzeile, wie sie auf der gerenderten Seite stehen.
// Sie werden im Vorrendering mitgeliefert, damit jede Seite von jeder Seite
// aus erreichbar ist — auch für einen Crawler, der kein JavaScript ausführt.
export const SEO_NAV: [string, string][] = [
  ["/", "Startseite"],
  ["/was-ist-fiaon", "Was ist FIAON"],
  ["/privatkunden", "Privatkunden"],
  ["/bonitaet", "Bonitäts-Auszug"],
  ["/business", "Business"],
  ["/ratgeber", "Ratgeber"],
  ["/werkzeuge", "Kostenlose Werkzeuge"],
  ["/preise", "Preise & Pakete"],
  ["/kontakt", "Kontakt & Support"],
  ["/termin", "Startgespräch buchen"],
  ["/hilfe", "Hilfe-Center"],
];

export const SEO_FUSS: { titel: string; links: [string, string][] }[] = [
  { titel: "Wissen", links: [
    ["/schufa-eintrag-loeschen", "SCHUFA-Eintrag löschen"],
    ["/bonitaet-verbessern", "Bonität verbessern"],
    ["/kredit-ohne-schufa", "Kredit ohne SCHUFA — die Wahrheit"],
    ["/auskunfteien", "Auskunfteien im Vergleich"],
    ["/schufa-score-verstehen", "SCHUFA-Score verstehen"],
    ["/bonitaetsauskunft-beantragen", "Bonitätsauskunft beantragen"],
    ["/inkasso-brief-erhalten", "Inkasso-Brief erhalten?"],
    ["/eintrag-verjaehrung", "Eintrag & Verjährung"],
    ["/girokonto-trotz-negativer-bonitaet", "Girokonto trotz negativer Bonität"],
    ["/ratenzahlung-und-bonitaet", "Ratenzahlung & Bonität"],
    ["/selbstauskunft-checkliste", "Selbstauskunft-Checkliste"],
    ["/schufa-neutral-anfragen", "SCHUFA-neutral anfragen"],
    ["/glossar-bonitaet", "Bonitäts-Glossar A–Z"],
  ] },
  { titel: "Plattform", links: [
    ["/", "Startseite"],
    ["/ratgeber", "Ratgeber"],
    ["/werkzeuge", "Kostenlose Werkzeuge"],
    ["/preise", "Preise & Pakete"],
    ["/kreditkarte", "Kreditkarte trotz Eintrag"],
    ["/privatkunden", "Privatkunden"],
    ["/business", "Business"],
    ["/oesterreich", "FIAON in Österreich"],
    ["/schweiz", "FIAON in der Schweiz"],
  ] },
  { titel: "Unternehmen", links: [
    ["/ueber-uns", "Über FIAON"],
    ["/was-ist-fiaon", "Was ist FIAON"],
    ["/fiaon-erfahrungen", "So arbeitet FIAON"],
    ["/vergleich", "Anwalt, App, selbst – oder FIAON?"],
    ["/transparenz", "Transparenzbericht"],
    ["/status", "Status"],
    ["/sicherheit", "Datenschutz & Sicherheit"],
    ["/team", "Team"],
    ["/karriere", "Karriere"],
    ["/partner", "Partner"],
    ["/presse", "Presse"],
    ["/investoren", "Investoren"],
    ["/kontakt", "Kontakt & Support"],
    ["/termin", "Startgespräch buchen"],
    ["/hilfe", "Hilfe-Center"],
  ] },
  { titel: "Rechtliches", links: [
    ["/impressum", "Impressum"],
    ["/privacy", "Datenschutzerklärung"],
    ["/agb", "Allgemeine Geschäftsbedingungen (AGB)"],
    ["/widerrufsbelehrung", "Widerrufsbelehrung"],
  ] },
];

/** Die zwanzig Werkzeuge, wie sie auf /werkzeuge stehen. */
export const SEO_WERKZEUGE: { pfad: string; name: string; frage: string; satz: string }[] = [
  { pfad: "/werkzeuge/selbstauskunft", name: "Datenkopie anfordern", frage: "Was steht über mich in den Auskunfteien?", satz: "Erzeugt das fertige Schreiben nach Art. 15 DSGVO — für SCHUFA, KSV und CRIF, kostenlos statt Bezahl-Abo." },
  { pfad: "/werkzeuge/eintrag-pruefen", name: "Ist mein Eintrag angreifbar?", frage: "Kann dieser Eintrag gelöscht werden?", satz: "Fünf Fragen, eine ehrliche Einschätzung nach § 31 BDSG und der Rechtsprechung." },
  { pfad: "/werkzeuge/loeschfrist", name: "Löschfrist-Rechner", frage: "Wann ist mein Eintrag von selbst weg?", satz: "Taggenaues Löschdatum — mit 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz." },
  { pfad: "/werkzeuge/verjaehrung", name: "Verjährungs-Prüfer", frage: "Muss ich diese alte Forderung noch zahlen?", satz: "Prüft die regelmäßige Verjährung und was sie unterbricht." },
  { pfad: "/werkzeuge/inkassokosten", name: "Inkassokosten-Prüfer", frage: "Darf das Inkasso so viel verlangen?", satz: "Vergleicht die Forderung mit den gesetzlichen Obergrenzen." },
  { pfad: "/werkzeuge/kreditrechner", name: "Kreditrechner", frage: "Was kostet dieser Kredit wirklich?", satz: "Monatsrate, Gesamtkosten, Tilgungsplan — und die Rate beim Zwei-Drittel-Zins." },
  { pfad: "/werkzeuge/umschuldung", name: "Umschuldungsrechner", frage: "Weiterzahlen oder zusammenlegen?", satz: "Alte Kredite und Dispo gegen ein neues Angebot gerechnet — mit Vorfälligkeitsentschädigung." },
  { pfad: "/werkzeuge/schulden-check", name: "Schulden-Check", frage: "Wie ernst ist meine Lage?", satz: "Schuldenquote und freies Einkommen — mit ehrlicher Ampel und den nächsten Schritten." },
  { pfad: "/werkzeuge/spielraum", name: "Spielraum-Rechner", frage: "Wie viel Rate trage ich?", satz: "Haushaltsrechnung, wie eine Bank sie ansetzt." },
  { pfad: "/werkzeuge/karten-check", name: "Karten-Check", frage: "Welche Kreditkarte ist realistisch?", satz: "Debit, Prepaid oder echter Rahmen — was heute geht und was den nächsten Schritt öffnet." },
  // 02.09.2026 (E-080): zehn weitere.
  { pfad: "/werkzeuge/widerspruch", name: "Löschantrag & Widerspruch", frage: "Wie bekomme ich den Eintrag weg?", satz: "Grund wählen, Eckdaten eintragen — zwei fertige Schreiben an Auskunftei und Gläubiger (Art. 17 DSGVO, § 31 BDSG)." },
  { pfad: "/werkzeuge/mahnbescheid", name: "Mahnbescheid-Fristenrechner", frage: "Bis wann muss ich widersprechen?", satz: "Zustelldatum eingeben — der letzte Tag für Widerspruch oder Einspruch, taggenau mit Feiertagen." },
  { pfad: "/werkzeuge/inkasso-antwort", name: "Inkasso-Antwortbrief", frage: "Was antworte ich dem Inkasso?", satz: "Bestreiten, Nachweise nach § 13a RDG verlangen, Kosten zurückweisen oder Verjährung einwenden — als Brief." },
  { pfad: "/werkzeuge/mahngebuehren", name: "Mahngebühren-Prüfer", frage: "Darf die Mahnung so viel kosten?", satz: "Rechnet nach, was ein Gläubiger für Mahnungen verlangen darf — und formuliert die Zurückweisung." },
  { pfad: "/werkzeuge/ratenplan", name: "Ratenplan-Rechner", frage: "Welche Rate nimmt der Gläubiger an?", satz: "Aus Forderung und Spielraum die Rate, die hält — mit dem Angebotsschreiben inklusive Zins- und Meldeverzicht." },
  { pfad: "/werkzeuge/schuldenplan", name: "Schuldenfrei-Plan", frage: "In welcher Reihenfolge werde ich schuldenfrei?", satz: "Lawine oder Schneeball, Monat für Monat simuliert — Datum, Zinsen, Reihenfolge." },
  { pfad: "/werkzeuge/dispo-rechner", name: "Dispo-Rechner", frage: "Was kostet mein Dauer-Dispo?", satz: "Zinsen im Jahr, Ratenkredit zur Ablösung, Abbau in festen Raten — drei Wege nebeneinander." },
  { pfad: "/werkzeuge/pfaendungsrechner", name: "Pfändungsrechner 2026", frage: "Was bleibt mir bei einer Pfändung?", satz: "Freibetrag nach § 850c ZPO und P-Konto-Schutz — Werte ab 1. Juli 2026." },
  { pfad: "/werkzeuge/basiskonto", name: "Basiskonto-Helfer", frage: "Basiskonto abgelehnt oder keine Antwort?", satz: "Zehn-Tage-Frist, zulässige Ablehnungsgründe, Erinnerung an die Bank und der Weg zur BaFin." },
  { pfad: "/werkzeuge/kartenkosten", name: "Kartenkosten-Vergleich", frage: "Kaution, Prepaid oder Debit?", satz: "Drei Kartenwege auf drei Jahre gerechnet — inklusive der Kaution, die stillliegt." },
];

const PFEILER = "2026-09-02";

export const SEO_SEITEN: Record<string, SeoSeite> = {
  // ═════════════════════════════════════════════════════════════════════════
  // START UND PRODUKT
  // ═════════════════════════════════════════════════════════════════════════
  "/": {
    pfad: "/", art: "start", stand: PFEILER, prio: 1.0,
    titel: "Bonität verstehen, Einträge löschen, Karte — FIAON",
    beschreibung: "FIAON beschafft Ihre SCHUFA-, KSV- oder CRIF-Auskunft, erklärt jeden Eintrag, versendet geprüfte Schreiben und öffnet die Tür zu Konto und Kreditkarte.",
    h1: "Das Betriebssystem für Bonität.",
    lead: "FIAON zeigt Ihnen, was SCHUFA, KSV und CRIF über Sie wissen, repariert es mit Ihnen – und öffnet die Tür zu Konto, Karte und Finanzierung. Für Deutschland, Österreich und die Schweiz.",
    abschnitte: [
      { h2: "Ihre Bonität entscheidet über Konto, Karte und Kredit. Nur Sie selbst sehen sie nie.", text: "100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Allein in Deutschland gelten sechs Millionen als überschuldet. Die meisten wissen nicht, was dort steht – und niemand hilft ihnen, es zu ändern." },
      { h2: "Drei Schichten. Ein Weg.", text: "Score-Apps zeigen Ihnen eine Zahl. FIAON geht drei Schritte weiter: Wir zeigen, was dahintersteht, wir ändern es mit Ihnen – und wir öffnen danach die Tür. Im Kern arbeitet die FIAON-Analyse, gebaut für Bonität im DACH-Raum.", punkte: ["Einsicht: Bonitätsauskunft bei SCHUFA, KSV oder CRIF, jeder Eintrag in Menschensprache erklärt, Kontoauszug-Analyse mit Einnahmen, Fixkosten und Spielraum.", "Aktion: Löschanträge, Widersprüche und Ratenvereinbarungen aus anwaltlich geprüften Vorlagen – Sie geben frei, FIAON versendet und verfolgt die Antwort.", "Zugang: Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität. Über die Vergabe entscheidet immer die Bank; FIAON bereitet Sie darauf vor."] },
      { h2: "In drei Schritten zu Ihrer Bonität.", text: "Konto anlegen: E-Mail-Adresse, wenige Angaben, zwei Minuten. Auskunft erhalten: FIAON beantragt Ihre Auskunft, innerhalb von 24 Stunden sehen Sie, was gespeichert ist. Handeln und Zugang erhalten: Schreiben freigeben, Raten vereinbaren, Etappen abschließen – am Ende stehen Konto und Karte." },
      { h2: "Wählen Sie, wie weit Sie gehen. Nicht, ob.", text: "Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto mehr nimmt FIAON Ihnen ab – bis zu Konto, Karte und Finanzierung. Pakete ab 7,99 € im Monat, zwölf Raten, keine versteckten Posten." },
      { h2: "Geführt wie ein Finanzinstitut. Gebaut wie eine App.", text: "FIAON LTD mit Sitz in London, Kunden in Deutschland, Österreich und der Schweiz. Jedes Schreiben, das Sie über FIAON versenden, ist anwaltlich geprüft. Jede Zahlung läuft per SEPA-Lastschrift über einen verifizierten Kreditor. Ihre Daten liegen verschlüsselt auf Servern in der EU." },
      { h2: "Kostenlos, sofort, ohne Anmeldung.", text: "Zehn Werkzeuge, die Ihnen heute schon etwas bringen – keine Anfrage bei einer Auskunftei, keine Spur im Score, nichts wird gespeichert: Datenkopie anfordern, Eintrag prüfen, Löschfrist und Verjährung berechnen, Inkassokosten nachrechnen, Kredit- und Umschuldungsrechner, Schulden-Check, Spielraum und Karten-Check." },
    ],
    weiter: ["/was-ist-fiaon", "/privatkunden", "/preise", "/schufa-eintrag-loeschen", "/bonitaet-verbessern", "/werkzeuge", "/ratgeber", "/kreditkarte"],
    en: {
      pfad: "/en",
      titel: "FIAON in English: your credit file, explained and acted on",
      beschreibung: "FIAON obtains your SCHUFA, KSV or CRIF report, explains every entry, sends reviewed letters and prepares account and card. Germany, Austria, Switzerland.",
      h1: "Your credit file, explained — and acted on.",
      lead: "FIAON is a platform for people in Germany, Austria and Switzerland whose credit file stands between them and a bank account, a card or a flat. We obtain the report, explain it in plain language, send the letters and prepare the account. The bank decides — we make sure your file is ready.",
      abschnitte: [
        { h2: "Three layers: insight, action, access", text: "Insight: your credit report from SCHUFA (Germany's main credit bureau), KSV1870 (Austria) or CRIF and Intrum (Switzerland), obtained with your authorisation and explained entry by entry. Action: reviewed letters for entries that can be challenged — deletion requests under Art. 17 GDPR, objections, corrections. You approve, FIAON sends and follows up. Access: a current account, then a card once your file meets the partner's threshold." },
        { h2: "What it costs", text: "Monthly plans in twelve instalments, cancellable at any time to the end of the current month. Just the credit report on its own is available as a one-off purchase. No commission on limits, no fee per letter.", punkte: ["First instalment by bank transfer, then SEPA direct debit", "A named contact person in every plan", "The German application takes about two minutes"] },
        { h2: "Honest limits", text: "FIAON does not give legal advice in individual cases, does not guarantee deletions and does not decide on cards or limits — the bank does. Correct entries stay. What we can do is make sure that nothing incorrect, outdated or unlawfully reported remains in your file." },
      ],
      weiter: ["/preise"],
    },
  },
  "/was-ist-fiaon": {
    pfad: "/was-ist-fiaon", art: "unternehmen", stand: PFEILER, prio: 0.8,
    titel: "Was ist FIAON? Einsicht, Aktion, Zugang erklärt",
    beschreibung: "Von der ersten Auskunft bis zum bereinigten Eintrag: Wie FIAON arbeitet, was in jedem Schritt passiert und woran Sie erkennen, dass es vorangeht.",
    h1: "Das Betriebssystem für Bonität.",
    lead: "FIAON zeigt Ihnen, was Auskunfteien über Sie wissen, repariert es mit Ihnen – und öffnet Ihnen dann die Tür zu echten Finanzprodukten. Ein Satz, drei Schichten, ein Weg.",
    abschnitte: [
      { h2: "Bonität ist kein Urteil. Sie ist ein Zustand.", text: "Und Zustände kann man ändern. Heute entscheidet eine Auskunft, die Sie nie gesehen haben, über Konto, Karte, Wohnung und Kredit. FIAON dreht das um: Zuerst sehen Sie, was gespeichert ist. Dann ändern Sie es. Dann bekommen Sie Zugang." },
      { h2: "Ein Markt, der nur anzeigt.", text: "100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Score-Apps zeigen eine Zahl, dann nichts. Schuldnerberatungen sind wertvoll – und analog. Banken entscheiden nach der Akte, nicht nach dem Menschen." },
      { h2: "FIAON tut wirklich etwas.", text: "Das ist der Unterschied zu allem, was es bisher gab – und der Grund, warum FIAON ein Betriebssystem ist und keine App: Aus jeder Einsicht wird ein Schreiben, das hinausgeht. Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen – vorbereitet, geprüft, von Ihnen freigegeben." },
      { h2: "Niemand geht leer aus. Jeder hat ein nächstes Ziel.", text: "Die Logik ist einfach und ehrlich: Bonität gut – Karte sofort. Bonität schlecht – FIAON-Programm, Karte später. Über die Vergabe entscheidet immer die Bank; FIAON bereitet Sie darauf vor und begleitet Sie." },
      { h2: "Von der E-Mail-Adresse zur Karte.", text: "Konto anlegen, Startgespräch, Einsicht innerhalb von 24 Stunden, Aktion Etappe für Etappe mit festem Ansprechpartner, Zugang zu Konto, Karte und später Finanzierung – vorgestellt bei Partnerbanken, die eine dokumentierte Bonität sehen." },
      { h2: "Gesellschafter, die selbst im Betrieb stehen.", text: "FIAON wird nicht von einer Zentrale geführt. Die drei Gesellschafter sehen täglich Kunden – im Startgespräch, im Vertrieb, in der Akte. Sie-Form immer, keine Fantasiezahlen, jede Entscheidung ein Eintrag im Register." },
    ],
    weiter: ["/privatkunden", "/plattform-konzept", "/fiaon-erfahrungen", "/team", "/preise", "/sicherheit"],
    krumen: [{ name: "Was ist FIAON", pfad: "/was-ist-fiaon" }],
    en: {
      pfad: "/en/what-is-fiaon",
      titel: "What is FIAON? The operating system for creditworthiness",
      beschreibung: "FIAON shows you what SCHUFA, KSV or CRIF hold on you, repairs it with you and opens the door to an account, a card and finance. Three layers, one path.",
      h1: "The operating system for creditworthiness.",
      lead: "FIAON shows you what the credit bureaus hold on you, repairs it with you — and then opens the door to real financial products. One sentence, three layers, one path.",
      abschnitte: [
        { h2: "Creditworthiness is not a verdict — it is a state", text: "Today a report you have never seen decides on your account, your card, your flat and your loan. FIAON turns that around: first you see what is stored, then you change it, then the door opens.", punkte: ["Layer 1 · Insight: your report from SCHUFA, KSV or CRIF, explained in plain language", "Layer 2 · Action: deletion requests, corrections, objections and instalment agreements — prepared, reviewed, sent", "Layer 3 · Access: a current account, a credit card, later finance — the bank decides"] },
        { h2: "Why FIAON exists", text: "100 million people in Germany, Austria and Switzerland have an entry with a credit bureau; six million in Germany alone are considered over-indebted. Score apps show a number, debt counselling is analogue, banks decide by the file. FIAON occupies the layer in between." },
        { h2: "The path from e-mail address to card", text: "Create an account in two minutes, an onboarding call with a person, your report explained within 24 hours, letters approved and tracked stage by stage, then account and card prepared for partner banks. The bank always decides on the issue." },
      ],
      weiter: ["/preise", "/"],
      krumen: [{ name: "What is FIAON", pfad: "/en/what-is-fiaon" }],
    },
  },
  "/privatkunden": {
    pfad: "/privatkunden", art: "produkt", stand: PFEILER, prio: 0.9,
    titel: "Bonität verbessern & Kreditkarte für Privatkunden",
    beschreibung: "Einträge bereinigen, Girokonto eröffnen, Kreditkarte bis 25.000 €: FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben.",
    h1: "Die Kreditkarte, die am Ende Ihrer Bonität wartet.",
    lead: "Ein Eintrag ist kein Urteil. FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, lässt angreifbare löschen – und öffnet dann die Tür: Girokonto sofort, Kreditkarte, sobald Ihr Wert reicht.",
    abschnitte: [
      { h2: "Vier Etappen. Ein Ziel.", text: "Niemand bekommt eine Karte, weil er sie beantragt. Er bekommt sie, weil seine Akte sie trägt. Genau daran arbeitet FIAON – in dieser Reihenfolge.", punkte: ["Einsicht: Ihre Auskunft innerhalb von 24 Stunden, jeder Eintrag erklärt – berechtigt, bezahlt-aber-nicht-gelöscht, ohne Mahnung gemeldet.", "Aktion: Löschanträge, Widersprüche, Ratenvereinbarungen – anwaltlich geprüft, von Ihnen freigegeben, per Einschreiben versendet.", "Konto: Ein Girokonto für jeden Kunden, unabhängig von der Bonität. Ab hier läuft Ihr Zahlungsverhalten sauber.", "Karte: Aus Einträgen, Einkommen und Kontoverhalten berechnet FIAON Ihre Readiness. Reicht der Wert, ist der Antrag beim Kartenpartner vorbereitet – die Bank entscheidet."] },
      { h2: "Wählen Sie, wie weit Sie gehen. Nicht, ob.", text: "Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto näher rückt die Karte. FIAON Start ab 7,99 €, FIAON Pro 59,99 €, FIAON Ultra 79,99 €, FIAON High-End 99,99 € im Monat – zwölf Raten, danach fragen wir, ob Sie bleiben." },
      { h2: "So nah ist Ihre Karte.", text: "FIAON berechnet aus Einträgen, Einkommen und Kontoverhalten Ihre Karten-Readiness – und zeigt, welcher Schritt sie wie weit bewegt. Kein Versprechen, sondern ein Fortschrittsbalken, der steigt. Girokonto für jeden, Kreditkarte bis 5.000 € nach sauberen Monaten, bis 25.000 € Rahmen bei guter Bonität über unseren Kartenpartner." },
      { h2: "Geführt wie ein Finanzinstitut. Gebaut wie eine App.", text: "FIAON LTD mit Sitz in London, Kunden in Deutschland, Österreich und der Schweiz. Jedes Schreiben anwaltlich geprüft, jede Zahlung per SEPA, jede Akte verschlüsselt in der EU. Ein Mensch am Telefon – jeder Kunde beginnt mit einem Startgespräch. Ehrlich bis zum Nein: Berechtigte Einträge lassen sich nicht weglöschen." },
    ],
    weiter: ["/preise", "/kreditkarte", "/girokonto-trotz-negativer-bonitaet", "/schufa-eintrag-loeschen", "/werkzeuge/eintrag-pruefen", "/fiaon-erfahrungen"],
    krumen: [{ name: "Privatkunden", pfad: "/privatkunden" }],
    en: {
      pfad: "/en/personal",
      titel: "Personal: credit file, current account, credit card | FIAON",
      beschreibung: "Clean up entries, open an account, a credit card up to €25,000 — FIAON obtains your report, explains every entry, sends the letters and opens the door.",
      h1: "The credit card waiting at the end of your credit file.",
      lead: "An entry is not a verdict. FIAON obtains your report, explains every entry, has challengeable ones deleted — and then opens the door: a current account straight away, a credit card as soon as your file supports it.",
      abschnitte: [
        { h2: "Four stages, one goal", text: "Nobody gets a card because they apply for it; they get it because their file supports it.", punkte: ["Insight: your report within 24 hours, every entry explained", "Action: deletion requests, objections and instalment agreements — reviewed, approved by you, sent by registered post", "Account: a current account for every customer, regardless of the file", "Card: FIAON calculates your readiness and prepares the application with the card partner"] },
        { h2: "Four plans, one credit report", text: "FIAON Start, Pro, Ultra and High End in twelve monthly instalments, cancellable monthly; just the credit report as a one-off. Every plan starts with your report; the difference is how much FIAON takes on afterwards. The bank always decides on account, card and limit." },
        { h2: "Honest comparison", text: "A score app shows a number, a lawyer charges by the hour, FIAON obtains the report within 24 hours, sends the letters by registered post, prepares the account and the path to a card — with a person who knows your file." },
      ],
      weiter: ["/preise", "/was-ist-fiaon"],
      krumen: [{ name: "Personal", pfad: "/en/personal" }],
    },
  },
  "/business": {
    pfad: "/business", art: "produkt", stand: PFEILER, prio: 0.8,
    titel: "Firmenkreditkarte & Unternehmensbonität — FIAON Business",
    beschreibung: "Firmenkreditkarte mit Zahlungsziel und saubere Unternehmensbonität: FIAON beschafft die Auskunft, bereinigt Einträge, bereitet Kartenanträge vor.",
    h1: "Liquidität, die bleibt.",
    lead: "Firmenkreditkarte, Zahlungsziel und saubere Unternehmensbonität: FIAON beschafft die Auskunft, bereinigt Einträge und bereitet Kartenanträge bis 250.000 € Zielrahmen vor. Für Einzelunternehmer bis Holding.",
    abschnitte: [
      { h2: "Liquidität ist Zeit.", text: "Ein Unternehmen stirbt selten an fehlendem Umsatz – es stirbt an Zahlungen, die früher rausgehen als das Geld reinkommt. Die Firmenkarte dreht die Reihenfolge um: Sie zahlen per Karte und begleichen die Abrechnung erst Wochen später." },
      { h2: "Vier Stufen, ein Ziel.", text: "Jedes Paket enthält die Bonitätsauskunft für Unternehmen und Inhaber, einen festen Ansprechpartner und die Vorbereitung der Firmenkarte. Business Starter 49,99 €, Business Pro 99,99 €, Business Ultra 149,99 €, Business Enterprise 249,99 € im Monat. Der Zielrahmen ist das, worauf FIAON hinarbeitet – über den Rahmen entscheidet die Bank." },
      { h2: "Vom Einzelunternehmer bis zur Holding.", text: "Banken mögen keine kurzen Historien. FIAON baut die Grundlage: saubere Auskünfte bei Creditreform, CRIF, SCHUFA und KSV, Privat und Geschäft getrennt, Adressen und Register geprüft.", punkte: ["Anfrage in drei Minuten: Unternehmen, Rechtsform, Inhaber, Wunschrahmen.", "Startgespräch, 20 Minuten: Ausgaben, Struktur, Ziel.", "Auskünfte beschaffen: Unternehmens- und Inhaber-Auskunft mit Vollmacht, jeder Eintrag erklärt.", "Bereinigen und ordnen, dann der Kartenantrag beim Kartenpartner – Sie bestätigen, die Bank entscheidet.", "Rahmen wächst: pünktliche Abrechnung, laufende Begleitung, Aufstockung vorbereitet."] },
    ],
    weiter: ["/preise", "/privatkunden", "/kontakt", "/auskunfteien", "/sicherheit"],
    krumen: [{ name: "Business", pfad: "/business" }],
    en: {
      pfad: "/en/business",
      titel: "FIAON Business: company card, payment terms, clean file",
      beschreibung: "Company credit card, up to 58 days of payment terms, a clean company credit file: FIAON obtains the reports, cleans up entries, prepares the application.",
      h1: "Liquidity that stays.",
      lead: "Every invoice you pay by card instead of bank transfer stays in the company for up to 58 days. FIAON makes sure your credit file supports the card — and the limit grows.",
      abschnitte: [
        { h2: "Liquidity is time", text: "A company rarely dies of missing revenue — it dies of payments that go out before the money comes in. A company card with a monthly statement reverses the order: up to 58 days of payment terms, business separated from private, a limit that follows behaviour." },
        { h2: "Four tiers, one goal", text: "Business Starter, Pro, Ultra and Enterprise — each with credit reports for company and owners, a named contact person and preparation of the company card up to target limits from €5,000 to €250,000. The bank decides on the limit.", punkte: ["Payment-terms calculator: how much stays in the company", "Limit calculator: which limit and which plan fit", "From enquiry to card in six steps"] },
        { h2: "Honest limits", text: "FIAON does not guarantee a card or a limit. With young companies the owners' credit file counts; FIAON obtains both reports, separates private and business and starts with a limit that grows. Works in Germany, Austria and Switzerland." },
      ],
      weiter: ["/preise", "/privatkunden"],
      krumen: [{ name: "Business", pfad: "/en/business" }],
    },
  },
  "/bonitaet": {
    pfad: "/bonitaet", art: "produkt", stand: "2026-08-22", prio: 0.7,
    titel: "SCHUFA-Vollauskunft am selben Werktag — FIAON",
    beschreibung: "Ihre vollständige Auskunft mit Erklärung: welcher Eintrag woher stammt, wie lange er bleibt, welcher angreifbar ist. Durch FIAON beantragt, 74 € einmalig.",
    h1: "Deine Schufa-Vollauskunft. Express am selben Werktag.",
    lead: "FIAON beantragt die Auskunft für dich, liest sie und erklärt jeden Eintrag: woher er stammt, wie lange er bleibt und ob er angreifbar ist. Kein wochenlanges Warten, keine Formulare.",
    abschnitte: [
      { h2: "Warum eine geprüfte Auskunft?", text: "Wochenlanges Warten, Unwissenheit, die Geld kostet, und Daten ohne Lösung – das ist die kostenlose Datenkopie, wenn niemand sie erklärt. Die geprüfte FIAON-Auskunft beschafft die Daten bei SCHUFA, KSV oder CRIF und liefert die Einordnung dazu: erledigt, löschbar, berichtigbar, angreifbar." },
      { h2: "So läuft es ab", text: "Express-Formular ausfüllen, Vollmacht digital unterschreiben, FIAON beschafft die Auskunft, du siehst das Ergebnis erklärt im Kundenbereich – mit dem nächsten Schritt für jeden Eintrag." },
    ],
    weiter: ["/bonitaetsauskunft-beantragen", "/selbstauskunft-checkliste", "/werkzeuge/selbstauskunft", "/preise"],
    krumen: [{ name: "Bonitäts-Auszug", pfad: "/bonitaet" }],
  },
  "/preise": {
    pfad: "/preise", art: "produkt", stand: PFEILER, prio: 0.9,
    titel: "Preise & Pakete: FIAON ab 7,99 € im Monat",
    beschreibung: "Alle FIAON-Pakete auf einen Blick: Start, Pro, Ultra, High-End und Business – was enthalten ist, was es kostet, was Selbermachen kostet. Zwölf Raten.",
    h1: "Ein Preis, keine Überraschung.",
    lead: "Zwölf monatliche Raten, monatlich kündbar, danach fragen wir, ob Sie bleiben. Keine Provision auf Rahmen, keine Gebühr je Schreiben, kein Kleingedrucktes. Hier steht alles – inklusive dessen, was Selbermachen und Anwalt kosten.",
    abschnitte: [
      { h2: "Drei Fragen, ein Paket.", text: "Der Paketfinder ordnet ehrlich zu: Für wen, wie ist die Lage, wie schnell soll es gehen – und nennt das Paket mit Monatsrate und Gesamtpreis über zwölf Raten. Jedes Paket lässt sich im Startgespräch noch ändern." },
      { h2: "Vier Pakete, eine Auskunft.", text: "Jedes Paket beginnt mit Ihrer Bonitätsauskunft, erklärt in Menschensprache – inklusive des neuen SCHUFA-Scores je Kriterium.", punkte: ["FIAON Start – 7,99 € im Monat: Auskunft erklärt, Finanzauswertung, Schreiben zum Selbstversand, fester Ansprechpartner.", "FIAON Pro (Standard) – 59,99 € im Monat: FIAON versendet und verfolgt, Ratenvereinbarungen, Girokonto vorbereitet, Kreditkarte ab Schwelle.", "FIAON Ultra – 79,99 € im Monat: dazu Kreditkarte vorbereitet und Vorrang bei Fristen und Rückfragen.", "FIAON High-End – 99,99 € im Monat: alles aus Ultra plus direkte Durchwahl, alles aus einer Hand.", "Bonitätsauskunft einzeln – 74 € einmalig, anrechenbar auf ein Paket innerhalb von 30 Tagen."] },
      { h2: "Was kostet mein Fall?", text: "Einträge, Auskunfteien und Ziel eingeben – der Rechner nennt das passende Paket, den Gesamtpreis über zwölf Raten und was derselbe Fall in eigener Zeit oder beim Anwalt (Richtwert 190 € je Schreiben) kostet. Bei einem einzigen klaren Eintrag reichen die kostenlosen Werkzeuge oft aus." },
      { h2: "Der Zahlungsweg – Schritt für Schritt.", text: "Antrag und Vertrag, erste Rate per Überweisung (bankbestätigt, dann Startgespräch), ab Monat zwei SEPA-Lastschrift zum Monatsanfang, kündbar jederzeit zum Monatsende, formlos. Keine Vorkasse für Leistungen, die noch nicht erbracht sind." },
      { h2: "Für Unternehmen: vier Stufen.", text: "Business Starter 49,99 €, Business Pro 99,99 €, Business Ultra 149,99 €, Business Enterprise 249,99 € im Monat – Unternehmens- und Inhaberauskunft, Firmenkarte mit Zahlungsziel, wachsender Rahmen." },
      { h2: "Wann Sie FIAON nicht brauchen", text: "Ein einziger, klar erledigter Eintrag: der kostenlose Löschantrag-Generator. Nur wissen, was drinsteht: die kostenlose Datenkopie. FIAON lohnt sich bei mehreren Einträgen, mehreren Ländern, Fristen und Antworten – oder wenn Konto und Karte das Ziel sind." },
    ],
    weiter: ["/privatkunden", "/business", "/bonitaetsauskunft-beantragen", "/fiaon-erfahrungen", "/werkzeuge"],
    krumen: [{ name: "Preise & Pakete", pfad: "/preise" }],
    en: {
      pfad: "/en/pricing",
      titel: "Pricing and plans: twelve instalments, no surprises | FIAON",
      beschreibung: "What FIAON costs: monthly plans in twelve instalments, cancellable monthly, or the credit report on its own. Every service compared with doing it yourself.",
      h1: "One price, no surprises.",
      lead: "Twelve monthly instalments, then we ask whether you want to stay. No commission on limits, no fee per letter, no small print. Everything is here — including what it costs to do it yourself.",
      abschnitte: [
        { h2: "Four personal plans, one credit report", text: "Every plan starts with your credit report, explained in plain language. The difference is how much FIAON takes on afterwards: letters to send yourself or sent by FIAON, deadlines tracked, a current account and card prepared, priority on queries." },
        { h2: "What doing it yourself costs", text: "Everything FIAON does you can do yourself — the data copy under Art. 15 GDPR is free and the law is public. The question is what your time is worth and how often you will have to chase. Our calculator on this page compares registered letters, hours and a lawyer's fee with a twelve-month plan." },
        { h2: "How you pay", text: "First instalment by bank transfer (payment details with a QR code in your customer area), then SEPA direct debit through a verified creditor. No credit card needed. Prices include VAT. The bank decides on account, card and limit." },
      ],
      weiter: ["/"],
      krumen: [{ name: "Pricing", pfad: "/en/pricing" }],
    },
  },
  "/kreditkarte": {
    pfad: "/kreditkarte", art: "produkt", stand: PFEILER, prio: 0.9,
    titel: "Kreditkarte trotz SCHUFA-Eintrag: der ehrliche Weg",
    beschreibung: "Kreditkarte trotz Eintrag: Welche Karte heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Herausgeber sehen. Die Bank entscheidet.",
    h1: "Die Karte kommt über die Auskunft.",
    lead: "Kreditkarte trotz SCHUFA-Eintrag: Welche Karte heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Kartenherausgeber wirklich sehen. FIAON bereitet vor – die Bank entscheidet.",
    abschnitte: [
      { h2: "Welche Karte heute geht.", text: "Es gibt nicht „die“ Kreditkarte. Es gibt drei Wege – Debitkarte zum Konto, Prepaid-Karte mit Guthaben, echte Kreditkarte mit Rahmen – und für jede Lage einen, der offen ist." },
      { h2: "So wächst der Rahmen.", text: "Kein Versprechen – der typische Verlauf über zwölf Monate, wenn Auskunft, Konto und Abrechnung stimmen: erst das Konto auf Guthabenbasis, dann ein kleiner Rahmen, dann die Aufstockung, sobald die Zahlungshistorie sie trägt." },
      { h2: "Die fünf Dinge, die zählen.", text: "Kartenpartner lesen Ihre Auskunft in einer Minute. Negativmerkmale, offene Forderungen, Kreditanfragen der letzten zwölf Monate, Kontoverhalten und Einkommen sind die Stellen, an denen sie hängen bleiben – und genau daran arbeitet FIAON." },
      { h2: "Was wir nicht versprechen.", text: "Keine Karte ohne Bonitätsprüfung, keinen garantierten Rahmen, keine Löschung berechtigter Einträge. Wer das verspricht, verkauft Hoffnung. Der Weg über die bereinigte Auskunft ist langsamer – und der einzige, der trägt." },
    ],
    weiter: ["/girokonto-trotz-negativer-bonitaet", "/werkzeuge/karten-check", "/schufa-score-verstehen", "/schufa-eintrag-loeschen", "/preise", "/privatkunden"],
    krumen: [{ name: "Kreditkarte trotz Eintrag", pfad: "/kreditkarte" }],
    en: {
      pfad: "/en/credit-card",
      titel: "A credit card despite a SCHUFA entry: the route via report",
      beschreibung: "Which card is realistic today, how the limit grows over twelve months and what issuers really see. FIAON prepares — the bank decides on card and limit.",
      h1: "The card comes through your report.",
      lead: "Not through tricks, not through providers that promise “guaranteed” — but by making sure that what issuers read about you is correct. FIAON takes care of that. The bank decides on card and limit.",
      abschnitte: [
        { h2: "Three routes to a card", text: "A debit or prepaid card works today for open entries; a credit card with a small limit of €500 to €2,000 for settled entries and short histories; a full limit up to €25,000 with a good file and the headroom to match." },
        { h2: "How the limit grows over twelve months", text: "Month 0: report obtained and explained. Months 1–2: clean-up and current account. Months 2–4: first card, often with a small limit. Month 6: first review after statements settled on time. Month 12: the limit that income and headroom allow. A typical course, not a promise." },
        { h2: "What issuers see", text: "Negative entries, credit enquiries, account behaviour, address and identity, headroom. FIAON checks every entry for its legal requirements (Section 31 BDSG), makes no enquiry without your approval and prepares corrections under Art. 16 GDPR.", punkte: ["Free card check: five inputs, no enquiry, no trace", "Headroom calculator: income minus fixed costs", "No guarantee, no score trick, no flood of enquiries"] },
      ],
      weiter: ["/privatkunden", "/preise"],
      krumen: [{ name: "Credit card", pfad: "/en/credit-card" }],
    },
  },
  "/oesterreich": {
    pfad: "/oesterreich", art: "land", stand: PFEILER, prio: 0.8,
    titel: "Bonität in Österreich: KSV1870, CRIF, Ihre Rechte",
    beschreibung: "Bonität in Österreich: KSV1870 und CRIF erklärt, Selbstauskunft nach Art. 15 DSGVO, Löschfristen, Warnliste der Banken – und wie FIAON Einträge bereinigt.",
    h1: "Bonität in Österreich, Klartext.",
    lead: "KSV1870, CRIF, die Warnlisten der Banken: In Österreich entscheiden andere Stellen über Konto, Karte und Handyvertrag als in Deutschland – mit eigenen Regeln und eigenen Fristen. FIAON kennt sie.",
    abschnitte: [
      { h2: "Von der Auskunft zur Karte.", text: "Vier Etappen nach österreichischem Recht.", punkte: ["Vollmacht und Auskünfte: FIAON fordert Ihre Daten bei KSV1870, CRIF und – mit Ihrer Freigabe – bei den Banken an. Sie füllen kein Formular aus.", "Jeder Eintrag erklärt: Was steht da, wer hat es gemeldet, ist es berechtigt, wann ist es weg.", "Schreiben nach österreichischem Recht: Richtigstellung, Löschung, Widerspruch – mit den richtigen Paragraphen, per Einschreiben, mit Frist.", "Konto und Karte: Girokonto über Partnerbanken, die auch bei Einträgen eröffnen; Kreditkarte, sobald die Auskunft trägt. Die Bank entscheidet."] },
      { h2: "Kostenlos, sofort.", text: "Datenkopie-Generator für KSV1870 und CRIF, Eintrag-Prüfer und Löschfrist-Rechner – alles im Browser, ohne Anmeldung, nichts wird gespeichert." },
    ],
    weiter: ["/auskunfteien", "/werkzeuge/selbstauskunft", "/werkzeuge/eintrag-pruefen", "/preise", "/schweiz"],
    krumen: [{ name: "Österreich", pfad: "/oesterreich" }],
    en: {
      pfad: "/en/austria",
      titel: "FIAON in Austria: KSV1870, CRIF and your rights",
      beschreibung: "KSV1870 and CRIF explained, self-disclosure under Art. 15 GDPR, deletion deadlines, the banks' warning lists — and how FIAON prepares account and card.",
      h1: "Creditworthiness in Austria, in plain terms.",
      lead: "KSV1870, CRIF, the banks' warning lists: in Austria, different bodies decide on account, card and mobile contract than in Germany — with their own rules and their own deadlines. FIAON knows them.",
      abschnitte: [
        { h2: "Who stores what", text: "KSV1870, the country's largest credit bureau; CRIF, strong in telecommunications and mail order; the banks' joint warning lists. Free self-disclosure under Art. 15 GDPR from all of them within one month." },
        { h2: "Your rights and the path with FIAON", text: "Access, rectification, erasure and objection under the GDPR, Section 152 GewO for credit bureaus, complaint to the Data Protection Authority in Vienna. FIAON requests the reports with your authorisation, explains every entry, writes under Austrian law and prepares account and card with partner banks. The bank decides." },
      ],
      weiter: ["/auskunfteien", "/schweiz"],
      krumen: [{ name: "FIAON in Austria", pfad: "/en/austria" }],
    },
  },
  "/schweiz": {
    pfad: "/schweiz", art: "land", stand: PFEILER, prio: 0.8,
    titel: "Bonität in der Schweiz: Betreibungsregister, CRIF, Intrum",
    beschreibung: "Bonität in der Schweiz: Betreibungsregisterauszug, CRIF und Intrum erklärt, Auskunft nach Art. 25 DSG, Löschung unbegründeter Betreibungen (Art. 8a SchKG).",
    h1: "Bonität in der Schweiz, Klartext.",
    lead: "Betreibungsregister, CRIF, Intrum: In der Schweiz entscheidet oft ein Auszug vom Betreibungsamt über Wohnung, Handy und Karte – und fünf Jahre sind lang. FIAON kennt die Wege, ihn zu bereinigen.",
    abschnitte: [
      { h2: "Vom Registerauszug zur Karte.", text: "Vier Etappen nach Schweizer Recht.", punkte: ["Auszug und Auskünfte: FIAON beschafft den Betreibungsregisterauszug sowie die Auskünfte bei CRIF und Intrum – mit Vollmacht, ohne Behördengang.", "Jede Betreibung erklärt: Gläubiger, Betrag, Stand, Rechtsvorschlag, Frist. Welche lässt sich sperren, welche zurückziehen, welche bleibt.", "Gesuche und Schreiben: Nichtbekanntgabe nach Art. 8a SchKG, Rückzugserklärung vom Gläubiger, Berichtigung bei CRIF und Intrum – per Einschreiben, mit Frist.", "Konto und Karte: Konto bei einer Partnerbank, Kreditkarte, sobald der Auszug trägt. Die Bank entscheidet – FIAON bereitet vor."] },
      { h2: "Kostenlos, sofort.", text: "Datenkopie-Generator für CRIF und Intrum, Verjährungs-Prüfer und Löschfrist-Rechner – im Browser, ohne Anmeldung." },
    ],
    weiter: ["/auskunfteien", "/werkzeuge/selbstauskunft", "/werkzeuge/verjaehrung", "/preise", "/oesterreich"],
    krumen: [{ name: "Schweiz", pfad: "/schweiz" }],
    en: {
      pfad: "/en/switzerland",
      titel: "FIAON in Switzerland: enforcement register, CRIF, Intrum",
      beschreibung: "The debt enforcement register extract, CRIF and Intrum explained, access under Art. 25 DSG, blocking unjustified enforcements — and the path to a card.",
      h1: "Creditworthiness in Switzerland, in plain terms.",
      lead: "Debt enforcement register, CRIF, Intrum: in Switzerland an extract from the enforcement office often decides on flat, phone and card — and five years is a long time. FIAON knows the routes to clean it up.",
      abschnitte: [
        { h2: "Who stores what", text: "The debt enforcement register at your place of residence (every enforcement visible for five years, extract CHF 17), CRIF as the private bureau and Intrum with debt collection and its own credit data. Access under Art. 25 DSG within 30 days." },
        { h2: "Your rights and the path with FIAON", text: "Block an unjustified enforcement under Art. 8a SchKG, withdrawal declaration from the creditor after payment, rectification and erasure at CRIF and Intrum under Art. 32 DSG, complaint to the FDPIC. FIAON obtains extract and reports, explains every enforcement, drafts requests and letters and prepares account and card. The bank decides." },
      ],
      weiter: ["/auskunfteien", "/oesterreich"],
      krumen: [{ name: "FIAON in Switzerland", pfad: "/en/switzerland" }],
    },
  },
  "/sicherheit": {
    pfad: "/sicherheit", art: "unternehmen", stand: PFEILER, prio: 0.6,
    titel: "Datenschutz & Sicherheit bei FIAON: Wer darf was?",
    beschreibung: "Wie FIAON mit Ihren sensibelsten Daten umgeht: EU-Hosting, Verschlüsselung, Vollmacht vor jeder Auskunft, Freigabe vor jedem Schreiben, Löschung auf Wunsch",
    h1: "Das sensibelste Dokument über Sie.",
    lead: "Ihre Bonitätsauskunft sagt mehr über Sie als jedes Zeugnis. Deshalb ist Sicherheit bei FIAON keine Seite im Impressum, sondern der Bauplan: nichts ohne Ihre Vollmacht, nichts ohne Ihre Freigabe, nichts länger als nötig.",
    abschnitte: [
      { h2: "Unter der Haube.", text: "Server in Frankfurt, Verschlüsselung in Ruhe und Übertragung, Zugriff nur für den Ansprechpartner, der Ihre Akte führt. Uploads werden beim Hochladen geprüft, nicht Wochen später." },
      { h2: "Wer darf was mit Ihren Daten?", text: "Darf eine Bank Ihre SCHUFA-Daten ohne Ihr Wissen abfragen? Darf der Vermieter eine Bonitätsauskunft verlangen? Darf ein Inkassobüro melden? Der Datenschutz-Check beantwortet die Fragen, die uns Kunden immer wieder stellen – mit Rechtsgrundlage." },
      { h2: "Drei Wege, sofort.", text: "Auskunft über Ihre Daten bei FIAON (Art. 15), Berichtigung (Art. 16) über Ihren Ansprechpartner, Löschung (Art. 17) nach Vertragsende mit einem Klick unter Abo & Zahlungen oder per E-Mail – Bestätigung innerhalb von 30 Tagen." },
    ],
    weiter: ["/fiaon-erfahrungen", "/privacy", "/plattform-konzept", "/kontakt", "/bonitaetsauskunft-beantragen"],
    krumen: [{ name: "Datenschutz & Sicherheit", pfad: "/sicherheit" }],
    en: {
      pfad: "/en/security",
      titel: "Privacy & security: how FIAON handles your credit data",
      beschreibung: "EU hosting, encryption, authorisation, approval before every letter, deletion on request. Plus a privacy check: who may do what with your credit data?",
      h1: "The most sensitive document about you.",
      lead: "Your credit report says more about you than any reference. That is why security at FIAON is not a page in the legal notice but the blueprint: nothing without your authorisation, nothing without your approval, nothing longer than necessary.",
      abschnitte: [
        { h2: "Five principles", text: "Authorisation: no report without your signature. Approval: no letter without you. Purpose limitation: your data serves your file, never advertising. Access: every access logged. Deletion: complete on request after the contract ends. Payments run by SEPA through a verified creditor; no card data at FIAON." },
        { h2: "Under the bonnet", text: "Servers in the EU with a GDPR data processing agreement, HTTPS with TLS 1.3 and HSTS, encrypted database and backups, documents stored separately from the profile, role-based staff access with logging, no customer data in the AI assistant, retention until the end of the contract plus 90 days." },
        { h2: "Your rights", text: "Access under Art. 15, rectification under Art. 16, erasure under Art. 17 GDPR — in the customer area or by e-mail, confirmed within 30 days.", punkte: ["Privacy check: six questions on who may do what with your credit data", "No data used for AI training", "Data breach: notification within 72 hours (Art. 33, 34 GDPR)"] },
      ],
      weiter: ["/fiaon-erfahrungen", "/was-ist-fiaon"],
      krumen: [{ name: "Privacy & security", pfad: "/en/security" }],
    },
  },
  "/plattform-konzept": {
    pfad: "/plattform-konzept", art: "unternehmen", stand: PFEILER, prio: 0.6,
    titel: "So funktioniert FIAON: Plattform-Konzept Tag für Tag",
    beschreibung: "Die ganze Plattform erklärt: drei Schichten, der Weg Tag für Tag, Paketfinder, Kundenbereich, Startgespräch, DACH, Sicherheit – und was FIAON nicht ist.",
    h1: "Bonität, zu Ende gedacht.",
    lead: "Einsicht, Aktion, Zugang: FIAON beschafft Ihre Auskunft, bereinigt, was angreifbar ist, und öffnet Konto und Karte. Hier ist die ganze Plattform – Schicht für Schicht, Tag für Tag.",
    abschnitte: [
      { h2: "Eine Plattform, drei Schichten.", text: "Jede Schicht baut auf der vorigen auf. Die meisten Anbieter hören nach der ersten auf: Einsicht (Auskunft und Kontoauszug erklärt), Aktion (Schreiben, die hinausgehen), Zugang (Konto, Karte, Finanzierung)." },
      { h2: "Was passiert, Tag für Tag.", text: "Antrag in zwei Minuten, Startgespräch in 15 Minuten, Unterlagen mit dem Handy, Auskunft beschafft, Finanzauswertung, Schreiben gehen raus, Antworten und Löschungen, Girokonto, Kreditkarte – und nach zwölf Raten entscheiden Sie, ob Sie bleiben." },
      { h2: "Drei Länder, drei Systeme.", text: "FIAON kennt die Auskunfteien, Fristen und Rechte in Deutschland, Österreich und der Schweiz – und schreibt die Schreiben so, wie sie dort gelesen werden." },
      { h2: "Gebaut wie eine Bank, gesprochen wie ein Mensch.", text: "Nur mit Ihrer Unterschrift: FIAON beschafft die Auskunft ausschließlich mit Ihrer digitalen Vollmacht. Kein Schreiben ohne Sie: Jedes Schreiben sehen Sie vor dem Versand. Ihre Daten, Ihr Ende: Nach Vertragsende löschen wir auf Wunsch vollständig." },
      { h2: "Was FIAON nicht ist.", text: "Keine Bank, kein Kreditvermittler, keine Rechtsberatung, keine Schuldnerberatung. FIAON ist die Gegenprüfung Ihrer Auskunft und der Weg, der daraus folgt – mit der Bank am Ende, die entscheidet." },
    ],
    weiter: ["/was-ist-fiaon", "/privatkunden", "/preise", "/sicherheit", "/demo"],
    krumen: [{ name: "Plattform-Konzept", pfad: "/plattform-konzept" }],
  },

  // ═════════════════════════════════════════════════════════════════════════
  // UNTERNEHMEN
  // ═════════════════════════════════════════════════════════════════════════
  "/kontakt": {
    pfad: "/kontakt", art: "unternehmen", stand: PFEILER, prio: 0.6,
    titel: "Kontakt & Support: FIAON erreichen — Telefon, E-Mail",
    beschreibung: "Schreiben Sie uns Ihr Anliegen, fragen Sie den Assistenten oder lassen Sie sich zurückrufen. Telefon +41 44 244 93 01, support@fiaon.com – werktags.",
    h1: "Wir sind erreichbar.",
    lead: "Telefon, E-Mail, der FIAON-Assistent oder „Dringend melden“ direkt an die Geschäftsführung: Kunden erreichen ihre Ansprechpartnerin, Interessenten den Vertrieb. Kein Ticket, keine Warteschleife.",
    abschnitte: [
      { h2: "Fragen Sie, was Sie wollen.", text: "Pakete, Ablauf, Zahlung, Startgespräch, Ihre Rechte gegenüber SCHUFA, KSV und CRIF – der Assistent kennt die Plattform im Detail und antwortet sofort. Er sieht keine Kundendaten und ersetzt keine Rechtsberatung." },
      { h2: "Wenn es nicht warten kann.", text: "Eine Frist läuft morgen ab, eine Zahlung ist falsch zugeordnet, ein Brief der Gegenseite braucht sofort eine Antwort: Ihre Meldung landet direkt als Aufgabe mit Priorität „heute“ bei der Geschäftsführung – oder bei Ihrer Ansprechpartnerin." },
      { h2: "Ein Mensch, der die Akte kennt.", text: "Support: Telefon +41 44 244 93 01, E-Mail support@fiaon.com. Post an FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom." },
    ],
    weiter: ["/fiaon-erfahrungen", "/team", "/preise", "/privatkunden"],
    krumen: [{ name: "Kontakt", pfad: "/kontakt" }],
    en: {
      pfad: "/en/contact",
      titel: "Contact & support: phone, e-mail, assistant, urgent matters",
      beschreibung: "FIAON support: phone +41 44 244 93 01, e-mail support@fiaon.com. An assistant that knows the platform, and a direct line to the management.",
      h1: "We are reachable.",
      lead: "A person on the phone, an answer by e-mail, an assistant that knows the platform — and a direct line for everything that cannot wait.",
      abschnitte: [
        { h2: "Three ways to reach us", text: "Phone +41 44 244 93 01 on weekdays, in German and English. E-mail support@fiaon.com with a reply usually on the same working day. Urgent matters straight to the management with priority today.", punkte: ["Customers reach their contact person directly in the customer area under Help", "The assistant answers questions about plans, process and rights straight away — it sees no customer data", "Post: FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom"] },
      ],
      weiter: ["/termin", "/hilfe"],
      krumen: [{ name: "Contact & support", pfad: "/en/contact" }],
    },
  },
  "/team": {
    pfad: "/team", art: "unternehmen", stand: PFEILER, prio: 0.5,
    titel: "Das Team hinter FIAON: Gründer, Vertrieb, Onboarding",
    beschreibung: "Wer bei FIAON arbeitet: Justin Schwarzott (Gründer), Florentine Lombardi (Onboarding), Daniel Stripling (Vertrieb) und das Team am Telefon. Mit Namen.",
    h1: "Ein junges Legal- und FinTech auf dem Weg zum Unicorn.",
    lead: "FIAON ist ein Team aus Vertrieb, Onboarding und Forderungsmanagement – und drei Gesellschaftern, die selbst im Betrieb stehen. Wir bauen das Betriebssystem für Bonität in Deutschland, Österreich und der Schweiz.",
    abschnitte: [
      { h2: "Die Menschen, die Sie am Telefon erreichen.", text: "Vertrieb, Onboarding, Forderungsmanagement – wer bei FIAON anruft, spricht mit einem dieser Menschen. Viele von ihnen waren selbst Kunden." },
      { h2: "Ein Kunde, drei Hände.", text: "Jeder Kunde durchläuft dieselben drei Stationen – und an jeder steht jemand, der seinen Namen kennt: Daniels Team führt das erste Gespräch, Florentines Team übernimmt das Startgespräch und den Fahrplan, die Betreuung gibt Schreiben frei und hält Fristen. Justin liest jede Woche die Zahlen." },
      { h2: "Woran wir uns halten.", text: "Respekt zuerst – Kunden werden gesiezt, immer. Keine Fantasiezahlen – über Konto und Karte entscheidet die Bank. Jede Entscheidung ein Eintrag im Register. Wer geholfen bekam, hilft." },
    ],
    weiter: ["/was-ist-fiaon", "/karriere", "/investoren", "/kontakt", "/fiaon-erfahrungen"],
    krumen: [{ name: "Team", pfad: "/team" }],
    en: {
      pfad: "/en/team",
      titel: "The FIAON team: the people you reach on the phone",
      beschreibung: "Sales, onboarding and collections — anyone who calls FIAON speaks to one of these people. Three shareholders in daily operations, one investor in Zurich.",
      h1: "A young legal and fintech company on its way to becoming a unicorn.",
      lead: "FIAON is a team in sales, onboarding and collections — and three shareholders who work in the business themselves. We are building the operating system for creditworthiness in Germany, Austria and Switzerland.",
      abschnitte: [
        { h2: "The people you reach on the phone", text: "Sales explains the report and finds the right plan; onboarding leads the first fifteen minutes and the first weeks; collections keeps deadlines and negotiates with creditors. Many in the team were customers themselves and passed the Academy before their first call." },
        { h2: "Who is responsible for what", text: "Justin Schwarzott, founder and managing director: product, strategy, partners. Florentine Lombardi, shareholder: people and onboarding. Daniel Stripling, shareholder: head of sales. Investor and partner: Schwarzott Capital Partners AG, Zurich." },
        { h2: "What we hold to", text: "Courtesy always, no fantasy numbers, every decision on record, and a team that explains the path because it has walked it.", punkte: ["Get in touch: names, e-mail addresses and phone numbers on this page", "Careers: employed or freelance, remote in Germany, Austria and Switzerland"] },
      ],
      weiter: ["/ueber-uns", "/was-ist-fiaon"],
      krumen: [{ name: "Team", pfad: "/en/team" }],
    },
  },
  "/karriere": {
    pfad: "/karriere", art: "unternehmen", stand: PFEILER, prio: 0.5,
    titel: "Karriere bei FIAON: remote in DACH, fest oder frei",
    beschreibung: "Arbeiten bei FIAON: fest angestellt oder frei, remote in Deutschland, Österreich und der Schweiz. Sieben Bereiche, Academy vor dem ersten Kundengespräch.",
    h1: "Bauen Sie mit an dem, was 100 Millionen Menschen bisher fehlt.",
    lead: "FIAON ist ein junges, schnell wachsendes Start-up mit Sitz in London und Zürich und Kunden in Deutschland, Österreich und der Schweiz. Wir suchen immer Menschen, die Verantwortung wollen – fest angestellt oder frei, remote oder vor Ort.",
    abschnitte: [
      { h2: "Ein Start-up, das etwas repariert.", text: "Wir bauen das Betriebssystem für Bonität: Menschen sehen, was Auskunfteien über sie speichern, ändern es – und bekommen Zugang zu Konto, Karte und Finanzierung. Das ist Arbeit mit Sinn, in einem Tempo, das nur ein junges Unternehmen hat." },
      { h2: "Wo Sie einsteigen können.", text: "Vertrieb, Onboarding, Forderungsmanagement, Kundenbetreuung, Marketing, Technik, Partner – wählen Sie einen Bereich und sehen Sie, was Sie dort tun, was Sie mitbringen und in welcher Form wir zusammenarbeiten." },
      { h2: "Remote, aber nie allein.", text: "Erst lernen, dann Kunden: Niemand spricht mit Kunden, bevor er die Academy bestanden hat. Alles in einem Portal – Softphone, Kalender, Akte, Aufträge. Feste Ansprechpartner: Florentine führt Onboarding und Einschulung, Daniel den Vertrieb." },
      { h2: "In vier Schritten zu uns.", text: "Kein Lebenslauf-Upload, kein Anschreiben. Vier kurze Schritte, drei Minuten. Danach meldet sich Florentine persönlich – innerhalb von zwei Werktagen." },
    ],
    weiter: ["/team", "/was-ist-fiaon", "/fiaon-erfahrungen"],
    krumen: [{ name: "Karriere", pfad: "/karriere" }],
  },
  "/partner": {
    pfad: "/partner", art: "unternehmen", stand: PFEILER, prio: 0.6,
    titel: "Partner werden: Banken, Auskunfteien, Vermittler — FIAON",
    beschreibung: "Für Banken, Kartenherausgeber, Auskunfteien, Inkasso und Vermittler: FIAON bringt Kunden mit reparierter, dokumentierter Bonität – mit Einwilligung.",
    h1: "Kunden, deren Bonität repariert ist, sind die besten Kunden.",
    lead: "FIAON bringt Ihnen keinen Antrag, sondern eine Akte: bereinigte Einträge, dokumentierter Spielraum aus dem Kontoauszug, eine Zahlungshistorie aus zwölf Raten – und die Einwilligung des Kunden, Ihnen genau das zu zeigen.",
    abschnitte: [
      { h2: "Vier Partner. Eine Akte.", text: "Banken und Kartenherausgeber bekommen Neukunden mit Geschichte statt Antrag. Auskunfteien bekommen weniger Streit und saubere Daten. Inkasso bekommt Ratenvereinbarungen, die halten. Vermittler bekommen Provision je Abschluss." },
      { h2: "Was passiert, bevor ein Kunde bei Ihnen ankommt.", text: "Drei Etappen, jede dokumentiert: Einsicht (Auskunft und Kontoauszug), Aktion (anwaltlich geprüfte Schreiben, Ratenvereinbarungen), Zugang (Vorstellung mit Einwilligung und Zahlungshistorie)." },
      { h2: "In vier Schritten zum Pilot.", text: "Anfrage – Gespräch mit der Plattform auf dem Bildschirm – Pilot mit begrenzter Kundenzahl und Auswertung nach 90 Tagen – Anbindung per Schnittstelle oder strukturierter Übergabe. Ein Mensch antwortet innerhalb von zwei Werktagen." },
    ],
    weiter: ["/investoren", "/was-ist-fiaon", "/sicherheit", "/kontakt"],
    krumen: [{ name: "Partner", pfad: "/partner" }],
  },
  "/presse": {
    pfad: "/presse", art: "unternehmen", stand: PFEILER, prio: 0.5,
    titel: "Presse: Fakten, Zahlen, Bildmaterial, Ansprechpartner",
    beschreibung: "FIAON in den Medien: Kurzprofil, Marktzahlen zum Zitieren, Themen für Interviews und Gastbeiträge, Bildmaterial und ein Ansprechpartner am selben Werktag.",
    h1: "FIAON in den Medien.",
    lead: "Das Betriebssystem für Bonität: FIAON zeigt Menschen in Deutschland, Österreich und der Schweiz, was Auskunfteien über sie wissen – repariert es mit ihnen und öffnet danach die Tür zu Konto, Karte und Finanzierung. Hier finden Sie alles für Ihre Recherche.",
    abschnitte: [
      { h2: "In drei Sätzen erzählt.", text: "Wer FIAON in einem Absatz beschreiben will, braucht nur die drei Schichten: Einsicht, Aktion, Zugang." },
      { h2: "Worüber wir sprechen können.", text: "Justin Schwarzott steht für Interviews, Hintergrundgespräche und Gastbeiträge zur Verfügung: Was steht eigentlich in meiner SCHUFA? Warum Score-Apps nicht reichen. KI, die Kontoauszüge liest. Kunden werden Mitarbeiter." },
      { h2: "Wortmarke und Produktansichten.", text: "Druckfähige Dateien, Screenshots des Kundenbereichs und ein Porträt des Gründers erhalten Sie auf Anfrage innerhalb eines Werktags. Presseanfragen: Medium, Thema und Frist – Antwort in der Regel am selben Werktag." },
    ],
    weiter: ["/team", "/was-ist-fiaon", "/investoren", "/kontakt"],
    krumen: [{ name: "Presse", pfad: "/presse" }],
  },
  "/investoren": {
    pfad: "/investoren", art: "unternehmen", stand: PFEILER, prio: 0.5,
    titel: "Investoren: das Modell hinter FIAON und der Datenraum",
    beschreibung: "Warum der Platz zwischen Auskunftei und Bank unbesetzt ist, wie FIAON ihn besetzt, drei Erlösquellen, vier Kennzahlen – und der Datenraum unter NDA.",
    h1: "Der größte unbesetzte Platz im Finanzleben von 100 Millionen Menschen.",
    lead: "Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen steht niemand. FIAON besetzt diesen Platz: Wir zeigen die Bonität, reparieren sie mit dem Kunden – und öffnen dann die Tür zurück ins Finanzsystem.",
    abschnitte: [
      { h2: "Ein Markt, der nur anzeigt.", text: "Bonität entscheidet über Konto, Wohnung und Finanzierung. Trotzdem ist sie für die meisten Menschen unsichtbar – und für die, die sie sehen, unveränderbar." },
      { h2: "Drei Schichten. Der Burggraben liegt in der Mitte.", text: "Einsicht können viele. Zugang verkaufen Banken. Die Aktion – geprüfte Schreiben, verfolgte Antworten, Ratenvereinbarungen, die halten – besetzt niemand. Daraus entsteht Wissen, das keine App hat." },
      { h2: "Eine Plattform, die selbst arbeitet.", text: "FIAON ist kein Callcenter mit Software, sondern Software mit Menschen an den richtigen Stellen. Die Plattform bucht, mahnt, prüft und antwortet selbst – dokumentiert im Logbuch seit Tag eins." },
      { h2: "Drei Erlösquellen. Eine Beziehung.", text: "Der Kunde zahlt für Einsicht und Aktion. Der Partner zahlt für Zugang. Beides hängt an derselben Akte – deshalb wächst der Wert eines Kunden mit jeder Etappe." },
      { h2: "Woran wir uns messen.", text: "Zeit bis zur ersten Einsicht, Antwortquote auf Schreiben, Graduation-Rate, Raten-Einzugsquote. Die aktuellen Werte liegen im Datenraum und werden monatlich aktualisiert. Zahlen gibt es unter NDA – Antwort innerhalb von zwei Werktagen von Justin Schwarzott persönlich." },
    ],
    weiter: ["/datenraum", "/team", "/was-ist-fiaon", "/demo", "/presse"],
    krumen: [{ name: "Investoren", pfad: "/investoren" }],
  },
  "/datenraum": {
    pfad: "/datenraum", art: "unternehmen", stand: PFEILER, prio: 0.3, robots: "noindex,follow",
    titel: "Datenraum: Due Diligence auf Anfrage — FIAON",
    beschreibung: "FIAON wird geführt, als würde morgen verkauft: Entscheidungsregister, Logbuch, Kennzahlen, Verträge und Technik-Dokumentation – auf Anfrage unter NDA.",
    h1: "Geführt, als würde morgen verkauft.",
    lead: "Seit dem ersten Tag hält FIAON jede Entscheidung, jede Änderung und jede Zahl fest – nicht für den Verkauf, sondern weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Der Datenraum ist die Folge davon.",
    weiter: ["/investoren", "/team"],
    krumen: [{ name: "Datenraum", pfad: "/datenraum" }],
  },
  "/fiaon-erfahrungen": {
    pfad: "/fiaon-erfahrungen", art: "unternehmen", stand: PFEILER, prio: 0.8,
    titel: "FIAON Erfahrungen: So arbeitet FIAON — ehrlich erklärt",
    beschreibung: "FIAON Erfahrungen: bankbestätigte Zahlen, der Ablauf in drei Schritten, was wir nicht versprechen – und ein Seriositäts-Check, der für jeden Anbieter gilt.",
    h1: "So arbeitet FIAON.",
    lead: "Wer „FIAON Erfahrungen“ sucht, will wissen: Kann ich denen trauen? Die ehrlichste Antwort ist, Ihnen alles Prüfbare hinzulegen – Zahlen aus dem Betrieb, den Ablauf, die Preise, die Grenzen. Und einen Check, mit dem Sie jeden Anbieter prüfen können. Auch uns.",
    abschnitte: [
      { h2: "FIAON in Zahlen", text: "Stand 2. September 2026, bankbestätigt: über 440 zahlende Kunden, 450 bezahlte Monatsraten, drei Länder (Deutschland, Österreich, Schweiz), 20 kostenlose Werkzeuge. Gezählt wird nur, was die Bank bestätigt hat." },
      { h2: "So funktioniert's – in drei Schritten", text: "Antrag mit Festpreis und Startgespräch mit einem Menschen; Einsicht – Auskunft bei SCHUFA, KSV, CRIF beschafft und jede Zeile gegen § 31 BDSG und die Löschfristen geprüft; Aktion und Zugang – anwaltlich geprüfte Schreiben, Fristen, Girokonto und Karte beim Partnerinstitut. Die Entscheidung trifft die Bank." },
      { h2: "Der Seriositäts-Check – für jeden Anbieter", text: "Sechs Fragen: Löschgarantie? Erfolgsbeteiligung pro Eintrag? Kostenlose Rechte genannt? Vollständiges Impressum? Zeitdruck? Jeder Schritt sichtbar? FIAON beantwortet sie offen – Festpreis, keine Garantie, Impressum mit Registernummer, kündbar zum Monatsende." },
      { h2: "Woran Sie unseriöse Anbieter erkennen", text: "Löschgarantien, Erfolgsbeteiligung pro Eintrag, verschwiegene Gratis-Rechte, Vorkasse an anonyme Empfänger, Erfolg über Nacht, Druck statt Klarheit." },
      { h2: "Zwei typische Verläufe", text: "Nachgestellt aus der Praxis: der Eintrag, der nie hätte gemeldet werden dürfen (Löschung nach acht Wochen, Konto nach zehn) – und der berechtigte Eintrag, bei dem keine Löschung möglich ist, aber Ratenvereinbarung, Erledigt-Vermerk und Guthabenkonto den Weg bauen." },
      { h2: "Bewertungen – im Aufbau", text: "FIAON legt die öffentlichen Bewertungsprofile (Trustpilot, ProvenExpert, Google) im September 2026 an; bis echte Bewertungen vorliegen, zeigen wir lieber nichts als erfundene Sterne." },
    ],
    weiter: ["/was-ist-fiaon", "/preise", "/team", "/sicherheit", "/kontakt", "/privatkunden"],
    krumen: [{ name: "So arbeitet FIAON", pfad: "/fiaon-erfahrungen" }],
    en: {
      pfad: "/en/how-fiaon-works",
      titel: "FIAON reviews: how FIAON works, explained honestly",
      beschreibung: "Bank-confirmed figures, the process in three steps, what we do not promise — and a seriousness check that applies to every provider, including us.",
      h1: "How FIAON works.",
      lead: "Anyone searching for “FIAON reviews” wants to know: can I trust them? The most honest answer is to lay out everything verifiable — figures from operations, the process, the prices, the limits. And a check with which you can test any provider. Including us.",
      abschnitte: [
        { h2: "Figures, not claims", text: "Over 440 paying customers with bank-confirmed payment, 450 paid monthly instalments, three countries, 20 free tools — as of 2 September 2026. Only what the bank has confirmed is counted." },
        { h2: "How it works in three steps", text: "An application with a fixed price and a 15-minute onboarding call; the report obtained with authorisation and every line checked against Section 31 BDSG and the deletion deadlines; letters reviewed by lawyers sent by registered post, deadlines tracked, account and card prepared with the partner institution. The bank decides." },
        { h2: "The seriousness check", text: "Six questions that apply to every provider: deletion guarantees, success fees, concealed free rights, a missing legal notice, time pressure, no insight into the steps. FIAON answers all six — and shows where reviews stand: being set up, nothing invented.", punkte: ["Six warning signs of dubious providers", "Two typical journeys, reconstructed from practice", "Honest up to the no: justified entries stay"] },
      ],
      weiter: ["/preise", "/ueber-uns", "/transparenz"],
      krumen: [{ name: "FIAON reviews", pfad: "/en/how-fiaon-works" }],
    },
  },


  // ── Zehn-Seiten-Plan, 02.09.2026 (E-083): die ersten sechs ───────────────
  "/termin": { pfad: "/termin", art: "unternehmen", stand: PFEILER, prio: 0.9,
    titel: "Startgespräch buchen: 15 Minuten mit einem Menschen",
    beschreibung: "Lieber erst reden? Zeitfenster wählen – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos.",
    h1: "Lieber erst reden?",
    lead: "15 Minuten am Telefon, ein Mensch, der die Auskunft lesen kann. Sie sagen, was Sie beschäftigt – wir sagen, was geht, was nicht geht und was es kosten würde. Wählen Sie ein Zeitfenster; der Rückruf kommt spätestens am nächsten Werktag.",
    abschnitte: [{ h2: "Was in den 15 Minuten passiert.", text: "Ihre Lage, was die Auskunft hergibt, Ihr Ziel, der ehrliche Vorschlag (Werkzeuge, Auskunft für 74 Euro oder Paket) und die nächsten Schritte – dieselbe Agenda wie in jedem Startgespräch." }, { h2: "Zeitfenster wählen – wir rufen an.", text: "Name, Telefon, E-Mail, Land, Wunsch-Zeitfenster und Anliegen. Kostenlos, ohne Verpflichtung, werktags 9 bis 19 Uhr." }, { h2: "Warum reden, bevor Sie etwas kaufen?", text: "Weil die Antwort manchmal „Sie brauchen uns nicht“ lautet: Bei einem klaren Eintrag reichen die Werkzeuge; die Frist, die gerade läuft, klären wir in zwei Minuten; das passende Paket ist selten das größte." }],
    weiter: ["/kontakt", "/preise", "/werkzeuge/eintrag-pruefen", "/fiaon-erfahrungen", "/hilfe"],
    krumen: [{ name: "Startgespräch buchen", pfad: "/termin" }],
    en: {
      pfad: "/en/book-a-call",
      titel: "Book a call: 15 minutes with a person, free | FIAON",
      beschreibung: "Rather talk first? Choose a time slot — one of our team calls you, explains what your report shows and which plan fits. Free and without obligation.",
      h1: "Rather talk first?",
      lead: "15 minutes on the phone with a person who can read a credit report. You say what is on your mind — we say what is possible, what is not and what it would cost. Choose a time slot; the call comes back on the next working day at the latest.",
      abschnitte: [
        { h2: "What happens in the 15 minutes", text: "Your situation, what the report shows, your goal, the honest suggestion, the next steps — the same agenda our team follows in every onboarding call. Sometimes the answer is that the free tools are enough." },
        { h2: "Choose a time slot — we call you", text: "Name, phone, e-mail, country, preferred time slot and topic. Your details go straight to the team; nobody outside FIAON sees them. Free, no obligation, on the next working day at the latest. Our team speaks English." },
      ],
      weiter: ["/kontakt", "/preise"],
      krumen: [{ name: "Book a call", pfad: "/en/book-a-call" }],
    },
  },
  "/hilfe": { pfad: "/hilfe", art: "unternehmen", stand: PFEILER, prio: 0.8,
    titel: "Hilfe-Center: Antworten zu Antrag, Zahlung, Auskunft",
    beschreibung: "Antrag, Zahlung, Auskunft, Schreiben, Konto und Karte, Kündigung, Datenschutz, Mitarbeiter werden: das FIAON-Hilfe-Center mit Suche.",
    h1: "Antworten, bevor Sie fragen müssen.",
    lead: "Acht Themen, dieselben Antworten wie am Telefon und im Assistenten. Suchen Sie – oder öffnen Sie das Thema, das gerade dran ist.",
    abschnitte: [{ h2: "Antrag und Start", text: "Zwei Minuten Antrag, Passwort, „Jetzt aktivieren“ oder „Zuerst sprechen“, Startgespräch nach Zahlungseingang." }, { h2: "Zahlung und Raten", text: "Erste Rate per Überweisung, danach SEPA-Lastschrift zum Monatsanfang, Zahlungskalender, Rechnung je Rate, Anrechnung der Auskunft." }, { h2: "Auskunft und Einträge", text: "SCHUFA, KSV1870, CRIF, Intrum und Betreibungsregister mit Vollmacht; jeder Eintrag eingeordnet; der neue SCHUFA-Score je Kriterium." }, { h2: "Schreiben und Fristen", text: "Anwaltlich geprüfte Vorlagen, Freigabe vor dem Versand, Einschreiben ab Pro, ein Monat Antwortfrist, Beschwerde bei der Aufsicht." }, { h2: "Konto und Karte", text: "Girokonto für jeden Kunden, Karte sobald die Akte die Schwelle erreicht – die Bank entscheidet; Karten-Readiness als Fortschritt." }, { h2: "Kündigung und Widerruf", text: "Jederzeit zum Monatsende, formlos; 14 Tage Widerruf; Löschung auf Wunsch binnen 30 Tagen." }, { h2: "Datenschutz und Sicherheit", text: "Server in Frankfurt, verschlüsselt; Akte nur für Ansprechpartner und Betreiber; kein Zugriff auf Online-Banking." }, { h2: "Mitarbeiter werden", text: "Bewerbung in vier Schritten, fest oder frei, remote in DACH, Academy vor dem ersten Kundengespräch." }],
    weiter: ["/kontakt", "/termin", "/preise", "/sicherheit", "/werkzeuge", "/karriere"],
    krumen: [{ name: "Hilfe-Center", pfad: "/hilfe" }],
    en: {
      pfad: "/en/help",
      titel: "Help centre: answers on application, payment and report",
      beschreibung: "Application, payment, report, letters, account and card, cancellation, privacy, joining the team: the FIAON help centre answers the most common questions.",
      h1: "Answers, before you have to ask.",
      lead: "Eight topics, the same answers as on the phone and in the assistant. Search — or open the topic that is on your mind.",
      abschnitte: [
        { h2: "Eight topics", text: "Application and start, payment and instalments, report and entries, letters and deadlines, account and card, cancellation and withdrawal, privacy and security, joining the team — every answer follows the same rules as on the phone: bank-confirmed means paid, the bank decides on account and card, cancellation monthly and informal." },
        { h2: "Three ways to a person", text: "The assistant on the contact page answers straight away. Customers reach their contact person in the customer area under Help. Everyone else: support +41 44 244 93 01 on weekdays or support@fiaon.com, a reply within one working day." },
      ],
      weiter: ["/kontakt", "/termin"],
      krumen: [{ name: "Help", pfad: "/en/help" }],
    },
  },
  "/vergleich": { pfad: "/vergleich", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "FIAON, Anwalt, Score-App oder selbst? Der Vergleich",
    beschreibung: "SCHUFA-Eintrag löschen lassen: FIAON, Anwalt, Score-App oder selbst im ehrlichen Vergleich – Kosten, Dauer, Verfolgung, Konto danach.",
    h1: "Anwalt, App, selbst – oder FIAON?",
    lead: "Vier Wege führen zu einer sauberen Auskunft, und keiner ist immer der richtige. Hier stehen Kosten, Dauer und Grenzen nebeneinander – inklusive der Fälle, in denen Sie uns nicht brauchen.",
    abschnitte: [{ h2: "Vier Wege nebeneinander.", text: "Selbst mit Werkzeugen (0 Euro plus Porto), Score-App (0 Euro, zeigt nur), Anwalt (150–300 Euro je Schreiben, unersetzlich bei Klage und Schadensersatz), FIAON (74 Euro Auskunft, 7,99–99,99 Euro im Monat über zwölf Raten; Versand, Nachfassen, Raten, Konto und Karte vorbereitet). Kein Weg löscht berechtigte Einträge vor der Frist." }, { h2: "Drei Fragen, ein Weg.", text: "Lage, Zeit, Ziel – zwei der vier Antworten führen weg von FIAON: zum Anwalt bei Streit und Schadensersatz, zu den kostenlosen Werkzeugen bei einem klaren Eintrag." }, { h2: "Die drei Alternativen – fair betrachtet.", text: "Selbermachen ist der günstigste Weg, wenn Sie dranbleiben. Score-Apps sehen, handeln nicht. Der Anwalt ist unersetzlich, wenn es streitig wird – und für den ersten Löschantrag oft teurer als nötig." }],
    weiter: ["/schufa-eintrag-loeschen", "/werkzeuge/widerspruch", "/preise", "/fiaon-erfahrungen", "/termin", "/werkzeuge"],
    krumen: [{ name: "Vergleich", pfad: "/vergleich" }],
    en: {
      pfad: "/en/compare",
      titel: "FIAON, a lawyer, a score app or yourself? The comparison",
      beschreibung: "Having a SCHUFA entry deleted: FIAON, a lawyer, a score app or doing it yourself in an honest comparison — cost, duration, follow-up, account afterwards.",
      h1: "Lawyer, app, yourself — or FIAON?",
      lead: "Four routes lead to a clean report, and none is always the right one. Here cost, duration and limits stand side by side — including the cases in which you do not need us.",
      abschnitte: [
        { h2: "Four routes side by side", text: "Doing it yourself with the free tools costs nothing but time; a score app shows but does not act; a lawyer is irreplaceable in court and for damages; FIAON obtains, explains, sends, follows up and prepares account and card for a fixed price over twelve instalments. No route deletes justified, lawfully reported entries before the deadline." },
        { h2: "Three questions, one route", text: "Situation, time and goal decide: a clear single entry fits doing it yourself; a refused deletion or a claim for damages fits a lawyer; several entries or an account as the goal fit FIAON. Two of the four answers lead away from FIAON." },
      ],
      weiter: ["/preise", "/fiaon-erfahrungen"],
      krumen: [{ name: "Comparison", pfad: "/en/compare" }],
    },
  },
  "/ueber-uns": { pfad: "/ueber-uns", art: "unternehmen", stand: PFEILER, prio: 0.7,
    titel: "Über FIAON: Geschichte, Meilensteine und Haltung",
    beschreibung: "Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, alles im Register.",
    h1: "Der Platz, den niemand besetzt hatte.",
    lead: "Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen stand niemand – bis FIAON. Hier steht, warum es uns gibt, was seit der Gründung passiert ist und woran wir uns halten. Mit Daten, nicht mit Gefühlen.",
    abschnitte: [{ h2: "Warum es FIAON gibt.", text: "100 Millionen Menschen in DACH haben einen Eintrag; Score-Apps zeigen, Anwälte klagen, Schuldnerberatungen warten. FIAON besetzt den Platz dazwischen: Einsicht, Aktion, Zugang." }, { h2: "Was seit der Gründung passiert ist.", text: "2025 Gründung als FIAON LTD (Company No. 17318250); Frühjahr 2026 Plattform; 4. Juli 2026 erste bankbestätigte Zahlung; August 2026 Team, Academy, Ratgeber, Werkzeuge; 24. August 2026 Server nach Frankfurt; 2. September 2026 über 440 zahlende Kunden und 20 Werkzeuge." }, { h2: "Woran wir uns halten.", text: "Sie-Form immer, keine Fantasiezahlen, jede Entscheidung ein Eintrag im Register, wem geholfen wurde, hilft." }, { h2: "Sitz London, Betrieb in DACH.", text: "FIAON LTD im britischen Handelsregister mit öffentlichen Unterlagen; Server in Frankfurt, Support mit Schweizer Nummer, Team und Kunden in Deutschland, Österreich und der Schweiz; eine Gesellschaft im EWR ist in Vorbereitung." }],
    weiter: ["/team", "/was-ist-fiaon", "/fiaon-erfahrungen", "/transparenz", "/presse", "/investoren"],
    krumen: [{ name: "Über FIAON", pfad: "/ueber-uns" }],
    en: {
      pfad: "/en/about",
      titel: "About FIAON: history, milestones and principles",
      beschreibung: "Why FIAON exists, who is behind it, what has happened since it was founded and what the company holds to: courtesy, no guarantees, every decision recorded.",
      h1: "The place nobody had taken.",
      lead: "Score apps show a number. Banks decide. In between stood nobody — until FIAON. Here is why we exist, what has happened since we were founded and what we hold to. With data, not feelings.",
      abschnitte: [
        { h2: "Why FIAON exists", text: "100 million people in Germany, Austria and Switzerland have an entry with SCHUFA, KSV or CRIF; most do not know what it says. Score apps show the number, lawyers are there for the lawsuit, debt counselling has waiting lists. FIAON takes the place in between: insight, action, access." },
        { h2: "Milestones since the founding", text: "Founded as FIAON LTD in 2025 (Company No. 17318250); platform built in spring 2026; first bank-confirmed payment on 4 July 2026; team, Academy, guides and tools in August 2026; servers moved to Frankfurt on 24 August 2026; over 440 paying customers and 20 free tools as of 2 September 2026. Every point can be verified in the register, the logbook or the database." },
        { h2: "Registered in London, operating in DACH", text: "FIAON LTD is registered at Companies House with publicly available filings. Servers and database are in Frankfurt, support runs on a Swiss number, team and customers are in Germany, Austria and Switzerland, the investor in Zurich. A company in the EEA is being prepared.", punkte: ["Courtesy, always", "No fantasy numbers — the bank decides", "Every decision on record", "Those who were helped, help"] },
      ],
      weiter: ["/was-ist-fiaon", "/preise"],
      krumen: [{ name: "About FIAON", pfad: "/en/about" }],
    },
  },
  "/transparenz": { pfad: "/transparenz", art: "unternehmen", stand: PFEILER, prio: 0.7,
    titel: "FIAON Transparenzbericht: Zahlen mit Definition, Stand",
    beschreibung: "Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition und Stand.",
    h1: "Zahlen, die man nachrechnen kann.",
    lead: "Kein Marktteilnehmer zeigt, wie viele Kunden wirklich bezahlt haben und wie viele Raten wirklich eingegangen sind. FIAON tut es – mit Definition, Stand und Herkunft. Und sagt, was noch nicht gemessen ist.",
    abschnitte: [{ h2: "Die Zahlen, Stand 2. September 2026", text: "443 zahlende Kunden (bankbestätigt, ohne Testkonten), 450 bezahlte Monatsraten, Kunden nach Land DE 267 · AT 150 · CH 4, 20 Werkzeuge, 57 Ratgeber. Nächste Aktualisierung Anfang Oktober 2026." }, { h2: "Jede Zahl mit Definition.", text: "Zahlende Kunden: Bestellung mit bankbestätigter Zahlung, Dubletten und Testkonten ausgeschlossen. Bezahlte Raten: Zahlungsdatum im Bankbuch, stornierte ausgeschlossen." }, { h2: "Die vier Nordstern-Kennzahlen – in Messung.", text: "Zeit bis zur ersten Einsicht, Antwortquote auf Schreiben, Graduation-Rate, Raten-Einzugsquote – veröffentlicht, sobald sie über ein Quartal belastbar sind, nicht vorher." }, { h2: "Was hier nicht steht", text: "Keine Bewertungen, die es noch nicht gibt; keine Umsätze außerhalb des Datenraums; keine Einzelfälle ohne Freigabe; keine Erfolgsquote ohne belastbare Antwortquote." }],
    weiter: ["/fiaon-erfahrungen", "/status", "/investoren", "/ueber-uns", "/preise"],
    krumen: [{ name: "Transparenzbericht", pfad: "/transparenz" }],
    en: {
      pfad: "/en/transparency",
      titel: "FIAON transparency report: figures with definition and date",
      beschreibung: "What FIAON measures and publishes: paying customers, paid instalments, countries, tools, guides — bank-confirmed, with definition, date and source.",
      h1: "Figures you can check yourself.",
      lead: "No market participant shows how many customers have really paid and how many instalments have really arrived. FIAON does — with definition, date and source. And says what has not been measured yet.",
      abschnitte: [
        { h2: "The figures as of 2 September 2026", text: "443 paying customers with bank-confirmed payment, 450 paid monthly instalments, 267 customers in Germany, 150 in Austria and 4 in Switzerland, 20 free tools and 57 guides — measured in the platform's database with the same definitions the management uses internally. Next update at the beginning of October 2026." },
        { h2: "Four north-star metrics being measured", text: "Time to first insight, reply rate on letters, graduation rate into an account or finance, instalment collection rate. Published as soon as they are reliable over a quarter — not before." },
        { h2: "What is not here", text: "No reviews that do not exist yet, no revenue outside the data room, no individual cases without approval, no success rate of deleted entries until the reply rate is reliable." },
      ],
      weiter: ["/fiaon-erfahrungen", "/ueber-uns"],
      krumen: [{ name: "Transparency report", pfad: "/en/transparency" }],
    },
  },
  "/status": { pfad: "/status", art: "unternehmen", stand: PFEILER, prio: 0.5,
    titel: "FIAON Status: Verfügbarkeit, Datenstandort, Störungen",
    beschreibung: "Läuft FIAON gerade? Live-Prüfung, Datenstandort Frankfurt, Verschlüsselung, Regeln für Wartung und die Liste bekannter Störungen – prüfbar.",
    h1: "Läuft FIAON gerade?",
    lead: "Diese Seite fragt die Plattform beim Öffnen selbst – und sagt Ihnen, wo Ihre Daten liegen, wie sie geschützt sind und was zuletzt nicht funktioniert hat. Keine Marketingzahlen, nur Prüfbares.",
    abschnitte: [{ h2: "Datenstandort und Schutz.", text: "Frankfurt am Main (EU) für Anwendung und Datenbank, Umzug abgeschlossen am 24.08.2026; TLS-verschlüsselt; Zugriff nur für Ansprechpartner und Betreiber; SEPA über verifizierten Kreditor, keine Kartendaten bei FIAON; Deploys unterbrechungsfrei über Gesundheitspfad; Löschung auf Wunsch binnen 30 Tagen." }, { h2: "Bekannte Störungen – ehrlich geführt.", text: "27.08.2026, rund 12 Stunden: Kundenbereich nach Anmeldung nicht erreichbar – eine Datenbankabfrage schlug fehl; seither Praxistest gegen die echte Datenbank vor jedem Deploy und ein Gesundheitspfad für unterbrechungsfreies Umschalten." }],
    weiter: ["/sicherheit", "/transparenz", "/kontakt", "/privacy"],
    krumen: [{ name: "Status", pfad: "/status" }] },

  // ═════════════════════════════════════════════════════════════════════════
  // PFEILERSEITEN — jede beantwortet eine Suchfrage vollständig
  // ═════════════════════════════════════════════════════════════════════════
  "/schufa-eintrag-loeschen": {
    pfad: "/schufa-eintrag-loeschen", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "SCHUFA-Eintrag löschen lassen: Fristen, Rechte, Weg",
    beschreibung: "SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind (§ 31 BDSG), alle Löschfristen als Tabelle, der Weg in vier Schritten mit freien Werkzeugen.",
    h1: "SCHUFA-Eintrag löschen lassen.",
    lead: "Welche Einträge angreifbar sind, welche Löschfristen gelten und wie der Weg in vier Schritten aussieht – mit kostenlosen Werkzeugen für jeden Schritt. Ehrlich: Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf.",
    abschnitte: [
      { h2: "Welche Einträge angreifbar sind", text: "Drei Angriffspunkte, die in der Praxis am häufigsten tragen.", punkte: ["Ohne die Voraussetzungen gemeldet: Eine offene Forderung darf nur gemeldet werden nach zwei Mahnungen mit vier Wochen Abstand, rechtzeitigem Hinweis auf die Meldung und ohne Ihren Widerspruch (§ 31 BDSG).", "Verfristet und trotzdem noch da: Drei Jahre nach Erledigung, 18 Monate bei der 100-Tage-Regel, sechs Monate nach Restschuldbefreiung, zwölf Monate für Kreditanfragen.", "Schlicht falsch: Falscher Betrag, falsches Datum, falsche Person, doppelt gemeldet, Erledigung nie nachgetragen – unrichtige Daten müssen berichtigt werden (Art. 16 DSGVO)."] },
      { h2: "Die Löschfristen auf einen Blick", text: "Stand der Verhaltensregeln 2024 – taggenau gerechnet, nicht mehr zum Jahresende: erledigte Forderung drei Jahre, 100-Tage-Fälle 18 Monate, Restschuldbefreiung sechs Monate, Kreditanfrage zwölf Monate, Girokonto und Karte mit der Beendigung." },
      { h2: "Der Weg in vier Schritten", text: "Alles davon können Sie selbst tun – die Werkzeuge bereiten jeden Schritt kostenlos vor: Datenkopie anfordern (Art. 15 DSGVO), jeden Eintrag prüfen, Löschung oder Berichtigung schriftlich verlangen, Antwort nachhalten und bei Bedarf zur Datenschutzbehörde eskalieren." },
    ],
    weiter: ["/werkzeuge/eintrag-pruefen", "/werkzeuge/loeschfrist", "/werkzeuge/selbstauskunft", "/eintrag-verjaehrung", "/inkasso-brief-erhalten", "/schufa-score-verstehen", "/selbstauskunft-checkliste", "/privatkunden"],
    krumen: [{ name: "SCHUFA-Eintrag löschen", pfad: "/schufa-eintrag-loeschen" }],
  },
  "/bonitaet-verbessern": {
    pfad: "/bonitaet-verbessern", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "Bonität verbessern: die Hebel, die wirklich wirken",
    beschreibung: "Bonität verbessern: Welche Maßnahmen wirklich wirken, welche Monate brauchen und welche nichts bringen – mit 90-Tage-Plan und kostenlosen Werkzeugen.",
    h1: "Bonität verbessern — was wirklich wirkt.",
    lead: "Die Hebel nach Wirkung geordnet: Welche Maßnahmen in Wochen wirken, welche Monate brauchen und welche gar nichts bringen – mit 90-Tage-Plan und den Regeln hinter SCHUFA-, KSV- und CRIF-Score.",
    abschnitte: [
      { h2: "Die großen Hebel", text: "Wirkung in Wochen bis Monaten – hier beginnt jede ernsthafte Verbesserung.", punkte: ["Angreifbare Einträge entfernen: Negativeinträge sind das schwerste Einzelmerkmal, ein erheblicher Teil ist angreifbar.", "Dispo ausgleichen, Rücklastschriften stoppen: Für die Bank ist der Kontoauszug die Wahrheit.", "Anfragen richtig stellen: Vergleichen Sie ausschließlich mit Konditionsanfragen – sie sind score-neutral."] },
      { h2: "Die stillen Hebel", text: "Wirkung über Monate – unspektakulär, aber sie tragen die Historie: alles pünktlich ohne Ausnahme, wenige, alte, stabile Verträge, einmal im Jahr die Datenkopie." },
      { h2: "Der 90-Tage-Plan", text: "Tage 1–14 Wissen: Datenkopien anfordern, Kontoauszüge durchsehen. Tage 15–45 Aufräumen: jeden Eintrag prüfen, Löschung und Berichtigung schriftlich verlangen. Tage 46–90 Festigen: Dauerauftrag, Zweitkonten schließen, Antworten nachhalten." },
    ],
    weiter: ["/schufa-score-verstehen", "/schufa-eintrag-loeschen", "/schufa-neutral-anfragen", "/ratenzahlung-und-bonitaet", "/girokonto-trotz-negativer-bonitaet", "/werkzeuge/schulden-check", "/werkzeuge", "/privatkunden"],
    krumen: [{ name: "Bonität verbessern", pfad: "/bonitaet-verbessern" }],
    en: {
      pfad: "/en/strengthen-your-credit-file",
      titel: "Strengthening your credit file: the levers ranked by effect",
      beschreibung: "Which measures really work, which take months and which achieve nothing — with a 90-day plan, free tools and the rules behind SCHUFA, KSV and CRIF scores.",
      h1: "Strengthening your credit file — what really works.",
      lead: "Most advice about the score is folklore. Here the levers are in order of their effect — with an honest statement of how long each one takes.",
      abschnitte: [
        { h2: "The big levers", text: "Remove challengeable entries (Section 31 BDSG, expiry, errors), clear the overdraft and stop returned direct debits, make rate enquiries instead of credit enquiries. Effect within weeks to months." },
        { h2: "The quiet levers", text: "Everything on time without exception, few old stable contracts, the free data copy once a year. Effect over months — they carry the history." },
        { h2: "The 90-day plan", text: "Days 1–14 know, days 15–45 tidy up, days 46–90 consolidate — each stage with the free tool that prepares it. Only the credit bureaus calculate scores; nobody can guarantee a particular change." },
      ],
      weiter: ["/schufa-score-verstehen", "/kreditkarte"],
      krumen: [{ name: "Strengthening your credit file", pfad: "/en/strengthen-your-credit-file" }],
    },
  },
  "/kredit-ohne-schufa": {
    pfad: "/kredit-ohne-schufa", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "Kredit ohne SCHUFA: Was wirklich dahintersteckt",
    beschreibung: "Kredit ohne SCHUFA: Was es seriös gibt, was es kostet, woran Sie Betrug in 30 Sekunden erkennen – und warum der bessere Weg meist über die Auskunft führt.",
    h1: "Kredit ohne SCHUFA — die ganze Wahrheit.",
    lead: "Was es seriös tatsächlich gibt, was es kostet, woran Sie Betrug in 30 Sekunden erkennen – und warum der bessere Weg meist ist, die Auskunft in Ordnung zu bringen. FIAON vermittelt keine Kredite.",
    abschnitte: [
      { h2: "Was es seriös tatsächlich gibt", text: "Der „Schweizer Kredit“: Ausländische Banken (heute vor allem aus Liechtenstein) vergeben Kredite ohne SCHUFA-Abfrage und ohne Meldung – feste Summen, feste Laufzeiten. Ohne Einkommen: nichts. Teurer, immer: 10 bis 16 Prozent effektiv statt 5 bis 9 beim regulären Ratenkredit." },
      { h2: "Betrug in 30 Sekunden erkennen", text: "Drei Muster, ein Grundsatz: Seriöse Kreditgeber verlangen niemals Geld, bevor Geld fließt. Vorkosten vor der Auszahlung, Hausbesuch mit Nebenprodukten, Garantieversprechen wie „100 % Zusage“." },
      { h2: "Der bessere Weg: die Auskunft in Ordnung bringen", text: "Der Umgehungskredit behandelt das Symptom. Die Ursache steht in Ihrer Auskunft – und ist oft angreifbar: Datenkopie anfordern, jeden Eintrag prüfen, dann erst zum Kredit – zu Zinsen, die um Prozentpunkte unter dem Kredit ohne SCHUFA liegen." },
    ],
    weiter: ["/schufa-eintrag-loeschen", "/werkzeuge/kreditrechner", "/werkzeuge/eintrag-pruefen", "/schufa-neutral-anfragen", "/girokonto-trotz-negativer-bonitaet", "/ratenzahlung-und-bonitaet", "/bonitaet-verbessern"],
    krumen: [{ name: "Kredit ohne SCHUFA", pfad: "/kredit-ohne-schufa" }],
    en: {
      pfad: "/en/loans-without-schufa",
      titel: "Loans without SCHUFA: what is really behind them",
      beschreibung: "What legitimately exists, what it costs, how to spot fraud in 30 seconds — and why the better route is usually to put your credit file in order.",
      h1: "Loans without SCHUFA — the whole truth.",
      lead: "They exist. They are small, expensive and strictly checked — and around them stands the biggest fraud industry in the German credit market. Here is what you need to know before you sign anywhere.",
      abschnitte: [
        { h2: "What legitimately exists", text: "So-called Swiss loans from foreign banks without a SCHUFA enquiry: fixed sums of €3,500 to €7,500, terms around 40 months, effective rates of 10 to 16 per cent, an attachable income required. Without income there is nothing." },
        { h2: "Spot fraud in 30 seconds", text: "Advance costs before the payout, home visits with add-on products, guarantee promises such as “100 % approval”. Legitimate lenders never demand money before money flows." },
        { h2: "The better route", text: "Request the data copy, check every entry, enforce deletion where it can be challenged — then the normal credit market is open again at normal rates. FIAON does not broker loans and receives no commission from lenders." },
      ],
      weiter: ["/schufa-neutral-anfragen", "/girokonto-trotz-negativer-bonitaet"],
      krumen: [{ name: "Loans without SCHUFA", pfad: "/en/loans-without-schufa" }],
    },
  },
  "/auskunfteien": {
    pfad: "/auskunfteien", art: "pfeiler", stand: PFEILER, prio: 0.8,
    titel: "Auskunfteien im Vergleich: SCHUFA, KSV1870, CRIF",
    beschreibung: "SCHUFA, KSV1870, CRIF und Betreibungsregister im Vergleich: Wer speichert was, welche Rechte gelten, welche Löschfristen laufen – in DE, AT und CH.",
    h1: "Drei Länder, drei Regelwerke — ein Überblick.",
    lead: "SCHUFA, KSV1870, CRIF und das Schweizer Betreibungsregister im Vergleich: Wer speichert was, welche Rechte gelten, welche Löschfristen laufen – und was in Österreich und der Schweiz anders ist.",
    abschnitte: [
      { h2: "Die drei Systeme", text: "Gleicher Zweck, verschiedene Regeln – die Unterschiede stecken in Fristen und Rechtsgrundlagen.", punkte: ["SCHUFA und die DSGVO: Rund 68 Millionen erfasste Personen, Datengrundlage sind Vertrags- und Zahlungsdaten der Vertragspartner. Rechte: kostenlose Datenkopie, Berichtigung, Löschung.", "KSV1870 und die Warnliste: Der Kreditschutzverband führt neben Bonitätsdaten die „Warnliste“ der Banken. Die DSGVO gilt unmittelbar.", "CRIF, Intrum – und das Betreibungsregister: In der Schweiz wiegt das staatliche Betreibungsregister schwerer als jede private Auskunft."] },
      { h2: "Der direkte Vergleich", text: "Die Zahlen, die man ständig braucht – nebeneinander: Rechtsgrundlage, Speicherfristen, Kosten der Auskunft, Weg zur Löschung, Beschwerdestelle." },
      { h2: "Für Österreich und die Schweiz im Detail", text: "Die Länderseiten erklären Besonderheiten, Wege und Fristen vor Ort – und was FIAON in jedem Land konkret tut." },
    ],
    weiter: ["/oesterreich", "/schweiz", "/bonitaetsauskunft-beantragen", "/werkzeuge/selbstauskunft", "/eintrag-verjaehrung", "/selbstauskunft-checkliste", "/glossar-bonitaet"],
    krumen: [{ name: "Auskunfteien", pfad: "/auskunfteien" }],
    en: {
      pfad: "/en/credit-bureaus",
      titel: "SCHUFA, KSV1870, CRIF: credit bureaus compared | FIAON",
      beschreibung: "Who stores what in Germany, Austria and Switzerland — rights, deletion deadlines and differences between SCHUFA, KSV1870, CRIF and the Swiss register.",
      h1: "Three countries, three sets of rules — one overview.",
      lead: "SCHUFA, KSV1870, CRIF: who stores what, which rights apply and which deadlines run. Anyone who knows the differences gives away no claims.",
      abschnitte: [
        { h2: "The three systems", text: "Germany: SCHUFA and the GDPR, settled entries three years or 18 months with the 100-day rule. Austria: KSV1870 with the banks' warning list and CRIF, usually three years after full payment. Switzerland: CRIF, Intrum and above all the debt enforcement register, enforcements visible for five years, blockable under Art. 8a SchKG." },
        { h2: "The direct comparison", text: "Free access under Art. 15 GDPR in Germany and Austria and Art. 25 DSG in Switzerland; after personal insolvency six months in Germany, deletion after the discharge procedure in Austria, loss certificates up to 20 years in Switzerland; supervision by the state data protection authorities, the Austrian DSB and the Swiss FDPIC." },
      ],
      weiter: ["/oesterreich", "/schweiz", "/bonitaetsauskunft-beantragen"],
      krumen: [{ name: "Credit bureaus compared", pfad: "/en/credit-bureaus" }],
    },
  },
  "/schufa-score-verstehen": {
    pfad: "/schufa-score-verstehen", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "SCHUFA-Score verstehen: neue Skala 100–999, Tabelle",
    beschreibung: "Der neue SCHUFA-Score seit März 2026: Skala 100 bis 999, fünf Klassen, zwölf Kriterien mit Punkten – als Tabelle erklärt, mit den Hebeln dahinter.",
    h1: "SCHUFA-Score verstehen: Was Ihre Zahl wirklich bedeutet.",
    lead: "Seit März 2026 ist der Score eine Zahl zwischen 100 und 999 – aus zwölf veröffentlichten Kriterien, in fünf Klassen. Hier steht die Tabelle, jedes Kriterium mit seinen Punkten, die Hebel dahinter und der Weg, falsche Einträge loszuwerden.",
    abschnitte: [
      { h2: "Die Skala: 100 bis 999 Punkte", text: "Der neue SCHUFA-Score ersetzt seit dem 17. März 2026 den Basisscore in Prozent und die sechs Branchenscores. Er wird bei jeder Anfrage tagesaktuell berechnet; Verbraucher und Vertragspartner sehen dieselbe Zahl." },
      { h2: "Die Score-Tabelle: fünf Klassen", text: "Hervorragend 776–999 (rund 62 Prozent der Menschen), gut 709–775, akzeptabel 642–708, ausreichend 100–641, ungenügend bei offener Zahlungsstörung ohne Punktwert. Jede Bank setzt ihre Grenzen trotzdem selbst." },
      { h2: "Die zwölf Kriterien", text: "Zahlungsstörungen 264 Punkte, Anfragen Girokonto/Kreditkarte 117, Anfragen außerhalb des Bankenbereichs 99, Alter der Adresse 94, älteste Kreditkarte 81, ältester Bankvertrag 69, neue Ratenkredite 66, längste Restlaufzeit 61, Immobilienkredit 55, Identitätsprüfung 38, jüngster Rahmenkredit 36, Kreditstatus 19 – Summe 999 (Quelle: SCHUFA)." },
      { h2: "Was den Score bewegt", text: "Sechs Hebel nach Punkten: keine offene Zahlungsstörung, Anfragen bündeln, alte Verträge behalten, Adresse stabil halten, Kredite maßvoll, falsche Daten raus." },
      { h2: "Was FIAON daraus macht", text: "Auskünfte beschaffen, jeden Eintrag gegen § 31 BDSG und die Löschfristen prüfen, Schriftwechsel führen und Fristen halten – was berechtigt gemeldet ist, bleibt." },
    ],
    weiter: ["/bonitaet-verbessern", "/schufa-eintrag-loeschen", "/schufa-neutral-anfragen", "/bonitaetsauskunft-beantragen", "/eintrag-verjaehrung", "/werkzeuge/selbstauskunft", "/glossar-bonitaet"],
    krumen: [{ name: "SCHUFA-Score verstehen", pfad: "/schufa-score-verstehen" }],
  },
  "/bonitaetsauskunft-beantragen": {
    pfad: "/bonitaetsauskunft-beantragen", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "Bonitätsauskunft beantragen: kostenlos oder geprüft",
    beschreibung: "Bonitätsauskunft beantragen: kostenlos nach Art. 15 DSGVO oder geprüft über FIAON für 74 € – Ablauf, Dauer und der Unterschied Datenkopie oder Zertifikat.",
    h1: "Bonitätsauskunft beantragen — kostenlos oder geprüft.",
    lead: "Der kostenlose Weg nach Art. 15 DSGVO und der geprüfte FIAON-Weg für 74 € im Vergleich. Beides führt zur Auskunft. Der Unterschied ist, wer die Arbeit macht – und wer die Einträge versteht.",
    abschnitte: [
      { h2: "Selbst beantragen oder beschaffen lassen?", text: "Die Datenkopie nach Art. 15 DSGVO ist kostenlos – bei SCHUFA, KSV1870 und CRIF. Unser Generator erzeugt den fertigen Brief. Die geprüfte Auskunft über FIAON beschafft die Daten bei allen drei Häusern aus einer Hand und erklärt jeden Eintrag." },
      { h2: "So läuft es ab", text: "Vier Etappen – Sie sehen jede davon live in Ihrem Kundenbereich: Vollmacht digital unterschreiben, FIAON stellt die Anfrage, die Auskunft liegt vor, jeder Eintrag wird eingeordnet: erledigt, löschbar, berichtigbar, angreifbar." },
      { h2: "Was Sie erhalten", text: "Kein Zahlenfriedhof, sondern eine geprüfte Übersicht mit dem nächsten Schritt für jeden Eintrag. Ein Preis, keine Überraschungen: 74 € einmalig, anrechenbar auf ein späteres Paket." },
    ],
    weiter: ["/werkzeuge/selbstauskunft", "/selbstauskunft-checkliste", "/auskunfteien", "/schufa-score-verstehen", "/werkzeuge/eintrag-pruefen", "/preise"],
    krumen: [{ name: "Bonitätsauskunft beantragen", pfad: "/bonitaetsauskunft-beantragen" }],
  },
  "/inkasso-brief-erhalten": {
    pfad: "/inkasso-brief-erhalten", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "Inkasso-Brief erhalten? Erst prüfen, dann zahlen",
    beschreibung: "Inkasso-Brief erhalten: der ruhige 5-Schritte-Plan – Forderung prüfen, Kosten nachrechnen, Fristen kennen, SCHUFA-Eintrag verhindern. Mit freien Prüfern.",
    h1: "Inkasso-Brief erhalten? Erst prüfen, dann zahlen.",
    lead: "Der ruhige 5-Schritte-Plan: Forderung prüfen, Kosten nachrechnen, Fristen kennen, Eintrag verhindern. FIAON ist kein Inkasso und keine Rechtsberatung – FIAON ist Ihre Gegenprüfung.",
    abschnitte: [
      { h2: "Der 5-Schritte-Sofortplan", text: "In dieser Reihenfolge – und nichts davon am Telefon, alles schriftlich: Forderung zuordnen, Inkassokosten nachrechnen, Verjährung prüfen, schriftlich reagieren, Fristen im Kalender." },
      { h2: "Diese Fristen gelten", text: "Widerspruch gegen den gerichtlichen Mahnbescheid: zwei Wochen. Die 100-Tage-Regel der SCHUFA: vollständig ausgeglichen innerhalb von 100 Tagen verkürzt die Speicherfrist auf 18 Monate. Regelverjährung: drei Jahre nach dem Ende des Jahres, in dem die Forderung entstand." },
      { h2: "Wann ein SCHUFA-Eintrag droht — und wann nicht", text: "Die Angst vor dem Eintrag ist das Druckmittel. Gemeldet werden darf nur nach zwei Mahnungen mit vier Wochen Abstand, rechtzeitigem Hinweis und ohne Ihren Widerspruch – eine bestrittene Forderung darf nicht gemeldet werden." },
      { h2: "Wie FIAON Sie dabei unterstützt", text: "Gegenprüfung der Forderung, Zurückweisung überhöhter Kosten, Ratenvorschlag aus Ihrem Spielraum, Verfolgung der Antwort – und die Auskunft danach, damit nichts hängen bleibt." },
    ],
    weiter: ["/werkzeuge/inkassokosten", "/werkzeuge/verjaehrung", "/schufa-eintrag-loeschen", "/eintrag-verjaehrung", "/ratenzahlung-und-bonitaet", "/kontakt"],
    krumen: [{ name: "Inkasso-Brief erhalten", pfad: "/inkasso-brief-erhalten" }],
  },
  "/eintrag-verjaehrung": {
    pfad: "/eintrag-verjaehrung", art: "pfeiler", stand: PFEILER, prio: 0.8,
    titel: "SCHUFA-Eintrag und Verjährung: alle Fristen erklärt",
    beschreibung: "Wann ein SCHUFA-Eintrag verschwinden muss: Verjährungs-Checker, alle Speicherfristen je Eintragsart, berechtigt oder unberechtigt, der Weg bei Verfristung.",
    h1: "SCHUFA-Eintrag nach Jahren: Wann er verschwinden muss.",
    lead: "Verjährungs-Checker, alle Speicherfristen je Eintragsart und der Weg bei Verfristung. Verjährung der Forderung und Löschfrist des Eintrags sind zwei verschiedene Dinge – hier stehen beide.",
    abschnitte: [
      { h2: "Alle Speicherfristen je Eintragsart", text: "Stand der Verhaltensregeln 2024 – taggenau gerechnet: erledigte Forderung drei Jahre, 100-Tage-Fälle 18 Monate, Restschuldbefreiung sechs Monate, Kreditanfragen zwölf Monate, Vertragsdaten bis zur Beendigung." },
      { h2: "Berechtigt oder unberechtigt — der Unterschied entscheidet", text: "Die Frist ist nur ein Löschgrund von dreien: Frist abgelaufen – muss gelöscht werden. Ohne die Voraussetzungen gemeldet – angreifbar. Zulässig gemeldet und noch in der Frist – dann bleibt der Eintrag; das ist die ehrliche Antwort." },
      { h2: "Der FIAON-Weg bei verfristeten Einträgen", text: "Nachrechnen ist der Anfang – durchsetzen die Arbeit: Löschverlangen mit Fristsetzung, Nachhalten, Eskalation zur Datenschutzbehörde, Auskunft danach." },
    ],
    weiter: ["/werkzeuge/loeschfrist", "/werkzeuge/verjaehrung", "/schufa-eintrag-loeschen", "/inkasso-brief-erhalten", "/glossar-bonitaet", "/kontakt"],
    krumen: [{ name: "Eintrag & Verjährung", pfad: "/eintrag-verjaehrung" }],
  },
  "/girokonto-trotz-negativer-bonitaet": {
    pfad: "/girokonto-trotz-negativer-bonitaet", art: "pfeiler", stand: PFEILER, prio: 0.9,
    titel: "Girokonto trotz negativer Bonität: der ehrliche Weg",
    beschreibung: "Girokonto trotz negativer Bonität: was wirklich erreichbar ist, was ein aktives Konto für Ihre Bonität baut, Basiskonto oder FIAON-Weg – ohne Versprechen.",
    h1: "Girokonto trotz negativer Bonität — der ehrliche Weg.",
    lead: "Was wirklich erreichbar ist, was ein aktives Konto für Ihre Bonität baut und was niemand versprechen kann. Das Basiskonto ist Ihr gesetzliches Recht – unabhängig von uns.",
    abschnitte: [
      { h2: "Warum ein aktives Konto Ihre Bonität baut", text: "Kein Trick, sondern Datenlage: Risiko-Modelle lesen Verhalten – ein geführtes Konto erzeugt das richtige. Regelmäßige Gehaltseingänge, pünktliche Abbuchungen, keine Rückgaben: Über Monate entsteht genau das Bild, das Banken sehen wollen." },
      { h2: "Der Weg über FIAON", text: "Vier Etappen – und an der entscheidenden steht nicht FIAON, sondern die Bank: Auskunft und Spielraum, Konto auf Guthabenbasis bei einer Partnerbank, saubere Kontoführung, dann Karte als Ziel." },
      { h2: "Was wir nicht versprechen", text: "Kein Konto ohne Prüfung der Bank, keinen Dispo, keine Karte mit Rahmen ab Tag eins. Dieser Abschnitt fehlt auf den meisten Seiten zu dieser Suche. Genau deshalb steht er hier." },
      { h2: "Basiskonto oder FIAON-Weg?", text: "Beides hat seinen Platz: Das Basiskonto nach § 31 ZKG muss jede kontoführende Bank in Deutschland auf Antrag eröffnen. Der FIAON-Weg baut darauf die Bonität, die später Karte und Finanzierung trägt." },
    ],
    weiter: ["/kreditkarte", "/ratenzahlung-und-bonitaet", "/werkzeuge/karten-check", "/werkzeuge/selbstauskunft", "/bonitaet-verbessern", "/fiaon-erfahrungen", "/privatkunden"],
    krumen: [{ name: "Girokonto trotz negativer Bonität", pfad: "/girokonto-trotz-negativer-bonitaet" }],
  },
  "/ratenzahlung-und-bonitaet": {
    pfad: "/ratenzahlung-und-bonitaet", art: "pfeiler", stand: PFEILER, prio: 0.8,
    titel: "Ratenzahlung und Bonität: Ihr stärkster Hebel",
    beschreibung: "Wie Raten auf SCHUFA und Bonität wirken: die 12-Raten-Logik, die vier Eskalationsstufen bei Rückstand, sechs Praxis-Tipps und der FIAON-Zahlungskalender.",
    h1: "Ratenzahlung und Bonität: Pünktlich zahlt sich aus.",
    lead: "Wie Raten auf SCHUFA und Bonität wirken: die 12-Raten-Logik, die Eskalationsstufen bei Rückstand und sechs Praxis-Tipps. Rückstände entstehen meist aus Organisation, nicht aus Geldmangel.",
    abschnitte: [
      { h2: "Pünktliche Raten sind Ihr stärkster Hebel", text: "Zwölf Raten, zwölf Beweise. Jede pünktliche Zahlung ist ein Positivdatum – zusammen ergeben sie eine Historie, die Modelle belohnen." },
      { h2: "Was bei Rückständen passiert", text: "Die Eskalation ist kein Schicksal – sie ist eine Treppe mit vier Stufen: Erinnerung, Mahnung, zweite Mahnung mit Hinweis auf die Meldung, Meldung an die Auskunftei. Auf jeder Stufe kann man sie anhalten." },
      { h2: "Sechs Tipps aus der Praxis", text: "Ein Abbuchungstag für alles, Puffer aufs Zahlkonto, Erinnerung vor Fälligkeit, nicht stapeln, bei Engpass reden statt reißen lassen, Erledigtes dokumentieren." },
      { h2: "Der FIAON-Zahlungskalender", text: "Für Kunden eingebaut: keine Rate ohne Erinnerung – zwei Tage vor jedem Abbuchungstermin, im Kundenbereich und per E-Mail." },
    ],
    weiter: ["/bonitaet-verbessern", "/schufa-score-verstehen", "/inkasso-brief-erhalten", "/eintrag-verjaehrung", "/werkzeuge/spielraum", "/glossar-bonitaet", "/preise"],
    krumen: [{ name: "Ratenzahlung & Bonität", pfad: "/ratenzahlung-und-bonitaet" }],
  },
  "/selbstauskunft-checkliste": {
    pfad: "/selbstauskunft-checkliste", art: "pfeiler", stand: PFEILER, prio: 0.8,
    titel: "Selbstauskunft lesen: die 10-Punkte-Checkliste",
    beschreibung: "Selbstauskunft verstehen: die interaktive 10-Punkte-Checkliste, die fünf häufigsten Fehler beim Lesen und ein erklärter Muster-Ausschnitt Ihrer Datenkopie.",
    h1: "Selbstauskunft lesen: die 10-Punkte-Checkliste.",
    lead: "Die Datenkopie liegt vor Ihnen, aber niemand hat erklärt, wie man sie liest? Diese Checkliste geht Punkt für Punkt durch. Danach wissen Sie, was stimmt, was fehlt und was angreifbar ist.",
    abschnitte: [
      { h2: "Die Checkliste", text: "Zehn Punkte, in dieser Reihenfolge.", punkte: ["Persönliche Daten stimmen", "Jeden Vertrag zuordnen können", "Beendete Verträge sind ausgetragen", "Erledigte Forderungen tragen das Erledigt-Kennzeichen", "Löschfristen nachgerechnet", "Doppelte Einträge markiert", "Beträge und Daten geprüft", "Bestrittene Forderungen erkennen", "Anfragen der letzten 12 Monate zählen", "Unklares notiert statt ignoriert"] },
      { h2: "Die fünf häufigsten Fehler beim Lesen", text: "Nur den Score anschauen. Das Bezahlprodukt mit der Datenkopie verwechseln. Erledigt mit gelöscht verwechseln. Nur die SCHUFA prüfen. Widerspruch am Telefon statt schriftlich." },
      { h2: "Oder Sie lassen prüfen", text: "Die Checkliste ist genau die Arbeit, die FIAON bei der geprüften Bonitätsauskunft übernimmt – bei SCHUFA, KSV und CRIF aus einer Hand, jeder Eintrag erklärt." },
    ],
    weiter: ["/werkzeuge/selbstauskunft", "/bonitaetsauskunft-beantragen", "/auskunfteien", "/schufa-score-verstehen", "/schufa-eintrag-loeschen", "/glossar-bonitaet"],
    krumen: [{ name: "Selbstauskunft-Checkliste", pfad: "/selbstauskunft-checkliste" }],
  },
  "/schufa-neutral-anfragen": {
    pfad: "/schufa-neutral-anfragen", art: "pfeiler", stand: PFEILER, prio: 0.8,
    titel: "SCHUFA-neutral anfragen: Konditions- statt Kreditanfrage",
    beschreibung: "Kredit anfragen ohne Score-Wirkung: der Unterschied zwischen Konditions- und Kreditanfrage, die richtigen Sätze für die Bank – und was gespeichert bleibt.",
    h1: "SCHUFA-neutral anfragen: Konditionen statt Kredit.",
    lead: "Der Unterschied zwischen Konditions- und Kreditanfrage, die richtigen Sätze für die Bank und die Wirkung auf den Score. Beide Anfragen liefern dieselben Zahlen – nur eine hinterlässt Spuren, die andere Banken sehen.",
    abschnitte: [
      { h2: "Die Gegenüberstellung", text: "Kreditanfrage: zwölf Monate gespeichert, zehn Tage für andere Banken sichtbar, fließt in den Score ein. Konditionsanfrage: dieselben Daten, echte Konditionen, für andere unsichtbar und scorefrei." },
      { h2: "So fragen Sie richtig an", text: "Vier Schritte – und der wichtigste ist ein einziger Satz: „Bitte stellen Sie eine Anfrage Kreditkonditionen, keine Kreditanfrage.“ Schriftlich, vor der Prüfung, und die Bestätigung aufheben." },
      { h2: "Die Wirkung auf den Score", text: "Warum die Modelle Anfragen überhaupt zählen – mehrere echte Kreditanfragen in kurzer Folge lesen sich wie Ablehnungen – und was Sie tun, wenn eine Konditionsanfrage falsch als Kreditanfrage gespeichert wurde: Berichtigung nach Art. 16 DSGVO." },
    ],
    weiter: ["/schufa-score-verstehen", "/werkzeuge/kreditrechner", "/bonitaetsauskunft-beantragen", "/ratenzahlung-und-bonitaet", "/kredit-ohne-schufa", "/kontakt"],
    krumen: [{ name: "SCHUFA-neutral anfragen", pfad: "/schufa-neutral-anfragen" }],
  },
  "/glossar-bonitaet": {
    pfad: "/glossar-bonitaet", art: "pfeiler", stand: PFEILER, prio: 0.7,
    titel: "Bonitäts-Glossar: alle Begriffe von A bis Z erklärt",
    beschreibung: "Von Anfrage bis Zahlungshistorie: das Bonitäts-Glossar erklärt jeden Begriff in Klartext – Score-Klasse, Datenkopie, Löschfrist, Mahnbescheid, Restschuld.",
    h1: "Das Bonitäts-Glossar: alle Begriffe erklärt.",
    lead: "Von Anfrage bis Zahlungshistorie: jeder Begriff in zwei bis vier Sätzen Klartext – und der Verweis auf die Themenseite, die in die Tiefe geht.",
    weiter: ["/schufa-score-verstehen", "/schufa-eintrag-loeschen", "/bonitaetsauskunft-beantragen", "/ratgeber", "/auskunfteien", "/eintrag-verjaehrung"],
    krumen: [{ name: "Bonitäts-Glossar", pfad: "/glossar-bonitaet" }],
  },

  "/ratgeber": {
    pfad: "/ratgeber", art: "pfeiler", stand: PFEILER, prio: 0.9, eigenerVorrenderer: true,
    titel: "Ratgeber: SCHUFA, Bonität, Inkasso erklärt | FIAON",
    beschreibung: "SCHUFA-Eintrag löschen, Auskunft kostenlos anfordern, Kreditkarte trotz Eintrag, KSV und CRIF – geprüfte Ratgeber von FIAON, ehrlich und ohne Versprechen.",
    h1: "Wissen, das Einträge bewegt.",
    lead: "Welche Einträge angreifbar sind, wie die kostenlose Auskunft funktioniert, was trotz Eintrag realistisch ist – für Deutschland, Österreich und die Schweiz. Jeder Text wird gegen Gesetz, Verhaltensregeln der Auskunfteien und die Praxis aus FIAON-Akten geprüft.",
    weiter: ["/schufa-eintrag-loeschen", "/bonitaet-verbessern", "/werkzeuge", "/glossar-bonitaet"],
    krumen: [{ name: "Ratgeber", pfad: "/ratgeber" }],
  },

  // ═════════════════════════════════════════════════════════════════════════
  // WERKZEUGE — jedes beantwortet EINE Suchfrage, kostenlos, ohne Anmeldung
  // ═════════════════════════════════════════════════════════════════════════
  "/werkzeuge": {
    pfad: "/werkzeuge", art: "werkzeug", stand: PFEILER, prio: 0.9,
    titel: "Kostenlose SCHUFA- und Bonitäts-Werkzeuge — FIAON",
    beschreibung: "Zwanzig kostenlose Rechner, Prüfer und Brief-Generatoren zu SCHUFA, Bonität, Inkasso und Kredit: Löschantrag, Fristen, Pfändung, Dispo, Schuldenplan.",
    h1: "Erst wissen, dann handeln.",
    lead: "Zwanzig Werkzeuge, jedes beantwortet eine Frage, die sonst Geld oder Wochen kostet. Alles läuft in Ihrem Browser – nichts wird gespeichert, keine Anmeldung, keine Anfrage bei einer Auskunftei.",
    abschnitte: [
      { h2: "Einträge und Forderungen", text: "Wissen, was gespeichert ist – und was davon weg kann: Datenkopie anfordern, Eintrag prüfen, Löschantrag und Widerspruch schreiben, Löschfrist und Verjährung rechnen, Mahnbescheid-Frist, Inkassokosten und Mahngebühren prüfen, dem Inkasso antworten." },
      { h2: "Kredit und Haushalt", text: "Rechnen, bevor Sie unterschreiben: Kreditrechner, Umschuldungsrechner, Schulden-Check, Spielraum-Rechner, Ratenplan mit Angebotsbrief, Schuldenfrei-Plan, Dispo-Rechner, Pfändungsrechner 2026." },
      { h2: "Karte und Konto", text: "Realistisch einschätzen statt hoffen: Karten-Check, Kartenkosten-Vergleich und der Basiskonto-Helfer mit dem Weg zur BaFin." },
    ],
    weiter: ["/schufa-eintrag-loeschen", "/inkasso-brief-erhalten", "/eintrag-verjaehrung", "/selbstauskunft-checkliste", "/glossar-bonitaet", "/ratgeber"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }],
  },
  "/werkzeuge/selbstauskunft": {
    pfad: "/werkzeuge/selbstauskunft", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Selbstauskunft-Generator",
    titel: "Selbstauskunft kostenlos anfordern: Brief-Generator",
    beschreibung: "In einer Minute den fertigen Brief für Ihre kostenlose Datenkopie nach Art. 15 DSGVO erzeugen – an SCHUFA, KSV1870, CRIF oder Intrum. Ohne Speicherung.",
    h1: "Ihre Datenkopie – der fertige Brief.",
    lead: "Vier Angaben, und der Antrag auf die kostenlose Datenkopie steht – mit den Punkten, die Auskunfteien oft weglassen: Score-Werte, Empfänger, Herkunft. Nichts wird gespeichert; der Brief entsteht in Ihrem Browser.",
    abschnitte: [
      { h2: "Ausfüllen, kopieren, absenden.", text: "Auskunftei wählen (SCHUFA, KSV1870, CRIF oder Intrum), Name und Anschrift eintragen, Brief kopieren oder drucken, per Post absenden. Die Auskunftei hat einen Monat Zeit – die Datenkopie ist kostenlos, beliebig oft." },
    ],
    weiter: ["/bonitaetsauskunft-beantragen", "/selbstauskunft-checkliste", "/auskunfteien", "/werkzeuge/eintrag-pruefen", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Datenkopie anfordern", pfad: "/werkzeuge/selbstauskunft" }],
  },
  "/werkzeuge/eintrag-pruefen": {
    pfad: "/werkzeuge/eintrag-pruefen", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Eintrag-Prüfer",
    titel: "Ist mein SCHUFA-Eintrag angreifbar? Kurzprüfung",
    beschreibung: "Fünf Fragen, eine ehrliche Einschätzung: Ob Ihr SCHUFA-, KSV- oder CRIF-Eintrag gelöscht werden kann – nach § 31 BDSG und Löschfristen. Ohne Anmeldung.",
    h1: "Ist mein Eintrag angreifbar?",
    lead: "Fünf Fragen, eine ehrliche Einschätzung. Wir prüfen die Voraussetzungen, die das Gesetz für eine Meldung verlangt – und sagen auch, wenn ein Eintrag berechtigt ist.",
    abschnitte: [
      { h2: "Fünf Fragen. Eine Antwort.", text: "Art des Eintrags, Mahnungen vor der Meldung, Widerspruch, Datum der Erledigung, Betrag – daraus entsteht die Einordnung: angreifbar, verfristet, berichtigbar oder berechtigt. Mit dem nächsten Schritt für jeden Fall." },
    ],
    weiter: ["/schufa-eintrag-loeschen", "/werkzeuge/loeschfrist", "/werkzeuge/selbstauskunft", "/eintrag-verjaehrung", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Eintrag prüfen", pfad: "/werkzeuge/eintrag-pruefen" }],
  },
  "/werkzeuge/loeschfrist": {
    pfad: "/werkzeuge/loeschfrist", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Löschfrist-Rechner",
    titel: "Löschfrist-Rechner: Wann ist mein SCHUFA-Eintrag weg?",
    beschreibung: "Art des Eintrags und Daten eingeben – der Rechner nennt das taggenaue Löschdatum, mit 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz. Kostenlos.",
    h1: "Wann ist mein Eintrag weg?",
    lead: "Drei Jahre, 18 Monate oder sechs Monate – je nach Art des Eintrags und Ihrem Verhalten. Der Rechner nennt das taggenaue Datum und sagt, wann Sie den Eintrag früher angreifen können.",
    weiter: ["/eintrag-verjaehrung", "/schufa-eintrag-loeschen", "/werkzeuge/eintrag-pruefen", "/werkzeuge/verjaehrung", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Löschfrist-Rechner", pfad: "/werkzeuge/loeschfrist" }],
  },
  "/werkzeuge/verjaehrung": {
    pfad: "/werkzeuge/verjaehrung", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Verjährungs-Rechner",
    titel: "Verjährungsrechner: Ist die Forderung verjährt?",
    beschreibung: "Fälligkeit, Titel und letzte Anerkennung eingeben – der Rechner nennt das Verjährungsdatum nach BGB und formuliert die Einrede der Verjährung. Kostenlos.",
    h1: "Ist die Forderung verjährt?",
    lead: "Drei Jahre ab Jahresende – oder 30 Jahre mit Titel. Der Rechner nennt das Datum und formuliert die Einrede, die Inkassobüros nicht gern lesen.",
    weiter: ["/inkasso-brief-erhalten", "/eintrag-verjaehrung", "/werkzeuge/inkassokosten", "/werkzeuge/loeschfrist", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Verjährungs-Rechner", pfad: "/werkzeuge/verjaehrung" }],
  },
  "/werkzeuge/inkassokosten": {
    pfad: "/werkzeuge/inkassokosten", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Inkassokosten-Prüfer",
    titel: "Inkassokosten prüfen: Sind die Gebühren zu hoch?",
    beschreibung: "Hauptforderung und Inkassokosten eingeben – der Prüfer rechnet die zulässigen Gebühren nach RVG und § 13e RDG nach und formuliert die Zurückweisung.",
    h1: "Sind die Inkassokosten zu hoch?",
    lead: "Seit Oktober 2021 gelten gesetzliche Obergrenzen. Der Prüfer rechnet nach, was zulässig ist – und formuliert die Zurückweisung überhöhter Posten.",
    weiter: ["/inkasso-brief-erhalten", "/werkzeuge/verjaehrung", "/ratenzahlung-und-bonitaet", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Inkassokosten-Prüfer", pfad: "/werkzeuge/inkassokosten" }],
  },
  "/werkzeuge/kreditrechner": {
    pfad: "/werkzeuge/kreditrechner", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Kreditrechner",
    titel: "Kreditrechner: Monatsrate und Gesamtkosten berechnen",
    beschreibung: "Kostenloser Kreditrechner: Betrag, Laufzeit und Zins eingeben – Monatsrate, Gesamtkosten und Zinsanteil sofort sehen. Mit Zwei-Drittel-Zins (§ 6a PAngV).",
    h1: "Was kostet dieser Kredit wirklich?",
    lead: "Monatsrate, Gesamtkosten, Zinsanteil – und daneben die Rate zu dem Zins, den zwei Drittel der Antragsteller tatsächlich bekommen.",
    weiter: ["/werkzeuge/umschuldung", "/kredit-ohne-schufa", "/schufa-neutral-anfragen", "/werkzeuge/spielraum", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Kreditrechner", pfad: "/werkzeuge/kreditrechner" }],
  },
  "/werkzeuge/umschuldung": {
    pfad: "/werkzeuge/umschuldung", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Umschuldungsrechner",
    titel: "Umschuldungsrechner: Kredite zusammenlegen und sparen",
    beschreibung: "Kostenloser Umschuldungsrechner: Kredite und Dispo eintragen – sehen, was Weiterlaufen kostet und was Zusammenlegen spart. Mit Vorfälligkeitsentschädigung.",
    h1: "Alte Kredite: weiterzahlen oder zusammenlegen?",
    lead: "Tragen Sie ein, was läuft – der Rechner stellt beide Wege nebeneinander, einschließlich Dispo und Vorfälligkeitsentschädigung.",
    weiter: ["/werkzeuge/kreditrechner", "/werkzeuge/schulden-check", "/bonitaet-verbessern", "/werkzeuge/eintrag-pruefen", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Umschuldungsrechner", pfad: "/werkzeuge/umschuldung" }],
  },
  "/werkzeuge/schulden-check": {
    pfad: "/werkzeuge/schulden-check", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Schulden-Check",
    titel: "Schulden-Check: Bin ich überschuldet? Ehrliche Antwort",
    beschreibung: "Kostenloser Schulden-Check: Einnahmen, Ausgaben und Raten eingeben – ehrliche Einschätzung mit Schuldenquote, freiem Einkommen und den nächsten Schritten.",
    h1: "Wie ernst ist die Lage wirklich?",
    lead: "Fünf Zahlen, eine ehrliche Antwort – mit denselben Kennzahlen, die auch eine Schuldnerberatung ansetzen würde. Bei ernster Lage steht die kostenlose, staatlich anerkannte Schuldnerberatung vor jedem anderen Schritt.",
    weiter: ["/werkzeuge/umschuldung", "/werkzeuge/spielraum", "/ratenzahlung-und-bonitaet", "/inkasso-brief-erhalten", "/kontakt", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Schulden-Check", pfad: "/werkzeuge/schulden-check" }],
  },
  "/werkzeuge/spielraum": {
    pfad: "/werkzeuge/spielraum", art: "werkzeug", stand: PFEILER, prio: 0.7, werkzeug: "Spielraum-Rechner",
    titel: "Haushaltsrechner: Was bleibt Ihnen monatlich?",
    beschreibung: "Einnahmen und Fixkosten eingeben – der Rechner zeigt Ihren monatlichen Spielraum, die Fixkostenquote und was Kartenpartner daraus ablesen. Kostenlos.",
    h1: "Was bleibt im Monat?",
    lead: "Dieselbe Rechnung, die Banken mit Ihrem Kontoauszug machen – nur vorher, und nur für Sie.",
    weiter: ["/werkzeuge/karten-check", "/werkzeuge/schulden-check", "/ratenzahlung-und-bonitaet", "/kreditkarte", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Spielraum-Rechner", pfad: "/werkzeuge/spielraum" }],
  },
  "/werkzeuge/karten-check": {
    pfad: "/werkzeuge/karten-check", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Karten-Check",
    titel: "Karten-Check: Welche Kreditkarte ist realistisch?",
    beschreibung: "Fünf Angaben, eine ehrliche Einschätzung: Welcher Kartenweg heute realistisch ist – Debit, Prepaid oder Rahmen – und was den nächsten Schritt öffnet.",
    h1: "Welche Karte ist realistisch?",
    lead: "Fünf Angaben, keine Anfrage bei einer Auskunftei, keine Spur im Score – nur eine ehrliche Einordnung und der nächste Schritt.",
    weiter: ["/kreditkarte", "/girokonto-trotz-negativer-bonitaet", "/werkzeuge/spielraum", "/privatkunden", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Karten-Check", pfad: "/werkzeuge/karten-check" }],
  },


  "/werkzeuge/widerspruch": { pfad: "/werkzeuge/widerspruch", art: "werkzeug", stand: PFEILER, prio: 0.9, werkzeug: "Widerspruch-Generator",
    titel: "Löschantrag & Widerspruch gegen SCHUFA-Eintrag: Generator",
    beschreibung: "Löschantrag nach Art. 17 DSGVO und Widerspruch nach § 31 BDSG in zwei Minuten: Grund wählen, Eckdaten eintragen, zwei fertige Musterschreiben.",
    h1: "Der Löschantrag, fertig formuliert.",
    lead: "Wählen Sie, was mit dem Eintrag nicht stimmt. Das Werkzeug schreibt den Antrag an die Auskunftei und die Aufforderung an den Gläubiger – mit den richtigen Paragrafen, Fristen und der Bitte um Nachweise.",
    abschnitte: [{ h2: "Vier Gründe, die tragen", text: "Ohne zwei Mahnungen gemeldet, vor der Meldung bestritten, Löschfrist abgelaufen oder schlicht falsch – für jeden Grund den passenden Antrag mit § 31 Abs. 2 BDSG und Art. 16, 17, 21 DSGVO." }, { h2: "Zwei Schreiben, ein Ziel", text: "Die Auskunftei muss prüfen, der Gläubiger kann zurücknehmen. Beide bekommen ein Schreiben mit vierwöchiger Frist; danach steht der Weg zur Datenschutzaufsicht (Art. 77 DSGVO) offen." }],
    weiter: ["/schufa-eintrag-loeschen", "/werkzeuge/eintrag-pruefen", "/werkzeuge/loeschfrist", "/eintrag-verjaehrung", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Widerspruch-Generator", pfad: "/werkzeuge/widerspruch" }] },
  "/werkzeuge/mahnbescheid": { pfad: "/werkzeuge/mahnbescheid", art: "werkzeug", stand: PFEILER, prio: 0.9, werkzeug: "Mahnbescheid-Fristenrechner",
    titel: "Mahnbescheid-Fristenrechner: Widerspruch bis wann?",
    beschreibung: "Mahnbescheid erhalten? Zustelldatum eingeben – der Rechner nennt den letzten Tag für Widerspruch oder Einspruch (§§ 694, 700 ZPO) und die Folgen.",
    h1: "Gelber Umschlag: Bis wann muss ich reagieren?",
    lead: "Zwei Wochen ab Zustellung – taggenau gerechnet, Wochenenden und Feiertage berücksichtigt. Der Rechner sagt, welcher Tag der letzte ist, was Sie ankreuzen und was passiert, wenn Sie nichts tun.",
    abschnitte: [{ h2: "Das Gericht prüft nichts", text: "Das Mahnverfahren ist automatisiert: Es prüft nur die Form, nicht die Forderung. Deshalb kommen auch verjährte und überhöhte Forderungen als Mahnbescheid – der Widerspruch ist der einzige Hebel und kostet nichts." }, { h2: "Nach dem Widerspruch", text: "Der Gläubiger muss klagen, wenn er die Forderung will – erst dann prüft ein Gericht. Ohne Widerspruch wird die Forderung tituliert: 30 Jahre vollstreckbar und meldefähig, egal ob bestritten." }],
    weiter: ["/inkasso-brief-erhalten", "/werkzeuge/verjaehrung", "/werkzeuge/inkasso-antwort", "/werkzeuge/inkassokosten", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Mahnbescheid-Fristenrechner", pfad: "/werkzeuge/mahnbescheid" }] },
  "/werkzeuge/ratenplan": { pfad: "/werkzeuge/ratenplan", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Ratenplan-Rechner",
    titel: "Ratenzahlung vereinbaren: Rechner und Angebotsschreiben",
    beschreibung: "Forderung und Spielraum eingeben – der Rechner nennt eine Rate, die hält, und schreibt das Angebot an den Gläubiger mit Bitte um Zins- und Meldeverzicht.",
    h1: "Die Rate, die wirklich hält.",
    lead: "Gläubiger nehmen Angebote an, die tragfähig sind – nicht die höchsten. Der Rechner findet die Rate, die auch im schlechten Monat kommt, und schreibt das Angebot dazu.",
    abschnitte: [{ h2: "Sicher oder zügig", text: "Die Hälfte des Spielraums hält auch in einem schlechten Monat; 70 Prozent nur bei stabilen Einnahmen. Eine kleine Rate, die zwölfmal pünktlich kommt, baut Bonität – eine große, die zweimal platzt, zerstört sie." }, { h2: "Das Angebot mit drei Bitten", text: "Verzicht auf weitere Zinsen und Kosten, keine Meldung an Auskunfteien während der pünktlichen Zahlung, Ruhen der Beitreibung – schriftlich bestätigt, damit der Erledigt-Vermerk später belegt ist." }],
    weiter: ["/ratenzahlung-und-bonitaet", "/werkzeuge/spielraum", "/werkzeuge/inkassokosten", "/werkzeuge/schuldenplan", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Ratenplan-Rechner", pfad: "/werkzeuge/ratenplan" }] },
  "/werkzeuge/inkasso-antwort": { pfad: "/werkzeuge/inkasso-antwort", art: "werkzeug", stand: PFEILER, prio: 0.9, werkzeug: "Inkasso-Antwortbrief",
    titel: "Inkasso-Antwortbrief: bestreiten, Nachweise verlangen",
    beschreibung: "Inkassobrief erhalten? Lage wählen – der Generator schreibt die Antwort: Nachweise nach § 13a RDG, Kosten zurückweisen, Verjährung, Zahlungsbeleg.",
    h1: "Die Antwort, die das Inkasso ernst nimmt.",
    lead: "Ein Inkassobrief ist eine Behauptung mit Briefkopf. Wählen Sie, was auf Sie zutrifft – der Generator schreibt die Antwort mit den Paragrafen, die das Unternehmen kennt: Nachweise, Kostenkürzung, Verjährung oder Zahlungsbeleg.",
    abschnitte: [{ h2: "Vier Haltungen, vier Briefe", text: "Forderung unbekannt (Nachweise nach § 13a RDG), Forderung richtig aber Kosten überhöht (§ 13e RDG, BGH VIII ZR 95/18), Forderung verjährt (Einrede), bereits bezahlt (Nachweis und Erledigt-Vermerk)." }, { h2: "Immer dabei", text: "Der Widerspruch gegen jede Meldung an Auskunfteien – eine bestrittene Forderung darf nicht gemeldet werden (§ 31 Abs. 2 Nr. 4 BDSG) – und die Bitte um ausschließlich schriftliche Kommunikation." }],
    weiter: ["/inkasso-brief-erhalten", "/werkzeuge/inkassokosten", "/werkzeuge/verjaehrung", "/werkzeuge/mahnbescheid", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Inkasso-Antwortbrief", pfad: "/werkzeuge/inkasso-antwort" }] },
  "/werkzeuge/basiskonto": { pfad: "/werkzeuge/basiskonto", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Basiskonto-Helfer",
    titel: "Basiskonto abgelehnt oder keine Antwort? Der Helfer",
    beschreibung: "Basiskonto beantragt? Der Helfer rechnet die Zehn-Tage-Frist (§ 33 ZKG), nennt die zulässigen Ablehnungsgründe und den Weg zur BaFin (§ 48 ZKG).",
    h1: "Das Konto, das Ihnen zusteht.",
    lead: "Zehn Geschäftstage hat die Bank. Ein SCHUFA-Eintrag ist kein Ablehnungsgrund. Der Helfer rechnet die Frist, prüft die Begründung der Bank und bereitet die Erinnerung und den Antrag bei der BaFin vor.",
    abschnitte: [{ h2: "Nur vier Gründe erlauben eine Ablehnung", text: "Bereits ein nutzbares Konto in Deutschland, Straftat gegen die Bank in den letzten drei Jahren, früheres Konto wegen schwerer Vertragsverletzung gekündigt, Geldwäscheverstöße (§§ 35, 36 ZKG). Bonität steht nicht in dieser Liste." }, { h2: "Der Weg zur BaFin", text: "Formular „Verwaltungsverfahren nach § 48 ZKG“, kostenlos, mit Kopie des Antrags und der Ablehnung. Die BaFin ordnet die Eröffnung an, wenn die Ablehnung unrechtmäßig war – parallel lohnt der Antrag bei einer zweiten Bank." }],
    weiter: ["/girokonto-trotz-negativer-bonitaet", "/kreditkarte", "/werkzeuge/karten-check", "/werkzeuge/kartenkosten", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Basiskonto-Helfer", pfad: "/werkzeuge/basiskonto" }] },
  "/werkzeuge/pfaendungsrechner": { pfad: "/werkzeuge/pfaendungsrechner", art: "werkzeug", stand: PFEILER, prio: 0.9, werkzeug: "Pfändungsrechner",
    titel: "Pfändungsrechner 2026: Freibetrag und P-Konto-Schutz",
    beschreibung: "Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag nach § 850c ZPO und den P-Konto-Schutz. Werte ab 1. Juli 2026.",
    h1: "Was Ihnen bei einer Pfändung bleibt.",
    lead: "Die Pfändungstabelle, ohne die Tabelle: Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag und den Schutz auf dem P-Konto. Werte ab 1. Juli 2026.",
    abschnitte: [{ h2: "Die Zahlen ab 1. Juli 2026", text: "Grundbetrag 1.587,40 Euro, 597,42 Euro für die erste unterhaltsberechtigte Person, 332,83 Euro für jede weitere bis zur fünften; ab 4.866,30 Euro netto ist alles darüber voll pfändbar (Pfändungsfreigrenzenbekanntmachung 2026)." }, { h2: "P-Konto", text: "Der Grundfreibetrag gilt sofort nach der Umwandlung; Erhöhungen für Unterhalt, Kindergeld und bestimmte Sozialleistungen brauchen eine Bescheinigung (§ 903 ZPO) – die kostenlose Schuldnerberatung stellt sie aus." }],
    weiter: ["/werkzeuge/schulden-check", "/werkzeuge/ratenplan", "/werkzeuge/verjaehrung", "/inkasso-brief-erhalten", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Pfändungsrechner", pfad: "/werkzeuge/pfaendungsrechner" }] },
  "/werkzeuge/dispo-rechner": { pfad: "/werkzeuge/dispo-rechner", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Dispo-Rechner",
    titel: "Dispo-Rechner: Was der Dauer-Dispo wirklich kostet",
    beschreibung: "Dispo-Stand und Zins eingeben – der Rechner zeigt, was das Minus im Jahr kostet, was ein Ratenkredit spart und wie lange der Abbau dauert.",
    h1: "Das Minus, das jeden Monat mitläuft.",
    lead: "Rund 11 Prozent Zinsen, jeden Tag, ohne Ende – und für jede Bank das Warnsignal Nummer eins im Kontoauszug. Der Rechner zeigt, was Ihr Dispo kostet und welcher Ausstieg wie viel spart.",
    abschnitte: [{ h2: "Drei Wege nebeneinander", text: "Weiter im Minus (Zinsen ohne Ende), Ratenkredit zur Ablösung (Annuität, nur mit Konditionsanfrage), Abbau in festen Raten aus dem Spielraum – und was 50 Euro mehr im Monat ausmachen." }, { h2: "Was Banken daraus lesen", text: "Ein dauerhaft ausgereizter Dispo ist für Kartenpartner das stärkste Negativmerkmal, das keine Auskunftei zeigt. Ein Konto, das in sechs Monaten auf null geht, erzählt die Geschichte, die eine Bank sehen will." }],
    weiter: ["/bonitaet-verbessern", "/werkzeuge/umschuldung", "/werkzeuge/spielraum", "/schufa-neutral-anfragen", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Dispo-Rechner", pfad: "/werkzeuge/dispo-rechner" }] },
  "/werkzeuge/mahngebuehren": { pfad: "/werkzeuge/mahngebuehren", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Mahngebühren-Prüfer",
    titel: "Mahngebühren-Prüfer: Wie hoch dürfen Mahnkosten sein?",
    beschreibung: "Mahngebühren nachrechnen: Anzahl und Höhe eingeben – der Prüfer sagt, was nach §§ 286, 288 BGB und BGH VIII ZR 95/18 zulässig ist.",
    h1: "Mahngebühren: Was davon ist erlaubt?",
    lead: "Ein Brief kostet rund einen Euro – nicht 7,50. Der Prüfer rechnet nach, was ein Gläubiger für Mahnungen verlangen darf, und formuliert die Zurückweisung für alles darüber.",
    abschnitte: [{ h2: "Die erste Mahnung ist meist kostenlos", text: "Sie setzt erst in Verzug (§ 286 Abs. 1 BGB) – ihre Kosten sind kein Verzugsschaden. Danach zählt nur der tatsächliche Schaden: Porto, Papier, Druck. Der BGH hat 2,50 Euro Pauschale gegenüber Verbrauchern gekippt (VIII ZR 95/18)." }, { h2: "Die 40-Euro-Pauschale", text: "Gilt ausschließlich zwischen Unternehmern (§ 288 Abs. 5 BGB). In einer Mahnung an Verbraucher ist sie unzulässig – genau wie Bearbeitungs-, Kontoführungs- oder Adressermittlungsgebühren ohne Nachweis." }],
    weiter: ["/inkasso-brief-erhalten", "/werkzeuge/inkassokosten", "/werkzeuge/inkasso-antwort", "/ratenzahlung-und-bonitaet", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Mahngebühren-Prüfer", pfad: "/werkzeuge/mahngebuehren" }] },
  "/werkzeuge/kartenkosten": { pfad: "/werkzeuge/kartenkosten", art: "werkzeug", stand: PFEILER, prio: 0.8, werkzeug: "Kartenkosten-Vergleich",
    titel: "Kreditkarte mit Kaution, Prepaid oder Debit: Kostenvergleich",
    beschreibung: "Kaution, Prepaid oder Debit: Der Rechner legt Gebühren, Aufladekosten und die festliegende Kaution auf drei Jahre um und zeigt, was jede Karte kann.",
    h1: "Drei Karten, ein ehrlicher Preis.",
    lead: "Kaution, Prepaid oder Debit – die Angebote sehen alle günstig aus, bis man sie auf drei Jahre umlegt. Tragen Sie die Zahlen aus Ihren Angeboten ein; der Rechner zählt auch das Geld mit, das als Kaution stillliegt.",
    abschnitte: [{ h2: "Kosten und Können", text: "Jahresgebühr, Aufladegebühr, Bargeldgebühr, Kontoführung und der entgangene Zins auf die Kaution – über drei Jahre. Daneben, was jede Karte kann: Hotelkaution, Kreditrahmen, Meldung an Auskunfteien, Verfügbarkeit trotz Eintrag." }, { h2: "Der FIAON-Weg", text: "Erst das Girokonto mit Debitkarte – es baut die Kontohistorie. Dann die Kreditkarte mit Rahmen, wenn Auskunft und Kontoführung sie tragen. Keine Anbieternamen, keine Provision auf dieser Seite." }],
    weiter: ["/kreditkarte", "/werkzeuge/karten-check", "/girokonto-trotz-negativer-bonitaet", "/werkzeuge/basiskonto", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Kartenkosten-Vergleich", pfad: "/werkzeuge/kartenkosten" }] },
  "/werkzeuge/schuldenplan": { pfad: "/werkzeuge/schuldenplan", art: "werkzeug", stand: PFEILER, prio: 0.9, werkzeug: "Schuldenfrei-Plan",
    titel: "Schuldenfrei-Plan: Lawine oder Schneeball? Rechner",
    beschreibung: "Bis zu sechs Schulden und Ihr Budget eingeben – der Rechner simuliert Lawine und Schneeball: Monate bis schuldenfrei, Zinsen, Reihenfolge.",
    h1: "In welcher Reihenfolge werde ich schuldenfrei?",
    lead: "Teuerste Schuld zuerst oder kleinste zuerst? Der Rechner simuliert beide Wege Monat für Monat und nennt das Datum, die Zinsen und die Reihenfolge – ehrlich auch dann, wenn das Budget nicht reicht.",
    abschnitte: [{ h2: "Lawine gegen Schneeball", text: "Die Lawine (höchster Zins zuerst) spart am meisten Zinsen; der Schneeball (kleinste Schuld zuerst) liefert früh den ersten getilgten Gläubiger und hält deshalb oft besser durch. Der Rechner zeigt die Differenz in Euro und Monaten." }, { h2: "Die ehrliche Grenze", text: "Deckt das Budget die Mindestraten nicht, sagt der Rechner es – dann gehört der Fall in ein Ratenangebot an die Gläubiger und in die kostenlose, staatlich anerkannte Schuldnerberatung, nicht in eine Tabelle." }],
    weiter: ["/werkzeuge/ratenplan", "/werkzeuge/umschuldung", "/werkzeuge/dispo-rechner", "/ratenzahlung-und-bonitaet", "/werkzeuge/schulden-check", "/werkzeuge"],
    krumen: [{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Schuldenfrei-Plan", pfad: "/werkzeuge/schuldenplan" }] },

  // ═════════════════════════════════════════════════════════════════════════
  // RECHTLICHES — indexierbar, nicht beworben
  // ═════════════════════════════════════════════════════════════════════════
  "/impressum": {
    pfad: "/impressum", art: "recht", stand: "2026-08-22", prio: 0.3,
    titel: "Impressum: FIAON LTD, London — Anbieterkennzeichnung",
    beschreibung: "Anbieterkennzeichnung: FIAON LTD, 128 City Road, London, Company Registration Number 17318250, Vertretung, Kontakt und Verbraucherstreitbeilegung.",
    h1: "Impressum / Legal Notice",
    lead: "FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom. Company Registration Number 17318250. Kontakt: support@fiaon.com, Telefon +41 44 244 93 01.",
    weiter: ["/privacy", "/agb", "/widerrufsbelehrung", "/kontakt"],
    krumen: [{ name: "Impressum", pfad: "/impressum" }],
  },
  "/privacy": {
    pfad: "/privacy", art: "recht", stand: "2026-08-22", prio: 0.3,
    titel: "Datenschutzerklärung — FIAON",
    beschreibung: "Welche Daten FIAON verarbeitet, auf welcher Rechtsgrundlage, wie lange wir sie speichern und welche Rechte Sie nach der DSGVO haben – bis zur Löschung.",
    h1: "Datenschutzerklärung",
    lead: "Welche Daten wir verarbeiten, auf welcher Rechtsgrundlage, wie lange wir sie speichern und welche Rechte Sie nach der DSGVO haben.",
    weiter: ["/sicherheit", "/impressum", "/agb"],
    krumen: [{ name: "Datenschutzerklärung", pfad: "/privacy" }],
  },
  "/agb": {
    pfad: "/agb", art: "recht", stand: "2026-08-22", prio: 0.3,
    titel: "Allgemeine Geschäftsbedingungen (AGB) — FIAON",
    beschreibung: "Die Bedingungen für die Leistungen von FIAON: Vertragsschluss, Laufzeit von zwölf Monatsraten, Zahlung per SEPA, Kündigung, Widerruf und Haftung.",
    h1: "Allgemeine Geschäftsbedingungen (AGB)",
    lead: "Die Bedingungen für unsere Leistungen: Vertragsschluss, Laufzeit, Zahlung, Kündigung und Haftung – vollständig zum Nachlesen.",
    weiter: ["/widerrufsbelehrung", "/preise", "/impressum", "/privacy"],
    krumen: [{ name: "AGB", pfad: "/agb" }],
  },
  "/terms": {
    pfad: "/terms", art: "recht", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", canonical: "/agb",
    titel: "Allgemeine Geschäftsbedingungen — FIAON",
    beschreibung: "Die Bedingungen für die Nutzung dieser Website und des Kundenbereichs.",
    h1: "Allgemeine Geschäftsbedingungen",
    lead: "Die aktuelle Fassung finden Sie unter Allgemeine Geschäftsbedingungen (AGB).",
    weiter: ["/agb"],
  },
  "/widerrufsbelehrung": {
    pfad: "/widerrufsbelehrung", art: "recht", stand: "2026-08-22", prio: 0.3,
    titel: "Widerrufsbelehrung: Ihr Widerrufsrecht bei FIAON",
    beschreibung: "Ihr Widerrufsrecht als Verbraucher: Frist von 14 Tagen, Form, Folgen des Widerrufs und das Muster-Widerrufsformular – für alle Verträge mit FIAON LTD.",
    h1: "Widerrufsbelehrung",
    lead: "Ihr Widerrufsrecht als Verbraucher: Frist, Form, Folgen des Widerrufs und das Muster-Widerrufsformular.",
    weiter: ["/agb", "/impressum", "/kontakt"],
    krumen: [{ name: "Widerrufsbelehrung", pfad: "/widerrufsbelehrung" }],
  },
  "/cookie-einstellungen": {
    pfad: "/cookie-einstellungen", art: "recht", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow",
    titel: "Cookie-Einstellungen — FIAON",
    beschreibung: "Entscheiden Sie selbst, welche Cookies gesetzt werden. Notwendige Cookies lassen sich nicht abwählen, alle anderen jederzeit widerrufen.",
    h1: "Cookie-Einstellungen & Lokale Speicherung",
    lead: "Entscheiden Sie selbst, welche Cookies gesetzt werden. Notwendige Cookies lassen sich nicht abwählen, alle anderen jederzeit widerrufen.",
    weiter: ["/privacy"],
  },

  // ═════════════════════════════════════════════════════════════════════════
  // KEIN SUCHZIEL — Formulare, Konto, interne Wege (noindex, aber follow)
  // ═════════════════════════════════════════════════════════════════════════
  "/login": { pfad: "/login", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Anmelden — FIAON", beschreibung: "Melden Sie sich in Ihrem FIAON-Kundenbereich an.", h1: "Willkommen zurück.", lead: "Melden Sie sich in Ihrem FIAON-Kundenbereich an." },
  "/passwort-vergessen": { pfad: "/passwort-vergessen", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Passwort vergessen — FIAON", beschreibung: "Setzen Sie Ihr Passwort für den FIAON-Kundenbereich zurück.", h1: "Passwort zurücksetzen", lead: "Setzen Sie Ihr Passwort für den FIAON-Kundenbereich zurück." },
  "/antrag": { pfad: "/antrag", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Antrag stellen — FIAON", beschreibung: "Ihr Antrag bei FIAON in wenigen Schritten: Paket wählen, Angaben machen, Vertrag annehmen – und sofort in Ihrem Bereich.", h1: "Ihr Antrag bei FIAON", lead: "Paket wählen, wenige Angaben, Vertrag annehmen – zwei Minuten, dann ist Ihr Bereich aktiv." },
  "/business-antrag": { pfad: "/business-antrag", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Firmenantrag — FIAON Business", beschreibung: "Ihr Firmenantrag bei FIAON: Unternehmen, Rechtsform, Inhaber, Wunschrahmen – in drei Minuten.", h1: "Ihr Firmenantrag", lead: "Unternehmen, Rechtsform, Inhaber, Wunschrahmen – in drei Minuten." },
  "/bonitaet-antrag": { pfad: "/bonitaet-antrag", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Bonitätsauskunft beantragen — FIAON", beschreibung: "Beantragen Sie Ihre geprüfte Bonitätsauskunft bei FIAON.", h1: "Bonitätsauskunft beantragen", lead: "Beantragen Sie Ihre geprüfte Bonitätsauskunft bei FIAON." },
  "/bonitaet-danke": { pfad: "/bonitaet-danke", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Vielen Dank — FIAON", beschreibung: "Ihre Anfrage ist bei uns eingegangen.", h1: "Vielen Dank", lead: "Ihre Anfrage ist bei uns eingegangen." },
  "/abo-kuendigen": { pfad: "/abo-kuendigen", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Kündigung — FIAON", beschreibung: "Kündigen Sie Ihr FIAON-Abonnement.", h1: "Kündigung", lead: "Kündigen Sie Ihr FIAON-Abonnement." },
  "/karte-sichern": { pfad: "/karte-sichern", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Karte sichern — FIAON", beschreibung: "Sichern Sie sich Ihre Karte über FIAON.", h1: "Karte sichern", lead: "Sichern Sie sich Ihre Karte über FIAON." },
  "/start": { pfad: "/start", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Start — FIAON", beschreibung: "Ihr Einstieg bei FIAON.", h1: "Ihr Einstieg bei FIAON", lead: "Ihr Einstieg bei FIAON." },
  "/mein-bereich": { pfad: "/mein-bereich", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Mein Bereich — FIAON", beschreibung: "Ihr persönlicher Bereich bei FIAON.", h1: "Mein Bereich", lead: "Ihr persönlicher Bereich bei FIAON." },
  "/demo": { pfad: "/demo", art: "intern", stand: "2026-08-23", prio: 0.2, robots: "noindex,follow", titel: "Demo-Konto: der Kundenbereich, durchgespielt — FIAON", beschreibung: "Der FIAON-Kundenbereich im besten Fall – mit Platzhalterdaten – und die Sicht des Mitarbeiters im Startgespräch. Kein Login, keine echten Daten.", h1: "Das perfekte Konto, einmal durchgespielt.", lead: "So sieht FIAON aus, wenn alles läuft: ein Kunde nach vier Monaten, Auskunft ausgewertet, zwei Einträge angegangen, Kreditkarte in Sicht. Alle Namen und Zahlen sind erfunden.", weiter: ["/investoren", "/plattform-konzept"] },
  "/demo/produkt": { pfad: "/demo/produkt", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Produkt-Demo — FIAON", beschreibung: "Die Produktansicht von FIAON.", h1: "Produkt-Demo", lead: "Die Produktansicht von FIAON." },
  "/demo/kundenbereich": { pfad: "/demo/kundenbereich", art: "intern", stand: "2026-08-23", prio: 0.1, robots: "noindex,follow", titel: "Demo-Kundenbereich — FIAON", beschreibung: "Der Kundenbereich mit Platzhalterdaten.", h1: "Demo-Kundenbereich", lead: "Der Kundenbereich mit Platzhalterdaten – kein Login, keine echten Daten." },
  "/banking": { pfad: "/banking", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,follow", titel: "Girokonto trotz negativem Eintrag — FIAON", beschreibung: "Das Basiskonto steht Ihnen per Gesetz zu – auch mit Eintrag.", h1: "Girokonto", lead: "Das Basiskonto steht Ihnen per Gesetz zu – auch mit Eintrag.", canonical: "/girokonto-trotz-negativer-bonitaet" },
  "/als-kunde": { pfad: "/als-kunde", art: "intern", stand: "2026-08-25", prio: 0.1, robots: "noindex,nofollow", titel: "Kundenansicht — FIAON", beschreibung: "Interne Ansicht des Kundenbereichs für Mitarbeiter.", h1: "Kundenansicht", lead: "Interne Ansicht." },
  "/banking/dashboard": { pfad: "/banking/dashboard", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,nofollow", titel: "Investoren-Banking — FIAON", beschreibung: "Geschützter Bereich.", h1: "Investoren-Banking", lead: "Geschützter Bereich." },
  "/bonitaet-service": { pfad: "/bonitaet-service", art: "produkt", stand: "2026-08-22", prio: 0.4, canonical: "/bonitaet", titel: "Bonitäts-Auszug: Erklärung des Service — FIAON", beschreibung: "Was der Bonitäts-Auszug über FIAON leistet: Beschaffung bei SCHUFA, KSV oder CRIF, Erklärung jedes Eintrags und der nächste Schritt für jeden Eintrag.", h1: "KI-gestützte Bonitätsanalyse. Transparent. Sicher. Wirksam.", lead: "Die Erklärung des Bonitäts-Auszugs über FIAON – die aktuelle Fassung steht unter Bonitäts-Auszug.", weiter: ["/bonitaet", "/bonitaetsauskunft-beantragen"] },
  "/vereinbarung": { pfad: "/vereinbarung", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,nofollow", titel: "Vertrauliches Dokument — FIAON", beschreibung: "Diese Seite ist geschützt.", h1: "Vertrauliches Dokument", lead: "Diese Seite ist geschützt." },
  "/scp-datenraum": { pfad: "/scp-datenraum", art: "intern", stand: "2026-08-22", prio: 0.1, robots: "noindex,nofollow", titel: "Datenraum", beschreibung: "Vertraulicher Zugang.", h1: "Datenraum", lead: "Vertraulicher Zugang." },
};

// ── Die englischen Einträge entstehen aus `en` — eine Tabelle, zwei Sprachen ──
// Jede Seite mit `en` bekommt einen zweiten Eintrag unter ihrem englischen
// Pfad (sprache "en", schwester = deutscher Pfad) und trägt selbst die
// Schwester. Sitemap, Vorrenderer, Titel im Client und der Umschalter lesen
// dieselbe Tabelle; hreflang entsteht aus `schwester`.
for (const s of Object.values(SEO_SEITEN)) {
  if (!s.en || s.sprache === "en") continue;
  const { en } = s;
  SEO_SEITEN[en.pfad] = {
    pfad: en.pfad, art: s.art, stand: s.stand, prio: Math.max(0.1, Math.round((s.prio - 0.1) * 10) / 10),
    titel: en.titel, beschreibung: en.beschreibung, h1: en.h1, lead: en.lead,
    abschnitte: en.abschnitte, weiter: en.weiter, krumen: en.krumen,
    werkzeug: s.werkzeug, bild: s.bild, robots: s.robots,
    sprache: "en", schwester: s.pfad,
  };
  s.sprache = "de";
  s.schwester = en.pfad;
}

/** Die Schwesterseite in der Zielsprache — oder null, wenn es sie (noch) nicht gibt. */
export function schwesterPfad(pfad: string, ziel: "de" | "en"): string | null {
  const s = seoSeite(pfad);
  if (!s) return null;
  if ((s.sprache ?? "de") === ziel) return s.pfad;
  return s.schwester ?? null;
}

/** Die FAQ einer Seite — aus der generierten Datei, nie von Hand. */
export function seoFragen(pfad: string): SeoFrage[] {
  return SEO_FRAGEN[pfad] ?? [];
}

export { SEO_GLOSSAR };

/** Alle Seiten, die in die Sitemap gehören: indexierbar und ohne fremde Canonical. */
export function seoIndexierbar(): SeoSeite[] {
  return Object.values(SEO_SEITEN).filter((s) => !String(s.robots ?? "").includes("noindex") && !s.canonical && !s.eigenerVorrenderer);
}

/** Pfad → Seite, mit Normalisierung (Schrägstrich am Ende, Kleinschreibung). */
export function seoSeite(pfad: string): SeoSeite | null {
  const p = (pfad.split("?")[0].replace(/\/+$/, "") || "/").toLowerCase();
  return SEO_SEITEN[p] ?? null;
}
