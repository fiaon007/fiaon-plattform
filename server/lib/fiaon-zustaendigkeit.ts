// ═══════════════════════════════════════════════════════════════════════════
// WER IST FÜR DIESEN MENSCHEN ZUSTÄNDIG? — EINE ABLEITUNG
//
// ── DER AUFTRAG (21.08.2026) ───────────────────────────────────────────────
// „Heute entscheidet Anzeige anders als Annahme — genau die Fehlerklasse, die
// uns schon 139 Kunden gekostet hat."
//
// Sie hat recht, und es war zweimal derselbe Schaden:
//   19.08.  Die Terminanzeige bot Zeiten von Vertriebsleuten an, die Annahme
//           lehnte sie ab. 213 Kunden wurden abgewiesen, nachdem sie geklickt
//           hatten.
//   19.08.  Die Kundenkarte gab „Zahlungsdaten senden" frei, der Server lehnte
//           ab. 139 Kunden.
//
// Beide Male gab es ZWEI Antworten auf EINE Frage. Diese Datei ist die eine
// Antwort auf „wer ist zuständig".
//
// ── DIE REGELN, IN DIESER REIHENFOLGE ─────────────────────────────────────
//   1. Zahlungsrückstand ab Mahnstufe X ODER vom Betreiber markiert
//                                        → Forderungsmanagement (inkasso)
//   2. Paket bezahlt, Startgespräch nicht erledigt
//                                        → Onboarding
//   3. sonst (nicht bezahlt, oder voll aktiv)
//                                        → Vertrieb
//
// ── WARUM INKASSO ZUERST UND NICHT ZULETZT ────────────────────────────────
// Der Auftrag nennt Onboarding zuerst. Fachlich muss der Rückstand aber vor
// dem Onboarding stehen: Wer im Rückstand ist, HAT bezahlt (sonst gäbe es
// keine Rate) und hat sein Startgespräch oft noch nicht geführt. Stünde
// Onboarding zuerst, verschluckte es jeden Mahnfall — und das
// Forderungsmanagement bekäme genau die Menschen nicht, um die es geht.
//
// ── WARUM „voll aktiv" ZUM VERTRIEB GEHÖRT ────────────────────────────────
// Der Auftrag nennt diesen Fall nicht. Ein bezahlter Kunde mit geführtem
// Startgespräch und ohne Rückstand ist Bestandspflege — und die liegt beim
// Vertrieb, wo auch die Betreuung eingetragen ist. Er fällt deshalb in Regel 3
// und nicht in ein viertes, unbesetztes Fach.
//
// ── WAS DIESE DATEI AUSDRÜCKLICH NICHT TUT ────────────────────────────────
// Sie ersetzt NICHT die Arbeitsliste des Forderungsmanagements.
//
// GEMESSEN am 21.08.2026: Die heutige Inkasso-Liste zeigt 339 Personen (jede
// offene Rate, auch eine noch nicht fällige). `zustaendigeRolle` mit X = 1
// sagt bei 151 Personen „inkasso". Würde die Liste ab jetzt diese Funktion
// lesen, verlöre das Forderungsmanagement 188 Menschen — und der Betreiber hat
// am 11.08.2026 ausdrücklich das Gegenteil gemeldet („Inkasso hat völlig
// falsche und viel zu wenig Kunden").
//
// Es sind zwei verschiedene Fragen:
//   „Wer ist ZUSTÄNDIG?"     eine Antwort je Mensch — für Termine, Panel,
//                            Übergabe, Warteschlangen-Vorrang.
//   „Wen bearbeitet Inkasso?" eine ARBEITSMENGE — darf breiter sein.
// Wer sie zusammenlegt, kürzt eine Arbeitsliste als Nebenwirkung einer
// Aufräumarbeit. Das steht hier, damit es niemand aus Ordnungsliebe tut.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export type ZustaendigeRolle = "vertrieb" | "onboarding" | "inkasso";

