// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO — Routen (06.10.2026, E-294)
//
// Justin: „alles über die Plattform steuern: Claude spielt die Posts ein, wir
// prüfen, bearbeiten und posten dort". Eingehängt unter /api/fiaon (routes.ts,
// gleich nach dem Mara-Steuerpult). Bewusst NICHT unter /api/admin: dort fängt
// der ARAS-Router (admin.ts: router.use(requireAdmin)) jede Anfrage ab.
//
//   POST /social/import                     Claude spielt einen Post ein
//                                           (Bearer SOCIAL_IMPORT_TOKEN — darf NUR das)
//   GET  /chef/social/plan?von&bis          Plan (Karten, Zähler, Hinweise, heute, bei Claude)
//   GET  /chef/social/zaehler               nur die Zähler je Status (Zahlmarke am Reiter)
//   GET  /chef/social/post/:id              Post-Detail
//   GET  /chef/social/datei/:id[?download=1] Bytes mit Range (206) für Safari-Video
//   GET  /chef/social/post/:id/zip          alle Dateien in Upload-Reihenfolge
//   POST /chef/social/post/:id/<aktion>     freigeben | zurueck | verschieben |
//                                           veroeffentlicht | verwerfen | ki-haken | checkliste
//   GET  /chef/social/vorschau/instagram?tage=0|7|30&marke=alle|fiaon|global
//   POST /chef/social/post/:id/web-varianten  E-296: kleine Web-Bilder (480 px JPEG) aus dem Studio
//
// ÖFFENTLICH (E-296, Website-Feed — ohne Anmeldung, Vertrag shared/fiaon-sozial-feed.ts):
//   GET  /social/feed?marke&thema&n        sichtbare Posts + Profile; Fehler → 200 mit leerer Liste
//   GET  /social/bild/:dateiId             NUR Bilder sichtbarer Posts (Regel bei jeder Anfrage in SQL)
//
// Rechte: alle Studio-Wege ab Stufe Geschäftsführung (requireChef). „Trotzdem
// freigeben" bei rotem Wort-Check prüft der Server selbst auf Inhaber. Jede
// Aktion zusätzlich mit chefProtokoll (Ziel social:<id>, vorher→nachher); Token-
// Importe (nicht die Proben) schreiben ebenfalls ins fiaon_admin_log.
//
// Speicher (Prüfung 06.10.2026): EIN Render-Prozess trägt die ganze Plattform
// (Telefonie, Mara, Zahlungen). Deshalb: Gesamtgrenze je Import, Importe global
// nacheinander, Dateien eine nach der anderen; Auslieferung ohne Range und ZIP in
// 8-MB-Stücken mit Rückdruck — nie eine ganze große Datei samt Hex-Kopie im RAM.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual, createHash } from "crypto";
import { Readable } from "stream";
import multer from "multer";
import os from "os";
import fs from "fs";
import { ZipArchive } from "archiver";
import { requireChef, chefProtokoll, protokollSchreiben, type ChefRequest } from "./fiaon-chef-zugang";
import {
  ensureSocialTabellen, socialImport, socialAktion, postLaden, planLaden, instagramVorschau, postDateienFuerZip,
  ichLaden, statusZaehler, webVariantenSpeichern, SocialFehlerWurf, type SocialHandelnder, type WebVarianteEingang,
} from "../lib/fiaon-social";
import { dateiKopf, dateiLesen, dateiStuecke, downloadName, STUECK_BYTES } from "../lib/fiaon-social-dateien";
import { sozialFeed, sozialFeedLeer, sozialFeedLeeren, websiteBild } from "../lib/fiaon-sozial-feed";
import { SOZIAL_FEED_PFAD } from "@shared/fiaon-sozial-feed";
import { fensterDrossel } from "../lib/fiaon-global-bereich-regeln";
import { aufrufClientIp } from "../lib/fiaon-global-angebot-aufrufe";
import {
  manifestPruefen, istVerworfenerOrdner, SOCIAL_AKTIONEN, IMPORT_MAX_DATEI_BYTES, IMPORT_MAX_DATEIEN, IMPORT_MAX_META_BYTES,
  IMPORT_MAX_GESAMT_BYTES, IMPORT_TOKEN_MIN, WEB_480_MAX_BYTES,
  type SocialAktion,
} from "@shared/fiaon-social";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

