// ═══════════════════════════════════════════════════════════════════════════
// DAS LAGEZIMMER — alle Zahlen des Unternehmens an einem Ort (26.08.2026)
//
// Justin: „Stelle sicher, dass man als ADMIN wirklich ALLES machen kann, über
//          die gesamte Plattform verfügen — wirklich an JEDES DETAIL muss
//          gedacht werden."
//
// ── DIE REGEL DIESER DATEI ────────────────────────────────────────────────
// Jede Zahl hier ist GEZÄHLT, nicht geschätzt, und jede sagt, worauf sie sich
// bezieht. Ein Dashboard, dessen Zahlen niemand nachrechnen kann, wird beim
// ersten Zweifel nicht mehr geglaubt — und dann ist es wertlos.
//
// Deshalb liefert jede Kennzahl neben dem Wert auch:
//   · `was`   — was genau gezählt wurde, in einem Satz
//   · `wohin` — der Ort in der Plattform, an dem man es bearbeitet
// Der Bildschirm zeigt beides. Wer eine Zahl anzweifelt, klickt sie an und
// steht vor den Datensätzen, aus denen sie besteht.
//
// ── ZEITRECHNUNG ──────────────────────────────────────────────────────────
// Alle Tagesgrenzen in Europe/Berlin. „Heute" heißt der Berliner Tag, nicht
// der UTC-Tag — sonst wechselt das Dashboard um zwei Uhr nachts den Tag.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";
import { umsatzBausteine, geldAbgleich } from "./fiaon-chef-zahlen";
import { ECHT as BESTELLUNG_ECHT, UMSATZ_QUELLE_SQL } from "../lib/fiaon-umsatz-quelle";

const router = Router();

/** Berliner Tagesgrenze als SQL-Ausdruck. */
const HEUTE = "(NOW() AT TIME ZONE 'Europe/Berlin')::date";

/** Nur echte Menschen: keine Testeinträge, keine Zusammenführungen. */
// GEFUNDEN 26.08. abends beim Ansehen der fertigen Zahlungszentrale: In den
// Geldzahlen steckten 495,92 EUR aus Test- und Prüfstand-Konten („Das is Ein
// Testaccount", „Aktive Demo-Kundin", …). Eine Umsatzzahl, in der Testgeld
// mitläuft, ist bei der ersten Due Diligence erledigt. Deshalb prüft ab jetzt
// JEDE Raten-Abfrage, ob die Akte einem Testkonto gehört.
const ECHT = "p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL";

/**
 * Offene Raten echter Kunden (Alias r) — E-343 (13.10.2026): dieselbe Grenze wie die Abo-Tafel
 * (aboUebersicht): offene Rate, Bestellung nicht zusammengeführt, kein Testkonto (ECHT der Umsatzquelle).
 */
const OFFENE_RATEN = `FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
      LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE r.status = 'offen' AND ${BESTELLUNG_ECHT}`;

async function eineZahl(sql: string): Promise<number> {
  try {
    const [r] = (await sqlPool.unsafe(sql)) as any[];
    const wert = r ? Object.values(r)[0] : 0;
    return Number(wert ?? 0);
  } catch (e) {
    console.error("[CHEF-LAGE]", String(e).slice(0, 160));
    return 0;
  }
}

