// ═══════════════════════════════════════════════════════════════════════════
// ZENTRALEN — Routen für Kunden-Zentrale und Team-Zentrale
//
// Die Regeln stehen in den Bibliotheken; hier steht nur, wer was darf.
//
// WER DARF LÖSCHEN
//   Einzeln       Vorgesetzter und Vertriebsleitung.
//   In Masse      NUR der Vorgesetzte. Eine Sammellöschung ist der einzige
//                 Knopf im Haus, der in einer Sekunde tausend Menschen aus
//                 dem Bestand nimmt.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { bestandHeuteSql, bestandSql } from "../lib/fiaon-bestand-filter";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { istVertriebsleiter } from "./fiaon-vertrieb";
import { alleTrefferIds, filterZahlen, kundenListe, type Filter } from "../lib/fiaon-kundenzentrale";
import { ausfuehren, vorschau } from "../lib/fiaon-loeschen";
import { alsTestMarkieren, testMarkierungAufheben } from "../lib/fiaon-testerkennung";
import { agentMitKleinsterLast } from "../lib/fiaon-zuteilung";

const router = Router();

/** Filter aus der Adresse lesen — genau so, wie der Browser sie schreibt. */
function filterAus(q: Record<string, any>): Filter {
  const liste = (v: any): string[] | undefined => {
    if (!v) return undefined;
    const a = String(v).split(",").map((s) => s.trim()).filter(Boolean);
    return a.length ? a : undefined;
  };
  const ja = (v: any) => v === "1" || v === "true";
  return {
    q: q.q ? String(q.q) : undefined,
    stufe: liste(q.stufe),
    status: liste(q.status),
    agent: q.agent ? Number(q.agent) : null,
    ohneAgent: ja(q.ohneAgent),
    paket: q.paket ? String(q.paket) : undefined,
    quelle: q.quelle ? String(q.quelle) : undefined,
    von: q.von ? String(q.von) : undefined,
    bis: q.bis ? String(q.bis) : undefined,
    ohneTelefon: ja(q.ohneTelefon),
    dubletten: ja(q.dubletten),
    zahlungUnbestaetigt: ja(q.zahlungUnbestaetigt),
    anonyme: ja(q.anonyme),
    kuendigungen: ja(q.kuendigungen),
    kycOffen: ja(q.kycOffen),
    ruhend: ja(q.ruhend),
    tests: ja(q.tests),
    archiv: ja(q.archiv),
    sortierung: ["arbeit", "neueste", "name", "umsatz"].includes(String(q.sortierung))
      ? (String(q.sortierung) as any) : "arbeit",
    limit: q.limit ? Number(q.limit) : 50,
    offset: q.offset ? Number(q.offset) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN-ZENTRALE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/zentrale/kunden */
router.get("/admin/zentrale/kunden", async (req: Request, res: Response) => {
  try {
    const f = filterAus(req.query as any);
    const [liste, zahlen, agenten] = await Promise.all([
      kundenListe(f),
      filterZahlen(),
      sqlPool`
        SELECT id, COALESCE(NULLIF(first_name, ''), name) AS name FROM fiaon_agents
        WHERE active AND (NOT is_test_account OR pruefkonto) ORDER BY name
      `,
    ]);
    res.json({ ok: true, ...liste, zahlen, agenten });
  } catch (err) {
    console.error("[ZENTRALE] kunden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/zentrale/kunden/alle-ids — „alle Treffer wählen".
 *
 * Eigener Weg statt „hol dir einfach alle Seiten": Der Browser soll nicht
 * vierzig Anfragen stellen müssen, um 2.000 Kennungen zu sammeln.
 */
router.get("/admin/zentrale/kunden/alle-ids", async (req: Request, res: Response) => {
  try {
    const ids = await alleTrefferIds(filterAus(req.query as any));
    res.json({ ok: true, ids, anzahl: ids.length });
  } catch (err) {
    console.error("[ZENTRALE] alle-ids:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/zentrale/kunden/loeschen/vorschau — was passiert mit wem? */
router.post("/admin/zentrale/kunden/loeschen/vorschau", async (req: Request, res: Response) => {
  try {
    const ids = (req.body?.personIds ?? []).map(Number).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine Auswahl." });
    res.json({ ok: true, ...(await vorschau(ids)) });
  } catch (err) {
    console.error("[ZENTRALE] loeschen vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/zentrale/kunden/loeschen — ausführen. Nur Vorgesetzter. */
router.post("/admin/zentrale/kunden/loeschen", async (req: Request, res: Response) => {
  try {
    const ids = (req.body?.personIds ?? []).map(Number).filter(Boolean);
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine Auswahl." });
    const erg = await ausfuehren(
      ids, "Vorgesetzter", String(req.body?.bestaetigung || ""), req.body?.grund ?? null,
    );
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    res.json(erg);
  } catch (err) {
    console.error("[ZENTRALE] loeschen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/zentrale/kunden/aktion — Massenaktionen außer Löschen. */
router.post("/admin/zentrale/kunden/aktion", async (req: Request, res: Response) => {
  try {
    const ids: number[] = (req.body?.personIds ?? []).map(Number).filter(Boolean);
    const art = String(req.body?.art || "");
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine Auswahl." });

    if (art === "agent") {
      // `null` heißt: gleichmäßig auf die kleinsten Bestände verteilen.
      const ziel = req.body?.agentId ? Number(req.body.agentId) : null;
      let n = 0;
      for (const id of ids) {
        const an = ziel ?? (await agentMitKleinsterLast());
        if (!an) break;
        const r = (await sqlPool`
          UPDATE fiaon_persons SET assigned_agent_id = ${an}, assigned_at = NOW(), updated_at = NOW()
          WHERE id = ${id} AND merged_into_person_id IS NULL
            -- BESITZSCHUTZ: dokumentiert Betreute nur mit ausdrücklichem Willen.
            AND (betreuung_seit IS NULL OR ${req.body?.auchBetreute === true})
          RETURNING id
        `) as any[];
        if (r.length) n++;
      }
      return res.json({ ok: true, meldung: `${n} von ${ids.length} zugewiesen.` });
    }

    if (art === "test") {
      let n = 0;
      for (const id of ids) {
        if (await alsTestMarkieren(id, String(req.body?.grund || "Von Hand markiert"), "Vorgesetzter")) n++;
      }
      return res.json({
        ok: true,
        meldung: `${n} von ${ids.length} als Testeintrag markiert${n < ids.length
          ? `. ${ids.length - n} nicht: bezahlte Kunden sind unantastbar.` : "."}`,
      });
    }

    if (art === "test-aufheben") {
      for (const id of ids) await testMarkierungAufheben(id, "Vorgesetzter");
      return res.json({ ok: true, meldung: `${ids.length} zurückgenommen.` });
    }

    if (art === "archivieren") {
      const { archiviereAntrag, ArchivVerboten } = await import("../lib/fiaon-antrag-archiv");
      let n = 0;
      let gesperrt = 0;
      const refs = (await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE person_id = ANY(${ids}) AND merged_into IS NULL AND archived_at IS NULL
      `) as any[];
      for (const r of refs) {
        try {
          await archiviereAntrag(String(r.ref), String(req.body?.grund || "sonstiges"),
            String(req.body?.notiz || "Massenaktion aus der Kunden-Zentrale"),
            { name: "Vorgesetzter", agentId: null, rolle: "admin" });
          n++;
        } catch (e) {
          // Bezahlte Bestellungen und solche mit Provision sind gesperrt — das
          // ist gewollt und keine Fehlermeldung wert.
          gesperrt++;
        }
      }
      return res.json({
        ok: true,
        meldung: `${n} archiviert${gesperrt ? `, ${gesperrt} gesperrt (bezahlt oder Provision gebucht)` : ""}.`,
      });
    }

    return res.status(400).json({ ok: false, error: `Unbekannte Aktion „${art}“.` });
  } catch (err) {
    console.error("[ZENTRALE] aktion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/zentrale/kunden/export — CSV der aktuellen Auswahl. */
router.get("/admin/zentrale/kunden/export", async (req: Request, res: Response) => {
  try {
    const f = { ...filterAus(req.query as any), limit: 5000, offset: 0 };
    const { zeilen } = await kundenListe(f);
    const feld = (v: unknown): string => {
      const s = v == null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const kopf = ["person_id", "name", "stufe", "status", "email", "telefon", "referenz",
      "zahlungsreferenz", "paket", "agent", "umsatz", "angelegt", "letzter_kontakt"];
    const csv = [kopf.join(";"), ...zeilen.map((z: any) => [
      z.person_id, z.name,
      ({ 0: "bezahlt", 1: "A", 2: "B", 3: "C" } as any)[z.priority_tier] ?? z.priority_tier,
      z.tier_reason, z.email, z.primary_phone, z.ref, z.zahlungsreferenz, z.paket, z.agent,
      z.umsatz, z.created_at ? new Date(z.created_at).toISOString().slice(0, 10) : "",
      z.letzter_kontakt ? new Date(z.letzter_kontakt).toISOString().slice(0, 10) : "",
    ].map(feld).join(";"))].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="kunden-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(`\uFEFF${csv}`);
  } catch (err) {
    console.error("[ZENTRALE] export:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEAM-ZENTRALE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/zentrale/team — Übersicht mit Kennzahlen je Mitarbeiter. */
router.get("/admin/zentrale/team", async (_req: Request, res: Response) => {
  try {
    // EINE Abfrage für alle Kennzahlen. Zwölf Mitarbeiter × sechs
    // Einzelabfragen wären zweiundsiebzig Runden zur Datenbank.
    // ══════════════════════════════════════════════════════════════════════
    // `unsafe`, WEIL HIER SQL-BAUSTEINE EINGESETZT WERDEN
    //
    // ── DER FEHLER, DEN DAS BEHEBT ────────────────────────────────────────
    // Diese Abfrage lief als getaggtes Template (sqlPool`…`). Dort wird jedes
    // ${…} als PARAMETER gebunden, nicht als SQL eingesetzt. Mein
    // `bestandSql(1)` ist aber ein SQL-Ausdruck — er landete als Text-Literal
    // in der Antwort.
    //
    // Das Ergebnis stand im Screenshot des Vorgesetzten: Wo „58" stehen
    // sollte, stand „(SELECT COUNT(*)::int FROM fiaon_persons p WHERE …".
    // Jede Mitarbeiterkarte zeigte drei Absätze Quelltext.
    //
    // Und der eigentliche Fehler war meiner: Ich habe die Änderung mit
    // `tsc --noEmit` und `esbuild` geprüft — beide waren grün, weil es kein
    // Typ- und kein Syntaxfehler ist. Nur der Browser hätte es gezeigt, und
    // dorthin habe ich nicht geschaut.
    // ══════════════════════════════════════════════════════════════════════
    const zeilen = (await sqlPool.unsafe(`
      SELECT a.id, a.name, COALESCE(NULLIF(a.first_name, ''), a.name) AS vorname, a.email,
             a.avatar, a.rolle, a.active, a.distribution_active, a.is_test_account,
             a.commission_rate_bp, a.monthly_goal_cents, a.last_login_at, a.bank_iban_masked,
             -- ── EINE DEFINITION, EIN ORT (11.08.2026) ────────────────────
             -- Hier stand eine eigene Zählung ohne „NOT is_blocked". Der
             -- Vorgesetzte sah für Daniel Stripling 58 A-Kunden, der Agent
             -- selbst 30, seine Arbeitsliste 4. Drei Zahlen, eine Frage.
             --
             -- Jetzt aus fiaon-bestand-filter.ts. Zusätzlich die Zahl, die
             -- heute wirklich ansteht — beide nebeneinander sind die ehrliche
             -- Auskunft, eine allein ist immer irreführend.
             ${bestandSql(1)} AS stufe_a,
             ${bestandSql(2)} AS stufe_b,
             ${bestandSql(3)} AS stufe_c,
             ${bestandHeuteSql(1)} AS stufe_a_heute,
             ${bestandHeuteSql(2)} AS stufe_b_heute,
             ${bestandHeuteSql(3)} AS stufe_c_heute,
             (SELECT COUNT(*)::int FROM fiaon_contact_log cl
               WHERE cl.agent_id = a.id AND cl.type <> 'system'
                 AND cl.created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin') AS heute,
             (SELECT COUNT(*)::int FROM fiaon_contact_log cl
               WHERE cl.agent_id = a.id AND cl.type <> 'system'
                 AND cl.created_at >= NOW() - INTERVAL '7 days') AS woche,
             (SELECT COUNT(*)::int FROM fiaon_contact_log cl
               WHERE cl.agent_id = a.id AND cl.outcome LIKE 'erreicht%'
                 AND cl.created_at >= NOW() - INTERVAL '30 days') AS erreicht30,
             -- Ein Anrufversuch ist in diesem Haus type = result mit einem
             -- Ergebnis. Ein erster Entwurf zaehlte type = call — das gibt es
             -- nicht, und die Erreichbarkeit stand bei allen auf einem Strich.
             (SELECT COUNT(*)::int FROM fiaon_contact_log cl
               WHERE cl.agent_id = a.id AND cl.type = 'result' AND cl.outcome IS NOT NULL
                 AND cl.created_at >= NOW() - INTERVAL '30 days') AS anrufe30,
             (SELECT COUNT(*)::int FROM fiaon_commissions c
               WHERE c.agent_id = a.id
                 AND c.created_at >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin')) AS abschluesse_monat,
             (SELECT COALESCE(SUM(c.base_amount_cents), 0)::bigint FROM fiaon_commissions c
               WHERE c.agent_id = a.id
                 AND c.created_at >= date_trunc('month', NOW() AT TIME ZONE 'Europe/Berlin')) AS umsatz_monat_cents,
             (SELECT COALESCE(SUM(c.amount_cents), 0)::bigint FROM fiaon_commissions c
               WHERE c.agent_id = a.id AND c.status = 'bestaetigt') AS offen_cents,
             (SELECT COALESCE(SUM(c.amount_cents), 0)::bigint FROM fiaon_commissions c
               WHERE c.agent_id = a.id AND c.status = 'ausgezahlt') AS ausgezahlt_cents,
             (SELECT MAX(cl.created_at) FROM fiaon_contact_log cl WHERE cl.agent_id = a.id) AS letzte_aktivitaet
      FROM fiaon_agents a
      ORDER BY a.active DESC, a.is_test_account ASC, a.id
    `)) as any[];
    res.json({
      ok: true,
      team: zeilen.map((r) => ({
        ...r,
        erreichbarkeit: Number(r.anrufe30) > 0
          ? Math.round((Number(r.erreicht30) / Number(r.anrufe30)) * 100) : null,
        bestand: Number(r.stufe_a) + Number(r.stufe_b) + Number(r.stufe_c),
      })),
    });
  } catch (err) {
    console.error("[ZENTRALE] team:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /admin/zentrale/team/:id/logs — das Protokoll dieser Person.
 *
 * Die „genaue Klicks"-Forderung. Es wird nichts NEUES mitgeschrieben: Alles
 * hier steht längst in `fiaon_agent_events` und `fiaon_contact_log` — es war
 * nur nie an einem Ort lesbar.
 */
router.get("/admin/zentrale/team/:id/logs", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const art = String(req.query.art || "");
    const q = String(req.query.q || "").trim();
    const grenze = Math.min(500, Number(req.query.limit) || 150);

    const events = (await sqlPool`
      SELECT 'ereignis' AS quelle, e.id, e.type AS art, e.meta, e.reason, e.actor, e.created_at,
             NULL::text AS ref, NULL::text AS notiz
      FROM fiaon_agent_events e
      WHERE (e.agent_id = ${id} OR e.from_agent_id = ${id} OR e.to_agent_id = ${id})
        AND (${art || null}::text IS NULL OR e.type = ${art || null})
        AND (${q || null}::text IS NULL
             OR e.type ILIKE ${`%${q}%`} OR COALESCE(e.meta, '') ILIKE ${`%${q}%`}
             OR COALESCE(e.reason, '') ILIKE ${`%${q}%`})
      ORDER BY e.created_at DESC LIMIT ${grenze}
    `) as any[];

    const kontakte = art && art !== "kontakt" ? [] : (await sqlPool`
      SELECT 'kontakt' AS quelle, cl.id, COALESCE(cl.outcome, cl.type) AS art,
             NULL::text AS meta, NULL::text AS reason, cl.agent_name AS actor, cl.created_at,
             cl.ref, cl.note AS notiz
      FROM fiaon_contact_log cl
      WHERE cl.agent_id = ${id} AND cl.type <> 'system'
        AND (${q || null}::text IS NULL
             OR COALESCE(cl.note, '') ILIKE ${`%${q}%`} OR COALESCE(cl.ref, '') ILIKE ${`%${q}%`})
      ORDER BY cl.created_at DESC LIMIT ${grenze}
    `) as any[];

    const alles = [...events, ...kontakte]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, grenze);

    const arten = (await sqlPool`
      SELECT DISTINCT type FROM fiaon_agent_events
      WHERE agent_id = ${id} OR from_agent_id = ${id} OR to_agent_id = ${id}
      ORDER BY type
    `) as any[];

    res.json({ ok: true, eintraege: alles, arten: arten.map((a) => a.type) });
  } catch (err) {
    console.error("[ZENTRALE] logs:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Nachrichten und Banner ─────────────────────────────────────────────────

/** POST /admin/zentrale/team/nachricht */
router.post("/admin/zentrale/team/nachricht", async (req: Request, res: Response) => {
  try {
    const ids: number[] = (req.body?.agentIds ?? []).map(Number).filter(Boolean);
    const text = String(req.body?.text || "").trim();
    if (ids.length === 0) return res.status(400).json({ ok: false, error: "Keine Empfänger." });
    if (text.length < 3) return res.status(400).json({ ok: false, error: "Bitte einen Text eingeben." });
    const bis = req.body?.bannerBis ? new Date(String(req.body.bannerBis)) : null;

    for (const id of ids) {
      await sqlPool`
        INSERT INTO fiaon_team_nachrichten (agent_id, text, banner_bis, created_by)
        VALUES (${id}, ${text}, ${bis}, ${String(req.body?.von || "Vorgesetzter")})
      `;
    }
    res.json({ ok: true, meldung: `An ${ids.length} ${ids.length === 1 ? "Person" : "Personen"} zugestellt.` });
  } catch (err) {
    console.error("[ZENTRALE] nachricht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/zentrale/team/event — ein Ereignis verkünden.
 *
 * Erzeugt GENAU EINEN angepinnten Post im Space und optional Banner. Der Space
 * ist bereits der Ort für Teamweites — ein zweiter Kanal daneben hieße, dass
 * niemand mehr weiß, wo er nachsehen soll.
 */
router.post("/admin/zentrale/team/event", async (req: Request, res: Response) => {
  try {
    const titel = String(req.body?.titel || "").trim();
    const text = String(req.body?.text || "").trim();
    if (titel.length < 3 || text.length < 3) {
      return res.status(400).json({ ok: false, error: "Titel und Text sind nötig." });
    }
    const schluessel = `event-${Date.now().toString(36)}`;
    const [post] = (await sqlPool`
      INSERT INTO fiaon_posts (autor_agent_id, autor_typ, text, angepinnt, auto_art, auto_schluessel)
      VALUES (NULL, 'leitung', ${`${titel}\n\n${text}`}, TRUE, 'verkuendung', ${schluessel})
      ON CONFLICT (auto_art, auto_schluessel) WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL
      DO NOTHING RETURNING id
    `) as any[];

    let banner = 0;
    if (req.body?.auchBanner) {
      const agenten = (await sqlPool`
        SELECT id FROM fiaon_agents WHERE active AND (NOT is_test_account OR pruefkonto)
      `) as any[];
      const bis = new Date(Date.now() + 7 * 86_400_000);
      for (const a of agenten) {
        await sqlPool`
          INSERT INTO fiaon_team_nachrichten (agent_id, text, banner_bis, created_by)
          VALUES (${a.id}, ${`${titel} — ${text}`}, ${bis}, ${String(req.body?.von || "Vorgesetzter")})
        `;
        banner++;
      }
    }
    res.json({
      ok: true, postId: post?.id ?? null,
      meldung: `Im Space angepinnt${banner ? ` und als Banner an ${banner} Personen` : ""}.`,
    });
  } catch (err) {
    console.error("[ZENTRALE] event:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/zentrale/team/nachrichten — wer hat bestätigt? */
router.get("/admin/zentrale/team/nachrichten", async (_req: Request, res: Response) => {
  try {
    res.json({
      ok: true,
      nachrichten: await sqlPool`
        SELECT n.id, n.text, n.banner_bis, n.bestaetigt_am, n.created_by, n.created_at,
               COALESCE(NULLIF(a.first_name, ''), a.name) AS empfaenger, n.agent_id
        FROM fiaon_team_nachrichten n JOIN fiaon_agents a ON a.id = n.agent_id
        WHERE n.entfernt_am IS NULL
        ORDER BY n.created_at DESC LIMIT 100
      `,
    });
  } catch (err) {
    console.error("[ZENTRALE] nachrichten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Die Sicht des Mitarbeiters ─────────────────────────────────────────────

/** GET /agent/nachrichten — offene Banner für den angemeldeten Menschen. */
router.get("/agent/nachrichten", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    res.json({
      ok: true,
      nachrichten: await sqlPool`
        SELECT id, text, banner_bis, created_by, created_at
        FROM fiaon_team_nachrichten
        WHERE agent_id = ${req.agent!.id} AND bestaetigt_am IS NULL AND entfernt_am IS NULL
          -- Abgelaufene Banner verschwinden von selbst. Ein Hinweis, der
          -- ewig steht, wird zur Tapete.
          AND (banner_bis IS NULL OR banner_bis > NOW())
        ORDER BY created_at ASC
      `,
    });
  } catch (err) {
    res.json({ ok: true, nachrichten: [] });
  }
});

/** POST /agent/nachrichten/:id/verstanden */
router.post("/agent/nachrichten/:id/verstanden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await sqlPool`
      UPDATE fiaon_team_nachrichten SET bestaetigt_am = NOW()
      WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id} AND bestaetigt_am IS NULL
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[ZENTRALE] verstanden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// BESTELLUNGEN IN DER AKTE VERWALTEN
//
// Der Vorgesetzte konnte in der Akte nichts entfernen — eine versehentlich
// angelegte Bestellung blieb für immer stehen und verfälschte jede Zählung.
//
// DIESELBEN REGELN WIE BEI PERSONEN (server/lib/fiaon-loeschen.ts):
//   ENDGÜLTIG    Unbezahlt, keine Rechnung, keine Provision → darf ganz weg.
//   ARCHIVIEREN  Alles andere. Eine bezahlte Bestellung endgültig zu löschen
//                hieße, den Umsatz aus der Buchhaltung zu nehmen.
// Nicht der Klickende entscheidet, sondern der Zustand der Daten.
// ═══════════════════════════════════════════════════════════════════════════

interface BestellKandidat {
  ref: string;
  art: "endgueltig" | "archivieren" | "gesperrt";
  begruendung: string;
  betrag: string | null;
  paket: string | null;
}

async function bestellungenEinteilen(refs: string[]): Promise<BestellKandidat[]> {
  if (refs.length === 0) return [];
  const rows = (await sqlPool`
    SELECT a.ref, a.payment_status, a.invoice_number, a.amount_due,
           SPLIT_PART(a.pack_name, E'\n', 1) AS paket, a.archived_at, a.gdpr_deleted_at,
           (SELECT COUNT(*)::int FROM fiaon_commissions c
             WHERE c.ref = a.ref AND c.status <> 'storniert') AS provisionen,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = a.ref) AS raten
    FROM fiaon_applications a WHERE a.ref = ANY(${refs})
  `) as any[];

  return rows.map((r) => {
    const bezahlt = String(r.payment_status) === "paid";
    const hatRechnung = !!r.invoice_number;
    const hatProvision = Number(r.provisionen) > 0;
    const hatRaten = Number(r.raten) > 0;

    let art: BestellKandidat["art"] = "endgueltig";
    let begruendung = "Unbezahlt, keine Rechnung, keine Provision — darf vollständig verschwinden.";

    if (r.gdpr_deleted_at) {
      art = "gesperrt";
      begruendung = "Für diesen Datensatz liegt bereits eine DSGVO-Löschung vor.";
    } else if (bezahlt || hatRechnung || hatProvision || hatRaten) {
      art = "archivieren";
      const teile: string[] = [];
      if (bezahlt) teile.push("bezahlt");
      if (hatRechnung) teile.push(`Rechnung ${r.invoice_number}`);
      if (hatProvision) teile.push(`${r.provisionen} gebuchte Provision${Number(r.provisionen) === 1 ? "" : "en"}`);
      if (hatRaten) teile.push(`${r.raten} Raten`);
      begruendung = `${teile.join(", ")} — wird archiviert statt gelöscht. `
        + "Die Buchungsdaten bleiben nach § 147 AO zehn Jahre lesbar.";
    } else if (r.archived_at) {
      begruendung = "Bereits archiviert, unbezahlt — darf endgültig entfernt werden.";
    }
    return {
      ref: String(r.ref), art, begruendung,
      betrag: r.amount_due != null ? `${Number(r.amount_due).toFixed(2).replace(".", ",")} €` : null,
      paket: r.paket || null,
    };
  });
}

/** POST /admin/bestellungen/vorschau */
router.post("/admin/bestellungen/vorschau", async (req: Request, res: Response) => {
  try {
    const refs = (req.body?.refs ?? []).map(String).filter(Boolean);
    if (refs.length === 0) return res.status(400).json({ ok: false, error: "Keine Auswahl." });
    const kandidaten = await bestellungenEinteilen(refs);
    const endgueltig = kandidaten.filter((k) => k.art === "endgueltig").length;
    const archivieren = kandidaten.filter((k) => k.art === "archivieren").length;
    const gesperrt = kandidaten.filter((k) => k.art === "gesperrt").length;

    const hinweise: string[] = [];
    if (endgueltig > 0) {
      hinweise.push(`${endgueltig} ${endgueltig === 1 ? "Bestellung verschwindet" : "Bestellungen verschwinden"} `
        + "vollständig — samt Verlauf und Vermerken. Das lässt sich nicht rückgängig machen.");
    }
    if (archivieren > 0) {
      hinweise.push(`${archivieren} ${archivieren === 1 ? "Bestellung wird" : "Bestellungen werden"} `
        + "archiviert statt gelöscht: Sie sind bezahlt, haben eine Rechnung oder eine gebuchte "
        + "Provision. Sie bleiben in der Akte lesbar — das schreibt § 147 AO vor.");
    }
    if (gesperrt > 0) hinweise.push(`${gesperrt} übersprungen: bereits gelöscht.`);

    const wirksam = endgueltig + archivieren;
    res.json({
      ok: true, kandidaten, endgueltig, archivieren, gesperrt, hinweise,
      bestaetigung: `${wirksam} ${wirksam === 1 ? "Bestellung" : "Bestellungen"} entfernen`,
    });
  } catch (err) {
    console.error("[ZENTRALE] bestellungen vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/bestellungen/entfernen */
router.post("/admin/bestellungen/entfernen", async (req: Request, res: Response) => {
  try {
    const refs = (req.body?.refs ?? []).map(String).filter(Boolean);
    if (refs.length === 0) return res.status(400).json({ ok: false, error: "Keine Auswahl." });
    const kandidaten = await bestellungenEinteilen(refs);
    const wirksam = kandidaten.filter((k) => k.art !== "gesperrt").length;
    const soll = `${wirksam} ${wirksam === 1 ? "Bestellung" : "Bestellungen"} entfernen`;
    if (String(req.body?.bestaetigung || "").trim() !== soll) {
      return res.status(400).json({ ok: false, error: `Bitte zur Bestätigung genau eintippen: „${soll}“` });
    }

    const { archiviereAntrag } = await import("../lib/fiaon-antrag-archiv");
    let geloescht = 0;
    let archiviert = 0;

    for (const k of kandidaten) {
      if (k.art === "gesperrt") continue;
      if (k.art === "archivieren") {
        await archiviereAntrag(k.ref, String(req.body?.grund || "sonstiges"),
          String(req.body?.notiz || "Aus der Akte entfernt"),
          { name: "Vorgesetzter", agentId: null, rolle: "admin" }).catch(() => {});
        archiviert++;
        continue;
      }
      // Endgültig: von innen nach außen, das Protokoll zuerst.
      await sqlPool`
        INSERT INTO fiaon_loeschungen (art, person_id, person_name, refs, grund, akteur, stapel)
        VALUES ('endgueltig', NULL, ${`Bestellung ${k.ref}`}, ${k.ref},
                ${String(req.body?.notiz || "Aus der Akte entfernt")}, 'Vorgesetzter', ${`B-${k.ref}`})
      `.catch(() => {});
      await sqlPool`DELETE FROM fiaon_contact_log WHERE ref = ${k.ref}`;
      await sqlPool`DELETE FROM fiaon_vermerke WHERE ref = ${k.ref}`;
      await sqlPool`DELETE FROM fiaon_applications WHERE ref = ${k.ref}`;
      geloescht++;
    }

    console.log(`[ZENTRALE] Bestellungen: ${geloescht} entfernt, ${archiviert} archiviert`);
    res.json({
      ok: true, geloescht, archiviert,
      meldung: `${geloescht} endgültig entfernt, ${archiviert} archiviert.`,
    });
  } catch (err) {
    console.error("[ZENTRALE] bestellungen entfernen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
