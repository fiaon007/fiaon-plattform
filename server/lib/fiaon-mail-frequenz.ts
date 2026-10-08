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
import { istAboPaket, PAKETE } from "@shared/fiaon-pakete";

/**
 * Pflichtmails: Antworten auf eine Handlung des Menschen. Diese laufen IMMER
 * durch — kein Tagesdeckel, keine Wochengrenze. Wer hier etwas hinzufügt,
 * muss sich fragen: Hat der Empfänger unmittelbar davor selbst etwas getan?
 * Wenn nein, gehört es nicht auf diese Liste.
 */
export const PFLICHTMAILS = new Set<string>([
  "payment_confirmed",       // Zahlung da → Zugang. Ohne das ist das Geld weg und die Tür zu.
  "zugang_link",             // 18.09.2026: Der Kunde kommt nicht in seinen bezahlten Bereich — die Tür, nicht Werbung.
  "account_activated",
  "bereich_freigeschaltet",  // 18.09.2026: Antwort auf das eben geführte Startgespräch.
  "welcome",                 // Antwort auf den abgeschickten Antrag.
  "lead_willkommen",         // E-210: Antwort auf das eben abgeschickte Werbeformular — einmal je Person und Tag (fiaon-lead-willkommen.ts).
  "payment_details",         // Die Zahlungsdaten zum eben abgeschlossenen Antrag.
  "bankverbindung_neu",      // 02.09.2026: Kontowechsel — wer die alte IBAN hat, MUSS die neue bekommen.
  "kuendigung_bestaetigt",   // Vertragspost: Eingang der Kündigung und was noch offen ist.
  "vertrag_beendet",         // Vertragspost: der Vertrag ist beendet.
  "vertrag_bestaetigung",    // E-282 (05.10.2026): Vertragspost — Antwort auf die eben erklärte Annahme, mit dem Vertrag als PDF (§ 312f BGB).
  "termin_bestaetigung",
  "global_termin",           // E-188: Antwort auf die eben gebuchte Zeit (Erstgespräch FIAON Global).
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
  // E-240: ohne Deckel, aber NICHT ohne Bedingung — nur mit lebendem Vertrag und nie mit
  // Kaufangebot an eine Werbesperre (NUR_MIT_VERTRAG / sperrUrteil, unten).
  "documents_change_request",
  "commission_statement_issued",
  "app_login_link",          // 06.09.2026: Zugang — der Kunde hat den Anmelde-Link selbst angefordert; gebremst wäre die Tür zu.
  // 26.09.2026 (E-243): der Kundenpreis-Link der Bonitätsauskunft — eben selbst auf /bonitaet-antrag
  // angefordert (auch mit Werbesperre). Wer ihn NICHT bekommt, entscheidet die Route (fiaon-auskunft-kauf.ts).
  "auskunft_kundenpreis",
  "global_zugang",           // E-188: dasselbe für Firmenkunden — der Link zu „Mein Auftrag" ist ihr einziger Zugang.
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

/**
 * ZAHLUNGSPOST: die Erinnerung an eine Rate aus einem laufenden, bezahlten Vertrag.
 * Das ist keine Werbung, sondern eine Forderung — die Werbesperre („Stopp“ auf eine
 * Rückhol-Mail) trifft sie nicht. Wer NICHT mehr gemahnt werden soll, bekommt einen
 * Mahnstopp an der Bestellung (abo_gestoppt_am) — das ist die Entscheidung eines
 * Menschen und wird in `faelligeRaten` beachtet. Justin, 11.09.2026 (E-182).
 */
const ZAHLUNGSPOST = new Set<string>([
  "abo_payment_reminder",
  // E-188 (17.09.2026): die Erinnerung an die Rechnung eines unterschriebenen Firmenauftrags — höchstens
  // zwei je Auftrag (server/lib/fiaon-global-zahlungstakt.ts). Forderung aus einem Vertrag, keine Werbung.
  "global_zahlung_erinnerung",
  // E-244 (26.09.2026): die Erinnerung an eine bestellte, unbezahlte Bonitätsauskunft
  // (server/lib/fiaon-auskunft-erinnerung.ts). Forderung aus einem geschlossenen Vertrag, keine
  // Werbung: Die Werbesperre hält sie nicht auf, hart unzustellbar schon. Wer nicht mehr erinnert
  // werden will, bekommt einen Mahnstopp an der Bestellung (Chefseite, Knopf „Mahnstopp").
  "auskunft_zahlung_erinnerung",
]);

// ── ZAHLUNGSPOST-FREIGABE (08.10.2026, Justin: „Ja, Zahlungspost zustellen.") ──────────────────────────────
// Brevo verwarf Zahlungserinnerungen an Adressen auf seiner Sperrliste (meist alte Abmeldungen von Werbung).
// Die Freigabe (server/lib/fiaon-zahlungspost-freigabe.ts) sperrt dann zuerst die Werbung der Person (mit Herkunft
// werbesperre_quelle = 'zahlungspost_freigabe'), hebt die Brevo-Sperre auf und vermerkt das als Zeile
// `zahlungspost_freigabe` in fiaon_mail_log (Nachweis „einmal je Adresse", Tagesdeckel; Nutzlast werbesperre_neu und
// brevo = aufgehoben/unklar). Wer vorher keine Werbesperre hatte, bekam die Erinnerung an die
// ERSTZAHLUNG — das bleibt so: Die Werbesperre AUS DER FREIGABE hält die Erstzahlungs-Erinnerung nicht auf
// (FREIGABE_WERBESPERRE_PERSONEN_SQL, unten). Jede andere Werbesperre hält sie weiter auf (Mara-Topsales 08.10.2026).
//
// NACH DER PRÜFUNG (08.10.2026): Die Ausnahme hing zuerst nur an der freigegebenen ADRESSE — dann hätte sie auch eine
// ältere „Stopp"-Sperre oder ein späteres „abgelehnt" ausgehebelt, dauerhaft, bei zwei Erinnerungen am Tag. Jetzt
// gilt sie nur für die Werbesperre, die die Freigabe selbst gesetzt hat (werbesperre_quelle, FREIGABE_WERBESPERRE_
// PERSONEN_SQL unten), solange kein Mensch Nein gesagt hat (Stopp auf WhatsApp/im Postfach, Abmeldung über eine
// Lead-Mail, jeder andere Setzweg der Werbesperre). Wer danach nicht mehr erinnert werden will: Mahnstopp an der
// Bestellung (wie bei der Rate, E-182).
export const ZAHLUNGSPOST_NACH_FREIGABE = new Set<string>(["payment_reminder"]);
export const ZAHLUNGSPOST_FREIGABE_EVENT = "zahlungspost_freigabe";
/**
 * Zahlungspost im Sinne der Freigabe: die Raten- und Auskunft-Erinnerung und die Erstzahlung. NICHT die Firmenrechnung
 * (global_zahlung_erinnerung, zweite Prüfung 08.10.): Sie geht über globalMailSenden direkt an den Motor
 * (fiaon-global-auftrag.ts → mailDirektSenden), nie durch sendMakeWebhookMitGrund — die Freigabe sähe sie also nie, und
 * ein Firmenkunde gehört nicht in die Privat-Abläufe (E-272). Sie in der Liste zu führen, versprach etwas, das nicht läuft.
 */
export function istZahlungspost(event: string): boolean {
  if (event === "global_zahlung_erinnerung") return false;
  return ZAHLUNGSPOST.has(event) || ZAHLUNGSPOST_NACH_FREIGABE.has(event);
}
/** Adressen mit einem Freigabe-Vermerk — der Nachweis, dass die Freigabe einer Adresse festgehalten ist. */
export const ZAHLUNGSPOST_FREI_ADRESSEN_SQL = `(SELECT LOWER(TRIM(zf.empfaenger)) FROM fiaon_mail_log zf
    WHERE zf.event = '${ZAHLUNGSPOST_FREIGABE_EVENT}' AND zf.empfaenger IS NOT NULL)`;
export async function zahlungspostFrei(adresse: string): Promise<boolean> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!a) return false;
  const [r] = (await sqlPool.unsafe(`SELECT 1 AS frei FROM ${ZAHLUNGSPOST_FREI_ADRESSEN_SQL} f(adresse) WHERE f.adresse = $1 LIMIT 1`, [a])) as any[];
  return !!r;
}

/** Der Hauptschalter der Bremse: fiaon_settings.frequenzbremse_an (Standard 1). */
async function bremseAn(): Promise<boolean> {
  return (await zahl("frequenzbremse_an", 1)) === 1;
}

export interface FrequenzUrteil {
  ok: boolean;
  /** Klartext für das Protokoll. Null, wenn erlaubt. */
  grund: string | null;
  /** Nur zur Anzeige im Leitstand: was den Ausschlag gab. */
  zaehler?: { heute: number; woche: number; monat: number };
  /** 18.09.2026: Handversand an eine zuletzt gesperrte Adresse — erlaubt, mit Hinweis. */
  hinweis?: string | null;
  /** Vor dem Versand die Brevo-Sperre der Adresse aufheben. */
  sperreAufheben?: boolean;
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
 * Zwei-Tage-Takt = 3,5 je Woche) und schneidet genau den
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
/**
 * Gab es zu diesem Empfänger und Ereignis in den letzten 20 Stunden schon einen
 * von der Frequenzbremse zurückgehaltenen Versuch? Dann ruht der Versand — ohne
 * neuen Protokolleintrag. Gemessen am 09.09.2026 (7 Tage): abo_payment_reminder
 * 3.219 vergebliche Versuche an 56 Empfänger, bis zu 143 je Empfänger, jedes
 * Mal „Fehlgeschlagen" im Verlauf. Team: „nicht permanent dieselben Mails erneut
 * versuchen". Der Grund beginnt mit „Frequenzbremse-Ruhe" — daran erkennen die
 * Protokollstellen, dass sie NICHT noch einmal schreiben sollen.
 */
