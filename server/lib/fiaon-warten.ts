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
// ═══════════════════════════════════════════════════════════════════════════
// DER TÄGLICHE NACHLAUF — ALTE NUMMERN-ANFRAGEN IN DEN WARTEZUSTAND
//
// ── WARUM ER NÖTIG IST (27.08.2026) ────────────────────────────────────────
// Der Bestandslauf `scripts/warten-bestand.ts` hat am 24.08. sieben Fälle
// nachgetragen. Drei Tage später standen ZWEI WIEDER da: Ihre alte Wiedervorlage
// aus der Zeit vor dem Wartezustand (`nummer_falsch` legte +3 Tage) war fällig
// geworden, und ein Wartezustand war nie gesetzt.
//
// Ein Bestandslauf, den ein Mensch aufrufen muss, wird beim dritten Mal
// vergessen. Diese Funktion macht daraus einen Schritt des Tageslaufs.
//
// ── SIE IST IDEMPOTENT ─────────────────────────────────────────────────────
// Sie fasst nur an, wer (a) eine Nummern-Anfrage im Verlauf hat, (b) KEINEN
// Wartezustand trägt und (c) heute in der Tagesliste stünde. Ein zweiter Lauf
// findet niemanden mehr — der Prüfstand beweist das.
// ═══════════════════════════════════════════════════════════════════════════
export async function nummernAnfragenNachtragen(
  lauf: Lauf = sqlPool,
): Promise<{ gesetzt: number; namen: string[] }> {
  const offene = (await lauf`
    SELECT DISTINCT ON (p.id) p.id, a.ref,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                    a.company_name, 'Unbekannt') AS name,
           MAX(c.created_at) OVER (PARTITION BY p.id) AS anfrage_am
    FROM fiaon_contact_log c
    JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
    JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
    WHERE (c.note ILIKE '%number_update%' OR c.type ILIKE '%number_update%')
      AND p.wartet_auf IS NULL
      AND (p.follow_up_date IS NULL OR p.follow_up_date <= CURRENT_DATE)
    ORDER BY p.id, c.created_at DESC
  `) as any[];

  const namen: string[] = [];
  for (const o of offene) {
    const { bis } = await wartenAufKunde(Number(o.id), "nummer", lauf);
    namen.push(String(o.name));
    // Die Spur nennt den GRUND — sonst rätselt in einem halben Jahr jemand,
    // warum der Fall vom Tisch ist.
    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${o.ref}, NULL, 'System', 'system',
              ${`Wartezustand nachgetragen (Nummer, bis ${bis}). Die Nummern-Anfrage `
                + `ging am ${String(o.anfrage_am ?? "").slice(0, 10)} raus; damals gab es `
                + `den Wartezustand noch nicht. Es wurde KEINE neue Mail verschickt.`})
    `.catch(() => {});
  }
  if (namen.length > 0) {
    console.log(`[WARTEN-NACHLAUF] ${namen.length} Nummern-Anfragen in den Wartezustand: `
      + namen.slice(0, 6).join(", ") + (namen.length > 6 ? " …" : ""));
  }
  return { gesetzt: namen.length, namen };
}

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
