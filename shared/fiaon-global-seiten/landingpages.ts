// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ANZEIGEN-LANDINGPAGES (19.09.2026, E-191)
//
// Eine Seite je Anzeigengruppe, nicht im Index (noindex,follow): Die
// Überschrift wiederholt die Suchanfrage, das Honorar steht oben, der
// Kalender gleich darunter, das Menü fehlt. Google bewertet die Seite hinter
// einer Anzeige nach Relevanz, Offenheit und Ladezeit — alle drei sind hier
// Absicht.
//
// ── DIE GRENZE DER ANZEIGEN (Google-Richtlinie, geprüft 19.09.2026) ───────
// In Deutschland — und seit dem 23.07.2026 auch in Österreich — verlangt
// Google für Anzeigen zu Banking, Kreditkarten und Krediten eine Zulassung
// der Finanzaufsicht (Financial Services Verification). FIAON hat keine.
// Deshalb werben die Landingpages NUR für Gründung, Steuernummern, Pflichten
// und die Tochtergesellschaft; Konto, Karten und Kapitalrahmen stehen in
// KEINEM Text dieser Datei (scripts/pruef-global-seiten.ts, Abschnitt
// „Landingpages“, hält jedes Feld dagegen). Sie bleiben der normalen Suche
// vorbehalten (/business/firmenkarten-kapital, /business/us-geschaeftskonto).
//
// E-509 (12.11.2026): EIN Produkt statt vier Pakete; der Knopf führt zum Honorarrechner.
//
// E-510 (13.11.2026) — Wortlaut nach dem Sprachleitfaden (Abschnitt 7.6):
//   · Kopf: die Suchanfrage als H1, danach was wir tun und wer entscheidet. Fünf Zeilen Leistung.
//   · „beantragen“ statt „holen“; „US-Steuerberater (CPA) aus unserem Partnernetz“ statt eines eigenen;
//     kein Satz, der einen Partner bei der Arbeit zeigt, solange der Beleg offen ist (Leitfaden 5.11).
//   · KEIN Honorar-Betrag und kein Honorar-Satz in dieser Datei. Der Honorar-Satz der Landingpages (Leitfaden 7.6,
//     weitererSatz("HONORAR-LANDINGPAGE")) nennt den Kapitalrahmen — und genau dieses Wort sperrt die
//     Anzeigen-Grenze oben in jedem Feld dieser Datei. Der Satz steht deshalb im Abschnitt „Honorar“ der
//     Seitenvorlage (client/src/pages/site/global-lp.tsx), unterhalb des Blickfangs, nie in Kopf, Liste oder Fragen.
//   · Feste Sätze kommen aus shared/fiaon-global-saetze.ts und werden hier nie neu getippt.
// Es gibt keine englischen Landingpages (die Anzeigen laufen deutsch).
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalLandingpage } from "./typen";
import { satz, sechsSchritte, vertrauensBand, vierSchritte, weitererSatz } from "../fiaon-global-saetze";

// ── Feste Wortlaute (shared/fiaon-global-saetze.ts) ──────────────────────────
const [SCHRITT_1, SCHRITT_2] = sechsSchritte("de").schritte;
/** Was wir bei der Gründung tun, und wer entscheidet (Kurzfassung, Platz 1). */
const GRUENDUNG = vierSchritte("de").schritte[0].text;
/** Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde. */
const BEHOERDEN = satz("S3", "de");
/** Was der Klient selbst tut (Schritt 1 und 2). */
const IHR_TEIL = `${SCHRITT_1.ihrTeil} ${SCHRITT_2.ihrTeil}`;
const BAND = vertrauensBand("de");
const bandZeile = (art: "register" | "vertrag"): string => BAND.find((z) => z.art === art)?.text ?? "";

const GRUND_FRAGEN = [
  { f: "Was ist im ersten Jahr enthalten?", a: `Die Anmeldung beim Bundesstaat samt Staatsgebühr, Operating Agreement, Registered Agent, US-Geschäftsadresse und US-Telefonnummer, die Anträge für EIN und ITIN (die ITIN nach unserem ITIN-Check) und die erste jährliche US-Meldung. ${weitererSatz("UEBERGANG-ASSISTENZ", "de")}` },
  { f: "Wer ist mein Vertragspartner?", a: `${bandZeile("register")}. ${bandZeile("vertrag")}.` },
  { f: "Ist eine US-Gesellschaft ein Steuermodell?", a: `Nein. ${satz("S10", "de")} ${weitererSatz("ROLLEN", "de")}` },
  // E-466 (30.10.2026): ohne eigenes Team in den USA — die Einreichung läuft über Partner.
  { f: "Muss ich dafür in die USA reisen?", a: `Für die Gründung und die Steuernummer Ihrer Gesellschaft nicht. ${IHR_TEIL} ${weitererSatz("UEBERGANG-EINREICHUNG", "de")}` },
];