export async function frequenzRuhe(email: string, event: string): Promise<string | null> {
  const adresse = String(email || "").trim().toLowerCase();
  if (!adresse) return null;
  try {
    // Bremse aus → auch keine Ruhe nach einem gebremsten Versuch (E-182).
    if (!(await bremseAn())) return null;
    const [r] = (await sqlPool`
      SELECT grund FROM fiaon_mail_log
       WHERE LOWER(TRIM(empfaenger)) = ${adresse} AND event = ${event}
         -- 25.09.2026 (E-240): Sperr-Ablehnungen heißen jetzt „Sperre:" (make-webhook.ts).
         AND status = 'fehlgeschlagen' AND (grund LIKE 'Frequenzbremse:%' OR grund LIKE 'Sperre:%')
         AND created_at > NOW() - INTERVAL '20 hours'
       ORDER BY created_at DESC LIMIT 1`) as any[];
    return r ? `Frequenzbremse-Ruhe (kein neuer Versuch binnen 20 Stunden): ${String(r.grund).replace(/^(Frequenzbremse|Sperre): /, "")}` : null;
  } catch { return null; }
}

/**
 * @param opts.manuell true = ein Mitarbeiter schickt die Mail von Hand. Dann gilt nur die
 *   harte Sperre (Rückläufer/Spam); Tages-, Wochen-, Monatsdeckel und Werbesperre sind für
 *   die Automatik da. Team-Feedback 09.09.2026 (E-168): „Der Mensch muss über dem
 *   automatisierten Systemprozess stehen." Vorher blockte der Wochendeckel auch die
 *   Zahlungserinnerung, die Daniel von Hand an Frau Gummelt schicken wollte.
 */
