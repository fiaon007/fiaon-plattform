// ═══════════════════════════════════════════════════════════════════════════
// DIE ONBOARDING-VERGÜTUNG
//
// ── DER AUFTRAG DES BETREIBERS (18.08.2026) ────────────────────────────────
// „Für jedes erfolgreich abgeschlossene Startgespräch bekommt der
// Onboarding-Mitarbeiter eine kleine Vergütung — einstellbar, Vorgabe 15 €.
// Genau EINE Gutschrift je Kunde, auch wenn ein zweites Gespräch nötig war."
//
// ── WARUM „GENAU EINE JE KUNDE" DER GANZE PUNKT IST ────────────────────────
// Ohne diese Bedingung wäre die Vergütung eine Einladung: Termin abschließen,
// Kunde wieder auf „wartet" setzen, zweites Gespräch, zweite Gutschrift. Nicht
// weil Menschen böse sind, sondern weil ein zweites Gespräch manchmal WIRKLICH
// nötig ist — und dann steht die Frage im Raum, ob es dafür Geld gibt.
//
// Die Antwort ist an EINER Stelle festgeschrieben: pro Person eine Gutschrift,
// erzwungen durch einen eindeutigen Index in der Datenbank. Nicht durch ein
// „prüfe vorher, ob schon eine da ist" — zwei gleichzeitige Abschlüsse würden
// diese Prüfung beide passieren.
//
// ── WARUM SIE ÜBER `fiaon_commissions` LÄUFT ───────────────────────────────
// Weil dort schon alles steht, was eine Gutschrift braucht: Auszahlungslauf,
// Storno, Übersicht, Nachweis. Eine zweite Tabelle für „Onboarding-Geld" hätte
// einen zweiten Auszahlungsweg gebraucht — und der wäre irgendwann von dem
// ersten abgewichen.
//
// `kind = 'onboarding'` unterscheidet sie von Vertriebsprovisionen. Die
// Provisions-Wand (Kontakt vor Zahlung) gilt für sie NICHT: Diese Vergütung ist
// Lohn für eine geleistete Arbeit, keine Beteiligung an einem Abschluss.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Vorgabe in Cent, wenn die Einstellung fehlt. */
export const VERGUETUNG_VORGABE_CENT = 1500;

/** Was ist ein erledigtes Startgespräch wert? Einstellbar in /admin/einstellungen. */
export async function verguetungCent(lauf: Lauf = sqlPool): Promise<number> {
  try {
    const [z] = (await lauf`
      SELECT value FROM fiaon_settings WHERE key = 'onboarding_verguetung_cent'
    `) as any[];
    const n = Math.round(Number(z?.value));
    // Grenzen: 0 heißt ausdrücklich „keine Vergütung" (ein gültiger Wunsch).
    // Nach oben 100 € — ein Tippfehler mit einer Null zu viel darf keine
    // 1.500-€-Gutschrift erzeugen.
    if (Number.isFinite(n) && n >= 0 && n <= 10_000) return n;
  } catch { /* Vorgabe */ }
  return VERGUETUNG_VORGABE_CENT;
}

/**
 * Schreibt die Gutschrift für ein erledigtes Startgespräch.
 *
 * Idempotent über den eindeutigen Index `fiaon_commissions_onboarding_person_idx`:
 * Ein zweiter Aufruf für denselben Kunden fügt nichts hinzu, egal wie oft und
 * egal von wem.
 *
 * Wirft NICHT. Ein Fehler in der Vergütung darf einen Abschluss nie verhindern —
 * das Gespräch ist geführt, das Konto ist freigeschaltet, und die Gutschrift
 * ist nachtragbar.
 */
export async function onboardingGutschrift(
  opts: { personId: number; agentId: number; agentName: string; terminId: number; ref?: string | null },
  lauf: Lauf = sqlPool,
): Promise<{ gutgeschrieben: boolean; cents: number; grund: string }> {
  const cents = await verguetungCent(lauf);
  if (cents <= 0) {
    return { gutgeschrieben: false, cents: 0, grund: "Vergütung ist auf 0 gestellt." };
  }

  try {
    // Die Bestellung des Kunden — für die Nachvollziehbarkeit in der
    // Provisionsübersicht. Fehlt sie, wird eine Ersatzkennung benutzt: Die
    // Arbeit wurde geleistet, auch wenn die Bestellzeile nicht auffindbar ist.
    let ref = opts.ref ?? null;
    if (!ref) {
      const [a] = (await lauf`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ${opts.personId} AND merged_into IS NULL AND archived_at IS NULL
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      ref = a?.ref ?? null;
    }
    const kennung = ref ?? `ONBOARDING-P${opts.personId}`;

    const [paket] = (await lauf`
      SELECT pack_name FROM fiaon_applications
      WHERE ref = ${kennung} LIMIT 1
    `.catch(() => [] as any[])) as any[];

    const zeilen = (await lauf`
      INSERT INTO fiaon_commissions (
        agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents,
        status, kind, onboarding_person_id, note
      ) VALUES (
        ${opts.agentId}, ${kennung}, ${paket?.pack_name ?? "Startgespräch"},
        ${cents}, 0, ${cents},
        'bestaetigt', 'onboarding', ${opts.personId},
        ${`Startgespräch geführt und Konto freigeschaltet (Termin #${opts.terminId})`}
      )
      -- Das WHERE muss dem Index-Prädikat ENTSPRECHEN, sonst findet
      -- PostgreSQL den Teilindex nicht (Fehler 42P10, siehe Migration 057).
      ON CONFLICT (onboarding_person_id) WHERE kind = 'onboarding' DO NOTHING
      RETURNING id
    `) as any[];

    if (zeilen.length === 0) {
      return {
        gutgeschrieben: false, cents,
        grund: "Für diesen Kunden gibt es die Onboarding-Vergütung bereits — je Kunde genau eine.",
      };
    }

    console.log(`[ONBOARDING-VERGÜTUNG] #${zeilen[0].id}: ${(cents / 100).toFixed(2)} € `
      + `→ ${opts.agentName} (#${opts.agentId}) für Person ${opts.personId}`);
    return {
      gutgeschrieben: true, cents,
      grund: `Vergütung ${(cents / 100).toFixed(2)} € gutgeschrieben.`,
    };
  } catch (err) {
    // Kein Wurf: siehe oben.
    console.error("[ONBOARDING-VERGÜTUNG] fehlgeschlagen:", err);
    return {
      gutgeschrieben: false, cents,
      grund: "Die Vergütung konnte nicht gebucht werden — bitte im Team-Bereich nachtragen.",
    };
  }
}

/** Die Zahlen für den Onboarding-Bereich: was habe ich verdient? */
export async function verguetungZahlen(
  agentId: number, lauf: Lauf = sqlPool,
): Promise<{ anzahl: number; summeCent: number; monatAnzahl: number; monatSummeCent: number; satzCent: number }> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS anzahl,
           COALESCE(SUM(amount_cents), 0)::int AS summe,
           COUNT(*) FILTER (WHERE created_at >= date_trunc('month', NOW()))::int AS monat_anzahl,
           COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= date_trunc('month', NOW())), 0)::int AS monat_summe
    FROM fiaon_commissions
    WHERE agent_id = ${agentId} AND kind = 'onboarding' AND status <> 'storniert'
  `) as any[];
  return {
    anzahl: Number(z?.anzahl ?? 0),
    summeCent: Number(z?.summe ?? 0),
    monatAnzahl: Number(z?.monat_anzahl ?? 0),
    monatSummeCent: Number(z?.monat_summe ?? 0),
    satzCent: await verguetungCent(lauf),
  };
}
