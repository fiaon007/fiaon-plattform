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
  globalVorschauLink, globalKundenLink, globalStationSpeichern, globalItinKlartext, globalChefGesehen,
  globalChefNeuZahl, globalZustaendigAuswahl, globalMandatZustaendigSetzen,
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
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error, ...(typeof erg.feld === "string" ? { feld: erg.feld } : {}) });
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

// E-451 (28.10.2026): die Zahl am Menüpunkt „Global-Mandate“ — Akten mit Neuem vom Kunden. Leicht, nur lesen; das Menü
// fragt sie im Takt des Raums (60 s, nur bei sichtbarem Tab) von jeder Chefbüro-Seite aus.
router.get("/chef/global/neu-zahl", requireChef("leitung"), async (_req, res) => {
  try { res.setHeader("Cache-Control", "private, no-store"); res.json({ ok: true, ...(await globalChefNeuZahl()) }); }
  catch (e) { fehler(res, "neu-zahl", e); }
});

router.get("/chef/global/mandate/:ref", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const m = await globalMandatChefSicht(ref(req));
    if (!m) return res.status(404).json({ ok: false, error: "Diesen Auftrag gibt es nicht." });
    // E-451 (28.10.2026): Wen das Chefbüro als zuständig eintragen darf — mit der angemeldeten Leitung selbst.
    (m.zustaendigkeit as Record<string, unknown>).auswahl = await globalZustaendigAuswahl((await wer(req)).id || null);
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
    // E-443 (28.10.2026): Wer die Datei im Chefbüro öffnet, hat sie gesehen — die Marke „Neu“ geht, die Aufgabe dazu erledigt
    // sich. Erst NACH dem Ausliefern und ohne Einfluss darauf (ein Fehler hier landet nur im Log).
    void wer(req).then((w) => globalChefGesehen(ref(req), [Number(req.params.id)], w.name))
      .catch((e) => console.error("[CHEF-GLOBAL] gesehen:", e));
  } catch (e) { fehler(res, "dokument lesen", e); }
});

// E-443 (28.10.2026): „Alle als gesehen markieren“ — alle Kunden-Uploads der Akte, die zugehörigen Aufgaben erledigen sich.
router.post("/chef/global/mandate/:ref/gesehen", requireChef("leitung"), async (req, res) => {
  try {
    const n = await globalChefGesehen(ref(req), "alle", (await wer(req)).name);
    res.json({ ok: true, meldung: n ? `${n} ${n === 1 ? "Dokument" : "Dokumente"} als gesehen markiert — die Aufgaben dazu sind erledigt.` : "Es war nichts Neues mehr offen." });
  } catch (e) { fehler(res, "gesehen", e); }
});

// E-451 (28.10.2026): die Zuständigkeit der Akte setzen — EINE Quelle für Portal, Aufgaben und Chefbüro.
router.post("/chef/global/mandate/:ref/zustaendig", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalMandatZustaendigSetzen(ref(req), req.body?.agentId, await wer(req))); }
  catch (e) { fehler(res, "zustaendig", e); }
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

// ── Stationen-Editor (22.10.2026): Status mit Datum + die Werte der Station in EINEM Aufruf ──
router.post("/chef/global/mandate/:ref/station", requireChef("leitung"), async (req, res) => {
  try { antwort(res, await globalStationSpeichern(ref(req), req.body ?? {}, await wer(req), { vorZahlung: true })); }
  catch (e) { fehler(res, "station", e); }
});
// Die ITIN im Klartext — nur auf Klick, nie zwischengespeichert; der Verlauf vermerkt intern, wer sie ansah.
router.post("/chef/global/mandate/:ref/itin", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const itin = await globalItinKlartext(ref(req), { team: await wer(req) });
    if (!itin) return res.status(404).json({ ok: false, error: "Für diesen Auftrag ist keine ITIN hinterlegt." });
    res.json({ ok: true, itin });
  } catch (e) { fehler(res, "itin", e); }
});

// ── Global-Akte für ein angenommenes Begleit-Angebot (22.10.2026): ein Klick, wiederholbar ──
router.post("/chef/global/angebote/:id/akte", requireChef("leitung"), async (req, res) => {
  try {
    const { globalBegleitAkteAnlegen } = await import("../lib/fiaon-global-akte-komplett");
    antwort(res, await globalBegleitAkteAnlegen(Number(req.params.id), await wer(req)));
  } catch (e) { fehler(res, "begleit akte", e); }
});

