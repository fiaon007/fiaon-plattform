// ═══════════════════════════════════════════════════════════════════════════
// MARAS BILANZ (26.09.2026, E-244)
//
// Justin: „Wo finde ich Maras Abschlussbericht? Ich will wissen, was wir durch
// Mara bislang hatten oder durch die neuen Leads."
//
// Eine Rechnung für drei Zeiträume (heute Berlin · 7 Tage · seit Start) und
// fünf Wege: Mail-Aktion, WhatsApp, Postfach, Auskunft-Verkauf, neue Leads —
// dazu der Rahmen (alles Geld im Zeitraum, davon nach Mara, KI-Kosten,
// Kündigungen als Gegenposten).
//
// ── DIE REGELN ─────────────────────────────────────────────────────────────
// · GELD ist nur, was gebucht ist: bezahlte Raten, bezahlte Auskünfte,
//   bezahlte Global-Pakete — dieselbe Quelle wie /chef/zahlen
//   (server/routes/fiaon-chef-zahlen.ts, QUELLE). Gemeldete Zahlungen sind
//   kein Geld und stehen getrennt.
// · „Geld danach" = eine gebuchte Zahlung derselben Person höchstens 14 Tage
//   NACH einem Kontakt von Mara. Das ist eine zeitliche Folge, kein Beweis.
// · Testpersonen (fiaon_persons.ist_test_am, FIAON-TEST-%) zählen nie mit.
// · Jeder Weg zählt erst ab seinem belegten Start (STARTS); „seit Start" heißt
//   je Spalte etwas anderes und steht deshalb an jeder Spalte.
// · Die Lead-Zahlen rechnet NICHT diese Datei, sondern berichtSql/berichtBauen
//   aus fiaon-meta-kosten.ts (dieselbe Zählung wie der Lead-Motor). Nur
//   „Antrag begonnen" kennt der Kostenbericht nicht — das zählt hier eine
//   kleine eigene Abfrage mit denselben Lead-Merkmalen.
// · Die Kacheln „Zahlung danach" (Steuerpult) und „Wirkung 7 Tage"
//   (WA-Zentrale) lesen seit E-244 dieselbe Geld-Quelle (geldSql).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berichtSql, berichtBauen, type BerichtZeile } from "./fiaon-meta-kosten";
import { produktkategorieSql } from "./fiaon-produktkategorie";

type Lauf = typeof sqlPool;

/** So viele Tage nach Maras Kontakt zählt eine Zahlung als „danach". */
export const NACH_TAGEN = 14;

/**
 * Die belegten Starts je Weg (aus der Produktion gelesen am 26.09.2026,
 * scratchpad e244/u4/s2_start.sql). Alles vorher gehört nicht zu Mara.
 */
export const STARTS = {
  mail: { am: "2026-09-21T20:45:00Z", beleg: "Erste Mail der Aktion (fiaon_mara_aktion) am 21.09. um 22:45 Uhr" },
  whatsapp: { am: "2026-09-23T13:18:00Z", beleg: "Erste Nachricht mit Absender Mara (fiaon_whatsapp) am 23.09. um 15:18 Uhr" },
  postfach: { am: "2026-09-02T19:17:00Z", beleg: "Erste gesendete Antwort im Postfach (fiaon_postmeister) am 02.09. um 21:17 Uhr" },
  auskunft: { am: "2026-09-23T22:00:00Z", beleg: "Auskunft als Produkt (E-240) seit 24.09.; Angebotsmails seit 26.09. 15:18 Uhr" },
  leads: { am: "2026-09-22T22:00:00Z", tag: "2026-09-23", beleg: "Erster Lead über den Lead-Motor (Meta direkt) am 23.09.; Werbekosten ab 23.09." },
  rahmen: { am: "2026-09-21T20:45:00Z", beleg: "Maras erste eigene Ansprache (Mail-Aktion) am 21.09. um 22:45 Uhr" },
} as const;

/** Die KI-Dienste, die zu Mara gehören (fiaon_ki_nutzung.dienst). */
export const MARA_DIENSTE = ["mara-aktion", "mara-whatsapp", "mara-auftrag", "postmeister-antwort", "postmeister-einordnen"] as const;

/** Auskunft-Bestellung erkennen — dieselbe Regel wie fiaon-auskunft-verkauf.ts (IST_AUSKUNFT). */
export const IST_AUSKUNFT_SQL = (a: string) => `(COALESCE(${a}.type, '') = 'schufa' OR ${a}.ref LIKE 'FIAON-SCHUFA-%')`;

/**
 * Die Geld-Wahrheit MIT Person: jede gebuchte Zahlung einer echten Person.
 * Spalten: person_id, ref, cents, am, art (rate1 | rate2plus | auskunft | global), nur_tag.
 *
 * nur_tag: Bei Raten ist bezahlt_am der TATSÄCHLICHE Eingangstag mit einer
 * festen Uhrzeit (rateBezahltBuchen, server/routes/fiaon-abo.ts: 12:00Z =
 * 14:00 Uhr Berlin). Das Datum stimmt, die Uhrzeit ist erfunden — deshalb
 * vergleicht danachSql() Raten nur nach Berliner Kalendertag.
 * Dieselben Bedingungen wie QUELLE in server/routes/fiaon-chef-zahlen.ts —
 * dort fehlt die Person, deshalb steht die Abfrage hier ein zweites Mal
 * (Vorschlag im Bericht E-244: QUELLE dort um person_id erweitern und
 * exportieren, dann liest diese Datei sie mit).
 */
