// ═══════════════════════════════════════════════════════════════════════════
// /chef/ki/* und /chef/aras/* — DIE ROUTEN DES KI-RAUMS (E-409, 19.10.2026)
//
// Wache (Vertrag § 5): GET = requireChef("leitung"), alles andere = requireChef("inhaber").
// Jede Nicht-GET-Anfrage steht durch requireChef im Chef-Protokoll (fiaon_admin_log).
// Antworten immer { ok: true, … } oder { ok: false, fehler }.
//
// ARAS: Alle /chef/aras-Routen laufen über die Anbindung (fiaon-ki-aras-anbindung.ts).
// Hat Team 1 den Kern noch nicht angemeldet, antworten sie 404 { verbunden: false }
// — der Raum zeigt dann den Leerzustand „Aras ist noch nicht verbunden“.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import { aras, arasVerbunden, NICHT_VERBUNDEN } from "../lib/fiaon-ki-aras-anbindung";
import { einstellungenLesen, einstellungSetzen, maraNotaus } from "../lib/fiaon-ki-einstellungen";
import { ampelZeilenLesen, ampelSetzen } from "../lib/fiaon-ki-ampel";
import { kiHeute, kiKostenJeDienst, kiKostenVerlauf } from "../lib/fiaon-ki-heute";
import { pruefungen, fehlerquote, pruefungEntscheiden, pruefungTakt, pruefungStand } from "../lib/fiaon-ki-pruefung";
import { AMPEL_STUFEN, ARAS_SPIELARTEN, type AmpelStufe } from "@shared/fiaon-ki-team";
import { wertOeffentlich, nummerMaskiert } from "@shared/fiaon-ki-schalter";

const router = Router();
const lesen = requireChef("leitung");
const wache = requireChef("inhaber");
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");
const nameZeigen = (req: ChefRequest) => req.chef?.stufe === "inhaber" || req.chef?.stufe === "geschaeftsfuehrung";
const fehler = (res: Response, status: number, text: string, extra: Record<string, unknown> = {}) => res.status(status).json({ ok: false, fehler: text, error: text, ...extra });
const nichtVerbunden = (res: Response) => fehler(res, 404, NICHT_VERBUNDEN, { verbunden: false });

// ── Heute ──────────────────────────────────────────────────────────────────
router.get("/chef/ki/heute", lesen, async (req: ChefRequest, res: Response) => {
  try {
    // E-409 Fund 11: Kundennamen nur für Inhaber/Geschäftsführung (wie auf „Qualität“); entscheiden, „Rückgängig“ und
    // Not-Aus nur Inhaber (dieselbe Wache wie das Mara-Steuerpult).
    const h = await kiHeute({ karten: Number(req.query.karten) || 6, nameZeigen: nameZeigen(req), entscheiden: req.chef?.stufe === "inhaber" });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...h });
  } catch (e) {
    console.error("[CHEF-KI] heute:", e);
    fehler(res, 500, "„Heute“ ließ sich nicht laden.");
  }
});

router.post("/chef/ki/mara/notaus", wache, async (req: ChefRequest, res: Response) => {
  try {
    // { an: true } = anhalten: alle Mara-Wege (Stand wird gemerkt) UND Aras über seinen eigenen Not-Aus (aras_notaus,
    // laufende Gespräche enden mit Abschiedssatz) · { an: false } = „Wieder an“ (genau der Stand von vorher, auch bei Aras).
    const an = req.body?.an !== false;
    const r = await maraNotaus(an, wer(req));
    if (!r.ok) return fehler(res, r.status, r.fehler);
    void chefProtokoll(req, "mara_notaus", `${an ? "an" : "aus (Stand von vorher)"}: ${r.geaendert.map((g) => g.schluessel).join(", ") || "nichts geändert"}${r.aras ? ` · ${r.aras.text}` : ""}`.slice(0, 300));
    res.json({ ok: true, aktiv: r.aktiv, geaendert: r.geaendert, aras: r.aras });
  } catch (e) {
    console.error("[CHEF-KI] mara/notaus:", e);
    fehler(res, 500, "Der Not-Aus ließ sich nicht schalten.");
  }
});

