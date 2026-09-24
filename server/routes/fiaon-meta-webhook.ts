// ═══════════════════════════════════════════════════════════════════════════
// /api/meta/webhook — DIE TÜR, DURCH DIE META LEADS MELDET (22.09.2026, E-210)
//
// GET  = Anmeldung: Meta schickt hub.challenge und unseren Prüf-Token; wir
//        antworten mit der Challenge, wenn der Token passt.
// POST = Meldung: Signatur (X-Hub-Signature-256) über die Bytes, wie sie
//        ankamen; dann ERST speichern, DANN 200. Die Verarbeitung (Lead bei Meta
//        abrufen, anlegen, begrüßen) läuft danach — Meta wartet nicht darauf.
// Keine Signatur, kein Speichern: Eine Meldung, die jeder schicken kann, darf
// keinen Lead anlegen.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { pruefTokenPasst, signaturPruefen, metaKonfig } from "../lib/fiaon-meta";

const router = Router();

router.get("/webhook", (req: Request, res: Response) => {
  const modus = String(req.query["hub.mode"] ?? "");
  const token = req.query["hub.verify_token"];
  const challenge = String(req.query["hub.challenge"] ?? "");
  if (modus === "subscribe" && pruefTokenPasst(token) && challenge) {
    res.status(200).type("text/plain").send(challenge);
    return;
  }
  res.status(403).json({ ok: false });
});

router.post("/webhook", async (req: Request, res: Response) => {
  if (!metaKonfig().bereit) {
    // Noch nicht eingerichtet: nicht annehmen — Meta wiederholt, und der
    // Nachhol-Lauf holt nach, sobald der Zugang steht.
    res.status(503).json({ ok: false, error: "Meta-Zugang noch nicht eingerichtet" });
    return;
  }
  const roh = (req as any).rawBody as string | undefined;
  if (!signaturPruefen(roh, req.headers["x-hub-signature-256"])) {
    console.warn("[META-WEBHOOK] Meldung mit ungültiger Signatur abgelehnt");
    res.status(401).json({ ok: false });
    return;
  }
  try {
    const { meldungSpeichern, meldungenVerarbeiten } = await import("../lib/fiaon-meta-leads");
    const erg = await meldungSpeichern(req.body);
    res.status(200).json({ ok: true });
    if (erg.leads > 0) {
      setImmediate(() => {
        meldungenVerarbeiten().catch((e) => console.error("[META-WEBHOOK] Verarbeitung:", e));
      });
    }
  } catch (err) {
    // Nicht gespeichert → KEINE 200: Meta versucht es erneut.
    console.error("[META-WEBHOOK] Speichern:", err);
    res.status(500).json({ ok: false });
  }
});

// ── POST /api/meta/widerruf — DER WIDERRUF ERREICHT DEN SERVER (24.09.2026, E-239) ──
// Wählt jemand im Einwilligungs-Hinweis „Marketing" ab, schickt der Browser
// seine Pixel-Kennung (_fbp). Jeder Messsatz dieses Browsers verliert die
// Einwilligung; ist er angemeldet, jeder Satz der Person. Ohne Anmeldung, weil
// ein Widerruf so einfach sein muss wie die Zustimmung (Art. 7 Abs. 3 DSGVO) —
// und eine fremde _fbp kann niemand raten. Die Antwort verrät nichts.
router.post("/widerruf", async (req: Request, res: Response) => {
  try {
    const fbp = typeof req.body?.fbp === "string" ? req.body.fbp : null;
    let personId: number | null = null;
    try {
      const { kundeAusCookie } = await import("../lib/fiaon-kunde-session");
      const ref = kundeAusCookie(req);
      if (ref) {
        const { sqlPool } = await import("../lib/db-pool");
        const [a] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${String(ref)} LIMIT 1`) as any[];
        personId = a?.person_id ?? null;
      }
    } catch { /* ohne Anmeldung: nur über die Pixel-Kennung */ }
    const { einwilligungWiderrufen } = await import("../lib/fiaon-meta-capi");
    const n = await einwilligungWiderrufen({ fbp, personId });
    if (n) console.log(`[META-MESSUNG] Widerruf: ${n} Messsatz/-sätze ohne Einwilligung gesetzt`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[META-MESSUNG] Widerruf:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