function fehlerSenden(res: Response, e: unknown, wo: string) {
  if (e instanceof SocialFehlerWurf) return res.status(e.status).json({ ok: false, error: e.message, code: e.code, ...e.extra });
  console.error(`[SOCIAL] ${wo}:`, e);
  return res.status(500).json({ ok: false, error: "Das hat nicht geklappt — bitte noch einmal. Der Fehler steht im Server-Log." });
}

/** Ids nur im INTEGER-Bereich — sonst meldet Postgres einen Überlauf und es gäbe eine 500. */
const idAus = (req: Request): number | null => {
  const n = Number(req.params.id);
  return Number.isInteger(n) && n > 0 && n <= 2_147_483_647 ? n : null;
};

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT — POST /social/import
// ═══════════════════════════════════════════════════════════════════════════
// Zugang: Authorization: Bearer <SOCIAL_IMPORT_TOKEN>, Vergleich per
// timingSafeEqual, kein Rückfall im Code (Muster fiaon-admin-wache.ts). Ohne
// gesetzten ENV-Wert antwortet die Route 503 — ein Import ohne Schlüssel ist
// nicht eingerichtet, nicht offen. Ohne Authorization-Kopf gilt die Chef-Sitzung
// (ab GF) — für den späteren Knopf „Ordner hochladen". Der Token gilt NUR hier;
// jede andere Social-Route kennt ihn nicht.
// Je Post zwei Anfragen (Probe + Import): 120 je Minute reichen für 60 Posts am Stück.
// fensterDrossel liefert true = „zu viel“.
const importZuViel = fensterDrossel(120, 60_000);
// Falsche Schlüssel: höchstens 10 je Minute und IP. Gezählt werden NUR Fehlversuche;
// ab dem zehnten gibt es 429, bevor überhaupt verglichen wird.
const FEHL_MAX = 10;
const fehlJeIp = new Map<string, number[]>();
function fehlZahl(ip: string, jetzt = Date.now()): number {
  const l = (fehlJeIp.get(ip) ?? []).filter((t) => jetzt - t < 60_000);
  if (l.length) fehlJeIp.set(ip, l); else fehlJeIp.delete(ip);
  return l.length;
}
function fehlMerken(ip: string, jetzt = Date.now()) {
  fehlJeIp.set(ip, [...(fehlJeIp.get(ip) ?? []).filter((t) => jetzt - t < 60_000), jetzt]);
  if (fehlJeIp.size > 5000) for (const k of Array.from(fehlJeIp.keys())) fehlZahl(k, jetzt);
}

/**
 * Vergleich über die sha256-Digests beider Seiten: gleich lang, damit verrät auch
 * die Laufzeit nicht die Länge des Schlüssels. Zu kurze Schlüssel gelten als nicht
 * eingerichtet (importZugang antwortet dann 503).
 */
function tokenPasst(kopf: string): boolean {
  const soll = process.env.SOCIAL_IMPORT_TOKEN || "";
  if (soll.length < IMPORT_TOKEN_MIN) return false;
  const a = createHash("sha256").update(kopf, "utf8").digest();
  const b = createHash("sha256").update(soll, "utf8").digest();
  return timingSafeEqual(a, b);
}

