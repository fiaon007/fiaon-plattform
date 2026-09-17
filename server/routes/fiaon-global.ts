// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ROUTEN DES BESTELLWEGS (17.09.2026, E-188)
//
// Zwei Türen, ein Vorgang (die Logik liegt in server/lib/fiaon-global-auftrag.ts
// und server/lib/fiaon-global-vertrag.ts):
//
//   · /global/… — der Kunde, ohne Anmeldung. Er sieht den Auftrag, BEVOR er
//     unterschreibt (POST /global/vertrag/vorschau), erteilt ihn (POST
//     /global/auftrag) und kommt danach mit seiner Antragsnummer und einem
//     signierten Token (30 Tage) zurück auf seine Auftragsseite, zum Vertrag
//     und zur Rechnung. Token und Nummer werden im Zugriffslog maskiert
//     (server/index.ts).
//
//   · /admin/global/… — die Leitung. Liegt unter /admin und damit hinter dem
//     Gate aus routes.ts (Admin-Code oder Chef-Token); requireChef("leitung")
//     liefert dazu, WER geklickt hat. Die Seite dazu: /chef/s/global-auftraege.
//
// Antworten an den Kunden sind deutsche Sätze in Sie-Form mit dem Pfad des
// Feldes (`feld`), an dem es hängt — die Oberfläche zeigt ihn dort an.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import {
  globalAuftragPruefen, globalAuftragAnlegen, globalAuftragSicht, globalTokenPruefen, globalVorschauPruefen, vorschauZuViel,
  globalVertragPdfLesen, globalRechnungPdf, globalAuftraegeListe, globalStichtagSetzen, globalZustaendigAendern,
  globalNachZahlung, globalAuftragsMailNachholen,
} from "../lib/fiaon-global-auftrag";
import { globalVertragVorschauHtml } from "../lib/fiaon-global-vertrag";

const router = Router();

function clientIp(req: Request): string {
  return ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
}

function pdfSenden(res: Response, pdf: Buffer, dateiname: string) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${dateiname.replace(/[^A-Za-z0-9._-]+/g, "_")}"`);
  res.setHeader("Content-Length", String(pdf.length));
  // Ein Vertrag gehört nicht in einen Zwischenspeicher zwischen Kunde und Server.
  res.setHeader("Cache-Control", "private, no-store");
  res.end(pdf);
}

/** Token aus `?t=` prüfen — und bei einem Fehler gleich die Antwort schreiben. */
function zutritt(req: Request, res: Response): string | null {
  const ref = String(req.params.ref || "").trim();
  const urteil = globalTokenPruefen(ref, req.query.t);
  if (!urteil) { res.status(403).json({ ok: false, error: "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus Ihrer Auftragsbestätigung." }); return null; }
  if (urteil === "abgelaufen") { res.status(410).json({ ok: false, error: "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com — Sie erhalten Vertrag und Rechnung dann erneut." }); return null; }
  return ref;
}

// ── Der Kunde ────────────────────────────────────────────────────────────────
router.post("/global/vertrag/vorschau", (req: Request, res: Response) => {
  try {
    if (vorschauZuViel(clientIp(req))) return res.status(429).json({ ok: false, error: "Bitte versuchen Sie es in einer Minute noch einmal." });
    const p = globalVorschauPruefen(req.body ?? {});
    if (!p.ok) return res.status(p.status).json({ ok: false, error: p.error, feld: p.feld });
    res.json({ ok: true, html: globalVertragVorschauHtml(p.daten) });
  } catch (err) {
    console.error("[FIAON-GLOBAL] vorschau:", err);
    res.status(500).json({ ok: false, error: "Der Auftrag lässt sich gerade nicht anzeigen — bitte laden Sie die Seite neu." });
  }
});

router.post("/global/auftrag", async (req: Request, res: Response) => {
  try {
    const p = globalAuftragPruefen(req.body ?? {});
    if (!p.ok) return res.status(p.status).json({ ok: false, error: p.error, feld: p.feld });
    const erg = await globalAuftragAnlegen(p.daten, { ip: clientIp(req), userAgent: String(req.headers["user-agent"] || "") });
    if (!erg.ok) return res.status(erg.status).json({ ok: false, error: erg.error, feld: erg.feld });
    res.json(erg);
  } catch (err) {
    console.error("[FIAON-GLOBAL] auftrag:", err);
    res.status(500).json({ ok: false, error: "Da ist bei uns etwas schiefgelaufen — nicht bei Ihnen. Bitte versuchen Sie es in einer Minute noch einmal." });
  }
});

