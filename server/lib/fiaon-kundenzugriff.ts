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

// ═══════════════════════════════════════════════════════════════════════════
// WELCHE ROLLE HAT DIESER MENSCH?
//
// ── DER BEFUND (11.08.2026) ────────────────────────────────────────────────
// Der Vorgesetzte: „Wenn der Inkasso-Mitarbeiter auf ‚senden' klickt, öffnet
// sich das E-Mail-PopUp … und es geht nicht!"
//
// Gemessen: HTTP 403 „Dieser Kunde wird von jemand anderem betreut."
//
// Die Ursache stand in `fiaon-mail.ts`:
//
//     return (["vertriebsleiter", "onboarding", "agent"].includes(r)
//       ? r : "agent") as Rolle;
//
// „inkasso" war nicht in der Liste und wurde stillschweigend zu „agent"
// umgedeutet. Damit fragte `darfAnKunde` nach `assigned_agent_id` — und
// Inkasso-Mitarbeiter haben keine zugewiesenen Vertriebskunden.
//
// Dieselbe Falle wie heute Mittag beim Telefon: eine ERLAUBNISLISTE, die man
// bei jeder neuen Rolle erweitern muss und genau dann vergisst. Der Fehler
// fällt erst auf, wenn ein Mensch vor einer verschlossenen Tür steht.
//
// Die Funktion stand in DREI Dateien (fiaon-mail, fiaon-telefonie,
// fiaon-versand) — mit drei verschiedenen Fassungen. Jetzt hier, einmal.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Die Rolle, wie sie in der Datenbank steht — ohne Umdeutung.
 *
 * Wer keine Rolle hat, ist „agent": Das ist die Voreinstellung seit dem ersten
 * Tag und die engste. Wer eine hat, bekommt SIE — auch eine, die es beim
 * Schreiben dieser Zeilen noch nicht gab.
 */
export async function rolleVon(agentId: number, lauf: Lauf = sqlPool): Promise<string> {
  const [a] = (await lauf`
    SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active
  `) as any[];
  return String(a?.rolle || "agent");
}

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

  // ── DER POOL GEHOERT ALLEN (27.08.2026, Team-Punkt 7) ──────────────────
  // Judith Laditsch: niemandem zugewiesen — und trotzdem sagte das Telefon
  // „Dieser Kunde wird von jemand anderem betreut." Die Abfrage kannte nur
  // „mir zugewiesen"; ein Kunde OHNE Betreuer fiel durch und die Meldung log.
  // Justins Regel vom 25.08.: Niemand besitzt Kunden vor dem Mandat — ein
  // unzugewiesener Kunde ist Pool und darf angesprochen werden. Gesperrt
  // bleibt nur, wer WIRKLICH einem Kollegen gehoert.
  // ═══════════════════════════════════════════════════════════════════════
  // EIN TERMIN ÖFFNET DIE AKTE (04.09.2026)
  //
  // Florentine: „Wenn ein Kundentermin an einen anderen Mitarbeiter übergeben
  // wird, sollte die gesamte Kundenakte mit übergeben werden. Aktuell ist die
  // Akte beim übernommenen Termin leer." Daniel im Chat: „Kann seine Akte
  // nicht einsehen." Hans-Jürgen: „Warum sehe ich die Akte nicht?"
  //
  // Bis hierher galt der Termin nur für die Rolle Onboarding als Schlüssel.
  // Ein Vertriebskollege, der einen Termin übernahm, saß vor einer leeren
  // Akte — und rief einen Menschen an, von dem er nichts wusste.
  //
  // Jetzt gilt für JEDE Rolle: Wer einen offenen Termin mit diesem Kunden
  // hat, sieht die Akte. Der Kunde bleibt dabei, wem er gehört — das
  // regelt die Übergabe, nicht der Zugriff.
  // ═══════════════════════════════════════════════════════════════════════
  const [t] = (await lauf`
    SELECT 1 AS ok FROM fiaon_termine
    WHERE person_id = ${personId} AND agent_id = ${agentId}
      AND abgesagt_am IS NULL
      AND beginn > NOW() - INTERVAL '7 days'
    LIMIT 1
  `) as any[];
  if (t) return true;

  const [p] = (await lauf`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId}
      AND (assigned_agent_id = ${agentId} OR assigned_agent_id IS NULL)
      AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}
