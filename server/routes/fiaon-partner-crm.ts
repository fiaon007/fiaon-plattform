// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-AUFTRÄGE › GESCHÄFTSPARTNER — ROUTEN DES CRM (E-425, 22.10.2026)
//
// Mount /api/fiaon, Wand requireChef("leitung") an JEDER Route. Logik:
// server/lib/fiaon-partner-crm.ts (Datenbank), fiaon-partner-crm-ki.ts (KI),
// fiaon-adresse.ts (Adressvorschläge). Antworten { ok, … } / { ok:false, error }.
//
//   GET  /chef/partner-crm                     Liste + Suche (?q, art, status, archiv=1)
//   GET  /chef/partner-crm/firma/:id           die ganze Akte
//   POST /chef/partner-crm/firma               anlegen          POST …/firma/:id  ändern
//   POST /chef/partner-crm/firma/:id/archiv    archivieren / zurückholen ({ zurueck })
//   POST /chef/partner-crm/kontakt[/:id]       anlegen / ändern  POST …/kontakt/:id/entfernen
//   POST /chef/partner-crm/verlauf             eintragen         POST …/verlauf/:id/entfernen
//   POST /chef/partner-crm/aufgabe[/:id]       anlegen / ändern / erledigt  POST …/aufgabe/:id/entfernen
//   POST /chef/partner-crm/dokument            hochladen (multipart „datei“)  GET …/dokument/:id  POST …/dokument/:id/entfernen
//   POST /chef/partner-crm/aus-koop/:angebotId Kooperation (IA-KOOP-) → Partner-Akte
//   POST /chef/partner-crm/ki/mail             Mail → Vorschlag (speichert NICHTS)
//   POST /chef/partner-crm/uebernehmen         bestätigter Vorschlag → speichern (eine Transaktion)
//   GET  /chef/partner-crm/firma/:id/lage      „Was steht an?“
//   GET  /chef/partner-crm/adresse?q=          Adressvorschläge beim Tippen
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { GLOBAL_DATEI_MAX_BYTES, globalDateinameKopf, globalMimeAuslieferbar } from "../lib/fiaon-global-bereich-regeln";
import {
  partnerListe, partnerAkte, firmaAnlegen, firmaAendern, firmaArchivieren, kontaktSpeichern, kontaktEntfernen, verlaufAnlegen, verlaufEntfernen,
  aufgabeSpeichern, aufgabeEntfernen, dokumentAblegen, dokumentLesen, dokumentEntfernen, ausKoopAnlegen, uebernehmen, partnerMitarbeiter,
} from "../lib/fiaon-partner-crm";

const router = Router();
const wache = requireChef("leitung");

/** Wer im Chefbüro handelt — Name für Verlauf und „erstellt von“. */
async function wer(req: Request): Promise<string> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Chefbüro";
}
const idAus = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error });
  const { ok: _ok, status: _s, ...rest } = erg;
  return res.json({ ok: true, ...rest });
}
function fehler(res: Response, wo: string, err: unknown) {
  console.error(`[PARTNER-CRM] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal versuchen." });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: GLOBAL_DATEI_MAX_BYTES, files: 1, fields: 16, parts: 20 } }).fields([{ name: "datei", maxCount: 1 }]);
function dateiAnnehmen(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ ok: false, error: "Die Datei ist größer als 15 MB." });
    return res.status(400).json({ ok: false, error: "Die Datei konnte nicht angenommen werden (eine Datei je Upload)." });
  });
}

// ── Lesen ────────────────────────────────────────────────────────────────────
router.get("/chef/partner-crm", wache, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { kiStand } = await import("../lib/fiaon-partner-crm-ki");
    const [liste, mitarbeiter, ki] = await Promise.all([
      partnerListe({ q: req.query.q, art: req.query.art, status: req.query.status, archiv: req.query.archiv === "1" }),
      partnerMitarbeiter(),
      kiStand(),
    ]);
    res.json({ ok: true, ...liste, mitarbeiter, ki });
  } catch (e) { fehler(res, "liste", e); }
});

router.get("/chef/partner-crm/firma/:id", wache, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const akte = await partnerAkte(idAus(req.params.id));
    if (!akte) return res.status(404).json({ ok: false, error: "Diesen Partner gibt es nicht." });
    res.json({ ok: true, akte });
  } catch (e) { fehler(res, "akte", e); }
});

router.get("/chef/partner-crm/firma/:id/lage", wache, async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const akte = await partnerAkte(idAus(req.params.id));
    if (!akte) return res.status(404).json({ ok: false, error: "Diesen Partner gibt es nicht." });
    const { lageZusammenfassen } = await import("../lib/fiaon-partner-crm-ki");
    res.json({ ok: true, ...(await lageZusammenfassen(akte)) });
  } catch (e) { fehler(res, "lage", e); }
});

router.get("/chef/partner-crm/adresse", wache, async (req, res) => {
  try {
    const { adressVorschlaege } = await import("../lib/fiaon-adresse");
    const erg = await adressVorschlaege(req.query.q, req.query.sprache);
    res.setHeader("Cache-Control", "private, max-age=300");
    antwort(res, erg as any);
  } catch (e) { fehler(res, "adresse", e); }
});

router.get("/chef/partner-crm/dokument/:id", wache, async (req, res) => {
  try {
    const d = await dokumentLesen(idAus(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: "Dieses Dokument gibt es nicht." });
    const typ = globalMimeAuslieferbar(d.mime);
    if (!typ) return res.status(415).json({ ok: false, error: "Dieses Dokument lässt sich nicht anzeigen." });
    const art = req.query.laden === "1" ? "attachment" : "inline";
    res.setHeader("Content-Type", typ);
    res.setHeader("Content-Disposition", `${art}; filename="${globalDateinameKopf(d.dateiname)}"; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(d.inhalt);
  } catch (e) { fehler(res, "dokument lesen", e); }
});

