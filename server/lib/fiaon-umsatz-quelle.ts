// ═══════════════════════════════════════════════════════════════════════════
// DIE EINE UMSATZ-QUELLE (E-343, 13.10.2026)
//
// Justin, 13.10. morgens: „Die Zahlungen müssen ÜBERALL synchronisiert werden,
// wir haben heute bereits Geld eingenommen und hier steht 0 — ich muss mich
// darauf verlassen können."
//
// Gemessen am 13.10. um 10 Uhr: Bank 179,98 € (zwei Raten), Lagezimmer 179,98 €,
// die Tagesübersicht 0,00 € — sie summierte Bestellungen nach completed_at und
// sah keine einzige Monatsrate. Und auch die Regel hier hatte eine Lücke: Ein
// Einzelangebot für Firmen (LLC-Gründung in zwei Hälften, 199 € am 11.10.) ist
// im Katalog ein Einmalkauf, aber kein Katalog-„global" — es stand in KEINER
// Umsatzzahl.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
//   rate      bezahlte fiaon_abo_raten, Tag = bezahlt_am (Eingangstag)
//   auskunft  bezahlte Bonitätsauskunft (Kategorie „auskunft“) OHNE Ratenkette
//   global    bezahlter Einmalkauf des Katalogs (Kategorie „global“ ODER
//             KEIN_ABO_SQL, ohne Auskunft) OHNE Ratenkette
//   nie       Testkonten, zusammengeführte Bestellungen, alte Privatbestellungen
//             ohne Kette (gemessen 13.10.: alle gestoppt/storniert), angerechnete
//             Raten (quelle 'anrechnung', E-354 — das Geld kam früher schon herein)
// Hat eine Einmalbestellung doch Raten, zählt sie NUR über die Raten — nie doppelt.
//
// ── E-469 (30.10.2026): TEILZAHLUNGEN EINER GLOBAL-RECHNUNG ──────────────────
//   global    jede gebuchte Teilzahlung (fiaon_teilzahlungen) am EINGANGSTAG, mit ihrem Betrag — Geld auf dem Konto
//             ist Umsatz (Justin: „bezahlt heißt bankbestätigt“), und Bank-Abgleich (Bank heute X · gebucht Y) stimmt so
//             am selben Tag. Die Bestellung zählt dann NICHT noch einmal über amount_due, auch nicht, wenn sie mit der
//             letzten Teilzahlung „bezahlt“ wird. Die Datenbank lässt keine Summe über dem Rechnungsbetrag zu (CHECK) —
//             Teilzahlungen plus Bezahlt-Eintrag ergeben zusammen nie mehr als den Rechnungsbetrag.
//             erste = TRUE nur auf der Zeile, die die Rechnung abschließt (Abschluss = bezahlte Bestellung, wie bisher).
//             teil_vorher_cents = was vor dieser Zeile auf dieselbe Rechnung schon kam (sonst 0) — damit ein Abzug, der
//             „von der ersten Zahlung“ gilt (Fast-Track, KOOP_DURCHLAUF_ABZUG_SQL), über mehrere Teile nur einmal wirkt.
//
// Wer Umsatz zeigt, liest UMSATZ_QUELLE_SQL (oder umsatzBausteine() in
// server/routes/fiaon-chef-zahlen.ts, das darauf rechnet) — nie eine eigene Abfrage.
// ═══════════════════════════════════════════════════════════════════════════
import { KEIN_ABO_SQL } from "./fiaon-kein-abo";
import { produktkategorieSql } from "./fiaon-produktkategorie";

/** Echte Kunden: keine Prüfstand-Referenzen, keine als Test markierten Personen (Alias a = Bestellung, p = Person). */
export const ECHT = `a.ref NOT LIKE 'FIAON-TEST%' AND COALESCE(p.ist_test_am IS NOT NULL, FALSE) = FALSE`;
export const IST_AUSKUNFT = `${produktkategorieSql("a")} = 'auskunft'`;
export const IST_GLOBAL = `(${produktkategorieSql("a")} = 'global' OR (${KEIN_ABO_SQL} AND ${produktkategorieSql("a")} <> 'auskunft'))`;
export const OHNE_RATEN = `NOT EXISTS (SELECT 1 FROM fiaon_abo_raten rx WHERE rx.ref = a.ref)`;

/** E-469: Diese Bestellung hat Teilzahlungen — dann zählt sie nur über fiaon_teilzahlungen, nie über amount_due. */
export const OHNE_TEILZAHLUNG = `NOT EXISTS (SELECT 1 FROM fiaon_teilzahlungen tz WHERE tz.ref = a.ref)`;

/**
 * Jede gebuchte Zahlung einer echten Person — Spalten: cents, am, art (rate | auskunft | global), ref, person_id,
 * rate_nr, agent_id (der Bestellung zugeordnete Mitarbeiter, a.assigned_agent_id), erste (TRUE = Abschluss:
 * Rate 1 oder Einmalkauf; Folgeraten sind kein neuer Abschluss) und teil_vorher_cents (E-469, sonst 0).
 * Braucht die Tabelle fiaon_teilzahlungen (ensureTeilzahlungen, beim Serverstart angelegt; Migration 127).
 */
export const UMSATZ_QUELLE_SQL = `
    SELECT r.betrag_cents AS cents, r.bezahlt_am AS am, 'rate' AS art, a.ref, a.person_id, r.rate_nr,
           a.assigned_agent_id AS agent_id, (r.rate_nr = 1) AS erste, 0 AS teil_vorher_cents
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
       -- E-354: Angerechnete Raten sind kein neues Geld — gezählt wurde es am Tag der ursprünglichen Zahlung.
       AND COALESCE(r.quelle, '') <> 'anrechnung'
       AND a.merged_into IS NULL AND ${ECHT}
    UNION ALL
    SELECT ROUND(a.amount_due * 100)::int, COALESCE(a.paid_at, a.completed_at), 'auskunft', a.ref, a.person_id, NULL::int,
           a.assigned_agent_id, TRUE, 0
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND ${IST_AUSKUNFT} AND ${OHNE_RATEN} AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
       AND ${ECHT}
    UNION ALL
    SELECT COALESCE(ROUND(a.amount_due * 100), 0)::int, COALESCE(a.paid_at, a.completed_at), 'global', a.ref, a.person_id, NULL::int,
           a.assigned_agent_id, TRUE, 0
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND ${IST_GLOBAL} AND ${OHNE_RATEN} AND ${OHNE_TEILZAHLUNG} AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
       AND ${ECHT}
    UNION ALL
    -- E-469: jede Teilzahlung am Eingangstag (12:00 UTC = derselbe Berliner Tag, wie alsBezahltBuchen es setzt).
    SELECT t.betrag_cents, (t.eingang_am + TIME '12:00') AT TIME ZONE 'UTC', 'global', a.ref, a.person_id, NULL::int,
           a.assigned_agent_id, t.schliesst_ab,
           (SELECT COALESCE(SUM(t2.betrag_cents), 0) FROM fiaon_teilzahlungen t2
             WHERE t2.ref = t.ref AND (t2.eingang_am < t.eingang_am OR (t2.eingang_am = t.eingang_am AND t2.id < t.id)))::int
      FROM fiaon_teilzahlungen t
      JOIN fiaon_applications a ON a.ref = t.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.merged_into IS NULL AND ${ECHT}`;

/** Berliner Kalendertag eines Zeitpunkts als SQL (für Vergleiche mit einem Datum). */
export const BERLIN_TAG = (spalte: string) => `(${spalte} AT TIME ZONE 'Europe/Berlin')::date`;