export function geldSql(): string {
  const echt = `a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL`;
  return `
    SELECT a.person_id, a.ref, r.betrag_cents::bigint AS cents, r.bezahlt_am AS am,
           CASE WHEN r.rate_nr = 1 THEN 'rate1' ELSE 'rate2plus' END AS art, TRUE AS nur_tag
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'bezahlt' AND r.bezahlt_am IS NOT NULL AND a.merged_into IS NULL AND ${echt}
    UNION ALL
    SELECT a.person_id, a.ref, ROUND(a.amount_due * 100)::bigint, COALESCE(a.paid_at, a.completed_at), 'auskunft', FALSE
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND a.ref LIKE 'FIAON-SCHUFA-%' AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL AND ${echt}
    UNION ALL
    SELECT a.person_id, a.ref, COALESCE(ROUND(a.amount_due * 100), 0)::bigint, COALESCE(a.paid_at, a.completed_at), 'global', FALSE
      FROM fiaon_applications a
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
       AND ${produktkategorieSql("a")} = 'global' AND COALESCE(a.paid_at, a.completed_at) IS NOT NULL AND ${echt}`;
}

/**
 * „Zahlung g kam nach dem Kontakt k" — höchstens NACH_TAGEN Tage danach.
 * Raten (nur_tag) nach Berliner Kalendertag: Eingangstag STRENG nach dem Tag
 * des Kontakts (ein Eingang am selben Tag kann vor der Mail angestoßen worden
 * sein) und höchstens NACH_TAGEN Tage später. Auskunft/Global mit echter Uhrzeit.
 */