function importZugang(req: Request, res: Response, next: NextFunction) {
  const auth = String(req.headers.authorization || "");
  if (auth) {
    const ip = String(req.ip || req.socket?.remoteAddress || "—");
    if (fehlZahl(ip) >= FEHL_MAX) {
      return res.status(429).json({ ok: false, error: "Zu viele falsche Import-Schlüssel — bitte eine Minute warten." });
    }
    if (!/^Bearer\s+\S+$/i.test(auth)) { fehlMerken(ip); return res.status(401).json({ ok: false, code: "TOKEN_FALSCH", error: "Der Zugang ist ungültig. Erwartet: Authorization: Bearer <Token>." }); }
    const soll = process.env.SOCIAL_IMPORT_TOKEN || "";
    if (soll.length < IMPORT_TOKEN_MIN) {
      return res.status(503).json({ ok: false, code: "IMPORT_NICHT_EINGERICHTET", error: soll
        ? `Der Import ist auf diesem Server nicht sicher eingerichtet (SOCIAL_IMPORT_TOKEN ist kürzer als ${IMPORT_TOKEN_MIN} Zeichen).`
        : "Der Import ist auf diesem Server nicht eingerichtet (SOCIAL_IMPORT_TOKEN fehlt)." });
    }
    if (!tokenPasst(auth.replace(/^Bearer\s+/i, "").trim())) {
      fehlMerken(ip);
      // Ohne Inhalt des Schlüssels — nur, dass und von wo.
      console.warn(`[SOCIAL] Import mit falschem Schlüssel von ${ip}`);
      return res.status(401).json({ ok: false, code: "TOKEN_FALSCH", error: "Der Import-Schlüssel stimmt nicht." });
    }
    if (importZuViel("token")) return res.status(429).json({ ok: false, error: "Zu viele Importe in kurzer Zeit — bitte eine Minute warten." });
    (req as any).socialWer = { von: "import-token", name: "Claude (Import)", agentId: null, stufe: "import" } satisfies SocialHandelnder;
    return next();
  }
  return wache(req as ChefRequest, res, () => {
    const c = (req as ChefRequest).chef!;
    if (importZuViel(`chef:${c.agentId ?? "alt"}`)) return res.status(429).json({ ok: false, error: "Zu viele Importe in kurzer Zeit — bitte eine Minute warten." });
    (req as any).socialWer = { von: c.agentId ? `chef:${c.agentId}` : "inhaber", name: c.agentId ? `Chef #${c.agentId}` : "Inhaber", agentId: c.agentId, stufe: c.stufe } satisfies SocialHandelnder;
    next();
  });
}

// Dateien auf die Platte (tmp), nicht in den Arbeitsspeicher: Reels haben 12–30 MB.
// Gelesen wird danach im Import EINE Datei nach der anderen (socialImport → dateiSchreiben),
// nie alle auf einmal. Gesamtgrenze je Anfrage: IMPORT_MAX_GESAMT_BYTES (120 MB).
const importUpload = multer({
  storage: multer.diskStorage({ destination: os.tmpdir(), filename: (_req, _f, cb) => cb(null, `fiaon-social-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`) }),
  limits: { fileSize: IMPORT_MAX_DATEI_BYTES, files: IMPORT_MAX_DATEIEN, fields: 8, parts: IMPORT_MAX_DATEIEN + 8, fieldSize: IMPORT_MAX_META_BYTES },
}).fields([{ name: "dateien", maxCount: IMPORT_MAX_DATEIEN }]);

/** Gesamtgröße schon VOR multer prüfen (Content-Length) und während des Lesens mitzählen. */
const GESAMT_MB = IMPORT_MAX_GESAMT_BYTES / 1024 / 1024;
const ZU_GROSS_GESAMT = `Der Import ist größer als ${GESAMT_MB} MB — bitte weniger oder kleinere Dateien je Post.`;
function importAnnehmen(req: Request, res: Response, next: NextFunction) {
  const laenge = Number(req.headers["content-length"]);
  // Spielraum für meta, caption, alt und die multipart-Rahmen.
  const grenze = IMPORT_MAX_GESAMT_BYTES + IMPORT_MAX_META_BYTES * 4;
  if (Number.isFinite(laenge) && laenge > grenze) return res.status(413).json({ ok: false, code: "ZU_GROSS", error: ZU_GROSS_GESAMT });
  if (!Number.isFinite(laenge)) {
    // Ohne Content-Length (chunked): mitzählen und hart abbrechen, sobald es zu viel wird.
    let gelesen = 0;
    req.on("data", (c: Buffer) => { gelesen += c.length; if (gelesen > grenze) req.destroy(new Error("ZU_GROSS")); });
  }
  importUpload(req, res, (err: any) => {
    if (!err) {
      const summe = hochgeladen(req).reduce((n, f) => n + (f.size || 0), 0);
      if (summe > IMPORT_MAX_GESAMT_BYTES) { aufraeumen(req); return res.status(413).json({ ok: false, code: "ZU_GROSS", error: ZU_GROSS_GESAMT }); }
      return next();
    }
    aufraeumen(req);
    if (res.headersSent || req.destroyed) return;
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ ok: false, code: "ZU_GROSS", error: `Eine Datei ist größer als ${IMPORT_MAX_DATEI_BYTES / 1024 / 1024} MB.` });
    if (err.code === "LIMIT_FILE_COUNT") return res.status(413).json({ ok: false, code: "ZU_GROSS", error: `Höchstens ${IMPORT_MAX_DATEIEN} Dateien je Post.` });
    if (err.code === "LIMIT_FIELD_VALUE") return res.status(413).json({ ok: false, code: "ZU_GROSS", error: `Ein Textfeld ist größer als ${IMPORT_MAX_META_BYTES / 1024} KB.` });
    if (err.code === "LIMIT_UNEXPECTED_FILE") return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Dateien bitte im Feld „dateien“ schicken." });
    return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Die Anfrage ließ sich nicht lesen (multipart/form-data mit meta, caption, alt, dateien erwartet)." });
  });
}

