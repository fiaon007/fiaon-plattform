// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — ROUTEN (E-489, 09.11.2026)
//
// Mount /api/fiaon. Logik: server/lib/fiaon-datenraum.ts, Regeln: fiaon-datenraum-regeln.ts,
// Vereinbarung: shared/fiaon-datenraum-nda.ts. Antworten { ok, … } / { ok:false, error }.
//
// GAST (öffentlich, Sitzungs-Plätzchen fiaon_dr — signiert, httpOnly, SameSite=Strict, nur /api/fiaon/datenraum):
//   POST /datenraum/eintreten        { code }                      → Plätzchen + Stand
//   GET  /datenraum/stand            Schritt, Angaben, Projekte (Beschreibung und Dokumente erst nach der Vereinbarung)
//   POST /datenraum/angaben          Angaben (+ emailCode)         → Vereinbarung (Blöcke + Prüfsumme) und die gespeicherten Angaben
//   GET  /datenraum/nda              die Vereinbarung zum Lesen
//   GET  /datenraum/nda-entwurf.pdf  die Vereinbarung als Entwurf (zum Gegenlesen, ohne Unterschrift)
//   POST /datenraum/unterzeichnen    { textHash, gelesen, name, png } → Freischaltung
//   GET  /datenraum/dokument/:kennung[?laden=1]   ansehen / herunterladen (PDF mit Vermerk + Vorgangsnummer)
//   GET  /datenraum/nda.pdf          das eigene Exemplar
//   POST /datenraum/abmelden
// Jede Anfrage prüft die Sitzung neu (Gast ↔ Raum, Sitzungsstand, gesperrt, Raum offen); Dokumente
// zusätzlich Vereinbarung, Sichtbarkeit und Thema (drZugriff). HEAD auf Dokumente: 405 (zählt nie als Ansicht).
//
// VERWALTUNG (requireChef("inhaber") an JEDER Route — Nachbesserung 09.11.2026: der Raum enthält Original-Unterlagen,
// unterschriebene Vereinbarungen mit Anschrift und Unterschriftsbild und private Beteiligungen; wie die Aufsicht des
// anderen Datenraums nur für den Inhaber. Erweitern ist eine Zeile — Justins Entscheidung):
//   GET  /chef/datenraum[?firma=]                 Räume eines Partners + Räume ohne Partner
//   GET  /chef/datenraum/raum/:id                 die ganze Akte (Projekte, Dokumente, Gäste, Protokoll, Freigabe)
//   POST /chef/datenraum/raum                     anlegen        POST …/raum/:id  ändern (Titel, Partner, Zusätze, archivieren)
//   GET  /chef/datenraum/raum/:id/vorschau[.pdf][?gast=]   die Vereinbarung, wie der Gast sie sieht (Entwurf)
//   POST /chef/datenraum/raum/:id/freigeben       { hash } den angesehenen Wortlaut freigeben
//   POST /chef/datenraum/raum/:id/projekt         Projekt anlegen/ändern ({ id? })   POST …/projekt/:id/entfernen
//   POST /chef/datenraum/raum/:id/gast            einladen → Code + Link EINMAL
//   POST /chef/datenraum/gast/:id/code            neuer Code → EINMAL    POST …/gast/:id/sperren { sperren, grund }
//   POST /chef/datenraum/gast/:id/entwurf         { code } Einladung als Gmail-Entwurf in js@ (nichts wird gesendet)
//   GET  /chef/datenraum/gast/:id/protokoll.csv   Protokoll des Gastes als Liste
//   POST /chef/datenraum/projekt/:id/dokument     hochladen (multipart „datei“, 25 MB; titel, beschreibung, nr, sichtbar, quelle)
//   POST /chef/datenraum/dokument/:id             Titel, Beschreibung, Reihenfolge, sichtbar   POST …/dokument/:id/entfernen
//   GET  /chef/datenraum/dokument/:id[?laden=1]   Original ansehen   GET /chef/datenraum/nda/:id   unterschriebenes PDF
//   (jede Ansicht im Chefbüro steht mit Namen im Protokoll des Raums)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { DR_DATEI_MAX_BYTES } from "@shared/fiaon-datenraum-nda";
import {
  DR_COOKIE, DR_COOKIE_PFAD, DR_SITZUNG_TAGE, DR_AUSLIEFERBAR, drClientIp, drDispositionKopf, drGeheimnis, drTokenBauen, drTokenPruefen,
} from "../lib/fiaon-datenraum-regeln";
import {
  DR_TEXTE, drAngabenSpeichern, drDokumentAblegen, drDokumentAendern, drDokumentEntfernen, drDokumentFuerGast, drDokumentLesen,
  drEinladungEntwurf, drEintreten, drGastCodeNeu, drGastEinladen, drGastSperren, drNdaEntwurfPdf, drNdaFreigeben, drNdaPdfFuerGast,
  drNdaPdfLesen, drNdaVorschau, drNdaVorschauPdf, drNdaZeigen, drProjektEntfernen, drProjektSpeichern, drProtokoll, drProtokollCsv,
  drRaeume, drRaumAendern, drRaumAkte, drRaumAnlegen, drSchema, drSitzungGast, drStand, drUnterzeichnen,
  type DrKontext,
} from "../lib/fiaon-datenraum";

