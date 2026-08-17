// ═══════════════════════════════════════════════════════════════════════════
// WARTET AUF DEN KUNDEN — Karten, bei denen man nichts tun kann
//
// ── DER BEFUND (16.08.2026) ────────────────────────────────────────────────
// „Falsche Nummer" verschickt eine Mail und bittet den Kunden, seine Nummer
// nachzutragen. Danach kann der Agent GAR NICHTS tun: Die Nummer stimmt
// nicht, also kann er nicht anrufen, und die Antwort steht beim Kunden.
//
// GEMESSEN: 224 verschickte Nummern-Anfragen, **185 ohne Antwort**, davon
// **120 länger als sieben Tage**. Alle 185 standen weiter JEDEN TAG in der
// Arbeitsliste.
//
// Eine Karte, bei der man nichts tun kann, ist keine Aufgabe — sie ist ein
// Übungsstück im Überblättern. Und wer gelernt hat zu überblättern, überblättert
// auch die zwei, bei denen es brennt.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Wartezustand heißt: raus aus der Tagesliste, Wiedervorlage in sieben Tagen,
// sichtbar unter dem Filter „Wartend". Der Fall ist nicht weg — er ist nur
// nicht heute.
//
// ── UND WIE KOMMT DIE KARTE ZURÜCK? ────────────────────────────────────────
// Von selbst, in drei Fällen:
//   · Der Kunde trägt seine Nummer ein  → `nichtMehrWarten("nummer")`
//   · Der Kunde bucht einen Termin      → `nichtMehrWarten("termin")`
//   · Die sieben Tage sind um           → die Wiedervorlage wird fällig
// Kein Mensch muss daran denken. Ein Wartezustand, den jemand von Hand
// beenden muss, ist ein Wartezustand für immer.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinPlusTage } from "./fiaon-time";

type Lauf = typeof sqlPool;

/** Worauf gewartet wird. */
export type WarteGrund = "nummer" | "termin";

/** Wie lange ein Wartezustand die Karte vom Tisch nimmt. */
export const WARTE_TAGE = 7;

export const WARTE_TEXT: Record<WarteGrund, string> = {
  nummer: "Wartet auf Kunde (Nummer)",
  termin: "Wartet auf Kunde (Termin)",
};

/**
 * Nimmt einen Fall vom Tisch, bis der Kunde reagiert.
 *
 * `follow_up_date` ist die Spalte, auf die die Tagesliste ohnehin filtert
 * (`follow_up_date IS NULL OR follow_up_date <= heute`) — sie wird hier
 * mitgesetzt, damit der Fall auch ohne eine neue Filterbedingung verschwindet.
 * Der Wartegrund kommt zusätzlich in eine eigene Spalte, damit die Oberfläche
 * SAGEN kann, worauf gewartet wird.
 */
export async function wartenAufKunde(
  personId: number, grund: WarteGrund, lauf: Lauf = sqlPool,
): Promise<{ bis: string }> {
  const bis = berlinPlusTage(WARTE_TAGE);
  await lauf`
    UPDATE fiaon_persons
    SET wartet_auf = ${grund},
        wartet_seit = NOW(),
        -- Nur nach HINTEN verschieben: Stand die Wiedervorlage schon später,
        -- bleibt sie. Sonst holt ein Wartezustand einen Fall nach vorn, der
        -- bewusst weiter weg gelegt wurde.
        follow_up_date = GREATEST(COALESCE(follow_up_date, ${bis}::date), ${bis}::date),
        updated_at = NOW()
    WHERE id = ${personId}
  `;
  return { bis };
}

/**
 * Der Kunde hat reagiert — die Karte kommt zurück.
 *
 * `follow_up_date = NULL` heißt: heute. Der Kunde hat gerade etwas getan, das
 * ist der beste Moment für einen Anruf.
 */
export async function nichtMehrWarten(
  personId: number, grund?: WarteGrund, lauf: Lauf = sqlPool,
): Promise<{ zurueck: boolean }> {
  const zeilen = (await lauf`
    UPDATE fiaon_persons
    SET wartet_auf = NULL, wartet_seit = NULL, follow_up_date = NULL, updated_at = NOW()
    WHERE id = ${personId} AND wartet_auf IS NOT NULL
      AND (${grund ?? null}::text IS NULL OR wartet_auf = ${grund ?? null})
    RETURNING id
  `) as any[];
  return { zurueck: zeilen.length > 0 };
}

/**
 * SQL-Ausdruck: Wartet dieser Mensch auf den Kunden?
 *
 * Als Textbaustein, weil ihn die Tagesliste, der Filter „Wartend" und die
 * Kennzahlen brauchen. Drei Fassungen wären drei Gelegenheiten, verschieden
 * zu antworten.
 */
export function wartetSql(p = "p"): string {
  return `${p}.wartet_auf IS NOT NULL`;
}

/** Wie viele warten gerade — je Grund. Für den Filter-Zähler. */
export async function warteZahlen(
  agentId: number | null, lauf: Lauf = sqlPool,
): Promise<{ gesamt: number; nummer: number; termin: number }> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE wartet_auf = 'nummer')::int AS nummer,
           COUNT(*) FILTER (WHERE wartet_auf = 'termin')::int AS termin
    FROM fiaon_persons
    WHERE wartet_auf IS NOT NULL AND merged_into_person_id IS NULL
      AND (${agentId ?? null}::int IS NULL OR assigned_agent_id = ${agentId ?? null})
  `) as any[];
  return { gesamt: Number(z.gesamt), nummer: Number(z.nummer), termin: Number(z.termin) };
}
