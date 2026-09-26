// ═══════════════════════════════════════════════════════════════════════════
// VORLAGE: DAS ANGEBOT DER BONITÄTSAUSKUNFT (24.09.2026, E-240) — Absender „FIAON Welcome"
//
// Justin: Die Auskunft soll „weggehen wie warme Semmeln". Gemessen am 24.09.:
// Am 22.08. fielen die Kaufknöpfe des alten Dashboards weg (97 von 146
// Bestellungen kamen darüber), und die einzige Mail zur Auskunft („Ein
// Dokument fehlt noch") empfahl die kostenlose Datenkopie — ohne Preis, ohne
// Knopf. Diese Vorlage ist das Angebot: was wir tun, bei wem, was es kostet,
// und EIN Knopf, der es beauftragt.
//
// ── NEU GETEXTET: EHRLICH, ABER VERKAUFEND (26.09.2026, E-243) ─────────────
// Justin: „Entwickle umfassend gute E-Mails (etwa ‚Von der Bank wieder wegen
// eines Kredits abgelehnt? Auf unseriöse Unternehmen reingefallen, die ‚Kredit
// ohne SCHUFA' versprechen? Wir beheben Ihr Problem an der Wurzel') — ehrlich,
// aber verkaufend! … Ziel ist, die Bonitätsauskunft zu verkaufen UND ein Abo
// zu verkaufen — wenn nicht, auch gut, dann nur die Bonität."
//
// Die E-241-Texte erklärten die Leistung sauber, aber sie holten niemanden
// dort ab, wo er steht. E-243 nimmt den Schmerz des Lesers als Einstieg — je
// Stufe ein anderer Winkel, alle drei ohne Versprechen:
//   a) „Abgelehnt — und keiner sagt Ihnen, warum?" Bank, Vermieter,
//      Handyvertrag sagen Nein, eine Begründung gibt es selten. Der Grund steht
//      oft bei den Auskunfteien; wir holen die Daten, zeigen, OB und was bremst,
//      und was er tun kann — mit fertigen Schreiben. Steht dort nichts
//      Nachteiliges, weiß er auch das. („Oft", nicht „immer": Eine Bank
//      entscheidet auch nach Einkommen und eigenen Regeln.)
//   b) „Vorsicht bei ‚Kredit ohne SCHUFA'" (AT „Kredit ohne KSV", CH „Kredit
//      ohne Bonitätsprüfung", Firma „Finanzierung ohne Bonitätsprüfung") —
//      solche Versprechen lösen selten etwas und kosten oft Geld; wir setzen an
//      der Ursache an: bei den Einträgen. Keine Firmennamen. Dazu der Einwand
//      „kostenlos?" mit AUSKUNFT_KOSTENLOS_ANTWORT, wörtlich.
//   c) „Wissen, was die Bank sieht — bevor sie entscheidet" — kurz, persönlich,
//      die letzte Erinnerung, ohne Druck.
// Aus Justins Vorlage bewusst NICHT übernommen (Wortwand, E-225/E-236):
// „beheben … ein für alle Mal" (Ergebnisversprechen — wir „setzen an der
// Ursache an"), „nach uns ist die Bonität wieder perfekt", „der
// Bonitätsoptimierer schlechthin" und „Kredit" als Angebot. „Kredit" steht nur
// im WARNZITAT („Kredit ohne SCHUFA" in Anführungszeichen) — die benannte
// Ausnahme ANGEBOT_WARNZITATE_ERLAUBT unten, geprüft wie WHATSAPP_ERLAUBT.
// Und nie im Betreff: „Kredit ohne SCHUFA" ist eine der ältesten Spam-Zeilen
// überhaupt, und 500 Mails am Tag leben von ihrem Ruf beim Filter.
//
// ── VIER SEGMENTE (E-243) ──────────────────────────────────────────────────
//   · kunde     — zahlt ein Paket, hat Betreuer und Akte; Kundenpreis 74/199 €.
//   · antrag    — Antrag fertig, erste Zahlung offen; 149/349 €, dazu „mit
//                 aktivem Paket 74 €" (paket_preis_hinweis, nie „statt").
//   · lead      — hat sich gemeldet, sonst nichts; 149 €.
//   · abbrecher — NEU: Antrag begonnen, nicht fertig; 149 €. Der Takt liefert
//                 das Segment (fiaon-auskunft-verkauf.ts).
// Lead und Abbrecher bekommen zusätzlich den leisen zweiten Weg: „Lieber
// gleich mit FIAON-Paket? Dann 74 € für die Auskunft" (PAKET_WEG_URL, der
// Antrag mit src=auskunft) — mit dem ehrlichen Satz, dass das Paket einen
// eigenen Preis und eine eigene Laufzeit hat. Nur privat: Die Business-Pakete
// sind eingestellt (shared/fiaon-pakete.ts), einen Firmen-Paketweg gibt es nicht.
//
// ── ZWEI BETREFFS JE STUFE (E-243) ─────────────────────────────────────────
// Je Segment × Fassung × Art zwei Betreffzeilen im Wechsel — `betreff_variante`
// (1|2) aus der Nutzlast, sonst aus der Person (person_id, ersatzweise die
// Adresse) und der Fassung: Dieselbe Person liest a-1, b-2, c-1 oder a-2, b-1,
// c-2, und die 500 Mails eines Tages tragen nie alle dieselbe Zeile. Der
// Postmeister erkennt Antworten auf JEDE dieser Zeilen (auskunftAngebotsBetreffs
// baut sie aus dieser Vorlage, über ANGEBOT_SEGMENTE und
// ANGEBOT_BETREFF_VARIANTEN).
//
// ── NEUN TEXTE STATT DREI (25.09.2026, E-241) ─────────────────────────────
// Justin: „… an ALLE, die keine Boni-Auskunft hinterlegt oder gekauft haben …
// ein richtiger Verkaufsprozess … jeden Tag 500 Mails." Das Angebot geht damit
// nicht mehr nur an zahlende Kunden, sondern an Menschen in verschiedenen
// Lagen — „In Ihrer Akte fehlt noch …" ist für den Kunden wahr und für den
// Lead falsch, deshalb eigene Einstiege und Betreffzeilen je Segment. Die
// Firma (art = "firma") bekommt in jeder Fassung eigene Sätze — sie liest von
// ihrem Unternehmen, nicht von „Ihrer SCHUFA-Auskunft".
//
// ── DAS IST WERBUNG — MIT ALLEM, WAS DAZUGEHÖRT ───────────────────────────
// · Abmeldelink Pflicht (ABMELDEPFLICHT im Motor, die Tür in make-webhook.ts
//   lehnt ohne ihn ab) und NICHT in PFLICHTMAILS: Werbesperre und Kündigung
//   halten sie auf — auch beim Handversand.
// · Der Widerspruchs-Hinweis (§ 7 Abs. 3 Nr. 4 UWG: bei JEDER Verwendung)
//   steht wörtlich als WIDERSPRUCH_SATZ in der Fußnote jeder Fassung — im
//   HTML und im Text-Teil. WER die Mail bekommen darf, entscheiden Takt und
//   Tür (sperrUrteil in fiaon-mail-frequenz.ts, angebotTuerSperre in
//   fiaon-auskunft-verkauf.ts) — nie diese Vorlage.
//
// ── WAS SIE SAGEN DARF (Wortwand, shared/fiaon-wortverbote.ts) ────────────
// Nutzen, Leistung, Auskunfteien und die ehrliche Antwort zur Datenkopie aus
// shared/fiaon-auskunft.ts. Keine Garantie, keine Löschzusage, kein „Score
// verbessern", keine Frist mit Zahl, keine Karten-, Kredit- oder Limitzusage
// (die Bank entscheidet), keine erfundenen Zahlen, Studien oder Stimmen, „die
// großen Auskunfteien", nie „alle". „Limit" nur beim zahlenden Kunden (§ 34c
// GewO, VERBOTENE_WORTE der Kaltansprache). Österreich und die Schweiz lesen
// nie „SCHUFA" (auskunftWort/auskunfteienText; eine Leistungsliste aus der
// Nutzlast, die dort „SCHUFA" sagt, wird verworfen). Die kostenlose
// Datenkopie steht ehrlich in jeder Fußnote und ausführlich in Fassung b —
// nie als Hauptweg, nie verschwiegen. „Einholen" statt „anfordern": Bis die
// Schnittstelle steht, kaufen wir die Auskunft selbst ein
// (auskunft_liefermodus = 'einkauf') — der Text stimmt so für jeden Liefermodus.
//
// ── WARUM EIN BAUSTEIN AUS DER NUTZLAST ───────────────────────────────────
// Land, Segment, Fassung, Paket, Art und Betreff-Variante entscheiden über
// jeden Satz. Als Platzhalter hieße das Hunderte Varianten oder ein Satz, der
// in AT „SCHUFA" sagt. Der Motor ruft deshalb auskunftAngebotBaustein(payload).
// Platzhalter bleiben nur für die Adressen (kauf_url, upload_url, abmelde_url,
// paket_url): Fehlt der Kauflink oder der Abmeldelink, meldet der Motor das,
// statt still einen Knopf wegzulassen. Der Hochlade-Weg ist ein Zusatz: Er
// steht nur da, wenn die Nutzlast eine upload_url mitbringt und weder Lead noch
// Abbrecher liest (die haben keinen Kundenbereich, der Link endete an der
// Anmeldung). Der Paketweg nimmt `paket_url` nur, wenn die Nutzlast sie füllt —
// sonst die feste PAKET_WEG_URL, nie ein leerer Platzhalter.
// ═══════════════════════════════════════════════════════════════════════════
import type { MailBaustein } from "../geruest";
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_NUTZEN_SATZ, AUSKUNFT_NUTZEN_SATZ_KARTE, auskunftLand, auskunftLeistung, auskunftPreisCents, auskunftWort,
  auskunfteienFuer, auskunfteienText, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { anredeMail, vornameFuerBetreff } from "@shared/fiaon-anrede";

