// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ANZEIGEN-LANDINGPAGES (19.09.2026, E-191)
//
// Eine Seite je Anzeigengruppe, nicht im Index (noindex,follow): Die
// Überschrift wiederholt die Suchanfrage, der Preis steht oben, der
// Kalender gleich darunter, das Menü fehlt. Google bewertet die Seite hinter
// einer Anzeige nach Relevanz, Transparenz und Tempo — alle drei sind hier
// Absicht.
//
// ── DIE GRENZE DER ANZEIGEN (Google-Richtlinie, geprüft 19.09.2026) ───────
// In Deutschland — und seit dem 23.07.2026 auch in Österreich — verlangt
// Google für Anzeigen zu Banking, Kreditkarten und Krediten eine Zulassung
// der Finanzaufsicht (Financial Services Verification). FIAON hat keine.
// Deshalb werben die Landingpages NUR für Gründung, Steuernummern, Pflichten
// und die Tochtergesellschaft; Konto, Karten und Kapitalrahmen stehen hier
// nicht im Blickfang. Sie bleiben der normalen Suche vorbehalten
// (/business/firmenkarten-kapital, /business/us-geschaeftskonto).
//
// E-509 (12.11.2026): EIN Produkt statt vier Pakete. Die Seiten nennen den einen Preis (EIN_PRODUKT) und sagen offen,
// dass mit der Eintragung das Erfolgshonorar fällig wird — ohne Kapital, Bürgschaft oder Finanzierung in den Blickfang
// zu stellen (Grenze der Anzeigen, siehe oben). Der Knopf führt zum Konfigurator.
// ═══════════════════════════════════════════════════════════════════════════
import type { GlobalLandingpage } from "./typen";
import { EIN_PRODUKT } from "./ein-produkt";

const P = EIN_PRODUKT.de;
/** Der Preis-Satz der Anzeigenseiten: der eine Preis, und offen gesagt, dass mit der Eintragung das Erfolgshonorar folgt. */
const preis = `Mit Ihrem Auftrag ${P.preis}, erstes Jahr inklusive; das Erfolgshonorar mit der Eintragung zeigt Ihnen der Konfigurator.`;

