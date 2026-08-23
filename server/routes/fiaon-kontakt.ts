// ═══════════════════════════════════════════════════════════════════════════
// KONTAKT & SUPPORT — KI-Assistent und „Dringend melden" (23.08.2026)
//
// POST /kontakt/chat      { nachrichten: [{ rolle: "kunde"|"assistent", text }] }
//                         → Antwort des FIAON-Assistenten (OpenAI, Wissen aus
//                           shared/fiaon-wissen.ts). Kein Login, kein Speichern
//                           des Gesprächs, Begrenzung je IP.
// POST /kontakt/dringend  { name, email, telefon, text, an }
//                         → Aufgabe in Justins Liste (fiaon_betreiber_todos,
//                           Priorität „heute"); bei eingeloggtem Kunden mit
//                           Ansprechpartner und an = "ansprechpartner" direkt an
//                           diesen Mitarbeiter übergeben. Erscheint sofort im
//                           Admin-Dashboard (Zähler „Meine Liste").
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { wissenText, SUPPORT } from "@shared/fiaon-wissen";
import { kundeAusCookie } from "../lib/fiaon-kunde-session";

const router = Router();

// ── Begrenzung je IP: 30 Chat-Nachrichten und 5 Dringend-Meldungen je Stunde ──
const zaehler = new Map<string, { n: number; bis: number }>();
function erlaubt(schluessel: string, max: number): boolean {
  const jetzt = Date.now(); const e = zaehler.get(schluessel);
  if (!e || e.bis < jetzt) { zaehler.set(schluessel, { n: 1, bis: jetzt + 60 * 60 * 1000 }); return true; }
  if (e.n >= max) return false; e.n++; return true;
}
const ip = (req: Request) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();

router.post("/kontakt/chat", async (req: Request, res: Response) => {
  try {
    if (!erlaubt(`chat:${ip(req)}`, 30)) return res.status(429).json({ ok: false, error: "Zu viele Nachrichten – bitte in einer Stunde erneut, oder rufen Sie uns an." });
    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.json({ ok: true, antwort: `Der Assistent ist gerade nicht erreichbar. Unser Support hilft sofort: ${SUPPORT.telefon} oder ${SUPPORT.email}.` });
    const roh = Array.isArray(req.body?.nachrichten) ? req.body.nachrichten : [];
    const nachrichten = roh.slice(-12).map((n: any) => ({ role: n.rolle === "assistent" ? "assistant" : "user", content: String(n.text || "").slice(0, 2000) })).filter((n: any) => n.content.trim());
    if (!nachrichten.length) return res.status(400).json({ ok: false, error: "Keine Frage." });
    const modell = process.env.FIAON_CHAT_MODELL || "gpt-4.1-mini";
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modell, temperature: 0.3, max_tokens: 600, messages: [{ role: "system", content: wissenText() }, ...nachrichten] }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) { console.error("[KONTAKT-CHAT] OpenAI", r.status, j?.error?.message); return res.json({ ok: true, antwort: `Gerade klemmt es bei mir. Unser Support hilft sofort: ${SUPPORT.telefon} oder ${SUPPORT.email}.` }); }
    res.json({ ok: true, antwort: String(j?.choices?.[0]?.message?.content || "").trim() || "Dazu kann ich nichts sagen – unser Support hilft gern weiter." });
  } catch (err) { console.error("[KONTAKT-CHAT]", err); res.status(500).json({ ok: false, error: "Der Assistent ist gerade nicht erreichbar." }); }
});

