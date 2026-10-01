// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ROUTEN DES INDIVIDUALANGEBOTS
// Individualangebot (01.10.2026), Register E-268
//
// Zwei Türen, ein Vorgang (Ablauf: server/lib/fiaon-global-angebot.ts):
//   · /global/angebot/:token — der Kunde, ohne Anmeldung, mit signiertem Link
//     (Referenz.Ablauf.Signatur). Lesen (mit den Schaltern sofortBeginn und
//     jahresbetreuung), Entwurf als PDF, Prüfbericht als PDF, annehmen.
//     Token im Zugriffslog maskiert (server/index.ts).
//   · /admin/global/angebote… — die Leitung, hinter dem /admin-Gate aus routes.ts;
//     requireChef("leitung") liefert dazu, WER geklickt hat. Die Seite dazu:
//     /chef/s/global-auftraege?reiter=angebote (keine neue Chef-Seite).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, readChef, type ChefRequest } from "./fiaon-chef-zugang";
import { hasAdminCode } from "./fiaon-admin-zugang";
import {
  angebotKundenSicht, angebotAnnehmen, angebotPdfFuerToken, angebotPdfErzeugen, schalterAus, angebotListe, angebotAnlegen, angebotAendern,
  angebotZurueckziehen, angebotMeilenstein, angebotFristHemmen, angebotErstattungVormerken, angebotErstattungUeberwiesen, angebotLesen,
  angebotPruefberichtBoniNeu, angebotVorbelegung, angebotFertigstellen, angebotNacharbeit, bestaetigungSenden,
} from "../lib/fiaon-global-angebot";
import { globalMitarbeiter } from "../lib/fiaon-global-auftrag";
import { ANGEBOT_VORGABEN, BUERGIN_VORGABE, BUERGIN_FELDER, ANGEBOT_FASSUNG, ANGEBOT_GUELTIG_TAGE } from "@shared/fiaon-global-angebot";

const router = Router();

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}
function pdfSenden(res: Response, pdf: Buffer, dateiname: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${dateiname.replace(/[^A-Za-z0-9._-]+/g, "_")}"`);
  res.setHeader("Content-Length", String(pdf.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.end(pdf);
}
/** Wer im Chefbüro sitzt (oder mit Admin-Cookie schaut), sieht die Seite als Vorschau — annehmen kann nur der Kunde. */
function istLeitung(req: Request): boolean {
  try { return !!readChef(req) || hasAdminCode(req); } catch { return false; }
}

// ── Der Kunde ────────────────────────────────────────────────────────────────
router.get("/global/angebot/:token", async (req: Request, res: Response) => {
  try {
    const erg = await angebotKundenSicht(String(req.params.token), schalterAus(req.query), { leitung: istLeitung(req) });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] lesen:", err);
    res.status(500).json({ ok: false, error: "Das Angebot lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

router.post("/global/angebot/:token/annehmen", async (req: Request, res: Response) => {
  try {
    const erg = await angebotAnnehmen(String(req.params.token), req.body ?? {}, { ip: clientIp(req), userAgent: String(req.headers["user-agent"] || ""), leitung: istLeitung(req) });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(erg.status).json(erg.body);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] annehmen:", err);
    res.status(500).json({ ok: false, error: "Da ist bei uns etwas schiefgelaufen — nicht bei Ihnen. Bitte versuchen Sie es in einer Minute noch einmal." });
  }
});

for (const art of ["vertrag", "pruefbericht"] as const) {
  router.get(`/global/angebot/:token/${art}.pdf`, async (req: Request, res: Response) => {
    try {
      const erg = await angebotPdfFuerToken(String(req.params.token), art, schalterAus(req.query));
      if (!erg.pdf) return res.status(erg.status).json({ ok: false, error: erg.error });
      pdfSenden(res, erg.pdf, erg.dateiname!);
    } catch (err) {
      console.error(`[FIAON-ANGEBOT] ${art}.pdf:`, err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Das Dokument lässt sich gerade nicht erzeugen." });
    }
  });
}

// ── Die Leitung ──────────────────────────────────────────────────────────────
async function chefName(req: ChefRequest): Promise<string> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Justin (Chefbüro)";
}
const idAus = (req: Request) => Number(req.params.id);

router.get("/admin/global/angebote", requireChef("leitung"), async (_req: ChefRequest, res: Response) => {
  try {
    res.json({
      ok: true, angebote: await angebotListe(), mitarbeiter: await globalMitarbeiter(),
      vorgaben: { parameter: ANGEBOT_VORGABEN, buergin: BUERGIN_VORGABE, buerginFelder: BUERGIN_FELDER, fassung: ANGEBOT_FASSUNG, gueltigTage: ANGEBOT_GUELTIG_TAGE },
    });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] liste:", err);
    res.status(500).json({ ok: false, error: "Die Angebote lassen sich gerade nicht laden." });
  }
});

router.get("/admin/global/angebote/vorbelegung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const personId = Number(req.query.personId);
    if (!Number.isInteger(personId) || personId <= 0) return res.status(400).json({ ok: false, error: "Bitte eine Personen-Nummer angeben." });
    const erg = await angebotVorbelegung(personId);
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] vorbelegung:", err);
    res.status(500).json({ ok: false, error: "Die Daten der Person ließen sich nicht laden." });
  }
});

router.post("/admin/global/angebote", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    // Der Prüfbericht kommt nie aus einem Formular (Justin: „Echter Prüfbericht") — er wird aus den Daten
    // gerechnet („Bonitätsteil neu rechnen") oder von der Saat aus den Messwerten gesetzt.
    const { pruefbericht: _nieAusDemFormular, ...ein } = (req.body ?? {}) as Record<string, unknown>;
    const erg = await angebotAnlegen(ein, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] anlegen:", err);
    res.status(500).json({ ok: false, error: "Das Angebot ließ sich nicht anlegen." });
  }
});