/**
 * Ab welcher Mahnstufe gilt eine offene Rate als RÜCKSTAND?
 *
 * ── DIE MESSUNG, DIE DIESE ZAHL BESTIMMT HAT (21.08.2026) ────────────────
 *     Mahnstufe 0:  234 Raten, 211 Personen   ← Rate angelegt, noch nicht fällig
 *     Mahnstufe 1:  123 Raten, 102 Personen   ← am Fälligkeitstag gemahnt
 *     Mahnstufe 2:   38 Raten,  38 Personen
 *     Mahnstufe 3:   10 Raten,  10 Personen
 *
 * Stufe 0 heißt „es gibt eine Rate", nicht „er zahlt nicht".
 *
 * ── WARUM DIESE ZAHL NUR NOCH EIN RÜCKFALL IST (21.08.2026, abends) ──────
 * Der Betreiber: „Überfälligkeit ab Tag 1." Das ist genauer als eine
 * Mahnstufe — denn die Mahnstufe steigt nur, wenn der Erinnerungslauf
 * durchgekommen ist. Bleibt er aus (und genau das ist am 19.08. drei Tage
 * lang passiert), bleibt ein Kunde auf Stufe 0 stehen, obwohl er seit zwei
 * Wochen nicht zahlt. Eine Zuständigkeit, die von einem Lauf abhängt, ist
 * keine Ableitung, sondern eine Nebenwirkung.
 *
 * Maßgeblich ist jetzt das DATUM (`faellig_am < heute`). Die Mahnstufe bleibt
 * als ODER-Bedingung: Wer schon gemahnt wurde, ist ein Fall, auch wenn das
 * Datum nachträglich verschoben wurde.
 */
export const RUECKSTAND_AB_MAHNSTUFE = 1;

/**
 * Ab wie vielen Tagen nach Fälligkeit ist eine Rate überfällig?
 *
 * 1 = ab dem Tag NACH der Fälligkeit. Am Fälligkeitstag selbst (Tag 0) geht
 * die Zahlungserinnerung raus; wer am selben Tag überweist, ist nicht im
 * Rückstand. Ein Mensch, der pünktlich zahlt, darf nicht am Morgen des
 * Fälligkeitstags im Forderungsmanagement stehen.
 */
export const UEBERFAELLIG_AB_TAGEN = 1;

export interface Zustaendigkeit {
  personId: number;
  /** Welche ROLLE gehört zu diesem Menschen? */
  rolle: ZustaendigeRolle;
  /** Warum — im Klartext, für Akte und Panel. Nicht nur fürs Log. */
  grund: string;
  /** Wer ist heute tatsächlich eingetragen? (`assigned_agent_id`) */
  agentId: number | null;
  agentName: string | null;
  /** Die Rolle des Eingetragenen — kann von `rolle` abweichen. */
  agentRolle: string | null;
  /**
   * Springt jemand aus einer anderen Rolle ein?
   *
   * Das ist erlaubt und manchmal nötig. Es darf nur nicht unbemerkt zum
   * Normalfall werden — deshalb hat es einen Namen und eine Admin-Liste.
   */
  vertretung: boolean;
}

/**
 * Die Bausteine der Ableitung — einmal als SQL, damit Listen sie brauchen können.
 *
 * ── VIER WEGE INS FORDERUNGSMANAGEMENT ────────────────────────────────────
 *   1. Die Rate ist seit mindestens einem Tag fällig      (das Datum, maßgeblich)
 *   2. Sie wurde schon gemahnt                            (Rückfall, falls das
 *      Datum verschoben wurde)
 *   3. Ein Inkasso-Mitarbeiter ist ihr zugewiesen          (jemand arbeitet daran)
 *   4. Der Betreiber hat den Fall von Hand markiert        (`inkasso_ab`)
 *
 * Nummer 4 ist der Knopf „Sofort ins Forderungsmanagement" — unabhängig vom
 * Datum. Er stand im Auftrag und gehört in dieselbe Bedingung: Eine
 * Handmarkierung, die die Ableitung nicht liest, ist ein Knopf ohne Wirkung.
 */
