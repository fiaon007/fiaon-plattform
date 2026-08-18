// ═══════════════════════════════════════════════════════════════════════════
// FIAON Agent — MEINE KUNDEN (person-scoped)
//
// Der Nachfolger der offenen Kartei. Der Unterschied ist nicht die Oberfläche,
// sondern die Autorisierung: Ein Agent sieht ausschliesslich die Personen, die
// ihm gehören. Die Prüfung passiert bei JEDEM Zugriff serverseitig gegen
// `fiaon_persons.assigned_agent_id` — nicht über einen Filter im Frontend, den
// man umgehen kann, indem man eine andere ID in die URL schreibt.
//
// ══ 404 UND NICHT 403 ═════════════════════════════════════════════════════
// Fragt Agent A eine Person von Agent B ab, ist die Antwort 404. Ein 403 würde
// bestätigen, dass diese Person existiert — und damit über einen simplen
// Durchlauf der IDs verraten, wie viele Kunden das Unternehmen hat und welche
// IDs belegt sind. Für den Agenten existiert eine fremde Person nicht.
//
// ══ NULL SICHTBARKEIT FREMDER AGENTEN ═════════════════════════════════════
// Keine Antwort dieser Datei enthält den Namen eines anderen Agenten, eine
// Gesamtzahl über alle Agenten oder eine Rangliste. Der Agent sieht seinen
// eigenen Bestand, sonst nichts.
//
// ══ DER KONTAKTVERLAUF HÄNGT AN DER BESTELLUNG ════════════════════════════
// `fiaon_contact_log.ref` zeigt auf eine Antragszeile, nicht auf die Person.
// Gelesen wird deshalb über ALLE Antragszeilen der Person (ein Kunde mit acht
// Bestellungen hat einen Verlauf, nicht acht), geschrieben wird an die jüngste.
//
// ══ WARUM DAS PRÄFIX /agent/crm ═══════════════════════════════════════════
// `GET /agent/dashboard` existiert bereits im Agentenportal
// (`fiaon-agent-portal.ts`) und wird vom laufenden Frontend benutzt. Router
// werden auf demselben Pfad in Registrierungsreihenfolge abgearbeitet — eine
// zweite Route desselben Namens wäre entweder unerreichbar oder würde die
// bestehende verdrängen und die Agenten sofort arbeitsunfähig machen.
// Deshalb liegt die neue Oberfläche unter einem eigenen Präfix.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { waehlbareNummer } from "../lib/fiaon-telefon";
import { parseBerlinInput, pruefeTerminZukunft } from "../lib/fiaon-time";
import {
  ERGEBNISSE, ERGEBNIS_TEXT, brauchtDatum, ergebnisNachbereiten, istErgebnis, type Ergebnis,
} from "../lib/fiaon-kontakt-ergebnis";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { hinweisFuer, type TierGrund } from "../lib/tier-hinweise";
import { sendMakeWebhook, sendMakeWebhookMitGrund, makePayloadFromRow } from "../make-webhook";
import { signInvoiceUrl } from "../fiaon-invoice";
import { nachschub } from "./fiaon-followup";
import { FIAON_BANK_DETAILS as BANK } from "./fiaon-antrag";
import { zahlungstext } from "../lib/fiaon-verwendungszweck";
import { aufbereiten } from "../lib/fiaon-buchungen";

const router = Router();

/** Ab so vielen Zahlungsdetail-Versänden warnt die Karte. */
const RECHNUNG_WARNUNG_AB = 3;

/**
 * Merker für die Willkommens-Tour. Eine eigene Spalte statt eines Eintrags in
 * `fiaon_settings`, weil der Status PRO AGENT gilt — ein globaler Schlüssel
 * würde die Tour für alle ausschalten, sobald sie einer weggeklickt hat.
 *
 * Nicht in Migration 033, weil die dort schon in der Produktion gelaufen ist.
 * `ADD COLUMN IF NOT EXISTS` ist gefahrlos wiederholbar.
 */
let spalteGeprueft = false;
async function ensureTourSpalte(): Promise<void> {
  if (spalteGeprueft) return;
  await sqlPool`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS crm_tour_seen_at TIMESTAMPTZ`;
  spalteGeprueft = true;
}
/** Ohne Aktivität so lange → Eskalation. */
const ESKALATION_TAGE = 7;

// ───────────────────────────────────────────────────────────────────────────
// Gemeinsame Bausteine
// ───────────────────────────────────────────────────────────────────────────

/**
 * Die Person, WENN sie diesem Agenten gehört — sonst null.
 *
 * Der Besitz steht in der WHERE-Bedingung, nicht in einer nachgelagerten
 * Prüfung. Damit kann keine Abfrage versehentlich fremde Daten laden, auch
 * nicht, wenn später jemand die Prüfung zu vergessen versucht.
 */
async function meinePerson(personId: number, agentId: number) {
  const [p] = await sqlPool`
    SELECT p.id, p.priority_tier, p.tier_reason, p.promised_payment_date,
           p.follow_up_date, p.unreachable_count, p.invoice_sent_count,
           (SELECT a.pack_name FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS pack_name,
           (SELECT a.amount_due FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS amount_due,
           p.is_blocked, p.assigned_at, p.primary_phone, p.primary_email,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                    p.company_name, p.contact_name, p.primary_email) AS name,
           -- Für den Handlungshinweis bei abgebrochenen Anträgen
           (SELECT a.status FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
           -- Ziel für Schreibvorgänge in den Kontaktverlauf
           (SELECT a.ref FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS schreib_ref,
           -- ── STAMMDATEN (Meldung 04.08.2026) ──────────────────────────────
           -- In „Heute" fehlten Adresse, Geburtsdatum und Zahlungsreferenz. Der
           -- Agent musste den Kunden zusätzlich unter „Meine Kunden" suchen, um
           -- am Telefon Auskunft geben zu können. Sie kommen aus der Person UND
           -- ergänzend aus der Bestellung: Was in der Person fehlt, steht oft in
           -- der Bestellung — und umgekehrt.
           COALESCE(NULLIF(p.street, ''), (SELECT NULLIF(a.street,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.street,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS strasse,
           COALESCE(NULLIF(p.zip, ''), (SELECT NULLIF(a.zip,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.zip,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS plz,
           COALESCE(NULLIF(p.city, ''), (SELECT NULLIF(a.city,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.city,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS ort,
           COALESCE(NULLIF(p.country, ''), (SELECT NULLIF(a.country,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.country,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS country,
           COALESCE(p.birthdate, (SELECT a.birthdate FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.birthdate IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS geburtsdatum,
           -- Telefon der Bestellung inkl. getrennter Ländervorwahl: genau die
           -- Vorwahl, die in primary_phone bei 2.058 Personen fehlt.
           (SELECT a.phone FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.phone,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.phone,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_vorwahl,
           (SELECT NULLIF(a.contact_phone,'') FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.contact_phone,'') IS NOT NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_contact_phone,
           -- Zahlung: Referenz, Status und Frist gehören auf die Karte, weil
           -- der Kunde am Telefon genau danach fragt.
           (SELECT a.payment_reference FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT a.payment_status FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS zahlungsstatus,
           (SELECT a.payment_due_date FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS zahlungsfrist,
           (SELECT COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,''))
             FROM fiaon_applications a
             WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
             ORDER BY a.created_at DESC LIMIT 1) AS app_email,
           -- ══════════════════════════════════════════════════════════════════
           -- DIE BUCHUNGEN GEHÖREN AN DIE KARTE (30.08.2026)
           --
           -- ── DIE MELDUNGEN, DIE HIER ZUSAMMENLAUFEN ──────────────────────
           -- „E-Mail ergänzt — Versand bleibt trotzdem gesperrt."
           -- „Produkt anlegen: keine Bestellung vorhanden."
           --
           -- Beides war DERSELBE Fehler, und er saß nicht dort, wo er auftrat.
           -- Die Oberfläche leitet den Sperrgrund aus „k.buchungen“ ab. Dieses
           -- Feld lieferte NUR die Listenabfrage (buchungen_roh in
           -- fiaon-agent-start.ts). „kartePayload“ kannte es nicht.
           --
           -- Nach dem Ergänzen einer E-Mail und nach dem Anlegen eines Produkts
           -- holt die Karte sich frisch über GET /agent/crm/kunden/:personId —
           -- und bekam eine Antwort OHNE buchungen. Die Karte wurde ersetzt, das
           -- Feld war danach „undefined“, und „k.buchungen ?? []“ ergab eine
           -- LEERE Liste. Die Ableitung sagte daraufhin folgerichtig „Keine
           -- Bestellung vorhanden" — und der Produkt-Dialog „Diese Akte hat
           -- keine Bestellung".
           --
           -- Die Aktualisierung hat die Daten also nicht bloß nicht erneuert,
           -- sie hat sie GELÖSCHT. Deshalb wurde es schlimmer, je mehr der
           -- Agent tat: Wer die E-Mail nachtrug, sperrte sich damit den Versand.
           --
           -- Dieselben Spalten, dieselbe Reihenfolge wie in der Listenabfrage —
           -- beide Wege gehen danach durch „aufbereiten“ aus
           -- server/lib/fiaon-buchungen.ts. Zwei Fassungen derselben Liste
           -- wären genau die zweite Wahrheit, die diesen Fehler erzeugt hat.
           -- ══════════════════════════════════════════════════════════════════
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
                AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL) AS buchungen_roh
    FROM fiaon_persons p
    WHERE p.id = ${personId}
      AND p.assigned_agent_id = ${agentId}
      AND p.merged_into_person_id IS NULL
  `;
  return p ?? null;
}

