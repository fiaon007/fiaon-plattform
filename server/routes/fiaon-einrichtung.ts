// ═══════════════════════════════════════════════════════════════════════════
// DIE EINRICHTUNG — vom angenommenen Vertrag direkt in den Bereich (23.08.2026)
//
// Justin: „Wenn man den Vertrag angenommen hat, wird man direkt eingeloggt (im
// Hintergrund sieht man unscharf sein Konto), dann Passwort festlegen, dann die
// Zahlungsdetails — oder die Frage, ob er vorher einen Termin mit einem
// Mitarbeiter möchte."
//
// POST /antrag/:ref/einloggen      → setzt das Kunden-Cookie für einen frischen
//                                     Antrag (max. 48 h alt, noch ohne Passwort).
// POST /kunde/:ref/passwort-setzen → erstes Passwort (nur, solange keins da ist).
// Die Zahlungsdaten liefert weiterhin GET /payment-order/:ref, den Termin
// GET /antrag/:ref/termin-link — beides gibt es schon.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { kundenSitzungSetzen, requireKunde, istGehasht, passwortHashen, type KundeRequest } from "../lib/fiaon-kunde-session";

const router = Router();

router.post("/antrag/:ref/einloggen", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref || "").trim().toUpperCase();
    if (!/^FIAON-[A-Z0-9-]{4,}$/.test(ref)) return res.status(400).json({ ok: false, error: "Ungültige Referenz." });
    const [a] = (await sqlPool`SELECT ref, password, created_at, email FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL AND gdpr_deleted_at IS NULL LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden." });
    const alter = Date.now() - new Date(a.created_at).getTime();
    // Nur ein frischer Antrag ohne Passwort darf ohne Passwort hinein — alles andere geht über /login.
    if (istGehasht(a.password) || alter > 48 * 60 * 60 * 1000) return res.status(403).json({ ok: false, error: "Bitte melden Sie sich mit Ihrem Passwort an.", login: true });
    kundenSitzungSetzen(res, ref, { bleiben: true });
    res.json({ ok: true, ref, email: a.email || null });
  } catch (err) { console.error("[EINRICHTUNG] einloggen:", err); res.status(500).json({ ok: false, error: "Anmeldung fehlgeschlagen." }); }
});

router.post("/kunde/:ref/passwort-setzen", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const neu = String(req.body?.neu || "");
    if (neu.length < 8) return res.status(400).json({ ok: false, error: "Mindestens 8 Zeichen." });
    const [a] = (await sqlPool`SELECT password FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });
    if (istGehasht(a.password)) return res.status(409).json({ ok: false, error: "Es gibt schon ein Passwort – ändern Sie es unter „Passwort & Sicherheit“." });
    await sqlPool`UPDATE fiaon_applications SET password = ${passwortHashen(neu)}, updated_at = NOW() WHERE ref = ${ref}`;
    res.json({ ok: true });
  } catch (err) { console.error("[EINRICHTUNG] passwort-setzen:", err); res.status(500).json({ ok: false, error: "Passwort konnte nicht gespeichert werden." }); }
});

export default router;
