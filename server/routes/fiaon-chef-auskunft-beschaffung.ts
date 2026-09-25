// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · AUSKUNFT-BESCHAFFUNG — das Backend von /chef/s/auskunft-beschaffung
// (25.09.2026, E-241)
//
// Justin: „Ich kümmere mich heute um die API, bis dahin kaufen wir sie selbst."
// Hier arbeitet, wer die bezahlten Bonitätsauskünfte beschafft: Er sieht je
// Auftrag alles, was er zum Bestellen braucht (Name, Geburtsdatum, Anschrift
// samt Voranschrift, Land, Auskunfteien, bezahlt am, fällig ab, Einwilligung),
// übernimmt ihn, lädt das PDF hoch — und der Rest passiert von selbst: Ablage
// als Auskunft-Dokument der Person, Analyse, Mail „Ihre Auskunft ist da".
// Die Regeln stehen in server/lib/fiaon-auskunft-lieferung.ts (Abschnitt 5),
// der Anschluss für die API in server/lib/fiaon-auskunft-quelle.ts.
//
//   GET  /chef/auskunft-beschaffung                   Stand + Aufträge (liest den Rückstand ein)
//   POST /chef/auskunft-beschaffung/modus             {modus: einkauf|vollmacht|api}
//   POST /chef/auskunft-beschaffung/:id/aktion        {aktion, notiz?}
//   POST /chef/auskunft-beschaffung/:id/auftrag-link  {nochmal?}  (alter Pfad …/vollmacht-link gilt weiter)
//   POST /chef/auskunft-beschaffung/:id/hochladen     multipart: datei (PDF, bis 6), auskunfteien
//   POST /chef/auskunft-beschaffung/:id/mail          die Mail der letzten Lieferung erneut
//   POST /chef/auskunft-beschaffung/api-abrufen       fällige Aufträge über die API holen
//
// Wache wie der Auskunft-Verkauf (fiaon-chef-auskunft.ts): Geschäftsführung.
// Die Seite zeigt Geburtsdatum und Anschrift — das ist nichts für jede Stufe.
// Jeder schreibende Aufruf steht über requireChef im fiaon_admin_log.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response, type NextFunction } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, chefProtokoll, type ChefRequest } from "./fiaon-chef-zugang";
import {
  LIEFERMODUS_SCHLUESSEL, BESCHAFFUNG_PDF_MAX, auskunftLiefermodus, istLiefermodus, beschaffungListe, rueckstandEinlesen,
  beschaffungAktion, beschaffungHochladen, beschaffungMailNachholen, auftragLinkSenden, apiFaelligeAbrufen,
  type BeschaffungAktion, type BeschaffungAuftrag,
} from "../lib/fiaon-auskunft-lieferung";
import { auskunftApiAngebunden } from "../lib/fiaon-auskunft-quelle";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

const AKTIONEN: BeschaffungAktion[] = ["uebernehmen", "problem", "notiz", "wieder_offen", "abschliessen"];

/** Wer im Chefbüro sitzt — mit Namen, damit „übernommen von …" etwas sagt. */
async function wer(req: ChefRequest): Promise<{ name: string; agentId: number | null }> {
  const agentId = req.chef?.agentId ?? null;
  if (!agentId) return { name: "Chefbüro", agentId: null };
  const [a] = (await sqlPool`
    SELECT COALESCE(NULLIF(name, ''), TRIM(CONCAT_WS(' ', first_name, last_name))) AS name FROM fiaon_agents WHERE id = ${agentId} LIMIT 1
  `.catch(() => [])) as any[];
  return { name: String(a?.name || `Chef #${agentId}`), agentId };
}