function rueckstandSql(p: string, abStufe: number): string {
  return `(EXISTS (
    SELECT 1 FROM fiaon_abo_raten r
    JOIN fiaon_applications ar ON ar.ref = r.ref
    WHERE ar.person_id = ${p}.id AND ar.merged_into IS NULL
      AND ar.gdpr_deleted_at IS NULL AND r.status <> 'bezahlt'
      AND (r.faellig_am < (CURRENT_DATE - ${UEBERFAELLIG_AB_TAGEN - 1}::int)
        OR r.mahnstufe >= ${abStufe}
        OR r.inkasso_agent_id IS NOT NULL))
    OR ${p}.inkasso_ab IS NOT NULL)`;
}

/**
 * Bezahltes PAKET — eine reine Bonitätsauskunft zählt nicht.
 *
 * Dieselbe Grenze wie in `fiaon-kundenstufe.ts`: Wer nur die Auskunft gekauft
 * hat, braucht kein Startgespräch, weil es kein Paket gibt, in das er
 * eingeführt werden müsste. Ihn dem Onboarding zuzuordnen wäre eine
 * Aufforderung zu einem Termin über nichts.
 */
function bezahltesPaketSql(p: string): string {
  return `EXISTS (
    SELECT 1 FROM fiaon_applications ap
    WHERE ap.person_id = ${p}.id AND ap.merged_into IS NULL
      AND ap.archived_at IS NULL AND ap.gdpr_deleted_at IS NULL
      AND ap.payment_status = 'paid'
      AND NOT (ap.type = 'schufa' OR ap.ref LIKE 'FIAON-SCHUFA-%'))`;
}

/**
 * Ist das Startgespräch erledigt — oder die Pflicht ausdrücklich ausgesetzt?
 *
 * Die Ausnahme kommt aus `fiaon-kundenstufe.ts` und ist dort begründet: Für
 * Härtefälle, mit Grund und Namen. Sie muss hier mit, sonst schickt die
 * Zuständigkeit einen Menschen ans Onboarding, den der Betreiber ausdrücklich
 * davon befreit hat.
 */
function onboardingErledigtSql(p: string): string {
  return `(EXISTS (
      SELECT 1 FROM fiaon_termine t
      WHERE t.person_id = ${p}.id AND t.quelle = 'onboarding_call'
        AND t.status = 'erledigt')
    OR EXISTS (
      SELECT 1 FROM fiaon_applications ax
      WHERE ax.person_id = ${p}.id AND ax.merged_into IS NULL
        AND ax.onboarding_pflicht = FALSE
        AND NULLIF(TRIM(COALESCE(ax.onboarding_ausnahme_grund, '')), '') IS NOT NULL))`;
}

/**
 * Die Ableitung als SQL-Ausdruck — für Abfragen über viele Menschen.
 *
 * ── WARUM ES BEIDE FASSUNGEN GIBT ────────────────────────────────────────
 * Die Arbeitsliste holt über 4.000 Personen in EINER Abfrage. Ein Aufruf je
 * Person wären 4.000 Abfragen — und dann baut jemand aus Not eine eigene
 * Ableitung in die Oberfläche. Genau so ist der Schaden vom 19.08. entstanden.
 *
 * Die TypeScript-Fassung `zustaendigeRolle` bewertet EINEN Menschen für die
 * Akte. `scripts/pruef-zustaendigkeit.ts` hält beide gegeneinander, an jeder
 * Konstellation im Bestand — sonst wären es wieder zwei Wahrheiten.
 */
export function zustaendigeRolleSql(
  p = "p", abStufe: number = RUECKSTAND_AB_MAHNSTUFE,
): string {
  return `CASE
    WHEN ${rueckstandSql(p, abStufe)} THEN 'inkasso'
    WHEN ${bezahltesPaketSql(p)} AND NOT ${onboardingErledigtSql(p)} THEN 'onboarding'
    ELSE 'vertrieb'
  END`;
}