export type AngebotFassung = "a" | "b" | "c";
export const ANGEBOT_FASSUNGEN: readonly AngebotFassung[] = ["a", "b", "c"];

/**
 * Wer das Angebot liest: zahlender Kunde, fertiger Antrag ohne Zahlung, Lead
 * (E-241) — und seit E-243 der Abbrecher (Antrag begonnen, nicht fertig).
 */
export type AngebotSegment = "kunde" | "antrag" | "lead" | "abbrecher";
export const ANGEBOT_SEGMENTE: readonly AngebotSegment[] = ["kunde", "antrag", "lead", "abbrecher"];

/** Das Segment aus der Nutzlast — ohne Angabe „kunde" (so riefen Takt und Akte bis E-240). */
export function angebotSegment(roh: unknown): AngebotSegment {
  const s = String(roh ?? "").trim().toLowerCase();
  return s === "antrag" || s === "lead" || s === "abbrecher" ? s : "kunde";
}

/** Zwei Betreffzeilen je Stufe (26.09.2026, E-243). */
export type BetreffVariante = 1 | 2;
export const ANGEBOT_BETREFF_VARIANTEN: readonly BetreffVariante[] = [1, 2];

/**
 * Welche Betreffzeile: `betreff_variante` (1|2) aus der Nutzlast, sonst aus
 * der Person und der Fassung — im Wechsel über die Stufen (a-1, b-2, c-1 bzw.
 * a-2, b-1, c-2). Ohne Person die Adresse; ohne beides fest (a-1, b-2, c-1).
 */
