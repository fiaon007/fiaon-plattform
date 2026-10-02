// ═══════════════════════════════════════════════════════════════════════════
// TELEFONKARTEI — Routen (21.09.2026, E-201)
//
// Nur im Chefbüro und nur für die Stufe „inhaber": Justin wollte die Seite
// ausdrücklich „für mich" — die Texte tragen seinen Namen, der Terminlink führt
// in SEINEN Kalender. Die Logik steht in server/lib/fiaon-telefonkartei.ts.
// E-259 (29.09.2026): WhatsApp geht über das FIAON-Konto bei Meta — die Seite
// fragt vorher, was jeder Fall täte (whatsapp-lage), und sendet nie selbst.
// E-274 (02.10.2026): die freie E-Mail aus der Akte (mail-lage, mail/vorschau,
// mail) — dieselbe Wache wie jede Route hier.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  karteiListe, karteiZaehler, karteEinzeln, vcardText, vcardDateiname,
  ergebnisFesthalten, stornieren, stornoZuruecknehmen, karteiWaLage, karteiNachricht,
  rueckrufListe, rueckrufErledigt, rueckrufIcs, termineListe, akteurName, antragLinkFuer, karteiSperre,
  karteiMailLage, karteiMail,
} from "../lib/fiaon-telefonkartei";
import { istKarteiGruppe, istKarteiErgebnis } from "@shared/fiaon-telefonkartei";

const router = Router();
const wache = requireChef("inhaber");

function personIdAus(req: ChefRequest, res: Response): number | null {
  const id = Number(req.params.personId);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ ok: false, error: "Ungültige Kundenkennung." }); return null; }
  return id;
}

/** GET /chef/telefonkartei?gruppe=A&suche=…&seite=0&gesperrte=1 — Karten und Zähler. */
router.get("/chef/telefonkartei", wache, async (req: ChefRequest, res: Response) => {
  try {
    const gruppe = istKarteiGruppe(req.query.gruppe) ? req.query.gruppe : "alle";
    const gesperrte = String(req.query.gesperrte || "") === "1";
    const suche = String(req.query.suche || "").slice(0, 80);
    const seite = Number(req.query.seite) || 0;
    const [liste, zaehler, absender] = await Promise.all([
      karteiListe({ gruppe, suche, seite, gesperrte }),
      seite === 0 ? karteiZaehler(gesperrte) : Promise.resolve(null),
      akteurName(req.chef?.agentId),
    ]);
    res.json({ ok: true, gruppe, ...liste, zaehler, absender });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] liste:", e);
    res.status(500).json({ ok: false, error: "Die Kartei konnte nicht geladen werden." });
  }
});

/**
 * POST /chef/telefonkartei/weitere { gruppe, suche?, gesperrte?, ohne: number[] }
 * — „Weitere laden" (Nachbesserung E-259, 29.09.2026): die nächstbesten Karten
 * OHNE die schon gezeigten, statt per OFFSET zu blättern. Die Reihenfolge hängt
 * seit E-259 an Justins eigenen Klicks; mit OFFSET fehlten danach Kunden, und
 * schon gezeigte standen doppelt da. POST, weil die Liste lang werden kann.
 */
router.post("/chef/telefonkartei/weitere", wache, async (req: ChefRequest, res: Response) => {
  try {
    const gruppe = istKarteiGruppe(req.body?.gruppe) ? req.body.gruppe : "alle";
    const ohne = (Array.isArray(req.body?.ohne) ? req.body.ohne : [])
      .map((n: unknown) => Number(n)).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 20_000);
    const liste = await karteiListe({
      gruppe, suche: String(req.body?.suche || "").slice(0, 80), gesperrte: req.body?.gesperrte === true, ohne,
    });
    res.json({ ok: true, gruppe, ...liste });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] weitere:", e);
    res.status(500).json({ ok: false, error: "Die Kartei konnte nicht geladen werden." });
  }
});

/** GET /chef/telefonkartei/termine — Rückrufe (Justins eigene) und gebuchte Termine. */
router.get("/chef/telefonkartei/termine", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { gruenderAgentId } = await import("./fiaon-gruender-termin");
    const meine = [await gruenderAgentId().catch(() => 0), Number(req.chef?.agentId || 0)];
    const [rueckrufe, termine] = await Promise.all([rueckrufListe(), termineListe(meine)]);
    res.json({ ok: true, rueckrufe, termine });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] termine:", e);
    res.status(500).json({ ok: false, error: "Die Termine konnten nicht geladen werden." });
  }
});

