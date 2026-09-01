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
    // Frequenzbremse (02.09.): auch B2B zählt ins Empfänger-Budget.
    const { darfAnEmpfaenger } = await import("../lib/fiaon-mail-frequenz");
    const frequenz = await darfAnEmpfaenger(String(firma.email).trim(), "firmen_info");
    if (!frequenz.ok) return res.status(429).json({ ok: false, error: `Frequenzbremse: ${frequenz.grund || "Empfänger-Budget erschöpft"}` });
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE KI-VORBEREITUNG — ein Klick, und Nikita weiß alles (02.09.2026 früh)
//
// Liest, wenn vorhanden, die WEBSITE der Firma (öffentlich, 6 s Deckel) und
// baut daraus mit dem Firmenwissen des Hauses eine Gesprächsvorbereitung:
// Kurzlage, drei Schmerzpunkte, Einstiegssatz, Fragen, Einwand-Tipp,
// Paket-Empfehlung. Ergebnis wird 7 Tage im Verlauf gecacht (art='analyse').
// EHRLICH: Ohne Website sagt die Vorbereitung, dass sie nur aus Branche/Ort
// schätzt — sie erfindet keine Fakten über die Firma.
// ═══════════════════════════════════════════════════════════════════════════

async function websiteText(roh: string | null): Promise<string | null> {
  if (!roh) return null;
  const url = /^https?:\/\//.test(roh) ? roh : `https://${roh}`;
  try {
    const abbruch = new AbortController();
    const wecker = setTimeout(() => abbruch.abort(), 6000);
    const res = await fetch(url, { signal: abbruch.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (FIAON Vorbereitung)" } });
    clearTimeout(wecker);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 300_000);
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 7000) || null;
  } catch { return null; }
}

