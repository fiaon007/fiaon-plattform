// ═══════════════════════════════════════════════════════════════════
// FIAON Admin-Kommandozentrale (Paket O) — Read-only-Endpoints für den Hub
// - /admin/hub/stats:      Tages-Kennzahlen für /admin (Kopfbereich)
// - /admin/search:         Globale Schnellsuche (Cmd+K) über Kunden + Agents
// - /admin/invoices:       Rechnungs-Übersicht (Nummernkreis, Download-Links)
// - /admin/system-status:  Base-URL, Make-Webhook-Diagnose, INVOICE_VAT_MODE
// - /admin/legal-review:   LEGAL_REVIEW_PACKAGE.md read-only anzeigen
// Agent-Tokens werden durch blockAgentsFromAdmin (fiaon-agent.ts, davor
// gemountet) mit 403 abgewiesen. Keine Logik-/Schreib-Endpoints hier.
// ═══════════════════════════════════════════════════════════════════

import { Router } from "express";
import { sqlPool } from "../lib/db-pool";
import { readFile } from "fs/promises";
import path from "path";
import { getSettings, setSetting } from "./fiaon-agent";
import { baseUrlDiagnostics, absoluteUrl } from "../fiaon-base-url";
import { sendMakeWebhook, makePayloadFromRow, type MakeWebhookPayload } from "../make-webhook";
import { MAKE_EVENT_REGISTRY, getEventDef } from "../make-events-registry";
import { signInvoiceUrl } from "../fiaon-invoice";
import { berlinToday } from "../lib/fiaon-time";

const router = Router();

