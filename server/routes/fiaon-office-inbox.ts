// ═══════════════════════════════════════════════════════════════════════════
// FIAON OFFICE — Inbox: Postfach-Liste des Mitarbeiters (23.08.2026)
//
// Plan: 01_Plattform/MITARBEITER_OFFICE_PLAN_2026-08-23.md §4 (Raum Inbox), §11.
// Die Lücke: Das Versandprotokoll (fiaon_mail_log) kennt `ausgeloest_agent_id`,
// aber es gab keine Route, mit der ein Mitarbeiter SEINE gesendeten Mails
// sieht – nur die Historie je Kunde (/agent/mail/:personId) und das
// Admin-Protokoll. Der Inbox-Raum braucht die Liste als linke Spalte.
//
//   GET /agent/inbox/gesendet?tage=30&seite=0&suche=
//       → { ok, zeilen[], seite, proSeite, tage, zustellText }
//       zeilen: id, event, titel, betreff, status, grund, zustellung,
//               zustellung_am, empfaenger, person_id, name, created_at
//
// Nur lesen, nur die eigenen Zeilen (WHERE ausgeloest_agent_id = ich). Keine
// neue Tabelle, keine Änderung an bestehenden.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { VERSAND_TEXT, type VersandArt } from "../lib/fiaon-versand";
import { ZUSTELL_TEXT } from "../lib/fiaon-zustellung";

const router = Router();

/** Ereignisnamen in Worten – für Events außerhalb der Versand-Registry (Mail-Zentrale, Erinnerungen). */
const EXTRA_TITEL: Record<string, string> = {
  zentrale_freitext: "Freitext (Mail-Zentrale)",
  abo_payment_reminder: "Zahlungserinnerung (Rate)",
  payment_reminder: "Zahlungserinnerung (Erstzahlung)",
  payment_confirmed: "Zahlung bestätigt",
  followup_48h: "Nachfassen nach 48 Std",
};
const titelVon = (event: string): string => (VERSAND_TEXT as Record<string, { titel: string }>)[event as VersandArt]?.titel ?? EXTRA_TITEL[event] ?? event;

router.get("/agent/inbox/gesendet", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const proSeite = 50;
    const seite = Math.max(0, Number(req.query.seite) || 0);
    const tage = Math.min(180, Math.max(1, Number(req.query.tage) || 30));
    const suche = String(req.query.suche || "").trim().slice(0, 120) || null;
    const zeilen = (await sqlPool`
      SELECT l.id, l.event, l.person_id, l.empfaenger, l.status, l.grund, l.betreff,
             l.zustellung, l.zustellung_am, l.created_at,
             NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), '') AS name
      FROM fiaon_mail_log l
      LEFT JOIN fiaon_persons p ON p.id = l.person_id
      WHERE l.ausgeloest_agent_id = ${req.agent!.id}
        AND l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
        AND (${suche}::text IS NULL
             OR l.empfaenger ILIKE '%' || ${suche} || '%'
             OR COALESCE(l.betreff, '') ILIKE '%' || ${suche} || '%'
             OR COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '') ILIKE '%' || ${suche} || '%')
      ORDER BY l.id DESC
      LIMIT ${proSeite} OFFSET ${seite * proSeite}
    `) as any[];
    res.json({
      ok: true, seite, proSeite, tage, zustellText: ZUSTELL_TEXT,
      zeilen: zeilen.map((z) => ({
        id: Number(z.id), event: String(z.event), titel: titelVon(String(z.event)),
        betreff: z.betreff ?? null, status: z.status, grund: z.grund ?? null,
        zustellung: z.zustellung ?? null, zustellung_am: z.zustellung_am ?? null,
        empfaenger: z.empfaenger ?? null, person_id: z.person_id != null ? Number(z.person_id) : null,
        name: z.name ?? null, created_at: z.created_at,
      })),
    });
  } catch (err) {
    console.error("[OFFICE-INBOX] gesendet:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
