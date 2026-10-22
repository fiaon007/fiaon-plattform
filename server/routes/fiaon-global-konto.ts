// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ROUTEN DES PERSÖNLICHEN ZUGANGS (E-423, 22.10.2026)
//
// Der Kunde (öffentlich, gebremst, ohne Aufzählbarkeit):
//   POST /global/konto/anmelden            { email, passwort, bleiben, sprache } → { vorgang, maske }
//   POST /global/konto/code                { vorgang, code }                     → Cookie + { weiter }
//   POST /global/konto/code-neu            { vorgang }
//   POST /global/konto/passwort-vergessen  { email }                             → immer derselbe Satz
//   POST /global/konto/link                { token }                             → Name/Firma für „Zugang einrichten“
//   POST /global/konto/passwort-setzen     { token, passwort, wiederholung, bleiben } → { vorgang, maske }
//   GET  /global/konto/ich                 (Sitzung)                             → Übersicht „Ihre Aufträge“
//   POST /global/konto/abmelden
//   POST /global/konto/einrichten          { ref, t }  (Banner im Portal, gültiger Link) → { pfad }
//   GET  /global/konto/angebot/:id/vertrag.pdf (Sitzung)
// Die Leitung (Chefbüro, requireChef „leitung“):
//   GET  /chef/global/zugaenge             alle Kundenzugänge mit Stand
//   POST /chef/global/zugaenge/einladen    { email, nurLink? } — „Zugang einladen“ / „Einladung erneut senden“ /
//                                          „Nur Link erzeugen“ (keine Mail, der Link kommt zurück für eine persönliche Mail)
//
// Der Ablauf steht in server/lib/fiaon-global-konto.ts, die Sätze in shared/fiaon-global-konto.ts.
// Die IP kommt aus req.ip (trust proxy 1, server/index.ts) — nie aus dem ERSTEN X-Forwarded-For-Eintrag, den setzt
// der Browser selbst. Antworten dieser Pfade stehen nie im Zugriffslog (/api/fiaon/global/…, server/index.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import {
  kontoAnmelden, kontoCodePruefen, kontoCodeNeu, kontoPasswortVergessen, kontoLinkLesen, kontoPasswortSetzen, kontoSitzungLesen,
  kontoAbmelden, kontoUebersicht, kontoCookieSetzen, kontoAngebotVertrag, kontoEinrichtenAusPortal, kontoZugaengeListe, globalKontoEinladen,
  kontoStartziel, type Anfrage,
} from "../lib/fiaon-global-konto";
import { KONTO_SAETZE, type KontoSprache } from "@shared/fiaon-global-konto";

const router = Router();

function anfrage(req: Request): Anfrage {
  const s = String(req.body?.sprache ?? req.query?.sprache ?? "").toLowerCase() === "en" ? "en" : "de";
  return { ip: String(req.ip || req.socket?.remoteAddress || ""), ua: String(req.headers["user-agent"] || ""), sprache: s as KontoSprache };
}
function keinSpeicher(res: Response) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
}
function antwort(res: Response, erg: { ok: boolean; status?: number; error?: string } & Record<string, unknown>) {
  if (!erg.ok) return res.status(Number(erg.status) || 400).json({ ok: false, error: erg.error, code: erg.code, ...(erg.email ? { email: erg.email } : {}) });
  const { ok: _ok, status: _s, ...rest } = erg;
  return res.json({ ok: true, ...rest });
}
function technik(res: Response, wo: string, err: unknown, s: KontoSprache = "de") {
  console.error(`[GLOBAL-KONTO] ${wo}:`, err);
  if (!res.headersSent) res.status(500).json({ ok: false, error: KONTO_SAETZE[s].technik });
}

// ═══ DER KUNDE ═══════════════════════════════════════════════════════════════
router.post("/global/konto/anmelden", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  try {
    antwort(res, await kontoAnmelden({ email: req.body?.email, passwort: req.body?.passwort, bleiben: req.body?.bleiben }, a));
  } catch (err) { technik(res, "anmelden", err, a.sprache); }
});

router.post("/global/konto/code", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  try {
    const erg = await kontoCodePruefen({ vorgang: req.body?.vorgang, code: req.body?.code }, a);
    if (!erg.ok) return antwort(res, erg);
    kontoCookieSetzen(res, erg.sitzung, erg.bleiben);
    // Wunschziel (?weiter=… der Anmeldeseite) nur, wenn es zur Business-Welt gehört UND das Konto es sehen darf.
    const weiter = req.body?.weiter ? await kontoStartziel(erg.kontoId, a.sprache ?? "de", req.body.weiter) : erg.weiter;
    res.json({ ok: true, weiter });
  } catch (err) { technik(res, "code", err, a.sprache); }
});

router.post("/global/konto/code-neu", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  try { antwort(res, await kontoCodeNeu({ vorgang: req.body?.vorgang }, a)); } catch (err) { technik(res, "code-neu", err, a.sprache); }
});