/** Die Karten-Antwort. Enthält alles, was die Oberfläche zum Handeln braucht. */
function kartePayload(p: any, letzteAktivitaet?: any) {
  const h = hinweisFuer(p.tier_reason as TierGrund, p.letzter_status);
  // Wählbare Nummer: die Bestellnummer mit getrennter Vorwahl zuerst, danach die
  // Sammelnummer der Person. Ohne diese Zusammensetzung fehlte im `tel:`-Link
  // die Ländervorwahl — der Anruf ging ins Leere.
  const tel = waehlbareNummer(
    [
      { nummer: p.app_phone, vorwahl: p.app_vorwahl },
      { nummer: p.primary_phone },
      { nummer: p.app_contact_phone },
    ],
    p.country,
  );
  return {
    personId: p.id,
    name: p.name,
    // Die Buchungen der Person — dieselbe Aufbereitung wie in der Liste.
    // Fehlte dieses Feld, löschte jede Kartenaktualisierung die Buchungen der
    // Karte und sperrte damit den Zahlungsdaten-Versand (Begründung an der
    // Abfrage oben). `aufbereiten` verträgt auch `undefined`.
    buchungen: aufbereiten(p.buchungen_roh),
    // `telefon` bleibt die Anzeige (abwärtskompatibel), `telefonWaehlbar` ist
    // die Form für den Anruf. Getrennt, weil eine Nummer ohne Vorwahl angezeigt
    // werden soll, aber NICHT gewählt.
    telefon: tel.anzeige || p.primary_phone || null,
    telefonWaehlbar: tel.waehlbar,
    telefonHinweis: tel.hinweis,
    email: p.primary_email || p.app_email || null,
    // Stammdaten für die Karte — damit niemand mehr zwischen zwei Ansichten
    // wechseln muss, um am Telefon Auskunft zu geben.
    stammdaten: {
      strasse: p.strasse || null,
      plz: p.plz || null,
      ort: p.ort || null,
      land: p.country || null,
      geburtsdatum: p.geburtsdatum || null,
    },
    // Der Verwendungszweck ist ab jetzt IMMER dabei — auch wenn der Kunde keine
    // E-Mail hat. Genau dort entstand der Schaden: Der Agent konnte die
    // Zahlungsdaten nicht mailen, hat sie am Telefon durchgegeben, und ohne
    // Referenz kam Geld ohne Namen an. Die Bankverbindung kommt aus derselben
    // Quelle wie die Rechnung (FIAON_BANK_DETAILS) — keine zweite, abgeschriebene
    // IBAN im Frontend.
    zahlung: {
      referenz: p.zahlungsreferenz || null,
      status: p.zahlungsstatus || null,
      frist: p.zahlungsfrist || null,
      ref: p.schreib_ref || null,
      empfaenger: BANK.recipient,
      iban: BANK.ibanDisplay,
      bic: BANK.bic,
      /** Fertiger Text zum Einfügen in WhatsApp — serverseitig formatiert. */
      klartext: p.zahlungsreferenz
        ? zahlungstext({
            empfaenger: BANK.recipient, iban: BANK.iban, ibanAnzeige: BANK.ibanDisplay,
            bic: BANK.bic, verwendungszweck: String(p.zahlungsreferenz),
            betragCent: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
          })
        : null,
    },
    tier: p.priority_tier,
    tierGrund: p.tier_reason,
    titel: h.titel,
    hinweis: h.hinweis,
    // Betrag und Produkt der jüngsten offenen Bestellung. Die Karte braucht
    // beides: Ein Anruf ohne Kenntnis von Paket und Summe beginnt mit einer
    // Rückfrage. Vorher standen die Werte nur in der Detailansicht — der Agent
    // musste die Karte erst öffnen, um zu wissen, worüber er spricht.
    produkt: p.pack_name ? String(p.pack_name).split("\n")[0].trim() : null,
    betrag: p.amount_due != null ? Math.round(Number(p.amount_due) * 100) : null,
    zusagedatum: p.promised_payment_date,
    wiedervorlage: p.follow_up_date,
    nichtErreicht: p.unreachable_count,
    rechnungVersandt: p.invoice_sent_count,
    // Die Warnung entsteht hier, nicht im Frontend: Sie ist eine fachliche
    // Regel und muss überall dieselbe sein.
    rechnungWarnung: p.invoice_sent_count >= RECHNUNG_WARNUNG_AB
      ? `Bereits ${p.invoice_sent_count}× versandt. Ein weiterer Versand ersetzt kein Gespräch — ruf an.`
      : null,
    gesperrt: p.is_blocked,
    seit: p.assigned_at,
    letzteAktivitaet: letzteAktivitaet
      ? {
          am: letzteAktivitaet.created_at,
          art: letzteAktivitaet.type,
          ergebnis: letzteAktivitaet.outcome,
          notiz: letzteAktivitaet.note,
        }
      : null,
  };
}

