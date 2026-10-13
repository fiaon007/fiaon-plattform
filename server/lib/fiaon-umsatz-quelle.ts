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
//             ohne Kette (gemessen 13.10.: alle gestoppt/storniert)
// Hat eine Einmalbestellung doch Raten, zählt sie NUR über die Raten — nie doppelt.
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

/**
 * Jede gebuchte Zahlung einer echten Person — Spalten: cents, am, art (rate | auskunft | global), ref, person_id,
 * rate_nr, agent_id (der Bestellung zugeordnete Mitarbeiter, a.assigned_agent_id) und erste (TRUE = Abschluss:
 * Rate 1 oder Einmalkauf; Folgeraten sind kein neuer Abschluss).
 */
export const UMSATZ_QUELLE_SQL = `
    SELECT r.betrag_cents AS cents, r.bezahlt_am AS am, 'rate' AS art, a.ref, a.person_id, r.rate_nr,
           a.assigned_agent_id AS agent_id, (r.rate_nr = 1) AS erste
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL
       AND a.merged_into IS NULL AND ${ECHT}
    UNION ALL
    SELECT ROUND(a.amount_due * 100)::int, COALESCE(a.paid_at, a.completed_at), 'auskunft', a.ref, a.person_id, NULL::int,
           a.assigned_agent_id, TRUE
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND ${IST_AUSKUNFT} AND ${OHNE_RATEN} AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
       AND ${ECHT}
    UNION ALL
    SELECT COALESCE(ROUND(a.amount_due * 100), 0)::int, COALESCE(a.paid_at, a.completed_at), 'global', a.ref, a.person_id, NULL::int,
           a.assigned_agent_id, TRUE
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND ${IST_GLOBAL} AND ${OHNE_RATEN} AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL
       AND ${ECHT}`;

/** Berliner Kalendertag eines Zeitpunkts als SQL (für Vergleiche mit einem Datum). */
export const BERLIN_TAG = (spalte: string) => `(${spalte} AT TIME ZONE 'Europe/Berlin')::date`;
