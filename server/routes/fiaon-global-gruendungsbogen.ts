// ═══════════════════════════════════════════════════════════════════════════
// GRÜNDUNGSBOGEN — DIE ROUTEN (E-526, 17.11.2026)
//
// Mount /api/fiaon. Logik: server/lib/fiaon-global-gruendungsbogen.ts, Regeln: shared/fiaon-global-gruendungsbogen.ts.
//
// ÖFFENTLICH (signierte Links, kein Login, IP-Drossel, Antworten nie im Zugriffslog — server/index.ts):
//   GET  /global/gruendung/:bt                       gemeinsame Seite: Kopf, Schritte, Kosten, Status je Mitglied
//   POST /global/gruendung/:bt/zugang                { mitgliedId } → Mail mit persönlichem Link an DESSEN Adresse
//   GET  /global/gruendung/:bt/m/:mt                 persönliche Seite (nur dieses Mitglied)
//   POST /global/gruendung/:bt/m/:mt/gesellschaft    { gesellschaft, fassung } → gemeinsame Angaben
//   POST /global/gruendung/:bt/m/:mt/angaben         { angaben } → persönliche Angaben (Zwischenspeichern)
//   POST /global/gruendung/:bt/m/:mt/reisepass       multipart „datei“ (PDF/JPG/PNG, 10 MB, Magic Bytes)
//   POST /global/gruendung/:bt/m/:mt/unterschreiben  { fassung, bestaetigungen, ort, name, unterschriftPng }
//   GET  /global/gruendung/:bt/m/:mt/pdf             das eigene unterschriebene PDF
//
// CHEFBÜRO (requireChef("leitung") an JEDER Route; Pfad unter /chef/global/ → Antworten nie im Log):
//   GET  /chef/global/gruendungsboegen                         Liste
//   POST /chef/global/gruendungsboegen                         anlegen (dieselbe Funktion wie das Skript)
//   GET  /chef/global/gruendungsboegen/:id                     alle Angaben (id oder Kennung GB-…)
//   POST /chef/global/gruendungsboegen/:id/link                gemeinsamen Link neu ausstellen
//   POST /chef/global/gruendungsboegen/:id/schliessen          Bogen schließen
//   POST /chef/global/gruendungsboegen/:id/notiz               interne Notiz
//   POST /chef/global/gruendungsboegen/:id/melden              Aufgabe + Leitungsmail nachholen
//   POST /chef/global/gruendungsboegen/:id/mitglied/:mid/zugang  persönlichen Zugang erneut senden
//   POST /chef/global/gruendungsboegen/:id/mitglied/:mid/email   Zieladresse korrigieren
//   GET  /chef/global/gruendungsboegen/:id/mitglied/:mid/reisepass | /pdf   Dateien
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { fensterDrossel, globalDateinameKopf } from "../lib/fiaon-global-bereich-regeln";
import { aufrufClientIp } from "../lib/fiaon-global-angebot-aufrufe";
import { gbBogenTokenPruefen, gbMitgliedTokenPruefen } from "../lib/fiaon-gruendungsbogen-token";
import { GB_REISEPASS_MAX_BYTES, GB_TEXTE, istKennung } from "@shared/fiaon-global-gruendungsbogen";
import * as GB from "../lib/fiaon-global-gruendungsbogen";

const router = Router();
const wache = requireChef("leitung");

// ── Drosseln je IP (Arbeitsspeicher der Instanz, wie jede Drossel im Haus) ──
const lesenZuViel = fensterDrossel(120, 60_000);
const zugangZuViel = fensterDrossel(20, 15 * 60_000);
const schreibenZuViel = fensterDrossel(90, 10 * 60_000);
const uploadZuViel = fensterDrossel(20, 60 * 60_000);
const unterschriftZuViel = fensterDrossel(12, 15 * 60_000);

