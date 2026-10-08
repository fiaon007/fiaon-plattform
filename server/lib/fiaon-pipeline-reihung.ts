// ═══════════════════════════════════════════════════════════════════════════
// DIE LESESEITE DER WIEDERVORLAGE — SQL-BAUSTEINE (E-IT-A, 08.10.2026)
//
// Die Regel „wann wieder?" steht in shared/fiaon-wiedervorlage.ts (Schreib-
// seite). Hier steht, wie die Arbeitsliste daraus eine REIHENFOLGE macht und
// welche Menschen sie gar nicht erst zeigt. Nur SQL-Text, keine Datenbank-
// verbindung: Die Arbeitsliste (fiaon-office-vertrieb.ts), die Einstufung
// (tier.ts) und der Prüfstand lesen dieselben Bausteine.
//
// ── DER BEFUND (Produktion, nur lesend, 07.10.2026) ────────────────────────
// „Wieder dran" war statisch gereiht — nach dem Datum des jüngsten Ereignisses
// (meist dem Antrag). Wann wir einen Menschen zuletzt versucht hatten, kam in
// der Reihung nicht vor. Ein bearbeiteter Kunde kehrte nach 1–3 Tagen auf
// seinen alten Platz zurück; wer hinten stand, kam nie dran (Plätze 201+ ohne
// jeden Kontakt seit 30 Tagen: Daniel 224 von 323, Florentine 174 von 220,
// Nikita 152 von 304). Abgelaufene Zahlungszusagen hielten Rang 2 auf Dauer
// (77 Menschen, die älteste vom 16.07., bei 56 gab es seither einen Kontakt).
//
// ── DIE REGEL (Justin, 08.10.2026) ────────────────────────────────────────
// Rotation nach dem letzten Kontaktversuch: innerhalb gleicher Dringlichkeit
// steht vorn, wer am längsten nicht versucht wurde. Eine abgelaufene Zusage
// ist EINMAL dringend („Zahlung prüfen"), bis zum nächsten Versuch — kein
// Dauer-Spitzenplatz. Wer in den letzten 20 Stunden versucht wurde, steht
// nicht noch einmal rechts (außer Termin heute oder offener Rückruf).
// ═══════════════════════════════════════════════════════════════════════════
import { FRISCH_TAGE, TAGESPAUSE_STUNDEN } from "@shared/fiaon-wiedervorlage";

/** Heute in Berlin (der Server läuft auf UTC). */
export const HEUTE_SQL = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;

// ── VERSCHOBEN AUS server/routes/fiaon-office-vertrieb.ts (E-IT-A) ────────
// Die Einstufung (tier.ts) braucht „Rate fällig" und „letzter Kontakt", um
// Ratenkunden ihre Wiedervorlage nicht mehr alle 20 Minuten zu löschen. tier.ts
// darf aber keine Routendatei laden (die Routen laden tier.ts — ein Kreis).
// Deshalb wohnen die Bausteine jetzt hier; fiaon-office-vertrieb.ts reicht
// RATE_FAELLIG_SQL und EREIGNIS_SQL unverändert weiter (die Telefonkartei
// liest sie dort, E-201).

/**
 * FÄLLIGE RATE (E-165): eine offene, nicht stornierte Rate, deren Fälligkeit
 * erreicht ist — der Grund, aus dem ein bezahlter Kunde (Stufe 0) wieder in
 * die Liste seines Betreuers gehört. Setzt den Alias p (fiaon_persons) voraus.
 */
export const RATE_FAELLIG_SQL = `EXISTS (
  SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
   WHERE ar.person_id = p.id AND ar.merged_into IS NULL
     AND r.status = 'offen' AND r.storniert_am IS NULL AND r.faellig_am <= ${HEUTE_SQL})`;
/** Die jüngste erreichte Fälligkeit — sie ist für diesen Menschen das Ereignis. */
export const RATE_FAELLIG_AM_SQL = `(
  SELECT MAX(r2.faellig_am)::timestamptz FROM fiaon_abo_raten r2 JOIN fiaon_applications ar2 ON ar2.ref = r2.ref
   WHERE ar2.person_id = p.id AND ar2.merged_into IS NULL
     AND r2.status = 'offen' AND r2.storniert_am IS NULL AND r2.faellig_am <= ${HEUTE_SQL})`;
