// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUGE DES POSTMEISTERS (02.09.2026, E-094)
//
// JUSTINS AUFTRAG: „Der Agent muss eben auch HANDELN — also eine Notiz an den
// zuständigen Betreuer: ‚He, der Kunde ist unrund wegen …' oder ‚Der Kunde
// will nicht bezahlen, bitte anrufen bevor ich es eskalieren lasse'. […] Sei
// E-Mail-Agent soll also wirklich VOLL agieren können — neben Notizen machen,
// 100 % menschlich und passend schreiben, agieren, volle Funktion haben,
// stornieren, Accounts aktivieren, Links verschicken, einfach ALLES!"
//
// DIE GRENZE, die das Haus zieht: Ein Werkzeug ist entweder FREI (der Agent
// führt es sofort aus, es ist rückholbar und bewegt kein Geld) oder es braucht
// eine BESTÄTIGUNG (ein Mensch klickt in der Werkbank). Geld buchen, Raten
// erlassen, Rückerstattungen — dafür gibt es hier kein Werkzeug, in keiner
// Stufe. Wer Geld bewegt, ist ein Mensch.
//
// WARUM DAS ÜBERHAUPT GEBAUT WIRD: In der Analyse vom 02.09. versprachen
// Antworten Dinge, die niemand tat — „wir nehmen Sie aus dem Verteiler"
// (Sperre nie gesetzt), „ich habe das weitergeleitet" (nichts weitergeleitet),
// „wir stellen die Erinnerungen ein" (Mahnkette lief weiter). Ein Werkzeug,
// das wirklich ausgeführt wird, ist die einzige ehrliche Form eines
// Versprechens.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { KUENDIGUNG_WIRKSAM_SQL, AUSKUNFT_GEKUENDIGT_SQL } from "@shared/fiaon-kuendigung-regel";
import { absoluteUrl } from "../fiaon-base-url";
import {
  AUSKUNFT_LAGEN, AUSKUNFT_ANTWORT_LAGEN, KEIN_VERKAUF_FLAGS, auskunftLageErlaubt, fragtNachAuskunftSelbst, lehntAuskunftAb,
  bezogenAufAuskunftAngebot, widersprichtWerbung,
  type Flags, type Kundenlage,
} from "@shared/fiaon-postmeister-typen";
import { istGlobalPaket } from "@shared/fiaon-pakete";
import {
  auskunftLeistung, auskunftWort, auskunfteienText, euroText, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS,
  AUSWERTUNG_NAME, AUSWERTUNG_UNTERLAGEN_SATZ, AUSWERTUNG_KEINE_AUSKUNFT_SATZ, AUSWERTUNG_INKLUSIVE_SATZ,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { auskunftArtFuer } from "./fiaon-postmeister-dossier";
import { ANGEBOT_VERMERK, antwortAufAngebot, kundeFragtNachAuskunft } from "./fiaon-auskunft";
import { auskunftAngebotBaustein, ANGEBOT_FASSUNGEN, ANGEBOT_SEGMENTE, ANGEBOT_BETREFF_VARIANTEN, ANGEBOT_FRUEHERE_BETREFFE } from "../mail/vorlagen/auskunft-verkauf";
import { zeitFuerKunde, bausteinKuendigung, kuendigungRatenAufteilen, abstreitenArt, stoppWunsch, istLoeschwunsch } from "@shared/fiaon-mara-ton";
// E-275 (02.10.2026): die Sätze zum Weg der Karte — dieselben wie in der Einladung und auf WhatsApp.
import { KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
// E-265 (01.10.2026, Paket Recht): Das Vertragsende beim Altvertrag — Ende des Abrechnungsmonats (vertragsendeLesen).
import { giltZumSatz, tagDeutsch } from "@shared/fiaon-antrag-stand";
import {
  vertretungFuerPerson, anruferFuer, freiePlaetzeVertreter, bisText,
  uebergabeVertretung, uebergabeVertretungAbgeleitet, heikleUebergabe, betreiberKopie, type UebergabeVertretung,
} from "./fiaon-abwesenheit";
import { nennform } from "@shared/fiaon-mitarbeiter-name";
import { antragAbgeschickt } from "@shared/fiaon-antrag-stand";
// E-272 (02.10.2026): Global-Kunde als Merkmal der PERSON — die eine Regel (fiaon-global-kunde.ts).
import { istGlobalKunde } from "./fiaon-global-kunde";
import { produktkategorie } from "./fiaon-produktkategorie";

export type Stufe = "frei" | "bestaetigen";

export interface WerkzeugKontext {
  /** Person und Bestellung, um die es geht (kann leer sein: unbekannter Absender). */
  personId: number | null;
  ref: string | null;
  postfach: string;
  /** Zeile in fiaon_postmeister — jede Handlung wird dort protokolliert. */
  postmeisterId: number | null;
  kundenlage: Kundenlage;
  /** Wörtliches Zitat aus der Kundenmail — Pflicht bei Sperren und Kündigung. */
  zitat?: string | null;
  /** Die Lampen der Einordnung (E-240): Bei Kündigung, Beschwerde, „Stopp" usw. wird nichts verkauft. */
  flags?: Partial<Flags> | null;
  /** Was der Kunde geschrieben hat (gekürzt) — steht in der Aufgabe an den Betreuer (E-240). */
  kundeText?: string | null;
  /** Betreff seiner Mail — „Re: …" auf ein Angebot heißt: er antwortet darauf (gemeinsame Bremse, 25.09.2026). */
  betreff?: string | null;
  /** Gesetzt, sobald der Betreuer in diesem Lauf von der Auskunft erfahren hat — nie zweimal je Mail. */
  auskunftGemeldet?: boolean;
  /**
   * 25.09.2026 (E-241): Antwortet die Mail auf das Angebot der Auskunft („angebot")
   * oder fragt der Kunde selbst danach („frage")? Nur dann verkauft Mara sie auch
   * einem offenen Antrag oder einem Lead (AUSKUNFT_ANTWORT_LAGEN). Rechnet der Lauf
   * (auskunftAntwortArt), nie das Modell.
   */
  auskunftAntwort?: AuskunftAntwort;
  /**
   * 28.09.2026 (E-248): Vertrag nach der Fassung vor dem 03.09.2026 (agb_stand leer
   * oder älter) — laut Hauswissen „monatlich kündbar, formlos". Dann genügt jede
   * klare Aussage („bitte alles stornieren"), kein fester Wortlaut (#5625).
   */
  formlosKuendbar?: boolean;
  /**
   * 28.09.2026 (E-248): Diese Antwort ist KEINE Zahlungsaufforderung (Stopp,
   * Widerruf, Beschwerde, bestrittene Forderung, Anwalt, „kann nicht zahlen",
   * offener Einwand aus einer früheren Mail). Der Grund steht hier; die
   * Zahlungsseite gibt es dann nicht, die Rechnung nur auf ausdrücklichen Wunsch.
   * Rechnet der Server (zahlungsRuhe), nie das Modell.
   */
  ruhe?: string | null;
  /**
   * E-396 Teil 2 (19.10.2026): Der Absender der Mail („Name <adresse>“). Ein kurzes „Ja“ auf unsere Kündigungs-Rückfrage
   * bucht nur, wenn es von einer Adresse kommt, die bei ihm gespeichert ist (absenderGehoertZurPerson).
   */
  absender?: string | null;
  /**
   * E-396 Teil 2 × E-401: Gmails Absender-Prüfung (oberstes „Authentication-Results“) und Reply-To. Liegt sie vor, zählt
   * das „Ja“ nur, wenn sie die Adresse bestätigt (absenderEcht, dieselbe Prüfung wie angaben_aendern).
   */
  absenderPruefung?: { authErgebnis: string | null; antwortAn: string | null } | null;
  /**
   * E-499 (Mara 2.0): Der ZITIERTE Teil seiner Mail (unser Text unter seiner Antwort) — nie seine Worte. Dient nur dazu,
   * unsere eigene Kündigungs-Rückfrage wiederzuerkennen: Sendet ein Mensch Maras Entwurf direkt aus Gmail, steht in der
   * Tabelle kein Versand, im Zitat des Kunden aber unsere Frage.
   */
  zitiert?: string | null;
  /** E-499: Wir haben ihn schon einmal gefragt, ob er kündigen möchte — eine zweite Rückfrage gibt es nie (setzt der Lauf). */
  kuendigungFrageSchon?: boolean;
  /** E-499: Was er in SEINEN Worten zum Austritt erklärt (austrittsWille) — „bedingt“ heißt: Kündigung nicht ansprechen. */
  austritt?: "klar" | "frage" | "bedingt" | "nichts";
  /**
   * E-499: Er widerruft eine UNBEZAHLTE Bestellung, und „rechtlich“ brennt nur wegen dieses Widerrufs (kein Anwalt, keine
   * Behörde, kein Bestreiten, kein Löschwunsch). Dann ist es ein Storno, das Mara selbst bucht und bestätigt (E-369/E-372).
   */
  widerrufNurStorno?: boolean;
}

/**
 * Der künftige, gebuchte Termin eines Menschen (E-248) — für Rückruf und Terminlink
 * per Mail. Dieselbe Regel wie auf WhatsApp (kuenftigerTermin): Status „gebucht",
 * Beginn nicht länger als 20 Minuten vorbei. Die Zeit so, wie der Kunde sie liest.
 */
export async function bestehenderTermin(personId: number): Promise<{ id: number; beginn: string; vorname: string | null; kundenText: string } | null> {
  // E-265 (29.09.2026): `vorname` trägt die NENNFORM („Herr Stripling") — der Kunde liest sie so.
  const [t] = (await sqlPool`
    SELECT t.id, t.agent_id, t.beginn, t.quelle, a.name, a.first_name, a.last_name, a.anrede
      FROM fiaon_termine t LEFT JOIN fiaon_agents a ON a.id = t.agent_id
     WHERE t.person_id = ${personId} AND t.status = 'gebucht' AND t.beginn > NOW() - INTERVAL '20 minutes'
     ORDER BY t.beginn LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  const b = new Date(t.beginn);
  // E-260: Liegt der Termin bei einem Abwesenden, nennt Mara den, der wirklich anruft (B2).
  // Vertretung (01.10.2026): Gründer- und Global-Gespräche nie (Quelle mit).
  const vorname = t.name || t.first_name ? await anruferFuer(Number(t.agent_id), b, nennform(t).nom, undefined, t.quelle) : null;
  return { id: Number(t.id), beginn: b.toISOString(), vorname, kundenText: zeitFuerKunde(b) };
}

/** „YYYY-MM-DD HH:MM" als Berliner Zeit lesen — ohne Number(format()) (Zeit-Falle). Null, wenn unlesbar. */
export function berlinZeitLesen(roh: string): Date | null {
  const m = String(roh || "").trim().replace("T", " ").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [j, mo, t, h, mi] = m.slice(1).map(Number);
  const utc = Date.UTC(j, mo - 1, t, h, mi);
  // Versatz Berlins zu diesem Zeitpunkt über formatToParts (Sommer- und Winterzeit).
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(utc));
  const w = (n: string) => Number(teile.find((x) => x.type === n)?.value ?? "0");
  const alsBerlin = Date.UTC(w("year"), w("month") - 1, w("day"), w("hour") % 24, w("minute"));
  const d = new Date(utc - (alsBerlin - utc));
  return Number.isFinite(d.getTime()) ? d : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// E-531 (25.11.2026): KEINE ZEIT-ZUSAGEN
// Audit 26.10.–24.11.: Viele automatisch gesendete Mails versprachen „X meldet sich heute“ — gehalten wurde das fast nie
// (Zahlen im Register E-531). Der Satz kam meist aus dem Ergebnis von aufgabe_an_betreuer. maraZeitZusage findet solche
// Sätze; der Lauf sendet eine Antwort mit Treffer nie automatisch (Entwurf + Karte). Frei bleibt eine Zeit, die als echter
// Kalendertermin feststeht (`kalender`, z. B. „morgen um 10 Uhr“ aus dem gebuchten Rückruf).
//
// NACHBESSERUNG (Gutachten Kundensicherheit, 25.11.2026): Die Wand hatte Lücken — „wird Sie heute anrufen“, „setzt sich
// heute … in Verbindung“, „Sie erhalten heute noch eine Nachricht“, „gebeten, sich heute zu melden“, „in den nächsten Tagen“,
// „spätestens Montag“, „innerhalb von 24 Stunden“, englisch „We'll get back to you today“, türkisch „yarın … arayacak“ — und
// „Herr X ruft Sie an“ ohne Termin war frei. Dafür hielt sie Entschuldigungen an („Der Rückruf heute hat leider nicht
// geklappt“), Bedingungen („umgehend, sobald Ihre Zahlung eingegangen ist“) und Bitten an ihn („Rufen Sie uns gern heute an“).
//
// NACHBESSERUNG 2 (Abnahme-Gegenprüfung, 25.11.2026): Weiter frei waren Futur („Wir werden uns zeitnah melden“), Umstellung
// („Gern rufen wir Sie heute zurück“, „Wir kommen morgen auf Sie zu“, „Wir geben Ihnen bis Freitag Bescheid“), Nebensätze
// („…, damit sich jemand zeitnah meldet“), Datum, Uhrzeit, Spannen („1–2 Werktage“), „bald“, „so schnell wie möglich“,
// englisch „We will be in touch shortly“, türkisch „en kısa sürede“ und andere Sprachen. Dafür hielt sie Antworten auf dem
// Terminlink-Weg an („Sie hatten heute um einen Rückruf gebeten – wählen Sie hier eine Zeit“). Und der Kalender deckte zu
// viel: dieselbe Uhrzeit an einem anderen Tag, das Wort „Termin“ allein, einen ganzen Satz samt zweiter Zusage. Prüfstand:
// scripts/pruef-mara-zeitzusage-e531.ts.
//
// NACHBESSERUNG 3 (Abnahme-Prüfung, 25.11.2026): Die Ausnahme „sein Wunsch“ gab UNSERE Zusagen frei, in denen „Sie“ nicht
// der Wünschende ist („Sie werden morgen wie gewünscht zurückgerufen.“, „Wir haben für Sie morgen einen Rückruf
// eingetragen.“) — jetzt eine feste Liste plus Sperre. Der Kalender deckte „wie vereinbart“ bei fremden Stellen, „dann“ nach
// einem Satz mit nur dem Tageswort, eine falsche Tageszeit und eine zweite Zusage ohne Zeit im selben Satz. Falsche
// Treffer: Beträge („bis 10.000 €“), „bis bald“, englisch „by e-mail“, „…, melden Sie sich bitte heute“, „… nicht auf Sie
// zu“. Restlücken: „Ich rufe Sie morgen an“, „Eine Rückmeldung erhalten Sie morgen“, „Die Antwort folgt morgen“, „Morgen
// hören Sie von uns“, „Morgen werden Sie angerufen“; Eile unter einer Bedingung nur ohne weitere Zeit im Satz.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Satz statt jeder Zeit-Zusage (E-531) — dieselben Worte im Werkzeug und in der Fall-Akte. */
export const E531_UEBERGABE_SATZ = "Ihr Anliegen liegt jetzt bei unserem Team; Sie erhalten dazu eine schriftliche Nachricht.";

const ZZ_WOCHENTAG = String.raw`(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)`;
const ZZ_MONAT = String.raw`(?:Januar|Februar|M(?:ä|ae)rz|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)`;
const ZZ_ZAHL = String.raw`(?:\d{1,3}|eine[rm]?|zwei|drei|vier|f(?:ü|ue)nf|sechs|sieben|zehn|vierundzwanzig|achtundvierzig)`;
/** E-531 Nachbesserung 2: Eine Spanne („2–3“, „1 bis 2“) zählt wie eine Zahl. */
const ZZ_SPANNE = String.raw`${ZZ_ZAHL}(?:\s*(?:[-–—]|bis)\s*${ZZ_ZAHL})?`;
const ZZ_ZEIT = String.raw`(?:noch\s+)?(?:` + [
  String.raw`heute|morgen|(?:ü|ue)bermorgen|gleich|sofort|umgehend|zeitnah|in\s+K(?:ü|ue)rze|kurzfristig|schnellstm(?:ö|oe)glich|schnellstens|baldm(?:ö|oe)glichst`,
  String.raw`im\s+Laufe\s+(?:des\s+(?:Tages|Vormittags|Nachmittags)|der\s+(?:Woche|n(?:ä|ae)chsten\s+(?:Tage|Stunden)))`,
  String.raw`bis\s+(?:heute\s+)?(?:Abend|Mittag|morgen)`,
  String.raw`(?:am|bis|ab)\s+${ZZ_WOCHENTAG}`,
  String.raw`sp(?:ä|ae)testens(?:\s+(?:am|bis|zum|um|in|nach|Anfang|Mitte|Ende))?\s+[A-Za-zÄÖÜäöüß0-9]+`,
  String.raw`in\s+den\s+(?:n(?:ä|ae)chsten|kommenden)\s+(?:${ZZ_SPANNE}\s+)?(?:Tagen|Stunden|Minuten|Werktagen|Wochen)`,
  String.raw`in\s+wenigen\s+(?:Tagen|Stunden|Minuten)`,
  String.raw`(?:innerhalb|binnen)\s+(?:von\s+|der\s+n(?:ä|ae)chsten\s+)?${ZZ_SPANNE}\s*(?:Stunden|Std|Tag(?:en|e)?|Werktag(?:en|e)?|Minuten|h|Wochen?)`,
  String.raw`(?:diese|n(?:ä|ae)chste|kommende)\s+Woche`,
  String.raw`(?:Anfang|Mitte|Ende)\s+(?:der|dieser|n(?:ä|ae)chster|kommender)\s+Woche`,
  String.raw`nach\s+dem\s+Wochenende|am\s+Wochenende`,
  // E-531 Nachbesserung 2 (Abnahme-Gegenprüfung): Spanne ohne „innerhalb“, vage Eile, Datum, Uhrzeit, Wochentag,
  // Monat, Feiertage. „30.11.“ steht im Suchtext als „30:11.“ (Ziffer-Punkt-Ziffer wird „:“), darum [.:].
  // E-531 Nachbesserung 3: nie „bis bald“ (Gruß); nach der zweiten Zahl keine Ziffer — „bis 10.000 €“, „ab 2.500 €“ sind Beträge.
  String.raw`in\s+${ZZ_SPANNE}\s+(?:Tag(?:en)?|Werktag(?:en)?|Stunden?|Minuten?|Wochen?)`,
  String.raw`so\s+(?:schnell|bald|rasch|z(?:ü|ue)gig)\s+(?:wie\s+m(?:ö|oe)glich|es\s+geht)|m(?:ö|oe)glichst\s+(?:schnell|rasch)|(?<!\bbis\s{1,3})bald|demn(?:ä|ae)chst|z(?:ü|ue)gig|rasch`,
  String.raw`(?:am|bis|ab|zum|bis\s+zum|vor\s+dem)\s+\d{1,2}[.:]\s?\d{1,2}(?!\d)(?:[.:]\d{2,4}(?!\d)|[.:](?!\d))?`,
  String.raw`(?:am|bis|ab|zum|bis\s+zum|vor\s+dem)\s+\d{1,2}\.\s?${ZZ_MONAT}`,
  String.raw`(?:um|gegen|ab|bis)\s+\d{1,2}(?::\d{2})?\s*Uhr|(?:um|gegen)\s+\d{1,2}:\d{2}(?!\d)|\d{1,2}(?::\d{2})?\s*Uhr`,
  String.raw`zwischen\s+\d{1,2}(?::\d{2})?(?:\s*Uhr)?\s+und\s+\d{1,2}(?::\d{2})?\s*Uhr`,
  String.raw`(?:n(?:ä|ae)chsten|kommenden|diesen)\s+${ZZ_WOCHENTAG}|${ZZ_WOCHENTAG}(?:s|morgen|vormittag|mittag|nachmittag|abend)?`,
  String.raw`(?:Anfang|Mitte|Ende)\s+(?:des\s+Monats|n(?:ä|ae)chsten\s+Monats|${ZZ_MONAT})|(?:im|ab)\s+${ZZ_MONAT}|(?:n(?:ä|ae)chsten|kommenden|diesen)\s+Monat`,
  String.raw`(?:nach|vor)\s+(?:den\s+Feiertagen|Weihnachten|Neujahr|Silvester|Ostern|dem\s+Jahreswechsel)|zwischen\s+den\s+Jahren|Jahresende`,
].join("|") + ")";
/** Die Zeit als ganzes Wort — \b greift ohne Unicode-Flag vor „ü“ nie (übermorgen), darum Lookarounds. */
const ZZ_T = String.raw`(?<![A-Za-zÄÖÜäöüß])${ZZ_ZEIT}(?![A-Za-zÄÖÜäöüß])`;
const ZZ_WER = String.raw`(?:(?:die|unsere|Ihre)\s+)?(?:Leitung|Gesch(?:ä|ae)ftsf(?:ü|ue)hrung|Gesch(?:ä|ae)ftsleitung|Gesch(?:ä|ae)ftsf(?:ü|ue)hrer(?:in)?|Buchhaltung|Zahlungsstelle|Ihr(?:e)?\s+(?:pers(?:ö|oe)nliche[rn]?\s+)?(?:Betreuer(?:in)?|Ansprechpartner(?:in)?|Ansprechperson|Berater(?:in)?)|jemand(?:\s+aus\s+unserem\s+Team)?|ein(?:e)?\s+(?:Kollege|Kollegin|Mitarbeiter(?:in)?)|unser\s+Team|das\s+Team)`;
const ZZ_NAME = String.raw`(?:Herr|Frau)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)?`;
/** „Rufen Sie uns/mich (gern) an“ — ER ruft uns an, keine Zusage von uns. */
const ZZ_ER_RUFT = String.raw`\s+(?:(?:gern(?:e)?|bitte|einfach|jederzeit|doch|kurz|direkt)\s+)*(?:uns|mich|bei\s+uns|unser\w*)\b`;
/** „ruft Sie“, „ruft er Sie“ (E-531 Nachbesserung 2), „rufen Sie“, „(ich) rufe Sie“ (Nachbesserung 3) — „rufen Sie uns an“ fällt über ZZ_ER_RUFT heraus. */
const ZZ_RUFT_SIE = String.raw`\b(?:ruft\s+(?:(?:er|sie)\s+)?|rufen\s+|rufe\s+(?:ich\s+)?)(?:Sie|Ihnen)\b`;
/** „meldet sich“, „meldet er sich“ (E-531 Nachbesserung 2) — nie „melden Sie sich“ (Bitte an ihn). */
const ZZ_MELDET_SICH = String.raw`\b(?:meldet\s+(?:(?:er|sie)\s+)?sich|melden\s+sich)\b`;
const ZZ_KONTAKT = String.raw`(?:anrufen|zur(?:ü|ue)ckrufen|kontaktieren|schreiben|informieren|benachrichtigen|antworten|Bescheid\s+geben)`;
// E-531 Nachbesserung 2: „eine E-Mail von unserer Buchhaltung“ — nie die nackte „E-Mail“, sonst hielte die Wand den
// erlaubten Satz „Die schriftliche Bestätigung bekommen Sie gleich per E-Mail.“ (Kündigung, Werkzeug-Beleg) an.
const ZZ_BESCHEID = String.raw`(?:Nachricht|Antwort|R(?:ü|ue)ckmeldung|Bescheid|Anruf|R(?:ü|ue)ckruf|E-?Mail\s+(?:von|aus)\s+(?:uns|unser\w*|Herrn|Frau|der\s+\w+|dem\s+\w+|Ihre[mr]\s+\w+))`;
/** E-531 Nachbesserung 3: UNSERE Nachricht für „… folgt/kommt + Zeit“ — nie SEINE („Ihre Rückmeldung“, „eine Antwort von Ihnen“). */
const ZZ_UNSERE_NACHRICHT = String.raw`(?<!\bIhre[mnrs]?\s+)\b${ZZ_BESCHEID}\b(?!\s+von\s+Ihnen\b)`;
const ZZ_FOLGT = String.raw`\b(?:folgt|folgen|kommt|kommen|erfolgt|erfolgen)\b`;
const ZZ_EN_ZEIT = String.raw`(?:today|tomorrow|tonight|shortly|soon|later\s+today|right\s+away|asap|promptly|as\s+soon\s+as\s+possible|this\s+(?:week|morning|afternoon|evening)|next\s+week|within\s+(?:the\s+next\s+)?(?:\d+(?:\s*[-–]\s*\d+)?|a\s+few|few|a\s+couple\s+of)\s*(?:hours?|days?|business\s+days?|working\s+days?|h)|in\s+\d+(?:\s*[-–]\s*\d+)?\s*(?:hours?|days?|business\s+days?|working\s+days?)|in\s+the\s+next\s+(?:few\s+)?(?:hours?|days?)|(?:on|by|next|this)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|by\s+(?:tomorrow|tonight|(?:the\s+)?end\s+of\s+(?:the\s+)?(?:day|week))|at\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m|p\.?m|o['’]clock))`;
// E-531 Nachbesserung 2: andere Sprachen (Polnisch, Tschechisch/Slowakisch, Rumänisch, Russisch/Bulgarisch, Serbisch/Bosnisch/
// Kroatisch, Spanisch, Portugiesisch, Italienisch, Französisch). Eine Zeit UND eine Zusage im Futur im selben Satz; nur
// Futurformen („zadzwonimy“, „позвоним“, „llamaremos“), nie die Bitte an ihn („zadzwonić“, „позвоните“, „llámenos“).
const ZZ_FREMD_ZEIT = [
  String.raw`dzisiaj|dziś|jutro|pojutrze|wkrótce|niezwłocznie|jak\s+najszybciej|w\s+ciągu\s+\d+`,
  String.raw`dnes|zajtra|zítra|čoskoro|brzy|čo\s+najskôr|co\s+nejdříve|co\s+nejdřív`,
  String.raw`astăzi|azi|mâine|poimâine|în\s+curând|cât\s+mai\s+(?:curând|repede|rapid)|în\s+cel\s+mai\s+scurt\s+timp`,
  String.raw`сегодня|завтра|послезавтра|скоро|в\s+ближайшее\s+время|в\s+течение|днес|утре|възможно\s+най-скоро|данас|сутра|ускоро`,
  String.raw`danas|sutra|uskoro|što\s+prije|što\s+je\s+prije\s+moguće|u\s+najkraćem\s+roku`,
  String.raw`hoy|mañana|en\s+breve|pronto|lo\s+antes\s+posible|cuanto\s+antes|dentro\s+de\s+\d+`,
  String.raw`hoje|amanhã|em\s+breve|brevemente|o\s+mais\s+(?:rápido|breve|cedo)\s+possível`,
  String.raw`oggi|domani|dopodomani|a\s+breve|presto|al\s+più\s+presto|il\s+prima\s+possibile|entro\s+\d+`,
  String.raw`aujourd['’]hui|demain|après-demain|sous\s+peu|bientôt|dès\s+que\s+possible|dans\s+les\s+plus\s+brefs\s+délais|rapidement|d['’]ici\s+\d+`,
].join("|");
const ZZ_FREMD_ZUSAGE = [
  String.raw`skontaktuj(?:e|emy)|zadzwoni(?:my)?|oddzwoni(?:my)?|odezw(?:ie|iemy)|odpowie(?:my)?|odpiszemy|napiszemy`,
  String.raw`ozveme|ozve|zavoláme|zavolá|kontaktujeme|kontaktuje|odpovieme|odpovíme|odpovie|napíšeme`,
  String.raw`(?:va|vom|vor)\s+(?:contacta|suna|reveni|răspunde|scrie)|veți\s+primi`,
  String.raw`свяжется|свяжемся|позвонит|позвоним|перезвонит|перезвоним|ответит|ответим|напишет|напишем|сообщим|сообщит|получите`,
  String.raw`ще\s+(?:(?:ви|се)\s+){0,2}(?:свържем|свърже|обадим|обади|отговорим|отговори|пишем|пише)`,
  String.raw`javit\s*(?:ćemo|će)|javićemo|(?:ćemo|će)\s+(?:(?:vam|vas|se)\s+){0,2}(?:javiti|nazvati|kontaktirati|pozvati|odgovoriti)|nazvat\s*(?:ćemo|će)|kontaktirat\s*(?:ćemo|će)|pozvat\s*(?:ćemo|će)`,
  String.raw`llamar(?:á|emos|é)|contactar(?:á|emos|é)|pondr(?:á|emos|é)\s+en\s+contacto|responder(?:á|emos|é)|escribir(?:á|emos|é)|recibirá`,
  String.raw`ligar(?:á|emos|ei)|contactar(?:á|emos|ei)|contatar(?:á|emos|ei)|entrar(?:á|emos|ei)\s+em\s+conta(?:c)?to|responder(?:á|emos|ei)|receberá`,
  String.raw`contatter(?:à|emo|ò)|chiamer(?:à|emo|ò)|richiamer(?:à|emo|ò)|risponder(?:à|emo|ò)|scriver(?:à|emo|ò)|far(?:emo|ò|à)\s+sapere|riceverà`,
  String.raw`contacter(?:a|ons|ai)|rappeller(?:a|ons|ai)|rappeler(?:a|ons|ai)|reviendr(?:a|ons|ai)|répondr(?:a|ons|ai)|écrir(?:a|ons|ai)|recevrez`,
].join("|");

interface ZzMuster {
  art: string; re: RegExp;
  /** Ohne Zeitangabe („Herr X ruft Sie an“) — zählt nicht beim Nachprüfen des Satz-Rests (E-531 Nachbesserung 2). */
  ohneZeit?: boolean;
  /** Kann SEINEN Wunsch oder SEINE Buchung beschreiben („Sie hatten heute um einen Rückruf gebeten“) — dann keine Zusage. */
  seinWunsch?: boolean;
  /** Steht DAS in der Fundstelle, ist sie verneint und keine Zusage („… nicht auf Sie zu“) — E-531 Nachbesserung 3. */
  verneint?: RegExp;
}
/** „Weitere Kosten kommen bis zum 31.12. nicht auf Sie zu.“, „… kommen keine Kosten mehr auf Sie zu.“ — nur direkt davor. */
const ZZ_VERNEINT_AUF_SIE = /\bnichts?\s+(?:mehr\s+)?auf\s+Sie\s+(?:zu|zur(?:ü|ue)ck)(?:kommen)?\b|\bkein(?:e[mnrs]?)?\s+(?:weiteren?\s+|zus(?:ä|ae)tzlichen?\s+|neuen?\s+)?[A-Za-zÄÖÜäöüß]+\s+(?:mehr\s+)?auf\s+Sie\s+(?:zu|zur(?:ü|ue)ck)(?:kommen)?\b/i;
const ZZ_MUSTER: ZzMuster[] = [
  // E-531 Nachbesserung 2 (Abnahme-Gegenprüfung): Futur, Umstellung, Nebensatz, Englisch ohne „you“.
  { art: "werden uns + Zeit + melden", re: new RegExp(String.raw`\b(?:werden|werde|wird)\s+(?:wir\s+|ich\s+)?(?:uns|mich|sich)\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\b(?:melden|zur(?:ü|ue)ckmelden)\b|${ZZ_T}[^.!?\n]{0,40}?\b(?:werden|werde|wird)\s+(?:wir\s+|ich\s+)?(?:uns|mich|sich)\b[^.!?\n]{0,40}?\bmelden\b`, "gi") },
  { art: "rufen wir Sie + Zeit", re: new RegExp(String.raw`\b(?:ruf(?:e|en)|kontaktier(?:e|en)|informier(?:e|en)|benachrichtig(?:e|en)|antwort(?:e|en))\s+(?:wir|ich)\s+(?:Sie|Ihnen)\b[^.!?\n]{0,50}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,40}?\b(?:ruf(?:e|en)|kontaktier(?:e|en)|informier(?:e|en)|benachrichtig(?:e|en)|antwort(?:e|en))\s+(?:wir|ich)\s+(?:Sie|Ihnen)\b`, "gi") },
  { art: "wir informieren Sie + Zeit", re: new RegExp(String.raw`\b(?:wir|ich)\s+(?:informier|benachrichtig|antwort|kontaktier)(?:e|en)\s+(?:Sie|Ihnen)\b[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  { art: "kommen auf Sie zurück + Zeit", re: new RegExp(String.raw`\bkomm(?:e|en|t)\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\bauf\s+Sie\s+(?:zur(?:ü|ue)ck|zu)\b|\bkomm(?:e|en|t)\s+(?:wir\s+|ich\s+)?auf\s+Sie\s+(?:zur(?:ü|ue)ck|zu)\b[^.!?\n]{0,40}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,40}?\bkomm(?:e|en|t)\b[^.!?\n]{0,40}?\bauf\s+Sie\s+(?:zur(?:ü|ue)ck|zu)\b|\b(?:werden|werde|wird)\b[^.!?\n]{0,40}?${ZZ_T}[^.!?\n]{0,40}?\bauf\s+Sie\s+(?:zur(?:ü|ue)ckkommen|zukommen)\b`, "gi"), verneint: ZZ_VERNEINT_AUF_SIE },
  { art: "geben Ihnen Bescheid + Zeit", re: new RegExp(String.raw`\b(?:geb(?:e|en)|gibt)\s+(?:wir\s+|ich\s+)?Ihnen\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,30}?\bBescheid\b|\b(?:geb(?:e|en)|gibt)\s+(?:wir\s+|ich\s+)?Ihnen\b[^.!?\n]{0,30}?\bBescheid\b[^.!?\n]{0,40}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,40}?\b(?:geb(?:e|en)|gibt)\s+(?:wir\s+|ich\s+)?Ihnen\b[^.!?\n]{0,30}?\bBescheid\b`, "gi") },
  // E-531 Nachbesserung 3: nie „…, melden Sie sich bitte heute“ — das Verb mit „Sie“ dahinter ist die Bitte an ihn.
  { art: "dass sich X + Zeit + meldet", re: new RegExp(String.raw`\b(?:dass|damit)\s+(?:sich\s+)?(?:wir|ich|jemand|unser\w*|Ihr(?:e)?\s+\S+|die\s+\S+|der\s+\S+|Herr\s+\S+|Frau\s+\S+)\b[^.!?\n]{0,60}?${ZZ_T}[^.!?\n]{0,40}?\b(?:meldet|melden|anruft|anrufen|zur(?:ü|ue)ckruft|zur(?:ü|ue)ckrufen|kontaktiert|kontaktieren)\b(?!\s+Sie\b)`, "gi") },
  { art: "englisch: we will be in touch shortly", re: new RegExp(String.raw`(?:\bwill|'ll|’ll|\bshall)\s+(?:be\s+in\s+touch|reach\s+out|follow\s+up|get\s+back\s+to\s+you|respond|reply)\b[^.!?\n]{0,40}?\b${ZZ_EN_ZEIT}\b`, "gi") },
  // E-531 Nachbesserung 3: „e-mail“ nur mit Absender („from us/our team“) — wie im Deutschen ZZ_BESCHEID. „You will receive the
  // written confirmation by e-mail shortly.“ ist das englische Gegenstück zum erlaubten Kündigungs-Satz.
  { art: "englisch: you will receive a response within", re: new RegExp(String.raw`\byou(?:'ll|’ll|\s+will|\s+shall)\s+(?:receive|get|hear)\b[^.!?\n]{0,40}?\b(?:response|reply|answer|call|e-?mail\s+from\s+(?:us|me|our\s+\w+|your\s+\w+|the\s+\w+|Mr|Ms|Mrs)|update|message|feedback)\b[^.!?\n]{0,40}?\b${ZZ_EN_ZEIT}\b`, "gi") },
  { art: "meldet sich + Zeit", re: new RegExp(String.raw`${ZZ_MELDET_SICH}[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  { art: "Zeit + meldet sich", re: new RegExp(String.raw`${ZZ_T}[^.!?\n]{0,40}?${ZZ_MELDET_SICH}`, "gi") },
  { art: "wird sich + Zeit + melden", re: new RegExp(String.raw`\bwird\s+sich\b[^.!?\n]{0,40}?${ZZ_T}[^.!?\n]{0,30}?\bmelden\b`, "gi") },
  { art: "melden uns + Zeit", re: new RegExp(String.raw`\bmelden\s+(?:wir\s+)?uns\b[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  { art: "Zeit + melden wir uns", re: new RegExp(String.raw`${ZZ_T}[^.!?\n]{0,30}?\bmelden\s+wir\s+uns\b|${ZZ_T}[^.!?\n]{0,40}?\b(?:und|dann)\s+melden\s+(?:wir\s+)?uns\b`, "gi") },
  { art: "melde mich + Zeit", re: new RegExp(String.raw`\bmelde\s+(?:ich\s+)?mich\b[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  // E-531 Nachbesserung 3: auch „Morgen hören Sie von uns.“ und „Von uns hören Sie morgen.“
  { art: "hören + Zeit + von uns", re: new RegExp(String.raw`\bh(?:ö|oe)ren\b[^.!?\n]{0,30}?${ZZ_T}[^.!?\n]{0,30}?\bvon\s+uns\b|${ZZ_T}[^.!?\n]{0,30}?\bvon\s+uns\s+h(?:ö|oe)ren\b|${ZZ_T}[^.!?\n]{0,30}?\bh(?:ö|oe)ren\s+Sie\b[^.!?\n]{0,30}?\bvon\s+(?:uns|mir|unsere[mr]|Ihre[mr]|Herrn|Frau)\b|\bvon\s+uns\b[^.!?\n]{0,30}?\bh(?:ö|oe)ren\s+Sie\b[^.!?\n]{0,30}?${ZZ_T}`, "gi") },
  { art: "ruft Sie + Zeit + an", re: new RegExp(String.raw`${ZZ_RUFT_SIE}(?!${ZZ_ER_RUFT})[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\b(?:an|zurück|zurueck)\b`, "gi") },
  { art: "Zeit + ruft Sie an", re: new RegExp(String.raw`${ZZ_T}[^.!?\n]{0,50}?\bruf(?:e|t|en)\b(?!\s+(?:Sie|Ihnen)${ZZ_ER_RUFT})[^.!?\n]{0,40}?\b(?:Sie|Ihnen)\b[^.!?\n]{0,30}?\b(?:an|zurück|zurueck)\b`, "gi") },
  // Rückruf = unser Anruf (nicht sein „Rückrufwunsch“); „Anruf“ nur, wenn er von uns kommt — „Danke für Ihren Anruf heute“ ist keine Zusage.
  { art: "Rückruf + Zeit", re: new RegExp(String.raw`\b(?:Rückruf|Rueckruf)(?!wunsch|bitte)\w*\b[^.!?\n]{0,40}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,40}?\b(?:Rückruf|Rueckruf)(?!wunsch|bitte)`, "gi"), seinWunsch: true },
  { art: "Anruf von uns + Zeit", re: new RegExp(String.raw`${ZZ_T}[^.!?\n]{0,40}?\bAnruf\s+(?:von|durch)\s+(?:Herrn|Frau|uns|unserem|unserer|Ihrem|Ihrer)\b|\bAnruf\s+(?:von|durch)\s+(?:Herrn|Frau|uns|unserem|unserer|Ihrem|Ihrer)\b[^.!?\n]{0,60}?${ZZ_T}`, "gi"), seinWunsch: true },
  // E-531 Nachbesserung 3: auch umgestellt — „Morgen werden Sie (wie gewünscht) angerufen.“
  { art: "werden + Zeit + angerufen", re: new RegExp(String.raw`\bwerden\b[^.!?\n]{0,30}?${ZZ_T}[^.!?\n]{0,30}?\b(?:angerufen|zurückgerufen|zurueckgerufen|kontaktiert)\b|${ZZ_T}[^.!?\n]{0,30}?\b(?:angerufen|zurückgerufen|zurueckgerufen|kontaktiert)\s+werden\b|${ZZ_T}[^.!?\n]{0,30}?\bwerden\s+Sie\b[^.!?\n]{0,40}?\b(?:angerufen|zurückgerufen|zurueckgerufen|kontaktiert)\b`, "gi"), seinWunsch: true },
  { art: "kontaktiert Sie + Zeit", re: new RegExp(String.raw`\bkontaktier(?:t|en)\s+Sie\b[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  // Nachbesserung: „wird Sie heute anrufen“, „werden Sie morgen kontaktieren“.
  { art: "wird Sie + Zeit + anrufen", re: new RegExp(String.raw`\b(?:wird|werden)\s+(?:wir\s+)?(?:Sie|Ihnen)\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\b${ZZ_KONTAKT}\b|${ZZ_T}[^.!?\n]{0,40}?\b(?:wird|werden)\s+(?:wir\s+)?(?:Sie|Ihnen)\b[^.!?\n]{0,40}?\b${ZZ_KONTAKT}\b`, "gi") },
  // Nachbesserung: „setzt sich heute mit Ihnen in Verbindung“, „nimmt morgen Kontakt auf“, „schreibt Ihnen heute“.
  { art: "in Verbindung + Zeit", re: new RegExp(String.raw`\b(?:setz(?:t|en)\s+(?:sich|uns)|(?:wird|werden)\s+sich)\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\bin\s+Verbindung\b|${ZZ_T}[^.!?\n]{0,40}?\bsetz(?:t|en)\s+(?:sich|uns|wir\s+uns)\b[^.!?\n]{0,40}?\bin\s+Verbindung\b`, "gi") },
  { art: "Kontakt aufnehmen + Zeit", re: new RegExp(String.raw`\b(?:nimmt|nehmen|wird|werden)\b[^.!?\n]{0,40}?${ZZ_T}[^.!?\n]{0,40}?\bKontakt\b[^.!?\n]{0,20}?\bauf(?:nehmen)?\b`, "gi") },
  { art: "schreibt Ihnen + Zeit", re: new RegExp(String.raw`\bschreib(?:t|en)\s+(?:wir\s+)?Ihnen\b[^.!?\n]{0,40}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,30}?\bschreib(?:t|en)\s+(?:wir\s+)?Ihnen\b`, "gi") },
  // Nachbesserung: „Sie erhalten heute noch eine Nachricht von uns“, „Sie bekommen morgen Bescheid“.
  // E-531 Nachbesserung 3: auch „Eine Rückmeldung erhalten Sie morgen.“ (das Nachricht-Wort vorn).
  { art: "Sie erhalten + Zeit + Nachricht", re: new RegExp(String.raw`\b(?:Sie\s+(?:erhalten|bekommen)|(?:erhalten|bekommen)\s+Sie)\b[^.!?\n]{0,50}?${ZZ_T}[^.!?\n]{0,40}?\b${ZZ_BESCHEID}\b|\b(?:Sie\s+(?:erhalten|bekommen)|(?:erhalten|bekommen)\s+Sie)\b[^.!?\n]{0,40}?\b${ZZ_BESCHEID}\b[^.!?\n]{0,40}?${ZZ_T}|${ZZ_T}[^.!?\n]{0,30}?\b(?:erhalten|bekommen)\s+Sie\b[^.!?\n]{0,40}?\b${ZZ_BESCHEID}\b|\b${ZZ_BESCHEID}\b[^.!?\n]{0,40}?\b(?:erhalten|bekommen)\s+Sie\b[^.!?\n]{0,40}?${ZZ_T}`, "gi") },
  // E-531 Nachbesserung 3: „Die Antwort folgt morgen.“, „Morgen kommt die Rückmeldung.“ — nur mit einem Nachricht-Wort
  // (nie „Der Anmelde-Link kommt sofort …“, nie „Die Bestätigung kommt gleich per E-Mail“, nie „Ihre Nachricht von heute“).
  { art: "Nachricht folgt + Zeit", re: new RegExp(String.raw`${ZZ_UNSERE_NACHRICHT}[^.!?\n]{0,40}?${ZZ_FOLGT}[^.!?\n]{0,40}?(?<!\bvon\s{1,3})${ZZ_T}|${ZZ_UNSERE_NACHRICHT}[^.!?\n]{0,40}?(?<!\bvon\s{1,3})${ZZ_T}[^.!?\n]{0,30}?${ZZ_FOLGT}|${ZZ_T}[^.!?\n]{0,30}?${ZZ_FOLGT}[^.!?\n]{0,40}?${ZZ_UNSERE_NACHRICHT}`, "gi"), seinWunsch: true },
  // Nachbesserung: „Ich habe Herrn X gebeten, sich heute bei Ihnen zu melden“ (das alte Werkzeug-Muster).
  { art: "gebeten + Zeit", re: new RegExp(String.raw`\bgebeten\b[^.!?\n]{0,80}?${ZZ_T}[^.!?\n]{0,40}?\b(?:zu\s+melden|anzurufen|zur(?:ü|ue)ckzurufen|zu\s+kontaktieren|zu\s+pr(?:ü|ue)fen|zu\s+kl(?:ä|ae)ren|zu\s+schreiben|zu\s+bearbeiten)\b|\bgebeten\b[^.!?\n]{0,80}?\b(?:zu\s+melden|anzurufen|zur(?:ü|ue)ckzurufen|zu\s+kontaktieren|zu\s+pr(?:ü|ue)fen|zu\s+kl(?:ä|ae)ren)\b[^.!?\n]{0,30}?${ZZ_T}`, "gi") },
  { art: "meldet sich persönlich/umgehend", re: /\bmeld(?:et|en)\s+sich\s+(?:[^\s.!?]+\s+){0,3}?(?:persönlich|persoenlich|umgehend|gleich|sofort|schnellstmöglich|schnellstmoeglich|zeitnah)\b/gi, ohneZeit: true },
  { art: "Leitung/Team meldet sich", re: new RegExp(String.raw`\b${ZZ_WER}\b[^.!?\n]{0,40}?\b(?:meldet\s+sich|wird\s+sich\b[^.!?\n]{0,30}?\bmelden|ruft\s+Sie\b(?!${ZZ_ER_RUFT})[^.!?\n]{0,40}?\b(?:an|zurück|zurueck)\b|wird\s+Sie\b[^.!?\n]{0,30}?\b(?:anrufen|zur(?:ü|ue)ckrufen|kontaktieren)\b)`, "gi"), ohneZeit: true },
  // Nachbesserung: auch OHNE Zeit kein „Herr X ruft Sie an“ / „wird Sie anrufen“ — ohne Kalendertermin hält das niemand.
  // E-531 Nachbesserung 2: bis zu acht Wörter zwischen Name und Verb („Herr X hat den Auftrag dazu bekommen und meldet sich …“),
  // aber nie über ein Satzende hinweg (vorher \S+ — „… an Frau X gegeben. Sie … meldet sich“ wurde ein Treffer).
  { art: "Herr/Frau X meldet sich", re: new RegExp(String.raw`\b${ZZ_NAME}\s+(?:[^\s.!?]+\s+){0,8}?(?:meldet\s+sich|wird\s+sich\b[^.!?\n]{0,30}?\bmelden|ruft\s+Sie\b(?!${ZZ_ER_RUFT})|wird\s+Sie\b[^.!?\n]{0,30}?\b(?:anrufen|zur(?:ü|ue)ckrufen|kontaktieren)\b|setzt\s+sich\b[^.!?\n]{0,40}?\bin\s+Verbindung\b)`, "g"), ohneZeit: true },
  { art: "Vorname Nachname meldet sich", re: /\b(?!(?:Die|Der|Das|Ihre?|Unser(?:e)?|Eine?|Kein(?:e)?|Diese[rs]?|Jede[rs]?)\s)[A-ZÄÖÜ][a-zäöüß]+\s+[A-ZÄÖÜ][A-Za-zäöüß-]+\s+(?:meldet\s+sich|ruft\s+Sie)\b/g, ohneZeit: true },
  // E-531 Nachbesserung 2: umgestellt — „Dann ruft Herr X Sie an“, „ruft Sie Ihr Betreuer zurück“, „meldet sich unsere Leitung“.
  { art: "ruft Herr X Sie an (umgestellt)", re: new RegExp(String.raw`\b[Rr]uft\s+(?:Sie\s+)?(?:${ZZ_NAME}|${ZZ_WER})\b[^.!?\n]{0,40}?\b(?:an|zur(?:ü|ue)ck)\b|\b[Mm]eldet\s+sich\s+(?:bei\s+Ihnen\s+)?(?:${ZZ_NAME}|${ZZ_WER})\b|\b[Ww]ird\s+(?:${ZZ_NAME}|${ZZ_WER})\s+(?:Sie|Ihnen)\b[^.!?\n]{0,40}?\b(?:anrufen|zur(?:ü|ue)ckrufen|kontaktieren)\b|\b[Ww]ird\s+sich\s+(?:${ZZ_NAME}|${ZZ_WER})\b[^.!?\n]{0,40}?\bmelden\b`, "g"), ohneZeit: true },
  { art: "englisch: will contact you today", re: new RegExp(String.raw`(?:\bwill|'ll|’ll|\bshall|\bis\s+going\s+to|\bare\s+going\s+to)\s+(?:get\s+back\s+to|contact|call|reach\s+out\s+to|be\s+in\s+touch\s+with|e-?mail|write\s+to|update)\s+you\b[^.!?\n]{0,40}?\b${ZZ_EN_ZEIT}\b`, "gi") },
  { art: "englisch: you will hear from us today", re: new RegExp(String.raw`\byou(?:'ll|’ll|\s+will|\s+shall)?\s+hear\s+(?:back\s+)?from\s+(?:us|me|him|her|our\s+\w+)\b[^.!?\n]{0,30}?\b${ZZ_EN_ZEIT}\b`, "gi") },
  { art: "englisch: I have asked … today", re: new RegExp(String.raw`\b(?:I|we)\s*(?:have|'ve|’ve)\s+asked\b[^.!?\n]{0,80}?\bto\b[^.!?\n]{0,60}?\b${ZZ_EN_ZEIT}\b`, "gi") },
  { art: "englisch: Mr X will contact", re: /\b(?:Mr|Ms|Mrs)\.?\s+[A-Z][A-Za-z-]+\s+will\s+(?:contact|call|get\s+in\s+touch|get\s+back|reach\s+out)\b/g, ohneZeit: true },
  // „ü“/„ı“ sind für \b keine Wortzeichen — darum Unicode-Lookarounds (vorher griff „\bbugün\b“ nie). Als new RegExp wie im
  // ganzen Haus: tsc prüft Regex-Literale gegen das Ziel, das u-Flag ginge dort nicht.
  // E-531 Nachbesserung 2: auch „en kısa sürede“, „kısa süre içinde“, „hemen“, „24 saat içinde“ und „bilgi/yanıt vereceğiz“.
  { art: "türkisch: bugün/yarın … arayacak", re: new RegExp(String.raw`(?<![\p{L}])(?:bugün|yarın|en\s+kısa\s+(?:sürede|zamanda)|kısa\s+süre\s+içinde|hemen|birazdan|\d+\s*(?:saat|gün|iş\s+günü)\s+içinde)(?![\p{L}])[^.!?\n]{0,60}?(?:arayaca[kğ]\p{L}*|dönece\p{L}*|dönüş\p{L}*|ulaşaca\p{L}*|iletişime\s+geçece\p{L}*|haber\s+verece\p{L}*|bilgi\s+verece\p{L}*|yanıt\s+verece\p{L}*|cevap\s+verece\p{L}*)`, "giu") },
  { art: "andere Sprache: Zeit + Zusage", re: new RegExp(String.raw`(?<!\p{L})(?:${ZZ_FREMD_ZEIT})(?!\p{L})[^.!?\n]{0,60}?(?<!\p{L})(?:${ZZ_FREMD_ZUSAGE})(?!\p{L})|(?<!\p{L})(?:${ZZ_FREMD_ZUSAGE})(?!\p{L})[^.!?\n]{0,60}?(?<!\p{L})(?:${ZZ_FREMD_ZEIT})(?!\p{L})`, "giu") },
];

/** Bitte an ihn: „(Bitte/Gern) Rufen Sie … an“, „Melden Sie sich …“ — keine Zusage von uns. Geprüft am Satzteil (Nachbesserung 2). */
const ZZ_BITTE_AN_IHN = /^(?:(?:bitte|gern(?:e)?|dann|sonst|oder|und|selbstverständlich|natürlich)\s*,?\s+)*(?:rufen|melden|schreiben|antworten|wenden)\s+sie\b/i;
/** Vergangenheit/Entschuldigung: „hat leider nicht geklappt“, „gestern“ … */
const ZZ_VERGANGEN = /\b(?:gestern|vorgestern|vorhin)\b|\bletzte\s+Woche\b|\bnicht\s+(?:\S+\s+){0,2}?(?:geklappt|stattgefunden|erreicht|gemeldet|zur(?:ü|ue)ckgerufen|angerufen)\b|\b(?:hat|hatte|haben|hatten|ist|war|waren|wurde|wurden)\b[^.!?\n]{0,60}?\b(?:geklappt|stattgefunden|ausgefallen|verpasst|vergessen|vers(?:ä|ae)umt)\b/i;
/** … mit einer neuen Zusage im selben Satz bleibt es ein Treffer (Nachbesserung 2: auch die neuen Zusage-Formen). */
const ZZ_ZUSAGE_VERB = /\bmeld(?:et|en|e)\s+(?:sich|uns|mich)\b|\bruf(?:t|en)\s+(?:Sie|Ihnen)\b|\b(?:wird|werden|werde)\b|\b(?:erhalten|bekommen)\s+Sie\b|\bsetz(?:t|en)\s+(?:sich|uns)\b|\bschreib(?:t|en)\s+(?:wir\s+)?Ihnen\b|\bkomm(?:e|en|t)\b[^.!?\n]{0,40}?\bauf\s+Sie\b|\b(?:geb(?:e|en)|gibt)\s+(?:wir\s+|ich\s+)?Ihnen\b|\b(?:ruf|kontaktier|informier|benachrichtig|antwort)(?:e|en)\s+(?:wir|ich)\s+(?:Sie|Ihnen)\b|\b(?:wir|ich)\s+(?:informier|benachrichtig|antwort|kontaktier)(?:e|en)\s+(?:Sie|Ihnen)\b|\b(?:will|shall)\b|['’]ll\b/i;
/** „sobald Ihre Zahlung eingegangen ist“ — die Eile hängt an einer Bedingung, nicht an der Uhr. */
const ZZ_SOBALD = /\b(?:sobald|nachdem|wenn)\b[^.!?\n]{0,80}?\b(?:eingegangen|eingeht|da\s+ist|vorliegt|vorliegen|gebucht|verbucht|best(?:ä|ae)tigt|angekommen|zugeordnet|gekl(?:ä|ae)rt|erledigt|freigegeben)\b|\b(?:sobald|wenn)\s+(?:wir|ich)\s+(?:Neuigkeiten|Neues|mehr\s+wissen|eine\s+R(?:ü|ue)ckmeldung|R(?:ü|ue)ckmeldung)\b|\bsobald\s+es\s+(?:Neuigkeiten|Neues)\b/i;
const ZZ_EILE = new RegExp(String.raw`(?<![A-Za-zÄÖÜäöüß])(?:gleich|sofort|umgehend|zeitnah|in\s+K(?:ü|ue)rze|kurzfristig|schnellstm(?:ö|oe)glich|schnellstens|baldm(?:ö|oe)glichst|so\s+(?:schnell|bald|rasch|z(?:ü|ue)gig)\s+(?:wie\s+m(?:ö|oe)glich|es\s+geht)|m(?:ö|oe)glichst\s+(?:schnell|rasch)|bald|z(?:ü|ue)gig|rasch|demn(?:ä|ae)chst)(?![A-Za-zÄÖÜäöüß])`, "i");
const ZZ_KALENDERWORT = new RegExp(String.raw`\d|(?<![A-Za-zÄÖÜäöüß])(?:heute|morgen|(?:ü|ue)bermorgen|${ZZ_WOCHENTAG}|${ZZ_MONAT}|Woche|Wochenende|Tagen|Werktagen|Stunden|Minuten|Uhr|Monat|Jahresende|sp(?:ä|ae)testens)(?![A-Za-zÄÖÜäöüß])`, "i");

/**
 * E-531 Nachbesserung 3: Eile unter einer Bedingung ist nur frei, wenn im ganzen Satz sonst keine Zeit steht. Vorher sah die
 * Ausnahme nur die Fundstelle — „Wir melden uns umgehend, sobald die Prüfung erledigt ist, spätestens aber am Freitag.“ war
 * frei. Herausgenommen werden der sobald-Teil und das Eile-Wort DIESER Fundstelle (eine zweite Eile im Satz zählt). Rein.
 */
function zzSobaldFrei(t: string, a: number, e: number, von: number, bis: number): boolean {
  const ohneEile = `${t.slice(a, von)} ${t.slice(von, bis).replace(new RegExp(ZZ_EILE.source, "gi"), " ")} ${t.slice(bis, e)}`;
  const ohne = ohneEile.replace(new RegExp(ZZ_SOBALD.source, "gi"), " ").replace(/\s+/g, " ");
  return !new RegExp(ZZ_T, "i").test(zzOhneDatumPunkt(ohne));
}

// ── E-531 Nachbesserung 2/3: SEIN WUNSCH, SEINE BUCHUNG (Terminlink-Weg) ─────────────────────────────────────────
// „Sie hatten heute um einen Rückruf gebeten. Wählen Sie hier eine Zeit …“ ist keine Zusage von uns. Geprüft wird nur
// der Satzteil mit dem Wort „Rückruf/angerufen“ — „Wie Sie gebeten haben, erfolgt der Rückruf heute.“ bleibt ein Treffer.
// NACHBESSERUNG 3 (Abnahme-Prüfung): Vorher reichte „Sie … gewünscht/eingetragen“ irgendwo im Satzteil. Damit waren
// UNSERE Zusagen frei, in denen „Sie“ nicht der Wünschende ist („Sie werden morgen wie gewünscht zurückgerufen.“, „Wir
// haben für Sie morgen einen Rückruf eingetragen.“, „Unser Team hat Sie für morgen eingetragen.“). Jetzt eine feste Liste,
// in der „Sie“ eindeutig ER ist, der wünscht, bittet oder absagt — und eine Sperre (ZZ_UNSERE_ZUSAGE), die immer gewinnt.
// „eingetragen/gebucht/verschoben“ stehen bewusst nicht in der Liste: „Sie haben den Rückruf eingetragen“ kann auch „die
// Kollegen“ meinen. Hat ER wirklich gebucht, steht der Termin im Kalender und deckt den Satz dort.
const ZZ_WUNSCH_PARTIZIP = String.raw`(?:gebeten|gew(?:ü|ue)nscht|angefragt|abgesagt|storniert)`;
const ZZ_LINK_WEG = String.raw`(?:[Üü]ber|[Uu]nter|[Mm]it)\s+(?:den|dem|diesen|diesem|folgenden|folgendem)\s+(?:Link|Knopf|Button)`;
const ZZ_SEIN_WUNSCH = new RegExp([
  // „Sie hatten (heute) um einen Rückruf gebeten“, „Sie haben den Rückruf abgesagt“
  String.raw`\bSie\s+(?:hatten|haben|h(?:ä|ae)tten)\b[^.!?\n]{0,80}?\b${ZZ_WUNSCH_PARTIZIP}\b`,
  // „Den Rückruf für morgen haben Sie abgesagt“ — nie direkt nach wir/ich/er/sie/es („Wir haben Sie gebeten …“)
  String.raw`(?<!\b(?:[Ww]ir|[Ii]ch|[Ee]r|sie|[Ee]s)\s+)\b(?:haben|hatten|h(?:ä|ae)tten)\s+Sie\b[^.!?\n]{0,60}?\b${ZZ_WUNSCH_PARTIZIP}\b`,
  // „Sie möchten heute zurückgerufen werden“ — nie „wie Sie möchten“ (das ist unsere Zusage)
  String.raw`(?<!\b[Ww]ie\s+)\bSie\s+(?:m(?:ö|oe)chten|w(?:ü|ue)nschen|w(?:ü|ue)nschten|wollen|wollten|baten|bitten|h(?:ä|ae)tten\s+gern(?:e)?)\b`,
  // Frage an ihn am Anfang des Satzteils: „Möchten Sie morgen angerufen werden?“, „Wann möchten Sie …“
  String.raw`^(?:(?:[Uu]nd|[Oo]der|[Aa]lso|[Dd]ann|[Gg]ern(?:e)?)\s+)*(?:(?:[Ww]ann|[Ww]ie|[Oo]b|[Ww]o)\s+)?(?:[Mm](?:ö|oe)chten|[Ww](?:ü|ue)nschen|[Ww]ollen|[Hh](?:ä|ae)tten)\s+Sie\b`,
  // „Ihren Rückruf … können Sie hier direkt eintragen“ — nur mit „sich“ oder „hier/selbst/direkt/über den Link“
  String.raw`\b(?:[Kk](?:ö|oe)nnen|[Dd](?:ü|ue)rfen)\s+Sie\s+(?:sich\b|[^.!?\n]{0,40}?\b(?:hier|selbst|direkt|jederzeit|bequem|online|${ZZ_LINK_WEG})\b)[^.!?\n]{0,60}?\b(?:eintragen|einbuchen|buchen|w(?:ä|ae)hlen|ausw(?:ä|ae)hlen|aussuchen|vereinbaren|festlegen|absagen|verschieben|stornieren)\b`,
  // Aufforderung an ihn am Anfang des Satzteils: „Buchen Sie Ihren Rückruf für morgen hier“, „Wählen Sie …“
  String.raw`^(?:(?:[Bb]itte|[Gg]ern(?:e)?|[Dd]ann|[Ee]infach|[Hh]ier|[Jj]etzt|[Dd]irekt|${ZZ_LINK_WEG})\s+)*(?:[Ww](?:ä|ae)hlen|[Bb]uchen|[Tt]ragen|[Ss]uchen|[Vv]ereinbaren|[Ll]egen)\s+Sie\b`,
].join("|"));
/**
 * Die Sperre (gewinnt immer): Im Satzteil steht UNSERE Zusage — „für Sie“, „wie (von Ihnen) gewünscht/besprochen“, „wie Sie
 * (es) möchten“, „Sie werden/wurden/sind/stehen/bekommen/erhalten“ (Passiv, Empfang) oder wir/ich, eine Stelle (ZZ_WER),
 * Kollegen/Team/Betreuer, Herr/Frau X. Lieber ein Entwurf zu viel als eine Zusage, die niemand hält.
 */
const ZZ_UNSERE_ZUSAGE = new RegExp([
  String.raw`\bf(?:ü|ue)r\s+Sie\b`,
  String.raw`\bwie\s+(?:von\s+Ihnen\s+|es\s+)?(?:gew(?:ü|ue)nscht|angefragt|erbeten|gebeten|gebucht|besprochen|abgesprochen|vereinbart|verabredet|eingetragen|angefordert|zugesagt|angek(?:ü|ue)ndigt)\b`,
  String.raw`\bwie\s+(?:es\s+)?Sie\b`,
  String.raw`\bSie\s+(?:werden|wurden|sind|waren|stehen|standen|bekommen|erhalten|kriegen)\b`,
  String.raw`\b(?:werden|wurden|sind|waren|stehen|standen|bekommen|erhalten|kriegen)\s+Sie\b`,
  String.raw`\b(?:wir|ich)\b`,
  String.raw`(?<![A-Za-zÄÖÜäöüß])${ZZ_WER}(?![A-Za-zÄÖÜäöüß])`,
  String.raw`\b(?:Kolleg(?:e|in|en|innen)|Mitarbeiter(?:in|innen)?|Team|Betreuer(?:in|innen)?|Berater(?:in|innen)?|Ansprechpartner(?:in|innen)?)\b`,
  String.raw`\b(?:Herrn?|Frau)\s+[A-ZÄÖÜ]`,
].join("|"), "i");
/** Das Wort, um das es bei „seinWunsch“ geht — dessen Satzteil wird geprüft. */
const ZZ_ANKER = /R(?:ü|ue)ckruf|angerufen|zur(?:ü|ue)ckgerufen|kontaktiert|Anruf/i;
/** Satzteile: Komma, Strichpunkt, Doppelpunkt (nicht in „10:30“), Gedankenstrich, Klammer, „und/oder/aber/sowie/sondern“. */
// Als new RegExp wie im ganzen Haus (Lookbehind): tsc prüft Regex-Literale gegen das Ziel (E-531 Nachbesserung 2).
const ZZ_KLAUSEL = new RegExp(String.raw`[,;–—()]|(?<!\d):|:(?!\d)|\s-\s|(?<![A-Za-zÄÖÜäöüß])(?:und|oder|aber|sowie|sondern)(?![A-Za-zÄÖÜäöüß])`, "gi");

// ── E-531 Nachbesserung 2: KALENDER-DECKUNG NUR MIT DEM RICHTIGEN TAG (senden#3, wa#8) ──────────────────────────
// Vorher reichte dieselbe Uhrzeit an irgendeinem Tag („heute um 10 Uhr“ gegen den Termin „morgen um 10 Uhr“), das Wort
// „Termin“ allein, und ein Satz mit dem Termin war ganz frei, auch mit einer zweiten Zusage darin. Jetzt:
//   · Uhrzeit nur mit dem passenden Tag (heute/morgen/Wochentag/Datum aus dem Kalendertext, ohne Tag gilt „heute“ — oder
//     der Tag des Termin-Satzes direkt davor); jede Uhrzeit im Satz muss die des Termins sein.
//   · „zum (vereinbarten) Termin“, „wie vereinbart“, „zur vereinbarten Zeit“ — und „dann“ nur im Satz direkt nach dem
//     Termin-Satz —, jeweils ohne eigene Zeit.
//   · Steht der Termin im Satz, wird der Rest des Satzes noch einmal geprüft („…, und die Leitung meldet sich heute“).
// Ein Termin, der nur in einem Brief der Geschäftsleitung (Fall-Akte, js@) steht und nicht im Kalender, deckt bewusst
// nichts: Die Bestätigung wird ein Entwurf, ein Mensch gibt sie frei (lieber Entwurf als falsche Zusage).
// NACHBESSERUNG 3 (Abnahme-Prüfung): Der Kalender gab noch zu viel frei. Jetzt außerdem:
//   · „wie vereinbart“ und „dann“ decken nie, wenn eine Stelle (ZZ_WER: Leitung, Geschäftsführung, Buchhaltung, Team,
//     Ihr Betreuer …) im Satz steht — „Die Geschäftsführung meldet sich wie vereinbart“ verspricht jemand anderes.
//   · „dann“ nur nach einem Satz mit dem Kalendertext oder mit Tag UND Uhrzeit des Termins (nicht „Danke für Ihre
//     Nachricht von heute.“).
//   · Tageszeiten (früh, Vormittag, Mittag, Nachmittag, Abend, Nacht) müssen zur Uhrzeit des Termins passen —
//     „morgen Abend“ deckt den Termin „morgen um 10 Uhr“ nicht.
//   · Der Rest des Satzes wird auch mit den Mustern OHNE Zeit geprüft, in den Satzteilen ohne die Termin-Angabe
//     („…, und Frau Y meldet sich bei Ihnen.“) — auch bei „wie vereinbart“ und „dann“ (zzRestFrei).
const ZZ_VEREINBART =/\b(?:zum|zu\s+(?:Ihrem|dem|diesem))\s+(?:(?:vereinbarten|verabredeten|gebuchten|eingetragenen|besprochenen)\s+)?(?:Termin|R(?:ü|ue)ckruftermin|Zeitpunkt)\b|\bwie\s+(?:vereinbart|verabredet|besprochen|abgesprochen)\b|\bzur\s+(?:vereinbarten|verabredeten|gebuchten|eingetragenen)\s+(?:Zeit|Uhrzeit)\b/i;
const ZZ_DANN = new RegExp(String.raw`(?<![A-Za-zÄÖÜäöüß])(?:dann|zu\s+diese[mr]\s+(?:Zeit(?:punkt)?|Uhrzeit|Termin))(?![A-Za-zÄÖÜäöüß])`, "i");
/** Eine Stelle im Satz (Leitung, Geschäftsführung, Team, Ihr Betreuer …) — dann decken „wie vereinbart“/„dann“ nie (Nachbesserung 3). */
const ZZ_WER_RE = new RegExp(String.raw`(?<![A-Za-zÄÖÜäöüß])${ZZ_WER}(?![A-Za-zÄÖÜäöüß])`, "i");
/** Tageszeiten: „morgen früh“, „heute Abend“, „Donnerstagnachmittag“, „heute Morgen“ — nie der Gruß „Guten Abend/Morgen“. */
const ZZ_TAGESZEIT_RE = new RegExp([
  String.raw`(?<![A-Za-zÄÖÜäöüß])(?<!\bgute[nr]?\s+)(?:sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)?(fr(?:ü|ue)h|morgens|vormittags?|nachmittags?|mittags?|abends?|nachts?)(?![A-Za-zÄÖÜäöüß])`,
  String.raw`(?<=\b(?:heute|gestern|am|jeden|diesen)\s+)(morgen)(?![A-Za-zÄÖÜäöüß])`,
].join("|"), "gi");
/** Tagesangaben: heute/morgen/übermorgen, Wochentag, Datum („30:11.“ im Suchtext, „30. November“). */
const ZZ_TAG_RE = new RegExp([
  String.raw`(?<![A-Za-zÄÖÜäöüß])(heute|(?:ü|ue)bermorgen|vorgestern|gestern)(?![A-Za-zÄÖÜäöüß])`,
  String.raw`(?<![A-Za-zÄÖÜäöüß])(?<!(?:heute|gestern|guten|am|jeden|diesen)\s+)(morgen)(?![A-Za-zÄÖÜäöüß])`,
  String.raw`(?<![A-Za-zÄÖÜäöüß])(sonntag|montag|dienstag|mittwoch|donnerstag|freitag|samstag)(?:s|morgen|vormittag|mittag|nachmittag|abend)?(?![A-Za-zÄÖÜäöüß])`,
  String.raw`(?<![\d:.])(?<!(?:um|gegen)\s)(\d{1,2})[.:]\s?(\d{1,2})(?:[.:](\d{4}|\d{2})(?![\d:])|\.(?!\d))`,
  String.raw`(?<![\d:.])(\d{1,2})\.\s?(januar|februar|m(?:ä|ae)rz|april|mai|juni|juli|august|september|oktober|november|dezember)(?:\s+(\d{4}))?(?![A-Za-zÄÖÜäöüß])`,
].join("|"), "gi");
const ZZ_DATUM_RE = new RegExp(String.raw`(?<![\d:.])(?<!(?:um|gegen)\s)\d{1,2}[.:]\s?\d{1,2}(?:[.:](?:\d{4}|\d{2})(?![\d:])|\.(?!\d))`, "gi");
const ZZ_UHR_RE = new RegExp(String.raw`(?:(?:um|gegen|ab|bis)\s+)?(?<![\d:])(?:[01]?\d|2[0-3])(?:[:.][0-5]\d)?\s*uhr(?![A-Za-zÄÖÜäöüß])|(?:(?:um|gegen|ab)\s+)?(?<![\d:])(?:[01]?\d|2[0-3])[:.][0-5]\d(?![\d:])`, "gi");
const ZZ_WT_NAMEN = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
const ZZ_MONAT_NAMEN = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
/** Die Grenze, die ein herausgenommener Termin im Satz hinterlässt: wie ein Satzende, kein Muster greift darüber. */
const ZZ_SCHNITT = " . ";

interface ZzTag { art: "rel" | "wt" | "datum"; key: string | null; wt: number; von: number; bis: number }
interface ZzTermin { text: string; uhr: string[]; tag: { key: string; wt: number } | null }

/** Berliner Kalendertag von `jetzt` plus `n` Tage — nur über formatToParts (Zeit-Falle). Rein. */
function zzBerlinTag(jetzt: Date, n: number): { key: string; wt: number; j: number } {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(jetzt);
  const w = (x: string) => Number(p.find((y) => y.type === x)?.value ?? "0");
  const d = new Date(Date.UTC(w("year"), w("month") - 1, w("day") + n));
  return { key: `${d.getUTCDate()}.${d.getUTCMonth() + 1}`, wt: d.getUTCDay(), j: d.getUTCFullYear() };
}

/** „30.11.“ ohne Jahr: der nächste solche Tag (lange vorbei → nächstes Jahr). Null, wenn es den Tag nicht gibt. Rein. */
function zzDatumTag(t: number, m: number, jahr: number | null, jetzt: Date): { key: string; wt: number } | null {
  if (!(t >= 1 && t <= 31 && m >= 1 && m <= 12)) return null;
  const heute = zzBerlinTag(jetzt, 0);
  let j = jahr && jahr >= 100 ? jahr : jahr ? 2000 + jahr : heute.j;
  if (!jahr) {
    const [ht, hm] = heute.key.split(".").map(Number);
    if (Date.UTC(j, m - 1, t) < Date.UTC(j, hm - 1, ht) - 60 * 86_400_000) j += 1;
  }
  const d = new Date(Date.UTC(j, m - 1, t));
  if (d.getUTCMonth() !== m - 1) return null;
  return { key: `${t}.${m}`, wt: d.getUTCDay() };
}

/** Alle Tagesangaben im Text, mit Lage. Rein. */
function zzTage(s: string, jetzt: Date): ZzTag[] {
  const aus: ZzTag[] = [];
  const re = new RegExp(ZZ_TAG_RE.source, "gi");
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (!m[0]) { re.lastIndex += 1; continue; }
    const von = m.index, bis = m.index + m[0].length;
    const rel = (m[1] ?? m[2] ?? "").toLowerCase();
    if (rel) {
      const n = rel === "heute" ? 0 : rel === "morgen" ? 1 : /bermorgen$/.test(rel) ? 2 : rel === "gestern" ? -1 : -2;
      const b = zzBerlinTag(jetzt, n);
      aus.push({ art: "rel", key: b.key, wt: b.wt, von, bis });
    } else if (m[3]) {
      aus.push({ art: "wt", key: null, wt: ZZ_WT_NAMEN.indexOf(m[3].toLowerCase()), von, bis });
    } else {
      const t = Number(m[4] ?? m[7]);
      const mo = m[5] ? Number(m[5]) : ZZ_MONAT_NAMEN.indexOf(String(m[8] ?? "").toLowerCase().replace("ae", "ä")) + 1;
      const jahr = m[6] ?? m[9];
      const d = zzDatumTag(t, mo, jahr ? Number(jahr) : null, jetzt);
      if (d) aus.push({ art: "datum", key: d.key, wt: d.wt, von, bis });
    }
  }
  return aus;
}

/** Uhrzeiten in einem Text als „HH:MM“ („10 Uhr“, „9:30 Uhr“, „14.15“) — ein Datum („16:11.“) ist keine Uhrzeit. Rein. */
function zzUhrzeiten(s: string): string[] {
  const aus: string[] = [];
  const ohneDatum = s.replace(new RegExp(ZZ_DATUM_RE.source, "gi"), (x) => " ".repeat(x.length));
  const re = /\b([01]?\d|2[0-3])(?:[:.]([0-5]\d))?\s*uhr\b|\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/gi;
  for (let m = re.exec(ohneDatum); m; m = re.exec(ohneDatum)) {
    const h = String(m[1] ?? m[3] ?? "");
    if (!h) continue;
    aus.push(`${h.length === 1 ? `0${h}` : h}:${String(m[2] ?? m[4] ?? "00")}`);
  }
  return aus;
}

/** Die Kalendertermine, wie die Wand sie vergleicht: Text, Uhrzeiten, Tag. Rein. */
function zzTermine(kalender: (string | null | undefined)[], jetzt: Date): ZzTermin[] {
  const aus: ZzTermin[] = [];
  for (const k of kalender) {
    const text = String(k ?? "").toLowerCase().replace(/(\d)\.(?=\d)/g, "$1:").replace(/\s+/g, " ").trim();
    if (text.length < 5 || aus.some((x) => x.text === text)) continue;
    const tage = zzTage(text, jetzt);
    const fest = tage.find((x) => x.art === "datum") ?? tage.find((x) => x.art === "rel");
    let tag: ZzTermin["tag"] = fest && fest.key ? { key: fest.key, wt: fest.wt } : null;
    const wt = tage.find((x) => x.art === "wt");
    if (!tag && wt) {
      // „am Montag um 10 Uhr“ (zeitFuerKunde: 2 bis 6 Tage voraus) — der nächste solche Wochentag.
      for (let n = 1; n <= 7 && !tag; n++) { const b = zzBerlinTag(jetzt, n); if (b.wt === wt.wt) tag = { key: b.key, wt: b.wt }; }
    }
    aus.push({ text, uhr: zzUhrzeiten(text), tag });
  }
  return aus;
}

/** Steht der Kalendertext wörtlich im Satz (Groß/klein und Leerraum egal)? */
function zzTextRe(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+"), "gi");
}

/**
 * E-531 Nachbesserung 3: Passt jede Tageszeit im Satz („morgen früh“, „heute Abend“) zu den Uhrzeiten des Termins? Ein
 * Termin ohne Uhrzeit passt zu keiner Tageszeit (im Zweifel ein Entwurf). Rein.
 */
function zzTageszeitPasst(satz: string, terminUhr: string[]): boolean {
  const re = new RegExp(ZZ_TAGESZEIT_RE.source, "gi");
  for (let m = re.exec(satz); m; m = re.exec(satz)) {
    if (!m[0]) { re.lastIndex += 1; continue; }
    const w = String(m[1] ?? m[2] ?? "").toLowerCase().replace("frueh", "früh");
    const [ab, bis] = /^(?:früh|morgen)/.test(w) ? [5, 11] : w.startsWith("vormittag") ? [6, 12] : w.startsWith("nachmittag") ? [12, 18]
      : w.startsWith("mittag") ? [11, 15] : w.startsWith("abend") ? [17, 24] : [20, 29];
    if (!terminUhr.length) return false;
    const passt = terminUhr.every((u) => {
      let h = Number(u.slice(0, 2)) + Number(u.slice(3, 5)) / 60;
      if (ab >= 20 && h < 5) h += 24; // Nacht über Mitternacht
      return h >= ab && h < bis;
    });
    if (!passt) return false;
  }
  return true;
}

/**
 * Passt der Satz zum Termin — jede Tagesangabe ist sein Tag (ohne Tag: heute oder der Termin-Satz davor), jede Uhrzeit
 * seine, jede Tageszeit zu seiner Uhrzeit (Nachbesserung 3)? `tagUndUhr`: nur mit Tag UND Uhrzeit im Satz (Satz vor „dann“). Rein.
 */
function zzTerminPasst(satz: string, tm: ZzTermin, kontext: boolean, jetzt: Date, tagUndUhr = false): boolean {
  const tag = tm.tag;
  if (!tag) return false;
  const tage = zzTage(satz, jetzt), uhr = zzUhrzeiten(satz);
  if (!tage.length && !uhr.length) return false;
  if (tagUndUhr && !(tage.length && uhr.length)) return false;
  if (tage.length) {
    if (!tage.every((x) => (x.art === "wt" ? x.wt === tag.wt : x.key === tag.key))) return false;
  } else if (!kontext && tag.key !== zzBerlinTag(jetzt, 0).key) return false;
  if (!uhr.every((u) => tm.uhr.includes(u))) return false;
  return zzTageszeitPasst(satz, tm.uhr);
}

/** Der Satz ohne seine Uhrzeiten und die Tagesangaben direkt daneben (ohne Uhrzeit: ohne die erste Tagesangabe). Rein. */
function zzOhneTerminAngaben(satz: string, jetzt: Date): string {
  const datum: [number, number][] = [];
  const dre = new RegExp(ZZ_DATUM_RE.source, "gi");
  for (let m = dre.exec(satz); m; m = dre.exec(satz)) datum.push([m.index, m.index + m[0].length]);
  const uhr: [number, number][] = [];
  const ure = new RegExp(ZZ_UHR_RE.source, "gi");
  for (let m = ure.exec(satz); m; m = ure.exec(satz)) {
    const v = m.index, b = m.index + m[0].length;
    if (!datum.some(([dv, db]) => v < db && b > dv)) uhr.push([v, b]);
  }
  const tage = zzTage(satz, jetzt);
  const weg: [number, number][] = [...uhr];
  if (uhr.length) {
    for (const tg of tage) {
      if (uhr.some(([v, b]) => (tg.bis <= v && v - tg.bis <= 30) || (tg.von >= b && tg.von - b <= 15))) weg.push([tg.von, tg.bis]);
    }
  } else if (tage.length) weg.push([tage[0].von, tage[0].bis]);
  weg.sort((x, y) => y[0] - x[0]);
  let r = satz;
  let grenze = Infinity;
  for (const [v, b] of weg) {
    if (b > grenze) continue;
    r = r.slice(0, v) + ZZ_SCHNITT + r.slice(b);
    grenze = v;
  }
  return r;
}

/** „am 2. Dezember“, „am 01:12. fällig“ (Suchtext): Der Punkt nach dem Datum beendet keinen Satz (E-531 Nachbesserung 2). */
const ZZ_DATUM_PUNKT = new RegExp(String.raw`^\.\s?${ZZ_MONAT}(?![A-Za-zÄÖÜäöüß])`, "i");
/** Endet bei `i` ein Satz? Rein. */
function zzEnde(t: string, i: number): boolean {
  const c = t.charAt(i);
  if (!/[.!?\n]/.test(c)) return false;
  if (c !== "." || !/\d/.test(t.charAt(i - 1))) return true;
  if (ZZ_DATUM_PUNKT.test(t.slice(i, i + 16))) return false;
  return !(/\d{1,2}[.:]\d{1,2}$/.test(t.slice(Math.max(0, i - 5), i)) && /^\.\s+[a-zäöüß]/.test(t.slice(i, i + 4)));
}
/** Für die Ausnahme-Prüfungen: „2. Dezember“ → „2 Dezember“, „01:12. fällig“ → „01:12 fällig“ — [^.!?] liest darüber. Rein. */
function zzOhneDatumPunkt(s: string): string {
  return s.replace(new RegExp(String.raw`(\d)\.(?=\s?${ZZ_MONAT}(?![A-Za-zÄÖÜäöüß]))`, "gi"), "$1")
    .replace(/(\d{1,2}[.:]\d{1,2})\.(?=\s+[a-zäöüß])/g, "$1");
}

/** Satzgrenzen um eine Fundstelle in `t`: [Anfang, Ende) inklusive Satzzeichen. Rein. */
function zzGrenzen(t: string, von: number, bis: number): [number, number] {
  let a = von;
  while (a > 0 && !zzEnde(t, a - 1)) a--;
  let e = bis;
  while (e < t.length && !zzEnde(t, e)) e++;
  return [a, Math.min(t.length, e + 1)];
}

/** Der Satz direkt vor dem Satz, der bei `a` beginnt („" am Textanfang). Rein. */
function zzVorsatz(t: string, a: number): string {
  let q = a - 1;
  while (q >= 0 && (/\s/.test(t.charAt(q)) || zzEnde(t, q))) q--;
  if (q < 0) return "";
  const [a2, e2] = zzGrenzen(t, q, q);
  return t.slice(a2, e2).replace(/\s+/g, " ").trim();
}

/** Der Satzteil (zwischen Komma, „und“ …) in t[a, e), in dem `p` liegt — Text und Lage. Rein. */
function zzKlauselLage(t: string, a: number, e: number, p: number): { text: string; lo: number; hi: number } {
  const re = new RegExp(ZZ_KLAUSEL.source, "gi");
  re.lastIndex = a;
  let lo = a, hi = e;
  for (let m = re.exec(t); m && m.index < e; m = re.exec(t)) {
    if (!m[0]) { re.lastIndex += 1; continue; }
    const ende = m.index + m[0].length;
    if (ende <= p) lo = ende;
    else if (m.index > p) { hi = m.index; break; }
  }
  return { text: t.slice(lo, hi).replace(/\s+/g, " ").trim(), lo, hi };
}
function zzKlausel(t: string, a: number, e: number, p: number): string {
  return zzKlauselLage(t, a, e, p).text;
}

export interface ZeitZusageTreffer { art: string; treffer: string; satz: string }

/**
 * Die Suche selbst: jedes Muster, jede Fundstelle, die Ausnahmen (Bitte an ihn, Vergangenes, Eile unter Bedingung, sein
 * Wunsch), dann die Kalender-Deckung (`gedeckt`, null = keine). `nurZeit` = nur Muster mit Zeitangabe (Satz-Rest). Rein.
 */
function zzSuche(t: string, roh: string, nurZeit: boolean, gedeckt: ((a: number, e: number) => boolean) | null): ZeitZusageTreffer[] {
  const aus: ZeitZusageTreffer[] = [];
  for (const m of ZZ_MUSTER) {
    if (nurZeit && m.ohneZeit) continue;
    const re = new RegExp(m.re.source, m.re.flags.includes("g") ? m.re.flags : `${m.re.flags}g`);
    for (let x = re.exec(t); x; x = re.exec(t)) {
      if (!x[0]) { re.lastIndex += 1; continue; }
      const von = x.index, bis = x.index + x[0].length;
      const [a, e] = zzGrenzen(t, von, bis);
      const satz = roh.slice(a, e).replace(/\s+/g, " ").trim().slice(0, 240);
      if (aus.some((z) => z.satz === satz)) continue;
      const satzT = zzOhneDatumPunkt(t.slice(a, e).replace(/\s+/g, " ").trim());
      // E-531 Nachbesserung: keine Zusage — Bitte an ihn (Nachbesserung 2: im Satzteil der Fundstelle, sonst rettete „Rufen
      // Sie uns gern an, sonst melden wir uns morgen“ die Zusage), Entschuldigung für Vergangenes, Eile unter einer Bedingung.
      // Danach weiter ab dem nächsten Zeichen — eine zweite Fundstelle im selben Satz zählt.
      if (ZZ_BITTE_AN_IHN.test(zzOhneDatumPunkt(zzKlausel(t, a, e, von)))) { re.lastIndex = von + 1; continue; }
      if (ZZ_VERGANGEN.test(satzT) && !ZZ_ZUSAGE_VERB.test(satzT)) { re.lastIndex = von + 1; continue; }
      // E-531 Nachbesserung 3: Eile unter einer Bedingung nur, wenn im Satz sonst keine Zeit steht (zzSobaldFrei).
      if (ZZ_SOBALD.test(satzT) && ZZ_EILE.test(x[0]) && !ZZ_KALENDERWORT.test(x[0]) && zzSobaldFrei(t, a, e, von, bis)) { re.lastIndex = von + 1; continue; }
      if (m.verneint && m.verneint.test(x[0])) { re.lastIndex = von + 1; continue; }
      // E-531 Nachbesserung 2/3: sein Wunsch oder seine Buchung im Satzteil des Worts „Rückruf/angerufen“ (Terminlink-Weg) —
      // nur aus der festen Liste, nie gegen die Sperre (unsere Zusage), und nur, wenn im Rest des Satzes keine weitere Zeit
      // steht („…, das erfolgt heute noch“ bleibt ein Treffer).
      if (m.seinWunsch) {
        const k = zzKlauselLage(t, a, e, von + Math.max(0, x[0].search(ZZ_ANKER)));
        const kText = zzOhneDatumPunkt(k.text);
        const rest = zzOhneDatumPunkt(`${t.slice(a, k.lo)}${ZZ_SCHNITT}${t.slice(k.hi, e)}`);
        if (ZZ_SEIN_WUNSCH.test(kText) && !ZZ_UNSERE_ZUSAGE.test(kText) && !new RegExp(ZZ_T, "i").test(rest)) { re.lastIndex = von + 1; continue; }
      }
      if (gedeckt && gedeckt(a, e)) continue;
      aus.push({ art: m.art, treffer: roh.slice(von, bis).replace(/\s+/g, " ").trim().slice(0, 120), satz });
    }
  }
  return aus;
}

/** Wörter, die neben dem herausgenommenen Termin stehen dürfen, ohne eine eigene Aussage zu sein („…, und zwar . .“). */
const ZZ_FUELLWORT = /^(?:an|zur(?:ü|ue)ck|und|zwar|also|n(?:ä|ae)mlich|genau|dann|wie|gesagt|vereinbart|besprochen|abgesprochen|verabredet|gebucht|am|um|ab|gegen|zum|zur|ist|das|es)$/i;
/** Ein Satzteil mit dem herausgenommenen Termin: ein allein stehender Punkt (ZZ_SCHNITT), nie das Satzende „Ihnen.“ */
const ZZ_SCHNITT_DRIN = /(?:^|\s)\.(?=\s|$)/;

/**
 * E-531 Nachbesserung 3 (wa#8-Rest): Verspricht der Satz ohne den Termin (ZZ_SCHNITT an seiner Stelle) nichts Weiteres?
 * Muster MIT Zeit gelten im ganzen Rest. Muster OHNE Zeit („…, und Frau Y meldet sich bei Ihnen.“) gelten in den Satzteilen
 * ohne die Termin-Angabe — vorher prüfte der Rest nur Muster mit Zeit. Höchstens EINE Zusage daneben gehört zum Termin:
 *   · wenn der Termin allein in seinem Satzteil steht („Herr X ruft Sie an, morgen um 10 Uhr.“), oder
 *   · wenn der Termin-Satzteil selbst nichts verspricht und die Zusage mit „dann“ auf ihn zeigt („Ihr Rückruf morgen um 10 Uhr
 *     ist eingetragen; Herr X ruft Sie dann an.“) — dieselbe Regel wie über zwei Sätze: nur mit Kalendertext oder Tag UND
 *     Uhrzeit (`dannDeckt`), nie mit einer Stelle oder einer Tageszeit in diesem Satzteil.
 * Jede weitere Zusage ist ein Treffer. Rein.
 */
function zzRestFrei(rest: string, dannDeckt = false): boolean {
  if (zzSuche(rest, rest, true, null).length) return false;
  const teile = rest.split(new RegExp(ZZ_KLAUSEL.source, "gi"));
  const mitTermin = teile.filter((x) => ZZ_SCHNITT_DRIN.test(x));
  const andere = teile.filter((x) => !ZZ_SCHNITT_DRIN.test(x) && /[A-Za-zÄÖÜäöüß]/.test(x) && zzSuche(x, x, false, null).length > 0);
  if (!andere.length) return true;
  if (andere.length > 1 || !mitTermin.length) return false;
  const terminAllein = mitTermin.every((x) => x.split(/[^A-Za-zÄÖÜäöüß]+/).filter(Boolean).every((w) => ZZ_FUELLWORT.test(w)));
  if (terminAllein) return true;
  return dannDeckt && mitTermin.every((x) => zzSuche(x, x, false, null).length === 0)
    && ZZ_DANN.test(andere[0]) && !ZZ_WER_RE.test(andere[0]) && !new RegExp(ZZ_TAGESZEIT_RE.source, "i").test(andere[0]);
}

/**
 * E-531 (25.11.2026): Verspricht der Text, dass sich jemand zu einer Zeit meldet oder anruft — oder dass „Herr X“,
 * „die Leitung“, „Ihr Betreuer“ sich meldet? Liefert die ungedeckten Treffer (leer = keine Zeit-Zusage). Rein (`jetzt`
 * nur für heute/morgen/Wochentag, Standard: jetzt).
 * Gedeckt ist ein Satz nur durch einen echten Kalendertermin (`kalender`, Texte wie aus zeitFuerKunde, „morgen um 10 Uhr“),
 * und immer nur, wenn der Rest des Satzes nichts Weiteres verspricht (zzRestFrei, auch ohne Zeit — Nachbesserung 3):
 *   · der Kalendertext steht im Satz, oder
 *   · Tag, Uhrzeit und Tageszeit im Satz passen zum Termin (Uhrzeit ohne Tag: heute, oder der Tag des Termin-Satzes davor), oder
 *   · „zum (vereinbarten) Termin“ / „wie vereinbart“ / „zur vereinbarten Zeit“ ohne eigene Zeit, oder „dann“ ohne eigene
 *     Zeit direkt nach einem Satz mit dem Kalendertext oder Tag UND Uhrzeit („Ihr Rückruf ist für morgen um 10 Uhr
 *     eingetragen. Herr X ruft Sie dann an.“) — beides nie, wenn eine Stelle (ZZ_WER) im Satz steht.
 * Kein Treffer: „Wir melden uns, sobald die Bestätigung da ist.“, „Der Rückruf heute hat leider nicht geklappt.“ (Vergangenheit),
 * „Wir melden uns umgehend, sobald Ihre Zahlung eingegangen ist.“ (Bedingung), „Rufen Sie uns gern heute an.“ (Bitte an ihn),
 * „Sie hatten heute um einen Rückruf gebeten – wählen Sie hier eine Zeit“ (sein Wunsch, feste Liste seit Nachbesserung 3).
 * Treffer: „Herr X ruft Sie an.“ ohne Termin (hält niemand), „Wir werden uns zeitnah melden.“, „Wir rufen Sie am 30.11. an.“,
 * „Sie werden morgen wie gewünscht zurückgerufen.“ (unsere Zusage, auch wenn „gewünscht“ darin steht).
 */
export function maraZeitZusage(text: string, opt: { kalender?: (string | null | undefined)[]; jetzt?: Date } = {}): ZeitZusageTreffer[] {
  const roh = String(text ?? "");
  if (!roh.trim()) return [];
  // „9.30 Uhr“, „16.11.“: Der Punkt zwischen Ziffern beendet keinen Satz — gesucht wird in einer Kopie mit „:“ (gleich lang).
  const t = roh.replace(/(\d)\.(?=\d)/g, "$1:");
  const jetzt = opt.jetzt instanceof Date && Number.isFinite(opt.jetzt.getTime()) ? opt.jetzt : new Date();
  const termine = zzTermine(opt.kalender ?? [], jetzt);
  if (!termine.length) return zzSuche(t, roh, false, null);
  const zeitWort = new RegExp(ZZ_T, "i");
  const satzGedeckt = (a: number, e: number): boolean => {
    const satz = t.slice(a, e).replace(/\s+/g, " ").trim();
    const vorsatz = zzVorsatz(t, a);
    // Der Satz davor nennt den Termin: für eine Uhrzeit ohne Tag reicht sein Tag; für „dann“ braucht es den Kalendertext
    // oder Tag UND Uhrzeit (E-531 Nachbesserung 3 — „Danke für Ihre Nachricht von heute.“ ist kein Termin-Satz).
    const kontextTag = vorsatz ? termine.filter((tm) => zzTextRe(tm.text).test(vorsatz) || zzTerminPasst(vorsatz, tm, false, jetzt)) : [];
    const kontextVoll = vorsatz ? termine.filter((tm) => zzTextRe(tm.text).test(vorsatz) || zzTerminPasst(vorsatz, tm, false, jetzt, true)) : [];
    for (const tm of termine) {
      if (zzTextRe(tm.text).test(satz)) {
        // Der Termin steht wörtlich im Satz: frei, wenn der Rest nichts Weiteres verspricht — sonst deckt DIESER Termin nicht.
        if (zzRestFrei(satz.replace(zzTextRe(tm.text), ZZ_SCHNITT), true)) return true;
        continue;
      }
      if (zzTerminPasst(satz, tm, kontextTag.includes(tm), jetzt)
        && zzRestFrei(zzOhneTerminAngaben(satz, jetzt), zzTerminPasst(satz, tm, false, jetzt, true))) return true;
    }
    if (zeitWort.test(satz) || zzTage(satz, jetzt).length || zzUhrzeiten(satz).length || new RegExp(ZZ_TAGESZEIT_RE.source, "i").test(satz)) return false;
    // E-531 Nachbesserung 3: nie, wenn eine Stelle im Satz steht; der Rest des Satzes darf nichts Weiteres versprechen.
    if (ZZ_WER_RE.test(satz)) return false;
    if (ZZ_VEREINBART.test(satz)) return zzRestFrei(satz.replace(new RegExp(ZZ_VEREINBART.source, "gi"), ZZ_SCHNITT));
    if (kontextVoll.length > 0 && ZZ_DANN.test(satz)) return zzRestFrei(satz.replace(new RegExp(ZZ_DANN.source, "gi"), ZZ_SCHNITT));
    return false;
  };
  // Je Satz einmal entscheiden — mehrere Muster treffen oft denselben Satz.
  const schon = new Map<string, boolean>();
  const gedeckt = (a: number, e: number): boolean => {
    const k = `${a}:${e}`;
    if (!schon.has(k)) schon.set(k, satzGedeckt(a, e));
    return schon.get(k) === true;
  };
  return zzSuche(t, roh, false, gedeckt);
}

/** Verlangt der Kunde ausdrücklich eine Rechnung, einen Beleg oder die Zahlungsdaten? Rein. */
export function kundeWillRechnung(text: unknown): boolean {
  return /\b(rechnung\w*|beleg\w*|quittung\w*|invoice|factura|fattura|facture|zahlungsdaten|bankdaten|kontodaten|bankverbindung|iban)\b/i.test(String(text ?? ""));
}

export interface WerkzeugErgebnis {
  ok: boolean;
  /** Was der Agent im Text sagen darf — knapp und wahr. */
  ergebnis: string;
  /** Felder, auf die sich die Antwort berufen darf (Belegpflicht). */
  daten?: Record<string, unknown>;
  fehler?: string;
}

export interface Werkzeug {
  name: string;
  /** Für das Modell: WAS es tut und WANN es zu benutzen ist. */
  beschreibung: string;
  stufe: Stufe;
  /** In welchen Lagen es dem Modell überhaupt angeboten wird. */
  lagen: Kundenlage[] | "alle";
  parameter: Record<string, unknown>;
  ausfuehren: (p: any, k: WerkzeugKontext) => Promise<WerkzeugErgebnis>;
}

// ── Hilfen ────────────────────────────────────────────────────────────────

/** Jede Handlung landet in der Akte UND an der Postmeister-Zeile. */
/** Der Name des Kunden, wie er im Titel einer Aufgabe stehen soll (05.09.2026). */
async function kundenNameFuer(personId: number | null, ref: string | null): Promise<string | null> {
  try {
    if (personId) {
      const [p] = (await sqlPool`SELECT first_name, last_name, company_name FROM fiaon_persons WHERE id = ${personId} LIMIT 1`) as any[];
      const n = [p?.first_name, p?.last_name].filter(Boolean).join(" ").trim() || String(p?.company_name || "").trim();
      if (n) return n;
    }
    if (ref) {
      const [a] = (await sqlPool`SELECT first_name, last_name FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
      const n = [a?.first_name, a?.last_name].filter(Boolean).join(" ").trim();
      if (n) return n;
    }
  } catch { /* ohne Namen weiter */ }
  return null;
}

/**
 * Die Referenz, unter der ein Vermerk in der Akte steht (24.09.2026, E-240).
 * `fiaon_contact_log.ref` ist NOT NULL — ohne Bestellung im Vorgang ging jede
 * Handlung Maras bisher still verloren. Jetzt: die Bestellung des Vorgangs,
 * sonst die jüngste der Person (bezahlte zuerst), ohne Person gar nichts.
 */
export async function akteRef(personId: number | null, ref: string | null): Promise<string | null> {
  if (ref) return ref;
  if (!personId) return null;
  const [b] = (await sqlPool`
    SELECT ref FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
  `.catch(() => [])) as any[];
  return b?.ref ?? null;
}

async function protokoll(k: WerkzeugKontext, werkzeug: string, text: string, sichtbar = true): Promise<void> {
  const ref = sichtbar ? await akteRef(k.personId, k.ref) : null;
  if (ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${k.personId ?? null}, NULL, 'Postmeister', 'system', ${text.slice(0, 900)})
    `.catch(() => {});
  }
  if (k.postmeisterId) {
    await sqlPool`
      UPDATE fiaon_postmeister
         SET handlungen = COALESCE(handlungen, '[]'::jsonb) || ${JSON.stringify([{ werkzeug, ergebnis: text.slice(0, 300), am: new Date().toISOString() }])}::jsonb,
             updated_at = NOW()
       WHERE id = ${k.postmeisterId}
    `.catch(() => {});
  }
}

/**
 * Hat ein früherer Anlauf zu DIESER Mail das Werkzeug schon ausgeführt? (E-246)
 * protokoll() schreibt jede Handlung an die Postmeister-Zeile; legt die KI-Pause
 * eine Mail mitten im Lauf zurück (oder scheitert ein Anlauf), bleiben sie dort
 * stehen. Liefert den Ergebnistext des früheren Laufs oder null.
 */
async function frueherInDieserMail(k: WerkzeugKontext, werkzeug: string): Promise<string | null> {
  if (!k.postmeisterId) return null;
  const [z] = (await sqlPool`SELECT handlungen FROM fiaon_postmeister WHERE id = ${k.postmeisterId}`.catch(() => [])) as any[];
  // Jede Form, die es gibt: jsonb-Text „[…]", Array aus solchen Texten (protokoll hängt Text an), echte Liste.
  const flach = (w: unknown, tiefe = 0): any[] => {
    if (w == null || tiefe > 4) return [];
    if (typeof w === "string") { try { return flach(JSON.parse(w), tiefe + 1); } catch { return []; } }
    if (Array.isArray(w)) return w.flatMap((x) => flach(x, tiefe + 1));
    return typeof w === "object" ? [w] : [];
  };
  const h = flach(z?.handlungen).find((x: any) => x && x.werkzeug === werkzeug && x.ok !== false);
  return h ? String(h.ergebnis ?? "") : null;
}

/**
 * DER ZUSTÄNDIGE MENSCH — dieselbe Ableitung wie für Aufträge.
 *
 * ── DER SCHADEN (04.09.2026, E-116) ─────────────────────────────────────
 * Hier stand eine eigene Abfrage: Betreuer der Person, sonst
 * `rolle IN ('vertriebsleitung', 'leitung', 'admin')`. Die ersten beiden
 * Rollen gibt es nicht — die Abfrage traf null Zeilen, und jede Notiz für
 * einen Kunden ohne Betreuer landete unsichtbar beim Betreiber
 * (zustaendig_art 'betreiber'; /agent/aufgaben liest nur 'agent'). Nach der
 * Korrektur der Namen blieb der zweite Fehler: ZWEI Ableitungen für dieselbe
 * Frage. Praxistest an der echten Datenbank: Kunde 12982 ohne Betreuer —
 * notiz_an_betreuer ging an Daniel (erster nach id), aufgabe_an_betreuer an
 * Florentine (wenigste offene Aufträge). Zwei Antworten auf eine Frage sind
 * die Fehlerklasse aus fiaon-zustaendigkeit.ts.
 *
 * ── JETZT ───────────────────────────────────────────────────────────────
 * `auftragEmpfaenger` (fiaon-betreiber-todo.ts, E-115) entscheidet für
 * Notiz, Eskalation UND Auftrag: der eingetragene Betreuer, sofern aktiv und
 * kein Testkonto — Besitz gewinnt, auch im Rückstand, denn Justins Auftrag im
 * Kopf dieser Datei („bitte anrufen, bevor ich es eskalieren lasse") meint
 * genau ihn (E-045). Ohne Betreuer die Rolle zur Lage über `zustaendigeRolle`
 * (Rückstand → Forderungsmanagement, sonst Vertriebsleitung, je mit der
 * kleinsten Last), sonst der Betreiber. Nie ein beliebiger Bonitätsmanager:
 * niemand besitzt einen Kunden vor dem Mandat, und eine Aufgabe ist keine
 * Zuteilung. Rollen-Literale prüft `scripts/pruef-rollen.ts`.
 */
async function zustaendig(personId: number | null): Promise<{ id: number | null; name: string; kundenName: string; vertretung?: boolean; board?: boolean; vt?: UebergabeVertretung | null; global?: boolean }> {
  // E-272 (02.10.2026): Ein Global-Kunde gehört nicht in den Privatvertrieb — Notiz und Aufgabe liegen beim
  // Betreiber, wie jede Aufgabe aus FIAON Global (fiaon-global-angebot.ts: anBetreiber). Justin zum Fall
  // Hildbrand: „nehme ihn bitte komplett aus den Workflows … Er soll Global bleiben.“
  if (personId && await istGlobalKunde(personId).catch(() => false)) {
    return { id: null, name: "Leitung (FIAON Global)", kundenName: "unsere Leitung", board: true, global: true };
  }
  // E-260 (29.09.2026): Team abwesend — Notiz und Eskalation gehen nicht an Abwesende,
  // und der Kunde liest den Namen dessen, der wirklich anruft.
  // Vertretung (01.10.2026): Ist der Vertreter ein echter Mitarbeiter, bekommt ER sie; ist er der
  // Betreiber, liegen sie auf dessen Board (wie E-260). Auch, wenn nicht der Kunde, aber der
  // abgeleitete Empfänger abwesend ist (uebergabeVertretungAbgeleitet).
  const vt = await uebergabeVertretungAbgeleitet(personId);
  if (vt) {
    const v = vt.ab.vertreter;
    // E-265: der Kunde liest die Nennform des Vertreters („Nikita Boychenko", mit Anrede „Herr Boychenko").
    return { id: vt.anVertreter ? v.id : null, name: `${v.vorname} (Vertretung)`, kundenName: v.anrufName, vertretung: true, board: !vt.anVertreter, vt };
  }
  const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
  const wer = await auftragEmpfaenger(personId);
  // `name` = intern (Vorname, „Postmeister an Nikita: …"); `kundenName` = was
  // der Kunde liest („Herr Stripling" oder „Daniel Stripling"), nie nur der Vorname.
  return wer.id
    ? { id: wer.id, name: String(wer.vorname || "").trim() || String(wer.name || "").trim() || "Leitung", kundenName: wer.kundenName || String(wer.name || "").trim() || "unsere Leitung" }
    : { id: null, name: "Leitung", kundenName: "unsere Leitung" };
}

// ── Die Werkzeuge ─────────────────────────────────────────────────────────

/**
 * NOTIZ AN DEN BETREUER — das Werkzeug, das Justin ausdrücklich verlangt hat.
 * Kein Kundenkontakt, keine Mail an den Kunden: eine Nachricht an den
 * Menschen, der diesen Kunden kennt, mit Ton und Dringlichkeit.
 */
export const notizAnBetreuer: Werkzeug = {
  name: "notiz_an_betreuer",
  // E-275 (02.10.2026, Justin: „Mara soll selbstständig arbeiten …“): Die Notiz ist STILL — der Kunde erfährt nichts
  // davon, und sie ersetzt keine Antwort. Unterlagen per Mail gehen seitdem hierüber (vorher Aufgabe + „Herr X prüft“).
  beschreibung: "Schreibt dem zuständigen Betreuer eine kurze, STILLE Nachricht in die Akte (der Kunde erfährt nichts davon). Für alles, was das Team wissen oder nachtragen muss, während DU dem Kunden selbst und vollständig antwortest: eingereichte Unterlagen oder Bilder per Mail (Ausweis, Kontoauszug, Auskunft, Screenshot), ein Hinweis zur Akte, ein Technik-Fehler, den du nicht lösen kannst. NICHT bei Ärger, Zahlungsverweigerung, Anwaltsdrohung, Kündigung oder angeblicher früherer Kündigung — das beantwortest du selbst (Vertrag, offene Rate, Zahlungsseite, Härte-Stufe). Dem Kunden schreibst du danach NIE „Herr X prüft das“ oder „meldet sich“ — du sagst, was du erledigt hast und wie es weitergeht. Schreib die Notiz so, wie du es einem Kollegen sagen würdest.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      text: { type: "string", description: "Die Nachricht an den Kollegen. Konkret, ein bis drei Sätze, mit dem Grund." },
      dringend: { type: "boolean", description: "true, wenn heute jemand handeln muss (Anwaltsdrohung, Beschwerde, drohende Eskalation)." },
      anrufen: { type: "boolean", description: "true, wenn ein Anruf nötig ist — dann wird ein Rückruf eingeplant." },
    },
    required: ["text", "dringend", "anrufen"],
  },
  async ausfuehren(p, k) {
    const wer = await zustaendig(k.personId);
    const text = String(p.text || "").trim().slice(0, 800);
    if (text.length < 10) return { ok: false, ergebnis: "", fehler: "Die Notiz ist zu kurz." };
    await protokoll(k, "notiz_an_betreuer", `Postmeister an ${wer.name}: ${text}`);
    // ── DIE NOTIZ ERREICHT DEN MENSCHEN (24.09.2026, E-240) ───────────────
    // Bis hierher ein nacktes INSERT in fiaon_betreiber_todos: keine Übergabe
    // (agent_gelesen_am, delegiert_am blieben leer), keine Mail an den
    // Betreuer, kein Ereignis in fiaon_agent_events — die Notiz stand nur da,
    // wenn jemand zufällig in seine Aufträge sah (392 von 404 Aufgaben
    // ungelesen). Jetzt derselbe Weg wie aufgabe_an_betreuer: auftragFuerKunden
    // übergibt, schreibt die Mail aufgabe_zugewiesen und das Ereignis, auf das
    // das Betreuer-Popup hört. Idempotent je Person und Tag wie vorher —
    // weitere Notizen hängen sich an und machen die Aufgabe wieder ungelesen.
    const heute = new Date().toISOString().slice(0, 10);
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: k.personId, ref: k.ref,
      titel: `${kundenName ? `${kundenName}: ` : ""}${p.dringend ? "braucht heute jemanden" : "Hinweis von Mara"}`.slice(0, 160),
      text, dringend: !!p.dringend,
      faelligAm: p.dringend ? heute : new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10),
      schluessel: `postmeister:${k.personId ?? k.ref ?? "unbekannt"}:${heute}`,
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null, anBetreiber: !!wer.board,
      link: k.personId ? `/agent/kunden?person=${k.personId}` : k.ref ? `/agent/kunden?ref=${k.ref}` : null,
    }).catch((e) => console.error("[POSTMEISTER] Notiz an Betreuer:", String(e).slice(0, 160)));
    // Vertretung (01.10.2026): Heikles beim Vertreter sieht der Betreiber zusätzlich auf seinem Board.
    if (wer.vt?.anVertreter && heikleUebergabe(text)) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: `${kundenName ? `${kundenName}: ` : ""}Hinweis von Mara`, text, dringend: true,
        schluessel: `postmeister:${k.personId ?? k.ref ?? "unbekannt"}:${heute}`, quelle: "postmeister",
        link: k.personId ? `/agent/kunden?person=${k.personId}` : k.ref ? `/agent/kunden?ref=${k.ref}` : null,
      }, wer.vt);
    }
    // E-272: Beim Global-Kunden kein Eintrag in die Rückruf-Liste des Vertriebs (sie geht an Betreuer oder
    // Vertriebsleitung) — die Aufgabe liegt beim Betreiber, der ruft selbst an.
    if (p.anrufen && k.personId && !wer.global) {
      try {
        const { rueckrufAufnehmen } = await import("./fiaon-rueckruf");
        await rueckrufAufnehmen({
          personId: k.personId, quelle: "mail_inbound",
          quelleId: `postmeister-notiz-${k.postmeisterId ?? Date.now()}`,
          anliegen: text.slice(0, 300), kontakt: null,
        } as any);
      } catch { /* Rückruf ist ein Zusatz, kein Muss */ }
    }
    // E-275 (02.10.2026): ohne Anruf ist die Notiz still — das Ergebnis sagt es dem Modell, damit aus ihr kein
    // „Herr X ist informiert und kümmert sich“ in der Kundenmail wird (gemessen: 186 von 400 Antworten nannten einen Mitarbeiter).
    // E-531 (25.11.2026): auch mit Anruf kein „X ist informiert und ruft Sie an“ mehr — der Rückruf steht nur in der
    // Liste, keine Uhrzeit, niemand hat ihn zugesagt.
    return {
      ok: true,
      ergebnis: p.anrufen
        ? "Notiert, mit Rückrufwunsch (Rückrufliste des Teams, ohne Termin). Dem Kunden ohne Zeitangabe und ohne Namen: „Ihr Rückrufwunsch liegt jetzt bei unserem Team.“ Eine feste Zeit gibt es nur, wenn er selbst eine wählt (terminlink_bauen)."
        : "Intern notiert (still) — dem Kunden nicht erwähnen; beantworte sein Anliegen selbst und vollständig.",
      daten: { betreuer: wer.kundenName, betreuer_intern: wer.name, dringend: !!p.dringend, still: !p.anrufen },
    };
  },
};

/**
 * AUFGABE AN DEN BETREUER — 04.09.2026 (E-115). Eine Notiz ist ein Hinweis;
 * das hier ist ein Auftrag mit Titel, Frist und Mail an den Menschen. Justin:
 * „Mitarbeiter ein TODO bekommt … also dass Handlungen PASSIEREN."
 */
export const aufgabeAnBetreuer: Werkzeug = {
  name: "aufgabe_an_betreuer",
  // E-275 (02.10.2026, Justin: „MARA verweist immer mehr auf die Mitarbeiter … Mara soll selbstständig arbeiten“):
  // Unterlagen stehen hier nicht mehr (die gehen still über notiz_an_betreuer), und die Aufgabe ist kein Ersatz für
  // die Antwort. Gemessen 18.09.–02.10.: 115 Aufgaben, 28 davon nur wegen Unterlagen, 186 von 400 Antworten nannten
  // einen Mitarbeiter.
  beschreibung: "Legt einem Menschen eine echte Aufgabe mit Titel, Auftrag und Frist an (Portal unter Aufträge, dazu eine Mail an ihn). NUR in diesen Fällen: (1) der Kunde will AUSDRÜCKLICH einen Rückruf oder ein Gespräch (rueckruf_am, wenn er eine Zeit nennt), (2) Geld zurück, Erstattung, Widerruf nach Zahlung oder Kulanz (kollege Leitung), (3) ein Zahlungsbeleg oder eine Buchungsfrage (kollege Zahlung — nur sie sieht das Bankbuch), (4) eine Datenänderung oder Bescheinigung, für die du kein Werkzeug hast (Name, Geburtsdatum, Bankverbindung, Ausweisdaten — Anschrift, E-Mail-Adresse und Telefonnummer ändert der Server selbst, E-401, aber nur, wenn ein Block ANGABEN dasteht; steht keiner da, gibst du dafür wie bisher diese Aufgabe), (5) ein Technik-Fehler, den du nicht selbst lösen kannst, (6) E-531: du bist unsicher, ob etwas gilt oder was der echte Stand ist (Akte und FALL-AKTE passen nicht zusammen, eine Zusage ist unklar) — kollege Leitung. NIE für Unterlagen oder Bilder per Mail (dafür notiz_an_betreuer, still), nie für Karten-, Zahlungs-, Zugangs- oder Ablauffragen, nie um eine Zahlung, Kündigung oder Beschwerde „prüfen zu lassen“ — das erledigst du selbst. Die Aufgabe ersetzt nie deine Antwort: Du beantwortest trotzdem JETZT alles selbst. E-531: Eine Zeit („heute“, „morgen“) oder „X meldet sich“ schreibst du NIE — außer der Rückruf steht laut Ergebnis wirklich im Kalender, dann genau diesen Termin.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      titel: { type: "string", description: "Kurz wie eine Betreffzeile: was zu tun ist, mit Namen des Kunden. Beispiel: „Herrn Köhler zurückrufen — frühere Kündigung prüfen\"." },
      text: { type: "string", description: "Der Auftrag in zwei bis vier Sätzen: Lage, was der Kunde will, was zu tun ist, was du ihm zugesagt hast." },
      faellig_in_tagen: { type: "integer", description: "0 = heute, 1 = morgen, 2 = übermorgen. Höchstens 7." },
      dringend: { type: "boolean", description: "true, wenn heute jemand handeln muss (Anwaltsdrohung, Beschwerde, Kunde wartet auf Rückruf)." },
      kollege: { type: "string", description: "Nennt der Kunde einen Mitarbeiter mit Namen (etwa Frau Rifka oder Herr Stripling), dann dieser Name — die Aufgabe geht an ihn. \"Leitung\" für Entscheidungen über Geld zurück (Widerruf, Kulanz). \"Zahlung\" für Zahlungsbelege und Buchungsfragen (geht an die Zahlungsstelle, nicht an den Betreuer). Sonst leer." },
      rueckruf_am: { type: "string", description: "Nennt der Kunde eine Zeit für den Rückruf („heute 17 Uhr“, „morgen Vormittag“), dann hier als YYYY-MM-DD HH:MM (Berlin). Der Rückruf steht dann als Termin im Kalender des Mitarbeiters. Sonst leer." },
    },
    required: ["titel", "text", "faellig_in_tagen", "dringend", "kollege", "rueckruf_am"],
  },
  async ausfuehren(p, k) {
    const titel = String(p.titel || "").trim().slice(0, 160);
    const text = String(p.text || "").trim().slice(0, 2000);
    if (titel.length < 5 || text.length < 10) return { ok: false, ergebnis: "", fehler: "Titel oder Auftrag zu kurz." };
    const tage = Math.max(0, Math.min(7, Math.round(Number(p.faellig_in_tagen)) || 0));
    const faelligAm = new Date(Date.now() + tage * 864e5).toISOString().slice(0, 10);
    const { auftragFuerKunden, mitarbeiterNachName } = await import("../routes/fiaon-betreiber-todo");
    // Nennt der Kunde jemanden („Frau Rifka"), bekommt der die Aufgabe — nicht die Ableitung.
    // „Leitung" (05.09.2026): Geld-zurück-Entscheidungen gehen an einen
    // Vertriebsleiter mit offenem Zugang, nie an den Betreuer.
    const kollege = String(p.kollege || "");
    const leitungGewollt = /\b(leitung|chef|gesch[äa]ftsf[üu]hr\w*|management)\b/i.test(kollege);
    // „Zahlung" (05.09.2026, Florentine Punkt 5): Ein Zahlungsbeleg geht an
    // die Stelle, die das Bankbuch sieht (Forderungsmanagement), sonst an die
    // Leitung — nie an einen Betreuer, der die Zahlung gar nicht prüfen kann.
    const zahlungGewollt = /\b(zahlung|beleg|buchhaltung|inkasso|forderung|bankbuch)\b/i.test(kollege);
    const nachRolle = async (rollen: string[]) => {
      const [l] = (await sqlPool`
        SELECT id FROM fiaon_agents
         WHERE COALESCE(active, TRUE) = TRUE AND rolle = ANY(${rollen}) AND COALESCE(is_test_account, FALSE) = FALSE AND zugang_gesperrt_am IS NULL
         ORDER BY array_position(${rollen}::text[], rolle), id ASC LIMIT 1
      `.catch(() => [])) as any[];
      return l?.id ? { id: Number(l.id) } : null;
    };
    // E-272 (02.10.2026): Beim Global-Kunden geht die Aufgabe an den Betreiber (wie jede Aufgabe aus FIAON
    // Global, fiaon-global-angebot.ts: anBetreiber) — nie an die Vertriebsleitung oder einen Privat-Betreuer.
    // Nur wer ausdrücklich einen Mitarbeiter mit Namen nennt, bekommt ihn.
    const globalKunde = k.personId ? await istGlobalKunde(k.personId).catch(() => false) : false;
    const gewuenscht = globalKunde
      ? (!zahlungGewollt && !leitungGewollt && p.kollege ? await mitarbeiterNachName(kollege).catch(() => null) : null)
      : zahlungGewollt
      ? await nachRolle(["inkasso", "vertriebsleiter"])
      : leitungGewollt
        ? await nachRolle(["vertriebsleiter"])
        : p.kollege ? await mitarbeiterNachName(kollege).catch(() => null) : null;
    // ── DIE MAIL STEHT IN DER AUFGABE (Florentine Punkt 8) ────────────────
    // „Bei den Tasks sehen wir nicht, wann eine E-Mail geschrieben wurde und
    // von wem." Kopfzeile mit Datum, Absender, Betreff und Vorschau; die
    // Marke [Mail #id] öffnet die ganze Mail im Portal.
    let mailKopf = "";
    if (k.postmeisterId) {
      const [m] = (await sqlPool`
        SELECT von, betreff, empfangen_am, text FROM fiaon_postmeister WHERE id = ${k.postmeisterId} LIMIT 1
      `.catch(() => [])) as any[];
      if (m) {
        const wann = m.empfangen_am ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(m.empfangen_am)) : "";
        const vorschau = String(m.text || "").replace(/\s+/g, " ").trim().slice(0, 220);
        mailKopf = `E-Mail vom ${wann} von ${String(m.von || "").slice(0, 80)} · Betreff: „${String(m.betreff || "").slice(0, 100)}" [Mail #${k.postmeisterId}]\n„${vorschau}${vorschau.length >= 220 ? " …" : ""}"\n\n`;
      }
    }
    // ── DER KUNDE STEHT IM TITEL (05.09.2026, Florentine/Daniel) ──────────
    // „Manche Aufgaben sind ohne Namen — wer ist das?" Das Modell soll den Namen
    // nennen; tut es das nicht, setzt der Server ihn davor.
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    const titelMitName = kundenName && !titel.toLowerCase().includes((kundenName.toLowerCase().split(" ").pop() || "§"))
      ? `${kundenName}: ${titel}`.slice(0, 160) : titel;
    // ── ZAHLUNGEN PRÜFT NUR DIE ZAHLUNGSSTELLE (05.09.2026) ───────────────
    // Florentine: „Kunde schreibt, er habe am 20.08. bezahlt, und die KI sagt,
    // ich solle das kontrollieren." Kein Mitarbeiter sieht das Konto. Solche
    // Aufgaben bleiben bei Justin (Bankbuch); die Bestellung wird als „Zahlung
    // gemeldet" markiert, damit der Kontoabgleich sie kennt.
    let zahlungGemeldet = "";
    if (zahlungGewollt && k.ref) {
      const [o] = (await sqlPool`SELECT payment_status, status, current_step, submitted_at, type, ref, pack_key FROM fiaon_applications WHERE ref = ${k.ref} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
      // E-264: nur eine ABGESCHICKTE Bestellung kann „Zahlung gemeldet" werden — auf einen nie abgeschickten Antrag gibt es keine Rechnung.
      // E-272: beim Global-Kunden nur sein Global-Auftrag — sein Beleg gilt nie einem alten Privatantrag.
      if (o?.payment_status === "pending_payment" && antragAbgeschickt(o) && !(globalKunde && produktkategorie(o) !== "global")) {
        await sqlPool`UPDATE fiaon_applications SET payment_status = 'claimed_paid', claimed_paid_at = COALESCE(claimed_paid_at, NOW()), updated_at = NOW() WHERE ref = ${k.ref}`.catch(() => {});
        zahlungGemeldet = " Die Bestellung steht jetzt auf „Zahlung gemeldet\".";
      }
    }
    // ── E-260 (29.09.2026): TEAM ABWESEND ─────────────────────────────────
    // Ginge die Aufgabe an jemanden, der bis „bis" nicht da ist (Betreuer, die
    // Vertriebsleitung, ein genannter Kollege), liegt sie auf dem Board des
    // Betreibers; der Rückruf kommt in den Kalender des Vertreters, und der
    // Kunde liest dessen Namen. Zahlungsbelege gehen wie immer an die Zahlungsstelle.
    // Vertretung (01.10.2026): Ist der Vertreter ein echter Mitarbeiter, bekommt ER die Aufgabe (nicht das
    // Board); Heikles — und Entscheidungen der Leitung — sieht der Betreiber zusätzlich (betreiberKopie).
    const vtUeb = zahlungGewollt || (globalKunde && !gewuenscht) ? null
      : gewuenscht ? await uebergabeVertretung(k.personId, gewuenscht.id) : await uebergabeVertretungAbgeleitet(k.personId);
    const abw = vtUeb?.ab ?? null;
    const vtPerson = abw && k.personId ? await vertretungFuerPerson(k.personId).catch(() => null) : null;
    const zielAbwesend = !!vtUeb;
    const erg = await auftragFuerKunden({
      personId: k.personId, ref: k.ref, titel: titelMitName, text: mailKopf + text, faelligAm, dringend: !!p.dringend,
      // Eine Aufgabe je Kunde und Tag — drei gleiche Mails (Frau Weber, 25.08.)
      // ergaben drei Aufgaben. Der Text wird an die bestehende angehängt.
      // 07.09.2026 (Daniel, Feedback 5): EIN Auftrag je Kunde, nicht je Mail und Tag. Fünf Mails
      // desselben Menschen hängen sich als Beiträge an denselben Auftrag; erledigt → die nächste
      // Mail öffnet ihn wieder (auftragFuerKunden, ON CONFLICT schluessel).
      schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe`,
      quelle: "postmeister", autorName: "Mara",
      agentId: zahlungGewollt ? null : vtUeb ? (vtUeb.anVertreter ? vtUeb.ab.vertreter.id : null) : (gewuenscht?.id ?? null),
      // E-IT-F (Gegenprüfung 08.10.): Leitung oder vom Kunden genannt gilt auch gegen einen aktiven Betreuer,
      // der den Auftrag des Kunden schon hat — sonst landet die Beschwerde beim Betreuer, die Leitung erfährt nichts.
      vorrang: !zahlungGewollt && !vtUeb && !!gewuenscht?.id,
      anBetreiber: zahlungGewollt || (!!vtUeb && !vtUeb.anVertreter) || (globalKunde && !gewuenscht),
    });
    if (vtUeb?.anVertreter && (leitungGewollt || heikleUebergabe(`${titelMitName}\n${text}`))) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: titelMitName, text: mailKopf + text, dringend: true,
        schluessel: `postmeister:${k.personId ?? k.ref ?? k.postmeisterId ?? "x"}:aufgabe`, quelle: "postmeister",
      }, vtUeb);
    }
    const wer = zielAbwesend ? `${abw!.vertreter.vorname} (Vertretung bis ${bisText(abw!.bis)})` : erg.agentName ?? "die Leitung";
    // E-265: Nennform — nie der Vorname (erg.kundenName ist schon „Herr Stripling", E-117).
    const werKunde = zielAbwesend ? abw!.vertreter.anrufName : erg.kundenName ?? erg.agentName ?? "unsere Leitung";
    await protokoll(k, "aufgabe_an_betreuer", `Aufgabe für ${wer}: „${titelMitName}" (fällig ${faelligAm}).${zahlungGemeldet} ${text.slice(0, 300)}`);
    // ── RÜCKRUF ALS TERMIN IM KALENDER (Florentine Punkt 3) ───────────────
    // „Erkannte Rückrufwünsche automatisch als Termin in den Kalender des
    // zuständigen Mitarbeiters eintragen, verknüpft mit Kunde und Mail."
    let terminSatz = "";
    let gebuchtText: string | null = null;
    /** E-531: wer zum gebuchten Termin wirklich anruft (Nennform) — nur dann nennt das Ergebnis eine Person. */
    let terminPerson: string | null = null;
    const rueckrufAm = String(p.rueckruf_am || "").trim();
    // ── E-248: KEIN ZWEITER TERMIN, KEINE ZEIT IN DER VERGANGENHEIT ───────
    // Steht schon ein gebuchter Termin, wird keiner dazugebucht (Fall K. auf
    // WhatsApp: der Kunde hatte selbst gebucht) — Mara nennt den bestehenden, so
    // wie ein Mensch es sagt („morgen um 20 Uhr"). Eine Zeit ohne Vorlauf
    // (weniger als 20 Minuten, wie auf WhatsApp) wird nicht gebucht.
    const bestehend = rueckrufAm && k.personId ? await bestehenderTermin(k.personId) : null;
    const wunschZeit = rueckrufAm ? berlinZeitLesen(rueckrufAm) : null;
    // E-406 B3 / E-409: Ampel „Rückruf eintragen“ (rueckruf_eintragen, KI-Team › Werkzeuge) auf Rot — kein Termin im
    // Kalender; die Aufgabe bleibt (der Betreuer ruft an und macht die Zeit fest). Vorgabe grün = wie bisher.
    // Lesefehler: die Ampel meldet die strengste Stufe (rot) — dann lieber kein Termin als einer ohne Erlaubnis.
    const terminRot = !!rueckrufAm && !bestehend ? await import("./fiaon-ki-ampel").then((m) => m.ampelRot("rueckruf_eintragen")).catch(() => true) : false;
    if (bestehend) {
      terminSatz = ` Es steht schon ein Termin: ${bestehend.vorname ? `${bestehend.vorname} ruft Sie ` : ""}${bestehend.kundenText}${bestehend.vorname ? " an" : ""}. Kein zweiter wurde eingetragen.`;
    } else if (terminRot) {
      // E-531: kein „der Betreuer meldet sich“ mehr als Vorlage für die Kundenmail.
      terminSatz = " (Termine trägt gerade die Geschäftsführung selbst ein — KEIN Termin eingetragen; nenne dem Kunden keine Uhrzeit und niemanden, der sich meldet. Biete ihm an, selbst eine Zeit zu wählen: terminlink_bauen.)";
    } else if (rueckrufAm && (!wunschZeit || wunschZeit.getTime() < Date.now() + 20 * 60_000)) {
      terminSatz = ` (Rückruf-Zeit ${rueckrufAm} liegt nicht mindestens 20 Minuten in der Zukunft oder ist unlesbar — kein Termin eingetragen; nenne dem Kunden keine Uhrzeit.)`;
    } else if (rueckrufAm && k.personId && zielAbwesend && wunschZeit && wunschZeit.getTime() < abw!.bis.getTime()) {
      // E-260: in den Kalender des Vertreters — auf seinen nächsten freien Platz im Raster (höchstens
      // 10 Minuten früher, 20 später, wie auf WhatsApp). Kein Platz: keine Uhrzeit zusagen.
      try {
        const t = wunschZeit.getTime();
        const platz = (await freiePlaetzeVertreter(abw!, 20))
          .map((s) => ({ s, d: new Date(s.beginn).getTime() - t }))
          .filter((x) => x.d >= -10 * 60_000 && x.d <= 20 * 60_000)
          .sort((a, b) => Math.abs(a.d) - Math.abs(b.d) || b.d - a.d)[0]?.s ?? null;
        if (!platz) {
          // E-531: ohne Termin keine Person und keine Zeit für den Kunden.
          terminSatz = ` (Zur Wunschzeit ${rueckrufAm} ist niemand frei — kein Termin eingetragen; nenne dem Kunden keine Uhrzeit und niemanden, der sich meldet. Biete ihm an, selbst eine Zeit zu wählen: terminlink_bauen.)`;
        } else {
          const { terminBuchen } = await import("./fiaon-termine");
          const b = await terminBuchen({ personId: k.personId, agentId: abw!.vertreter.id, beginn: platz.beginn, quelle: "agent_manuell", herkunft: "mara_mail" });
          // E-265: die Notiz nennt beide in der Nennform („in Abwesenheit von Herrn Stripling, bei Nikita Boychenko").
          const fuer = vtPerson?.betreuer?.nenn.dat ?? "dem Team";
          await sqlPool`UPDATE fiaon_termine SET notiz = ${`Rückrufwunsch aus E-Mail [Mail #${k.postmeisterId ?? "?"}] — in Abwesenheit von ${fuer}, bei ${abw!.vertreter.anrufDat}: ${text.slice(0, 300)}`}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
          const { buchungMelden } = await import("./fiaon-termin-meldung");
          await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
          gebuchtText = zeitFuerKunde(new Date(b.beginn));
          terminPerson = abw!.vertreter.anrufName;
          terminSatz = ` Der Rückruf steht im Kalender: ${gebuchtText}.`;
          await protokoll(k, "aufgabe_an_betreuer", `Rückruf-Termin ${b.datumText} ${b.uhrzeit} Uhr für ${abw!.vertreter.name} eingetragen (vertritt ${fuer} bis ${bisText(abw!.bis)}).`);
        }
      } catch (e: any) {
        terminSatz = ` (Rückruf-Termin konnte nicht eingetragen werden: ${String(e?.message || e).slice(0, 100)} — die Aufgabe steht trotzdem; nenne dem Kunden keine Uhrzeit.)`;
      }
    } else if (rueckrufAm && k.personId && (erg.agentId || (zielAbwesend && vtPerson?.betreuerBuchbar && vtPerson.betreuer))) {
      // Vertretung (01.10.2026, Gegenprüfung): Seit der Vertreter ein Mitarbeiter ist, trägt erg.agentId
      // IHN (die Aufgabe liegt bei ihm) — die Regel aus E-260 gilt trotzdem: Nach „bis" gehört der
      // Rückruf zum buchbaren Betreuer. Nur ohne buchbaren Betreuer bleibt er beim Aufgaben-Empfänger.
      const beimBetreuer = zielAbwesend && !!vtPerson?.betreuerBuchbar && !!vtPerson.betreuer;
      try {
        const { terminBuchen } = await import("./fiaon-termine");
        // E-260: Liegt die Wunschzeit nach „bis", ist der Betreuer wieder da — der Termin gehört zu ihm.
        const zielId = beimBetreuer ? vtPerson!.betreuer!.id : Number(erg.agentId);
        const b = await terminBuchen({ personId: k.personId, agentId: zielId, beginn: rueckrufAm, quelle: "agent_manuell", herkunft: "mara_mail" });
        await sqlPool`UPDATE fiaon_termine SET notiz = ${`Rückrufwunsch aus E-Mail [Mail #${k.postmeisterId ?? "?"}]: ${text.slice(0, 300)}`}, updated_at = NOW() WHERE id = ${b.id}`.catch(() => {});
        const { buchungMelden } = await import("./fiaon-termin-meldung");
        await buchungMelden(b.id, b.beginn, "agent_manuell").catch(() => {});
        // E-248: so, wie der Kunde es liest — „morgen um 20 Uhr", nie ISO.
        gebuchtText = zeitFuerKunde(new Date(b.beginn));
        terminPerson = beimBetreuer ? vtPerson!.betreuer!.nenn.nom : werKunde;
        // E-265: der Kunde liest die Nennform des Betreuers („Herr Stripling ruft an"), nie den Vornamen.
        terminSatz = beimBetreuer
          ? ` Der Rückruf steht im Kalender: ${gebuchtText} ruft ${vtPerson!.betreuer!.nenn.nom} an.`
          : ` Der Rückruf steht im Kalender: ${gebuchtText}.`;
        await protokoll(k, "aufgabe_an_betreuer", `Rückruf-Termin ${b.datumText} ${b.uhrzeit} Uhr für ${beimBetreuer ? vtPerson!.betreuer!.name : wer} eingetragen.`);
      } catch (e: any) {
        terminSatz = ` (Rückruf-Termin konnte nicht eingetragen werden: ${String(e?.message || e).slice(0, 100)} — die Aufgabe steht trotzdem; nenne dem Kunden keine Uhrzeit.)`;
      }
    }
    // ── E-275 (02.10.2026): „X MELDET SICH HEUTE“ NUR BEIM RÜCKRUF ───────────
    // Dieser Satz war das Ergebnis JEDER Aufgabe — und das Modell schrieb ihn wörtlich in die Kundenmail
    // („I have asked <Betreuer> to check this today“). Jetzt: Steht ein Rückruf (Wunschzeit,
    // bestehender Termin) oder geht es um Geld zurück, bleibt die Zusage; sonst ist die Aufgabe intern, und
    // das Ergebnis sagt dem Modell, dass es selbst antwortet. Der Satz beginnt weiter mit der Nennform.
    // ── E-531 (25.11.2026): KEINE ZEIT-ZUSAGE MEHR IM ERGEBNIS ─────────────────
    // Bis heute hieß es hier „<Name> meldet sich heute/morgen bei Ihnen.“ — das Modell übernahm den Satz wörtlich, und
    // gehalten wurde er fast nie (Audit 26.10.–24.11.). Jetzt: Steht der Rückruf WIRKLICH im Kalender, nennt das Ergebnis
    // genau diesen Termin (und wer anruft); steht schon einer, genau den. Sonst nur der Satz ohne Zeit und ohne Namen.
    const zusageNoetig = !!rueckrufAm || !!bestehend || leitungGewollt;
    const ergebnisText = !zusageNoetig
      ? `${werKunde} meldet sich nur, wenn noch etwas von Ihnen gebraucht wird — die Aufgabe ist intern. Erwähne sie nicht als „meldet sich“, sondern beantworte sein Anliegen selbst und vollständig.${terminSatz}`
      : gebuchtText
        ? `${terminPerson ?? werKunde} meldet sich zum eingetragenen Termin: ${gebuchtText}. Nenne ihm genau diesen Termin — keine andere Zeit.${terminSatz}`
        : bestehend
          ? `Nenne ihm genau den Termin, der schon im Kalender steht — keine andere Zeit, keinen zweiten Termin.${terminSatz}`
          : `Aufgabe angelegt. Dem Kunden schreibst du ohne Zeitangabe und ohne Namen, wer sich meldet: „${E531_UEBERGABE_SATZ}“${terminSatz}`;
    return {
      ok: true, ergebnis: ergebnisText,
      daten: {
        betreuer: werKunde, betreuer_intern: erg.agentName, aufgabe: titel, faellig: faelligAm, aufgabe_id: erg.id,
        rueckruf_termin: gebuchtText, bestehender_termin: bestehend ? bestehend.kundenText : null,
        // E-275: true = die Aufgabe ist intern — kein „meldet sich“ in der Kundenmail.
        intern: !zusageNoetig,
      },
    };
  },
};

/**
 * RECHNUNG ANHÄNGEN — 04.09.2026 (E-115). Bei einer offenen Zahlung hängt der
 * Lauf die Rechnung ohnehin an, sobald die Zahlungsseite verlinkt ist. Dieses
 * Werkzeug ist für den ausdrücklichen Wunsch: „Schicken Sie mir die Rechnung."
 */
export const rechnungAnhaengen: Werkzeug = {
  name: "rechnung_anhaengen",
  beschreibung: "Hängt die Rechnung zu einer Zahlungsreferenz als PDF an deine Antwort. Nutze es, wenn der Kunde eine Rechnung, einen Beleg oder eine Zahlungsaufforderung als Dokument verlangt — auch zu einer bereits bezahlten Rate. Bei einer offenen Zahlung wird die Rechnung automatisch angehängt, sobald du die Zahlungsseite verlinkst.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: { referenz: { type: "string", description: "Bestellung FIAON-XXXXXX oder Monatsrate FIAON-XXXXXX-N, genau wie in der Akte." } },
    required: ["referenz"],
  },
  async ausfuehren(p, k) {
    const ref = String(p.referenz || "").trim().toUpperCase();
    // E-230: auch das neue Format ohne Bindestrich (FIAONXXXXXX, FIAONXXXXXX-N).
    if (!/^FIAON-?[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Das ist keine Zahlungsreferenz." };
    // E-248: Auf Stopp, Widerruf, Beschwerde, Bestreiten … geht keine Rechnung mit —
    // außer der Kunde verlangt sie ausdrücklich (#5479: „Stopp" bekam Rechnung und Zahlknopf).
    if (k.ruhe && !kundeWillRechnung(k.kundeText)) {
      return { ok: false, ergebnis: "", fehler: `Diese Antwort ist keine Zahlungsaufforderung (${k.ruhe}) — keine Rechnung anhängen, sein Anliegen beantworten.` };
    }
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keine Rechnung." };
    // E-272: Beim Global-Kunden keine Rechnung einer Privatbestellung.
    const privatBeiGlobal = await privatReferenzBeiGlobal(k, z);
    if (privatBeiGlobal) return { ok: false, ergebnis: "", fehler: privatBeiGlobal };
    // E-248 (#5500): Ohne Betrag gibt es keine Rechnung — sonst „über null €".
    if (!(Number(z.amountDue) > 0)) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung ist noch kein Betrag hinterlegt — keine Rechnung und keinen Betrag nennen; der Betreuer trägt Paket und Betrag nach (aufgabe_an_betreuer)." };
    // E-264 (29.09.2026, Gegenlesen): derselbe Riegel wie in zahlungslink_bauen — ohne abgeschickten Antrag
    // gibt es keine Rechnung. Die Referenz kennt er trotzdem (Betreff der Zahlungserinnerung, Rückhol-Mail),
    // und „Interessent" darf automatisch antworten: „AW: … bitte schicken Sie mir die Rechnung" hätte ihm
    // eine Rechnung mit IBAN und Betrag für einen Vertrag gebracht, den es nicht gibt.
    if (z.art === "bestellung" && !(await bestellungAbgeschickt(String(z.paymentReference)))) {
      return { ok: false, ergebnis: "", fehler: "Sein Antrag ist nie abgeschickt — es gibt keine Rechnung. Keine Rechnung anhängen, keinen Betrag nennen; der Schritt ist sein Antrag (Knopf „antrag“)." };
    }
    if (k.postmeisterId) {
      const [r] = (await sqlPool`SELECT anhaenge FROM fiaon_postmeister WHERE id = ${k.postmeisterId}`) as any[];
      const da: any[] = Array.isArray(r?.anhaenge) ? r.anhaenge : [];
      if (!da.some((a) => a && a.art === "rechnung" && String(a.referenz).toUpperCase() === ref)) {
        da.push({ art: "rechnung", referenz: ref, quelle: "werkzeug" });
        await sqlPool`UPDATE fiaon_postmeister SET anhaenge = ${sqlPool.json(da)}, updated_at = NOW() WHERE id = ${k.postmeisterId}`.catch(() => {});
      }
    }
    await protokoll(k, "rechnung_anhaengen", `Rechnung ${ref} (${z.amountDue} €) wird als PDF angehängt.`, false);
    return { ok: true, ergebnis: `Die Rechnung zu ${ref} über ${z.amountDue} € wird als PDF angehängt.`, daten: { rechnung: ref, betrag: z.amountDue, rechnung_status: z.status } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE BONITÄTSAUSKUNFT ANBIETEN (24.09.2026, E-240)
//
// DER FALL: Doris Hösl (Person 4513) bekam die Unterlagen-Mail „Ihre
// Bonitätsauskunft liegt uns noch nicht vor … sonst antworten Sie kurz" und
// antwortete „Ich hab keine." Mara hatte kein Werkzeug, um die Auskunft zu
// verkaufen, die offene Rate schlug alles, und heraus kam „Sie können sie in
// Ihrem Bereich anfordern" — ein Mensch, der gerade Ja zu uns gesagt hätte,
// bekam den Weg ohne uns gezeigt. Justin: Die Auskunft soll „weggehen wie
// warme Semmeln".
//
// DAS WERKZEUG liefert den ECHTEN Knopf: Preis für genau diesen Menschen
// (auskunftStand/auskunftPreis entscheiden 74 € mit Paket / 149 € einzeln,
// Firma 199/349 €), Leistung und die Auskunfteien seines Landes. Mara nennt
// nur, was hier steht — kein erfundener Link, kein Preis aus dem Gedächtnis.
// Eine bezahlte, gemeldete oder hochgeladene Auskunft wird nicht noch einmal
// verkauft.
//
// ── ANBIETEN IST NICHT BESTELLEN (24.09.2026, E-240, Gegenlesen) ──────────
// Die erste Fassung rief hier auskunftBestellen: Jede Antwort Maras legte eine
// Bestellung an, vergab eine fortlaufende Rechnungsnummer, schickte die Mail
// payment_details und setzte die Zahlungserinnerungen in Gang — bevor der
// Kunde Ja gesagt hatte (Prüfstand: FIAON-INV-2026-00018 für ein bloßes
// Angebot). Eine Zahlungsaufforderung für eine nicht bestellte Leistung ist
// § 241a BGB / UWG Anhang Nr. 29, und ohne Knopf „zahlungspflichtig" und
// Widerrufsbelehrung fehlt die Button-Lösung (§ 312j Abs. 3 BGB).
// Jetzt: Ist nichts bestellt, führt der Knopf auf die signierte
// Bestätigungsseite (kaufLink, fiaon-auskunft-kauf.ts) — derselbe Weg wie
// Unterlagen-Mail und Verkaufstakt. Erst der Klick dort bestellt. Ist schon
// eine Bestellung offen, führt er zu ihrer Zahlungsseite; es entsteht nichts.
//
// DIE GRENZEN stehen im Code, nicht im Prompt: nur in den Lagen mit gebuchtem
// Paket (AUSKUNFT_LAGEN), nie bei Kündigung, Beschwerde, Bestreiten, „Stopp",
// Zahlungsunfähigkeit (KEIN_VERKAUF_FLAGS), nie bei Werbe- oder Vertriebssperre,
// nie bei FIAON Global (Wand unten). Das Angebot ist eine Antwort auf eine Mail
// des Kunden — keine Werbemail an Bestandskunden (§ 7 Abs. 3 UWG).
//
// DER BETREUER erfährt es sofort (auskunftBetreuerMelden): Aufgabe, Mail
// aufgabe_zugewiesen, Ereignis für das Popup — „bitte heute nachfassen".
// ═══════════════════════════════════════════════════════════════════════════

const LAMPE_TEXT: Partial<Record<keyof Flags, string>> = {
  kuendigung: "will kündigen", bestreitet: "bestreitet die Forderung", widerruf: "widerruft",
  beschwerde: "beschwert sich", rechtlich: "hat ein rechtliches Anliegen", stopp: "will keine Nachrichten mehr",
  droht_anwalt: "droht mit rechtlichen Schritten", zahlungsunfaehig: "sagt, er könne nicht zahlen",
};

// ═══════════════════════════════════════════════════════════════════════════
// ANTWORTET ER AUF DAS ANGEBOT — ODER FRAGT ER SELBST? (25.09.2026, E-241)
//
// Seit E-241 geht das Angebot (Mail auskunft_angebot, drei Fassungen) auch an
// offene Anträge und Leads. Deren Antwort ist ein „Re:"/„AW:" auf genau diese
// Betreffs. Die Betreffs stehen EINMAL in der Vorlage
// (server/mail/vorlagen/auskunft-verkauf.ts) — hier werden sie aus ihr gebaut
// (jede Fassung × privat/Firma × Land × Segment, ohne Vornamen), nicht
// abgeschrieben: Ändert jemand dort einen Betreff oder bekommt ein Segment einen
// eigenen, erkennt Mara die Antwort trotzdem.
//
// Bewusst NICHT antwortAufAngebot (fiaon-auskunft.ts): Das zählt auch die
// Unterlagen-Mail („Noch fehlende Unterlagen …") mit — für einen zahlenden
// Kunden ist das richtig (dort steht das Kaufangebot), für einen offenen Antrag
// nicht: Wer darauf seinen Ausweis schickt, hat nicht nach der Auskunft gefragt.
// ═══════════════════════════════════════════════════════════════════════════

export type AuskunftAntwort = "angebot" | "frage" | null;

const ANTWORT_PRAEFIX = /^\s*(?:re|aw|antw|sv)\s*(?:\[\d+\])?\s*:\s*/i;

function betreffNorm(s: unknown): string {
  let t = String(s ?? "").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 5; i++) {
    const n = t.replace(ANTWORT_PRAEFIX, "");
    if (n === t) break;
    t = n;
  }
  return t.toLowerCase().replace(/[„“”"'’‚‘]/g, "").trim();
}

let angebotsBetreffs: string[] | null = null;
/** Alle Betreffs der Angebots-Mail, ohne Vornamen, normalisiert. Einmal gebaut, dann gemerkt. */
export function auskunftAngebotsBetreffs(): string[] {
  if (angebotsBetreffs) return angebotsBetreffs;
  const alle = new Set<string>();
  for (const fassung of ANGEBOT_FASSUNGEN) {
    for (const art of ["privat", "firma"]) {
      for (const land of ["DE", "AT", "CH"]) {
        // 26.09.2026 (E-243): alle Segmente der Vorlage (neu: abbrecher) und beide Betreffzeilen je Stufe.
        for (const segment of ANGEBOT_SEGMENTE) {
          for (const mit_abo of [true, false]) {
            for (const betreff_variante of ANGEBOT_BETREFF_VARIANTEN) {
              try {
                const b = betreffNorm(auskunftAngebotBaustein({ fassung, art, land, segment, mit_abo, betreff_variante, vorname: null, nachname: null }).betreff);
                // Ein Betreff aus einem Wort erkennt jede zweite Mail — nur echte Sätze zählen.
                if (b.length >= 15) alle.add(b);
              } catch { /* eine Fassung, die ohne Daten nicht baut, zählt nicht */ }
            }
          }
        }
      }
    }
  }
  // E-365 (14.10.2026): Betreffzeilen, die die Vorlage vor der Bonitätsauswertung trug — Antworten auf ältere Angebote
  // („Re: … steht oft in Ihrer SCHUFA-Auskunft") bleiben Antworten auf das Angebot.
  for (const roh of ANGEBOT_FRUEHERE_BETREFFE) {
    const b = betreffNorm(roh);
    if (b.length >= 15) alle.add(b);
  }
  angebotsBetreffs = Array.from(alle);
  return angebotsBetreffs;
}

/** „AW: Doris, sehen Sie, was die Bank über Sie sieht" → true. Nur Antworten, keine Weiterleitungen. Rein. */
export function antwortAufAuskunftAngebot(betreff: unknown): boolean {
  const roh = String(betreff ?? "");
  if (!ANTWORT_PRAEFIX.test(roh)) return false;
  const b = betreffNorm(roh);
  return auskunftAngebotsBetreffs().some((v) => b.includes(v));
}

/**
 * Nur, was der Kunde SELBST geschrieben hat — ohne ein Zitat unserer Mails, das
 * ohneZitat (fiaon-postmeister-lauf.ts) nicht erkannt hat. Gemessen (Produktion,
 * nur lesend, 25.09.2026): In 8 von 51 Kundenmails mit „Auskunft" stand das Wort
 * nur im mitgeschickten Zitat — „bei der Prüfung Ihrer Unterlagen ist uns etwas
 * aufgefallen: Ihre Bonitätsauskunft …", „welcome@ fiaon.com : Bitte laden Sie die
 * SCHUFA-Auskunft …". Ein offener Antrag, der darauf nur seinen Ausweis schickt,
 * hat nicht nach der Auskunft gefragt. Rein.
 */
const ZITAT_BEGINN: RegExp[] = [
  /\bAm\s[^\n]{0,90}?\s(?:schrieb|wrote)\b/i,
  /\bschrieb\s+(?:am\b|FIAON|Mara|welcome)/i,
  /-{2,}\s*(?:Original|Ursprüngliche|Forwarded|Weitergeleitet)/i,
  /(?:^|\n)\s*(?:Von|From|Gesendet|Sent|An|To|Betreff|Subject)\s*:\s/i,
  /welcome@\s?fiaon\.com/i,
  /FIAON\s+Welcome/i,
  // Gegenlesen E-241: nur als Zeile (Signatur im Zitat) — „Hallo Mara Lindner, ja gerne" ist SEIN Text.
  // E-499: nur mit der Signatur dahinter — „Guten Abend ,⏎ Mara Lindner ,⏎ Ja , ich möchte … kündigen“ ist SEINE Anrede
  // (vorher schnitt diese Zeile seine ganze Erklärung weg, und Mara fragte ein zweites Mal).
  /\n[ \t>]*Mara\s+Lindner[ \t]*(?:\r?\n[ \t>]*)+(?:Digitale\s+Assistentin|FIAON\b|welcome@|support@)/i,
  /(?:^|\n)\s*>/,
  /ist\s+uns\s+etwas\s+aufgefallen/i,
];
export function kundenTeil(text: unknown): string {
  const t = String(text ?? "");
  let ende = t.length;
  for (const m of ZITAT_BEGINN) {
    const i = t.search(m);
    if (i >= 0 && i < ende) ende = i;
  }
  return t.slice(0, ende).trim();
}

/**
 * Antwortet diese Mail auf das Angebot der Auskunft — oder fragt der Kunde
 * selbst danach? Rein, für Lauf und Prüfstand.
 *   · „frage": er sagt, er habe keine (auskunft_fehlt, E-240), oder fragt nach
 *     der Auskunft selbst (fragtNachAuskunftSelbst) — im Text oder im Betreff
 *     einer neuen Mail.
 *   · „angebot": ein „Re:" auf die Angebots-Mail, das nicht ablehnt und sich
 *     auf das Angebot bezieht (Ja, Rückfrage, das Thema — Gegenlesen E-241).
 *   · null: ein Nein („Nein danke", „habe schon eine"), ein Widerspruch
 *     („Löschen Sie meine Daten"), eine Warnlampe (Kündigung, Beschwerde,
 *     „Stopp" …) oder schlicht ein anderes Anliegen.
 */
export function auskunftAntwortArt(ein: { betreff?: string | null; kundeText?: string | null; flags?: Partial<Flags> | null }): AuskunftAntwort {
  if (KEIN_VERKAUF_FLAGS.some((f) => !!ein.flags?.[f])) return null;
  // Nur sein eigener Text zählt — ein durchgerutschtes Zitat unserer Mail ist keine Frage.
  const text = kundenTeil(ein.kundeText);
  // Gegenlesen E-241: „Woher haben Sie meine Daten? Löschen Sie sie." ist ein Widerspruch —
  // nie ein Verkauf, auch nicht mit „habe keine Auskunft" im selben Satz.
  if (widersprichtWerbung(text)) return null;
  if (ein.flags?.auskunft_fehlt) return "frage";
  if (lehntAuskunftAb(text)) return null;
  // Gegenlesen E-241: Ein „AW:" allein ist noch keine Antwort AUF DAS ANGEBOT — wer auf die
  // Angebots-Mail „Wann bekomme ich meine Karte?" schreibt, bekommt die Karte, kein zweites
  // Angebot. Es zählt ein Ja, eine Rückfrage dazu oder das Thema selbst (bezogenAufAuskunftAngebot).
  if (antwortAufAuskunftAngebot(ein.betreff) && bezogenAufAuskunftAngebot(text)) return "angebot";
  const neueMail = !ANTWORT_PRAEFIX.test(String(ein.betreff ?? ""));
  if (fragtNachAuskunftSelbst(text) || (neueMail && fragtNachAuskunftSelbst(ein.betreff))) return "frage";
  return null;
}

/**
 * Welche Auskunft und welches Land für einen offenen Antrag oder Lead (Gegenlesen
 * 25.09.2026, E-241)? DIESELBE Grundmenge wie der Verkaufstakt (artFuerVerkauf,
 * fiaon-auskunft-verkauf.ts) — denn auf dessen Angebot antwortet er. Vorher:
 * Der Takt bot einem Business-Antrag die Firmen-Auskunft für 349 € an und einem
 * Lead mit österreichischer Nummer die „KSV1870-Auskunft"; auf sein „Ja bitte"
 * nannte Mara 149 € privat und „SCHUFA" — auskunftArtFuer kennt nur bezahlte
 * Pakete, auskunftStand das Land nur aus dem Antrag (ein Lead hat keinen).
 * `land: null` = das Land aus auskunftStand. Steht er in keinem Segment oder
 * scheitert die Abfrage: die alte Regel (auskunftArtFuer, Land aus dem Antrag).
 */
export async function auskunftArtLandVerkauf(personId: number): Promise<{ art: AuskunftArt; land: AuskunftLand | null }> {
  try {
    const { artFuerVerkauf } = await import("./fiaon-auskunft-verkauf");
    const v = await artFuerVerkauf(personId);
    if (v.segment) return { art: v.art, land: v.land };
  } catch (e) {
    console.warn("[POSTMEISTER] Art/Land der Auskunft (Grundmenge):", String((e as Error)?.message || e).slice(0, 160));
  }
  return { art: await auskunftArtFuer(personId), land: null };
}

/**
 * Wer bekommt die Aufgabe, wenn Mara einem offenen Antrag oder Lead die
 * Auskunft anbietet (E-241)? Die Regel des Hauses, in dieser Reihenfolge:
 *   1. sein Betreuer (fiaon_persons.assigned_agent_id — aktiv, kein Testkonto, nicht gesperrt),
 *   2. wer seinen Lead aus der Kartei übernommen hat (fiaon_leads.assigned_agent_id —
 *      die bekannte Falle: der Lead-Betreuer steht nicht immer an der Person),
 *   3. sonst die Ableitung jeder Mara-Aufgabe (auftragEmpfaenger: Vertriebsleitung
 *      mit der kleinsten Last).
 * Findet sich niemand: null — dann KEINE Aufgabe (nicht beim Betreiber abladen).
 * Eine automatische Lead-Zuteilung gibt es seit der offenen Kartei nicht mehr
 * (distributeUnassignedLeads ist ein Leerlauf, sofortZuteilen schließt Stufe 3 aus);
 * hier wird auch niemandem ein Lead ZUGETEILT — nur die Aufgabe adressiert.
 */
export async function auskunftAufgabeAn(personId: number): Promise<{ agentId: number; name: string | null; weg: "betreuer" | "lead" | "leitung" } | null> {
  const [z] = (await sqlPool`
    SELECT pa.id AS p_id, pa.name AS p_name, la.id AS l_id, la.name AS l_name
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents pa ON pa.id = p.assigned_agent_id
             AND COALESCE(pa.active, TRUE) AND NOT COALESCE(pa.is_test_account, FALSE) AND pa.zugang_gesperrt_am IS NULL
      LEFT JOIN LATERAL (
        SELECT a.id, a.name FROM fiaon_leads l JOIN fiaon_agents a ON a.id = l.assigned_agent_id
         WHERE l.person_id = p.id
           AND COALESCE(a.active, TRUE) AND NOT COALESCE(a.is_test_account, FALSE) AND a.zugang_gesperrt_am IS NULL
         ORDER BY l.erstellt_am DESC LIMIT 1
      ) la ON TRUE
     WHERE p.id = ${personId} LIMIT 1
  `.catch(() => [])) as any[];
  if (z?.p_id) return { agentId: Number(z.p_id), name: z.p_name ?? null, weg: "betreuer" };
  if (z?.l_id) return { agentId: Number(z.l_id), name: z.l_name ?? null, weg: "lead" };
  try {
    const { auftragEmpfaenger } = await import("../routes/fiaon-betreiber-todo");
    const wer = await auftragEmpfaenger(personId);
    return wer?.id ? { agentId: Number(wer.id), name: wer.name ?? null, weg: "leitung" } : null;
  } catch {
    return null;
  }
}

/** Darf Mara in diesem Vorgang die Auskunft verkaufen? `null` = ja, sonst der Satz für das Modell. Rein. */
export function auskunftVerkaufGesperrt(k: Pick<WerkzeugKontext, "kundenlage" | "flags"> & Partial<Pick<WerkzeugKontext, "auskunftAntwort">>): string | null {
  if (!auskunftLageErlaubt(k.kundenlage, !!k.auskunftAntwort)) {
    // E-241: Bei einem offenen Antrag oder einem Lead nur als Antwort — ungefragt nie.
    if (AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage)) {
      return `In der Lage „${k.kundenlage}" wird die Bonitätsauskunft nur angeboten, wenn der Kunde auf unser Angebot antwortet oder selbst danach fragt — hier tut er keins von beiden. Biete sie nicht an und nenne keinen Preis; beantworte sein Anliegen.`;
    }
    return `In der Lage „${k.kundenlage}" wird die Bonitätsauskunft nicht angeboten (nur mit gebuchtem Paket und laufendem Vertrag). Beantworte das Anliegen des Kunden.`;
  }
  const lampen = KEIN_VERKAUF_FLAGS.filter((f) => !!k.flags?.[f]);
  if (lampen.length) {
    return `Jetzt nichts verkaufen — der Kunde ${lampen.map((f) => LAMPE_TEXT[f] ?? f).join(" und ")}. Beantworte sein Anliegen, ohne Angebot.`;
  }
  return null;
}

/**
 * DEN BETREUER INFORMIEREN — Aufgabe über auftragFuerKunden (Übergabe, Mail
 * aufgabe_zugewiesen, fiaon_agent_events), eine je Kunde (Schlüssel
 * postmeister:auskunft:<person>): Ein zweites Angebot hängt sich an und macht
 * die Aufgabe wieder ungelesen (agent_gelesen_am = NULL) — darauf hört das Popup.
 *
 * Werblich (Stufe nichts/offen) nur ohne Sperre und ohne Warnlampe; ein
 * Service-Fall (bezahlt, Dokument da, der Kunde sagt trotzdem „habe keine")
 * geht immer an den Betreuer — dort fehlt etwas in der Lieferung.
 */
export async function auskunftBetreuerMelden(k: WerkzeugKontext, ein: {
  angeboten: boolean;
  /** „gemeldet" = der Kunde hat die Zahlung für die Auskunft gemeldet, das Geld ist nicht da. */
  stufe: "bezahlt" | "offen" | "dokument" | "nichts" | "gemeldet" | "inklusive" | "auswertung";
  betragText?: string | null;
  mitAbo?: boolean;
  verwendungszweck?: string | null;
  bezahltRef?: string | null;
  anlass?: string | null;
}): Promise<{ ok: boolean; grund?: string; aufgabeId?: number | null; betreuer?: string | null }> {
  if (!k.personId) return { ok: false, grund: "ohne Person" };
  if (k.auskunftGemeldet) return { ok: false, grund: "in dieser Mail schon gemeldet" };
  if (k.kundenlage === "fremd" || k.kundenlage === "unklar") return { ok: false, grund: `Lage ${k.kundenlage}` };
  // E-272 (02.10.2026): FIAON Global ZUERST — an der Bestellung UND an der Person (istGlobalVorgang).
  // Vorher stand die Prüfung hinter Lage, Warnlampe und Werbe-/Vertriebssperre und kannte nur die
  // Bestellung des Vorgangs: Ein Global-Kunde mit altem Privatantrag als Vorgang und ohne Sperre bekam
  // eine Auskunft-Aufgabe für den Privatvertrieb („bitte heute nachfassen, Karte/Limit“). Bei Hildbrand
  // hielt nur die Vertriebssperre von Hand, die heute früh gesetzt wurde.
  if (await istGlobalVorgang(k)) return { ok: false, grund: "FIAON Global" };
  const service = ein.stufe === "bezahlt" || ein.stufe === "dokument" || ein.stufe === "gemeldet" || ein.stufe === "inklusive" || ein.stufe === "auswertung";
  // Erste Zahlung fürs Paket fehlt noch: Kaufen kann er die Auskunft erst danach
  // (angebotLage, Kaufseite) — der Betreuer soll nicht zuerst die Auskunft verkaufen.
  const paketOffen = ["interessent", "unbezahlt", "zahlung_gemeldet"].includes(k.kundenlage);
  if (!service) {
    if (["gesperrt", "gekuendigt", "bestreitet"].includes(k.kundenlage)) return { ok: false, grund: `Lage ${k.kundenlage}` };
    if (KEIN_VERKAUF_FLAGS.some((f) => !!k.flags?.[f])) return { ok: false, grund: "Warnlampe" };
    const [p] = (await sqlPool`SELECT werbung_gesperrt_am, is_blocked FROM fiaon_persons WHERE id = ${k.personId} LIMIT 1`.catch(() => [])) as any[];
    if (p?.werbung_gesperrt_am || p?.is_blocked) return { ok: false, grund: "Werbe- oder Vertriebssperre" };
  }

  // ── E-241: ANGEBOT AN EINEN OFFENEN ANTRAG ODER LEAD ─────────────────────
  // Die Aufgabe geht nach der Regel des Hauses (auskunftAufgabeAn): Betreuer,
  // sonst wer den Lead übernommen hat, sonst die Vertriebsleitung mit der
  // kleinsten Last — findet sich niemand, gibt es keine Aufgabe.
  const alsAntwort = ein.angeboten && AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage);
  let agentId: number | null = null;
  if (alsAntwort) {
    const an = await auskunftAufgabeAn(k.personId);
    if (!an) return { ok: false, grund: "niemand zuständig (kein Betreuer, keine Vertriebsleitung) — keine Aufgabe" };
    agentId = an.agentId;
  }

  const name = (await kundenNameFuer(k.personId, k.ref)) ?? "Kunde";
  // E-365 (14.10.2026): privat heißt das Produkt FIAON-Bonitätsauswertung.
  const titel = alsAntwort
    ? `Mara hat ${name} die Bonitätsauswertung angeboten (${k.kundenlage === "unbezahlt" ? "Antrag offen" : "Interessent"}) — bitte heute nachfassen`
    : ein.angeboten
    ? `Mara hat ${name} die Bonitätsauswertung angeboten — bitte heute nachfassen (Karte/Limit)`
    : ein.stufe === "inklusive"
      ? `${name}: Bonitätsauswertung im Paket enthalten — bitte Ausweis und Kontoauszüge einholen`
      : service
      ? `${name} schreibt, die Bonitätsauskunft/-auswertung fehle — bitte heute klären`
      : paketOffen
        ? `${name} hat keine Bonitätsauswertung — erste Zahlung fehlt noch, bitte nachfassen`
        : `${name} hat keine Bonitätsauswertung — bitte heute nachfassen (Karte/Limit)`;
  const zitat = String(k.kundeText || "").replace(/\s+/g, " ").trim().slice(0, 220);
  const zeilen = [
    zitat ? `Kunde schrieb${k.postmeisterId ? ` [Mail #${k.postmeisterId}]` : ""}: „${zitat}${zitat.length >= 220 ? " …" : ""}"` : "",
    ein.anlass ? `Anlass: ${String(ein.anlass).slice(0, 200)}` : "",
    alsAntwort
      ? `${k.auskunftAntwort === "angebot" ? "Er hat auf unser Angebot der Bonitätsauswertung geantwortet" : "Er hat selbst nach seiner Bonität/Auskunft gefragt"} — ${k.kundenlage === "unbezahlt" ? "sein Antrag liegt vor, die erste Zahlung fürs Paket ist noch offen" : "er hat noch keinen Antrag"}.`
      : "",
    ein.angeboten
      ? ein.verwendungszweck
        ? `Die Bonitätsauswertung ist schon beauftragt, die Zahlung über ${ein.betragText ?? "?"} fehlt noch (Verwendungszweck ${ein.verwendungszweck}) — Mara hat den Weg zur Zahlungsseite geschickt.`
        : `Mara hat die Bonitätsauswertung für ${ein.betragText ?? "?"}${ein.mitAbo ? " (Kundenpreis mit Paket)" : " (einzeln)"} angeboten; der Kauflink steht in ihrer Antwort. Beauftragt ist sie erst, wenn der Kunde auf der Bestätigungsseite zahlungspflichtig klickt.`
      : ein.stufe === "bezahlt"
        ? `Laut Akte ist die Bonitätsauswertung bezahlt${ein.bezahltRef ? ` (${ein.bezahltRef})` : ""} — bitte prüfen, ob Ausweis und Kontoauszüge vorliegen und wo die Auswertung steht, und dem Kunden Bescheid geben.`
        : ein.stufe === "gemeldet"
          ? "Der Kunde hat die Zahlung für die Bonitätsauswertung gemeldet, das Geld ist noch nicht gebucht — bitte mit der Zahlungsstelle klären und dem Kunden Bescheid geben."
          : ein.stufe === "inklusive"
            ? "Die Bonitätsauswertung ist in seinem Paket enthalten (sein Kartenlink wartet auf sie) — nichts verkaufen. Bitte Ausweis und Kontoauszüge der letzten drei Monate einholen, damit das Team die Auswertung entwickeln kann."
            : ein.stufe === "auswertung"
              ? "Seine Bonitätsauswertung liegt freigegeben vor (fiaon.com/app/auswertung) — bitte mit ihm durchgehen."
              : ein.stufe === "dokument"
                ? "Laut Akte liegt schon ein Auskunft-Dokument vor — bitte klären, ob es aktuell und vollständig ist."
                : ein.stufe === "offen"
                  ? "Eine Bonitätsauswertung ist bestellt, aber noch nicht bezahlt — bitte im Gespräch den Zahlungsweg zeigen."
                  : paketOffen
                    ? "Die erste Zahlung für das Paket ist noch nicht gebucht — beauftragen kann er die Bonitätsauswertung erst danach. Bitte zuerst die Zahlung klären."
                    : "Mara konnte sie in dieser Lage nicht selbst anbieten — bitte im Gespräch anbieten.",
    alsAntwort
      ? k.kundenlage === "unbezahlt"
        ? "Bitte heute anrufen: die Bonitätsauswertung erklären (aus Ausweis und Kontoauszügen: Haushaltsrechnung, jede Einnahme und Ausgabe, Ampel, Finanzwert, Plan — keine Auskunft einer Auskunftei) und die erste Zahlung für sein Paket mitnehmen — keine Zusage zu Karte oder Limit, die Bank entscheidet."
        : "Bitte heute anrufen: die Bonitätsauswertung erklären (aus Ausweis und Kontoauszügen: Haushaltsrechnung, jede Einnahme und Ausgabe, Ampel, Finanzwert, Plan — keine Auskunft einer Auskunftei) und seinen Antrag mitnehmen — keine Zusage zu Karte oder Limit, die Bank entscheidet."
      : (ein.angeboten || !service) && !paketOffen
      ? "Bitte heute anrufen: die Bonitätsauswertung erklären (aus Ausweis und Kontoauszügen: Haushaltsrechnung, jede Einnahme und Ausgabe, Ampel, Finanzwert, Plan — keine Auskunft einer Auskunftei) und Karte und Wunschlimit besprechen — keine Zusage, die Bank entscheidet."
      : "",
  ].filter(Boolean);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const erg = await auftragFuerKunden({
    ...(agentId ? { agentId } : {}),
    personId: k.personId, ref: k.ref, titel: titel.slice(0, 160), text: zeilen.join("\n"),
    faelligAm: new Date().toISOString().slice(0, 10), dringend: false,
    schluessel: `postmeister:auskunft:${k.personId}`,
    quelle: "postmeister", autorName: "Mara",
    link: `/agent/kunden?person=${k.personId}`,
    anlageText: "Angelegt von Mara aus dem Postfach (Bonitätsauskunft).",
  });
  k.auskunftGemeldet = true;
  await protokoll(k, "auskunft_betreuer", `Betreuer informiert (${erg.agentName ?? "Leitung"}): ${titel}`);
  return { ok: true, aufgabeId: erg.id, betreuer: erg.agentName };
}

export const auskunftAnbieten: Werkzeug = {
  name: "auskunft_anbieten",
  // E-365 (14.10.2026): privat die FIAON-Bonitätsauswertung (aus Ausweis und Kontoauszügen) — nie bei „inklusive“ (im Paket
  // enthalten, Kartenlink wartet) und nie bei „auswertung“ (liegt vor); Firmen behalten die Firmen-Bonitätsauskunft.
  beschreibung: "Bietet dem Kunden die FIAON-Bonitätsauswertung an (privat: seine Bonität aus Sicht einer Bank, aus seinen eigenen Kontoauszügen; für ein Unternehmen die Firmen-Bonitätsauskunft) und liefert den ECHTEN Knopf dafür (Feld knopf): Preis für genau diesen Kunden (betragText — mit laufendem Paket der Kundenpreis, sonst einzeln), was er bekommt (leistung), was er dafür tut (unterlagen), wie das Produkt heißt (wort) und wohin der Knopf führt (weg). Das Werkzeug BESTELLT NICHTS: Ist noch nichts beauftragt, führt der Knopf auf die Bestätigungsseite, auf der der Kunde selbst zahlungspflichtig beauftragt; ist schon eine Bestellung offen, direkt zu ihrer Zahlungsseite. Rufe es, wenn der Kunde schreibt, er habe keine Auskunft, SCHUFA oder Datenkopie (auch knapp: „Ich hab keine.“, „nicht vorhanden“), wenn er nach Auskunft, Bonität, Einträgen, Limit oder Karte fragt, oder wenn die Akte unter auskunft die Stufe „nichts“ oder „dokument“ zeigt. Ist sie schon bezahlt, gemeldet, freigegeben oder IM PAKET ENTHALTEN, sagt es dir das (verkaufen: false, Feld satz) — dann verkaufst du nichts und nennst keinen Preis. Bei einem offenen Antrag oder einem Interessenten gibt es das Werkzeug nur, weil er auf unser Angebot antwortet oder selbst danach fragt — dann gilt der Einzelpreis, und das Feld hinweis sagt dir, was zu seinem Antrag in die Mail gehört. Den Betreuer informiert das Werkzeug selbst — dafür keine eigene Aufgabe anlegen.",
  stufe: "frei",
  // E-241: In AUSKUNFT_ANTWORT_LAGEN (unbezahlt, interessent) bietet werkzeugeFuerLage
  // es zusätzlich an — nur, wenn die Mail eine Antwort auf das Angebot ist oder er fragt.
  lagen: AUSKUNFT_LAGEN,
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      anlass: { type: "string", description: "In einem Satz, was der Kunde gesagt hat (z. B. „hat keine SCHUFA-Auskunft“, „fragt nach seiner Bonität“, „fragt nach seinem Kartenrahmen“) — steht in der Aufgabe für den Betreuer." },
    },
    required: ["anlass"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz gibt es kein Angebot — biete nichts an." };
    const sperre = auskunftVerkaufGesperrt(k);
    if (sperre) return { ok: false, ergebnis: "", fehler: sperre };
    const [person] = (await sqlPool`SELECT werbung_gesperrt_am, is_blocked FROM fiaon_persons WHERE id = ${k.personId} LIMIT 1`) as any[];
    if (person?.werbung_gesperrt_am || person?.is_blocked) {
      return { ok: false, ergebnis: "", fehler: "Für diesen Kunden gilt eine Werbe- oder Vertriebssperre — biete nichts an, beantworte nur sein Anliegen." };
    }
    const anlass = String(p.anlass || "").trim().slice(0, 200) || null;
    const { auskunftStand, standZumZeigen } = await import("./fiaon-auskunft");
    // E-241: Ein offener Antrag oder ein Lead, der auf das Angebot antwortet oder
    // selbst fragt (auskunftVerkaufGesperrt oben hat das geprüft), beauftragt zum
    // Einzelpreis — ohne Paket, mit Art und Land wie im Angebot des Takts
    // (auskunftArtLandVerkauf). „Zahlung gemeldet" wartet weiter auf die Buchung
    // (dann gilt der Kundenpreis).
    const alsAntwort = AUSKUNFT_ANTWORT_LAGEN.includes(k.kundenlage);
    const verkauf = alsAntwort ? await auskunftArtLandVerkauf(k.personId) : null;
    const art = verkauf?.art ?? await auskunftArtFuer(k.personId);
    // Integration 26.09.2026 (E-243): standZumZeigen — eine offene Bestellung, die auskunftBestellen nicht wiederverwenden würde (älter als 21 Tage, teurer als heute), zeigt keinen Zahlungslink, sondern den Kauf zum heutigen Preis.
    const stand = standZumZeigen(await auskunftStand(k.personId, sqlPool, art));
    const land = verkauf?.land ?? stand.land;
    // E-365: privat heißt das Produkt FIAON-Bonitätsauswertung — nicht „SCHUFA-Auskunft"; Firmen wie bisher.
    const privat = art === "privat";
    const produkt = privat ? AUSWERTUNG_NAME : "Firmen-Bonitätsauskunft";
    const basis = {
      wort: privat ? AUSWERTUNG_NAME : auskunftWort(land), auskunfteien: auskunfteienText(land), land, art,
      ...(privat ? { unterlagen: AUSWERTUNG_UNTERLAGEN_SATZ, ehrlich: AUSWERTUNG_KEINE_AUSKUNFT_SATZ } : {}),
    };

    const nichtVerkaufen = async (stufe: "bezahlt" | "dokument" | "gemeldet" | "inklusive" | "auswertung", bezahltRef: string | null): Promise<WerkzeugErgebnis> => {
      // Sagt der Kunde „habe keine", obwohl eine bezahlt, gemeldet oder da ist, fehlt
      // etwas in der Lieferung — das gehört zum Betreuer, nicht in ein Angebot.
      if (k.flags?.auskunft_fehlt) await auskunftBetreuerMelden(k, { angeboten: false, stufe, bezahltRef, anlass }).catch(() => null);
      // E-365: der Satz für den Kunden je Stand — Mara übernimmt ihn (Feld satz).
      const satz = stufe === "inklusive"
        ? `${AUSWERTUNG_INKLUSIVE_SATZ} Das geht in Ihrem Bereich unter fiaon.com/app/unterlagen.`
        : stufe === "auswertung"
          ? "Ihre FIAON-Bonitätsauswertung liegt vor — Sie haben sie als PDF per E-Mail bekommen und finden sie jederzeit in Ihrem Bereich unter fiaon.com/app/auswertung."
          : stufe === "bezahlt" && privat
            ? "Wir entwickeln Ihre FIAON-Bonitätsauswertung. Dafür brauchen wir Ihren Ausweis und Ihre Kontoauszüge der letzten drei Monate — den Link zum Hochladen haben Sie per E-Mail bekommen, oder Sie laden sie in Ihrem Bereich unter fiaon.com/app/unterlagen hoch."
            : null;
      return {
        ok: true,
        ergebnis: stufe === "inklusive"
          ? "Die FIAON-Bonitätsauswertung ist im Paket dieses Kunden ENTHALTEN (sein Kartenlink wartet auf sie) — nichts verkaufen, keinen Preis nennen. Sag ihm den Satz aus dem Feld satz und bitte ihn um Ausweis und Kontoauszüge der letzten drei Monate."
          : stufe === "auswertung"
            ? "Die FIAON-Bonitätsauswertung dieses Kunden liegt freigegeben vor — nichts verkaufen. Sag ihm, wo er sie findet (Feld satz), und dass seine Ansprechperson sie gern mit ihm durchgeht."
            : stufe === "bezahlt"
              ? privat
                ? "Die FIAON-Bonitätsauswertung ist bereits bezahlt — nicht noch einmal anbieten. Sag dem Kunden den Satz aus dem Feld satz: Wir entwickeln seine Auswertung, dafür brauchen wir Ausweis und Kontoauszüge."
                : "Die Firmen-Bonitätsauskunft ist bereits bezahlt — nicht noch einmal anbieten. Sag dem Kunden, dass FIAON sie für ihn einholt und sein Betreuer die Auswertung mit ihm durchgeht."
              : stufe === "gemeldet"
                ? `Der Kunde hat die Zahlung für die ${produkt} schon gemeldet — nicht noch einmal anbieten und nicht erneut zur Zahlung auffordern. Sag ihm, dass wir den Eingang prüfen und uns melden.`
                : "Eine Firmen-Auskunft liegt schon in der Akte — nichts verkaufen. Sag dem Kunden, dass sie vorliegt und in seine Auswertung einfließt; hat er eine neuere, lädt er sie in seinem Bereich hoch.",
        daten: { ...basis, stufe, verkaufen: false, knopf: null, zahlungsseite: null, ...(satz ? { satz } : {}) },
      };
    };
    if (stand.stufe === "bezahlt") return nichtVerkaufen("bezahlt", stand.bezahltRef);
    // E-365: privat nie verkaufen, wenn die Auswertung vorliegt oder im Paket enthalten ist (auskunftStand, server/lib/fiaon-auskunft.ts).
    if (privat && stand.stufe === "auswertung") return nichtVerkaufen("auswertung", null);
    if (privat && stand.stufe === "inklusive") return nichtVerkaufen("inklusive", null);
    if (stand.offen?.status === "claimed_paid") return nichtVerkaufen("gemeldet", null);
    // Wie die Unterlagen-Mail (auskunftMailTeil): Wer selbst eine hochgeladen hat,
    // bekommt weder ein Angebot noch eine Zahlungsbitte — auch bei offener Bestellung.
    // E-367 (15.10.2026): wieder auch privat — Kunden mit ausgewerteter SCHUFA empfanden das Angebot als „schon erledigt“.
    if (stand.dokumentDa) return nichtVerkaufen("dokument", null);

    const preisHinweis = (mitAbo: boolean) => mitAbo
      ? `Kundenpreis mit laufendem Paket (einzeln ${euroText(AUSKUNFT_PREISE_CENTS[art].einzeln)}) — beide Preise nebeneinander, nie „statt"`
      : "Einzelpreis (kein laufendes Paket)";
    let daten: Record<string, unknown>;
    if (stand.offen?.paymentReference) {
      // Schon beauftragt, Zahlung offen: der Weg zur Zahlung — nichts Neues entsteht.
      const zahlungsseite = absoluteUrl(`/zahlung/${encodeURIComponent(stand.offen.paymentReference)}`);
      const cents = stand.offen.betragCents || stand.preis.cents;
      daten = {
        ...basis, stufe: "offen", verkaufen: true,
        knopf: zahlungsseite, zahlungsseite,
        weg: `Die ${produkt} ist schon beauftragt — der Knopf führt direkt zur Zahlungsseite (Betrag, Bankdaten, Verwendungszweck, QR-Code).${privat ? " Nach dem Zahlungseingang lädt er Ausweis und Kontoauszüge hoch (Link per E-Mail), dann entwickeln wir seine Auswertung." : ""}`,
        betragText: euroText(cents),
        // „74.00" — die Belegprüfung vergleicht Beträge in Punktschreibweise.
        betrag: (cents / 100).toFixed(2),
        verwendungszweck: stand.offen.paymentReference,
        mitAbo: stand.preis.mitAbo, preis_hinweis: preisHinweis(stand.preis.mitAbo),
        // E-248: „Rahmen statt Limit" gilt für alle (shared/fiaon-mara-ton.ts, TON_REGELN „limit") —
        // der Nutzen-Satz ohne „Wunschlimit" auch für Kunden mit Paket (vorher E-241 nur für Antrag und Lead).
        leistung: auskunftLeistung(art, land), nutzen: AUSKUNFT_NUTZEN_SATZ_KARTE,
      };
    } else {
      // Neu: nur, wenn die Bestätigungsseite ihn auch beauftragen lässt — sonst
      // endete der Knopf auf „Erst die erste Zahlung für Ihr Paket" (angebotLage)
      // oder „Keine neue Beauftragung möglich" (Kündigung, E-213).
      const { angebotLage, kaufLink } = await import("../routes/fiaon-auskunft-kauf");
      // E-241: B und Lead ohne Paket-Prüfung (alsAntwort, oben).
      const lageA = alsAntwort ? null : await angebotLage(k.personId);
      if (lageA && !lageA.paketBezahlt) {
        return { ok: false, ergebnis: "", fehler: `Die erste Zahlung für das Paket ist noch nicht gebucht — biete die ${produkt} jetzt nicht an und nenne keinen Preis; fragt er, sag in einem Satz, dass nach der ersten Zahlung seine Bonitätsauswertung der nächste Schritt ist (Ausweis und Kontoauszüge hochladen).` };
      }
      // E-IT-B (08.10.2026): „gekündigt“ nach der EINEN Regel (shared/fiaon-kuendigung-regel.ts) — dazu die
      // gekündigte Auskunft selbst (ein Nein zu genau diesem Produkt).
      const [gek] = (await sqlPool`
        SELECT 1 AS ja WHERE ${sqlPool.unsafe(KUENDIGUNG_WIRKSAM_SQL(String(Number(k.personId))))}
           OR ${sqlPool.unsafe(AUSKUNFT_GEKUENDIGT_SQL(String(Number(k.personId))))}
      `) as any[];
      if (gek) return { ok: false, ergebnis: "", fehler: "Der Kunde hat gekündigt — keine neue Leistung anbieten. Beantworte nur sein Anliegen." };
      // Integration 25.09.2026 (E-240): die gemeinsame Bremse (zuletztAngeboten, fiaon-auskunft.ts).
      // Schreibt der Kunde selbst über die Auskunft („habe keine", SCHUFA, Bonität …) oder antwortet
      // er auf das Angebot bzw. die Unterlagen-Mail („Re: …"), ist der Link seine Antwort — dann gilt sie nicht. Sonst: Kam das Angebot in den letzten drei Tagen schon
      // (Angebots-Mail, Unterlagen-Mail, WhatsApp, Mara), wiederholt Mara es nicht ungefragt.
      // E-241: dazu jede Antwort auf die Angebots-Mail (auch die Betreffs der Segmente) und
      // jede eigene Frage nach der Auskunft (auskunftAntwort, vom Lauf gerechnet).
      if (!k.flags?.auskunft_fehlt && !kundeFragtNachAuskunft(k.kundeText) && !antwortAufAngebot(k.betreff)
        && !k.auskunftAntwort && !antwortAufAuskunftAngebot(k.betreff)) {
        const { zuletztAngeboten } = await import("./fiaon-auskunft");
        const zuletzt = await zuletztAngeboten(k.personId);
        if (zuletzt) {
          return { ok: false, ergebnis: "", fehler: `Die ${produkt} wurde ihm ${zuletzt.text} schon angeboten — biete sie in dieser Antwort nicht erneut an und nenne keinen Preis. Beantworte sein Anliegen; fragt er selbst danach, hilfst du weiter.` };
        }
      }
      daten = {
        ...basis, stufe: "nichts", verkaufen: true,
        knopf: kaufLink(k.personId, art), zahlungsseite: null,
        weg: "Der Knopf führt auf die Bestätigungsseite: Leistung, Preis, AGB und Widerrufsbelehrung — dort beauftragt der Kunde mit einem Klick zahlungspflichtig und sieht danach Betrag, Bankdaten und Verwendungszweck. Bis zu diesem Klick ist NICHTS bestellt: Schreib nie, er habe bestellt oder es sei eine Rechnung offen."
          + (privat ? " Nach der Bestellung bekommt er per E-Mail den Link, um Ausweis und Kontoauszüge hochzuladen — ohne Anmeldung." : ""),
        betragText: stand.preis.text,
        betrag: (stand.preis.cents / 100).toFixed(2),
        verwendungszweck: null,
        mitAbo: stand.preis.mitAbo, preis_hinweis: preisHinweis(stand.preis.mitAbo),
        // E-248: „Rahmen statt Limit" gilt für alle (shared/fiaon-mara-ton.ts, TON_REGELN „limit") —
        // der Nutzen-Satz ohne „Wunschlimit" auch für Kunden mit Paket (vorher E-241 nur für Antrag und Lead).
        leistung: auskunftLeistung(art, land), nutzen: AUSKUNFT_NUTZEN_SATZ_KARTE,
        // E-241: Was zu seinem Antrag in dieselbe Mail gehört — ein Satz, nicht mehr.
        ...(alsAntwort ? {
          hinweis: k.kundenlage === "unbezahlt"
            ? `Sein Paket ist noch nicht bezahlt: Die erste Zahlung nennst du in EINEM Satz mit Betrag und Verwendungszweck aus zahlungslink_bauen — die Rechnung hängt an. Der Knopf gehört der ${produkt}. Sie ist keine Voraussetzung für seinen Antrag.`
            : `Er hat noch keinen Antrag: Die ${produkt} ist ein eigener Auftrag und keine Voraussetzung für einen Antrag. Den Antrag erwähnst du höchstens in einem Satz; der Knopf gehört der ${produkt}.`,
        } : {}),
      };
    }
    const offen = daten.stufe === "offen";
    await protokoll(k, "auskunft_anbieten", offen
      ? `${produkt}: Zahlungsweg der offenen Bestellung geschickt (${daten.betragText}, Verwendungszweck ${daten.verwendungszweck}).`
      // Der Anfang (ANGEBOT_VERMERK) ist die Spur, an der die gemeinsame Bremse Maras Mail-Angebot erkennt.
      : `${ANGEBOT_VERMERK} (${daten.betragText}${daten.mitAbo ? ", Kundenpreis mit Paket" : ", einzeln"}${art === "firma" ? ", Firma" : ""}) — Kauflink zur Bestätigungsseite, noch nichts bestellt.`);
    const meldung = await auskunftBetreuerMelden(k, {
      angeboten: true, stufe: offen ? "offen" : "nichts", betragText: String(daten.betragText), mitAbo: !!daten.mitAbo,
      verwendungszweck: offen ? String(daten.verwendungszweck) : null, anlass,
    }).catch((e) => { console.error("[POSTMEISTER] Auskunft an Betreuer:", String(e).slice(0, 160)); return null; });
    return {
      ok: true,
      ergebnis: offen
        ? `Die ${produkt} ist schon beauftragt, offen sind ${daten.betragText} (Verwendungszweck ${daten.verwendungszweck}) — der Knopf führt zur Zahlungsseite.${meldung?.ok ? " Der Betreuer ist informiert." : ""}`
        : `Angebot ${produkt} für ${daten.betragText}${daten.mitAbo ? " (Kundenpreis mit Paket)" : ""}: Der Knopf führt auf die Bestätigungsseite, bestellt ist noch nichts.${meldung?.ok ? " Der Betreuer ist informiert." : ""}`,
      daten,
    };
  },
};

/**
 * KÜNDIGUNG VORMERKEN — nach Justins Regel: kulant entlassen, aber erst nach
 * Zahlung der gestellten Rechnung. Das Werkzeug setzt den Zustand; die
 * Bestätigungsmail kommt aus dem Kündigungsmodul, nicht aus der KI-Feder.
 */
export const kuendigungVormerken: Werkzeug = {
  name: "kuendigung_vormerken",
  // E-248: Die Beschreibung sagt nicht mehr „zwölf Monate" für alle — Verträge vor dem
  // 03.09.2026 sind monatlich und formlos kündbar (shared/fiaon-wissen.ts).
  beschreibung: "Nimmt eine Kündigung oder ein Storno entgegen und bucht es sofort — Urkunde und schriftliche Bestätigung verschickt das Haus selbst (E-213). Rufe es, sobald der Kunde klar sagt, dass er kündigen, stornieren, widerrufen oder nicht mehr weitermachen will — auch formlos, auch mit seinem Namen im Satz („Ich, Max Muster, kündige per sofort“), auch „bitte alles stornieren“. Nie bei Fragen („Wie kann ich kündigen?“) oder Überlegungen („ich überlege …“). Zitat = sein wörtlicher Satz. Eine unbezahlte Bestellung wird storniert (nichts offen). Bei einem laufenden Vertrag bleibt die bereits gestellte Rate zu zahlen; die Kündigung gilt trotzdem, unabhängig von der Zahlung (E-393). Auch wenn er schreibt, er habe schon früher gekündigt: aufrufen. Nie bei Verneinung („ich kündige nicht“), Bedingung („sonst kündige ich“, „bevor ich kündige“), fremden Verträgen (Handy, Bank) oder wenn jemand anderes kündigen will. Ein bloßes „Stopp“ ist KEINE Kündigung (dafür werbesperre_setzen). Lehnt das Werkzeug ab, ist NICHTS gebucht — dann bestätigst du keine Kündigung; nachfragen nur, wenn er selbst kündigen/stornieren geschrieben hat.",
  stufe: "frei",
  // „gesperrt" (05.09.2026): Ein gesperrter Kunde mit unbezahlter Bestellung
  // will meist nur raus — das Storno muss Mara selbst können.
  // E-264 (29.09.2026, Gegenlesen): auch „interessent" — seit heute steht dort, wer eine angefangene,
  // NIE abgeschickte Bestellung hat (vorher „unbezahlt"). „Bitte stornieren Sie das" konnte Mara sonst
  // nicht mehr buchen, und ihr „Ein kurzes Ja genügt" lief ins Leere. Ohne Bestellung lehnt das Werkzeug ab.
  lagen: ["interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "gesperrt"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      zitat: { type: "string", description: "Der wörtliche Satz des Kunden, der die Kündigung erklärt." },
      grund: { type: "string", description: "Der genannte Grund, in den Worten des Kunden. Leer, wenn keiner genannt wurde." },
    },
    required: ["zitat", "grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung kann keine Kündigung vorgemerkt werden." };
    const { istWillenserklaerung } = await import("./fiaon-kuendigung");
    const zitat = String(p.zitat || "");
    // E-248, Nachbesserung 28.09.: Es zählen NUR seine Worte. Das Zitat muss wörtlich
    // in SEINEM Teil der Mail stehen (k.kundeText = kundenTeil, ohne zitierten
    // Verlauf — sonst reichte unser eigener Mahnsatz „… können wir den Vertrag nicht
    // beenden"), und geprüft wird der ganze Satz, aus dem es stammt. Kein Rückgriff
    // mehr auf den ganzen Mailtext.
    const eigen = k.kundeText != null ? String(k.kundeText) : null;
    const pruefText = eigen == null ? zitat : saetzeZumZitat(zitat, eigen);
    const unbezahlt = k.kundenlage === "unbezahlt" || k.kundenlage === "interessent" || k.kundenlage === "gesperrt";
    // E-265 Nachbesserung 2 (01.10.2026, E-264): Bestreiten oder falsche Nummer IRGENDWO in seiner Mail — nie eine
    // Kündigung und nie ein Storno, auch mit Stornobitte daneben; die Leitung übernimmt.
    const bestritten = bestreitetKuendigung(eigen ?? zitat, abstreitenArt);
    if (bestritten) {
      return { ok: false, ergebnis: "", fehler: `Er bestreitet den Vertrag oder schreibt von einer falschen Nummer („${bestritten}") — NICHTS ist gebucht, und es wird nichts gebucht (E-264). Bestätige keine Kündigung und kein Storno; die Leitung übernimmt.` };
    }
    // E-499 (Mara 2.0): die Fußzeile seiner Mail-App und unser Zitat dahinter zählen nie als seine Worte.
    const kern = eigen != null ? eigenerKern(eigen) : null;
    let wille = !!pruefText && kuendigungsWille(pruefText, { unbezahlt, formlos: !!k.formlosKuendbar, istWillenserklaerung })
      // Nachbesserung 2: Eine Rücknahme irgendwo in seiner Mail („… ich nehme das zurück") — nie gebucht.
      && !(kern && kuendigungRuecknahme(kern));
    // E-499: der zweite Weg — er hat in SEINEN Worten ein Austrittswort geschrieben und kein Gegenfall trifft (austrittsWille).
    // Geprüft wird erst der Satz zum Zitat des Modells, sonst der Anfang seines eigenen Textes (dort steht, was er schreibt).
    let urteil = austrittsWille(pruefText || "", { unbezahlt });
    if (urteil.urteil !== "klar" && kern) urteil = austrittsWille(kern.slice(0, 700), { unbezahlt });
    if (!wille && urteil.urteil === "klar" && !(kern && austrittZurueckgenommen(kern, { unbezahlt }))) wille = true;
    // Eine Drohung oder Bedingung ohne klaren Satz daneben („… oder ich kündige jetzt“) ist nie eine Erklärung — auch nicht
    // nach der alten Liste (die „oder“ und „sollte“ nicht kannte).
    if (wille && urteil.urteil === "bedingt") wille = false;
    // Ein kurzes „Ja" auf UNSERE Rückfrage („Möchten Sie, dass ich Ihren Vertrag jetzt
    // kündige? Ein kurzes Ja genügt.") ist die Erklärung — sonst Kündigungsschleife.
    // E-396 Teil 2 (19.10.2026): auch auf die Rückfrage zu einem Formular-Antrag (formularRueckfrageSenden) — dann wird
    // DIESER Antrag gebucht, zum Tag seines Eingangs. Und das Ja zählt nur vom gespeicherten Absender (Justin: „eigener Absender“).
    let formularAntrag: import("./fiaon-kuendigung").OffenerAntrag | null = null;
    let schonGefragt = false;
    if (!wille && eigen && k.personId) {
      const [letzte] = (await sqlPool`
        SELECT antwort FROM fiaon_postmeister
         WHERE person_id = ${k.personId} AND antwort IS NOT NULL
           AND id <> ${k.postmeisterId ?? -1}
           AND created_at > NOW() - INTERVAL '21 days'
         ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
      // E-499: Die Rückfrage zählt in jedem Wortlaut (Mara formuliert frei) — und sein Ja auch nach einer Anrede
      // („Guten Abend, Mara Lindner, Ja …“). Vorher: fester Wortlaut, höchstens 90 Zeichen → die Schleife.
      schonGefragt = austrittsFrageGestellt(letzte?.antwort ?? null) || frageImZitat(k.zitiert);
      let ja = jaAufRueckfrage(eigen, letzte?.antwort ?? null) || (schonGefragt && bejahtAustritt(kern ?? eigen));
      if (!ja) {
        const { formularRueckfrageOffen, KUENDIGUNG_RUECKFRAGE } = await import("./fiaon-kuendigung-folgen");
        const antragNr = jaAufRueckfrage(eigen, KUENDIGUNG_RUECKFRAGE) ? await formularRueckfrageOffen(k.personId).catch(() => null) : null;
        if (antragNr != null) {
          const { offeneKuendigungsantraege } = await import("./fiaon-kuendigung");
          formularAntrag = (await offeneKuendigungsantraege(k.personId, antragNr).catch(() => []))[0] ?? null;
          ja = !!formularAntrag?.ziel.ziel;
        }
      }
      if (ja) {
        const { absenderGehoertZurPerson } = await import("./fiaon-postmeister-dossier");
        // E-531 (Abnahme Runde 3): dieselbe Absenderadresse wie absenderEcht und Gmail — die LETZTE „<…>“-Gruppe — und nur bei
        // genau EINEM Absender im Von-Kopf („"<kunde@x>" <fremd@y>“ ist fremd@y, nie der Kunde).
        const { absenderAdresse, absenderEindeutig } = await import("./fiaon-fall-akte");
        if (!absenderEindeutig(k.absender)
          || !(await absenderGehoertZurPerson(absenderAdresse(k.absender) || k.absender, k.personId).catch(() => false))) {
          return { ok: false, ergebnis: "", fehler: "Das „Ja“ kommt nicht von einer E-Mail-Adresse, die bei ihm gespeichert ist — NICHTS ist gebucht (E-396: nur vom eigenen Absender). Bestätige keine Kündigung. Bitte ihn in EINEM freundlichen Satz, kurz von seiner bei uns hinterlegten E-Mail-Adresse mit „Ja“ zu antworten." };
        }
        // E-401: Liegt Gmails Absender-Prüfung vor, muss sie die Adresse bestätigen — sonst könnte jeder mit einer
        // gefälschten Absenderzeile kündigen (dieselbe Prüfung wie bei angaben_aendern).
        if (k.absenderPruefung?.authErgebnis) {
          const { absenderEcht } = await import("@shared/fiaon-angaben-aendern");
          const echt = absenderEcht({ authErgebnis: k.absenderPruefung.authErgebnis, von: k.absender ?? null, antwortAn: k.absenderPruefung.antwortAn ?? null });
          if (!echt.echt) {
            return { ok: false, ergebnis: "", fehler: `Das „Ja“ trägt zwar seine gespeicherte Adresse, die Absender-Prüfung bestätigt sie aber nicht (${echt.grund}) — NICHTS ist gebucht. Bestätige keine Kündigung. Bitte ihn in EINEM freundlichen Satz, direkt aus seinem Postfach mit „Ja“ zu antworten.` };
          }
        }
        wille = true;
      }
    }
    if (!wille) {
      // E-499: nie zweimal fragen. Haben wir schon gefragt und er hat weder Ja noch ein Austrittswort geschrieben, beantwortet
      // Mara nur, was er schreibt — eine zweite Rückfrage gibt es nicht (der Server hängt dann auch keine an, kuendigungFrageSchon).
      if (schonGefragt) {
        return { ok: false, ergebnis: "", fehler: "NICHTS ist gebucht — und du hast ihn schon einmal gefragt, ob er kündigen möchte. Frag NICHT noch einmal. Beantworte nur, was er jetzt schreibt, freundlich und vollständig. Bestätige keine Kündigung.", daten: { kuendigung_frage_schon: true } };
      }
      if (urteil.urteil === "bedingt") {
        return { ok: false, ergebnis: "", fehler: "Er droht nur mit einer Kündigung oder knüpft sie an eine Bedingung („sonst“, „wenn nicht“) — NICHTS ist gebucht. Sprich Kündigung und Storno NICHT an und frag nicht danach: Löse sein Anliegen, konkret und freundlich." };
      }
      return { ok: false, ergebnis: "", fehler: "Er hat noch nicht klar erklärt, dass er raus will (eine Frage oder Überlegung) — NICHTS ist gebucht. Bestätige keine Kündigung. Hat er selbst „kündigen“, „stornieren“ oder „widerrufen“ geschrieben, beantworte seine Frage und frag EINMAL in einem warmen Satz, ob du es gleich für ihn erledigen sollst („Ein kurzes Ja genügt.“). Hat er das NICHT selbst geschrieben (z. B. nur „Stopp“, eine Beschwerde), sprich Kündigung und Storno überhaupt NICHT an — beantworte nur sein Anliegen." };
    }
    // ── E-213: DERSELBE VORGANG WIE IN AKTE, KARTEI UND ZENTRALE (28.09.2026, E-248)
    // Vorher rief Mara nur kuendigungSetzen: Wirkung ja, aber keine Urkunde, keine
    // Bestätigung, der Formular-Antrag blieb offen. Jetzt der ganze Vorgang — scheitert
    // nur Urkunde oder Bestätigungsmail, steht die Kündigung trotzdem.
    // Steht die Kündigung schon, gibt es nichts durchzuführen — dann nur der Stand
    // (kuendigungSetzen meldet „bereits"), ohne zweiten Aktenvermerk (E-246).
    // E-396 Teil 2: Beim Ja auf die Formular-Rückfrage ist das Ziel die Bestellung des Antrags (gebucht zum Eingangstag).
    const ziel: string = formularAntrag?.ziel.ziel ?? k.ref;
    const [schon] = (await sqlPool`SELECT gekuendigt_am FROM fiaon_applications WHERE ref = ${ziel} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
    const { kuendigungSetzen } = await import("./fiaon-kuendigung");
    const { kuendigungDurchfuehren, antragBuchen } = await import("../routes/fiaon-kuendigung");
    const erg = formularAntrag && !schon?.gekuendigt_am
      ? await antragBuchen(formularAntrag, {
        grund: `${formularAntrag.grund ? `${String(formularAntrag.grund).slice(0, 160)} ` : ""}(Formular, per „Ja“ von der gespeicherten Adresse bestätigt — Mara, E-Mail)`,
        personId: k.personId ?? null, mail: true,
        identitaetVermerk: "Per E-Mail-Rückfrage an die gespeicherte Adresse bestätigt: Der Kunde hat von seiner hinterlegten Adresse mit „Ja“ geantwortet (Mara, E-396).",
        unterzeichner: { name: "FIAON LTD", rolle: "automatisch erstellt (digitale Assistentin Mara, E-Mail)" },
      })
      : schon?.gekuendigt_am
      ? await kuendigungSetzen(ziel, { quelle: "mail", grund: String(p.grund || "").slice(0, 300) || null, postmeisterId: k.postmeisterId ?? null })
      : await kuendigungDurchfuehren(ziel, {
        quelle: "mail", grund: String(p.grund || "").slice(0, 300) || null, postmeisterId: k.postmeisterId ?? null,
        personId: k.personId ?? null, unterzeichner: { name: "FIAON LTD", rolle: "automatisch erstellt (digitale Assistentin Mara, E-Mail)" },
        // E-396: Erwähnt er einen Widerruf, bleibt beim Jahresvertrag der bisherige Weg — die Leitung entscheidet.
        widerrufErwaehnt: /wi(?:e)?der(?:r)?uf|r(?:ü|ue)cktritt/i.test(eigen ?? zitat),
      });
    if (!erg.ok) return { ok: false, ergebnis: "", fehler: `${erg.grund} — NICHTS ist gebucht; bestätige keine Kündigung.` };
    // ── E-246: „bereits" aus dem ERSTEN Anlauf DIESER Mail ist keine alte Kündigung.
    // Unterbrach die KI-Pause die Mail nach dem Vormerken, meldet kuendigungSetzen
    // im zweiten Anlauf weg='bereits' — und der Kunde, der zum ersten Mal kündigt,
    // läse „Die Kündigung lag bereits vor". Dann gilt der Satz des ersten Anlaufs
    // (bei „vermerkt" mit den Raten von jetzt), und die Akte bekommt keinen zweiten Vermerk.
    let weg: string = erg.weg;
    let fester: string | null = null;
    let schonVermerkt = false;
    if (erg.weg === "bereits") {
      const frueher = await frueherInDieserMail(k, "kuendigung_vormerken");
      if (frueher != null) {
        schonVermerkt = true;
        const t0 = frueher.replace(/^Kündigung per E-Mail entgegengenommen\.\s*/, "").trim();
        if (/^Die Kündigung ist vermerkt\./.test(t0)) weg = "letzte_rate";
        else if (t0 && !/^Die Kündigung lag bereits vor/.test(t0)) { fester = t0; weg = "frueher"; }
      }
    }
    // 26.09.2026 (E-244): Was offen bleibt, liest das Werkzeug NACH der Buchung
    // aus den Raten — nicht aus dem Ergebnis. Bei „bereits gekündigt" liefert
    // kuendigungSetzen weder Rate noch Betrag; daraus wurde in der Akte und im
    // Werkzeug-Ergebnis für das Modell „Offen bleibt Rate null über 0.00 €"
    // (bis 26.09. 23 Aktenvermerke, keiner davon in einer Kundenmail).
    //
    // Nachbesserung (E-244): Bei „bereits" zuerst der Stand der Bestellung. Ist
    // sie storniert/erstattet oder der Vertrag beendet, fordert Mara NICHTS —
    // auch wenn dort noch eine nicht stornierte Rate „offen" steht (Produktion
    // 26.09.: 4 Bestellungen, z. B. FIAON-MRLWQ2AD-FBJM, Rate 2 über 79,99 €
    // offen, obwohl storniert und beendet). Das ist ein Datenfehler, keine
    // Forderung: Er geht als Prüffall an die Leitung, nie in die Kundenmail.
    let beendet = false;
    const [stand] = (await sqlPool`
      SELECT payment_status, (vertrag_ende_am IS NOT NULL AND vertrag_ende_am <= NOW()) AS vorbei, gekuendigt_am
        FROM fiaon_applications WHERE ref = ${ziel} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
    if (weg === "bereits") {
      beendet = !!stand && (["cancelled", "canceled", "storniert", "refunded"].includes(String(stand.payment_status)) || stand.vorbei === true);
    }
    const offene = (["letzte_rate", "bereits", "laufzeit_ende"].includes(weg)
      ? await sqlPool`
          SELECT rate_nr, betrag_cents, to_char(faellig_am, 'DD.MM.YYYY') AS faellig, to_char(faellig_am, 'YYYY-MM-DD') AS faellig_iso
            FROM fiaon_abo_raten
           WHERE ref = ${ziel} AND storniert_am IS NULL AND status = 'offen'
           ORDER BY rate_nr ASC`.catch(() => null)
      : []) as any[] | null;
    // ── E-265 Nachbesserung (29.09.2026, Recht): VERTRAG VOR DEM 03.09.2026 ENDET ZUM ENDE DES ABRECHNUNGSMONATS ──
    // Die Raten sind monatlich im Voraus fällig (AGB § 5 Abs. 3), der Altvertrag ist mit 24 Stunden Frist zum Ende des
    // Abrechnungsmonats kündbar (Fassung 04.07.2026 § 6; E-265 (01.10.2026): Fälligkeit zu Fälligkeit, vertragsendeLesen)
    // — eine Rate, die erst NACH dem Vertragsende fällig wird, ist für die Zeit danach und wird nie verlangt (vorher:
    // „gilt zum Monatsende. Ihre offene Rate vom 12.10. … zahlen Sie bitte noch"). Sie bleibt im System offen, bis
    // Justin entscheidet (Geldentscheidung) — Prüffall an den Betreiber, nie in der Kundenmail.
    // Nachbesserung Recht (01.10.2026, Gegenprüfung M2): immer die EINE Lesestelle — nie die rohe Spalte vertrag_ende_am
    // (Altdaten mit Zahltag statt Ende des Abrechnungsmonats).
    const endeTag: string | null = k.formlosKuendbar
      ? (await (await import("./fiaon-kuendigung")).vertragsendeLesen(ziel)).ende
      : null;
    const { zuZahlen: offenBisEnde, nachEnde } = kuendigungRatenAufteilen(
      (offene ?? []).map((r) => ({ ...r, faellig: r.faellig_iso ?? null })),
      { jahresvertrag: !k.formlosKuendbar, vertragsEnde: endeTag },
    );
    // E-371 (15.10.2026): Hier legte Mara die Aufgabe „Entscheidung: Rate nach Vertragsende“ auf Justins Board. Diese Raten
    // mahnt seit E-368 kein Lauf mehr (RATE_NACH_ENDE_SQL), und die Sammelkarte „Raten nach Vertragsende stornieren“ in
    // Mara › Entscheidungen (E-370, ratenNachVertragsendeStornieren) räumt sie mit einem Klick ab — keine zweite Aufgabe.
    const gelesen: OffeneRate[] | null = offene
      ? offenBisEnde.map((r: any) => ({ nr: Number(r.rate_nr), cents: Number(r.betrag_cents), faellig: r.faellig_iso ? `${r.faellig_iso.slice(8, 10)}.${r.faellig_iso.slice(5, 7)}.${r.faellig_iso.slice(0, 4)}` : null }))
      : null;
    if (beendet && gelesen && echteOffeneRaten(gelesen).length) {
      const wider = echteOffeneRaten(gelesen);
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: k.personId, ref: ziel, anBetreiber: true, quelle: "postmeister", autorName: "Mara",
        titel: `Prüffall: offene Rate trotz beendetem Vertrag (${ziel})`.slice(0, 160),
        text: `Die Bestellung ${ziel} ist storniert oder beendet, trotzdem steht noch ${wider.map((r) => `Rate ${r.nr} über ${rateEuro(r.cents)}`).join(", ")} als offen (nicht storniert). `
          + `Mara hat dem Kunden keine Zahlung genannt. Bitte prüfen: Rate stornieren oder Bestellung richtigstellen.`,
        schluessel: `postmeister:kuendigung-raten:${ziel}`,
      }).catch((e) => console.error("[POSTMEISTER] Prüffall Raten:", String(e).slice(0, 160)));
    }
    // ── E-396 (19.10.2026): JAHRESVERTRAG ZUM LAUFZEITENDE ──────────────────────────────────────────────────────
    // Gebucht (oder schon gebucht) zum Laufzeitende: Es zählt das Ende aus der Buchung und die offene Rechnung aus dem
    // Kulanz-Angebot (bis kulanz_rate_nr) — nicht jede offene Rate. Mara sagt das Ende und den EINEN Kulanz-Satz.
    const jl = !k.formlosKuendbar && !beendet
      ? await (await import("./fiaon-kuendigung")).jahresvertragLage(ziel).catch(() => null) : null;
    const laufzeit = jl?.art === "laufzeit" && jl.ende ? jl : null;
    const deTT = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : null);
    const raten: OffeneRate[] | null = beendet ? []
      : laufzeit ? (laufzeit.kulanz?.raten ?? []).map((r) => ({ nr: r.nr, cents: r.cents, faellig: deTT(r.faellig) }))
      : gelesen;
    const t = fester ?? kuendigungSatz(weg, raten, { beendet, formlos: !!k.formlosKuendbar, endeTag, laufzeitEnde: laufzeit?.ende ?? null });
    const echte = raten ? echteOffeneRaten(raten) : [];
    const letzte = echte.length ? echte[echte.length - 1] : null;
    await protokoll(k, "kuendigung_vormerken", `Kündigung per E-Mail entgegengenommen. ${t}`, !schonVermerkt);
    // ── E-265 (29.09.2026, Justin: „NEIN, bezahlen Sie Ihre Rate, dann lasse ich Sie aus Kulanz gerne aus dem
    // Vertrag!!!") — der Satz für den Kunden, je Vertragsart: Jahresvertrag mit Kulanz, Altvertrag (vor dem
    // 03.09.2026, monatlich kündbar) OHNE „Kulanz" (§ 5 UWG). Die Kündigung selbst ist gebucht (§ 312k BGB).
    const heuteText = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date());
    // E-265 Nachbesserung (29.09.2026): auch bei mehreren Raten ein fertiger Satz (alle mit Datum und Summe, ohne
    // „danach kommt nichts mehr"); „bereits" + beendet nie „heute eingegangen" (Regression r9.mts — vorher wurde der
    // Weg zu „sofort_beendet" umgebogen: „Ihre Kündigung ist heute … eingegangen", für 174 längst beendete Verträge).
    const soSchreiben = bausteinKuendigung({
      kanal: "mail", weg, beendet: weg === "bereits" && beendet, jahresvertrag: !k.formlosKuendbar, heute: `${heuteText}.`.replace(/\.\.$/, "."),
      raten: echte.map((r) => ({ vom: r.faellig ? String(r.faellig).slice(0, 6) : null, betrag: rateEuro(r.cents), cents: r.cents })),
      bestaetigung: !!(erg as any).mailGesendet,
      // Stopp, Widerruf, Beschwerde, „kann nicht zahlen" … (zahlungsRuhe): nur der Stand, keine Zahlungsbitte.
      ohneZahlung: !!k.ruhe,
      // E-265 Nachbesserung 2 (01.10.2026): „danach kommt nichts mehr" nur, wenn nach diesen Raten nichts mehr offen ist.
      nichtsMehr: !(!beendet && nachEnde.length), nachEnde: !beendet && nachEnde.length > 0,
      // E-265 (01.10.2026, Recht): „… gilt zum Ende Ihres laufenden Abrechnungsmonats, dem <Datum>".
      giltZum: endeTag,
      // E-396: Jahresvertrag zum Laufzeitende — das Ende und die EINE Kulanz-Fassung.
      laufzeitEnde: laufzeit?.ende ?? null, fristgerecht: laufzeit?.fristgerecht,
    });
    return {
      ok: true, ergebnis: t,
      daten: {
        weg,
        // E-246: vorgemerkt im ersten, von der KI-Pause unterbrochenen Anlauf DIESER Mail.
        in_diesem_vorgang_vorgemerkt: schonVermerkt,
        vertrag_beendet: beendet,
        letzte_rate: letzte?.nr ?? null,
        betrag: letzte ? (letzte.cents / 100).toFixed(2) : null,
        faellig: letzte?.faellig ?? null,
        offene_raten: echte.map((r) => ({ rate: r.nr, betrag: (r.cents / 100).toFixed(2), faellig: r.faellig })),
        offen_summe: echte.length ? (echte.reduce((s, r) => s + r.cents, 0) / 100).toFixed(2) : null,
        // E-248 (E-213): Was das Haus selbst verschickt hat — nur dann kündigt Mara die Bestätigung an.
        urkunde: !!(erg as any).urkunde,
        bestaetigung_gesendet: !!(erg as any).mailGesendet,
        // E-265: Justins Satz für diese Kündigung (Jahresvertrag: Kulanz; Altvertrag: gilt zum Ende des Abrechnungsmonats) — genau so schreiben.
        ...(soSchreiben ? { so_schreiben: soSchreiben, vertrag: k.formlosKuendbar ? `vor dem 03.09.2026 (kündbar zum Ende des Abrechnungsmonats${tagDeutsch(endeTag) ? `, dem ${tagDeutsch(endeTag)}` : ""} — KEIN „Kulanz“)`
          : laufzeit ? `Jahresvertrag — gekündigt zum Laufzeitende, dem ${deTT(laufzeit.ende)}; vorzeitig nur aus Kulanz nach Zahlung der offenen Rechnung (Satz aus so_schreiben, wörtlich)`
          : "Jahresvertrag (Kulanz-Satz)" } : {}),
        // E-265 (01.10.2026, Recht): das Vertragsende beim Altvertrag (TT.MM.JJJJ) — für die Prüfung und das Modell.
        ...(endeTag ? { gilt_zum: tagDeutsch(endeTag) } : {}),
        // E-396: das Vertragsende beim Jahresvertrag zum Laufzeitende (TT.MM.JJJJ).
        ...(laufzeit ? { gilt_zum: deTT(laufzeit.ende), laufzeit_ende: deTT(laufzeit.ende), kulanz_offen: !!laufzeit.kulanz } : {}),
      },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DER KÜNDIGUNGSWILLE (28.09.2026, E-248) — rein, im Prüfstand geprüft.
//
// DIE FÄLLE: #5626 „Ich [Vorname Nachname] kündige per sofort den Vertrag" —
// zweimal abgelehnt, weil istWillenserklaerung (fiaon-kuendigung.ts) „ich
// kündige" direkt nebeneinander verlangt; Mara schrieb trotzdem „Ihre Kündigung
// liegt mir jetzt eindeutig vor". #5625: Vertrag vom 25.08. (formlos kündbar),
// „alles komplett wieder stornieren" — Mara verlangte den festen Wortlaut. 68
// von 116 Aufrufen scheiterten in 14 Tagen an dieser Prüfung.
//
// Die Regel im Kündigungsmodul bleibt (sie gilt auch für Akte und Kartei);
// hier kommen die Formen dazu, die echte Kunden schreiben. Eine Frage oder
// ein Konjunktiv im selben Satz ist weiterhin KEINE Kündigung.
// ═══════════════════════════════════════════════════════════════════════════
const WILLE_UNSICHER = /(würde|wuerde|überlege|ueberlege|\bfalls\b|wenn ich|wie kann ich|wie kündige|wie kuendige|kann ich\b|könnte|koennte|(?:ist|wäre|waere|sei)\s+(?:das|es)\s+m(?:ö|oe)glich|vielleicht|eventuell|\bob\b|informier|welche frist|\bwhether\b|\bif\s+i\b|how\s+(?:can|do)\s+i|\?)/i;
const WILLE_KLAR: RegExp[] = [
  // „Ich, Max Muster, kündige per sofort" — Name oder Füllwörter zwischen „ich" und „kündige"
  /\bich\b[^.!?\n]{0,40}?\bk(?:ü|ue)ndige\b/i,
  // „Ich möchte meinen Vertrag kündigen", „will das bei Ihnen kündigen", „werde kündigen"
  // (Nachbesserung E-248: „beenden" zählt nur mit Vertrag/Abo — „ich werde das heute
  // beenden und die Rate zahlen" ist keine Kündigung; das prüft BEENDEN_ALLEIN.)
  /\b(?:möchte|moechte|möchten|will|wollen|werde)\b[^.!?\n]{0,50}?\b(?:k(?:ü|ue)ndigen|stornieren|beenden|auflösen|aufloesen|widerrufen)\b/i,
  // „Kündigung per sofort / fristlos / zum nächstmöglichen Zeitpunkt"
  /\bk(?:ü|ue)ndigung\b[^.!?\n]{0,40}?\b(?:per\s+sofort|ab\s+sofort|fristlos|mit\s+sofortiger\s+wirkung|zum\s+n(?:ä|ae)chst(?:en|m(?:ö|oe)glichen))/i,
  // „bitte alles komplett stornieren", „den Vertrag bitte beenden" — ein Antrag nur mit
  // „stornieren/zurückziehen" („meinen Antrag beenden" heißt oft: fertig ausfüllen).
  /\b(?:alles|vertrag|vertr(?:ä|ae)ge|bestellung|abo|abonnement|paket|mitgliedschaft|auftrag)\b[^.!?\n]{0,30}?\b(?:stornier\w*|k(?:ü|ue)ndigen|beenden|aufheben|aufl(?:ö|oe)sen)\b/i,
  /\bantrag\b[^.!?\n]{0,30}?\b(?:stornier\w*|zur(?:ü|ue)ckziehen|zur(?:ü|ue)ckgezogen)\b/i,
  // „Ja, bitte kündigen." / „Bitte stornieren Sie alles" / „Kündigen Sie bitte meinen Vertrag"
  /\bbitte\s+(?:(?:alles|den\s+vertrag|mein(?:en)?\s+vertrag|das\s+abo|die\s+bestellung|meine\s+bestellung)\s+)?(?:k(?:ü|ue)ndigen|stornieren)\b/i,
  /\b(?:k(?:ü|ue)ndigen|stornieren)\s+sie\s+(?:bitte\s+)?(?:alles|mein\w*|den|das|die)\b/i,
  // „Hiermit möchte ich … widerrufen"
  /\bhiermit\b[^.!?\n]{0,50}?\bwi(?:e)?der(?:r)?uf\w*/i,
  // Englisch: „I want to cancel", „please cancel my subscription", „I hereby cancel"
  /\b(?:i\s+(?:want|wish|would\s+like|hereby)\s+to\s+cancel|i\s+hereby\s+cancel|please\s+cancel|cancel\s+(?:my|the)\s+(?:subscription|contract|order|membership|plan))\b/i,
];

// ── NACHBESSERUNG E-248 (28.09.2026): WAS NIE EINE KÜNDIGUNG IST ──────────
// Gegenprobe: „Ich kündige nicht, ich will nur wissen …", „Ich will nicht
// kündigen, sondern die Rate verschieben", „Bevor ich kündige, möchte ich mit
// jemandem sprechen", „Sonst werde ich kündigen", „Mein Mann will kündigen, ich
// aber nicht", „Ich möchte meinen Handyvertrag kündigen" — alle galten als
// Kündigung und wären SOFORT mit Urkunde gebucht worden. In echten Mails der
// letzten 45 Tage hatten 67 von 187 Treffern eine Verneinung oder Bedingung.
// Ein Satz mit einer dieser Formen zählt nie — im Zweifel fragt Mara nach, und
// ein kurzes Ja darauf genügt (jaAufRueckfrage).
/** Ein Wort zwischen Verneinung und Kündigungswort — nie über ein Komma oder ein „und/aber" hinweg. */
const W = String.raw`(?:(?!(?:und|aber|sondern|deshalb|daher|darum|also|weil|denn|ich|and|but)\b)[^\s,;:.!?]+)`;
const KWORT = String.raw`\S*(?:k(?:ü|ue)ndig|stornier|beend|wi(?:e)?der(?:r)?uf|aufl(?:ö|oe)s|aufheb|cancel)`;
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g2 K19/K20/K45/K49): auch umgangssprachlich und vertippt —
 * „nich", „net", „ned", „nciht", „nihct", „nicth", „niht". Vorher galt „Ich kündige nich. Ich zahle am Freitag."
 * als Erklärung und wurde gebucht.
 */
const NICHT = String.raw`(?:nicht|nich|net|ned|nciht|nihct|nicth|niht|nichts)`;
/** Ein Wort zwischen Verb und Verneinung — „Kündige ich halt nicht" ja, über „weil/denn/und/aber/wenn/dass" nie
 * („Ich kündige weil ich nicht zufrieden bin" ist eine Kündigung). */
const W_NACH = String.raw`(?:(?!(?:und|aber|sondern|deshalb|daher|darum|also|weil|denn|wenn|dass|da|obwohl|and|but|because)\b)[^\s,;:.!?]+)`;
/** „nicht kündigen", „auf keinen Fall kündigen", „nicht vor, den Vertrag zu kündigen" — „nicht mehr"/„kein Interesse" sind KEINE Verneinung des Kündigens. */
const VERNEINT_VOR = new RegExp(String.raw`\b(?:${NICHT}(?!\s+mehr\b)|kein(?:e[nmrs]?)?(?!\s+(?:interesse|bedarf|lust|geld|mehr)\b)|nie(?:mals)?|keinesfalls|auf\s+keinen\s+fall)\b(?:\s+${W}){0,4}?\s+${KWORT}`, "i");
/**
 * „ich kündige nicht", „storniere das bitte nicht" — und (Nachbesserung 2, Gegenprobe K31/K32) die Sie-Form:
 * „Bitte kündigen Sie nicht meinen Vertrag", „Bitte stornieren Sie das nicht, ich zahle morgen".
 */
const VERNEINT_NACH = new RegExp(String.raw`\b(?:k(?:ü|ue)ndig(?:e|en|t)|stornier(?:e|en|t)|beend(?:e|en|et)|wi(?:e)?der(?:r)?uf(?:e|en|t)|l(?:ö|oe)s(?:e|en|t))\b(?:\s+${W_NACH}){0,3}?\s+(?:${NICHT}(?!\s+mehr\b)|keinesfalls|niemals|nie)\b`, "i");
const VERNEINT_EN = /\b(?:don'?t|do\s+not|won'?t|will\s+not|not)\s+(?:\w+\s+){0,2}?cancel/i;
/** Bedingung oder Vorbehalt im selben Satz: „bevor", „sonst", „wenn … nicht klappt". */
const BEDINGUNG = /\b(?:bevor|sonst|ansonsten|wenn|falls|sofern|solange|au(?:ß|ss)er\s+wenn|es\s+sei\s+denn|unless|before|otherwise)\b/i;
/** Jemand anderes will kündigen: „Mein Mann will kündigen, ich aber nicht." */
const DRITTE = /\b(?:mein(?:e|em|en|er)?|unser(?:e|em|en|er)?)\s+(?:mann|ehemann|frau|ehefrau|partner(?:in)?|freund(?:in)?|lebensgef(?:ä|ae)hrt\w*|sohn|tochter|vater|mutter|papa|mama|bruder|schwester|kolleg\w*|chef\w*|anwalt|anw(?:ä|ae)ltin)\b|\ber\s+(?:will|m(?:ö|oe)chte|wollte|k(?:ü|ue)ndigt)\b|\bmy\s+(?:husband|wife|partner)\b/i;
/** Ein fremder Vertrag: Handy, Strom, das Konto bei seiner Bank (wie heikelAnliegen auf WhatsApp). */
const FREMDER_VERTRAG = /\b(?:handy|mobilfunk|strom|gas|internet|dsl|fitness\w*|miet|versicherungs?|zeitungs?|netflix|spotify|giro|spar|bank|kredit)\w*(?:vertrag|konto|abo|mitgliedschaft|karte)\b|\b(?:konto|karte|kredit\w*|vertrag|abo)\s+bei\s+(?:meiner|meinem|der|dem|einer|einem)\s+\w+|\b(?:bei\s+der|meine[rn]?)\s+(?:sparkasse|volksbank|raiffeisen\w*|commerzbank|postbank|n26|ing|comdirect|targobank|hausbank|bank)\b/i;
/** „beenden" allein (ohne Vertrag/Abo) ist keine Kündigung: „Antrag beenden" = fertig machen. */
function beendenAllein(s: string): boolean {
  return /beend/i.test(s)
    && !/(?:k(?:ü|ue)ndig|stornier|wi(?:e)?der(?:r)?uf|aufl(?:ö|oe)s|nicht\s+mehr|kein\s+interesse|abbrech|zur(?:ü|ue)cktret|l(?:ö|oe)sch|verzicht|cancel|nein\s+danke)/i.test(s)
    && !/\b(?:vertrag\w*|abo|abonnement|mitgliedschaft|zusammenarbeit)\b/i.test(s);
}
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g2 K11/K12/K33–K35, g2b): Er nimmt die Kündigung ZURÜCK —
 * „Kündigung zurücknehmen", „Ich möchte meine Kündigung widerrufen", „Bitte stornieren Sie meine Kündigung",
 * „… rückgängig machen", „Nein doch nicht", „Ach nee, lass mal", „War ein Scherz", „Hat sich erledigt",
 * „Ich nehme das zurück", „Vergessen Sie es". Irgendwo in seinen offenen Nachrichten → nie eine Buchung; vorher
 * las der Wille nur bis zum ersten klaren Satz („Ich kündige! ⏎ War ein Scherz" wurde gebucht).
 * „Ich bleibe bei meiner Kündigung" ist KEINE Rücknahme (istWillenserklaerung).
 */
const RUECKNAHME = new RegExp([
  String.raw`\bdoch\s+${NICHT}\b`, String.raw`\blass(?:en\s+sie)?\s+(?:es\s+|das\s+)?mal\b`, String.raw`\bvergessen\s+sie\s+(?:es|das|meine\s+(?:nachricht|kündigung|kuendigung))\b`,
  String.raw`\bscherz\b`, String.raw`\bhat\s+sich\s+erledigt\b`, String.raw`\b(?:nehme|ziehe)\s+(?:ich\s+)?(?:das|es|die\s+k(?:ü|ue)ndigung|meine\s+k(?:ü|ue)ndigung)?\s*zur(?:ü|ue)ck\b`,
  String.raw`\bzur(?:ü|ue)ck(?:nehmen|ziehen|genommen|gezogen)\b`, String.raw`\br(?:ü|ue)ckg(?:ä|ae)ngig\b`,
  String.raw`\bk(?:ü|ue)ndigung\b(?:\s+[^\s,;:.!?]+){0,3}?\s+(?:wi(?:e)?der(?:r)?ruf\w*|wi(?:e)?der(?:r)?uf\w*|stornier\w*|annullier\w*|aufheben|aufgehoben)\b`,
  String.raw`\b(?:wi(?:e)?der(?:r)?uf\w*|stornier\w*|annullier\w*|aufheben|ignorieren)\s+(?:sie\s+)?(?:bitte\s+)?(?:\S+\s+){0,2}?(?:meine|die|diese)\s+k(?:ü|ue)ndigung\b`,
  String.raw`\bich\s+bleibe\b(?!\s+(?:bei|auf)\s+(?:meiner|der)\s+k(?:ü|ue)ndigung)`, String.raw`\bbleibe\s+(?:doch\s+)?(?:kunde|bei\s+ihnen|bei\s+euch|dabei)\b`,
  String.raw`\bdoch\s+(?:weiter|bleiben|behalten)\b`, String.raw`\bk(?:ü|ue)ndigen\s+sie\s+(?:\S+\s+){0,3}?${NICHT}\b`,
  String.raw`\b(?:never\s+mind|forget\s+it|just\s+kidding|take\s+(?:it|that)\s+back|withdraw\s+my\s+cancellation)\b`,
].join("|"), "i");
/** Nimmt er irgendwo in diesem Text eine Kündigung zurück? Rein (WhatsApp und Postfach lesen dieselbe Regel). */
export function kuendigungRuecknahme(text: string): string | null {
  return String(text ?? "").match(RUECKNAHME)?.[0] ?? null;
}
/**
 * E-265 Nachbesserung 2 (01.10.2026, Gegenprobe g5b, E-264): Bestreiten oder falsche Nummer IRGENDWO im Text —
 * dann nie eine Kündigung und nie ein Storno, auch wenn eine Stornobitte dabeisteht („Falsche Nummer, bitte
 * stornieren", „Ich bin nicht die Person. Bitte kündigen Sie das.", „Das war mein Sohn … Bitte stornieren Sie
 * alles.", „Ich habe das nicht bestellt."). Die Leitung übernimmt (E-264). Rein; `abstreiten` ist abstreitenArt.
 */
const FREMD_ODER_BESTRITTEN = /\bfalsche?n?\s+(?:nummer|person|empf(?:ä|ae)nger)\b|\bnicht\s+(?:die|der|diese|dieser)\s+(?:person|richtige|kunde|kundin)\b|\bbin\s+(?:ich\s+)?nicht\s+(?:\S+\s+){0,2}?(?:kunde|kundin|person)\b|\bhab\w*\s+(?:(?:das|ich|es|hier|da|so|bei\s+ihnen|bei\s+euch)\s+)*(?:nicht|nie|nichts|niemals|nix)\s+(?:\S+\s+){0,2}?(?:bestellt|beantragt|unterschrieben|abgeschlossen)\b|\b(?:nie|nichts|nix)\s+(?:etwas\s+|was\s+)?(?:bestellt|beantragt|abgeschlossen)\b|\bkenne\s+(?:ich|sie|euch)\s+nicht\b|\bwrong\s+number\b/i;
export function bestreitetKuendigung(text: string, abstreiten?: (t: string) => { art?: string } | null | undefined): string | null {
  const t = String(text ?? "");
  // Nur Bestreiten und falsche Nummer — „Wer sind Sie?", eine Datenfrage, Wut oder „in Ruhe lassen" sind kein Bestreiten.
  const ab = abstreiten ? abstreiten(t) : null;
  if (ab && (ab.art === "bestreitet" || ab.art === "falsche_nummer")) return ab.art;
  const m = t.match(FREMD_ODER_BESTRITTEN);
  if (m) return m[0];
  // Jemand anderes (Sohn, Mann …) — im GANZEN Text, nicht nur im Kündigungssatz.
  if (DRITTE.test(t)) return "dritte person";
  return null;
}

/** Ein Satz, der nie als Kündigung gelten darf. Rein, im Prüfstand geprüft. */
/** „Kreditkarte“, „Kreditkarten-Antrag“ — unser eigenes Produkt, kein fremder Vertrag (E-499). */
const KREDITKARTE_WORT = new RegExp(String.raw`kredit\s?kart\p{L}*`, "giu");
export function keinKuendigungsSatz(s: string): string | null {
  if (VERNEINT_VOR.test(s) || VERNEINT_NACH.test(s) || VERNEINT_EN.test(s)) return "verneint";
  if (RUECKNAHME.test(s)) return "zurückgenommen";
  if (BEDINGUNG.test(s)) return "bedingung";
  if (DRITTE.test(s)) return "dritte person";
  // E-499: „Kreditkarte“ ist unser eigenes Produkt — vorher galt jeder Satz mit dem Wort als fremder Vertrag
  // („Ich bitte um Stornierung meines Kreditkarten-Antrags“ wurde nie gebucht).
  if (FREMDER_VERTRAG.test(s.replace(KREDITKARTE_WORT, "karte"))) return "fremder vertrag";
  if (beendenAllein(s)) return "beenden ohne vertrag";
  return null;
}

/** Unsere Rückfrage „Möchten Sie Ihren Vertrag kündigen? Ein kurzes Ja genügt." (bis 19.10.2026: „… dass ich Ihren Vertrag jetzt kündige?") (und die Storno-Fassung). */
export const RUECKFRAGE_KUENDIGUNG = /\b(?:möchten|moechten|wollen)\s+sie[^?]{0,60}?\b(?:k(?:ü|ue)ndige|storniere|k(?:ü|ue)ndigen|stornieren)\b[^?]{0,20}\?|\bsoll\s+ich\b[^?]{0,60}?\b(?:k(?:ü|ue)ndigen|stornieren)\b[^?]{0,20}\?/i;
/**
 * Ein kurzes Ja auf unsere Rückfrage (Nachbesserung E-248): „Ja", „Ja bitte",
 * „Ja genau", „Ja, bitte kündigen." — vorher eine Schleife: Wir verlangten ein Ja
 * und nahmen es nicht an. Nur, wenn unsere letzte Mail die Rückfrage enthielt. Rein.
 */
export function jaAufRueckfrage(eigenerText: string, unsereLetzte: string | null | undefined): boolean {
  if (!unsereLetzte || !RUECKFRAGE_KUENDIGUNG.test(String(unsereLetzte))) return false;
  const t = String(eigenerText || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 90 || /\?/.test(t)) return false;
  if (/\b(?:nicht|nein|kein\w*|doch\s+nicht|no|not)\b/i.test(t)) return false;
  return /^(?:ja|jawohl|jap|genau|korrekt|richtig|gerne?|bitte|yes|s[ií]|oui|evet|tak|da)\b/i.test(t);
}

// ═══════════════════════════════════════════════════════════════════════════
// MARA 2.0 — DER AUSTRITTSWILLE (E-499, 12.11.2026) — rein, im Prüfstand geprüft.
//
// Justin (10.11.2026, „das ist eine Frechheit“): Ein Kunde schrieb „hiermit kündige ich einen eventuell bestehenden
// Vertrag mit sofortiger Wirkung“ — Mara fragte nach. Er antwortete „Ja, ich möchte diesen Vertrag jetzt kündigen“ —
// Mara wollte noch einmal fragen. Die Messung an den echten Mails (nur gelesen) zeigte: kuendigung_vormerken lehnte
// einen großen Teil der Aufrufe als „keine eindeutige Kündigung“ ab, obwohl fast alle klare Erklärungen waren —
// „Could you please cancel my subscription?“, „Ersuche um Kündigung meines Accounts“, „ich habe längst gekündigt“.
//
// Die Ursache war die Bauart: eine Liste erlaubter Formen (WILLE_KLAR, istWillenserklaerung). Jede Form, die dort
// fehlte, galt als unklar — ein „eventuell“ irgendwo im Satz, „kündige ich“ statt „ich kündige“, ein „Ja“ auf eine frei
// formulierte Rückfrage. Jetzt umgekehrt: Wer in SEINEN Worten ein Austrittswort schreibt, hat erklärt — außer einer der
// benannten Gegenfälle trifft (Verneinung, Bedingung/Drohung, fremde Person, fremder Vertrag, Rücknahme, reine Auskunfts-
// frage, Überlegung). Das Modell muss weiter selbst entscheiden, das Werkzeug zu rufen; hier steht die zweite Unterschrift.
// Die alte Liste bleibt als erster Weg (sie kennt auch „kein Interesse“ bei unbezahlter Bestellung).
// ═══════════════════════════════════════════════════════════════════════════
/** Ein Wort des Austritts in SEINEM Satz: kündigen, stornieren, widerrufen, abbestellen, zurücktreten, cancel … */
const AUSTRITTSWORT = new RegExp([
  String.raw`(?<![\p{L}])(?:ge)?k(?:ü|ue|û)ndig\p{L}*`, String.raw`(?<![\p{L}])k(?:ö|oe)nd(?:ü|ue|i)ng\p{L}*`,
  String.raw`(?<![\p{L}])sto?r?n(?:i|o)\p{L}*`, String.raw`(?<![\p{L}])wi(?:e)?der{1,3}uf\p{L}*`, String.raw`(?<![\p{L}])wi(?:e)?derspr\p{L}*`,
  String.raw`(?<![\p{L}])abbestell\p{L}*`, String.raw`(?<![\p{L}])bestell\p{L}*\s+(?:\S+\s+){0,3}?ab(?![\p{L}])`,
  String.raw`(?<![\p{L}])r(?:ü|ue)cktritt\p{L}*`, String.raw`(?<![\p{L}])trete\s+(?:\S+\s+){0,3}?zur(?:ü|ue)ck`,
  String.raw`(?<![\p{L}])beendigung`, String.raw`(?<![\p{L}])cancel\p{L}*`, String.raw`(?<![\p{L}])aus(?:tritt|treten)(?![\p{L}])`,
  String.raw`(?<![\p{L}])(?:vertrag\p{L}*|abo\p{L}*|mitgliedschaft|zusammenarbeit|account|konto)\s+(?:\S+\s+){0,4}?(?:beend\p{L}*|aufheb\p{L}*|aufl(?:ö|oe)s\p{L}*|(?<![\p{L}])end(?:et|en|e)(?![\p{L}]))`,
  String.raw`(?<![\p{L}])(?:beend\p{L}*|aufheb\p{L}*|aufl(?:ö|oe)s\p{L}*)\s+(?:\S+\s+){0,4}?(?:vertrag\p{L}*|abo\p{L}*|mitgliedschaft|zusammenarbeit|account|verh(?:ä|ae)ltnis)`,
  String.raw`(?<![\p{L}])verzicht\p{L}*\s+auf\s+(?:\S+\s+){0,3}?(?:dienstleistung\p{L}*|dienste|vertrag\p{L}*|service|mitgliedschaft|leistung\p{L}*|angebot)`,
  String.raw`(?<![\p{L}])stopp?\p{L}*\s+(?:sie\s+)?(?:\S+\s+){0,2}?(?:verfahren|vertrag\p{L}*|abo\p{L}*|mitgliedschaft)`,
].join("|"), "iu");
/** Unbezahlte Bestellung: jede klare Absage ist ein Storno (kostet nichts) — auch ohne Austrittswort. */
const ABSAGE_UNBEZAHLT = /\bhat+\s+sich\s+(?:\S+\s+){0,3}?erledigt\b|\berledigt\s+hat\b|\bkein(?:en)?\s+(?:bedarf|interesse)\b|\bnicht\s+(?:mehr\s+)?interessiert\b|\b(?:alles\s+)?abgebrochen\b|\babbrechen\b|\b(?:brauche?|ben(?:ö|oe)tige|will|m(?:ö|oe)chte)\s+(?:\S+\s+){0,4}?nicht\s+mehr\b|\bnicht\s+mehr\s+(?:n(?:ö|oe)tig|ben(?:ö|oe)tigt|gew(?:ü|ue)nscht)\b/i;
/** Eine reine Auskunftsfrage oder Überlegung — er will (noch) nichts erklären. */
const AUSTRITT_AUSKUNFT = new RegExp([
  String.raw`(?<![\p{L}])(?:wie(?!\s+oft)|wo|wohin|bis\s+wann|ab\s+wann|wann)\s+(?:\S+\s+){0,5}?(?:k(?:ü|ue)ndig|stornier|wi(?:e)?derr?uf|cancel)`,
  String.raw`(?<![\p{L}])(?:kann\s+(?:ich|man)|k(?:ö|oe)nnte\s+ich|muss\s+ich)(?![\p{L}])[^.!]*\?`,
  String.raw`(?:ist|w(?:ä|ae)re)\s+(?:das|es|eine\s+k(?:ü|ue)ndigung)\s+(?:\S+\s+){0,2}?m(?:ö|oe)glich`, String.raw`was\s+passiert`,
  String.raw`k(?:ü|ue)ndigungs(?:frist|bedingung|recht|m(?:ö|oe)glichkeit)\p{L}*`, String.raw`welche\s+frist`, String.raw`(?<![\p{L}])frage\s+zu[rm]?(?![\p{L}])`,
  String.raw`(?<![\p{L}])informier\p{L}*`, String.raw`wissen,?\s+(?:wie|ob|wann)`, String.raw`(?<![\p{L}])ob\s+ich(?![\p{L}])`,
  String.raw`(?<![\p{L}])(?:how\s+(?:can|do)\s+i|can\s+i|whether)(?![\p{L}])`,
  String.raw`(?<![\p{L}])(?:(?:ü|ue)berlege|erw(?:ä|ae)ge|vielleicht|mit\s+dem\s+gedanken|denke\s+dar(?:ü|ue)ber\s+nach)`,
  // „eventuell“ nur, wenn es das Kündigen selbst meint („eventuell kündigen“) — nicht „einen eventuell bestehenden Vertrag“.
  String.raw`(?<!(?:ein(?:e[nmrs]?)?|de[nmrs]|die|das|mein(?:e[nmrs]?)?|ihr(?:e[nmrs]?)?|etwaig\p{L}*)\s)(?<![\p{L}])eventuell\s+(?:\S+\s+){0,2}?(?:k(?:ü|ue)ndigen|stornieren|wi(?:e)?derr?ufen)(?![\p{L}])`,
  String.raw`(?:k(?:ü|ue)ndige|storniere)\s+(?:ich\s+)?(?:dann\s+)?eventuell\s*(?:[.,!?]|$)`,
].join("|"), "iu");
/** Eine Bitte an UNS in Frageform: „Could you please cancel …?“, „Können Sie bitte kündigen?“ — das ist eine Erklärung. */
const AUSTRITT_BITTE = /(?:k(?:ö|oe)nn(?:en|ten)|w(?:ü|ue)rden)\s+sie\b|\b(?:could|can|would|will)\s+you\b|\bbitte\b|\bplease\b/i;
/** UNSERE Frage an ihn („Möchten Sie …?“, „Soll ich …?“) — steht sie in seinem Text, ist es ein Zitat, nie seine Erklärung. */
const UNSERE_FRAGE = /\b(?:m(?:ö|oe)chten|wollen)\s+sie\b|\bsoll\s+ich\b|\bein\s+kurzes\s+ja\b/i;
/** Er beruft sich auf eine frühere Kündigung („habe längst gekündigt“) — das zählt auch in einem Satz mit „wenn“. */
const FRUEHER_ERKLAERT = /\b(?:habe?|hatte|hab)\b[^.!?\n]{0,60}?\b(?:gek(?:ü|ue)ndigt|storniert|wi(?:e)?derr?ufen|abbestellt)\b|\b(?:gek(?:ü|ue)ndigt|storniert|wi(?:e)?derr?ufen)\s+(?:habe?|hatte|worden|wurde)\b|\bk(?:ü|ue)ndigung\s+(?:\S+\s+){0,4}?(?:eingebracht|geschickt|gesendet|eingereicht|abgegeben|geschrieben)\b/i;
/** Drohung in der „oder“-/„sollte“-Form („… oder ich kündige“, „Sollte das nicht klappen, kündige ich“) — keine Erklärung. */
const AUSTRITT_DROHUNG = new RegExp(String.raw`\boder\s+(?:ich\s+)?(?:werde\s+)?(?:\S+\s+){0,2}?(?:k(?:ü|ue)ndig|stornier|wi(?:e)?derr?uf)|^\s*sollte[nt]?\b|(?<!\b(?:sie|ihr|ich|wir|man|es|das|dies|die|der)\s)\bsollte[nt]?\s+(?:ich|es|sich|das|die|der|sie|wir|man|ihr|bis|kein\p{L}*|nichts?|dies\p{L}*|mein\p{L}*|ihre?\p{L}*|unser\p{L}*)(?![\p{L}])`, "iu");
/** Eine Frage in Verb-zuerst-Form, auch ohne Fragezeichen („Kann ich es auch stornieren“). */
const AUSTRITT_FRAGEFORM = /^\s*(?:(?:und|aber|hallo|guten\s+tag)[,!\s]+)*(?:kann|k(?:ö|oe)nnte|darf|muss)\s+(?:ich|man)\b/i;
/** Kein Austritt aus dem Kundenvertrag: Dank für eine erledigte Kündigung, ein anderer Vertrag mit uns (Mitarbeiter, Partner). */
const AUSTRITT_NICHT_GEMEINT = new RegExp([
  String.raw`\bdanke?\s+(?:f(?:ü|ue)r|fuer)\s+(?:die|ihre|eure)\s+(?:stornierung|k(?:ü|ue)ndigung\p{L}*|best(?:ä|ae)tigung)`,
  String.raw`handelsvertreter\p{L}*|arbeitsvertrag\p{L}*|dienstvertrag\p{L}*|kooperationsvertrag\p{L}*|partnervertrag\p{L}*|partnervereinbarung\p{L}*`,
  // Sein Leben, nicht unser Vertrag: „mir wurde gekündigt“, „mein Arbeitgeber hat mir gekündigt“, „Job/Wohnung gekündigt“.
  String.raw`(?<![\p{L}])(?:mir|uns)\s+(?:wurde|wird|ist|worden)(?![\p{L}])[^.!?]{0,40}gek(?:ü|ue)ndigt`,
  String.raw`(?<![\p{L}])ich\s+(?:wurde|bin)(?![\p{L}])[^.!?]{0,30}gek(?:ü|ue)ndigt`,
  String.raw`(?<![\p{L}])(?:arbeitgeber\p{L}*|vermieter\p{L}*|chef\p{L}*|betrieb|bank|sparkasse)\s+(?:hat|hatte|haben)\s+(?:\S+\s+){0,4}?gek(?:ü|ue)ndigt`,
  String.raw`(?<![\p{L}])(?:job|arbeit|arbeitsstelle|arbeitsplatz|stelle|wohnung|mietvertrag|ausbildung|lehrstelle)\s+(?:\S+\s+){0,3}?(?:gek(?:ü|ue)ndigt|k(?:ü|ue)ndig\p{L}*)`,
  String.raw`gek(?:ü|ue)ndigt\s+(?:\S+\s+){0,2}?(?:job|arbeit|arbeitsstelle|stelle|wohnung)(?![\p{L}])`,
].join("|"), "iu");
/** Das „wenn“ steht im GRUND hinter dem Austrittswort („… zurückziehen, weil es mir nichts bringt, wenn …“) — keine Bedingung. */
const GRUND_NACH_AUSTRITT = new RegExp(String.raw`(?:${AUSTRITTSWORT.source})[^.!?]*?(?<![\p{L}])(?:weil|da|denn)(?![\p{L}])[^.!?]*?(?<![\p{L}])(?:wenn|falls|solange)(?![\p{L}])`, "iu");
/** Fußzeilen der Mail-Programme — dahinter steht bei vielen Apps unser zitierter Text ohne jede Marke. */
const APP_FUSS = /(?:^|\s)(?:--\s*)?(?:gesendet\s+(?:mit|von|über|ueber)\s+(?:der\s+|dem\s+|meinem\s+|meiner\s+)?[^\n.]{0,40}?(?:app|outlook|iphone|ipad|galaxy|android|smartphone|handy)|von\s+meinem(?:\/meiner)?\s+[^\n.]{0,30}?gesendet|sent\s+from\s+my\s+\w+|get\s+outlook\s+for)/i;

/** Sein eigener Text ohne die Fußzeile seiner Mail-App und alles dahinter (dort beginnt oft unser Zitat). Rein. */
export function eigenerKern(text: unknown): string {
  const t = String(text ?? "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  const m = APP_FUSS.exec(t);
  const kern = (m && m.index > 0 ? t.slice(0, m.index) : t).trim();
  return kern || t.trim();
}

/** Der zitierte Teil einer Mail: alles hinter seinem eigenen Text (kundenTeil) bzw. hinter der Fußzeile seiner Mail-App. Rein. */
export function zitierterTeil(text: unknown): string {
  const t = String(text ?? "");
  let ende = t.length;
  for (const m of ZITAT_BEGINN) { const i = t.search(m); if (i >= 0 && i < ende) ende = i; }
  const fuss = APP_FUSS.exec(t);
  if (fuss && fuss.index > 0 && fuss.index < ende) ende = fuss.index;
  return t.slice(ende).trim();
}

/** Der Grund in seinen Worten (ein Satz mit „weil“, „da ich“, „denn“, „leider“, „Grund“), höchstens 200 Zeichen — sonst leer. Rein. */
export function austrittsGrund(text: unknown): string {
  const t = eigenerKern(text).replace(/\s+/g, " ").trim();
  const s = t.split(/(?<=[.!?])\s+/).find((x) => /\b(?:weil|denn|grund|leider|da\s+(?:ich|mir|mein\w*|sie|ihr|es|der|die|das|kein\w*|nichts))\b/i.test(x));
  return s ? s.slice(0, 200) : "";
}

export type AustrittsUrteil = "klar" | "frage" | "bedingt" | "nichts";
/**
 * Was erklärt er in SEINEN Worten? „klar“ = er will raus (buchen). „frage“ = er fragt oder überlegt (einmal freundlich
 * nachfragen, nie zweimal). „bedingt“ = Drohung oder Bedingung („sonst kündige ich“) — sein Anliegen lösen, Kündigung
 * nicht ansprechen. „nichts“ = kein Austrittswort. Rein; geprüft wird Satz für Satz.
 */
/** Reine Begriffe aus Unterlagen („Widerrufsbelehrung“, „Kündigungsbestätigung“) — keine Erklärung. */
const UNTERLAGEN_WORT = new RegExp(String.raw`wi(?:e)?derr?ufs(?:belehrung|frist|formular)\p{L}*|k(?:ü|ue)ndigungs(?:best(?:ä|ae)tigung|schreiben|datum|urkunde)\p{L}*|beendigungsdatum\p{L}*`, "giu");
/** „beenden“ in jeder Form. */
const BEENDEN_WORT = new RegExp(String.raw`\bbeend\p{L}*`, "iu");
const JA_STARK = new RegExp(String.raw`^(?:ja|jawohl|jap|jo|genau|korrekt|richtig|einverstanden|yes|yep|s[ií]|oui|evet|tak)(?![\p{L}])`, "iu");
const JA_SCHWACH = new RegExp(String.raw`^(?:gerne?|bitte|ok(?:ay)?|in\s+ordnung|passt)(?![\p{L}])`, "iu");
/** „Antrag/Anfrage/Bestellung zurückziehen“ ist ein Austritt — keine Rücknahme einer Kündigung. Rein. */
function antragZurueckAlsStorno(text: string): string {
  return text.replace(/\b(antrag|anfrage|bestellung|auftrag|anmeldung)\b([^.!?\n]{0,40}?)\bzur(?:ü|ue)ck(?:ziehen|zuziehen|nehmen|zunehmen|gezogen|genommen|ziehe|nehme)\b/gi, "$1$2stornieren");
}
/**
 * Nimmt er eine Kündigung zurück? Wie kuendigungRuecknahme — nur zählen „den Antrag zurückziehen“ und, bei einer
 * UNBEZAHLTEN Bestellung, die Absage selbst („Hat sich erledigt“, „kein Bedarf“) nicht dazu: Dort ist das der Austritt. Rein.
 */
export function austrittZurueckgenommen(text: unknown, opt: { unbezahlt?: boolean } = {}): boolean {
  const t = antragZurueckAlsStorno(eigenerKern(text).replace(/\s+/g, " ").trim());
  if (!kuendigungRuecknahme(t)) return false;
  if (opt.unbezahlt && !AUSTRITTSWORT.test(t) && ABSAGE_UNBEZAHLT.test(t.slice(0, 300))) return false;
  return true;
}
export function austrittsWille(text: unknown, opt: { unbezahlt?: boolean } = {}): { urteil: AustrittsUrteil; satz: string | null } {
  const t = antragZurueckAlsStorno(eigenerKern(text).replace(/\s+/g, " ").trim())
    // Reine Begriffe aus Unterlagen („Widerrufsbelehrung“, „Kündigungsbestätigung“) sind keine Erklärung.
    .replace(UNTERLAGEN_WORT, "Unterlage")
    // Abkürzungen beenden keinen Satz („keine Lösung bzw. die Kreditlinie …“).
    .replace(/\b(bzw|z\.\s?B|ca|evtl|ggf|u\.\s?a|Nr|inkl|usw|etc|d\.\s?h|o\.\s?g|vgl|Mag|Dr|Dipl|Ing|Hr|Fr)\./g, "$1");
  if (!t) return { urteil: "nichts", satz: null };
  // Unbezahlte Bestellung: eine klare Absage genügt („hat sich erledigt“, „kein Bedarf“, „alles abgebrochen“) — vor der
  // Rücknahme-Prüfung, die „hat sich erledigt“ sonst als Rücknahme einer Kündigung läse.
  if (opt.unbezahlt && !AUSTRITTSWORT.test(t)) {
    const kurz = t.slice(0, 300);
    if (ABSAGE_UNBEZAHLT.test(kurz) && !/\?/.test(kurz) && !VERNEINT_VOR.test(kurz)) return { urteil: "klar", satz: kurz };
  }
  if (kuendigungRuecknahme(t)) return { urteil: "nichts", satz: null };
  // Nie hinter einer Zahl trennen („bis 15.11. …“, „Rate 2. …“) — sonst verliert der Satz seinen Anfang („Sollte ich bis 15.11. …“).
  const saetze = t.split(/(?<=(?<!\d)[.!;])\s+|\n+|(?<=\?)\s*|\s*[-–—]\s*(?=ich\b)/i).map((s) => s.trim()).filter(Boolean);
  let frage: string | null = null; let bedingt: string | null = null;
  for (const s of saetze) {
    if (!AUSTRITTSWORT.test(s)) continue;
    if (UNSERE_FRAGE.test(s) || AUSTRITT_NICHT_GEMEINT.test(s)) continue;
    if (AUSTRITT_DROHUNG.test(s)) { bedingt ??= s; continue; }
    if (AUSTRITT_FRAGEFORM.test(s)) { frage ??= s; continue; }
    const kein = keinKuendigungsSatz(s);
    if (kein === "bedingung") {
      // „Ich habe längst gekündigt, wenn überhaupt“ und „Ich ziehe den Antrag zurück, weil mir das nichts bringt, wenn …“
      // sind Erklärungen — das „wenn“ steht dort im Grund, nicht vor der Kündigung.
      const grundDanach = GRUND_NACH_AUSTRITT.test(s);
      if (grundDanach || (FRUEHER_ERKLAERT.test(s) && !/\bh(?:ä|ae)tte\b/i.test(s))) return { urteil: "klar", satz: s };
      bedingt ??= s; continue;
    }
    // „beenden ohne Vertrag“ prüft AUSTRITTSWORT selbst (beenden zählt dort nur mit Vertrag, Abo, Verhältnis …).
    if (kein && kein !== "beenden ohne vertrag") continue;
    if (AUSTRITT_AUSKUNFT.test(s)) { frage ??= s; continue; }
    if (/\?\s*$/.test(s) && !AUSTRITT_BITTE.test(s) && !/\bwie\s+oft\b/i.test(s)) { frage ??= s; continue; }
    return { urteil: "klar", satz: s };
  }
  if (frage) return { urteil: "frage", satz: frage };
  if (bedingt) return { urteil: "bedingt", satz: bedingt };
  return { urteil: "nichts", satz: null };
}

/** Hat UNSERE letzte Nachricht gefragt, ob er kündigen/stornieren möchte — in welchem Wortlaut auch immer? Rein. */
export function austrittsFrageGestellt(unsere: unknown): boolean {
  const t = String(unsere ?? "").replace(/\s+/g, " ");
  if (!t) return false;
  return t.split(/(?<=[.!?])\s+/).some((s, i, alle) => {
    const mitWort = AUSTRITTSWORT.test(s) || BEENDEN_WORT.test(s);
    if (mitWort && /\?/.test(s)) return true;
    // „… buchen kann, antworten Sie bitte mit Ja.“ / „Ein kurzes Ja genügt.“ direkt nach dem Satz mit dem Austrittswort.
    const jaBitte = /\bja\b[^.!?]{0,30}\bgen(?:ü|ue)gt\b|\bantworten\s+sie\b[^.!?]{0,60}\bja\b|\bmit\s+(?:einem\s+)?(?:kurzen\s+)?[„"']?ja\b/i;
    return jaBitte.test(s) && (mitWort || (i > 0 && (AUSTRITTSWORT.test(alle[i - 1]) || BEENDEN_WORT.test(alle[i - 1]))));
  });
}

/** Die Anrede vorn weg („Guten Abend, Mara Lindner, Ja …“) — damit ein Ja am Anfang als Ja erkannt wird. Rein. */
function ohneAnrede(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 4; i++) {
    const neu = t
      .replace(/^(?:guten\s+(?:tag|abend|morgen)|hallo|hi|hey|servus|moin|gr(?:ü|ue)(?:ß|ss)\s+gott|sehr\s+geehrte[rs]?(?:\s+(?:damen\s+und\s+herren|frau|herr)\b[^,!.\n]{0,30})?|liebe[rs]?\b[^,!.\n]{0,30}|dear\b[^,!.\n]{0,30})\s*[,!.:]?\s*/i, "")
      .replace(/^(?:(?:frau|fr\.)\s+)?(?:mara\s+)?lindner\s*[,!.:]?\s*/i, "").replace(/^mara\s*[,!.:]\s*/i, "");
    if (neu === t) break;
    t = neu;
  }
  return t;
}
/** Ein Ja mit Vorbehalt („Ja, aber erst …“, „Ja, wenn …“) ist kein Ja. */
const JA_VORBEHALT = /\b(?:aber|wenn|falls|sobald|sofern|vorher|zuerst|jedoch|allerdings|erst\s+(?:wenn|nach|mal)|erstmal|oder|unsicher|wei(?:ß|ss)\s+(?:noch\s+|es\s+)?nicht|noch\s+nicht|sp(?:ä|ae)ter|vielleicht|mal\s+sehen|eigentlich)\b|(?:ü|ue)berleg/i;
/** Ein Ja zu etwas ANDEREM (Zahlung, Termin, Karte …) — kein Ja zur Kündigung, wenn kein Austrittswort dabei steht. */
const JA_ANDERES_THEMA = /(?:ü|ue)berw(?:ie|ei)s|bezahl|\bzahl(?:e|en|ung|t)\b|termin|r(?:ü|ue)ckruf|anruf|\bruf(?:e|en|t)\b|karte|unterlagen|schufa|auskunft|angebot|passwor|zugang/i;
/** Grußformel und Name am Ende („Mit freundlichen Grüßen Max Muster“) — zählt nicht zum Inhalt des Ja. */
const GRUSS_ENDE = /\s*(?:mit\s+freundlichen?\s+gr(?:ü|ue)(?:ß|ss)en?|freundliche\s+gr(?:ü|ue)(?:ß|ss)e|viele\s+gr(?:ü|ue)(?:ß|ss)e|liebe\s+gr(?:ü|ue)(?:ß|ss)e|beste\s+gr(?:ü|ue)(?:ß|ss)e|mfg|lg|vg|gru(?:ß|ss)|kind\s+regards|best\s+regards|regards|danke(?:sch(?:ö|oe)n)?|vielen\s+dank)\b[\s\S]*$/i;
/**
 * Antwortet er mit Ja auf unsere Kündigungs-Rückfrage? Nach der Anrede, ohne Verneinung, ohne Gegenfrage, ohne Vorbehalt
 * („Ja, aber …“) — und nicht als Ja zu etwas anderem („Ja, ich habe überwiesen“). Ein schwaches Wort („Bitte“, „Ok“,
 * „Gerne“) zählt nur allein oder mit einem Austrittswort („Bitte kündigen“). Rein.
 */
export function bejahtAustritt(eigenerText: unknown): boolean {
  const t = ohneAnrede(eigenerKern(eigenerText).replace(/\s+/g, " "));
  if (!t || t.length > 240 || /\?/.test(t)) return false;
  if (/\b(?:nicht|nein|kein\w*|doch\s+nicht|no|not|nie)\b/i.test(t.slice(0, 60))) return false;
  const stark = JA_STARK.exec(t);
  const schwach = stark ? null : JA_SCHWACH.exec(t);
  const wort = stark ?? schwach;
  if (!wort) return false;
  const rest = t.slice(wort[0].length).replace(GRUSS_ENDE, "").replace(/^[\s,.!:;–—-]+/, "").trim();
  const mitAustritt = AUSTRITTSWORT.test(rest) || BEENDEN_WORT.test(rest);
  if (JA_VORBEHALT.test(rest)) return false;
  if (!mitAustritt && JA_ANDERES_THEMA.test(rest)) return false;
  return stark ? (mitAustritt || rest.length <= 80) : (mitAustritt || rest.length <= 25);
}

/**
 * E-499 (WhatsApp): Sein Ja auf Maras verbindliche Rückfrage mit MEHR Worten („Ja bitte Kündigung bestätigen“, „Ja,
 * nehmen Sie die Kündigung auf, da …“) — oder er wiederholt die klare Erklärung statt „Ja“ („Ich kündige“). Vorher
 * zählte nur ein nacktes Ja bis 60 Zeichen: Mara fragte dann noch einmal. Ob Maras neueste Nachricht wirklich die
 * Rückfrage war, prüft der Aufrufer (jaAufKuendigungsAngebot mit „ja“). Kein schwaches Wort allein („Ok“), nie mit
 * Vorbehalt, Rücknahme oder Verneinung. Rein.
 */
export function bestaetigtAustrittBreit(kunde: unknown, opt: { unbezahlt?: boolean } = {}): boolean {
  const t = String(kunde ?? "").replace(/\s+/g, " ").trim();
  if (!t || t.length > 300) return false;
  if (austrittZurueckgenommen(t, opt)) return false;
  if (JA_STARK.test(ohneAnrede(t)) && bejahtAustritt(t)) return true;
  return austrittsWille(t, opt).urteil === "klar";
}

/** Rechtliches über den bloßen Widerruf hinaus: Anwalt, Gericht, Behörde, Polizei, Inkasso, Datenschutz/Löschen, Betrug, Paragrafen … */
const RECHT_MEHR = new RegExp(String.raw`anwalt|anw(?:ä|ae)lt|kanzlei|gericht|klage|anzeige|polizei|staatsanwalt|verbraucher(?:zentrale|schutz)|inkasso|beh(?:ö|oe)rde|aufsicht|bafin|finma|(?<![\p{L}])fma(?![\p{L}])|datenschutz|dsgvo|l(?:ö|oe)sch|straftat|betrug|betr(?:ü|ue)g|juristisch|rechtsschutz|mahnbescheid|schlichtung|ombuds|rechtlich|§|(?<![\p{L}])bgb(?![\p{L}])|rechtswidrig|anfecht|nichtig|sittenwidrig|schadens?ersatz|missbrauch|abzock|vertret|r(?:ü|ue)ck(?:zahl|erstatt|(?:ü|ue)berweis)|erstatt|geld\s+zur(?:ü|ue)ck`, "iu");
/**
 * E-499: Brennt „rechtlich“ nur, WEIL er widerruft? (riegelAnwenden setzt bei jedem Widerruf auch „rechtlich“ — dadurch griff
 * die Ausnahme aus E-369 „Widerruf als Storno der unbezahlten Bestellung gebucht → Mara selbst“ nie.) Wahr nur, wenn die
 * Lampe Widerruf brennt, er nicht bestreitet, nicht mit Anwalt droht und in Betreff und Text kein weiteres rechtliches
 * Wort steht (Anwalt, Gericht, Behörde, Polizei, Inkasso, Datenschutz/Löschen, Betrug, Geld zurück …). Rein.
 */
export function rechtlichNurWegenWiderruf(flags: Partial<Record<string, unknown>> | null | undefined, betreffUndText: unknown): boolean {
  const f = flags ?? {};
  if (!f.widerruf || f.droht_anwalt || f.bestreitet || f.zahlung_behauptet) return false;
  const t = String(betreffUndText ?? "");
  return !RECHT_MEHR.test(t) && !istLoeschwunsch(t);
}

/** Steht UNSERE Kündigungs-Rückfrage im zitierten Teil seiner Mail (nur die jüngste zitierte Nachricht, 1.500 Zeichen)? Rein. */
export function frageImZitat(zitiert: unknown): boolean {
  const z = String(zitiert ?? "").replace(/^[ \t]*>+[ \t]?/gm, "").slice(0, 1500);
  return !!z.trim() && austrittsFrageGestellt(z);
}

/**
 * E-499: Haben wir diesen Menschen schon einmal gefragt, ob er kündigen/stornieren möchte? Aus unserer letzten Antwort
 * (21 Tage, auch ein Entwurf, den ein Mensch aus Gmail gesendet hat) oder aus dem Zitat in seiner Mail. Dann gilt:
 * Sein Ja bucht — und eine zweite Rückfrage gibt es nie. Liest nur.
 */
export async function kuendigungFrageSchon(k: { personId: number | null; postmeisterId?: number | null; zitiert?: string | null }): Promise<boolean> {
  if (frageImZitat(k.zitiert)) return true;
  if (!k.personId) return false;
  const [letzte] = (await sqlPool`
    SELECT antwort FROM fiaon_postmeister
     WHERE person_id = ${k.personId} AND antwort IS NOT NULL
       AND id <> ${k.postmeisterId ?? -1}
       AND created_at > NOW() - INTERVAL '21 days'
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  return austrittsFrageGestellt(letzte?.antwort ?? null);
}

/**
 * Erklärt der Kunde, dass er kündigen oder stornieren will? Satzweise: Erst fallen
 * Sätze mit Verneinung, Bedingung, fremder Person oder fremdem Vertrag heraus
 * (keinKuendigungsSatz), dann gelten die Regel des Kündigungsmoduls
 * (istWillenserklaerung — bei einem formlos kündbaren Vertrag mit der weiten Liste
 * wie bei einer unbezahlten Bestellung, #5625) und die Formen oben, nie in einem
 * Satz mit Frage oder Konjunktiv.
 */
export function kuendigungsWille(text: string, opt: {
  unbezahlt?: boolean; formlos?: boolean;
  istWillenserklaerung: (t: string, o?: { unbezahlt?: boolean }) => boolean;
}): boolean {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  // E-265 Nachbesserung 2 (01.10.2026): Eine Rücknahme IRGENDWO im Text („Ich kündige! ⏎ War ein Scherz") — dann
  // ist der ganze Text keine Erklärung, auch wenn ein früherer Satz klar war (vorher endete die Prüfung dort).
  if (kuendigungRuecknahme(t)) return false;
  const saetze = t.split(/(?<=[.!;\n])\s+|(?<=\?)\s*/).map((s) => s.trim()).filter(Boolean);
  for (const s of saetze) {
    if (keinKuendigungsSatz(s)) continue;
    if (opt.istWillenserklaerung(s, { unbezahlt: !!opt.unbezahlt })) return true;
    if (WILLE_UNSICHER.test(s)) continue;
    if (WILLE_KLAR.some((m) => m.test(s))) return true;
    // Formlos kündbar (Vertrag vor dem 03.09.2026): die klaren Storno-Sätze des Moduls
    // („stornieren Sie alles", „ich will nicht mehr weitermachen") auch bei laufendem Vertrag.
    if (opt.formlos && opt.istWillenserklaerung(s, { unbezahlt: true }) && /(stornier|k(?:ü|ue)ndig|beend|nicht\s+mehr\s+weiter|nicht\s+weiter|aufh(?:ö|oe)ren|wi(?:e)?der(?:r)?uf)/i.test(s)) return true;
  }
  return false;
}

/**
 * Die Sätze SEINES Textes, aus denen das Zitat des Modells stammt (Nachbesserung
 * E-248). Geprüft wird der ganze Satz — ein Zitat „kündigen" aus „ich will nicht
 * kündigen" verliert sonst die Verneinung. Leer, wenn das Zitat nicht in seinem Text steht. Rein.
 */
export function saetzeZumZitat(zitat: string, text: string): string {
  const n = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿąćęłńśźżăîșțşğıœčďěňřšťůž]+/g, " ").trim();
  const z = n(zitat);
  if (z.length < 6) return "";
  const saetze = String(text || "").replace(/\s+/g, " ").split(/(?<=[.!?;])\s+/).map((s) => s.trim()).filter(Boolean);
  const treffer = saetze.filter((s) => { const ns = n(s); return ns.length >= 3 && (ns.includes(z) || z.includes(ns)); });
  if (treffer.length) return treffer.join(" ");
  return n(text).includes(z) ? String(text) : "";
}

/** Steht das Zitat des Modells wirklich in seiner Mail? (Satzzeichen und Groß/Klein egal.) Rein. */
export function zitatInText(zitat: string, text: string): boolean {
  const n = (s: string) => String(s || "").toLowerCase().replace(/[^a-z0-9äöüßàáâãåæçèéêëìíîïñòóôõøùúûýÿąćęłńśźżăîșțşğıœčďěňřšťůž]+/g, " ").trim();
  const z = n(zitat);
  return z.length >= 6 && n(text).includes(z);
}

/** Eine offene Rate, wie der Kündigungssatz sie braucht. */
export interface OffeneRate { nr: number; cents: number; faellig: string | null }

/** Immer mit Cent — „59,99 €“, „7,99 €“ (euroText aus shared kürzt glatte Beträge). */
const rateEuro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
const echteOffeneRaten = (raten: OffeneRate[]) =>
  raten.filter((r) => Number.isFinite(r.nr) && r.nr > 0 && Number.isFinite(r.cents) && r.cents > 0);

/**
 * DER SATZ NACH DER KÜNDIGUNG (26.09.2026, E-244) — rein, im Prüfstand geprüft.
 *
 * Nennt nur, was wirklich offen ist: keine Rate „null", kein „0,00 €". Ist
 * nichts offen, fällt der Satz über die offene Rate weg. `raten = null` heißt:
 * Die Raten konnten nicht gelesen werden — dann steht dort nur der Stand der
 * Kündigung, keine Zahl.
 */
export function kuendigungSatz(weg: string, raten: OffeneRate[] | null, opt: { beendet?: boolean; formlos?: boolean; endeTag?: string | null; laufzeitEnde?: string | null } = {}): string {
  if (weg === "storno_unbezahlt") return "Die Bestellung wurde storniert; es bleibt nichts offen.";
  // E-396 (19.10.2026): Jahresvertrag zum Laufzeitende — er läuft bis zum Ende, die offene Rechnung ist das Kulanz-Angebot.
  if (opt.laufzeitEnde && !opt.beendet && (weg === "laufzeit_ende" || weg === "bereits")) {
    const kopf = weg === "bereits" ? "Die Kündigung lag bereits vor." : "Die Kündigung ist gebucht.";
    const ende = `Der Jahresvertrag läuft bis zum Laufzeitende (${tagDeutsch(opt.laufzeitEnde) ?? opt.laufzeitEnde}); die Raten bis dahin laufen weiter.`;
    if (raten == null) return `${kopf} ${ende} Die offene Rechnung konnte gerade nicht gelesen werden.`;
    const echteL = echteOffeneRaten(raten);
    if (!echteL.length) return `${kopf} ${ende} Es ist keine Rechnung offen.`;
    const summeL = echteL.reduce((s, r) => s + r.cents, 0);
    return `${kopf} ${ende} Kulanz-Angebot: Bezahlt er ${echteL.map((r) => `Rate ${r.nr}`).join(" und ")} über ${rateEuro(summeL)}${echteL.length === 1 && echteL[0].faellig ? ` (fällig ${echteL[0].faellig})` : ""}, endet der Vertrag aus Kulanz vorzeitig — mit dem Zahlungseingang.`;
  }
  // E-265 (01.10.2026, Recht): Altvertrag — „gilt zum Ende Ihres laufenden Abrechnungsmonats, dem <Datum>" (giltZumSatz).
  const giltZum = giltZumSatz(opt.endeTag);
  // E-265 Nachbesserung 2 (01.10.2026): Altvertrag — die Kündigung gilt zum Ende des Abrechnungsmonats; Raten danach entfallen mit ihr.
  if (weg === "sofort_beendet") return opt.formlos
    ? `Die Kündigung ist vermerkt und ${giltZum}; es ist keine Rate mehr offen (Raten für die Zeit danach entfallen).`
    : "Alle fälligen Raten sind bezahlt — der Vertrag ist beendet.";
  if (weg === "kulanz_sofort") return "Der Vertrag ist beendet; offene Raten entfallen.";
  // Storniert oder beendet: nie ein Betrag, auch wenn die Daten eine Rate zeigen (E-244).
  if (weg === "bereits" && opt.beendet) return "Die Kündigung lag bereits vor; der Vertrag ist beendet.";
  const kopf = weg === "bereits" ? "Die Kündigung lag bereits vor." : "Die Kündigung ist vermerkt.";
  if (raten == null) return `${kopf} Die offenen Raten konnten gerade nicht gelesen werden.`;
  const echte = echteOffeneRaten(raten);
  if (!echte.length) return `${kopf} Es ist keine Rate mehr offen.`;
  if (echte.length === 1) {
    const r = echte[0];
    // E-265 Nachbesserung (29.09.2026, Recht): Beim Vertrag vor dem 03.09.2026 endet der Vertrag zum Ende des
    // Abrechnungsmonats — nie „mit dieser Zahlung endet der Vertrag" (die Beendigung hängt nie an der Zahlung, § 312k BGB).
    // E-393 (16.10.2026): Auch beim Jahresvertrag nicht mehr „mit dieser Zahlung endet der Vertrag“ — das Modell übernahm
    // den Satz als „Sobald die Zahlung eingegangen ist, ist Ihr Vertrag beendet“. Es ist der Kulanz-Ausstieg, und so heißt er.
    return `${kopf} Offen bleibt Rate ${r.nr} über ${rateEuro(r.cents)}${r.faellig ? ` (fällig ${r.faellig})` : ""}; ${opt.formlos ? `sie bleibt zu zahlen, die Kündigung ${giltZum}.` : "nach dieser Zahlung lassen wir Sie aus Kulanz vorzeitig aus dem Vertrag."}`;
  }
  const liste = echte.map((r) => `Rate ${r.nr} über ${rateEuro(r.cents)}`);
  const summe = echte.reduce((s, r) => s + r.cents, 0);
  return `${kopf} Offen bleiben ${liste.slice(0, -1).join(", ")} und ${liste[liste.length - 1]}, zusammen ${rateEuro(summe)}; ${opt.formlos ? `sie bleiben zu zahlen, die Kündigung ${giltZum}.` : "nach diesen Zahlungen lassen wir Sie aus Kulanz vorzeitig aus dem Vertrag."}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// WERBESPERRE NUR AUF AUSDRÜCKLICHEN WUNSCH — IM EIGENEN TEXT (E-275, 02.10.2026)
//
// Justin: „Mara soll positiv, verkäuferisch und selbstständig agieren.“ Der
// Anlass: Satpal Jhim (Person 4816) hat FIAON Ultra am 02.08. bezahlt und fragt
// seit dem 03.09. nach seiner Karte. Am 09.09. kam eine Mail ohne eigenen Text
// („Sent from Yahoo Mail for iPhone“ + ein Bild); das Modell ordnete sie als
// „abmeldung“ ein und rief werbesperre_setzen. (Richtigstellung, E-275
// Gegenprüfung: Mail 3644 trug im eigenen Betreff „… bitte not again send me e
// mail for rattan ok“ — ein echter Wunsch, die Sperre war richtig; auch die
// Liste unten erkennt ihn.) Seitdem war er für das Postfach
// „gesperrt“ (nur Übergabe) — und die automatische Einladung der Partnerbank
// ließ ihn aus: Den Kartenlink hat er nie bekommen. Gemessen (nur lesend): 39
// zahlende Stufenpaket-Kunden mit Werbesperre, 27 davon ohne Einladung.
//
// Jetzt zählt nur, was ER schreibt: sein eigener Text (ohne Zitat, ohne
// Signaturzeilen wie „Sent from …“, ohne den Anhang-Hinweis des Laufs) und sein
// Betreff, wenn es KEIN „Re:/AW:“ auf unsere Mail ist (dann ist es unser
// Betreff). Eine leere Mail, eine Signatur oder ein Bild sind NIE ein Wunsch.
// Riegel (riegelAnwenden: Merker „stopp“, Kategorie „abmeldung“) und Werkzeug
// lesen dieselbe Regel. Rein, im Prüfstand geprüft.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Wo ein Mailprogramm seinen Fuß anhängt — nie ein Wort des Kunden. Auch mitten in der Zeile: Die
 * Postfach-Texte kommen oft ohne Zeilenumbruch („Ich habe kein Interesse  Gesendet von Yahoo Mail …“,
 * „STOPVon meinem/meiner Galaxy gesendet“).
 */
const SIGNATUR_BEGINN = /(?:sent\s+from\b|sent\s+with\b|gesendet\s+(?:von|mit|vom|über|ueber)\b|von\s+meine[mrn]?\S*\s+(?:\S+\s+){0,3}?gesendet\b|enviado\s+(?:desde|do)\b|envoy[ée]\s+(?:de|depuis)\b|inviato\s+da\b|verzonden\s+(?:vanaf|met)\b|wys[łl]ane\s+z\b|get\s+outlook\s+for\b|holen\s+sie\s+sich\s+outlook\b|yahoo\s+mail\s*:|diese\s+e-?mail\s+wurde\s+von\s+avast)/i;

/** Sein eigener Text: ohne Anhang-Hinweis des Laufs, ohne Zitat, ohne Signatur. Rein. */
export function eigenerKundentext(text: unknown): string {
  const ohneAnhang = String(text ?? "").split("\n\n[Der Kunde hat ")[0];
  return kundenTeil(ohneAnhang)
    .replace(/&nbsp;/gi, " ")
    .split("\n")
    .filter((z) => !/^\s*(?:--|_{2,})\s*$/.test(z))
    .map((z) => {
      const i = z.search(SIGNATUR_BEGINN);
      return i >= 0 ? z.slice(0, i) : z;
    })
    .join("\n")
    .trim();
}

/** Der Betreff zählt nur, wenn er SEINER ist — ein „Re:/AW:“ trägt unseren Betreff. Rein. */
export function eigenerBetreff(betreff: unknown): string {
  const b = String(betreff ?? "").trim();
  return /^\s*(?:re|aw|antw|sv|wg|fw|fwd|vs)\s*(?:\[\d+\])?\s*:/i.test(b) ? "" : b;
}

/** Hat er selbst etwas geschrieben? Leer, nur Signatur, nur Satzzeichen → nein. Rein. */
export function hatEigenenText(text: unknown, betreff?: unknown): boolean {
  const t = `${eigenerBetreff(betreff)}\n${eigenerKundentext(text)}`;
  return /[a-zA-ZäöüÄÖÜß]{2,}/.test(t.replace(/\[[^\]]*\]/g, " "));
}

/**
 * Was ein ausdrücklicher Wunsch nach „keine Werbung / keine Mails mehr“ ist —
 * bewusst ohne „keine Mail bekommen“ (eine Service-Frage), ohne „belästigen“
 * allein („Ich will Sie nicht belästigen, aber …“) und ohne „löschen“ allein
 * (das prüft istLoeschwunsch).
 */
const STOPP_AUSDRUECKLICH: RegExp[] = [
  /(?:^|[\s.,!?;:„"(])s\s?t\s?o\s?p\s?p?(?=[\s.,!?;:“")]|$)/i,
  /\b(?:abmeld\w*|abbestell\w*|austragen|unsubscribe\w*|verteiler)\b/i,
  /\bkeine\s+(?:\S+\s+){0,2}?(?:werbung|werbemails?|newsletter|angebote|reklame)\b/i,
  /\bkeine\s+weiteren?\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|nachrichten|sms|anrufe|post|erinnerungen|kontaktaufnahme\w*|korrespondenz)\b/i,
  /\bkeine\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|me[ie]l\w*|nachrichten|sms|anrufe|post|informationen|infos?|benachrichtigungen)\s+mehr\b/i,
  /\bbitte\s+keine\s+(?:\S+\s+){0,1}?(?:e-?mails?|mails?|ma[ei]l\w*|me[ie]l\w*|nachrichten|sms|anrufe|post)\b|\bbitte\s+nicht\s+me[a-z]{0,2}h?r\b/i,
  // E-369 (15.10.2026, #6763 Betreff „bitte nicht e mail“ → Mara schickte Kartenlink und Ratenbitte): „bitte nicht (mehr) E-Mail“.
  /\bbitte\s+nicht\s+(?:mehr\s+)?e[\s-]?mails?\b(?!\s*(?:-?adresse|an\b))/i,
  /\b(?:nicht|nie)\s+mehr\s+(?:\S+\s+){0,2}?(?:an)?(?:schreiben|kontaktieren|anrufen|mailen|zuschicken|schicken|senden|belästigen|belaestigen)\b/i,
  /\b(?:kontaktieren|anschreiben|anrufen|schreiben|belästigen|belaestigen|mailen|schicken|senden)\s+(?:sie|ihr|du)\s+mich\s+(?:\S+\s+){0,2}?(?:nicht|nie)\s+mehr\b/i,
  /\bschreib\w*\s+(?:sie\s+|ihr\s+|du\s+)?(?:\S+\s+){0,2}?mir\s+(?:\S+\s+){0,2}?(?:nicht|nie|nichts)\s+mehr\b/i,
  /\bstellen\s+sie\s+(?:\S+\s+){0,3}?\S*(?:mail|nachricht|benachrichtigung|erinnerung)\S*\s+(?:\S+\s+){0,2}?ein\b/i,
  /\bweitere\s+(?:e-?mails?|mails?|nachrichten|schreiben)\s+(?:sind|werden|braucht|bitte)\b|\bw(?:ü|ue)nsche\s+(?:\S+\s+)?keine\b/i,
  /\bwenn\s+(?:ihr|sie|du)\s+mir\s+(?:\S+\s+){0,2}?weiter(?:hin)?\s+(?:\S+\s+){0,2}?(?:schick|schreib|send|mail)/i,
  /\bh(?:ö|oe)r(?:en|t)\s+(?:sie|ihr)\s+(?:\S+\s+){0,4}?auf\b/i,
  /\b(?:nix|nichts)\s+mehr\s+(?:\S+\s+){0,3}?(?:hören|hoeren|bekommen|erhalten|wissen)\b|\bnichts\s+(?:mehr\s+)?mit\s+(?:ihnen|euch|dir|fiaon)\s+zu\s+tun\b/i,
  // Kein Interesse — auch mit Tippfehlern („Keine Interese“, „Nich interesiet“) und in anderen Sprachen.
  /\bkein\w*\s+(?:inter+ess?e?|bedarf)\b|\b(?:nicht|nich)\s+(?:\S+\s+){0,6}?interess?ie?r?t\b|\bnot\s+interested\b|\bnem(?:á|a)m\s+z(?:á|a)ujem\b/i,
  /(?:^|[.!?\n]\s*)n(?:ei|ai)n,?\s+danke\b|\bno,?\s+thanks?\b/i,
  /\b(?:auf\s+(?:das|ihr|dieses)\s+angebot|darauf)\s+verzichten\b|\bhatt?\s+sich\s+(?:\S+\s+)?erledigt\b|\bkenne\s+(?:sie|ihre\s+firma|euch|fiaon)\s+nicht\b/i,
  /\bm(?:ö|oe)chte\s+(?:ihre?n?|die|das|eine?n?)\s+\S+\s+nicht\b(?!\s+(?:verpassen|verlieren|warten|zahlen|bezahlen|vergessen|verpasst|kündigen|kuendigen))/i,
  /\bm(?:ö|oe)chte\s+(?:ich\s+)?(?:\S+\s+)?kein(?:e[nm]?)?\s+(?:abo\w*|vertrag|karte|angebot\w*|dienstleistung\w*)\b|\bbrauche\s+(?:\S+\s+)?keine\s+karte\s+mehr\b/i,
  // Löschen: „Bitte löschen.“, „löschen Sie mich“, „alle Daten zu löschen“ (istLoeschwunsch kennt die ganzen Sätze).
  /^\s*(?:bitte\s+)?l(?:ö|oe)schen[.!]*\s*$|\bbitte\s+l(?:ö|oe)schen\b|\bl(?:ö|oe)schen\s+sie\s+(?:\S+\s+){0,2}?(?:mich|meine|alle|das)\b|\b(?:daten|account|konto|anfrage)\b[^.!?\n]{0,40}\bl(?:ö|oe)schen\b/im,
  /\bnie\s+(?:angemeldet|registriert|angefragt|eingetragen)\b|\b(?:nicht|nichts)\s+(?:angemeldet|registriert|angefragt|eingetragen)\b|\bwiderspreche\w*\b|\bart\.?\s*21\b/i,
  /\bin\s+ruhe\s+lassen\b|\blass\w*\s+(?:sie\s+|ihr\s+)?(?:mich|mir|uns)\s+(?:bitte\s+|endlich\s+)?in\s+ruhe\b/i,
  /\bstop\s+(?:sending|emailing|contacting|writing|messaging)\b|\b(?:do\s+not|don'?t|never)\s+(?:\S+\s+)?(?:send|contact|write|email|e-mail)\s+me\b|\bnot\s+again\s+send\b|\bno\s+more\s+(?:e-?mails?|mails?|messages?)\b|\bremove\s+me\b|\btake\s+me\s+off\b|\bopt\s*-?\s*out\b/i,
];

/**
 * Hat er AUSDRÜCKLICH um „keine Werbung / keine Mails mehr“ gebeten — in SEINEM
 * Text oder SEINEM Betreff? Rein. Für den Riegel (Merker stopp, Kategorie
 * abmeldung) und für werbesperre_setzen.
 */
export function ausdruecklicherStopp(betreff: unknown, text: unknown): boolean {
  const eigen = eigenerKundentext(text);
  const t = `${eigenerBetreff(betreff)}\n${eigen}`.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (STOPP_AUSDRUECKLICH.some((m) => m.test(t)) || stoppWunsch(eigen) || stoppWunsch(eigenerBetreff(betreff))) return true;
  const ab = abstreitenArt(eigen);
  return ab?.art === "in_ruhe" || istLoeschwunsch(eigen);
}

// ── E-275 GEGENPRÜFUNG (02.10.2026, Wahrheit und Recht): DIE LISTE OBEN IST KEIN VETO ──────────
// Justin: „Mara soll positiv, verkäuferisch und selbstständig agieren.“ — und die Wand des Hauses: STOPP heißt keine
// WERBUNG mehr (§ 7 UWG, Art. 21 DSGVO). Gegen die 113 Stopp-Mails seit 01.08. gerechnet (nur lesend) erkennt
// ausdruecklicherStopp 12 nicht — 11 davon mit eigenem Text, darunter echte Wünsche: „schicken sie mir keine Nachricht
// mehr“ (#3149), „jede weitere werbliche Kontaktaufnahme … zu unterlassen“ (#4278), „bittee löschen sie dieses
// account“ (#2797), „Bitte Antrag löschen“ (#5715), „fack off“ (#3879). Als Veto hätte die Liste dort die Werbesperre
// verweigert und den Merker stopp gelöscht (STOPP_KOEPFE: WA-Zentrale, Mara-Aktion, Telefonkartei) — Werbung an
// Menschen, die „Stopp“ gesagt haben. Ein Fehlalarm kostet seit E-275 nur Werbung (der Service für Zahlende läuft
// trotz Sperre), ein verpasster Stopp ist ein Rechtsverstoß. Deshalb: Die Liste verhindert nur, was der 09.09. war —
// eine Sperre aus einer Mail OHNE eigenen Text (Signatur, Bild, leer) oder aus einem Satz, der nicht seiner ist
// (unsere zitierte Mail). Steht das Zitat in SEINEM Text, gilt das Urteil des Modells wie vor E-275.

/** Die Wörter eines Textes (ab drei Buchstaben, klein) — für den Abgleich Zitat ↔ eigener Text. Rein. */
// E-275 (02.10.2026, tsc TS1501): als new RegExp — der tsconfig-Zielstand kennt das Flag „u“ in Literalen nicht; Muster und Flags unverändert.
const WORT_AB_DREI = new RegExp(String.raw`[\p{L}]{3,}`, "gu");
function woerter(text: unknown): string[] {
  return (String(text ?? "").toLowerCase().match(WORT_AB_DREI) ?? []);
}

/**
 * Steht das Zitat (sinngemäß wörtlich) in SEINEM eigenen Text oder Betreff? Mindestens 60 % seiner Wörter — das Modell
 * glättet Tippfehler und Satzzeichen, ein Satz aus unserer zitierten Mail oder eine Signatur trifft so nie. Rein.
 */
export function zitatAusEigenemText(zitat: unknown, betreff: unknown, text: unknown): boolean {
  const z = Array.from(new Set(woerter(zitat)));
  if (!z.length) return false;
  const eigen = new Set(woerter(`${eigenerBetreff(betreff)}\n${eigenerKundentext(text)}`));
  const treffer = z.filter((w) => eigen.has(w)).length;
  return treffer >= Math.min(2, z.length) && treffer / z.length >= 0.6;
}

/**
 * Darf werbesperre_setzen sperren? null = ja, sonst der Satz für das Modell. Ja, wenn die Liste oben den Wunsch
 * erkennt — oder wenn er eigenen Text geschrieben hat und das Zitat daraus stammt (Urteil des Modells, s. o.). Rein.
 */
export function werbesperreUrteil(betreff: unknown, kundeText: unknown, zitat: unknown): string | null {
  if (ausdruecklicherStopp(betreff, kundeText)) return null;
  if (!hatEigenenText(kundeText, betreff)) {
    return "Die Mail hat keinen eigenen Text (nur Signatur, Bild oder leer) — das ist NIE ein Abmeldewunsch. KEINE Werbesperre; sieh in den Betreff und beantworte sein Anliegen.";
  }
  if (zitatAusEigenemText(zitat, betreff, kundeText)) return null;
  return "Das Zitat steht nicht in seinem eigenen Text (Signatur oder unsere zitierte Mail) — KEINE Werbesperre. Bittet er in SEINEN Worten um keine Post mehr, zitiere genau diese Worte; sonst beantworte sein Anliegen.";
}

/** WERBESPERRE — nur auf ausdrücklichen Wunsch, mit Zitat. */
export const werbesperreSetzen: Werkzeug = {
  name: "werbesperre_setzen",
  // E-275 (02.10.2026): Die Prüfung steht jetzt im Werkzeug (ausdruecklicherStopp) — eine leere Mail, eine Signatur
  // oder ein Bild setzten am 09.09. die Sperre, die einem zahlenden Kunden den Kartenlink nahm (Person 4816).
  beschreibung: "Nimmt den Kunden aus allen Werbe- und Erinnerungsmails. NUR wenn er in SEINEM eigenen Text ausdrücklich darum bittet ('keine Mails mehr', 'Stopp', 'abmelden', 'aus dem Verteiler nehmen', 'lassen Sie mich in Ruhe'). Nie bei einer Mail ohne eigenen Text (nur Signatur wie „Sent from …“, nur ein Bild), nie wegen Ärger über eine Mahnung allein, nie wegen eines Satzes aus unserer zitierten Mail. Vertragspost wie Rechnungen bleibt davon unberührt — und der Service für einen zahlenden Kunden (Karte, Zahlung, Fragen) läuft weiter.",
  stufe: "frei",
  // 26.09.2026 (E-244): auch „gesperrt" — dort landen beendete und stornierte
  // Verträge. Genau die schrieben am 24.09. „keine weiteren E-Mails" (Mail 5597)
  // und Mara konnte die Sperre nicht setzen: 5 von 8 offenen Stopp-Entwürfen
  // ohne Werbesperre.
  lagen: ["interessent", "unbezahlt", "zahlung_gemeldet", "bezahlt_ohne_startgespraech", "aktiv", "rate_ueberfaellig", "gekuendigt", "bestreitet", "gesperrt", "unklar"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { zitat: { type: "string", description: "Der wörtliche Satz, mit dem der Kunde darum bittet." } },
    required: ["zitat"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz nicht möglich." };
    if (String(p.zitat || "").trim().length < 5) return { ok: false, ergebnis: "", fehler: "Zitat fehlt." };
    // E-275 (02.10.2026): nur sein eigener Text (oder sein eigener Betreff) zählt. Ohne Kundentext im Kontext
    // (Werkbank, ältere Aufrufer) gilt das Zitat als sein Text — wie bisher.
    const eigen = k.kundeText != null ? String(k.kundeText) : String(p.zitat);
    // E-275 Gegenprüfung (02.10.2026): kein Veto der Liste über seine eigenen Worte — werbesperreUrteil (Kopf oben).
    const nein = werbesperreUrteil(k.betreff ?? "", eigen, p.zitat);
    if (nein) return { ok: false, ergebnis: "", fehler: nein };
    // Zahlungspost-Freigabe (zweite Prüfung, 08.10.2026): sein Wunsch — werbesperre_quelle 'mensch', auch auf eine
    // stehende Werbesperre der Freigabe (fiaon-mail-frequenz.ts, FREIGABE_WERBESPERRE_PERSONEN_SQL).
    await sqlPool`
      UPDATE fiaon_persons SET werbung_gesperrt_am = COALESCE(werbung_gesperrt_am, NOW()), werbesperre_quelle = 'mensch', updated_at = NOW()
       WHERE id = ${k.personId}
    `;
    await protokoll(k, "werbesperre_setzen", `Kunde bittet um Stopp der Werbe- und Erinnerungsmails („${String(p.zitat).slice(0, 120)}") — Werbesperre gesetzt.`);
    return { ok: true, ergebnis: "Der Kunde ist ab sofort aus allen Werbe- und Erinnerungsmails heraus.", daten: { gesperrt: true } };
  },
};

/** MAHNSTOPP — Erinnerungen zu einer Bestellung anhalten. */
export const mahnstoppSetzen: Werkzeug = {
  name: "mahnstopp_setzen",
  beschreibung: "Hält die automatischen Zahlungserinnerungen zu dieser Bestellung an. NUR wenn der Kunde eine Zahlung belegt, einen konkreten Einwand nennt (falscher Betrag, doppelt abgebucht) oder ausdrücklich um eine Ratenpause bittet. NICHT, weil er nicht zahlen will, wütend ist oder erst eine Antwort möchte — die Forderung bleibt, und die Antwort gibst du selbst.",
  stufe: "frei",
  // 08.09.2026 (E-167, Justin): Mara bekommt dieses Werkzeug nicht mehr angeboten —
  // die Erinnerungen laufen, bis die Zahlung gebucht ist. `lagen: []` statt Löschen,
  // damit alte Entwürfe und das Protokoll (werkzeugFinden) den Namen weiter kennen.
  lagen: [],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { grund: { type: "string", description: "Warum die Erinnerungen anhalten sollen." } },
    required: ["grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = COALESCE(mahnstopp_am, NOW()), updated_at = NOW() WHERE ref = ${k.ref}`;
    await protokoll(k, "mahnstopp_setzen", `Zahlungserinnerungen angehalten — ${String(p.grund || "").slice(0, 200)}`);
    return { ok: true, ergebnis: "Die automatischen Erinnerungen zu dieser Bestellung sind angehalten.", daten: { mahnstopp: true } };
  },
};

/** ZAHLUNGSSEITE — der eine Weg zu Bankdaten. Nie IBAN im Prompt. */
export const zahlungslinkBauen: Werkzeug = {
  name: "zahlungslink_bauen",
  beschreibung: "Liefert die Zahlungsseite zu einer offenen Rechnung: QR-Code, Bankdaten, Verwendungszweck, Betrag. Nutze sie immer, wenn es um eine Zahlung geht — nenne NIE Bankdaten aus dem Gedächtnis, sondern verlinke diese Seite.",
  stufe: "frei",
  lagen: ["unbezahlt", "zahlung_gemeldet", "rate_ueberfaellig", "gekuendigt", "aktiv"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { referenz: { type: "string", description: "Zahlungs- oder Ratenreferenz aus der Akte, z. B. FIAON-ABC123 oder FIAON-ABC123-3." } },
    required: ["referenz"],
  },
  async ausfuehren(p, k) {
    const ref = String(p.referenz || "").trim().toUpperCase();
    if (!/^FIAON-?[A-Z0-9]{6}(-\d{1,2})?$/.test(ref)) return { ok: false, ergebnis: "", fehler: "Referenz sieht nicht wie eine Zahlungsreferenz aus." };
    const { zahlungsauftragFinden } = await import("./fiaon-zahlungsauftrag");
    const z = await zahlungsauftragFinden(ref);
    if (!z) return { ok: false, ergebnis: "", fehler: "Zu dieser Referenz gibt es keinen offenen Auftrag." };
    // E-272: Beim Global-Kunden keine Zahlungsseite einer Privatbestellung — und VOR der Neufreischaltung
    // unten, die eine abgelaufene Privatbestellung wieder öffnet und ihm die Zahlungsdaten erneut mailt.
    const privatBeiGlobal = await privatReferenzBeiGlobal(k, z);
    if (privatBeiGlobal) return { ok: false, ergebnis: "", fehler: privatBeiGlobal };
    if (z.status === "paid") return { ok: false, ergebnis: "", fehler: "Diese Rechnung ist bereits bezahlt — sag das dem Kunden, statt zu einer Zahlung aufzufordern." };
    // E-265 Schluss-Nachbesserung (01.10.2026): Eine stornierte Rate wird nie verlangt (vorher baute das Werkzeug auch ihre Seite).
    if (z.status === "cancelled") return { ok: false, ergebnis: "", fehler: "Diese Rate ist storniert — sie wird nicht verlangt. Keine Zahlungsaufforderung, kein Betrag dazu." };
    // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 M3): Altvertrag gekündigt, die Rate ist erst NACH dem Vertragsende
    // fällig (#5779: gekündigt 06.09., Rate 3 fällig 06.10.) — nie verlangt, also keine Zahlungsseite und nie „letzte Rate".
    if (z.art === "rate") {
      const { rateNachVertragsende } = await import("./fiaon-kuendigung");
      const nach = await rateNachVertragsende(ref).catch(() => null);
      if (nach) return { ok: false, ergebnis: "", fehler: `Rate ${nach.nr} ist erst am ${nach.faellig} fällig — NACH dem Vertragsende (seine Kündigung gilt zum ${nach.ende}, Vertrag vor dem 03.09.2026). Sie wird nie verlangt: keine Zahlungsseite, kein Betrag, nie „letzte Rate“. Sag ihm, dass seine Kündigung zum ${nach.ende} gilt — unabhängig von jeder Zahlung — und dass für die Zeit danach nichts verlangt wird.` };
    }
    // E-248 (#5500): Eine Zahlungsseite „über null €" hilft niemandem.
    if (!(Number(z.amountDue) > 0)) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung ist noch kein Betrag hinterlegt — keine Zahlungsaufforderung, keinen Betrag nennen; der Betreuer trägt Paket und Betrag nach (aufgabe_an_betreuer)." };
    // E-248: In einer Antwort auf Stopp, Widerruf, Beschwerde, Bestreiten … keine Zahlungsseite.
    if (k.ruhe) return { ok: false, ergebnis: "", fehler: `Diese Antwort ist keine Zahlungsaufforderung (${k.ruhe}) — beantworte sein Anliegen, ohne Zahlungsseite.` };
    // E-264 (29.09.2026): Ohne abgeschickten Antrag gibt es keinen Vertrag und keine Rechnung — die
    // Bestellung (approved + pending_payment ab Schritt 3–5) ist nur ein Zwischenstand des Formulars.
    if (z.art === "bestellung" && !(await bestellungAbgeschickt(String(z.paymentReference)))) {
      return { ok: false, ergebnis: "", fehler: "Sein Antrag ist nie abgeschickt — es gibt keine Rechnung und keine Zahlungsseite. Kein Wort vom Bezahlen; der Schritt ist sein Antrag (Knopf „antrag“)." };
    }

    // (Bis 19.09.2026 stand hier der Einzugsschutz — GoCardless ist beendet, E-194.
    //  Jede offene Rate wird überwiesen; die Zahlungsseite gilt für alle.)

    // Nachbesserung E-248: Eine ABGELAUFENE Bestellung (payment_status 'expired',
    // 96 in Produktion) zeigt auf der Zahlungsseite das rote Band „abgelaufen …
    // kontaktieren Sie den Support". Der Kunde HAT sich gemeldet — also schaltet
    // Mara sie selbst neu frei (derselbe Weg wie der Knopf im Agentenportal), statt
    // ihm die Sackgasse zu schicken.
    let neuFrei = false;
    if (z.status === "expired") {
      neuFrei = await abgelaufeneBestellungFreischalten(String(z.paymentReference)).catch(() => false);
      if (!neuFrei) return { ok: false, ergebnis: "", fehler: "Die Bestellung ist abgelaufen und konnte nicht neu freigeschaltet werden — schick keine Zahlungsseite; sein Betreuer schaltet sie frei (aufgabe_an_betreuer)." };
      await protokoll(k, "zahlungslink_bauen", `Abgelaufene Bestellung ${z.paymentReference} neu freigeschaltet (neue Zahlungsfrist 7 Tage).`);
    }
    const url = absoluteUrl(`/zahlung/${z.paymentReference}`);
    return {
      ok: true,
      ergebnis: `Zahlungsseite für ${z.paymentReference} über ${z.amountDue} €.${neuFrei ? " Die Bestellung war abgelaufen — ich habe sie gerade neu freigeschaltet, die Zahlungsseite gilt wieder (neue Frist 7 Tage)." : ""}`,
      daten: { zahlungsseite: url, betrag: z.amountDue, verwendungszweck: z.paymentReference, faellig: z.dueDate, art: z.art, rate_nr: z.rateNr ?? null },
    };
  },
};

/** TERMINLINK — der stärkste Hebel im Haus (Faktor 6 bei der Zahlungsquote). */
export const terminlinkBauen: Werkzeug = {
  name: "terminlink_bauen",
  beschreibung: "Liefert einen persönlichen Terminlink für ein 15-Minuten-Gespräch. Nutze ihn, wenn ein Gespräch mehr bringt als eine Erklärung: Unsicherheit, Ärger, komplizierte Lage, Kündigungswunsch.",
  stufe: "frei",
  lagen: "alle",
  parameter: { type: "object", additionalProperties: false, properties: {}, required: [] },
  async ausfuehren(_p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz nicht möglich." };
    // E-248: Steht schon ein Termin, gibt es keinen zweiten Link — Mara nennt den Termin,
    // so wie ein Mensch („Florentine ruft Sie morgen um 20 Uhr an"). Dieselbe Regel wie auf WhatsApp.
    const steht = await bestehenderTermin(k.personId);
    if (steht) {
      return { ok: false, ergebnis: "", fehler: `Er hat schon einen Termin: ${steht.vorname ? `${steht.vorname} ruft ihn ` : ""}${steht.kundenText}${steht.vorname ? " an" : ""}. Keinen Link schicken — nenne ihm genau diesen Termin.` };
    }
    const { terminLink } = await import("./fiaon-termine");
    const url = terminLink(k.personId, "postmeister");
    return { ok: true, ergebnis: "Terminlink erzeugt — sein persönlicher Kalender, er wählt selbst eine Zeit.", daten: { terminlink: url } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// KARTE SENDEN — DER LINK DER PARTNERBANK VON MARA SELBST (E-275, 02.10.2026)
//
// Justin: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber
// selbstständig arbeiten … Mara soll selbst verkaufen." Der Anlass (#6120,
// 02.10.): „I have not your kaditkarte“ — Mara antwortete „The card itself is
// issued and sent by the bank … I have asked Nikita Boychenko to check this
// today". Ein Werkzeug, mit dem sie den Kartenlink selbst schicken kann, gab es
// nicht; gemessen 18.09.–02.10.: 88 Kartenfragen auf WhatsApp, 62 % mit
// Übergabe oder Termin beantwortet.
//
// Das Werkzeug liest zuerst den handgepflegten Bank-Stand der Akte
// (kartenLage: beantragt, in Produktion, versandt …) — dann gibt es keinen
// neuen Link. Sonst ruft es die EINE Funktion aus dem Bereich Karte:
// karteEinladungFuerPerson (server/lib/fiaon-konto-karte.ts). Sie prüft
// Ausschlüsse, Konto, Zahlung und Angaben, schickt die Einladung (oder erneut)
// und liefert den Satz für den Kunden (satz) samt Grund (intern). Aufruf:
// karteEinladungFuerPerson(personId, { erneut, quelle, akteurName, postmeisterId })
// → { ok, aktion, satz, intern, gesendet, grund, schonAm, betreff }.
// Fehlt sie, schickt das Werkzeug NICHTS und sagt das dem Modell — nie „der
// Link ist raus" ohne Versand. Je Mail höchstens ein Versand (E-246).
// ═══════════════════════════════════════════════════════════════════════════

/** Was karteEinladungFuerPerson (Bereich Karte, fiaon-konto-karte.ts) liefert — tolerant gelesen (alle Felder außer ok optional). */
export interface KarteEinladungErgebnis {
  /** Der Kunde hat jetzt seinen Link (oder sein Konto steht schon). */
  ok: boolean;
  /** gesendet · erneut_gesendet · schon_unterwegs · konto_steht · nicht_bereit · gesperrt · fehler */
  aktion?: string | null;
  /** Der Satz für den Kunden (Sie-Form, Deutsch) — null: nichts für ihn, Übergabe. */
  satz?: string | null;
  /** Für Akte, Protokoll und Übergabe — nie an den Kunden. */
  intern?: string | null;
  /** Ging JETZT eine Mail raus? */
  gesendet?: boolean;
  /** Warum nicht. */
  grund?: string | null;
  fehler?: string | null;
  /** Zuletzt geschickt VOR diesem Aufruf (ISO). */
  schonAm?: string | Date | null;
  /** Betreff der Einladung, wie sie rausging. */
  betreff?: string | null;
}
/** Die Signatur aus dem Bereich Karte (E-275), wie das Postfach sie ruft. */
export type KarteEinladungFn = (personId: number, opt?: {
  /** true (Vorgabe): auch wenn schon einmal geschickt (der Kunde hat ihn nicht oder nicht mehr). */
  erneut?: boolean;
  /** Wer auslöst — für Verlauf und Mail-Protokoll. */
  quelle?: string;
  akteurName?: string;
  postmeisterId?: number | null;
}) => Promise<KarteEinladungErgebnis>;

/** Für den Prüfstand: eine Attrappe statt der echten Funktion (undefined = echte laden). */
export const KARTE_EINLADUNG_QUELLE: { fn?: KarteEinladungFn | null } = {};

/** Die Funktion aus dem Bereich Karte — null, wenn sie (noch) nicht da ist. */
export async function karteEinladungLaden(): Promise<KarteEinladungFn | null> {
  if (KARTE_EINLADUNG_QUELLE.fn !== undefined) return KARTE_EINLADUNG_QUELLE.fn;
  try {
    const m: any = await import("./fiaon-konto-karte");
    return typeof m?.karteEinladungFuerPerson === "function" ? (m.karteEinladungFuerPerson as KarteEinladungFn) : null;
  } catch {
    return null;
  }
}

/** Der Satz für den Kunden, wenn der Link jetzt raus ist und die Funktion keinen eigenen liefert — Justins wahrer Weg. Rein. */
export function karteGesendetSatz(ein: { erneut: boolean; betreff?: string | null }): string {
  // Der Betreff der Vorlage endet mit dem Vornamen („…, Satpal“) — zitiert wird nur der feste Teil.
  const betreff = String(ein.betreff || "").split(",")[0].trim() || "Ihr Link zur Karte ist da";
  return `Den fertigen Link unserer Partnerbank für Ihren Kartenantrag habe ich Ihnen ${ein.erneut ? "eben noch einmal" : "eben"} geschickt — in einer eigenen E-Mail mit dem Betreff „${betreff}“. `
    + "Der Antrag bei unserer Partnerbank dauert online nur wenige Minuten, Sie brauchen nur Ihren Ausweis. "
    + KARTE_ZEIT_SATZ;
}

/** Was die Bank-Stände der Akte (fiaon-kartenstatus.ts) für die Antwort heißen — kein neuer Link, wenn die Karte schon unterwegs ist. */
const KARTE_STAND_SATZ: Record<string, string> = {
  beantragt: "Sein Kartenantrag liegt bei der Partnerbank — sie prüft ihn gerade. Nach ihrer Zusage ist die Karte in der Regel in 2–5 Werktagen bei ihm, meist vorher schon in der App mit Apple Pay nutzbar. KEIN neuer Link.",
  in_produktion: "Seine Karte wird gerade hergestellt — sie ist in der Regel in wenigen Werktagen bei ihm, meist vorher schon in der App der Bank mit Apple Pay nutzbar. KEIN neuer Link.",
  versandt: "Seine Karte ist auf dem Postweg zu ihm — in der App der Bank kann er sie meist schon mit Apple Pay nutzen. KEIN neuer Link.",
  zugestellt: "Seine Karte ist laut Akte zugestellt. Frag freundlich, ob sie angekommen ist; PIN und Freischaltung kommen von der Bank (App der Bank). KEIN neuer Link.",
  zurueck: "Die Kartensendung kam zur Bank zurück — er soll seine Anschrift in der App der Bank prüfen; dann schickt die Bank sie erneut. KEIN neuer Link.",
  abgelehnt: "Die Bank hat den Kartenantrag abgelehnt. Sag es ihm ehrlich und warm, ohne Vorwurf, und biete das Gespräch an (terminlink_bauen) — dort besprechen wir die nächsten Schritte. KEIN neuer Link.",
};

export const karteSenden: Werkzeug = {
  name: "karte_senden",
  beschreibung: "Schickt einem ZAHLENDEN Kunden den fertigen Link unserer Partnerbank für Konto und Karte (die Einladung „Ihr Link zur Karte ist da“) — oder schickt ihn erneut, wenn er ihn nicht hat. Rufe es IMMER, wenn ein zahlender Kunde nach seiner Karte fragt („wann kommt meine Karte“, „habe keine Karte / keinen Link bekommen“, „Link verloren“, „I have not your card“). Es prüft vorher selbst den Stand: Ist die Karte schon beantragt, in Produktion, versandt oder sein Konto schon eröffnet, schickt es nichts und sagt dir, was gilt; fehlen Angaben, sagt es dir welche. Liefert es so_schreiben, nimm diesen Satz (in seiner Sprache). Nie „die Bank macht das, nicht wir“, nie „ich habe Herrn X gebeten“.",
  stufe: "frei",
  lagen: ["aktiv", "rate_ueberfaellig", "bezahlt_ohne_startgespraech"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      anlass: { type: "string", description: "In einem Satz, was der Kunde zur Karte geschrieben hat (z. B. „hat keinen Kartenlink bekommen“) — steht im Verlauf." },
    },
    required: ["anlass"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Personendatensatz gibt es keinen Kartenlink." };
    const anlass = String(p.anlass || "").trim().slice(0, 200) || "Kunde fragt nach seiner Karte";
    // E-246: je Mail höchstens EIN Versand — auch wenn das Modell zweimal ruft oder ein Anlauf nach der KI-Pause wiederholt.
    const frueher = await frueherInDieserMail(k, "karte_senden");
    if (frueher != null) {
      return { ok: true, ergebnis: `Zu dieser Mail schon erledigt — nicht noch einmal: ${frueher}`, daten: { gesendet: false, schon_in_dieser_mail: true } };
    }
    // Der handgepflegte Bank-Stand: Ist die Karte schon unterwegs, gibt es keinen neuen Link.
    const { kartenLage } = await import("./fiaon-kartenstatus");
    const bank = await kartenLage(k.personId).catch(() => null);
    const bankStand = bank?.status && KARTE_STAND_SATZ[bank.status] ? bank.status : null;
    if (bankStand) {
      return {
        ok: true,
        ergebnis: `Stand der Karte laut Akte: ${bank!.text}${bank!.am ? ` (seit ${new Date(bank!.am as any).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })})` : ""}. ${KARTE_STAND_SATZ[bankStand]}`,
        daten: { gesendet: false, karten_status: bankStand },
      };
    }
    const senden = await karteEinladungLaden();
    if (!senden) {
      return { ok: false, ergebnis: "", fehler: "Der Versand des Kartenlinks ist gerade nicht verfügbar (karteEinladungFuerPerson fehlt) — schreib NICHT, der Link sei raus. Erkläre ihm den Weg positiv und gib dem Team still Bescheid (notiz_an_betreuer: „Kartenlink erneut schicken“)." };
    }
    const erg: KarteEinladungErgebnis = await senden(k.personId, {
      erneut: true, quelle: "postmeister", akteurName: "Mara (Postmeister)", postmeisterId: k.postmeisterId ?? null,
    }).catch((e: any): KarteEinladungErgebnis => ({ ok: false, aktion: "fehler", gesendet: false, grund: String(e?.message || e).slice(0, 200) }));
    const aktion = String(erg?.aktion || (erg?.gesendet ? "gesendet" : erg?.ok ? "schon_unterwegs" : "fehler"));
    const satz = erg?.satz ? String(erg.satz) : null;
    const intern = String(erg?.intern || erg?.grund || erg?.fehler || "").slice(0, 300);
    // Nichts gesendet, aber ein Satz für ihn (Angaben fehlen, Zahlung offen): das ist SEINE Antwort — kein Mensch nötig.
    if (!erg?.ok && aktion === "nicht_bereit" && satz) {
      return { ok: true, ergebnis: satz, daten: { gesendet: false, aktion, so_schreiben: satz, intern } };
    }
    // E-IT-B (08.10.2026): An seine Adresse kommt nichts an (bei unserem Mailversand gesperrt, abgewiesen, Spam) —
    // es ging NICHTS raus und nichts wurde entsperrt (Justin, 08.10.). Kein „schauen Sie im Spam-Ordner“: Er soll
    // seine richtige Adresse nennen; eintragen und erneut senden tut ein Mensch in der Akte.
    if (!erg?.ok && aktion === "adresse_gesperrt" && satz) {
      await protokoll(k, "karte_senden", `Karte (adresse_gesperrt): ${intern || "Adresse gesperrt"} — Anlass: ${anlass}.`, false);
      return {
        ok: true, ergebnis: satz,
        daten: { gesendet: false, aktion, so_schreiben: satz, intern,
          hinweis: "Nichts ging raus. Nennt er eine andere Adresse, gib sie mit notiz_an_betreuer weiter (Adresse unter „Daten“ ändern, dann in der Akte „E-Mail erneut senden“)." },
      };
    }
    if (!erg?.ok) {
      // Ausschluss (Sperre, Kündigung, Global …) oder Versand gescheitert: ein Fall für das Team — dem Kunden nichts versprechen.
      return {
        ok: false, ergebnis: "",
        fehler: aktion === "gesperrt"
          // E-531 (25.11.2026): ehrlich, aber ohne „jemand meldet sich“ — der Satz ohne Zeit und ohne Namen.
          ? `Für ihn gibt es keinen Kartenlink (${intern || "Ausschluss"}) — schreib NICHT, der Link sei raus. Gib es mit aufgabe_an_betreuer weiter und sag ihm ehrlich: „${E531_UEBERGABE_SATZ}“`
          : `Der Kartenlink ging nicht raus (${intern || "Versand gescheitert"}) — schreib NICHT, er sei unterwegs. Erkläre den Weg und gib dem Team still Bescheid (notiz_an_betreuer).`,
      };
    }
    const soSchreiben = satz ?? (erg.gesendet ? karteGesendetSatz({ erneut: aktion === "erneut_gesendet" || !!erg.schonAm, betreff: erg.betreff ?? null }) : null);
    // Der Verlauf der Akte bekommt seinen Eintrag von der Funktion selbst — hier nur die Handlung an der Mail-Zeile.
    await protokoll(k, "karte_senden", `Karte (${aktion}): ${intern || (erg.gesendet ? "Link der Partnerbank geschickt" : "kein Versand")} — Anlass: ${anlass}.`, false);
    return {
      ok: true,
      ergebnis: soSchreiben ?? `Stand Konto und Karte: ${intern || aktion}.`,
      daten: { gesendet: !!erg.gesendet, aktion, so_schreiben: soSchreiben, zuerst_am: erg.schonAm ?? null },
    };
  },
};

/** KONTO FREISCHALTEN — nur wenn bezahlt und Startgespräch erledigt. */
export const kontoFreischalten: Werkzeug = {
  name: "konto_freischalten",
  beschreibung: "Schaltet den Kundenbereich frei. Nur möglich, wenn die erste Zahlung eingegangen ist. Nutze das, wenn ein bezahlter Kunde nicht in seinen Bereich kommt, obwohl er dürfte.",
  stufe: "bestaetigen",
  lagen: ["bezahlt_ohne_startgespraech", "aktiv"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { grund: { type: "string", description: "Warum die Freischaltung jetzt richtig ist." } },
    required: ["grund"],
  },
  async ausfuehren(p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    const [a] = (await sqlPool`SELECT payment_status, account_status FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[];
    if (!a || a.payment_status !== "paid") return { ok: false, ergebnis: "", fehler: "Ohne Zahlungseingang wird nichts freigeschaltet." };
    await sqlPool`
      UPDATE fiaon_applications
         SET account_status = 'active', freigeschaltet_am = COALESCE(freigeschaltet_am, NOW()), updated_at = NOW()
       WHERE ref = ${k.ref}
    `;
    await protokoll(k, "konto_freischalten", `Kundenbereich freigeschaltet — ${String(p.grund || "").slice(0, 200)}`);
    return { ok: true, ergebnis: "Der Kundenbereich ist freigeschaltet.", daten: { login: absoluteUrl("/login") } };
  },
};

/** VERMERK — reine Notiz in der Akte, ohne Aufgabe. */
export const vermerkSchreiben: Werkzeug = {
  name: "vermerk_schreiben",
  beschreibung: "Hält etwas in der Kundenakte fest, ohne jemanden zu behelligen. Nutze das für alles, was ein Kollege beim nächsten Kontakt wissen sollte.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: { text: { type: "string", description: "Was in die Akte soll." } },
    required: ["text"],
  },
  async ausfuehren(p, k) {
    const t = String(p.text || "").trim();
    if (t.length < 5) return { ok: false, ergebnis: "", fehler: "Vermerk zu kurz." };
    await protokoll(k, "vermerk_schreiben", t.slice(0, 800));
    return { ok: true, ergebnis: "In der Akte vermerkt." };
  },
};

/** ESKALATION ANKÜNDIGEN — der Schritt vor dem Inkasso, immer mit Mensch. */
export const eskalationVorbereiten: Werkzeug = {
  name: "eskalation_vorbereiten",
  beschreibung: "Bereitet die Übergabe einer offenen Forderung an das Forderungsmanagement vor: Aufgabe an die Leitung mit allen Zahlen. Nutze das, wenn ein Kunde die Zahlung ausdrücklich verweigert. Die Übergabe selbst entscheidet ein Mensch — kündige dem Kunden nichts an, was noch nicht entschieden ist.",
  stufe: "frei",
  lagen: ["rate_ueberfaellig", "gekuendigt", "bestreitet", "unbezahlt"],
  parameter: {
    type: "object", additionalProperties: false,
    properties: { zitat: { type: "string", description: "Der Satz, mit dem der Kunde die Zahlung verweigert." } },
    required: ["zitat"],
  },
  async ausfuehren(p, k) {
    const wer = await zustaendig(k.personId);
    // E-343 (13.10.2026): „offen" schloss die noch nicht fälligen Raten bis Vertragsende ein —
    // die Leitung las den Restvertrag als Rückstand. Jetzt getrennt: fällig (bis heute, Berlin)
    // und künftig.
    const [z] = k.ref ? (await sqlPool`
      SELECT COALESCE(SUM(betrag_cents) FILTER (WHERE faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date), 0)::int AS cents,
             COUNT(*) FILTER (WHERE faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS n,
             COALESCE(SUM(betrag_cents) FILTER (WHERE faellig_am > (NOW() AT TIME ZONE 'Europe/Berlin')::date), 0)::int AS kuenftig_cents,
             COUNT(*) FILTER (WHERE faellig_am > (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS kuenftig_n,
             MAX(mahnstufe)::int AS stufe
        FROM fiaon_abo_raten WHERE ref = ${k.ref} AND status = 'offen'
    `) as any[] : [null];
    const geld = (c: unknown) => (Number(c || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const summe = z ? (Number(z.cents) / 100).toFixed(2) : "0.00";
    const kuenftig = Number(z?.kuenftig_n || 0) > 0 ? ` · künftig ${z.kuenftig_n} Rate(n) über ${geld(z.kuenftig_cents)} € (noch nicht fällig)` : "";
    const text = `Kunde verweigert die Zahlung: „${String(p.zitat || "").slice(0, 200)}". Fällig: ${z?.n ?? 0} Rate(n) über ${geld(z?.cents)} €${kuenftig}, höchste Mahnstufe ${z?.stufe ?? 0}. Bitte anrufen, bevor die Forderung ins Forderungsmanagement geht.`;
    await protokoll(k, "eskalation_vorbereiten", text);
    // 05.09.2026: Daniel: „hier würde ich gerne anrufen … aber wer ist das?"
    // Der Titel trägt jetzt den Namen, der Link führt in die Mitarbeiter-Akte
    // (vorher /chef/s/akte — für Mitarbeiter unerreichbar), und derselbe Kunde
    // bekommt nicht bei jeder Mail eine weitere Aufgabe (Schlüssel je Referenz).
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const kundenName = await kundenNameFuer(k.personId, k.ref);
    await auftragFuerKunden({
      personId: k.personId, ref: k.ref,
      titel: `${kundenName ? `${kundenName}: ` : ""}Zahlung verweigert — Anruf vor Eskalation`.slice(0, 160),
      text, faelligAm: new Date().toISOString().slice(0, 10), dringend: true,
      schluessel: `postmeister:eskalation:${k.ref ?? k.personId ?? k.postmeisterId ?? "x"}`,
      quelle: "postmeister", autorName: "Mara", agentId: wer.id ?? null, anBetreiber: !!wer.board,
    }).catch(() => {});
    // Vertretung (01.10.2026): Zahlungsverweigerung ist heikel — der Betreiber sieht sie zusätzlich.
    // Gegenprüfung: Die erste Regel erkannte „Kunde verweigert die Zahlung" (Anfang dieses Texts) nicht;
    // heikleUebergabe kennt sie jetzt, und der Titel geht mit in die Prüfung.
    if (wer.vt?.anVertreter && heikleUebergabe(`Zahlung verweigert\n${text}`)) {
      await betreiberKopie({
        personId: k.personId, ref: k.ref, titel: `${kundenName ? `${kundenName}: ` : ""}Zahlung verweigert — Anruf vor Eskalation`,
        text, dringend: true, schluessel: `postmeister:eskalation:${k.ref ?? k.personId ?? k.postmeisterId ?? "x"}`, quelle: "postmeister",
      }, wer.vt);
    }
    // E-393: vorher „ruft Sie an, bevor etwas eskaliert“ — eine Drohung, die das Modell wörtlich übernahm. Was eskaliert,
    // entscheidet die Leitung; dem Kunden wird nichts angekündigt (so sagt es auch die Beschreibung oben).
    return { ok: true, ergebnis: `${wer.kundenName} ruft Sie dazu an.`, daten: { offen_euro: summe, kuenftig_euro: z ? (Number(z.kuenftig_cents) / 100).toFixed(2) : "0.00", betreuer: wer.kundenName } };
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE WAND FÜR FIAON GLOBAL (17.09.2026, E-188)
//
// Ein Firmenkunde von FIAON Global schreibt an dasselbe Postfach — die Mails des
// Bestellwegs bitten ihn sogar darum („Antworten Sie einfach auf diese E-Mail").
// Seine Bestellung ist für die Akte eine Bestellung wie jede andere, seine Lage
// „unbezahlt" oder „aktiv" — und damit bekäme Mara Werkzeuge angeboten, die für
// einen Auftrag über 2.499 € und mehr falsch sind:
//   · kuendigung_vormerken  storniert eine unbezahlte Bestellung SOFORT und spricht
//                           sonst von zwölf Monatsraten — einen Firmenauftrag
//                           storniert nur die Leitung (fiaon-global-storno.ts),
//   · mahnstopp_setzen      gehört zur Mahnkette der Privatkunden; FIAON Global hat
//                           seinen eigenen ruhigen Takt (fiaon-global-zahlungstakt.ts),
//   · eskalation_vorbereiten übergibt an das Forderungsmanagement der Abo-Raten,
//   · konto_freischalten    öffnet den PRIVATKUNDENBEREICH — den es für ihn nicht gibt,
//   · terminlink_bauen      führt in den Kalender des Privatvertriebs.
// Ein Satz im Prompt wäre eine Bitte. Die Wand steht deshalb VOR der Ausführung,
// für jeden Aufrufer (Modell, Vorab-Aufruf, Freigabe in der Werkbank): Sie liest
// die Bestellung des Vorgangs und lehnt mit einem Satz ab, der dem Modell sagt,
// was stattdessen zu tun ist. Erlaubt bleiben Zahlungsseite, Rechnung, Notiz,
// Aufgabe, Vermerk, Werbesperre — und das eigene Werkzeug global_zugang_senden.
// Für jeden Vorgang OHNE Global-Bestellung ändert sich nichts.
//
// E-272 (02.10.2026): Die Wand erkennt FIAON Global jetzt auch an der PERSON
// (istGlobalKunde, fiaon-global-kunde.ts) — nicht nur an der Bestellung des
// Vorgangs. Justin zum Fall Hildbrand: „nehme ihn bitte komplett aus den
// Workflows … Er soll Global bleiben, also keine unnötigen Mails.“ Er hatte
// ein Individualangebot und KEINE Global-Bestellung, sein Vorgang war ein
// alter Privatantrag — die Wand stand für ihn offen. Dazu: Zahlungsseite und
// Rechnung gibt es für einen Global-Kunden nur zu seinem Global-Auftrag (oder
// einer Auskunft), nie zu einer Privatbestellung (privatReferenzBeiGlobal).
// „Gemischte“ (bezahltes Stufenpaket) sind keine Global-Kunden: für sie gilt
// die Wand wie bisher nur an einer Global-Bestellung.
// ═══════════════════════════════════════════════════════════════════════════
// 24.09.2026 (E-240): auskunft_anbieten — die Auskunft zu 74/149 € gehört zur
// Privatkundenlinie; ein Firmenkunde bekommt keine Privat-Auskunft angeboten.
export const NUR_PRIVATKUNDEN_WERKZEUGE = new Set<string>([
  "kuendigung_vormerken", "mahnstopp_setzen", "eskalation_vorbereiten", "konto_freischalten", "terminlink_bauen",
  "auskunft_anbieten",
  // E-275 (02.10.2026): Konto und Karte der Partnerbank sind ein Privatprodukt — nie an einen Kunden von FIAON Global (E-272).
  "karte_senden",
]);

/** Rein: Darf dieses Werkzeug in diesem Vorgang laufen? `null` = ja; sonst der Satz für das Modell. */
export function globalWerkzeugSperre(werkzeug: string, istGlobalVorgang: boolean): string | null {
  if (werkzeug === "global_zugang_senden") {
    return istGlobalVorgang ? null : "Dieses Werkzeug gibt es nur für Firmenaufträge über FIAON Global. Privatkunden melden sich unter fiaon.com/login an.";
  }
  if (!istGlobalVorgang || !NUR_PRIVATKUNDEN_WERKZEUGE.has(werkzeug)) return null;
  // E-272: „Kunde von FIAON Global“ statt „Firmenauftrag“ — die Wand gilt auch ohne Auftrag (nur Angebot).
  return "Das ist ein Kunde von FIAON Global (Firmenauftrag oder Individualangebot) — dieses Werkzeug gehört zur Privatkundenlinie und läuft hier nicht. "
    + "Storno, Beendigung, Erstattung und Zahlungsfragen entscheidet die Leitung mit der zuständigen Person: "
    + "Gib das Anliegen mit aufgabe_an_betreuer weiter (mit Zitat) und sage dem Kunden nur zu, was die Aufgabe deckt. "
    + "Kein Wort über Monatsraten, Kündigungsfristen, Mahnungen oder den Kundenbereich — das alles gibt es bei FIAON Global nicht.";
}

/**
 * Gehört dieser Vorgang zu FIAON Global? Entschieden an der Bestellung — ohne Bestellung an ALLEN Bestellungen der Person.
 * E-272 (02.10.2026): UND an der Person — ist sie ein Global-Kunde (istGlobalKunde: Individualangebot oder
 * lebende Global-Bestellung, kein bezahltes Stufenpaket), gehört jeder ihrer Vorgänge zu FIAON Global, auch ein
 * alter Privatantrag. Die Prüfungen von vorher bleiben (ein Global-Auftrag eines „Gemischten“ bleibt Global).
 */
export async function istGlobalVorgang(k: Pick<WerkzeugKontext, "personId" | "ref">): Promise<boolean> {
  try {
    let personId = k.personId ?? null;
    if (k.ref) {
      const [a] = (await sqlPool`SELECT pack_key, person_id FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[];
      if (istGlobalPaket(a?.pack_key)) return true;
      if (!personId && a?.person_id != null) personId = Number(a.person_id);
    } else if (k.personId) {
      const zeilen = (await sqlPool`
        SELECT pack_key FROM fiaon_applications
         WHERE person_id = ${k.personId} AND merged_into IS NULL AND archived_at IS NULL`) as any[];
      if (zeilen.length > 0 && zeilen.every((z) => istGlobalPaket(z.pack_key))) return true;
    }
    if (personId) return await istGlobalKunde(personId);
  } catch (e) {
    console.error("[POSTMEISTER] Global-Wand konnte die Bestellung nicht lesen:", String(e).slice(0, 160));
  }
  return false;
}

/**
 * E-272 (02.10.2026): Ist der Mensch dieses Vorgangs ein Global-Kunde und gehört die Zahlungs- oder
 * Ratenreferenz zu einer PRIVATBESTELLUNG (Stufenpaket oder dessen Rate)? Dann der Satz für das Modell,
 * sonst null. Sein Global-Auftrag (firmenauftrag) und eine Auskunft (produkt „auskunft“, etwa die Firmen-
 * Auskunft für seinen Kapitalantrag) bleiben frei. Ein bezahltes Stufenpaket gibt es bei einem
 * Global-Kunden nicht (dann wäre er „gemischt“) — eine Privatreferenz ist hier also immer eine offene
 * Privatforderung, und die gehört nicht in eine Antwort an FIAON Global.
 */
export async function privatReferenzBeiGlobal(
  k: Pick<WerkzeugKontext, "personId">, z: { firmenauftrag?: boolean; produkt?: string },
): Promise<string | null> {
  if (!k.personId || z.firmenauftrag || z.produkt === "auskunft") return null;
  if (!(await istGlobalKunde(k.personId).catch(() => false))) return null;
  return "Diese Referenz gehört zu einer Privatbestellung — dieser Mensch ist Kunde von FIAON Global. Keine Zahlungsseite, keine Rechnung "
    + "und kein Betrag aus der Privatkundenlinie. Geht es ihm um diese alte Bestellung, gib das Anliegen mit aufgabe_an_betreuer weiter (mit Zitat).";
}

/**
 * ZUGANG ZU „MEIN AUFTRAG" — der Firmenkunde hat kein Passwort. Ist sein Link
 * abgelaufen oder verloren, bekommt er einen frischen: an die Adresse SEINES
 * Auftrags, nie an eine andere (server/lib/fiaon-global-zugang.ts).
 */
export const globalZugangSendenWerkzeug: Werkzeug = {
  name: "global_zugang_senden",
  beschreibung: "NUR für Firmenaufträge über FIAON Global: schickt dem Kunden einen frischen Link zu seiner Seite „Mein Auftrag“ (Stand, Vertrag, Rechnung, Unterlagen, Fristen). Nutze das, wenn sein Link abgelaufen oder verloren ist oder er fragt, wo er Vertrag, Rechnung oder seine Unterlagen findet. Der Link geht ausschließlich an die E-Mail-Adresse des Auftrags — nenne ihm keine andere Anmeldung, es gibt für ihn kein Passwort.",
  stufe: "frei",
  lagen: "alle",
  parameter: { type: "object", additionalProperties: false, properties: {}, required: [] },
  async ausfuehren(_p, k) {
    if (!k.ref) return { ok: false, ergebnis: "", fehler: "Ohne Bestellung nicht möglich." };
    // E-246: je Mail höchstens EIN Link — auch wenn das Modell zweimal ruft oder
    // ein Anlauf nach der KI-Pause die Mail noch einmal bearbeitet.
    if ((await frueherInDieserMail(k, "global_zugang_senden")) != null) {
      return { ok: true, ergebnis: "Der Link zu „Mein Auftrag“ ist zu dieser Anfrage schon an die E-Mail-Adresse des Auftrags unterwegs.", daten: { verschickt: 0, schon_verschickt: true } };
    }
    const [g] = (await sqlPool`SELECT email FROM fiaon_global_auftraege WHERE ref = ${k.ref} LIMIT 1`.catch(() => [])) as any[];
    if (!g?.email) return { ok: false, ergebnis: "", fehler: "Zu dieser Bestellung gibt es keinen unterschriebenen Auftrag — gib das Anliegen mit aufgabe_an_betreuer weiter." };
    const { globalZugangSenden } = await import("./fiaon-global-zugang");
    const n = await globalZugangSenden(String(g.email), { ref: k.ref, ohneDrossel: true, ausgeloestVon: "Postmeister (Anfrage des Kunden per E-Mail)" });
    if (n < 1) return { ok: false, ergebnis: "", fehler: "Der Link ließ sich nicht verschicken (Auftrag storniert oder Versand abgelehnt) — gib das Anliegen mit aufgabe_an_betreuer weiter." };
    await protokoll(k, "global_zugang_senden", "Frischer Link zu „Mein Auftrag“ an die Adresse des Auftrags geschickt.", false);
    return { ok: true, ergebnis: "Der Link zu „Mein Auftrag“ ist an die E-Mail-Adresse des Auftrags unterwegs.", daten: { verschickt: n } };
  },
};

/** Stellt die Wand vor ein Werkzeug — die Beschreibung und die Parameter bleiben, wie sie sind. */
function mitGlobalWand(w: Werkzeug): Werkzeug {
  if (!NUR_PRIVATKUNDEN_WERKZEUGE.has(w.name) && w.name !== "global_zugang_senden") return w;
  return {
    ...w,
    async ausfuehren(p, k) {
      const sperre = globalWerkzeugSperre(w.name, await istGlobalVorgang(k));
      if (sperre) return { ok: false, ergebnis: "", fehler: sperre };
      return w.ausfuehren(p, k);
    },
  };
}

// ── E-458 (Justin 29.10.2026): RÜCKRUF „BEI ARAS“ PER MAIL ────────────────
// „ARAS telefoniert nur noch die Termine oder die Leute, die einen Anruf wollen.“ Will er angerufen werden, bietet Mara ihm
// in ihrer Antwort ARAS an — mit dem KI-Hinweis und einem Zeitfenster —, und erst auf sein Ja (seine nächste Mail) trägt sie
// ein. Der Server prüft dafür ihre letzte gesendete Antwort an ihn (ARAS und KI müssen darin stehen); sonst wird nichts
// eingetragen. Angeboten nur, wenn ARAS Rückrufe annimmt (werkzeugeFuerLage, `arasRueckruf`; in Stufe 0 nie).
const rueckrufBeiAras: Werkzeug = {
  name: "rueckruf_bei_aras",
  beschreibung: "Trägt einen Anruf von ARAS (unsere digitale Mitarbeiterin, eine KI) in einem Zeitfenster ein. NUR, wenn der Kunde angerufen werden will UND in dieser Mail Ja sagt auf dein früheres Angebot, dass ARAS (eine KI) ihn anruft. Hat er noch nicht zugestimmt, biete es ihm in deiner Antwort an, in EINER Frage: „Unsere digitale Mitarbeiterin ARAS – eine KI – kann Sie morgen zwischen 14 und 16 Uhr anrufen. Passt Ihnen das?“ (Montag bis Samstag, 09:30 bis 21 Uhr, ein bis zwei Stunden) — eingetragen wird erst nach seinem Ja. Will er lieber einen Menschen: aufgabe_an_betreuer mit rueckruf_am.",
  stufe: "frei",
  lagen: "alle",
  parameter: {
    type: "object", additionalProperties: false,
    properties: {
      von: { type: "string", description: "Fensterbeginn „YYYY-MM-DD HH:MM“ (Berlin) — das Fenster, dem er zugestimmt hat." },
      bis: { type: "string", description: "Fensterende „YYYY-MM-DD HH:MM“ (Berlin)." },
      anliegen: { type: "string", description: "Ein bis zwei Sätze für ARAS: worum es ihm geht." },
    },
    required: ["von", "bis", "anliegen"],
  },
  async ausfuehren(p, k) {
    if (!k.personId) return { ok: false, ergebnis: "", fehler: "Ohne Kundendatensatz kein Anruf von ARAS — gib den Rückruf an den Betreuer (aufgabe_an_betreuer mit rueckruf_am)." };
    const [angebot] = (await sqlPool`
      SELECT antwort FROM fiaon_postmeister
       WHERE person_id = ${k.personId} AND gesendet_am > NOW() - INTERVAL '7 days' AND antwort IS NOT NULL ${k.postmeisterId ? sqlPool`AND id <> ${k.postmeisterId}` : sqlPool``}
       ORDER BY gesendet_am DESC LIMIT 1`.catch(() => [])) as any[];
    const [pers] = (await sqlPool`SELECT primary_phone FROM fiaon_persons WHERE id = ${k.personId}`.catch(() => [])) as any[];
    const { arasRueckrufEintragen } = await import("./fiaon-aras-wunsch");
    const { wunschLesen } = await import("./fiaon-mara-termin");
    const r = await arasRueckrufEintragen({
      personId: k.personId, nummer: String(pers?.primary_phone ?? ""), kanal: "mail",
      von: wunschLesen(p?.von), bis: wunschLesen(p?.bis), anliegen: String(p?.anliegen ?? ""),
      angebot: angebot?.antwort ? String(angebot.antwort) : null, antwort: k.kundeText ?? null,
    });
    if (!r.ok) return { ok: false, ergebnis: "", fehler: r.meldung };
    await protokoll(k, "rueckruf_bei_aras", `Rückruf bei ARAS (KI) eingetragen: ${r.text}.${p?.anliegen ? ` ${String(p.anliegen).slice(0, 200)}` : ""}`);
    return { ok: true, ergebnis: `Eingetragen: Unsere digitale Mitarbeiterin ARAS ruft Sie ${r.text} an.`, daten: { rueckruf_termin: r.text, bei: "aras", termin_id: r.terminId } };
  },
};

/** Alle Werkzeuge, in der Reihenfolge, in der das Modell sie sehen soll. */
// E-275 (02.10.2026): karte_senden direkt nach der Zahlungsseite — Karte und Zahlung sind Maras eigene Arbeit.
export const POSTMEISTER_WERKZEUGE: Werkzeug[] = [
  zahlungslinkBauen, karteSenden, rechnungAnhaengen, auskunftAnbieten, terminlinkBauen, notizAnBetreuer, aufgabeAnBetreuer, vermerkSchreiben,
  kuendigungVormerken, werbesperreSetzen, mahnstoppSetzen, eskalationVorbereiten, kontoFreischalten,
  globalZugangSendenWerkzeug, rueckrufBeiAras,
].map(mitGlobalWand);

/**
 * Welche Werkzeuge in dieser Lage angeboten werden. 25.09.2026 (E-241):
 * `auskunftAntwort` = die Mail antwortet auf das Angebot der Auskunft oder der
 * Kunde fragt selbst danach — dann gibt es auskunft_anbieten auch bei einem
 * offenen Antrag oder einem Lead (AUSKUNFT_ANTWORT_LAGEN), sonst dort nie.
 * E-458: `arasRueckruf` = ARAS nimmt gerade Rückrufe an — nur dann gibt es rueckruf_bei_aras.
 */
export function werkzeugeFuerLage(lage: Kundenlage, opts: { auskunftAntwort?: boolean; werbesperre?: boolean; arasRueckruf?: boolean } = {}): Werkzeug[] {
  return POSTMEISTER_WERKZEUGE.filter((w) => w.lagen === "alle" || w.lagen.includes(lage)
    || (w.name === "auskunft_anbieten" && !!opts.auskunftAntwort && AUSKUNFT_ANTWORT_LAGEN.includes(lage)))
    // E-275 (02.10.2026): Werbesperre beim zahlenden Kunden — Service ja, Verkauf nein: kein Angebot der Auskunft.
    .filter((w) => !(opts.werbesperre && w.name === "auskunft_anbieten"))
    .filter((w) => w.name !== "rueckruf_bei_aras" || opts.arasRueckruf === true);
}

/** Das Format, das OpenAI erwartet. */
export function werkzeugeAlsTools(lage: Kundenlage, opts: { auskunftAntwort?: boolean; werbesperre?: boolean; arasRueckruf?: boolean } = {}): unknown[] {
  return werkzeugeFuerLage(lage, opts).map((w) => ({
    type: "function",
    function: { name: w.name, description: w.beschreibung, parameters: w.parameter },
  }));
}

export function werkzeugVonName(name: string): Werkzeug | undefined {
  return POSTMEISTER_WERKZEUGE.find((w) => w.name === name);
}

/**
 * E-264 (29.09.2026): Ist die Bestellung zu dieser Zahlungsreferenz ein abgeschickter Antrag
 * (antragAbgeschickt, EINE Regel)? Unbekannte Referenz: false.
 */
export async function bestellungAbgeschickt(zahlungsReferenz: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT status, current_step, submitted_at FROM fiaon_applications
     WHERE payment_reference = ${zahlungsReferenz} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
  return !!a && antragAbgeschickt(a);
}

/**
 * Eine abgelaufene Bestellung neu freischalten (Nachbesserung E-248) — für Mara auf
 * Mail und WhatsApp. Derselbe Weg wie der Knopf „Reaktivieren" im Agentenportal
 * (reactivateOrderByRef: neue 7-Tage-Frist, Zahlungsdaten erneut per Mail).
 * true = die Bestellung ist jetzt offen (pending_payment).
 */
export async function abgelaufeneBestellungFreischalten(zahlungsReferenz: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT ref, payment_status, status, current_step, submitted_at FROM fiaon_applications
     WHERE payment_reference = ${zahlungsReferenz} AND merged_into IS NULL LIMIT 1`.catch(() => [])) as any[];
  if (!a) return false;
  // E-264 (29.09.2026): Eine nie abgeschickte Bestellung ist kein Vertrag — nie reaktivieren, nie „offen".
  if (!antragAbgeschickt(a)) return false;
  if (a.payment_status === "pending_payment") return true;
  if (a.payment_status !== "expired") return false;
  const { reactivateOrderByRef } = await import("../routes/fiaon-antrag");
  const r = await reactivateOrderByRef(String(a.ref));
  if (r) console.log(`[MARA] Abgelaufene Bestellung ${zahlungsReferenz} neu freigeschaltet.`);
  return !!r;
}
