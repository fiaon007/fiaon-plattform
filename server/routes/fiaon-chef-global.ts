// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL — der Arbeitsraum für die Firmenkunden (E-338, 12.10.2026)
//
// Justin: „unser gesamtes Admin Dashboard braucht eine Global Seite, worüber
//          wir arbeiten können, alles perfekt 100 % synchron … Firmendokumente
//          hochladen, wenn Post kommt, Funding-Verträge, Bankverträge, Steuern …
//          100 % FUNKTIONAL!"
//
// Jede Route schreibt über dieselben Funktionen wie Office (/agent/global) und
// Portal — fiaon-global-bereich.ts und fiaon-global-mandat.ts. Es gibt keine
// zweite Wahrheit. Mount: /api/fiaon, Wand: requireChef (leitung; Portal-
// Freischaltung nur Inhaber).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response, type NextFunction, type Request } from "express";
import multer from "multer";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  globalEtappeSetzen, globalNaechsterSchrittSetzen, globalBereichStichtag, globalFristAnlegen, globalFristAendern, globalFristLoeschen,
  globalNotizSchreiben, globalDokumentLesen, globalDokumentEntfernen, globalZugangSenden, globalAbschliessen, type BereichAgent, type DateiEin,
} from "../lib/fiaon-global-bereich";
import {
  globalMandateListe, globalMandatChefSicht, globalSchrittSetzen, globalGesellschaftPlusSetzen, globalKapitalSpeichern, globalKapitalEntfernen,
  globalMandatDokument, globalMandatDokumentAendern, globalMandatAntwort, globalMandatAnfragenGelesen, globalMandatTest, globalMandatPortal,
  globalVorschauLink, globalKundenLink,
} from "../lib/fiaon-global-mandat";
import { GLOBAL_DATEI_MAX_BYTES, globalDateinameKopf, globalMimeAuslieferbar } from "../lib/fiaon-global-bereich-regeln";

const router = Router();

/** Wer im Chefbüro handelt — als „Mitarbeiter" für Verlauf und Aufgaben. */
async function wer(req: Request): Promise<BereichAgent> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a) return { id: Number(a.id), name: String(a.name || "Chefbüro") };
  }
  return { id: 0, name: "Chefbüro" };
}
const ref = (req: Request) => String(req.params.ref || "").trim().toUpperCase();

function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error });
  const { ok: _ok, ...rest } = erg;
  return res.json({ ok: true, ...rest });
}
function fehler(res: Response, wo: string, err: unknown) {
  console.error(`[CHEF-GLOBAL] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler — bitte gleich noch einmal versuchen." });
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: GLOBAL_DATEI_MAX_BYTES, files: 1, fields: 16, parts: 20 } })
  .fields([{ name: "datei", maxCount: 1 }]);
function dateiAnnehmen(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return res.status(400).json({ ok: false, error: "Die Datei ist größer als 15 MB." });
    return res.status(400).json({ ok: false, error: "Die Datei konnte nicht angenommen werden (eine Datei je Upload)." });
  });
}
function dateiAus(req: Request): DateiEin | null {
  const f = ((req as any).files as Record<string, Express.Multer.File[]> | undefined)?.datei?.[0];
  return f?.buffer ? { buffer: f.buffer, originalname: String(f.originalname || "") } : null;
}
const wahr = (v: unknown) => v === true || v === "true" || v === "1" || v === "on";

// ── Lesen ────────────────────────────────────────────────────────────────────
router.get("/chef/global/mandate", requireChef("leitung"), async (_req, res) => {
  try { res.setHeader("Cache-Control", "private, no-store"); res.json({ ok: true, ...(await globalMandateListe()) }); }
  catch (e) { fehler(res, "liste", e); }
});

router.get("/chef/global/mandate/:ref", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const m = await globalMandatChefSicht(ref(req));
    if (!m) return res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." });
    // Der Vorschau-Link reist mit (zwei Stunden gültig) — der Knopf ist ein normaler Link, kein Fenster nach einer
    // Serverabfrage (das blocken Safari und Chrome als Popup).
    res.json({ ok: true, mandat: m, kundenLink: globalKundenLink(ref(req)), vorschauUrl: globalVorschauLink(ref(req)) });
  } catch (e) { fehler(res, "mandat", e); }
});

// E-341: Was die KI dem Kunden in den Fachbereichen geantwortet hat — zur Kontrolle.
router.get("/chef/global/mandate/:ref/fach", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { fachChatsFuerChef } = await import("../lib/fiaon-global-fach");
    res.json({ ok: true, chats: await fachChatsFuerChef(ref(req)) });
  } catch (e) { fehler(res, "fach", e); }
});

router.get("/chef/global/mandate/:ref/vorschau", requireChef("leitung"), (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  res.json({ ok: true, url: globalVorschauLink(ref(req)) });
});

router.get("/chef/global/mandate/:ref/dokument/:id", requireChef("leitung"), async (req, res) => {
  try {
    const d = await globalDokumentLesen(ref(req), req.params.id, "office");
    if (!d) return res.status(404).json({ ok: false, error: "Dieses Dokument gibt es nicht." });
    const typ = globalMimeAuslieferbar(d.mime);
    if (!typ) return res.status(415).json({ ok: false, error: "Dieses Dokument lässt sich nicht anzeigen." });
    res.setHeader("Content-Type", typ);
    res.setHeader("Content-Disposition", `inline; filename="${globalDateinameKopf(d.dateiname)}"; filename*=UTF-8''${encodeURIComponent(d.dateiname)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(d.inhalt);
  } catch (e) { fehler(res, "dokument lesen", e); }
});

