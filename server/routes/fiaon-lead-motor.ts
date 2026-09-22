// ═══════════════════════════════════════════════════════════════════════════
// DAS STEUERPULT DES LEAD-MOTORS (22.09.2026, E-210) — /chef/s/lead-motor
//
// Justin: „ich mache inzwischen Facebook und schicke dir immer meinen
// Zwischenstand." Hier sieht er, ob seine Schritte bei Meta angekommen sind
// (Prüfliste mit Klartext), richtet die Verbindung mit EINEM Knopf ein, holt
// Rückstände nach, schaltet die Begrüßungsmail und sieht jeden Lead mit
// Herkunft, Begrüßung, Klick und Antrag. Nur Stufe „inhaber" — wie Mara und
// die Telefonkartei.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Response } from "express";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { sqlPool } from "../lib/db-pool";
import { metaKonfig } from "../lib/fiaon-meta";
import {
  metaTabellen, verbindungPruefen, letztePruefliste, nachholLauf, einwilligungZuordnen, formulareLaden,
  META_NACHHOL_BIS, adressen,
} from "../lib/fiaon-meta-leads";
import { willkommenSpalten, willkommenAn, willkommenSenden, willkommenTexte, WILLKOMMEN_SCHALTER } from "../lib/fiaon-lead-willkommen";
import { kurzlinkTabelle } from "../lib/fiaon-kurzlink";
import { nameFuerAnrede } from "../../shared/fiaon-anrede";
import { EINWILLIGUNG_KAESTCHEN, WA_VORLAGEN } from "../../shared/fiaon-lead-texte";

const router = Router();
const wache = requireChef("inhaber");

/** Die Wege, auf denen ein Lead hereinkommt — mit dem Wort, das das Steuerpult zeigt. */
const WEG_TEXT: Record<string, string> = {
  meta_webhook: "Meta direkt", meta_nachhol: "Meta nachgeholt", meta_rueckstand: "Rückstand",
  make: "Make", import: "Import", test: "Test",
};
const WEG_SQL = `COALESCE(l.eingangsweg, CASE WHEN l.import_id IS NOT NULL THEN 'import' ELSE 'make' END)`;

async function bereitmachen(): Promise<void> {
  await metaTabellen();
  await willkommenSpalten();
  await kurzlinkTabelle();
  const { ensureLeadTables } = await import("./fiaon-leads");
  await ensureLeadTables();
}