// ── O1: Tages-Kennzahlen ─────────────────────────────────────────────────────
router.get("/admin/hub/stats", async (_req, res) => {
  try {
    // `ist_entwurf` ausschliessen: 3.236 Zeilen (54 % des Bestands) haben weder
    // E-Mail noch Telefon — Menschen, die im Funnel vor dem Kontaktschritt
    // abgesprungen sind. „Neue Anträge heute" war bisher die Summe aus echten
    // Anträgen und diesen Absprüngen. Gepflegt wird das Kennzeichen an genau
    // einer Stelle (fiaon-person-model.ts), hier wird es nur gelesen.
    const [row] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE AND merged_into IS NULL AND NOT ist_entwurf) AS today_new,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL) AS claimed_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL), 0) AS claimed_sum,
        COUNT(*) FILTER (WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE) AND completed_at::date = CURRENT_DATE AND merged_into IS NULL) AS today_paid_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE) AND completed_at::date = CURRENT_DATE AND merged_into IS NULL), 0) AS today_paid_sum,
        COUNT(*) FILTER (WHERE invoice_number IS NOT NULL AND merged_into IS NULL) AS invoice_count
      FROM fiaon_applications
    `;
    const [payouts] = await sqlPool`
      SELECT COUNT(*) AS open FROM fiaon_payouts WHERE status = 'angefordert'
    `.catch(() => [{ open: 0 }] as any);
    const [agents] = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE active) AS active,
             COUNT(*) FILTER (WHERE bank_change_ack = FALSE) AS bank_changes
      FROM fiaon_agents
    `.catch(() => [{ active: 0, bank_changes: 0 }] as any);
    res.json({
      ok: true,
      todayNew: Number(row.today_new),
      claimed: { count: Number(row.claimed_count), sum: Number(row.claimed_sum) },
      todayPaid: { count: Number(row.today_paid_count), sum: Number(row.today_paid_sum) },
      invoiceCount: Number(row.invoice_count),
      openPayouts: Number(payouts.open),
      activeAgents: Number(agents.active),
      bankChanges: Number(agents.bank_changes),
    });
  } catch (err) {
    console.error("[FIAON-HUB] stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── P4-A: Hinweis-Badges + Aufgaben + Warnungen — EIN gecachter Endpoint ─────
// Alle Zähler serverseitig in einem Rutsch aggregiert, 60 s In-Memory-Cache
// (512-MB-Budget: nur ein kleines JSON-Objekt, keine Listen). Frontend pollt
// alle 60 s — kein Realtime-Stack, keine sechs Einzel-Requests.
let badgeCache: { at: number; data: any } | null = null;
const BADGE_CACHE_MS = 60_000;

async function computeBadges(): Promise<any> {
  const [apps] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE payment_status = 'claimed_paid' AND merged_into IS NULL)::int AS zahlungen,
      COUNT(*) FILTER (WHERE payment_status = 'paid' AND merged_into IS NULL
        AND COALESCE(commission_basis, '') <> 'direktzahler'
        AND assigned_agent_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM fiaon_commissions c WHERE c.ref = fiaon_applications.ref AND c.amount_cents > 0 AND c.status <> 'storniert')
      )::int AS nachbuchung
    FROM fiaon_applications
  `;
  // Doppelte BESTELLUNGEN — aber nur, wenn sie zu VERSCHIEDENEN Menschen
  // gehören. Seit der Massen-Zusammenführung (08.08.2026) hat ein Kunde seine
  // Bestellungen an einer Person; fünf Zeilen sind dann seine Historie und keine
  // Dublette. Ohne `COUNT(DISTINCT person_id) > 1` stand hier „44", während der
  // Dubletten-Arbeitsplatz daneben „keine offenen Kandidaten" meldete.
  const [dup] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM (
      SELECT LOWER(TRIM(email)) FROM fiaon_applications
      WHERE merged_into IS NULL AND archived_at IS NULL AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
         AND COUNT(*) FILTER (WHERE payment_status IN ('pending_payment', 'claimed_paid')) > 0
         AND COUNT(DISTINCT person_id) > 1
    ) x
  `;
  // Offene PERSONEN-Kandidaten (Teil 2) — die eigentliche Arbeit am
  // Dubletten-Arbeitsplatz. Die Zahl oben zählt doppelte BESTELLUNGEN; beide
  // führen auf dieselbe Seite, also stehen sie in derselben Pille.
  // Nur aus dem Speicher lesen und sonst im Hintergrund wärmen: Die Suche läuft
  // über den ganzen Personenbestand und brauchte hier anfangs achteinhalb
  // Sekunden — bei einem Abruf pro Minute hätte der Zähler im Menü das ganze
  // Dashboard langsam gemacht. Die Zahl kommt aus derselben Quelle wie die
  // Liste, ist also nie eine zweite Wahrheit, nur bis zu zwei Minuten alt.
  let personenDubletten = 0;
  try {
    const { kandidatenZahlenSofort, kandidatenWaermen } = await import("../lib/fiaon-dubletten-kandidaten");
    personenDubletten = kandidatenZahlenSofort()?.gesamt ?? 0;
    kandidatenWaermen();
  } catch (err) {
    console.error("[FIAON-HUB] dubletten-kandidaten:", err);
  }
  const [payouts] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_payouts WHERE status = 'angefordert'
  `.catch(() => [{ c: 0 }] as any);
  // #18: „Lange bezahlt, nie bestätigt" — Kunden, die seit > 7 Tagen „Ich habe
  // überwiesen" gemeldet haben (claimed_paid), aber nie auf 'paid' bestätigt
  // wurden. Hier liegt unerkannter Umsatz. MIN(...) für die Alter-Anzeige.
  const [payConfirm] = await sqlPool`
    SELECT COUNT(*)::int AS c,
           FLOOR(EXTRACT(EPOCH FROM (NOW() - MIN(claimed_paid_at))) / 86400)::int AS oldest_days
    FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
      AND claimed_paid_at IS NOT NULL AND claimed_paid_at < NOW() - INTERVAL '7 days'
  `.catch(() => [{ c: 0, oldest_days: null }] as any);
  // Prompt 2/3: Badge zeigt Tickets, die auf eine BETREIBER-ANTWORT warten —
  // nicht alle offenen. „Wartet" = der jüngste echte Beitrag (agent/admin) im
  // Thread stammt vom Agenten. Fällt auf „offen" zurück, falls (noch) kein
  // Verlauf existiert (defensiv gegen Alt-Daten).
  const [feedback] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_agent_feedback f
    WHERE (
      SELECT m.author FROM fiaon_agent_feedback_messages m
      WHERE m.feedback_id = f.id AND m.author IN ('agent', 'admin')
      ORDER BY m.created_at DESC, m.id DESC LIMIT 1
    ) = 'agent'
  `.catch(() => [{ c: 0 }] as any);
  const [bank] = await sqlPool`
    SELECT COUNT(*) FILTER (WHERE match_status = 'unmatched' AND applied = FALSE)::int AS unmatched,
           COUNT(*) FILTER (WHERE match_status IN ('matched', 'manual') AND applied = FALSE)::int AS matched_unapplied
    FROM fiaon_bank_txns
  `.catch(() => [{ unmatched: 0, matched_unapplied: 0 }] as any);

  // Warn-Signale (echte Probleme, mit Erklärung + Lösung im Frontend)
  const [leadIntake] = await sqlPool`
    SELECT EXTRACT(EPOCH FROM (NOW() - MAX(erstellt_am))) / 3600 AS hours FROM fiaon_leads
  `.catch(() => [{ hours: null }] as any);
  const [blockedAkten] = await sqlPool`
    SELECT COUNT(*)::int AS c, MIN(ag.name) AS first_agent
    FROM fiaon_leads l JOIN fiaon_agents ag ON ag.id = l.opened_by_agent_id
    WHERE l.opened_at IS NOT NULL AND l.status IN ('neu', 'kontaktiert', 'nicht_erreichbar')
  `.catch(() => [{ c: 0, first_agent: null }] as any);
  // P5-D: kritische Diagnose-Ereignisse der letzten 24 h — Nav-Badge + Warn-Kachel.
  const [diag] = await sqlPool`
    SELECT COUNT(DISTINCT fingerprint)::int AS c
    FROM fiaon_diagnostics
    WHERE severity = 'kritisch' AND created_at > NOW() - INTERVAL '24 hours'
  `.catch(() => [{ c: 0 }] as any);
  // ── ZUSTELLUNG: WAS IST HEUTE RAUSGEGANGEN, WAS NICHT? ──────────────────
  // Betreiber: „Make-Routen gehen bei Tests alle durch — aber viele bekommen
  // dann keine E-Mail."
  //
  // Eine gescheiterte Mail war bisher nur im Protokoll zu finden, wenn man
  // ausdrücklich danach suchte. Niemand sucht nach etwas, von dem er nicht
  // weiß, dass es passiert ist. Deshalb steht die Zahl jetzt auf dem
  // Dashboard — und `personenOhneMail` sagt, bei wie vielen Menschen mit
  // offener Rechnung es gar nicht erst versucht werden kann.
  const [zustellung] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE status = 'versandt'
        AND (created_at AT TIME ZONE 'Europe/Berlin')::date
            = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS versandt_heute,
      COUNT(*) FILTER (WHERE status = 'fehlgeschlagen'
        AND (created_at AT TIME ZONE 'Europe/Berlin')::date
            = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS fehl_heute,
      COUNT(*) FILTER (WHERE status = 'fehlgeschlagen'
        AND created_at > NOW() - INTERVAL '7 days')::int AS fehl_woche
    FROM fiaon_mail_log
  `.catch(() => [{ versandt_heute: 0, fehl_heute: 0, fehl_woche: 0 }] as any);
  // Menschen mit offener Rate, für die keine Adresse auffindbar ist — weder
  // an der Person, noch als Alias, noch an einer Bestellung.
  const [ohneMail] = await sqlPool`
    SELECT COUNT(DISTINCT a.person_id)::int AS c
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.person_id IS NOT NULL
      AND COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''),
                   NULLIF(TRIM(a.billing_email),'')) IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_persons p
                       WHERE p.id = a.person_id AND NULLIF(TRIM(p.primary_email),'') IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM fiaon_person_aliases al
                       WHERE al.person_id = a.person_id AND al.kind = 'email')
  `.catch(() => [{ c: 0 }] as any);

  // Eigene offene Aufgaben (Notizen/Aufgaben-Modul) — sie gehören in dieselbe
  // Liste wie alles andere, was liegen geblieben ist.
  // ── DIE MARKEN AUS DER EINEN QUELLE ────────────────────────────────────
  // server/lib/fiaon-marken.ts zählt jede Marke EINMAL — dieselbe Funktion
  // benutzt auch die Zielseite. Ein Fehler dabei darf die Kacheln nicht
  // umwerfen, deshalb ein Rückfall auf Nullen.
  const { alleMarken } = await import("../lib/fiaon-marken");
  let marken = await alleMarken().catch((err) => {
    console.error("[FIAON-HUB] marken:", err);
    return {
      aufgaben: { wert: 0, ziel: "/admin/aufgaben", text: "" },
      zustellung: { wert: 0, ziel: "/admin/events", text: "" },
      zahlungen: { wert: 0, ziel: "/admin/zahlungen", text: "" },
      auszahlungen: { wert: 0, ziel: "/admin/auszahlungen", text: "" },
      nachbuchung: { wert: 0, ziel: "/admin/team?tab=nachbuchung", text: "" },
    };
  });

  let aufgaben = { offen: 0, ueberfaellig: 0, heute: 0, zugewiesen: 0 };
  try {
    const { vermerkZahlen } = await import("./fiaon-vermerke");
    aufgaben = await vermerkZahlen();
  } catch (err) {
    console.error("[FIAON-HUB] aufgaben:", err);
  }

  const settings = await getSettings();
  // Der Kontoabgleich ist abschaltbar (kontoabgleich_enabled). Ist er aus, darf
  // die Zahl der nicht zugeordneten Bank-Eingänge NICHT mehr als Aufgabe
  // erscheinen: sie würde in eine abgeschaltete Ansicht führen. Die bereits
  // zugeordneten, aber unverbuchten Eingänge bleiben sichtbar — die gehören zu
  // /admin/verbuchung und sind echte, noch zu erledigende Arbeit.
  const abgleichAn = String(settings.kontoabgleich_enabled ?? "false").toLowerCase() === "true";
  // Die Verbuchungs-Seite ist ebenfalls abschaltbar. Ist sie aus, darf ihre
  // Aufgabe nicht mehr im Dashboard stehen — sie würde ins Leere führen.
  const verbuchungAn = String(settings.verbuchung_enabled ?? "false").toLowerCase() === "true";

  return {
    // Badges (Nav): Schlüssel = Nav-Pfad-Kürzel; 0 ⇒ Frontend blendet aus.
    // Alle Marken aus der EINEN Quelle. Ein zweites Zählen daneben wäre die
    // zweite Gelegenheit, auseinanderzulaufen — genau so ist dieser Fehler
    // entstanden.
    marken,
    badges: {
      zahlungen: Number(apps.zahlungen),
      auszahlungen: Number(payouts.c),
      feedback: Number(feedback.c),
      // Vorher „Number(apps.nachbuchung)" — eine eigene Abfrage, die 14 zählte,
      // während die Zielseite 21 Fälle zeigte. Jetzt dieselbe Funktion.
      nachbuchung: marken.nachbuchung.wert,
      dubletten: Number(dup.c) + personenDubletten,
      kontoabgleich: abgleichAn ? Number(bank.unmatched) : 0,
      diagnose: Number(diag.c), // P5-D: kritische Ereignisse (24 h)
      // Nav-Pille an „Notizen & Aufgaben": nur was DRÄNGT (heute + überfällig).
      // Alle offenen zu zählen würde die Zahl dauerhaft hoch halten, und eine
      // Zahl, die immer da ist, liest niemand mehr.
      // ── DIE MARKE ZÄHLT, WAS DIE ZIELSEITE ZEIGT (17.08.2026) ─────────
      // Hier stand „aufgaben.heute + aufgaben.ueberfaellig". GEMESSEN stand
      // die Marke damit auf 0, während /admin/aufgaben ACHT offene Aufgaben
      // zeigte. Eine Marke, die schweigt, wenn es Arbeit gibt, ist schlimmer
      // als eine, die zu viel zeigt.
      //
      // Die Zählung steht jetzt in server/lib/fiaon-marken.ts — einmal, für
      // Marke und Zielseite.
      aufgabenOffen: marken.aufgaben.wert,
      // Nur die Fehlschläge sind eine Aufgabe. „Versandt" gehört auf die
      // Karte, nicht an die Navigation — eine Zahl, die immer da ist, liest
      // nach drei Tagen niemand mehr.
      // Vorher „fehl_heute": Die Marke stand auf 0, im Protokoll lagen 70
      // Fehlschläge aus 14 Tagen — darunter 68 verbrauchte Termin-
      // Erinnerungen, die niemand bemerkt hatte. Das Protokoll zeigt 14 Tage,
      // also zählt die Marke 14 Tage.
      zustellung: marken.zustellung.wert,
    },
    // ── Die Zustellkarte fürs Dashboard ──────────────────────────────────
    zustellung: {
      versandtHeute: Number(zustellung.versandt_heute),
      fehlgeschlagenHeute: Number(zustellung.fehl_heute),
      fehlgeschlagenWoche: Number(zustellung.fehl_woche),
      personenOhneMail: Number(ohneMail.c),
      // Deep-Link auf das GEFILTERTE Protokoll. Eine Karte, die nur eine Zahl
      // zeigt, zwingt zum Suchen — und dann sucht niemand.
      link: "/admin/events?status=fehlgeschlagen#zustellung",
      meldung: `Zustellung: ${Number(zustellung.versandt_heute)} versandt, `
        + `${Number(zustellung.fehl_heute)} fehlgeschlagen`,
    },
    // Aufgaben: eigene offene, davon überfällig/heute, plus die an Agenten
    // vergebenen (die erledigt der Agent, sie stehen hier nur zur Übersicht).
    aufgaben,
    // Schalter, die die Oberfläche kennen muss (Navigation, Aufgabenliste).
    flags: {
      kontoabgleich: abgleichAn,
      verbuchung: verbuchungAn,
      abgleichHistorie: Number(bank.unmatched) + Number(bank.matched_unapplied),
    },
    // Zusatzsignale für die Dashboard-Warn-Kacheln
    warn: {
      leadIntakeHours: leadIntake.hours != null ? Math.round(Number(leadIntake.hours)) : null,
      followupPaused: settings.lead_followup_enabled !== "1",
      bankMatchedUnapplied: verbuchungAn ? Number(bank.matched_unapplied) : 0,
      blockedAkten: Number(blockedAkten.c),
      blockedAktenAgent: blockedAkten.first_agent || null,
      criticalDiagnostics: Number(diag.c), // P5-D: eine Wahrheit, zwei Ansichten
      // #18: seit > 7 Tagen angekündigt, nie bestätigt (unerkannter Umsatz)
      paymentConfirmBacklog: Number(payConfirm.c),
      paymentConfirmOldestDays: payConfirm.oldest_days != null ? Number(payConfirm.oldest_days) : null,
    },
    at: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE TAGESLÄUFE — WELCHE AUTOMATIK LEBT, UND WELCHE STEHT?
//
// ── DER ANLASS (30.08.2026) ────────────────────────────────────────────────
// Der Folgelauf stand FÜNFZEHN TAGE still, und niemand hat es gemerkt. Es gab
// keine Stelle, an der man „läuft die Automatik?" hätte nachsehen können — die
// Antwort musste man aus erzeugten Raten und verschickten Mails erraten.
//
// ── WARUM DIE FOLGE MITKOMMT ──────────────────────────────────────────────
// Eine Ampel ohne Folge ist eine Farbe. Wer „rot" sieht und nicht weiß, was
// dadurch liegen bleibt, priorisiert nicht — und eine Warnung, die man nicht
// priorisieren kann, wird weggeklickt. Der Satz steht deshalb in
// `LAUF_FOLGEN` neben der Ampel und kommt hier mit.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/hub/laeufe", async (_req, res) => {
  try {
    const { alleLaufAmpeln, AMPEL_GELB_STUNDEN, AMPEL_ROT_STUNDEN, CRONS_AN } =
      await import("../lib/fiaon-crons");
    const laeufe = await alleLaufAmpeln();
    res.json({
      ok: true,
      // Ohne diese Angabe liest man auf einem Entwicklungsrechner acht rote
      // Ampeln und sucht einen Fehler, den es nicht gibt: Dort ist die
      // Automatik ABSICHTLICH aus (server/lib/fiaon-crons.ts).
      cronsAn: CRONS_AN,
      grenzen: { gelb: AMPEL_GELB_STUNDEN, rot: AMPEL_ROT_STUNDEN },
      laeufe,
      rot: laeufe.filter((l) => l.ampel === "rot").length,
      gelb: laeufe.filter((l) => l.ampel === "gelb").length,
      unbekannt: laeufe.filter((l) => l.ampel === "unbekannt").length,
    });
  } catch (err) {
    console.error("[HUB] laeufe:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KANN DAS TEAM ARBEITEN? — GESPERRTE KERNAKTIONEN UND FREIE ZEITEN
//
// ── DIE STRUKTURELLE LEHRE AUS ZWEI MELDUNGEN (19.08.2026) ─────────────────
// Zweimal hintereinander meldete das Team einen Knopf, der „nicht geht":
//
//   Florentine: „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen
//               keine Mail schicken." (139 Karten gaben den Knopf frei,
//               während der Server ablehnte)
//   Herr Hertel: „Ich kann keine Zeit wählen." (38 Versuche, alle abgelehnt,
//               weil die Anzeige andere Regeln hatte als die Buchung)
//
// Beide Male stand die Ursache in den Daten, beide Male hat es ein MENSCH
// gemeldet — nicht die Anwendung. Diese Karte dreht das um.
//
// ── WAS SIE ZÄHLT ─────────────────────────────────────────────────────────
//   · Wie viele Kunden können ihre Zahlungsdaten NICHT bekommen, obwohl es
//     objektiv etwas zu senden gäbe? (muss 0 sein)
//   · Wie viele freie Onboarding-Zeiten gibt es in 14 Tagen? (rot unter 10)
//   · Wie viele Buchungsversuche sind heute gescheitert, und woran?
//
// ── WARUM ZAHLEN UND KEINE AMPEL ALLEIN ───────────────────────────────────
// „Alles in Ordnung" wird nach zwei Wochen nicht mehr gelesen. Eine Zahl, die
// sich bewegt, schon. Und ein Sprung nach oben ist die Meldung, bevor das Team
// schreibt.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/admin/hub/knopfdurchgang", async (_req, res) => {
  try {
    const { sendeGrundSql } = await import("../lib/fiaon-massgebliche-bestellung");

    // ── 1. ZAHLUNGSDATEN: gesperrt, obwohl objektiv sendbar ───────────────
    // Die Bedingung links ist die REGEL aus dem Auftrag („lebende offene
    // Bestellung UND zustellbare Adresse"), rechts steht die Auflösung. Gehen
    // sie auseinander, ist das der Fehler vom 19.08.2026.
    const [zahlung] = (await sqlPool.unsafe(`
      SELECT
        COUNT(*) FILTER (WHERE ${sendeGrundSql("p")} IN ('frei', 'erste_rechnung'))::int AS sendbar,
        COUNT(*) FILTER (WHERE
          EXISTS (SELECT 1 FROM fiaon_applications a
            WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.archived_at IS NULL
              AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
              AND a.payment_status IN ('pending_payment','claimed_paid','expired')
              AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''),
                           NULLIF(a.billing_email,''), NULLIF(p.primary_email,'')) IS NOT NULL)
          AND ${sendeGrundSql("p")} NOT IN ('frei', 'erste_rechnung'))::int AS gesperrt_obwohl
      FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
    `)) as any[];

    // ── 2. FREIE ONBOARDING-ZEITEN IN 14 TAGEN ────────────────────────────
    // Der Messwert, der Herrn Hertels Anruf überflüssig gemacht hätte.
    const { freieSlots, rollenMitRueckfall } = await import("../lib/fiaon-termine");
    const [bezugskunde] = (await sqlPool`
      SELECT p.id FROM fiaon_persons p
      JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
        AND a.payment_status = 'paid'
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
        AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id)
      ORDER BY a.paid_at ASC NULLS LAST LIMIT 1
    `) as any[];
    let slotsGesamt = 0;
    let tageMitZeiten = 0;
    let rueckfall = false;
    if (bezugskunde) {
      const r = await rollenMitRueckfall("onboarding_call");
      rueckfall = r.rueckfall;
      const a = await freieSlots(Number(bezugskunde.id), sqlPool, "onboarding_call");
      slotsGesamt = a.slots.length;
      tageMitZeiten = new Set(a.slots.map((s) => String(s.beginn).slice(0, 10))).size;
    }

    // ── 3. BUCHUNGSVERSUCHE HEUTE ─────────────────────────────────────────
    const [versuche] = (await sqlPool`
      SELECT COUNT(*)::int AS gesamt,
             COUNT(*) FILTER (WHERE ergebnis = 'abgelehnt')::int AS abgelehnt
      FROM fiaon_termin_versuche
      WHERE versucht_am > NOW() - INTERVAL '24 hours'
    `.catch(() => [{ gesamt: 0, abgelehnt: 0 }])) as any[];
    const versuchGruende = (await sqlPool`
      SELECT grund, COUNT(*)::int AS n FROM fiaon_termin_versuche
      WHERE versucht_am > NOW() - INTERVAL '24 hours' AND ergebnis = 'abgelehnt'
      GROUP BY grund ORDER BY n DESC
    `.catch(() => [])) as any[];

    // ── 4. NICHT ANRUFBAR ─────────────────────────────────────────────────
    const { nichtWaehlbarSql } = await import("../lib/fiaon-telefon");
    const [telefon] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM fiaon_persons p
      WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
        AND ${nichtWaehlbarSql("p")}
    `)) as any[];

    const gesperrt = Number(zahlung?.gesperrt_obwohl ?? 0)
      + Number(telefon?.n ?? 0);

    res.json({
      ok: true,
      // Die eine Zahl für die Dashboard-Zeile.
      gesperrteKernaktionen: gesperrt,
      zahlungsdaten: {
        sendbar: Number(zahlung?.sendbar ?? 0),
        gesperrtObwohlSendbar: Number(zahlung?.gesperrt_obwohl ?? 0),
      },
      telefon: { nichtWaehlbar: Number(telefon?.n ?? 0) },
      onboardingZeiten: {
        frei: slotsGesamt,
        tageMitZeiten,
        rueckfall,
        // Rot unter 10: Bei fünf Zeiten am Tag ist das weniger als eine
        // Arbeitswoche Vorlauf — und der nächste Kunde steht vor einer Lücke.
        ampel: slotsGesamt >= 10 ? "gruen" : slotsGesamt > 0 ? "gelb" : "rot",
        hinweis: slotsGesamt === 0
          ? "KEINE freien Zeiten. Kunden sehen einen leeren Kalender und rufen an — "
            + "genau so ist der Fall Hertel aufgefallen."
          : rueckfall
            ? "Kein aktives Onboarding-Konto — die Zeiten kommen aus Vertrieb und "
              + "Leitung (Rückfall). Das ist gewollt, sollte aber nicht der Dauerzustand sein."
            : null,
      },
      buchungsversuche: {
        gesamt: Number(versuche?.gesamt ?? 0),
        abgelehnt: Number(versuche?.abgelehnt ?? 0),
        gruende: versuchGruende.map((g) => ({ grund: g.grund, n: Number(g.n) })),
      },
    });
  } catch (err) {
    console.error("[HUB] knopfdurchgang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/hub/badges", async (_req, res) => {
  try {
    if (badgeCache && Date.now() - badgeCache.at < BADGE_CACHE_MS) {
      return res.json({ ok: true, cached: true, ...badgeCache.data });
    }
    const data = await computeBadges();
    badgeCache = { at: Date.now(), data };
    res.json({ ok: true, cached: false, ...data });
  } catch (err) {
    console.error("[FIAON-HUB] badges:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Lage: die vier Fragen, die das Dashboard beantworten muss ────────────────
// 1. Was haben WIR heute verdient?         → Umsatz bestätigter Zahlungen
// 2. Was haben die AGENTEN verdient?       → Provisionen, Rangliste
// 3. Wie viele Zahlungen sind angekündigt?  → heute und insgesamt
// 4. Was haben die Agenten zugesagt?       → „Kunde zahlt am …", je Agent
//
// Tagesgrenze: Europe/Berlin, nicht UTC. Die Alt-Kennzahlen benutzen
// `::date = CURRENT_DATE` — das ist im Sommer zwei Stunden falsch, eine Zahlung
// um 01:30 Berliner Zeit zählte dort noch zum Vortag. Deshalb hier durchgehend
// (spalte AT TIME ZONE 'Europe/Berlin')::date. Alle Zeitspalten sind timestamptz.
//
// EIN Endpoint, 60 s Cache: das Dashboard soll nicht sechs Abfragen auslösen.
let lageCache: { at: number; data: any } | null = null;
const LAGE_CACHE_MS = 60_000;

export async function computeLage(): Promise<any> {
  // EINE Tagesgrenze für alle vier Abfragen, in JavaScript bestimmt: liefe der
  // Tageswechsel mitten in der Auswertung, würden sich sonst zwei Abfragen auf
  // verschiedene Tage beziehen und die Summen widersprächen sich.
  const heute = berlinToday();

  // 1) Umsatz heute / gestern / Monat — amount_due ist EUR-numeric, daher × 100.
  const [umsatz] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE tag = ${heute}::date)::int                        AS heute_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag = ${heute}::date), 0) * 100) AS heute_cents,
      COUNT(*) FILTER (WHERE tag = ${heute}::date - 1)::int                    AS gestern_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag = ${heute}::date - 1), 0) * 100) AS gestern_cents,
      COUNT(*) FILTER (WHERE tag >= date_trunc('month', ${heute}::date)::date)::int AS monat_anzahl,
      ROUND(COALESCE(SUM(betrag) FILTER (WHERE tag >= date_trunc('month', ${heute}::date)::date), 0) * 100) AS monat_cents,
      COUNT(*)::int                                                           AS gesamt_anzahl,
      ROUND(COALESCE(SUM(betrag), 0) * 100)                                   AS gesamt_cents
    FROM (
      SELECT (completed_at AT TIME ZONE 'Europe/Berlin')::date AS tag, amount_due AS betrag
      FROM fiaon_applications
      WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE)
        AND merged_into IS NULL AND completed_at IS NOT NULL
    ) x
  `;

  // 1b) Verlauf der letzten 14 Tage. Eine Tageszahl allein sagt nichts — erst
  //     die Reihe zeigt, ob heute ein guter oder ein schwacher Tag ist. Tage
  //     ohne Zahlung müssen als 0 auftauchen, sonst zieht die Linie eine Lücke
  //     glatt und ein Ausfall wird unsichtbar: daher generate_series + LEFT JOIN.
  const verlauf = await sqlPool`
    SELECT reihe.tag::date AS tag,
           COALESCE(z.anzahl, 0)::int AS anzahl,
           ROUND(COALESCE(z.summe, 0) * 100) AS cents
    FROM generate_series(${heute}::date - 13, ${heute}::date, INTERVAL '1 day') AS reihe(tag)
    LEFT JOIN (
      SELECT (completed_at AT TIME ZONE 'Europe/Berlin')::date AS tag,
             COUNT(*) AS anzahl, SUM(amount_due) AS summe
      FROM fiaon_applications
      WHERE payment_status = 'paid' AND NOT COALESCE(alt_bestand, FALSE)
        AND merged_into IS NULL AND completed_at IS NOT NULL
        AND (completed_at AT TIME ZONE 'Europe/Berlin')::date >= ${heute}::date - 13
      GROUP BY 1
    ) z ON z.tag = reihe.tag::date
    ORDER BY reihe.tag
  `;

  // 2) Provisionen je Agent — Rangliste nach Monat. Testkonten bleiben draussen,
  //    stornierte Provisionen zählen nicht. `own` = Eigenabschluss (die Zahl, die
  //    Leistung zeigt), `override` = Anteil aus dem Team darunter.
  const agenten = await sqlPool`
    SELECT a.id, a.name, a.avatar,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE (c.created_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date), 0)::bigint AS heute_cents,
      COALESCE(SUM(c.amount_cents) FILTER (WHERE (c.created_at AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date), 0)::bigint AS monat_cents,
      COALESCE(SUM(c.amount_cents), 0)::bigint AS gesamt_cents,
      COUNT(c.id) FILTER (WHERE c.kind = 'own' AND (c.created_at AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date)::int AS abschluesse_monat,
      COUNT(c.id) FILTER (WHERE c.kind = 'own')::int AS abschluesse_gesamt
    FROM fiaon_agents a
    LEFT JOIN fiaon_commissions c ON c.agent_id = a.id AND c.status <> 'storniert'
    WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
    GROUP BY a.id, a.name, a.avatar
    ORDER BY monat_cents DESC, gesamt_cents DESC
  `;

  // 3) Angekündigte Zahlungen des Kunden („Ich habe überwiesen") — heute und
  //    insgesamt. `alt` = älter als 7 Tage: das ist der Stapel, in dem
  //    unerkannter Umsatz liegt.
  const [ankuendigung] = await sqlPool`
    SELECT
      COUNT(*)::int AS gesamt_anzahl,
      ROUND(COALESCE(SUM(amount_due), 0) * 100) AS gesamt_cents,
      COUNT(*) FILTER (WHERE (claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS heute_anzahl,
      ROUND(COALESCE(SUM(amount_due) FILTER (WHERE (claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date), 0) * 100) AS heute_cents,
      COUNT(*) FILTER (WHERE claimed_paid_at < NOW() - INTERVAL '7 days')::int AS alt_anzahl,
      ROUND(COALESCE(SUM(amount_due) FILTER (WHERE claimed_paid_at < NOW() - INTERVAL '7 days'), 0) * 100) AS alt_cents
    FROM fiaon_applications
    WHERE payment_status = 'claimed_paid' AND merged_into IS NULL
  `;

  // 4) Zahlungszusagen, die der Agent aufgenommen hat („Kunde zahlt am …").
  //    DISTINCT ON (ref): pro Kunde zählt nur die JÜNGSTE Zusage, sonst würde ein
  //    dreimal verschobener Termin dreifach in der Statistik stehen. Bereits
  //    bezahlte oder stornierte Bestellungen fallen heraus — eine erfüllte Zusage
  //    ist keine offene Aufgabe.
  const zusagen = await sqlPool`
    WITH neueste AS (
      SELECT DISTINCT ON (l.ref) l.ref, l.agent_id, l.agent_name, l.promised_date
      FROM fiaon_contact_log l
      WHERE l.promised_date IS NOT NULL AND l.voided_at IS NULL
      ORDER BY l.ref, l.promised_date DESC, l.id DESC
    )
    SELECT COALESCE(ag.name, n.agent_name, 'Ohne Agent') AS name, n.agent_id,
      COUNT(*)::int AS gesamt,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS heute_faellig,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date > ${heute}::date)::int AS kuenftig,
      COUNT(*) FILTER (WHERE (n.promised_date AT TIME ZONE 'Europe/Berlin')::date < ${heute}::date)::int AS ueberfaellig,
      ROUND(COALESCE(SUM(app.amount_due), 0) * 100) AS summe_cents
    FROM neueste n
    JOIN fiaon_applications app ON app.ref = n.ref
      AND app.merged_into IS NULL
      AND app.payment_status NOT IN ('paid', 'cancelled', 'refunded')
    LEFT JOIN fiaon_agents ag ON ag.id = n.agent_id
    GROUP BY COALESCE(ag.name, n.agent_name, 'Ohne Agent'), n.agent_id
    ORDER BY gesamt DESC
  `;

  const summe = (feld: string) => zusagen.reduce((s: number, z: any) => s + Number(z[feld] || 0), 0);
  const zahl = (v: any) => Number(v || 0);

  // 5) Abo — der laufende Umsatz. Ohne diesen Block zeigt das Dashboard nur das
  //    Neugeschäft und verschweigt, was monatlich wiederkommt.
  let abo: any = null;
  try {
    const { aboUebersicht } = await import("./fiaon-abo");
    abo = await aboUebersicht();
  } catch (err) {
    console.error("[FIAON-HUB] abo:", err);
  }

  return {
    umsatz: {
      heute: { anzahl: zahl(umsatz.heute_anzahl), cents: zahl(umsatz.heute_cents) },
      gestern: { anzahl: zahl(umsatz.gestern_anzahl), cents: zahl(umsatz.gestern_cents) },
      monat: { anzahl: zahl(umsatz.monat_anzahl), cents: zahl(umsatz.monat_cents) },
      gesamt: { anzahl: zahl(umsatz.gesamt_anzahl), cents: zahl(umsatz.gesamt_cents) },
      verlauf: verlauf.map((v: any) => ({
        tag: typeof v.tag === "string" ? v.tag : new Date(v.tag).toISOString().slice(0, 10),
        anzahl: zahl(v.anzahl), cents: zahl(v.cents),
      })),
    },
    // Team-Provision: was vom Umsatz an die Agenten geht. Netto = Umsatz − Provision.
    provision: {
      heuteCents: agenten.reduce((s: number, a: any) => s + zahl(a.heute_cents), 0),
      monatCents: agenten.reduce((s: number, a: any) => s + zahl(a.monat_cents), 0),
      gesamtCents: agenten.reduce((s: number, a: any) => s + zahl(a.gesamt_cents), 0),
    },
    agenten: agenten.map((a: any) => {
      const z = zusagen.find((z: any) => Number(z.agent_id) === Number(a.id));
      return {
        id: Number(a.id), name: a.name, avatar: a.avatar || null,
        heuteCents: zahl(a.heute_cents), monatCents: zahl(a.monat_cents), gesamtCents: zahl(a.gesamt_cents),
        abschluesseMonat: zahl(a.abschluesse_monat), abschluesseGesamt: zahl(a.abschluesse_gesamt),
        zusagen: z ? { gesamt: zahl(z.gesamt), heuteFaellig: zahl(z.heute_faellig), kuenftig: zahl(z.kuenftig), ueberfaellig: zahl(z.ueberfaellig), summeCents: zahl(z.summe_cents) } : null,
      };
    }),
    ankuendigungen: {
      heute: { anzahl: zahl(ankuendigung.heute_anzahl), cents: zahl(ankuendigung.heute_cents) },
      gesamt: { anzahl: zahl(ankuendigung.gesamt_anzahl), cents: zahl(ankuendigung.gesamt_cents) },
      alt: { anzahl: zahl(ankuendigung.alt_anzahl), cents: zahl(ankuendigung.alt_cents) },
    },
    zusagen: {
      gesamt: summe("gesamt"), heuteFaellig: summe("heute_faellig"),
      kuenftig: summe("kuenftig"), ueberfaellig: summe("ueberfaellig"),
      summeCents: summe("summe_cents"),
      jeAgent: zusagen.map((z: any) => ({
        name: z.name, agentId: z.agent_id != null ? Number(z.agent_id) : null,
        gesamt: zahl(z.gesamt), heuteFaellig: zahl(z.heute_faellig),
        kuenftig: zahl(z.kuenftig), ueberfaellig: zahl(z.ueberfaellig), summeCents: zahl(z.summe_cents),
      })),
    },
    abo,
    at: new Date().toISOString(),
  };
}

router.get("/admin/hub/lage", async (_req, res) => {
  try {
    if (lageCache && Date.now() - lageCache.at < LAGE_CACHE_MS) {
      return res.json({ ok: true, cached: true, ...lageCache.data });
    }
    const data = await computeLage();
    lageCache = { at: Date.now(), data };
    res.json({ ok: true, cached: false, ...data });
  } catch (err) {
    console.error("[FIAON-HUB] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Wer steckt hinter der Zahl? ──────────────────────────────────────────────
// Eine Kennzahl ohne Namen ist nicht handlungsfähig: „11 heute angekündigt" sagt
// nicht, wen man anrufen soll. Dieser Endpoint liefert zu jeder Kachel des
// Dashboards die dazugehörigen Menschen — mit Betrag, Agent, Alter und der
// Referenz, über die die Akte erreichbar ist (/admin/kunde/<ref>).
//
// Absichtlich NUR LESEND. Freischalten/Verbuchen bleibt in der Zahlungszentrale
// bzw. im Kontoabgleich: ein zweiter Buchungspfad würde die Prüfungen dort
// umgehen, und Geld verträgt keine zwei Wahrheiten.
export type LagenListe =
  | "angekuendigt-heute" | "angekuendigt-alle" | "angekuendigt-alt"
  | "zusagen-heute" | "zusagen-ueberfaellig" | "zusagen-alle"
  | "bezahlt-heute" | "bezahlt-monat" | "bezahlt-alle"
  // Zahlungszentrale: die Kennzahlen dort führen in dieselben Listen.
  | "offen-alle" | "offen-ohne-reaktion" | "abgelaufen"
  | "erinnert-heute"
  // Abo: die monatliche Paketrate (fiaon_abo_raten).
  | "abo-heute" | "abo-woche" | "abo-ueberfaellig" | "abo-bezahlt-monat";

/** Anzeigename einer Antragszeile — Firma vor Person, Referenz als letzter Halt. */
const NAME_SQL = `COALESCE(
  NULLIF(TRIM(a.company_name), ''),
  NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
  NULLIF(TRIM(a.contact_name), ''),
  a.ref
)`;
const MAIL_SQL = `COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''), NULLIF(TRIM(a.billing_email),''))`;
/** Paketnamen enthalten Zeilenumbrüche („FIAON Ultra\n(Elite Konto)") — in einer
 *  Listenzeile zerreißt das das Layout. Deshalb hier auf eine Zeile bringen. */
const PAKET_SQL = `NULLIF(TRIM(regexp_replace(COALESCE(a.pack_name,''), '\\s+', ' ', 'g')), '')`;
const TEL_SQL = `NULLIF(TRIM(CONCAT(COALESCE(a.phone_country_code,''), COALESCE(a.phone,''))), '')`;

router.get("/admin/hub/liste", async (req, res) => {
  try {
    const art = String(req.query.art || "") as LagenListe;
    const heute = berlinToday();
    // 500 ist die Obergrenze aus Vernunft: mehr kann man in einem Fenster nicht
    // sinnvoll durchsehen, und der Browser soll nicht an einer Liste ersticken.
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 300));

    let rows: any[] = [];

    if (art.startsWith("angekuendigt")) {
      // Ältester zuerst: wer am längsten wartet, ist der dringendste Fall.
      const nurHeute = art === "angekuendigt-heute";
      const nurAlt = art === "angekuendigt-alt";
      rows = await sqlPool.unsafe(`
        SELECT a.ref, a.payment_reference, ${NAME_SQL} AS name, ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               a.amount_due, ${PAKET_SQL} AS paket, a.claimed_paid_at AS datum,
               ag.name AS agent_name,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - a.claimed_paid_at)) / 86400)::int AS tage_alt
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE a.payment_status = 'claimed_paid' AND a.merged_into IS NULL
          ${nurHeute ? `AND (a.claimed_paid_at AT TIME ZONE 'Europe/Berlin')::date = $1::date` : ""}
          ${nurAlt ? `AND a.claimed_paid_at < NOW() - INTERVAL '7 days'` : ""}
        ORDER BY a.claimed_paid_at ASC NULLS LAST
        LIMIT ${limit}
      `, nurHeute ? [heute] : []);
    } else if (art.startsWith("zusagen")) {
      // Wie in computeLage: pro Kunde nur die jüngste Zusage, erfüllte fallen raus.
      const filter = art === "zusagen-heute"
        ? `AND (n.promised_date AT TIME ZONE 'Europe/Berlin')::date = $1::date`
        : art === "zusagen-ueberfaellig"
          ? `AND (n.promised_date AT TIME ZONE 'Europe/Berlin')::date < $1::date`
          : "";
      rows = await sqlPool.unsafe(`
        WITH neueste AS (
          SELECT DISTINCT ON (l.ref) l.ref, l.agent_id, l.agent_name, l.promised_date, l.note
          FROM fiaon_contact_log l
          WHERE l.promised_date IS NOT NULL AND l.voided_at IS NULL
          ORDER BY l.ref, l.promised_date DESC, l.id DESC
        )
        SELECT a.ref, a.payment_reference, ${NAME_SQL} AS name, ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               a.amount_due, ${PAKET_SQL} AS paket, n.promised_date AS datum, n.note,
               COALESCE(ag.name, n.agent_name) AS agent_name,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - n.promised_date)) / 86400)::int AS tage_alt,
               a.payment_status
        FROM neueste n
        JOIN fiaon_applications a ON a.ref = n.ref
          AND a.merged_into IS NULL
          AND a.payment_status NOT IN ('paid', 'cancelled', 'refunded')
        LEFT JOIN fiaon_agents ag ON ag.id = n.agent_id
        WHERE TRUE ${filter}
        ORDER BY n.promised_date ASC
        LIMIT ${limit}
      `, filter ? [heute] : []);
    } else if (art.startsWith("bezahlt")) {
      const zeitraum = art === "bezahlt-heute"
        ? `AND (a.completed_at AT TIME ZONE 'Europe/Berlin')::date = $1::date`
        : art === "bezahlt-monat"
          ? `AND (a.completed_at AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', $1::date)::date`
          : "";
      // Parameter nur mitgeben, wenn der Zeitraum-Filter ihn wirklich benutzt:
      // bei „alle" fällt der Filter weg, und ein übergebener, nie referenzierter
      // Platzhalter lässt Postgres mit „could not determine data type of
      // parameter $1" abbrechen.
      rows = await sqlPool.unsafe(`
        SELECT a.ref, a.payment_reference, ${NAME_SQL} AS name, ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               a.amount_due, ${PAKET_SQL} AS paket, a.completed_at AS datum,
               ag.name AS agent_name, 0 AS tage_alt
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE)
          AND a.merged_into IS NULL AND a.completed_at IS NOT NULL
          ${zeitraum}
        ORDER BY a.completed_at DESC
        LIMIT ${limit}
      `, zeitraum ? [heute] : []);
    } else if (art === "offen-alle" || art === "offen-ohne-reaktion" || art === "abgelaufen") {
      // Offen = Bestellung liegt, Kunde hat sich nicht gemeldet. „ohne Reaktion"
      // grenzt auf die ein, bei denen auch keine Zusage im Gespräch steht —
      // das sind die wirklich stillen Fälle.
      const status = art === "abgelaufen" ? "'expired'" : "'pending_payment'";
      const stille = art === "offen-ohne-reaktion"
        ? `AND NOT EXISTS (
             SELECT 1 FROM fiaon_contact_log l
             WHERE l.ref = a.ref AND l.voided_at IS NULL AND l.promised_date IS NOT NULL
           )`
        : "";
      // Bewusst OHNE Parameter: diese Abfrage braucht das heutige Datum nicht.
      // Ein übergebener, aber nirgends benutzter Platzhalter lässt Postgres mit
      // „could not determine data type of parameter $1" abbrechen — derselbe
      // Fehler, der die Kartei-Abfragen schon einmal lahmgelegt hat.
      rows = await sqlPool.unsafe(`
        SELECT a.ref, a.payment_reference, ${NAME_SQL} AS name, ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               a.amount_due, ${PAKET_SQL} AS paket, a.created_at AS datum, a.payment_status,
               ag.name AS agent_name,
               FLOOR(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 86400)::int AS tage_alt
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE a.payment_status IN (${status}) AND a.merged_into IS NULL
          AND NOT COALESCE(a.ist_entwurf, FALSE)
          ${stille}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `);
    } else if (art.startsWith("abo-")) {
      // Abo-Raten in derselben Form wie alle anderen Listen, damit das
      // Detailfenster im Dashboard ohne Sonderfall damit umgehen kann.
      const wo =
        art === "abo-heute" ? `r.status = 'offen' AND r.faellig_am = $1::date`
        : art === "abo-woche" ? `r.status = 'offen' AND r.faellig_am >= $1::date AND r.faellig_am <= $1::date + 7`
        : art === "abo-ueberfaellig" ? `r.status = 'offen' AND r.faellig_am < $1::date`
        : `r.status = 'bezahlt' AND r.rate_nr > 1 AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', $1::date)::date`;
      const sortierung = art === "abo-bezahlt-monat" ? "r.bezahlt_am DESC NULLS LAST" : "r.faellig_am ASC";
      rows = await sqlPool.unsafe(`
        SELECT a.ref, r.zahlungsreferenz AS payment_reference, ${NAME_SQL} AS name,
               ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               (r.betrag_cents / 100.0) AS amount_due, ${PAKET_SQL} AS paket,
               COALESCE(r.bezahlt_am, r.faellig_am::timestamptz) AS datum,
               ag.name AS agent_name,
               NULLIF(($1::date - r.faellig_am), 0) AS tage_alt,
               ('Rate ' || r.rate_nr || (CASE WHEN r.mahnstufe > 0 THEN ' · Mahnstufe ' || r.mahnstufe ELSE '' END)) AS note,
               a.payment_status
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE ${wo}
        ORDER BY ${sortierung}
        LIMIT ${limit}
      `, [heute]);
    } else if (art === "erinnert-heute") {
      // Wer hat heute eine Zahlungserinnerung bekommen? Beantwortet die Frage
      // „175 versendet — an wen?", die man sonst nur im Make-Protokoll sieht.
      rows = await sqlPool.unsafe(`
        SELECT a.ref, a.payment_reference, ${NAME_SQL} AS name, ${MAIL_SQL} AS email, ${TEL_SQL} AS telefon,
               a.amount_due, ${PAKET_SQL} AS paket, a.last_reminder_at AS datum, a.payment_status,
               ag.name AS agent_name, NULL::int AS tage_alt, a.reminder_count AS erinnerungen
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        WHERE a.merged_into IS NULL AND a.last_reminder_at IS NOT NULL
          AND (a.last_reminder_at AT TIME ZONE 'Europe/Berlin')::date = $1::date
        ORDER BY a.last_reminder_at DESC
        LIMIT ${limit}
      `, [heute]);
    } else {
      return res.status(400).json({ ok: false, error: "Unbekannte Liste" });
    }

    const eintraege = rows.map((r: any) => ({
      ref: r.ref,
      zahlungsreferenz: r.payment_reference || null,
      name: r.name,
      email: r.email || null,
      telefon: r.telefon || null,
      betragCents: r.amount_due != null ? Math.round(Number(r.amount_due) * 100) : null,
      paket: r.paket || null,
      datum: r.datum || null,
      tageAlt: r.tage_alt != null ? Number(r.tage_alt) : null,
      agent: r.agent_name || null,
      notiz: r.note || null,
      status: r.payment_status || null,
      // Wie oft wurde schon erinnert? Nur bei der Erinnerungsliste gesetzt.
      erinnerungen: r.erinnerungen != null ? Number(r.erinnerungen) : null,
      akte: `/admin/kunde/${encodeURIComponent(r.ref)}`,
    }));

    res.json({
      ok: true, art, anzahl: eintraege.length,
      summeCents: eintraege.reduce((s, e) => s + (e.betragCents || 0), 0),
      eintraege,
    });
  } catch (err) {
    console.error("[FIAON-HUB] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rangliste für einen Zeitraum (Grundlage des Teilen-Bildes) ────────────────
// Gezählt wird der ABSCHLUSS (kind='own'), nicht der Betrag: In einer
// Vertriebsgruppe motiviert „4 Abschlüsse" mehr als eine Provisionssumme — und
// Gehälter gehören nicht in eine Gruppenkonversation.
//
// Zeitraum immer nach Berliner Tagesgrenze:
//   tag   = heute
//   woche = Montag dieser Woche bis heute
//   monat = 1. des Monats bis heute
router.get("/admin/hub/rangliste", async (req, res) => {
  try {
    const zeitraum = String(req.query.zeitraum || "tag");
    const heute = berlinToday();
    const von = zeitraum === "woche"
      ? `date_trunc('week', ${"$1"}::date)::date`
      : zeitraum === "monat"
        ? `date_trunc('month', ${"$1"}::date)::date`
        : `${"$1"}::date`;

    const rows = await sqlPool.unsafe(`
      SELECT a.id, a.name,
        COUNT(c.id) FILTER (WHERE c.kind = 'own')::int AS abschluesse,
        COUNT(c.id)::int AS buchungen,
        COALESCE(SUM(c.amount_cents), 0)::bigint AS provision_cents,
        COALESCE(SUM(c.base_amount_cents) FILTER (WHERE c.kind = 'own'), 0)::bigint AS umsatz_cents
      FROM fiaon_agents a
      LEFT JOIN fiaon_commissions c
        ON c.agent_id = a.id AND c.status <> 'storniert'
        AND (c.created_at AT TIME ZONE 'Europe/Berlin')::date >= ${von}
        AND (c.created_at AT TIME ZONE 'Europe/Berlin')::date <= $1::date
      WHERE a.active AND COALESCE(a.is_test_account, FALSE) = FALSE
      GROUP BY a.id, a.name
      ORDER BY abschluesse DESC, provision_cents DESC, a.name ASC
    `, [heute]);

    const [grenze] = await sqlPool.unsafe(`SELECT ${von} AS von`, [heute]);
    const vonDatum = grenze.von instanceof Date
      ? grenze.von.toISOString().slice(0, 10)
      : String(grenze.von).slice(0, 10);

    res.json({
      ok: true, zeitraum, von: vonDatum, bis: heute,
      agenten: rows.map((r: any) => ({
        id: Number(r.id), name: r.name,
        abschluesse: Number(r.abschluesse),
        buchungen: Number(r.buchungen),
        provisionCents: Number(r.provision_cents),
        umsatzCents: Number(r.umsatz_cents),
      })),
    });
  } catch (err) {
    console.error("[FIAON-HUB] rangliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── O3: Globale Schnellsuche (Cmd+K) ─────────────────────────────────────────
// Kunden: Name / E-Mail / Referenz / Zahlungsreferenz / Telefon. Leads: Name /
// E-Mail / Telefon. Agents: Name / E-Mail. (Kunden-IBANs existieren nicht —
// Kunden zahlen an UNS; Agent-IBANs sind verschlüsselt, bewusst nicht suchbar.)
// PROMPT 1/2: Jeder Treffer öffnet DIE AKTE (/admin/kunde/…) — keine Sackgassen,
// kein „nur Rechnung" mehr (ersetzt den kaputten Suchtreffer der Zahlungszentrale).
router.get("/admin/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ ok: true, results: [] });
    const like = `%${q}%`;
    const qDigits = q.replace(/\D/g, "");
    const digitsLike = qDigits.length >= 5 ? `%${qDigits}%` : null;
    const customers = await sqlPool`
      SELECT ref, payment_reference, payment_status, amount_due,
             first_name, last_name, contact_name, company_name, email, contact_email,
             archived_at
      FROM fiaon_applications a
      WHERE merged_into IS NULL
        -- Eine Bestellung, deren Person in einer anderen aufgegangen ist, darf
        -- hier nicht mehr auftauchen: Sonst öffnet die Suche die Akte des
        -- Wegweisers statt die des Kunden.
        AND NOT EXISTS (
          SELECT 1 FROM fiaon_persons mp
          WHERE mp.id = a.person_id AND mp.merged_into_person_id IS NOT NULL
        )
        AND (
        ref ILIKE ${like} OR payment_reference ILIKE ${like}
        OR first_name ILIKE ${like} OR last_name ILIKE ${like}
        OR company_name ILIKE ${like} OR contact_name ILIKE ${like}
        OR email ILIKE ${like} OR contact_email ILIKE ${like}
        OR phone ILIKE ${like}
        OR (${digitsLike}::text IS NOT NULL AND regexp_replace(COALESCE(phone_country_code,'') || COALESCE(phone,'') , '\\D', '', 'g') LIKE ${digitsLike})
        OR (first_name || ' ' || last_name) ILIKE ${like}
        -- Frühere Angaben: Wer nach der alten E-Mail eines zusammengeführten
        -- Kunden sucht, findet ihn weiterhin.
        OR EXISTS (
          SELECT 1 FROM fiaon_person_aliases al
          WHERE al.person_id = a.person_id
            AND (al.value_norm ILIKE ${like} OR COALESCE(al.value_raw,'') ILIKE ${like}
                 OR COALESCE(al.feld_wert,'') ILIKE ${like})
        )
      )
      ORDER BY (archived_at IS NOT NULL), updated_at DESC NULLS LAST
      LIMIT 8
    `;
    // Leads (nicht konvertierte) — konvertierte laufen über die Antrags-Akte
    const leads = await sqlPool`
      SELECT id, vorname, nachname, email, telefon, status, quelle
      FROM fiaon_leads
      WHERE converted_order_id IS NULL AND (
        vorname ILIKE ${like} OR nachname ILIKE ${like}
        OR (COALESCE(vorname,'') || ' ' || COALESCE(nachname,'')) ILIKE ${like}
        OR email ILIKE ${like}
        OR (${digitsLike}::text IS NOT NULL AND regexp_replace(COALESCE(telefon,''), '\\D', '', 'g') LIKE ${digitsLike})
      )
      ORDER BY erstellt_am DESC
      LIMIT 6
    `.catch(() => [] as any);
    const agents = await sqlPool`
      SELECT id, name, email FROM fiaon_agents
      WHERE name ILIKE ${like} OR email ILIKE ${like}
      LIMIT 4
    `.catch(() => [] as any);

    const results = [
      ...customers.map((c: any) => ({
        type: "kunde",
        label: c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || c.ref,
        sub: `${c.payment_reference || c.ref}${c.email || c.contact_email ? ` · ${c.email || c.contact_email}` : ""}`
          + (c.archived_at ? " · archiviert" : ""),
        status: c.payment_status,
        url: `/admin/kunde/${encodeURIComponent(c.ref)}`,
      })),
      ...leads.map((l: any) => ({
        type: "lead",
        label: [l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`,
        sub: `Lead · ${l.quelle || "—"}${l.email ? ` · ${l.email}` : ""}`,
        status: l.status,
        url: `/admin/kunde/lead-${l.id}`,
      })),
      ...agents.map((a: any) => ({
        type: "agent",
        label: a.name,
        sub: a.email,
        status: null,
        url: `/admin/team`,
      })),
    ];
    res.json({ ok: true, results });
  } catch (err) {
    console.error("[FIAON-HUB] search:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechnungs-Übersicht ──────────────────────────────────────────────────────
router.get("/admin/invoices", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;
    const rows = q.length >= 2
      ? await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
            AND (invoice_number ILIKE ${like} OR payment_reference ILIKE ${like} OR ref ILIKE ${like}
                 OR first_name ILIKE ${like} OR last_name ILIKE ${like} OR company_name ILIKE ${like}
                 OR email ILIKE ${like} OR contact_email ILIKE ${like})
          ORDER BY invoice_number DESC
          LIMIT 200
        `
      : await sqlPool`
          SELECT ref, payment_reference, invoice_number, invoice_date, amount_due, payment_status,
                 first_name, last_name, contact_name, company_name, email, contact_email
          FROM fiaon_applications
          WHERE invoice_number IS NOT NULL AND merged_into IS NULL
          ORDER BY invoice_number DESC
          LIMIT 200
        `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-HUB] invoices:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── System-Status (Diagnose, read-only) ──────────────────────────────────────
router.get("/admin/system-status", async (_req, res) => {
  try {
    const settings = await getSettings();
    let makeLastEvents: Record<string, string> = {};
    try {
      makeLastEvents = JSON.parse(settings.make_last_events || "{}");
    } catch {}
    res.json({
      ok: true,
      baseUrl: baseUrlDiagnostics(),
      makeWebhookConfigured: Boolean(process.env.MAKE_WEBHOOK_URL),
      makeLastEvents,
      invoiceVatMode: (process.env.INVOICE_VAT_MODE || "none").toLowerCase(),
      defaults: {
        commissionRateBp: Number(settings.default_commission_rate_bp),
        payoutMinCents: Number(settings.payout_min_cents),
      },
    });
  } catch (err) {
    console.error("[FIAON-HUB] system-status:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Verbuchungen / Finanzen: bestätigte Zahlungen eines Zeitraums ────────────
// Read-only. Zeigt je bestätigte Zahlung (payment_status='paid') den Umsatz,
// den zugewiesenen Agent und dessen eingefrorene Provision (fiaon_commissions).
// Netto = Umsatz − Provisionen (was bei uns bleibt). Alles in Integer-Cents.
// Zeitbezug ist der Bestätigungszeitpunkt completed_at, ausgewertet in
// Europe/Berlin (korrekte Tagesgrenzen). Zeitraum aus fester Whitelist.
const BOOKING_RANGES: Record<string, string> = {
  today: "bd = today",
  yesterday: "bd = today - 1",
  "7d": "bd >= today - 6",
  "30d": "bd >= today - 29",
  month: "date_trunc('month', bd) = date_trunc('month', today)",
};

router.get("/admin/bookings", async (req, res) => {
  try {
    const range = String(req.query.range || "today");
    const cond = BOOKING_RANGES[range] || BOOKING_RANGES.today;
    // Nur whitelisted Ausdrücke werden eingesetzt — keine Nutzereingabe im SQL.
    const rows = await sqlPool.unsafe(`
      WITH b AS (
        SELECT
          a.ref, a.payment_reference, a.invoice_number, a.pack_name, a.amount_due,
          a.completed_at, a.assigned_agent_id,
          a.first_name, a.last_name, a.contact_name, a.company_name,
          a.email, a.contact_email,
          ag.name AS agent_name,
          c.amount_cents AS commission_cents, c.rate_bp,
          (a.completed_at AT TIME ZONE 'Europe/Berlin')::date AS bd,
          (now() AT TIME ZONE 'Europe/Berlin')::date AS today
        FROM fiaon_applications a
        LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
        LEFT JOIN LATERAL (
          SELECT amount_cents, rate_bp
          FROM fiaon_commissions
          WHERE ref = a.ref AND amount_cents > 0 AND status <> 'storniert'
          ORDER BY id LIMIT 1
        ) c ON TRUE
        WHERE a.payment_status = 'paid'
          AND a.merged_into IS NULL
          AND a.completed_at IS NOT NULL
      )
      SELECT ref, payment_reference, invoice_number, pack_name, amount_due,
             completed_at, assigned_agent_id, agent_name, commission_cents, rate_bp,
             first_name, last_name, contact_name, company_name, email, contact_email
      FROM b
      WHERE ${cond}
      ORDER BY completed_at DESC
    `);

    const custName = (r: any): string =>
      r.company_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_name || r.ref;

    const bookings = rows.map((r: any) => {
      const revenueCents = Math.round(Number(r.amount_due || 0) * 100);
      const commissionCents = Number(r.commission_cents || 0);
      return {
        ref: r.ref,
        paymentReference: r.payment_reference,
        invoiceNumber: r.invoice_number,
        customer: custName(r),
        email: r.email || r.contact_email || null,
        packName: (r.pack_name || "").replace(/\n/g, " ").trim() || null,
        completedAt: r.completed_at,
        agentId: r.assigned_agent_id,
        agentName: r.agent_name,
        rateBp: r.rate_bp != null ? Number(r.rate_bp) : null,
        revenueCents,
        commissionCents,
        netCents: revenueCents - commissionCents,
      };
    });

    // Aggregat gesamt
    const totals = bookings.reduce(
      (acc, b) => {
        acc.count += 1;
        acc.revenueCents += b.revenueCents;
        acc.commissionCents += b.commissionCents;
        return acc;
      },
      { count: 0, revenueCents: 0, commissionCents: 0 },
    );
    const netCents = totals.revenueCents - totals.commissionCents;

    // Aufschlüsselung je Mitarbeiter (ohne Zuweisung = Direktgeschäft)
    const byAgentMap = new Map<string, any>();
    for (const b of bookings) {
      const key = b.agentId != null ? `a${b.agentId}` : "direct";
      let g = byAgentMap.get(key);
      if (!g) {
        g = {
          agentId: b.agentId ?? null,
          agentName: b.agentId != null ? b.agentName || `Agent #${b.agentId}` : "Direkt (ohne Agent)",
          count: 0,
          revenueCents: 0,
          commissionCents: 0,
        };
        byAgentMap.set(key, g);
      }
      g.count += 1;
      g.revenueCents += b.revenueCents;
      g.commissionCents += b.commissionCents;
    }
    const byAgent = Array.from(byAgentMap.values()).sort((a, b) => b.commissionCents - a.commissionCents);

    res.json({
      ok: true,
      range,
      totals: { ...totals, netCents },
      byAgent,
      bookings,
      vatMode: (process.env.INVOICE_VAT_MODE || "none").toLowerCase(),
    });
  } catch (err) {
    console.error("[FIAON-HUB] bookings:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET T: EVENT-TEST-KONSOLE ═══════════════
// Löst das Make-Struktur-Problem dauerhaft: Make lernt die Payload-Struktur
// eines Events nur beim ersten echten Empfang — über die Konsole lässt sich
// JEDES Registry-Event mit realistischen Beispielwerten (test: true) senden,
// ohne den kompletten Workflow auslösen zu müssen. sendMakeWebhook bleibt
// der einzige Versandweg. Verlauf: letzte 20 Sends in fiaon_settings.

const TEST_HISTORY_KEY = "make_test_history";
const TEST_HISTORY_MAX = 20;

async function recordTestSend(entry: { event: string; email: string; ok: boolean; mode: "test" | "real"; at: string }): Promise<void> {
  try {
    const settings = await getSettings();
    let history: any[] = [];
    try { history = JSON.parse(settings[TEST_HISTORY_KEY] || "[]"); } catch {}
    history.unshift(entry);
    await setSetting(TEST_HISTORY_KEY, JSON.stringify(history.slice(0, TEST_HISTORY_MAX)));
  } catch (err) {
    console.warn("[FIAON-EVENTS] Verlauf-Write fehlgeschlagen:", err instanceof Error ? err.message : err);
  }
}

function eventCustomerName(r: any): string {
  return r.company_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_name || r.ref;
}

/** Baut den ECHTEN Payload eines kundengebundenen Events aus einer Bestellzeile —
 *  identisch zu den produktiven Versandpfaden (fiaon-antrag.ts). */
function buildRealPayload(eventType: string, row: any): MakeWebhookPayload {
  const base = makePayloadFromRow(row);
  switch (eventType) {
    case "payment_details":
    case "claim_received":
      return { ...base, invoice_url: row.payment_reference ? signInvoiceUrl(row.payment_reference) : null };
    case "payment_reminder":
      return {
        ...base,
        invoice_url: row.payment_reference ? signInvoiceUrl(row.payment_reference) : null,
        reminder_number: Number(row.reminder_count || 0) + 1,
      };
    case "payment_confirmed":
      return { ...base, login_url: absoluteUrl("/login") };
    default: // welcome
      return base;
  }
}

// T1 + T3: Registry, Diagnose (letzter Versand je Event) und Test-Verlauf
router.get("/admin/events/registry", async (_req, res) => {
  try {
    const settings = await getSettings();
    let lastEvents: Record<string, string> = {};
    let history: any[] = [];
    try { lastEvents = JSON.parse(settings.make_last_events || "{}"); } catch {}
    try { history = JSON.parse(settings[TEST_HISTORY_KEY] || "[]"); } catch {}
    // ── DIE HEURISTIK IST WEG ────────────────────────────────────────────
    // Hier stand bis zum 09.08.2026:
    //     makeBranchReady: !/Vorgesetzten-TODO/i.test(e.description)
    // Also: Die Plattform prüfte, ob in UNSERER EIGENEN Beschreibung das Wort
    // „Vorgesetzten-TODO" steht — ein Notizzettel aus früheren Paketen — und
    // machte daraus die Anzeige „MAKE-ZWEIG FEHLT". 23 von 33 Beschreibungen
    // enthielten den String; in Wahrheit waren alle 21 Zweige aktiv. Die
    // Plattform hat den Vorgesetzten zu Unrecht beschuldigt.
    //
    // Ersetzt durch GEMESSENE Wahrheit: `verifikation` kommt aus
    // fiaon_mail_events und sagt nur dann „bestätigt", wenn ein Testversand
    // nachweislich bei Brevo angekommen ist (server/lib/fiaon-zustellung.ts).
    const { mailEvents, verifikationsText } = await import("../lib/fiaon-mail-events");
    const { brevoKonfiguriert, OHNE_SCHLUESSEL } = await import("../lib/fiaon-brevo");
    const events = (await mailEvents()).map((e) => ({
      ...e,
      verifikationsText: verifikationsText(e),
    }));
    res.json({
      ok: true,
      brevoKonfiguriert: brevoKonfiguriert(),
      brevoHinweis: brevoKonfiguriert() ? null : OHNE_SCHLUESSEL,
      events,
      makeWebhookConfigured: Boolean(process.env.MAKE_WEBHOOK_URL),
      lastEvents,
      history,
    });
  } catch (err) {
    console.error("[FIAON-EVENTS] registry:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// T2: Test-Versand — Beispiel-Payload (optional editiert), email ersetzt, test: true
router.post("/admin/events/test", async (req, res) => {
  try {
    const { eventType, email, payload } = req.body || {};
    const def = getEventDef(String(eventType || ""));
    if (!def) return res.status(400).json({ ok: false, error: "Unbekannter Event-Typ" });
    const to = String(email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return res.status(400).json({ ok: false, error: "Gültige Test-E-Mail-Adresse angeben" });
    if (!process.env.MAKE_WEBHOOK_URL) {
      return res.status(400).json({ ok: false, error: "MAKE_WEBHOOK_URL ist nicht gesetzt — Versand nicht möglich" });
    }
    const merged: MakeWebhookPayload = {
      ...def.example,
      ...(payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {}),
      email: to,
      test: true,
    } as MakeWebhookPayload;
    const at = new Date().toISOString();
    const sent = await sendMakeWebhook(def.type, merged);
    await recordTestSend({ event: def.type, email: to, ok: sent, mode: "test", at });
    res.json({ ok: true, sent, at });
  } catch (err) {
    console.error("[FIAON-EVENTS] test:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// T2: „Für echten Kunden senden“ — dryRun liefert Vorschau für den Bestätigungsdialog,
// der eigentliche Versand nutzt die ECHTEN Kundendaten (nur kundengebundene Events).
router.post("/admin/events/send-real", async (req, res) => {
  try {
    const { eventType, paymentRef, dryRun } = req.body || {};
    const def = getEventDef(String(eventType || ""));
    if (!def) return res.status(400).json({ ok: false, error: "Unbekannter Event-Typ" });
    if (!def.customerBound || def.deprecated) {
      return res.status(400).json({ ok: false, error: "Dieses Event ist nicht kundengebunden — nur Test-Versand möglich" });
    }
    if (def.recommendationOnly) {
      return res.status(400).json({ ok: false, error: "Dieses Event ist eine Empfehlung ohne Auto-Versand — nur Test-Versand an eine Test-Adresse möglich (erst Make-Zweig + Template anlegen)." });
    }
    const q = String(paymentRef || "").trim();
    if (q.length < 4) return res.status(400).json({ ok: false, error: "Referenz angeben (Zahlungsreferenz oder Antrags-Referenz)" });
    const rows = await sqlPool`
      SELECT ref, payment_reference, amount_due, first_name, last_name, contact_name, company_name,
             email, contact_email, billing_email, pack_name, payment_status, reminder_count
      FROM fiaon_applications
      WHERE (payment_reference = ${q} OR ref = ${q}) AND merged_into IS NULL
      LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kunde/Bestellung nicht gefunden" });
    const row = rows[0];
    const realPayload = buildRealPayload(def.type, row);
    if (!realPayload.email) return res.status(400).json({ ok: false, error: "Kunde hat keine E-Mail-Adresse hinterlegt" });

    if (dryRun) {
      return res.json({
        ok: true,
        preview: true,
        customer: eventCustomerName(row),
        email: realPayload.email,
        status: row.payment_status,
        payload: realPayload,
      });
    }

    if (!process.env.MAKE_WEBHOOK_URL) {
      return res.status(400).json({ ok: false, error: "MAKE_WEBHOOK_URL ist nicht gesetzt — Versand nicht möglich" });
    }
    // payment_reminder zählt kanalübergreifend als Erinnerung (20h-Dedupe, Paket V)
    if (def.type === "payment_reminder") {
      await sqlPool`
        UPDATE fiaon_applications SET last_reminder_at = NOW(), reminder_count = COALESCE(reminder_count, 0) + 1, updated_at = NOW()
        WHERE ref = ${row.ref}
      `;
    }
    const at = new Date().toISOString();
    const sent = await sendMakeWebhook(def.type, realPayload);
    await recordTestSend({ event: def.type, email: String(realPayload.email), ok: sent, mode: "real", at });
    res.json({ ok: true, sent, at, customer: eventCustomerName(row), email: realPayload.email });
  } catch (err) {
    console.error("[FIAON-EVENTS] send-real:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── P4-F: Changelog (read-only aus CHANGELOG.md — „Was ist neu?") ────────────
router.get("/admin/changelog", async (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "CHANGELOG.md");
    const content = await readFile(filePath, "utf-8").catch(() => null);
    res.json({ ok: true, content, exists: content != null });
  } catch (err) {
    console.error("[FIAON-HUB] changelog:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Rechtstexte-Review-Status (read-only Anzeige der Review-Datei) ───────────
router.get("/admin/legal-review", async (_req, res) => {
  try {
    const filePath = path.resolve(process.cwd(), "LEGAL_REVIEW_PACKAGE.md");
    const content = await readFile(filePath, "utf-8").catch(() => null);
    res.json({ ok: true, content, exists: content != null });
  } catch (err) {
    console.error("[FIAON-HUB] legal-review:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
