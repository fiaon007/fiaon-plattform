// ═══════════════════════════════════════════════════════════════════════════
// ARAS — die eigenen Chef-Routen des Kerns (E-408)
//
// Die Probe-Bedienung (/chef/s/aras-probe, ChefArasProbe.tsx) läuft OHNE den
// KI-Raum (E-409): Alles, was sie braucht, steht hier unter /chef/aras/probe/* —
// kein Pfad doppelt mit den Raum-Routen (fiaon-chef-ki.ts, SCHNITTSTELLE § 5).
//
//   GET  /chef/aras/probe/stand              Probe-Nummer (maskiert), Technik bereit?, Schalter, Kosten, Ton, letzter Probeanruf
//   POST /chef/aras/probe/nummer             Justins Nummer einmal eintragen (nur DACH, E.164) — die EINE Nummer für Probeanrufe
//   POST /chef/aras/probe/einstellung        Ton-Regler, Stimme, Tagesdeckel (nur diese Schlüssel)
//   POST /chef/aras/probe/anrufen            „Mich anrufen“ (Gesprächsart, Stimme nur für diesen Anruf, optional mit der Akte einer Testperson)
//   GET  /chef/aras/probe/testpersonen       Testpersonen (ist_test_am) — mit ihrer Akte laufen die Werkzeuge ECHT (Abnahme Scheibe 2)
//   POST /chef/aras/probe/:callId/auflegen   den laufenden Probeanruf beenden
//   POST /chef/aras/probe/:callId/urteil     Justins Daumen nach dem Probeanruf (hoch/runter + Grund)
//   GET  /chef/aras/probe/feedback           „Dein Feedback aus Probeanrufen“ (Aras am Telefon + Daumen-Gründe; gleiche Punkte zusammen)
//   POST /chef/aras/probe/feedback/:id/uebernehmen | /verwerfen   übernehmen = Regel an die Hausanweisung „telefon“ anhängen
//   GET  /chef/aras/probe/live?callId=N      Live-Strom (SSE) EINES Probeanrufs: Sätze + Zustand
//   GET  /chef/aras/probe/hoerproben         Stimmen-Studio: die Hörproben
//   POST /chef/aras/probe/hoerprobe          eine Hörprobe erzeugen (Stimme + Satz)
//   GET  /chef/aras/probe/hoerprobe/:id/audio
//   POST /chef/aras/probe/hoerprobe/:id/waehlen | /bewerten
//   POST /chef/aras/probe/notaus | /wieder-an | /leerlauf
//   POST /chef/aras/plan-fuellen             Warteschlange jetzt füllen (sonst alle 5 Min. von selbst)
//   POST /chef/aras/takt                     einen Wähl-Takt jetzt (sagt je Wand, warum jemand liegen blieb)
//   GET  /chef/aras/ergebnisse?tag=&probe=1  Reiter „Ergebnisse“ (Go-live G): je Gesprächsart und Tag, jede Zahl mit ihren Anrufen
//
// Wache: alles requireChef("inhaber") — die Seite ist nur für den Inhaber; jede
// Nicht-GET landet durch requireChef im Chef-Protokoll. Antworten { ok, … } / { ok:false, error }.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { arasEinstellungenLesen, einstellungSetzen, planFuellen, arasKostenHeute } from "../lib/fiaon-aras-plan";
import { waehlerTakt, notaus, start, leerlauf } from "../lib/fiaon-aras-waehler";
import { probeZiel, probeanruf, probeUrteil, letzterProbeanruf, feedbackListe, feedbackEntscheiden } from "../lib/fiaon-aras-nachbereitung";
import { hoerprobeErzeugen, hoerprobenListe, hoerprobeAudio, hoerprobeWaehlen, hoerprobeBewerten } from "../lib/fiaon-aras-hoerprobe";
import { adapterFuer } from "../lib/fiaon-aras-adapter";
import { twilioBereit } from "../lib/fiaon-aras-twilio-client";
import { laeuft, sitzungBeenden } from "../lib/fiaon-aras-bruecke";
import { ereignisBus } from "../lib/fiaon-aras-ereignis";
import { sqlPool } from "../lib/db-pool";
import { HOERPROBE_SATZ_VORGABE, HOERPROBE_SAETZE, STIMMEN_OPENAI, SPIELARTEN, istSpielart, nummerLand, PROBE_TON_SCHLUESSEL, istDialekt } from "../../shared/fiaon-aras";

const router = Router();
const wache = requireChef("inhaber");
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");
const fehler = (res: Response, status: number, text: string) => res.status(status).json({ ok: false, error: text, fehler: text });
const maske = (n: string) => (n.length > 7 ? `${n.slice(0, 4)} ••• ${n.slice(-3)}` : "•••");
const text = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 300);

