// ═══════════════════════════════════════════════════════════════════════════
// FIAON AGENT — STARTSEITE UND DIE EINE KUNDENLISTE
//
// Warum diese Datei entsteht (Meldung des Vertriebs, 05.08.2026):
//
//   Florentine: „Der Bereich Heute sorgt eher für doppelte Arbeit und
//               Überschneidungen. Unser Vorschlag: alle Kunden ausschließlich
//               unter Meine Kunden führen und von oben nach unten abarbeiten."
//
// Sie hat recht, und der Grund ist strukturell: Eine Tagesliste NEBEN der
// Kundenliste sind zwei Wahrheiten über denselben Bestand. Wer in der einen
// arbeitet, hinterlässt in der anderen einen veralteten Stand — und zwei
// Mitarbeiter rufen denselben Menschen an.
//
// AB HIER GILT:
//   /agent/start   informiert. Verdienst, Zahlen, Termine. KEINE Arbeitsaktionen.
//   /agent/kunden  ist die EINZIGE Arbeitsliste. Alles, was zugewiesen ist,
//                  steht dort — von oben nach unten abarbeitbar.
//
// Die Sortierung der Kundenliste ist die eigentliche Leistung dieser Datei: Sie
// nimmt dem Agenten die Entscheidung ab, WEN er als nächstes anruft. Genau diese
// Entscheidung hat die alte Tagesliste getroffen — deshalb gibt es sie nicht
// mehr, sondern die Reihenfolge steht in der einen Liste.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { aufbereiten } from "../lib/fiaon-buchungen";
import { requireAgent, type AgentRequest, getSettings, normalizeSearchDigits } from "./fiaon-agent";
import { waehlbareNummer, nichtWaehlbarSql } from "../lib/fiaon-telefon";
import { hinweisFuer, type TierGrund } from "../lib/tier-hinweise";
import { ensureBetreuungSpalte } from "../lib/tier";
import { stufeAusTier } from "@shared/fiaon-kundenstatus";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { terminLink } from "../lib/fiaon-termine";
import { wartetSql, warteZahlen } from "../lib/fiaon-warten";
import { landVorschlag } from "./fiaon-agent-kunden";
import {
  sendeGrundSql, SENDE_GRUND_TEXT, fehlendeFelderSql, zustimmungFehltSql,
} from "../lib/fiaon-massgebliche-bestellung";
import { zustaendigeRolleSql } from "../lib/fiaon-zustaendigkeit";
import { terminArtAusQuelle, terminArtRueckruf } from "../../shared/fiaon-termin-art";
import { FIAON_BANK_DETAILS as BANK } from "./fiaon-antrag";
import { zahlungstext } from "../lib/fiaon-verwendungszweck";
import { kartenStatusText, ensureKartenSpalten } from "../lib/fiaon-kartenstatus";

const router = Router();

/**
 * HEUTE — in Europe/Berlin, nicht in UTC.
 *
 * `CURRENT_DATE` ist das Datum des SERVERS, und der läuft auf UTC. Zwischen
 * Mitternacht und zwei Uhr Berliner Zeit (im Winter: eine Stunde) ist das noch
 * der Vortag. Eine Zusage „für heute" fiel in diesem Fenster aus dem obersten
 * Rang und rutschte hinter die Stufe A — gemessen am 09.08.2026 um 00:15 Uhr
 * Berliner Zeit, wo UTC noch den 08.08. anzeigte.
 *
 * Dieselbe Tagesgrenze wie `berlinToday()` in server/lib/fiaon-time.ts, nur
 * für SQL. Wer hier `CURRENT_DATE` schreibt, baut den Fehler neu.
 */
const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;


