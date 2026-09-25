// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · AUSKUNFT-VERKAUF — das Backend von /chef/s/auskunft (24.09.2026, E-240)
//
// Justin: Die Bonitätsauskunft soll „weggehen wie warme Semmeln", Ziel 150 am
// Tag. Diese Seite zeigt ehrlich, wo wir stehen — bestellt und bezahlt heute
// gegen das Ziel, die letzten 14 Tage, wer sie noch nicht hat, wer bestellt
// und nicht bezahlt hat, wer bezahlt hat und noch nichts geliefert bekam —
// und sie schaltet den Verkaufstakt (server/lib/fiaon-auskunft-verkauf.ts).
// Jede Zahl ist gezählt, keine geschätzt (Regel des Lagezimmers).
//
// 25.09.2026 (E-241) — Justin: „an ALLE, die keine Auskunft hinterlegt oder
// gekauft haben … jeden Tag 30 per WhatsApp und 500 Mails." Dazu kamen:
//   · die STEUERUNG mit fünf Einstellungen (Schalter, Kreis uwg/alle, Mails je
//     Tag, WhatsApp je Tag, Liefermodus) — jede Änderung im Protokoll
//     (fiaon_admin_log über chefProtokoll: wer, wann, alt → neu);
//   · der TRICHTER heute und je Tag (14 Tage), je Weg und je Segment:
//     angeschrieben → geklickt → bestellt → bezahlt → geliefert, mit Umsatz;
//   · der Zähler der Beschaffung (/chef/s/auskunft-beschaffung).
//
//   GET  /chef/auskunft              der ganze Stand in einer Antwort
//   GET  /chef/auskunft/vorschau     wer als Nächstes angeschrieben würde (nur lesen)
//   POST /chef/auskunft/einstellung  {key, value} — nur die fünf Einstellungen (Erlaubnisliste)
//   POST /chef/auskunft/lieferung    {ref, mail} — die Lieferung einer bezahlten
//                                    Auskunft von Hand starten (Rückstand)
//   GET  /auskunft/k/:token          ÖFFENTLICH: der Knopf der WhatsApp-Vorlage
//
// Ein Startknopf fehlt ABSICHTLICH (wie in der Rückholung): Der Takt läuft
// alle 30 Minuten und gehorcht Schalter und Tagesdeckeln. Wer ihn anhalten
// will, schaltet ihn hier aus.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import { euroText, auskunftLand, auskunfteienText } from "@shared/fiaon-auskunft";
import { katalogpreisCents } from "../lib/fiaon-massgebliche-bestellung";
import { angebotSpurenSql, ANGEBOT_VERMERK } from "../lib/fiaon-auskunft";
import { klicksTabelle, KAUF_LINK_TAGE } from "./fiaon-auskunft-kauf";
import {
  HOECHSTENS_PRO_TAG, HOECHSTENS_WA_PRO_TAG, UWG_STICHTAG, HOECHSTENS_BERUEHRUNGEN, ANGEBOT_EVENT, WA_GRUPPE,
  SCHALTER_AN, SCHALTER_KREIS, SCHALTER_MAILS, SCHALTER_WA, SCHALTER_LIEFERMODUS, SCHALTER_PRO_TAG, SEGMENT_TEXT, SPERRGRUND_TEXT,
  poolZahlen, beruehrungenHeute, whatsappMoeglich, vorschau, istSendezeit, kurzTokenLesen,
  verkaufEinstellungen, einstellungSetzen, type VerkaufEinstellungen,
} from "../lib/fiaon-auskunft-verkauf";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

/** Justins Ziel (24.09.2026): 150 Auskünfte am Tag. */
const ZIEL_PRO_TAG = 150;

const IST_AUSKUNFT = `(COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')`;
/** Bezahlt am — dieselbe Regel wie die Geld-Wahrheit (/chef/zahlen): paid_at, sonst completed_at. */
const BEZAHLT_AM = `COALESCE(a.paid_at, a.completed_at::timestamptz)`;
/** Beginn des ersten der 14 Berliner Tage (heute und 13 davor), als Zeitpunkt. */
const AB_14 = `(((NOW() AT TIME ZONE 'Europe/Berlin')::date - 13)::timestamp AT TIME ZONE 'Europe/Berlin')`;

// ═══════════════════════════════════════════════════════════════════════════
// E-241: DIE STEUERUNG — fünf Einstellungen in fiaon_settings
//
// Die Namen sind für alle E-241-Aufträge dieselben (Takt, Lieferung, Seite):
//   auskunft_verkauf_an              '0' | '1'                      Standard '0'
//   auskunft_verkauf_kreis           'uwg' | 'alle'                 Standard 'uwg'
//   auskunft_verkauf_mails_pro_tag   0 … HOECHSTENS_PRO_TAG         Standard '500'
//                                    (Rückfall: der alte Schlüssel auskunft_verkauf_pro_tag)
//   auskunft_verkauf_wa_pro_tag      0 … HOECHSTENS_WA_PRO_TAG      Standard '30'
//   auskunft_liefermodus             'einkauf' | 'vollmacht' | 'api' Standard 'einkauf'
//
// „alle" ist Justins Entscheidung vom 25.09.2026: Werbe-Mails auch an Kunden
// vor dem 02.09. und an Anträge und Leads — Werbesperre, Abmeldung und
// Vertriebssperre gelten immer (das prüfen der Takt und die Tür im Mail-Motor,
// nicht diese Seite). „einkauf" = bis die Schnittstelle steht, kaufen wir die
// Auskunft selbst ein.
//
// Gelesen und geschrieben wird AUSSCHLIESSLICH über verkaufEinstellungen und
// einstellungSetzen des Takts (fiaon-auskunft-verkauf.ts) — EINE Erlaubnisliste,
// EINE Prüfung der Werte, dieselben Standards. Diese Datei fügt nur hinzu, was
// die Seite braucht: den Namen der Einstellung fürs Protokoll und die Rohwerte
// davor und danach (alt → neu).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die fünf Schlüssel, die die Seite schreiben darf — mit Namen und dem WIRKSAMEN
 * Wert fürs Protokoll (aus verkaufEinstellungen, also mit Standard und Rückfall).
 * Gegenlesen 25.09.2026 (E-241): Vorher stand bei nicht gesetzten Zahlen nur
 * „Standard → 250" — welcher Wert davor galt (500? der alte Schlüssel?), sah
 * niemand. Jetzt „Mails je Tag: 500 (Standard) → 250".
 */
