// ═══════════════════════════════════════════════════════════════════════════
// NICHT-ERREICHT-AUTOMATIK — Schluss mit dem fünften Anruf
//
// DER BEFUND AUS DEM BESTAND (08.08.2026)
// 258 Personen mit mindestens einem erfolglosen Versuch, davon 36 mit VIER
// oder mehr — einer mit acht. Acht Anrufe an dieselbe Nummer, ohne dass je
// jemand abgehoben hat. Das ist kein Fleiß, das ist eine Endlosschleife: Der
// Zähler `unreachable_count` wurde hochgezählt und danach nie wieder gelesen.
// Er wurde nicht einmal zurückgesetzt, wenn der Kunde später ans Telefon ging.
//
// DIE ZWEI SCHWELLEN
//   Nach dem 2. Versuch   Terminlink-Mail. Der Kunde sucht sich selbst eine
//                         Uhrzeit — meistens ist er nicht desinteressiert,
//                         sondern bei der Arbeit. GENAU EINMAL je 30 Tage.
//   Nach dem 4. Versuch   Ruhe-Pool: Wiedervorlage +14 Tage, raus aus der
//                         Tagesliste. NICHT gesperrt, nicht gelöscht, Stufe
//                         bleibt. Der Kunde kommt wieder — mit Vorgeschichte
//                         auf der Karte.
//
// WARUM STUFE A AUSGENOMMEN IST
// Ein Kunde, der „ich habe bezahlt" gemeldet hat, hat Geld im Spiel. Der darf
// nicht in einen Ruhe-Pool rutschen, nur weil er zufällig viermal nicht
// abgehoben hat — da muss ein Beleg her. Er bekommt die Terminlink-Mail
// (die hilft ihm auch), aber er bleibt in der Tagesliste.
//
// WAS DEN ZÄHLER ZURÜCKSETZT
// Jedes `erreicht_*`, jede Terminbuchung. Sonst schleppt ein Kunde, der vor
// drei Monaten zweimal nicht dranging, diese Vorgeschichte für immer mit sich
// herum und landet beim nächsten Fehlversuch sofort im Ruhe-Pool.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { terminLink } from "./fiaon-termine";
import { versendenUndProtokollieren, type VersandStatus } from "./fiaon-mail-log";

type Lauf = typeof sqlPool;

/** Nach so vielen erfolglosen Versuchen geht der Terminlink raus. */
export const SCHWELLE_MAIL = 2;
/** Nach so vielen erfolglosen Versuchen beginnt die Ruhe. */
export const SCHWELLE_RUHE = 4;
/** So lange ruht ein Fall. */
export const RUHE_TAGE = 14;
/** Frühestens so viele Tage nach der letzten Terminlink-Mail wieder eine. */
export const MAIL_SPERRE_TAGE = 30;

export interface AutomatikWirkung {
  /** Wurde eine Terminlink-Mail versendet (oder versucht)? */
  mail: VersandStatus | null;
  /** Ist die Person jetzt im Ruhe-Pool? */
  ruht: boolean;
  /** Neue Wiedervorlage, falls die Automatik sie verschoben hat. */
  wiedervorlage: string | null;
  /** Klartext für die Rückmeldung an den Agenten. Leer, wenn nichts geschah. */
  hinweis: string | null;
}

const LEER: AutomatikWirkung = { mail: null, ruht: false, wiedervorlage: null, hinweis: null };

