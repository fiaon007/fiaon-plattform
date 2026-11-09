// ═══════════════════════════════════════════════════════════════════════════
// ROUTEN: LIEFERSTRECKE DES KOOPERATIONSVERTRAGS (E-386, 16.10.2026)
//
// Akte (requireAgent + darfAnKunde — wer den Kunden betreut, und die Leitung):
//   GET  /agent/kunden/:personId/koop                Lage: Interessent, Partner, Themen, freie Termine, Einwilligungen, Kontakte
//   POST /agent/kunden/:personId/koop/kontakt        { angebotId, thema, termin, art, notiz, einwilligung: true, bestaetigt[] }
//   POST /agent/kunden/:personId/koop/interesse      { ja: boolean }  — Interesse / kein Interesse aus dem Gespräch
//   POST /agent/kunden/:personId/koop/widerruf       { grund? }       — Einwilligung widerrufen (Partner erfährt es)
// Kunde (requireKunde — signiertes Cookie):
//   GET  /kunde/:ref/app/partner-gespraech           die ruhige Karte im Kundenbereich — E-487: { lage } („Ihr Vorsorge-Überblick“)
//   POST /kunde/:ref/app/partner-gespraech           { ja: boolean }  (Altweg: Interesse / kein Interesse)
//   E-487 (09.11.2026) — Vorsorge-Überblick und Selbstbuchung (server/lib/fiaon-vorsorge.ts), dieselben Wege wie die Seite:
//   POST /kunde/:ref/app/partner-gespraech/ueberblick      { themen: string[] }
//   POST /kunde/:ref/app/partner-gespraech/buchen          { angebotId, thema, termin, art, einwilligung: true, bestaetigt[] }
//   POST /kunde/:ref/app/partner-gespraech/kein-interesse
//   POST /kunde/:ref/app/partner-gespraech/absagen
// Persönlicher Link (E-487, ohne Anmeldung, signiert, 30 Tage, gedrosselt, noindex — Knopf in Maras Mail):
//   GET  /koop/vorsorge/:token                       { lage } — oder { code: abgelaufen | ungueltig }
//   POST /koop/vorsorge/:token/ueberblick | /buchen | /kein-interesse | /absagen   (wie oben; die Vorschau speichert nie)
// Partner (signierter Link ohne Ablauf, widerrufbar — server/lib/fiaon-koop-lieferung.ts):
//   GET  /koop/partner/:token                        Stand, Zeiten, Kontakte, Rechnungen
//   POST /koop/partner/:token/zeiten                 { tage, von, bis, dauerMin, arten }
//   POST /koop/partner/:token/wunsch                 { wunschWoche }
//   POST /koop/partner/:token/kontakt/:id/reklamation { grund, wahl, text? }
//   POST /koop/partner/:token/kontakt/:id/kein-kontakt
//   POST /koop/partner/:token/kontakt/:id/abschluss    { sparte } — Energie/Telefon (E-390)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { personFuerRef, keinePerson } from "./fiaon-app";
import {
  koopAkteLage, koopKontaktAnlegen, koopInteresseVermerken, koopWiderruf, koopKundeLage,
  koopAngebotAusToken, koopPartnerSicht, koopZeitenSetzen, koopWunschSetzen, koopReklamieren, koopKeinKontakt, koopAbschlussMelden,
} from "../lib/fiaon-koop-lieferung";
import { koopDatenAus } from "../lib/fiaon-global-angebot-koop";
import { koopPartnerName } from "@shared/fiaon-global-angebot-koop";
import { fensterDrossel } from "../lib/fiaon-global-bereich-regeln";
import { KOOP_INTERESSE } from "@shared/fiaon-koop-lieferung";
import { VORSORGE_TEXTE } from "@shared/fiaon-vorsorge";

const router = Router();