export function danachSql(g: string, k: string): string {
  const tg = `(${g}.am AT TIME ZONE 'Europe/Berlin')::date`;
  const tk = `(${k} AT TIME ZONE 'Europe/Berlin')::date`;
  return `(CASE WHEN ${g}.nur_tag THEN ${tg} > ${tk} AND ${tg} <= ${tk} + ${NACH_TAGEN}
                ELSE ${g}.am > ${k} AND ${g}.am <= ${k} + INTERVAL '${NACH_TAGEN} days' END)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE DEFINITIONEN — jede Zahl mit Quelle, damit die Karte sie zeigen kann
// ═══════════════════════════════════════════════════════════════════════════
const D = (quelle: string, definition: string) => ({ quelle, definition });
const DANACH = `gebuchte Zahlung derselben Person höchstens ${NACH_TAGEN} Tage nach Maras Kontakt (Raten: Eingangstag nach dem Tag des Kontakts), Geld-Wahrheit wie /chef/zahlen. Zeitliche Folge, kein Beweis.`;
export const DEFINITIONEN: Record<string, { quelle: string; definition: string }> = {
  "mail.gesendet": D("fiaon_mara_aktion", "Gesendete Mails der Aktion im Zeitraum, ohne Testpersonen."),
  "mail.menschen": D("fiaon_mara_aktion", "Verschiedene Menschen, die im Zeitraum eine Aktions-Mail bekamen."),
  "mail.antworten": D("fiaon_postmeister", "Menschen, deren Mail im Zeitraum im Postfach einging, nachdem Mara sie angeschrieben hatte."),
  "mail.gemeldet": D("fiaon_applications.claimed_paid_at", `Menschen, die im Zeitraum eine Zahlung GEMELDET haben, höchstens ${NACH_TAGEN} Tage nach Maras Mail. Gemeldet ist kein Geld.`),
  "mail.geld": D("fiaon_abo_raten + Auskunft/Global (wie /chef/zahlen)", `Nach einer Aktions-Mail: ${DANACH}`),
  "mail.geldVorherGemeldet": D("fiaon_applications.claimed_paid_at (dieselbe Bestellung)", "Davon Zahlungen (Rate 1, Auskunft, Global), die der Mensch für diese Bestellung schon VOR Maras erstem Kontakt gemeldet hatte (Stufe A) — die Überweisung lief also meist schon vorher. Folgeraten zählen nie als vorher gemeldet: Die Meldung gilt Rate 1."),
  "mail.geldOhneMeldung": D("fiaon_abo_raten + Auskunft/Global (wie /chef/zahlen)", "Davon Zahlungen ohne Meldung vor Maras erstem Kontakt — der ehrlichere Blick auf das, was nach Maras Mail kam."),
  "whatsapp.rein": D("fiaon_whatsapp", "Eingegangene WhatsApp-Nachrichten im Zeitraum (alle Nummern)."),
  "whatsapp.antworten": D("fiaon_whatsapp", "Freie Nachrichten (ohne Vorlage) mit Absender Mara, zugestellt oder unterwegs."),
  "whatsapp.gespraeche": D("fiaon_whatsapp", "Verschiedene Nummern, denen Mara frei geantwortet hat."),
  "whatsapp.vorlagen": D("fiaon_whatsapp", "Vorlagen mit Absender Mara (WA-Zentrale und Lead-Kette) ohne Fehler — gesendet oder zugestellt, eine Zustellbestätigung fehlt bei manchen."),
  "whatsapp.fehler": D("fiaon_whatsapp", "Nachrichten mit Absender Mara, die Meta als Fehler zurückgab (meist nicht zustellbar)."),
  "whatsapp.termine": D("fiaon_mara_protokoll", "Termine, die Mara im Kalender gebucht hat (art termin_gebucht, ok)."),
  "whatsapp.uebergaben": D("fiaon_mara_protokoll", "Übergaben an einen Betreuer (art uebergabe, ok)."),
  "whatsapp.auskunft": D("fiaon_wa_aktion", "Auskunft-Angebote per WhatsApp (Gruppe auskunft_fehlt, gesendet)."),
  "whatsapp.geld": D("fiaon_abo_raten + Auskunft/Global (wie /chef/zahlen)", `Nach einer WhatsApp von Mara: ${DANACH}`),
  "postfach.beantwortet": D("fiaon_postmeister", "Im Zeitraum gesendete Antworten im Postfach."),
  "postfach.entwuerfe": D("fiaon_postmeister", "Heute noch offene Entwürfe (nicht gesendet) zu Mails, die im Zeitraum eingingen."),
  "postfach.handgriffe": D("fiaon_postmeister.handlungen", "Gelungene Handgriffe (Zahlungslink, Rechnung, Aufgabe an Betreuer …) an Postfach-Fällen im Zeitraum."),
  "auskunft.angebote": D("fiaon_mail_log", "Versandte Angebotsmails zur Bonitätsauskunft (event auskunft_angebot)."),
  "auskunft.whatsapp": D("fiaon_wa_aktion", "Angebote per WhatsApp (Gruppe auskunft_fehlt)."),
  "auskunft.klicks": D("fiaon_auskunft_klicks", "Verschiedene Menschen, die einen Auskunft-Link geöffnet haben."),
  "auskunft.bestellt": D("fiaon_applications", "Auskunft-Bestellungen (type schufa oder FIAON-SCHUFA-…), im Zeitraum angelegt, ohne Test."),
  "auskunft.bezahlt": D("fiaon_applications (wie /chef/zahlen)", "Bezahlte Auskünfte, nach Zahlungszeitpunkt (paid_at)."),
  "leads.leads": D("berichtSql (fiaon-meta-kosten.ts, wie Lead-Motor)", "Meta-Leads im Zeitraum (Kalendertage Berlin), alle Kampagnen, ohne Website-Klicks ohne Kennung."),
  "leads.begonnen": D("fiaon_leads + fiaon_applications", "Menschen aus diesen Leads mit einem Antrag (Stufenpaket), angelegt frühestens einen Tag vor dem Lead."),
  "leads.fertig": D("berichtSql (wie Lead-Motor)", "Menschen aus diesen Leads mit abgeschicktem Antrag."),
  "leads.zahlende": D("berichtSql (wie Lead-Motor)", "Menschen aus diesen Leads mit gebuchter Rate 1."),
  "leads.umsatz": D("berichtSql (wie Lead-Motor)", "Gebuchte Raten und Auskünfte dieser Menschen."),
  "leads.werbung": D("fiaon_meta_kosten", "Werbekosten der Kampagnen im Werbekonto (Tageswerte aus dem Meta-Abruf)."),
  "leads.jeLead": D("berichtBauen (wie Lead-Motor)", "Werbekosten ÷ Leads der Kampagnen im Werbekonto."),
  "leads.jeZahlendem": D("berichtBauen (wie Lead-Motor)", "Werbekosten ÷ zahlende Menschen der Kampagnen im Werbekonto."),
  "rahmen.geld": D("wie /chef/zahlen", "Alles gebuchte Geld im Zeitraum (ab Maras Start): Raten, Auskünfte, Global."),
  "rahmen.nachMara": D("wie /chef/zahlen", `Davon gebucht höchstens ${NACH_TAGEN} Tage nach einer Mail oder WhatsApp von Mara. Jede Zahlung einmal, auch nach beiden Wegen. Mara schreibt ALLE Menschen der Stufen A und B an — fast jede neue Rate 1 folgt deshalb auf eine Mara-Mail. Zeitliche Folge, kein Beweis, kein Anteil, den Mara bewirkt hat.`),
  "rahmen.nachMaraOhneMeldung": D("wie /chef/zahlen", "Davon ohne Meldung derselben Bestellung vor Maras erstem Kontakt."),
  "rahmen.ki": D("fiaon_ki_nutzung", `KI-Kosten aller Mara-Dienste (${MARA_DIENSTE.join(", ")}) im Zeitraum, frühestens ab Maras Mail-Aktion (21.09.) — Postfach-KI davor zählt nicht mit.`),
  "rahmen.kuendigungen": D("fiaon_postmeister.handlungen", "Verschiedene Menschen, deren Kündigung Mara im Postfach vorgemerkt hat (kuendigung_vormerken, ok), ohne Testpersonen."),
  "rahmen.kuendigungNachMail": D("fiaon_applications.gekuendigt_am", `Menschen, die im Zeitraum gekündigt haben (auf JEDEM Weg: Betreuer, Chefbüro, Mara), höchstens ${NACH_TAGEN} Tage nach einer Aktions-Mail. Keine Teilmenge der Vormerkungen.`),
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE TYPEN
// ═══════════════════════════════════════════════════════════════════════════
export type ZeitraumName = "heute" | "woche" | "start";
export interface Geld { zahlungen: number; menschen: number; cents: number }
export interface BilanzZeitraum {
  name: ZeitraumName;
  mail: { ab: string; gesendet: number; menschen: number; antworten: number; gemeldet: number; geld: Geld; geldVorherGemeldet: Geld };
  whatsapp: { ab: string; rein: number; reinNummern: number; antworten: number; gespraeche: number; vorlagen: number; fehler: number; termine: number; uebergaben: number; auskunft: number; geld: Geld };
  postfach: { ab: string; beantwortet: number; entwuerfe: number; handgriffe: number; handgriffeJe: Record<string, number> };
  auskunft: { ab: string; angebote: number; angeboteMenschen: number; whatsapp: number; klicks: number; bestellt: number; bezahlt: number; bezahltCents: number };
  leads: {
    von: string; bis: string; leads: number; leadsKonto: number; menschen: number; begonnen: number; fertig: number; zahlende: number;
    umsatzCents: number; werbungCents: number; kostenJeLeadCents: number | null; kostenJeZahlendemCents: number | null;
  };
  rahmen: {
    ab: string; geldCents: number; zahlungen: number; rate1Cents: number; rate2Cents: number; auskunftCents: number; globalCents: number;
    nachMaraCents: number; nachMaraZahlungen: number; nachMaraOhneMeldungCents: number; nachMailCents: number; nachWhatsappCents: number;
    kiCents: number; kiJeDienst: Record<string, number>; kuendigungen: number; kuendigungNachMail: number;
  };
}
export interface Bilanz {
  ok: true;
  stand: string;
  heuteBerlin: string;
  dauerMs: number;
  ausZwischenspeicher: boolean;
  nachTagen: number;
  hinweis: string;
  starts: typeof STARTS;
  kostenStand: string | null;
  zeitraeume: Record<ZeitraumName, BilanzZeitraum>;
  definitionen: typeof DEFINITIONEN;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ABFRAGE — eine für Mail, WhatsApp, Postfach, Auskunft und Rahmen
//   $1 Mail-Start · $2 WhatsApp-Start · $3 Auskunft-Start · $4 Rahmen-Start · $5 Postfach-Start
// ═══════════════════════════════════════════════════════════════════════════
export function bilanzSql(): string {
  const tage = `INTERVAL '${NACH_TAGEN} days'`;
  const dienste = MARA_DIENSTE.map((d) => `'${d}'`).join(", ");
  return `
    WITH
    v(name, ab) AS (VALUES
      ('heute', ((NOW() AT TIME ZONE 'Europe/Berlin')::date)::timestamp AT TIME ZONE 'Europe/Berlin'),
      ('woche', NOW() - INTERVAL '7 days'),
      ('start', '-infinity'::timestamptz)),
    z AS (
      SELECT name,
             GREATEST(ab, $1::timestamptz) AS ab_mail, GREATEST(ab, $2::timestamptz) AS ab_wa,
             GREATEST(ab, $3::timestamptz) AS ab_ausk, GREATEST(ab, $4::timestamptz) AS ab_rahmen,
             GREATEST(ab, $5::timestamptz) AS ab_post
        FROM v),
    tp AS (SELECT id FROM fiaon_persons WHERE ist_test_am IS NOT NULL),
    mm AS (
      SELECT person_id, gesendet_am AS am FROM fiaon_mara_aktion
       WHERE status = 'gesendet' AND gesendet_am IS NOT NULL AND person_id IS NOT NULL
         AND person_id NOT IN (SELECT id FROM tp)),
    mw AS (
      SELECT w.person_id, w.nummer, w.created_at AS am, (w.vorlage IS NULL) AS frei, (COALESCE(w.status, '') = 'fehler') AS fehler
        FROM fiaon_whatsapp w
       WHERE w.richtung = 'raus' AND w.von ILIKE 'Mara%' AND w.created_at >= $2::timestamptz
         AND (w.person_id IS NULL OR w.person_id NOT IN (SELECT id FROM tp))),
    geld AS (SELECT * FROM (${geldSql()}) g0 WHERE g0.am >= $4::timestamptz),
    gx AS (
      SELECT g.*,
             EXISTS (SELECT 1 FROM mm WHERE mm.person_id = g.person_id AND ${danachSql("g", "mm.am")}) AS nach_mail,
             EXISTS (SELECT 1 FROM mw WHERE NOT mw.fehler AND mw.person_id = g.person_id AND ${danachSql("g", "mw.am")}) AS nach_wa,
             -- Schon VOR Maras erstem Kontakt gemeldet (dieselbe Bestellung) — meist Stufe A,
             -- die Überweisung lief dann schon vorher. Nur für Rate 1, Auskunft und Global:
             -- claimed_paid_at stammt aus der Meldung zu Rate 1 und wird nie zurückgesetzt,
             -- eine Folgerate wäre sonst für immer „vorher gemeldet" (E-244, Gesamtdurchsicht).
             g.art <> 'rate2plus' AND EXISTS (SELECT 1 FROM fiaon_applications ca
                      WHERE ca.ref = g.ref AND ca.claimed_paid_at IS NOT NULL
                        AND ca.claimed_paid_at < LEAST(
                              (SELECT MIN(mm.am) FROM mm WHERE mm.person_id = g.person_id),
                              (SELECT MIN(mw.am) FROM mw WHERE NOT mw.fehler AND mw.person_id = g.person_id))) AS vorher_gemeldet
        FROM geld g),
    pm AS (
      SELECT p.id, p.person_id, p.aktion, p.empfangen_am, p.gesendet_am, COALESCE(p.gesendet_am, p.created_at) AS am, p.handlungen
        FROM fiaon_postmeister p
       WHERE COALESCE(p.gesendet_am, p.created_at, p.empfangen_am) >= $5::timestamptz OR p.empfangen_am >= $5::timestamptz),
    pmh AS (
      SELECT pm.person_id, pm.am, e ->> 'werkzeug' AS werkzeug
        FROM pm
        CROSS JOIN LATERAL (
          SELECT CASE WHEN jsonb_typeof(pm.handlungen) = 'array' THEN pm.handlungen
                      WHEN jsonb_typeof(pm.handlungen) = 'string' AND LEFT(pm.handlungen #>> '{}', 1) = '[' THEN (pm.handlungen #>> '{}')::jsonb
                      ELSE '[]'::jsonb END AS liste) h
        CROSS JOIN LATERAL jsonb_array_elements(h.liste) e
       WHERE pm.handlungen IS NOT NULL AND COALESCE(e ->> 'ok', '') = 'true'
         AND (pm.person_id IS NULL OR pm.person_id NOT IN (SELECT id FROM tp))),
    kn AS (SELECT id FROM fiaon_persons WHERE ist_test_am IS NULL)
    SELECT z.name,
      z.ab_mail, z.ab_wa, z.ab_ausk, z.ab_rahmen, z.ab_post,
      -- Mail-Aktion
      (SELECT COUNT(*) FROM mm WHERE mm.am >= z.ab_mail)::int AS mail_gesendet,
      (SELECT COUNT(DISTINCT person_id) FROM mm WHERE mm.am >= z.ab_mail)::int AS mail_menschen,
      (SELECT COUNT(DISTINCT p.person_id) FROM fiaon_postmeister p
        WHERE p.empfangen_am >= z.ab_mail AND p.person_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM mm WHERE mm.person_id = p.person_id AND p.empfangen_am > mm.am))::int AS mail_antworten,
      (SELECT COUNT(DISTINCT a.person_id) FROM fiaon_applications a
        WHERE a.claimed_paid_at >= z.ab_mail AND a.merged_into IS NULL AND a.person_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM mm WHERE mm.person_id = a.person_id AND a.claimed_paid_at > mm.am AND a.claimed_paid_at <= mm.am + ${tage}))::int AS mail_gemeldet,
      (SELECT COUNT(*) FROM gx WHERE nach_mail AND am >= z.ab_mail)::int AS mail_geld_n,
      (SELECT COUNT(DISTINCT person_id) FROM gx WHERE nach_mail AND am >= z.ab_mail)::int AS mail_geld_menschen,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE nach_mail AND am >= z.ab_mail)::bigint AS mail_geld_cents,
      (SELECT COUNT(*) FROM gx WHERE nach_mail AND vorher_gemeldet AND am >= z.ab_mail)::int AS mail_vorher_n,
      (SELECT COUNT(DISTINCT person_id) FROM gx WHERE nach_mail AND vorher_gemeldet AND am >= z.ab_mail)::int AS mail_vorher_menschen,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE nach_mail AND vorher_gemeldet AND am >= z.ab_mail)::bigint AS mail_vorher_cents,
      -- WhatsApp
      (SELECT COUNT(*) FROM fiaon_whatsapp w WHERE w.richtung = 'rein' AND w.created_at >= z.ab_wa)::int AS wa_rein,
      (SELECT COUNT(DISTINCT w.nummer) FROM fiaon_whatsapp w WHERE w.richtung = 'rein' AND w.created_at >= z.ab_wa)::int AS wa_rein_nummern,
      (SELECT COUNT(*) FROM mw WHERE frei AND NOT fehler AND am >= z.ab_wa)::int AS wa_antworten,
      (SELECT COUNT(DISTINCT nummer) FROM mw WHERE frei AND NOT fehler AND am >= z.ab_wa)::int AS wa_gespraeche,
      (SELECT COUNT(*) FROM mw WHERE NOT frei AND NOT fehler AND am >= z.ab_wa)::int AS wa_vorlagen,
      (SELECT COUNT(*) FROM mw WHERE fehler AND am >= z.ab_wa)::int AS wa_fehler,
      (SELECT COUNT(*) FROM fiaon_mara_protokoll p WHERE p.ok AND p.art = 'termin_gebucht' AND p.am >= z.ab_wa)::int AS wa_termine,
      (SELECT COUNT(*) FROM fiaon_mara_protokoll p WHERE p.ok AND p.art = 'uebergabe' AND p.am >= z.ab_wa)::int AS wa_uebergaben,
      (SELECT COUNT(*) FROM fiaon_wa_aktion x WHERE x.ok AND x.gruppe = 'auskunft_fehlt' AND x.erstellt_am >= z.ab_ausk)::int AS wa_auskunft,
      (SELECT COUNT(*) FROM gx WHERE nach_wa AND am >= z.ab_wa)::int AS wa_geld_n,
      (SELECT COUNT(DISTINCT person_id) FROM gx WHERE nach_wa AND am >= z.ab_wa)::int AS wa_geld_menschen,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE nach_wa AND am >= z.ab_wa)::bigint AS wa_geld_cents,
      -- Postfach
      (SELECT COUNT(*) FROM pm WHERE pm.gesendet_am >= z.ab_post)::int AS post_beantwortet,
      (SELECT COUNT(*) FROM pm WHERE pm.aktion = 'entwurf' AND pm.gesendet_am IS NULL AND pm.empfangen_am >= z.ab_post)::int AS post_entwuerfe,
      (SELECT COUNT(*) FROM pmh WHERE pmh.am >= z.ab_post)::int AS post_handgriffe,
      (SELECT COALESCE(json_object_agg(werkzeug, n), '{}'::json) FROM (
         SELECT werkzeug, COUNT(*)::int AS n FROM pmh WHERE pmh.am >= z.ab_post AND werkzeug IS NOT NULL GROUP BY werkzeug) s) AS post_handgriffe_je,
      -- Auskunft-Verkauf
      (SELECT COUNT(*) FROM fiaon_mail_log m WHERE m.event = 'auskunft_angebot' AND m.status = 'versandt' AND m.created_at >= z.ab_ausk)::int AS ausk_angebote,
      (SELECT COUNT(DISTINCT m.person_id) FROM fiaon_mail_log m WHERE m.event = 'auskunft_angebot' AND m.status = 'versandt' AND m.created_at >= z.ab_ausk)::int AS ausk_angebote_menschen,
      (SELECT COUNT(DISTINCT k.person_id) FROM fiaon_auskunft_klicks k WHERE k.zeit >= z.ab_ausk AND (k.person_id IS NULL OR k.person_id NOT IN (SELECT id FROM tp)))::int AS ausk_klicks,
      (SELECT COUNT(*) FROM fiaon_applications a
        WHERE ${IST_AUSKUNFT_SQL("a")} AND a.merged_into IS NULL AND a.ref NOT LIKE 'FIAON-TEST%'
          AND a.person_id IN (SELECT id FROM kn) AND (a.created_at AT TIME ZONE 'UTC') >= z.ab_ausk)::int AS ausk_bestellt,
      (SELECT COUNT(*) FROM geld WHERE art = 'auskunft' AND am >= z.ab_ausk)::int AS ausk_bezahlt,
      (SELECT COALESCE(SUM(cents), 0) FROM geld WHERE art = 'auskunft' AND am >= z.ab_ausk)::bigint AS ausk_bezahlt_cents,
      -- Rahmen
      (SELECT COUNT(*) FROM gx WHERE am >= z.ab_rahmen)::int AS geld_n,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen)::bigint AS geld_cents,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND art = 'rate1')::bigint AS geld_rate1_cents,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND art = 'rate2plus')::bigint AS geld_rate2_cents,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND art = 'auskunft')::bigint AS geld_auskunft_cents,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND art = 'global')::bigint AS geld_global_cents,
      (SELECT COUNT(*) FROM gx WHERE am >= z.ab_rahmen AND (nach_mail OR nach_wa))::int AS mara_n,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND (nach_mail OR nach_wa))::bigint AS mara_cents,
      (SELECT COALESCE(SUM(cents), 0) FROM gx WHERE am >= z.ab_rahmen AND (nach_mail OR nach_wa) AND NOT vorher_gemeldet)::bigint AS mara_ohne_meldung_cents,
      (SELECT COALESCE(ROUND(SUM(k.kosten_cents)), 0) FROM fiaon_ki_nutzung k WHERE k.created_at >= z.ab_rahmen AND k.dienst IN (${dienste}))::bigint AS ki_cents,
      (SELECT COALESCE(json_object_agg(dienst, c), '{}'::json) FROM (
         SELECT k.dienst, ROUND(SUM(k.kosten_cents))::int AS c FROM fiaon_ki_nutzung k
          WHERE k.created_at >= z.ab_rahmen AND k.dienst IN (${dienste}) GROUP BY k.dienst) s) AS ki_je,
      (SELECT COUNT(DISTINCT pmh.person_id) FROM pmh WHERE pmh.am >= z.ab_rahmen AND pmh.werkzeug = 'kuendigung_vormerken')::int AS kuendigungen,
      (SELECT COUNT(DISTINCT a.person_id) FROM fiaon_applications a
        WHERE a.gekuendigt_am >= z.ab_rahmen AND a.merged_into IS NULL AND a.person_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM mm WHERE mm.person_id = a.person_id AND a.gekuendigt_am > mm.am AND a.gekuendigt_am <= mm.am + ${tage}))::int AS kuendigung_nach_mail
    FROM z
    ORDER BY array_position(ARRAY['heute', 'woche', 'start'], z.name)`;
}

/** „Antrag begonnen" aus Meta-Leads — dieselben Lead-Merkmale wie berichtSql (lead_zeilen). */
export function begonnenSql(): string {
  return `
    WITH l AS (
      SELECT l.id, l.person_id, l.converted_order_id, l.erstellt_am, COALESCE('p' || l.person_id, 'l' || l.id) AS einheit
        FROM fiaon_leads l
        LEFT JOIN fiaon_persons p ON p.id = l.person_id
       WHERE l.erstellt_am >= (($1::date)::timestamp AT TIME ZONE 'Europe/Berlin')
         AND l.erstellt_am < ((($2::date) + 1)::timestamp AT TIME ZONE 'Europe/Berlin')
         AND (l.quelle = 'facebook_lead_ads' OR l.meta_kampagne_id IS NOT NULL OR l.eingangsweg LIKE 'meta%')
         AND COALESCE(l.eingangsweg, '') <> 'test' AND p.ist_test_am IS NULL
    )
    SELECT COUNT(DISTINCT l.einheit)::int AS begonnen
      FROM l
     WHERE EXISTS (
       SELECT 1 FROM fiaon_applications a
        WHERE (a.ref = l.converted_order_id OR (l.person_id IS NOT NULL AND a.person_id = l.person_id))
          AND a.merged_into IS NULL AND a.ref NOT LIKE 'FIAON-TEST%' AND ${produktkategorieSql("a")} = 'konto'
          AND (a.created_at AT TIME ZONE 'UTC') >= l.erstellt_am - INTERVAL '1 day')`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RECHNEN
// ═══════════════════════════════════════════════════════════════════════════
const n = (v: unknown) => Number(v ?? 0) || 0;
const iso = (v: unknown) => {
  if (v == null) return "";
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};
const json = (v: unknown): Record<string, number> => {
  const o = typeof v === "string" ? (() => { try { return JSON.parse(v); } catch { return {}; } })() : v;
  const aus: Record<string, number> = {};
  for (const [k, w] of Object.entries((o as Record<string, unknown>) ?? {})) aus[k] = n(w);
  return aus;
};

/** JJJJ-MM-TT plus/minus Tage (reine Kalenderrechnung, ohne Uhrzeit). */
export function tagPlus(tag: string, tage: number): string {
  const d = new Date(`${tag}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Welche Tabellen die Lead-Rechnung vorfindet (frische Datenbank: keine Kostentabelle). */