const STEUERUNG: Record<string, { name: string; wert: (e: VerkaufEinstellungen) => string }> = {
  [SCHALTER_AN]: { name: "Verkaufstakt", wert: (e) => (e.an ? "an" : "aus") },
  [SCHALTER_KREIS]: { name: "Kreis", wert: (e) => e.kreis },
  [SCHALTER_MAILS]: { name: "Mails je Tag", wert: (e) => String(e.mailsProTag) },
  [SCHALTER_WA]: { name: "WhatsApp je Tag", wert: (e) => String(e.waProTag) },
  [SCHALTER_LIEFERMODUS]: { name: "Liefermodus", wert: (e) => e.liefermodus },
};

export interface Einstellungen extends VerkaufEinstellungen {
  hoechstensMails: number;
  hoechstensWa: number;
  /** Ist die Schnittstelle (AUSKUNFT_API_URL/-KEY) eingerichtet? Ohne sie bleibt „api" im Einkauf. */
  apiAngebunden: boolean;
}

export async function einstellungenLesen(): Promise<Einstellungen> {
  const e = await verkaufEinstellungen();
  let apiAngebunden = false;
  try { apiAngebunden = (await import("../lib/fiaon-auskunft-quelle")).auskunftApiAngebunden(); } catch { /* ohne Quelle: nicht angebunden */ }
  return { ...e, hoechstensMails: HOECHSTENS_PRO_TAG, hoechstensWa: HOECHSTENS_WA_PRO_TAG, apiAngebunden };
}

