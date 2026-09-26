// ═══════════════════════════════════════════════════════════════════════════
// DIE ZAHLUNGSERINNERUNG AN OFFENE BONITÄTSAUSKÜNFTE (26.09.2026, E-244)
//
// Justin (26.09.2026): „Jeder, der die SCHUFA offen hat, braucht eine E-Mail mit
// Zahlungserinnerung."
//
// ── DER BEFUND (lesend in der Produktion, 26.09.2026 ~19:45) ───────────────
// 51 offene Auskunft-Bestellungen bei 50 Menschen (38 offen, 13 „Zahlung
// gemeldet"). Die Paket-Mahnmaschine (payment_reminder, fiaon-antrag.ts) nahm
// sie mit — aber mit dem Paket-Text („Ihre Akte wartet auf den Start",
// Werbeblock zur Karte), auch an „Zahlung gemeldet" (208 von 381 Mails seit
// dem 11.08.), und sie warf jeden hinaus, der ein bezahltes Paket hat: 29 von
// 33 Auskunft-Bestellern bekamen NIE eine Erinnerung. 29 von 33 haben auch nie
// eine Widerrufsbelehrung in Textform bekommen. Die Erinnerung holt sie nach —
// als NACHGEHOLTE Fassung (auskunft-erinnerung.ts): Die Frist rechnen wir dem
// Kunden ab Zugang dieser Mail, nie „ab Vertragsabschluss" (Gegenprüfung
// 26.09.2026: bei Wochen alten Bestellungen läse er sonst, sein Recht sei
// abgelaufen). Rechtlich gegenlesen lassen, bevor der Satz geändert wird.
//
// ── DER TAKT ──────────────────────────────────────────────────────────────
// Berliner Kalendertage seit der Bestellung:
//   Stufe 1 · Tag 1   Zahlungsdaten noch einmal
//   Stufe 2 · Tag 4   kurze Erinnerung
//   Stufe 3 · Tag 10  „wartet noch auf Ihre Überweisung"
//   Stufe 4 · Tag 18  „ist weiter offen"
//   Stufe 5+ · danach alle auskunft_erinnerung_dauer_tage Tage (Standard 7,
//             0 = nach Tag 18 Schluss) — die Dauermahnung nach E-182, nur ruhiger.
// Zwischen zwei Mails liegen mindestens MINDESTABSTAND_TAGE (2); in der
// Dauerstufe mindestens die Dauer-Tage seit der letzten Mail.
// NACHHOLEN: Die Stufe richtet sich nach dem ALTER. Wer heute schon Tag 45 hat
// und nie erinnert wurde, bekommt GENAU EINE Mail (die Dauerstufe seines
// Alters) — frühere Stufen gelten als übersprungen. Neueste zuerst.
// Solange für die Bestellung keine Belehrung in Textform protokolliert ist
// (payment_details in der Auskunft-Fassung oder eine eigene Erinnerung mit
// Belehrung), trägt die Mail Vertragsbestätigung und die nachgeholte
// Widerrufsbelehrung — in der Praxis die erste Erinnerung jeder Altbestellung.
// Ab Tag 30: EINMAL je Bestellung eine Aufgabe. Im Takt an den Betreuer (sonst
// den Betreiber) „Auskunft seit 30 Tagen offen — anrufen oder stornieren". Mit
// Storno-Vorschlag (gekündigt, Dokument, Vertriebssperre) NUR an den Betreiber
// und OHNE Anruf: „… — stornieren? (Grund)" (Gegenprüfung 26.09.2026: ein Anruf
// bei Vertriebssperre widerspräche der Sperre auf allen Wegen).
//
// ── WER ───────────────────────────────────────────────────────────────────
// Jede Auskunft-Bestellung (type schufa / FIAON-SCHUFA-…) mit payment_status
// pending_payment, nicht zusammengeführt, nicht storniert, nicht archiviert,
// kein Test, kein Mahnstopp, nicht hart unzustellbar, mit Verwendungszweck.
//   · Mahnstopp zählt je PERSON: auch ein Mahnstopp an einer anderen Bestellung
//     derselben Person (Paket, Zusage der Rückholung) hält die Erinnerung an
//     (Gegenprüfung 26.09.2026, Fall MRRXTXV6) — eigener Grund auf der Chefseite.
//   · „Zahlung gemeldet" (claimed_paid) bekommt NIE eine Erinnerung.
//   · Die Werbesperre sperrt NICHT — Zahlungspost (ZAHLUNGSPOST in
//     fiaon-mail-frequenz.ts). Wer nicht mehr erinnert werden will: Mahnstopp.
//   · Mit sichtbarem Grund auf der Chefseite (Vorschlag „stornieren?"), ohne
//     Mail: gekündigt, schon ein eigenes Auskunft-Dokument, Vertriebssperre an
//     der führenden Person.
//
// ── DIE BREMSEN ───────────────────────────────────────────────────────────
//   · auskunft_erinnerung_an — STANDARD AN (Justins Auftrag ist die Freigabe),
//     aus nur über die Chefseite (Protokoll).
//   · je Lauf höchstens JE_LAUF (10), je Berliner Tag auskunft_erinnerung_pro_tag
//     (Standard 50).
//   · Sendefenster Mo–So 07:00–20:30 (istSendezeit, fiaon-auskunft-verkauf.ts).
//   · Die Marke (Stufe + Zeit) wird VOR dem Versand gesetzt — als Vergleich
//     auf die alte Stufe, damit zwei Instanzen oder ein Neustart dieselbe Stufe
//     nie zweimal schicken — und bei einem Fehlschlag zurückgenommen (dann
//     Ruhe: 6 Stunden nach einem Transportfehler, 20 nach einem Urteil der Tür).
//
// ── ZWEI FASSUNGEN: ERINNERUNG ODER FRAGE (Nachbesserung 26.09.2026, Gesamtdurchsicht) ──
// Die Erinnerung (Zahlungsdaten, „danke für Ihre Bestellung", beim ersten Mal Vertragsbestätigung und
// Belehrung) bekommt NUR eine Bestellung, die der Kunde selbst erklärt hat (KUNDENERKLAERUNG_SQL,
// fiaon-auskunft.ts: Wahl zum Beginn, Beschaffungsauftrag oder sein Klick auf „zahlungspflichtig").
// Ohne Erklärung — gemessen 26.09.: jede der 38 offenen, vom Betreuer „auf Kundenwunsch aus der Akte",
// von Mara oder über den alten Kaufweg angelegt — geht stattdessen die FRAGE: „Zu Ihrer Bonitätsauskunft
// ist noch eine Bestellung offen — möchten Sie sie noch?", ohne Bankdaten, ohne Vertragsbestätigung, mit
// dem Kauflink der Person (er zeigt für genau diese Bestellung das Bestätigungsformular zu IHREM Betrag,
// offenOhneWahl) und „Möchten Sie sie nicht mehr? Antworten Sie kurz — wir stornieren, es entstehen
// keine Kosten." Zeigt der Kauflink nicht genau diese Bestellung (andere offene, teurer als heute,
// Firma, ohne Person), geht nichts — Ruhe mit Hinweis auf der Chefseite. Die Frage respektiert die
// Werbesperre (sie bittet um eine Bestätigung, ist also keine reine Zahlungspost) — dann „stornieren?".
// Takt der Frage: Tag 1/4/10/18, danach höchstens FRAGE_DAUER_HOECHSTENS (2) Dauer-Mails im Abstand der
// Dauer-Tage, dann Schluss und einmal die Aufgabe. Ältere Bestellungen steigen in der Dauerstufe ein —
// dort zählt die Stufe die verschickten Dauer-Fragen (5 = erste, 6 = zweite), nicht das Alter.
// Bestätigt der Kunde über den Kauflink, hat die Bestellung ihre Erklärung und läuft als Erinnerung weiter.
//
// ── NACHBESSERUNGEN 26.09.2026 (Gesamtdurchsicht) ──
//   · Keine Mail vor 24 Stunden nach der Bestellung (Tag 1 nach Mitternacht war sonst nach Minuten fällig).
//   · Die Aufgabe „anrufen oder stornieren" erst, wenn mindestens eine Mail raus ist und seitdem 7 Tage
//     vergangen sind (vorher am Tag 30 auch dann, wenn die erste Mail eben erst hinausging); bei der Frage
//     erst nach dem Ende ihres Takts. „stornieren?" (ohne Anruf) bleibt ab Tag 30.
//   · Tür-Grund „bezahlt": Hat die Person (oder ihre Kopf-Person) schon eine BEZAHLTE Auskunft, geht keine
//     Mail — Vorschlag „stornieren?".
//
// Versand NUR über die eine Tür (sendMakeWebhookMitGrund → Motor, nurMotor):
// Protokoll fiaon_mail_log mit antrag_id und stufe, Vermerk im Verlauf der
// Bestellung. Registriert in routes.ts als tageslauf("auskunft_erinnerung", …, 30 Min.).
// Prüfstand: scripts/pruef-auskunft-erinnerung.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinDatum, berlinZeitpunkt } from "./fiaon-time";
import { unzustellbarSql, zielMailSql } from "./fiaon-empfaenger";
import { absoluteUrl } from "../fiaon-base-url";
import type { MakeWebhookPayload } from "../make-webhook";
import { katalogpreisCents } from "./fiaon-massgebliche-bestellung";
import { anredeMail } from "@shared/fiaon-anrede";
import { AUSKUNFT_SCHLUESSEL, auskunftLand, euroText, type AuskunftLand } from "@shared/fiaon-auskunft";
import { KUNDENERKLAERUNG_SQL } from "./fiaon-auskunft";
import {
  istSendezeit, SCHALTER_ERINNERUNG_AN, SCHALTER_ERINNERUNG_PRO_TAG, SCHALTER_ERINNERUNG_DAUER,
  STANDARD_ERINNERUNG_PRO_TAG, HOECHSTENS_ERINNERUNG_PRO_TAG, STANDARD_ERINNERUNG_DAUER_TAGE, HOECHSTENS_ERINNERUNG_DAUER_TAGE,
} from "./fiaon-auskunft-verkauf";

type Lauf = typeof sqlPool;

