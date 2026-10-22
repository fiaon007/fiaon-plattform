// ═══════════════════════════════════════════════════════════════════════════
// ROUTEN: LIEFERSTRECKE DES KOOPERATIONSVERTRAGS (E-386, 16.10.2026)
//
// Akte (requireAgent + darfAnKunde — wer den Kunden betreut, und die Leitung):
//   GET  /agent/kunden/:personId/koop                Lage: Interessent, Partner, Themen, freie Termine, Einwilligungen, Kontakte
//   POST /agent/kunden/:personId/koop/kontakt        { angebotId, thema, termin, art, notiz, einwilligung: true, bestaetigt[] }
//   POST /agent/kunden/:personId/koop/interesse      { ja: boolean }  — Interesse / kein Interesse aus dem Gespräch
//   POST /agent/kunden/:personId/koop/widerruf       { grund? }       — Einwilligung widerrufen (Partner erfährt es)
// Kunde (requireKunde — signiertes Cookie):
//   GET  /kunde/:ref/app/partner-gespraech           die ruhige Karte im Kundenbereich
//   POST /kunde/:ref/app/partner-gespraech           { ja: boolean }
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
router.get("/kunde/:ref/app/partner-gespraech", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await koopKundeLage(p.personId)) });
  } catch (err) {
    console.error("[KOOP] Kundenbereich:", err);
    res.json({ ok: true, zeigen: false });
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
router.post("/koop/partner/:token/empfehlung", async (req: Request, res: Response) => {
  try {
    const z = await partner(req, res); if (!z) return;
    const { koopEmpfehlungEintragen } = await import("../lib/fiaon-koop-empfehlung");
    const r = await koopEmpfehlungEintragen(z, req.body, wer(z), "partner", koopPartnerName(koopDatenAus(z).partner));
    return r.ok ? res.json(r) : res.status(r.status ?? 400).json(r);
  } catch (err) { console.error("[KOOP] Empfehlung:", err); res.status(500).json({ ok: false, error: "Ihre Empfehlung ließ sich gerade nicht speichern." }); }
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