export async function darfAnEmpfaenger(
  email: string,
  event: string,
  opts: { manuell?: boolean; /** E-240: die Nutzlast — nur für die Frage „Kaufangebot in der Unterlagen-Mail?" */ nutzlast?: Record<string, unknown> | null } = {},
): Promise<FrequenzUrteil> {
  const adresse = String(email || "").trim().toLowerCase();
  if (!adresse) return { ok: true, grund: null };

  // ── E-240 (24.09.2026): DIE SPERREN, DIE AUCH PFLICHT UND HANDVERSAND TREFFEN ──
  // Drei Fälle, die bisher ungeprüft durchliefen (Messung im Kopf der Werbesperre
  // unten): die Unterlagen-Mail an Gekündigte, das Auskunft-Angebot ohne
  // Rechtsgrundlage und Werbung „von Hand" an Menschen mit Werbesperre.
  if (NUR_MIT_VERTRAG.has(event) || NUR_BIS_VERTRAGSENDE.has(event) || event === AUSKUNFT_ANGEBOT || (opts.manuell && istWerbungImmer(event))) {
    try {
      const staende = await personSperren(await personenAnAdresse(adresse));
      // E-241 (25.09.2026): Das Auskunft-Angebot fragt den Kreis des Verkaufstakts — EINE Quelle
      // (verkaufKreis, fiaon-auskunft-verkauf.ts; bei einer Störung „uwg", die engere Lesart).
      // Gegenlesen 25.09.2026: auch ein Ladefehler des Moduls ergibt „uwg" — sonst ließe der catch unten
      // die ganze Sperrprüfung (Werbesperre, Test, Kündigung) aus.
      const kreis = event === AUSKUNFT_ANGEBOT
        ? await import("./fiaon-auskunft-verkauf").then((m) => m.verkaufKreis()).catch(() => "uwg" as const)
        : undefined;
      const grund = sperrUrteil(event, staende, { manuell: !!opts.manuell, nutzlast: opts.nutzlast ?? null, kreis });
      if (grund) return { ok: false, grund };
    } catch (err) {
      console.error("[FREQUENZ] Sperrprüfung E-240 fehlgeschlagen, lasse durch:", err instanceof Error ? err.message : err);
    }
  }

  // Pflichtmails und Team-Post laufen ohne Prüfung durch.
  if (PFLICHTMAILS.has(event)) return { ok: true, grund: null };
  if (TEAM_PRAEFIX.some((p) => event.startsWith(p))) return { ok: true, grund: null };

  try {
    // ── DER HAUPTSCHALTER (Justin, 11.09.2026, E-182) ─────────────────────
    // „Es soll keine Bremse, Mahnpause oder sonstiges geben.“ Steht
    // frequenzbremse_an auf 0, fallen Tages-, Wochen- und Monatsdeckel, die
    // 14-Tage-Ruhe nach Blockaden und die 20-Stunden-Ruhe (frequenzRuhe) weg.
    // Was auch dann bleibt, weil es keine Bremse ist, sondern Physik und Recht:
    //   · hart unzustellbare Adressen (Rückläufer/Spam-Meldung) — Brevo stellt
    //     dorthin ohnehin nicht zu; jeder Versuch ist nur ein Schlag auf den
    //     Absender-Ruf, ohne dass ein Mensch die Mail sieht.
    //   · die Werbesperre für WERBUNG — „Dann nehmen wir Sie aus allen
    //     Verteilern“ ist ein gegebenes Versprechen. Zahlungspost (Rate aus
    //     einem laufenden Vertrag) ist keine Werbung und geht trotzdem raus.
    const bremse = await bremseAn();

    // ── WAS GEZÄHLT WIRD — UND WAS NICHT (Hotfix 02.09.2026, 08:20) ─────────
    // Am ersten Morgen mit scharfer Rückholung ging KEINE einzige Mail raus:
    // 240 Versuche, 240-mal „Tagesdeckel erreicht“. Zwei Fehler im ersten
    // Entwurf: (1) Pflichtmails wurden zwar nicht gebremst, aber MITGEZÄHLT —
    // wer morgens die Bankwechsel-Info bekam, hatte sein Werbebudget verbraucht.
    // (2) Der 30-Tage-Zähler sah die alte Mahnflut (Schnitt 15 je Kopf) und
    // sperrte damit die Menschen, denen die Bremse eigentlich helfen soll, für
    // Wochen gegen die WERTVOLLEN Mails (damals SEPA-Einladung, Klärgespräch).
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
                           AND created_at > NOW() - INTERVAL '14 days'
                           -- 08.10.2026: Blockaden VOR einer Zahlungspost-Freigabe dieser Adresse zählen nicht —
                           -- die Freigabe hat ihren Grund (Brevo-Abmeldung) beseitigt.
                           AND created_at > COALESCE(frei_seit, '-infinity'::timestamptz))::int  AS blockiert
      FROM (
        SELECT created_at, zustellung,
               (SELECT MAX(zf.created_at) FROM fiaon_mail_log zf
                 WHERE zf.event = ${ZAHLUNGSPOST_FREIGABE_EVENT} AND LOWER(TRIM(zf.empfaenger)) = ${adresse}) AS frei_seit,
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
    if (opts.manuell) {
      // ── DER MENSCH STEHT ÜBER DER SPERRE (18.09.2026, Team-Feedback P4) ────
      // Hier stand die letzte Wand für Handversände: Nach einem Rückläufer oder
      // einer Spam-Meldung lehnte das System JEDE Mail an die Adresse ab — 28-mal
      // in sieben Tagen, u. a. Einladungen, die Daniel nach einem Telefonat
      // schicken wollte. Wer von Hand schickt, hat meist gerade mit dem Kunden
      // gesprochen. Jetzt: Versand erlaubt, Brevo-Sperre aufgehoben, und der
      // Mitarbeiter liest, dass er die Adresse bestätigen soll.
      if (Number(z?.hart || 0) > 0) {
        return {
          ok: true, grund: null, zaehler, sperreAufheben: true,
          hinweis: "An diese Adresse kam zuletzt eine Mail zurück (Rückläufer oder Spam-Meldung). "
            + "Für deinen Versand ist die Sperre aufgehoben — bitte die Adresse mit dem Kunden bestätigen.",
        };
      }
      return { ok: true, grund: null, zaehler };
    }

    // ── DIE WERBESPERRE: EIN MENSCH HAT „STOPP“ GESAGT ────────────────────
    // Gesetzt an fiaon_persons.werbung_gesperrt_am — von Hand, vom Postmeister
    // (Antwort „Stopp“ auf die letzte Rückhol-Mail) oder über den Leitstand.
    // Die S5-Mail verspricht wörtlich: „Dann nehmen wir Sie aus allen
    // Verteilern zu diesem Vorgang.“ Diese Abfrage löst das Versprechen ein.
    // Pflichtmails sind oben schon durchgelassen — die Sperre trifft nur Werbung.
    // E-240: über werbesperreAnAdresse — kennt jetzt auch die Adresse aus dem
    // Lead-Formular und die einer zusammengeführten Person (Fall im Kopf der
    // Werbesperre unten: zwei lead_followup nach „Stopp“).
    // 08.10.2026 (Zahlungspost-Freigabe, oben): Für die Erstzahlungs-Erinnerung zählt die Werbesperre, die die
    // Freigabe selbst gesetzt hat, nicht — jede andere schon (auch ein „Stopp" oder „abgelehnt" danach).
    const gesperrt = await werbesperreAnAdresse(adresse, { ohneFreigabe: ZAHLUNGSPOST_NACH_FREIGABE.has(event) });
    if (gesperrt && !ZAHLUNGSPOST.has(event)) {
      return { ok: false, grund: "Werbesperre: Diese Person hat um keine weitere Post gebeten" };
    }

    // ── HARTE UNZUSTELLBARKEIT: NIE WIEDER ────────────────────────────────
    // Eine Adresse, die hart zurückkam oder als Spam gemeldet wurde, weiter
    // anzuschreiben ist das Teuerste, was man der Domain antun kann — und dem
    // Empfänger nützt es nichts, die Mail kommt ohnehin nicht an.
    if (Number(z?.hart || 0) > 0) {
      return { ok: false, grund: "Adresse ist unzustellbar (Rückläufer oder Spam-Meldung)", zaehler };
    }
    // Ab hier nur noch Deckel und Ruhen — bei abgeschalteter Bremse ist Schluss.
    if (!bremse) return { ok: true, grund: null, zaehler };
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE WERBESPERRE — EINE REGEL FÜR JEDEN KANAL (24.09.2026, E-240)
//
// Justins Frage: „Bekommt der eine Sperre, dass wir dem nichts weiter
// schicken?" Gemessen an der Produktion (nur lesend, 24.09.2026, 206 Menschen
// mit fiaon_persons.werbung_gesperrt_am):
//   · Die Unterlagen-Mail (documents_change_request) stand in PFLICHTMAILS und
//     lief an jeder Sperre vorbei: 57 Stück an 23 Menschen mit Werbesperre am
//     24.09. (nach person_id) — dazu an Gekündigte und Menschen mit beendetem Vertrag.
//   · Zwei lead_followup gingen am 16./17.09. an eine Adresse mit Werbesperre:
//     Die Adresse stand an einer zweiten Person (später zusammengeführt) und im
//     Lead-Formular — die Tür verglich nur primary_email und die Bestellungen.
//   · Gegenlesen 24.09.2026: Die Lead-Strecke (fiaon-lead-strecke.ts, „DER ZWEITE
//     WEG") schickt JEDE von hier abgelehnte Mail über Brevo direkt nach — 30 Tage:
//     2 nach Werbesperre (Lead 1660, 17./18.09.), 165 an unzustellbare Adressen,
//     53 an blockierende Postfächer, 1 über dem Wochendeckel. Ein „nein" dieser
//     Tür ist dort kein Nein — Reparatur gehört in jene Datei.
//   · Handversand (opts.manuell) übersprang die Werbesperre vollständig.
//   · Mara-Aktion (Gmail direkt) und Mara auf WhatsApp gehen nicht durch diese
//     Tür; sie fragen jetzt personSperre() (dieselbe Regel).
//   · `fiaon_persons.gesperrt_seit` ist leer (0 Zeilen) und wird nirgends
//     gelesen — die Sperren des Hauses sind werbung_gesperrt_am (Werbung),
//     is_blocked (Vertrieb) und die Kündigung an der Bestellung.
//
// WAS DIE WERBESPERRE BEDEUTET (Kundenweg: „keine Werbe- und Erinnerungsmails
// mehr; Vertragspost bleibt"): Alles, was verkauft oder zum Abschluss drängt,
// hört auf — automatisch UND von Hand. Was bleibt: Antworten auf seine eigene
// Nachricht (ohne Verkauf), Vertragspost (Zugang, Rechnung, Kündigung,
// Termine, die er selbst gebucht hat), die Rate aus einem laufenden Vertrag
// (ZAHLUNGSPOST oben).
// ═══════════════════════════════════════════════════════════════════════════

/** Das Auskunft-Angebot (server/mail/vorlagen/auskunft-verkauf.ts) — Werbung mit eigener Rechtsgrundlage. */
export const AUSKUNFT_ANGEBOT = "auskunft_angebot";

/**
 * Ereignisse, die IMMER Werbung sind — egal, wer klickt. Die Werbesperre hält
 * sie auch beim Handversand auf („Dann nehmen wir Sie aus allen Verteilern" ist
 * ein Versprechen an den Menschen, nicht an die Automatik).
 */
const WERBUNG_IMMER = new Set<string>([
  "lead_followup", "lead_application_link", "followup_48h", "antrag_erinnerung", AUSKUNFT_ANGEBOT,
]);
export function istWerbungImmer(event: string): boolean {
  return WERBUNG_IMMER.has(event) || event.startsWith("rueckhol_");
}

/**
 * Vertragspost, die nur zu einem lebenden Vertrag gehört. Wer gekündigt hat
 * oder dessen Vertrag vorbei ist, wird nicht mehr um Unterlagen gebeten — am
 * 24.09. ging die Bitte an 104 solche Menschen.
 */
export const NUR_MIT_VERTRAG = new Set<string>(["documents_change_request"]);

/**
 * Leistungen aus dem Vertrag, die mit dem VERTRAGSENDE enden — nicht mit der
 * Kündigung: Wer gekündigt hat, zahlt bis zum Ende und bekommt bis dahin, was
 * er bezahlt (Startgespräch, Konto & Karte, der Anruf-Versuch). Danach nicht
 * mehr. Gemessen (30 Tage bis 24.09.2026): 309 Einladungen zum Startgespräch
 * an 99 Gekündigte, 28 davon nach dem Vertragsende; dazu 9 Karten-Einladungen
 * und 31 „nicht erreicht" — alle von Hand, an keiner Sperre vorbei, weil es
 * keine gab.
 */
export const NUR_BIS_VERTRAGSENDE = new Set<string>(["onboarding_einladung", "konto_karte_einladung", "nicht_erreicht_termin"]);

/**
 * Seit wann der Antrag auf das Widerspruchsrecht hinweist (§ 7 Abs. 3 Nr. 4
 * UWG). Werbung per Mail ohne Einwilligung an Bestandskunden ist nur gedeckt,
 * wenn der Hinweis schon bei der Erhebung der Adresse stand — 293 von 298
 * Auskunft-Zielkunden wurden davor Kunde.
 */
export const WIDERSPRUCH_HINWEIS_SEIT = "2026-09-02T12:35:00+02:00";

export interface PersonSperre {
  personId: number;
  werbesperre: boolean;
  werbesperreSeit: string | null;
  /** is_blocked — Vertriebssperre (kein Anruf, keine Anrufliste). */
  vertriebssperre: boolean;
  test: boolean;
  /**
   * Eine Kündigung liegt vor und ist nicht zurückgenommen (der MENSCH, E-213) —
   * es sei denn, er hat DANACH neu beantragt (neues Interesse, Fall Trommer).
   */
  gekuendigt: boolean;
  /** Ein Vertragsende ist erreicht, kein anderes Paket läuft und kein neuer Antrag kam danach. */
  vertragVorbei: boolean;
  /** Ein bezahltes, laufendes Paket (Abo), unabhängig von einer Kündigung. */
  laufendesPaket: boolean;
  /** Ein bezahltes, laufendes Paket OHNE Kündigung. */
  laufendUngekuendigt: boolean;
  /**
   * Kunde mit ungekündigtem Paket, dessen ERSTER Antrag überhaupt (dort wurde die
   * Adresse erhoben) schon den Widerspruchs-Hinweis trug (≥ WIDERSPRUCH_HINWEIS_SEIT).
   * Dieselbe, engere Lesart wie der Verkaufstakt (fiaon-auskunft-verkauf.ts,
   * ERSTER_ANTRAG_SQL) — bei einer Rechtsfrage gilt im Zweifel die engere.
   */
  kundeMitHinweis: boolean;
  /**
   * E-253 (28.09.2026): „Stopp" des MENSCHEN — „STOPP"/„Keine Nachrichten" auf
   * WhatsApp oder die Antwort ans Postfach mit dem Merkmal stopp (Postmeister:
   * „will keine Nachrichten mehr"), an irgendeiner Person der Familie. Nur
   * menschSperre liest es; personSperren lässt es leer.
   */
  stopp?: boolean;
}

/** Die Personen hinter einer Mailadresse — Hauptadresse, Bestellungen, Lead-Formular, Zusammengeführte. */
export async function personenAnAdresse(adresse: string): Promise<number[]> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!a) return [];
  const zeilen = (await sqlPool`
    SELECT DISTINCT COALESCE(p.merged_into_person_id, p.id)::int AS id FROM fiaon_persons p
     WHERE LOWER(TRIM(COALESCE(p.primary_email, ''))) = ${a}
    UNION
    SELECT DISTINCT x.person_id::int FROM fiaon_applications x
     WHERE x.person_id IS NOT NULL AND ${a} IN (
       LOWER(TRIM(COALESCE(x.email, ''))), LOWER(TRIM(COALESCE(x.contact_email, ''))), LOWER(TRIM(COALESCE(x.billing_email, ''))))
    UNION
    SELECT DISTINCT l.person_id::int FROM fiaon_leads l
     WHERE l.person_id IS NOT NULL AND LOWER(TRIM(COALESCE(l.email, ''))) = ${a}
  `) as any[];
  return Array.from(new Set(zeilen.map((z) => Number(z.id)).filter((n) => Number.isInteger(n) && n > 0)));
}

