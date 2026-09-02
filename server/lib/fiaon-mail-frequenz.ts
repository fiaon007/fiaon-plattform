// ═══════════════════════════════════════════════════════════════════════════
// DIE FREQUENZBREMSE — ein Deckel je Empfänger, an der einen Tür (02.09.2026)
//
// ── DER BEFUND, AUS DEM DAS HIER ENTSTANDEN IST ───────────────────────────
// Gemessen am 01./02.09.2026 über 30 Tage:
//   · 18.641 `payment_reminder` an 1.227 Empfänger — Schnitt 15,2 je Person.
//   · 943 Menschen bekamen mehr als 10 Mails, 310 mehr als 20, Maximum 56.
//   · Über alle Ereignisse: 36.493 Mails an 5.095 Empfänger, Maximum 73.
//   · 205 Menschen standen 21 Tage ununterbrochen im Versand.
//   · Seit dem 28.08. bekommen 1.055 Menschen JEDEN TAG exakt zwei Mahnungen.
//
// ── DER SCHADEN, GEMESSEN ─────────────────────────────────────────────────
// Anteil blockiert+gebounct an allen Zeilen mit Rückmeldung, je Woche:
//   17.08. 9,5 %  →  24.08. 11,9 %  →  31.08. 15,7 %
// Gegenläufig das Engagement (geöffnet+geklickt): 36,6 % → 29,8 % → 23,3 %.
// Gmail stellt 8.182 von 13.599 Rückmeldungen und blockt 11,2 % → 12,3 % →
// 16,9 %. Gmail bewertet Absender DOMAINWEIT, nicht je Mailtyp — eine
// Mahnwelle beschädigt damit auch Zugangsdaten, Termine und Rechnungen.
//
// ── UND SIE BRINGEN NICHTS ────────────────────────────────────────────────
// Von 37 Zahlern mit vorangegangenen Mahnungen zahlten 35 nach Mahnung 1–3,
// einer nach 4–5, einer nach 6–10 und NULL nach mehr als zehn. Kohorten:
// 1–5 Mahnungen → 21,5 % zahlten · 6–10 → 3,4 % · 11–15 → 0,3 % · 16+ → 0,0 %.
// Die 18.218 Mails an die 6+-Gruppen erzeugten zusammen FÜNF Zahlungen.
// Klickrate nach laufender Nummer: Mail 1–3: 2,92 % · 4–5: 1,89 % · 6–10:
// 1,41 % · 21–25: 0,00 %. Blockquote im selben Schritt: 6,6 % → 10,4 % →
// 15,0 % → 33,3 %. Der Wendepunkt liegt zwischen Mail 3 und Mail 6.
//
// ── WARUM DIE BREMSE HIER STEHT UND NICHT IN DEN LÄUFEN ───────────────────
// Es gibt mehr als einen Auslöserpfad: der Mahn-Takt, der Massenversand
// (`/admin/payments/bulk-reminder/start`, der `maxReminders: null` setzt und
// damit JEDEN Deckel aushebelt) und einzelne Handversände. Gemessen: Ein
// Empfänger mit nur ZWEI Anträgen bekam trotz 20-Stunden-Sperre 3–4 Mails am
// Tag. Wer jeden dieser Pfade einzeln absichert, vergisst beim nächsten Umbau
// einen. Deshalb hängt der Deckel an `sendMakeWebhookMitGrund` — der einen
// Tür, durch die jeder Versand muss.
//
// ── WAS NIEMALS GEBREMST WIRD ─────────────────────────────────────────────
// Pflichtmails. Wer bezahlt hat, MUSS seine Zugangsdaten bekommen; wer einen
// Termin bucht, MUSS die Bestätigung bekommen. Eine Bremse, die das
// verhindert, richtet mehr Schaden an als die Flut. Die Liste steht unten und
// ist bewusst kurz: Alles, was eine unmittelbare Handlung des Menschen
// beantwortet, läuft durch.
//
// Der Postmeister (server/routes/fiaon-postmeister.ts) hängt sich über
// `darfAnEmpfaenger` ebenfalls davor — Absprache mit fiaon-8e vom 02.09.2026.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

