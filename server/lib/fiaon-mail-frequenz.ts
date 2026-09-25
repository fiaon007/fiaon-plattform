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
import { istAboPaket } from "@shared/fiaon-pakete";

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
]);

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
    const gesperrt = await werbesperreAnAdresse(adresse);
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
 */
export async function werbesperreAnAdresse(adresse: string): Promise<boolean> {
  const a = String(adresse || "").trim().toLowerCase();
  if (!a) return false;
  const [g] = (await sqlPool`
    SELECT 1 AS g FROM fiaon_persons p
     WHERE p.werbung_gesperrt_am IS NOT NULL
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
  const jetzt = Date.now();
  const hinweisAb = new Date(WIDERSPRUCH_HINWEIS_SEIT).getTime();
  return zeilen.map((z) => {
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
    };
  });
}

/** Der Stand eines Menschen — null, wenn es ihn nicht gibt. */
export async function personSperre(personId: number): Promise<PersonSperre | null> {
  return (await personSperren([personId]))[0] ?? null;
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
 *    Stichtag-Grenze — wer dann in Frage kommt (Segment A/B/C ohne Sperre),
 *    entscheidet die Tür davor (angebotTuerSperre, fiaon-auskunft-verkauf.ts,
 *    dieselbe Grundmenge wie der Takt). Werbesperre, Test und Kündigung
 *    sperren hier in JEDEM Kreis.
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
 */
export function werbungVerboten(s: PersonSperre | null): string | null {
  if (!s) return null;
  if (s.werbesperre) return "Werbesperre";
  if (s.test) return "Testkonto";
  if (s.vertriebssperre) return "Vertriebssperre";
  if (!s.laufendUngekuendigt && (s.gekuendigt || s.vertragVorbei)) return "gekündigt oder Vertrag beendet";
  return null;
}