export const EREIGNIS = "auskunft_zahlung_erinnerung" as const;
/** Die festen Stufen: Tag nach der Bestellung (Berliner Kalendertage). Danach die Dauerstufe. */
export const STUFEN_TAGE = [1, 4, 10, 18] as const;
export const MINDESTABSTAND_TAGE = 2;
export const AUFGABE_AB_TAGEN = 30;
/** Die Aufgabe „anrufen oder stornieren" erst so viele Tage nach der letzten Mail (Gesamtdurchsicht 26.09.2026). */
export const AUFGABE_NACH_MAIL_TAGE = 7;
/** Keine Mail, bevor die Bestellung so alt ist (Stunden) — Tag 1 beginnt sonst um Mitternacht. */
export const ERSTE_MAIL_AB_STUNDEN = 24;
/** Die Fassung „Frage" (Bestellung ohne Erklärung des Kunden): nach Tag 18 höchstens so viele Dauer-Mails. */
export const FRAGE_DAUER_HOECHSTENS = 2;

/** Welche Mail eine Bestellung bekommt: Erinnerung (Kunde hat erklärt) oder Frage (ohne Erklärung). */
export type Fassung = "erinnerung" | "frage";
/** Höchstens so viele Mails je Lauf (alle 30 Minuten). */
export const JE_LAUF = 10;
/** Höchstens so viele neue Aufgaben je Lauf — beim ersten Lauf sind es alle Altfälle. */
const AUFGABEN_JE_LAUF = 30;
const RUHE_NACH_TRANSPORTFEHLER_STUNDEN = 6;
const RUHE_NACH_URTEIL_STUNDEN = 20;
/** Der Vermerk im Verlauf, wenn die Mail die Belehrung trug — die zweite Quelle neben dem Mail-Protokoll. */
export const VERMERK_BELEHRUNG = "mit Vertragsbestätigung und Widerrufsbelehrung";
/**
 * Anfang des Verlaufseintrags der Vertragsbestätigung nach der Bestätigung einer offenen Bestellung ohne Erklärung
 * (bestaetigungNachErklaerung) — zählt wie „Zahlungserinnerung …" mit VERMERK_BELEHRUNG als protokollierte Belehrung.
 */
export const VERMERK_BESTAETIGUNG = "Vertragsbestätigung nach der Bestätigung des Kunden verschickt";
/** Anfang des Verlaufseintrags, wenn auskunftBestellen die Zahlungsdaten einer Bestellung ohne Erklärung zurückhält. */
export const VERMERK_ZAHLUNGSDATEN_ZURUECK = "Zahlungsdaten NICHT verschickt";

// ───────────────────────────────────────────────────────────────────────────
// Die Einstellungen
// ───────────────────────────────────────────────────────────────────────────

export interface ErinnerungEinstellungen { an: boolean; proTag: number; dauerTage: number }

function ganzeZahl(roh: unknown): number | null {
  const s = String(roh ?? "").trim();
  return /^\d{1,6}$/.test(s) ? Number(s) : null;
}

/** Rein (Prüfstand): Schalter STANDARD AN — nur ein ausdrückliches „0" schaltet aus. */
export function erinnerungEinstellungenLesen(roh: Record<string, unknown>): ErinnerungEinstellungen {
  const an = String(roh[SCHALTER_ERINNERUNG_AN] ?? "").trim();
  return {
    an: an !== "0",
    proTag: Math.min(HOECHSTENS_ERINNERUNG_PRO_TAG, Math.max(0, ganzeZahl(roh[SCHALTER_ERINNERUNG_PRO_TAG]) ?? STANDARD_ERINNERUNG_PRO_TAG)),
    dauerTage: Math.min(HOECHSTENS_ERINNERUNG_DAUER_TAGE, Math.max(0, ganzeZahl(roh[SCHALTER_ERINNERUNG_DAUER]) ?? STANDARD_ERINNERUNG_DAUER_TAGE)),
  };
}

/** Aus fiaon_settings. Bei einer Störung wirft sie — der Lauf bricht dann ab, statt ohne Deckel zu senden. */
export async function erinnerungEinstellungen(lauf: Lauf = sqlPool): Promise<ErinnerungEinstellungen> {
  const zeilen = (await lauf`
    SELECT key, value FROM fiaon_settings WHERE key = ANY(${[SCHALTER_ERINNERUNG_AN, SCHALTER_ERINNERUNG_PRO_TAG, SCHALTER_ERINNERUNG_DAUER]})`) as any[];
  return erinnerungEinstellungenLesen(Object.fromEntries(zeilen.map((z) => [String(z.key), z.value])));
}

// ───────────────────────────────────────────────────────────────────────────
// Die reine Zeitrechnung (Berlin) — prüfbar ohne Datenbank
// ───────────────────────────────────────────────────────────────────────────