async function zugang(req: AgentRequest, res: Response): Promise<number | null> {
  const personId = Number(req.params.personId);
  if (!Number.isInteger(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Ungültiger Kunde." }); return null; }
  const rolle = await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Nicht dein Kunde." }); return null; }
  return personId;
}
const ipVon = (req: Request) => (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;

// ── Akte ────────────────────────────────────────────────────────────────────
router.get("/agent/kunden/:personId/koop", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = await zugang(req, res); if (!personId) return;
    res.setHeader("Cache-Control", "no-store");
    res.json(await koopAkteLage(personId));
  } catch (err) {
    console.error("[KOOP] Akte-Lage:", err);
    res.status(500).json({ ok: false, error: "Die Partner-Termine ließen sich nicht laden." });
  }
});
router.post("/agent/kunden/:personId/koop/kontakt", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = await zugang(req, res); if (!personId) return;
    const b = req.body ?? {};
    const r = await koopKontaktAnlegen(personId, {
      angebotId: Number(b.angebotId), thema: String(b.thema ?? ""), termin: String(b.termin ?? ""), art: String(b.art ?? ""),
      notiz: typeof b.notiz === "string" ? b.notiz : "", einwilligung: b.einwilligung === true, bestaetigt: Array.isArray(b.bestaetigt) ? b.bestaetigt : [],
    }, { name: req.agent!.name, agentId: req.agent!.id });
    if (!r.ok) return res.status(r.status).json({ ok: false, error: r.error });
    res.json(r);
  } catch (err) {
    console.error("[KOOP] Kontakt:", err);
    res.status(500).json({ ok: false, error: "Der Kontakt ließ sich nicht speichern." });
  }
});
router.post("/agent/kunden/:personId/koop/interesse", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = await zugang(req, res); if (!personId) return;
    await koopInteresseVermerken(personId, { ja: req.body?.ja === true, kanal: "telefon", von: req.agent!.name, agentId: req.agent!.id });
    res.json({ ok: true, meldung: req.body?.ja === true ? "Interesse vermerkt." : "Vermerkt: kein Interesse — der Kunde wird nicht mehr danach gefragt." });
  } catch (err) {
    console.error("[KOOP] Interesse:", err);
    res.status(500).json({ ok: false, error: "Ließ sich nicht speichern." });
  }
});
router.post("/agent/kunden/:personId/koop/widerruf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = await zugang(req, res); if (!personId) return;
    const r = await koopWiderruf(personId, { name: req.agent!.name, kanal: "telefon", grund: typeof req.body?.grund === "string" ? req.body.grund.slice(0, 300) : null });
    res.json({ ...r, meldung: `Widerruf gespeichert — ${r.storniert} geplante Übermittlung(en) zurückgenommen, ${r.partnerInformiert} Partner informiert.` });
  } catch (err) {
    console.error("[KOOP] Widerruf:", err);
    res.status(500).json({ ok: false, error: "Der Widerruf ließ sich nicht speichern — bitte gleich noch einmal." });
  }
});

// ── Kundenbereich ───────────────────────────────────────────────────────────
// E-487 (09.11.2026): Die Karte heißt „Ihr Vorsorge-Überblick“ und bucht direkt — dieselbe Lage und dieselben Wege wie die
// Seite des persönlichen Links (server/lib/fiaon-vorsorge.ts). `texte` reist für eine noch offene alte Seite mit.
router.get("/kunde/:ref/app/partner-gespraech", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    res.setHeader("Cache-Control", "no-store");
    const { vorsorgeLage } = await import("../lib/fiaon-vorsorge");
    res.json({ ok: true, lage: await vorsorgeLage(p.personId, { kontext: "karte" }), texte: KOOP_INTERESSE });
  } catch (err) {
    console.error("[KOOP] Kundenbereich:", err);
    res.json({ ok: true, lage: null, zeigen: false });
  }
});
router.post("/kunde/:ref/app/partner-gespraech", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const lage = await koopKundeLage(p.personId);
    const ja = req.body?.ja === true;
    if (ja && !lage.zeigen) return res.status(409).json({ ok: false, error: "Das geht für Ihr Konto gerade nicht. Schreiben Sie uns gern an support@fiaon.com." });
    if (!ja && lage.stand === "termin") {
      await koopWiderruf(p.personId, { name: p.name, kanal: "kundenbereich", grund: "Im Kundenbereich: Gespräch nicht mehr gewünscht" });
    } else {
      await koopInteresseVermerken(p.personId, { ja, kanal: "kundenbereich", von: `${p.name} (Kundenbereich)`, ip: ipVon(req), userAgent: String(req.headers["user-agent"] ?? "") });
    }
    res.json({ ok: true, ...(await koopKundeLage(p.personId)) });
  } catch (err) {
    console.error("[KOOP] Kundenbereich speichern:", err);
    res.status(500).json({ ok: false, error: "Das ließ sich gerade nicht speichern. Bitte versuchen Sie es gleich noch einmal." });
  }
});