function hochgeladen(req: Request): Express.Multer.File[] {
  const f = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
  return f?.dateien ?? [];
}
function aufraeumen(req: Request) {
  for (const f of hochgeladen(req)) if (f.path) fs.promises.unlink(f.path).catch(() => {});
}

// Importe GLOBAL nacheinander (nicht nur je extern_id): zwei große Importe parallel
// hießen zwei große Dateien samt Hex-Kopie gleichzeitig im Speicher. Wer wartet, liegt
// mit seinen Dateien auf der Platte, nicht im RAM. Mehr als 6 Wartende: 429.
let importKette: Promise<unknown> = Promise.resolve();
let importWartend = 0;
function nacheinander<T>(f: () => Promise<T>): Promise<T> {
  importWartend++;
  const p = importKette.then(() => { importWartend--; return f(); }, () => { importWartend--; return f(); });
  importKette = p.catch(() => undefined);
  return p;
}

router.post("/social/import", importZugang, importAnnehmen, async (req: Request, res: Response) => {
  try {
    if (importWartend >= 6) return res.status(429).json({ ok: false, error: "Gerade laufen schon mehrere Importe — bitte gleich noch einmal." });
    const body = (req.body ?? {}) as Record<string, unknown>;
    const metaText = typeof body.meta === "string" ? body.meta : "";
    if (!metaText) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Das Feld „meta“ (Inhalt von meta.json) fehlt." });
    let metaRoh: unknown;
    try { metaRoh = JSON.parse(metaText); } catch { return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "„meta“ ist kein gültiges JSON." }); }
    const p = manifestPruefen(metaRoh);
    if (!p.ok) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: p.fehler.join(" "), fehler: p.fehler });
    const ordner = typeof body.ordner === "string" && body.ordner.trim() ? body.ordner.trim().slice(0, 300) : null;
    if (istVerworfenerOrdner(ordner)) return res.status(422).json({ ok: false, code: "VERWORFENER_ORDNER", error: "Ordner mit „_verworfen“ werden nie importiert." });
    const caption = typeof body.caption === "string" ? body.caption : "";
    if (!caption.trim() && p.manifest.format !== "story") return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Das Feld „caption“ (CAPTION.txt) fehlt." });
    const altRoh = typeof body.alt === "string" ? body.alt : typeof body.alt_text === "string" ? body.alt_text : "";
    // Nur Pfade weitergeben — gelesen wird im Import, eine Datei nach der anderen.
    const dateien = hochgeladen(req).map((f) => ({
      // multer liefert originalname als latin1 — Dateinamen mit Umlaut zurück nach UTF-8.
      name: Buffer.from(String(f.originalname || ""), "latin1").toString("utf8"),
      pfad: f.path,
    }));
    const probe = req.query.probe === "1" || req.query.probe === "true";
    const wer = (req as any).socialWer as SocialHandelnder;
    const r = await nacheinander(() => socialImport({
      manifest: p.manifest, metaRoh, warnungen: p.warnungen, caption: caption.replace(/\r\n?/g, "\n"),
      altText: altRoh.trim() ? altRoh.replace(/\r\n?/g, "\n") : null, dateien, ordner, probe, wer,
    }));
    if (!probe && r.antwort.id) {
      sozialFeedLeeren();
      // Ein Ort für das Audit: Chef-Importe über chefProtokoll, Token-Importe direkt ins fiaon_admin_log.
      if (wer?.von === "import-token") await protokollSchreiben(null, "import", "POST", "/api/fiaon/social/import", `social:${r.antwort.id}`, `import ${r.antwort.ergebnis} (Token) ${p.manifest.id} Fassung ${r.antwort.fassung}`);
      else void chefProtokoll(req, `social:${r.antwort.id}`, `import ${r.antwort.ergebnis}`);
    }
    return res.status(r.status).json(r.antwort);
  } catch (e) {
    return fehlerSenden(res, e, "Import");
  } finally {
    aufraeumen(req);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STUDIO — /chef/social/*
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/social/plan", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ich = await ichLaden(req.chef);
    return res.json(await planLaden(req.query.von, req.query.bis, ich));
  } catch (e) { return fehlerSenden(res, e, "Plan"); }
});

router.get("/chef/social/zaehler", wache, async (req: ChefRequest, res: Response) => {
  try {
    await ichLaden(req.chef);
    return res.json({ ok: true, zaehler: await statusZaehler() });
  } catch (e) { return fehlerSenden(res, e, "Zähler"); }
});

router.get("/chef/social/post/:id", wache, async (req: ChefRequest, res: Response) => {
  const id = idAus(req);
  if (!id) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Ungültige Post-Nummer." });
  try {
    const ich = await ichLaden(req.chef);
    const post = await postLaden(id, ich);
    if (!post) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Post gibt es nicht (mehr)." });
    return res.json({ ok: true, ich, post });
  } catch (e) { return fehlerSenden(res, e, "Post"); }
});

router.get("/chef/social/vorschau/instagram", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ich = await ichLaden(req.chef);
    return res.json(await instagramVorschau(req.query.tage, req.query.marke, ich));
  } catch (e) { return fehlerSenden(res, e, "Instagram-Vorschau"); }
});

/**
 * Bytes einer Datei. Range-fähig (206), sonst spielt Safari am iPhone keine
 * Videos und man kann nicht spulen. ETag = sha256 (304 bei If-None-Match).
 * Nur über die Chef-Sitzung — unveröffentlichte Posts sind nicht öffentlich.
 *
 * Prüfung 06.10.2026:
 *   · Jede Spanne höchstens 8 MB (Content-Range nennt das gelieferte Stück; Safari
 *     und Chrome fragen nach). Ohne Range: in 8-MB-Stücken mit Rückdruck ('drain').
 *   · Range-Köpfe, die nicht passen (mehrteilig, kaputt), werden ignoriert → 200.
 *     416 nur bei gültiger, aber unerfüllbarer Spanne (RFC 9110).
 *   · Cache-Control „private, no-cache“: auf geteilten Büro-Rechnern liegt nach dem
 *     Abmelden nichts einen Tag im Cache; das ETag sorgt weiter für 304.
 *   · CSP „sandbox“ als zweite Schicht für inline ausgelieferte PDFs.
 *   · Download-Name aus dem jsonb-Eintrag des Posts (pos/rolle), nicht aus der
 *     Datei-Zeile — die zeigt bei doppelter sha256 den letzten Eintrag.
 */
async function dateiAusliefern(req: ChefRequest, res: Response, nurKopf: boolean) {
  const id = idAus(req);
  if (!id) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Ungültige Datei-Nummer." });
  try {
    await ensureSocialTabellen();
    const k = await dateiKopf(id);
    if (!k || k.geleert || k.ablage !== "db") return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diese Datei gibt es nicht (mehr)." });
    const etag = `"${k.sha256}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src 'self'; media-src 'self'");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Content-Type", k.mime);
    if (req.query.download === "1") {
      let name = k.dateiname;
      if (k.post_id) {
        const z = await postDateienFuerZip(k.post_id);
        if (z) {
          const bilder = z.dateien.filter((d) => d.rolle === "bild").length;
          const eintrag = z.dateien.find((d) => Number(d.datei_id) === id);
          name = downloadName(z.extern_id, eintrag?.pos ?? k.pos, eintrag?.rolle ?? k.rolle, k.mime, bilder);
        }
      }
      res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
    }
    if (String(req.headers["if-none-match"] || "") === etag && !req.headers.range) return res.status(304).end();
    const range = String(req.headers.range || "").trim();
    const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
    if (m && (m[1] !== "" || m[2] !== "")) {
      let von: number, bis: number;
      if (m[1] === "") { const n = Number(m[2]); von = Math.max(0, k.bytes - n); bis = k.bytes - 1; if (n === 0) von = k.bytes; }
      else { von = Number(m[1]); bis = m[2] === "" ? k.bytes - 1 : Math.min(Number(m[2]), k.bytes - 1); }
      if (!Number.isSafeInteger(von) || !Number.isSafeInteger(bis) || von > bis || von >= k.bytes) {
        res.setHeader("Content-Range", `bytes */${k.bytes}`);
        return res.status(416).end();
      }
      // JEDE Spanne höchstens ein Stück (8 MB) — auch ausdrückliche wie bytes=0-41943039.
      if (bis - von + 1 > STUECK_BYTES) bis = von + STUECK_BYTES - 1;
      res.status(206);
      res.setHeader("Content-Range", `bytes ${von}-${bis}/${k.bytes}`);
      res.setHeader("Content-Length", String(bis - von + 1));
      if (nurKopf) return res.end();
      const stueck = await dateiLesen(id, { von, bis });
      if (!stueck) return res.status(404).end();
      return res.end(stueck);
    }
    // Kein (brauchbarer) Range-Kopf: die ganze Datei, aber in Stücken mit Rückdruck.
    res.status(200);
    res.setHeader("Content-Length", String(k.bytes));
    if (nurKopf) return res.end();
    let weg = false;
    res.on("close", () => { weg = true; });
    for await (const stueck of dateiStuecke(id, k.bytes)) {
      if (weg) return;
      if (!res.write(stueck)) await new Promise<void>((ok) => { res.once("drain", ok); res.once("close", ok); });
    }
    return res.end();
  } catch (e) {
    if (!res.headersSent) return fehlerSenden(res, e, "Datei");
    console.error("[SOCIAL] Datei:", e);
    try { res.destroy(); } catch { /* weg */ }
  }
}
router.head("/chef/social/datei/:id", wache, (req: ChefRequest, res: Response) => dateiAusliefern(req, res, true));
router.get("/chef/social/datei/:id", wache, (req: ChefRequest, res: Response) => dateiAusliefern(req, res, false));

/**
 * ZIP in Upload-Reihenfolge, Dateinamen mit Foliennummer. Jede Datei hängt als
 * Readable an, der sie erst beim Lesen in 8-MB-Stücken aus der DB holt — archiver
 * zieht nur, was der Browser abnimmt (Rückdruck). Bricht der Download ab, hört das
 * Lesen auf (archive.abort()).
 */
router.get("/chef/social/post/:id/zip", wache, async (req: ChefRequest, res: Response) => {
  const id = idAus(req);
  if (!id) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Ungültige Post-Nummer." });
  try {
    const z = await postDateienFuerZip(id);
    if (!z) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Diesen Post gibt es nicht (mehr)." });
    if (!z.dateien.length) return res.status(404).json({ ok: false, code: "NICHT_GEFUNDEN", error: "Dieser Post hat keine Dateien." });
    const bilder = z.dateien.filter((d) => d.rolle === "bild").length;
    const name = `${z.extern_id.replace(/[^a-zA-Z0-9._-]/g, "_")}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    res.setHeader("Cache-Control", "private, no-store");
    const archive = new ZipArchive({ zlib: { level: 0 } }); // JPEG/MP4 sind schon gepackt
    let weg = false;
    res.on("close", () => { if (!res.writableFinished) { weg = true; try { archive.abort(); } catch { /* schon zu */ } } });
    archive.on("error", (err: Error) => { if (!weg) console.error("[SOCIAL] ZIP:", err); try { res.end(); } catch { /* weg */ } });
    archive.pipe(res);
    const namen = new Set<string>();
    for (const d of [...z.dateien].sort((a, b) => a.pos - b.pos)) {
      const kopf = await dateiKopf(Number(d.datei_id));
      if (!kopf || kopf.geleert || kopf.ablage !== "db") continue;
      let n = downloadName(z.extern_id, d.pos, d.rolle, d.mime, bilder);
      if (namen.has(n)) n = n.replace(/(\.[a-z0-9]+)$/, `_${d.pos}$1`);
      namen.add(n);
      const quelle = Readable.from((async function* () {
        for await (const stueck of dateiStuecke(kopf.id, kopf.bytes)) {
          if (weg) return;
          yield stueck;
        }
      })(), { objectMode: false, highWaterMark: 1 });
      archive.append(quelle, { name: n });
    }
    if (!weg) await archive.finalize();
  } catch (e) {
    if (!res.headersSent) return fehlerSenden(res, e, "ZIP");
    console.error("[SOCIAL] ZIP:", e);
    try { res.end(); } catch { /* weg */ }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// E-296 · KLEINE WEB-BILDER — POST /chef/social/post/:id/web-varianten
// ═══════════════════════════════════════════════════════════════════════════
// multipart/form-data, je Datei ein Feld, dessen NAME die id des Originals ist
// (quelle_id), Inhalt ein 480 px breites JPEG aus dem Studio (canvas). Im Speicher
// (je Bild ≤ 1 MB, höchstens 14) — kein Platten-Umweg nötig. MUSS vor der
// allgemeinen Aktions-Route stehen, sonst wäre „web-varianten“ eine unbekannte Aktion.
const webUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: WEB_480_MAX_BYTES, files: IMPORT_MAX_DATEIEN, fields: 4, parts: IMPORT_MAX_DATEIEN + 4 },
}).any();
router.post("/chef/social/post/:id/web-varianten", wache, (req: Request, res: Response, next: NextFunction) => {
  webUpload(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ ok: false, code: "ZU_GROSS", error: `Ein kleines Bild ist größer als ${Math.round(WEB_480_MAX_BYTES / 1024)} KB.` });
    if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_PART_COUNT") return res.status(413).json({ ok: false, code: "ZU_GROSS", error: `Höchstens ${IMPORT_MAX_DATEIEN} kleine Bilder auf einmal.` });
    return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Die Anfrage ließ sich nicht lesen (multipart/form-data, je Bild ein Feld mit der id des Originals)." });
  });
}, async (req: ChefRequest, res: Response) => {
  const id = idAus(req);
  if (!id) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Ungültige Post-Nummer." });
  try {
    const ich = await ichLaden(req.chef);
    const dateien = ((req as any).files ?? []) as Express.Multer.File[];
    const eingang: WebVarianteEingang[] = dateien.map((f) => ({ quelle_id: Number(String(f.fieldname).replace(/^quelle[_-]?/, "")), inhalt: f.buffer }));
    const r = await webVariantenSpeichern(id, eingang, ich);
    if (r.angelegt.length) {
      sozialFeedLeeren();
      void chefProtokoll(req, `social:${id}`, `web-varianten: ${r.angelegt.length} angelegt${r.fehler.length ? `, ${r.fehler.length} abgelehnt` : ""}`);
    }
    return res.json({ ok: true, ...r });
  } catch (e) { return fehlerSenden(res, e, "Web-Bilder"); }
});

