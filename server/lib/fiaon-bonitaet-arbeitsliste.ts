// ═══════════════════════════════════════════════════════════════════════════
// BONITÄTSAUSWERTUNG · WER WARTET? — die Arbeitsliste im Chefbüro (E-364, 14.10.2026)
//
// Bis heute (E-352) kannte die Liste nur Käufer der 74-€-Bonitätsauskunft. Seit
// E-362 ist die Bonität für jeden Kunden Pflicht, und seit E-363 geht der
// Kartenlink der Partnerbank erst nach der freigegebenen FIAON-Bonitätsauswertung
// raus. Ein zahlender Paketkunde ohne Auskunft-Kauf stand in keiner Liste — sein
// Link wartete, und niemand sah ihn.
//
// Wer drinsteht:
//   · jeder mit bezahltem Privatpaket (PAKET_BESTELLUNG_SQL, dieselbe Lesart wie
//     paket_bezahlt der Karte) — ohne Global-Kunden, ohne wirksam Gekündigte;
//   · jeder Käufer der Bonitätsauskunft wie bisher — auch nach einer Kündigung
//     des Pakets: Die Kündigung gilt dem Stufenpaket, nicht der Auskunft
//     (shared/fiaon-kuendigung-regel.ts), und die Auswertung IST die bezahlte
//     Leistung (E-353). Gemessen 14.10.: 16 gekündigte Käufer, keiner beliefert.
//   · nie Testkonten (ECHT) und nie Global-Kunden (globalKundeSql, E-272).
//
// „Wartet auf den Kartenlink“ heißt: Paket bezahlt, und der erste Grund der EINEN
// Regel (shared/fiaon-karten-weg.ts, karteAusschlussSql) ist „bonitaet_offen“ —
// noch keine Einladung, kein Bestandsschutz (Link schon draußen, Vertrag
// PV-2026-10-05b), keine Bonität, und nichts anderes hält den Link auf. Ist die
// Auswertung freigegeben, schickt die Automatik den Link von selbst.
//
// Die Liste startet NICHTS. Justin: „nicht automatisch erstellen, sondern ERST
// wenn man den Knopf drückt“ — der Knopf steht in der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { IST_AUSKUNFT, ECHT } from "./fiaon-umsatz-quelle";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { PAKET_BESTELLUNG_SQL, karteAusschlussSql, bonitaetBereit, ensureKartenTabelle } from "./fiaon-konto-karte";
import { KUENDIGUNG_WIRKSAM_SQL } from "@shared/fiaon-kuendigung-regel";

type Lauf = typeof sqlPool;

export type AuswertungStand = "bereit" | "laeuft" | "entwurf" | "fehlt" | "beim_kunden";

export interface ArbeitslisteZeile {
  personId: number;
  name: string;
  betreuer: string | null;
  /** Die erste bezahlte Bestellung (Paket oder Auskunft). */
  bezahltAm: string | null;
  ausweis: boolean;
  kontoauszug: boolean;
  stand: AuswertungStand;
  gesamt: string | null;
  finanzwert: number | null;
  vierAugen: boolean;
  gescheitert: boolean;
  /** Bezahltes Privatpaket. */
  paket: boolean;
  /** Bonitätsauskunft (74 €) gekauft. */
  auskunft: boolean;
  /** Wirksam gekündigt — steht nur als Auskunft-Käufer hier. */
  gekuendigt: boolean;
  /** Der Kartenlink wartet nur noch auf die Bonität (Grund „bonitaet_offen“). */
  wartetKarte: boolean;
}

/** Reihenfolge der Stände: wer jetzt dran ist, zuerst. */
const RANG: Record<AuswertungStand, number> = { bereit: 0, laeuft: 1, entwurf: 2, fehlt: 3, beim_kunden: 4 };

