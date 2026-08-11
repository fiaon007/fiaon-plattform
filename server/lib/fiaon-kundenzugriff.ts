// ═══════════════════════════════════════════════════════════════════════════
// DARF DIESER MENSCH AN DIESEN KUNDEN?
//
// ── WARUM DIESE DATEI ENTSTANDEN IST ───────────────────────────────────────
// Die Frage wurde an ZWEI Stellen beantwortet: in `fiaon-telefonie.ts` und in
// `fiaon-mail.ts`. Beide Fassungen sahen gleich aus, und beide hatten
// dieselbe Lücke — das Forderungsmanagement fiel in den letzten Zweig, der
// nach `assigned_agent_id` fragt. Inkasso-Mitarbeiter haben keine
// Vertriebskunden (und sollen keine haben), also durften sie niemanden
// anrufen und niemandem schreiben.
//
// Ich hätte die Lücke zweimal schließen können. Beim nächsten Mal — einer
// neuen Rolle, einer neuen Bedingung — wären es wieder zwei Stellen, und eine
// davon hätte jemand vergessen.
//
// AGENTS.md sagt es: „Eine Definition, ein Ort."
//
// ── DIE REGELN IN WORTEN ───────────────────────────────────────────────────
//   Vertriebsleitung, Vorgesetzter  →  jeder Kunde
//   Onboarding                      →  wer einen Startgespräch-Termin bei
//                                      ihm hat
//   Forderungsmanagement            →  wer eine offene Rate hat ODER dessen
//                                      Zahlung überfällig ist
//   Agent                           →  seine eigenen Kunden
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export async function darfAnKunde(
  agentId: number, rolle: string, personId: number, lauf: Lauf = sqlPool,
): Promise<boolean> {
  if (!Number.isFinite(personId) || personId <= 0) return false;

  if (rolle === "vertriebsleiter" || rolle === "admin") return true;

  if (rolle === "onboarding") {
    const [t] = (await lauf`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${personId} AND agent_id = ${agentId}
        AND quelle = 'onboarding_call' LIMIT 1
    `) as any[];
    return !!t;
  }

  if (rolle === "inkasso") {
    // ── EINE OFFENE RATE ──────────────────────────────────────────────────
    // Nicht „alle Kunden": Wer eine offene Rate hat, ist ein Fall. Wer keine
    // hat, geht das Forderungsmanagement nichts an — dieselbe Grenze wie in
    // der Arbeitsliste, hier nur als Frage nach EINER Person.
    const [r] = (await lauf`
      SELECT 1 AS ok
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE a.person_id = ${personId}
        AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND r.status <> 'bezahlt'
      LIMIT 1
    `) as any[];
    if (r) return true;

    // ── ODER EINE ÜBERFÄLLIGE ZAHLUNG OHNE ANGELEGTE RATE ────────────────
    // Gemessen am 11.08.2026: 100 bezahlte Kunden hatten gar keine Abo-Raten,
    // 28 davon mit überfälligem Fälligkeitsdatum. Sie tauchten im
    // Forderungsmanagement nie auf — nicht weil sie in Ordnung waren, sondern
    // weil für sie nie eine Rate angelegt wurde.
    //
    // Der Vorgesetzte: „Inkasso hat völlig falsche und viel zu wenig Kunden."
    // Das hier ist ein Teil der Antwort.
    const [b] = (await lauf`
      SELECT 1 AS ok FROM fiaon_applications a
      WHERE a.person_id = ${personId} AND a.payment_status = 'paid'
        AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        AND a.payment_due_date < CURRENT_DATE
      LIMIT 1
    `) as any[];
    return !!b;
  }

  const [p] = (await lauf`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId} AND assigned_agent_id = ${agentId}
      AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}
