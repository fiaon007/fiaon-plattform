// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL AM TELEFON — WAS DER VERTRIEB SAGT UND SCHREIBT (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Das Firmen-Cockpit (/agent/firmen) verkaufte bis heute die Business-Abos:
// Leitfaden, Info-Mail und KI-Vorbereitung sprachen von Firmen-Bonität,
// Creditreform und „Geschäftspaketen ab 39,99 € im Monat". Seit E-188 verkauft
// das Cockpit FIAON Global — und bei FIAON Global ist die Wortwahl kein
// Geschmack, sondern die Grenze zur Abmahnung (05_Vision/
// B2B_GLOBAL_MODELL_2026-09-17/garantie-recht.txt): kein Rahmen, keine Karte,
// kein Zinssatz, keine Frist, keine Bank als Zusage; Steuer und Recht nur über
// Steuerberater und Anwälte auf eigenes Mandat.
//
// Deshalb stehen die drei Texte des Cockpits HIER, an einer Stelle, und nicht
// verteilt auf eine Client-Datei und zwei Server-Routen:
//   · der Leitfaden (Oberfläche),
//   · die Info-Mail nach dem Gespräch (Server, Versand wie bisher über das
//     Dienstkonto),
//   · die Anweisung für die KI-Vorbereitung (Server).
// Preise kommen aus dem Katalog, Leistungs- und Pflichtsätze aus
// shared/fiaon-global.ts. scripts/pruef-pakete.ts schickt jeden KUNDENSATZ
// dieser Datei durch die Wortwand (shared/fiaon-wortverbote.ts).
// ═══════════════════════════════════════════════════════════════════════════
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK,
  globalKatalog, globalPreisText,
} from "./fiaon-global";
import { GLOBAL_GESPRAECH_URL, GLOBAL_SEITE_URL, globalStartUrl } from "./fiaon-global-wege";

/** „Global Struktur 2.499 €, Global Banking 4.999 €, …" — aus dem Katalog. */
export function globalPreisZeile(): string {
  return GLOBAL_PAKETE.map((g) => `${g.de.name} ${globalPreisText(g.key)}`).join(", ");
}

// ── DER LEITFADEN ───────────────────────────────────────────────────────────
export interface LeitfadenSatz {
  text: string;
  /**
   * true = ein Satz, den der Mitarbeiter dem KUNDEN sagt (Sie-Form, passiert
   * die Wortwand). false = eine Anweisung an den Mitarbeiter (Du-Form; darf
   * die verbotenen Wörter NENNEN, um sie zu verbieten).
   */
  kunde: boolean;
}
export interface LeitfadenBlock { t: string; s: LeitfadenSatz[] }

const k = (text: string): LeitfadenSatz => ({ text, kunde: true });
const intern = (text: string): LeitfadenSatz => ({ text, kunde: false });