/**
 * Das jüngste Ereignis: Antrag gestellt, Zahlung gemeldet oder eine Rate
 * fällig geworden (sonst Anlage der Person). E-165: Eine frisch fällige Rate
 * wird zu 18,6 % bezahlt, eine in Mahnstufe 5 zu 3,4 %.
 */
export const EREIGNIS_SQL = `GREATEST(
  COALESCE((SELECT MAX(a4.created_at) FROM fiaon_applications a4 WHERE a4.person_id = p.id AND a4.merged_into IS NULL), p.created_at),
  COALESCE((SELECT MAX(a5.claimed_paid_at) FROM fiaon_applications a5 WHERE a5.person_id = p.id AND a5.merged_into IS NULL
              AND a5.payment_status = 'claimed_paid'), p.created_at),
  COALESCE(${RATE_FAELLIG_AM_SQL}, p.created_at),
  p.created_at)`;
// ── DER TAGESBERICHT-NACHTRAG IST EIN KONTAKT — ABER KEIN SYSTEM-ERGEBNIS ──
// (Gegenprüfung 08.10.2026) Gespräche übers eigene Telefon, im Tagesbericht
// nachgetragen (E-216), bleiben Systemzeilen OHNE outcome: Leistung, Team,
// Chefbüro, aufzeichnungFuer und „heute erledigt" zählen nur type 'result',
// und E-216 legt fest, dass Systemzahl und Selbstangabe NIE addiert werden.
// Für die PIPELINE ist der Nachtrag trotzdem ein Kontakt (nicht mehr „nie
// angerufen", Rotation, Tagespause) — erkannt an der festen Marke am Anfang
// der Notiz, mit dem Zeitpunkt des Berichtstags (fiaon-tagesbericht.ts).
/** Anfang jeder Nachtrags-Notiz (fiaon-tagesbericht.ts schreibt, hier wird gelesen). */
export const TAGESBERICHT_NACHTRAG_MARKE = "Tagesbericht-Nachtrag";
/** Eine Kontaktzeile im Verlauf (Alias a): Gesprächsergebnis ODER Tagesbericht-Nachtrag. */
export function kontaktZeileSql(a: string): string {
  return `(${a}.type = 'result' OR (${a}.type = 'system' AND ${a}.note LIKE '${TAGESBERICHT_NACHTRAG_MARKE}%'))`;
}
/**
 * Das jüngste Gesprächsergebnis (E-212). Zwei Unterabfragen, je über ihren
 * Index (person_id bzw. ref) — ein ODER über zwei Spalten hat die Pipeline am
 * 08.09. schon einmal zum Stehen gebracht. Ohne Ergebnis: 'epoch'.
 * Gegenprüfung 08.10.2026: zählt den Tagesbericht-Nachtrag mit (kontaktZeileSql).
 */
export const LETZTER_KONTAKT_SQL = `GREATEST(
  COALESCE((SELECT MAX(ck.created_at) FROM fiaon_contact_log ck
              WHERE ck.person_id = p.id AND ${kontaktZeileSql("ck")} AND ck.voided_at IS NULL), 'epoch'::timestamptz),
  COALESCE((SELECT MAX(cm.created_at) FROM fiaon_contact_log cm JOIN fiaon_applications am ON am.ref = cm.ref
              WHERE am.person_id = p.id AND ${kontaktZeileSql("cm")} AND cm.voided_at IS NULL), 'epoch'::timestamptz))`;

// ── DER LETZTE VERSUCH ────────────────────────────────────────────────────
/**
 * Ein Wählvorgang übers Softphone ist ein Versuch, auch ohne Ergebnis — aber
 * nur, wenn er wirklich rausging. NICHT: 'fehlgeschlagen' (technische Störung,
 * 27 in 30 Tagen) und 'gewaehlt' (Wählzeile, zu der Twilio sich nie meldete,
 * 25 in 30 Tagen). Sonst versteckte eine Störung den Kunden.
 */
export const ANRUF_VERSUCH_STATUS = ["beendet", "niemand_erreicht", "besetzt", "laeuft"] as const;
const STATUS_LISTE = ANRUF_VERSUCH_STATUS.map((s) => `'${s}'`).join(", ");
/** Der letzte echte Wählvorgang an diesen Menschen (Index fiaon_calls_person_idx). */
export const LETZTER_ANRUF_SQL = `COALESCE((SELECT MAX(cv.beginn) FROM fiaon_calls cv
   WHERE cv.person_id = p.id AND cv.richtung = 'raus' AND cv.status IN (${STATUS_LISTE})), 'epoch'::timestamptz)`;