export interface LeadTabellen { kosten: boolean; messung: boolean; zuordnung: boolean }
export const LEERE_KOSTEN = "SELECT NULL::date AS tag, NULL::text AS ebene, NULL::text AS objekt_id, NULL::text AS name, 0 AS ausgaben_cents, 0 AS impressionen, 0 AS klicks, 0 AS leads_meta WHERE FALSE";

/** Der Bericht des Lead-Motors (berichtSql) für diese Tabellenlage. */
export function leadsBerichtSql(t: LeadTabellen): string {
  return berichtSql({ kostenQuelle: t.kosten ? undefined : LEERE_KOSTEN, mitMessung: t.messung, mitZuordnung: t.zuordnung });
}

export type LeadZahlen = BilanzZeitraum["leads"];

/** Rohzeilen des Lead-Motor-Berichts → die Spalte „Neue Leads". Rein, ohne Datenbank. */
export function leadsAusRoh(roh: any[], begonnen: number, von: string, bis: string): LeadZahlen {
  const b = berichtBauen(roh, { von, bis, stand: null, letzterAbruf: null, werbekonten: [] });
  const lead = b.zeilen.filter((z: BerichtZeile) => z.art !== "website");
  const s = (f: (z: BerichtZeile) => number) => lead.reduce((x, z) => x + f(z), 0);
  return {
    von, bis,
    leads: s((z) => z.leads),
    leadsKonto: b.summe.leads,
    menschen: s((z) => z.menschen),
    begonnen: n(begonnen),
    fertig: s((z) => z.antraege),
    zahlende: s((z) => z.zahlende),
    umsatzCents: s((z) => z.umsatzRatenCents + z.auskunftCents),
    werbungCents: b.summe.ausgabenCents,
    kostenJeLeadCents: b.summe.kostenJeLeadCents,
    kostenJeZahlendemCents: b.summe.kostenJeZahlendemCents,
  };
}