router.post("/chef/social/post/:id/:aktion", wache, async (req: ChefRequest, res: Response) => {
  const id = idAus(req);
  const aktion = String(req.params.aktion) as SocialAktion;
  if (!id) return res.status(400).json({ ok: false, code: "UNGUELTIG", error: "Ungültige Post-Nummer." });
  if (!(SOCIAL_AKTIONEN as readonly string[]).includes(aktion)) return res.status(404).json({ ok: false, code: "UNGUELTIG", error: "Diese Aktion gibt es nicht." });
  try {
    const ich = await ichLaden(req.chef);
    const r = await socialAktion(id, aktion, req.body, ich);
    // Jede Aktion kann die Website betreffen (Schalter, Status, Termin) — der Feed liest beim nächsten Abruf neu.
    sozialFeedLeeren();
    void chefProtokoll(req, r.ziel, `${aktion}: ${r.notiz}`);
    const post = await postLaden(id, ich);
    return res.json({ ok: true, post, meldung: r.meldung });
  } catch (e) { return fehlerSenden(res, e, `Aktion ${aktion}`); }
});

// ═══════════════════════════════════════════════════════════════════════════
// E-296 · ÖFFENTLICH: WEBSITE-FEED UND BILDER (ohne Anmeldung)
// ═══════════════════════════════════════════════════════════════════════════
// Die Website darf nie brechen: Jeder Fehler im Feed wird geloggt und als 200 mit
// leerer Liste beantwortet (die Seite zeigt dann nur die Profile). Bilder: nur,
// was die Regel JETZT erlaubt (websiteBild, frisch in SQL), sonst 404 — ohne zu
// verraten, ob es die Datei gibt. Drossel je Besucher-IP gegen Abgrasen der Bild-ids.
const FEED_ROUTE = SOZIAL_FEED_PFAD.replace(/^\/api\/fiaon/, "");
// Großzügig (Mobilfunk-NAT: viele Besucher hinter einer IP); Wiederholungen kommen ohnehin aus dem Browser-Cache.
const bildZuViel = fensterDrossel(1200, 60_000);