router.post("/agent/firmen/:id/vorbereitung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    // Cache: die letzte Analyse binnen 7 Tagen genügt (erzwingen überstimmt).
    if (req.body?.erzwingen !== true) {
      const [cache] = (await sqlPool`
        SELECT notiz FROM fiaon_firmen_log
        WHERE firma_id = ${id} AND art = 'analyse' AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC LIMIT 1
      `) as any[];
      if (cache?.notiz) {
        try { return res.json({ ok: true, vorbereitung: JSON.parse(cache.notiz), quelle: "gespeichert" }); } catch { /* neu rechnen */ }
      }
    }

    const key = process.env.OPENAI_API_KEY;
    if (!key) return res.status(502).json({ ok: false, error: "KI nicht eingerichtet." });
    const seite = await websiteText(firma.website);
    const system = `Du bereitest einen FIAON-Vertriebsmitarbeiter auf einen B2B-KALTANRUF vor.
FIAON hilft Unternehmen, ihre Firmen-Bonität (Creditreform, SCHUFA B2B, KSV) einzusehen und zu reparieren: Auskünfte mit Vollmacht beschaffen, jeden Eintrag erklären, angreifbare Einträge mit anwaltlich geprüften Schreiben angehen. Ziel des Anrufs: Interesse wecken → Info-Mail/Termin/Antrag. Geschäftspakete ab 39,99 €/Monat, monatlich kündbar.
STRENG: Keine Fakten über die Firma ERFINDEN. Was du nur aus Branche/Ort ableitest, kennzeichne als Vermutung („vermutlich", „typisch für…"). NIEMALS versprechen: garantierte Löschung, Kredite, bestimmte Scores.
Antworte NUR als JSON:
{"kurzlage":"2-3 Sätze, was diese Firma macht (aus der Website; ohne Website: was Branche/Ort vermuten lassen)","schmerzpunkte":["3 wahrscheinliche Bonitäts-/Liquiditäts-Schmerzpunkte GENAU dieser Firma"],"einstieg":"EIN gesprochener Einstiegssatz für den Anruf, auf diese Firma zugeschnitten, Sie-Form","fragen":["3 kluge Fragen, die Kompetenz zeigen"],"einwand_tipp":"der wahrscheinlichste Einwand dieser Firma + die beste Antwort in einem Satz","paket":"business_starter|business_pro|business_ultra|business_enterprise mit 1 Satz Begründung"}`;
    const nutzer = `FIRMA: ${firma.firma}${firma.branche ? ` · Branche: ${firma.branche}` : ""}${firma.ort ? ` · Ort: ${firma.ort}` : ""}${firma.ansprechpartner ? ` · Ansprechpartner: ${firma.ansprechpartner}` : ""}${firma.notiz ? `\nNOTIZEN: ${String(firma.notiz).slice(0, 800)}` : ""}
${seite ? `WEBSITE-INHALT (${firma.website}):\n${seite}` : "KEINE Website erreichbar — arbeite mit Branche/Ort und sage das ehrlich."}`;
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini", temperature: 0.4, max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: nutzer }],
      }),
    });
    const j: any = await r.json().catch(() => null);
    if (!r.ok) return res.status(502).json({ ok: false, error: "KI-Vorbereitung gerade nicht möglich." });
    let v: any = null;
    try { v = JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")); } catch { v = null; }
    if (!v?.kurzlage) return res.status(502).json({ ok: false, error: "KI-Antwort unbrauchbar — nochmal versuchen." });
    v.mit_website = !!seite;
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'analyse', ${JSON.stringify(v).slice(0, 8000)})
    `;
    res.json({ ok: true, vorbereitung: v, quelle: seite ? "website" : "branche" });
  } catch (err: any) {
    console.error("[FIRMEN] vorbereitung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DER ABSCHLUSS AM TELEFON — Interesse wird SOFORT ein echter Antrag
//
// Nikita füllt die Pflichtfelder gemeinsam mit dem Unternehmer aus; der
// Antrag läuft über DENSELBEN Weg wie das öffentliche Formular (Loopback auf
// POST /api/fiaon/application — Stufe-C-Muster „Vertrag am Telefon", das im
// Haus seit den Leitfäden gilt). Zurück kommen Zahlungsreferenz und
// Zahlungslink — den schickt/nennt er dem Kunden noch im Gespräch.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/agent/firmen/:id/abschluss", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    await ensureFirmen();
    const id = Number(req.params.id);
    const [firma] = (await sqlPool`SELECT * FROM fiaon_firmen_leads WHERE id = ${id}`) as any[];
    if (!firma) return res.status(404).json({ ok: false, error: "Firma nicht gefunden" });

    const b = req.body || {};
    const paket = String(b.paket || "");
    const erlaubt = ["business_starter", "business_pro", "business_ultra", "business_enterprise"];
    if (!erlaubt.includes(paket)) return res.status(400).json({ ok: false, error: "Bitte ein Geschäftspaket wählen." });
    const email = String(b.email || firma.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "Gültige E-Mail-Adresse nötig — dorthin gehen Zugang und Zahlungsdaten." });
    const vorname = String(b.vorname || "").trim();
    const nachname = String(b.nachname || "").trim();
    if (!vorname || !nachname) return res.status(400).json({ ok: false, error: "Vor- und Nachname des Ansprechpartners nötig." });

    const { PAKETE } = await import("@shared/fiaon-pakete");
    const paketDef = PAKETE.find((x: any) => x.key === paket);
    const ref = `FIAON-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const port = process.env.PORT || 5000;
    const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref, type: "business", status: "submitted", currentStep: 6,
        packKey: paket, packName: paketDef?.label || paket,
        companyName: firma.firma, legalForm: String(b.rechtsform || "").trim() || null,
        contactFirstName: vorname, contactLastName: nachname,
        contactEmail: email, email,
        contactPhone: String(b.telefon || firma.telefon || "").trim() || null,
        industry: firma.branche || null,
        street: String(b.strasse || "").trim() || null,
        zip: String(b.plz || "").trim() || null,
        city: String(b.ort || firma.ort || "").trim() || null,
        country: String(b.land || "DE").trim(),
        billingEmail: email, ag1: true, ag2: true, ag3: true,
      }),
    });
    if (!antwort.ok) {
      const fehler = await antwort.text().catch(() => "");
      console.error("[FIRMEN] abschluss application:", antwort.status, fehler.slice(0, 200));
      return res.status(502).json({ ok: false, error: "Antrag konnte nicht angelegt werden." });
    }

    const [app] = (await sqlPool`
      SELECT ref, payment_reference, amount_due FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    if (!app) return res.status(502).json({ ok: false, error: "Antrag angelegt, aber nicht auffindbar — bitte in der Pipeline suchen." });

    await sqlPool`
      UPDATE fiaon_firmen_leads SET status = 'antrag', zustaendig_agent_id = COALESCE(zustaendig_agent_id, ${req.agent!.id}),
             letzter_kontakt = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    await sqlPool`
      INSERT INTO fiaon_firmen_log (firma_id, agent_id, agent_name, art, ergebnis, notiz)
      VALUES (${id}, ${req.agent!.id}, ${req.agent!.name}, 'anruf', 'erreicht_antrag',
              ${`Abschluss am Telefon: ${paketDef?.label || paket} — Antrag ${app.payment_reference || app.ref} angelegt`})
    `;
    res.json({
      ok: true, ref: app.ref, zahlungsreferenz: app.payment_reference, betrag: app.amount_due,
      zahlungslink: app.payment_reference ? `https://fiaon.com/zahlung/${app.payment_reference}` : null,
    });
  } catch (err: any) {
    console.error("[FIRMEN] abschluss:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
