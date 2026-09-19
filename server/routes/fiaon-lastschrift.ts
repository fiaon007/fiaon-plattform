// ═══════════════════════════════════════════════════════════════════════════
// LASTSCHRIFT UND SOFORTZAHLUNG ÜBER GOCARDLESS — BEENDET (19.09.2026, E-194)
//
// Justin (19.09.2026): „Streiche ÜBERALL GoCardless, wir haben die Zusammen-
// arbeit mit GoCardless beendet, alle eingezogenen Zahlungen werden
// rückerstattet und der Kunde muss manuell überweisen … damit wir nichts
// weiterfüttern, was nicht mehr da ist."
//
// Bis zum 19.09.2026 stand hier die ganze Anbindung (Scheibe 11 vom 22.08.,
// E-072): Mandatsstrecke, 12-Raten-Abo, Einzelabruf überfälliger Raten,
// Sofortzahlung per Bank-App (Instant Bank Pay), Abo-Abgleich alle sechs
// Stunden und der Webhook, der Einzüge als bezahlt buchte. Nichts davon ruft
// GoCardless noch auf. Übrig bleiben nur die Adressen, die draußen noch
// existieren — in alten Mails und bei GoCardless selbst:
//
//   · Links aus alten Mails (Lastschrift-Direktlink, Sofortzahl-Link) führen
//     auf die Zahlungsseite mit Bankverbindung und Verwendungszweck — nie ins
//     Leere, denn dahinter steht ein Kunde, der zahlen will.
//   · Der Webhook nimmt Ereignisse an (200), verarbeitet aber nichts mehr: Ein
//     Einzug, den GoCardless noch meldet, wird erstattet — er darf keine Rate
//     als bezahlt buchen. Die Rate bleibt offen und wird per Überweisung bezahlt.
//   · Die Knöpfe im alten Kundenbereich bekommen einen Klartext statt der Strecke.
//
// Die Spalten gc_* an Personen, Aufträgen und Raten bleiben als Historie stehen;
// kein Code liest sie mehr für eine Entscheidung (fiaon-einzug-schutz.ts ist weg).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";

const router = Router();

/** Der Satz, den ein Kunde liest, wenn er noch einen alten Knopf erwischt. */
export const LASTSCHRIFT_BEENDET =
  "Die Lastschrift bieten wir nicht mehr an. Bitte überweisen Sie Ihre Raten — Bankverbindung und Verwendungszweck finden Sie in Ihrer Zahlungsmail und im Kundenbereich unter „Zahlen“.";

// Die Signaturen der alten Links — nur noch, um sie zu erkennen (kein offener Umleiter).
function geheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "fiaon-dev-sepa-secret";
}
function tokenPruefen(token: string, art: "sepa" | "sofort"): string | null {
  const teile = String(token || "").split(".");
  if (teile.length < 3) return null;
  const sig = teile.pop()!; const exp = teile.pop()!; const ref = teile.join(".");
  if (!ref || !exp) return null;
  const soll = createHmac("sha256", geheim()).update(`${art}.${ref}.${exp}`).digest("hex").slice(0, 32);
  return soll === sig ? ref : null;
}

/**
 * Die Zahlungsseite hinter einem alten Link. Der Sofortzahl-Link trug die Zahlungsreferenz
 * (Bestellung FIAON-XXXXXX oder Rate FIAON-XXXXXX-N), der Lastschrift-Link die Vertragsnummer
 * (FIAON-XXXXXXXX-XXXX) — dann die nächste offene Rate. Ohne Treffer: der Kundenbereich.
 */
