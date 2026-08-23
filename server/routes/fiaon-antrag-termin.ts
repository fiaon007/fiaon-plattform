// ═══════════════════════════════════════════════════════════════════════════
// Termin mit dem Vertrieb aus dem Antrag heraus (23.08.2026, Justin: „auf der
// Seite muss er entweder einen Termin buchen können oder zur Zahlung").
//
// GET /antrag/:ref/termin-link → { ok, url: "/termin/<token>" }
// Der Token gehört zur Person des Antrags; welche Gesprächsart gebucht wird,
// entscheidet die Terminseite aus dem Zustand (unbezahlt → Verkaufsgespräch),
// nicht ein Parameter. 30 Tage gültig. Kein Login nötig — die Referenz ist
// das Geheimnis, das der Antragsteller ohnehin hat.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { terminTokenErzeugen } from "../lib/fiaon-termine";

const router = Router();

router.get("/antrag/:ref/termin-link", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref || "").trim().toUpperCase();
    if (!/^FIAON-[A-Z0-9-]{4,}$/.test(ref)) return res.status(400).json({ ok: false, error: "Ungültige Referenz." });
    const [a] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!a?.person_id) return res.status(404).json({ ok: false, error: "Zu dieser Referenz gibt es noch keine Person – bitte zuerst die Angaben speichern." });
    res.json({ ok: true, url: `/termin/${terminTokenErzeugen(Number(a.person_id))}` });
  } catch (err) {
    console.error("[ANTRAG-TERMIN] termin-link:", err);
    res.status(500).json({ ok: false, error: "Der Terminlink konnte nicht erzeugt werden." });
  }
});

export default router;
