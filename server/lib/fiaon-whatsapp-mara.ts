// ═══════════════════════════════════════════════════════════════════════════
// MARA AUF WHATSAPP (E-210 → E-224 → E-230 → E-236)
//
// Justin (23.09.): „Mara muss IMMER antworten. Mara muss immer aktiv am Start
// sein — 100 % menschlich, 100 % Gehirn, kann den Kunden 100 % helfen und
// pitcht immer perfekt mit den Kreditkarten."
//
// ── WAS AM 23.09. SCHIEFLIEF (gemessen, gegengeprüft) ─────────────────────
//   · Die Verlaufsabfrage holte keine id → jede vorbereitete Antwort galt als
//     veraltet und wurde endlos neu gedacht: 713 KI-Aufrufe, 0 Antworten.
//   · Mara wurde NUR von einer neu eingehenden Nachricht angestoßen. Fiel eine
//     Antwort durch (Neustart, Fehler, Wand), blieb der Kunde für immer ohne.
//   · „Die letzte Nachricht war unsere": Eine automatische Vorlage direkt nach
//     der Kundenfrage ließ die Frage für immer offen.
//   · Ein Freitext aus dem Raum schaltete Mara für immer ab — auch nachts.
//   · Traf eine Antwort die Wortwand, bekam der Kunde gar nichts.
//   · Das Gedächtnis aus WhatsApp wurde nie gespeichert (Satz statt Liste).
//   · Mara kannte vom Haus vier Zahlen — nicht Preise, Ablauf, Vertrag, Karte.
//
// ── WIE ES JETZT GEHT ─────────────────────────────────────────────────────
// OFFEN ist ein Gespräch, wenn die neueste Kundennachricht nach der letzten
// FREIEN Antwort (von Mara oder einem Menschen) kam. Vorlagen und
// Fehlerzeilen zählen nicht als Antwort. Offene Gespräche beantwortet Mara —
// angestoßen vom Eingang UND jede Minute vom Nachhol-Takt, bis beantwortet.
//
// Wände, die bleiben: der Schalter „aus" (bewusst von Hand), das
// 24-Stunden-Fenster, der Kostendeckel, die Wortwand (mit zweitem Versuch und
// sicherem Rückfallsatz). Schreibt ein Mensch aus dem Team, pausiert Mara —
// bleibt der Kunde danach 15 Minuten ohne Antwort (20–8 Uhr sofort),
// übernimmt sie wieder.
//
// ── E-236 (24.09.): VERKAUFEN, NICHT ABSCHRECKEN ──────────────────────────
// Justin: „Mara soll verkaufen, nicht erschrecken." Der Auftrag stellt Ja
// zuerst, keine ungefragten Hürden, nie ausreden, kurz wie WhatsApp. Dazu die
// weiche Verkaufsprüfung (verkaufsPruefung): Trifft sie, schreibt Mara einmal
// neu. KI-Ausfall: sechs Minuten still weiterversuchen, dann EIN Rückfallsatz;
// leeres Guthaben → Aufgabe an die Geschäftsführung. Grenze je Gespräch: 15 in
// 30 Minuten = kurz warten, 60 am Tag = Pause bis morgen.
//
// „100 % menschlich" heißt Ton und Einfühlung, nicht Täuschung. KI-Verordnung
// Art. 50 (seit 02.08.2026): Sie stellt sich in ihrer ersten Antwort jedes
// Gesprächs als digitale Assistentin vor (falls noch nicht geschehen) und sagt
// es jederzeit offen, wenn jemand fragt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { kiAufruf, antwortLesen, MODELL, agentNamen } from "./fiaon-postmeister-agent";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { waSenden, sendePruefung, fensterOffen } from "./fiaon-whatsapp";
import { anweisungBlock } from "./fiaon-mara-anweisung";
import { gedaechtnisText, gedaechtnisMerken } from "./fiaon-mara-gedaechtnis";
import { wissenFakten } from "@shared/fiaon-wissen";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { WA_VORLAGEN, AUSKUNFT_VORLAGE } from "@shared/fiaon-lead-texte";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS, auskunftWort, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { fragtNachAuskunftSelbst, lehntAuskunftAb, bezogenAufAuskunftAngebot } from "@shared/fiaon-postmeister-typen";
import { personSperre, werbungVerboten } from "./fiaon-mail-frequenz";
import { absoluteUrl } from "../fiaon-base-url";
import { zuletztAngeboten } from "./fiaon-auskunft";

export const DIENST_WA = "mara-whatsapp";

/** Übernahme durch einen Menschen läuft nach dieser Zeit ohne Antwort ab. */
const UEBERNAHME_MS = 15 * 60_000;
/** Antworten je Gespräch: in 30 Minuten (dann kurz warten) und am Tag (dann Pause bis morgen). */
export const HALBSTUNDE_GRENZE = 15;
export const TAG_GRENZE = 60;
/** So lange versucht Mara es bei einem KI-Ausfall still weiter, bevor der Rückfallsatz rausgeht. */
export const KI_GEDULD_MIN = 6;

/** Was ohne Text ankommt, soll Mara als das sehen, was es ist — nicht als leere Zeile. */
const MEDIEN: Record<string, string> = {
  audio: "(Sprachnachricht — du kannst sie nicht abhören)",
  voice: "(Sprachnachricht — du kannst sie nicht abhören)",
  image: "(ein Bild — du kannst es nicht sehen)",
  video: "(ein Video — du kannst es nicht ansehen)",
  document: "(ein Dokument — du kannst es nicht öffnen)",
  sticker: "(ein Sticker)",
  reaction: "(eine Reaktion auf eine Nachricht)",
  location: "(ein Standort)",
  unsupported: "(eine Nachricht, die WhatsApp nicht übermittelt hat)",
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["antwort", "gemerkt", "mensch", "uebergabe"],
  properties: {
    antwort: { type: "string", description: "Die WhatsApp-Nachricht an den Menschen. Ein bis vier kurze Sätze." },
    gemerkt: { type: "string", description: "Ein Satz, den sich FIAON über diesen Menschen merken soll — oder leer." },
    mensch: { type: "boolean", description: "true, wenn ein Mensch aus dem Team übernehmen muss." },
    uebergabe: { type: "string", description: "Ein Satz für den Betreuer: was er will, wann, wie dringend — sonst leer." },
  },
} as const;

/**
 * „Stopp" / „Keine Nachrichten mehr" — der Knopf oder eine Nachricht, die NUR
 * daraus besteht. E-230-Durchsicht: Ungeankert galt „Ich habe keine Nachrichten
 * von der Bank bekommen" als Abmeldung, und die Frage blieb unbeantwortet.
 */
export function istStopp(text: unknown, knopf?: unknown): boolean {
  const k = String(knopf ?? "").trim();
  if (k && /^(keine\s+nachrichten(\s+mehr)?|stopp?|stop)$/i.test(k)) return true;
  const t = String(text ?? "").trim().replace(/[.!\s]+$/, "");
  return /^(bitte\s+)?(stopp?|stop|abmelden)(\s+bitte)?$/i.test(t) || /^(bitte\s+)?keine\s+(weiteren\s+)?nachrichten(\s+mehr)?(\s+bitte)?$/i.test(t);
}

const STOPP_ANTWORT = "Verstanden, hier auf WhatsApp schreiben wir Ihnen nicht mehr. Wenn Sie später doch eine Frage haben, antworten Sie einfach.";

/**
 * Wenn die Wand zweimal trifft oder die KI zu lange ausfällt: wahr, ohne Zusage, mit Übergabe.
 * 24.09.: Derselbe Satz dreimal hintereinander (07:00–07:02, KI-Guthaben leer) wirkt wie ein
 * kaputter Automat — steht er schon da, kommt die zweite Fassung, nie zweimal dieselbe.
 * Kein „gleich": Mara antwortet auch nachts, dann ist „gleich" eine Zeitzusage, die niemand hält.
 */
