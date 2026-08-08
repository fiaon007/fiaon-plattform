// ═══════════════════════════════════════════════════════════════════════════
// DUBLETTEN-ARBEITSPLATZ (Admin) + ANTRAGS-ARCHIV
//
// Alle Endpunkte hier beginnen mit /admin und liegen damit hinter
// blockAgentsFromAdmin + adminCodeGate (siehe fiaon-admin-zugang.ts). Die
// Vertriebsleitung erreicht dieselbe Maschine über /agent/vertrieb/dubletten/*
// in fiaon-vertrieb.ts — gleiche Bibliothek, gleiche Protokolle, eigene
// Torwächter (nurLeitung + nurMitZusage).
//
// Es gibt hier KEINEN Endpunkt, der mehrere Paare in einem Lauf zusammenführt.
// Das ist Absicht: Jeder Merge ist eine Einzelentscheidung eines Menschen. Ein
// „alle zusammenführen"-Knopf wäre genau das, was frühere Datenverluste
// verursacht hat.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { ensurePersonTables } from "../fiaon-person-model";
import {
  findeKandidaten, gegenueberstellung, kandidatenCacheLeeren, kandidatenZahlen,
  STUFE_TEXT, type Stufe,
} from "../lib/fiaon-dubletten-kandidaten";
import {
  MergeVerboten, personenZusammenfuehren, type MergeEntscheidungen, type Stammfeld,
} from "../lib/fiaon-person-merge";
import {
  ARCHIV_GRUENDE, ArchivVerboten, archiviereAntrag, archivPruefung, stelleAntragWiederHer,
} from "../lib/fiaon-antrag-archiv";
import {
  BELEG_MAX_BYTES, BelegVerboten, belegAnhaengen, belegDaten, belegStand,
} from "../lib/fiaon-zahlungsbeleg";

const router = Router();

const AKTEUR_ADMIN = "Betreiber (Admin)";