/** Der Klartext-Grund zu einer Rolle — an EINER Stelle formuliert. */
export const ZUSTAENDIG_GRUND: Record<ZustaendigeRolle, string> = {
  inkasso: "Zahlungsrückstand — eine fällige Rate ist offen oder der Betreiber "
    + "hat den Fall dem Forderungsmanagement zugewiesen.",
  onboarding: "Paket bezahlt, Startgespräch noch nicht geführt.",
  vertrieb: "Kein Rückstand und kein offenes Startgespräch — Vertrieb betreut.",
};

/** Welche Mitarbeiter-Rollen erfüllen diese Zuständigkeit?
 *
 * ── E-045 (Justin 23.08., Plan §17): Bereiche zusammengelegt ─────────────
 * VORHER: onboarding: ["onboarding", …], vertrieb: ["agent", …] — getrennte
 * Bereiche, ein Vertriebsmitarbeiter galt beim Startgespräch als Vertretung.
 * NACHHER: EINE Rolle „Bonitätsmanager“ macht den ganzen Kundenweg — 'agent'
 * erfüllt auch die Onboarding-Zuständigkeit und umgekehrt. Die Terminart-
 * Beschriftung (Vertrieb/Startgespräch) bleibt; nur wer zuständig ist, ändert
 * sich. inkasso bleibt getrennt: Diana ist Back-Office Forderungen &
 * Zahlungen — die Reaktivierung eigener Kunden läuft für Bonitätsmanager
 * über den Besitz (freieSlots/terminBuchen buchen bei Besitz IMMER beim
 * Betreuer), nicht über diese Liste. */
export const ROLLEN_FUER: Record<ZustaendigeRolle, string[]> = {
  // Die Leitung darf überall einspringen, ohne dass es eine Vertretung ist.
  inkasso: ["inkasso", "vertriebsleiter", "admin"],
  onboarding: ["agent", "onboarding", "vertriebsleiter", "admin"],
  vertrieb: ["agent", "onboarding", "vertriebsleiter", "admin"],
};