/**
 * Hat irgendein Mensch hinter dieser Adresse eine Werbesperre? Vergleicht
 * Hauptadresse, alle drei Adressen jeder Bestellung (auch zusammengeführter),
 * die Adresse aus dem Lead-Formular und die Hauptadresse zusammengeführter
 * Personen. Wirft bei einer Störung — der Aufrufer entscheidet.
 * 08.10.2026: `ohneFreigabe` zählt die Werbesperre nicht mit, die die Zahlungspost-Freigabe selbst gesetzt hat
 * (FREIGABE_WERBESPERRE_PERSONEN_SQL) — nur für die Erstzahlungs-Erinnerung (ZAHLUNGSPOST_NACH_FREIGABE).
 */
export async function werbesperreAnAdresse(adresse: string, opts: { ohneFreigabe?: boolean } = {}): Promise<boolean> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!a) return false;
  const [g] = (await sqlPool`
    SELECT 1 AS g FROM fiaon_persons p
     WHERE p.werbung_gesperrt_am IS NOT NULL
       ${opts.ohneFreigabe ? sqlPool.unsafe(`AND p.id NOT IN ${FREIGABE_WERBESPERRE_PERSONEN_SQL}`) : sqlPool``}
       AND (
         LOWER(TRIM(COALESCE(p.primary_email, ''))) = ${a}
         OR EXISTS (
           SELECT 1 FROM fiaon_applications x WHERE x.person_id = p.id
              AND ${a} IN (LOWER(TRIM(COALESCE(x.email, ''))), LOWER(TRIM(COALESCE(x.contact_email, ''))), LOWER(TRIM(COALESCE(x.billing_email, '')))))
         OR EXISTS (SELECT 1 FROM fiaon_leads l WHERE l.person_id = p.id AND LOWER(TRIM(COALESCE(l.email, ''))) = ${a})
         OR EXISTS (SELECT 1 FROM fiaon_persons m WHERE m.merged_into_person_id = p.id AND LOWER(TRIM(COALESCE(m.primary_email, ''))) = ${a})
       )
     LIMIT 1
  `) as any[];
  return !!g;
}

// ═══════════════════════════════════════════════════════════════════════════
// Mara-Topsales 08.10.2026 (Justin): DIE AUTOMATISCHE TÜR ALS SQL — FÜR AUSWAHLABFRAGEN
//
// Gemessen (nur lesend, 14 Tage bis 08.10.): 199 payment_reminder und 186 Rückhol-Mails scheiterten an der Tür
// (Werbesperre an der Adresse, hart unzustellbar) — vorher von der Auswahl beansprucht, gezählt (reminder_count)
// und bei S1–S3 sogar mit Mahnstopp belegt, ohne dass eine Mail ankam. Die Auswahl fragt jetzt dieselben zwei
// automatischen Nein der Tür (darfAnEmpfaenger: werbesperreAnAdresse, hart = Rückläufer/Spam in 30 Tagen) VORHER:
//   · WERBESPERRE_ADRESSEN_SQL — jede Adresse, hinter der irgendein Mensch eine Werbesperre hat (Hauptadresse,
//     die drei Adressen jeder Bestellung, Lead-Formular, Hauptadresse zusammengeführter Personen) — dieselben vier
//     Wege wie werbesperreAnAdresse, als Menge (einmal je Abfrage gebildet; NOT IN-sicher, nie NULL).
//   · HART_UNZUSTELLBAR_ADRESSEN_SQL — dieselbe Zählung wie `hart` in darfAnEmpfaenger.
// Zahlungspost (ZAHLUNGSPOST) trifft die Werbesperre nicht — der Aufrufer nimmt sie dann nicht dazu.
// Der Prüfstand (scripts/pruef-mara-topsales.ts) vergleicht die SQL-Menge mit werbesperreAnAdresse.
// ═══════════════════════════════════════════════════════════════════════════
export const WERBESPERRE_ADRESSEN_SQL = `(SELECT ws_a.adresse FROM (
    SELECT LOWER(TRIM(ws_p.primary_email)) AS adresse FROM fiaon_persons ws_p WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.email)) FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.contact_email)) FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.billing_email)) FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_l.email)) FROM fiaon_leads ws_l JOIN fiaon_persons ws_p ON ws_p.id = ws_l.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_m.primary_email)) FROM fiaon_persons ws_m JOIN fiaon_persons ws_p ON ws_p.id = ws_m.merged_into_person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
  ) ws_a WHERE ws_a.adresse IS NOT NULL AND ws_a.adresse <> '')`;

/** Adressen, die die Tür als hart unzustellbar ablehnt: Rückläufer oder Spam-Meldung in 30 Tagen (wie `hart` oben). */
export const HART_UNZUSTELLBAR_ADRESSEN_SQL = `(SELECT DISTINCT LOWER(TRIM(hu_m.empfaenger)) FROM fiaon_mail_log hu_m
    WHERE hu_m.status = 'versandt' AND hu_m.art = 'echt' AND hu_m.zustellung IN ('gebounct', 'spam')
      AND hu_m.created_at > NOW() - INTERVAL '30 days' AND hu_m.empfaenger IS NOT NULL)`;

/**
 * Würde die automatische Tür eine Mail `event` an die Adresse `adr` (SQL-Ausdruck, schon LOWER/TRIM) ablehnen?
 * Werbesperre (nicht bei Zahlungspost) oder hart unzustellbar. Für WHERE … AND NOT (…).
 * 08.10.2026: Für die Erstzahlungs-Erinnerung (ZAHLUNGSPOST_NACH_FREIGABE) zählt die Werbesperre aus der
 * Zahlungspost-Freigabe nicht (WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL) — dieselbe Lesart wie die Tür.
 */
export function tuerNeinSql(adr: string, event: string): string {
  const teile = [`(${adr}) IN ${HART_UNZUSTELLBAR_ADRESSEN_SQL}`];
  if (ZAHLUNGSPOST_NACH_FREIGABE.has(event)) teile.unshift(`(${adr}) IN ${WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL}`);
  else if (!ZAHLUNGSPOST.has(event)) teile.unshift(`(${adr}) IN ${WERBESPERRE_ADRESSEN_SQL}`);
  return `(${teile.join(" OR ")})`;
}

const istAuskunftZeile = (z: any) => String(z?.typ ?? "") === "schufa" || String(z?.ref ?? "").startsWith("FIAON-SCHUFA-");

/** Der Stand mehrerer Menschen in EINER Abfrage — die Regeln stehen in JavaScript (istAboPaket). */
export async function personSperren(ids: number[]): Promise<PersonSperre[]> {
  const liste = Array.from(new Set(ids.filter((n) => Number.isInteger(n) && n > 0)));
  if (!liste.length) return [];
  const zeilen = (await sqlPool`
    SELECT p.id, p.werbung_gesperrt_am, COALESCE(p.is_blocked, FALSE) AS is_blocked, (p.ist_test_am IS NOT NULL) AS test,
           (SELECT MIN(f.created_at) FROM fiaon_applications f WHERE f.person_id = p.id) AS erster_antrag,
           COALESCE(json_agg(json_build_object(
             'ref', a.ref, 'typ', a.type, 'key', a.pack_key, 'bezahlt', a.payment_status = 'paid',
             'storniert', a.cancelled_at IS NOT NULL, 'ende', a.vertrag_ende_am,
             'gekuendigt', a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL,
             'gekuendigt_am', a.gekuendigt_am, 'angelegt', a.created_at)) FILTER (WHERE a.ref IS NOT NULL), '[]'::json) AS antraege
      FROM fiaon_persons p
      LEFT JOIN fiaon_applications a ON a.person_id = p.id AND a.merged_into IS NULL
     WHERE p.id = ANY(${liste})
     GROUP BY p.id, p.werbung_gesperrt_am, p.is_blocked, p.ist_test_am
  `) as any[];
  return zeilen.map(sperreAusZeile);
}

/**
 * Eine Zeile (id, werbung_gesperrt_am, is_blocked, test, erster_antrag, antraege)
 * → PersonSperre. E-253: herausgezogen, damit personSperren (eine Person) und
 * menschSperre (die Familie) dieselben Regeln rechnen.
 */
function sperreAusZeile(z: any): PersonSperre {
  const jetzt = Date.now();
  const hinweisAb = new Date(WIDERSPRUCH_HINWEIS_SEIT).getTime();
  const antraege: any[] = Array.isArray(z.antraege) ? z.antraege : (() => { try { return JSON.parse(String(z.antraege)); } catch { return []; } })();
  const endeVorbei = (a: any) => !!a.ende && new Date(a.ende).getTime() <= jetzt;
  const laufend = (a: any) => !istAuskunftZeile(a) && istAboPaket(a.key) && a.bezahlt === true && !a.storniert && !endeVorbei(a);
  const laufendesPaket = antraege.some(laufend);
  // Ein Antrag NACH diesem Zeitpunkt (keine Auskunft-Bestellung) = neues Interesse.
  const neuerAntragNach = (t: unknown) => !!t && antraege.some((n) => !istAuskunftZeile(n) && new Date(n.angelegt).getTime() > new Date(String(t)).getTime());
  const gekuendigt = antraege.some((a) => a.gekuendigt === true && !neuerAntragNach(a.gekuendigt_am));
  const beendet = antraege.filter(endeVorbei);
  return {
    personId: Number(z.id),
    werbesperre: !!z.werbung_gesperrt_am,
    werbesperreSeit: z.werbung_gesperrt_am ? new Date(z.werbung_gesperrt_am).toISOString() : null,
    vertriebssperre: !!z.is_blocked,
    test: !!z.test,
    gekuendigt,
    vertragVorbei: beendet.length > 0 && !laufendesPaket && !beendet.some((a) => neuerAntragNach(a.ende)),
    laufendesPaket,
    laufendUngekuendigt: antraege.some((a) => laufend(a) && a.gekuendigt !== true),
    kundeMitHinweis: antraege.some((a) => laufend(a) && a.gekuendigt !== true)
      && !!z.erster_antrag && new Date(z.erster_antrag).getTime() >= hinweisAb,
    ...(z.stopp != null ? { stopp: z.stopp === true } : {}),
  };
}