export function globalLeitfaden(): LeitfadenBlock[] {
  return [
    { t: "Der Öffner (10 Sekunden)", s: [
      k("„Guten Tag, [Name] von FIAON — ich halte Sie kurz: Wir bauen für Unternehmen aus Deutschland, Österreich und der Schweiz die US-Gesellschaft auf — Gründung, Steuernummern, Bank- und Kartenbeziehung, mit einem eigenen Team vor Ort in den USA. Darf ich Ihnen in einem Satz sagen, für wen das passt?“"),
      k("„Es passt zu Betrieben, die in den USA Kunden, Lieferanten, Projekte oder Kapitalbedarf haben — und zu Inhabern, die ein zweites Standbein mit eigener Bank- und Kartenhistorie aufbauen wollen.“"),
    ]},
    { t: "Drei Einstiege (den passenden wählen)", s: [
      k("US-BEZUG: „Haben Sie heute schon Kunden, Lieferanten oder Werbekonten in den USA — und wickeln Sie das alles über Ihr Konto hier ab?“"),
      k("ZWEITES STANDBEIN: „Eine US-Gesellschaft baut ihre eigene Historie bei US-Instituten auf. Das braucht Monate, nicht Tage — deshalb fängt man an, bevor man sie braucht.“"),
      k("AUS EINER HAND: „Hinter so einer Struktur stehen Gründungsagenten, Steuerberater, Anwälte und Banken. Bei uns führen Sie ein Gespräch, nicht zwölf — ein Ansprechpartner koordiniert alle.“"),
    ]},
    { t: "Was FIAON Global konkret tut (ehrlich, ohne Übertreibung)", s: [
      k("„Wir gründen die Gesellschaft mit unserem Team vor Ort, bereiten EIN und ITIN vor und reichen sie ein, stellen US-Geschäftsadresse, US-Telefonnummer, Registered Agent und Dokumentenraum — und bereiten jeden Konto- und Kartenantrag vollständig vor.“"),
      intern("NIE zusagen oder andeuten: eine Karte, ein Konto, einen Rahmen oder Dollarbetrag, einen Zinssatz, eine Frist, eine Steuerersparnis, ein Darlehen. KEINE Banknamen. Die Dollar-Zahl am Paket ist der Kapitalrahmen, den der Kunde anstrebt — kein Ergebnis, auch beim VIP-Paket („bis zu 1.000.000 $“) nicht. Über Konto, Karte und Rahmen entscheidet allein das Institut."),
      intern("Steuer und Recht beantwortest du NICHT — auch nicht „nur kurz“. Dein Satz dafür steht bei den Einwänden."),
      intern("Diese drei Sätze sagst du IMMER, bevor jemand beauftragt:"),
      ...GLOBAL_PFLICHTHINWEIS.de.map((h) => k(`„${h}“`)),
    ]},
    { t: "Einwände", s: [
      k(`„Was kostet das?“ — „Es ist ein Einmalpreis, kein Abo: ${globalPreisZeile()}. ${GLOBAL_ROLLEN.de.kosten}“`),
      k("„Bekomme ich dann sicher eine Karte mit hohem Rahmen?“ — „Das sagt Ihnen niemand seriös zu. Über Konto, Karte und Rahmen entscheidet allein das Institut. Was wir zusagen, ist unsere eigene Leistung: vollständige Unterlagen, saubere Anträge und ein Team, das den Ablauf kennt.“"),
      k("„Spare ich damit Steuern?“ — „Nein. Eine US-Gesellschaft, die von hier geführt wird, bleibt hier steuerpflichtig. Es geht um Zugang zu US-Banken und US-Kunden, nicht um einen niedrigeren Steuersatz. Die Einzelheiten klärt der Steuerberater aus unserem Partnernetz mit Ihnen — auf Ihr Mandat, das Honorar trägt FIAON.“"),
      k("„Muss ich in die USA reisen?“ — „In der Regel nicht. Unser Team vor Ort nimmt die Termine wahr. Wer den Auftakt persönlich erleben möchte, wählt Global VIP.“"),
      k(GLOBAL_GELD_ZURUECK.aktiv
        ? `„Seriös?“ — „Prüfen Sie uns an drei Punkten: Wir sagen keine Bankentscheidung zu. Steuerberater und Anwälte arbeiten auf Ihr Mandat, ihre Honorare sind im Festpreis enthalten. Und: ${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}“`
        : "„Seriös?“ — „Prüfen Sie uns an zwei Punkten: Wir sagen keine Bankentscheidung zu, und Steuerberater und Anwälte arbeiten auf Ihr Mandat, ihre Honorare sind im Festpreis enthalten.“"),
    ]},
    { t: "Der Abschluss", s: [
      k("„Ich schicke Ihnen jetzt die kurze Info-Mail mit den Paketen und dem Weg zum Auftrag. Möchten Sie direkt beauftragen — oder machen wir einen festen Gesprächstermin?“"),
      intern("Zwei Wege, beide gut: der Auftragslink (der Kunde wählt das Paket, unterschreibt den Vertrag selbst und überweist auf Rechnung — der Zahlungseingang ist der Start) oder der Termin. Termin > vage Zusage. Wer zögert: Termin-Knopf, morgen früh."),
    ]},
  ];
}