const RUECKFALL_ANFANG = "Das möchte ich Ihnen ganz genau beantworten.";
const RUECKFALL_ZWEI = "Ihre Nachricht ist angekommen und liegt schon bei ";
function rueckfallSatz(betreuer: string | null, schonGesagt = false): string {
  return schonGesagt
    ? `${RUECKFALL_ZWEI}${betreuer ?? "unserem Team"} — Sie bekommen so bald wie möglich eine Rückmeldung.`
    : `${RUECKFALL_ANFANG} Ich gebe Ihre Nachricht direkt an ${betreuer ?? "unser Team"} weiter — Sie bekommen zeitnah eine Rückmeldung.`;
}
// „includes", nicht „startsWith": In der ersten Antwort eines Gesprächs steht der KI-Hinweis davor
// („Hier ist Mara, die digitale Assistentin von FIAON. Das möchte ich …") — gefunden im Ablauftest.
export const istRueckfall = (text: unknown) => {
  const t = String(text ?? "");
  return t.includes(RUECKFALL_ANFANG) || t.includes(RUECKFALL_ZWEI);
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE VERKAUFSPRÜFUNG UND DIE WAHRHEITSPRÜFUNG (24.09.2026, E-236)
//
// Justin, mit dem Chat von Monika Z. vor Augen: „So wie hier, das darf Mara
// niemals machen. Wenn der Kunde sagt: Ich suche unkompliziert eine
// Kreditkarte, dann sagt Mara: ‚Yes, da sind Sie bei uns genau richtig!' —
// nichts von Bonität, Kontoauszügen o.ä. Mara soll verkaufen, nicht erschrecken."
//
// Der Chat: Frage nach Einkommensnachweis → Mara zählt ungefragt Kontoauszüge,
// Ausweis und Bonitätsauskunft auf. „Konto im Minus" → „kein Ausschlussgrund,
// gerade deshalb schauen wir auf die Kontoauszüge". Am Ende: „dann passt FIAON
// … wahrscheinlich nicht". Die Kundin ging.
//
// Eine Anweisung ist eine Bitte, eine Prüfung ist eine Wand (E-225).
//   · verkaufsPruefung ist WEICH: Trifft sie, schreibt Mara einmal neu; trifft
//     sie danach noch, geht die Antwort trotzdem raus — sie ist wahr, nur nicht
//     gut genug.
//   · wahrheitsPruefung ist HART (wie die Wortwand): ein Nein, das mit „Ja"
//     beginnt; ein „ohne Schufa", das bejaht wird; eine Stundung; eine
//     Sprach- oder Zeitzusage; Recht geben bei „Betrug". Verkaufen heißt nie,
//     etwas zuzusagen, das FIAON nicht halten kann (E-226).
// Die Muster sind am 24.09. von drei Prüfern mit echten Sätzen gegengeprüft
// (Workflow mara-verkauf-pruefen); jede Änderung durch scripts/pruef-mara-verkauf.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Begrüßung und KI-Vorstellung vorne abschneiden — geprüft wird, was danach kommt. */
const VORSPANN = /^\s*(?:(?:hallo|hi|guten\s+(?:tag|morgen|abend)|servus|moin|grüezi)\b[^.!?—–]{0,30}[!,.—–:]?\s*|hier\s+ist\s+[\wäöüß]+(?:\s+[\wäöüß]+)?\s*[,–—-]?\s*(?:die|ihre)\s+(?:digitale\s+)?(?:fiaon-)?assistentin(?:\s+(?:von|bei)\s+fiaon)?\s*[,—–:.!-]*\s*(?:und\s+)?)/i;
function kern(a: string): string {
  let t = String(a ?? "").trim();
  for (let i = 0; i < 3; i++) {
    const n = t.replace(VORSPANN, "");
    if (n === t) break;
    t = n;
  }
  return t;
}

/**
 * Fragen, auf die ein bloßes „Ja" eine Zusage wäre, die FIAON nicht halten kann:
 * Kredit, Auszahlung, ganz ohne Schufa, PayPal/Lastschrift, sicher/100 %, Löschung,
 * später zahlen. „Kreditkarte", „Kredit Karte", „keinen Kredit", „statt PayPal"
 * zählen NICHT (Justins Hauptsatz „Ja, da sind Sie bei uns genau richtig!").
 */
export const ZUSAGE_FRAGE = new RegExp([
  String.raw`(?<!kein(?:en|e)?\s)(?<!statt\s)(?<!nicht\s)\bkredit(?:e|s)?\b(?![\s-]*karte)`,
  String.raw`darlehen`, String.raw`aus(?:ge|be)?zahl`, String.raw`bargeld`, String.raw`geld\s+(?:aufs?|auf\s+mein)`,
  String.raw`(?<!kein(?:en)?\s)(?<!statt\s)\bpaypal`, String.raw`(?<!ohne\s)(?<!keine\s)(?<!statt\s)lastschrift`, String.raw`(?<!nicht\s)\babbuch`,
  String.raw`schufa-?frei`, String.raw`ohne\s+(?:jede\s+|eine\s+|die\s+|jegliche\s+)?(?:schufa|bonit|prüf|abfrage|check)`,
  String.raw`keine\s+schufa(?![\s-]*(?:eintr|auskunft))`,
  String.raw`(?:bekomm|krieg|erhalt)\w*[^.!?]{0,40}\b(?:sicher|garantiert|auf\s+jeden\s+fall|100\s*%)`, String.raw`\b(?:sicher|100\s*%|garantiert)\b[^.!?]{0,30}(?:bekomm|krieg|erhalt|zusage)`,
  String.raw`geht\s+(?:das|es)\s+klar`, String.raw`zu\s+100\s*%`,
  String.raw`lösch`, String.raw`später\s+(?:be)?zahl`, String.raw`zahl\w*\s+(?:erst\s+)?(?:nächsten|kommenden|später)`, String.raw`nächsten\s+monat`,
  String.raw`raten?pause`, String.raw`pause\s+mach`, String.raw`stund`, String.raw`verschieb\w*[^.!?]{0,20}rate`,
].join("|"), "i");

const JA_ANFANG = /^(?:ja|jawohl|jo|jep|klar|na\s+klar|natürlich|sicher|selbstverständlich|kein\s+problem|auf\s+jeden\s+fall|absolut|genau\s*[,.!—–:]|gute\s+nachricht|keine\s+sorge|sehr\s+gerne?\s*[,.!—–:]\s*(?:ja|das\s+geht|klar))\b/i;
const MENSCH_FRAGE = /\b(?:mensch|echt|real|echte\s+person|lebendig)\b/i;
const BOT_FRAGE = /\b(?:bot|ki|roboter|maschine|automat|computer|chatbot)\b/i;
const VORWURF = /betrug|betrüger|abzocke|abzock|scam|fake|unseriös|verarsch/i;
const RECHT_GEBEN = /^(?:sie\s+haben\s+(?:völlig\s+|ganz\s+)?recht|da\s+haben\s+sie\s+recht|stimmt|richtig|ja\b)/i;

/** Ein Befund der Wahrheitsprüfung. „ja" darf notfalls mechanisch gestrichen werden, alles andere nicht. */
export interface WahrFund { art: "ja" | "mensch" | "vorwurf" | "ohne_schufa" | "stundung" | "sprache" | "zeit"; text: string }

export function wahrheitsBefunde(antwort: string, kunde: string): WahrFund[] {
  const a = String(antwort ?? "");
  const k = String(kunde ?? "");
  const anfang = kern(a);
  const funde: WahrFund[] = [];
  if (ZUSAGE_FRAGE.test(k) && JA_ANFANG.test(anfang)) {
    funde.push({ art: "ja", text: "Auf diese Frage wäre ein „Ja“ (oder „Keine Sorge“, „Gute Nachricht“, „Klar“) eine Zusage, die FIAON nicht halten kann — beginne mit dem Positiven, das stimmt, nicht mit einem Ja." });
  }
  if (MENSCH_FRAGE.test(k) && !BOT_FRAGE.test(k) && /^(?:ja|jawohl|klar|natürlich)\b/i.test(anfang)) {
    funde.push({ art: "mensch", text: "Er fragt, ob du ein Mensch bist — beginne nie mit „Ja“. Sag offen, dass du die digitale Assistentin bist." });
  }
  if (VORWURF.test(k) && RECHT_GEBEN.test(anfang)) {
    funde.push({ art: "vorwurf", text: "Auf einen Betrugsvorwurf nie „Sie haben recht“ oder „Ja“ — zeig Verständnis für den Ärger, ohne dem Vorwurf zuzustimmen." });
  }
  if (/\b(?:geht|klappt|funktioniert|möglich|bekommen|gibt\s+es)\b[^.!?]{0,40}\bohne\s+(?:jede\s+|die\s+)?(?:schufa|bonitätsprüfung|prüfung)\b(?![^.!?]{0,30}\bnicht\b)/i.test(a)
    || /\bohne\s+schufa\w*[^.!?]{0,30}\b(?:geht|möglich|klappt|kein\s+problem)\b(?![^.!?]{0,20}\bnicht\b)/i.test(a)
    || /\bschufa-?frei\w*[^.!?]{0,30}\b(?:geht|möglich|bekommen|gibt)\b(?![^.!?]{0,20}\bnicht\b)/i.test(a)) {
    funde.push({ art: "ohne_schufa", text: "„ohne Schufa“ darf nie bejaht werden — die Partnerbank schaut selbst." });
  }
  if (/\b(?:zahlen|überweisen)\s+sie\s+(?:einfach\s+|ruhig\s+|gern\s+|dann\s+)?(?:erst\s+)?(?:nächsten|kommenden|im\s+nächsten|später)\b/i.test(a)
    || /\b(?:ratenpause|pause|verschieb\w*|stundung|aufschub)\b[^.!?]{0,40}\b(?:kein\s+problem|geht\s+klar|ist\s+möglich|in\s+ordnung|machen\s+wir|geht\s+das)\b(?![^.!?]{0,5}\?)/i.test(a)) {
    funde.push({ art: "stundung", text: "Keine Stundung, keine Ratenpause, kein späteres Zahlen zusagen — das entscheidet ein Mensch (übergeben)." });
  }
  if (/\b(?:in\s+ihrer\s+sprache|auf\s+(?:polnisch|türkisch|englisch|russisch|arabisch|rumänisch|italienisch|spanisch|kroatisch|serbisch|ukrainisch))\b/i.test(a)) {
    funde.push({ art: "sprache", text: "Keine Zusage in einer anderen Sprache — das Team schreibt auf Deutsch." });
  }
  if (/\b(?:gleich|sofort|in\s+(?:wenigen|ein\s+paar)\s+minuten)\b[^.!?]{0,30}\b(?:meldet|melden|ruft|rufen|zurück|rückmeldung)\b/i.test(a)
    || /\b(?:meldet|melden|ruft|rufen)\b[^.!?]{0,25}\b(?:gleich|sofort)\b/i.test(a)) {
    funde.push({ art: "zeit", text: "Keine Zeitzusage wie „gleich“ oder „sofort“ für einen Menschen — nur ein eingetragener Termin hat eine Uhrzeit." });
  }
  return funde;
}

/** Für den Prüfstand und die harte Wand: nur die Texte. */
export function wahrheitsPruefung(antwort: string, kunde: string): string[] {
  return wahrheitsBefunde(antwort, kunde).map((f) => f.text);
}

/**
 * Letzter Ausweg, wenn auch der zweite Entwurf mit „Ja" auf eine Nein-Frage beginnt:
 * das Ja-Wort streichen, nicht die ganze Antwort (24.09.: sonst bekam „ich brauch 3000
 * euro kredit fürs auto" den Rückfallsatz statt einer Antwort). Der Rest ist wahr.
 */
export function jaStreichen(antwort: string): string {
  const a = String(antwort ?? "");
  // NUR, wenn der Rest die ehrliche Richtigstellung selbst enthält („Einen Kredit zahlen wir nicht aus …").
  // Sonst bliebe aus „Ja, das geht ganz unkompliziert" auf „ohne Schufa?" ein stilles Ja (Ablauftest 24.09.).
  if (!/\b(?:kein(?:en|e)?\s+(?:kredit\w*|geld|auszahlung)|zahlen\s+(?:wir\s+)?kein|nicht\s+aus|per\s+überweisung|schaut\s+selbst|entscheidet|nicht\s+perfekt|auskunftei)\b/i.test(a)) return a;
  const k = kern(a);
  const start = a.length - k.length;
  const ohne = k.replace(/^(?:ja|jawohl|jo|jep|klar|na\s+klar|natürlich|sicher|selbstverständlich|kein\s+problem|auf\s+jeden\s+fall|absolut|genau|gute\s+nachricht|keine\s+sorge)\b\s*[,.!—–:]?\s*/i, "");
  if (ohne === k) return a;
  const rest = start === 0 ? ohne.charAt(0).toUpperCase() + ohne.slice(1) : ohne;
  return (a.slice(0, start) + rest).trim();
}

const AUSREDEN: { muster: RegExp; was: string; wennNicht?: RegExp }[] = [
  { muster: /(?:passt|passen)\s+(?:fiaon|wir|unser\w*\s+angebot)\b(?!\s+\w+(?:\s+\w+)?\s+an\b)[^.!?]{0,90}\bnicht\b/i, was: "„passt nicht“" },
  { muster: /\b(?:fiaon|wir)\s+(?:passt|passen)\b(?!\s+\w+(?:\s+\w+)?\s+an\b)[^.!?]{0,40}\bnicht\b/i, was: "„passt nicht“" },
  { muster: /\b(?:läuft|geht|klappt|funktioniert)\s+(?:es|das)\s+(?:bei\s+(?:fiaon|uns)\s+)?(?:so\s+)?(?:leider\s+)?nicht\b/i, was: "„läuft/geht nicht“" },
  { muster: /\b(?:das|es)\s+(?:läuft|geht|klappt|funktioniert)\s+(?:bei\s+(?:fiaon|uns)\s+)?(?:so\s+)?(?:leider\s+)?nicht\b/i, was: "„läuft/geht nicht“" },
  { muster: /\bnicht\s+(?:das\s+richtige|der\s+richtige|die\s+richtige)\b/i, was: "„nicht das Richtige“" },
  { muster: /\bnicht\s+möglich\b/i, was: "„nicht möglich“", wennNicht: ZUSAGE_FRAGE },
  { muster: /\bausschluss\w*/i, was: "„Ausschluss“" },
  { muster: /\b(?:können|kann)\s+(?:wir|ich)\s+(?:ihnen\s+)?(?:da\s+|dabei\s+)?(?:leider\s+)?nicht\s+(?:weiter)?(?:helfen|anbieten)\b/i, was: "„können wir nicht“", wennNicht: ZUSAGE_FRAGE },
  { muster: /^(?:leider|nur\s+(?:mit|per|über)\b|das\s+geht\s+nicht|das\s+ist\s+nicht\s+möglich)/i, was: "Einstieg mit einer Einschränkung" },
];

/** Hürden, die nur fallen dürfen, wenn der Kunde selbst danach gefragt hat. */
const FRAGT_UNTERLAGEN = String.raw`unterlag|dokument|einreich|vorleg|vorzeig|papier|mitbring|mitschick|hochlad|upload|(?:was|welche)\b.{0,30}(?:brauch|benötig|muss|soll)|was\s+(?:muss|soll)\s+ich|voraussetz|bedingung`;
const HUERDEN: { wort: RegExp; frage: RegExp; was: string }[] = [
  // „Was brauchen Sie von mir?" erlaubt alles; „Brauche ich einen Einkommensnachweis?" die ehrliche Ergänzung.
  { wort: /kontoausz/i, frage: new RegExp(`auszug|auszüg|einkommen|gehalt|lohn|${FRAGT_UNTERLAGEN}`, "i"), was: "Kontoauszüge" },
  { wort: /ausweis|reisepass/i, frage: new RegExp(`ausweis|\\bpass\\b|identi|${FRAGT_UNTERLAGEN}`, "i"), was: "den Ausweis" },
  { wort: /bonitätsauskunft|schufa-?auskunft/i, frage: new RegExp(`schufa|auskunft|bonität|${FRAGT_UNTERLAGEN}`, "i"), was: "die Bonitätsauskunft" },
  { wort: /\bunterlagen\b|hochlad/i, frage: new RegExp(`auszug|auszüg|ausweis|foto|${FRAGT_UNTERLAGEN}`, "i"), was: "Unterlagen" },
  { wort: /schufa-?(?:prüfung|abfrage|check)|bonitätsprüfung|einkommensprüfung|prüft\s+(?:ihre\s+)?(?:schufa|bonität)|(?:schaut|prüft)\s+selbst/i,
    frage: /schufa|bonität|auskunft|eintr|score|crif|ksv|prüf|negativ|minus|ablehn|abgelehnt/i,
    was: "eine Schufa- oder Bonitätsprüfung" },
  { wort: /(?:entscheidet|legt)\s+(?:am\s+ende\s+)?(?:die|unsere)\s+(?:partner)?bank|(?:die|unsere)\s+(?:partner)?bank\s+(?:entscheidet|legt)/i,
    frage: /limit|rahmen|betrag|summe|€|euro|\d{3,}|sicher|bekomm|krieg|erhalt|angenommen|annahme|bewillig|trotz|wahrscheinlich|zusage|garant|genehmig|wie\s*viel|höhe|chance|klappt|ablehn|abgelehnt|kredit|geld/i,
    was: "„die Bank entscheidet“" },
  { wort: /laufzeit|kündigungsfrist|jahresvertrag|\bagb\b/i,
    frage: /kost|preis|laufzeit|kündig|vertrag|monat|abo|rate|teuer|günstig|€|euro|bind|gebunden|wie\s+lange|beend|wieder\s+raus|raus\s*komm|verlänger|jederzeit|stopp|widerruf|aufhör/i,
    was: "Laufzeit oder Kündigung" },
];

/** Hat er nach dem Link gefragt — oder gerade Ja zu Maras Angebot gesagt? */
const LINK_GEFRAGT = /link|\bwo\b|antrag|seite|zahl|überweis|qr|schick|nochmal|noch\s+mal|finde|öffne|klick/i;
const ZUSTIMMUNG = /^\s*(?:ja|jo|jep|gern|gerne|ok|okay|klar|bitte|los|passt|mach|machen\s+wir)\b/i;

// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT AUF WHATSAPP (24.09.2026, E-240)
//
// Doris Hösl (Person 4513) schrieb auf die Unterlagen-Bitte „Ich hab keine".
// Mara konnte nur „fordern Sie sie in Ihrem Bereich an" sagen — kein Preis,
// kein Link, kein Betreuer, der davon erfuhr. Jetzt:
//   · Zahlender Kunde (bezahltes Paket), keine Auskunft bei uns, und er
//     schreibt über Bonität, SCHUFA, Einträge, Limit, Karte oder „keine
//     Auskunft" → Mara bietet sie als VORTEIL an (Preis aus auskunftStand,
//     74 € mit Paket), holt mit auskunft_anbieten den echten Link und gibt
//     dem Betreuer Bescheid (Aufgabe = Mail + Hinweis im Office).
//   · Leads (Stufe C) und offene Anträge (Stufe B) bleiben UNGEFRAGT
//     unverändert: nichts von Bonität, Kontoauszügen o. ä. (Justin, 24.09.).
//   · Werbesperre: Mara antwortet weiter, verkauft aber nichts — die Auskunft
//     nur, wenn er sie ausdrücklich haben will (seine Anfrage, keine Werbung).
//
// ── E-241 (25.09.2026): AUCH ANTRÄGE UND LEADS — ALS ANTWORT ──────────────
// Justin: „an ALLE, die keine Boni-Auskunft hinterlegt oder gekauft haben".
// Der Verkaufstakt bietet sie seitdem auch Stufe B und Leads an (Mail
// auskunft_angebot, Vorlagen fiaon_kk_auskunft…). Antwortet so ein Mensch
// darauf („Ja, gern", „Was kostet das?") oder fragt er SELBST nach der Auskunft
// (fragtNachAuskunftSelbst — die Auskunft selbst, nicht „geht das trotz
// Schufa?"), bekommt er den Kauflink zum Einzelpreis — dieselbe Bestätigungsseite
// wie alle. Ungefragt bleibt es bei der Karte; ein Nein ist ein Nein.
// ═══════════════════════════════════════════════════════════════════════════

/** Er schreibt über das, wofür die Auskunft ein Vorteil ist. */
export const AUSKUNFT_THEMA = /schufa|bonit|auskunft|crif|\bksv|boniversum|creditreform|intrum|eintr[aä]g|\bscore|negativ|limit|rahmen|karte|abgelehnt|ablehnung|kreditwürd/i;

/**
 * Hat er der Auskunft zugestimmt — „Ja" auf Maras Angebot (ihre letzte
 * Nachricht fragt nach der Auskunft) oder ausdrücklich „bestellen Sie sie"?
 * Nur dann legt das Werkzeug eine Bestellung an (sonst: Kauflink mit
 * Bestätigungsseite — keine Rechnung für etwas, das er nicht wollte).
 */
export function auskunftZugestimmt(kunde: string, letzteDu: string): boolean {
  const k = String(kunde ?? "").trim();
  const du = String(letzteDu ?? "").trim();
  if (!k || /\b(?:nicht|nein|kein\w*|später|überleg\w*|schon|bereits)\b/i.test(k)) return false;
  const bestellt = /\b(?:bestell\w*|beauftrag\w*|kaufen|buchen)\b|\bholen\s+sie\b|\bmachen\s+sie\s+das\b|\bnehme\s+(?:ich\s+)?(?:sie|die|das)\b/i.test(k)
    && (/auskunft|schufa|\bksv|bonit/i.test(k) || /auskunft/i.test(du));
  // Nur ein reines Ja — „Bitte rufen Sie mich an" beginnt auch mit „Bitte", ist aber kein Auftrag.
  const jaAufAngebot = NUR_JA.test(k) && /auskunft/i.test(du) && /\?\s*$/.test(du);
  return bestellt || jaAufAngebot;
}
const NUR_JA = /^\s*(?:(?:ja|jo|jep|jawohl|gern|gerne|sehr\s+gern|ok|okay|klar|bitte|los|passt|gut|super|perfekt|mach(?:en\s+(?:sie|wir))?(?:\s+das)?|schicken\s+sie(?:\s+(?:ihn|den\s+link|sie))?|bestellen\s+sie(?:\s+sie)?)[\s,.!]*)+$/i;

/** Will er die Auskunft selbst — seine eigene Anfrage (erlaubt auch bei Werbesperre)? */
export function auskunftGefragt(kunde: string): boolean {
  const k = String(kunde ?? "");
  return /auskunft|schufa|\bksv|bonit/i.test(k)
    && /kauf|bestell|beauftrag|holen|anforder|wie\s+bekomm|wo\s+bekomm|woher|was\s+kostet|preis|haben\s+will|möchte\s+(?:sie|die)|brauche\s+(?:sie|die|eine)/i.test(k);
}

/**
 * Wer schreibt (E-241): zahlender Kunde (Angebot als Vorteil, wie E-240),
 * offener Antrag (Stufe B) oder Lead — die beiden letzten nur als Antwort.
 */
export type AuskunftSegment = "kunde" | "antrag" | "lead";

/** Was Mara über seine Auskunft weiß — aus auskunftStand, nie vom Modell. */
export interface AuskunftTeil {
  stufe: "nichts" | "offen" | "bezahlt" | "dokument";
  land: AuskunftLand;
  /** E-241: ohne Angabe ein zahlender Kunde (wie bis E-240). */
  segment?: AuskunftSegment;
  /** E-241: privat oder Firma (Business-Paket) — dieselbe Art wie Werkzeug und Kauflink (auskunftArtFuer). */
  art?: AuskunftArt;
  /** E-241: Seine offenen Nachrichten antworten auf ein Auskunft-Angebot (Vorlage, Mail, Mara). */
  aufAngebot?: boolean;
  /** E-241: Er fragt selbst nach der Auskunft (fragtNachAuskunftSelbst). */
  selbst?: boolean;
  /** Sein Preis: „74 €" (mit Paket) bzw. „149 €". */
  preisText: string;
  mitAbo: boolean;
  offenLink: string | null;
  offenBetrag: string | null;
  /** Er schreibt gerade darüber (oder hat Maras Angebot beantwortet) — dann Angebot und Werkzeug. */
  jetzt: boolean;
  werbesperre: boolean;
  /** Gegenlesen 24.09.2026: Mara hat sie in diesem Gespräch schon mit Preis angeboten. */
  schonAngeboten?: boolean;
  /**
   * Integration 25.09.2026 (E-240): die gemeinsame Bremse (zuletztAngeboten, fiaon-auskunft.ts) —
   * „per Angebots-Mail am 24.09., um 10:12 Uhr". Gesetzt, wenn ein Weg sie in den letzten drei Tagen angeboten hat.
   */
  angebotAnderswo?: string | null;
}

/**
 * Worüber er schreibt, wenn es DIREKT um die Auskunft geht — ohne Karte, Limit,
 * Rahmen und Ablehnung. Gegenlesen 24.09.2026: Nach dem ersten Angebot löst nur
 * noch das ein neues aus; sonst stünde die Auskunft in jeder Antwort an einen
 * Kunden, der fünfmal nach seiner Karte fragt.
 */
const AUSKUNFT_DIREKT = /schufa|bonit|auskunft|crif|\bksv|boniversum|creditreform|intrum|eintr[aä]g|\bscore|negativ/i;

/**
 * Wie lange eine Antwort noch als Antwort auf das Angebot zählt, wenn es per
 * Mail oder auf einem anderen Weg kam (E-241) — er muss sich dann darauf beziehen
 * („wegen Ihrer Mail", „Ihr Angebot").
 */
export const ANGEBOT_ANTWORT_TAGE = 14;

/**
 * Die Vorlagen des Angebots (shared/fiaon-lead-texte.ts): fiaon_kk_auskunft,
 * fiaon_kk_auskunft_lead und ihre Bildfassungen fiaon_kkb_… — als Muster, damit
 * eine weitere Fassung dahinter (…_firma) nicht vergessen wird.
 */
const AUSKUNFT_VORLAGE_MUSTER = new RegExp(`^${AUSKUNFT_VORLAGE.replace(/^fiaon_kk_/, "fiaon_kkb?_")}(?:_|$)`, "i");

/**
 * Ist diese Nachricht VON UNS ein Angebot der Auskunft (E-241)? Die Vorlage
 * (auch fiaon_kk_auskunft_lead) oder Maras eigenes Angebot — mit Preis oder
 * Kauflink. Rein.
 */
export function istAuskunftAngebot(n: { vorlage?: string | null; text?: string | null } | null | undefined): boolean {
  if (!n) return false;
  if (n.vorlage) return AUSKUNFT_VORLAGE_MUSTER.test(String(n.vorlage));
  const t = String(n.text ?? "");
  return /auskunft/i.test(t) && (/\d\s*(?:€|euro\b)/i.test(t) || /\/auskunft\/(?:bestellen|k\/)/i.test(t));
}

/**
 * Antworten seine offenen Nachrichten auf ein Auskunft-Angebot (E-241)? Ja,
 * wenn unsere letzte Nachricht davor das Angebot war — oder wenn es in den
 * letzten 14 Tagen per Mail oder Vorlage kam (`angebotKuerzlich`, aus
 * zuletztAngeboten) und er sich ausdrücklich darauf bezieht. Ein bloßes „Ja"
 * nach der Begrüßung meint den Antrag, nicht eine Mail von vorgestern. Rein.
 */
export function antwortetAufAuskunftAngebot(ein: {
  kunde: string;
  letzteRaus: { vorlage?: string | null; text?: string | null } | null;
  angebotKuerzlich?: string | null;
}): boolean {
  // Die Vorlage war das Angebot → jede Antwort darauf zählt (außer einem Nein, auskunftJetzt).
  // Maras EIGENES Angebot davor → nur ein Ja oder eine Rückfrage dazu: Wer danach nach seiner
  // Karte fragt, bekommt nicht noch einmal dasselbe Angebot (Gegenlesen E-240).
  if (istAuskunftAngebot(ein.letzteRaus)) return !!ein.letzteRaus?.vorlage || bezogenAufAngebot(ein.kunde);
  return !!ein.angebotKuerzlich && /\b(?:angebot|e-?mail|mail)\b/i.test(String(ein.kunde ?? ""));
}

/**
 * Bezieht sich seine Nachricht auf ein Angebot, das er gerade bekommen hat — ein
 * reines Ja („Ja, gern", „Gerne", „Ok") oder eine Rückfrage dazu („Was kostet
 * das?", „Wie läuft das ab?", „Klingt gut")? Rein (E-241).
 */
const ANGEBOT_RUECKFRAGE = /\b(?:was\s+kostet|wie\s*viel(?=\s*(?:kostet|kosten|macht|ist\s+das|\?|$))|preis|wie\s+(?:läuft|geht|funktioniert)\s+(?:das|es)(?!\s+weiter)|was\s+(?:genau\s+)?(?:bekomme|macht|machen|steckt)|klingt\s+gut|hört\s+sich\s+gut|interessiert\s+mich|wo\s+(?:kann\s+ich|muss\s+ich)?\s*(?:bestell|beauftrag|klick))/i;
export function bezogenAufAngebot(kunde: unknown): boolean {
  const k = String(kunde ?? "").trim();
  return NUR_JA.test(k) || ANGEBOT_RUECKFRAGE.test(k);
}

/**
 * Wann Mara die Auskunft JETZT anbietet (Auftrag + Werkzeug) — eine Regel für
 * den Betrieb (maraAntwortet) und den Prüfstand. letzteDu: Maras eigene
 * Nachrichten, neueste zuerst.
 */
export function auskunftJetzt(ein: {
  kunde: string; letzteDu: string[]; werbesperre: boolean;
  /** Integration 25.09.2026: In den letzten drei Tagen kam das Angebot schon über einen anderen Weg (gemeinsame Bremse). */
  anderswo?: boolean;
  /** E-241: Wer schreibt — ohne Angabe ein zahlender Kunde (die Regel von E-240). */
  segment?: AuskunftSegment;
  /** E-241: Er antwortet auf ein Auskunft-Angebot (antwortetAufAuskunftAngebot). */
  aufAngebot?: boolean;
}): { jetzt: boolean; schonAngeboten: boolean; aufAngebot?: boolean; selbst?: boolean } {
  const kunde = String(ein.kunde ?? "");
  const du = ein.letzteDu.map((t) => String(t ?? ""));
  const zugestimmt = auskunftZugestimmt(kunde, du[0] ?? "");
  // ── E-241: OFFENER ANTRAG ODER LEAD — NUR ALS ANTWORT ─────────────────────
  // Nie von sich aus (kein AUSKUNFT_THEMA: „Karte", „Limit" lösen hier nichts aus).
  // Er antwortet auf das Angebot, sagt Ja zu Maras Frage oder fragt selbst nach der
  // Auskunft — und lehnt nicht ab. Bei Werbe- oder Vertriebssperre zählt wie bei
  // Kunden nur sein ausdrücklicher Wunsch (auskunftGefragt: „Was kostet die
  // Auskunft?", „Können Sie sie holen?") — nie die Antwort auf ein Angebot.
  if (ein.segment && ein.segment !== "kunde") {
    const selbst = fragtNachAuskunftSelbst(kunde);
    // Gegenlesen E-241: Auf WhatsApp ist JEDE spätere Nachricht „nach der Vorlage" — auch
    // „Wann kommt meine Karte?" eine Woche danach. Als Antwort auf das Angebot zählt sie nur,
    // wenn sie sich darauf bezieht: ein Ja, eine Rückfrage, das Thema (bezogenAufAngebot,
    // bezogenAufAuskunftAngebot), der Knopf „Ich habe eine Frage" der Vorlage oder der Bezug auf
    // die Mail. Dieselbe Grenze wie beim zahlenden Kunden (E-240: auf die Kartenfrage kein zweites Angebot).
    const aufAngebot = !!ein.aufAngebot && (bezogenAufAngebot(kunde) || bezogenAufAuskunftAngebot(kunde)
      || /^\s*ich habe eine frage[\s.!]*$/im.test(kunde) || /\b(?:angebot|e-?mail|mail)\b/i.test(kunde));
    const schonAngeboten = du.slice(0, 8).some((t) => /auskunft/i.test(t) && /\d\s*(?:€|euro\b)/i.test(t));
    const nein = lehntAuskunftAb(kunde);
    const jetzt = !nein && (ein.werbesperre
      ? ((selbst && auskunftGefragt(kunde)) || zugestimmt)
      : (selbst || zugestimmt || aufAngebot));
    return { jetzt, schonAngeboten, aufAngebot, selbst };
  }
  // Ein Angebot per Mail oder Vorlage zählt wie eines in diesem Gespräch: danach nur noch,
  // wenn er selbst auf die Auskunft zurückkommt (AUSKUNFT_DIREKT) oder Ja sagt.
  const schonAngeboten = !!ein.anderswo || du.slice(0, 8).some((t) => /auskunft/i.test(t) && /\d\s*(?:€|euro\b)/i.test(t));
  // E-241: Dieselbe Lücke hatte der zahlende Kunde — „Ja, gern" auf die Vorlage
  // fiaon_kk_auskunft war weder Thema noch Zustimmung zu Maras Frage, und die Bremse
  // sah die Vorlage als „schon angeboten". Sein Ja oder seine Rückfrage zum Angebot
  // („Was kostet das?") ist kein zweites Angebot: dann jetzt. „Wann kommt meine
  // Karte?" nach dem Angebot bleibt, wie E-240 es regelt (kein neues Angebot).
  if (ein.aufAngebot && !ein.werbesperre && !lehntAuskunftAb(kunde) && bezogenAufAngebot(kunde)) {
    return { jetzt: true, schonAngeboten, aufAngebot: true };
  }
  if (ein.werbesperre) return { jetzt: auskunftGefragt(kunde) || zugestimmt, schonAngeboten };
  return { jetzt: zugestimmt || (schonAngeboten ? AUSKUNFT_DIREKT.test(kunde) : AUSKUNFT_THEMA.test(kunde)), schonAngeboten };
}

/** Bekommt Mara in diesem Gespräch das Werkzeug auskunft_anbieten? */
export function auskunftWerkzeugAn(t: AuskunftTeil | null | undefined): boolean {
  return !!t && (t.stufe === "nichts" || t.stufe === "offen") && t.jetzt;
}

/** Der Teil des Auftrags über seine Auskunft. Exportiert für den Prüfstand. */
export function auskunftBlock(t: AuskunftTeil | null | undefined): string[] {
  if (!t) return [];
  const wort = auskunftWort(t.land);
  const bei = auskunfteienText(t.land);
  // E-241: der Einzelpreis seiner Art (Firma 349 €, privat 149 €) — nicht immer der private.
  const einzeln = euroText(AUSKUNFT_PREISE_CENTS[t.art ?? "privat"].einzeln);
  const landWort = t.land === "DE" ? "" : ` In seinem Land heißt sie „${wort}" — das Wort SCHUFA schreibst du ihm nie.`;
  if (t.stufe === "bezahlt") return [`SEINE BONITÄTSAUSKUNFT: bezahlt — wir fordern seine Datenkopien bei ${bei} an. Nicht noch einmal anbieten; fragt er nach dem Stand, sieht sein Betreuer nach.${landWort}`, ``];
  if (t.stufe === "dokument") return [`SEINE BONITÄTSAUSKUNFT: Eine Auskunft liegt in seiner Akte. Nichts dazu verkaufen.${landWort}`, ``];
  // ── E-241: OFFENER ANTRAG ODER LEAD ───────────────────────────────────────
  // Ungefragt kein Wort (Justin 24.09.: „Ich suche unkompliziert eine Kreditkarte"
  // → nur die Karte) — der Auftrag bleibt dann genau so, wie er vor E-241 war.
  if (t.segment && t.segment !== "kunde") {
    if (!t.jetzt) return [];
    if (t.stufe !== "offen") {
      const antrag = t.segment === "antrag";
      return [
        `═══ SEINE FRAGE: DIE BONITÄTSAUSKUNFT ═══`,
        `${t.aufAngebot ? "Er antwortet auf unser Angebot der Bonitätsauskunft" : "Er fragt selbst nach der Bonitätsauskunft"} — jetzt ist sie seine Frage, keine Hürde. ${antrag ? "Sein Antrag liegt vor, die erste Zahlung für sein Paket ist noch offen." : "Er hat noch keinen Antrag."} Beantworte, was er schreibt, positiv in ein bis zwei Sätzen, dann der Schritt.`,
        `· Was wir tun: Wir fordern seine Datenkopien bei ${bei} an (mit seiner Vollmacht — er schreibt keinen Brief), erklären jeden Eintrag, prüfen die Speicherfristen und liefern seinen Handlungsplan und fertige Schreiben (etwa Löschung nach Fristablauf, Berichtigung) zur Freigabe.`,
        // 25.09.2026 (E-241): Antrag und Lead lesen den Nutzen ohne „Limit“ (VERBOTENE_WORTE, § 34c GewO).
        `· Warum: „${AUSKUNFT_NUTZEN_SATZ_KARTE}"`,
        `· Sein Preis: ${t.preisText} einmalig — ein eigener Auftrag, kein Abo, keine Monatsrate. Einen anderen Betrag für die Auskunft nennst du nie.${landWort}`,
        `· Die Auskunft ist KEINE Voraussetzung für ${antrag ? "sein Paket" : "den Antrag"} oder die Karte — das sagst du nie anders. Kontoauszüge, Ausweis und Hochladen erwähnst du nicht.`,
        antrag
          ? `· Seine offene erste Zahlung sprichst du höchstens in einem kurzen Satz an, ohne zweiten Link — der Schritt dieser Antwort ist die Auskunft.`
          : `· Den Antragslink schickst du hier nur, wenn er danach fragt — der Schritt dieser Antwort ist die Auskunft.`,
        `· Sagt er Ja, will er sie oder fragt nach Preis oder Weg: rufe auskunft_anbieten auf und schick GENAU den Link aus dem Ergebnis. Einen Link, Preis oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie. Geht es ihm in Wahrheit um etwas anderes, beantworte nur das — ohne Angebot.`,
        `· Fragt er, ob er die Datenkopie nicht kostenlos selbst anfordern kann, sagst du ehrlich: „${AUSKUNFT_KOSTENLOS_ANTWORT}" Von dir aus empfiehlst du den kostenlosen Weg nie.`,
        `· Keine Zusage: nie „dann bekommen Sie die Karte" oder „Ihr Limit steigt", keine Löschzusage, kein „Score verbessern", keine Frist mit Zahl. Den Satz über die Bank nur, wenn er nach Karte, Limit oder Zusage fragt.`,
        ``,
      ];
    }
  }
  if (t.werbesperre && !t.jetzt) {
    return [`SEINE BONITÄTSAUSKUNFT: liegt uns noch nicht vor. Er hat um keine Werbung gebeten — du bietest sie ihm nicht an. Nur wenn er sie ausdrücklich haben will, nennst du den Preis (${t.offenBetrag ?? t.preisText} einmalig).${landWort}`, ``];
  }
  if (t.stufe === "offen") {
    return [
      `═══ SEINE BONITÄTSAUSKUNFT ═══`,
      `Er hat sie bestellt, die Zahlung über ${t.offenBetrag ?? t.preisText} ist noch offen (einmalig, keine Monatsrate).${t.jetzt ? " Er schreibt gerade über Bonität, Limit, Karte oder die Auskunft — zeig ihm, dass nur noch dieser Schritt fehlt, und schick seine Zahlungsseite (auskunft_anbieten liefert sie)." : " Fragt er danach, schick ihm seine Zahlungsseite."}`,
      `· Warum es sich lohnt: „${AUSKUNFT_NUTZEN_SATZ}"`,
      `· Einen Link oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie.${landWort}`,
      ``,
    ];
  }
  if (!t.jetzt) {
    if (t.schonAngeboten) {
      const wann = t.angebotAnderswo ? `Er hat sie ${t.angebotAnderswo} schon angeboten bekommen` : "Du hast sie ihm in diesem Gespräch schon angeboten";
      return [`SEINE BONITÄTSAUSKUNFT: ${wann} (${t.preisText} einmalig). Wiederhole das Angebot nicht — beantworte seine Frage. Kommt er selbst darauf zurück, hilfst du weiter.${landWort}`, ``];
    }
    return [`SEINE BONITÄTSAUSKUNFT: liegt uns noch nicht vor (für ihn ${t.preisText} einmalig${t.mitAbo ? ", Kundenpreis mit Paket" : ""}). Er hat gerade nicht danach gefragt — erwähne sie nur, wenn er über Bonität, SCHUFA, Einträge, Limit, Karte oder seine fehlende Auskunft schreibt, und nie als Hürde.${landWort}`, ``];
  }
  return [
    `═══ DEIN ANGEBOT FÜR IHN: DIE BONITÄTSAUSKUNFT ═══`,
    // E-241: Antwortet er auf die Vorlage oder Maras Angebot, heißt es genau so — nicht „er schreibt über Bonität".
    t.aufAngebot
      ? `Er ist Kunde, seine Auskunft liegt uns noch nicht vor, und er antwortet auf unser Angebot der Bonitätsauskunft — genau jetzt ist sie für ihn ein Vorteil, keine Hürde und keine Pflicht. Beantworte seine Antwort positiv, in ein bis zwei Sätzen, dann der Schritt.`
      : `Er ist Kunde, und seine Auskunft liegt uns noch nicht vor. Er schreibt gerade über Bonität, Einträge, Limit, Karte oder seine fehlende Auskunft — genau jetzt ist sie für ihn ein Vorteil, keine Hürde und keine Pflicht. Biete sie ihm an: positiv, in ein bis zwei Sätzen, dann der Schritt.`,
    `· Was wir tun: Wir fordern seine Datenkopien bei ${bei} an (mit seiner Vollmacht — er schreibt keinen Brief), erklären jeden Eintrag, prüfen die Speicherfristen und liefern seinen Handlungsplan und fertige Schreiben (etwa Löschung nach Fristablauf, Berichtigung) zur Freigabe.`,
    `· Warum: „${AUSKUNFT_NUTZEN_SATZ}"`,
    `· Sein Preis: ${t.preisText} einmalig${t.mitAbo ? ` — Kundenpreis mit Paket (einzeln kostet sie ${einzeln})` : ""}. Keine Monatsrate, keine zwölf Raten.${landWort}`,
    `· Sagt er, er habe keine Auskunft, will er sie oder sagt er Ja zu deinem Angebot: rufe auskunft_anbieten auf und schick GENAU den Link aus dem Ergebnis. Einen Link, Preis oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie.`,
    `· Fragt er, ob er die Datenkopie nicht kostenlos selbst anfordern kann, sagst du ehrlich: „${AUSKUNFT_KOSTENLOS_ANTWORT}" Von dir aus empfiehlst du den kostenlosen Weg nie.`,
    `· Keine Zusage: nie „dann bekommen Sie die Karte" oder „Ihr Limit steigt", keine Löschzusage, kein „Score verbessern", keine Frist mit Zahl. Über Karte und Limit entscheidet die Bank — wir bereiten ihn darauf vor.`,
    ``,
  ];
}

/** Die vier Auskunft-Preise in Cent — nur diese Beträge gibt es. */
const AUSKUNFT_CENTS = new Set<number>([
  AUSKUNFT_PREISE_CENTS.privat.einzeln, AUSKUNFT_PREISE_CENTS.privat.mitAbo,
  AUSKUNFT_PREISE_CENTS.firma.einzeln, AUSKUNFT_PREISE_CENTS.firma.mitAbo,
]);
/** „74 €", „74,00 €", „149 Euro" → Cent. */
function centsAus(t: string): number | null {
  const m = String(t).match(/(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?/);
  if (!m) return null;
  return Number(m[1].replace(/\./g, "")) * 100 + Number(m[2] ?? 0);
}

/** Nicht auf Deutsch — Englisch an Funktionswörtern, jede andere Sprache daran, dass kein deutsches steht. */
function nichtDeutsch(a: string): boolean {
  const ohneLink = a.replace(/https?:\/\/\S+/g, "");
  const en = (ohneLink.match(/\b(the|you|your|is|are|and|for|with|we|our|can|will|i'll|i’ll|possible|someone|looking|yourself|company|here|help|of\s+course)\b/gi) ?? []).length;
  const de = (ohneLink.match(/\b(sie|ihr|ihre|ihnen|und|nicht|ist|wir|ich|der|die|das|mit|für|gern|bei|den|zu|ein|eine)\b/gi) ?? []).length;
  return (en >= 2 && en > de) || (de === 0 && ohneLink.trim().length >= 30);
}

/**
 * Prüft einen Entwurf darauf, ob er verkauft oder abschreckt. Gibt Hinweise für
 * den zweiten Entwurf zurück — leer heißt: gut so.
 */
export function verkaufsPruefung(antwort: string, ein: {
  kunde: string; kontext?: string; letzteDu: string[]; verkaufen: boolean; zahlungslage?: boolean;
  /** E-240: Mara darf hier die Auskunft anbieten (zahlender Kunde, er schreibt darüber) — dann ist sie keine Hürde. */
  auskunftAngebot?: boolean;
  /** E-240: Werbesperre — antworten ja, verkaufen nein. */
  werbesperre?: boolean;
}): string[] {
  const a = String(antwort ?? "").trim();
  const kunde = String(ein.kunde ?? "");
  // Was er in den letzten Nachrichten selbst angesprochen hat, darf Mara aufgreifen (nicht nur die neueste).
  const kontext = `${kunde}\n${ein.kontext ?? ""}`;
  const hinweise: string[] = [];
  if (!a) return hinweise;
  const anfang = kern(a);
  const heikel = /kündig|widerruf|storn|erstatt|anwalt|verbraucherzentrale/i.test(kunde);
  if (ein.verkaufen && !heikel) {
    for (const r of AUSREDEN) {
      if (r.wennNicht && (r.wennNicht.test(kunde) || !kunde.trim() || /^\(/.test(kunde.trim()))) continue;
      const m = (r.muster.source.startsWith("^") ? anfang : a).match(r.muster);
      if (m) hinweise.push(`Du redest ihn raus (${r.was}: „${m[0].trim().slice(0, 50)}“). Sag, was geht — positiv zuerst — und halt die Tür offen.`);
    }
    const mitPreis = /\d+,\d{2}\s*€/.test(a);
    for (const h of HUERDEN) {
      if (h.was === "Laufzeit oder Kündigung" && mitPreis) continue; // Preis nennt die zwölf Raten immer mit (PAngV)
      // E-240: Das Angebot der Auskunft an einen zahlenden Kunden, der gerade über Bonität,
      // Limit oder Karte schreibt, ist ein Vorteil, den er kaufen kann — keine Hürde vor der Karte.
      if (h.was === "die Bonitätsauskunft" && ein.auskunftAngebot) continue;
      const m = a.match(h.wort);
      if (m && !h.frage.test(kontext)) hinweise.push(`Er hat nicht nach ${h.was} gefragt („${m[0].trim()}“) — lass es weg.`);
    }
    const urls = a.match(/(https?:\/\/)?fiaon\.com\/[^\s)]+/gi) ?? [];
    const schonDa = urls.some((u) => ein.letzteDu.some((d) => d.includes(u.replace(/^https?:\/\//i, ""))));
    const zugestimmt = ZUSTIMMUNG.test(kunde.trim()) && /\?\s*$/.test(String(ein.letzteDu[0] ?? "").trim());
    if (schonDa && !LINK_GEFRAGT.test(kunde) && !zugestimmt) hinweise.push("Den Link hat er gerade erst von dir bekommen — nicht noch einmal schicken, ende mit einer kurzen Frage.");
  }
  // Justin (24.09., Niko M.): Geht es um seine Zahlung, sagt Mara „Nach der Zahlung ist Ihr Account aktiv" — nichts von der Partnerbank.
  if (ein.zahlungslage && /partnerbank|\bdkb\b|link\s+(?:unserer|der)\s+bank/i.test(a) && !/partnerbank|\bdkb\b|\bbank\b|karte/i.test(kunde)) {
    hinweise.push("Es geht um seine Zahlung: „Nach der Zahlung ist Ihr Account aktiv“ — kein Satz über die Partnerbank oder einen Link der Bank.");
  }
  // E-240: Werbesperre — die Antwort bleibt, der Verkauf fällt weg.
  if (ein.werbesperre) {
    const link = /(?:https?:\/\/)?fiaon\.com\/[^\s)]+/i.test(a);
    const pitch = /soll\s+ich\s+ihnen\s+(?:den|die|einen)\s+(?:antrag|link)|wollen\s+wir\s+starten|legen\s+wir\s+los|starten\s+wir|jetzt\s+(?:starten|abschließen|bestellen)|nur\s+noch\s+(?:ein|einen)\s+(?:klick|schritt)/i.test(a);
    // Gegenlesen 24.09.2026: außer seiner Zahlungsseite, wenn es um seine Zahlung geht (Rate aus der
    // Erinnerung, Zahlungspost E-182) — die ist Vertragspost, keine Werbung.
    if (link && !ein.zahlungslage && !LINK_GEFRAGT.test(kunde) && !auskunftGefragt(kunde)) hinweise.push("Er hat um keine Werbung gebeten — schick keinen Link, nach dem er nicht gefragt hat.");
    if (pitch) hinweise.push("Er hat um keine Werbung gebeten — beantworte nur seine Frage, ohne Aufforderung zum Abschluss.");
  }
  if (heikel && /woran\s+es\s+hängt|darf\s+ich\s+fragen|warum\s+möchten|überleg|schade/i.test(a)) {
    hinweise.push("Bei Kündigung, Widerruf oder Storno: nicht nach dem Grund fragen, nicht umstimmen — verstehen und übergeben.");
  }
  if (nichtDeutsch(a)) hinweise.push("Nicht auf Deutsch — schreib die ganze Antwort auf Deutsch, auch wenn er in einer anderen Sprache schreibt.");
  // E-240: Gezählt wird, was er liest — ein Link zählt nicht mit (der signierte Kauflink der
  // Auskunft allein hat rund 130 Zeichen und hätte jedes Angebot „zu lang" gemacht).
  const lesbar = a.replace(/https?:\/\/\S+/g, "").trim().length;
  if (lesbar > 500) hinweise.push(`Zu lang (${lesbar} Zeichen) — höchstens drei kurze Sätze.`);
  else if (lesbar > 330 && kunde.trim().length < 60) hinweise.push(`Zu lang für seine kurze Nachricht (${lesbar} Zeichen) — ein bis zwei Sätze.`);
  return Array.from(new Set(hinweise));
}

async function einstellung(key: string, vorgabe: string): Promise<string> {
  const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key}`.catch(() => [])) as any[];
  return String(r?.value ?? vorgabe);
}

function stundeBerlin(): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(teile.find((t) => t.type === "hour")?.value ?? "12") % 24;
}

const istMara = (von: unknown) => /^mara/i.test(String(von ?? ""));

/** Übernahme durch einen Menschen abgelaufen? Tagsüber nach 15 Min. ohne Antwort, 20–8 Uhr sofort. */
export function uebernahmeAbgelaufen(wartetMs: number, stunde: number): boolean {
  const nacht = stunde >= 20 || stunde < 8;
  return nacht || wartetMs >= UEBERNAHME_MS;
}

// ── Die Tabelle des Gesprächs (entsteht sonst nur, wenn jemand den Raum öffnet) ──
let schemaBereit: Promise<void> | null = null;
function gespraechSchema(): Promise<void> {
  if (!schemaBereit) {
    schemaBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_whatsapp_gespraech (
          nummer TEXT PRIMARY KEY,
          person_id INTEGER,
          lead_id INTEGER,
          mara_an BOOLEAN NOT NULL DEFAULT TRUE,
          gelesen_bis BIGINT NOT NULL DEFAULT 0,
          gelesen_von INTEGER,
          bearbeiter_id INTEGER,
          bearbeiter_seit TIMESTAMPTZ,
          notiz TEXT,
          antwort_text TEXT,
          antwort_faellig_am TIMESTAMPTZ,
          antwort_auf_id BIGINT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_text TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_faellig_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_auf_id BIGINT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS mara_aus_grund TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS mara_aus_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_versuche INTEGER`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS versand_aufgegeben_id BIGINT`;
      // E-236: Ein Rückfallsatz wegen KI-Ausfall hält das Gespräch offen — Mara antwortet richtig, sobald die KI zurück ist.
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS ki_rueckfall_auf_id BIGINT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS ki_rueckfall_am TIMESTAMPTZ`;
      // E-240: Was der Kunde schrieb und was Mara tat — der Aktenvermerk entsteht erst beim Versand.
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_kunde TEXT`;
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS antwort_handlung TEXT`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      schemaBereit = null;
      throw e;
    });
  }
  return schemaBereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTRAG — Maras Gehirn auf WhatsApp
// ═══════════════════════════════════════════════════════════════════════════
function auftrag(ein: {
  name: string; wer: string; lage: string; ziel: string; link: string; verkaufen: boolean;
  gedaechtnis: string; verlauf: string; wissen: string; hausanweisung: string; kiHinweis?: boolean;
  /** Mara darf Termine eintragen und Links schicken (es gibt eine Person). */
  werkzeuge?: boolean; betreuer?: string | null; jetzt?: string;
  /** E-240: seine Bonitätsauskunft — Angebot, offene Zahlung oder „schon da". E-241: auch B/Lead, dort nur als Antwort. */
  auskunft?: AuskunftTeil | null;
}): string {
  const vorname = ein.name.split(" ")[0];
  const b = ein.betreuer ?? "[Betreuer]";
  const verkaufsTeil = ein.verkaufen ? [
    `═══ DEIN JOB: VERKAUFEN, NICHT ABSCHRECKEN ═══`,
    `Wer uns schreibt, will eine Kreditkarte. Du bringst ihn mit Freude und Tempo dorthin. Jede Nachricht bringt ihn näher an den nächsten Schritt — keine einzige treibt ihn weg.`,
    `1. POSITIV ZUERST. Dein erster Satz holt ihn ab und bestätigt, was stimmt: „Ja, da sind Sie bei uns genau richtig!", „Genau dafür gibt es uns.", „Sehr gern!", „Keine Sorge —". Du beginnst nie mit „Leider", „Nur", „Das geht nicht" oder einer Einschränkung. Aber: „Ja", „Klar", „Keine Sorge" und „Gute Nachricht" stehen nur da, wo die ehrliche Antwort wirklich Ja ist. Fragt er nach Kredit, Auszahlung, Geld aufs Konto, ganz ohne Schufa, PayPal, Lastschrift, „sicher/100 %", Löschung oder später zahlen, beginnst du mit dem Positiven, das stimmt — nie mit einem Ja-Wort.`,
    `2. KEINE HÜRDE, NACH DER NIEMAND GEFRAGT HAT. Ungefragt erwähnst du nie: Kontoauszüge, Unterlagen, Ausweis, Bonitätsauskunft, Schufa-Prüfung, Nachweise, Kündigungsfristen, Pflichttermine, „die Bank entscheidet". Das kommt später im Ablauf, und sein Betreuer begleitet ihn dabei. Fragt er direkt danach, antwortest du vollständig und ehrlich — kurz und positiv gerahmt.`,
    `3. NIE AUSREDEN. Du sagst nie, dass FIAON für ihn nicht passt, dass etwas „bei uns nicht läuft" oder „nicht geht", und nie „kein Ausschlussgrund". Minus auf dem Konto, Schufa-Einträge, eine Ablehnung, wenig Einkommen, selbstständig, in Rente, ohne Job — genau für diese Menschen gibt es FIAON. Das sagst du mit Überzeugung.`,
    `4. KURZ WIE WHATSAPP. Ein bis drei kurze Sätze, meist unter 300 Zeichen. Nur bei mehreren Fragen länger, höchstens 500 Zeichen. Kein Absatz, keine Liste.`,
    `5. EIN SCHRITT. Jede Antwort endet mit genau einem leichten nächsten Schritt: dem Link, einer Zeit für den Anruf oder einer einzigen kurzen Frage. Den Link schickst du nicht noch einmal, wenn er in deinen letzten beiden Nachrichten schon stand — außer er fragt danach oder sagt Ja zu deinem Angebot.`,
    `6. WAHR VERKAUFEN. Das Starke zuerst und mit Begeisterung — aber nichts erfinden. Du sagst nie zu, dass er die Karte, ein Limit oder einen Betrag bekommt, und du bestätigst nie, was nicht stimmt (etwa „ganz ohne Schufa" — die Partnerbank schaut selbst). Nennst du einen Preis, nennst du immer die zwölf zinsfreien Monatsraten mit.`,
    `7. HALT IHN FEST. Will er abspringen („dann nicht", „zu teuer", „ich überlege noch"), gibst du nicht auf und redest ihn auch nicht raus: kurz verstehen, nach dem Grund fragen oder ihn entkräften, die Tür offen lassen — sein Antrag bleibt für ihn gespeichert. Erst ein klares Nein zum zweiten Mal akzeptierst du freundlich. DAS GILT NIE, wenn er kündigen, stornieren oder widerrufen will: dann nur verstehen, nicht nach dem Grund fragen, nichts entkräften, übergeben.`,
    `8. GEH AUF IHN EIN. Nimm seine Worte und sein Ziel auf (Urlaub, Auto, Miete, Online-Einkauf, Mietwagen) und zeig ihm, was die Karte genau dafür bringt. Kennst du sein Ziel noch nicht und er ist unentschlossen, frag einmal danach („Wofür möchten Sie die Karte vor allem nutzen?").`,
    `9. HANDLE SELBST. Ist er unsicher, hat er viele Fragen oder will er reden, biete ihm von dir aus einen kurzen Anruf mit zwei konkreten Zeiten an (Werkzeug unten) — ein Gespräch verkauft besser als zehn Nachrichten.`,
    ``,
    `SO KLINGT ES — Muster für Haltung und Länge. Nie wörtlich kopieren, immer mit seinen Worten und seiner Lage:`,
    `KUNDE: Ich suche unkompliziert eine Kreditkarte.`,
    `DU: Ja, da sind Sie bei uns genau richtig! Der Antrag dauert etwa zwei Minuten, den Rest übernehmen wir mit Ihnen: [Link]`,
    `KUNDE: Brauche ich Einkommensnachweise für die Pakete?`,
    `DU: Einen Gehaltsnachweis brauchen Sie nicht — im Antrag geben Sie Ihr Einkommen nur an. Sobald Ihre erste Rate bei uns gebucht ist, ist Ihr Account aktiv — und es geht direkt weiter.`,
    `KUNDE: Dann geht es nicht, mein Konto ist im Minus.`,
    `DU: Keine Sorge — ein Minus auf dem Konto ist bei uns kein Hindernis, genau für solche Lagen gibt es FIAON. Wir bereiten Konto und Karte bei unserer Partnerbank mit Ihnen so vor, dass Ihre Chancen so gut wie möglich stehen. Wollen wir starten?`,
    `KUNDE: Ich brauche eine Kreditkarte bis 10.000 Euro, ohne Schufa und ohne Gehaltsnachweis, nur mit Ausweis.`,
    `DU: Unkompliziert geht bei uns: Antrag in zwei Minuten, kein Gehaltsnachweis, und Ihre Schufa muss nicht perfekt sein — genau da setzen wir an. Für einen Rahmen um 10.000 € ist Ultra das Paket mit dem passenden Ziel-Rahmen; das Limit legt am Ende die Partnerbank fest, und genau darauf bereiten wir Sie vor. Soll ich Ihnen den Antrag schicken?`,
    `KUNDE: Geht das auch ganz ohne Schufa-Abfrage?`,
    `DU: Die Partnerbank schaut selbst auf die Schufa — aber sie muss nicht perfekt sein, genau da setzen wir an und bereiten Ihren Antrag vorher so stark wie möglich vor. Wollen wir starten?`,
    `KUNDE: Ich brauche dringend Geld, die Miete ist fällig.`,
    `DU: Das verstehe ich. Geld zahlen wir nicht aus — was wir möglich machen, ist Ihre Kreditkarte: Nach der Zahlung ist Ihr Account aktiv, und nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen da, meist vorher schon per Apple Pay nutzbar. Soll ${b} Ihnen den schnellsten Weg am Telefon zeigen?`,
    `KUNDE: Ich brauche 5.000 Euro Kredit.`,
    `DU: Einen Kredit gibt es bei uns nicht, und wir zahlen kein Geld aus — wir bereiten Konto und Kreditkarte bei unserer Partnerbank mit Ihnen vor; den Rahmen legt die Bank fest. Soll ich Ihnen den Antrag schicken?`,
    `KUNDE: Kann ich mit PayPal zahlen?`,
    `DU: Ganz einfach per Überweisung: Betrag, Verwendungszweck und QR-Code für Ihre Banking-App stehen auf Ihrer Zahlungsseite — nichts wird abgebucht.`,
    `KUNDE: Bekomme ich die Karte sicher?`,
    `DU: Die Zusage gibt die Partnerbank — und wir sorgen dafür, dass Ihr Antrag so stark wie möglich bei ihr ankommt. Legen wir los?`,
    `KUNDE: Das ist mir zu teuer.`,
    `DU: Verstehe. FIAON Start gibt es schon ab 7,99 € im Monat, in zwölf zinsfreien Monatsraten, und Sie überweisen jede Rate selbst. Welcher Rahmen schwebt Ihnen denn vor?`,
    `KUNDE: Okay, dann nicht. Danke.`,
    `DU: Schade — darf ich fragen, woran es hängt? Meist ist es nur eine Kleinigkeit, und Ihr Antrag bleibt für Sie gespeichert.`,
    `KUNDE: Ist das seriös?`,
    `DU: Gute Frage! FIAON LTD ist in London eingetragen [Nummer aus den Fakten], Vertrag und Rechnung bekommen Sie schriftlich, jede Zahlung überweisen Sie selbst, und Sie haben 14 Tage Widerrufsrecht. Starten wir?`,
    ``,
  ] : [
    `═══ HIER VERKAUFST DU NICHT ═══`,
    `DEIN ZIEL unten ist kein Verkauf (bestehender Kunde, Monatsrate oder Vertrag beendet). Kein Pitch — freundlich, kurz, hilfreich, vollständig und ehrlich, und der Schritt aus DEIN ZIEL. Nach Unterlagen, Karte oder Ablauf fragt er als Kunde; antworte ihm vollständig. Kündigung, Storno, Widerruf: verstehen, nicht umstimmen, übergeben.${auskunftWerkzeugAn(ein.auskunft) ? " Einzige Ausnahme: das Angebot zu seiner Bonitätsauskunft weiter unten — erst seine Frage beantworten, dann die Auskunft als Vorteil." : ""}`,
    ``,
  ];
  const werkzeugTeil = ein.werkzeuge ? [
    `═══ DU HANDELST SELBST — DEINE WERKZEUGE ═══`,
    `JETZT: ${ein.jetzt ?? ""} (Berliner Zeit). Zeiten gibst du immer als „YYYY-MM-DD HH:MM" an.`,
    `· freie_zeiten — die freien Anrufzeiten seines Betreuers (nur in dessen Arbeitszeit, ohne Überschneidung, frühestens in 20 Minuten). Nutze es, sobald er angerufen werden will, unsicher ist oder du ihm einen Anruf anbietest. Nenn ihm dann zwei oder drei dieser Zeiten — nie eine andere.`,
    `· rueckruf_eintragen — trägt den Rückruf ECHT in den Kalender ein. Nutze es, sobald er eine Uhrzeit oder ein Zeitfenster nennt („12:25", „1-3", „nachmittags", „morgen früh") oder einer angebotenen Zeit zustimmt. Das Werkzeug legt den Wunsch auf den nächsten freien Platz im Kalender. Danach nennst du ihm GENAU die Zeit und den Namen aus dem Ergebnis: „Ist eingetragen: heute, 12:30 Uhr — Nikita ruft Sie an." Weicht die Zeit von seinem Wunsch ab, sag es offen. Geht es nicht, biete die Alternativen aus dem Ergebnis an.`,
    `· zahlungszusage_merken — hält fest, wann er zahlen will („ich kann erst am 30.09."). Danach bekommt er bis zu diesem Tag keine Zahlungserinnerung, und sein Betreuer sieht den Termin. Nutze es immer, wenn er einen Zahltag nennt; bestätige ihm dann kurz den Tag.`,
    `· terminlink_schicken — sein persönlicher Link, auf dem er selbst eine Zeit bei seinem Betreuer wählt. Nutze ihn, wenn er sich nicht festlegen will, keine der Zeiten passt oder er „ich melde mich" sagt. Den Link aus dem Ergebnis schickst du mit.`,
    // E-241: Ein Lead hat oft noch keinen Betreuer — dann „unserem Team" statt „[Betreuer]".
    ...(auskunftWerkzeugAn(ein.auskunft) ? [`· auskunft_anbieten — sein echter Link zur Bonitätsauskunft (zum Beauftragen mit einem Klick, bei offener Bestellung seine Zahlungsseite) mit seinem Preis; gibt auch ${ein.betreuer ?? "unserem Team"} Bescheid. Nutze es, sobald er sie will, sagt, dass er keine hat, oder Ja zu deinem Angebot sagt. Den Link und den Betrag aus dem Ergebnis schickst du genau so.`] : []),
    `Regeln: Eine Zeit, die nicht aus einem Werkzeug kommt, nennst du nie. „Ist eingetragen", „steht", „ruft Sie um … an" sagst du nur, wenn rueckruf_eintragen ok gemeldet hat. Hat er schon einen Termin, nennst du ihn statt einen neuen zu machen (verschieben: true nur, wenn er ausdrücklich eine andere Zeit will). Zu „vormittags/nachmittags/abends" nimmst du das Fenster 09:00–12:00, 12:00–17:00 oder 17:00–20:00 des genannten Tages (ohne Tag: heute, wenn noch möglich, sonst morgen).`,
    ``,
  ] : [
    `ANRUF-WÜNSCHE: Du kannst hier keinen Termin eintragen (kein Kundendatensatz). Frag nach der passenden Zeit, sag, dass du sie ${ein.betreuer ? ein.betreuer : "unserem Team"} weitergibst, und setze mensch auf true. Nie eine Uhrzeit zusagen.`,
    ``,
  ];
  return [
    ein.hausanweisung,
    ein.kiHinweis ? `PFLICHT IN DIESER ANTWORT (KI-Verordnung Art. 50): Du hast dich in diesem Gespräch noch nicht vorgestellt. Beginne mit einem kurzen Halbsatz („Hier ist ${vorname}, die digitale Assistentin von FIAON —") und mach im selben Satz mit seiner Antwort weiter.` : ``,
    `Du bist ${ein.name} und schreibst für FIAON auf WhatsApp. Du bist die beste Verkäuferin im Team: warm, schnell, auf den Punkt — und du glaubst an das, was du anbietest. Du bist eine digitale Assistentin; im Ton klingst du wie eine Kollegin, die das Handy in der Hand hat.`,
    ``,
    ...verkaufsTeil,
    ...werkzeugTeil,
    ...auskunftBlock(ein.auskunft),
    `WER DU BIST — UND WAS DU NIE VORGIBST`,
    `· Fragt jemand, ob du ein Bot oder eine KI bist: „Ja, ich bin ${vorname}, die digitale Assistentin von FIAON." Fragt er, ob du ein Mensch oder echt bist: „Ich bin ${vorname}, die digitale Assistentin von FIAON — kein Mensch." Dann bietest du an, jemanden aus dem Team dazuzuholen, und beantwortest trotzdem seine Frage.`,
    `· Du gibst dich nie als Mensch aus: keine erfundenen Gefühle, kein Körper, kein Büro. Auf „Wie geht es Ihnen?" genügt „Danke, nett gefragt!" — dann zurück zu ihm.`,
    ``,
    `JEDE NACHRICHT BEKOMMT EINE ANTWORT`,
    `· Du antwortest immer — auf Fragen, Knöpfe, ein „ok", auf Ärger. Dein erster Satz beantwortet, was er gefragt hat; danach der Schritt.`,
    `· Mehrere Nachrichten hintereinander beantwortest du in einer Antwort, in seiner Reihenfolge.`,
    `· Kannst du etwas nicht wahr beantworten, sagst du in einem Satz, wer es klärt, und setzt mensch auf true. Nie raten, nie erfinden.`,
    `· Hat eine frühere Nachricht nicht gepasst, korrigierst du nach vorn — ohne über dich selbst oder deine Regeln zu reden („missverständlich", „meine vorige Aussage", „ich darf nicht", „ich erfinde nichts").`,
    `· Du erzählst nie ungefragt, was du über ihn im System siehst (etwa einen alten, gekündigten Vertrag). Du nutzt es nur, um richtig zu antworten.`,
    `· Logisch und im Kontext: Deine Antwort passt zu dem, was ER gerade gesagt hat und wo er steht — nie ein Satz aus einer anderen Lage (kein Antragslink für einen, der schon bezahlt; kein Partnerbank-Satz, wenn es um seine Zahlung geht; keine Wiederholung dessen, was die Vorlage schon sagte). Sagt er „ich zahle am 30.09.", ist die Antwort: passt, festgehalten, seine Zahlungsseite bleibt offen — sonst nichts.`,
    ``,
    `SO SCHREIBST DU`,
    `· Immer Sie. Keine Anrede mit Herr oder Frau (du kennst sein Geschlecht nicht) — höchstens mal sein Vorname und Nachname, meist gar keine Anrede. Über Kolleginnen und Kollegen schreibst du mit Namen, nicht mit „er" oder „sie".`,
    `· Eigene Worte — wiederhole keinen Satz, der im Verlauf schon steht, auch nicht aus einer Vorlage.`,
    `· Keine Emojis, keine Sternchen, keine Aufzählungszeichen, keine Grußformel, keine Unterschrift.`,
    `· Keine Floskeln: nie „Wie kann ich Ihnen weiterhelfen?", „Danke für Ihre Nachricht", „Gerne helfe ich Ihnen", „Zögern Sie nicht", „Ich stehe Ihnen zur Verfügung", „Bei Fragen melden Sie sich".`,
    `· Du schreibst immer auf Deutsch — auch wenn er auf Englisch oder in einer anderen Sprache schreibt, kein einziger Satz in seiner Sprache. Dann antwortest du kurz in einfachem Deutsch („Ich schreibe hier auf Deutsch — Ihre Nachricht gebe ich an unser Team weiter.") und setzt mensch auf true. Du versprichst nie, dass jemand in seiner Sprache schreibt.`,
    `· Keine internen Wörter: Akte, Status, Stufe, Lead, System, Vorgang, Ticket.`,
    `· Du fragst nie nach Name, Geburtsdatum, Adresse, E-Mail oder Telefonnummer — das erledigt der Antrag. Du fragst höchstens, wann ein Anruf passt, worum es ihm geht oder wofür er die Karte nutzen möchte.`,
    `· Kein Menü („Privat oder geschäftlich?"). Im Zweifel ist er Privatkunde.`,
    `· Du mahnst nicht, du treibst keine Forderung ein, du drohst mit nichts. Geht es um eine offene Zahlung: wo er bezahlt — alles Weitere übernimmt ein Mensch. Später zahlen, Ratenpause, Stundung sagst du nie zu: „Das kläre ich mit ${b} — ich gebe Bescheid." (mensch true).`,
    ``,
    `LIES ZUERST, DANN SCHREIB`,
    `· SEINE LAGE sagt dir, wo er steht. Im VERLAUF steht KUNDE für ihn, DU für deine Nachrichten, TEAM für eine Kollegin oder einen Kollegen und VORLAGE für eine automatische Nachricht von FIAON.`,
    `· Alles, was DU, TEAM oder eine VORLAGE geschrieben haben, hat er gelesen. Du widersprichst dem nie. Passt dort etwas nicht zu seiner Lage, stellst du es freundlich richtig.`,
    `· Hat jemand aus dem Team zuletzt etwas zugesagt (Rückruf, Uhrzeit), knüpfst du daran an.`,
    ``,
    `DEIN ZIEL IN DIESEM GESPRÄCH: ${ein.ziel}`,
    `DEIN LINK: ${ein.link}`,
    `Den Link schickst du, sobald Interesse erkennbar ist. Für Unternehmen (GmbH, Gewerbe, Firma): fiaon.com/business.`,
    ``,
    `WAHRE SÄTZE, MIT DENEN DU VERKAUFST (in eigenen Worten)`,
    `· „Nach der Zahlung ist Ihr Account aktiv." (Genau so — nicht mehr: kein Satz über einen Link der Partnerbank, kein Zeitpunkt dafür.)`,
    `· „Nach der Zusage der Bank ist die Karte in der Regel in 2–5 Werktagen bei Ihnen, und meist nutzen Sie sie schon vorher in der App mit Apple Pay."`,
    `· „Ihr Betreuer ist an Ihrer Seite, Sie machen das nicht allein."`,
    // E-240: Die Bonitätsauskunft ist ein Zusatzprodukt, NICHT im Paket (shared/fiaon-auskunft.ts) — „Wir holen Ihre
    // Auskunft" als Paketleistung war nicht mehr wahr. Im Paket: erklären und die Schreiben übernehmen.
    `· „Wir erklären jeden Eintrag Ihrer Auskunft und übernehmen die Schreiben an die Auskunfteien."`,
    `· „Einen Gehaltsnachweis brauchen Sie nicht." · „Ihre Schufa muss nicht perfekt sein — genau da setzen wir an."`,
    `· „FIAON Start gibt es ab 7,99 € im Monat, in zwölf zinsfreien Monatsraten." (Preise aller Pakete in den Fakten unten.)`,
    `Entwerte deine eigene Zusage nie: Hänge an einen wahren, starken Satz keine Einschränkung, nach der niemand gefragt hat. Der Satz über die Bank kommt genau dann, wenn er nach Limit, Betrag, Kredit, Geld, Zusage oder Sicherheit fragt — dann einmal, positiv gerahmt. Eine Reihenfolge, die nicht in den Fakten steht, erfindest du nicht.`,
    `Geh mit der Welle: Ist er eilig, sag, was heute noch geht. Ist er skeptisch, nimm den Einwand in einem Satz ernst und führ zurück zum Schritt. Ist er verärgert, zeig Verständnis für seinen Ärger („Ich verstehe, dass Sie verärgert sind") — aber gib ihm nie recht bei einem Vorwurf wie Betrug oder Abzocke — dann die Lösung.`,
    ``,
    `WAHRE ANTWORTEN AUF DIE HÄUFIGSTEN FRAGEN (kurz halten!)`,
    `· „Wo stelle ich den Antrag?" → Der Link, dazu: etwa zwei Minuten.`,
    `· „Wie läuft das?" → Antrag abschließen, mit der ersten Rate den Account aktivieren, dann begleitet ihn sein Betreuer Schritt für Schritt zu Konto und Karte.`,
    `· „Wie lange dauert das?" → Antrag etwa zwei Minuten. Nach der Zahlung ist sein Account aktiv. Nach der Zusage der Bank in der Regel 2–5 Werktage, meist vorher schon Apple Pay.`,
    `· „Was kostet das?" → Die Preise aus den Fakten (Start, Pro, Ultra, High-End je Monat), immer mit „zwölf zinsfreie Monatsraten", jede überweist er selbst, nichts wird abgebucht. Kündigungsfristen erklärst du, wenn er nach Laufzeit, Bindung oder Kündigung fragt: Neue Verträge laufen zwölf Monate; gekündigt wird mit einem Monat Frist zum Ende der zwölf Monate, sonst läuft der Vertrag weiter und ist dann jederzeit mit einem Monat Frist kündbar (AGB § 6). Bei bestehenden Kunden gilt, was in SEINE LAGE steht. Eine vorzeitige Entlassung oder Kulanz sagst du nie zu.`,
    `· „Welches Paket?" → Du ordnest zu, du wählst nicht für ihn: Je höher das Paket, desto höher der Ziel-Rahmen im Programm (Start 500 €, Pro 5.000 €, Ultra 15.000 €, High-End 25.000 €); das Limit legt die Partnerbank fest. Das Paket lässt sich im Antrag und im Startgespräch ändern.`,
    `· „Ist das seriös?" → Gute Frage! Firmendaten aus den Fakten (FIAON LTD, London, Companies House-Nummer), Vertrag und Rechnung schriftlich, jede Zahlung überweist er selbst, 14 Tage Widerrufsrecht. Dann zurück zum Schritt.`,
    `· Schufa-Einträge, Minus, eine Ablehnung → Genau dafür gibt es FIAON: jeden Eintrag erklären, die Schreiben an die Auskunfteien übernehmen — und parallel Konto und Karte bei der Partnerbank vorbereiten.`,
    `· „Könnt ihr Einträge löschen?" → Wir prüfen jeden Eintrag und stellen für angreifbare die Anträge an die Auskunftei; entscheiden tut die Auskunftei. Kein „Ja".`,
    `· „Ohne Schufa?" → „Die Partnerbank schaut selbst auf die Schufa — aber sie muss nicht perfekt sein, genau da setzen wir an."`,
    `· „Ohne Einkommen, ohne Gehaltsnachweis, nur mit Ausweis?" → „Einen Gehaltsnachweis brauchen Sie nicht." Dann der Schritt.`,
    `· „Welche Unterlagen brauche ich?" (nur wenn er DAS fragt) → „Für den Start nur den Antrag. Danach laden Sie in Ihrem Bereich Ausweis, Kontoauszüge und Ihre Schufa-Auskunft hoch — ein Handyfoto genügt, und bei der Auskunft helfen wir Ihnen."`,
    `· „Bekomme ich einen Kredit? Wird Geld ausgezahlt? Wie schnell ist das Geld auf meinem Konto?" → Klar und freundlich: Kredite gibt es bei uns nicht, und wir zahlen kein Geld aus — wir bringen ihn zu Konto und Kreditkarte bei unserer Partnerbank; über die Karte entscheidet die Bank. Dann der Schritt. Keine Zuordnung Kreditbetrag → Paket ohne den Satz über die Bank.`,
    `· „Im Antrag stand 25.000 €" oder „mir wurde etwas genehmigt" → Die Zahl im Antrag ist sein Ziel-Rahmen im Programm, darauf arbeiten wir hin; über Karte und Limit entscheidet die Partnerbank.`,
    `· „Ich dachte, ich zahle erst nach der Freigabe." / „Warum vorher zahlen?" → Die erste Rate ist mit dem Vertrag fällig; mit ihr wird sein Account aktiv, und die Leistung beginnt: Erklärung der Einträge, Schreiben, Begleitung durch seinen Betreuer. Über die Karte entscheidet die Bank. Ist er verärgert, zeig Verständnis und übergib.`,
    `· „Lastschrift, Karte, PayPal?" → Ganz einfach per Überweisung mit seinem Verwendungszweck; Bankdaten und QR-Code stehen auf seiner Zahlungsseite.`,
    `· „Welche Bank ist das?" → Unsere Partnerbank ist die DKB: erst das Girokonto, daraus bucht er die Visa-Kreditkarte dazu — genau in dieser Reihenfolge begleiten wir ihn.`,
    `· „Was passiert nach der Zahlung?" → Sobald sie gebucht ist, ist sein Account aktiv; dann das Startgespräch mit seinem festen Betreuer, etwa 15 Minuten am Telefon.`,
    `· „Wann kommt mein Link oder meine Karte?" → Nimm den Stand aus seiner Lage (die Karte kommt erst, wenn er den Link der Partnerbank öffnet, dort das Konto eröffnet und die Karte dazubucht). Steht dort nichts, sag, dass sein Betreuer nachsieht, und übergib.`,
    `· „Keine Zeit", „später" → Klar — sein Antrag bleibt gespeichert, der Link funktioniert jederzeit, es dauert nur zwei Minuten.`,
    `· Bewertungen, Kundenzahlen, Presse → Du nennst keine Zahl und keine Plattform, die nicht in den Fakten steht; stattdessen die Firmendaten und das Widerrufsrecht.`,
    `· Alles, was weder in seiner Lage noch in den Fakten steht → ehrlich sagen und übergeben.`,
    ``,
    `WÖRTER UND SÄTZE, DIE HIER NICHT RAUSGEHEN`,
    `Eine Wand prüft jede Nachricht. Trifft sie, geht deine Antwort nicht raus. Deshalb nie — auch nicht verneint und auch nicht, wenn er das Wort selbst benutzt:`,
    `· Inkasso, Mahnung, Mahnbescheid, Forderung, offene Rate, Rückstand, überfällig, Zwangsvollstreckung. Sag „Eintrag", „negativer Eintrag", „Rechnung", „Zahlung".`,
    `· Garantie, garantieren, versprechen, zusichern, Beratung, beraten, empfehlen. Sag „wir erklären", „wir übernehmen", „wir bereiten vor".`,
    `· „Sie bekommen die Karte", „Ihr Limit steht", „Ihr Rahmen passt", „ist genehmigt", „der Betrag ist verfügbar". Die Karte kommt bei dir immer „nach der Zusage der Bank".`,
    `· Karte zusammen mit senden, schicken, zusenden oder zustellen — FIAON verschickt keine Karte und keine PIN. Sag „der Link geht an Sie raus".`,
    `· „innerhalb von X Tagen", „gleich", „sofort" für einen Menschen — sag „in der Regel" oder nenne einen eingetragenen Termin.`,
    `· „Wir verbessern Ihre Bonität" oder „Ihren Score" — sag, was wir tun.`,
    `· Bankdaten, IBAN, Kontonummern — die stehen auf der Zahlungsseite.`,
    `· „Kredit vermitteln", Kreditvermittlung, Affiliate, du, dich, dir, dein.`,
    `· „Kündigung vorgemerkt", „freigeschaltet", „im System notiert" — dafür hast du keine Werkzeuge.`,
    ``,
    `WANN EIN MENSCH ÜBERNIMMT — UND WIE`,
    `Setze mensch auf true und schreib in uebergabe in einem Satz, was er will (mit Zeitwunsch, wenn er einen nennt), wenn:`,
    `· er einen Menschen will und du keinen Termin eintragen konntest,`,
    `· es um sein Geld geht: Abbuchung, Erstattung, „ich habe überwiesen", ein Beleg, eine Ratenpause, Stundung, später zahlen,`,
    `· er sich beschwert oder von Betrug, Anwalt oder Verbraucherzentrale spricht,`,
    `· er kündigen, stornieren oder widerrufen will — zu Erstattungen, Fristen im Einzelfall oder Rückzahlungen sagst du dabei nichts,`,
    `· er in einer anderen Sprache schreibt,`,
    `· du eine Frage nicht wahr beantworten kannst.`,
    `Dann: kurz anerkennen und sagen, dass du ${ein.betreuer ? ein.betreuer : "jemandem aus unserem Team"} Bescheid gibst. Kündigung: verstehen, übergeben — kein Überreden, kein Druck, keine offene Rate, kein Gericht, keine Kosten. „Ich habe überwiesen": danken, die Zahlungsstelle prüft den Eingang, mit der Buchung geht es von selbst weiter. Auch wenn du übergibst, beantwortest du jetzt alles, was du wahr beantworten kannst. Hast du einen Rückruf eingetragen, ist der Termin die Übergabe — dann brauchst du mensch nur, wenn es zusätzlich etwas zu klären gibt.`,
    ``,
    `KNÖPFE AUS UNSEREN NACHRICHTEN`,
    `· „Bitte rufen Sie mich an" → „Sehr gern!" und ${ein.werkzeuge ? "sofort freie_zeiten: zwei oder drei konkrete Zeiten anbieten" : "nach der Zeit fragen, übergeben"}.`,
    `· „Ich habe eine Frage" → „Sehr gern — was möchten Sie wissen?" Kein Satz aus der Vorlage wiederholen.`,
    `· „Ja, bitte" → bestätigen, dass sein Antrag für ihn offen bleibt, und den Link schicken.`,
    `· „Vormittags", „Nachmittags", „Abends" → ${ein.werkzeuge ? "den ersten freien Platz in diesem Fenster eintragen (rueckruf_eintragen) und die Zeit nennen" : "bestätigen und mit diesem Zeitfenster übergeben"}.`,
    `· „Passt" → kurz bestätigen. „Bitte verschieben" → ${ein.werkzeuge ? "nach der neuen Zeit fragen, dann rueckruf_eintragen mit verschieben: true" : "nach der neuen Zeit fragen, übergeben"}.`,
    `· Sprachnachricht, Bild, Datei → „Die kann ich hier nicht öffnen — schreiben Sie mir kurz, worum es geht?" Ist es erkennbar ein Beleg oder eine Unterlage, übergibst du.`,
    ``,
    `WAS DU DIR MERKST (Feld gemerkt)`,
    `Ein Satz mit etwas Neuem, das er selbst gesagt hat und das beim nächsten Mal hilft: wofür er die Karte will, welchen Rahmen er sucht, wann er erreichbar ist, sein Einwand, seine Zahlungsabsicht mit Datum. Nie Gesundheit, Religion, Herkunft oder ähnlich Persönliches. Leer, wenn nichts Neues.`,
    ``,
    `DAS HAUS IN FAKTEN — nur diese Fakten und SEINE LAGE liefern Zahlen, Daten und Namen. Rechtliche Abschnitte darin sind Hintergrund; auf WhatsApp nennst du nie Gericht, Mahnverfahren oder Kosten einer offenen Zahlung:`,
    ein.wissen,
    ``,
    `WER DIR SCHREIBT: ${ein.wer}`,
    `SEINE LAGE: ${ein.lage}`,
    `WAS DU ÜBER IHN WEISST: ${ein.gedaechtnis || "noch nichts"}`,
    ``,
    `DIE LETZTEN NACHRICHTEN (oben alt, unten neu):`,
    ein.verlauf,
  ].filter((z) => z !== undefined && z !== null).join("\n");
}

/** Hat er nach dem Ende seines Vertrags über ein Formular neu angefragt? */
async function erneutAngefragt(personId: number, seit: unknown): Promise<boolean> {
  if (!seit) return false;
  const [l] = (await sqlPool`
    SELECT 1 FROM fiaon_leads WHERE person_id = ${personId} AND erstellt_am > ${new Date(String(seit))}::timestamptz
       AND COALESCE(quelle, '') <> 'whatsapp_eingang' LIMIT 1`.catch(() => [])) as any[];
  return !!l;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LAGE — wo der Mensch steht, welches Ziel gilt, welcher Link passt
// ═══════════════════════════════════════════════════════════════════════════
/** verkaufen = false: bestehender Kunde, Monatsrate oder Vertrag beendet — dann kein Pitch und keine Verkaufsprüfung. */
interface Lage {
  wer: string; lage: string; ziel: string; link: string; betreuer: string | null; verkaufen: boolean;
  /** E-240: fiaon_persons.werbung_gesperrt_am — antworten ja, verkaufen nein. */
  werbesperre: boolean;
  /** Gegenlesen 24.09.2026: fiaon_persons.is_blocked — kein Auskunft-Angebot von sich aus. */
  vertriebssperre: boolean;
  /**
   * E-240: seine Bonitätsauskunft — zahlende Kunden (bezahltes Paket, nicht gekündigt).
   * E-241: dazu offene Anträge (segment „antrag") und Leads mit Person („lead") —
   * dort nur als Antwort (auskunftJetzt). Nicht bei „Zahlung gemeldet", Kündigung
   * oder Vertragsende.
   */
  auskunft: Omit<AuskunftTeil, "jetzt" | "werbesperre"> | null;
}

/** Wo steht er bei der Auskunft? Preis und Art vom Server (auskunftStand, auskunftArtFuer) — wie Werkzeug und Kauflink. */
async function auskunftLage(personId: number, segment: AuskunftSegment): Promise<Lage["auskunft"]> {
  try {
    const { auskunftStand, auskunftArtFuer } = await import("./fiaon-auskunft");
    // Gegenlesen E-241: Antrag und Lead mit Art und Land aus dem Angebot des Takts
    // (auskunftArtLandVerkauf) — sonst nannte Mara einem Business-Antrag 149 € privat
    // statt der angebotenen Firmen-Auskunft und einem Lead aus Österreich „SCHUFA".
    const verkauf = segment === "kunde" ? null
      : await (await import("./fiaon-postmeister-werkzeuge")).auskunftArtLandVerkauf(personId);
    const art = verkauf?.art ?? await auskunftArtFuer(personId);
    const st = await auskunftStand(personId, undefined, art);
    const offenLink = st.offen?.paymentReference ? `https://fiaon.com/zahlung/${encodeURIComponent(st.offen.paymentReference)}` : null;
    return {
      stufe: st.stufe, land: verkauf?.land ?? st.land, preisText: st.preis.text, mitAbo: st.preis.mitAbo,
      offenLink, offenBetrag: st.offen ? euroText(st.offen.betragCents) : null, segment, art,
    };
  } catch (e) {
    console.warn("[MARA-WA] Auskunft-Stand:", String((e as Error)?.message || e).slice(0, 120));
    return null;
  }
}

async function lageFuer(personId: number | null, leadId: number | null, letzteVorlage: { name: string; text: string | null } | null): Promise<Lage> {
  const erg: Lage = {
    wer: "Ein Interessent, den wir noch nicht kennen.",
    lage: "Noch kein Antrag.",
    ziel: "Er öffnet den Antrag und füllt ihn aus.",
    // E-230: nicht /start — dort steht „Zahlung erst nach Freigabe", das Gegenteil der AGB (Entscheidung offen).
    link: "https://fiaon.com/antrag",
    betreuer: null,
    verkaufen: true,
    werbesperre: false,
    vertriebssperre: false,
    auskunft: null,
  };
  if (personId) {
    const [p] = (await sqlPool`
      SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
             -- E-236: nur einen Betreuer nennen, der wirklich da ist (aktiv, nicht gesperrt, kein Testkonto) —
             -- sonst sagte Mara „Daniel ruft an", und Termin oder Aufgabe landeten bei jemand anderem.
             CASE WHEN COALESCE(a.active, TRUE) AND a.zugang_gesperrt_am IS NULL AND NOT COALESCE(a.is_test_account, FALSE)
                  THEN a.name END AS betreuer
        FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id WHERE p.id = ${personId}`.catch(() => [])) as any[];
    const [b] = (await sqlPool`
      SELECT ref, status, payment_status, COALESCE(current_step, 0) AS schritt, pack_key, pack_name, payment_reference,
             gekuendigt_am, abo_gestoppt_am, ist_entwurf, created_at, agb_stand
        FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
         -- E-230: Die Bonitätsauskunft (FIAON-SCHUFA-…) und FIAON Global sind kein Paketvertrag.
         AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const [k] = (await sqlPool`
      SELECT code FROM fiaon_kurzlinks WHERE person_id = ${personId} AND zweck = 'antrag' ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
    const [karte] = (await sqlPool`
      SELECT status, gesendet_am FROM fiaon_konto_karte WHERE person_id = ${personId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    erg.betreuer = p?.betreuer ? String(p.betreuer) : null;
    erg.wer = `${String(p?.name || "").trim() || "Ein Kunde"}${erg.betreuer ? `, sein fester Betreuer ist ${erg.betreuer}` : ", noch ohne festen Betreuer"}.`;
    if (k?.code) erg.link = `https://fiaon.com/a/${String(k.code)}/w`;

    const UNFERTIG = ["started", "personal_data", "finances", "config", "verifying", "approved", "contract", "processing"];
    const abgeschickt = b && (Number(b.schritt) >= 8 || !UNFERTIG.includes(String(b.status || "")));
    const paket = b?.pack_name || b?.pack_key || null;
    if (!b) {
      // E-230: Fast jeder Meta-Lead hat eine Person. Ohne Antrag gilt dann die Lage des Leads —
      // die Begrüßung hat ihm gesagt, sein Antrag sei vorbereitet und seine Angaben stünden drin.
      const [l] = (await sqlPool`
        SELECT link_code, anzeige, quelle FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
      if (l && l.quelle !== "whatsapp_eingang") {
        erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
        if (!k?.code && l.link_code) erg.link = `https://fiaon.com/a/${String(l.link_code)}/w`;
      } else {
        erg.lage = "Hat noch keinen Antrag.";
      }
      // E-241: Lead (Stufe C) — die Auskunft nur als Antwort, nichts an SEINE LAGE anhängen.
      erg.auskunft = await auskunftLage(personId, "lead");
    } else if ((b.gekuendigt_am || b.abo_gestoppt_am || ["cancelled", "refunded", "superseded"].includes(String(b.payment_status)))
      && await erneutAngefragt(personId, b.gekuendigt_am ?? b.abo_gestoppt_am ?? b.created_at)) {
      // E-236 (J.O. Trommer, 24.09.): Vertrag im August gekündigt, heute ÜBER DAS FORMULAR NEU ANGEFRAGT.
      // Mara schrieb „Ich sehe hier, dass Ihr Vertrag gekündigt ist" — er antwortete „Dann bleibt es bei
      // der Kündigung". Wer neu anfragt, ist ein neuer Interessent.
      const [l] = (await sqlPool`SELECT link_code FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
      erg.lage = "Hatte früher einen Vertrag, der beendet ist, und hat jetzt über das Formular NEU angefragt — er ist wieder interessiert. Begrüße ihn wie einen neuen Interessenten; den alten Vertrag sprichst du nicht von dir aus an.";
      erg.ziel = "Er startet neu: Antrag öffnen und ausfüllen.";
      erg.link = l?.link_code ? `https://fiaon.com/a/${String(l.link_code)}/w` : "https://fiaon.com/antrag";
    } else if (b.gekuendigt_am || b.abo_gestoppt_am || ["cancelled", "refunded", "superseded"].includes(String(b.payment_status))) {
      erg.lage = `Vertrag ${b.gekuendigt_am ? "gekündigt" : "beendet oder storniert"}${paket ? ` (${paket})` : ""}.`;
      erg.ziel = "Kein Verkauf, keine Zahlung. Du beantwortest seine Frage; will er wieder einsteigen oder geht es um Geld, übergibst du.";
      erg.link = "https://fiaon.com/login";
      erg.verkaufen = false;
    } else if (b.payment_status === "paid") {
      const kartenStand = karte?.gesendet_am
        ? `Der Link der Partnerbank für Konto und Karte ging am ${new Date(karte.gesendet_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} an ihn raus${karte.status ? ` (Stand: ${karte.status})` : ""}.`
        : "Ob der Link der Partnerbank schon raus ist, steht hier nicht — das sieht sein Betreuer nach.";
      const seit = b.created_at ? new Date(b.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : null;
      const neu = String(b.agb_stand || "") >= "2026-09-03";
      const vertrag = neu
        ? `Jahresvertrag${seit ? ` vom ${seit}` : ""}: zwölf Monate, Kündigung mit einem Monat Frist zum Ende, danach monatlich.`
        : `Vertrag${seit ? ` vom ${seit}` : ""} (vor dem 03.09.2026): monatlich zum Ende des laufenden Monats kündbar, formlos.`;
      erg.lage = `Kunde mit ${paket ?? "einem Paket"}, erste Zahlung gebucht, Account aktiv. ${vertrag} ${kartenStand}`;
      erg.ziel = "Es geht um Karte, Unterlagen und Startgespräch. Sein Bereich: fiaon.com/login.";
      erg.link = "https://fiaon.com/login";
      erg.verkaufen = false;
      // E-240: Wo steht er bei der Bonitätsauskunft? Der Preis kommt vom Server (74 € mit Paket).
      // E-241: mit derselben Art wie Werkzeug und Kauflink (Business-Paket → Firmen-Auskunft) —
      // vorher nannte der Auftrag einem Business-Kunden 74 €, das Werkzeug 199 €.
      erg.auskunft = await auskunftLage(personId, "kunde");
      if (erg.auskunft) {
        const st = erg.auskunft;
        const wort = auskunftWort(st.land);
        erg.lage += st.stufe === "nichts" ? ` Seine ${wort} liegt uns noch nicht vor (weder bestellt noch hochgeladen).`
          : st.stufe === "offen" ? ` Seine ${wort} ist bestellt, die Zahlung ist offen.`
          : st.stufe === "bezahlt" ? ` Seine ${wort} ist bezahlt — wir fordern sie an.`
          : ` Eine Auskunft liegt in seiner Akte.`;
      }
      // Hat er zuletzt unsere Raten-Erinnerung bekommen: GENAU diese Rate (Referenz aus dem gesendeten Text),
      // nicht „die älteste offene" — sonst zeigte Mara nach der Zahlung auf die nächste, noch nicht fällige Rate.
      const ratenRef = letzteVorlage && /^fiaon_kkb?_rate$/.test(letzteVorlage.name)
        ? (String(letzteVorlage.text ?? "").match(/FIAON-?[A-Z0-9]{6}-\d{1,2}/i)?.[0] ?? null) : null;
      if (ratenRef) {
        const [r] = (await sqlPool`
          SELECT r.zahlungsreferenz, r.betrag_cents, r.status, r.faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date AS faellig
            FROM fiaon_abo_raten r WHERE UPPER(r.zahlungsreferenz) = ${ratenRef.toUpperCase()} ORDER BY r.id DESC LIMIT 1`.catch(() => [])) as any[];
        if (r?.status === "offen" && r.faellig) {
          erg.lage += ` Er hat unsere Erinnerung an seine Monatsrate über ${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} € bekommen (Verwendungszweck ${r.zahlungsreferenz}).`;
          erg.ziel = "Du beantwortest seine Frage zur Rate sachlich und zeigst ihm seine Zahlungsseite. Ratenpause, Stundung, Kulanz oder Kündigung sagst du nie zu — das übergibst du. „Schon überwiesen“: danken, die Zahlungsstelle prüft den Eingang.";
          erg.link = `https://fiaon.com/zahlung/${String(r.zahlungsreferenz)}`;
        } else if (r?.status === "bezahlt") {
          erg.lage += ` Die Monatsrate aus unserer Erinnerung (${r.zahlungsreferenz}) ist inzwischen bezahlt — danke ihm dafür; es ist nichts weiter zu tun.`;
        }
      }
    } else if (b.payment_status === "claimed_paid") {
      erg.lage = `Antrag fertig (${paket ?? "Paket offen"}), er hat seine Zahlung gemeldet — die Buchung steht noch aus.`;
      erg.ziel = "Kein Wort vom Bezahlen. Danken, der Eingang wird geprüft, mit der Buchung ist sein Account aktiv.";
      erg.link = "https://fiaon.com/login";
      erg.verkaufen = false;
    } else if (abgeschickt && b.payment_reference) {
      const cents = paketPreisCents(b.pack_key);
      erg.lage = `Antrag fertig und abgeschickt (${paket ?? "Paket offen"}), die erste Zahlung${cents ? ` über ${(cents / 100).toFixed(2).replace(".", ",")} €` : ""} ist noch offen.`;
      erg.ziel = "Er aktiviert seinen Account mit der ersten Zahlung („Nach der Zahlung ist Ihr Account aktiv“ — kein Satz über die Partnerbank). Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code. Nennt er einen Zahltag, hältst du ihn mit zahlungszusage_merken fest.";
      erg.link = `https://fiaon.com/zahlung/${String(b.payment_reference)}`;
      // E-241: Stufe B — die Auskunft nur als Antwort (auskunftJetzt), nichts an SEINE LAGE anhängen.
      erg.auskunft = await auskunftLage(personId, "antrag");
    } else {
      erg.lage = `Antrag angefangen, bei Schritt ${b.schritt ?? 0} stehen geblieben${paket ? ` (${paket})` : ""}. Seine Angaben sind gespeichert.`;
      erg.ziel = "Er macht seinen Antrag fertig — dort, wo er aufgehört hat.";
      // E-241: wie ein Lead — die Auskunft nur als Antwort.
      erg.auskunft = await auskunftLage(personId, "lead");
    }
  } else if (leadId) {
    const [l] = (await sqlPool`
      SELECT TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS name, link_code, anzeige FROM fiaon_leads WHERE id = ${leadId}`.catch(() => [])) as any[];
    if (l) {
      erg.wer = `${String(l.name || "").trim() || "Ein Interessent"} — kam über eine Anzeige${l.anzeige ? ` (${l.anzeige})` : ""}, noch ohne festen Betreuer.`;
      erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
      if (l.link_code) erg.link = `https://fiaon.com/a/${String(l.link_code)}/w`;
    }
  }
  // ── E-240: DIE WERBESPERRE GILT IN JEDER LAGE ─────────────────────────────
  // Antworten auf seine eigene Nachricht bleiben erlaubt (das ist keine Werbung),
  // aber ohne Verkauf: kein Pitch, kein Link, nach dem er nicht fragt. Gemessen
  // am 24.09.: Mara schrieb einem Menschen mit Werbesperre „starten Sie einfach
  // hier neu" samt Antragslink.
  if (personId) {
    const s = await personSperre(personId).catch(() => null);
    erg.vertriebssperre = !!s?.vertriebssperre;
    if (s?.werbesperre) {
      erg.werbesperre = true;
      erg.lage += " WERBESPERRE: Er hat gebeten, keine Werbung mehr zu bekommen.";
      // Gegenlesen 24.09.2026: Nur ein VERKAUFSZIEL (Lead, Antrag, erste Zahlung) wird ersetzt.
      // Ein Service-Ziel bleibt stehen und bekommt die Sperre dazu — sonst verlor Mara bei einer
      // Werbesperre „Kein Wort vom Bezahlen" (Zahlung gemeldet), die Zahlungsseite der Rate aus
      // der Erinnerung (Zahlungspost, E-182) und „übergibst du" beim gekündigten Vertrag.
      erg.ziel = erg.verkaufen
        ? "Du beantwortest nur, was er fragt — vollständig und freundlich. Kein Angebot, kein Pitch, keine Aufforderung zum Abschluss, kein Link, nach dem er nicht fragt (fragt er danach, bekommt er ihn)."
        : `${erg.ziel} Wegen seiner Werbesperre: Kein Angebot, kein Pitch, keine Aufforderung zum Abschluss — du beantwortest, was er fragt, und was zu seinem Vertrag gehört.`;
      erg.verkaufen = false;
    }
  }
  return erg;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTEN
// ═══════════════════════════════════════════════════════════════════════════
const inArbeit = new Set<string>();
/** Kostendeckel: eine Aufgabe je Nummer und Tag, nicht alle fünf Minuten eine neue. */
const deckelGemeldet = new Set<string>();

type Ergebnis = { gesendet: boolean; grund?: string };

/**
 * Antwortet auf ein offenes Gespräch. Läuft im Hintergrund, wirft nie — eine
 * misslungene Antwort darf den Empfang nicht stören. Die Antwort wird
 * vorbereitet und nach 6–18 Sekunden vom Versandtakt geschickt.
 */
export async function maraAntwortet(nummer: string): Promise<Ergebnis> {
  if (inArbeit.has(nummer)) return { gesendet: false, grund: "Mara denkt gerade schon über dieses Gespräch nach." };
  inArbeit.add(nummer);
  try {
    await gespraechSchema();
    if ((await einstellung("mara_wa_an", "an")) !== "an") return { gesendet: false, grund: "Mara ist auf WhatsApp abgeschaltet." };

    const verlauf = (await sqlPool`
      SELECT id, richtung, text, typ, vorlage, status, von, knopf, COALESCE(empfangen_am, gesendet_am, created_at) AS am, person_id, lead_id
        FROM fiaon_whatsapp WHERE nummer = ${nummer} AND status <> 'fehler' ORDER BY id DESC LIMIT 16`) as any[];
    // Fehlerzeilen bleiben draußen: Sie zählen nicht als Antwort und dürfen die Kundennachricht nicht aus dem Fenster drängen.
    if (!verlauf.length) return { gesendet: false, grund: "Kein Verlauf." };

    // OFFEN: neueste Kundennachricht nach der letzten freien Antwort (Vorlagen und Fehler zählen nicht).
    const neuesteRein = verlauf.find((v) => v.richtung === "rein");
    if (!neuesteRein) return { gesendet: false, grund: "Der Kunde hat nichts geschrieben." };
    const [g] = (await sqlPool`SELECT mara_an, mara_aus_grund, mara_aus_am, versand_aufgegeben_id, ki_rueckfall_auf_id, ki_rueckfall_am FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    const letzteFreie = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && v.status !== "fehler");
    // E-236: Ein Rückfallsatz wegen KI-Ausfall ist KEINE Antwort — höchstens 12 Stunden lang holt Mara
    // die eigentliche Frage nach, sobald die KI wieder da ist (vorher blieb sie für immer unbeantwortet).
    const kiRueckfallOffen = !!(g?.ki_rueckfall_auf_id && letzteFreie && istMara(letzteFreie.von) && istRueckfall(letzteFreie.text)
      && g.ki_rueckfall_am && Date.now() - new Date(g.ki_rueckfall_am).getTime() < 12 * 60 * 60_000);
    const letzteAntwort = kiRueckfallOffen
      ? verlauf.find((v) => v.richtung === "raus" && !v.vorlage && v.status !== "fehler" && !(istMara(v.von) && istRueckfall(v.text)))
      : letzteFreie;
    if (letzteAntwort && Number(letzteAntwort.id) > Number(neuesteRein.id)) return { gesendet: false, grund: "Beantwortet." };
    // Steht ein frischer Rückfallsatz schon als letzte freie Antwort da? Dann nicht noch einer.
    const rueckfallSchonDa = !!(letzteFreie && istMara(letzteFreie.von) && istRueckfall(letzteFreie.text)
      && Date.now() - new Date(letzteFreie.am).getTime() < 2 * 60 * 60_000);
    // Nach dreimal gescheitertem Versand: erst eine NEUE Kundennachricht versucht es wieder (sonst KI-Kosten im Kreis).
    if (g?.versand_aufgegeben_id != null && Number(g.versand_aufgegeben_id) >= Number(neuesteRein.id)) {
      return { gesendet: false, grund: "Versand an diese Nummer scheiterte dreimal — ein Mensch ist informiert." };
    }
    // Die ERSTE Kundennachricht nach der letzten freien Antwort: ab ihr wartet der Kunde.
    const offeneRein = verlauf.filter((v) => v.richtung === "rein" && (!letzteAntwort || Number(v.id) > Number(letzteAntwort.id)));
    const ersteOffene = offeneRein[offeneRein.length - 1] ?? neuesteRein;
    if (g && g.mara_an === false) {
      if (g.mara_aus_grund === "schalter") return { gesendet: false, grund: "Mara ist in diesem Gespräch von Hand abgeschaltet." };
      if (g.mara_aus_grund === "deckel") {
        const heuteBerlin = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
        const amBerlin = g.mara_aus_am ? new Date(g.mara_aus_am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : "";
        if (amBerlin === heuteBerlin) return { gesendet: false, grund: "Zu viele Antworten an diese Nummer heute — ein Mensch ist informiert." };
      }
      // Ein Mensch führt — läuft ab: 15 Minuten ohne Antwort (ab der ersten offenen Nachricht), 20–8 Uhr
      // sofort, und spätestens zwei Stunden nach der Übernahme.
      const wartet = Date.now() - new Date(ersteOffene.am).getTime();
      const pauseAlt = g.mara_aus_am && Date.now() - new Date(g.mara_aus_am).getTime() > 2 * 60 * 60_000;
      if (g.mara_aus_grund !== "deckel" && !pauseAlt && !uebernahmeAbgelaufen(wartet, stundeBerlin())) {
        return { gesendet: false, grund: `Ein Mensch führt das Gespräch — Mara übernimmt in ${Math.ceil((UEBERNAHME_MS - wartet) / 60_000)} Min., falls niemand antwortet.` };
      }
      await sqlPool`
        UPDATE fiaon_whatsapp_gespraech SET mara_an = TRUE, mara_aus_grund = NULL, mara_aus_am = NULL, updated_at = NOW()
         WHERE nummer = ${nummer} AND COALESCE(mara_aus_grund, 'mensch') <> 'schalter'`;
      console.log(`[MARA-WA] ${nummer.slice(-4)}: Übernahme abgelaufen (Kunde wartet ${Math.round(wartet / 60_000)} Min.) — Mara antwortet.`);
    }

    if (!(await fensterOffen(nummer))) return { gesendet: false, grund: "Das Fenster ist zu." };

    const personId = verlauf.find((v) => v.person_id)?.person_id ?? null;
    const leadId = verlauf.find((v) => v.lead_id)?.lead_id ?? null;

    // STOPP: genau eine kurze Bestätigung, ohne Pitch — und nur, solange sie frisch ist.
    if (istStopp(neuesteRein.text, neuesteRein.knopf)) {
      if (Date.now() - new Date(neuesteRein.am).getTime() > 60 * 60_000) return { gesendet: false, grund: "STOPP — zu alt für eine Bestätigung." };
      await vorbereiten(nummer, STOPP_ANTWORT, Number(neuesteRein.id), String(neuesteRein.text ?? ""), { kunde: String(neuesteRein.text || neuesteRein.knopf || ""), handlung: "WhatsApp-Stopp bestätigt — keine Vorlagen mehr" });
      return { gesendet: false, grund: "STOPP bestätigt (liegt bereit)." };
    }

    const lv = verlauf.find((v) => v.richtung === "raus" && v.vorlage);
    const letzteVorlage = lv ? { name: String(lv.vorlage), text: lv.text ?? null } : null;
    const lage = await lageFuer(personId ? Number(personId) : null, leadId ? Number(leadId) : null, letzteVorlage);

    const deckel = Number(await einstellung("mara_wa_tag_euro", "15")) || 15;
    const heute = await kostenHeute(DIENST_WA).catch(() => 0);
    if (heute >= deckel) {
      const schluessel = `${nummer}-${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}`;
      if (!deckelGemeldet.has(schluessel)) {
        deckelGemeldet.add(schluessel);
        console.warn(`[MARA-WA] Kostendeckel erreicht (${heute.toFixed(2)} € von ${deckel} €) — ${nummer.slice(-4)} geht an einen Menschen.`);
        await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat heute ihren KI-Kostendeckel erreicht — bitte selbst antworten.", true);
      }
      return { gesendet: false, grund: `Kostendeckel erreicht (${heute.toFixed(2)} € von ${deckel} €) — Aufgabe an einen Menschen.` };
    }
    // Obergrenze je Gespräch: ein Autoresponder auf der Gegenseite darf kein Pingpong auslösen,
    // das das Tagesbudget aller Kunden aufbraucht. 24.09.: Die alte Grenze (6 in 30 Min.) legte
    // ein echtes Gespräch um 07:06 für eine halbe Stunde still — der Kunde schrieb „?" und wartete
    // bis 07:39. Jetzt: 15 in 30 Minuten = kurz warten (der Nachhol-Takt holt nach, sobald Luft
    // ist), 60 am Tag = Pause bis morgen und ein Mensch.
    const [anzahl] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 minutes')::int AS halbe,
             COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS tag
        FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND vorlage IS NULL AND status <> 'fehler' AND von ILIKE 'Mara%'`.catch(() => [{}])) as any[];
    if (Number(anzahl?.tag || 0) >= TAG_GRENZE) {
      await sqlPool`
        INSERT INTO fiaon_whatsapp_gespraech (nummer, mara_an, mara_aus_grund, mara_aus_am, updated_at) VALUES (${nummer}, FALSE, 'deckel', NOW(), NOW())
        ON CONFLICT (nummer) DO UPDATE SET mara_an = FALSE, mara_aus_grund = 'deckel', mara_aus_am = NOW(), updated_at = NOW()`;
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: Obergrenze je Gespräch erreicht (${anzahl?.halbe}/30 Min., ${anzahl?.tag}/Tag) — pausiert bis morgen.`);
      await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat diesem Kontakt sehr viele Antworten in kurzer Zeit geschrieben (Autoresponder?) — sie pausiert hier bis morgen. Bitte ansehen.", true);
      return { gesendet: false, grund: "Obergrenze je Gespräch erreicht — pausiert, ein Mensch ist informiert." };
    }
    if (Number(anzahl?.halbe || 0) >= HALBSTUNDE_GRENZE) {
      return { gesendet: false, grund: `Viele Antworten in kurzer Zeit (${anzahl?.halbe}/30 Min.) — Mara antwortet, sobald wieder Luft ist.` };
    }

    const namen = await agentNamen();
    // KI-Hinweis (KI-Verordnung Art. 50, seit 02.08.2026): spätestens bei der ersten Interaktion.
    // Nur die Begrüßung fiaon_kk_anfrage trägt ihn — wer auf eine andere Vorlage antwortet oder
    // uns direkt schreibt, erfährt es in Maras erster Antwort.
    const [vorgestellt] = (await sqlPool`
      SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND status <> 'fehler'
         AND text ILIKE '%digitale Assistentin%' LIMIT 1`.catch(() => [])) as any[];
    const kiHinweis = !vorgestellt;
    const jetzt = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const heuteIso = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

    const frage = String(neuesteRein.text ?? "");
    const letzteDu = verlauf.filter((v) => v.richtung === "raus" && !v.vorlage && istMara(v.von)).map((v) => String(v.text ?? ""));
    const kunde = offeneRein.slice().reverse().map((v) => String(v.text || v.knopf || "")).join("\n");
    const kontext = verlauf.filter((v) => v.richtung === "rein").slice(0, 5).map((v) => String(v.text || v.knopf || "")).join("\n");
    const verlaufText = verlauf.map((v) => String(v.text ?? "")).join("\n");
    // E-240: Angebot „jetzt", wenn er gerade über Bonität, Limit, Karte oder die Auskunft schreibt
    // (seine offenen Nachrichten) oder Maras letzte Frage zur Auskunft beantwortet. Bei Werbesperre
    // nur, wenn er sie ausdrücklich will — dann ist es seine Anfrage, keine Werbung.
    // Gegenlesen 24.09.2026: dieselbe Zurückhaltung bei Vertriebssperre (is_blocked, „kein
    // Interesse") — das Werkzeug lehnte dort ohnehin ab (werbungVerboten), der Auftrag bot aber an.
    // Und nach dem ersten Angebot nur noch, wenn er selbst auf die Auskunft zurückkommt (auskunftJetzt).
    const ohneAngebot = lage.werbesperre || lage.vertriebssperre;
    const segment: AuskunftSegment = lage.auskunft?.segment ?? "kunde";
    // Integration 25.09.2026 (E-240): die gemeinsame Bremse — kam das Angebot in den letzten drei
    // Tagen schon (Angebots-Mail, Unterlagen-Mail, Vorlage, Mara per Mail), bietet Mara nur noch an,
    // wenn er selbst auf die Auskunft zurückkommt. Nur bei „nichts": Der Zahlungslink einer offenen
    // Bestellung ist kein Angebot. (E-241: nur für zahlende Kunden — Anträge und Leads bekommen
    // die Auskunft ohnehin nur als Antwort, und eine Antwort bremst die Bremse nicht.)
    const anderswo = personId && lage.auskunft?.stufe === "nichts" && segment === "kunde"
      ? await zuletztAngeboten(Number(personId)).catch(() => null) : null;
    // ── E-241: ANTWORTET EIN ANTRAG ODER LEAD AUF DAS ANGEBOT? ────────────────
    // Unsere letzte Nachricht vor seinen offenen war das Angebot (Vorlage fiaon_kk_auskunft…
    // oder Maras eigenes) — oder es kam in den letzten 14 Tagen per Mail und er bezieht sich
    // darauf. Die Abfrage läuft nur, wenn die Vorlage allein es nicht schon zeigt.
    // (Auch beim zahlenden Kunden: „Ja, gern" auf fiaon_kk_auskunft ist seine Antwort, siehe auskunftJetzt.)
    let aufAngebot = false;
    if (personId && lage.auskunft && (lage.auskunft.stufe === "nichts" || lage.auskunft.stufe === "offen")) {
      const lr = verlauf.find((v) => v.richtung === "raus" && v.status !== "fehler" && Number(v.id) < Number(ersteOffene.id)) ?? null;
      const letzteRaus = lr ? { vorlage: lr.vorlage ?? null, text: lr.text ?? null } : null;
      aufAngebot = antwortetAufAuskunftAngebot({ kunde, letzteRaus });
      if (!aufAngebot && !istAuskunftAngebot(letzteRaus) && /\b(?:angebot|e-?mail|mail)\b/i.test(kunde)) {
        const kuerzlich = await zuletztAngeboten(Number(personId), { tage: ANGEBOT_ANTWORT_TAGE }).catch(() => null);
        aufAngebot = antwortetAufAuskunftAngebot({ kunde, letzteRaus, angebotKuerzlich: kuerzlich?.text ?? null });
      }
    }
    const auskunft: AuskunftTeil | null = lage.auskunft ? {
      ...lage.auskunft,
      werbesperre: ohneAngebot,
      angebotAnderswo: anderswo?.text ?? null,
      ...auskunftJetzt({ kunde, letzteDu, werbesperre: ohneAngebot, anderswo: !!anderswo, segment, aufAngebot }),
    } : null;
    // E-241: Preis- und Landprüfung wie bei Kunden nur, wenn es um die Auskunft geht — ein Lead,
    // der nach der Karte fragt, wird geprüft wie vor E-241 (die vier Katalogpreise, kein Land).
    const auskunftImGespraech = !!auskunft && (segment === "kunde" || auskunft.jetzt);

    const text = auftrag({
      kiHinweis,
      name: namen.voll,
      werkzeuge: !!personId, betreuer: lage.betreuer ? lage.betreuer.split(" ")[0] : null, jetzt: `${jetzt} (heute = ${heuteIso})`,
      wer: lage.wer, lage: lage.lage, ziel: lage.ziel, link: lage.link, verkaufen: lage.verkaufen, auskunft,
      gedaechtnis: personId ? await gedaechtnisText(Number(personId)).catch(() => "") : "",
      wissen: wissenFuerWhatsApp(),
      hausanweisung: await anweisungBlock("whatsapp").catch(() => ""),
      verlauf: verlauf.slice().reverse()
        .filter((v) => v.status !== "fehler")
        .map((v) => {
          const wer = v.richtung === "rein" ? "KUNDE" : v.vorlage ? "VORLAGE" : istMara(v.von) ? "DU" : "TEAM";
          const inhalt = String(v.text || (v.vorlage ? vorlagenKopf(String(v.vorlage)) : MEDIEN[String(v.typ)] ?? (v.typ && v.typ !== "text" ? `(${v.typ})` : ""))).replace(/\s+/g, " ").slice(0, 600);
          return `${wer}: ${inhalt}`;
        })
        .join("\n"),
    });

    const zahlungslage = /Account aktiv|Eingang wird geprüft|Zahlungsseite/.test(lage.ziel);
    const e = await entwerfen(text, {
      kunde, kontext, letzteDu: letzteDu.slice(0, 2), verkaufen: lage.verkaufen, verlaufText, zahlungslage,
      auskunftAngebot: auskunftWerkzeugAn(auskunft), werbesperre: lage.werbesperre,
      bekannt: {
        links: [lage.link, ...(auskunft?.offenLink ? [auskunft.offenLink] : [])],
        auskunftPreise: auskunft && auskunftImGespraech
          ? [auskunft.preisText, ...(auskunft.offenBetrag ? [auskunft.offenBetrag] : []), ...(auskunft.mitAbo ? [euroText(AUSKUNFT_PREISE_CENTS[auskunft.art ?? "privat"].einzeln)] : [])]
          : null,
        land: auskunftImGespraech ? auskunft?.land ?? null : null,
      },
    }, personId ? {
      personId: Number(personId), leadId: leadId ? Number(leadId) : null, nummer,
      kunde, letzteDu: letzteDu[0] ?? "", auskunft,
    } : null);
    let roh = e.roh;
    let antwort = e.antwort;
    const funde = e.funde;
    let mensch = roh?.mensch === true;
    let uebergabe = String(roh?.uebergabe ?? "").trim();

    // KI fällt aus (24.09. 07:00: OpenAI-Guthaben leer): erst sechs Minuten still weiterversuchen —
    // ein kurzer Ausfall bleibt so unsichtbar. Danach EIN Rückfallsatz und ein Mensch; steht er schon
    // da, kein zweiter — das Gespräch bleibt offen, und Mara antwortet richtig, sobald die KI zurück ist.
    if (e.kiFehler) {
      if (/no credits|insufficient_quota|exceeded your current quota|billing/i.test(e.kiFehler)) await kiGuthabenAlarm(e.kiFehler);
      const wartetMin = (Date.now() - new Date(ersteOffene.am).getTime()) / 60_000;
      if (wartetMin < KI_GEDULD_MIN) return { gesendet: false, grund: `KI nicht erreichbar (${e.kiFehler.slice(0, 80)}) — neuer Versuch.` };
      if (rueckfallSchonDa) {
        // Eine Aufgabe je offener Nachricht — nicht alle fünf Minuten eine neue (Nachhol-Takt).
        const k = `${nummer}-${neuesteRein.id}`;
        if (!kiAufgabeGemeldet.has(k)) {
          kiAufgabeGemeldet.add(k);
          await aufgabeFuerMenschen(nummer, personId, leadId, `Mara kann gerade nicht antworten (KI: ${e.kiFehler.slice(0, 120)}). Letzte Nachricht: „${frage.slice(0, 200)}"`, true);
        }
        return { gesendet: false, grund: "KI nicht erreichbar — Rückfallsatz steht schon da, ein Mensch ist informiert." };
      }
    }
    // Rückfall: wahr, ohne Zusage, und ein Mensch übernimmt — Schweigen gibt es nicht.
    if (funde.length || e.kiFehler) {
      const warum = e.kiFehler ? `KI: ${e.kiFehler.slice(0, 120)}` : funde.join(" · ");
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: Rückfallsatz (${warum}).`);
      antwort = rueckfallSatz(lage.betreuer, rueckfallSchonDa);
      mensch = true;
      uebergabe = `Mara konnte nicht selbst antworten (${warum}). Letzte Nachricht: „${frage.slice(0, 200)}"`;
      roh = null;
      if (e.kiFehler) {
        await sqlPool`
          INSERT INTO fiaon_whatsapp_gespraech (nummer, ki_rueckfall_auf_id, ki_rueckfall_am, updated_at) VALUES (${nummer}, ${Number(neuesteRein.id)}, NOW(), NOW())
          ON CONFLICT (nummer) DO UPDATE SET ki_rueckfall_auf_id = ${Number(neuesteRein.id)}, ki_rueckfall_am = NOW(), updated_at = NOW()`;
      }
      await protokolliere({ art: "rueckfall", ok: false, nummer, personId, leadId, text: `Rückfallsatz geschickt (${warum.slice(0, 160)}).` });
    }

    // ── Was die Werkzeuge taten, muss in der Antwort stimmen (E-236) ──────────
    // Die Zeit steht in der gespeicherten Zeile; fehlt sie in der Antwort, kommt sie dazu —
    // der Kunde muss genau die Uhrzeit lesen, die im Kalender des Mitarbeiters steht.
    const gebucht = e.aktionen.find((x) => x.werkzeug === "rueckruf_eintragen" && x.ok && x.termin)?.termin ?? null;
    if (!funde.length && !e.kiFehler && gebucht && !antwort.includes(gebucht.uhrzeit)) {
      antwort = `${antwort} Eingetragen: ${gebucht.text} — ${gebucht.vorname} ruft Sie an.`.trim();
    }
    const link = e.aktionen.find((x) => x.werkzeug === "terminlink_schicken" && x.ok && x.link)?.link ?? null;
    if (!funde.length && !e.kiFehler && link && !antwort.includes(link)) {
      antwort = `${antwort} Hier wählen Sie selbst eine Zeit: ${link}`.trim();
    }
    // E-240: Hat auskunft_anbieten einen Link geholt, muss er beim Kunden ankommen — genau dieser.
    const auskunftAktion = e.aktionen.find((x) => x.werkzeug === "auskunft_anbieten" && x.ok && x.link) ?? null;
    // Gegenlesen 24.09.2026: verglichen wird der Pfad — schreibt Mara „fiaon.com/zahlung/…" statt
    // „https://www.fiaon.com/zahlung/…", stand der Link sonst zweimal in der Nachricht.
    if (!funde.length && !e.kiFehler && auskunftAktion?.link && !antwort.includes(auskunftAktion.link.replace(/^https?:\/\/[^/]+/i, ""))) {
      antwort = `${antwort} Hier geht es direkt weiter: ${auskunftAktion.link}`.trim();
    }

    // Zusagen („Ihr Betreuer ruft Sie an", „weitergeleitet", „vorgemerkt") müssen eingelöst werden:
    // Wer so etwas schreibt, übergibt — unabhängig davon, was das Modell im Feld mensch gesetzt hat.
    const zusagen = wandPruefen(antwort).filter((x) => x.art === "zusage").map((x) => x.treffer);
    // „Ich gebe Daniel Bescheid" ist genauso eine Zusage — „Geben Sie mir Bescheid" nicht (Prüfung 24.09.).
    // Ein von Mara eingetragener Rückruf IST die Übergabe (Termin + Mail an den Mitarbeiter): keine zweite Aufgabe dafür.
    const betreuerVorname = lage.betreuer ? lage.betreuer.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;
    const zusageMuster = new RegExp(String.raw`\b(?:ich|wir)\s+(?:gebe|geben|sage|sagen)\b[^.!?]{0,60}\bbescheid\b|\b(?:ich|wir)\s+(?:gebe|geben|leite|leiten)\b[^.!?]{0,60}\bweiter\b|\b(?:betreuer|team|kolleg\w*)\b[^.!?]{0,40}\b(?:kümmert|meldet|ruft|übernimmt)`
      + (betreuerVorname ? String.raw`|\b${betreuerVorname}\s+(?:meldet|ruft|kümmert)` : ""), "i");
    const zusageOhneTermin = zusagen.length || zusageMuster.test(antwort);
    if (zusageOhneTermin && !(gebucht && !zusagen.some((z) => !/ruf|rückruf|meldet/i.test(z)))) {
      if (!mensch) uebergabe = uebergabe || `Mara hat zugesagt (${zusagen.join(", ") || "Rückmeldung"}) — bitte einlösen. Kunde: „${frage.slice(0, 200)}"`;
      mensch = true;
    }
    const offenerText = offeneRein.map((v) => String(v.text ?? "")).join(" ");
    const heikel = /kündig|widerruf|storn|erstatt|zurücküberweis|geld zurück|anwalt|verbraucherzentrale|betrug|abzocke|polizei/i.test(offenerText);
    if (heikel && !mensch) {
      mensch = true;
      uebergabe = uebergabe || `Heikles Anliegen (Kündigung/Widerruf/Erstattung/Beschwerde): „${offenerText.slice(0, 240)}"`;
    }

    // Fehlt der Pflicht-Hinweis trotz Auftrag, wird er vorangestellt — nie eine erste Antwort ohne ihn.
    if (kiHinweis && !/digitale Assistentin/i.test(antwort)) {
      antwort = `Hier ist ${namen.voll.split(" ")[0]}, die digitale Assistentin von FIAON. ${antwort}`;
    }

    // E-240: Was Mara getan hat — für den Aktenvermerk, der beim Versand entsteht (versandLauf).
    const handlung = [
      ...e.aktionen.filter((x) => x.ok).map((x) => x.werkzeug === "rueckruf_eintragen" && x.termin ? `Rückruf eingetragen (${x.termin.text}, ${x.termin.vorname})`
        : x.werkzeug === "freie_zeiten" ? "freie Zeiten angeboten"
        : x.werkzeug === "zahlungszusage_merken" ? "Zahlungszusage festgehalten"
        : x.werkzeug === "terminlink_schicken" ? "Terminlink geschickt"
        : x.werkzeug === "auskunft_anbieten" ? `Bonitätsauskunft angeboten (${x.betrag ?? "Preis vom Server"}, ${x.art === "bestellt" ? "bestellt" : x.art === "offen" ? "Zahlungsseite der offenen Bestellung" : "Kauflink"})`
        : x.werkzeug),
      ...(funde.length || e.kiFehler ? ["Rückfallsatz"] : []),
      ...(mensch ? [`an ${lage.betreuer ?? "das Team"} übergeben${uebergabe ? `: ${uebergabe.slice(0, 140)}` : ""}`] : []),
      ...(String(roh?.gemerkt ?? "").trim() ? [`gemerkt: ${String(roh.gemerkt).trim().slice(0, 140)}`] : []),
    ].join("; ") || "keine";
    await vorbereiten(nummer, antwort, Number(neuesteRein.id), frage, { kunde, handlung });

    if (personId && String(roh?.gemerkt ?? "").trim()) {
      await gedaechtnisMerken(Number(personId), [String(roh.gemerkt).trim()], "whatsapp").catch(() => {});
    }
    if (mensch) {
      await aufgabeFuerMenschen(nummer, personId, leadId, uebergabe || "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).", funde.length > 0 || heikel || /anruf|rückruf|beschwer|kündig|widerruf|betrug|anwalt/i.test(uebergabe));
    }
    return { gesendet: false, grund: "Antwort liegt bereit." };
  } catch (e) {
    console.error("[MARA-WA]", e);
    return { gesendet: false, grund: String(e).slice(0, 200) };
  } finally {
    inArbeit.delete(nummer);
  }
}

/**
 * Das Hauswissen, zugeschnitten auf WhatsApp. Drei Zeilen aus wissenFakten()
 * dürfen hier nicht wirken: der Gerichtsabsatz (WhatsApp verbietet
 * Forderungseinzug), der Kulanzsatz (AGB § 6 Abs. 4: kein Anspruch) und der
 * Erstattungssatz beim Widerruf (widerspricht der Widerrufsbelehrung).
 */
export function wissenFuerWhatsApp(): string {
  return wissenFakten()
    .split("\n")
    .filter((z) => !/^- Bleibt eine offene Rate trotz Aufforderung unbezahlt/.test(z))
    .map((z) => /^- Verträge ab dem 03\.09\.2026 laufen über zwölf Monatsraten/.test(z)
      ? "- Verträge ab dem 03.09.2026: zwölf Monate, zwölf zinsfreie Monatsraten; Kündigung mit einem Monat Frist zum Ende der zwölf Monate, sonst läuft der Vertrag weiter und ist dann jederzeit mit einem Monat Frist kündbar (AGB § 6). Eine vorzeitige Aufhebung ist kein Anspruch — darüber entscheidet ein Mensch."
      : /^- Widerruf: 14 Tage ab Vertragsschluss/.test(z)
        ? "- Widerruf: 14 Tage ab Vertragsschluss (gesetzliches Widerrufsrecht). Zu Erstattungen äußerst du dich nie — ein Widerruf geht immer an einen Menschen."
        : z)
    .join("\n");
}

/** Die Überschrift einer Vorlage — damit der Verlauf lesbar bleibt, wenn der Text fehlt. */
function vorlagenKopf(name: string): string {
  const v = WA_VORLAGEN.find((x) => x.name === name);
  return v ? `(Vorlage „${v.kopf || name}")` : `(Vorlage ${name})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE (E-236) — Mara handelt selbst
// ═══════════════════════════════════════════════════════════════════════════
const WERKZEUGE = [
  {
    type: "function",
    function: {
      name: "freie_zeiten",
      description: "Freie Anrufzeiten seines Betreuers (in dessen Arbeitszeit, ohne Überschneidung, frühestens in 20 Minuten). Optional ein Wunschfenster. Liefert zwei bis vier Zeiten zum Anbieten.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          von: { type: "string", description: "Fensterbeginn „YYYY-MM-DD HH:MM\" (Berlin), sonst leer." },
          bis: { type: "string", description: "Fensterende „YYYY-MM-DD HH:MM\" (Berlin), sonst leer." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rueckruf_eintragen",
      description: "Trägt einen Rückruf ECHT in den Kalender seines Betreuers ein. Entweder eine Zeit (zeit) oder ein Fenster (von/bis). Der Server legt den Wunsch auf den nächsten freien Platz und meldet die eingetragene Zeit.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          zeit: { type: "string", description: "Genaue Wunschzeit „YYYY-MM-DD HH:MM\" (Berlin) — oder leer, wenn ein Fenster gilt." },
          von: { type: "string", description: "Fensterbeginn „YYYY-MM-DD HH:MM\" — oder leer." },
          bis: { type: "string", description: "Fensterende „YYYY-MM-DD HH:MM\" — oder leer." },
          anliegen: { type: "string", description: "Ein bis zwei Sätze für den Mitarbeiter: worum es geht, was der Kunde schon gefragt hat." },
          verschieben: { type: "boolean", description: "true nur, wenn er einen schon eingetragenen Rückruf auf eine andere Zeit legen will." },
        },
        required: ["anliegen"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "zahlungszusage_merken",
      description: "Merkt den Tag, an dem der Kunde zahlen will (Zahlungszusage). Bis dahin keine Erinnerungen; der Betreuer sieht es. Nur mit einem konkreten Datum.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: { datum: { type: "string", description: "Zahltag YYYY-MM-DD." }, hinweis: { type: "string", description: "Ein Satz für den Betreuer, in den Worten des Kunden." } },
        required: ["datum"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "terminlink_schicken",
      description: "Sein persönlicher Link, auf dem er selbst eine Zeit bei seinem Betreuer wählt. Für Unentschlossene oder wenn keine angebotene Zeit passt.",
      parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
    },
  },
];

/**
 * E-240: Die Bonitätsauskunft — nur in Gesprächen, in denen Mara sie anbieten
 * darf (auskunftWerkzeugAn). Kein Preis und kein Link kommt vom Modell: Das
 * Werkzeug liefert beides vom Server.
 */
const WERKZEUG_AUSKUNFT = {
  type: "function",
  function: {
    name: "auskunft_anbieten",
    description: "Sein echter Link zur Bonitätsauskunft mit seinem Preis (einmalig): bei offener Bestellung seine Zahlungsseite, sonst der Link, über den er sie mit einem Klick beauftragt (dort sieht er Preis, AGB und Widerrufsbelehrung, danach die Zahlungsseite). Gibt seinem Betreuer Bescheid.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
};

/** Die Werkzeuge für dieses Gespräch. */
function werkzeugeFuer(ctx: WerkzeugKontext | null): any[] {
  return auskunftWerkzeugAn(ctx?.auskunft) ? [...WERKZEUGE, WERKZEUG_AUSKUNFT] : WERKZEUGE;
}

/** Was ein Werkzeug getan hat — für Prüfung, Nachbesserung und Protokoll. */
export interface Aktion {
  werkzeug: string; ok: boolean;
  /** Uhrzeiten („HH:MM"), die Mara aus diesem Werkzeug kennt — nur diese darf sie nennen. */
  zeiten: string[];
  termin?: { id: number; text: string; uhrzeit: string; vorname: string; agentName: string; datum: string; wochentag: string };
  link?: string;
  /** E-240 (auskunft_anbieten): der Betrag vom Server und was geschah. */
  betrag?: string;
  art?: "angebot" | "offen" | "bestellt";
}
export interface WerkzeugKontext {
  personId: number; leadId: number | null; nummer: string;
  /** E-240: seine offenen Nachrichten und Maras letzte — für „hat er zugestimmt?" (Server, nicht Modell). */
  kunde?: string; letzteDu?: string;
  auskunft?: AuskunftTeil | null;
}

export async function werkzeugAusfuehren(name: string, args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const mt = await import("./fiaon-mara-termin");
  if (name === "freie_zeiten") {
    const ang = await mt.freieZeiten(ctx.personId);
    const von = args?.von ? mt.wunschLesen(args.von) : null;
    const bis = args?.bis ? mt.wunschLesen(args.bis) : null;
    const v = mt.vorschlaege(ang.slots, { von, bis }, 4);
    const heute = ang.agent ? await mt.arbeitszeitAm(ang.agent.id, new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })) : null;
    if (v.length) {
      await mt.protokollieren({
        art: "zeiten_angeboten", nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
        text: `Freie Zeiten von ${ang.agent?.name ?? "dem Team"} geholt: ${v.map((s) => mt.slotText(s.beginn)).join(", ")}.`,
        daten: { zeiten: v.map((s) => s.beginn), weg: ang.weg, grund: ang.grund },
      });
    }
    return {
      ergebnis: v.length
        ? { ok: true, mitarbeiter: ang.agent?.vorname ?? "jemand aus unserem Team", arbeitszeit_heute: heute ?? "heute nicht im Dienst",
            zeiten: v.map((s) => ({ zeit: `${s.datum} ${s.uhrzeit}`, so_schreiben: mt.slotText(s.beginn) })) }
        : { ok: false, meldung: `In den nächsten Tagen ist keine Zeit frei${ang.grund ? ` (${ang.grund})` : ""}. Schick den Terminlink oder übergib an einen Menschen.` },
      aktion: { werkzeug: name, ok: v.length > 0, zeiten: v.map((s) => s.uhrzeit) },
    };
  }
  if (name === "rueckruf_eintragen") {
    const r = await mt.rueckrufBuchen(ctx, {
      zeit: args?.zeit || null, von: args?.von || null, bis: args?.bis || null,
      anliegen: String(args?.anliegen ?? ""), verschieben: args?.verschieben === true,
    });
    const altZeiten = (r.alternativen ?? []).map((t) => (t.match(/\d{2}:\d{2}/)?.[0] ?? "")).filter(Boolean);
    return {
      ergebnis: r.ok && r.termin
        ? { ok: true, eingetragen: `${r.termin.text}`, wochentag: r.termin.wochentag, datum: r.termin.datum, uhrzeit: r.termin.uhrzeit, mitarbeiter: r.termin.vorname, so_schreiben: `Ist eingetragen: ${r.termin.text} — ${r.termin.vorname} ruft Sie an.` }
        : { ok: false, grund: r.meldung, alternativen: r.alternativen ?? [] },
      aktion: {
        werkzeug: name, ok: r.ok, zeiten: r.termin ? [r.termin.uhrzeit, ...altZeiten] : altZeiten,
        termin: r.termin ? { id: r.termin.id, text: r.termin.text, uhrzeit: r.termin.uhrzeit, vorname: r.termin.vorname, agentName: r.termin.agentName, datum: r.termin.datum, wochentag: r.termin.wochentag } : undefined,
      },
    };
  }
  if (name === "zahlungszusage_merken") {
    const datum = String(args?.datum ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ergebnis: { ok: false, grund: "Kein gültiges Datum (YYYY-MM-DD)." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    if (datum < heute) return { ergebnis: { ok: false, grund: "Der Tag liegt in der Vergangenheit." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    const [alt] = (await sqlPool`SELECT promised_payment_date FROM fiaon_persons WHERE id = ${ctx.personId}`) as any[];
    await sqlPool`UPDATE fiaon_persons SET promised_payment_date = ${datum}::date, updated_at = NOW() WHERE id = ${ctx.personId}`;
    const schoen = new Date(`${datum}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
    const vorher = alt?.promised_payment_date ? new Date(alt.promised_payment_date).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : null;
    await mt.protokollieren({
      art: "zahlungszusage", nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
      text: `Zahlungszusage festgehalten: ${schoen}${vorher ? ` (vorher ${vorher})` : ""}.${args?.hinweis ? ` „${String(args.hinweis).slice(0, 160)}"` : ""}`,
      daten: { datum, vorher: alt?.promised_payment_date ?? null },
    });
    try {
      const { waAktenvermerk } = await import("./fiaon-whatsapp");
      await waAktenvermerk(ctx.personId, `Zahlungszusage per WhatsApp: ${schoen}.${args?.hinweis ? ` „${String(args.hinweis).slice(0, 160)}"` : ""}`);
    } catch { /* ohne Bestellung keine Akte */ }
    return { ergebnis: { ok: true, festgehalten: schoen, so_schreiben: `Festgehalten: ${schoen}. Ihre Zahlungsseite bleibt bis dahin offen.` }, aktion: { werkzeug: name, ok: true, zeiten: [] } };
  }
  if (name === "terminlink_schicken") {
    const r = await mt.terminlinkFuer(ctx);
    return { ergebnis: r.ok ? { ok: true, link: r.link, zeiten_von: r.agent ?? "unserem Team" } : { ok: false, grund: r.meldung }, aktion: { werkzeug: name, ok: r.ok, zeiten: [], link: r.link } };
  }
  if (name === "auskunft_anbieten") return auskunftAnbieten(ctx);
  return { ergebnis: { ok: false, grund: "Unbekanntes Werkzeug." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
}

/**
 * auskunft_anbieten (E-240). Zwei Wege, beide mit echtem Link:
 *   · offene Bestellung → ihre Zahlungsseite (nichts Neues),
 *   · sonst → der signierte Kauflink: Bestätigungsseite mit Preis, AGB,
 *     Widerrufsbelehrung und der Wahl zum Beginn (ein Klick), danach die
 *     Zahlungsseite. Gegenlesen 24.09.2026: kein direktes Anlegen mehr nach
 *     einem „Ja" im Chat (Begründung unten am Kauflink).
 * Bezahlt, liegt vor oder gemeldet: nichts verkaufen. Werbesperre (oder
 * Vertriebssperre, gekündigt): nur auf seinen ausdrücklichen Wunsch.
 */
async function auskunftAnbieten(ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const name = "auskunft_anbieten";
  const nein = (grund: string) => ({ ergebnis: { ok: false, grund }, aktion: { werkzeug: name, ok: false, zeiten: [] } as Aktion });
  if (!ctx.auskunft) return nein("Für ihn gibt es hier kein Auskunft-Angebot — nenne keinen Preis und keinen Link.");
  // E-241: Ein offener Antrag oder Lead bekommt sie nur als Antwort (auskunftJetzt) — geprüft
  // hier am Server, nicht nur über die Werkzeugliste: Ruft das Modell das Werkzeug ungefragt, gilt das.
  const segment: AuskunftSegment = ctx.auskunft.segment ?? "kunde";
  if (segment !== "kunde" && !ctx.auskunft.jetzt) {
    return nein("Er hat weder auf unser Angebot geantwortet noch selbst nach der Auskunft gefragt — biete sie nicht an, nenne keinen Preis und keinen Link.");
  }
  const { auskunftStand, auskunftArtFuer } = await import("./fiaon-auskunft");
  // Dieselbe Art wie der Kauflink unten — sonst nennte Mara 74 € und die Seite zeigte 199 €.
  // Gegenlesen E-241: Art und Land aus seiner Lage (auskunftLage) — bei Antrag und Lead die des
  // Takt-Angebots, beim zahlenden Kunden dieselbe Regel wie bisher (auskunftArtFuer, Land aus dem Antrag).
  const auskunftArt = ctx.auskunft.art ?? await auskunftArtFuer(ctx.personId);
  const stand = await auskunftStand(ctx.personId, undefined, auskunftArt);
  const land = ctx.auskunft.land ?? stand.land;
  if (stand.stufe === "bezahlt") return nein("Die Auskunft ist schon bezahlt — wir fordern sie an. Nichts verkaufen.");
  if (stand.stufe === "dokument") return nein("Eine Auskunft liegt schon in seiner Akte — nichts verkaufen.");
  if (stand.offen?.status === "claimed_paid") return nein("Er hat die Zahlung der Auskunft schon gemeldet — die Zahlungsstelle prüft den Eingang. Kein Link.");
  const kunde = String(ctx.kunde ?? "");
  const du = String(ctx.letzteDu ?? "");
  const zugestimmt = auskunftZugestimmt(kunde, du);
  const sperre = werbungVerboten(await personSperre(ctx.personId).catch(() => null));
  if (sperre && !zugestimmt && !auskunftGefragt(kunde)) return nein(`${sperre} — die Auskunft nur, wenn er sie ausdrücklich haben will. Kein Angebot.`);

  let link: string;
  let betrag = stand.preis.text;
  let art: Aktion["art"] = "angebot";
  if (stand.stufe === "offen" && stand.offen?.paymentReference) {
    link = absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`);
    betrag = euroText(stand.offen.betragCents);
    art = "offen";
  } else {
    // ── GEGENLESEN 24.09.2026: EINE NEUE BESTELLUNG NUR ÜBER DIE BESTÄTIGUNGSSEITE ──
    // Die erste Fassung legte nach einem „Ja" die Bestellung direkt an (auskunftBestellen,
    // quelle mara_wa): Rechnungsnummer, Zahlungsdaten-Mail — ohne dass er Preis, AGB und
    // Widerrufsbelehrung vor dem Vertrag gesehen und ohne die Wahl „vor Ablauf der
    // Widerrufsfrist beginnen". Ohne dokumentierte Wahl liefert der Liefer-Weg sofort
    // (fiaon-auskunft-lieferung.ts, Abschnitt 0) — widerruft er danach, schuldet er keinen
    // Wertersatz (§ 357a Abs. 2 BGB), und sein Widerrufsrecht erlischt nicht (§ 356 Abs. 4).
    // Und „Ja" auf „Soll ich Ihnen den Link schicken?" ist kein Auftrag. Der signierte
    // Kauflink führt auf die Seite mit „Zahlungspflichtig beauftragen", AGB, Widerrufs-
    // belehrung und der Wahl — ein Klick, dann dieselbe Zahlungsseite.
    const { kaufLink } = await import("../routes/fiaon-auskunft-kauf");
    link = kaufLink(ctx.personId, auskunftArt);
  }
  await betreuerZurAuskunft(ctx.personId, { art, betrag, kunde, segment });
  return {
    ergebnis: {
      ok: true, link, preis: betrag, einmalig: true, kundenpreis_mit_paket: stand.preis.mitAbo,
      wort: auskunftWort(land), auskunfteien: auskunfteienText(land),
      was_passiert: art === "angebot"
        ? "Über den Link bestätigt er die Bestellung mit einem Klick; danach sieht er Betrag, Verwendungszweck und QR-Code."
        : "Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code.",
      so_schreiben: `Hier geht es direkt weiter: ${link}`,
    },
    aktion: { werkzeug: name, ok: true, zeiten: [], link, betrag, art },
  };
}

/**
 * Der Betreuer erfährt es sofort — als Aufgabe (Mail + Hinweis im Office),
 * eine je Kunde und Tag. Justin (Fall Doris Hösl): „informiert den Betreuer aktiv".
 */
async function betreuerZurAuskunft(personId: number, ein: { art: Aktion["art"]; betrag: string; kunde: string; segment?: AuskunftSegment }): Promise<void> {
  const tag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const segment: AuskunftSegment = ein.segment ?? "kunde";
  const was = ein.art === "bestellt" ? `hat die Bonitätsauskunft für ihn bestellt (${ein.betrag}, Zahlung offen)`
    : ein.art === "offen" ? `hat ihm den Link zur offenen Zahlung seiner Bonitätsauskunft geschickt (${ein.betrag})`
    : `hat ihm die Bonitätsauskunft angeboten (${ein.betrag}) und den Link zum Bestellen geschickt`;
  try {
    // ── E-241: OFFENER ANTRAG ODER LEAD ─────────────────────────────────────
    // Die Aufgabe geht nach der Regel des Hauses (auskunftAufgabeAn, Postmeister-
    // Werkzeuge): Betreuer, sonst wer den Lead übernommen hat, sonst die
    // Vertriebsleitung mit der kleinsten Last — findet sich niemand, keine Aufgabe.
    let agentId: number | null = null;
    if (segment !== "kunde") {
      const { auskunftAufgabeAn } = await import("./fiaon-postmeister-werkzeuge");
      const an = await auskunftAufgabeAn(personId);
      if (!an) {
        console.log(`[MARA-WA] Auskunft-Angebot an Person ${personId}: niemand zuständig — keine Aufgabe.`);
        return;
      }
      agentId = an.agentId;
    }
    const anruf = segment === "antrag" ? "Bitte kurz anrufen: die Auskunft erklären und die erste Zahlung für sein Paket mitnehmen."
      : segment === "lead" ? "Bitte kurz anrufen: die Auskunft erklären und seinen Antrag mitnehmen."
      : "Bitte kurz anrufen: Auskunft, Karte und Wunschlimit besprechen.";
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      ...(agentId ? { agentId } : {}),
      personId, ref: null,
      titel: ein.art === "bestellt" ? "WhatsApp: Bonitätsauskunft bestellt — bitte begleiten"
        : segment === "kunde" ? "WhatsApp: Bonitätsauskunft angeboten — bitte nachfassen"
        : `WhatsApp: Bonitätsauskunft angeboten (${segment === "antrag" ? "Antrag offen" : "Interessent"}) — bitte nachfassen`,
      text: `Mara ${was}. Der Kunde schrieb: „${ein.kunde.replace(/\s+/g, " ").slice(0, 240)}". ${anruf}`,
      quelle: "mara-whatsapp", dringend: false, link: `/agent/kunden?person=${personId}`,
      schluessel: `wa-auskunft-${personId}-${tag}`, autorName: "Mara",
      anlageText: "Angelegt von Mara aus WhatsApp.",
    });
  } catch (e) { console.error("[MARA-WA] Auskunft-Aufgabe:", String((e as Error)?.message || e).slice(0, 160)); }
}

/**
 * Behauptet die Antwort etwas, das kein Werkzeug getan hat? (hart)
 *   · „eingetragen/gebucht/steht" ohne erfolgreiche Buchung
 *   · eine Uhrzeit, die weder aus einem Werkzeug noch vom Kunden stammt
 */
export function handlungsPruefung(
  antwort: string, aktionen: Aktion[], kunde: string, verlaufText = "",
  /** E-240: Links und Auskunft-Preise, die aus SEINE LAGE stammen (null = Lead: nur die vier Katalogpreise). */
  bekannt: { links?: string[]; auskunftPreise?: string[] | null; /** Gegenlesen 24.09.2026: sein Land (nur bei Kunden bekannt). */ land?: AuskunftLand | null } = {},
): string[] {
  const a = String(antwort ?? "");
  const funde: string[] = [];
  const gebucht = aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok);
  if (!gebucht && /\b(?:ist|wurde|habe|hab)\s+(?:\w+\s+){0,3}(?:eingetragen|gebucht)\b|\b(?:termin|rückruf|anruf)\b[^.!?]{0,40}\b(?:steht|eingetragen|gebucht|bestätigt)\b/i.test(a)
    && !/\b(?:schon|bereits)\b[^.!?]{0,40}\b(?:termin|rückruf)\b/i.test(a)) {
    funde.push("Du hast keinen Rückruf eingetragen — sag nicht, er sei eingetragen oder gebucht. Trag ihn mit rueckruf_eintragen ein oder frag nach der Zeit.");
  }
  const bekannteZeiten = new Set<string>([...aktionen.flatMap((x) => x.zeiten), ...(`${kunde}\n${verlaufText}`.match(/\b\d{1,2}[:.]\d{2}\b/g) ?? []).map((t) => t.replace(".", ":").padStart(5, "0"))]);
  const genannt = (a.match(/\b\d{1,2}:\d{2}\b/g) ?? []).map((t) => t.padStart(5, "0"));
  const fremd = genannt.filter((t) => !bekannteZeiten.has(t));
  if (fremd.length) funde.push(`Die Uhrzeit ${fremd.join(", ")} stammt aus keinem Werkzeug — nenne nur Zeiten aus freie_zeiten oder rueckruf_eintragen.`);

  // ── E-240: KEIN ERFUNDENER ZAHLUNGS- ODER KAUFLINK ─────────────────────────
  // Jeder Link auf eine Zahlungsseite oder die Auskunft-Bestellung muss aus einem
  // Werkzeug, aus SEINE LAGE oder aus dem Verlauf stammen (dort hat er ihn schon).
  const pfad = (u: string): string | null => {
    const m = String(u).match(/\/(?:zahlung\/[^\s)"“”<>]+|api\/fiaon\/auskunft\/bestellen\?[^\s)"“”<>]+)/i);
    return m ? m[0].replace(/[.,;:!?]+$/, "").toLowerCase() : null;
  };
  const erlaubteLinks = new Set<string>(
    [...aktionen.map((x) => x.link ?? ""), ...(bekannt.links ?? []), ...(verlaufText.match(/\S+/g) ?? [])]
      .map(pfad).filter((x): x is string => !!x),
  );
  const fremdeLinks = (a.match(/\S*\/(?:zahlung\/|api\/fiaon\/auskunft\/bestellen\?)\S*/gi) ?? [])
    .filter((u) => { const p = pfad(u); return !!p && !erlaubteLinks.has(p); });
  if (fremdeLinks.length) funde.push(`Den Link ${fremdeLinks[0].slice(0, 80)} hast du aus keinem Werkzeug — schick nur Links aus auskunft_anbieten, terminlink_schicken oder aus SEINE LAGE.`);

  // ── E-240: KEIN ERFUNDENER AUSKUNFT-PREIS ──────────────────────────────────
  // In jedem Satz über die Auskunft: nur Beträge, die es gibt — für einen Kunden
  // sein Preis (und zum Vergleich der Einzelpreis), für alle anderen die vier
  // Katalogpreise (74/149/199/349 €).
  const erlaubtePreise = new Set<number>(bekannt.auskunftPreise
    ? bekannt.auskunftPreise.map(centsAus).filter((x): x is number => x != null)
    : Array.from(AUSKUNFT_CENTS));
  for (const x of aktionen) { const c = x.betrag ? centsAus(x.betrag) : null; if (c != null) erlaubtePreise.add(c); }
  for (const satz of a.split(/(?<=[.!?])\s+/)) {
    if (!/auskunft|schufa|\bksv\b|bonität/i.test(satz)) continue;
    for (const m of Array.from(satz.matchAll(/(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*(?:€|euro\b)/gi))) {
      // Gegenlesen 24.09.2026: Eine Monatsrate im selben Satz („… Ihr Paket 59,99 € im Monat") ist kein Auskunft-Preis.
      const danach = satz.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 20);
      if (/^\s*(?:im|pro|je|\/)\s*monat|^\s*monatlich/i.test(danach)) continue;
      const c = centsAus(m[1]);
      if (c != null && !erlaubtePreise.has(c)) funde.push(`Der Betrag ${m[0].trim()} für die Auskunft stimmt nicht — nenne nur den Preis aus SEINE LAGE oder aus auskunft_anbieten.`);
    }
  }
  // ── GEGENLESEN 24.09.2026: ÖSTERREICH UND SCHWEIZ NIE „SCHUFA" ─────────────
  // Harte Regel des Auftrags (E-240). Bisher stand sie nur im Auftrag an das Modell;
  // die allgemeinen Sätze („Ihre Schufa muss nicht perfekt sein") sagen das Wort aber.
  // Schreibt er es selbst, darf Mara es aufgreifen.
  if (bekannt.land && bekannt.land !== "DE" && /schufa/i.test(a) && !/schufa/i.test(kunde)) {
    funde.push(`In seinem Land heißt sie „${auskunftWort(bekannt.land)}" — schreib nie „SCHUFA", sondern ${auskunfteienText(bekannt.land)} bzw. „Bonitätsauskunft".`);
  }
  return Array.from(new Set(funde));
}

/**
 * Der Entwurf: denken (mit Werkzeugen) → harte Wand + Wahrheit + Handlung + Verkaufsprüfung
 * → höchstens EIN zweiter Entwurf mit allen Hinweisen (OHNE Werkzeuge — gebucht ist gebucht;
 * der zweite Entwurf sieht die Ergebnisse). Hält der zweite die harte Wand nicht, der erste aber
 * schon, geht der erste. Exportiert, damit der Prüfstand genau diesen Weg durchspielen kann.
 */
export async function entwerfen(
  system: string,
  pruef: {
    kunde: string; kontext?: string; letzteDu: string[]; verkaufen: boolean; verlaufText?: string; zahlungslage?: boolean;
    auskunftAngebot?: boolean; werbesperre?: boolean;
    bekannt?: { links?: string[]; auskunftPreise?: string[] | null; land?: AuskunftLand | null };
  },
  werkzeugKontext?: WerkzeugKontext | null,
): Promise<{ roh: any; antwort: string; funde: string[]; hinweise: string[]; zweiter: boolean; kiFehler: string | null; aktionen: Aktion[] }> {
  const d1 = await denken(system, [], werkzeugKontext ?? null);
  const aktionen = d1.aktionen;
  const roh1 = d1.roh;
  if (!roh1) return { roh: null, antwort: "", funde: ["Kein Text erzeugt."], hinweise: [], zweiter: false, kiFehler: d1.fehler || "KI nicht erreichbar", aktionen };
  const pruefe = (a: string) => ({
    hart: a ? [...sendePruefung(a), ...wahrheitsBefunde(a, pruef.kunde).map((f) => f.text), ...handlungsPruefung(a, aktionen, pruef.kunde, pruef.verlaufText, pruef.bekannt)] : ["Kein Text erzeugt."],
    nurJa: a ? (() => { const w = wahrheitsBefunde(a, pruef.kunde); return w.length > 0 && w.every((f) => f.art === "ja") && !sendePruefung(a).length && !handlungsPruefung(a, aktionen, pruef.kunde, pruef.verlaufText, pruef.bekannt).length; })() : false,
    weich: a ? verkaufsPruefung(a, pruef) : [],
  });
  const a1 = String(roh1?.antwort ?? "").trim();
  const p1 = pruefe(a1);
  if (!p1.hart.length && !p1.weich.length) return { roh: roh1, antwort: a1, funde: [], hinweise: [], zweiter: false, kiFehler: null, aktionen };

  console.warn(`[MARA-WA] Entwurf überarbeitet (${[...p1.hart, ...p1.weich].join(" · ").slice(0, 300)})`);
  const nein = wahrheitsBefunde(a1, pruef.kunde).some((f) => f.art === "ja");
  const bitte = [
    p1.hart.length ? `Diese Antwort darf so nicht raus: ${p1.hart.join("; ")}.` : "",
    p1.weich.length ? `Sie verkauft nicht gut genug: ${p1.weich.join(" ")}` : "",
    nein
      ? "Schreib sie neu — wahr, kurz, beginne mit dem Positiven, das stimmt (nicht mit Ja, Klar, Keine Sorge oder Gute Nachricht), gleiche Fakten."
      : "Schreib sie neu — wahr, kurz, positiv zuerst, gleiche Fakten, ohne diese Wörter und Wendungen.",
    aktionen.length ? "Die Werkzeuge sind schon gelaufen — übernimm Zeiten, Namen und Links genau aus ihren Ergebnissen, ruf keines neu auf." : "",
  ].filter(Boolean).join(" ");
  const d2 = await denken(system, [...d1.werkzeugVerlauf, ...(a1 ? [{ role: "assistant" as const, content: JSON.stringify({ antwort: a1 }) }] : []), { role: "user" as const, content: bitte }], null);
  const roh2 = d2.roh;
  const a2 = String(roh2?.antwort ?? "").trim();
  const p2 = pruefe(a2);
  if (roh2 && !p2.hart.length) return { roh: roh2, antwort: a2, funde: [], hinweise: p2.weich, zweiter: true, kiFehler: null, aktionen };
  if (!p1.hart.length) return { roh: roh1, antwort: a1, funde: [], hinweise: p1.weich, zweiter: true, kiFehler: null, aktionen };
  // Letzter Ausweg vor dem Rückfallsatz: Ist das EINZIGE Problem ein Ja-Wort am Anfang, streichen wir es.
  for (const [roh, a, p] of [[roh2, a2, p2], [roh1, a1, p1]] as const) {
    if (roh && p.nurJa) {
      const ohne = jaStreichen(a);
      if (ohne !== a && !pruefe(ohne).hart.length) {
        console.warn(`[MARA-WA] Ja-Wort gestrichen: „${a.slice(0, 60)}"`);
        return { roh, antwort: ohne, funde: [], hinweise: [], zweiter: true, kiFehler: null, aktionen };
      }
    }
  }
  return { roh: roh2, antwort: a2, funde: p2.hart, hinweise: [], zweiter: true, kiFehler: roh2 ? null : d2.fehler, aktionen };
}

/** Das OpenAI-Guthaben ist leer — einmal am Tag eine dringende Aufgabe an die Geschäftsführung. */
const guthabenGemeldet = new Set<string>();
async function kiGuthabenAlarm(fehler: string): Promise<void> {
  const tag = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  if (guthabenGemeldet.has(tag)) return;
  guthabenGemeldet.add(tag);
  console.error(`[MARA-WA] KI-Guthaben leer: ${fehler.slice(0, 160)}`);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: null, ref: null, anBetreiber: true,
    titel: "OpenAI-Guthaben leer — Mara kann nicht antworten",
    text: "OpenAI meldet: kein Guthaben mehr. Bitte sofort unter platform.openai.com → Settings → Billing aufladen. "
      + "Bis dahin antworten Mara (WhatsApp und Postfach) und alle anderen KI-Dienste nicht. Kunden auf WhatsApp bekommen "
      + `nach ${KI_GEDULD_MIN} Minuten einen kurzen Rückfallsatz, und ihr Betreuer eine Aufgabe; sobald das Guthaben da ist, beantwortet Mara die offenen Fragen von selbst (bis 12 Stunden zurück).`,
    quelle: "mara-whatsapp", dringend: true, link: "/chef/s/mara",
    schluessel: `ki-guthaben-${tag}`,
  } as any).catch((e) => console.error("[MARA-WA] Guthaben-Alarm:", e));
}

type Nachricht = { role: "assistant" | "user" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string };

/**
 * Ein KI-Aufruf — mit Werkzeugen höchstens vier Runden. Bei einem Fehler je Runde genau ein
 * zweiter Versuch. Liefert die Antwort ODER den letzten Fehler, dazu was die Werkzeuge taten
 * und den Werkzeug-Verlauf (für einen zweiten Entwurf ohne neue Aufrufe).
 */
async function denken(system: string, nachtrag: Nachricht[], ctx: WerkzeugKontext | null): Promise<{ roh: any; fehler: string | null; aktionen: Aktion[]; werkzeugVerlauf: Nachricht[] }> {
  let fehler: string | null = null;
  const aktionen: Aktion[] = [];
  const werkzeugVerlauf: Nachricht[] = [];
  const basis = [
    { role: "system", content: system },
    { role: "user", content: "Antworte jetzt auf seine letzte Nachricht — und auf alles davor, was noch offen ist." },
    ...nachtrag,
  ];
  for (let runde = 0; runde < (ctx ? 4 : 1) + 1; runde++) {
    const mitWerkzeugen = !!ctx && runde < 4;
    let j: any = null;
    for (let versuch = 1; versuch <= 2 && !j; versuch++) {
      try {
        j = await kiAufruf({
          dienst: DIENST_WA, modell: MODELL(), aufwand: "low", maxTokens: 2500, schema: SCHEMA,
          nachrichten: [...basis, ...werkzeugVerlauf] as any,
          ...(mitWerkzeugen ? { tools: werkzeugeFuer(ctx) } : {}),
        });
        void kostenCentsAus(MODELL(), j?.usage);
      } catch (e) {
        fehler = String((e as Error)?.message || e).slice(0, 300);
        console.warn(`[MARA-WA] KI-Aufruf ${versuch} gescheitert:`, fehler.slice(0, 160));
      }
    }
    if (!j) return { roh: null, fehler, aktionen, werkzeugVerlauf };
    const msg = j?.choices?.[0]?.message ?? {};
    const aufrufe: any[] = mitWerkzeugen && Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (!aufrufe.length) {
      try { return { roh: antwortLesen(j, "Mara-WhatsApp"), fehler: null, aktionen, werkzeugVerlauf }; }
      catch (e) { fehler = String((e as Error)?.message || e).slice(0, 300); return { roh: null, fehler, aktionen, werkzeugVerlauf }; }
    }
    werkzeugVerlauf.push({ role: "assistant", content: String(msg.content ?? ""), tool_calls: aufrufe });
    for (const c of aufrufe) {
      let args: any = {};
      try { args = JSON.parse(c?.function?.arguments || "{}"); } catch { args = {}; }
      const name = String(c?.function?.name ?? "");
      const r = await werkzeugAusfuehren(name, args, ctx!).catch((e) => ({
        ergebnis: { ok: false, grund: `Technischer Fehler: ${String((e as Error)?.message || e).slice(0, 120)}` },
        aktion: { werkzeug: name, ok: false, zeiten: [] } as Aktion,
      }));
      aktionen.push(r.aktion);
      werkzeugVerlauf.push({ role: "tool", tool_call_id: String(c.id), content: JSON.stringify(r.ergebnis).slice(0, 2000) });
      console.log(`[MARA-WA] Werkzeug ${name}: ${r.aktion.ok ? "ok" : "nicht möglich"}${r.aktion.termin ? ` — ${r.aktion.termin.text}` : ""}`);
    }
  }
  return { roh: null, fehler: "Zu viele Werkzeugrunden.", aktionen, werkzeugVerlauf };
}

/**
 * SIE ANTWORTET NICHT IN EINER SEKUNDE (E-224): Die Antwort wird vorbereitet
 * und nach 6–18 Sekunden fällig — lesen, denken, tippen. Kommt bis dahin eine
 * neue Nachricht, denkt sie neu (versandLauf).
 */
async function vorbereiten(nummer: string, antwort: string, aufId: number, frage: string, meta: { kunde?: string; handlung?: string } = {}): Promise<void> {
  const faellig = new Date(Date.now() + verzoegerungMs(antwort, frage));
  const kunde = String(meta.kunde ?? frage ?? "").slice(0, 1000);
  const handlung = String(meta.handlung ?? "").slice(0, 1000) || null;
  await sqlPool`
    INSERT INTO fiaon_whatsapp_gespraech (nummer, antwort_text, antwort_faellig_am, antwort_auf_id, antwort_kunde, antwort_handlung, updated_at)
    VALUES (${nummer}, ${antwort}, ${faellig}, ${aufId}, ${kunde}, ${handlung}, NOW())
    ON CONFLICT (nummer) DO UPDATE SET
      antwort_text = ${antwort}, antwort_faellig_am = ${faellig}, antwort_auf_id = ${aufId},
      antwort_kunde = ${kunde}, antwort_handlung = ${handlung}, updated_at = NOW()`;
  weckerStellen(faellig.getTime() - Date.now());
}

// ═══════════════════════════════════════════════════════════════════════════
// DER AKTENVERMERK ZU JEDER MARA-ANTWORT (24.09.2026, E-240)
//
// Justin: „Mara speichert alles Besprochene in der Akte." Bisher stand dort nur,
// was Mara übergab (aufgabeFuerMenschen) oder als Zahlungszusage festhielt —
// ein normales Gespräch hinterließ nichts; fiaon_contact_log.ref ist NOT NULL,
// deshalb am jüngsten Vorgang der Person (wie waAktenvermerk). Gebündelt: ein
// Vermerk je Person und Stunde, spätere Antworten werden angehängt — sonst
// stünden bei einem lebhaften Chat dreißig Zeilen zwischen zwei Telefonaten.
// ═══════════════════════════════════════════════════════════════════════════
export const VERMERK_KOPF = "Mara (WhatsApp):";
const VERMERK_MAX = 3800;

const knapp = (t: unknown, n: number) => {
  const s = String(t ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

/** Eine Zeile des Vermerks — exportiert für den Prüfstand. */
export function vermerkZeile(teil: { kunde: string; mara: string; handlung: string }): string {
  return `Kunde „${knapp(teil.kunde, 180) || "(ohne Text)"}" — Mara „${knapp(teil.mara, 220)}" — Handlung: ${knapp(teil.handlung, 300) || "keine"}`;
}

export async function maraWaVermerk(personId: number | null, teil: { kunde: string; mara: string; handlung: string }): Promise<"neu" | "ergaenzt" | "ohne_vorgang" | "fehler"> {
  if (!personId) return "ohne_vorgang";
  const zeile = vermerkZeile(teil);
  try {
    const [alt] = (await sqlPool`
      SELECT id, LENGTH(note) AS laenge FROM fiaon_contact_log
       WHERE person_id = ${personId} AND agent_name = 'Mara' AND type = 'system' AND voided_at IS NULL
         AND note LIKE ${VERMERK_KOPF + "%"} AND created_at > NOW() - INTERVAL '1 hour'
       ORDER BY id DESC LIMIT 1`) as any[];
    if (alt && Number(alt.laenge || 0) + zeile.length + 3 <= VERMERK_MAX) {
      await sqlPool`UPDATE fiaon_contact_log SET note = note || ${" | " + zeile} WHERE id = ${Number(alt.id)}`;
      return "ergaenzt";
    }
    const [a] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL AND ref IS NOT NULL
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (!a?.ref) return "ohne_vorgang";
    await sqlPool`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${personId}, ${String(a.ref)}, NULL, 'Mara', 'system', ${`${VERMERK_KOPF} ${zeile}`})`;
    return "neu";
  } catch (e) {
    console.error("[MARA-WA] Aktenvermerk:", String((e as Error)?.message || e).slice(0, 160));
    return "fehler";
  }
}

/** Ein Mensch muss übernehmen — als Aufgabe beim Betreuer (oder beim Team, wenn es keinen gibt). */
/** Maras Protokoll (fiaon_mara_protokoll) — wirft nie. */
async function protokolliere(ein: { art: string; ok?: boolean; text: string; nummer: string; personId: number | null; leadId: number | null; daten?: Record<string, unknown> }): Promise<void> {
  try {
    const { protokollieren } = await import("./fiaon-mara-termin");
    await protokollieren({ ...ein, art: ein.art as any, personId: ein.personId ? Number(ein.personId) : null, leadId: ein.leadId ? Number(ein.leadId) : null });
  } catch (e) { console.error("[MARA-WA] Protokoll:", e); }
}

/** KI-Ausfall: eine Aufgabe je offener Nachricht, nicht je Nachhol-Runde. */
const kiAufgabeGemeldet = new Set<string>();

async function aufgabeFuerMenschen(nummer: string, personId: number | null, leadId: number | null, grund: string, dringend = false): Promise<void> {
  const tag = new Date().toISOString().slice(0, 10);
  if (personId) {
    const { waAktenvermerk } = await import("./fiaon-whatsapp");
    await waAktenvermerk(personId, `WhatsApp (+${nummer}): ${grund}`);
  }
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: personId ?? null, ref: null,
    titel: dringend ? "WhatsApp: bitte jetzt übernehmen" : "WhatsApp: bitte übernehmen",
    text: `${grund}${personId ? "" : ` · Nummer +${nummer}${leadId ? ` · Lead ${leadId}` : ""}`}`,
    quelle: "mara-whatsapp", dringend,
    link: "/chef/s/whatsapp",
    // Eine Aufgabe je Mensch (oder Nummer) und Tag — nicht je Nachricht.
    schluessel: personId ? `wa-${personId}-${tag}` : `wa-n${nummer}-${tag}`,
  }).then(async (erg: any) => {
    await protokolliere({ art: "uebergabe", ok: true, nummer, personId, leadId,
      text: `Aufgabe an ${erg?.agentName ?? "das Team"}${dringend ? " (dringend)" : ""}: ${grund.slice(0, 300)}`, daten: { aufgabe_id: erg?.id ?? null } });
  }).catch((e) => console.error("[MARA-WA] Aufgabe:", e));
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS TEMPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wie lange ein Mensch für diese Antwort bräuchte: lesen, denken, tippen —
 * 6 bis 18 Sekunden (E-224), mit Streuung, nie zweimal dieselbe Zahl.
 */
export function verzoegerungMs(antwort: string, frage: string): number {
  const lesen = Math.min(2500, String(frage).length * 18);
  const denkpause = 2000 + Math.random() * 2500;
  const tippen = Math.min(9000, (String(antwort).length / 28) * 1000);
  const streuung = 0.85 + Math.random() * 0.3;
  return Math.round(Math.min(18_000, Math.max(6000, (lesen + denkpause + tippen) * streuung)));
}

let versandLaeuft = false;

/** Genau dann senden, wenn es so weit ist (E-224) — der Takt bleibt als Netz. */
function weckerStellen(ms: number): void {
  setTimeout(() => { void versandLauf().catch((e) => console.error("[MARA-WA] Wecker:", e)); }, Math.max(500, ms + 300));
}

/**
 * Schickt die fälligen Antworten (Takt alle 20 Sekunden + Wecker) und prüft
 * vorher, was sich in der Wartezeit geändert haben kann: eine neue
 * Kundennachricht (→ neu denken), eine Antwort aus dem Team (→ verwerfen),
 * Schalter von Hand aus, Fenster zu.
 */
export async function versandLauf(): Promise<{ gesendet: number; verworfen: number }> {
  if (versandLaeuft) return { gesendet: 0, verworfen: 0 };
  versandLaeuft = true;
  let gesendet = 0, verworfen = 0;
  try {
    await gespraechSchema();
    const faellig = (await sqlPool`
      SELECT nummer, antwort_text, antwort_auf_id, antwort_kunde, antwort_handlung, mara_an, mara_aus_grund, COALESCE(antwort_versuche, 0) AS versuche FROM fiaon_whatsapp_gespraech
       WHERE antwort_text IS NOT NULL AND antwort_faellig_am IS NOT NULL AND antwort_faellig_am <= NOW()
       LIMIT 25`.catch(() => [])) as any[];
    for (const g of faellig) {
      const nummer = String(g.nummer);
      const aufId = g.antwort_auf_id != null ? Number(g.antwort_auf_id) : null;
      // Nur leeren, was wir gelesen haben — eine inzwischen neu vorbereitete Antwort bleibt.
      const leeren = async () => {
        await sqlPool`
          UPDATE fiaon_whatsapp_gespraech SET antwort_text = NULL, antwort_faellig_am = NULL, antwort_auf_id = NULL,
                 antwort_kunde = NULL, antwort_handlung = NULL
           WHERE nummer = ${nummer} AND antwort_auf_id IS NOT DISTINCT FROM ${aufId}`;
      };
      if (g.mara_an === false && g.mara_aus_grund === "schalter") { await leeren(); verworfen++; continue; }
      const [neuesteRein] = (await sqlPool`
        SELECT id FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'rein' ORDER BY id DESC LIMIT 1`) as any[];
      // Neue Kundennachricht inzwischen? Dann neu denken — sofort, ohne die Uhr zurückzudrehen.
      if (!neuesteRein || Number(neuesteRein.id) !== aufId) {
        await leeren();
        verworfen++;
        void maraAntwortet(nummer).catch(() => {});
        continue;
      }
      // Hat inzwischen jemand aus dem Team frei geantwortet? Dann nicht doppelt.
      // Maras eigener Rückfallsatz zählt dabei nicht (E-236: nach einem KI-Ausfall holt sie die Frage nach).
      const [schonBeantwortet] = (await sqlPool`
        SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND vorlage IS NULL AND status <> 'fehler' AND id > ${aufId}
           AND NOT (COALESCE(von, '') ILIKE 'Mara%' AND (text LIKE ${"%" + RUECKFALL_ANFANG + "%"} OR text LIKE ${"%" + RUECKFALL_ZWEI + "%"}))
         LIMIT 1`) as any[];
      if (schonBeantwortet) { await leeren(); verworfen++; continue; }
      if (!(await fensterOffen(nummer))) { await leeren(); verworfen++; continue; }
      const [w] = (await sqlPool`SELECT person_id, lead_id FROM fiaon_whatsapp WHERE nummer = ${nummer} AND (person_id IS NOT NULL OR lead_id IS NOT NULL) ORDER BY id DESC LIMIT 1`) as any[];
      const namen = await agentNamen();
      const erg = await waSenden(nummer, { text: String(g.antwort_text) }, { personId: w?.person_id ?? null, leadId: w?.lead_id ?? null, von: namen.voll });
      if (erg.ok) {
        await leeren();
        await sqlPool`UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = 0 WHERE nummer = ${nummer}`;
        // E-240: Was besprochen wurde, steht in der Akte — erst jetzt, wo es wirklich raus ist.
        await maraWaVermerk(w?.person_id ? Number(w.person_id) : null, {
          kunde: String(g.antwort_kunde ?? ""), mara: String(g.antwort_text ?? ""), handlung: String(g.antwort_handlung ?? ""),
        });
        // Eine echte Antwort beendet das „Nachholen nach KI-Ausfall".
        if (!istRueckfall(g.antwort_text)) {
          await sqlPool`UPDATE fiaon_whatsapp_gespraech SET ki_rueckfall_auf_id = NULL, ki_rueckfall_am = NULL WHERE nummer = ${nummer}`;
        }
        gesendet++;
      } else if (Number(g.versuche) + 1 < 3) {
        // Die fertige Antwort bleibt — nur der Versand wird in 5 Minuten wiederholt, ohne neu zu denken.
        await sqlPool`
          UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = COALESCE(antwort_versuche, 0) + 1, antwort_faellig_am = NOW() + INTERVAL '5 minutes'
           WHERE nummer = ${nummer} AND antwort_auf_id IS NOT DISTINCT FROM ${aufId}`;
        console.warn(`[MARA-WA] ${nummer}: Versand gescheitert (${erg.grund}) — neuer Versuch in 5 Minuten.`);
      } else {
        await leeren();
        await sqlPool`UPDATE fiaon_whatsapp_gespraech SET antwort_versuche = 0, versand_aufgegeben_id = ${aufId} WHERE nummer = ${nummer}`;
        console.warn(`[MARA-WA] ${nummer}: Versand dreimal gescheitert (${erg.grund}) — aufgegeben, Aufgabe an einen Menschen.`);
        await aufgabeFuerMenschen(nummer, w?.person_id ?? null, w?.lead_id ?? null, `Maras Antwort ging dreimal nicht raus (${String(erg.grund ?? "").slice(0, 200)}). Bitte selbst antworten.`, true);
      }
    }
  } catch (e) {
    console.error("[MARA-WA] Versandtakt:", e);
  } finally {
    versandLaeuft = false;
  }
  return { gesendet, verworfen };
}

// ═══════════════════════════════════════════════════════════════════════════
// NIEMAND BLEIBT UNBEANTWORTET (E-230)
//
// Jede Minute: jedes Gespräch der letzten 23,5 Stunden, dessen neueste
// Kundennachricht nach der letzten freien Antwort kam, älter als 90 Sekunden,
// ohne vorbereitete Antwort und nicht von Hand abgeschaltet → Mara denkt.
// Höchstens ein Versuch je Nachricht alle fünf Minuten. Nachts (22–7 Uhr) nur
// Frisches (< 30 Minuten), Älteres ab 7 Uhr. „STOPP" wird nicht nachgeholt.
// ═══════════════════════════════════════════════════════════════════════════
const versucht = new Map<string, { id: number; am: number }>();

export const OFFENE_GESPRAECHE_SQL = `
  SELECT r.nummer, r.id, r.text, r.knopf, r.am, g.mara_an, g.mara_aus_grund
    FROM (
      SELECT DISTINCT ON (nummer) nummer, id, text, knopf, COALESCE(empfangen_am, created_at) AS am
        FROM fiaon_whatsapp
       WHERE richtung = 'rein' AND created_at > NOW() - INTERVAL '23 hours 30 minutes'
       ORDER BY nummer, id DESC
    ) r
    LEFT JOIN fiaon_whatsapp_gespraech g ON g.nummer = r.nummer
   WHERE (NOT EXISTS (
           SELECT 1 FROM fiaon_whatsapp o
            WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.vorlage IS NULL AND o.status <> 'fehler' AND o.id > r.id)
          -- E-236: nach einem KI-Rückfallsatz bleibt die Frage 12 Stunden lang offen, bis Mara richtig antwortet.
          OR (g.ki_rueckfall_auf_id >= r.id AND g.ki_rueckfall_am > NOW() - INTERVAL '12 hours'))
     AND g.antwort_text IS NULL
     AND COALESCE(g.mara_aus_grund, '') <> 'schalter'
     AND (g.versand_aufgegeben_id IS NULL OR g.versand_aufgegeben_id < r.id)`;

export async function nachholLauf(): Promise<{ angestossen: number }> {
  let angestossen = 0;
  await gespraechSchema();
  const stunde = stundeBerlin();
  const nacht = stunde >= 22 || stunde < 7;
  // Kostendeckel erreicht? Dann gar nicht erst anstoßen — die Aufgaben sind schon angelegt.
  const deckel = Number(await einstellung("mara_wa_tag_euro", "15")) || 15;
  if ((await kostenHeute(DIENST_WA).catch(() => 0)) >= deckel) return { angestossen: 0 };
  // E-236 (Prüfung 24.09.): 200 holen und nur die echten Anstöße deckeln — sonst belegten gedrosselte
  // oder übersprungene Gespräche die 20 Plätze, und ein neuer Kunde kam nie dran.
  const offen = (await sqlPool.unsafe(`${OFFENE_GESPRAECHE_SQL} AND r.am < NOW() - INTERVAL '90 seconds'${nacht ? " AND r.am > NOW() - INTERVAL '30 minutes'" : ""} ORDER BY r.am LIMIT 200`)
    .catch((e) => { console.error("[MARA-WA] Nachholen:", e); return []; })) as any[];
  for (const o of offen) {
    if (angestossen >= 20) break;
    const nummer = String(o.nummer);
    const alt = Date.now() - new Date(o.am).getTime();
    if (nacht && alt > 30 * 60_000) continue;
    if (istStopp(o.text, o.knopf)) continue;
    const v = versucht.get(nummer);
    if (v && v.id === Number(o.id) && Date.now() - v.am < 5 * 60_000) continue;
    versucht.set(nummer, { id: Number(o.id), am: Date.now() });
    angestossen++;
    const r = await maraAntwortet(nummer).catch((e) => ({ gesendet: false, grund: String(e) }));
    console.log(`[MARA-WA] Nachgeholt ${nummer.slice(-4)}: ${r.grund ?? (r.gesendet ? "gesendet" : "—")}`);
  }
  return { angestossen };
}
/** Für den Prüfstand (scripts/pruef-mara-verkauf.ts): derselbe Auftrag, den Mara im Betrieb bekommt. */
export { auftrag as maraAuftrag };
/** Für den Prüfstand (E-240): dieselbe Lage, die Mara im Betrieb bekommt. */
export { lageFuer as maraLage };