router.get("/chef/lead-motor/stand", wache, async (_req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const k = metaKonfig();
    const [z] = (await sqlPool.unsafe(`
      WITH l AS (
        SELECT l.*, ${WEG_SQL} AS weg FROM fiaon_leads l WHERE l.erstellt_am > NOW() - INTERVAL '7 days'
      )
      SELECT
        COUNT(*) FILTER (WHERE erstellt_am >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute,
        COUNT(*)::int AS woche,
        COUNT(*) FILTER (WHERE willkommen_status = 'gesendet')::int AS begruesst,
        COUNT(*) FILTER (WHERE willkommen_status = 'fehler')::int AS begruessung_fehler,
        COUNT(*) FILTER (WHERE link_geoeffnet_am IS NOT NULL)::int AS link_geoeffnet,
        COUNT(*) FILTER (WHERE converted_order_id IS NOT NULL)::int AS antrag,
        COUNT(*) FILTER (WHERE whatsapp_erlaubt IS TRUE)::int AS whatsapp_ja
      FROM l
    `)) as any[];
    const jeWegZeilen = (await sqlPool.unsafe(`
      SELECT ${WEG_SQL} AS weg, COUNT(*)::int AS n FROM fiaon_leads l
       WHERE l.erstellt_am > NOW() - INTERVAL '7 days' GROUP BY 1`)) as any[];
    const jeWeg: Record<string, number> = {};
    for (const w of jeWegZeilen) jeWeg[String(w.weg)] = Number(w.n);
    const [letzter] = (await sqlPool.unsafe(`
      SELECT l.erstellt_am, ${WEG_SQL} AS weg FROM fiaon_leads l ORDER BY l.erstellt_am DESC LIMIT 1`)) as any[];
    const [webhook] = (await sqlPool`SELECT MAX(empfangen_am) AS am FROM fiaon_meta_ereignisse WHERE objekt = 'page'`) as any[];
    const [bis] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${META_NACHHOL_BIS}`) as any[];
    const [test] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'`) as any[];
    const alarme = (await sqlPool`
      SELECT id, art, text, erstellt_am, zuletzt_am, zaehler FROM fiaon_meta_alarme
       WHERE erledigt_am IS NULL ORDER BY zuletzt_am DESC`) as any[];
    const formulare = (await sqlPool`
      SELECT f.id, f.name, f.status, f.kaestchen, f.einwilligung_schluessel, f.einwilligung_von, f.geladen_am,
             (SELECT COUNT(*)::int FROM fiaon_leads x WHERE x.meta_formular_id = f.id AND x.erstellt_am > NOW() - INTERVAL '7 days') AS leads_woche
        FROM fiaon_meta_formulare f ORDER BY (UPPER(COALESCE(f.status, '')) = 'ACTIVE') DESC, f.geladen_am DESC`) as any[];
    const [kanal] = (await sqlPool`
      SELECT COALESCE(SUM((klicks_je_kanal ->> 'm')::int), 0)::int AS mail,
             COALESCE(SUM((klicks_je_kanal ->> 'w')::int), 0)::int AS whatsapp,
             COALESCE(SUM((klicks_je_kanal ->> 's')::int), 0)::int AS sms,
             COALESCE(SUM((klicks_je_kanal ->> 'a')::int), 0)::int AS mitarbeiter
        FROM fiaon_kurzlinks WHERE letzter_klick_am > NOW() - INTERVAL '7 days'`) as any[];
    res.json({
      ok: true,
      konfig: { bereit: k.bereit, fehlt: k.fehlt, appId: k.appId, zweiApps: k.zweiApps },
      adressen: adressen(),
      pruefliste: await letztePruefliste(),
      willkommen: { an: await willkommenAn(), testAdresse: String(test?.value ?? "") || null },
      zahlen: {
        heute: Number(z?.heute || 0), woche: Number(z?.woche || 0), begruesst: Number(z?.begruesst || 0),
        begruessungFehler: Number(z?.begruessung_fehler || 0), linkGeoeffnet: Number(z?.link_geoeffnet || 0),
        antrag: Number(z?.antrag || 0), whatsappJa: Number(z?.whatsapp_ja || 0), jeWeg,
        klicks: kanal ?? { mail: 0, whatsapp: 0, sms: 0, mitarbeiter: 0 },
      },
      letzterLead: letzter ? { am: letzter.erstellt_am, weg: WEG_TEXT[letzter.weg] ?? letzter.weg } : null,
      letzteMeldung: webhook?.am ?? null,
      nachholBis: bis?.value ?? null,
      alarme, formulare,
      texte: { einwilligung: EINWILLIGUNG_KAESTCHEN, vorlagen: WA_VORLAGEN },
      wegText: WEG_TEXT,
    });
  } catch (err) {
    console.error("[LEAD-MOTOR] stand:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

/** Die letzten Leads mit allem, was der Motor über sie weiß. */
router.get("/chef/lead-motor/leads", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const nur = String(req.query.weg ?? "");
    const zeilen = (await sqlPool.unsafe(`
      SELECT l.id, l.person_id, l.vorname, l.nachname, l.email, l.telefon, l.erstellt_am, l.kampagne, l.adset, l.anzeige,
             l.formular, l.plattform, l.whatsapp_erlaubt, l.willkommen_am, l.willkommen_status, l.willkommen_grund,
             l.link_geoeffnet_am, l.link_klicks, l.converted_order_id, l.strecke_stufe, l.strecke_stopp,
             ${WEG_SQL} AS weg,
             p.anrede AS person_anrede
        FROM fiaon_leads l
        LEFT JOIN fiaon_persons p ON p.id = l.person_id
       WHERE ($1 = '' OR ${WEG_SQL} = $1)
       ORDER BY l.erstellt_am DESC LIMIT 60`, [nur])) as any[];
    res.json({
      ok: true,
      leads: zeilen.map((z) => {
        const n = nameFuerAnrede({ vorname: z.vorname, nachname: z.nachname, anrede: z.person_anrede });
        return {
          id: Number(z.id), personId: z.person_id ?? null,
          name: n.voll || [z.vorname, z.nachname].filter(Boolean).join(" ") || "(ohne Namen)",
          nameUnbrauchbar: !n.voll,
          email: z.email ?? null, telefon: z.telefon ?? null, am: z.erstellt_am,
          weg: z.weg, wegText: WEG_TEXT[z.weg] ?? z.weg,
          kampagne: z.kampagne ?? null, gruppe: z.adset ?? null, anzeige: z.anzeige ?? null, formular: z.formular ?? null,
          plattform: z.plattform ?? null, whatsapp: z.whatsapp_erlaubt,
          begruessung: { am: z.willkommen_am ?? null, status: z.willkommen_status ?? null, grund: z.willkommen_grund ?? null },
          link: { am: z.link_geoeffnet_am ?? null, klicks: Number(z.link_klicks || 0) },
          antrag: z.converted_order_id ?? null,
          strecke: { stufe: Number(z.strecke_stufe || 0), stopp: z.strecke_stopp ?? null },
        };
      }),
    });
  } catch (err) {
    console.error("[LEAD-MOTOR] leads:", err);
    res.status(500).json({ ok: false, error: "Die Leads ließen sich nicht laden." });
  }
});

