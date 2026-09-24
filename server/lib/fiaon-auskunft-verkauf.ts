// ═══════════════════════════════════════════════════════════════════════════
// DER VERKAUFSTAKT DER BONITÄTSAUSKUNFT (24.09.2026, E-240)
//
// Justin: Die Auskunft soll „weggehen wie warme Semmeln" — Ziel 150 am Tag.
// Gemessen am 24.09.: 414 Menschen mit laufendem Paket, davon 273 ohne jede
// Auskunft (nicht bezahlt, nicht bestellt, kein Dokument, keine Analyse). Seit
// dem 22.08. kann niemand sie mehr per Knopf kaufen, und niemand bietet sie an.
//
// ── WAS DER TAKT TUT ──────────────────────────────────────────────────────
// Höchstens DREI Berührungen je Mensch, in dieser Reihenfolge:
//   1. Mail „auskunft_angebot" (Fassung a) — sofort, wenn er in die Menge fällt.
//   2. WhatsApp-Vorlage fiaon_kk_auskunft — frühestens 3 Tage nach der Mail,
//      nur mit nachgewiesener WhatsApp-Einwilligung (Meta-Formular oder er hat
//      uns selbst geschrieben) und nur, wenn Meta die Vorlage freigegeben hat.
//      Gesendet wird über die WA-Zentrale (Gruppe „auskunft_fehlt") — mit
//      allen ihren Regeln (eine Nachricht am Tag, STOPP, Meta-Tagesraum).
//   3. Zweite Mail (Fassung b) — frühestens 7 Tage nach der ersten und 3 Tage
//      nach der letzten Berührung.
// Ende, ohne Zählung: Kauf (auch nur bestellt), Upload, Analyse, Werbesperre,
// „STOPP", Kündigung, Vertragsende, Vertriebssperre — wer eines davon hat,
// fällt aus der Grundmenge und wird nie wieder angeschrieben.
//
// ── DIE RECHTSSCHRANKE: § 7 ABS. 3 UWG ────────────────────────────────────
// Werbung per E-Mail oder WhatsApp an Bestandskunden ohne Einwilligung ist
// nur erlaubt, wenn der Kunde bei der Erhebung der Adresse klar auf sein
// Widerspruchsrecht hingewiesen wurde (Nr. 4). Dieser Hinweis steht erst seit
// dem 02.09.2026 12:35 im Antrag. Automatisch angeschrieben wird deshalb NUR,
// wessen ERSTER Antrag danach angelegt wurde (dort gab er die Adresse an —
// strenger als „erstes bezahltes Paket" und strenger als die Tür im Mail-Motor,
// siehe ERSTER_ANTRAG_SQL: Wen der Takt wählt, lässt die Tür immer durch). Ein Feld für eine
// ausdrückliche Werbe-Einwilligung gibt es nicht (geprüft 24.09.: nur
// consent_agb/_contract/_schufa, fiaon_consents = Kontoauszug-Verarbeitung,
// fiaon_leads.einwilligung = Kontakt zur Anfrage) — die übrigen werden nur
// GEZÄHLT. Sie erreicht das Angebot im Kundenbereich, über ihren Betreuer
// und über Mara, sobald sie selbst schreiben. Gemessen am 24.09.: Pool 214,
// davon 3 nach dem Stichtag.
//
// ── DIE BREMSEN (Muster fiaon-rueckholung.ts) ─────────────────────────────
//   · auskunft_verkauf_an = 0 (Standard): Der Takt tut NICHTS. Ein Merge löst
//     keine Welle aus.
//   · auskunft_verkauf_pro_tag (Standard 50): Deckel für Mails UND WhatsApp
//     zusammen, je Berliner Kalendertag.
//   · Nachtruhe 8–20 Uhr Berlin — über formatToParts. NIE Number(Intl.format()):
//     Das ergab am 02.09. NaN, und NaN war weder Nacht noch Tag (neun Mails
//     um 01:17 aus der Rückholung).
//   · Rücksicht wie bei Maras Aktion: schrieb selbst in 7 Tagen, Mitarbeiter
//     in 12 h dran, andere Mail in 6 h, Unterlagen-Mail mit Angebot in 3 Tagen,
//     Fehlversuch in 24 h, „Stopp" im Postfach, storniert — dann heute nicht.
//   · Die gemeinsame Bremse (Integration 25.09.2026, zuletztAngeboten in
//     fiaon-auskunft.ts): ein Angebot über irgendeinen Weg in 3 Tagen — dann nicht.
//   · Die Tür im Mail-Motor (make-webhook.ts) prüft Werbesperre und § 7 Abs. 3
//     noch einmal selbst — zwei Stellen, damit ein Umbau hier sie nicht aushebelt.
//
// Versand ausschließlich über versendenUndProtokollieren (Mail) und die
// WA-Zentrale (WhatsApp) — jede Berührung steht im Mail- bzw. WA-Protokoll und
// als Vermerk in der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { PAKETE } from "@shared/fiaon-pakete";
import {
  auskunftLand, auskunftWort, auskunfteienText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { WHATSAPP_EINWILLIGUNG_SQL } from "@shared/fiaon-whatsapp-erlaubnis";
import { ANGEBOT_ABSTAND_TAGE, ANGEBOT_WEG_TEXT, angebotSpurenSql, zuletztAngeboten } from "./fiaon-auskunft";

type Lauf = typeof sqlPool;

// ───────────────────────────────────────────────────────────────────────────
// Feste Werte
// ───────────────────────────────────────────────────────────────────────────

/** Seit hier steht der Widerspruchs-Hinweis im Antrag (§ 7 Abs. 3 Nr. 4 UWG). */
export const UWG_STICHTAG = "2026-09-02T12:35:00+02:00";
export const ANGEBOT_EVENT = "auskunft_angebot";
export const WA_GRUPPE = "auskunft_fehlt";

export const SCHALTER_AN = "auskunft_verkauf_an";
export const SCHALTER_PRO_TAG = "auskunft_verkauf_pro_tag";
export const STANDARD_PRO_TAG = 50;
/** Obergrenze des Deckels — über 500 Werbemails am Tag an Bestandskunden wäre ein Spam-Risiko für jede Rechnung von fiaon.com. */
export const HOECHSTENS_PRO_TAG = 500;

export const HOECHSTENS_BERUEHRUNGEN = 3;
const TAGE_BIS_WHATSAPP = 3;
const TAGE_BIS_ZWEITE_MAIL = 7;
const MINDESTABSTAND_TAGE = 3;
const RUHE_BIS = 8, RUHE_AB = 20;

// ───────────────────────────────────────────────────────────────────────────
// Die SQL-Bausteine — EINE Definition für Takt, Chefseite und WA-Gruppe
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
 * auskunftStand „nichts" — und strenger: Auch eine Analyse oder eine archivierte
 * Auskunft (frueher_schufa) heißt „hat eine". Lieber einen Kauf verpassen als
 * jemandem die Auskunft verkaufen, die er uns schon gegeben hat.
 * `person` ist der SQL-Ausdruck für die Personen-ID.
 */
export const OHNE_AUSKUNFT_SQL = (person: string) => `(
  NOT EXISTS (SELECT 1 FROM fiaon_applications ax_s WHERE ax_s.person_id = ${person} AND ax_s.merged_into IS NULL
                AND ${IST_AUSKUNFT("ax_s")} AND ax_s.payment_status IN ('paid', 'pending_payment', 'claimed_paid'))
  AND NOT EXISTS (SELECT 1 FROM fiaon_applications ax_d WHERE ax_d.person_id = ${person} AND ax_d.gdpr_deleted_at IS NULL AND ax_d.schufa_pdf IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM fiaon_schufa_analysen ax_a WHERE ax_a.person_id = ${person})
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
 * Hinweis „bei Erhebung der Adresse" (§ 7 Abs. 3 Nr. 4 UWG). Das ist strenger als
 * „erstes bezahltes Paket nach dem Stichtag" (gemessen 24.09.: genau ein Mensch
 * liegt dazwischen) — und seit dem Gegenlesen 24.09. DIESELBE Lesart wie die Tür
 * im Mail-Motor (fiaon-mail-frequenz.ts: personSperren → kundeMitHinweis, ebenfalls
 * über den ersten Antrag; sperrUrteil verlangt ihn fürs automatische Angebot).
 * Korrigiert 25.09.2026 (E-240): Hier stand, die Tür prüfe weiter („ein laufendes
 * Paket aus einem Antrag ab dem Stichtag") — das war die erste Fassung der Tür.
 * So wählt der Takt nie jemanden, den die Tür jeden Tag wieder abweist — und bei
 * einer Rechtsfrage entscheidet im Zweifel die engere Lesart.
 * created_at ist ohne Zeitzone; der Cast nimmt die der Sitzung, wie beim Schreiben.
 *
 * Gegenlesen 24.09.2026: MIT zusammengeführten Anträgen (merged_into gesetzt).
 * Ein Doppel-Antrag von vor dem Stichtag ist auch eine Erhebung der Adresse —
 * und die Tür (personSperren, erster_antrag) zählt ihn ebenfalls mit. Mit dem
 * Filter „merged_into IS NULL" war der Takt in genau diesem Fall WEITER als die
 * Tür und hätte jemanden gewählt, den sie abweist (gemessen 24.09.: 0 Fälle).
 */
export const ERSTER_ANTRAG_SQL = (person: string) => `(
  SELECT MIN(ax_e.created_at::timestamptz) FROM fiaon_applications ax_e
   WHERE ax_e.person_id = ${person})`;

/** § 7 Abs. 3 UWG: erster Antrag NACH dem Widerspruchs-Hinweis im Antrag. */
export const NACH_STICHTAG_SQL = (person: string) => `(${ERSTER_ANTRAG_SQL(person)} >= '${UWG_STICHTAG}'::timestamptz)`;

/**
 * Für die WA-Zentrale (Gruppe „auskunft_fehlt"): laufendes Paket, keine
 * Auskunft, nicht gekündigt, nicht Global. Test, Sperre, Werbesperre, STOPP
 * prüft die BASIS der Zentrale selbst.
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
 * dieselbe, die auskunftWhatsAppSenden in der WA-Zentrale prüft. Gegenlesen 24.09.2026: vorher eine
 * wortgleiche Abschrift hier — zwei Fassungen laufen beim nächsten Umbau auseinander.
 */
const WA_EINWILLIGUNG_SQL = WHATSAPP_EINWILLIGUNG_SQL;

/**
 * DIE GRUNDMENGE, mit allen Merkmalen, die Takt und Chefseite brauchen.
 * Eine Zeile je Mensch. `ax_flag` ist die fertige Tabelle.
 */
const POOL_CTE = `
WITH ax_lauf AS (
  SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, LOWER(TRIM(a.pack_key)) AS pack_key,
         NULLIF(TRIM(a.email), '') AS antrag_email, NULLIF(TRIM(a.first_name), '') AS antrag_vorname,
         NULLIF(TRIM(a.last_name), '') AS antrag_nachname
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND ${LAUFENDES_PAKET_SQL("a")}
   ORDER BY a.person_id, a.paid_at DESC NULLS LAST, a.created_at DESC
),
ax_mail AS (
  SELECT person_id, COUNT(*)::int AS n, MIN(created_at) AS erste, MAX(created_at) AS letzte
    FROM fiaon_mail_log
   WHERE event = '${ANGEBOT_EVENT}' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt' AND person_id IS NOT NULL
   GROUP BY 1
),
ax_wa AS (
  SELECT person_id, MAX(erstellt_am) AS am, bool_or(ok) AS ok
    FROM fiaon_wa_aktion WHERE gruppe = '${WA_GRUPPE}' AND person_id IS NOT NULL
   GROUP BY 1
),
-- MATERIALIZED: Ohne das rechnete der Planer die Liste für JEDEN Menschen neu
-- (358 × 22 ms Seq Scan = 7,9 s, gemessen 24.09. lesend in der Produktion).
ax_kaputt AS MATERIALIZED (
  SELECT DISTINCT LOWER(TRIM(empfaenger)) AS adr FROM fiaon_mail_log
   WHERE zustellung IN ('gebounct', 'blockiert', 'spam') AND empfaenger IS NOT NULL
),
-- Gegenlesen 24.09.2026: Die Werbesperre gilt für die ADRESSE, nicht nur für die Person
-- (werbesperreAnAdresse in fiaon-mail-frequenz.ts — die Tür im Mail-Motor prüft genau so).
-- Ohne diese Liste wählte der Takt jeden Tag wieder jemanden, dessen Adresse an einer
-- zweiten, gesperrten Person hängt, und die Tür wies ihn jeden Tag ab.
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
),
ax_pool AS (
  SELECT l.person_id, l.ref, l.pack_key,
         CASE WHEN l.pack_key LIKE 'business_%' THEN 'firma' ELSE 'privat' END AS art,
         COALESCE(NULLIF(TRIM(p.first_name), ''), l.antrag_vorname) AS vorname,
         COALESCE(NULLIF(TRIM(p.last_name), ''), l.antrag_nachname) AS nachname,
         COALESCE(NULLIF(TRIM(p.primary_email), ''), l.antrag_email) AS email,
         NULLIF(TRIM(p.primary_phone), '') AS telefon,
         (SELECT c.country FROM fiaon_applications c WHERE c.person_id = l.person_id AND c.merged_into IS NULL AND c.country IS NOT NULL
           ORDER BY (c.payment_status = 'paid') DESC, c.created_at DESC LIMIT 1) AS land_roh,
         ${ERSTER_ANTRAG_SQL("l.person_id")} AS erster_antrag_am,
         p.werbung_gesperrt_am, p.assigned_agent_id,
         COALESCE(m.n, 0) AS n_mail, m.erste AS erste_mail_am, m.letzte AS letzte_mail_am,
         w.am AS wa_am, (w.person_id IS NOT NULL) AS wa_versucht, COALESCE(w.ok, FALSE) AS wa_ok
    FROM ax_lauf l
    JOIN fiaon_persons p ON p.id = l.person_id
    LEFT JOIN ax_mail m ON m.person_id = l.person_id
    LEFT JOIN ax_wa w ON w.person_id = l.person_id
   WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT COALESCE(p.is_blocked, FALSE)
     AND ${OHNE_AUSKUNFT_SQL("l.person_id")}
     AND ${NICHT_GEKUENDIGT_SQL("l.person_id")}
     AND ${NICHT_GLOBAL_SQL("l.person_id")}
),
ax_flag AS (
  SELECT x.*,
         (x.erster_antrag_am >= '${UWG_STICHTAG}'::timestamptz) AS nach_stichtag,
         (x.werbung_gesperrt_am IS NOT NULL
          OR EXISTS (SELECT 1 FROM ax_gesperrt g WHERE g.adr = LOWER(TRIM(x.email)))) AS werbesperre,
         ${WA_STOPP_SQL("x.person_id")} AS wa_stopp,
         (x.email IS NOT NULL AND x.email LIKE '%_@_%._%'
          AND NOT EXISTS (SELECT 1 FROM ax_kaputt u WHERE u.adr = LOWER(TRIM(x.email)))) AS zustellbar,
         (x.telefon IS NOT NULL AND ${WA_EINWILLIGUNG_SQL("x.person_id")}) AS wa_einwilligung,
         GREATEST(x.letzte_mail_am, x.wa_am) AS letzte_beruehrung,
         (x.n_mail + CASE WHEN x.wa_ok THEN 1 ELSE 0 END) AS beruehrungen
    FROM ax_pool x
)`;

/** Für den Prüfstand: dieselbe Grundmenge als Text, um sie lesend gegen die Produktion zu zählen. */
export const VERKAUF_POOL_SQL = POOL_CTE;

/** Wer automatisch angeschrieben werden DARF (ohne die Tagesrücksicht). */
export const AUTOMATISCH_SQL = `f.nach_stichtag AND NOT f.werbesperre AND NOT f.wa_stopp AND f.zustellbar`;

/**
 * Die Rücksicht des Tages — wie Maras Aktion (fiaon-mara-aktion.ts). Nur für den
 * Versand; die Zählung auf der Chefseite zeigt die Menge ohne sie.
 */
export const RUECKSICHT_SQL = `
  -- „Stopp" per Antwort ans Postfach, egal wann (flags teils als JSON-Text — Textvergleich, nie ein Cast)
  AND NOT EXISTS (SELECT 1 FROM fiaon_postmeister pm WHERE pm.person_id = f.person_id AND pm.flags::text ~ 'stopp\\\\?"\\s*:\\s*true')
  -- in der Telefonkartei storniert
  AND NOT EXISTS (SELECT 1 FROM fiaon_telefonkartei_storno ts WHERE ts.person_id = f.person_id AND ts.zurueck_am IS NULL)
  -- er hat selbst geschrieben: Mara antwortet im Postfach (und verkauft dort), der Takt wartet 7 Tage
  AND NOT EXISTS (SELECT 1 FROM fiaon_postmeister ps WHERE ps.person_id = f.person_id AND ps.empfangen_am > NOW() - INTERVAL '7 days')
  AND NOT EXISTS (SELECT 1 FROM fiaon_whatsapp wr WHERE wr.person_id = f.person_id AND wr.richtung = 'rein' AND wr.created_at > NOW() - INTERVAL '48 hours')
  -- ein Mitarbeiter war in den letzten 12 h dran
  AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log ck WHERE ck.person_id = f.person_id AND ck.agent_id IS NOT NULL
                    AND ck.voided_at IS NULL AND ck.created_at > NOW() - INTERVAL '12 hours')
  -- eine andere Mail ist in den letzten 6 h raus
  AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log ml WHERE ml.person_id = f.person_id AND COALESCE(ml.art, 'echt') = 'echt'
                    AND ml.status = 'versandt' AND ml.created_at > NOW() - INTERVAL '6 hours')
  -- die Unterlagen-Mail trägt das Angebot schon (E-240) — nicht zweimal in drei Tagen
  AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log du WHERE du.person_id = f.person_id AND du.event = 'documents_change_request'
                    AND du.status = 'versandt' AND du.created_at > NOW() - INTERVAL '3 days')
  -- ein Fehlversuch dieses Angebots: heute nicht noch einmal (sonst hinge der Takt alle 30 Minuten an denselben)
  AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log fx WHERE fx.person_id = f.person_id AND fx.event = '${ANGEBOT_EVENT}'
                    AND fx.status <> 'versandt' AND fx.created_at > NOW() - INTERVAL '24 hours')
  -- Integration 25.09.2026 (E-240): die gemeinsame Bremse — ein Angebot über irgendeinen Weg (auch Mara,
  -- WhatsApp-Vorlage von Hand) in den letzten ${ANGEBOT_ABSTAND_TAGE} Tagen, dann heute nicht (fiaon-auskunft.ts).
  AND NOT EXISTS (SELECT 1 FROM (${angebotSpurenSql("f.person_id")}) ap_spur)`;

// ───────────────────────────────────────────────────────────────────────────
// Schalter und Uhr
// ───────────────────────────────────────────────────────────────────────────

async function zahl(schluessel: string, standard: number, lauf: Lauf = sqlPool): Promise<number> {
  try {
    const [r] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    if (r?.value === undefined || r?.value === null || String(r.value).trim() === "") return standard;
    const n = Number(String(r.value).trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : standard;
  } catch { return standard; }
}

export interface VerkaufSchalter { an: boolean; proTag: number }

export async function verkaufSchalter(lauf: Lauf = sqlPool): Promise<VerkaufSchalter> {
  const [an, proTag] = await Promise.all([zahl(SCHALTER_AN, 0, lauf), zahl(SCHALTER_PRO_TAG, STANDARD_PRO_TAG, lauf)]);
  return { an: an === 1, proTag: Math.min(HOECHSTENS_PRO_TAG, proTag) };
}

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

/** Senden erlaubt? 08:00 bis 19:59 Berlin. */
export function istSendezeit(jetzt: Date = new Date()): boolean {
  const m = berlinMinuten(jetzt);
  return m >= RUHE_BIS * 60 && m < RUHE_AB * 60;
}

// ───────────────────────────────────────────────────────────────────────────
// Die Zählung (Chefseite)
// ───────────────────────────────────────────────────────────────────────────

export interface PoolZahlen {
  /** Laufendes Paket, keine Auskunft, nicht gekündigt/Global/Test/gesperrt. */
  gesamt: number;
  werbesperre: number;
  /** STOPP auf WhatsApp — zählt für den Takt wie ein Widerspruch. */
  waStopp: number;
  /** Werbesperre ODER STOPP — jeder Mensch einmal gezählt. */
  widerspruch: number;
  nichtZustellbar: number;
  nachStichtag: number;
  /** Nach § 7 Abs. 3 UWG automatisch anschreibbar: nach Stichtag, ohne Sperre, zustellbar. */
  automatisch: number;
  /** Ohne Werbesperre und zustellbar, aber vor dem Stichtag Kunde geworden — nur gezählt. */
  nurGezaehlt: number;
  mitWhatsAppEinwilligung: number;
  schonAngeschrieben: number;
  fertig: number;
  jeLand: { land: AuskunftLand; gesamt: number; automatisch: number; werbesperre: number }[];
}

export async function poolZahlen(lauf: Lauf = sqlPool): Promise<PoolZahlen> {
  await tabellenBereit();
  const zeilen = (await lauf.unsafe(`${POOL_CTE}
    SELECT UPPER(COALESCE(f.land_roh, 'DE')) AS land_roh,
           COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE f.werbesperre)::int AS werbesperre,
           COUNT(*) FILTER (WHERE f.wa_stopp)::int AS wa_stopp,
           COUNT(*) FILTER (WHERE f.werbesperre OR f.wa_stopp)::int AS widerspruch,
           COUNT(*) FILTER (WHERE NOT f.zustellbar)::int AS nicht_zustellbar,
           COUNT(*) FILTER (WHERE f.nach_stichtag)::int AS nach_stichtag,
           COUNT(*) FILTER (WHERE ${AUTOMATISCH_SQL})::int AS automatisch,
           COUNT(*) FILTER (WHERE NOT f.nach_stichtag AND NOT f.werbesperre AND NOT f.wa_stopp AND f.zustellbar)::int AS nur_gezaehlt,
           COUNT(*) FILTER (WHERE f.wa_einwilligung)::int AS wa_einwilligung,
           COUNT(*) FILTER (WHERE f.beruehrungen > 0)::int AS angeschrieben,
           COUNT(*) FILTER (WHERE f.n_mail >= 2 OR f.beruehrungen >= ${HOECHSTENS_BERUEHRUNGEN})::int AS fertig
      FROM ax_flag f
     GROUP BY 1`)) as any[];
  const summe = (k: string) => zeilen.reduce((s, z) => s + Number(z[k] || 0), 0);
  const jeLand = new Map<AuskunftLand, { land: AuskunftLand; gesamt: number; automatisch: number; werbesperre: number }>();
  for (const z of zeilen) {
    // BG, HU … laufen wie Deutschland (auskunftLand) — sie beantragen deutsche Karten.
    const land = auskunftLand(z.land_roh);
    const e = jeLand.get(land) ?? { land, gesamt: 0, automatisch: 0, werbesperre: 0 };
    e.gesamt += Number(z.gesamt || 0); e.automatisch += Number(z.automatisch || 0); e.werbesperre += Number(z.werbesperre || 0);
    jeLand.set(land, e);
  }
  return {
    gesamt: summe("gesamt"), werbesperre: summe("werbesperre"), waStopp: summe("wa_stopp"), widerspruch: summe("widerspruch"),
    nichtZustellbar: summe("nicht_zustellbar"), nachStichtag: summe("nach_stichtag"),
    automatisch: summe("automatisch"), nurGezaehlt: summe("nur_gezaehlt"),
    mitWhatsAppEinwilligung: summe("wa_einwilligung"), schonAngeschrieben: summe("angeschrieben"), fertig: summe("fertig"),
    jeLand: (["DE", "AT", "CH"] as AuskunftLand[]).map((l) => jeLand.get(l) ?? { land: l, gesamt: 0, automatisch: 0, werbesperre: 0 }),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Wer ist heute dran?
// ───────────────────────────────────────────────────────────────────────────

export type Schritt = "mail1" | "whatsapp" | "mail2";

export interface VerkaufFall {
  personId: number;
  ref: string;
  art: AuskunftArt;
  land: AuskunftLand;
  vorname: string | null;
  nachname: string | null;
  email: string;
  nMail: number;
  waVersucht: boolean;
  waEinwilligung: boolean;
  /** Frühestens 7 Tage nach der ersten Mail und 3 nach der letzten Berührung. */
  mail2Reif: boolean;
  ersteMailAm: string | null;
  letzteBeruehrung: string | null;
  ersterAntragAm: string | null;
}

function fallAusZeile(z: any): VerkaufFall {
  return {
    personId: Number(z.person_id), ref: String(z.ref),
    art: z.art === "firma" ? "firma" : "privat",
    land: auskunftLand(z.land_roh),
    vorname: z.vorname ?? null, nachname: z.nachname ?? null, email: String(z.email),
    nMail: Number(z.n_mail || 0), waVersucht: !!z.wa_versucht, waEinwilligung: !!z.wa_einwilligung,
    mail2Reif: !!z.mail2_reif,
    ersteMailAm: z.erste_mail_am ? new Date(z.erste_mail_am).toISOString() : null,
    letzteBeruehrung: z.letzte_beruehrung ? new Date(z.letzte_beruehrung).toISOString() : null,
    ersterAntragAm: z.erster_antrag_am ? new Date(z.erster_antrag_am).toISOString() : null,
  };
}

/**
 * Die Kandidaten des Tages, versandfertig gefiltert. Zuerst die Folgeschritte
 * (wer schon eine Mail hat), dann neue — die frischesten Kunden zuerst.
 * `waMoeglich` = die Vorlage ist bei Meta frei und WhatsApp eingerichtet; ohne
 * das zählen nur Menschen, deren zweite Mail reif ist, als Folgeschritt.
 */
export async function kandidatenHeute(limit: number, opts: { waMoeglich: boolean; nurPersonen?: number[] | null }, lauf: Lauf = sqlPool): Promise<VerkaufFall[]> {
  await tabellenBereit();
  const nur = (opts.nurPersonen ?? []).filter((x) => Number.isInteger(x));
  const zeilen = (await lauf.unsafe(`${POOL_CTE}
    SELECT f.*,
           (f.n_mail = 1 AND f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_ZWEITE_MAIL} days'
             AND f.letzte_beruehrung <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days') AS mail2_reif
      FROM ax_flag f
     WHERE ${AUTOMATISCH_SQL}
       AND f.n_mail < 2 AND f.beruehrungen < ${HOECHSTENS_BERUEHRUNGEN}
       AND (
         -- Gegenlesen 24.09.2026: Auch die erste Mail hält Abstand zu einer WhatsApp dieser Gruppe,
         -- die jemand in der WA-Zentrale von Hand geschickt hat — sonst kämen Vorlage und Mail am selben Tag.
         (f.n_mail = 0 AND (f.wa_am IS NULL OR f.wa_am <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days'))
         OR (f.n_mail = 1 AND f.letzte_beruehrung <= NOW() - INTERVAL '${MINDESTABSTAND_TAGE} days' AND (
               f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_ZWEITE_MAIL} days'
               OR ($1::boolean AND NOT f.wa_versucht AND f.wa_einwilligung
                   AND f.erste_mail_am <= NOW() - INTERVAL '${TAGE_BIS_WHATSAPP} days')))
       )
       ${RUECKSICHT_SQL}
       ${nur.length ? "AND f.person_id = ANY($3::int[])" : ""}
     ORDER BY (f.n_mail = 1) DESC, f.erster_antrag_am DESC NULLS LAST, f.person_id ASC
     LIMIT $2`, nur.length ? [opts.waMoeglich, Math.max(0, Math.floor(limit)), nur] : [opts.waMoeglich, Math.max(0, Math.floor(limit))])) as any[];
  return zeilen.map(fallAusZeile);
}

/** Welcher Schritt für diesen Fall dran ist — oder null (warten). */
export function schrittFuer(f: VerkaufFall, waMoeglich: boolean): Schritt | null {
  if (f.nMail === 0) return "mail1";
  if (f.nMail >= 2) return null;
  if (waMoeglich && !f.waVersucht && f.waEinwilligung) return "whatsapp";
  return f.mail2Reif ? "mail2" : null;
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

/** Die Werte für {{2}}–{{4}} und den Knopf der Vorlage fiaon_kk_auskunft. */
export async function waVorlagenWerte(personId: number, lauf: Lauf = sqlPool): Promise<{ wort: string; bei: string; preis: string; token: string } | null> {
  const [z] = (await lauf.unsafe(`
    SELECT LOWER(TRIM(a.pack_key)) AS pack_key FROM fiaon_applications a
     WHERE a.person_id = $1 AND ${LAUFENDES_PAKET_SQL("a")}
     ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC LIMIT 1`, [personId])) as any[];
  if (!z) return null;
  const art: AuskunftArt = String(z.pack_key || "").startsWith("business_") ? "firma" : "privat";
  const { auskunftStand } = await import("./fiaon-auskunft");
  const stand = await auskunftStand(personId, lauf, art);
  if (stand.stufe !== "nichts") return null;
  // Gegenlesen 24.09.2026: Ein Business-Kunde bekommt die Firmen-Auskunft zum Firmenpreis (199 €) —
  // dann darf der Text nicht nur „Ihre SCHUFA-Auskunft" und die privaten Datenkopien nennen, sonst
  // beschreibt die Nachricht eine andere Leistung als die, die der Knopf beauftragt (auskunftLeistung „firma").
  if (art === "firma") {
    return {
      wort: "Bonitätsauskunft für Ihr Unternehmen",
      bei: `den Wirtschaftsauskunfteien und für Sie persönlich bei ${auskunfteienText(stand.land)}`,
      preis: stand.preis.text, token: await kaufKurzToken(personId, art),
    };
  }
  return { wort: auskunftWort(stand.land), bei: auskunfteienText(stand.land), preis: stand.preis.text, token: await kaufKurzToken(personId, art) };
}

/**
 * Die Nutzlast für auskunft_angebot — aus der EINEN Stelle, die sie baut
 * (auskunftAngebotNutzlast, fiaon-auskunft-lieferung.ts; derselbe Weg wie der
 * Knopf in der Akte): Preis vom Server, Land und Auskunfteien aus der Akte,
 * Fassung im Wechsel nach dem Protokoll (erste Mail a, zweite b), Kauf-,
 * Upload- und Abmeldelink. Dazu die Bestellung, an der der Vermerk hängt.
 * KEINE werbe_grundlage: Der Takt stützt sich auf den Stichtag, und den prüft
 * die Tür selbst (auskunftAngebotSperre) — eine behauptete Grundlage würde ihn
 * dort überspringen. null = keine Adresse.
 */
export async function angebotNutzlast(f: VerkaufFall, lauf: Lauf = sqlPool): Promise<Record<string, unknown> | null> {
  const { auskunftAngebotNutzlast } = await import("./fiaon-auskunft-lieferung");
  const n = await auskunftAngebotNutzlast(f.personId, { art: f.art }, lauf);
  return n ? { ...n, antrag_id: f.ref } : null;
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
  /** Nur bei `trocken`: wer was bekommen hätte. */
  plan?: { personId: number; schritt: Schritt }[];
}

let taktLaeuft = false;
let spaltenBereit: Promise<void> | null = null;

/** fiaon_wa_aktion legt die WA-Zentrale an; ohne sie scheitert die Grundmenge. */
async function tabellenBereit(): Promise<void> {
  if (!spaltenBereit) {
    spaltenBereit = (async () => {
      const { zentraleSchema } = await import("./fiaon-wa-zentrale");
      await zentraleSchema();
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

/** Ist WhatsApp für den Takt überhaupt möglich (eingerichtet und Vorlage bei Meta frei)? */
export async function whatsappMoeglich(): Promise<{ moeglich: boolean; grund: string | null }> {
  try {
    const { waKonfig, freigegebeneVorlagen } = await import("./fiaon-whatsapp");
    if (!waKonfig().bereit) return { moeglich: false, grund: "WhatsApp ist nicht eingerichtet." };
    const { istFrei } = await import("./fiaon-wa-zentrale");
    const { AUSKUNFT_VORLAGE } = await import("@shared/fiaon-lead-texte");
    const frei = await freigegebeneVorlagen().catch(() => new Set<string>());
    return istFrei(AUSKUNFT_VORLAGE, frei)
      ? { moeglich: true, grund: null }
      : { moeglich: false, grund: `Die Vorlage „${AUSKUNFT_VORLAGE}“ ist bei Meta nicht freigegeben — sie liegt als Entwurf bereit.` };
  } catch (e) {
    return { moeglich: false, grund: `WhatsApp-Stand nicht lesbar: ${String((e as Error)?.message || e).slice(0, 120)}` };
  }
}

/**
 * EIN DURCHLAUF (alle 30 Minuten über tageslauf). Ohne Schalter nichts.
 *
 * `trocken` = nur planen, nichts senden (Vorschau der Chefseite).
 * `jetzt` = die Uhr für die Nachtruhe (Prüfstand). `nurPersonen` = Prüfstand.
 * `mitSchalter: false` = den Schalter nicht fragen (nur mit `trocken` sinnvoll:
 * „wer würde heute angeschrieben", auch wenn der Takt aus ist).
 */
export async function verkaufsTakt(opts: {
  trocken?: boolean; jetzt?: Date; nurPersonen?: number[] | null; mitSchalter?: boolean;
} = {}): Promise<TaktErgebnis> {
  const leer = (grund: string): TaktErgebnis => ({ grund, geprueft: 0, mails: 0, whatsapp: 0, uebersprungen: 0, gruende: {} });
  if (!opts.trocken && taktLaeuft) return leer("Takt läuft noch");
  const schalter = await verkaufSchalter();
  if (opts.mitSchalter !== false && !schalter.an) return leer(`abgeschaltet (${SCHALTER_AN} = 0)`);
  if (schalter.proTag <= 0) return leer(`Tagesdeckel 0 (${SCHALTER_PRO_TAG})`);
  if (!opts.trocken && !istSendezeit(opts.jetzt)) return leer("Nachtruhe");

  if (!opts.trocken) taktLaeuft = true;
  try {
    const heute = await beruehrungenHeute();
    let rest = schalter.proTag - heute.gesamt;
    if (rest <= 0) return leer("Tagesdeckel erreicht");

    const wa = await whatsappMoeglich();
    // Etwas mehr holen als nötig — wer an einer Regel scheitert, soll den Platz nicht blockieren.
    const faelle = await kandidatenHeute(rest + 10, { waMoeglich: wa.moeglich, nurPersonen: opts.nurPersonen });
    const erg: TaktErgebnis = { geprueft: faelle.length, mails: 0, whatsapp: 0, uebersprungen: 0, gruende: {}, ...(opts.trocken ? { plan: [] } : {}) };
    const zaehle = (g: string) => { const s = g.slice(0, 120); erg.gruende[s] = (erg.gruende[s] ?? 0) + 1; erg.uebersprungen++; };
    let fehlerInFolge = 0;
    const laufId = `AV${Date.now().toString(36)}`;

    for (const f of faelle) {
      if (rest <= 0) break;
      let schritt = schrittFuer(f, wa.moeglich);
      if (!schritt) { zaehle("wartet auf den nächsten Schritt"); continue; }
      if (opts.trocken) { erg.plan!.push({ personId: f.personId, schritt }); rest--; continue; }
      // Die Uhr läuft weiter — ein langer Lauf endet nicht in der Nacht.
      if (!istSendezeit(opts.jetzt)) { zaehle("Nachtruhe begonnen — Rest nicht gesendet"); break; }

      try {
        // Frisch nachsehen: Hat er gerade gekauft oder hochgeladen? Dann nichts.
        const { auskunftStand } = await import("./fiaon-auskunft");
        const stand = await auskunftStand(f.personId, sqlPool, f.art);
        if (stand.stufe !== "nichts") { zaehle(`Auskunft inzwischen ${stand.stufe}`); continue; }
        // Integration 25.09.2026: die gemeinsame Bremse frisch — zwischen Auswahl und Versand kann Mara
        // oder ein Mitarbeiter angeboten haben. Ein Urteil über diesen Menschen, kein Klemmen.
        const zuletzt = await zuletztAngeboten(f.personId);
        if (zuletzt) { zaehle(`Angebot vor Kurzem (${ANGEBOT_WEG_TEXT[zuletzt.weg]})`); continue; }
        // Die Tür selbst fragen, BEVOR eine Nutzlast entsteht (ihr eigener Wunsch, fiaon-auskunft-lieferung.ts):
        // Werbesperre an irgendeiner Adresse der Person, Testkonto, Kündigung, § 7 Abs. 3. Ein Nein hier ist
        // ein Urteil über DIESEN Menschen, kein Klemmen des Versands — es zählt nicht gegen die Drei-Fehler-Regel.
        const { auskunftAngebotSperre } = await import("./fiaon-auskunft-lieferung");
        const sperre = await auskunftAngebotSperre(f.personId);
        if (sperre) { zaehle(`Tür: ${sperre}`); continue; }

        if (schritt === "whatsapp") {
          const { auskunftWhatsAppSenden } = await import("./fiaon-wa-zentrale");
          const r = await auskunftWhatsAppSenden(f.personId, { laufId, von: "Verkaufstakt" });
          if (r.ok) { erg.whatsapp++; rest--; fehlerInFolge = 0; continue; }
          // WhatsApp heute nicht möglich — ist die zweite Mail reif, geht sie statt dessen.
          if (!f.mail2Reif) { zaehle(`WhatsApp: ${r.grund ?? "nicht möglich"}`); continue; }
          schritt = "mail2";
        }

        const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
        const nutzlast = await angebotNutzlast(f);
        if (!nutzlast) { zaehle("keine zustellbare Adresse"); continue; }
        const nr = f.nMail + 1;
        const v = await versendenUndProtokollieren(ANGEBOT_EVENT as any, nutzlast as any, {
          personId: f.personId,
          verlaufRef: f.ref,
          verlaufText: `Verkaufstakt Bonitätsauskunft: Angebot per E-Mail (${nr}. von höchstens 2 Mails, Fassung ${nutzlast.fassung}, `
            + `${nutzlast.preis_text}${nutzlast.mit_abo ? " Kundenpreis mit Paket" : ""}). Grundlage § 7 Abs. 3 UWG — Kunde seit dem Widerspruchs-Hinweis im Antrag.`,
        });
        if (v.status === "versandt") { erg.mails++; rest--; fehlerInFolge = 0; }
        // E-240 (25.09.2026): Die Tür nennt ihr Urteil jetzt „Sperre: …" (Werbesperre, § 7 UWG, Vertrag) und
        // „Frequenzbremse: …" nur noch für Deckel und Blockade-Ruhe (make-webhook.ts) — beides zählt hier gleich.
        else if (/^(Frequenzbremse|Sperre:)|kein (Auskunft-)?Angebot/.test(String(v.grund ?? ""))) {
          // Gegenlesen 24.09.2026: Die Tür im Mail-Motor („Frequenzbremse: Werbesperre …", „… § 7 Abs. 3 UWG …",
          // „Frequenzbremse-Ruhe …", „… schon bezahlt — kein Angebot") urteilt über DIESEN Empfänger — wie die
          // Tür oben. Zählte das als Fehlschlag, hielten drei solche Menschen am Anfang der Liste jeden Lauf an,
          // und niemand dahinter bekäme je eine Mail.
          zaehle(`Mail: ${v.grund}`);
        } else {
          zaehle(`Mail: ${v.grund ?? v.status}`);
          // Drei Fehlschläge hintereinander heißen: Es klemmt am Versand, nicht am Menschen.
          if (++fehlerInFolge >= 3) { erg.grund = `Versand klemmt (${v.grund ?? v.status}) — Lauf beendet`; break; }
        }
      } catch (e) {
        zaehle(String((e as Error)?.message || e));
        console.error(`[AUSKUNFT-VERKAUF] Person ${f.personId}:`, e);
        if (++fehlerInFolge >= 3) { erg.grund = "Drei Fehler hintereinander — Lauf beendet"; break; }
      }
    }
    if (!opts.trocken && (erg.mails || erg.whatsapp)) {
      console.log(`[AUSKUNFT-VERKAUF] ${erg.mails} Mails, ${erg.whatsapp} WhatsApp (heute ${heute.gesamt + erg.mails + erg.whatsapp}/${schalter.proTag})`);
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
  schritt: Schritt | null;
  mail: string;
  kundeSeit: string | null;
  ersteMailAm: string | null;
}

/**
 * „Wer würde heute angeschrieben" — dieselbe Auswahl wie der Takt, ohne zu
 * senden und ohne den Schalter zu fragen. Adressen gekürzt: Die Seite braucht
 * sie nicht, jede weniger im Netzverkehr ist eine weniger.
 */
export async function vorschauHeute(anzahl = 30): Promise<{ zeilen: VorschauZeile[]; waGrund: string | null; restHeute: number }> {
  const schalter = await verkaufSchalter();
  const heute = await beruehrungenHeute();
  const rest = Math.max(0, schalter.proTag - heute.gesamt);
  const wa = await whatsappMoeglich();
  const faelle = await kandidatenHeute(Math.min(anzahl, Math.max(rest, 1) + 10), { waMoeglich: wa.moeglich });
  return {
    restHeute: rest,
    waGrund: wa.grund,
    zeilen: faelle.slice(0, anzahl).map((f) => ({
      personId: f.personId,
      name: [f.vorname, f.nachname].filter(Boolean).join(" ") || "Ohne Namen",
      land: f.land, art: f.art, schritt: schrittFuer(f, wa.moeglich),
      mail: f.email.replace(/^(.{2}).*(@.*)$/, "$1…$2"),
      kundeSeit: f.ersterAntragAm, ersteMailAm: f.ersteMailAm,
    })),
  };
}