// GEFUNDEN beim Nachprüfen 26.08.2026: Diese Route stand ohne Wache im Netz.
// Umsatz, Kundenzahl und Teamgrößen waren mit einem einzigen curl-Aufruf
// abrufbar. Ab hier gilt dieselbe Schwelle wie für den Raum selbst: Leitung.
router.get("/chef/lage", requireChef("leitung"), async (_req: Request, res: Response) => {
  try {
    // ── GELD ────────────────────────────────────────────────────────────────
    // Die Eingänge (heute/Monat/Vormonat …) kommen aus umsatzBausteine() unten.
    // E-343 (13.10.2026): Die drei eigenen Raten-Summen, die hier noch liefen und deren Ergebnis die Antwort
    // nie las, sind entfernt. Provision „noch nicht ausgezahlt" = bestätigt ODER in Auszahlung (beides ist
    // noch nicht überwiesen), ohne Testkonten — vorher nur „bestaetigt" (960,50 € statt 5.836,30 €).
    const [
      ratenOffen, ratenUeberfaellig, ueberfaelligSumme,
      provOffen, provOffenSumme, abrechnungenOffen,
    ] = await Promise.all([
      eineZahl(`SELECT COUNT(*) ${OFFENE_RATEN}`),
      eineZahl(`SELECT COUNT(*) ${OFFENE_RATEN} AND r.faellig_am < ${HEUTE}`),
      eineZahl(`SELECT COALESCE(SUM(r.betrag_cents),0) ${OFFENE_RATEN} AND r.faellig_am < ${HEUTE}`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_commissions c LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
                 WHERE c.status IN ('bestaetigt','in_auszahlung') AND NOT COALESCE(ag.is_test_account, FALSE)`),
      eineZahl(`SELECT COALESCE(SUM(c.amount_cents),0) FROM fiaon_commissions c LEFT JOIN fiaon_agents ag ON ag.id = c.agent_id
                 WHERE c.status IN ('bestaetigt','in_auszahlung') AND NOT COALESCE(ag.is_test_account, FALSE)`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_commission_statements WHERE gesendet_am IS NULL`),
    ]);

    // ── KUNDEN ──────────────────────────────────────────────────────────────
    const [
      menschenGesamt, zahlende, imPool, neuHeute, mandate, gesperrt,
    ] = await Promise.all([
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p WHERE ${ECHT}`),
      eineZahl(`SELECT COUNT(DISTINCT p.id) FROM fiaon_persons p
                  JOIN fiaon_applications a ON a.person_id = p.id
                 WHERE ${ECHT} AND a.merged_into IS NULL AND a.payment_status = 'paid'`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p
                 WHERE ${ECHT} AND p.assigned_agent_id IS NULL AND p.mandat_seit IS NULL
                   AND NOT p.is_blocked AND p.priority_tier IN (1,2,3)`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p
                 WHERE ${ECHT} AND (p.created_at AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE}`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p WHERE ${ECHT} AND p.mandat_seit IS NOT NULL`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p WHERE ${ECHT} AND p.is_blocked`),
    ]);

    // ── TEAM ────────────────────────────────────────────────────────────────
    // E-188 (17.09.2026): „erledigt ohne Ergebnis" misst das Ergebnis im
    // Kundenverlauf. Ein Erstgespräch zu FIAON Global dokumentiert sich im
    // Firmen-Cockpit (fiaon_firmen_log) — hier mitgezählt, wäre jedes davon ein
    // falscher Alarm. Deshalb steht „global" neben dem Startgespräch draußen.
    const [teamAktiv, kontakteHeute, termineHeute, termineOhneErgebnis] = await Promise.all([
      eineZahl(`SELECT COUNT(*) FROM fiaon_agents WHERE active AND NOT COALESCE(is_test_account, FALSE)`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_contact_log
                 WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE} AND type = 'result'`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_termine
                 WHERE (beginn AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE}
                   AND status = 'gebucht' AND abgesagt_am IS NULL`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_termine t
                 WHERE t.status = 'erledigt' AND t.quelle NOT IN ('onboarding_call', 'global')
                   AND NOT EXISTS (SELECT 1 FROM fiaon_contact_log c
                                    WHERE c.person_id = t.person_id AND c.type = 'result'
                                      AND c.created_at >= t.beginn)`),
    ]);

    // ── WAS KLEMMT ──────────────────────────────────────────────────────────
    // Bewusst nur Dinge, zu denen man ETWAS TUN kann. Eine Warnung ohne
    // Handlung ist Lärm.
    const [zusageGebrochen, ohneTermin, dublettenVerdacht, nummerOhneLand] = await Promise.all([
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p
                 WHERE ${ECHT} AND p.promised_payment_date < ${HEUTE} AND NOT p.is_blocked`),
      eineZahl(`SELECT COUNT(DISTINCT p.id) FROM fiaon_persons p
                  JOIN fiaon_applications a ON a.person_id = p.id
                 WHERE ${ECHT} AND a.merged_into IS NULL AND a.payment_status = 'paid'
                   AND NOT EXISTS (SELECT 1 FROM fiaon_termine t
                                    WHERE t.person_id = p.id
                                      AND ((t.quelle = 'onboarding_call' AND t.status IN ('erledigt','gebucht'))
                                        OR (t.status = 'gebucht' AND t.beginn > NOW())))`),
      eineZahl(`SELECT COUNT(*) FROM (
                  SELECT lower(primary_email) FROM fiaon_persons p
                   WHERE ${ECHT} AND primary_email IS NOT NULL AND primary_email <> ''
                   GROUP BY 1 HAVING COUNT(*) > 1) x`),
      eineZahl(`SELECT COUNT(*) FROM fiaon_persons p
                 WHERE ${ECHT} AND p.primary_phone LIKE '0%' AND p.primary_phone NOT LIKE '00%'
                   AND COALESCE(p.country,'') = ''`),
    ]);

    // Der Verlauf kommt aus umsatzBausteine() (E-343: die eigene Raten-Abfrage hier war tot).

    // ── DAS TEAM HEUTE ─────────────────────────────────────────────────────
    const team = (await sqlPool.unsafe(`
      SELECT ag.id, ag.name, ag.rolle,
             COALESCE(ag.commission_rate_bp, 0) AS satz_bp,
             (SELECT COUNT(*) FROM fiaon_persons p
               WHERE p.assigned_agent_id = ag.id AND p.mandat_seit IS NOT NULL
                 AND p.merged_into_person_id IS NULL)::int AS mandate,
             (SELECT COUNT(*) FROM fiaon_contact_log c
               WHERE c.agent_id = ag.id AND c.type = 'result'
                 AND (c.created_at AT TIME ZONE 'Europe/Berlin')::date = ${HEUTE})::int AS heute,
             -- E-343: Berliner Monat, stornierte Provisionen zählen nicht.
             (SELECT COALESCE(SUM(k.amount_cents),0) FROM fiaon_commissions k
               WHERE k.agent_id = ag.id AND k.status <> 'storniert'
                 AND date_trunc('month', k.created_at AT TIME ZONE 'Europe/Berlin')
                   = date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin'))::bigint AS provision_monat
        FROM fiaon_agents ag
       WHERE ag.active AND NOT COALESCE(ag.is_test_account, FALSE)
       ORDER BY 7 DESC, 6 DESC`)) as any[];

    // ── DIE LETZTEN ZAHLUNGEN ──────────────────────────────────────────────
    // E-343 (13.10.2026): aus der EINEN Umsatzquelle — vorher nur Raten (Auskünfte und Einmalkäufe fehlten,
    // Testgeld über FIAON-TEST-Referenzen lief mit). Einmalkäufe: rateNr 0, Paket = Bestellname oder Art.
    const letzte = (await sqlPool.unsafe(`
      WITH q AS (${UMSATZ_QUELLE_SQL})
      SELECT q.am, q.cents, q.art, q.rate_nr,
             COALESCE(r.zahlungsreferenz, a.payment_reference) AS zahlungsreferenz,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), a.email, '—') AS kunde,
             p.id AS person_id,
             COALESCE(NULLIF(TRIM(a.pack_name), ''),
                      CASE q.art WHEN 'auskunft' THEN 'Bonitätsauskunft' WHEN 'global' THEN 'Einmalkauf' END) AS pack_name,
             ag.name AS betreuer
        FROM q
        JOIN fiaon_applications a ON a.ref = q.ref
        LEFT JOIN fiaon_abo_raten r ON q.art = 'rate' AND r.ref = q.ref AND r.rate_nr = q.rate_nr
        LEFT JOIN fiaon_persons p ON p.id = a.person_id
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
       ORDER BY q.am DESC LIMIT 12`)) as any[];

    const [umsatz, abgleich] = await Promise.all([umsatzBausteine(), geldAbgleich().catch(() => null)]);

    res.json({
      ok: true,
      stand: new Date().toISOString(),
      geld: {
        // ── AUS DEM EINEN UMSATZ-BAUSTEIN (27.08.2026) ────────────────────
        // Vorher rechnete diese Seite nur Raten (ohne Bonitaetsauskuenfte)
        // mit eigenem Filter — Juli hiess hier 13.730 €, im Wert-Raum
        // 15.506 €. Justins Regel: ALLE Zahlen muessen IMMER passen. Die
        // Eingaenge (heute/Woche/Monat/Jahr) und der Verlauf kommen jetzt
        // aus umsatzBausteine() — derselben Quelle wie /chef/zahlen.
        eingangHeute: umsatz.heuteCents, eingangWoche: umsatz.wocheCents,
        eingangMonat: umsatz.monatCents, eingangVormonat: umsatz.vormonatCents,
        eingangJahr: umsatz.jahrCents, eingangGesamt: umsatz.gesamtCents,
        ratenOffen, ratenUeberfaellig, ueberfaelligSumme,
        provOffen, provOffenSumme, abrechnungenOffen,
        // E-343: Bank gegen Buchung (heute + Monat, offene Eingänge) — dieselbe Prüfung wie in der Tagesübersicht.
        abgleich,
      },
      kunden: { menschenGesamt, zahlende, imPool, neuHeute, mandate, gesperrt },
      team: { teamAktiv, kontakteHeute, termineHeute, termineOhneErgebnis },
      klemmt: { zusageGebrochen, ohneTermin, dublettenVerdacht, nummerOhneLand },
      verlauf: umsatz.verlauf.map((v) => ({
        // E-188: FIAON Global ist Einmalerlös wie die Auskunft — er zählt zum Monat.
        monat: v.monat, cents: v.ratenCents + v.auskunftCents + v.globalCents,
        auskunftCents: v.auskunftCents, globalCents: v.globalCents, zahlungen: v.zahlungen,
      })),
      mitarbeiter: team.map((t) => ({
        id: Number(t.id), name: t.name, rolle: t.rolle,
        satzBp: Number(t.satz_bp), mandate: Number(t.mandate),
        heute: Number(t.heute), provisionMonat: Number(t.provision_monat),
      })),
      letzteZahlungen: letzte.map((z) => ({
        am: z.am, cents: Number(z.cents), referenz: z.zahlungsreferenz,
        rateNr: Number(z.rate_nr ?? 0), kunde: z.kunde, personId: z.person_id ? Number(z.person_id) : null,
        paket: z.pack_name, betreuer: z.betreuer,
      })),
    });
  } catch (err) {
    console.error("[CHEF-LAGE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