const ip = (req: Request) => aufrufClientIp(req);
function kopf(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
}
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) {
    const { ok: _o, status, ...rest } = erg;
    return res.status(Number(status) || 400).json({ ok: false, ...rest });
  }
  // Erfolg trägt kein HTTP-Status-Feld — „status“ ist dort der Stand des Bogens und bleibt stehen.
  return res.json(erg);
}
function fehler(res: Response, wo: string, err: unknown) {
  console.error(`[GRUENDUNGSBOGEN] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: GB_TEXTE.fehler.server });
}
const zuViel = (res: Response) => res.status(429).json({ ok: false, error: GB_TEXTE.fehler.zuVielIp });

// ═══ ÖFFENTLICH ═══════════════════════════════════════════════════════════════
router.get("/global/gruendung/:bt", async (req: Request, res: Response) => {
  kopf(res);
  if (lesenZuViel(ip(req))) return zuViel(res);
  try { antwort(res, await GB.gbGemeinsamSicht(req.params.bt)); } catch (e) { fehler(res, "gemeinsame Seite", e); }
});

router.post("/global/gruendung/:bt/zugang", async (req: Request, res: Response) => {
  kopf(res);
  if (zugangZuViel(ip(req))) return zuViel(res);
  try { antwort(res, await GB.gbZugangAnfordern(req.params.bt, req.body?.mitgliedId)); } catch (e) { fehler(res, "Zugang anfordern", e); }
});

router.get("/global/gruendung/:bt/m/:mt", async (req: Request, res: Response) => {
  kopf(res);
  if (lesenZuViel(ip(req))) return zuViel(res);
  try { antwort(res, await GB.gbMitgliedSicht(req.params.bt, req.params.mt)); } catch (e) { fehler(res, "persönliche Seite", e); }
});

router.post("/global/gruendung/:bt/m/:mt/gesellschaft", async (req: Request, res: Response) => {
  kopf(res);
  if (schreibenZuViel(ip(req))) return zuViel(res);
  try { antwort(res, await GB.gbGesellschaftSpeichern(req.params.bt, req.params.mt, req.body ?? {})); } catch (e) { fehler(res, "Gesellschaft speichern", e); }
});

router.post("/global/gruendung/:bt/m/:mt/angaben", async (req: Request, res: Response) => {
  kopf(res);
  if (schreibenZuViel(ip(req))) return zuViel(res);
  try { antwort(res, await GB.gbAngabenSpeichern(req.params.bt, req.params.mt, req.body ?? {})); } catch (e) { fehler(res, "Angaben speichern", e); }
});

// Erst der Zutritt (echte Links, Drossel), dann multer — wer keinen gültigen Link hat, schickt keine 10 MB in den Speicher.
const passUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: GB_REISEPASS_MAX_BYTES, files: 1, fields: 4, parts: 6 } }).single("datei");
function zutrittVorUpload(req: Request, res: Response, next: NextFunction) {
  kopf(res);
  if (uploadZuViel(ip(req))) return zuViel(res);
  const b = gbBogenTokenPruefen(req.params.bt);
  const m = b ? gbMitgliedTokenPruefen(b.id, req.params.mt) : null;
  if (!b || !m) return res.status(404).json({ ok: false, error: GB_TEXTE.fehler.link });
  if (m.status !== "gueltig") return res.status(410).json({ ok: false, error: GB_TEXTE.persoenlich.abgelaufen });
  passUpload(req, res, (err: any) => {
    if (!err) return next();
    return res.status(400).json({ ok: false, error: GB_TEXTE.fehler.datei, feld: "reisepass" });
  });
}
router.post("/global/gruendung/:bt/m/:mt/reisepass", zutrittVorUpload, async (req: Request, res: Response) => {
  try { antwort(res, await GB.gbReisepassSpeichern(req.params.bt, req.params.mt, (req as any).file ?? null)); } catch (e) { fehler(res, "Reisepass", e); }
});

router.post("/global/gruendung/:bt/m/:mt/unterschreiben", async (req: Request, res: Response) => {
  kopf(res);
  if (unterschriftZuViel(ip(req))) return zuViel(res);
  try {
    antwort(res, await GB.gbUnterschreiben(req.params.bt, req.params.mt, req.body ?? {}, { ip: ip(req), userAgent: String(req.headers["user-agent"] || "") }));
  } catch (e) { fehler(res, "Unterschreiben", e); }
});

router.get("/global/gruendung/:bt/m/:mt/pdf", async (req: Request, res: Response) => {
  kopf(res);
  if (lesenZuViel(ip(req))) return zuViel(res);
  try {
    const erg = await GB.gbPdfLesen(req.params.bt, req.params.mt);
    if (!erg.ok) return antwort(res, erg);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${globalDateinameKopf(erg.dateiname)}"`);
    res.send(erg.pdf);
  } catch (e) { fehler(res, "PDF", e); }
});