/** Wann haben wir diesen Menschen zuletzt versucht? Ergebnis, Tagesbericht-Nachtrag ODER Anruf; nie = 'epoch'. */
export const LETZTER_VERSUCH_SQL = `GREATEST(${LETZTER_KONTAKT_SQL}, ${LETZTER_ANRUF_SQL})`;

/**
 * Das jüngste Gesprächsergebnis selbst (outcome) — für den Grund auf der Karte.
 * Ist der jüngste Versuch ein Tagesbericht-Nachtrag (ohne outcome), kommt NULL
 * zurück — der Grund heißt dann neutral „Wiedervorlage" statt eines älteren,
 * nicht mehr zutreffenden Grundes.
 */
export const LETZTES_ERGEBNIS_SQL = `(SELECT x.outcome FROM (
    (SELECT cl1.outcome, cl1.created_at FROM fiaon_contact_log cl1
      WHERE cl1.person_id = p.id AND ${kontaktZeileSql("cl1")} AND cl1.voided_at IS NULL
      ORDER BY cl1.created_at DESC LIMIT 1)
    UNION ALL
    (SELECT cl2.outcome, cl2.created_at FROM fiaon_contact_log cl2 JOIN fiaon_applications a12 ON a12.ref = cl2.ref
      WHERE a12.person_id = p.id AND ${kontaktZeileSql("cl2")} AND cl2.voided_at IS NULL
      ORDER BY cl2.created_at DESC LIMIT 1)
  ) x ORDER BY x.created_at DESC LIMIT 1)`;

// ── DIE DRINGLICHKEIT ─────────────────────────────────────────────────────
// Alle Bausteine nehmen den letzten Versuch als Ausdruck entgegen: Die
// Arbeitsliste rechnet ihn EINMAL je Zeile (LATERAL, Spalte v.lv) und reicht
// v.lv herein, statt dieselben drei Unterabfragen fünfmal zu rechnen.

/**
 * Eine Zahlungszusage, deren Tag erreicht ist und nach der wir es noch NICHT
 * versucht haben: einmal dringend („Zahlung prüfen" bzw. „Zusage prüfen").
 * Nach dem nächsten Versuch ist sie ein gewöhnlicher Fall — kein Dauerplatz.
 * Die Zusage selbst bleibt stehen (die Akte zeigt „Zusage gebrochen").
 */
export function zusageOffenSql(lv: string = LETZTER_VERSUCH_SQL): string {
  return `(p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE_SQL}
    AND ((${lv}) AT TIME ZONE 'Europe/Berlin')::date <= p.promised_payment_date)`;
}
/** Ein vereinbarter Rückruf, dessen Zeit erreicht ist und nach dessen Zeit niemand mehr versucht hat. */
export function rueckrufOffenSql(lv: string = LETZTER_VERSUCH_SQL): string {
  return `EXISTS (
  SELECT 1 FROM fiaon_contact_log cro JOIN fiaon_applications aro ON aro.ref = cro.ref
  WHERE aro.person_id = p.id AND cro.outcome = 'rueckruf_termin' AND cro.done_at IS NULL
    AND cro.voided_at IS NULL AND cro.scheduled_at IS NOT NULL AND cro.scheduled_at <= NOW()
    AND (${lv}) < cro.scheduled_at)`;
}
/**
 * Heute schon versucht: in den letzten TAGESPAUSE_STUNDEN ein Ergebnis oder
 * ein echter Anruf — und die Wiedervorlage ist nicht ausdrücklich HEUTE.
 * (Eine Wiedervorlage auf heute setzt nur, wer den Menschen heute sehen will:
 * die Übergabe nach „blockiert", ein Rückruf heute, „Heute wieder dran".)
 */