// ── Einstellungen ──────────────────────────────────────────────────────────
router.get("/chef/ki/einstellungen", lesen, async (_req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ...(await einstellungenLesen()) });
  } catch (e) {
    console.error("[CHEF-KI] einstellungen:", e);
    fehler(res, 500, "Die Einstellungen ließen sich nicht laden.");
  }
});

router.post("/chef/ki/einstellung", wache, async (req: ChefRequest, res: Response) => {
  const schluessel = String(req.body?.schluessel ?? "").trim();
  if (!schluessel) return fehler(res, 400, "schluessel fehlt.");
  try {
    const r = await einstellungSetzen(schluessel, req.body?.wert, wer(req));
    if (!r.ok) return fehler(res, r.status, r.fehler);
    // E-409 Fund 11: die Probe-Nummer steht im Chef-Protokoll und in der Antwort nur verdeckt.
    const sichtbar = wertOeffentlich(schluessel, r.wert);
    void chefProtokoll(req, schluessel, sichtbar.slice(0, 120));
    res.json({ ok: true, schluessel: r.schluessel, wert: sichtbar });
  } catch (e) {
    console.error("[CHEF-KI] einstellung:", e);
    fehler(res, 500, "Die Einstellung ließ sich nicht speichern — es bleibt, wie es war.");
  }
});

// ── Werkzeuge (Ampel) ──────────────────────────────────────────────────────
router.get("/chef/ki/werkzeuge", lesen, async (_req: ChefRequest, res: Response) => {
  try {
    const mara = await ampelZeilenLesen("mara");
    const arasZeilen = arasVerbunden() && aras()?.konstanten?.ARAS_AMPEL?.length ? await ampelZeilenLesen("aras") : null;
    res.json({ ok: true, mara, aras: arasZeilen, arasVerbunden: arasVerbunden() });
  } catch (e) {
    console.error("[CHEF-KI] werkzeuge:", e);
    fehler(res, 500, "Die Werkzeuge ließen sich nicht laden.");
  }
});

router.post("/chef/ki/werkzeug/:key", wache, async (req: ChefRequest, res: Response) => {
  const stufe = String(req.body?.stufe ?? "") as AmpelStufe;
  if (!AMPEL_STUFEN.includes(stufe)) return fehler(res, 400, "stufe: gruen, gelb oder rot.");
  const werWz = req.body?.wer === "aras" ? "aras" : "mara";
  if (werWz === "aras" && !arasVerbunden()) return nichtVerbunden(res);
  try {
    const r = await ampelSetzen(werWz, String(req.params.key), stufe, wer(req));
    if (!r.ok) return fehler(res, 400, r.fehler);
    void chefProtokoll(req, `${werWz}_ampel:${req.params.key}`, stufe);
    res.json({ ok: true, zeile: r.zeile });
  } catch (e) {
    console.error("[CHEF-KI] werkzeug:", e);
    fehler(res, 500, "Die Stufe ließ sich nicht speichern.");
  }
});

// ── Qualität (Prüf-Mara) ───────────────────────────────────────────────────
router.get("/chef/ki/qualitaet", lesen, async (req: ChefRequest, res: Response) => {
  try {
    const tage = Math.max(1, Math.min(90, Number(req.query.tage) || 7));
    const [quote, liste, stand] = await Promise.all([
      fehlerquote(tage),
      pruefungen({ tage, kanal: req.query.kanal ? String(req.query.kanal) : undefined, urteil: req.query.urteil ? String(req.query.urteil) : undefined, seite: Number(req.query.seite) || 0, nameZeigen: nameZeigen(req) }),
      pruefungStand(),
    ]);
    res.json({ ok: true, quote, liste, stand });
  } catch (e) {
    console.error("[CHEF-KI] qualitaet:", e);
    fehler(res, 500, "Die Qualität ließ sich nicht laden.");
  }
});

router.post("/chef/ki/pruefung/jetzt", wache, async (req: ChefRequest, res: Response) => {
  try {
    const r = await pruefungTakt();
    void chefProtokoll(req, "pruef_mara_jetzt", `${r.geprueft} geprüft, ${r.auffaellig} auffällig`);
    res.json({ ok: true, ...r });
  } catch (e) {
    console.error("[CHEF-KI] pruefung/jetzt:", e);
    fehler(res, 500, "Die Prüfung ließ sich nicht starten.");
  }
});