router.post("/global/konto/passwort-vergessen", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  // Honigtopf wie /global/zugang: ein Feld, das Menschen nicht sehen.
  if (String(req.body?.falle ?? "").trim()) return res.json({ ok: true, text: KONTO_SAETZE[a.sprache ?? "de"].vergessenOk });
  res.json(await kontoPasswortVergessen({ email: req.body?.email }, a));
});

router.post("/global/konto/link", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  try { antwort(res, await kontoLinkLesen({ token: req.body?.token }, a)); } catch (err) { technik(res, "link", err, a.sprache); }
});

router.post("/global/konto/passwort-setzen", async (req: Request, res: Response) => {
  keinSpeicher(res);
  const a = anfrage(req);
  try {
    antwort(res, await kontoPasswortSetzen({ token: req.body?.token, passwort: req.body?.passwort, wiederholung: req.body?.wiederholung, bleiben: req.body?.bleiben }, a));
  } catch (err) { technik(res, "passwort-setzen", err, a.sprache); }
});

router.get("/global/konto/ich", async (req: Request, res: Response) => {
  keinSpeicher(res);
  try {
    const s = await kontoSitzungLesen(req, res);
    if (!s) return res.status(401).json({ ok: false, code: "anmelden", error: KONTO_SAETZE[anfrage(req).sprache ?? "de"].sitzungFehlt });
    res.json({ ok: true, ...(await kontoUebersicht(s.kontoId)) });
  } catch (err) { technik(res, "ich", err); }
});

router.post("/global/konto/abmelden", async (req: Request, res: Response) => {
  keinSpeicher(res);
  try { await kontoAbmelden(req, res); res.json({ ok: true }); } catch (err) { technik(res, "abmelden", err); }
});

/** Das Banner im Portal: nur mit GÜLTIGEM Link zur Akte und solange zu ihr kein Zugang eingerichtet ist. */
router.post("/global/konto/einrichten", async (req: Request, res: Response) => {
  keinSpeicher(res);
  try {
    const ref = String(req.body?.ref ?? "").trim();
    const { globalTokenPruefen } = await import("../lib/fiaon-global-auftrag");
    if (globalTokenPruefen(ref, req.body?.t) !== "gueltig") return res.status(403).json({ ok: false, error: KONTO_SAETZE.de.linkUngueltig });
    const { refAktivesKonto } = await import("../lib/fiaon-global-konto");
    if (await refAktivesKonto(ref)) return res.status(409).json({ ok: false, code: "schon_eingerichtet", error: KONTO_SAETZE.de.sitzungFehlt });
    antwort(res, await kontoEinrichtenAusPortal(ref));
  } catch (err) { technik(res, "einrichten", err); }
});

router.get("/global/konto/angebot/:id/vertrag.pdf", async (req: Request, res: Response) => {
  keinSpeicher(res);
  try {
    const s = await kontoSitzungLesen(req, res);
    if (!s) return res.status(401).json({ ok: false, code: "anmelden", error: KONTO_SAETZE.de.sitzungFehlt });
    const d = await kontoAngebotVertrag(s.kontoId, Number(req.params.id));
    if (!d) return res.status(404).json({ ok: false, error: s.sprache === "en" ? "This contract is not available." : "Diesen Vertrag gibt es hier nicht." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${d.dateiname}"`);
    res.setHeader("Content-Length", String(d.pdf.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(d.pdf);
  } catch (err) { technik(res, "vertrag.pdf", err); }
});

// ═══ DIE LEITUNG ═════════════════════════════════════════════════════════════
async function chefName(req: Request): Promise<string> {
  const c = (req as ChefRequest).chef;
  if (c?.agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${c.agentId} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Chefbüro";
}

router.get("/chef/global/zugaenge", requireChef("leitung"), async (_req: Request, res: Response) => {
  keinSpeicher(res);
  try { res.json({ ok: true, zugaenge: await kontoZugaengeListe() }); } catch (err) {
    console.error("[GLOBAL-KONTO] chef liste:", err);
    res.status(500).json({ ok: false, error: "Die Kundenzugänge lassen sich gerade nicht laden." });
  }
});

router.post("/chef/global/zugaenge/einladen", requireChef("leitung"), async (req: Request, res: Response) => {
  keinSpeicher(res);
  try {
    // `nurLink` (zweiter Knopf „Nur Link erzeugen“): keine Systemmail — der Link kommt zurück für eine persönliche Mail.
    const nurLink = req.body?.nurLink === true;
    const erg = await globalKontoEinladen(String(req.body?.email ?? ""), await chefName(req), { nurLink });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung, ...(nurLink && erg.link ? { link: erg.link, gueltigBis: erg.gueltigBis } : {}) });
  } catch (err) {
    console.error("[GLOBAL-KONTO] chef einladen:", err);
    res.status(500).json({ ok: false, error: "Die Einladung ließ sich gerade nicht senden." });
  }
});

export default router;
