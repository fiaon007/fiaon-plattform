// ═══════════════════════════════════════════════════════════════════════════
// EINE TÜR FÜR JEDE MAIL
//
// Vor diesem Paket gab es 25 Stellen, die `sendMakeWebhook` direkt riefen —
// ohne Protokoll, ohne Zustandsprüfung, ohne Tageslimit. Danach wusste
// niemand, was rausgegangen war: Der Vorgesetzte suchte im Make-Protokoll, der
// Agent riet.
//
// Diese Funktion ist die Tür. Sie prüft (darf das raus?), sie sendet, sie
// protokolliert, sie schreibt in die Akte, sie merkt sich den Auslöser. Wer
// an ihr vorbeisendet, sendet unbeobachtet — und der Prüfstand meldet es.
//
// Die REGELN stehen woanders und werden hier nur angewandt:
//   Was es gibt        server/lib/fiaon-mail-events.ts (Registry)
//   Wann es darf       server/lib/fiaon-versand.ts (Zustand, Tageslimit)
//   Wie protokolliert  server/lib/fiaon-mail-log.ts
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { mailEvent, type Rolle } from "./fiaon-mail-events";
import { versendenUndProtokollieren, type VersandStatus } from "./fiaon-mail-log";
import { versandErlaubt, type VersandArt } from "./fiaon-versand";
import { terminLink } from "./fiaon-termine";
import type { MakeEventType } from "../make-webhook";

type Lauf = typeof sqlPool;

export interface SendeErgebnis {
  ok: boolean;
  status: VersandStatus | "abgelehnt";
  grund: string | null;
  meldung: string;
}

export interface SendeEingabe {
  event: MakeEventType | string;
  /** Der Mensch, an den es geht. Fehlt er, ist es eine Mitarbeiter-Mail. */
  personId?: number | null;
  /** Zusätzliche oder überschreibende Felder für die Payload. */
  zusatz?: Record<string, unknown>;
  /** Wer sendet — für Rechteprüfung, Protokoll und Akte. */
  akteur: { name: string; agentId: number | null; rolle: Rolle };
  /** Prüfversand: geht an die Testadresse und zählt nicht gegen Limits. */
  test?: boolean;
  testAdresse?: string;
  lauf?: Lauf;
}

/**
 * Baut die Payload aus dem, was das Haus über den Kunden weiß.
 *
 * Bewusst hier und nicht in den 25 Aufrufern: Dort stand jedes Mal eine etwas
 * andere Zusammenstellung, und ein fehlendes Feld fiel erst auf, wenn eine
 * Mail beim Kunden mit „Hallo {{ params.vorname }}" ankam.
 */
async function payloadFuer(personId: number, lauf: Lauf): Promise<Record<string, unknown> | null> {
  const [p] = (await lauf`
    SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname, p.last_name AS nachname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS email,
           COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref,
           (SELECT a3.payment_reference FROM fiaon_applications a3
             WHERE a3.person_id = p.id AND a3.merged_into IS NULL AND a3.archived_at IS NULL
             ORDER BY a3.created_at DESC LIMIT 1) AS zahlungsreferenz,
           (SELECT a4.amount_due FROM fiaon_applications a4
             WHERE a4.person_id = p.id AND a4.merged_into IS NULL AND a4.archived_at IS NULL
             ORDER BY a4.created_at DESC LIMIT 1) AS betrag,
           (SELECT a5.pack_name FROM fiaon_applications a5
             WHERE a5.person_id = p.id AND a5.merged_into IS NULL AND a5.archived_at IS NULL
             ORDER BY a5.created_at DESC LIMIT 1) AS paket
    FROM fiaon_persons p LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `) as any[];
  if (!p) return null;
  return {
    email: String(p.email || ""),
    vorname: p.vorname || null,
    nachname: p.nachname || null,
    antrag_id: p.ref || undefined,
    payment_reference: p.zahlungsreferenz || null,
    betrag: p.betrag != null ? String(p.betrag) : null,
    paket: p.paket ? String(p.paket).split("\n")[0].trim() : null,
    agent_vorname: p.agent_vorname || "dein Ansprechpartner",
    _ref: p.ref || null,
  };
}

/**
 * Sendet eine Mail — der EINZIGE Weg im Haus.
 *
 * Wirft nie. Ein Versand, der einen Vorgang zum Absturz bringt, ist teurer als
 * eine Mail, die nicht rausgeht.
 */