router.put("/admin/global/angebote/:id", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotAendern(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: erg.fehlt.length ? `Gespeichert. Für die Annahme fehlt noch: ${erg.fehlt.join("; ")}.` : "Gespeichert. Das Angebot ist jetzt annehmbar." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] ändern:", err);
    res.status(500).json({ ok: false, error: "Nicht gespeichert — Serverfehler." });
  }
});

router.post("/admin/global/angebote/:id/pruefbericht", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotPruefberichtBoniNeu(idAus(req), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: `Bonitätsteil neu gerechnet: ${erg.punkte} Punkte.` });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] prüfbericht:", err);
    res.status(500).json({ ok: false, error: "Der Prüfbericht ließ sich nicht neu rechnen." });
  }
});

router.post("/admin/global/angebote/:id/zurueckziehen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotZurueckziehen(idAus(req), req.body?.grund, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ok: true, meldung: "Zurückgezogen. Der Link antwortet jetzt mit „gilt nicht mehr“." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] zurückziehen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/meilenstein", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotMeilenstein(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] meilenstein:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/hemmung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotFristHemmen(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ...erg, meldung: `Ruhezeit eingetragen: vom ${erg.von.split("-").reverse().join(".")} bis ${erg.bis.split("-").reverse().join(".")} (${erg.tage} Tage). Neues Fristende: ${erg.fristEnde.split("-").reverse().join(".")} — der Kunde bekommt es per Mail; die zuständige Person hat eine Aufgabe.` });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] hemmung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/erstattung", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotErstattungVormerken(idAus(req), await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-ANGEBOT] erstattung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/angebote/:id/erstattung-ueberwiesen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotErstattungUeberwiesen(idAus(req), req.body ?? {}, await chefName(req));
    if (!erg.ok) return res.status(erg.status).json(erg);
    res.json({ ok: true, meldung: "Überweisung eingetragen." });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] erstattung überwiesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Hing etwas nach der Annahme (Bestellung, Mail)? Derselbe Weg noch einmal — er ist wiederholbar. */
router.post("/admin/global/angebote/:id/nachholen", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await angebotFertigstellen(idAus(req));
    if (!erg.ok) return res.status(409).json({ ok: false, error: `Nicht fertig: ${erg.grund}` });
    await angebotNacharbeit(idAus(req));
    const mail = await bestaetigungSenden(idAus(req));
    res.json({ ok: true, meldung: mail.ok ? "Bestellung, Akte und Bestätigungsmail stehen." : `Bestellung und Akte stehen — die Mail ging nicht raus: ${mail.grund}` });
  } catch (err) {
    console.error("[FIAON-ANGEBOT] nachholen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// „anlage1" = das Blatt zum eigenhändigen Unterschreiben (nur für die Leitung; Gegenprüfung 01.10.2026).
for (const art of ["vertrag", "pruefbericht", "anlage1"] as const) {
  router.get(`/admin/global/angebote/:id/${art}.pdf`, requireChef("leitung"), async (req: ChefRequest, res: Response) => {
    try {
      const z = await angebotLesen({ id: idAus(req) });
      if (!z) return res.status(404).json({ ok: false, error: "Dieses Angebot gibt es nicht." });
      const erg = await angebotPdfErzeugen(z, art, schalterAus(req.query));
      if (!erg.pdf) return res.status(erg.status).json({ ok: false, error: erg.error });
      pdfSenden(res, erg.pdf, erg.dateiname!);
    } catch (err) {
      console.error(`[FIAON-ANGEBOT] admin ${art}.pdf:`, err);
      if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
}

export default router;