/** Wie viele Menschen je Stufe im gemeinsamen Kundenpool warten (niemandem zugeteilt). */
async function poolZahlen(): Promise<{ a: number; b: number; c: number }> {
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE priority_tier = 1)::int AS a,
           COUNT(*) FILTER (WHERE priority_tier = 2)::int AS b,
           COUNT(*) FILTER (WHERE priority_tier = 3)::int AS c
      FROM fiaon_persons
     WHERE assigned_agent_id IS NULL AND mandat_seit IS NULL
       AND merged_into_person_id IS NULL AND ist_test_am IS NULL
       AND NOT is_blocked AND priority_tier IN (1,2,3)`) as any[];
  return { a: Number(z?.a ?? 0), b: Number(z?.b ?? 0), c: Number(z?.c ?? 0) };
}
const NAME_SQL = `COALESCE(
  NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
  NULLIF(TRIM(p.company_name), ''),
  NULLIF(TRIM(p.contact_name), ''),
  p.primary_email,
  CONCAT('Person ', p.id)
)`;

/** Felder, die jede Karte braucht — einmal definiert, in ALLEN Abfragen benutzt
 *  (Liste, Startseite UND Einzelkarte in fiaon-agent-kunden.ts). */
export const KARTE_SQL = `
  p.id, ${NAME_SQL} AS name, p.primary_email, p.primary_phone, p.country,
  p.priority_tier, p.tier_reason, p.promised_payment_date, p.follow_up_date,
  p.unreachable_count, p.invoice_sent_count, p.is_blocked, p.betreuung_seit,
  p.assigned_agent_id,
  (SELECT COALESCE(NULLIF(ag.first_name, ''), ag.name) FROM fiaon_agents ag WHERE ag.id = p.assigned_agent_id) AS betreuer_name,
  (SELECT a.ref FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS ref,
  (SELECT a.payment_reference FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
  (SELECT a.payment_status FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS zahlungsstatus,
  (SELECT a.pack_name FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS pack_name,
  -- Die Hand-Sperre (27.08.2026): seit dem Umbau des Zugangstors die EINZIGE
  -- Sperre. Die Karte zeigt sie und traegt den Sperren/Freischalten-Knopf.
  EXISTS (SELECT 1 FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
      AND a.account_status = 'suspended') AS konto_gesperrt,
  -- ══════════════════════════════════════════════════════════════════════════
  -- ALLE BUCHUNGEN, NICHT NUR DIE NEUESTE
  --
  -- Ein Agent (11.08.2026) über Shahed Mohammad: „Ursprünglich war er wegen
  -- seines Pakets bei mir hinterlegt. Jetzt ist das Paket komplett verschwunden
  -- und er taucht nur noch wegen der Schufa auf."
  --
  -- Gemessen: Er hat ZWEI Bestellungen — ultra (79,99 €, 23.07.) und
  -- Bonitätsauskunft (74 €, 31.07.). Die Karte holte mit
  -- „ORDER BY created_at DESC LIMIT 1" die neueste; das Paket verschwand.
  --
  -- 410 Kunden haben mehr als eine offene Buchung. Alle sahen nur eine.
  --
  -- Ein Kunde hat BUCHUNGEN, nicht eine Bestellung. Die Aufbereitung steht in
  -- server/lib/fiaon-buchungen.ts — hier nur die Rohdaten in einem Rutsch,
  -- damit es keine Abfrage je Kunde braucht.
  -- ══════════════════════════════════════════════════════════════════════════
  (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT(
            'ref', a.ref, 'pack_key', a.pack_key, 'pack_name', a.pack_name,
            'amount_due', a.amount_due, 'payment_status', a.payment_status,
            'status', a.status, 'created_at', a.created_at,
            'payment_due_date', a.payment_due_date,
            'payment_reference', a.payment_reference,
            'cancelled_at', a.cancelled_at, 'refunded_at', a.refunded_at
          ) ORDER BY a.created_at), '[]'::json)
     FROM fiaon_applications a
     WHERE a.person_id = p.id AND a.merged_into IS NULL
       AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL) AS buchungen_roh,
  -- ══════════════════════════════════════════════════════════════════════════
  -- DARF GESENDET WERDEN? — DIE ANTWORT KOMMT VOM SERVER (19.08.2026)
  --
  -- Die Karte hat den Sperrgrund bisher SELBST abgeleitet. GEMESSEN bei
  -- Florentine: Bei 139 Kunden gab sie den Knopf frei und der Server lehnte ab.
  -- Zwei Ableitungen fuer dieselbe Frage — jetzt eine, hier.
  -- ══════════════════════════════════════════════════════════════════════════
  -- KARTE_SQL ist ein einfacher Textbaustein, KEIN sql-Template: Ein
  -- sqlPool.unsafe(...) darin landet als „[object Object]“ in der Abfrage und
  -- Postgres meldet „syntax error at or near [“. Genau das ist beim ersten
  -- Entwurf passiert — die Kundenliste antwortete mit HTTP 500. Der Ausdruck
  -- wird deshalb direkt eingesetzt.
  ${sendeGrundSql("p")} AS sende_grund,
  -- Welche Pflichtfelder fehlen? Wörtlich in die Karte, statt „im Formular".
  ${fehlendeFelderSql("p")} AS fehlende_felder,
  -- Getrennt: nur die drei Willenserklaerungen. Sie sperren nichts, aber sie
  -- entscheiden, ob die Karte den Knopf „Zustimmungs-Link an den Kunden“ zeigt.
  ${zustimmungFehltSql("p")} AS zustimmung_fehlt,
  -- ── WER IST ZUSTAENDIG? EINE ABLEITUNG (21.08.2026) ─────────────────────
  -- Die Liste zeigt sie an, sie FILTERT nicht danach. Der Filter bleibt, wie
  -- er ist (Termin fuer Onboarding, Betreuung fuer Vertrieb) — er ist gemessen
  -- und behoben. Wer hier zusaetzlich filtert, aendert stillschweigend den
  -- Arbeitsvorrat von drei Rollen an einem Notfalltag.
  --
  -- Sichtbar muss sie trotzdem sein: Ein Vertriebsmitarbeiter, der einen
  -- Kunden bearbeitet, fuer den das Forderungsmanagement zustaendig ist, soll
  -- es LESEN — und nicht daraus schliessen, dass er es tun soll.
  ${zustaendigeRolleSql("p")} AS zustaendige_rolle,
  -- ── DER TERMIN AN DER ZEILE (20.08.2026) ───────────────────────────────
  -- Fuer Onboarding ist der Termin die Arbeit. Die Uhrzeit gehoert an die
  -- Karte, sonst muss man fuer jede Zeile in den Kalender wechseln.
  (SELECT t.beginn FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.beginn - NOW()))) LIMIT 1) AS termin_beginn,
  (SELECT t.status FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.beginn - NOW()))) LIMIT 1) AS termin_status,
  (SELECT t.dauer_min FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.beginn - NOW()))) LIMIT 1) AS termin_dauer_min,
  (SELECT t.erledigt_am FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.beginn - NOW()))) LIMIT 1) AS termin_erledigt_am,
  (SELECT t.quelle FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.abgesagt_am IS NULL
    ORDER BY ABS(EXTRACT(EPOCH FROM (t.beginn - NOW()))) LIMIT 1) AS termin_quelle,
  (SELECT a.payment_due_date FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS zahlungsfrist,
  -- Kartenstatus (22.08.2026, K11): „Wo ist meine Karte?" — an der Paketbestellung.
  (SELECT a.karten_status FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND NOT (COALESCE(a.type,'') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS karten_status,
  (SELECT a.karten_status_am FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
      AND NOT (COALESCE(a.type,'') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
    ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS karten_status_am,
  -- Der Betrag der Karte ist der OFFENE Betrag, nicht der der neuesten
  -- Bestellung (P2, Team-Feedback 28.08.: Lisa Kühne — Paket bezahlt, SCHUFA
  -- 74 € offen; angezeigt wurden die 59,99 des bezahlten Pakets als „offen").
  -- Offene Bestellung zuerst; gibt es keine, die neueste (dann sagt der
  -- Zustand ohnehin „bezahlt" und der Betrag ist nur Anzeige).
  (SELECT a.amount_due FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
    ORDER BY (a.payment_status IN ('pending_payment','claimed_paid','expired')) DESC,
             a.created_at DESC LIMIT 1) AS amount_due,
  (SELECT a.status FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
  -- P18 (28.08.2026): Wann will der Kunde angerufen werden? Aus dem Antrag.
  (SELECT a.erreichbarkeit FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.erreichbarkeit,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS erreichbarkeit,
  (SELECT a.phone FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_phone,
  (SELECT a.phone_country_code FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_vorwahl,
  (SELECT NULLIF(a.contact_phone,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.contact_phone,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_contact_phone,
  (SELECT COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,''))
    FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL
    ORDER BY a.created_at DESC LIMIT 1) AS app_email,
  COALESCE(NULLIF(p.street,''), (SELECT NULLIF(a.street,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.street,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS strasse,
  COALESCE(NULLIF(p.zip,''), (SELECT NULLIF(a.zip,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.zip,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS plz,
  COALESCE(NULLIF(p.city,''), (SELECT NULLIF(a.city,'') FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND NULLIF(a.city,'') IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS ort,
  COALESCE(p.birthdate, (SELECT a.birthdate FROM fiaon_applications a
    WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.birthdate IS NOT NULL
    ORDER BY a.created_at DESC LIMIT 1)) AS geburtsdatum,
  (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.voided_at IS NULL) AS letzter_kontakt,
  (SELECT cl.outcome FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.type = 'result' AND cl.voided_at IS NULL
    ORDER BY cl.created_at DESC LIMIT 1) AS letztes_ergebnis,
  (SELECT cl.scheduled_at FROM fiaon_contact_log cl
    JOIN fiaon_applications a2 ON a2.ref = cl.ref
    WHERE a2.person_id = p.id AND cl.outcome = 'rueckruf_termin'
      AND cl.voided_at IS NULL AND cl.done_at IS NULL
    ORDER BY cl.scheduled_at DESC LIMIT 1) AS rueckruf_am,
  p.ruhe_seit, p.terminlink_mail_am,
  (SELECT t.beginn FROM fiaon_termine t
    WHERE t.person_id = p.id AND t.status = 'gebucht' AND t.beginn > NOW()
    ORDER BY t.beginn ASC LIMIT 1) AS termin_am
`;

/** Aus einer Zeile wird eine Karte — eine Stelle, drei Ansichten. */
export function karte(p: any) {
  const h = hinweisFuer(p.tier_reason as TierGrund, p.letzter_status);
  const tel = waehlbareNummer(
    [
      { nummer: p.app_phone, vorwahl: p.app_vorwahl },
      { nummer: p.primary_phone },
      { nummer: p.app_contact_phone },
    ],
    p.country,
  );
  return {
    personId: Number(p.id),
    name: p.name,
    telefon: tel.anzeige,
    telefonWaehlbar: tel.waehlbar,
    telefonHinweis: tel.hinweis,
    // P18: die Wunsch-Erreichbarkeit aus dem Antrag — steht neben der Nummer.
    erreichbarkeit: p.erreichbarkeit ?? null,
    // ── DIE NUMMER OHNE LAND (31.08.2026) ────────────────────────────────
    // Damit die Karte die Inline-Korrektur anbieten kann, statt den Agenten mit
    // „nicht anrufbar" allein zu lassen. `landVorschlag` ist ein VORSCHLAG und
    // wird nie automatisch gesetzt — eine geratene Vorwahl ist genau der
    // Fehler, um den es hier geht (Maurizio Pampanini, dreimal +49 statt +41).
    nummerOhneLand: !tel.waehlbar
      && String(p.primary_phone ?? "").trim().startsWith("0")
      && !String(p.primary_phone ?? "").trim().startsWith("00"),
    nummerRoh: p.primary_phone ?? null,
    // Die Abfrage benennt die Felder `plz` und `ort` (nicht zip/city) und fuellt
    // sie aus der Person ODER der jüngsten Bestellung. Wer hier p.zip liest,
    // bekommt immer `undefined` — und damit nie einen Vorschlag.
    landVorschlag: landVorschlag({ zip: p.plz, city: p.ort }),
    email: p.primary_email || p.app_email || null,
    tier: Number(p.priority_tier),
    tierGrund: p.tier_reason,
    titel: h.titel,
    hinweis: h.hinweis,
    produkt: p.pack_name ? String(p.pack_name).split("\n")[0].trim() : null,
    // Die Hand-Sperre (27.08.2026) — Grundlage fuer den Knopf in der Akte.
    kontoGesperrt: p.konto_gesperrt === true,
    // ── ALLE BUCHUNGEN ────────────────────────────────────────────────────
    // Damit der Agent sieht, was gebucht wurde, was bezahlt ist und was offen
    // — auch wenn es zwei Vorgänge sind (Paket + Bonitätsauskunft).
    buchungen: aufbereiten(p.buchungen_roh),
    // Der Sperrgrund, frisch aus der Abfrage — nicht gemerkt und nicht in der
    // Oberflaeche abgeleitet.
    sendeGrund: p.sende_grund ?? null,
    sendeMoeglich: p.sende_grund === "frei" || p.sende_grund === "erste_rechnung",
    sendeText: p.sende_grund ? (SENDE_GRUND_TEXT[String(p.sende_grund)]?.text ?? null) : null,
    sendeTat: p.sende_grund ? (SENDE_GRUND_TEXT[String(p.sende_grund)]?.tat ?? null) : null,
    fehlendeFelder: p.fehlende_felder ? String(p.fehlende_felder) : null,
    zustimmungFehlt: p.zustimmung_fehlt ? String(p.zustimmung_fehlt) : null,
    zustaendigeRolle: p.zustaendige_rolle ? String(p.zustaendige_rolle) : null,
    betrag: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
    zusagedatum: p.promised_payment_date,
    wiedervorlage: p.follow_up_date,
    rueckrufAm: p.rueckruf_am,
    nichtErreicht: Number(p.unreachable_count || 0),
    rechnungVersandt: Number(p.invoice_sent_count || 0),
    gesperrt: !!p.is_blocked,
    // ── Stufe A/B/C ────────────────────────────────────────────────────────
    // Kein neues Feld in der Datenbank: Die Stufe IST das Tier, nur mit einem
    // Namen, den ein Mensch versteht (shared/fiaon-kundenstatus.ts).
    stufe: stufeAusTier(p.priority_tier),
    // ── Nicht-erreicht-Automatik ───────────────────────────────────────────
    ruhtSeit: p.ruhe_seit || null,
    terminlinkMailAm: p.terminlink_mail_am || null,
    terminAm: p.termin_am || null,
    // Der persoenliche Buchungslink — fuer den Kopierknopf, wenn keine
    // E-Mail hinterlegt ist („per WhatsApp senden").
    // ── HERKUNFT (24.08.2026) ──────────────────────────────────────────────
    // VORHER ohne zweites Argument. NACHHER „agent": Diesen Link gibt ein
    // Mitarbeiter von Hand weiter — er soll im Bestand nicht wie eine
    // automatische Mail aussehen.
    terminLink: terminLink(Number(p.id), "agent"),
    betreutSeit: p.betreuung_seit,
    // 04.09.2026 (E-120): Der Betreuer stand nirgends in der Karte — der
    // Verschiebe-Block sagte deshalb immer „Zuständig ist niemand".
    betreuer: p.betreuer_name ?? null,
    betreuerId: p.assigned_agent_id != null ? Number(p.assigned_agent_id) : null,
    letzterKontakt: p.letzter_kontakt,
    letztesErgebnis: p.letztes_ergebnis,
    stammdaten: {
      strasse: p.strasse || null, plz: p.plz || null, ort: p.ort || null,
      land: p.country || null, geburtsdatum: p.geburtsdatum || null,
    },
    // ── DIE ZAHLUNGSDATEN ZUM KOPIEREN — AUCH IN DER LISTE (22.08.2026, K6) ──
    // `klartext` gab es nur in der Einzelkarte. Die Liste lieferte ihn nicht,
    // und der Knopf „Zahlungsdaten kopieren" (WhatsApp, der Kanal mit der
    // höchsten Konversion) war beim Öffnen der Seite bei JEDEM Kunden grau —
    // ohne Begründung. Bankverbindung aus derselben Quelle wie die Rechnung.
    zahlung: {
      referenz: p.zahlungsreferenz || null,
      status: p.zahlungsstatus || null,
      frist: p.zahlungsfrist || null,
      ref: p.ref || null,
      empfaenger: BANK.recipient,
      iban: BANK.ibanDisplay,
      bic: BANK.bic,
      klartext: p.zahlungsreferenz
        ? zahlungstext({
            empfaenger: BANK.recipient, iban: BANK.iban, ibanAnzeige: BANK.ibanDisplay,
            bic: BANK.bic, verwendungszweck: String(p.zahlungsreferenz),
            betragCent: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
          })
        : null,
    },
    karte: {
      status: p.karten_status ?? null,
      text: kartenStatusText(p.karten_status) ?? (p.zahlungsstatus === "paid" ? "Stand unbekannt" : null),
      am: p.karten_status_am ?? null,
    },
    // Die Warnung entsteht hier, nicht im Frontend: eine fachliche Regel.
    rechnungWarnung: Number(p.invoice_sent_count || 0) >= 3
      ? `Bereits ${p.invoice_sent_count}× versandt. Ein weiterer Versand ersetzt kein Gespräch — ruf an.`
      : null,
    // ── DER TERMIN AN DER ZEILE (20.08.2026) ─────────────────────────────
    // Fuer Onboarding ist er die Arbeit. Uhrzeit und Art gehoeren an die Karte,
    // sonst muss man fuer jede Zeile in den Kalender wechseln.
    termin: p.termin_beginn
      ? {
        beginn: p.termin_beginn,
        status: p.termin_status ?? null,
        dauerMin: p.termin_dauer_min == null ? null : Number(p.termin_dauer_min),
        erledigt: p.termin_erledigt_am != null,
        // Die Art aus der Quelle (shared/fiaon-termin-art.ts) — vorher stand
        // hier hart „Startgespräch", auch an einem Vertriebstermin.
        art: terminArtAusQuelle(p.termin_quelle).text,
        artMarke: terminArtAusQuelle(p.termin_quelle),
      }
      : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/start — die Startseite informiert
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/start", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKartenSpalten();
    await ensureBetreuungSpalte(sqlPool);
    const me = req.agent!.id;

    // ── EINE WELLE STATT NEUN ──────────────────────────────────────────────
    // Diese Seite braucht sieben unabhängige Auskünfte. Hintereinander gestellt
    // kostet jede einen vollen Weg zur Datenbank; gemessen wurden 254 ms pro Weg
    // und 5 Sekunden für die Seite, obwohl die Datenbank selbst nur 9 ms
    // rechnete. Wer morgens die Startseite öffnet, wartet dann fünf Sekunden auf
    // Zahlen, die längst bereitstehen.
    //
    // Deshalb: alles Unabhängige gleichzeitig, und nur `moeglich` in einer
    // zweiten Welle — es braucht den Provisionssatz aus `agentRow`.
    const [settings, geldR, agentRowR, offenerAntragR, zahlenR, zusagen, rueckrufe] = await Promise.all([
      getSettings(),
      sqlPool`
      SELECT
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'bestaetigt'), 0)::bigint AS guthaben,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'in_auszahlung'), 0)::bigint AS angefordert,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'ausgezahlt'), 0)::bigint AS ausgezahlt,
        COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'storniert'
          AND created_at >= date_trunc('month', NOW())), 0)::bigint AS monat
      FROM fiaon_commissions WHERE agent_id = ${me}
    `,
      sqlPool`
      SELECT commission_rate_bp, monthly_goal_cents, bank_iban_masked, rolle
      FROM fiaon_agents WHERE id = ${me}
    `,
      sqlPool`
      SELECT id, amount_cents, requested_at FROM fiaon_payouts
      WHERE agent_id = ${me} AND status = 'angefordert'
      ORDER BY requested_at DESC LIMIT 1
    `,
      sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE priority_tier BETWEEN 1 AND 3 AND NOT is_blocked)::int AS offen,
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked)::int AS tier1,
        COUNT(*) FILTER (WHERE priority_tier = 2 AND NOT is_blocked)::int AS tier2,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked)::int AS tier3,
        COUNT(*) FILTER (WHERE priority_tier = 0)::int AS bezahlt,
        COUNT(*) FILTER (WHERE promised_payment_date = ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked)::int AS zusage_heute,
        COUNT(*) FILTER (WHERE promised_payment_date < ${sqlPool.unsafe(HEUTE)} AND priority_tier BETWEEN 1 AND 2
                           AND NOT is_blocked)::int AS zusage_ueberfaellig,
        -- Offene Raten: BEWUSST ohne Stufengrenze (25.08.2026). 185 der 203
        -- ueberfaelligen Raten haengen an Menschen auf Stufe 0. Waere die
        -- Grenze hier drin, zeigte der Zaehler 18 statt 203.
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM fiaon_abo_raten r8
          JOIN fiaon_applications a8 ON a8.ref = r8.ref
          WHERE a8.person_id = p.id AND a8.merged_into IS NULL
            AND r8.status IN ('offen','ueberfaellig') AND r8.faellig_am < CURRENT_DATE
            AND r8.storniert_am IS NULL AND r8.bezahlt_am IS NULL))::int AS rate_offen,
        -- Nummer ohne Land: nicht anrufbar, bis jemand die Vorwahl ergaenzt.
        -- Der Zaehler macht die Abarbeitung sichtbar — eine Datei tut das nicht.
        --
        -- ══════════════════════════════════════════════════════════════════
        -- HIER STAND DER FEHLER, DER DAS GANZE PORTAL LEER MACHTE (19.08.2026)
        --
        -- Der Baustein heisst nichtWaehlbarSql(p = "p") und schreibt seine
        -- Bedingungen auf den Alias p. Diese Abfrage hatte KEINEN Alias
        -- (FROM fiaon_persons), also lief sie in
        --
        --     PostgresError 42P01: missing FROM-clause entry for table p
        --
        -- Die Route faengt jeden Fehler und antwortet mit HTTP 500. Auf dem
        -- Bildschirm des Mitarbeiters stand daraufhin genau das, was Daniel,
        -- Florentine, Lucas und Nikita gemeldet haben: „Verdienst konnte nicht
        -- geladen werden", 0,00 EUR, „Bankdaten fehlen" (obwohl die IBAN
        -- hinterlegt ist) und 0 Kunden.
        --
        -- Und weil die ROLLE aus derselben Antwort kommt, verschwand fuer
        -- Daniel zusaetzlich der Menuepunkt „Vertrieb": Ohne Antwort bleibt
        -- die Rolle im Client auf „agent", und der Punkt haengt an
        -- nurRolle vertriebsleiter. Ein 500 an einer Stelle, vier Meldungen.
        --
        -- Eingefuehrt am 19.08.2026 um 11:42 (Commit e675efa), gemeldet am
        -- selben Tag. Der Alias steht jetzt da; und weil ein Alias leicht
        -- wieder verloren geht, wird er ausdruecklich uebergeben statt auf den
        -- Standardwert vertraut.
        -- ══════════════════════════════════════════════════════════════════
        COUNT(*) FILTER (WHERE ${sqlPool.unsafe(nichtWaehlbarSql("p"))}
                           AND NOT p.is_blocked)::int AS nummer_ohne_land
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
    `,
      // ── Zahlungszusagen: die einzige echte Terminliste ───────────────────
      sqlPool.unsafe(`
      SELECT ${KARTE_SQL}
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 2
        AND p.promised_payment_date IS NOT NULL
      ORDER BY p.promised_payment_date ASC
      LIMIT 60
    `, [me]),
      // ── Rückrufe: Datum UND Uhrzeit ─────────────────────────────────────
      sqlPool`
      SELECT DISTINCT ON (a.person_id)
             a.person_id, cl.scheduled_at, cl.note,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             -- 24.08.2026: VORHER fehlte hier die Rufnummer. Das Dashboard
             -- konnte die ECHTEN Rückrufe deshalb nicht anbieten (kein
             -- Anruf-Knopf ohne Nummer) und zeigte stattdessen die
             -- Zahlungszusagen unter der Überschrift „Rückrufe".
             -- GEMESSEN bei Daniel Stripling (Konto 8): 9 echte Rückrufe
             -- standen nirgends, 35 Zahlungszusagen standen als „Rückrufe" da.
             p.primary_phone,
             p.priority_tier, p.tier_reason
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE cl.outcome = 'rueckruf_termin' AND cl.voided_at IS NULL AND cl.done_at IS NULL
        AND p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 3
        AND cl.scheduled_at IS NOT NULL
      ORDER BY a.person_id, cl.scheduled_at DESC
    `,
    ]);

    const geld = (geldR as any[])[0] || {};
    const agentRow = (agentRowR as any[])[0];
    const offenerAntrag = (offenerAntragR as any[])[0];
    const zahlen = (zahlenR as any[])[0] || {};
    const rateBp = Number(agentRow?.commission_rate_bp || settings.default_commission_rate_bp || 1500);
    const mindest = parseInt(String(settings.payout_min_cents ?? "5000"), 10);

    // Zweite Welle: braucht den Provisionssatz von oben. „Möglich" heißt
    // ausdrücklich möglich — es ist KEIN Anspruch, sondern der Wert der offenen
    // Kunden zum eigenen Satz.
    const [moeglich = { cents: 0, anzahl: 0 }] = await sqlPool`
      SELECT COALESCE(SUM(ROUND(ROUND(COALESCE(a.amount_due::numeric, 0) * 100) * ${rateBp} / 10000.0)), 0)::bigint AS cents,
             COUNT(*)::int AS anzahl
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
        AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment', 'claimed_paid')
    `;

    res.json({
      ok: true,
      agent: {
        vorname: req.agent!.first_name || req.agent!.name,
        name: req.agent!.name,
        rolle: String(agentRow?.rolle || "agent"),
      },
      verdienst: {
        guthabenCents: Number(geld.guthaben),
        angefordertCents: Number(geld.angefordert),
        ausgezahltCents: Number(geld.ausgezahlt),
        monatCents: Number(geld.monat),
        moeglichCents: Number(moeglich.cents),
        moeglichAnzahl: Number(moeglich.anzahl),
        monatszielCents: agentRow?.monthly_goal_cents ? Number(agentRow.monthly_goal_cents) : null,
        satzBp: rateBp,
        mindestCents: mindest,
        auszahlbar: Number(geld.guthaben) >= mindest && !offenerAntrag,
        bankHinterlegt: !!agentRow?.bank_iban_masked,
        offenerAntrag: offenerAntrag
          ? { id: Number(offenerAntrag.id), cents: Number(offenerAntrag.amount_cents), am: offenerAntrag.requested_at }
          : null,
      },
      kunden: {
        offen: zahlen.offen, tier1: zahlen.tier1, tier2: zahlen.tier2, tier3: zahlen.tier3,
        bezahlt: zahlen.bezahlt,
        zusageHeute: zahlen.zusage_heute, zusageUeberfaellig: zahlen.zusage_ueberfaellig,
        rateOffen: zahlen.rate_offen,
        // Seit dem Kundenpool (25.08.2026) ist „dahinter" nicht mehr der eigene
        // Vorrat, sondern der gemeinsame Topf. Eine Abfrage ohne Zustaendigkeit
        // — der Pool gehoert per Definition niemandem.
        pool: await poolZahlen(),
      },
      zusagen: (zusagen as any[]).map(karte),
      // Auch hier die Art-Marke: Ein selbst notierter Rückruf ist grau und
       // damit klar vom Onboarding-Termin unterscheidbar. Ohne sie stand in der
       // Leiste nur ein Name und eine Uhrzeit — und Daniel musste raten, wer
       // zuständig ist.
      rueckrufe: (rueckrufe as any[]).map((r) => {
        const marke = terminArtRueckruf();
        return {
          personId: Number(r.person_id),
          name: r.name,
          am: r.scheduled_at,
          // 24.08.2026 mitgeliefert — ohne sie war der Anruf-Knopf tot.
          telefon: r.primary_phone ?? null,
          notiz: r.note,
          tier: Number(r.priority_tier),
          tierGrund: r.tier_reason,
          terminArt: marke.art,
          terminArtText: marke.text,
          terminArtTon: marke.ton,
          terminArtErklaerung: marke.erklaerung,
        };
      }).sort((a, b) => +new Date(a.am) - +new Date(b.am)),
    });
  } catch (err) {
    console.error("[AGENT-START] start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/kunden/liste — DIE Arbeitsliste
//
// Die Sortierung nimmt dem Agenten die Frage ab, wen er als nächstes anruft.
// Genau diese Frage hat die alte Tagesliste beantwortet — jetzt steht die
// Antwort in derselben Liste, in der auch gearbeitet wird.
// ═══════════════════════════════════════════════════════════════════════════
type Sortierung = "arbeit" | "neu" | "betrag" | "name";

/**
 * Die Reihenfolge fuer ONBOARDING (20.08.2026).
 *
 * Nicht die Vertriebs-Rangfolge (Zusagen, Rueckrufe, Stufen) — die passt hier
 * nicht: Onboarding arbeitet einen TAG ab, und der Tag hat Uhrzeiten.
 *
 *   1 Termin HEUTE, nach Uhrzeit aufsteigend — der naechste zuerst
 *   2 kommende Termine, der naechste zuerst
 *   3 vergangene OHNE Ergebnis (erledigt_am IS NULL) — die Nacharbeit
 *   4 alles uebrige
 */
const ORDNUNG_ONBOARDING = `
  CASE
    WHEN q.termin_beginn IS NULL THEN 5
    WHEN (q.termin_beginn AT TIME ZONE 'Europe/Berlin')::date
         = (NOW() AT TIME ZONE 'Europe/Berlin')::date THEN 1
    WHEN q.termin_beginn > NOW() THEN 2
    WHEN q.termin_erledigt_am IS NULL THEN 3
    ELSE 4
  END,
  CASE
    WHEN q.termin_beginn >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
      THEN q.termin_beginn
    ELSE NULL
  END ASC NULLS LAST,
  q.termin_beginn DESC NULLS LAST`;

const ORDNUNG: Record<Sortierung, string> = {
  // Arbeitsreihenfolge — die fachliche Rangfolge, in SQL gegossen:
  //   1 Zusage heute oder überfällig   (ein gegebenes Wort hat ein Datum)
  //   2 Rückruf heute oder überfällig  (ein vereinbarter Termin)
  //   3 Tier 1 — Zahlung gemeldet
  //   4 Tier 2 — Rechnung offen, dann Frist abgelaufen, dann Antrag fertig
  //   5 Tier 3 — Antrag abgebrochen, dann nur Lead
  // Innerhalb jeder Gruppe: längste Wartezeit zuerst.
  arbeit: `
    CASE
      -- 1 Gebuchter Termin heute. Der Kunde hat sich die Uhrzeit selbst
      --   ausgesucht und wartet — das schlaegt alles andere.
      WHEN EXISTS (
        SELECT 1 FROM fiaon_termine t
        WHERE t.person_id = p.id AND t.status = 'gebucht'
          AND t.beginn::date = ${HEUTE}
      ) THEN 1
      WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE} THEN 2
      WHEN EXISTS (
        SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
        WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
          AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()
      ) THEN 3
      -- Ab hier die Stufen: A vor B vor C. Innerhalb von B bleibt die
      -- bewaehrte Feinsortierung (offene Rechnung vor abgelaufener Frist).
      WHEN p.priority_tier = 1 THEN 4
      WHEN p.priority_tier = 2 AND p.tier_reason = 'rechnung_offen' THEN 5
      WHEN p.priority_tier = 2 AND p.tier_reason = 'zahlungsfrist_abgelaufen' THEN 6
      WHEN p.priority_tier = 2 THEN 7
      WHEN p.priority_tier = 3 AND p.tier_reason = 'antrag_abgebrochen' THEN 8
      ELSE 9
    END ASC,
    -- Innerhalb des Termin-Rangs nach Uhrzeit: 09:20 vor 14:40.
    (SELECT MIN(t2.beginn) FROM fiaon_termine t2
      WHERE t2.person_id = p.id AND t2.status = 'gebucht' AND t2.beginn > NOW()) ASC NULLS LAST,
    (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
      JOIN fiaon_applications a4 ON a4.ref = cl.ref
      WHERE a4.person_id = p.id AND cl.voided_at IS NULL) ASC NULLS FIRST,
    p.id ASC`,
  neu: `p.assigned_at DESC NULLS LAST, p.id DESC`,
  betrag: `(SELECT MAX(a5.amount_due) FROM fiaon_applications a5
             WHERE a5.person_id = p.id AND a5.merged_into IS NULL) DESC NULLS LAST, p.id ASC`,
  name: `${NAME_SQL} ASC`,
};

/**
 * GET /agent/termine/faellig — was steht in der nächsten halben Stunde an?
 *
 * ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
 * Ein Agent: „Bei gebuchten Terminen/Rückrufen gibt es aktuell keine
 * Erinnerung, wodurch Termine schnell übersehen oder verpasst werden können."
 *
 * Eine Mail-Erinnerung gibt es bereits (`runCallbackReminders`, 60 Minuten
 * vorher über Make). Sie hängt an einem externen Dienst, einer
 * Zweig-Konfiguration und einem offenen Postfach.
 *
 * Diese Route bedient die Leiste IM PORTAL — sie braucht nichts davon.
 *
 * ── AUCH DAS ÜBERFÄLLIGE ───────────────────────────────────────────────────
 * Ein Termin, der vor zwanzig Minuten war, ist wichtiger als einer in zwanzig
 * Minuten. Deshalb reicht das Fenster zwei Stunden zurück: Wer gerade
 * telefoniert hat und danach ins Portal schaut, soll sehen, was er verpasst
 * hat — nicht nur, was kommt.
 */
router.get("/agent/termine/faellig", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const vorlauf = Math.min(120, Math.max(5, Number(req.query.vorlauf) || 30));
    const me = req.agent!.id;

    // ── DAS GESPRÄCH VON HEUTE ZÄHLT (24.08.2026, Justins Meldung) ─────────
    // VORHER: Die Leiste erinnerte an einen Rückruf, obwohl der Kunde HEUTE
    // längst erreicht war und „Mandat nicht zustande gekommen“ (abgelehnt)
    // bzw. „Anrufer blockiert“ gebucht wurde — die Erinnerung überlebte ihr
    // eigenes Ergebnis.
    // NACHHER: Ist das LETZTE heutige Kontakt-Ergebnis der Person (Berliner
    // Tag, nicht storniert) „erreicht_abgelehnt“ oder „nummer_blockiert“,
    // fällt der Eintrag aus der Leiste. Ein späteres neues Ergebnis (z. B.
    // erneuter Rückruf-Termin) holt ihn zurück, weil dann ES das letzte ist.
    const ohneHeutigeAbsage = () => sqlPool`
      COALESCE((
        SELECT cl2.outcome FROM fiaon_contact_log cl2
        JOIN fiaon_applications a2 ON a2.ref = cl2.ref
        WHERE a2.person_id = p.id AND cl2.voided_at IS NULL AND cl2.outcome IS NOT NULL
          AND (cl2.created_at AT TIME ZONE 'Europe/Berlin')::date
            = (NOW() AT TIME ZONE 'Europe/Berlin')::date
        ORDER BY cl2.created_at DESC LIMIT 1
      ), '') NOT IN ('erreicht_abgelehnt', 'nummer_blockiert')
    `;

    const [rueckrufe, gespraeche] = await Promise.all([
      // Rückrufe aus dem Kontaktverlauf.
      sqlPool`
        SELECT DISTINCT ON (a.person_id)
               cl.id AS log_id, a.person_id, cl.scheduled_at, cl.note,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, p.primary_phone, 'Ohne Namen') AS name
        FROM fiaon_contact_log cl
        JOIN fiaon_applications a ON a.ref = cl.ref
        JOIN fiaon_persons p ON p.id = a.person_id
        WHERE cl.agent_id = ${me}
          AND cl.outcome = 'rueckruf_termin'
          AND cl.done_at IS NULL AND cl.voided_at IS NULL
          AND cl.scheduled_at IS NOT NULL
          AND cl.scheduled_at BETWEEN NOW() - INTERVAL '2 hours'
                                  AND NOW() + (${vorlauf} || ' minutes')::interval
          AND p.merged_into_person_id IS NULL
          AND ${ohneHeutigeAbsage()}
        ORDER BY a.person_id, cl.scheduled_at DESC
      `,
      // Und gebuchte Startgespräche.
      // 24.08.2026: `abgesagt_am IS NULL` fehlte — eine Absage lässt den
      // Status auf 'gebucht' stehen (siehe fiaon-onboarding-bereich.ts), die
      // Leiste erinnerte also an abgesagte Termine. Erledigte und verpasste
      // hält weiterhin `status = 'gebucht'` fern.
      sqlPool`
        SELECT t.id AS log_id, t.person_id, t.beginn AS scheduled_at, NULL::text AS note,
               t.quelle,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.contact_name, 'Ohne Namen') AS name
        FROM fiaon_termine t
        JOIN fiaon_persons p ON p.id = t.person_id
        WHERE t.agent_id = ${me} AND t.status = 'gebucht'
          AND t.abgesagt_am IS NULL
          AND t.beginn BETWEEN NOW() - INTERVAL '2 hours'
                           AND NOW() + (${vorlauf} || ' minutes')::interval
          AND p.merged_into_person_id IS NULL
          AND ${ohneHeutigeAbsage()}
      `.catch(() => [] as any[]),
    ]);

    const bauen = (r: any, art: "rueckruf" | "startgespraech") => {
      // ── DIE TERMIN-ART AUS DER EINEN ABLEITUNG (30.08.2026) ─────────────
      // Die obere Leiste hatte ihren eigenen Wortschatz („Startgespraech" /
      // „Rueckruf") aus einem Feld, das nur sie kennt. Das war die dritte
      // Fassung derselben Frage. `art` bleibt (die Leiste unterscheidet damit,
      // welche Route der Klick anspricht), die ANZEIGE kommt aus
      // shared/fiaon-termin-art.ts — dieselbe Quelle wie im Kalender und in
      // der Termin-Zentrale.
      const marke = art === "rueckruf" ? terminArtRueckruf() : terminArtAusQuelle(r.quelle);
      return {
        logId: Number(r.log_id),
        personId: Number(r.person_id),
        name: String(r.name),
        wann: new Date(r.scheduled_at).toISOString(),
        inMinuten: Math.round((new Date(r.scheduled_at).getTime() - Date.now()) / 60_000),
        notiz: r.note ? String(r.note).slice(0, 90) : null,
        art,
        terminArt: marke.art,
        terminArtText: marke.text,
        terminArtTon: marke.ton,
        terminArtErklaerung: marke.erklaerung,
      };
    };

    res.json({
      ok: true,
      termine: [
        ...(rueckrufe as any[]).map((r) => bauen(r, "rueckruf")),
        ...(gespraeche as any[]).map((r) => bauen(r, "startgespraech")),
      ].sort((a, b) => a.inMinuten - b.inMinuten),
    });
  } catch (err) {
    console.error("[AGENT] termine/faellig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/kunden/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKartenSpalten();
    // ══════════════════════════════════════════════════════════════════════
    // DAS FORDERUNGSMANAGEMENT SIEHT DIESE LISTE NICHT
    //
    // ── DER BEFUND ────────────────────────────────────────────────────────
    // Der Vorgesetzte: „Die Abteilung Forderungsmanagement hat Kunden drinnen,
    // die die Agenten abgelehnt haben oder auf nicht erreicht. Das ist falsch!
    // Das Forderungsmanagement hat NUR ausschließlich die Kunden, die ihr Abo
    // nicht bezahlt haben."
    //
    // Die Rate-Liste selbst war sauber — gemessen: alle 100 Zeilen `tier 0
    // (bezahlt)`, keine abgelehnte, keine nicht erreichte. Das Leck war ein
    // anderes: Der Menüpunkt „Kunden" trug KEINE Rollenbeschränkung. Ein
    // Inkasso-Konto meldet sich an, sieht „Kunden" im Menü und öffnet damit
    // die volle Vertriebsliste — mit Ablehnungen, Leads und allem.
    //
    // ── DIE WAND STEHT IM SERVER, NICHT IM MENÜ ───────────────────────────
    // Einen Menüpunkt auszublenden ist keine Grenze, sondern eine Bitte: Die
    // Adresse steht weiter offen, und wer sie einmal gesehen hat, ruft sie
    // wieder auf. Dieselbe Bauweise wie beim Vertrieb und beim Onboarding.
    // ══════════════════════════════════════════════════════════════════════
    // ── E-045 (Justin 23.08., Plan §17): DIE WAND IST OFFEN ───────────────
    // VORHER: 404 für die Rolle „inkasso" (Block oben, seitdem Geschichte).
    // NACHHER: Die Bereichs-Trennung ist aufgehoben — Diana (Back-Office
    // Forderungen & Zahlungen) darf LESEN. Die Liste bleibt trotzdem sauber:
    // Sie zeigt nur `assigned_agent_id = ich`, und Diana betreut niemanden —
    // ihre Liste ist leer, ihre Fälle erreicht sie über die Akte
    // (/agent/crm/kunden/:id, dort lesend geöffnet) und /inkasso/liste.
    await ensureBetreuungSpalte(sqlPool);
    const me = req.agent!.id;
    const filter = String(req.query.filter || "alle");
    const sortRoh = String(req.query.sort || "arbeit") as Sortierung;
    const sort: Sortierung = ORDNUNG[sortRoh] ? sortRoh : "arbeit";
    const q = String(req.query.q || "").trim();
    // Telefonsuche formatfrei (01.09.2026, Team-Feedback P8): "0176 123…",
    // "0176-123…" und "+49176123…" müssen denselben Kunden finden. Die Eingabe
    // wird auf signifikante Ziffern reduziert, die gespeicherte Nummer im SQL.
    const telSuche = normalizeSearchDigits(q) || "";
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 300));

    // ══════════════════════════════════════════════════════════════════════
    // EIN ANGESPRUNGENER KUNDE STEHT IMMER IN DER LISTE
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Wenn ich auf einen gebuchten Termin klicke, lande ich zwar
    // im Bereich Kunden, aber nicht beim entsprechenden Kunden und muss ihn
    // anschließend nochmal manuell suchen."
    //
    // Der Sprung (?person=) war gebaut — er ging nur ins Leere, wenn der Kunde
    // nicht in der gefilterten Liste steht. Ein Rückruf kann bei jemandem
    // liegen, der ruht, bezahlt hat oder in einer anderen Stufe ist.
    //
    // Diese eine Kennung hebt jeden Filter auf. Die Rechteprüfung bleibt:
    // `assigned_agent_id = $1` steht unverändert davor, also sieht niemand
    // einen fremden Kunden.
    // ══════════════════════════════════════════════════════════════════════
    const nurPerson = req.query.person ? Number(req.query.person) : null;

    // ══════════════════════════════════════════════════════════════════════
    // ONBOARDING IST NIE BETREUER — UND SAH DESHALB „0 KUNDEN" (20.08.2026)
    //
    // ── DER BEFUND ────────────────────────────────────────────────────────
    // Viktoria Reichert und Rifka Rovcanin haben heute Startgespräche und sehen
    // eine leere Kundenliste. GEMESSEN:
    //
    //   Rifka Rovcanin    Betreuer bei  0 Kunden ·  15 Termine ·  5 HEUTE
    //   Viktoria Reichert Betreuer bei  0 Kunden ·   6 Termine ·  5 HEUTE
    //
    // Zwei Gründe, beide hier:
    //   1. `p.assigned_agent_id = $1` — die Betreuung liegt beim VERTRIEB.
    //      Onboarding wird nie eingetragen, also ist die Menge immer leer.
    //   2. Selbst mit richtiger Zuordnung hätte der Tier-Filter unten
    //      (`priority_tier BETWEEN 1 AND 3`) sie geleert: Ein Kunde im
    //      Onboarding HAT bezahlt und steht damit auf Tier 0.
    //
    // ── WAS ONBOARDING STATTDESSEN SIEHT ──────────────────────────────────
    // Die Menschen, mit denen sie sprechen: Kunden mit einem Startgespräch-
    // Termin bei DIESEM Mitarbeiter — offen, heute, oder in den letzten
    // 14 Tagen. Die Grenze bleibt eine WHERE-Bedingung (AGENTS.md): Ein
    // Onboarder sieht keinen fremden Kunden, weil `t.agent_id = $1` steht.
    // ══════════════════════════════════════════════════════════════════════
    const { istOnboarding } = await import("./fiaon-onboarding-bereich");
    const onboarding = await istOnboarding(me);
    // ── P13 (01.09.2026): DIE LEITUNG DARF SUCHEN ─────────────────────────
    // darfAnKunde erlaubt der Vertriebsleitung längst jede Akte — aber diese
    // Liste kannte nur „eigene Kunden". Ergebnis: Die Leitung konnte fremde
    // Kunden zwar BEARBEITEN, aber nicht FINDEN. Geöffnet wird NUR die aktive
    // Suche (q) und der ?person=-Sprung; die Arbeitsliste ohne Suchbegriff
    // bleibt die eigene — die Leitung bekommt keinen 5000er-Vorrat.
    const { istVertriebsleiter } = await import("./fiaon-vertrieb");
    const leitung = !onboarding && (await istVertriebsleiter(me));
    // Nur die AKTIVE SUCHE öffnet die Grundmenge; der ?person=-Sprung öffnet
    // unten gezielt EINE Person. Ohne Suchbegriff bliebe wo[0]=TRUE sonst ein
    // Vollzugriff auf die ganze Liste — genau das soll es nicht geben.
    const leitungSucht = leitung && q !== "";

    const ONBOARDING_ZUSTAENDIG = `EXISTS (
      SELECT 1 FROM fiaon_termine t
       WHERE t.person_id = p.id AND t.agent_id = $1
         AND t.abgesagt_am IS NULL
         AND (t.beginn AT TIME ZONE 'Europe/Berlin')::date
             >= (NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '14 days'
    )`;

    const wo: string[] = [
      // `$1 OR TRUE` statt blankem TRUE: postgres.js meldet 42P18, wenn ein
      // mitgeschickter Parameter im SQL nirgends vorkommt (Kartei-Lehre).
      onboarding ? ONBOARDING_ZUSTAENDIG : (leitungSucht ? "(p.assigned_agent_id = $1 OR TRUE)" : "p.assigned_agent_id = $1"),
      "p.merged_into_person_id IS NULL",
      // Testeinträge sind keine Kunden (server/lib/fiaon-testerkennung.ts).
      "p.ist_test_am IS NULL",
    ];
    // Bezahlte Kunden sind KEIN Arbeitsvorrat. Sie sind über den eigenen Filter
    // erreichbar, stehen aber nie in der Standardliste — sonst arbeitet man sich
    // durch Menschen, die schon gezahlt haben.
    if (filter === "bezahlt") wo.push("p.priority_tier = 0");
    else if (filter === "gesperrt") wo.push("p.is_blocked");
    // ── ONBOARDING KENNT KEINE STUFEN ──────────────────────────────────────
    // Der Zweig unten schraenkt auf `priority_tier BETWEEN 1 AND 3` ein — also
    // auf Menschen mit offener Arbeit im VERTRIEB. Ein Kunde im Onboarding hat
    // bezahlt und steht auf Tier 0; er waere hier wieder herausgefallen, und die
    // Liste bliebe leer. Der Termin IST die Arbeit, nicht die Stufe.
    else if (onboarding) {
      // Gesperrte bleiben draussen — mit einem gesperrten Konto kann man kein
      // Startgespraech fuehren.
      wo.push("NOT p.is_blocked");
    }
    // ══════════════════════════════════════════════════════════════════════
    // WER SUCHT, WILL FINDEN — NICHT ARBEITEN (25.08.2026)
    //
    // ── DER BEFUND (Justin) ───────────────────────────────────────────────
    // „Bei ‚Kunde' in der Suchfunktion findet man seinen eigenen Kunden nicht,
    // wenn man ihn eintippt."
    //
    // URSACHE: Ohne Filter läuft diese Route in den Zweig unten und schränkt
    // auf `priority_tier BETWEEN 1 AND 3` ein. Das ist für eine ARBEITSLISTE
    // richtig — wer bezahlt hat, ist kein Arbeitsvorrat mehr. Für eine SUCHE
    // ist es falsch: Wer einen Namen eintippt, will genau diesen Menschen,
    // gleich in welcher Stufe er steht.
    //
    // GEMESSEN am 25.08.2026: 700 von 5.032 zugewiesenen Menschen waren über
    // die Suche nicht erreichbar — jeder bezahlte Kunde, also gerade die, die
    // man am längsten betreut. Bei Justin selbst 3 von 13.
    //
    // NACHHER hebt eine Suchanfrage die Stufengrenze auf. Die
    // Zuständigkeitsgrenze bleibt unberührt: `assigned_agent_id = $1` steht
    // weiterhin ganz vorn, also findet niemand einen fremden Kunden.
    // ══════════════════════════════════════════════════════════════════════
    else if (q && filter === "alle") {
      // Nur beim Standardfilter. Wer ausdrücklich „Stufe 1" gewählt hat und
      // DANN sucht, meint die Schnittmenge — eine Suche, die den eben
      // gewählten Filter stillschweigend übergeht, ist ihre eigene
      // Fehlerquelle.
      // Gesperrte bleiben hier sichtbar: Wer nach jemandem sucht, den er
      // gesperrt hat, sucht meistens genau deshalb.
    }
    else {
      wo.push("p.priority_tier BETWEEN 1 AND 3", "NOT p.is_blocked");
      // ══════════════════════════════════════════════════════════════════════
      // DER UNBERÜHRTE VORRAT BLEIBT UNSICHTBAR (25.08.2026)
      //
      // Justin, wörtlich und mit Nachdruck: „die Mitarbeiter sehen immer nur
      // 2A, 2B und 2C Leads" — die Arbeitsliste zeigt zwei je Stufe, nach
      // jedem Anruf wird nachgeschoben. Der Topf DAHINTER (am 25.08. fair auf
      // alle acht verteilt, ~360 je Kopf) ist Nachschub, keine Lektüre:
      // Eine Liste mit 700 Namen wirkt „zu umständlich und zu viel" (Justin)
      // und verleitet zum Rosinenpicken statt zur Reihenfolge der Liste.
      //
      // Sichtbar bleibt in den Stöber-Ansichten deshalb nur, was WIRKLICH
      // dem Mitarbeiter gehört: Mandate und jeder Mensch, mit dem je etwas
      // passiert ist (Verlaufseintrag oder Termin). Die SUCHE (Zweig oben)
      // findet weiterhin jeden eigenen Kunden — wer einen Namen tippt, meint
      // diesen Menschen. Und der Nachschub der Arbeitsliste greift auf den
      // vollen Topf zu; er liest nicht über diesen Weg.
      // ══════════════════════════════════════════════════════════════════════
      wo.push(`(p.mandat_seit IS NOT NULL
        OR EXISTS (SELECT 1 FROM fiaon_contact_log clv JOIN fiaon_applications av ON av.ref = clv.ref WHERE av.person_id = p.id)
        OR EXISTS (SELECT 1 FROM fiaon_contact_log clv2 WHERE clv2.person_id = p.id)
        OR EXISTS (SELECT 1 FROM fiaon_termine tv WHERE tv.person_id = p.id))`);
      if (filter === "tier1") wo.push("p.priority_tier = 1");
      // ── WER BRAUCHT EINE ERSTE RECHNUNG? ────────────────────────────────
      // Der Vorgesetzte: „ALLE die einen Antrag bei uns gestellt haben brauchen
      // eine Rechnung und müssen den Agenten eben passend angezeigt werden und
      // mit Knopfdruck versendbar sein!"
      //
      // Die Zustandsliste steht in fiaon-rechnung-stellen.ts (RECHNUNGSREIF) —
      // hier nur die Auswahl. Angefangene Formulare (personal_data, contract,
      // finances) sind NICHT dabei: Gemessen haben von 3.626 personal_data-
      // Einträgen genau 6 eine E-Mail. Das sind Spuren im Trichter, keine
      // Anträge.
      else if (filter === "rechnung_stellen") {
        wo.push(`EXISTS (
          SELECT 1 FROM fiaon_applications ar
          WHERE ar.person_id = p.id AND ar.merged_into IS NULL
            AND ar.archived_at IS NULL AND ar.gdpr_deleted_at IS NULL
            AND ar.payment_status = 'pending'
            AND ar.status IN ('completed','approved','submitted','documents_submitted','verifying','processing')
        )`);
      }
      else if (filter === "rechnung_offen") wo.push("p.tier_reason = 'rechnung_offen'");
      else if (filter === "frist_abgelaufen") wo.push("p.tier_reason = 'zahlungsfrist_abgelaufen'");
      else if (filter === "antrag_offen") wo.push("p.tier_reason IN ('antrag_abgeschlossen', 'antrag_abgebrochen')");
      else if (filter === "leads") wo.push("p.priority_tier = 3");
      else if (filter === "zusage_heute") wo.push(`p.promised_payment_date = ${HEUTE}`);
      else if (filter === "ueberfaellig") wo.push(`p.promised_payment_date < ${HEUTE}`);
      // ══════════════════════════════════════════════════════════════════════
      // OFFENE RATEN GEHÖREN DEM BETREUER (25.08.2026)
      //
      // ── DER BEFUND ───────────────────────────────────────────────────────
      // Justin: „es gibt keine anderen Abteilungen mehr!!!!!" Damit fällt der
      // eigene Raum fürs Forderungsmanagement weg — und mit ihm der einzige
      // Ort, an dem eine überfällige Rate bisher sichtbar war.
      //
      // GEMESSEN am 25.08.2026: 203 überfällige Raten, davon 185 bei Menschen
      // auf STUFE 0. Stufe 0 heißt „hat bezahlt" und ist aus der Arbeitsliste
      // ausgenommen — zu Recht, denn ein zahlender Kunde ist kein Vorrat.
      // Nur: Wer eine Rate schuldet, zahlt gerade eben NICHT. Ohne diesen
      // Filter wären 185 Raten in niemandes Liste mehr aufgetaucht.
      // Sie verteilen sich über neun Mitarbeiter — Daniel 74, Nikita 67,
      // Florentine 41, Lucas 11, Justin 4.
      //
      // Deshalb hebt dieser Filter die Stufengrenze auf, genau wie die Suche:
      // Er fragt nicht nach dem Vorrat, sondern nach einer Schuld. Die
      // Zuständigkeit bleibt unberührt — jeder sieht nur seine eigenen Leute.
      // ══════════════════════════════════════════════════════════════════════
      else if (filter === "rate_offen") {
        wo.push(`EXISTS (
          SELECT 1 FROM fiaon_abo_raten r7
          JOIN fiaon_applications a7 ON a7.ref = r7.ref
          WHERE a7.person_id = p.id AND a7.merged_into IS NULL
            AND r7.status IN ('offen','ueberfaellig')
            AND r7.faellig_am < CURRENT_DATE
            AND r7.storniert_am IS NULL AND r7.bezahlt_am IS NULL)`);
      }
      else if (filter === "rueckruf") {
        wo.push(`EXISTS (
          SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a6 ON a6.ref = cl.ref
          WHERE a6.person_id = p.id AND cl.outcome = 'rueckruf_termin'
            AND cl.done_at IS NULL AND cl.voided_at IS NULL)`);
      } else if (filter === "nicht_erreicht") wo.push("p.unreachable_count > 0");
      // ══════════════════════════════════════════════════════════════════════
      // NUMMER OHNE LAND — EINE ARBEITSLISTE, KEINE DATEI (31.08.2026)
      //
      // ── DER BEFUND ───────────────────────────────────────────────────────
      // Seit dem 31.08.2026 verweigert `wahlPruefen` eine national geschriebene
      // Nummer (fuehrende 0) ohne Land in der Akte, statt „+49" zu raten. Das
      // ist richtig: Eine geratene Vorwahl ergibt eine GUELTIGE Nummer in einem
      // anderen Land — dann klingelt es bei einem Fremden. Bewiesen an Kunde
      // Maurizio Pampanini (CH), bei dem dreimal +49797435749 gewaehlt wurde.
      //
      // Aber die betroffenen Kunden sind damit nicht anrufbar. GEMESSEN: 44
      // nationale Nummern, 18 davon in einem anderen Land als Deutschland.
      // Eine CSV-Datei haette niemand abgearbeitet — sie waere nach zwei Tagen
      // vergessen. Ein FILTER mit Zaehler wird leer, und das sieht man.
      //
      // Die Bedingung ist dieselbe wie in `wahlPruefen`: fuehrende 0 (aber nicht
      // 00, das ist die alte Auslandsschreibweise) und kein Land in der Akte,
      // aus dem sich eine Vorwahl ableiten liesse.
      else if (filter === "nummer_ohne_land") {
        wo.push(nichtWaehlbarSql("p"));
      }
      else if (filter === "ruhend") wo.push(ruhtSql("p"));
      // ── WARTET AUF DEN KUNDEN ────────────────────────────────────────────
      // GEMESSEN: 185 verschickte Nummern-Anfragen ohne Antwort, 120 davon
      // länger als sieben Tage — und alle standen weiter jeden Tag in der
      // Arbeitsliste. Bei einem Kunden, dessen Nummer nicht stimmt, kann
      // niemand etwas tun. Eine Karte, bei der man nichts tun kann, ist keine
      // Aufgabe, sondern ein Übungsstück im Überblättern.
      //
      // Der Filter ist nötig, damit die Fälle SICHTBAR bleiben: Sie sind nicht
      // weg, sie sind nur nicht heute.
      else if (filter === "wartend") wo.push(wartetSql("p"));

      // ── DER RUHE-POOL IST KEIN VERSTECKTES LOCH ──────────────────────────
      // Wer viermal nicht erreicht wurde, verschwindet aus der TAGESLISTE —
      // nicht aus dem Bestand. Deshalb wird er nur in den Ansichten
      // ausgeblendet, in denen der Agent „wen rufe ich jetzt an?" fragt.
      // Im Filter „Ruhend" und in jeder gezielten Suche steht er weiter da;
      // eine Suche, die einen Kunden nicht findet, den es gibt, ist der
      // schlimmere Fehler.
      if (!["ruhend", "nicht_erreicht", "gesperrt", "bezahlt", "wartend"].includes(filter) && !q) {
        wo.push(`NOT ${ruhtSql("p")}`);
        // Wer auf den Kunden wartet, ist heute nicht dran — aber im Filter
        // „Wartend" und in jeder Suche steht er weiter da.
        wo.push(`NOT ${wartetSql("p")}`);

        // ══════════════════════════════════════════════════════════════════
        // WER EINE VERABREDUNG IN DER ZUKUNFT HAT, IST HEUTE FERTIG
        //
        // ── DER ANLASS ────────────────────────────────────────────────────
        // Ein Agent: „Wenn ich den Kunden ‚nicht erreicht' klicke, bleibt er
        // trotzdem in der Liste — verschwinden tut er bei mir nicht."
        //
        // Gemessen am 11.08.2026: **311 Kunden** hatten eine Wiedervorlage in
        // der Zukunft und standen trotzdem in den Arbeitslisten. Das Ergebnis
        // setzte `follow_up_date = morgen`, aber die Liste sah es nicht an.
        //
        // Die Folge ist genau die, die der Agent beschreibt: Er ruft denselben
        // Menschen zweimal an. Für den Kunden ist das aufdringlich, für den
        // Agenten Zeitverlust, und die Liste wird nie kürzer — sie ist ein
        // Eimer ohne Boden.
        //
        // ── DIE REGEL ─────────────────────────────────────────────────────
        // Eine Wiedervorlage in der Zukunft ist eine VERABREDUNG. Wer sie hat,
        // gehört heute nicht in die Frage „wen rufe ich jetzt an?".
        //
        // Ausgenommen: eine Zahlungszusage. Wer für den 20. zugesagt hat, muss
        // trotzdem sichtbar bleiben — nicht zum Anrufen, sondern weil sein
        // Geld erwartet wird. Dafür gibt es die Filter „Zusage heute" und
        // „Überfällig".
        //
        // Der Kunde ist NICHT weg: Er steht im Filter „Nicht erreicht" und in
        // jeder Suche. Eine Liste, die einen Kunden versteckt, den es gibt,
        // wäre der schlimmere Fehler.
        // ══════════════════════════════════════════════════════════════════
        wo.push(`(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})`);
      }
    }

    // Drei unabhängige Auskünfte — gleichzeitig, nicht hintereinander. Sonst
    // kostet die Liste drei Wege zur Datenbank statt einem (siehe Startseite).
    const [rows, zR, rueckrufR] = await Promise.all([
      sqlPool.unsafe(`
      ${onboarding ? "SELECT * FROM (" : ""}
      SELECT ${KARTE_SQL}
      FROM fiaon_persons p
      WHERE (${wo.join(" AND ")}${nurPerson && Number.isFinite(nurPerson)
        ? `\n             OR (${leitung ? "" : "p.assigned_agent_id = $1 AND "}p.id = ${Math.trunc(nurPerson)})` : ""})
        AND ($2 = '' OR ${NAME_SQL} ILIKE '%' || $2 || '%'
             OR COALESCE(p.primary_email, '') ILIKE '%' || $2 || '%'
             OR COALESCE(p.primary_phone, '') ILIKE '%' || $2 || '%'
             OR ($3 <> '' AND regexp_replace(COALESCE(p.primary_phone, ''), '[^0-9]', '', 'g') LIKE '%' || $3 || '%')
             -- ── UNSCHARFE NAMENSSUCHE (25.08.2026) ────────────────────────
             -- Meldung von Daniel und Florentine: „Beim Versuch, den Termin
             -- neu anzulegen, wird der Kunde nicht gefunden" — für Konstantin
             -- von Reizenstein.
             -- GEMESSEN: Der Mensch heißt „von Rei-TZ-enstein". Die Suche
             -- verglich wörtlich, also fand sie nichts. Genau so verlieren
             -- Mitarbeiter Kunden: nicht weil die Daten fehlen, sondern weil
             -- ein Buchstabe anders ist als erinnert.
             -- NACHHER greift zusätzlich die Ähnlichkeitssuche aus pg_trgm
             -- (bereits installiert). Für „Konstantin von Reizenstein" liefert
             -- sie „Konstantin von Reitzenstein" mit 0,82 — gemessen am
             -- 25.08.2026, und der Treffer steht an erster Stelle.
             -- Die Schwelle 0.32 ist bewusst nicht niedriger: Darunter kommen
             -- Namen wie „Rabensteiner" mit, und eine Liste voller Fremder ist
             -- schlimmer als kein Treffer.
             OR (length($2) >= 4 AND similarity(${NAME_SQL}, $2) > 0.32)
             OR EXISTS (SELECT 1 FROM fiaon_applications a7 WHERE a7.person_id = p.id
                          AND (a7.ref ILIKE '%' || $2 || '%'
                               OR COALESCE(a7.payment_reference, '') ILIKE '%' || $2 || '%')))
      ${onboarding
        // ── EINE HUELLE, WEIL ALIASE IM ORDER BY NICHT GEHEN (20.08.2026) ──
        // Erster Entwurf sortierte direkt ueber `termin_beginn`. Die Route
        // antwortete mit HTTP 500: `column "t_beginn" does not exist`. In
        // PostgreSQL ist ein Alias aus der SELECT-Liste im ORDER BY nur als
        // BLANKER Name erlaubt, nicht in einem CASE-Ausdruck. Der Hinweis stand
        // in meinem eigenen Kommentar zwei Zeilen darueber.
        //
        // Die Unterabfragen im ORDER BY zu wiederholen waere der andere Weg und
        // der langsamere: Sie liefen zweimal je Zeile, und die Abfrage brauchte
        // schon knapp drei Sekunden. Eine Huelle rechnet sie einmal.
        ? `) q ORDER BY ${ORDNUNG_ONBOARDING} LIMIT ${limit}`
        : `ORDER BY ${ORDNUNG[sort]} LIMIT ${limit}`}
    `, [me, q, telSuche]),
      // Zähler für die Filter-Chips — in EINER Abfrage, damit die Chips nicht
      // zehn Anfragen kosten.
      sqlPool`
      SELECT
        -- ══════════════════════════════════════════════════════════════════
        -- DIE ZÄHLER MÜSSEN DIESELBE MENGE ZÄHLEN WIE DIE LISTE ZEIGT
        --
        -- ── DER BEFUND (11.08.2026) ───────────────────────────────────────
        -- Ein Agent: „Die Zahlen oben stimmen teilweise nicht mit den
        -- tatsächlich enthaltenen Kunden überein. Beispiel: Zahlung gemeldet
        -- zeigt 23, im Ordner befinden sich aber nur 2."
        --
        -- Die Liste filtert zwei Dinge zusätzlich, die hier fehlten:
        --   ist_test_am IS NULL   Testeinträge sind keine Kunden
        --   NOT ruht              wer viermal nicht erreicht wurde, ruht
        --
        -- Heute ergibt beides zufällig dieselbe Zahl (gemessen bei allen fünf
        -- Agenten: keine Lücke). Das ist kein Zustand, auf den man baut —
        -- sobald ein Kunde in den Ruhe-Pool wandert, klafft sie wieder.
        --
        -- Ein Zähler, der eine andere Menge zählt als die Liste zeigt, ist der
        -- schlimmere Fehler: Dann traut man keiner Zahl mehr.
        -- ══════════════════════════════════════════════════════════════════
        -- Seit 22.08.2026 tragen ALLE Chips dieselben zwei Bedingungen wie die
        -- Liste (NOT ruht, Wiedervorlage nicht in der Zukunft) — nicht nur
        -- „Rechnung stellen". Sonst klafft B7 wieder, sobald der erste
        -- Tier-1-Kunde in den Ruhe-Pool wandert.
        COUNT(*) FILTER (WHERE priority_tier BETWEEN 1 AND 3 AND NOT is_blocked
          AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS alle,
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked
          AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS tier1,
        COUNT(*) FILTER (WHERE tier_reason = 'rechnung_offen' AND NOT is_blocked AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS rechnung_offen,
        COUNT(*) FILTER (WHERE tier_reason = 'zahlungsfrist_abgelaufen' AND NOT is_blocked AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS frist_abgelaufen,
        COUNT(*) FILTER (WHERE tier_reason IN ('antrag_abgeschlossen','antrag_abgebrochen') AND NOT is_blocked AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS antrag_offen,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked
          AND ist_test_am IS NULL AND NOT ruht AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)}))::int AS leads,
        -- ── WER BRAUCHT EINE ERSTE RECHNUNG? ────────────────────────────
        -- Dieselbe Bedingung wie im Filter.
        --
        -- Der Bezug MUSS qualifiziert sein: Ein blankes „id" bindet in der
        -- korrelierten Unterabfrage an fiaon_applications.id, nicht an die
        -- Person. Gemessen am 11.08.2026: Der Zähler stand auf 0, während die
        -- Liste 21 Kunden zeigte — beide Abfragen sahen aus wie dieselbe
        -- Bedingung und meinten Verschiedenes.
        -- Und „NOT ruht" wie in der Liste: Gemessen stand der Zähler auf 67,
        -- während die Liste 21 zeigte — genau der Fehler, den der Agent
        -- gemeldet hat („Zahlung gemeldet zeigt 23, im Ordner sind nur 2").
        -- Ihn beim Bauen der Abhilfe zu wiederholen wäre besonders bitter.
        -- Und die Wiedervorlage: Wer eine Verabredung in der Zukunft hat, ist
        -- heute fertig — die Liste blendet ihn aus, der Zähler muss das auch.
        -- Nach „NOT ruht" standen immer noch 66 gegen 21 in der Liste.
        COUNT(*) FILTER (WHERE NOT is_blocked AND ist_test_am IS NULL AND NOT ruht
          AND (follow_up_date IS NULL OR follow_up_date <= ${sqlPool.unsafe(HEUTE)})
          AND priority_tier BETWEEN 1 AND 3
          AND EXISTS (
          SELECT 1 FROM fiaon_applications ar
          WHERE ar.person_id = p.id AND ar.merged_into IS NULL
            AND ar.archived_at IS NULL AND ar.gdpr_deleted_at IS NULL
            AND ar.payment_status = 'pending'
            AND ar.status IN ('completed','approved','submitted','documents_submitted','verifying','processing')
          ))::int AS rechnung_stellen,
        COUNT(*) FILTER (WHERE promised_payment_date = ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS zusage_heute,
        COUNT(*) FILTER (WHERE promised_payment_date < ${sqlPool.unsafe(HEUTE)} AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS ueberfaellig,
        COUNT(*) FILTER (WHERE unreachable_count > 0 AND NOT is_blocked AND priority_tier BETWEEN 1 AND 3
          AND ist_test_am IS NULL)::int AS nicht_erreicht,
        -- ── NUMMER OHNE LAND: NICHT ANRUFBAR ───────────────────────────────
        -- Seit dem 31.08.2026 wird eine national geschriebene Nummer ohne Land
        -- ABGELEHNT statt geraten (Befund Maurizio Pampanini: dreimal
        -- +49797435749 statt +41797435749). Diese Kunden sind damit nicht
        -- anrufbar — der Zaehler macht die Abarbeitung sichtbar.
        COUNT(*) FILTER (WHERE ${sqlPool.unsafe(nichtWaehlbarSql())}
          AND NOT is_blocked AND ist_test_am IS NULL)::int AS nummer_ohne_land,
        -- ── WER WARTET AUF SEINEN TERMIN? ──────────────────────────────────
        -- Die Zahl beantwortet die Frage, die entsteht, sobald Karten
        -- verschwinden: „Wo sind die Leute hin, die ich nicht erreicht habe?"
        -- Ohne sie fühlt sich das Verschwinden wie ein Verlust an — und genau
        -- dieses Gefühl hat dazu geführt, dieselben Menschen zweimal
        -- anzurufen.
        COUNT(*) FILTER (WHERE follow_up_date > CURRENT_DATE AND NOT is_blocked
                         AND priority_tier BETWEEN 1 AND 3)::int AS wartet,
        -- ── HIER STAND DIESELBE ZEILE ZWEIMAL (behoben 16.08.2026) ────────
        -- Zwei Spalten mit dem Namen „wartet", identische Bedingung, und der
        -- Kommentar der zweiten behauptete etwas anderes („wartet auf eine
        -- Terminbuchung"). Postgres nimmt das hin, im Ergebnisobjekt überlebt
        -- die letzte — also war der Kommentar eine Beschreibung von nichts.
        --
        -- Jetzt zählt die zweite Zahl, was sie sagt: Menschen, die auf eine
        -- ANTWORT DES KUNDEN warten (Nummer nachtragen oder Termin wählen).
        -- GEMESSEN: 185 verschickte Nummern-Anfragen ohne Antwort.
        COUNT(*) FILTER (WHERE wartet_auf IS NOT NULL AND NOT is_blocked
                         AND priority_tier BETWEEN 1 AND 3)::int AS wartend,
        COUNT(*) FILTER (WHERE priority_tier = 0)::int AS bezahlt,
        COUNT(*) FILTER (WHERE is_blocked)::int AS gesperrt,
        -- Der eigene Vorrat je Stufe. Die drei Zahlen im Kopf der Liste sagen
        -- dem Agenten in einer Sekunde, ob er in der Pflicht (A/B) oder in der
        -- Kür (C) arbeitet. Ruhende zählen NICHT mit — sie sind heute nicht dran.
        COUNT(*) FILTER (WHERE priority_tier = 1 AND NOT is_blocked AND NOT ruht)::int AS stufe_a,
        COUNT(*) FILTER (WHERE priority_tier = 2 AND NOT is_blocked AND NOT ruht)::int AS stufe_b,
        COUNT(*) FILTER (WHERE priority_tier = 3 AND NOT is_blocked AND NOT ruht)::int AS stufe_c,
        COUNT(*) FILTER (WHERE ruht)::int AS ruhend
      FROM (
        SELECT p.*, ${sqlPool.unsafe(ruhtSql("p"))} AS ruht
        FROM fiaon_persons p
        WHERE p.assigned_agent_id = ${me} AND p.merged_into_person_id IS NULL
      ) p
    `,
      sqlPool`
      SELECT COUNT(DISTINCT a.person_id)::int AS c
      FROM fiaon_contact_log cl
      JOIN fiaon_applications a ON a.ref = cl.ref
      JOIN fiaon_persons p ON p.id = a.person_id
      WHERE cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL AND cl.voided_at IS NULL
        AND p.assigned_agent_id = ${me} AND NOT p.is_blocked AND p.priority_tier BETWEEN 1 AND 3
    `,
    ]);
    const z = (zR as any[])[0] || {};
    const rueckrufZahl = (rueckrufR as any[])[0] || { c: 0 };

    // ── DER LEERZUSTAND MUSS WISSEN, WER FRAGT (20.08.2026) ──────────────
    // „Dir ist gerade kein Kunde zugewiesen" ist fuer Onboarding schlicht
    // falsch: Ihnen wird NIE ein Kunde zugewiesen, sie haben Termine. Der Satz
    // hat Viktoria und Rifka glauben lassen, es gaebe keine Arbeit — waehrend
    // fuenf Startgespraeche im Kalender standen.
    let naechsterTermin: string | null = null;
    if (onboarding) {
      const [t] = (await sqlPool`
        SELECT beginn FROM fiaon_termine
         WHERE agent_id = ${me} AND abgesagt_am IS NULL AND erledigt_am IS NULL
           AND beginn >= NOW() - INTERVAL '2 hours'
         ORDER BY beginn LIMIT 1
      `.catch(() => [] as any[])) as any[];
      naechsterTermin = t?.beginn ?? null;
    }

    res.json({
      ok: true,
      anzahl: rows.length,
      sort,
      filter,
      /** Die Anzeige braucht die Rolle für den richtigen Leerzustand. */
      rolle: onboarding ? "onboarding" : "agent",
      naechsterTermin,
      // ── DER ZAEHLER MUSS DIESELBE MENGE ZAEHLEN WIE DIE LISTE ZEIGT ──────
      // Die Zaehler-Abfrage unten filtert weiter auf `assigned_agent_id` — fuer
      // Onboarding also auf 0. Im Screenshot stand ueber einer Liste mit drei
      // Startgespraechen weiter „0 Kunden gehoeren dir" und der Chip „Alle 0".
      // Das ist genau der Satz, mit dem der Ausfall gemeldet wurde; ihn stehen
      // zu lassen haette den Fix verdeckt.
      //
      // Die Lehre steht seit dem 11.08.2026 in dieser Datei: „Die Zaehler
      // muessen dieselbe Menge zaehlen wie die Liste zeigt."
      zaehlerUeberschrieben: onboarding ? { alle: rows.length } : null,
      zaehler: {
        alle: z.alle, tier1: z.tier1, rechnung_offen: z.rechnung_offen,
        rechnung_stellen: z.rechnung_stellen,
        frist_abgelaufen: z.frist_abgelaufen, antrag_offen: z.antrag_offen,
        leads: z.leads, zusage_heute: z.zusage_heute, ueberfaellig: z.ueberfaellig,
        rueckruf: rueckrufZahl.c, nicht_erreicht: z.nicht_erreicht, wartet: z.wartet,
        // Wartet auf den KUNDEN (Nummer oder Termin) — eigener Filter.
        wartend: z.wartend,
        bezahlt: z.bezahlt, gesperrt: z.gesperrt, ruhend: z.ruhend,
        nummer_ohne_land: z.nummer_ohne_land,
      },
      // Der Vorrat je Stufe für den Kopf der Liste.
      vorrat: { A: Number(z.stufe_a || 0), B: Number(z.stufe_b || 0), C: Number(z.stufe_c || 0) },
      kunden: (rows as any[]).map(karte),
    });
  } catch (err) {
    console.error("[AGENT-START] kundenliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