/** Die Gesprächsarten, die Justin im Probeanruf spielen lassen kann (eingehend gibt es nicht als Probe). */
const PROBE_ARTEN = SPIELARTEN.filter((s) => s !== "eingehend");

// Go-live G (Koordination 20.10.2026): „Ergebnisse“ — je Gesprächsart und Tag, jede Zahl mit den Anrufen dazu. Nur lesen.
router.get("/chef/aras/ergebnisse", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { ergebnisseTag } = await import("../lib/fiaon-aras-ergebnisse");
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.tag ?? "")) ? String(req.query.tag) : new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
    res.json({ ok: true, ...(await ergebnisseTag(tag, { mitProbe: String(req.query.probe ?? "") === "1" })) });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.get("/chef/aras/probe/stand", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const einst = await arasEinstellungenLesen(true);
    const ziel = await probeZiel();
    const adapter = await adapterFuer(einst.adapter).bereit().catch((e) => ({ ok: false, grund: text(e) }));
    const twilio = twilioBereit();
    const letzter = await letzterProbeanruf();
    const kosten = await arasKostenHeute();
    const r = einst.regie;
    res.json({
      ok: true,
      nummer: ziel ? maske(ziel.nummer) : null, nummerQuelle: ziel?.quelle ?? null,
      bereit: { stimme: adapter, telefon: { ok: twilio.ok, fehlt: twilio.fehlt } },
      schalter: { notaus: einst.notaus, leerlauf: einst.leerlauf, an: einst.an, stufe: einst.stufe, tagEuro: einst.tagEuro },
      kosten,
      stimme: einst.stimme, stimmen: STIMMEN_OPENAI, satzVorgabe: HOERPROBE_SAETZE[r.dialekt ?? "hochdeutsch"] ?? HOERPROBE_SATZ_VORGABE, saetze: HOERPROBE_SAETZE, arten: PROBE_ARTEN,
      ton: {
        aras_energie: r.energie, aras_fuellwoerter: r.fuellwoerter, aras_lachen: r.lachen ? "an" : "aus", aras_tempo: r.tempo,
        aras_zuhoerlaute: r.zuhoerlaute, aras_abschluss: r.abschluss, aras_dialekt: r.dialekt ?? "hochdeutsch", aras_hintergrund: einst.hintergrund ?? "aus",
        aras_zuhoeren: r.zuhoeren ?? "normal", aras_menschlich: r.menschlich ?? "normal",
      },
      letzter: letzter ? { ...letzter, laeuft: laeuft(letzter.callId) || ["gewaehlt", "laeuft"].includes(letzter.status) } : null,
    });
  } catch (e) {
    console.error("[ARAS-CHEF] probe/stand:", e);
    fehler(res, 500, "Der Stand ließ sich nicht laden.");
  }
});

router.post("/chef/aras/probe/nummer", wache, async (req: ChefRequest, res: Response) => {
  try {
    const roh = String(req.body?.nummer ?? "").replace(/[\s()/.-]/g, "");
    const e164 = roh.startsWith("00") ? `+${roh.slice(2)}` : roh.startsWith("0") ? `+49${roh.slice(1)}` : roh;
    if (!/^\+[1-9]\d{6,15}$/.test(e164) || !nummerLand(e164)) return fehler(res, 400, "Bitte eine Handynummer aus Deutschland, Österreich oder der Schweiz (+49 / +43 / +41).");
    await einstellungSetzen("aras_probe_nummer", e164, wer(req));
    res.json({ ok: true, nummer: maske(e164) });
  } catch (e) { fehler(res, 400, text(e)); }
});

/** Scheibe 3 Teil 2: die Stufen-Ampel der letzten 14 Tage (Werte je Tag, Farbe, Entscheidung) — zum Anzeigen im KI-Team. */
router.get("/chef/aras/stufe", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { stufeLage } = await import("../lib/fiaon-aras-stufe");
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await stufeLage()) });
  } catch (e) { fehler(res, 500, text(e)); }
});

