// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTO-STUFE — wie weit ist dieser Kunde?
//
// ── DIE GESCHÄFTSREGEL DES BETREIBERS ──────────────────────────────────────
// Antrag → Zahlung gebucht → Kunde bekommt Zugang → PFLICHT-Termin mit dem
// Onboarding-Team → erst nach ERLEDIGTEM Startgespräch wird der Account voll
// freigeschaltet → nächste Zahlung einen Monat später.
//
// Es gibt also zwei Stufen NACH der Zahlung, und sie unterscheiden sich nicht
// darin, OB der Kunde hereinkommt, sondern WAS er drinnen sieht:
//
//   wartet_auf_onboarding  Er kommt herein. Er sieht: Startgespräch buchen,
//                          seine Rechnungen und Zahlungsdaten, den Stand
//                          seiner Unterlagen und die Bonitätsauskunft samt
//                          Zahlweg. Fahrplan und Inhalte sind gesperrt —
//                          mit einer Karte, die sagt warum, nicht mit 404.
//   voll_aktiv             Alles offen.
//
// ── WARUM NICHT EINFACH `account_status` ───────────────────────────────────
// `account_status = 'suspended'` ist die harte Zugangssperre; an rund zwanzig
// Stellen wird auf `'active'` geprüft. Wer die Onboarding-Stufe dort
// hineinschreibt, sperrt bei der nächsten dieser Abfragen einen zahlenden
// Kunden aus, der nur sein Gespräch noch vor sich hat. Die Stufe ist eine
// ZUSÄTZLICHE Auskunft in einer eigenen Spalte.
//
// ── WER SCHALTET FREI ──────────────────────────────────────────────────────
// Genau ein Weg: Das Onboarding-Team markiert das Startgespräch als erledigt.
// Dazu ein ausdrücklicher Admin-Übergang mit Grund, der protokolliert wird.
// Kein dritter Weg — sonst ist die Pflicht eine Bitte.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;

export type Kontostufe = "wartet_auf_onboarding" | "voll_aktiv";

/** Die Stufe, die ein neu aktivierter Kunde bekommt. */
export const STUFE_NEU: Kontostufe = "wartet_auf_onboarding";

export interface StufenLage {
  ref: string;
  personId: number | null;
  stufe: Kontostufe;
  /** Gilt die harte Pflicht (kein „Später", buchen oder ausloggen)? */
  pflicht: boolean;
  /** Ist ein Startgespräch gebucht? Dann Termin-Angaben. */
  termin: { id: number; beginn: string; status: string } | null;
  /** Ist es erledigt? */
  erledigt: boolean;
  freigeschaltetAm: string | null;
  freigeschaltetVon: string | null;
  /** Klartext für Portal und Akte. */
  text: string;
}

/**
 * Welche Bereiche darf ein Kunde auf dieser Stufe sehen?
 *
 * Als Liste und nicht als vier `if` in der Oberfläche: Der Server entscheidet,
 * was offen ist, und die Oberfläche zeichnet nur. Wer die Grenze in die
 * Darstellung legt, hat keine Grenze, sondern eine Bitte.
 */
export const BEREICHE_WARTEND = [
  "overview",    // die Übersicht, aber ohne Fahrplan-Vorschau
  "account",     // sein Konto — Stammdaten sind seine Daten
  "documents",   // Unterlagen: was fehlt, wie hochladen
  "bank-guide",  // Anleitung zum Kontoauszug — er braucht sie für die Unterlagen
  "support",     // Hilfe ist NIE gesperrt
] as const;

/** Was zusätzlich offen ist, sobald das Startgespräch erledigt ist. */
export const BEREICHE_VOLL = ["roadmap"] as const;

export function bereichOffen(stufe: Kontostufe, bereich: string): boolean {
  if (stufe === "voll_aktiv") return true;
  return (BEREICHE_WARTEND as readonly string[]).includes(bereich);
}

