// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Vertriebs-Arbeitsliste, Mandate, volle Akte (23.08.2026)
// E-043 (Plan §15) + E-044/§16/§16a.
//
//   GET  /agent/vertrieb/arbeitsliste        → 6 Slots je Spalte + Vorrat + Mandate
//   POST /agent/vertrieb/mandat/:personId    → Mandat übernommen (mandat_seit)
//   GET  /agent/vertrieb/mandate             → Mandats-Kennungen + Anzahl (x/500)
//   GET  /agent/vertrieb/aktivitaet/:personId→ Zeitleiste ALLER Kundenereignisse
//                                              + Vollständigkeit (Kartenstatus)
//   GET  /agent/vertrieb/frei                → E-048: meine nächsten freien
//                                              Termin-Zeiten (klickbare Slots)
//   GET  /agent/vertrieb/bestand             → E-050 (§19): Portfolio der
//                                              MANDATIERTEN Kunden — je Mandat
//                                              Karte + Raten-Stand +
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
import { jetztErreichbarSql } from "@shared/fiaon-erreichbarkeit";
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { KARTE_SQL, karte, NAME_SQL } from "./fiaon-agent-start";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { wartetSql } from "../lib/fiaon-warten";
import { ensureKartenSpalten } from "../lib/fiaon-kartenstatus";
import { ensureBetreuungSpalte } from "../lib/tier";
import { rohSlots, dauerFuer } from "../lib/fiaon-termine";
import { gesperrteFreigeben } from "../lib/fiaon-zuteilung";
import { produktkategorieSql } from "../lib/fiaon-produktkategorie";
import { globalKundeSql, globalKundeBereit } from "../lib/fiaon-global-kunde";
import { limitStandText } from "@shared/fiaon-limit-gespraech";
import {
  RATE_FAELLIG_SQL, EREIGNIS_SQL, LETZTER_KONTAKT_SQL, LETZTER_VERSUCH_SQL, LETZTES_ERGEBNIS_SQL,
  zusageOffenSql, rueckrufOffenSql, tagespauseSql, frischBandSql, frischUnbearbeitetSql, geradeBearbeitetSql,
  kontaktZeileSql,
} from "../lib/fiaon-pipeline-reihung";
import {
  GRUND_TEXT, grundAusLetztemErgebnis, wiederDranText, PAUSE_AB_FEHLVERSUCH,
  type WiedervorlageGrund,
} from "@shared/fiaon-wiedervorlage";
import { berlinToday } from "../lib/fiaon-time";
// E-IT-A (08.10.2026): RATE_FAELLIG_SQL und EREIGNIS_SQL wohnen jetzt in
// server/lib/fiaon-pipeline-reihung.ts (tier.ts braucht sie und darf keine
// Route laden). Die Telefonkartei liest sie weiter HIER (E-201) — unverändert.
export { RATE_FAELLIG_SQL, EREIGNIS_SQL };

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
        WHERE a.person_id = ${personId} AND a.gdpr_deleted_at IS NULL
          AND a.bank_statement_pdf IS NOT NULL) AS kontoauszug,
      EXISTS (SELECT 1 FROM fiaon_applications a
        WHERE a.person_id = ${personId} AND a.gdpr_deleted_at IS NULL
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
  | "bezahlt_ohne_termin" | "startgespraech_erledigt" | "zahlung_gemeldet" | "rechnung_offen" | "lead_ohne_antrag"
  | "termin_heute" | "alles_gut";
export interface KundenSituation {
  art: SituationsArt;
  rate: { id: number; nr: number; betragCents: number; faelligAm: string; tage: number; referenz: string | null } | null;
  zusageAm: string | null;
  rueckrufAm: string | null;
  /** Nächster gebuchter Termin in der Zukunft. */
  terminAm: string | null;
  /** Ein gebuchter Termin, dessen Zeitpunkt erreicht/ueberschritten ist. */
  terminFaelligAm?: string | null;
  terminHeute: string | null;
  /** Gesprächsart des heutigen Termins — der Leitfaden richtet sich danach. */
  terminHeuteQuelle: string | null;
  /** E-168: Art des nächsten gebuchten Termins (z. B. „support") — ein Support-Termin ändert den Startgespräch-Stand nicht. */
  terminQuelle?: string | null;
  /** E-168: Wann das Startgespräch geführt wurde — bleibt stehen, wenn es einmal erledigt ist. */
  startgespraechAm?: string | null;
  naechsteRate: { faelligAm: string; betragCents: number } | null;
  tier: number;
  /**
   * E-283 (05.10.2026): Stand des Limit-Gesprächs für die Akte — „Limit-Gespräch:
   * ab … / jetzt buchbar / gebucht …" (limitStandText). null ohne Paket mit
   * Limit-Gespräch, bei Global-Kunden und wenn die Abfrage ausfiel.
   */
  limit?: { text: string; grund: string; buchbar: boolean; abIso: string | null } | null;
  /**
   * E-IT-A (08.10.2026): Wann ist der Mensch wieder in der Pipeline, und warum?
   * Für den Chip im Akte-Kopf („Wieder dran am Mi 15.10. · Zahlung prüfen" mit
   * „Heute wieder dran") und die Vorschau unter den Ergebnis-Knöpfen.
   */
  wiedervorlage?: {
    am: string | null; grund: string; text: string | null; versuche: number;
    stufeA: boolean; frisch: boolean; ruht: boolean; pausiert: boolean; letzterVersuch: string | null;
  } | null;
}
export async function kundenSituation(
  personId: number,
  /** E-IT-A: Verbindung oder Transaktion (Prüfstand); Vorgabe wie bisher der Pool. */
  lauf: any = sqlPool,
): Promise<KundenSituation | null> {
  const [z] = (await lauf`
    SELECT p.priority_tier, p.promised_payment_date,
      -- E-IT-A (08.10.2026): das Zusagedatum als TEXT. promised_payment_date kommt
      -- aus postgres.js als Date-Objekt; String(Date).slice(0, 10) ergab „Thu Sep 24“,
      -- und „Thu …“ < „2026-…“ ist nie wahr — die Lage „Zusage gebrochen“ (E-046)
      -- erschien deshalb in KEINER Akte (gefunden vom Prüfstand pruef-it-a.ts).
      to_char(p.promised_payment_date, 'YYYY-MM-DD') AS zusage_iso,
      -- E-IT-A: Wiedervorlage, Zähler, letzter Versuch, letztes Ergebnis, Frische.
      to_char(p.follow_up_date, 'YYYY-MM-DD') AS wieder_am, COALESCE(p.unreachable_count, 0) AS versuche_ne,
      ${sqlPool.unsafe(ruhtSql("p"))} AS ruht,
      NULLIF(${sqlPool.unsafe(LETZTER_VERSUCH_SQL)}, 'epoch'::timestamptz) AS letzter_versuch,
      ${sqlPool.unsafe(LETZTES_ERGEBNIS_SQL)} AS letztes_ergebnis,
      ${sqlPool.unsafe(frischBandSql())} AS frisch,
      (SELECT row_to_json(x) FROM (
         SELECT r.id, r.rate_nr, r.betrag_cents, r.faellig_am, r.zahlungsreferenz,
                ((NOW() AT TIME ZONE 'Europe/Berlin')::date - r.faellig_am)::int AS tage
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
      -- E-188: Ein bezahlter Auftrag über FIAON Global ist kein bezahltes PAKET — sonst ginge in der Akte
      -- der Leitfaden „bezahlt, Startgespräch vereinbaren" der Privatkunden auf (Auskunft, Einträge, Raten).
      EXISTS (SELECT 1 FROM fiaon_applications a3 WHERE a3.person_id = p.id
        AND a3.merged_into IS NULL AND a3.archived_at IS NULL
        AND a3.payment_status = 'paid'
        AND ${sqlPool.unsafe(produktkategorieSql("a3"))} <> 'global') AS bezahlt,
      (SELECT t.beginn FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL AND t.beginn > NOW() ORDER BY t.beginn LIMIT 1) AS termin_am,
      (SELECT t.quelle FROM fiaon_termine t WHERE t.person_id = p.id AND t.status = 'gebucht'
         AND t.abgesagt_am IS NULL AND t.beginn > NOW() ORDER BY t.beginn LIMIT 1) AS termin_quelle,
      -- 09.09.2026 (E-168, Team-Feedback Punkt 1): Ein geführtes Startgespräch bleibt geführt.
      -- Vorher sprang der Stand nach dem Abhaken zurück auf „Termin fehlt", weil nur
      -- KÜNFTIGE Termine gelesen wurden. Dieselbe Regel wie im Kundenbereich
      -- (fiaon-kunde-bereich.ts): erledigter onboarding_call ODER Gespräch im Verlauf.
      COALESCE(
        (SELECT MAX(COALESCE(t.erledigt_am, t.beginn)) FROM fiaon_termine t
          WHERE t.person_id = p.id AND t.quelle = 'onboarding_call' AND t.status = 'erledigt'),
        (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl
          WHERE cl.type IN ('onboarding', 'startgespraech') AND cl.voided_at IS NULL
            AND (cl.person_id = p.id OR cl.ref IN (SELECT ao.ref FROM fiaon_applications ao WHERE ao.person_id = p.id)))
      ) AS startgespraech_am,
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
  } : null;
  // ── STUFE A: „ZAHLUNG GEMELDET" STATT „ZUSAGE NICHT GEHALTEN" (Gegenprüfung 08.10.2026) ──
  // Mit dem korrigierten Textvergleich (oben, zusage_iso) griff „zusage_gebrochen"
  // auch bei Stufe A: Eine Zahlungsmeldung löscht promised_payment_date nicht.
  // Gemessen (Produktion, nur lesend): 29 Menschen auf Stufe A mit abgelaufener
  // Zusage — ihre Akte hätte rot „Zusage nicht gehalten – fass nach" gezeigt,
  // samt Leitfaden „frag, was dazwischenkam". Sie haben aber gemeldet, dass sie
  // bezahlt haben; das richtige Gespräch ist „Zahlung gemeldet – Eingang prüfen".
  // Für Stufe A gilt deshalb die Zahlungsmeldung vor der alten Zusage.
  const zusageGebrochen = !!z.zusage_iso && String(z.zusage_iso) < heute && tier !== 1;
  const art: SituationsArt =
    rate ? "rate_ueberfaellig"
    : zusageGebrochen ? "zusage_gebrochen"
    : z.rueckruf_am ? "rueckruf_faellig"
    : (z.bezahlt && !z.termin_am && !z.termin_heute) ? (z.startgespraech_am ? "startgespraech_erledigt" : "bezahlt_ohne_termin")
    : tier === 1 ? "zahlung_gemeldet"
    : tier === 2 ? "rechnung_offen"
    : tier === 3 ? "lead_ohne_antrag"
    : z.termin_heute ? "termin_heute"
    : "alles_gut";
  // E-283: dieselbe Regel wie im Kundenbereich (shared/fiaon-limit-gespraech.ts). Fällt
  // sie aus, fehlt nur diese Zeile — nie die Situation. Der Fehler steht im Protokoll.
  const limitStand = await import("../lib/fiaon-limit-gespraech")
    .then((m) => m.limitAnspruchFuerPerson(personId))
    .catch((e) => { console.error("[VERTRIEB] Limit-Gespräch in der Situation:", e?.message || e); return null; });
  const limitText = limitStandText(limitStand);
  const versucheNe = Number(z.versuche_ne || 0);
  const wvGrund = grundAusLetztemErgebnis(z.letztes_ergebnis, versucheNe);
  const wvAm = z.wieder_am ? String(z.wieder_am) : null;
  return {
    art, rate,
    wiedervorlage: {
      am: wvAm, grund: wvGrund, text: wvAm ? wiederDranText(wvAm, wvGrund, heute) : null,
      versuche: versucheNe, stufeA: tier === 1, frisch: z.frisch === true, ruht: z.ruht === true,
      pausiert: !!wvAm && wvAm > heute, letzterVersuch: z.letzter_versuch ?? null,
    },
    limit: limitStand && limitText ? { text: limitText, grund: limitStand.grund, buchbar: limitStand.buchbar, abIso: limitStand.abIso } : null,
    zusageAm: z.zusage_iso ? String(z.zusage_iso) : null,
    rueckrufAm: z.rueckruf_am ?? null,
    terminAm: z.termin_am ?? null,
    terminFaelligAm: z.termin_faellig_am ?? null,
    terminHeute: z.termin_heute ?? null,
    terminHeuteQuelle: z.termin_heute_quelle ?? null,
    terminQuelle: z.termin_quelle ?? null,
    startgespraechAm: z.startgespraech_am ?? null,
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

// ═══════════════════════════════════════════════════════════════════════════
// HITZE STATT STUFEN-QUOTE (07.09.2026, E-162 — Justin: „gebe den Mitarbeitern
// die frischesten, heißesten Leads zuerst")
//
// ── VORHER ──────────────────────────────────────────────────────────────
// Sechs Plätze, fest 2 je Stufe (Zahlung gemeldet / Rechnung offen / Lead).
// Gemessen am 07.09. über 14 Tage: 320 von 386 Anrufen an „Zahlung gemeldet"
// gingen an Meldungen, die älter als 14 Tage waren — davon zahlen noch 4,5 %.
// Zwei der sechs Plätze hielten Leads ohne Antrag, die praktisch nie angerufen
// wurden (3 Einträge in 14 Tagen). Und der Pool gab Stufe 1 und 2 ÄLTESTE
// zuerst heraus.
//
// ── DIE ZAHLEN, DIE DIE REIHENFOLGE BESTIMMEN (90 Tage, 2.439 Anträge) ──
//   erster Kontakt < 1 h  27,6 %  ·  1–4 h  34,0 %  ·  4–24 h  27,3 %
//   1–3 Tage  24,6 %  ·  > 3 Tage  12,4 %  ·  nie kontaktiert  0 %
//   Zahlungsmeldung: 36 % zahlen binnen 1 Tag, nach 7 Tagen noch 9 %, nach
//   14 Tagen 4,5 %. Abgebrochene Anträge: 0 von 421 zahlten — egal wie
//   schnell angerufen wurde.
//
// ── NACHHER ─────────────────────────────────────────────────────────────
// EINE Liste über alle Stufen, sortiert nach Hitze:
//   1. Zusage fällig oder Termin heute
//   2. Rückruf fällig
//   3. das jüngste Ereignis zuerst (Antrag gestellt oder Zahlung gemeldet);
//      am selben Tag zuerst, wer noch keinen Anruf hatte
//   Stufe 3 (abgebrochen, ohne Antrag) kommt erst, wenn nichts Heißes da ist.
// Der Pool gibt in derselben Reihenfolge heraus. Die Zähler je Stufe bleiben.
// 28.09.2026 (E-251): Vor Punkt 1 stehen jetzt die Sofort-Spur (Antrag oder
// Zahlungsmeldung ≤ 24 h, seither kein Anruf) und davor nur, was eine feste
// Uhrzeit JETZT hat — Einzelheiten bei SOFORT_SQL.
// ═══════════════════════════════════════════════════════════════════════════
const SLOTS = 6;
// ── E-IT-A (08.10.2026): ZUSAGE UND RÜCKRUF SIND EINMAL DRINGEND, NICHT EWIG ──
// VORHER: ZUSAGE_SQL = „promised_payment_date ≤ heute" — ohne Alter, ohne
// „seither versucht". Gemessen am 07.10.: 77 Menschen belegten JEDEN Tag die
// Plätze 1–26, 42 Zusagen älter als 30 Tage, bei 56 gab es seither einen
// Kontakt. „Zahlt sofort" (Zusage = heute) stand am nächsten Tag auf Platz 1.
// NACHHER: dringend nur, solange nach dem Zusagetag noch NIEMAND versucht hat
// (zusageOffenSql). Dasselbe für den Rückruf (rueckrufOffenSql): Wer nach der
// vereinbarten Zeit angerufen hat, hat ihn beantwortet. Die Zusage selbst
// bleibt stehen — die Akte zeigt „Zusage gebrochen".
/** Zusage fällig und seit dem Zusagetag noch nicht versucht. */
const ZUSAGE_SQL = zusageOffenSql();
/** Rückruf fällig und seit der vereinbarten Zeit noch nicht versucht. */
const RUECKRUF_SQL = rueckrufOffenSql();
/** Termin heute beim angemeldeten Mitarbeiter ($1). */
const TERMIN_HEUTE_SQL = `EXISTS (
  SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id AND tz.agent_id = $1 AND tz.status = 'gebucht'
    AND tz.abgesagt_am IS NULL AND (tz.beginn AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE})`;
/**
 * E-251: Was eine feste Uhrzeit JETZT hat, bleibt auch vor der Sofort-Spur —
 * ein Termin, der in den nächsten 15 Minuten beginnt oder seit höchstens
 * 30 Minuten läuft, und ein zugesagter Rückruf, dessen Zeit in den letzten
 * 30 Minuten erreicht wurde. Ein Termin um 16 Uhr oder ein seit Tagen
 * überfälliger Rückruf steht dagegen hinter den frischen Anträgen.
 */
const TERMIN_JETZT_SQL = `EXISTS (
  SELECT 1 FROM fiaon_termine tj WHERE tj.person_id = p.id AND tj.agent_id = $1 AND tj.status = 'gebucht'
    AND tj.abgesagt_am IS NULL AND tj.beginn BETWEEN NOW() - INTERVAL '30 minutes' AND NOW() + INTERVAL '15 minutes')`;
const RUECKRUF_JETZT_SQL = `EXISTS (
  SELECT 1 FROM fiaon_contact_log cj JOIN fiaon_applications aj ON aj.ref = cj.ref
  WHERE aj.person_id = p.id AND cj.outcome = 'rueckruf_termin' AND cj.done_at IS NULL
    AND cj.voided_at IS NULL AND cj.scheduled_at BETWEEN NOW() - INTERVAL '30 minutes' AND NOW())`;
/**
 * FÄLLIGE RATE — der Grund, aus dem ein bezahlter Kunde wieder in die Liste
 * gehört (08.09.2026, E-165).
 *
 * ── DER BEFUND ────────────────────────────────────────────────────────────
 * Die sechs Plätze ziehen `priority_tier BETWEEN 1 AND 3`. Ein Kunde, der
 * bezahlt hat, steht auf Stufe 0 und fällt damit aus jeder Arbeitsliste.
 * Gemessen am 07.09.2026: **213 Kunden auf Stufe 0 mit einer fälligen zweiten
 * Rate über zusammen 16.943,52 €** — verteilt auf Daniel 88, Nikita 71,
 * Florentine 60, Diana 12, Hans-Jürgen 3. Niemand hatte sie in einer Liste.
 * Vorgesehen war dafür der Raum „Forderungen" (E-047, „Vertrieb ≠ Inkasso"),
 * aber die Rolle `inkasso` trägt seit Wochen kein aktives Konto: 16 Konten,
 * davon 0 aktiv.
 *
 * ── WAS SICH ÄNDERT, UND WAS AUSDRÜCKLICH NICHT ───────────────────────────
 * Ein Kunde auf Stufe 0 kommt NUR dann in die Liste, wenn er eine offene,
 * nicht stornierte Rate hat, deren Fälligkeit erreicht ist. Stufe 0 ohne
 * offene Rate bleibt draußen. Er landet in der Pipeline SEINES Betreuers, nie
 * im Pool, und er zählt gegen die sechs Plätze — sonst wüchse Daniels Liste
 * auf einen Schlag um 88 Menschen und niemand arbeitete sie ab.
 * E-047 bleibt im Kern bestehen: Der Ton ist der weiche Reaktivierungs-
 * Leitfaden (E-042), kein Inkasso-Ton. Das Mahnwesen bleibt unberührt.
 */
// Exportiert (21.09.2026, E-201): Die Telefonkartei im Chefbüro zieht „Rate offen" nach
// GENAU dieser Regel — eine zweite Fassung würde andere Menschen zeigen als die Arbeitsliste.
// E-IT-A (08.10.2026): RATE_FAELLIG_SQL, die jüngste Fälligkeit und EREIGNIS_SQL
// (Antrag, Zahlungsmeldung, Rate fällig — 08.09.2026, E-165) stehen wortgleich
// in server/lib/fiaon-pipeline-reihung.ts; oben importiert und weitergereicht.
/** Noch kein Gesprächsergebnis zu diesem Menschen — niemand hat ihn je angerufen. */
// 08.09.2026, 15:20 (Störung: Pipeline lud bei Daniel und Nikita nicht): VORHER stand hier
// EIN NOT EXISTS mit „cn.person_id = p.id OR cn.ref IN (…)“. Das ODER über zwei Spalten
// lässt Postgres keinen Index nehmen — für jeden der 1.236 Kunden im Bestand wurde das
// ganze Kontaktprotokoll (40.783 Zeilen) gelesen: 50 Millionen Zeilenprüfungen je Aufruf,
// 10–14 Sekunden, Abbruch im Browser. NACHHER zwei NOT EXISTS, jedes über seinen Index.
// Gegenprüfung 08.10.2026 (E-IT-A): Ein Tagesbericht-Nachtrag (Gespräch übers
// eigene Telefon, E-216) ist ein Kontakt — er bleibt aber eine Systemzeile ohne
// outcome, damit Leistung und Teamzahlen ihn nicht mitzählen. kontaktZeileSql
// (fiaon-pipeline-reihung.ts) erkennt beides; vorher galt so ein Mensch als
// „nie angerufen" und stand links unter „Neu für dich".
const NIE_SQL = `(NOT EXISTS (
  SELECT 1 FROM fiaon_contact_log cn WHERE cn.person_id = p.id AND ${kontaktZeileSql("cn")} AND cn.voided_at IS NULL)
  AND NOT EXISTS (
  SELECT 1 FROM fiaon_contact_log cr JOIN fiaon_applications an ON an.ref = cr.ref
   WHERE an.person_id = p.id AND ${kontaktZeileSql("cr")} AND cr.voided_at IS NULL))`;
// ═══════════════════════════════════════════════════════════════════════════
// SEIT DEM LETZTEN ANRUF IST ETWAS PASSIERT (23.09.2026, E-212)
//
// ── DER BEFUND ────────────────────────────────────────────────────────────
// Daniel: „In der Pipeline werden nur C-Kunden angezeigt, und irgendwie kommen
// da keine neuen Anträge rein." Justin dazu: „Uns ist aufgefallen, dass B-Kunden
// – Antrag wurde gestellt – als C-Kunden markiert sind."
//
// GEMESSEN am 23.09.2026 gegen die Produktionsdatenbank: Die gespeicherte Stufe
// ist auf KEINER Person falsch (Abgleich `priority_tier` gegen tier.ts:
// 0 Abweichungen). Falsch war, was die linke Spalte ZEIGT. Sie war definiert
// als „noch nie angerufen" (NIE_SQL) — und von Daniels 32 A- und 356 B-Kunden
// waren genau DREI noch nie angerufen. Also konnte links strukturell nur
// Stufe C stehen: 1.032 nie angerufene Leads standen bereit.
//
// Der Denkfehler: „neu" wurde mit „noch nie angefasst" gleichgesetzt. Ein
// Mensch, den wir vor drei Wochen als Lead angerufen haben und der HEUTE einen
// Antrag ausfüllt, ist die frischeste Arbeit, die es gibt — er galt aber als
// „schon bearbeitet" und rutschte nach rechts unter „Wieder dran".
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Neu ist, wer noch nie angerufen wurde ODER seit dem letzten Anruf etwas
// getan hat: einen Antrag abgeschickt oder eine Zahlung gemeldet. Nach dem
// nächsten Anruf ist der Kontakt wieder jünger als das Ereignis — die Marke
// löscht sich von selbst, ohne Aufräumlauf.
//
// Beide Hälften sind wie NIE_SQL in je zwei indexfreundliche Unterabfragen
// geteilt (person_id und ref getrennt); ein ODER über zwei Spalten hat die
// Pipeline am 08.09. schon einmal zum Stehen gebracht.
// ═══════════════════════════════════════════════════════════════════════════
// LETZTER_KONTAKT_SQL (das jüngste Gesprächsergebnis, zwei indexfreundliche
// Unterabfragen) steht seit E-IT-A in server/lib/fiaon-pipeline-reihung.ts —
// die Einstufung (tier.ts) braucht ihn auch.
/** Das jüngste eigene Zutun: Antrag abgeschickt oder Zahlung gemeldet. */
// E-251 (28.09.2026): „abgeschickt" heißt submitted_at, nicht created_at. created_at ist der
// Moment, in dem der Kunde Schritt 1 öffnet — wer um 9:50 beginnt, um 10:00 als Lead angerufen
// wird und um 10:20 abschickt, hat SEIT dem Anruf etwas getan und gehört nach links. Ohne
// submitted_at (Altbestand) gilt weiter created_at.
const EIGENES_TUN_SQL = `GREATEST(
  COALESCE((SELECT MAX(COALESCE(a6.submitted_at, a6.created_at)) FROM fiaon_applications a6
              WHERE a6.person_id = p.id AND a6.merged_into IS NULL AND NOT a6.ist_entwurf), 'epoch'::timestamptz),
  COALESCE((SELECT MAX(a7.claimed_paid_at) FROM fiaon_applications a7
              WHERE a7.person_id = p.id AND a7.merged_into IS NULL), 'epoch'::timestamptz))`;
/** Seit dem letzten Anruf hat dieser Mensch etwas getan — das ist frische Arbeit. */
const FRISCH_SQL = `(${EIGENES_TUN_SQL} > ${LETZTER_KONTAKT_SQL})`;
/** „Neu für dich" — die linke Spalte: nie angerufen ODER seither etwas getan. */
const NEU_FUER_DICH_SQL = `(p.priority_tier BETWEEN 1 AND 3 AND (${NIE_SQL} OR ${FRISCH_SQL}))`;
// ── WANN WILL DER KUNDE ANGERUFEN WERDEN? (11.09.2026, E-184, Team-Feedback 2) ──
// „Kunde gibt 08–12 an → wird nur in diesem Zeitraum angezeigt; 18–20 → erst
// ab 18 Uhr; flexibel → den ganzen Tag." Die Angabe steht im jüngsten Antrag
// (fiaon_applications.erreichbarkeit, P18). Die Stunde ist die Berliner, wie
// HEUTE oben. Ohne Angabe oder „Flexibel" gilt: immer erreichbar.
// Tabelle und Regel: shared/fiaon-erreichbarkeit.ts — eine Quelle für
// Formular, Reihung und Karte.
const STUNDE_SQL = `EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Berlin'))::int`;
const ERREICHBAR_ANGABE_SQL = `(SELECT a9.erreichbarkeit FROM fiaon_applications a9
   WHERE a9.person_id = p.id AND a9.merged_into IS NULL AND NULLIF(a9.erreichbarkeit, '') IS NOT NULL
   ORDER BY a9.created_at DESC LIMIT 1)`;
// Exportiert (29.09.2026, E-259): Die Telefonkartei reiht nach DERSELBEN Wunschzeit wie die Arbeitsliste.
export const JETZT_ERREICHBAR_SQL = jetztErreichbarSql(ERREICHBAR_ANGABE_SQL, STUNDE_SQL);
/** Als Reihungs-Kriterium: passendes Fenster (oder keine Angabe) zuerst. */
const FENSTER_ORDNUNG = `CASE WHEN ${JETZT_ERREICHBAR_SQL} THEN 0 ELSE 1 END`;
// ═══════════════════════════════════════════════════════════════════════════
// DIE SOFORT-SPUR (28.09.2026, E-251)
//
// Justin, am Tag, an dem die Werbung wieder anläuft: „Die Mitarbeiter müssen
// die Kunden schneller anrufen – das heißt auch, dass immer die neuesten
// Kunden ganz oben und vorne angezeigt werden müssen."
//
// ── GEMESSEN (Produktion, nur lesend, 28.09.2026) ─────────────────────────
// 83 fertige Anträge in 14 Tagen: 41 % binnen 4 Stunden angerufen, 47 % erst
// nach über 24 Stunden oder nie. Und: Wer zahlt, zahlt binnen drei Tagen nach
// dem Antrag — in jeder Wochen-Kohorte seit Juli kam praktisch keine
// Erstzahlung später. Der erste Tag entscheidet.
//
// ── WARUM DIE HITZE DAS NICHT SCHON KONNTE ───────────────────────────────
// Rang 0 war „Zusage fällig ODER Termin heute" — ganztägig. Ein Termin um
// 16 Uhr, eine gestern fällige Zusage und jeder seit Tagen überfällige Rückruf
// standen vor einem Antrag von vor zehn Minuten. Bei sechs Plätzen heißt das:
// Der neue Antrag war unsichtbar, bis diese Fälle abgearbeitet waren.
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// 0. Feste Uhrzeit JETZT: Termin in den nächsten 15 Minuten oder seit höchstens
//    30 Minuten, Rückruf gerade fällig (TERMIN_JETZT_SQL, RUECKRUF_JETZT_SQL).
// 1. SOFORT-SPUR: Antrag abgeschickt oder Zahlung gemeldet in den letzten
//    24 Stunden, seither kein Anruf — der neueste zuerst.
// 2. Zusage fällig, Termin später am Tag. 3. Rückruf überfällig. 4. Rest.
// Die Wunschzeit aus dem Antrag (E-184) gilt weiter: Wer „18–20 Uhr" angab,
// springt um 18 Uhr in die Spur, nicht um 10. Stufe C (ohne Antrag) kommt nie
// in die Spur — Leads ohne Antrag zahlten vor dem Antrag nie.
// ═══════════════════════════════════════════════════════════════════════════
const SOFORT_SQL = `(p.priority_tier IN (1, 2)
  AND ${EIGENES_TUN_SQL} > NOW() - INTERVAL '24 hours'
  AND ${FRISCH_SQL}
  AND ${JETZT_ERREICHBAR_SQL})`;
/** Felder für die Karte: warum steht dieser Mensch hier? */
const HITZE_SQL = `${ZUSAGE_SQL} AS zusage_faellig, ${RUECKRUF_SQL} AS rueckruf_faellig, ${TERMIN_HEUTE_SQL} AS termin_heute,
  ${RATE_FAELLIG_SQL} AS rate_faellig,
  ${EREIGNIS_SQL} AS ereignis_am, ${NIE_SQL} AS nie_gesprochen,
  ${JETZT_ERREICHBAR_SQL} AS jetzt_erreichbar,
  ${SOFORT_SQL} AS sofort, ${EIGENES_TUN_SQL} AS eigenes_am`;
/** Die Reihenfolge — für „Neu für dich", „Wieder dran" dieselbe (braucht $1 = Mitarbeiter). */
const HITZE_ORDNUNG = `
  -- E-165 (TFO): KEIN eigener Rang für fällige Raten. Eine gestern fällige Rate zahlt zu ~19 %, ein Antrag
  -- von gestern zu 28 %, eine 60 Tage alte Rate fast nie — die Fälligkeit zählt als Ereignis (unten),
  -- die Frische entscheidet. Ein fester Rang hätte bei Daniel 93 Raten vor jeden neuen Antrag gestellt.
  -- E-251: Uhrzeit JETZT → Sofort-Spur → Zusage/Termin heute → Rückruf → Rest (Regel oben bei SOFORT_SQL).
  CASE WHEN ${TERMIN_JETZT_SQL} OR ${RUECKRUF_JETZT_SQL} THEN 0
       WHEN ${SOFORT_SQL} THEN 1
       WHEN ${ZUSAGE_SQL} OR ${TERMIN_HEUTE_SQL} THEN 2
       WHEN ${RUECKRUF_SQL} THEN 3 ELSE 4 END,
  -- E-251: In der Sofort-Spur zählt allein die Frische — der neueste Antrag zuerst.
  CASE WHEN ${SOFORT_SQL} THEN ${EIGENES_TUN_SQL} END DESC NULLS LAST,
  -- E-184: feste Zeiten (Zusage, Termin, Rückruf) bleiben vorn; danach zählt,
  -- ob der Kunde laut Antrag JETZT erreichbar sein will.
  ${FENSTER_ORDNUNG},
  CASE WHEN p.priority_tier = 3 THEN 1 ELSE 0 END,
  (${EREIGNIS_SQL} AT TIME ZONE 'Europe/Berlin')::date DESC,
  CASE WHEN ${NIE_SQL} THEN 0 ELSE 1 END,
  COALESCE(p.unreachable_count, 0) ASC,
  ${EREIGNIS_SQL} DESC,
  p.id DESC`;
/**
 * „Neu für dich" (E-184): HITZE_ORDNUNG trägt das Wunschfenster bereits an
 * zweiter Stelle — direkt hinter Zusage, Termin heute und Rückruf. Wer heute um
 * 14:30 seinen Termin hat, steht auch um 14 Uhr vorn, egal welches Fenster er
 * im Antrag nannte. Ein eigener Rang DAVOR hätte genau das gebrochen.
 * E-251: Seit der Sofort-Spur steht um 14 Uhr ein frischer Antrag vor dem
 * 14:30-Termin; ab 14:15 ist der Termin „jetzt" und steht wieder ganz vorn.
 */
// ── NUR A, DANN NUR B, DANN NUR C — HÖHERES PAKET ZUERST (09.10.2026, E-326) ──────
// Justin: „die neusten und besten Leads immer als erstes anzeigen, dann filtern nach neu
// und Höhe des Pakets (höhere Pakete immer first!) — Nur A, dann nur B, dann nur C Kunden“.
// Reihung für „Neu für dich“ und den Pool-Zug: (0) Termin oder vereinbarter Rückruf JETZT —
// das ist eine Verabredung, kein Lead; (1) Stufe A vor B vor C, streng; (2) innerhalb der
// Stufe das höhere Paket zuerst (PAKET_RANG_SQL); (3) das neueste Ereignis zuerst (Antrag,
// Zahlungsmeldung — EREIGNIS_SQL); erst danach das Wunschfenster als Gleichstandsregel.
// HITZE_ORDNUNG (Sofort-Spur, E-251) bleibt für andere Leser stehen, ordnet links aber nicht mehr.
/**
 * Paket des jüngsten Privat-Antrags: Highend 4 · Ultra 3 · Pro 2 · Start 1 · ohne 0. Fehlt der
 * Paketschlüssel (ältere Anträge, gemessen 410 von 860 in 30 Tagen), entscheidet der Betrag —
 * dieselbe Stufung über die Paketpreise. Auskunft, SCHUFA und Global zählen nicht.
 */
const PAKET_RANG_SQL = `COALESCE((SELECT CASE COALESCE(ap.pack_key, '')
      WHEN 'highend' THEN 4 WHEN 'ultra' THEN 3 WHEN 'pro' THEN 2 WHEN 'start' THEN 1
      ELSE CASE WHEN ap.amount_due >= 99 THEN 4 WHEN ap.amount_due >= 79 THEN 3 WHEN ap.amount_due >= 59 THEN 2
                WHEN ap.amount_due > 0 THEN 1 ELSE 0 END END
    FROM fiaon_applications ap
   WHERE ap.person_id = p.id AND ap.merged_into IS NULL AND ap.archived_at IS NULL
     AND COALESCE(ap.pack_key, '') NOT IN ('schufa', 'auskunft_privat')
     AND COALESCE(ap.pack_key, '') NOT LIKE 'global%' AND COALESCE(ap.pack_key, '') NOT LIKE 'llc%'
     AND (ap.pack_key IS NOT NULL OR ap.amount_due IS NOT NULL)
   ORDER BY ap.created_at DESC LIMIT 1), 0)`;
const NEU_ORDNUNG = `
  CASE WHEN ${TERMIN_JETZT_SQL} OR ${RUECKRUF_JETZT_SQL} THEN 0 ELSE 1 END,
  CASE p.priority_tier WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END,
  ${PAKET_RANG_SQL} DESC,
  ${EREIGNIS_SQL} DESC NULLS LAST,
  ${FENSTER_ORDNUNG},
  p.id DESC`;
/** Pool-Reihenfolge (E-326): A vor B vor C, höheres Paket zuerst, jüngstes Ereignis zuerst. Gezogen wird ohnehin nur, wer jetzt erreichbar sein will. */
const POOL_ORDNUNG = `
  CASE p.priority_tier WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END,
  ${PAKET_RANG_SQL} DESC,
  ${EREIGNIS_SQL} DESC NULLS LAST,
  ${FENSTER_ORDNUNG},
  p.id DESC`;
/** Hitze-Felder → Karte („Antrag vor 12 Min · noch ohne Anruf"). */
function hitzeVon(r: any) {
  const tier = Number(r.priority_tier);
  // E-251: Steht der Mensch wegen der Sofort-Spur oben, nennt die Karte genau
  // diesen Grund — den frischen Antrag bzw. die frische Zahlungsmeldung, mit
  // der Minute des Abschickens —, nicht einen Termin, der erst am Nachmittag ist.
  const sofort = r.sofort === true;
  const art = sofort ? (tier === 1 ? "zahlung_gemeldet" : "antrag")
    : r.zusage_faellig === true ? "zusage" : r.termin_heute === true ? "termin" : r.rueckruf_faellig === true ? "rueckruf"
    // Die fällige Rate steht VOR den Stufen-Arten: Sie ist der Grund, aus dem
    // dieser Mensch hier steht, und der Verkäufer muss ihn im ersten Satz sehen.
    : r.rate_faellig === true ? "rate"
    : tier === 1 ? "zahlung_gemeldet" : tier === 2 ? "antrag" : r.tier_reason === "antrag_abgebrochen" ? "abbruch" : "lead";
  const zeit = sofort && r.eigenes_am ? r.eigenes_am : r.ereignis_am;
  const am = zeit ? new Date(zeit).getTime() : NaN;
  return {
    art,
    seitMin: Number.isFinite(am) ? Math.max(0, Math.round((Date.now() - am) / 60_000)) : null,
    nieGesprochen: r.nie_gesprochen === true,
    // E-184: false nur, wenn der Kunde ein Fenster nannte und wir gerade außerhalb liegen.
    jetztErreichbar: r.jetzt_erreichbar !== false,
    sofort,
  };
}
/**
 * Die Gruppe der Karte — Übersetzung des vorhandenen priority_tier, mit einer
 * Ausnahme: Wer wegen einer fälligen Rate hier steht, gehört in die eigene
 * Gruppe. Sonst stünde ein zahlender Kunde als „Registriert – noch kein
 * Antrag" da, und der Verkäufer führte das falsche Gespräch.
 */
const gruppeVon = (tier: number, rateFaellig = false) =>
  (rateFaellig && tier === 0 ? "rate_faellig"
    : tier === 1 ? "bezahlt_gemeldet" : tier === 2 ? "rechnung_offen" : "lead");

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL-KUNDEN STEHEN IN KEINER LISTE DES PRIVATVERTRIEBS (02.10.2026, E-272)
//
// Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er
// soll Global bleiben, also keine unnötigen Mails.“ Die Einstufung stellt einen
// Global-Kunden (Regel: fiaon-global-kunde.ts) auf Stufe -1, und alles hier
// fragt nach Stufe 1–3 bzw. 0 mit fälliger Rate — im Normalfall ist er also
// schon draußen. Neu gerechnet wird die Stufe aber nur, wenn sich eine
// Bestellung ändert, und im 20-Minuten-Takt. Ein neues Individualangebot ändert
// keine Bestellung: Bis zum nächsten Takt stünde der Mensch mit seiner alten
// Stufe in der Arbeitsliste (auch in der Sofort-Spur), der Pool gäbe ihn
// heraus, und der Rückfall nähme ihn seiner zuständigen Person bei FIAON Global
// weg. Deshalb fragt jede Auswahl hier die Regel selbst, nicht nur die Stufe.
// Gemischte Kunden (bezahltes Stufenpaket plus Global) erfüllt die Regel nicht —
// für sie bleibt die Liste, wie sie war.
//
// Je Zeile, nicht als Menge wie in der Telefonkartei: Jede Abfrage hier ist auf
// einen Mitarbeiter, den Pool oder die Rückfall-Kandidaten begrenzt. Gemessen
// (Produktion, nur lesend, 02.10., alt → neu): Daniels Slots 22 → 22 ms, Vorrat
// 42 → 44, Wieder dran 66 → 59, Pool-Zug 45 → 34, Rückfälle 8 → 16 und 32 → 34 —
// kein Planwechsel, dieselben Menschen.
// ═══════════════════════════════════════════════════════════════════════════
const KEIN_GLOBAL_KUNDE_SQL = `NOT ${globalKundeSql("p.id")}`;

// ═══════════════════════════════════════════════════════════════════════════
// DIE RECHTE SPALTE ROTIERT (E-IT-A, 08.10.2026 — Justin: „gerade bearbeitet →
// nie am nächsten Tag wieder vorn; ältester Versuch zuerst innerhalb gleicher
// Dringlichkeit")
//
// ── VORHER ──────────────────────────────────────────────────────────────
// „Wieder dran" lief nach HITZE_ORDNUNG: nach dem Kalendertag des jüngsten
// Ereignisses (meist dem Antrag). Wann wir den Menschen zuletzt versucht
// hatten, kam nicht vor. Ein bearbeiteter Kunde kehrte nach 1–3 Tagen auf
// seinen alten Platz zurück; wer hinten stand, kam nie dran.
//
// ── NACHHER — Bänder nach Dringlichkeit, darin Rotation ─────────────────
//   0  feste Uhrzeit JETZT (Termin ±, Rückruf gerade fällig) — wie E-251
//   1  Termin heute, Zusage fällig und seither nicht versucht („Zahlung/
//      Zusage prüfen" — EINMAL, kein Dauerplatz mehr)
//   2  Rückruf fällig und seither nicht versucht
//   3  frisch: Stufe A/B oder Rate, Ereignis höchstens FRISCH_TAGE alt
//      (der erste Tag entscheidet, E-162/E-251) — aber NICHT, wer gerade
//      bearbeitet wurde (siehe unten)
//   4  alle anderen (A, B, Rate gleichrangig)
//   5  Stufe C (Lead ohne Antrag) — wie bisher zuletzt
// Innerhalb jedes Bandes: erst wer NICHT gerade bearbeitet wurde, dann
// passendes Wunschfenster (E-184), dann wer am LÄNGSTEN nicht versucht wurde
// (Ergebnis oder echter Anruf, lv), dann das jüngere Ereignis. Jede Bearbeitung
// setzt lv neu — der Mensch geht ans Ende seines Bandes; was heute nicht
// geschafft wird, steht morgen vorn.
// lv/ev kommen als Ausdruck herein (LATERAL, einmal je Zeile gerechnet).
//
// ── GEGENPRÜFUNG 08.10.2026: GERADE BEARBEITET NIE VORN ─────────────────
// Ein frischer Kunde, gestern „nicht erreicht", hatte die Wiedervorlage auf
// heute (Frische: nächster Werktag) — und Band 3 stellte ihn heute VOR das
// ganze Band 4. Jetzt: Wer am vorigen Werktag oder heute versucht wurde
// (geradeBearbeitetSql, fiaon-pipeline-reihung.ts), steht nie in Band 3 und
// innerhalb jedes Bandes hinter allen anderen. Er ist da — aber hinten.
// ═══════════════════════════════════════════════════════════════════════════
function wiederOrdnung(lv: string, ev: string): string {
  return `
  CASE WHEN ${TERMIN_JETZT_SQL} OR ${RUECKRUF_JETZT_SQL} THEN 0
       WHEN ${TERMIN_HEUTE_SQL} OR ${zusageOffenSql(lv)} THEN 1
       WHEN ${rueckrufOffenSql(lv)} THEN 2
       WHEN ${frischUnbearbeitetSql(ev, lv)} THEN 3
       WHEN p.priority_tier = 3 THEN 5
       ELSE 4 END,
  CASE WHEN ${geradeBearbeitetSql(lv)} THEN 1 ELSE 0 END,
  ${FENSTER_ORDNUNG},
  ${lv} ASC,
  ${ev} DESC,
  p.id DESC`;
}
/**
 * PAUSIERT (E-IT-A): eigene Menschen, die die Wiedervorlage-Regel gerade
 * zurückhält — Wiedervorlage in der Zukunft, nicht ruhend, nicht wartend, nicht
 * seither selbst aktiv. Zähler am Spaltenkopf und Liste GET /agent/vertrieb/pausiert.
 * Gegenprüfung 08.10.2026: NICHT, wen die Arbeitsliste aus einem ANDEREN Grund
 * fernhält — eine Zusage ab heute oder ein gebuchter Termin an einem späteren
 * Tag (dieselben Bedingungen wie basisTeile/basisWieder). Sonst zählte „Y pausiert"
 * Menschen, die „Heute wieder dran" gar nicht zurückholen kann, und der Knopf
 * wirkte kaputt.
 */
const PAUSIERT_SQL = `p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
  AND NOT p.is_blocked AND NOT ${ruhtSql("p")} AND NOT ${wartetSql("p")} AND ${KEIN_GLOBAL_KUNDE_SQL}
  AND p.follow_up_date > ${HEUTE} AND NOT ${FRISCH_SQL}
  AND (p.promised_payment_date IS NULL OR p.promised_payment_date < ${HEUTE})
  AND NOT EXISTS (SELECT 1 FROM fiaon_termine tzp WHERE tzp.person_id = p.id AND tzp.status = 'gebucht' AND tzp.abgesagt_am IS NULL
                  AND (tzp.beginn AT TIME ZONE 'Europe/Berlin')::date > ${HEUTE})
  AND (p.priority_tier BETWEEN 1 AND 3 OR (COALESCE(p.priority_tier, 0) = 0 AND ${RATE_FAELLIG_SQL}))`;

/**
 * Zieht Nachschub aus dem Kundenpool, wenn der Mitarbeiter in „Neu für dich"
 * weniger als SLOTS arbeitbare Menschen hat. Läuft vor jedem Aufbau der Liste.
 *
 * Schutzregeln:
 *  1. Testkonten ziehen NIE — sonst griffe das Prüfkonto nach echten Kunden.
 *  2. Schulung oder aus der Verteilung genommen: kein Nachschub (E-161).
 *  3. Liegengelassenes fällt zurück: Wer zieht und drei Tage lang nichts tut
 *     (kein Verlaufseintrag, kein Termin, kein Mandat), gibt den Menschen
 *     wortlos an den Pool zurück. So sperrt kein Urlaub den Nachschub.
 *  4. Gesperrte Konten halten keine Kunden ohne Mandat (E-162, gesperrteFreigeben).
 *
 * Reihenfolge im Pool (E-162): jüngstes Ereignis zuerst, über alle Stufen,
 * Stufe 3 zuletzt. Vorher bekamen Stufe 1 und 2 die ÄLTESTEN zuerst.
 */
const POOL_RUECKFALL_TAGE = 3;
/** Die Rückfall-Läufe (Hausputz über den ganzen Bestand) höchstens alle zehn Minuten. */
const RUECKFALL_TAKT_MS = 10 * 60_000;
let letzterRueckfallLauf = 0;
/** Angefangen und liegen gelassen — nach drei Wochen gehört der Mensch wieder allen. */
const POOL_LIEGEN_TAGE = 21;
async function poolNachschub(me: number, istTestkonto: boolean): Promise<void> {
  if (istTestkonto) return;
  // 07.09.2026 (E-161): Wer in Schulung ist (schulung_offen) oder aus der Verteilung genommen wurde
  // (distribution_active = false, z. B. die Schulungsleitung), bekommt keinen Nachschub — vorher
  // stand hier eine feste Mitarbeiter-Nummer (531, Diana).
  const [a] = (await sqlPool`SELECT COALESCE(schulung_offen, FALSE) AS schulung, COALESCE(distribution_active, TRUE) AS verteilung FROM fiaon_agents WHERE id = ${me}`.catch(() => [])) as any[];
  if (a && (a.schulung || !a.verteilung)) return;
  // E-162: Was bei gesperrten Konten ohne Mandat liegt, geht sofort an den Nächsten.
  await gesperrteFreigeben(sqlPool, 40);
  // 08.09.2026 (Störung): Die zwei Rückfall-Läufe unten prüfen den GESAMTEN Bestand (6.500 Menschen,
  // je ~0,7 s) — und liefen bei JEDEM Aufbau JEDER Arbeitsliste. Sie sind Hausputz, kein Teil der
  // Liste: einmal alle zehn Minuten reicht, egal wer die Liste öffnet.
  if (Date.now() - letzterRueckfallLauf < RUECKFALL_TAKT_MS) {
    await nachschubZiehen(me);
    return;
  }
  letzterRueckfallLauf = Date.now();

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
       -- E-272: nie einen Global-Kunden lösen (KEIN_GLOBAL_KUNDE_SQL oben).
       AND ${KEIN_GLOBAL_KUNDE_SQL}
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c1 JOIN fiaon_applications ax ON ax.ref = c1.ref WHERE ax.person_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c2 WHERE c2.person_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine tx WHERE tx.person_id = p.id)`);

  await sqlPool.unsafe(`
    UPDATE fiaon_persons p SET assigned_agent_id = NULL
     WHERE p.mandat_seit IS NULL AND p.assigned_agent_id IS NOT NULL
       AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
       AND NOT p.is_blocked AND p.priority_tier IN (1,2,3)
       -- E-272: nie einen Global-Kunden lösen (KEIN_GLOBAL_KUNDE_SQL oben).
       AND ${KEIN_GLOBAL_KUNDE_SQL}
       AND p.promised_payment_date IS NULL
       -- E-IT-A (08.10.2026): Wer nach der Wiedervorlage-Regel PAUSIERT (bis zu
       -- 14 Tage nach dem 6. Fehlversuch), ist nicht liegen gelassen. Bis eine
       -- Woche nach seiner Wiedervorlage bleibt er beim Betreuer — sonst fiele
       -- er in einen Pool, aus dem nachschubZiehen nie zieht (nur NIE_SQL).
       AND (p.follow_up_date IS NULL OR p.follow_up_date < ${HEUTE} - 7)
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine t2
                        WHERE t2.person_id = p.id AND t2.status = 'gebucht'
                          AND t2.abgesagt_am IS NULL AND t2.beginn > NOW())
       -- ── GREATEST, NICHT COALESCE (21.09.2026, E-203) ─────────────────────
       -- „Liegen gelassen" heißt: seit dem LETZTEN Anlass nichts — und die
       -- Zuteilung ist ein Anlass. COALESCE nahm den ersten Wert, der da war:
       -- Hatte jemand vor Wochen einmal angerufen, zählte dieser alte Anruf, und
       -- die frische Zuteilung von heute zählte nie. Folge, gemessen: Die
       -- Verteilung vom 14.09. (E-186) war am selben Nachmittag zurück im Pool
       -- (39 von 39 A, 437 von 443 B), und am 21.09. sprangen 319 von 320
       -- gezogenen B-Kunden binnen zehn Minuten zurück — Karten erschienen und
       -- verschwanden. GREATEST nimmt den jüngsten Anlass; NULL zählt nicht.
       AND GREATEST(
             (SELECT MAX(c3.created_at) FROM fiaon_contact_log c3 WHERE c3.person_id = p.id),
             (SELECT MAX(c4.created_at) FROM fiaon_contact_log c4
                JOIN fiaon_applications a4 ON a4.ref = c4.ref WHERE a4.person_id = p.id),
             p.assigned_at
           ) < NOW() - INTERVAL '${POOL_LIEGEN_TAGE} days'`);

  await nachschubZiehen(me);
}

/** Zieht aus dem Pool nach, wenn „Neu für dich“ nicht voll ist (E-162). */
async function nachschubZiehen(me: number): Promise<void> {
  // ── Nachschub nach Hitze (E-162): erst wenn „Neu für dich" nicht voll ist ──
  const [zeile] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
       AND p.ist_test_am IS NULL AND NOT p.is_blocked
       AND NOT ${ruhtSql("p")} AND NOT ${wartetSql("p")}
       AND (p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})
       AND COALESCE(p.unreachable_count, 0) = 0
       AND ${NIE_SQL}
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id
             AND tz.status = 'gebucht' AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())
       -- ── NUR WER LINKS STEHT, HÄLT EINEN PLATZ (09.10.2026, E-324) ──────────
       -- Daniel, 09.10. 11:53: „Pipeline links sind bei mir keine Kunden mehr“ —
       -- und Justin fand dieselben frischen Anträge unter „Kunden ohne Betreuer“.
       -- Hier zählten seit E-165 (08.09.) auch Ratenkunden (Stufe 0 mit fälliger
       -- Rate) als besetzte Plätze in „Neu für dich“. Seit E-168/E-305 stehen sie
       -- aber RECHTS unter „Wieder dran“ (NEU_FUER_DICH_SQL = Stufe 1–3). Gemessen
       -- (Produktion, nur lesend, 09.10. 12:20): Daniel 6 von 6 gezählten Plätzen =
       -- Ratenkunden → „fehlt“ = 0, kein Nachschub, linke Spalte leer, 3.079 frische
       -- Menschen im Pool. Ebenso #10 (18 von 18). Jetzt zählt der Nachschub genau
       -- die linke Spalte: Stufe 1–3, und keine Zusage ab heute (wie basisTeile).
       AND p.priority_tier BETWEEN 1 AND 3
       AND (p.promised_payment_date IS NULL OR p.promised_payment_date < ${HEUTE})
       -- E-272: zählt dieselben Menschen wie die linke Spalte — ein Global-Kunde hält keinen Platz.
       AND ${KEIN_GLOBAL_KUNDE_SQL}
       -- E-184: Wer laut Antrag gerade NICHT erreichbar sein will, hält keinen
       -- Platz besetzt — sonst stünde links den ganzen Vormittag ein Abendkunde.
       -- Unberührte fallen nach drei Tagen von selbst in den Pool zurück (oben).
       AND ${JETZT_ERREICHBAR_SQL}`, [me])) as any[];
  const fehlt = SLOTS - Number(zeile?.n ?? 0);
  if (fehlt <= 0) return;
  // ── KEIN HORTEN (E-184): Wer außerhalb seines Fensters liegt, zählt oben
  // nicht als besetzt — damit nicht jeder Fensterwechsel sechs neue Menschen
  // zieht, gilt ein Deckel über ALLE unberührten Zugeteilten, und der Pool gibt
  // nur heraus, wer JETZT erreichbar sein will (oder nichts angab).
  const [alle] = (await sqlPool.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_persons p
     WHERE p.assigned_agent_id = $1 AND p.merged_into_person_id IS NULL
       AND p.ist_test_am IS NULL AND NOT p.is_blocked AND p.mandat_seit IS NULL
       AND ${NIE_SQL} AND p.priority_tier BETWEEN 1 AND 3`, [me])) as any[];
  if (Number(alle?.n ?? 0) >= SLOTS * 3) return;
  await sqlPool.unsafe(`
    UPDATE fiaon_persons SET assigned_agent_id = $1, assigned_at = NOW(), betreuung_seit = COALESCE(betreuung_seit, NOW())
     WHERE id IN (
       SELECT p.id FROM fiaon_persons p
        WHERE p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL
          AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
          AND NOT p.is_blocked AND NOT ${ruhtSql("p")} AND NOT ${wartetSql("p")}
          AND p.priority_tier BETWEEN 1 AND 3
          -- NUR NEUE (21.09.2026, E-203): Der Zug füllt „Neu für dich" — und
          -- zählt oben nur Nie-Angerufene. Zog er einen früher Angerufenen, blieb
          -- der Platz leer, und der nächste Aufbau zog wieder: Solange die
          -- 21-Tage-Frist sie nach Minuten zurückwarf, fiel das nicht auf; seit
          -- sie hält, würde jeder Aufbau sechs Menschen horten.
          AND ${NIE_SQL}
          AND ${JETZT_ERREICHBAR_SQL}
          -- E-324 (09.10.2026): nur wer danach auch LINKS erscheint — kein Fehlversuch,
          -- keine Wiedervorlage oder Zusage in der Zukunft (wie basisTeile). Sonst wäre
          -- er zugeteilt, aber unsichtbar, und der nächste Aufbau zöge wieder.
          AND COALESCE(p.unreachable_count, 0) = 0
          AND (p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})
          AND (p.promised_payment_date IS NULL OR p.promised_payment_date < ${HEUTE})
          -- E-272: Der Pool gibt nie einen Global-Kunden heraus (KEIN_GLOBAL_KUNDE_SQL oben).
          AND ${KEIN_GLOBAL_KUNDE_SQL}
        ORDER BY ${POOL_ORDNUNG}
        LIMIT ${fehlt}
        FOR UPDATE SKIP LOCKED)`, [me]);
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
    // E-272: Die Regel liest fiaon_global_angebote — einmal je Prozess sichergestellt.
    await globalKundeBereit();
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

    const liste = await arbeitslisteLesen(me);
    const mandate = await mandatsZahlen(me);
    res.json({
      ok: true,
      rolle: "agent",
      ...liste,
      mandate: { anzahl: mandate.anzahl, max: MANDATE_MAX },
    });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] arbeitsliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE ARBEITSLISTE LESEN — ohne Pool-Nachschub, mit wählbarer Verbindung
// (E-IT-A, 08.10.2026). Vorher stand das alles im Rumpf der Route und war
// deshalb nur über HTTP prüfbar. Jetzt ruft die Route diese Funktion, und
// scripts/pruef-it-a.ts ruft sie in einer zurückgerollten Transaktion
// (AGENTS.md: „Funktionen, die … brauchen einen lauf-Parameter").
// ═══════════════════════════════════════════════════════════════════════════
export async function arbeitslisteLesen(
  me: number, lauf: any = sqlPool,
  /** Gegenprüfung 08.10.2026: Der Prüfstand liest „Wieder dran" in voller Länge (Reihung über Platz 6 hinaus); die Route nimmt SLOTS. */
  opts: { wiederBis?: number } = {},
): Promise<{
  wieder: { gruppe: string; kunde: any }[];
  slots: { gruppe: string; kunde: any }[];
  vorrat: { neu: number; wieder: number };
  heute: { datum: string; erledigt: number; pausiert: number };
}> {
  // (Einrückung bewusst wie im früheren Routenrumpf — kleiner Unterschied für die Zusammenführung.)
    // E-272: Die Regel liest fiaon_global_angebote — einmal je Prozess sichergestellt
    // (memoisiert; die Route ruft es vorher schon, der Prüfstand ruft nur hier).
    await globalKundeBereit();
    // Gemeinsame Ausschlüsse — dieselben Bausteine wie die große Liste, plus:
    // ein gebuchter Termin in der Zukunft heißt „Mandat angenommen“ — raus.
    const basisTeile = [
      "p.assigned_agent_id = $1",
      "p.merged_into_person_id IS NULL",
      "p.ist_test_am IS NULL",
      "NOT p.is_blocked",
      `NOT ${ruhtSql("p")}`,
      `NOT ${wartetSql("p")}`,
      // E-272 (02.10.2026): kein Global-Kunde in einer Spalte, im Vorrat oder in der
      // Sofort-Spur — auch nicht mit noch alter Stufe (KEIN_GLOBAL_KUNDE_SQL oben).
      KEIN_GLOBAL_KUNDE_SQL,
      // E-212: „oder er hat seit dem letzten Anruf selbst etwas getan" — eine
      // Wiedervorlage für nächste Woche darf einen Antrag von heute nicht
      // verdecken. Gemessen am 23.09.: 15 Menschen im Team, alle mit frischem
      // Antrag oder gemeldeter Zahlung, standen deshalb in keiner Liste.
      `(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE} OR ${FRISCH_SQL})`,
      // ── NICHT ERREICHT VERLÄSST DIE PIPELINE (07.09.2026, Justin) ─────────
      // „Heute rufen wir 50 an und klicken auf nicht erreicht, morgen kommen
      // dieselben 50 wieder rein." Bis hierher stand ein Mensch nach dem ersten
      // und zweiten Fehlversuch am nächsten Tag wieder in der Arbeitsliste
      // (die Wiedervorlage streckt erst ab dem dritten Versuch). Jetzt gilt:
      // Wer nicht erreicht wurde, steht auf der eigenen Seite „Nicht erreicht"
      // (Kunden → Filter „Nicht erreicht", Menüpunkt im Office) und nicht mehr
      // hier — bis er erreicht wird (erreicht_* setzt den Zähler zurück) oder
      // sich selbst meldet. Die Pipeline zieht dafür frischen Nachschub.
      // E-212: „… oder sich selbst meldet" stand hier schon als Absicht im
      // Text, war aber nirgends gebaut. Jetzt ist es gebaut: Wer nach dem
      // letzten Fehlversuch einen Antrag abschickt oder eine Zahlung meldet,
      // kommt sofort zurück — das ist genau die Selbstmeldung.
      `(COALESCE(p.unreachable_count, 0) = 0 OR ${FRISCH_SQL})`,
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
    ];
    const basis = basisTeile.join(" AND ");
    // ── E-IT-A (08.10.2026): WER STEHT LINKS, WER RECHTS — OHNE LÜCKE ─────────
    // Links: nie angerufen oder seither selbst gehandelt, und (Zähler 0 oder
    // frisch) — so wie basis es für die linke Spalte schon verlangt.
    const LINKS_SQL = `(${NEU_FUER_DICH_SQL} AND (COALESCE(p.unreachable_count, 0) = 0 OR ${FRISCH_SQL}))`;
    // Rechts nicht, wer in den letzten TAGESPAUSE_STUNDEN schon versucht wurde
    // (Ergebnis oder echter Anruf, v.lv) — außer Termin heute oder offener Rückruf.
    // Eine Wiedervorlage auf HEUTE (Übergabe, „Heute wieder dran") hebt die Pause auf.
    const WIEDER_TAGESPAUSE = `(NOT ${tagespauseSql("v.lv")} OR ${TERMIN_HEUTE_SQL} OR ${rueckrufOffenSql("v.lv")})`;
    // ── DIE RECHTE SPALTE: WIEDER DRAN (07.09.2026, Justin) ─────────────────
    // „Links die neuen Kunden, rechts die nicht erreichten — sobald ich jemanden
    // abschließe, kommt der nächste. So ist gewährleistet, dass man auch frische
    // Kunden anruft." Rechts stehen: nicht erreicht (Wiedervorlage fällig),
    // Rückruf fällig, Termin heute. Dieselben Ausschlüsse wie links — nur der
    // Nicht-erreicht-Ausschluss und der Termin-Ausschluss sind hier umgedreht.
    const basisWieder = basisTeile
      .filter((t) => !t.includes("unreachable_count, 0) = 0") && !t.includes("tz.status = 'gebucht'"))
      // 09.09.2026 (E-168): rechts = schon kontaktiert (oder Ratenkunde) UND heute fällig.
      // Die Fälligkeit steckt in basisTeile (follow_up_date, Zusage, nicht heute erreicht);
      // hier kommt nur noch dazu: nicht links — also mindestens ein Gesprächsergebnis
      // oder ein bezahlter Kunde mit fälliger Rate. Wer „nicht erreicht" bekommt, hat
      // seit E-162 die Wiedervorlage auf morgen und verschwindet damit für heute.
      // E-212: dieselbe Wendung wie links, damit niemand in beiden Spalten steht.
      // E-IT-A (08.10.2026): „nicht links" heißt jetzt genau das Gegenteil der
      // linken Spalte (LINKS_SQL). Vorher stand hier nur „nicht neu" — wer nie ein
      // Gesprächsergebnis hatte, aber einen Zähler > 0 (Tagesbericht-Nachtrag,
      // verpasster Termin), stand in KEINER Spalte (Gegenprüfung: 4 Menschen).
      .concat([`NOT ${LINKS_SQL}`,
        // Ein Termin an einem SPÄTEREN Tag nimmt den Menschen aus beiden Spalten — heute nur, wer heute dran ist.
        `NOT EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id AND tz.status = 'gebucht' AND tz.abgesagt_am IS NULL
                     AND (tz.beginn AT TIME ZONE 'Europe/Berlin')::date > (NOW() AT TIME ZONE 'Europe/Berlin')::date)`,
        // E-IT-A: höchstens ein Versuch am Tag (TAGESPAUSE_STUNDEN) — außer
        // Termin heute oder ein offener Rückruf. v.lv = letzter Versuch (LATERAL).
        WIEDER_TAGESPAUSE])
      .join(" AND ");
    const WIEDER_GRUND_SQL = `CASE
      WHEN EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id AND tz.agent_id = $1 AND tz.status = 'gebucht'
                   AND tz.abgesagt_am IS NULL AND (tz.beginn AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date) THEN 'termin'
      WHEN EXISTS (SELECT 1 FROM fiaon_contact_log cl JOIN fiaon_applications a3 ON a3.ref = cl.ref
                   WHERE a3.person_id = p.id AND cl.outcome = 'rueckruf_termin' AND cl.done_at IS NULL
                     AND cl.voided_at IS NULL AND cl.scheduled_at IS NOT NULL AND cl.scheduled_at <= NOW() + INTERVAL '2 hours'
                     -- E-IT-A: ein Rückruf, nach dessen Zeit schon versucht wurde, ist beantwortet.
                     AND cl.scheduled_at > p.lv) THEN 'rueckruf'
      WHEN ${zusageOffenSql("p.lv")} THEN 'zusage'
      WHEN COALESCE(p.unreachable_count, 0) > 0 THEN 'nicht_erreicht'
      WHEN COALESCE(p.priority_tier, 0) = 0 THEN 'rate'
      ELSE 'wiedervorlage' END AS wieder_grund`;

    // ═══════════════════════════════════════════════════════════════════
    // DIE REIHENFOLGE DER ARBEITSLISTE (02.09.2026, Daniels Befund)
    //
    // Daniel: „Ich weiß nicht was los ist, aber heute über Pipeline erreiche
    // ich fast niemanden. Und irgendwie hab ich da jeden Tag aufs Neue die
    // selben Leute drin — keine neuen. Ich denke es würde mehr Sinn machen,
    // die Kunden anzuzeigen, die frisch einen Antrag gestellt haben."
    //
    // ER HATTE RECHT, und die Ursache war die Sortierung selbst: Sie ordnete
    // nach `updated_at` absteigend. Jede Berührung — auch ein erfolgloser
    // Anruf — setzt dieses Feld neu. Wer gestern vergeblich angerufen wurde,
    // stand heute wieder ganz oben; ein frischer Antrag von gestern Abend
    // stand dahinter. Gemessen am 02.09. in Daniels Liste: Platz 1 war ein
    // Kunde mit Antrag vom 21.08. und zwei Versuchen, Platz 3 einer mit
    // SECHS Versuchen — während drei Anträge vom 01.09. mit null Versuchen
    // weiter unten warteten.
    //
    // Neue Ordnung: Was heute fällig ist, zuerst. Dann die Frischen, die noch
    // niemand angerufen hat — Speed-to-Lead ist der einzige Hebel, der bei
    // Kaltkontakten messbar wirkt. Danach der Rest, jüngster Antrag zuerst,
    // und wer oft nicht erreichbar war, sinkt ab.
    // ═══════════════════════════════════════════════════════════════════
    // 07.09.2026 (E-162): Die Ordnung heißt jetzt Hitze und steht oben in
    // HITZE_ORDNUNG — Uhrzeit jetzt, Sofort-Spur (E-251), Zusage/Termin, Rückruf, jüngstes Ereignis; Stufe 3 zuletzt.
    // E-IT-A (08.10.2026): Die LINKE Spalte bleibt bei HITZE_ORDNUNG (Sofort-Spur,
    // Frische). Die RECHTE reiht nach WIEDER_ORDNUNG — Dringlichkeit, dann wer am
    // längsten nicht versucht wurde (Rotation). Einzelheiten bei wiederOrdnung().
    const ordnung = wiederOrdnung("v.lv", "v.ev");

    // §16: Vollständigkeit als Spalten direkt an der Karte — dieselbe Regel
    // wie kundeVollstaendig(), damit die 6 Slots keinen zweiten Weg brauchen.
    const VOLL_SQL = `
      (EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid' AND COALESCE(a.pack_key,'') <> 'schufa')
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
         AND a.archived_at IS NULL AND a.payment_status = 'paid'
         AND (a.pack_key = 'schufa' OR a.pack_name ILIKE '%bonität%' OR a.pack_name ILIKE '%schufa%'))
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL
         AND a.bank_statement_pdf IS NOT NULL)
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = p.id AND a.gdpr_deleted_at IS NULL
         AND a.id_card_pdf IS NOT NULL)) AS voll_kunde`;

    // ── ZWEI STUFEN STATT EINER (08.09.2026, Störung) ─────────────────────
    // Die Hitze-Sortierung rechnet je Zeile mehrere Unterabfragen. Über Daniels
    // 1.236 Menschen war das zu viel. Stufe 3 (797 Leads ohne Antrag) steht in
    // der Reihung ohnehin ganz hinten — außer mit Zusage, Termin oder Rückruf.
    // Also: erst die heißen Menschen (Stufe 1/2, Stufe 0 mit Rate, Stufe 3 nur
    // mit Zusage/Termin/Rückruf) voll sortiert; fehlen Plätze, Stufe 3 billig
    // nach Antragsdatum nachgefüllt. Karten- und Hitze-Felder erst für die
    // sechs Gewinner, nicht für alle Zeilen (Unterabfrage mit LIMIT).
    // ── LINKS = NOCH NIE KONTAKTIERT (09.09.2026, E-168, Team-Feedback Punkt 6) ──
    // Florentine: „Links sollten wirklich ausschließlich ganz neue Anträge erscheinen
    // — noch kein einziger Kontaktversuch. Rechts alle, bei denen schon eine
    // Bearbeitung stattgefunden hat und eine weitere Aktion nötig ist." Vorher
    // stand links jeder, der heute fällig war — auch wer gestern erreicht wurde.
    // Jetzt: links nur Stufe 1–3 ohne jedes Gesprächsergebnis (NIE_SQL); alles
    // andere (nicht erreicht und fällig, Zusage gebrochen, Rückruf, Termin heute,
    // fällige Rate, Wiedervorlage) steht rechts unter „Wieder dran".
    //
    // 23.09.2026 (E-212): Florentines Satz bleibt gültig — „ganz neue Anträge"
    // war aber als „noch nie angerufen" gebaut, und damit stand links
    // ausschließlich Stufe C (Messung oben bei NEU_FUER_DICH_SQL). Ein Antrag
    // von heute ist ein ganz neuer Antrag, auch wenn derselbe Mensch vor drei
    // Wochen als Lead am Telefon war. Genau das prüft NEU_FUER_DICH_SQL.
    const HEISS_SQL = NEU_FUER_DICH_SQL;
    const slotsHolen = async (): Promise<any[]> => {
      const heiss = (await lauf.unsafe(
        `SELECT ${KARTE_SQL}, p.mandat_seit, ${VOLL_SQL}, ${HITZE_SQL} FROM (
           SELECT p.* FROM fiaon_persons p
            WHERE ${basis} AND ${HEISS_SQL}
            ORDER BY ${NEU_ORDNUNG} LIMIT ${SLOTS}) p`, [me],
      )) as any[];
      if (heiss.length >= SLOTS) return heiss;
      const rest = (await lauf.unsafe(
        `SELECT ${KARTE_SQL}, p.mandat_seit, ${VOLL_SQL}, ${HITZE_SQL} FROM (
           SELECT p.* FROM fiaon_persons p
            WHERE ${basis} AND p.priority_tier = 3 AND ${NIE_SQL}
            ORDER BY ${FENSTER_ORDNUNG}, COALESCE((SELECT MAX(a4.created_at) FROM fiaon_applications a4
                                WHERE a4.person_id = p.id AND a4.merged_into IS NULL), p.created_at) DESC, p.id DESC
            LIMIT ${SLOTS - heiss.length}) p`, [me],
      )) as any[];
      const schon = new Set(heiss.map((r) => Number(r.id)));
      return [...heiss, ...rest.filter((r) => !schon.has(Number(r.id)))];
    };
    // ══════════════════════════════════════════════════════════════════════
    // DER VORRAT — WIE VIEL ARBEIT HINTER DEN SECHS PLÄTZEN STEHT (E-212)
    //
    // Justin: „Schau, dass die Leute für mehrere Tage genügend zu arbeiten
    // haben — die müssen auf Maximum arbeiten."
    //
    // GEMESSEN am 23.09.2026: Daniel hat 394 fällige A/B-Kunden und 1.032 noch
    // nie angerufene Leads. Arbeit ist also reichlich da — sichtbar waren
    // immer nur sechs Karten je Spalte, und was dahinter liegt, stand nirgends.
    // Wer sechs Karten sieht und nicht weiß, dass 400 dahinter warten, hört bei
    // Karte sechs auf.
    //
    // Die vier alten Stufen-Zähler wurden zwar berechnet, aber NIE angezeigt
    // (client/src/pages/agent/pipeline.tsx: `slotsZaehler` wird gesetzt und nie
    // gelesen) — eine teure Abfrage für nichts. Sie zählt jetzt das, was der
    // Verkäufer wirklich wissen muss: wie viele Menschen hinter jeder Spalte
    // stehen. Eine Abfrage wie vorher, ein Durchlauf, keine zusätzliche Last.
    // ══════════════════════════════════════════════════════════════════════
    const KEIN_TERMIN_ZUKUNFT = `NOT EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id
         AND tz.status = 'gebucht' AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())`;
    const basisGemeinsam = basisTeile
      .filter((t) => !t.includes("unreachable_count, 0) = 0") && !t.includes("tz.status = 'gebucht'"))
      .join(" AND ");
    // E-IT-A: „heute erledigt" und „pausiert" stehen am Kopf der rechten Spalte.
    // Pausiert = eigene Menschen, die die Wiedervorlage-Regel gerade zurückhält
    // (Wiedervorlage in der Zukunft, nicht ruhend, nicht wartend). Mitternacht in
    // Berlin, nicht in UTC (Zeit-Falle, AGENTS.md).
    const BERLIN_MITTERNACHT = `(date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')`;
    const [gSlots, zaehlerR, gWieder, heuteR] = await Promise.all([
      slotsHolen(),
      lauf.unsafe(
        `SELECT
           COUNT(*) FILTER (WHERE (COALESCE(p.unreachable_count, 0) = 0 OR ${FRISCH_SQL})
                              AND ${KEIN_TERMIN_ZUKUNFT} AND ${NEU_FUER_DICH_SQL})::int AS vorrat_neu,
           COUNT(*) FILTER (WHERE NOT ${LINKS_SQL}
                              AND NOT EXISTS (SELECT 1 FROM fiaon_termine tz WHERE tz.person_id = p.id
                                    AND tz.status = 'gebucht' AND tz.abgesagt_am IS NULL
                                    AND (tz.beginn AT TIME ZONE 'Europe/Berlin')::date > (NOW() AT TIME ZONE 'Europe/Berlin')::date)
                              AND ${WIEDER_TAGESPAUSE}
                              AND (p.priority_tier BETWEEN 1 AND 3
                                   OR (COALESCE(p.priority_tier, 0) = 0 AND ${RATE_FAELLIG_SQL})))::int AS vorrat_wieder
         FROM fiaon_persons p CROSS JOIN LATERAL (SELECT ${LETZTER_VERSUCH_SQL} AS lv) v
         WHERE ${basisGemeinsam}`, [me],
      ),
      lauf.unsafe(
        `SELECT ${KARTE_SQL}, p.mandat_seit, ${VOLL_SQL}, COALESCE(p.unreachable_count, 0) AS versuche, ${WIEDER_GRUND_SQL}, ${HITZE_SQL},
                NULLIF(p.lv, 'epoch'::timestamptz) AS letzter_versuch, ${LETZTES_ERGEBNIS_SQL} AS letztes_ergebnis,
                ${zusageOffenSql("p.lv")} AS zusage_offen
         FROM (
           SELECT p.*, v.lv FROM fiaon_persons p
            CROSS JOIN LATERAL (SELECT ${LETZTER_VERSUCH_SQL} AS lv, ${EREIGNIS_SQL} AS ev) v
            WHERE ${basisWieder} AND (p.priority_tier BETWEEN 1 AND 3
                                      OR (COALESCE(p.priority_tier, 0) = 0 AND ${RATE_FAELLIG_SQL}))
            ORDER BY ${ordnung} LIMIT ${Math.min(Math.max(Math.floor(opts.wiederBis ?? SLOTS), 1), 200)}) p`, [me],
      ),
      lauf.unsafe(
        `SELECT
           (SELECT COUNT(DISTINCT COALESCE(cl.person_id, a.person_id))::int
              FROM fiaon_contact_log cl LEFT JOIN fiaon_applications a ON a.ref = cl.ref
             WHERE cl.agent_id = $1 AND cl.type = 'result' AND cl.voided_at IS NULL
               AND cl.created_at >= ${BERLIN_MITTERNACHT}) AS heute_erledigt,
           (SELECT COUNT(*)::int FROM fiaon_persons p
             WHERE ${PAUSIERT_SQL}) AS pausiert`, [me],
      ),
    ]);
    const heute = berlinToday();
    const wieder = (gWieder as any[]).map((r) => {
      const versuche = Number(r.versuche || 0);
      // E-IT-A: Der Grund in Worten — aus derselben Regel wie die Meldung nach dem Ergebnis.
      // Stufe A (Zahlung gemeldet) mit fälliger Zusage: immer „Zahlung prüfen" (Gegenprüfung 08.10.2026).
      const grund: WiedervorlageGrund = r.wieder_grund === "zusage"
        ? (Number(r.priority_tier) === 1 || grundAusLetztemErgebnis(r.letztes_ergebnis, versuche) === "zahlung_pruefen" ? "zahlung_pruefen" : "zusage_pruefen")
        : r.wieder_grund === "termin" ? "termin"
        : r.wieder_grund === "rueckruf" ? "rueckruf"
        : r.wieder_grund === "rate" ? "rate"
        : grundAusLetztemErgebnis(r.letztes_ergebnis, versuche);
      return {
        gruppe: gruppeVon(Number(r.priority_tier), r.rate_faellig === true),
        kunde: {
          ...karte(r), mandatSeit: r.mandat_seit ?? null, vollstaendig: !!r.voll_kunde,
          wiederGrund: String(r.wieder_grund), versuche, hitze: hitzeVon(r),
          letzterVersuch: r.letzter_versuch ?? null, wiederText: GRUND_TEXT[grund], zusageOffen: r.zusage_offen === true,
        },
      };
    });
    const slots: { gruppe: string; kunde: any }[] = (gSlots as any[]).map((r) => ({
      gruppe: gruppeVon(Number(r.priority_tier), r.rate_faellig === true),
      kunde: { ...karte(r), mandatSeit: r.mandat_seit ?? null, vollstaendig: !!r.voll_kunde, hitze: hitzeVon(r), zusageOffen: r.zusage_faellig === true },
    }));

    const z = (zaehlerR as any[])[0] || {};
    const h = (heuteR as any[])[0] || {};
    return {
      wieder,
      slots,
      // E-212: der echte Vorrat hinter den beiden Spalten.
      vorrat: { neu: Number(z.vorrat_neu || 0), wieder: Number(z.vorrat_wieder || 0) },
      // E-IT-A: Kopf der rechten Spalte — „heute erledigt X · Y pausiert".
      heute: { datum: heute, erledigt: Number(h.heute_erledigt || 0), pausiert: Number(h.pausiert || 0) },
    };
}