export async function mailSenden(ein: SendeEingabe): Promise<SendeErgebnis> {
  const lauf = ein.lauf ?? sqlPool;
  const abgelehnt = (grund: string): SendeErgebnis =>
    ({ ok: false, status: "abgelehnt", grund, meldung: grund });

  const def = await mailEvent(String(ein.event), lauf);
  if (!def) return abgelehnt(`Unbekanntes Ereignis „${ein.event}“.`);
  if (def.deprecated) return abgelehnt(`„${def.label}“ ist abgelöst und wird nicht mehr versendet.`);
  if (!def.rollen.includes(ein.akteur.rolle)) {
    return abgelehnt(`Deine Rolle darf „${def.label}“ nicht senden.`);
  }

  // ── Prüfversand ────────────────────────────────────────────────────────
  // Geht an die Testadresse, prüft KEINEN Kundenzustand (es gibt keinen
  // Kunden) und zählt nicht gegen Tageslimits.
  if (ein.test) {
    const an = String(ein.testAdresse || "").trim();
    if (!an) return abgelehnt("Keine Testadresse hinterlegt.");
    const erg = await versendenUndProtokollieren(
      def.type as MakeEventType,
      { ...(def.example as Record<string, unknown>), ...(ein.zusatz || {}), email: an, test: true } as any,
      { personId: null, ausgeloestVon: ein.akteur.name, ausgeloestAgentId: ein.akteur.agentId, lauf },
    );
    await lauf`
      UPDATE fiaon_mail_log SET art = 'test'
      WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${def.type})
    `.catch((e) => console.error(`[MAIL] Testmarke fuer ${def.type} nicht gesetzt — die Sendung zaehlt damit als echt:`, e));
    return {
      ok: erg.status === "versandt", status: erg.status, grund: erg.grund,
      meldung: erg.status === "versandt" ? `Prüfversand an ${an} raus.` : `Prüfversand fehlgeschlagen: ${erg.grund}`,
    };
  }

  // ── Echter Versand ─────────────────────────────────────────────────────
  if (!ein.personId) return abgelehnt("Kein Empfänger angegeben.");

  // Die Zustandsregeln kennt fiaon-versand.ts. Ereignisse, die dort keine
  // eigene Regel haben, kommen durch — sie sind vom Vorgesetzten ausgelöste
  // Einzelfälle (Storno, DSGVO), bei denen der Mensch die Lage kennt.
  const mitRegel: VersandArt[] = [
    "payment_details", "welcome", "nicht_erreicht_termin", "onboarding_einladung", "number_update_request",
  ];
  if (mitRegel.includes(def.type as VersandArt)) {
    const pruefung = await versandErlaubt(ein.personId, def.type as VersandArt, lauf);
    if (!pruefung.erlaubt) return abgelehnt(pruefung.grund || "Nicht erlaubt.");
  }

  const basis = await payloadFuer(ein.personId, lauf);
  if (!basis) return abgelehnt("Kunde nicht gefunden.");
  if (!basis.email) return abgelehnt("Keine E-Mail-Adresse hinterlegt.");

  // Links, die nur der Server bauen kann.
  const links: Record<string, unknown> = {};
  if (def.type === "nicht_erreicht_termin") links.termin_link = terminLink(ein.personId);
  if (def.type === "onboarding_einladung") links.termin_link = terminLink(ein.personId, "onboarding_call");

  const ref = basis._ref as string | null;
  delete basis._ref;

  const erg = await versendenUndProtokollieren(
    def.type as MakeEventType,
    { ...basis, ...links, ...(ein.zusatz || {}) } as any,
    {
      personId: ein.personId,
      verlaufRef: ref,
      verlaufText: `${def.label} versandt${ein.akteur.agentId ? ` (von ${ein.akteur.name})` : ""}.`,
      ausgeloestVon: ein.akteur.name,
      ausgeloestAgentId: ein.akteur.agentId,
      lauf,
    },
  );
  return {
    ok: erg.status === "versandt",
    status: erg.status,
    grund: erg.grund,
    meldung: erg.status === "versandt"
      ? `„${def.label}“ an ${basis.email} verschickt.`
      : `Nicht verschickt: ${erg.grund}. Es steht mit Grund im Protokoll.`,
  };
}
