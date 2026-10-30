// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — ANZEIGEN-LANDINGPAGES (19.09.2026, E-191)
//
// Eine Seite je Anzeigengruppe, nicht im Index (noindex,follow): Die
// Überschrift wiederholt die Suchanfrage, der Festpreis steht oben, der
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
// ═══════════════════════════════════════════════════════════════════════════
import { globalPreisText } from "../fiaon-global";
import type { GlobalLandingpage } from "./typen";

const ab = `ab ${globalPreisText("global_struktur")}`;

const GRUND_FRAGEN = [
  // E-466 (30.10.2026): ohne „Team vor Ort in Miami“ — die Einreichung läuft über Partner, die ITIN über einen zertifizierten Acceptance Agent (E-422).
  { f: "Muss ich dafür in die USA reisen?", a: "In der Regel nicht. Sie unterschreiben digital, wir bereiten alles vor und reichen über unsere Partner ein. Verlangt ein Institut ausnahmsweise einen persönlichen Termin, planen wir ihn rechtzeitig mit Ihnen." },
  { f: "Was ist im Festpreis enthalten?", a: "Staatliche Gründungsgebühren, Registered Agent, US-Adresse und Telefon im ersten Jahr, die Anträge für EIN und ITIN sowie die Honorare von Partner-Anwalt, Partner-Steuerberater und US-CPA für die Leistungen Ihres Pakets." },
  { f: "Wer ist mein Vertragspartner?", a: "Die FIAON LTD in London, eingetragen im Companies House unter der Nummer 17318250. Vertrag und Rechnung erhalten Sie direkt nach der Unterschrift." },
  { f: "Ist eine US-Gesellschaft ein Steuermodell?", a: "Nein. Wird sie aus Deutschland, Österreich oder der Schweiz geführt, ist sie in der Regel dort steuerpflichtig. Das prüft unser Partner-Steuerberater vor der Gründung." },
];

export const LANDINGPAGES: GlobalLandingpage[] = [
  {
    pfad: "/business/lp/us-firmengruendung",
    quelle: "/business/us-firmengruendung",
    seo: { titel: "US-Firmengründung zum Festpreis — FIAON Global", beschreibung: "LLC oder Corporation in den USA gründen — mit EIN, ITIN, Registered Agent und einem festen Ansprechpartner. Festpreis, erstes Jahr inklusive." },
    auge: "US-Firmengründung",
    h1: "US-Firmengründung zum Festpreis.",
    h1b: "LLC oder Corporation — ein Ansprechpartner, ein Festpreis.",
    lead: `Wir gründen Ihre US-Gesellschaft, beantragen EIN und ITIN und stellen Registered Agent, Adresse und Telefonnummer — aus Deutschland, Österreich oder der Schweiz, in der Regel ohne Reise. ${ab}, erstes Jahr inklusive.`,
    vorteile: [
      "Gründung, EIN und ITIN, Registered Agent, US-Adresse und Telefon im ersten Jahr",
      "Partner-Anwalt, Partner-Steuerberater und US-CPA im Festpreis",
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
    seo: { titel: "Tochtergesellschaft in den USA — FIAON Global", beschreibung: "Ihre US-Tochter aus einer Hand: Gründung, EIN, erste US-Meldung, abgestimmt mit Ihrem Steuerberater. Festpreis, ein fester Ansprechpartner." },
    auge: "US-Tochtergesellschaft",
    h1: "Ihre Tochtergesellschaft in den USA.",
    h1b: "Gegründet, gemeldet, vorbereitet.",
    lead: `Für Unternehmen mit echtem US-Geschäft: Wir gründen Ihre US-Tochter, holen die EIN, lassen die erste US-Meldung von unserem US-CPA erstellen und stimmen alles mit Ihrem Steuerberater ab. ${ab}, alle Gebühren inklusive.`,
    vorteile: [
      "Ihre GmbH, AG oder Holding als Gesellschafterin",
      "Prüfung vor der Gründung durch unseren Partner-Steuerberater",
      "Operating Agreement oder Satzung durch unseren Partner-Anwalt",
      "Ein fester Ansprechpartner für Termine und Einreichungen",
    ],
    paket: "global_struktur",
    fragen: [
      { f: "Kann meine GmbH Gesellschafterin der US-Gesellschaft sein?", a: "Ja. Wir benötigen dann den Registerauszug der Muttergesellschaft und die Pässe der Geschäftsführung." },
      ...GRUND_FRAGEN,
    ],
  },
  {
    pfad: "/business/lp/ein-itin",
    quelle: "/business/ein-itin",
    seo: { titel: "EIN und ITIN beantragen lassen — FIAON Global", beschreibung: "EIN für Ihre US-Gesellschaft, ITIN für Sie: Anträge vorbereitet und eingereicht, steuerlicher Grund vorab geprüft. In jedem Paket enthalten." },
    auge: "EIN und ITIN",
    h1: "EIN und ITIN beantragen.",
    h1b: "Vorbereitet, eingereicht, verfolgt.",
    lead: `Die EIN für Ihre US-Gesellschaft, die ITIN für Sie persönlich: Wir klären den steuerlichen Grund, bereiten beide Anträge vor, reichen sie bei der IRS ein und verfolgen sie bis zum Bescheid. In jedem Paket enthalten, ${ab}.`,
    vorteile: [
      "EIN ohne US-Sozialversicherungsnummer, schriftlich mit Formular SS-4",
      "ITIN mit Formular W-7 — Ihr Pass muss nicht in die USA",
      "Steuerlicher Grund vorab durch unseren US-CPA geprüft",
      "Zusammen mit Gründung und Registered Agent zum Festpreis",
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
    seo: { titel: "Form 5472 und US-Pflichten — FIAON Global", beschreibung: "Form 5472 mit Form 1120, Jahresmeldung, Registered Agent: die US-Meldungen Ihrer Gesellschaft — die erste erstellt unser US-CPA im Festpreis." },
    auge: "US-Pflichten",
    h1: "Form 5472 und US-Pflichten.",
    h1b: "Im Kalender, nicht im Hinterkopf.",
    lead: `Jede US-Gesellschaft mit ausländischem Gesellschafter meldet der IRS jährlich Form 5472 — auch ohne Umsatz. Unser US-CPA erstellt die erste Meldung, und Sie kennen jede Frist vorab. ${ab}, alle Gebühren inklusive.`,
    vorteile: [
      "Form 5472 mit Form 1120 durch unseren US-CPA — im ersten Jahr im Festpreis",
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
