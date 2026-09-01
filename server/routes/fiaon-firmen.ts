// ═══════════════════════════════════════════════════════════════════════════
// FIRMENKUNDEN — die B2B-Jagdstrecke (02.09.2026, Justins Nachtauftrag)
//
// DER AUFTRAG: Nikita ist seit heute fest an Bord (2.000 € + Provision) und
// setzt täglich ~50 Anrufe auf Unternehmen an. Jedes Unternehmen braucht
// Liquidität — Liquidität hängt an der Firmen-Bonität (Creditreform, SCHUFA
// B2B, KSV). Diese Strecke macht aus einer Firmenliste einen Selbstläufer:
// Liste rein → Tagesliste → Anruf mit Leitfaden → Ergebnis in einem Klick →
// Info-Mail/Antragslink → Wiedervorlage → Abschluss über /business-antrag.
//
// BEWUSSTE GRENZEN:
//  · ADDITIV: Firmen-Leads sind KEINE fiaon_persons und KEINE fiaon_leads —
//    eigener Topf (fiaon_firmen_leads), damit die Privat-Maschine (Tier,
//    Verteilung, Mahnwesen) garantiert unberührt bleibt. Erst mit dem
//    Business-Antrag betritt die Firma den normalen Kundenweg.
//  · EHRLICH: Der Leitfaden (Client) behauptet KEINE Exklusiv-Verträge mit
//    Auskunfteien — die sind in Verhandlung, nicht unterschrieben.
//  · Info-Mail: höchstens EINE je Firma je 7 Tage, Versand über das
//    Dienstkonto (welcome@), Antwortweg = der anrufende Mitarbeiter.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { gmailBereit, mailNeuSenden } from "../lib/fiaon-gmail";

const router = Router();

export const FIRMEN_TAGESZIEL = 50;

const ERGEBNISSE = new Set([
  "erreicht_interesse", "erreicht_termin", "erreicht_antrag",
  "erreicht_kein_interesse", "nicht_erreicht", "mailbox", "nummer_falsch",
]);

