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
import { antragPasst } from "../lib/fiaon-antrag-sitzung";

const router = Router();

router.post("/antrag/:ref/einloggen", async (req: Request, res: Response) => {
  try {
    const ref = String(req.params.ref || "").trim().toUpperCase();
    if (!/^FIAON-[A-Z0-9-]{4,}$/.test(ref)) return res.status(400).json({ ok: false, error: "Ungültige Referenz." });
    // ── DER BROWSER MUSS DEN ANTRAG SELBST ANGELEGT HABEN (06.09.2026, Lücken-Audit B7) ──
    // Bis heute reichte die Referenz: Wer sie kannte (sie steht in jedem Verwendungszweck und
    // auf jeder Rechnung), bekam 48 Stunden lang eine volle 30-Tage-Kundensitzung. Jetzt
    // braucht es das Antrags-Cookie, das POST /application beim Anlegen (oder gegen die eigenen
    // Angaben) und GET /antrag/weiter/:token setzen — siehe lib/fiaon-antrag-sitzung.ts.
    if (!antragPasst(req, ref)) return res.status(403).json({ ok: false, error: "Bitte melden Sie sich mit Ihrer E-Mail-Adresse an.", login: true });
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


// ── GET /antrag/email-bekannt?email= — gibt es zu dieser E-Mail schon ein Konto? (23.08.2026, Justin:
//    „beim Antrag die Mail abgleichen – wenn es die schon gibt, anzeigen, vielleicht zum Login")
//    Antwort bewusst knapp (bekannt ja/nein, Passwort ja/nein) — keine Namen, keine Referenzen.
const emailZaehler = new Map<string, { n: number; bis: number }>();
router.get("/antrag/email-bekannt", async (req: Request, res: Response) => {
  try {
    const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
    const jetzt = Date.now(); const z = emailZaehler.get(ip);
    if (!z || z.bis < jetzt) emailZaehler.set(ip, { n: 1, bis: jetzt + 600000 }); else if (z.n++ > 60) return res.status(429).json({ ok: false });
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return res.json({ ok: true, bekannt: false });
    const [r] = (await sqlPool`SELECT (password IS NOT NULL AND password <> '') AS pw, status, payment_reference, payment_status, current_step FROM fiaon_applications
      WHERE lower(email) = ${email} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`) as any[];
    const unfertig = !!r && !r.payment_reference && r.payment_status !== "paid" && !r.pw;
    res.json({ ok: true, bekannt: !!r, hatPasswort: !!r?.pw, unfertig, schritt: unfertig ? Number(r.current_step || 1) : null });
  } catch (err) { console.error("[EMAIL-BEKANNT]", err); res.json({ ok: true, bekannt: false }); }
});


// ── POST /antrag/weiter-link { email } — „Weitermachen, wo ich aufgehört habe" (23.08.2026, Justin)
//    Die E-Mail allein ist kein Nachweis; der signierte Weiter-Link (14 Tage, wie die
//    Erinnerungsmail) geht an das Postfach — nur wer es öffnen kann, kommt in den Antrag.
const weiterZaehler = new Map<string, { n: number; bis: number }>();
router.post("/antrag/weiter-link", async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "Bitte eine gültige E-Mail-Adresse angeben." });
    const jetzt = Date.now(); const z = weiterZaehler.get(email);
    if (!z || z.bis < jetzt) weiterZaehler.set(email, { n: 1, bis: jetzt + 3600000 }); else if (z.n++ >= 3) return res.status(429).json({ ok: false, error: "Wir haben Ihnen den Link bereits geschickt – bitte schauen Sie auch im Spam-Ordner nach." });
    const [a] = (await sqlPool`SELECT ref, first_name, last_name, current_step, pack_key, pack_name, payment_reference, payment_status
      FROM fiaon_applications WHERE lower(email) = ${email} AND merged_into IS NULL ORDER BY created_at DESC LIMIT 1`) as any[];
    // Immer dieselbe Antwort — ob es den Antrag gibt, verrät diese Route nicht.
    if (!a || a.payment_reference || a.payment_status === "paid") return res.json({ ok: true, gesendet: true });
    const { weiterLink } = await import("../lib/fiaon-antrag-erinnerung");
    const { sendMakeWebhook } = await import("../make-webhook");
    const { absoluteUrl } = await import("../fiaon-base-url");
    const schritt = Number(a.current_step || 1);
    const ok = await sendMakeWebhook("antrag_erinnerung", {
      email, vorname: a.first_name || null, nachname: a.last_name || null, antrag_id: a.ref, paket: a.pack_name || null, pack_key: a.pack_key || null,
      schritt, schritt_text: `Schritt ${schritt}`, weiter_link: weiterLink(String(a.ref)), erinnerung_nr: 0, portal_url: absoluteUrl("/antrag"),
    } as any).catch(() => false);
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${a.ref}, NULL, 'System', 'system', ${`Kunde hat im Antrag den Weiter-Link angefordert — ${ok ? "verschickt" : "NICHT verschickt (Make)"}.`}, NOW())`.catch(() => {});
    res.json({ ok: true, gesendet: true });
  } catch (err) { console.error("[WEITER-LINK]", err); res.status(500).json({ ok: false, error: "Das hat nicht geklappt – bitte später erneut." }); }
});

export default router;
