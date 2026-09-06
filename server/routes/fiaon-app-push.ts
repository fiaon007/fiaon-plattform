// ═══════════════════════════════════════════════════════════════════════════
// /APP — PUSH-ABOS DES KUNDEN (Scheibe 6, Modul B, 06.09.2026)
//
// Drei Endpunkte hinter `requireKunde`, alle am MENSCHEN (person_id):
//   GET    /kunde/:ref/app/push            → { verfuegbar, publicKey, abonniert }
//   POST   /kunde/:ref/app/push            { subscription } → speichern (UPSERT über endpoint)
//   DELETE /kunde/:ref/app/push            { endpoint } → geloescht_am
//
// Ohne VAPID-Schlüssel in der Umgebung antworten alle drei ehrlich mit
// { ok: true, verfuegbar: false } — der Client zeigt dann „nicht verfügbar“,
// kein Fehler 500, kein Versand. Die Sätze, die Nachtruhe und die Tagesbremse
// liegen in ../lib/fiaon-push.ts; hier steht nur die Tür.
// Einhängen: server/routes.ts, `app.use('/api/fiaon', fiaonAppPush.default)`.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { personFuerRef, keinePerson } from "./fiaon-app";
import { pushSchluessel, aboPruefen, aboSpeichern, aboLoeschen, aboVorhanden, ensurePushTabellen } from "../lib/fiaon-push";

const router = Router();

const STOERUNG = "Ihre Mitteilungs-Einstellung konnte gerade nicht geladen werden. Bitte versuchen Sie es gleich noch einmal.";

/** GET /kunde/:ref/app/push[?endpoint=…] — Stand für den Bildschirm „Mitteilungen“. */
router.get("/kunde/:ref/app/push", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const schluessel = pushSchluessel();
    if (!schluessel) return res.json({ ok: true, verfuegbar: false, publicKey: null, abonniert: false });
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    await ensurePushTabellen();
    const endpoint = typeof req.query?.endpoint === "string" ? String(req.query.endpoint).trim().slice(0, 2000) : null;
    const abonniert = await aboVorhanden(p.personId, endpoint || null);
    res.json({ ok: true, verfuegbar: true, publicKey: schluessel.publicKey, abonniert });
  } catch (e: any) {
    console.error("[PUSH] GET push:", e?.message || e);
    res.status(500).json({ ok: false, error: STOERUNG });
  }
});

/** POST /kunde/:ref/app/push { subscription: { endpoint, keys: { p256dh, auth } } } — Abo dieses Geräts speichern. */
router.post("/kunde/:ref/app/push", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const schluessel = pushSchluessel();
    if (!schluessel) return res.json({ ok: true, verfuegbar: false, abonniert: false });
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const abo = aboPruefen(req.body?.subscription ?? req.body);
    if (!abo) return res.status(400).json({ ok: false, error: "Das Abo Ihres Browsers ist unvollständig angekommen. Bitte schalten Sie die Mitteilungen noch einmal ein." });
    abo.userAgent = String(req.headers["user-agent"] || "").slice(0, 300) || null;
    await aboSpeichern(p.personId, abo);
    res.json({ ok: true, verfuegbar: true, abonniert: true, text: "Mitteilungen sind eingeschaltet. Sie erhalten weiterhin jede Nachricht per E-Mail." });
  } catch (e: any) {
    console.error("[PUSH] POST push:", e?.message || e);
    res.status(500).json({ ok: false, error: "Die Mitteilungen konnten gerade nicht eingeschaltet werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

/** DELETE /kunde/:ref/app/push { endpoint } — Abo dieses Geräts abmelden (geloescht_am). */
router.delete("/kunde/:ref/app/push", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const schluessel = pushSchluessel();
    if (!schluessel) return res.json({ ok: true, verfuegbar: false, abonniert: false });
    const p = await personFuerRef(req.kundeRef!);
    if (!p) return keinePerson(res);
    const endpoint = String(req.body?.endpoint ?? req.query?.endpoint ?? "").trim();
    if (!endpoint) return res.status(400).json({ ok: false, error: "Es fehlt die Kennung dieses Geräts. Bitte versuchen Sie es noch einmal." });
    await aboLoeschen(p.personId, endpoint.slice(0, 2000));
    res.json({ ok: true, verfuegbar: true, abonniert: await aboVorhanden(p.personId, null), text: "Mitteilungen auf diesem Gerät sind ausgeschaltet. Per E-Mail erreichen wir Sie weiterhin." });
  } catch (e: any) {
    console.error("[PUSH] DELETE push:", e?.message || e);
    res.status(500).json({ ok: false, error: "Die Mitteilungen konnten gerade nicht ausgeschaltet werden. Bitte versuchen Sie es gleich noch einmal." });
  }
});

export default router;