/** Die letzten Meldungen von Meta — was kam, was daraus wurde. */
router.get("/chef/lead-motor/meldungen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const zeilen = (await sqlPool`
      SELECT id, empfangen_am, objekt, feld, status, versuche, fehler, lead_id, verarbeitet_am
        FROM fiaon_meta_ereignisse ORDER BY empfangen_am DESC LIMIT 40`) as any[];
    res.json({ ok: true, meldungen: zeilen });
  } catch (err) {
    console.error("[LEAD-MOTOR] meldungen:", err);
    res.status(500).json({ ok: false, error: "Die Meldungen ließen sich nicht laden." });
  }
});

/** Prüfen (lesend) oder einrichten (Webhook eintragen, Seite abonnieren, Formulare laden). */
router.post("/chef/lead-motor/verbindung", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const einrichten = req.body?.einrichten === true;
    const liste = await verbindungPruefen({ einrichten });
    console.log(`[LEAD-MOTOR] Verbindung ${einrichten ? "eingerichtet" : "geprüft"} von Chef #${req.chef?.agentId ?? "?"}: ${liste.bereit ? "bereit" : "noch nicht bereit"}`);
    res.json({ ok: true, pruefliste: liste });
  } catch (err) {
    console.error("[LEAD-MOTOR] verbindung:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Prüfung ist abgebrochen." });
  }
});

/** Leads bei Meta nachholen — seit einem Datum (höchstens 90 Tage zurück). */
router.post("/chef/lead-motor/nachholen", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const roh = String(req.body?.seit ?? "");
    const seit = roh ? new Date(`${roh}T00:00:00+02:00`) : null;
    if (!seit || Number.isNaN(seit.getTime())) return res.status(400).json({ ok: false, error: "Bitte ein Datum wählen." });
    const erg = await nachholLauf({ seit, weg: "meta_rueckstand", hoechstens: 3000 });
    res.json({ ok: true, ergebnis: erg });
  } catch (err) {
    console.error("[LEAD-MOTOR] nachholen:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Das Nachholen ist abgebrochen." });
  }
});

/** Formulare neu laden (nach einem neuen Formular bei Meta). */
router.post("/chef/lead-motor/formulare", wache, async (_req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    if (!metaKonfig().bereit) return res.status(409).json({ ok: false, error: "Erst den Meta-Zugang eintragen." });
    res.json({ ok: true, ergebnis: await formulareLaden() });
  } catch (err) {
    console.error("[LEAD-MOTOR] formulare:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Formulare ließen sich nicht laden." });
  }
});

/** Welches Kästchen eines Formulars erlaubt WhatsApp? Leer = keins. */
router.post("/chef/lead-motor/einwilligung", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const id = String(req.body?.formularId ?? "");
    if (!id) return res.status(400).json({ ok: false, error: "Formular fehlt." });
    await einwilligungZuordnen(id, req.body?.schluessel ? String(req.body.schluessel) : null);
    res.json({ ok: true });
  } catch (err) {
    console.error("[LEAD-MOTOR] einwilligung:", err);
    res.status(500).json({ ok: false, error: "Das ließ sich nicht speichern." });
  }
});

