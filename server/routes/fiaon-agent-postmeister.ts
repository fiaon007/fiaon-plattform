import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";

// ═══════════════════════════════════════════════════════════════════════════
// E-MAILS AUS DEM POSTFACH FÜR MITARBEITER (05.09.2026, Florentine Punkte 5 und 8)
//
// „Bei den Tasks sehen wir nicht, wann eine E-Mail geschrieben wurde und von
// wem … die vollständige E-Mail sollte geöffnet werden können." Und: „Ich
// bekomme eine Aufgabe, einen Überweisungsbeleg zu prüfen, aber ich sehe den
// Beleg nicht."
//
// Eine Aufgabe aus dem Postfach trägt die Marke [Mail #id]. Wer den Kunden
// sehen darf (dieselbe Regel wie für die Akte), darf die Mail und ihre
// Anhänge sehen — Betreff, Absender, Zeit, Text, Maras Antwort, Dateien.
// ═══════════════════════════════════════════════════════════════════════════

const router = Router();

async function zeileFuer(req: AgentRequest, id: number): Promise<{ ok: true; r: any } | { ok: false; status: number; error: string }> {
  const [r] = (await sqlPool`
    SELECT id, postfach, gmail_id, von, betreff, empfangen_am, text, antwort, gesendet_am, aktion, person_id, ref, anhaenge_eingang
    FROM fiaon_postmeister WHERE id = ${id} LIMIT 1
  `) as any[];
  if (!r) return { ok: false, status: 404, error: "Diese E-Mail gibt es nicht (mehr)." };
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = await rolleVon(req.agent!.id);
  const leitung = ["vertriebsleiter", "admin"].includes(rolle);
  if (!leitung) {
    if (!r.person_id) return { ok: false, status: 403, error: "Diese E-Mail ist keinem Kunden zugeordnet — nur die Leitung sieht sie." };
    if (!(await darfAnKunde(req.agent!.id, rolle, Number(r.person_id)))) {
      return { ok: false, status: 403, error: "Dieser Kunde liegt nicht bei dir." };
    }
  }
  return { ok: true, r };
}

function anhaengeVon(r: any): { idx: number; name: string; typ: string; groesse: number }[] {
  try {
    const roh = typeof r.anhaenge_eingang === "string" ? JSON.parse(r.anhaenge_eingang) : r.anhaenge_eingang;
    return (Array.isArray(roh) ? roh : []).map((a: any, idx: number) => ({
      idx, name: String(a?.name || `Anhang ${idx + 1}`), typ: String(a?.typ || ""), groesse: Number(a?.groesse || 0),
    }));
  } catch { return []; }
}