/**
 * Pflichtmails: Antworten auf eine Handlung des Menschen. Diese laufen IMMER
 * durch — kein Tagesdeckel, keine Wochengrenze. Wer hier etwas hinzufügt,
 * muss sich fragen: Hat der Empfänger unmittelbar davor selbst etwas getan?
 * Wenn nein, gehört es nicht auf diese Liste.
 */
export const PFLICHTMAILS = new Set<string>([
  "payment_confirmed",       // Zahlung da → Zugang. Ohne das ist das Geld weg und die Tür zu.
  "account_activated",
  "welcome",                 // Antwort auf den abgeschickten Antrag.
  "payment_details",         // Die Zahlungsdaten zum eben abgeschlossenen Antrag.
  "bankverbindung_neu",      // 02.09.2026: Kontowechsel — wer die alte IBAN hat, MUSS die neue bekommen.
  "termin_bestaetigung",
  "termin_erinnerung",
  "termin_absage",
  "claim_received",          // „Wir prüfen Ihre Zahlung" — Antwort auf seine Meldung.
  "payment_cancelled",       // Statuswechsel an SEINER Bestellung.
  "payment_reactivated",
  "schufa_requested",        // Er hat die Auskunft bestellt und bezahlt.
  "schufa_approved",
  "schufa_rejected",
  "gdpr_deleted",
  "account_suspended",
  "documents_change_request",
  "commission_statement_issued",
  // Betriebsmeldungen an die Hausleitung, nie an Kunden — dürfen nie stocken.
  "kritisch", "warnung", "info",
]);

// ── GEPRÜFT GEGEN DIE ECHTEN EREIGNISNAMEN (02.09.2026) ───────────────────
// Der erste Entwurf dieser Liste enthielt vier Namen, die es nicht gibt
// (`termin_abgesagt`, `termin_verschoben`, `kunde_passwort_reset`,
// `kunde_zugang_link`). Eine Pflichtmail unter falschem Namen steht NICHT auf
// der Liste und wäre gebremst worden — bei Terminabsagen also genau dann,
// wenn es darauf ankommt. Wer hier etwas hinzufügt, gleicht vorher gegen
// `MakeEventType` in server/make-webhook.ts ab.

/** Ereignisse an MITARBEITER, nicht an Kunden — eigener Kanal, eigene Regeln. */
const TEAM_PRAEFIX = ["agent_", "aufgabe_", "team_", "chef_", "contract_"];

export interface FrequenzUrteil {
  ok: boolean;
  /** Klartext für das Protokoll. Null, wenn erlaubt. */
  grund: string | null;
  /** Nur zur Anzeige im Leitstand: was den Ausschlag gab. */
  zaehler?: { heute: number; woche: number; monat: number };
}

/** Eine Zahl aus fiaon_settings mit Standardwert. */
async function zahl(schluessel: string, standard: number): Promise<number> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    if (r?.value === undefined || r?.value === null || String(r.value).trim() === "") return standard;
    const n = Number(String(r.value).trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : standard;
  } catch {
    return standard;
  }
}

/** Ab wann der Zähler zählt: der Tag, an dem die Bremse scharf ging. Verstellbar. */
async function stichtagLesen(): Promise<string> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'frequenz_stichtag' LIMIT 1`) as any[];
    const v = String(r?.value ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T00:00:00+02:00` : "2026-09-02T00:00:00+02:00";
  } catch {
    return "2026-09-02T00:00:00+02:00";
  }
}

