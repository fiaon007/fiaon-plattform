// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Vertriebs-Arbeitsliste, Mandate, volle Akte (23.08.2026)
// E-043 (Plan §15) + E-044/§16/§16a.
//
//   GET  /agent/vertrieb/arbeitsliste        → 6 Slots (2+2+2) + Zähler + Mandate
//   POST /agent/vertrieb/mandat/:personId    → Mandat übernommen (mandat_seit)
//   GET  /agent/vertrieb/mandate             → Mandats-Kennungen + Anzahl (x/500)
//   GET  /agent/vertrieb/aktivitaet/:personId→ Zeitleiste ALLER Kundenereignisse
//                                              + Vollständigkeit (Kartenstatus)
//   GET  /agent/vertrieb/frei                → E-048: meine nächsten freien
//                                              Termin-Zeiten (klickbare Slots)
//   GET  /agent/vertrieb/bestand             → E-050 (§19): Portfolio der
//                                              MANDATIERTEN Kunden — je Mandat
//                                              Karte + Raten-Stand + SEPA +
//                                              Monatsrate (für /agent/bestand)
//
// ── §16a: „Aktive Kunden“ zählen NUR übernommene Mandate ───────────────────
// VORHER zählte die Oberfläche alle bezahlten/zugewiesenen Kunden. GEPRÜFT:
// `betreuung_seit` taugt nicht als Mandatsmarke — `betreuungMerken` (lib/tier.ts)
// setzt sie bei JEDEM dokumentierten Ergebnis (auch „nicht erreicht“), und die
// Zuteilung trägt sie nach. Deshalb NEUES, rein additives Feld
// `fiaon_persons.mandat_seit` (ADD COLUMN IF NOT EXISTS, unten): Es wird
// AUSSCHLIESSLICH beim Buchen von „Mandat angenommen“ gesetzt (COALESCE –
// der erste Zeitpunkt gewinnt). NACHHER: „Aktive Kunden x/500“ liest nur
// dieses Feld; bloße Zuweisung zählt nicht.
//
// KEINE eigenen Bausteine: Kartenform (KARTE_SQL/karte) und Ausschlüsse
// (ruhtSql, wartetSql, is_blocked, ist_test_am, Wiedervorlage) kommen aus
// derselben Quelle wie /agent/kunden/liste. „Kein Interesse“ braucht KEINE
// neue Tabelle: `erreicht_abgelehnt` setzt `is_blocked`, das Verteilung und
// alle Listen schon respektieren.
//
// ── §16: kundeVollstaendig() ist die EINE Wahrheit für den Kartenstatus ────
// Paket bezahlt + SCHUFA (pack_key='schufa') bezahlt + Kontoauszug + Ausweis.
// Exportiert — das Chefbüro (Admin) nutzt dieselbe Funktion später.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { KARTE_SQL, karte } from "./fiaon-agent-start";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { wartetSql } from "../lib/fiaon-warten";
import { ensureKartenSpalten } from "../lib/fiaon-kartenstatus";
import { ensureBetreuungSpalte } from "../lib/tier";
import { rohSlots, dauerFuer } from "../lib/fiaon-termine";

const router = Router();

const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;
export const MANDATE_MAX = 500;

/** Rein additive Spalte für §16a — memoisiert wie ensureBetreuungSpalte. */
let vertriebBereit: Promise<void> | null = null;
function ensureVertriebSpalten(): Promise<void> {
  if (!vertriebBereit) {
    vertriebBereit = (async () => {
      // lock_timeout: Ein ALTER, das hinter einer langen Transaktion wartet
      // (z. B. der Bereinigung vom 23.08.), würde ALLE nachfolgenden Abfragen
      // auf fiaon_persons in die Warteschlange zwingen – die Seite stünde.
      // Lieber nach 3 s aufgeben und beim nächsten Aufruf erneut versuchen.
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS mandat_seit TIMESTAMPTZ`;
      });
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_persons_mandat_idx ON fiaon_persons (assigned_agent_id) WHERE mandat_seit IS NOT NULL`;
    })().catch((e) => { vertriebBereit = null; throw e; });
  }
  return vertriebBereit;
}

/** Eigener Kunde? Dieselbe Grenze wie meinePerson in fiaon-agent-kunden.ts. */
async function eigene(personId: number, agentId: number): Promise<boolean> {
  const [p] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId} AND assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}

// ═══════════════════════════════════════════════════════════════════════════
// DARF DIESER MENSCH DIE AKTE LESEN? (24.08.2026, Justin)
//
// VORHER: Die Akte-Zeitleiste (/agent/vertrieb/aktivitaet/:personId) fragte
// NUR `eigene()`. Seit Collections dieselbe Akte öffnet wie die Pipeline,
// stand das Forderungsmanagement damit vor einer verschlossenen Tür: Diana
// (Rolle „inkasso") betreut niemanden, ihre Fälle sind fremde Kunden mit
// offener Rate. Ergebnis wäre eine Akte ohne Situations-Kopf gewesen — genau
// der Zweig „Rate überfällig" hängt an dieser Antwort.
//
// NACHHER: erst der eigene Kunde (billig, eine Zeile), sonst die EINE
// Definition aus fiaon-kundenzugriff (`darfAnKunde`): Leitung alles, Inkasso
// nur Menschen mit offener Rate, Onboarding nur seine Startgespräche. Für den
// gewöhnlichen Bonitätsmanager ändert sich nichts — er kommt schon über
// `eigene()` durch. Umgangen wird nichts: Geschrieben wird weiterhin nur, wo
// die jeweilige Route es erlaubt.
// ═══════════════════════════════════════════════════════════════════════════
async function darfAkteLesen(personId: number, agentId: number): Promise<boolean> {
  if (await eigene(personId, agentId)) return true;
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  return darfAnKunde(agentId, await rolleVon(agentId), personId);
}

