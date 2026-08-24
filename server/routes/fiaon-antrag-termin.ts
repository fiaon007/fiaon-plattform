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
    if (!a) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden." });
    let personId: number | null = a.person_id ? Number(a.person_id) : null;
    if (!personId) {
      // Ein frischer Antrag hat noch keine Person — jetzt anlegen/zuordnen, damit der Termin an ihr hängt.
      const { bindePersonAnAntrag } = await import("../fiaon-person-model");
      const z = await bindePersonAnAntrag(ref).catch(() => null);
      personId = z?.personId ?? null;
    }
    if (!personId) return res.status(409).json({ ok: false, error: "Bitte speichern Sie zuerst Ihre Angaben – dann lässt sich ein Termin buchen." });
    // ── DER WEG STEHT JETZT IM LINK (24.08.2026) ──────────────────────────
    // VORHER `/termin/<token>` ohne Zusatz. Ein Termin aus der Antragsstrecke
    // (also VOR der Zahlung) landete damit im Bestand als
    // `quelle='nichterreicht_mail'` — genau wie ein Termin aus der Mail „Wir
    // haben Sie nicht erreicht". Zwei völlig verschiedene Lagen, ein Datensatz.
    // NACHHER trägt der Link `?von=antrag_vor_zahlung`; die Buchung legt das
    // als `fiaon_termine.herkunft` ab. An der Gesprächsart ändert es NICHTS —
    // die bleibt aus dem Kundenzustand abgeleitet.
    res.json({ ok: true, url: `/termin/${terminTokenErzeugen(personId)}?von=antrag_vor_zahlung` });
  } catch (err) {
    console.error("[ANTRAG-TERMIN] termin-link:", err);
    res.status(500).json({ ok: false, error: "Der Terminlink konnte nicht erzeugt werden." });
  }
});

export default router;