// ═══════════════════════════════════════════════════════════════════════════
// GET /agent/vertrieb/pausiert — WER GERADE PAUSIERT, BIS WANN, WARUM
// (E-IT-A, 08.10.2026). Die Wiedervorlage-Regel hält Menschen bewusst zurück
// (nach „zahlt sofort" 3 Werktage, ab dem 6. Fehlversuch 14 Tage …). Eine
// Liste, die jemanden wortlos zurückhält, erzeugt den Anruf beim Chef („ich
// finde den Kunden nicht mehr", Hans-Jürgen 27.08.). Deshalb steht am Kopf
// der rechten Spalte „Y pausiert" — ein Klick öffnet diese Liste, und jeder
// Mensch darin lässt sich mit „Heute wieder dran" sofort zurückholen
// (POST /agent/crm/kunden/:id/wiedervorlage).
// ═══════════════════════════════════════════════════════════════════════════
router.get("/agent/vertrieb/pausiert", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await globalKundeBereit();
    const zeilen = (await sqlPool.unsafe(`
      SELECT p.id, ${NAME_SQL} AS name, p.priority_tier, to_char(p.follow_up_date, 'YYYY-MM-DD') AS wieder_am,
             COALESCE(p.unreachable_count, 0) AS versuche,
             NULLIF(${LETZTER_VERSUCH_SQL}, 'epoch'::timestamptz) AS letzter_versuch,
             ${LETZTES_ERGEBNIS_SQL} AS letztes_ergebnis
        FROM fiaon_persons p
       WHERE ${PAUSIERT_SQL}
       ORDER BY p.follow_up_date ASC, p.id DESC
       LIMIT 200`, [req.agent!.id])) as any[];
    const heute = berlinToday();
    res.json({
      ok: true, heute,
      personen: zeilen.map((r) => {
        const versuche = Number(r.versuche || 0);
        const grund = grundAusLetztemErgebnis(r.letztes_ergebnis, versuche);
        return {
          personId: Number(r.id), name: String(r.name || ""), stufe: Number(r.priority_tier),
          wiederAm: r.wieder_am ? String(r.wieder_am) : null, grund, grundText: GRUND_TEXT[grund],
          text: r.wieder_am ? wiederDranText(String(r.wieder_am), grund, heute) : null,
          versuche, letzterVersuch: r.letzter_versuch ?? null,
          pausiertNachFehlversuchen: versuche >= PAUSE_AB_FEHLVERSUCH,
        };
      }),
    });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] pausiert:", err);
    res.status(500).json({ ok: false, error: "Die Liste „pausiert“ ließ sich nicht laden." });
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
// Stichtag Berlin-heute) und Monatsrate (Ratenbetrag, sonst amount_due der Karte).
// Der SEPA-Status ist seit 19.09.2026 weg — GoCardless ist beendet (E-194).
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
            'rateCents',    MAX(r.betrag_cents)
          ) FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
          WHERE ar.person_id = p.id AND ar.merged_into IS NULL AND r.storniert_am IS NULL) AS raten_stand,
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
        },
        bezahlt: !!r.hat_bezahlt,
        onboardingErledigt: !!r.onboarding_erledigt,
        // Monatsrate: der echte Ratenbetrag; solange keine Raten existieren,
        // der offene Kartenbetrag (amount_due) als bester bekannter Wert.
        monatsrateCents: s.rateCents != null ? Number(s.rateCents) : (k as any).betrag ?? null,
      };
    });
    // ── „IN BETREUUNG — NOCH KEIN MANDAT" (01.09.2026, Team-Feedback P7) ──
    // Der Befund: Ein Mitarbeiter nimmt einen Kunden aus dem Pool, ruft an,
    // klickt „Nicht erreicht" — die Wiedervorlage nimmt ihn korrekt aus der
    // Arbeitsliste, aber der Bestand zeigte NUR Mandate. Der Kunde war also
    // nirgends sichtbar; rief er zurück, fand ihn der Mitarbeiter nicht.
    // Diese zweite, rein lesende Rubrik zeigt alle zugewiesenen Kunden ohne
    // Mandat, mit denen schon gearbeitet wurde (Verlaufseintrag oder Termin) —
    // inklusive der Ruhenden. Die Mandatszählung x/500 bleibt unberührt.
    const inArbeitRows = (await sqlPool.unsafe(
      `SELECT ${KARTE_SQL}, p.follow_up_date,
         (SELECT MAX(c.created_at) FROM fiaon_contact_log c
           JOIN fiaon_applications ac ON ac.ref = c.ref
           WHERE ac.person_id = p.id AND c.voided_at IS NULL) AS letzter_eintrag
       FROM fiaon_persons p
       WHERE p.assigned_agent_id = $1 AND p.mandat_seit IS NULL
         AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL AND NOT p.is_blocked
         AND (EXISTS (SELECT 1 FROM fiaon_contact_log c2
                        JOIN fiaon_applications ac2 ON ac2.ref = c2.ref
                        WHERE ac2.person_id = p.id AND c2.voided_at IS NULL
                          AND c2.type IN ('note', 'result'))
              OR EXISTS (SELECT 1 FROM fiaon_termine t2 WHERE t2.person_id = p.id))
       ORDER BY letzter_eintrag DESC NULLS LAST, p.id DESC
       LIMIT 200`, [req.agent!.id],
    )) as any[];
    const inArbeit = inArbeitRows.map((r) => ({
      kunde: karte(r),
      wiedervorlage: r.follow_up_date ?? null,
      letzterEintrag: r.letzter_eintrag ?? null,
    }));

    res.json({ ok: true, mandate, inArbeit, max: MANDATE_MAX });
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

// 18.09.2026: „welcome" ist die Antrag-eingegangen-Mail, der Zugang ist
// zugang_link — die Anzeige sagte bisher für beides „Zugangs-Mail".
const MAIL_TITEL: Record<string, string> = {
  payment_details: "Zahlungsdaten-Mail", welcome: "Mail „Antrag eingegangen“",
  zugang_link: "Zugangs-Mail", bereich_freigeschaltet: "Mail „Bereich freigeschaltet“",
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