const router = Router();
const wache = requireChef("inhaber");

/** IP des Gastes hinter Cloudflare (cf-connecting-ip nur vom Rand von Cloudflare), rohe Kette, Bremsen-Schlüssel, Browser. */
const kontext = (req: Request): DrKontext => {
  const c = drClientIp(req.headers as Record<string, string | string[] | undefined>, req.ip, req.socket?.remoteAddress ?? null);
  return { ip: c.ip, kette: c.kette, anschluss: c.anschluss, ua: String(req.headers["user-agent"] || "").slice(0, 300) };
};
const idAus = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
function keinSpeicher(res: Response): void {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
}
function fehler(res: Response, wo: string, err: unknown): void {
  console.error(`[DATENRAUM] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal versuchen." });
}
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>): void {
  if (!erg.ok) { res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error, ...(erg.fehler ? { fehler: erg.fehler } : {}), ...(erg.code ? { code: erg.code } : {}) }); return; }
  const { ok: _ok, status: _s, ...rest } = erg;
  res.json({ ok: true, ...rest });
}
function pdfSenden(res: Response, pdf: Buffer, dateiname: string, laden: boolean): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", drDispositionKopf(laden ? "attachment" : "inline", dateiname));
  res.setHeader("Content-Length", String(pdf.length));
  res.end(pdf);
}

// ── Sitzung ────────────────────────────────────────────────────────────────
function plaetzchenSetzen(res: Response, gastId: number, version: number): void {
  res.cookie(DR_COOKIE, drTokenBauen(gastId, version, drGeheimnis()), {
    httpOnly: true, sameSite: "strict", path: DR_COOKIE_PFAD, secure: process.env.NODE_ENV === "production", maxAge: DR_SITZUNG_TAGE * 24 * 3600_000,
  });
}
function plaetzchenWeg(res: Response): void {
  res.clearCookie(DR_COOKIE, { path: DR_COOKIE_PFAD, httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
}
async function gastAusSitzung(req: Request) {
  return drSitzungGast(drTokenPruefen((req as any).cookies?.[DR_COOKIE], drGeheimnis()));
}

// ── Gast ───────────────────────────────────────────────────────────────────
router.post("/datenraum/eintreten", async (req, res) => {
  try {
    keinSpeicher(res);
    const ctx = kontext(req);
    const e = await drEintreten(req.body?.code, ctx);
    if (!e.ok) { plaetzchenWeg(res); return antwort(res, e); }
    plaetzchenSetzen(res, e.gastId, e.version);
    const g = await drSitzungGast({ gastId: e.gastId, version: e.version });
    if (!g) return res.status(403).json({ ok: false, error: DR_TEXTE.gesperrt });
    res.json(await drStand(g));
  } catch (err) { fehler(res, "eintreten", err); }
});

router.get("/datenraum/stand", async (req, res) => {
  try {
    keinSpeicher(res);
    const g = await gastAusSitzung(req);
    if (!g) { if ((req as any).cookies?.[DR_COOKIE]) plaetzchenWeg(res); return res.json({ ok: true, angemeldet: false }); }
    res.json(await drStand(g));
  } catch (err) { fehler(res, "stand", err); }
});

router.post("/datenraum/angaben", async (req, res) => {
  try {
    keinSpeicher(res);
    const g = await gastAusSitzung(req);
    if (!g) return res.status(401).json({ ok: false, error: DR_TEXTE.anmelden, code: "ANMELDUNG" });
    antwort(res, await drAngabenSpeichern(g, req.body ?? {}, kontext(req)));
  } catch (err) { fehler(res, "angaben", err); }
});

router.get("/datenraum/nda", async (req, res) => {
  try {
    keinSpeicher(res);
    const g = await gastAusSitzung(req);
    if (!g) return res.status(401).json({ ok: false, error: DR_TEXTE.anmelden, code: "ANMELDUNG" });
    antwort(res, await drNdaZeigen(g, kontext(req)));
  } catch (err) { fehler(res, "nda", err); }
});

router.get("/datenraum/nda-entwurf.pdf", async (req, res) => {
  try {
    keinSpeicher(res);
    if (req.method === "HEAD") return res.status(405).end();
    const g = await gastAusSitzung(req);
    if (!g) return res.status(401).json({ ok: false, error: DR_TEXTE.anmelden, code: "ANMELDUNG" });
    const p = await drNdaEntwurfPdf(g, kontext(req));
    if (!p.ok) return antwort(res, p);
    pdfSenden(res, p.pdf, p.dateiname, req.query.laden === "1");
  } catch (err) { fehler(res, "nda-entwurf", err); }
});

router.post("/datenraum/unterzeichnen", async (req, res) => {
  try {
    keinSpeicher(res);
    const g = await gastAusSitzung(req);
    if (!g) return res.status(401).json({ ok: false, error: DR_TEXTE.anmelden, code: "ANMELDUNG" });
    const u = await drUnterzeichnen(g, req.body ?? {}, kontext(req));
    if (!u.ok) return antwort(res, u);
    const neu = await drSitzungGast({ gastId: g.id, version: g.version });
    res.json({ ...(neu ? await drStand(neu) : { ok: true }), schon: !!u.schon });
  } catch (err) { fehler(res, "unterzeichnen", err); }
});

router.get("/datenraum/dokument/:kennung", async (req, res) => {
  try {
    keinSpeicher(res);
    // Express beantwortet HEAD mit der GET-Route — eine Prüfanfrage ohne Inhalt darf nie als „angesehen“ zählen.
    if (req.method === "HEAD") return res.status(405).end();
    const g = await gastAusSitzung(req);
    const laden = req.query.laden === "1";
    const d = await drDokumentFuerGast(g, String(req.params.kennung ?? ""), laden, kontext(req));
    if (!d.ok) return res.status(d.status).json({ ok: false, error: d.error, code: d.grund.toUpperCase() });
    if (!DR_AUSLIEFERBAR.has(d.mime)) return res.status(415).json({ ok: false, error: "Dieses Dokument lässt sich nicht ausliefern." });
    // Office-Dateien kann kein Browser anzeigen — sie gehen immer als Download.
    const art = laden || !(d.mime === "application/pdf" || d.mime.startsWith("image/")) ? "attachment" : "inline";
    res.setHeader("Content-Type", d.mime);
    res.setHeader("Content-Disposition", drDispositionKopf(art, d.dateiname));
    res.setHeader("Content-Length", String(d.inhalt.length));
    res.setHeader("X-Datenraum-Vorgang", d.vorgang);
    res.end(d.inhalt);
  } catch (err) { fehler(res, "dokument", err); }
});

router.get("/datenraum/nda.pdf", async (req, res) => {
  try {
    keinSpeicher(res);
    if (req.method === "HEAD") return res.status(405).end();
    const g = await gastAusSitzung(req);
    if (!g) return res.status(401).json({ ok: false, error: DR_TEXTE.anmelden, code: "ANMELDUNG" });
    const p = await drNdaPdfFuerGast(g, kontext(req));
    if (!p) return res.status(404).json({ ok: false, error: "Es liegt noch keine unterzeichnete Vereinbarung vor." });
    pdfSenden(res, p.pdf, p.dateiname, req.query.laden === "1");
  } catch (err) { fehler(res, "nda.pdf", err); }
});

router.post("/datenraum/abmelden", async (req, res) => {
  try {
    keinSpeicher(res);
    const g = await gastAusSitzung(req).catch(() => null);
    if (g) await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "abgemeldet" }, kontext(req));
    plaetzchenWeg(res);
    res.json({ ok: true });
  } catch (err) { fehler(res, "abmelden", err); }
});

// ── Verwaltung ─────────────────────────────────────────────────────────────
/** Wer im Chefbüro handelt — Name für Protokoll und „hochgeladen von“. */
async function wer(req: Request): Promise<string> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Chefbüro";
}

const hochladen = multer({ storage: multer.memoryStorage(), limits: { fileSize: DR_DATEI_MAX_BYTES, files: 1, fields: 12, parts: 16 } }).single("datei");
function dateiAnnehmen(req: Request, res: Response, next: NextFunction): void {
  hochladen(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") { res.status(400).json({ ok: false, error: "Die Datei ist größer als 25 MB." }); return; }
    res.status(400).json({ ok: false, error: "Die Datei konnte nicht angenommen werden (eine Datei je Upload)." });
  });
}

router.get("/chef/datenraum", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const firma = idAus(req.query.firma);
    res.json({ ok: true, ...(await drRaeume(firma || null)) });
  } catch (err) { fehler(res, "chef liste", err); }
});

router.get("/chef/datenraum/raum/:id", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const akte = await drRaumAkte(idAus(req.params.id));
    if (!akte) return res.status(404).json({ ok: false, error: "Diesen Datenraum gibt es nicht." });
    res.json({ ok: true, ...akte });
  } catch (err) { fehler(res, "chef akte", err); }
});

router.post("/chef/datenraum/raum", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drRaumAnlegen(req.body ?? {}, await wer(req))); } catch (err) { fehler(res, "raum anlegen", err); }
});
router.post("/chef/datenraum/raum/:id", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drRaumAendern(idAus(req.params.id), req.body ?? {}, await wer(req))); } catch (err) { fehler(res, "raum ändern", err); }
});
router.get("/chef/datenraum/raum/:id/vorschau", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const v = await drNdaVorschau(idAus(req.params.id), idAus(req.query.gast) || null);
    if (!v.ok) return antwort(res, v);
    res.json({ ok: true, bloecke: v.bloecke, hash: v.hash, raumHash: v.raumHash, freigegeben: v.freigegeben, freigabe: v.freigabe });
  } catch (err) { fehler(res, "vorschau", err); }
});
router.get("/chef/datenraum/raum/:id/vorschau.pdf", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const p = await drNdaVorschauPdf(idAus(req.params.id), idAus(req.query.gast) || null, await wer(req));
    if (!p.ok) return antwort(res, p);
    pdfSenden(res, p.pdf, p.dateiname, req.query.laden === "1");
  } catch (err) { fehler(res, "vorschau pdf", err); }
});
router.post("/chef/datenraum/raum/:id/freigeben", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drNdaFreigeben(idAus(req.params.id), await wer(req), req.body?.hash ? String(req.body.hash) : null)); } catch (err) { fehler(res, "freigeben", err); }
});
router.post("/chef/datenraum/raum/:id/projekt", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const pid = idAus(req.body?.id);
    antwort(res, await drProjektSpeichern(idAus(req.params.id), req.body ?? {}, await wer(req), sqlPool, pid || null));
  } catch (err) { fehler(res, "projekt", err); }
});
router.post("/chef/datenraum/projekt/:id/entfernen", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drProjektEntfernen(idAus(req.params.id), await wer(req))); } catch (err) { fehler(res, "projekt entfernen", err); }
});
router.post("/chef/datenraum/raum/:id/gast", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drGastEinladen(idAus(req.params.id), req.body ?? {}, await wer(req))); } catch (err) { fehler(res, "gast einladen", err); }
});
router.post("/chef/datenraum/gast/:id/code", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drGastCodeNeu(idAus(req.params.id), await wer(req))); } catch (err) { fehler(res, "code neu", err); }
});
router.post("/chef/datenraum/gast/:id/sperren", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drGastSperren(idAus(req.params.id), req.body?.sperren !== false, req.body?.grund, await wer(req))); } catch (err) { fehler(res, "sperren", err); }
});
router.post("/chef/datenraum/gast/:id/entwurf", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drEinladungEntwurf(idAus(req.params.id), req.body?.code, await wer(req))); } catch (err) { fehler(res, "entwurf", err); }
});
router.get("/chef/datenraum/gast/:id/protokoll.csv", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    const c = await drProtokollCsv(idAus(req.params.id), await wer(req));
    if (!c) return res.status(404).json({ ok: false, error: "Diesen Gast gibt es nicht." });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", drDispositionKopf("attachment", c.dateiname));
    res.end(c.csv);
  } catch (err) { fehler(res, "protokoll csv", err); }
});
router.post("/chef/datenraum/projekt/:id/dokument", wache, dateiAnnehmen, async (req, res) => {
  try {
    keinSpeicher(res);
    const f = (req as any).file as { buffer: Buffer; originalname: string } | undefined;
    if (!f?.buffer?.length) return res.status(400).json({ ok: false, error: "Bitte eine Datei wählen." });
    antwort(res, await drDokumentAblegen({
      projektId: idAus(req.params.id), buffer: f.buffer, dateiname: f.originalname, titel: req.body?.titel, beschreibung: req.body?.beschreibung,
      sichtbar: String(req.body?.sichtbar ?? "1") !== "0", nr: Number.isInteger(Number(req.body?.nr)) ? Number(req.body.nr) : 0,
      quelle: req.body?.quelle ? String(req.body.quelle) : null,
    }, await wer(req)));
  } catch (err) { fehler(res, "hochladen", err); }
});
router.post("/chef/datenraum/dokument/:id", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drDokumentAendern(idAus(req.params.id), req.body ?? {}, await wer(req))); } catch (err) { fehler(res, "dokument ändern", err); }
});
router.post("/chef/datenraum/dokument/:id/entfernen", wache, async (req, res) => {
  try { keinSpeicher(res); antwort(res, await drDokumentEntfernen(idAus(req.params.id), await wer(req))); } catch (err) { fehler(res, "dokument entfernen", err); }
});
router.get("/chef/datenraum/dokument/:id", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    if (req.method === "HEAD") return res.status(405).end();
    const d = await drDokumentLesen(idAus(req.params.id), await wer(req), kontext(req));
    if (!d) return res.status(404).json({ ok: false, error: "Dieses Dokument gibt es nicht." });
    if (!DR_AUSLIEFERBAR.has(d.mime)) return res.status(415).json({ ok: false, error: "Dieses Dokument lässt sich nicht ausliefern." });
    const art = req.query.laden === "1" || !(d.mime === "application/pdf" || d.mime.startsWith("image/")) ? "attachment" : "inline";
    res.setHeader("Content-Type", d.mime);
    res.setHeader("Content-Disposition", drDispositionKopf(art, d.dateiname));
    res.end(d.inhalt);
  } catch (err) { fehler(res, "chef dokument", err); }
});
router.get("/chef/datenraum/nda/:id", wache, async (req, res) => {
  try {
    keinSpeicher(res);
    if (req.method === "HEAD") return res.status(405).end();
    const p = await drNdaPdfLesen(idAus(req.params.id), await wer(req), kontext(req));
    if (!p) return res.status(404).json({ ok: false, error: "Diese Vereinbarung gibt es nicht." });
    pdfSenden(res, p.pdf, p.dateiname, req.query.laden === "1");
  } catch (err) { fehler(res, "chef nda", err); }
});

export { drSchema as ensureDatenraumTabellen };
export default router;
