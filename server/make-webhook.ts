// ═══════════════════════════════════════════════════════════════════
// Make.com Webhook-Versand — löst dort automatisierte E-Mails aus.
// Die Plattform versendet für diese Ereignisse KEINE E-Mails direkt.
// Events: welcome | payment_details | followup_48h
// Siehe MIGRATION_INVENTORY.md
// ═══════════════════════════════════════════════════════════════════

import postgres from "postgres";

// WICHTIG: Jeder neue Event-Typ MUSS zusätzlich in die Registry
// (server/make-events-registry.ts) eingetragen werden — sie ist die
// Quelle für die Event-Test-Konsole /admin/events (Paket T).
export type MakeEventType =
  | "welcome"
  | "payment_details"
  | "followup_48h" // deprecated — ersetzt durch payment_reminder (Paket V)
  | "payment_reminder"
  | "claim_received"
  | "payment_confirmed"
  | "agent_payment_reminder"
  | "agent_invite"
  | "agent_password_reset"
  | "agent_payout_done"
  | "agent_payout_rejected"
  | "agent_callback_reminder"
  // Erinnerung an fehlende Bankdaten (20.08.2026): Ohne IBAN kann der Betreiber
  // nicht ueberweisen — und der Mensch wartet auf sein Geld, ohne zu wissen warum.
  | "agent_bank_reminder"
  | "agent_feedback_rewarded"
  | "agent_feedback_reply"
  | "lead_followup"
  | "lead_application_link"
  | "number_update_request" // #23: Kunde/Lead aktualisiert Telefonnummer selbst
  | "abo_payment_reminder"  // monatliche Paketrate fällig (Abo) — Stufen 1–3
  | "aufgabe_zugewiesen"    // Vorgesetzter weist einem Mitarbeiter eine Aufgabe zu
  // ── Lead-Pipeline und Terminsystem ────────────────────────────────────────
  | "nicht_erreicht_termin"  // 2× nicht erreicht → Kunde bucht selbst einen Termin
  | "termin_bestaetigung"    // Termin gebucht — mit Storno-Link
  | "termin_absage"          // Mitarbeiter hat abgesagt — Kunde erhaelt Bescheid + Neu-Buchen-Link
  | "termin_erinnerung"      // 24 h vor dem Termin
  // ── NEU 24.08.2026: der No-Show bekommt eine Antwort ──────────────────────
  // VORHER: Wurde ein Startgespraech als „verpasst" gemeldet, bekam der Kunde
  //   GAR NICHTS. Die Automatik aus fiaon-nicht-erreicht.ts schreibt erst ab
  //   dem sechsten erfolglosen Versuch, und der Lauf `runStartgespraechEin-
  //   ladungen` schickt fruehestens nach 48 Stunden wieder die generische
  //   Einladung — deren Text so klingt, als waere nie ein Termin gewesen.
  // NACHHER: Dieses Ereignis feuert SOFORT beim Melden, mit eigenem, ruhigem
  //   Text und dem Link auf einen neuen Termin.
  // GRUND: Auftrag des Inhabers vom 24.08.2026 — „wenn man ‚Kunde nicht
  //   erreicht' klickt muss der Kunde eine Email bekommen … hier neuen Termin
  //   buchen".
  | "termin_verpasst"        // Startgespraech nicht zustande gekommen — neuer Terminlink
  | "sepa_einrichten"        // Bitte, die Lastschrift fuer die Folgeraten einzurichten
  // NEU 24.08.2026: Der Weg zum Girokonto beim Kooperationspartner (DKB) —
  // Voraussetzung fuer die Kreditkarte. Nur nach bestandener Pruefung aller
  // drei Bedingungen aus fiaon-konto-karte.ts. Wortwahl bindend: NIE
  // "Affiliate", immer Kooperationspartner.
  | "konto_karte_einladung"  // Girokonto beim Kooperationspartner, dann Kreditkarte
  | "onboarding_einladung"   // bezahlter Kunde soll sein Startgespraech buchen
  | "antrag_erinnerung"      // Antrag begonnen, nicht beendet — Kette nach E-023 (10 min, 16:30, 19:00, 07:30, 15:00 …)
  | "abo_verlaengerung_frage" // 12. Rate bezahlt — „Möchten Sie bleiben?" (E-024)
  // ── Registriert für /admin/events (Vorgesetzter kann testen + Make-Zweig bauen).
  //    NOCH KEIN automatischer Versand im Code verdrahtet (Empfehlung, Teil 1.3):
  | "payment_cancelled"       // Bestellung storniert
  | "payment_reactivated"     // abgelaufene Bestellung reaktiviert (neue Frist)
  | "documents_change_request"// Dokumente-Änderung angefordert (changes_requested)
  | "schufa_approved"         // SCHUFA genehmigt
  | "schufa_rejected"         // SCHUFA abgelehnt
  | "schufa_requested"        // neues SCHUFA-Dokument angefordert
  | "account_suspended"       // Konto gesperrt
  | "account_activated"       // Konto aktiviert
  | "profile_query"           // Profil-Rückfrage an den Kunden
  | "gdpr_deleted"            // Löschbestätigung (DSGVO)
  | "contract_signed"         // Agent hat den Handelsvertretervertrag digital signiert (Prompt 2 D)
  | "commission_statement_issued"; // Provisions-Abrechnung/Gutschrift erzeugt (Prompt 2 E)

