// ═══════════════════════════════════════════════════════════════════════════
// FIRMEN-RADAR — DIE WEGE FÜRS CHEFBÜRO (19.09.2026)
//
// Justin: „… aber nicht bei Nikita, Admin!" Alles hier liegt hinter
// requireChef("geschaeftsfuehrung") — das Office der Mitarbeiter sieht den Radar
// nicht. Die Arbeit steht in server/lib/fiaon-radar.ts; hier wird nur geprüft,
// wer fragt, und was zurückgeht.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  RadarFehler, radarUebersicht, radarFirma, radarSucheStarten, radarLauf, radarFirmaManuell, radarScannen,
  radarMailAendern, radarMailAusgeben, radarStatusSetzen, radarSperren, radarPostfachPruefen,
  radarKontaktNachsuchen, radarKontaktSetzen, radarStapelStarten, radarLaufAbbrechen,
} from "../lib/fiaon-radar";
import { alsRadarLand } from "@shared/fiaon-radar";
import {
  radarAutomatik, radarAutomatikSetzen, radarTrichter, radarPost, radarPostLauf, maraAntwortVorbereiten,
  radarAntwortSenden, radarAntwortVerwerfen, radarAdresseUebernehmen, radarVersandLauf,
  radarTerminEintragen, radarMaraProbe, radarSzenarienPruefen,
} from "../lib/fiaon-radar-faden";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

function fehler(res: Response, e: any) {
  if (e instanceof RadarFehler) return res.status(e.status).json({ ok: false, error: e.message });
  console.error("[RADAR]", e);
  return res.status(500).json({ ok: false, error: "Der Radar ist gerade gestolpert — bitte noch einmal versuchen." });
}
const idAus = (roh: unknown): number => {
  const n = Number(roh);
  if (!Number.isInteger(n) || n <= 0) throw new RadarFehler("Ungültige Firma.", 400);
  return n;
};

router.get("/chef/radar", wache, async (req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ...(await radarUebersicht({
      tag: String(req.query.tag ?? "") || null, bereich: String(req.query.bereich ?? "") || null,
      status: String(req.query.status ?? "") || null, gruppe: String(req.query.gruppe ?? "") || null, suche: String(req.query.suche ?? "") || null,
    })) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/suchen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const laufId = await radarSucheStarten({
      bereich: String(req.body?.bereich ?? ""), land: alsRadarLand(req.body?.land), stichwort: req.body?.stichwort ? String(req.body.stichwort) : null,
      signal: req.body?.signal ? String(req.body.signal) : null,
      anzahl: Number(req.body?.anzahl) || 10, von: req.chef?.agentId ?? null,
    });
    res.json({ ok: true, laufId });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/lauf/:id", wache, async (req: ChefRequest, res: Response) => {
  try {
    const l = await radarLauf(idAus(req.params.id));
    if (!l) return res.status(404).json({ ok: false, error: "Lauf nicht gefunden." });
    res.json({ ok: true, lauf: l });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/manuell", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = await radarFirmaManuell({ website: String(req.body?.website ?? ""), bereich: String(req.body?.bereich ?? ""), von: req.chef?.agentId ?? null });
    res.json({ ok: true, id });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/firma/:id", wache, async (req: ChefRequest, res: Response) => {
  try {
    const f = await radarFirma(idAus(req.params.id));
    if (!f) return res.status(404).json({ ok: false, error: "Firma nicht gefunden." });
    res.json({ ok: true, firma: f });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/scannen", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, scan: await radarScannen(idAus(req.params.id)) }); } catch (e) { fehler(res, e); }
});

// E-458 (Punkt 4): „Mail schreiben“ = schreiben UND von der Prüf-KI lesen lassen (höchstens einmal neu) — ohne Urteil sendet nichts.
router.post("/chef/radar/firma/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarMailFertig } = await import("../lib/fiaon-radar-pruef");
    const r = await radarMailFertig(idAus(req.params.id), { hinweis: req.body?.hinweis ? String(req.body.hinweis) : null });
    const f = await radarFirma(idAus(req.params.id));
    res.json({ ok: true, mail: f?.mail ?? r.mail, pruefung: { ok: r.ok, grund: r.grund, versuche: r.versuche, urteil: f?.pruef_ki ?? null } });
  } catch (e) { fehler(res, e); }
});