// ── DIE INFO-MAIL NACH DEM GESPRÄCH ─────────────────────────────────────────
// Reiner Text, Sie-Form, passiert die Wortwand. Versendet wird sie wie bisher
// von der Route /agent/firmen/:id/mail über das Dienstkonto (höchstens eine je
// Firma je sieben Tage, Frequenzbremse) — hier steht nur, WAS drinsteht.
export function globalInfoMail(opts: { ansprechpartner?: string | null; firma: string; agentName: string }): { betreff: string; text: string } {
  const anrede = opts.ansprechpartner ? `Guten Tag ${String(opts.ansprechpartner).trim()},` : "Guten Tag,";
  const pakete = GLOBAL_PAKETE.map((g) => `- ${globalKatalog(g.key)?.label ?? g.de.name}: ${globalPreisText(g.key)} einmalig — ${g.de.fuer}`).join("\n");
  const geldZurueck = GLOBAL_GELD_ZURUECK.aktiv
    ? `\n${GLOBAL_GELD_ZURUECK.de.titel}: ${GLOBAL_GELD_ZURUECK.de.text} ${GLOBAL_GELD_ZURUECK.de.bedingungen}\n`
    : "";
  const text = `${anrede}

danke für das Gespräch eben. Wie besprochen in aller Kürze, worum es bei FIAON Global geht:

FIAON gründet Ihre US-Gesellschaft mit einem Team vor Ort in den USA, bereitet die Steuernummern (EIN, ITIN) vor und reicht sie ein, stellt US-Geschäftsadresse, US-Telefonnummer, Registered Agent und Dokumentenraum und bereitet Ihre Konto- und Kartenanträge vollständig vor. Sie haben dabei einen festen Ansprechpartner.

Vier Pakete, jedes zum Einmalpreis — kein Abo, keine Monatsraten:
${pakete}

Was Sie wissen sollten, bevor Sie entscheiden:
- Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut. ${GLOBAL_ROLLEN.de.fiaon}
- ${GLOBAL_ROLLEN.de.partner}
- ${GLOBAL_ROLLEN.de.kosten}
${GLOBAL_PFLICHTHINWEIS.de.map((h) => `- ${h}`).join("\n")}
${geldZurueck}
Alle Pakete mit ihren Leistungen finden Sie hier:
${GLOBAL_SEITE_URL}#pakete

Wenn Sie direkt beauftragen möchten — Paket wählen, Unternehmen angeben, Vertrag unterschreiben, Rechnung per Überweisung:
${globalStartUrl()}

Wenn Sie lieber erst Fragen klären: Antworten Sie einfach auf diese E-Mail oder buchen Sie ein Gespräch:
${GLOBAL_GESPRAECH_URL}

Freundliche Grüße
${opts.agentName}
FIAON Global — US-Struktur aus einer Hand
welcome@fiaon.com · fiaon.com/business`;
  return { betreff: `FIAON Global — die Unterlagen zu unserem Gespräch (${opts.firma})`, text };
}

// ── DIE ANWEISUNG FÜR DIE KI-VORBEREITUNG ───────────────────────────────────
// Kein Kundentext — sie geht an das Modell. Sie NENNT die verbotenen Aussagen,
// um sie zu verbieten, und passiert deshalb die Wortwand bewusst nicht.
export function globalVorbereitungSystem(): string {
  const pakete = GLOBAL_PAKETE.map((g) => `${g.key} — ${globalKatalog(g.key)?.label ?? g.de.name}, ${globalPreisText(g.key)} einmalig: ${g.de.fuer}`).join("\n");
  return `Du bereitest einen FIAON-Vertriebsmitarbeiter auf einen B2B-ANRUF vor.
FIAON Global: FIAON gründet für Unternehmen aus Deutschland, Österreich und der Schweiz eine US-Gesellschaft mit einem Team vor Ort in den USA, bereitet EIN und ITIN vor, stellt US-Geschäftsadresse, US-Telefonnummer, Registered Agent und Dokumentenraum und bereitet Konto- und Kartenanträge vollständig vor. Ein fester Ansprechpartner koordiniert alles. Vier Pakete zum EINMALPREIS (kein Abo, keine Monatsraten):
${pakete}
Ziel des Anrufs: Interesse wecken → Info-Mail, Gesprächstermin oder Direktauftrag.
STRENG: Keine Fakten über die Firma ERFINDEN. Was du nur aus Branche/Ort ableitest, kennzeichne als Vermutung („vermutlich", „typisch für…"). Ist kein Bezug zu den USA erkennbar, sag das ehrlich — nicht jede Firma braucht eine US-Gesellschaft.
NIEMALS versprechen oder andeuten: eine Karte, ein Konto, einen Rahmen oder Dollarbetrag, einen Zinssatz, eine Frist, eine Steuerersparnis, ein Darlehen. KEINE Banknamen. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut. Steuer- und Rechtsfragen beantworten Steuerberater und Anwälte auf eigenes Mandat — nicht FIAON und nicht der Mitarbeiter.
Pflichtwissen, das im Gespräch fallen muss: ${GLOBAL_PFLICHTHINWEIS.de.join(" ")}
Antworte NUR als JSON:
{"kurzlage":"2-3 Sätze, was diese Firma macht (aus der Website; ohne Website: was Branche/Ort vermuten lassen)","schmerzpunkte":["3 wahrscheinliche Gründe, warum GENAU diese Firma einen Bezug zu den USA oder Bedarf an einer US-Struktur haben könnte (Kunden, Lieferanten, Zahlungsverkehr in Dollar, Projekte, zweites Standbein) — oder ehrlich: keiner erkennbar"],"einstieg":"EIN gesprochener Einstiegssatz für den Anruf, auf diese Firma zugeschnitten, Sie-Form, ohne jede Zusage","fragen":["3 kluge Fragen, die den US-Bezug klären und Kompetenz zeigen"],"einwand_tipp":"der wahrscheinlichste Einwand dieser Firma + die beste ehrliche Antwort in einem Satz","paket":"${GLOBAL_PAKETE.map((g) => g.key).join("|")} mit 1 Satz Begründung — oder: kein Paket, weil kein US-Bezug erkennbar ist"}`;
}
