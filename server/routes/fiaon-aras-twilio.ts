// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Twilio-Rückrufe (E-408, Vertrag § 6)
//
// Alle POST-Webhooks prüfen die Twilio-Signatur (X-Twilio-Signature gegen
// APP_BASE_URL + Pfad + Formfelder) — sonst 403. Keine Chef-Wache: Twilio hat
// kein Cookie. Die Kennung des Anrufs reist als ?anruf= in jeder Adresse
// (E-012-Regel: nie „irgendeine“ Zeile raten).
//
//   POST /aras/twiml               Kunde hat abgenommen → <Connect><Stream>
//   POST /aras/status              initiated/ringing/answered/completed …
//   POST /aras/amd                 Mensch oder Mailbox (nur ohne Kundenstimme auflegen)
//   POST /aras/aufnahme            recording_sid/url an fiaon_calls (nie überschreiben)
//   POST /aras/uebergabe-ergebnis  nach <Dial> ins Softphone
//   POST /aras/eingehend           ARAS-Nummer eingehend — bis Scheibe 6 Weiterleitung auf den Team-Eingang
//   WS   /aras/stream              Media Streams (fiaon-aras-bruecke.ts, am HTTP-Server angebunden)
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { arasSchema } from "../lib/fiaon-aras-schema";
import { twilioSignaturPruefen, streamTokenPruefen, streamToken, twimlStream, twimlAuflegen, xml } from "../lib/fiaon-aras-twilio-client";
import { laeuft, hatteSitzung, mailboxErkannt, sitzungBeenden, uebergabeLaeuft, vorbereiten } from "../lib/fiaon-aras-bruecke";
import { nachbereiten } from "../lib/fiaon-aras-nachbereitung";
import { arasEinstellungenLesen } from "../lib/fiaon-aras-plan";
import { arasEreignis } from "../lib/fiaon-aras-ereignis";
import { absoluteUrl } from "../fiaon-base-url";
import type { Spielart } from "../../shared/fiaon-aras";

export { arasStreamAnbinden } from "../lib/fiaon-aras-bruecke";

const router = Router();

/** Die Signaturprüfung — im Prüfstand (ARAS_SIGNATUR=aus, nie in Produktion) abschaltbar. */
function signiert(req: Request, res: Response): boolean {
  if (process.env.NODE_ENV !== "production" && String(process.env.ARAS_SIGNATUR || "").toLowerCase() === "aus") return true;
  const s = twilioSignaturPruefen(req);
  if (!s.ok) { res.status(403).type("text/plain").send("Forbidden"); return false; }
  return true;
}
const anrufId = (req: Request): number | null => Number(String(req.query?.anruf ?? "").replace(/\D/g, "")) || null;
const twiml = (res: Response, body: string) => res.status(200).type("text/xml").send(body);

async function arasZeile(callId: number): Promise<{ id: number; call_id: number; spielart: Spielart; nachbereitet_am: unknown; person_id: number | null; twilio_sid: string | null; sitzung_id: string | null } | null> {
  const [z] = (await sqlPool`SELECT aa.id, aa.call_id, aa.spielart, aa.nachbereitet_am, aa.sitzung_id, c.person_id, c.twilio_sid FROM fiaon_aras_anruf aa JOIN fiaon_calls c ON c.id = aa.call_id WHERE aa.call_id = ${callId}`) as any[];
  return z ? { ...z, id: Number(z.id), call_id: Number(z.call_id), person_id: z.person_id != null ? Number(z.person_id) : null } : null;
}

/**
 * Ein Anruf, der nie eine Sitzung hatte (nicht abgenommen, besetzt, Fehler): trotzdem nachbereiten — Zähler, Plan, Akte.
 * Hatte er eine Sitzung, macht das die Brücke selbst (mit dem echten Verlauf). Anrufe 12, 15, 16 (20.10.): Legten WIR auf
 * (Chefbüro, Abschied), kam Twilios „completed“, während die Brücke noch nachbereitete — diese Stelle war schneller und
 * schrieb „nicht_erreicht · Niemand hat gesprochen“ über 90–187 s echtes Gespräch.
 */