/** Ganze Kalendertage zwischen zwei Zeitpunkten, gezählt an der Berliner Tagesgrenze. */
export function berlinTageSeit(von: Date, bis: Date): number {
  const [y1, m1, d1] = berlinDatum(von).split("-").map(Number);
  const [y2, m2, d2] = berlinDatum(bis).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Die Stufe, die zum Alter gehört (0 = noch keine). Ab Tag 18 die Dauerstufe, bei 0 Dauer-Tagen bleibt es bei 4. */
export function stufeFuerAlter(tage: number, dauerTage: number): number {
  if (!Number.isFinite(tage) || tage < STUFEN_TAGE[0]) return 0;
  if (tage < STUFEN_TAGE[1]) return 1;
  if (tage < STUFEN_TAGE[2]) return 2;
  if (tage < STUFEN_TAGE[3]) return 3;
  if (dauerTage <= 0) return 4;
  return 4 + Math.floor((tage - STUFEN_TAGE[3]) / dauerTage);
}

/** Wie die Stufe auf der Chefseite und im Verlauf heißt. */
export function stufeText(stufe: number, fassung: Fassung = "erinnerung"): string {
  if (stufe <= 0) return "noch keine";
  if (fassung === "frage") {
    if (stufe <= 4) return `${stufe}. Nachfrage (Tag ${STUFEN_TAGE[stufe - 1]})`;
    return `Dauer-Nachfrage ${stufe - 4} von ${FRAGE_DAUER_HOECHSTENS}`;
  }
  if (stufe <= 4) return `${stufe}. Erinnerung (Tag ${STUFEN_TAGE[stufe - 1]})`;
  return `Dauererinnerung ${stufe - 4}`;
}

export interface ErinnerungStand {
  bestelltAm: Date;
  /** Die zuletzt verschickte Stufe (0 = noch keine). */
  stufe: number;
  letzteAm: Date | null;
}

/**
 * Welche Stufe ist an diesem Tag fällig? null = keine. Rein; das Sendefenster
 * prüft der Lauf (istSendezeit), damit die Chefseite auch nachts „heute fällig" zählt.
 * Idempotent: Ist die Stufe des Alters schon verschickt, kommt null.
 * Fassung „frage" (ohne Erklärung des Kunden): in der Dauerstufe zählt die Stufe die verschickten Dauer-Fragen
 * (5, 6) statt des Alters, höchstens FRAGE_DAUER_HOECHSTENS — danach null.
 */
export function faelligeStufe(s: ErinnerungStand, jetzt: Date, dauerTage: number, fassung: Fassung = "erinnerung"): number | null {
  // Gesamtdurchsicht 26.09.2026: keine Mail vor 24 Stunden (Bestellung 23:50 → Tag 1 wäre um 00:00 fällig).
  if (jetzt.getTime() - s.bestelltAm.getTime() < ERSTE_MAIL_AB_STUNDEN * 3_600_000) return null;
  const nachAlter = stufeFuerAlter(berlinTageSeit(s.bestelltAm, jetzt), dauerTage);
  let ziel = nachAlter;
  if (fassung === "frage" && nachAlter >= 5) {
    ziel = Math.max(5, s.stufe + 1);
    if (ziel > 4 + FRAGE_DAUER_HOECHSTENS) return null;
  }
  if (ziel <= s.stufe) return null;
  if (s.letzteAm) {
    const seit = berlinTageSeit(s.letzteAm, jetzt);
    if (seit < MINDESTABSTAND_TAGE) return null;
    // Die Dauerstufe hält ihren Abstand zur letzten Mail — auch wenn die letzte ein Nachholen war.
    if (ziel >= 5 && seit < dauerTage) return null;
  }
  return ziel;
}

/** Der erste Berliner Tag (YYYY-MM-DD), an dem wieder eine Stufe fällig ist — null = keine mehr (Dauer 0). */
export function naechsteFaelligkeit(s: ErinnerungStand, jetzt: Date, dauerTage: number, horizontTage = 120, fassung: Fassung = "erinnerung"): string | null {
  const heute = berlinDatum(jetzt);
  for (let d = 0; d <= horizontTage; d++) {
    const [y, m, t] = heute.split("-").map(Number);
    const tag = new Date(Date.UTC(y, m - 1, t + d)).toISOString().slice(0, 10);
    // Gemessen am Ende des Sendefensters (20:29) — so zählt auch die 24-Stunden-Grenze einer Abendbestellung.
    const spaet = d === 0 ? jetzt : berlinZeitpunkt(tag, 20 * 60 + 29);
    if (faelligeStufe(s, spaet, dauerTage, fassung) != null) return tag;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Tür — wer bekommt eine Erinnerung, wer nicht und warum (rein)
// ───────────────────────────────────────────────────────────────────────────

export type TuerGrund =
  | "gemeldet" | "archiviert" | "test" | "ohne_zweck" | "ohne_mail" | "mahnstopp" | "mahnstopp_person" | "unzustellbar"
  | "bezahlt" | "gekuendigt" | "dokument" | "vertriebssperre" | "werbesperre_frage";

export const TUER_GRUND_TEXT: Record<TuerGrund, string> = {
  gemeldet: "Zahlung gemeldet — wird der Bank zugeordnet, keine Erinnerung",
  archiviert: "archiviert",
  test: "Testkonto",
  ohne_zweck: "ohne Verwendungszweck",
  ohne_mail: "keine E-Mail-Adresse",
  mahnstopp: "Mahnstopp — keine Erinnerung",
  mahnstopp_person: "Mahnstopp an einer anderen Bestellung dieser Person — keine Erinnerung",
  unzustellbar: "E-Mail unzustellbar (Rückläufer oder Spam-Meldung) — Aufgabe „Adresse klären“ läuft",
  bezahlt: "hat schon eine bezahlte Bonitätsauskunft — stornieren?",
  gekuendigt: "gekündigt — stornieren?",
  dokument: "hat schon ein eigenes Auskunft-Dokument — stornieren?",
  vertriebssperre: "Vertriebssperre (kein Interesse) — stornieren?",
  werbesperre_frage: "ohne Bestätigung des Kunden und mit Werbesperre — keine Nachfrage per Mail, stornieren?",
};

/** Kurzform des Storno-Grunds für Aufgabentitel. */
const STORNO_KURZ: Partial<Record<TuerGrund, string>> = {
  bezahlt: "schon eine bezahlte Auskunft", gekuendigt: "gekündigt", dokument: "hat schon ein Auskunft-Dokument",
  vertriebssperre: "Vertriebssperre", werbesperre_frage: "ohne Bestätigung, Werbesperre",
};

export interface TuerZeile {
  status: string;
  archiviert: boolean;
  test: boolean;
  paymentReference: string | null;
  mail: string | null;
  mahnstopp: boolean;
  /** Mahnstopp an einer ANDEREN Bestellung derselben Person (Paket, Rückholung). */
  mahnstoppPerson?: boolean;
  unzustellbar: boolean;
  gekuendigt: boolean;
  dokument: boolean;
  vertriebssperre: boolean;
  werbesperre?: boolean;
  /**
   * Hat der Kunde die Bestellung selbst erklärt (KUNDENERKLAERUNG_SQL)? false = Fassung „Frage".
   * Fehlt das Feld (reine Prüfungen alter Form), gilt es als erklärt.
   */
  erklaert?: boolean;
  /** Hat die Person (oder ihre Kopf-Person) schon eine BEZAHLTE Auskunft? */
  bezahltPerson?: boolean;
}

export interface TuerUrteil {
  erinnern: boolean;
  grund: TuerGrund | null;
  /** In der Tabelle „Bestellt, nicht bezahlt" zeigen? Archivierte und Tests nicht. */
  zeigen: boolean;
  /** Vorschlag „stornieren?" — schon bezahlt, gekündigt, Dokument, Vertriebssperre, Frage mit Werbesperre. */
  stornieren: boolean;
  /** Welche Mail — Erinnerung (erklärt) oder Frage (ohne Erklärung). Auch ohne Mail gesetzt (für die Chefseite). */
  fassung: Fassung;
}

/** Rein: welche Fassung eine Bestellung bekommt. */
export function fassungFuer(z: Pick<TuerZeile, "erklaert">): Fassung {
  return z.erklaert === false ? "frage" : "erinnerung";
}

/** Eine Testadresse (wie der Rest des Hauses: .test, @example.) — solche Bestellungen sind Proben, keine Kunden. */
export function istTestAdresse(mail: string | null | undefined): boolean {
  const m = String(mail ?? "").trim().toLowerCase();
  return m.endsWith(".test") || m.includes("@example.");
}

/** Rein. Die Reihenfolge ist die der Wichtigkeit — je Bestellung der erste zutreffende Grund. */
export function tuerUrteil(z: TuerZeile): TuerUrteil {
  const fassung = fassungFuer(z);
  const nein = (grund: TuerGrund, zeigen = true, stornieren = false): TuerUrteil => ({ erinnern: false, grund, zeigen, stornieren, fassung });
  if (z.archiviert) return nein("archiviert", false);
  if (z.test || istTestAdresse(z.mail)) return nein("test", false);
  if (z.status === "claimed_paid") return nein("gemeldet");
  if (z.status !== "pending_payment") return nein("gemeldet", false);
  if (z.mahnstopp) return nein("mahnstopp");
  if (!String(z.paymentReference ?? "").trim()) return nein("ohne_zweck");
  if (!String(z.mail ?? "").includes("@")) return nein("ohne_mail");
  if (z.unzustellbar) return nein("unzustellbar");
  // Gesamtdurchsicht 26.09.2026: schon eine bezahlte Auskunft (auch an der Kopf-Person) — diese ist wohl doppelt.
  if (z.bezahltPerson) return nein("bezahlt", true, true);
  if (z.gekuendigt) return nein("gekuendigt", true, true);
  if (z.dokument) return nein("dokument", true, true);
  if (z.vertriebssperre) return nein("vertriebssperre", true, true);
  // Nach den Storno-Gründen: Wer gekündigt/gesperrt ist UND einen Mahnstopp am Paket hat, soll auf der Chefseite
  // „stornieren?" zeigen (die Aufgabe geht dann ohne Anruf an den Betreiber) — eine Mail bekommt er so oder so nicht.
  if (z.mahnstoppPerson) return nein("mahnstopp_person");
  // Die Frage (ohne Erklärung) bittet um eine Bestätigung zum Kauf — keine reine Zahlungspost. Mit Werbesperre
  // geht sie nicht; die Bestellung hat keinen Kundenauftrag, also „stornieren?" an den Betreiber.
  if (fassung === "frage" && z.werbesperre) return nein("werbesperre_frage", true, true);
  // Die Werbesperre hält die Zahlungspost NICHT auf (ZAHLUNGSPOST, fiaon-mail-frequenz.ts).
  return { erinnern: true, grund: null, zeigen: true, stornieren: false, fassung };
}

// ───────────────────────────────────────────────────────────────────────────
// Schema: die Marken an der Bestellzeile
// ───────────────────────────────────────────────────────────────────────────

const SPALTEN = [
  ["auskunft_erinnerung_stufe", "INTEGER"],
  ["auskunft_erinnerung_am", "TIMESTAMPTZ"],
  ["auskunft_erinnerung_ruhe_bis", "TIMESTAMPTZ"],
  ["auskunft_erinnerung_hinweis", "TEXT"],
  ["auskunft_erinnerung_aufgabe_am", "TIMESTAMPTZ"],
  // Nachbesserung 26.09.2026: die EINE Vertragsbestätigung nach der Bestätigung einer offenen Bestellung ohne Erklärung.
  ["auskunft_bestaetigung_am", "TIMESTAMPTZ"],
] as const;

let spaltenBereit: Promise<void> | null = null;
/**
 * Legt die sechs Spalten an, falls sie fehlen. Erst nachsehen, dann ändern: Ein
 * ALTER TABLE nimmt die Tabellensperre auch bei IF NOT EXISTS — an
 * fiaon_applications hängt jede Anfrage des Hauses. Deshalb nur, wenn wirklich
 * etwas fehlt, und mit lock_timeout (Muster fiaon-global-zahlungstakt.ts).
 */
export async function ensureErinnerungSpalten(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const da = (await sqlPool`
        SELECT column_name FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = 'fiaon_applications'
           AND column_name = ANY(${SPALTEN.map(([n]) => n)})`) as any[];
      const fehlt = SPALTEN.filter(([n]) => !da.some((d) => String(d.column_name) === n));
      if (!fehlt.length) return;
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(`ALTER TABLE fiaon_applications ${fehlt.map(([n, t]) => `ADD COLUMN IF NOT EXISTS ${n} ${t}`).join(", ")}`);
      });
    })().catch((e) => { spaltenBereit = null; throw e; });
  }
  return spaltenBereit;
}

// ───────────────────────────────────────────────────────────────────────────
// Die offenen Bestellungen — EINE Abfrage für Lauf und Chefseite
// ───────────────────────────────────────────────────────────────────────────

const IST_AUSKUNFT = `(COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')`;

/**
 * Ein Mahnstopp an einer ANDEREN Bestellung derselben Person (Paket-Zeile, Zusage der
 * Rückholung — beide setzen mahnstopp_am an ihrer Zeile). Auch an zusammengeführten
 * oder stornierten Zeilen: Mahnstopp ist eine Entscheidung über den Menschen.
 * `z` ist der Alias der Auskunft-Zeile; ohne Person gibt es keine andere Bestellung.
 */
export const MAHNSTOPP_PERSON_SQL = (z: string) => `(${z}.person_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM fiaon_applications ms WHERE ms.person_id = ${z}.person_id AND ms.ref <> ${z}.ref
     AND ms.mahnstopp_am IS NOT NULL AND ms.gdpr_deleted_at IS NULL))`;

export interface OffeneBestellung extends TuerZeile {
  ref: string;
  personId: number | null;
  name: string;
  vorname: string | null;
  nachname: string | null;
  betreuer: string | null;
  betreuerId: number | null;
  land: AuskunftLand;
  art: "privat" | "firma";
  paket: string;
  betragCents: number | null;
  angelegt: Date;
  gemeldetAm: Date | null;
  stufe: number;
  letzteAm: Date | null;
  ruheBis: Date | null;
  hinweis: string | null;
  aufgabeAm: Date | null;
  erklaert: boolean;
  bezahltPerson: boolean;
}

/**
 * Alle offenen Auskunft-Bestellungen (offen und „Zahlung gemeldet"), neueste zuerst. Ohne Stornierte, Ersetzte,
 * Zusammengeführte. `refs` grenzt auf bestimmte Bestellungen ein — nur für den Prüfstand (die Test-DB teilen sich alle).
 */