export function angebotBetreffVariante(p: Record<string, unknown>, fassung: AngebotFassung): BetreffVariante {
  const roh = String(p.betreff_variante ?? "").trim();
  if (roh === "1" || roh === "2") return Number(roh) as BetreffVariante;
  const id = Number(p.person_id);
  let h = 0;
  if (Number.isFinite(id) && id > 0) h = Math.floor(id);
  else for (const c of String(p.email ?? "").trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ((h + ANGEBOT_FASSUNGEN.indexOf(fassung)) % 2 === 0 ? 1 : 2) as BetreffVariante;
}

/**
 * Der Hinweis nach § 7 Abs. 3 Nr. 4 UWG — wörtlich in jeder Fassung, im HTML
 * und im Text-Teil (25.09.2026, E-241). Der Prüfstand sucht genau diesen Satz.
 */
export const WIDERSPRUCH_SATZ =
  "Sie können der Verwendung Ihrer E-Mail-Adresse für Werbung jederzeit widersprechen — ein Klick genügt, "
  + "es entstehen keine anderen als die Übermittlungskosten nach den Basistarifen.";

/**
 * Das Warnzitat der Fassung b je Land und Art (26.09.2026, E-243) — IN
 * Anführungszeichen, als Zitat dessen, wovor wir warnen. Österreich und die
 * Schweiz lesen nie „SCHUFA"; die Firma liest von Finanzierung.
 */
export function angebotWarnzitat(land: AuskunftLand, art: AuskunftArt): string {
  if (art === "firma") return "„Finanzierung ohne Bonitätsprüfung“";
  return land === "AT" ? "„Kredit ohne KSV“" : land === "CH" ? "„Kredit ohne Bonitätsprüfung“" : "„Kredit ohne SCHUFA“";
}

/**
 * DIE BENANNTE AUSNAHME VON DER WORTHYGIENE (26.09.2026, E-243) — wie
 * WHATSAPP_ERLAUBT in shared/fiaon-lead-strecke.ts: „kredit" und „ohne schufa"
 * stehen in VERBOTENE_WORTE, weil FIAON nie mit Kredit werben darf (§ 34c
 * GewO). Das Warnzitat wirbt nicht, es warnt — deshalb ist es erlaubt, aber
 * NUR wörtlich und nur in Anführungszeichen. Jedes andere „Kredit" in dieser
 * Vorlage bleibt ein Treffer (Prüfstand .pruef/e243-mails-pruefen.ts).
 */
export const ANGEBOT_WARNZITATE_ERLAUBT: readonly string[] = ["„kredit ohne schufa“", "„kredit ohne ksv“", "„kredit ohne bonitätsprüfung“"];

/**
 * Der leise zweite Weg für Lead und Abbrecher (E-243): der Antrag, gekennzeichnet
 * als „kam über das Auskunft-Angebot". Absolut, wie jede Adresse in einer Mail.
 */
export const PAKET_WEG_URL = "https://www.fiaon.com/antrag?src=auskunft&auskunft=1";

/**
 * Welche Fassung als Nächstes: die nach der zuletzt geschickten. `bisher` =
 * Zahl der schon versandten auskunft_angebot an diese Person (fiaon_mail_log).
 * E-241: Nach c kommt c, nicht wieder a — c ist die letzte Erinnerung, und
 * dieselbe Nutzen-Mail ein zweites Mal wäre genau die Welle, die wir nicht wollen.
 */
export function auskunftAngebotFassung(bisher: number): AngebotFassung {
  const n = Number.isFinite(bisher) && bisher > 0 ? Math.floor(bisher) : 0;
  return ANGEBOT_FASSUNGEN[Math.min(n, ANGEBOT_FASSUNGEN.length - 1)];
}

/** Die Nutzlast dieses Ereignisses — die Parameter, die der Baustein liest. */
export interface AngebotNutzlast {
  email: string;
  person_id?: number | null;
  vorname?: string | null;
  nachname?: string | null;
  anrede?: string | null;
  /** „74 €" / „149 €" — vom Server (auskunftPreis), nie aus dem Browser. */
  preis_text: string;
  mit_abo: boolean;
  land: AuskunftLand;
  /** Satzteil „SCHUFA, CRIF und Creditreform Boniversum" — zur Anzeige im Protokoll. */
  auskunfteien: string;
  leistung: string[];
  art?: AuskunftArt;
  fassung?: AngebotFassung;
  /** E-241: kunde | antrag | lead; E-243: abbrecher. Ohne Angabe „kunde". */
  segment?: AngebotSegment;
  /** E-243: 1 | 2 — welche der zwei Betreffzeilen. Ohne Angabe aus der Person. */
  betreff_variante?: BetreffVariante;
  /**
   * E-241: Den Preis mit aktivem Paket nennen (74 € / Firma 199 €)? Ohne Angabe
   * nur im Segment „antrag". true/ein Satz schaltet ein, false/„0" aus — den
   * Wortlaut setzt die Vorlage (paketHinweis). Beim Segment „kunde" nie.
   */
  paket_preis_hinweis?: boolean | string;
  /**
   * E-243: Der zweite Weg „Lieber gleich mit FIAON-Paket?" — nur Lead und
   * Abbrecher, nur privat. Ohne Angabe an; false/„0" schaltet ihn aus.
   */
  paket_weg?: boolean | string;
  /** E-243: eigene Adresse des Paketwegs (etwa ein persönlicher Antragslink). Leer = PAKET_WEG_URL. */
  paket_url?: string;
  kauf_url: string;
  /** Leer = kein Hochlade-Weg in der Mail. Bei Lead und Abbrecher nie (kein Kundenbereich). */
  upload_url?: string;
  abmelde_url: string;
  [k: string]: unknown;
}

const sicher = (s: unknown): string => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  // Ein Name oder Satz aus der Nutzlast darf keinen Platzhalter in die Mail schmuggeln.
  .replace(/\{\{/g, "{ {");

/** Für die Betreffzeile: kein HTML-Ersatz (ein „&amp;" stünde dort wörtlich), aber auch kein Platzhalter. */
const klar = (s: unknown): string => String(s ?? "").replace(/[<>]/g, "").replace(/\{\{/g, "{ {").trim();

const gross = (s: string): string => s.replace(/^./, (c) => c.toUpperCase());

const ZAHLWORT = ["keine", "eine", "zwei", "drei", "vier", "fünf"];

const JA = ["1", "true", "ja", "an", "on", "yes"];
const NEIN = ["0", "false", "nein", "aus", "off", "no"];

function jaNein(roh: unknown): boolean {
  return roh === true || JA.includes(String(roh ?? "").trim().toLowerCase());
}

/** Ein Schalter mit Vorgabe: ohne Angabe `vorgabe`, sonst ja/nein wie jaNein — ein Satz zählt als ja. */
function schalter(roh: unknown, vorgabe: boolean): boolean {
  if (roh === undefined || roh === null) return vorgabe;
  if (typeof roh === "string") {
    const s = roh.trim().toLowerCase();
    return s === "" ? vorgabe : !NEIN.includes(s);
  }
  return jaNein(roh);
}

/**
 * Der Satz zum Preis mit aktivem Paket — oder null. `paket_preis_hinweis`
 * SCHALTET nur: ohne Angabe steht er beim fertigen Antrag, true/„1"/ein Satz
 * schaltet ihn ein, false/„0"/„nein" aus. Den Wortlaut bestimmt immer diese
 * Vorlage — ein Satz aus der Nutzlast wird nicht gedruckt: Er ginge an
 * Wortwand und Prüfstand vorbei, und „74 € statt 149 €" wäre ein Streichpreis
 * (PAngV § 11; shared/fiaon-auskunft.ts: beide Preise nebeneinander, nie „statt").
 */
function paketHinweis(roh: unknown, segment: AngebotSegment, art: AuskunftArt): string | null {
  if (segment === "kunde") return null;
  // Gegenlesen 26.09.2026 (E-243): Firma nur beim fertigen Antrag — die Business-Pakete sind eingestellt
  // (shared/fiaon-pakete.ts). Ein Firmen-Lead oder -Abbrecher (der Takt schaltet den Hinweis beim Abbrecher
  // an) läse sonst von einem Kundenpreis, zu dem es für ihn keinen Weg gibt. Der fertige Antrag hat ihn:
  // die erste Zahlung zu seinem Antrag.
  if (art === "firma" && segment !== "antrag") return null;
  if (!schalter(roh, segment === "antrag")) return null;
  const was = art === "firma" ? "die Firmen-Auskunft" : "die Auskunft";
  const preis = euroText(auskunftPreisCents(art, true));
  return segment === "antrag"
    ? `Gut zu wissen: Mit aktivem FIAON-Paket kostet ${was} ${preis} — Ihr Paket aktivieren Sie mit der ersten Zahlung zu Ihrem Antrag.`
    : `Gut zu wissen: Als FIAON-Kunde mit laufendem Paket zahlen Sie für ${was} ${preis}.`;
}

/**
 * Der zweite Weg für Lead und Abbrecher (26.09.2026, E-243) — oder null.
 * Justin: „Ziel ist, die Bonitätsauskunft zu verkaufen UND ein Abo zu
 * verkaufen — wenn nicht, auch gut, dann nur die Bonität." Der Hauptknopf
 * bleibt die Auskunft allein; der Paketweg ist die leise Zeile darunter. Der
 * Satz sagt ehrlich, dass das Paket einen eigenen Preis und eine eigene
 * Laufzeit hat (Jahresvertrag seit 03.09.) — die 74 € sind kein Lockpreis.
 * Nur privat: Die Business-Pakete sind eingestellt.
 */
function paketWeg(p: Record<string, unknown>, segment: AngebotSegment, art: AuskunftArt): { satz: string; knopf: { text: string; url: string } } | null {
  if (segment !== "lead" && segment !== "abbrecher") return null;
  if (art === "firma" || !schalter(p.paket_weg, true)) return null;
  const preis = euroText(auskunftPreisCents(art, true));
  const url = String(p.paket_url ?? "").trim() ? "{{params.paket_url}}" : PAKET_WEG_URL;
  return {
    // Gegenlesen 26.09.2026: Der Satz sagt, WIE (der Zusatz im Antrag, antrag.tsx — mit src=auskunft
    // aufgeklappt, nie vorangekreuzt) und WANN bezahlt wird (BUENDEL_FAELLIG_SATZ: nach der ersten Paketzahlung).
    satz: `Oder gleich mit FIAON-Paket für Ihren Weg zur Karte: Im Antrag bestellen Sie die Auskunft auf Wunsch zum Kundenpreis von ${preis} dazu — `
      + "fällig erst nach Ihrer ersten Paketzahlung. Das Paket hat einen eigenen Preis und eine eigene Laufzeit; beides steht im Antrag, bevor Sie etwas bezahlen.",
    knopf: { text: `Lieber gleich mit FIAON-Paket? Dann ${preis} für die Auskunft`, url },
  };
}

/**
 * Die zwei Betreffzeilen je Stufe (26.09.2026, E-243) — kurz, neugierig,
 * ehrlich. Keine Großbuchstaben-Schreie, kein Versprechen, kein „Kredit" (Spam-
 * Filter und § 34c GewO), und keine Zeile, die sich wie ein Bescheid liest:
 * „Max, abgelehnt" hätte ein offener Antrag für die Antwort auf SEINEN Antrag
 * halten können — deshalb „Schon einmal abgelehnt …" und „Wenn die Bank Nein sagt …".
 */
function betreffFuer(o: {
  fassung: AngebotFassung; variante: BetreffVariante; segment: AngebotSegment; firma: boolean; wort: string; vn: string;
}): string {
  const { fassung, variante, segment, firma, wort, vn } = o;
  if (fassung === "a") {
    if (variante === 1) return `${vn}schon einmal abgelehnt, ohne zu erfahren, warum?`;
    return firma ? `${vn}was Banken über Ihr Unternehmen sehen — und Sie vielleicht nicht` : `${vn}wenn die Bank Nein sagt: Der Grund steht oft in Ihrer ${wort}`;
  }
  if (fassung === "b") {
    if (variante === 1) return firma ? `${vn}bevor Sie für schnelle Finanzierungsversprechen bezahlen` : `${vn}bevor Sie für schnelle Versprechen bezahlen`;
    return firma ? `${vn}warum nicht einfach selbst bei den Auskunfteien anfragen?` : `${vn}Ihre Datenkopie ist kostenlos. Wofür gibt es dann uns?`;
  }
  if (variante === 1) return firma ? `${vn}wissen Sie, was Banken über Ihr Unternehmen sehen?` : `${vn}wissen Sie, was die Bank sieht, bevor sie entscheidet?`;
  if (segment === "kunde") return firma ? `${vn}in Ihrer Akte fehlt noch die Firmen-Auskunft` : `${vn}in Ihrer Akte fehlt noch ein Baustein`;
  if (segment === "antrag") return `${vn}ein kurzer Gedanke zu Ihrem Antrag`;
  if (segment === "abbrecher") return `${vn}ein kurzer Gedanke zu Ihrem begonnenen Antrag`;
  return firma ? `${vn}kurz und ohne Umwege: die Firmen-Auskunft` : `${vn}kurz und ohne Umwege: Ihre ${wort}`;
}

/**
 * Baut die Mail aus der Nutzlast. Fehlt etwas, gilt der sichere Rückfall:
 * Land Deutschland, Privatkunde, Segment „kunde", Fassung a, Preis aus `mit_abo`
 * über shared/fiaon-auskunft.ts, Leistung aus auskunftLeistung — nie ein leerer
 * Satz, nie ein sichtbarer Platzhalter.
 *
 * `opts.mitUpload` setzt den Hochlade-Weg als Platzhalter (der statische
 * Eintrag für Galerie und Vorlagen-Verzeichnis); sonst entscheidet die Nutzlast.
 */
export function auskunftAngebotBaustein(p: Record<string, unknown>, opts: { mitUpload?: boolean } = {}): MailBaustein {
  const land: AuskunftLand = auskunftLand(p.land);
  // Der Takt nennt die Art zusätzlich als `auskunft_art` (Nutzlast-Vertrag E-241) — beide gelten.
  const art: AuskunftArt = (p.art ?? p.auskunft_art) === "firma" ? "firma" : "privat";
  const firma = art === "firma";
  const segment = angebotSegment(p.segment);
  const kundeSegment = segment === "kunde";
  // Lead und Abbrecher haben keinen Kundenbereich (E-243: der Abbrecher auch nicht — sein Antrag ist nicht fertig).
  const ohneBereich = segment === "lead" || segment === "abbrecher";
  const mitAbo = jaNein(p.mit_abo);
  const fassung: AngebotFassung = ANGEBOT_FASSUNGEN.includes(p.fassung as AngebotFassung) ? (p.fassung as AngebotFassung) : "a";
  const variante = angebotBetreffVariante(p, fassung);
  const preisRoh = String(p.preis_text ?? "").trim() || euroText(auskunftPreisCents(art, mitAbo));
  const preis = sicher(preisRoh);
  const wort = auskunftWort(land);
  const bei = auskunfteienText(land);
  const anzahl = auskunfteienFuer(land).length;
  const zahl = gross(anzahl < ZAHLWORT.length ? ZAHLWORT[anzahl] : String(anzahl));
  const recht = auskunfteienFuer(land)[0]?.recht ?? "Art. 15 DSGVO";
  const mitUpload = opts.mitUpload === true || (!ohneBereich && String(p.upload_url ?? "").trim() !== "");

  // Die Leistung: aus der Nutzlast (dieselbe Quelle, vom Server gebaut) — außer
  // sie passt nicht zum Land. Ein „SCHUFA" in Österreich fliegt raus, ehe es gedruckt wird.
  // 25.09.2026 (E-241): ebenso ein „Limit" in einer Mail an Antrag, Lead oder (E-243) Abbrecher
  // (VERBOTENE_WORTE, § 34c GewO) — etwa aus einer Nutzlast, die vor der neuen Leistungsliste gebaut wurde.
  const ausNutzlast = Array.isArray(p.leistung) && p.leistung.length ? (p.leistung as unknown[]).map(String) : null;
  const leistungRoh = ausNutzlast && !(land !== "DE" && ausNutzlast.some((z) => /schufa/i.test(z)))
    && !(!kundeSegment && ausNutzlast.some((z) => /limit/i.test(z)))
    ? ausNutzlast : auskunftLeistung(art, land);
  // Punkt und geschütztes Leerzeichen als Zeichen, nicht als HTML-Entität: Der
  // Text-Teil der Mail (mailText) entfernt nur Tags — „&#8226;&nbsp;" stand dort
  // wörtlich (Gegenlesen 24.09.2026).
  const liste = `<b>Das übernehmen wir für Sie:</b>\n${leistungRoh.map((z) => `•  ${sicher(z)}`).join("\n")}`;

  const name = { vorname: p.vorname as string | null, nachname: p.nachname as string | null };
  const anrede = sicher(String(p.anrede ?? "").trim() || anredeMail(name));
  const vorname = vornameFuerBetreff(name);
  const vn = vorname ? `${klar(vorname)}, ` : "";

  // Was gekauft wird — im Akkusativ („Wir holen … ein") und im Dativ („Mit … sehen Sie").
  const was = firma ? "die Firmen-Auskunft" : `Ihre ${wort}`;
  const wasDativ = firma ? "der Firmen-Auskunft" : `Ihrer ${wort}`;
  const woher = firma
    ? `die Daten Ihres Unternehmens bei den Wirtschaftsauskunfteien und Ihre persönlichen Daten bei ${sicher(bei)}`
    : `Ihre Daten bei ${sicher(bei)}`;
  // „Ihre Karte" / „eine Karte für Ihr Unternehmen" — der Weg, nie eine Zusage (die Bank entscheidet).
  const karte = firma ? "eine Karte für Ihr Unternehmen" : "Ihre Karte";

  const kundenpreis = kundeSegment && mitAbo;
  const preisSatz = (kundenpreis
    ? `<b>${preis} einmalig</b> — Ihr Preis als FIAON-Kunde mit laufendem Paket. Kein Abo, keine Laufzeit.`
    : `<b>${preis} einmalig</b> — kein Abo, keine Laufzeit.`)
    + " Beauftragt ist erst, wenn Sie auf der nächsten Seite bestätigen.";
  const weg = paketWeg(p, segment, art);
  // Beim Paketweg sagt dessen Satz schon, was die Auskunft mit Paket kostet — kein zweites „Gut zu wissen".
  const hinweis = weg ? null : paketHinweis(p.paket_preis_hinweis, segment, art);
  const preisTeil = [preisSatz, ...(hinweis ? [hinweis] : []), ...(weg ? [weg.satz] : [])];
  // ── KEIN „LIMIT" AN ANTRÄGE, LEADS UND ABBRECHER (25.09.2026, E-241 · E-243) ──
  // „Limit" steht in VERBOTENE_WORTE der Kaltansprache (shared/fiaon-lead-strecke.ts):
  // Werbung mit einer Kreditsumme an Menschen ohne Vertrag wäre Werbung für eine
  // erlaubnispflichtige Leistung (§ 34c GewO). Der zahlende Kunde behält „Karte und Wunschlimit".
  const nutzen = `<b>${kundeSegment ? AUSKUNFT_NUTZEN_SATZ : AUSKUNFT_NUTZEN_SATZ_KARTE}</b>`;
  // Die ehrliche Antwort wörtlich aus shared/fiaon-auskunft.ts — der erste Satz („Ja, … kostenlos zu") fett.
  const kostenlosAntwort = AUSKUNFT_KOSTENLOS_ANTWORT.replace(/^([^.]*\.)\s/, "<b>$1</b> ");
  const betreff = gross(betreffFuer({ fassung, variante, segment, firma, wort, vn }));

  const zweiterKnopf = mitUpload
    ? { knopf2: { text: "Schon eine aktuelle Auskunft? Hier hochladen", url: "{{params.upload_url}}" } }
    : weg ? { knopf2: weg.knopf } : {};
  const gemeinsam: Omit<MailBaustein, "betreff" | "preheader" | "titel" | "absaetze"> = {
    marke: kundenpreis ? "Ihr Kundenpreis" : "Einmalig, ohne Abo",
    daten: [
      firma
        ? { label: "Eingeholt bei", wert: `Wirtschaftsauskunfteien, ${sicher(bei)}` }
        : { label: "Auskunfteien", wert: sicher(bei) },
      { label: kundenpreis ? "Ihr Kundenpreis" : "Ihr Preis", wert: `${preis} einmalig` },
      { label: "Laufzeit", wert: "keine — kein Abo" },
    ],
    // Der Preis steht im Knopf: Wer klickt, weiß, was es kostet — die Seite dahinter bestätigt es nur noch.
    knopf: { text: `Auskunft für ${preis} beauftragen`, url: "{{params.kauf_url}}" },
    ...zweiterKnopf,
    fussnote: `${firma ? "Ihre persönliche Datenkopie" : "Ihre Datenkopie"} steht Ihnen bei jeder Auskunftei auch kostenlos zu (${recht}) — `
      + "mit dem Auftrag übernehmen wir das Einholen, die Auswertung, den Handlungsplan und die Schreiben für Sie. "
      + (kundeSegment ? "Über Karte und Limit entscheidet am Ende immer die Bank. " : "Über eine Karte entscheidet am Ende immer die Bank. ")
      + `${WIDERSPRUCH_SATZ} Den Abmeldelink finden Sie ganz unten in dieser E-Mail.`,
    karteZiel: true,
    abmeldeUrl: "{{params.abmelde_url}}",
  };

  // ══ FASSUNG B — „VORSICHT BEI ‚KREDIT OHNE SCHUFA'" (E-243) ══════════════
  // Der Winkel: Wer schon einmal auf ein Versprechen hereingefallen ist, glaubt
  // keinem nächsten. Also kein Versprechen — sondern die Ursache und die ehrliche
  // Antwort auf „Das gibt es doch kostenlos" (AUSKUNFT_KOSTENLOS_ANTWORT, wörtlich).
  if (fassung === "b") {
    const zitat = angebotWarnzitat(land, art);
    const lage = segment === "kunde"
      ? `Die Antwort steht in ${wasDativ} — und die fehlt in Ihrer Akte bei uns noch.`
      : segment === "antrag"
        ? "Für Ihren Antrag heißt das: Sie wissen vorher, was die Bank sieht, wenn sie über Ihre Karte entscheidet."
        : segment === "abbrecher"
          ? "Für Ihren begonnenen Antrag heißt das: Sie wissen, was die Bank sieht, bevor Sie weitermachen."
          : `Für Sie heißt das: Sie wissen vorher, was die Bank sieht, wenn sie über ${karte} entscheidet.`;
    return {
      ...gemeinsam,
      marke: "Ehrlich gesagt",
      betreff,
      preheader: "Warum schnelle Versprechen selten helfen — und wo wir stattdessen ansetzen.",
      titel: `Vorsicht bei ${zitat}`,
      absaetze: [
        // Gegenlesen 26.09.2026 (E-243): ohne „manchmal schon im Voraus" — die Auskunft selbst wird vor der
        // Arbeit bezahlt; der Vorwurf fiele auf uns zurück. Die Warnung trägt auch so: „selten", „oft".
        firma
          ? `${anrede} wenn die Hausbank Nein gesagt hat, klingen Angebote für ${zitat} verlockend. Wer so etwas schon ausprobiert hat, kennt es vielleicht: Solche Versprechen lösen selten etwas und kosten oft Geld. Das eigentliche Problem bleibt, wo es war: in dem, was über Ihr Unternehmen und über Sie persönlich gespeichert ist.`
          : `${anrede} im Netz stößt man schnell auf Angebote, die ${zitat} versprechen. Wer so etwas schon ausprobiert hat, kennt es vielleicht: Solche Versprechen lösen selten etwas und kosten oft Geld. Das eigentliche Problem bleibt, wo es war: in dem, was über Sie gespeichert ist.`,
        // Gegenlesen 26.09.2026: Hier NICHT die Leistung aufzählen — die ehrliche Antwort und die Liste
        // darunter tun es schon; dreimal „erklären jeden Eintrag" liest sich wie Füllstoff.
        `<b>Wir setzen an der Ursache an: bei ${firma ? "den Einträgen Ihres Unternehmens und Ihren persönlichen" : "Ihren Einträgen"}.</b> `
          + `Was steht dort, was ist veraltet oder falsch — und was können Sie dagegen tun? ${lage}`,
        "Bleibt die naheliegende Frage, ob Sie das nicht kostenlos selbst anfordern können. Die ehrliche Antwort:",
        kostenlosAntwort,
        // Gegenlesen 25.09.2026: Nutzen VOR der Liste — deren letzter Punkt (Betreuer, Weg zur Karte) sagt fast dasselbe.
        "Selbst angefordert heißt: für jede Auskunftei den richtigen Weg finden, einzeln anfragen — und am Ende Listen voller Kürzel, Daten und Fristen selbst auswerten. "
          + "Ob ein Eintrag zu alt ist oder nicht stimmt, sieht man ihm nicht an. Genau hier beginnt unsere Arbeit.",
        nutzen,
        liste,
        ...preisTeil,
      ],
    };
  }

  // ══ FASSUNG C — „WISSEN, WAS DIE BANK SIEHT — BEVOR SIE ENTSCHEIDET" ═════
  // Kurz, persönlich, die letzte Erinnerung. Kein „letzte Chance", keine Frist,
  // kein „nur noch heute" — und auch kein Versprechen, dass nichts mehr kommt:
  // Das entscheidet der Takt, nicht der Text.
  if (fassung === "c") {
    const einstieg = segment === "kunde"
      ? `${anrede} nur eine kurze, persönliche Nachricht: In Ihrer Akte fehlt noch ${was} — und wir möchten sichergehen, dass das nicht untergegangen ist.`
      : segment === "antrag"
        ? `${anrede} nur ein kurzer Gedanke zu Ihrem Antrag, ganz ohne Druck: Bevor die Bank über ${karte} entscheidet, schaut sie in die Daten der Auskunfteien. Wer vorher weiß, was dort steht, geht vorbereitet in diesen Schritt.`
        : segment === "abbrecher"
          ? `${anrede} Sie hatten Ihren Antrag bei uns begonnen — ein kurzer Gedanke dazu, ganz ohne Druck: Bevor eine Bank über ${karte} entscheidet, schaut sie in die Daten der Auskunfteien. Mit ${wasDativ} wissen Sie vorher, was dort steht.`
          : `${anrede} nur eine kurze, persönliche Nachricht: Bevor eine Bank über ${karte} entscheidet, schaut sie in die Daten der Auskunfteien. Mit ${wasDativ} wissen Sie vorher, was dort steht.`;
    return {
      ...gemeinsam,
      marke: "Kurz und persönlich",
      betreff,
      preheader: firma
        ? "Ein Auftrag für Ihr Unternehmen und Sie — jede Zeile erklärt, mit Handlungsplan."
        : `${zahl} Auskunfteien, ein Auftrag — jede Zeile erklärt, mit Handlungsplan.`,
      titel: firma ? "Wissen, was Banken über Ihr Unternehmen sehen" : "Wissen, was die Bank sieht — bevor sie entscheidet",
      absaetze: [
        einstieg,
        `Wir holen ${woher} ein, erklären jeden Eintrag, prüfen die Fristen und legen Ihnen Ihren Handlungsplan und, wo nötig, fertige Schreiben zur Freigabe vor.`,
        nutzen,
        ...preisTeil,
        "Passt es gerade nicht, ist das völlig in Ordnung.",
      ],
    };
  }

  // ══ FASSUNG A — „ABGELEHNT — UND KEINER SAGT IHNEN, WARUM?" (E-243) ══════
  // Der Winkel: das Nein ohne Begründung. „Oft", nicht „immer" — eine Bank
  // entscheidet auch nach Einkommen und eigenen Regeln. Und „ob und was Sie
  // bremst": Steht nichts Nachteiliges dort, ist auch das eine Antwort.
  const schmerz = firma
    ? `${anrede} kennen Sie das? Die Bank lehnt die Finanzierung ab, der Leasinggeber will zusätzliche Sicherheiten, ein Lieferant liefert nur noch gegen Vorkasse — und eine Begründung bekommt Ihr Unternehmen selten.`
    : `${anrede} kennen Sie das? Die Bank sagt Nein, der Vermieter nimmt jemand anderen, der Handyvertrag geht nicht durch — und eine Begründung bekommen Sie selten.`;
  const lage = segment === "kunde"
    ? `Genau das fehlt in Ihrer Akte bei uns noch: ${was}.`
    : segment === "antrag"
      ? `Ihr Antrag liegt bei uns — und bevor die Bank über ${karte} entscheidet, schaut sie genau dort nach. ${gross(was)} zeigt es Ihnen vorher.`
      : segment === "abbrecher"
        ? `Sie hatten Ihren Antrag bei uns begonnen, aber noch nicht abgeschlossen — vielleicht, weil Sie erst wissen möchten, was die Bank über ${firma ? "Ihr Unternehmen" : "Sie"} sieht. Genau das zeigt ${was}.`
        : `Sie hatten sich bei FIAON gemeldet — und bevor eine Bank über ${karte} entscheidet, schaut sie genau dort nach. ${gross(was)} zeigt es Ihnen vorher.`;
  return {
    ...gemeinsam,
    betreff,
    preheader: "Oft steht der Grund bei den Auskunfteien — wir sehen für Sie nach, Zeile für Zeile.",
    titel: "Abgelehnt — und keiner sagt Ihnen, warum?",
    absaetze: [
      schmerz,
      `Der Grund steht oft dort, wo ${firma ? "Banken, Leasinggeber und Lieferanten" : "Banken, Vermieter und Mobilfunkanbieter"} vorher nachsehen: bei den Auskunfteien. ${lage}`,
      `Mit dem Auftrag holen wir ${woher} ein, zeigen Ihnen, ob und was ${firma ? "Ihr Unternehmen" : "Sie"} bremst, und was Sie dagegen tun können — wo nötig mit fertigen Schreiben zur Freigabe. `
        + "Steht dort nichts Nachteiliges, wissen Sie auch das: schwarz auf weiß.",
      // Gegenlesen 25.09.2026: Nutzen vor der Liste (wie Fassung b) — nicht direkt hinter ihrem letzten Punkt.
      nutzen,
      liste,
      ...preisTeil,
    ],
  };
}

/**
 * Der statische Eintrag im Vorlagen-Verzeichnis: Fassung a für Deutschland, mit
 * Platzhaltern. Er macht das Ereignis für hatVorlage, Galerie und Mailwerk
 * sichtbar; gerendert wird immer über auskunftAngebotBaustein (Motor).
 */
export const AUSKUNFT_VERKAUF_VORLAGEN: Record<string, MailBaustein> = {
  auskunft_angebot: auskunftAngebotBaustein({ land: "DE", mit_abo: true, segment: "kunde", betreff_variante: 1 }, { mitUpload: true }),
};

/**
 * Alle Betreffzeilen ohne Vornamen (26.09.2026, E-243) — jede Fassung ×
 * Segment × Art × Land × Paketstand × Betreff-Variante. Für Wege, die eine
 * Antwort auf das Angebot erkennen müssen (Postmeister) und für den Prüfstand.
 */
export function angebotsBetreffeOhneNamen(): string[] {
  const alle = new Set<string>();
  for (const fassung of ANGEBOT_FASSUNGEN) for (const segment of ANGEBOT_SEGMENTE) for (const art of ["privat", "firma"])
    for (const land of ["DE", "AT", "CH"]) for (const mit_abo of [true, false]) for (const betreff_variante of ANGEBOT_BETREFF_VARIANTEN) {
      alle.add(auskunftAngebotBaustein({ fassung, segment, art, land, mit_abo, betreff_variante, vorname: null, nachname: null }).betreff);
    }
  return Array.from(alle);
}

/**
 * Die Nutzlast aus bekannten Werten — rein, ohne Datenbank. Die Werte selbst
 * holt fiaon-auskunft-lieferung.ts (auskunftAngebotNutzlast); hier steht nur,
 * wie sie zusammengesetzt wird, damit Takt, Akte und Prüfstand dieselbe bauen.
 * E-241: `segment` (Standard „kunde"), `fassung` (sonst aus bisherGesendet),
 * `paketPreisHinweis` (sonst nur beim Antrag) und eine leere uploadUrl (dann
 * ohne Hochlade-Weg). E-243: `betreffVariante` (sonst aus der Person), und
 * `paketWeg`/`paketUrl` für den zweiten Weg bei Lead und Abbrecher.
 */
export function angebotNutzlastBauen(e: {
  email: string; personId: number; vorname?: string | null; nachname?: string | null;
  land: AuskunftLand; mitAbo: boolean; preisCents: number; art?: AuskunftArt;
  kaufUrl: string; uploadUrl?: string | null; abmeldeUrl: string; bisherGesendet?: number;
  segment?: AngebotSegment; fassung?: AngebotFassung; paketPreisHinweis?: boolean;
  betreffVariante?: BetreffVariante; paketWeg?: boolean; paketUrl?: string | null;
}): AngebotNutzlast {
  const art = e.art ?? "privat";
  return {
    email: e.email, person_id: e.personId, vorname: e.vorname ?? null, nachname: e.nachname ?? null,
    anrede: anredeMail({ vorname: e.vorname, nachname: e.nachname }),
    preis_text: euroText(e.preisCents), mit_abo: e.mitAbo, land: e.land,
    auskunfteien: auskunfteienText(e.land), leistung: auskunftLeistung(art, e.land), art,
    segment: angebotSegment(e.segment),
    fassung: e.fassung && ANGEBOT_FASSUNGEN.includes(e.fassung) ? e.fassung : auskunftAngebotFassung(e.bisherGesendet ?? 0),
    ...(e.paketPreisHinweis !== undefined ? { paket_preis_hinweis: e.paketPreisHinweis } : {}),
    ...(e.betreffVariante ? { betreff_variante: e.betreffVariante } : {}),
    ...(e.paketWeg !== undefined ? { paket_weg: e.paketWeg } : {}),
    ...(String(e.paketUrl ?? "").trim() ? { paket_url: String(e.paketUrl).trim() } : {}),
    kauf_url: e.kaufUrl, upload_url: String(e.uploadUrl ?? "").trim(), abmelde_url: e.abmeldeUrl,
  };
}
