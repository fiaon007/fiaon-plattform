// ═══════════════════════════════════════════════════════════════════════════
// DIE ZENTRALE — Endpunkte für das Postfach (03.09.2026, E-094)
//
// JUSTIN: „die Ansicht VIEL cleaner, weg mit dem 3D-Video […] ich will auch
// immer sehen was der Kunde geschrieben hat — es muss aussehen wie ein E-Mail
// Postfach was eben voll automatisch von unseren Mitarbeitern betreut wird.
// […] Immer als Entwurf speichern, dass ich kurz drüber schauen kann und dann
// markieren kann, oder alle direkt versende."
//
// Eigene Router-Datei, damit die Oberfläche und die Verarbeitungslogik nicht
// dieselbe Datei anfassen.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { akteLesen } from "../lib/fiaon-postmeister-dossier";
import { postmeisterSchema, kostenHeute } from "../lib/fiaon-postmeister-schema";
import { wandPruefen } from "@shared/fiaon-wortverbote";

const router = Router();

const jsonOderLeer = (w: unknown, ersatz: any) => {
  if (w == null) return ersatz;
  if (typeof w === "object") return w;
  try { return JSON.parse(String(w)); } catch { return ersatz; }
};

/** GET /admin/postmeister/postfach — die Liste, wie ein Postfach sie zeigt. */
router.get("/admin/postmeister/postfach", async (req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const ordner = String(req.query.ordner || "offen"); // offen | gesendet | kein_kunde | alle
    const postfach = String(req.query.postfach || "").trim();
    const suche = String(req.query.suche || "").trim();
    const grenze = Math.min(100, Math.max(10, Number(req.query.limit) || 40));
    const vor = Number(req.query.vor) || 0;

    const wo: string[] = ["1=1"];
    const werte: any[] = [];
    if (ordner === "offen") wo.push("pm.aktion IN ('entwurf','fehler')");
    else if (ordner === "gesendet") wo.push("pm.aktion IN ('gesendet','auto_beantwortet')");
    else if (ordner === "kein_kunde") wo.push("pm.aktion = 'ignoriert'");
    else if (ordner === "geordnet") wo.push("pm.aktion IN ('geordnet','vorgeordnet')");
    if (postfach) { werte.push(postfach); wo.push(`pm.postfach = $${werte.length}`); }
    if (suche) { werte.push(`%${suche}%`); wo.push(`(pm.betreff ILIKE $${werte.length} OR pm.von ILIKE $${werte.length} OR pm.zusammenfassung ILIKE $${werte.length} OR pm.ref ILIKE $${werte.length})`); }
    if (vor) { werte.push(vor); wo.push(`pm.id < $${werte.length}`); }

    const zeilen = (await sqlPool.unsafe(`
      SELECT pm.id, pm.postfach, pm.thread_id, pm.von, pm.betreff, pm.empfangen_am, pm.text,
             pm.zusammenfassung, pm.kategorie, pm.kategorien, pm.flags, pm.kundenlage, pm.dringend,
             pm.aktion, pm.person_id, pm.ref, pm.antwort, pm.antwort_html, pm.belege, pm.handlungen,
             pm.naechster_schritt, pm.pruefung, pm.gesendet_am, pm.begruendung, pm.person_kandidaten,
             p.first_name, p.last_name, ag.first_name AS betreuer,
             (SELECT COUNT(*) FROM fiaon_postmeister x WHERE x.thread_id = pm.thread_id)::int AS im_thread
        FROM fiaon_postmeister pm
        LEFT JOIN fiaon_persons p ON p.id = pm.person_id
        LEFT JOIN fiaon_agents ag ON ag.id = p.assigned_agent_id
       WHERE ${wo.join(" AND ")}
       ORDER BY pm.dringend DESC NULLS LAST, pm.empfangen_am DESC
       LIMIT ${grenze}
    `, werte)) as any[];

    const [z] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE aktion IN ('entwurf','fehler'))::int AS offen,
             COUNT(*) FILTER (WHERE aktion IN ('gesendet','auto_beantwortet'))::int AS gesendet,
             COUNT(*) FILTER (WHERE aktion = 'ignoriert')::int AS kein_kunde,
             COUNT(*) FILTER (WHERE aktion IN ('geordnet','vorgeordnet'))::int AS geordnet,
             COUNT(*) FILTER (WHERE aktion = 'entwurf' AND dringend)::int AS dringend
        FROM fiaon_postmeister
    `) as any[];

    res.json({
      ok: true,
      ordner,
      zaehler: { offen: z?.offen ?? 0, gesendet: z?.gesendet ?? 0, kein_kunde: z?.kein_kunde ?? 0, geordnet: z?.geordnet ?? 0, dringend: z?.dringend ?? 0 },
      naechsterCursor: zeilen.length === grenze ? zeilen[zeilen.length - 1].id : null,
      zeilen: zeilen.map((r) => ({
        id: r.id, postfach: r.postfach, threadId: r.thread_id,
        von: r.von, vonName: String(r.von || "").replace(/<[^>]*>/g, "").replace(/"/g, "").trim() || r.von,
        betreff: r.betreff, empfangenAm: r.empfangen_am, text: r.text,
        zusammenfassung: r.zusammenfassung,
        kategorien: r.kategorien ?? (r.kategorie ? [r.kategorie] : []),
        flags: jsonOderLeer(r.flags, {}), kundenlage: r.kundenlage, dringend: !!r.dringend,
        aktion: r.aktion, personId: r.person_id, ref: r.ref,
        kundeName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        betreuer: r.betreuer ?? null,
        antwort: r.antwort, antwortHtml: r.antwort_html,
        belege: jsonOderLeer(r.belege, []), handlungen: jsonOderLeer(r.handlungen, []),
        naechsterSchritt: jsonOderLeer(r.naechster_schritt, null),
        pruefung: jsonOderLeer(r.pruefung, null),
        gesendetAm: r.gesendet_am, begruendung: r.begruendung,
        kandidaten: jsonOderLeer(r.person_kandidaten, []),
        nachrichtenImThread: r.im_thread ?? 1,
      })),
    });
  } catch (e: any) {
    console.error("[ZENTRALE] postfach:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** GET /admin/postmeister/eintrag/:id — Mail, Verlauf und Akte nebeneinander. */
router.get("/admin/postmeister/eintrag/:id", async (req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const id = Number(req.params.id);
    const [r] = (await sqlPool`SELECT * FROM fiaon_postmeister WHERE id = ${id} LIMIT 1`) as any[];
    if (!r) return res.status(404).json({ ok: false, error: "Nicht gefunden" });

    const verlauf = (await sqlPool`
      SELECT id, von, empfangen_am, text, antwort, gesendet_am, aktion, betreff
        FROM fiaon_postmeister WHERE thread_id = ${r.thread_id} ORDER BY empfangen_am ASC LIMIT 20
    `) as any[];
    const akte = await akteLesen(r.person_id ?? null, r.ref ?? null);

    res.json({
      ok: true,
      eintrag: {
        id: r.id, postfach: r.postfach, von: r.von, betreff: r.betreff, empfangenAm: r.empfangen_am,
        text: r.text, zusammenfassung: r.zusammenfassung, kategorien: r.kategorien ?? [],
        flags: jsonOderLeer(r.flags, {}), kundenlage: r.kundenlage, dringend: !!r.dringend,
        aktion: r.aktion, antwort: r.antwort, antwortHtml: r.antwort_html,
        belege: jsonOderLeer(r.belege, []), handlungen: jsonOderLeer(r.handlungen, []),
        pruefung: jsonOderLeer(r.pruefung, null), naechsterSchritt: jsonOderLeer(r.naechster_schritt, null),
        begruendung: r.begruendung, gesendetAm: r.gesendet_am, ref: r.ref, personId: r.person_id,
      },
      verlauf: verlauf.map((v) => ({
        id: v.id, richtung: "ein", von: v.von, am: v.empfangen_am, betreff: v.betreff,
        text: v.text, antwort: v.antwort, antwortGesendet: v.gesendet_am, aktion: v.aktion,
      })),
      akte,
    });
  } catch (e: any) {
    console.error("[ZENTRALE] eintrag:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** Ein Entwurf wird gesendet — mit frischer Prüfung kurz davor. */
async function entwurfSenden(id: number, textNeu?: string | null): Promise<{ ok: boolean; grund: string }> {
  const [r] = (await sqlPool`
    UPDATE fiaon_postmeister SET aktion = 'sendet', updated_at = NOW()
     WHERE id = ${id} AND aktion IN ('entwurf', 'fehler') RETURNING *
  `) as any[];
  if (!r) return { ok: false, grund: "Nicht mehr im Entwurf-Zustand" };

  const text = String(textNeu ?? r.antwort ?? "").trim();
  if (text.length < 20) {
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf' WHERE id = ${id}`;
    return { ok: false, grund: "Text ist zu kurz" };
  }

  // Frische Prüfung: Wand und Bankdaten. Ein Entwurf von gestern kann heute
  // falsch sein — am 02.09. lag einer mit der gesperrten IBAN in der Werkbank.
  const gelaufen = (jsonOderLeer(r.handlungen, []) as any[]).filter((h) => h.ok).map((h) => h.werkzeug);
  const treffer = wandPruefen(text, gelaufen).filter((t) => t.art !== "floskel");
  if (treffer.length) {
    await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${`Nicht gesendet: ${treffer.map((t) => t.treffer).join("; ")}`} WHERE id = ${id}
    `;
    return { ok: false, grund: `Prüfung: ${treffer.map((t) => t.treffer).join("; ")}` };
  }

  try {
    const { nachrichtLesen, antwortSenden, nachrichtLabeln, labelSicherstellen, entwurfLoeschen } = await import("../lib/fiaon-gmail");
    const mail = await nachrichtLesen(r.postfach, r.gmail_id);
    await antwortSenden(r.postfach, mail, text, r.antwort_html ?? null);
    if (r.antwort_draft_id) await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
    await nachrichtLabeln(r.postfach, r.gmail_id, [await labelSicherstellen(r.postfach, "FIAON/Beantwortet")], ["UNREAD"]).catch(() => {});
    await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'gesendet', antwort = ${text}, gesendet_am = NOW(), updated_at = NOW() WHERE id = ${id}
    `;
    if (r.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${r.ref}, ${r.person_id}, NULL, 'Postmeister', 'system', ${`Antwort freigegeben und gesendet: ${text.slice(0, 400)}`})
      `.catch(() => {});
    }
    return { ok: true, grund: "gesendet" };
  } catch (e: any) {
    await sqlPool`UPDATE fiaon_postmeister SET aktion = 'entwurf', begruendung = ${String(e?.message || e).slice(0, 300)} WHERE id = ${id}`;
    return { ok: false, grund: String(e?.message || e).slice(0, 200) };
  }
}

router.post("/admin/postmeister/eintrag/:id/senden", async (req: Request, res: Response) => {
  const erg = await entwurfSenden(Number(req.params.id), req.body?.text ?? null);
  res.status(erg.ok ? 200 : 409).json(erg);
});

router.post("/admin/postmeister/eintrag/:id/verwerfen", async (req: Request, res: Response) => {
  try {
    const [r] = (await sqlPool`
      UPDATE fiaon_postmeister SET aktion = 'geordnet', begruendung = ${`Verworfen: ${String(req.body?.grund || "ohne Angabe").slice(0, 200)}`}, updated_at = NOW()
       WHERE id = ${Number(req.params.id)} AND aktion IN ('entwurf', 'fehler') RETURNING postfach, antwort_draft_id
    `) as any[];
    if (r?.antwort_draft_id) {
      const { entwurfLoeschen } = await import("../lib/fiaon-gmail");
      await entwurfLoeschen(r.postfach, r.antwort_draft_id).catch(() => {});
    }
    res.json({ ok: !!r });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Mehrere auf einmal — nur ausdrücklich ausgewählte, nie „alles". */
router.post("/admin/postmeister/senden-mehrere", async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Boolean).slice(0, 60) : [];
    if (!ids.length) return res.status(400).json({ ok: false, error: "Keine Auswahl" });
    let gesendet = 0; const fehler: { id: number; grund: string }[] = [];
    for (const id of ids) {
      const e = await entwurfSenden(id);
      if (e.ok) gesendet += 1; else fehler.push({ id, grund: e.grund });
    }
    res.json({ ok: true, gesendet, fehler });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Person zuordnen, wenn der Absender unbekannt war. */
router.post("/admin/postmeister/eintrag/:id/person", async (req: Request, res: Response) => {
  try {
    const personId = Number(req.body?.personId);
    if (!personId) return res.status(400).json({ ok: false, error: "personId fehlt" });
    const [b] = (await sqlPool`
      SELECT ref FROM fiaon_applications WHERE person_id = ${personId} AND merged_into IS NULL
       ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1
    `) as any[];
    await sqlPool`
      UPDATE fiaon_postmeister SET person_id = ${personId}, ref = ${b?.ref ?? null}, updated_at = NOW()
       WHERE id = ${Number(req.params.id)}
    `;
    res.json({ ok: true, ref: b?.ref ?? null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

/** Der Kopf: Zustand, Rückstand, Kosten. */
router.get("/admin/postmeister/kopf", async (_req: Request, res: Response) => {
  try {
    await postmeisterSchema();
    const [z] = (await sqlPool`
      SELECT COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS entwuerfe,
             COUNT(*) FILTER (WHERE aktion = 'entwurf' AND dringend)::int AS dringend,
             COUNT(*) FILTER (WHERE aktion = 'fehler')::int AS fehler,
             COUNT(*) FILTER (WHERE gesendet_am > NOW() - INTERVAL '24 hours')::int AS heute_gesendet,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS heute_gesehen
        FROM fiaon_postmeister
    `) as any[];
    const jePostfach = (await sqlPool`
      SELECT postfach, COUNT(*) FILTER (WHERE aktion = 'entwurf')::int AS offen, COUNT(*)::int AS gesamt
        FROM fiaon_postmeister GROUP BY postfach ORDER BY postfach
    `) as any[];
    const threads = await sqlPool`
      SELECT COUNT(*) FILTER (WHERE status = 'offen')::int AS offen, COUNT(*)::int AS gesamt FROM fiaon_postfach_threads
    `.then((r: any) => r[0] ?? { offen: 0, gesamt: 0 }).catch(() => ({ offen: 0, gesamt: 0 }));
    res.json({
      ok: true, zahlen: z ?? {}, jePostfach,
      rueckstand: threads ?? { offen: 0, gesamt: 0 },
      kostenHeuteEuro: Number((await kostenHeute("postmeister-antwort")).toFixed(2)),
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 200) });
  }
});

export default router;