// ═══════════════════════════════════════════════════════════════════════════
// §16: Ist der Kunde VOLLSTÄNDIG? — die eine, exportierte Wahrheit.
//   Paket bezahlt UND SCHUFA (74 €, pack_key='schufa') bezahlt UND
//   Kontoauszug (bank_statement_pdf) UND Ausweis (id_card_pdf) vorhanden.
// Erst dann: „Vollständig – liegt bei FIAON zur Bearbeitung“; sonst überall
// der Platzhalter „In Bearbeitung“.
// ═══════════════════════════════════════════════════════════════════════════
export async function kundeVollstaendig(personId: number): Promise<{
  vollstaendig: boolean; paketBezahlt: boolean; schufaBezahlt: boolean; kontoauszug: boolean; ausweis: boolean;
}> {
  const [z] = (await sqlPool`
    SELECT
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = 'paid'
          AND COALESCE(a.pack_key, '') <> 'schufa') AS paket,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = 'paid'
          AND (a.pack_key = 'schufa' OR a.pack_name ILIKE '%bonität%' OR a.pack_name ILIKE '%schufa%')) AS schufa,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL
          AND a.bank_statement_pdf IS NOT NULL) AS kontoauszug,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.merged_into IS NULL
          AND a.id_card_pdf IS NOT NULL) AS ausweis
  `) as any[];
  const paketBezahlt = !!z?.paket, schufaBezahlt = !!z?.schufa, kontoauszug = !!z?.kontoauszug, ausweis = !!z?.ausweis;
  return { vollstaendig: paketBezahlt && schufaBezahlt && kontoauszug && ausweis, paketBezahlt, schufaBezahlt, kontoauszug, ausweis };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-046: DIE EINE SITUATION JE KUNDE (Justin 23.08.: „Ich sehe nicht, was ich
// zu tun habe – das muss auf 1 Blick zu sehen und auf 1 Klick zu handeln sein“)
//
// VORHER zeigte die Akte den tier-Hinweis („Die Zahlung ist eingegangen …“)
// NEBEN einer überfälligen Rate — zwei Wahrheiten, ein Widerspruch. NACHHER
// wird die Situation HIER abgeleitet, serverseitig und exportiert (das
// Chefbüro spiegelt sie später). Priorität:
//   rate_ueberfaellig → zusage_gebrochen → rueckruf_faellig →
//   bezahlt_ohne_termin → zahlung_gemeldet → rechnung_offen →
//   lead_ohne_antrag → termin_heute → alles_gut
// ═══════════════════════════════════════════════════════════════════════════
export type SituationsArt = "rate_ueberfaellig" | "zusage_gebrochen" | "rueckruf_faellig"
  | "bezahlt_ohne_termin" | "zahlung_gemeldet" | "rechnung_offen" | "lead_ohne_antrag"
  | "termin_heute" | "alles_gut";
export interface KundenSituation {
  art: SituationsArt;
  rate: { id: number; nr: number; betragCents: number; faelligAm: string; tage: number; referenz: string | null;
    lastschriftStatus: string | null; lastschriftGrund: string | null; sepaEingerichtet: boolean } | null;
  zusageAm: string | null;
  rueckrufAm: string | null;
  /** Nächster gebuchter Termin in der Zukunft. */
  terminAm: string | null;
  /** Ein gebuchter Termin, dessen Zeitpunkt erreicht/ueberschritten ist. */
  terminFaelligAm?: string | null;
  terminHeute: string | null;
  /** Gesprächsart des heutigen Termins — der Leitfaden richtet sich danach. */
  terminHeuteQuelle: string | null;
  naechsteRate: { faelligAm: string; betragCents: number } | null;
  tier: number;
}
export async function kundenSituation(personId: number): Promise<KundenSituation | null> {
  const [z] = (await sqlPool`
    SELECT p.priority_tier, p.promised_payment_date,
      (SELECT row_to_json(x) FROM (
         SELECT r.id, r.rate_nr, r.betrag_cents, r.faellig_am, r.zahlungsreferenz,
                ((NOW() AT TIME ZONE 'Europe/Berlin')::date - r.faellig_am)::int AS tage,
                -- E-047/§18 Nr. 9: der GRUND an der Rate (SEPA fehlt / Rücklastschrift / offen)
                r.lastschrift_status, r.lastschrift_grund, p.gc_mandate_status
         FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
         WHERE a.person_id = p.id AND a.merged_into IS NULL
           AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
           AND r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date
         ORDER BY r.faellig_am LIMIT 1) x) AS rate,
      (SELECT cl.scheduled_at FROM fiaon_contact_log cl
         JOIN fiaon_applications a2 ON a2.ref = cl.ref
         WHERE a2.person_id = p.id AND cl.outcome = 'rueckruf_termin'
           AND cl.done_at IS NULL AND cl.voided_at IS NULL
           AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()
         ORDER BY cl.scheduled_at DESC LIMIT 1) AS rueckruf_am,
      EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id
        AND a3.merged_into IS NULL AND a3.archived_at IS NULL
        AND a3.payment_status = 'paid') AS bezahlt,
      (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL AND t.beginn > NOW() ORDER BY t.beginn LIMIT 1) AS termin_am,
      (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL
         AND (t.beginn AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
         ORDER BY t.beginn LIMIT 1) AS termin_heute,
      -- 25.08.2026 (Florentine): „Ich führe ein Onboarding-Gespräch, bekomme
      -- aber einen Leitfaden, der zu einem Zahlungsrückstand gehört." Die Art
      -- des HEUTIGEN Termins entscheidet mit, welcher Leitfaden aufgeht —
      -- dafür muss sie hier mitkommen.
      (SELECT t.quelle FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL
         AND (t.beginn AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
         ORDER BY t.beginn LIMIT 1) AS termin_heute_quelle,
      -- 24.08.2026: NEU. Der Filter „Termin faellig" im Bestand-Raum konnte
      -- per Konstruktion nie etwas finden: termin_am liefert nur Termine in
      -- der ZUKUNFT (t.beginn > NOW()), und ein faelliger Termin liegt per
      -- Definition in der Vergangenheit. Dieses Feld nennt den aeltesten
      -- gebuchten Termin, dessen Zeitpunkt erreicht oder ueberschritten ist
      -- und der noch nicht erledigt wurde — genau das, was „faellig" heisst.
      (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL AND t.erledigt_am IS NULL AND t.beginn <= NOW()
         ORDER BY t.beginn LIMIT 1) AS termin_faellig_am,
      (SELECT row_to_json(y) FROM (
         SELECT r.faellig_am, r.betrag_cents
         FROM fiaon_abo_raten r JOIN fiaon_applications a4 ON a4.ref = r.ref
         WHERE a4.person_id = p.id AND a4.merged_into IS NULL
           AND r.status <> 'bezahlt' AND r.storniert_am IS NULL
           AND r.faellig_am >= (NOW() AT TIME ZONE 'Europe/Berlin')::date
         ORDER BY r.faellig_am LIMIT 1) y) AS naechste_rate
    FROM fiaon_persons p
    WHERE p.id = ${personId} AND p.merged_into_person_id IS NULL
  `.catch(() => [] as any[])) as any[];
  if (!z) return null;
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const tier = Number(z.priority_tier);
  const rate = z.rate ? {
    id: Number(z.rate.id), nr: Number(z.rate.rate_nr), betragCents: Number(z.rate.betrag_cents || 0),
    faelligAm: String(z.rate.faellig_am), tage: Number(z.rate.tage || 0),
    referenz: z.rate.zahlungsreferenz ?? null,
    lastschriftStatus: z.rate.lastschrift_status ?? null,
    lastschriftGrund: z.rate.lastschrift_grund ?? null,
    sepaEingerichtet: String(z.rate.gc_mandate_status || "") === "active",
  } : null;
  const zusageGebrochen = z.promised_payment_date && String(z.promised_payment_date).slice(0, 10) < heute;
  const art: SituationsArt =
    rate ? "rate_ueberfaellig"
    : zusageGebrochen ? "zusage_gebrochen"
    : z.rueckruf_am ? "rueckruf_faellig"
    : (z.bezahlt && !z.termin_am && !z.termin_heute) ? "bezahlt_ohne_termin"
    : tier === 1 ? "zahlung_gemeldet"
    : tier === 2 ? "rechnung_offen"
    : tier === 3 ? "lead_ohne_antrag"
    : z.termin_heute ? "termin_heute"
    : "alles_gut";
  return {
    art, rate,
    zusageAm: z.promised_payment_date ? String(z.promised_payment_date).slice(0, 10) : null,
    rueckrufAm: z.rueckruf_am ?? null,
    terminAm: z.termin_am ?? null,
    terminFaelligAm: z.termin_faellig_am ?? null,
    terminHeute: z.termin_heute ?? null,
    terminHeuteQuelle: z.termin_heute_quelle ?? null,
    naechsteRate: z.naechste_rate ? { faelligAm: String(z.naechste_rate.faellig_am), betragCents: Number(z.naechste_rate.betrag_cents || 0) } : null,
    tier,
  };
}

/** Die Mandats-Zahlen eines Mitarbeiters — nur mandat_seit zählt (§16a). */
async function mandatsZahlen(agentId: number): Promise<{ anzahl: number; ids: number[] }> {
  await ensureVertriebSpalten();
  const rows = (await sqlPool`
    SELECT id FROM fiaon_persons
    WHERE assigned_agent_id = ${agentId} AND mandat_seit IS NOT NULL
      AND merged_into_person_id IS NULL AND ist_test_am IS NULL AND NOT is_blocked
  `) as any[];
  return { anzahl: rows.length, ids: rows.map((r) => Number(r.id)) };
}

/** Die drei Gruppen der Arbeitsliste — Übersetzung des vorhandenen priority_tier. */
const GRUPPEN: { key: string; tier: number }[] = [
  { key: "bezahlt_gemeldet", tier: 1 },
  { key: "rechnung_offen", tier: 2 },
  { key: "lead", tier: 3 },
];
const JE_GRUPPE = 2;
const SLOTS = 6;

/**
 * Zieht Nachschub aus dem Kundenpool, bis der Mitarbeiter je Stufe wieder
 * zwei arbeitbare Menschen hat. Läuft vor jedem Aufbau der Arbeitsliste.
 *
 * Drei Schutzregeln:
 *  1. Testkonten ziehen NIE — sonst griffe das Prüfkonto nach echten Kunden.
 *  2. Diana (531) zieht nicht, solange ihr Arbeitssystem ungeklärt ist.
 *  3. Liegengelassenes fällt zurück: Wer zieht und drei Tage lang nichts tut
 *     (kein Verlaufseintrag, kein Termin, kein Mandat), gibt den Menschen
 *     wortlos an den Pool zurück. So sperrt kein Urlaub den Nachschub.
 *
 * Reihenfolge im Pool: Leads (Stufe 3) NEUESTE zuerst — die Abschlussquote
 * fällt mit jeder Stunde seit der Anfrage (Speed-to-Lead). Stufe 1 und 2
 * ÄLTESTE zuerst — diese Menschen warten auf uns, nicht umgekehrt.
 */
const POOL_RUECKFALL_TAGE = 3;
/** Angefangen und liegen gelassen — nach drei Wochen gehört der Mensch wieder allen. */
const POOL_LIEGEN_TAGE = 21;
async function poolNachschub(me: number, istTestkonto: boolean): Promise<void> {
  if (istTestkonto || me === 531) return;

  // ── ZWEI RÜCKFÄLLE, NICHT EINER (26.08.2026, Florentines Punkt 9) ────────
  // „In der Pipeline sollten grundsätzlich keine festen Betreuer bei den
  // Kunden hinterlegt sein."
  //
  // Der Kundenpool erfüllt das für NEUE Menschen: Sie gehören niemandem, bis
  // ein Mandat steht. Was Florentine sieht, sind Altzuteilungen — Menschen,
  // mit denen schon jemand gesprochen hat.
  //
  // Die zieht man nicht pauschal ab: Wer angerufen wurde, soll nicht am
  // nächsten Tag von einem Zweiten angerufen werden. Aber ewig blockieren
  // darf eine einzige Berührung auch nicht. Deshalb zwei Fristen:
  //   · 3 Tage  — gezogen und NICHTS getan (kein Kontakt, kein Termin)
  //   · 21 Tage — angefangen und dann liegen gelassen
  // Beides nur ohne Mandat. Wer ein Mandat hat, behält den Kunden.
  await sqlPool.unsafe(`
    UPDATE fiaon_persons p SET assigned_agent_id = NULL
     WHERE p.mandat_seit IS NULL AND p.assigned_agent_id IS NOT NULL
       AND p.assigned_at < NOW() - INTERVAL '${POOL_RUECKFALL_TAGE} days'
       AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
       AND NOT p.is_blocked AND p.priority_tier IN (1,2,3)
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c1 JOIN fiaon_applications ax ON ax.ref = c1.ref WHERE ax.person_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c2 WHERE c2.person_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine tx WHERE tx.person_id = p.id)`);

  await sqlPool.unsafe(`
    UPDATE fiaon_persons p SET assigned_agent_id = NULL
     WHERE p.mandat_seit IS NULL AND p.assigned_agent_id IS NOT NULL
       AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
       AND NOT p.is_blocked AND p.priority_tier IN (1,2,3)
       AND p.promised_payment_date IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine t2
                        WHERE t2.person_id = p.id AND t2.status = 'gebucht'
                          AND t2.abgesagt_am IS NULL AND t2.beginn > NOW())
       AND COALESCE(
             (SELECT MAX(c3.created_at) FROM fiaon_contact_log c3 WHERE c3.person_id = p.id),
             (SELECT MAX(c4.created_at) FROM fiaon_contact_log c4
                JOIN fiaon_applications a4 ON a4.ref = c4.ref WHERE a4.person_id = p.id),
             p.assigned_at
           ) < NOW() - INTERVAL '${POOL_LIEGEN_TAGE} days'`);

  for (const g of GRUPPEN) {
    const [zeile] = (await sqlPool.unsafe(`
      SELECT COUNT(*)::int AS n FROM fiaon_persons p
       WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
         AND p.ist_test_am IS NULL AND NOT p.is_blocked
         AND NOT ${ruhtSql("p")} AND NOT ${wartetSql("p")}
         AND (p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})
         AND NOT EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id
               AND tz.status = 'gebucht' AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())
         AND p.priority_tier = ${g.tier}`, [me])) as any[];
    const fehlt = JE_GRUPPE - Number(zeile?.n ?? 0);
    if (fehlt <= 0) continue;
    await sqlPool.unsafe(`
      UPDATE fiaon_persons SET assigned_agent_id = $1, assigned_at = NOW()
       WHERE id IN (
         SELECT p.id FROM fiaon_persons p
          WHERE p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL
            AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
            AND NOT p.is_blocked AND NOT ${ruhtSql("p")} AND NOT ${wartetSql("p")}
            AND p.priority_tier = ${g.tier}
          ORDER BY p.created_at ${g.tier === 3 ? "DESC" : "ASC"}
          LIMIT ${fehlt}
          FOR UPDATE SKIP LOCKED)`, [me]);
  }
}

router.get("/agent/vertrieb/arbeitsliste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { istInkasso } = await import("./fiaon-inkasso-bereich");
    if (await istInkasso(req.agent!.id)) {
      return res.status(404).json({ ok: false, error: "Diese Liste gibt es für dich nicht — deine Arbeit steht unter „Forderungen“." });
    }
    // E-045 (Plan §17): VORHER bekam die Rolle „onboarding" eine leere Liste —
    // NACHHER ist sie Bonitätsmanager wie alle und arbeitet ihre zugewiesenen
    // Kunden. (Ohne Bestand ist die Liste von selbst leer.)

    await ensureKartenSpalten();
    await ensureBetreuungSpalte(sqlPool);
    await ensureVertriebSpalten();
    const me = req.agent!.id;

    // ══════════════════════════════════════════════════════════════════════
    // DER KUNDENPOOL (25.08.2026, Justins Festlegung)
    //
    // „KEINE Kunden sind dem Mitarbeiter zugeteilt, bis er das Mandat
    // akzeptiert — wir geben diese aus einem Kundenpool aus."
    //
    // VORHER war jeder Lead fest einem Mitarbeiter zugewiesen; am Mittag des
    // 25.08. wurde der unberuehrte Vorrat deshalb muehsam fair umverteilt
    // (2.894 lagen bei den vier Erfahrenen, 3 bei den vier Neuen). Der Pool
    // macht diese Sorte Pflege ueberfluessig: Unberuehrte Menschen gehoeren
    // NIEMANDEM (assigned_agent_id IS NULL). Die Arbeitsliste ZIEHT sich ihre
    // zwei je Stufe hier — wer arbeitet, bekommt Nachschub; wer nicht
    // arbeitet, hortet nichts. Fairness ist damit eine Eigenschaft des
    // Systems, keine wiederkehrende Aufraeumaktion.
    //
    // Erst „Mandat angenommen" bindet dauerhaft (mandat_seit). Wer angerufen
    // wurde, bleibt beim Anrufer, bis der Fall entschieden ist — eine
    // angefangene Beziehung wird nie zerrissen.
    // ══════════════════════════════════════════════════════════════════════
    await poolNachschub(me, req.agent!.is_test_account === true);

    // Gemeinsame Ausschlüsse — dieselben Bausteine wie die große Liste, plus:
    // ein gebuchter Termin in der Zukunft heißt „Mandat angenommen“ — raus.
    const basis = [
      "p.assigned_agent_id = $1",
      "p.merged_into_person_id IS NULL",
      "p.ist_test_am IS NULL",
      "NOT p.is_blocked",
      `NOT ${ruhtSql("p")}`,
      `NOT ${wartetSql("p")}`,
      `(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})`,
      // ══════════════════════════════════════════════════════════════════════
      // WER FÜR MORGEN ZAHLEN WILL, IST HEUTE NICHT DRAN
      // (26.08.2026, Florentines Punkt 6)
      //
      // „Wenn ein Kunde in der Pipeline bereits bearbeitet und beispielsweise
      // als ‚zahlt an' markiert wurde, erscheint dieser teilweise anschließend
      // wieder in der Pipeline zur Bearbeitung."
      //
      // GEMESSEN: 16 Menschen mit einer Zusage in der ZUKUNFT standen wieder
      // in der Arbeitsliste — bei 14 davon war GAR KEINE Wiedervorlage
      // gesetzt. Die Ergebnis-Buchung setzt sie korrekt; offenbar entstand die
      // Zusage anderswo (Verwaltung, Kundenmeldung) und die Wiedervorlage
      // blieb leer.
      //
      // Der Filter greift deshalb HIER, auf der Leseseite: Eine Zusage für
      // morgen schließt den Menschen heute aus — unabhängig davon, ob
      // irgendein Schreibweg an die Wiedervorlage gedacht hat. Eine Regel an
      // einer Stelle kann nicht vergessen werden; fünf Schreibwege schon.
      //
      // Läuft das Datum ab, kommt der Mensch von selbst zurück — dann als
      // „Zusage gebrochen", was die richtige Ansprache ist.
      // ══════════════════════════════════════════════════════════════════════
      `(p.promised_payment_date IS NULL OR p.promised_payment_date < ${HEUTE})`,
      `NOT EXISTS (
         SELECT 1 FROM fiaon_termine tz
         WHERE tz.person_id = p.id AND tz.status = 'gebucht'
           AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())`,
      // ══════════════════════════════════════════════════════════════════════
      // WER HEUTE SCHON ERREICHT WURDE, IST HEUTE FERTIG (P15, 28.08.2026)
      //
      // „Kunde A abgeschlossen, Kunde B abgeschlossen — danach erscheint
      // Kunde A wieder. Die Pipeline dreht sich um dieselben Kunden."
      //
      // Die Ausschlüsse oben kannten Zusage, Termin und Wiedervorlage — aber
      // NICHT das schlichte „das Gespräch fand heute statt". Ein Ergebnis wie
      // „Erreicht/Sonstiges" ohne Folgetermin ließ den Menschen sofort wieder
      // in die Slots, und die Sortierung (updated_at DESC) stellte ihn sogar
      // nach VORN. Ab jetzt: Ein „erreicht"-Ergebnis vom heutigen Tag nimmt
      // ihn für den Rest des Tages aus der Liste — morgen ist er regulär
      // wieder dran, falls nichts anderes ihn hält.
      // ══════════════════════════════════════════════════════════════════════
      `NOT EXISTS (
         SELECT 1 FROM fiaon_contact_log clh
         JOIN fiaon_applications ah ON ah.ref = clh.ref
         WHERE ah.person_id = p.id AND clh.type = 'result'
           AND clh.outcome LIKE 'erreicht%'
           AND (clh.created_at AT TIME ZONE 'Europe/Berlin')::date
             = (NOW() AT TIME ZONE 'Europe/Berlin')::date)`,
    ].join(" AND ");

    const ordnung = `
      CASE
        WHEN p.promised_payment_date IS NOT NULL AND p.promised_payment_date <= ${HEUTE} THEN 0
        WHEN EXISTS (
          SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
          WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
            AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW()
        ) THEN 1
        ELSE 2
      END,
      COALESCE(p.updated_at, p.created_at) DESC NULLS LAST,
      p.id DESC`;

    // §16: Vollständigkeit als Spalten direkt an der Karte — dieselbe Regel
    // wie kundeVollstaendig(), damit die 6 Slots keinen zweiten Weg brauchen.
    const VOLL_SQL = `
      (EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid' AND COALESCE(a.pack_key,'') <> 'schufa')
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid'
         AND (a.pack_key = 'schufa' OR a.pack_name ILIKE '%bonität%' OR a.pack_name ILIKE '%schufa%'))
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.bank_statement_pdf IS NOT NULL)
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.id_card_pdf IS NOT NULL)) AS voll_kunde`;

    const mandate = await mandatsZahlen(me);
    const [g1, g2, g3, zaehlerR] = await Promise.all([
      ...GRUPPEN.map((g) => sqlPool.unsafe(
        `SELECT ${KARTE_SQL}, p.mandat_seit, ${VOLL_SQL} FROM fiaon_persons p
         WHERE ${basis} AND p.priority_tier = ${g.tier}
         ORDER BY ${ordnung} LIMIT ${SLOTS}`, [me],
      )),
      sqlPool.unsafe(
        `SELECT
           COUNT(*) FILTER (WHERE p.priority_tier = 1)::int AS bezahlt_gemeldet,
           COUNT(*) FILTER (WHERE p.priority_tier = 2)::int AS rechnung_offen,
           COUNT(*) FILTER (WHERE p.priority_tier = 3)::int AS lead
         FROM fiaon_persons p WHERE ${basis}`, [me],
      ),
    ]);

    const toepfe: { key: string; rows: any[] }[] = [
      { key: "bezahlt_gemeldet", rows: g1 as any[] },
      { key: "rechnung_offen", rows: g2 as any[] },
      { key: "lead", rows: g3 as any[] },
    ];
    const slot = (key: string, r: any) => ({
      gruppe: key,
      kunde: { ...karte(r), mandatSeit: r.mandat_seit ?? null, vollstaendig: !!r.voll_kunde },
    });
    const slots: { gruppe: string; kunde: any }[] = [];
    for (const t of toepfe) for (const r of t.rows.splice(0, JE_GRUPPE)) slots.push(slot(t.key, r));
    for (const t of toepfe) while (slots.length < SLOTS && t.rows.length > 0) slots.push(slot(t.key, t.rows.shift()));

    const z = (zaehlerR as any[])[0] || {};
    res.json({
      ok: true,
      rolle: "agent",
      slots,
      zaehler: {
        bezahlt_gemeldet: Number(z.bezahlt_gemeldet || 0),
        rechnung_offen: Number(z.rechnung_offen || 0),
        lead: Number(z.lead || 0),
      },
      mandate: { anzahl: mandate.anzahl, max: MANDATE_MAX },
    });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] arbeitsliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── §16a: Mandat übernehmen — beim Buchen von „Mandat angenommen“ ──────────
router.post("/agent/vertrieb/mandat/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureVertriebSpalten();
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    if (!(await eigene(personId, req.agent!.id))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    // ══════════════════════════════════════════════════════════════════════
    // DAS MANDAT SETZT AUCH DEN BETREUER (26.08.2026, Florentines Punkt 5)
    //
    // „Kunden, die aus der Pipeline als Mandat angenommen werden, landen
    // teilweise nicht korrekt im Bestand des zuständigen Mitarbeiters.
    // Dadurch besteht die Gefahr, dass der Kunde anschließend bei einem
    // anderen Betreuer im Bestand landet."
    //
    // BEFUND: Hier stand nur `mandat_seit`. Wer das Mandat GEWANN, wurde
    // nirgends festgeschrieben — der Kunde blieb bei dem, der ihn zufällig
    // aus dem Pool gezogen hatte. Das ist genau der gemeldete Fall.
    //
    // NACHHER setzt das Mandat beides: den Zeitpunkt UND die Zuständigkeit
    // auf den Menschen, der es geholt hat. Das ist die Regel aus
    // Justins Punkt 9: „Kunde wird dem Vertriebler zugeordnet, der das
    // Mandat gewonnen hat → Kunde landet bei diesem Mitarbeiter im Bestand."
    //
    // Ein bereits bestehendes Mandat wird NICHT umgeschrieben (COALESCE):
    // Wer ein Mandat hat, behält es — sonst könnte ein zweiter Anruf einen
    // fremden Kunden übernehmen.
    // ══════════════════════════════════════════════════════════════════════
    const [vorher] = (await sqlPool`
      SELECT mandat_seit, assigned_agent_id FROM fiaon_persons WHERE id = ${personId}`) as any[];
    const schonMandat = !!vorher?.mandat_seit;

    const [r] = (await sqlPool`
      UPDATE fiaon_persons
      SET mandat_seit = COALESCE(mandat_seit, NOW()),
          assigned_agent_id = CASE WHEN mandat_seit IS NULL THEN ${req.agent!.id} ELSE assigned_agent_id END,
          assigned_at = CASE WHEN mandat_seit IS NULL THEN NOW() ELSE assigned_at END,
          updated_at = NOW()
      WHERE id = ${personId}
      RETURNING mandat_seit, assigned_agent_id
    `) as any[];

    // Der Wechsel gehört in den Verlauf: Ein Kunde, der plötzlich bei einem
    // anderen Menschen liegt, muss erklärbar sein.
    if (!schonMandat && Number(vorher?.assigned_agent_id ?? 0) !== req.agent!.id) {
      // `fiaon_contact_log.ref` ist NOT NULL — ohne Akte scheitert der
      // Eintrag still. `sorgeFuerAkte` legt sie an, falls sie fehlt.
      try {
        const { sorgeFuerAkte } = await import("../lib/fiaon-akte-anker");
        const ref = await sorgeFuerAkte(personId, req.agent!.id);
        if (ref) {
          await sqlPool`
            INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
            VALUES (${ref}, ${personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                    ${`Mandat gewonnen — Betreuung übernommen von ${req.agent!.name}.`}, NOW())`;
        }
      } catch (e) { console.error("[MANDAT] Verlaufseintrag:", e); }
    }
    const zahlen = await mandatsZahlen(req.agent!.id);
    res.json({ ok: true, mandatSeit: r?.mandat_seit ?? null, anzahl: zahlen.anzahl, max: MANDATE_MAX });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] mandat:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// E-048 Nr. 1: GET /agent/vertrieb/frei — meine nächsten freien Zeiten.
//
// VORHER tippte der Mitarbeiter beim „Termin buchen" Datum und Uhrzeit frei
// ein und erfuhr erst NACH dem Abschicken, ob die Zeit im Raster seiner
// Availability liegt oder schon belegt ist (409 aus terminBuchen).
// NACHHER liefert dieser Endpunkt die nächsten freien Slots zum Anklicken —
// mit DERSELBEN Rechnung wie die Kundenbuchung: `rohSlots` aus
// lib/fiaon-termine (Signatur: rohSlots(agenten, takt, lauf)) rechnet die
// aktiven Zeitfenster des Agenten abzüglich seiner Termine (status gebucht/
// erledigt/verpasst; abgesagte geben die Zeit frei). Keine Kopie der Logik —
// sonst böte die Pipeline Zeiten an, die die Annahme ablehnt. Gebucht wird
// weiter über POST /agent/termine, der serverseitig erneut prüft.
// ═══════════════════════════════════════════════════════════════════════════
const FREI_TAGE = 7;
const FREI_ANZAHL = 30;
router.get("/agent/vertrieb/frei", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    // Der Takt der Buchung: POST /agent/termine bucht mit quelle "agent_manuell".
    const takt = dauerFuer("agent_manuell");
    // Nur ich selbst; der Vorname wird in der Anzeige nicht gebraucht.
    const alle = await rohSlots([{ id: req.agent!.id, vorname: "" }], takt, sqlPool, 15 * 60_000);
    const grenze = Date.now() + FREI_TAGE * 86_400_000;
    // ══════════════════════════════════════════════════════════════════════
    // DIE GRENZE GILT JE TAG, NICHT INSGESAMT (25.08.2026)
    //
    // Florentine: „Ich wollte einen Termin für Donnerstag buchen. Beim Buchen
    // kann ich aktuell nur heute und morgen auswählen."
    // VORHER: `.slice(0, 30)` über die GESAMTE Liste. Wer volle Arbeitstage
    // hinterlegt hat, verbraucht die 30 Plätze mit heute und morgen — jeder
    // spätere Tag fiel komplett aus der Auswahl, obwohl der Server ihn
    // anstandslos gebucht hätte. Je voller der Kalender gepflegt, desto
    // kürzer der Horizont: genau verkehrt herum.
    // NACHHER: bis zu 6 Zeiten je Tag über alle 7 Tage. Jeder Tag ist
    // erreichbar, die Liste bleibt überschaubar.
    // ══════════════════════════════════════════════════════════════════════
    const JE_TAG = 6;
    const proTag = new Map<string, number>();
    const slots = alle
      .filter((s) => new Date(s.beginn).getTime() <= grenze)
      .filter((s) => {
        const n = proTag.get(s.datum) ?? 0;
        if (n >= JE_TAG) return false;
        proTag.set(s.datum, n + 1);
        return true;
      })
      .map((s) => ({ beginn: s.beginn, datum: s.datum, uhrzeit: s.uhrzeit, dauerMin: takt }));
    res.json({ ok: true, slots, dauerMin: takt });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] frei:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// E-050 (Plan §19): GET /agent/vertrieb/bestand — das Portfolio der Mandate.
//
// VORHER gab es keinen Portfolio-Endpunkt: Der Bestand-Reiter der Pipeline
// mischte alle zugewiesenen Kunden aus /agent/kunden/liste mit /inkasso/liste.
// NACHHER liefert dieser Endpunkt NUR die mandatierten Kunden (mandat_seit
// IS NOT NULL, §16a) — je Mandat die bekannte Karte (KARTE_SQL/karte, keine
// zweite Kartenform) plus Raten-Stand (bezahlt/offen/überfällig, dieselben
// Regeln wie kundenSituation: status <> 'bezahlt', storniert_am IS NULL,
// Stichtag Berlin-heute), SEPA-Status (gc_mandate_status = 'active' wie in
// kundenSituation) und Monatsrate (Ratenbetrag, sonst amount_due der Karte).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/vertrieb/bestand", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureKartenSpalten();
    await ensureBetreuungSpalte(sqlPool);
    await ensureVertriebSpalten();
    const rows = (await sqlPool.unsafe(
      `SELECT ${KARTE_SQL}, p.mandat_seit,
         (SELECT JSON_BUILD_OBJECT(
            'bezahlt',      COUNT(*) FILTER (WHERE r.status = 'bezahlt'),
            'offen',        COUNT(*) FILTER (WHERE r.status <> 'bezahlt' AND r.faellig_am >= ${HEUTE}),
            'ueberfaellig', COUNT(*) FILTER (WHERE r.status <> 'bezahlt' AND r.faellig_am < ${HEUTE}),
            'ueberfaelligSeit', MIN(r.faellig_am) FILTER (WHERE r.status <> 'bezahlt' AND r.faellig_am < ${HEUTE}),
            'ruecklastschrift', COALESCE(BOOL_OR(r.lastschrift_status = 'fehlgeschlagen' AND r.status <> 'bezahlt'), FALSE),
            'rateCents',    MAX(r.betrag_cents)
          ) FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
          WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.storniert_am IS NULL) AS raten_stand,
         -- Vorher las die Unterabfrage gc_mandate_status aus fiaon_applications –
         -- die Spalte lebt an der PERSON (Befund 24.08., 500er im Live-Betrieb).
         (p.gc_mandate_status = 'active') AS sepa_aktiv,
         -- P17 (28.08.2026): Der Bestand wird nach Bearbeitungsstand filterbar —
         -- dafür braucht jede Karte zwei Antworten, die bisher fehlten.
         EXISTS (SELECT 1 FROM fiaon_applications ab WHERE ab.person_id = p.id
           AND ab.merged_into IS NULL AND ab.archived_at IS NULL
           AND ab.payment_status = 'paid'
           AND NOT (COALESCE(ab.type,'') = 'schufa' OR ab.ref LIKE 'FIAON-SCHUFA-%')) AS hat_bezahlt,
         EXISTS (SELECT 1 FROM fiaon_termine tb WHERE tb.person_id = p.id
           AND tb.quelle = 'onboarding_call' AND tb.status = 'erledigt') AS onboarding_erledigt
       FROM fiaon_persons p
       WHERE p.assigned_agent_id = $1 AND p.mandat_seit IS NOT NULL
         AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
       ORDER BY p.mandat_seit DESC, p.id DESC`, [req.agent!.id],
    )) as any[];
    const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
    const tage = (iso: string | null): number | null => iso
      ? Math.max(0, Math.round((new Date(`${heute}T12:00:00Z`).getTime() - new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getTime()) / 86_400_000))
      : null;
    const mandate = rows.map((r) => {
      const s = r.raten_stand || {};
      const k = karte(r);
      return {
        kunde: { ...k, mandatSeit: r.mandat_seit ?? null },
        raten: {
          bezahlt: Number(s.bezahlt || 0),
          offen: Number(s.offen || 0),
          ueberfaellig: Number(s.ueberfaellig || 0),
          ueberfaelligSeitTagen: tage(s.ueberfaelligSeit ?? null),
          ruecklastschrift: !!s.ruecklastschrift,
        },
        sepaAktiv: !!r.sepa_aktiv,
        bezahlt: !!r.hat_bezahlt,
        onboardingErledigt: !!r.onboarding_erledigt,
        // Monatsrate: der echte Ratenbetrag; solange keine Raten existieren,
        // der offene Kartenbetrag (amount_due) als bester bekannter Wert.
        monatsrateCents: s.rateCents != null ? Number(s.rateCents) : (k as any).betrag ?? null,
      };
    });
    res.json({ ok: true, mandate, max: MANDATE_MAX });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] bestand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/vertrieb/mandate", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await mandatsZahlen(req.agent!.id);
    res.json({ ok: true, anzahl: z.anzahl, ids: z.ids, max: MANDATE_MAX });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] mandate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// §16: Volle Akte — GET /agent/vertrieb/aktivitaet/:personId
// Zeitleiste ALLER Kundenereignisse: Klicks (fiaon_click_events über die
// Bestell-Refs der Person), Bestellungen/Zahlungen/Raten, Mails
// (fiaon_mail_log), Anrufe (fiaon_calls), Gesprächsergebnisse
// (fiaon_contact_log). Zugriff: dieselbe Grenze wie /agent/crm/kunden/:id
// (assigned_agent_id = ich). Jede Quelle ist einzeln abgesichert — eine
// fehlende Tabelle darf die Akte nicht leeren.
// ═══════════════════════════════════════════════════════════════════════════
type Kat = "klick" | "zahlung" | "gespraech" | "mail" | "system";
interface Ereignis { am: string; kat: Kat; titel: string; detail: string | null; roh: string | null }

/** Klick-Ereignisse in Menschensprache — rohe Namen bleiben als Nebentext. */
function klickTitel(event: string, step: number | null, page: string | null, data: any): string {
  const s = step != null ? ` ${step}` : "";
  const feste: Record<string, string> = {
    pack_select: `Paket gewählt${data?.pack ? `: ${data.pack}` : ""}`,
    pack_upgrade: "Paket hochgestuft",
    pack_switch: "Paket gewechselt",
    step_change: `Antrag Schritt${s} ausgefüllt`,
    contract_download: "Vertrag heruntergeladen",
    checkout_bank_transfer: "Zahlungsseite (Überweisung) geöffnet",
    login: "Im Kundenbereich angemeldet",
    page_view: `Seite angesehen${page ? `: ${page}` : ""}`,
    upload: "Unterlage hochgeladen",
  };
  if (feste[event]) return feste[event];
  if (page) {
    const seiten: [string, string][] = [
      ["preise", "Hat die Preisseite angesehen"], ["antrag", "War im Antrag"],
      ["kundenbereich", "War im Kundenbereich"], ["mein-bereich", "War im Kundenbereich"],
      ["privatkunden", "Hat die Privatkunden-Seite angesehen"], ["business", "Hat die Business-Seite angesehen"],
    ];
    for (const [teil, text] of seiten) if (page.includes(teil)) return text;
    return `Seite angesehen: ${page}`;
  }
  return event.replace(/[_-]+/g, " ");
}

const MAIL_TITEL: Record<string, string> = {
  payment_details: "Zahlungsdaten-Mail", welcome: "Willkommens-/Zugangs-Mail",
  nicht_erreicht_termin: "Terminlink-Mail", onboarding_einladung: "Einladung zum Startgespräch",
  number_update_request: "Bitte um neue Rufnummer", payment_reminder: "Zahlungserinnerung",
  payment_confirmed: "Zahlungsbestätigung", lead_followup: "Nachfass-Mail",
  lead_application_link: "Antragslink-Mail",
};

router.get("/agent/vertrieb/aktivitaet/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    if (!Number.isFinite(personId) || personId <= 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    // 24.08.2026 (Justin): VORHER `eigene(...)` — siehe darfAkteLesen oben.
    if (!(await darfAkteLesen(personId, req.agent!.id))) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });

    const refs = ((await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
    `.catch(() => [] as any[])) as any[]).map((r) => String(r.ref));

    const leer: any[] = [];
    const [klicks, apps, raten, mails, anrufe, kontakte, voll, situation] = await Promise.all([
      refs.length ? sqlPool`
        SELECT event, step, page, data, created_at FROM fiaon_click_events
        WHERE application_ref = ANY(${refs}::text[])
        ORDER BY created_at DESC LIMIT 400
      `.catch(() => leer) : Promise.resolve(leer),
      sqlPool`
        SELECT ref, pack_name, amount_due, payment_status, created_at, completed_at,
               documents_uploaded_at, archived_at, archived_reason
        FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
      `.catch(() => leer),
      refs.length ? sqlPool`
        SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am
        FROM fiaon_abo_raten WHERE ref = ANY(${refs}::text[]) AND storniert_am IS NULL
      `.catch(() => leer) : Promise.resolve(leer),
      sqlPool`
        SELECT event, status, empfaenger, grund, created_at FROM fiaon_mail_log
        WHERE person_id = ${personId} ORDER BY created_at DESC LIMIT 200
      `.catch(() => leer),
      sqlPool`
        SELECT richtung, status, beginn, nummer FROM fiaon_calls
        WHERE person_id = ${personId} ORDER BY beginn DESC LIMIT 200
      `.catch(() => leer),
      sqlPool`
        SELECT c.created_at, c.type, c.outcome, c.note, c.agent_name
        FROM fiaon_contact_log c JOIN fiaon_applications a ON a.ref = c.ref
        WHERE a.person_id = ${personId} AND c.voided_at IS NULL
        ORDER BY c.created_at DESC LIMIT 200
      `.catch(() => leer),
      kundeVollstaendig(personId),
      kundenSituation(personId),
    ]);

    const e: Ereignis[] = [];
    for (const k of klicks as any[]) {
      e.push({ am: k.created_at, kat: "klick", titel: klickTitel(String(k.event), k.step != null ? Number(k.step) : null, k.page, k.data), detail: k.page || null, roh: String(k.event) });
    }
    for (const a of apps as any[]) {
      if (a.created_at) e.push({ am: a.created_at, kat: "system", titel: `Bestellung angelegt${a.pack_name ? `: ${String(a.pack_name).split("\n")[0]}` : ""}`, detail: a.ref, roh: null });
      if (a.completed_at) e.push({ am: a.completed_at, kat: "system", titel: "Antrag abgeschlossen", detail: a.ref, roh: null });
      if (a.documents_uploaded_at) e.push({ am: a.documents_uploaded_at, kat: "klick", titel: "Unterlagen hochgeladen (Kontoauszug/Ausweis)", detail: a.ref, roh: "documents_uploaded" });
      if (a.payment_status === "paid") e.push({ am: a.completed_at || a.created_at, kat: "zahlung", titel: `Erste Zahlung bankbestätigt${a.amount_due ? ` – ${Number(a.amount_due).toFixed(2).replace(".", ",")} €` : ""}`, detail: a.ref, roh: "paid" });
      if (a.archived_at) e.push({ am: a.archived_at, kat: "system", titel: "Bestellung archiviert", detail: a.archived_reason || a.ref, roh: null });
    }
    for (const r of raten as any[]) {
      if (r.bezahlt_am) e.push({ am: r.bezahlt_am, kat: "zahlung", titel: `Rate ${r.rate_nr} bezahlt – ${(Number(r.betrag_cents) / 100).toFixed(2).replace(".", ",")} €`, detail: null, roh: null });
    }
    for (const m of mails as any[]) {
      e.push({ am: m.created_at, kat: "mail", titel: `${MAIL_TITEL[String(m.event)] ?? `Mail: ${m.event}`} ${m.status === "versandt" ? "versandt" : `– ${m.status}`}`, detail: m.empfaenger || m.grund || null, roh: String(m.event) });
    }
    for (const a of anrufe as any[]) {
      e.push({ am: a.beginn, kat: "gespraech", titel: a.richtung === "eingehend" ? "Kunde hat angerufen" : "Anruf an den Kunden", detail: a.status || null, roh: null });
    }
    for (const k of kontakte as any[]) {
      e.push({ am: k.created_at, kat: "gespraech", titel: k.type === "note" ? "Notiz" : `Gesprächsergebnis: ${k.outcome || k.type}`, detail: [k.agent_name, k.note].filter(Boolean).join(" – ") || null, roh: k.outcome || k.type });
    }
    e.sort((a, b) => new Date(b.am).getTime() - new Date(a.am).getTime());

    res.json({ ok: true, ereignisse: e.slice(0, 500), vollstaendig: voll, situation });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] aktivitaet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
