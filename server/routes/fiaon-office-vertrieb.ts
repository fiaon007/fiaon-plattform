// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Vertriebs-Arbeitsliste 2+2+2 (23.08.2026, E-043, Plan §15)
//
//   GET /agent/vertrieb/arbeitsliste → { slots: [{ gruppe, kunde }], zaehler }
//
// GENAU 6 Karten: je 2 aus „Bezahlt gemeldet – Termin fehlt“ (tier 1),
// „Antrag fertig – Rechnung offen“ (tier 2), „Registriert – noch kein Antrag“
// (tier 3). Ist eine Gruppe leer, rückt die nächste auf (Reihenfolge 1 → 2 → 3),
// bis 6 Slots stehen oder nichts mehr da ist.
//
// KEINE eigenen Bausteine: Kartenform (KARTE_SQL/karte) und Ausschlüsse
// (ruhtSql aus fiaon-nicht-erreicht.ts, wartetSql aus fiaon-warten.ts,
// is_blocked, ist_test_am, Wiedervorlage in der Zukunft) kommen aus derselben
// Quelle wie /agent/kunden/liste — eine zweite Fassung wäre die zweite
// Wahrheit, aus der die alten Fehler entstanden sind.
//
// „Kein Interesse“ braucht hier KEINE neue Tabelle: Das bestehende Ergebnis
// `erreicht_abgelehnt` (POST /agent/crm/kunden/:id/aktivitaet) setzt
// `fiaon_persons.is_blocked` — die Verteilung (fiaon-zuteilung.ts, Grund
// „gesperrt“) und alle Arbeitslisten (`NOT p.is_blocked`) respektieren das
// schon. Deshalb legt dieser Router nichts Doppeltes an.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { KARTE_SQL, karte } from "./fiaon-agent-start";
import { ruhtSql } from "../lib/fiaon-nicht-erreicht";
import { wartetSql } from "../lib/fiaon-warten";
import { ensureKartenSpalten } from "../lib/fiaon-kartenstatus";
import { ensureBetreuungSpalte } from "../lib/tier";

const router = Router();

const HEUTE = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;

/** Die drei Gruppen der Arbeitsliste — Übersetzung des vorhandenen priority_tier. */
const GRUPPEN: { key: string; tier: number }[] = [
  { key: "bezahlt_gemeldet", tier: 1 },
  { key: "rechnung_offen", tier: 2 },
  { key: "lead", tier: 3 },
];
const JE_GRUPPE = 2;
const SLOTS = 6;

router.get("/agent/vertrieb/arbeitsliste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    // Dieselben Wände wie /agent/kunden/liste: Das Forderungsmanagement hat
    // seine eigene Liste, Onboarding arbeitet Termine, keinen Vertrieb.
    const { istInkasso } = await import("./fiaon-inkasso-bereich");
    if (await istInkasso(req.agent!.id)) {
      return res.status(404).json({ ok: false, error: "Diese Liste gibt es für dich nicht — deine Arbeit steht unter „Forderungen“." });
    }
    const { istOnboarding } = await import("./fiaon-onboarding-bereich");
    if (await istOnboarding(req.agent!.id)) {
      return res.json({ ok: true, rolle: "onboarding", slots: [], zaehler: {} });
    }

    await ensureKartenSpalten();
    await ensureBetreuungSpalte(sqlPool);
    const me = req.agent!.id;

    // ── Die gemeinsamen Ausschlüsse — wörtlich dieselben Bausteine wie die
    //    große Liste, plus: Wer einen GEBUCHTEN Termin in der Zukunft hat, ist
    //    „erfolgreich vereinbart“ und gehört nicht mehr in die Anrufliste.
    //    (Das deckt auch „Bezahlt gemeldet – TERMIN FEHLT“ ab.)
    const basis = [
      "p.assigned_agent_id = $1",
      "p.merged_into_person_id IS NULL",
      "p.ist_test_am IS NULL",
      "NOT p.is_blocked",
      `NOT ${ruhtSql("p")}`,
      `NOT ${wartetSql("p")}`,
      `(p.follow_up_date IS NULL OR p.follow_up_date <= ${HEUTE})`,
      `NOT EXISTS (
         SELECT 1 FROM fiaon_termine tz
         WHERE tz.person_id = p.id AND tz.status = 'gebucht'
           AND tz.abgesagt_am IS NULL AND tz.beginn > NOW())`,
    ].join(" AND ");

    // Reihenfolge wie die Fokus-Logik der Pipeline: Zusage/Rückruf fällig
    // zuerst, danach die jüngste Bewegung zuerst.
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

    // Je Gruppe bis zu 6 Kandidaten holen (nicht 2): Wenn eine Gruppe leer
    // ist, rückt die nächste auf, und dafür braucht sie Nachschub.
    const [g1, g2, g3, zaehlerR] = await Promise.all([
      ...GRUPPEN.map((g) => sqlPool.unsafe(
        `SELECT ${KARTE_SQL} FROM fiaon_persons p
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

    // ── 2 je Gruppe; leere Plätze füllt die nächste Gruppe auf ────────────
    const toepfe: { key: string; rows: any[] }[] = [
      { key: "bezahlt_gemeldet", rows: g1 as any[] },
      { key: "rechnung_offen", rows: g2 as any[] },
      { key: "lead", rows: g3 as any[] },
    ];
    const slots: { gruppe: string; kunde: any }[] = [];
    for (const t of toepfe) {
      for (const r of t.rows.splice(0, JE_GRUPPE)) slots.push({ gruppe: t.key, kunde: karte(r) });
    }
    for (const t of toepfe) {
      while (slots.length < SLOTS && t.rows.length > 0) {
        slots.push({ gruppe: t.key, kunde: karte(t.rows.shift()) });
      }
    }

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
    });
  } catch (err) {
    console.error("[OFFICE-VERTRIEB] arbeitsliste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