function tagPlus(n: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Wird nach jedem erfolglosen Kontaktversuch aufgerufen — NACHDEM der Zähler
 * erhöht wurde. Liest den Stand und wendet die beiden Schwellen an.
 *
 * Wirft nie: Eine Automatik, die das Dokumentieren eines Anrufs scheitern
 * lässt, kostet mehr als sie bringt.
 */
export async function automatikNachFehlversuch(
  personId: number, lauf: Lauf = sqlPool,
): Promise<AutomatikWirkung> {
  try {
    const [p] = (await lauf`
      SELECT p.id, p.unreachable_count, p.priority_tier, p.is_blocked, p.ruhe_seit,
             p.terminlink_mail_am, p.assigned_agent_id,
             COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
             p.last_name AS nachname,
             COALESCE(NULLIF(p.primary_email, ''), (
               SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
               FROM fiaon_applications a
               WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
               ORDER BY a.created_at DESC LIMIT 1
             )) AS email,
             COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname,
             (SELECT a2.ref FROM fiaon_applications a2
               WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
               ORDER BY a2.created_at DESC LIMIT 1) AS ref
      FROM fiaon_persons p
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
    `) as any[];
    if (!p) return LEER;

    const versuche = Number(p.unreachable_count || 0);
    const wirkung: AutomatikWirkung = { ...LEER };

    // ── Schwelle 1: der Terminlink ──────────────────────────────────────────
    // „Genau einmal je 30 Tage" gilt ab dem 2. Versuch — auch beim 3., 5. und
    // 8. wird nicht erneut gesendet, solange die Sperre läuft. Ein Kunde, der
    // bei jedem Fehlversuch eine Mail bekommt, meldet uns als Spam.
    const sperreLaeuft = p.terminlink_mail_am
      && Date.now() - new Date(p.terminlink_mail_am).getTime() < MAIL_SPERRE_TAGE * 86_400_000;
    if (versuche >= SCHWELLE_MAIL && !sperreLaeuft && !p.is_blocked) {
      const agentVorname = String(p.agent_vorname || "Ihr Ansprechpartner");
      const ergebnis = await versendenUndProtokollieren(
        "nicht_erreicht_termin",
        {
          email: String(p.email || ""),
          vorname: p.vorname || null,
          nachname: p.nachname || null,
          agent_vorname: agentVorname,
          termin_link: terminLink(personId),
        },
        {
          personId,
          verlaufRef: p.ref || null,
          verlaufText: `Terminlink-Mail versandt (${versuche}× nicht erreicht). Der Kunde kann selbst eine Uhrzeit wählen.`,
          lauf,
        },
      );
      wirkung.mail = ergebnis.status;
      // Der Zeitstempel wird auch bei Fehlschlag gesetzt — sonst versucht es
      // jeder weitere Fehlversuch erneut und das Protokoll füllt sich mit
      // derselben Fehlermeldung. Der Fehlschlag steht sichtbar in der Akte.
      if (ergebnis.status !== "uebersprungen") {
        await lauf`UPDATE fiaon_persons SET terminlink_mail_am = NOW() WHERE id = ${personId}`;
      }
      wirkung.hinweis = ergebnis.status === "versandt"
        ? `Terminlink an den Kunden versandt — er wählt jetzt selbst eine Uhrzeit.`
        : ergebnis.status === "uebersprungen"
          ? `Keine E-Mail hinterlegt — schick ihm den Terminlink über den Knopf auf der Karte.`
          : `Terminlink konnte NICHT versendet werden (${ergebnis.grund}). Bitte den Link von Hand schicken.`;
    }

    // ── Schwelle 2: der Ruhe-Pool ───────────────────────────────────────────
    // Stufe A bleibt draußen: Dort hängt eine gemeldete Zahlung dran, die
    // jemand verifizieren muss. Alles andere ruht 14 Tage.
    const istStufeA = Number(p.priority_tier) === 1;
    if (versuche >= SCHWELLE_RUHE && !istStufeA && !p.ruhe_seit) {
      const bis = tagPlus(RUHE_TAGE);
      await lauf`
        UPDATE fiaon_persons SET ruhe_seit = NOW(), follow_up_date = ${bis}::date, updated_at = NOW()
        WHERE id = ${personId}
      `;
      wirkung.ruht = true;
      wirkung.wiedervorlage = bis;
      wirkung.hinweis = [wirkung.hinweis, `${versuche}× nicht erreicht — der Fall ruht jetzt ${RUHE_TAGE} Tage und ist am ${bis} wieder dran.`]
        .filter(Boolean).join(" ");
      if (p.ref) {
        await lauf`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
          VALUES (${p.ref}, NULL, 'System', 'system',
                  ${`Ruhe-Pool: ${versuche}× nicht erreicht. Wiedervorlage auf ${bis} gesetzt — kein weiterer Anrufversuch bis dahin.`},
                  NOW())
        `.catch(() => {});
      }
    }

    return wirkung;
  } catch (err) {
    console.error("[NICHT-ERREICHT] Automatik:", err instanceof Error ? err.message : err);
    return LEER;
  }
}

/**
 * Der Kunde hat sich gemeldet — Zähler und Ruhe zurücksetzen.
 *
 * Wird bei jedem `erreicht_*` aufgerufen. Ohne das schleppt jemand, der vor
 * Monaten zweimal nicht dranging, diese Vorgeschichte ewig mit sich.
 */
export async function erreichtZuruecksetzen(personId: number, lauf: Lauf = sqlPool): Promise<void> {
  await lauf`
    UPDATE fiaon_persons SET unreachable_count = 0, ruhe_seit = NULL, updated_at = NOW()
    WHERE id = ${personId} AND (unreachable_count > 0 OR ruhe_seit IS NOT NULL)
  `.catch(() => {});
}

/**
 * SQL-Bedingung „liegt im Ruhe-Pool".
 *
 * Ein Fall ruht, solange `ruhe_seit` gesetzt ist UND die Wiedervorlage in der
 * Zukunft liegt. Beim Erreichen der Wiedervorlage taucht er von selbst wieder
 * auf — ohne Aufräumlauf, der vergessen werden kann.
 */
export function ruhtSql(p = "p"): string {
  return `(${p}.ruhe_seit IS NOT NULL AND ${p}.follow_up_date IS NOT NULL
      AND ${p}.follow_up_date > CURRENT_DATE)`;
}