// ── Stand, Schritt, Stichtag, Abschluss ──────────────────────────────────────
router.post("/chef/global/mandate/:ref/etappe", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalEtappeSetzen(ref(req), { etappe: req.body?.etappe, text: req.body?.text, mitteilen: req.body?.mitteilen }, await wer(req))); }
  catch (e) { fehler(res, "etappe", e); }
});
router.post("/chef/global/mandate/:ref/naechster-schritt", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalNaechsterSchrittSetzen(ref(req), { text: req.body?.text, bis: req.body?.bis }, await wer(req))); }
  catch (e) { fehler(res, "naechster schritt", e); }
});
router.post("/chef/global/mandate/:ref/stichtag", requireChef("leitung"), async (req, res) => {
  try {
    const w = await wer(req);
    const erg = await globalBereichStichtag(ref(req), req.body?.stichtag, `Chefbüro (${w.name})`, req.body?.mitteilen === true, w.id || null);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung ?? "Stichtag gesetzt." });
  } catch (e) { fehler(res, "stichtag", e); }
});
router.post("/chef/global/mandate/:ref/abschliessen", requireChef("geschaeftsfuehrung"), async (req, res) => {
  try { antwort(res, await globalAbschliessen(ref(req), { text: req.body?.text, mitteilen: req.body?.mitteilen }, await wer(req))); }
  catch (e) { fehler(res, "abschliessen", e); }
});

// ── Gesellschaft & Fahrplan ──────────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/gesellschaft", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalGesellschaftPlusSetzen(ref(req), req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "gesellschaft", e); }
});
router.post("/chef/global/mandate/:ref/schritt", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalSchrittSetzen(ref(req), req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "schritt", e); }
});

// ── Banken & Kapital ─────────────────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/kapital", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalKapitalSpeichern(ref(req), req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "kapital", e); }
});
router.delete("/chef/global/mandate/:ref/kapital/:id", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalKapitalEntfernen(ref(req), req.params.id, await wer(req))); }
  catch (e) { fehler(res, "kapital entfernen", e); }
});

// ── Tresor & Post ────────────────────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/dokument", requireChef("leitung"), dateiAnnehmen, async (req, res) => {
  try {
    const b = req.body ?? {};
    antwort(res, await globalMandatDokument(ref(req), {
      art: b.art, datei: dateiAus(req), titel: b.titel, sichtbar: wahr(b.sichtbar), mitteilen: wahr(b.mitteilen), unterschrift: wahr(b.unterschrift),
      postAbsender: b.postAbsender, postEingang: b.postEingang,
    }, await wer(req)));
  } catch (e) { fehler(res, "dokument ablegen", e); }
});
router.post("/chef/global/mandate/:ref/dokument/:id", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalMandatDokumentAendern(ref(req), req.params.id, req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "dokument ändern", e); }
});
router.delete("/chef/global/mandate/:ref/dokument/:id", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalDokumentEntfernen(ref(req), req.params.id, await wer(req))); }
  catch (e) { fehler(res, "dokument entfernen", e); }
});

// ── Anfragen ─────────────────────────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/antwort", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalMandatAntwort(ref(req), { text: req.body?.text, mitteilen: req.body?.mitteilen }, await wer(req))); }
  catch (e) { fehler(res, "antwort", e); }
});
router.post("/chef/global/mandate/:ref/anfragen-gelesen", requireChef("leitung"), async (req, res) => {
  try { await globalMandatAnfragenGelesen(ref(req)); res.json({ ok: true }); }
  catch (e) { fehler(res, "anfragen gelesen", e); }
});