// E-458 (Justin 29.10.2026): „ARAS telefoniert nur noch die Termine oder die Leute die einen Anruf wollen“ — die Karte
// „Wen ARAS anruft“: Anruf-Wünsche (schriftliches Ja), Erinnerungen vor Global-Gesprächen, Rückrufe bei ARAS, die Schalter.
router.get("/chef/aras/wunsch", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { wunschLage } = await import("../lib/fiaon-aras-wunsch");
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await wunschLage(await arasEinstellungenLesen(true))) });
  } catch (e) { console.error("[ARAS-CHEF] wunsch:", e); fehler(res, 500, "Die Anruf-Wünsche ließen sich nicht laden."); }
});
/** Eine Gesprächsart an oder aus (nur diese — die gesperrten bleiben im Code gesperrt, einstellungPruefen weist sie ab). */
const KARTE_SPIELARTEN = new Set<string>(["termin", "wunsch", "erinnerung", "willkommen", "rate"]);
router.post("/chef/aras/spielart", wache, async (req: ChefRequest, res: Response) => {
  const spielart = String(req.body?.spielart ?? "");
  if (!KARTE_SPIELARTEN.has(spielart)) return fehler(res, 400, `„${spielart.slice(0, 30)}“ lässt sich hier nicht schalten.`);
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'aras_spielarten'`) as any[];
    let roh: Record<string, unknown> = {};
    try { const j = JSON.parse(String(z?.value ?? "{}")); if (j && typeof j === "object" && !Array.isArray(j)) roh = j; } catch { /* leer = Vorgabe */ }
    const neu = { ...roh, [spielart]: req.body?.an === true ? "an" : "aus" };
    res.json({ ok: true, wert: await einstellungSetzen("aras_spielarten", JSON.stringify(neu), wer(req)) });
  } catch (e) { fehler(res, 400, text(e)); }
});

/** Nur diese Schlüssel setzt die Probe-Seite — alles andere gehört in die Einstellungen des KI-Raums. */
const PROBE_SCHLUESSEL = new Set<string>([...PROBE_TON_SCHLUESSEL, "aras_stimme", "aras_tag_euro"]);
router.post("/chef/aras/probe/einstellung", wache, async (req: ChefRequest, res: Response) => {
  const schluessel = String(req.body?.schluessel ?? "");
  if (!PROBE_SCHLUESSEL.has(schluessel)) return fehler(res, 400, `„${schluessel.slice(0, 40)}“ lässt sich hier nicht setzen.`);
  try { res.json({ ok: true, wert: await einstellungSetzen(schluessel, req.body?.wert, wer(req)) }); } catch (e) { fehler(res, 400, text(e)); }
});

router.post("/chef/aras/probe/anrufen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const spielart = String(req.body?.spielart ?? "probe");
    const stimme = typeof req.body?.stimme === "string" && req.body.stimme ? String(req.body.stimme) : null;
    // Mit der Akte einer TESTPERSON (nie eines echten Kunden): Briefing aus ihrer Akte, Werkzeuge echt — gewählt wird trotzdem nur deine Nummer.
    let personId: number | null = null;
    if (req.body?.testpersonId != null && req.body.testpersonId !== "") {
      const id = Number(req.body.testpersonId);
      const [t] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${Number.isInteger(id) ? id : 0} AND ist_test_am IS NOT NULL`) as any[];
      if (!t) return fehler(res, 400, "Das ist keine Testperson — Probeanrufe laufen nur mit Probe-Daten oder einer Testperson.");
      personId = Number(t.id);
    }
    const r = await probeanruf({ spielart: istSpielart(spielart) ? spielart : "probe", von: wer(req), stimme, personId });
    if (!r.ok) return fehler(res, 409, r.grund ?? "Der Probeanruf ging nicht raus.");
    res.json({ ok: true, callId: r.callId });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/chef/aras/probe/:callId/auflegen", wache, async (req: ChefRequest, res: Response) => {
  const callId = Number(req.params.callId);
  if (!Number.isInteger(callId) || callId <= 0) return fehler(res, 400, "Ungültiger Anruf.");
  try { await sitzungBeenden(callId, "chef"); res.json({ ok: true }); } catch (e) { fehler(res, 500, text(e)); }
});

router.post("/chef/aras/probe/:callId/urteil", wache, async (req: ChefRequest, res: Response) => {
  const callId = Number(req.params.callId);
  const daumen = String(req.body?.daumen ?? "");
  if (!Number.isInteger(callId) || callId <= 0) return fehler(res, 400, "Ungültiger Anruf.");
  if (daumen !== "hoch" && daumen !== "runter") return fehler(res, 400, "daumen: hoch oder runter.");
  try {
    const r = await probeUrteil({ callId, daumen, grund: req.body?.grund ? String(req.body.grund) : null, von: wer(req) });
    if (!r.ok) return fehler(res, 400, r.grund ?? "Nicht gespeichert.");
    res.json({ ok: true });
  } catch (e) { fehler(res, 500, text(e)); }
});

// ── Feedback aus Probeanrufen (Justin 20.10., Anruf 12: Er sagte Aras am Telefon, was besser werden soll) ──────────
router.get("/chef/aras/probe/feedback", wache, async (_req: ChefRequest, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, zeilen: await feedbackListe() });
  } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/probe/feedback/:id/:was", wache, async (req: ChefRequest, res: Response) => {
  try {
    const r = await feedbackEntscheiden({ id: Number(req.params.id), was: String(req.params.was), von: wer(req) });
    if (!r.ok) return fehler(res, r.status, r.fehler);
    res.json({ ok: true });
  } catch (e) { fehler(res, 500, text(e)); }
});