async function ohneSitzungAbschliessen(callId: number, grund: string): Promise<void> {
  const z = await arasZeile(callId);
  if (!z || z.nachbereitet_am || laeuft(callId) || hatteSitzung(callId) || z.sitzung_id) return;
  await nachbereiten(z.id, { zeilen: [], ausgefuehrt: [], endeGrund: grund, sekunden: 0, aufnahmeJa: false, ergebnis: grund === "mailbox" ? "mailbox" : null, ergebnisNotiz: null, ergebnisGesetzt: false, kundeHatGesprochen: false });
  // Die Live-Karte kennt den Anruf schon seit „gewählt“ — auch ohne Gespräch bekommt sie ihr Ende (kein Kasten bleibt stehen).
  await arasEreignis({ art: "aras_ende", callId, arasAnrufId: z.id, personId: z.person_id, spielart: z.spielart, text: `Ende: ${grund} (ohne Gespräch)`, daten: { grund, ohneSitzung: true } });
}

// ── Abheben → Ton-Strom ────────────────────────────────────────────────────
router.post("/aras/twiml", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  try {
    await arasSchema();
    const id = anrufId(req);
    const t = String(req.query?.t ?? "");
    if (!id || !streamTokenPruefen(id, t)) return twiml(res, twimlAuflegen());
    const einst = await arasEinstellungenLesen(true);
    if (einst.notaus) return twiml(res, twimlAuflegen());
    const sid = String(req.body?.CallSid ?? "");
    await sqlPool`UPDATE fiaon_calls SET status = 'laeuft', twilio_sid = COALESCE(twilio_sid, ${sid || null}), updated_at = NOW() WHERE id = ${id}`;
    await sqlPool`UPDATE fiaon_aras_anruf SET angenommen_am = COALESCE(angenommen_am, NOW()), updated_at = NOW() WHERE call_id = ${id}`;
    const fortsetzung = String(req.query?.fortsetzung ?? "");
    // Schnell (Prio 3): die Sitzung beim Anbieter jetzt schon aufbauen — die Begrüßung liegt bereit, wenn der Ton-Strom kommt.
    if (!fortsetzung) vorbereiten(id);
    return twiml(res, twimlStream(id, streamToken(id), fortsetzung ? { fortsetzung } : {}));
  } catch (err) {
    console.error("[ARAS-TWIML]", String((err as Error)?.message ?? err).slice(0, 200));
    return twiml(res, twimlAuflegen());
  }
});

// ── Status ─────────────────────────────────────────────────────────────────
router.post("/aras/status", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  res.status(200).send("");
  try {
    const id = anrufId(req);
    if (!id) return;
    const b = req.body as any;
    const status = String(b?.CallStatus ?? "").toLowerCase();
    const dauer = Number(b?.CallDuration ?? 0) || null;
    const sid = String(b?.CallSid ?? "");
    const neu = status === "completed" ? "beendet" : status === "busy" ? "besetzt" : status === "no-answer" ? "niemand_erreicht"
      : status === "failed" ? "fehlgeschlagen" : status === "canceled" ? "abgebrochen" : status === "in-progress" || status === "answered" ? "laeuft" : null;
    if (sid) await sqlPool`UPDATE fiaon_calls SET twilio_sid = COALESCE(twilio_sid, ${sid}), updated_at = NOW() WHERE id = ${id}`;
    if (!neu) return;
    if (neu === "laeuft") { await sqlPool`UPDATE fiaon_calls SET status = 'laeuft', updated_at = NOW() WHERE id = ${id} AND status = 'gewaehlt'`; return; }
    await sqlPool`UPDATE fiaon_calls SET status = CASE WHEN status IN ('gewaehlt', 'laeuft') THEN ${neu} ELSE status END, ende = COALESCE(ende, NOW()),
                   dauer_sek = COALESCE(dauer_sek, ${dauer}), updated_at = NOW() WHERE id = ${id}`;
    if (laeuft(id)) { await sitzungBeenden(id, uebergabeLaeuft(id) ? "uebergabe" : "kunde_aufgelegt"); return; }
    await ohneSitzungAbschliessen(id, neu === "beendet" ? "kunde_aufgelegt" : neu === "niemand_erreicht" ? "nicht_erreicht" : neu);
  } catch (err) { console.error("[ARAS-STATUS]", String((err as Error)?.message ?? err).slice(0, 200)); }
});