/**
 * Die Stufe einer Bestellung — mit allem, was Portal und Akte dazu brauchen.
 *
 * Fällt die Spalte leer aus (Bestellung von vor der Migration), gilt
 * `voll_aktiv`: Ein Kunde, dessen Stufe wir nicht kennen, darf nicht aus
 * Versehen eingeschränkt werden.
 */
export async function stufeVon(ref: string, lauf: Lauf = sqlPool): Promise<StufenLage | null> {
  const [a] = (await lauf`
    SELECT a.ref, a.person_id, a.onboarding_stufe, a.onboarding_pflicht,
           a.freigeschaltet_am, a.freigeschaltet_von, a.payment_status,
           (SELECT t.id FROM fiaon_termine t
             WHERE t.person_id = a.person_id AND t.quelle = 'onboarding_call'
               AND t.status IN ('gebucht', 'erledigt')
             ORDER BY (t.status = 'erledigt') DESC, t.beginn DESC LIMIT 1) AS termin_id
    FROM fiaon_applications a
    WHERE a.ref = ${ref} AND a.merged_into IS NULL
  `) as any[];
  if (!a) return null;

  const [t] = a.termin_id
    ? ((await lauf`
        SELECT id, beginn, status FROM fiaon_termine WHERE id = ${a.termin_id}
      `) as any[])
    : [null];

  const stufe: Kontostufe = a.onboarding_stufe === "wartet_auf_onboarding"
    ? "wartet_auf_onboarding" : "voll_aktiv";
  const erledigt = t?.status === "erledigt";

  return {
    ref: String(a.ref),
    personId: a.person_id != null ? Number(a.person_id) : null,
    stufe,
    pflicht: a.onboarding_pflicht === true,
    termin: t ? { id: Number(t.id), beginn: t.beginn, status: String(t.status) } : null,
    erledigt,
    freigeschaltetAm: a.freigeschaltet_am ?? null,
    freigeschaltetVon: a.freigeschaltet_von ?? null,
    text: stufeText(stufe, !!t && t.status === "gebucht", erledigt),
  };
}

/** Der Satz, den Kunde und Mitarbeiter lesen — an EINER Stelle formuliert. */
export function stufeText(stufe: Kontostufe, terminGebucht: boolean, erledigt: boolean): string {
  if (stufe === "voll_aktiv") {
    return erledigt
      ? "Konto voll freigeschaltet — das Startgespräch ist erledigt."
      : "Konto voll freigeschaltet.";
  }
  return terminGebucht
    ? "Wartet auf das Startgespräch — der Termin steht. Danach ist alles offen."
    : "Wartet auf das Startgespräch — der Termin fehlt noch.";
}

/**
 * Setzt einen frisch bezahlten Kunden auf die Warte-Stufe.
 *
 * Wird aus dem Buchungsweg gerufen („Als bezahlt markieren", Kontoabgleich).
 * Idempotent und leise: Eine Zahlung darf nicht daran scheitern, dass die
 * Stufe nicht gesetzt werden kann.
 *
 * `pflicht` ist für NEUE Kunden `true`. Der Bestand behält seine Freiheit —
 * siehe die Begründung in db/migrations/054_onboarding_pflicht.sql.
 */
export async function aufWartestufeSetzen(
  ref: string, lauf: Lauf = sqlPool,
): Promise<{ gesetzt: boolean; grund?: string }> {
  try {
    const [a] = (await lauf`
      SELECT ref, type, pack_key, payment_status, onboarding_stufe, person_id
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL
    `) as any[];
    if (!a) return { gesetzt: false, grund: "Bestellung nicht gefunden" };
    // Die Bonitätsauskunft ist kein Paket und braucht kein Startgespräch.
    if (String(a.type) === "schufa" || String(a.pack_key) === "schufa"
        || String(a.ref).startsWith("FIAON-SCHUFA-")) {
      return { gesetzt: false, grund: "Bonitätsauskunft braucht kein Startgespräch" };
    }
    if (a.payment_status !== "paid") return { gesetzt: false, grund: "nicht bezahlt" };
    // Schon voll aktiv? Dann nicht zurückstufen — ein freigeschalteter Kunde
    // wird durch eine zweite Zahlung nicht wieder eingeschränkt.
    if (a.onboarding_stufe === "voll_aktiv") {
      return { gesetzt: false, grund: "bereits voll freigeschaltet" };
    }
    await lauf`
      UPDATE fiaon_applications
      SET onboarding_stufe = 'wartet_auf_onboarding',
          onboarding_pflicht = TRUE,
          updated_at = NOW()
      WHERE ref = ${ref} AND COALESCE(onboarding_stufe, '') <> 'voll_aktiv'
    `;
    return { gesetzt: true };
  } catch (err) {
    console.error("[KONTOSTUFE] aufWartestufeSetzen:", err);
    return { gesetzt: false, grund: "Fehler" };
  }
}