/** Jüngster Kontaktverlauf-Eintrag über die ganze Bestell-Familie der Person. */
async function letzteAktivitaetVon(personId: number) {
  const [a] = await sqlPool`
    SELECT c.created_at, c.type, c.outcome, c.note
    FROM fiaon_contact_log c
    JOIN fiaon_applications ap ON ap.ref = c.ref
    WHERE ap.person_id = ${personId} AND c.voided_at IS NULL
    ORDER BY c.created_at DESC
    LIMIT 1
  `;
  return a ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/dashboard — die Zahlen des eigenen Bestands
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/dashboard", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const agentId = req.agent!.id;
    const [z] = await sqlPool`
      SELECT
        -- Heute fällig: Zusage auf heute ODER Wiedervorlage auf heute/früher
        count(*) FILTER (
          WHERE NOT is_blocked AND priority_tier IN (1, 2)
            AND (promised_payment_date = CURRENT_DATE
                 OR (follow_up_date IS NOT NULL AND follow_up_date <= CURRENT_DATE))
        )::int AS heute_faellig,
        -- Zahlung gemeldet, Geld fehlt: Tier 1 ohne Zusagedatum
        count(*) FILTER (
          WHERE NOT is_blocked AND priority_tier = 1 AND promised_payment_date IS NULL
        )::int AS ohne_datum,
        -- Überfällig: Zusagedatum liegt in der Vergangenheit
        count(*) FILTER (
          WHERE NOT is_blocked AND promised_payment_date IS NOT NULL
            AND promised_payment_date < CURRENT_DATE
        )::int AS ueberfaellig,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 1)::int AS tier1,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 2)::int AS tier2,
        count(*) FILTER (WHERE NOT is_blocked AND priority_tier = 3)::int AS tier3,
        count(*) FILTER (WHERE is_blocked)::int AS gesperrt,
        count(*)::int AS gesamt
      FROM fiaon_persons
      WHERE assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
    `;

    // Eskalation: seit ESKALATION_TAGE keine dokumentierte Aktivität.
    const [esk] = await sqlPool`
      SELECT count(*)::int AS anzahl
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${agentId}
        AND p.merged_into_person_id IS NULL
        AND NOT p.is_blocked
        AND p.priority_tier IN (1, 2)
        AND COALESCE((
          SELECT MAX(c.created_at) FROM fiaon_contact_log c
          JOIN fiaon_applications ap ON ap.ref = c.ref
          WHERE ap.person_id = p.id AND c.voided_at IS NULL AND c.agent_id IS NOT NULL
        ), p.assigned_at, NOW() - INTERVAL '99 days') < NOW() - (${ESKALATION_TAGE} || ' days')::interval
    `;

    // „Neu bei dir“: heute zugewiesene Kunden. Es gibt kein
    // Benachrichtigungssystem pro Agent — dieser Zähler ist der Ersatz, damit
    // ein Auto-Assign nicht unbemerkt in der Liste verschwindet.
    const [neu] = await sqlPool`
      SELECT count(*)::int AS anzahl FROM fiaon_persons
      WHERE assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
        AND assigned_at::date = CURRENT_DATE
    `;

    // Abschlussquote 30 Tage: eigene Kunden, die in diesem Zeitraum bezahlt haben.
    // Bewusst nur der EIGENE Wert — kein Vergleich mit anderen Agenten.
    const [conv] = await sqlPool`
      SELECT
        count(DISTINCT p.id) FILTER (WHERE a.payment_status = 'paid'
                                       AND a.updated_at > NOW() - INTERVAL '30 days')::int AS bezahlt,
        count(DISTINCT p.id)::int AS betreut
      FROM fiaon_persons p
      LEFT JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
      WHERE p.assigned_agent_id = ${agentId} AND p.merged_into_person_id IS NULL
    `;

    await ensureTourSpalte();
    // `is_test_account` geht mit an den Browser, damit der Leerzustand sagen
    // kann WARUM er leer ist. Testkonten sind aus der Verteilung ausgenommen
    // (`NOT a.is_test_account` in der Follow-up-Engine) — ohne diesen Hinweis
    // sieht der Prüfende eine leere Seite und hält das System für kaputt.
    const [tour] = await sqlPool`
      SELECT crm_tour_seen_at IS NOT NULL AS gesehen, is_test_account
      FROM fiaon_agents WHERE id = ${agentId}
    `;

    res.json({
      ok: true,
      agent: { vorname: req.agent!.first_name || req.agent!.name },
      tourGesehen: tour?.gesehen ?? false,
      istTestkonto: tour?.is_test_account ?? false,
      zahlen: {
        heuteFaellig: z.heute_faellig,
        ohneDatum: z.ohne_datum,
        ueberfaellig: z.ueberfaellig,
        eskalation: esk?.anzahl ?? 0,
        neuHeute: neu?.anzahl ?? 0,
        tier1: z.tier1,
        tier2: z.tier2,
        tier3: z.tier3,
        gesperrt: z.gesperrt,
        gesamt: z.gesamt,
        abschlussquote30Tage: conv?.betreut ? Math.round((conv.bezahlt / conv.betreut) * 100) : 0,
        abschluesse30Tage: conv?.bezahlt ?? 0,
      },
      eskalationNachTagen: ESKALATION_TAGE,
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] dashboard:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/crm/tour-gesehen — die Willkommens-Tour einmalig wegklicken
// ──────────────────────────────────────────────────────────────────
router.post("/agent/crm/tour-gesehen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureTourSpalte();
    await sqlPool`
      UPDATE fiaon_agents SET crm_tour_seen_at = NOW()
      WHERE id = ${req.agent!.id} AND crm_tour_seen_at IS NULL
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[AGENT-KUNDEN] tour-gesehen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/kunden — die eigene Liste, filterbar
//   tier=1|2|3   reason=<tier_reason>   state=heute|ohne_datum|ueberfaellig|offen
//   q=<Suche über Name, E-Mail, Telefon>
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/kunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const agentId = req.agent!.id;
    const tier = req.query.tier ? Number(req.query.tier) : null;
    const reason = req.query.reason ? String(req.query.reason) : null;
    const state = req.query.state ? String(req.query.state) : null;
    const q = req.query.q ? String(req.query.q).trim() : "";

    const rows = await sqlPool`
      SELECT p.id, p.priority_tier, p.tier_reason, p.promised_payment_date,
             p.follow_up_date, p.unreachable_count, p.invoice_sent_count,
             p.is_blocked, p.assigned_at, p.primary_phone, p.primary_email,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, p.primary_email) AS name,
             (SELECT a.status FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS letzter_status,
             -- Paket und Betrag der jüngsten Bestellung für die Kartenzeile.
             (SELECT a.pack_name FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS pack_name,
             (SELECT a.amount_due FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS amount_due,
             (SELECT MAX(c.created_at) FROM fiaon_contact_log c
               JOIN fiaon_applications ap ON ap.ref = c.ref
               WHERE ap.person_id = p.id AND c.voided_at IS NULL) AS letzte_am,
             -- Die Karte in der LISTE hat denselben Anruf-Knopf wie die
             -- Detailansicht. Ohne diese drei Felder fehlte dort die
             -- Ländervorwahl — der gemeldete Fehler trat also genau auf der
             -- Liste auf, mit der die Agenten den ganzen Tag arbeiten.
             (SELECT a.phone FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.phone,'') IS NOT NULL
               ORDER BY a.created_at DESC LIMIT 1) AS app_phone,
             (SELECT a.phone_country_code FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.phone,'') IS NOT NULL
               ORDER BY a.created_at DESC LIMIT 1) AS app_vorwahl,
             (SELECT NULLIF(a.contact_phone,'') FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.contact_phone,'') IS NOT NULL
               ORDER BY a.created_at DESC LIMIT 1) AS app_contact_phone,
             COALESCE(NULLIF(p.country,''), (SELECT NULLIF(a.country,'') FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL AND NULLIF(a.country,'') IS NOT NULL
               ORDER BY a.created_at DESC LIMIT 1)) AS country,
             (SELECT a.payment_reference FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS zahlungsreferenz,
             (SELECT a.payment_status FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS zahlungsstatus,
             (SELECT a.ref FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1) AS schreib_ref
      FROM fiaon_persons p
      WHERE p.assigned_agent_id = ${agentId}
        AND p.merged_into_person_id IS NULL
        AND (${tier}::int IS NULL OR p.priority_tier = ${tier}::int)
        AND (${reason}::text IS NULL OR p.tier_reason = ${reason}::text)
        -- ── SICHERHEITSGURT (Meldung 05.08.2026) ─────────────────────────
        -- Anruflisten enthalten NUR Personen im Vertrieb (Tier 1 und 2).
        -- Tier 0 heißt bezahlt, Tier -1 erstattet/storniert. Vorher fehlte diese
        -- Bedingung: Ein bezahlter Kunde mit übrig gebliebener Wiedervorlage
        -- stand weiter in „Heute" — Florentine sah Kunden, die bei Daniel längst
        -- bezahlt hatten. Die Einstufung wird jetzt zwar live nachgezogen, aber
        -- eine Liste, die sich allein darauf verlässt, ist eine Liste zu wenig.
        AND (${state}::text IS NULL OR ${state}::text = 'alle' OR p.priority_tier BETWEEN 1 AND 2)
        AND (
          ${state}::text IS NULL
          OR (${state}::text = 'heute' AND NOT p.is_blocked
              AND (p.promised_payment_date = CURRENT_DATE
                   OR (p.follow_up_date IS NOT NULL AND p.follow_up_date <= CURRENT_DATE)))
          OR (${state}::text = 'ohne_datum' AND NOT p.is_blocked
              AND p.priority_tier = 1 AND p.promised_payment_date IS NULL)
          OR (${state}::text = 'ueberfaellig' AND NOT p.is_blocked
              AND p.promised_payment_date IS NOT NULL AND p.promised_payment_date < CURRENT_DATE)
          OR (${state}::text = 'offen' AND NOT p.is_blocked)
        )
        AND (
          ${q}::text = ''
          OR COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                      p.company_name, p.contact_name, '') ILIKE '%' || ${q}::text || '%'
          OR COALESCE(p.primary_email, '') ILIKE '%' || ${q}::text || '%'
          OR COALESCE(p.primary_phone, '') ILIKE '%' || ${q}::text || '%'
          -- Auch über frühere Angaben suchen. Nach einem Zusammenschluss steht
          -- die alte E-Mail des Kunden nur noch in fiaon_person_aliases — ohne
          -- diesen Zweig wäre der Kunde unter der Adresse, die er selbst nennt,
          -- nicht mehr zu finden. Genau das ist der Datenverlust, den das
          -- Zusammenführen NICHT verursachen darf.
          OR EXISTS (
            SELECT 1 FROM fiaon_person_aliases al
            WHERE al.person_id = p.id
              AND (al.value_norm ILIKE '%' || ${q}::text || '%'
                   OR COALESCE(al.value_raw, '') ILIKE '%' || ${q}::text || '%'
                   OR COALESCE(al.feld_wert, '') ILIKE '%' || ${q}::text || '%')
          )
        )
      ORDER BY
        p.is_blocked ASC,
        p.priority_tier ASC,
        p.promised_payment_date ASC NULLS LAST,
        p.follow_up_date ASC NULLS LAST,
        p.id ASC
      LIMIT 300
    `;

    res.json({
      ok: true,
      anzahl: rows.length,
      kunden: (rows as any[]).map((p) => ({
        ...kartePayload(p),
        letzteAktivitaet: p.letzte_am ? { am: p.letzte_am } : null,
      })),
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// GET /agent/kunden/:personId — Detail mit Verlauf. Fremde Person → 404.
// ───────────────────────────────────────────────────────────────────────────
router.get("/agent/crm/kunden/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId)) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const verlauf = await sqlPool`
      SELECT c.id, c.created_at, c.type, c.outcome, c.note, c.promised_date,
             c.agent_name, c.ref
      FROM fiaon_contact_log c
      JOIN fiaon_applications ap ON ap.ref = c.ref
      WHERE ap.person_id = ${personId} AND c.voided_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 100
    `;

    // Archivierte Bestellungen bleiben in der AKTE sichtbar (sortiert nach
    // hinten) — nur aus Arbeits- und Zahlungslisten sind sie heraus. Eine Akte,
    // die eine Bestellung verschweigt, ist der Grund für Rückfragen wie „ich
    // hatte doch dreimal bestellt".
    const bestellungen = await sqlPool`
      SELECT ref, payment_reference, pack_name, amount_due, payment_status, created_at,
             archived_at, archived_reason, archived_note
      FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL
      ORDER BY (archived_at IS NOT NULL), created_at DESC
    `;

    // Produktstand als eine Zeile — dieselbe Ableitung wie in der Admin-Akte.
    const { produktstand } = await import("../lib/fiaon-produktstand");
    const produkt = await produktstand(personId).catch(() => null);

    res.json({
      ok: true,
      kunde: kartePayload(p, (verlauf as any[])[0]),
      verlauf: (verlauf as any[]).map((v) => ({
        id: v.id,
        am: v.created_at,
        art: v.type,
        ergebnis: v.outcome,
        notiz: v.note,
        zusagedatum: v.promised_date,
        // Der Name des eintragenden Agenten bleibt sichtbar: Es ist der
        // eigene Verlauf, und bei Übernahmen ist die Vorgeschichte nötig.
        von: v.agent_name,
      })),
      produkt: produkt ? { text: produkt.text, mehrfachStufe: produkt.mehrfachStufe } : null,
      bestellungen: (bestellungen as any[]).map((b) => ({
        ref: b.ref,
        zahlungsreferenz: b.payment_reference,
        produkt: b.pack_name ? String(b.pack_name).split("\n")[0].trim() : null,
        betragCents: b.amount_due != null ? Math.round(Number(b.amount_due) * 100) : null,
        status: b.payment_status,
        am: b.created_at,
        archiviertAm: b.archived_at ?? null,
        archivGrund: b.archived_reason ?? null,
        archivNotiz: b.archived_note ?? null,
      })),
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/crm/kunden/:personId/aktivitaet
//
// UMBAU 04.08.2026 (Meldung der Agenten): Es gab hier nur vier Möglichkeiten —
// erreicht, nicht erreicht, blockiert, notiz. Es fehlten „Erreicht – abgelehnt"
// als eigenes Ergebnis, „Mailbox besprochen" und „Rückruf vereinbart". Wer
// diese Fälle dokumentieren wollte, musste in „Meine Kunden" wechseln, und dort
// hatte das Ergebnis wiederum keine Wirkung auf die Tagesliste.
//
// Jetzt nimmt dieser Endpunkt DENSELBEN Satz Ergebnisse wie „Meine Kunden" und
// wendet ihn über dieselbe Funktion an. Die alten Kurznamen bleiben gültig,
// damit ein offener Browser-Tab nach dem Deploy keine Fehlermeldung bekommt.
// ───────────────────────────────────────────────────────────────────────────
const ALT_NAMEN: Record<string, Ergebnis> = {
  erreicht: "erreicht_zahlt_gleich",
  nicht_erreicht: "nicht_erreicht",
  blockiert: "erreicht_abgelehnt",
};

router.post("/agent/crm/kunden/:personId/aktivitaet", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const art = String(req.body?.art || "").trim();
    const notiz = req.body?.notiz ? String(req.body.notiz).trim() : null;
    const wiedervorlage = req.body?.wiedervorlage ? String(req.body.wiedervorlage) : null;
    const zusageDatum = req.body?.zusageDatum ? String(req.body.zusageDatum) : null;
    const terminDatum = req.body?.terminDatum ? String(req.body.terminDatum) : null;
    // Uhrzeit zum Rückruf (Meldung 05.08.2026: „kann kein Rückruf eintragen, da
    // man keine Uhrzeit eintragen kann"). Ein Rückruf um 9 und einer um 18 Uhr
    // sind im Tagesablauf zwei verschiedene Dinge; ohne Uhrzeit ist die Zusage
    // gegenüber dem Kunden nicht einzuhalten.
    const terminZeit = req.body?.terminZeit ? String(req.body.terminZeit).trim() : null;
    const terminZeitpunkt = terminDatum
      ? `${terminDatum}T${/^\d{2}:\d{2}$/.test(terminZeit || "") ? terminZeit : "10:00"}:00`
      : null;

    // Notiz bleibt ein eigener Fall: Sie ändert keinen Zustand.
    const istNotiz = art === "notiz";
    const ergebnis: Ergebnis | null = istNotiz ? null : (ALT_NAMEN[art] || (istErgebnis(art) ? art : null));
    if (!istNotiz && !ergebnis) {
      return res.status(400).json({
        ok: false,
        error: `Unbekanntes Ergebnis. Erlaubt: notiz, ${ERGEBNISSE.join(", ")}`,
      });
    }

    // Pflichtdaten prüfen, BEVOR etwas geschrieben wird. Ein Rückruf ohne Termin
    // und eine Zusage ohne Datum sind keine Dokumentation, sondern ein Loch.
    if (ergebnis && brauchtDatum(ergebnis) === "zusage" && !zusageDatum) {
      return res.status(400).json({ ok: false, error: "Bitte das zugesagte Zahlungsdatum angeben." });
    }
    if (ergebnis && brauchtDatum(ergebnis) === "termin" && !terminDatum) {
      return res.status(400).json({ ok: false, error: "Bitte den vereinbarten Rückruf-Termin angeben." });
    }
    if (ergebnis === "rueckruf_termin") {
      const fehler = pruefeTerminZukunft("rueckruf_termin", terminZeitpunkt);
      if (fehler) return res.status(400).json({ ok: false, error: fehler });
    }

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!p.schreib_ref) {
      return res.status(400).json({
        ok: false,
        error: "Zu diesem Kunden gibt es keine Bestellung, an der der Verlauf hängen könnte.",
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // BERLIN-ZEIT, NICHT UTC
    //
    // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────
    // Ein Agent: „Datum und Uhrzeit verändern sich teilweise beim Speichern.
    // Morgen 10:00 Uhr wird 12:00 Uhr. Heute 20:00 Uhr landet plötzlich am
    // 18.08. um 22:00 Uhr."
    //
    // Gemessen in fiaon_contact_log: Eintrag #8884 steht als
    // „2026-08-18T20:00:00.000Z" — 20:00 UTC, in Berlin 22:00. Genau der Fall.
    //
    // Hier stand `terminZeitpunkt` roh im INSERT. Der Wert ist
    // „2026-08-18T20:00:00" ohne Zeitzone; eine `timestamptz`-Spalte deutet
    // das als UTC — nicht als Wandzeit des Menschen, der es eingetippt hat.
    //
    // `parseBerlinInput` macht genau diese Umrechnung und beherrscht die
    // Zeitumstellung. `logAction` nutzt sie seit Langem; diese Route und die
    // in fiaon-vertrieb.ts schrieben daran vorbei.
    //
    // AGENTS.md: „Zeitzone ist Europe/Berlin — über server/lib/fiaon-time.ts,
    // nie über new Date()."
    // ══════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════
    // EINE KETTE FÜR BEIDE WEGE
    //
    // Hier standen fünf Schritte hintereinander: Verlaufseintrag, Zustand,
    // Nummern-Mail, Übergabe, Nachschub. Das Telefon-Panel machte nur den
    // zweiten — deshalb wirkte ein Ergebnis aus dem Panel nicht auf die Liste
    // (GEMESSEN: 554 von 842 Anrufen ohne Verlaufseintrag).
    //
    // Die Kette steht jetzt in `ergebnisNachbereiten`
    // (server/lib/fiaon-kontakt-ergebnis.ts). Beide Wege rufen sie. Eine
    // zweite Fassung wäre die zweite Gelegenheit, wieder auseinanderzulaufen —
    // genau so ist dieser Fehler entstanden.
    //
    // Die Zeitzone kommt mit: `ergebnisNachbereiten` benutzt
    // `parseBerlinInput` (AGENTS.md), nicht den rohen Wert.
    // ══════════════════════════════════════════════════════════════════════
    const nach = await ergebnisNachbereiten({
      ref: p.schreib_ref,
      personId,
      ergebnis: ergebnis ?? null,
      notiz,
      zusageDatum,
      terminZeitpunkt,
      wiedervorlage,
      akteur: { id: req.agent!.id, name: req.agent!.name },
      herkunft: "liste",
    });
    const wirkung = nach.wirkung;
    const nummerMail = nach.nummerMail;
    const uebergabe = nach.uebergabe;

    // Nach einer geglückten Übergabe gehört der Kunde nicht mehr dem Anfragenden.
    // `meinePerson` liefert dann NULL — das ist richtig so und die Oberfläche
    // nimmt die Karte daraufhin aus der Liste.
    const neu = uebergabe?.ok ? null : await meinePerson(personId, req.agent!.id);
    res.json({
      ok: true,
      kunde: neu ? kartePayload(neu, await letzteAktivitaetVon(personId)) : null,
      wirkung,
      nummerMail,
      uebergabe,
      // Klartext für die Rückmeldung — der Agent soll sehen, was sein Klick bewirkt hat.
      // Die Kette formuliert die Meldung; der Ergebnistext dieser Ansicht
      // bleibt als Rückfall, weil er die freundlichere Fassung ist.
      meldung: nach.meldung !== "Ergebnis festgehalten."
        ? nach.meldung
        : (istNotiz ? "Notiz gespeichert." : ERGEBNIS_TEXT[ergebnis!]),
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] aktivitaet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/kunden/:personId/zusage — Datum ist Pflicht
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/crm/kunden/:personId/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const datum = req.body?.datum ? String(req.body.datum).trim() : "";

    // Ohne Datum keine Zusage. Eine Zusage „irgendwann" ist keine Zusage und
    // würde den Kunden aus jeder Tagesliste nehmen, ohne etwas zu vereinbaren.
    if (!datum) {
      return res.status(400).json({
        ok: false,
        error: "Bitte ein konkretes Zahlungsdatum angeben — ohne Datum lässt sich nicht nachfassen.",
      });
    }
    const geprueft = new Date(datum);
    if (isNaN(geprueft.getTime())) {
      return res.status(400).json({ ok: false, error: "Das Datum ist nicht lesbar. Bitte im Format JJJJ-MM-TT angeben." });
    }

    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!p.schreib_ref) {
      return res.status(400).json({ ok: false, error: "Zu diesem Kunden gibt es keine Bestellung." });
    }

    await sqlPool.begin(async (tx) => {
      await tx`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note, promised_date, created_at)
        VALUES (${p.schreib_ref}, ${req.agent!.id}, ${req.agent!.name}, 'result',
                'erreicht_zahlt_am',
                ${req.body?.notiz ? String(req.body.notiz).trim() : null},
                ${datum}::date, NOW())
      `;
      // Die Wiedervorlage folgt der Zusage: einen Tag danach nachfassen.
      await tx`
        UPDATE fiaon_persons
           SET promised_payment_date = ${datum}::date,
               follow_up_date = ${datum}::date + 1,
               updated_at = NOW()
         WHERE id = ${personId}
      `;
    });

    const neu = await meinePerson(personId, req.agent!.id);
    res.json({ ok: true, kunde: kartePayload(neu, await letzteAktivitaetVon(personId)) });
  } catch (err) {
    console.error("[AGENT-KUNDEN] zusage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/kunden/:personId/rechnung — Zahlungsdetails erneut senden
//
// Benutzt den BESTEHENDEN Versandweg (`payment_details` über Make, mit
// signiertem Rechnungslink). Kein zweiter Mailpfad.
// ───────────────────────────────────────────────────────────────────────────
/**
 * Zahlungsdaten und Rechnung an den Kunden senden — die Logik, EINMAL.
 *
 * Wird von zwei Stellen gebraucht: vom Agenten in seiner Kundenliste und von der
 * Vertriebsleitung in der Gesamtansicht. Zwei Kopien würden auseinanderlaufen,
 * und die Reihenfolge (erst senden, dann buchen) ist genau der Punkt, an dem der
 * frühere Fehler saß.
 *
 * `pruefeBesitz` ist die Sicherheitsgrenze: Ein Agent darf nur an SEINE Kunden
 * senden, die Vertriebsleitung an alle.
 */
export async function zahlungsdatenSenden(
  personId: number,
  agentId: number,
  agentName: string,
  opts: { pruefeBesitz?: boolean } = {},
): Promise<{ ok: boolean; status?: number; error?: string; empfaenger?: string; warnung?: string | null; anzahl?: number }> {
  if (opts.pruefeBesitz) {
    const p = await meinePerson(personId, agentId);
    if (!p) return { ok: false, status: 404, error: "Kunde nicht gefunden" };
  }

  // Die Bestellung, um die es geht: die jüngste noch offene.
  let [bestellung] = await sqlPool`
    SELECT ref, payment_reference, amount_due, first_name, last_name, contact_name,
           email, contact_email, billing_email, pack_name, payment_status
    FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL
      AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
    ORDER BY created_at DESC
    LIMIT 1
  `;

  // ══════════════════════════════════════════════════════════════════════════
  // NOCH KEINE RECHNUNG? DANN WIRD SIE JETZT GESTELLT.
  //
  // ── DER BEFUND (11.08.2026) ───────────────────────────────────────────────
  // Ein Agent: „Bei vielen Kunden in ‚Antrag fertig – Rechnung offen' gibt es
  // keine offene Zahlung/Rechnung. Dadurch gibt es auch keine Zahlungsdaten und
  // die Zahlungsdaten-E-Mail kann nicht verschickt werden."
  //
  // Hier war die Ursache: Die Suche oben verlangt `pending_payment`,
  // `claimed_paid` oder `expired`. Ein fertiger Antrag steht aber auf
  // `pending` — es wurde ja nie eine Rechnung gestellt. Der Agent bekam
  // „Dieser Kunde hat keine offene Bestellung" und stand davor.
  //
  // Gemessen: 264 Kunden mit fertigem Antrag und E-Mail warten darauf.
  //
  // ── EIN KNOPF, DER IMMER DAS RICHTIGE TUT ─────────────────────────────────
  // Ein zweiter Knopf „Rechnung stellen" neben „Zahlungsdaten senden" wäre eine
  // Unterscheidung, die den Agenten nichts angeht: Er will, dass der Kunde
  // weiß, was er zahlen soll. Ob dafür erst ein Betrag gesetzt werden muss, ist
  // Sache des Systems.
  //
  // `rechnungStellen` setzt Betrag (aus dem Paket), Frist (+7 Tage) und den
  // Zustand — und verschickt gleich mit.
  // ══════════════════════════════════════════════════════════════════════════
  if (!bestellung) {
    const { rechnungStellen, RECHNUNGSREIF } = await import("../lib/fiaon-rechnung-stellen");
    const [reif] = (await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
        AND payment_status = 'pending'
        AND status = ANY(${RECHNUNGSREIF as unknown as string[]})
      ORDER BY created_at DESC LIMIT 1
    `) as any[];

    if (reif) {
      const erg = await rechnungStellen(String(reif.ref), { akteur: agentName, agentId });
      if (!erg.ok) return { ok: false, status: 400, error: erg.grund };
      return {
        ok: true,
        empfaenger: erg.empfaenger!,
        warnung: `Erste Rechnung gestellt und an ${erg.empfaenger} verschickt — `
          + "mit Betrag, Verwendungszweck und sieben Tagen Zahlungsfrist.",
      };
    }

    // ── DER GRUND, WARUM ES NICHT GEHT, IN WORTEN ─────────────────────────
    // „Keine offene Bestellung" sagt einem Agenten nicht, was er tun kann.
    const [warum] = (await sqlPool`
      SELECT status, payment_status FROM fiaon_applications
      WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
      ORDER BY created_at DESC LIMIT 1
    `) as any[];
    return {
      ok: false, status: 400,
      error: !warum
        ? "Dieser Kunde hat keine Bestellung — es gibt nichts zu berechnen."
        : warum.payment_status === "paid"
          ? "Dieser Kunde hat bereits bezahlt."
          : `Der Antrag ist noch nicht abgeschlossen (Stand: ${warum.status}). `
            + "Ruf an und hilf ihm, ihn fertigzustellen — danach lässt sich eine "
            + "Rechnung stellen.",
    };
  }
  const empfaenger = bestellung.email || bestellung.contact_email || bestellung.billing_email;
  if (!empfaenger) {
    return { ok: false, status: 400, error: "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt." };
  }

  // ── ERST SENDEN, DANN BUCHEN (Meldung 05.08.2026) ────────────────────────
  // Vorher lief der Versand als Fire-and-forget NACH dem Buchen: Der Agent las
  // „Zahlungsdetails versandt", während Make den Event vielleicht abgelehnt
  // hatte. Ein Fehlversand darf auch keinen Verlaufseintrag erzeugen — der würde
  // später als Betreuungsnachweis für eine Provision gelesen.
  const versand = await sendMakeWebhookMitGrund("payment_details", {
    ...makePayloadFromRow(bestellung),
    invoice_url: bestellung.payment_reference ? signInvoiceUrl(bestellung.payment_reference) : null,
  });
  if (!versand.ok) {
    return { ok: false, status: 502, error: `Die Mail ging NICHT raus: ${versand.grund}`, empfaenger };
  }

  await sqlPool.begin(async (tx) => {
    await tx`
      UPDATE fiaon_persons SET invoice_sent_count = invoice_sent_count + 1, updated_at = NOW()
      WHERE id = ${personId}
    `;
    await tx`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${bestellung.ref}, ${agentId}, ${agentName}, 'email_sent',
              ${`Zahlungsdetails erneut versandt (${bestellung.payment_reference || bestellung.ref})`}, NOW())
    `;
  });

  const [nachher] = await sqlPool`SELECT invoice_sent_count FROM fiaon_persons WHERE id = ${personId}`;
  const anzahl = Number(nachher?.invoice_sent_count || 1);
  return {
    ok: true, empfaenger, anzahl,
    warnung: anzahl >= RECHNUNG_WARNUNG_AB
      ? `Das war der ${anzahl}. Versand. Weitere Mails bringen erfahrungsgemäß nichts — ruf an.`
      : null,
  };
}