// ── Firma ────────────────────────────────────────────────────────────────────
router.post("/chef/partner-crm/firma", wache, async (req, res) => {
  try { antwort(res, await firmaAnlegen(req.body, await wer(req))); } catch (e) { fehler(res, "firma anlegen", e); }
});
router.post("/chef/partner-crm/firma/:id", wache, async (req, res) => {
  try { antwort(res, await firmaAendern(idAus(req.params.id), req.body, await wer(req))); } catch (e) { fehler(res, "firma ändern", e); }
});
router.post("/chef/partner-crm/firma/:id/archiv", wache, async (req, res) => {
  try { antwort(res, await firmaArchivieren(idAus(req.params.id), req.body?.zurueck === true, await wer(req))); } catch (e) { fehler(res, "archiv", e); }
});

// ── Kontakt ──────────────────────────────────────────────────────────────────
router.post("/chef/partner-crm/kontakt", wache, async (req, res) => {
  try { antwort(res, await kontaktSpeichern(null, req.body, await wer(req))); } catch (e) { fehler(res, "kontakt anlegen", e); }
});
router.post("/chef/partner-crm/kontakt/:id", wache, async (req, res) => {
  try { antwort(res, await kontaktSpeichern(idAus(req.params.id), req.body, await wer(req))); } catch (e) { fehler(res, "kontakt ändern", e); }
});
router.post("/chef/partner-crm/kontakt/:id/entfernen", wache, async (req, res) => {
  try { antwort(res, await kontaktEntfernen(idAus(req.params.id))); } catch (e) { fehler(res, "kontakt entfernen", e); }
});

// ── Verlauf ──────────────────────────────────────────────────────────────────
router.post("/chef/partner-crm/verlauf", wache, async (req, res) => {
  try { antwort(res, await verlaufAnlegen(req.body, await wer(req))); } catch (e) { fehler(res, "verlauf", e); }
});
router.post("/chef/partner-crm/verlauf/:id/entfernen", wache, async (req, res) => {
  try { antwort(res, await verlaufEntfernen(idAus(req.params.id), await wer(req))); } catch (e) { fehler(res, "verlauf entfernen", e); }
});

// ── Aufgaben ─────────────────────────────────────────────────────────────────
router.post("/chef/partner-crm/aufgabe", wache, async (req, res) => {
  try { antwort(res, await aufgabeSpeichern(null, req.body, await wer(req))); } catch (e) { fehler(res, "aufgabe anlegen", e); }
});
router.post("/chef/partner-crm/aufgabe/:id", wache, async (req, res) => {
  try { antwort(res, await aufgabeSpeichern(idAus(req.params.id), req.body ?? {}, await wer(req))); } catch (e) { fehler(res, "aufgabe ändern", e); }
});
router.post("/chef/partner-crm/aufgabe/:id/entfernen", wache, async (req, res) => {
  try { antwort(res, await aufgabeEntfernen(idAus(req.params.id))); } catch (e) { fehler(res, "aufgabe entfernen", e); }
});

// ── Dokumente ────────────────────────────────────────────────────────────────
router.post("/chef/partner-crm/dokument", wache, dateiAnnehmen, async (req, res) => {
  try {
    const f = ((req as any).files as Record<string, Express.Multer.File[]> | undefined)?.datei?.[0];
    const datei = f?.buffer ? { buffer: f.buffer, originalname: String(f.originalname || "") } : null;
    antwort(res, await dokumentAblegen(req.body, datei, await wer(req), { ohneVerlauf: req.body?.ohneVerlauf === "1" }));
  } catch (e) { fehler(res, "dokument", e); }
});
router.post("/chef/partner-crm/dokument/:id/entfernen", wache, async (req, res) => {
  try { antwort(res, await dokumentEntfernen(idAus(req.params.id), await wer(req))); } catch (e) { fehler(res, "dokument entfernen", e); }
});

// ── Kooperation → Akte, KI, Übernahme ────────────────────────────────────────
router.post("/chef/partner-crm/aus-koop/:angebotId", wache, async (req, res) => {
  try { antwort(res, await ausKoopAnlegen(idAus(req.params.angebotId), await wer(req))); } catch (e) { fehler(res, "aus koop", e); }
});
router.post("/chef/partner-crm/ki/mail", wache, async (req, res) => {
  try {
    const { mailAuswerten } = await import("../lib/fiaon-partner-crm-ki");
    antwort(res, (await mailAuswerten(req.body?.text)) as any);
  } catch (e) { fehler(res, "ki mail", e); }
});
router.post("/chef/partner-crm/uebernehmen", wache, async (req, res) => {
  try { antwort(res, await uebernehmen(req.body ?? {}, await wer(req))); } catch (e) { fehler(res, "übernehmen", e); }
});

export default router;
