// ═══════════════════════════════════════════════════════════════════
// PERSONEN — KUNDENZÄHLUNG UND AGENTEN-KONFLIKTE (nur lesend)
//
// Zwei Fragen, die bisher niemand beantworten konnte:
//
// 1. WIE VIELE KUNDEN HABEN WIR WIRKLICH?
//    Bisher wurden Antrags-ZEILEN gezählt. Wer den Bonitäts-Check kaufte,
//    zählte zweimal; abgebrochene Funnel-Entwürfe zählten mit. Gemessen:
//    264 bezahlte Zeilen, aber nur 254 bezahlte Menschen.
//    Ab jetzt: Personen mit mindestens einer bezahlten Bestellung.
//
// 2. WEM GEHÖRT DIESER KUNDE?
//    Der Backfill hat 26 Personen gefunden, an denen mehrere Agenten hängen.
//    Sie sind seit dem Lauf markiert — aber nirgends einsehbar. Diese Ansicht
//    macht sie sichtbar, MIT allem, was für eine Entscheidung nötig ist:
//    bezahlte Bestellungen und der letzte dokumentierte Kontakt je Agent.
//
// Es wird hier NICHTS entschieden und NICHTS geschrieben. Die Zuordnung eines
// Kunden ist eine Geldfrage (Provision) — die trifft der Vorgesetzte, oder sie
// wird mit dem Stichtag aufgelöst. Ein Automat, der hier rät, verteilt fremdes
// Geld um.
// ═══════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { ensurePersonTables } from "../fiaon-person-model";

const router = Router();

/**
 * Personen, die nur ein Wegweiser sind (zusammengeführt) oder gar keine
 * echten Kunden — sie dürfen in keiner Zählung auftauchen.
 */
const ECHTE_PERSON = `p.merged_into_person_id IS NULL`;