router.get("/global/auftrag/:ref", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const sicht = await globalAuftragSicht(ref, String(req.query.t));
    if (!sicht) return res.status(404).json({ ok: false, error: "Wir finden zu diesem Link keinen Auftrag." });
    res.setHeader("Cache-Control", "private, no-store");
    res.json(sicht);
  } catch (err) {
    console.error("[FIAON-GLOBAL] auftrag lesen:", err);
    res.status(500).json({ ok: false, error: "Ihr Auftrag lässt sich gerade nicht laden — bitte versuchen Sie es gleich noch einmal." });
  }
});

router.get("/global/auftrag/:ref/vertrag.pdf", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const pdf = await globalVertragPdfLesen(ref);
    if (!pdf) return res.status(404).json({ ok: false, error: "Zu diesem Auftrag liegt kein Vertrag vor." });
    pdfSenden(res, pdf, `FIAON_Global_Auftrag_${ref}.pdf`);
  } catch (err) {
    console.error("[FIAON-GLOBAL] vertrag.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Der Vertrag lässt sich gerade nicht laden." });
  }
});

router.get("/global/auftrag/:ref/rechnung.pdf", async (req: Request, res: Response) => {
  try {
    const ref = zutritt(req, res);
    if (!ref) return;
    const r = await globalRechnungPdf(ref);
    if (!r) return res.status(404).json({ ok: false, error: "Zu diesem Auftrag liegt noch keine Rechnung vor." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[FIAON-GLOBAL] rechnung.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Die Rechnung lässt sich gerade nicht laden." });
  }
});

// ── Die Leitung (hinter dem /admin-Gate aus routes.ts) ───────────────────────
/** Wer im Chefbüro klickt — Name für Verlauf und Aufgabe (Muster fiaon-bewerbungen.ts). */
async function chefName(req: ChefRequest): Promise<string> {
  const id = req.chef?.agentId ?? null;
  if (id) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${id} LIMIT 1`.catch(() => [])) as any[];
    if (a?.name) return String(a.name);
  }
  return "Justin (Chefbüro)";
}

router.get("/admin/global/auftraege", requireChef("leitung"), async (_req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ...(await globalAuftraegeListe()) });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/auftraege/:ref/stichtag", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await globalStichtagSetzen(String(req.params.ref), req.body?.stichtag, await chefName(req), req.body?.mitteilen !== false);
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin stichtag:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/auftraege/:ref/zustaendig", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await globalZustaendigAendern(String(req.params.ref), req.body?.agentId, await chefName(req));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin zustaendig:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Bezahlt, aber nicht gestartet (Aufgabe oder Startmail hing)? Derselbe Start noch einmal — er ist wiederholbar. */
router.post("/admin/global/auftraege/:ref/start", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await globalNachZahlung(String(req.params.ref));
    if (!erg.gestartet) return res.status(409).json({ ok: false, error: erg.grund === "nicht bezahlt" ? "Der Auftrag startet mit dem Zahlungseingang — die Zahlung ist noch nicht gebucht." : `Der Start ließ sich nicht anstoßen: ${erg.grund}.` });
    res.json({ ok: true, meldung: "Start angestoßen: Aufgabe vergeben, Startmail geprüft." });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/global/auftraege/:ref/auftragsmail", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const erg = await globalAuftragsMailNachholen(String(req.params.ref));
    if (!erg.ok) return res.status(400).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin auftragsmail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Auftrag stornieren — { grund, erstattung }. Bezahlt: Grund mit mindestens zehn Zeichen.
 * `erstattung: true` bewegt KEIN Geld: Es entsteht eine dringende Aufgabe für Justin, der von Hand
 * überweist (Hausregel). Die Regeln stehen in server/lib/fiaon-global-storno.ts.
 */
router.post("/admin/global/auftraege/:ref/storno", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const { globalAuftragStornieren } = await import("../lib/fiaon-global-storno");
    const erg = await globalAuftragStornieren(String(req.params.ref), { grund: req.body?.grund, erstattung: req.body?.erstattung === true }, await chefName(req));
    if (!erg.ok) return res.status(erg.status ?? 400).json({ ok: false, error: erg.error });
    res.json({ ok: true, meldung: erg.meldung });
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin storno:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/global/auftraege/:ref/vertrag.pdf", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const ref = String(req.params.ref);
    const pdf = await globalVertragPdfLesen(ref);
    if (!pdf) return res.status(404).json({ ok: false, error: "Zu dieser Bestellung liegt kein unterschriebener Auftrag vor." });
    pdfSenden(res, pdf, `FIAON_Global_Auftrag_${ref}.pdf`);
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin vertrag.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/global/auftraege/:ref/rechnung.pdf", requireChef("leitung"), async (req: ChefRequest, res: Response) => {
  try {
    const r = await globalRechnungPdf(String(req.params.ref));
    if (!r) return res.status(404).json({ ok: false, error: "Zu dieser Bestellung liegt keine Rechnung vor." });
    pdfSenden(res, r.pdf, r.dateiname);
  } catch (err) {
    console.error("[FIAON-GLOBAL] admin rechnung.pdf:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