async function zahlungsseiteFuer(ref: string): Promise<string> {
  const r = String(ref || "").trim().toUpperCase();
  if (!/^FIAON-[A-Z0-9-]{4,24}$/.test(r)) return "/dashboard";
  const seite = (z: unknown) => `/zahlung/${encodeURIComponent(String(z))}`;
  const [rate] = (await sqlPool`SELECT zahlungsreferenz FROM fiaon_abo_raten WHERE UPPER(zahlungsreferenz) = ${r} ORDER BY id DESC LIMIT 1`.catch(() => [])) as any[];
  if (rate?.zahlungsreferenz) return seite(rate.zahlungsreferenz);
  const [naechste] = (await sqlPool`
    SELECT zahlungsreferenz FROM fiaon_abo_raten
     WHERE ref = ${r} AND status <> 'bezahlt' AND storniert_am IS NULL AND zahlungsreferenz IS NOT NULL
     ORDER BY faellig_am ASC LIMIT 1`.catch(() => [])) as any[];
  if (naechste?.zahlungsreferenz) return seite(naechste.zahlungsreferenz);
  const [app] = (await sqlPool`
    SELECT payment_reference FROM fiaon_applications
     WHERE (ref = ${r} OR payment_reference = ${r}) AND merged_into IS NULL AND payment_reference IS NOT NULL LIMIT 1`.catch(() => [])) as any[];
  if (app?.payment_reference) return seite(app.payment_reference);
  return "/dashboard";
}

async function umleiten(res: Response, token: string, art: "sepa" | "sofort") {
  try {
    const ref = tokenPruefen(token, art);
    return res.redirect(ref ? await zahlungsseiteFuer(ref) : "/dashboard");
  } catch (err) {
    console.error("[LASTSCHRIFT] Umleitung:", err);
    return res.redirect("/dashboard");
  }
}

// ── Alte Links aus Mails ────────────────────────────────────────────────────
router.get("/lastschrift/direkt/:token", (req: Request, res: Response) => umleiten(res, String(req.params.token || ""), "sepa"));
router.get("/lastschrift/direkt/:token/zurueck", (req: Request, res: Response) => umleiten(res, String(req.params.token || ""), "sepa"));
router.get("/zahlung/sofort/:token", (req: Request, res: Response) => umleiten(res, String(req.params.token || ""), "sofort"));
router.get("/zahlung/sofort/zurueck/:ref", async (req: Request, res: Response) => {
  try { return res.redirect(await zahlungsseiteFuer(String(req.params.ref || ""))); }
  catch { return res.redirect("/dashboard"); }
});

// ── Alte Knöpfe im Kundenbereich ────────────────────────────────────────────
router.post("/kunde/:ref/lastschrift/start", requireKunde, (_req: KundeRequest, res: Response) => {
  res.status(410).json({ ok: false, code: "BEENDET", error: LASTSCHRIFT_BEENDET });
});
router.get("/kunde/:ref/lastschrift/rueckkehr", requireKunde, (_req: KundeRequest, res: Response) => {
  res.redirect("/dashboard#abo");
});

// ── Alte Werkzeuge der Leitung ──────────────────────────────────────────────
router.post(["/admin/lastschrift/abos", "/admin/lastschrift/abgleich"], (_req: Request, res: Response) => {
  res.status(410).json({ ok: false, error: "GoCardless ist seit dem 19.09.2026 beendet — es gibt keine Abos und keine Mandate mehr abzugleichen." });
});

// ── Der Webhook: annehmen, nichts verarbeiten ───────────────────────────────
// Antwortet 200, damit GoCardless nicht tagelang wiederholt. Gebucht wird nichts:
// Was GoCardless noch einzieht, erstattet FIAON — die Rate zahlt der Kunde per Überweisung.
let letzteMeldung = 0;
router.post("/gocardless/webhook", (req: Request, res: Response) => {
  const n = Array.isArray(req.body?.events) ? req.body.events.length : 0;
  if (Date.now() - letzteMeldung > 6 * 60 * 60 * 1000) {
    letzteMeldung = Date.now();
    console.log(`[LASTSCHRIFT] GoCardless-Webhook mit ${n} Ereignis(sen) angenommen und verworfen — Zusammenarbeit seit 19.09.2026 beendet.`);
  }
  res.json({ ok: true, verarbeitet: false });
});

export default router;