// ── Fristen & Notizen ────────────────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/frist", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalFristAnlegen(ref(req), req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "frist", e); }
});
router.post("/chef/global/mandate/:ref/frist/:id", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalFristAendern(ref(req), req.params.id, req.body ?? {}, await wer(req))); }
  catch (e) { fehler(res, "frist ändern", e); }
});
router.delete("/chef/global/mandate/:ref/frist/:id", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalFristLoeschen(ref(req), req.params.id, await wer(req))); }
  catch (e) { fehler(res, "frist löschen", e); }
});
router.post("/chef/global/mandate/:ref/notiz", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalNotizSchreiben(ref(req), { text: req.body?.text, sichtbar: req.body?.sichtbar }, await wer(req))); }
  catch (e) { fehler(res, "notiz", e); }
});

// ── Zugang, Test, Portal-Freigabe ────────────────────────────────────────────
router.post("/chef/global/mandate/:ref/zugang-senden", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalZugangSenden(ref(req), await wer(req))); }
  catch (e) { fehler(res, "zugang senden", e); }
});
router.post("/chef/global/mandate/:ref/test", requireChef("geschaeftsfuehrung"), async (req, res) => {
  try { antwort(res, await globalMandatTest(ref(req), req.body?.an === true, await wer(req))); }
  catch (e) { fehler(res, "test", e); }
});
// Justin: „bevor irgendwas live geht … lass es mich ansehen" — nur der Inhaber schaltet das neue Portal für einen Kunden frei.
router.post("/chef/global/mandate/:ref/portal", requireChef("inhaber"), async (req, res) => {
  try { antwort(res, await globalMandatPortal(ref(req), req.body?.an === true, await wer(req))); }
  catch (e) { fehler(res, "portal", e); }
});

// ── E-342: Gespräche je Tag und Justins Google-Kalender ──────────────────────
// Justin, 12.10.: „auf 8 erhöhen, vielleicht sogar auf 12 — und die Termine müssen sich immer in meinen Kalender
// synchronisieren." Der Deckel ist dieselbe Einstellung, die Website-Kalender und Startgespräch lesen (fiaon-global-termin).
router.get("/chef/global/einstellungen", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { globalTerminProTag, globalZustaendig } = await import("../lib/fiaon-global-termin");
    const { GLOBAL_PRO_TAG } = await import("../lib/fiaon-global-zeiten");
    const { googleKalenderStand } = await import("../lib/fiaon-google-kalender");
    const [proTag, z, google] = await Promise.all([globalTerminProTag(), globalZustaendig().catch(() => null), googleKalenderStand()]);
    const inhaber = (req as ChefRequest).chef?.stufe === "inhaber";
    res.json({
      ok: true, proTag, proTagVorgabe: GLOBAL_PRO_TAG,
      zustaendig: z ? { id: z.id, name: z.vorname || z.name } : null,
      // Client-ID und Bereiche braucht nur der Inhaber (für die Freigabe in der Google-Admin-Konsole).
      google: inhaber ? google : { ...google, clientId: null, bereiche: "" },
    });
  } catch (e) { fehler(res, "einstellungen", e); }
});
router.post("/chef/global/einstellungen", requireChef("geschaeftsfuehrung"), async (req, res) => {
  try {
    const n = Math.round(Number(req.body?.proTag));
    if (!Number.isInteger(n) || n < 1 || n > 12) return res.status(400).json({ ok: false, error: "Bitte eine Zahl von 1 bis 12." });
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('global_termin_pro_tag', ${String(n)}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    console.log(`[CHEF-GLOBAL] Gespräche je Tag: ${n} (${(await wer(req)).name})`);
    res.json({ ok: true, proTag: n, meldung: `Höchstens ${n} Global-Gespräche je Tag.` });
  } catch (e) { fehler(res, "einstellungen", e); }
});
router.post("/chef/global/google-kalender", requireChef("inhaber"), async (req, res) => {
  try {
    const g = await import("../lib/fiaon-google-kalender");
    if (typeof req.body?.an === "boolean") await g.googleKalenderSchalten(req.body.an);
    if (req.body?.jetzt === true) await g.googleKalenderAbgleich();
    res.json({ ok: true, google: await g.googleKalenderStand() });
  } catch (e) { fehler(res, "google-kalender", e); }
});

export default router;