/** Der Stand eines Menschen — null, wenn es ihn nicht gibt. */
export async function personSperre(personId: number): Promise<PersonSperre | null> {
  return (await personSperren([personId]))[0] ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER MENSCH HINTER EINER PERSON — EINE LESART FÜR ALLE WEGE (28.09.2026, E-253)
//
// Justin (28.09., Screenshot der WA-Zentrale): „Warum steht da, dass wir nicht
// schreiben dürfen? JEDER LEAD IM SYSTEM HAT UNS SEINE ZUSTIMMUNG GEGEBEN."
// Gemessen: 46 übersprungene Vorlagen an 26 Menschen seit dem 26.09., alle mit
// „Vertriebssperre" — und KEINER davon war gesperrt. Gesperrt war jeweils nur
// eine zusammengeführte Dublette: Das Zusammenführen (fiaon-person-merge.ts)
// setzt am Verlierer IMMER is_blocked = TRUE — er ist dann Wegweiser, kein
// „kein Interesse" — und trägt eine echte Sperre des Verlierers per ODER in
// den Gewinner. Die WhatsApp-Tür und die Lead-Strecke (E-240) lasen is_blocked
// über die ganze Familie und hielten die Marke für eine Sperre. immerSperre
// (E-241) hatte dieselbe Falle schon behoben — nur dort.
//
// Die Regel, die jetzt überall gilt:
//   · KOPF = das Ende der Kette merged_into_person_id (Ketten sind bis zu zwei
//     Ebenen tief, z. B. Dublette → Dublette → Kopf; gelesen bis fünf).
//   · VERTRIEBSSPERRE = is_blocked NUR am Kopf. Echte Sperren gehen nicht
//     verloren: Das ODER trägt sie seit dem ersten Merge (08.08.2026) in den
//     Kopf — gemessen 0 Fälle, in denen das nicht geschah (Wächter im
//     Prüfstand scripts/pruef-wa-sperre-lauf.ts).
//   · WERBESPERRE, TESTKONTO, KÜNDIGUNG/VERTRAGSENDE = über die ganze Familie
//     (die Werbesperre wandert beim Zusammenführen nicht mit; Bestellungen
//     hängen am Kopf, werden aber für den Fall der Fälle mitgelesen).
//   · „STOPP" auf WhatsApp liest immerSperre ebenfalls über die Familie.
//   · Nachtrag nach der Gegenprüfung (E-253): „STOPP" auf WhatsApp UND das
//     Stopp aus dem Postfach (fiaon_postmeister.flags stopp: true, „will keine
//     Nachrichten mehr") gelten über die ganze Familie — in der BASIS der
//     WA-Zentrale (STOPP_KOEPFE_SQL), in menschSperre (Feld stopp) und damit an
//     der Tür (werbungVerboten). Gemessen lesend: Bis dahin schützte 9 Menschen
//     mit Postfach-Stopp nur die Wegweiser-Marke einer Dublette; 68 freie
//     Menschen mit Postfach-Stopp standen ohne jeden Schutz da, und drei von
//     ihnen bekamen danach schon eine werbliche Vorlage. Ein „STOPP" an einer
//     Dublette (fiaon_whatsapp wird beim Zusammenführen nicht umgehängt) sah
//     vorher nur immerSperre.
// Die Bausteine unten sind SQL für Abfragen über viele Menschen; menschSperre
// ist dieselbe Regel für einen Menschen in JavaScript (werbungVerboten).
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Der Kopf einer Person: die Kette merged_into_person_id bis zum Ende (höchstens
 * fünf Ebenen). Unauflösbar (Kreis) oder unbekannt: die Person selbst. `p` ist
 * ein SQL-Ausdruck für die Personen-ID; er wird zweimal eingesetzt.
 */
export const KOPF_SQL = (p: string) => `COALESCE((WITH RECURSIVE e253_k(id, nach, t) AS (
    SELECT kp.id, kp.merged_into_person_id, 0 FROM fiaon_persons kp WHERE kp.id = ${p}
    UNION ALL
    SELECT n.id, n.merged_into_person_id, e253_k.t + 1 FROM fiaon_persons n JOIN e253_k ON n.id = e253_k.nach WHERE e253_k.t < 5)
  SELECT e253_k.id FROM e253_k WHERE e253_k.nach IS NULL LIMIT 1), ${p})`;

/** Alle Personen eines Menschen: der Kopf und jede, deren Kette bei ihm endet. `kopf` muss ein Kopf sein. */
export const FAMILIE_SQL = (kopf: string) => `(WITH RECURSIVE e253_f(id, t) AS (
    SELECT (${kopf})::int, 0
    UNION ALL
    SELECT n.id, e253_f.t + 1 FROM fiaon_persons n JOIN e253_f ON n.merged_into_person_id = e253_f.id WHERE e253_f.t < 5)
  SELECT e253_f.id FROM e253_f)`;

/** Vertriebssperre des Menschen: is_blocked NUR an der führenden Person — die Wegweiser-Marke an Dubletten zählt nie. */
export const VERTRIEBSSPERRE_SQL = (p: string) =>
  `EXISTS (SELECT 1 FROM fiaon_persons e253_v WHERE e253_v.id = ${KOPF_SQL(p)} AND COALESCE(e253_v.is_blocked, FALSE))`;

/**
 * Die Köpfe, in deren Familie irgendwo eine Werbesperre steht — OHNE Bezug auf
 * die äußere Abfrage, also einmal je Abfrage gebildet (heute gut 250 Sperren).
 * Nie NULL (KOPF_SQL fällt auf die Person zurück), darum sicher mit NOT IN.
 */
export const WERBESPERRE_KOEPFE_SQL = `(SELECT DISTINCT ${KOPF_SQL("e253_wk.id")} FROM fiaon_persons e253_wk WHERE e253_wk.werbung_gesperrt_am IS NOT NULL)`;

/** Werbesperre des Menschen: an irgendeiner Person seiner Familie. Für viele Zeilen geeignet (eine Kopf-Suche je Zeile). */
export const WERBESPERRE_FAMILIE_SQL = (p: string) => `(${KOPF_SQL(p)} IN ${WERBESPERRE_KOEPFE_SQL})`;

/**
 * Mara-Topsales 08.10.2026 (Prüfung): ABGEMELDET ÜBER DEN LINK EINER LEAD-MAIL (fiaon_leads.abgemeldet_am). Die Seite sagt
 * „Du bekommst keine weiteren E-Mails von uns.“ — bis heute setzte die Abmeldung nur den Lead-Stempel, keine Werbesperre an
 * der Person (gemessen 08.10.: 70 Menschen). Als Mengen, einmal je Abfrage gebildet, NOT IN-sicher (nie NULL):
 *   · LEAD_ABGEMELDET_KOEPFE_SQL — die Köpfe der Menschen, an deren Familie ein abgemeldeter Lead hängt,
 *   · LEAD_ABGEMELDET_ADRESSEN_SQL — die Adressen abgemeldeter Leads (auch ohne verknüpfte Person).
 * Gelesen von der Abbruch-Kette (abbrecherSql). Neue Abmeldungen setzen seit heute zusätzlich werbung_gesperrt_am.
 */
export const LEAD_ABGEMELDET_KOEPFE_SQL = `(SELECT DISTINCT ${KOPF_SQL("la_l.person_id")} FROM fiaon_leads la_l
    WHERE la_l.abgemeldet_am IS NOT NULL AND la_l.person_id IS NOT NULL)`;
export const LEAD_ABGEMELDET_ADRESSEN_SQL = `(SELECT DISTINCT LOWER(TRIM(la_a.email)) FROM fiaon_leads la_a
    WHERE la_a.abgemeldet_am IS NOT NULL AND la_a.email IS NOT NULL AND TRIM(la_a.email) <> '')`;

// ── „STOPP" DES MENSCHEN (E-253, Nachtrag nach der Gegenprüfung) ─────────────
// Zwei Wege, auf denen ein Mensch „keine Nachrichten mehr" sagt — beide
// endgültig, egal wann, egal an welcher Person der Familie:
//   · WhatsApp: „STOPP" oder „Keine Nachrichten mehr" (Text oder Knopf) —
//     dieselbe Regel wie bisher in der BASIS und in immerSperre.
//   · Postfach: der Postmeister hat die Antwort mit stopp: true markiert.
//     flags steht teils als JSON-Text in der jsonb-Spalte — deshalb der
//     Textvergleich, nie ein Cast, der an einer Zeile scheitert (wie
//     fiaon-mara-aktion.ts und ruecksichtSql in fiaon-auskunft-verkauf.ts).
/**
 * Weitere Formen des Widerspruchs (06.10.2026): „STOP“ mit einem p, „(Danke,) kein Interesse (mehr/daran)“ als ganze
 * Nachricht, „nicht mehr kontaktieren/anschreiben“, „lassen Sie mich in Ruhe“, „bitte abmelden“. Anlass: Eine Kundin
 * schrieb am 26. und 29.09. „Danke kein Interesse mehr“ und bekam trotzdem dreimal die Rechnungs-Vorlage (Kampagne 06.10.).
 * Ein Widerspruch gegen Werbung ist endgültig (§ 7 UWG) — und jede ungewollte Vorlage kostet Meta-Qualität.
 */
export const WA_WIDERSPRUCH_TEXT_SQL = (w: string) => `(COALESCE(${w}.text, '') ~* '^\\W*stop\\W*$'
  OR COALESCE(${w}.text, '') ~* '^\\W*(danke\\W*)?kein(e|en)?\\s+interesse(\\s+(mehr|daran))?\\W*(danke\\W*)?$'
  OR COALESCE(${w}.text, '') ~* '(nicht\\s+mehr\\s+(kontaktieren|anschreiben)|lassen\\s+sie\\s+mich\\s+in\\s+ruhe|bitte\\s+abmelden)')`;
/** Eine eingehende WhatsApp `w` sagt „STOPP". */
export const WA_STOPP_ZEILE_SQL = (w: string) => `(${w}.richtung = 'rein'
  AND (${w}.text ILIKE '%stopp%' OR ${w}.knopf ILIKE '%stopp%' OR ${w}.text ILIKE '%keine nachrichten%' OR ${w}.knopf ILIKE '%keine nachrichten%'
       OR ${WA_WIDERSPRUCH_TEXT_SQL(w)}))`;
/** Eine Postfach-Zeile `pm` trägt das Merkmal stopp. */
export const POSTFACH_STOPP_ZEILE_SQL = (pm: string) => `(${pm}.flags::text ~ 'stopp\\\\?"\\s*:\\s*true')`;

/**
 * Die Köpfe, in deren Familie irgendwo ein Stopp steht (WhatsApp oder Postfach)
 * — ohne Bezug auf die äußere Abfrage, einmal je Abfrage gebildet. Nie NULL,
 * darum sicher mit NOT IN (wie WERBESPERRE_KOEPFE_SQL).
 */
export const STOPP_KOEPFE_SQL = `(SELECT DISTINCT ${KOPF_SQL("e253_st.pid")} FROM (
    SELECT e253_sw.person_id AS pid FROM fiaon_whatsapp e253_sw WHERE e253_sw.person_id IS NOT NULL AND ${WA_STOPP_ZEILE_SQL("e253_sw")}
    UNION
    SELECT e253_sp.person_id FROM fiaon_postmeister e253_sp WHERE e253_sp.person_id IS NOT NULL AND ${POSTFACH_STOPP_ZEILE_SQL("e253_sp")}
  ) e253_st)`;

// ═══════════════════════════════════════════════════════════════════════════
// WOHER DIE WERBESPERRE KAM: fiaon_persons.werbesperre_quelle (08.10.2026, Zahlungspost-Freigabe, zweite Prüfung)
//
// Die Freigabe (server/lib/fiaon-zahlungspost-freigabe.ts) setzt die Werbesperre, damit eine bei Brevo abgemeldete
// Adresse nur noch Zahlungspost bekommt. Diese Werbesperre darf die ZAHLUNGSPOST nicht treffen, die der Mensch vorher
// bekam — sonst tauscht die Freigabe einen Kanal gegen einen anderen (gemessen 08.10., 14 Tage: 61 Raten-WhatsApps an
// 33 Menschen hinter den blockierten Adressen, die BASIS der WA-Zentrale hätte sie gestrichen). Jede ANDERE Werbesperre
// gilt wie bisher.
//
// DIE HERKUNFT STEHT AN DER PERSON (Spalte werbesperre_quelle, db/migrations/106_werbesperre_quelle.sql):
//   · 'zahlungspost_freigabe' — nur die Freigabe, im SELBEN UPDATE wie der Stempel und nur bei leerem Stempel. Damit
//     steht die Herkunft schon VOR dem Aufheben bei Brevo: Bricht der Lauf danach ab (vor dem Vermerk), gilt die
//     Werbesperre trotzdem als die der Freigabe — nicht als die eines Menschen.
//   · 'mensch' — JEDER andere Setzweg, AUCH wenn der Stempel schon steht: Mara (Abstreiten, „in Ruhe lassen",
//     Löschwunsch, „schreiben Sie mir nicht mehr"), Postmeister (Route, Werkzeug werbesperre_setzen, Freigabe eines
//     Entwurfs), Abmeldelink, Abmeldung über eine Lead-Mail, Kontaktergebnis „abgelehnt", Telefonkartei-Storno. Sagt ein
//     Mensch nach der Freigabe Nein, ist die Werbesperre ab da seine (vorher tat werbesperreSetzen bei stehendem
//     Stempel gar nichts, und die Ausnahme lief weiter). Der Prüfstand sucht jedes UPDATE auf werbung_gesperrt_am.
//   · leer bei gesetztem Stempel — eine Werbesperre von vor dem 08.10.2026: die eines Menschen.
// Die Ausnahme (Erstzahlungs-Erinnerung an Tür und Auswahl, Raten-WhatsApp der WA-Zentrale) gilt NUR für
// 'zahlungspost_freigabe' — und nur ohne „Stopp" (STOPP_KOEPFE_SQL) und ohne Abmeldung über eine Lead-Mail
// (LEAD_ABGEMELDET_KOEPFE_SQL; die alten haben keine Werbesperre): beides über die ganze Familie, egal wann.
// Die erste Fassung las dafür Vermerk, Stempelzeit und Wörter im Kontaktprotokoll — teuer und mit Lücken (Maras Nein
// ohne Vermerk, die SQL-Stopp-Erkennung ist enger als Maras). Sie ist entfallen.
// Einmal je Abfrage gebildet, ohne Bezug auf die äußere Abfrage; NOT IN-sicher (nie NULL).
// ═══════════════════════════════════════════════════════════════════════════
export const FREIGABE_AKTEUR = "Zahlungspost-Freigabe";
/** werbesperre_quelle: von der Zahlungspost-Freigabe gesetzt. */
export const WERBESPERRE_QUELLE_FREIGABE = "zahlungspost_freigabe";
/** werbesperre_quelle: von einem Menschen gewünscht (jeder andere Setzweg). */
export const WERBESPERRE_QUELLE_MENSCH = "mensch";
export const FREIGABE_WERBESPERRE_PERSONEN_SQL = `(SELECT zfw_p.id FROM fiaon_persons zfw_p
    WHERE zfw_p.werbung_gesperrt_am IS NOT NULL AND zfw_p.werbesperre_quelle = '${WERBESPERRE_QUELLE_FREIGABE}'
      AND ${KOPF_SQL("zfw_p.id")} NOT IN ${STOPP_KOEPFE_SQL}
      AND ${KOPF_SQL("zfw_p.id")} NOT IN ${LEAD_ABGEMELDET_KOEPFE_SQL})`;

/** Die Köpfe, in deren Familie eine Werbesperre steht, die NICHT aus der Zahlungspost-Freigabe stammt. */
export const WERBESPERRE_KOEPFE_OHNE_FREIGABE_SQL = `(SELECT DISTINCT ${KOPF_SQL("e253_wo.id")} FROM fiaon_persons e253_wo
    WHERE e253_wo.werbung_gesperrt_am IS NOT NULL AND e253_wo.id NOT IN ${FREIGABE_WERBESPERRE_PERSONEN_SQL})`;

/**
 * Die Adressen der Werbesperre wie WERBESPERRE_ADRESSEN_SQL (dieselben sechs Wege), aber ohne die Werbesperre aus der
 * Zahlungspost-Freigabe — für die Auswahl der Erstzahlungs-Erinnerung (tuerNeinSql). Der Filter steht EINMAL außen.
 */
export const WERBESPERRE_ADRESSEN_OHNE_FREIGABE_SQL = `(SELECT wo_a.adresse FROM (
    SELECT LOWER(TRIM(ws_p.primary_email)) AS adresse, ws_p.id AS pid FROM fiaon_persons ws_p WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.email)), ws_p.id FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.contact_email)), ws_p.id FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_x.billing_email)), ws_p.id FROM fiaon_applications ws_x JOIN fiaon_persons ws_p ON ws_p.id = ws_x.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_l.email)), ws_p.id FROM fiaon_leads ws_l JOIN fiaon_persons ws_p ON ws_p.id = ws_l.person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
    UNION SELECT LOWER(TRIM(ws_m.primary_email)), ws_p.id FROM fiaon_persons ws_m JOIN fiaon_persons ws_p ON ws_p.id = ws_m.merged_into_person_id WHERE ws_p.werbung_gesperrt_am IS NOT NULL
  ) wo_a WHERE wo_a.adresse IS NOT NULL AND wo_a.adresse <> '' AND wo_a.pid NOT IN ${FREIGABE_WERBESPERRE_PERSONEN_SQL})`;

/**
 * Stammt die Werbesperre dieser Person aus der Zahlungspost-Freigabe (Regel oben)? Für Texte, die sagen, was die
 * Werbesperre bedeutet (Kundenweg: „Zahlungspost bleibt"). Wirft bei einer Störung — der Aufrufer entscheidet.
 */
export async function werbesperreAusFreigabe(personId: number): Promise<boolean> {
  if (!Number.isInteger(personId) || personId <= 0) return false;
  const [r] = (await sqlPool.unsafe(`SELECT 1 AS ja WHERE $1::int IN ${FREIGABE_WERBESPERRE_PERSONEN_SQL}`, [personId])) as any[];
  return !!r;
}

/**
 * Mara-Topsales 08.10.2026 (Justin): Ist beim Menschen `p` (SQL-Ausdruck für die Personen-ID) eine ABLEHNUNG
 * dokumentiert? Eine Quelle für das Zusammenführen (fiaon-person-merge.ts: ohne Vermerk eine Prüfaufgabe) und die
 * Prüfliste der Sperren (scripts/mara-sperren-pruefliste.ts). Dokumentiert heißt — an seiner Familie (Kopf + Dubletten):
 *   · ein Vermerk im Kontaktprotokoll mit Ergebnis/Notiz „abgelehnt“, „kein Interesse“, „not_interested“, DSGVO/Löschung —
 *     an der Person ODER an einer ihrer Bestellungen (ältere Vermerke tragen nur die Bestellnummer: Nachgezählt am 08.10.
 *     haben 274 gesperrte A/B-Menschen ein „erreicht_abgelehnt“ nur an der Bestellung; die Diagnose las nur die Person
 *     und kam so auf 102 A / 99 B „ohne Ablehnung“ — mit der Bestellung bleiben 8 A und 3 B),
 *   · ein Klick auf „Sperren“ im Vertrieb (fiaon_agent_events vertrieb_sperre, neu = true),
 *   · eine Werbesperre oder ein „Stopp“ (WhatsApp/Postfach) — wer keine Nachrichten will, will auch keinen Verkauf
 *     (nicht die Werbesperre der Zahlungspost-Freigabe: werbesperre_quelle 'zahlungspost_freigabe' — die hat er nie verlangt),
 *   · (nach der Prüfung, 08.10.) die bewusst gesetzte Sperre der Verwaltung („Vertriebssperre GESETZT durch die
 *     Verwaltung“, vertriebssperreAendern in fiaon-kunden.ts — schreibt nur diesen Vermerk) und, mit
 *     `sperrProtokoll: true`, jede Sperre im Sperr-Protokoll (neu = true), die NICHT aus einem Zusammenführen stammt.
 *     Das Protokoll kann auf einem frischen Stand fehlen — der Aufrufer prüft to_regclass vorher.
 * Gemessen (Diagnose 08.10.): Die meisten Sperren der A/B-Menschen stammen aus Zusammenführungen und sind älter als das
 * Sperr-Protokoll (05.09.).
 *
 * WAS DARAUS FOLGT (nach der Prüfung, 08.10.): NICHTS WIRD AUFGEHOBEN. Beim Zusammenführen geht die Sperre des Verlierers
 * weiter mit (fiaon-person-merge.ts); fehlt ein Vermerk, entsteht EINE Betreiber-Aufgabe zur Einzelprüfung. Die Prüfliste
 * listet dieselben Fälle für das Team.
 */
export const ABLEHNUNG_DOKUMENTIERT_SQL = (p: string, opt: { sperrProtokoll?: boolean } = {}) => `(EXISTS (
    SELECT 1 FROM fiaon_contact_log ad_c
     WHERE ad_c.voided_at IS NULL
       AND (ad_c.person_id IN ${FAMILIE_SQL(KOPF_SQL(p))}
            OR ad_c.ref IN (SELECT ad_a.ref FROM fiaon_applications ad_a WHERE ad_a.person_id IN ${FAMILIE_SQL(KOPF_SQL(p))}))
       AND (COALESCE(ad_c.outcome, '') ~* '(abgelehnt|kein_interesse|kein interesse|not_interested|dsgvo|loesch)'
            OR COALESCE(ad_c.note, '') ~* '(abgelehnt|kein interesse|vertriebssperre gesetzt)'))
  OR EXISTS (SELECT 1 FROM fiaon_agent_events ad_e
              WHERE ad_e.type = 'vertrieb_sperre' AND ad_e.meta ~ ('"person_id":' || (${p})::text || '[,}]')
                AND ad_e.meta LIKE '%"neu":true%')
  OR EXISTS (SELECT 1 FROM fiaon_persons ad_w WHERE ad_w.id IN ${FAMILIE_SQL(KOPF_SQL(p))} AND ad_w.werbung_gesperrt_am IS NOT NULL
               AND ad_w.werbesperre_quelle IS DISTINCT FROM '${WERBESPERRE_QUELLE_FREIGABE}')
  ${opt.sperrProtokoll ? `OR EXISTS (SELECT 1 FROM fiaon_sperr_protokoll ad_s
              WHERE ad_s.person_id IN ${FAMILIE_SQL(KOPF_SQL(p))} AND ad_s.neu IS TRUE
                AND COALESCE(ad_s.anweisung, '') NOT ILIKE '%merged_into_person_id%'
                AND COALESCE(ad_s.anweisung, '') NOT ILIKE '%account_status = CASE%')` : ""}
  OR ${KOPF_SQL(p)} IN ${STOPP_KOEPFE_SQL})`;

// „Kündigung oder Vertragsende, und kein laufendes, ungekündigtes Paket" — genau
// wie personSperren/werbungVerboten, nur in SQL (für die Gruppen der WA-Zentrale:
// Wer hier gezählt wird, darf danach nicht an der Tür scheitern).
const ABO_SCHLUESSEL_SQL = (() => {
  const keys = PAKETE.filter((p) => p.abo).map((p) => p.key);
  if (!keys.length || keys.some((k) => !/^[a-z0-9_]+$/.test(k))) throw new Error("[MAIL-FREQUENZ] Abo-Schlüssel ungültig");
  return keys.map((k) => `'${k}'`).join(", ");
})();
const OV_AUSKUNFT = (a: string) => `(COALESCE(${a}.type, '') = 'schufa' OR COALESCE(${a}.ref, '') LIKE 'FIAON-SCHUFA-%')`;
const OV_ENDE_VORBEI = (a: string) => `(${a}.vertrag_ende_am IS NOT NULL AND ${a}.vertrag_ende_am <= NOW())`;
/** Ein Antrag (kein Auskunft-Kauf) der Person, angelegt NACH dem Zeitpunkt `t` = neues Interesse. */
const OV_NEUER_ANTRAG_NACH = (person: string, t: string) => `EXISTS (SELECT 1 FROM fiaon_applications ov_n
  WHERE ov_n.person_id = ${person} AND ov_n.merged_into IS NULL AND ov_n.ref IS NOT NULL AND NOT ${OV_AUSKUNFT("ov_n")}
    AND ov_n.created_at::timestamptz > (${t})::timestamptz)`;
const OV_LAUFEND = (a: string) => `(NOT ${OV_AUSKUNFT(a)} AND LOWER(TRIM(COALESCE(${a}.pack_key, ''))) IN (${ABO_SCHLUESSEL_SQL})
  AND ${a}.payment_status = 'paid' AND ${a}.cancelled_at IS NULL AND NOT ${OV_ENDE_VORBEI(a)})`;
const OV_GEKUENDIGT = (a: string) => `(${a}.gekuendigt_am IS NOT NULL AND ${a}.kuendigung_zurueckgenommen_am IS NULL)`;

/**
 * werbungVerboten = „gekündigt oder Vertrag beendet" für die Person `person`
 * (ein Kopf; die Bestellungen hängen seit dem Zusammenführen am Kopf). Dieselben
 * Schritte wie personSperren: laufendUngekuendigt schützt; gekündigt zählt nicht,
 * wenn danach neu beantragt wurde; Vertragsende nur ohne laufendes Paket und ohne
 * neuen Antrag nach dem Ende. Der Prüfstand vergleicht beide Fassungen.
 */
export const OHNE_VERTRAG_SQL = (person: string) => `(
  NOT EXISTS (SELECT 1 FROM fiaon_applications ov_l WHERE ov_l.person_id = ${person} AND ov_l.merged_into IS NULL AND ov_l.ref IS NOT NULL
                AND ${OV_LAUFEND("ov_l")} AND NOT ${OV_GEKUENDIGT("ov_l")})
  AND (
    EXISTS (SELECT 1 FROM fiaon_applications ov_g WHERE ov_g.person_id = ${person} AND ov_g.merged_into IS NULL AND ov_g.ref IS NOT NULL
              AND ${OV_GEKUENDIGT("ov_g")} AND NOT ${OV_NEUER_ANTRAG_NACH(person, "ov_g.gekuendigt_am")})
    OR (
      EXISTS (SELECT 1 FROM fiaon_applications ov_e WHERE ov_e.person_id = ${person} AND ov_e.merged_into IS NULL AND ov_e.ref IS NOT NULL
                AND ${OV_ENDE_VORBEI("ov_e")})
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications ov_p WHERE ov_p.person_id = ${person} AND ov_p.merged_into IS NULL AND ov_p.ref IS NOT NULL
                        AND ${OV_LAUFEND("ov_p")})
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications ov_b WHERE ov_b.person_id = ${person} AND ov_b.merged_into IS NULL AND ov_b.ref IS NOT NULL
                        AND ${OV_ENDE_VORBEI("ov_b")} AND ${OV_NEUER_ANTRAG_NACH(person, "ov_b.vertrag_ende_am")})
    )
  ))`;

/**
 * Der Stand des MENSCHEN hinter einer Person (E-253): Kopf aufgelöst,
 * Vertriebssperre nur am Kopf, Werbesperre, Testkonto, „Stopp" (WhatsApp und
 * Postfach) und Bestellungen über die ganze Familie. `personId` darf auch eine Dublette sein — das Ergebnis ist
 * dasselbe wie für ihren Kopf (personId im Ergebnis = der Kopf). null, wenn es
 * die Person nicht gibt. `lauf` für Transaktionen (Prüfstand).
 */
export async function menschSperre(personId: number, lauf: typeof sqlPool = sqlPool): Promise<PersonSperre | null> {
  if (!Number.isInteger(personId) || personId <= 0) return null;
  const [z] = (await lauf.unsafe(`
    WITH e253_kopf AS (SELECT ${KOPF_SQL("$1::int")} AS id),
         e253_fam AS ${FAMILIE_SQL("(SELECT id FROM e253_kopf)")}
    SELECT kp.id,
           (SELECT MIN(f.werbung_gesperrt_am) FROM fiaon_persons f WHERE f.id IN (SELECT id FROM e253_fam)) AS werbung_gesperrt_am,
           COALESCE(kp.is_blocked, FALSE) AS is_blocked,
           EXISTS (SELECT 1 FROM fiaon_persons f WHERE f.id IN (SELECT id FROM e253_fam) AND f.ist_test_am IS NOT NULL) AS test,
           -- Nachtrag E-253: „STOPP" auf WhatsApp oder im Postfach, an irgendeiner Person der Familie
           (EXISTS (SELECT 1 FROM fiaon_whatsapp sw WHERE sw.person_id IN (SELECT id FROM e253_fam) AND ${WA_STOPP_ZEILE_SQL("sw")})
            OR EXISTS (SELECT 1 FROM fiaon_postmeister sp WHERE sp.person_id IN (SELECT id FROM e253_fam) AND ${POSTFACH_STOPP_ZEILE_SQL("sp")})) AS stopp,
           (SELECT MIN(a.created_at) FROM fiaon_applications a WHERE a.person_id IN (SELECT id FROM e253_fam)) AS erster_antrag,
           COALESCE((SELECT json_agg(json_build_object(
             'ref', a.ref, 'typ', a.type, 'key', a.pack_key, 'bezahlt', a.payment_status = 'paid',
             'storniert', a.cancelled_at IS NOT NULL, 'ende', a.vertrag_ende_am,
             'gekuendigt', a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL,
             'gekuendigt_am', a.gekuendigt_am, 'angelegt', a.created_at))
              FROM fiaon_applications a
             WHERE a.person_id IN (SELECT id FROM e253_fam) AND a.merged_into IS NULL AND a.ref IS NOT NULL), '[]'::json) AS antraege
      FROM fiaon_persons kp
     WHERE kp.id = (SELECT id FROM e253_kopf)`, [personId])) as any[];
  return z ? sperreAusZeile(z) : null;
}

/**
 * Das Urteil für eine Mail an die Menschen hinter einer Adresse — rein, ohne
 * Datenbank (Prüfstand: scripts/pruef-mara-verkauf.ts). null = darf raus.
 *
 *  · Werbung (WERBUNG_IMMER) von Hand: nie an eine Werbesperre.
 *  · Unterlagen-Mail: nur, solange ein Vertrag lebt — also nicht, wenn JEDER
 *    Mensch an der Adresse gekündigt hat oder dessen Vertrag vorbei ist und
 *    keiner ein ungekündigtes Paket hat; nie an reine Testkonten; bei
 *    Werbesperre nie MIT Kaufangebot (angebot_text / auskunft_modus „angebot").
 *  · Startgespräch, Konto & Karte, „nicht erreicht": nur bis zum Vertragsende.
 *  · Auskunft-Angebot: nie an Werbesperre, Test, Gekündigte ohne laufendes
 *    Paket. Automatisch im Kreis „uwg" (Standard) nur an Kunden mit
 *    ungekündigtem Paket, deren erster Antrag schon den Widerspruchs-Hinweis
 *    trug (§ 7 Abs. 3 UWG); von Hand an Kunden, mit denen der Betreuer
 *    gesprochen hat (Antwort auf seine Bitte), ohne diese Grenze.
 *    E-241 (25.09.2026): Im Kreis „alle" (Justins Entscheidung) entfällt die
 *    Stichtag-Grenze — wer dann in Frage kommt (Segment A/B/C ohne Sperre,
 *    seit E-243 auch Abbrecher; Stornierte nie), entscheidet die Tür davor
 *    (angebotTuerSperre, fiaon-auskunft-verkauf.ts, dieselbe Grundmenge wie
 *    der Takt). Werbesperre, Test und Kündigung sperren hier in JEDEM Kreis.
 */
export function sperrUrteil(
  event: string,
  staende: PersonSperre[],
  opts: { manuell: boolean; nutzlast?: Record<string, unknown> | null; /** E-241: der Kreis des Verkaufstakts; ohne Angabe „uwg". */ kreis?: "uwg" | "alle" },
): string | null {
  const irgendeineSperre = staende.some((s) => s.werbesperre);
  const nurTest = staende.length > 0 && staende.every((s) => s.test);
  const ohneVertrag = staende.length > 0
    && staende.every((s) => !s.laufendUngekuendigt && (s.gekuendigt || s.vertragVorbei));

  if (event === AUSKUNFT_ANGEBOT) {
    if (irgendeineSperre) return "Werbesperre: Diese Person hat um keine weitere Post gebeten";
    if (!staende.length) return "Auskunft-Angebot nur an bekannte Kunden — zu dieser Adresse gibt es keinen";
    if (nurTest) return "Testkonto — kein Auskunft-Angebot";
    if (ohneVertrag) return "Gekündigt oder Vertrag beendet — kein Auskunft-Angebot";
    if (!opts.manuell && opts.kreis !== "alle" && !staende.some((s) => s.kundeMitHinweis)) {
      return "§ 7 Abs. 3 UWG: automatisch nur an Kunden, deren Antrag schon den Widerspruchs-Hinweis trug (ab 02.09.2026 12:35) — Angebot im Kundenbereich bleibt";
    }
    return null;
  }
  if (NUR_MIT_VERTRAG.has(event)) {
    if (nurTest) return "Testkonto — keine Unterlagen-Aufforderung";
    if (ohneVertrag) return "Gekündigt oder Vertrag beendet — keine Aufforderung mehr, Unterlagen nachzureichen";
    const n = opts.nutzlast ?? null;
    const mitAngebot = !!n && (String(n.angebot_text ?? "").trim() !== "" || String(n.auskunft_modus ?? "") === "angebot");
    if (irgendeineSperre && mitAngebot) return "Werbesperre: Die Unterlagen-Mail darf nur die Bitte enthalten, kein Kaufangebot";
    return null;
  }
  if (NUR_BIS_VERTRAGSENDE.has(event)) {
    if (nurTest) return "Testkonto — keine Einladung";
    if (staende.length > 0 && staende.every((s) => s.vertragVorbei && !s.laufendesPaket)) {
      return "Vertrag beendet — keine Einladung und kein Anruf-Versuch mehr aus dem Vertrag";
    }
    return null;
  }
  if (opts.manuell && istWerbungImmer(event) && irgendeineSperre) {
    return "Werbesperre: Diese Person hat um keine Werbung gebeten — auch von Hand nicht";
  }
  return null;
}

/**
 * WhatsApp-Vorlagen, die Vertrags- oder Zahlungspost sind — alles andere aus
 * WA_VORLAGEN (fiaon_kk_*, fiaon_kkb_*) wirbt für Antrag, Aktivierung oder
 * Empfehlung. Die Termin-Vorlagen gehören zu einem Termin, den er selbst hat.
 */
const WA_NICHT_WERBLICH = new Set<string>([
  "fiaon_kk_rate", "fiaon_kkb_rate", "fiaon_kk_termin", "fiaon_kkb_termin",
  "fiaon_kk_termin_morgen", "fiaon_kkb_termin_morgen", "fiaon_kk_aktiviert", "fiaon_kkb_aktiviert",
]);
export function waVorlageWerblich(name: string): boolean {
  return !WA_NICHT_WERBLICH.has(String(name || "").trim());
}

/**
 * Darf diesem Menschen gerade Werbung geschickt werden — egal auf welchem
 * Kanal (Mail außerhalb der Tür, WhatsApp-Vorlage, Verkaufstakt)? null = ja.
 * Werbesperre, Testkonto und „gekündigt ohne laufendes Paket" sagen nein; die
 * Vertriebssperre (is_blocked) ebenfalls — wer „kein Interesse" gesagt hat,
 * bekommt keinen Verkauf (Mara-Aktion und WhatsApp-Zentrale halten es schon so).
 * E-253 (28.09.2026): Für den MENSCHEN immer mit menschSperre füttern — dort ist
 * die Vertriebssperre die des Kopfes, nie die Wegweiser-Marke einer Dublette,
 * und nur dort steht das „Stopp" aus WhatsApp und Postfach.
 */
export function werbungVerboten(s: PersonSperre | null): string | null {
  if (!s) return null;
  if (s.werbesperre) return "Werbesperre";
  // E-253 (Nachtrag): „keine Nachrichten mehr" — auf WhatsApp oder als Antwort ans Postfach (nur menschSperre kennt es).
  if (s.stopp) return "„Stopp“ (will keine Nachrichten mehr)";
  if (s.test) return "Testkonto";
  if (s.vertriebssperre) return "Vertriebssperre";
  if (!s.laufendUngekuendigt && (s.gekuendigt || s.vertragVorbei)) return "gekündigt oder Vertrag beendet";
  return null;
}