// ── E-487: Vorsorge-Überblick und Selbstbuchung — Kundenbereich ────────────
type VorsorgeAktion = "ueberblick" | "buchen" | "kein-interesse" | "absagen";
const VORSORGE_AKTIONEN: VorsorgeAktion[] = ["ueberblick", "buchen", "kein-interesse", "absagen"];
/** Eine Handlung des Kunden — derselbe Weg für Kundenbereich und persönlichen Link. Antwort: { ok, meldung, lage } oder { ok: false, error }. */
async function vorsorgeHandlung(aktion: VorsorgeAktion, personId: number, name: string, req: Request, quelle: "link" | "kundenbereich"): Promise<{ status: number; body: Record<string, unknown> }> {
  const V = await import("../lib/fiaon-vorsorge");
  const meta = { quelle, ip: ipVon(req), userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null };
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (aktion === "ueberblick") {
    const r = await V.vorsorgeUeberblickSpeichern(personId, b.themen, meta);
    return r.ok ? { status: 200, body: r } : { status: r.status, body: { ok: false, error: r.error } };
  }
  if (aktion === "buchen") {
    const r = await V.vorsorgeBuchen(personId, b, meta);
    return r.ok ? { status: 200, body: r } : { status: r.status, body: { ok: false, error: r.error, lage: r.lage ?? null } };
  }
  if (aktion === "kein-interesse") {
    return { status: 200, body: { ok: true, meldung: VORSORGE_TEXTE.keinInteresseDanke, lage: await V.vorsorgeKeinInteresse(personId, name, meta) } };
  }
  return { status: 200, body: { ok: true, meldung: VORSORGE_TEXTE.abgesagt, lage: await V.vorsorgeAbsagen(personId, name, meta) } };
}
for (const aktion of VORSORGE_AKTIONEN) {
  router.post(`/kunde/:ref/app/partner-gespraech/${aktion}`, requireKunde, async (req: KundeRequest, res: Response) => {
    try {
      const p = await personFuerRef(req.kundeRef!);
      if (!p) return keinePerson(res);
      res.setHeader("Cache-Control", "no-store");
      const r = await vorsorgeHandlung(aktion, p.personId, p.name, req, "kundenbereich");
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error(`[VORSORGE] Kundenbereich ${aktion}:`, err);
      res.status(500).json({ ok: false, error: VORSORGE_TEXTE.fehler });
    }
  });
}