/** Lead-Zeiträume in Berliner Kalendertagen, nie vor dem Start des Lead-Motors. */
export function leadVonJe(heute: string): Record<ZeitraumName, string> {
  const start = STARTS.leads.tag;
  const max = (a: string, b: string) => (a > b ? a : b);
  return { heute: max(heute, start), woche: max(tagPlus(heute, -6), start), start };
}

/** Zeilen der Bilanz-Abfrage + Lead-Spalten → die fertige Bilanz. Rein, ohne Datenbank. */
export function bilanzBauen(zeilen: any[], leads: Record<ZeitraumName, LeadZahlen>, rahmen: { heute: string; jetzt: unknown; kostenStand: unknown; dauerMs: number }): Bilanz {
  const zeitraeume = {} as Record<ZeitraumName, BilanzZeitraum>;
  for (const r of zeilen) {
    const name = String(r.name) as ZeitraumName;
    zeitraeume[name] = {
      name,
      mail: {
        ab: iso(r.ab_mail), gesendet: n(r.mail_gesendet), menschen: n(r.mail_menschen), antworten: n(r.mail_antworten), gemeldet: n(r.mail_gemeldet),
        geld: { zahlungen: n(r.mail_geld_n), menschen: n(r.mail_geld_menschen), cents: n(r.mail_geld_cents) },
        geldVorherGemeldet: { zahlungen: n(r.mail_vorher_n), menschen: n(r.mail_vorher_menschen), cents: n(r.mail_vorher_cents) },
      },
      whatsapp: {
        ab: iso(r.ab_wa), rein: n(r.wa_rein), reinNummern: n(r.wa_rein_nummern), antworten: n(r.wa_antworten), gespraeche: n(r.wa_gespraeche),
        vorlagen: n(r.wa_vorlagen), fehler: n(r.wa_fehler), termine: n(r.wa_termine), uebergaben: n(r.wa_uebergaben), auskunft: n(r.wa_auskunft),
        geld: { zahlungen: n(r.wa_geld_n), menschen: n(r.wa_geld_menschen), cents: n(r.wa_geld_cents) },
      },
      postfach: {
        ab: iso(r.ab_post), beantwortet: n(r.post_beantwortet), entwuerfe: n(r.post_entwuerfe),
        handgriffe: n(r.post_handgriffe), handgriffeJe: json(r.post_handgriffe_je),
      },
      auskunft: {
        ab: iso(r.ab_ausk), angebote: n(r.ausk_angebote), angeboteMenschen: n(r.ausk_angebote_menschen), whatsapp: n(r.wa_auskunft),
        klicks: n(r.ausk_klicks), bestellt: n(r.ausk_bestellt), bezahlt: n(r.ausk_bezahlt), bezahltCents: n(r.ausk_bezahlt_cents),
      },
      leads: leads[name],
      rahmen: {
        ab: iso(r.ab_rahmen), geldCents: n(r.geld_cents), zahlungen: n(r.geld_n),
        rate1Cents: n(r.geld_rate1_cents), rate2Cents: n(r.geld_rate2_cents), auskunftCents: n(r.geld_auskunft_cents), globalCents: n(r.geld_global_cents),
        nachMaraCents: n(r.mara_cents), nachMaraZahlungen: n(r.mara_n), nachMaraOhneMeldungCents: n(r.mara_ohne_meldung_cents), nachMailCents: n(r.mail_geld_cents), nachWhatsappCents: n(r.wa_geld_cents),
        kiCents: n(r.ki_cents), kiJeDienst: json(r.ki_je), kuendigungen: n(r.kuendigungen), kuendigungNachMail: n(r.kuendigung_nach_mail),
      },
    };
  }
  return {
    ok: true,
    stand: iso(rahmen.jetzt) || new Date().toISOString(),
    heuteBerlin: rahmen.heute,
    dauerMs: rahmen.dauerMs,
    ausZwischenspeicher: false,
    nachTagen: NACH_TAGEN,
    hinweis: `Zahlung nach Maras Kontakt = zeitliche Folge, kein Beweis. Geld heißt gebucht (wie /chef/zahlen), nicht gemeldet. Gezählt wird bei Raten der Eingangstag (ohne Uhrzeit). Zahlungen werden oft Tage später nachgebucht — auch „Heute" kann sich deshalb noch ändern.`,
    starts: STARTS,
    kostenStand: rahmen.kostenStand ? iso(rahmen.kostenStand) : null,
    zeitraeume,
    definitionen: DEFINITIONEN,
  };
}