const GRUND_FRAGEN = [
  // E-466 (30.10.2026): ohne „Team vor Ort in Miami“ — die Einreichung läuft über Partner, die ITIN über einen zertifizierten Acceptance Agent (E-422).
  { f: "Muss ich dafür in die USA reisen?", a: "In der Regel nicht. Sie unterschreiben digital, wir bereiten alles vor und reichen über unsere Partner ein. Verlangt ein Institut ausnahmsweise einen persönlichen Termin, planen wir ihn rechtzeitig mit Ihnen." },
  { f: "Was ist im Preis enthalten?", a: "Staatliche Gründungsgebühren, Registered Agent, US-Adresse, Telefonnummer und Assistenz im ersten Jahr, die Anträge für EIN und ITIN sowie die Honorare von Partner-Anwalt und US-CPA für die Leistungen Ihres Auftrags." },
  { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD in London, eingetragen im Companies House unter der Nummer 17318250. Vertrag und Rechnung erhalten Sie direkt nach der Unterschrift." },
  { f: "Ist eine US-Gesellschaft ein Steuermodell?", a: "Nein. Wird sie aus Deutschland, Österreich oder der Schweiz geführt, ist sie in der Regel dort steuerpflichtig. Das prüft unser Partner-Steuerberater vor der Gründung." },
];

export const LANDINGPAGES: GlobalLandingpage[] = [
  {
    pfad: "/business/lp/us-firmengruendung",
    quelle: "/business/us-firmengruendung",
    seo: { titel: "US-Firmengründung aus einer Hand — FIAON Global", beschreibung: "Ihre LLC in den USA gründen — mit EIN, ITIN, Registered Agent und einem festen Ansprechpartner. Ein Auftrag, erstes Jahr inklusive." },
    auge: "US-Firmengründung",
    h1: "US-Firmengründung aus einer Hand.",
    h1b: "Ihre LLC — ein Ansprechpartner, ein Auftrag.",
    lead: `Wir gründen Ihre US-Gesellschaft, beantragen EIN und ITIN und stellen Registered Agent, Adresse und Telefonnummer — aus Deutschland, Österreich oder der Schweiz, in der Regel ohne Reise. ${preis}`,
    vorteile: [
      "Gründung, EIN und ITIN, Registered Agent, US-Adresse und Telefon im ersten Jahr",
      "Partner-Anwalt und US-CPA im Preis",
      // E-466/E-233: „ein Ansprechpartner“, nicht „ein Vertrag“; „Geld zurück“ steht mit Bedingungen im Merkblatt daneben.
      "Ein fester Ansprechpartner statt acht Anlaufstellen",
      "In der Regel ohne Reise und ohne Wohnsitz in den USA",
    ],
    paket: "global_struktur",
    fragen: GRUND_FRAGEN,
  },
  {
    pfad: "/business/lp/tochtergesellschaft",
    quelle: "/business/tochtergesellschaft-usa",
    seo: { titel: "Tochtergesellschaft in den USA — FIAON Global", beschreibung: "Ihre US-Tochter aus einer Hand: Gründung, EIN, erste US-Meldung, abgestimmt mit Ihrem Steuerberater. Ein Auftrag, ein fester Ansprechpartner." },
    auge: "US-Tochtergesellschaft",
    h1: "Ihre Tochtergesellschaft in den USA.",
    h1b: "Gegründet, gemeldet, vorbereitet.",
    lead: `Für Unternehmer mit echtem US-Geschäft: Wir gründen Ihre US-Gesellschaft, holen die EIN, lassen die erste US-Meldung von unserem US-CPA erstellen und stimmen alles mit Ihrem Steuerberater ab. ${preis}`,
    vorteile: [
      "Gründung, EIN und erste US-Meldung aus einer Hand",
      "Operating Agreement durch unseren Partner-Anwalt",
      "Abgestimmt mit Ihrem Steuerberater",
      "Ein fester Ansprechpartner für Termine und Einreichungen",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Kann meine GmbH Gesellschafterin der US-Gesellschaft sein?", a: "Im Auftrag am Bildschirm werden Sie persönlich Gesellschafter. Soll Ihre GmbH die Anteile halten, stimmen wir das vorab im Gespräch mit Ihnen ab." },
      ...GRUND_FRAGEN,
    ],
  },
  {
    pfad: "/business/lp/ein-itin",
    quelle: "/business/ein-itin",
    seo: { titel: "EIN und ITIN beantragen lassen — FIAON Global", beschreibung: "EIN für Ihre US-Gesellschaft, ITIN für Sie: Anträge vorbereitet und eingereicht, steuerlicher Grund vorab geprüft. In Ihrem Auftrag enthalten." },
    auge: "EIN und ITIN",
    h1: "EIN und ITIN beantragen.",
    h1b: "Vorbereitet, eingereicht, verfolgt.",
    lead: `Die EIN für Ihre US-Gesellschaft, die ITIN für Sie persönlich: Wir klären den steuerlichen Grund, bereiten beide Anträge vor, reichen sie bei der IRS ein und verfolgen sie bis zum Bescheid. ${preis}`,
    vorteile: [
      "EIN ohne US-Sozialversicherungsnummer, schriftlich mit Formular SS-4",
      "ITIN mit Formular W-7 — Ihr Pass muss nicht in die USA",
      "Steuerlicher Grund vorab durch unseren US-CPA geprüft",
      "Zusammen mit Gründung und Registered Agent in einem Auftrag",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Brauche ich eine US-Sozialversicherungsnummer für die EIN?", a: "Nein. Ohne US-Steuernummer wird die EIN schriftlich mit Formular SS-4 beantragt — das übernehmen wir." },
      { f: "Muss ich meinen Pass in die USA schicken?", a: "Nein. Unser zertifizierter Acceptance-Agent-Partner im DACH-Raum prüft Ihren Pass persönlich oder im Videotermin." },
      ...GRUND_FRAGEN,
    ],
  },
  {
    pfad: "/business/lp/us-pflichten",
    quelle: "/business/us-pflichten",
    seo: { titel: "Form 5472 und US-Pflichten — FIAON Global", beschreibung: "Form 5472 mit Form 1120, Jahresmeldung, Registered Agent: die US-Meldungen Ihrer Gesellschaft — die erste erstellt unser US-CPA, im Preis enthalten." },
    auge: "US-Pflichten",
    h1: "Form 5472 und US-Pflichten.",
    h1b: "Im Kalender, nicht im Hinterkopf.",
    lead: `Jede US-Gesellschaft mit ausländischem Gesellschafter meldet der IRS jährlich Form 5472 — auch ohne Umsatz. Unser US-CPA erstellt die erste Meldung, und Sie kennen jede Frist vorab. ${preis}`,
    vorteile: [
      "Form 5472 mit Form 1120 durch unseren US-CPA — im ersten Jahr im Preis enthalten",
      "Alle Fristen für IRS, Bundesstaat und Registered Agent vorab genannt",
      "Meldung zu Hause vorbereitet für Ihren Steuerberater",
      "Ein Ansprechpartner für alle Fristen",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Muss ich Form 5472 auch ohne Umsatz abgeben?", a: "Ja. Die Pflicht hängt nicht am Umsatz, sondern daran, dass die Gesellschaft einem ausländischen Gesellschafter gehört." },
      ...GRUND_FRAGEN,
    ],
  },
];