// ── Kundenzählung: die eine Wahrheit ─────────────────────────────────────────
router.get("/admin/personen/kennzahlen", async (_req: Request, res: Response) => {
  try {
    await ensurePersonTables();

    const [person] = await sqlPool`
      SELECT
        COUNT(*)::int AS personen,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.payment_status = 'paid'
        ))::int AS bezahlt,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.payment_status = 'claimed_paid'
        ))::int AS angekuendigt,
        COUNT(*) FILTER (WHERE p.agent_conflict)::int AS konflikte
      FROM fiaon_persons p
      WHERE ${sqlPool.unsafe(ECHTE_PERSON)}
    `;

    // Die alte Zählweise — damit der Unterschied belegbar ist statt behauptet.
    const [zeilen] = await sqlPool`
      SELECT
        COUNT(*)::int AS gesamt,
        COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS bezahlt_zeilen,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')::int AS angekuendigt_zeilen,
        COUNT(*) FILTER (WHERE person_id IS NULL)::int AS ohne_person
      FROM fiaon_applications
      WHERE merged_into IS NULL AND gdpr_deleted_at IS NULL
    `;

    // Funnel-Abbrecher: weder E-Mail noch Telefon. Kein Kunde, kein Entwurf,
    // der irgendwo mitgezählt werden dürfte — 54 % des Zeilenbestands.
    const [entwuerfe] = await sqlPool`
      SELECT COUNT(*)::int AS n
      FROM fiaon_applications
      WHERE gdpr_deleted_at IS NULL
        AND person_id IS NULL
        AND COALESCE(
              NULLIF(TRIM(email), ''), NULLIF(TRIM(contact_email), ''),
              NULLIF(TRIM(billing_email), ''), NULLIF(TRIM(phone), ''),
              NULLIF(TRIM(contact_phone), '')
            ) IS NULL
    `;

    const bezahlt = Number(person.bezahlt);
    const bezahltZeilen = Number(zeilen.bezahlt_zeilen);
    res.json({
      ok: true,
      personen: {
        gesamt: Number(person.personen),
        bezahlt,
        angekuendigt: Number(person.angekuendigt),
        konflikte: Number(person.konflikte),
      },
      zeilen: {
        gesamt: Number(zeilen.gesamt),
        bezahlt: bezahltZeilen,
        angekuendigt: Number(zeilen.angekuendigt_zeilen),
        ohnePerson: Number(zeilen.ohne_person),
      },
      entwuerfe: Number(entwuerfe.n),
      /** Wie viele Kunden bisher zu viel gezählt wurden. */
      differenz: bezahltZeilen - bezahlt,
    });
  } catch (err) {
    console.error("[FIAON-PERSONEN] kennzahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Die Agenten-Konflikte, sichtbar gemacht ──────────────────────────────────
router.get("/admin/personen/konflikte", async (_req: Request, res: Response) => {
  try {
    await ensurePersonTables();

    const personen = await sqlPool`
      SELECT
        p.id, p.person_ref, p.assigned_agent_id, p.quality_flags, p.account_status,
        p.primary_email, p.primary_phone, p.first_seen_at,
        COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                 p.company_name, p.contact_name, p.primary_email, p.person_ref) AS name,
        (SELECT COUNT(*)::int FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlte,
        (SELECT COALESCE(SUM(a.amount_due), 0) FROM fiaon_applications a
          WHERE a.person_id = p.id AND a.payment_status = 'paid') AS bezahlt_summe,
        (SELECT COUNT(*)::int FROM fiaon_applications a WHERE a.person_id = p.id) AS bestellungen,
        (SELECT COUNT(*)::int FROM fiaon_leads l WHERE l.person_id = p.id) AS leads
      FROM fiaon_persons p
      WHERE p.agent_conflict = TRUE AND p.merged_into_person_id IS NULL
      ORDER BY (SELECT COUNT(*) FROM fiaon_applications a
                 WHERE a.person_id = p.id AND a.payment_status = 'paid') DESC,
               p.id ASC
    `;
    if (personen.length === 0) return res.json({ ok: true, data: [], agenten: [] });

    const ids = (personen as any[]).map((p) => Number(p.id));

    // Der letzte dokumentierte Kontakt je Agent und Person. Das ist die einzige
    // belastbare Grundlage für die Frage „wer hat diesen Kunden betreut?" —
    // eine Zuweisung allein sagt nichts darüber, wer wirklich gearbeitet hat.
    const kontakte = await sqlPool`
      SELECT DISTINCT ON (a.person_id, c.agent_id)
             a.person_id, c.agent_id, c.agent_name, c.type, c.outcome, c.note, c.created_at
      FROM fiaon_contact_log c
      JOIN fiaon_applications a ON a.ref = c.ref
      WHERE a.person_id = ANY(${ids}::int[]) AND c.agent_id IS NOT NULL
      ORDER BY a.person_id, c.agent_id, c.created_at DESC
    `.catch(() => []);

    const kontaktJePerson = new Map<number, any[]>();
    for (const k of kontakte as any[]) {
      const arr = kontaktJePerson.get(Number(k.person_id)) ?? [];
      arr.push(k);
      kontaktJePerson.set(Number(k.person_id), arr);
    }

    // Alle beteiligten Agenten benennen — eine Zahl im Bericht hilft niemandem.
    const agentIds = new Set<number>();
    for (const p of personen as any[]) {
      const flags = typeof p.quality_flags === "string" ? JSON.parse(p.quality_flags) : p.quality_flags;
      for (const a of Array.isArray(flags?.agents) ? flags.agents : []) agentIds.add(Number(a));
      if (p.assigned_agent_id != null) agentIds.add(Number(p.assigned_agent_id));
    }
    for (const k of kontakte as any[]) if (k.agent_id != null) agentIds.add(Number(k.agent_id));

    const agentRows = agentIds.size > 0
      ? await sqlPool`
          SELECT id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), name, email) AS name
          FROM fiaon_agents WHERE id = ANY(${Array.from(agentIds)}::int[])
        `.catch(() => [])
      : [];
    const agentName = new Map((agentRows as any[]).map((a) => [Number(a.id), String(a.name)]));

    const data = (personen as any[]).map((p) => {
      const flags = typeof p.quality_flags === "string" ? JSON.parse(p.quality_flags) : p.quality_flags;
      const beteiligt: number[] = Array.from(new Set([
        ...(Array.isArray(flags?.agents) ? flags.agents.map(Number) : []),
        ...(p.assigned_agent_id != null ? [Number(p.assigned_agent_id)] : []),
      ]));
      const kontakteDerPerson = kontaktJePerson.get(Number(p.id)) ?? [];

      return {
        personId: Number(p.id),
        personRef: p.person_ref,
        name: p.name,
        email: p.primary_email,
        telefon: p.primary_phone,
        seit: p.first_seen_at,
        bezahlte: Number(p.bezahlte),
        bezahltSumme: Number(p.bezahlt_summe),
        bestellungen: Number(p.bestellungen),
        leads: Number(p.leads),
        // Zugewiesen bleibt, wer es ist. Diese Ansicht ändert daran nichts.
        zugewiesen: p.assigned_agent_id != null
          ? { id: Number(p.assigned_agent_id), name: agentName.get(Number(p.assigned_agent_id)) ?? `Agent ${p.assigned_agent_id}` }
          : null,
        agenten: beteiligt.map((id) => {
          const k = kontakteDerPerson.find((x) => Number(x.agent_id) === id);
          return {
            id,
            name: agentName.get(id) ?? `Agent ${id}`,
            letzterKontakt: k?.created_at ?? null,
            letzteArt: k?.type ?? null,
            letztesErgebnis: k?.outcome ?? null,
            letzteNotiz: k?.note ? String(k.note).slice(0, 180) : null,
          };
        }).sort((a, b) => {
          // Wer zuletzt nachweislich gearbeitet hat, steht oben.
          const ta = a.letzterKontakt ? new Date(a.letzterKontakt).getTime() : 0;
          const tb = b.letzterKontakt ? new Date(b.letzterKontakt).getTime() : 0;
          return tb - ta;
        }),
      };
    });

    // Wie viele Konflikte hängen an welchem Agenten?
    const jeAgent = new Map<number, { id: number; name: string; konflikte: number; mitZahlung: number }>();
    for (const d of data) {
      for (const a of d.agenten) {
        const e = jeAgent.get(a.id) ?? { id: a.id, name: a.name, konflikte: 0, mitZahlung: 0 };
        e.konflikte++;
        if (d.bezahlte > 0) e.mitZahlung++;
        jeAgent.set(a.id, e);
      }
    }

    res.json({
      ok: true,
      data,
      agenten: Array.from(jeAgent.values()).sort((a, b) => b.konflikte - a.konflikte),
      summe: {
        personen: data.length,
        mitZahlung: data.filter((d) => d.bezahlte > 0).length,
        bezahltSumme: data.reduce((s, d) => s + d.bezahltSumme, 0),
      },
    });
  } catch (err) {
    console.error("[FIAON-PERSONEN] konflikte:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