/**
 * Den Kunden bitten, seine Telefonnummer selbst zu korrigieren.
 *
 * Bewusst getrennt vom Ergebnis "Falsche Nummer": Das Ergebnis dokumentiert
 * einen Anrufversuch und verschiebt die Wiedervorlage. Dieser Knopf verschickt
 * NUR die Mail mit dem Korrektur-Link — etwa dann, wenn man die Nummer schon
 * gestern als falsch erkannt hat und jetzt nur den Link nachschieben will.
 * Zwei Dinge in einem Knopf zu buendeln, haette einen von beiden unbrauchbar
 * gemacht.
 */
export async function nummerKorrekturSenden(
  personId: number, agentId: number, agentName: string, opts: { pruefeBesitz?: boolean } = {},
): Promise<{ ok: boolean; status?: number; error?: string; empfaenger?: string }> {
  if (opts.pruefeBesitz) {
    const p = await meinePerson(personId, agentId);
    if (!p) return { ok: false, status: 404, error: "Kunde nicht gefunden" };
  }
  const [b] = await sqlPool`
    SELECT ref, COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')) AS email,
           COALESCE(first_name, contact_name) AS first_name
    FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!b?.ref) return { ok: false, status: 400, error: "Keine Bestellung zu diesem Kunden" };
  if (!b.email) {
    return {
      ok: false, status: 400,
      error: "Ohne E-Mail-Adresse koennen wir den Kunden nicht um seine Nummer bitten.",
    };
  }
  const { maybeSendNumberUpdateMail } = await import("../fiaon-number-update");
  const erg = await maybeSendNumberUpdateMail("app", b.ref, { email: b.email, firstName: b.first_name });
  if (!erg.sent) {
    // Der Grund kommt aus der Sperre (hoechstens 1x pro Tag je Person) — das
    // muss der Agent lesen, sonst klickt er dreimal und glaubt an einen Fehler.
    return { ok: false, status: 400, error: erg.reason || "Die Mail wurde nicht versendet." };
  }
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
    VALUES (${b.ref}, ${agentId}, ${agentName}, 'email_sent',
            ${`Bitte um Nummern-Korrektur versandt an ${b.email}`}, NOW())
  `.catch(() => {});
  return { ok: true, empfaenger: b.email };
}