router.post("/chef/ki/pruefung/:id", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.params.id);
  const was = String(req.body?.was ?? "");
  if (!Number.isInteger(id) || id <= 0) return fehler(res, 400, "Ungültige Prüfung.");
  if (!["in_ordnung", "anweisen", "sperren"].includes(was)) return fehler(res, 400, "was: in_ordnung, anweisen oder sperren.");
  try {
    const r = await pruefungEntscheiden(id, was as any, wer(req), req.body?.text ? String(req.body.text) : undefined);
    void chefProtokoll(req, `pruefung:${id}`, was);
    res.json({ ok: true, hinweis: r.hinweis ?? null });
  } catch (e) {
    fehler(res, 400, String((e as Error)?.message ?? e).slice(0, 200));
  }
});

// ── Kosten und Protokoll ───────────────────────────────────────────────────
router.get("/chef/ki/kosten", lesen, async (req: ChefRequest, res: Response) => {
  try {
    const tage = Math.max(1, Math.min(90, Number(req.query.tage) || 14));
    const [heute, verlauf] = await Promise.all([kiKostenJeDienst(), kiKostenVerlauf(tage)]);
    const { aktiverAnbieter } = await import("../lib/fiaon-ki-claude");
    res.json({ ok: true, heute, verlauf, anbieter: aktiverAnbieter() });
  } catch (e) {
    console.error("[CHEF-KI] kosten:", e);
    fehler(res, 500, "Die Kosten ließen sich nicht laden.");
  }
});

router.get("/chef/ki/protokoll", lesen, async (req: ChefRequest, res: Response) => {
  try {
    const tage = Math.max(1, Math.min(90, Number(req.query.tage) || 7));
    const kanal = ["telefon", "mail", "whatsapp"].includes(String(req.query.kanal)) ? String(req.query.kanal) : null;
    const schaltungen = (await sqlPool`
      SELECT l.zeit, l.agent_id, l.stufe, l.methode, l.pfad, l.ziel, l.notiz, a.first_name, a.last_name
        FROM fiaon_admin_log l LEFT JOIN fiaon_agents a ON a.id = l.agent_id
       WHERE l.zeit > NOW() - (${tage} || ' days')::interval
         AND (l.pfad LIKE '%/chef/ki%' OR l.pfad LIKE '%/chef/aras%' OR l.pfad LIKE '%/chef/mara%' OR l.pfad LIKE '%/admin/postmeister%' OR l.pfad LIKE '%/chef/rueckholung/einstellung%' OR l.pfad LIKE '%/chef/auskunft/einstellung%')
       ORDER BY l.zeit DESC LIMIT 200`.catch(() => [])) as any[];
    const ereignisse = (await sqlPool`
      SELECT p.id, p.am, p.kanal, p.art, p.ok, p.text, p.person_id, q.last_name
        FROM fiaon_mara_protokoll p LEFT JOIN fiaon_persons q ON q.id = p.person_id
       WHERE p.am > NOW() - (${tage} || ' days')::interval AND (${kanal}::text IS NULL OR p.kanal = ${kanal})
       ORDER BY p.id DESC LIMIT 200`.catch(() => [])) as any[];
    const zeig = nameZeigen(req);
    res.json({
      ok: true,
      schaltungen: schaltungen.map((z) => ({
        am: new Date(z.zeit).toISOString(), wer: [z.first_name, z.last_name].filter(Boolean).join(" ") || (z.stufe ? `Stufe ${z.stufe}` : "—"),
        methode: z.methode, pfad: z.pfad, ziel: z.ziel ?? null, notiz: z.notiz ?? null,
      })),
      ereignisse: ereignisse.map((z) => ({
        id: Number(z.id), am: new Date(z.am).toISOString(), kanal: z.kanal, art: z.art, ok: z.ok !== false, text: String(z.text ?? ""),
        personId: z.person_id ?? null, name: zeig ? (z.last_name ?? null) : null,
      })),
    });
  } catch (e) {
    console.error("[CHEF-KI] protokoll:", e);
    fehler(res, 500, "Das Protokoll ließ sich nicht laden.");
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ARAS — alles über die Anbindung (Team 1, E-408)
// ═══════════════════════════════════════════════════════════════════════════
const berlinTag = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });

router.get("/chef/aras/lage", lesen, async (_req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return res.json({ ok: true, verbunden: false, an: false, notaus: false, adapter: null, stimme: null, plan: null, laufend: [], heute: { gewaehlt: 0, erreicht: 0, gespraeche: 0, zusagen: 0, euroKi: 0, euroTelefon: 0, deckel: null }, hinweis: NICHT_VERBUNDEN });
  try {
    const [e, plan, heute] = await Promise.all([
      a.plan.arasEinstellungenLesen(),
      a.plan.planLage(),
      a.nachbereitung?.tagesZahlen ? a.nachbereitung.tagesZahlen(berlinTag()) : Promise.resolve({ gewaehlt: 0, erreicht: 0, gespraeche: 0, zusagen: 0, euroKi: 0, euroTelefon: 0 }),
    ]);
    const ein = e as any;
    res.json({
      ok: true, verbunden: true,
      an: ein.an === true || ein.aras_an === "an", notaus: ein.notaus === true || ein.aras_notaus === "an", leerlauf: ein.leerlauf === true || ein.aras_leerlauf === "an",
      // Cockpit (20.10.2026): die Ausbaustufe steht in der Statuszeile („Stufe 0 · Probe“) — ohne eigenen Abruf.
      stufe: Math.max(0, Math.min(3, Number(ein.stufe ?? ein.aras_stufe ?? 0) || 0)),
      adapter: ein.adapter ?? ein.aras_adapter ?? null, stimme: ein.stimme ?? ein.aras_stimme ?? null,
      plan, laufend: a.waehler?.laufendeSitzungen?.() ?? [],
      heute: { ...heute, deckel: Number(ein.tagEuro ?? ein.aras_tag_euro ?? 0) || null },
    });
  } catch (e) {
    console.error("[CHEF-KI] aras/lage:", e);
    fehler(res, 500, "Die Aras-Lage ließ sich nicht laden.");
  }
});

router.get("/chef/aras/plan", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return nichtVerbunden(res);
  try {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.tag)) ? String(req.query.tag) : berlinTag();
    const [plan, lern] = await Promise.all([a.plan.tagesplan(tag), a.plan.lernvorschlag().catch(() => null)]);
    res.json({ ok: true, ...(plan as object), lernvorschlag: lern });
  } catch (e) {
    console.error("[CHEF-KI] aras/plan:", e);
    fehler(res, 500, "Der Plan ließ sich nicht laden.");
  }
});