export interface MakeWebhookPayload {
  email: string;
  vorname?: string | null;
  nachname?: string | null;
  antrag_id?: string;
  payment_reference?: string | null;
  betrag?: string | null;
  paket?: string | null;
  [key: string]: unknown;
}

// P5: Diagnose-Bridge — lazy import, non-blocking, wirft nie (kein Zyklus,
// Maskierung passiert im Diagnose-Modul serverseitig vor Speicherung).
function reportDiag(e: { severity: "kritisch" | "warnung" | "info"; code: string; message: string; hint?: string; ref?: string | null }): void {
  import("./lib/fiaon-diagnostics")
    .then((d) => d.logDiagnostic({
      severity: e.severity, category: "email_make", code: e.code, message: e.message, hint: e.hint,
      link: e.ref ? `/admin/zahlungen?ref=${encodeURIComponent(String(e.ref))}` : undefined,
      action: e.ref ? { kind: "resend_event", label: "Event erneut senden", ref: String(e.ref) } : null,
    }))
    .catch((e) => console.error("[MAKE] Diagnose-Eintrag zum Mailfehler nicht geschrieben "
      + "— der Fehler bleibt damit unsichtbar in /admin/events:", e));
}

/** Ergebnis eines Versands — mit Grund, falls er nicht geklappt hat. */
export interface MakeVersand {
  ok: boolean;
  /** Klartext für die Oberfläche, z. B. „HTTP 400 von Make" oder „Zeitüberschreitung". */
  grund?: string;
  /** Beim Direktversand: die Annahme-Kennung von Brevo — die erste echte Zustellspur. */
  brevoMessageId?: string | null;
}

// ── DER VERSANDWEG-SCHALTER (28.08.2026) ────────────────────────────────────
// `mail_versandweg` in fiaon_settings entscheidet, was HINTER dieser Tür
// passiert: „make" (Webhook wie bisher) oder „direkt" (der Mail-Motor rendert
// die Quelltext-Vorlage und sendet über Brevo). `mail_direkt_ausnahmen` ist
// eine Kommaliste von Ereignissen, die trotz „direkt" weiter über Make laufen
// — die Rückzugslinie, falls EINE Vorlage klemmt, ohne alles umzuschalten.
// 60 Sekunden Cache: Der Schalter liegt an einem Pfad, den 26.000 Mails im
// Monat nehmen; er darf keine eigene Datenbanklast erzeugen.
let versandwegCache: { wert: { weg: string; ausnahmen: Set<string> }; bis: number } | null = null;

async function versandwegLesen(): Promise<{ weg: string; ausnahmen: Set<string> }> {
  if (versandwegCache && Date.now() < versandwegCache.bis) return versandwegCache.wert;
  let wert = { weg: "make", ausnahmen: new Set<string>() };
  try {
    if (process.env.DATABASE_URL) {
      if (!diagPool) diagPool = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
      const rows = await diagPool`
        SELECT key, value FROM fiaon_settings
        WHERE key IN ('mail_versandweg', 'mail_direkt_ausnahmen')
      `;
      const map = Object.fromEntries(rows.map((r: any) => [r.key, String(r.value ?? "")]));
      wert = {
        weg: map.mail_versandweg === "direkt" ? "direkt" : "make",
        ausnahmen: new Set(String(map.mail_direkt_ausnahmen || "").split(",").map((s) => s.trim()).filter(Boolean)),
      };
    }
  } catch {
    // Ohne Datenbank gilt der sichere Standard: der bewährte Make-Weg.
  }
  versandwegCache = { wert, bis: Date.now() + 60_000 };
  return wert;
}

/** Für die Steuerzentrale: Schalter-Änderung sofort wirksam machen. */
export function versandwegCacheLeeren(): void { versandwegCache = null; }