/** GET /chef/telefonkartei/karte/:personId — eine Karte frisch (nach einem Knopfdruck). */
router.get("/chef/telefonkartei/karte/:personId", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const karte = await karteEinzeln(id);
    if (!karte) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden." });
    res.json({ ok: true, karte });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] karte:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * GET /chef/telefonkartei/:personId/kontakt.vcf — die Kontaktkarte fürs iPhone.
 * `inline`: Safari zeigt sie als Kontakt („Neuen Kontakt erstellen"), statt sie
 * als Datei abzulegen.
 */
router.get("/chef/telefonkartei/:personId/kontakt.vcf", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const karte = await karteEinzeln(id);
    if (!karte) return res.status(404).type("text/plain").send("Kunde nicht gefunden.");
    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${vcardDateiname(karte)}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(vcardText(karte));
  } catch (e: any) {
    console.error("[TELEFONKARTEI] vcard:", e);
    res.status(500).type("text/plain").send("Serverfehler");
  }
});

/**
 * POST /chef/telefonkartei/:personId/ergebnis { art, am?, notiz? }
 * art: rechnung | nicht_erreicht | antrag | rueckruf — die vier Fälle.
 */
router.post("/chef/telefonkartei/:personId/ergebnis", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  const art = req.body?.art;
  if (!istKarteiErgebnis(art)) return res.status(400).json({ ok: false, meldung: "Unbekannter Knopf." });
  try {
    const akteur = await akteurName(req.chef?.agentId);
    const erg = await ergebnisFesthalten(id, art, akteur, { am: req.body?.am ?? null, notiz: req.body?.notiz ?? null });
    const karte = erg.ok ? await karteEinzeln(id).catch(() => null) : null;
    res.status(erg.ok ? 200 : 409).json({ ...erg, karte });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] ergebnis:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
});

/**
 * POST /chef/telefonkartei/:personId/ki-nachricht { wunsch, vorher? } — die KI
 * schreibt aus Justins Stichpunkten eine WhatsApp-Nachricht (21.09.2026, E-205).
 * Sie SCHLÄGT VOR: Der Text geht zurück auf die Seite (server/lib/fiaon-kartei-ki.ts
 * kann nicht senden). Gesendet wird erst mit „whatsapp-frei" — von Justin, über FIAON.
 */
router.post("/chef/telefonkartei/:personId/ki-nachricht", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const karte = await karteEinzeln(id);
    if (!karte) return res.status(404).json({ ok: false, meldung: "Kunde nicht gefunden." });
    // Nachbesserung E-259: Bei „Stopp" schreibt die KI gar nicht erst; bei Werbesperre, Vertriebssperre
    // oder Kündigung kennt der Auftrag die Sperre (kein Verkauf). Der Antrag-Platzhalter ist sein
    // persönlicher Link — nie ein nackter fiaon.com/antrag.
    const sperre = await karteiSperre(id);
    if (sperre.hart) return res.status(409).json({ ok: false, meldung: `Keine Nachricht: ${sperre.hart}` });
    const antrag = await antragLinkFuer(karte, "whatsapp", true).catch(() => null);
    const { kiNachricht } = await import("../lib/fiaon-kartei-ki");
    const erg = await kiNachricht(karte, String(req.body?.wunsch ?? ""), req.body?.vorher ? String(req.body.vorher) : null,
      { antragLink: antrag?.url ?? null, sperre: sperre.weich });
    res.status(erg.ok ? 200 : 422).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] ki-nachricht:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
});

/**
 * GET /chef/telefonkartei/:personId/whatsapp-lage — was jeder Fall auf WhatsApp
 * täte (E-259): Vorlage, freier Text im offenen Fenster oder der Grund, warum
 * nicht (Sperre, keine freigegebene Vorlage, Festnetz …). Nur lesend.
 */
router.get("/chef/telefonkartei/:personId/whatsapp-lage", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const lage = await karteiWaLage(id, await akteurName(req.chef?.agentId));
    if (!lage) return res.status(404).json({ ok: false, meldung: "Kunde nicht gefunden." });
    res.json(lage);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] whatsapp-lage:", e);
    res.status(500).json({ ok: false, meldung: "Der WhatsApp-Stand ließ sich nicht laden." });
  }
});

/**
 * POST /chef/telefonkartei/:personId/whatsapp-frei { text, bestaetigt? } — die
 * persönliche Nachricht als freier Text über das FIAON-Konto. Nur im offenen
 * 24-Stunden-Fenster; sonst 409 mit `fensterZu` (dann die Rückfrage-Vorlage).
 * Nachbesserung E-259: nie bei „Stopp"; bei Werbesperre, Vertriebssperre oder
 * Kündigung 409 mit `bestaetigen`, bis Justin ausdrücklich bestätigt.
 */
