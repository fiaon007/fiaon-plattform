// ═══════════════════════════════════════════════════════════════════════════
// INKASSO-BEREICH — Routen
//
// Muster wie beim Vertriebs- und Onboarding-Bereich:
//   Falsche Rolle  → 404. Nicht 403: Wer nicht dazugehört, soll nicht einmal
//                    erfahren, DASS es diesen Bereich gibt.
//   Ohne Zusage    → 403 mit dem Text der Erklärung.
//
// Die Sichtfeld-Grenze steht in fiaon-inkasso.ts als WHERE-Bedingung und wird
// hier nicht wiederholt — eine Grenze, die an zwei Stellen steht, steht bald
// an einer Stelle anders.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import { zusageHash, zusageSpeichern, zusageStand } from "../lib/fiaon-vertrieb-zusage";
import { INKASSO_ZUSAGE_TEXT, INKASSO_ZUSAGE_VERSION } from "../lib/fiaon-inkasso-zusage";
import {
  arbeitsliste, istRatenErgebnis, kennzahlen, RATEN_ERGEBNISSE,
  ratenErgebnisAnwenden, verdienst,
} from "../lib/fiaon-inkasso";
import { berlinToday } from "../lib/fiaon-time";

const router = Router();

async function istInkasso(agentId: number): Promise<boolean> {
  await ensureRolleSpalte();
  const [a] = (await sqlPool`
    SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active
  `) as any[];
  return String(a?.rolle || "agent") === "inkasso";
}

/**
 * Die Wand. Jede Route dieses Bereichs geht hier durch.
 *
 * Reihenfolge ist Absicht: erst Rolle (404), dann Zusage (403). Umgekehrt
 * verriete die Zusage-Abfrage einem Fremden, dass es den Bereich gibt.
 */
async function wand(req: AgentRequest, res: Response): Promise<boolean> {
  if (!(await istInkasso(req.agent!.id))) {
    res.status(404).json({ ok: false, error: "Nicht gefunden." });
    return false;
  }
  const stand = await zusageStand(req.agent!.id, "inkasso", INKASSO_ZUSAGE_VERSION);
  if (stand.offen) {
    res.status(403).json({ ok: false, error: "Zusage offen", zusageOffen: true });
    return false;
  }
  return true;
}

// ── Zugang ─────────────────────────────────────────────────────────────────

/**
 * Ein Pfad für GET und POST.
 *
 * Die wiederverwendete `ZusageTafel` im Client (agent/vertrieb-zusage.tsx)
 * fragt denselben Pfad ab, den sie danach beschreibt. Zwei Pfade hätten
 * bedeutet, die Tafel für diesen einen Bereich zu kopieren — und damit zwei
 * Fassungen einer Rechtsstrecke zu pflegen.
 */