// ── Kandidatenliste ────────────────────────────────────────────────────────
router.get("/admin/dubletten/kandidaten", async (req: Request, res: Response) => {
  try {
    await ensurePersonTables();
    const stufen = req.query.stufe
      ? (String(req.query.stufe).split(",").filter(Boolean) as Stufe[])
      : undefined;
    const grenze = Math.min(500, Math.max(10, Number(req.query.grenze) || 200));
    const kandidaten = await findeKandidaten({ stufen, grenze });
    const zahlen = await kandidatenZahlen();
    res.json({ ok: true, kandidaten, zahlen, stufenText: STUFE_TEXT });
  } catch (err) {
    console.error("[FIAON-DUBLETTEN] kandidaten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Zähler für das Admin-Menü ─────────────────────────────────────────────
router.get("/admin/dubletten/zahlen", async (_req: Request, res: Response) => {
  try {
    await ensurePersonTables();
    res.json({ ok: true, ...(await kandidatenZahlen()) });
  } catch (err) {
    console.error("[FIAON-DUBLETTEN] zahlen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Gegenüberstellung eines Paares ────────────────────────────────────────
router.get("/admin/dubletten/paar/:a/:b", async (req: Request, res: Response) => {
  try {
    const a = Number(req.params.a);
    const b = Number(req.params.b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return res.status(400).json({ ok: false, error: "Zwei Personen-IDs nötig" });
    }
    const daten = await gegenueberstellung(a, b);
    if (!daten) return res.status(404).json({ ok: false, error: "Paar nicht gefunden" });
    res.json({ ok: true, ...daten });
  } catch (err) {
    console.error("[FIAON-DUBLETTEN] paar:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Gemeinsame Ausführung für Admin und Vertriebsleitung. */
export async function fuehreMergeAus(
  body: any,
  akteur: { name: string; agentId?: number | null },
): Promise<{ status: number; antwort: any }> {
  const gewinnerId = Number(body?.gewinnerId);
  const verliererId = Number(body?.verliererId);
  if (!Number.isFinite(gewinnerId) || !Number.isFinite(verliererId)) {
    return { status: 400, antwort: { ok: false, error: "gewinnerId und verliererId sind nötig" } };
  }
  const entscheidungen: MergeEntscheidungen = {
    felder: (body?.felder ?? {}) as Partial<Record<Stammfeld, "gewinner" | "verlierer">>,
    betreuer: body?.betreuer,
  };
  try {
    const ergebnis = await personenZusammenfuehren(verliererId, gewinnerId, entscheidungen, akteur);
    // Die Entscheidung muss sofort aus der Liste verschwinden — sonst klickt
    // jemand ein Paar an, das es nicht mehr gibt.
    kandidatenCacheLeeren();
    return { status: 200, antwort: { ok: true, ergebnis } };
  } catch (err) {
    if (err instanceof MergeVerboten) {
      return { status: 400, antwort: { ok: false, code: err.code, error: err.message } };
    }
    console.error("[FIAON-DUBLETTEN] merge:", err);
    return { status: 500, antwort: { ok: false, error: "Serverfehler beim Zusammenführen — es wurde nichts geändert." } };
  }
}

router.post("/admin/dubletten/zusammenfuehren", async (req: Request, res: Response) => {
  const { status, antwort } = await fuehreMergeAus(req.body, { name: AKTEUR_ADMIN, agentId: null });
  res.status(status).json(antwort);
});

/** „Keine Dublette" — dauerhaft, sonst prüft nächste Woche jemand dasselbe Paar. */
export async function merkeKeineDublette(
  body: any,
  akteur: { name: string; agentId?: number | null },
): Promise<{ status: number; antwort: any }> {
  const a = Number(body?.personA);
  const b = Number(body?.personB);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
    return { status: 400, antwort: { ok: false, error: "Zwei verschiedene Personen-IDs nötig" } };
  }
  const [klein, gross] = a < b ? [a, b] : [b, a];
  const begruendung = String(body?.begruendung ?? "").trim() || null;
  await sqlPool`
    INSERT INTO fiaon_dubletten_entschieden (person_a, person_b, entscheidung, begruendung, akteur, akteur_agent_id)
    VALUES (${klein}, ${gross}, 'keine_dublette', ${begruendung}, ${akteur.name}, ${akteur.agentId ?? null})
    ON CONFLICT (person_a, person_b) DO UPDATE SET
      entscheidung = 'keine_dublette',
      begruendung = COALESCE(EXCLUDED.begruendung, fiaon_dubletten_entschieden.begruendung),
      akteur = EXCLUDED.akteur,
      created_at = NOW()
  `;
  await sqlPool`
    INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
    VALUES (${akteur.agentId ?? null}, 'dubletten_verworfen',
            ${JSON.stringify({ personA: klein, personB: gross, begruendung })},
            ${akteur.name}, ${"Paar geprüft und als „keine Dublette“ abgehakt"})
  `.catch(() => {});
  kandidatenCacheLeeren();
  return { status: 200, antwort: { ok: true, personA: klein, personB: gross } };
}

router.post("/admin/dubletten/keine-dublette", async (req: Request, res: Response) => {
  const { status, antwort } = await merkeKeineDublette(req.body, { name: AKTEUR_ADMIN, agentId: null });
  res.status(status).json(antwort);
});

/** Die abgehakten Paare — damit eine Fehlentscheidung wieder auffindbar ist. */
router.get("/admin/dubletten/geprueft", async (_req: Request, res: Response) => {
  try {
    const rows = await sqlPool`
      SELECT d.person_a, d.person_b, d.entscheidung, d.begruendung, d.akteur, d.created_at,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', pa.first_name, pa.last_name)), ''),
                      pa.company_name, pa.primary_email, pa.person_ref) AS name_a,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', pb.first_name, pb.last_name)), ''),
                      pb.company_name, pb.primary_email, pb.person_ref) AS name_b
      FROM fiaon_dubletten_entschieden d
      LEFT JOIN fiaon_persons pa ON pa.id = d.person_a
      LEFT JOIN fiaon_persons pb ON pb.id = d.person_b
      ORDER BY d.created_at DESC LIMIT 200
    `;
    res.json({ ok: true, paare: rows });
  } catch (err) {
    console.error("[FIAON-DUBLETTEN] geprueft:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Ein abgehaktes Paar wieder zur Prüfung stellen (Fehlklick). */
router.post("/admin/dubletten/geprueft/aufheben", async (req: Request, res: Response) => {
  try {
    const a = Number(req.body?.personA);
    const b = Number(req.body?.personB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return res.status(400).json({ ok: false, error: "Zwei Personen-IDs nötig" });
    }
    const [klein, gross] = a < b ? [a, b] : [b, a];
    // Kein Hard-Delete: Die Entscheidung bleibt als Historie stehen und wird auf
    // 'wieder_offen' gesetzt. Die Kandidatensuche berücksichtigt nur
    // 'keine_dublette'.
    await sqlPool`
      UPDATE fiaon_dubletten_entschieden SET entscheidung = 'wieder_offen', created_at = NOW()
      WHERE person_a = ${klein} AND person_b = ${gross}
    `;
    kandidatenCacheLeeren();
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-DUBLETTEN] aufheben:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ANTRAGS-ARCHIV
// ═══════════════════════════════════════════════════════════════════════════

router.get("/admin/antraege/:ref/archiv-pruefung", async (req: Request, res: Response) => {
  try {
    const pruefung = await archivPruefung(String(req.params.ref));
    if (!pruefung) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    res.json({ ok: true, pruefung, gruende: ARCHIV_GRUENDE });
  } catch (err) {
    console.error("[FIAON-ARCHIV] pruefung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export async function fuehreArchivierungAus(
  ref: string,
  body: any,
  akteur: { name: string; agentId?: number | null; rolle: "admin" | "leitung" },
): Promise<{ status: number; antwort: any }> {
  try {
    const ergebnis = await archiviereAntrag(ref, String(body?.grund ?? ""), body?.notiz ?? null, akteur);
    return { status: 200, antwort: { ok: true, ...ergebnis } };
  } catch (err) {
    if (err instanceof ArchivVerboten) {
      return { status: 400, antwort: { ok: false, code: err.code, error: err.message } };
    }
    console.error("[FIAON-ARCHIV] archivieren:", err);
    return { status: 500, antwort: { ok: false, error: "Serverfehler — es wurde nichts geändert." } };
  }
}

router.post("/admin/antraege/:ref/archivieren", async (req: Request, res: Response) => {
  const { status, antwort } = await fuehreArchivierungAus(
    String(req.params.ref), req.body, { name: AKTEUR_ADMIN, agentId: null, rolle: "admin" },
  );
  res.status(status).json(antwort);
});

router.post("/admin/antraege/:ref/wiederherstellen", async (req: Request, res: Response) => {
  try {
    const ergebnis = await stelleAntragWiederHer(String(req.params.ref), {
      name: AKTEUR_ADMIN, agentId: null, rolle: "admin",
    });
    res.json({ ok: true, ...ergebnis });
  } catch (err) {
    if (err instanceof ArchivVerboten) {
      return res.status(400).json({ ok: false, code: err.code, error: err.message });
    }
    console.error("[FIAON-ARCHIV] wiederherstellen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Das Archiv als Liste — ein Archiv, in das man nicht hineinsehen kann, ist ein Papierkorb. */
router.get("/admin/antraege/archiv", async (_req: Request, res: Response) => {
  try {
    const rows = await sqlPool`
      SELECT a.ref, a.person_id, a.pack_name, a.payment_status, a.amount_due,
             a.archived_at, a.archived_reason, a.archived_note, a.archived_by,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''),
                      NULLIF(TRIM(a.company_name), ''), a.email, a.ref) AS kunde
      FROM fiaon_applications a
      WHERE a.archived_at IS NOT NULL
      ORDER BY a.archived_at DESC LIMIT 300
    `;
    res.json({ ok: true, antraege: rows });
  } catch (err) {
    console.error("[FIAON-ARCHIV] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNGSBELEG (Teil B/5) — Upload, Stand und Anzeige
//
// Der Beleg hängt an der Bestellung. Er ist ein HINWEIS für den Menschen, der
// bucht — nie ein Auslöser: Ein Upload bucht nichts und schickt keine Mail.
// ═══════════════════════════════════════════════════════════════════════════

/** Belege sind Fotos vom Handy — im Speicher halten, nicht auf die Platte. */
const belegUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: BELEG_MAX_BYTES },
});

export async function fuehreBelegUploadAus(
  ref: string,
  datei: { buffer: Buffer; mimetype: string; originalname?: string } | undefined,
  body: any,
  akteur: { name: string; agentId?: number | null },
): Promise<{ status: number; antwort: any }> {
  try {
    if (!datei) {
      return { status: 400, antwort: { ok: false, error: "Es kam keine Datei an. Bitte Foto oder PDF wählen." } };
    }
    const ergebnis = await belegAnhaengen(ref, {
      daten: datei.buffer,
      typ: String(datei.mimetype || ""),
      name: datei.originalname ? String(datei.originalname).slice(0, 200) : null,
      datum: String(body?.datum ?? "").trim(),
      notiz: body?.notiz != null ? String(body.notiz) : null,
    }, akteur);
    return {
      status: 200,
      antwort: {
        ok: true, ...ergebnis,
        meldung: ergebnis.ersetzt
          ? "Beleg ersetzt. Der frühere Beleg ist im Verlauf vermerkt."
          : "Beleg hinterlegt. Er steht ab jetzt neben dem Bankeingang — gebucht ist damit nichts.",
      },
    };
  } catch (err) {
    if (err instanceof BelegVerboten) {
      return { status: 400, antwort: { ok: false, code: err.code, error: err.message } };
    }
    console.error("[FIAON-BELEG] upload:", err);
    return { status: 500, antwort: { ok: false, error: "Serverfehler — der Beleg wurde nicht gespeichert." } };
  }
}

router.post("/admin/antraege/:ref/zahlungsbeleg", belegUpload.single("beleg"), async (req: Request, res: Response) => {
  const { status, antwort } = await fuehreBelegUploadAus(
    String(req.params.ref), (req as any).file, req.body, { name: AKTEUR_ADMIN, agentId: null },
  );
  res.status(status).json(antwort);
});

router.get("/admin/antraege/:ref/zahlungsbeleg", async (req: Request, res: Response) => {
  try {
    const beleg = await belegDaten(String(req.params.ref));
    if (!beleg) return res.status(404).json({ ok: false, error: "Kein Beleg hinterlegt" });
    res.setHeader("Content-Type", beleg.typ);
    // `inline`: Der Beleg soll neben dem Bankeingang zu SEHEN sein, nicht im
    // Download-Ordner landen.
    res.setHeader("Content-Disposition", `inline; filename="${beleg.name.replace(/[^\w.-]/g, "_")}"`);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(beleg.daten);
  } catch (err) {
    console.error("[FIAON-BELEG] anzeigen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/antraege/:ref/zahlungsbeleg/stand", async (req: Request, res: Response) => {
  const stand = await belegStand(String(req.params.ref));
  if (!stand) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
  res.json({ ok: true, beleg: stand });
});

export default router;