router.post("/agent/crm/kunden/:personId/nummer-korrektur", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const erg = await nummerKorrekturSenden(
      Number(req.params.personId), req.agent!.id, req.agent!.name, { pruefeBesitz: true },
    );
    if (!erg.ok) return res.status(erg.status || 400).json({ ok: false, error: erg.error });
    res.json({ ok: true, versandtAn: erg.empfaenger });
  } catch (err) {
    console.error("[AGENT-KUNDEN] nummer-korrektur:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/crm/kunden/:personId/rechnung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const erg = await zahlungsdatenSenden(personId, req.agent!.id, req.agent!.name, { pruefeBesitz: true });
    if (!erg.ok) return res.status(erg.status || 400).json({ ok: false, error: erg.error });
    const neu = await meinePerson(personId, req.agent!.id);
    res.json({
      ok: true,
      kunde: kartePayload(neu, await letzteAktivitaetVon(personId)),
      versandtAn: erg.empfaenger,
      warnung: erg.warnung,
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] rechnung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/crm/kunden/:personId/testeintrag-melden
//
// Der von Agenten gemeldete Fake-Account gehört ins Archiv — aber nicht durch
// den Agenten selbst. Wer seine eigene Arbeitsliste kürzen kann, hat einen
// Anreiz, unbequeme Kunden zu „Testeinträgen" zu erklären. Die Meldung geht als
// Aufgabe an die Vertriebsleitung; die entscheidet und archiviert.
// ───────────────────────────────────────────────────────────────────────────
router.post("/agent/crm/kunden/:personId/testeintrag-melden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const p = await meinePerson(personId, req.agent!.id);
    if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    // Der Agent meldet eine BESTELLUNG. Ohne Angabe die jüngste nicht
    // archivierte — das ist die, die er in der Liste vor sich hat.
    const ref = req.body?.ref ? String(req.body.ref) : null;
    const [b] = ref
      ? await sqlPool`SELECT ref FROM fiaon_applications WHERE ref = ${ref} AND person_id = ${personId}`
      : await sqlPool`
          SELECT ref FROM fiaon_applications
          WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
          ORDER BY created_at DESC LIMIT 1
        `;
    if (!b) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });

    const { meldeTesteintrag, ArchivVerboten } = await import("../lib/fiaon-antrag-archiv");
    try {
      await meldeTesteintrag(String(b.ref), String(req.body?.begruendung ?? ""), {
        id: req.agent!.id, name: req.agent!.name,
      });
    } catch (err: any) {
      if (err instanceof ArchivVerboten) return res.status(400).json({ ok: false, error: err.message });
      throw err;
    }
    res.json({
      ok: true,
      meldung: "Gemeldet. Die Vertriebsleitung prüft und archiviert, wenn es stimmt — "
        + "der Kunde bleibt bis dahin in deiner Liste.",
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] testeintrag-melden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /agent/crm/kunden/:personId/zahlungsbeleg
//
// „Lass dir ein Bild der Überweisung schicken" lief über die WhatsApp-Gruppe und
// versandete. Der Agent hängt den Beleg ab jetzt an die Bestellung — dort, wo
// gebucht wird. Der Upload bucht NICHTS: Er beschleunigt die Prüfung.
// ───────────────────────────────────────────────────────────────────────────
const belegUploadAgent = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/agent/crm/kunden/:personId/zahlungsbeleg", requireAgent,
  belegUploadAgent.single("beleg"), async (req: AgentRequest, res: Response) => {
    try {
      const personId = Number(req.params.personId);
      const p = await meinePerson(personId, req.agent!.id);
      if (!p) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

      // Die Bestellung, um die es geht: die jüngste offene. Auf eine bezahlte
      // Bestellung einen Beleg zu legen ist sinnlos — sie ist schon gebucht.
      const ref = req.body?.ref ? String(req.body.ref) : null;
      const [b] = ref
        ? await sqlPool`SELECT ref FROM fiaon_applications WHERE ref = ${ref} AND person_id = ${personId}`
        : await sqlPool`
            SELECT ref FROM fiaon_applications
            WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL
              AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
            ORDER BY created_at DESC LIMIT 1
          `;
      if (!b) {
        return res.status(400).json({
          ok: false,
          error: "Dieser Kunde hat keine offene Bestellung — es gibt nichts, wozu ein Beleg gehören könnte.",
        });
      }

      const { fuehreBelegUploadAus } = await import("./fiaon-dubletten");
      const { status, antwort } = await fuehreBelegUploadAus(
        String(b.ref), (req as any).file, req.body,
        { name: req.agent!.name, agentId: req.agent!.id },
      );
      res.status(status).json(antwort);
    } catch (err) {
      console.error("[AGENT-KUNDEN] zahlungsbeleg:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// DIE ERSTE RECHNUNG
//
// Der Vorgesetzte: „ALLE die einen Antrag bei uns gestellt haben brauchen eine
// Rechnung und müssen täglich versendet werden und den Agenten eben passend
// angezeigt werden und mit Knopfdruck versendbar sein für den Agenten!"
// ═══════════════════════════════════════════════════════════════════════════

/** GET /agent/rechnungen/offen — wer braucht eine erste Rechnung? */
router.get("/agent/rechnungen/offen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { rechnungsKandidaten } = await import("../lib/fiaon-rechnung-stellen");
    // Ein Agent sieht SEINE Kunden. Die Leitung sieht alle — sie muss wissen,
    // wie viel Arbeit im Haus liegt.
    const rolle = String(req.agent!.rolle || "agent");
    const alle = await rechnungsKandidaten({
      agentId: ["vertriebsleiter", "admin"].includes(rolle) ? null : req.agent!.id,
      grenze: 500,
    });
    res.json({
      ok: true,
      kandidaten: alle,
      zahlen: {
        gesamt: alle.length,
        versendbar: alle.filter((k) => !k.hindernis).length,
        ohneMail: alle.filter((k) => k.hindernis?.startsWith("Keine E-Mail")).length,
        ohnePaket: alle.filter((k) => k.hindernis?.includes("Paket")).length,
      },
    });
  } catch (err) {
    console.error("[RECHNUNG] offen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/rechnungen/:ref/stellen — eine Rechnung mit Knopfdruck.
 *
 * ── WARUM DER AGENT DAS SELBST AUSLÖST ────────────────────────────────────
 * Die versendbaren Anträge sind im Schnitt 48 Tage alt, 79 davon älter als 60
 * Tage. Eine Rechnung nach zwei Monaten kommt für den Kunden aus dem Nichts —
 * ein Anruf davor ist mehr wert als jede Automatik.
 *
 * Der Tageslauf arbeitet deshalb nur den Rest ab; der Knopf gehört dem
 * Menschen, der gerade telefoniert hat.
 */
router.post("/agent/rechnungen/:ref/stellen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { rechnungStellen } = await import("../lib/fiaon-rechnung-stellen");
    const erg = await rechnungStellen(String(req.params.ref), {
      akteur: req.agent!.name, agentId: req.agent!.id,
    });
    res.json(erg.ok
      ? { ok: true, meldung: `Rechnung an ${erg.empfaenger} verschickt.` }
      : { ok: false, error: erg.grund });
  } catch (err) {
    console.error("[RECHNUNG] stellen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EINE DOPPELTE BUCHUNG AUS DEM WEG RÄUMEN
//
// ── DER AUFTRAG (13.08.2026) ───────────────────────────────────────────────
// Der Vorgesetzte: „Agenten, Vertriebsleiter, Onboarding, Forderungsmanagement
// sollen ab sofort Produkte/Buchungen löschen können. Es kommt oft vor, dass ein
// Kunde doppelte oder dreifache Buchungen hat, jeder soll es markieren und
// löschen können."
//
// Daniel Stripling, 00:30: „Man sieht hier jetzt alle Anträge. Fragt man dann am
// Telefon nach, welchen die Person möchte, löscht die anderen und sendet dann
// entsprechend die Zahlungsdaten-E-Mail? Weil Anträge rauslöschen geht nicht."
//
// ── ES WIRD ARCHIVIERT, NICHT GELÖSCHT ─────────────────────────────────────
// AGENTS.md: „Keine Hard-Deletes, nirgends. Nicht bei Kunden, nicht bei
// Bestellungen, nicht bei Nachweisen."
//
// Das ist kein Formalismus. Eine gelöschte Bestellung nimmt drei Dinge mit:
// den Provisionsnachweis, die Spur im Zahlungsabgleich (Geld, das später unter
// dieser Referenz eintrifft, wäre nicht zuzuordnen) und die Möglichkeit, einen
// Fehlklick zurückzunehmen.
//
// Für den Agenten sieht es aus wie Löschen: Die Buchung verschwindet aus seiner
// Liste. Sie ist nur nicht weg.
//
// ── DREI WÄNDE ─────────────────────────────────────────────────────────────
//   1. BEZAHLTES bleibt. `archivPruefung` sperrt es — eine bezahlte Bestellung
//      aus den Zahlen zu nehmen wäre eine Umsatzkorrektur, keine Aufräumarbeit.
//   2. DIE LETZTE Buchung bleibt. Ein Kunde ohne Bestellung ist ein Datensatz
//      ohne Anlass; wer wirklich alles wegräumen will, hat einen anderen Fall.
//   3. JEDER SCHRITT STEHT IM PROTOKOLL — mit Namen. Wer seine eigene
//      Arbeitsliste kürzen kann, hat einen Anreiz, unbequeme Kunden
//      wegzuräumen. Deshalb war es bisher gesperrt. Jetzt ist es offen, aber
//      nachvollziehbar: Die Vertriebsleitung sieht in der Dublettenansicht,
//      wer was archiviert hat, und kann es zurücknehmen.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /agent/buchungen/:personId — alle Buchungen mit Archiv-Auskunft. */
router.get("/agent/buchungen/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Kein Zugriff auf diesen Kunden." });
    }
    const { buchungenVon } = await import("../lib/fiaon-buchungen");
    const { archivPruefung, ARCHIV_GRUENDE } = await import("../lib/fiaon-antrag-archiv");
    const buchungen = await buchungenVon(personId);
    // Je Buchung: Darf sie weg? Und wenn nicht, warum nicht?
    const mitPruefung = await Promise.all(buchungen.map(async (b) => {
      const p = await archivPruefung(b.ref).catch(() => null);
      return {
        ...b,
        darfWeg: !!p && !p.sperrgrund && buchungen.filter((x) => !x.erledigt).length > 1,
        sperrgrund: p?.sperrgrund
          ?? (buchungen.filter((x) => !x.erledigt).length <= 1
            ? "Das ist die einzige Buchung — ein Kunde ohne Bestellung hat keinen Anlass mehr."
            : null),
      };
    }));
    res.json({ ok: true, buchungen: mitPruefung, gruende: ARCHIV_GRUENDE });
  } catch (err) {
    console.error("[AGENT-KUNDEN] buchungen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/buchungen/:ref/archivieren — die doppelte Buchung wegräumen. */
router.post("/agent/buchungen/:ref/archivieren", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const [b] = (await sqlPool`
      SELECT person_id FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    if (!b?.person_id) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden." });

    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, Number(b.person_id)))) {
      return res.status(403).json({ ok: false, error: "Kein Zugriff auf diesen Kunden." });
    }

    // ── DIE LETZTE BUCHUNG BLEIBT ─────────────────────────────────────────
    const [zahl] = (await sqlPool`
      SELECT COUNT(*)::int AS n FROM fiaon_applications
      WHERE person_id = ${Number(b.person_id)} AND merged_into IS NULL
        AND archived_at IS NULL AND payment_status NOT IN ('cancelled', 'refunded')
    `) as any[];
    if (Number(zahl.n) <= 1) {
      return res.status(400).json({
        ok: false,
        error: "Das ist die einzige Buchung dieses Kunden. Sie bleibt — ein Kunde "
          + "ohne Bestellung hat keinen Anlass mehr. Wenn der Kunde ganz weg soll, "
          + "melde ihn als Testeintrag oder gib ihn zurück.",
      });
    }

    const { archiviereAntrag, ArchivVerboten } = await import("../lib/fiaon-antrag-archiv");
    try {
      await archiviereAntrag(
        ref,
        String(req.body?.grund || "doppelt"),
        req.body?.notiz ? String(req.body.notiz).slice(0, 500) : null,
        { name: req.agent!.name, agentId: req.agent!.id, rolle: "mitarbeiter" },
      );
    } catch (err: any) {
      if (err instanceof ArchivVerboten) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      throw err;
    }
    res.json({
      ok: true,
      meldung: "Buchung aus der Liste genommen. Sie ist archiviert, nicht gelöscht — "
        + "die Vertriebsleitung kann sie zurückholen, falls es die falsche war.",
    });
  } catch (err) {
    console.error("[AGENT-KUNDEN] archivieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