router.post("/chef/telefonkartei/:personId/whatsapp-frei", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const erg = await karteiNachricht(id, "frei", await akteurName(req.chef?.agentId), String(req.body?.text ?? "").slice(0, 4_000),
      { bestaetigt: req.body?.bestaetigt === true });
    res.status(erg.ok ? 200 : 409).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] whatsapp-frei:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
});

/** POST /chef/telefonkartei/:personId/whatsapp-rueckfrage — die Vorlage fiaon_kk_rueckfrage öffnet das Gespräch neu. */
router.post("/chef/telefonkartei/:personId/whatsapp-rueckfrage", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const erg = await karteiNachricht(id, "rueckfrage", await akteurName(req.chef?.agentId));
    res.status(erg.ok ? 200 : 409).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] whatsapp-rueckfrage:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
});

/**
 * GET /chef/telefonkartei/:personId/mail-lage — was das Blatt „E-Mail" vor dem
 * Schreiben wissen muss (E-274): Adresse und Anrede wie beim Versand, die offene
 * Zahlung (nur sie darf als Rechnung anhängen), die letzten Mails mit Zustellstand.
 */
router.get("/chef/telefonkartei/:personId/mail-lage", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const lage = await karteiMailLage(id, await akteurName(req.chef?.agentId));
    if (!lage) return res.status(404).json({ ok: false, meldung: "Kunde nicht gefunden." });
    res.json(lage);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] mail-lage:", e);
    res.status(500).json({ ok: false, meldung: "Der Mail-Stand ließ sich nicht laden." });
  }
});

/**
 * POST /chef/telefonkartei/:personId/mail/vorschau { betreff, text, anhangReferenz? }
 * POST /chef/telefonkartei/:personId/mail          { betreff, text, anhangReferenz? }
 * Die freie Mail (E-274) über freitextVersenden — Vorschau und Versand aus derselben
 * Kette. Kein Gesprächsergebnis, keine WhatsApp. 400 bei einer fremden Referenz.
 */
async function mailRoute(req: ChefRequest, res: Response, nurVorschau: boolean): Promise<void> {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const { status, ...antwort } = await karteiMail(id, {
      betreff: req.body?.betreff, text: req.body?.text, anhangReferenz: req.body?.anhangReferenz, nurVorschau,
    }, await akteurName(req.chef?.agentId));
    res.status(status).json(antwort);
  } catch (e: any) {
    console.error(`[TELEFONKARTEI] mail${nurVorschau ? " vorschau" : ""}:`, e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
}
router.post("/chef/telefonkartei/:personId/mail/vorschau", wache, (req: ChefRequest, res: Response) => void mailRoute(req, res, true));
router.post("/chef/telefonkartei/:personId/mail", wache, (req: ChefRequest, res: Response) => void mailRoute(req, res, false));

/** POST /chef/telefonkartei/:personId/storno { grund?, kulanz? } */
router.post("/chef/telefonkartei/:personId/storno", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const akteur = await akteurName(req.chef?.agentId);
    const erg = await stornieren(id, {
      grund: String(req.body?.grund || ""), kulanz: req.body?.kulanz === true,
      akteur, akteurId: req.chef?.agentId ?? null,
    });
    res.status(erg.ok ? 200 : 409).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] storno:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — der Storno ist womöglich halb gelaufen. Bitte die Liste „Storniert“ prüfen.", punkte: [] });
  }
});

/** POST /chef/telefonkartei/:personId/storno/zuruecknehmen */
router.post("/chef/telefonkartei/:personId/storno/zuruecknehmen", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const erg = await stornoZuruecknehmen(id, await akteurName(req.chef?.agentId));
    res.status(erg.ok ? 200 : 409).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] zurück:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler", punkte: [] });
  }
});

/** POST /chef/telefonkartei/rueckruf/:id/erledigt */
router.post("/chef/telefonkartei/rueckruf/:id/erledigt", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ ok: false });
  try {
    res.json({ ok: await rueckrufErledigt(id) });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] rückruf erledigt:", e);
    res.status(500).json({ ok: false });
  }
});

/** GET /chef/telefonkartei/rueckruf/:id/kalender.ics — Erinnerung ins iPhone. */
router.get("/chef/telefonkartei/rueckruf/:id/kalender.ics", wache, async (req: ChefRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).type("text/plain").send("Ungültig");
  try {
    const r = await rueckrufIcs(id);
    if (!r) return res.status(404).type("text/plain").send("Rückruf nicht gefunden oder schon erledigt.");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${r.name}"`);
    res.setHeader("Cache-Control", "no-store");
    res.send(r.ics);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] ics:", e);
    res.status(500).type("text/plain").send("Serverfehler");
  }
});

export default router;