export async function offeneBestellungen(lauf: Lauf = sqlPool, limit = 500, refs: string[] | null = null): Promise<OffeneBestellung[]> {
  await ensureErinnerungSpalten();
  const zeilen = (await lauf.unsafe(`
    SELECT a.ref, a.person_id, a.payment_reference, a.payment_status, a.amount_due, a.pack_key, a.pack_name, a.type,
           a.created_at::timestamptz AS angelegt, a.claimed_paid_at, (a.archived_at IS NOT NULL) AS archiviert,
           (a.mahnstopp_am IS NOT NULL) AS mahnstopp,
           ${MAHNSTOPP_PERSON_SQL("a")} AS mahnstopp_person,
           COALESCE(a.auskunft_erinnerung_stufe, 0) AS stufe, a.auskunft_erinnerung_am AS letzte_am,
           a.auskunft_erinnerung_ruhe_bis AS ruhe_bis, a.auskunft_erinnerung_hinweis AS hinweis, a.auskunft_erinnerung_aufgabe_am AS aufgabe_am,
           ${zielMailSql("a")} AS mail,
           (p.ist_test_am IS NOT NULL OR a.ref LIKE 'FIAON-TEST%') AS test_konto,
           -- Gegenprüfung 26.09.2026: auch die Werbesperre der Kopf-Person (die Adresse prüft der Lauf, werbesperreAnAdresse).
           (p.werbung_gesperrt_am IS NOT NULL OR kopf.werbung_gesperrt_am IS NOT NULL) AS werbesperre,
           COALESCE(kopf.is_blocked, FALSE) AS vertriebssperre,
           ${unzustellbarSql("a")} AS unzustellbar,
           EXISTS (SELECT 1 FROM fiaon_applications g WHERE g.person_id = a.person_id AND g.merged_into IS NULL
                     AND g.gekuendigt_am IS NOT NULL AND g.kuendigung_zurueckgenommen_am IS NULL) AS gekuendigt,
           (EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = a.person_id AND d.gdpr_deleted_at IS NULL AND d.schufa_pdf IS NOT NULL)
            OR EXISTS (SELECT 1 FROM fiaon_dokumente k WHERE k.person_id = a.person_id AND k.geloescht_am IS NULL AND k.art ILIKE '%schufa%')) AS dokument,
           -- Gesamtdurchsicht 26.09.2026: die EINE Erkennung, ob der Kunde die Bestellung selbst erklärt hat (fiaon-auskunft.ts).
           ${KUNDENERKLAERUNG_SQL("a")} AS erklaert,
           -- Gesamtdurchsicht 26.09.2026: schon eine BEZAHLTE Auskunft an der Person oder an ihrer Kopf-Person
           -- (auch an einer zusammengeführten Zeile — bezahlt ist bezahlt).
           EXISTS (SELECT 1 FROM fiaon_applications bz LEFT JOIN fiaon_persons bp ON bp.id = bz.person_id
                    WHERE bz.ref <> a.ref AND bz.payment_status = 'paid' AND bz.gdpr_deleted_at IS NULL
                      AND (COALESCE(bz.type, '') = 'schufa' OR bz.ref LIKE 'FIAON-SCHUFA-%')
                      AND (bz.person_id = a.person_id OR COALESCE(bp.merged_into_person_id, bp.id) = kopf.id)) AS bezahlt_person,
           COALESCE(NULLIF(TRIM(a.country), ''),
             (SELECT NULLIF(TRIM(x.country), '') FROM fiaon_applications x WHERE x.person_id = a.person_id AND x.merged_into IS NULL
                AND NULLIF(TRIM(x.country), '') IS NOT NULL ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1),
             NULLIF(TRIM(p.country), '')) AS land,
           COALESCE(NULLIF(TRIM(p.first_name), ''), NULLIF(TRIM(a.first_name), '')) AS vorname,
           COALESCE(NULLIF(TRIM(p.last_name), ''), NULLIF(TRIM(a.last_name), '')) AS nachname,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.ref) AS name,
           ag.id AS betreuer_id,
           COALESCE(NULLIF(ag.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name)), '')) AS betreuer
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
      LEFT JOIN fiaon_persons kopf ON kopf.id = COALESCE(p.merged_into_person_id, p.id)
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
     WHERE ${IST_AUSKUNFT} AND a.merged_into IS NULL
       AND a.payment_status IN ('pending_payment', 'claimed_paid')
       AND a.cancelled_at IS NULL AND a.gdpr_deleted_at IS NULL
       AND ($1::text[] IS NULL OR a.ref = ANY($1::text[]))
     ORDER BY a.created_at DESC
     LIMIT ${Math.max(1, Math.min(2000, Math.floor(limit)))}`, [refs])) as any[];
  const firmaKeys: string[] = [AUSKUNFT_SCHLUESSEL.firma.einzeln, AUSKUNFT_SCHLUESSEL.firma.mitAbo];
  return zeilen.map((z) => {
    const art = firmaKeys.includes(String(z.pack_key ?? "").trim().toLowerCase()) ? "firma" as const : "privat" as const;
    const katalog = katalogpreisCents({ ref: z.ref, type: "schufa", pack_key: z.pack_key });
    const packName = String(z.pack_name ?? "").split("\n")[0].trim();
    return {
      ref: String(z.ref),
      personId: z.person_id != null ? Number(z.person_id) : null,
      name: String(z.name),
      vorname: z.vorname ? String(z.vorname) : null,
      nachname: z.nachname ? String(z.nachname) : null,
      betreuer: z.betreuer ? String(z.betreuer) : null,
      betreuerId: z.betreuer_id != null ? Number(z.betreuer_id) : null,
      land: auskunftLand(z.land),
      art,
      // Zwei Altzeilen tragen vom Zusammenführen „highend" im Paketnamen — dann der Name der Leistung.
      paket: /auskunft/i.test(packName) ? packName : art === "firma" ? "Firmen-Bonitätsauskunft inkl. Handlungsplan" : "Bonitätsauskunft inkl. Handlungsplan",
      // E-181: der Katalogpreis gilt; amount_due nur, wenn keiner bestimmbar ist.
      betragCents: katalog ?? (z.amount_due != null ? Math.round(Number(z.amount_due) * 100) : null),
      angelegt: new Date(z.angelegt),
      gemeldetAm: z.claimed_paid_at ? new Date(z.claimed_paid_at) : null,
      stufe: Number(z.stufe || 0),
      letzteAm: z.letzte_am ? new Date(z.letzte_am) : null,
      ruheBis: z.ruhe_bis ? new Date(z.ruhe_bis) : null,
      hinweis: z.hinweis ? String(z.hinweis) : null,
      aufgabeAm: z.aufgabe_am ? new Date(z.aufgabe_am) : null,
      status: String(z.payment_status),
      archiviert: !!z.archiviert,
      test: !!z.test_konto,
      paymentReference: z.payment_reference ? String(z.payment_reference) : null,
      mail: z.mail ? String(z.mail).trim() : null,
      mahnstopp: !!z.mahnstopp,
      mahnstoppPerson: !!z.mahnstopp_person,
      unzustellbar: !!z.unzustellbar,
      gekuendigt: !!z.gekuendigt,
      dokument: !!z.dokument,
      vertriebssperre: !!z.vertriebssperre,
      werbesperre: !!z.werbesperre,
      erklaert: !!z.erklaert,
      bezahltPerson: !!z.bezahlt_person,
    };
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Belehrung, Nutzlast, Verlauf
// ───────────────────────────────────────────────────────────────────────────

const JSON_NUTZLAST = `(CASE WHEN jsonb_typeof(l.payload) = 'string' THEN (l.payload #>> '{}')::jsonb ELSE l.payload END)`;

/**
 * Ist für diese Bestellung schon eine Belehrung in Textform protokolliert? Die
 * Zahlungsdaten-Mail in der Auskunft-Fassung (produktkategorie „auskunft") oder
 * eine eigene Erinnerung mit Belehrung — im Mail-Protokoll oder im Verlauf.
 */
export async function belehrungProtokolliert(ref: string, paymentReference: string | null, lauf: Lauf = sqlPool): Promise<boolean> {
  const pr = String(paymentReference ?? "");
  const [z] = (await lauf.unsafe(`
    SELECT (EXISTS (
              SELECT 1 FROM fiaon_mail_log l
               WHERE l.status = 'versandt' AND l.event IN ('payment_details', '${EREIGNIS}')
                 AND (${JSON_NUTZLAST}->>'antrag_id' = $1 OR ($2 <> '' AND ${JSON_NUTZLAST}->>'payment_reference' = $2))
                 AND ((l.event = 'payment_details' AND ${JSON_NUTZLAST}->>'produktkategorie' = 'auskunft')
                      OR (l.event = '${EREIGNIS}' AND ${JSON_NUTZLAST}->>'mit_belehrung' = 'ja')))
            OR EXISTS (
              SELECT 1 FROM fiaon_contact_log c
               WHERE c.ref = $1 AND c.type = 'system' AND (c.note LIKE 'Zahlungserinnerung%' OR c.note LIKE $4) AND c.note LIKE $3)) AS da`,
    [ref, pr, `%${VERMERK_BELEHRUNG}%`, `${VERMERK_BESTAETIGUNG}%`])) as any[];
  return !!z?.da;
}

/**
 * Wann ging für diese Bestellung zuletzt eine NACHGEHOLTE Belehrung hinaus (die Erinnerung mit Belehrung oder die
 * Vertragsbestätigung nach der Bestätigung — beide Ereignis EREIGNIS mit mit_belehrung = ja)?
 * Mail-Protokoll (mit_belehrung = ja) oder Verlauf (VERMERK_BELEHRUNG). null = nie. Für die Lieferung
 * (auskunftWiderrufStand, Gesamtdurchsicht 26.09.2026): Die Mail sagt „Frist ab Erhalt dieser E-Mail" —
 * deshalb ist ihr Versand (plus Zugang) eine Untergrenze des Fristbeginns.
 */
export async function belehrungNachgeholtAm(ref: string, lauf: Lauf = sqlPool): Promise<Date | null> {
  const [z] = (await lauf.unsafe(`
    SELECT GREATEST(
      (SELECT MAX(l.created_at) FROM fiaon_mail_log l
        WHERE l.status = 'versandt' AND l.event = '${EREIGNIS}'
          AND ${JSON_NUTZLAST}->>'antrag_id' = $1 AND ${JSON_NUTZLAST}->>'mit_belehrung' = 'ja'),
      (SELECT MAX(c.created_at) FROM fiaon_contact_log c
        WHERE c.ref = $1 AND c.type = 'system' AND (c.note LIKE 'Zahlungserinnerung%' OR c.note LIKE $3) AND c.note LIKE $2)) AS am`,
    [ref, `%${VERMERK_BELEHRUNG}%`, `${VERMERK_BESTAETIGUNG}%`])) as any[];
  return z?.am ? new Date(z.am) : null;
}

const html = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** „22.09.2026" in Berlin — nur über formatToParts (Zeit-Falle Berlin-Stunde). */
export function datumText(d: Date): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const w = (a: string) => t.find((p) => p.type === a)?.value ?? "00";
  return `${w("day")}.${w("month")}.${w("year")}`;
}

/** Die Nutzlast für die Tür. Land, Art, Auskunfteien und Widerrufs-Werte ergänzt dort auskunftMailAnreichern. */
export function erinnerungNutzlast(b: OffeneBestellung, stufe: number, mitBelehrung: boolean): Record<string, unknown> {
  return {
    email: String(b.mail ?? ""),
    vorname: b.vorname, nachname: b.nachname,
    anrede: html(anredeMail({ vorname: b.vorname, nachname: b.nachname })),
    person_id: b.personId,
    antrag_id: b.ref,
    payment_reference: b.paymentReference,
    paket: html(b.paket),
    betrag: b.betragCents != null ? (b.betragCents / 100).toFixed(2) : null,
    bestellt_am: datumText(b.angelegt),
    stufe,
    stufe_text: stufeText(stufe),
    mit_belehrung: mitBelehrung ? "ja" : "nein",
    // Die Belehrung der Erinnerung ist IMMER nachgeholt (sie kommt nur, wenn noch keine in Textform protokolliert ist):
    // Frist ab Zugang dieser Mail, nie „ab Vertragsabschluss" — die Vorlage liest das Merkmal, das Protokoll belegt es.
    ...(mitBelehrung ? { belehrung_nachgeholt: "ja" } : {}),
    zahlungsseite_url: b.paymentReference ? absoluteUrl(`/zahlung/${encodeURIComponent(b.paymentReference)}`) : null,
  };
}

/**
 * Die Nutzlast der Fassung „Frage" (Bestellung ohne Erklärung des Kunden): kein Zahlungslink, keine Belehrung,
 * der Knopf auf den Kauflink (kauf_url — signiert; das Mail-Protokoll verbirgt ihn, payloadSchwaerzen). Der
 * Betrag ist der, den der Kauflink für diese Bestellung zeigt.
 */
export function frageNutzlast(b: OffeneBestellung, stufe: number, kauf: { url: string; betragCents: number }): Record<string, unknown> {
  return {
    email: String(b.mail ?? ""),
    vorname: b.vorname, nachname: b.nachname,
    anrede: html(anredeMail({ vorname: b.vorname, nachname: b.nachname })),
    person_id: b.personId,
    antrag_id: b.ref,
    payment_reference: b.paymentReference,
    paket: html(b.paket),
    betrag: (kauf.betragCents / 100).toFixed(2),
    bestellt_am: datumText(b.angelegt),
    stufe,
    stufe_text: stufeText(stufe, "frage"),
    fassung: "frage",
    // Die erste Nachfrage überhaupt (auch beim Nachholen in der Dauerstufe) sagt nie „noch einmal".
    erste_nachfrage: b.stufe <= 0 ? "ja" : "nein",
    mit_belehrung: "nein",
    kauf_url: kauf.url,
  };
}

export type FrageKauflink = { ok: true; url: string; betragCents: number } | { ok: false; grund: string };

/**
 * Zeigt der Kauflink dieser Person GENAU diese Bestellung als Bestätigungsformular zu ihrem Betrag?
 * Dieselben Schritte wie GET /auskunft/bestellen: Kopf-Person (personAufloesen), auskunftStand, offenOhneWahl.
 * Sonst keine Frage — sie verspräche einen Betrag oder ein Formular, das der Link nicht zeigt.
 */
export async function frageKauflink(b: Pick<OffeneBestellung, "ref" | "personId" | "art">, lauf: Lauf = sqlPool): Promise<FrageKauflink> {
  if (b.personId == null) return { ok: false, grund: "ohne Person — kein Kauflink möglich" };
  const [p] = (await lauf`SELECT COALESCE(merged_into_person_id, id) AS id FROM fiaon_persons WHERE id = ${b.personId} LIMIT 1`) as any[];
  if (!p) return { ok: false, grund: "Person nicht gefunden — kein Kauflink möglich" };
  const kopf = Number(p.id);
  const { auskunftStand, offenOhneWahl } = await import("./fiaon-auskunft");
  const stand = await auskunftStand(kopf, lauf, b.art, { land: false });
  if (stand.offen?.ref !== b.ref) {
    return { ok: false, grund: `der Kauflink zeigt nicht diese Bestellung (${stand.offen ? `sondern ${stand.offen.ref}` : stand.stufe === "bezahlt" ? "Auskunft schon bezahlt" : "keine offene an der Person"})` };
  }
  if (!offenOhneWahl(stand)) {
    return { ok: false, grund: b.art === "firma"
      ? "Firmen-Auskunft: der Kauflink führt ohne Bestätigungsformular direkt zur Zahlungsseite"
      : "der Kauflink zeigt für diese Bestellung kein Bestätigungsformular (Betrag über dem heutigen Preis?)" };
  }
  const { kaufLink } = await import("../routes/fiaon-auskunft-kauf");
  return { ok: true, url: kaufLink(kopf, b.art), betragCents: stand.offen!.betragCents };
}

/** Werbesperre irgendeines Menschen hinter dieser Adresse (fiaon-mail-frequenz.ts). Bei einer Störung: gesperrt (keine Nachfrage). */
async function adresseGesperrt(mail: string | null): Promise<boolean> {
  if (!mail) return false;
  const { werbesperreAnAdresse } = await import("./fiaon-mail-frequenz");
  return werbesperreAnAdresse(mail).catch(() => true);
}

async function verlauf(b: OffeneBestellung, text: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
    VALUES (${b.ref}, ${b.personId}, NULL, 'System', 'system', ${text.slice(0, 1900)})`
    .catch((e) => console.error(`[AUSKUNFT-ERINNERUNG] ${b.ref}: Verlauf nicht geschrieben:`, e));
}

// ───────────────────────────────────────────────────────────────────────────
// Die Marke — Vergleich auf die alte Stufe, Rücknahme bei Fehlschlag
// ───────────────────────────────────────────────────────────────────────────

/**
 * Nimmt die Stufe genau dann, wenn niemand sie inzwischen genommen hat und die Bestellung noch offen ist —
 * ohne Mahnstopp (auch nicht an einer anderen Bestellung der Person) und nicht in Ruhe nach einem Fehlschlag
 * (eine zweite Instanz mit älterem Lesestand übergeht die Ruhe sonst nach einer Rücknahme).
 */
async function markeNehmen(ref: string, alteStufe: number, neueStufe: number): Promise<boolean> {
  const frei = (await sqlPool.unsafe(`
    UPDATE fiaon_applications a
       SET auskunft_erinnerung_stufe = $2, auskunft_erinnerung_am = NOW(),
           auskunft_erinnerung_ruhe_bis = NULL, auskunft_erinnerung_hinweis = NULL
     WHERE a.ref = $1 AND COALESCE(a.auskunft_erinnerung_stufe, 0) = $3
       AND a.payment_status = 'pending_payment' AND a.merged_into IS NULL AND a.cancelled_at IS NULL
       AND a.archived_at IS NULL AND a.mahnstopp_am IS NULL AND NOT ${MAHNSTOPP_PERSON_SQL("a")}
       AND (a.auskunft_erinnerung_ruhe_bis IS NULL OR a.auskunft_erinnerung_ruhe_bis <= NOW())
       AND (a.auskunft_erinnerung_am IS NULL OR a.auskunft_erinnerung_am < NOW() - INTERVAL '1 day')
     RETURNING a.ref`, [ref, neueStufe, alteStufe])) as any[];
  return frei.length > 0;
}

async function markeZurueck(ref: string, alt: { stufe: number; am: Date | null }, neueStufe: number, ruheStunden: number, hinweis: string): Promise<void> {
  await sqlPool`
    UPDATE fiaon_applications
       SET auskunft_erinnerung_stufe = ${alt.stufe}, auskunft_erinnerung_am = ${alt.am},
           auskunft_erinnerung_ruhe_bis = NOW() + make_interval(hours => ${ruheStunden}),
           auskunft_erinnerung_hinweis = ${hinweis.slice(0, 500)}
     WHERE ref = ${ref} AND auskunft_erinnerung_stufe = ${neueStufe}`
    .catch((e) => console.error(`[AUSKUNFT-ERINNERUNG] ${ref}: Marke nicht zurückgenommen:`, e));
}

/** Wie viele Erinnerungen heute (Berliner Tag) schon genommen sind — die Marke ist die Wahrheit, nicht das nebenbei geschriebene Protokoll. */
export async function heuteVersandt(lauf: Lauf = sqlPool): Promise<number> {
  await ensureErinnerungSpalten();
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_applications
     WHERE auskunft_erinnerung_am >= (date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')`) as any[];
  return Number(z?.n || 0);
}

// ───────────────────────────────────────────────────────────────────────────
// Der Lauf
// ───────────────────────────────────────────────────────────────────────────

export interface ErinnerungErgebnis {
  geprueft: number; faellig: number; versandt: number; zurueckgehalten: number; fehler: number; aufgaben: number;
  mitBelehrung: number;
  /** Davon in der Fassung „Frage" (ohne Erklärung des Kunden) verschickt. */
  fragen: number;
  grund?: string;
}

export async function erinnerungLauf(jetzt: Date = new Date(), opts: { refs?: string[] } = {}): Promise<ErinnerungErgebnis> {
  const erg: ErinnerungErgebnis = { geprueft: 0, faellig: 0, versandt: 0, zurueckgehalten: 0, fehler: 0, aufgaben: 0, mitBelehrung: 0, fragen: 0 };
  if (!istSendezeit(jetzt)) return { ...erg, grund: "außerhalb des Sendefensters (Mo–So 07:00–20:30 Berlin)" };
  const einst = await erinnerungEinstellungen();
  if (!einst.an) return { ...erg, grund: "Zahlungserinnerung ist aus (auskunft_erinnerung_an = 0)" };
  const refs = opts.refs?.length ? opts.refs : null;
  const zeilen = await offeneBestellungen(sqlPool, 500, refs);
  erg.geprueft = zeilen.length;

  // ── Mails: fällig, durch die Tür, nicht in Ruhe — neueste zuerst (die Abfrage ist so sortiert) ──
  const faellige = zeilen
    .map((b) => {
      const urteil = tuerUrteil(b);
      return { b, urteil, stufe: faelligeStufe({ bestelltAm: b.angelegt, stufe: b.stufe, letzteAm: b.letzteAm }, jetzt, einst.dauerTage, urteil.fassung) };
    })
    .filter((x) => x.urteil.erinnern && x.stufe != null && !(x.b.ruheBis && x.b.ruheBis.getTime() > jetzt.getTime()));
  erg.faellig = faellige.length;
  let rest = Math.min(JE_LAUF, Math.max(0, einst.proTag - (await heuteVersandt())));
  if (rest <= 0 && faellige.length) erg.grund = `Tagesdeckel erreicht (${einst.proTag} am Tag)`;

  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  for (const { b, stufe, urteil } of faellige) {
    if (rest <= 0) break;
    // Das Fenster endet mitten im Lauf? Gemessen an der echten Uhr — nur wenn der Lauf mit der echten Uhr gestartet ist.
    if (Math.abs(jetzt.getTime() - Date.now()) < 60_000 && !istSendezeit(new Date())) { erg.grund = "Sendefenster endete während des Laufs"; break; }
    const neu = stufe!;
    const frage = urteil.fassung === "frage";
    const text = stufeText(neu, urteil.fassung);
    if (!(await markeNehmen(b.ref, b.stufe, neu))) continue;
    rest--;
    try {
      // Gegenprüfung 26.09.2026: Die Frage respektiert auch die Werbesperre eines anderen Menschen hinter derselben Adresse.
      if (frage && (await adresseGesperrt(b.mail))) {
        await markeZurueck(b.ref, { stufe: b.stufe, am: b.letzteAm }, neu, RUHE_NACH_URTEIL_STUNDEN,
          `${text} nicht verschickt: Werbesperre an dieser E-Mail-Adresse — keine Nachfrage, stornieren?`);
        erg.zurueckgehalten++;
        rest++;
        continue;
      }
      // Die Frage nur, wenn der Kauflink GENAU diese Bestellung als Bestätigungsformular zeigt (frageKauflink).
      const kauf = frage ? await frageKauflink(b) : null;
      if (kauf && !kauf.ok) {
        await markeZurueck(b.ref, { stufe: b.stufe, am: b.letzteAm }, neu, RUHE_NACH_URTEIL_STUNDEN,
          `${text} nicht verschickt: ${kauf.grund} — bitte anrufen oder stornieren.`);
        erg.zurueckgehalten++;
        rest++;
        continue;
      }
      const mitBelehrung = frage ? false : !(await belehrungProtokolliert(b.ref, b.paymentReference));
      const nutzlast = kauf?.ok ? frageNutzlast(b, neu, kauf) : erinnerungNutzlast(b, neu, mitBelehrung);
      const v = await sendMakeWebhookMitGrund(EREIGNIS, nutzlast as MakeWebhookPayload);
      if (v.ok) {
        erg.versandt++;
        if (frage) erg.fragen++;
        if (mitBelehrung) erg.mitBelehrung++;
        if (kauf?.ok) {
          // Ohne „Zahlungserinnerung" am Anfang und ohne die Wahl-Marke: Das ist keine Belehrung und keine Erklärung.
          await verlauf(b, `Nachfrage zur Bestellung verschickt: ${text} an ${b.mail} — die Bestellung trägt keine Erklärung des Kunden `
            + `(keine Wahl, kein Beschaffungsauftrag, kein Klick auf „zahlungspflichtig“). Frage „möchten Sie sie noch?“ mit Knopf auf den Kauflink `
            + `(Bestätigungsformular, ${euroText(kauf.betragCents)}), ohne Zahlungsdaten und ohne Vertragsbestätigung.`);
        } else {
          await verlauf(b, `Zahlungserinnerung verschickt: ${text} an ${b.mail}`
            + `${mitBelehrung ? ` — ${VERMERK_BELEHRUNG} (Textform)` : ""}. Betrag ${b.betragCents != null ? euroText(b.betragCents) : "—"}, Verwendungszweck ${b.paymentReference}.`);
        }
      } else {
        // Transport (Brevo, Motor) = kurz ruhen und wieder versuchen; ein Urteil der Tür (Sperre, Adresse) = bis morgen ruhen.
        const ruhe = v.transport ? RUHE_NACH_TRANSPORTFEHLER_STUNDEN : RUHE_NACH_URTEIL_STUNDEN;
        await markeZurueck(b.ref, { stufe: b.stufe, am: b.letzteAm }, neu, ruhe, `${text} nicht verschickt: ${v.grund ?? "ohne Grund"}`);
        if (v.transport) erg.fehler++; else erg.zurueckgehalten++;
        rest++;
      }
    } catch (e) {
      erg.fehler++;
      rest++;
      await markeZurueck(b.ref, { stufe: b.stufe, am: b.letzteAm }, neu, RUHE_NACH_TRANSPORTFEHLER_STUNDEN,
        `${text} abgebrochen: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`[AUSKUNFT-ERINNERUNG] ${b.ref}: ${text} abgebrochen:`, e);
    }
  }

  // ── Ab Tag 30: einmal je Bestellung eine Aufgabe — im Takt „anrufen oder stornieren", sonst „stornieren?" an den Betreiber ──
  // Frisch gelesen, wenn eben Mails rausgingen — der Aufgabentext nennt die letzte Erinnerung.
  const fuerAufgaben = erg.versandt > 0 ? await offeneBestellungen(sqlPool, 500, refs) : zeilen;
  let aufgabenRest = AUFGABEN_JE_LAUF;
  for (const b of fuerAufgaben) {
    if (aufgabenRest <= 0) break;
    const u = tuerUrteil(b);
    if (!aufgabeFaellig(b, u, jetzt, einst.dauerTage)) continue;
    try {
      if (await aufgabeAnlegen(b, u, jetzt)) { erg.aufgaben++; aufgabenRest--; }
    } catch (e) {
      console.error(`[AUSKUNFT-ERINNERUNG] ${b.ref}: Aufgabe nicht angelegt:`, e);
    }
  }

  if (erg.versandt + erg.fehler + erg.zurueckgehalten + erg.aufgaben > 0) {
    console.log(`[AUSKUNFT-ERINNERUNG] ${erg.geprueft} offene Auskünfte, ${erg.faellig} fällig: ${erg.versandt} verschickt (${erg.mitBelehrung} mit Belehrung), ${erg.zurueckgehalten} zurückgehalten, ${erg.fehler} Fehler, ${erg.aufgaben} Aufgaben.`);
  }
  return erg;
}

// ───────────────────────────────────────────────────────────────────────────
// Außerhalb des Takts: die Frage beim Anlegen und die Vertragsbestätigung nach der Bestätigung
// (Nachbesserung 26.09.2026, Gegenprüfung der Gesamtdurchsicht)
// ───────────────────────────────────────────────────────────────────────────

export interface EinzelVersand { versandt: boolean; grund: string }

/**
 * Die Frage DIREKT beim Anlegen einer Bestellung ohne Erklärung des Kunden (auskunftBestellen, Quelle Betreuer & Co.).
 * Befund: Solche Bestellungen bekamen beim Anlegen payment_details — „Ihre Vertragsbestätigung" mit Zahlungsdaten —
 * und am Tag danach die Frage „Eine Zahlung erwarten wir erst, wenn Sie die Bestellung selbst bestätigt haben".
 * Jetzt hält auskunftBestellen die Zahlungsdaten zurück, und der Kunde bekommt sofort EINE Mail: die Frage in der
 * Fassung „frisch" mit dem Kauflink (Formular zu ihrem Betrag). Sie zählt als 1. Nachfrage (Marke Stufe 1) — danach
 * läuft der Takt der Frage (Tag 4, 10, 18, höchstens zwei Dauer-Nachfragen). Dieselbe Tür wie der Lauf (tuerUrteil,
 * Werbesperre auch an der Adresse, frageKauflink); nicht an Sendefenster, Schalter oder Tagesdeckel gebunden — sie
 * ersetzt die Zahlungsdaten-Mail, die auch sofort ging. Geht sie nicht, versucht es der Takt ab Tag 1 weiter.
 */
export async function frageSofort(ref: string): Promise<EinzelVersand> {
  await ensureErinnerungSpalten();
  const [b] = await offeneBestellungen(sqlPool, 5, [ref]);
  if (!b) return { versandt: false, grund: "keine offene Auskunft-Bestellung" };
  const u = tuerUrteil(b);
  if (u.fassung !== "frage") return { versandt: false, grund: "die Bestellung trägt schon eine Erklärung des Kunden" };
  const nein = async (grund: string): Promise<EinzelVersand> => {
    await verlauf(b, `Nachfrage beim Anlegen NICHT verschickt: ${grund}. Keine Zahlungsdaten — bitte keine Zahlungsseite schicken, solange der Kunde nicht selbst bestätigt hat.`);
    return { versandt: false, grund };
  };
  if (!u.erinnern) return nein(u.grund ? TUER_GRUND_TEXT[u.grund] : "die Tür lässt keine Mail durch");
  if (b.stufe > 0) return { versandt: false, grund: "es ging schon eine Nachfrage hinaus" };
  if (await adresseGesperrt(b.mail)) return nein("Werbesperre an dieser E-Mail-Adresse");
  if (!(await markeNehmen(b.ref, 0, 1))) return { versandt: false, grund: "die Marke ist schon vergeben" };
  const text = stufeText(1, "frage");
  try {
    const kauf = await frageKauflink(b);
    if (!kauf.ok) {
      await markeZurueck(b.ref, { stufe: 0, am: b.letzteAm }, 1, RUHE_NACH_URTEIL_STUNDEN, `${text} beim Anlegen nicht verschickt: ${kauf.grund} — bitte anrufen oder stornieren.`);
      return nein(kauf.grund);
    }
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const v = await sendMakeWebhookMitGrund(EREIGNIS, { ...frageNutzlast(b, 1, kauf), frisch: "ja" } as unknown as MakeWebhookPayload);
    if (!v.ok) {
      await markeZurueck(b.ref, { stufe: 0, am: b.letzteAm }, 1, v.transport ? RUHE_NACH_TRANSPORTFEHLER_STUNDEN : RUHE_NACH_URTEIL_STUNDEN,
        `${text} beim Anlegen nicht verschickt: ${v.grund ?? "ohne Grund"}`);
      return nein(String(v.grund ?? "ohne Grund"));
    }
    await verlauf(b, `Nachfrage zur Bestellung verschickt: ${text} beim Anlegen (statt der Zahlungsdaten) an ${b.mail} — die Bestellung trägt keine Erklärung des Kunden. `
      + `Frage „Bitte bestätigen Sie Ihre Bestellung“ mit Knopf auf den Kauflink (Bestätigungsformular, ${euroText(kauf.betragCents)}), ohne Zahlungsdaten und ohne Vertragsbestätigung.`);
    return { versandt: true, grund: "" };
  } catch (e) {
    await markeZurueck(b.ref, { stufe: 0, am: b.letzteAm }, 1, RUHE_NACH_TRANSPORTFEHLER_STUNDEN,
      `${text} beim Anlegen abgebrochen: ${e instanceof Error ? e.message : String(e)}`);
    console.error(`[AUSKUNFT-ERINNERUNG] ${b.ref}: Frage beim Anlegen abgebrochen:`, e);
    return { versandt: false, grund: e instanceof Error ? e.message : String(e) };
  }
}

const BESTAETIGUNG_WEG_TEXT = { kauflink: "über den Kauflink der E-Mail", bestellseite: "auf der Bestellseite" } as const;
/** Wohin die Vertragsbestätigung gar nicht gehen kann oder soll — sonst geht sie (Pflichtpost zu einem eben geschlossenen Vertrag). */
const BESTAETIGUNG_NIE: TuerGrund[] = ["archiviert", "test", "ohne_zweck", "ohne_mail", "unzustellbar"];

/**
 * Die Vertragsbestätigung mit Widerrufsbelehrung SOFORT nach der Bestätigung einer offenen Bestellung, die bis dahin
 * keine Erklärung des Kunden trug (Kauflink aus der Frage: AuskunftBestellung.wahlFehlt; Bestellseite: dieselbe
 * wiederverwendete Bestellung). Befund: Wiederverwendet wird ohne payment_details — die Belehrung kam erst mit der
 * nächsten fälligen Erinnerung (Tage bis Wochen), und zahlte der Kunde sofort, nie (die Zahlungseingangs-Mail hat
 * keinen Anhang). Einmal je Bestellung (Spalte auskunft_bestaetigung_am, Vergleich auf NULL), nur Verbraucher
 * (Firmen haben kein Widerrufsrecht), nur mit Erklärung. Protokoll: Mail-Protokoll (Ereignis EREIGNIS, fassung
 * „bestaetigung", mit_belehrung „ja") und Verlauf (VERMERK_BESTAETIGUNG … VERMERK_BELEHRUNG) — belehrungProtokolliert
 * und belehrungNachgeholtAm lesen beide, die folgenden Erinnerungen tragen die Belehrung also nicht noch einmal, und die
 * Lieferung rechnet die Frist ab dieser Mail + 1 Tag. Die Marke auskunft_erinnerung_am wird gesetzt (Mindestabstand
 * zur nächsten Erinnerung), die Stufe nicht.
 */
export async function bestaetigungNachErklaerung(ref: string, weg: keyof typeof BESTAETIGUNG_WEG_TEXT, jetzt: Date = new Date()): Promise<EinzelVersand> {
  await ensureErinnerungSpalten();
  const [b] = await offeneBestellungen(sqlPool, 5, [ref]);
  if (!b || b.status !== "pending_payment") return { versandt: false, grund: "keine offene Auskunft-Bestellung" };
  if (b.art !== "privat") return { versandt: false, grund: "Firmen-Auskunft — kein Widerrufsrecht" };
  if (!b.erklaert) return { versandt: false, grund: "die Bestellung trägt noch keine Erklärung des Kunden" };
  const u = tuerUrteil(b);
  if (u.grund && BESTAETIGUNG_NIE.includes(u.grund)) {
    await verlauf(b, `Vertragsbestätigung nach der Bestätigung NICHT verschickt: ${TUER_GRUND_TEXT[u.grund]}.`);
    return { versandt: false, grund: TUER_GRUND_TEXT[u.grund] };
  }
  const frei = (await sqlPool`
    UPDATE fiaon_applications SET auskunft_bestaetigung_am = NOW()
     WHERE ref = ${ref} AND auskunft_bestaetigung_am IS NULL AND payment_status = 'pending_payment' RETURNING ref`) as any[];
  if (!frei.length) return { versandt: false, grund: "schon verschickt" };
  const zurueck = async (grund: string): Promise<EinzelVersand> => {
    await sqlPool`UPDATE fiaon_applications SET auskunft_bestaetigung_am = NULL,
                    auskunft_erinnerung_hinweis = ${`Vertragsbestätigung nach der Bestätigung nicht verschickt: ${grund}`.slice(0, 500)}
                   WHERE ref = ${ref}`.catch(() => {});
    await verlauf(b, `Vertragsbestätigung nach der Bestätigung NICHT verschickt: ${grund} — die nächste Zahlungserinnerung trägt Vertragsbestätigung und Belehrung.`);
    return { versandt: false, grund };
  };
  try {
    const nutzlast: Record<string, unknown> = { ...erinnerungNutzlast(b, b.stufe, true), fassung: "bestaetigung", bestaetigt_am: datumText(jetzt) };
    const { sendMakeWebhookMitGrund } = await import("../make-webhook");
    const v = await sendMakeWebhookMitGrund(EREIGNIS, nutzlast as MakeWebhookPayload);
    if (!v.ok) return zurueck(String(v.grund ?? "ohne Grund"));
    await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_am = NOW(), auskunft_erinnerung_ruhe_bis = NULL, auskunft_erinnerung_hinweis = NULL
                   WHERE ref = ${ref}`;
    await verlauf(b, `${VERMERK_BESTAETIGUNG} (${BESTAETIGUNG_WEG_TEXT[weg]}) an ${b.mail} — ${VERMERK_BELEHRUNG} (Textform, Frist ab Zugang dieser Mail) und Zahlungsdaten. `
      + `Betrag ${b.betragCents != null ? euroText(b.betragCents) : "—"}, Verwendungszweck ${b.paymentReference}.`);
    return { versandt: true, grund: "" };
  } catch (e) {
    console.error(`[AUSKUNFT-ERINNERUNG] ${ref}: Vertragsbestätigung nach der Bestätigung abgebrochen:`, e);
    return zurueck(e instanceof Error ? e.message : String(e));
  }
}

/**
 * Ist die EINE Aufgabe zu dieser Bestellung jetzt fällig? Rein (Prüfstand). Gesamtdurchsicht 26.09.2026:
 *   · „stornieren?" (Storno-Vorschlag, ohne Anruf): ab Tag AUFGABE_AB_TAGEN — eine Mail geht dort ohnehin nie.
 *   · „anrufen oder stornieren" (im Takt): ab Tag AUFGABE_AB_TAGEN, und erst wenn mindestens eine Mail raus
 *     ist und seitdem AUFGABE_NACH_MAIL_TAGE vergangen sind (sonst rief der Betreuer an, bevor der Kunde die
 *     erste Mail überhaupt lesen konnte). Die Frage zusätzlich erst nach dem Ende ihres Takts.
 * Gemeldete ordnet die Zahlungsstelle zu, Mahnstopp ist eine Entscheidung, Unzustellbare haben ihre eigene
 * Aufgabe (unzustellbareErstzahlungenMelden) — keine Aufgabe.
 */
export function aufgabeFaellig(b: Pick<OffeneBestellung, "aufgabeAm" | "angelegt" | "stufe" | "letzteAm"> & { hinweis?: string | null }, u: TuerUrteil, jetzt: Date, dauerTage: number): boolean {
  if (b.aufgabeAm || berlinTageSeit(b.angelegt, jetzt) < AUFGABE_AB_TAGEN) return false;
  if (u.stornieren) return true;
  if (!u.erinnern) return false;
  // Gegenprüfung 26.09.2026: Eine Frage, die nie hinausging (zurückgehalten — Kauflink zeigt eine andere Bestellung,
  // Firma, ohne Person, Werbesperre an der Adresse), wartete sonst ewig. Ab Tag 30 dann einmal die Aufgabe.
  if (frageZurueckgehalten(b, u)) return true;
  if (b.stufe <= 0 || !b.letzteAm || berlinTageSeit(b.letzteAm, jetzt) < AUFGABE_NACH_MAIL_TAGE) return false;
  if (u.fassung === "frage") {
    // „dann Schluss + einmal Aufgabe": erst, wenn keine Nachfrage mehr kommt.
    return naechsteFaelligkeit({ bestelltAm: b.angelegt, stufe: b.stufe, letzteAm: b.letzteAm }, jetzt, dauerTage, 120, "frage") == null;
  }
  return true;
}

/** Rein: eine Frage im Takt, die noch nie hinausging, weil der Lauf sie zurückhält (Hinweis an der Zeile). */
export function frageZurueckgehalten(b: Pick<OffeneBestellung, "stufe"> & { hinweis?: string | null }, u: TuerUrteil): boolean {
  return u.erinnern && u.fassung === "frage" && b.stufe <= 0 && !!String(b.hinweis ?? "").trim();
}

/** Titel und Empfänger der Aufgabe — rein (Prüfstand). Storno-Vorschlag: kein Anruf, nur der Betreiber. */
export function aufgabeKopf(b: Pick<OffeneBestellung, "name" | "betreuerId">, u: TuerUrteil): { titel: string; anBetreiber: boolean; agentId: number | null; mitAnruf: boolean } {
  if (u.stornieren) {
    const grund = (u.grund && STORNO_KURZ[u.grund]) || "passt nicht mehr";
    const was = u.grund === "werbesperre_frage" ? "Auskunft ohne Bestätigung des Kunden" : `Auskunft seit ${AUFGABE_AB_TAGEN} Tagen offen`;
    return { titel: `${was} — stornieren? (${grund}, ${b.name})`.slice(0, 160), anBetreiber: true, agentId: null, mitAnruf: false };
  }
  return {
    titel: (u.fassung === "frage"
      ? `Auskunft ohne Bestätigung des Kunden — anrufen oder stornieren (${b.name})`
      : `Auskunft seit ${AUFGABE_AB_TAGEN} Tagen offen — anrufen oder stornieren (${b.name})`).slice(0, 160),
    // An den Betreuer; ohne Betreuer an den Betreiber (nicht an den erstbesten Vertriebsleiter).
    anBetreiber: !b.betreuerId, agentId: b.betreuerId, mitAnruf: true,
  };
}

/** Die Aufgabe ab Tag 30 — die Marke zuerst (auftragFuerKunden öffnet eine erledigte Aufgabe mit demselben Schlüssel wieder). */
async function aufgabeAnlegen(b: OffeneBestellung, u: TuerUrteil, jetzt: Date): Promise<boolean> {
  const frei = (await sqlPool`
    UPDATE fiaon_applications SET auskunft_erinnerung_aufgabe_am = NOW()
     WHERE ref = ${b.ref} AND auskunft_erinnerung_aufgabe_am IS NULL RETURNING ref`) as any[];
  if (!frei.length) return false;
  const schluessel = `auskunft:${b.ref}:offen-30`;
  const [schon] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_betreiber_todos WHERE schluessel = ${schluessel} LIMIT 1`.catch(() => [])) as any[];
  if (schon) return false;
  const tage = berlinTageSeit(b.angelegt, jetzt);
  const zahlungsseite = b.paymentReference ? absoluteUrl(`/zahlung/${encodeURIComponent(b.paymentReference)}`) : "—";
  const kopf = aufgabeKopf(b, u);
  let empfaenger = "den Betreiber";
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    const frage = u.fassung === "frage";
    const anlage = await auftragFuerKunden({
      personId: b.personId, ref: b.ref,
      titel: kopf.titel,
      text: [
        frage
          ? `Für ${b.name} ist seit dem ${datumText(b.angelegt)} ${b.paket} (${b.betragCents != null ? euroText(b.betragCents) : "—"}) als Bestellung angelegt — aber OHNE Erklärung des Kunden: kein Klick auf „zahlungspflichtig“, keine Wahl zum Beginn, kein Beschaffungsauftrag.`
          : `${b.name} hat am ${datumText(b.angelegt)} ${b.paket} für ${b.betragCents != null ? euroText(b.betragCents) : "—"} bestellt — seit ${tage} Tagen ist keine Zahlung gebucht.`,
        b.stufe > 0 && b.letzteAm
          ? frage
            ? `Per Mail gefragt, ob er sie noch möchte: zuletzt ${stufeText(b.stufe, "frage")} am ${datumText(b.letzteAm)}. Es kommt keine weitere Nachfrage.`
            : `Per Mail erinnert: zuletzt ${stufeText(b.stufe)} am ${datumText(b.letzteAm)}. Die Erinnerungen laufen weiter, ruhig im Wochentakt.`
          : u.grund ? `Keine Mail: ${TUER_GRUND_TEXT[u.grund]}.`
          : b.hinweis ? `Keine Mail — die Nachfrage wird zurückgehalten: ${b.hinweis}` : "Noch keine Mail.",
        kopf.mitAnruf
          ? frage
            ? frageZurueckgehalten(b, u)
              ? "Bitte anrufen und fragen: Möchte der Kunde die Auskunft noch? Eine Nachfrage per Mail war nicht möglich (siehe oben). Will er sie nicht (mehr), bitte stornieren lassen. Bitte KEINE Zahlungsseite schicken, solange er die Bestellung nicht selbst bestätigt hat."
              : "Bitte anrufen und fragen: Möchte der Kunde die Auskunft noch? Wenn ja: Er bestätigt sie selbst über den Knopf „Bestellung ansehen und bestätigen“ in unserer Mail — erst danach ist sie zu bezahlen. Bitte KEINE Zahlungsseite schicken, solange er nicht bestätigt hat."
            : "Bitte anrufen und klären: Kommt die Zahlung, gibt es Fragen, oder möchte der Kunde die Auskunft nicht mehr?"
          // Kein Anruf: Bei Vertriebssperre widerspräche er der Sperre, bei Gekündigten und mit Dokument ist die Bestellung wohl überholt.
          : "Diese Bestellung passt wohl nicht mehr (siehe oben) — bitte NICHT anrufen, sondern prüfen und im Zweifel stornieren.",
        frage ? null : `Zahlungsseite für den Kunden: ${zahlungsseite} (Verwendungszweck ${b.paymentReference ?? "—"}).`,
        kopf.mitAnruf
          ? "Will der Kunde nicht mehr: der Leitung Bescheid geben — sie storniert im Mara-Steuerpult, Reiter „Bonitätsauskunft“, Tabelle „Bestellt, nicht bezahlt“ (Knopf „Stornieren“). Es entstehen keine Kosten."
          : "Stornieren: Mara-Steuerpult, Reiter „Bonitätsauskunft“, Tabelle „Bestellt, nicht bezahlt“, Knopf „Stornieren“. Es entstehen keine Kosten; der Kunde bekommt dazu keine automatische Mail.",
      ].filter(Boolean).join("\n"),
      dringend: false, schluessel, bereich: "konten", quelle: "auskunft", autorName: "Zahlungserinnerung Auskunft",
      agentId: kopf.agentId, anBetreiber: kopf.anBetreiber,
      anlageText: frage ? "Die Bonitätsauskunft ist angelegt, der Kunde hat sie nicht bestätigt." : `Die Bonitätsauskunft ist seit ${AUFGABE_AB_TAGEN} Tagen bestellt und nicht bezahlt.`,
    });
    if (!anlage.id) throw new Error("Aufgabe wurde nicht angelegt");
    // Wer sie WIRKLICH bekam: auftragFuerKunden weicht bei einem inaktiven Betreuer oder Testkonto aus.
    empfaenger = anlage.anBetreiber || !anlage.agentName ? "den Betreiber" : String(anlage.agentName);
  } catch (e) {
    await sqlPool`UPDATE fiaon_applications SET auskunft_erinnerung_aufgabe_am = NULL WHERE ref = ${b.ref}`.catch(() => {});
    throw e;
  }
  await verlauf(b, `Zahlungserinnerung: ${u.fassung === "frage" && kopf.mitAnruf ? (frageZurueckgehalten(b, u) ? "Nachfrage per Mail nicht möglich" : "Nachfragen ohne Antwort") : `seit ${AUFGABE_AB_TAGEN} Tagen offen`} — Aufgabe „${kopf.mitAnruf ? "anrufen oder stornieren" : "stornieren?"}“ an ${empfaenger}.`);
  return true;
}

// ───────────────────────────────────────────────────────────────────────────
// Für die Chefseite (fiaon-chef-auskunft.ts)
// ───────────────────────────────────────────────────────────────────────────

export interface ErinnerungZeile {
  ref: string;
  /** Stufe der letzten Mail (0 = noch keine) und ihr Text. */
  stufe: number;
  stufeText: string;
  letzteAm: string | null;
  /** YYYY-MM-DD — der nächste Berliner Tag mit fälliger Stufe; null = keine mehr oder keine Mail. */
  naechste: string | null;
  /** Warum keine Mail geht — null, wenn sie im Takt ist. */
  grund: string | null;
  grundArt: TuerGrund | null;
  stornieren: boolean;
  /** Letzter Fehlversuch (Ruhe), z. B. „2. Erinnerung nicht verschickt: …". */
  hinweis: string | null;
  aufgabeAm: string | null;
  mahnstopp: boolean;
  /** Alter in Berliner Kalendertagen — dieselbe Zählung wie die Stufen. */
  tage: number;
  /** Gesamtdurchsicht 26.09.2026: „frage" = ohne Erklärung des Kunden (Chefseite: „bestätigen lassen"). */
  fassung: Fassung;
}

export interface ErinnerungUebersicht {
  einstellungen: ErinnerungEinstellungen;
  heuteVersandt: number;
  /** Heute fällig (unabhängig vom Sendefenster) — geht heute raus, solange Deckel und Fenster reichen. */
  heuteFaellig: number;
  imTakt: number;
  /** Gesamtdurchsicht 26.09.2026: offene Bestellungen ohne Erklärung des Kunden (Fassung „Frage", ohne Archivierte/Tests). */
  ohneErklaerung: number;
  zeilen: Map<string, ErinnerungZeile>;
  bestellungen: OffeneBestellung[];
}

export async function erinnerungUebersicht(jetzt: Date = new Date()): Promise<ErinnerungUebersicht> {
  const [einst, bestellungen, versandt] = await Promise.all([erinnerungEinstellungen(), offeneBestellungen(), heuteVersandt()]);
  const zeilen = new Map<string, ErinnerungZeile>();
  let heuteFaellig = 0, imTakt = 0, ohneErklaerung = 0;
  for (const b of bestellungen) {
    const u = tuerUrteil(b);
    const stand = { bestelltAm: b.angelegt, stufe: b.stufe, letzteAm: b.letzteAm };
    const faellig = u.erinnern ? faelligeStufe(stand, jetzt, einst.dauerTage, u.fassung) : null;
    if (u.erinnern) imTakt++;
    if (u.fassung === "frage" && u.zeigen && b.status === "pending_payment") ohneErklaerung++;
    if (faellig != null && !(b.ruheBis && b.ruheBis.getTime() > jetzt.getTime())) heuteFaellig++;
    const naechste = u.erinnern && einst.an ? naechsteFaelligkeit(stand, jetzt, einst.dauerTage, 120, u.fassung) : null;
    zeilen.set(b.ref, {
      ref: b.ref, stufe: b.stufe, stufeText: stufeText(b.stufe, u.fassung), letzteAm: b.letzteAm ? b.letzteAm.toISOString() : null,
      naechste,
      grund: u.grund ? TUER_GRUND_TEXT[u.grund] : !einst.an ? "Zahlungserinnerung ist aus"
        // Die Frage ist durch (Tag 18 + höchstens zwei Dauer-Nachfragen) — dann bleibt die Aufgabe.
        : u.fassung === "frage" && !naechste && b.stufe > 0 ? "Nachfragen beendet — anrufen oder stornieren" : null,
      grundArt: u.grund, stornieren: u.stornieren, hinweis: b.hinweis,
      aufgabeAm: b.aufgabeAm ? b.aufgabeAm.toISOString() : null, mahnstopp: b.mahnstopp,
      tage: berlinTageSeit(b.angelegt, jetzt),
      fassung: u.fassung,
    });
  }
  return { einstellungen: einst, heuteVersandt: versandt, heuteFaellig: einst.an ? heuteFaellig : 0, imTakt, ohneErklaerung, zeilen, bestellungen };
}