export function tagespauseSql(lv: string = LETZTER_VERSUCH_SQL): string {
  return `((${lv}) > NOW() - INTERVAL '${TAGESPAUSE_STUNDEN} hours'
    AND (p.follow_up_date IS NULL OR p.follow_up_date < ${HEUTE_SQL}))`;
}
/** Frisch: Stufe A/B oder Rate, jüngstes Ereignis höchstens FRISCH_TAGE alt. */
export function frischBandSql(ereignis: string = EREIGNIS_SQL): string {
  return `(COALESCE(p.priority_tier, 3) IN (0, 1, 2) AND (${ereignis}) > NOW() - INTERVAL '${FRISCH_TAGE} days')`;
}

// ── GERADE BEARBEITET (Gegenprüfung 08.10.2026) ───────────────────────────
// BEFUND: Ein frischer Kunde (Antrag vor 2 Tagen), gestern 17 Uhr „nicht
// erreicht", bekam die Wiedervorlage „nächster Werktag" = heute. Heute früh hob
// die Wiedervorlage auf heute die Tagespause auf, und das Frische-Band stellte
// ihn VOR alle anderen — der gestern Bearbeitete stand heute wieder oben.
// Justin (08.10.2026): „gerade bearbeitet → nie am nächsten Tag wieder vorn".
// REGEL: Gerade bearbeitet ist, wer am VORIGEN WERKTAG oder heute versucht
// wurde (Ergebnis oder echter Anruf, lv). Montags ist das der Freitag, am
// Wochenende ebenfalls. Er steht nie im Frische-Band und innerhalb seines
// Bandes hinter allen, die nicht gerade bearbeitet wurden (wiederOrdnung).
/** Beginn (00:00 Berlin) des letzten Werktags VOR heute: Mo → Fr, So → Fr, Sa → Fr, sonst gestern. */
export const VORIGER_WERKTAG_BEGINN_SQL = `((${HEUTE_SQL} - CASE EXTRACT(ISODOW FROM ${HEUTE_SQL})::int
    WHEN 1 THEN 3 WHEN 7 THEN 2 ELSE 1 END)::timestamp AT TIME ZONE 'Europe/Berlin')`;
/** Am vorigen Werktag oder heute versucht. lv = letzter Versuch (Ausdruck), 'epoch' = nie. */
export function geradeBearbeitetSql(lv: string = LETZTER_VERSUCH_SQL): string {
  return `((${lv}) >= ${VORIGER_WERKTAG_BEGINN_SQL})`;
}
/** Das Frische-Band der rechten Spalte: frisch UND nicht gerade bearbeitet. */
export function frischUnbearbeitetSql(ereignis: string, lv: string): string {
  return `(${frischBandSql(ereignis)} AND NOT ${geradeBearbeitetSql(lv)})`;
}

// ── STUFE 0 BEHÄLT IHRE RATEN-ARBEIT (U5) ─────────────────────────────────
/**
 * Die letzte Zahlung dieses Menschen: Bestellung bezahlt (paid_at) oder eine
 * Rate bezahlt (bezahlt_am). Ohne Zahlung: 'epoch'.
 */
export const LETZTE_ZAHLUNG_SQL = `GREATEST(
  COALESCE((SELECT MAX(az.paid_at) FROM fiaon_applications az WHERE az.person_id = p.id AND az.merged_into IS NULL), 'epoch'::timestamptz),
  COALESCE((SELECT MAX(rz.bezahlt_am) FROM fiaon_abo_raten rz JOIN fiaon_applications arz ON arz.ref = rz.ref
              WHERE arz.person_id = p.id AND arz.merged_into IS NULL), 'epoch'::timestamptz))`;