// ── E-487: der persönliche Link /vorsorge/<signiert> — ohne Anmeldung ──────
const vorsorgeDrossel = fensterDrossel(60, 10 * 60_000);
const vorsorgeSchreibDrossel = fensterDrossel(20, 10 * 60_000);
/** Link prüfen, drosseln, Kopfzeilen setzen. null = Antwort ist schon geschrieben. */
async function vorsorgeZugang(req: Request, res: Response, schreiben: boolean): Promise<{ art: "person"; personId: number; name: string } | { art: "vorschau" } | null> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  const ip = ipVon(req) ?? "?";
  if (vorsorgeDrossel(ip) || (schreiben && vorsorgeSchreibDrossel(ip))) {
    res.status(429).json({ ok: false, error: "Zu viele Anfragen — bitte in ein paar Minuten noch einmal." });
    return null;
  }
  const { vorsorgeTokenPruefen } = await import("../lib/fiaon-vorsorge");
  const t = vorsorgeTokenPruefen(req.params.token);
  if (!t) { res.status(404).json({ ok: false, code: "ungueltig", error: VORSORGE_TEXTE.linkUngueltig }); return null; }
  if (t.abgelaufen) { res.status(410).json({ ok: false, code: "abgelaufen", error: VORSORGE_TEXTE.linkAbgelaufen }); return null; }
  if (t.art === "vorschau") return { art: "vorschau" };
  const { sqlPool } = await import("../lib/db-pool");
  const [p] = (await sqlPool`SELECT first_name, last_name FROM fiaon_persons WHERE id = ${t.personId} AND merged_into_person_id IS NULL`) as any[];
  if (!p) { res.status(404).json({ ok: false, code: "ungueltig", error: VORSORGE_TEXTE.linkUngueltig }); return null; }
  return { art: "person", personId: t.personId, name: `${String(p.first_name ?? "").trim()} ${String(p.last_name ?? "").trim()}`.trim() };
}
router.get("/koop/vorsorge/:token", async (req: Request, res: Response) => {
  try {
    const z = await vorsorgeZugang(req, res, false); if (!z) return;
    const V = await import("../lib/fiaon-vorsorge");
    if (z.art === "vorschau") return res.json({ ok: true, lage: await V.vorsorgeVorschauLage() });
    // „Geöffnet“ zählt für den Trichter im Mailwerk — scheitert das, lädt die Seite trotzdem.
    await V.vorsorgeLinkGeoeffnet(z.personId).catch((e) => console.error("[VORSORGE] geöffnet:", e));
    res.json({ ok: true, lage: await V.vorsorgeLage(z.personId, { kontext: "seite" }) });
  } catch (err) {
    console.error("[VORSORGE] Seite:", err);
    res.status(500).json({ ok: false, error: VORSORGE_TEXTE.fehler });
  }
});
for (const aktion of VORSORGE_AKTIONEN) {
  router.post(`/koop/vorsorge/:token/${aktion}`, async (req: Request, res: Response) => {
    try {
      const z = await vorsorgeZugang(req, res, true); if (!z) return;
      if (z.art === "vorschau") return res.status(403).json({ ok: false, error: VORSORGE_TEXTE.vorschau });
      const r = await vorsorgeHandlung(aktion, z.personId, z.name, req, "link");
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error(`[VORSORGE] Seite ${aktion}:`, err);
      res.status(500).json({ ok: false, error: VORSORGE_TEXTE.fehler });
    }
  });
}