/** Der Rohwert eines Schlüssels (null = nicht gesetzt, es gilt der Standard des Takts). */
async function rohWert(key: string): Promise<string | null> {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${key} LIMIT 1`) as any[];
  const v = z?.value == null ? "" : String(z.value).trim();
  return v === "" ? null : v;
}

const PROTOKOLL_ZIEL = "auskunft-einstellung:";

export interface ProtokollZeile { zeit: string; schluessel: string; text: string; wer: string }

/** Die letzten Änderungen der Steuerung — aus fiaon_admin_log (chefProtokoll). */
async function protokollLesen(anzahl = 15): Promise<ProtokollZeile[]> {
  try {
    const zeilen = (await sqlPool`
      SELECT l.zeit, l.ziel, l.notiz, l.stufe, l.agent_id,
             COALESCE(NULLIF(ag.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name)), '')) AS name
        FROM fiaon_admin_log l
        LEFT JOIN fiaon_agents ag ON ag.id = l.agent_id
       WHERE l.ziel LIKE ${PROTOKOLL_ZIEL + "%"}
       ORDER BY l.zeit DESC, l.id DESC
       LIMIT ${anzahl}`) as any[];
    return zeilen.map((z) => ({
      zeit: new Date(z.zeit).toISOString(),
      schluessel: String(z.ziel).slice(PROTOKOLL_ZIEL.length),
      text: String(z.notiz ?? ""),
      wer: z.name ? String(z.name) : z.agent_id ? `Mitarbeiter #${z.agent_id}` : z.stufe === "inhaber" ? "Inhaber (Sammelcode)" : "Chefbüro",
    }));
  } catch {
    // fiaon_admin_log entsteht mit dem ersten Protokolleintrag — vorher gibt es nichts zu zeigen.
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// E-241: DER TRICHTER — angeschrieben → geklickt → bestellt → bezahlt → geliefert
//
// Jede Stufe zählt an dem Berliner Tag, an dem sie GESCHAH (nicht als Kohorte):
// Die Zeile „heute" sagt, was heute passiert ist. Gezählt werden Menschen
// (angeschrieben, geklickt) bzw. Bestellungen (bestellt, bezahlt, geliefert),
// je Tag jeder einmal — auch in der Summe über alle Wege.
//
//   angeschrieben  die Spuren aus angebotSpurenSql (fiaon-auskunft.ts, die EINE
//                  Definition der Angebotswege): Angebots- und Unterlagen-Mail
//                  → Mail, WhatsApp-Vorlage → WhatsApp, Mara per Mail oder
//                  WhatsApp → Mara. Kundenbereich, öffentliche Seite und
//                  Betreuer schreiben nicht an — dort steht „—".
//   geklickt       fiaon_auskunft_klicks (Kauflink geöffnet, fiaon-auskunft-kauf.ts).
//   bestellt       jede Auskunft-Bestellung (ohne stillgelegte Doppel und Tests).
//                  Der Weg steht im Verlauf der Bestellung („… — über kundenbereich."
//                  aus auskunftBestellen, „Kunde (Bestellseite)"); beim Kauflink
//                  der Weg seines letzten Klicks. Ältere Bestellungen aus der Akte
//                  erkennt der alte Vermerk „… auf Kundenwunsch aus der Akte bestellt"
//                  (→ Betreuer); sonst hielt vor dem 25.09. niemand den Weg fest —
//                  solche Bestellungen stehen unter „ohne Herkunft".
//   bezahlt        dieselbe Bestellung am Tag der Zahlung (paid_at, sonst
//                  completed_at — die Regel der Geld-Wahrheit); Umsatz = amount_due.
//   geliefert      dieselbe bezahlte Bestellung am Tag, an dem zum ersten Mal eine
//                  Auskunft in der Akte lag: Dokument „…schufa…", Analyse,
//                  „Datenkopie … eingegangen" (auskunftEingangMelden) oder der
//                  Upload im Arbeitsplatz Beschaffung (fiaon_auskunft_beschaffung).
//
// Das Segment gilt ZUM ZEITPUNKT der Stufe (bei bezahlt/geliefert: der
// Bestellung): kunde = ein bezahltes Paket, antrag = ein Antrag ohne Zahlung,
// lead = kein Antrag (auch jede Bestellung ohne Person von der öffentlichen Seite).
// ═══════════════════════════════════════════════════════════════════════════

export const STUFEN = ["angeschrieben", "geklickt", "bestellt", "bezahlt", "geliefert"] as const;
export type Stufe = (typeof STUFEN)[number];
export const WEGE = ["mail", "whatsapp", "mara", "kundenbereich", "oeffentlich", "betreuer", "unbekannt"] as const;
export type Weg = (typeof WEGE)[number];
export const SEGMENTE = ["kunde", "antrag", "lead"] as const;
export type Segment = (typeof SEGMENTE)[number];
/** Wo „angeschrieben" und „geklickt" überhaupt entstehen können — sonst zeigt die Seite „—". */
const ANSCHREIBENDE_WEGE: Weg[] = ["mail", "whatsapp", "mara"];

const KEIN_AUSKUNFT_PAKET = (a: string) =>
  `NOT (COALESCE(${a}.type, '') = 'schufa' OR ${a}.ref LIKE 'FIAON-SCHUFA-%') AND ${a}.ref NOT LIKE 'FIAON-TEST%'`;

/** Segment eines Menschen zu einem Zeitpunkt (SQL). `person`/`zeit` sind Spaltenausdrücke. */
export const SEGMENT_ZUM_ZEITPUNKT_SQL = (person: string, zeit: string) => `CASE
  WHEN ${person} IS NULL THEN 'lead'
  WHEN EXISTS (SELECT 1 FROM fiaon_applications sg_k WHERE sg_k.person_id = ${person} AND sg_k.merged_into IS NULL
                 AND sg_k.payment_status = 'paid' AND ${KEIN_AUSKUNFT_PAKET("sg_k")}
                 AND COALESCE(sg_k.paid_at, sg_k.completed_at::timestamptz, sg_k.created_at::timestamptz) <= ${zeit}) THEN 'kunde'
  WHEN EXISTS (SELECT 1 FROM fiaon_applications sg_a WHERE sg_a.person_id = ${person} AND ${KEIN_AUSKUNFT_PAKET("sg_a")}
                 AND sg_a.created_at::timestamptz <= ${zeit}) THEN 'antrag'
  ELSE 'lead' END`;

/** Die Klicks als Quelle — für den Lese-Prüfstand gegen die Produktion (dort gibt es die Tabelle noch nicht) austauschbar. */
export const KLICKS_TABELLE = "fiaon_auskunft_klicks";
export const KLICKS_LEER = "(SELECT NULL::int AS person_id, NULL::timestamptz AS zeit, NULL::text AS weg WHERE FALSE)";

/**
 * Die Trichter-Abfrage: eine Zeile je (Tag, Stufe) mit Summe, je (Tag, Stufe,
 * Weg) und je (Tag, Stufe, Segment). Nur lesend. Exportiert für den Prüfstand.
 */
export function trichterSql(klicke: string = KLICKS_TABELLE, mitBeschaffung = false): string {
  if (klicke !== KLICKS_TABELLE && klicke !== KLICKS_LEER) throw new Error("[CHEF-AUSKUNFT] unerlaubte Klick-Quelle");
  // Der Upload im Arbeitsplatz Beschaffung (E-241) — nur, wenn die Lieferung ihre Tabelle schon angelegt hat.
  const beschafft = mitBeschaffung
    ? `UNION ALL
       SELECT bz.hochgeladen_am FROM fiaon_auskunft_beschaffung bz WHERE bz.ref = b.ref AND bz.hochgeladen_am IS NOT NULL`
    : "";
  return `
WITH
-- Wer im Fenster überhaupt eine Angebotsspur haben KÖNNTE (großzügig); gezählt wird unten nach angebotSpurenSql.
sp_personen AS (
  SELECT DISTINCT x.person_id::int AS person_id FROM (
    SELECT m.person_id FROM fiaon_mail_log m
     WHERE m.event IN ('${ANGEBOT_EVENT}', 'documents_change_request') AND m.status = 'versandt' AND m.created_at >= ${AB_14}
    UNION ALL
    SELECT w.person_id FROM fiaon_wa_aktion w WHERE w.gruppe = '${WA_GRUPPE}' AND w.ok AND w.erstellt_am >= ${AB_14}
    UNION ALL
    SELECT c.person_id FROM fiaon_contact_log c
     WHERE c.agent_name = 'Postmeister' AND c.note LIKE '${ANGEBOT_VERMERK}%' AND c.created_at >= ${AB_14}
    UNION ALL
    SELECT x.person_id FROM fiaon_whatsapp x
     WHERE x.richtung = 'raus' AND x.text LIKE '%/auskunft/bestellen?%' AND COALESCE(x.gesendet_am, x.created_at) >= ${AB_14}
  ) x WHERE x.person_id IS NOT NULL
),
angeschrieben AS (
  SELECT sp.person_id, s.am AS zeit,
         CASE s.weg WHEN 'whatsapp_vorlage' THEN 'whatsapp' WHEN 'mara_mail' THEN 'mara' WHEN 'mara_whatsapp' THEN 'mara' ELSE 'mail' END AS weg
    FROM sp_personen sp
   CROSS JOIN LATERAL (${angebotSpurenSql("sp.person_id", 15)}) s
   WHERE s.am >= ${AB_14}
),
klicks AS (
  SELECT k.person_id, k.zeit, k.weg FROM ${klicke} k WHERE k.zeit >= ${AB_14}
),
best AS (
  SELECT a.ref, a.person_id, a.created_at::timestamptz AS angelegt, a.payment_status,
         ${BEZAHLT_AM} AS bezahlt_am, ROUND(COALESCE(a.amount_due, 0) * 100)::bigint AS cents
    FROM fiaon_applications a
    LEFT JOIN fiaon_persons p ON p.id = a.person_id
   WHERE ${IST_AUSKUNFT} AND a.merged_into IS NULL AND a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL
     AND a.payment_status <> 'superseded'
     AND (a.created_at::timestamptz >= ${AB_14}
          OR (a.payment_status = 'paid' AND ${BEZAHLT_AM} >= ${AB_14} - INTERVAL '120 days'))
),
best_weg AS (
  SELECT b.*,
         CASE
           WHEN q.quelle = 'kunde' THEN COALESCE(kl.weg, 'unbekannt')
           WHEN q.quelle = 'verkaufstakt' THEN 'mail'
           WHEN q.quelle IN ('mara_mail', 'mara_wa') THEN 'mara'
           WHEN q.quelle = 'kundenbereich' THEN 'kundenbereich'
           WHEN q.quelle IN ('betreuer', 'assistent') THEN 'betreuer'
           WHEN q.quelle = 'oeffentlich' THEN 'oeffentlich'
           WHEN akte.da THEN 'betreuer'
           WHEN bs.da OR b.person_id IS NULL THEN 'oeffentlich'
           ELSE 'unbekannt'
         END AS weg
    FROM best b
    LEFT JOIN LATERAL (
      SELECT substring(c.note from 'über ([a-z_]+)\\.') AS quelle FROM fiaon_contact_log c
       WHERE c.ref = b.ref AND c.type = 'system' AND c.note LIKE 'Bonitätsauskunft bestellt (%'
       ORDER BY c.id ASC LIMIT 1) q ON TRUE
    -- Gegenlesen 25.09.2026: Vor E-240 schrieb der Knopf in der Akte „Bonitätsauskunft (74,00 €) auf
    -- Kundenwunsch aus der Akte bestellt" (Autor: der Betreuer) — 5 der 7 Bestellungen der letzten
    -- 14 Tage (gemessen 25.09.) standen sonst unter „ohne Herkunft".
    LEFT JOIN LATERAL (
      SELECT TRUE AS da FROM fiaon_contact_log c
       WHERE c.ref = b.ref AND c.note LIKE 'Bonitätsauskunft (%) auf Kundenwunsch aus der Akte bestellt%' LIMIT 1) akte ON TRUE
    LEFT JOIN LATERAL (
      SELECT TRUE AS da FROM fiaon_contact_log c WHERE c.ref = b.ref AND c.agent_name = 'Kunde (Bestellseite)' LIMIT 1) bs ON TRUE
    LEFT JOIN LATERAL (
      SELECT k.weg FROM ${klicke} k
       WHERE k.person_id = b.person_id AND k.zeit <= b.angelegt + INTERVAL '5 minutes'
         AND k.zeit >= b.angelegt - INTERVAL '${KAUF_LINK_TAGE} days'
       ORDER BY k.zeit DESC LIMIT 1) kl ON TRUE
),
geliefert AS (
  SELECT b.ref, b.person_id, b.weg, b.angelegt, g.am AS zeit
    FROM best_weg b
   CROSS JOIN LATERAL (
     SELECT MIN(t) AS am FROM (
       SELECT d.hochgeladen_am AS t FROM fiaon_dokumente d
        WHERE d.person_id = b.person_id AND d.geloescht_am IS NULL AND d.art ILIKE '%schufa%' AND d.hochgeladen_am >= b.angelegt
       UNION ALL
       SELECT s.created_at FROM fiaon_schufa_analysen s WHERE s.person_id = b.person_id AND s.created_at >= b.angelegt
       UNION ALL
       SELECT c.created_at FROM fiaon_contact_log c
        WHERE c.person_id = b.person_id AND c.note LIKE 'Bonitätsauskunft: Datenkopie von % eingegangen%' AND c.created_at >= b.angelegt
       ${beschafft}
     ) x) g
   WHERE b.payment_status = 'paid' AND b.person_id IS NOT NULL AND g.am IS NOT NULL AND g.am >= ${AB_14}
),
ev AS (
  SELECT 'angeschrieben'::text AS stufe, a.person_id::text AS schluessel, a.person_id, a.weg, a.zeit, a.zeit AS seg_zeit, 0::bigint AS cents FROM angeschrieben a
  UNION ALL
  SELECT 'geklickt', k.person_id::text, k.person_id, k.weg, k.zeit, k.zeit, 0::bigint FROM klicks k
  UNION ALL
  SELECT 'bestellt', b.ref, b.person_id, b.weg, b.angelegt, b.angelegt, 0::bigint FROM best_weg b WHERE b.angelegt >= ${AB_14}
  UNION ALL
  SELECT 'bezahlt', b.ref, b.person_id, b.weg, b.bezahlt_am, b.angelegt, b.cents FROM best_weg b
   WHERE b.payment_status = 'paid' AND b.bezahlt_am >= ${AB_14}
  UNION ALL
  SELECT 'geliefert', g.ref, g.person_id, g.weg, g.zeit, g.angelegt, 0::bigint FROM geliefert g
),
ev_seg AS (
  SELECT e.stufe, e.schluessel, e.weg, e.cents,
         (e.zeit AT TIME ZONE 'Europe/Berlin')::date AS tag,
         ${SEGMENT_ZUM_ZEITPUNKT_SQL("e.person_id", "e.seg_zeit")} AS segment
    FROM ev e
    LEFT JOIN fiaon_persons p ON p.id = e.person_id
   WHERE p.ist_test_am IS NULL AND e.zeit <= NOW()
)
SELECT to_char(tag, 'YYYY-MM-DD') AS tag, stufe,
       CASE WHEN GROUPING(weg) = 0 THEN weg END AS weg,
       CASE WHEN GROUPING(segment) = 0 THEN segment END AS segment,
       COUNT(DISTINCT schluessel)::int AS n,
       COALESCE(SUM(cents), 0)::bigint AS cents
  FROM ev_seg
 GROUP BY GROUPING SETS ((tag, stufe), (tag, stufe, weg), (tag, stufe, segment))`;
}

type Werte = Record<Stufe, number>;
const leereWerte = (): Werte => ({ angeschrieben: 0, geklickt: 0, bestellt: 0, bezahlt: 0, geliefert: 0 });

export interface TrichterZeile<K extends string> { schluessel: K; heute: Werte; summe: Werte; umsatzHeuteCents: number; umsatzSummeCents: number }
export interface Trichter {
  stufen: readonly Stufe[];
  tage: { tag: string; werte: Werte; umsatzCents: number }[];
  heute: { tag: string; werte: Werte; umsatzCents: number };
  summe: { werte: Werte; umsatzCents: number };
  jeWeg: TrichterZeile<Weg>[];
  jeSegment: TrichterZeile<Segment>[];
  /** Wege, an denen „angeschrieben" und „geklickt" entstehen — sonst „—" auf der Seite. */
  anschreibendeWege: Weg[];
}

/** Die 14 Berliner Tage (heute zuletzt) — aus der Datenbank, nie aus toISOString (Zeit-Falle). */
async function vierzehnTage(): Promise<string[]> {
  const zeilen = (await sqlPool.unsafe(`
    SELECT to_char(d::date, 'YYYY-MM-DD') AS tag
      FROM generate_series((NOW() AT TIME ZONE 'Europe/Berlin')::date - 13, (NOW() AT TIME ZONE 'Europe/Berlin')::date, INTERVAL '1 day') d
     ORDER BY 1`)) as any[];
  return zeilen.map((z) => String(z.tag));
}

/** Die Zeilen der Abfrage in die Form der Seite bringen (auch vom Prüfstand benutzt). */
export function trichterFormen(tage: string[], zeilen: any[]): Trichter {
  const heuteTag = tage[tage.length - 1] ?? "";
  const tagMap = new Map(tage.map((t) => [t, { tag: t, werte: leereWerte(), umsatzCents: 0 }]));
  const zeile = <K extends string>(k: K): TrichterZeile<K> => ({ schluessel: k, heute: leereWerte(), summe: leereWerte(), umsatzHeuteCents: 0, umsatzSummeCents: 0 });
  const jeWeg = new Map<string, TrichterZeile<Weg>>(WEGE.map((w) => [w, zeile(w)]));
  const jeSegment = new Map<string, TrichterZeile<Segment>>(SEGMENTE.map((s) => [s, zeile(s)]));
  for (const z of zeilen) {
    const stufe = String(z.stufe) as Stufe;
    if (!STUFEN.includes(stufe)) continue;
    const tag = String(z.tag), n = Number(z.n || 0), cents = Number(z.cents || 0);
    const istHeute = tag === heuteTag;
    const umsatz = stufe === "bezahlt" ? cents : 0;
    const ziel = z.weg != null ? jeWeg.get(String(z.weg)) : z.segment != null ? jeSegment.get(String(z.segment)) : null;
    if (z.weg == null && z.segment == null) {
      const t = tagMap.get(tag);
      if (t) { t.werte[stufe] += n; t.umsatzCents += umsatz; }
      continue;
    }
    if (!ziel) continue;
    ziel.summe[stufe] += n; ziel.umsatzSummeCents += umsatz;
    if (istHeute) { ziel.heute[stufe] += n; ziel.umsatzHeuteCents += umsatz; }
  }
  const tagListe = Array.from(tagMap.values());
  const summe = { werte: leereWerte(), umsatzCents: 0 };
  for (const t of tagListe) {
    for (const s of STUFEN) summe.werte[s] += t.werte[s];
    summe.umsatzCents += t.umsatzCents;
  }
  return {
    stufen: STUFEN,
    tage: tagListe,
    heute: tagMap.get(heuteTag) ?? { tag: heuteTag, werte: leereWerte(), umsatzCents: 0 },
    summe,
    jeWeg: Array.from(jeWeg.values()),
    jeSegment: Array.from(jeSegment.values()),
    anschreibendeWege: ANSCHREIBENDE_WEGE,
  };
}

export async function trichterLesen(): Promise<Trichter> {
  await klicksTabelle();
  // fiaon_wa_aktion legt die WA-Zentrale an — ohne sie scheiterte die Spur „WhatsApp-Vorlage".
  const { zentraleSchema } = await import("../lib/fiaon-wa-zentrale");
  await zentraleSchema();
  const [t] = (await sqlPool`SELECT to_regclass('fiaon_auskunft_beschaffung') IS NOT NULL AS da`) as any[];
  const [tage, zeilen] = await Promise.all([vierzehnTage(), sqlPool.unsafe(trichterSql(KLICKS_TABELLE, !!t?.da)) as Promise<any[]>]);
  return trichterFormen(tage, zeilen);
}

// ───────────────────────────────────────────────────────────────────────────
// Rückstand „bezahlt, nicht geliefert"
// ───────────────────────────────────────────────────────────────────────────

interface Rueckstand {
  personId: number; ref: string; name: string; land: string; auskunfteien: string;
  gekauftAm: string; tageSeitKauf: number; betreuer: string | null; vorgaenge: number;
}

/**
 * Aus rueckstandListe (fiaon-auskunft-lieferung.ts) — der einen Definition
 * von „geliefert". Fehlt sie (paralleler Bau), zählt die gleichwertige
 * Abfrage unten: jüngste bezahlte Auskunft je Person ohne schufa_pdf.
 */
async function rueckstand(): Promise<{ zeilen: Rueckstand[]; quelle: "lieferung" | "eigen" }> {
  try {
    const m: any = await import("../lib/fiaon-auskunft-lieferung");
    if (typeof m.rueckstandListe === "function") {
      const liste = (await m.rueckstandListe()) as any[];
      return {
        quelle: "lieferung",
        zeilen: liste.map((z) => ({
          personId: Number(z.personId), ref: String(z.ref), name: String(z.name || "Ohne Namen"),
          land: String(z.land || "DE"), auskunfteien: String(z.auskunfteien || ""),
          gekauftAm: String(z.gekauftAm), tageSeitKauf: Number(z.tageSeitKauf || 0),
          betreuer: z.betreuer?.name ? String(z.betreuer.name) : null,
          vorgaenge: Number(z.lieferung?.vorgaenge || 0),
        })),
      };
    }
  } catch (e) {
    console.warn("[CHEF-AUSKUNFT] rueckstandListe nicht verfügbar — eigene Abfrage:", String((e as Error)?.message || e).slice(0, 160));
  }
  // Gleichwertig zur Lieferung: jüngste bezahlte Auskunft je Person, keine Test-/zusammengeführte Person, kein Dokument.
  const zeilen = (await sqlPool.unsafe(`
    WITH kauf AS (
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, ${BEZAHLT_AM} AS bezahlt_am, a.created_at::timestamptz AS angelegt,
             a.assigned_agent_id, a.first_name, a.last_name
        FROM fiaon_applications a
       WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.payment_status = 'paid' AND ${IST_AUSKUNFT}
       ORDER BY a.person_id, ${BEZAHLT_AM} DESC NULLS LAST, a.created_at DESC
    )
    SELECT k.person_id, k.ref, COALESCE(k.bezahlt_am, k.angelegt) AS gekauft_am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', k.first_name, k.last_name)), ''), k.ref) AS name,
           (SELECT x.country FROM fiaon_applications x WHERE x.person_id = k.person_id AND x.merged_into IS NULL AND x.country IS NOT NULL
             ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) AS land,
           COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS betreuer
      FROM kauf k
      JOIN fiaon_persons p ON p.id = k.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, k.assigned_agent_id)
     WHERE p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = k.person_id AND d.schufa_pdf IS NOT NULL)
     ORDER BY COALESCE(k.bezahlt_am, k.angelegt) ASC`)) as any[];
  const jetzt = Date.now();
  return {
    quelle: "eigen",
    zeilen: zeilen.map((z) => {
      const land = auskunftLand(z.land);
      const am = new Date(z.gekauft_am);
      return {
        personId: Number(z.person_id), ref: String(z.ref), name: String(z.name), land, auskunfteien: auskunfteienText(land),
        gekauftAm: am.toISOString(), tageSeitKauf: Math.max(0, Math.floor((jetzt - am.getTime()) / 86_400_000)),
        betreuer: z.betreuer ? String(z.betreuer) : null, vorgaenge: 0,
      };
    }),
  };
}

/**
 * E-241: Der Zähler für den Arbeitsplatz /chef/s/auskunft-beschaffung
 * (fiaon-chef-auskunft-beschaffung.ts, Regeln in fiaon-auskunft-lieferung.ts).
 *   offen         Aufträge in fiaon_auskunft_beschaffung, die nicht „fertig" sind —
 *                 dieselbe Zählung wie „offen" auf dem Arbeitsplatz.
 *   überfällig    davon offen, in Arbeit oder mit Problem, und seit mehr als
 *                 BESCHAFFUNG_UEBERFAELLIG_TAGE Tagen fällig (faellig_ab) — ein
 *                 Kunde, der bezahlt hat und dessen Auskunft seit Tagen geholt
 *                 werden dürfte. „hochgeladen" zählt nicht: Das Dokument ist da.
 *   nichtEingelesen  bezahlt ohne Dokument (Rückstand), aber noch ohne Auftrag —
 *                 der Arbeitsplatz liest sie beim Öffnen ein.
 * Gibt es die Tabelle noch nicht (die Lieferung legt sie beim ersten Auftrag an),
 * zählt der Rückstand, und überfällig ist, was länger als zwei Wochen wartet —
 * dieselbe gelbe Regel wie in der Liste „Bezahlt, noch nicht geliefert".
 */
const BESCHAFFUNG_UEBERFAELLIG_TAGE = 2;
const RUECKSTAND_UEBERFAELLIG_TAGE = 14;
export interface BeschaffungZaehler {
  offen: number; ueberfaellig: number; nichtEingelesen: number; ueberfaelligAbTagen: number; quelle: "beschaffung" | "rueckstand";
}
async function beschaffungZaehler(rueck: { zeilen: Rueckstand[] }): Promise<BeschaffungZaehler> {
  try {
    const [t] = (await sqlPool`SELECT to_regclass('fiaon_auskunft_beschaffung') IS NOT NULL AS da`) as any[];
    if (t?.da) {
      const [z] = (await sqlPool.unsafe(`
        SELECT COUNT(*) FILTER (WHERE status <> 'fertig')::int AS offen,
               COUNT(*) FILTER (WHERE status IN ('offen', 'in_arbeit', 'problem')
                                  AND faellig_ab < (NOW() AT TIME ZONE 'Europe/Berlin')::date - ${BESCHAFFUNG_UEBERFAELLIG_TAGE})::int AS ueberfaellig,
               COALESCE(array_agg(ref), '{}') AS refs
          FROM fiaon_auskunft_beschaffung`)) as any[];
      const refs = new Set<string>((z?.refs ?? []).map(String));
      return {
        offen: Number(z?.offen || 0), ueberfaellig: Number(z?.ueberfaellig || 0),
        nichtEingelesen: rueck.zeilen.filter((r) => !refs.has(r.ref)).length,
        ueberfaelligAbTagen: BESCHAFFUNG_UEBERFAELLIG_TAGE, quelle: "beschaffung",
      };
    }
  } catch (e) {
    console.warn("[CHEF-AUSKUNFT] Beschaffung nicht lesbar — zähle den Rückstand:", String((e as Error)?.message || e).slice(0, 160));
  }
  return {
    offen: rueck.zeilen.length,
    ueberfaellig: rueck.zeilen.filter((z) => z.tageSeitKauf > RUECKSTAND_UEBERFAELLIG_TAGE).length,
    nichtEingelesen: 0, ueberfaelligAbTagen: RUECKSTAND_UEBERFAELLIG_TAGE, quelle: "rueckstand",
  };
}

// ───────────────────────────────────────────────────────────────────────────
// GET /chef/auskunft
// ───────────────────────────────────────────────────────────────────────────

router.get("/chef/auskunft", wache, async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const [trichter, offen, pool, einst, heuteBeruehrt, wa, rueck, wirkung, vorlage, protokoll] = await Promise.all([
      trichterLesen(),
      // Bestellt, nicht bezahlt: mit Zahlungslink — das Geld liegt schon auf dem Tisch.
      sqlPool.unsafe(`
        SELECT a.ref, a.person_id, a.payment_reference, a.payment_status, a.amount_due, a.pack_key, a.created_at::timestamptz AS angelegt,
               a.claimed_paid_at, a.country,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.ref) AS name,
               COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS betreuer,
               (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre
          FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
         WHERE ${IST_AUSKUNFT} AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment', 'claimed_paid')
           AND a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL AND a.gdpr_deleted_at IS NULL
         ORDER BY a.created_at DESC
         LIMIT 100`) as Promise<any[]>,
      poolZahlen(),
      einstellungenLesen(),
      beruehrungenHeute(),
      whatsappMoeglich(),
      rueckstand(),
      // Wirkung der Angebots-Mails der letzten 30 Tage: wer danach bestellt bzw. bezahlt hat.
      sqlPool.unsafe(`
        WITH m AS (
          SELECT person_id, MIN(created_at) AS am FROM fiaon_mail_log
           WHERE event = '${ANGEBOT_EVENT}' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
             AND person_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
           GROUP BY 1
        )
        SELECT COUNT(*)::int AS angeschrieben,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND ${IST_AUSKUNFT} AND a.merged_into IS NULL
                                               AND a.created_at::timestamptz > m.am))::int AS bestellt,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND ${IST_AUSKUNFT} AND a.merged_into IS NULL
                                               AND a.payment_status = 'paid' AND ${BEZAHLT_AM} > m.am))::int AS bezahlt,
               (SELECT COUNT(*) FROM fiaon_wa_aktion WHERE gruppe = '${WA_GRUPPE}' AND ok AND erstellt_am > NOW() - INTERVAL '30 days')::int AS whatsapp
          FROM m`) as Promise<any[]>,
      vorlagenStand(),
      protokollLesen(),
    ]);

    const w = (wirkung as any[])[0] ?? {};
    const e = einst;
    // Die bisherige Form (heute/tage) — aus dem Trichter, damit es EINE Zählung gibt.
    const alsTag = (t: { tag: string; werte: Werte; umsatzCents: number }) => ({ tag: t.tag, bestellt: t.werte.bestellt, bezahlt: t.werte.bezahlt, umsatzCents: t.umsatzCents });
    res.json({
      ok: true,
      stand: new Date().toISOString(),
      ziel: ZIEL_PRO_TAG,
      heute: alsTag(trichter.heute),
      tage: trichter.tage.map(alsTag),
      trichter,
      pool,
      // Die Wörter des Takts für Segmente und Sperrgründe — die Seite übersetzt nichts selbst.
      segmentText: SEGMENT_TEXT,
      sperrgrundText: SPERRGRUND_TEXT,
      einstellungen: e,
      protokoll,
      beschaffung: await beschaffungZaehler(rueck),
      offen: (offen as any[]).map((o) => ({
        ref: String(o.ref), personId: o.person_id != null ? Number(o.person_id) : null, name: String(o.name),
        status: String(o.payment_status), gemeldetAm: o.claimed_paid_at ? new Date(o.claimed_paid_at).toISOString() : null,
        // E-181: Der Katalogpreis gilt; amount_due nur, wenn keiner bestimmbar ist (Gegenlesen 24.09.2026).
        // Integration 25.09.2026: über katalogpreisCents (erst die Kategorie, dann der Schlüssel) — sechs
        // Auskunft-Zeilen tragen vom Dubletten-Merge ein Stufenpaket im pack_key; der Schlüssel allein
        // hätte dort 99,99 € statt 74 € angezeigt.
        betrag: katalogpreisCents({ ref: o.ref, type: "schufa", pack_key: o.pack_key })
          ? euroText(katalogpreisCents({ ref: o.ref, type: "schufa", pack_key: o.pack_key })!)
          : o.amount_due != null ? euroText(Math.round(Number(o.amount_due) * 100)) : null,
        angelegt: new Date(o.angelegt).toISOString(),
        tage: Math.max(0, Math.floor((Date.now() - new Date(o.angelegt).getTime()) / 86_400_000)),
        land: auskunftLand(o.country), betreuer: o.betreuer ? String(o.betreuer) : null, werbesperre: !!o.werbesperre,
        zahlungsseite: o.payment_reference ? absoluteUrl(`/zahlung/${encodeURIComponent(String(o.payment_reference))}`) : null,
        verwendungszweck: o.payment_reference ? String(o.payment_reference) : null,
      })),
      rueckstand: rueck,
      takt: {
        an: e.an,
        // Bisheriger Name: der Mail-Deckel. Seit E-241 zählen Mails und WhatsApp je für sich.
        proTag: e.mailsProTag, hoechstensProTag: e.hoechstensMails,
        mailsProTag: e.mailsProTag, waProTag: e.waProTag,
        heute: heuteBeruehrt, sendezeit: istSendezeit(),
        stichtag: UWG_STICHTAG, hoechstensBeruehrungen: HOECHSTENS_BERUEHRUNGEN,
        whatsapp: wa,
      },
      wirkung30: {
        angeschrieben: Number(w.angeschrieben || 0), bestellt: Number(w.bestellt || 0),
        bezahlt: Number(w.bezahlt || 0), whatsapp: Number(w.whatsapp || 0),
      },
      // Integration 25.09.2026 (E-241): beide Vorlagen des Takts — Kunden (A) und Anträge/Leads (B, C).
      // `vorlage` bleibt (die Kunden-Vorlage) für ältere Stände der Seite.
      vorlage: vorlage[0] ?? null,
      vorlagen: vorlage,
    });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] lesen:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

/**
 * Die WhatsApp-Vorlagen des Takts: Text mit Beispielwerten, Stand bei Meta — seit E-241 zwei
 * (auskunftVorlageFuer: Kunden fiaon_kk_auskunft, Anträge und Leads fiaon_kk_auskunft_lead).
 */
async function vorlagenStand() {
  const { WA_VORLAGEN_ENTWURF, WA_VORLAGEN, AUSKUNFT_VORLAGE, AUSKUNFT_LEAD_VORLAGE } = await import("@shared/fiaon-lead-texte");
  // Freigegeben? Aus dem 5-Minuten-Zwischenspeicher der Freigaben — kein Graph-Aufruf je Seitenaufruf.
  let frei: Set<string> | null = null;
  let istFrei: ((name: string, f: Set<string>) => boolean) | null = null;
  try {
    const { waKonfig, freigegebeneVorlagen } = await import("../lib/fiaon-whatsapp");
    if (waKonfig().bereit) {
      istFrei = (await import("../lib/fiaon-wa-zentrale")).istFrei;
      frei = await freigegebeneVorlagen();
    }
  } catch { /* Meta nicht erreichbar — die Seite zeigt „unbekannt" */ }
  const zeilen = [
    { name: AUSKUNFT_VORLAGE, fuer: "A · Kunden mit laufendem Paket" },
    { name: AUSKUNFT_LEAD_VORLAGE, fuer: "B · Anträge und C · Leads" },
  ];
  return zeilen.flatMap(({ name, fuer }) => {
    const def = WA_VORLAGEN.find((v) => v.name === name) ?? WA_VORLAGEN_ENTWURF.find((v) => v.name === name);
    if (!def) return [];
    return [{
      name: def.name, fuer, kopf: def.kopf ?? "", fuss: def.fuss ?? "", kategorie: def.kategorie,
      text: def.text, beispiel: def.text.replace(/\{\{(\d)\}\}/g, (_m, n) => def.beispiele[Number(n) - 1] ?? ""),
      knoepfe: def.knoepfe.map((k) => k.text),
      entwurf: !WA_VORLAGEN.some((v) => v.name === name),
      /** true/false; null = WhatsApp nicht eingerichtet oder Meta nicht erreichbar. */
      freigegeben: frei && istFrei ? istFrei(name, frei) : null,
    }];
  });
}

// ───────────────────────────────────────────────────────────────────────────
// GET /chef/auskunft/vorschau — wer als Nächstes angeschrieben würde
// ───────────────────────────────────────────────────────────────────────────

router.get("/chef/auskunft/vorschau", wache, async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    // E-241: getrennt nach WhatsApp und Mail, im eingestellten Kreis, mit Segment, Fassung und Preis (vorschau des Takts).
    res.json({ ok: true, ...(await vorschau(30)) });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Vorschau:", err);
    res.status(500).json({ ok: false, error: "Die Vorschau ließ sich nicht laden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /chef/auskunft/einstellung — nur die fünf Einstellungen, jede im Protokoll
// ───────────────────────────────────────────────────────────────────────────

router.post("/chef/auskunft/einstellung", wache, async (req: ChefRequest, res: Response) => {
  try {
    const key = String(req.body?.key || "");
    const value = String(req.body?.value ?? "").trim();
    const regel = STEUERUNG[key];
    if (!regel) return res.status(400).json({ ok: false, error: "Diesen Schlüssel darf die Seite nicht schreiben." });

    const vorher = await rohWert(key);
    const vorherWirksam = await verkaufEinstellungen();
    // Nicht gesetzt: Galt der Standard oder (nur bei den Mails) der alte Schlüssel aus E-240?
    const herkunft = vorher != null ? "" : key === SCHALTER_MAILS && (await rohWert(SCHALTER_PRO_TAG)) != null ? " (alter Schlüssel)" : " (Standard)";
    // Die Prüfung der Werte steht EINMAL — in einstellungSetzen des Takts.
    const erg = await einstellungSetzen(key, value);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    const nachher = await rohWert(erg.key);
    if (vorher !== nachher) {
      // Protokoll: wer (Chef-Sitzung), wann (zeit), was (alt → neu). Ein Fehler hier kippt die Änderung nie (chefProtokoll fängt ihn).
      await chefProtokoll(req, `${PROTOKOLL_ZIEL}${erg.key}`,
        `${regel.name}: ${regel.wert(vorherWirksam)}${herkunft} → ${regel.wert(erg.einstellungen)}`);
    }
    const wer = req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Chefbüro";
    console.log(`[CHEF-AUSKUNFT] ${erg.key}: ${vorher ?? "(Standard)"} → ${nachher} durch ${wer}`);
    const [einstellungen, protokoll] = await Promise.all([einstellungenLesen(), protokollLesen()]);
    res.json({ ok: true, einstellungen, protokoll, geaendert: vorher !== nachher });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Einstellung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /chef/auskunft/lieferung — den Rückstand von Hand starten
//
// Integration 25.09.2026 (E-240): Die Lieferung (fiaon-auskunft-lieferung.ts)
// startet bei jeder NEUEN Zahlung von selbst (onCustomerPaid). Für den
// Rückstand — bezahlt vor dem 24.09., 59 Menschen ohne Dokument — sagt sie
// ausdrücklich „gestartet wird im Chefbüro von Hand, je Bestellung", und ihre
// Aufgaben („Anschrift fehlt", „ohne Person") verweisen auf „Auskunft-Rückstand
// … neu starten". Diesen Knopf gab es nicht: eine Liste ohne Hebel.
// Idempotent wie die Lieferung selbst — ein zweiter Klick legt nichts doppelt an.
// `mail: false` = ohne Mail an den Kunden (der Betreuer ruft an).
// ───────────────────────────────────────────────────────────────────────────

router.post("/chef/auskunft/lieferung", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ref = String(req.body?.ref ?? "").trim();
    if (!/^FIAON-[A-Z0-9-]{3,60}$/i.test(ref)) return res.status(400).json({ ok: false, error: "Keine gültige Bestellnummer." });
    const mail = req.body?.mail !== false;
    const wer = req.chef?.agentId ? `Chefbüro (#${req.chef.agentId})` : "Chefbüro";
    const { lieferungStarten } = await import("../lib/fiaon-auskunft-lieferung");
    const erg = await lieferungStarten(ref, { mail, von: wer });
    console.log(`[CHEF-AUSKUNFT] Lieferung ${ref} von Hand (${wer}, Mail ${mail ? "ja" : "nein"}): ${erg.text}`);
    // E-241: auch das im Protokoll — mit Bestellnummer als Ziel.
    await chefProtokoll(req, `auskunft-lieferung:${ref}`, `Lieferung von Hand ${mail ? "mit" : "ohne"} Mail: ${String(erg.text ?? "").slice(0, 200)}`);
    // ok = die Anfrage lief; ob geliefert wurde, sagt `lieferung` (ok, grund, text) — die Seite zeigt den Satz.
    res.json({ ok: true, lieferung: erg });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Lieferung:", err);
    res.status(500).json({ ok: false, error: "Die Lieferung ließ sich nicht starten." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — der Knopf der WhatsApp-Vorlage fiaon_kk_auskunft
//
// Meta hängt den Wert einer URL-Variable ans Ende der Adresse. Ein „?p=…&art=…"
// darin hinge an der Kodierung von Meta; deshalb trägt der Knopf den signierten
// Kauflink als EIN Pfadstück (kaufKurzToken) und diese Route macht daraus
// wieder genau den Link aus fiaon-auskunft-kauf.ts. Geprüft wird die Signatur
// DORT — hier nur die Form. Bestellt wird hier nichts: Das Ziel ist die
// Bestätigungsseite mit „zahlungspflichtig beauftragen" (§ 312j Abs. 3 BGB).
// Keine Chef-Wache: Das ist die Tür des Kunden.
// E-241: via=wa sagt dem Klick-Protokoll, dass der Klick vom WhatsApp-Knopf kam —
// unser eigenes Kennzeichen, nicht Teil der Signatur (es ändert nur die Zählung).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/auskunft/k/:token", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const t = kurzTokenLesen(req.params.token);
  // Falsche Form: auf die Bestätigungsseite ohne Signatur — sie sagt dem Kunden freundlich „ungültig" und nennt den Weg.
  const ziel = t
    ? `/api/fiaon/auskunft/bestellen?${new URLSearchParams({ p: t.p, art: t.art, exp: t.exp, sig: t.sig, via: "wa" }).toString()}`
    : "/api/fiaon/auskunft/bestellen";
  res.redirect(303, absoluteUrl(ziel));
});

export default router;
