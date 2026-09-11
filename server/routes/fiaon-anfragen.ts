// ═══════════════════════════════════════════════════════════════════════════
// ANFRAGEN VON DER WEBSITE — Investoren, Presse, Datenraum, Partner, Karriere
// Ein Endpunkt, eine Tabelle. Investoren-, Presse-, Datenraum-, Partner- und
// Termin-Anfragen werden eine Aufgabe des Betreibers (fiaon_vermerke,
// fuer_betreiber). Bewerbungen (E-026) gehen seit dem 11.09.2026 (E-177)
// einen eigenen Weg: Sie bekommen einen Status, eine zuständige Person und
// einen Auftrag mit Mail — siehe fiaon-bewerbungen.ts. Vorher entstand für
// sie ein Vermerk ohne Zuständigen und ohne Mail; zehn Bewerbungen lagen so
// bis zu 18 Tage unangefasst.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { ensureAnfragenSpalten, bewerbungAuftrag } from "./fiaon-bewerbungen";

const router = Router();
// 02.09.2026 (E-083): „termin" = Wunsch nach einem Startgespräch von /termin —
// Zeitfenster und Anliegen kommen im Feld text mit.
const ARTEN = new Set(["investor", "presse", "datenraum", "partner", "karriere", "termin"]);
const TITEL: Record<string, string> = { investor: "Investoren-Anfrage", presse: "Presseanfrage", datenraum: "Datenraum-Zugang angefragt", partner: "Partner-Anfrage", termin: "Startgespräch gewünscht", karriere: "Bewerbung (Werde Teil des Teams)" };
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

    // Tabelle samt Status-Spalten (E-177) — eine Stelle für das Schema.
    await ensureAnfragenSpalten();
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
    // Jede Seite hat eigene Zusatzfelder (Ticketgröße, Thema, Frist, Zweck …). Die landen
    // als Zeilen im Text, damit nichts verloren geht und keine neue Spalte je Seite nötig ist.
    const BEKANNT = new Set(["art", "name", "email", "firma", "telefon", "rolle", "land", "kunde", "erfahrung", "text"]);
    const zusatz = Object.entries(b)
      .filter(([k, v]) => !BEKANNT.has(k) && typeof v === "string" && (v as string).trim())
      .map(([k, v]) => `${k.slice(0, 40)}: ${String(v).trim().slice(0, 300)}`)
      .join("\n");
    const text = [String(b.text || "").trim().slice(0, 4000), zusatz].filter(Boolean).join("\n\n");
    // Ist der Absender ein Kunde? Dann hängt die Anfrage an seiner Person.
    const [kunde] = (await sqlPool`SELECT person_id, ref FROM fiaon_applications WHERE LOWER(email) = ${email} AND merged_into IS NULL ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
    const [row] = (await sqlPool`
      INSERT INTO fiaon_anfragen (art, name, email, firma, telefon, rolle, land, kunde, erfahrung, text, person_id, ip)
      VALUES (${art}, ${name}, ${email}, ${String(b.firma || "").slice(0, 200) || null}, ${String(b.telefon || "").slice(0, 60) || null},
              ${String(b.rolle || "").slice(0, 100) || null}, ${String(b.land || "").slice(0, 40) || null}, ${String(b.kunde || "").slice(0, 60) || null},
              ${String(b.erfahrung || "").slice(0, 100) || null}, ${text || null}, ${kunde?.person_id ?? null}, ${ip})
      RETURNING id`) as any[];

    // ── BEWERBUNG: Auftrag an die zuständige Person (E-177) ────────────────
    // Kein unzugewiesener Vermerk mehr. Der Auftrag geht mit Mail an die
    // Person aus fiaon_settings.bewerbung_zustaendig_agent_id (Standard:
    // Florentine Lombardi), landet in ihrem Portal unter Aufgaben → Aufträge
    // und verlinkt auf die Bewerbungsliste.
    let zustaendigName: string | null = null;
    if (art === "karriere") {
      const erg = await bewerbungAuftrag(Number(row.id)).catch((e) => { console.error("[ANFRAGE] Bewerbungs-Auftrag:", e?.message); return null; });
      zustaendigName = erg?.agentName ?? null;
    } else {
      const zeilen = [
        `${TITEL[art]} #${row.id} über die Website.`,
        `Name: ${name} · E-Mail: ${email}${b.telefon ? ` · Telefon: ${b.telefon}` : ""}${b.firma ? ` · ${b.firma}` : ""}`,
        b.rolle ? `Rolle: ${b.rolle}` : null, b.land ? `Land: ${b.land}` : null, b.kunde ? `Kunde: ${b.kunde}` : null, b.erfahrung ? `Erfahrung: ${b.erfahrung}` : null,
        kunde?.ref ? `Bestehender Kunde (${kunde.ref}).` : null,
        text ? `\n${text.slice(0, 1500)}` : null,
      ].filter(Boolean).join("\n");
      await sqlPool`
        INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
        VALUES ('aufgabe', ${kunde?.ref ?? null}, ${zeilen}, 'betreiber', TRUE, ${art === "investor" || art === "datenraum"}, 'offen', 'system', 'Website',
                ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 2))
      `.catch((e) => console.error("[ANFRAGE] Aufgabe:", e?.message));
    }
    if (kunde?.ref) {
      await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
        VALUES (${kunde.ref}, ${kunde.person_id ?? null}, NULL, 'System', 'system', ${`${TITEL[art]} über die Website eingegangen.${zustaendigName ? ` Auftrag bei ${zustaendigName}.` : ""}`})`.catch(() => {});
    }
    // Die Aussage an den Bewerber ist dieselbe wie auf der Website: EIN
    // Versprechen, keine Frist — und es nennt die Person, bei der der
    // Auftrag wirklich liegt.
    const meldung = art === "termin" ? "Danke — wir rufen Sie im gewünschten Zeitfenster an, spätestens am nächsten Werktag."
      : art === "karriere" ? `Danke — Ihre Bewerbung ist da. ${zustaendigName || "Florentine Lombardi"} meldet sich persönlich bei Ihnen.`
      : art === "presse" ? "Danke — wir melden uns innerhalb eines Werktags."
      : "Danke — Ihre Anfrage ist angekommen. Wir melden uns innerhalb von zwei Werktagen.";
    res.json({ ok: true, meldung });
  } catch (err) {
    console.error("[ANFRAGE]", err);
    res.status(500).json({ ok: false, error: "Serverfehler — bitte schreiben Sie an kontakt@fiaon.com." });
  }
});

export default router;
