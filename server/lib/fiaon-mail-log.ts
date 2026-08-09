// ═══════════════════════════════════════════════════════════════════════════
// VERSANDPROTOKOLL — was rausging, was nicht, und warum nicht
//
// DAS PROBLEM, DAS DAS LÖST
// Der Make-Webhook ist ein `fetch` mit `.catch(() => {})`. Das ist richtig so:
// Eine Mail, die nicht rausgeht, darf keinen Antrag und kein Kontakt-Ergebnis
// scheitern lassen. Aber bisher war die Folge, dass ein nicht gesendeter
// Terminlink NIRGENDS auftauchte — nicht in der Akte, nicht in einer Liste.
// Der Agent sieht „Terminlink versandt" auf der Karte und ruft nicht mehr an,
// während der Kunde nie etwas bekommen hat.
//
// Deshalb wird jeder automatische Versand hier protokolliert, bevor und
// nachdem er versucht wurde. Drei Ausgänge, alle sichtbar:
//   versandt        Make hat angenommen.
//   fehlgeschlagen  Make war nicht erreichbar oder hat abgelehnt (mit Grund).
//   uebersprungen   Es gab nichts zu senden (keine E-Mail hinterlegt).
//
// Die Tabelle ist bewusst schmal (siehe Migration 041). Erweiterbar heißt:
// neue Spalten neben `payload`, keine zweite Tabelle.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { sendMakeWebhookMitGrund, type MakeEventType, type MakeWebhookPayload } from "../make-webhook";

type Lauf = typeof sqlPool;

export type VersandStatus = "versandt" | "fehlgeschlagen" | "ausstehend" | "uebersprungen";

export interface VersandErgebnis {
  status: VersandStatus;
  grund: string | null;
}

/**
 * Schreibt eine Zeile ins Versandprotokoll. Wirft NIE — ein Protokoll, das den
 * protokollierten Vorgang zum Scheitern bringt, ist schlimmer als keines.
 */
export async function mailProtokoll(
  eintrag: {
    event: string;
    personId?: number | null;
    empfaenger?: string | null;
    status: VersandStatus;
    grund?: string | null;
    payload?: Record<string, unknown> | null;
    ausgeloestVon?: string | null;
    ausgeloestAgentId?: number | null;
  },
  lauf: Lauf = sqlPool,
): Promise<void> {
  try {
    await lauf`
      INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, grund, payload,
                                  ausgeloest_von, ausgeloest_agent_id)
      VALUES (${eintrag.event}, ${eintrag.personId ?? null}, ${eintrag.empfaenger ?? null},
              ${eintrag.status}, ${eintrag.grund ?? null},
              ${eintrag.payload ? JSON.stringify(eintrag.payload) : null}::jsonb,
              ${eintrag.ausgeloestVon ?? null}, ${eintrag.ausgeloestAgentId ?? null})
    `;
  } catch (err) {
    console.error("[MAIL-LOG] konnte nicht protokollieren:", err instanceof Error ? err.message : err);
  }
}

/**
 * Versendet ein Make-Event UND protokolliert es. Der eine Weg, den jede
 * Automatik dieses Pakets nimmt.
 *
 * Wirft nie. Fehlt die Make-Route noch (das ist beim Einführen neuer Events
 * der Normalfall), steht danach „fehlgeschlagen" mit Grund im Protokoll und
 * im Kundenverlauf — der Vorgang selbst läuft weiter.
 */
export async function versendenUndProtokollieren(
  event: MakeEventType,
  payload: MakeWebhookPayload,
  opts: {
    personId?: number | null; verlaufRef?: string | null; verlaufText?: string | null;
    /**
     * Läuft der Aufruf in einer Transaktion, MUSS sie hier durchgereicht
     * werden. Sonst schreibt das Protokoll am Vorgang vorbei — im Prüfstand
     * überlebten dadurch fünf Zeilen den Rollback, und in einer echten
     * Transaktion, die scheitert, stünde „versandt" für etwas, das nie
     * stattgefunden hat.
     */
    lauf?: Lauf;
    /** Wer den Versand von Hand ausgelöst hat. Leer heißt: eine Automatik. */
    ausgeloestVon?: string | null;
    ausgeloestAgentId?: number | null;
  } = {},
): Promise<VersandErgebnis> {
  const lauf = opts.lauf ?? sqlPool;
  if (!payload.email) {
    await mailProtokoll({
      event, personId: opts.personId, empfaenger: null,
      status: "uebersprungen", grund: "Keine E-Mail-Adresse hinterlegt",
      payload: payload as Record<string, unknown>,
      ausgeloestVon: opts.ausgeloestVon, ausgeloestAgentId: opts.ausgeloestAgentId,
    }, lauf);
    return { status: "uebersprungen", grund: "Keine E-Mail-Adresse hinterlegt" };
  }

  let status: VersandStatus = "fehlgeschlagen";
  let grund: string | null = null;
  try {
    // Marke setzen: Der Webhook protokolliert seit dem 09.08.2026 selbst
    // (make-webhook.ts). Hier schreiben wir aber gleich einen vollständigeren
    // Eintrag — mit Person, Auslöser und Verlaufsbezug. Ohne die Marke stünde
    // jede Mail aus dem Versandzentrum zweimal im Protokoll.
    const { protokolliertSelbst } = await import("../make-webhook");
    protokolliertSelbst.add(event);
    try {
      const versand = await sendMakeWebhookMitGrund(event, payload);
      status = versand.ok ? "versandt" : "fehlgeschlagen";
      grund = versand.ok ? null : (versand.grund ?? "unbekannt");
    } finally {
      protokolliertSelbst.delete(event);
    }
  } catch (err) {
    // sendMakeWebhookMitGrund fängt eigentlich alles selbst ab. Dieser Block
    // ist die Zusicherung, dass ein neuer Fehlerweg dort hier nicht durchschlägt.
    grund = err instanceof Error ? err.message : String(err);
  }

  await mailProtokoll({
    event, personId: opts.personId, empfaenger: String(payload.email),
    status, grund, payload: payload as Record<string, unknown>,
    ausgeloestVon: opts.ausgeloestVon, ausgeloestAgentId: opts.ausgeloestAgentId,
  }, lauf);

  // In den Kundenverlauf, damit der Agent es dort sieht, wo er ohnehin liest.
  if (opts.verlaufRef && opts.verlaufText) {
    const text = status === "versandt"
      ? opts.verlaufText
      : `${opts.verlaufText} — VERSAND FEHLGESCHLAGEN (${grund ?? "unbekannt"}). Der Kunde hat nichts erhalten.`;
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${opts.verlaufRef}, NULL, 'System', 'system', ${text}, NOW())
    `.catch(() => {});
  }

  return { status, grund };
}