/** GET /agent/postmeister/:id — die Mail samt Antwort und Anhangliste. */
router.get("/agent/postmeister/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zeileFuer(req, Number(req.params.id));
    if (!z.ok) return res.status(z.status).json({ ok: false, error: z.error });
    const r = z.r;
    res.json({
      ok: true,
      mail: {
        id: Number(r.id), postfach: r.postfach, von: r.von, betreff: r.betreff,
        empfangenAm: r.empfangen_am, text: String(r.text || ""),
        antwort: r.antwort ? String(r.antwort) : null, gesendetAm: r.gesendet_am ?? null, aktion: r.aktion,
        personId: r.person_id ?? null, ref: r.ref ?? null,
        anhaenge: anhaengeVon(r),
      },
    });
  } catch (err) {
    console.error("[AGENT-POSTMEISTER] mail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /agent/postmeister/:id/anhang/:idx — eine Datei aus der Mail (z. B. der Überweisungsbeleg). */
router.get("/agent/postmeister/:id/anhang/:idx", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zeileFuer(req, Number(req.params.id));
    if (!z.ok) return res.status(z.status).json({ ok: false, error: z.error });
    const r = z.r;
    const roh = typeof r.anhaenge_eingang === "string" ? JSON.parse(r.anhaenge_eingang) : r.anhaenge_eingang;
    const a = (Array.isArray(roh) ? roh : [])[Number(req.params.idx)];
    if (!a?.attachmentId) return res.status(404).json({ ok: false, error: "Anhang nicht gefunden" });
    const { anhangLesen } = await import("../lib/fiaon-gmail");
    const inhalt = await anhangLesen(r.postfach, r.gmail_id, a.attachmentId);
    const name = String(a.name || "anhang").replace(/["\r\n]/g, "");
    res.setHeader("Content-Type", String(a.typ || "application/octet-stream"));
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(name)}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(inhalt);
  } catch (err) {
    console.error("[AGENT-POSTMEISTER] anhang:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /agent/schriftverkehr/:personId — der ganze Mailverkehr eines Kunden (18.09.2026).
 *
 * Team-Feedback, Priorität 6: „Alle relevanten E-Mail-Verläufe müssen für die
 * zuständigen Mitarbeiter einsehbar sein." Die Akte kannte nur ausgehende
 * Protokollzeilen und Einzeiler im Verlauf; was der Kunde schrieb und was Mara
 * antwortete, stand in einer Zentrale, die nur der Inhaber öffnet. Jetzt eine
 * Zeitleiste: Ausgang (fiaon_mail_log, automatisch und von Hand) und Eingang
 * (fiaon_postmeister, jede Kundenmail mit Antwort oder Entwurf). Zugang wie
 * überall: eigener Kunde oder Leitung.
 */
router.get("/agent/schriftverkehr/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde liegt nicht bei dir." });
    }
    const adr = (await sqlPool`
      SELECT DISTINCT LOWER(TRIM(x)) AS a FROM (
        SELECT primary_email AS x FROM fiaon_persons WHERE id = ${personId}
        UNION ALL SELECT email FROM fiaon_applications WHERE person_id = ${personId}
        UNION ALL SELECT contact_email FROM fiaon_applications WHERE person_id = ${personId}
        UNION ALL SELECT billing_email FROM fiaon_applications WHERE person_id = ${personId}
      ) q WHERE x IS NOT NULL AND x LIKE '%@%'
    `) as any[];
    const adressen: string[] = adr.map((r) => String(r.a)).filter(Boolean);
    const ausgang = (await sqlPool`
      SELECT id, event, betreff, status, grund, created_at, ausgeloest_von, zustellung
        FROM fiaon_mail_log
       WHERE (person_id = ${personId} OR LOWER(TRIM(COALESCE(empfaenger, ''))) = ANY(${adressen}))
         AND COALESCE(art, 'echt') <> 'test'
       ORDER BY created_at DESC LIMIT 80
    `.catch(() => [] as any[])) as any[];
    const eingang = (await sqlPool`
      SELECT id, postfach, betreff, empfangen_am, created_at, aktion, zusammenfassung, gesendet_am,
             (antwort IS NOT NULL) AS hat_antwort, kategorie, dringend
        FROM fiaon_postmeister p
       WHERE p.person_id = ${personId}
          OR EXISTS (SELECT 1 FROM unnest(${adressen}::text[]) a WHERE LOWER(p.von) LIKE '%' || a || '%')
       ORDER BY COALESCE(p.empfangen_am, p.created_at) DESC LIMIT 60
    `.catch(() => [] as any[])) as any[];
    const OFFEN = new Set(["entwurf", "fehler", "versand_wartet", "versand_fehlgeschlagen"]);
    const zeilen = [
      ...eingang.map((r) => ({
        art: "ein" as const, id: Number(r.id), am: r.empfangen_am ?? r.created_at,
        betreff: String(r.betreff || "(ohne Betreff)"), text: String(r.zusammenfassung || ""),
        status: r.gesendet_am ? "beantwortet" : OFFEN.has(String(r.aktion)) && r.hat_antwort ? "entwurf" : String(r.aktion || ""),
        offen: !r.gesendet_am && OFFEN.has(String(r.aktion)), dringend: !!r.dringend, postfach: r.postfach,
      })),
      ...ausgang.map((r) => ({
        art: "aus" as const, id: Number(r.id), am: r.created_at,
        betreff: String(r.betreff || r.event || "E-Mail"), text: r.status === "versandt" ? "" : String(r.grund || ""),
        status: String(r.zustellung || r.status || ""), offen: false, dringend: false,
        von: r.ausgeloest_von ? String(r.ausgeloest_von) : "automatisch",
      })),
    ].sort((a, b) => new Date(b.am).getTime() - new Date(a.am).getTime());
    res.json({ ok: true, zeilen, offen: zeilen.filter((z) => z.offen).length });
  } catch (err) {
    console.error("[AGENT-POSTMEISTER] schriftverkehr:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /agent/postmeister/:id/senden — Maras Entwurf (ggf. geändert) an den Kunden (18.09.2026).
 *
 * Team-Feedback, Priorität 6: Entwürfe warteten in einer Zentrale, die nur der
 * Inhaber öffnen kann (Median 17,5 Stunden). Jetzt sendet der Betreuer selbst —
 * derselbe Weg wie in der Zentrale (entwurfSenden: frische Prüfung, Versand aus
 * dem Postfach, Vermerk in der Akte).
 */
router.post("/agent/postmeister/:id/senden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zeileFuer(req, Number(req.params.id));
    if (!z.ok) return res.status(z.status).json({ ok: false, error: z.error });
    if (z.r.gesendet_am) return res.status(409).json({ ok: false, error: "Diese Antwort ist schon gesendet." });
    const text = typeof req.body?.text === "string" && req.body.text.trim().length >= 10 ? String(req.body.text) : null;
    const { entwurfSenden } = await import("./fiaon-postmeister-zentrale");
    const erg = await entwurfSenden(Number(req.params.id), text);
    if (erg.ok && z.r.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${z.r.ref}, ${z.r.person_id ?? null}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Antwort auf „${String(z.r.betreff || "").slice(0, 90)}" von ${req.agent!.name} freigegeben und gesendet${text ? " (geändert)" : ""}.`})
      `.catch(() => {});
    }
    res.status(erg.ok ? 200 : 409).json({ ok: erg.ok, error: erg.ok ? undefined : erg.grund, meldung: erg.ok ? "Gesendet." : undefined });
  } catch (err) {
    console.error("[AGENT-POSTMEISTER] senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/postmeister/:id/erledigt — selbst beantwortet oder angerufen; Maras Entwurf wird verworfen. */
router.post("/agent/postmeister/:id/erledigt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const z = await zeileFuer(req, Number(req.params.id));
    if (!z.ok) return res.status(z.status).json({ ok: false, error: z.error });
    const wie = String(req.body?.wie || "selbst beantwortet").slice(0, 200);
    const [r] = (await sqlPool`
      UPDATE fiaon_postmeister
         SET aktion = 'geordnet', begruendung = ${`Vom Betreuer übernommen (${req.agent!.name}): ${wie}`}, updated_at = NOW()
       WHERE id = ${Number(req.params.id)} AND aktion IN ('entwurf', 'fehler', 'versand_wartet', 'versand_fehlgeschlagen')
       RETURNING postfach, antwort_draft_id
    `) as any[];
    if (r?.antwort_draft_id) {
      const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
      await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
    }
    if (z.r.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${z.r.ref}, ${z.r.person_id ?? null}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`E-Mail „${String(z.r.betreff || "").slice(0, 90)}" von ${req.agent!.name} übernommen: ${wie}.`})
      `.catch(() => {});
    }
    res.json({ ok: true, meldung: r ? "Übernommen — Maras Entwurf ist verworfen." : "Vermerkt." });
  } catch (err) {
    console.error("[AGENT-POSTMEISTER] erledigt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
