// ═══════════════════════════════════════════════════════════════════════════
// DAS TEAM-BILD GEHÖRT DEM TEAM
//
// ── DER BEFUND (17.08.2026, Screenshot des Betreibers) ────────────────────
// Die Team-Zentrale zeigte 11 Karten. Sechs davon sind Menschen, fünf waren
// Prüfstands-Konten. GEMESSEN: **49 Mitarbeiter-Konten insgesamt, 43 davon
// Testkonten, 6 echte.**
//
// Diese Konten habe ich selbst angelegt: Jeder Browser-Prüfstand braucht eine
// Anmeldung, und ein Prüfstand darf keine echte Anmeldung benutzen. Sie waren
// stillgelegt und als Test markiert — die Team-Ansichten haben nur nie danach
// gefragt.
//
// ── WARUM DAS MEHR IST ALS UNORDNUNG ──────────────────────────────────────
// Ein Betreiber, der sein Team ansieht, zählt Menschen. Wenn zwischen ihnen
// Karteileichen stehen, sind alle Zahlen daneben: Personalkosten,
// Deckungsbeitrag, Rangliste, „wer hat die kleinste Last". Eine Verteilung, die
// ein Testkonto berücksichtigt, gibt einem Testkonto echte Kunden.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Ein Testkonto erscheint in KEINER Team-Ansicht, keiner Rangliste, keiner
// Verteilung, keinem Kennzahlen-Aggregat — nur unter dem ausdrücklichen
// Filter „Testkonten" in der Team-Zentrale.
//
// Genau wie bei Kunden (`ist_test_am` in fiaon_persons): eine Grenze, ein Ort.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/**
 * Namensmuster für Testkonten.
 *
 * Die Marke `is_test_account` ist der Hauptweg — aber sie kann fehlen: Wer ein
 * Konto von Hand anlegt, um etwas auszuprobieren, denkt nicht an eine Spalte.
 * Das Muster fängt die Nachlässigkeit. GEMESSEN waren am 17.08.2026 alle 43
 * Testkonten korrekt markiert; das Muster ist die Absicherung für morgen.
 *
 * Bewusst als SQL-Textbaustein und nicht als Liste in TypeScript: Die Grenze
 * muss in der WHERE-Bedingung stehen, sonst holt die Abfrage die Zeilen und
 * die Oberfläche wirft sie weg — und die Kennzahl hat schon gezählt.
 */
export const TEST_NAMENSMUSTER =
  "(a.name ILIKE '%prüfstand%' OR a.name ILIKE '%pruefstand%'"
  + " OR a.name ILIKE '%knopf-durchgang%' OR a.name ILIKE '%testkonto%'"
  + " OR a.name ILIKE '%probelauf%' OR a.email ILIKE '%@pruefstand%'"
  + " OR a.email ILIKE '%.test')";

/**
 * Ist dieses Konto ein Testkonto? — als SQL-Ausdruck.
 *
 * `p` ist das Tabellenkürzel. Voreinstellung `a`, weil die Team-Abfragen
 * `fiaon_agents a` schreiben.
 */
export function istTestkontoSql(p = "a"): string {
  const muster = TEST_NAMENSMUSTER.replace(/\ba\./g, `${p}.`);
  return `(COALESCE(${p}.is_test_account, FALSE) OR ${muster})`;
}

/**
 * Die Grenze für JEDE Team-Ansicht: nur echte Menschen.
 *
 * Verwendung: `WHERE ${echteMitarbeiterSql()} AND a.active`
 */
export function echteMitarbeiterSql(p = "a"): string {
  return `NOT ${istTestkontoSql(p)}`;
}

/**
 * Umgekehrt — für den ausdrücklichen Filter „Testkonten".
 *
 * Sie sind nicht verboten, nur nicht im Weg. Wer wissen will, was ein
 * Prüfstand angelegt hat, soll es sehen können.
 */
export function nurTestkontenSql(p = "a"): string {
  return istTestkontoSql(p);
}

/**
 * Für den Prüfstands-Abschluss: ein Testkonto stilllegen UND markieren.
 *
 * ── DIE DISZIPLIN (AGENTS.md ergänzt am 17.08.2026) ──────────────────────
 * Jeder Lauf, der ein Mitarbeiterkonto anlegt, ruft das am Ende auf. Nicht
 * löschen: Ein Zugang, der existiert hat, gehört ins Protokoll — und ein
 * `DELETE` auf `fiaon_agents` würde Provisionen, Stunden und Verlaufseinträge
 * mit sich reißen oder auf verwaiste Kennungen zeigen lassen.
 */
export async function testkontoStilllegen(
  agentId: number, lauf: Lauf = sqlPool,
): Promise<{ stillgelegt: boolean }> {
  const zeilen = (await lauf`
    UPDATE fiaon_agents
    SET active = FALSE,
        is_test_account = TRUE,
        password_hash = NULL,
        distribution_active = FALSE,
        name = CASE WHEN name LIKE '%— stillgelegt' THEN name
                    ELSE CONCAT(name, ' — stillgelegt') END
    -- Kein „updated_at“: Die Tabelle fiaon_agents hat diese Spalte nicht.
    -- Aufgefallen beim ersten Schreiblauf — deshalb steht vor jedem Schreiben
    -- eine Vorschau (AGENTS.md). Ein Typcheck findet so etwas nie.
    WHERE id = ${agentId}
    RETURNING id
  `) as any[];
  return { stillgelegt: zeilen.length > 0 };
}

/** Wie viele Testkonten gibt es? — für den Filter-Zähler in der Zentrale. */
export async function testkontenZaehlen(lauf: Lauf = sqlPool): Promise<{
  test: number; echt: number; testAktiv: number;
}> {
  const [z] = (await lauf.unsafe(`
    SELECT COUNT(*) FILTER (WHERE ${istTestkontoSql()})::int AS test,
           COUNT(*) FILTER (WHERE ${echteMitarbeiterSql()})::int AS echt,
           COUNT(*) FILTER (WHERE ${istTestkontoSql()} AND a.active)::int AS test_aktiv
    FROM fiaon_agents a
  `)) as any[];
  return { test: Number(z.test), echt: Number(z.echt), testAktiv: Number(z.test_aktiv) };
}
