// ═══════════════════════════════════════════════════════════════════════════
// TELEFONKARTEI — Routen (21.09.2026, E-201)
//
// Nur im Chefbüro und nur für die Stufe „inhaber": Justin wollte die Seite
// ausdrücklich „für mich" — die Texte tragen seinen Namen, der Terminlink führt
// in SEINEN Kalender. Die Logik steht in server/lib/fiaon-telefonkartei.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  karteiListe, karteiZaehler, karteEinzeln, vcardText, vcardDateiname,
  ergebnisFesthalten, stornieren, stornoZuruecknehmen,
  rueckrufListe, rueckrufErledigt, rueckrufIcs, termineListe, akteurName, ANTRAG_URL,
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
    res.json({ ok: true, gruppe, ...liste, zaehler, absender, antragUrl: ANTRAG_URL() });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] liste:", e);
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
 * Sie SCHLÄGT VOR: Der Text geht zurück auf die Seite, gesendet wird nur in
 * WhatsApp, von Justin selbst (server/lib/fiaon-kartei-ki.ts kann nicht senden).
 */
router.post("/chef/telefonkartei/:personId/ki-nachricht", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const karte = await karteEinzeln(id);
    if (!karte) return res.status(404).json({ ok: false, meldung: "Kunde nicht gefunden." });
    const { kiNachricht } = await import("../lib/fiaon-kartei-ki");
    const erg = await kiNachricht(karte, String(req.body?.wunsch ?? ""), req.body?.vorher ? String(req.body.vorher) : null, ANTRAG_URL());
    res.status(erg.ok ? 200 : 422).json(erg);
  } catch (e: any) {
    console.error("[TELEFONKARTEI] ki-nachricht:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler — bitte noch einmal." });
  }
});

/** POST /chef/telefonkartei/:personId/nachricht-vermerken { text } — „WhatsApp geöffnet" in den Verlauf. */
router.post("/chef/telefonkartei/:personId/nachricht-vermerken", wache, async (req: ChefRequest, res: Response) => {
  const id = personIdAus(req, res); if (!id) return;
  try {
    const karte = await karteEinzeln(id);
    if (!karte) return res.status(404).json({ ok: false, meldung: "Kunde nicht gefunden." });
    const { nachrichtVermerken } = await import("../lib/fiaon-kartei-ki");
    const akteur = await akteurName(req.chef?.agentId);
    const ok = await nachrichtVermerken(karte, String(req.body?.text ?? ""), akteur);
    res.status(ok ? 200 : 409).json({ ok, meldung: ok ? "Im Verlauf festgehalten." : "Kein Verlauf möglich — weder Bestellung noch Lead." });
  } catch (e: any) {
    console.error("[TELEFONKARTEI] nachricht-vermerken:", e);
    res.status(500).json({ ok: false, meldung: "Serverfehler" });
  }
});

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