// ── Partnerbereich ──────────────────────────────────────────────────────────
const drossel = fensterDrossel(60, 10 * 60_000);
async function partner(req: Request, res: Response) {
  const ip = ipVon(req) ?? "?";
  if (drossel(ip)) { res.status(429).json({ ok: false, error: "Zu viele Anfragen — bitte in ein paar Minuten noch einmal." }); return null; }
  const z = await koopAngebotAusToken(req.params.token);
  if (!z) { res.status(404).json({ ok: false, error: "Dieser Link ist ungültig. Bitte nutzen Sie den Link aus unserer letzten E-Mail oder schreiben Sie an support@fiaon.com." }); return null; }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return z;
}
const wer = (z: any) => `${koopPartnerName(koopDatenAus(z).partner)} (Partnerbereich)`;
router.get("/koop/partner/:token", async (req: Request, res: Response) => {
  try { const z = await partner(req, res); if (!z) return; res.json(await koopPartnerSicht(z)); }
  catch (err) { console.error("[KOOP] Partnerbereich:", err); res.status(500).json({ ok: false, error: "Ihr Partnerbereich ließ sich gerade nicht laden." }); }
});
router.post("/koop/partner/:token/zeiten", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const r = await koopZeitenSetzen(z, req.body, wer(z));
    return r.ok ? res.json(r) : res.status(r.status).json(r);
  } catch (err) { console.error("[KOOP] Zeiten:", err); res.status(500).json({ ok: false, error: "Ihre Zeiten ließen sich nicht speichern." }); }
});
// E-419: Der Partner meldet selbst eine Empfehlung an FIAON (mit Einverständnis der Person) — sofort in seiner Liste, Aufgabe an Justin.
// E-487 Nachbesserung (Gutachten, Mangel 2): Eine Personen-Nummer aus dem Partnerbereich zählt nie (koopEmpfehlungEintragen setzt null).
router.post("/koop/partner/:token/empfehlung", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const { koopEmpfehlungEintragen } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopEmpfehlungEintragen(z, req.body, wer(z), "partner", koopPartnerName(koopDatenAus(z).partner));
    // E-487 Nachbesserung: an den Partner nur „gespeichert“ — ob und warum ein Lead entstand, bleibt im Haus.
    return r.ok ? res.json({ ok: true, id: r.id }) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[KOOP] Empfehlung:", err); res.status(500).json({ ok: false, error: "Ihre Empfehlung ließ sich gerade nicht speichern." }); }
});
// E-420: Bankverbindung für Provisionen (vom Partner selbst) und die Gutschriften als PDF.
router.post("/koop/partner/:token/bank", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const { koopBankSetzen } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopBankSetzen(z, req.body, wer(z));
    return r.ok ? res.json(r) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[KOOP] Bank:", err); res.status(500).json({ ok: false, error: "Ihre Bankverbindung ließ sich gerade nicht speichern." }); }
});
router.get("/koop/partner/:token/gutschrift/:gid.pdf", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const { koopGutschriftPdf, ensureGutschriftTabelle } = await import("../lib/fiaon-koop-empfehlung");
    await ensureGutschriftTabelle();
    const { sqlPool } = await import("../lib/db-pool");
    const [g] = (await sqlPool`SELECT id FROM fiaon_koop_gutschriften WHERE id = ${Number(req.params.gid)} AND angebot_id = ${Number(z.id)}`) as any[];
    const p = g ? await koopGutschriftPdf(Number(g.id)) : null;
    if (!p) return res.status(404).json({ ok: false, error: "Diese Gutschrift gibt es nicht." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${p.dateiname}"`);
    res.send(p.pdf);
  } catch (err) { console.error("[KOOP] Gutschrift-PDF:", err); res.status(500).json({ ok: false, error: "Die Gutschrift ließ sich gerade nicht laden." }); }
});
router.post("/koop/partner/:token/wunsch", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const r = await koopWunschSetzen(z, req.body?.wunschWoche, wer(z));
    return r.ok ? res.json(r) : res.status(r.status).json(r);
  } catch (err) { console.error("[KOOP] Wunsch:", err); res.status(500).json({ ok: false, error: "Ihre Menge ließ sich nicht speichern." }); }
});
router.post("/koop/partner/:token/kontakt/:id/reklamation", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const r = await koopReklamieren(z, Number(req.params.id), { grund: req.body?.grund, wahl: req.body?.wahl, text: req.body?.text });
    return r.ok ? res.json(r) : res.status(r.status).json(r);
  } catch (err) { console.error("[KOOP] Reklamation:", err); res.status(500).json({ ok: false, error: "Die Reklamation ließ sich nicht speichern." }); }
});
// E-390: Energie und Telefon — der Partner meldet den Abschluss { sparte: "Strom" | "Gas" | … | "kein" }.
router.post("/koop/partner/:token/kontakt/:id/abschluss", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const r = await koopAbschlussMelden(z, Number(req.params.id), req.body?.sparte);
    return r.ok ? res.json(r) : res.status(r.status).json(r);
  } catch (err) { console.error("[KOOP] Abschluss:", err); res.status(500).json({ ok: false, error: "Die Meldung ließ sich nicht speichern." }); }
});
router.post("/koop/partner/:token/kontakt/:id/kein-kontakt", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const r = await koopKeinKontakt(z, Number(req.params.id));
    return r.ok ? res.json(r) : res.status(r.status).json(r);
  } catch (err) { console.error("[KOOP] Kein Kontakt:", err); res.status(500).json({ ok: false, error: "Ließ sich nicht speichern." }); }
});

export default router;