router.get("/chef/aras/warteschlange", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return nichtVerbunden(res);
  try {
    const zeilen = await a.plan.planListe({ status: req.query.status ? String(req.query.status) : undefined, spielart: req.query.spielart ? String(req.query.spielart) : undefined, seite: Number(req.query.seite) || 0 });
    const zeig = nameZeigen(req);
    // Cockpit (20.10.2026): Vor- und Nachname wie in der Anrufliste.
    const namen = zeig ? await vollnamen((zeilen as any[]).map((z) => Number(z.personId)).filter((n) => n > 0)) : new Map<number, string>();
    res.json({ ok: true, zeilen: (zeilen as any[]).map((z) => ({ ...z, name: zeig ? (z.personId && namen.get(Number(z.personId))) || z.name || null : null })) });
  } catch (e) {
    console.error("[CHEF-KI] aras/warteschlange:", e);
    fehler(res, 500, "Die Warteschlange ließ sich nicht laden.");
  }
});

router.post("/chef/aras/warteschlange/einreihen", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return nichtVerbunden(res);
  const personId = Number(req.body?.personId), spielart = String(req.body?.spielart ?? ""), grund = String(req.body?.grund ?? "").trim();
  if (!Number.isInteger(personId) || personId <= 0) return fehler(res, 400, "personId fehlt.");
  if (!(ARAS_SPIELARTEN as readonly string[]).includes(spielart)) return fehler(res, 400, "Unbekannte Spielart.");
  if (grund.length < 3) return fehler(res, 400, "Bitte einen Grund (ein Satz).");
  try {
    const r = await a.plan.planEinreihen({ personId, spielart, grund, von: wer(req) });
    if (!r.ok) return fehler(res, 400, r.grund ?? "Nicht eingereiht.");
    res.json({ ok: true, id: r.id });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/warteschlange/:id/verschieben", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return nichtVerbunden(res);
  const bis = new Date(String(req.body?.bis ?? ""));
  if (!Number.isFinite(bis.getTime())) return fehler(res, 400, "bis: eine Zeit (ISO).");
  try { await a.plan.planVerschieben(Number(req.params.id), bis, String(req.body?.grund ?? "verschoben"), wer(req)); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/warteschlange/:id/entfernen", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.plan) return nichtVerbunden(res);
  try { await a.plan.planEntfernen(Number(req.params.id), String(req.body?.grund ?? "entfernt"), wer(req)); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

// Live (SSE): Ereignisse des Kerns oder — ohne Kern — nur der Herzschlag mit „nicht verbunden“.
router.get("/chef/aras/live", lesen, (req: ChefRequest, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  const senden = (daten: unknown) => { try { res.write(`event: aras\ndata: ${JSON.stringify(daten)}\n\n`); } catch { /* Verbindung weg */ } };
  const zeig = nameZeigen(req);
  const bus = aras()?.bruecke?.ereignisBus?.() ?? null;
  // Leitung sieht keine Nachnamen im Live-Text (Vertrag § 9): „Herr Müller“ → „Herr …“.
  // Nach dem Ende eines Anrufs (Ereignis „ende“) nichts mehr zu diesem Anruf — sonst legt die Karte den Kasten neu an (E-408, 20.10.).
  const hoerer = (e: any) => { if (e?.nachEnde) return; senden(zeig ? e : { ...e, text: e?.text ? String(e.text).replace(/\b(Herr|Frau)\s+\S+/g, (_m: string, a: string) => `${a} …`) : e?.text }); };
  if (bus) bus.on("aras", hoerer);
  senden({ art: bus ? "verbunden" : "nicht_verbunden", am: new Date().toISOString(), text: bus ? "Live-Strom verbunden." : NICHT_VERBUNDEN });
  const herz = setInterval(() => senden({ art: "herzschlag", am: new Date().toISOString(), laufend: aras()?.waehler?.laufendeSitzungen?.()?.length ?? 0, verbunden: !!aras()?.bruecke }), 15_000);
  req.on("close", () => { clearInterval(herz); if (bus) bus.off("aras", hoerer); });
});

// ── Cockpit (20.10.2026, Justin: „wenn ich auflege, läuft der Kasten dennoch weiter“) ───────────────────────────────
// Der leichte Gegencheck zum Live-Strom: Welche Gespräche laufen WIRKLICH (Brücke) und welche klingeln noch (gewählt,
// noch keine Sitzung, kein Ende in der Datenbank)? Die Seite fragt das alle 2 s, solange ein Live-Kasten steht, und
// nimmt jeden Kasten weg, den es hier nicht mehr gibt — auch wenn ein Ende-Ereignis verloren ging oder ein spätes
// Ereignis (Prüf-Mara, Daumen) den Kasten neu angelegt hätte. Eine kleine Abfrage über den Index von fiaon_aras_anruf.
async function liveNamen(ids: number[]): Promise<Map<number, { name: string | null; gespielt: string | null; personId: number | null }>> {
  const m = new Map<number, { name: string | null; gespielt: string | null; personId: number | null }>();
  if (!ids.length) return m;
  const zeilen = (await sqlPool`
    SELECT aa.call_id, aa.briefing->>'probeSpielart' AS gespielt, c.person_id, p.first_name, p.last_name, p.company_name
      FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id LEFT JOIN fiaon_persons p ON p.id = c.person_id
     WHERE aa.call_id = ANY(${ids})`.catch(() => [])) as any[];
  for (const z of zeilen) {
    const name = [z.first_name, z.last_name].filter(Boolean).join(" ").trim() || z.company_name || null;
    m.set(Number(z.call_id), { name, gespielt: z.gespielt ?? null, personId: z.person_id != null ? Number(z.person_id) : null });
  }
  return m;
}

router.get("/chef/aras/live/stand", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  res.setHeader("Cache-Control", "no-store");
  if (!a?.waehler) return res.json({ ok: true, verbunden: false, am: new Date().toISOString(), laufend: [], klingelt: [] });
  try {
    const laufend = ((a.waehler.laufendeSitzungen?.() ?? []) as any[]).filter((s) => Number(s?.callId) > 0);
    const klingeltRoh = (await sqlPool`
      SELECT aa.call_id, aa.spielart, EXTRACT(EPOCH FROM (NOW() - aa.created_at))::int AS sek, (aa.angenommen_am IS NOT NULL) AS angenommen
        FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id
       WHERE aa.created_at > NOW() - INTERVAL '3 minutes' AND aa.ende_grund IS NULL AND aa.nachbereitet_am IS NULL
         AND c.status IN ('gewaehlt', 'laeuft')
       ORDER BY aa.created_at DESC LIMIT 10`.catch(() => [])) as any[];
    const imKern = new Set(laufend.map((s) => Number(s.callId)));
    const klingelt = klingeltRoh.filter((z) => !imKern.has(Number(z.call_id)));
    const zeig = nameZeigen(req);
    const namen = await liveNamen([...Array.from(imKern), ...klingelt.map((z) => Number(z.call_id))]);
    const info = (callId: number) => namen.get(callId);
    res.json({
      ok: true, verbunden: true, am: new Date().toISOString(),
      laufend: laufend.map((s) => ({
        callId: Number(s.callId), personId: s.personId ?? null, spielart: s.spielart, probe: s.spielart === "probe",
        name: zeig ? info(Number(s.callId))?.name ?? null : null, gespielt: info(Number(s.callId))?.gespielt ?? null,
        seitSek: Number(s.seitSek ?? 0), zustand: String(s.zustand ?? ""), letzteZeilen: Array.isArray(s.letzteZeilen) ? s.letzteZeilen : [],
      })),
      klingelt: klingelt.map((z) => ({
        callId: Number(z.call_id), personId: info(Number(z.call_id))?.personId ?? null, spielart: String(z.spielart), probe: z.spielart === "probe",
        name: zeig ? info(Number(z.call_id))?.name ?? null : null, gespielt: info(Number(z.call_id))?.gespielt ?? null,
        seitSek: Number(z.sek ?? 0), angenommen: z.angenommen === true,
      })),
    });
  } catch (e) {
    console.error("[CHEF-KI] aras/live/stand:", e);
    fehler(res, 500, "Der Live-Stand ließ sich nicht laden.");
  }
});

router.post("/chef/aras/live/:callId/uebernehmen", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.bruecke) return nichtVerbunden(res);
  if (!req.chef?.agentId) return fehler(res, 400, "Übernehmen geht nur mit persönlicher Chef-Anmeldung (dein Softphone).");
  try {
    const r = await a.bruecke.uebernehmen(Number(req.params.callId), req.chef.agentId);
    if (!r.ok) return fehler(res, 409, r.grund ?? "Übernehmen nicht möglich.");
    res.json({ ok: true });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/live/:callId/beenden", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.bruecke) return nichtVerbunden(res);
  try { await a.bruecke.sitzungBeenden(Number(req.params.callId), String(req.body?.grund ?? "chef")); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.get("/chef/aras/anrufe", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.nachbereitung) return nichtVerbunden(res);
  try {
    const zeilen = await a.nachbereitung.anrufListe({ tag: req.query.tag ? String(req.query.tag) : undefined, spielart: req.query.spielart ? String(req.query.spielart) : undefined, ergebnis: req.query.ergebnis ? String(req.query.ergebnis) : undefined, seite: Number(req.query.seite) || 0 });
    const zeig = nameZeigen(req);
    // Cockpit (20.10.2026): Vor- UND Nachname statt nur „Muster“ — lesbar wie ein Satz („Mila Muster · Rate fällig“).
    const namen = zeig ? await vollnamen((zeilen as any[]).map((z) => Number(z.personId)).filter((n) => n > 0)) : new Map<number, string>();
    // … und beim Probeanruf die gespielte Art („Probe · Rate fällig“) aus dem Briefing.
    const probeIds = (zeilen as any[]).filter((z) => z.spielart === "probe").map((z) => Number(z.id));
    const gespielt = new Map<number, string>();
    if (probeIds.length) {
      for (const z of (await sqlPool`SELECT id, briefing->>'probeSpielart' AS g FROM fiaon_aras_anruf WHERE id = ANY(${probeIds})`.catch(() => [])) as any[]) if (z.g) gespielt.set(Number(z.id), String(z.g));
    }
    res.json({ ok: true, zeilen: (zeilen as any[]).map((z) => ({ ...z, gespielt: gespielt.get(Number(z.id)) ?? null, name: zeig ? (z.personId && namen.get(Number(z.personId))) || z.name || null : null })) });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

async function vollnamen(ids: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  if (!ids.length) return m;
  const zeilen = (await sqlPool`SELECT id, first_name, last_name, company_name FROM fiaon_persons WHERE id = ANY(${Array.from(new Set(ids))})`.catch(() => [])) as any[];
  for (const z of zeilen) {
    const n = [z.first_name, z.last_name].filter(Boolean).join(" ").trim() || z.company_name;
    if (n) m.set(Number(z.id), String(n));
  }
  return m;
}

router.get("/chef/aras/anrufe/:id", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.nachbereitung) return nichtVerbunden(res);
  try {
    const id = Number(req.params.id);
    const d = await a.nachbereitung.anrufDetail(id);
    if (!d) return fehler(res, 404, "Diesen Anruf gibt es nicht.");
    // Cockpit (20.10.2026): das Urteil von Prüf-Mara in Klartext (Urteil, Punkte mit Hinweis, Begründung) — vorher stand
    // im Detail nur „Prüf-Mara:“ ohne Inhalt, weil die Liste nur den Status kennt. Wortlaut-Treffer bleiben weg.
    const [pm] = (await sqlPool`
      SELECT urteil, punkte, begruendung, created_at FROM fiaon_ki_pruefung
       WHERE bezug_art = 'aras_anruf' AND bezug_id = ${id} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
    const punkte = (Array.isArray(pm?.punkte) ? pm.punkte : []).slice(0, 8).map((p: any) => ({ regel: String(p?.regel ?? ""), schwere: p?.schwere === "hart" ? "hart" : "weich", hinweis: String(p?.hinweis ?? "").slice(0, 240) }));
    const pruefMara = pm ? { urteil: String(pm.urteil), punkte, begruendung: pm.begruendung ? String(pm.begruendung).slice(0, 600) : null, am: new Date(pm.created_at).toISOString() } : null;
    const zeig = nameZeigen(req);
    const pid = Number((d as any).personId) || 0;
    const voll = zeig && pid ? (await vollnamen([pid])).get(pid) : null;
    res.json({ ok: true, ...(d as object), pruefMara, ...(zeig ? (voll ? { name: voll } : {}) : { name: null }) });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/probeanruf", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.nachbereitung) return nichtVerbunden(res);
  const spielart = String(req.body?.spielart ?? "probe");
  if (!(ARAS_SPIELARTEN as readonly string[]).includes(spielart)) return fehler(res, 400, "Unbekannte Spielart.");
  try {
    const r = await a.nachbereitung.probeanruf({ spielart, personId: req.body?.personId ? Number(req.body.personId) : undefined, von: wer(req), stimme: req.body?.stimme ? String(req.body.stimme) : undefined });
    if (!r.ok) return fehler(res, 400, r.grund ?? "Kein Probeanruf möglich.");
    void chefProtokoll(req, "aras_probeanruf", spielart);
    res.json({ ok: true, callId: r.callId });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.get("/chef/aras/mich-anrufen", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'aras_probe_nummer'`.catch(() => [])) as any[];
  let nummer = String(z?.value ?? "").trim();
  if (!nummer && req.chef?.agentId) {
    const [ag] = (await sqlPool`SELECT phone FROM fiaon_agents WHERE id = ${req.chef.agentId}`.catch(() => [])) as any[];
    nummer = String(ag?.phone ?? "").trim();
  }
  const maskiert = nummer ? nummerMaskiert(nummer) : null;
  res.json({ ok: true, verbunden: !!a?.nachbereitung, nummer: maskiert, gesetzt: !!z?.value, hinweis: a?.nachbereitung ? null : NICHT_VERBUNDEN });
});

router.post("/chef/aras/mich-anrufen", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.nachbereitung || !a.plan) return nichtVerbunden(res);
  try {
    // Beim ersten Mal die Probe-Nummer aus dem Ausweis des Inhabers füllen (nur Inhaber, nur DACH, Vertrag § 5).
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'aras_probe_nummer'`.catch(() => [])) as any[];
    if (!String(z?.value ?? "").trim() && req.chef?.agentId && req.chef.stufe === "inhaber") {
      const [ag] = (await sqlPool`SELECT phone FROM fiaon_agents WHERE id = ${req.chef.agentId}`.catch(() => [])) as any[];
      const tel = String(ag?.phone ?? "").replace(/[^\d+]/g, "");
      if (/^\+(?:49|43|41)\d{6,14}$/.test(tel)) await a.plan.einstellungSetzen("aras_probe_nummer", tel, wer(req));
    }
    const r = await a.nachbereitung.probeanruf({ spielart: String(req.body?.spielart ?? "probe"), von: wer(req), stimme: req.body?.stimme ? String(req.body.stimme) : undefined });
    if (!r.ok) return fehler(res, 400, r.grund ?? "Kein Probeanruf möglich.");
    void chefProtokoll(req, "aras_mich_anrufen", String(req.body?.spielart ?? "probe"));
    res.json({ ok: true, callId: r.callId });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.get("/chef/aras/hoerproben", lesen, async (_req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.hoerprobe) return nichtVerbunden(res);
  try { res.json({ ok: true, zeilen: await a.hoerprobe.hoerprobenListe(), stimmen: a.konstanten?.STIMMEN ?? [], adapter: a.konstanten?.ADAPTER ?? [] }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/hoerprobe", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.hoerprobe) return nichtVerbunden(res);
  const text = String(req.body?.text ?? "").trim().slice(0, 400);
  if (text.length < 5) return fehler(res, 400, "Bitte einen Satz zum Vorsprechen.");
  try {
    const r = await a.hoerprobe.hoerprobeErzeugen({ adapter: String(req.body?.adapter ?? "openai_live"), stimme: String(req.body?.stimme ?? "juni"), beschreibung: req.body?.beschreibung ? String(req.body.beschreibung).slice(0, 400) : undefined, text });
    res.json({ ok: true, id: r.id });
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.get("/chef/aras/hoerprobe/:id/audio", lesen, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.hoerprobe) return nichtVerbunden(res);
  try {
    const r = await a.hoerprobe.hoerprobeAudio(Number(req.params.id));
    if (!r) return fehler(res, 404, "Keine Hörprobe.");
    res.setHeader("Content-Type", r.mime);
    res.setHeader("Cache-Control", "private, max-age=600");
    res.send(r.bytes);
  } catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/hoerprobe/:id/waehlen", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.hoerprobe) return nichtVerbunden(res);
  try { await a.hoerprobe.hoerprobeWaehlen(Number(req.params.id), wer(req)); void chefProtokoll(req, "aras_stimme", `Hörprobe ${req.params.id}`); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/hoerprobe/:id/bewerten", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.hoerprobe) return nichtVerbunden(res);
  const b = Number(req.body?.bewertung);
  if (!Number.isInteger(b) || b < 1 || b > 5) return fehler(res, 400, "bewertung: 1–5.");
  try { await a.hoerprobe.hoerprobeBewerten(Number(req.params.id), b, req.body?.kommentar ? String(req.body.kommentar).slice(0, 400) : undefined); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/notaus", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.waehler) return nichtVerbunden(res);
  try { const r = await a.waehler.notaus(wer(req), String(req.body?.grund ?? "Chefbüro")); void chefProtokoll(req, "aras_notaus", "an"); res.json({ ok: true, beendet: r.beendet }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/start", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.waehler) return nichtVerbunden(res);
  try { await a.waehler.start(wer(req)); void chefProtokoll(req, "aras_notaus", "aus"); res.json({ ok: true }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

router.post("/chef/aras/leerlauf", wache, async (req: ChefRequest, res: Response) => {
  const a = aras();
  if (!a?.waehler) return nichtVerbunden(res);
  try { const r = await a.waehler.leerlauf(req.body?.an !== false, wer(req)); void chefProtokoll(req, "aras_leerlauf", req.body?.an !== false ? "an" : "aus"); res.json({ ok: true, laufend: r.laufend }); }
  catch (e) { fehler(res, 500, String((e as Error)?.message ?? e).slice(0, 200)); }
});

export default router;