// ═══ CHEFBÜRO ═════════════════════════════════════════════════════════════════
async function wer(req: Request): Promise<string> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Chefbüro";
}
/** :id darf die Zahl oder die Kennung „GB-…“ sein (Links aus Aufgaben und Mails tragen die Kennung). */
async function bogenId(roh: unknown): Promise<number | null> {
  const s = String(roh ?? "").trim();
  if (/^\d+$/.test(s)) return Number(s);
  if (istKennung(s.toUpperCase())) return GB.gbChefIdAusKennung(s);
  return null;
}
const nichtDa = (res: Response) => res.status(404).json({ ok: false, error: "Diesen Gründungsbogen gibt es nicht." });

router.get("/chef/global/gruendungsboegen", wache, async (_req: Request, res: Response) => {
  kopf(res);
  try { res.json({ ok: true, boegen: await GB.gbChefListe() }); } catch (e) { fehler(res, "Liste", e); }
});
router.post("/chef/global/gruendungsboegen", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { antwort(res, await GB.gbAnlegen(req.body ?? {}, `Chefbüro (${await wer(req)})`)); } catch (e) { fehler(res, "anlegen", e); }
});
router.get("/chef/global/gruendungsboegen/:id", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefDetail(id)); } catch (e) { fehler(res, "Detail", e); }
});
router.post("/chef/global/gruendungsboegen/:id/link", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefLink(id)); } catch (e) { fehler(res, "Link", e); }
});
router.post("/chef/global/gruendungsboegen/:id/schliessen", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefSchliessen(id, await wer(req))); } catch (e) { fehler(res, "schließen", e); }
});
router.post("/chef/global/gruendungsboegen/:id/notiz", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefNotiz(id, req.body?.notiz, await wer(req))); } catch (e) { fehler(res, "Notiz", e); }
});
router.post("/chef/global/gruendungsboegen/:id/melden", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefMeldungNachholen(id)); } catch (e) { fehler(res, "melden", e); }
});
router.post("/chef/global/gruendungsboegen/:id/mitglied/:mid/zugang", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefZugangSenden(id, Number(req.params.mid), await wer(req))); } catch (e) { fehler(res, "Zugang senden", e); }
});
router.post("/chef/global/gruendungsboegen/:id/mitglied/:mid/email", wache, async (req: Request, res: Response) => {
  kopf(res);
  try { const id = await bogenId(req.params.id); if (!id) return nichtDa(res); antwort(res, await GB.gbChefEmailAendern(id, Number(req.params.mid), req.body?.email, await wer(req))); } catch (e) { fehler(res, "E-Mail ändern", e); }
});
for (const art of ["reisepass", "pdf"] as const) {
  router.get(`/chef/global/gruendungsboegen/:id/mitglied/:mid/${art}`, wache, async (req: Request, res: Response) => {
    kopf(res);
    try {
      const id = await bogenId(req.params.id); if (!id) return nichtDa(res);
      const erg = await GB.gbChefDatei(id, Number(req.params.mid), art);
      if (!erg.ok) return antwort(res, erg);
      res.setHeader("Content-Type", erg.typ);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Disposition", `${req.query.ansehen === "1" ? "inline" : "attachment"}; filename="${globalDateinameKopf(erg.name)}"`);
      res.send(erg.inhalt);
    } catch (e) { fehler(res, `Datei ${art}`, e); }
  });
}

export default router;