function idAus(req: Request): number | null {
  const id = Number(req.params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Die Zahlen oben — gezählt aus derselben Liste, die darunter steht. */
function zahlen(liste: BeschaffungAuftrag[]) {
  const offen = liste.filter((a) => a.status !== "fertig");
  return {
    // Gegenlesen 25.09.2026 (E-241): nicht mehr bezahlt (erstattet, storniert) zählt nie als „jetzt beschaffen“.
    jetzt: offen.filter((a) => a.status !== "problem" && a.faellig && a.einwilligung.ja && !a.dokumentDa && a.bestellung.bezahlt).length,
    einwilligungFehlt: offen.filter((a) => a.status !== "problem" && !a.einwilligung.ja).length,
    wartet: offen.filter((a) => a.status !== "problem" && !a.faellig && a.einwilligung.ja).length,
    mailFehlt: offen.filter((a) => a.status === "hochgeladen").length,
    problem: offen.filter((a) => a.status === "problem").length,
    offen: offen.length,
    fertig30: liste.filter((a) => a.status === "fertig").length,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// GET — der Stand. Liest dabei den Rückstand ein (ohne Mail an die Kunden).
// ───────────────────────────────────────────────────────────────────────────
router.get("/chef/auskunft-beschaffung", wache, async (_req: Request, res: Response) => {
  try {
    const rueckstandNeu = await rueckstandEinlesen().catch((e) => {
      console.error("[CHEF-BESCHAFFUNG] Rückstand einlesen:", e);
      return 0;
    });
    const [modus, liste] = await Promise.all([auskunftLiefermodus(), beschaffungListe()]);
    const { antraegeFreigeschaltet } = await import("./fiaon-app");
    res.json({
      ok: true,
      stand: new Date().toISOString(),
      modus,
      apiAngebunden: auskunftApiAngebunden(),
      unterschriftAn: await antraegeFreigeschaltet().catch(() => false),
      pdfMaxMb: Math.round(BESCHAFFUNG_PDF_MAX / 1024 / 1024),
      rueckstandNeu,
      zahlen: zahlen(liste),
      auftraege: liste,
    });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Stand:", err);
    res.status(500).json({ ok: false, error: "Die Beschaffung ließ sich nicht laden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /modus — der Lieferweg (fiaon_settings.auskunft_liefermodus)
// ───────────────────────────────────────────────────────────────────────────
// Integration 25.09.2026 (E-241): geschrieben über einstellungSetzen des Verkaufstakts (EINE Erlaubnisliste)
// und protokolliert wie die Steuerung auf /chef/s/auskunft (Ziel „auskunft-einstellung:auskunft_liefermodus",
// „Liefermodus: alt → neu") — vorher schrieb diese Route am Protokoll der Steuerung vorbei.
router.post("/chef/auskunft-beschaffung/modus", wache, async (req: ChefRequest, res: Response) => {
  try {
    const modus = String(req.body?.modus ?? "").trim().toLowerCase();
    if (!istLiefermodus(modus)) return res.status(400).json({ ok: false, error: "Erlaubt sind einkauf, vollmacht und api." });
    const { einstellungSetzen, verkaufEinstellungen, SCHALTER_LIEFERMODUS } = await import("../lib/fiaon-auskunft-verkauf");
    const vorher = (await verkaufEinstellungen()).liefermodus;
    const erg = await einstellungSetzen(SCHALTER_LIEFERMODUS, modus);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.fehler });
    const w = await wer(req);
    if (vorher !== erg.einstellungen.liefermodus) {
      await chefProtokoll(req, `auskunft-einstellung:${SCHALTER_LIEFERMODUS}`, `Liefermodus: ${vorher} → ${erg.einstellungen.liefermodus}`);
    }
    console.log(`[CHEF-BESCHAFFUNG] ${LIEFERMODUS_SCHLUESSEL} = ${modus} durch ${w.name}`);
    res.json({ ok: true, modus: erg.einstellungen.liefermodus });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Modus:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/aktion — übernehmen, Problem, Notiz, wieder öffnen, abschließen
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/:id/aktion", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    const aktion = String(req.body?.aktion ?? "") as BeschaffungAktion;
    if (!id || !AKTIONEN.includes(aktion)) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag oder unbekannte Aktion." });
    const erg = await beschaffungAktion(id, aktion, await wer(req), String(req.body?.notiz ?? ""));
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text });
    res.json({ ok: true, text: erg.text });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Aktion:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/auftrag-link — der Link zur Auftragsbestätigung (25.09.2026, E-241)
// Vorher „…/vollmacht-link" auf /app/unterschrift: Die Vollmacht deckt den Kauf
// nicht und hakte alle sieben Antragsarten vor. Der alte Pfad bleibt als
// zweiter Name derselben Route — ein Browser mit altem Stand schickt ihn noch.
// ───────────────────────────────────────────────────────────────────────────
router.post(["/chef/auskunft-beschaffung/:id/auftrag-link", "/chef/auskunft-beschaffung/:id/vollmacht-link"], wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
    const erg = await auftragLinkSenden(id, await wer(req), { nochmal: req.body?.nochmal === true });
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text, mail: erg.mail });
    res.json({ ok: true, text: erg.text, mail: erg.mail });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Link zur Auftragsbestätigung:", err);
    res.status(500).json({ ok: false, error: "Der Link ließ sich nicht senden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/hochladen — das PDF der Auskunft (nur PDF, bis 25 MB je Datei)
// Multer erst hier laden — die Route ist selten, der Speicher liegt im RAM.
// ───────────────────────────────────────────────────────────────────────────
router.post(
  "/chef/auskunft-beschaffung/:id/hochladen",
  wache,
  (req: Request, res: Response, next: NextFunction) => {
    import("multer")
      .then(({ default: multer }) => {
        multer({ storage: multer.memoryStorage(), limits: { fileSize: BESCHAFFUNG_PDF_MAX, files: 6, fields: 4 } })
          .array("datei", 6)(req as any, res as any, (err: any) => {
            if (err) {
              return res.status(400).json({
                ok: false,
                error: err?.code === "LIMIT_FILE_SIZE" ? "Die Datei ist größer als 25 MB." : err?.code === "LIMIT_FILE_COUNT" ? "Höchstens sechs Dateien auf einmal." : "Die Datei konnte nicht gelesen werden.",
              });
            }
            next();
          });
      })
      .catch(() => res.status(500).json({ ok: false, error: "Upload nicht verfügbar." }));
  },
  async (req: ChefRequest, res: Response) => {
    try {
      const id = idAus(req);
      if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
      const dateien = (((req as any).files ?? []) as { buffer: Buffer; originalname: string }[])
        .map((f) => ({ buffer: f.buffer, name: String(f.originalname || "auskunft.pdf").slice(0, 120) }));
      const auskunfteien = String(req.body?.auskunfteien ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      const erg = await beschaffungHochladen(id, { dateien, auskunfteien, wer: await wer(req) });
      if (!erg.ok) return res.status(400).json({ ok: false, error: erg.text });
      res.json({ ok: true, text: erg.text, status: erg.status, mail: erg.mail, hinweis: erg.hinweis ?? null });
    } catch (err) {
      console.error("[CHEF-BESCHAFFUNG] Hochladen:", err);
      res.status(500).json({ ok: false, error: "Das Hochladen ist gescheitert." });
    }
  },
);

// ───────────────────────────────────────────────────────────────────────────
// POST /:id/mail — die Mail „Ihre Auskunft ist da" der letzten Lieferung erneut
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/:id/mail", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = idAus(req);
    if (!id) return res.status(400).json({ ok: false, error: "Unbekannter Auftrag." });
    const erg = await beschaffungMailNachholen(id);
    if (!erg.ok) return res.status(409).json({ ok: false, error: erg.text });
    res.json({ ok: true, text: erg.text, status: erg.status });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] Mail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /api-abrufen — alle heute fälligen Aufträge mit Beschaffungsauftrag über die API
// ───────────────────────────────────────────────────────────────────────────
router.post("/chef/auskunft-beschaffung/api-abrufen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    if ((await auskunftLiefermodus()) !== "api") return res.status(409).json({ ok: false, error: "Der Lieferweg steht nicht auf „API“." });
    const erg = await apiFaelligeAbrufen();
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[CHEF-BESCHAFFUNG] API-Abruf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