// E-458 (Punkt 4): „Prüfen lassen“ — die Prüf-KI liest die gespeicherte Fassung (nach einer Änderung von Hand), ohne neu zu schreiben.
router.post("/chef/radar/firma/:id/pruefen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarMailNurPruefen } = await import("../lib/fiaon-radar-pruef");
    const p = await radarMailNurPruefen(idAus(req.params.id));
    res.json({ ok: true, bestanden: p.bestanden, gruende: p.gruende, urteil: p.urteil, modell: p.modell });
  } catch (e) { fehler(res, e); }
});

router.put("/chef/radar/firma/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, mail: await radarMailAendern(idAus(req.params.id), { betreff: String(req.body?.betreff ?? ""), koerper: String(req.body?.koerper ?? ""), ps: req.body?.ps != null ? String(req.body.ps) : undefined }) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/ausgeben", wache, async (req: ChefRequest, res: Response) => {
  try {
    const art = req.body?.art === "senden" ? "senden" : "entwurf";
    // Senden nur mit ausdrücklicher Bestätigung aus der Oberfläche.
    if (art === "senden" && req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Versand bestätigen.");
    res.json(await radarMailAusgeben(idAus(req.params.id), { art, postfach: String(req.body?.postfach ?? ""), an: req.body?.an ? String(req.body.an) : null, von: req.chef?.agentId ?? null }));
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/status", wache, async (req: ChefRequest, res: Response) => {
  try {
    await radarStatusSetzen(idAus(req.params.id), { status: String(req.body?.status ?? "") as any, notiz: req.body?.notiz != null ? String(req.body.notiz).slice(0, 1000) : null });
    res.json({ ok: true });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/sperren", wache, async (req: ChefRequest, res: Response) => {
  try {
    await radarSperren({ wert: String(req.body?.wert ?? ""), grund: req.body?.grund ? String(req.body.grund).slice(0, 200) : null, von: req.chef?.agentId ?? null });
    res.json({ ok: true });
  } catch (e) { fehler(res, e); }
});

// ── Mehrere auf einmal: vorbereiten, als Entwürfe ablegen, senden ──────────
router.post("/chef/radar/stapel", wache, async (req: ChefRequest, res: Response) => {
  try {
    const laufId = await radarStapelStarten({
      ids: Array.isArray(req.body?.ids) ? req.body.ids : [], art: String(req.body?.art ?? "vorbereiten") as any,
      postfach: req.body?.postfach ? String(req.body.postfach) : null, bestaetigt: req.body?.bestaetigt === true, von: req.chef?.agentId ?? null,
    });
    res.json({ ok: true, laufId });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/lauf/:id/abbrechen", wache, async (req: ChefRequest, res: Response) => {
  try { await radarLaufAbbrechen(idAus(req.params.id)); res.json({ ok: true }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/nachsuchen", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await radarKontaktNachsuchen(idAus(req.params.id))) }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/kontakt", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, email: await radarKontaktSetzen(idAus(req.params.id), String(req.body?.email ?? "")) }); } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/postfach/:adresse", wache, async (req: ChefRequest, res: Response) => {
  try { res.json(await radarPostfachPruefen(String(req.params.adresse))); } catch (e) { fehler(res, e); }
});

// ── E-337 (12.10.2026): Trichter, Automatik, Posteingang, Mara ─────────────
router.get("/chef/radar/trichter", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await radarTrichter(Number(req.query.tage) || 14)), automatik: await radarAutomatik() }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/automatik", wache, async (req: ChefRequest, res: Response) => {
  try {
    const b = req.body ?? {};
    const automatik = await radarAutomatikSetzen({ versand: b.versand, nachfass: b.nachfass, mara: b.mara, jeTag: b.jeTag, abPassung: b.abPassung });
    console.log(`[RADAR] Automatik von #${req.chef?.agentId ?? "?"}: ${JSON.stringify(automatik)}`);
    res.json({ ok: true, automatik });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/post", wache, async (req: ChefRequest, res: Response) => {
  try {
    const nur = ["offen", "leads", "alle"].includes(String(req.query.nur)) ? (String(req.query.nur) as "offen" | "leads" | "alle") : "offen";
    const firma = req.query.firma ? idAus(req.query.firma) : null;
    res.json({ ok: true, post: await radarPost({ nur, firma }) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/post-lauf", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ergebnis: await radarPostLauf() }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/versand-lauf", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ergebnis: await radarVersandLauf() }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/post/:id/mara", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await maraAntwortVorbereiten(idAus(req.params.id), { sendenErlaubt: false, hinweis: req.body?.hinweis ? String(req.body.hinweis) : null })) }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/post/:id/senden", wache, async (req: ChefRequest, res: Response) => {
  try {
    // Senden nur mit ausdrücklicher Bestätigung aus der Oberfläche — wie die erste Mail.
    if (req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Versand bestätigen.");
    res.json(await radarAntwortSenden(idAus(req.params.id), req.body?.text != null ? String(req.body.text) : null, req.chef?.agentId ?? null));
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/post/:id/verwerfen", wache, async (req: ChefRequest, res: Response) => {
  try { await radarAntwortVerwerfen(idAus(req.params.id)); res.json({ ok: true }); } catch (e) { fehler(res, e); }
});

// E-361: Die Wunschzeit einer Antwort in den Global-Kalender eintragen (Klick im Chefbüro, mit Bestätigung) — danach
// schreibt Mara die Bestätigung neu (Schalter „auto“ und nicht js@: sie geht hinaus; sonst Entwurf).
router.post("/chef/radar/post/:id/termin", wache, async (req: ChefRequest, res: Response) => {
  try {
    if (req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Termin bestätigen.");
    const id = idAus(req.params.id);
    const gebucht = await radarTerminEintragen(id, {
      telefon: req.body?.telefon != null ? String(req.body.telefon).slice(0, 40) : null,
      zeit: req.body?.zeit != null ? String(req.body.zeit).slice(0, 16) : null,
    });
    const a = await radarAutomatik();
    const mara = await maraAntwortVorbereiten(id, { sendenErlaubt: a.mara === "auto", gebucht }).catch((e) => ({ status: "fehler", text: "", pruefung: [String(e?.message || e)] }));
    res.json({ ok: true, gebucht, mara: { status: mara.status } });
  } catch (e) { fehler(res, e); }
});

// E-361: „Mara testen“ — was würde Mara mit dieser Antwort tun? Schreibt nichts, sendet nichts, bucht nichts.
router.post("/chef/radar/mara-probe", wache, async (req: ChefRequest, res: Response) => {
  try {
    const firmaId = req.body?.firmaId ? idAus(req.body.firmaId) : null;
    res.json({ ok: true, ...(await radarMaraProbe({
      text: String(req.body?.text ?? ""), von: req.body?.von ? String(req.body.von) : null, betreff: req.body?.betreff ? String(req.body.betreff) : null,
      firmaId, mitAntwort: req.body?.mitAntwort !== false,
    })) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/mara-szenarien", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await radarSzenarienPruefen()) }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/entscheider", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { entscheiderFinden } = await import("../lib/fiaon-radar-entscheider");
    res.json({ ok: true, entscheider: await entscheiderFinden(idAus(req.params.id), { websuche: true }) });
  } catch (e) { fehler(res, e); }
});

// E-337: Archiv — Altbestand (vor dem neuen Muster) gesammelt archivieren, einzelne Firma zurückholen.
router.post("/chef/radar/archivieren", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarArchivieren } = await import("../lib/fiaon-radar");
    const n = await radarArchivieren({ bis: req.body?.bis ? String(req.body.bis) : null, grund: req.body?.grund ? String(req.body.grund) : null });
    console.log(`[RADAR] Archiviert von #${req.chef?.agentId ?? "?"}: ${n} Firmen`);
    res.json({ ok: true, archiviert: n });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/aus-archiv", wache, async (req: ChefRequest, res: Response) => {
  try { const { radarAusArchiv } = await import("../lib/fiaon-radar"); await radarAusArchiv(idAus(req.params.id)); res.json({ ok: true }); } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/adresse-uebernehmen", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, email: await radarAdresseUebernehmen(idAus(req.params.id)) }); } catch (e) { fehler(res, e); }
});

// ── E-339 (12.10.2026): Brief statt Mail — Brief schreiben, Vorschau als PDF, senden (nur mit Schalter), Einstellungen ──
router.get("/chef/radar/brief", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { radarBriefUebersicht } = await import("../lib/fiaon-radar-brief");
    res.json({ ok: true, ...(await radarBriefUebersicht()) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/brief/einstellung", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarBriefEinstellungSetzen } = await import("../lib/fiaon-radar-brief");
    const b = req.body ?? {};
    const einstellung = await radarBriefEinstellungSetzen({ versand: b.versand, jeTag: b.jeTag, anbieter: b.anbieter, testmodus: b.testmodus, farbe: b.farbe });
    console.log(`[RADAR-BRIEF] Einstellung von #${req.chef?.agentId ?? "?"}: ${JSON.stringify(einstellung)}`);
    res.json({ ok: true, einstellung });
  } catch (e) { fehler(res, e); }
});

router.get("/chef/radar/firma/:id/brief", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarBriefAkte } = await import("../lib/fiaon-radar-brief");
    res.json({ ok: true, ...(await radarBriefAkte(idAus(req.params.id))) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/brief", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarBriefSchreiben } = await import("../lib/fiaon-radar-brief");
    res.json({ ok: true, brief: await radarBriefSchreiben(idAus(req.params.id), { hinweis: req.body?.hinweis ? String(req.body.hinweis) : null }) });
  } catch (e) { fehler(res, e); }
});

router.put("/chef/radar/firma/:id/brief", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarBriefAendern } = await import("../lib/fiaon-radar-brief");
    res.json({ ok: true, brief: await radarBriefAendern(idAus(req.params.id), { betreff: String(req.body?.betreff ?? ""), koerper: String(req.body?.koerper ?? "") }) });
  } catch (e) { fehler(res, e); }
});

// Die Vorschau ist das echte Druck-PDF (dieselbe Datei, die der Versanddienst bekäme) — nie zwischengespeichert.
router.get("/chef/radar/firma/:id/brief.pdf", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarBriefPdf } = await import("../lib/fiaon-radar-brief");
    const { pdf, name, seiten } = await radarBriefPdf(idAus(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${name}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Seiten", String(seiten));
    res.send(pdf);
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/firma/:id/brief/senden", wache, async (req: ChefRequest, res: Response) => {
  try {
    // Senden nur mit ausdrücklicher Bestätigung aus der Oberfläche — wie die erste Mail.
    if (req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Versand bestätigen.");
    const { radarBriefSenden } = await import("../lib/fiaon-radar-brief");
    res.json(await radarBriefSenden(idAus(req.params.id), { von: req.chef?.agentId ?? null }));
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/brief-lauf", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { radarBriefLauf } = await import("../lib/fiaon-radar-brief");
    res.json({ ok: true, ergebnis: await radarBriefLauf() });
  } catch (e) { fehler(res, e); }
});

// ── E-458 (29.10.2026): der Mail-Motor — Stand, Schalter, Warteschlange füllen, eine Mail jetzt senden ──────────
router.get("/chef/radar/motor", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { radarMotorStand } = await import("../lib/fiaon-radar-motor");
    res.json({ ok: true, ...(await radarMotorStand()) });
  } catch (e) { fehler(res, e); }
});

router.post("/chef/radar/motor", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { radarMotorSetzen } = await import("../lib/fiaon-radar-motor");
    const b = req.body ?? {};
    const erlaubt = ["tage", "von", "bis", "firmenJeStunde", "partnerJeStunde", "puffer", "haltbarTage", "link", "kiKlangMax", "aehnlichMax", "sucheTagesziel", "sucheLaeufe"];
    const teil = Object.fromEntries(Object.entries(b).filter(([k]) => erlaubt.includes(k)));
    const einstellung = await radarMotorSetzen(teil);
    console.log(`[MAIL-MOTOR] Schalter von #${req.chef?.agentId ?? "?"}: ${JSON.stringify(teil).slice(0, 300)}`);
    res.json({ ok: true, einstellung });
  } catch (e) { fehler(res, e); }
});

// Die Warteschlange jetzt füllen: läuft im Hintergrund (eine Firma braucht Minuten) — die Kachel fragt den Stand ab.
router.post("/chef/radar/motor/fuellen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { radarMotorVorbereiten } = await import("../lib/fiaon-radar-motor");
    void radarMotorVorbereiten({ max: 3 }).catch((e) => console.error("[MAIL-MOTOR] Füllen:", e?.message || e));
    res.json({ ok: true, gestartet: true });
  } catch (e) { fehler(res, e); }
});

// „Jetzt eine senden“: die nächste geprüfte Mail sofort — nur mit Bestätigung, nur im Fenster, mit allen Wänden.
router.post("/chef/radar/motor/senden", wache, async (req: ChefRequest, res: Response) => {
  try {
    if (req.body?.bestaetigt !== true) throw new RadarFehler("Bitte den Versand bestätigen.");
    const { radarMotorSenden } = await import("../lib/fiaon-radar-motor");
    res.json({ ok: true, ergebnis: await radarMotorSenden({ einmal: true }) });
  } catch (e) { fehler(res, e); }
});

export default router;