/**
 * Sendet einen Webhook an Make.com (URL aus env MAKE_WEBHOOK_URL).
 * Fehler blockieren NIEMALS den Nutzer-/Zahlungsflow — sie werden nur geloggt.
 *
 * Diese Variante gibt den GRUND zurück. Gebraucht überall, wo ein Fehlschlag
 * Folgen hat: Die Abo-Mahnstufe darf nur fortschreiten, wenn die Mail wirklich
 * rausging — sonst landet ein Kunde nach 14 Tagen auf „Entscheidung nötig",
 * ohne je eine Erinnerung bekommen zu haben.
 */
export async function sendMakeWebhookMitGrund(eventType: MakeEventType, payload: MakeWebhookPayload): Promise<MakeVersand> {
  // ── DIE ADRESSE KOMMT VON DER PERSON, NICHT VON DER BESTELLZEILE ────────
  // Siehe server/lib/fiaon-empfaenger.ts. Die Auflösung steht HIER, an der
  // einen Tür, durch die jeder Versand muss — und nicht in den 29
  // Aufrufstellen, von denen man beim nächsten Umbau eine vergisst.
  //
  // Zwei Dinge passieren dabei:
  //   1. Eine leere oder schlechtere Adresse wird durch die bessere ersetzt.
  //   2. Ist ÜBERHAUPT keine Adresse auffindbar, geht nichts raus — und der
  //      Fehlschlag steht mit Grund im Protokoll. Vorher wurde `email: ""`
  //      an Make geschickt, Make antwortete 200, und die Mail verschwand
  //      lautlos. Das ist der gemeldete Fall „viele bekommen keine Mail".
  const aufgeloest = await adresseBestimmen(payload);
  if (!aufgeloest.email) {
    const erg: MakeVersand = { ok: false, grund: aufgeloest.grund! };
    protokollNebenbei(eventType, payload, erg);
    console.warn(`[MAKE-WEBHOOK] '${eventType}' NICHT gesendet: ${aufgeloest.grund}`);
    return erg;
  }
  if (aufgeloest.email !== payload.email) {
    payload = { ...payload, email: aufgeloest.email, empfaenger_quelle: aufgeloest.quelle };
  }
  // ── DER SCHALTER: MAKE ODER DIREKT ──────────────────────────────────────
  // „direkt" nur, wenn der Motor das Ereignis kennt UND es nicht auf der
  // Ausnahmenliste steht. Alles andere nimmt weiter den bewährten Make-Weg —
  // ein unbekanntes neues Ereignis fällt also nie ins Leere.
  let erg: MakeVersand;
  const schalter = await versandwegLesen();
  if (schalter.weg === "direkt" && !schalter.ausnahmen.has(eventType)) {
    const motor = await import("./mail/motor");
    if (motor.hatVorlage(eventType)) {
      const d = await motor.mailDirektSenden(eventType, payload as Record<string, unknown>);
      erg = d.ok
        ? { ok: true, grund: d.grund, brevoMessageId: d.messageId }
        : { ok: false, grund: `Direktversand: ${d.grund}` };
      if (d.ok) {
        console.log(`[MAIL-DIREKT] '${eventType}' über Brevo gesendet (${payload.antrag_id ?? ""}, ${d.messageId ?? "ohne Id"})`);
        recordLastSent(eventType);
      } else {
        console.error(`[MAIL-DIREKT] '${eventType}' fehlgeschlagen: ${d.grund}`);
        reportDiag({
          severity: "kritisch",
          code: "mail_direkt_fehler",
          message: `Direktversand für '${eventType}' fehlgeschlagen — Empfänger ${payload.email || "?"}: ${d.grund}`,
          hint: "Prüfe /chef/s/mailwerk (Vorlage vorhanden? Brevo-Schlüssel gültig?). Notbremse: mail_versandweg auf 'make' stellen.",
          ref: payload.payment_reference || payload.antrag_id,
        });
      }
    } else {
      erg = await webhookRoh(eventType, payload);
    }
  } else {
    erg = await webhookRoh(eventType, payload);
  }
  // ── JEDE MAIL STEHT IM PROTOKOLL ────────────────────────────────────────
  // Vor dem 09.08.2026 protokollierten nur sieben von 29 Sendestellen. Der
  // Rest ging unbeobachtet raus, und wenn ein Kunde sagte „ich habe nichts
  // bekommen", suchte der Vorgesetzte im Make-Protokoll.
  //
  // Die Alternative wäre gewesen, 29 Aufrufstellen umzubauen — darunter
  // Zahlungswege, die seit Monaten laufen. Der Eintrag steht deshalb HIER, an
  // der einen Stelle, durch die alle müssen. Damit ist die Regel „kein
  // Versand am Protokoll vorbei" keine Verabredung mehr, sondern Bauart.
  //
  // `fireAndForget`: Ein klemmendes Protokoll darf keine Mail verhindern.
  protokollNebenbei(eventType, payload, erg);
  return erg;
}