router.post("/kontakt/dringend", async (req: Request, res: Response) => {
  try {
    if (!erlaubt(`dringend:${ip(req)}`, 5)) return res.status(429).json({ ok: false, error: "Bitte rufen Sie uns bei weiteren dringenden Anliegen an." });
    const b = req.body || {};
    const name = String(b.name || "").trim().slice(0, 120), email = String(b.email || "").trim().slice(0, 160), telefon = String(b.telefon || "").trim().slice(0, 60);
    const text = String(b.text || "").trim().slice(0, 3000); const an = b.an === "ansprechpartner" ? "ansprechpartner" : "geschaeftsfuehrung";
    if (text.length < 10) return res.status(400).json({ ok: false, error: "Bitte beschreiben Sie Ihr Anliegen in mindestens einem Satz." });
    if (!email && !telefon) return res.status(400).json({ ok: false, error: "Bitte E-Mail oder Telefon angeben, damit wir antworten können." });
    const { ensureTodoTabelle } = await import("./fiaon-betreiber-todo");
    await ensureTodoTabelle();

    // Eingeloggter Kunde? Dann Referenz und Ansprechpartner mitnehmen.
    const ref = kundeAusCookie(req);
    let kunde: any = null;
    if (ref) {
      const [k] = (await sqlPool`SELECT a.ref, a.first_name, a.last_name, a.email, p.assigned_agent_id, (SELECT g.name FROM fiaon_agents g WHERE g.id = p.assigned_agent_id) AS agent_name
        FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
      kunde = k || null;
    }
    const wer = name || (kunde ? `${kunde.first_name || ""} ${kunde.last_name || ""}`.trim() : "") || "Unbekannt";
    const titel = `Dringend von ${wer}${kunde ? ` (${kunde.ref})` : ""}: ${text.slice(0, 60)}${text.length > 60 ? "…" : ""}`;
    const body = [`Anliegen (dringend, über fiaon.com/kontakt):`, text, "", `Name: ${wer}`, `E-Mail: ${email || kunde?.email || "–"}`, `Telefon: ${telefon || "–"}`, kunde ? `Kunde: ${kunde.ref} · Ansprechpartner: ${kunde.agent_name || "–"}` : "Kein eingeloggter Kunde", `Gewünscht: ${an === "ansprechpartner" ? "Ansprechpartner" : "Geschäftsführung"}`].join("\n");
    const [t] = (await sqlPool`
      INSERT INTO fiaon_betreiber_todos (titel, text, bereich, prioritaet, faellig_am, link, quelle, letzte_aktivitaet)
      VALUES (${titel}, ${body}, 'sonstiges', 1, CURRENT_DATE, ${kunde ? `/admin/kunden?q=${encodeURIComponent(kunde.ref)}` : null}, 'kontakt', NOW())
      RETURNING id`) as any[];
    let uebergebenAn: string | null = null;
    if (an === "ansprechpartner" && kunde?.assigned_agent_id) {
      const [a] = (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ${Number(kunde.assigned_agent_id)} AND COALESCE(active, TRUE) = TRUE`) as any[];
      if (a) {
        await sqlPool`UPDATE fiaon_betreiber_todos SET zustaendig_art = 'agent', zustaendig_agent_id = ${a.id}, zustaendig_name = ${a.name}, delegiert_am = NOW(), status = 'offen', updated_at = NOW() WHERE id = ${t.id}`;
        await sqlPool`INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text) VALUES (${t.id}, 'system', 'System', 'status', ${`Dringende Kundenmeldung – direkt an ${a.name} übergeben.`})`;
        uebergebenAn = a.name;
      }
    }
    await sqlPool`INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text) VALUES (${t.id}, 'system', 'System', 'kommentar', ${`Eingegangen über die Kontaktseite (${an === "ansprechpartner" ? "an Ansprechpartner" : "an Geschäftsführung"}).`})`;
    if (kunde?.ref) await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note) VALUES (${kunde.ref}, NULL, 'System', 'system', ${`Dringende Meldung über die Kontaktseite: ${text.slice(0, 200)}`})`.catch(() => {});
    res.json({ ok: true, an: uebergebenAn ? `Ihre Ansprechpartnerin bzw. Ihr Ansprechpartner ${uebergebenAn}` : "die Geschäftsführung", nummer: Number(t.id) });
  } catch (err) { console.error("[KONTAKT-DRINGEND]", err); res.status(500).json({ ok: false, error: "Die Meldung konnte nicht gespeichert werden – bitte rufen Sie uns an." }); }
});

export default router;