/**
 * Die Standardwerte sind aus der Messung abgeleitet, nicht geraten:
 * Der Ertrag der Mahnstrecke fällt vollständig in die ersten drei Mails, und
 * ab Mail 6 verdoppelt sich die Blockquote. Ein Deckel von 2 am Tag / 4 in der
 * Woche / 8 im Monat lässt jede sinnvolle Strecke zu (auch Justins
 * Zwei-Tage-Takt für die Lastschrift = 3,5 je Woche) und schneidet genau den
 * ertraglosen Teil ab.
 */
const STANDARD = { tag: 2, woche: 4, monat: 8 };

/**
 * Darf an diesen Empfänger gerade eine Mail dieses Ereignisses raus?
 *
 * Wirft nie. Im Zweifel — Datenbank nicht erreichbar, Ereignis unbekannt —
 * lautet die Antwort JA: Eine Bremse, die bei einer Störung den gesamten
 * Mailverkehr anhält, ist schlimmer als das Problem, das sie löst.
 */
export async function darfAnEmpfaenger(email: string, event: string): Promise<FrequenzUrteil> {
  const adresse = String(email || "").trim().toLowerCase();
  if (!adresse) return { ok: true, grund: null };

  // Pflichtmails und Team-Post laufen ohne Prüfung durch.
  if (PFLICHTMAILS.has(event)) return { ok: true, grund: null };
  if (TEAM_PRAEFIX.some((p) => event.startsWith(p))) return { ok: true, grund: null };

  try {
    const an = await zahl("frequenzbremse_an", 1);
    if (an !== 1) return { ok: true, grund: null };

    // ── WAS GEZÄHLT WIRD — UND WAS NICHT (Hotfix 02.09.2026, 08:20) ─────────
    // Am ersten Morgen mit scharfer Rückholung ging KEINE einzige Mail raus:
    // 240 Versuche, 240-mal „Tagesdeckel erreicht“. Zwei Fehler im ersten
    // Entwurf: (1) Pflichtmails wurden zwar nicht gebremst, aber MITGEZÄHLT —
    // wer morgens die Bankwechsel-Info bekam, hatte sein Werbebudget verbraucht.
    // (2) Der 30-Tage-Zähler sah die alte Mahnflut (Schnitt 15 je Kopf) und
    // sperrte damit die Menschen, denen die Bremse eigentlich helfen soll, für
    // Wochen gegen die WERTVOLLEN Mails (SEPA-Einladung, Klärgespräch).
    // Deshalb: Gezählt werden nur werbende Mails, und nur ab dem Stichtag, an
    // dem die Bremse selbst scharf war. Was davor rausging, ist Vergangenheit —
    // die Bremse schützt vor dem, was sie zulässt, nicht vor dem, was war.
    // Die Zustellsignale (Rückläufer, Spam, Blockaden) bleiben bewusst über
    // 30 Tage sichtbar — das sind Fakten über die Adresse, keine Budgetfrage.
    const stichtag = await stichtagLesen();
    const pflicht = Array.from(PFLICHTMAILS);
    const [z] = (await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE werbend AND created_at > NOW() - INTERVAL '24 hours')::int AS heute,
        COUNT(*) FILTER (WHERE werbend AND created_at > NOW() - INTERVAL '7 days')::int   AS woche,
        COUNT(*) FILTER (WHERE werbend AND created_at > NOW() - INTERVAL '30 days')::int  AS monat,
        COUNT(*) FILTER (WHERE zustellung IN ('gebounct', 'spam'))::int       AS hart,
        COUNT(*) FILTER (WHERE zustellung = 'blockiert'
                           AND created_at > NOW() - INTERVAL '14 days')::int  AS blockiert
      FROM (
        SELECT created_at, zustellung,
               (created_at >= ${stichtag}::timestamptz
                AND NOT (event = ANY(${pflicht}))
                AND event NOT LIKE 'agent_%' AND event NOT LIKE 'aufgabe_%'
                AND event NOT LIKE 'team_%' AND event NOT LIKE 'chef_%'
                AND event NOT LIKE 'contract_%') AS werbend
          FROM fiaon_mail_log
         WHERE LOWER(TRIM(empfaenger)) = ${adresse}
           AND status = 'versandt' AND art = 'echt'
           AND created_at > NOW() - INTERVAL '30 days'
      ) x
    `) as any[];

    const zaehler = { heute: Number(z?.heute || 0), woche: Number(z?.woche || 0), monat: Number(z?.monat || 0) };

    // ── DIE WERBESPERRE: EIN MENSCH HAT „STOPP“ GESAGT ────────────────────
    // Gesetzt an fiaon_persons.werbung_gesperrt_am — von Hand, vom Postmeister
    // (Antwort „Stopp“ auf die letzte Rückhol-Mail) oder über den Leitstand.
    // Die S5-Mail verspricht wörtlich: „Dann nehmen wir Sie aus allen
    // Verteilern zu diesem Vorgang.“ Diese Abfrage löst das Versprechen ein.
    // Pflichtmails sind oben schon durchgelassen — die Sperre trifft nur Werbung.
    const [gesperrt] = (await sqlPool`
      SELECT 1 AS g FROM fiaon_persons p
      WHERE p.werbung_gesperrt_am IS NOT NULL
        AND (
          LOWER(TRIM(COALESCE(p.primary_email, ''))) = ${adresse}
          OR EXISTS (
            SELECT 1 FROM fiaon_applications a
            WHERE a.person_id = p.id AND a.merged_into IS NULL
              AND ${adresse} IN (
                LOWER(TRIM(COALESCE(a.email, ''))),
                LOWER(TRIM(COALESCE(a.contact_email, ''))),
                LOWER(TRIM(COALESCE(a.billing_email, ''))))
          )
        )
      LIMIT 1
    `) as any[];
    if (gesperrt) {
      return { ok: false, grund: "Werbesperre: Diese Person hat um keine weitere Post gebeten" };
    }

    // ── HARTE UNZUSTELLBARKEIT: NIE WIEDER ────────────────────────────────
    // Eine Adresse, die hart zurückkam oder als Spam gemeldet wurde, weiter
    // anzuschreiben ist das Teuerste, was man der Domain antun kann — und dem
    // Empfänger nützt es nichts, die Mail kommt ohnehin nicht an.
    if (Number(z?.hart || 0) > 0) {
      return { ok: false, grund: "Adresse ist unzustellbar (Rückläufer oder Spam-Meldung)", zaehler };
    }
    // Blockiert ist weicher: Der Postfachanbieter hat abgelehnt, die Adresse
    // kann gültig sein. Zwei Wochen Ruhe, dann darf es wieder versucht werden.
    if (Number(z?.blockiert || 0) >= 3) {
      return { ok: false, grund: "Postfach hat zuletzt mehrfach blockiert — 14 Tage Ruhe", zaehler };
    }

    const [tag, woche, monat] = await Promise.all([
      zahl("frequenz_pro_tag", STANDARD.tag),
      zahl("frequenz_pro_woche", STANDARD.woche),
      zahl("frequenz_pro_monat", STANDARD.monat),
    ]);

    if (tag > 0 && zaehler.heute >= tag) {
      return { ok: false, grund: `Tagesdeckel erreicht (${zaehler.heute}/${tag} in 24 Stunden)`, zaehler };
    }
    if (woche > 0 && zaehler.woche >= woche) {
      return { ok: false, grund: `Wochendeckel erreicht (${zaehler.woche}/${woche} in 7 Tagen)`, zaehler };
    }
    if (monat > 0 && zaehler.monat >= monat) {
      return { ok: false, grund: `Monatsdeckel erreicht (${zaehler.monat}/${monat} in 30 Tagen)`, zaehler };
    }
    return { ok: true, grund: null, zaehler };
  } catch (err) {
    console.error("[FREQUENZ] Prüfung fehlgeschlagen, lasse durch:", err instanceof Error ? err.message : err);
    return { ok: true, grund: null };
  }
}