/**
 * Darf ein Mensch auf Stufe 0 Wiedervorlage und Zusage BEHALTEN?
 *
 * ── DER BEFUND ────────────────────────────────────────────────────────────
 * alleTierAktualisieren lief alle 20 Minuten und löschte promised_payment_date
 * und follow_up_date bei JEDER Person mit Stufe ≤ 0 — auch bei den Ratenkunden,
 * die seit E-165 in der Pipeline stehen. Gemessen: 118 von 118 Ratenkunden mit
 * Ergebnis in 21 Tagen ohne Wiedervorlage und Zusage. „Nicht erreicht" war
 * nach höchstens 20 Minuten NOCH AM SELBEN TAG wieder fällig (7,6 % der
 * Fehlversuch-Sitzungen bei Stufe 0 bekamen einen zweiten Versuch am Tag).
 *
 * ── DIE REGEL (Fassung nach der Gegenprüfung 08.10.2026) ──────────────────
 * Behalten nur, wenn eine Rate fällig ist UND der Wert zur Raten-Arbeit
 * gehört — also NACH der letzten Zahlung entstand. Je Feld getrennt:
 *   · Zusage: liegt NACH dem Tag der letzten Zahlung, ODER das letzte
 *     Gesprächsergebnis liegt nach der letzten Zahlung.
 *   · Wiedervorlage: liegt NACH dem Tag der letzten Zahlung, ODER das letzte
 *     Gesprächsergebnis liegt nach der letzten Zahlung.
 * VORHER hing beides allein am Gesprächsergebnis (type 'result'). Mara
 * (zahlungszusage_merken) und der WhatsApp-Raum schreiben aber nur einen
 * Systemvermerk — „ich zahle am 20." eines Ratenkunden löschte der Takt nach
 * höchstens 20 Minuten wieder, und Maras Versprechen „bis dahin keine
 * Erinnerung" fiel weg. Das Datum selbst trägt die Antwort: Eine Zusage für
 * einen Tag nach der letzten Zahlung kann nicht die alte Verkaufs-Zusage sein.
 * Wer gerade zum ersten Mal bezahlt hat, verliert die alte Verkaufs-Zusage
 * weiterhin (sie liegt vor der Zahlung; und solange nach der Erstzahlung keine
 * Rate fällig ist, löscht der Takt ohnehin alles) — sonst stünde er als
 * „Zusage gebrochen" ganz oben.
 */
/** Der Berliner Kalendertag der letzten Zahlung. */
const LETZTE_ZAHLUNG_TAG_SQL = `((${LETZTE_ZAHLUNG_SQL}) AT TIME ZONE 'Europe/Berlin')::date`;
const RATE_STUFE0_SQL = `(COALESCE(p.priority_tier, 0) = 0 AND ${RATE_FAELLIG_SQL})`;
const GESPRAECH_NACH_ZAHLUNG_SQL = `(${LETZTER_KONTAKT_SQL} > ${LETZTE_ZAHLUNG_SQL})`;
/** Stufe 0 behält ihre Zahlungszusage. */
export const RATEN_ZUSAGE_BEHALTEN_SQL = `(${RATE_STUFE0_SQL} AND (
    (p.promised_payment_date IS NOT NULL AND p.promised_payment_date > ${LETZTE_ZAHLUNG_TAG_SQL})
    OR ${GESPRAECH_NACH_ZAHLUNG_SQL}))`;
/** Stufe 0 behält ihre Wiedervorlage. */
export const RATEN_WV_BEHALTEN_SQL = `(${RATE_STUFE0_SQL} AND (
    (p.follow_up_date IS NOT NULL AND p.follow_up_date > ${LETZTE_ZAHLUNG_TAG_SQL})
    OR ${GESPRAECH_NACH_ZAHLUNG_SQL}))`;

/**
 * Das Aufräumen der Arbeitsdaten für Stufe ≤ 0 — EIN Befehl für die Einstufung
 * einer Person (personTierAktualisieren, `nurPerson` = true, Parameter $1) und
 * den 20-Minuten-Takt (alleTierAktualisieren). Je Person werden die beiden
 * Behalten-Fragen einmal gerechnet (WITH), dann jedes Feld für sich gelöscht.
 */
export function ratenArbeitAufraeumenSql(nurPerson: boolean): string {
  return `
    WITH k AS (
      SELECT p.id, ${RATEN_ZUSAGE_BEHALTEN_SQL} AS zusage_bleibt, ${RATEN_WV_BEHALTEN_SQL} AS wv_bleibt
        FROM fiaon_persons p
       WHERE ${nurPerson ? "p.id = $1" : "p.merged_into_person_id IS NULL"} AND p.priority_tier <= 0
         AND (p.promised_payment_date IS NOT NULL OR p.follow_up_date IS NOT NULL))
    UPDATE fiaon_persons p
       SET promised_payment_date = CASE WHEN k.zusage_bleibt THEN p.promised_payment_date END,
           follow_up_date = CASE WHEN k.wv_bleibt THEN p.follow_up_date END,
           updated_at = NOW()
      FROM k
     WHERE p.id = k.id
       AND ((p.promised_payment_date IS NOT NULL AND NOT k.zusage_bleibt)
            OR (p.follow_up_date IS NOT NULL AND NOT k.wv_bleibt))`;
}