export const LANDINGPAGES: GlobalLandingpage[] = [
  {
    pfad: "/business/lp/us-firmengruendung",
    quelle: "/business/us-firmengruendung",
    seo: { titel: "US-Firmengründung in einem Mandat — FIAON Global", beschreibung: "Ihre US-LLC in einem Mandat: Anmeldung beim Bundesstaat, Steuernummern, Registered Agent, Pflichtenkalender. Honorar vorab; Vertrag vor der Unterschrift." },
    auge: "US-Firmengründung",
    h1: "US-Firmengründung.",
    h1b: "Ein Mandat, ein Ansprechpartner.",
    lead: GRUENDUNG,
    vorteile: [
      "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
      "Anträge für EIN und ITIN — die ITIN nach unserem ITIN-Check",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      "Pflichtenkalender und die erste jährliche US-Meldung im ersten Jahr",
      "Ein fester Ansprechpartner statt acht Anlaufstellen",
    ],
    paket: "global_struktur",
    fragen: GRUND_FRAGEN,
  },
  {
    pfad: "/business/lp/tochtergesellschaft",
    quelle: "/business/tochtergesellschaft-usa",
    seo: { titel: "US-Tochtergesellschaft gründen lassen — FIAON Global", beschreibung: "US-Tochtergesellschaft in einem Mandat: Gründung, EIN, erste US-Meldung, Unterlagen für Ihren Steuerberater. Honorar vorab; Vertrag vor der Unterschrift." },
    auge: "US-Tochtergesellschaft",
    h1: "Tochtergesellschaft in den USA.",
    h1b: "Gegründet und gemeldet in einem Mandat.",
    lead: `Für Unternehmen mit tatsächlichem US-Geschäft: Wir gründen Ihre US-Gesellschaft, beantragen die EIN und bereiten die Unterlagen für Ihren Steuerberater vor. ${BEHOERDEN}`,
    vorteile: [
      "Gründung, EIN und die erste jährliche US-Meldung in einem Mandat",
      "Operating Agreement und Gründungsunterlagen",
      "Abstimmung mit Ihrem Steuerberater im Wohnsitzland",
      "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
      "Ein fester Ansprechpartner für Termine und Einreichungen",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Kann meine GmbH Gesellschafterin der US-Gesellschaft sein?", a: "Ja, nach Abstimmung. Im Honorarrechner werden Sie persönlich Gesellschafter. Soll Ihre GmbH die Anteile halten, stimmen wir das vorab im Gespräch mit Ihnen ab." },
      ...GRUND_FRAGEN,
    ],
  },
  {
    pfad: "/business/lp/ein-itin",
    quelle: "/business/ein-itin",
    seo: { titel: "EIN und ITIN beantragen lassen — FIAON Global", beschreibung: "EIN für Ihre US-Gesellschaft, ITIN für Sie: Anträge vorbereitet und eingereicht, die ITIN nach unserem ITIN-Check. Es entscheidet die US-Steuerbehörde." },
    auge: "EIN und ITIN",
    h1: "EIN und ITIN beantragen.",
    h1b: "Vorbereitet, eingereicht, verfolgt.",
    lead: `Wir bereiten die Anträge für die EIN Ihrer US-Gesellschaft und für Ihre persönliche ITIN vor, reichen sie ein und verfolgen sie bis zum Bescheid. ${SCHRITT_2.bedingung}`,
    vorteile: [
      "EIN ohne US-Sozialversicherungsnummer, schriftlich mit Formular SS-4",
      "ITIN mit Formular W-7 — Ihr Reisepass muss nicht in die USA",
      "ITIN-Check vorab: Wir klären, ob die Voraussetzungen vorliegen",
      "Zusammen mit Gründung und Registered Agent in einem Mandat",
      "Ein fester Ansprechpartner bis zum Bescheid",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Brauche ich eine US-Sozialversicherungsnummer für die EIN?", a: "Nein. Ohne US-Steuernummer wird die EIN schriftlich mit Formular SS-4 beantragt — das übernehmen wir." },
      { f: "Muss ich meinen Pass in die USA schicken?", a: "Nein. Den Nachweis Ihrer Identität organisieren wir mit Ihnen; Ihren Reisepass müssen Sie nicht in die USA schicken." },
      ...GRUND_FRAGEN,
    ],
  },
  {
    pfad: "/business/lp/us-pflichten",
    quelle: "/business/us-pflichten",
    seo: { titel: "Form 5472 und US-Pflichten — FIAON Global", beschreibung: "Form 5472 mit Form 1120, Jahresmeldung, Registered Agent: die US-Pflichten Ihrer Gesellschaft in einem Mandat. Jede Frist steht im Pflichtenkalender." },
    auge: "US-Pflichten",
    h1: "Form 5472 und US-Pflichten.",
    h1b: "Jede Frist im Pflichtenkalender.",
    lead: "Jede US-Gesellschaft mit ausländischem Gesellschafter meldet der IRS jährlich Form 5472 — auch ohne Umsatz. Die erste jährliche US-Meldung ist im ersten Jahr Ihres Mandats enthalten, und jede Frist steht in Ihrem Pflichtenkalender.",
    vorteile: [
      "Form 5472 mit Form 1120: die erste jährliche US-Meldung im ersten Jahr enthalten",
      "Steuern: US-Steuerberater (CPA) aus unserem Partnernetz, in eigener Verantwortung",
      "Fristen für IRS, Bundesstaat und Registered Agent in Ihrem Pflichtenkalender",
      "Meldung im Wohnsitzland vorbereitet für Ihren Steuerberater",
      "Ein fester Ansprechpartner für alle Fristen",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Muss ich Form 5472 auch ohne Umsatz abgeben?", a: "Ja. Die Pflicht hängt nicht am Umsatz, sondern daran, dass die Gesellschaft einem ausländischen Gesellschafter gehört." },
      ...GRUND_FRAGEN,
    ],
  },
];