/** Die eine Ableitung für EINEN Menschen. */
export async function zustaendigeRolle(
  personId: number, lauf: Lauf = sqlPool,
): Promise<Zustaendigkeit | null> {
  if (!Number.isFinite(personId) || personId <= 0) return null;
  const [r] = (await lauf.unsafe(`
    SELECT p.id,
           ${zustaendigeRolleSql("p")} AS rolle,
           p.assigned_agent_id AS agent_id,
           a.name AS agent_name,
           COALESCE(a.rolle, 'agent') AS agent_rolle
    FROM fiaon_persons p
    LEFT JOIN fiaon_agents a ON a.id = p.assigned_agent_id
    WHERE p.id = $1 AND p.merged_into_person_id IS NULL
  `, [personId])) as any[];
  if (!r) return null;

  const rolle = String(r.rolle) as ZustaendigeRolle;
  const agentRolle = r.agent_id != null ? String(r.agent_rolle) : null;
  return {
    personId: Number(r.id),
    rolle,
    grund: ZUSTAENDIG_GRUND[rolle],
    agentId: r.agent_id != null ? Number(r.agent_id) : null,
    agentName: r.agent_name ?? null,
    agentRolle,
    // Ohne Eingetragenen ist es keine Vertretung, sondern eine Lücke.
    vertretung: agentRolle != null && !ROLLEN_FUER[rolle].includes(agentRolle),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ROLLE BESTIMMT DIE TERMINART — NICHT UMGEKEHRT
//
// ── DIE LÜCKE, DIE DER BETREIBER GEFUNDEN HAT (21.08.2026) ────────────────
// „Du hast `zustaendigeRolle` gebaut, aber die Vergabe entscheidet weiterhin
// über die Terminart. Genau dort entsteht der Fehler."
//
// Er hat recht, und die Richtung war wirklich falsch herum:
//
//   VORHER   Der Buchungslink trug `?art=start`. Daraus wurde die Quelle
//            `onboarding_call`, daraus über `rolleFuerQuelle` die Rolle
//            „onboarding". Ein URL-Parameter entschied, wer den Kunden anruft.
//            Wer ihn wegliess, buchte ein VERTRIEBSGESPRÄCH für einen
//            Menschen, der längst bezahlt hat — und der sass dann in einem
//            Verkaufsgespräch über ein Paket, das er besitzt.
//
//   JETZT    Der Zustand des Menschen entscheidet die Gesprächsart, und die
//            Gesprächsart bestimmt die Rolle. Der Link braucht keinen
//            Parameter mehr; ein mitgeschickter wird vermerkt und verworfen.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Welche Gesprächsart gehört zu welcher Zuständigkeit?
 *
 * Bewusst Zeichenketten und nicht der Typ `TerminQuelle`: Sonst müsste diese
 * Datei `fiaon-termine.ts` importieren, und die importiert diese — ein Kreis,
 * den Node beim Start mit einer halb gefüllten Datei auflöst.
 * `scripts/pruef-zustaendigkeit-abo.ts` prüft, dass jeder Wert hier in
 * `QUELLEN` steht; ohne diese Prüfung wäre die Trennung eine Wette.
 */
export const QUELLE_FUER_ROLLE: Record<ZustaendigeRolle, string> = {
  onboarding: "onboarding_call",
  vertrieb: "nichterreicht_mail",
  inkasso: "inkasso_call",
};

export interface Terminentscheid {
  /** Die Gesprächsart — abgeleitet, nicht übergeben. */
  quelle: string;
  zustaendig: ZustaendigeRolle;
  /** Welche Mitarbeiter-Rollen dürfen es führen? */
  rollen: string[];
  grund: string;
  /**
   * Wurde eine mitgeschickte Gesprächsart verworfen? Dann steht sie hier.
   * Nur fürs Protokoll: Ein stillschweigend überschriebener Parameter ist
   * genau die Art Änderung, die man später nicht mehr erklären kann.
   */
  verworfen: string | null;
}

/**
 * Welche Gesprächsart und welche Rolle gehören zu DIESEM Menschen?
 *
 * Der eine Ort. Gelesen von: öffentlichem Buchungslink, Slot-Anzeige,
 * Buchungsannahme, Vollpfleger, Übergabe-Knopf, Telefon-Panel.
 *
 * @param gewuenscht Was der Aufrufer mitgeschickt hat (z. B. aus `?art=`).
 *                   Wird NICHT befolgt, sondern nur vermerkt.
 */
export async function terminartFuerPerson(
  personId: number, gewuenscht: string | null = null, lauf: Lauf = sqlPool,
): Promise<Terminentscheid | null> {
  const z = await zustaendigeRolle(personId, lauf);
  if (!z) return null;
  const quelle = QUELLE_FUER_ROLLE[z.rolle];
  return {
    quelle,
    zustaendig: z.rolle,
    rollen: ROLLEN_FUER[z.rolle],
    grund: z.grund,
    verworfen: gewuenscht && gewuenscht !== quelle ? gewuenscht : null,
  };
}

/**
 * Erfüllt diese Mitarbeiter-Rolle die Zuständigkeit für diesen Menschen?
 *
 * Das ist die Frage, die Terminvergabe und Übergabe stellen. Sie ist NICHT
 * dieselbe wie `darfAnKunde` (Zugriffsrecht) — ein Vertriebsmitarbeiter DARF
 * an seinen Kunden, auch wenn gerade das Onboarding zuständig ist.
 */
export async function rolleErfuellt(
  personId: number, mitarbeiterRolle: string, lauf: Lauf = sqlPool,
): Promise<{ erfuellt: boolean; soll: ZustaendigeRolle | null; grund: string }> {
  const z = await zustaendigeRolle(personId, lauf);
  if (!z) return { erfuellt: false, soll: null, grund: "Diesen Kunden gibt es nicht." };
  const erfuellt = ROLLEN_FUER[z.rolle].includes(String(mitarbeiterRolle));
  return {
    erfuellt, soll: z.rolle,
    grund: erfuellt ? z.grund
      : `Zuständig ist ${z.rolle} — ${z.grund} Wer aus einer anderen Rolle `
        + "übernimmt, tut es als Vertretung.",
  };
}
