// ═══════════════════════════════════════════════════════════════════════════
// ANFRAGEN VON DER WEBSITE — Investoren, Presse, Datenraum, Partner, Karriere
// Ein Endpunkt, eine Tabelle, eine Aufgabe an Justin (fiaon_vermerke,
// fuer_betreiber). Bewerbungen (E-026) zusätzlich mit Kunden-Bezug, wenn
// der Bewerber ein Kunde ist.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";

const router = Router();
const ARTEN = new Set(["investor", "presse", "datenraum", "partner", "karriere"]);
const TITEL: Record<string, string> = { investor: "Investoren-Anfrage", presse: "Presseanfrage", datenraum: "Datenraum-Zugang angefragt", partner: "Partner-Anfrage", karriere: "Bewerbung (Werde Teil des Teams)" };
const letzte = new Map<string, number>();

router.post("/anfrage", async (req: Request, res: Response) => {
  try {
    const b = req.body || {};
    const art = String(b.art || "");
    if (!ARTEN.has(art)) return res.status(400).json({ ok: false, error: "Unbekannte Anfrage." });
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim();
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "Bitte Name und eine gültige E-Mail-Adresse angeben." });
    // Schutz gegen Doppelklick und Spam: eine Anfrage je Adresse und Minute.
    const k = `${art}:${email}`; const t = letzte.get(k) || 0;
    if (Date.now() - t < 60_000) return res.json({ ok: true, meldung: "Ihre Anfrage ist angekommen." });
    letzte.set(k, Date.now());

    await sqlPool`
      CREATE TABLE IF NOT EXISTS fiaon_anfragen (
        id SERIAL PRIMARY KEY, art VARCHAR NOT NULL, name TEXT, email TEXT, firma TEXT, telefon TEXT, rolle TEXT, land TEXT,
        kunde TEXT, erfahrung TEXT, text TEXT, person_id INTEGER, ip TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
    // Ist der Absender ein Kunde? Dann hängt die Anfrage an seiner Person.
    const [kunde] = (await sqlPool`SELECT person_id, ref FROM fiaon_applications WHERE LOWER(email) = ${email} AND merged_into IS NULL ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    const [row] = (await sqlPool`
      INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, rolle, land, kunde, erfahrung, text, person_id, ip)
      VALUES (${art}, ${name}, ${email}, ${String(b.firma || "").slice(0, 200) || null}, ${String(b.telefon || "").slice(0, 60) || null},
              ${String(b.rolle || "").slice(0, 100) || null}, ${String(b.land || "").slice(0, 40) || null}, ${String(b.kunde || "").slice(0, 60) || null},
              ${String(b.erfahrung || "").slice(0, 100) || null}, ${String(b.text || "").slice(0, 4000) || null}, ${kunde?.person_id ?? null}, ${ip})
      RETURNING id`) as any[];

    const zeilen = [
      `${TITEL[art]} #${row.id} über die Website.`,
      `Name: ${name} · E-Mail: ${email}${b.telefon ? ` · Telefon: ${b.telefon}` : ""}${b.firma ? ` · ${b.firma}` : ""}`,
      b.rolle ? `Rolle: ${b.rolle}` : null, b.land ? `Land: ${b.land}` : null, b.kunde ? `Kunde: ${b.kunde}` : null, b.erfahrung ? `Erfahrung: ${b.erfahrung}` : null,
      kunde?.ref ? `Bestehender Kunde (${kunde.ref}).` : null,
      b.text ? `\n${String(b.text).slice(0, 1500)}` : null,
    ].filter(Boolean).join("\n");
    await sqlPool`
      INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
      VALUES ('aufgabe', ${kunde?.ref ?? null}, ${zeilen}, 'betreiber', TRUE, ${art === "investor" || art === "datenraum"}, 'offen', 'system', 'Website',
              ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 2))
    `.catch((e) => console.error("[ANFRAGE] Aufgabe:", e?.message));
    if (kunde?.ref) {
      await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'System', 'system', ${`${TITEL[art]} über die Website eingegangen.`})`.catch(() => {});
    }
    const meldung = art === "karriere" ? "Danke — Ihre Bewerbung ist da. Wir rufen Sie innerhalb von zwei Werktagen an."
      : art === "presse" ? "Danke — wir melden uns innerhalb eines Werktags."
      : "Danke — Ihre Anfrage ist angekommen. Wir melden uns innerhalb von zwei Werktagen.";
    res.json({ ok: true, meldung });
  } catch (err) {
    console.error("[ANFRAGE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler — bitte schreiben Sie an kontakt@fiaon.com." });
  }
});

export default router;