/**
 * Bestimmt die Zieladresse einer Nutzlast über die Person.
 *
 * Wirft nie und blockiert nie: Ist die Datenbank nicht erreichbar, gilt die
 * Adresse aus der Nutzlast. Eine Auflösung, die den Versand verhindern kann,
 * wäre schlimmer als die alte Rangfolge.
 *
 * `test: true` (Prüfversand aus /admin/events) wird durchgereicht — dort ist
 * die Adresse ausdrücklich vom Menschen gewählt und darf nicht überschrieben
 * werden.
 */
async function adresseBestimmen(
  payload: MakeWebhookPayload,
): Promise<{ email: string | null; quelle?: string; grund?: string }> {
  const roh = String(payload.email ?? "").trim();
  if (payload.test) return { email: roh || null, quelle: "test", grund: roh ? undefined : "Prüfversand ohne Testadresse." };
  try {
    if (!process.env.DATABASE_URL) return { email: roh || null, quelle: "nutzlast" };
    const { empfaengerAufloesen } = await import("./lib/fiaon-empfaenger");
    const personId = payload.person_id != null ? Number(payload.person_id) : null;
    const ref = payload.antrag_id ? String(payload.antrag_id) : null;
    const treffer = await empfaengerAufloesen({ personId, ref, ausNutzlast: roh });
    if (treffer) return { email: treffer.email, quelle: treffer.quelle };
    return {
      email: null,
      grund: "Keine zustellbare E-Mail-Adresse — weder an der Person, noch als Alias, noch an der Bestellung.",
    };
  } catch (err) {
    console.warn("[MAKE-WEBHOOK] Empfänger-Auflösung nicht möglich:",
      err instanceof Error ? err.message : err);
    return { email: roh || null, quelle: "nutzlast" };
  }
}

