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
//
// ── E-248 (28.09.): BEZIEHUNG, WAHRHEIT, SCHWEIGEN, PERSÖNLICHER LINK ─────
// Justin: „Mara soll Beziehungen zu den Kunden aufbauen, super freundlich,
// nicht ‚wir sind keine Bank', sondern MUT machen … Merkst du nicht, dass Mara
// gar nicht den persönlichen Link, sondern nur /antrag sendet?"
//   · Stimme aus EINER Quelle (shared/fiaon-mara-ton.ts: personaText,
//     tonPruefung, linkPruefung) — gleiche Sätze für Mail und WhatsApp.
//   · Wahre Quellen: Maras Lage kennt seinen Termin (kuenftigerTermin), den
//     verpassten Termin, seine Stufe, seine offene Zahlung, die letzte
//     Team-Nachricht (STAND DES GESPRÄCHS). Uhrzeiten werden in jeder
//     Schreibweise erkannt („20 Uhr", „20Uhr", „um 8") — in beide Richtungen.
//   · Schweigen (fiaon-mara-schweigen.ts): Autoantworten, „Ok" nach dem Team,
//     „Ok" nach erledigter Sache (einmal ein kurzer warmer Abschluss).
//   · Link: immer sein persönlicher (stufeAusAntrag + persoenlicherLink), nie
//     fiaon.com/antrag; die Prüfung ist hart (linkPruefung).
//   · Rückfallsatz nur als letztes Mittel: erst ein zweiter Entwurf mit den
//     ERLAUBTEN Werten, dann ein sicherer Satz aus der Lage — nie auf ein
//     reines „Ok", nie zweimal in zwei Stunden.
//   · Aufgaben: eine je Mensch und Grundklasse, Aktenvermerk nur beim ersten
//     Mal, „dringend" nur bei heiklen Anliegen, Geld oder Rückruf ohne Termin.
//
// E-264 (29.09.2026): „Hab nix beantragt 🤢🤮😡😤😠" bekam „Sehr gern — nach der
// Zahlung ist Ihr Account aktiv … Ihre Zahlungsseite". Seitdem:
//   · Die Stufe kommt aus EINER Regel „abgeschickt" (shared/fiaon-antrag-stand.ts):
//     approved + pending_payment vor Schritt 8 ist ein ANGEFANGENER Antrag —
//     Wiedereinstieg, nie Zahlungsseite, nie Reaktivierung, kein Zahltag.
//   · Abstreiten, Irrtum, Datenfrage (abstreitenArt) und „Löschen Sie meine
//     Daten" beantwortet ein fester Satz ohne Modell: Entschuldigung, ehrliche
//     Herkunft, Werbe-Stopp über die Werbesperre, Aufgabe an die Leitung.
//   · Der sichere Satz liest „beantragt" nie als Frage nach dem Antrag.
//
// E-272 (02.10.2026, Fall Hildbrand — Justin: „nehme ihn bitte komplett aus den Workflows … Er soll Global
// bleiben, also keine unnötigen Mails“): Einem Global-Kunden (die eine Regel, fiaon-global-kunde.ts) antwortet
// Mara NIE — kein fester Satz, kein Modell, kein Rückruf, kein Verkauf. maraAntwortet legt EINE Aufgabe der
// Klasse „global“ auf Justins Board und setzt die Nachricht still; versandLauf verwirft jede schon vorbereitete
// Antwort an ihn. „Gemischte“ (bezahltes Stufenpaket) behalten Mara wie jeder Privatkunde.
//
// ── E-275 (02.10.2026): MARA ERLEDIGT SELBST, VERKAUFT — UND SCHICKT DEN KARTENLINK ──
// Justin: „MARA verweist immer mehr auf die Mitarbeiter, Mara soll aber selbstständig arbeiten ohne jedes mal ein
// Termin zu vereinbaren (Whatsapp aber natürlich auch per mail!) Mara soll selbst verkaufen … Aber nicht immer sagen
// ‚Ich mache einen Termin mit XY‘ oder ‚Wir sind keine Bank und können nichts wissen‘ Mara soll positiv, verkäuferisch
// und selbstständig agieren." Gemessen (18.09.–02.10.): Übergaben auf WhatsApp 23 % → 45 %, 306 von 546 freien
// Antworten nannten einen Mitarbeiter, 113 „ruft Sie an/meldet sich“; von 88 Kartenfragen gingen 55 an Übergabe,
// Uhrzeit oder Termin — Mara konnte den Link der Partnerbank gar nicht selbst schicken. Seitdem:
//   · Werkzeug karte_link_schicken (zahlende Kunden, auch bei Werbesperre — Service, keine Werbung): der Link über
//     die eine Regel des Bereichs Karte (karteEinladungFuerPerson, fiaon-konto-karte.ts). Fragt ein zahlender Kunde
//     nach Karte oder Link (fragtNachKarte), holt der Server ihn vorab — wie den bestätigten Rückruf (E-265 f06).
//   · Der Auftrag: Termin und Anruf nur, wenn er telefonieren will oder ein zugesagter Anruf ausfiel; kein „X meldet
//     sich/prüft/klärt“, wo Mara selbst antworten kann; andere Sprache, Bild/Datei, „habe überwiesen“ sind keine
//     Übergabe mehr. Der Abschluss bittet ums Zahlen (Justins wahrer Satz, shared/fiaon-karten-weg.ts).
//   · Werbesperre beim zahlenden Kunden: kein Upsell — Service (Karte, Rate, Unterlagen) voll.
//   · Weiche Prüfung (verkaufsPruefung, anrufOk): ungefragter Anruf/Termin und „X meldet sich“ → zweiter Entwurf.
//   Grenzen bleiben: STOPP, Kündigung/Widerruf/Erstattung/Beschwerde über Geld/Rechtsdrohung → Mensch; E-272 Global
//   unverändert; Wahrheits- und Verkaufsprüfung (E-248), keine Limit-Zusage, nie „Karte in Produktion“ vor der Bankzusage.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { kiAufruf, antwortLesen, agentNamen } from "./fiaon-postmeister-agent";
// E-458 / E-262 D: eigenes Modell je Aufgabe (vorher schaltete POSTMEISTER_MODELL Postfach, Aktion und WhatsApp gemeinsam).
import { kiModell } from "./fiaon-ki-kasse";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { waSenden, sendePruefung, fensterOffen, empfaengerNamen } from "./fiaon-whatsapp";
import { anweisungBlock } from "./fiaon-mara-anweisung";
import { zahlLesen } from "@shared/fiaon-ki-schalter";
import { gedaechtnisText, gedaechtnisMerken } from "./fiaon-mara-gedaechtnis";
import { wissenFakten } from "@shared/fiaon-wissen";
import { paketPreisCents, PAKETE } from "@shared/fiaon-pakete";
import {
  personaText, tonPruefung, linkPruefung, persoenlicherLink, stufeAusAntrag, zeitFuerKunde, uhrzeitenIn, datumFuerKunde,
  abweichungsSatz, type AbweichungsGrund, stornoUngefragt,
  abstreitenArt, istLoeschwunsch, loeschenAngeboten, bausteinAbstreiten, loeschAntwort, nachAbstreiten, stoppWunsch, willWeitermachen,
  abstreitenHinweis, WUT_EMOJI, type AbstreitenBefund, type AbstreitenFestArt, type AbstreitenArt,
  bausteinKreditFrage, bausteinVorabZahlen, bausteinZoegern, bausteinAblehnung, bausteinZuTeuer, bausteinSicher, paketName, paketPreisText,
  type LinkLage, type LinkStufe, type TonBefund, type LinkBefund,
  // E-265 (29.09.2026): Nachnamen und die Kreditkarte
  nennAus, type NennformEin, bausteinAbschluss, bausteinWasIstFiaon, bausteinKeineKarte, bausteinKuendigung, bausteinKuendigungFrage,
  abschlussPruefung, abschlussArtAus, kartenZiel, kartenzielText, kaufSignal, einwandSignal, fragtWasIstFiaon, fragtKeineKarte, kuendigungsFrage,
  kuendigungBitte, jaAufKuendigungsAngebot,
  KUENDIGUNG_REGEL_TEXT, BANK_SATZ, bankSatzErgaenzen, limitNennen, ohneLimitUndBankSatz, type KartenZiel, type AbschlussArt,
  bankSatzNurAufNachfrage, bankSatzNurWennGefragt, bankSatzRegel, bankZusatz, FRAGT_NACH_RAHMEN,
  // E-265 Nachbesserung (29.09.2026)
  bausteinVorkasse, bausteinZuTeuerKarte, naechstKleineresPaket, einwandVertrauen, fragtKreditinstitut, kuendigungFristFrage,
  kuendigungRatenAufteilen, einstiegVonEntwurf, type LetzteRaus, type KuendigungRate,
  // E-265 Nachbesserung 2 (01.10.2026): Kündigung in zwei Schritten
  KUENDIGUNG_RUECKFRAGE, KUENDIGUNG_RUECKFRAGE_MUSTER, KUENDIGUNG_ANGEBOT_FRAGE, bausteinKuendigungRueckfrage, euroGanz, BANK_SATZ_MUSTER,
  // E-265 Schluss-Nachbesserung (01.10.2026): die Storno-Form, Vertragsmail, Kündigung an Zahlung, Limit-Frage
  STORNO_RUECKFRAGE, rueckfrageFuer, verbindlicheRueckfrage, fragtLimit, bausteinLimitFrage, kenntUns,
  // E-275 (02.10.2026): Kartenfrage, Justins Satz, die Bitte ums Zahlen
  fragtNachKarte, ZAHL_FRAGE, KARTE_ZEIT_WA,
  // E-275 Ton (02.10.2026): die klare Aufforderung zur ersten Zahlung und der Nutzen dahinter
  AKTIVIERUNG_AUFRUF, NACH_DEM_EINGANG, TEMPO_SATZ,
  // E-373 (15.10.2026): Justins Verkaufssatz auch für Stufe A.
  nachDerZuordnung,
  // E-275 Gegenprüfung Verkauf: ungefragter Anruf und Abgabe an einen Kollegen — eine Regel für WhatsApp und Mail
  selbstErledigtTreffer,
  // E-276 (02.10.2026): Justins Satz mit seinem Verwendungszweck am Satzanfang; die Lücken-Fassung steht jetzt in shared
  // (die Mara-Aktion braucht dieselbe) und wird hier weiter exportiert.
  NACH_DEM_EINGANG_SATZ, mitAntragLuecke,
} from "@shared/fiaon-mara-ton";
export { mitAntragLuecke };
import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
import { raumPfad } from "@shared/fiaon-wa-raum";
import { nennform, vornamenErsetzen, mitarbeiterVornameFunde, MITARBEITER_NAMEN_KURZ, type Nennform, type MitarbeiterEintrag } from "@shared/fiaon-mitarbeiter-name";
import { mitarbeiterListe } from "./fiaon-mitarbeiter-namen";
// E-265 (01.10.2026, Paket Recht): Das Vertragsende beim Altvertrag — Ende des Abrechnungsmonats (vertragsendeLesen), giltZumSatz.
import { istJahresvertrag, giltZumSatz, tagDeutsch } from "@shared/fiaon-antrag-stand";
// E-396 (19.10.2026): Jahresvertrag zum Laufzeitende — das Ende und DIE EINE Kulanz-Fassung.
import { laufzeitSatz, kulanzSatz, RECHTE_SATZ } from "@shared/fiaon-jahresvertrag";
import { schweigen, abschlussSatz, istBestaetigung, msVon, type SchweigenUrteil } from "./fiaon-mara-schweigen";
import { WA_VORLAGEN, AUSKUNFT_VORLAGE } from "@shared/fiaon-lead-texte";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { berlinTagZeit } from "@shared/fiaon-auftrag-arten";
import {
  AUSKUNFT_KOSTENLOS_ANTWORT, AUSKUNFT_NUTZEN_SATZ_KARTE, AUSKUNFT_PREISE_CENTS, auskunftWort, auskunfteienText, euroText,
  AUSWERTUNG_NAME, AUSWERTUNG_UNTERLAGEN_SATZ, AUSWERTUNG_KEINE_AUSKUNFT_SATZ, AUSWERTUNG_INKLUSIVE_SATZ,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { fragtNachAuskunftSelbst, lehntAuskunftAb, bezogenAufAuskunftAngebot } from "@shared/fiaon-postmeister-typen";
// E-253 (28.09.2026): menschSperre statt personSperre — fiaon_whatsapp.person_id wird beim Zusammenführen
// nicht umgehängt; zeigte sie auf eine Dublette, läse Mara deren Wegweiser-Marke als „Vertriebssperre".
import { menschSperre, werbungVerboten, KOPF_SQL } from "./fiaon-mail-frequenz";
// E-272 (02.10.2026): die eine Regel „Global-Kunde“ — Mara antwortet ihm nie selbst (maraAntwortet, versandLauf).
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { absoluteUrl } from "../fiaon-base-url";
import { zuletztAngeboten } from "./fiaon-auskunft";
import { kiPausiert, istKiPause, kiPauseLesen } from "./fiaon-ki-pause";
import { waPauseLesen, waAllesZu } from "./fiaon-wa-bremse";
// E-275 (02.10.2026): die Typen des Kartenwegs (Bereich Karte) — der Code selbst wird erst beim Aufruf geladen.
import type { KarteEinladungAkteur, KarteEinladungErgebnis } from "./fiaon-konto-karte";
// E-372 (15.10.2026): dieselben Regeln wie das Postfach (E-369) — Behördenpost und der ausdrückliche Rückrufwunsch.
import { BEHOERDE, rueckrufGewollt } from "./fiaon-postmeister-lauf";
// E-372: nur der Typ — das Modul selbst wird dynamisch geladen (es importiert dieses hier).
import type { WaEntscheidungsLage } from "./fiaon-whatsapp-entscheidungen";
// E-401 (2/6, 19.10.2026): der genannte Termin auch auf WhatsApp — Erkennung und Antwortprüfung rein (shared), das
// Eintragen im Server-Modul (nur der Typ statisch; geladen wird es beim Aufruf, wie im Postfach).
import { genanntAntwortFunde, uhrzeitenGenannt, TERMIN_AENDERN, fragtSelbstNachLinkOderZahlung } from "@shared/fiaon-genannter-termin";
// E-401 (3/6, 19.10.2026): „habe bezahlt“ — der Server sucht im Bankbuch (fiaon-mara-zahlung-suchen.ts).
import { zahlungAntwortFunde, type ZsErgebnis } from "@shared/fiaon-zahlung-suchen";
// E-401 (4/6, 19.10.2026): Anschrift, E-Mail, Telefon ändert der Server selbst (fiaon-mara-angaben-aendern.ts).
import { angabenAntwortFunde, angabenWunsch, type AngabenLageRein, type AngabeFeld } from "@shared/fiaon-angaben-aendern";
import type { GenanntLage } from "./fiaon-mara-genannter-termin";
// E-408 (Scheibe 3, 22.10.2026): Ja zum Anruf — Mara fragt (angehängter eigener Satz) und dankt für ein klares JA.
import { jaImGespraech, jaFrageZumAnhaengen } from "./fiaon-ja-zum-anruf";
import { JA_DANKE_WA, ANRUF_SPERRE_WA, jaHinweisFuerMara } from "@shared/fiaon-ja-zum-anruf";

export const DIENST_WA = "mara-whatsapp";
/** E-458 / E-262 D: das Modell der WhatsApp-Antworten — Texte an Kunden bleiben auf gpt-5.5 (Notfall-Weiche MARA_WA_MODELL). */
const MODELL = () => kiModell("whatsapp");

/** Übernahme durch einen Menschen läuft nach dieser Zeit ohne Antwort ab. */
const UEBERNAHME_MS = 15 * 60_000;
/** Antworten je Gespräch: in 30 Minuten (dann kurz warten) und am Tag (dann Pause bis morgen). */
export const HALBSTUNDE_GRENZE = 15;
export const TAG_GRENZE = 60;
/** So lange versucht Mara es bei einem KI-Ausfall still weiter, bevor der Rückfallsatz rausgeht. */
export const KI_GEDULD_MIN = 6;

// ── ZEIT NACH DER KI-PAUSE (E-246, Nachprüfung 27.09.) ─────────────────────
/** Pause-Nachrichten, die älter sind, beantwortet Mara nicht frei (Sammelaufgabe). */
export const PAUSE_FREI_MAX_MS = 12 * 3_600_000;
type PauseStand = { seit: string | null; aufgehobenAm: string | null; an?: boolean };
/** Kam die Nachricht in der (letzten) KI-Pause? Ab 15 Min. vor „seit" bis zum Aufheben (oder jetzt, solange pausiert). */
/** Zeitpunkt in ms — Date direkt (String(Date) verlöre die Millisekunden). */
function zeitMs(am: unknown): number {
  return am instanceof Date ? am.getTime() : typeof am === "number" ? am : new Date(String(am)).getTime();
}
export function kamInDerPause(am: unknown, kp: PauseStand | null): boolean {
  if (!kp?.seit) return false;
  const t = zeitMs(am);
  const seit = new Date(kp.seit).getTime();
  const bis = kp.aufgehobenAm && !kp.an ? new Date(kp.aufgehobenAm).getTime() : Date.now();
  if (!Number.isFinite(t) || !Number.isFinite(seit) || !Number.isFinite(bis)) return false;
  if (kp.aufgehobenAm && !kp.an && bis < seit) return false; // aufgehoben VOR dieser Pause → Pause läuft (an) oder Datensalat
  return t >= seit - 15 * 60_000 && t <= bis;
}
/** Ab wann Maras Geduld (KI_GEDULD_MIN) zählt: Nachrichtenzeit oder Pausenende, das spätere. */
export function geduldAb(am: unknown, kp: PauseStand | null): number {
  const t = zeitMs(am);
  const auf = kp?.aufgehobenAm && !kp.an ? new Date(kp.aufgehobenAm).getTime() : NaN;
  return Math.max(Number.isFinite(t) ? t : Date.now(), Number.isFinite(auf) ? auf : -Infinity);
}
function berlinTeile(d: Date, opt: Intl.DateTimeFormatOptions): Record<string, string> {
  const aus: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour12: false, ...opt }).formatToParts(d)) aus[p.type] = p.value;
  return aus;
}
/** „YYYY-MM-DD" in Berliner Zeit. */
export function berlinTag(d: Date): string {
  return d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
}
/** „So 16:00" — für den Verlauf (nur formatToParts, Zeit-Falle Berlin-Stunde). */
export function kurzZeit(d: Date): string {
  if (!Number.isFinite(d.getTime())) return "?";
  const t = berlinTeile(d, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return `${String(t.weekday ?? "").replace(/\.$/, "")} ${t.hour}:${t.minute}`;
}
/** „gestern (Sonntag, 27.09.) um 16:00 Uhr" — für den Zeithinweis. */
export function tagUndUhrzeit(d: Date, jetzt = new Date()): string {
  const t = berlinTeile(d, { weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const tag = berlinTag(d);
  const heute = berlinTag(jetzt);
  const gestern = berlinTag(new Date(jetzt.getTime() - 86_400_000));
  const vor = tag === heute ? "heute" : tag === gestern ? "gestern" : "am";
  return `${vor} (${t.weekday}, ${t.day}.${t.month}.) um ${t.hour}:${t.minute} Uhr`;
}
/**
 * rueckruf_eintragen nach der KI-Pause: Kam die NEUESTE offene Kundennachricht in
 * der Pause und an einem früheren Tag, legt Mara nichts auf heute (oder in die
 * Vergangenheit, die das Werkzeug auf heute schöbe) — „heute", „gleich" oder
 * eine Uhrzeit ohne Tag meinten DEN Tag. Erlaubt bleibt heute, wenn der Kunde
 * den heutigen Tag ausdrücklich nennt (Wochentag, Datum) oder ein relatives
 * Wort, das von seinem Tag aus heute ist („morgen" von gestern, „übermorgen"
 * von vorgestern). ctx.nachrichtTag ist NUR bei Pause-Nachrichten gesetzt
 * (Nachbesserung 27.09.: vorher sperrte es auch im Normalbetrieb um Mitternacht).
 * Rein, im Prüfstand.
 */
export function rueckrufHeuteSperre(args: any, ctx: { nachrichtTag?: string; kunde?: string }, jetzt: Date): string | null {
  const heute = berlinTag(jetzt);
  if (!ctx.nachrichtTag || ctx.nachrichtTag >= heute) return null;
  const tagVon = (x: unknown) => String(x ?? "").trim().slice(0, 10);
  // Wohin fiele die Buchung? Genaue Zeit → deren Tag; Fenster → dessen Beginn
  // (ohne „von" beginnt das Fenster jetzt, also heute).
  const start = args?.zeit ? tagVon(args.zeit) : args?.von ? tagVon(args.von) : heute;
  const ende = args?.bis ? tagVon(args.bis) : start;
  if (start > heute && ende > heute) return null;
  const k = String(ctx.kunde ?? "").toLowerCase();
  const t = berlinTeile(jetzt, { weekday: "long", day: "numeric", month: "numeric" });
  const wochentag = String(t.weekday ?? "").toLowerCase();
  const datum = new RegExp(`(^|\\D)0?${t.day}\\.\\s?0?${t.month}(\\.|\\D|$)`);
  if ((wochentag && k.includes(wochentag)) || datum.test(k)) return null;
  const tage = Math.round((Date.parse(`${heute}T12:00:00Z`) - Date.parse(`${ctx.nachrichtTag}T12:00:00Z`)) / 86_400_000);
  const ohneGruss = k.replace(/guten\s+morgen/g, " ");
  if (tage === 2 && /übermorgen/.test(ohneGruss)) return null;
  if (tage === 1 && /(^|[^a-zäöüß])morgen(?![a-zäöüß])/.test(ohneGruss.replace(/übermorgen/g, " "))) return null;
  const damals = new Date(`${ctx.nachrichtTag}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit" });
  return `Seine Nachricht kam am ${damals} (während einer Pause) — „heute", „gleich" oder eine Zeit ohne Tag meinte DIESEN Tag, der vorbei ist. Trag nichts für heute ein: entschuldige die späte Antwort und frag ihn, wann es ihm jetzt passt (freie_zeiten).`;
}

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
    // E-372: nur noch Rückrufwunsch ohne Termin oder eine Frage, die du nicht wahr beantworten kannst.
    mensch: { type: "boolean", description: "true NUR, wenn er ausdrücklich angerufen werden will und du keinen Termin eintragen konntest, oder du eine Frage nicht wahr beantworten kannst und kein Werkzeug sie erledigt." },
    uebergabe: { type: "string", description: "Ein Satz für den Menschen, der übernimmt (Betreuer oder Geschäftsführung): was er will, wann, wie dringend — sonst leer." },
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
// Die beiden alten Sätze (bis E-247) — nur noch zum Erkennen im Verlauf. Justin am 28.09.: „Ok"
// bekam „Das möchte ich Ihnen ganz genau beantworten" — ein kaputter Automat.
const RUECKFALL_ANFANG = "Das möchte ich Ihnen ganz genau beantworten.";
const RUECKFALL_ZWEI = "Ihre Nachricht ist angekommen und liegt schon bei ";
// E-248: EIN Satz, menschlich, ohne Zeitzusage — und nur noch als letztes Mittel (nach dem
// zweiten Entwurf und dem sicheren Satz aus der Lage), nie auf ein „Ok", nie zweimal in 2 h.
const RUECKFALL_NEU = "Damit Sie eine ganz genaue Antwort bekommen";
/** E-265: `betreuer` ist die Nennform („Herr Stripling" / „Herrn Stripling") — vorher der Vorname („Daniel"). */
export function rueckfallSatz(betreuer: NennformEin): string {
  const b = nennAus(betreuer);
  return b
    // E-265 Nachbesserung (29.09.2026, f18): die volle Nennform zweimal in einem Satz klang nach Automat
    // („… schaut sich Nikita Boychenko das an — Sie hören direkt von Nikita Boychenko.") — einmal reicht.
    ? `Danke Ihnen! ${RUECKFALL_NEU}, schaut sich ${b.nom} das persönlich an — Sie hören direkt von uns.`
    : `Danke Ihnen! ${RUECKFALL_NEU}, schaut sich jemand aus unserem Team das persönlich an — Sie hören direkt von uns.`;
}
// „includes", nicht „startsWith": In der ersten Antwort eines Gesprächs steht der KI-Hinweis davor
// („Hier ist Mara, die digitale Assistentin von FIAON. Das möchte ich …") — gefunden im Ablauftest.
export const istRueckfall = (text: unknown) => {
  const t = String(text ?? "");
  return t.includes(RUECKFALL_ANFANG) || t.includes(RUECKFALL_ZWEI) || t.includes(RUECKFALL_NEU);
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
  // E-248 (Wiedergabe mit dem echten Modell): „wenn Sie fest einen Ratenkredit suchen, passt eher der Kreditweg" —
  // leiser, aber genauso rausgeredet.
  // E-298 (07.10.2026, Justin: „Mara muss verkaufsstärker werden, mehr Risiken eingehen"): Auf „habe gerade nur 5 €" schrieb
  // Mara „dann warten Sie besser", auf „ich habe das Geld nicht" „unterschreiben Sie bitte nichts" — beides schickt ihn weg.
  { muster: /\b(?:dann\s+)?warten\s+sie\s+(?:besser|lieber|am\s+besten|einfach)\b|\bunterschreiben\s+sie\s+(?:bitte\s+)?(?:lieber\s+)?nichts\b|\b(?:sobald|wenn)\s+es\s+(?:bei\s+ihnen|für\s+sie|ihnen)\s+(?:wieder\s+)?passt\b|\bwas\s+sich\s+für\s+sie\s+nicht\s+gut\s+anfühlt\b/i,
    was: "Rückzug beim Geld — frag, wann sein Geld kommt, halte den Tag mit zahlungszusage_merken fest, oder zeig das nächstkleinere Paket für heute" },
  { muster: /\b(?:passt|wäre|ist)\s+(?:eher|besser)\s+(?:der|die|das|ein|eine|ihre?)\b|\bbesser\s+(?:bei|an)\s+(?:einer|ihrer|der)\s+(?:bank|hausbank)\b|\b(?:nicht|kein)\s+(?:das\s+)?(?:richtige\s+)?(?:angebot|produkt)\s+für\s+sie\b/i, was: "„passt eher woanders“" },
];

/** Hürden, die nur fallen dürfen, wenn der Kunde selbst danach gefragt hat. */
const FRAGT_UNTERLAGEN = String.raw`unterlag|dokument|einreich|vorleg|vorzeig|papier|mitbring|mitschick|hochlad|upload|(?:was|welche)\b.{0,30}(?:brauch|benötig|muss|soll)|was\s+(?:muss|soll)\s+ich|voraussetz|bedingung`;
const HUERDEN: { wort: RegExp; frage: RegExp; was: string }[] = [
  // „Was brauchen Sie von mir?" erlaubt alles; „Brauche ich einen Einkommensnachweis?" die ehrliche Ergänzung.
  { wort: /kontoausz/i, frage: new RegExp(`auszug|auszüg|einkommen|gehalt|lohn|${FRAGT_UNTERLAGEN}`, "i"), was: "Kontoauszüge" },
  { wort: /ausweis|reisepass/i, frage: new RegExp(`ausweis|\\bpass\\b|identi|${FRAGT_UNTERLAGEN}`, "i"), was: "den Ausweis" },
  // E-365: auch die Bonitätsauswertung (das Produkt heißt privat seit dem 14.10.2026 so) — dieselbe Hürde, dieselbe Ausnahme.
  { wort: /bonitätsauskunft|bonitätsauswertung|schufa-?auskunft/i, frage: new RegExp(`schufa|auskunft|bonität|${FRAGT_UNTERLAGEN}`, "i"), was: "die Bonitätsauskunft" },
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

/**
 * E-365 (14.10.2026): Woran Mara IHR EIGENES Angebot erkennt — privat heißt das Produkt seitdem
 * „FIAON-Bonitätsauswertung". Ohne den neuen Namen sähe sie ihr eigenes Angebot nicht mehr
 * (doppeltes Angebot, ein „Ja" darauf ginge verloren).
 */
export const ANGEBOT_WORT = /auskunft|bonit(?:ä|ae)tsauswertung/i;

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
    && (/auskunft|schufa|\bksv|bonit/i.test(k) || ANGEBOT_WORT.test(du));
  // Nur ein reines Ja — „Bitte rufen Sie mich an" beginnt auch mit „Bitte", ist aber kein Auftrag.
  const jaAufAngebot = NUR_JA.test(k) && ANGEBOT_WORT.test(du) && /\?\s*$/.test(du);
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
  /**
   * E-365 (14.10.2026): dazu „auswertung" (die FIAON-Bonitätsauswertung liegt vor) und „inklusive" (zahlender Paketkunde,
   * dessen Kartenlink auf die Bonität wartet — nie verkaufen). „dokument" hält privat keinen Verkauf mehr auf.
   */
  stufe: "nichts" | "offen" | "bezahlt" | "dokument" | "auswertung" | "inklusive";
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
// E-365: die neuen Vorlagen der Bonitätsauswertung (fiaon_kk_auswertung…) UND die alten (fiaon_kk_auskunft…) — Antworten
// auf schon gesendete Angebote müssen erkannt bleiben.
const AUSKUNFT_VORLAGE_MUSTER = new RegExp(`^(?:${AUSKUNFT_VORLAGE.replace(/^fiaon_kk_/, "fiaon_kkb?_")}|fiaon_kkb?_auskunft)(?:_|$)`, "i");

/**
 * Ist diese Nachricht VON UNS ein Angebot der Auskunft (E-241)? Die Vorlage
 * (auch fiaon_kk_auskunft_lead) oder Maras eigenes Angebot — mit Preis oder
 * Kauflink. Rein.
 */
export function istAuskunftAngebot(n: { vorlage?: string | null; text?: string | null } | null | undefined): boolean {
  if (!n) return false;
  if (n.vorlage) return AUSKUNFT_VORLAGE_MUSTER.test(String(n.vorlage));
  const t = String(n.text ?? "");
  return ANGEBOT_WORT.test(t) && (/\d\s*(?:€|euro\b)/i.test(t) || /\/auskunft\/(?:bestellen|k\/)/i.test(t));
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
    const schonAngeboten = du.slice(0, 8).some((t) => ANGEBOT_WORT.test(t) && /\d\s*(?:€|euro\b)/i.test(t));
    const nein = lehntAuskunftAb(kunde);
    const jetzt = !nein && (ein.werbesperre
      ? ((selbst && auskunftGefragt(kunde)) || zugestimmt)
      : (selbst || zugestimmt || aufAngebot));
    return { jetzt, schonAngeboten, aufAngebot, selbst };
  }
  // Ein Angebot per Mail oder Vorlage zählt wie eines in diesem Gespräch: danach nur noch,
  // wenn er selbst auf die Auskunft zurückkommt (AUSKUNFT_DIREKT) oder Ja sagt.
  const schonAngeboten = !!ein.anderswo || du.slice(0, 8).some((t) => ANGEBOT_WORT.test(t) && /\d\s*(?:€|euro\b)/i.test(t));
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

/**
 * Darf ihm die Bonitätsauswertung angeboten werden (oder hat er eine offene Bestellung)? E-365: privat auch mit eigener
 * Datenkopie in der Akte — die Auswertung ist ein anderes Produkt; nie bei „auswertung" oder „inklusive". Rein.
 */
export function auskunftVerkaufbar(t: Pick<AuskunftTeil, "stufe" | "art"> | null | undefined): boolean {
  // E-367: eine eigene Auskunft in der Akte („dokument") sperrt wieder — auch privat.
  return !!t && (t.stufe === "nichts" || t.stufe === "offen");
}

/** Bekommt Mara in diesem Gespräch das Werkzeug auskunft_anbieten? */
export function auskunftWerkzeugAn(t: AuskunftTeil | null | undefined): boolean {
  return !!t && auskunftVerkaufbar(t) && t.jetzt;
}

/** Der Teil des Auftrags über seine Auskunft. Exportiert für den Prüfstand. */
// E-365 (14.10.2026): Privat ist das Produkt die FIAON-Bonitätsauswertung (Ausweis + Kontoauszüge, keine Auskunftei,
// keine Schreiben). Firmen behalten die Firmen-Bonitätsauskunft mit ihren Auskunfteien.
export function auskunftBlock(t: AuskunftTeil | null | undefined): string[] {
  if (!t) return [];
  const firma = t.art === "firma";
  const wort = firma ? auskunftWort(t.land) : AUSWERTUNG_NAME;
  const bei = auskunfteienText(t.land);
  // E-241: der Einzelpreis seiner Art (Firma 349 €, privat 149 €) — nicht immer der private.
  const einzeln = euroText(AUSKUNFT_PREISE_CENTS[t.art ?? "privat"].einzeln);
  const landWort = t.land === "DE" ? "" : firma
    ? ` In seinem Land heißt sie „${auskunftWort(t.land)}" — das Wort SCHUFA schreibst du ihm nie.`
    : ` Er lebt in ${t.land === "AT" ? "Österreich" : "der Schweiz"} — das Wort SCHUFA schreibst du ihm nie.`;
  // Was wir tun — privat die Bonitätsauswertung, für Firmen die Auskunft wie bisher.
  const wasWirTun = firma
    ? `· Was wir tun: Wir holen die Daten seines Unternehmens bei den Wirtschaftsauskunfteien und seine persönlichen bei ${bei} ein, erklären jeden Eintrag und legen ihm Handlungsplan und Schreiben zur Freigabe vor.`
    : `· Was er bekommt: ${AUSWERTUNG_NAME} — seine Bonität aus Sicht einer Bank: Haushaltsrechnung und die neun Merkmale, die eine Bank bei ihrer Prüfung ansieht, jede Einnahme und Ausgabe nach Empfänger und Monat, Ampel für sieben Bereiche, sein FIAON-Finanzwert, sein Potenzial und sein Plan. Rund 25 Seiten, von seinem FIAON-Team aus seinen eigenen Kontoauszügen erstellt, von einem Menschen geprüft und freigegeben, als PDF per E-Mail und in seinem Bereich.`;
  const wasErTut = firma ? [] : [`· Was er dafür tut: „${AUSWERTUNG_UNTERLAGEN_SATZ}"`];
  const nieMehr = firma ? [] : [`· Privat fordern wir KEINE Datenkopien an, beschaffen nichts und liefern keinen Handlungsplan mit Schreiben — das schreibst du nie. Fragt er nach Auskunfteien, Einträgen oder Score: „${AUSWERTUNG_KEINE_AUSKUNFT_SATZ}"`];
  // ── E-365: IM PAKET ENTHALTEN ODER LIEGT VOR — NIE VERKAUFEN ──────────────
  if (!firma && t.stufe === "inklusive") {
    return [
      `═══ SEINE ${AUSWERTUNG_NAME.toUpperCase()}: IM PAKET ENTHALTEN ═══`,
      `Sein Link der Partnerbank für den Kartenantrag wartet auf seine Bonitätsauswertung — sie ist in seinem Paket enthalten. Du verkaufst sie NIE: keinen Preis, keinen Kauflink, kein auskunft_anbieten.`,
      `· Schreibt er über Auskunft, SCHUFA, Bonität, Karte oder Link, sagst du sinngemäß: „${AUSWERTUNG_INKLUSIVE_SATZ}" Hochladen geht in seinem Bereich unter fiaon.com/app/unterlagen (Ausweis und Kontoauszüge der letzten drei Monate). Eine ${auskunftWort(t.land)} braucht er dafür nicht.${landWort}`,
      ``,
    ];
  }
  if (!firma && t.stufe === "auswertung") {
    return [`SEINE ${AUSWERTUNG_NAME.toUpperCase()}: liegt vor (geprüft und freigegeben) — nichts verkaufen. Fragt er danach, sag ihm, dass er sie als PDF per E-Mail bekommen hat und jederzeit in seinem Bereich unter fiaon.com/app/auswertung findet, und dass sein Betreuer sie gern mit ihm durchgeht.${landWort}`, ``];
  }
  if (t.stufe === "bezahlt") {
    return firma
      ? [`SEINE FIRMEN-BONITÄTSAUSKUNFT: bezahlt — wir holen sie bei den Wirtschaftsauskunfteien und ${bei} ein. Nicht noch einmal anbieten; fragt er nach dem Stand, sieht sein Betreuer nach.${landWort}`, ``]
      : [`SEINE ${AUSWERTUNG_NAME.toUpperCase()}: bezahlt — wir entwickeln sie. Nicht noch einmal anbieten. Fragt er nach dem Stand: Dafür brauchen wir seinen Ausweis und seine Kontoauszüge der letzten drei Monate — den Link zum Hochladen hat er per E-Mail bekommen, sonst lädt er sie in seinem Bereich unter fiaon.com/app/unterlagen hoch.${landWort}`, ``];
  }
  if (t.stufe === "dokument" && firma) return [`SEINE FIRMEN-BONITÄTSAUSKUNFT: Eine Auskunft liegt in seiner Akte. Nichts dazu verkaufen.${landWort}`, ``];
  const dokumentSatz = t.stufe === "dokument" ? " Er hat selbst eine Datenkopie hochgeladen — die Bonitätsauswertung ist etwas anderes; seine Datenkopie beziehen wir ein." : "";
  // ── E-241: OFFENER ANTRAG ODER LEAD ───────────────────────────────────────
  // Ungefragt kein Wort (Justin 24.09.: „Ich suche unkompliziert eine Kreditkarte"
  // → nur die Karte) — der Auftrag bleibt dann genau so, wie er vor E-241 war.
  if (t.segment && t.segment !== "kunde") {
    if (!t.jetzt) return [];
    if (t.stufe !== "offen") {
      const antrag = t.segment === "antrag";
      return [
        `═══ SEINE FRAGE: DIE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()} ═══`,
        `${t.aufAngebot ? `Er antwortet auf unser Angebot der ${firma ? "Bonitätsauskunft" : "Bonitätsauswertung"}` : "Er fragt selbst nach seiner Bonität bzw. Auskunft"} — jetzt ist sie seine Frage, keine Hürde. ${antrag ? "Sein Antrag liegt vor, die erste Zahlung für sein Paket ist noch offen." : "Er hat noch keinen Antrag."} Beantworte, was er schreibt, positiv in ein bis zwei Sätzen, dann der Schritt.${dokumentSatz}`,
        wasWirTun,
        ...wasErTut,
        ...nieMehr,
        // 25.09.2026 (E-241): Antrag und Lead lesen den Nutzen ohne „Limit“ (VERBOTENE_WORTE, § 34c GewO).
        `· Warum: „${AUSKUNFT_NUTZEN_SATZ_KARTE}"`,
        `· Sein Preis: ${t.preisText} einmalig — ein eigener Auftrag, kein Abo, keine Monatsrate. Einen anderen Betrag dafür nennst du nie.${landWort}`,
        `· Sie ist KEINE Voraussetzung für ${antrag ? "sein Paket" : "den Antrag"} — das sagst du nie anders. ${firma ? "Kontoauszüge, Ausweis und Hochladen erwähnst du nicht." : "Ausweis und Kontoauszüge nennst du nur als das, was er NACH der Bestellung für die Auswertung hochlädt."}`,
        antrag
          ? `· Seine offene erste Zahlung sprichst du höchstens in einem kurzen Satz an, ohne zweiten Link — der Schritt dieser Antwort ist die ${firma ? "Auskunft" : "Bonitätsauswertung"}.${firma ? "" : " Fragt er, ob sie mit dem Paket dazugehört: Mit seinem Paket wird sie nach der ersten Zahlung zum Schritt vor dem Link der Partnerbank — einzeln bestellen muss er sie dann nicht."}`
          : `· Den Antragslink schickst du hier nur, wenn er danach fragt — der Schritt dieser Antwort ist die ${firma ? "Auskunft" : "Bonitätsauswertung"}.`,
        `· Sagt er Ja, will er sie oder fragt nach Preis oder Weg: rufe auskunft_anbieten auf und schick GENAU den Link aus dem Ergebnis. Einen Link, Preis oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie. Geht es ihm in Wahrheit um etwas anderes, beantworte nur das — ohne Angebot.`,
        `· Fragt er, ob er die Datenkopie nicht kostenlos selbst anfordern kann, sagst du ehrlich: „${AUSKUNFT_KOSTENLOS_ANTWORT}" Von dir aus empfiehlst du den kostenlosen Weg nie.`,
        `· Keine Zusage: nie „dann bekommen Sie die Karte" oder „Ihr Rahmen steigt", keine Löschzusage, kein „Score verbessern", keine Frist mit Zahl. Den Satz über die Bank nur, wenn er nach Karte, Rahmen oder Zusage fragt.`,
        ``,
      ];
    }
  }
  if (t.werbesperre && !t.jetzt) {
    return [`SEINE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()}: liegt uns noch nicht vor. Er hat um keine Werbung gebeten — du bietest sie ihm nicht an. Nur wenn er sie ausdrücklich haben will, nennst du den Preis (${t.offenBetrag ?? t.preisText} einmalig).${landWort}`, ``];
  }
  if (t.stufe === "offen") {
    return [
      `═══ SEINE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()} ═══`,
      `Er hat sie bestellt, die Zahlung über ${t.offenBetrag ?? t.preisText} ist noch offen (einmalig, keine Monatsrate).${t.jetzt ? " Er schreibt gerade über Bonität, Rahmen, Karte oder die Auskunft — zeig ihm, dass nur noch dieser Schritt fehlt, und schick seine Zahlungsseite (auskunft_anbieten liefert sie)." : " Fragt er danach, schick ihm seine Zahlungsseite."}${firma ? "" : " Nach dem Zahlungseingang lädt er Ausweis und Kontoauszüge hoch (Link per E-Mail), dann entwickeln wir seine Auswertung."}`,
      `· Warum es sich lohnt: „${AUSKUNFT_NUTZEN_SATZ_KARTE}"`,
      `· Einen Link oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie.${landWort}`,
      ``,
    ];
  }
  if (!t.jetzt) {
    if (t.schonAngeboten) {
      const wann = t.angebotAnderswo ? `Er hat sie ${t.angebotAnderswo} schon angeboten bekommen` : "Du hast sie ihm in diesem Gespräch schon angeboten";
      return [`SEINE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()}: ${wann} (${t.preisText} einmalig). Wiederhole das Angebot nicht — beantworte seine Frage. Kommt er selbst darauf zurück, hilfst du weiter.${landWort}`, ``];
    }
    return [`SEINE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()}: liegt uns noch nicht vor (für ihn ${t.preisText} einmalig${t.mitAbo ? ", Kundenpreis mit Paket" : ""}). Er hat gerade nicht danach gefragt — erwähne sie nur, wenn er über Bonität, ${auskunftWort(t.land)}, Einträge, Rahmen, Karte oder seine fehlende Auskunft schreibt, und nie als Hürde.${dokumentSatz}${landWort}`, ``];
  }
  return [
    `═══ DEIN ANGEBOT FÜR IHN: DIE ${firma ? "FIRMEN-BONITÄTSAUSKUNFT" : AUSWERTUNG_NAME.toUpperCase()} ═══`,
    // E-241: Antwortet er auf die Vorlage oder Maras Angebot, heißt es genau so — nicht „er schreibt über Bonität".
    t.aufAngebot
      ? `Er ist Kunde, und er antwortet auf unser Angebot der ${firma ? "Bonitätsauskunft" : "Bonitätsauswertung"} — genau jetzt ist sie für ihn ein Vorteil, keine Hürde und keine Pflicht. Beantworte seine Antwort positiv, in ein bis zwei Sätzen, dann der Schritt.${dokumentSatz}`
      : `Er ist Kunde, und seine ${firma ? "Auskunft" : "Bonitätsauswertung"} liegt uns noch nicht vor. Er schreibt gerade über Bonität, Einträge, Rahmen, Karte oder seine fehlende Auskunft — genau jetzt ist sie für ihn ein Vorteil, keine Hürde und keine Pflicht. Biete sie ihm an: positiv, in ein bis zwei Sätzen, dann der Schritt.${dokumentSatz}`,
    wasWirTun,
    ...wasErTut,
    ...nieMehr,
    // E-248: auch für zahlende Kunden der Satz ohne „Limit" (Justin: „Rahmen" statt „Limit"; tonPruefung hart).
    `· Warum: „${AUSKUNFT_NUTZEN_SATZ_KARTE}"`,
    `· Sein Preis: ${t.preisText} einmalig${t.mitAbo ? ` — Kundenpreis mit Paket (einzeln kostet sie ${einzeln})` : ""}. Keine Monatsrate, keine zwölf Raten.${landWort}`,
    `· Sagt er, er habe keine Auskunft, will er sie oder sagt er Ja zu deinem Angebot: rufe auskunft_anbieten auf und schick GENAU den Link aus dem Ergebnis. Einen Link, Preis oder Betrag, der nicht hier oder im Werkzeug steht, nennst du nie.`,
    `· Fragt er, ob er die Datenkopie nicht kostenlos selbst anfordern kann, sagst du ehrlich: „${AUSKUNFT_KOSTENLOS_ANTWORT}" Von dir aus empfiehlst du den kostenlosen Weg nie.`,
    `· Keine Zusage: nie „dann bekommen Sie die Karte" oder „Ihr Rahmen steigt", keine Löschzusage, kein „Score verbessern", keine Frist mit Zahl. Kein Satz über die Bank im Verkauf (E-373, Justin: „steht alles im Vertrag“) — nur, wenn er ausdrücklich danach fragt.`,
    ``,
  ];
}

/** E-248: Die Monatsraten aller Pakete (7,99 / 59,99 / 79,99 / 99,99 € …) — nie ein Auskunft-Preis. */
const PAKET_RATEN_CENTS = new Set<number>(PAKETE.filter((p) => p.abo).map((p) => p.preisCents));
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

// E-275 Gegenprüfung Verkauf (02.10.2026): die echten Formen von „Anruf“ und „Abgabe“ stehen in shared/fiaon-mara-ton.ts
// (selbstErledigtTreffer) — dieselbe Regel für WhatsApp (verkaufsPruefung) und Mail (verweisBefunde).

/**
 * Prüft einen Entwurf darauf, ob er verkauft oder abschreckt. Gibt Hinweise für
 * den zweiten Entwurf zurück — leer heißt: gut so.
 */
export function verkaufsPruefung(antwort: string, ein: {
  kunde: string; kontext?: string; letzteDu: string[]; verkaufen: boolean; zahlungslage?: boolean;
  /** E-248 (Befund #415): sein persönlicher Link — will er bestellen, gehört er in die Antwort. */
  link?: string | null;
  /** E-240: Mara darf hier die Auskunft anbieten (zahlender Kunde, er schreibt darüber) — dann ist sie keine Hürde. */
  auskunftAngebot?: boolean;
  /** E-240: Werbesperre — antworten ja, verkaufen nein. */
  werbesperre?: boolean;
  /** E-265: Er hat seine Zahlung gemeldet (A) — dann ist „direkt der Link unserer Partnerbank" nach der Buchung wahr. */
  bankLinkOk?: boolean;
  /**
   * E-275 (02.10.2026): Ein Anruf oder Termin ist hier richtig — er will telefonieren, ein zugesagter Anruf ist
   * ausgefallen, ein Termin steht schon, oder es ist ein Fall für einen Menschen (heikel). Ohne: ein ungefragtes
   * Terminangebot oder „X meldet sich/prüft/klärt“ ist ein weicher Mangel (Justin: „nicht immer sagen ‚Ich mache einen
   * Termin mit XY‘“). undefined = nicht prüfen (Prüfstände ohne Lage).
   */
  anrufOk?: boolean;
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
      // E-365 (14.10.2026): Die Bonitätsauswertung entsteht aus Ausweis und Kontoauszügen — im Angebot sind sie ihr Inhalt,
      // keine Hürde. Nur in Sätzen, die die Auswertung selbst nennen; „Laden Sie dann Ihre Kontoauszüge hoch." bleibt eine.
      if (ein.auskunftAngebot && (h.was === "Kontoauszüge" || h.was === "den Ausweis" || h.was === "Unterlagen")) {
        const saetze = a.split(/(?<=[.!?])\s+/).filter((x) => h.wort.test(x));
        if (saetze.length && saetze.every((x) => /auswertung/i.test(x))) continue;
      }
      // E-265 (29.09.2026): Neben seinem Wunschlimit, einem Kartenziel oder der Visa-Kreditkarte ist „über den
      // Rahmen entscheidet die Bank" keine Hürde, sondern PFLICHT (limit_ohne_bank) — Justins Abschlussformel.
      // E-298 (07.10.2026): mit MARA_BANK_SATZ=nachfrage auch neben dem Wunschlimit nur auf seine Frage.
      if (h.was === "„die Bank entscheidet“" && !bankSatzNurAufNachfrage() && /wunschlimit|als\s+ziel|visa-kreditkarte/i.test(a)) continue;
      const m = a.match(h.wort);
      // E-298: mit MARA_BANK_SATZ=nachfrage zählt für den Bank-Satz nur seine echte Frage (FRAGT_NACH_RAHMEN, enger).
      const gefragt = h.was === "„die Bank entscheidet“" && bankSatzNurAufNachfrage() ? FRAGT_NACH_RAHMEN.test(kontext) : h.frage.test(kontext);
      if (m && !gefragt) hinweise.push(`Er hat nicht nach ${h.was} gefragt („${m[0].trim()}“) — lass es weg.`);
    }
    const urls = a.match(/(https?:\/\/)?fiaon\.com\/[^\s)]+/gi) ?? [];
    const schonDa = urls.some((u) => ein.letzteDu.some((d) => d.includes(u.replace(/^https?:\/\//i, ""))));
    const zugestimmt = ZUSTIMMUNG.test(kunde.trim()) && /\?\s*$/.test(String(ein.letzteDu[0] ?? "").trim());
    if (schonDa && !LINK_GEFRAGT.test(kunde) && !zugestimmt) hinweise.push("Den Link hat er gerade erst von dir bekommen — nicht noch einmal schicken, ende mit einer kurzen Frage.");
    // E-248 (Befund #415): „Ich möchte gerne diese Karte bestellen" bekam „Was möchten Sie vorher wissen?" — ohne Link.
    const willBestellen = /\b(?:bestell\w*|beantrag\w*|abschließ\w*|anmeld\w*|loslegen|starten)\b|(?:möchte|will|hätte\s+gern)\w*\s+(?:gerne?\s+)?(?:die|eine|diese|diesem|ihre)\s+karte/i.test(kunde);
    if (willBestellen && ein.link && !urls.length && !heikel) hinweise.push(`Er will bestellen — schick ihm jetzt seinen persönlichen Link (${ein.link}) mit einem warmen Satz; eine angekündigte Frage beantwortest du danach.`);
  }
  // Justin (24.09., Niko M.): Geht es um seine Zahlung, sagt Mara „Nach der Zahlung ist Ihr Account aktiv" — nichts von der Partnerbank.
  // E-265 (29.09.2026, Justin: „VIEL MEHR AUF DIE KREDITKARTEN!"): Die Karte und „über den Rahmen entscheidet unsere
  // Partnerbank" sind jetzt Teil der Formel. Gesperrt bleibt nur, dem Link der Partnerbank einen ZEITPUNKT zu versprechen
  // („heute", „morgen", „innerhalb …") — „sobald … gebucht ist, bekommen Sie direkt den Link" ist wahr seit E-206.
  // Gesperrt bleibt in der Zahlungslage der PROZESS der Bank (ihr Link, die DKB) — außer er hat seine Zahlung schon
  // gemeldet (A: dann kommt nach der Buchung direkt der Link, KARTE_LINK_SATZ, wahr seit E-206). „Über den Rahmen
  // entscheidet unsere Partnerbank" ist Teil von Justins Formel und frei.
  // E-275 (02.10.2026): Justins wahrer Satz gehört jetzt in jeden Abschluss — „sobald sie gebucht ist, … bekommen Sie direkt
  // den fertigen Link unserer Partnerbank für Ihren Kartenantrag" (KARTE_LINK_SATZ, wahr seit E-206). Gesperrt bleibt nur
  // ein ZEITPUNKT für den Link („heute“, „morgen“, „innerhalb …“, „gleich“, „sofort“) und der Link VOR der Buchung.
  // E-275 Ton (02.10.2026): „sofort“ ist kein Zeitpunkt mehr, sobald es am Zahlungseingang hängt — Justins Satz „Ihr Account
  // ist sofort nach Zahlungseingang aktiv, und Sie bekommen direkt den fertigen Link …" ist wahr (der Abgleich bucht selbst,
  // die Einladung folgt im 5-Minuten-Takt). Ein „sofort“ ohne „nach (dem) Zahlungseingang“ fällt weiter auf.
  const ohneEingangSofort = a.replace(/\bsofort\s+nach\s+(?:dem\s+|ihrem\s+)?(?:zahlungs)?eingang\b|\bmit\s+dem\s+zahlungseingang\s+(?:ist\s+ihr\s+account\s+)?sofort\b/gi, " ");
  const linkZeitpunkt = /\b(?:heute|morgen|innerhalb|binnen|gleich|sofort|in\s+\d+\s*(?:minuten|stunden|tagen))\b[^.!?]{0,50}\blink\s+(?:unserer|der)\s+(?:partner)?bank|\blink\s+(?:unserer|der)\s+(?:partner)?bank\b[^.!?]{0,50}\b(?:heute|morgen|innerhalb|binnen|gleich|sofort|in\s+\d+\s*(?:minuten|stunden|tagen))\b/i;
  const linkOhneBuchung = /link\s+(?:unserer|der)\s+(?:partner)?bank/i.test(a) && !/sobald|nach\s+der\s+(?:buchung|zahlung)|gebucht|aktiviert|freigeschaltet|schaltet[^.!?]{0,30}frei|zahlungseingang|account\s+(?:ist\s+)?(?:[^\s.!?]+\s+){0,4}?aktiv/i.test(a);
  if (ein.zahlungslage && !ein.bankLinkOk && (linkZeitpunkt.test(ohneEingangSofort) || (linkOhneBuchung && !/partnerbank|\bdkb\b|\bbank\b|karte|link/i.test(kunde)))) {
    // E-275 Ton (02.10.2026): Justins neuer Satz („Ihr Account ist sofort nach Zahlungseingang aktiv …“).
    hinweise.push(`Es geht um seine Zahlung: Den Link der Partnerbank gibt es erst nach dem Zahlungseingang — sag es wie Justin: „${NACH_DEM_EINGANG_SATZ}“, ohne Tag oder Uhrzeit.`);
  }
  // ── E-275 (02.10.2026): MARA ERLEDIGT SELBST — KEIN UNGEFRAGTER TERMIN, KEIN „X MELDET SICH“ ─────────────────
  // Gemessen 23.09.–02.10.: 113 von 546 freien Antworten „X ruft Sie an/meldet sich/Rückruf“, 49 fragten nach einer
  // Uhrzeit — oft auf eine Frage, die Mara selbst hätte beantworten können (#2399 „?“ → Anruf, #2279 „Bekomme ich
  // Bescheid?“ → Anruf, #2003 „nix bekommen“ → „Justin schaut nach“). Weich: der zweite Entwurf erledigt es selbst.
  if (ein.anrufOk === false && !heikel) {
    const anruf = a.match(new RegExp(String.raw`\b(?:passt|passen)\s+ihnen\b[^.!?]{0,80}\b(?:uhr|anruf|rückruf|termin|telefonat|gespräch)\b[^.!?]*\?|\b(?:soll|darf|kann)\s+(?:ich|er|sie|herr\s+\p{L}+|frau\s+\p{L}+)\b[^.!?]{0,60}\b(?:anrufen|zurückrufen|termin|anruf)\b[^.!?]*\?|\b(?:einen?\s+)?(?:kurzen?\s+)?(?:anruf|rückruf|termin)\b[^.!?]{0,40}\b(?:anbieten|eintragen|vereinbaren|machen)\b|\bkann\s+sie\s+(?:heute|morgen|am)\b[^.!?]{0,40}\b(?:anrufen|zurückrufen)\b`, "iu"));
    // E-275 Gegenprüfung Verkauf: dazu die echten Formen (selbstErledigtTreffer) — „Soll Nikita Boychenko Sie kurz anrufen?“,
    // zwei Uhrzeiten zur Wahl, „… schaut mit Ihnen nach“, „prüft … und gibt Ihnen Rückmeldung“, „gebe … an … weiter“.
    const e275 = selbstErledigtTreffer(a);
    const anrufText = anruf?.[0] ?? e275.anruf;
    if (anrufText) hinweise.push(`Er hat nicht nach einem Anruf gefragt („${anrufText.trim().slice(0, 60)}“) — erledige es selbst: beantworte seine Frage und schließ mit seinem Link und EINER kurzen Frage ab (bei offener Zahlung „${ZAHL_FRAGE}“). Einen Anruf bietest du nur an, wenn er telefonieren will.`);
    // Die erste Fassung des Abgabe-Musters steht jetzt in ABGABE_E275 (je Satz, mit Satzgegenstand).
    const abgabeText = e275.abgabe;
    if (abgabeText) hinweise.push(`Du schiebst ab („${abgabeText.trim().slice(0, 60)}“) — beantworte es selbst aus SEINE LAGE und den Fakten, schick den passenden Link (Zahlungsseite, Antrag, bei zahlenden Kunden den Link der Partnerbank mit karte_link_schicken). Ein Kollege nur, wenn es wirklich einen Menschen braucht.`);
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
    hinweise.push(`Bei Kündigung, Widerruf oder Storno: nicht nach dem Grund fragen, nicht umstimmen — eine Kündigung erst nach seinem klaren Ja auf „${KUENDIGUNG_RUECKFRAGE}" aufnehmen (kuendigung_aufnehmen), vorher nur diese eine Rückfrage.`);
  }
  if (nichtDeutsch(a)) hinweise.push("Nicht auf Deutsch — schreib die ganze Antwort auf Deutsch, auch wenn er in einer anderen Sprache schreibt.");
  // E-240: Gezählt wird, was er liest — ein Link zählt nicht mit (der signierte Kauflink der
  // Auskunft allein hat rund 130 Zeichen und hätte jedes Angebot „zu lang" gemacht).
  // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f03/f05/l03): Der Vorspann „Hier ist Mara, die digitale Assistentin
  // von FIAON —" zählt nicht mit (kern) — er kostete rund 55 Zeichen, und der Hinweis „zu lang" strich dann genau die Formel
  // (f05: „kein Kreditinstitut", Ziel + Bank-Satz; l03: 425 > 420 → Betrag und Freischaltung weg).
  const lesbar = kern(a).replace(/https?:\/\/\S+/g, "").trim().length;
  // Nachbesserung E-248 (Probelauf #14, „Dann nützt mich das nichts"): Ein Einwand oder eine
  // Kreditfrage braucht ein Argument — bis etwa 420 Zeichen, auch auf eine kurze Nachricht.
  const einwand = /n(?:ü|ue)tzt|bringt\s+(?:mir\s+)?nichts|lohnt|zu\s+teuer|dann\s+(?:nicht|eben\s+nicht)|abgelehnt|ablehnung|kredit|darlehen|geld|vorher\s+zahlen|vorab|im\s+voraus|warum|wieso|seri(?:ö|oe)s|abzocke|betrug|schufa|minus/i.test(kunde);
  // E-265: Justins Abschluss (Karte, Wunschlimit, Betrag, System, Termin, Frage) braucht 290–410 Zeichen — dafür 420.
  // E-275 (02.10.2026): mit Justins wahrem Satz (direkt der Link der Partnerbank, 2–5 Werktage, Apple Pay) und der Bitte
  // ums Zahlen 420–500 Zeichen — für den Abschluss gilt deshalb nur die 500er-Grenze. Auch die Antwort mit dem Link der
  // Partnerbank (Satz aus dem Bereich Karte, dann die Rate) zählt als Abschluss.
  const abschluss = (/visa-kreditkarte/i.test(a) && /wunschlimit|als\s+ziel|termin|monatsrate/i.test(a)) || /link\s+unserer\s+partnerbank/i.test(a);
  // E-265 Schluss-Nachbesserung: Beim Abschluss kürzt Mara den Einstieg — nie Karte, Ziel, Betrag oder Link.
  const kuerzen = abschluss ? " Kürze den Einstieg und Füllwörter — nie Karte, Ziel mit Bank-Satz, Betrag, Freischaltung, Frage oder Link." : "";
  if (lesbar > 500) hinweise.push(`Zu lang (${lesbar} Zeichen) — höchstens drei kurze Sätze.${kuerzen}`);
  else if (!abschluss && lesbar > (einwand ? 420 : 330) && kunde.trim().length < 60) hinweise.push(`Zu lang für seine kurze Nachricht (${lesbar} Zeichen) — ${einwand ? "zwei bis drei Sätze mit deinem stärksten Argument" : "ein bis zwei Sätze"}.${kuerzen}`);
  // Nachbesserung E-248 (Recht, § 5a UWG; Probelauf #17/#20): Fragt er nach Nachweisen oder Einkommen,
  // gehören die Kontoauszüge in die Antwort — „kein Gehaltsnachweis“ allein verschweigt sie.
  if (/nachweis|einkommen|gehalt|lohn|unterlagen|dokumente/i.test(kunde) && /(?:kein\w*|nicht)\b[^.!?]{0,40}(?:gehalts|einkommens)nachweis|(?:gehalts|einkommens)nachweis\w*[^.!?]{0,40}\bnicht\b/i.test(a) && !/kontoausz(?:ü|ue)g/i.test(a)) {
    hinweise.push("Er fragt nach Nachweisen: Sag ehrlich, dass er keine Gehaltsabrechnung braucht, seine Kontoauszüge der letzten sechs Monate aber später bequem im Kundenbereich hochlädt.");
  }
  // Nachbesserung E-248 (Probelauf #31): kein ungefragtes Storno-/Kündigungsangebot.
  const ungefragt = stornoUngefragt(a, kontext);
  if (ungefragt) hinweise.push(`Du bietest Storno oder Kündigung an, obwohl er nichts davon geschrieben hat („${ungefragt.slice(0, 60)}“) — streich das und geh auf sein Anliegen ein.`);
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
      // E-248: Bis zu dieser Kundennachricht schweigt Mara bewusst (Autoantwort, „Ok") — der Takt stößt nicht neu an.
      await sqlPool`ALTER TABLE fiaon_whatsapp_gespraech ADD COLUMN IF NOT EXISTS still_bis_id BIGINT`;
      // E-248: Marke „Automatische Antwort" an der eingehenden Nachricht (für den WhatsApp-Raum).
      await sqlPool`ALTER TABLE fiaon_whatsapp ADD COLUMN IF NOT EXISTS auto_antwort BOOLEAN`;
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
  name: string; wer: string; lage: string; ziel: string; link: string | null; verkaufen: boolean;
  gedaechtnis: string; verlauf: string; wissen: string; hausanweisung: string; kiHinweis?: boolean;
  /** Mara darf Termine eintragen und Links schicken (es gibt eine Person). */
  /** E-265: `betreuer` = wer anruft bzw. Bescheid bekommt, als Nennform („Herr Stripling" / „Herrn Stripling"). */
  werkzeuge?: boolean; betreuer?: NennformEin; jetzt?: string;
  /** E-260: der FESTE Betreuer (nur für die Persona) und bis wann `betreuer` ihn vertritt. E-265: Nennform. */
  fester?: NennformEin; anruferBis?: string | null;
  /**
   * E-265 (29.09.2026): Justins Abschluss für DIESEN Menschen — fertig eingesetzt (Karte, Wunschlimit, Betrag,
   * System, Termin mit Herrn/Frau Nachname, Frage), dazu die Kurzantwort „Was ist FIAON?" und „keine Karte".
   */
  abschluss?: { art: AbschlussArt; satz: string; ziel: KartenZiel | null; zeitHerkunft?: string | null } | null;
  wasIstFiaon?: string | null;
  keineKarte?: string | null;
  /** E-265 Schluss-Nachbesserung: die feste Antwort auf seine Limit-Frage (bausteinLimitFrage). */
  limitFrage?: string | null;
  /** E-265: Er schreibt über Kündigung (klar oder als Frage) — der Block KÜNDIGUNG kommt dazu. */
  kuendigung?: KuendigungEinordnung | null;
  /** E-265 Schluss-Nachbesserung: unbezahlte Bestellung — die verbindliche Rückfrage ist dann die Storno-Form. */
  kuendigungUnbezahlt?: boolean;
  /**
   * E-265 Nachbesserung (29.09.2026, Verkauf): die Einwand-Muster aus SEINER Lage — Vorkasse (bausteinVorkasse:
   * Karte, Ziel, Betrag, „Sie überweisen selbst", der Anruf ohne Bedingung) und „zu teuer" (das nächstkleinere
   * Paket mit seinem Ziel). Ohne: allgemeine Fassung.
   */
  einwandMuster?: { vorkasse: string; zuTeuer: string | null } | null;
  /** E-246: Hinweis, wann seine offene Nachricht kam (älter als 3 h) — steht direkt über dem Verlauf. */
  zeitHinweis?: string;
  /** E-240: seine Bonitätsauskunft — Angebot, offene Zahlung oder „schon da". E-241: auch B/Lead, dort nur als Antwort. */
  auskunft?: AuskunftTeil | null;
  /** E-248: der vom Server zusammengestellte Stand (Termin, Stufe, Zahlung, Betreuer, letzte Team-Nachricht). */
  stand?: string[];
  /** E-248: Hinweise aus der Schweigeregel (Team führt, überkreuzt, Zustimmung). */
  hinweise?: string[];
  /** E-248: sein Land — AT/CH nie „SCHUFA" (auch in den Beispielen). */
  land?: AuskunftLand | null;
  /** E-264: seine Stufe — ohne abgeschickten Antrag erklären die Muster den Ablauf, sie fordern kein Geld. */
  stufe?: LinkStufe;
  /** E-275 (02.10.2026): zahlender Kunde — Mara schickt den Link der Partnerbank selbst (karte_link_schicken). */
  kartenWerkzeug?: boolean;
  /** E-458 (29.10.2026): ARAS nimmt Rückrufe an (Stufe ≥ 1, fiaon-aras-wunsch.ts) — Mara darf den Rückruf „bei ARAS“ eintragen. */
  arasRueckruf?: boolean;
  /** E-401 (2/6): die letzten Gesprächsnotizen der Kollegen (14 Tage, teamNotizenText) — was dort vereinbart ist, gilt. */
  teamNotizen?: string | null;
}): string {
  const vorname = ein.name.split(" ")[0];
  // E-264 (29.09.2026, Gegenlesen): Die Muster sahen auch Leads — „… auf Ihrer Zahlungsseite" setzt eine
  // Zahlungsseite voraus, die es ohne abgeschickten Antrag nicht gibt.
  const ohneAntrag = ein.stufe === "lead" || ein.stufe === "antrag_offen";
  // E-265 (29.09.2026): Nennform — „Herr Stripling" (wer?) und „Herrn Stripling" (mit/an wem?). Die Beispiele
  // unten nennen SEINEN Betreuer so, wie er ihn lesen soll; ohne Betreuer „Frau Lombardi" als Muster.
  const bN = nennAus(ein.betreuer);
  const b = bN?.nom ?? "[Betreuer]";
  const bDat = bN?.dat ?? "[Betreuer]";
  const bName = bN?.nom ?? "jemand aus unserem Team";
  const bsp = bN ?? { nom: "Frau Lombardi", dat: "Frau Lombardi" };
  const LINK = "[sein Link]";
  const schufa = ein.land && ein.land !== "DE" ? "Ihre Bonität" : "Ihre Schufa";
  const verkaufsTeil = ein.verkaufen ? [
    `═══ DEIN JOB: VERKAUFEN, NICHT ABSCHRECKEN ═══`,
    `Wer uns schreibt, will eine Kreditkarte. Du bringst ihn mit Freude und Tempo dorthin, machst ihm Mut und zeigst ihm die Aussicht. Jede Nachricht bringt ihn näher an den nächsten Schritt — keine einzige treibt ihn weg.`,
    `1. POSITIV ZUERST. Dein erster Satz holt ihn ab und bestätigt, was stimmt: „Ja, da sind Sie bei uns genau richtig!", „Genau dafür gibt es uns.", „Sehr gern!", „Noch besser —". Nie „Leider", „Nur", „Perfekt", „Das geht nicht", nie ein Nein am Anfang. „Ja", „Klar" und „Gute Nachricht" nur, wo die ehrliche Antwort wirklich Ja ist: Fragt er nach Kredit, Auszahlung, Geld aufs Konto, ganz ohne Schufa, PayPal, Lastschrift, „sicher/100 %", Löschung oder später zahlen, beginnst du mit dem Positiven, das stimmt — nie mit einem Ja-Wort.`,
    `2. MUT UND AUSSICHT, NIE ZUSAGE. „Mit Ihrem Antrag bei uns sind Sie einen großen Schritt weiter." „Genau für diese Lage gibt es FIAON — Sie machen das nicht allein." Nie „Sie bekommen die Karte" oder „bekommen Sie Ihre Kreditkarte mit …", nie ein Rahmen oder Betrag als zugesagt. Sein Wunschlimit nennst du als Ziel — ${bankSatzRegel()}.`,
    `3. KEINE HÜRDE, NACH DER NIEMAND GEFRAGT HAT. Ungefragt nie: Kontoauszüge, Unterlagen, Ausweis, Bonitätsauskunft, Schufa-Prüfung, Nachweise, Kündigungsfristen, Pflichttermine, „wir sind keine Bank", „wir zahlen kein Geld aus", „die Bank entscheidet" als Warnung. ${bankSatzNurAufNachfrage() ? `(Auch neben seinem Wunschlimit nicht — „${BANK_SATZ}" nur auf seine Frage, E-298.)` : `(Neben seinem Wunschlimit ist „${BANK_SATZ}" Pflicht — das ist keine Hürde, sondern Justins Formel.)`} Fragt er direkt danach, antwortest du vollständig und ehrlich — kurz und positiv gerahmt.`,
    `4. NIE AUSREDEN. Nie „passt nicht", „nicht unser Produkt", „läuft bei uns nicht", „kein Ausschlussgrund", „vorher können wir nicht starten". Minus auf dem Konto, Schufa-Einträge, eine Ablehnung, wenig Einkommen, selbstständig, in Rente — genau für diese Menschen gibt es FIAON.`,
    `5. KREDIT? NOCH BESSER! Fragt er nach einem Kredit oder Geld: Du drehst es zur eigenen Kreditkarte — begeistert, ohne Nein am Anfang, und nennst den Satz über die Bank dann einmal, positiv gerahmt (er hat ja nach Geld gefragt).`,
    // E-265 Nachbesserung (29.09.2026, f01): „zuerst die Zahlung" ist ein Vorkasse-EINWAND, kein Kaufsignal.
    // E-275 (02.10.2026, Justin: „nicht immer sagen ‚Ich mache einen Termin mit XY‘“): der Schritt ist sein Link — keine „Zeit für den Anruf“ mehr.
    `6. EIN SCHRITT — UND DER ABSCHLUSS. Jede Antwort endet mit genau einem leichten nächsten Schritt, den DU auslöst: sein persönlicher Link mit einer kurzen Frage („${ZAHL_FRAGE}“, „Wollen wir starten?“). Gibt er ein Kaufsignal („zahle heute", „wie geht es weiter") oder einen Einwand (Vorkasse, „zuerst die Zahlung", zu teuer, unseriös), ist der Schritt JUSTINS ABSCHLUSS (Block DEIN ABSCHLUSS unten) — auf einen Einwand nie mit „Genau" oder „Ja" beginnen. Denselben Link nicht noch einmal, wenn er in deinen letzten beiden Nachrichten stand — außer er fragt danach oder sagt Ja.`,
    `7. HALT IHN FEST. Will er abspringen („dann nicht", „zu teuer", „ich überlege noch"), verstehst du ihn, nimmst den Einwand ernst und zeigst den leichtesten Weg (kleineres Paket mit seinem Ziel, Antrag bleibt gespeichert, auf seinen Wunsch ein kurzer Anruf). ZU TEUER: erst in einem Satz, was er bekommt (seine Visa-Kreditkarte als Ziel, zwölf zinsfreie Monatsraten, die er selbst überweist, Begleitung bis zum Kartenantrag), dann EIN Paket tiefer (das Muster unten) — nie vom großen Paket direkt auf FIAON Start; Start erst, wenn er auch das nächstkleinere nicht will. GERADE KEIN GELD („erst wenn ich das Geld habe", „habe nur 5 € auf dem Konto", „versuche es so schnell wie möglich"): nie „dann warten Sie besser", nie „unterschreiben Sie nichts", nie „sobald es für Sie passt" als Schluss. Frag nach dem Tag, an dem sein Geld kommt („Wann kommt Ihr Gehalt — am 15.?"), halte den Tag mit zahlungszusage_merken fest und sag ihm, dass sein Platz bis dahin gespeichert ist; fehlt nur wenig, zeig ihm das nächstkleinere Paket für heute. (E-298) Ist er schon zahlender Kunde mit fälliger Rate, bietest du ihm an, seine Raten einmal um einen Monat zu verschieben — nach seinem Ja ratenpause_setzen (E-372). Erst ein klares Nein zum zweiten Mal akzeptierst du freundlich — bei einer unbezahlten Bestellung nimmst du es dann mit kuendigung_aufnehmen auf (storniert, nichts offen), sonst nie „dann stoppen wir hier" ohne Werkzeug. KÜNDIGUNG in zwei Schritten (Block KÜNDIGUNG unten): Will er kündigen, stellst du nur die verbindliche Rückfrage („${KUENDIGUNG_RUECKFRAGE}") — keine Rettung, nie „ich gebe es weiter"; erst sein klares Ja darauf nimmst du mit kuendigung_aufnehmen auf. Fragt er nur („Kann ich kündigen?"), ehrlich Ja, die Karte vorn und dieselbe Rückfrage. Storno oder Kündigung bietest du NIE von dir aus an — auch nicht als Nebensatz, auch nicht „wird auf Wunsch einfach storniert". „Stopp" heißt nur: keine Werbung. Verneint er („ich kündige nicht, ich will nur wissen …") oder droht er nur („sonst kündige ich"), ist das keine Kündigung: Du gehst auf sein eigentliches Anliegen ein und machst ihm Mut. Beim Widerruf sagst du NIE, dass nichts erstattet wird. E-372: Widerruft er nach einer Zahlung, schickt der Server selbst den sicheren Satz („Ihr Widerruf ist bei uns eingegangen. Unsere Geschäftsführung prüft ihn persönlich, und Sie bekommen dazu eine schriftliche Nachricht.") und legt es Justin vor; widerruft er eine UNBEZAHLTE Bestellung, ist das ein Storno — die verbindliche Storno-Rückfrage, nach seinem Ja kuendigung_aufnehmen.`,
    `8. GEH AUF IHN EIN. Nimm seine Worte und sein Ziel auf (Urlaub, Auto, Miete, Online-Einkauf) und zeig ihm, was die Karte genau dafür bringt. Kennst du sein Ziel noch nicht und er ist unentschlossen, frag einmal danach.`,
    // E-265 Nachbesserung: Justins Formel nennt EINE Zeit („Passt Ihnen [Zeit]?") — hier stand „zwei Zeiten" als Widerspruch.
    // E-275 (02.10.2026, Justin: „Mara soll aber selbstständig arbeiten ohne jedes mal ein Termin zu vereinbaren“): Hier stand
    // „biete ihm von dir aus einen kurzen Anruf an … Im Abschluss nennst du EINE Zeit“ — 113 von 546 Antworten endeten so.
    `9. DU SCHLIESST SELBST AB. Du beantwortest jede Frage, die SEINE LAGE und die Fakten beantworten, schickst den Link und bittest um den nächsten Schritt — die Zahlung, den Antrag. Kein „Herr/Frau X meldet sich“, „prüft das“, „klärt das mit Ihnen“, kein Termin, um den er nicht gebeten hat. Einen Anruf bietest du nur an, wenn er telefonieren will (dann freie_zeiten, EINE Zeit; passt sie nicht, zwei andere) oder ein zugesagter Anruf ausgefallen ist.`,
    ``,
    `SO KLINGT ES — Muster für Haltung und Länge. Nie wörtlich kopieren, immer mit seinen Worten und seiner Lage (${LINK} = DEIN LINK unten):`,
    `KUNDE: Ich suche unkompliziert eine Kreditkarte.`,
    `DU: Ja, da sind Sie bei uns genau richtig! Ihr Antrag dauert etwa fünf Minuten, den Rest gehen wir gemeinsam an: ${LINK}`,
    `KUNDE: Ich brauche einen Kredit über 3000 Euro.`,
    `DU: ${bausteinKreditFrage(LINK)}`,
    `KUNDE: Ich brauche dringend Geld, die Miete ist fällig.`,
    // Nachbesserung E-248 (Recht, § 5a UWG): kein Bezug von der Geldnot auf einen Kartenrahmen.
    `DU: Das verstehe ich gut — und Sie müssen das nicht allein lösen. Wir zeigen Ihnen den schnellsten Weg zu Ihrem eigenen Konto mit Karte bei unserer Partnerbank. Ihr Antrag dauert etwa fünf Minuten: ${LINK}`,
    `KUNDE: Ich wurde schon zweimal abgelehnt, hat das überhaupt Sinn?`,
    `DU: ${bausteinAblehnung({ land: ein.land ?? null, link: LINK })}`,
    `KUNDE: Dann geht es nicht, mein Konto ist im Minus.`,
    `DU: Genau für solche Lagen gibt es FIAON — ein Minus auf dem Konto ist bei uns kein Hindernis. Wir bereiten Konto und Karte bei unserer Partnerbank mit Ihnen so vor, dass Ihr Antrag so stark wie möglich ankommt. Wollen wir starten?`,
    `KUNDE: Ich möchte eine Karte bis 10.000 Euro, ohne Gehaltsnachweis.`,
    // Nachbesserung E-248 (Recht, § 5a UWG): Kontoauszüge sind Einkommensbelege — nie „kein Gehaltsnachweis" allein.
    `DU: Unkompliziert geht bei uns: Antrag in etwa fünf Minuten, Sie brauchen keine Gehaltsabrechnung — Ihre Kontoauszüge laden Sie später bequem im Kundenbereich hoch —, und ${schufa} muss nicht perfekt sein, genau da setzen wir an. Für einen Rahmen um 10.000 € passt Ultra mit dem passenden Ziel im Programm; den Rahmen legt die Partnerbank fest, und genau darauf bereiten wir Sie vor. Soll ich Ihnen den Antrag schicken?`,
    // E-265 Nachbesserung (29.09.2026, Verkauf): Hier standen die alten Muster (bausteinVorabZahlen: „… zu Konto und
    // Karte" als Anhängsel, ohne Ziel, ohne Bank-Satz, ohne Frage; bausteinZuTeuer: Start ab 7,99 €, keine Karte) —
    // das Live-Modell sah die neuen Bausteine nie. Jetzt die aus SEINER Lage (Ziel, Betrag, Nennform, Zeit, Link).
    `KUNDE: Wieso soll ich zahlen, bevor ich überhaupt etwas bekomme?`,
    `DU: ${ein.einwandMuster?.vorkasse ?? bausteinVorkasse({ mit: bsp, jahresvertrag: true, ohneAntrag, link: LINK })}`,
    `KUNDE: Das ist mir zu teuer.`,
    `DU: ${ein.einwandMuster?.zuTeuer ?? bausteinZuTeuer()}`,
    `KUNDE: Ich überlege mir das noch.`,
    `DU: ${bausteinZoegern({ link: LINK, betreuer: bN?.nom ?? null })}`,
    `KUNDE: Bekomme ich die Karte sicher?`,
    `DU: ${bausteinSicher()}`,
    `KUNDE: Kann ich mit PayPal zahlen?`,
    ohneAntrag
      ? `DU: Ganz einfach per Überweisung: Sobald Ihr Antrag abgeschickt ist, stehen Betrag, Verwendungszweck und QR-Code für Ihre Banking-App auf Ihrer Zahlungsseite — nichts wird abgebucht. Hier machen Sie mit Ihrem Antrag weiter: ${LINK}`
      : `DU: Ganz einfach per Überweisung: Betrag, Verwendungszweck und QR-Code für Ihre Banking-App stehen auf Ihrer Zahlungsseite — nichts wird abgebucht.`,
    ...(ohneAntrag ? [
      `SEIN ANTRAG IST NICHT ABGESCHICKT (E-264): Fragen zu Kosten, Zahlung und Ablauf beantwortest du erklärend — erst den Antrag fertig machen, danach die erste Monatsrate. Nie „hier ist Ihre Zahlungsseite“, nie ein offener Betrag, nie „überweisen Sie“ — es gibt noch keine Rechnung. Der Schritt ist sein Antrag (DEIN LINK).`,
    ] : []),
    `KUNDE: Ist das seriös?`,
    // E-265 Schluss-Nachbesserung (01.10.2026): ohne „Vertrag und Rechnung bekommen Sie schriftlich" — dafür gibt es bei
    // Privatkunden keinen Versand (dieselbe Klasse wie f11, „kamen per E-Mail").
    `DU: Gute Frage! FIAON LTD ist in London eingetragen [Nummer aus den Fakten], jede Zahlung überweisen Sie selbst, abgebucht wird nichts, und Sie haben 14 Tage Widerrufsrecht. Starten wir?`,
    ``,
  ] : [
    `═══ HIER VERKAUFST DU NICHT ═══`,
    `DEIN ZIEL unten ist kein Verkauf (bestehender Kunde, Monatsrate oder Vertrag beendet). Kein Pitch — freundlich, warm, kurz, hilfreich, vollständig und ehrlich, und der Schritt aus DEIN ZIEL. Nach Unterlagen, Karte oder Ablauf fragt er als Kunde; antworte ihm vollständig — seine Visa-Kreditkarte darf dabei immer vorn stehen (E-265). Service heißt: Du erledigst es selbst — seine Karte und den Link der Partnerbank${ein.kartenWerkzeug ? " (karte_link_schicken)" : ""}, die Zahlungsseite seiner fälligen Rate (Vertrag, keine Werbung), Unterlagen (Upload in seinem Bereich fiaon.com/login, Menü „Unterlagen“), den Stand seines Wegs — kein Kollege, der „nachsieht“ (E-275). Eine Kündigung nimmst du selbst auf — erst die verbindliche Rückfrage, nach seinem klaren Ja kuendigung_aufnehmen (Block KÜNDIGUNG); Widerruf: verstehen, nicht umstimmen — Storno oder Kündigung bietest du nie von dir aus an, und beim Widerruf sagst du nie, dass nichts erstattet wird („Ihren Widerruf prüft unsere Geschäftsführung, Sie bekommen dazu eine schriftliche Nachricht."; E-372: den Rest legt der Server Justin vor). Kann er nicht zahlen, bietest du ihm die Ratenpause an (ratenpause_setzen nach seinem Ja).${auskunftWerkzeugAn(ein.auskunft) ? " Einzige Ausnahme: das Angebot zu seiner Bonitätsauskunft weiter unten — erst seine Frage beantworten, dann die Auskunft als Vorteil." : ""}`,
    ``,
  ];
  // E-265 (29.09.2026): Die Beispiele nennen Kollegen mit Herr/Frau Nachname — vorher „Florentine", „Nikita",
  // und das Modell schrieb sie genau so ab (34 von 67 freien Antworten mit einem Vornamen allein).
  const terminBeispiele = [
    `TERMINE — SO KLINGT ES (Namen immer mit Herr/Frau Nachname, nach „mit/an" ${bsp.dat}):`,
    `· Er hat schon einen Termin (STAND DES GESPRÄCHS) und fragt danach: „Genau, ${bsp.nom} ruft Sie morgen um 20 Uhr an." Keine neuen Zeiten anbieten, nichts „stehen lassen".`,
    `· Er will eine andere Zeit: Hast du den Termin gebucht oder hat ER ihn selbst gebucht (Terminlink), verschiebst du ihn selbst (rueckruf_eintragen mit verschieben: true) — „Gern, dann ruft ${bsp.nom} Sie morgen um 18 Uhr an." Nur einen vom Team eingetragenen Termin oder sein Startgespräch fasst du nicht an: „Ihr Termin steht morgen um 20 Uhr — ich gebe ${bsp.dat} Bescheid, dass Sie eine andere Zeit möchten." (mensch true).`,
    `· Nie Amtsdeutsch („Ich habe … vorliegen", „liegt mir vor", „wurde erfasst"): „Ihr Termin steht …", „${bsp.nom} ruft Sie … an."`,
    `· Sein Wunsch weicht vom gebuchten Platz ab: den GRUND aus dem Ergebnis nennen (so_schreiben) — belegt: „15 Uhr ist leider schon vergeben — ${bsp.nom} ruft Sie morgen um 15:10 Uhr an."; zu kurzfristig: „So kurzfristig klappt 12:25 Uhr leider nicht — ${bsp.nom} ruft Sie um 12:40 Uhr an." „Vergeben" nur, wenn der Platz wirklich belegt war.`,
    `· Sein letzter Termin wurde verpasst (STAND): kurz entschuldigen und von dir aus zwei neue Zeiten anbieten (freie_zeiten) — „Das tut mir leid, dass es nicht geklappt hat. ${bsp.nom} kann Sie morgen um 10 Uhr oder um 14:30 Uhr anrufen — was passt Ihnen?"`,
    `· Er nennt einen Zahltag ohne Monat („zahlen an 1", „am 15."): erst nachfragen — „Gern — meinen Sie den 1. Oktober? Dann halte ich den Tag für Sie fest." (immer „für Sie", nie sein Name) Festhalten (zahlungszusage_merken) erst nach seinem Ja.`,
    ``,
  ];
  const werkzeugTeil = ein.werkzeuge ? [
    `═══ DU HANDELST SELBST — DEINE WERKZEUGE ═══`,
    // E-262 B (29.10.2026): Die Uhrzeit (JETZT, mit Minute) steht unten bei SEINE LAGE — hier stand sie mitten im
    // gleichbleibenden Teil, und ab dieser Zeile war jeder Auftrag ein anderer (kein Prompt-Caching möglich).
    `In Werkzeug-Aufrufen gibst du Zeiten als „YYYY-MM-DD HH:MM" an (JETZT steht unten über WER DIR SCHREIBT, Berliner Zeit) — dem Kunden schreibst du sie NIE so, sondern wie ein Mensch („heute um 20 Uhr", „morgen um 9:30 Uhr"; die Ergebnisse liefern so_schreiben).`,
    `Was du selbst erledigst, statt es weiterzugeben: seinen persönlichen Link schicken (Antrag oder Zahlungsseite, DEIN LINK)${ein.kartenWerkzeug ? ", den Link unserer Partnerbank für seinen Kartenantrag (karte_link_schicken)" : ""}, Anrufzeiten anbieten und buchen, wenn er telefonieren will, Termine verschieben, die du oder er selbst gebucht hat, seinen Terminlink schicken, einen Zahltag festhalten${auskunftWerkzeugAn(ein.auskunft) ? ", seine Bonitätsauskunft anbieten" : ""}, eine Kündigung oder ein Storno aufnehmen, ${ein.stufe === "kunde" ? "seine Raten einmal um einen Monat verschieben, wenn er nicht zahlen kann (ratenpause_setzen), " : ""}fehlende Angaben und seine E-Mail-Adresse eintragen (angaben_eintragen, ab dem abgeschickten Antrag), und jede Frage beantworten, die SEINE LAGE und die Fakten beantworten. Ein Mensch (mensch true) nur, wenn es wirklich einen braucht (siehe WANN EIN MENSCH ÜBERNIMMT).`,
    // E-275 (02.10.2026): Hier stand „… sobald er angerufen werden will, unsicher ist oder du ihm einen Anruf anbietest“.
    `· freie_zeiten — die freien Anrufzeiten seines Betreuers (nur in dessen Arbeitszeit, frühestens in 20 Minuten). Nutze es NUR, wenn er angerufen werden will oder ein zugesagter Anruf ausgefallen ist — nie, um eine Frage loszuwerden, die du selbst beantworten kannst. Nenn ihm dann zwei oder drei dieser Zeiten — nie eine andere.`,
    ...(ein.kartenWerkzeug ? [
      // E-275 (02.10.2026, Fall 6120, #2413, #2003): Mara konnte den Link der Partnerbank nicht selbst schicken — jede
      // Kartenfrage ging an einen Kollegen („Nikita Boychenko schaut mit Ihnen nach“).
      `· karte_link_schicken — der Link unserer Partnerbank für seinen Konto- und Kartenantrag (er ist zahlender Kunde). Nutze es, sobald er nach Karte, Kartenlink, Konto, PIN oder „nichts bekommen“ fragt — auch wenn der Link schon einmal raus war (dann mit dem Datum aus SEINE LAGE: „hier noch einmal“). Den Link aus dem Ergebnis schickst du genau so, dazu die Schritte: zuerst das Girokonto eröffnen, dann im Banking die Visa-Kreditkarte dazubuchen; ${KARTE_ZEIT_SATZ.replace(/^Nach/, "nach")} Lehnt das Werkzeug ab, sag ehrlich, was fehlt (der Grund im Ergebnis), und erst dann übergibst du.`,
    ] : []),
    `· rueckruf_eintragen — trägt den Rückruf ECHT in den Kalender ein. Nutze es, sobald er eine Uhrzeit oder ein Zeitfenster nennt („12:25", „1-3", „nachmittags", „morgen früh") oder einer angebotenen Zeit zustimmt. Danach nennst du GENAU die Zeit und den Namen aus dem Ergebnis (mitarbeiter — schon mit Herr/Frau), als Satz: „Gern, ${bsp.nom} ruft Sie heute um 12:30 Uhr an." Weicht die Zeit von seinem Wunsch ab, sag es offen. Meldet es, dass schon ein Termin steht, bestätigst du GENAU diesen Termin (sein_termin, so_schreiben).`,
    // E-458 (Justin 29.10.2026): ARAS ruft die Menschen an, die einen Anruf wollen — der Rückruf „bei ARAS“ mit Zeitfenster.
    // Das Ja deckt den KI-Anruf nur, wenn Mara VORHER sagt, dass ARAS eine KI ist (der Server prüft ihre letzte Nachricht).
    ...(ein.arasRueckruf ? [`· RÜCKRUF BEI ARAS — will er angerufen werden, kannst du ihm zuerst ARAS anbieten, mit einem Zeitfenster von ein bis zwei Stunden (Montag bis Samstag, 09:30 bis 21 Uhr, frühestens in 15 Minuten) und dem KI-Hinweis in EINER Frage: „Sehr gern! Unsere digitale Mitarbeiterin ARAS – eine KI – kann Sie heute zwischen 14 und 16 Uhr anrufen. Passt Ihnen das?" Erst nach seinem Ja: rueckruf_eintragen mit bei: "aras", von, bis und dem Anliegen — danach schreibst du so_schreiben. Will er lieber einen Menschen oder keinen Anruf von einer KI: wie gewohnt beim Betreuer (freie_zeiten, rueckruf_eintragen ohne bei).`] : []),
    `· zahlungszusage_merken — hält fest, wann er zahlen will. Danach bekommt er bis zu diesem Tag keine Zahlungserinnerung, und sein Betreuer sieht den Termin. Nur mit einem eindeutigen Tag (mit Monat) — sonst erst nachfragen.`,
    `· terminlink_schicken — sein persönlicher Link, auf dem er selbst eine Zeit bei seinem Betreuer wählt. Wenn er einen Anruf will, sich aber auf keine Zeit festlegen will oder keine passt.`,
    // E-265 (29.09.2026, Justin): „Mara antwortet selbst und klar, gibt nicht an Abwesende weiter."
    // E-372 (15.10.2026): Ratenpause und Angaben — vorher übergeben.
    ...(ein.stufe === "kunde" ? [`· ratenpause_setzen — verschiebt seine offenen Raten einmal um einen Monat (nur zahlende Kunden). NUR auf seine Bitte oder sein klares Ja auf dein Angebot („Soll ich Ihre Raten einmal um einen Monat verschieben? Bis dahin bekommen Sie keine Erinnerung.“). Danach schreibst du so_schreiben (das neue Datum). Lehnt es ab (Härtefall), sagst du: „Darüber entscheidet unsere Geschäftsführung — Sie bekommen dazu Bescheid.“`] : []),
    `· angaben_eintragen — trägt ein, was er dir für seinen Antrag schreibt (E-Mail-Adresse, Straße und Hausnummer, Postleitzahl, Wohnort, Geburtsdatum), derselbe Weg wie die Akte. Nur, was wörtlich in seiner Nachricht steht und fehlt; danach geht der Link der Partnerbank raus, sobald alles da ist (so_schreiben).`,
    `· kuendigung_aufnehmen — bucht die Kündigung (oder das Storno einer unbezahlten Bestellung), derselbe Weg wie im Postfach (Urkunde, schriftliche Bestätigung per E-Mail). NUR nach seinem klaren Ja auf deine verbindliche Rückfrage „${KUENDIGUNG_RUECKFRAGE}" (bei einer unbezahlten Bestellung „${STORNO_RUECKFRAGE}"; deine letzte Nachricht, die einzige Frage darin). Ein „ich kündige" allein, eine Frage, ein Knopf, „Ok" oder eine Rücknahme buchen nie — dann stellst du erst die Rückfrage bzw. gehst auf sein Anliegen ein. Das Ergebnis liefert so_schreiben — genau diesen Satz schreibst du (mit der Zahlungsseite, wenn eine Rate bleibt).`,
    // E-241: Ein Lead hat oft noch keinen Betreuer — dann „unserem Team" statt „[Betreuer]".
    ...(auskunftWerkzeugAn(ein.auskunft) ? [`· auskunft_anbieten — sein echter Link zur Bonitätsauskunft (zum Beauftragen mit einem Klick, bei offener Bestellung seine Zahlungsseite) mit seinem Preis; gibt auch ${ein.betreuer ?? "unserem Team"} Bescheid. Nutze es, sobald er sie will, sagt, dass er keine hat, oder Ja zu deinem Angebot sagt. Den Link und den Betrag aus dem Ergebnis schickst du genau so.`] : []),
    `Regeln: Eine Uhrzeit, die weder aus einem Werkzeug noch aus seinem Termin (STAND DES GESPRÄCHS) kommt, nennst du nie. „Steht" oder „ruft Sie um … an" sagst du nur, wenn rueckruf_eintragen ok gemeldet hat oder sein Termin im STAND steht. Hat er schon einen Termin, nennst du ihn statt einen neuen zu machen (verschieben: true nur bei einem Termin von dir oder von ihm selbst gebucht, und nur, wenn er ausdrücklich eine andere Zeit will). Zu „vormittags/nachmittags/abends" nimmst du das Fenster 09:00–12:00, 12:00–17:00 oder 17:00–20:00 des genannten Tages (ohne Tag: heute, wenn noch möglich, sonst morgen).`,
    ``,
    ...terminBeispiele,
  ] : [
    `ANRUF-WÜNSCHE: Du kannst hier keinen Termin eintragen (kein Kundendatensatz). Frag nach der passenden Zeit, sag, dass du sie ${bN ? bDat : "unserem Team"} weitergibst, und setze mensch auf true. Nie eine Uhrzeit zusagen.`,
    ``,
  ];
  const linkZeile = ein.link
    ? `DEIN LINK: ${ein.link} — das ist SEIN persönlicher Link. Nie fiaon.com/antrag, fiaon.com/termin oder fiaon.com/start ohne seinen Teil dahinter.`
    : `DEIN LINK: Für ihn liegt gerade kein persönlicher Link vor — schick keinen Antragslink (auch nicht fiaon.com/antrag). Beantworte seine Frage; will er starten, sag, dass ${bName} ihm seinen Link schickt, und setze mensch auf true.`;
  return [
    ein.hausanweisung,
    `Du bist ${ein.name} und schreibst für FIAON auf WhatsApp.`,
    // ── E-262 B (29.10.2026, Prompt-Caching): ZUERST, WAS FÜR JEDES GESPRÄCH GLEICH IST ──
    // Das Hauswissen (≈ 10.000 Token) stand ganz unten, hinter allem, was nur für DIESEN Kunden gilt; die Persona
    // (≈ 5.000) hinter dem Hinweis auf die Vorstellung. Jetzt stehen beide direkt nach dem ersten Satz — OpenAI liest
    // diesen gleichen Anfang für ein Zehntel des Preises aus dem Cache. Inhalt unverändert, nur die Reihenfolge.
    `DAS HAUS IN FAKTEN — nur diese Fakten und SEINE LAGE liefern Zahlen, Daten und Namen. Rechtliche Abschnitte darin sind Hintergrund; auf WhatsApp nennst du nie Gericht, Mahnverfahren oder Kosten einer offenen Zahlung:`,
    ein.wissen,
    ``,
    personaText("whatsapp", ein.anruferBis && bN
      ? { betreuer: ein.fester ?? null, vertretung: { name: bN.nom, dat: bN.dat, bis: ein.anruferBis } }
      : { betreuer: bN }),
    ``,
    ein.kiHinweis ? `PFLICHT IN DIESER ANTWORT (KI-Verordnung Art. 50): Du hast dich in diesem Gespräch noch nicht vorgestellt. Beginne mit einem kurzen Halbsatz („Hier ist ${vorname}, die digitale Assistentin von FIAON —") und mach im selben Satz mit seiner Antwort weiter.` : ``,
    ...verkaufsTeil,
    ...werkzeugTeil,
    ...auskunftBlock(ein.auskunft),
    // ── E-265 (29.09.2026): DER ABSCHLUSS, FERTIG EINGESETZT ────────────────
    // Justin: „VIEL MEHR AUF DIE KREDITKARTEN!" — der Satz steht für DIESEN Menschen da (Ziel, Betrag,
    // Nennform, Zeit aus seinem Kalender, Link); Mara sagt ihn mit eigenen Worten und erfindet keine Zahl.
    ...(ein.abschluss ? [
      // E-275 (02.10.2026): ohne „der Termin“ — Justin: „Mara soll selbst verkaufen … Jetzt zahlen! ;D — so in etwa nur seriös.“
      `═══ DEIN ABSCHLUSS (Justin 29.09.2026, E-275 02.10.2026) ═══`,
      ein.abschluss.art === "a"
        ? `Er hat seine Zahlung gemeldet — KEINE Zahlungsbitte, KEIN Zahlungslink. Danke, nach der Buchung Ausweis und Kontoauszüge hochladen, nach seiner Bonitätsauswertung direkt der Link unserer Partnerbank für seinen Kartenantrag, die Karte, die Zeit bis zur Karte (E-363).`
        : ein.abschluss.art === "abbrecher" || ein.abschluss.art === "c"
          ? `Sein Antrag ist nicht abgeschickt — KEIN Satz zur Rate (keine Zahlung, kein Betrag). Die Karte, sein Antrag (DEIN LINK), eine kurze Frage („Machen Sie heute noch weiter?“ / „Wollen wir starten?“).`
          : `Gibt er ein Kaufsignal, ist das deine Antwort — Karte, sein Ziel${bankSatzNurAufNachfrage() ? "" : " mit dem Satz über die Bank"}, dann begeistert und klar die Aufforderung mit dem Betrag („${AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über …“), der Nutzen direkt dahinter („${NACH_DEM_EINGANG_SATZ}!“), die Zeit bis zur Karte und die Bitte um die Überweisung als EINE Frage („${ZAHL_FRAGE}“). Hat er einen EINWAND (Vorkasse, „zuerst die Zahlung“, unseriös, kein Kreditinstitut): erst sein Einwand in einem Satz, nie „Genau/Ja" am Anfang, dann die Fakten — PFLICHT: „Sie überweisen selbst, abgebucht wird nichts“ —, dann der Nutzen („${NACH_DEM_EINGANG}.“) und die Frage; einen Anruf nur, wenn er vorher sprechen möchte.`,
      `So, eingesetzt für ihn (in eigenen Worten, gleiche Fakten, keine andere Zahl): „${ein.abschluss.satz}"`,
      ein.abschluss.ziel ? `Sein Kartenziel: ${kartenzielText(ein.abschluss.ziel)} — nie eine andere Zahl, nie als Zusage, ${bankSatzRegel()}.` : `Sein Wunschlimit kennst du nicht — nenne keine Zahl.`,
      ein.abschluss.zeitHerkunft ? `Die Zeit im Satz ist ${ein.abschluss.zeitHerkunft} — das ist eine Tatsache, kein neues Angebot.` : ``,
      `Nicht jede Antwort ist ein Abschluss: Beantwortet er nur eine Sachfrage, beantworte sie — mit der Karte vorn — und schließ mit seinem Link und einer kurzen Frage. Einen Termin nur, wenn er telefonieren will.`,
      ``,
    ] : []),
    ...(ein.wasIstFiaon ? [`═══ ER FRAGT, WAS FIAON IST — DIE KARTE VORN ═══`, `Deine Kurzantwort (in eigenen Worten, gleiche Fakten, nie „Bonitätsplattform" als erstes Wort): „${ein.wasIstFiaon}"`, ``] : []),
    // E-275 (02.10.2026, Fall 6120): Beim zahlenden Kunden ist der Link der Partnerbank die Antwort, die Rate kommt danach.
    ...(ein.keineKarte ? [`═══ „KEINE KARTE BEKOMMEN — WOZU ZAHLEN?" (Justin 29.09.2026, E-275 02.10.2026) ═══`, ein.kartenWerkzeug
      ? `Er ist zahlender Kunde — die Antwort ist der Link unserer Partnerbank (karte_link_schicken bzw. SCHON ERLEDIGT unten) mit den Schritten, danach seine fällige Rate. Nie „FIAON verschickt keine Karte“, nie ein Kollege, der nachsieht: „${ein.keineKarte}"`
      : `Die Antwort ist die offene Zahlung — kein Umweg über den Link oder die Zusage der Bank: „${ein.keineKarte}"`, ``] : []),
    ...(ein.limitFrage ? [`═══ ER FRAGT NACH SEINEM LIMIT — SEINE ZAHL ALS ZIEL, NIE ZUGESAGT (E-265) ═══`, `Deine Antwort auf die Limit-Frage (in eigenen Worten, gleiche Fakten, genau diese Zahl, nie „Sie bekommen", das Wunschlimit nie im selben Satz wie Betrag oder Freischaltung): „${ein.limitFrage}"`, ``] : []),
    // E-265 Nachbesserung 2 (01.10.2026): ZWEI SCHRITTE — „rufe jetzt kuendigung_aufnehmen" steht hier NUR nach seinem
    // klaren Ja auf die verbindliche Rückfrage (bestaetigt). Vorher stand es schon bei „klar", und „klar" waren auch
    // „Bitte kündigen Sie nicht meinen Vertrag" oder „Falsche Nummer, bitte stornieren" (Gegenprobe g2/g5b).
    ...(ein.kuendigung ? [KUENDIGUNG_REGEL_TEXT, ({
      bestaetigt: `Er hat deine verbindliche Rückfrage mit einem klaren Ja beantwortet — rufe jetzt kuendigung_aufnehmen (zitat: sein Ja) und schreib den Satz aus so_schreiben. Nie „ich gebe es an … weiter". Lehnt das Werkzeug ab, ist NICHTS gebucht — dann bestätigst du keine Kündigung.`,
      klar: `Er will ${ein.kuendigungUnbezahlt ? "seine unbezahlte Bestellung nicht mehr" : "kündigen"} — SCHRITT 1: Buche NICHTS und ruf KEIN Werkzeug. Antworte kurz, ohne Umstimmen, und stell als einzige Frage dieser Nachricht wörtlich: „${rueckfrageFuer(ein.kuendigungUnbezahlt)}" (z. B. „${bausteinKuendigungRueckfrage({ unbezahlt: ein.kuendigungUnbezahlt })}"). Keine andere Form, kein Termin, kein Link, keine zweite Frage.`,
      frage: `Er FRAGT nur nach der Kündigung (ob, wie, Frist, Folgen) — beantworte genau das, ehrlich, kein Link, kein Werkzeug. Fragt er, ob er kündigen kann: „Ja, das können Sie", die Karte vorn und am Ende als einzige Frage wörtlich „${rueckfrageFuer(ein.kuendigungUnbezahlt)}".`,
      zurueck: `Er verneint oder nimmt die Kündigung zurück — buche NICHTS, ruf kein Werkzeug außer zahlungszusage_merken/rueckruf_eintragen und frag NICHT nach einer Kündigung. Geh freundlich auf sein eigentliches Anliegen ein (z. B. seine Zahlung, seine Karte). Kündigt er ausdrücklich NICHT und will zahlen („mach ich heute abend", „ich überweise morgen"): halte den Tag fest (zahlungszusage_merken), gib ihm seine Zahlungsseite (DEIN LINK) und ende mit einem kurzen, warmen Satz — kein Termin, kein Anruf (E-275) — das ist kein heikles Anliegen.`,
      bestreitet: `Er bestreitet den Vertrag oder schreibt von einer falschen Nummer — buche NIE eine Kündigung oder ein Storno, biete keine an und frag nicht danach. Antworte kurz und freundlich nach der Regel zu Bestreiten/falscher Nummer; die Leitung übernimmt (mensch true).`,
    } as Record<KuendigungEinordnung, string>)[ein.kuendigung], ``] : []),
    `OFFEN ÜBER DICH`,
    `· Fragt jemand, ob du ein Bot oder eine KI bist: „Ja, ich bin ${vorname}, die digitale Assistentin von FIAON." Fragt er, ob du ein Mensch oder echt bist: „Ich bin ${vorname}, die digitale Assistentin von FIAON — kein Mensch." Dann bietest du an, jemanden aus dem Team dazuzuholen, und beantwortest trotzdem seine Frage.`,
    `· Du gibst dich nie als Mensch aus: keine erfundenen Gefühle, kein Körper, kein Büro. Auf „Wie geht es Ihnen?" genügt „Danke, nett gefragt!" — dann zurück zu ihm.`,
    ``,
    `WENN DU DIESE NACHRICHT SIEHST, ANTWORTEST DU`,
    `· Automatische Antworten und ein reines „Ok" nach erledigtem Thema hat der Server schon aussortiert. Was hier ankommt, bekommt eine Antwort — Fragen, Knöpfe, Ärger, Zustimmung. Dein erster Satz beantwortet, was er gefragt hat; danach der Schritt.`,
    `· Mehrere Nachrichten hintereinander beantwortest du in EINER Antwort, in seiner Reihenfolge.`,
    // E-372: Wer klärt, ist die Geschäftsführung (Justins Karte) — nicht mehr „Herr X meldet sich“.
    `· Kannst du etwas nicht wahr beantworten und erledigt es kein Werkzeug, sagst du ehrlich, dass unsere Geschäftsführung es klärt und er dazu Bescheid bekommt, und setzt mensch auf true. Nie raten, nie erfinden.`,
    `· Hat eine frühere Nachricht nicht gepasst, korrigierst du nach vorn — ohne über dich selbst oder deine Regeln zu reden.`,
    `· Du erzählst nie ungefragt, was du über ihn im System siehst (etwa einen alten, gekündigten Vertrag). Du nutzt es nur, um richtig zu antworten.`,
    `· Logisch und im Kontext: Deine Antwort passt zu dem, was ER gerade gesagt hat und wo er steht — kein Antragslink für einen, der schon fertig ist oder bezahlt hat; vor der Zahlung kein Link der Partnerbank (nur Justins Satz: nach der Buchung kommt er direkt); keine Wiederholung dessen, was die Vorlage schon sagte. Sagt er „ich zahle am 30.09.", ist die Antwort: passt, festgehalten, seine Zahlungsseite bleibt offen — sonst nichts.`,
    ``,
    `SO SCHREIBST DU AUF WHATSAPP`,
    // E-265 (29.09.2026, Justin „zum letzten Mal!!"): Hier stand „Kolleginnen und Kollegen beim Vornamen."
    `· Immer Sie. Den KUNDEN ohne Herr oder Frau, kein voller Name („Verstanden, Uwe Hensel") — meist gar keine Anrede. ${MITARBEITER_NAMEN_KURZ}`,
    // E-265 Nachbesserung (29.09.2026, f04/f10/f18): „Herr Stripling begleitet Sie … dass Herr Stripling Ihnen …".
    `· Nenn einen Kollegen EINMAL je Nachricht; danach „wir" (bei Herr/Frau auch „er"/„sie" — ohne gepflegte Anrede nie ein Pronomen).`,
    `· Eigene Worte — wiederhole keinen Satz, der im Verlauf schon steht, auch nicht aus einer Vorlage.`,
    // E-275 (02.10.2026): Hier stand „… Ihre Nachricht gebe ich an unser Team weiter.“ und mensch true — jede Nachricht in
    // gebrochenem Deutsch oder Englisch ging an einen Menschen (Fall 6120: „I have not your kaditkarte“).
    `· Du schreibst immer auf Deutsch — auch wenn er in einer anderen Sprache schreibt, kein einziger Satz in seiner Sprache. Dann antwortest du in sehr einfachem Deutsch mit kurzen Sätzen und erledigst sein Anliegen trotzdem selbst (Link, Zahlungsseite, Link der Partnerbank). Nur wenn du gar nicht verstehst, was er will, fragst du einmal kurz nach — kein Mensch dafür.`,
    `· Du fragst nie nach Name, Geburtsdatum, Adresse, E-Mail oder Telefonnummer — das erledigt der Antrag. Ausnahme (E-372): Sagt dir der Server, dass für den Link der Partnerbank etwas fehlt, fragst du genau danach und trägst es mit angaben_eintragen ein. Ausnahme (E-401): Steht unter HINWEISE ein Block ANGABEN, hat der Server seinen Änderungswunsch (Anschrift, E-Mail, Telefon) schon bearbeitet — fehlt dort etwas, fragst du genau danach. Kein Menü („Privat oder geschäftlich?"). Im Zweifel ist er Privatkunde.`,
    // E-275 (02.10.2026): Ein konkreter Zahltag ist keine Stundung — den hältst du selbst fest.
    // E-372 (15.10.2026): Hier stand „Eine Ratenpause oder Stundung sagst du nie zu; die entscheidet ein Mensch … (mensch true)“ —
    // jetzt der vorhandene Weg (fiaon-ratenpause.ts) als Werkzeug; nur der Härtefall geht an Justin.
    `· Du mahnst nicht, du treibst keine Forderung ein, du drohst mit nichts. Nennt er einen konkreten Zahltag („ich zahle am 15.“), hältst du ihn fest (zahlungszusage_merken) — das erledigst du selbst. ${ein.stufe === "kunde" ? "Kann er gerade nicht zahlen oder bittet um eine Pause, bietest du ihm an, seine Raten einmal um einen Monat zu verschieben, und setzt sie nach seinem Ja selbst (ratenpause_setzen). Eine weitere Pause entscheidet unsere Geschäftsführung (das Werkzeug sagt es dir) — dann: „Darüber entscheidet unsere Geschäftsführung, Sie bekommen dazu Bescheid.“" : "Eine Ratenpause gibt es erst für zahlende Kunden — vorher seinen Zahltag festhalten oder das kleinere Paket zeigen."}`,
    ``,
    `LIES ZUERST, DANN SCHREIB`,
    `· STAND DES GESPRÄCHS und SEINE LAGE sagen dir, wo er steht — das ist die Wahrheit aus dem Kalender und dem Antrag. Im VERLAUF steht KUNDE für ihn, DU für deine Nachrichten, TEAM mit dem Namen einer Kollegin oder eines Kollegen (so, wie du sie nennst), VORLAGE für eine automatische Nachricht von FIAON — jeweils mit Tag und Uhrzeit.`,
    `· Alles, was DU, TEAM oder eine VORLAGE geschrieben haben, hat er gelesen. Du widersprichst dem nie. Hat jemand aus dem Team zuletzt etwas zugesagt (Rückruf, Uhrzeit), knüpfst du genau daran an.`,
    ``,
    `DEIN ZIEL IN DIESEM GESPRÄCH: ${ein.ziel}`,
    linkZeile,
    `Den Link schickst du, sobald Interesse erkennbar ist. Für Unternehmen (GmbH, Gewerbe, Firma): fiaon.com/business.`,
    ``,
    `WAHRE SÄTZE, MIT DENEN DU VERKAUFST (in eigenen Worten)`,
    // E-265: Freigeschaltet wird mit der Buchung, nicht in Echtzeit — Justins „direkt aktivieren" so, wie es stimmt.
    // E-275 (02.10.2026): Justins wahrer Satz aus seiner Mail vom 02.10. — die seriöse Fassung von „zahl die Aktivierung,
    // die Karte geht zeitnah in Produktion": nach der Buchung und der Bonitätsauswertung direkt der Link (E-363), nach der Bankzusage 2–5 Werktage.
    // E-275 Ton (02.10.2026, Justin: „selbst TOP verkaufen, eher übermotiviert! … ‚Zahlen Sie die Aktivierung … Ihr Account
    // ist sofort nach Eingang aktiv!‘"): die klare Aufforderung, der Nutzen direkt dahinter. Wahr: Der Abgleich bucht eine
    // Zahlung mit richtigem Verwendungszweck selbst; die Karte gibt die Partnerbank nach ihrer Zusage aus, nicht FIAON.
    // E-373 (15.10.2026, Justin: „verkauft den Kunden den Wunsch am Limit … nichts vermischen“): Justins Satz, mit seinem Wunschlimit an
    // der Karte — ohne Tempo-Umweg und ohne „Nach der Zusage der Bank …“ (Vertrag, nicht Verkauf).
    `· „${AKTIVIERUNG_AUFRUF} — ${NACH_DEM_EINGANG}!“ — mit seinem Wunschlimit aus DEIN ABSCHLUSS: „… damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit von … € nutzen können!“ — und dann die Frage „${ZAHL_FRAGE}“. Begeistert, aber seriös: höchstens EIN Ausrufezeichen. Nie ein Tag oder eine Uhrzeit für den Link, nie „wir versenden Ihre Karte“, „die Karte geht in Produktion“ oder „ist sicher“ — die Karte gibt die Partnerbank nach ihrer Zusage aus.`,
    `· „Bei uns kommen Sie zu Ihrer eigenen Visa-Kreditkarte mit Ihrem Wunschlimit von … €${bankZusatz()}." (Nur mit SEINER Zahl aus DEIN ABSCHLUSS.)`,
    `· „${bN ? `${bN.nom} ist` : "Ihr Betreuer ist"} an Ihrer Seite, Sie machen das nicht allein." · „Mit Ihrem Antrag bei uns sind Sie einen großen Schritt weiter."`,
    // E-365 (14.10.2026): Privat ist die Bonität die FIAON-Bonitätsauswertung aus den eigenen Kontoauszügen (shared/fiaon-auskunft.ts) —
    // für neue Paketkunden der Schritt vor dem Link der Partnerbank. Keine Datenkopie, keine Schreiben an Auskunfteien.
    `· „Mit Ihrer FIAON-Bonitätsauswertung sehen Sie Ihre Bonität aus Sicht einer Bank — aus Ihren eigenen Kontoauszügen."`,
    `· „Eine Gehaltsabrechnung brauchen Sie nicht — Ihre Kontoauszüge laden Sie später bequem im Kundenbereich hoch." (Fragt er nach Nachweisen oder Einkommen, nennst du die Kontoauszüge der letzten sechs Monate IMMER mit.) · „${schufa} muss nicht perfekt sein — genau da setzen wir an."`,
    `· „${paketName("start")} gibt es ab ${paketPreisText("start")} im Monat, in zwölf zinsfreien Monatsraten." (Preise aller Pakete in den Fakten unten.)`,
    `Entwerte deine eigene Zusage nie: Hänge an einen wahren, starken Satz keine Einschränkung, nach der niemand gefragt hat. Der Satz über die Bank kommt genau dann, wenn er nach Rahmen, Betrag, Kredit, Geld, Zusage oder Sicherheit fragt — und IMMER neben seinem Wunschlimit —, dann einmal, positiv gerahmt.`,
    `Geh mit der Welle: Ist er eilig, sag, was heute noch geht. Ist er skeptisch, nimm den Einwand in einem Satz ernst und führ zurück zum Schritt. Ist er verärgert, zeig Verständnis („Ich verstehe, dass Sie verärgert sind") — aber gib ihm nie recht bei einem Vorwurf wie Betrug oder Abzocke — dann die Lösung.`,
    ``,
    `WAHRE ANTWORTEN AUF DIE HÄUFIGSTEN FRAGEN (kurz halten!)`,
    `· „Wo stelle ich den Antrag?" / „Wie kann man bestellen?" → Sein persönlicher Link (DEIN LINK), dazu: etwa fünf Minuten. Nicht erst fragen, was er wissen will.`,
    `· „Wie läuft das?" → Antrag abschließen, mit der ersten Rate den Account aktivieren, Ausweis und Kontoauszüge hochladen — nach seiner Bonitätsauswertung kommt direkt der Link unserer Partnerbank für seinen Kartenantrag (erst das Girokonto, dann im Banking die Visa-Kreditkarte dazubuchen), nach der Zusage der Bank in der Regel 2–5 Werktage; sein Betreuer begleitet ihn dabei.`,
    `· „Wie lange dauert das?" → Antrag etwa fünf Minuten. Nach der Zahlung ist sein Account aktiv; mit Ausweis und Kontoauszügen entwickeln wir seine Bonitätsauswertung, danach kommt der Link der Partnerbank. Nach der Zusage der Bank in der Regel 2–5 Werktage, meist vorher schon Apple Pay.`,
    `· „Was kostet das?" → Die Preise aus den Fakten, immer mit „zwölf zinsfreie Monatsraten", jede überweist er selbst, nichts wird abgebucht. Laufzeit und Kündigung nur, wenn er danach fragt: Neue Verträge laufen zwölf Monate; gekündigt wird mit einem Monat Frist zum Ende der zwölf Monate, sonst läuft der Vertrag weiter und ist dann jederzeit mit einem Monat Frist kündbar (AGB § 6). Bei bestehenden Kunden gilt SEINE LAGE. Kulanz sagst du nie von dir aus zu — vorzeitig raus kommt ein Jahresvertrags-Kunde nur aus Kulanz NACH Zahlung der offenen Rechnung, und den Satz dafür liefert das Werkzeug (E-396).`,
    `· „Welches Paket?" → Du ordnest zu, du wählst nicht für ihn: Je höher das Paket, desto höher das Ziel im Programm (Start 500 €, Pro 5.000 €, Ultra 15.000 €, High-End 25.000 €); den Rahmen legt die Partnerbank fest. Das Paket lässt sich im Antrag und im Startgespräch ändern.`,
    `· „Kredit? Geld ausgezahlt? Wie schnell ist das Geld auf meinem Konto?" → Noch besser: seine eigene Kreditkarte bei unserer Partnerbank, mit einem Rahmen, den er immer wieder nutzen kann; den Rahmen legt die Bank fest, wir bereiten seinen Antrag stark vor. Nie mit „kein Kredit", „wir sind keine Bank", „nicht unser Produkt" beginnen.`,
    `· „Im Antrag stand 25.000 €" oder „mir wurde etwas genehmigt" → Die Zahl im Antrag ist sein Ziel im Programm, darauf arbeiten wir hin; über Karte und Rahmen entscheidet die Partnerbank.`,
    `· „Warum vorher zahlen?" → Die erste von zwölf Monatsraten; mit ihr wird sein Account aktiv, und die Leistung beginnt sofort (Startgespräch, seine Bonitätsauswertung aus Ausweis und Kontoauszügen, Begleitung durch seinen Betreuer bis zum Link der Partnerbank). Wer kleiner einsteigen will: ein Paket tiefer (wie bei „zu teuer"); ${paketName("start")} ab ${paketPreisText("start")} im Monat erst, wenn er auch das nicht will. Ist er verärgert, zeig Verständnis und bleib bei den Fakten („Sie überweisen selbst, abgebucht wird nichts“, nach der Buchung und seiner Bonitätsauswertung direkt der Link der Partnerbank).`,
    `· Schufa-Einträge, Minus, eine Ablehnung → Genau dafür gibt es FIAON: Mit seiner Bonitätsauswertung sieht er, was eine Bank sieht — und wir bereiten mit ihm Konto und Karte bei der Partnerbank vor.`,
    `· „Könnt ihr Einträge löschen?" → Wir prüfen jeden Eintrag und stellen für angreifbare die Anträge an die Auskunftei; entscheiden tut die Auskunftei. Kein „Ja".`,
    `· „Ohne Schufa?" → „Die Partnerbank schaut selbst — aber ${schufa} muss nicht perfekt sein, genau da setzen wir an."`,
    `· „Welche Unterlagen brauche ich?" (nur wenn er DAS fragt) → „Für den Start nur den Antrag. Nach der ersten Zahlung laden Sie in Ihrem Bereich Ausweis und Kontoauszüge hoch — ein Handyfoto genügt; daraus entwickeln wir Ihre Bonitätsauswertung."`,
    `· „Lastschrift, Karte, PayPal?" → Ganz einfach per Überweisung mit seinem Verwendungszweck; Bankdaten und QR-Code stehen auf seiner Zahlungsseite.`,
    `· „Welche Bank ist das?" → Unsere Partnerbank ist die DKB: erst das Girokonto, daraus bucht er die Visa-Kreditkarte dazu — genau in dieser Reihenfolge begleiten wir ihn.`,
    // E-275 Ton (02.10.2026): „sofort nach Zahlungseingang“ statt „sobald sie gebucht ist“ — der Abgleich bucht selbst.
    // E-276 (02.10.2026): „sofort“ nur mit seinem Verwendungszweck — ohne ihn bucht der Abgleich nicht selbst.
    `· „Was passiert nach der Zahlung?" → Mit seinem Verwendungszweck ist sein Account sofort nach Zahlungseingang aktiv; er lädt Ausweis und Kontoauszüge hoch, und nach seiner Bonitätsauswertung bekommt er direkt den fertigen Link unserer Partnerbank für seinen Kartenantrag; dazu das Startgespräch mit seinem festen Betreuer, etwa 15 Minuten am Telefon.`,
    // E-275 (02.10.2026): Hier stand „Steht dort nichts, sag, dass sein Betreuer nachsieht, und übergib.“ — 55 von 88 Kartenfragen.
    `· „Wann kommt mein Link oder meine Karte?“ / „Karte nicht bekommen“ → ZAHLENDER Kunde: Du schickst ihm den Link unserer Partnerbank selbst${ein.kartenWerkzeug ? " (karte_link_schicken)" : ""} — auch wenn er schon einmal raus war (dann mit dem Datum aus SEINE LAGE: „hier noch einmal“) — mit den Schritten: zuerst das Girokonto eröffnen, dann im Banking die Visa-Kreditkarte dazubuchen; nach der Zusage der Bank in der Regel 2–5 Werktage, meist vorher Apple Pay. Fehlt nur seine Bonitätsauswertung, sagt dir das Werkzeug den Satz dazu (Ausweis und Kontoauszüge, dann der Link) — den übernimmst du. Erste Zahlung offen: Justins Satz (nach der Buchung und der Bonitätsauswertung der Link) und seine Zahlungsseite. Zahlung gemeldet: nach der Buchung kommt er direkt. Nie „sein Betreuer sieht nach“, nie „FIAON verschickt keine Karte“ als Antwort.`,
    // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f11): Hier stand „Vertrag und Rechnung kamen per E-Mail" — eine
    // Vertragsmail an Privatkunden gibt es nicht; das Modell schrieb den Satz in Probe 2 und 3 wörtlich ab (hart).
    `· „Wo ist mein Vertrag?" / „Habe ich einen Vertrag?" → Das Datum aus SEINE LAGE (wann er geschlossen wurde), dann: „Ihre Vertragsunterlagen lasse ich Ihnen gern schicken" (mensch true, uebergabe: Vertragsunterlagen schicken). Sag nie, Vertrag oder Rechnung seien per E-Mail gekommen oder kämen so, und nie, der Vertrag liege in seinem Bereich — dafür gibt es keinen Beleg.`,
    `· „Keine Zeit", „später" → Klar — sein Antrag bleibt gespeichert, der Link funktioniert jederzeit, es dauert nur etwa fünf Minuten.`,
    `· Bewertungen, Kundenzahlen, Presse → Keine Zahl und keine Plattform, die nicht in den Fakten steht; stattdessen die Firmendaten und das Widerrufsrecht.`,
    `· Alles, was weder in seiner Lage noch in den Fakten steht und kein Werkzeug erledigt → ehrlich sagen, was du weißt, dass unsere Geschäftsführung es klärt, und mensch true — nur dann.`,
    ``,
    `WÖRTER UND SÄTZE, DIE HIER NICHT RAUSGEHEN`,
    `Eine Wand prüft jede Nachricht. Trifft sie, geht deine Antwort nicht raus. Deshalb nie — auch nicht verneint und auch nicht, wenn er das Wort selbst benutzt:`,
    `· Inkasso, Mahnung, Mahnbescheid, Forderung, offene Rate, Rückstand, überfällig, Zwangsvollstreckung. Sag „Eintrag", „negativer Eintrag", „Rechnung", „Zahlung".`,
    `· Garantie, garantieren, versprechen, zusichern, Beratung, beraten, empfehlen. Sag „wir erklären", „wir übernehmen", „wir bereiten vor".`,
    `· „Sie bekommen die Karte", „bekommen Sie Ihre Kreditkarte mit …", „Ihr Rahmen steht", „Ihr Rahmen passt", „ist genehmigt", „der Betrag ist verfügbar", das Wort „Limit" (erlaubt ist nur „Ihr Wunschlimit von X €" mit „${BANK_SATZ}"). Die Karte kommt bei dir immer „nach der Zusage der Bank".`,
    // E-275 (02.10.2026): die Wahrheit bleibt (Karte und PIN schickt die Bank), aber nie als Ausrede statt des Links.
    `· Karte zusammen mit senden, schicken, zusenden oder zustellen — die Karte schickt die Bank nach ihrer Zusage. Du schickst den Link: „Hier ist Ihr Link unserer Partnerbank …“ bzw. „der Link geht an Sie raus“.`,
    `· Als Ersatz für eine Antwort: „Wir sind keine Bank“, „das können wir nicht wissen/sehen“, „darauf haben wir keinen Einfluss/Einblick“, „FIAON verschickt keine Karte“, „Herr/Frau X meldet sich/prüft das/klärt das mit Ihnen“ — und nie „die Karte ist in Produktion“ oder „kommt sicher“.`,
    `· „innerhalb von X Tagen", „gleich", „sofort" für einen Menschen — sag „in der Regel" oder nenne einen eingetragenen Termin.`,
    `· „Wir verbessern Ihre Bonität" oder „Ihren Score" — sag, was wir tun.`,
    `· Bankdaten, IBAN, Kontonummern — die stehen auf der Zahlungsseite.`,
    `· „Kredit vermitteln", Kreditvermittlung, Affiliate, du, dich, dir, dein.`,
    `· „Kündigung vorgemerkt/eingegangen" nur nach kuendigung_aufnehmen; „ist freigeschaltet" (als schon geschehen), „im System notiert", „dann stoppen wir hier" — dafür hast du kein Werkzeug gerufen.`,
    ``,
    // E-372 (15.10.2026, Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die Mitarbeiter“): Hier stand
    // die Liste „Geld zurück, Ratenpause, Beschwerde, Betrug, Anwalt, Widerruf → mensch true“ — 144 Übergaben in 14 Tagen.
    `WANN EIN MENSCH ÜBERNIMMT — UND WIE (du erledigst fast alles selbst)`,
    `Setze mensch auf true und schreib in uebergabe in einem Satz, was er will (mit Zeitwunsch, wenn er einen nennt), NUR wenn:`,
    // E-275 (02.10.2026): enger — „ich habe überwiesen“, ein Beleg, „später zahlen“ mit Tag und eine andere Sprache sind keine
    // Übergabe mehr (die Zahlungsstelle gleicht jeden Eingang ab; den Zahltag hält Mara fest; sie antwortet in einfachem Deutsch).
    `· er ausdrücklich angerufen werden oder mit einem Menschen sprechen will und du keinen Termin eintragen konntest,`,
    `· du eine Frage nicht wahr beantworten kannst und kein Werkzeug sie erledigt (dann sag ehrlich, dass unsere Geschäftsführung es klärt und er Bescheid bekommt).`,
    `Alles andere machst du SELBST — ohne mensch, ohne „ich gebe es weiter“:`,
    `· Beschwerde, Ärger, Betrugsvorwurf: ruhig, mit Verständnis, ohne ihm bei einem Vorwurf recht zu geben, ohne Zahlungsbitte — und der eine Schritt, der ihm jetzt hilft (Antwort, Link, Werkzeug). Ärger über einen ausgefallenen Anruf: entschuldigen, eine neue Zeit anbieten.`,
    `· Kündigung oder Storno: die verbindliche Rückfrage, nach seinem klaren Ja kuendigung_aufnehmen. Sagt er „längst gekündigt“, steht aber in SEINE LAGE keine Kündigung: sag ruhig, dass bei uns keine eingegangen ist, und stell die Rückfrage.`,
    `· „Kann nicht zahlen“: keine Zahlungsbitte, kein Druck — ${ein.stufe === "kunde" ? "die Ratenpause anbieten (ratenpause_setzen nach seinem Ja)" : "sein Zahltag (zahlungszusage_merken) oder das kleinere Paket"}.`,
    `· „Habe bezahlt“: danken; was der Server über den Eingang weiß, steht unter JETZT BEACHTEN — sonst um den Beleg bitten (Datum, Betrag, Verwendungszweck). Kein Zahlungslink, kein Kollege.`,
    `· Fehlende Angaben oder seine E-Mail-Adresse für den Link der Partnerbank: angaben_eintragen.`,
    `· Anwalt, Polizei, Behörde, Widerruf nach einer Zahlung, Geld zurück, Löschwunsch, FIAON Global: Das erkennt der Server selbst, schickt den sicheren Satz und legt es Justin vor. Schreibst du dazu, sag nur, dass unsere Geschäftsführung entscheidet und er eine schriftliche Nachricht bekommt — nichts zusagen (kein Geld, keine Frist, kein Ergebnis), keine Zahlungsbitte.`,
    `Zusagen nur, wenn ein Werkzeug sie einlöst: kein „Herr X meldet sich“, „ich gebe Bescheid“, „das Team prüft das“ — außer er will telefonieren (dann rueckruf_eintragen) oder sein Termin steht schon.`,
    `Nicht übergeben, was du selbst erledigt hast: Ein eingetragener oder schon stehender Termin IST die Übergabe; ein geschickter Link, eine beantwortete Frage, ein festgehaltener Zahltag, eine aufgenommene Kündigung brauchen keinen Menschen. Dann ist es erledigt — ohne „ich gebe ${bN ? bDat : "jemandem aus unserem Team"} Bescheid“ (E-275). Kündigung: erst die verbindliche Rückfrage, nach seinem Ja kuendigung_aufnehmen und der Satz aus dem Ergebnis — kein Überreden, kein Druck, kein „ich gebe es weiter". „Ich habe überwiesen": danken — die Zahlungsstelle gleicht jeden Eingang ab; sobald die Zahlung gebucht ist, schaltet das System ihn frei, dann kommt direkt der fertige Link unserer Partnerbank für seinen Kartenantrag (seine Visa-Kreditkarte bleibt das Ziel); kein Zahlungslink, kein Termin, kein Mensch. Auch wenn du übergibst, beantwortest du jetzt alles, was du wahr beantworten kannst.`,
    ``,
    `KNÖPFE AUS UNSEREN NACHRICHTEN`,
    `· „Bitte rufen Sie mich an" → „Sehr gern!" und ${ein.werkzeuge ? "sofort freie_zeiten: zwei oder drei konkrete Zeiten anbieten — außer er hat schon einen Termin (STAND), dann diesen nennen" : "nach der Zeit fragen, übergeben"}.`,
    `· „Ich habe eine Frage" → „Sehr gern — was möchten Sie wissen?" Kein Satz aus der Vorlage wiederholen.`,
    `· „Ja, bitte" → bestätigen, dass sein Antrag für ihn offen bleibt, und seinen Link schicken.`,
    `· „Vormittags", „Nachmittags", „Abends" → ${ein.werkzeuge ? "den ersten freien Platz in diesem Fenster eintragen (rueckruf_eintragen) und die Zeit nennen" : "bestätigen und mit diesem Zeitfenster übergeben"}.`,
    `· „Passt" → kurz bestätigen. „Bitte verschieben" → ${ein.werkzeuge ? "nach der neuen Zeit fragen, dann rueckruf_eintragen mit verschieben: true (nur dein eigener Termin)" : "nach der neuen Zeit fragen, übergeben"}.`,
    // E-275 (02.10.2026): Hier stand „Ist es erkennbar ein Beleg oder eine Unterlage, übergibst du.“ — dreimal „Herr Stripling
    // prüft" für drei Anhänge in einer Minute (#5558–5560). Unterlagen lädt er in seinem Bereich hoch, ein Beleg braucht niemanden.
    `· Sprachnachricht, Bild, Datei → „Die kann ich hier nicht öffnen.“ Geht es um Unterlagen (Ausweis, Kontoauszug, Auskunft): Er lädt sie in seinem Bereich hoch (fiaon.com/login, „Unterlagen“ — ein Handyfoto genügt). Ist es ein Zahlungsbeleg: danken, die Zahlungsstelle gleicht den Eingang ab, nach der Buchung schaltet das System ihn frei. Sonst: „Schreiben Sie mir kurz, worum es geht?“ Kein Mensch dafür.`,
    ``,
    `WAS DU DIR MERKST (Feld gemerkt)`,
    `Ein Satz mit etwas Neuem, das er selbst gesagt hat und das beim nächsten Mal hilft: wofür er die Karte will, welchen Rahmen er sucht, wann er erreichbar ist, sein Einwand, seine Zahlungsabsicht mit Datum. Nie Gesundheit, Religion, Herkunft oder ähnlich Persönliches. Leer, wenn nichts Neues.`,
    ``,
    // E-262 B: DAS HAUS IN FAKTEN steht jetzt oben (gleicher Anfang für jedes Gespräch); hier beginnt, was nur für ihn gilt.
    ...(ein.werkzeuge ? [`JETZT: ${ein.jetzt ?? ""} (Berliner Zeit).`] : []),
    `WER DIR SCHREIBT: ${ein.wer}`,
    `SEINE LAGE: ${ein.lage}`,
    `WAS DU ÜBER IHN WEISST: ${ein.gedaechtnis || "noch nichts"}`,
    ``,
    // E-401 (2/6, 19.10.2026): wie im Postfach (E-395) — Daniels Notiz „telefoniert am Montag 11 Uhr mit Justin“ stand
    // nur in der Akte; Mara sah sie nicht und verkaufte gegen die Absprache.
    ...(ein.teamNotizen ? [
      `LETZTE GESPRÄCHSNOTIZEN DES TEAMS (14 Tage, neueste zuerst). Was ein Kollege mit ihm besprochen oder vereinbart hat, GILT: Du widersprichst nie, verkaufst nichts dagegen und nimmst Bezug darauf („wie mit Herrn Stripling besprochen“ — Nennform, nie der Vorname). Nennt er ein Gespräch oder eine Absprache, prüfst du es zuerst hier. Telefonnummern und Interna daraus schreibst du ihm nie:`,
      ein.teamNotizen,
      ``,
    ] : []),
    ...(ein.stand?.length ? [`STAND DES GESPRÄCHS (vom Server, wahr):`, ...ein.stand.map((z) => `· ${z}`), ``] : []),
    ...(ein.hinweise?.length ? [`JETZT BEACHTEN:`, ...ein.hinweise.map((z) => `· ${z}`), ``] : []),
    `DIE LETZTEN NACHRICHTEN (oben alt, unten neu; mit Tag und Uhrzeit, Berliner Zeit):`,
    ...(ein.zeitHinweis ? [ein.zeitHinweis] : []),
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
  wer: string; lage: string; ziel: string;
  /** E-248: IMMER sein persönlicher Link (persoenlicherLink) — oder null, nie fiaon.com/antrag. */
  link: string | null;
  betreuer: string | null; verkaufen: boolean;
  /**
   * E-260 (29.09.2026): wer für Anruf, Rückruf und Rückmeldung genannt wird — ohne
   * Abwesenheit der Betreuer, sonst der Vertreter. `betreuer` bleibt der FESTE
   * Betreuer (Gegenprüfung 29.09.: vorher überschrieb der Vertreter ihn, und die
   * Stand-Zeile sagte „Sein Betreuer: Justin", während „wer" den festen nannte).
   */
  anrufer: string | null;
  /** E-260: „Fr 02.10., 09:00", solange der Vertreter anruft — sonst null. */
  anruferBis: string | null;
  /** E-248: woher der Link kommt und was die Linkprüfung als seinen erkennt. */
  linkLage: LinkLage;
  /** E-248: sein Land (fiaon_persons.country) — AT/CH nie „SCHUFA". */
  land: AuskunftLand | null;
  /** E-248: für STAND DES GESPRÄCHS — offene erste Zahlung und festgehaltener Zahltag. */
  zahlung?: { betrag: string | null; referenz: string } | null;
  zahltag?: string | null;
  /** E-240: fiaon_persons.werbung_gesperrt_am — antworten ja, verkaufen nein. */
  werbesperre: boolean;
  /**
   * E-265 (29.09.2026): `betreuer` und `anrufer` tragen jetzt die NENNFORM („Herr Stripling", ohne Anrede
   * „Nikita Boychenko") — nie den Vornamen. Dazu beide Fälle (mit/an: „Herrn Stripling").
   */
  betreuerN: Nennform | null;
  anruferN: { nom: string; dat: string } | null;
  /** E-265: sein Kartenziel (wanted_limit, gedeckelt auf den Rahmen seines Pakets — kartenZiel/limitZiel). */
  kartenziel: KartenZiel | null;
  /** E-265: die fällige, offene Monatsrate eines zahlenden Kunden (älteste) — für Abschluss, „keine Karte", Kündigung. */
  rate: { betrag: string; faellig: string | null; referenz: string } | null;
  /** E-265: Vertrag ab dem 03.09.2026 (agb_stand) — Jahresvertrag; sonst monatlich kündbar. */
  jahresvertrag: boolean;
  /**
   * E-265: Vertrag vor dem 21.09.2026 und noch keine Einladung der Partnerbank (bis E-206 erst nach der zweiten Rate).
   * Nachbesserung (29.09.2026, Recht): nur, wenn der Grund BELEGT ist — seit E-206 lädt die Automatik jeden mit
   * bezahlter erster Rate ein; fehlt die Einladung heute, liegt es an etwas anderem (Antrag, Sperre, keine Mail).
   * Der Server setzt es deshalb nie mehr von selbst.
   */
  altkunde: boolean;
  /** E-265 Nachbesserung: Die Einladung der Partnerbank ist raus (fiaon_konto_karte.gesendet_am) — dann ist eine Folgerate nie „der Grund". */
  einladungRaus: boolean;
  /** E-265 Nachbesserung: Sein Vertrag ist gekündigt (gekuendigt_am) — dann darf „Ihre Kündigung liegt vor" stehen. */
  gekuendigt: boolean;
  /** E-265 Nachbesserung: gekündigt, und diese Raten verlangt Mara noch (alle, älteste zuerst; Altvertrag nur bis Vertragsende). */
  ratenNachKuendigung: (KuendigungRate & { referenz: string })[];
  /**
   * E-265 Nachbesserung 2 (01.10.2026): false = nach den Raten oben steht im System noch etwas offen (Altvertrag mit
   * einer Rate nach dem Vertragsende, Altbestand) — dann nie „danach kommt nichts mehr".
   */
  nichtsMehr?: boolean;
  /** E-265: die Monatsrate seines Pakets („99,99 €", Katalogpreis) — für A („Ihre Zahlung über …"). */
  ersteRate: string | null;
  /** E-265 Nachbesserung: sein Paket (pack_key) — für „zu teuer" das nächstkleinere mit seinem Ziel. */
  paketKey: string | null;
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
    const { auskunftStand, auskunftArtFuer, standZumZeigen } = await import("./fiaon-auskunft");
    // Gegenlesen E-241: Antrag und Lead mit Art und Land aus dem Angebot des Takts
    // (auskunftArtLandVerkauf) — sonst nannte Mara einem Business-Antrag 149 € privat
    // statt der angebotenen Firmen-Auskunft und einem Lead aus Österreich „SCHUFA".
    const verkauf = segment === "kunde" ? null
      : await (await import("./fiaon-postmeister-werkzeuge")).auskunftArtLandVerkauf(personId);
    const art = verkauf?.art ?? await auskunftArtFuer(personId);
    // Integration 26.09.2026 (E-243): standZumZeigen — eine offene Bestellung, die auskunftBestellen nicht wiederverwenden würde (älter als 21 Tage, teurer als heute), zeigt keinen Zahlungslink, sondern den Kauf zum heutigen Preis.
    const st = standZumZeigen(await auskunftStand(personId, undefined, art));
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

// E-260: exportiert für scripts/pruef-mara-termine.ts (wer ruft an, wenn das Team abwesend ist).
/**
 * E-265 (Justin 29.09.: „Rate: Rate + Karte/Konto-Fortschritt") — das Ziel eines zahlenden Kunden mit fälliger Rate,
 * auch direkt nach der Raten-Vorlage (Nachbesserung: dort stand vorher ein altes Ziel ohne Karte). Kein „ohne Pause"
 * mehr (die Einladung hängt seit E-206 nur an der ersten Rate); Kündigung über das Werkzeug, „Kulanz" nur von dort.
 */
// E-275 (02.10.2026): ohne „dazu der Termin“ — die Bitte um die Überweisung; Kartenfragen erledigt Mara selbst (Link der Partnerbank).
// E-372: Hier stand „Ratenpause oder Stundung sagst du nie zu — das übergibst du.“ — jetzt bietet Mara die Ratenpause selbst an.
/**
 * E-401 (2/6, 19.10.2026): das Ziel, wenn er einen Termin nennt (JETZT BEACHTEN sagt, was der Server getan hat).
 * Justin (E-395): „einen guten Termin wünschen und sich zurücknehmen“.
 */
export const GENANNT_ZIEL = "Er nennt ein Gespräch (siehe JETZT BEACHTEN): Beantworte sein übriges Anliegen, wünsch ihm ein richtig gutes Gespräch und nimm dich zurück — kein Verkauf, keine Zahlungsbitte, kein Link, keine Abschlussfrage. Die Nachricht endet mit dem guten Wunsch.";
const RATE_ZIEL = "Seine Visa-Kreditkarte vorn (sie bleibt das Ziel, mit dem Satz über die Bank) und seine fällige Rate („Ihre Rate vom … über …“) mit ihrer Zahlungsseite (DEIN LINK) und der Bitte, sie heute zu überweisen. Fragt er etwas anderes, beantworte es zuerst — fragt er nach Karte, Konto oder Link, schickst du ihm den Link unserer Partnerbank selbst (karte_link_schicken). Kann er gerade nicht zahlen, bietest du ihm an, seine Raten einmal um einen Monat zu verschieben (ratenpause_setzen nach seinem Ja) — keine Zahlungsbitte. Eine Kündigung nimmst du selbst auf — erst die verbindliche Rückfrage, nach seinem klaren Ja kuendigung_aufnehmen; „Kulanz“ nur mit dem Satz aus dem Werkzeug. „Schon überwiesen“: danken, die Zahlungsstelle prüft den Eingang.";

export async function lageFuer(personId: number | null, leadId: number | null, letzteVorlage: { name: string; text: string | null } | null, kundeText = ""): Promise<Lage> {
  const erg: Lage = {
    wer: "Ein Interessent, den wir noch nicht kennen.",
    lage: "Noch kein Antrag.",
    ziel: "Er öffnet den Antrag und füllt ihn aus.",
    // E-230: nicht /start — dort steht „Zahlung erst nach Freigabe", das Gegenteil der AGB (Entscheidung offen).
    // E-248: auch nicht /antrag — Justin am 28.09.: „Mara sendet gar nicht den persönlichen Link, sondern
    // nur /antrag." 16 von 23 Antragslinks waren nackt. Der Link kommt jetzt IMMER aus persoenlicherLink.
    link: null,
    linkLage: { stufe: "lead" },
    land: null,
    betreuer: null,
    anrufer: null,
    anruferBis: null,
    verkaufen: true,
    werbesperre: false,
    vertriebssperre: false,
    auskunft: null,
    betreuerN: null,
    anruferN: null,
    kartenziel: null,
    rate: null,
    jahresvertrag: false,
    altkunde: false,
    einladungRaus: false,
    gekuendigt: false,
    ratenNachKuendigung: [],
    ersteRate: null,
    paketKey: null,
  };
  /** Der persönliche Code eines Leads — fehlt er, wird er angelegt (kurzlinkFuerLead, je Lead stabil). */
  const codeFuerLead = async (leadId: unknown, vorhanden?: unknown): Promise<string | null> => {
    if (vorhanden) return String(vorhanden);
    if (!leadId) return null;
    try {
      const { kurzlinkFuerLead } = await import("./fiaon-kurzlink");
      return await kurzlinkFuerLead(Number(leadId));
    } catch (e) {
      console.warn("[MARA-WA] Kurzlink:", String((e as Error)?.message || e).slice(0, 120));
      return null;
    }
  };
  /** Der Wiedereinstieg in genau diesen Antrag (14 Tage gültig), wenn es keinen Code gibt. */
  const weiter = async (ref: unknown): Promise<string | null> => {
    if (!ref) return null;
    try { return (await import("./fiaon-antrag-erinnerung")).weiterLink(String(ref)); } catch { return null; }
  };
  if (personId) {
    const [p] = (await sqlPool`
      SELECT TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')) AS name,
             UPPER(COALESCE(p.country, '')) AS land, p.promised_payment_date AS zahltag,
             -- E-236: nur einen Betreuer nennen, der wirklich da ist (aktiv, nicht gesperrt, kein Testkonto) —
             -- sonst sagte Mara „Daniel ruft an", und Termin oder Aufgabe landeten bei jemand anderem.
             CASE WHEN COALESCE(a.active, TRUE) AND a.zugang_gesperrt_am IS NULL AND NOT COALESCE(a.is_test_account, FALSE)
                  THEN a.name END AS betreuer,
             -- E-265: Anrede und Nachname für die Nennform („Herr Stripling") — nie aus dem Vornamen geraten.
             a.anrede AS b_anrede, a.first_name AS b_vor, a.last_name AS b_nach
        FROM fiaon_persons p LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id WHERE p.id = ${personId}`.catch(() => [])) as any[];
    const [b] = (await sqlPool`
      SELECT ref, status, payment_status, COALESCE(current_step, 0) AS schritt, pack_key, pack_name, payment_reference,
             gekuendigt_am, abo_gestoppt_am, ist_entwurf, created_at, agb_stand, submitted_at, wanted_limit, vertrag_ende_am
        FROM fiaon_applications
       WHERE person_id = ${personId} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
         -- E-230: Die Bonitätsauskunft (FIAON-SCHUFA-…) und FIAON Global sind kein Paketvertrag.
         AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
         -- E-272 (02.10.2026): Eine archivierte Bestellung ist kein Vorgang mehr (Fall Hildbrand: sein archivierter
         -- Privatantrag ergab weiter „NIE abgeschickt — mach ihn fertig“). Bezahlte bleiben wie überall
         -- (archived_at IS NULL OR paid, wie antragBasisSql) — bezahlte archivierte Zeilen ändern ihre Lage nicht.
         AND (archived_at IS NULL OR payment_status = 'paid')
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
    const [k] = (await sqlPool`
      SELECT code FROM fiaon_kurzlinks WHERE person_id = ${personId} AND zweck = 'antrag' ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
    const [karte] = (await sqlPool`
      SELECT status, gesendet_am FROM fiaon_konto_karte WHERE person_id = ${personId} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    // E-265 (29.09.2026, Justin „zum letzten Mal!!"): Der Betreuer steht als NENNFORM in der Lage —
    // „Herr Stripling", ohne gepflegte Anrede „Nikita Boychenko". Vorher der volle Name, und jeder Satz
    // nahm davon das erste Wort (`split(" ")[0]`) — „Daniel ruft Sie an".
    erg.betreuerN = p?.betreuer ? nennform({ anrede: p.b_anrede, first_name: p.b_vor, last_name: p.b_nach, name: p.betreuer }) : null;
    erg.betreuer = erg.betreuerN?.nom ?? null;
    erg.anrufer = erg.betreuer;
    erg.anruferN = erg.betreuerN ? { nom: erg.betreuerN.nom, dat: erg.betreuerN.dat } : null;
    erg.wer = `${String(p?.name || "").trim() || "Ein Kunde"}${erg.betreuer ? `, sein fester Betreuer ist ${erg.betreuer}` : ", noch ohne festen Betreuer"}.`;
    // E-260 (29.09.2026): Team abwesend — Mara nennt, wer WIRKLICH anruft (fiaon-abwesenheit.ts, B2).
    // Der feste Betreuer bleibt `betreuer`; der Vertreter steht getrennt in `anrufer`.
    const ab = await import("./fiaon-abwesenheit");
    const vt = await ab.vertretungFuerPerson(Number(personId)).catch(() => null);
    if (vt) {
      const derselbe = !!erg.betreuerN && erg.betreuerN.voll === vt.ab.vertreter.nenn.voll;
      const fest = erg.betreuer && !derselbe ? `, sein fester Betreuer ist ${erg.betreuer}` : "";
      erg.wer = `${String(p?.name || "").trim() || "Ein Kunde"}${fest}. Bis ${ab.bisText(vt.ab.bis)} ist das Team nicht im Haus — ${vt.ab.vertreter.anrufName} übernimmt Rückrufe, Termine und Rückmeldungen; nenne für Anrufe ${vt.ab.vertreter.anrufName} (mit/an: ${vt.ab.vertreter.anrufDat}).`;
      if (derselbe) { erg.betreuer = null; erg.betreuerN = null; }
      erg.anrufer = vt.ab.vertreter.anrufName;
      erg.anruferN = { nom: vt.ab.vertreter.anrufName, dat: vt.ab.vertreter.anrufDat };
      erg.anruferBis = ab.bisText(vt.ab.bis);
    }
    erg.land = ["DE", "AT", "CH"].includes(String(p?.land ?? "")) ? (String(p.land) as AuskunftLand) : null;
    erg.zahltag = p?.zahltag ? new Date(p.zahltag).toISOString().slice(0, 10) : null;
    // E-248: Jede Nummer hat einen Lead (auch whatsapp_eingang) — sein Code ist der persönliche Antragslink.
    const [lead] = (await sqlPool`
      SELECT id, link_code, anzeige, quelle FROM fiaon_leads WHERE person_id = ${personId} ORDER BY erstellt_am DESC LIMIT 1`.catch(() => [])) as any[];
    const codeDa = k?.code ?? lead?.link_code ?? null;

    // E-248 las hier „approved mit offener Bestellung ist Zahlung offen". E-264 (29.09.2026): Das stimmte
    // nicht — approved + pending_payment setzt der Antragsweg schon bei Schritt 3–5, VOR dem Vertrag.
    // Die Stufe kommt jetzt aus EINER Regel „abgeschickt" (stufeAusAntrag → antragAbgeschickt).
    const stufe: LinkStufe = b ? stufeAusAntrag({ status: b.status, payment_status: b.payment_status, current_step: Number(b.schritt), submitted_at: b.submitted_at, gekuendigt_am: b.gekuendigt_am, abo_gestoppt_am: b.abo_gestoppt_am }) : "lead";
    const paket = b?.pack_name || b?.pack_key || null;
    // ── E-265 (29.09.2026): SEIN KARTENZIEL ────────────────────────────────
    // Justin: „VIEL MEHR AUF DIE KREDITKARTEN!" — Mara kannte das Wunschlimit auf WhatsApp gar nicht
    // (lageFuer las wanted_limit nicht; in 78 Antworten kein einziges). Jetzt: wanted_limit, gedeckelt auf
    // den Rahmen seines Pakets (PACK_LIMITS, dieselbe Regel wie die Telefonkartei). Nie approved_limit —
    // das ist die Zufalls-„Genehmigung" des Antragswegs (E-264).
    if (b?.wanted_limit != null && Number(b.wanted_limit) > 0) {
      const { PACK_LIMITS } = await import("../routes/fiaon-antrag");
      erg.kartenziel = kartenZiel({ wunschEuro: Number(b.wanted_limit), rahmenEuro: PACK_LIMITS[String(b.pack_key ?? "").toLowerCase()] ?? null, paketKey: b.pack_key ?? null });
    }
    // E-265 Nachbesserung: agb_stand kommt als Date — nie als Text vergleichen (istJahresvertrag, eine Rechnung).
    erg.jahresvertrag = istJahresvertrag(b?.agb_stand);
    { const c = b?.pack_key ? paketPreisCents(b.pack_key) : 0; erg.ersteRate = c ? `${(c / 100).toFixed(2).replace(".", ",")} €` : null; }
    erg.paketKey = b?.pack_key ? String(b.pack_key).toLowerCase() : null;
    /** E-265 Nachbesserung: ALLE offenen, nicht stornierten Raten (älteste zuerst) — für die Kündigung. */
    const offeneRatenAlle = async (): Promise<{ betrag: string; cents: number; faellig: string | null; referenz: string }[]> => {
      if (!b?.ref) return [];
      const zeilen = (await sqlPool`
        SELECT zahlungsreferenz, betrag_cents, faellig_am FROM fiaon_abo_raten
         WHERE ref = ${String(b.ref)} AND status = 'offen' AND storniert_am IS NULL AND zahlungsreferenz IS NOT NULL
         ORDER BY rate_nr ASC`.catch(() => [])) as any[];
      return zeilen.map((r) => ({
        betrag: `${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} €`,
        cents: Number(r.betrag_cents) || 0,
        faellig: r.faellig_am ? (r.faellig_am instanceof Date ? r.faellig_am.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : String(r.faellig_am).slice(0, 10)) : null,
        referenz: String(r.zahlungsreferenz),
      }));
    };
    /** Die älteste offene, nicht stornierte Rate — `faellig` nur die schon fälligen (E-265). */
    const offeneRate = async (nurFaellig: boolean): Promise<Lage["rate"]> => {
      if (!b?.ref) return null;
      const [r] = (await sqlPool`
        SELECT zahlungsreferenz, betrag_cents, faellig_am FROM fiaon_abo_raten
         WHERE ref = ${String(b.ref)} AND status = 'offen' AND storniert_am IS NULL AND zahlungsreferenz IS NOT NULL
           AND (${!nurFaellig} OR faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date)
         ORDER BY rate_nr ASC LIMIT 1`.catch(() => [])) as any[];
      if (!r) return null;
      const f = r.faellig_am ? String(r.faellig_am instanceof Date ? r.faellig_am.toISOString() : r.faellig_am).slice(0, 10) : null;
      return {
        betrag: `${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} €`,
        faellig: f ? `${f.slice(8, 10)}.${f.slice(5, 7)}.` : null,
        referenz: String(r.zahlungsreferenz),
      };
    };
    const antragLinkLage = async (st: LinkStufe): Promise<LinkLage> => {
      const code = await codeFuerLead(lead?.id, codeDa);
      return code ? { stufe: st, leadCode: code } : { stufe: st, weiterLink: b?.ref ? await weiter(b.ref) : null };
    };
    if (!b) {
      // E-230: Fast jeder Meta-Lead hat eine Person. Ohne Antrag gilt dann die Lage des Leads —
      // die Begrüßung hat ihm gesagt, sein Antrag sei vorbereitet und seine Angaben stünden drin.
      if (lead && lead.quelle !== "whatsapp_eingang") {
        erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
      } else {
        erg.lage = "Hat noch keinen Antrag.";
      }
      erg.linkLage = await antragLinkLage("lead");
      // E-241: Lead (Stufe C) — die Auskunft nur als Antwort, nichts an SEINE LAGE anhängen.
      erg.auskunft = await auskunftLage(personId, "lead");
    } else if ((b.gekuendigt_am || b.abo_gestoppt_am || ["cancelled", "refunded", "superseded"].includes(String(b.payment_status)))
      && await erneutAngefragt(personId, b.gekuendigt_am ?? b.abo_gestoppt_am ?? b.created_at)) {
      // E-236 (J.O. Trommer, 24.09.): Vertrag im August gekündigt, heute ÜBER DAS FORMULAR NEU ANGEFRAGT.
      // Mara schrieb „Ich sehe hier, dass Ihr Vertrag gekündigt ist" — er antwortete „Dann bleibt es bei
      // der Kündigung". Wer neu anfragt, ist ein neuer Interessent.
      erg.lage = "Hatte früher einen Vertrag, der beendet ist, und hat jetzt über das Formular NEU angefragt — er ist wieder interessiert. Begrüße ihn wie einen neuen Interessenten; den alten Vertrag sprichst du nicht von dir aus an.";
      erg.ziel = "Er startet neu: Antrag öffnen und ausfüllen.";
      // Der Code des NEUEN Leads — kein Wiedereinstieg in den alten, beendeten Antrag.
      const code = await codeFuerLead(lead?.id, lead?.link_code ?? null);
      erg.linkLage = code ? { stufe: "lead", leadCode: code } : { stufe: "lead" };
    } else if (b.gekuendigt_am || b.abo_gestoppt_am || ["cancelled", "refunded", "superseded"].includes(String(b.payment_status))) {
      erg.lage = `Vertrag ${b.gekuendigt_am ? "gekündigt" : "beendet oder storniert"}${paket ? ` (${paket})` : ""}.`;
      // E-372: Geld zurück legt der Server Justin vor; „wieder einsteigen“ klärt die Geschäftsführung (mensch true → Karte).
      erg.ziel = "Kein Verkauf, keine Zahlung. Du beantwortest seine Frage; will er wieder einsteigen, sag ehrlich, dass unsere Geschäftsführung es klärt (mensch true).";
      erg.linkLage = { stufe: "beendet" };
      erg.verkaufen = false;
      erg.gekuendigt = !!b.gekuendigt_am;
      // E-265 (29.09.2026, Justin): Gekündigt, aber Raten bleiben (kuendigungSetzen, „letzte_rate") — fragt er „Muss
      // ich trotzdem noch zahlen?", ist die Antwort Justins Formel, nicht „ich gebe es weiter".
      // Nachbesserung (29.09.2026, Recht): ALLE offenen Raten, nicht nur die älteste (Regel „hoechste" behält alle bis
      // zur höchsten; 79 Altverträge mit zwei und mehr) — bei mehreren kein „danach kommt nichts mehr". Beim Altvertrag
      // nur, was bis zum Vertragsende fällig ist (§ 6 Abs. 8 alte Fassung). Ist der Vertrag beendet (Ende erreicht),
      // wird nichts verlangt (E-244).
      const vorbei = !!b.vertrag_ende_am && new Date(b.vertrag_ende_am).getTime() <= Date.now();
      // ── E-396 (19.10.2026): JAHRESVERTRAG ZUM LAUFZEITENDE — ER LÄUFT NOCH ──────────────────────────────────────
      // Gekündigt, aber der Vertrag läuft bis zum Laufzeitende: Raten laufen weiter, sein Bereich bleibt offen. Fragt er
      // „Muss ich noch zahlen?", ist die Antwort das Ende + die EINE Kulanz-Fassung (offene Rechnung → aus Kulanz raus).
      const jlLage = erg.jahresvertrag && b.gekuendigt_am && !vorbei
        ? await (await import("./fiaon-kuendigung")).jahresvertragLage(String(b.ref)).catch(() => null) : null;
      if (jlLage?.art === "laufzeit" && jlLage.ende) {
        const endeDe = tagDeutsch(jlLage.ende);
        const k = jlLage.kulanz;
        const kulanzText = k ? `${kulanzSatz(`${(k.summeCents / 100).toFixed(2).replace(".", ",")} €`, { mehrere: k.raten.length > 1 })} ${RECHTE_SATZ}` : null;
        erg.lage = `Vertrag gekündigt${paket ? ` (${paket})` : ""} — Jahresvertrag, läuft bis zum Laufzeitende, dem ${endeDe}; die Monatsraten laufen bis dahin weiter, sein Bereich bleibt offen.${k ? ` Offene Rechnung aus dem Kulanz-Angebot: ${k.raten.map((r) => `Rate vom ${r.faellig ? `${r.faellig.slice(8, 10)}.${r.faellig.slice(5, 7)}.` : "?"}`).join(" und ")} (Verwendungszweck ${k.raten[0]?.referenz ?? "?"}).` : " Keine Rechnung offen."}`;
        erg.ziel = `Kein Verkauf. Fragt er nach Ende oder Zahlung: „${laufzeitSatz(jlLage.ende, { fristgerecht: jlLage.fristgerecht })}${kulanzText ? ` ${kulanzText}` : ""}"${k ? " — mit seiner Zahlungsseite (DEIN LINK)." : ""} Nie „ab sofort keine Raten mehr“, nie „Ihr Vertrag ist beendet“. Sonst beantwortest du seine Frage.`;
        if (k?.raten[0]?.referenz) {
          erg.rate = { betrag: `${(k.raten[0].cents / 100).toFixed(2).replace(".", ",")} €`, faellig: k.raten[0].faellig ? `${k.raten[0].faellig.slice(8, 10)}.${k.raten[0].faellig.slice(5, 7)}.` : null, referenz: k.raten[0].referenz };
          erg.linkLage = { stufe: "beendet", ratenReferenz: k.raten[0].referenz };
        }
      }
      const laufzeitLage = jlLage?.art === "laufzeit" && !!jlLage.ende;
      // Beim Jahresvertrag zum Laufzeitende steht alles schon oben — keine zweite Raten-Formel.
      const alle = b.gekuendigt_am && String(b.payment_status) === "paid" && !vorbei && !laufzeitLage ? await offeneRatenAlle() : [];
      // E-265 (01.10.2026, Recht): das Vertragsende beim Altvertrag = Ende des Abrechnungsmonats (Fälligkeit zu
      // Fälligkeit) — dieselbe Rechnung wie kuendigungSetzen, Urkunde und Bestätigungsmail (vertragsendeLesen).
      const ende = !erg.jahresvertrag && b.gekuendigt_am
        ? (await (await import("./fiaon-kuendigung")).vertragsendeLesen(String(b.ref)).catch(() => ({ ende: null as string | null }))).ende : null;
      const { zuZahlen, nachEnde } = kuendigungRatenAufteilen(alle, { jahresvertrag: erg.jahresvertrag, vertragsEnde: ende });
      // E-265 Nachbesserung 2 (01.10.2026): „danach kommt nichts mehr" nur, wenn nach diesen Raten nichts mehr offen ist —
      // eine Rate nach dem Vertragsende (Altbestand, noch nicht storniert) verlangt Mara nie, behauptet aber auch nicht,
      // es sei nichts mehr offen (Prüffall an Justin über kuendigung_aufnehmen/Postfach).
      erg.nichtsMehr = nachEnde.length === 0;
      erg.ratenNachKuendigung = zuZahlen.map((r) => ({ vom: r.faellig ? `${r.faellig.slice(8, 10)}.${r.faellig.slice(5, 7)}.` : null, betrag: r.betrag, cents: r.cents, referenz: r.referenz }));
      const bleibt = erg.ratenNachKuendigung[0] ?? null;
      if (bleibt) {
        const n = erg.ratenNachKuendigung;
        const summe = `${(n.reduce((x, r) => x + r.cents, 0) / 100).toFixed(2).replace(".", ",")} €`;
        const liste = n.map((r) => `${r.vom ? `vom ${r.vom} ` : ""}über ${r.betrag}`).join(", ").replace(/, ([^,]*)$/, " und $1");
        // E-265 (01.10.2026, Recht): „Ihre Kündigung gilt zum Ende Ihres laufenden Abrechnungsmonats, dem 27.10.2026".
        const endeText = tagDeutsch(ende);
        const giltZum = giltZumSatz(ende);
        erg.rate = { betrag: bleibt.betrag, faellig: bleibt.vom, referenz: bleibt.referenz };
        erg.lage += n.length === 1
          ? ` Offen bleibt seine Rate${bleibt.vom ? ` vom ${bleibt.vom}` : ""} über ${bleibt.betrag} (Verwendungszweck ${bleibt.referenz}). ${erg.jahresvertrag ? "Jahresvertrag (AGB ab 03.09.2026)." : `Vertrag vor dem 03.09.2026 (kündbar zum Ende des Abrechnungsmonats), Vertragsende ${endeText ?? "Ende des laufenden Abrechnungsmonats"}.`}`
          : ` Offen bleiben ${n.length} Raten: ${liste} (zusammen ${summe}); die Zahlungsseite der ersten hat den Verwendungszweck ${bleibt.referenz}. ${erg.jahresvertrag ? "Jahresvertrag (AGB ab 03.09.2026)." : `Vertrag vor dem 03.09.2026 (kündbar zum Ende des Abrechnungsmonats), Vertragsende ${endeText ?? "Ende des laufenden Abrechnungsmonats"}.`}`;
        const nm = erg.nichtsMehr !== false;
        const satz = n.length === 1
          ? (erg.jahresvertrag
            // E-396: dieselbe Kulanz-Fassung wie überall.
            ? `${kulanzSatz(bleibt.betrag)} ${RECHTE_SATZ}`
            : `Ihre Rate${bleibt.vom ? ` vom ${bleibt.vom}` : ""} über ${bleibt.betrag} zahlen Sie bitte noch, Ihre Kündigung ${giltZum}${nm ? ", danach kommt nichts mehr" : ". Eine Rate für die Zeit nach Ihrem Vertragsende verlangen wir nicht"}.`)
          : (erg.jahresvertrag
            ? `${kulanzSatz(summe, { mehrere: true })} ${RECHTE_SATZ}`
            : `Ihre Raten ${liste} (zusammen ${summe}) zahlen Sie bitte noch; Ihre Kündigung ${giltZum}.`);
        erg.ziel = `Kein Verkauf. Fragt er, ob er noch zahlen muss: „${satz}" — mit seiner Zahlungsseite (DEIN LINK). Sonst beantwortest du seine Frage.${erg.jahresvertrag ? "" : " „Kulanz“ sagst du hier NIE (Vertrag vor dem 03.09.2026)."}`;
        erg.linkLage = { stufe: "beendet", ratenReferenz: bleibt.referenz };
      }
    } else if (stufe === "kunde") {
      // E-275 (02.10.2026): Hier stand „Ob der Link der Partnerbank schon raus ist, steht hier nicht — das sieht sein Betreuer
      // nach." — gelesen wurde fiaon_konto_karte, also ist „keine Zeile“ belegt: die Einladung ist NICHT raus (Fall 6120:
      // Werbesperre seit 09.09., die Automatik übersprang ihn). Mara schickt den Link jetzt selbst.
      const kartenStand = karte?.gesendet_am
        ? `Der Link der Partnerbank für Konto und Karte ging am ${new Date(karte.gesendet_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} an ihn raus${karte.status ? ` (Stand: ${karte.status})` : ""} — fragt er nach Karte oder Link, schickst du ihn mit karte_link_schicken noch einmal.`
        : "Die Einladung der Partnerbank (Link für Konto und Karte) ist bei ihm noch NICHT raus — fragt er nach Karte, Konto oder Link, schickst du sie selbst (karte_link_schicken). Nie „sein Betreuer sieht nach“.";
      const seit = b.created_at ? new Date(b.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }) : null;
      const neu = istJahresvertrag(b.agb_stand);
      // E-396 (19.10.2026): Das Ende der zwölf Monate und das Ende, das eine Kündigung heute hätte — aus der Akte, nie geraten.
      const jlKunde = neu ? await (await import("./fiaon-kuendigung")).jahresvertragLage(String(b.ref)).catch(() => null) : null;
      const vertrag = neu
        ? `Jahresvertrag${seit ? ` vom ${seit}` : ""}: zwölf Monate, Kündigung mit einem Monat Frist zum Ende, danach monatlich.${jlKunde?.erstEnde ? ` Die zwölf Monate enden am ${tagDeutsch(jlKunde.erstEnde)}; eine Kündigung heute gilt zum ${tagDeutsch(jlKunde.endeBeiKuendigungHeute)}.` : ""} Vorzeitig raus nur aus Kulanz nach Zahlung der offenen Rechnung (E-396).`
        // E-265 (01.10.2026, Recht): Abrechnungsmonat (Fälligkeit zu Fälligkeit, Frist 24 Stunden) — nie „Monatsende".
        : `Vertrag${seit ? ` vom ${seit}` : ""} (vor dem 03.09.2026): formlos kündbar mit 24 Stunden Frist zum Ende des laufenden Abrechnungsmonats (von Fälligkeit zu Fälligkeit, nicht Kalendermonat).`;
      erg.lage = `Kunde mit ${paket ?? "einem Paket"}, erste Zahlung gebucht, Account aktiv. ${vertrag} ${kartenStand}`;
      // E-275: Service, den Mara selbst erledigt — nicht „Es geht um Karte, Unterlagen und Startgespräch“ ohne Weg.
      erg.ziel = "Service für einen zahlenden Kunden — du erledigst es selbst: seine Karte (den Link unserer Partnerbank schickst du mit karte_link_schicken, dazu die Schritte), Unterlagen (Upload in seinem Bereich fiaon.com/login, „Unterlagen“), seine Fragen zum Weg. Sein Bereich: fiaon.com/login.";
      erg.linkLage = { stufe: "kunde" };
      erg.verkaufen = false;
      // E-265: bis E-206 (21.09.2026) kam die Partnerbank erst nach der zweiten Rate — „keine Karte" ist dann erklärbar.
      // Nachbesserung (29.09.2026, Recht): nie mehr von selbst — der Grund ist heute nie belegt (siehe Lage.altkunde).
      erg.altkunde = false;
      erg.einladungRaus = !!karte?.gesendet_am;
      // E-265 (Justin 29.09.: „Rate: Rate + Karte/Konto-Fortschritt"): die fällige Rate kennt Mara jetzt immer,
      // nicht nur nach der Raten-Vorlage — und ihre Zahlungsseite ist DEIN LINK.
      erg.rate = await offeneRate(true);
      if (erg.rate) {
        erg.lage += ` Seine Rate${erg.rate.faellig ? ` vom ${erg.rate.faellig}` : ""} über ${erg.rate.betrag} ist fällig (Verwendungszweck ${erg.rate.referenz}).`;
        erg.ziel = RATE_ZIEL;
        erg.linkLage = { stufe: "kunde", ratenReferenz: erg.rate.referenz };
      }
      // E-240: Wo steht er bei der Bonitätsauskunft? Der Preis kommt vom Server (74 € mit Paket).
      // E-241: mit derselben Art wie Werkzeug und Kauflink (Business-Paket → Firmen-Auskunft) —
      // vorher nannte der Auftrag einem Business-Kunden 74 €, das Werkzeug 199 €.
      erg.auskunft = await auskunftLage(personId, "kunde");
      if (erg.auskunft) {
        const st = erg.auskunft;
        // E-365 (14.10.2026): privat heißt das Produkt FIAON-Bonitätsauswertung; neu „auswertung" und „inklusive".
        const firmaArt = st.art === "firma";
        const wort = firmaArt ? auskunftWort(st.land) : AUSWERTUNG_NAME;
        const stufe = String(st.stufe);
        erg.lage += stufe === "inklusive" ? ` Seine ${AUSWERTUNG_NAME} ist in seinem Paket enthalten (sein Kartenlink wartet auf sie) — nie verkaufen; er lädt Ausweis und Kontoauszüge hoch.`
          : stufe === "auswertung" ? ` Seine ${AUSWERTUNG_NAME} liegt vor (fiaon.com/app/auswertung).`
          : stufe === "nichts" ? ` Seine ${wort} liegt uns noch nicht vor (weder bestellt noch hochgeladen).`
          : stufe === "offen" ? ` Seine ${wort} ist bestellt, die Zahlung ist offen.`
          : stufe === "bezahlt" ? (firmaArt ? ` Seine ${wort} ist bezahlt — wir holen sie ein.` : ` Seine ${wort} ist bezahlt — wir entwickeln sie, sobald Ausweis und Kontoauszüge da sind.`)
          : firmaArt ? ` Eine Auskunft liegt in seiner Akte.` : ` Er hat eine eigene Datenkopie in der Akte; die ${AUSWERTUNG_NAME} hat er noch nicht.`;
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
          // E-265 Nachbesserung (29.09.2026, Verkauf): Hier stand das alte Ziel ohne Karte („Kulanz oder Kündigung …
          // übergibst du") — es überschrieb nach jeder Raten-Vorlage Justins Formel und KUENDIGUNG_REGEL_TEXT.
          erg.ziel = RATE_ZIEL;
          erg.linkLage = { stufe: "kunde", ratenReferenz: String(r.zahlungsreferenz) };
        } else if (r?.status === "bezahlt") {
          erg.lage += ` Die Monatsrate aus unserer Erinnerung (${r.zahlungsreferenz}) ist inzwischen bezahlt — danke ihm dafür; es ist nichts weiter zu tun.`;
        }
      }
    } else if (stufe === "zahlung_gemeldet") {
      erg.lage = `Antrag fertig (${paket ?? "Paket offen"}), er hat seine Zahlung gemeldet — die Buchung steht noch aus.`;
      // E-265 Nachbesserung (29.09.2026, Verkauf): Karte und Termin gehören dazu (vorher: danken, sonst nichts —
      // der erste Entwurf folgte dem Ziel und ließ die Karte weg).
      // E-275 (02.10.2026): ohne „Dazu der Termin mit seinem Betreuer“ — dafür Justins Satz bis zur Karte.
      // E-275 Ton (02.10.2026): „sobald sie bei uns eingeht, ist sein Account sofort aktiv“ (vorher „… schaltet das System ihn frei“).
      // E-373 (15.10.2026, Justin): auch hier sein Wunsch, nicht der Vertrag — kein „Nach der Zusage der Bank …“.
      erg.ziel = `Kein Wort vom Bezahlen, keine Zahlungsbitte, kein Zahlungslink. Danken — dann Justins Satz: „${nachDerZuordnung({ anfang: true })}!“ (mit seinem Wunschlimit aus DEIN ABSCHLUSS: „… damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit von … € nutzen können!“). Kein Satz über die Bank.`;
      erg.linkLage = { stufe: "zahlung_gemeldet" };
      erg.verkaufen = false;
    } else if (String(b.payment_status) === "expired" && b.payment_reference && stufe === "zahlung_offen") {
      // ── Nachbesserung E-248: ABGELAUFENE BESTELLUNG ─────────────────────────
      // stufeAusAntrag gibt dafür „zahlung_offen" — die Zahlungsseite zeigt aber das
      // rote Band „abgelaufen … kontaktieren Sie den Support". Er HAT sich gemeldet:
      // Mara schaltet die Bestellung selbst neu frei (Weg des Agentenportals), außer
      // bei einem heiklen Anliegen oder einer Sperre — dann KEIN Zahlungslink.
      // E-253 (28.09.2026): der MENSCH (menschSperre) — die Wegweiser-Marke einer Dublette ist keine Sperre,
      // eine Werbesperre an einer Dublette schon. E-264: nur bei ABGESCHICKTEM Antrag (stufe) — eine nie
      // abgeschickte Bestellung wird nie reaktiviert, sie ist kein Vertrag.
      const sperre = await menschSperre(Number(personId)).catch(() => null);
      const frei = !heikelAnliegen(kundeText) && !sperre?.werbesperre && !sperre?.vertriebssperre
        && await (await import("./fiaon-postmeister-werkzeuge")).abgelaufeneBestellungFreischalten(String(b.payment_reference)).catch(() => false);
      const cents = paketPreisCents(b.pack_key);
      const betrag = cents ? `${(cents / 100).toFixed(2).replace(".", ",")} €` : null;
      if (frei) {
        erg.lage = `Antrag fertig und abgeschickt (${paket ?? "Paket offen"}). Die Zahlungsfrist seiner Bestellung war abgelaufen — du hast sie gerade neu freigeschaltet (neue Frist 7 Tage, die Zahlungsdaten gehen ihm zusätzlich per E-Mail zu). Die erste Zahlung${betrag ? ` über ${betrag}` : ""} ist offen.`;
        erg.ziel = "Er aktiviert seinen Account mit der ersten Zahlung — sag ihm freundlich, dass seine Bestellung wieder offen ist und der Link gilt. Der Link ist seine Zahlungsseite.";
        erg.linkLage = { stufe: "zahlung_offen", zahlungsReferenz: String(b.payment_reference) };
        erg.zahlung = { betrag, referenz: String(b.payment_reference) };
      } else {
        erg.lage = `Antrag fertig (${paket ?? "Paket offen"}), die Zahlungsfrist seiner Bestellung ist abgelaufen — die alte Zahlungsseite gilt nicht mehr.`;
        erg.ziel = "Kein Zahlungslink. Du beantwortest sein Anliegen; will er weitermachen, schaltet sein Betreuer die Bestellung neu frei.";
        erg.linkLage = { stufe: "zahlung_offen" };
      }
      erg.auskunft = await auskunftLage(personId, "antrag");
    } else if (stufe === "zahlung_offen" && b.payment_reference) {
      const cents = paketPreisCents(b.pack_key);
      const betrag = cents ? `${(cents / 100).toFixed(2).replace(".", ",")} €` : null;
      erg.lage = `Antrag fertig und abgeschickt (${paket ?? "Paket offen"}), die erste Zahlung${betrag ? ` über ${betrag}` : ""} ist noch offen. Sein Antrag muss NICHT fortgesetzt werden — der Schritt ist die Zahlung.`;
      // E-265 Nachbesserung (29.09.2026, Verkauf): Hier stand „kein Satz über die Partnerbank" — der Widerspruch zu
      // Justins Formel (DEIN ABSCHLUSS) war die Ursache, dass 8 von 21 Probe-Antworten nachgebessert werden mussten.
      // E-275 (02.10.2026, Justin: „Hi, zahl die Aktivierung, die Karte geht zeitnahe in Produktion — also: Jetzt zahlen! ;D —
      // so in etwa nur seriös"): Justins wahrer Satz statt „und du vereinbarst den Termin“.
      // E-275 Ton (02.10.2026): die klare Aufforderung „Zahlen Sie jetzt die Aktivierung“ mit dem Nutzen direkt dahinter.
      // E-373 (15.10.2026, Justin: „verkauft den Kunden den Wunsch am Limit … nichts vermischen“): Justins Satz mit seinem
      // Wunschlimit an der Karte — ohne „Nach der Zusage der Bank …“.
      erg.ziel = `Seine Visa-Kreditkarte vorn — mit seinem Wunschlimit${bankSatzNurAufNachfrage() ? "" : " und „über den Rahmen entscheidet unsere Partnerbank“"} —, dann begeistert und klar die erste Monatsrate: „${AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate über … — ${NACH_DEM_EINGANG}!“ (mit seinem Wunschlimit: „… damit Sie schnellstmöglich Ihre Visa-Kreditkarte mit Ihrem Wunschlimit von … € nutzen können!“). Dann die Frage, ob er heute überweist („${ZAHL_FRAGE}“). Kein Tag und keine Uhrzeit für den Link, nie „die Karte ist in Produktion“. Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code. Nennt er einen Zahltag, hältst du ihn mit zahlungszusage_merken fest.`;
      erg.linkLage = { stufe: "zahlung_offen", zahlungsReferenz: String(b.payment_reference) };
      erg.zahlung = { betrag, referenz: String(b.payment_reference) };
      // E-241: Stufe B — die Auskunft nur als Antwort (auskunftJetzt), nichts an SEINE LAGE anhängen.
      erg.auskunft = await auskunftLage(personId, "antrag");
    } else {
      // E-264: Auch mit „approved"/pending_payment — nie abgeschickt heißt: kein Vertrag, keine Rechnung.
      erg.lage = `Antrag angefangen, bei Schritt ${b.schritt ?? 0} stehen geblieben${paket ? ` (${paket})` : ""}, NIE abgeschickt — es gibt keinen Vertrag, keine Rechnung und keine offene Zahlung. Seine Angaben sind gespeichert.`;
      // E-264, Nachbesserung: Erklären ja („nach dem Antrag die erste Monatsrate"), fordern nie.
      erg.ziel = "Er macht seinen Antrag fertig — dort, wo er aufgehört hat. Keine Zahlungsaufforderung: keine Zahlungsseite, kein offener Betrag, keine Rechnung. Fragt er nach Kosten oder Ablauf, erklärst du: erst den Antrag fertig machen, danach die erste Monatsrate.";
      erg.linkLage = await antragLinkLage("antrag_offen");
      // E-241: wie ein Lead — die Auskunft nur als Antwort.
      erg.auskunft = await auskunftLage(personId, "lead");
    }
  } else if (leadId) {
    const [l] = (await sqlPool`
      SELECT TRIM(COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) AS name, link_code, anzeige FROM fiaon_leads WHERE id = ${leadId}`.catch(() => [])) as any[];
    if (l) {
      erg.wer = `${String(l.name || "").trim() || "Ein Interessent"} — kam über eine Anzeige${l.anzeige ? ` (${l.anzeige})` : ""}, noch ohne festen Betreuer.`;
      erg.lage = "Hat das Formular ausgefüllt, der Antrag ist für ihn vorbereitet und seine Angaben sind schon drin.";
      const code = await codeFuerLead(leadId, l.link_code);
      if (code) erg.linkLage = { stufe: "lead", leadCode: code };
    }
  }
  // E-248: DER eine Link — aus der Lage, nie geraten. Null heißt: kein Antragslink (der Auftrag sagt es Mara).
  erg.link = persoenlicherLink(erg.linkLage, "whatsapp").url;
  // ── E-240: DIE WERBESPERRE GILT IN JEDER LAGE ─────────────────────────────
  // Antworten auf seine eigene Nachricht bleiben erlaubt (das ist keine Werbung),
  // aber ohne Verkauf: kein Pitch, kein Link, nach dem er nicht fragt. Gemessen
  // am 24.09.: Mara schrieb einem Menschen mit Werbesperre „starten Sie einfach
  // hier neu" samt Antragslink.
  if (personId) {
    const s = await menschSperre(Number(personId)).catch(() => null);
    erg.vertriebssperre = !!s?.vertriebssperre;
    if (s?.werbesperre) {
      erg.werbesperre = true;
      erg.lage += " WERBESPERRE: Er hat gebeten, keine Werbung mehr zu bekommen.";
      // Gegenlesen 24.09.2026: Nur ein VERKAUFSZIEL (Lead, Antrag, erste Zahlung) wird ersetzt.
      // Ein Service-Ziel bleibt stehen und bekommt die Sperre dazu — sonst verlor Mara bei einer
      // Werbesperre „Kein Wort vom Bezahlen" (Zahlung gemeldet), die Zahlungsseite der Rate aus
      // der Erinnerung (Zahlungspost, E-182) und „übergibst du" beim gekündigten Vertrag.
      // E-275 (02.10.2026): Beim ZAHLENDEN Kunden (Stufe kunde, auch gekündigt mit Rate) ist die Werbesperre nur ein Upsell-
      // Verbot — Service bleibt voll (Fall 6120: Werbesperre seit 09.09. — zu Recht, sein Betreff „… not again send me e mail
      // for rattan“ —, seitdem keine Karte, keine Antwort ohne Übergabe). Seine Rate, sein Kartenlink, seine Unterlagen gehören zum Vertrag.
      const zahlend = erg.linkLage.stufe === "kunde" || erg.linkLage.stufe === "beendet";
      erg.ziel = erg.verkaufen
        ? "Du beantwortest nur, was er fragt — vollständig und freundlich. Kein Angebot, kein Pitch, keine Aufforderung zum Abschluss, kein Link, nach dem er nicht fragt (fragt er danach, bekommt er ihn)."
        : zahlend
          ? `${erg.ziel} Wegen seiner Werbesperre: kein Upsell (keine Bonitätsauskunft, kein anderes Paket, keine Werbung). Der Service bleibt voll — seine Karte und der Link der Partnerbank, seine Rate mit Zahlungsseite, Unterlagen, Antworten: alles, was zu seinem Vertrag gehört, erledigst du selbst.`
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

// ═══════════════════════════════════════════════════════════════════════════
// E-248: REINE REGELN FÜR ÜBERGABE, SICHEREN SATZ UND STAND (im Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
const HEIKEL = /kündig|widerruf|storn|erstatt|zurücküberweis|geld\s+zurück|anwalt|verbraucherzentrale|betrug|abzocke|polizei/i;
/**
 * Ein heikles Anliegen (Kündigung, Widerruf, Storno, Erstattung, Beschwerde) — des KUNDEN, zu
 * SEINEM Vertrag bei uns. Befund P30: „geht das darum, dass ich mein Konto bei meiner Bank
 * kündigen soll?" machte eine dringende Aufgabe. Maras eigene Sätze zählen nie mit.
 */
export function heikelAnliegen(kundeText: string): boolean {
  const t = String(kundeText ?? "");
  // E-264: Wer bestreitet, je etwas beantragt zu haben (oder „falsche Nummer", „Betrug", „lassen Sie
  // mich in Ruhe", „wofür zahlen, ich weiß nix", nur Wut) hat ein heikles Anliegen — keine Reaktivierung,
  // kein fester Zahlungssatz, ein Mensch. „Wer sind Sie?" / „Woher meine Nummer?" nicht.
  const ab = abstreitenArt(t);
  if (ab && ab.art !== "datenfrage" && ab.art !== "wer") return true;
  if (!HEIKEL.test(t)) return false;
  const ohneKuendig = t.replace(/\w*kündig\w*/gi, " ");
  if (HEIKEL.test(ohneKuendig)) return true; // Widerruf, Storno, Betrug … zählen immer
  const fremdesKonto = /\b(?:konto|girokonto|bankkonto|hausbank|meiner\s+bank|handyvertrag|stromvertrag)\b[^.?!]{0,60}kündig|kündig\w*[^.?!]{0,60}\b(?:konto|girokonto|bankkonto|hausbank|meiner\s+bank)\b/i.test(t);
  const unserVertrag = /\b(?:fiaon|abo|paket|mitgliedschaft|bei\s+(?:euch|ihnen)|ihren\s+vertrag|den\s+vertrag|meinen\s+vertrag|vertrag\s+(?:bei|mit)\s+(?:euch|ihnen|fiaon))\b/i.test(t);
  return !fremdesKonto || unserVertrag;
}

/** Ein kurzes Ja auf eine angebotene Zeit („Ja", „Ok", „Passt", „Gerne", „Ja bitte", „Passt mir"). */
const ZEIT_JA = /^(?:ja|jap|jo|jawohl|ok(?:ay)?|okey|passt|gerne?|genau|super|perfekt|top|einverstanden|klar|in\s+ordnung|alles\s+klar|ja\s+(?:bitte|gerne?|passt|genau|klar|ok(?:ay)?)|passt\s+(?:gut|perfekt|mir|so)|das\s+passt(?:\s+mir)?|geht\s+klar)(?:[\s,.!]+(?:danke(?:\s+sch(?:ö|oe)n)?|bitte|gerne?))*$/i;
const TAG_WORT = new RegExp(String.raw`(?<![\p{L}])(heute|morgen|übermorgen|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)(?![\p{L}])`, "iu");
/**
 * Bestätigt er die EINE Zeit, die Mara (oder das Team) ihm gerade angeboten hat? (E-265 Schluss-Nachbesserung,
 * 01.10.2026, Probe 3 f06: „Justin Schwarzott kann Sie heute um 10:20 Uhr anrufen. Passt Ihnen das?" → „Heute .10:20?"
 * — das Modell fragte noch einmal nach, statt einzutragen.) Bedingungen: Maras Nachricht endet mit einer Frage, spricht von
 * Anruf/Termin und nennt GENAU eine Uhrzeit; seine Antwort ist kurz, ohne Nein/später/andere, und nennt entweder dieselbe
 * Uhrzeit (und keinen anderen Tag) oder ist ein kurzes Ja. Ergebnis: die Uhrzeit (HH:MM) und der Tag aus Maras Text
 * („heute"/„morgen"/Wochentag relativ zu ihrer Nachricht) als YYYY-MM-DD — sonst null. Rein.
 */
export function angeboteneZeitBestaetigt(kunde: string, mara: { text: string | null | undefined; am: unknown } | null | undefined): { zeit: string; datum: string } | null {
  const m = String(mara?.text ?? "").replace(/https?:\/\/\S+/g, " ").trim();
  if (!m || !/\?\s*$/.test(m) || !/anruf|ruf\w*\s+sie|rückruf|termin|gespräch|telefon/i.test(m)) return null;
  const angeboten = uhrzeitenIn(m);
  if (angeboten.length !== 1) return null;
  const k = String(kunde ?? "").replace(EMOJI_WEG, " ").replace(/(^|\s)[.,:](?=\d)/g, "$1").replace(/\s+/g, " ").trim();
  if (!k || k.length > 40 || k.includes("\n")) return null;
  if (/\b(?:nicht|nein|nee|nö|lieber|später|spaeter|andere[nrs]?|kann\s+nicht|geht\s+nicht|erst)\b/i.test(k)) return null;
  const kZeiten = uhrzeitenIn(k);
  const kTag = k.match(TAG_WORT)?.[1]?.toLowerCase() ?? null;
  const mTag = m.match(TAG_WORT)?.[1]?.toLowerCase() ?? "heute";
  if (kZeiten.length) {
    if (kZeiten.length !== 1 || kZeiten[0] !== angeboten[0] || (kTag && kTag !== mTag)) return null;
  } else if (!ZEIT_JA.test(k.replace(/[?!.]+$/, "").trim())) return null;
  // Der Tag: relativ zu Maras Nachricht (Berlin).
  const basis = new Date(mara?.am as any);
  const b = Number.isFinite(basis.getTime()) ? basis : new Date();
  const tagIso = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  let datum = tagIso(b);
  if (mTag === "morgen") datum = tagIso(new Date(b.getTime() + 86_400_000));
  else if (mTag === "übermorgen") datum = tagIso(new Date(b.getTime() + 2 * 86_400_000));
  else if (mTag !== "heute") {
    const namen = ["sonntag", "montag", "dienstag", "mittwoch", "donnerstag", "freitag", "samstag"];
    const ziel = namen.indexOf(mTag);
    for (let i = 1; i <= 7; i++) {
      const d = new Date(b.getTime() + i * 86_400_000);
      const wt = new Date(`${tagIso(d)}T12:00:00Z`).getUTCDay();
      if (wt === ziel) { datum = tagIso(d); break; }
    }
  }
  return { zeit: angeboten[0], datum };
}
const EMOJI_WEG = new RegExp("[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u200D\\uFE0F]", "gu");

/**
 * Er VERNEINT nur eine Kündigung — jeder Satz mit „kündig" ist verneint oder zurückgenommen („Ich will nich kündigen!!",
 * „Ich kündige nicht, ich zahle morgen"), und sonst steht nichts Heikles da (kein Widerruf, Storno, Anwalt, Bestreiten …).
 * Dann ist es kein heikles Anliegen (E-265 Schluss-Nachbesserung, 01.10.2026, Probe 3 k03). Rein.
 */
export function nurVerneinteKuendigung(kundeText: string, keinSatz: (s: string) => string | null): boolean {
  const t = String(kundeText ?? "");
  if (/widerruf|stornier|storno|erstatt|zurücküberweis|geld\s+zurück|anwalt|verbraucherzentrale|betrug|abzocke|polizei/i.test(t)) return false;
  const ab = abstreitenArt(t);
  if (ab && ab.art !== "datenfrage" && ab.art !== "wer") return false;
  const saetze = t.split(/(?<=[.!?;\n])\s*/).map((x) => x.trim()).filter((x) => /k(?:ü|ue)ndig/i.test(x));
  return saetze.length > 0 && saetze.every((x) => { const g = keinSatz(x); return g === "verneint" || g === "zurückgenommen"; });
}

/**
 * E-265: „Was ist FIAON?" von einem Kunden oder B braucht keinen Herkunftshinweis (E-264 „wer") — er kennt uns.
 * Nachbesserung (29.09.2026, E-264-Regression r6.mts): nur bei „wer". Eine Datenfrage im selben Satz („Was ist FIAON
 * und woher haben Sie meine Nummer?") behält den belegten Hinweis (Art. 15 DSGVO → mensch true). Rein.
 */
export function herkunftHinweisStreichen(abstArt: string | null | undefined, fragtWasIst: boolean, stufe: LinkStufe): boolean {
  return fragtWasIst && abstArt === "wer" && (stufe === "kunde" || stufe === "zahlung_offen" || stufe === "zahlung_gemeldet");
}

/**
 * E-265 Nachbesserung (29.09.2026, r1.mts): eine Frage oder ein Aufschub im Satz — dann nie eine Kündigungserklärung
 * („erfahren/wissen/fragen, wie/wann/ob …", „später", „falls"). Unicode-Grenzen (u-Flag).
 */
export const FRAGEFORM = new RegExp(String.raw`(?<![\p{L}])(?:wie|wann|ob|erfahren|wissen|nachfragen|fragen|später|spaeter|falls)(?![\p{L}])|\?`, "iu");

/**
 * „bezahlt", „Habe gestern überwiesen", „Beleg anbei" — er meldet seine Zahlung (A), ohne Verneinung und ohne Frage.
 * E-265 Nachbesserung (29.09.2026, r5.mts): Unicode-Grenzen — `\b` vor „ü" griff nie, „Ich habe überwiesen" war kein A. Rein.
 */
export function meldetZahlung(kunde: string): boolean {
  const k = String(kunde ?? "");
  return new RegExp(String.raw`(?<![\p{L}\p{N}_])(?:bezahlt|überwiesen|ueberwiesen|gezahlt|beleg|quittung)(?![\p{L}\p{N}_])`, "iu").test(k)
    && !new RegExp(String.raw`(?<![\p{L}\p{N}_])(?:nicht|kein\p{L}*|nie|wann|wie|wo)(?![\p{L}\p{N}_])`, "iu").test(k) && !/\?/.test(k);
}

/**
 * Wie schreibt er über die Kündigung? (E-265 Nachbesserung 2, 01.10.2026: KÜNDIGUNG IN ZWEI SCHRITTEN)
 *   „bestaetigt" — ein klares Ja auf Maras verbindliche Rückfrage (KUENDIGUNG_RUECKFRAGE): jetzt kuendigung_aufnehmen.
 *   „klar"       — er will kündigen: Mara stellt NUR die Rückfrage, bucht nichts (Schritt 1).
 *   „frage"      — er fragt (ob, wie, Frist, Folgen): ehrlich beantworten, am Ende die Rückfrage.
 *   „zurueck"    — Verneinung oder Rücknahme IRGENDWO in seinen offenen Nachrichten („doch nicht", „lass mal",
 *                  „kündigen Sie nicht", „nich/net", „Kündigung widerrufen"), oder ein „Nein" auf die Rückfrage:
 *                  nie buchen, nie nachfragen — ein Mensch sieht es.
 *   „bestreitet" — Bestreiten oder falsche Nummer (E-264) im Text oder vor der Rückfrage: nie Kündigung, nie Storno.
 *   null         — kein Kündigungsthema, oder nur Bedingung, Drohung, Dritte, fremder Vertrag.
 * Vorher (Gegenprobe 29.09.) galt „klar" schon als Auftrag zum Buchen („rufe jetzt kuendigung_aufnehmen") — und
 * „Bitte kündigen Sie nicht meinen Vertrag", „Ich kündige! ⏎ War ein Scherz" oder „Falsche Nummer, bitte
 * stornieren" waren „klar". Rein (die Prüfungen des Postfachs kommen als Funktionen herein).
 */
export type KuendigungEinordnung = "bestaetigt" | "klar" | "frage" | "zurueck" | "bestreitet";
const KUENDIGUNGS_WORT = /k(?:ü|ue)ndig|stornier|storno|cancel/i;
/**
 * Er spricht vom Aussteigen — Kündigung, Storno, oder (unbezahlte Bestellung) „kein Interesse mehr", „will nicht mehr",
 * „abbrechen". Nur dann darf Mara die verbindliche Rückfrage stellen, und nur dann zählt ein Ja darauf (Anlass (a)).
 */
export const AUSSTIEG_WORT = /k(?:ü|ue)ndig|stornier|storno|cancel|kein(?:e|en)?\s+interesse|(?:möchte|moechte|will)\s+(?:das\s+|es\s+|den\s+vertrag\s+|die\s+bestellung\s+)?nicht\s+mehr|nicht\s+mehr\s+(?:weiter|interessiert)|abbrechen|zur(?:ü|ue)cktreten|aussteigen/i;
/**
 * E-372 (15.10.2026): Ausstieg — dazu bei einer UNBEZAHLTEN Bestellung der Widerruf (er ist dort ein Storno, das Mara
 * nach der verbindlichen Rückfrage selbst bucht). Beim bezahlten Vertrag ist ein Widerruf nie eine Kündigung — den
 * entscheidet Justin (Karte), Mara fragt dort nicht nach der Kündigung. Rein.
 */
export function ausstiegThema(text: string, unbezahlt: boolean | null | undefined): boolean {
  const t = String(text ?? "");
  return AUSSTIEG_WORT.test(t) || (!!unbezahlt && /wi(?:e)?derr?uf/i.test(t));
}
/**
 * Maras letzte Nachricht BOT an, die Kündigung aufzunehmen oder weiterzugeben (ohne die verbindliche Rückfrage) —
 * „Wenn Sie möchten, gebe ich Ihren Wunsch direkt an … weiter", „Soll ich Ihre Kündigung trotzdem jetzt aufnehmen?".
 * Nicht: eine Frage nach Wissen, Erklärung, Anruf oder Bedingung („Möchten Sie wissen, wann …", „Soll ich … bitten,
 * Sie wegen der Kündigung anzurufen?", „Möchten Sie nur kündigen, falls …?"). Rein.
 */
export function maraBotKuendigungAn(maraText: string | null | undefined): boolean {
  const m = String(maraText ?? "");
  if (!/k(?:ü|ue)ndig|stornier/i.test(m)) return false;
  const angebot = /(?:gebe|leite)\s+(?:ich\s+)?(?:ihren|den|ihre)\s+(?:k(?:ü|ue)ndigungs)?(?:wunsch|k(?:ü|ue)ndigung)\b|soll\s+ich\s+(?:ihre|die)\s+k(?:ü|ue)ndigung\b[^?]{0,40}(?:aufnehmen|vormerken|weitergeben)|(?:möchten|moechten|wollen)\s+sie\s+(?:\S+\s+){0,2}?k(?:ü|ue)ndigen\s*\?|(?:nehme|nehmen)\s+(?:ich\s+)?(?:ihre|die)\s+k(?:ü|ue)ndigung\s+(?:gern(?:e)?\s+)?auf/i;
  const nurInfo = new RegExp(String.raw`(?<![\p{L}])(?:wissen|erklären|erklaeren|erkläre|anrufen|anzurufen|anruf|bitten|frist|falls|nur)(?![\p{L}])`, "iu");
  return m.split(/(?<=[.!?])\s+/).some((satz) => angebot.test(satz) && !nurInfo.test(satz));
}
/** Ein kurzes Ja ohne Inhalt („Bitte tun Sie das", „Ja bitte", „Gerne") — auf Maras Satz über die Kündigung davor. */
const KURZES_JA = /^(?:ja|jawohl|genau|gerne?|ok(?:ay)?|bitte|ja\s+bitte|ja\s+gerne?|bitte\s+(?:tun|machen)\s+sie\s+das|(?:tun|machen)\s+sie\s+das(?:\s+bitte)?|ja\s+(?:tun|machen)\s+sie\s+das|ja,?\s+bitte\s+(?:tun|machen)\s+sie\s+das)(?:\s+bitte)?(?:[\s,.!]+danke)?$/i;
export function kuendigungEinordnen(kunde: string, opt: {
  wille: (t: string) => boolean;
  keinSatz: (s: string) => string | null;
  /** Rücknahme irgendwo im Text (kuendigungRuecknahme aus dem Postfach). */
  ruecknahme?: (t: string) => string | null;
  /** Bestreiten/falsche Nummer/Dritte im ganzen Text (bestreitetKuendigung). */
  bestreitet?: (t: string) => string | null;
  /** Ein klares Ja auf Maras verbindliche Rückfrage (jaAufKuendigungsAngebot). */
  jaAufRueckfrage?: boolean;
  /** Maras neueste Nachricht war die verbindliche Rückfrage (auch wenn er nicht mit Ja antwortet). */
  rueckfrageOffen?: boolean;
  /** Seine Nachrichten VOR Maras Rückfrage — dort darf kein Bestreiten stehen. */
  anlass?: string | null;
  /** Maras letzte Nachricht bot an, die Kündigung aufzunehmen/weiterzugeben (maraBotKuendigungAn) — ohne die verbindliche Rückfrage. */
  maraSprachVonKuendigung?: boolean;
}): KuendigungEinordnung | null {
  const t = String(kunde ?? "");
  const thema = KUENDIGUNGS_WORT.test(t);
  // „Bitte tun sie das" (11145, 29.09.) auf Maras Satz über die Kündigung, nachdem ER sie angesprochen hatte: Er will
  // kündigen — Schritt 1, die verbindliche Rückfrage (vorher galt das Ja auf ein Angebot ohne Frage als Buchung).
  if (!thema && !opt.jaAufRueckfrage && !opt.rueckfrageOffen) {
    const kurz = t.replace(new RegExp(String.raw`[^\p{L}\p{N}]+$`, "u"), "").replace(/\s+/g, " ").trim();
    if (opt.maraSprachVonKuendigung && opt.anlass && KUENDIGUNGS_WORT.test(String(opt.anlass)) && KURZES_JA.test(kurz)
      && !(opt.bestreitet && opt.bestreitet(String(opt.anlass)))) return "klar";
    return null;
  }
  // E-264 vor allem anderen: Wer bestreitet oder „falsche Nummer" schreibt, bekommt nie eine Kündigung oder ein Storno.
  if (opt.bestreitet && ((thema && opt.bestreitet(t)) || ((opt.jaAufRueckfrage || opt.rueckfrageOffen) && opt.anlass && opt.bestreitet(String(opt.anlass))))) return "bestreitet";
  // Verneinung oder Rücknahme irgendwo — auch nach einem klaren Satz („Ich kündige! ⏎ War ein Scherz").
  const kSaetze = t.split(/(?<=[.!?;\n])\s*/).map((x) => x.trim()).filter((x) => KUENDIGUNGS_WORT.test(x));
  // Eine Bedingung („Wenn das nicht klappt, kündige ich") ist keine Verneinung des Kündigens — die bleibt null (Drohung).
  if ((opt.ruecknahme && opt.ruecknahme(t)) || kSaetze.some((x) => { const g = opt.keinSatz(x); return g === "zurückgenommen" || (g === "verneint" && !/\b(?:wenn|falls|sonst|bevor|sofern|solange)\b/i.test(x)); })) return "zurueck";
  if (opt.rueckfrageOffen && !opt.jaAufRueckfrage && /^\s*(?:nein|nee|nö|noe|no|ne)\b/i.test(t)) return "zurueck";
  if (opt.jaAufRueckfrage) return "bestaetigt";
  if (!thema) return opt.rueckfrageOffen && t.trim() ? "frage" : null;
  // Klar nur aus einem Satz OHNE Frageform — „Kann ich bitte erfahren, wie ich kündigen kann" enthält „ich kündige(n)"
  // und galt dem Postfach-Willen (istWillenserklaerung) als Erklärung.
  const erklaerend = kSaetze.filter((x) => !FRAGEFORM.test(x));
  if (kuendigungBitte(t) || erklaerend.some((x) => opt.wille(x))) return "klar";
  if (kuendigungFristFrage(t) || kuendigungsFrage(t)) return "frage";
  if (kSaetze.length && kSaetze.every((x) => !!opt.keinSatz(x))) return null;
  return "frage";
}

/**
 * E-265 Nachbesserung (29.09.2026, r2.mts): Schaltet diese Kundennachricht die Zahlungsruhe über 24 Stunden ein?
 * Kündigung, Storno und Widerruf nur, wenn mindestens ein Satz davon nicht verneint oder bedingt ist („Ich will
 * nicht kündigen, ich zahle morgen" — vorher blockierte das danach jeden Zahlungslink); Anwalt, Verbraucherzentrale,
 * Polizei zählen wie bisher. Rein.
 */
export function ruheErklaerung(text: string, keinSatz: (s: string) => string | null): boolean {
  const t = String(text ?? "");
  if (/anwalt|verbraucherzentrale|polizei/i.test(t)) return true;
  const saetze = t.split(/(?<=[.!?;\n])\s*/).map((x) => x.trim()).filter((x) => /k(?:ü|ue)ndig|widerruf|stornier|storno/i.test(x));
  return saetze.some((x) => !keinSatz(x));
}

export type AufgabenKlasse = "heikel" | "geld" | "rueckruf" | "anliegen" | "pruefung" | "ki" | "pause" | "deckel" | "versand"
  // E-264: „Kunde bestreitet Antrag" und „Löschwunsch" — beide an die Leitung; dazu (Nachbesserung)
  // „falsche Nummer", „will keinen Kontakt", „weiß nicht, wofür er zahlen soll", „verärgert".
  | "bestreitet" | "loeschen" | "falsche_nummer" | "in_ruhe" | "rueckfrage" | "wut"
  // E-272 (02.10.2026): Ein Global-Kunde schreibt — Mara antwortet nie, die Aufgabe liegt auf Justins Board
  // (eigene Klasse, damit sie nie an eine offene Privat-Aufgabe beim Betreuer angehängt wird).
  | "global";
/** Die Grundklasse einer Übergabe aus WhatsApp — eine offene Aufgabe je Mensch und Klasse. */
export function aufgabenKlasse(kundeText: string, uebergabe = ""): AufgabenKlasse {
  if (heikelAnliegen(kundeText)) return "heikel";
  const beide = `${kundeText}\n${uebergabe}`;
  if (/überwies|bezahlt|beleg|screenshot|quittung|abbuch|abgebucht|erstatt|ratenpause|stund|später\s+(?:be)?zahl|nächsten\s+monat|zahlung\s+(?:ist|wurde|gemacht)|geld\s+zurück/i.test(beide)) return "geld";
  if (/\banruf|rückruf|zurückruf|\btelefon|ruf\w*\s+(?:mich|sie)\b|\bruf\w*\s+\w+\s+an\b|termin/i.test(beide)) return "rueckruf";
  return "anliegen";
}
/** „Dringend" nur, wenn der Kunde wirklich wartet: heikel, Geld oder ein Rückruf ohne Termin (E-248). */
export function aufgabeDringend(klasse: AufgabenKlasse, terminDa: boolean): boolean {
  return klasse === "heikel" || klasse === "geld" || (klasse === "rueckruf" && !terminDa)
    || klasse === "ki" || klasse === "deckel" || klasse === "versand" || klasse === "pause"
    || klasse === "bestreitet" || klasse === "loeschen" || klasse === "falsche_nummer" || klasse === "rueckfrage";
}

// ═══════════════════════════════════════════════════════════════════════════
// E-372 (15.10.2026): MARA ERLEDIGT SELBST — ODER JUSTIN ENTSCHEIDET MIT EINEM KLICK
//
// Justin: „Mara soll ALLES selbst machen können, nichts weitergeben an die Mitarbeiter — selbst arbeiten. Wenn sie
// eine Entscheidung braucht, dann soll ich es mit 1 Klick entscheiden können … Mara soll nicht MEHR Arbeit schaffen,
// als wir schon haben, sondern immer perfekt arbeiten.“ Dieselbe Regel wie seit E-369 für Maras Mails.
//
// Gemessen (Protokoll „uebergabe“, 01.–15.10.2026, nur lesend): 146 WhatsApp-Übergaben (65 neue Aufgaben, 81 Beiträge),
// dazu 22 „Zur Kenntnis“-Kopien aufs Board. Durch waWeg: 69 erledigt Mara selbst, 62 → 35 Karten für Justin, 15 → 9
// Aufgaben beim Betreuer (Rückruf, Technik). Meist Beschwerden, Kündigungen, „habe bezahlt“ und Kartenfragen.
//
// waWeg entscheidet für JEDE Stelle, an der Mara bisher eine Aufgabe anlegte:
//   · selbst   — Beschwerde/Wut/Betrugsvorwurf (ruhig, ohne Zahlungsbitte), Kündigung und Storno (zwei Schritte,
//                kuendigung_aufnehmen), Widerruf einer UNBEZAHLTEN Bestellung (= Storno), „kann nicht zahlen“
//                (Ratenpause anbieten, ratenpause_setzen), „habe bezahlt“ (Bankabgleich, Datum und Betrag erbitten),
//                fehlende Angaben/E-Mail für den Kartenlink (angaben_eintragen), Bestreiten ohne abgeschickten Antrag,
//                „in Ruhe lassen“, Wut-Emojis.
//   · karte    — Anwalt/Polizei/Verbraucherzentrale/Behörde, Widerruf oder Erstattung nach einer Zahlung, Löschwunsch,
//                FIAON Global, Bestreiten mit abgeschicktem Antrag, Rücknahme einer gebuchten Kündigung, Ausschluss des
//                Kartenwegs, Härtefall der Ratenpause, falsche Nummer, Mara unsicher, eine Frage, die niemand im Haus
//                außer Justin beantworten kann → fiaon-whatsapp-entscheidungen.ts (Mara › Entscheidungen).
//   · betreuer — nur der ausdrückliche Rückrufwunsch ohne eingetragenen Termin (der Betreuer ruft an), die Rückfrage
//                „wofür soll ich zahlen?“ (Maras fester Satz sagt zu, dass er sich meldet), die Zusage auf die Frage
//                einer Kollegin (sie führt das Gespräch) und rein technische Ausfälle (KI-Pause, KI-Ausfall,
//                Kostendeckel, Versand dreimal gescheitert).
// ═══════════════════════════════════════════════════════════════════════════
export type WaWeg = "selbst" | "karte" | "betreuer";
export type WaFall = "rechtlich" | "widerruf" | "erstattung" | "loeschen" | "global" | "bestreitet" | "kuendigung_zurueck"
  | "karte" | "ratenpause" | "falsche_nummer" | "werbesperre" | "unsicher" | "frage";

/**
 * Anwalt, Staatsanwaltschaft, Polizei (auch „polzai“), Verbraucherzentrale, Gericht/Klage, Anzeige („zeige Sie … an“,
 * „Anzeige erstattet“), „rechtliche Schritte“ — und Behördenpost (BEHOERDE, dieselbe Regel wie das Postfach, E-369).
 * „Mir wird nichts angezeigt“ ist keine Anzeige. Rein.
 */
const RECHTLICH = new RegExp(String.raw`(?<![\p{L}])(?:(?:rechts)?anw(?:a|ä|ae)lt\p{L}*|staatsanw(?:a|ä|ae)lt\p{L}*|poli(?:zei|zai|zey)\p{L}*|polzai|verbraucherzentrale|verbraucherschutz\p{L}*|gericht(?:lich\p{L}*|e|en)?|klage|klagen|verklag\p{L}*|anzeige\s+(?:gegen|erstatt\p{L}*|mach\p{L}*|gemacht|gestellt|stell\p{L}*|aufgegeben|aufgeben|bei\s+der)|angezeigt\s+geh(?:ö|oe)r\p{L}*|rechtlich\p{L}*\s+schritt\p{L}*|schritte\s+einleiten)(?![\p{L}])`, "iu");
// „Zeigen Sie mir an, was offen ist“ ist keine Anzeige — nur die erste Person („ich zeige Sie an“, „zeige ich Sie … an“).
const ANZEIGE_AN = new RegExp(String.raw`(?<![\p{L}])(?:zeige(?:\s+ich)?|zeigen\s+wir|ich\s+zeige|wir\s+zeigen)\s+(?:sie|euch|fiaon|ihre\s+firma|die\s+firma|ihr\s+unternehmen)\s+(?:\p{L}+\s+){0,5}?an(?![\p{L}])|(?<![\p{L}])(?:habe|hab|haben)\s+(?:sie|euch|fiaon)\s+(?:\p{L}+\s+){0,3}?angezeigt(?![\p{L}])`, "iu");
export function waRechtlich(text: string): boolean {
  const t = String(text ?? "");
  return RECHTLICH.test(t) || ANZEIGE_AN.test(t) || BEHOERDE.test(t);
}

/** Widerruf, Widerspruch gegen den Vertrag, Rücktritt vom Vertrag — ein Wort davon. */
const WIDERRUF_WORT = new RegExp(String.raw`(?<![\p{L}])(?:wi(?:e)?derr?uf\p{L}*|r(?:ü|ue)cktritt\p{L}*|zur(?:ü|ue)ck\s?(?:zu)?treten|trete\p{L}*\s+(?:\p{L}+\s+){0,5}?zur(?:ü|ue)ck)(?![\p{L}])`, "iu");
const WIDERSPRUCH_VERTRAG = new RegExp(String.raw`(?<![\p{L}])wi(?:e)?der\s?spr(?:u|ü|ue|e|i)ch(?!\p{L}*lich)\p{L}*(?:[^.!?\n]{0,60}(?:vertrag|abschluss|bestellung)|\s*recht)|(?:vertrag|abschluss|bestellung)[^.!?\n]{0,60}(?<![\p{L}])wi(?:e)?der\s?spr(?:u|ü|ue|e|i)ch(?!\p{L}*lich)`, "iu");
const WIDERRUF_VERNEINT = new RegExp(String.raw`(?<![\p{L}])(?:nicht|kein\p{L}*|nie)\s+(?:\p{L}+\s+){0,2}?(?:wi(?:e)?derr?uf|zur(?:ü|ue)ck\s?(?:zu)?treten|wi(?:e)?der\s?spr)|(?<![\p{L}])wi(?:e)?derr?ufe\p{L}*\s+(?:ich\s+)?(?:nicht|nichts)(?![\p{L}])`, "iu");
/**
 * Er ERKLÄRT einen Widerruf (oder Widerspruch gegen den Vertrag, Rücktritt) — in mindestens einem Satz, der nicht fragt
 * („Wie lange habe ich Widerrufsrecht?“ ist eine Frage) und nicht verneint („ich widerrufe nicht“). Rein.
 */
export function waWiderruf(text: string): boolean {
  const saetze = String(text ?? "").split(/(?<=[.!?;\n])\s*/).map((x) => x.trim()).filter(Boolean);
  return saetze.some((s) => (WIDERRUF_WORT.test(s) || WIDERSPRUCH_VERTRAG.test(s)) && !FRAGEFORM.test(s) && !WIDERRUF_VERNEINT.test(s));
}

/** Geld zurück: Erstattung, Rückzahlung, „zahlen Sie mein Geld zurück“, „59,99 € zurück“. Rein. */
const ERSTATTUNG = new RegExp(String.raw`(?<![\p{L}])(?:(?:r(?:ü|ue)ck)?erstatt(?:ung|en|et|e)\p{L}*|r(?:ü|ue)ckzahl\p{L}*|r(?:ü|ue)ck(?:ü|ue)berweis\p{L}*|zur(?:ü|ue)ck\s?(?:zu)?(?:zahl|(?:ü|ue)berweis|buch|bekomm|erhalt)\p{L}*)(?![\p{L}])|(?<![\p{L}])(?:geld|betrag|beitrag|zahlung|zahlungen|euro)\s+(?:\p{L}+\s+){0,3}?zur(?:ü|ue)ck|\d+(?:[.,]\d+)?\s*(?:€|euro)\s+(?:\p{L}+\s+){0,3}?zur(?:ü|ue)ck|(?<![\p{L}])(?:mein|das|unser)\s+geld\s+wieder`, "iu");
export function waErstattung(text: string): boolean {
  // „Anzeige erstatten“ ist kein Geld (das ist waRechtlich).
  return ERSTATTUNG.test(String(text ?? "").replace(new RegExp(String.raw`anzeige\s+erstatt\p{L}*`, "giu"), " "));
}

/** Beschwerde, Ärger, Betrugsvorwurf — darauf antwortet Mara ruhig selbst (ohne Zahlungsbitte). Rein. */
const BESCHWERDE = new RegExp(String.raw`(?<![\p{L}])(?:betr(?:u|ü)g\p{L}*|abzock\p{L}*|scam|fake|unseri(?:ö|oe)s\p{L}*|verarsch\p{L}*|frechheit|unversch(?:ä|ae)mt\p{L}*|witz|l(?:ü|ue)ge\p{L}*|l(?:ü|ue)gen|cheat\p{L}*|arschl(?:ö|oe)ch\p{L}*|unf(?:ä|ae)hig\p{L}*|katastroph\p{L}*|skandal\p{L}*|entt(?:ä|ae)usch\p{L}*|ärger\p{L}*|(?:ä|ae)rger\p{L}*|w(?:ü|ue)tend|sauer|nervt|beschwer\p{L}*|reklamation|keine\s+antwort|niemand\s+(?:meldet|ruft|antwortet)|immer\s+noch\s+(?:keine|nichts|kein)|schon\s+wieder|masche|bl(?:ö|oe)dsinn|t(?:ä|ae)uschung)(?![\p{L}])`, "iu");

/** Was Mara selbst kann, auch wenn das Modell einen Menschen wollte (dann gilt waWeg „selbst“). Rein. */
export type WaSelbstThema = "kuendigung" | "kann_nicht_zahlen" | "bezahlt" | "karte" | "beschwerde" | "abstreiten";
export function waSelbstThema(kunde: string): WaSelbstThema | null {
  const k = String(kunde ?? "");
  if (!k.trim()) return null;
  if (AUSSTIEG_WORT.test(k)) return "kuendigung";
  if (kannNichtZahlen(k)) return "kann_nicht_zahlen";
  if (meldetZahlung(k) || new RegExp(String.raw`(?<![\p{L}])(?:habe|hab|hatte|wurde|ist|sind|schon|bereits)\s+(?:\p{L}+\s+){0,4}?(?:bezahlt|überwiesen|ueberwiesen|gezahlt|eingezahlt|abgebucht)(?![\p{L}])|echtzeit(?:ü|ue)berweis\p{L}*`, "iu").test(k)) return "bezahlt";
  if (fragtNachKarte(k) || new RegExp(String.raw`(?<![\p{L}])(?:karte|kreditkarte|link|e-?mail\p{L}*|mail)(?![\p{L}])`, "iu").test(k)) return "karte";
  // Auch die Zusammenfassung des Modells („Kunde bestreitet den Vertrag …“) — Bestreiten beantwortet Mara selbst (E-369).
  if (abstreitenArt(k) || new RegExp(String.raw`(?<![\p{L}])(?:bestreit\p{L}*|widersprich\p{L}*)`, "iu").test(k)) return "abstreiten";
  if (BESCHWERDE.test(k) || VORWURF.test(k) || WUT_EMOJI.test(k) || heikelAnliegen(k)) return "beschwerde";
  return null;
}

export interface WaWegEin {
  /** Seine offenen Nachrichten (nur seine Worte, ohne Autoantworten). */
  kunde: string;
  /** Wo im Ablauf: eine normale Nachricht, der feste Weg „Abstreiten“, Maras Rückfallsatz, ein Werkzeug, das ablehnte … */
  anlass: "nachricht" | "abstreiten" | "rueckfall" | "ki" | "technik" | "modell" | "global" | "zusage_team" | "zusage"
    | "karte_ausschluss" | "ratenpause_haertefall" | "kuendigung_zurueck" | "kuendigung_bestreitet" | "werbesperre" | "vorlegen";
  /** Seine Lage (fiaon-whatsapp-entscheidungen.ts, waLageLesen) — ohne Person alles false. */
  bezahlt?: boolean; abgeschickt?: boolean; gekuendigt?: boolean;
  /** Bei anlass „abstreiten“: die Art (abstreitenArt) oder der Löschwunsch. */
  abstArt?: AbstreitenArt | "loeschen" | null;
  /** Er will ausdrücklich angerufen werden oder mit einem Menschen sprechen (rueckrufGewollt, Knopf). */
  rueckrufWunsch?: boolean;
  /** Er spricht von Anruf, Termin, Telefon oder einem Menschen (weiter gefasst) — nur für eine Zusage, sich zu melden. */
  anrufGewuenscht?: boolean;
  /** Ein Termin steht schon (oder Mara hat gerade einen eingetragen). */
  terminDa?: boolean;
  /** Er will einen Termin, den das Team eingetragen hat, absagen oder verschieben (Mara darf ihn nicht anfassen). */
  terminAenderung?: boolean;
  /** Bei anlass „modell“/„zusage“: der Übergabesatz des Modells bzw. was Mara zugesagt hat. */
  uebergabe?: string | null;
}
export interface WaWegErgebnis { weg: WaWeg; fall: WaFall | null; grund: string }

/** Im Übergabesatz des Modells: Er will angerufen werden — nicht „möchte keinen Anruf“. */
// „nach unserem Telefonat“ ist ein vergangenes Gespräch, kein Wunsch — deshalb nicht „Telefonat“ (Praxistest E-372).
const RUECKRUF_IM_SATZ = /\b(?:anruf\w*|rückruf\w*|zurückruf\w*|telefonisch\w*|angerufen\s+werden|ruf\w*\s+(?:ihn|sie|mich)\s+(?:\S+\s+){0,3}?(?:an|zurück))\b/i;
const RUECKRUF_NEIN = /\b(?:kein\w*|nicht|ohne)\s+(?:\w+\s+){0,2}?(?:anruf|rückruf|telefon|angerufen)/i;

/**
 * DIE Weiche (E-372): Wohin geht ein Fall, bei dem Mara bisher eine Aufgabe anlegte — selbst erledigt, Karte für
 * Justin oder (nur noch Rückruf und Technik) zum Betreuer. Rein; dieselbe Funktion misst die Produktion (Praxistest).
 */
export function waWeg(e: WaWegEin): WaWegErgebnis {
  const k = String(e.kunde ?? "");
  const ue = String(e.uebergabe ?? "");
  const r = (weg: WaWeg, fall: WaFall | null, grund: string): WaWegErgebnis => ({ weg, fall, grund });
  // 1. Technik — ein Mensch muss antworten, weil Mara gerade nicht kann.
  if (e.anlass === "ki" || e.anlass === "technik") return r("betreuer", null, "technischer Ausfall (KI, Deckel, Pause, Versand)");
  // 2. FIAON Global — Mara antwortet nie (E-272), Justin entscheidet.
  if (e.anlass === "global") return r("karte", "global", "FIAON Global — Mara antwortet nicht selbst");
  // 3. Eine Kollegin hat gefragt, er sagt zu — ihr Gespräch.
  if (e.anlass === "zusage_team") return r("betreuer", null, "Zusage auf die Frage einer Kollegin — sie führt das Gespräch");
  // 4. Der feste Weg „Abstreiten“ (E-264).
  if (e.anlass === "abstreiten") {
    if (e.abstArt === "loeschen") return r("karte", "loeschen", "Löschwunsch — löschen nur mit Justins Klick");
    if (e.abstArt === "falsche_nummer") return r("karte", "falsche_nummer", "falsche Nummer — in der Akte korrigieren");
    if (waRechtlich(k)) return r("karte", "rechtlich", "droht mit Anwalt, Polizei oder Behörde");
    if (e.abstArt === "rueckfrage") return r("betreuer", null, "„wofür zahlen?“ — Maras fester Satz sagt zu, dass sich der Betreuer meldet");
    if (e.abstArt === "bestreitet" && e.abgeschickt) return r("karte", "bestreitet", "bestreitet einen abgeschickten Antrag — Storno?");
    return r("selbst", null, "Entschuldigung und Herkunft gesendet, Werbesperre nach Regel — nichts zu entscheiden");
  }
  // 5. Recht, Widerruf und Geld zurück — immer Justin (Widerruf und Erstattung nur, wenn er etwas bezahlt hat).
  const beides = `${k}\n${ue}`;
  if (waRechtlich(e.anlass === "modell" ? beides : k)) return r("karte", "rechtlich", "droht mit Anwalt, Polizei oder Behörde");
  if (e.bezahlt && waWiderruf(e.anlass === "modell" ? beides : k)) return r("karte", "widerruf", "Widerruf nach einer Zahlung");
  if (e.bezahlt && waErstattung(e.anlass === "modell" ? beides : k)) return r("karte", "erstattung", "will Geld zurück");
  // 6. Was ein Werkzeug oder die Lage als Entscheidung meldet.
  if (e.anlass === "karte_ausschluss") return r("karte", "karte", "Kartenlink ausgeschlossen — Justin entscheidet");
  if (e.anlass === "ratenpause_haertefall") return r("karte", "ratenpause", "Ratenpause über die Grenze — Härtefall");
  if (e.anlass === "werbesperre") return r("karte", "werbesperre", "will trotz Werbesperre weitermachen");
  if (e.anlass === "vorlegen") return r("karte", "frage", "ein Werkzeug konnte es nicht erledigen");
  if (e.anlass === "kuendigung_zurueck") {
    return e.gekuendigt ? r("karte", "kuendigung_zurueck", "gebuchte Kündigung zurücknehmen?") : r("selbst", null, "verneint eine Kündigung — nichts gebucht, nichts zurückzunehmen");
  }
  if (e.anlass === "kuendigung_bestreitet") {
    return e.abgeschickt || e.bezahlt ? r("karte", "bestreitet", "bestreitet den Vertrag und will stornieren") : r("selbst", null, "bestreitet ohne abgeschickten Antrag — nichts gebucht, nichts zu entscheiden");
  }
  // 7. Der ausdrückliche Rückrufwunsch ohne Termin bleibt beim Betreuer (er ruft an) — ebenso die Absage oder
  //    Verschiebung eines Termins, den das Team eingetragen hat (Mara fasst ihn nicht an).
  if (e.rueckrufWunsch && !e.terminDa) return r("betreuer", null, "will ausdrücklich angerufen werden — kein Termin eingetragen");
  if (e.terminAenderung) return r("betreuer", null, "will den Termin des Teams absagen oder verschieben");
  // 8. Maras eigene Prüfung hielt jede Antwort an.
  if (e.anlass === "rueckfall") return r("karte", "unsicher", "Maras Prüfung hielt jede Antwort an");
  // 9. Eine Zusage, die kein Werkzeug deckt: ein Anruf geht an den Betreuer (er ruft an), alles andere löst Justin ein.
  if (e.anlass === "zusage") {
    if (e.terminDa) return r("selbst", null, "der Termin im Kalender deckt die Zusage");
    return (RUECKRUF_IM_SATZ.test(ue) && !RUECKRUF_NEIN.test(ue)) || e.anrufGewuenscht || e.rueckrufWunsch
      ? r("betreuer", null, "Mara hat einen Anruf zugesagt — kein Termin eingetragen")
      : r("karte", "frage", "Mara hat etwas zugesagt, das kein Werkzeug einlöst");
  }
  // 10. Das Modell wollte einen Menschen.
  if (e.anlass === "modell") {
    if (RUECKRUF_IM_SATZ.test(ue) && !RUECKRUF_NEIN.test(ue)) {
      return e.terminDa ? r("selbst", null, "Rückruf gewünscht — der Termin steht schon") : r("betreuer", null, "Rückruf gewünscht — kein Termin eingetragen");
    }
    // Sein Text, sonst die Zusammenfassung des Modells („Kunde bestreitet …“, wenn er nur den Knopf „Ich habe eine Frage“ drückte).
    const thema = waSelbstThema(k) ?? waSelbstThema(ue);
    if (thema) return r("selbst", null, `Mara erledigt es selbst (${thema})`);
    return r("karte", "frage", "Mara kann es nicht wahr beantworten, kein Werkzeug erledigt es");
  }
  return r("selbst", null, "Mara erledigt es selbst");
}

/**
 * E-372: Der sichere Satz an den Kunden, wenn Justin entscheidet — sagt nichts zu (kein Geld, keine Frist, kein
 * Ergebnis), nur, dass die Geschäftsführung entscheidet und er schriftlich Bescheid bekommt. Geprüft gegen die
 * Wortwand und die Tonprüfung (scripts/pruef-mara-wa-e372.ts). Den Widerrufssatz kennt der Auftrag seit E-265.
 */
export const WA_ENTSCHEIDUNG_SATZ: Partial<Record<WaFall, string>> = {
  widerruf: "Ihr Widerruf ist bei uns eingegangen. Unsere Geschäftsführung prüft ihn persönlich, und Sie bekommen dazu eine schriftliche Nachricht.",
  erstattung: "Ihre Bitte um Erstattung ist bei uns eingegangen. Darüber entscheidet unsere Geschäftsführung persönlich, und Sie bekommen dazu eine schriftliche Nachricht.",
  rechtlich: "Ihre Nachricht ist bei uns eingegangen. Unsere Geschäftsführung sieht sich Ihr Anliegen persönlich an, und Sie bekommen dazu eine schriftliche Nachricht.",
};

/** Liegt eine dieser Karten offen, ist die Antwort keine Zahlungsaufforderung (wie die Zahlungsruhe nach Widerruf/Beschwerde). Rein. */
export function karteRuhe(karten: readonly { fall: WaFall }[]): boolean {
  return karten.some((x) => x.fall === "rechtlich" || x.fall === "widerruf" || x.fall === "erstattung" || x.fall === "bestreitet"
    || x.fall === "loeschen" || x.fall === "kuendigung_zurueck" || x.fall === "ratenpause");
}

/** Die Fälle, die VOR dem Modell entschieden werden (fester Satz + Karte). Rein. */
export function waEntscheidungVorab(kunde: string, lage: { bezahlt: boolean }): "rechtlich" | "widerruf" | "erstattung" | null {
  if (waRechtlich(kunde)) return "rechtlich";
  if (lage.bezahlt && waWiderruf(kunde)) return "widerruf";
  if (lage.bezahlt && waErstattung(kunde)) return "erstattung";
  return null;
}

/** E-372: Sagt der Treffer nur zu, dass die Geschäftsführung (oder Leitung) es klärt — ohne Namen, ohne Anruf? Rein. */
export function zusageGeschaeftsfuehrung(treffer: string | null | undefined): boolean {
  const t = String(treffer ?? "");
  return /gesch(?:ä|ae)ftsf(?:ü|ue)hrung|leitung/i.test(t) && !/\bruf\w*|anruf|rückruf|telefon/i.test(t);
}

/**
 * Ein Zusage-Befund (E-372: „Zusagen nur, wenn ein Werkzeug sie einlöst“) — „ich gebe … Bescheid / leite weiter“,
 * „Herr X / der Betreuer / das Team meldet sich, kümmert sich, ruft an, prüft“, dazu die Zusagen der Wortwand.
 * `namen`: Nennformen und Vornamen von Betreuer und Anrufer (wie bisher in maraAntwortet). Rein.
 */
export function zusageTreffer(antwort: string, namen: readonly (string | null | undefined)[] = []): string | null {
  const a = String(antwort ?? "");
  const wand = wandPruefen(a).filter((x) => x.art === "zusage").map((x) => x.treffer);
  if (wand.length) return wand[0];
  const ohneLinks = a.replace(/https?:\/\/\S+/g, "").trim();
  const bescheid = /\b(?:ich|wir)\s+(?:gebe|geben|sage|sagen)\b[^.!?]{0,60}\bbescheid\b|\b(?:ich|wir)\s+(?:gebe|geben|leite|leiten)\b[^.!?]{0,60}\bweiter\b/i.exec(a);
  if (bescheid && !/\?\s*$/.test(ohneLinks)) return bescheid[0];
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const n = Array.from(new Set(namen.filter(Boolean).map((x) => esc(String(x))))).join("|");
  const meldet = new RegExp(String.raw`\b(?:betreuer\w*|team|kolleg\w*|geschäftsführung|leitung)\b[^.!?]{0,40}\b(?:kümmert|meldet|ruft|übernimmt|prüft|klärt)`
    + (n ? String.raw`|\b(?:${n})\s+(?:meldet|ruft|kümmert|prüft|klärt)` : ""), "i").exec(a);
  return meldet ? meldet[0] : null;
}

/** Der Befund der Auskunft-Preisprüfung — Gruppe 1 ist der Betrag, wie er im Text steht. */
const PREIS_BEFUND = /^Der Betrag (.+?) für die Auskunft stimmt nicht/;

/** „kann nicht zahlen", „kein Geld", „zahle nicht" — nie eine Zahlungsbitte darauf (Nachbesserung E-248). Rein. */
export function kannNichtZahlen(kundeText: string): boolean {
  // E-265 (29.09.2026, 4986 #1226 „ich zahle nichts vor"): Das ist der Einwand gegen die Vorkasse, kein
  // „kann nicht" — darauf kommt Justins Abschluss (ein Argument, dann die Formel), nicht das Schweigen zur Zahlung.
  // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f04): „Ich bezahle nicht 99 Euro für eine Karte" ist ein PREIS-Einwand
  // (→ das kleinere Paket mit seinem Ziel, bausteinZuTeuerKarte), kein „kann nicht zahlen".
  const t = String(kundeText ?? "").replace(/\b(?:zahle|bezahle|überweise|ueberweise)\s+(?:\w+\s+){0,2}?nicht(?:s)?\s+(?:vor(?:ab|her|aus)?|im\s+voraus)\b/gi, " ")
    .replace(/(?:\b|(?<=\s))(?:zahle|bezahle|überweise|ueberweise)\s+(?:\w+\s+){0,2}?nicht\s+(?:mal\s+|einfach\s+|so\s+)?(?:\d+(?:[.,]\d+)?\s*(?:€|euro\b|eur\b)|€\s*\d+)/gi, " ");
  return /\b(?:kann|könnte|koennte|werde)\s+(?:\w+\s+){0,3}?nicht\s+(?:\w+\s+){0,2}?(?:be)?zahlen\b|\bkein(?:e|en)?\s+geld\b|\b(?:zahle|bezahle|überweise|ueberweise)\s+(?:\w+\s+){0,2}?nicht(?:s)?\b|\bnicht\s+(?:be)?zahlen\s+k(?:ö|oe)nnen\b|\bpleite\b|\barbeitslos\b|\bnicht\s+leisten\b/i.test(t);
}
// Absage oder Verschiebung eines Termins: TERMIN_AENDERN steht seit der E-401-Nachbesserung in shared/fiaon-genannter-termin.ts
// (wortgleich) — dort braucht ihn auch die Erkennung des genannten Termins.
/** Ein Einwand gegen die Zahlung — dann keine Zahlungsseite als fester Satz. */
// E-264: jede Verneinung („nie", „nix", „nichts") und jede Beschwerde — „Hab nix beantragt" ist nie eine Link-Frage.
const EINWAND_ZAHLUNG = /\bnicht\b|\bkein\w*\b|\bnie(?:mals)?\b|\bnix\b|\bnichts\b|\bwarum\b|\bwieso\b|\bweshalb\b|\bvorher\b|\bvorab\b|\bim\s+voraus\b|\bzu\s+teuer\b|\babzocke\b|\bbetrug|\bspam\b|\bfake\b|\bfalsch|\bruhe\b|\bstorn|\bwiderruf|\bk(?:ü|ue)ndig|\bl(?:ö|oe)sch/i;
/**
 * Eine Frage nach Link, Antrag oder Zahlung (für den sicheren Satz). E-264: Wortgrenzen —
 * vorher traf /antrag|anmeld/ auch „beantragt" und „angemeldet" (Fall 29.09.: „Hab nix beantragt"
 * war eine Link-Frage).
 */
const LINK_FRAGE = /\blink\b|\bantrag\w*|\bbestell\w*|\bwo\s|\bwie\s+(?:kann|geht|komme|mache)|\bzahl\w*|\bbezahl|überweis|ueberweis|\banmeld\w*|\babschließ|\babschliess|\bweiter\b/i;

/** E-265: `nenn` = wie der Kunde den Anrufer liest („Herr Stripling" / „Herrn Stripling"); `vorname` nur intern. */
export interface TerminKurz { beginn: string; vorname: string; nenn?: { nom: string; dat: string } | null; kundenText?: string; herkunftText?: string; uhrzeit?: string }
/** Die Nennform eines Termins — fehlt sie (Altbestand), der gespeicherte Name, nie gekürzt. */
function terminNenn(t: { vorname?: string | null; nenn?: { nom: string; dat: string } | null } | null | undefined): { nom: string; dat: string } {
  if (t?.nenn?.nom) return t.nenn;
  const n = nennAus(t?.vorname ?? null);
  return n ? { nom: n.nom, dat: n.dat } : { nom: "jemand aus unserem Team", dat: "jemandem aus unserem Team" };
}

/**
 * Der sichere Satz aus der Lage (E-248) — wenn auch der zweite Entwurf nicht raus darf. Nur, was
 * die Lage wahr macht: sein Termin, ein gerade gebuchter Termin, der Terminlink, ein festgehaltener
 * Zahltag, sein persönlicher Link auf eine Wie-/Wo-Frage. Sonst null (dann Rückfallsatz).
 */
export function sichererSatz(ein: {
  kunde: string; aktionen: Aktion[]; termin?: TerminKurz | null; link?: string | null; stufe?: LinkStufe | null; jetzt?: Date;
  /** E-265: Justins Abschluss für diesen Menschen (ohne Uhrzeit) — der sichere Satz auf ein Kaufsignal. */
  abschluss?: string | null;
  /** E-265 Schluss-Nachbesserung: die feste Antwort auf seine Limit-Frage (bausteinLimitFrage). */
  limitFrage?: string | null;
}): string | null {
  const jetzt = ein.jetzt ?? new Date();
  const k0 = String(ein.kunde ?? "");
  // E-265 (29.09.2026): Hat Mara die Kündigung gerade aufgenommen, ist der Satz aus dem Werkzeug die Antwort —
  // auch wenn das Anliegen heikel ist (Justins Formel, nie „ich gebe es weiter").
  const kuend = ein.aktionen.find((x) => x.werkzeug === "kuendigung_aufnehmen" && x.ok && x.satz)?.satz ?? null;
  if (kuend) return kuend;
  // E-372: ebenso die gesetzte Ratenpause — auch auf „kann nicht zahlen“ (sie IST die Antwort, ohne Zahlungsbitte).
  const pause = ein.aktionen.find((x) => x.werkzeug === "ratenpause_setzen" && x.ok && x.satz)?.satz ?? null;
  if (pause) return pause;
  // Nachbesserung E-248 (Gegenprobe sicher.mts): Ein heikles Anliegen, „kann nicht zahlen",
  // eine Absage oder ein Verschiebewunsch bekommt NIE einen festen Satz — sonst hieß es auf
  // „bitte alles stornieren" „Hier ist Ihre Zahlungsseite" und auf „bitte absagen" „Genau,
  // Florentine ruft Sie heute um 20 Uhr an" (die Absage ging verloren). Dann greift der
  // Rückfallsatz mit Aufgabe an einen Menschen.
  // E-264: Abstreiten, Irrtum, Datenfrage bekommen NIE einen festen Satz aus der Lage (dafür gibt es bausteinAbstreiten).
  if (abstreitenArt(k0)) return null;
  if (heikelAnliegen(k0) || kannNichtZahlen(k0) || TERMIN_AENDERN.test(k0)) {
    // Ausnahme: Mara HAT gerade selbst gebucht/verschoben — dann ist genau das die Antwort.
    const neuGebucht = ein.aktionen.find((x) => x.werkzeug === "rueckruf_eintragen" && x.ok && x.termin)?.termin ?? null;
    if (!neuGebucht || heikelAnliegen(k0) || kannNichtZahlen(k0)) return null;
  }
  // E-275 (02.10.2026): Hat Mara den Link der Partnerbank geschickt, ist der Satz aus dem Bereich Karte die Antwort.
  const karte = ein.aktionen.find((x) => x.werkzeug === "karte_link_schicken" && x.ok && x.satz)?.satz ?? null;
  if (karte) return karte;
  // E-372: Hat Mara seine Angaben eingetragen (und ggf. den Link geschickt), ist ihr Satz die Antwort.
  const angaben = ein.aktionen.find((x) => x.werkzeug === "angaben_eintragen" && x.ok && x.satz)?.satz ?? null;
  if (angaben) return angaben;
  const gebucht = ein.aktionen.find((x) => x.werkzeug === "rueckruf_eintragen" && x.ok && x.termin)?.termin ?? null;
  if (gebucht) {
    const zeit = gebucht.kundenText ?? (gebucht.beginn ? zeitFuerKunde(new Date(gebucht.beginn), jetzt) : gebucht.text);
    const ab = ein.aktionen.find((x) => x.abweichung)?.abweichung ?? null;
    // E-265: die Nennform („Herr Stripling ruft Sie … an"), nie der Vorname.
    const wer = terminNenn(gebucht).nom;
    return ab ? abweichungsSatz({ wunsch: uhrText(ab.wunsch), grund: ab.grund }, wer, zeit) : `Gern, ${wer} ruft Sie ${zeit} an.`;
  }
  const k = String(ein.kunde ?? "");
  const bestehend = ein.aktionen.find((x) => x.bestehend)?.bestehend ?? null;
  const t = bestehend ? { beginn: bestehend.beginn, vorname: bestehend.vorname, nenn: bestehend.nenn } : ein.termin ?? null;
  // Den Terminsatz nur, wenn er nach dem Termin FRAGT (wann, ruft … an?) — nie bei „nicht/absagen/verschieben".
  if (t && /anruf|\bruf|termin|uhr|zeit|abend|morgen|heute|mittag|früh|\d/i.test(k) && !/\bnicht\b|\bkein\w*\b/i.test(k) && msVon(t.beginn) > jetzt.getTime() - 20 * 60_000) {
    return `Genau, ${terminNenn(t).nom} ruft Sie ${zeitFuerKunde(new Date(msVon(t.beginn)), jetzt)} an.`;
  }
  // E-265 (29.09.2026, Justin: „dann ist der geclosed"): Auf ein Kaufsignal ist der sichere Satz sein Abschluss.
  // E-265 Nachbesserung: ein Einwand („zuerst die Zahlung", Vorkasse) ist nie ein Kaufsignal für den festen Satz.
  if (ein.abschluss && kaufSignal(k) && !einwandSignal(k) && !EINWAND_ZAHLUNG.test(k)) return ein.abschluss;
  // E-265 Schluss-Nachbesserung (Probe 4 l02): Fällt jeder Entwurf auf eine Limit-Frage, ist die feste Antwort der sichere Satz.
  if (ein.limitFrage && fragtLimit(k)) return ein.limitFrage;
  const tl = ein.aktionen.find((x) => x.werkzeug === "terminlink_schicken" && x.ok && x.link)?.link;
  if (tl) return `Hier suchen Sie sich selbst eine Zeit aus: ${tl}`;
  // Die Zahlungsseite nur bei einer Zahlungs-/Link-Frage OHNE Einwand.
  if (ein.link && LINK_FRAGE.test(k) && !EINWAND_ZAHLUNG.test(k)) {
    if (ein.stufe === "zahlung_offen") return `Hier ist Ihre Zahlungsseite mit Betrag, Verwendungszweck und QR-Code: ${ein.link} — nach der Zahlung ist Ihr Account aktiv.`;
    if (ein.stufe === "lead" || ein.stufe === "antrag_offen") return `Sehr gern — hier geht es direkt zu Ihrem Antrag, in etwa fünf Minuten sind Sie durch: ${ein.link}`;
    if (ein.stufe === "kunde" || ein.stufe === "zahlung_gemeldet") return `In Ihrem Bereich sehen Sie alles auf einen Blick: ${ein.link}`;
  }
  return null;
}

/**
 * Wie eine Kollegin/ein Kollege im Verlauf und im STAND steht (E-265, 29.09.2026): als Nennform aus der
 * Mitarbeiterliste („Frau Lombardi"), sonst der volle Name — vorher der Vorname („TEAM Florentine"),
 * und das Modell kopiert, was es liest.
 */
function teamName(von: unknown, liste: readonly MitarbeiterEintrag[] = []): string {
  const v = String(von ?? "").replace(/\s+/g, " ").trim();
  if (!v) return "Team";
  const [vor, ...rest] = v.split(" ");
  const nach = rest.join(" ");
  const m = liste.find((x) => x.vorname.toLowerCase() === vor.toLowerCase() && (!nach || x.nachname.toLowerCase() === nach.toLowerCase()));
  return m ? nennform({ anrede: m.anrede, first_name: m.vorname, last_name: m.nachname }).nom : v;
}

const STUFE_TEXT: Record<LinkStufe, string> = {
  lead: "Noch kein Antrag abgeschickt — sein Antrag ist vorbereitet (DEIN LINK).",
  antrag_offen: "Antrag angefangen, NIE abgeschickt — keine Rechnung, keine Zahlungsaufforderung (den Ablauf erklären darfst du: erst der Antrag, dann die erste Monatsrate); er macht dort weiter, wo er aufgehört hat (DEIN LINK).",
  zahlung_offen: "Antrag FERTIG, die erste Zahlung ist offen — der Schritt ist seine Zahlungsseite (DEIN LINK), kein „Antrag fortsetzen“.",
  zahlung_gemeldet: "Er hat seine erste Zahlung gemeldet, die Buchung steht aus — kein Wort vom Bezahlen.",
  kunde: "Zahlender Kunde, Account aktiv.",
  beendet: "Vertrag beendet oder storniert.",
};

/** STAND DES GESPRÄCHS — was wahr ist, in Worten (E-248). Rein. */
export function standZeilen(ein: {
  /** E-265: `betreuer`/`anrufer` sind Nennformen („Herr Stripling") — nie der Vorname. */
  termin?: TerminKurz | null; verpasst?: TerminKurz | null; stufe: LinkStufe; betreuer?: string | null;
  /** E-265: die Mitarbeiterliste — damit „Zuletzt aus dem Team" die Nennform zeigt. */
  mitarbeiter?: readonly MitarbeiterEintrag[];
  /** E-260: wer bis `anruferBis` an Stelle des Betreuers anruft (Team abwesend). */
  anrufer?: string | null; anruferBis?: string | null;
  zahlung?: { betrag: string | null; referenz: string } | null; zahltag?: string | null;
  letzteTeam?: { von: string; am: unknown; text: string } | null; jetzt?: Date;
}): string[] {
  const jetzt = ein.jetzt ?? new Date();
  const z: string[] = [];
  if (ein.termin) {
    const d = new Date(msVon(ein.termin.beginn));
    z.push(`Sein Termin: ${zeitFuerKunde(d, jetzt)} (${datumFuerKunde(d)}) — ${terminNenn(ein.termin).nom} ruft ihn an${ein.termin.herkunftText ? `; ${ein.termin.herkunftText}` : ""}. Das ist wahr: Fragt er nach Anruf oder Termin, nennst du genau diese Zeit und bietest keine neue an.`);
  } else if (ein.verpasst) {
    const d = new Date(msVon(ein.verpasst.beginn));
    z.push(`Sein letzter Termin (${zeitFuerKunde(d, jetzt)} mit ${terminNenn(ein.verpasst).dat}) hat nicht stattgefunden. Sag in einem Halbsatz, dass es dir leidtut, und biete ihm von dir aus zwei neue Zeiten an (freie_zeiten) — ohne Schuld zuzuweisen.`);
  } else {
    z.push("Kein Termin im Kalender.");
  }
  z.push(STUFE_TEXT[ein.stufe] ?? "");
  if (ein.zahlung) z.push(`Offene erste Zahlung: ${ein.zahlung.betrag ?? "Betrag auf der Zahlungsseite"} (Verwendungszweck ${ein.zahlung.referenz}).`);
  if (ein.zahltag && ein.zahltag >= jetzt.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })) {
    z.push(`Er hat zugesagt, am ${datumFuerKunde(new Date(`${ein.zahltag}T12:00:00Z`))} zu zahlen — das ist festgehalten.`);
  }
  // E-260 (29.09.2026): Team abwesend — der feste Betreuer UND wer bis wann anruft, in einer Zeile.
  const vertritt = ein.anrufer && ein.anruferBis && ein.anrufer !== ein.betreuer ? ein.anrufer : null;
  z.push(vertritt
    ? `${ein.betreuer ? `Sein Betreuer: ${ein.betreuer}.` : "Noch kein fester Betreuer."} Bis ${ein.anruferBis} ruft ${vertritt} an — für Anruf, Rückruf und Rückmeldung nennst du ${vertritt}.`
    : ein.betreuer ? `Sein Betreuer: ${ein.betreuer}.` : "Noch kein fester Betreuer — sag „jemand aus unserem Team“, nie einen erfundenen Namen.");
  if (ein.letzteTeam && jetzt.getTime() - msVon(ein.letzteTeam.am) <= 48 * 3_600_000) {
    z.push(`Zuletzt aus dem Team: ${teamName(ein.letzteTeam.von, ein.mitarbeiter)} (${kurzZeit(new Date(msVon(ein.letzteTeam.am)))}): „${String(ein.letzteTeam.text ?? "").replace(/\s+/g, " ").slice(0, 220)}“ — daran knüpfst du an.`);
  }
  return z.filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// E-264 (29.09.2026): „HAB NIX BEANTRAGT" — DIE ANTWORT OHNE MODELL
// Sätze und Erkennung: shared/fiaon-mara-ton.ts (f); welche Art welche Folge
// hat: abstreitenFolgen (fiaon-mara-abstreiten.ts). Hier:
//   · nur ohne laufenden Vertrag (Stufe C und B) — bei Kunden, gemeldeter Zahlung
//     oder beendetem Vertrag antwortet das Modell, das Anliegen ist heikel
//     (heikelAnliegen) und geht an einen Menschen; „Löschen" und „falsche
//     Nummer" gelten immer,
//   · Werbesperre nur, wo abstreitenFolgen sie vorsieht (C bestreitet, „in Ruhe
//     lassen", Löschwunsch) — NACHBESSERUNG E-264: kein Mahnstopp mehr (er hing
//     nach dem Abschicken und Zahlen weiter), keine Sperre bei „falsche Nummer"
//     (das ist der eigentliche Kunde) und keine bei Stufe B (die Leitung entscheidet),
//   · KI-Hinweis davor, wenn Mara sich noch nicht vorgestellt hat,
//   · eine Aufgabe: an die Leitung, die Rückfrage („wofür zahlen?") an den Betreuer.
// null = nicht dieser Weg (das Modell antwortet).
// ═══════════════════════════════════════════════════════════════════════════
async function abstreitenBeantworten(ein: {
  nummer: string; personId: number | null; leadId: number | null; aufId: number; seinText: string;
  abst: AbstreitenBefund | null; loesch: boolean;
}): Promise<Ergebnis | null> {
  const { abstreitenLage, abstreitenFolgen, werbesperreSetzen } = await import("./fiaon-mara-abstreiten");
  const lage = await abstreitenLage(ein.personId, ein.leadId);
  const art = ein.loesch ? "loeschen" : ein.abst!.art;
  if (!ein.loesch && art !== "falsche_nummer" && !["lead", "antrag_offen", "zahlung_offen"].includes(lage.stufe)) {
    // E-391 (16.10.2026, Fall Rieser): „Lassen Sie mich in Ruhe“ von einem KUNDEN (bezahlt, gekündigt, beendet) ist ein
    // Widerspruch gegen Werbung (§ 7 UWG, Art. 21 DSGVO) — auch wenn das Modell antwortet. Vorher versprach Mara
    // „keine Werbung mehr“, gesetzt wurde nichts: danach Verkaufsmails, eine Werbevorlage, ein Partnerbank-Link.
    // Die Werbesperre hält nur Werbung auf; Vertragspost (Rate, Kündigungsbestätigung) bleibt.
    if (art === "in_ruhe" && ein.personId) {
      const gesetzt = await werbesperreSetzen(ein.personId).catch(() => false);
      if (gesetzt) {
        await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          SELECT a.ref, ${ein.personId}, NULL, 'Mara', 'system', ${`Werbesperre gesetzt: Der Kunde schrieb per WhatsApp, er wolle in Ruhe gelassen werden („${ein.seinText.replace(/\s+/g, " ").slice(0, 120)}“). Werbung bleibt aus; Vertragspost (Raten, Kündigung) geht weiter.`}
            FROM fiaon_applications a WHERE a.person_id = ${ein.personId} ORDER BY a.created_at DESC LIMIT 1`.catch(() => {});
      }
    }
    return null;
  }
  const folgen = abstreitenFolgen(art, lage.abgeschickt);
  const taten: string[] = [];
  if (folgen.werbesperre && ein.personId) {
    if (await werbesperreSetzen(ein.personId).catch(() => false)) taten.push("Werbesperre gesetzt");
  }
  let satz = ein.loesch ? loeschAntwort("whatsapp")
    : bausteinAbstreiten({ kanal: "whatsapp", art: ein.abst!.art as AbstreitenFestArt, herkunft: lage.herkunft, abgeschickt: lage.abgeschickt, betreuer: lage.betreuer, kenntUns: kenntUns(ein.seinText) });
  // KI-Hinweis (KI-Verordnung Art. 50) wie im Hauptweg — nur, wenn Mara sich hier noch nicht vorgestellt hat.
  const [vorgestellt] = (await sqlPool`
    SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${ein.nummer} AND richtung = 'raus' AND status <> 'fehler'
       AND text ILIKE '%digitale Assistentin%' LIMIT 1`.catch(() => [])) as any[];
  if (!vorgestellt) satz = `Hier ist ${(await agentNamen()).voll.split(" ")[0]}, die digitale Assistentin von FIAON. ${satz}`;
  // Auch der feste Satz muss durch die Wand — trifft sie (nie erwartet), schreibt ein Mensch.
  const wand = sendePruefung(satz);
  const herkunft = lage.herkunft?.am
    ? `${lage.herkunft.art === "antrag" ? "erster Antrag im Webformular" : lage.herkunft.art === "anfrage_meta" ? "Anfrage über das Meta-Formular" : "erste WhatsApp"} am ${new Date(lage.herkunft.am as any).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`
    : "Herkunft der Nummer nicht belegt";
  const zitat = ein.seinText.replace(/\s+/g, " ").slice(0, 160);
  const stufeText = lage.stufe === "zahlung_offen" ? "Antrag abgeschickt (B)" : lage.stufe === "antrag_offen" ? "Antrag nie abgeschickt (C)" : lage.stufe === "lead" ? "Lead ohne Antrag (C)" : lage.stufe;
  const klasse: AufgabenKlasse = art === "loeschen" ? "loeschen" : art === "falsche_nummer" ? "falsche_nummer" : art === "in_ruhe" ? "in_ruhe"
    : art === "rueckfrage" ? "rueckfrage" : art === "wut" ? "wut" : "bestreitet";
  const anLeitung = folgen.an === "leitung";
  // E-372 (15.10.2026): Was hier folgt, entscheidet waWeg — Löschwunsch, falsche Nummer, Recht und Bestreiten eines
  // ABGESCHICKTEN Antrags werden eine Karte für Justin; „in Ruhe lassen“, Wut und Bestreiten ohne abgeschickten Antrag
  // erledigt Mara selbst (Satz und Werbesperre stehen); nur die Rückfrage „wofür zahlen?“ bleibt beim Betreuer.
  const lageE = ein.personId ? await (await import("./fiaon-whatsapp-entscheidungen")).waLageLesen(ein.personId).catch(() => null) : null;
  // Ein Löschwunsch mit Drohung bleibt EINE Karte (Löschen) — die Drohung steht als Warnung darauf.
  const warnung = art === "loeschen" && waRechtlich(ein.seinText) ? "droht dazu mit Anwalt, Polizei oder Behörde" : null;
  if (wand.length) {
    // Der feste Satz fiel durch die Wand (nie erwartet) — Mara konnte nicht antworten: Karte („unsicher“), Justin antwortet.
    await uebergeben({ nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId, aufId: ein.aufId,
      weg: waWeg({ kunde: ein.seinText, anlass: "rueckfall", bezahlt: lageE?.bezahlt, abgeschickt: lage.abgeschickt }),
      aufgabe: { grund: `Kunde schrieb „${zitat}" — Maras fester Satz fiel durch die Wand (${wand.join(" · ").slice(0, 160)}). Bitte selbst antworten: Entschuldigung, woher die Nummer stammt (${herkunft}), kein Verkauf.`, dringend: true, klasse, opt: { leitung: anLeitung } },
      karte: { kunde: ein.seinText, mara: null, grund: `Fester Satz fiel durch die Wand: ${wand.join(" · ")}` }, lage: lageE });
    return { gesendet: false, grund: "Abstreiten — fester Satz fiel durch die Wand, Karte für Justin." };
  }
  const handlung = [
    ein.loesch ? "Löschwunsch bestätigt (die Leitung löscht)"
      : art === "falsche_nummer" ? "Falsche Nummer: Entschuldigung, keine Daten des Kunden genannt, kein Link"
      : art === "rueckfrage" ? `Rückfrage „wofür zahlen": keine Zahlungsseite, ${lage.betreuer ?? "das Team"} meldet sich`
      : `Abstreiten (${art}): Entschuldigung, Herkunft genannt (${herkunft}), kein Link, kein Verkauf`,
    ...taten,
  ].join("; ");
  await vorbereiten(ein.nummer, satz, ein.aufId, ein.seinText, { kunde: ein.seinText, handlung });
  const gesperrt = taten.includes("Werbesperre gesetzt") ? "Werbesperre gesetzt" : "keine Werbesperre gesetzt";
  const text = ein.loesch
    ? `Löschwunsch per WhatsApp: „${zitat}". Mara hat geantwortet, dass die Leitung sich darum kümmert und es bestätigt; ${gesperrt}. Bitte Daten löschen (Art. 17 DSGVO — bei laufendem Vertrag die Aufbewahrung prüfen) und ihm die Löschung bestätigen. ${stufeText}, ${herkunft}.`
    : art === "falsche_nummer"
      ? `Auf WhatsApp (+${ein.nummer}) antwortete jemand: „${zitat}" — die Nummer gehört wohl nicht zu diesem Kunden. Er ist NICHT gesperrt (Mails und Anrufe unter der richtigen Nummer laufen weiter). Bitte die Nummer in der Akte korrigieren oder entfernen und ihn per Mail um seine Nummer bitten — sonst gehen weiter WhatsApp-Vorlagen an diesen Fremden.`
      : art === "rueckfrage"
        ? `Er weiß nicht, wofür er zahlen soll: „${zitat}". Mara hat KEINE Zahlungsseite geschickt und gesagt, dass du dich persönlich meldest. Bitte anrufen und erklären, wie es zu der Bestellung kam — ${stufeText}, ${herkunft}.`
        : art === "wut"
          ? `Er schickte nur wütende Emojis: „${zitat}". Mara hat sich entschuldigt und „Stopp“ angeboten (keine Sperre). ${stufeText}, ${herkunft}. Bitte ansehen.`
          : `Kunde ${art === "in_ruhe" ? "will keinen Kontakt" : "bestreitet Antrag"}: „${zitat}" (${art}). ${stufeText}, ${herkunft}. Mara hat sich entschuldigt und die Herkunft genannt; ${gesperrt}.${lage.abgeschickt && art === "bestreitet" ? " Der Antrag ist ABGESCHICKT — bitte klären, wer ihn gestellt hat, und entscheiden (Storno, Werbesperre); Mara hat zugesagt, dass sich die Leitung meldet." : " Bitte prüfen, wer den Antrag gestellt bzw. die Nummer eingetragen hat — auf Wunsch Daten löschen."}`;
  const weg = waWeg({ kunde: ein.seinText, anlass: "abstreiten", abstArt: art as AbstreitenArt | "loeschen", abgeschickt: lage.abgeschickt, bezahlt: lageE?.bezahlt });
  await uebergeben({ nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId, aufId: ein.aufId, weg,
    aufgabe: { grund: text, dringend: folgen.dringend, klasse, opt: { leitung: anLeitung } },
    karte: { kunde: ein.seinText, mara: satz, grund: `${stufeText}, ${herkunft}${taten.length ? `; ${taten.join(", ")}` : ""}`, warnung }, lage: lageE });
  await protokolliere({
    art: ein.loesch ? "loeschwunsch" : "abstreiten", ok: true, nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId,
    text: `${ein.loesch ? "Löschwunsch" : `Abstreiten (${art})`} auf „${zitat.slice(0, 80)}" — fester Satz ohne Modell: ${satz.slice(0, 160)}`,
    daten: { art, stufe: lage.stufe, abgeschickt: lage.abgeschickt, herkunft: lage.herkunft, taten, auf_id: ein.aufId, weg: weg.weg, fall: weg.fall },
  });
  const wohin = weg.weg === "karte" ? "Karte für Justin" : weg.weg === "betreuer" ? `Aufgabe an ${anLeitung ? "die Leitung" : "den Betreuer"}` : "Mara erledigt es selbst";
  return { gesendet: false, grund: ein.loesch ? `Löschwunsch — Bestätigung liegt bereit, ${wohin}.` : `Abstreiten (${art}) — Antwort liegt bereit${taten.length ? `, ${taten.join(", ")}` : ""}, ${wohin}.` };
}

/** Maras bewusstes Schweigen merken: kein neuer Anstoß bis zur nächsten echten Nachricht. */
async function stillSetzen(nummer: string, bisId: number): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_whatsapp_gespraech (nummer, still_bis_id, updated_at) VALUES (${nummer}, ${bisId}, NOW())
    ON CONFLICT (nummer) DO UPDATE SET still_bis_id = GREATEST(COALESCE(fiaon_whatsapp_gespraech.still_bis_id, 0), ${bisId}), updated_at = NOW()`;
}

/**
 * E-272 (02.10.2026): Ist der Mensch hinter dieser WhatsApp-Person ein Global-Kunde? Die eine Regel
 * (fiaon-global-kunde.ts: Individualangebot oder Global-Bestellung, ohne bezahltes Stufenpaket) — gefragt
 * am KOPF (KOPF_SQL, E-253): fiaon_whatsapp.person_id wird beim Zusammenführen nicht umgehängt, die
 * Bestellzeilen wandern aber zum Kopf. Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den
 * Workflows … Er soll Global bleiben, also keine unnötigen Mails.“ Laufzeitprüfung ohne eigenen Zustand —
 * wird er „gemischt“ (bezahltes Stufenpaket), antwortet Mara ihm wieder wie jedem Privatkunden.
 */
export async function globalKundeWa(personId: number | null | undefined): Promise<boolean> {
  const id = Number(personId);
  if (!Number.isInteger(id) || id <= 0) return false;
  await globalKundeBereit();
  const [z] = (await sqlPool.unsafe(`
    WITH e272_kopf AS (SELECT ${KOPF_SQL("$1::int")} AS id)
    SELECT ${globalKundeSql("e272_kopf.id")} AS ja FROM e272_kopf`, [id])) as any[];
  return z?.ja === true;
}

/** E-272: Was ohne Text ankommt, in der Aufgabe für Justin — kurz und deutsch (MEDIEN spricht zum Modell). */
const MEDIEN_KURZ: Record<string, string> = {
  audio: "(Sprachnachricht)", voice: "(Sprachnachricht)", image: "(Bild)", video: "(Video)", document: "(Dokument)",
  sticker: "(Sticker)", reaction: "(Reaktion)", location: "(Standort)", unsupported: "(nicht übermittelte Nachricht)",
};

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

    // E-248: 20 statt 16 Zeilen — der Termin, die Team-Zusage und die Frage davor bleiben im Blick.
    const verlauf = (await sqlPool`
      SELECT id, richtung, text, typ, vorlage, status, von, knopf, COALESCE(empfangen_am, gesendet_am, created_at) AS am, person_id, lead_id
        FROM fiaon_whatsapp WHERE nummer = ${nummer} AND status <> 'fehler' ORDER BY id DESC LIMIT 20`) as any[];
    // Fehlerzeilen bleiben draußen: Sie zählen nicht als Antwort und dürfen die Kundennachricht nicht aus dem Fenster drängen.
    if (!verlauf.length) return { gesendet: false, grund: "Kein Verlauf." };

    // OFFEN: neueste Kundennachricht nach der letzten freien Antwort (Vorlagen und Fehler zählen nicht).
    const neuesteRein = verlauf.find((v) => v.richtung === "rein");
    if (!neuesteRein) return { gesendet: false, grund: "Der Kunde hat nichts geschrieben." };
    const [g] = (await sqlPool`SELECT mara_an, mara_aus_grund, mara_aus_am, versand_aufgegeben_id, ki_rueckfall_auf_id, ki_rueckfall_am, still_bis_id FROM fiaon_whatsapp_gespraech WHERE nummer = ${nummer}`.catch(() => [])) as any[];
    const letzteFreie = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && v.status !== "fehler");
    // E-236: Ein Rückfallsatz wegen KI-Ausfall ist KEINE Antwort — höchstens 12 Stunden lang holt Mara
    // die eigentliche Frage nach, sobald die KI wieder da ist (vorher blieb sie für immer unbeantwortet).
    const kiRueckfallOffen = !!(g?.ki_rueckfall_auf_id && letzteFreie && istMara(letzteFreie.von) && istRueckfall(letzteFreie.text)
      && g.ki_rueckfall_am && Date.now() - new Date(g.ki_rueckfall_am).getTime() < 12 * 60 * 60_000);
    const letzteAntwort = kiRueckfallOffen
      ? verlauf.find((v) => v.richtung === "raus" && !v.vorlage && v.status !== "fehler" && !(istMara(v.von) && istRueckfall(v.text)))
      : letzteFreie;
    if (letzteAntwort && Number(letzteAntwort.id) > Number(neuesteRein.id)) return { gesendet: false, grund: "Beantwortet." };
    // E-248: Hat Mara bis zu dieser Nachricht bewusst geschwiegen (Autoantwort, „Ok"), stößt nichts sie neu an.
    const stillBis = Number(g?.still_bis_id ?? 0);
    if (stillBis >= Number(neuesteRein.id)) return { gesendet: false, grund: "Mara schweigt hier bewusst (Autoantwort oder reine Bestätigung)." };
    // Steht ein frischer Rückfallsatz schon als letzte freie Antwort da? Dann nicht noch einer (E-248: in 2 h nie zweimal).
    const rueckfallSchonDa = verlauf.some((v) => v.richtung === "raus" && !v.vorlage && istMara(v.von) && istRueckfall(v.text)
      && Date.now() - new Date(v.am).getTime() < 2 * 60 * 60_000);
    // Nach dreimal gescheitertem Versand: erst eine NEUE Kundennachricht versucht es wieder (sonst KI-Kosten im Kreis).
    if (g?.versand_aufgegeben_id != null && Number(g.versand_aufgegeben_id) >= Number(neuesteRein.id)) {
      return { gesendet: false, grund: "Versand an diese Nummer scheiterte dreimal — ein Mensch ist informiert." };
    }
    // Die ERSTE Kundennachricht nach der letzten freien Antwort (und nach Maras letztem bewussten Schweigen): ab ihr wartet der Kunde.
    const abId = Math.max(letzteAntwort ? Number(letzteAntwort.id) : 0, stillBis);
    const offeneRein = verlauf.filter((v) => v.richtung === "rein" && Number(v.id) > abId);
    const ersteOffene = offeneRein[offeneRein.length - 1] ?? neuesteRein;
    if (g && g.mara_an === false && g.mara_aus_grund === "schalter") return { gesendet: false, grund: "Mara ist in diesem Gespräch von Hand abgeschaltet." };

    const personId = verlauf.find((v) => v.person_id)?.person_id ?? null;
    const leadId = verlauf.find((v) => v.lead_id)?.lead_id ?? null;

    // ── E-248: SCHWEIGEN (vor der Übernahme-Regel und vor dem Modell) ─────────
    // Autoantworten und reine Bestätigungen brauchen weder KI noch Mensch. Rein entschieden in
    // fiaon-mara-schweigen.ts; hier nur die Folgen (Marke, still_bis_id, Protokoll).
    const urteil: SchweigenUrteil = schweigen({ verlauf, offeneIds: offeneRein.map((v) => Number(v.id)), istRueckfall: (t) => istRueckfall(t) });
    if (urteil.autoIds.length) {
      await sqlPool`UPDATE fiaon_whatsapp SET auto_antwort = TRUE WHERE id = ANY(${urteil.autoIds}) AND nummer = ${nummer}`.catch((e) => console.warn("[MARA-WA] Autoantwort-Marke:", String(e).slice(0, 120)));
    }
    // Ein „Ok" von vor über zwei Stunden bekommt keinen Abschluss mehr — dann lieber still. Und nach seinem
    // STOPP bekommt ein „Danke" nichts mehr (er hat um keine Nachrichten gebeten).
    // E-264 (29.09.2026): ebenso nach Maras Entschuldigung auf ein Abstreiten („Wir schreiben Ihnen ab jetzt nicht
    // mehr") — ein „Ok danke" darauf bekommt kein „Gern!".
    const letzteMaraText = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && istMara(v.von))?.text;
    const nachStopp = letzteMaraText === STOPP_ANTWORT || nachAbstreiten(letzteMaraText);
    const abschlussZuAlt = urteil.art === "abschluss" && (nachStopp || Date.now() - new Date(ersteOffene.am).getTime() > 2 * 3_600_000);
    if (urteil.art === "schweigen" || abschlussZuAlt) {
      await stillSetzen(nummer, Number(neuesteRein.id));
      await protokolliere({ art: "still", ok: true, nummer, personId, leadId,
        text: `Mara schweigt: ${abschlussZuAlt ? (nachStopp ? "Bestätigung nach seinem STOPP — nichts mehr schicken." : "Bestätigung älter als zwei Stunden — kein später Abschluss.") : urteil.grund}`,
        daten: { grund: abschlussZuAlt ? (nachStopp ? "nach_stopp" : "abschluss_zu_alt") : urteil.still ?? null, auf_id: Number(neuesteRein.id), auto_ids: urteil.autoIds } });
      return { gesendet: false, grund: `Mara schweigt: ${abschlussZuAlt ? (nachStopp ? "Bestätigung nach seinem STOPP." : "Bestätigung älter als zwei Stunden.") : urteil.grund}` };
    }

    // ── E-272 (02.10.2026): GLOBAL-KUNDEN — MARA ANTWORTET NIE, JUSTIN ÜBERNIMMT ──
    // Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er soll Global bleiben, also keine
    // unnötigen Mails.“ Mara kennt nur die Privatlinie (Karte, Antrag, Rate, Auskunft, Rückruf beim Betreuer) —
    // William Hildbrand bekam am 29.09. drei Antworten über Rate und Privatantrag; seit seinem Individualangebot
    // (01.10.) hätte jede neue Nachricht wieder dieselbe Privat-Lage ergeben. Deshalb hier, VOR
    // jedem festen Satz (STOPP, Abstreiten, Abschluss), vor dem Ablauf einer Übernahme, vor Werkzeugen und
    // Modell: keine Antwort, kein Rückruf, kein Verkauf. Stattdessen der vorhandene Übergabe-Weg
    // (aufgabeFuerMenschen: Protokoll „uebergabe“, Aktenvermerk beim ersten Mal) — als EINE Aufgabe der Klasse
    // „global“ auf Justins Board, nie beim Privat-Betreuer oder einer Vertretung. Weitere Nachrichten hängen
    // still an dieselbe offene Aufgabe (heikle wieder sichtbar). Danach still_bis_id auf diese Nachricht: Kein
    // Nachhol-Takt stößt sie wieder an, erst eine NEUE Kundennachricht kommt wieder hierher.
    // Autoantworten blieben schon oben still; ein reines „Ok, danke“ bekommt weder Satz noch Aufgabe — außer es ist
    // die Zusage auf die Frage eines Menschen (schweigen: „weitergeben“), die erfährt Justin.
    // Laufzeitprüfung ohne eigenen Zustand (kein mara_aus_grund): Wird er „gemischt“, gilt wieder alles wie oben.
    if (personId && await globalKundeWa(Number(personId))) {
      const autoIdsG = new Set(urteil.autoIds);
      const echteG = offeneRein.filter((v) => !autoIdsG.has(Number(v.id))).slice().reverse();
      const seinTextG = echteG
        .map((v) => String(v.text || v.knopf || MEDIEN_KURZ[String(v.typ)] || (v.typ && v.typ !== "text" ? `(${v.typ})` : "")))
        .join(" · ").replace(/\s+/g, " ").trim();
      const nurBestaetigungG = echteG.length > 0 && echteG.every((v) => istBestaetigung(v.text || v.knopf));
      if (urteil.art !== "weitergeben" && (urteil.art === "abschluss" || nurBestaetigungG || !seinTextG)) {
        await stillSetzen(nummer, Number(neuesteRein.id));
        await protokolliere({ art: "still", ok: true, nummer, personId, leadId,
          text: "Mara schweigt: Global-Kunde (E-272), reine Bestätigung — keine Antwort, keine Aufgabe.",
          daten: { grund: "global_kunde", auf_id: Number(neuesteRein.id) } });
        return { gesendet: false, grund: "Global-Kunde (E-272) — reine Bestätigung, Mara schweigt." };
      }
      // E-372 (15.10.2026): statt der Aufgabe auf Justins Board eine Karte in Mara › Entscheidungen („Selbst antworten“
      // öffnet genau dieses Gespräch). Weitere Nachrichten frischen dieselbe offene Karte auf. Geht die Karte nicht
      // (Datenbank), bleibt es bei der Aufgabe auf Justins Board wie bisher (uebergeben, Rückfall).
      const angelegt = await uebergeben({ nummer, personId: Number(personId), leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id),
        weg: waWeg({ kunde: seinTextG, anlass: "global" }),
        aufgabe: { grund: `FIAON Global — er schreibt auf WhatsApp: „${seinTextG.slice(0, 300)}“. Mara antwortet Global-Kunden nie selbst (E-272) — bitte selbst antworten (WhatsApp-Raum), im Ton von FIAON Global.`,
          dringend: true, klasse: "global", opt: { betreiber: true, ...(heikelAnliegen(seinTextG) ? { still: false } : {}) } },
        karte: { kunde: seinTextG, mara: null } });
      // Ließ sich nichts anlegen, bleibt die Nachricht offen — der Nachhol-Takt versucht es in 5 Min. wieder.
      if (!angelegt) return { gesendet: false, grund: "Global-Kunde (E-272) — Mara antwortet nicht; die Übergabe ließ sich nicht anlegen, neuer Versuch im Nachhol-Takt." };
      await stillSetzen(nummer, Number(neuesteRein.id));
      return { gesendet: false, grund: "Global-Kunde (E-272) — Mara antwortet nicht, Karte für Justin (Mara › Entscheidungen)." };
    }

    // Nachbesserung E-248: „Ok passt" auf die FRAGE einer Kollegin — Mara schreibt nichts, setzt aber
    // nicht still (das Gespräch bleibt in der Warteliste), und die Kollegin erfährt die Zusage einmal.
    if (urteil.art === "weitergeben") {
      const k = `team-ok-${nummer}-${neuesteRein.id}`;
      if (!kiAufgabeGemeldet.has(k)) {
        kiAufgabeGemeldet.add(k);
        const wer = String(urteil.anTeam?.von ?? "").split(/\s+/)[0] || "Team";
        await aufgabeFuerMenschen(nummer, personId, leadId,
          `Kunde hat auf ${wer}s Frage zugestimmt: „${String(neuesteRein.text || neuesteRein.knopf || "").slice(0, 120)}". ${wer}s Frage war: „${String(urteil.anTeam?.frage ?? "").slice(0, 160)}" — bitte selbst weitermachen (Mara antwortet hier nicht).`,
          false, "rueckruf");
        await protokolliere({ art: "still", ok: true, nummer, personId, leadId,
          text: `Mara antwortet nicht: ${urteil.grund}`, daten: { grund: "zusage_an_team", auf_id: Number(neuesteRein.id) } });
      }
      return { gesendet: false, grund: `Mara antwortet nicht: ${urteil.grund}` };
    }

    if (g && g.mara_an === false) {
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

    // STOPP: genau eine kurze Bestätigung, ohne Pitch — und nur, solange sie frisch ist.
    if (istStopp(neuesteRein.text, neuesteRein.knopf)) {
      if (Date.now() - new Date(neuesteRein.am).getTime() > 60 * 60_000) return { gesendet: false, grund: "STOPP — zu alt für eine Bestätigung." };
      await vorbereiten(nummer, STOPP_ANTWORT, Number(neuesteRein.id), String(neuesteRein.text ?? ""), { kunde: String(neuesteRein.text || neuesteRein.knopf || ""), handlung: "WhatsApp-Stopp bestätigt — keine Vorlagen mehr" });
      return { gesendet: false, grund: "STOPP bestätigt (liegt bereit)." };
    }

    // ── E-408 (Scheibe 3, 22.10.2026): SEINE ANTWORT AUF DIE FRAGE NACH DEM JA ZUM ANRUF ───────────────────────────
    // Gespeichert (oder zurückgenommen, oder die Telefonsperre gesetzt) hat es schon der Eingang (waEingang →
    // jaAusWhatsApp, fiaon-ja-zum-anruf.ts). Feste Sätze ohne Modell — also auch in der KI-Pause:
    //   · ist ALLES, was er offen geschrieben hat, genau dieses klare JA → JA_DANKE_WA (kein Zeitpunkt, kein Versprechen);
    //   · verlangt alles Offene die Sperre („nicht mehr anrufen“, ohne weitere Frage) → ANRUF_SPERRE_WA.
    // Sonst bekommt das Modell EINEN Satz für JETZT BEACHTEN (jaHinweisFuerMara: gesperrt / zurückgenommen /
    // gespeichert / die Frage stand da, aber kein klares Ja). Ein bloßer Widerruf läuft wie bisher übers Modell.
    let jaHinweis: string | null = null;
    let jaFrageZuletzt = false;
    {
      const autoIds = new Set(urteil.autoIds);
      const echteOffeneJa = offeneRein.filter((v) => !autoIds.has(Number(v.id)));
      const echteIds = echteOffeneJa.map((v) => Number(v.id));
      const ja = await jaImGespraech({ nummer, offene: echteOffeneJa.map((v) => ({ id: Number(v.id), text: String(v.text || v.knopf || "") })), ersteOffeneId: Number(ersteOffene.id) })
        .catch((e) => { console.warn(`[MARA-WA] ${nummer.slice(-4)}: Ja zum Anruf nicht lesbar:`, String(e?.message ?? e).slice(0, 160)); return null; });
      const seineWorte = echteOffeneJa.map((v) => String(v.text || v.knopf || "")).reverse().join("\n");
      if (ja && echteIds.length > 0 && echteIds.every((id) => ja.gespeichertIds.includes(id))) {
        await vorbereiten(nummer, JA_DANKE_WA, Number(neuesteRein.id), seineWorte, { kunde: seineWorte, handlung: "Ja zum Anruf gespeichert (E-408) — kurzer Dank" });
        await protokolliere({ art: "ja_zum_anruf", ok: true, nummer, personId, leadId, text: `Ja zum Anruf gespeichert — kurzer Dank: ${JA_DANKE_WA}`, daten: { auf_id: Number(neuesteRein.id) } });
        return { gesendet: false, grund: "Ja zum Anruf gespeichert — kurzer Dank liegt bereit." };
      }
      if (ja && echteIds.length > 0 && echteIds.every((id) => ja.sperreIds.includes(id)) && !seineWorte.includes("?")) {
        await vorbereiten(nummer, ANRUF_SPERRE_WA, Number(neuesteRein.id), seineWorte, { kunde: seineWorte, handlung: "Nicht mehr anrufen — Telefonsperre gesetzt (E-408)" });
        await protokolliere({ art: "ja_zum_anruf", ok: true, nummer, personId, leadId, text: `Telefonsperre — fester Satz: ${ANRUF_SPERRE_WA}`, daten: { auf_id: Number(neuesteRein.id) } });
        return { gesendet: false, grund: "Telefonsperre gesetzt — fester Satz liegt bereit." };
      }
      jaFrageZuletzt = !!ja?.frageOffen;
      jaHinweis = ja ? jaHinweisFuerMara({ jaGespeichert: ja.gespeichertIds.length > 0, zurueckgenommen: ja.zurueckIds.length > 0, gesperrt: ja.sperreIds.length > 0, frageOffen: ja.frageOffen }) : null;
    }

    // ── E-264: ABSTREITEN, IRRTUM, DATENFRAGE, LÖSCHWUNSCH (fester Satz, ohne Modell) ──
    // Fall 29.09.2026: „Hab nix beantragt 🤢🤮😡😤😠" → „Sehr gern — nach der Zahlung ist Ihr Account
    // aktiv … Ihre Zahlungsseite". Wie STOPP ein fester Satz — also auch in der KI-Pause.
    // „Wer sind Sie?" / „Woher meine Nummer?" bekommen KEINEN festen Satz (Nachbesserung): Das Modell
    // stellt sich vor, nennt die belegte Herkunft (herkunftHinweis) und den nächsten Schritt.
    let herkunftHinweis: string | null = null;
    // E-265 Nachbesserung (29.09.2026, E-264-Regression): welche Art Abstreiten — „Was ist FIAON?" löscht den
    // Herkunftshinweis nur bei „wer", nie bei einer Datenfrage („… und woher haben Sie meine Nummer?").
    let abstArtJetzt: string | null = null;
    {
      const autoIds = new Set(urteil.autoIds);
      const seinText = offeneRein.filter((v) => !autoIds.has(Number(v.id))).slice().reverse()
        .map((v) => String(v.text || v.knopf || "")).join("\n").trim();
      const letzteMara = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && istMara(v.von))?.text ?? null;
      const loesch = !!seinText && istLoeschwunsch(seinText, { angeboten: loeschenAngeboten(letzteMara) });
      const abst = seinText && !loesch ? abstreitenArt(seinText) : null;
      abstArtJetzt = abst?.art ?? null;
      if (!loesch && nachAbstreiten(letzteMara)) {
        // Folge-Satz „nicht mehr schreiben", „keine Nachrichten mehr" nach Maras Entschuldigung: dieselbe
        // Wirkung wie STOPP heute — die feste STOPP-Antwort und die Werbesperre.
        if (stoppWunsch(seinText)) {
          if (personId) await (await import("./fiaon-mara-abstreiten")).werbesperreSetzen(Number(personId)).catch(() => false);
          await vorbereiten(nummer, STOPP_ANTWORT, Number(neuesteRein.id), seinText, { kunde: seinText, handlung: "Stopp nach Abstreiten bestätigt — Werbesperre gesetzt, keine Vorlagen mehr" });
          return { gesendet: false, grund: "STOPP nach Abstreiten bestätigt (liegt bereit)." };
        }
        // Nachbesserung E-264: Will er doch weitermachen, fragt ein Mensch, ob die Werbesperre fällt —
        // nie von selbst. Mara antwortet ihm normal (das Modell unten).
        const weiter = !!personId && willWeitermachen(seinText);
        if (weiter) {
          const [p] = (await sqlPool`SELECT werbung_gesperrt_am FROM fiaon_persons WHERE id = ${Number(personId)}`.catch(() => [])) as any[];
          if (p?.werbung_gesperrt_am) {
            // E-372: Ob die Werbesperre fällt, entscheidet Justin (Karte mit seiner Akte) — keine Aufgabe beim Betreuer.
            const seit = new Date(p.werbung_gesperrt_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
            await uebergeben({ nummer, personId: Number(personId), leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id),
              weg: waWeg({ kunde: seinText, anlass: "werbesperre" }),
              aufgabe: { grund: `Nach „Kunde bestreitet" schreibt er jetzt: „${seinText.replace(/\s+/g, " ").slice(0, 160)}" — er will offenbar doch weitermachen. Die Werbesperre steht noch (seit ${seit}). Werbesperre aufheben? Nur auf seinen ausdrücklichen Wunsch — bitte mit ihm klären.`, dringend: true, klasse: "anliegen" },
              karte: { kunde: seinText, mara: null, grund: `Werbesperre seit ${seit} — aufheben nur auf seinen ausdrücklichen Wunsch (Akte)` } });
          }
        } else {
          // Nachbesserung E-264: Ein weiteres „Ich kenne euch nicht!!" oder „😡" nach der Entschuldigung bekommt
          // nicht dieselbe Entschuldigung noch einmal („Wir schreiben Ihnen ab jetzt nicht mehr" — zweimal).
          // Und bei einem ABGESCHICKTEN Antrag (die Leitung klärt) oder einem Fremden („versehentlich
          // hinterlegt") antwortet nach der Entschuldigung kein Modell mehr — es könnte sonst die
          // Zahlungsseite schicken, während die Leitung den Antrag prüft. Mara schweigt; die offene
          // Aufgabe bekommt die Nachricht dazu.
          const al = await (await import("./fiaon-mara-abstreiten")).abstreitenLage(personId ? Number(personId) : null, leadId ? Number(leadId) : null).catch(() => null);
          const fremd = /versehentlich hinterlegt/.test(String(letzteMara ?? ""));
          if ((abst && abst.art !== "datenfrage" && abst.art !== "wer") || WUT_EMOJI.test(seinText) || al?.abgeschickt || fremd) {
            await stillSetzen(nummer, Number(neuesteRein.id));
            // E-372: nach waWeg — falsche Nummer, abgeschickter Antrag oder eine Drohung: die (offene) Karte für Justin
            // bekommt die Nachricht; „wofür zahlen?“: der Betreuer (er hat zugesagt, sich zu melden); sonst hat Mara
            // schon alles getan (Entschuldigung, Herkunft, Werbesperre nach Regel) — still, keine Aufgabe.
            const rueckfrage = abst?.art === "rueckfrage" || /Das kläre ich gern für Sie/.test(String(letzteMara ?? ""));
            const lageE = personId ? await (await import("./fiaon-whatsapp-entscheidungen")).waLageLesen(Number(personId)).catch(() => null) : null;
            const wegN = waWeg({ kunde: seinText, anlass: "abstreiten", abstArt: fremd ? "falsche_nummer" : rueckfrage ? "rueckfrage" : "bestreitet",
              abgeschickt: !!al?.abgeschickt, bezahlt: lageE?.bezahlt });
            await uebergeben({ nummer, personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id), weg: wegN,
              aufgabe: { grund: `Nach Maras Entschuldigung schrieb er noch: „${seinText.replace(/\s+/g, " ").slice(0, 160)}" — Mara antwortet hier nicht mehr; bitte selbst übernehmen.`,
                dringend: false, klasse: fremd ? "falsche_nummer" : rueckfrage ? "rueckfrage" : "bestreitet",
                opt: { leitung: !/Das kläre ich gern für Sie/.test(String(letzteMara ?? "")), still: true } },
              karte: { kunde: seinText, mara: letzteMara }, lage: lageE });
            await protokolliere({ art: "still", ok: true, nummer, personId, leadId,
              text: `Mara schweigt: nach ihrer Entschuldigung noch „${seinText.replace(/\s+/g, " ").slice(0, 80)}" — keine zweite Entschuldigung${wegN.weg === "karte" ? ", die Karte für Justin hat die Nachricht" : wegN.weg === "betreuer" ? ", ein Mensch übernimmt" : ""}.`,
              daten: { grund: "nach_abstreiten", auf_id: Number(neuesteRein.id), weg: wegN.weg } });
            return { gesendet: false, grund: `Nach der Entschuldigung: Mara schweigt${wegN.weg === "karte" ? ", die Karte hat die Nachricht" : wegN.weg === "betreuer" ? ", die Aufgabe hat die Nachricht" : " — schon alles erledigt"}.` };
          }
        }
      }
      if (loesch || abst?.fest) {
        const erg = await abstreitenBeantworten({
          nummer, personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null,
          aufId: Number(neuesteRein.id), seinText, abst, loesch,
        });
        if (erg) return erg;
      }
      if (abst && (abst.art === "datenfrage" || abst.art === "wer")) {
        const { abstreitenLage } = await import("./fiaon-mara-abstreiten");
        const al = await abstreitenLage(personId ? Number(personId) : null, leadId ? Number(leadId) : null).catch(() => null);
        // Keine eigene Aufgabe (sie käme in der KI-Pause bei jedem Nachhol-Takt wieder) — fragt er nach
        // seinen Daten im Sinne von Art. 15 DSGVO, übergibt das Modell (mensch true).
        herkunftHinweis = abstreitenHinweis({ art: abst.art, kanal: "whatsapp", herkunft: al?.herkunft ?? null, betreuer: al?.betreuer ?? null });
      }
    }

    // ── E-248: DER KURZE WARME ABSCHLUSS (ohne Modell) ─────────────────────
    // „Ok danke" auf Maras erledigte Sache: EIN Satz — „Gern, dann bis morgen um 20 Uhr!" — danach schweigt sie.
    if (urteil.art === "abschluss") {
      const mt = await import("./fiaon-mara-termin");
      const t = personId ? await mt.kuenftigerTermin(Number(personId)).catch(() => null) : null;
      const kundeText = offeneRein.map((v) => String(v.text || v.knopf || "")).join(" ");
      const satz = abschlussSatz({ termin: t ? { beginn: t.beginn } : null, kunde: kundeText });
      await vorbereiten(nummer, satz, Number(neuesteRein.id), kundeText, { kunde: kundeText, handlung: "kurzer Abschluss (keine Aufgabe)" });
      await protokolliere({ art: "abschluss", ok: true, nummer, personId, leadId, text: `Kurzer Abschluss auf „${kundeText.slice(0, 80)}": ${satz}` });
      return { gesendet: false, grund: "Kurzer Abschluss (liegt bereit)." };
    }

    // ── E-372 (15.10.2026): RECHT, WIDERRUF NACH ZAHLUNG, GELD ZURÜCK — DER SICHERE SATZ UND EINE KARTE ──
    // Anwalt/Polizei/Behörde, ein Widerruf oder der Wunsch nach Geld zurück, nachdem er bezahlt hat: Justin entscheidet.
    // Mara schickt sofort den sicheren Satz (WA_ENTSCHEIDUNG_SATZ: die Geschäftsführung entscheidet, er bekommt eine
    // schriftliche Nachricht — keine Zusage, keine Zahlungsbitte) und legt die Karte an — ohne Modell, also auch in der
    // KI-Pause. Liegt die Karte desselben Falls schon offen, antwortet das Modell (ohne Zusage, Hinweis unten), und die
    // Karte bekommt seine neue Nachricht dazu (nach dem Entwurf). Eine Bestellung ohne Zahlung widerruft er per Storno —
    // das macht Mara selbst (zwei Schritte, kuendigung_aufnehmen).
    const weE = await import("./fiaon-whatsapp-entscheidungen");
    const lageE = personId ? await weE.waLageLesen(Number(personId)).catch(() => null) : null;
    const offeneKarten = await weE.waOffeneKarten(personId ? Number(personId) : null, nummer).catch(() => []);
    let entscheidungsFall: WaFall | null = null;
    let entscheidungsHinweis: string | null = null;
    {
      const autoIds = new Set(urteil.autoIds);
      // Nur seine Worte — ein Vorlagen-Knopf ist keine Erklärung.
      const seineWorte = offeneRein.filter((v) => !autoIds.has(Number(v.id)) && !v.knopf).slice().reverse().map((v) => String(v.text || "")).join("\n").trim();
      const fall = seineWorte ? waEntscheidungVorab(seineWorte, { bezahlt: !!lageE?.bezahlt }) : null;
      if (fall && !offeneKarten.some((x) => x.fall === fall)) {
        let satz = WA_ENTSCHEIDUNG_SATZ[fall]!;
        const [vorgestellt] = (await sqlPool`
          SELECT 1 FROM fiaon_whatsapp WHERE nummer = ${nummer} AND richtung = 'raus' AND status <> 'fehler'
             AND text ILIKE '%digitale Assistentin%' LIMIT 1`.catch(() => [])) as any[];
        if (!vorgestellt) satz = `Hier ist ${(await agentNamen()).voll.split(" ")[0]}, die digitale Assistentin von FIAON. ${satz}`;
        // Auch der feste Satz muss durch die Wand — trifft sie (nie erwartet), antwortet Justin selbst (die Karte sagt es).
        const wand = sendePruefung(satz);
        if (!wand.length) {
          await vorbereiten(nummer, satz, Number(neuesteRein.id), seineWorte, { kunde: seineWorte, handlung: `${fall}: sicherer Satz (Geschäftsführung entscheidet), Karte für Justin` });
        }
        await uebergeben({ nummer, personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id),
          weg: { weg: "karte", fall, grund: fall === "rechtlich" ? "droht mit Anwalt, Polizei oder Behörde" : fall === "widerruf" ? "Widerruf nach einer Zahlung" : "will Geld zurück" },
          aufgabe: { grund: `Heikles Anliegen (${fall}): „${seineWorte.slice(0, 240)}“`, dringend: true, klasse: "heikel" },
          karte: { kunde: seineWorte, mara: wand.length ? null : satz, grund: wand.length ? `Der sichere Satz fiel durch die Wand (${wand.join(" · ")}) — bitte selbst antworten.` : null },
          lage: lageE });
        return { gesendet: false, grund: wand.length ? `${fall} — Karte für Justin (der sichere Satz fiel durch die Wand).` : `${fall} — sicherer Satz liegt bereit, Karte für Justin.` };
      }
      if (fall) entscheidungsFall = fall;
      const offenText = offeneKarten.map((x) => ({ rechtlich: "Anwalt/Behörde", widerruf: "Widerruf", erstattung: "Geld zurück", loeschen: "Löschwunsch",
        bestreitet: "bestrittener Antrag", kuendigung_zurueck: "Rücknahme der Kündigung", ratenpause: "Ratenpause", global: "FIAON Global",
        karte: "Kartenlink", falsche_nummer: "Nummer", werbesperre: "Werbesperre", unsicher: "eine offene Frage", frage: "eine offene Frage" } as Record<WaFall, string>)[x.fall]);
      if (offeneKarten.length) {
        entscheidungsHinweis = `SEINE SACHE LIEGT BEI UNSERER GESCHÄFTSFÜHRUNG (${Array.from(new Set(offenText)).join(", ")}): `
          + `${entscheidungsFall ? "Du hast ihm schon gesagt, dass unsere Geschäftsführung entscheidet und er eine schriftliche Nachricht bekommt — wiederhole den Satz nicht wörtlich. " : ""}`
          + `Sag dazu nichts zu (kein Geld, keine Frist, kein Ergebnis, keine Löschung, kein Storno)${karteRuhe(offeneKarten) ? ", keine Zahlungsbitte, keine Rückfrage zur Kündigung" : ""}. Beantworte ruhig, was er sonst fragt.`;
      }
    }

    // ── KI-PAUSE (27.09.2026, E-246) ──────────────────────────────────────────
    // Justin: „Nichts Wirres oder Falsches schicken, sondern einfach Pause." Kein
    // KI-Aufruf, kein Rückfallsatz, keine Aufgabe je Nachricht — die Nachricht
    // bleibt offen und der Nachhol-Takt nimmt sie nach dem Aktivieren. (Die
    // STOPP-Bestätigung darüber ist ein fester Satz ohne KI und geht weiter.)
    if (await kiPausiert()) return { gesendet: false, grund: "KI pausiert — die Nachricht wartet, bis die KI wieder aktiv ist." };
    // ── WHATSAPP-KONTO GESPERRT ODER ZUGANG ABGELAUFEN (29.09.2026, E-261) ────
    // Hat Meta das Konto gesperrt (oder den Token abgelehnt, #190), geht auch
    // keine Antwort im Fenster raus. Dann denkt Mara gar nicht erst (keine
    // KI-Kosten) — die Nachricht bleibt offen, mara_wa_nachholen nimmt sie nach
    // „WhatsApp wieder aktivieren". Ist sie bis dahin älter als 12 Stunden,
    // antwortet Mara nicht mehr frei (wie nach der KI-Pause): Sie steht in der
    // Sammelaufgabe der Sperre (zuAltFuerMara, Quelle „wa"), sonst eine eigene
    // Aufgabe. Bei den anderen Pausen (Zahlung, Spam, Hand) antwortet Mara
    // normal — Text im offenen Fenster geht dort raus.
    const wp = await waPauseLesen();
    if (wp.an && waAllesZu(wp.art)) return { gesendet: false, grund: "WhatsApp pausiert (Konto gesperrt oder Zugang abgelaufen) — die Nachricht wartet, bis WhatsApp wieder aktiv ist." };
    if (waAllesZu(wp.art) && kamInDerPause(neuesteRein.am, wp) && Date.now() - new Date(neuesteRein.am).getTime() > PAUSE_FREI_MAX_MS) {
      await zuAltFuerMara(wp.seit, "wa").catch((e) => console.error("[MARA-WA] WA-Sperre-Sammelaufgabe:", e));
      if (!(await inPauseSammlung(wp.seit, Number(neuesteRein.id), "wa"))) {
        const k = `wa:${nummer}:${neuesteRein.id}`;
        if (!pauseEinzelGemeldet.has(k)) {
          pauseEinzelGemeldet.add(k);
          await aufgabeFuerMenschen(nummer, personId ? Number(personId) : null, leadId ? Number(leadId) : null,
            `Nachricht aus der WhatsApp-Sperre (${tagUndUhrzeit(new Date(neuesteRein.am))}), älter als 12 Stunden — Mara antwortet nicht selbst. Bitte selbst melden: „${String(neuesteRein.text ?? "").replace(/\s+/g, " ").slice(0, 160)}"`, true, "pause");
        }
        return { gesendet: false, grund: "Nachricht aus der WhatsApp-Sperre, älter als 12 Stunden — eigene Aufgabe an einen Menschen, keine freie Antwort." };
      }
      return { gesendet: false, grund: "Nachricht aus der WhatsApp-Sperre, älter als 12 Stunden — Sammelaufgabe an einen Menschen, keine freie Antwort." };
    }
    // ── NACH DER KI-PAUSE (E-246, Nachprüfung 27.09.) ─────────────────────────
    // Kam selbst die NEUESTE offene Nachricht in der Pause und ist sie älter als
    // 12 Stunden, antwortet Mara nicht frei: „heute", „gleich", „morgen früh"
    // meinen einen anderen Tag, und eine späte Antwort liest sich wirr. Sie geht
    // in die Sammelaufgabe der Pause — ein Mensch meldet sich (das WhatsApp-Fenster
    // ist bis 24 h offen). Schreibt der Kunde danach neu, antwortet Mara normal.
    const kp = await kiPauseLesen();
    if (kamInDerPause(neuesteRein.am, kp) && Date.now() - new Date(neuesteRein.am).getTime() > PAUSE_FREI_MAX_MS) {
      await zuAltFuerMara(kp.seit).catch((e) => console.error("[MARA-WA] Pause-Sammelaufgabe:", e));
      // Nachbesserung 27.09.: Steht die Nachricht nachweislich in der Sammelaufgabe
      // (Marke bis zu ihr gerückt)? Sonst eine eigene Aufgabe — nie still liegen lassen.
      if (!(await inPauseSammlung(kp.seit, Number(neuesteRein.id)))) {
        const k = `${nummer}:${neuesteRein.id}`;
        if (!pauseEinzelGemeldet.has(k)) {
          pauseEinzelGemeldet.add(k);
          await aufgabeFuerMenschen(nummer, personId ? Number(personId) : null, leadId ? Number(leadId) : null,
            `Nachricht aus der KI-Pause (${tagUndUhrzeit(new Date(neuesteRein.am))}), älter als 12 Stunden — Mara antwortet nicht selbst. Bitte selbst melden: „${String(neuesteRein.text ?? "").replace(/\s+/g, " ").slice(0, 160)}"`, true, "pause");
        }
        return { gesendet: false, grund: "Nachricht aus der KI-Pause, älter als 12 Stunden — eigene Aufgabe an einen Menschen, keine freie Antwort." };
      }
      return { gesendet: false, grund: "Nachricht aus der KI-Pause, älter als 12 Stunden — Sammelaufgabe an einen Menschen, keine freie Antwort." };
    }

    const lv = verlauf.find((v) => v.richtung === "raus" && v.vorlage);
    const letzteVorlage = lv ? { name: String(lv.vorlage), text: lv.text ?? null } : null;
    const lage = await lageFuer(personId ? Number(personId) : null, leadId ? Number(leadId) : null, letzteVorlage, String(neuesteRein?.text ?? ""));

    const deckel = zahlLesen(await einstellung("mara_wa_tag_euro", "30"), 30, 0, 200); // E-280: Claude-Preise (Justin 03.10.: 30 €); E-409 Fund 14: 0 heißt 0; E-458: echte Dollar
    const heute = await kostenHeute(DIENST_WA).catch(() => 0);
    if (heute >= deckel) {
      const schluessel = `${nummer}-${new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" })}`;
      if (!deckelGemeldet.has(schluessel)) {
        deckelGemeldet.add(schluessel);
        console.warn(`[MARA-WA] Kostendeckel erreicht (${heute.toFixed(2)} $ von ${deckel} $) — ${nummer.slice(-4)} geht an einen Menschen.`);
        await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat heute ihren KI-Kostendeckel erreicht — bitte selbst antworten.", true, "deckel");
      }
      return { gesendet: false, grund: `Kostendeckel erreicht (${heute.toFixed(2)} $ von ${deckel} $) — Aufgabe an einen Menschen.` };
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
      await aufgabeFuerMenschen(nummer, personId, leadId, "Mara hat diesem Kontakt sehr viele Antworten in kurzer Zeit geschrieben (Autoresponder?) — sie pausiert hier bis morgen. Bitte ansehen.", true, "deckel");
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

    // E-248: Autoantworten zählen nicht als seine Worte (der Firmenname des Nagelstudios stand sonst in „kunde").
    const autoSet = new Set(urteil.autoIds);
    const echteOffene = offeneRein.filter((v) => !autoSet.has(Number(v.id)));
    const letzteEchte = echteOffene[0] ?? neuesteRein;
    const frage = String(letzteEchte.text ?? letzteEchte.knopf ?? "");
    const letzteDu = verlauf.filter((v) => v.richtung === "raus" && !v.vorlage && istMara(v.von)).map((v) => String(v.text ?? ""));
    const kunde = echteOffene.slice().reverse().map((v) => String(v.text || v.knopf || "")).join("\n");
    const kontext = verlauf.filter((v) => v.richtung === "rein" && !autoSet.has(Number(v.id))).slice(0, 5).map((v) => String(v.text || v.knopf || "")).join("\n");
    const verlaufText = verlauf.map((v) => String(v.text ?? "")).join("\n");

    // ── E-401 (2/6, 19.10.2026): WAS DAS TEAM VEREINBART HAT — UND DER TERMIN, DEN ER NENNT ─────────────────────────
    // Wie im Postfach (E-395, Fall #7131): Mara liest die Gesprächsnotizen der Kollegen (14 Tage) — was dort vereinbart
    // ist, gilt. Nennt er einen Termin, der mit uns schon feststeht („wir telefonieren heute um 11 mit Herrn …“, passt zu
    // einer Notiz), trägt der SERVER ihn ein (fiaon-mara-genannter-termin.ts, kanal whatsapp) und sagt dem Modell, was
    // geschehen ist; Mara wünscht ein gutes Gespräch und nimmt sich zurück — kein Verkauf, keine Zahlungsbitte, kein Link.
    // Das Aushandeln einer Zeit mit Mara (Antwort auf ihr Zeitangebot, „Können wir um 14 Uhr telefonieren?“) bleibt der
    // Rückruf-Weg (rueckruf_eintragen, E-236) — das entscheidet genanntAufWhatsApp. Nur seine Worte (keine Knöpfe).
    const gtM = await import("./fiaon-mara-genannter-termin");
    const teamNotizenWa = personId ? await gtM.teamNotizenLesen(Number(personId)).catch(() => []) : [];
    let genannt: GenanntLage | null = null;
    // E-401 Nachbesserung (Prüfer-Fund): Fragt er SELBST nach Karte, Link oder Zahlung, erfüllt Mara das auch neben einem
    // genannten Termin — „sich zurücknehmen“ heißt nichts anbieten, nicht seine Bitte verweigern.
    const jaAufKartenLink = /link\s+unserer\s+partnerbank[^?]{0,80}schicken\s*\?/i.test(letzteDu[0] ?? "")
      && /^\s*(?:ja|jawohl|gern|gerne|bitte|ok|okay|klar|jo|jep)\b/i.test(kunde.trim()) && kunde.trim().length <= 40;
    const kundeFragtSelbst = fragtNachKarte(kunde) || jaAufKartenLink || fragtSelbstNachLinkOderZahlung(kunde);
    {
      const seineWorte = echteOffene.filter((v) => !v.knopf).slice().reverse().map((v) => String(v.text || "")).join("\n").trim();
      if (personId && seineWorte) {
        // Die Nachricht mit der Uhrzeit — ihr Zeitpunkt ist der Bezug für „heute/morgen“, wenn sie schon älter ist (Pause).
        const traeger = echteOffene.find((v) => !v.knopf && uhrzeitenGenannt(String(v.text || "")).length > 0) ?? letzteEchte;
        const lrG = verlauf.find((v) => v.richtung === "raus" && v.status !== "fehler" && Number(v.id) < Number(ersteOffene.id)) ?? null;
        genannt = await gtM.genannterTerminBehandeln({
          personId: Number(personId), ref: null, kundeText: seineWorte, notizen: teamNotizenWa, kanal: "whatsapp", nummer,
          waId: Number(traeger.id), letzteRaus: lrG ? String(lrG.text ?? "") : null,
          bezug: Date.now() - new Date(traeger.am).getTime() > 3 * 3_600_000 ? new Date(traeger.am) : null,
          kundeFragtSelbst,
        }).catch((e) => { console.warn("[MARA-WA] Genannter Termin:", String(e?.message || e).slice(0, 160)); return null; });
      }
    }
    /** E-401 Nachbesserung: neben dem genannten Termin zurücknehmen — außer er fragt selbst nach Karte, Link oder Zahlung. */
    const genanntZurueck = !!genannt && genannt.zurueck;
    // E-240: Angebot „jetzt", wenn er gerade über Bonität, Limit, Karte oder die Auskunft schreibt
    // (seine offenen Nachrichten) oder Maras letzte Frage zur Auskunft beantwortet. Bei Werbesperre
    // nur, wenn er sie ausdrücklich will — dann ist es seine Anfrage, keine Werbung.
    // Gegenlesen 24.09.2026: dieselbe Zurückhaltung bei Vertriebssperre (is_blocked, „kein
    // Interesse") — das Werkzeug lehnte dort ohnehin ab (werbungVerboten), der Auftrag bot aber an.
    // Und nach dem ersten Angebot nur noch, wenn er selbst auf die Auskunft zurückkommt (auskunftJetzt).
    // E-401 (2/6): Nennt er einen Termin, bietet Mara in dieser Antwort nichts an (zurücknehmen).
    const ohneAngebot = lage.werbesperre || lage.vertriebssperre || !!genannt;
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
    // E-365: auskunftVerkaufbar — dazu privat „dokument" (eigene Datenkopie; die Auswertung ist ein anderes Produkt).
    if (personId && lage.auskunft && auskunftVerkaufbar(lage.auskunft)) {
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

    // ── E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f06): ER BESTÄTIGT DIE ANGEBOTENE ZEIT → DER SERVER TRÄGT EIN ──
    // „Justin Schwarzott kann Sie heute um 10:20 Uhr anrufen. Passt Ihnen das?" → „Heute .10:20?": Das Modell fragte noch
    // einmal nach („Soll ich den Rückruf so festmachen?"), statt einzutragen. Ist die Antwort eindeutig die angebotene Zeit
    // (oder ein kurzes Ja darauf), bucht der Server sie vorab über denselben Weg (rueckruf_eintragen) — danach steht der
    // Termin im Kalender, STAND und Abschluss nennen ihn („… und Ihr Termin mit … steht heute um 10:20 Uhr").
    let vorabGebucht: string | null = null;
    // E-401: Nennt er einen festen Termin, ist es keine Bestätigung von Maras Zeitangebot (genanntAufWhatsApp schließt das aus).
    if (personId && !genannt) {
      const angebot = verlauf.find((v) => v.richtung === "raus" && v.status !== "fehler" && !v.vorlage && Number(v.id) < Number(ersteOffene.id)) ?? null;
      const bestaetigt = angebot && echteOffene.length === 1 && !heikelAnliegen(kunde) && !abstreitenArt(kunde)
        ? angeboteneZeitBestaetigt(kunde, { text: angebot.text, am: angebot.am }) : null;
      if (bestaetigt) {
        const vorab = await werkzeugAusfuehren("rueckruf_eintragen", { zeit: `${bestaetigt.datum} ${bestaetigt.zeit}`, anliegen: "Rückruf — er hat die angebotene Zeit bestätigt" }, {
          personId: Number(personId), leadId: leadId ? Number(leadId) : null, nummer, kunde, letzteDu: letzteDu[0] ?? "",
          nachrichtTag: kamInDerPause(neuesteRein.am, kp) ? berlinTag(new Date(neuesteRein.am)) : undefined, stufe: lage.linkLage.stufe,
        }).catch((e) => { console.error("[MARA-WA] Vorab-Rückruf:", String(e).slice(0, 160)); return null; });
        if (vorab?.ergebnis?.ok && vorab.ergebnis.so_schreiben) vorabGebucht = String(vorab.ergebnis.so_schreiben);
      }
    }

    // ── E-275 (02.10.2026): ZAHLENDER KUNDE FRAGT NACH KARTE ODER LINK → DER LINK GEHT SELBST RAUS ──
    // Fall 6120 / #2413 / #2003: „Karte nicht bekommen“ ging an einen Kollegen, der „nachsieht“. Fragt ein zahlender Kunde
    // (Stufe kunde) nach Karte, Konto oder Link (fragtNachKarte), schickt der Server den Link der Partnerbank vorab über
    // denselben Weg wie das Werkzeug (karteEinladungFuerPerson) — wie den bestätigten Rückruf (E-265 f06). Danach kennt
    // das Modell den Satz (SCHON ERLEDIGT) und ruft das Werkzeug nicht noch einmal. Nie bei Kündigung, Widerruf,
    // Beschwerde oder Bestreiten (fragtNachKarte und heikelAnliegen schließen das aus).
    let vorabKarte: Aktion | null = null;
    // Auch ein kurzes Ja auf Maras Frage „Soll ich Ihnen den Link unserer Partnerbank … schicken?“ (bausteinLimitFrage) —
    // jaAufKartenLink steht seit der E-401-Nachbesserung oben (beim genannten Termin).
    // E-401 (2/6): neben einem genannten Termin kein Link der Partnerbank in diesem Lauf (zurücknehmen, wie im Postfach) —
    // Nachbesserung: außer er fragt selbst danach (genanntZurueck).
    if (personId && !genanntZurueck && lage.linkLage.stufe === "kunde" && (fragtNachKarte(kunde) || jaAufKartenLink) && !heikelAnliegen(kunde) && !abstreitenArt(kunde)) {
      const r = await werkzeugAusfuehren("karte_link_schicken", {}, {
        personId: Number(personId), leadId: leadId ? Number(leadId) : null, nummer, kunde, letzteDu: letzteDu[0] ?? "", stufe: "kunde",
      }).catch((e) => { console.error("[MARA-WA] Vorab-Kartenlink:", String(e).slice(0, 160)); return null; });
      vorabKarte = r?.aktion ?? null;
    }

    // ── E-248: DIE WAHRHEIT AUS DEM KALENDER ────────────────────────────────
    // Fall K.: sein Termin (morgen 20:00, Florentine, von ihm selbst gebucht) stand im Kalender —
    // Mara kannte ihn nicht, bot neue Zeiten an und verwarf danach jede richtige Antwort.
    const mt = await import("./fiaon-mara-termin");
    const termin = personId ? await mt.kuenftigerTermin(Number(personId)).catch(() => null) : null;
    const verpasst = personId && !termin ? await mt.verpassterTermin(Number(personId)).catch(() => null) : null;
    const terminKurz: TerminKurz | null = termin ? { beginn: termin.beginn, vorname: termin.vorname, nenn: termin.nenn, kundenText: termin.kundenText, uhrzeit: termin.uhrzeit, herkunftText: mt.terminHerkunftText(termin.herkunft, termin.quelle) } : null;
    const letzteTeamZeile = verlauf.find((v) => v.richtung === "raus" && !v.vorlage && !istMara(v.von) && v.status !== "fehler") ?? null;
    // E-265 (29.09.2026, Justin „zum letzten Mal!!"): wessen Vorname nie allein im Kundentext steht.
    // Sein Betreuer und der Anrufer zuerst — heißen zwei im Team gleich, repariert die Nennform auf SEINEN.
    const mitarbeiter = await mitarbeiterListe().then((l) => {
      const vorn = [lage.betreuerN, lage.anruferN ? nennAus(lage.anruferN.nom) : null].filter(Boolean) as Nennform[];
      const istVorn = (m: MitarbeiterEintrag) => vorn.some((n) => n.vorname.toLowerCase() === m.vorname.toLowerCase() && n.nachname.toLowerCase() === m.nachname.toLowerCase());
      return [...l.filter(istVorn), ...l.filter((m) => !istVorn(m))];
    }).catch(() => [] as MitarbeiterEintrag[]);
    // E-253: seine Namen aus der Akte — für die Wand und (E-265) damit sein eigener Vorname kein „Mitarbeiter" ist.
    const kundeNamen = await empfaengerNamen({ personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null }).catch(() => [] as string[]);
    // E-265: Lage.betreuer/anrufer sind jetzt Nennformen („Herr Stripling") — vorher `.split(" ")[0]` = Vorname.
    const stand = standZeilen({
      termin: terminKurz, verpasst: verpasst ? { beginn: verpasst.beginn, vorname: verpasst.vorname, nenn: verpasst.nenn } : null,
      stufe: lage.linkLage.stufe, betreuer: lage.betreuer, anrufer: lage.anrufer, anruferBis: lage.anruferBis,
      zahlung: lage.zahlung ?? null, zahltag: lage.zahltag ?? null, mitarbeiter,
      letzteTeam: letzteTeamZeile ? { von: String(letzteTeamZeile.von ?? "Team"), am: letzteTeamZeile.am, text: String(letzteTeamZeile.text ?? "") } : null,
    });

    // ── E-265 (29.09.2026): JUSTINS ABSCHLUSS FÜR DIESEN MENSCHEN ──────────────
    // „Bei uns kommen Sie zu Ihrer Visa-Kreditkarte mit Ihrem Wunschlimit von X € — über den Rahmen entscheidet
    // die Partnerbank. Bitte begleichen Sie Ihre erste Monatsrate über Y €; sobald sie gebucht ist, schaltet das
    // System Sie frei, und ich vereinbare Ihren Termin mit Herrn Stripling. Passt Ihnen [Zeit]?" — fertig
    // eingesetzt: Ziel (kartenZiel), Betrag, Nennform, die Zeit = der nächste freie Platz dessen, der anruft
    // (bis Fr 02.10. der Vertreter, E-260), sein Link. A ohne Zahlung, Abbrecher und C ohne Rate (E-264).
    const stufeJetzt = lage.linkLage.stufe;
    // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 k03): Eine nur VERNEINTE Kündigung („Ich will nich kündigen!! hab
    // die rate nur vergessen, mach ich heute abend") ist kein heikles Anliegen — er bekommt seinen Abschluss mit Zahlungsseite.
    const pmwFrueh = await import("./fiaon-postmeister-werkzeuge");
    const kuendigungNurVerneint = nurVerneinteKuendigung(kunde, pmwFrueh.keinKuendigungsSatz);
    const heikelJetzt = (heikelAnliegen(kunde) && !kuendigungNurVerneint) || !!abstreitenArt(kunde);
    // E-265 Nachbesserung (29.09.2026, r5.mts): Unicode-Grenzen — `\b` vor „ü" griff nie, „Ich habe überwiesen" war kein A.
    const gemeldet = stufeJetzt === "zahlung_offen" && meldetZahlung(kunde);
    // E-265 Nachbesserung: auch bei Vertriebssperre (is_blocked, „kein Interesse") kein Abschluss an B/C/Abbrecher —
    // wie beim Auskunft-Angebot (Gegenlesen 24.09.).
    // E-401 (2/6): neben einem genannten Termin kein Abschluss (Justin: „einen guten Termin wünschen und sich zurücknehmen“).
    const abschlussArt: AbschlussArt | null = heikelJetzt || genanntZurueck || ((lage.werbesperre || lage.vertriebssperre) && stufeJetzt !== "kunde") ? null
      : stufeJetzt === "zahlung_gemeldet" || gemeldet ? "a" : abschlussArtAus(stufeJetzt, { rateOffen: !!lage.rate });
    // E-275 (02.10.2026): Hier holte der Server den nächsten freien Platz für „… und ich vereinbare Ihren Termin mit Herrn X.
    // Passt Ihnen [Zeit]?" — der Abschluss bittet jetzt ums Zahlen (Justin: „nicht immer sagen ‚Ich mache einen Termin mit
    // XY‘"). Freie Zeiten holt Mara nur noch mit freie_zeiten, wenn er telefonieren will.
    const betragAbschluss = abschlussArt === "rate" ? lage.rate?.betrag ?? null
      : abschlussArt === "b" ? lage.zahlung?.betrag ?? lage.ersteRate
      : abschlussArt === "a" ? lage.ersteRate : null;
    const mitAbschluss = terminKurz ? terminNenn(terminKurz) : lage.anruferN ?? (lage.betreuerN ? { nom: lage.betreuerN.nom, dat: lage.betreuerN.dat } : null);
    // ── E-265 Nachbesserung (29.09.2026, Verkauf): DIE EINWÄNDE AUS SEINER LAGE ──
    // Vorkasse/unseriös/„kein Kreditinstitut" → bausteinVorkasse (der Anruf OHNE Bedingung, „Sie überweisen selbst",
    // die Antwort auf seine Frage); „zu teuer" → das nächstkleinere Paket mit seinem Ziel. Vorher sah das Live-Modell
    // nur die alten Muster ohne Karte. Ein Vorkasse-Einwand der letzten drei Nachrichten bleibt einer (f01).
    const ohneAntragJetzt = stufeJetzt === "lead" || stufeJetzt === "antrag_offen";
    const letzteDrei = verlauf.filter((v) => v.richtung === "rein" && !autoSet.has(Number(v.id))).slice(0, 3).map((v) => String(v.text || "")).join("\n");
    const vorkasseVerlauf = /vorkasse|vorab|vorauszahlung|im\s+voraus|zahle\s+nichts\s+vor|zuerst\s+die\s+zahlung/i.test(letzteDrei);
    // E-275 Gegenprüfung (02.10.2026, Wahrheit und Recht): Fehlt im Antrag noch etwas, kommt der Link der Partnerbank NICHT
    // direkt nach der Buchung (die Einladung verlangt den vollständigen Antrag) — dann sagen Abschluss und Einwand-Muster es so.
    const antragLuecke: string[] = personId && (stufeJetzt === "zahlung_offen" || stufeJetzt === "zahlung_gemeldet")
      ? ((await import("./fiaon-konto-karte").then((m) => m.karteEinladungStand(Number(personId))).catch(() => null))?.fehlendeAngaben ?? [])
      : [];
    const vorkasseMuster = mitAntragLuecke(bausteinVorkasse({
      betrag: ohneAntragJetzt ? null : lage.zahlung?.betrag ?? lage.ersteRate, ziel: lage.kartenziel, mit: mitAbschluss,
      zeit: null, link: lage.link, jahresvertrag: lage.jahresvertrag,
      kreditFrage: fragtKreditinstitut(kunde), ohneAntrag: ohneAntragJetzt,
    }), antragLuecke);
    const kleiner = naechstKleineresPaket(lage.paketKey);
    const zuTeuerMuster = kleiner ? await (async () => {
      const { PACK_LIMITS } = await import("../routes/fiaon-antrag");
      const grenze = PACK_LIMITS[kleiner] ?? null;
      const ziel = grenze != null ? Math.min(lage.kartenziel?.euro ?? grenze, grenze) : null;
      return bausteinZuTeuerKarte({ paketKey: kleiner, zielEuro: ziel });
    })().catch(() => null) : null;
    const einwandJetzt: "vertrauen" | "teuer" | null = abschlussArt === "b" || abschlussArt === "abbrecher" || abschlussArt === "c"
      ? (einwandVertrauen(kunde) || (vorkasseVerlauf && !kaufSignal(kunde)) ? "vertrauen" : einwandSignal(kunde) ? "teuer" : null)
      : null;
    const abschlussFormel = !abschlussArt ? null
      : einwandJetzt === "vertrauen" ? vorkasseMuster
      : einwandJetzt === "teuer" && zuTeuerMuster ? zuTeuerMuster
      : mitAntragLuecke(bausteinAbschluss({
        kanal: "whatsapp", art: abschlussArt, ziel: lage.kartenziel, betrag: betragAbschluss,
        rateVom: abschlussArt === "rate" ? lage.rate?.faellig ?? null : null, mit: mitAbschluss,
        zeit: terminKurz ? terminKurz.kundenText ?? null : null, terminSteht: !!terminKurz,
        link: abschlussArt === "a" ? null : lage.link,
      }), antragLuecke);
    // „Was ist FIAON?" — die Karte vorn. Kunden und B kennen uns: dort keine Herkunftsfrage (E-264 „wer").
    const wasIstFiaon = fragtWasIstFiaon(kunde) && !lage.werbesperre && !genannt
      ? bausteinWasIstFiaon({ kanal: "whatsapp", stufe: stufeJetzt, ziel: lage.kartenziel, betreuer: lage.betreuerN, link: stufeJetzt === "lead" || stufeJetzt === "antrag_offen" ? lage.link : null })
      : null;
    // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 l01/l02): Fragt er nach seinem Limit, bekommt das Modell die feste
    // Antwort — seine Zahl als Ziel für die Visa-Kreditkarte, der Satz über die Bank, bei offener erster Rate Betrag und
    // Freischaltung, der Termin mit Nennform. Vorher: l01 ohne „Kreditkarte", l02 ohne die Zahl auf „Wie hoch?".
    // E-275 Endkontrolle (02.10.2026, Wahrheit): auch hier die Lücken-Fassung — bei offener erster Rate (B) trägt die
    // Antwort auf die Limit-Frage Justins Satz „… und Sie bekommen direkt den fertigen Link …“, und sichererSatz schickt
    // sie notfalls wörtlich. Mit unvollständigem Antrag wäre „direkt“ unwahr (wie bei vorkasseMuster und abschlussFormel).
    const limitFrage = fragtLimit(kunde) && lage.kartenziel && !heikelJetzt && !genannt && stufeJetzt !== "lead" && stufeJetzt !== "antrag_offen"
      ? mitAntragLuecke(bausteinLimitFrage({
        // E-275: `zeit` nur noch, wenn sein Termin schon steht (dann als Tatsache, kein Angebot).
        kanal: "whatsapp", ziel: lage.kartenziel, mit: mitAbschluss,
        zeit: terminKurz ? terminKurz.kundenText ?? null : null,
        betrag: abschlussArt === "b" ? betragAbschluss : null, link: abschlussArt === "b" ? lage.link : null,
        // E-275: beim zahlenden Kunden der nächste Schritt zur Karte — den Link der Partnerbank schickt Mara selbst.
        kartenSchritt: stufeJetzt === "kunde" ? (lage.einladungRaus ? "noch_einmal" : "schicken") : null,
      }), antragLuecke)
      : null;
    // E-265 Nachbesserung: nur bei „wer" — eine Datenfrage behält den belegten Herkunftshinweis (E-264, Art. 15 DSGVO).
    if (herkunftHinweisStreichen(abstArtJetzt, !!wasIstFiaon, stufeJetzt)) herkunftHinweis = null;
    // „Ich habe ja keine Karte bekommen — wozu zahlen?" (Justin 29.09.: „PUNKT AUS FERTIG!")
    // Nachbesserung (Recht): Beim zahlenden Kunden ist die Folgerate nicht der Grund — ohne „Das liegt daran".
    // E-275 (02.10.2026, Fall 6120): Beim zahlenden Kunden ist der eben geschickte Link der Partnerbank die Antwort (der Satz
    // aus dem Bereich Karte), die fällige Rate folgt — auch ohne fällige Rate, und auch auf „Wann kommt meine Karte?“.
    const kartenSatz = vorabKarte?.ok && vorabKarte.satz ? vorabKarte.satz : null;
    // E-275 Endkontrolle (02.10.2026, Wahrheit): bei offener ERSTER Rate dieselbe Lücken-Fassung wie im Abschluss — sonst
    // stünde hier „… Ihr Account ist sofort nach Zahlungseingang aktiv, und Sie bekommen direkt den fertigen Link …!“ auch
    // bei unvollständigem Antrag. antragLuecke ist nur bei zahlung_offen/zahlung_gemeldet gefüllt, der Kunde bleibt unberührt.
    const keineKarte = !genannt && (fragtKeineKarte(kunde) || !!kartenSatz) && ((stufeJetzt === "kunde" && (lage.rate || kartenSatz)) || stufeJetzt === "zahlung_offen")
      ? mitAntragLuecke(bausteinKeineKarte({
        kanal: "whatsapp", betrag: stufeJetzt === "kunde" ? lage.rate?.betrag ?? null : lage.zahlung?.betrag ?? lage.ersteRate,
        rateVom: stufeJetzt === "kunde" ? lage.rate?.faellig ?? null : null, erste: stufeJetzt === "zahlung_offen",
        ziel: lage.kartenziel, link: lage.link, altkunde: stufeJetzt === "kunde" && lage.altkunde, einladungRaus: lage.einladungRaus,
        mit: lage.anruferN ?? lage.betreuerN, kartenSatz: stufeJetzt === "kunde" ? kartenSatz : null,
      }), antragLuecke)
      : null;
    // ── KÜNDIGUNG: KLAR, FRAGE ODER GAR NICHT (E-265 Nachbesserung, 29.09.2026) ──
    // Nur SEINE Worte zählen — ein Vorlagen-Knopf („Bitte verschieben", „Bitte rufen Sie mich an") ist nie eine
    // Willenserklärung. Ein Ja nur auf Maras Rückfrage, wenn sie die NEUESTE ausgehende Nachricht ist (Vorlagen
    // eingeschlossen) und höchstens 24 Stunden alt. „klar" heißt: Das Werkzeug nähme es an (derselbe Wille).
    const kundeFrei = echteOffene.filter((v) => !v.knopf).slice().reverse().map((v) => String(v.text || "")).join("\n").trim();
    const nurKnoepfe = echteOffene.length > 0 && echteOffene.every((v) => !!v.knopf);
    const lr = verlauf.find((v) => v.richtung === "raus" && v.status !== "fehler" && Number(v.id) < Number(ersteOffene.id)) ?? null;
    const letzteRaus: LetzteRaus | null = lr ? { text: lr.text ?? null, am: lr.am, vorlage: lr.vorlage ?? null, vonMara: istMara(lr.von) } : null;
    const pmw = await import("./fiaon-postmeister-werkzeuge");
    const { istWillenserklaerung } = await import("./fiaon-kuendigung");
    const unbezahltJetzt = stufeJetzt !== "kunde" && stufeJetzt !== "beendet";
    // E-265 Nachbesserung 2 (01.10.2026): ZWEI SCHRITTE. Seine Nachrichten VOR Maras verbindlicher Rückfrage (72 Stunden)
    // sind der Anlass (a) — dort muss er die Kündigung selbst angesprochen haben, und dort darf kein Bestreiten stehen.
    const rueckfrageOffen = !!letzteRaus && !letzteRaus.vorlage && letzteRaus.vonMara !== false && !!verbindlicheRueckfrage(letzteRaus.text);
    const lrAm = lr ? new Date(lr.am).getTime() : 0;
    const kuendigungAnlass = lr ? verlauf.filter((v) => v.richtung === "rein" && !v.knopf && Number(v.id) < Number(lr.id) && new Date(v.am).getTime() > lrAm - 72 * 3_600_000)
      .slice().reverse().map((v) => String(v.text || "")).join("\n").trim() : "";
    const bestreitetFn = (t: string) => pmw.bestreitetKuendigung(t, abstreitenArt);
    const kuendigungJetzt: KuendigungEinordnung | null = personId ? kuendigungEinordnen(kundeFrei, {
      wille: (t) => pmw.kuendigungsWille(t, { unbezahlt: unbezahltJetzt, formlos: !lage.jahresvertrag, istWillenserklaerung }),
      keinSatz: pmw.keinKuendigungsSatz,
      ruecknahme: pmw.kuendigungRuecknahme,
      bestreitet: bestreitetFn,
      jaAufRueckfrage: !nurKnoepfe && jaAufKuendigungsAngebot(kundeFrei, letzteRaus),
      rueckfrageOffen: rueckfrageOffen && !nurKnoepfe,
      anlass: kuendigungAnlass,
      maraSprachVonKuendigung: !!letzteRaus && !letzteRaus.vorlage && letzteRaus.vonMara !== false && maraBotKuendigungAn(letzteRaus.text),
    }) : null;
    // Hat ER (offen oder in den 72 Stunden vor Maras letzter Nachricht) vom Aussteigen gesprochen? Sonst darf Mara die
    // Rückfrage nie stellen (Kündigung oder Storno bietet sie nie von sich aus an).
    // E-372: Bei einer UNBEZAHLTEN Bestellung ist auch ein Widerruf ein Ausstieg (Storno — Mara macht es selbst).
    const kuendigungThema = ausstiegThema(`${kundeFrei}\n${kuendigungAnlass}`, unbezahltJetzt);
    // Zahlungsruhe über den Verlauf (E-265, #1401): Kündigung, Widerruf, Stopp oder Beschwerde in den letzten 24 Stunden.
    const tagZurueck = Date.now() - 24 * 3_600_000;
    // Nur Kündigung, Widerruf, Storno, Beschwerde (Anwalt, Verbraucherzentrale) und Stopp — ein früheres Abstreiten
    // regelt E-264 selbst (sonst verlöre „Was macht diese Firma?" danach jede Antwort mit Betrag, Befund P1).
    // Nachbesserung (29.09.2026, r2.mts): „Ich will nicht kündigen, ich zahle morgen" oder „Bitte nicht stornieren"
    // ist keine Erklärung — nur ein Satz, der nicht verneint oder bedingt ist, schaltet die Ruhe ein.
    const ruhe24 = verlauf.some((v) => new Date(v.am).getTime() > tagZurueck && (
      (v.richtung === "rein" && ((!v.knopf && heikelAnliegen(String(v.text ?? "")) && ruheErklaerung(String(v.text ?? ""), pmw.keinKuendigungsSatz)) || stoppWunsch(String(v.text || v.knopf || ""))))
      || (v.richtung === "raus" && !v.vorlage && istMara(v.von) && /kündigungswunsch|kündigung ist[^.!?]{0,30}eingegangen|widerruf ist[^.!?]{0,30}eingegangen|widerruf[^.!?]{0,20}weiter/i.test(String(v.text ?? "")))));

    // E-246: Kam die älteste offene Nachricht vor mehr als drei Stunden (typisch:
    // aus der KI-Pause), bekommt Mara ihren Zeitpunkt ausdrücklich — sonst legt
    // sie „heute um 17 Uhr" auf den heutigen Tag.
    const ersteAm = new Date(ersteOffene.am);
    const zeitHinweis = Date.now() - ersteAm.getTime() > 3 * 3_600_000
      ? `ACHTUNG ZEIT: Seine offene Nachricht kam ${tagUndUhrzeit(ersteAm)} — relative Zeitangaben des Kunden („heute", „morgen", „gleich", „nachmittags") beziehen sich auf DIESEN Zeitpunkt, nicht auf jetzt. Ist die genannte Zeit schon vorbei, trag nichts ein: frag ihn nach einer neuen Zeit${personId ? " (freie_zeiten)" : ""}. Entschuldige die späte Antwort in einem kurzen Halbsatz.`
      : "";
    // E-275 (02.10.2026): Will ER telefonieren? (Worte oder der Knopf „Bitte rufen Sie mich an“) — nur dann bietet Mara
    // von sich aus einen Anruf an (verkaufsPruefung, anrufOk). Uhrzeiten in seiner Nachricht zählen mit.
    const anrufGewuenscht = /\b(?:anruf\w*|rückruf\w*|zurückruf\w*|telefon\w*|anrufen|zurückrufen|sprechen|termin\w*|persönlich|mensch|mitarbeiter\w*|berater\w*|betreuer\w*|call)\b|\bruf\w*\s+(?:mich|sie)\b/i.test(kunde)
      || echteOffene.some((v) => /rufen\s+sie\s+mich\s+an|verschieben|vormittags|nachmittags|abends/i.test(String(v.knopf ?? "")))
      || uhrzeitenIn(kunde).length > 0;
    // ── E-372: „HABE BEZAHLT“ — DER BANKABGLEICH SAGT, OB DAS GELD DA IST (eingangOffenSql, wie das Postfach) ──
    // Vorher eine Aufgabe „bitte Zahlungseingang prüfen“. Jetzt weiß Mara es selbst: Liegt ein passender, noch ungebuchter
    // Eingang auf dem Konto, ist er angekommen (die Karte „Geld eingegangen“ bucht ihn mit einem Klick); sonst bittet sie
    // um den Beleg. Im Zweifel (Abfrage scheitert) sagt sie nichts über den Eingang.
    let zahlungsHinweis: string | null = null;
    // ── E-401 (3/6, 19.10.2026): MARA SUCHT DIE ZAHLUNG SELBST (zahlung_suchen, derselbe Weg wie im Postfach) ──
    // Der Server sieht im Bankbuch nach (alle Eingänge der letzten 21 Tage, fiaon-mara-zahlung-suchen.ts): schon gebucht →
    // Datum und Betrag; gefunden, nicht gebucht → Vorschlag auf die Karte „Geld eingegangen“ (ein Mensch bucht, nie Mara)
    // und „Ich habe Ihre Überweisung … gefunden, wir ordnen sie jetzt zu“; nichts → Beleg erbitten, nicht doppelt zahlen.
    // Scheitert die Suche, gilt der E-372-Abgleich unten wie bisher.
    let zahlungGesucht: import("./fiaon-mara-zahlung-suchen").ZahlungsLage | null = null;
    if (personId && waSelbstThema(kundeFrei) === "bezahlt") {
      const zsM = await import("./fiaon-mara-zahlung-suchen");
      zahlungGesucht = await zsM.zahlungSuchenBehandeln({ personId: Number(personId), kanal: "whatsapp", quelle: `WhatsApp #${neuesteRein.id}` })
        .catch(() => null);
    }
    if (zahlungGesucht) zahlungsHinweis = zahlungGesucht.hinweis;
    else if (personId && waSelbstThema(kundeFrei) === "bezahlt") {
      const eingang = await (async () => {
        try {
          const { eingangOffenSql } = await import("./fiaon-zahlung-unverbucht");
          const z = (await sqlPool.unsafe(`SELECT 1 AS da FROM (${eingangOffenSql()}) e WHERE e.person_id = $1 LIMIT 1`, [Number(personId)])) as any[];
          return z.length > 0;
        } catch { return null; }
      })();
      zahlungsHinweis = eingang === true
        ? "SEINE ZAHLUNG IST AUF UNSEREM KONTO ANGEKOMMEN (noch nicht gebucht): Danke ihm — sie ist da und wird gerade seiner Bestellung zugeordnet; danach geht es automatisch weiter. Keine Zahlungsbitte, kein Zahlungslink, kein Kollege, kein Termin."
        : eingang === false
          ? "ER SAGT, ER HAT BEZAHLT — auf unserem Konto ist dazu noch kein Eingang zu sehen. Danke ihm ehrlich, ohne Vorwurf: Eine Überweisung braucht oft ein bis zwei Werktage. Bitte ihn um den Beleg (Datum, Betrag, Verwendungszweck) und, in seinem Banking nachzusehen, ob sie mit seinem Verwendungszweck ausgeführt wurde — sobald sie eingeht, ordnet das System sie zu. Keine Zahlungsbitte, kein Kollege, kein Termin."
          : null;
    }
    // ── E-401 (4/6, 19.10.2026): ANSCHRIFT, E-MAIL, TELEFON — DER SERVER ÄNDERT SELBST (angaben_aendern, wie im Postfach) ──
    // Nur von der gespeicherten Nummer: Anschrift und Telefon sofort über den Speicherweg der Akte (Telefon mit Hinweis-Mail),
    // die E-Mail-Adresse erst nach dem Klick auf den Bestätigungslink an die NEUE Adresse. Von einer anderen Nummer: nichts
    // geändert — ein Nummernwechsel geht als Karte an Justin (Leitung). Name, Geburtsdatum, Bank, Ausweis: nie Mara (Karte).
    let angabenLage: import("./fiaon-mara-angaben-aendern").AngabenLage | null = null;
    if (personId && angabenWunsch(kundeFrei)) {
      const agM = await import("./fiaon-mara-angaben-aendern");
      angabenLage = await agM.angabenAendernBehandeln({ personId: Number(personId), kanal: "whatsapp", kundeText: kundeFrei, nummer, quelle: `WhatsApp #${neuesteRein.id}` })
        .catch(() => null);
      if (angabenLage && !angabenLage.wiederholt) {
        await protokolliere({ art: "angaben", ok: !angabenLage.mensch, nummer, personId: Number(personId), leadId: leadId ? Number(leadId) : null,
          text: angabenLage.handlung.slice(0, 600), daten: { felder: angabenLage.daten.felder, verboten: angabenLage.verboten, absender_ok: angabenLage.absenderOk } });
      }
    }
    // ── E-372: „KANN NICHT ZAHLEN“ — DER VORHANDENE WEG IST DIE RATENPAUSE (fiaon-ratenpause.ts) ──
    // ── E-372: WIDERRUF EINER UNBEZAHLTEN BESTELLUNG = STORNO — Mara fragt verbindlich und bucht nach seinem Ja selbst ──
    const widerrufStornoHinweis = personId && unbezahltJetzt && stufeJetzt !== "lead" && stufeJetzt !== "antrag_offen" && waWiderruf(kundeFrei) && !kuendigungJetzt
      ? `ER WIDERRUFT SEINE UNBEZAHLTE BESTELLUNG — das ist ein Storno, den du selbst aufnimmst: kurz verstehen, nicht umstimmen, keine Zahlungsbitte, und als einzige Frage deiner Nachricht wörtlich: „${STORNO_RUECKFRAGE}“ — nach seinem klaren Ja kuendigung_aufnehmen.`
      : null;
    const pauseHinweis = personId && stufeJetzt === "kunde" && lage.rate && kannNichtZahlen(kundeFrei)
      ? "ER KANN GERADE NICHT ZAHLEN: keine Zahlungsbitte, kein Druck. Biete ihm von dir aus an, seine Raten einmal um einen Monat zu verschieben (genau so: „Soll ich Ihre Raten einmal um einen Monat verschieben? Bis dahin bekommen Sie keine Erinnerung.“). Sagt er Ja — oder bittet er selbst um eine Pause —, rufst du ratenpause_setzen und schreibst so_schreiben."
      : null;
    // ── E-372: ZUSAGEN NUR, WENN EIN WERKZEUG SIE EINLÖST ──
    // „Herr X meldet sich“, „ich gebe Bescheid“, „unser Team prüft das“ ist eine harte Wand — außer er will telefonieren
    // (dann trägt Mara den Rückruf ein, oder der Betreuer ruft an), ein Termin steht, Justin entscheidet ohnehin (offene
    // Karte), ein Ausschluss des Kartenwegs liegt Justin vor oder die Herkunft seiner Nummer ist nicht belegt.
    const zusageOk = anrufGewuenscht || !!terminKurz || !!verpasst || offeneKarten.length > 0 || !!herkunftHinweis
      // E-401 (4/6): Den Änderungswunsch, den Mara nie selbst erledigt, legt der Server Justin vor (Karte, unten).
      || !!angabenLage?.mensch
      || (!!vorabKarte && !vorabKarte.ok && !["nicht_bereit", "ohne_mail", "adresse_gesperrt", "nicht_kunde"].includes(String(vorabKarte.kartenArt)));
    const zusageNamen = [lage.anruferN?.nom, lage.betreuerN?.nom, lage.betreuerN?.vorname, lage.anrufer, lage.betreuer, terminKurz ? terminNenn(terminKurz).nom : null]
      .filter(Boolean) as string[];
    const text = auftrag({
      kiHinweis, zeitHinweis,
      name: namen.voll,
      // E-260: `betreuer` im Auftrag = wer anruft bzw. Bescheid bekommt (bei Abwesenheit der Vertreter);
      // der feste Betreuer geht getrennt an die Persona.
      // E-265: Nennformen („Herr Stripling" / „Herrn Stripling"), nie der Vorname.
      werkzeuge: !!personId, betreuer: lage.anruferN, jetzt: `${jetzt} (heute = ${heuteIso})`,
      fester: lage.betreuerN, anruferBis: lage.anruferBis,
      abschluss: abschlussFormel && abschlussArt ? {
        art: abschlussArt, satz: abschlussFormel, ziel: lage.kartenziel,
        zeitHerkunft: terminKurz ? "sein Termin im Kalender" : null,
      } : null,
      wasIstFiaon, keineKarte, limitFrage, kuendigung: kuendigungJetzt, kuendigungUnbezahlt: unbezahltJetzt,
      einwandMuster: { vorkasse: vorkasseMuster, zuTeuer: zuTeuerMuster },
      // E-401 (2/6): neben einem genannten Termin kein Verkaufsteil und ein eigenes Ziel (zurücknehmen).
      wer: lage.wer, lage: lage.lage, ziel: genanntZurueck ? GENANNT_ZIEL : lage.ziel, link: lage.link, verkaufen: lage.verkaufen && !genannt, auskunft,
      gedaechtnis: personId ? await gedaechtnisText(Number(personId)).catch(() => "") : "",
      teamNotizen: gtM.teamNotizenText(teamNotizenWa),
      wissen: wissenFuerWhatsApp(),
      hausanweisung: await anweisungBlock("whatsapp").catch(() => ""),
      stand, hinweise: [
        // E-401 (2/6): was der Server mit dem genannten Termin getan hat — vor allem anderen.
        ...(genannt?.hinweis ? [genannt.hinweis] : []),
        // E-401 (4/6): was der Server mit seinem Änderungswunsch (Anschrift, E-Mail, Telefon) getan hat.
        ...(angabenLage ? [angabenLage.hinweis] : []),
        // E-408 (Scheibe 3): War Maras letzte Nachricht die Frage nach dem Ja zum Anruf, ist sein „Ok“ KEINE Zustimmung
        // zu einem Schritt, den sie angeboten hat (die Frage hängt nur an Antworten ohne eigene Frage) — dafür der
        // Satz aus jaHinweisFuerMara.
        ...(jaFrageZuletzt ? urteil.hinweise.filter((h) => !/es ist seine Zustimmung/.test(h)) : urteil.hinweise),
        ...(jaHinweis ? [jaHinweis] : []),
        ...(herkunftHinweis ? [herkunftHinweis] : []),
        // E-265 Schluss-Nachbesserung (f06): vom Server schon eingetragen — nicht noch einmal fragen oder buchen.
        ...(vorabGebucht ? [`SCHON EINGETRAGEN: Er hat die angebotene Zeit bestätigt, der Rückruf steht im Kalender — „${vorabGebucht}" Frag NICHT noch einmal und ruf rueckruf_eintragen nicht erneut. Bestätige den Termin in einem Satz und schließ mit deinem Abschluss (Betrag, Zahlungsseite) ab.`] : []),
        // E-275 (02.10.2026): der Link der Partnerbank ist vom Server schon geschickt — sag es ihm, kein Kollege, kein Termin.
        ...(vorabKarte?.ok && vorabKarte.satz ? [`SCHON ERLEDIGT: Du hast ihm den Link unserer Partnerbank eben selbst geschickt. Sag es ihm in eigenen Worten mit genau diesen Fakten: „${vorabKarte.satz}" — danach (falls fällig) seine Rate mit Zahlungsseite. Kein Kollege, kein Termin, keine Zusage der Bank.`] : []),
        // E-372: Angaben und E-Mail-Adresse trägt Mara selbst ein (angaben_eintragen) — vorher „mensch true“.
        ...(entscheidungsHinweis ? [entscheidungsHinweis] : []),
        ...(zahlungsHinweis ? [zahlungsHinweis] : []),
        ...(pauseHinweis ? [pauseHinweis] : []),
        ...(widerrufStornoHinweis ? [widerrufStornoHinweis] : []),
        ...(vorabKarte && !vorabKarte.ok && vorabKarte.kartenArt === "nicht_bereit" && vorabKarte.satz ? [`DER LINK DER PARTNERBANK WARTET AUF ANGABEN: „${vorabKarte.satz}" — frag ihn genau danach; schickt er sie, trägst du sie selbst mit angaben_eintragen ein (dann geht der Link raus, sobald alles da ist).`] : []),
        // E-275 Gegenprüfung (Wahrheit und Recht): unvollständiger Antrag — nach der Buchung kommt der Link NICHT direkt.
        ...(antragLuecke.length ? [`IN SEINEM ANTRAG FEHLT NOCH: ${antragLuecke.join(", ")}. Der Link unserer Partnerbank geht erst raus, wenn das eingetragen ist — nie „direkt nach der Buchung der Link“; sag es wie in DEIN ABSCHLUSS und bitte ihn um ${antragLuecke.length === 1 ? "diese Angabe" : "diese Angaben"}.`] : []),
        ...(vorabKarte && !vorabKarte.ok && vorabKarte.kartenArt === "ohne_mail" ? [`FÜR DEN LINK DER PARTNERBANK FEHLT SEINE E-MAIL-ADRESSE — frag ihn freundlich danach (dorthin geht der Link für seinen Kartenantrag); schickt er sie, trägst du sie selbst mit angaben_eintragen ein — dann geht der Link raus.`] : []),
        // E-IT-B (08.10.2026): Adresse gesperrt — nichts ging raus; nach der richtigen Adresse fragen.
        // E-372: Die neue Adresse trägt Mara selbst ein (angaben_eintragen, derselbe Weg wie die Akte), der Link geht neu raus.
        ...(vorabKarte && !vorabKarte.ok && vorabKarte.kartenArt === "adresse_gesperrt" && vorabKarte.satz ? [`AN SEINE E-MAIL-ADRESSE KOMMT NICHTS AN — der Link ging NICHT raus: „${vorabKarte.satz}" — frag ihn nach seiner richtigen E-Mail-Adresse; nennt er sie, trägst du sie mit angaben_eintragen ein (dann geht der Link an die neue Adresse). Kein „Spam-Ordner“, keine Zusage, dass der Link schon da ist.`] : []),
        // E-372: Ein Ausschluss (Kündigung, Sperre, DSGVO …) entscheidet Justin — eine Karte, keine Aufgabe beim Betreuer.
        ...(vorabKarte && !vorabKarte.ok && !["nicht_bereit", "ohne_mail", "adresse_gesperrt"].includes(String(vorabKarte.kartenArt)) ? [`DEN LINK DER PARTNERBANK KANNST DU IHM HIER NICHT SELBST SCHICKEN (Grund intern) — sag freundlich und ohne Grund, dass unsere Geschäftsführung sich das ansieht und er dazu Bescheid bekommt; der Server legt es ihr vor. Keine Zusage, dass der Link kommt, keine Zeit, nichts zur Karte (E-275 Endkontrolle: bei einem Ausschluss entscheidet der Mensch).`] : [])],
      land: lage.land, stufe: lage.linkLage.stufe,
      // E-275: der Link der Partnerbank als Werkzeug — nur beim zahlenden Kunden, und nicht, wenn der Server ihn eben geschickt hat.
      kartenWerkzeug: !!personId && stufeJetzt === "kunde" && !vorabKarte && !genanntZurueck,
      // E-458: Rückruf „bei ARAS“ nur, wenn ARAS gerade Rückrufe annimmt (in Stufe 0 nie) und es eine Person gibt (Global-Kunden
      // beantwortet Mara ohnehin nicht, E-272).
      arasRueckruf: !!personId && (await import("./fiaon-aras-wunsch").then((m) => m.arasRueckrufBereit()).catch(() => ({ bereit: false }))).bereit,
      verlauf: verlauf.slice().reverse()
        .filter((v) => v.status !== "fehler")
        .map((v) => {
          // E-246: Jede Kundennachricht mit Tag und Uhrzeit (Berlin) — „KUNDE (So 16:00): …".
          // E-248: auch DU, TEAM (mit Vornamen) und VORLAGE mit Zeit — „TEAM Florentine (Mo 10:02): …".
          const zeit = kurzZeit(new Date(v.am));
          const wer = v.richtung === "rein"
            ? `KUNDE (${zeit})${autoSet.has(Number(v.id)) ? " [automatische Antwort seines Telefons, kein Mensch]" : ""}`
            : v.vorlage ? `VORLAGE (${zeit})` : istMara(v.von) ? `DU (${zeit})` : `TEAM ${teamName(v.von, mitarbeiter)} (${zeit})`;
          const inhalt = String(v.text || (v.vorlage ? vorlagenKopf(String(v.vorlage)) : MEDIEN[String(v.typ)] ?? (v.typ && v.typ !== "text" ? `(${v.typ})` : ""))).replace(/\s+/g, " ").slice(0, 600);
          return `${wer}: ${inhalt}`;
        })
        .join("\n"),
    });

    // E-264: Ohne abgeschickten Antrag ist es nie „seine Zahlung" — das Ziel nennt die Zahlungsseite dort nur als Verbot.
    const zahlungslage = lage.linkLage.stufe !== "lead" && lage.linkLage.stufe !== "antrag_offen"
      && /Account aktiv|Eingang wird geprüft|Zahlungsseite/.test(lage.ziel);
    const e = await entwerfen(text, {
      kunde, kontext, letzteDu: letzteDu.slice(0, 2), verkaufen: lage.verkaufen, verlaufText, zahlungslage, link: lage.link,
      // E-275: Beim zahlenden Kunden ist der Link der Partnerbank Service (karte_link_schicken), bei A kommt er nach der Buchung.
      bankLinkOk: abschlussArt === "a" || stufeJetzt === "kunde",
      // E-275 (02.10.2026): Ein Anruf ist hier richtig, wenn er telefonieren will, ein Anruf ausfiel oder ansteht, es um
      // eine Zeit geht oder der Fall heikel ist — sonst ist ein Terminangebot oder „X meldet sich“ ein weicher Mangel.
      // Ließ sich der Link der Partnerbank nicht schicken (Ausschluss, Fehler), IST es ein Fall für einen Menschen.
      anrufOk: anrufGewuenscht || !!verpasst || !!terminKurz || heikelJetzt || !!kuendigungJetzt || !!vorabGebucht || !!genannt
        || (!!vorabKarte && !vorabKarte.ok && !["nicht_bereit", "ohne_mail"].includes(String(vorabKarte.kartenArt)))
        || /\b(?:anruf\w*|rückruf\w*|ruft|anrufen|termin\w*|telefon\w*)\b/i.test(letzteDu[0] ?? ""),
      auskunftAngebot: auskunftWerkzeugAn(auskunft), werbesperre: lage.werbesperre,
      // E-253: seine Namen aus der Akte, getrennt und zusammen — nie als „du" gewertet
      namen: kundeNamen,
      // E-265: Mitarbeiter-Vornamen hart, Justins Abschluss weich
      mitarbeiter, abschluss: abschlussArt ? { art: abschlussArt, ziel: lage.kartenziel, betrag: betragAbschluss, kontext: letzteDrei,
        teuer: einwandJetzt === "teuer" && zuTeuerMuster && kleiner ? { paket: paketName(kleiner), satz: zuTeuerMuster } : null } : null,
      limitFrage: limitFrage && lage.kartenziel ? { satz: limitFrage, zahl: euroGanz(lage.kartenziel.euro) } : null,
      // E-372: Zusagen nur, wenn ein Werkzeug sie einlöst — sonst eine harte Wand (zweiter Entwurf).
      zusageVerboten: zusageOk ? null : { namen: zusageNamen },
      bekannt: {
        links: [lage.link ?? "", ...(auskunft?.offenLink ? [auskunft.offenLink] : [])].filter(Boolean),
        auskunftPreise: auskunft && auskunftImGespraech
          ? [auskunft.preisText, ...(auskunft.offenBetrag ? [auskunft.offenBetrag] : []), ...(auskunft.mitAbo ? [euroText(AUSKUNFT_PREISE_CENTS[auskunft.art ?? "privat"].einzeln)] : [])]
          : null,
        land: auskunftImGespraech ? auskunft?.land ?? null : null,
        termin: terminKurz ? { uhrzeit: terminKurz.uhrzeit ?? "", vorname: terminKurz.vorname } : null,
        // E-401 (2/6): die Uhrzeit des eingetragenen bzw. stehenden genannten Termins ist wahr.
        zeiten: genannt?.uhrzeitTermin ? [genannt.uhrzeitTermin] : [],
        // E-372: Liegt Recht, Widerruf, Geld zurück, Löschen, Bestreiten oder eine Rücknahme offen bei Justin, keine Zahlungsbitte.
        // E-401 (2/6): neben einem genannten Termin ebenso (Postfach: genannt.ruhe).
        ruhe: ruhe24 || karteRuhe(offeneKarten) || genanntZurueck,
        ruheGrund: genanntZurueck && !ruhe24 && !karteRuhe(offeneKarten) ? "einen Termin, den er hat (er nennt ihn gerade — Justin: „sich zurücknehmen“)" : null,
        // E-265 Nachbesserung: Kündigung und „Kulanz" nur, wenn es stimmt (handlungsPruefung).
        gekuendigt: lage.gekuendigt, jahresvertrag: lage.jahresvertrag,
        beendetMitRate: lage.linkLage.stufe === "beendet" && !!lage.linkLage.ratenReferenz,
        // E-265 Nachbesserung 2 (01.10.2026): „danach kommt nichts mehr" nur, wenn es stimmt; die Form der Rückfrage.
        nichtsMehr: lage.nichtsMehr !== false, kuendigung: kuendigungJetzt, kuendigungThema,
        // E-265 Schluss-Nachbesserung: die Form der Rückfrage (Storno bei unbezahlter Bestellung) und die verneinte Kündigung (k03).
        unbezahlt: unbezahltJetzt, kuendigungVerneint: kuendigungNurVerneint,
      },
      linkLage: { ...lage.linkLage, ...(auskunft?.offenLink ? { auskunftLink: auskunft.offenLink } : {}) },
      land: lage.land,
      erlaubt: {
        // E-265 Nachbesserung (f02): ohne „Genau," — das Modell hängte den Satz hinter andere, dort beantwortet „Genau" nichts.
        termin: terminKurz ? `${terminKurz.kundenText} mit ${terminNenn(terminKurz).dat} — „${terminNenn(terminKurz).nom} ruft Sie ${terminKurz.kundenText} an."` : null,
        zeiten: [...(terminKurz?.uhrzeit ? [terminKurz.uhrzeit] : []), ...(genannt?.uhrzeitTermin ? [genannt.uhrzeitTermin] : [])],
        link: lage.link,
      },
      // E-401 (2/6): der genannte Termin — zurücknehmen, „eingetragen“ nur, wenn eingetragen, mit seiner Uhrzeit.
      genannt: genannt ? {
        eingetragen: genannt.eingetragen || genannt.erkennung.art === "steht_schon",
        uhrzeitTermin: genannt.eingetragen || genannt.erkennung.art === "steht_schon" ? genannt.uhrzeitTermin : null,
        satz: genannt.satz,
        // E-401 Nachbesserung: fragt er selbst nach Karte/Link/Zahlung, sind Kartenwort und Link seine Bitte, kein Verkauf.
        verkaufErlaubt: !genannt.zurueck,
      } : null,
      // E-401 (3/6): „gebucht/angekommen/gefunden“ nur, was zahlung_suchen im Bankbuch gefunden hat.
      zahlung: zahlungGesucht ? { ergebnis: zahlungGesucht.ergebnis, frueher: zahlungGesucht.frueher } : null,
      // E-401 (4/6): nie „geändert“, was der Server nicht gespeichert hat; die E-Mail-Adresse erst nach dem Klick.
      angaben: angabenLage ? { kanal: "whatsapp", ergebnisse: angabenLage.ergebnisse, verboten: angabenLage.verboten, geheim: angabenLage.geheim } : null,
    }, personId ? {
      personId: Number(personId), leadId: leadId ? Number(leadId) : null, nummer,
      kunde, letzteDu: letzteDu[0] ?? "", auskunft,
      // E-265 Nachbesserung: nur seine eigenen Worte (ohne Knöpfe) und die neueste ausgehende Nachricht davor.
      kundeFrei, letzteRaus, kuendigungAnlass,
      // Nachbesserung 27.09. (E-246): nur bei einer Pause-Nachricht, und der Tag
      // der NEUESTEN offenen Nachricht (schrieb er heute neu, gilt sein Heute).
      nachrichtTag: kamInDerPause(neuesteRein.am, kp) ? berlinTag(new Date(neuesteRein.am)) : undefined,
      stufe: lage.linkLage.stufe,
      // E-275: Hat der Server den Link der Partnerbank eben geschickt, fällt das Werkzeug weg (kein zweiter Versand im Lauf).
      kartenSchon: !!vorabKarte,
      // E-401 (2/6): neben einem genannten Termin kein Kartenlink und kein Auskunft-Angebot.
      ohneVerkauf: genanntZurueck,
      // E-401 (4/6): Felder, die der Server eben bearbeitet hat — angaben_eintragen fasst sie in diesem Lauf nicht an.
      angabenServer: angabenLage ? angabenLage.ergebnisse.map((x) => x.feld) : [],
    } : null);
    let roh = e.roh;
    let antwort = e.antwort;
    const funde = e.funde;
    let mensch = roh?.mensch === true;
    let uebergabe = String(roh?.uebergabe ?? "").trim();
    const nurBestaetigung = echteOffene.length > 0 && echteOffene.every((v) => istBestaetigung(v.text || v.knopf));
    const offenerText = echteOffene.map((v) => String(v.text ?? "")).join(" ");
    let klasse: AufgabenKlasse = aufgabenKlasse(offenerText, uebergabe);
    let klasseFest = false;

    // KI fällt aus (24.09. 07:00: OpenAI-Guthaben leer): erst sechs Minuten still weiterversuchen —
    // ein kurzer Ausfall bleibt so unsichtbar. Danach EIN Rückfallsatz und ein Mensch; steht er schon
    // da, kein zweiter — das Gespräch bleibt offen, und Mara antwortet richtig, sobald die KI zurück ist.
    // E-246: Traf die Denkrunde auf die KI-Pause (oder löste sie aus), bleibt alles liegen —
    // kein Rückfallsatz, keine Aufgabe. Den Alarm an Justin schickt fiaon-ki-pause.ts genau einmal.
    if (istKiPause(e.kiFehler)) {
      // Nachprüfung 27.09.: Traf die Pause erst die zweite Denkrunde (oder eine
      // spätere Werkzeugrunde), sind echte Handlungen schon geschehen — z. B. ein
      // Rückruf im Kalender. Der Kunde bekommt nichts (keine KI-Antwort in der
      // Pause), aber der Betreuer erfährt es EINMAL, damit er kurz selbst
      // bestätigen kann. Nach dem Aktivieren beantwortet Mara die Frage regulär;
      // rueckruf_eintragen erkennt den schon gebuchten Termin.
      // Nur, was außerhalb des Gesprächs schon wirkt — Zeiten, Links und Angebote sind nur vorbereitet.
      // E-372: auch eine gesetzte Ratenpause und eingetragene Angaben wirken schon außerhalb des Gesprächs.
      const echt = e.aktionen.filter((x) => x.ok && (x.werkzeug === "rueckruf_eintragen" || x.werkzeug === "zahlungszusage_merken" || x.werkzeug === "ratenpause_setzen" || x.werkzeug === "angaben_eintragen" || (x.werkzeug === "auskunft_anbieten" && x.art === "bestellt")));
      const k = `pause-${nummer}-${neuesteRein.id}`;
      if (echt.length && !kiAufgabeGemeldet.has(k)) {
        kiAufgabeGemeldet.add(k);
        const was = echt.map((x) => x.werkzeug === "rueckruf_eintragen" && x.termin ? `Rückruf eingetragen (${x.termin.text})`
          : x.werkzeug === "zahlungszusage_merken" ? "Zahlungszusage festgehalten"
          : x.werkzeug === "ratenpause_setzen" ? "eine Ratenpause gesetzt"
          : x.werkzeug === "angaben_eintragen" ? "seine Angaben eingetragen"
          : x.werkzeug === "auskunft_anbieten" ? "eine Bonitätsauskunft bestellt"
          : x.werkzeug).join(" · ");
        await aufgabeFuerMenschen(nummer, personId, leadId, `Mara hat ${was}, konnte wegen der KI-Pause aber nicht antworten — der Kunde weiß es noch nicht. Bitte kurz selbst bestätigen. Letzte Nachricht: „${frage.slice(0, 200)}"`, false, "ki");
      }
      return { gesendet: false, grund: "KI pausiert — die Nachricht wartet, bis die KI wieder aktiv ist." };
    }
    if (e.kiFehler) {
      // E-246: Die Geduld zählt ab dem späteren von Nachricht und Pausenende — eine
      // kurze Störung direkt nach dem Aktivieren löst keinen sofortigen Rückfallsatz aus.
      const wartetMin = (Date.now() - geduldAb(ersteOffene.am, kp)) / 60_000;
      if (wartetMin < KI_GEDULD_MIN) return { gesendet: false, grund: `KI nicht erreichbar (${e.kiFehler.slice(0, 80)}) — neuer Versuch.` };
      if (rueckfallSchonDa || nurBestaetigung) {
        // Eine Aufgabe je offener Nachricht — nicht alle fünf Minuten eine neue (Nachhol-Takt).
        const k = `${nummer}-${neuesteRein.id}`;
        if (!kiAufgabeGemeldet.has(k)) {
          kiAufgabeGemeldet.add(k);
          await aufgabeFuerMenschen(nummer, personId, leadId, `Mara kann gerade nicht antworten (KI: ${e.kiFehler.slice(0, 120)}). Letzte Nachricht: „${frage.slice(0, 200)}"`, !nurBestaetigung, "ki");
        }
        return { gesendet: false, grund: nurBestaetigung ? "KI nicht erreichbar — auf ein reines „Ok“ kein Rückfallsatz." : "KI nicht erreichbar — Rückfallsatz steht schon da, ein Mensch ist informiert." };
      }
    }
    // ── E-248: DER SICHERE SATZ VOR DEM RÜCKFALLSATZ ───────────────────────
    // Zwei Entwürfe durften nicht raus. Vorher kam sofort „Das möchte ich Ihnen ganz genau
    // beantworten" — auch auf „Ok". Jetzt: ein wahrer Satz aus der Lage, wenn es einen gibt;
    // auf ein reines „Ok" nie ein Rückfallsatz; in zwei Stunden nie zwei.
    let sicher: string | null = null;
    if (funde.length && !e.kiFehler) {
      // E-265: auf ein Kaufsignal Justins Abschluss (ohne erfundene Uhrzeit — die kommt aus freie_zeiten).
      // E-275: der vorab geschickte Kartenlink zählt wie ein Werkzeug — sein Satz ist dann der sichere Satz.
      const basisSatz = sichererSatz({ kunde, aktionen: [...e.aktionen, ...(vorabKarte ? [vorabKarte] : [])], termin: terminKurz, link: lage.link, stufe: lage.linkLage.stufe, abschluss: abschlussFormel, limitFrage });
      // E-401 (2/6): Nennt er einen Termin, ist der warme Satz dazu der sichere Satz (ohne Verkauf) — außer ein Werkzeug hat
      // eine Kündigung oder Ratenpause gebucht (dann gilt dessen Satz) oder sein Anliegen ist heikel (dann der Rückfallsatz).
      const werkzeugSatz = e.aktionen.some((x) => (x.werkzeug === "kuendigung_aufnehmen" || x.werkzeug === "ratenpause_setzen") && x.ok && x.satz);
      const kandidat = genanntZurueck && genannt && !werkzeugSatz
        ? (genannt.satz && !heikelAnliegen(kunde) && !kannNichtZahlen(kunde) && !abstreitenArt(kunde) ? genannt.satz : null)
        // E-401 (3/6): Er meldet eine Zahlung — der Satz aus dem Bankbuch (zahlung_suchen) ist der sichere Satz.
        : zahlungGesucht && !werkzeugSatz && !heikelAnliegen(kunde) && !abstreitenArt(kunde) ? zahlungGesucht.satz
        // E-401 (4/6): Er will Angaben ändern — der Satz aus dem, was der Server getan hat, ist der sichere Satz.
        : angabenLage && angabenLage.satz && !werkzeugSatz && !heikelAnliegen(kunde) && !abstreitenArt(kunde) ? angabenLage.satz
        : basisSatz;
      // E-253 (28.09.2026): bewusst OHNE die Namen des Kunden — der sichere Satz nennt nur den Namen des
      // Betreuers (E-265: Nennform) und Links, nie den Kunden; ungemaskt prüft die Wand hier strenger.
      if (kandidat && !sendePruefung(kandidat).length && !tonUndLink(kandidat, { land: lage.land, kunde, linkLage: lage.linkLage, mitarbeiter }).hart.length
        && !handlungsPruefung(kandidat, e.aktionen, kunde, verlaufText, { links: [lage.link ?? "", ...e.aktionen.map((x) => x.link ?? "").filter(Boolean)], termin: terminKurz ? { uhrzeit: terminKurz.uhrzeit ?? "" } : null,
          zeiten: genannt?.uhrzeitTermin ? [genannt.uhrzeitTermin] : [], ruhe: ruhe24 || genanntZurueck,
          gekuendigt: lage.gekuendigt, jahresvertrag: lage.jahresvertrag, beendetMitRate: lage.linkLage.stufe === "beendet" && !!lage.linkLage.ratenReferenz }).length
        // E-401 (2/6): auch der sichere Satz hält die Regeln neben dem genannten Termin.
        && !(genannt && genanntAntwortFunde(kandidat, {
          darfEingetragen: genannt.eingetragen || genannt.erkennung.art === "steht_schon" || e.aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok),
          // E-401 Nachbesserung: Hat rueckruf_eintragen in diesem Lauf gebucht oder verschoben, gilt die NEUE Zeit — keine Pflicht zur alten.
          uhrzeitPflicht: (genannt.eingetragen || genannt.erkennung.art === "steht_schon") && !e.aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok) ? genannt.uhrzeitTermin : null,
          satz: genannt.satz, linkVerboten: genanntZurueck, verkaufErlaubt: !genanntZurueck,
        }).length)) {
        sicher = kandidat;
      }
    }
    if (sicher) {
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: sicherer Satz statt Rückfall (${funde.join(" · ").slice(0, 200)}).`);
      antwort = sicher;
      await protokolliere({ art: "sicherer_satz", ok: true, nummer, personId, leadId, text: `Zwei Entwürfe verworfen (${funde.join(" · ").slice(0, 200)}) — sicherer Satz aus der Lage geschickt: ${sicher.slice(0, 160)}`, daten: { funde } });
    } else if (funde.length || e.kiFehler) {
      const warum = e.kiFehler ? `KI: ${e.kiFehler.slice(0, 120)}` : funde.join(" · ");
      if (!e.kiFehler && (nurBestaetigung || rueckfallSchonDa)) {
        // Kein Rückfallsatz auf ein „Ok", kein zweiter in zwei Stunden: still — und die bestehende Aufgabe bekommt einen Beitrag.
        await stillSetzen(nummer, Number(neuesteRein.id));
        await protokolliere({ art: "still", ok: false, nummer, personId, leadId, text: `Mara schweigt statt Rückfallsatz (${nurBestaetigung ? "reine Bestätigung" : "Rückfallsatz in den letzten 2 Stunden"}): ${warum.slice(0, 200)}`, daten: { funde } });
        if (!nurBestaetigung) {
          // E-372: Maras Prüfung hielt wieder jede Antwort an — die Karte („Mara unsicher“) bekommt die Nachricht (Rückruf: Betreuer).
          await uebergeben({ nummer, personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id),
            weg: waWeg({ kunde: offenerText, anlass: "rueckfall", bezahlt: !!lageE?.bezahlt, rueckrufWunsch: rueckrufGewollt(offenerText) || echteOffene.some((v) => /rufen\s+sie\s+mich\s+an/i.test(String(v.knopf ?? ""))), terminDa: !!terminKurz }),
            aufgabe: { grund: `Mara konnte wieder nicht sicher antworten (${warum.slice(0, 160)}). Kunde: „${frage.slice(0, 200)}"`, dringend: false, klasse: heikelAnliegen(offenerText) ? "heikel" : "pruefung", opt: { still: true } },
            karte: { kunde: offenerText, mara: null, grund: `Prüfung hielt jede Antwort an: ${warum}` }, lage: lageE });
        }
        return { gesendet: false, grund: "Kein Rückfallsatz (reine Bestätigung oder schon einer in 2 h) — Mara schweigt." };
      }
      console.warn(`[MARA-WA] ${nummer.slice(-4)}: Rückfallsatz (${warum}).`);
      antwort = rueckfallSatz(lage.anruferN);
      mensch = true;
      uebergabe = `Mara konnte nicht sicher antworten (${warum}). Letzte Nachricht: „${frage.slice(0, 200)}"`;
      // E-248: Maras Prüfproblem ist kein dringendes Anliegen des Kunden — außer sein Anliegen ist es.
      klasse = e.kiFehler ? "ki" : klasse === "heikel" || klasse === "geld" ? klasse : "pruefung";
      klasseFest = true;
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
    const gebuchtAktion = e.aktionen.find((x) => x.werkzeug === "rueckruf_eintragen" && x.ok && x.termin) ?? null;
    const gebucht = gebuchtAktion?.termin ?? null;
    const ohneRueckfall = !funde.length && !e.kiFehler || !!sicher;
    if (ohneRueckfall && gebucht && !uhrzeitenIn(antwort).includes(gebucht.uhrzeit)) {
      antwort = `${antwort} ${terminNenn(gebucht).nom} ruft Sie ${gebucht.kundenText ?? gebucht.text} an.`.trim();
    }
    const link = e.aktionen.find((x) => x.werkzeug === "terminlink_schicken" && x.ok && x.link)?.link ?? null;
    if (ohneRueckfall && link && !antwort.includes(link)) {
      antwort = `${antwort} Hier wählen Sie selbst eine Zeit: ${link}`.trim();
    }
    // E-240: Hat auskunft_anbieten einen Link geholt, muss er beim Kunden ankommen — genau dieser.
    const auskunftAktion = e.aktionen.find((x) => x.werkzeug === "auskunft_anbieten" && x.ok && x.link) ?? null;
    // Gegenlesen 24.09.2026: verglichen wird der Pfad — schreibt Mara „fiaon.com/zahlung/…" statt
    // „https://www.fiaon.com/zahlung/…", stand der Link sonst zweimal in der Nachricht.
    if (ohneRueckfall && auskunftAktion?.link && !antwort.includes(auskunftAktion.link.replace(/^https?:\/\/[^/]+/i, ""))) {
      antwort = `${antwort} Hier geht es direkt weiter: ${auskunftAktion.link}`.trim();
    }
    // ── E-275 (02.10.2026): DER LINK DER PARTNERBANK MUSS BEIM KUNDEN ANKOMMEN ──────────────────────────────
    // Hat Mara (oder der Server vorab) den Link geschickt, muss die Antwort es sagen — sonst kommt der Satz aus dem Bereich
    // Karte dazu. Ließ er sich nicht schicken (Ausschluss, Fehler), übernimmt ein Mensch mit dem internen Grund.
    const kartenAktion = e.aktionen.find((x) => x.werkzeug === "karte_link_schicken") ?? vorabKarte;
    if (ohneRueckfall && kartenAktion?.ok && kartenAktion.satz && !/partnerbank|\bdkb\b|girokonto|e-?mail/i.test(antwort)) {
      antwort = `${antwort} ${kartenAktion.satz}`.trim();
    }
    // E-372: „adresse_gesperrt“ ist kein Ausschluss mehr — die neue Adresse trägt Mara selbst ein (angaben_eintragen).
    let kartenAusschluss: string | null = null;
    if (kartenAktion && !kartenAktion.ok && !["nicht_bereit", "nicht_kunde", "ohne_mail", "adresse_gesperrt"].includes(String(kartenAktion.kartenArt))) {
      // Der interne Grund steht IMMER in der Karte bzw. Übergabe — auch wenn das Modell selbst schon einen Satz dafür geschrieben hat.
      kartenAusschluss = `Kartenlink konnte Mara nicht schicken (${String(kartenAktion.intern ?? kartenAktion.kartenArt ?? "unbekannt").slice(0, 200)}) — bitte den Link der Partnerbank selbst schicken oder den Grund klären.`;
    }
    // E-372: Eine Ratenpause über die Grenze (zweite in 60 Tagen) ist ein Härtefall — Justin entscheidet mit einem Klick.
    const pauseAktion = e.aktionen.find((x) => x.werkzeug === "ratenpause_setzen" && !x.ok && x.haertefall) ?? null;

    // Zusagen („Ihr Betreuer ruft Sie an", „weitergeleitet", „vorgemerkt") müssen eingelöst werden:
    // Wer so etwas schreibt, übergibt — unabhängig davon, was das Modell im Feld mensch gesetzt hat.
    const zusagen = wandPruefen(antwort).filter((x) => x.art === "zusage").map((x) => x.treffer);
    // „Ich gebe Daniel Bescheid" ist genauso eine Zusage — „Geben Sie mir Bescheid" nicht (Prüfung 24.09.).
    // Ein von Mara eingetragener Rückruf IST die Übergabe (Termin + Mail an den Mitarbeiter): keine zweite Aufgabe dafür.
    // E-248: Ein Termin, der schon im Kalender steht, deckt „Florentine ruft Sie … an" genauso — nicht aber „ich gebe … Bescheid".
    // E-260: bei Abwesenheit zählen beide Namen — „Justin ruft Sie an" wie „Nikita meldet sich".
    // E-265: die Nennformen („Herr Stripling meldet sich", „Justin Schwarzott ruft an") und zur Sicherheit die Vornamen.
    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const betreuerVorname = Array.from(new Set([lage.anruferN?.nom, lage.betreuerN?.nom, lage.betreuerN?.vorname, lage.anrufer, lage.betreuer]
      .filter(Boolean).map((n) => esc(String(n))))).join("|") || null;
    const tk = terminKurz ?? e.aktionen.find((x) => x.bestehend)?.bestehend ?? null;
    const terminVorname = tk ? esc(terminNenn(tk).nom) : "";
    const bescheidMuster = /\b(?:ich|wir)\s+(?:gebe|geben|sage|sagen)\b[^.!?]{0,60}\bbescheid\b|\b(?:ich|wir)\s+(?:gebe|geben|leite|leiten)\b[^.!?]{0,60}\bweiter\b/i;
    const meldetMuster = new RegExp(String.raw`\b(?:betreuer|team|kolleg\w*)\b[^.!?]{0,40}\b(?:kümmert|meldet|ruft|übernimmt)`
      + (betreuerVorname ? String.raw`|\b(?:${betreuerVorname})\s+(?:meldet|ruft|kümmert)` : "")
      + (terminVorname ? String.raw`|\b${terminVorname}\s+(?:meldet|ruft|kümmert)` : ""), "i");
    const bescheid = bescheidMuster.test(antwort) && !/\?\s*$/.test(antwort.replace(/https?:\/\/\S+/g, "").trim());
    const zusageOhneTermin = zusagen.length || bescheid || meldetMuster.test(antwort);
    const terminDeckt = (!!gebucht || !!terminKurz || e.aktionen.some((x) => !!x.bestehend)) && !zusagen.some((z) => !/ruf|rückruf|meldet/i.test(z)) && !bescheid;
    const zusageSatz = zusageOhneTermin && !terminDeckt ? `Mara hat zugesagt (${zusagen.join(", ") || "Rückmeldung"}) — bitte einlösen. Kunde: „${frage.slice(0, 200)}"` : null;
    // E-265 Nachbesserung 2 (01.10.2026): Rücknahme oder Bestreiten bei einer Kündigung — Mara bucht nie.
    // E-372: Ob daraus etwas zu entscheiden ist, sagt waWeg (gebuchte Kündigung zurücknehmen? abgeschickten Antrag stornieren?).
    const kuendigungSatz = kuendigungJetzt === "zurueck"
      ? `Kunde verneint oder nimmt eine Kündigung zurück — Mara hat NICHTS gebucht. Bitte prüfen (ggf. Kündigung zurücknehmen). Kunde: „${offenerText.slice(0, 220)}"`
      : kuendigungJetzt === "bestreitet"
        ? `Kunde bestreitet den Vertrag oder schreibt von einer falschen Nummer, dazu Kündigung/Storno — Mara hat NICHTS gebucht (E-264). Kunde: „${offenerText.slice(0, 220)}"`
        : null;
    if (kuendigungJetzt === "bestreitet") { klasse = "bestreitet"; klasseFest = true; }
    // E-372 (15.10.2026): Ein heikles Anliegen allein (Kündigung, Beschwerde, Wut, Storno, „kann nicht zahlen“) ist KEINE
    // Übergabe mehr — Mara hat geantwortet (ohne Zahlungsbitte, handlungsPruefung) und erledigt es selbst. Recht,
    // Widerruf und Geld zurück nach einer Zahlung entscheidet Justin (Karte, oben vor dem Modell bzw. waWeg unten).
    const heikel = heikelAnliegen(offenerText);
    if (heikel) klasse = "heikel";
    // E-265 (29.09.2026): Hat Mara die Kündigung selbst aufgenommen, ist das erledigt (Justins Formel, Urkunde, Mail).
    // E-372: auch mit „kann nicht zahlen“ oder Widerruf (ohneZahlung) keine Aufgabe mehr — die offene Rate bleibt, wie die
    // Bestätigung sie nennt; die Ratenpause bietet Mara selbst an.
    // E-248: Ein Rückruf, zu dem schon ein Termin steht (oder der gerade gebucht wurde), braucht keine Aufgabe.
    const terminDa = !!gebucht || !!terminKurz || e.aktionen.some((x) => !!x.bestehend);
    if (!klasseFest && (mensch || zusageSatz) && klasse !== "heikel" && klasse !== "geld") klasse = aufgabenKlasse(offenerText, uebergabe || zusageSatz || "");
    if (heikel) klasse = "heikel";
    // Nachbesserung E-248: Will er den Termin ABSAGEN oder VERSCHIEBEN und Mara hat nicht selbst
    // neu gebucht, deckt der alte Termin nichts — dann bleibt es beim Menschen (vorher ging die Absage verloren).
    const terminAenderung = TERMIN_AENDERN.test(offenerText) && !e.aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok && x.termin);
    if (!klasseFest && mensch && klasse === "rueckruf" && terminDa && !bescheid && !terminAenderung) mensch = false;

    // ── E-372: WOHIN — selbst, Karte für Justin oder (nur Rückruf und Technik) der Betreuer ──────────────
    // Die Anlässe in ihrer Rangfolge; der erste, der nicht „selbst“ ist, bestimmt den Weg. Liegt zu diesem Fall schon
    // eine Karte offen (er schrieb weiter), bekommt sie seine neue Nachricht und Maras Antwort (auffrischen).
    const rueckrufWunsch = rueckrufGewollt(offenerText) || echteOffene.some((v) => /rufen\s+sie\s+mich\s+an/i.test(String(v.knopf ?? "")));
    const wegBasis = { kunde: offenerText, bezahlt: !!lageE?.bezahlt, abgeschickt: !!lageE?.abgeschickt, gekuendigt: !!lageE?.gekuendigt,
      rueckrufWunsch, anrufGewuenscht, terminDa, terminAenderung: terminAenderung && terminDa && mensch };
    const anlaesse: { anlass: WaWegEin["anlass"]; uebergabe?: string | null; grund: string }[] = [
      ...(e.kiFehler && (funde.length || !roh) ? [{ anlass: "ki" as const, grund: uebergabe }] : []),
      ...(!e.kiFehler && !sicher && funde.length ? [{ anlass: "rueckfall" as const, grund: uebergabe }] : []),
      ...(kuendigungJetzt === "zurueck" ? [{ anlass: "kuendigung_zurueck" as const, grund: kuendigungSatz! }] : []),
      ...(kuendigungJetzt === "bestreitet" ? [{ anlass: "kuendigung_bestreitet" as const, grund: kuendigungSatz! }] : []),
      ...(kartenAusschluss ? [{ anlass: "karte_ausschluss" as const, grund: `${kartenAusschluss} Kunde: „${frage.slice(0, 200)}"` }] : []),
      ...(e.aktionen.filter((x) => x.vorlegen).slice(0, 1).map((x) => ({ anlass: "vorlegen" as const, grund: `${x.vorlegen} Kunde: „${frage.slice(0, 200)}"` }))),
      // E-401 (4/6): Was Mara nie selbst ändert (Name, Geburtsdatum, Bank, Ausweis, Nummernwechsel von einer anderen Nummer) — Karte.
      ...(angabenLage?.mensch && angabenLage.menschGrund ? [{ anlass: "vorlegen" as const, grund: `Änderungswunsch: ${angabenLage.menschGrund}` }] : []),
      ...(pauseAktion ? [{ anlass: "ratenpause_haertefall" as const, grund: `Ratenpause über die Grenze (${String(pauseAktion.intern ?? "").slice(0, 160)}). Kunde: „${frage.slice(0, 200)}"` }] : []),
      ...(zusageSatz ? [{ anlass: "zusage" as const, uebergabe: zusageSatz, grund: zusageSatz }] : []),
      ...(mensch && roh ? [{ anlass: "modell" as const, uebergabe, grund: uebergabe || "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp)." }] : []),
    ];
    let weg: WaWegErgebnis | null = null;
    let wegGrund = "";
    for (const x of anlaesse) {
      const w = waWeg({ ...wegBasis, anlass: x.anlass, uebergabe: x.uebergabe ?? null });
      if (!weg || weg.weg === "selbst") { weg = w; wegGrund = x.grund; }
      if (w.weg !== "selbst") break;
    }
    // Hat Mara ihm zugesagt, dass unsere Geschäftsführung es klärt (mensch true), MUSS Justin es sehen — nie „selbst“.
    if ((!weg || weg.weg === "selbst") && mensch && zusageGeschaeftsfuehrung(zusageTreffer(antwort, zusageNamen))) {
      weg = { weg: "karte", fall: "frage", grund: "Mara hat zugesagt, dass unsere Geschäftsführung es klärt" };
      wegGrund = uebergabe || `Kunde: „${frage.slice(0, 200)}"`;
    }
    // Ein heikles Anliegen ohne anderen Anlass war bis E-372 immer eine Aufgabe — jetzt erledigt Mara es (Protokoll „selbst“).
    if (!weg && heikel) { weg = waWeg({ ...wegBasis, anlass: "nachricht" }); wegGrund = `Heikles Anliegen: „${offenerText.slice(0, 240)}"`; }
    // Er schrieb zu einer offenen Karte weiter (Recht, Widerruf, Geld zurück): die Karte bekommt es — auch ohne anderen Anlass.
    if ((!weg || weg.weg === "selbst") && entscheidungsFall) {
      weg = { weg: "karte", fall: entscheidungsFall, grund: "er schreibt zu seiner offenen Sache weiter" };
      wegGrund = `Er schreibt weiter: „${offenerText.slice(0, 240)}"`;
    }

    // Fehlt der Pflicht-Hinweis trotz Auftrag, wird er vorangestellt — nie eine erste Antwort ohne ihn.
    if (kiHinweis && !/digitale Assistentin/i.test(antwort)) {
      antwort = `Hier ist ${namen.voll.split(" ")[0]}, die digitale Assistentin von FIAON. ${antwort}`;
    }

    // ── E-408 (Scheibe 3, 22.10.2026): MARA FRAGT NACH DEM JA ZUM ANRUF ────────────────────────────────────────────
    // EIN eigener Satz als eigener Absatz am Ende (JA_FRAGE_WA) — Maras Antwort bleibt Wort für Wort. Ob er darf, sagt
    // jaFrageZumAnhaengen (fiaon-ja-zum-anruf.ts): offenes Fenster (er hat gerade geschrieben), noch kein gültiges Ja,
    // keine Sperre, höchstens einmal in 30 Tagen, Maras Antwort fragt selbst nichts, Schalter im KI-Raum an. Und nicht,
    // wenn es gerade um etwas anderes gehen muss — die Gründe hier (jeder einzelne hält die Frage an).
    const jaRuhe: string[] = [
      ...(!ohneRueckfall || sicher ? ["kein freier Entwurf (Rückfall- oder sicherer Satz)"] : []),
      ...(mensch || (weg && weg.weg !== "selbst") ? ["Übergabe an einen Menschen"] : []),
      ...(heikel || heikelJetzt || ruhe24 || kuendigungJetzt || kuendigungThema ? ["heikles Anliegen oder Kündigung"] : []),
      ...(zusageSatz ? ["offene Zusage"] : []),
      ...(terminDa || anrufGewuenscht || rueckrufWunsch ? ["ein Telefonat ist schon Thema"] : []),
      ...(genannt || abstArtJetzt || herkunftHinweis || entscheidungsFall || offeneKarten.length ? ["eine andere Sache liegt offen"] : []),
      ...(kannNichtZahlen(offenerText) || WUT_EMOJI.test(offenerText) ? ["Not oder Ärger"] : []),
      ...(jaFrageZuletzt ? ["gerade erst gefragt"] : []),
      ...(lage.werbesperre || lage.vertriebssperre ? ["Sperre"] : []),
    ];
    const jaFrage = await jaFrageZumAnhaengen({ nummer, personId: personId ? Number(personId) : null, antwort, ruhe: jaRuhe })
      .catch((err) => { console.warn(`[MARA-WA] ${nummer.slice(-4)}: Frage nach dem Ja nicht geprüft — keine Frage:`, String(err?.message ?? err).slice(0, 160)); return null; });
    if (jaFrage) antwort = `${antwort}\n\n${jaFrage}`;

    // E-240: Was Mara getan hat — für den Aktenvermerk, der beim Versand entsteht (versandLauf).
    const handlung = [
      ...e.aktionen.filter((x) => x.ok).map((x) => x.werkzeug === "rueckruf_eintragen" && x.termin ? `Rückruf eingetragen (${x.termin.text}, ${x.termin.vorname})`
        : x.werkzeug === "freie_zeiten" ? "freie Zeiten angeboten"
        : x.werkzeug === "zahlungszusage_merken" ? "Zahlungszusage festgehalten"
        : x.werkzeug === "terminlink_schicken" ? "Terminlink geschickt"
        : x.werkzeug === "auskunft_anbieten" ? `Bonitätsauskunft angeboten (${x.betrag ?? "Preis vom Server"}, ${x.art === "bestellt" ? "bestellt" : x.art === "offen" ? "Zahlungsseite der offenen Bestellung" : "Kauflink"})`
        : x.werkzeug === "karte_link_schicken" ? `Link der Partnerbank (${x.kartenArt ?? "?"})`
        : x.werkzeug === "ratenpause_setzen" ? "Ratenpause gesetzt (ein Monat)"
        : x.werkzeug === "angaben_eintragen" ? `Angaben eingetragen${x.kartenArt ? `, Link der Partnerbank (${x.kartenArt})` : ""}`
        : x.werkzeug),
      // E-275: der vom Server vorab geschickte Link der Partnerbank.
      ...(vorabKarte ? [`Link der Partnerbank vorab (${vorabKarte.kartenArt ?? "?"}${vorabKarte.ok ? "" : ", nicht geschickt"})`] : []),
      // E-401 (2/6): der genannte Termin — eingetragen, steht schon, bei Dritten oder unklar.
      ...(genannt?.handlung ? [genannt.handlung] : []),
      // E-401 (4/6): was angaben_aendern getan hat.
      ...(angabenLage ? [angabenLage.handlung.slice(0, 300)] : []),
      ...(sicher ? ["sicherer Satz aus der Lage"] : funde.length || e.kiFehler ? ["Rückfallsatz"] : []),
      // E-372: wohin — eine Karte für Justin, der Betreuer (nur Rückruf/Technik) oder nichts (Mara hat es erledigt).
      ...(weg?.weg === "karte" ? [`Karte für Justin (${weg.fall}): ${weg.grund}`] : weg?.weg === "betreuer" ? [`an ${lage.anrufer ?? "das Team"} übergeben: ${(wegGrund || weg.grund).slice(0, 140)}`] : []),
      ...(String(roh?.gemerkt ?? "").trim() ? [`gemerkt: ${String(roh.gemerkt).trim().slice(0, 140)}`] : []),
      // E-408 (Scheibe 3): die angehängte Frage nach dem Ja zum Anruf.
      ...(jaFrage ? ["nach dem Ja zum Anruf gefragt (auch ARAS)"] : []),
    ].join("; ") || "keine";
    await vorbereiten(nummer, antwort, Number(neuesteRein.id), frage, { kunde, handlung });

    if (personId && String(roh?.gemerkt ?? "").trim()) {
      await gedaechtnisMerken(Number(personId), [String(roh.gemerkt).trim()], "whatsapp").catch(() => {});
    }
    if (weg) {
      await uebergeben({ nummer, personId: personId ? Number(personId) : null, leadId: leadId ? Number(leadId) : null, aufId: Number(neuesteRein.id), weg,
        aufgabe: { grund: wegGrund || uebergabe || "Der Mensch möchte mit jemandem aus dem Team sprechen (WhatsApp).", dringend: aufgabeDringend(klasse, terminDa), klasse },
        karte: { kunde: offenerText, mara: antwort, grund: wegGrund || null, pauseOhneSperre: !!pauseAktion?.ohneSperreMoeglich }, lage: lageE });
    }
    return { gesendet: false, grund: `${sicher ? "Sicherer Satz liegt bereit." : "Antwort liegt bereit."}${weg?.weg === "karte" ? " Karte für Justin." : weg?.weg === "betreuer" ? " Aufgabe an den Betreuer." : ""}` };
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
    // E-248: Das Hauswissen nennt fiaon.com/antrag als Beispiel — auf WhatsApp gibt es nur SEINEN Link
    // (16 von 23 Antragslinks waren nackt, das Modell nahm sie von hier).
    // E-265 (29.09.2026): „Wunschlimit" bleibt stehen — Justins Formel nennt es (mit dem Satz über die Bank).
    .map((z) => z
      .replace(/Nenne konkrete Seiten als Link-Pfad \(z\. B\. fiaon\.com\/antrag\), wenn es weiterhilft\./, "Links: nur SEIN persönlicher Link (DEIN LINK) oder ein Link aus einem Werkzeug — nie die allgemeine Antragsseite ohne seinen Code.")
      .replace(/\(fiaon\.com\/privatkunden oder fiaon\.com\/antrag\)/, "(über seinen persönlichen Link)")
      .replace(/(?:https?:\/\/)?(?:www\.)?fiaon\.com\/antrag\b(?!\?)/g, "sein persönlicher Antragslink"))
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
          // E-458: nur, wenn der Abschnitt „RÜCKRUF BEI ARAS“ in deinem Auftrag steht und er zugestimmt hat.
          bei: { type: "string", enum: ["betreuer", "aras"], description: "„aras“ nur nach seinem Ja auf dein Angebot, dass ARAS (eine KI) ihn im Fenster von/bis anruft — sonst weglassen." },
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
  // E-265 (29.09.2026, Justin: „Mara bucht klare Kündigungen selbst … nicht an Abwesende weitergeben"):
  // derselbe Weg wie das Postfach (kuendigung_vormerken → kuendigungDurchfuehren, E-213).
  {
    type: "function",
    function: {
      name: "kuendigung_aufnehmen",
      description: "Bucht die Kündigung (oder das Storno einer unbezahlten Bestellung) — Urkunde und schriftliche Bestätigung verschickt das Haus (E-213). NUR in Schritt 2: Deine letzte Nachricht war die verbindliche Rückfrage „Soll ich Ihre Kündigung jetzt verbindlich aufnehmen? Dann antworten Sie bitte mit Ja.“ und er hat klar mit Ja geantwortet. Nie auf ein „ich kündige“ allein (dann erst die Rückfrage), nie bei einer Frage, Verneinung, Rücknahme, Bedingung, fremden Verträgen, Bestreiten oder falscher Nummer. Liefert so_schreiben: genau diesen Satz schreibst du.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          zitat: { type: "string", description: "Sein wörtlicher Satz, mit dem er kündigt oder storniert." },
          grund: { type: "string", description: "Sein Grund in seinen Worten — oder leer." },
        },
        required: ["zitat"],
      },
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
    // E-365 (14.10.2026): privat die FIAON-Bonitätsauswertung; nie bei „im Paket enthalten“ oder „liegt vor“.
    description: "Sein echter Link zur FIAON-Bonitätsauswertung (für ein Unternehmen: zur Firmen-Bonitätsauskunft) mit seinem Preis (einmalig): bei offener Bestellung seine Zahlungsseite, sonst der Link, über den er sie mit einem Klick beauftragt (dort sieht er Preis, AGB und Widerrufsbelehrung, danach die Zahlungsseite). Ist sie in seinem Paket enthalten, bezahlt oder liegt sie vor, sagt es dir das (ok: false, grund) — dann kein Preis, kein Link. Gibt seinem Betreuer Bescheid.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
};

/**
 * E-275 (02.10.2026): Der Link der Partnerbank — nur für zahlende Kunden (Stufe „kunde“). Justin: „Mara soll aber
 * selbstständig arbeiten". Vorher gab es auf WhatsApp kein Werkzeug dafür; jede Kartenfrage ging an einen Kollegen.
 * Der Weg ist die eine Regel des Bereichs Karte (karteEinladungFuerPerson): Ausschlüsse (Test, Vertriebssperre,
 * Global, gekündigt, keine E-Mail …), die E-Mail mit dem Link, der Eintrag in fiaon_konto_karte, kein zweiter Versand
 * binnen einer Stunde, und der Satz für den Kunden. Die Werbesperre hält ihn nicht auf — die Einladung ist Vertragsleistung.
 */
const WERKZEUG_KARTE = {
  type: "function",
  function: {
    name: "karte_link_schicken",
    description: "Schickt ihm den Link unserer Partnerbank für seinen Konto- und Kartenantrag per E-Mail (oder noch einmal, wenn er schon draußen ist) und liefert den Satz für ihn (so_schreiben). Nutze es, sobald er nach Karte, Kartenlink, Konto, PIN oder „nichts bekommen“ fragt. Steht sein Konto schon, sagt das Ergebnis, dass er die Karte im Banking dazubucht. Schreib so_schreiben in eigenen Worten mit denselben Fakten — nie eine Zusage der Bank.",
    parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
  },
};

/**
 * E-372 (15.10.2026): „kann nicht zahlen“ — der vorhandene Weg ist die Ratenpause (fiaon-ratenpause.ts, derselbe wie im
 * Forderungsmanagement): alle offenen Raten rücken einen Monat, bis dahin keine Erinnerung. Nur für zahlende Kunden,
 * nur auf seine Bitte oder sein Ja zu Maras Angebot. Eine zweite in 60 Tagen oder mehr als drei Monate entscheidet
 * Justin (Härtefall-Karte). Vorher: „Eine Ratenpause oder Stundung sagst du nie zu“ und eine Aufgabe beim Betreuer.
 */
const WERKZEUG_RATENPAUSE = {
  type: "function",
  function: {
    name: "ratenpause_setzen",
    description: "Verschiebt seine offenen Raten einmal um einen Monat (Ratenpause, derselbe Weg wie im Forderungsmanagement) — bis dahin bekommt er keine Erinnerung. NUR, wenn er selbst um eine Pause oder Verschiebung seiner Rate bittet oder dein Angebot („Soll ich Ihre Raten einmal um einen Monat verschieben?“) klar mit Ja beantwortet. Liefert so_schreiben. Lehnt es ab (Härtefall), sag ihm, dass unsere Geschäftsführung darüber entscheidet und er Bescheid bekommt.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: { zitat: { type: "string", description: "Sein wörtlicher Satz, mit dem er um die Pause bittet oder Ja sagt." } },
      required: ["zitat"],
    },
  },
};

/**
 * E-372 (15.10.2026): Fehlende Angaben und die E-Mail-Adresse für den Link der Partnerbank trägt Mara selbst ein —
 * über denselben Weg wie die Akte („Daten“: updateCustomerContact, Person durchgeschrieben, alter Wert als Alias, Verlauf).
 * Nur, was er wörtlich geschrieben hat, nur in Feldern, die fehlen (die E-Mail auch, wenn dort nichts ankommt).
 * Vorher: „schickt er sie, setzt du mensch auf true (uebergabe: Angaben eintragen)“.
 */
const WERKZEUG_ANGABEN = {
  type: "function",
  function: {
    name: "angaben_eintragen",
    description: "Trägt Angaben, die er dir eben geschrieben hat, in seinen Antrag ein (derselbe Weg wie die Akte): E-Mail-Adresse, Straße und Hausnummer, Postleitzahl, Wohnort, Geburtsdatum. Nur, was wörtlich in seiner Nachricht steht und in seinem Antrag fehlt — die E-Mail-Adresse auch, wenn an die hinterlegte nichts ankommt. Danach geht der Link unserer Partnerbank raus, sobald alles da ist; das Ergebnis liefert so_schreiben.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        email: { type: "string", description: "Seine E-Mail-Adresse genau so, wie er sie schreibt — oder leer." },
        strasse: { type: "string", description: "Straße und Hausnummer — oder leer." },
        plz: { type: "string", description: "Postleitzahl (4–5 Ziffern) — oder leer." },
        ort: { type: "string", description: "Wohnort — oder leer." },
        geburtsdatum: { type: "string", description: "Geburtsdatum als YYYY-MM-DD — oder leer." },
      },
      required: [],
    },
  },
};

/** Die Werkzeuge für dieses Gespräch. */
function werkzeugeFuer(ctx: WerkzeugKontext | null): any[] {
  const basis = auskunftWerkzeugAn(ctx?.auskunft) ? [...WERKZEUGE, WERKZEUG_AUSKUNFT] : [...WERKZEUGE];
  // E-275: der Kartenlink nur für zahlende Kunden (nicht B, nicht gekündigt — dort gilt die Lage), und nicht zweimal im Lauf.
  // E-401 (2/6): Nennt er einen Termin (ohneVerkauf), gibt es in diesem Lauf weder Kartenlink noch Auskunft-Angebot.
  const basisJetzt = ctx?.ohneVerkauf ? [...WERKZEUGE] : basis;
  const mitKarte = ctx?.stufe === "kunde" && !ctx.kartenSchon && !ctx.ohneVerkauf ? [...basisJetzt, WERKZEUG_KARTE] : basisJetzt;
  // E-372: die Ratenpause nur für zahlende Kunden; Angaben eintragen ab dem abgeschickten Antrag.
  return [
    ...mitKarte,
    ...(ctx?.stufe === "kunde" ? [WERKZEUG_RATENPAUSE] : []),
    ...(ctx && (ctx.stufe === "kunde" || ctx.stufe === "zahlung_offen" || ctx.stufe === "zahlung_gemeldet") ? [WERKZEUG_ANGABEN] : []),
  ];
}

/** Was ein Werkzeug getan hat — für Prüfung, Nachbesserung und Protokoll. */
export interface Aktion {
  werkzeug: string; ok: boolean;
  /** Uhrzeiten („HH:MM"), die Mara aus diesem Werkzeug kennt — nur diese darf sie nennen. */
  zeiten: string[];
  termin?: { id: number; text: string; uhrzeit: string; vorname: string; nenn?: { nom: string; dat: string }; agentName: string; datum: string; wochentag: string; kundenText?: string; beginn?: string };
  /** E-248 (Fall K.): Es stand schon ein Termin — seine Zeit ist wahr und darf genannt werden. */
  bestehend?: { uhrzeit: string; kundenText: string; vorname: string; nenn?: { nom: string; dat: string }; beginn: string; vonMara: boolean };
  /** E-265: kuendigung_aufnehmen — der fertige Satz (Justins Formel) für den Kunden. */
  satz?: string;
  /** E-265 Nachbesserung: kuendigung_aufnehmen — er kann nicht zahlen oder widerruft: keine Zahlungsbitte, ein Mensch klärt die Rate. */
  ohneZahlung?: boolean;
  /** E-248 (Befund #294): Wunsch und gebuchter Platz weichen ab — mit Grund (belegt/vorlauf/raster). */
  abweichung?: { wunsch: string; gebucht: string; grund?: AbweichungsGrund } | null;
  link?: string;
  /** E-240 (auskunft_anbieten): der Betrag vom Server und was geschah. */
  betrag?: string;
  art?: "angebot" | "offen" | "bestellt";
  /** E-275 (karte_link_schicken): was der Bereich Karte getan hat (gesendet, erneut_gesendet, konto_steht, gesperrt …). */
  kartenArt?: string;
  /** E-275: der interne Grund (Ausschluss, Fehler) — nur für die Übergabe, nie an den Kunden. */
  intern?: string;
  /** E-372 (ratenpause_setzen): Die Pause geht über die Grenze — ein Härtefall für Justin (Karte). */
  haertefall?: boolean;
  /** E-372: Der Härtefall lag nur an der 60-Tage-Sperre — „Pause trotzdem setzen“ ist möglich. */
  ohneSperreMoeglich?: boolean;
  /** E-372: Das Werkzeug konnte es nicht erledigen und Justin muss es sehen (z. B. Kündigung als Prüffall) — eine Karte. */
  vorlegen?: string;
}
export interface WerkzeugKontext {
  personId: number; leadId: number | null; nummer: string;
  /** E-240: seine offenen Nachrichten und Maras letzte — für „hat er zugestimmt?" (Server, nicht Modell). */
  kunde?: string; letzteDu?: string;
  auskunft?: AuskunftTeil | null;
  /**
   * E-246: Berliner Tag (YYYY-MM-DD) der neuesten offenen Kundennachricht, NUR wenn sie in der KI-Pause kam. Liegt
   * er vor heute (Nachricht aus der KI-Pause), legt rueckruf_eintragen nichts auf
   * heute, außer der Kunde nennt den heutigen Tag ausdrücklich.
   */
  nachrichtTag?: string;
  /** E-264: seine Stufe (stufeAusAntrag) — ohne abgeschickten Antrag gibt es keinen Zahltag festzuhalten. */
  stufe?: LinkStufe;
  /**
   * E-265 Nachbesserung (29.09.2026): seine offenen Nachrichten OHNE Knopftexte — nur sie zählen als Willenserklärung;
   * dazu die neueste ausgehende Nachricht davor (Vorlagen eingeschlossen) für „Ja auf Maras Rückfrage".
   */
  kundeFrei?: string;
  letzteRaus?: LetzteRaus | null;
  /** E-265 Nachbesserung 2: seine Nachrichten vor Maras verbindlicher Rückfrage (Anlass (a) der Kündigung). */
  kuendigungAnlass?: string;
  /** E-275: Der Server hat den Link der Partnerbank in diesem Lauf schon geschickt (vorab) — das Werkzeug fällt weg. */
  kartenSchon?: boolean;
  /** E-401 (2/6): Er nennt einen Termin — Mara nimmt sich zurück: kein Kartenlink, kein Auskunft-Angebot in diesem Lauf. */
  ohneVerkauf?: boolean;
  /** E-401 (4/6): Felder, die angaben_aendern in diesem Lauf bearbeitet hat — angaben_eintragen lässt sie liegen. */
  angabenServer?: AngabeFeld[];
}

/** „15:00" → „15 Uhr", „15:10" → „15:10 Uhr". */
function uhrText(hhmm: string): string {
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return `${hhmm} Uhr`;
  return m[2] === "00" ? `${Number(m[1])} Uhr` : `${Number(m[1])}:${m[2]} Uhr`;
}
/** Die Alternativen aus rueckrufBuchen („morgen 10:20 Uhr", „Dienstag, 29.09. 19:40 Uhr") so, wie ein Mensch schreibt. */
function zeitAusSlotText(t: string): string {
  return String(t).replace(/\b(\d{1,2}):00 Uhr\b/g, (_, h) => `${Number(h)} Uhr`).replace(/^(heute|morgen)\s+/, "$1 um ").replace(/(\d{2}\.\d{2}\.)\s+(\d)/, "$1 um $2");
}
const MONATE_WORT = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
/**
 * Nennt er (oder Maras Rückfrage, die er gerade bestätigt) den Zahltag eindeutig — mit Monat
 * („1.10.", „01.10.2026", „1. Oktober") oder relativ („morgen", „übermorgen", „Freitag")? Rein.
 */
export function zahltagEindeutig(datumIso: string, kunde: string, letzteDu = ""): boolean {
  const m = String(datumIso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const tag = Number(m[3]), monat = Number(m[2]);
  const mitMonat = (t: string) => {
    const x = String(t).toLowerCase();
    return new RegExp(`(^|\\D)0?${tag}\\s*\\.\\s*0?${monat}(\\.|\\D|$)`).test(x)
      || new RegExp(`(^|\\D)0?${tag}\\.?\\s*${MONATE_WORT[monat - 1]}`).test(x)
      || /(?:^|[^a-zäöüß])(morgen|übermorgen|heute|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|nächste\w*\s+woche|monatsende|ende\s+des\s+monats)(?![a-zäöüß])/.test(x);
  };
  if (mitMonat(kunde)) return true;
  // „Meinen Sie den 1. Oktober?" → „Ja" / „Genau": seine Bestätigung deiner Rückfrage.
  return /\?/.test(String(letzteDu)) && mitMonat(letzteDu) && /^\s*(ja|jo|jep|genau|richtig|stimmt|korrekt|gern|gerne|ok|okay|passt)\b/i.test(kunde);
}

/**
 * Die Werkzeuge mit eigenem Rot-Weg: Sie prüfen die Ampel selbst und legen Justin eine passende Karte vor
 * (Rückruf: „vorlegen“ mit dem Wunsch; Ratenpause: Härtefall-Karte „Pause setzen“).
 */
const EIGENER_ROT_WEG = new Set(["rueckruf_eintragen", "ratenpause_setzen"]);

/**
 * E-409 × E-406 (Integration, 20.10.2026): DIE EINE Werkzeug-Ampel (KI-Team › Werkzeuge, fiaon-ki-ampel.ts).
 * Rot: das Werkzeug läuft nicht — mit Rot-Weg „karte“ legt der Server Justin eine echte Karte vor (vorlegen →
 * „Mara braucht eine Antwort von dir“), mit „weglassen“ antwortet Mara ohne es. Gelb: läuft und steht DANACH in
 * „Heute“ — nur, wenn es wirklich lief. Grün (Vorgabe) = wie bisher. Lesefehler = die strengste Stufe.
 */
export async function werkzeugAusfuehren(name: string, args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const A = await import("./fiaon-ki-ampel");
  const ein = { kanal: "whatsapp" as const, personId: ctx.personId, nummer: ctx.nummer };
  const ampel = await A.ampelPruefen("mara", name, ein).catch(() => null);
  if (ampel?.gesperrt && !EIGENER_ROT_WEG.has(name)) {
    const karte = ampel.rotWeg === "karte";
    const wunsch = Object.entries(args ?? {}).filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v]) => `${k}: ${String(v).slice(0, 80)}`).join(" · ").slice(0, 300);
    return {
      ergebnis: { ok: false, meldung: ampel.text },
      aktion: { werkzeug: name, ok: false, zeiten: [],
        ...(karte ? { vorlegen: `Ampel rot (${ampel.werkzeug?.label ?? name}): Mara hat es NICHT getan${wunsch ? ` — ${wunsch}` : ""}.` } : {}) },
    };
  }
  const r = await werkzeugAusfuehrenKern(name, args, ctx);
  if (ampel && !ampel.gesperrt) await A.ampelGelbMerken(ampel, r.aktion.ok === true, ein, r.aktion.satz ?? r.aktion.termin?.text ?? null).catch(() => {});
  return r;
}

async function werkzeugAusfuehrenKern(name: string, args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
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
      // E-265: „mitarbeiter" und „ruft_an" sind Nennformen („Herr Stripling") — Mara schreibt sie genau so ab.
      ergebnis: v.length
        ? { ok: true, mitarbeiter: ang.agent?.nenn.nom ?? "jemand aus unserem Team", arbeitszeit_heute: heute ?? "heute nicht im Dienst",
            // E-248: „zeit" ist für Werkzeug-Aufrufe; dem Kunden schreibt Mara so_schreiben („morgen um 10:20 Uhr").
            zeiten: v.map((s) => ({ zeit: `${s.datum} ${s.uhrzeit}`, so_schreiben: zeitFuerKunde(new Date(s.beginn)), ...(ang.weg === "abwesenheit" ? { ruft_an: s.agentVorname } : {}) })) }
        : { ok: false, meldung: `In den nächsten Tagen ist keine Zeit frei${ang.grund ? ` (${ang.grund})` : ""}. Schick den Terminlink oder übergib an einen Menschen.` },
      aktion: { werkzeug: name, ok: v.length > 0, zeiten: v.map((s) => s.uhrzeit) },
    };
  }
  if (name === "rueckruf_eintragen") {
    const sperre = rueckrufHeuteSperre(args, ctx, new Date());
    if (sperre) return { ergebnis: { ok: false, grund: sperre }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    // E-406 B3 / E-409: Ampel „Rückruf eintragen“ auf Rot (KI-Team › Werkzeuge) — Mara trägt nichts ein, keine Uhrzeit
    // wird zugesagt; der Wunsch liegt Justin als Karte vor (vorlegen → „Mara braucht eine Antwort von dir“). Vorgabe grün.
    const { ampelRot } = await import("./fiaon-ki-ampel");
    if (await ampelRot("rueckruf_eintragen")) {
      const fenster = args?.von && args?.bis ? `${args.von}–${args.bis}` : (args?.von || args?.bis || "");
      const wunsch = [args?.zeit, fenster].filter(Boolean).join(" / ") || "ohne Uhrzeit";
      return {
        ergebnis: { ok: false, grund: "Rückrufe trägt gerade die Geschäftsführung selbst ein (Ampel rot). Sag ihm: Sein Wunsch ist angekommen, wir melden uns und machen die Zeit fest. Nenne KEINE Uhrzeit als fest und schreib nicht, dass etwas eingetragen ist." },
        aktion: { werkzeug: name, ok: false, zeiten: [],
          vorlegen: `Ampel rot (Rückruf eintragen): Rückruf NICHT eingetragen — Wunsch ${wunsch}${args?.verschieben === true ? " (verschieben)" : ""}. Anliegen: ${String(args?.anliegen ?? "").slice(0, 200)}` },
      };
    }
    // E-458 (Justin 29.10.2026): Rückruf „bei ARAS“ — nach seinem Ja auf Maras Angebot mit KI-Hinweis (ihre letzte Nachricht),
    // mit Fenster. Das Ergebnis hat dieselbe Form wie beim Betreuer (termin), damit die Prüfungen danach greifen.
    if (args?.bei === "aras") {
      const { arasRueckrufEintragen } = await import("./fiaon-aras-wunsch");
      const ra = await arasRueckrufEintragen({
        personId: ctx.personId, leadId: ctx.leadId, nummer: ctx.nummer, kanal: "whatsapp", von: mt.wunschLesen(args?.von), bis: mt.wunschLesen(args?.bis),
        anliegen: String(args?.anliegen ?? ""), angebot: ctx.letzteDu ?? null, antwort: ctx.kundeFrei ?? ctx.kunde ?? null,
      });
      if (!ra.ok) return { ergebnis: { ok: false, grund: ra.meldung }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
      const hhmm = (d: Date) => d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
      const satz = `Gern, unsere digitale Mitarbeiterin ARAS ruft Sie ${ra.text} an.`;
      const nenn = { nom: "ARAS", dat: "ARAS" };
      return {
        ergebnis: { ok: true, eingetragen: ra.text, mitarbeiter: "ARAS (unsere digitale Mitarbeiterin, eine KI)", so_schreiben: satz },
        aktion: {
          werkzeug: name, ok: true, zeiten: [hhmm(ra.von), hhmm(ra.bis)],
          termin: { id: ra.terminId, text: ra.text, uhrzeit: hhmm(ra.von), vorname: "ARAS", nenn, agentName: "ARAS",
            datum: ra.von.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }), wochentag: new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", weekday: "long" }).format(ra.von),
            kundenText: ra.text, beginn: ra.von.toISOString() },
        },
      };
    }
    const r = await mt.rueckrufBuchen(ctx, {
      zeit: args?.zeit || null, von: args?.von || null, bis: args?.bis || null,
      anliegen: String(args?.anliegen ?? ""), verschieben: args?.verschieben === true,
    });
    const altZeiten = (r.alternativen ?? []).flatMap((t) => uhrzeitenIn(t));
    const bestehendZeiten = r.bestehend ? [r.bestehend.uhrzeit] : [];
    // E-248 (Befund #294): Wunsch 15:00, gebucht 15:10 — dann sagt der fertige Satz es ehrlich.
    const ab = r.ok && r.termin && r.abweichung ? r.abweichung : null;
    // E-265: die Nennform („Gern, Herr Stripling ruft Sie … an"), nie der Vorname.
    const satz = r.ok && r.termin
      ? (ab
        ? abweichungsSatz({ wunsch: uhrText(ab.wunsch), grund: ab.grund }, r.termin.nenn.nom, r.termin.kundenText)
        : `Gern, ${r.termin.nenn.nom} ruft Sie ${r.termin.kundenText} an.`)
      : null;
    return {
      ergebnis: r.ok && r.termin
        ? { ok: true, eingetragen: r.termin.kundenText, wochentag: r.termin.wochentag, datum: r.termin.datum, uhrzeit: r.termin.uhrzeit, mitarbeiter: r.termin.nenn.nom, mitarbeiter_mit: r.termin.nenn.dat,
            ...(ab ? { hinweis: `Sein Wunsch war ${uhrText(ab.wunsch)}, gebucht ist ${uhrText(ab.gebucht)} — Grund: ${ab.grund === "belegt" ? "der Platz war schon vergeben" : ab.grund === "vorlauf" ? "zu kurzfristig (wir brauchen 20 Minuten Vorlauf)" : "der nächste freie Platz im Zeitplan"}. Sag ihm das offen, mit genau diesem Grund — „vergeben" nur, wenn er belegt war.` } : {}),
            so_schreiben: satz }
        : { ok: false, grund: r.meldung, alternativen: (r.alternativen ?? []).map((t) => zeitAusSlotText(t)),
            ...(r.bestehend ? { sein_termin: r.bestehend.kundenText, mitarbeiter: r.bestehend.nenn.nom, mitarbeiter_mit: r.bestehend.nenn.dat, so_schreiben: `Ihr Termin steht schon: ${r.bestehend.nenn.nom} ruft Sie ${r.bestehend.kundenText} an.` } : {}) },
            // E-265 Nachbesserung (f02): kein „Genau," im Werkzeugsatz — das Modell setzt ihn oft hinter andere Sätze.
      aktion: {
        werkzeug: name, ok: r.ok, zeiten: r.termin ? [r.termin.uhrzeit, ...altZeiten] : [...bestehendZeiten, ...altZeiten],
        termin: r.termin ? { id: r.termin.id, text: r.termin.text, uhrzeit: r.termin.uhrzeit, vorname: r.termin.vorname, nenn: r.termin.nenn, agentName: r.termin.agentName, datum: r.termin.datum, wochentag: r.termin.wochentag, kundenText: r.termin.kundenText, beginn: r.termin.beginn } : undefined,
        bestehend: r.bestehend ? { uhrzeit: r.bestehend.uhrzeit, kundenText: r.bestehend.kundenText, vorname: r.bestehend.vorname, nenn: r.bestehend.nenn, beginn: r.bestehend.beginn, vonMara: r.bestehend.vonMara } : undefined,
        abweichung: ab,
      },
    };
  }
  if (name === "zahlungszusage_merken") {
    // E-264: Ohne abgeschickten Antrag gibt es keine Rechnung — also auch keinen Zahltag und keine
    // „Zahlungsseite bleibt offen" (Fall 29.09.: approved/Schritt 5 galt als „Zahlung offen").
    if (ctx.stufe === "lead" || ctx.stufe === "antrag_offen") {
      return { ergebnis: { ok: false, grund: "Sein Antrag ist nie abgeschickt — es gibt keine Rechnung und keinen Zahltag. Kein Wort vom Bezahlen: Der Schritt ist, seinen Antrag fertigzumachen (DEIN LINK)." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    }
    const datum = String(args?.datum ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ergebnis: { ok: false, grund: "Kein gültiges Datum (YYYY-MM-DD)." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    if (datum < heute) return { ergebnis: { ok: false, grund: "Der Tag liegt in der Vergangenheit." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    // E-248 (Befund #621): „Zahlen an 1" wurde als 01.10. festgehalten — geraten. Festgehalten wird nur
    // ein Tag, den er (oder deine Rückfrage, die er bestätigt hat) eindeutig mit Monat nennt.
    const eindeutig = zahltagEindeutig(datum, String(ctx.kunde ?? ""), String(ctx.letzteDu ?? ""));
    if (!eindeutig) {
      const vorschlag = datumFuerKunde(new Date(`${datum}T12:00:00Z`)).replace(/^\w+,\s*/, "");
      return { ergebnis: { ok: false, grund: `Der Tag ist nicht eindeutig (kein Monat genannt). Frag kurz nach, z. B. „Meinen Sie den ${vorschlag}?" — und halte ihn erst nach seinem Ja fest.` }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
    }
    const [alt] = (await sqlPool`SELECT promised_payment_date FROM fiaon_persons WHERE id = ${ctx.personId}`) as any[];
    // E-IT-A (08.10.2026): Mit der Zusage kommt die Wiedervorlage der einen Regel
    // (Werktag nach dem genannten Tag, shared/fiaon-wiedervorlage.ts) — vorher nur
    // das Datum; der Mensch stand am Kalendertag danach (auch Sa/So) wieder oben.
    const { naechsterVersuch } = await import("@shared/fiaon-wiedervorlage");
    const wvZusage = naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: datum }).datum;
    await sqlPool`UPDATE fiaon_persons SET promised_payment_date = ${datum}::date, follow_up_date = ${wvZusage}::date, updated_at = NOW() WHERE id = ${ctx.personId}`;
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
    return { ergebnis: r.ok ? { ok: true, link: r.link, zeiten_von: r.agent ?? "unserem Team", so_schreiben: `Hier suchen Sie sich selbst eine Zeit aus: ${r.link}` } : { ok: false, grund: r.meldung }, aktion: { werkzeug: name, ok: r.ok, zeiten: [], link: r.link } };
  }
  if (name === "auskunft_anbieten") return auskunftAnbieten(ctx);
  if (name === "karte_link_schicken") return kartenLinkSchicken(ctx);
  if (name === "kuendigung_aufnehmen") return kuendigungAufnehmen(args, ctx);
  if (name === "ratenpause_setzen") return ratenpauseSetzen(args, ctx);
  if (name === "angaben_eintragen") return angabenEintragen(args, ctx);
  return { ergebnis: { ok: false, grund: "Unbekanntes Werkzeug." }, aktion: { werkzeug: name, ok: false, zeiten: [] } };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LINK DER PARTNERBANK AUF WHATSAPP (02.10.2026, E-275)
//
// Fall 6120 (Mail, Satpal J.): ULTRA am 02.08. bezahlt, seit 03.09. „wo ist meine Karte?“ — Mara: „The card itself is
// issued and sent by the bank … I have asked Nikita Boychenko to check this today". Ursache: Werbesperre seit 09.09.,
// die Automatik übersprang ihn, die Einladung ging NIE raus. Auf WhatsApp dasselbe Muster (#2413, #2003, #2011): „Justin
// prüft den fehlenden Link". Jetzt schickt Mara ihn selbst — über die EINE Regel des Bereichs Karte
// (karteEinladungFuerPerson, server/lib/fiaon-konto-karte.ts): Ausschlüsse, Mail mit dem Link, Eintrag, kein zweiter
// Versand binnen einer Stunde, der Satz für den Kunden. Mara erfindet keinen eigenen Weg und keinen eigenen Satz.
// Nur Stufe „kunde“ (erste Zahlung gebucht). B bekommt Justins Satz und seine Zahlungsseite, nie den Link vor der Zahlung.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * E-275: der EINE Weg zum Link der Partnerbank (Bereich Karte). Als Objekt, damit ein Prüfstand den Versand ersetzen
 * kann (scripts/pruef-mara-karte-wa.ts, pruef-mara-abschluss.ts — dort gibt es keine Mail) — im Betrieb nie überschrieben.
 */
export const KARTEN_WEG = {
  einladung: async (personId: number, akteur: KarteEinladungAkteur): Promise<KarteEinladungErgebnis> =>
    (await import("./fiaon-konto-karte")).karteEinladungFuerPerson(personId, akteur),
};

// E-276 (02.10.2026): mitAntragLuecke steht jetzt in shared/fiaon-mara-ton.ts (oben importiert und weiter exportiert) —
// die Mara-Aktion braucht dieselbe Lücken-Fassung. In der Sache unverändert.

async function kartenLinkSchicken(ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const name = "karte_link_schicken";
  if (ctx.stufe !== "kunde") {
    return {
      // E-275 Ton (02.10.2026): Justins neuer Satz — die Aufforderung und der Nutzen.
      ergebnis: { ok: false, grund: `Den Link der Partnerbank gibt es nach der ersten Zahlung und der Bonitätsauswertung (E-363). Vorher ist der Schritt seine Zahlungsseite — sag es mit Justins Satz: „${AKTIVIERUNG_AUFRUF} — ${NACH_DEM_EINGANG}!“` },
      aktion: { werkzeug: name, ok: false, zeiten: [], kartenArt: "nicht_kunde" },
    };
  }
  // Schon heute in diesem Gespräch geschickt (fragt er dreimal, oder kam die Antwort nach einer KI-Pause erst später)?
  // Dann keine zweite Mail — der Bereich Karte liefert mit erneut: false den Satz „schon unterwegs“.
  const [heute] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_mara_protokoll
     WHERE nummer = ${ctx.nummer} AND art = 'karte_link' AND ok AND am > NOW() - INTERVAL '24 hours' LIMIT 1`.catch(() => [])) as any[];
  const r = await KARTEN_WEG.einladung(ctx.personId, { name: "Mara (WhatsApp)", quelle: "whatsapp", ...(heute ? { erneut: false } : {}) });
  const satz = r.satz ? String(r.satz).trim() : null;
  // Im Protokoll (fiaon_mara_protokoll, Steuerpult) — vorab vom Server wie aus dem Werkzeug, der interne Grund bleibt intern.
  await protokolliere({ art: "karte_link", ok: !!r.ok, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
    text: `Link der Partnerbank auf seine Frage (${r.aktion}): ${String(r.intern ?? "").slice(0, 200)}`,
    daten: { aktion: r.aktion, gesendet: !!r.gesendet } });
  if (r.ok && satz) {
    return {
      ergebnis: { ok: true, art: r.aktion, so_schreiben: satz,
        hinweis: "Erledigt — schreib so_schreiben in eigenen Worten mit genau diesen Fakten (die Adresse nur so gekürzt, wie sie dasteht). Kein Termin, kein Kollege, keine Zusage der Bank." },
      aktion: { werkzeug: name, ok: true, zeiten: [], satz, kartenArt: r.aktion, intern: r.intern },
    };
  }
  if (r.aktion === "nicht_bereit" && satz) {
    // Bezahlt, aber im Antrag fehlen Angaben (Geburtsdatum, Anschrift …): Der Satz fragt danach; eintragen kann sie nur ein
    // Mensch (Akte, „Daten“) — schickt er sie, ist das eine echte Übergabe.
    return {
      ergebnis: { ok: false, art: r.aktion, so_schreiben: satz,
        // E-372: Die Angaben trägt Mara selbst ein (angaben_eintragen) — vorher „mensch true“.
        hinweis: "Frag ihn genau nach diesen Angaben (so_schreiben). Schickt er sie, trägst du sie mit angaben_eintragen ein — dann geht der Link raus, sobald alles da ist." },
      aktion: { werkzeug: name, ok: false, zeiten: [], satz, kartenArt: r.aktion, intern: r.intern },
    };
  }
  // E-IT-B (08.10.2026): An seine Adresse kommt nichts an (gesperrt, abgewiesen, Spam) — nichts ging raus, nichts wurde
  // entsperrt (Justin, 08.10.). Mara fragt nach der richtigen Adresse; eintragen und erneut senden tut ein Mensch.
  if (r.aktion === "adresse_gesperrt" && satz) {
    return {
      ergebnis: { ok: false, art: r.aktion, so_schreiben: satz,
        hinweis: "An seine hinterlegte E-Mail-Adresse kommt nichts an — es ging nichts raus. Frag ihn nach seiner richtigen E-Mail-Adresse (so_schreiben). Nennt er eine, trägst du sie mit angaben_eintragen ein — dann geht der Link an die neue Adresse." },
      aktion: { werkzeug: name, ok: false, zeiten: [], satz, kartenArt: r.aktion, intern: r.intern },
    };
  }
  // Keine E-Mail-Adresse: Die Einladung geht per E-Mail — Mara fragt selbst danach, eintragen kann sie ein Mensch.
  if (r.aktion === "gesperrt" && /keine\s+e-?mail/i.test(String(r.intern ?? ""))) {
    return {
      ergebnis: { ok: false, art: "ohne_mail", grund: "Für den Link der Partnerbank fehlt seine E-Mail-Adresse.",
        hinweis: "Frag ihn freundlich nach seiner E-Mail-Adresse — dorthin geht der Link unserer Partnerbank für seinen Kartenantrag. Schickt er sie, trägst du sie mit angaben_eintragen ein — dann geht der Link raus." },
      aktion: { werkzeug: name, ok: false, zeiten: [], kartenArt: "ohne_mail", intern: r.intern },
    };
  }
  // Ausschluss oder Fehler: Der Grund ist intern (Vertriebssperre, Global, gekündigt, Testkonto …) — nie an den Kunden.
  // E-275 Endkontrolle (02.10.2026, Wahrheit): Hier stand „… dass ihm sein Betreuer den Link schickt“ — bei einem Ausschluss
  // (Kündigung, DSGVO, Storno) entscheidet der Mensch, ob es den Link gibt. Wahr ist nur: Er meldet sich dazu (Übergabe).
  return {
    // E-372: Ob er den Link trotzdem bekommt, entscheidet Justin (Karte) — nicht mehr „sein Betreuer meldet sich“.
    ergebnis: { ok: false, art: r.aktion, grund: "Den Link kann ich ihm hier nicht selbst schicken.",
      hinweis: "Sag ihm freundlich und ohne Grund, dass unsere Geschäftsführung sich das ansieht und er dazu Bescheid bekommt — der Server legt es ihr vor. Keine Zusage, dass der Link kommt, keine Zeit, nichts zur Karte." },
    aktion: { werkzeug: name, ok: false, zeiten: [], kartenArt: r.aktion, intern: r.intern },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-372 (15.10.2026): RATENPAUSE UND ANGABEN — MARA ERLEDIGT ES SELBST
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Will er eine Pause seiner Rate — selbst gebeten („Kann ich die Rate aussetzen?“, „Ratenpause bitte“, „Stundung“) oder
 * ein kurzes Ja auf Maras Angebot („Soll ich Ihre Raten einmal um einen Monat verschieben?“)? Ein Termin, der verschoben
 * werden soll, ist keine Ratenpause; ein „Nein“ nie. Rein.
 */
export function ratenpauseGewollt(kunde: string, letzteMara: string | null | undefined): boolean {
  const k = String(kunde ?? "").trim();
  if (!k || /^\s*(?:nein|nee|nö|noe|no)\b/i.test(k)) return false;
  const wunsch = new RegExp(String.raw`(?<![\p{L}])(?:raten-?pause|zahlungspause|pause|aussetzen|aussetzt|stundung|stunden\s+sie|aufschub|rate\p{L}*\s+(?:\p{L}+\s+){0,3}?(?:verschieb|aussetz|schieb)\p{L}*|(?:verschieb|schieb)\p{L}*\s+(?:\p{L}+\s+){0,3}?rate\p{L}*)(?![\p{L}])`, "iu");
  if (wunsch.test(k) && !/termin|anruf|rückruf|rueckruf/i.test(k)) return true;
  const angebot = /(?:verschieb\w*|ratenpause|aussetzen)[^?]{0,100}\?/i.test(String(letzteMara ?? "")) && /\brate/i.test(String(letzteMara ?? ""));
  return angebot && KURZES_JA.test(k.replace(new RegExp(String.raw`[^\p{L}\p{N}]+$`, "u"), "").replace(/\s+/g, " ").trim());
}

async function ratenpauseSetzen(args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const name = "ratenpause_setzen";
  const nein = (grund: string) => ({ ergebnis: { ok: false, grund }, aktion: { werkzeug: name, ok: false, zeiten: [] } as Aktion });
  if (ctx.stufe !== "kunde") return nein("Eine Ratenpause gibt es nur für zahlende Kunden mit offener Rate — vor der ersten Zahlung hältst du höchstens seinen Zahltag fest (zahlungszusage_merken). NICHTS ist verschoben.");
  const kunde = String(ctx.kundeFrei ?? ctx.kunde ?? "");
  if (!ratenpauseGewollt(kunde, ctx.letzteRaus?.text ?? ctx.letzteDu ?? null)) {
    return nein("Er hat nicht um eine Pause gebeten und nicht Ja zu deinem Angebot gesagt — NICHTS ist verschoben. Kann er nicht zahlen, biete sie als Frage an.");
  }
  const [b] = (await sqlPool`
    SELECT a.ref FROM fiaon_applications a
     WHERE a.person_id = ${ctx.personId} AND a.merged_into IS NULL AND a.payment_status = 'paid'
       AND EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)
     ORDER BY a.created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!b?.ref) return nein("Er hat keine offene Rate — nichts zu verschieben.");
  const { ratenpauseAnwenden, PAUSE_SPERRE_TAGE } = await import("./fiaon-ratenpause");
  const haerte = (intern: string, ohneSperre: boolean) => ({
    ergebnis: { ok: false, grund: "Eine weitere Pause entscheidet unsere Geschäftsführung — sag ihm genau das: Er bekommt dazu Bescheid. Keine Zusage, keine Zahlungsbitte, NICHTS ist verschoben." },
    aktion: { werkzeug: name, ok: false, zeiten: [], haertefall: true, ohneSperreMoeglich: ohneSperre, intern } as Aktion,
  });
  // E-406 B3 / E-409: Ampel „Ratenpause setzen“ auf Rot (KI-Team › Werkzeuge) — jede Bitte kommt als Karte „Ratenpause“
  // mit dem Knopf „Pause trotzdem setzen“ (derselbe Weg wie der Härtefall). Mara sagt nichts zu.
  const { ampelRot } = await import("./fiaon-ki-ampel");
  if (await ampelRot("ratenpause_setzen")) {
    return {
      ergebnis: { ok: false, grund: "Eine Ratenpause entscheidet gerade unsere Geschäftsführung — sag ihm genau das: Er bekommt dazu Bescheid. Keine Zusage, keine Zahlungsbitte, NICHTS ist verschoben." },
      aktion: { werkzeug: name, ok: false, zeiten: [], haertefall: true, ohneSperreMoeglich: true, intern: "Ampel rot: Ratenpausen nur mit deinem Klick" } as Aktion,
    };
  }
  // Höchstens eine Pause in 60 Tagen — auch eine, die Mara selbst gesetzt hat (ratenpauseAnwenden schreibt sie in den
  // Verlauf, nicht in fiaon_raten_arbeit, deren Sperre es selbst prüft).
  const [vorher] = (await sqlPool`
    SELECT created_at FROM fiaon_contact_log
     WHERE ref = ${String(b.ref)} AND note LIKE 'Ratenpause:%' AND voided_at IS NULL
       AND created_at > NOW() - make_interval(days => ${PAUSE_SPERRE_TAGE})
     ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (vorher) return haerte(`Ratenpause am ${new Date(vorher.created_at).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })} — höchstens eine in ${PAUSE_SPERRE_TAGE} Tagen`, true);
  const zitat = String(args?.zitat ?? kunde).replace(/\s+/g, " ").slice(0, 160);
  const p = await ratenpauseAnwenden({ ref: String(b.ref), grund: `Per WhatsApp erbeten: „${zitat}“`, agentId: null, agentName: "Mara (WhatsApp)" });
  if (!p.ok) {
    const sperre = /schon eine Ratenpause|höchstens eine/i.test(p.fehler);
    if (sperre || /Härtefall|länger als/i.test(p.fehler)) return haerte(p.fehler, sperre);
    return nein(`${p.fehler} — NICHTS ist verschoben.`);
  }
  const erste = p.verschoben[0];
  const satz = `Erledigt — Ihre Rate ${erste.nr} ist jetzt am ${erste.jetzt.split("-").reverse().join(".")} fällig${p.verschoben.length > 1 ? ", die folgenden rücken mit" : ""}. Bis dahin bekommen Sie von uns keine Zahlungserinnerung.`;
  await protokolliere({ art: "ratenpause", ok: true, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
    text: `Ratenpause per WhatsApp gesetzt (${p.monate} Monat${p.monate === 1 ? "" : "e"}, ${p.verschoben.length} Rate(n)): „${zitat.slice(0, 120)}“`,
    daten: { ref: b.ref, monate: p.monate, verschoben: p.verschoben } });
  return { ergebnis: { ok: true, so_schreiben: satz, hinweis: "Erledigt — schreib so_schreiben in eigenen Worten mit genau diesem Datum. Keine Zahlungsbitte für die verschobene Rate." },
    aktion: { werkzeug: name, ok: true, zeiten: [], satz } };
}

/**
 * Darf Mara diese Angaben eintragen? Nur, was er wörtlich geschrieben hat (keine erfundene Adresse), nur in Feldern, die
 * im Antrag fehlen (karteEinladungStand.fehlendeAngaben), die E-Mail-Adresse auch, wenn an die hinterlegte nichts
 * ankommt; jede Angabe gültig. Ist eine Angabe nicht in Ordnung, wird nichts eingetragen. Rein.
 */
export function angabenPruefen(args: any, ein: { kunde: string; fehlend: readonly string[]; adresseProblem: boolean }):
  { ok: true; body: Record<string, string>; felder: string[] } | { ok: false; grund: string } {
  const kl = String(ein.kunde ?? "").toLowerCase().replace(/\s+/g, " ");
  const steht = (w: string) => !!w && kl.includes(w.toLowerCase().replace(/\s+/g, " ").trim());
  const fehlt = (f: string) => ein.fehlend.includes(f);
  const body: Record<string, string> = {};
  const felder: string[] = [];
  const fehler: string[] = [];
  const email = String(args?.email ?? "").trim().toLowerCase();
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) fehler.push("Die E-Mail-Adresse ist ungültig.");
    else if (!steht(email)) fehler.push("Diese E-Mail-Adresse steht so nicht in seiner Nachricht — trag nur ein, was er selbst geschrieben hat.");
    else if (!fehlt("E-Mail-Adresse") && !ein.adresseProblem) fehler.push("Seine E-Mail-Adresse ist hinterlegt und dort kommt Post an — die änderst du nicht.");
    else { body.email = email; felder.push("Ihre E-Mail-Adresse"); }
  }
  const strasse = String(args?.strasse ?? "").replace(/\s+/g, " ").trim();
  if (strasse) {
    if (!fehlt("Straße und Hausnummer")) fehler.push("Straße und Hausnummer stehen schon im Antrag — die änderst du nicht.");
    else if (!/\d/.test(strasse) || strasse.length < 4) fehler.push("Zur Straße gehört die Hausnummer.");
    else if (!steht(strasse)) fehler.push("Diese Straße steht so nicht in seiner Nachricht.");
    else { body.street = strasse.slice(0, 160); felder.push("Ihre Straße"); }
  }
  const plz = String(args?.plz ?? "").replace(/\s+/g, "").trim();
  if (plz) {
    if (!fehlt("Postleitzahl")) fehler.push("Die Postleitzahl steht schon im Antrag.");
    else if (!/^\d{4,5}$/.test(plz)) fehler.push("Die Postleitzahl hat 4 oder 5 Ziffern.");
    else if (!new RegExp(`(^|\\D)${plz}(\\D|$)`).test(kl)) fehler.push("Diese Postleitzahl steht so nicht in seiner Nachricht.");
    else { body.zip = plz; felder.push("Ihre Postleitzahl"); }
  }
  const ort = String(args?.ort ?? "").replace(/\s+/g, " ").trim();
  if (ort) {
    if (!fehlt("Wohnort")) fehler.push("Der Wohnort steht schon im Antrag.");
    else if (ort.length < 2 || ort.length > 80 || /\d/.test(ort)) fehler.push("Der Wohnort ist ungültig.");
    else if (!steht(ort)) fehler.push("Dieser Wohnort steht so nicht in seiner Nachricht.");
    else { body.city = ort; felder.push("Ihren Wohnort"); }
  }
  const geb = String(args?.geburtsdatum ?? "").trim();
  if (geb) {
    const m = geb.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const monate = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
    if (!fehlt("Geburtsdatum")) fehler.push("Das Geburtsdatum steht schon im Antrag.");
    else if (!m) fehler.push("Das Geburtsdatum braucht die Form JJJJ-MM-TT.");
    else {
      const [, j, mo, t] = m;
      const tag = String(Number(t)), monat = String(Number(mo));
      const numerisch = new RegExp(`(^|\\D)0?${tag}\\s*[.\\/-]\\s*0?${monat}\\s*[.\\/-]\\s*(?:${j}|${j.slice(2)})(\\D|$)`).test(kl);
      const wort = new RegExp(`(^|\\D)0?${tag}\\.?\\s*${monate[Number(mo) - 1]}\\s*${j}(\\D|$)`).test(kl);
      if (!numerisch && !wort) fehler.push("Dieses Geburtsdatum steht so nicht in seiner Nachricht.");
      else { body.birthdate = geb; felder.push("Ihr Geburtsdatum"); }
    }
  }
  if (fehler.length) return { ok: false, grund: `${fehler.join(" ")} Eingetragen ist nichts.` };
  if (!felder.length) return { ok: false, grund: "Keine Angabe zum Eintragen — frag ihn genau nach dem, was fehlt." };
  return { ok: true, body, felder };
}

async function angabenEintragen(args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const name = "angaben_eintragen";
  const nein = (grund: string) => ({ ergebnis: { ok: false, grund }, aktion: { werkzeug: name, ok: false, zeiten: [] } as Aktion });
  if (ctx.stufe !== "kunde" && ctx.stufe !== "zahlung_offen" && ctx.stufe !== "zahlung_gemeldet") {
    return nein("Sein Antrag ist nicht abgeschickt — seine Angaben trägt er selbst in seinem Antrag ein (DEIN LINK). Eingetragen ist nichts.");
  }
  const kunde = String(ctx.kundeFrei ?? ctx.kunde ?? "");
  const kk = await import("./fiaon-konto-karte");
  const stand = await kk.karteEinladungStand(ctx.personId).catch(() => null);
  if (!stand) return nein("Seine Akte ließ sich nicht lesen — eingetragen ist nichts.");
  // Kommt an die hinterlegte Adresse nichts an (gesperrt, abgewiesen)? Dann darf er eine neue nennen.
  let adresseProblem = false;
  if (args?.email) {
    const an = await kk.karteEmpfaenger(stand.personId).catch(() => null);
    const lage = an ? await kk.zustellLage(stand.personId, an).catch(() => null) : null;
    adresseProblem = !an || !!lage?.problem;
  }
  // E-401 (4/6): Was angaben_aendern in diesem Lauf schon bearbeitet hat (die neue E-Mail-Adresse gilt erst nach dem
  // Bestätigungslink), fasst angaben_eintragen nicht noch einmal an.
  const serverFelder = new Set(ctx.angabenServer ?? []);
  if (serverFelder.size) {
    const weg = { ...(args ?? {}) };
    if (serverFelder.has("email")) delete weg.email;
    if (serverFelder.has("anschrift")) { delete weg.strasse; delete weg.plz; delete weg.ort; }
    const vorher = ["email", "strasse", "plz", "ort"].filter((k) => String(args?.[k] ?? "").trim()).length;
    const nachher = ["email", "strasse", "plz", "ort"].filter((k) => String(weg[k] ?? "").trim()).length;
    if (vorher > nachher && !String(weg.geburtsdatum ?? "").trim() && nachher === 0) {
      return nein("Das hat der Server schon bearbeitet (siehe ANGABEN in deinen Hinweisen) — sag ihm, was dort steht; die neue E-Mail-Adresse gilt erst nach dem Bestätigungslink. Eingetragen ist hier nichts.");
    }
    args = weg;
  }
  const p = angabenPruefen(args, { kunde, fehlend: stand.fehlendeAngaben, adresseProblem });
  if (!p.ok) return nein(p.grund);
  // Dieselbe Bestellung wie die Akte und die Einladung (lebend, nicht archiviert; bezahlt zuerst).
  const [b] = (await sqlPool`
    SELECT ref FROM fiaon_applications
     WHERE person_id = ${stand.personId} AND merged_into IS NULL AND archived_at IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
       AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!b?.ref) return nein("Zu ihm gibt es keinen Antrag, in den ich etwas eintragen könnte — eingetragen ist nichts.");
  if (p.body.email) {
    // Gehört die Adresse schon einem anderen Menschen, trägt Mara sie nicht ein (die Akte warnte nur — hier wäre es ein Login-Wechsel).
    const [dup] = (await sqlPool`
      SELECT 1 FROM fiaon_applications WHERE LOWER(TRIM(email)) = ${p.body.email} AND merged_into IS NULL
         AND person_id IS DISTINCT FROM ${stand.personId} LIMIT 1`.catch(() => [])) as any[];
    if (dup) return nein("Diese E-Mail-Adresse gehört bei uns schon zu einem anderen Antrag — frag ihn nach einer anderen Adresse. Eingetragen ist nichts.");
  }
  const { updateCustomerContact } = await import("../routes/fiaon-agent");
  const erg = await updateCustomerContact(String(b.ref), p.body, { id: null, name: "Mara (WhatsApp)" });
  if (erg.error) return nein(`${erg.error.msg} — eingetragen ist nichts. Frag ihn noch einmal genau danach.`);
  await protokolliere({ art: "angaben", ok: true, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
    text: `Angaben per WhatsApp eingetragen (${p.felder.join(", ")}) — derselbe Weg wie die Akte.`, daten: { ref: b.ref, felder: Object.keys(p.body) } });
  const eingetragen = `Danke, ich habe ${p.felder.join(" und ")} in Ihrem Antrag eingetragen.`;
  // Beim zahlenden Kunden geht der Link der Partnerbank jetzt raus (wenn alles da ist) — derselbe Weg wie karte_link_schicken.
  if (ctx.stufe === "kunde") {
    const r = await kartenLinkSchicken(ctx);
    const satz = r.aktion.satz ? `${eingetragen} ${r.aktion.satz}` : eingetragen;
    return {
      ergebnis: { ...r.ergebnis, ok: true, eingetragen: p.felder, so_schreiben: satz },
      aktion: { werkzeug: name, ok: true, zeiten: [], satz, kartenArt: r.aktion.kartenArt, intern: r.aktion.intern },
    };
  }
  return { ergebnis: { ok: true, eingetragen: p.felder, so_schreiben: eingetragen }, aktion: { werkzeug: name, ok: true, zeiten: [], satz: eingetragen } };
}

// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG AUF WHATSAPP — MARA NIMMT SIE SELBST AUF (29.09.2026, E-265)
//
// Justin am 29.09. zu 11145 und 8078: Mara gab „Bitte tun Sie das" (Kündigung)
// und „Muss ich trotzdem noch zahlen?" an Abwesende weiter — bis Freitag blieb
// beides liegen, und im Kündigungssatz stand die Zahlungsseite. „NEIN, bezahlen
// Sie Ihre Rate, dann lasse ich Sie aus Kulanz gerne aus dem Vertrag!!!"
//   · Derselbe Weg wie das Postfach (kuendigung_vormerken): der Wille wird am
//     Server geprüft (kuendigungsWille, auch ein Ja auf Maras Rückfrage), dann
//     kuendigungDurchfuehren (E-213: Wirkung, Urkunde, Bestätigungsmail).
//   · Der Satz kommt aus bausteinKuendigung (shared/fiaon-mara-ton.ts): bei
//     offener Rate im Jahresvertrag Justins Kulanz-Satz, im Altvertrag „gilt zum
//     Ende Ihres laufenden Abrechnungsmonats, dem …, danach kommt nichts mehr"
//     (E-265 (01.10.2026): Abrechnungsmonat, nicht Kalendermonat) — jeweils mit ihrer Zahlungsseite.
//     Die Kündigung selbst hängt nie an der Zahlung (§ 312k BGB).
// ═══════════════════════════════════════════════════════════════════════════
async function kuendigungAufnehmen(args: any, ctx: WerkzeugKontext): Promise<{ ergebnis: any; aktion: Aktion }> {
  const name = "kuendigung_aufnehmen";
  const nein = (grund: string) => ({ ergebnis: { ok: false, grund }, aktion: { werkzeug: name, ok: false, zeiten: [] } as Aktion });
  const [b] = (await sqlPool`
    SELECT ref, payment_status, agb_stand, gekuendigt_am, person_id FROM fiaon_applications
     WHERE person_id = ${ctx.personId} AND merged_into IS NULL AND NOT COALESCE(ist_entwurf, FALSE)
       AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%' AND COALESCE(pack_key, '') NOT LIKE 'global%'
       -- E-272 (02.10.2026, Gegenprüfung): dieselbe Bestellung wie lageFuer — eine archivierte unbezahlte zählt nicht.
       -- Sonst nannte die Lage den lebenden Antrag, die Kündigung landete aber auf der neueren, archivierten Dublette
       -- (der lebende lief weiter).
       AND (archived_at IS NULL OR payment_status = 'paid')
     ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (!b?.ref) return nein("Er hat keine Bestellung — es gibt nichts zu kündigen. Bestätige keine Kündigung.");
  const w = await import("./fiaon-postmeister-werkzeuge");
  const { kuendigungSetzen } = await import("./fiaon-kuendigung");
  // E-265 Nachbesserung (29.09.2026, r8.mts): NUR seine eigenen Worte — ein Vorlagen-Knopf („Bitte verschieben",
  // „Bitte rufen Sie mich an", „Ja, bitte") ist nie eine Willenserklärung (vorher: kunde = text || knopf).
  const kunde = String(ctx.kundeFrei ?? ctx.kunde ?? "");
  const zitat = String(args?.zitat ?? "");
  const formlos = !istJahresvertrag(b.agb_stand);
  // ── E-265 Nachbesserung 2 (01.10.2026): KÜNDIGUNG IN ZWEI SCHRITTEN ──────────────────────────────────────────
  // Gebucht wird NUR, wenn (b) seine offenen Nachrichten ein klares Ja ohne weiteren Inhalt auf Maras verbindliche
  // Rückfrage sind (jaAufKuendigungsAngebot: ihre neueste ausgehende Nachricht, wörtlich KUENDIGUNG_RUECKFRAGE, die
  // einzige Frage, ≤ 24 Stunden, keine Vorlage, kein Knopf) UND (a) er vorher selbst die Kündigung angesprochen hat
  // (kuendigungAnlass) — ohne Bestreiten, ohne falsche Nummer (E-264), ohne Rücknahme in seinen offenen Nachrichten.
  // Ein „ich kündige" allein bucht nie mehr (Gegenprobe g2: „Bitte kündigen Sie nicht meinen Vertrag", „Ich kündige!
  // ⏎ War ein Scherz" und „Falsche Nummer, bitte stornieren" wurden gebucht).
  const anlass = String(ctx.kuendigungAnlass ?? "");
  const ja = jaAufKuendigungsAngebot(kunde, ctx.letzteRaus ?? null);
  const bestritten = w.bestreitetKuendigung(kunde, abstreitenArt) ?? (anlass ? w.bestreitetKuendigung(anlass, abstreitenArt) : null);
  const zurueck = w.kuendigungRuecknahme(kunde);
  // E-372: bei einer unbezahlten Bestellung zählt auch sein Widerruf als Anlass (er ist dort ein Storno).
  const anlassOk = ausstiegThema(anlass, String(b.payment_status) !== "paid");
  if (bestritten) {
    return nein("Er bestreitet den Vertrag oder schreibt von einer falschen Nummer — NICHTS ist gebucht und es wird auch nichts gebucht (E-264). Bestätige keine Kündigung und kein Storno, biete keine an; die Leitung übernimmt (mensch true).");
  }
  if (zurueck) {
    return nein("Er nimmt die Kündigung zurück oder verneint sie — NICHTS ist gebucht. Bestätige keine Kündigung und frag nicht danach; geh auf sein Anliegen ein (ist sein Vertrag schon gekündigt, legt der Server die Rücknahme Justin vor).");
  }
  const unbezahlt = String(b.payment_status) !== "paid";
  if (!ja || !anlassOk) {
    return nein(`Gebucht wird nur nach seinem klaren Ja auf deine verbindliche Rückfrage — NICHTS ist gebucht. Bestätige keine ${unbezahlt ? "Stornierung" : "Kündigung"}. Will er klar ${unbezahlt ? "aussteigen" : "kündigen"}, stell jetzt als einzige Frage deiner Nachricht wörtlich: „${rueckfrageFuer(unbezahlt)}" — sonst sprich es nicht an und beantworte sein Anliegen.`);
  }
  // E-265 Schluss-Nachbesserung (01.10.2026): Die Storno-Form gilt nur für eine unbezahlte Bestellung — ein bezahlter Vertrag
  // wird gekündigt, nicht „storniert" (sein Ja auf die falsche Frage bucht nichts).
  if (verbindlicheRueckfrage(ctx.letzteRaus?.text ?? null) === "storno" && !unbezahlt) {
    return nein(`Er hat einen bezahlten Vertrag — eine Bestellung gibt es nicht zu stornieren, NICHTS ist gebucht. Frag wörtlich: „${KUENDIGUNG_RUECKFRAGE}"`);
  }
  // E-244 (Nachbesserung wie im Postfach): Lag die Kündigung schon vor und ist die Bestellung storniert/erstattet
  // oder das Vertragsende erreicht, fordert Mara NICHTS — eine noch „offene" Rate ist dann ein Datenfehler (Prüffall).
  const [st] = (await sqlPool`
    SELECT payment_status, (vertrag_ende_am IS NOT NULL AND vertrag_ende_am <= NOW()) AS vorbei, vertrag_ende_am
      FROM fiaon_applications WHERE ref = ${String(b.ref)} LIMIT 1`.catch(() => [])) as any[];
  const beendet = !!b.gekuendigt_am && !!st && (["cancelled", "canceled", "storniert", "refunded"].includes(String(st.payment_status)) || st.vorbei === true);
  const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");
  const grund = String(args?.grund ?? "").slice(0, 300) || null;
  const erg: any = b.gekuendigt_am
    ? await kuendigungSetzen(String(b.ref), { quelle: "whatsapp", grund })
    : await kuendigungDurchfuehren(String(b.ref), {
      quelle: "whatsapp", grund, personId: ctx.personId,
      unterzeichner: { name: "FIAON LTD", rolle: "automatisch erstellt (digitale Assistentin Mara, WhatsApp)" },
      // E-396: Erwähnt er einen Widerruf, bleibt beim Jahresvertrag der bisherige Weg — die Leitung entscheidet.
      widerrufErwaehnt: /wi(?:e)?der(?:r)?uf|r(?:ü|ue)cktritt/i.test(`${anlass}\n${kunde}`),
    });
  // E-372: Ließ sich die Kündigung nicht buchen (Prüffall), legt der Server es Justin vor (vorlegen → Karte).
  if (!erg?.ok) {
    const r = nein(`${erg?.grund ?? "Die Kündigung ließ sich nicht buchen"} — NICHTS ist gebucht; bestätige keine Kündigung. Sag ihm, dass unsere Geschäftsführung seine Kündigung prüft und er dazu Bescheid bekommt.`);
    return { ...r, aktion: { ...r.aktion, vorlegen: `Kündigung per WhatsApp ließ sich nicht buchen (${String(erg?.grund ?? "unbekannt").slice(0, 160)}) — Bestellung ${b.ref}.` } };
  }
  const weg = String(erg.weg ?? "");
  // Was bleibt (nach der Buchung gelesen, wie im Postfach): ALLE offenen, nicht stornierten Raten — E-265
  // Nachbesserung (Recht): vorher nur `LIMIT 1`, und der Satz sagte „danach kommt nichts mehr", obwohl die Regel
  // „hoechste" alle bis zur höchsten behält (79 bezahlte Verträge mit mehreren; die zweite wurde weiter gemahnt).
  const zeilen = weg === "storno_unbezahlt" ? [] : (await sqlPool`
    SELECT rate_nr, zahlungsreferenz, betrag_cents, faellig_am FROM fiaon_abo_raten
     WHERE ref = ${String(b.ref)} AND storniert_am IS NULL AND status = 'offen' AND zahlungsreferenz IS NOT NULL
     ORDER BY rate_nr ASC`.catch(() => [])) as any[];
  const raten = zeilen.map((r) => ({
    nr: Number(r.rate_nr), referenz: String(r.zahlungsreferenz), cents: Number(r.betrag_cents) || 0,
    faellig: r.faellig_am ? (r.faellig_am instanceof Date ? r.faellig_am.toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }) : String(r.faellig_am).slice(0, 10)) : null,
  }));
  // Beim Vertrag vor dem 03.09.2026 endet der Vertrag zum Ende des Abrechnungsmonats (E-265 (01.10.2026), Recht:
  // Fälligkeit zu Fälligkeit, vertragsendeLesen — dieselbe Rechnung wie kuendigungSetzen) — eine Rate, die erst danach
  // fällig wird, ist für die Zeit danach und wird nie verlangt (E-265 Nachbesserung, Recht). Ob sie storniert wird,
  // entscheidet Justin (Geldentscheidung) — Prüffall an den Betreiber, im Kundentext steht sie nicht.
  const ende = formlos ? (await (await import("./fiaon-kuendigung")).vertragsendeLesen(String(b.ref)).catch(() => ({ ende: null as string | null }))).ende : null;
  // E-396 (19.10.2026): Jahresvertrag zum Laufzeitende — das Ende aus der Buchung, und verlangt wird nur die offene
  // Rechnung aus dem Kulanz-Angebot (bis kulanz_rate_nr); der Satz ist die EINE Kulanz-Fassung.
  const jl = !formlos && !beendet ? await (await import("./fiaon-kuendigung")).jahresvertragLage(String(b.ref)).catch(() => null) : null;
  const laufzeit = jl?.art === "laufzeit" && jl.ende ? jl : null;
  const ratenAngebot = laufzeit ? raten.filter((r) => (laufzeit.kulanz?.raten ?? []).some((x) => x.nr === r.nr)) : raten;
  const { zuZahlen, nachEnde } = beendet ? { zuZahlen: [] as typeof raten, nachEnde: [] as typeof raten } : kuendigungRatenAufteilen(ratenAngebot, { jahresvertrag: !formlos, vertragsEnde: ende });
  const tt = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : null);
  const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
  const pruefFall = async (titel: string, text: string, schluessel: string) => {
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({ personId: ctx.personId, ref: String(b.ref), anBetreiber: true, quelle: "mara-whatsapp", autorName: "Mara", titel: titel.slice(0, 160), text, schluessel } as any);
    } catch (e) { console.error("[MARA-WA] Prüffall Kündigung:", String(e).slice(0, 160)); }
  };
  if (beendet && raten.length) {
    await pruefFall(`Prüffall: offene Rate trotz beendetem Vertrag (${b.ref})`,
      `Die Bestellung ${b.ref} ist storniert oder beendet, trotzdem steht noch ${raten.map((r) => `Rate ${r.nr} über ${eur(r.cents)}`).join(", ")} als offen. Mara hat dem Kunden auf WhatsApp keine Zahlung genannt. Bitte prüfen: Rate stornieren oder Bestellung richtigstellen.`,
      `whatsapp:kuendigung-raten:${b.ref}`);
  }
  if (nachEnde.length) {
    await pruefFall(`Entscheidung: Rate nach Vertragsende (${b.ref})`,
      `Altvertrag (vor dem 03.09.2026), per WhatsApp zum Ende des Abrechnungsmonats (${tagDeutsch(ende) ?? "?"}) gekündigt. Diese Rate(n) sind erst NACH dem Vertragsende fällig und bleiben im System offen: ${nachEnde.map((r) => `Rate ${r.nr} über ${eur(r.cents)}, fällig ${tt(r.faellig)}`).join("; ")}. Mara hat sie dem Kunden NICHT genannt (AGB alte Fassung § 6 Abs. 8, § 5 Abs. 3: für die Zeit danach nichts zu zahlen) und geschrieben, dass wir eine Rate für die Zeit nach dem Vertragsende nicht verlangen — „danach kommt nichts mehr" hat sie NICHT geschrieben. Bitte stornieren (Altbestand vor der Nachbesserung 01.10.; neue Kündigungen storniert kuendigungSetzen selbst) — sonst mahnt die Dauermahnung sie ab Fälligkeit.`,
      `whatsapp:kuendigung-nach-ende:${b.ref}`);
  }
  // E-265 Nachbesserung (Recht): Kann er nicht zahlen oder widerruft er, keine Zahlungsbitte — der Stand der Kündigung, ein Mensch klärt die Rate.
  // E-265 Nachbesserung 2: Sein „Ja" steht allein — „kann nicht zahlen" oder ein Widerruf stehen dann im Anlass davor.
  const seinText = `${anlass}\n${kunde}`;
  const ohneZahlung = zuZahlen.length > 0 && (kannNichtZahlen(seinText) || /wi(?:e)?der(?:r)?uf/i.test(seinText));
  const heute = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" }).format(new Date());
  const erste = zuZahlen[0] ?? null;
  const link = erste && !ohneZahlung ? absoluteUrl(`/zahlung/${encodeURIComponent(erste.referenz)}`) : null;
  const satz = bausteinKuendigung({
    kanal: "whatsapp", weg, jahresvertrag: !formlos, heute: `${heute}.`.replace(/\.\.$/, "."),
    raten: zuZahlen.map((r) => ({ vom: tt(r.faellig), betrag: eur(r.cents), cents: r.cents })),
    link, bestaetigung: !!erg.mailGesendet, beendet: weg === "bereits" && beendet, ohneZahlung,
    // E-265 Nachbesserung 2 (01.10.2026): „danach kommt nichts mehr" nur, wenn nach diesen Raten im System nichts mehr
    // offen ist (dieselbe Liste wie Urkunde und Bestätigungsmail); Raten nach dem Vertragsende verlangt sie nie.
    nichtsMehr: nachEnde.length === 0, nachEnde: nachEnde.length > 0,
    // E-265 (01.10.2026, Recht): „… gilt zum Ende Ihres laufenden Abrechnungsmonats, dem <Datum>".
    giltZum: ende,
    // E-396: Jahresvertrag zum Laufzeitende — das Ende und die EINE Kulanz-Fassung.
    laufzeitEnde: laufzeit?.ende ?? null, fristgerecht: laufzeit?.fristgerecht,
  });
  const mt = await import("./fiaon-mara-termin");
  await mt.protokollieren({
    art: "kuendigung", ok: true, nummer: ctx.nummer, personId: ctx.personId, leadId: ctx.leadId,
    text: `Kündigung per WhatsApp aufgenommen (${weg}${zuZahlen.length ? `, ${zuZahlen.length} Rate(n) über ${eur(zuZahlen.reduce((x, r) => x + r.cents, 0))} bleiben` : ""}${nachEnde.length ? `, ${nachEnde.length} nach Vertragsende (Prüffall)` : ""}${ohneZahlung ? ", ohne Zahlungsbitte" : ""}${erg.mailGesendet ? ", Bestätigung per E-Mail raus" : ""}): „${zitat.slice(0, 120)}"`,
    daten: { ref: b.ref, weg, jahresvertrag: !formlos, urkunde: !!erg.urkunde, bestaetigung: !!erg.mailGesendet, raten: zuZahlen.map((r) => r.referenz), nach_ende: nachEnde.map((r) => r.referenz), ohne_zahlung: ohneZahlung, beendet },
  }).catch(() => {});
  return {
    ergebnis: { ok: true, weg, vertrag: formlos ? "vor dem 03.09.2026 (monatlich kündbar — KEIN „Kulanz“)"
      : laufzeit ? `Jahresvertrag — gekündigt zum Laufzeitende, dem ${tagDeutsch(laufzeit.ende)}; vorzeitig nur aus Kulanz nach Zahlung der offenen Rechnung (Satz aus so_schreiben, wörtlich)`
      : "Jahresvertrag (Kulanz-Satz)", bestaetigung_gesendet: !!erg.mailGesendet, so_schreiben: satz },
    aktion: { werkzeug: name, ok: true, zeiten: [], ...(link ? { link } : {}), satz, ...(ohneZahlung ? { ohneZahlung: true } : {}) },
  };
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
  const { auskunftStand, auskunftArtFuer, standZumZeigen } = await import("./fiaon-auskunft");
  // Dieselbe Art wie der Kauflink unten — sonst nennte Mara 74 € und die Seite zeigte 199 €.
  // Gegenlesen E-241: Art und Land aus seiner Lage (auskunftLage) — bei Antrag und Lead die des
  // Takt-Angebots, beim zahlenden Kunden dieselbe Regel wie bisher (auskunftArtFuer, Land aus dem Antrag).
  const auskunftArt = ctx.auskunft.art ?? await auskunftArtFuer(ctx.personId);
  // Integration 26.09.2026 (E-243): standZumZeigen — eine offene Bestellung, die auskunftBestellen nicht wiederverwenden würde (älter als 21 Tage, teurer als heute), zeigt keinen Zahlungslink, sondern den Kauf zum heutigen Preis.
  const stand = standZumZeigen(await auskunftStand(ctx.personId, undefined, auskunftArt));
  const land = ctx.auskunft.land ?? stand.land;
  // E-365 (14.10.2026): privat die FIAON-Bonitätsauswertung — nie verkaufen bei „inklusive“ (im Paket enthalten) und „auswertung“ (liegt vor);
  // „dokument“ (eigene Datenkopie) hält privat nicht mehr auf.
  const privat = auskunftArt !== "firma";
  if (stand.stufe === "bezahlt") {
    return nein(privat
      ? "Die Bonitätsauswertung ist schon bezahlt — nichts verkaufen. Sag ihm: Wir entwickeln sie; dafür brauchen wir Ausweis und Kontoauszüge der letzten drei Monate (Link per E-Mail, sonst fiaon.com/app/unterlagen)."
      : "Die Firmen-Auskunft ist schon bezahlt — wir holen sie ein. Nichts verkaufen.");
  }
  if (privat && stand.stufe === "inklusive") return nein(`Die Bonitätsauswertung ist in seinem Paket ENTHALTEN — kein Preis, kein Link. Sag ihm: „${AUSWERTUNG_INKLUSIVE_SATZ}" (hochladen in seinem Bereich unter fiaon.com/app/unterlagen).`);
  if (privat && stand.stufe === "auswertung") return nein("Seine Bonitätsauswertung liegt schon vor — nichts verkaufen. Sie liegt in seinem Bereich unter fiaon.com/app/auswertung (und kam als PDF per E-Mail).");
  // E-367: auch privat — wer seine Auskunft hochgeladen hat (meist schon ausgewertet), bekommt kein Angebot.
  if (stand.stufe === "dokument") return nein("Eine Auskunft liegt schon in seiner Akte (meist schon ausgewertet) — nichts verkaufen. Fragt er nach der Bonitätsauswertung, darf er sie in seinem Bereich unter fiaon.com/app/unterlagen selbst bestellen.");
  if (stand.offen?.status === "claimed_paid") return nein("Er hat die Zahlung schon gemeldet — die Zahlungsstelle prüft den Eingang. Kein Link.");
  const kunde = String(ctx.kunde ?? "");
  const du = String(ctx.letzteDu ?? "");
  const zugestimmt = auskunftZugestimmt(kunde, du);
  const sperre = werbungVerboten(await menschSperre(Number(ctx.personId)).catch(() => null));
  if (sperre && !zugestimmt && !auskunftGefragt(kunde)) return nein(`${sperre} — die ${privat ? "Bonitätsauswertung" : "Auskunft"} nur, wenn er sie ausdrücklich haben will. Kein Angebot.`);

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
      wort: privat ? AUSWERTUNG_NAME : auskunftWort(land),
      ...(privat ? { unterlagen: AUSWERTUNG_UNTERLAGEN_SATZ, ehrlich: AUSWERTUNG_KEINE_AUSKUNFT_SATZ } : { auskunfteien: auskunfteienText(land) }),
      was_passiert: (art === "angebot"
        ? "Über den Link bestätigt er die Bestellung mit einem Klick; danach sieht er Betrag, Verwendungszweck und QR-Code."
        : "Der Link ist seine Zahlungsseite mit Betrag, Verwendungszweck und QR-Code.")
        + (privat ? " Danach lädt er Ausweis und Kontoauszüge über den Link aus der E-Mail hoch — ohne Anmeldung." : ""),
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
  // E-365: privat heißt das Produkt FIAON-Bonitätsauswertung.
  const was = ein.art === "bestellt" ? `hat die Bonitätsauswertung für ihn bestellt (${ein.betrag}, Zahlung offen)`
    : ein.art === "offen" ? `hat ihm den Link zur offenen Zahlung seiner Bonitätsauswertung geschickt (${ein.betrag})`
    : `hat ihm die Bonitätsauswertung angeboten (${ein.betrag}) und den Link zum Bestellen geschickt`;
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
    const anruf = segment === "antrag" ? "Bitte kurz anrufen: die Bonitätsauswertung erklären (aus Ausweis und Kontoauszügen, keine Auskunft einer Auskunftei) und die erste Zahlung für sein Paket mitnehmen."
      : segment === "lead" ? "Bitte kurz anrufen: die Bonitätsauswertung erklären (aus Ausweis und Kontoauszügen, keine Auskunft einer Auskunftei) und seinen Antrag mitnehmen."
      : "Bitte kurz anrufen: Bonitätsauswertung, Karte und Wunschlimit besprechen.";
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      ...(agentId ? { agentId } : {}),
      personId, ref: null,
      titel: ein.art === "bestellt" ? "WhatsApp: Bonitätsauswertung bestellt — bitte begleiten"
        : segment === "kunde" ? "WhatsApp: Bonitätsauswertung angeboten — bitte nachfassen"
        : `WhatsApp: Bonitätsauswertung angeboten (${segment === "antrag" ? "Antrag offen" : "Interessent"}) — bitte nachfassen`,
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
/**
 * E-265 Nachbesserung (29.09.2026, r10.mts): Bestätigt der Text eine Kündigung („Ihre Kündigung ist heute bei uns
 * eingegangen", „… ist vorgemerkt", „Kündigung liegt uns vor", „Bestellung wurde storniert")? Verneinte Sätze und
 * Maras Rückfrage („Soll ich Ihre Kündigung aufnehmen?") zählen nicht. Der Satz oder null. Rein.
 */
export function kuendigungBestaetigt(text: string): string | null {
  // Daten („am 29.09., bei uns eingegangen") sind kein Satzende — die Punkte fallen vorher weg.
  const saetzeListe = String(text ?? "").replace(/https?:\/\/\S+/g, " ").replace(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/g, "$1/$2/$3").split(/(?<=[.!?])\s+|\n+/);
  const muster = [
    /\b(?:kündigung|kuendigung|stornierung|storno)\b[^.!?]{0,60}?\b(?:ist|sind|wurde|wurden|habe|haben)\b[^.!?]{0,40}?\b(?:eingegangen|vorgemerkt|vermerkt|erfasst|aufgenommen|eingetragen|gebucht|bestätigt|bestaetigt|erledigt|wirksam|angenommen|umgesetzt)\b/i,
    /\b(?:kündigung|kuendigung)\b[^.!?]{0,40}\b(?:liegt|lag)\b[^.!?]{0,30}\bvor\b/i,
    /\b(?:bestellung|vertrag|abo)\b[^.!?]{0,40}\b(?:ist|wurde)\s+(?:\S+\s+){0,2}?(?:storniert|gekündigt|gekuendigt|beendet)\b/i,
    /\bkündigungswunsch\b[^.!?]{0,40}\b(?:aufgenommen|vorgemerkt|eingetragen)\b/i,
  ];
  for (const s of saetzeListe) {
    if (/\?/.test(s) || /\b(?:nicht|noch\s+kein\w*|keine?)\b/i.test(s)) continue;
    for (const m of muster) { const t = s.match(m); if (t) return t[0].slice(0, 90); }
  }
  return null;
}

export function handlungsPruefung(
  antwort: string, aktionen: Aktion[], kunde: string, verlaufText = "",
  /** E-240: Links und Auskunft-Preise, die aus SEINE LAGE stammen (null = Lead: nur die vier Katalogpreise). */
  bekannt: {
    links?: string[]; auskunftPreise?: string[] | null; /** Gegenlesen 24.09.2026: sein Land (nur bei Kunden bekannt). */ land?: AuskunftLand | null;
    /** E-248 (Fall K.): sein Termin im Kalender (kuenftigerTermin) — seine Uhrzeit ist wahr. */
    termin?: { uhrzeit: string; vorname?: string | null } | null;
    /** E-265: Uhrzeiten, die der Server wahr gemacht hat (der nächste freie Platz im Abschluss-Satz). */
    zeiten?: string[];
    /**
     * E-265: Zahlungsruhe über den VERLAUF — in den letzten 24 Stunden war von Kündigung, Widerruf, Stopp oder
     * Beschwerde die Rede (vorher nur die offene Nachricht: #1401 „Bitte tun sie das" nach der Kündigung).
     */
    ruhe?: boolean;
    /** E-401 (2/6): Warum Ruhe gilt, wenn nicht wegen Kündigung/Widerruf/Stopp/Beschwerde (z. B. „er nennt einen Termin“) — für den Hinweis. */
    ruheGrund?: string | null;
    /** E-265 Nachbesserung: sein Vertrag ist gekündigt (gekuendigt_am) — „Ihre Kündigung liegt vor" ist dann wahr. */
    gekuendigt?: boolean;
    /** E-265 Nachbesserung: Jahresvertrag (agb_stand ab 03.09.2026) — nur dann darf „Kulanz" stehen. */
    jahresvertrag?: boolean | null;
    /** E-265 Nachbesserung: Lage „beendet" mit offener Rate — Justins Formel darf dort ohne Werkzeug stehen. */
    beendetMitRate?: boolean;
    /**
     * E-265 Nachbesserung 2 (01.10.2026): false = nach den genannten Raten bleibt im System noch etwas offen (Lage
     * „beendet", Altbestand) — dann nie „danach kommt nichts mehr" ohne Werkzeug.
     */
    nichtsMehr?: boolean;
    /** E-265 Nachbesserung 2: seine Kündigungs-Lage (kuendigungEinordnen) — für die Form der verbindlichen Rückfrage. */
    kuendigung?: KuendigungEinordnung | null;
    /** E-265 Nachbesserung 2: Er hat selbst vom Aussteigen gesprochen (AUSSTIEG_WORT) — nur dann darf die Rückfrage stehen. */
    kuendigungThema?: boolean;
    /** E-265 Schluss-Nachbesserung: unbezahlte Bestellung — die verbindliche Rückfrage ist die Storno-Form (STORNO_RUECKFRAGE). */
    unbezahlt?: boolean;
    /**
     * E-265 Schluss-Nachbesserung (Probe 3 k03): Er VERNEINT nur eine Kündigung („Ich will nich kündigen!! … mach ich heute
     * abend") — das ist kein heikles Anliegen; seine Zahlungsseite darf in die Antwort (nurVerneinteKuendigung).
     */
    kuendigungVerneint?: boolean;
  } = {},
): string[] {
  const a = String(antwort ?? "");
  const funde: string[] = [];
  const gebucht = aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok);
  // E-248: Ein Termin, der schon im Kalender steht (vom Kunden, vom Team oder von Mara), darf
  // „steht" heißen — auch wenn Mara ihn in diesem Lauf nicht selbst gebucht hat.
  const terminDa = !!bekannt.termin || aktionen.some((x) => !!x.bestehend);
  if (!gebucht && !terminDa && /\b(?:ist|wurde|habe|hab)\s+(?:\w+\s+){0,3}(?:eingetragen|gebucht)\b|\b(?:termin|rückruf|anruf)\b[^.!?]{0,40}\b(?:steht|eingetragen|gebucht|bestätigt)\b/i.test(a)
    && !/\b(?:schon|bereits)\b[^.!?]{0,40}\b(?:termin|rückruf)\b/i.test(a)) {
    funde.push("Du hast keinen Rückruf eingetragen — sag nicht, er sei eingetragen oder gebucht. Trag ihn mit rueckruf_eintragen ein oder frag nach der Zeit.");
  }
  // E-248: Uhrzeiten in JEDER Schreibweise, in beide Richtungen (uhrzeitenIn): „20 Uhr" des Kunden,
  // „20Uhr" der Kollegin und sein Termin sind bekannt — eine erfundene „21 Uhr" von Mara fällt auf.
  const bekannteZeiten = new Set<string>([
    // Auch sein Wunsch, wenn der gebuchte Platz davon abweicht („15 Uhr ist schon vergeben — 15:20 Uhr").
    ...aktionen.flatMap((x) => [...x.zeiten, ...(x.bestehend ? [x.bestehend.uhrzeit] : []), ...(x.abweichung ? [x.abweichung.wunsch] : [])]),
    ...uhrzeitenIn(`${kunde}\n${verlaufText}`),
    ...(bekannt.termin?.uhrzeit ? [bekannt.termin.uhrzeit] : []),
    ...(bekannt.zeiten ?? []),
  ].map((t) => String(t).padStart(5, "0")));
  const genannt = uhrzeitenIn(a);
  const fremd = genannt.filter((t) => !bekannteZeiten.has(t));
  if (fremd.length) {
    const erlaubt = Array.from(bekannteZeiten).filter((t) => /^\d{2}:\d{2}$/.test(t)).slice(0, 6);
    funde.push(`Die Uhrzeit ${fremd.map(uhrText).join(", ")} stammt aus keinem Werkzeug und steht nicht in seinem Termin — nenne nur Zeiten aus freie_zeiten, rueckruf_eintragen oder seinem Termin${erlaubt.length ? ` (bekannt: ${erlaubt.map(uhrText).join(", ")})` : ""}.`);
  }

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
      // E-248 (Befund 577): „Die 79,99 € sind die erste Monatsrate …, dann kümmern wir uns um Ihre
      // Schufa" — die Rate eines Pakets ist nie ein Auskunft-Preis (die Beträge überschneiden sich nicht).
      if (c != null && PAKET_RATEN_CENTS.has(c)) continue;
      // Nachbesserung E-248 (Probelauf M109: „Rahmen bis 10.000 € ohne Schufa" galt als falscher
      // Auskunft-Preis): Die teuerste Auskunft kostet 349 € — ab 500 € ist es nie ihr Preis. Auch
      // nicht ein Betrag, den er selbst genannt hat, oder einer nach „Rahmen/bis/Ziel".
      if (c != null && c >= 50_000) continue;
      const nackt = m[1].replace(/\./g, "").replace(/,00$/, "");
      if (nackt && String(kunde ?? "").replace(/\./g, "").includes(nackt)) continue;
      const davor = satz.slice(Math.max(0, (m.index ?? 0) - 30), m.index ?? 0);
      if (/\b(?:rahmen|kartenrahmen|bis(?:\s+zu)?|ziel|limit|wunsch)\b[^.!?]{0,15}$/i.test(davor)) continue;
      if (c != null && !erlaubtePreise.has(c)) funde.push(`Der Betrag ${m[0].trim()} für die Auskunft stimmt nicht — nenne nur den Preis aus SEINE LAGE oder aus auskunft_anbieten.`);
    }
  }
  // ── NACHBESSERUNG E-248: ZAHLUNGSRUHE AUCH AUF WHATSAPP ─────────────────────
  // Wie die Mail (zahlungsRuhe/fordertZahlung): Auf Widerruf, Storno, Kündigung,
  // Erstattung, Beschwerde oder „kann nicht zahlen" gibt es keine Zahlungsseite und
  // keine Bitte um Zahlung — außer er fragt selbst ausdrücklich, wo er zahlen kann.
  const fragtZahlweg = /\b(?:wo|wie)\s+(?:\w+\s+){0,3}?(?:be)?zahl|zahlungs(?:link|seite|daten)|link\s+zum\s+(?:be)?zahlen|kontodaten|iban/i.test(kunde);
  // E-265 (29.09.2026, Justin): Nach einer Kündigung geht die Zahlungsseite NUR mit seiner Formel raus —
  // Jahresvertrag „… dann lasse ich Sie aus Kulanz gerne aus dem Vertrag", Altvertrag „… danach kommt nichts mehr".
  // Nachbesserung (29.09.2026, Recht/Regression — handlung.mts, r10.mts): Der Wortlaut allein nahm die Zahlungsruhe
  // und die Stopp-Prüfung weg — auch ohne gebuchte Kündigung, beim Widerruf und bei „kann nicht zahlen". Jetzt zählt
  // die Formel nur, wenn kuendigung_aufnehmen gebucht hat oder die Lage „beendet" mit offener Rate vorliegt — nie bei
  // Widerruf oder „kann nicht zahlen".
  const kuendigungGebucht = aktionen.some((x) => x.werkzeug === "kuendigung_aufnehmen" && x.ok);
  // E-396 (19.10.2026): dazu DIE EINE Kulanz-Fassung („… entlassen wir Sie aus Kulanz vorzeitig aus dem Vertrag …“).
  const kuendigungsFormel = /aus\s+kulanz\s+gerne\s+aus\s+dem\s+vertrag|aus\s+kulanz\s+vorzeitig\s+aus\s+dem\s+vertrag|danach\s+kommt\s+nichts\s+mehr|zahlen\s+sie\s+bitte\s+noch/i.test(a);
  const widerrufJetzt = /wi(?:e)?der(?:r)?uf/i.test(kunde);
  const formelGedeckt = kuendigungsFormel && (kuendigungGebucht || !!bekannt.beendetMitRate) && !widerrufJetzt && !kannNichtZahlen(kunde);
  // Nachbesserung (r2.mts): Ein aktuelles Kaufsignal („Ich zahle jetzt") oder die Bitte um den Link hebt die Ruhe
  // aus dem Verlauf auf. „Keine Karte — wozu zahlen?" dagegen NICHT mehr (ruhe.mts: Widerruf gestern, heute
  // „keine Karte" — die Zahlungsseite ging raus).
  const kaufJetzt = kaufSignal(kunde) || /\bschick\w*[^.!?]{0,30}\blink\b|\blink\b[^.!?]{0,30}\bschick/i.test(kunde);
  const ruheJetzt = !!bekannt.ruhe && !kaufJetzt;
  // E-265 Schluss-Nachbesserung (Probe 3 k03): „Ich will nich kündigen!! hab die rate nur vergessen, mach ich heute abend" —
  // eine VERNEINTE Kündigung ist kein heikles Anliegen (vorher verbot die Prüfung genau dem, der zahlen will, die Seite).
  const heikelHier = heikelAnliegen(kunde) && !bekannt.kuendigungVerneint;
  if ((heikelHier || kannNichtZahlen(kunde) || ruheJetzt) && !(fragtZahlweg && !kannNichtZahlen(kunde)) && !formelGedeckt) {
    const zahlLink = /\/zahlung\/\S+/i.test(a);
    // E-275 Ton (02.10.2026): auch die neue Aufforderung („Zahlen Sie jetzt die Aktivierung“) und der neue Nutzen-Satz
    // („Ihr Account ist sofort nach Zahlungseingang aktiv“) sind eine Bitte um Zahlung — in der Ruhe nie. E-276 (02.10.2026):
    // auch in der neuen Wortstellung „mit Ihrem Verwendungszweck ist Ihr Account sofort nach Zahlungseingang aktiv“.
    // E-373 (15.10.2026, Justins neuer Verkaufssatz): „nach Ihrer Zahlung … schalten wir umgehend Ihren Account frei“ (B) ist
    // eine Bitte um Zahlung; Stufe A („sobald wir Ihre Zahlung … zugeordnet haben, schalten wir umgehend …“) bleibt frei.
    const bitte = a.match(/\b(?:bitte|jetzt|zeitnah|umgehend|gleich)\b[^.!?\n]{0,60}?\b(?:begleichen|bezahlen|überweisen|ueberweisen)\b|\b(?:begleichen|bezahlen|überweisen|ueberweisen)\s+sie\b|nach\s+der\s+zahlung\s+ist\s+ihr\s+account\s+aktiv|schaltet\s+das\s+system\s+sie\s+frei|zahlen\s+sie\s+bitte\s+noch|\bzahlen\s+sie\s+(?:jetzt|gleich|heute|die\s+aktivierung)\b|account\s+(?:ist\s+)?sofort\s+nach\s+(?:dem\s+)?(?:zahlungs)?eingang|(?<!zugeordnet\s+haben,\s+)ist\s+ihr\s+account\s+sofort\s+(?:nach|aktiv)\b|(?<!zugeordnet\s+haben,\s+)schalten\s+wir\s+umgehend\s+ihren\s+account\s+frei/i);
    if (zahlLink || bitte) {
      // E-265 Nachbesserung (29.09.2026, Verkauf, f04): „sag, wer es mit ihm klärt" machte aus einem guten Entwurf
      // „Herr Stripling klärt das persönlich" — bis Fr 02.10. klärt es niemand. Auf „kann nicht zahlen" der leichteste Weg.
      funde.push(kannNichtZahlen(kunde)
        ? "Er schreibt „kann nicht zahlen“ — darauf keine Zahlungsseite und keine Bitte um Zahlung. Zeig den leichtesten Weg: das kleinere Paket mit seinem Ziel, oder frag, wann es ihm passt (zahlungszusage_merken), und biete den Anruf mit einer Zeit an. Übergeben nur, wenn er eine Stundung oder Ratenpause will."
        : `Er schreibt über ${heikelHier ? "Kündigung, Storno, Widerruf oder Erstattung" : bekannt.ruheGrund ?? "Kündigung, Widerruf, Stopp oder Beschwerde (in den letzten 24 Stunden)"} — darauf keine Zahlungsseite und keine Bitte um Zahlung. Zeig Verständnis und beantworte sein Anliegen; eine Kündigung nimmst du erst nach seinem Ja auf die verbindliche Rückfrage mit kuendigung_aufnehmen auf (der Satz kommt aus dem Werkzeug).`);
    }
  }
  // E-265 (Fall 5627, 29.09.): „Verstanden, dann stoppen wir hier" — gesetzt war nichts, Rechnung und Mahnung liefen
  // weiter. Ein Stopp-Satz ist eine Zusage; sie braucht die aufgenommene Kündigung (oder ein Storno).
  if (/\b(?:stoppen|beenden)\s+wir\s+(?:hier|das|alles)\b|\bwir\s+(?:stoppen|beenden)\s+(?:hier|das|alles)\b|\b(?:schreiben|melden)\s+(?:wir\s+)?(?:uns\s+)?(?:ihnen\s+)?(?:ab\s+jetzt\s+)?nicht\s+mehr\b|\bkommt\s+(?:von\s+uns\s+)?nichts\s+mehr\b/i.test(a)
    && !kuendigungGebucht && !(kuendigungsFormel && bekannt.beendetMitRate)) {
    funde.push("„Dann stoppen wir hier“ / „danach kommt nichts mehr“ / „wir schreiben Ihnen nicht mehr“ ist eine Zusage, die kein Werkzeug gedeckt hat — nimm sie nur mit kuendigung_aufnehmen (klare Kündigung oder Absage einer unbezahlten Bestellung) oder sag ehrlich, was jetzt passiert.");
  }
  // E-265 Nachbesserung (29.09.2026, Recht, r10.mts): „Ihre Kündigung ist eingegangen/vorgemerkt/erledigt" ohne
  // gebuchtes Werkzeug und ohne gekündigten Vertrag — wie bestaetigtKuendigung im Postfach, dazu „eingegangen".
  const bestaetigt = kuendigungBestaetigt(a);
  if (bestaetigt && !kuendigungGebucht && !bekannt.gekuendigt) {
    funde.push(`Du bestätigst eine Kündigung („${bestaetigt}“), die NICHT gebucht ist — gebucht wird nur nach seinem Ja auf die verbindliche Rückfrage; will er kündigen, stell sie jetzt wörtlich: „${KUENDIGUNG_RUECKFRAGE}"`);
  }
  // ── E-265 Nachbesserung 2 (01.10.2026): DIE VERBINDLICHE RÜCKFRAGE, WÖRTLICH UND ALLEIN ─────────────────────────
  // Nur ein Ja auf GENAU diese Frage bucht (jaAufKuendigungsAngebot). Eine andere Form („Soll ich Ihre Kündigung
  // aufnehmen?", „Möchten Sie trotzdem kündigen?") oder eine zweite Frage daneben ließe sein Ja ins Leere laufen —
  // er hielte sich für gekündigt. Nach Rücknahme oder Bestreiten nie eine Rückfrage zur Kündigung.
  // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f17): ZWEI wörtliche Formen — Kündigung, bei einer unbezahlten
  // Bestellung Storno. Eine freie Storno-Frage („Soll ich Ihre Bestellung … stornieren?" ohne die Form) fiel vorher nicht
  // auf (das Muster kannte nur „kündig"), und das Ja darauf zählte nicht.
  const formJetzt = verbindlicheRueckfrage(a);
  const rueckfrageDa = !!formJetzt;
  const formSoll = rueckfrageFuer(bekannt.unbezahlt);
  if (!rueckfrageDa && KUENDIGUNG_ANGEBOT_FRAGE.test(a) && !kuendigungGebucht) {
    funde.push(`Die Frage zur ${bekannt.unbezahlt ? "Stornierung seiner unbezahlten Bestellung" : "Kündigung"} stellst du nur wörtlich so: „${formSoll}" — keine andere Form („Soll ich … aufnehmen?", „Möchten Sie trotzdem kündigen?", „Möchten Sie wissen, …?").`);
  }
  if (formJetzt && bekannt.unbezahlt != null && formJetzt !== (bekannt.unbezahlt ? "storno" : "kuendigung")) {
    funde.push(bekannt.unbezahlt
      ? `Seine Bestellung ist unbezahlt — da gibt es nichts zu kündigen. Frag wörtlich: „${STORNO_RUECKFRAGE}"`
      : `Er hat einen bezahlten Vertrag — eine Bestellung „stornierst" du nicht. Frag wörtlich: „${KUENDIGUNG_RUECKFRAGE}"`);
  }
  if (rueckfrageDa && (a.replace(/https?:\/\/\S+/g, " ").match(/\?/g) ?? []).length !== 1) {
    funde.push(`„${formSoll}" ist die EINZIGE Frage deiner Nachricht — keine zweite Frage (kein Termin, kein „okay?“), sonst zählt sein Ja nicht.`);
  }
  if (rueckfrageDa && (bekannt.kuendigung === "zurueck" || bekannt.kuendigung === "bestreitet")) {
    funde.push(bekannt.kuendigung === "zurueck"
      ? "Er hat die Kündigung verneint oder zurückgenommen — frag NICHT nach einer Kündigung; geh auf sein Anliegen ein."
      : "Er bestreitet den Vertrag oder schreibt von einer falschen Nummer — keine Kündigung, kein Storno, keine Rückfrage dazu.");
  }
  // E-265 Schluss-Nachbesserung (Probe 3 k04): Fragt er nur nach Frist oder Folgen, gibt es keine Rückfrage zur Kündigung.
  if (rueckfrageDa && kuendigungFristFrage(kunde) && !kuendigungBitte(kunde) && bekannt.kuendigung !== "klar" && bekannt.kuendigung !== "bestaetigt") {
    funde.push("Er fragt nur nach Frist oder Folgen der Kündigung — beantworte genau das, mit der Karte vorn; keine Rückfrage zur Kündigung, kein Angebot.");
  }
  if (rueckfrageDa && bekannt.kuendigungThema === false) {
    funde.push("Er hat die Kündigung nicht angesprochen — Kündigung oder Storno bietest du NIE von dir aus an.");
  }
  if (bekannt.nichtsMehr === false && /danach\s+kommt\s+nichts\s+mehr|es\s+kommt\s+danach\s+nichts\s+mehr/i.test(a) && !kuendigungGebucht) {
    funde.push("„Danach kommt nichts mehr“ stimmt bei ihm nicht — nach dieser Rate steht noch etwas offen. Nenn nur die Rate(n) aus SEINE LAGE, ohne diesen Satz.");
  }
  // E-265 Nachbesserung (Recht): „Kulanz" nur beim Jahresvertrag und nur mit dem Satz aus dem Werkzeug — beim Vertrag
  // vor dem 03.09.2026 ist die Kündigung sein Recht (§ 5 UWG: Irreführung über ein bestehendes Recht).
  if (/kulanz/i.test(a) && (!bekannt.jahresvertrag || !(kuendigungGebucht || bekannt.beendetMitRate))) {
    funde.push(bekannt.jahresvertrag
      ? "„Kulanz“ sagst du nur mit dem Satz aus kuendigung_aufnehmen — nie als eigenes Angebot."
      : "„Kulanz“ gibt es bei ihm nicht: Sein Vertrag ist vor dem 03.09.2026 geschlossen und monatlich kündbar — die Kündigung ist sein Recht. Schreib ohne „Kulanz“.");
  }
  // ── GEGENLESEN 24.09.2026: ÖSTERREICH UND SCHWEIZ NIE „SCHUFA" ─────────────
  // Harte Regel des Auftrags (E-240). Bisher stand sie nur im Auftrag an das Modell;
  // die allgemeinen Sätze („Ihre Schufa muss nicht perfekt sein") sagen das Wort aber.
  // Schreibt er es selbst, darf Mara es aufgreifen.
  if (bekannt.land && bekannt.land !== "DE" && /schufa/i.test(a) && !/schufa/i.test(kunde)) {
    funde.push(`In seinem Land heißt die Auskunft „${auskunftWort(bekannt.land)}" — schreib nie „SCHUFA", sondern „Bonität" bzw. ${auskunfteienText(bekannt.land)}; unser Produkt heißt „${AUSWERTUNG_NAME}".`);
  }
  return Array.from(new Set(funde));
}

// ═══════════════════════════════════════════════════════════════════════════
// REPARIEREN, WAS MECHANISCH GEHT (E-248)
//
// Sechs Kundennachrichten enthielten „2026-09-24 20:10" (Werkzeugformat), einige
// Emojis oder Sternchen kamen aus dem Modell. Das lässt sich ohne zweiten Entwurf
// sicher richten — ein Rückfallsatz wegen eines Datumsformats wäre absurd.
// „Limit" → „Rahmen" nur als LETZTES Mittel (Grammatik) — vorher schreibt das Modell neu.
// ═══════════════════════════════════════════════════════════════════════════
export function reparieren(text: string, opt: { limit?: boolean; jetzt?: Date; kunde?: string | null } = {}): string {
  const jetzt = opt.jetzt ?? new Date();
  let t = String(text ?? "");
  const links: string[] = [];
  t = t.replace(/https?:\/\/\S+/g, (u) => { links.push(u); return `\u0000${links.length - 1}\u0000`; });
  // „am 2026-09-24 20:10 Uhr" / „2026-09-24 20:10" → „heute um 20:10 Uhr"
  // (Die Präposition davor fällt weg — zeitFuerKunde bringt „heute um", „am Freitag, … um" selbst mit.)
  t = t.replace(/\b(?:am\s+|um\s+|für\s+(?:den\s+)?)?(20\d{2}-\d{2}-\d{2})[ T,]+(?:um\s+)?(\d{1,2}:\d{2})(?:\s*Uhr)?/g, (_m, d, h) => zeitFuerKunde(`${d} ${h.padStart(5, "0")}`, jetzt));
  // „vom 2026-09-19" → „vom Samstag, 19. September"; „am 2026-09-19" → „am Samstag, 19. September"
  t = t.replace(/\b(20\d{2})-(\d{2})-(\d{2})\b/g, (_m, j, mo, d) => datumFuerKunde(new Date(Date.UTC(Number(j), Number(mo) - 1, Number(d), 12))));
  // Emojis und Sternchen (WhatsApp) — ersatzlos.
  t = t.replace(new RegExp("[\\p{Extended_Pictographic}\\u{1F3FB}-\\u{1F3FF}\\u200D\\uFE0F]", "gu"), "").replace(/\*/g, "");
  // „Transparent: Sie zahlen …" → „Sie zahlen …"
  t = t.replace(new RegExp("(^|[.!?]\\s+|\\n)transparent\\s*:\\s*(\\p{L})", "giu"), (_m, v, b) => `${v}${b.toUpperCase()}`);
  if (opt.limit) {
    // E-265: „Wunschlimit" bleibt (erlaubt, mit dem Satz über die Bank — der wird hier ergänzt, falls er fehlt).
    // E-281: Limit nur noch, wenn MARA_LIMIT_NENNEN=an — sonst Limit und Bank-Satz raus (Justin 03.10.2026).
    t = limitNennen() ? bankSatzErgaenzen(t) : ohneLimitUndBankSatz(t);
  }
  // E-298: der Satz über die Bank nur, wenn er nach Limit, Rahmen, Sicherheit oder Entscheidung gefragt hat.
  if (opt.kunde !== undefined) t = bankSatzNurWennGefragt(t, opt.kunde);
  if (opt.limit) {
    t = t.replace(/\b(Kredit|Karten)limit(s)?\b/g, (_m, w, s2) => `${w}rahmen${s2 ? "s" : ""}`)
      .replace(/\b(kredit|karten)limit(s)?\b/g, (_m, w, s2) => `${w}rahmen${s2 ? "s" : ""}`)
      .replace(/\b([Dd])as Limit\b/g, (_m, d) => (d === "D" ? "Der Rahmen" : "den Rahmen"))
      .replace(/\b([Ee])in Limit\b/g, "$1inen Rahmen").replace(/\b([Kk])ein Limit\b/g, "$1einen Rahmen")
      .replace(/\bdes Limits\b/g, "des Rahmens").replace(/\bLimits\b/g, "Rahmen").replace(/\bLimit\b/g, "Rahmen");
  }
  t = t.replace(/[ \t]{2,}/g, " ").replace(/\s+([.,!?])/g, "$1").trim();
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => links[Number(i)]);
}

/** Die Ton- und Linkprüfung aus shared/fiaon-mara-ton.ts für einen WhatsApp-Entwurf. */
export function tonUndLink(a: string, ein: {
  land?: AuskunftLand | null; kunde?: string; linkLage?: LinkLage | null;
  /** E-265: die Mitarbeiterliste (mitarbeiterListe) — ein Vorname allein ist ein harter Mangel. */
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  /** E-265: seine Namen aus der Akte — sein eigener Vorname ist kein Mitarbeiter. */
  kundeNamen?: readonly (string | null | undefined)[];
}): { hart: string[]; weich: string[]; hartIds: string[] } {
  // „support@fiaon.com" ist keine Seite — die Linkprüfung soll darin keinen nackten Link sehen.
  const ohneMail = String(a ?? "").replace(/[\w.+-]+@(?:www\.)?fiaon\.com\b/gi, " ");
  const ton: TonBefund[] = tonPruefung(ohneMail, { kanal: "whatsapp", land: ein.land ?? null, kunde: ein.kunde, mitarbeiter: ein.mitarbeiter ?? null, kundeNamen: ein.kundeNamen });
  const link: LinkBefund[] = linkPruefung(ohneMail, ein.linkLage ?? null);
  return {
    hart: [...ton.filter((f) => f.schwere === "hart").map((f) => `${f.treffer} — ${f.hinweis}`), ...link.filter((f) => f.schwere === "hart").map((f) => `${f.link} — ${f.hinweis}`)],
    weich: [...ton.filter((f) => f.schwere === "weich").map((f) => `„${f.treffer}“ — ${f.hinweis}`), ...link.filter((f) => f.schwere === "weich").map((f) => `${f.link} — ${f.hinweis}`)],
    // E-265 Nachbesserung: WELCHE harten Regeln — „nur Limit" darf nie limit_ohne_bank/limit_zusage heißen.
    hartIds: [...ton.filter((f) => f.schwere === "hart").map((f) => f.id), ...link.filter((f) => f.schwere === "hart").map(() => "link")],
  };
}

/**
 * E-265 Nachbesserung 2 (01.10.2026): Darf die Reparatur „Limit → Rahmen" es versuchen? Nur, wenn ALLE harten
 * Ton-Treffer das Wort „Limit" (limit) oder ein Limit-Satz außerhalb der weißen Liste (limit_freigabe) sind — nie
 * bei limit_zusage oder limit_ohne_bank. Gesendet wird das Ergebnis nur, wenn es danach die GANZE Prüfung besteht
 * (entwerfen: pruefe(ohne).hart leer) — „Sie bekommen Ihr Rahmen von 25.000 €" fällt dort an der weißen Liste.
 */
export function nurLimitReparierbar(hartIds: readonly string[]): boolean {
  return hartIds.length > 0 && hartIds.every((id) => id === "limit" || id === "limit_freigabe") && hartIds.includes("limit");
}

/**
 * Die Teile von Justins Formel in einer Antwort (E-265 Schluss-Nachbesserung, 01.10.2026) — für „verliert Entwurf 2 etwas?".
 * Rein.
 */
export function formelTeile(a: string, ab?: { ziel?: KartenZiel | null; betrag?: string | null } | null): string[] {
  const t = String(a ?? "");
  const teile: string[] = [];
  if (/kreditkarte/i.test(t)) teile.push("Karte");
  const zielText = ab?.ziel ? euroGanz(ab.ziel.euro) : null;
  if (zielText && (t.includes(zielText) || t.includes(zielText.replace(/\s€$/, ""))) && BANK_SATZ_MUSTER.test(t)) teile.push("Ziel mit Bank-Satz");
  if (ab?.betrag && t.includes(ab.betrag)) teile.push("Betrag");
  if (/schaltet[^.!?]{0,30}\bfrei\b|freigeschaltet|account\s+aktiv/i.test(t)) teile.push("Freischaltung");
  if (/https?:\/\/\S+/.test(t)) teile.push("Link");
  if (/\bkeine\s+bank\b|kein\w*\s+kreditinstitut|kein\w*\s+kredit(?:betrag)?\b/i.test(t)) teile.push("„kein Kreditinstitut“");
  if (/(?:überweis\w*|zahlen)[^.!?]{0,30}\bselbst\b|abgebucht\s+wird\s+nichts|nichts\s+wird\s+abgebucht/i.test(t)) teile.push("„Sie überweisen selbst“");
  return teile;
}
/** Welche Formel-Teile aus Entwurf 1 fehlen in Entwurf 2 — außer ein Hinweis verlangte das Weglassen. Rein. */
export function formelVerloren(a1: string, a2: string, hinweise: readonly string[], ab?: { ziel?: KartenZiel | null; betrag?: string | null } | null): string[] {
  // Nur, wenn der erste Entwurf allein an der LÄNGE scheiterte (Probe 3 f03/f05/l03) — jeder andere Hinweis (Sprache,
  // Hürde, Wiederholung, Weglassen …) hat Vorrang vor der Formel.
  if (!hinweise.length || !hinweise.every((h) => /^Zu lang|Kürzer: ein bis drei Sätze/i.test(h))) return [];
  const zwei = new Set(formelTeile(a2, ab));
  return formelTeile(a1, ab).filter((x) => !zwei.has(x));
}

/** Was für den zweiten Entwurf wahr ist — die erlaubten Werte statt nur des Verbots (E-248). */
export interface ErlaubteWerte { zeiten?: string[]; termin?: string | null; link?: string | null }

/**
 * Der Entwurf: denken (mit Werkzeugen) → reparieren → harte Wand + Wahrheit + Handlung + Ton +
 * Link + Verkaufsprüfung → höchstens EIN zweiter Entwurf mit allen Hinweisen UND den erlaubten
 * Werten (OHNE Werkzeuge — gebucht ist gebucht; der zweite Entwurf sieht die Ergebnisse). Hält der
 * zweite die harte Wand nicht, der erste aber schon, geht der erste. Exportiert, damit der
 * Prüfstand genau diesen Weg durchspielen kann.
 */
export async function entwerfen(
  system: string,
  pruef: {
    kunde: string; kontext?: string; letzteDu: string[]; verkaufen: boolean; verlaufText?: string; zahlungslage?: boolean;
    auskunftAngebot?: boolean; werbesperre?: boolean; bankLinkOk?: boolean;
    /** E-275: Ein Anruf ist hier richtig (verkaufsPruefung) — maraAntwortet gibt ihn mit; der Typ fehlte (Gegenprüfung Verkauf). */
    anrufOk?: boolean;
    bekannt?: { links?: string[]; auskunftPreise?: string[] | null; land?: AuskunftLand | null; termin?: { uhrzeit: string; vorname?: string | null } | null; zeiten?: string[]; ruhe?: boolean; ruheGrund?: string | null;
      gekuendigt?: boolean; jahresvertrag?: boolean | null; beendetMitRate?: boolean;
      /** E-265 Nachbesserung 2: false = nach den genannten Raten bleibt noch etwas offen; die Kündigungs-Lage. */
      nichtsMehr?: boolean; kuendigung?: KuendigungEinordnung | null; kuendigungThema?: boolean;
      /** E-265 Schluss-Nachbesserung: Form der Rückfrage und verneinte Kündigung (handlungsPruefung). */
      unbezahlt?: boolean; kuendigungVerneint?: boolean };
    /** E-248: seine Link-Lage (persoenlicherLink) — ohne sie prüft linkPruefung nur „nackt". */
    linkLage?: LinkLage | null;
    /** E-248: sein Land für die Tonprüfung (AT/CH nie „SCHUFA") — auch ohne Auskunft-Gespräch. */
    land?: AuskunftLand | null;
    erlaubt?: ErlaubteWerte;
    /** E-248: sein persönlicher Link (für die Verkaufsprüfung „er will bestellen"). */
    link?: string | null;
    /** E-253 (28.09.2026): Vor- und Nachname des Kunden aus der Akte (empfaengerNamen) — kein Text von Mara. */
    namen?: readonly string[];
    /** E-265: die Mitarbeiterliste — ein Mitarbeiter-Vorname allein ist hart (mitarbeiter_vorname). */
    mitarbeiter?: readonly MitarbeiterEintrag[] | null;
    /** E-265: seine Abschluss-Lage — dann prüft abschlussPruefung (weich) Karte, Ziel, Betrag, Frage. */
    abschluss?: { art: AbschlussArt | null; ziel?: KartenZiel | null; betrag?: string | null; kontext?: string | null;
      /** E-265 Schluss-Nachbesserung (Probe 4 f04): Preis-Einwand — das kleinere Paket (Name) und die feste Antwort dazu. */
      teuer?: { paket: string; satz: string } | null } | null;
    /** E-265 Schluss-Nachbesserung: seine Limit-Frage — die feste Antwort und die Zahl, die hineingehört. */
    limitFrage?: { satz: string; zahl: string } | null;
    /**
     * E-372 (15.10.2026): „Zusagen nur, wenn ein Werkzeug sie einlöst“ — gesetzt, wenn hier niemand eine Zusage einlöst
     * (kein Anrufwunsch, kein Termin, keine offene Karte bei Justin). Dann ist „Herr X meldet sich / ich gebe Bescheid /
     * das Team prüft“ eine harte Wand. `namen`: Betreuer und Anrufer (Nennform und Vorname). Ohne: keine Prüfung (wie vorher).
     */
    zusageVerboten?: { namen: readonly string[] } | null;
    /**
     * E-401 (2/6, 19.10.2026): Er nennt einen Termin (fiaon-mara-genannter-termin.ts) — dieselben Regeln wie im Postfach
     * (E-395), hart: kein Verkauf und kein Link daneben, „eingetragen“ nur, wenn eingetragen (auch ein in diesem Lauf
     * eingetragener Rückruf zählt), der eingetragene bzw. stehende Termin mit seiner Uhrzeit. Ohne: keine Prüfung.
     */
    genannt?: { eingetragen: boolean; uhrzeitTermin: string | null; satz: string | null; verkaufErlaubt?: boolean } | null;
    /**
     * E-401 (3/6, 19.10.2026): Er meldet eine Zahlung und zahlung_suchen hat im Bankbuch nachgesehen
     * (fiaon-mara-zahlung-suchen.ts) — dann ist jede Zusage („gebucht“, „angekommen“, Datum, Betrag), die dort nicht
     * steht, hart (zahlungAntwortFunde). Ohne: keine Prüfung.
     */
    zahlung?: { ergebnis: ZsErgebnis; frueher?: { datum: string; cents: number }[] } | null;
    /**
     * E-401 (4/6, 19.10.2026): Er will Anschrift, E-Mail oder Telefon ändern und angaben_aendern hat es bearbeitet
     * (fiaon-mara-angaben-aendern.ts) — dann ist jedes „geändert/gespeichert“, das nicht stimmt, hart (angabenAntwortFunde).
     */
    angaben?: AngabenLageRein | null;
  },
  werkzeugKontext?: WerkzeugKontext | null,
): Promise<{ roh: any; antwort: string; funde: string[]; hinweise: string[]; zweiter: boolean; kiFehler: string | null; aktionen: Aktion[] }> {
  const d1 = await denken(system, [], werkzeugKontext ?? null);
  const aktionen = d1.aktionen;
  const roh1 = d1.roh;
  if (!roh1) return { roh: null, antwort: "", funde: ["Kein Text erzeugt."], hinweise: [], zweiter: false, kiFehler: d1.fehler || "KI nicht erreichbar", aktionen };
  // Die Links aus den Werkzeugen gehören zu seiner Lage (Terminlink, Auskunft).
  const linkLage: LinkLage | null = pruef.linkLage ? {
    ...pruef.linkLage,
    terminLink: aktionen.find((x) => x.werkzeug === "terminlink_schicken" && x.ok && x.link)?.link ?? pruef.linkLage.terminLink ?? null,
    ...(aktionen.some((x) => x.werkzeug === "auskunft_anbieten" && x.ok && x.link) ? { auskunftLink: aktionen.find((x) => x.werkzeug === "auskunft_anbieten" && x.ok && x.link)!.link! } : {}),
  } : null;
  const land = pruef.land ?? pruef.bekannt?.land ?? null;
  // E-372: `mensch` — das Modell legt den Fall vor (mensch true): Dann ist „unsere Geschäftsführung klärt das, Sie bekommen
  // Bescheid“ gedeckt (der Server legt Justin eine Karte vor). Ein Name oder ein Anruf bleibt eine Zusage ohne Werkzeug.
  const pruefe = (a: string, vorher: string | null = null, mensch = false) => {
    if (!a) return { hart: ["Kein Text erzeugt."], nurJa: false, nurLimit: false, nurPreis: false, nurName: false, weich: [] as string[] };
    const tl = tonUndLink(a, { land, kunde: pruef.kunde, linkLage, mitarbeiter: pruef.mitarbeiter ?? null, kundeNamen: pruef.namen });
    // E-253 (28.09.2026): Nennt Mara den Kunden beim Namen, ist sein Name aus der Akte kein „du" (Partikel „du"
    // im Nachnamen, „…ğdu") — sonst verwarf sie einen richtigen Entwurf und sollte „ohne diese Wörter" neu schreiben.
    const wand = sendePruefung(a, { namen: pruef.namen });
    // E-372: Eine Ratenpause, die ratenpause_setzen wirklich gesetzt hat, darf er lesen — sonst bleibt die Regel hart.
    const pauseGesetzt = aktionen.some((x) => x.werkzeug === "ratenpause_setzen" && x.ok);
    const wahr = wahrheitsBefunde(a, pruef.kunde).filter((f) => !(f.art === "stundung" && pauseGesetzt));
    // E-372: Eine Zusage ist gedeckt, wenn ein Werkzeug Justin den Fall vorlegt (Kartenlink-Ausschluss, Härtefall der Pause).
    const zusageGedeckt = aktionen.some((x) => (x.werkzeug === "karte_link_schicken" && !x.ok && !["nicht_bereit", "ohne_mail", "adresse_gesperrt", "nicht_kunde"].includes(String(x.kartenArt)))
      || (x.werkzeug === "ratenpause_setzen" && !x.ok && !!x.haertefall) || !!x.vorlegen);
    const zusageRoh = pruef.zusageVerboten && !zusageGedeckt ? zusageTreffer(a, pruef.zusageVerboten.namen) : null;
    const zusage = zusageRoh && !(mensch && zusageGeschaeftsfuehrung(zusageRoh)) ? zusageRoh : null;
    const hand = [...handlungsPruefung(a, aktionen, pruef.kunde, pruef.verlaufText, pruef.bekannt),
      ...(zusage ? [`Du sagst zu, dass sich jemand meldet, kümmert, prüft oder Bescheid bekommt („${zusage}“) — das löst hier kein Werkzeug ein. Erledige es selbst (Antwort, Link, Werkzeug) oder sag ehrlich, was jetzt passiert; einen Anruf gibt es nur, wenn er telefonieren will (dann rueckruf_eintragen).`] : []),
      // E-401 (2/6): der genannte Termin — zurücknehmen, „eingetragen“ nur, wenn eingetragen, der Termin mit Uhrzeit.
      ...(pruef.genannt ? genanntAntwortFunde(a, {
        darfEingetragen: pruef.genannt.eingetragen || aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok),
        // E-401 Nachbesserung (Prüfer-Fund): nach einem Verschieben/Buchen in diesem Lauf gilt die neue Zeit, nicht die alte.
        uhrzeitPflicht: aktionen.some((x) => x.werkzeug === "rueckruf_eintragen" && x.ok) ? null : pruef.genannt.uhrzeitTermin,
        satz: pruef.genannt.satz, linkVerboten: !pruef.genannt.verkaufErlaubt, verkaufErlaubt: !!pruef.genannt.verkaufErlaubt,
      }) : []),
      // E-401 (3/6): nie eine Zusage, die nicht im Bankbuch steht.
      ...(pruef.zahlung ? zahlungAntwortFunde(a, pruef.zahlung.ergebnis, { frueher: pruef.zahlung.frueher }) : []),
      // E-401 (4/6): nie „geändert“, was nicht gespeichert ist.
      ...(pruef.angaben ? angabenAntwortFunde(a, pruef.angaben) : [])];
    const hart = [...wand, ...wahr.map((f) => f.text), ...hand, ...tl.hart];
    return {
      hart,
      nurJa: wahr.length > 0 && wahr.every((f) => f.art === "ja") && !wand.length && !hand.length && !tl.hart.length,
      // E-265 Nachbesserung (29.09.2026, Recht, limit2.mts): nur die Regel „limit" (das Wort) — NIE limit_ohne_bank oder
      // limit_zusage. Vorher hängte die Reparatur den Bank-Satz an jede Zusage („Sie bekommen Ihr Wunschlimit von
      // 25.000 €, über den Rahmen entscheidet …") — und die ging ohne Menschen raus.
      // E-265 Nachbesserung 2 (01.10.2026): „limit_freigabe" darf dabei sein — die Reparatur gilt aber nur, wenn das
      // Ergebnis die ganze Prüfung besteht (pruefe unten, mit der weißen Liste). Eine Zusage wird so nie sendbar.
      nurLimit: !wand.length && !wahr.length && !hand.length && nurLimitReparierbar(tl.hartIds),
      // E-265: Scheitert der Entwurf NUR an einem Mitarbeiter-Vornamen, setzt die Reparatur die Nennform ein.
      nurName: !wand.length && !wahr.length && !hand.length && tl.hartIds.length > 0 && tl.hartIds.every((id) => id === "mitarbeiter_vorname"),
      // Nachbesserung E-248: Scheitert der Entwurf NUR an einem Auskunft-Betrag, fällt dieser eine Satz weg.
      nurPreis: !wand.length && !wahr.length && !tl.hart.length && hand.length > 0 && hand.every((h) => PREIS_BEFUND.test(h)),
      weich: [...verkaufsPruefung(a, pruef), ...tl.weich,
        // E-265 (29.09.2026, Justin: „dann ist der geclosed"): Kaufsignal/Einwand → Karte, Ziel, Betrag, Frage.
        // E-265 Nachbesserung: mit Maras letzten Nachrichten (keine Wiederholungspflicht), dem Einwand im Verlauf und
        // dem ersten Entwurf (sein zugewandter Einstieg bleibt).
        ...(pruef.abschluss ? abschlussPruefung(a, { art: pruef.abschluss.art, kunde: pruef.kunde, ziel: pruef.abschluss.ziel, betrag: pruef.abschluss.betrag, letzteDu: pruef.letzteDu, kontext: pruef.abschluss.kontext ?? null, vorher }) : []),
        // E-265 Schluss-Nachbesserung (Probe 4 f04): Auf den Preis-Einwand gehört das kleinere Paket mit seinem Ziel.
        ...(pruef.abschluss?.teuer && !a.includes(pruef.abschluss.teuer.paket)
          ? [`Er findet den Preis zu hoch — zeig ihm das kleinere Paket mit seinem Ziel, so: „${pruef.abschluss.teuer.satz}“`] : []),
        // E-265 Schluss-Nachbesserung (Probe 4 l02): „Wie hoch ist mein Limit?" ohne seine Zahl ist keine Antwort.
        ...(pruef.limitFrage && !a.includes(pruef.limitFrage.zahl) && !a.includes(pruef.limitFrage.zahl.replace(/\s€$/, ""))
          ? [`Er fragt nach seinem Limit — nenn seine Zahl als Ziel, so: „${pruef.limitFrage.satz}“`] : [])],
    };
  };
  const a1 = reparieren(String(roh1?.antwort ?? "").trim(), { kunde: pruef.kunde ?? "" });
  const p1 = pruefe(a1, null, roh1?.mensch === true);
  if (!p1.hart.length && !p1.weich.length) return { roh: roh1, antwort: a1, funde: [], hinweise: [], zweiter: false, kiFehler: null, aktionen };

  console.warn(`[MARA-WA] Entwurf überarbeitet (${[...p1.hart, ...p1.weich].join(" · ").slice(0, 300)})`);
  const nein = wahrheitsBefunde(a1, pruef.kunde).some((f) => f.art === "ja");
  // E-248: Nicht nur das Verbot — die WAHREN Werte, sonst schrieb der zweite Entwurf im Fall K.
  // dieselbe (richtige) 20-Uhr-Antwort noch einmal und fiel wieder durch.
  const e = pruef.erlaubt ?? {};
  const erlaubtZeiten = Array.from(new Set([...(e.zeiten ?? []), ...aktionen.flatMap((x) => [...x.zeiten, ...(x.bestehend ? [x.bestehend.uhrzeit] : [])])])).filter(Boolean);
  const erlaubt = [
    e.termin ? `Sein Termin (wahr, darfst du nennen): ${e.termin}.` : "",
    erlaubtZeiten.length ? `Erlaubte Uhrzeiten: ${erlaubtZeiten.map(uhrText).join(", ")}.` : "",
    e.link ? `Sein persönlicher Link: ${e.link} — genau diesen, keinen anderen.` : "",
  ].filter(Boolean).join(" ");
  // E-265 Nachbesserung (29.09.2026, Verkauf, f02/f03/f07/f09/f13): Die Nachbesserung „Karte vorn" warf den
  // zugewandten ersten Satz weg („ich verstehe Sie: …") — er bleibt jetzt ausdrücklich stehen.
  const einstieg = einstiegVonEntwurf(a1);
  const bitte = [
    p1.hart.length ? `Diese Antwort darf so nicht raus: ${p1.hart.join("; ")}.` : "",
    p1.weich.length ? `Sie ist noch nicht gut genug: ${p1.weich.join(" ")}` : "",
    einstieg ? `Dein erster Satz ging auf ihn ein („${einstieg}“) — behalte ihn (ohne verbotene Wörter) und nenn die Karte im zweiten Satz.` : "",
    pruef.limitFrage ? `Seine Limit-Frage beantwortest du mit genau dieser Zahl als Ziel: „${pruef.limitFrage.satz}“` : "",
    // E-265 Schluss-Nachbesserung (Probe 4 f11): Der zweite Entwurf verlor die Antwort auf seine Frage („Ihre
    // Vertragsunterlagen lasse ich Ihnen gern schicken"), weil nur ein Nebensatz über den Bank-Link stören sollte.
    "Ändere nur, was oben genannt ist — die Sätze, die seine Frage beantworten, und dein Angebot an ihn bleiben (sinngemäß).",
    erlaubt,
    nein
      ? "Schreib sie neu — wahr, kurz, beginne mit dem Positiven, das stimmt (nicht mit Ja, Klar, Keine Sorge oder Gute Nachricht), gleiche Fakten."
      : "Schreib sie neu — wahr, kurz, warm, positiv zuerst, gleiche Fakten, ohne diese Wörter und Wendungen.",
    aktionen.length ? "Die Werkzeuge sind schon gelaufen — übernimm Zeiten, Namen und Links genau aus ihren Ergebnissen (so_schreiben), ruf keines neu auf." : "",
  ].filter(Boolean).join(" ");
  const d2 = await denken(system, [...d1.werkzeugVerlauf, ...(a1 ? [{ role: "assistant" as const, content: JSON.stringify({ antwort: a1 }) }] : []), { role: "user" as const, content: bitte }], null, werkzeugKontext?.personId ?? null);
  const roh2 = d2.roh;
  const a2 = reparieren(String(roh2?.antwort ?? "").trim(), { kunde: pruef.kunde ?? "" });
  const p2 = pruefe(a2, a1, roh2?.mensch === true);
  // E-265 Schluss-Nachbesserung (01.10.2026, Probe 3 f03/f05/l03): Verliert der zweite Entwurf Teile der Formel, die der
  // erste (ohne harten Mangel) hatte — Karte, Ziel, Bank-Satz, Betrag, Freischaltung, Link, „kein Kreditinstitut",
  // „Sie überweisen selbst" —, gilt der erste. Nicht, wenn ein Hinweis genau das Weglassen verlangte.
  if (roh2 && !p2.hart.length && !p1.hart.length && formelVerloren(a1, a2, p1.weich, pruef.abschluss ?? null).length) {
    console.warn(`[MARA-WA] Entwurf 1 bleibt — Entwurf 2 verlor ${formelVerloren(a1, a2, p1.weich, pruef.abschluss ?? null).join(", ")}`);
    return { roh: roh1, antwort: a1, funde: [], hinweise: p1.weich, zweiter: true, kiFehler: null, aktionen };
  }
  if (roh2 && !p2.hart.length) return { roh: roh2, antwort: a2, funde: [], hinweise: p2.weich, zweiter: true, kiFehler: null, aktionen };
  if (!p1.hart.length) return { roh: roh1, antwort: a1, funde: [], hinweise: p1.weich, zweiter: true, kiFehler: null, aktionen };
  // Letzter Ausweg vor dem sicheren Satz: Ist das EINZIGE Problem ein Ja-Wort am Anfang, streichen wir es;
  // ist es nur „Limit", wird es „Rahmen" (E-248).
  for (const [roh, a, p] of [[roh2, a2, p2], [roh1, a1, p1]] as const) {
    if (roh && p.nurJa) {
      const ohne = jaStreichen(a);
      if (ohne !== a && !pruefe(ohne, null, roh?.mensch === true).hart.length) {
        console.warn(`[MARA-WA] Ja-Wort gestrichen: „${a.slice(0, 60)}"`);
        return { roh, antwort: ohne, funde: [], hinweise: [], zweiter: true, kiFehler: null, aktionen };
      }
    }
    if (roh && p.nurPreis) {
      const falsch = p.hart.map((h) => h.match(PREIS_BEFUND)?.[1] ?? "").filter(Boolean);
      const ohne = a.split(/(?<=[.!?])\s+/).filter((satz) => !falsch.some((b) => satz.includes(b))).join(" ").trim();
      if (ohne && ohne !== a && !pruefe(ohne, null, roh?.mensch === true).hart.length) {
        console.warn(`[MARA-WA] Satz mit falschem Auskunft-Betrag gestrichen: „${falsch.join(", ")}"`);
        return { roh, antwort: ohne, funde: [], hinweise: [], zweiter: true, kiFehler: null, aktionen };
      }
    }
    if (roh && p.nurLimit) {
      const ohne = reparieren(a, { limit: true, kunde: pruef.kunde ?? "" });
      if (ohne !== a && !pruefe(ohne, null, roh?.mensch === true).hart.length) {
        console.warn(`[MARA-WA] „Limit" ersetzt: „${a.slice(0, 60)}"`);
        return { roh, antwort: ohne, funde: [], hinweise: [], zweiter: true, kiFehler: null, aktionen };
      }
    }
    // E-265 (29.09.2026): letztes Mittel vor dem sicheren Satz — der Vorname wird mechanisch die Nennform
    // („mit Herrn Stripling" nach mit/an/bei/für). Erst NACH dem zweiten Entwurf (Pronomen passt die Reparatur nicht an).
    if (roh && p.nurName) {
      const ohne = vornamenErsetzen(a, pruef.mitarbeiter, { kundeNamen: pruef.namen });
      if (ohne !== a && !pruefe(ohne, null, roh?.mensch === true).hart.length) {
        console.warn(`[MARA-WA] Mitarbeiter-Vorname ersetzt: „${a.slice(0, 60)}"`);
        return { roh, antwort: ohne, funde: [], hinweise: [], zweiter: true, kiFehler: null, aktionen };
      }
    }
  }
  return { roh: roh2, antwort: a2, funde: p2.hart, hinweise: [], zweiter: true, kiFehler: roh2 ? null : d2.fehler, aktionen };
}

// E-246 (27.09.2026): Der tägliche „Guthaben leer"-Alarm von hier ist weg — die KI-Pause
// (fiaon-ki-pause.ts) meldet einen Abrechnungsfehler genau einmal, für alle Dienste.

type Nachricht = { role: "assistant" | "user" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string; _claude_inhalt?: any[] };

/**
 * Ein KI-Aufruf — mit Werkzeugen höchstens vier Runden. Bei einem Fehler je Runde genau ein
 * zweiter Versuch. Liefert die Antwort ODER den letzten Fehler, dazu was die Werkzeuge taten
 * und den Werkzeug-Verlauf (für einen zweiten Entwurf ohne neue Aufrufe).
 */
async function denken(system: string, nachtrag: Nachricht[], ctx: WerkzeugKontext | null, person: number | null = ctx?.personId ?? null): Promise<{ roh: any; fehler: string | null; aktionen: Aktion[]; werkzeugVerlauf: Nachricht[] }> {
  let fehler: string | null = null;
  const aktionen: Aktion[] = [];
  const werkzeugVerlauf: Nachricht[] = [];
  const basis = [
    { role: "system", content: system },
    { role: "user", content: "Antworte jetzt auf seine letzte Nachricht — und auf alles davor, was noch offen ist." },
    ...nachtrag,
  ];
  // E-279: Werkzeuge einmal je Gespräch — Claudes Denk-Signaturen hängen am byte-gleichen Werkzeug-Satz.
  const werkzeuge = ctx ? werkzeugeFuer(ctx) : null;
  for (let runde = 0; runde < (ctx ? 4 : 1) + 1; runde++) {
    const mitWerkzeugen = !!ctx && runde < 4;
    let j: any = null;
    for (let versuch = 1; versuch <= 2 && !j; versuch++) {
      try {
        j = await kiAufruf({
          dienst: DIENST_WA, modell: MODELL(), aufwand: "low", maxTokens: 2500, schema: SCHEMA, person,
          nachrichten: [...basis, ...werkzeugVerlauf] as any,
          ...(mitWerkzeugen && werkzeuge ? { tools: werkzeuge } : {}),
        });
        void kostenCentsAus(MODELL(), j?.usage);
      } catch (e) {
        fehler = String((e as Error)?.message || e).slice(0, 300);
        // E-246: In der Pause kein zweiter Versuch — es gäbe ohnehin keinen Netzaufruf.
        if (istKiPause(e)) return { roh: null, fehler, aktionen, werkzeugVerlauf };
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
    // E-279: Claudes Rohblöcke (Denken + Werkzeugaufruf) mitnehmen — die nächste Runde spielt sie unverändert zurück.
    werkzeugVerlauf.push({ role: "assistant", content: String(msg.content ?? ""), tool_calls: aufrufe, ...(Array.isArray(msg._claude_inhalt) ? { _claude_inhalt: msg._claude_inhalt } : {}) });
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

/**
 * E-248 (Fall K.: 13 Übergaben → 5 Aufgaben, 9 dringend, jede setzte „Neu von Mara" zurück):
 *   · EINE offene Aufgabe je Mensch (oder Nummer) und Grundklasse — heikel, geld, rueckruf,
 *     anliegen, pruefung, ki, pause, deckel, versand. Solange sie offen ist, hängt alles daran;
 *     erst danach gibt es eine neue (mit Berliner Tag im Schlüssel). Offene Aufgaben mit dem
 *     alten Tages-Schlüssel (vor E-248) werden weitergeführt.
 *   · Der Aktenvermerk nur beim ersten Mal.
 *   · Weitere Beiträge still (ohne „Neu von Mara") — außer bei heikel und geld.
 */
const TITEL: Record<AufgabenKlasse, string> = {
  heikel: "Kündigung, Widerruf oder Beschwerde", geld: "Zahlung oder Geld", rueckruf: "Rückruf-Wunsch",
  anliegen: "Anliegen", pruefung: "Mara war unsicher", ki: "Mara konnte nicht antworten", pause: "Nachricht aus der KI-Pause",
  deckel: "Mara pausiert (Grenze)", versand: "Antwort ging nicht raus",
  bestreitet: "Kunde bestreitet Antrag", loeschen: "Löschwunsch (Daten löschen)",
  falsche_nummer: "Falsche Nummer — bitte korrigieren", in_ruhe: "Will keinen Kontakt mehr",
  rueckfrage: "Weiß nicht, wofür er zahlen soll", wut: "Verärgert — bitte ansehen",
  global: "FIAON Global — Mara antwortet nicht",
};
/**
 * Vertretung (01.10.2026): Diese Klassen sind heikel — Kündigung/Widerruf/Beschwerde/Rechtsdrohung
 * („heikel", heikelAnliegen), Bestreiten, Löschwunsch, „will keinen Kontakt", Wut. Liegt die Übergabe
 * beim Vertreter, sieht der Betreiber sie zusätzlich auf seinem Board (betreiberKopie).
 */
export const HEIKLE_KLASSEN: ReadonlySet<AufgabenKlasse> = new Set<AufgabenKlasse>(["heikel", "bestreitet", "loeschen", "in_ruhe", "wut"]);

/**
 * E-372 (15.10.2026): DER eine Weg, wenn Mara nicht allein fertig wird — nach waWeg:
 *   · karte    → eine Karte für Justin in Mara › Entscheidungen (fiaon-whatsapp-entscheidungen.ts, waKarteAnlegen);
 *                eine offene Karte desselben Falls bekommt die neue Nachricht dazu,
 *   · betreuer → die Aufgabe wie bisher (aufgabeFuerMenschen — nur noch Rückruf, „wofür zahlen?“, Technik),
 *   · selbst   → nichts anlegen, nur das Protokoll („selbst“: was Mara selbst erledigt hat und warum keine Aufgabe).
 * Ließ sich eine Karte nicht anlegen (Datenbank), geht der Fall wie früher als Aufgabe an einen Menschen — nie still
 * verloren. true = der Weg steht (für Global: erst dann still setzen). Wirft nie.
 */
export async function uebergeben(ein: {
  nummer: string; personId: number | null; leadId: number | null; aufId: number;
  weg: WaWegErgebnis;
  /** Für den Betreuer (und als Rückfall, wenn die Karte nicht geht) — wie bisher. */
  aufgabe: { grund: string; dringend: boolean; klasse: AufgabenKlasse; opt?: { still?: boolean; leitung?: boolean; betreiber?: boolean } };
  /** Für die Karte: seine Worte, Maras Antwort (null = keine), der interne Grund. */
  karte?: { kunde: string; mara: string | null; grund?: string | null; pauseOhneSperre?: boolean; warnung?: string | null };
  lage?: WaEntscheidungsLage | null;
}): Promise<boolean> {
  const a = ein.aufgabe;
  const anMenschen = () => aufgabeFuerMenschen(ein.nummer, ein.personId, ein.leadId, a.grund, a.dringend, a.klasse, a.opt ?? {});
  try {
    if (ein.weg.weg === "betreuer") return await anMenschen();
    if (ein.weg.weg === "karte" && ein.weg.fall) {
      const fall = ein.weg.fall;
      let karte: { id: number; schluessel: string; neu: boolean } | null = null;
      try {
        const we = await import("./fiaon-whatsapp-entscheidungen");
        const lage = ein.lage !== undefined ? ein.lage : await we.waLageLesen(ein.personId);
        karte = await we.waKarteAnlegen({
          fall, nummer: ein.nummer, personId: ein.personId, lage, aufId: ein.aufId,
          kunde: ein.karte?.kunde ?? "", mara: ein.karte?.mara ?? null, grund: ein.karte?.grund ?? null,
          pauseOhneSperre: ein.karte?.pauseOhneSperre, warnung: ein.karte?.warnung ?? null,
        });
      } catch (e) {
        console.error("[MARA-WA] Entscheidungskarte:", String((e as Error)?.message ?? e).slice(0, 200));
        await protokolliere({ art: "entscheidung", ok: false, nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId,
          text: `Karte für Justin (${fall}) ließ sich nicht anlegen — Aufgabe wie früher: ${a.grund.slice(0, 200)}`, daten: { fall, auf_id: ein.aufId } });
        return await anMenschen();
      }
      await protokolliere({ art: "entscheidung", ok: true, nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId,
        text: `Karte für Justin (${fall})${karte ? (karte.neu ? "" : ", aufgefrischt") : ", schon entschieden"}: ${ein.weg.grund}.`,
        daten: { fall, karte_id: karte?.id ?? null, schluessel: karte?.schluessel ?? null, auf_id: ein.aufId, klasse_vorher: a.klasse } });
      return true;
    }
    await protokolliere({ art: "selbst", ok: true, nummer: ein.nummer, personId: ein.personId, leadId: ein.leadId,
      text: `Mara erledigt es selbst — keine Aufgabe (${ein.weg.grund}).`, daten: { klasse_vorher: a.klasse, auf_id: ein.aufId } });
    return true;
  } catch (e) {
    console.error("[MARA-WA] Übergeben:", e);
    return false;
  }
}

/**
 * Vertretung (01.10.2026): exportiert für scripts/pruef-vertretung.ts (wohin Maras Übergaben gehen).
 * E-272 (02.10.2026): gibt true zurück, wenn die Aufgabe geschrieben ist — sonst darf der Aufrufer die
 * Nachricht nicht still setzen (der Nachhol-Takt versucht es dann wieder).
 */
export async function aufgabeFuerMenschen(
  nummer: string, personId: number | null, leadId: number | null, grund: string, dringend = false,
  klasse: AufgabenKlasse = "anliegen",
  /** E-264: leitung — an die Leitung (Vertriebsleiter wie aufgabe_an_betreuer „Leitung", sonst Justin), nicht an den Betreuer. */
  /** E-272 (02.10.2026): betreiber — auf Justins Board (Global-Kunde), ohne Betreuer, Vertretung oder Leitung. */
  opt: { still?: boolean; leitung?: boolean; betreiber?: boolean } = {},
): Promise<boolean> {
  try {
    const wer = personId ? String(Number(personId)) : `n${String(nummer).replace(/\D/g, "")}`;
    const tag = berlinTag(new Date());
    // E-272: Die Klasse „global“ hängt nie an einen alten Tages-Schlüssel ohne Klasse (vor E-248) — der läge
    // womöglich beim Privat-Betreuer; sie hat nur ihre eigene offene Aufgabe.
    const muster = klasse === "global"
      ? `^wa-${wer}-global(-\\d{4}-\\d{2}-\\d{2})?$`
      : `^wa-${wer}-(${klasse}(-\\d{4}-\\d{2}-\\d{2})?|\\d{4}-\\d{2}-\\d{2})$`;
    const [offen] = (await sqlPool`
      SELECT schluessel FROM fiaon_betreiber_todos
       WHERE schluessel LIKE ${`wa-${wer}-%`} AND schluessel ~ ${muster} AND status <> 'erledigt' ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    const schluessel = offen?.schluessel ? String(offen.schluessel) : `wa-${wer}-${klasse}-${tag}`;
    const erstes = !offen;
    if (personId && erstes) {
      const { waAktenvermerk } = await import("./fiaon-whatsapp");
      await waAktenvermerk(personId, `WhatsApp (+${nummer}): ${grund}`);
    }
    const still = opt.still ?? (!erstes && klasse !== "heikel" && klasse !== "geld");
    // E-260: Team abwesend — die Übergabe geht nicht an Abwesende (B9).
    // Vertretung (01.10.2026): Ist der Vertreter ein echter Mitarbeiter, bekommt ER sie (statt des
    // Betreiber-Boards); Heikles liegt zusätzlich auf dem Board. Ist er der Betreiber: Board wie bisher.
    const abw = await import("./fiaon-abwesenheit");
    // E-272: Global-Kunden gehören Justin — keine Vertretung (die vertritt die Privatlinie), keine Leitung.
    let vt = opt.betreiber ? null : opt.leitung
      ? await abw.uebergabeVertretung(personId ? Number(personId) : null)
      : await abw.uebergabeVertretungAbgeleitet(personId ? Number(personId) : null);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const leitung = !opt.betreiber && opt.leitung && !vt ? await (await import("./fiaon-mara-abstreiten")).leitungId().catch(() => null) : null;
    // Gilt die Abwesenheit nicht für den Kunden, aber für die Leitung selbst (nur einzelne abwesend): auch dann der Vertreter.
    if (!vt && leitung) vt = await abw.uebergabeVertretung(personId ? Number(personId) : null, leitung);
    const titel = `WhatsApp: ${TITEL[klasse]}${dringend ? " — bitte jetzt übernehmen" : " — bitte übernehmen"}`;
    let text = `${grund}${personId ? "" : ` · Nummer +${nummer}${leadId ? ` · Lead ${leadId}` : ""}`}`;
    // E-IT-F (Fertigstellung 08.10., Gegenprüfung Fund 6): Ist die Tages-Aufgabe dieser Klasse schon ERLEDIGT und bittet der
    // Kunde mit demselben Satz erneut (fester Satz „möchte mit jemandem aus dem Team sprechen“), wäre der Text nicht neu —
    // auftragFuerKunden öffnet nur bei neuem Text wieder, die Bitte ginge still verloren. Die Zeit macht sie neu.
    if (erstes && !still) {
      const [zu] = (await sqlPool`SELECT text FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel} AND status = 'erledigt' LIMIT 1`.catch(() => [])) as any[];
      if (zu && String(zu.text || "").includes(text)) {
        text = `${text} (erneut gemeldet ${berlinTagZeit(new Date())})`;
      }
    }
    // E-248: Der Schlüssel trägt jetzt die Grundklasse (wa-<person>-<klasse>-<tag>) — die Karte „Neu von Mara"
    // (fiaon-agent-aufgaben-popup.ts, personAusZeile) findet die Person deshalb über den Link.
    // Vertretung: Ohne Person führt der Link in den WhatsApp-Raum des Mitarbeiters statt ins Chefbüro.
    // E-IT-H (08.10.2026, Punkt 15): mit ?nummer= — der Raum öffnet genau dieses Gespräch (vorher nur den Raum).
    const link = personId ? `/agent/kunden?person=${Number(personId)}` : raumPfad(vt?.anVertreter ? "agent" : "chef", nummer);
    const erg: any = await auftragFuerKunden({
      // E-264 + E-260: „An die Leitung“ geht an den Vertriebsleiter — AUSSER das Team ist abwesend
      // (dann der Vertreter bzw. das Board des Betreibers; leitungId() wäre Agent 8, abwesend).
      // E-272: betreiber — immer Justins Board.
      // E-IT-F (Gegenprüfung 08.10.): „an die Leitung“ ist ausdrücklich (vorrang) — auch wenn ein alter Tages-Schlüssel beim Betreuer liegt.
      ...(opt.betreiber ? { anBetreiber: true } : vt ? abw.uebergabeFelder(vt) : opt.leitung ? (leitung ? { agentId: leitung, vorrang: true } : { anBetreiber: true }) : { anBetreiber: false }),
      personId: personId ?? null, ref: null,
      titel, text,
      quelle: "mara-whatsapp", dringend,
      link,
      schluessel, still,
    });
    // Heikel (Kündigung, Beschwerde, Bestreiten, Löschwunsch, Rechtsdrohung) — oder sonst ein Fall für die
    // Leitung: Der Betreiber sieht ihn zusätzlich auf seinem Board (nur, wenn die Aufgabe beim Vertreter liegt).
    const kopie = vt?.anVertreter && (HEIKLE_KLASSEN.has(klasse) || opt.leitung)
      // Gegenprüfung (01.10.2026): `still` wie bei der Aufgabe — sonst öffnete jede weitere Nachricht die Kopie wieder.
      ? await abw.betreiberKopie({ personId: personId ?? null, ref: null, titel, text, dringend: true, schluessel, quelle: "mara-whatsapp", link, still }, vt)
      : null;
    await protokolliere({ art: "uebergabe", ok: true, nummer, personId, leadId,
      text: `Aufgabe an ${erg?.agentName ?? (opt.betreiber ? "Justin (Board)" : "das Team")}${vt?.anVertreter ? ` (Vertretung bis ${abw.bisText(vt.ab.bis)})` : ""}${kopie ? " + Kopie aufs Board (heikel)" : ""}${dringend ? " (dringend)" : ""}${erstes ? "" : still ? " (angehängt, still)" : " (angehängt)"}: ${grund.slice(0, 300)}`,
      daten: { aufgabe_id: erg?.id ?? null, klasse, erstes, still, ...(vt ? { vertretung: vt.ab.vertreter.id, an_vertreter: vt.anVertreter, board_kopie: kopie } : {}) } });
    return !!erg?.id;
  } catch (e) { console.error("[MARA-WA] Aufgabe:", e); return false; }
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
           AND NOT (COALESCE(von, '') ILIKE 'Mara%' AND (text LIKE ${"%" + RUECKFALL_ANFANG + "%"} OR text LIKE ${"%" + RUECKFALL_ZWEI + "%"} OR text LIKE ${"%" + RUECKFALL_NEU + "%"}))
         LIMIT 1`) as any[];
      if (schonBeantwortet) { await leeren(); verworfen++; continue; }
      if (!(await fensterOffen(nummer))) { await leeren(); verworfen++; continue; }
      const [w] = (await sqlPool`SELECT person_id, lead_id FROM fiaon_whatsapp WHERE nummer = ${nummer} AND (person_id IS NOT NULL OR lead_id IS NOT NULL) ORDER BY id DESC LIMIT 1`) as any[];
      // E-272 (02.10.2026): Global-Kunde? Dann geht keine vorbereitete Antwort raus — auch keine, die gedacht
      // wurde, bevor das Angebot entstand (6–18 Sekunden Wartezeit) oder vor dem Deploy. Verwerfen; maraAntwortet
      // legt die Übergabe an Justin an. Lässt sich das nicht prüfen, wartet die Antwort auf den nächsten Takt.
      let globalKunde = false;
      try { globalKunde = await globalKundeWa(w?.person_id ?? null); } catch (e) {
        console.warn(`[MARA-WA] ${nummer.slice(-4)}: Global-Prüfung gescheitert — die Antwort wartet:`, String(e).slice(0, 160));
        continue;
      }
      if (globalKunde) { await leeren(); verworfen++; void maraAntwortet(nummer).catch(() => {}); continue; }
      const namen = await agentNamen();
      const erg = await waSenden(nummer, { text: String(g.antwort_text) }, { personId: w?.person_id ?? null, leadId: w?.lead_id ?? null, von: namen.voll });
      // E-261: Kontosperre (Bremse) — kein Fehlversuch, keine Aufgabe; die Antwort wird verworfen und nach dem
      // Aktivieren neu gedacht (mara_wa_nachholen), damit nichts Veraltetes rausgeht.
      if (!erg.ok && erg.pausiert) { await leeren(); verworfen++; continue; }
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
        // E-397: „Mara hat geantwortet“ zählt auch auf WhatsApp — schließt nur „Kunde wartet auf Antwort“ (eng, fiaon-auftraege.ts).
        await import("./fiaon-auftraege").then((m) => m.maraWaGeantwortet({ nummer, personId: w?.person_id ? Number(w.person_id) : null, aufId, antwortText: String(g.antwort_text ?? ""), rueckfall: istRueckfall(g.antwort_text) })).catch(() => {});
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
        await aufgabeFuerMenschen(nummer, w?.person_id ?? null, w?.lead_id ?? null, `Maras Antwort ging dreimal nicht raus (${String(erg.grund ?? "").slice(0, 200)}). Bitte selbst antworten.`, true, "versand");
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
     AND (g.versand_aufgegeben_id IS NULL OR g.versand_aufgegeben_id < r.id)
     -- E-248: Mara schweigt bis hierher bewusst (Autoantwort, reine Bestätigung).
     AND (g.still_bis_id IS NULL OR g.still_bis_id < r.id)`;

export async function nachholLauf(): Promise<{ angestossen: number }> {
  let angestossen = 0;
  // E-246: In der KI-Pause nichts anstoßen — nach dem Aktivieren ruft fiaon-ki-pause.ts diesen Lauf sofort.
  if (await kiPausiert()) return { angestossen: 0 };
  // E-261: Konto bei Meta gesperrt (oder Zugang abgelaufen) → auch keine Antwort möglich; nach „WhatsApp wieder
  // aktivieren" stößt die Bremse diesen Lauf an.
  const wp = await waPauseLesen();
  if (wp.an && waAllesZu(wp.art)) return { angestossen: 0 };
  await gespraechSchema();
  // E-261 (Gegenprüfung 29.09.): Wie nach der KI-Pause sammelt jeder Takt der ersten 24 h nach dem Aktivieren
  // die Nachrichten aus der Sperrzeit ein, die älter als 12 Stunden sind — auch die über 23,5 h, die die Abfrage
  // unten (OFFENE_GESPRAECHE_SQL) nicht mehr findet, und die, die nachts (nur < 30 Min.) übersprungen würden.
  if (waAllesZu(wp.art) && wp.seit && wp.aufgehobenAm && Date.now() - new Date(wp.aufgehobenAm).getTime() < 24 * 3_600_000) {
    await zuAltFuerMara(wp.seit, "wa").catch((e) => console.error("[MARA-WA] WA-Sperre-Sammelaufgabe:", e));
  }
  // E-246 (Nachprüfung 27.09.): Bis 24 h nach dem Aktivieren sammelt jeder Takt
  // die Pause-Nachrichten ein, die gerade über die 23,5-h-Grenze rutschen — auch
  // die, die nachts (nur < 30 Min.) oder am Kostendeckel übersprungen wurden.
  // Einmal beim Aktivieren reichte nicht: Eine Nachricht, die dann erst 15 h alt
  // war, fiel sonst weder in die Antwort noch in die Sammelaufgabe.
  const kp = await kiPauseLesen();
  if (kp.seit && kp.aufgehobenAm && Date.now() - new Date(kp.aufgehobenAm).getTime() < 24 * 3_600_000) {
    await zuAltFuerMara(kp.seit).catch((e) => console.error("[MARA-WA] Pause-Sammelaufgabe:", e));
  }
  const stunde = stundeBerlin();
  const nacht = stunde >= 22 || stunde < 7;
  // Kostendeckel erreicht? Dann gar nicht erst anstoßen — die Aufgaben sind schon angelegt.
  const deckel = zahlLesen(await einstellung("mara_wa_tag_euro", "30"), 30, 0, 200); // E-280: Claude-Preise (Justin 03.10.: 30 €); E-409 Fund 14: 0 heißt 0
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
/**
 * Nach der KI-Pause (E-246): Nachrichten, die in der Pause kamen und inzwischen
 * älter als 12 Stunden sind, beantwortet Mara nicht mehr frei (relative Zeiten
 * des Kunden stimmen nicht mehr; ab 23,5 h holt sie auch der Nachhol-Takt nicht,
 * das Fenster schließt). Sie gehen als EINE Sammelaufgabe an Justin — ein
 * Mensch meldet sich (bis 24 h frei, danach mit einer Vorlage).
 * Die neueste Nachricht je Nummer entscheidet: Schrieb der Kunde danach neu,
 * antwortet Mara auf das ganze Gespräch (mit Zeitangaben im Verlauf).
 *
 * Läuft beim Aktivieren UND in jedem Nachhol-Takt der ersten 24 h danach.
 * Eine Marke (fiaon_settings.ki_pause_wa_gesammelt = {seit, bisId}) merkt, bis
 * zu welcher Nachricht schon gesammelt wurde — jede Nachricht steht genau
 * einmal in der Aufgabe, spätere hängen sich an dieselbe Aufgabe an.
 * Zeitfenster ab 15 Min. VOR der Pause: Die Nachricht, deren Denkrunde die
 * Pause auslöste, kam Sekunden bis Minuten vor „seit".
 */
export const KI_PAUSE_WA_MARKE = "ki_pause_wa_gesammelt";
/**
 * E-261 (Gegenprüfung 29.09.): Dieselbe Sammlung für die WhatsApp-Sperre (Pause „gesperrt"
 * oder „zugang", fiaon-wa-bremse.ts) — eigene Marke, eigener Schlüssel, eigener Titel.
 * Ohne sie fielen Nachrichten aus einer Sperre über 23,5 Stunden (oder nachts
 * aktiviert) ohne Aufgabe durch: maraAntwortet und der Nachhol-Takt sehen sie nicht mehr.
 */
export const WA_PAUSE_WA_MARKE = "wa_pause_wa_gesammelt";
type PauseQuelle = "ki" | "wa";
const SAMMEL: Record<PauseQuelle, { marke: string; titel: string; wann: string; quelle: string; schluessel: (seit: string) => string }> = {
  ki: { marke: KI_PAUSE_WA_MARKE, titel: "WhatsApp aus der KI-Pause: Nachrichten zu alt für Mara", wann: "während der KI-Pause", quelle: "ki-pause", schluessel: (seit) => `ki-pause-wa-${seit}` },
  wa: { marke: WA_PAUSE_WA_MARKE, titel: "WhatsApp aus der Kontosperre: Nachrichten zu alt für Mara", wann: "während WhatsApp bei Meta gesperrt war (auch keine Antworten möglich)", quelle: "wa-pause", schluessel: (seit) => `wa-pause-wa-${seit}` },
};
/** Einzelaufgaben, falls eine Pause-Nachricht nicht in die Sammlung kam (je Nummer:Nachricht einmal). */
const pauseEinzelGemeldet = new Set<string>();
/** Ist die Marke der Sammelaufgabe dieser Pause bis zu dieser Nachricht gerückt? */
export async function inPauseSammlung(seit: string | null, nachrichtId: number, quelle: PauseQuelle = "ki"): Promise<boolean> {
  if (!seit) return false;
  const [m] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${SAMMEL[quelle].marke} LIMIT 1`.catch(() => [])) as any[];
  try { const j = m?.value ? JSON.parse(m.value) : null; return j?.seit === seit && Number(j.bisId) >= nachrichtId; } catch { return false; }
}
export async function zuAltFuerMara(seit: string | null, quelle: PauseQuelle = "ki"): Promise<{ anzahl: number }> {
  if (!seit) return { anzahl: 0 };
  const art = SAMMEL[quelle];
  await gespraechSchema();
  const [m] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${art.marke} LIMIT 1`) as any[];
  const markeAlt: string | null = m?.value ?? null;
  let bisId = 0;
  try { const j = markeAlt ? JSON.parse(markeAlt) : null; if (j?.seit === seit) bisId = Number(j.bisId) || 0; } catch { /* alte Marke unlesbar → neu anfangen */ }
  const ab = new Date(new Date(seit).getTime() - 15 * 60_000);
  // E-246 (Nachprüfung): Nur Nachrichten, die IN der Pause kamen (bis zum Aufheben
  // genau dieser Pause), und schon ab 12 Stunden Alter — älter beantwortet Mara
  // nicht frei (maraAntwortet, PAUSE_FREI_MAX_MS). Das Fenster ist bis 24 h offen.
  const kp = await (quelle === "wa" ? waPauseLesen(true) : kiPauseLesen()).catch(() => null);
  const bis = kp && kp.seit === seit && kp.aufgehobenAm && !kp.an ? new Date(kp.aufgehobenAm) : new Date();
  const zeilen = (await sqlPool`
    SELECT r.nummer, r.id, r.text, r.am, r.person_id,
           NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name
      FROM (
        SELECT DISTINCT ON (nummer) nummer, id, text, person_id, COALESCE(empfangen_am, created_at) AS am, created_at
          FROM fiaon_whatsapp WHERE richtung = 'rein' AND created_at >= ${ab}
         ORDER BY nummer, id DESC
      ) r
      LEFT JOIN fiaon_persons p ON p.id = r.person_id
      LEFT JOIN fiaon_whatsapp_gespraech g ON g.nummer = r.nummer
     WHERE r.am <= NOW() - INTERVAL '12 hours'
       AND r.am <= ${bis}
       AND r.id > ${bisId}
       AND COALESCE(g.mara_aus_grund, '') <> 'schalter'
       -- E-248: Autoantworten und reine Bestätigungen, auf die Mara bewusst schweigt, braucht kein Mensch.
       AND (g.still_bis_id IS NULL OR g.still_bis_id < r.id)
       -- Nachbesserung 27.09.: Vorlagen zählen nicht als Antwort (wie OFFENE_GESPRAECHE_SQL).
       AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp o WHERE o.nummer = r.nummer AND o.richtung = 'raus' AND o.vorlage IS NULL AND o.status <> 'fehler' AND o.id > r.id)
     ORDER BY r.id LIMIT 60`.catch((e) => { console.error("[MARA-WA] Pause-Sammelaufgabe:", e); return []; })) as any[];
  if (!zeilen.length) return { anzahl: 0 };
  // Marke weiterrücken — nur wer sie von genau dem gelesenen Stand aus rückt,
  // schreibt die Aufgabe (zwei gleichzeitige Takte listen nichts doppelt).
  const markeNeu = JSON.stringify({ seit, bisId: Math.max(...zeilen.map((z) => Number(z.id))) });
  const gerueckt = (markeAlt === null
    ? await sqlPool`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${art.marke}, ${markeNeu}, NOW()) ON CONFLICT (key) DO NOTHING RETURNING key`
    : await sqlPool`UPDATE fiaon_settings SET value = ${markeNeu}, updated_at = NOW() WHERE key = ${art.marke} AND value = ${markeAlt} RETURNING key`) as any[];
  if (!gerueckt.length) return { anzahl: 0 };
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const liste = zeilen.map((z) => {
    const am = new Date(z.am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `· …${String(z.nummer).slice(-4)}${z.name ? ` (${z.name})` : ""}, ${am}: „${String(z.text ?? "").replace(/\s+/g, " ").slice(0, 120)}"`;
  }).join("\n");
  await auftragFuerKunden({
    personId: null, ref: null, anBetreiber: true, dringend: true,
    titel: art.titel,
    text: `${zeilen.length} Nachricht${zeilen.length === 1 ? "" : "en"} kam${zeilen.length === 1 ? "" : "en"} ${art.wann} und ${zeilen.length === 1 ? "ist" : "sind"} älter als 12 Stunden. Mara antwortet darauf nicht selbst — „heute", „gleich" oder „morgen" des Kunden meinen inzwischen einen anderen Tag. Bitte selbst melden (WhatsApp-Raum): bis 24 Stunden nach seiner Nachricht frei, danach nur mit einer Vorlage. Die Uhrzeit steht dabei:\n${liste}`,
    quelle: art.quelle, bereich: "postmeister", link: "/chef/s/mara", schluessel: art.schluessel(seit), autorName: "System",
  } as any).catch((e) => console.error("[MARA-WA] Pause-Sammelaufgabe:", e));
  return { anzahl: zeilen.length };
}

/** Für den Prüfstand (scripts/pruef-mara-verkauf.ts): derselbe Auftrag, den Mara im Betrieb bekommt. */
export { auftrag as maraAuftrag };
/** Für den Prüfstand (E-240): dieselbe Lage, die Mara im Betrieb bekommt. */
export { lageFuer as maraLage };
