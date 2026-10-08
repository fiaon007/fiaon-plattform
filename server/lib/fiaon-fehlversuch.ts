// ═══════════════════════════════════════════════════════════════════════════
// FEHLVERSUCHE ZÄHLEN — EINMAL JE ANRUF, NICHT JE KLICK (E-IT-A, 08.10.2026)
//
// ── DER BEFUND (Produktion, nur lesend, 07.10.2026) ────────────────────────
// Bei Nikita folgten 131 von 653 „nicht erreicht/Mailbox" binnen 30 Minuten
// auf einen vorherigen Eintrag derselben Person, 98 davon binnen 2 Minuten.
// Die Gegenprüfung fand die Quelle: 53 von 72 Paaren waren ein Ergebnis im
// Softphone UND ein zweiter Eintrag aus der Akte für DENSELBEN Anruf. Beide
// laufen über ergebnisAnwenden — der Zähler stieg zweimal, und die Staffel
// (Pause ab 6, Ruhe ab 9) sprang zu früh.
//
// ── DIE REGEL (Justin, 08.10.2026) ────────────────────────────────────────
// Doppelbuchungen zählen nicht doppelt. Ein Fehlversuch derselben Person
// binnen ENTPRELLUNG_MINUTEN (30) nach dem zuletzt GEZÄHLTEN zählt nicht noch
// einmal. Der Verlaufseintrag bleibt — gezählt wird nur der Zähler nicht, und
// die Automatik (Terminlink-Mail, Ruhe, Leitung) läuft nicht ein zweites Mal.
//
// ── WARUM ÜBER EINE MARKE UND NICHT ÜBER DEN VERLAUF ───────────────────────
// Die Aufrufer schreiben ihren Verlaufseintrag mal VOR (Akte, Softphone),
// mal NACH ergebnisAnwenden (Tagesbericht, WhatsApp). Ein Blick in den Verlauf
// fände also mal die eigene Zeile, mal nicht. Die Marke ist davon unabhängig,
// und das Setzen ist EIN Befehl (ON CONFLICT … WHERE) — zwei gleichzeitige
// Klicks können nicht beide zählen. Tabelle: db/migrations/097.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { ENTPRELLUNG_MINUTEN } from "@shared/fiaon-wiedervorlage";
import { frischBandSql } from "./fiaon-pipeline-reihung";

type Lauf = any;

let tabelleBereit: Promise<boolean> | null = null;
/**
 * Die Tabelle beim ersten Gebrauch anlegen (wie Migration 097). Über den
 * GLOBALEN Pool und VOR einer Prüfstand-Transaktion aufrufbar (AGENTS.md,
 * Falle 1: DDL wartet auf die offene Transaktion). Eine NEUE Tabelle sperrt
 * nichts Bestehendes. Schlägt das Anlegen fehl, zählt der Zähler wie bisher —
 * eine Automatik darf das Dokumentieren eines Anrufs nie verhindern.
 */
export function fehlversuchTabelle(): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`CREATE TABLE IF NOT EXISTS fiaon_fehlversuch_marke (person_id INTEGER PRIMARY KEY, am TIMESTAMPTZ NOT NULL)`;
      });
      return true;
    })().catch((e) => {
      console.error("[FEHLVERSUCH] Marke nicht bereit — Zähler ohne Entprellung:", e?.message || e);
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/**
 * Einen Fehlversuch zählen — entprellt. Gibt den Zählerstand NACH dem Versuch
 * zurück und ob er wirklich gezählt wurde.
 */
export async function fehlversuchZaehlen(personId: number, lauf: Lauf = sqlPool): Promise<{ versuche: number; gezaehlt: boolean }> {
  let gezaehlt = true;
  if (await fehlversuchTabelle()) {
    const [da] = (await lauf`SELECT to_regclass('public.fiaon_fehlversuch_marke') IS NOT NULL AS da`) as any[];
    if (da?.da) {
      const zeile = (await lauf`
        INSERT INTO fiaon_fehlversuch_marke (person_id, am) VALUES (${personId}, NOW())
        ON CONFLICT (person_id) DO UPDATE SET am = NOW()
          WHERE fiaon_fehlversuch_marke.am <= NOW() - (${ENTPRELLUNG_MINUTEN}::int * INTERVAL '1 minute')
        RETURNING person_id`) as any[];
      gezaehlt = zeile.length > 0;
    }
  }
  const [p] = (await lauf`
    UPDATE fiaon_persons SET unreachable_count = COALESCE(unreachable_count, 0) + ${gezaehlt ? 1 : 0}, updated_at = NOW()
     WHERE id = ${personId}
    RETURNING unreachable_count`) as any[];
  return { versuche: Number(p?.unreachable_count ?? 0), gezaehlt };
}

/** Erreicht: Die Marke fällt (ohne Löschen) — der nächste Fehlversuch zählt wieder. */
export async function fehlversuchMarkeZuruecksetzen(personId: number, lauf: Lauf = sqlPool): Promise<void> {
  const [da] = (await lauf`SELECT to_regclass('public.fiaon_fehlversuch_marke') IS NOT NULL AS da`.catch(() => [])) as any[];
  if (!da?.da) return;
  await lauf`UPDATE fiaon_fehlversuch_marke SET am = '-infinity' WHERE person_id = ${personId} AND am > '-infinity'`;
}

/**
 * Was die Regel über den Menschen wissen muss: Stufe A? Frisch (Antrag,
 * Zahlungsmeldung oder fällige Rate höchstens FRISCH_TAGE alt)?
 */
export async function wiedervorlageKontext(personId: number, lauf: Lauf = sqlPool): Promise<{ stufe: number | null; stufeA: boolean; frisch: boolean }> {
  const [z] = (await lauf.unsafe(`
    SELECT p.priority_tier, ${frischBandSql()} AS frisch
      FROM fiaon_persons p WHERE p.id = $1`, [personId]).catch(() => [])) as any[];
  const stufe = z?.priority_tier == null ? null : Number(z.priority_tier);
  return { stufe, stufeA: stufe === 1, frisch: z?.frisch === true };
}
