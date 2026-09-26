// ═══════════════════════════════════════════════════════════════════════════
// DER VERKAUFSTAKT DER BONITÄTSAUSKUNFT (24.09.2026, E-240 · 25.09.2026, E-241)
//
// Justin (24.09.): Die Auskunft soll „weggehen wie warme Semmeln" — Ziel 150 am
// Tag. Justin (25.09., E-241): „Ich kümmere mich heute um die API, bis dahin
// kaufen wir sie selbst. Die Boni-Auskunft geht an ALLE, die keine hinterlegt
// oder gekauft haben — jeden Tag zusätzlich 30 per WhatsApp und 500 Mails."
//
// ── DER KREIS (auskunft_verkauf_kreis) ────────────────────────────────────
// Wer überhaupt in Frage kommt, steht an EINER Stelle: poolCte() und
// IM_KREIS_SQL() unten. Takt, Tür im Mail-Motor (angebotTuerSperre), Gruppe
// „auskunft_fehlt" der WA-Zentrale und die Chefseite lesen genau diese
// Definition — so laufen Takt und Tür nie auseinander.
//   · 'uwg' (Standard, Stand E-240): nur Segment A mit laufendem Paket, und nur
//     wer seinen ERSTEN Antrag nach dem Widerspruchs-Hinweis gestellt hat
//     (§ 7 Abs. 3 UWG, Stichtag 02.09.2026 12:35). Gemessen 24.09.: 3 Menschen.
//   · 'alle' (Justins Entscheidung vom 25.09.2026): drei Segmente, jeweils
//     ohne Auskunft und ohne Widerspruch oder Sperre —
//       A „kunde"  laufendes Abo-Paket → Kundenpreis 74 € (Business 199 €),
//       B „antrag" Antrag fertig, nicht bezahlt (Stufe B nach Hausregel E-210:
//                  Schritt 8, pending_payment oder Status außerhalb des
//                  Antragswegs; nicht „Zahlung gemeldet") → 149 € (Business 349 €),
//       C „lead"   Lead mit Person, ohne jeden Antrag → 149 €.
//     Reihenfolge je Tag: A vor B vor C, in jedem Segment die frischeste
//     Aktivität zuerst. (E-243: dazu „abbrecher" zwischen B und C — unten.)
//
// ── DIE RECHTSLAGE BEI 'alle' — OFFEN GESAGT ──────────────────────────────
// Für B und C gibt es keine ausdrückliche Werbe-Einwilligung per E-Mail
// (fiaon_leads.einwilligung ist in allen 4.653 Zeilen leer, gemessen 25.09.)
// und für C auch keinen Kauf im Sinn von § 7 Abs. 3 UWG. E-Mail-Werbung an sie
// stützt sich auf keine der beiden Grundlagen, die der Takt bis E-240 kannte.
// Justin hat das entschieden; der Schalter steht deshalb auf 'uwg', bis er
// selbst umstellt (Chefseite). Was in JEDEM Kreis gilt: Werbesperre,
// Abmeldung (Lead-Strecke), STOPP, Vertriebssperre, Kündigung, Test, Global,
// DSGVO — und jede Mail trägt Abmeldelink und Widerspruchs-Hinweis.
//
// ── DIE STUFEN JE MENSCH (höchstens 3 Mails + 1 WhatsApp, dann Ende) ──────
//   1. Mail Fassung a — sofort, wenn er in die Menge fällt.
//   2. WhatsApp-Vorlage fiaon_kk_auskunft — frühestens 1 Tag nach Mail a
//      (E-243; bis dahin 2, mit der gemeinsamen 3-Tage-Bremse 3), nur mit nachgewiesener
//      Einwilligung (WHATSAPP_EINWILLIGUNG_SQL) und nur, wenn Meta die Vorlage
//      freigegeben hat — über die WA-Zentrale mit allen ihren Regeln.
//   3. Mail Fassung b — frühestens 6 Tage nach a und 2 nach der letzten Berührung.
//   4. Mail Fassung c — frühestens 14 Tage nach a und 2 nach der letzten Berührung.
// Kommt die WhatsApp nicht zwischen a und b (kein Platz im Tagesdeckel), darf
// sie bis zur dritten Mail nachkommen — nie danach. Scheitert ein Versuch,
// darf frühestens 20 Stunden später ein zweiter folgen (Gegenlesen 25.09.2026:
// höchstens zwei Versuche, zugestellt höchstens eine). Ende ohne Zählung: Kauf,
// Bestellung (offen < 21 Tage), Upload, Analyse und jede Sperre — wer eines
// davon hat, fällt aus der Grundmenge und wird nie wieder angeschrieben.
//
// ── DIE BREMSEN (Muster fiaon-rueckholung.ts) ─────────────────────────────
//   · auskunft_verkauf_an = 0 (Standard): Der Takt tut NICHTS.
//   · Zwei Deckel je Berliner Kalendertag: auskunft_verkauf_mails_pro_tag
//     (Standard 500, Rückfall auf den alten Schlüssel auskunft_verkauf_pro_tag)
//     und auskunft_verkauf_wa_pro_tag (Standard 20 seit E-243, vorher 30).
//   · Gleichmäßig über den Tag: Der Takt läuft alle 30 Minuten und nimmt je
//     Lauf das Soll bis jetzt minus schon Gesendetes (laufDeckel, E-243) —
//     keine 500 Mails um 07:00 (Zustellbarkeit, und das Team hätte alle
//     Rückfragen auf einmal), keine 20 WhatsApp bis halb elf.
//   · Sendefenster Mo–So 07:00–20:30 Berlin (E-243; vorher 08:00–19:59) — über
//     formatToParts. NIE Number(Intl.format()): Das ergab am 02.09. NaN (neun
//     Mails um 01:17 aus der Rückholung).
//   · Rücksicht: schrieb selbst in 7 Tagen, Mitarbeiter in 12 h dran, andere
//     Mail in 6 h, WERBLICHE Mail in 20 h (E-241: niemand bekommt zwei
//     Werbemails an einem Tag), Unterlagen-Mail mit Angebot in 3 Tagen,
//     Fehlversuch in 24 h, „Stopp" im Postfach, storniert — dann heute nicht.
//   · Die gemeinsame Bremse (zuletztAngeboten, fiaon-auskunft.ts): ein Angebot
//     über irgendeinen Weg in 3 Tagen — dann nicht. Dazu je ADRESSE (Doppel-
//     Personen ohne Zusammenführung): ein Angebot in 3 Tagen, eines je Lauf.
//   · Die Tür im Mail-Motor (make-webhook.ts → angebotTuerSperre hier,
//     sperrUrteil in fiaon-mail-frequenz.ts) prüft alles noch einmal selbst.
//
// Versand ausschließlich über versendenUndProtokollieren (Mail) und die
// WA-Zentrale (WhatsApp) — jede Berührung steht im Mail- bzw. WA-Protokoll.
//
// ── E-243 (26.09.2026): VERKAUF SCHARF, ZIELGRUPPE NACH JUSTIN ─────────────
// Justin: „JEDER (außer stornierte Kunden und die, die etwas hochgeladen oder
// schon bezahlt haben) bekommt eine E-Mail; WhatsApp ebenso, jeden Tag 20
// (Mo–So 07:00 bis 20:30)." Was sich gegenüber E-241 ändert:
//   · Kreis 'alle' = JEDER mit E-Mail. Neues Segment „abbrecher" (Antrag
//     begonnen, nicht abgeschickt — bis E-241 in keinem Segment, gemessen 914)
//     mit dem Einzelpreis 149 € (Business 349 €). Reihenfolge je Tag: kunde,
//     antrag, abbrecher, lead; in jedem Segment die frischeste Aktivität zuerst.
//   · Neuer Sperrgrund „storniert": Anträge da, aber keiner lebt mehr
//     (storniert, ersetzt, erstattet, archiviert) oder in der Telefonkartei
//     storniert. Gekündigt/Vertrag beendet zählt wie storniert (eigener Grund
//     „gekuendigt", wie bisher). Wer so ausgeschlossen ist, steht zur Zählung
//     im Segment, das er hatte — angeschrieben wird er nie.
//   · Das Fenster: Mo–So 07:00 bis 20:30 Berlin für Mail UND WhatsApp
//     (vorher 08:00–19:59), gleichmäßig über die Läufe des Tages verteilt —
//     auch bei kleinen Deckeln (20 WhatsApp = etwa eine je Lauf, nicht sechs
//     um sieben Uhr). Standard: 500 Mails, 20 WhatsApp.
//   · WhatsApp „an die Passenden zuerst" (kandidatenHeute, art „whatsapp"):
//     wer den Kauflink geöffnet und nicht bestellt hat, dann Kunden, fertige
//     Anträge, Abbrecher, Leads — Begründung bei WA_RANG_SQL. WhatsApp
//     frühestens 1 Tag nach Mail a (vorher 2, faktisch 3), höchstens eine je
//     Mensch.
//   · „Verkauf scharf stellen" (scharfStellen, Chefseite): alle fünf
//     Einstellungen in EINER Buchung.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { PAKETE } from "@shared/fiaon-pakete";
import {
  auskunftLand, auskunftLeistung, auskunftWort, auskunfteienText, auskunftPreisCents, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { WHATSAPP_EINWILLIGUNG_SQL, WHATSAPP_MOEGLICH_SQL } from "@shared/fiaon-whatsapp-erlaubnis";
import { AUSKUNFT_VORLAGE, AUSKUNFT_LEAD_VORLAGE } from "@shared/fiaon-lead-texte";
import { ANGEBOT_ABSTAND_TAGE, ANGEBOT_WEG_TEXT, angebotSpurenSql, buendelWartendeSql, zuletztAngeboten, type AuskunftStand } from "./fiaon-auskunft";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Feste Werte
// ───────────────────────────────────────────────────────────────────────────

/** Seit hier steht der Widerspruchs-Hinweis im Antrag (§ 7 Abs. 3 Nr. 4 UWG). */
export const UWG_STICHTAG = "2026-09-02T12:35:00+02:00";
export const ANGEBOT_EVENT = "auskunft_angebot";
export const WA_GRUPPE = "auskunft_fehlt";

// Die Einstellungen (fiaon_settings) — EXAKT diese Namen, alle Wege lesen sie (E-241).
export const SCHALTER_AN = "auskunft_verkauf_an";
export const SCHALTER_KREIS = "auskunft_verkauf_kreis";
export const SCHALTER_MAILS = "auskunft_verkauf_mails_pro_tag";
export const SCHALTER_WA = "auskunft_verkauf_wa_pro_tag";
export const SCHALTER_LIEFERMODUS = "auskunft_liefermodus";
/** Der Schlüssel aus E-240 (Mails und WhatsApp zusammen) — heute nur noch Rückfall für die Mails am Tag. */
export const SCHALTER_PRO_TAG = "auskunft_verkauf_pro_tag";

export const STANDARD_MAILS_PRO_TAG = 500;
/** E-243 (26.09.2026): Justin „jeden Tag 20 WhatsApp" — vorher 30. */
export const STANDARD_WA_PRO_TAG = 20;
/** Rückwärts verträglich (Chefseite E-240): der Standard der Mails am Tag. */
export const STANDARD_PRO_TAG = STANDARD_MAILS_PRO_TAG;
/** Obergrenze der Mails am Tag — mehr Werbung von fiaon.com an einem Tag gefährdet die Zustellung JEDER Rechnung. */
export const HOECHSTENS_PRO_TAG = 500;
/** Obergrenze der WhatsApp am Tag — der Meta-Tagesraum der Nummer (80 % von 250) ist ohnehin die härtere Grenze. */
export const HOECHSTENS_WA_PRO_TAG = 200;

export const HOECHSTENS_MAILS = 3;
export const HOECHSTENS_WHATSAPP = 1;
/** Alle Berührungen je Mensch: drei Mails und eine WhatsApp. */
export const HOECHSTENS_BERUEHRUNGEN = HOECHSTENS_MAILS + HOECHSTENS_WHATSAPP;

/** E-243 (26.09.2026): WhatsApp frühestens 1 Tag nach Mail a (vorher 2 — mit der 3-Tage-Bremse faktisch 3). */
const TAGE_BIS_WHATSAPP = 1;
/**
 * E-243: Der Abstand der WhatsApp zur letzten Berührung und zu jedem anderen
 * Angebot (gemeinsame Bremse, Adress-Bremse, Unterlagen-Mail) — 1 Tag statt 3.
 * Die WhatsApp ist der zweite Kanal zur Mail a, kein zweites Angebot auf dem
 * gleichen Weg; ein Tag Pause bleibt. Die WA-Zentrale liest denselben Wert.
 */
export const WA_ANGEBOT_ABSTAND_TAGE = 1;
const TAGE_BIS_MAIL_B = 6;
const TAGE_BIS_MAIL_C = 14;
const MINDESTABSTAND_TAGE = 2;
/** Eine offene Bestellung jünger als das bekommt den Zahlungslink, kein neues Angebot (auskunftBestellen, fiaon-auskunft.ts). */
const OFFEN_WIEDERVERWENDEN_TAGE = 21;
/**
 * E-243 (26.09.2026): das Sendefenster Mo–So 07:00 bis 20:30 Berlin, beide
 * Grenzen eingeschlossen (20:30 sendet noch, 20:31 nicht) — für Mail UND
 * WhatsApp. Vorher 08:00–19:59.
 */
export const SENDE_AB_MIN = 7 * 60;
export const SENDE_BIS_MIN = 20 * 60 + 30;
const TAKT_MINUTEN = 30;
const LAUF_PUFFER = 5;
/**
 * E-243: Ein Abbrecher gehört erst in den Verkauf, wenn sein Antrag eine Stunde
 * unberührt liegt — wer gerade ausfüllt, bekommt kein Angebot mitten hinein
 * (die WA-Zentrale wartet für ihre Abbrecher 30 Minuten).
 */
const ABBRUCH_RUHE_MINUTEN = 60;
const WERBUNG_RUHE_STUNDEN = 20;
/** Gegenlesen 25.09.2026: WhatsApp-Versuche je Mensch (zugestellt wird höchstens einer) und ihr Abstand. */
const WA_VERSUCHE = 2;
const WA_WIEDER_STUNDEN = 20;

export type VerkaufKreis = "uwg" | "alle";
export const KREISE: readonly VerkaufKreis[] = ["uwg", "alle"];
export type Liefermodus = "einkauf" | "vollmacht" | "api";
export const LIEFERMODI: readonly Liefermodus[] = ["einkauf", "vollmacht", "api"];
export type Segment = "kunde" | "antrag" | "abbrecher" | "lead";
/** E-243: in dieser Reihenfolge je Tag (Mail) — kunde, antrag, abbrecher, lead. */
export const SEGMENTE: readonly Segment[] = ["kunde", "antrag", "abbrecher", "lead"];
export type AngebotFassung = "a" | "b" | "c";

export const SEGMENT_TEXT: Record<Segment, string> = {
  kunde: "A · Kunde mit laufendem Paket",
  antrag: "B · Antrag fertig, nicht bezahlt",
  // E-243: ohne eigenen Buchstaben — A/B/C sind die Kundenstufen des Hauses, ein „D" gibt es nicht.
  abbrecher: "Abbrecher · Antrag begonnen, nicht abgeschickt",
  lead: "C · Lead ohne Antrag",
};

/** Warum jemand aus einem Segment NICHT angeschrieben wird — je Mensch der erste zutreffende Grund. */
export type Sperrgrund =
  | "test" | "dsgvo" | "werbesperre" | "abgemeldet" | "stopp" | "vertriebssperre"
  | "gekuendigt" | "storniert" | "global" | "ausland" | "kein_interesse" | "zahlung_gemeldet" | "nicht_zustellbar";

export const SPERRGRUND_TEXT: Record<Sperrgrund, string> = {
  test: "Testkonto",
  dsgvo: "DSGVO-Löschung",
  werbesperre: "Werbesperre (um keine weitere Post gebeten)",
  abgemeldet: "vom Lead-Verteiler abgemeldet",
  stopp: "„STOPP“ auf WhatsApp",
  vertriebssperre: "Vertriebssperre (kein Interesse)",
  // E-243: Justin „außer stornierte Kunden" — gekündigt zählt wie storniert.
  gekuendigt: "gekündigt oder Vertrag beendet (zählt wie storniert)",
  storniert: "storniert (keine lebende Bestellung oder in der Telefonkartei storniert)",
  global: "FIAON Global (eigener Ansprechpartner)",
  ausland: "Wohnsitz außerhalb von Deutschland, Österreich und der Schweiz",
  kein_interesse: "Lead „kein Interesse“",
  zahlung_gemeldet: "Zahlung gemeldet, noch nicht gebucht",
  nicht_zustellbar: "keine zustellbare E-Mail-Adresse",
};
export const SPERRGRUENDE = Object.keys(SPERRGRUND_TEXT) as Sperrgrund[];

// ───────────────────────────────────────────────────────────────────────────
// Die Einstellungen
// ───────────────────────────────────────────────────────────────────────────

export interface VerkaufEinstellungen {
  an: boolean;
  kreis: VerkaufKreis;
  mailsProTag: number;
  waProTag: number;
  liefermodus: Liefermodus;
}

const SICHERER_STAND: VerkaufEinstellungen = {
  an: false, kreis: "uwg", mailsProTag: STANDARD_MAILS_PRO_TAG, waProTag: STANDARD_WA_PRO_TAG, liefermodus: "einkauf",
};

/** Eine ganze Zahl aus der Einstellung — leer oder unlesbar heißt: nicht gesetzt. */
function ganzeZahl(roh: unknown): number | null {
  const s = String(roh ?? "").trim();
  if (!/^\d{1,6}$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Die Einstellungen aus rohen Werten — rein, ohne Datenbank (Prüfstand). */
export function einstellungenLesen(roh: Record<string, unknown>): VerkaufEinstellungen {
  const mails = ganzeZahl(roh[SCHALTER_MAILS]) ?? ganzeZahl(roh[SCHALTER_PRO_TAG]) ?? STANDARD_MAILS_PRO_TAG;
  const wa = ganzeZahl(roh[SCHALTER_WA]) ?? STANDARD_WA_PRO_TAG;
  const kreis = String(roh[SCHALTER_KREIS] ?? "").trim().toLowerCase();
  const modus = String(roh[SCHALTER_LIEFERMODUS] ?? "").trim().toLowerCase();
  return {
    an: String(roh[SCHALTER_AN] ?? "").trim() === "1",
    kreis: kreis === "alle" ? "alle" : "uwg",
    mailsProTag: Math.min(HOECHSTENS_PRO_TAG, Math.max(0, mails)),
    waProTag: Math.min(HOECHSTENS_WA_PRO_TAG, Math.max(0, wa)),
    liefermodus: (LIEFERMODI as readonly string[]).includes(modus) ? (modus as Liefermodus) : "einkauf",
  };
}

/**
 * Die fünf Einstellungen des Verkaufs. Bei einer Störung der sichere Stand:
 * Takt AUS, Kreis 'uwg' — ein Datenbank-Schluckauf startet nie eine Welle.
 */
export async function verkaufEinstellungen(lauf: Lauf = sqlPool): Promise<VerkaufEinstellungen> {
  try {
    const zeilen = (await lauf`
      SELECT key, value FROM fiaon_settings
       WHERE key = ANY(${[SCHALTER_AN, SCHALTER_KREIS, SCHALTER_MAILS, SCHALTER_WA, SCHALTER_LIEFERMODUS, SCHALTER_PRO_TAG]})`) as any[];
    return einstellungenLesen(Object.fromEntries(zeilen.map((z) => [String(z.key), z.value])));
  } catch (e) {
    console.error("[AUSKUNFT-VERKAUF] Einstellungen nicht lesbar — sicherer Stand (aus, uwg):", String((e as Error)?.message || e).slice(0, 160));
    return { ...SICHERER_STAND };
  }
}

/** Nur der Kreis — für Tür und WA-Zentrale. */
export async function verkaufKreis(lauf: Lauf = sqlPool): Promise<VerkaufKreis> {
  return (await verkaufEinstellungen(lauf)).kreis;
}

export interface VerkaufSchalter { an: boolean; proTag: number; kreis: VerkaufKreis; mailsProTag: number; waProTag: number }

/** Rückwärts verträglich (Chefseite E-240): `proTag` sind heute die Mails am Tag. */
export async function verkaufSchalter(lauf: Lauf = sqlPool): Promise<VerkaufSchalter> {
  const e = await verkaufEinstellungen(lauf);
  return { an: e.an, proTag: e.mailsProTag, kreis: e.kreis, mailsProTag: e.mailsProTag, waProTag: e.waProTag };
}

/** Was die Chefseite schreiben darf — und in welcher Form. Alles andere wird abgewiesen. */
const ERLAUBT: Record<string, { pruefen: (w: string) => boolean; fehler: string; ziel?: string }> = {
  [SCHALTER_AN]: { pruefen: (w) => w === "0" || w === "1", fehler: "Erlaubt sind 0 (aus) und 1 (an)." },
  [SCHALTER_KREIS]: { pruefen: (w) => (KREISE as readonly string[]).includes(w), fehler: "Erlaubt sind „uwg“ und „alle“." },
  [SCHALTER_MAILS]: {
    pruefen: (w) => /^\d{1,4}$/.test(w) && Number(w) <= HOECHSTENS_PRO_TAG,
    fehler: `Bitte eine ganze Zahl von 0 bis ${HOECHSTENS_PRO_TAG}.`,
  },
  [SCHALTER_WA]: {
    pruefen: (w) => /^\d{1,4}$/.test(w) && Number(w) <= HOECHSTENS_WA_PRO_TAG,
    fehler: `Bitte eine ganze Zahl von 0 bis ${HOECHSTENS_WA_PRO_TAG}.`,
  },
  [SCHALTER_LIEFERMODUS]: { pruefen: (w) => (LIEFERMODI as readonly string[]).includes(w), fehler: "Erlaubt sind „einkauf“, „vollmacht“ und „api“." },
  // Der alte Deckel (E-240) schreibt heute in den Mail-Deckel — sonst änderte die alte Seite nichts mehr.
  [SCHALTER_PRO_TAG]: {
    pruefen: (w) => /^\d{1,4}$/.test(w) && Number(w) <= HOECHSTENS_PRO_TAG,
    fehler: `Bitte eine ganze Zahl von 0 bis ${HOECHSTENS_PRO_TAG}.`, ziel: SCHALTER_MAILS,
  },
};

/**
 * Eine Einstellung schreiben — nur Schlüssel und Werte aus der Erlaubnisliste.
 * Werte werden vorher bereinigt (Leerzeichen, Großschreibung bei den Wörtern).
 */
export async function einstellungSetzen(
  key: string, wert: unknown, lauf: Lauf = sqlPool,
): Promise<{ ok: true; key: string; wert: string; einstellungen: VerkaufEinstellungen } | { ok: false; fehler: string }> {
  const regel = ERLAUBT[String(key ?? "")];
  if (!regel) return { ok: false, fehler: "Diesen Schlüssel darf niemand von außen schreiben." };
  const w = String(wert ?? "").trim().toLowerCase();
  if (!regel.pruefen(w)) return { ok: false, fehler: regel.fehler };
  const ziel = regel.ziel ?? String(key);
  await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${ziel}, ${w}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = ${w}, updated_at = NOW()`;
  return { ok: true, key: ziel, wert: w, einstellungen: await verkaufEinstellungen(lauf) };
}

/**
 * „VERKAUF SCHARF STELLEN" (26.09.2026, E-243) — Justins Auftrag „mit sofortiger
 * Wirkung": die fünf Einstellungen auf einmal. Takt an, Kreis „alle", 500 Mails
 * und 20 WhatsApp am Tag, Liefermodus Einkauf (bis die Schnittstelle steht).
 */
export const SCHARF_WERTE: readonly { key: string; wert: string }[] = [
  { key: SCHALTER_AN, wert: "1" },
  { key: SCHALTER_KREIS, wert: "alle" },
  { key: SCHALTER_MAILS, wert: String(STANDARD_MAILS_PRO_TAG) },
  { key: SCHALTER_WA, wert: String(STANDARD_WA_PRO_TAG) },
  { key: SCHALTER_LIEFERMODUS, wert: "einkauf" },
];

/**
 * Alle fünf in EINER Buchung — über einstellungSetzen (dieselbe Erlaubnisliste,
 * dieselbe Prüfung). Scheitert eine, bleibt keine geändert. Zurück: die
 * wirksamen Einstellungen vorher und nachher und je Schlüssel der Rohwert davor
 * (null = nicht gesetzt, es galt der Standard) — fürs Protokoll „alt → neu".
 */
export async function scharfStellen(lauf: Lauf = sqlPool): Promise<{
  vorher: VerkaufEinstellungen; nachher: VerkaufEinstellungen; rohVorher: Record<string, string | null>;
}> {
  const vorher = await verkaufEinstellungen(lauf);
  const keys = SCHARF_WERTE.map((w) => w.key);
  const roh = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${keys})`) as any[];
  const rohVorher: Record<string, string | null> = Object.fromEntries(keys.map((k) => {
    const z = roh.find((r) => String(r.key) === k);
    const v = z?.value == null ? "" : String(z.value).trim();
    return [k, v === "" ? null : v];
  }));
  await (lauf as any).begin(async (tx: Lauf) => {
    for (const w of SCHARF_WERTE) {
      const erg = await einstellungSetzen(w.key, w.wert, tx);
      if (!erg.ok) throw new Error(`[AUSKUNFT-VERKAUF] scharf stellen: ${w.key} — ${erg.fehler}`);
    }
  });
  return { vorher, nachher: await verkaufEinstellungen(lauf), rohVorher };
}

/** Der Kreis als SQL-Ausdruck: fest (geprüftes Literal) oder aus der Einstellung gelesen. */
export function kreisLiteral(k: VerkaufKreis): string {
  return k === "alle" ? "'alle'" : "'uwg'";
}
/** Der Kreis, wie er in fiaon_settings steht — für SQL, das die Einstellung selbst lesen muss (WA-Zentrale). */
export const KREIS_AUS_EINSTELLUNG_SQL = `COALESCE((SELECT CASE WHEN LOWER(TRIM(ks.value)) = 'alle' THEN 'alle' ELSE 'uwg' END
    FROM fiaon_settings ks WHERE ks.key = '${SCHALTER_KREIS}' LIMIT 1), 'uwg')`;

// ───────────────────────────────────────────────────────────────────────────
// Die SQL-Bausteine — EINE Definition für Takt, Tür, Chefseite und WA-Gruppe
// ───────────────────────────────────────────────────────────────────────────

/** Die Abo-Pakete aus dem Katalog — dieselbe Regel wie hatLaufendesPaket (istAboPaket). */
const ABO_LISTE = (() => {
  const keys = PAKETE.filter((p) => p.abo).map((p) => p.key);
  if (!keys.length || keys.some((k) => !/^[a-z0-9_]+$/.test(k))) throw new Error("[AUSKUNFT-VERKAUF] Abo-Schlüssel ungültig");
  return keys.map((k) => `'${k}'`).join(", ");
})();

const IST_AUSKUNFT = (a: string) => `(COALESCE(${a}.type, '') = 'schufa' OR ${a}.ref LIKE 'FIAON-SCHUFA-%')`;

/**
 * Ein bezahltes, laufendes Abo-Paket (`a` = fiaon_applications). Strenger als
 * hatLaufendesPaket: ohne gelöschte, erstattete und Test-Bestellungen.
 * Pakete ohne Schlüssel (Stripe-Ära, 62 Stück) zählen NICHT — für sie gälte der
 * Einzelpreis, und einem zahlenden Kunden 149 € statt 74 € anzubieten wäre
 * falsch; sie bekommen das Angebot über Betreuer und Kundenbereich.
 */
export const LAUFENDES_PAKET_SQL = (a: string) => `(
  ${a}.merged_into IS NULL AND ${a}.payment_status = 'paid' AND ${a}.cancelled_at IS NULL
  AND (${a}.vertrag_ende_am IS NULL OR ${a}.vertrag_ende_am > NOW())
  AND ${a}.gdpr_deleted_at IS NULL AND ${a}.refunded_at IS NULL
  AND NOT ${IST_AUSKUNFT(a)} AND ${a}.ref NOT LIKE 'FIAON-TEST%'
  AND LOWER(TRIM(COALESCE(${a}.pack_key, ''))) IN (${ABO_LISTE}))`;

/**
 * „Unfertig" — dieselbe Liste wie der Wiedereinstieg in fiaon-antrag.ts und die
 * WA-Zentrale (E-210). Die Zahlungsreferenz taugt NICHT als Zeichen: Ein
 * Trigger füllt sie seit dem 08.08.2026 schon beim ersten Speichern.
 */
const UNFERTIG_SQL = `('started', 'personal_data', 'finances', 'config', 'verifying', 'approved', 'contract', 'processing')`;

/**
 * Segment B (25.09.2026, E-241): ein abgeschickter, unbezahlter Antrag — Stufe B
 * nach der Hausregel (Schritt 8, pending_payment oder ein Status außerhalb des
 * Antragswegs). Nicht storniert, nicht archiviert, nicht gelöscht, kein Entwurf,
 * keine Auskunft-Bestellung. „Zahlung gemeldet" ist Stufe A des Hauses und
 * steht hier bewusst nicht (payment_status claimed_paid).
 */
export const ANTRAG_OFFEN_SQL = (a: string) => `(
  ${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND ${a}.archived_at IS NULL
  AND ${a}.gdpr_deleted_at IS NULL AND ${a}.cancelled_at IS NULL
  AND NOT ${IST_AUSKUNFT(a)} AND ${a}.ref NOT LIKE 'FIAON-TEST%'
  AND COALESCE(${a}.payment_status, '') IN ('pending_payment', 'pending', 'expired')
  AND (COALESCE(${a}.current_step, 0) >= 8 OR COALESCE(${a}.status, '') NOT IN ${UNFERTIG_SQL}
       OR ${a}.payment_status = 'pending_payment'))`;

/** Abgeschickt — dieselbe Hausregel wie der Wiedereinstieg (E-210): Schritt 8 oder ein Status außerhalb der unfertigen. */
const ABGESCHICKT_SQL = (a: string) => `(COALESCE(${a}.current_step, 0) >= 8 OR COALESCE(${a}.status, '') NOT IN ${UNFERTIG_SQL})`;

/**
 * Segment „abbrecher" (26.09.2026, E-243): ein Antrag, begonnen und gespeichert,
 * aber nicht abgeschickt — genau das Gegenstück zu ANTRAG_OFFEN_SQL (dieselbe
 * Liste der unfertigen Status, „pending_payment" zählt dort als abgeschickt).
 * Nicht storniert, nicht archiviert, nicht gelöscht, kein Entwurf ohne Person,
 * nicht gekündigt, keine Auskunft-Bestellung, kein Test — und seit
 * ABBRUCH_RUHE_MINUTEN unberührt (wer gerade ausfüllt, ist kein Abbrecher).
 */
export const ANTRAG_UNFERTIG_SQL = (a: string) => `(
  ${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND ${a}.archived_at IS NULL
  AND ${a}.gdpr_deleted_at IS NULL AND ${a}.cancelled_at IS NULL AND ${a}.gekuendigt_am IS NULL
  AND NOT ${IST_AUSKUNFT(a)} AND ${a}.ref NOT LIKE 'FIAON-TEST%'
  AND COALESCE(${a}.payment_status, 'pending') IN ('pending', 'expired')
  AND NOT ${ABGESCHICKT_SQL(a)}
  AND COALESCE(${a}.updated_at::timestamptz, ${a}.created_at::timestamptz) < NOW() - INTERVAL '${ABBRUCH_RUHE_MINUTEN} minutes')`;

/**
 * Eine LEBENDE Bestellung (E-243) — Justin: „außer stornierte Kunden". Nicht
 * storniert (cancelled_at, cancelled), nicht ersetzt ohne Nachfolger
 * (superseded — der Nachfolger lebt dann selbst), nicht erstattet, nicht
 * archiviert (doppelt, Testeintrag, „Kunde widerrufen"), nicht gelöscht.
 * Wer echte Anträge hat, aber keinen lebenden, ist storniert.
 */
const LEBEND_SQL = (a: string) => `(
  ${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND NOT ${IST_AUSKUNFT(a)} AND ${a}.ref NOT LIKE 'FIAON-TEST%'
  AND ${a}.cancelled_at IS NULL AND ${a}.archived_at IS NULL AND ${a}.refunded_at IS NULL AND ${a}.gdpr_deleted_at IS NULL
  AND COALESCE(${a}.payment_status, '') NOT IN ('cancelled', 'superseded', 'refunded'))`;

/** Ein echter Antrag (kein Entwurf ohne Person, keine Auskunft, kein Test) — Grundlage für „storniert". */
const ECHTER_ANTRAG_SQL = (a: string) => `(
  ${a}.merged_into IS NULL AND NOT COALESCE(${a}.ist_entwurf, FALSE) AND NOT ${IST_AUSKUNFT(a)} AND ${a}.ref NOT LIKE 'FIAON-TEST%')`;

/**
 * auskunftStand „nichts" — und strenger: Auch eine Analyse oder eine archivierte
 * Auskunft (frueher_schufa) heißt „hat eine". Lieber einen Kauf verpassen als
 * jemandem die Auskunft verkaufen, die er uns schon gegeben hat.
 * E-241: Eine OFFENE Bestellung sperrt nur, solange sie jünger als 21 Tage ist
 * (dann gilt ihr Zahlungslink) — danach legt auskunftBestellen ohnehin eine neue
 * an, und der Mensch gehört wieder in den Verkauf. „Zahlung gemeldet" sperrt immer.
 * Integration 26.09.2026 (E-243): Auch das BÜNDEL zählt als „bestellt" — wer die
 * Auskunft im Antrag zum Kundenpreis dazubestellt hat und auf die erste
 * Paketzahlung wartet (höchstens BUENDEL_WARTET_TAGE), steht nicht im Kreis. So
 * urteilen Takt, Tür, WA-Gruppe (auch der Handversand) und Chefseite gleich —
 * vorher sperrte nur die Tür (buendelWartendeSql in fiaon-auskunft.ts).
 * `person` ist der SQL-Ausdruck für die Personen-ID.
 */
export const OHNE_AUSKUNFT_SQL = (person: string) => `(
  NOT EXISTS (SELECT 1 FROM fiaon_applications ax_s WHERE ax_s.person_id = ${person} AND ax_s.merged_into IS NULL
                AND ${IST_AUSKUNFT("ax_s")} AND (ax_s.payment_status IN ('paid', 'claimed_paid')
                  OR (ax_s.payment_status = 'pending_payment'
                      AND ax_s.created_at::timestamptz > NOW() - INTERVAL '${OFFEN_WIEDERVERWENDEN_TAGE} days')))
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax_d WHERE ax_d.person_id = ${person} AND ax_d.gdpr_deleted_at IS NULL AND ax_d.schufa_pdf IS NOT NULL)
  -- ohne Bezug (NOT IN): fiaon_schufa_analysen hat keinen Index auf person_id — je Mensch ein Seq Scan wäre teuer
  AND ${person} NOT IN (SELECT ax_a.person_id FROM fiaon_schufa_analysen ax_a WHERE ax_a.person_id IS NOT NULL)
  -- E-243: das Bündel wartet auf die erste Paketzahlung (ohne Bezug, einmal als Hash-Liste)
  AND ${person} NOT IN (${buendelWartendeSql()})
  AND NOT EXISTS (SELECT 1 FROM fiaon_dokumente ax_k WHERE ax_k.person_id = ${person} AND ax_k.geloescht_am IS NULL AND ax_k.art ILIKE '%schufa%'))`;

/** Nicht gekündigt (Rücknahme hebt auf) — Gekündigte bekommen keine Werbung, E-213. */
export const NICHT_GEKUENDIGT_SQL = (person: string) => `NOT EXISTS (
  SELECT 1 FROM fiaon_applications ax_g WHERE ax_g.person_id = ${person} AND ax_g.merged_into IS NULL
     AND ax_g.gekuendigt_am IS NOT NULL AND ax_g.kuendigung_zurueckgenommen_am IS NULL)`;

/** FIAON Global spricht eine andere Sprache (Firma, Einmalpreis) — dort fasst der feste Ansprechpartner nach. */
export const NICHT_GLOBAL_SQL = (person: string) => `NOT EXISTS (
  SELECT 1 FROM fiaon_applications ax_x WHERE ax_x.person_id = ${person} AND ax_x.merged_into IS NULL
     AND ${produktkategorieSql("ax_x")} = 'global')`;

/**
 * Wann hat dieser Mensch seinen ERSTEN Antrag angelegt — irgendeinen, nicht nur
 * den bezahlten? Dort hat er seine Adresse angegeben, und nur dort zählt der
 * Hinweis „bei Erhebung der Adresse" (§ 7 Abs. 3 Nr. 4 UWG). DIESELBE Lesart wie
 * die Tür im Mail-Motor (fiaon-mail-frequenz.ts: personSperren → kundeMitHinweis).
 * MIT zusammengeführten Anträgen (Gegenlesen 24.09.2026): Ein Doppel-Antrag von
 * vor dem Stichtag ist auch eine Erhebung der Adresse.
 * created_at ist ohne Zeitzone; der Cast nimmt die der Sitzung, wie beim Schreiben.
 */
export const ERSTER_ANTRAG_SQL = (person: string) => `(
  SELECT MIN(ax_e.created_at::timestamptz) FROM fiaon_applications ax_e
   WHERE ax_e.person_id = ${person})`;

/** § 7 Abs. 3 UWG: erster Antrag NACH dem Widerspruchs-Hinweis im Antrag. */
export const NACH_STICHTAG_SQL = (person: string) => `(${ERSTER_ANTRAG_SQL(person)} >= '${UWG_STICHTAG}'::timestamptz)`;

/**
 * Stand E-240: laufendes Paket, keine Auskunft, nicht gekündigt, nicht Global.
 * Seit E-241 liest die WA-Zentrale statt dessen grundmengeIdsSql() (Kreis aus
 * der Einstellung); der Baustein bleibt für Prüfstände und Zählungen.
 */
export const AUSKUNFT_FEHLT_SQL = (person: string) => `(
  EXISTS (SELECT 1 FROM fiaon_applications ax_l WHERE ax_l.person_id = ${person} AND ${LAUFENDES_PAKET_SQL("ax_l")})
  AND ${OHNE_AUSKUNFT_SQL(person)} AND ${NICHT_GEKUENDIGT_SQL(person)} AND ${NICHT_GLOBAL_SQL(person)})`;

/** WhatsApp-Stopp: „STOPP" oder „Keine Nachrichten mehr" — dieselbe Regel wie die BASIS der WA-Zentrale. */
const WA_STOPP_SQL = (person: string) => `EXISTS (
  SELECT 1 FROM fiaon_whatsapp ax_w WHERE ax_w.person_id = ${person} AND ax_w.richtung = 'rein'
     AND (ax_w.text ILIKE '%stopp%' OR ax_w.knopf ILIKE '%stopp%' OR ax_w.text ILIKE '%keine nachrichten%' OR ax_w.knopf ILIKE '%keine nachrichten%'))`;

/**
 * Nachgewiesene WhatsApp-Einwilligung — DIE Regel des Hauses (shared/fiaon-whatsapp-erlaubnis.ts),
 * dieselbe, die auskunftWhatsAppSenden in der WA-Zentrale prüft.
 */
const WA_EINWILLIGUNG_SQL = WHATSAPP_EINWILLIGUNG_SQL;

/**
 * Das Land aus Nummer, Kampagne oder Adresse (25.09.2026, E-241). Leads ohne
 * Antrag geben kein Land an (gemessen 25.09.: alle 3.036 ohne country) — der
 * Rückfall wäre Deutschland, und 222 Österreicher und 92 Schweizer (nach
 * Vorwahl) läsen „SCHUFA". Deshalb: +43 → AT, +41 → CH; sonst die Kampagne, aus
 * der der Lead kam („AT Kampagne 2", „Österreich Campaign 1", „Schweiz
 * Kampagne 1" — die Anzeige lief nur dort); sonst die Endung .at/.ch der
 * Adresse. Eine Nummer mit +49 heißt Deutschland. NULL = kein Hinweis (dann
 * Deutschland, auskunftLand). Ein Land aus dem Antrag geht immer vor.
 */
export const LAND_HINWEIS_SQL = (telefon: string, email: string, kampagne = "NULL") => `(CASE
    WHEN regexp_replace(COALESCE(${telefon}, ''), '[^0-9]', '', 'g') ~ '^(00)?43[1-9]' THEN 'AT'
    WHEN regexp_replace(COALESCE(${telefon}, ''), '[^0-9]', '', 'g') ~ '^(00)?41[1-9]' THEN 'CH'
    -- eine ausdrücklich deutsche Nummer (+49) ist ein deutscher Anschluss — dann zählt die Kampagne nicht
    WHEN regexp_replace(COALESCE(${telefon}, ''), '[^0-9]', '', 'g') ~ '^(00)?49[1-9]' THEN 'DE'
    WHEN COALESCE(${kampagne}, '') ~* '(^|[^[:alpha:]])(at|österreich|oesterreich|austria)([^[:alpha:]]|$)' THEN 'AT'
    WHEN COALESCE(${kampagne}, '') ~* '(^|[^[:alpha:]])(ch|schweiz|switzerland|suisse)([^[:alpha:]]|$)' THEN 'CH'
    WHEN LOWER(TRIM(COALESCE(${email}, ''))) LIKE '%.at' THEN 'AT'
    WHEN LOWER(TRIM(COALESCE(${email}, ''))) LIKE '%.ch' THEN 'CH'
  END)`;

/** Nur geprüfte Parameter-Ausdrücke („$3") für den Personen-Filter — nie freier Text. */
function personenFilter(param?: string | null): string {
  if (!param) return "";
  if (!/^\$\d{1,2}$/.test(param)) throw new Error("[AUSKUNFT-VERKAUF] Personen-Filter: unerlaubter Ausdruck");
  return `AND p.id = ANY(${param}::int[])`;
}

/**
 * DIE GRUNDMENGE (E-241), mit allen Merkmalen, die Takt, Tür, Chefseite und
 * WA-Gruppe brauchen. Eine Zeile je Mensch, der in einem Segment steht —
 * gesperrte eingeschlossen (sperrgrund), damit die Chefseite je Grund zählen
 * kann. `ax_flag` ist die fertige Tabelle; wer angeschrieben werden darf, sagt
 * IM_KREIS_SQL. `personenParam` („$2") beschränkt auf eine Liste von Personen.
 *
 * Gemessen wird in CTEs, die je Tabelle EINMAL gruppieren (Anträge, Leads,
 * Protokolle) — 6.594 Personen × zwanzig EXISTS wären der langsame Weg.
 */
export function poolCte(personenParam?: string | null): string {
  const filter = personenFilter(personenParam);
  return `
WITH ax_antr AS (
  SELECT a.person_id,
         bool_or(${LAUFENDES_PAKET_SQL("a")}) AS abo_laeuft,
         -- irgendein bezahltes Paket, das noch läuft (auch ohne Abo-Schlüssel) — dann nie der Einzelpreis
         bool_or(a.merged_into IS NULL AND a.payment_status = 'paid' AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
                 AND (a.vertrag_ende_am IS NULL OR a.vertrag_ende_am > NOW()) AND NOT ${IST_AUSKUNFT("a")}) AS paket_laeuft,
         bool_or(a.merged_into IS NULL AND a.payment_status = 'claimed_paid' AND NOT ${IST_AUSKUNFT("a")}) AS zahlung_gemeldet,
         bool_or(${ANTRAG_OFFEN_SQL("a")}) AS antrag_offen,
         -- E-243: Abbrecher, lebende und überhaupt echte Anträge, und was er einmal hatte (für die Zählung Stornierter)
         bool_or(${ANTRAG_UNFERTIG_SQL("a")}) AS antrag_unfertig,
         bool_or(${LEBEND_SQL("a")}) AS lebend,
         bool_or(${ECHTER_ANTRAG_SQL("a")}) AS hat_antrag_echt,
         bool_or(${ECHTER_ANTRAG_SQL("a")} AND (a.payment_status IN ('paid', 'refunded') OR a.paid_at IS NOT NULL)) AS war_bezahlt,
         bool_or(${ECHTER_ANTRAG_SQL("a")} AND ${ABGESCHICKT_SQL("a")}) AS war_abgeschickt,
         bool_or(a.merged_into IS NULL AND NOT ${IST_AUSKUNFT("a")}) AS hat_antrag,
         bool_or(a.merged_into IS NULL AND ${produktkategorieSql("a")} = 'global') AS global,
         bool_or(a.merged_into IS NULL AND a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL) AS gekuendigt,
         bool_or(a.gdpr_deleted_at IS NOT NULL) AS dsgvo,
         -- Vertrag vorbei wie in personSperren (fiaon-mail-frequenz.ts): ein Ende erreicht, kein Paket läuft, kein neuer Antrag danach
         MAX(a.vertrag_ende_am) FILTER (WHERE a.merged_into IS NULL AND a.vertrag_ende_am <= NOW() AND NOT ${IST_AUSKUNFT("a")}) AS ende_max,
         MAX(a.created_at::timestamptz) FILTER (WHERE a.merged_into IS NULL AND NOT ${IST_AUSKUNFT("a")}) AS letzter_antrag_am,
         MIN(a.created_at::timestamptz) AS erster_antrag_am
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL
   GROUP BY a.person_id
),
ax_leads AS (
  SELECT l.person_id,
         -- 'TEST Import' nie (auch nicht die Kampagne „Test import"); 'import' nur ohne Testmarke an der Person
         -- (die prüft sperrgrund „test")
         bool_or(COALESCE(l.quelle, '') <> 'TEST Import' AND COALESCE(l.kampagne, '') !~* 'test ?import') AS lead_echt,
         bool_or(l.abgemeldet_am IS NOT NULL OR l.strecke_stopp = 'abgemeldet') AS abgemeldet,
         bool_or(COALESCE(l.status, '') IN ('kein_interesse', 'tot') OR l.dismissed_reason = 'kein_interesse') AS kein_interesse,
         MAX(l.erstellt_am) FILTER (WHERE COALESCE(l.quelle, '') <> 'TEST Import') AS lead_am,
         (array_agg(NULLIF(TRIM(l.email), '') ORDER BY l.erstellt_am DESC) FILTER (WHERE NULLIF(TRIM(l.email), '') IS NOT NULL))[1] AS lead_email,
         (array_agg(NULLIF(TRIM(l.vorname), '') ORDER BY l.erstellt_am DESC) FILTER (WHERE NULLIF(TRIM(l.vorname), '') IS NOT NULL))[1] AS lead_vorname,
         (array_agg(NULLIF(TRIM(l.nachname), '') ORDER BY l.erstellt_am DESC) FILTER (WHERE NULLIF(TRIM(l.nachname), '') IS NOT NULL))[1] AS lead_nachname,
         (array_agg(NULLIF(TRIM(l.telefon), '') ORDER BY l.erstellt_am DESC) FILTER (WHERE NULLIF(TRIM(l.telefon), '') IS NOT NULL))[1] AS lead_telefon,
         (array_agg(NULLIF(TRIM(l.kampagne), '') ORDER BY l.erstellt_am DESC) FILTER (WHERE NULLIF(TRIM(l.kampagne), '') IS NOT NULL))[1] AS lead_kampagne,
         -- ein ausdrückliches Nein zu WhatsApp im Lead-Formular — dieselbe Regel wie die BASIS der WA-Zentrale
         bool_and(l.whatsapp_erlaubt) FILTER (WHERE l.whatsapp_erlaubt IS NOT NULL) AS lead_wa_erlaubt
    FROM fiaon_leads l
   WHERE l.person_id IS NOT NULL
   GROUP BY l.person_id
),
-- Die Personenspalten gleich hier: Ein zweiter Join auf fiaon_persons lief bei der
-- Fehlschätzung des Planers (1 Zeile statt 4.590) als Seq Scan je Mensch — 0,8 s.
ax_basis AS (
  SELECT p.id AS person_id,
         p.first_name AS p_vorname, p.last_name AS p_nachname, p.primary_email AS p_email, p.primary_phone AS p_telefon,
         p.country AS p_land, p.werbung_gesperrt_am, p.assigned_agent_id, (p.ist_test_am IS NOT NULL) AS test,
         COALESCE(p.is_blocked, FALSE) AS vertriebssperre,
         CASE WHEN COALESCE(an.abo_laeuft, FALSE) THEN 'kunde'
              -- „Zahlung gemeldet" gehört zu B, damit die Chefseite es als Grund zählt — angeschrieben wird es nie (sperrgrund)
              WHEN (COALESCE(an.antrag_offen, FALSE) OR COALESCE(an.zahlung_gemeldet, FALSE)) AND NOT COALESCE(an.paket_laeuft, FALSE) THEN 'antrag'
              -- E-243: begonnen, nicht abgeschickt
              WHEN COALESCE(an.antrag_unfertig, FALSE) AND NOT COALESCE(an.paket_laeuft, FALSE) THEN 'abbrecher'
              -- E-243: storniert, gekündigt oder Vertrag vorbei — NUR zur Zählung im Segment, das er hatte
              -- (der Sperrgrund unten schließt ihn aus). Vorher standen sie in keinem Segment und fehlten in „gesperrt je Grund".
              WHEN COALESCE(an.hat_antrag_echt, FALSE) AND NOT COALESCE(an.paket_laeuft, FALSE)
                   AND (NOT COALESCE(an.lebend, FALSE) OR COALESCE(an.gekuendigt, FALSE)
                        OR (an.ende_max IS NOT NULL AND COALESCE(an.letzter_antrag_am, '-infinity'::timestamptz) <= an.ende_max))
                THEN CASE WHEN COALESCE(an.war_bezahlt, FALSE) THEN 'kunde' WHEN COALESCE(an.war_abgeschickt, FALSE) THEN 'antrag' ELSE 'abbrecher' END
              WHEN NOT COALESCE(an.hat_antrag, FALSE) AND COALESCE(le.lead_echt, FALSE) THEN 'lead'
         END AS segment,
         COALESCE(an.zahlung_gemeldet, FALSE) AS zahlung_gemeldet,
         COALESCE(an.global, FALSE) AS global,
         COALESCE(an.gekuendigt, FALSE) AS gekuendigt,
         (an.ende_max IS NOT NULL AND NOT COALESCE(an.paket_laeuft, FALSE)
          AND COALESCE(an.letzter_antrag_am, '-infinity'::timestamptz) <= an.ende_max) AS vertrag_vorbei,
         -- E-243: echte Anträge, aber keiner lebt mehr (Telefonkartei-Storno prüft ax_merk)
         (COALESCE(an.hat_antrag_echt, FALSE) AND NOT COALESCE(an.lebend, FALSE)) AS ohne_lebende_bestellung,
         COALESCE(an.dsgvo, FALSE) AS dsgvo,
         an.erster_antrag_am,
         COALESCE(le.abgemeldet, FALSE) AS lead_abgemeldet,
         COALESCE(le.kein_interesse, FALSE) AS kein_interesse,
         le.lead_am, le.lead_email, le.lead_vorname, le.lead_nachname, le.lead_telefon, le.lead_kampagne, le.lead_wa_erlaubt
    FROM fiaon_persons p
    LEFT JOIN ax_antr an ON an.person_id = p.id
    LEFT JOIN ax_leads le ON le.person_id = p.id
   WHERE p.merged_into_person_id IS NULL AND (an.person_id IS NOT NULL OR le.person_id IS NOT NULL)
     ${filter}
),
ax_lauf AS (
  SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, LOWER(TRIM(a.pack_key)) AS pack_key,
         NULLIF(TRIM(a.email), '') AS antrag_email, NULLIF(TRIM(a.first_name), '') AS antrag_vorname,
         NULLIF(TRIM(a.last_name), '') AS antrag_nachname, COALESCE(a.paid_at, a.created_at::timestamptz) AS aktiv_am
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND ${LAUFENDES_PAKET_SQL("a")}
   ORDER BY a.person_id, a.paid_at DESC NULLS LAST, a.created_at DESC
),
ax_offen AS (
  SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, LOWER(TRIM(COALESCE(a.pack_key, ''))) AS pack_key,
         NULLIF(TRIM(a.email), '') AS antrag_email, NULLIF(TRIM(a.first_name), '') AS antrag_vorname,
         NULLIF(TRIM(a.last_name), '') AS antrag_nachname,
         GREATEST(a.created_at::timestamptz, COALESCE(a.updated_at::timestamptz, a.created_at::timestamptz)) AS aktiv_am
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND ${ANTRAG_OFFEN_SQL("a")}
   ORDER BY a.person_id, a.created_at DESC
),
-- E-243: der jüngste unfertige Antrag (Segment „abbrecher") — Paket (Firma/privat), Name, Adresse, letzte Berührung
ax_unfertig AS (
  SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, LOWER(TRIM(COALESCE(a.pack_key, ''))) AS pack_key,
         NULLIF(TRIM(a.email), '') AS antrag_email, NULLIF(TRIM(a.first_name), '') AS antrag_vorname,
         NULLIF(TRIM(a.last_name), '') AS antrag_nachname,
         GREATEST(a.created_at::timestamptz, COALESCE(a.updated_at::timestamptz, a.created_at::timestamptz)) AS aktiv_am
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND ${ANTRAG_UNFERTIG_SQL("a")}
   ORDER BY a.person_id, COALESCE(a.updated_at::timestamptz, a.created_at::timestamptz) DESC
),
ax_mail AS (
  SELECT person_id, COUNT(*)::int AS n, MIN(created_at) AS erste, MAX(created_at) AS letzte
    FROM fiaon_mail_log
   WHERE event = '${ANGEBOT_EVENT}' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt' AND person_id IS NOT NULL
   GROUP BY 1
),
ax_wa AS (
  SELECT person_id, MAX(erstellt_am) AS am, MAX(erstellt_am) FILTER (WHERE ok) AS ok_am, bool_or(ok) AS ok,
         COUNT(*) FILTER (WHERE NOT ok)::int AS fehl
    FROM fiaon_wa_aktion WHERE gruppe = '${WA_GRUPPE}' AND person_id IS NOT NULL
   GROUP BY 1
),
-- MATERIALIZED: Ohne das rechnete der Planer die Liste für JEDEN Menschen neu
-- (358 × 22 ms Seq Scan = 7,9 s, gemessen 24.09. lesend in der Produktion).
-- E-241: dazu die Adressen mit hartem Bounce aus der Lead-Strecke.
ax_kaputt AS MATERIALIZED (
  SELECT DISTINCT LOWER(TRIM(empfaenger)) AS adr FROM fiaon_mail_log
   WHERE zustellung IN ('gebounct', 'blockiert', 'spam') AND empfaenger IS NOT NULL
  UNION
  SELECT LOWER(TRIM(email)) FROM fiaon_leads WHERE bounce_am IS NOT NULL AND NULLIF(TRIM(email), '') IS NOT NULL
),
-- Die Werbesperre gilt für die ADRESSE, nicht nur für die Person (werbesperreAnAdresse in
-- fiaon-mail-frequenz.ts — die Tür im Mail-Motor prüft genau so).
ax_gesperrt AS MATERIALIZED (
  SELECT LOWER(TRIM(gp.primary_email)) AS adr FROM fiaon_persons gp
   WHERE gp.werbung_gesperrt_am IS NOT NULL AND NULLIF(TRIM(gp.primary_email), '') IS NOT NULL
  UNION
  SELECT LOWER(TRIM(e.adr)) FROM fiaon_persons gp
    JOIN fiaon_applications gx ON gx.person_id = gp.id
    CROSS JOIN LATERAL (VALUES (gx.email), (gx.contact_email), (gx.billing_email)) AS e(adr)
   WHERE gp.werbung_gesperrt_am IS NOT NULL AND NULLIF(TRIM(e.adr), '') IS NOT NULL
  UNION
  SELECT LOWER(TRIM(gl.email)) FROM fiaon_persons gp JOIN fiaon_leads gl ON gl.person_id = gp.id
   WHERE gp.werbung_gesperrt_am IS NOT NULL AND NULLIF(TRIM(gl.email), '') IS NOT NULL
  UNION
  -- Gegenlesen 25.09.2026: die Hauptadresse einer in die gesperrte Person zusammengeführten — wie werbesperreAnAdresse
  SELECT LOWER(TRIM(gm.primary_email)) FROM fiaon_persons gp JOIN fiaon_persons gm ON gm.merged_into_person_id = gp.id
   WHERE gp.werbung_gesperrt_am IS NOT NULL AND NULLIF(TRIM(gm.primary_email), '') IS NOT NULL
),
-- E-241: Wer sich aus der Lead-Strecke abgemeldet hat, hat „keine Werbemails mehr" gesagt —
-- an dieser Adresse, egal welche Person sie heute trägt.
ax_abgemeldet AS MATERIALIZED (
  SELECT DISTINCT LOWER(TRIM(email)) AS adr FROM fiaon_leads
   WHERE (abgemeldet_am IS NOT NULL OR strecke_stopp = 'abgemeldet') AND NULLIF(TRIM(email), '') IS NOT NULL
),
ax_pool AS (
  SELECT b.person_id, b.segment,
         -- E-243: dazu der unfertige Antrag (u) — bei einem Abbrecher sind l und o leer
         COALESCE(l.ref, o.ref, u.ref) AS ref,
         COALESCE(l.pack_key, o.pack_key, u.pack_key) AS pack_key,
         CASE WHEN COALESCE(l.pack_key, o.pack_key, u.pack_key, '') LIKE 'business_%' THEN 'firma' ELSE 'privat' END AS art,
         COALESCE(NULLIF(TRIM(b.p_vorname), ''), l.antrag_vorname, o.antrag_vorname, u.antrag_vorname, b.lead_vorname) AS vorname,
         COALESCE(NULLIF(TRIM(b.p_nachname), ''), l.antrag_nachname, o.antrag_nachname, u.antrag_nachname, b.lead_nachname) AS nachname,
         COALESCE(NULLIF(TRIM(b.p_email), ''), l.antrag_email, o.antrag_email, u.antrag_email, b.lead_email) AS email,
         NULLIF(TRIM(b.p_telefon), '') AS telefon,
         -- E-243: ein LEERES Land im Antrag (gemessen 26.09.: 28 Abbrecher im Kreis) ist kein Land — sonst stand dort
         -- '' statt des Hinweises aus Nummer und Kampagne (ein Wiener Abbrecher läse „SCHUFA").
         COALESCE((SELECT UPPER(TRIM(c.country)) FROM fiaon_applications c WHERE c.person_id = b.person_id AND c.merged_into IS NULL
                      AND NULLIF(TRIM(c.country), '') IS NOT NULL
                    ORDER BY (c.payment_status = 'paid') DESC, c.created_at DESC LIMIT 1), NULLIF(TRIM(b.p_land), ''),
                  ${LAND_HINWEIS_SQL("COALESCE(NULLIF(TRIM(b.p_telefon), ''), b.lead_telefon)",
                    "COALESCE(NULLIF(TRIM(b.p_email), ''), l.antrag_email, o.antrag_email, u.antrag_email, b.lead_email)", "b.lead_kampagne")}) AS land_roh,
         b.erster_antrag_am,
         CASE b.segment WHEN 'kunde' THEN l.aktiv_am WHEN 'antrag' THEN o.aktiv_am WHEN 'abbrecher' THEN u.aktiv_am ELSE b.lead_am END AS aktiv_am,
         b.werbung_gesperrt_am, b.assigned_agent_id, b.test, b.vertriebssperre,
         b.zahlung_gemeldet, b.global, b.gekuendigt, b.vertrag_vorbei, b.dsgvo, b.lead_abgemeldet, b.kein_interesse, b.lead_wa_erlaubt,
         b.ohne_lebende_bestellung,
         COALESCE(m.n, 0) AS n_mail, m.erste AS erste_mail_am, m.letzte AS letzte_mail_am,
         w.am AS wa_am, w.ok_am AS wa_ok_am, (w.person_id IS NOT NULL) AS wa_versucht, COALESCE(w.ok, FALSE) AS wa_ok,
         COALESCE(w.fehl, 0) AS wa_fehl
    FROM ax_basis b
    LEFT JOIN ax_lauf l ON l.person_id = b.person_id
    LEFT JOIN ax_offen o ON o.person_id = b.person_id
    LEFT JOIN ax_unfertig u ON u.person_id = b.person_id
    LEFT JOIN ax_mail m ON m.person_id = b.person_id
    LEFT JOIN ax_wa w ON w.person_id = b.person_id
   WHERE b.segment IS NOT NULL
),
-- Die Adresslisten als Unterabfragen OHNE Bezug (IN statt EXISTS): Postgres baut sie einmal als
-- Hash-Tabelle. Mit EXISTS lief je Mensch ein CTE-Scan — 3.376 × 0,4 ms = 1,3 s (gemessen 25.09. lesend).
ax_merk AS (
  SELECT x.*,
         (x.erster_antrag_am >= '${UWG_STICHTAG}'::timestamptz) AS nach_stichtag,
         NOT ${OHNE_AUSKUNFT_SQL("x.person_id")} AS hat_auskunft,
         (x.werbung_gesperrt_am IS NOT NULL
          -- die Sperre wandert beim Zusammenführen nicht mit (fiaon-person-model.ts) — auch die Zusammengeführten fragen
          OR EXISTS (SELECT 1 FROM fiaon_persons wm WHERE wm.merged_into_person_id = x.person_id AND wm.werbung_gesperrt_am IS NOT NULL)
          OR COALESCE(LOWER(TRIM(x.email)) IN (SELECT g.adr FROM ax_gesperrt g WHERE g.adr IS NOT NULL), FALSE)) AS werbesperre,
         (x.lead_abgemeldet
          OR COALESCE(LOWER(TRIM(x.email)) IN (SELECT ab.adr FROM ax_abgemeldet ab WHERE ab.adr IS NOT NULL), FALSE)
          -- Gegenlesen 25.09.2026: auch an einer zusammengeführten Person (Lead oder Hauptadresse) —
          -- dieselbe Familie, die die Tür liest (immerSperre); sonst wählte der Takt, was die Tür verwirft.
          OR x.person_id IN (SELECT ac.merged_into_person_id FROM fiaon_persons ac
                              WHERE ac.merged_into_person_id IS NOT NULL
                                AND (ac.id IN (SELECT la.person_id FROM fiaon_leads la WHERE la.person_id IS NOT NULL
                                                  AND (la.abgemeldet_am IS NOT NULL OR la.strecke_stopp = 'abgemeldet'))
                                     OR LOWER(TRIM(ac.primary_email)) IN (SELECT ab.adr FROM ax_abgemeldet ab WHERE ab.adr IS NOT NULL)))) AS abgemeldet,
         ${WA_STOPP_SQL("x.person_id")} AS wa_stopp,
         -- E-243: storniert — keine lebende Bestellung, oder in der Telefonkartei storniert (Justin 21.09.: „storniert
         -- werden, auf eine eigene Liste kommen und nirgendwo mehr erscheinen"; ohne Bezug, einmal als Hash-Liste)
         (x.ohne_lebende_bestellung
          OR x.person_id IN (SELECT ts.person_id FROM fiaon_telefonkartei_storno ts WHERE ts.person_id IS NOT NULL AND ts.zurueck_am IS NULL)) AS storniert,
         (x.email IS NOT NULL AND x.email LIKE '%_@_%._%'
          AND LOWER(TRIM(x.email)) NOT IN (SELECT u.adr FROM ax_kaputt u WHERE u.adr IS NOT NULL)) AS zustellbar,
         -- Einwilligung UND eine Handynummer, die WhatsApp hat (WHATSAPP_MOEGLICH_SQL, wie die BASIS der
         -- WA-Zentrale) — sonst wählte der Takt jeden Lauf wieder jemanden, den die Zentrale nie nimmt.
         (x.telefon IS NOT NULL AND ${WHATSAPP_MOEGLICH_SQL("wx")} AND ${WA_EINWILLIGUNG_SQL("x.person_id")}) AS wa_einwilligung,
         GREATEST(x.letzte_mail_am, x.wa_ok_am) AS letzte_beruehrung,
         (x.n_mail + CASE WHEN x.wa_ok THEN 1 ELSE 0 END) AS beruehrungen
    FROM ax_pool x
    CROSS JOIN LATERAL (SELECT x.telefon AS telefon, x.lead_wa_erlaubt AS whatsapp_erlaubt) wx
),
ax_flag AS (
  SELECT y.*,
         CASE WHEN y.test THEN 'test'
              WHEN y.dsgvo THEN 'dsgvo'
              WHEN y.werbesperre THEN 'werbesperre'
              WHEN y.abgemeldet THEN 'abgemeldet'
              WHEN y.wa_stopp THEN 'stopp'
              WHEN y.vertriebssperre THEN 'vertriebssperre'
              -- E-243: vertrag_vorbei in JEDEM Segment — ein früherer Kunde steht zur Zählung jetzt im Segment „kunde"
              -- (vertrag_vorbei ist bei laufendem Paket nie wahr, ein echter Kunde bleibt also unberührt).
              WHEN y.gekuendigt OR y.vertrag_vorbei THEN 'gekuendigt'
              WHEN y.storniert THEN 'storniert'
              WHEN y.global THEN 'global'
              -- Integration 25.09.2026 (E-241): Ein Land im Antrag außerhalb von DACH (gemessen: 10 Menschen im Kreis
              -- „alle", BG, HU, HR, SK, BA, AD) — auskunftLand machte daraus Deutschland, das Angebot sagte „SCHUFA".
              -- FIAON arbeitet nur in DE/AT/CH (E-160); ohne Land (Leads) gilt der Hinweis aus Nummer und Kampagne.
              WHEN UPPER(TRIM(COALESCE(y.land_roh, ''))) ~ '^[A-Z]{2}$' AND UPPER(TRIM(y.land_roh)) NOT IN ('DE', 'AT', 'CH') THEN 'ausland'
              WHEN y.segment = 'lead' AND y.kein_interesse THEN 'kein_interesse'
              WHEN y.segment = 'antrag' AND y.zahlung_gemeldet THEN 'zahlung_gemeldet'
              WHEN NOT y.zustellbar THEN 'nicht_zustellbar'
         END AS sperrgrund
    FROM ax_merk y
)`;
}

/** Stand E-240: die Grundmenge als Text (Prüfstand, lesende Zählung gegen die Produktion). */
export const VERKAUF_POOL_SQL = poolCte();

/**
 * DIE KREIS-REGEL — EINE Quelle für Takt, Tür, WA-Gruppe und Chefseite (E-241).
 * `kreis` ist ein SQL-Ausdruck: kreisLiteral(…) oder KREIS_AUS_EINSTELLUNG_SQL.
 * Im Kreis heißt: in einem Segment, ohne Auskunft, ohne jeden Sperrgrund — und
 * bei 'uwg' nur Segment A mit erstem Antrag nach dem Stichtag.
 */
export const IM_KREIS_SQL = (kreis: string, f = "f") => `(
  ${f}.segment IS NOT NULL AND NOT ${f}.hat_auskunft AND ${f}.sperrgrund IS NULL
  AND (CASE WHEN ${kreis} = 'alle' THEN TRUE ELSE (${f}.segment = 'kunde' AND COALESCE(${f}.nach_stichtag, FALSE)) END))`;

/** Stand E-240: wer im Kreis 'uwg' automatisch angeschrieben werden darf. */
export const AUTOMATISCH_SQL = IM_KREIS_SQL(kreisLiteral("uwg"));

/**
 * Die Personen-IDs der Grundmenge im Kreis der EINSTELLUNG — als Unterabfrage
 * für die WA-Zentrale (Gruppe „auskunft_fehlt"): Dieselbe Menge wie der Takt,
 * und der Kreis kommt aus derselben Zeile in fiaon_settings.
 */
export function grundmengeIdsSql(): string {
  return `${poolCte()} SELECT f.person_id FROM ax_flag f WHERE ${IM_KREIS_SQL(KREIS_AUS_EINSTELLUNG_SQL)}`;
}

/** Werbliche Mails (E-241, Rücksicht 20 h): alles, was verkauft oder zum Abschluss drängt. */
const WERBLICHE_EVENTS = [
  "lead_followup", "lead_application_link", "lead_willkommen", "followup_48h", "antrag_erinnerung", "mara_aktion",
  // Gegenlesen 25.09.2026: Die Einladung zu Konto & Karte bewirbt ein Partnerprodukt (E-206) — sie geht
  // automatisch an zahlende Kunden (Segment A) und wäre sonst die zweite Werbemail desselben Tages.
  "konto_karte_einladung",
];

/**
 * Die Rücksicht des Tages — wie Maras Aktion (fiaon-mara-aktion.ts). Nur für den
 * Versand; die Zählung auf der Chefseite zeigt die Menge ohne sie.
 * E-243 (26.09.2026): je Weg — die WhatsApp folgt der Mail a nach EINEM Tag
 * (WA_ANGEBOT_ABSTAND_TAGE); mit den drei Tagen der Mail-Bremsen (gemeinsame
 * Bremse, Adress-Bremse, Unterlagen-Mail) käme sie nie vor Tag 3. Alles andere
 * gilt für beide Wege gleich; der Fehlversuch der MAIL betrifft nur die Mail.
 */
export function ruecksichtSql(weg: "mail" | "whatsapp" = "mail"): string {
  const angebotTage = weg === "whatsapp" ? WA_ANGEBOT_ABSTAND_TAGE : ANGEBOT_ABSTAND_TAGE;
  const unterlagenTage = weg === "whatsapp" ? WA_ANGEBOT_ABSTAND_TAGE : 3;
  const werblich = `(${WERBLICHE_EVENTS.map((e) => `'${e}'`).join(", ")})`;
  return `
  -- Performance (25.09.2026, E-241): Jede Rücksicht ist eine Unterabfrage OHNE Bezug auf den Menschen
  -- (NOT IN, Personen-ID nie NULL) — Postgres rechnet die Liste einmal und prüft per Hash. Korreliert
  -- (NOT EXISTS) lief z. B. der Postfach-Stopp als Seq Scan je Mensch: 2.907 × 3,8 ms = 11 s von 15 s
  -- (gemessen lesend in der Produktion mit rund 3.400 Menschen im Kreis „alle").
  -- „Stopp" per Antwort ans Postfach, egal wann (flags teils als JSON-Text — Textvergleich, nie ein Cast)
  AND f.person_id NOT IN (SELECT pm.person_id FROM fiaon_postmeister pm
                           WHERE pm.person_id IS NOT NULL AND pm.flags::text ~ 'stopp\\\\?"\\s*:\\s*true')
  -- in der Telefonkartei storniert
  AND f.person_id NOT IN (SELECT ts.person_id FROM fiaon_telefonkartei_storno ts WHERE ts.person_id IS NOT NULL AND ts.zurueck_am IS NULL)
  -- er hat selbst geschrieben: Mara antwortet im Postfach (und verkauft dort), der Takt wartet 7 Tage
  AND f.person_id NOT IN (SELECT ps.person_id FROM fiaon_postmeister ps WHERE ps.person_id IS NOT NULL AND ps.empfangen_am > NOW() - INTERVAL '7 days')
  AND f.person_id NOT IN (SELECT wr.person_id FROM fiaon_whatsapp wr
                           WHERE wr.person_id IS NOT NULL AND wr.richtung = 'rein' AND wr.created_at > NOW() - INTERVAL '48 hours')
  -- ein Mitarbeiter war in den letzten 12 h dran
  AND f.person_id NOT IN (SELECT ck.person_id FROM fiaon_contact_log ck WHERE ck.person_id IS NOT NULL AND ck.agent_id IS NOT NULL
                             AND ck.voided_at IS NULL AND ck.created_at > NOW() - INTERVAL '12 hours')
  -- eine andere Mail ist in den letzten 6 h raus
  AND f.person_id NOT IN (SELECT ml.person_id FROM fiaon_mail_log ml WHERE ml.person_id IS NOT NULL AND COALESCE(ml.art, 'echt') = 'echt'
                             AND ml.status = 'versandt' AND ml.created_at > NOW() - INTERVAL '6 hours')
  -- E-241: eine andere WERBLICHE Mail in den letzten WERBUNG_RUHE_STUNDEN (Lead-Strecke, Rückholung, Mara-Aktion …) —
  -- niemand bekommt zwei Werbemails an einem Tag (E-243: auch keine Werbe-WhatsApp neben einer Werbemail).
  -- Nach Person UND Adresse (die Lead-Strecke kennt nicht immer die Person).
  AND f.person_id NOT IN (SELECT wz.person_id FROM fiaon_mail_log wz
                           WHERE wz.person_id IS NOT NULL AND wz.created_at > NOW() - INTERVAL '${WERBUNG_RUHE_STUNDEN} hours'
                             AND COALESCE(wz.art, 'echt') = 'echt' AND wz.status IN ('versandt', 'gesendet')
                             AND (wz.event IN ${werblich} OR wz.event LIKE 'rueckhol%'))
  AND LOWER(TRIM(f.email)) NOT IN (SELECT LOWER(TRIM(wy.empfaenger)) FROM fiaon_mail_log wy
                           WHERE wy.empfaenger IS NOT NULL AND wy.created_at > NOW() - INTERVAL '${WERBUNG_RUHE_STUNDEN} hours'
                             AND COALESCE(wy.art, 'echt') = 'echt' AND wy.status IN ('versandt', 'gesendet')
                             AND (wy.event IN ${werblich} OR wy.event LIKE 'rueckhol%'))
  -- Gegenlesen 25.09.2026: dieselbe ADRESSE an einer zweiten, nicht zusammengeführten Person (Doppel) —
  -- ein Angebot je Adresse in ANGEBOT_ABSTAND_TAGE (WhatsApp: WA_ANGEBOT_ABSTAND_TAGE); die gemeinsame Bremse kennt nur die Person.
  AND LOWER(TRIM(f.email)) NOT IN (SELECT LOWER(TRIM(av.empfaenger)) FROM fiaon_mail_log av
                           WHERE av.empfaenger IS NOT NULL AND av.event = '${ANGEBOT_EVENT}' AND av.status = 'versandt'
                             AND COALESCE(av.art, 'echt') = 'echt' AND av.created_at > NOW() - INTERVAL '${angebotTage} days')
  -- die Unterlagen-Mail trägt das Angebot schon (E-240) — nicht zweimal in drei Tagen (WhatsApp: einem Tag)
  AND f.person_id NOT IN (SELECT du.person_id FROM fiaon_mail_log du WHERE du.person_id IS NOT NULL AND du.event = 'documents_change_request'
                             AND du.status = 'versandt' AND du.created_at > NOW() - INTERVAL '${unterlagenTage} days')
  ${weg === "mail" ? `-- ein Fehlversuch dieses Angebots: heute nicht noch einmal (sonst hinge der Takt alle 30 Minuten an denselben)
  AND f.person_id NOT IN (SELECT fx.person_id FROM fiaon_mail_log fx WHERE fx.person_id IS NOT NULL AND fx.event = '${ANGEBOT_EVENT}'
                             AND fx.status <> 'versandt' AND fx.created_at > NOW() - INTERVAL '24 hours')` : ""}
  -- die gemeinsame Bremse — ein Angebot über irgendeinen Weg (auch Mara, WhatsApp-Vorlage von Hand)
  -- in den letzten ANGEBOT_ABSTAND_TAGE (WhatsApp: WA_ANGEBOT_ABSTAND_TAGE), dann heute nicht (fiaon-auskunft.ts).
  AND NOT EXISTS (SELECT 1 FROM (${angebotSpurenSql("f.person_id", angebotTage)}) ap_spur)`;
}

/** Stand E-241: die Rücksicht der Mail als Text (Prüfstände und lesende Messungen). */
export const RUECKSICHT_SQL = ruecksichtSql("mail");

/** Welche Mail als Nächstes fällig ist (mail1/mail2/mail3) — oder NULL. */
const MAIL_SCHRITT_SQL = `(CASE
    WHEN f.n_mail = 0 AND (f.wa_ok_am IS NULL OR f.wa_ok_am <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days') THEN 'mail1'
    WHEN f.n_mail = 1 AND f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_MAIL_B} days'
         AND f.letzte_beruehrung <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days' THEN 'mail2'
    WHEN f.n_mail = 2 AND f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_MAIL_C} days'
         AND f.letzte_beruehrung <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days' THEN 'mail3'
  END)`;

/**
 * Ist die WhatsApp fällig? Ab einem Tag nach der ersten Mail (auch nach der dritten), einmal ZUGESTELLT, mit Einwilligung.
 * Gegenlesen 25.09.2026: Ein Fehlversuch (Meta-Störung, Vorlage beim Handversand der Zentrale noch
 * nicht frei, fehlender Name) beendete den Schritt bisher für immer — die Zentrale protokolliert ihn
 * als ok = false, und „versucht" hieß „erledigt". Jetzt: höchstens zwei Versuche (WA_VERSUCHE), der
 * zweite frühestens 20 Stunden nach dem ersten (WA_WIEDER_STUNDEN). Zugestellt wird höchstens eine.
 * E-243 (26.09.2026): frühestens TAGE_BIS_WHATSAPP (1) Tag nach Mail a und WA_ANGEBOT_ABSTAND_TAGE (1)
 * nach der letzten Berührung — vorher 2 und 2 (mit der Bremse 3).
 * E-243, Justin 26.09.2026 „jeden Tag 20 WhatsApp": Die eine WhatsApp darf auch NACH der Mail c
 * kommen (vierte und letzte Berührung). Vorher endete sie mit Mail c (Tag 14) — mit 20 am Tag wären
 * die Zwanzig nur bis etwa 22.10. gegangen und rund 1.400 WhatsApp-fähige hätten nie eine bekommen
 * (Simulation mit Produktionszahlen). Höchstens eine je Mensch bleibt, ebenso Einwilligung und Rücksicht.
 */
const WA_FAELLIG_SQL = `(f.n_mail BETWEEN 1 AND ${HOECHSTENS_MAILS} AND NOT f.wa_ok AND f.wa_fehl < ${WA_VERSUCHE}
    AND (f.wa_am IS NULL OR f.wa_am <= NOW() - INTERVAL '${WA_WIEDER_STUNDEN} hours') AND f.wa_einwilligung
    AND f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_WHATSAPP} days'
    AND f.letzte_beruehrung <= NOW() - INTERVAL '${WA_ANGEBOT_ABSTAND_TAGE} days')`;

/** Die Reihenfolge der Mail je Tag (E-243): kunde, antrag, abbrecher, lead. */
const SEGMENT_REIHE_SQL = `CASE f.segment WHEN 'kunde' THEN 0 WHEN 'antrag' THEN 1 WHEN 'abbrecher' THEN 2 ELSE 3 END`;

/**
 * Hat den Kauflink geöffnet und danach nichts bestellt (E-243) — der jüngste
 * solche Klick oder NULL. Ein Klick zählt nicht mehr, sobald danach (5 Minuten
 * Spiel für die Uhr) eine Auskunft-Bestellung entstand; die sperrt ohnehin 21
 * Tage (OHNE_AUSKUNFT_SQL) — danach ist er wieder im Verkauf, und der alte Klick
 * soll ihn nicht nach vorn holen. Braucht fiaon_auskunft_klicks (tabellenBereit).
 */
const KLICK_OHNE_BESTELLUNG_SQL = (person: string) => `(
  SELECT MAX(kx.zeit) FROM fiaon_auskunft_klicks kx
   WHERE kx.person_id = ${person}
     AND NOT EXISTS (SELECT 1 FROM fiaon_applications kb WHERE kb.person_id = kx.person_id AND kb.merged_into IS NULL
                       AND ${IST_AUSKUNFT("kb")} AND kb.created_at::timestamptz >= kx.zeit - INTERVAL '5 minutes'))`;

/**
 * „FINDE DIE PASSENDEN KUNDEN" — die Rangfolge der WhatsApp (26.09.2026, E-243).
 * Zwanzig WhatsApp am Tag sind knapp; jede soll dorthin, wo sie am ehesten zum
 * Kauf führt. Deshalb:
 *   0. Kauflink geöffnet, nicht bestellt — das stärkste Signal, das wir haben:
 *      Er hat Angebot und Preis gesehen und ist an der Bestätigung stehen
 *      geblieben. Ein persönlicher Anstoß auf dem Kanal, den er am ehesten
 *      liest, holt genau diesen Rest. Innerhalb: der jüngste Klick zuerst.
 *   1. Kunde mit Paket — kennt uns, zahlt schon, bekommt den Kundenpreis
 *      (74 €/199 €), und die Auskunft ist der fehlende Baustein seiner Akte.
 *   2. Antrag fertig, nicht bezahlt — hat uns Daten und Absicht gegeben; die
 *      Auskunft ist ein kleiner erster Schritt, und der Weg zum Paket liegt offen.
 *   3. Abbrecher — hat angefangen, also echtes Interesse, aber an einer Hürde
 *      gestoppt; kälter als ein fertiger Antrag.
 *   4. Lead ohne Antrag — der kälteste Kontakt.
 * In 1–4 die frischeste Aktivität zuerst: Je jünger der Kontakt, desto eher
 * erinnert er sich an uns (Speed-to-Lead, Gedächtnis: Marktdaten).
 * Nur für die Reihenfolge — wer überhaupt eine WhatsApp bekommen darf,
 * entscheiden Kreis, Einwilligung, WA_FAELLIG_SQL und die Rücksicht.
 */
const WA_RANG_SQL = `CASE WHEN kl.klick_am IS NOT NULL THEN 0 ELSE 1 + (${SEGMENT_REIHE_SQL}) END`;

/**
 * Die Rangfolge der WhatsApp als Unterabfrage (E-243) — für die WA-Zentrale
 * (Gruppe „auskunft_fehlt", Handversand „WhatsApp starten"): dieselbe
 * Reihenfolge wie der Takt, im Kreis der Einstellung. Spalten: person_id,
 * rang (0 = Kauflink geöffnet … 4 = Lead), klick_am, aktiv_am. Braucht die
 * Klick-Tabelle (tabellenBereit).
 */
export function waRangSql(): string {
  return `${poolCte()}
    SELECT f.person_id, ${WA_RANG_SQL} AS rang, kl.klick_am, f.aktiv_am
      FROM ax_flag f
      LEFT JOIN LATERAL (SELECT ${KLICK_OHNE_BESTELLUNG_SQL("f.person_id")} AS klick_am) kl ON TRUE
     WHERE ${IM_KREIS_SQL(KREIS_AUS_EINSTELLUNG_SQL)}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Uhr
// ───────────────────────────────────────────────────────────────────────────

/**
 * Minuten seit Mitternacht in Berlin — über formatToParts (Hausmuster
 * berlinMinuten). Kann eine Angabe nicht gelesen werden, kommt -1 zurück:
 * Im Zweifel gilt Nachtruhe — lieber eine Stunde später senden als um 01:17.
 */
export function berlinMinuten(jetzt: Date = new Date()): number {
  let teile: Intl.DateTimeFormatPart[];
  try {
    teile = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(jetzt);
  } catch { return -1; } // ein ungültiges Datum wirft RangeError — auch das heißt „im Zweifel Nacht"
  const h = Number(teile.find((p) => p.type === "hour")?.value);
  const m = Number(teile.find((p) => p.type === "minute")?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return (h % 24) * 60 + m;
}

/** Senden erlaubt? E-243 (26.09.2026): Mo–So 07:00 bis 20:30 Berlin, beide Minuten eingeschlossen. */
export function istSendezeit(jetzt: Date = new Date()): boolean {
  const m = berlinMinuten(jetzt);
  return m >= SENDE_AB_MIN && m <= SENDE_BIS_MIN;
}

/** Läufe an einem Sendetag, wenn der Takt zur vollen und halben Stunde läuft: 07:00 … 20:30 = 28. */
const LAEUFE_JE_TAG = Math.floor((SENDE_BIS_MIN - SENDE_AB_MIN) / TAKT_MINUTEN) + 1;

/**
 * Wie viele in DIESEM Lauf — gleichmäßig über den Tag.
 *
 * Mit `tagesDeckel` (so ruft der Takt, E-243): Soll bis jetzt = Deckel × (Läufe
 * bis einschließlich diesem) ÷ (Läufe des Tages), aufgerundet; dieser Lauf nimmt
 * Soll minus schon Gesendetes. Die Läufe zählen ab der tatsächlichen Minute —
 * der Takt läuft alle 30 Minuten ab dem Start des Dienstes, nicht zur vollen
 * Stunde (07:07, 07:37 … 20:07 sind 27 Läufe). So gehen 20 WhatsApp als etwa
 * eine je Lauf raus (E-241 nahm ceil(Rest ÷ Läufe) + 5: sechs um sieben Uhr, um
 * halb elf war der Tag voll), 500 Mails als 18 bis 19 je Lauf. Lief ein Lauf
 * leer, holt der nächste nach — nie mehr als das Doppelte des gleichmäßigen
 * Anteils plus 5 (wird der Takt um 19:30 eingeschaltet, nicht 450 auf einmal).
 * Der letzte Lauf des Tages darf den Rest nehmen (bis zu dieser Obergrenze).
 *
 * Ohne `tagesDeckel` (Stand E-241): ceil(Rest ÷ verbleibende Läufe) + 5.
 * Außerhalb des Fensters immer 0.
 */
export function laufDeckel(rest: number, jetzt: Date = new Date(), tagesDeckel?: number): number {
  if (!Number.isFinite(rest) || rest <= 0) return 0;
  const m = berlinMinuten(jetzt);
  if (m < SENDE_AB_MIN || m > SENDE_BIS_MIN) return 0;
  /** Läufe seit 07:00 bis einschließlich diesem — und von diesem bis einschließlich 20:30. */
  const bisher = Math.floor((m - SENDE_AB_MIN) / TAKT_MINUTEN) + 1;
  const noch = Math.floor((SENDE_BIS_MIN - m) / TAKT_MINUTEN) + 1;
  if (!tagesDeckel || !Number.isFinite(tagesDeckel) || tagesDeckel <= 0) {
    return Math.min(Math.floor(rest), Math.ceil(rest / noch) + LAUF_PUFFER);
  }
  const laeufe = bisher + noch - 1;
  const gesendet = Math.max(0, tagesDeckel - rest);
  const soll = Math.ceil((tagesDeckel * bisher) / laeufe);
  const obergrenze = 2 * Math.ceil(tagesDeckel / LAEUFE_JE_TAG) + LAUF_PUFFER;
  return Math.max(0, Math.min(Math.floor(rest), soll - gesendet, obergrenze));
}

// ───────────────────────────────────────────────────────────────────────────
// Die Zählung (Chefseite)
// ───────────────────────────────────────────────────────────────────────────

export interface SegmentZahlen {
  segment: Segment;
  /** Im Segment und ohne Auskunft — gesperrte eingeschlossen. */
  gesamt: number;
  /** gesamt ohne jeden Sperrgrund. */
  erreichbar: number;
  /** erreichbar UND im eingestellten Kreis — das ist die Menge des Takts. */
  imKreis: number;
  /** Im Kreis und heute ein Schritt fällig (vor der Tagesrücksicht). */
  heuteFaellig: number;
  /** Wie weit die Menschen im Kreis sind: Mail a, WhatsApp, Mail b, Mail c erreicht. */
  stufen: { a: number; wa: number; b: number; c: number };
  mitWhatsAppEinwilligung: number;
  /** E-243: im Kreis UND WhatsApp-fähig (Einwilligung, Handy) — wen der Takt per WhatsApp erreichen kann. */
  imKreisMitWhatsApp: number;
  gesperrt: Record<Sperrgrund, number>;
  /** Im Segment, hat aber schon eine Auskunft (bezahlt, gemeldet, Dokument, Analyse, offene Bestellung < 21 Tage). */
  hatAuskunft: number;
  jeLand: { land: AuskunftLand; gesamt: number; imKreis: number; heuteFaellig: number; mitWhatsAppEinwilligung: number }[];
}

export interface PoolZahlen {
  // ── E-240 (Segment A, Kreis 'uwg') — die Chefseite liest sie weiter ──
  /** Laufendes Paket, keine Auskunft, nicht gekündigt/Global/Test/gesperrt. */
  gesamt: number;
  werbesperre: number;
  /** STOPP auf WhatsApp — zählt für den Takt wie ein Widerspruch. */
  waStopp: number;
  /** Werbesperre ODER STOPP — jeder Mensch einmal gezählt. */
  widerspruch: number;
  nichtZustellbar: number;
  nachStichtag: number;
  /** Im eingestellten Kreis automatisch anschreibbar (alle Segmente). */
  automatisch: number;
  /** Segment A ohne Sperre und zustellbar, aber vor dem Stichtag Kunde geworden — im Kreis 'uwg' nur gezählt. */
  nurGezaehlt: number;
  mitWhatsAppEinwilligung: number;
  schonAngeschrieben: number;
  fertig: number;
  jeLand: { land: AuskunftLand; gesamt: number; automatisch: number; werbesperre: number }[];
  // ── E-241 ──
  kreis: VerkaufKreis;
  segmente: Record<Segment, SegmentZahlen>;
  /** Alle Segmente zusammen, je Grund. */
  gesperrt: Record<Sperrgrund, number>;
  /** Leads ohne Person (nicht erreichbar, der Kauflink braucht eine Person). */
  leadsOhnePerson: number;
  heuteFaellig: number;
}

const leereGruende = (): Record<Sperrgrund, number> =>
  Object.fromEntries(SPERRGRUENDE.map((g) => [g, 0])) as Record<Sperrgrund, number>;

export async function poolZahlen(lauf: Lauf = sqlPool, opts: { kreis?: VerkaufKreis } = {}): Promise<PoolZahlen> {
  await tabellenBereit();
  const kreis = opts.kreis ?? (await verkaufKreis(lauf));
  const K = IM_KREIS_SQL(kreisLiteral(kreis));
  const zeilen = (await lauf.unsafe(`${poolCte()}
    SELECT f.segment, UPPER(COALESCE(f.land_roh, 'DE')) AS land_roh, f.sperrgrund, f.hat_auskunft,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE ${K})::int AS im_kreis,
           COUNT(*) FILTER (WHERE ${K} AND (${MAIL_SCHRITT_SQL} IS NOT NULL OR ${WA_FAELLIG_SQL}))::int AS faellig,
           COUNT(*) FILTER (WHERE ${K} AND f.n_mail >= 1)::int AS st_a,
           COUNT(*) FILTER (WHERE ${K} AND f.wa_ok)::int AS st_wa,
           COUNT(*) FILTER (WHERE ${K} AND f.n_mail >= 2)::int AS st_b,
           COUNT(*) FILTER (WHERE ${K} AND f.n_mail >= 3)::int AS st_c,
           COUNT(*) FILTER (WHERE f.wa_einwilligung)::int AS wa_einw,
           COUNT(*) FILTER (WHERE ${K} AND f.wa_einwilligung)::int AS wa_einw_kreis,
           -- E-240-Felder (Segment A)
           COUNT(*) FILTER (WHERE f.werbesperre)::int AS werbesperre,
           COUNT(*) FILTER (WHERE f.wa_stopp)::int AS wa_stopp,
           COUNT(*) FILTER (WHERE f.werbesperre OR f.wa_stopp OR f.abgemeldet)::int AS widerspruch,
           COUNT(*) FILTER (WHERE NOT f.zustellbar)::int AS nicht_zustellbar,
           COUNT(*) FILTER (WHERE f.nach_stichtag)::int AS nach_stichtag,
           COUNT(*) FILTER (WHERE f.beruehrungen > 0)::int AS angeschrieben,
           -- fertig: alle drei Mails raus und keine WhatsApp mehr offen (E-243: sie darf nach Mail c noch kommen)
           COUNT(*) FILTER (WHERE f.n_mail >= ${HOECHSTENS_MAILS}
                              AND (f.wa_ok OR NOT f.wa_einwilligung OR f.wa_fehl >= ${WA_VERSUCHE}))::int AS fertig
      FROM ax_flag f
     GROUP BY 1, 2, 3, 4`)) as any[];
  const [ohne] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_leads WHERE person_id IS NULL AND COALESCE(quelle, '') <> 'TEST Import'`
    .catch(() => [{ n: 0 }])) as any[];

  const segmente = Object.fromEntries(SEGMENTE.map((s) => [s, {
    segment: s, gesamt: 0, erreichbar: 0, imKreis: 0, heuteFaellig: 0, stufen: { a: 0, wa: 0, b: 0, c: 0 },
    mitWhatsAppEinwilligung: 0, imKreisMitWhatsApp: 0, gesperrt: leereGruende(), hatAuskunft: 0,
    jeLand: (["DE", "AT", "CH"] as AuskunftLand[]).map((land) => ({ land, gesamt: 0, imKreis: 0, heuteFaellig: 0, mitWhatsAppEinwilligung: 0 })),
  } satisfies SegmentZahlen])) as Record<Segment, SegmentZahlen>;
  const gesperrt = leereGruende();
  const alt = { gesamt: 0, werbesperre: 0, waStopp: 0, widerspruch: 0, nichtZustellbar: 0, nachStichtag: 0, nurGezaehlt: 0, waEinw: 0, angeschrieben: 0, fertig: 0 };
  const altLand = new Map<AuskunftLand, { land: AuskunftLand; gesamt: number; automatisch: number; werbesperre: number }>();
  let automatisch = 0, heuteFaellig = 0;

  for (const z of zeilen) {
    const s = segmente[z.segment as Segment];
    if (!s) continue;
    const n = Number(z.n || 0);
    const land = auskunftLand(z.land_roh);
    const imKreis = Number(z.im_kreis || 0), faellig = Number(z.faellig || 0);
    automatisch += imKreis; heuteFaellig += faellig;
    if (z.hat_auskunft) { s.hatAuskunft += n; continue; }
    s.gesamt += n;
    const grund = z.sperrgrund as Sperrgrund | null;
    if (grund && grund in gesperrt) { s.gesperrt[grund] += n; gesperrt[grund] += n; } else s.erreichbar += n;
    s.imKreis += imKreis; s.heuteFaellig += faellig;
    s.stufen.a += Number(z.st_a || 0); s.stufen.wa += Number(z.st_wa || 0);
    s.stufen.b += Number(z.st_b || 0); s.stufen.c += Number(z.st_c || 0);
    s.mitWhatsAppEinwilligung += Number(z.wa_einw || 0);
    s.imKreisMitWhatsApp += Number(z.wa_einw_kreis || 0);
    const sl = s.jeLand.find((x) => x.land === land)!;
    sl.gesamt += n; sl.imKreis += imKreis; sl.heuteFaellig += faellig; sl.mitWhatsAppEinwilligung += Number(z.wa_einw_kreis || 0);

    // Die E-240-Zahlen: Segment A ohne Test, Vertriebssperre, Kündigung, Global, DSGVO (so war die Grundmenge damals).
    if (z.segment === "kunde" && !["test", "vertriebssperre", "gekuendigt", "global", "dsgvo"].includes(String(grund))) {
      alt.gesamt += n;
      alt.werbesperre += Number(z.werbesperre || 0); alt.waStopp += Number(z.wa_stopp || 0);
      alt.widerspruch += Number(z.widerspruch || 0); alt.nichtZustellbar += Number(z.nicht_zustellbar || 0);
      alt.nachStichtag += Number(z.nach_stichtag || 0); alt.waEinw += Number(z.wa_einw || 0);
      alt.angeschrieben += Number(z.angeschrieben || 0); alt.fertig += Number(z.fertig || 0);
      if (!grund) alt.nurGezaehlt += n - Number(z.nach_stichtag || 0);
      const e = altLand.get(land) ?? { land, gesamt: 0, automatisch: 0, werbesperre: 0 };
      e.gesamt += n; e.werbesperre += Number(z.werbesperre || 0);
      altLand.set(land, e);
    }
    if (imKreis) {
      const e = altLand.get(land) ?? { land, gesamt: 0, automatisch: 0, werbesperre: 0 };
      e.automatisch += imKreis;
      altLand.set(land, e);
    }
  }
  return {
    gesamt: alt.gesamt, werbesperre: alt.werbesperre, waStopp: alt.waStopp, widerspruch: alt.widerspruch,
    nichtZustellbar: alt.nichtZustellbar, nachStichtag: alt.nachStichtag, automatisch,
    nurGezaehlt: kreis === "uwg" ? alt.nurGezaehlt : 0,
    mitWhatsAppEinwilligung: alt.waEinw, schonAngeschrieben: alt.angeschrieben, fertig: alt.fertig,
    jeLand: (["DE", "AT", "CH"] as AuskunftLand[]).map((l) => altLand.get(l) ?? { land: l, gesamt: 0, automatisch: 0, werbesperre: 0 }),
    kreis, segmente, gesperrt, leadsOhnePerson: Number(ohne?.n || 0), heuteFaellig,
  };
}