/** Die Begrüßungsmail an/aus. */
router.post("/chef/lead-motor/willkommen", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const an = req.body?.an === true;
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${WILLKOMMEN_SCHALTER}, ${an ? "1" : "0"}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    console.log(`[LEAD-MOTOR] Begrüßungsmail ${an ? "AN" : "AUS"} (Chef #${req.chef?.agentId ?? "?"})`);
    res.json({ ok: true, an });
  } catch (err) {
    console.error("[LEAD-MOTOR] willkommen:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

/**
 * Die Begrüßung, wie sie ein bestimmter Lead bekäme — oder ein Beispiel. Dieselbe
 * Renderkette wie der Versand (mailRendern), damit die Vorschau nicht lügen kann.
 */
router.get("/chef/lead-motor/willkommen/vorschau", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const leadId = Number(req.query.leadId || 0);
    let l: any = null;
    if (leadId) {
      [l] = (await sqlPool`
        SELECT l.vorname, l.nachname, l.email, l.telefon, l.erstellt_am, p.anrede FROM fiaon_leads l
        LEFT JOIN fiaon_persons p ON p.id = l.person_id WHERE l.id = ${leadId}`) as any[];
    }
    const beispiel = !l;
    const quelle = l ?? { vorname: "Maria", nachname: "Muster", email: "maria@example.com", telefon: "+491701234567", erstellt_am: new Date(), anrede: null };
    const { nummerFuerFormular } = await import("./fiaon-kurzlink");
    const texte = willkommenTexte({
      vorname: quelle.vorname, nachname: quelle.nachname, anrede: quelle.anrede, email: quelle.email,
      telefonDach: !!nummerFuerFormular(quelle.telefon), erstelltAm: quelle.erstellt_am ? new Date(quelle.erstellt_am) : null,
    });
    const { mailRendern } = await import("../mail/motor");
    const mail = mailRendern("lead_willkommen", {
      ...texte, antrag_url: "https://fiaon.com/a/Beispiel23/m", abmelde_url: "https://fiaon.com/abmelden/beispiel",
    });
    if (!mail) return res.status(500).json({ ok: false, error: "Vorlage lead_willkommen fehlt im Mail-Motor." });
    res.json({ ok: true, beispiel, betreff: mail.betreff, html: mail.html, fehlend: mail.fehlend });
  } catch (err) {
    console.error("[LEAD-MOTOR] vorschau:", err);
    res.status(500).json({ ok: false, error: "Die Vorschau ließ sich nicht bauen." });
  }
});

/** Prüfversand der Begrüßung an die Testadresse des Mailwerks (mail_test_adresse). */
router.post("/chef/lead-motor/willkommen/pruefung", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    const [t] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'`) as any[];
    const an = String(t?.value ?? "").trim();
    if (!an) return res.status(409).json({ ok: false, error: "Keine Testadresse — im Mailwerk (/chef/s/mailwerk) eine eintragen." });
    let leadId = Number(req.body?.leadId || 0);
    if (!leadId) {
      const [l] = (await sqlPool`SELECT id FROM fiaon_leads WHERE email IS NOT NULL ORDER BY erstellt_am DESC LIMIT 1`) as any[];
      leadId = Number(l?.id || 0);
    }
    if (!leadId) return res.status(409).json({ ok: false, error: "Noch kein Lead für die Probe da." });
    const e = await willkommenSenden(leadId, { pruefungAn: an });
    res.json({ ok: e.status === "gesendet", ergebnis: e, ...(e.status !== "gesendet" ? { error: e.grund } : {}) });
  } catch (err) {
    console.error("[LEAD-MOTOR] pruefung:", err);
    res.status(500).json({ ok: false, error: "Der Prüfversand ist abgebrochen." });
  }
});

/** Einen Alarm als erledigt markieren (er kommt wieder, wenn die Störung bleibt). */
router.post("/chef/lead-motor/alarm/:id/erledigt", wache, async (req: ChefRequest, res: Response) => {
  try {
    await bereitmachen();
    await sqlPool`UPDATE fiaon_meta_alarme SET erledigt_am = NOW() WHERE id = ${Number(req.params.id)}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[LEAD-MOTOR] alarm:", err);
    res.status(500).json({ ok: false, error: "Das ließ sich nicht speichern." });
  }
});

export default router;