/** Die Abfrage. `mitAuswahl`: nur die Personen in $1 (int[]) — für den Prüfstand. */
export function arbeitslisteSql(opt: { mitAuswahl?: boolean } = {}): string {
  return `
    WITH k AS (
      SELECT a.person_id,
             MIN(COALESCE(a.paid_at, a.completed_at)) AS bezahlt_am,
             BOOL_OR(${PAKET_BESTELLUNG_SQL("a")}) AS paket,
             BOOL_OR(${IST_AUSKUNFT}) AS auskunft
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.payment_status = 'paid' AND a.merged_into IS NULL AND ${ECHT}
         AND (${PAKET_BESTELLUNG_SQL("a")} OR ${IST_AUSKUNFT})
         ${opt.mitAuswahl ? "AND a.person_id = ANY($1::int[])" : ""}
       GROUP BY a.person_id
    ), m AS (
      SELECT k.*, ${KUENDIGUNG_WIRKSAM_SQL("k.person_id")} AS gekuendigt
        FROM k
       WHERE NOT ${globalKundeSql("k.person_id")}
    )
    SELECT m.person_id, m.bezahlt_am, m.paket, m.auskunft, m.gekuendigt,
           TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name,
           ag.name AS betreuer,
           EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.person_id = m.person_id AND b.merged_into IS NULL AND b.id_card_pdf IS NOT NULL) AS ausweis,
           (EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.person_id = m.person_id AND b.merged_into IS NULL AND b.bank_statement_pdf IS NOT NULL)
            OR EXISTS (SELECT 1 FROM fiaon_dokumente d WHERE d.person_id = m.person_id AND d.kategorie = 'kontoauszug'
                         AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL)) AS auszug,
           (m.paket AND COALESCE(${karteAusschlussSql("m.person_id")} = 'bonitaet_offen', FALSE)) AS wartet_karte,
           f.status AS fa_status, f.gesamt, f.finanzwert, f.vier_augen
      FROM m
      JOIN fiaon_persons p ON p.id = m.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
      LEFT JOIN LATERAL (
        SELECT status, gesamt, finanzwert, vier_augen FROM fiaon_finanzauswertungen fz
         WHERE fz.person_id = m.person_id AND fz.status IN ('laeuft', 'entwurf', 'freigegeben', 'fehler')
         ORDER BY (fz.status = 'freigegeben') DESC, fz.erstellt_am DESC LIMIT 1
      ) f ON TRUE
     WHERE (m.paket AND NOT m.gekuendigt) OR m.auskunft`;
}

/** Der Stand einer Zeile — dieselbe Lesart wie seit E-352. */
function standAus(z: any): AuswertungStand {
  return z.fa_status === "freigegeben" ? "beim_kunden" : z.fa_status === "entwurf" ? "entwurf" : z.fa_status === "laeuft" ? "laeuft"
    : z.ausweis && z.auszug ? "bereit" : "fehlt";
}

/**
 * Die Liste mit Zählern. Sortiert: Stand (Startklar zuerst), darin „wartet auf den Kartenlink“ vorn,
 * dann wer am längsten bezahlt hat. Liest nur — keine Auswertung, keine Mail.
 */
export async function bonitaetArbeitsliste(lauf: Lauf = sqlPool, opt: { personIds?: number[] } = {}): Promise<{
  zahlen: Record<AuswertungStand | "gesamt" | "wartet_karte" | "wartet_karte_bereit", number>;
  liste: ArbeitslisteZeile[];
}> {
  const { ensureFinanzauswertungTabellen } = await import("./fiaon-finanzauswertung");
  await ensureFinanzauswertungTabellen();
  await bonitaetBereit(); // karteAusschlussSql liest fiaon_finanzauswertungen und fiaon_vertragsannahmen
  await globalKundeBereit(); // … und fiaon_global_angebote
  await ensureKartenTabelle(); // … und fiaon_konto_karte (schon eingeladen)
  const mitAuswahl = Array.isArray(opt.personIds);
  const zeilen = (await lauf.unsafe(arbeitslisteSql({ mitAuswahl }), mitAuswahl ? [opt.personIds!.map(Number)] : [])) as any[];
  const liste: ArbeitslisteZeile[] = zeilen.map((z) => ({
    personId: Number(z.person_id), name: String(z.name || "").trim() || `Person ${z.person_id}`, betreuer: z.betreuer ?? null,
    bezahltAm: z.bezahlt_am ? new Date(z.bezahlt_am).toISOString() : null, ausweis: !!z.ausweis, kontoauszug: !!z.auszug,
    stand: standAus(z), gesamt: z.gesamt ?? null, finanzwert: z.finanzwert != null ? Number(z.finanzwert) : null, vierAugen: !!z.vier_augen,
    gescheitert: z.fa_status === "fehler",
    paket: !!z.paket, auskunft: !!z.auskunft, gekuendigt: !!z.gekuendigt, wartetKarte: !!z.wartet_karte,
  })).sort((a, b) => RANG[a.stand] - RANG[b.stand] || Number(b.wartetKarte) - Number(a.wartetKarte)
    || String(a.bezahltAm ?? "").localeCompare(String(b.bezahltAm ?? "")));
  const zahlen = { gesamt: liste.length, bereit: 0, laeuft: 0, entwurf: 0, fehlt: 0, beim_kunden: 0, wartet_karte: 0, wartet_karte_bereit: 0 };
  for (const z of liste) {
    zahlen[z.stand]++;
    if (z.wartetKarte) { zahlen.wartet_karte++; if (z.stand === "bereit") zahlen.wartet_karte_bereit++; }
  }
  return { zahlen, liste };
}