// ── Mensch oder Mailbox ────────────────────────────────────────────────────
router.post("/aras/amd", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  res.status(200).send("");
  try {
    const id = anrufId(req);
    const wer = String((req.body as any)?.AnsweredBy ?? "").toLowerCase();
    if (!id || !wer) return;
    const deutsch = wer === "human" ? "mensch" : wer.startsWith("machine") ? "mailbox" : wer === "fax" ? "fax" : "unklar";
    await sqlPool`UPDATE fiaon_calls SET angenommen_von = ${deutsch}, updated_at = NOW() WHERE id = ${id}`;
    if (deutsch !== "mailbox" && deutsch !== "fax") return;
    const z = await arasZeile(id);
    const r = await mailboxErkannt(id);
    if (r === "weiter") { await sqlPool`UPDATE fiaon_calls SET angenommen_von = 'unklar', updated_at = NOW() WHERE id = ${id}`; return; }
    if (z) await arasEreignis({ art: "aras_mailbox", callId: id, arasAnrufId: z.id, personId: z.person_id, spielart: z.spielart, text: r === "aufgelegt" ? "Mailbox erkannt — aufgelegt, keine Nachricht" : "Mailbox erkannt (noch keine Sitzung)" });
    if (r === "unbekannt") {
      // Die Sitzung lief noch nicht: Twilio auflegen, Nachbereitung als Mailbox
      try { const { twilioClient } = await import("../lib/fiaon-aras-twilio-client"); if (z?.twilio_sid && !z.twilio_sid.startsWith("ATTRAPPE")) await (await twilioClient()).calls(z.twilio_sid).update({ status: "completed" }); } catch { /* egal */ }
      await ohneSitzungAbschliessen(id, "mailbox");
    }
  } catch (err) { console.error("[ARAS-AMD]", String((err as Error)?.message ?? err).slice(0, 200)); }
});

// ── Aufnahme (nur nach Ja, per Werkzeug gestartet) ─────────────────────────
router.post("/aras/aufnahme", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  res.status(200).send("");
  try {
    const id = anrufId(req);
    const b = req.body as any;
    const rsid = String(b?.RecordingSid ?? ""), rurl = String(b?.RecordingUrl ?? "");
    if (!id || !rsid) return;
    await sqlPool`UPDATE fiaon_calls SET recording_sid = COALESCE(recording_sid, ${rsid}), recording_url = COALESCE(recording_url, ${rurl || null}), updated_at = NOW() WHERE id = ${id}`;
  } catch (err) { console.error("[ARAS-AUFNAHME]", String((err as Error)?.message ?? err).slice(0, 200)); }
});

// ── Übergabe-Ergebnis nach <Dial> ──────────────────────────────────────────
router.post("/aras/uebergabe-ergebnis", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  try {
    const id = anrufId(req);
    const status = String((req.body as any)?.DialCallStatus ?? "").toLowerCase();
    if (!id) return twiml(res, twimlAuflegen());
    const z = await arasZeile(id);
    if (status === "completed") {
      await sqlPool`UPDATE fiaon_aras_anruf SET uebergabe_status = 'angenommen', updated_at = NOW() WHERE call_id = ${id}`;
      if (z) await arasEreignis({ art: "aras_uebergabe", callId: id, arasAnrufId: z.id, personId: z.person_id, spielart: z.spielart, text: "Übergabe angenommen — Gespräch beim Menschen beendet" });
      return twiml(res, twimlAuflegen());
    }
    await sqlPool`UPDATE fiaon_aras_anruf SET uebergabe_status = 'nicht_angenommen', nachbereitet_am = NULL, updated_at = NOW() WHERE call_id = ${id}`;
    if (z) await arasEreignis({ art: "aras_uebergabe", callId: id, arasAnrufId: z.id, personId: z.person_id, spielart: z.spielart, text: `Übergabe nicht angenommen (${status || "—"}) — ARAS übernimmt wieder`, ok: false });
    return twiml(res, twimlStream(id, streamToken(id), { fortsetzung: "uebergabe_gescheitert" }));
  } catch (err) {
    console.error("[ARAS-UEBERGABE]", String((err as Error)?.message ?? err).slice(0, 200));
    return twiml(res, twimlAuflegen());
  }
});

// ── Eingehend auf der ARAS-Nummer — Scheibe 6; bis dahin derselbe Weg wie die Team-Nummer ──
router.post("/aras/eingehend", async (req: Request, res: Response) => {
  if (!signiert(req, res)) return;
  const ziel = absoluteUrl("/api/fiaon/telefon/eingehend");
  return twiml(res, `<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${xml(ziel)}</Redirect></Response>`);
});

export default router;