/** Die Parameter der Bilanz-Abfrage ($1 … $5). */
export const BILANZ_PARAMETER = [STARTS.mail.am, STARTS.whatsapp.am, STARTS.auskunft.am, STARTS.rahmen.am, STARTS.postfach.am];

/** Die ganze Bilanz ohne Zwischenspeicher. `lauf` ist austauschbar (Prüfstand, Nur-Lese-Transaktion). */
export async function bilanzRechnen(lauf: Lauf = sqlPool): Promise<Bilanz> {
  const t0 = performance.now();
  const [h] = (await lauf`
    SELECT (NOW() AT TIME ZONE 'Europe/Berlin')::date::text AS heute, NOW() AS jetzt,
           to_regclass('public.fiaon_meta_kosten') IS NOT NULL AS kosten,
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'fiaon_meta_messung' AND column_name = 'kampagne') AS messung,
           to_regclass('public.fiaon_werbe_zuordnung') IS NOT NULL AS zuordnung`) as any[];
  const heute = String(h.heute);
  const t: LeadTabellen = { kosten: !!h.kosten, messung: !!h.messung, zuordnung: !!h.zuordnung };
  const von = leadVonJe(heute);
  const namen: ZeitraumName[] = ["heute", "woche", "start"];
  const [zeilen, kostenStand, ...lead] = await Promise.all([
    lauf.unsafe(bilanzSql(), BILANZ_PARAMETER) as Promise<any[]>,
    t.kosten ? (lauf`SELECT MAX(aktualisiert_am) AS am FROM fiaon_meta_kosten` as Promise<any[]>).then((r) => r[0]?.am ?? null) : Promise.resolve(null),
    ...namen.map((z) => Promise.all([
      lauf.unsafe(leadsBerichtSql(t), [von[z], heute]) as Promise<any[]>,
      lauf.unsafe(begonnenSql(), [von[z], heute]) as Promise<any[]>,
    ])),
  ]);
  const leads = {} as Record<ZeitraumName, LeadZahlen>;
  namen.forEach((z, i) => {
    const [roh, beg] = lead[i] as [any[], any[]];
    leads[z] = leadsAusRoh(roh, n(beg[0]?.begonnen), von[z], heute);
  });
  return bilanzBauen(zeilen as any[], leads, { heute, jetzt: h.jetzt, kostenStand, dauerMs: Math.round(performance.now() - t0) });
}