router.get(FEED_ROUTE, async (req: Request, res: Response) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  try {
    const antwort = await sozialFeed({ marke: req.query.marke, thema: req.query.thema, n: req.query.n });
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.json(antwort);
  } catch (e) {
    console.error("[SOCIAL] Website-Feed:", e);
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).json(sozialFeedLeer());
  }
});

async function websiteBildAusliefern(req: Request, res: Response, nurKopf: boolean) {
  const id = idAus(req);
  // Fehlerantworten nie zwischenspeichern (auch nicht in Cloudflare) und ohne die Kopfzeilen eines Bildes.
  const nichtDa = () => {
    for (const k of ["ETag", "Content-Length", "Content-Type", "Content-Security-Policy", "Cross-Origin-Resource-Policy"]) res.removeHeader(k);
    res.setHeader("Cache-Control", "no-store");
    return res.status(404).json({ ok: false, error: "Dieses Bild gibt es nicht." });
  };
  if (!id) return nichtDa();
  // Prüfung 06.10.2026: NICHT req.ip — hinter Cloudflare ist das der Rand (141.101.x.x), alle Besucher dahinter
  // teilten sich sonst einen Topf. Dieselbe Quelle wie fiaon-global-angebot (cf-connecting-ip zuerst).
  const ip = aufrufClientIp(req) || "—";
  if (bildZuViel(ip)) { res.setHeader("Retry-After", "60"); res.setHeader("Cache-Control", "no-store"); return res.status(429).json({ ok: false, error: "Zu viele Anfragen — bitte kurz warten." }); }
  try {
    const k = await websiteBild(id);
    if (!k) return nichtDa();
    const etag = `"${k.sha256}"`;
    const bildKoepfe = () => {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
      // Nur für die eigenen Seiten — fremde Seiten binden die Bilder nicht ein.
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("Content-Type", k.mime);
    };
    if (String(req.headers["if-none-match"] || "") === etag) { bildKoepfe(); return res.status(304).end(); }
    if (nurKopf) { bildKoepfe(); res.setHeader("Content-Length", String(k.bytes)); return res.status(200).end(); }
    // Erst das erste Stück lesen, DANN Status und Cache-Kopfzeilen setzen (Prüfung 06.10.2026): Bricht die
    // Datenbank vorher ab, geht ein 404 mit no-store hinaus — nie ein Fehler mit „public, max-age=86400“.
    const stuecke = dateiStuecke(k.id, k.bytes)[Symbol.asyncIterator]();
    const erstes = await stuecke.next();
    // Kein einziges Stück (Inhalt fehlt trotz Kopfzeile): kein halbes Bild mit falscher Länge, sondern 404.
    if (erstes.done) return nichtDa();
    bildKoepfe();
    res.setHeader("Content-Length", String(k.bytes));
    res.status(200);
    let weg = false;
    res.on("close", () => { weg = true; });
    for (let x: IteratorResult<Buffer> = erstes; !x.done; x = await stuecke.next()) {
      if (weg) { await stuecke.return?.(undefined); return; }
      if (!res.write(x.value)) await new Promise<void>((ok) => { res.once("drain", ok); res.once("close", ok); });
    }
    return res.end();
  } catch (e) {
    console.error("[SOCIAL] Website-Bild:", e);
    if (!res.headersSent) return nichtDa();
    try { res.destroy(); } catch { /* weg */ }
  }
}
router.head("/social/bild/:id", (req: Request, res: Response) => websiteBildAusliefern(req, res, true));
router.get("/social/bild/:id", (req: Request, res: Response) => websiteBildAusliefern(req, res, false));

export default router;