let bereit: Promise<void> | null = null;
function ensureFirmen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_firmen_leads (
          id SERIAL PRIMARY KEY,
          firma TEXT NOT NULL,
          ansprechpartner TEXT, telefon TEXT, email TEXT, website TEXT,
          ort TEXT, branche TEXT, notiz TEXT, quelle TEXT,
          status TEXT NOT NULL DEFAULT 'neu',
          zustaendig_agent_id INTEGER,
          wiedervorlage DATE,
          letzter_kontakt TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_status_idx ON fiaon_firmen_leads (status, wiedervorlage)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_firmen_log (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER NOT NULL,
          agent_id INTEGER, agent_name TEXT,
          art TEXT NOT NULL,
          ergebnis TEXT, notiz TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_log_idx ON fiaon_firmen_log (firma_id, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_firmen_log_tag_idx ON fiaon_firmen_log (agent_id, art, created_at DESC)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

const HEUTE_BERLIN = `(NOW() AT TIME ZONE 'Europe/Berlin')::date`;

// ── Die Tagesliste + Zähler ─────────────────────────────────────────────────
router.get("/agent/firmen/liste", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const me = req.agent!.id;
    const q = String(req.query.q || "").trim().slice(0, 80);
    const filter = String(req.query.filter || "arbeit");

    // Arbeit = was JETZT dran ist: fällige Wiedervorlagen zuerst, dann Neues.
    // „Kein Interesse"/ungültig/Antrag sind raus; fremd zugeteilte auch.
    const zeilen = await sqlPool.unsafe(`
      SELECT f.*,
             (SELECT COUNT(*)::int FROM fiaon_firmen_log l WHERE l.firma_id = f.id AND l.art = 'anruf') AS anrufe,
             (SELECT MAX(l.created_at) FROM fiaon_firmen_log l WHERE l.firma_id = f.id) AS letzte_bewegung
      FROM fiaon_firmen_leads f
      WHERE ($2 = '' OR f.firma ILIKE '%' || $2 || '%' OR COALESCE(f.ort,'') ILIKE '%' || $2 || '%'
             OR COALESCE(f.ansprechpartner,'') ILIKE '%' || $2 || '%'
             OR regexp_replace(COALESCE(f.telefon,''), '[^0-9]', '', 'g') LIKE '%' || regexp_replace($2, '[^0-9]', '', 'g') || '%')
        AND CASE
          WHEN $3 = 'alle' THEN TRUE
          WHEN $3 = 'meine' THEN f.zustaendig_agent_id = $1
          ELSE ( -- arbeit
            f.status IN ('neu', 'in_arbeit', 'wiedervorlage', 'termin')
            AND (f.zustaendig_agent_id IS NULL OR f.zustaendig_agent_id = $1)
            AND (f.wiedervorlage IS NULL OR f.wiedervorlage <= ${HEUTE_BERLIN})
          )
        END
      ORDER BY (f.wiedervorlage IS NOT NULL AND f.wiedervorlage <= ${HEUTE_BERLIN}) DESC,
               f.status = 'termin' DESC, f.status = 'in_arbeit' DESC,
               f.created_at ASC
      LIMIT 80
    `, [me, q, filter]);

    const [z] = (await sqlPool`
      SELECT
        (SELECT COUNT(*)::int FROM fiaon_firmen_log
          WHERE agent_id = ${me} AND art = 'anruf'
            AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS anrufe_heute,
        (SELECT COUNT(*)::int FROM fiaon_firmen_log
          WHERE agent_id = ${me} AND ergebnis IN ('erreicht_antrag', 'erreicht_termin')
            AND created_at > date_trunc('week', NOW() AT TIME ZONE 'Europe/Berlin')) AS treffer_woche,
        (SELECT COUNT(*)::int FROM fiaon_firmen_leads WHERE status = 'neu') AS vorrat_neu,
        (SELECT COUNT(*)::int FROM fiaon_firmen_leads
          WHERE wiedervorlage IS NOT NULL AND wiedervorlage <= (NOW() AT TIME ZONE 'Europe/Berlin')::date
            AND status NOT IN ('kein_interesse', 'ungueltig', 'antrag')) AS faellig
    `) as any[];

    res.json({ ok: true, firmen: zeilen, zahlen: { ...z, ziel: FIRMEN_TAGESZIEL } });
  } catch (err) {
    console.error("[FIRMEN] liste:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Import: Liste einkleben (CSV/Tab/Semikolon, kopfzeilen-tolerant) ────────
router.post("/agent/firmen/import", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const text = String(req.body?.text || "").slice(0, 400_000);
    if (!text.trim()) return res.status(400).json({ ok: false, error: "Nichts zum Einlesen." });
    const quelle = String(req.body?.quelle || "").slice(0, 120) || `Import ${req.agent!.name}`;

    let neu = 0, doppelt = 0, leer = 0;
    for (const roh of text.split(/\r?\n/)) {
      const zeile = roh.trim();
      if (!zeile) continue;
      const teile = zeile.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((t) => t.replace(/^"|"$/g, "").trim());
      const [firma, ansprechpartner, telefon, email, website, ort, branche] = teile;
      if (!firma || /^firma$/i.test(firma)) { leer += 1; continue; }
      const telNorm = (telefon || "").replace(/[^0-9+]/g, "");
      const [da] = (await sqlPool`
        SELECT id FROM fiaon_firmen_leads
        WHERE LOWER(firma) = ${firma.toLowerCase()}
          AND (regexp_replace(COALESCE(telefon, ''), '[^0-9+]', '', 'g') = ${telNorm}
               OR (COALESCE(email,'') <> '' AND LOWER(COALESCE(email,'')) = ${(email || "").toLowerCase()}))
        LIMIT 1
      `) as any[];
      if (da) { doppelt += 1; continue; }
      await sqlPool`
        INSERT INTO fiaon_firmen_leads (firma, ansprechpartner, telefon, email, website, ort, branche, quelle)
        VALUES (${firma.slice(0, 200)}, ${ansprechpartner || null}, ${telefon || null}, ${email || null},
                ${website || null}, ${ort || null}, ${branche || null}, ${quelle})
      `;
      neu += 1;
    }
    res.json({ ok: true, neu, doppelt, uebersprungen: leer });
  } catch (err) {
    console.error("[FIRMEN] import:", err);
    res.status(500).json({ ok: false, error: "Serverfehler beim Einlesen" });
  }
});

// ── Anruf-Ergebnis: EIN Klick hält alles fest ───────────────────────────────
router.post("/agent/firmen/:id/anruf", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const ergebnis = String(req.body?.ergebnis || "");
    if (!ERGEBNISSE.has(ergebnis)) return res.status(400).json({ ok: false, error: "Unbekanntes Ergebnis" });
    const notiz = String(req.body?.notiz || "").slice(0, 2000) || null;
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    // Wiedervorlage: Termin/Interesse → morgen; nicht erreicht → +2 Tage
    // (Staffel per Anrufzahl wäre die nächste Scheibe); Mailbox → +1.
    const wv = req.body?.wiedervorlage
      ? String(req.body.wiedervorlage).slice(0, 10)
      : ergebnis === "nicht_erreicht" ? "+2"
      : ergebnis === "mailbox" ? "+1"
      : ergebnis === "erreicht_interesse" ? "+1"
      : null;
    const status =
      ergebnis === "erreicht_antrag" ? "antrag"
      : ergebnis === "erreicht_termin" ? "termin"
      : ergebnis === "erreicht_kein_interesse" ? "kein_interesse"
      : ergebnis === "nummer_falsch" ? "ungueltig"
      : ergebnis === "erreicht_interesse" ? "in_arbeit"
      : firma.status === "neu" ? "in_arbeit" : firma.status;

    await sqlPool.unsafe(`
      UPDATE fiaon_firmen_leads SET
        status = $2,
        zustaendig_agent_id = COALESCE(zustaendig_agent_id, $3),
        letzter_kontakt = NOW(),
        wiedervorlage = CASE
          WHEN $4::text IS NULL THEN NULL
          WHEN $4 = '+1' THEN ${HEUTE_BERLIN} + 1
          WHEN $4 = '+2' THEN ${HEUTE_BERLIN} + 2
          ELSE $4::date END,
        notiz = CASE WHEN $5::text IS NULL THEN notiz ELSE CONCAT_WS(E'\n', NULLIF(notiz, ''), $5) END,
        updated_at = NOW()
      WHERE id = $1
    `, [id, status, req.agent!.id, wv, notiz]);
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'anruf', ${ergebnis}, ${notiz})
    `;
    res.json({ ok: true, status });
  } catch (err) {
    console.error("[FIRMEN] anruf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Die Info-Mail nach dem Gespräch — persönlich, ehrlich, mit Antragsweg ──
router.post("/agent/firmen/:id/mail", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    if (!firma.email || !/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(firma.email).trim())) {
      return res.status(400).json({ ok: false, error: "Keine gültige E-Mail-Adresse an der Firma." });
    }
    if (!gmailBereit()) return res.status(502).json({ ok: false, error: "Mail-Anbindung nicht bereit." });
    const [schon] = (await sqlPool`
      SELECT id FROM fiaon_firmen_log
      WHERE firma_id = ${id} AND art = 'mail' AND created_at > NOW() - INTERVAL '7 days' LIMIT 1
    `) as any[];
    if (schon) return res.status(409).json({ ok: false, error: "Diese Firma hat in den letzten 7 Tagen schon eine Info-Mail bekommen." });

    const anrede = firma.ansprechpartner ? `Guten Tag ${firma.ansprechpartner},` : "Guten Tag,";
    const text = `${anrede}

vielen Dank für das Gespräch eben. Wie besprochen in aller Kürze, worum es geht:

Über die Bonität Ihres Unternehmens entscheiden Einträge bei Auskunfteien wie Creditreform, SCHUFA und KSV — und dort stehen erfahrungsgemäß oft Dinge, die längst erledigt sind oder schlicht nicht stimmen. Genau das kostet Unternehmen Liquidität: schlechtere Konditionen, zähe Finanzierungen, abgelehnte Leasing- und Lieferantenkredite.

FIAON macht daraus einen geordneten Weg: Wir beschaffen mit Ihrer Vollmacht die Auskünfte, erklären jeden Eintrag in Menschensprache, und für alles Angreifbare liegen anwaltlich geprüfte Schreiben bereit — Sie geben frei, wir versenden und verfolgen die Antworten. Ziel: eine Firmen-Bonität, mit der Bankgespräche wieder Spaß machen.

Den Einstieg finden Sie hier, dauert online wenige Minuten:
https://fiaon.com/business

Wenn Sie lieber erst Fragen klären: Antworten Sie einfach auf diese E-Mail oder rufen Sie mich zurück — ich bin Ihr fester Ansprechpartner.

Freundliche Grüße
${req.agent!.name}
FIAON — Das Betriebssystem für Bonität
welcome@fiaon.com · fiaon.com/business`;

    await mailNeuSenden("welcome@fiaon.com", String(firma.email).trim(),
      `Ihre Firmen-Bonität — die Unterlagen zu unserem Gespräch (${firma.firma})`, text);
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'mail', 'Info-Mail nach Gespräch (welcome@) versendet')
    `;
    await sqlPool`UPDATE fiaon_firmen_leads SET updated_at = NOW(), zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}) WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err: any) {
    console.error("[FIRMEN] mail:", err);
    res.status(502).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
  }
});

// ── Details + Verlauf ───────────────────────────────────────────────────────
router.get("/agent/firmen/:id", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${Number(req.params.id)}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });
    const verlauf = (await sqlPool`
      SELECT art, ergebnis, notiz, agent_name, created_at
      FROM fiaon_firmen_log WHERE firma_id = ${firma.id}
      ORDER BY created_at DESC LIMIT 40
    `) as any[];
    res.json({ ok: true, firma, verlauf });
  } catch (err) {
    console.error("[FIRMEN] detail:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/agent/firmen/:id/notiz", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const text = String(req.body?.text || "").trim().slice(0, 2000);
    if (text.length < 2) return res.status(400).json({ ok: false, error: "Notiz zu kurz" });
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'notiz', ${text})
    `;
    await sqlPool`UPDATE fiaon_firmen_leads SET updated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIRMEN] notiz:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