/**
 * Heute wirklich möglich — je Segment, NACH der Tagesrücksicht (26.09.2026, E-243):
 * wem heute eine Mail bzw. die WhatsApp zustünde und wen keine Rücksicht aufhält
 * (Unterlagen-Mail in 3 Tagen, andere Werbemail in 20 h, Mitarbeiter in 12 h …).
 * Für die Rückfrage vor „Verkauf scharf stellen": „heute fällig" allein
 * versprach mehr, als rausgeht (gemessen 26.09.: 181 Kunden fällig, 3 möglich —
 * 174 hatten am 24.09. die Unterlagen-Mail bekommen). Die WhatsApp zählt hier
 * ohne die Frage nach Meta; der Tagesdeckel ist nicht abgezogen.
 */
export async function heuteMoeglich(kreis: VerkaufKreis = "alle", lauf: Lauf = sqlPool): Promise<Record<Segment, { mail: number; whatsapp: number }>> {
  await tabellenBereit();
  const zeilen = (await lauf.unsafe(`${poolCte()}
    SELECT f.segment,
           COUNT(*) FILTER (WHERE (${MAIL_SCHRITT_SQL}) IS NOT NULL ${ruecksichtSql("mail")})::int AS mail,
           COUNT(*) FILTER (WHERE ${WA_FAELLIG_SQL} ${ruecksichtSql("whatsapp")})::int AS wa
      FROM ax_flag f
     WHERE ${IM_KREIS_SQL(kreisLiteral(kreis))} AND (f.n_mail < ${HOECHSTENS_MAILS} OR ${WA_FAELLIG_SQL})
     GROUP BY 1`)) as any[];
  const aus = Object.fromEntries(SEGMENTE.map((sg) => [sg, { mail: 0, whatsapp: 0 }])) as Record<Segment, { mail: number; whatsapp: number }>;
  for (const z of zeilen) if (aus[z.segment as Segment]) aus[z.segment as Segment] = { mail: Number(z.mail || 0), whatsapp: Number(z.wa || 0) };
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// Wer ist heute dran?
// ───────────────────────────────────────────────────────────────────────────

/** mail1/mail2/mail3 = Fassung a/b/c. Die Namen aus E-240 bleiben (Chefseite). */
export type Schritt = "mail1" | "whatsapp" | "mail2" | "mail3";
export const FASSUNG_JE_SCHRITT: Record<Exclude<Schritt, "whatsapp">, AngebotFassung> = { mail1: "a", mail2: "b", mail3: "c" };

export interface VerkaufFall {
  personId: number;
  segment: Segment;
  /** Die Bestellung für Verlauf und Nutzlast (A: das Paket, B: der offene Antrag); C hat keine. */
  ref: string | null;
  art: AuskunftArt;
  land: AuskunftLand;
  vorname: string | null;
  nachname: string | null;
  email: string;
  nMail: number;
  waVersucht: boolean;
  waEinwilligung: boolean;
  /** Welche Mail fällig ist — oder null. */
  mailSchritt: "mail1" | "mail2" | "mail3" | null;
  /** Ist die WhatsApp fällig (Einwilligung, Abstand, noch nie versucht)? Ohne die Frage nach Meta. */
  waFaellig: boolean;
  /** Stand E-240: die zweite Mail ist reif. */
  mail2Reif: boolean;
  ersteMailAm: string | null;
  letzteBeruehrung: string | null;
  ersterAntragAm: string | null;
  aktivAm: string | null;
  /** E-243: jüngster Klick auf den Kauflink ohne Bestellung danach — nur in der WhatsApp-Reihe gefüllt. */
  klickAm: string | null;
}

function fallAusZeile(z: any): VerkaufFall {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  const ms = z.mail_schritt === "mail1" || z.mail_schritt === "mail2" || z.mail_schritt === "mail3" ? z.mail_schritt : null;
  return {
    personId: Number(z.person_id),
    segment: (SEGMENTE as readonly string[]).includes(z.segment) ? z.segment : "lead",
    ref: z.ref ? String(z.ref) : null,
    art: z.art === "firma" ? "firma" : "privat",
    land: auskunftLand(z.land_roh),
    vorname: z.vorname ?? null, nachname: z.nachname ?? null, email: String(z.email),
    nMail: Number(z.n_mail || 0), waVersucht: !!z.wa_versucht, waEinwilligung: !!z.wa_einwilligung,
    mailSchritt: ms, waFaellig: !!z.wa_faellig, mail2Reif: ms === "mail2",
    ersteMailAm: iso(z.erste_mail_am), letzteBeruehrung: iso(z.letzte_beruehrung),
    ersterAntragAm: iso(z.erster_antrag_am), aktivAm: iso(z.aktiv_am),
    klickAm: iso(z.klick_am),
  };
}

/**
 * Die Kandidaten des Tages, versandfertig gefiltert: im Kreis, Schritt fällig,
 * Tagesrücksicht bestanden. Reihenfolge der Mail (E-243): kunde, antrag,
 * abbrecher, lead, in jedem Segment die frischeste Aktivität zuerst.
 *   · art "mail"     — nur, wem eine Mail fällig ist,
 *   · art "whatsapp" — nur, wem die WhatsApp fällig ist (setzt waMoeglich voraus);
 *                      eigene Rangfolge WA_RANG_SQL (Kauflink geöffnet zuerst),
 *   · art "beide"    — beides (Vorschau, Stand E-240).
 */
export async function kandidatenHeute(limit: number, opts: {
  waMoeglich: boolean; nurPersonen?: number[] | null; kreis?: VerkaufKreis; art?: "mail" | "whatsapp" | "beide"; ohneRuecksicht?: boolean;
  /** Nur diese Segmente für die WhatsApp (deren Vorlage frei ist); ohne Angabe alle. */
  waSegmente?: readonly Segment[] | null;
}, lauf: Lauf = sqlPool): Promise<VerkaufFall[]> {
  await tabellenBereit();
  const kreis = opts.kreis ?? (await verkaufKreis(lauf));
  const art = opts.art ?? "beide";
  const nur = (opts.nurPersonen ?? []).filter((x) => Number.isInteger(x));
  // Nur Parameter, die das SQL auch benutzt — Postgres lehnt einen unbenutzten ohne Typ ab.
  const params: unknown[] = [Math.max(0, Math.floor(limit))];
  if (nur.length) params.push(nur);
  const waSeg = opts.waSegmente ? SEGMENTE.filter((x) => opts.waSegmente!.includes(x)) : SEGMENTE;
  const waOk = opts.waMoeglich && waSeg.length > 0;
  const waBed = `(s.wa_faellig AND f.segment IN (${waSeg.map((x) => `'${x}'`).join(", ") || "NULL"}))`;
  const bedingung = art === "mail" ? `s.mail_schritt IS NOT NULL`
    : !waOk ? (art === "whatsapp" ? "FALSE" : `s.mail_schritt IS NOT NULL`)
      : art === "whatsapp" ? waBed : `(s.mail_schritt IS NOT NULL OR ${waBed})`;
  // E-243: Die WhatsApp hat ihre eigene Rücksicht (ein Tag nach der Mail a statt drei) und ihre eigene
  // Rangfolge (WA_RANG_SQL: Kauflink geöffnet zuerst); die Mail bleibt bei kunde → antrag → abbrecher → lead.
  const mitKlick = art !== "mail";
  const ordnung = art === "whatsapp"
    ? `${WA_RANG_SQL}, kl.klick_am DESC NULLS LAST, f.aktiv_am DESC NULLS LAST, f.person_id ASC`
    : `${SEGMENT_REIHE_SQL}, f.aktiv_am DESC NULLS LAST, f.person_id ASC`;
  const zeilen = (await lauf.unsafe(`${poolCte(nur.length ? "$2" : null)}
    SELECT f.*, s.mail_schritt, s.wa_faellig${mitKlick ? ", kl.klick_am" : ""}
      FROM ax_flag f
      CROSS JOIN LATERAL (SELECT ${MAIL_SCHRITT_SQL} AS mail_schritt, ${WA_FAELLIG_SQL} AS wa_faellig) s
      ${mitKlick ? `LEFT JOIN LATERAL (SELECT ${KLICK_OHNE_BESTELLUNG_SQL("f.person_id")} AS klick_am) kl ON TRUE` : ""}
     WHERE ${IM_KREIS_SQL(kreisLiteral(kreis))}
       AND (f.n_mail < ${HOECHSTENS_MAILS} OR s.wa_faellig)
       AND ${bedingung}
       ${opts.ohneRuecksicht ? "" : ruecksichtSql(art === "whatsapp" ? "whatsapp" : "mail")}
     ORDER BY ${ordnung}
     LIMIT $1`, params as any[])) as any[];
  return zeilen.map(fallAusZeile);
}

/** Welcher Schritt für diesen Fall dran ist — oder null (warten). Die erste Mail geht immer vor. */
export function schrittFuer(f: VerkaufFall, waMoeglich: boolean): Schritt | null {
  // E-243: Nach der Mail c kann nur noch die eine WhatsApp kommen.
  if (f.nMail >= HOECHSTENS_MAILS) return waMoeglich && f.waFaellig ? "whatsapp" : null;
  if (f.mailSchritt === "mail1") return "mail1";
  if (waMoeglich && f.waFaellig) return "whatsapp";
  return f.mailSchritt;
}

/**
 * Die Grundmenge für EINEN Menschen — dieselbe Abfrage wie der Takt, auf eine
 * Person beschränkt. null = er steht in keinem Segment (kein Paket, kein fertiger
 * Antrag, kein Lead ohne Antrag).
 */
export async function personImPool(personId: number, lauf: Lauf = sqlPool): Promise<{
  segment: Segment; sperrgrund: Sperrgrund | null; hatAuskunft: boolean; nachStichtag: boolean; art: AuskunftArt; ref: string | null;
  land: AuskunftLand;
} | null> {
  if (!Number.isInteger(personId) || personId <= 0) return null;
  await tabellenBereit();
  const [z] = (await lauf.unsafe(`${poolCte("$1")}
    SELECT f.segment, f.sperrgrund, f.hat_auskunft, f.nach_stichtag, f.art, f.ref, f.land_roh FROM ax_flag f LIMIT 1`, [[personId]])) as any[];
  if (!z) return null;
  return {
    segment: z.segment as Segment, sperrgrund: (z.sperrgrund ?? null) as Sperrgrund | null,
    hatAuskunft: !!z.hat_auskunft, nachStichtag: !!z.nach_stichtag, art: z.art === "firma" ? "firma" : "privat",
    ref: z.ref ? String(z.ref) : null, land: auskunftLand(z.land_roh),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// DIE TÜR — eine Regel für Takt, Mail-Motor und Akte (E-241)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Was IMMER sperrt, egal welcher Kreis und auch von Hand: Werbesperre (auch an
 * einer zusammengeführten Person), Abmeldung aus der Lead-Strecke, „STOPP" auf
 * WhatsApp und die Vertriebssperre. null = kein Hindernis. Die Werbesperre an
 * der ADRESSE prüft zusätzlich sperrUrteil (fiaon-mail-frequenz.ts).
 *
 * Gegenlesen 25.09.2026 (E-241): Die Vertriebssperre zählt NUR an der
 * führenden Person, nie an einer zusammengeführten. Das Zusammenführen
 * (fiaon-person-merge.ts) setzt am Verlierer is_blocked = TRUE — er ist dann
 * Wegweiser, kein „kein Interesse" — und trägt eine echte Sperre des
 * Verlierers per ODER in den Gewinner. Mit der Familie gelesen sperrte die Tür
 * 162 Menschen im Kreis „alle" (56 von 183 zahlenden Kunden), die der Takt
 * trotzdem jeden Lauf wieder wählte (gemessen lesend in der Produktion; 834 von
 * 889 Zusammengeführten tragen die Marke). Dieselbe Lesart wie personSperre
 * (fiaon-mail-frequenz.ts) und die Grundmenge (ax_basis.vertriebssperre).
 */
export async function immerSperre(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [z] = (await lauf.unsafe(`
    WITH kopf AS (
      SELECT COALESCE((SELECT merged_into_person_id FROM fiaon_persons WHERE id = $1), $1::int) AS id
    ),
    fam AS (
      SELECT q.id, q.werbung_gesperrt_am, (q.id = (SELECT id FROM kopf) AND COALESCE(q.is_blocked, FALSE)) AS blockiert, q.primary_email
        FROM fiaon_persons q
       WHERE q.id = $1 OR q.merged_into_person_id = $1
          OR q.id = (SELECT merged_into_person_id FROM fiaon_persons WHERE id = $1)
    )
    SELECT bool_or(fam.werbung_gesperrt_am IS NOT NULL) AS werbung,
           bool_or(fam.blockiert) AS vertrieb,
           EXISTS (SELECT 1 FROM fiaon_leads l
                    WHERE (l.abgemeldet_am IS NOT NULL OR l.strecke_stopp = 'abgemeldet')
                      AND (l.person_id IN (SELECT id FROM fam)
                           OR (NULLIF(TRIM(l.email), '') IS NOT NULL AND LOWER(TRIM(l.email)) IN
                                (SELECT LOWER(TRIM(primary_email)) FROM fam WHERE NULLIF(TRIM(primary_email), '') IS NOT NULL)))) AS abgemeldet,
           ${WA_STOPP_SQL("$1::int")} AS stopp
      FROM fam`, [personId])) as any[];
  if (!z) return null;
  if (z.werbung) return "Sperre: Werbesperre — diese Person hat um keine weitere Post gebeten, kein Auskunft-Angebot.";
  if (z.abgemeldet) return "Sperre: vom Werbeverteiler abgemeldet (Lead-Strecke) — kein Auskunft-Angebot.";
  if (z.stopp) return "Sperre: „STOPP“ auf WhatsApp — kein Auskunft-Angebot.";
  if (z.vertrieb) return "Vertriebssperre (kein Interesse) — kein Auskunft-Angebot, auch nicht von Hand.";
  return null;
}

/**
 * DIE TÜR IM MAIL-MOTOR (make-webhook.ts) für auskunft_angebot — sie kennt den Kreis.
 *   · Immer: Kaufstand (bezahlt, gemeldet, Dokument — fiaon-auskunft-lieferung.ts)
 *     und immerSperre (Werbesperre, Abmeldung, STOPP, Vertriebssperre).
 *   · Kreis 'uwg': dazu die Tür aus E-240 unverändert (auskunftAngebotTuerSperre:
 *     erst die erste Paketzahlung) — § 7 Abs. 3 prüft sperrUrteil.
 *   · Kreis 'alle', automatisch: Der Mensch muss in der Grundmenge stehen —
 *     dieselbe Abfrage wie der Takt (personImPool), also Segment A, B oder C,
 *     ohne Auskunft, ohne Sperrgrund. Von Hand (Betreuer) genügt der Kaufstand
 *     und immerSperre; Test, Kündigung und Werbesperre an der Adresse prüft
 *     sperrUrteil danach in jedem Fall.
 * null = darf durch. Jeder Grund endet auf „kein Auskunft-Angebot" oder beginnt
 * mit „Sperre:" — der Takt liest das als Urteil über den Menschen, nicht als
 * Störung des Versands.
 */
export async function angebotTuerSperre(
  personId: number | null, opts: { manuell?: boolean; kreis?: VerkaufKreis } = {}, lauf: Lauf = sqlPool,
): Promise<string | null> {
  const kreis = opts.kreis ?? (await verkaufKreis(lauf));
  const lieferung = await import("./fiaon-auskunft-lieferung");
  if (kreis === "uwg") {
    const alt = await lieferung.auskunftAngebotTuerSperre(personId, lauf);
    if (alt || !personId) return alt;
    return immerSperre(personId, lauf);
  }
  const kauf = await lieferung.auskunftAngebotKaufstand(personId, lauf);
  if (kauf || !personId) return kauf;
  const immer = await immerSperre(personId, lauf);
  if (immer) return immer;
  if (opts.manuell) return null;
  const z = await personImPool(personId, lauf);
  if (!z) return "Sperre: Kreis „alle“ — weder laufendes Paket noch Antrag (fertig oder begonnen) noch Lead ohne Antrag, kein Auskunft-Angebot.";
  if (z.hatAuskunft) return "Sperre: Auskunft liegt schon vor oder ist bestellt — kein Auskunft-Angebot.";
  if (z.sperrgrund) return `Sperre: ${SPERRGRUND_TEXT[z.sperrgrund]} — kein Auskunft-Angebot.`;
  return null;
}

/**
 * Darf das Angebot an diesen Menschen — alles zusammen, BEVOR eine Nutzlast
 * entsteht (Takt): die Tür oben und sperrUrteil (Werbesperre an jeder Adresse,
 * Test, Kündigung, § 7 Abs. 3 nur im Kreis 'uwg'). null = ja.
 */
export async function angebotSperre(
  personId: number | null, opts: { manuell?: boolean; kreis?: VerkaufKreis } = {}, lauf: Lauf = sqlPool,
): Promise<string | null> {
  if (!personId) return "Angebot der Auskunft nur an bekannte Menschen — ohne Person nicht.";
  const kreis = opts.kreis ?? (await verkaufKreis(lauf));
  const tuer = await angebotTuerSperre(personId, { manuell: opts.manuell, kreis }, lauf);
  if (tuer) return tuer;
  const { personSperre, sperrUrteil } = await import("./fiaon-mail-frequenz");
  const s = await personSperre(personId);
  return sperrUrteil(ANGEBOT_EVENT, s ? [s] : [], { manuell: opts.manuell === true, kreis });
}

/**
 * Ist dieser Stand verkaufbar? „nichts" ja; eine offene Bestellung nur, wenn sie
 * älter als 21 Tage und nicht als bezahlt gemeldet ist (dann legt der Kauflink
 * eine neue an). null = ja, sonst der Grund.
 */
export function standVerkaufbar(stand: Pick<AuskunftStand, "stufe" | "offen">, jetzt: number = Date.now()): string | null {
  if (stand.stufe === "nichts") return null;
  if (stand.stufe === "offen" && stand.offen && stand.offen.status !== "claimed_paid"
      && jetzt - new Date(stand.offen.angelegt).getTime() >= OFFEN_WIEDERVERWENDEN_TAGE * 86_400_000) return null;
  return `Auskunft inzwischen ${stand.stufe}`;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Nutzlast der Mail und die Werte der WhatsApp
// ───────────────────────────────────────────────────────────────────────────

/**
 * Der Kauflink als EIN Pfadstück für den Knopf der WhatsApp-Vorlage. Meta hängt
 * den Wert einer URL-Variable ans Ende der Adresse; ein „?p=…&art=…" darin wäre
 * ein Glücksspiel mit der Kodierung. Deshalb „4711-p-<exp36>-<sig>" — die Route
 * GET /auskunft/k/:token (fiaon-chef-auskunft.ts) macht daraus wieder genau den
 * signierten Link. Geprüft wird die Signatur dort, wo sie entstand.
 */
export async function kaufKurzToken(personId: number, art: AuskunftArt = "privat"): Promise<string> {
  const { kaufLink } = await import("../routes/fiaon-auskunft-kauf");
  const u = new URL(kaufLink(personId, art));
  const p = u.searchParams.get("p"), exp = Number(u.searchParams.get("exp")), sig = u.searchParams.get("sig");
  if (!p || !Number.isFinite(exp) || !sig) throw new Error("[AUSKUNFT-VERKAUF] Kauflink ohne Signatur");
  return `${p}-${art === "firma" ? "f" : "p"}-${exp.toString(36)}-${sig}`;
}

/** Zurück vom Kurztoken zu den Feldern des signierten Links — oder null bei falscher Form. */
export function kurzTokenLesen(token: unknown): { p: string; art: AuskunftArt; exp: string; sig: string } | null {
  const m = /^(\d{1,10})-([pf])-([0-9a-z]{6,12})-([0-9a-f]{32})$/.exec(String(token ?? ""));
  if (!m) return null;
  const exp = parseInt(m[3], 36);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  return { p: m[1], art: m[2] === "f" ? "firma" : "privat", exp: String(exp), sig: m[4] };
}

/**
 * Welche Auskunft für den Verkauf (E-241): das Business-Paket — laufend (A) oder
 * im offenen Antrag (B) — heißt Firma, alles andere privat. Für A dieselbe Regel
 * wie auskunftArtFuer (fiaon-auskunft.ts); B kennt die nicht, weil dort nur
 * bezahlte Pakete zählen.
 */
export async function artFuerVerkauf(personId: number, lauf: Lauf = sqlPool): Promise<{ art: AuskunftArt; segment: Segment | null; land: AuskunftLand | null }> {
  const z = await personImPool(personId, lauf).catch(() => null);
  return { art: z?.art ?? "privat", segment: z?.segment ?? null, land: z?.land ?? null };
}

/**
 * Welche WhatsApp-Vorlage zu welchem Segment gehört (E-241): Kunden lesen
 * fiaon_kk_auskunft („In Ihrer Akte fehlt noch …, Ihr Preis als FIAON-Kunde"),
 * fertige Anträge und Leads fiaon_kk_auskunft_lead (ohne Akte, Betreuer und
 * Hochlade-Weg, Einzelpreis) — beide aus shared/fiaon-lead-texte.ts.
 */
export function auskunftVorlageFuer(segment: Segment | null | undefined): string {
  // 26.09.2026 (E-243): auch der Abbrecher liest die Lead-Vorlage — „In Ihrer Akte fehlt noch …" und
  // „Ihr Preis als FIAON-Kunde" wären für ihn falsch (kein Paket, keine Akte, kein Bereich).
  return segment === "antrag" || segment === "lead" || segment === "abbrecher" ? AUSKUNFT_LEAD_VORLAGE : AUSKUNFT_VORLAGE;
}

export interface WaVorlagenWerte { wort: string; bei: string; preis: string; token: string; segment: Segment; vorlage: string }

/** Die Werte für {{2}}–{{4}} und den Knopf der Auskunft-Vorlage — samt der Vorlage, die zum Segment gehört. */
export async function waVorlagenWerte(personId: number, lauf: Lauf = sqlPool): Promise<WaVorlagenWerte | null> {
  const { art, segment, land: poolLand } = await artFuerVerkauf(personId, lauf);
  if (!segment) return null;
  const { auskunftStand } = await import("./fiaon-auskunft");
  const stand = await auskunftStand(personId, lauf, art);
  if (standVerkaufbar(stand)) return null;
  // E-241: Das Land der Grundmenge (bei Leads aus Vorwahl oder Adresse) — auskunftStand kennt nur den Antrag.
  const land = poolLand ?? stand.land;
  const vorlage = auskunftVorlageFuer(segment);
  // Gegenlesen 24.09.2026: Ein Business-Kunde bekommt die Firmen-Auskunft zum Firmenpreis — dann darf der
  // Text nicht nur „Ihre SCHUFA-Auskunft" und die privaten Datenkopien nennen (auskunftLeistung „firma").
  if (art === "firma") {
    return {
      wort: "Bonitätsauskunft für Ihr Unternehmen",
      bei: `den Wirtschaftsauskunfteien und für Sie persönlich bei ${auskunfteienText(land)}`,
      preis: stand.preis.text, token: await kaufKurzToken(personId, art), segment, vorlage,
    };
  }
  return { wort: auskunftWort(land), bei: auskunfteienText(land), preis: stand.preis.text, token: await kaufKurzToken(personId, art), segment, vorlage };
}

/**
 * Die Nutzlast für auskunft_angebot — aus der EINEN Stelle, die sie baut
 * (auskunftAngebotNutzlast, fiaon-auskunft-lieferung.ts; derselbe Weg wie der
 * Knopf in der Akte): Preis vom Server (A: auskunftPreis → 74/199 €, B/C:
 * 149/349 €), Land und Auskunfteien aus der Akte, Kauf-, Upload- und
 * Abmeldelink. Dazu der Vertrag Takt ↔ Vorlage (E-241): segment, fassung
 * (nach dem Schritt, nicht nach dem Zähler), für B paket_preis_hinweis — als
 * SCHALTER: Den Wortlaut setzt die Vorlage (paketHinweis in
 * server/mail/vorlagen/auskunft-verkauf.ts; ein Satz von hier ginge an der
 * Wortwand vorbei, und „74 € statt 149 €" wäre ein Streichpreis, PAngV § 11).
 * Kennt die Grundmenge ein anderes Land als der Antrag (Lead mit +43/+41),
 * gilt es — mit Auskunfteien und Leistung dieses Landes: Österreich und die
 * Schweiz lesen nie „SCHUFA".
 * KEINE werbe_grundlage: Die Tür prüft Kreis und Stichtag selbst — eine
 * behauptete Grundlage würde sie dort überspringen. null = keine Adresse.
 */
export async function angebotNutzlast(f: VerkaufFall, schritt: Exclude<Schritt, "whatsapp"> = "mail1", lauf: Lauf = sqlPool): Promise<Record<string, unknown> | null> {
  const { auskunftAngebotNutzlast } = await import("./fiaon-auskunft-lieferung");
  const n = await auskunftAngebotNutzlast(f.personId, { art: f.art }, lauf);
  if (!n) return null;
  const landAnders = auskunftLand(n.land) !== f.land;
  return {
    ...n,
    ...(landAnders ? { land: f.land, auskunfteien: auskunfteienText(f.land), leistung: auskunftLeistung(f.art, f.land) } : {}),
    ...(f.ref ? { antrag_id: f.ref } : {}),
    person_id: f.personId,
    // E-243: auch „abbrecher" — die Vorlage kennt es (ANGEBOT_SEGMENTE); der Takt prüft das vor dem Versand.
    segment: f.segment,
    fassung: FASSUNG_JE_SCHRITT[schritt],
    auskunft_art: f.art,
    // E-243: Kunde nie (er hat das Paket); fertiger Antrag und Abbrecher an (beide stehen vor der ersten
    // Paketzahlung — Auskunft UND Paket verkaufen); beim Lead entscheidet die Vorlage (kein Schlüssel).
    ...(f.segment === "lead" ? {} : { paket_preis_hinweis: f.segment === "antrag" || f.segment === "abbrecher" }),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Der Takt
// ───────────────────────────────────────────────────────────────────────────

export interface TaktErgebnis {
  grund?: string;
  geprueft: number;
  mails: number;
  whatsapp: number;
  uebersprungen: number;
  gruende: Record<string, number>;
  /** Wie viele dieser Lauf höchstens nehmen durfte (gleichmäßig über den Tag). */
  deckel?: { mails: number; whatsapp: number };
  /** Nur bei `trocken`: wer was bekommen hätte. */
  plan?: { personId: number; schritt: Schritt; segment: Segment }[];
}

let taktLaeuft = false;
let spaltenBereit: Promise<void> | null = null;
/**
 * Wem die WhatsApp HEUTE schon nicht zugestellt werden konnte (die WA-Zentrale
 * nahm ihn nicht — andere Vorlage in 3 Tagen, Tagesraum, Deckel 8 in 30 Tagen).
 * Ohne diese Liste griffe jeder Lauf wieder nach denselben ersten Namen, und die
 * Plätze dahinter blieben leer. Nur im Speicher und nur für den Berliner Tag —
 * morgen darf er wieder, der Verlauf in fiaon_wa_aktion bleibt unberührt.
 */
const waHeuteNicht = new Map<number, string>();
/**
 * Dasselbe für die Mail (Gegenlesen 25.09.2026): Wen die Vorprüfung VOR dem
 * Versand verwirft (Tür, Kaufstand, frische Bremse), der hinterlässt keine
 * Protokollzeile — und stünde im nächsten Lauf wieder vorn. Weicht die
 * Grundmenge je von der Tür ab (so geschehen: 162 Zusammengeführte), hielten
 * diese Menschen sonst die ersten Plätze jedes Laufs, und der Takt stünde.
 */
const mailHeuteNicht = new Map<number, string>();
function berlinTag(jetzt: Date = new Date()): string {
  try {
    const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(jetzt);
    const w = (a: string) => t.find((p) => p.type === a)?.value ?? "";
    return `${w("year")}-${w("month")}-${w("day")}`;
  } catch { return "?"; }
}

/**
 * fiaon_wa_aktion legt die WA-Zentrale an; ohne sie scheitert die Grundmenge.
 * E-243 (26.09.2026): dazu die Storno-Liste der Telefonkartei (Sperrgrund
 * „storniert" in der Grundmenge) und die Klicks auf den Kauflink (Rangfolge der
 * WhatsApp) — beide entstehen sonst erst beim ersten Storno bzw. Klick (die
 * Klick-Tabelle gab es am 26.09. in der Produktion noch nicht).
 * Exportiert für die WA-Zentrale (Gruppe „auskunft_fehlt").
 */
export async function tabellenBereit(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const { zentraleSchema } = await import("./fiaon-wa-zentrale");
      await zentraleSchema();
      const { karteiTabellen } = await import("./fiaon-telefonkartei");
      await karteiTabellen();
      const { klicksTabelle } = await import("../routes/fiaon-auskunft-kauf");
      await klicksTabelle();
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

/** Berührungen heute (Berliner Tag): Angebots-Mails aller Absender plus WhatsApp dieser Gruppe. */
export async function beruehrungenHeute(lauf: Lauf = sqlPool): Promise<{ mails: number; whatsapp: number; gesamt: number }> {
  await tabellenBereit();
  const [z] = (await lauf.unsafe(`
    SELECT
      (SELECT COUNT(*) FROM fiaon_mail_log WHERE event = '${ANGEBOT_EVENT}' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
          AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS mails,
      (SELECT COUNT(*) FROM fiaon_wa_aktion WHERE gruppe = '${WA_GRUPPE}' AND ok
          AND erstellt_am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS whatsapp`)) as any[];
  const mails = Number(z?.mails || 0), whatsapp = Number(z?.whatsapp || 0);
  return { mails, whatsapp, gesamt: mails + whatsapp };
}

/**
 * Ist WhatsApp für den Takt überhaupt möglich (eingerichtet und Vorlage bei Meta
 * frei)? E-241: je Segment eine Vorlage — `segmente` sagt, für wen die passende
 * frei ist (Kunden: fiaon_kk_auskunft; Anträge und Leads: fiaon_kk_auskunft_lead).
 */
export async function whatsappMoeglich(): Promise<{ moeglich: boolean; grund: string | null; segmente: Segment[] }> {
  try {
    const { waKonfig, freigegebeneVorlagen } = await import("./fiaon-whatsapp");
    if (!waKonfig().bereit) return { moeglich: false, grund: "WhatsApp ist nicht eingerichtet.", segmente: [] };
    const { istFrei } = await import("./fiaon-wa-zentrale");
    const frei = await freigegebeneVorlagen().catch(() => new Set<string>());
    const segmente = SEGMENTE.filter((s) => istFrei(auskunftVorlageFuer(s), frei));
    const fehlt = Array.from(new Set(SEGMENTE.filter((s) => !segmente.includes(s)).map((s) => auskunftVorlageFuer(s))));
    const grund = fehlt.length ? `Bei Meta nicht freigegeben: ${fehlt.map((n) => `„${n}“`).join(", ")} — bis dahin ruht dort der WhatsApp-Schritt.` : null;
    return { moeglich: segmente.length > 0, grund, segmente };
  } catch (e) {
    return { moeglich: false, grund: `WhatsApp-Stand nicht lesbar: ${String((e as Error)?.message || e).slice(0, 120)}`, segmente: [] };
  }
}

/** Ein Urteil der Tür über den Empfänger (kein Klemmen des Versands) — zählt nicht gegen die Drei-Fehler-Regel. */
const IST_URTEIL = /^(Frequenzbremse|Sperre:)|kein (Auskunft-)?Angebot/i;

const KREIS_SATZ: Record<VerkaufKreis, Record<Segment, string>> = {
  uwg: {
    kunde: "Grundlage § 7 Abs. 3 UWG — Kunde seit dem Widerspruchs-Hinweis im Antrag.",
    antrag: "Kreis „uwg“.", lead: "Kreis „uwg“.", abbrecher: "Kreis „uwg“.",
  },
  alle: {
    kunde: "Kreis „alle“ (Entscheidung Justin 25.09.2026), Segment A — Kunde mit laufendem Paket.",
    antrag: "Kreis „alle“ (Entscheidung Justin 25.09.2026), Segment B — Antrag fertig, nicht bezahlt.",
    lead: "Kreis „alle“ (Entscheidung Justin 25.09.2026), Segment C — Lead ohne Antrag.",
    // E-243 (26.09.2026)
    abbrecher: "Kreis „alle“ (Entscheidung Justin 25./26.09.2026), Abbrecher — Antrag begonnen, nicht abgeschickt.",
  },
};

/**
 * EIN DURCHLAUF (alle 30 Minuten über tageslauf). Ohne Schalter nichts.
 *
 * `trocken` = nur planen, nichts senden (Vorschau der Chefseite).
 * `jetzt` = die Uhr für Nachtruhe und Tempo (Prüfstand). `nurPersonen` = Prüfstand.
 * `mitSchalter: false` = den Schalter nicht fragen (nur mit `trocken` sinnvoll).
 */
export async function verkaufsTakt(opts: {
  trocken?: boolean; jetzt?: Date; nurPersonen?: number[] | null; mitSchalter?: boolean;
} = {}): Promise<TaktErgebnis> {
  const leer = (grund: string): TaktErgebnis => ({ grund, geprueft: 0, mails: 0, whatsapp: 0, uebersprungen: 0, gruende: {} });
  if (!opts.trocken && taktLaeuft) return leer("Takt läuft noch");
  const e = await verkaufEinstellungen();
  if (opts.mitSchalter !== false && !e.an) return leer(`abgeschaltet (${SCHALTER_AN} = 0)`);
  if (e.mailsProTag <= 0 && e.waProTag <= 0) return leer(`Tagesdeckel 0 (${SCHALTER_MAILS}, ${SCHALTER_WA})`);
  if (!opts.trocken && !istSendezeit(opts.jetzt)) return leer("Nachtruhe");

  if (!opts.trocken) taktLaeuft = true;
  try {
    const heute = await beruehrungenHeute();
    const mailRest = Math.max(0, e.mailsProTag - heute.mails);
    const waRest = Math.max(0, e.waProTag - heute.whatsapp);
    if (mailRest <= 0 && waRest <= 0) return leer("Tagesdeckel erreicht");
    // Gleichmäßig über den Tag — die Vorschau zeigt den ganzen Rest.
    let mailPlatz = opts.trocken ? mailRest : laufDeckel(mailRest, opts.jetzt, e.mailsProTag);
    let waPlatz = opts.trocken ? waRest : laufDeckel(waRest, opts.jetzt, e.waProTag);

    const wa = await whatsappMoeglich();
    const tag = berlinTag(opts.jetzt);
    for (const [id, t] of Array.from(waHeuteNicht)) if (t !== tag) waHeuteNicht.delete(id);
    for (const [id, t] of Array.from(mailHeuteNicht)) if (t !== tag) mailHeuteNicht.delete(id);
    // Etwas mehr holen als nötig — wer an einer Regel scheitert, soll den Platz nicht blockieren.
    const waFaelle = wa.moeglich && waPlatz > 0
      ? (await kandidatenHeute(waPlatz + 10 + waHeuteNicht.size, { waMoeglich: true, art: "whatsapp", kreis: e.kreis, nurPersonen: opts.nurPersonen, waSegmente: wa.segmente }))
        .filter((f) => !waHeuteNicht.has(f.personId))
      : [];
    const mailFaelle = mailPlatz > 0
      ? (await kandidatenHeute(mailPlatz + 10 + mailHeuteNicht.size, { waMoeglich: wa.moeglich, art: "mail", kreis: e.kreis, nurPersonen: opts.nurPersonen }))
        .filter((f) => opts.trocken || !mailHeuteNicht.has(f.personId))
      : [];
    /** Gegenlesen 25.09.2026: eine Adresse nur einmal je Lauf (Doppel-Personen ohne Zusammenführung). */
    const adressenImLauf = new Set<string>();
    const erg: TaktErgebnis = {
      geprueft: waFaelle.length + mailFaelle.length, mails: 0, whatsapp: 0, uebersprungen: 0, gruende: {},
      deckel: { mails: mailPlatz, whatsapp: waPlatz }, ...(opts.trocken ? { plan: [] } : {}),
    };
    const zaehle = (g: string) => { const s = g.slice(0, 120); erg.gruende[s] = (erg.gruende[s] ?? 0) + 1; erg.uebersprungen++; };
    let fehlerInFolge = 0;
    const laufId = `AV${Date.now().toString(36)}`;
    const { auskunftStand } = await import("./fiaon-auskunft");

    /**
     * E-243: Welche Segmente kennt die Mail-Vorlage? Eine Vorlage, die „abbrecher" nicht kennt, machte
     * daraus „kunde" (angebotSegment) — der Abbrecher läse „Ihr Preis als FIAON-Kunde". Dann lieber keine
     * Mail an dieses Segment, bis die Vorlage es kann.
     */
    const vorlageKennt = await import("../mail/vorlagen/auskunft-verkauf")
      .then((m: any) => new Set<string>(Array.isArray(m.ANGEBOT_SEGMENTE) ? m.ANGEBOT_SEGMENTE.map(String) : ["kunde", "antrag", "lead"]))
      .catch(() => new Set<string>(["kunde", "antrag", "lead"]));

    /**
     * Gegenlesen 26.09.2026 (E-243): „Anhalten" auf der Chefseite heißt „ab sofort nichts mehr" — ein Lauf,
     * der gerade 19 Mails abarbeitet, fragt deshalb VOR JEDER Sendung den Schalter neu (eine Zeile in
     * fiaon_settings). Vorher las der Takt ihn nur am Anfang des Laufs. Eine Störung beim Lesen heißt
     * „aus" (verkaufEinstellungen gibt dann den sicheren Stand).
     */
    const nochAn = async (): Promise<boolean> => opts.mitSchalter === false || (await verkaufEinstellungen()).an;

    /** Frisch nachsehen, BEVOR etwas rausgeht — null = darf. `weg` = der Kanal (E-243: die WhatsApp bremst 1 Tag, die Mail 3). */
    const vorVersand = async (f: VerkaufFall, weg: "mail" | "whatsapp" = "mail"): Promise<string | null> => {
      // Hat er gerade gekauft oder hochgeladen? Dann nichts.
      const nein = standVerkaufbar(await auskunftStand(f.personId, sqlPool, f.art, { land: false }));
      if (nein) return nein;
      // Die gemeinsame Bremse frisch — zwischen Auswahl und Versand kann Mara oder ein Mitarbeiter angeboten haben.
      const zuletzt = await zuletztAngeboten(f.personId, weg === "whatsapp" ? { tage: WA_ANGEBOT_ABSTAND_TAGE } : {});
      if (zuletzt) return `Angebot vor Kurzem (${ANGEBOT_WEG_TEXT[zuletzt.weg]})`;
      // Die Tür selbst fragen, BEVOR eine Nutzlast entsteht — mit dem Kreis dieses Laufs.
      const sperre = await angebotSperre(f.personId, { kreis: e.kreis });
      return sperre ? `Tür: ${sperre}` : null;
    };

    // ── 1. WhatsApp (eigener Deckel) ─────────────────────────────────────
    for (const f of waFaelle) {
      if (waPlatz <= 0) break;
      if (opts.trocken) { erg.plan!.push({ personId: f.personId, schritt: "whatsapp", segment: f.segment }); waPlatz--; continue; }
      if (!istSendezeit(opts.jetzt)) { zaehle("Nachtruhe begonnen — Rest nicht gesendet"); break; }
      if (!(await nochAn())) { erg.grund = "angehalten — Rest nicht gesendet"; break; }
      try {
        const nein = await vorVersand(f, "whatsapp");
        if (nein) { waHeuteNicht.set(f.personId, tag); zaehle(nein); continue; }
        const { auskunftWhatsAppSenden } = await import("./fiaon-wa-zentrale");
        const r = await auskunftWhatsAppSenden(f.personId, { laufId, von: "Verkaufstakt" });
        if (r.ok) { erg.whatsapp++; waPlatz--; continue; }
        // Kein Fehler des Takts: Die Mail-Stufe dieses Menschen läuft unabhängig weiter (Liste unten).
        waHeuteNicht.set(f.personId, tag);
        zaehle(`WhatsApp: ${r.grund ?? "nicht möglich"}`);
      } catch (err) {
        waHeuteNicht.set(f.personId, tag);
        zaehle(String((err as Error)?.message || err));
        console.error(`[AUSKUNFT-VERKAUF] WhatsApp Person ${f.personId}:`, err);
      }
    }

    // ── 2. Mails (eigener Deckel) ────────────────────────────────────────
    const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
    for (const f of mailFaelle) {
      if (mailPlatz <= 0) break;
      const schritt = f.mailSchritt;
      if (!schritt) { zaehle("wartet auf den nächsten Schritt"); continue; }
      if (opts.trocken) { erg.plan!.push({ personId: f.personId, schritt, segment: f.segment }); mailPlatz--; continue; }
      // Die Uhr läuft weiter — ein langer Lauf endet nicht in der Nacht.
      if (!istSendezeit(opts.jetzt)) { zaehle("Nachtruhe begonnen — Rest nicht gesendet"); break; }
      const adr = f.email.trim().toLowerCase();
      if (adressenImLauf.has(adr)) { zaehle("Adresse in diesem Lauf schon angeschrieben"); continue; }
      if (!vorlageKennt.has(f.segment)) { mailHeuteNicht.set(f.personId, tag); zaehle(`Mail-Vorlage kennt das Segment „${f.segment}“ noch nicht`); continue; }
      if (!(await nochAn())) { erg.grund = "angehalten — Rest nicht gesendet"; break; }
      try {
        const nein = await vorVersand(f, "mail");
        if (nein) { mailHeuteNicht.set(f.personId, tag); zaehle(nein); continue; }
        adressenImLauf.add(adr);
        const nutzlast = await angebotNutzlast(f, schritt);
        if (!nutzlast) { mailHeuteNicht.set(f.personId, tag); zaehle("keine zustellbare Adresse"); continue; }
        const nr = f.nMail + 1;
        const v = await versendenUndProtokollieren(ANGEBOT_EVENT as any, nutzlast as any, {
          personId: f.personId,
          // C (Lead ohne Antrag) hat keine Bestellung — der Verlauf hängt an ref; das Mail-Protokoll trägt die Person.
          verlaufRef: f.ref,
          verlaufText: `Verkaufstakt Bonitätsauskunft: Angebot per E-Mail (${nr}. von höchstens ${HOECHSTENS_MAILS} Mails, Fassung ${nutzlast.fassung}, `
            + `${nutzlast.preis_text}${nutzlast.mit_abo ? " Kundenpreis mit Paket" : " einzeln"}). ${KREIS_SATZ[e.kreis][f.segment]}`,
        });
        if (v.status === "versandt") { erg.mails++; mailPlatz--; fehlerInFolge = 0; }
        else if (IST_URTEIL.test(String(v.grund ?? ""))) {
          // Die Tür im Mail-Motor urteilt über DIESEN Empfänger — zählte das als Fehlschlag, hielten drei
          // solche Menschen am Anfang der Liste jeden Lauf an, und niemand dahinter bekäme je eine Mail.
          zaehle(`Mail: ${v.grund}`);
        } else {
          zaehle(`Mail: ${v.grund ?? v.status}`);
          // Drei Fehlschläge hintereinander heißen: Es klemmt am Versand, nicht am Menschen.
          if (++fehlerInFolge >= 3) { erg.grund = `Versand klemmt (${v.grund ?? v.status}) — Lauf beendet`; break; }
        }
      } catch (err) {
        zaehle(String((err as Error)?.message || err));
        console.error(`[AUSKUNFT-VERKAUF] Person ${f.personId}:`, err);
        if (++fehlerInFolge >= 3) { erg.grund = "Drei Fehler hintereinander — Lauf beendet"; break; }
      }
    }
    if (!opts.trocken && (erg.mails || erg.whatsapp)) {
      console.log(`[AUSKUNFT-VERKAUF] Kreis ${e.kreis}: ${erg.mails} Mails (heute ${heute.mails + erg.mails}/${e.mailsProTag}), `
        + `${erg.whatsapp} WhatsApp (heute ${heute.whatsapp + erg.whatsapp}/${e.waProTag})`);
    }
    return erg;
  } finally {
    if (!opts.trocken) taktLaeuft = false;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Vorschau für die Chefseite — nur lesen
// ───────────────────────────────────────────────────────────────────────────

export interface VorschauZeile {
  personId: number;
  name: string;
  land: AuskunftLand;
  art: AuskunftArt;
  segment: Segment;
  schritt: Schritt | null;
  fassung: AngebotFassung | null;
  preis: string;
  mail: string;
  kundeSeit: string | null;
  aktivAm: string | null;
  ersteMailAm: string | null;
  /** E-243: Kauflink geöffnet, nicht bestellt (nur WhatsApp-Reihe) — der Grund, warum er vorn steht. */
  klickAm: string | null;
}

function preisFuer(f: VerkaufFall): string {
  return euroText(auskunftPreisCents(f.art, f.segment === "kunde"));
}

function vorschauZeile(f: VerkaufFall, schritt: Schritt | null): VorschauZeile {
  return {
    personId: f.personId,
    name: [f.vorname, f.nachname].filter(Boolean).join(" ") || "Ohne Namen",
    land: f.land, art: f.art, segment: f.segment, schritt,
    fassung: schritt && schritt !== "whatsapp" ? FASSUNG_JE_SCHRITT[schritt] : null,
    preis: preisFuer(f),
    // Adressen gekürzt: Die Seite braucht sie nicht, jede weniger im Netzverkehr ist eine weniger.
    mail: f.email.replace(/^(.{2}).*(@.*)$/, "$1…$2"),
    kundeSeit: f.ersterAntragAm, aktivAm: f.aktivAm, ersteMailAm: f.ersteMailAm, klickAm: f.klickAm,
  };
}

/**
 * „Wer als Nächstes" (E-241) — dieselbe Auswahl wie der Takt, im eingestellten
 * Kreis, ohne zu senden und ohne den Schalter zu fragen: erst die WhatsApp-,
 * dann die Mail-Reihe, je bis `n`.
 */
export async function vorschau(n = 30): Promise<{
  whatsapp: VorschauZeile[]; mails: VorschauZeile[]; waGrund: string | null;
  restHeute: { mails: number; whatsapp: number }; einstellungen: VerkaufEinstellungen;
}> {
  const anzahl = Math.min(200, Math.max(1, Math.floor(Number(n) || 30)));
  const e = await verkaufEinstellungen();
  const heute = await beruehrungenHeute();
  const wa = await whatsappMoeglich();
  const [waFaelle, mailFaelle] = await Promise.all([
    wa.moeglich ? kandidatenHeute(anzahl, { waMoeglich: true, art: "whatsapp", kreis: e.kreis, waSegmente: wa.segmente }) : Promise.resolve([] as VerkaufFall[]),
    kandidatenHeute(anzahl, { waMoeglich: wa.moeglich, art: "mail", kreis: e.kreis }),
  ]);
  return {
    whatsapp: waFaelle.map((f) => vorschauZeile(f, "whatsapp")),
    mails: mailFaelle.map((f) => vorschauZeile(f, f.mailSchritt)),
    waGrund: wa.grund,
    restHeute: { mails: Math.max(0, e.mailsProTag - heute.mails), whatsapp: Math.max(0, e.waProTag - heute.whatsapp) },
    einstellungen: e,
  };
}

/** Stand E-240 (Chefseite): eine Liste, `restHeute` = Mails. */
export async function vorschauHeute(anzahl = 30): Promise<{ zeilen: VorschauZeile[]; waGrund: string | null; restHeute: number }> {
  const v = await vorschau(anzahl);
  return { zeilen: [...v.whatsapp, ...v.mails].slice(0, anzahl), waGrund: v.waGrund, restHeute: v.restHeute.mails };
}