router.get("/inkasso/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await istInkasso(req.agent!.id))) {
      return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    }
    const stand = await zusageStand(req.agent!.id, "inkasso", INKASSO_ZUSAGE_VERSION);
    res.json({
      ok: true, ...stand,
      text: stand.offen ? INKASSO_ZUSAGE_TEXT : null,
      pruefwert: zusageHash(INKASSO_ZUSAGE_TEXT).slice(0, 16),
      name: req.agent!.name,
    });
  } catch (err) {
    console.error("[INKASSO] zugang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/zusage — annehmen. */
router.post("/inkasso/zusage", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await istInkasso(req.agent!.id))) {
      return res.status(404).json({ ok: false, error: "Nicht gefunden." });
    }
    const erg = await zusageSpeichern({
      agentId: req.agent!.id,
      agentName: req.agent!.name,
      nameGetippt: String(req.body?.nameGetippt || ""),
      version: String(req.body?.version || ""),
      // Das Häkchen „gelesen" gehört zur Erklärung, nicht zur Rolle.
      gelesen: req.body?.gelesen === true,
      sollVersion: INKASSO_ZUSAGE_VERSION,
      bereich: "inkasso",
      text: INKASSO_ZUSAGE_TEXT,
      ip: String(req.ip || ""),
      userAgent: String(req.headers["user-agent"] || ""),
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.grund });
    res.json(erg);
  } catch (err) {
    console.error("[INKASSO] zusage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Arbeit ─────────────────────────────────────────────────────────────────

/** GET /inkasso/liste — Kennzahlen und die eine Reihenfolge. */
router.get("/inkasso/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const [liste, zahlen, geld] = await Promise.all([
      arbeitsliste({ limit: Number(req.query.limit) || 60 }),
      kennzahlen(),
      verdienst(req.agent!.id),
    ]);
    res.json({ ok: true, liste, zahlen, verdienst: geld, ergebnisse: RATEN_ERGEBNISSE, heute: berlinToday() });
  } catch (err) {
    console.error("[INKASSO] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /inkasso/rate/:id — Mahnhistorie und Kontakte einer Rate. */
router.get("/inkasso/rate/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const id = Number(req.params.id);
    // Über das SICHTFELD geprüft, nicht über die Kennung: Wer eine fremde
    // Ratennummer errät, bekommt trotzdem nichts.
    const [rate] = (await sqlPool`
      SELECT r.id, r.ref, r.rate_nr, r.betrag_cents, r.zahlungsreferenz, r.faellig_am,
             r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at, r.letzter_fehler,
             r.inkasso_wiedervorlage, r.inkasso_zusage_am, a.person_id
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.id = ${id} AND r.status = 'offen'
        AND a.payment_status = 'paid' AND a.merged_into IS NULL
        AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
    `) as any[];
    if (!rate) return res.status(404).json({ ok: false, error: "Nicht gefunden." });

    res.json({
      ok: true, rate,
      // Nur MAHNUNGEN, nicht der ganze Mailverkehr des Kunden.
      mahnungen: await sqlPool`
        SELECT gesendet_am, event, ok, grund FROM fiaon_mail_log
        WHERE person_id = ${rate.person_id} AND event LIKE 'abo_payment%'
        ORDER BY gesendet_am DESC LIMIT 20
      `.catch(() => []),
      kontakte: await sqlPool`
        SELECT created_at, type, outcome, note, agent_name FROM fiaon_contact_log
        WHERE ref = ${rate.ref} AND type <> 'system'
        ORDER BY created_at DESC LIMIT 15
      `,
      arbeit: await sqlPool`
        SELECT created_at, ergebnis, zusage_am, wiedervorlage, notiz, agent_name
        FROM fiaon_raten_arbeit WHERE rate_id = ${id} ORDER BY created_at DESC LIMIT 20
      `,
      raten: await sqlPool`
        SELECT rate_nr, betrag_cents, faellig_am, status, bezahlt_am, mahnstufe
        FROM fiaon_abo_raten WHERE ref = ${rate.ref} ORDER BY rate_nr
      `,
    });
  } catch (err) {
    console.error("[INKASSO] rate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/rate/:id/ergebnis */
router.post("/inkasso/rate/:id/ergebnis", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const ergebnis = String(req.body?.ergebnis || "");
    if (!istRatenErgebnis(ergebnis)) {
      return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis." });
    }
    const erg = await ratenErgebnisAnwenden({
      rateId: Number(req.params.id), ergebnis,
      agentId: req.agent!.id, agentName: req.agent!.name,
      zusageDatum: req.body?.zusageDatum ?? null,
      notiz: req.body?.notiz ?? null,
    });
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    const { ok: _weg, ...rest } = erg;
    res.json({ ok: true, ...rest, zahlen: await kennzahlen() });
  } catch (err) {
    console.error("[INKASSO] ergebnis:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stunden ────────────────────────────────────────────────────────────────

/** GET /inkasso/stunden */
router.get("/inkasso/stunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    res.json({
      ok: true,
      stunden: await sqlPool`
        SELECT id, tag, von, bis, minuten, notiz, bestaetigt_am, bestaetigt_von
        FROM fiaon_stunden
        WHERE agent_id = ${req.agent!.id} AND entfernt_am IS NULL
        ORDER BY tag DESC, von DESC LIMIT 120
      `,
      verdienst: await verdienst(req.agent!.id),
    });
  } catch (err) {
    console.error("[INKASSO] stunden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /inkasso/stunden — erfassen. */
router.post("/inkasso/stunden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const tag = String(req.body?.tag || "").slice(0, 10);
    const von = String(req.body?.von || "");
    const bis = String(req.body?.bis || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag)) return res.status(400).json({ ok: false, error: "Bitte ein Datum wählen." });
    if (!/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis)) {
      return res.status(400).json({ ok: false, error: "Bitte Uhrzeiten im Format 09:30 angeben." });
    }
    const min = (Number(bis.slice(0, 2)) * 60 + Number(bis.slice(3))) - (Number(von.slice(0, 2)) * 60 + Number(von.slice(3)));
    if (min <= 0) return res.status(400).json({ ok: false, error: "„Bis“ muss nach „von“ liegen." });
    if (min > 16 * 60) return res.status(400).json({ ok: false, error: "Mehr als 16 Stunden an einem Tag nehme ich dir nicht ab." });
    if (tag > berlinToday()) return res.status(400).json({ ok: false, error: "Zeiten in der Zukunft lassen sich nicht erfassen." });

    await sqlPool`
      INSERT INTO fiaon_stunden (agent_id, tag, von, bis, minuten, notiz)
      VALUES (${req.agent!.id}, ${tag}::date, ${von}::time, ${bis}::time, ${min},
              ${String(req.body?.notiz || "").trim() || null})
    `;
    res.json({ ok: true, meldung: `${Math.floor(min / 60)} Std ${min % 60} Min erfasst.`, verdienst: await verdienst(req.agent!.id) });
  } catch (err) {
    console.error("[INKASSO] stunden anlegen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /inkasso/stunden/:id/entfernen
 *
 * Nur UNBESTÄTIGTE Zeilen, und weich. Eine bestätigte Zeile zu entfernen hieße,
 * eine Abrechnung nachträglich zu ändern.
 */
router.post("/inkasso/stunden/:id/entfernen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    if (!(await wand(req, res))) return;
    const r = (await sqlPool`
      UPDATE fiaon_stunden SET entfernt_am = NOW()
      WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id}
        AND bestaetigt_am IS NULL AND entfernt_am IS NULL
      RETURNING id
    `) as any[];
    if (r.length === 0) {
      return res.status(400).json({
        ok: false,
        error: "Diese Zeile ist bereits bestätigt und lässt sich nicht mehr ändern — "
          + "sonst wäre die Abrechnung nachträglich verschiebbar.",
      });
    }
    res.json({ ok: true, verdienst: await verdienst(req.agent!.id) });
  } catch (err) {
    console.error("[INKASSO] stunden entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BETREIBERSICHT
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/inkasso/kennzahlen — auch für Leitung und Vorgesetzter. */
router.get("/admin/inkasso/kennzahlen", async (_req, res: Response) => {
  try {
    res.json({ ok: true, zahlen: await kennzahlen() });
  } catch (err) {
    console.error("[INKASSO] admin kennzahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/inkasso/stunden/:agentId */
router.get("/admin/inkasso/stunden/:agentId", async (req, res: Response) => {
  try {
    const id = Number(req.params.agentId);
    res.json({
      ok: true,
      stunden: await sqlPool`
        SELECT id, tag, von, bis, minuten, notiz, bestaetigt_am, bestaetigt_von
        FROM fiaon_stunden WHERE agent_id = ${id} AND entfernt_am IS NULL
        ORDER BY tag DESC LIMIT 200
      `,
      verdienst: await verdienst(id),
    });
  } catch (err) {
    console.error("[INKASSO] admin stunden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/inkasso/stunden/:agentId/bestaetigen — ein Monat, ein Klick.
 *
 * Bestätigen heißt: unveränderlich machen UND als Auszahlungsposition anlegen.
 * Beides in einer Transaktion — eine bestätigte Stunde ohne Position wäre
 * Arbeit, die niemand bezahlt.
 */
router.post("/admin/inkasso/stunden/:agentId/bestaetigen", async (req, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const monat = String(req.body?.monat || berlinToday().slice(0, 7));
    if (!/^\d{4}-\d{2}$/.test(monat)) return res.status(400).json({ ok: false, error: "Monat im Format 2026-08 angeben." });

    const erg = await sqlPool.begin(async (tx) => {
      const [a] = (await tx`
        SELECT id, name, stundensatz_cents, verguetung_bestaetigt_am FROM fiaon_agents WHERE id = ${agentId}
      `) as any[];
      if (!a) return { ok: false, fehler: "Mitarbeiter nicht gefunden." };
      if (!a.verguetung_bestaetigt_am) {
        return {
          ok: false,
          fehler: "Bestätige zuerst Stundensatz und Prämie dieses Mitarbeiters — "
            + "ohne freigegebenen Satz gibt es keinen Betrag zum Auszahlen.",
        };
      }
      const satz = Number(a.stundensatz_cents ?? 0);
      if (satz <= 0) return { ok: false, fehler: "Der Stundensatz ist null." };

      const zeilen = (await tx`
        SELECT id, minuten FROM fiaon_stunden
        WHERE agent_id = ${agentId} AND entfernt_am IS NULL AND bestaetigt_am IS NULL
          AND to_char(tag, 'YYYY-MM') = ${monat}
      `) as any[];
      if (zeilen.length === 0) return { ok: false, fehler: `Für ${monat} sind keine offenen Zeiten erfasst.` };

      const minuten = zeilen.reduce((s, z) => s + Number(z.minuten), 0);
      const cents = Math.round((minuten / 60) * satz);

      // Auszahlungsposition über den BESTEHENDEN Weg: eine Provisionszeile mit
      // `kind = 'stunden'`. Der Auszahlungslauf liest ohnehin alles aus
      // fiaon_commissions — eine zweite Quelle wäre eine zweite Wahrheit.
      const [c] = (await tx`
        INSERT INTO fiaon_commissions
          (agent_id, ref, pack_name, base_amount_cents, rate_bp, amount_cents, status, kind, note)
        VALUES (${agentId}, ${`STUNDEN-${monat}-${agentId}`}, 'Arbeitszeit',
                ${cents}, 0, ${cents}, 'bestaetigt', 'stunden',
                ${`${Math.floor(minuten / 60)} Std ${minuten % 60} Min im ${monat} `
                  + `zu ${(satz / 100).toFixed(2).replace(".", ",")} € — bestätigt vom Vorgesetzter.`})
        ON CONFLICT DO NOTHING
        RETURNING id
      `) as any[];

      await tx`
        UPDATE fiaon_stunden
        SET bestaetigt_am = NOW(), bestaetigt_von = 'Vorgesetzter', commission_id = ${c?.id ?? null}
        WHERE id = ANY(${zeilen.map((z) => Number(z.id))})
      `;
      return {
        ok: true, minuten, cents, zeilen: zeilen.length,
        meldung: `${Math.floor(minuten / 60)} Std ${minuten % 60} Min bestätigt — `
          + `${(cents / 100).toFixed(2).replace(".", ",")} € stehen zur Auszahlung.`,
      };
    });

    if (!erg.ok) return res.status(400).json({ ok: false, error: (erg as any).fehler });
    res.json(erg);
  } catch (err) {
    console.error("[INKASSO] bestaetigen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/inkasso/verguetung/:agentId — Satz und Prämie festlegen. */
router.post("/admin/inkasso/verguetung/:agentId", async (req, res: Response) => {
  try {
    const agentId = Number(req.params.agentId);
    const satz = Math.round(Number(req.body?.stundensatzEuro ?? 0) * 100);
    const art = String(req.body?.praemieArt || "euro");
    const wert = art === "prozent"
      ? Math.round(Number(req.body?.praemieWert ?? 0) * 100)   // Prozent → Basispunkte
      : Math.round(Number(req.body?.praemieWert ?? 0) * 100);  // Euro → Cent
    if (!["euro", "prozent"].includes(art)) return res.status(400).json({ ok: false, error: "Prämienart unbekannt." });
    if (satz < 0 || wert < 0) return res.status(400).json({ ok: false, error: "Negative Werte gibt es nicht." });

    await sqlPool`
      UPDATE fiaon_agents SET
        stundensatz_cents = ${satz || null},
        inkasso_praemie_art = ${art},
        inkasso_praemie_wert = ${wert || null},
        -- Der Zeitstempel IST die Bestätigung. Erst wenn er steht, wird eine
        -- Prämie gebucht und lassen sich Stunden abrechnen.
        verguetung_bestaetigt_am = NOW()
      WHERE id = ${agentId}
    `;
    await sqlPool`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (${agentId}, 'verguetung_gesetzt',
              ${JSON.stringify({ stundensatzCents: satz, praemieArt: art, praemieWert: wert })},
              'Vorgesetzter', 'Vergütung bestätigt')
    `.catch(() => {});
    res.json({ ok: true, meldung: "Vergütung bestätigt. Ab jetzt werden Prämien gebucht und Stunden abrechenbar." });
  } catch (err) {
    console.error("[INKASSO] verguetung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