/**
 * Schaltet ein Konto voll frei — der EINZIGE Weg dorthin.
 *
 * Gerufen aus: dem Abschluss des Startgesprächs (Onboarding-Cockpit) und dem
 * ausdrücklichen Admin-Übergang. Jede Freischaltung schreibt, WER sie gemacht
 * hat und WARUM — sonst steht in vier Wochen ein voll aktives Konto da, und
 * niemand weiß, ob es ein Gespräch gab.
 */
export async function vollFreischalten(
  personId: number,
  von: { name: string; grund: string },
  lauf: Lauf = sqlPool,
): Promise<{ freigeschaltet: number; refs: string[] }> {
  const refs = (await lauf`
    UPDATE fiaon_applications
    SET onboarding_stufe = 'voll_aktiv',
        freigeschaltet_am = NOW(),
        freigeschaltet_von = ${von.name},
        freigabe_grund = ${von.grund.slice(0, 500)},
        updated_at = NOW()
    WHERE person_id = ${personId} AND merged_into IS NULL
      AND payment_status = 'paid'
      AND COALESCE(onboarding_stufe, '') <> 'voll_aktiv'
    RETURNING ref
  `) as any[];

  if (refs.length > 0) {
    // Der Verlaufseintrag gehört an die Akte, nicht nur in eine Spalte: Wer
    // die Akte liest, soll die Freischaltung im Verlauf finden.
    await lauf`
      INSERT INTO fiaon_contact_log (person_id, ref, agent_id, agent_name, type, note)
      VALUES (${personId}, ${refs[0].ref}, NULL, ${von.name}, 'system',
              ${`Konto voll freigeschaltet (${von.grund}). Der Kunde sieht ab jetzt alle Bereiche.`})
    `.catch(() => {});
  }
  return { freigeschaltet: refs.length, refs: refs.map((r: any) => String(r.ref)) };
}

/**
 * Wie viele warten gerade auf ihr Startgespräch? — für den Kennzahlen-Kopf.
 */
export async function wartendeZaehlen(lauf: Lauf = sqlPool): Promise<{
  wartend: number; mitTermin: number; ohneTermin: number; freigeschaltetWoche: number;
}> {
  const heute = berlinToday();
  const [z] = (await lauf`
    SELECT
      COUNT(DISTINCT a.person_id) FILTER (WHERE a.onboarding_stufe = 'wartet_auf_onboarding')::int AS wartend,
      COUNT(DISTINCT a.person_id) FILTER (WHERE a.onboarding_stufe = 'wartet_auf_onboarding'
        AND EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = a.person_id
                      AND t.quelle = 'onboarding_call' AND t.status = 'gebucht'))::int AS mit_termin,
      COUNT(DISTINCT a.person_id) FILTER (WHERE a.freigeschaltet_am IS NOT NULL
        AND a.freigeschaltet_am >= ${heute}::date - 7)::int AS frei_woche
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND a.person_id IS NOT NULL
  `) as any[];
  const wartend = Number(z.wartend);
  const mitTermin = Number(z.mit_termin);
  return {
    wartend, mitTermin, ohneTermin: Math.max(0, wartend - mitTermin),
    freigeschaltetWoche: Number(z.frei_woche),
  };
}