// ── 60 Sekunden zwischenspeichern: die Karte lädt bei jedem Öffnen der Seite ──
let speicher: { am: number; wert: Bilanz } | null = null;
let laeuft: Promise<Bilanz> | null = null;
export const SPEICHER_MS = 60_000;

export async function maraBilanz(opts: { frisch?: boolean } = {}): Promise<Bilanz> {
  if (!opts.frisch && speicher && Date.now() - speicher.am < SPEICHER_MS) return { ...speicher.wert, ausZwischenspeicher: true };
  if (!laeuft) {
    laeuft = bilanzRechnen().then((b) => { speicher = { am: Date.now(), wert: b }; return b; }).finally(() => { laeuft = null; });
  }
  return laeuft;
}

// ═══════════════════════════════════════════════════════════════════════════
// FÜR DIE KACHELN: gebuchtes Geld nach einem Kontakt (E-244)
// Dieselbe Geld-Quelle wie die Bilanz. Vorher lasen beide Kacheln a.paid_at
// bzw. gemeldete Zahlungen — das zeigte 0 statt 4 und 1 statt 0.
// ═══════════════════════════════════════════════════════════════════════════
/** Die Abfrage hinter aktionWirkung14 (ohne Parameter). */
export function aktionWirkungSql(): string {
  return `
      WITH m AS (
        SELECT x.* FROM fiaon_mara_aktion x LEFT JOIN fiaon_persons p ON p.id = x.person_id
         WHERE x.status = 'gesendet' AND x.gesendet_am > NOW() - INTERVAL '14 days' AND p.ist_test_am IS NULL),
      geld AS (SELECT * FROM (${geldSql()}) g0 WHERE g0.am > NOW() - INTERVAL '28 days'),
      -- KEIN DISTINCT (E-244, Gesamtdurchsicht): Raten tragen bezahlt_am als
      -- <Eingangstag>T12:00Z — zwei gleiche Raten am selben Tag wären sonst EINE
      -- Zeile. EXISTS verdoppelt ohnehin nicht.
      gm AS (
        SELECT g.person_id, g.cents FROM geld g
         WHERE EXISTS (SELECT 1 FROM m WHERE m.person_id = g.person_id AND ${danachSql("g", "m.gesendet_am")}))
      SELECT (SELECT COUNT(*)::int FROM m) AS gesendet,
             (SELECT COUNT(DISTINCT person_id)::int FROM m) AS menschen,
             (SELECT COUNT(DISTINCT m.person_id)::int FROM m WHERE EXISTS (
                SELECT 1 FROM fiaon_postmeister pm WHERE pm.person_id = m.person_id AND pm.empfangen_am > m.gesendet_am)) AS antworten,
             (SELECT COUNT(DISTINCT m.person_id)::int FROM m WHERE EXISTS (
                SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND a.claimed_paid_at > m.gesendet_am
                   AND a.claimed_paid_at <= m.gesendet_am + INTERVAL '${NACH_TAGEN} days')) AS gemeldet,
             (SELECT COUNT(DISTINCT person_id)::int FROM gm) AS bezahlt,
             (SELECT COALESCE(SUM(cents), 0)::bigint FROM gm) AS bezahlt_cents,
             (SELECT COUNT(*)::int FROM fiaon_mara_aktion WHERE status = 'abgelehnt' AND created_at > NOW() - INTERVAL '14 days') AS abgelehnt,
             (SELECT COUNT(*)::int FROM fiaon_mara_aktion WHERE status = 'fehler' AND created_at > NOW() - INTERVAL '14 days') AS fehler,
             (SELECT COUNT(*)::int FROM fiaon_mara_ausschluss) AS ausgeschlossen
    `;
}