/** Der eigentliche Aufruf — ohne Protokoll, damit dieses ihn umschließen kann. */
async function webhookRoh(eventType: MakeEventType, payload: MakeWebhookPayload): Promise<MakeVersand> {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn(`[MAKE-WEBHOOK] MAKE_WEBHOOK_URL nicht gesetzt — Event '${eventType}' (${payload.antrag_id}) übersprungen`);
    return { ok: false, grund: "MAKE_WEBHOOK_URL ist nicht gesetzt — es kann keine Mail rausgehen." };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[MAKE-WEBHOOK] '${eventType}' (${payload.antrag_id}) → HTTP ${res.status}`);
      // P5: strukturiertes Diagnose-Ereignis (non-blocking, ändert den Flow nicht).
      reportDiag({
        severity: res.status >= 500 ? "kritisch" : "warnung",
        code: "make_webhook_http",
        message: `Make-Webhook für Event '${eventType}' abgelehnt (HTTP ${res.status}) — Empfänger ${payload.email || "?"}${payload.payment_reference ? `, Ref ${payload.payment_reference}` : ""}.`,
        hint: "Prüfe das Make-Szenario (aktiv? Webhook erreichbar?) und ob die Payload-Struktur des Events dort bekannt ist (E-Mail-Events → Test senden).",
        ref: payload.payment_reference || payload.antrag_id,
      });
      return { ok: false, grund: `Make hat abgelehnt (HTTP ${res.status}) — Szenario aktiv? Event-Zweig vorhanden?` };
    }
    console.log(`[MAKE-WEBHOOK] '${eventType}' gesendet (${payload.antrag_id}${payload.payment_reference ? `, ${payload.payment_reference}` : ""})`);
    recordLastSent(eventType);
    return { ok: true };
  } catch (err) {
    console.error(`[MAKE-WEBHOOK] '${eventType}' (${payload.antrag_id}) fehlgeschlagen:`, err instanceof Error ? err.message : err);
    reportDiag({
      severity: "kritisch",
      code: "make_webhook_error",
      message: `Make-Webhook für Event '${eventType}' nicht erreichbar: ${err instanceof Error ? err.message : String(err)} — Empfänger ${payload.email || "?"}.`,
      hint: "Netzwerk-/Timeout-Problem zu Make. Läuft das Szenario? Ist MAKE_WEBHOOK_URL korrekt? Kunde-Mail ggf. über E-Mail-Events erneut senden.",
      ref: payload.payment_reference || payload.antrag_id,
    });
    return {
      ok: false,
      grund: `Make nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** Kurzform für alle Aufrufer, die nur wissen müssen, ob es geklappt hat. */
export async function sendMakeWebhook(eventType: MakeEventType, payload: MakeWebhookPayload): Promise<boolean> {
  return (await sendMakeWebhookMitGrund(eventType, payload)).ok;
}

// ── Diagnose: letzter erfolgreicher Versand je Event-Typ ─────────────────────
// Für /admin/einstellungen (System-Status). Fire-and-forget, blockiert nie.
// Kein Import aus fiaon-agent.ts (Zyklus) — eigener Lazy-Pool.
let diagPool: ReturnType<typeof postgres> | null = null;

function recordLastSent(eventType: MakeEventType): void {
  (async () => {
    try {
      if (!process.env.DATABASE_URL) return;
      if (!diagPool) diagPool = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
      const rows = await diagPool`SELECT value FROM fiaon_settings WHERE key = 'make_last_events'`;
      const map = rows[0] ? JSON.parse(rows[0].value) : {};
      map[eventType] = new Date().toISOString();
      const value = JSON.stringify(map);
      await diagPool`
        INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('make_last_events', ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
      `;
    } catch (err) {
      // Diagnose darf niemals den Versand stören — nur leise loggen
      console.warn(`[MAKE-WEBHOOK] Diagnose-Write fehlgeschlagen:`, err instanceof Error ? err.message : err);
    }
  })();
}

/** Baut den Standard-Payload aus einer fiaon_applications-Zeile. */
export function makePayloadFromRow(row: any): MakeWebhookPayload {
  const contactParts = (row.contact_name || "").split(" ");
  return {
    // Die Adresse hier ist nur ein VORSCHLAG. Wer wirklich angeschrieben
    // wird, entscheidet `adresseBestimmen` über die Person — siehe oben.
    // `person_id` mitzugeben ist deshalb keine Zierde, sondern die
    // Voraussetzung dafür, dass die Auflösung den Menschen findet.
    person_id: row.person_id != null ? Number(row.person_id) : null,
    email: row.email || row.contact_email || row.billing_email || "",
    vorname: row.first_name || contactParts[0] || null,
    nachname: row.last_name || (contactParts.length > 1 ? contactParts.slice(1).join(" ") : null),
    antrag_id: row.ref,
    payment_reference: row.payment_reference || null,
    betrag: row.amount_due != null ? String(row.amount_due) : null,
    paket: row.pack_name ? String(row.pack_name).replace(/\n/g, " ") : null,
  };
}


// ═══════════════════════════════════════════════════════════════════════════
// PROTOKOLL — nebenbei, aber lückenlos
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trägt jeden Versand in `fiaon_mail_log` ein.
 *
 * DOPPELTE EINTRÄGE VERMEIDEN: `versendenUndProtokollieren` schreibt selbst
 * und setzt dafür kurz eine Marke. Sieht dieser Helfer die Marke, hält er
 * still — sonst stünde jede Mail aus dem Versandzentrum zweimal da.
 */
function protokollNebenbei(eventType: MakeEventType, payload: MakeWebhookPayload, erg: MakeVersand): void {
  if (protokolliertSelbst.has(eventType)) return;
  (async () => {
    try {
      if (!process.env.DATABASE_URL) return;
      const { mailProtokoll } = await import("./lib/fiaon-mail-log");
      await mailProtokoll({
        event: eventType,
        // Ohne person_id ist ein Protokolleintrag nicht auffindbar: Die Akte
        // filtert danach, und die Zustellkarte verlinkt darauf.
        personId: payload.person_id != null ? Number(payload.person_id) : null,
        empfaenger: payload.email ? String(payload.email) : null,
        status: erg.ok ? "versandt" : "fehlgeschlagen",
        grund: erg.grund ?? null,
        payload: payload as Record<string, unknown>,
        brevoMessageId: erg.brevoMessageId ?? null,
      });
    } catch {
      // Ein Protokoll, das klemmt, darf den Versand nicht mitreißen.
    }
  })();
}

/**
 * Ereignisse, deren Aufrufer bereits selbst protokolliert.
 *
 * Die Marke wird von `versendenUndProtokollieren` für die Dauer des Aufrufs
 * gesetzt. Ein `Set` und kein Zähler: Zwei gleichzeitige Sendungen desselben
 * Ereignisses würden sich sonst gegenseitig die Marke wegnehmen.
 */
export const protokolliertSelbst = new Set<string>();