router.get("/chef/aras/probe/testpersonen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const zeilen = (await sqlPool`
      SELECT id, COALESCE(NULLIF(TRIM(CONCAT_WS(' ', first_name, last_name)), ''), company_name, 'Testperson') AS name
        FROM fiaon_persons WHERE ist_test_am IS NOT NULL ORDER BY ist_test_am DESC LIMIT 20`) as any[];
    res.json({ ok: true, zeilen: zeilen.map((z) => ({ id: Number(z.id), name: String(z.name) })) });
  } catch (e) { fehler(res, 500, text(e)); }
});

// ── Live: EIN Probeanruf als Ereignis-Strom (SSE) — Sätze nur über den Bus, nie in die Datenbank ──
router.get("/chef/aras/probe/live", wache, (req: ChefRequest, res: Response) => {
  const callId = Number(req.query.callId);
  if (!Number.isInteger(callId) || callId <= 0) { fehler(res, 400, "callId fehlt."); return; }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const senden = (e: { callId?: unknown }) => {
    if (Number(e?.callId) !== callId) return;
    res.write(`event: aras\ndata: ${JSON.stringify(e)}\n\n`);
  };
  res.write(`event: aras\ndata: ${JSON.stringify({ art: "aras_hallo", callId, laeuft: laeuft(callId) })}\n\n`);
  const bus = ereignisBus();
  bus.on("aras", senden);
  const herz = setInterval(() => { res.write(`: herz ${Date.now()}\n\n`); }, 15_000);
  req.on("close", () => { clearInterval(herz); bus.off("aras", senden); });
});

// ── Stimmen-Studio ─────────────────────────────────────────────────────────
router.get("/chef/aras/probe/hoerproben", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, zeilen: await hoerprobenListe() }); } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/probe/hoerprobe", wache, async (req: ChefRequest, res: Response) => {
  try {
    // Je Akzent ein eigener Probesatz (Justin 20.10. abends), wenn die Seite keinen eigenen Text schickt.
    const roh: unknown = req.body?.dialekt;
    const dialekt = istDialekt(roh) ? roh : null;
    const r = await hoerprobeErzeugen({ adapter: "openai_live", stimme: String(req.body?.stimme ?? "juni"), text: String(req.body?.text ?? (dialekt ? HOERPROBE_SAETZE[dialekt] : HOERPROBE_SATZ_VORGABE)), dialekt });
    res.json({ ok: true, id: r.id });
  } catch (e) { fehler(res, 400, text(e)); }
});
router.get("/chef/aras/probe/hoerprobe/:id/audio", wache, async (req: ChefRequest, res: Response) => {
  try {
    // ?atmo=buero_leise|buero: dieselbe Probe mit Büro-Atmosphäre darunter (den Unterschied hören).
    const atmo = req.query.atmo === "buero_leise" || req.query.atmo === "buero" ? req.query.atmo : null;
    const a = await hoerprobeAudio(Number(req.params.id), undefined, atmo);
    if (!a) return fehler(res, 404, "Kein Audio.");
    res.setHeader("Content-Type", a.mime); res.setHeader("Cache-Control", "private, max-age=600"); res.send(a.bytes);
  } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/probe/hoerprobe/:id/waehlen", wache, async (req: ChefRequest, res: Response) => {
  try { await hoerprobeWaehlen(Number(req.params.id), wer(req)); res.json({ ok: true }); } catch (e) { fehler(res, 400, text(e)); }
});
router.post("/chef/aras/probe/hoerprobe/:id/bewerten", wache, async (req: ChefRequest, res: Response) => {
  try { await hoerprobeBewerten(Number(req.params.id), Number(req.body?.bewertung)); res.json({ ok: true }); } catch (e) { fehler(res, 400, text(e)); }
});

// ── Not-Aus / Wieder an / Leerlauf ─────────────────────────────────────────
router.post("/chef/aras/probe/notaus", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await notaus(wer(req), String(req.body?.grund ?? "Knopf auf der Probe-Seite").slice(0, 200))) }); } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/probe/wieder-an", wache, async (req: ChefRequest, res: Response) => {
  try { await start(wer(req)); res.json({ ok: true }); } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/probe/leerlauf", wache, async (req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await leerlauf(req.body?.an === true || String(req.body?.an ?? "") === "an", wer(req))) }); } catch (e) { fehler(res, 500, text(e)); }
});

// ── Von Hand: Warteschlange füllen, einen Wähl-Takt ───────────────────────
router.post("/chef/aras/plan-fuellen", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await planFuellen()) }); } catch (e) { fehler(res, 500, text(e)); }
});
router.post("/chef/aras/takt", wache, async (_req: ChefRequest, res: Response) => {
  try { res.json({ ok: true, ...(await waehlerTakt()) }); } catch (e) { fehler(res, 500, text(e)); }
});

export default router;