/** Die Abfrage hinter waWirkung7 (ohne Parameter). */
export function waWirkungSql(): string {
  return `
    WITH gesendet AS (
      SELECT x.person_id, MIN(x.erstellt_am) AS am FROM fiaon_wa_aktion x
        JOIN fiaon_persons p ON p.id = x.person_id AND p.ist_test_am IS NULL
       WHERE x.ok AND x.erstellt_am > NOW() - INTERVAL '7 days' AND x.person_id IS NOT NULL GROUP BY x.person_id
    ),
    geld AS (SELECT * FROM (${geldSql()}) g0 WHERE g0.am > NOW() - INTERVAL '7 days' AND g0.person_id IN (SELECT person_id FROM gesendet))
    SELECT COUNT(*)::int AS menschen,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_whatsapp w WHERE w.person_id = g.person_id AND w.richtung = 'rein' AND w.created_at > g.am))::int AS geantwortet,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications ap WHERE ap.person_id = g.person_id AND ap.merged_into IS NULL AND NOT ap.ist_entwurf AND ap.created_at > g.am))::int AS antrag,
           COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM geld gd WHERE gd.person_id = g.person_id AND ${danachSql("gd", "g.am")}))::int AS gezahlt,
           (SELECT COALESCE(SUM(gd.cents), 0) FROM geld gd JOIN gesendet g2 ON g2.person_id = gd.person_id
             WHERE ${danachSql("gd", "g2.am")})::bigint AS gezahlt_cents
      FROM gesendet g`;
}

/** Steuerpult, Reiter Mail: Mails der letzten 14 Tage und was danach kam. */
export async function aktionWirkung14(lauf: Lauf = sqlPool): Promise<Record<string, number>> {
  const [z] = (await lauf.unsafe(aktionWirkungSql())) as any[];
  const aus: Record<string, number> = {};
  for (const [k, v] of Object.entries(z ?? {})) aus[k] = n(v);
  return aus;
}

/** WA-Zentrale, Kachel „Wirkung 7 Tage": Menschen mit einer Vorlage aus der Zentrale in 7 Tagen. */
export async function waWirkung7(lauf: Lauf = sqlPool): Promise<{ menschen: number; geantwortet: number; antrag: number; gezahlt: number; gezahlt_cents: number }> {
  const [z] = (await lauf.unsafe(waWirkungSql())) as any[];
  return { menschen: n(z?.menschen), geantwortet: n(z?.geantwortet), antrag: n(z?.antrag), gezahlt: n(z?.gezahlt), gezahlt_cents: n(z?.gezahlt_cents) };
}