// ── DIE VOLLSTÄNDIGE AKTE (22.10.2026): Rechnungen der Person, Verträge, Dokumente zur Unterschrift, ZIP ──
router.get("/chef/global/mandate/:ref/akte", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const m = await import("../lib/fiaon-global-akte-komplett");
    const r = encodeURIComponent(ref(req));
    res.json({
      ok: true,
      rechnungen: await m.globalAkteRechnungen(ref(req), (b) => `/api/fiaon/chef/global/mandate/${r}/rechnung/${encodeURIComponent(b)}`),
      vertraege: await m.globalAkteVertraege(ref(req), (a) => `/api/fiaon/chef/global/mandate/${r}/vertrag/${a}`),
      pflicht: await m.globalPflichtSicht(ref(req), "team"),
      zipUrl: `/api/fiaon/chef/global/mandate/${r}/akte.zip`,
    });
  } catch (e) { fehler(res, "akte", e); }
});
function pdfAus(res: Response, r: { pdf: Buffer; dateiname: string } | null, fehlt: string) {
  if (!r) return res.status(404).json({ ok: false, error: fehlt });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${globalDateinameKopf(r.dateiname)}"; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(r.pdf);
}
router.get("/chef/global/mandate/:ref/rechnung/:bestell", requireChef("leitung"), async (req, res) => {
  try { const { globalAkteRechnungPdf } = await import("../lib/fiaon-global-akte-komplett"); pdfAus(res, await globalAkteRechnungPdf(ref(req), String(req.params.bestell || "")), "Diese Rechnung gibt es nicht."); }
  catch (e) { fehler(res, "akte rechnung", e); }
});
router.get("/chef/global/mandate/:ref/vertrag/:id", requireChef("leitung"), async (req, res) => {
  try {
    const roh = String(req.params.id || ""); const art = roh === "auftrag" ? "auftrag" as const : Number(roh);
    if (art !== "auftrag" && !(Number.isInteger(art) && art > 0)) return res.status(404).json({ ok: false, error: "Diesen Vertrag gibt es nicht." });
    const { globalAkteVertragPdf } = await import("../lib/fiaon-global-akte-komplett");
    pdfAus(res, await globalAkteVertragPdf(ref(req), art), "Diesen Vertrag gibt es nicht.");
  } catch (e) { fehler(res, "akte vertrag", e); }
});
router.get("/chef/global/mandate/:ref/akte.zip", requireChef("leitung"), async (req, res) => {
  try { const w = await wer(req); const { globalAkteZip } = await import("../lib/fiaon-global-akte-komplett"); await globalAkteZip(ref(req), "team", res, { name: w.name, agentId: w.id || null }); }
  catch (e) { fehler(res, "akte zip", e); }
});
router.post("/chef/global/mandate/:ref/dokument/:id/pflicht", requireChef("leitung"), async (req, res) => {
  try {
    const { globalPflichtZuordnen } = await import("../lib/fiaon-global-akte-komplett");
    const erg = await globalPflichtZuordnen(ref(req), Number(req.params.id), req.body?.key || null);
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: req.body?.key ? "Als Pflichtunterlage zugeordnet." : "Zuordnung entfernt." });
  } catch (e) { fehler(res, "pflicht", e); }
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
    // 22.10.2026: optional einem Formular zugeordnet (IRS SS-4 / 8821, vorausgefüllt zur Unterschrift).
    const { globalPflichtUnterlage } = await import("@shared/fiaon-global-akte");
    const pflicht = b.pflichtKey ? globalPflichtUnterlage(b.pflichtKey) : null;
    if (b.pflichtKey && !pflicht) return res.status(400).json({ ok: false, error: "Dieses Formular gibt es nicht." });
    const erg = await globalMandatDokument(ref(req), {
      art: b.art, datei: dateiAus(req), titel: b.titel, sichtbar: wahr(b.sichtbar), mitteilen: wahr(b.mitteilen), unterschrift: wahr(b.unterschrift),
      postAbsender: b.postAbsender, postEingang: b.postEingang,
    }, await wer(req));
    if (erg.ok && pflicht) {
      const { globalPflichtZuordnen } = await import("../lib/fiaon-global-akte-komplett");
      await globalPflichtZuordnen(ref(req), erg.id, pflicht.key);
    }
    // Wie unterschrieben wird: IRS-Formulare immer von Hand; sonst die Wahl beim Hochladen (Vorgabe digital).
    if (erg.ok && wahr(b.unterschrift)) {
      const art = pflicht ? pflicht.modus : (String(b.unterschriftArt ?? "") === "handschriftlich" ? "handschriftlich" : "digital");
      await sqlPool`UPDATE fiaon_global_dokumente SET unterschrift_art = ${art} WHERE id = ${erg.id} AND ref = ${ref(req)}`;
    }
    antwort(res, erg);
  } catch (e) { fehler(res, "dokument ablegen", e); }
});
// 22.10.2026: den von Hand unterschriebenen Scan im Namen des Kunden hochladen (nur PDF).
router.post("/chef/global/mandate/:ref/dokument/:id/scan", requireChef("leitung"), dateiAnnehmen, async (req, res) => {
  try {
    const { globalScanHochladen } = await import("../lib/fiaon-global-akte-komplett");
    antwort(res, await globalScanHochladen(ref(req), req.params.id, dateiAus(req), { team: await wer(req) }));
  } catch (e) { fehler(res, "scan", e); }
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
// ── LEISTUNGEN: Zusatzdienste des Mandats (Scheibe 1 „Ihr US-Büro“, 22.10.2026) ──
// Lesen, Rechnung ansehen und Status setzen (bezahlt von Hand · aktiv · storniert) — derselbe Server-Weg wie die
// Zahlung (server/lib/fiaon-global-zusatz.ts). Der Kunde sieht jeden Schritt in „Ihr Büro erweitern“.
router.get("/chef/global/mandate/:ref/zusatz", requireChef("leitung"), async (req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { zusatzChefListe } = await import("../lib/fiaon-global-zusatz");
    res.json({ ok: true, ...(await zusatzChefListe(ref(req))) });
  } catch (e) { fehler(res, "zusatz liste", e); }
});
router.get("/chef/global/mandate/:ref/zusatz/:id/rechnung.pdf", requireChef("leitung"), async (req, res) => {
  try {
    const { zusatzRechnungPdf } = await import("../lib/fiaon-global-zusatz");
    const r = await zusatzRechnungPdf(ref(req), req.params.id);
    if (!r) return res.status(404).json({ ok: false, error: "Diese Rechnung gibt es nicht." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${globalDateinameKopf(r.dateiname)}"; filename*=UTF-8''${encodeURIComponent(r.dateiname)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(r.pdf);
  } catch (e) { fehler(res, "zusatz rechnung", e); }
});
router.post("/chef/global/mandate/:ref/zusatz/:id/status", requireChef("leitung"), async (req, res) => {
  try {
    const { zusatzStatusSetzen } = await import("../lib/fiaon-global-zusatz");
    antwort(res, await zusatzStatusSetzen(ref(req), req.params.id, req.body?.status, req.body?.notiz, await wer(req)));
  } catch (e) { fehler(res, "zusatz status", e); }
});

// ── FREIGABE JE ZUSATZDIENST (22.10.2026, Justin: „sicher starten“) ──────────
// Vorgabe: nur „Ihre Domain & E-Mail“. Die Leitung schaltet jeden weiteren Dienst einzeln frei — erst dann sieht ihn der
// Kunde und der Server nimmt die Buchung an. Zurückschalten blendet ihn aus; bestehende Buchungen laufen weiter.
router.get("/chef/global/zusatz-freigabe", requireChef("leitung"), async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { zusatzFreigabeLesen } = await import("../lib/fiaon-global-zusatz");
    const { GLOBAL_ZUSATZ, zusatzPreisText } = await import("@shared/fiaon-global-zusatz");
    const frei = await zusatzFreigabeLesen();
    res.json({ ok: true, dienste: GLOBAL_ZUSATZ.filter((z) => z.buchbar).map((z) => ({ key: z.key, titel: z.de.titel, preis: zusatzPreisText(z, "de"), freigegeben: frei.includes(z.key) })) });
  } catch (e) { fehler(res, "zusatz freigabe lesen", e); }
});
router.post("/chef/global/zusatz-freigabe", requireChef("leitung"), async (req, res) => {
  try {
    if (typeof req.body?.an !== "boolean") return res.status(400).json({ ok: false, error: "Bitte freigeben oder zurücknehmen (an: true/false)." });
    const { zusatzFreigabeSetzen } = await import("../lib/fiaon-global-zusatz");
    antwort(res, await zusatzFreigabeSetzen(req.body?.key, req.body.an, (await wer(req)).name));
  } catch (e) { fehler(res, "zusatz freigabe", e); }
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
    const { globalVertretung } = await import("../lib/fiaon-global-gespraech");
    const [proTag, z, google, v] = await Promise.all([globalTerminProTag(), globalZustaendig().catch(() => null), googleKalenderStand(), globalVertretung().catch(() => null)]);
    const inhaber = (req as ChefRequest).chef?.stufe === "inhaber";
    res.json({
      ok: true, proTag, proTagVorgabe: GLOBAL_PRO_TAG,
      zustaendig: z ? { id: z.id, name: z.vorname || z.name } : null,
      // E-458 Nr. 11: wer einspringt, wenn die zuständige Person nicht da ist (Ergebnis-Pflicht der Gespräche).
      vertretung: v ? { id: v.id, name: v.vorname || v.name } : null,
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
// ── E-458 Nr. 11 (29.10.2026): DIE GESPRÄCHE — kein Global-Gespräch geht mehr verloren ──────────────
// Die Leitung sieht, wo das Ergebnis fehlt, und trägt es mit einem Klick ein (stattgefunden / nicht erreicht /
// verschoben) — dieselben Wege wie der Kalender der Mitarbeiter (globalTerminErgebnis, globalGespraechVerschieben).
// Die Erinnerung an die Leitung führt hierher (GESPRAECHE_CHEF_LINK).
router.get("/chef/global/gespraeche", requireChef("leitung"), async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "private, no-store");
    const { globalGespraecheListe, globalVertretung } = await import("../lib/fiaon-global-gespraech");
    const [liste, v] = await Promise.all([globalGespraecheListe(), globalVertretung().catch(() => null)]);
    res.json({ ok: true, ...liste, vertretung: v ? { id: v.id, name: v.name } : null });
  } catch (e) { fehler(res, "gespraeche", e); }
});
router.post("/chef/global/gespraeche/:id/ergebnis", requireChef("leitung"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const wahl = String(req.body?.ergebnis ?? "");
    if (!Number.isInteger(id) || !["stattgefunden", "nicht_erreicht"].includes(wahl)) {
      return res.status(400).json({ ok: false, error: "Bitte „Stattgefunden“ oder „Nicht erreicht“ wählen." });
    }
    const [t] = (await sqlPool`
      SELECT id, person_id, beginn FROM fiaon_termine
       WHERE id = ${id} AND quelle = 'global' AND (status = 'gebucht' OR (status = 'verpasst' AND erledigt_am IS NULL)) LIMIT 1`) as any[];
    if (!t) return res.status(404).json({ ok: false, error: "Dieses Gespräch ist schon abgeschlossen oder abgesagt." });
    const w = await wer(req);
    const { globalTerminErgebnis } = await import("../lib/fiaon-global-termin");
    const erg = await globalTerminErgebnis({
      terminId: id, personId: Number(t.person_id), beginn: t.beginn, agent: { id: w.id, name: w.name },
      ergebnis: wahl === "stattgefunden" ? "erledigt" : "verpasst", grund: wahl === "nicht_erreicht" ? "nicht_erschienen" : null,
      notiz: req.body?.notiz ? String(req.body.notiz).slice(0, 2000) : null,
    });
    console.log(`[CHEF-GLOBAL] Gespräch ${id}: ${wahl} (${w.name})`);
    res.json({ ok: true, meldung: erg.hinweis });
  } catch (e) { fehler(res, "gespraech ergebnis", e); }
});
router.post("/chef/global/gespraeche/:id/verschieben", requireChef("leitung"), async (req, res) => {
  try {
    const { parseBerlinInput } = await import("../lib/fiaon-time");
    const neu = parseBerlinInput(String(req.body?.beginn ?? ""));
    if (!neu) return res.status(400).json({ ok: false, error: "Bitte Datum und Uhrzeit der neuen Zeit wählen." });
    const w = await wer(req);
    const { globalGespraechVerschieben } = await import("../lib/fiaon-global-gespraech");
    const erg = await globalGespraechVerschieben(Number(req.params.id), neu, { id: w.id || null, name: w.name });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: `${erg.meldung} ${erg.hinweis}` });
  } catch (e) { fehler(res, "gespraech verschieben", e); }
});

router.post("/chef/global/google-kalender", requireChef("inhaber"), async (req, res) => {
  try {
    const g = await import("../lib/fiaon-google-kalender");
    if (typeof req.body?.an === "boolean") await g.googleKalenderSchalten(req.body.an);
    if (req.body?.jetzt === true) await g.googleKalenderAbgleich({ erzwingen: true });
    res.json({ ok: true, google: await g.googleKalenderStand() });
  } catch (e) { fehler(res, "google-kalender", e); }
});

export default router;
