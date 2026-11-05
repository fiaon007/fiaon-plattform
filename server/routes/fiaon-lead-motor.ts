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
  metaTabellen, verbindungPruefen, letztePruefliste, nachholLauf, formulareLaden,
  META_NACHHOL_BIS, adressen, webhookBeweis,
} from "../lib/fiaon-meta-leads";
import { willkommenSpalten, willkommenAn, willkommenSenden, willkommenTexte, WILLKOMMEN_SCHALTER } from "../lib/fiaon-lead-willkommen";
import { kurzlinkTabelle } from "../lib/fiaon-kurzlink";
import { nameFuerAnrede } from "../../shared/fiaon-anrede";
import { EINWILLIGUNG_HINWEIS, WA_VORLAGEN } from "../../shared/fiaon-lead-texte";
import { whatsappUrteil, WHATSAPP_MOEGLICH_SQL } from "../../shared/fiaon-whatsapp-erlaubnis";
import {
  capiZahlen, capiLauf, probeSenden, letzteEreignisse, datensatzSetzen, messungSchalten, META_EREIGNIS, CRM_EREIGNIS,
} from "../lib/fiaon-meta-capi";
import { kostenBericht, kostenAbruf, datumOderNull } from "../lib/fiaon-meta-kosten";
import { berlinToday, berlinPlusTage } from "../lib/fiaon-time";

const router = Router();
const wache = requireChef("inhaber");
/** Wer hat gehandelt — für die Spur. */
const wer = (req: ChefRequest) => (req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Inhaber");

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
        COUNT(*) FILTER (WHERE ${WHATSAPP_MOEGLICH_SQL()})::int AS whatsapp_ja
      FROM l
    `)) as any[];
    const jeWegZeilen = (await sqlPool.unsafe(`
      SELECT ${WEG_SQL} AS weg, COUNT(*)::int AS n FROM fiaon_leads l
       WHERE l.erstellt_am > NOW() - INTERVAL '7 days' GROUP BY 1`)) as any[];
    const jeWeg: Record<string, number> = {};
    for (const w of jeWegZeilen) jeWeg[String(w.weg)] = Number(w.n);
    const [letzter] = (await sqlPool.unsafe(`
      SELECT l.erstellt_am, ${WEG_SQL} AS weg FROM fiaon_leads l ORDER BY l.erstellt_am DESC LIMIT 1`)) as any[];
    // E-244 (26.09.2026): Beweis nur mit einer abgerufenen Lead-Meldung — die Beispielmeldung „Test" aus dem
    // App-Dashboard und jedes andere page-Ereignis zählen nicht (webhookBeweis, fiaon-meta-leads.ts).
    const beweis = await webhookBeweis();
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
      letzteMeldung: beweis.letzteMeldung,
      ersteMeldung: beweis.ersteMeldung,
      nachholBis: bis?.value ?? null,
      alarme, formulare,
      messung: await capiZahlen(),
      ereignisNamen: { web: META_EREIGNIS, crm: CRM_EREIGNIS },
      texte: { einwilligung: EINWILLIGUNG_HINWEIS, vorlagen: WA_VORLAGEN },
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
          plattform: z.plattform ?? null, whatsapp: whatsappUrteil({ erlaubt: z.whatsapp_erlaubt, telefon: z.telefon }),
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE MESSUNG (Pixel + Conversions API)
// ═══════════════════════════════════════════════════════════════════════════

/** Web-Messung oder Stufenmeldung an/aus. */
router.post("/chef/lead-motor/messung/schalter", wache, async (req: ChefRequest, res: Response) => {
  try {
    const welcher = req.body?.welcher === "crm" ? "crm" : "web";
    const an = req.body?.an === true;
    await messungSchalten(welcher, an);
    console.log(`[LEAD-MOTOR] Messung ${welcher} ${an ? "AN" : "AUS"} (Chef #${req.chef?.agentId ?? "?"})`);
    res.json({ ok: true, welcher, an });
  } catch (err) {
    console.error("[LEAD-MOTOR] messung/schalter:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

/** Die Datensatz-Kennung (Pixel) von Hand eintragen. */
router.post("/chef/lead-motor/messung/datensatz", wache, async (req: ChefRequest, res: Response) => {
  try {
    const id = String(req.body?.id ?? "").replace(/[^\d]/g, "");
    if (id.length < 10) return res.status(400).json({ ok: false, error: "Die Kennung besteht nur aus Ziffern (mindestens 10)." });
    await datensatzSetzen(id);
    res.json({ ok: true, id });
  } catch (err) {
    console.error("[LEAD-MOTOR] messung/datensatz:", err);
    res.status(500).json({ ok: false, error: "Die Kennung ließ sich nicht speichern." });
  }
});

/** Offene Ereignisse sofort senden. */
router.post("/chef/lead-motor/messung/senden", wache, async (_req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ergebnis: await capiLauf(200) });
  } catch (err) {
    console.error("[LEAD-MOTOR] messung/senden:", err);
    res.status(500).json({ ok: false, error: "Das Senden ist abgebrochen." });
  }
});

/** Probe mit dem Testcode aus dem Events-Manager. */
router.post("/chef/lead-motor/messung/probe", wache, async (req: ChefRequest, res: Response) => {
  try {
    const erg = await probeSenden(String(req.body?.testCode ?? ""));
    res.status(erg.ok ? 200 : 409).json({ ok: erg.ok, angenommen: erg.angenommen ?? 0, ...(erg.ok ? {} : { error: erg.fehler }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] messung/probe:", err);
    res.status(500).json({ ok: false, error: "Die Probe ist abgebrochen." });
  }
});

/** Die letzten gemeldeten Ereignisse. */
// ═══════════════════════════════════════════════════════════════════════════
// DIE VORLAGEN — STAND UND KNÖPFE (23.09.2026, E-215)
//
// Justin: „Ich kann keine Vorlage einreichen, weil ich keinen Knopf dafür habe."
//
// Er hat recht, und es ist ein Verstoß gegen die Hausregel „erledigt heißt
// bedienbar": Der Einreich-Weg existierte seit E-214 als Funktion, aber an
// keiner Oberfläche. Eine Route ohne Knopf ist nicht fertig.
//
// Drei Endpunkte, mehr braucht es nicht:
//   Stand      — was steht im Quelltext, was weiß Meta darüber?
//   Einreichen — alles Fehlende an Meta, Wand davor.
//   Aufräumen  — löscht bei Meta, was nicht mehr im Quelltext steht.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/vorlagen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { vorlagenStand, vorlagenLaufStand } = await import("../lib/fiaon-whatsapp");
    const stand = await vorlagenStand().catch(() => []);
    const imQuelltext = new Set(WA_VORLAGEN.map((v) => v.name));
    res.json({
      ok: true,
      vorlagen: WA_VORLAGEN.map((v) => ({
        name: v.name, zweck: v.zweck, wann: v.wann, kategorie: v.kategorie,
        text: v.text, beispiele: v.beispiele, knoepfe: v.knoepfe,
        kopf: v.kopf ?? null, fuss: v.fuss ?? null, kopfBild: v.kopfBild ?? null, varianteVon: v.varianteVon ?? null,
        status: stand.find((t) => t.name === v.name)?.status ?? "FEHLT",
      })),
      // Was bei Meta liegt und hier nicht mehr steht — das sind die Altlasten.
      altlasten: stand.filter((t) => !imQuelltext.has(t.name)).map((t) => ({ name: t.name, status: t.status })),
      lauf: vorlagenLaufStand(),
    });
  } catch (err) {
    console.error("[LEAD-MOTOR] vorlagen:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

// E-217: Beide Läufe starten im Hintergrund und antworten sofort. Vorher hing
// die Verbindung 94 Sekunden offen, und der Knopf sah aus wie kaputt.
router.post("/chef/lead-motor/vorlagen/einreichen", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { vorlagenLaufStarten } = await import("../lib/fiaon-whatsapp");
    res.json({ ok: true, lauf: vorlagenLaufStarten("einreichen") });
  } catch (err) {
    console.error("[LEAD-MOTOR] einreichen:", err);
    res.status(500).json({ ok: false, error: "Das Einreichen ließ sich nicht starten — bei Meta wurde nichts verändert." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKSTATT UND DAS PROFIL (23.09.2026, E-222/E-223)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/werkstatt", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { eigeneVorlagen, profilLesen, PROFIL_VORSCHLAG } = await import("../lib/fiaon-whatsapp-werkstatt");
    const { ketteAn } = await import("../lib/fiaon-lead-whatsapp");
    const [eigen, profil, kette] = await Promise.all([
      eigeneVorlagen(),
      profilLesen().catch(() => null),
      ketteAn(),
    ]);
    res.json({ ok: true, eigene: eigen, profil, vorschlag: PROFIL_VORSCHLAG, kette });
  } catch (err) {
    console.error("[LEAD-MOTOR] werkstatt:", err);
    res.status(500).json({ ok: false, error: "Die Werkstatt ließ sich nicht laden." });
  }
});

router.post("/chef/lead-motor/werkstatt/vorlage", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { vorlageSpeichern, vorlageLoeschen } = await import("../lib/fiaon-whatsapp-werkstatt");
    if (req.body?.loeschen === true) {
      await vorlageLoeschen(String(req.body?.name ?? ""));
      return res.json({ ok: true });
    }
    const erg = await vorlageSpeichern(req.body ?? {}, wer(req));
    res.status(erg.ok ? 200 : 400).json(erg.ok ? { ok: true, name: erg.name } : { ok: false, error: erg.grund });
  } catch (err) {
    console.error("[LEAD-MOTOR] vorlage speichern:", err);
    res.status(500).json({ ok: false, error: "Die Vorlage ließ sich nicht speichern." });
  }
});

router.post("/chef/lead-motor/werkstatt/pruefen", wache, async (req: ChefRequest, res: Response) => {
  const { vorlagePruefen } = await import("../lib/fiaon-whatsapp-werkstatt");
  res.json({ ok: true, funde: vorlagePruefen(req.body ?? {}) });
});

router.post("/chef/lead-motor/werkstatt/profil", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { profilSetzen } = await import("../lib/fiaon-whatsapp-werkstatt");
    const erg = await profilSetzen(req.body ?? {});
    res.status(erg.ok ? 200 : 400).json(erg.ok ? { ok: true } : { ok: false, error: erg.grund });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Das Profil ließ sich nicht setzen." });
  }
});

router.post("/chef/lead-motor/werkstatt/kette", wache, async (req: ChefRequest, res: Response) => {
  try {
    const an = req.body?.an === true;
    const { SCHALTER } = await import("../lib/fiaon-lead-whatsapp");
    const { sqlPool } = await import("../lib/db-pool");
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${SCHALTER}, ${an ? "an" : "aus"}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
    console.log(`[LEAD-WA] Kette ${an ? "AN" : "AUS"} (${wer(req)}).`);
    res.json({ ok: true, an });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

/** Die Kette einmal von Hand anstoßen — für die Probe. */
router.post("/chef/lead-motor/werkstatt/kette-lauf", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { whatsappKetteLaufen } = await import("../lib/fiaon-lead-whatsapp");
    res.json({ ok: true, ...(await whatsappKetteLaufen()) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Der Lauf ist abgebrochen." });
  }
});

router.post("/chef/lead-motor/vorlagen/aufraeumen", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ausfuehren = req.body?.ausfuehren === true;
    const { vorlagenAufraeumen, vorlagenLaufStarten } = await import("../lib/fiaon-whatsapp");
    // Die Probe ist schnell (ein Lesezugriff) und bleibt deshalb direkt —
    // der Mensch soll SEHEN, was verschwindet, bevor er bestätigt.
    if (!ausfuehren) return res.json({ ok: true, ...(await vorlagenAufraeumen({ probe: true })) });
    res.json({ ok: true, lauf: vorlagenLaufStarten("aufraeumen", { ausfuehren: true }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] aufräumen:", err);
    res.status(500).json({ ok: false, error: "Das Aufräumen ließ sich nicht starten — bei Meta wurde nichts verändert." });
  }
});

router.get("/chef/lead-motor/messung/ereignisse", wache, async (_req: ChefRequest, res: Response) => {
  try {
    res.json({ ok: true, ereignisse: await letzteEreignisse(40) });
  } catch (err) {
    console.error("[LEAD-MOTOR] messung/ereignisse:", err);
    res.status(500).json({ ok: false, error: "Die Ereignisse ließen sich nicht laden." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// WAS EIN ZAHLENDER KUNDE KOSTET (24.09.2026, E-239)
//
// Justin will eine Kampagne auf „Kaufen" spielen und cent-genau sehen, was ein
// echter zahlender Kunde kostet. Die Regeln der Zählung stehen in
// server/lib/fiaon-meta-kosten.ts — hier nur Zeitraum und Knopf.
// ═══════════════════════════════════════════════════════════════════════════
/** Der Bericht: ?tage=7|30|90 oder ?von=JJJJ-MM-TT&bis=JJJJ-MM-TT (Berliner Tage, Standard 30 Tage bis heute). */
router.get("/chef/lead-motor/kosten", wache, async (req: ChefRequest, res: Response) => {
  try {
    const tage = Math.max(1, Math.min(400, Math.floor(Number(req.query.tage) || 30)));
    const bis = datumOderNull(req.query.bis) ?? berlinToday();
    const von = datumOderNull(req.query.von) ?? berlinPlusTage(-(tage - 1));
    if (von > bis) return res.status(400).json({ ok: false, error: "„Von“ liegt nach „bis“." });
    const spanne = (new Date(`${bis}T12:00:00Z`).getTime() - new Date(`${von}T12:00:00Z`).getTime()) / 86_400_000;
    if (spanne > 400) return res.status(400).json({ ok: false, error: "Höchstens 400 Tage auf einmal." });
    res.json({ ok: true, bericht: await kostenBericht(von, bis), metaBereit: metaKonfig().bereit });
  } catch (err) {
    console.error("[LEAD-MOTOR] kosten:", err);
    res.status(500).json({ ok: false, error: "Der Kostenbericht ließ sich nicht laden." });
  }
});

/** Kosten jetzt bei Meta abrufen (dort nur lesend) — für die letzten `tage` Tage, höchstens 90. */
router.post("/chef/lead-motor/kosten/abrufen", wache, async (req: ChefRequest, res: Response) => {
  try {
    if (!metaKonfig().bereit) return res.status(409).json({ ok: false, error: "Erst den Meta-Zugang eintragen." });
    const tage = Math.max(1, Math.min(90, Math.floor(Number(req.body?.tage) || 30)));
    const erg = await kostenAbruf(tage);
    console.log(`[LEAD-MOTOR] Kosten abgerufen (${erg.seit} bis ${erg.bis}, ${erg.zeilen} Zeilen) von ${wer(req)}`);
    if (!erg.konten.length) return res.status(409).json({ ok: false, error: erg.hinweis ?? "Kein Werbekonto bekannt.", ergebnis: erg });
    res.json({ ok: true, ergebnis: erg });
  } catch (err) {
    console.error("[LEAD-MOTOR] kosten/abrufen:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Der Abruf ist abgebrochen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS LEAD-DOSSIER AN JUSTIN (E-476, 05.11.2026)
//
// Kein neuer Raum: Schalter, Deckel, Vorschau, Prüfversand und die Sammel-Mail stehen hier im Lead-Motor. Die Regeln
// stehen in server/lib/fiaon-lead-dossier.ts (Basis, Mail, Lauf) und fiaon-lead-hintergrund.ts (KI mit Quellen).
//   · Dossier an/aus: Wer einschaltet, setzt den Zählbeginn neu — es kommt KEINE Flut von Leads aus der Aus-Zeit.
//   · KI an/aus = Not-Aus des Hintergrund-Checks; Tagesdeckel in Dollar (Vorgabe 8 $).
//   · Vorschau rendert nur (kein Versand); der Prüfversand geht nur an Justin, nie an den Lead.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/dossier", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { leadDossierStand } = await import("../lib/fiaon-lead-dossier");
    res.json({ ok: true, ...(await leadDossierStand()) });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier:", err);
    res.status(500).json({ ok: false, error: "Der Stand des Lead-Dossiers ließ sich nicht laden." });
  }
});

router.post("/chef/lead-motor/dossier/schalter", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { dossierEinstellungSetzen } = await import("../lib/fiaon-lead-dossier");
    const { LEAD_DOSSIER_SCHLUESSEL: K } = await import("../../shared/fiaon-global-lead");
    const welcher = String(req.body?.schalter ?? "");
    const an = req.body?.an === true;
    const key = welcher === "an" ? K.an : welcher === "ki" ? K.kiAn : welcher === "sammel" ? K.sammelAn : null;
    if (!key) return res.status(400).json({ ok: false, error: "Unbekannter Schalter." });
    await dossierEinstellungSetzen(key, an ? "1" : "0");
    // Einschalten = neuer Zählbeginn: Leads aus der Aus-Zeit kommen nicht einzeln hinterher.
    if (welcher === "an" && an) await dossierEinstellungSetzen(K.ab, new Date().toISOString());
    console.log(`[LEAD-MOTOR] Lead-Dossier ${welcher} ${an ? "AN" : "AUS"} (${wer(req)})`);
    res.json({ ok: true, schalter: welcher, an });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier/schalter:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

router.post("/chef/lead-motor/dossier/deckel", wache, async (req: ChefRequest, res: Response) => {
  try {
    const usd = Number(req.body?.usd);
    if (!Number.isFinite(usd) || usd < 0 || usd > 50) return res.status(400).json({ ok: false, error: "Tagesdeckel: 0 bis 50 $." });
    const { dossierEinstellungSetzen } = await import("../lib/fiaon-lead-dossier");
    const { LEAD_DOSSIER_SCHLUESSEL: K } = await import("../../shared/fiaon-global-lead");
    await dossierEinstellungSetzen(K.kiDeckelUsd, String(Math.round(usd * 100) / 100));
    console.log(`[LEAD-MOTOR] Lead-Dossier KI-Tagesdeckel ${usd} $ (${wer(req)})`);
    res.json({ ok: true, usd });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier/deckel:", err);
    res.status(500).json({ ok: false, error: "Der Deckel ließ sich nicht speichern." });
  }
});

/** Vorschau für eine echte Anfrage-Nummer — rendert nur, sendet nie, ruft keine KI. */
router.get("/chef/lead-motor/dossier/vorschau", wache, async (req: ChefRequest, res: Response) => {
  try {
    const anfrage = Math.floor(Number(req.query.anfrage));
    if (!(anfrage > 0)) return res.status(400).json({ ok: false, error: "Bitte eine Anfrage-Nummer angeben." });
    const { leadDossierVorschau } = await import("../lib/fiaon-lead-dossier");
    const v = await leadDossierVorschau(anfrage, { netz: true, schreiben: true });
    res.json({ ok: true, betreff: v.betreff, html: v.html, text: v.text });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier/vorschau:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Vorschau ließ sich nicht bauen." });
  }
});

/**
 * Prüfversand: das Dossier einer Anfrage an Justin (Betreff „Prüfversand …“), ohne Zeile. Mit `mitKi` (Nachbesserung
 * 05.11.2026) ein echter Hintergrund-Check — unter Not-Aus, Deckel und Sperre, Kosten gebucht — damit der KI-Teil vor
 * dem ersten echten Lead abgenommen werden kann.
 */
router.post("/chef/lead-motor/dossier/pruefversand", wache, async (req: ChefRequest, res: Response) => {
  try {
    const anfrage = Math.floor(Number(req.body?.anfrage));
    if (!(anfrage > 0)) return res.status(400).json({ ok: false, error: "Bitte eine Anfrage-Nummer angeben." });
    const mitKi = req.body?.mitKi === true;
    const { leadDossierPruefversand } = await import("../lib/fiaon-lead-dossier");
    const e = await leadDossierPruefversand(anfrage, { mitKi });
    console.log(`[LEAD-MOTOR] Lead-Dossier Prüfversand${mitKi ? " mit KI" : ""} zu Anfrage #${anfrage}: ${e.ok ? `gesendet${e.kiStatus ? ` (KI ${e.kiStatus})` : ""}, Faden ${e.faden ?? "—"}` : e.grund} (${wer(req)})`);
    res.status(e.ok ? 200 : 502).json({ ok: e.ok, kiStatus: e.kiStatus ?? null, faden: e.faden ?? null, ...(e.ok ? {} : { error: e.grund ?? "Der Versand ist gescheitert." }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier/pruefversand:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Der Prüfversand ist abgebrochen." });
  }
});

/** Die Sammel-Mail für offene Alt-Leads noch einmal (auf ausdrücklichen Knopfdruck) — an Justin, nie an die Leads. */
router.post("/chef/lead-motor/dossier/sammel", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { altbestandSammelmail, zaehlbeginnSichern, leadDossierSchema } = await import("../lib/fiaon-lead-dossier");
    await leadDossierSchema();
    const ab = await zaehlbeginnSichern();
    const e = await altbestandSammelmail({ ab, erzwingen: true });
    console.log(`[LEAD-MOTOR] Lead-Dossier Sammel-Mail: ${e.gesendet ? `${e.anzahl} Leads gesendet` : e.grund} (${wer(req)})`);
    res.status(e.gesendet ? 200 : 409).json({ ok: e.gesendet, anzahl: e.anzahl, ...(e.gesendet ? {} : { error: e.grund ?? "Nichts gesendet." }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] dossier/sammel:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Sammel-Mail ist abgebrochen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — JUSTINS LEAD-MAILS (E-476 Scheibe 4, 05.11.2026, Entscheidung 2A)
//
// Kein neuer Raum: Die Karte „Lead-Mails von Justin“ steht hier neben dem Dossier. Zwei Schalter (Willkommen, Nachfass —
// Vorgabe AUS; Willkommen EIN setzt den Zählbeginn: KEINE Flut alter Leads), der Stand der letzten Leads, Vorschau (Muster
// oder echte Anfrage, sendet nie) und der Prüfversand an Justins Adresse. Regeln: server/lib/fiaon-global-lead-post.ts.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/lead-mails", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { leadPostStand } = await import("../lib/fiaon-global-lead-post");
    res.json({ ok: true, ...(await leadPostStand()) });
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-mails:", err);
    res.status(500).json({ ok: false, error: "Der Stand der Lead-Mails ließ sich nicht laden." });
  }
});

router.post("/chef/lead-motor/lead-mails/schalter", wache, async (req: ChefRequest, res: Response) => {
  try {
    const welcher = String(req.body?.schalter ?? "");
    if (welcher !== "willkommen" && welcher !== "nachfass" && welcher !== "antworten") return res.status(400).json({ ok: false, error: "Unbekannter Schalter." });
    const an = req.body?.an === true;
    const { leadPostSchalten } = await import("../lib/fiaon-global-lead-post");
    const e = await leadPostSchalten(welcher, an);
    console.log(`[LEAD-MOTOR] Lead-Mails ${welcher} ${an ? "AN" : "AUS"}${welcher === "willkommen" && an ? ` — Zählbeginn ${e.ab}` : ""} (${wer(req)})`);
    res.json({ ok: true, schalter: welcher, an, einstellungen: e });
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-mails/schalter:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — MARA BUSINESS AUF WHATSAPP (E-481, 05.11.2026, Justin „alles an … GOGO“)
//
// Kein neuer Raum: Karte „Mara Business“ neben den Lead-Mails. Zwei Schalter (Mara antwortet Business-Leads; der Takt mit
// Begrüßung, Termin, Erinnerung, „nicht erreicht“, Nachfrage — Vorgabe AN), der Stand der sechs Vorlagen bei Meta, die Wege,
// und „Mara testen“ (eine Frage → Maras Antwort mit einem erfundenen Musterlead, nichts gesendet). Regeln: fiaon-mara-business.ts.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/mara-business", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { mbStand } = await import("../lib/fiaon-mara-business");
    res.json({ ok: true, ...(await mbStand()) });
  } catch (err) {
    console.error("[LEAD-MOTOR] mara-business:", err);
    res.status(500).json({ ok: false, error: "Der Stand von Mara Business ließ sich nicht laden." });
  }
});

router.post("/chef/lead-motor/mara-business/schalter", wache, async (req: ChefRequest, res: Response) => {
  try {
    const welcher = String(req.body?.schalter ?? "");
    if (welcher !== "an" && welcher !== "takt") return res.status(400).json({ ok: false, error: "Unbekannter Schalter." });
    const an = req.body?.an === true;
    const { mbSchalten } = await import("../lib/fiaon-mara-business");
    const s = await mbSchalten(welcher, an);
    console.log(`[LEAD-MOTOR] Mara Business ${welcher} ${an ? "AN" : "AUS"} (${wer(req)})`);
    res.json({ ok: true, ...s });
  } catch (err) {
    console.error("[LEAD-MOTOR] mara-business/schalter:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

router.post("/chef/lead-motor/mara-business/test", wache, async (req: ChefRequest, res: Response) => {
  try {
    const frage = String(req.body?.frage ?? "").trim();
    if (!frage) return res.status(400).json({ ok: false, error: "Bitte eine Frage eingeben." });
    const { mbTrockenlauf } = await import("../lib/fiaon-mara-business");
    res.json({ ok: true, ...(await mbTrockenlauf(frage)) });
  } catch (err) {
    console.error("[LEAD-MOTOR] mara-business/test:", err);
    res.status(500).json({ ok: false, error: err instanceof Error && /pausiert|kasse/i.test(err.message) ? "Die KI ist gerade pausiert." : "Der Test ist abgebrochen." });
  }
});

/** E-476 Nachbesserung (Gutachten Betreiber, Mangel 9 d): die Ruhe nach dem Eingang (5–120 Min.) und der Tagesdeckel (1–200). */
router.post("/chef/lead-motor/lead-mails/zahl", wache, async (req: ChefRequest, res: Response) => {
  try {
    const welche = String(req.body?.welche ?? "");
    if (welche !== "ruhe" && welche !== "max_tag") return res.status(400).json({ ok: false, error: "Unbekannte Zahl." });
    const { leadPostZahlSetzen } = await import("../lib/fiaon-global-lead-post");
    const e = await leadPostZahlSetzen(welche, Number(req.body?.wert));
    console.log(`[LEAD-MOTOR] Lead-Mails ${welche} = ${welche === "ruhe" ? e.ruheMin : e.willkommenMaxTag} (${wer(req)})`);
    res.json({ ok: true, einstellungen: e });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "Die Zahl ließ sich nicht setzen." });
  }
});

/** Vorschau: art willkommen|n1|n2|n3; mit anfrage = echte Anfrage (nur lesen), sonst der Musterlead (Fassung, Sprache). */
router.get("/chef/lead-motor/lead-mails/vorschau", wache, async (req: ChefRequest, res: Response) => {
  try {
    const art = String(req.query.art ?? "willkommen");
    if (!["willkommen", "n1", "n2", "n3"].includes(art)) return res.status(400).json({ ok: false, error: "Unbekannte Mail." });
    const anfrage = Math.floor(Number(req.query.anfrage));
    const variante = String(req.query.variante ?? "meta");
    const { leadMailVorschau } = await import("../lib/fiaon-global-lead-post");
    const v = await leadMailVorschau({
      art: art as any, anfrageId: anfrage > 0 ? anfrage : null, sprache: req.query.sprache === "en" ? "en" : "de",
      variante: (["meta", "website", "bestandskunde", "oesterreich"].includes(variante) ? variante : "meta") as any,
    });
    res.json({ ok: true, ...v });
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-mails/vorschau:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Vorschau ließ sich nicht bauen." });
  }
});

/** Prüfversand: W (deutsch, englisch, Website), N1, N2, N3 mit dem Musterlead aus js@ an Justins Dossier-Adresse. */
router.post("/chef/lead-motor/lead-mails/pruefversand", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { leadMailsPruefversand } = await import("../lib/fiaon-global-lead-post");
    const { dossierEinstellungen } = await import("../lib/fiaon-lead-dossier");
    const an = (await dossierEinstellungen()).anAdresse;
    const e = await leadMailsPruefversand(an, wer(req));
    console.log(`[LEAD-MOTOR] Lead-Mails Prüfversand an ${an}: ${e.gesendet.length} gesendet${e.fehler.length ? `, Fehler: ${e.fehler.join(" | ")}` : ""} (${wer(req)})`);
    res.status(e.ok ? 200 : 502).json({ ok: e.ok, an, gesendet: e.gesendet, fehler: e.fehler, ...(e.ok ? {} : { error: e.fehler.join(" · ") || "Nichts gesendet." }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-mails/pruefversand:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Der Prüfversand ist abgebrochen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DANIELS TAKT & WÄCHTER (E-476 Scheibe 5, 05.11.2026 — Entscheidung 3A)
//
// Lead-Meldung T1 an die Adresse „Lead-Meldungen an“ (Chefbüro › Rückholung › FIAON Global), Erinnerungen 15/60/120,
// Übersicht 18:30, die Lead-Wächter. Zwei Schalter (Vorgabe AN — interne Meldungen, keine Kundenmail), die Übersicht als
// Vorschau (sendet nie) und als Prüfversand an Justin, „Wächter jetzt prüfen“ und die einmalige Ableitung des Altbestands
// (Vorschau liest; „Anwenden“ schreibt — nur mit Justins Go). Regeln: server/lib/fiaon-lead-takt.ts.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/chef/lead-motor/takt", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { leadTaktStand } = await import("../lib/fiaon-lead-takt");
    res.json({ ok: true, ...(await leadTaktStand()) });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt:", err);
    res.status(500).json({ ok: false, error: "Der Stand von Daniels Takt ließ sich nicht laden." });
  }
});

router.post("/chef/lead-motor/takt/schalter", wache, async (req: ChefRequest, res: Response) => {
  try {
    const welcher = String(req.body?.schalter ?? "");
    if (welcher !== "takt" && welcher !== "uebersicht" && welcher !== "meldung") return res.status(400).json({ ok: false, error: "Unbekannter Schalter." });
    const an = req.body?.an === true;
    const { taktSchalten } = await import("../lib/fiaon-lead-takt");
    const e = await taktSchalten(welcher, an);
    console.log(`[LEAD-MOTOR] Daniels Takt: ${welcher} ${an ? "AN" : "AUS"} (${wer(req)})`);
    res.json({ ok: true, schalter: welcher, an, einstellungen: e });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/schalter:", err);
    res.status(500).json({ ok: false, error: "Der Schalter ließ sich nicht setzen." });
  }
});

/** Die Übersicht 18:30 als Vorschau — heute oder ein Tag (?tag=JJJJ-MM-TT), an Justin oder ans Team (?fuer=team). Sendet nie. */
router.get("/chef/lead-motor/takt/uebersicht", wache, async (req: ChefRequest, res: Response) => {
  try {
    const tag = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.tag ?? "")) ? String(req.query.tag) : undefined;
    const { uebersichtVorschau } = await import("../lib/fiaon-lead-takt");
    res.json({ ok: true, ...(await uebersichtVorschau({ tag, fuer: req.query.fuer === "team" ? "team" : "justin" })) });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/uebersicht:", err);
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "Die Übersicht ließ sich nicht bauen." });
  }
});

router.post("/chef/lead-motor/takt/uebersicht-pruefversand", wache, async (req: ChefRequest, res: Response) => {
  try {
    const { uebersichtPruefversand } = await import("../lib/fiaon-lead-takt");
    const { dossierEinstellungen } = await import("../lib/fiaon-lead-dossier");
    const an = (await dossierEinstellungen()).anAdresse;
    const r = await uebersichtPruefversand(an);
    console.log(`[LEAD-MOTOR] Übersicht-Prüfversand an ${an}: ${r.ok ? "gesendet" : r.grund} (${wer(req)})`);
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, an, ...(r.ok ? { betreff: r.betreff } : { error: r.grund }) });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/uebersicht-pruefversand:", err);
    res.status(500).json({ ok: false, error: "Der Prüfversand ist abgebrochen." });
  }
});

router.post("/chef/lead-motor/takt/waechter", wache, async (_req: ChefRequest, res: Response) => {
  try {
    const { leadWaechterPruefen } = await import("../lib/fiaon-lead-takt");
    const w = await leadWaechterPruefen({ immer: true });
    res.json({ ok: true, aktiv: w.aktiv, neu: w.neu, vorbei: w.vorbei });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/waechter:", err);
    res.status(500).json({ ok: false, error: "Die Wächter ließen sich nicht prüfen." });
  }
});

const ABLEITUNG_AB_VORGABE = "2026-11-01";
/** Vorschau der Ableitung: was sich am Altbestand ändern würde (nur Lesen). */
router.get("/chef/lead-motor/takt/altbestand", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ab = /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.ab ?? "")) ? String(req.query.ab) : ABLEITUNG_AB_VORGABE;
    const { altbestandAbleiten } = await import("../lib/fiaon-lead-takt");
    res.json({ ok: true, ab, ...(await altbestandAbleiten({ ab, anwenden: false, wer: wer(req) })) });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/altbestand:", err);
    res.status(500).json({ ok: false, error: "Die Vorschau ließ sich nicht bauen." });
  }
});

/** Die Ableitung anwenden — schreibt in die Produktion, deshalb nur mit ausdrücklichem „JA“ (Justins Go). */
router.post("/chef/lead-motor/takt/altbestand", wache, async (req: ChefRequest, res: Response) => {
  try {
    if (String(req.body?.go ?? "") !== "JA") return res.status(400).json({ ok: false, error: "Nur mit Justins ausdrücklichem Go (JA)." });
    const ab = /^\d{4}-\d{2}-\d{2}$/.test(String(req.body?.ab ?? "")) ? String(req.body.ab) : ABLEITUNG_AB_VORGABE;
    const { altbestandAbleiten } = await import("../lib/fiaon-lead-takt");
    const r = await altbestandAbleiten({ ab, anwenden: true, wer: wer(req) });
    console.log(`[LEAD-MOTOR] Altbestand abgeleitet (ab ${ab}): ${r.geaendert} von ${r.geprueft} Anfragen geändert (${wer(req)})`);
    res.json({ ok: true, ab, ...r });
  } catch (err) {
    console.error("[LEAD-MOTOR] takt/altbestand anwenden:", err);
    res.status(500).json({ ok: false, error: "Die Ableitung ist abgebrochen." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// „ICH RUFE SELBST AN“ — der Knopf im Lead-Dossier (E-476 Nachbesserung, 05.11.2026)
//
// Statt „Rufst du selbst an, sag Daniel kurz Bescheid“ (eine Aufgabe an Justin) ein Knopf: Er schließt Daniels Auftrag
// und schreibt eine Zeile ins Firmen-Cockpit. Der Link ist je Dossier signiert (wie der Abmeldelink) und steht nur in
// Justins Mail. GET zeigt nur eine Frage — ein Link-Scanner im Postfach löst nichts aus; erst der Knopf (POST) handelt.
// Einmal je Dossier; ein zweiter Klick sagt „schon erledigt“.
// ═══════════════════════════════════════════════════════════════════════════
function selbstSeite(titel: string, text: string, knopf: { aktion: string; text: string } | null, link: string | null): string {
  const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(titel)} · FIAON</title>
<style>body{margin:0;background:#f6f7f9;font:16px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#16213a}
main{max-width:520px;margin:12vh auto;padding:32px;background:#fff;border:1px solid #d9dee7;border-radius:14px}h1{font-size:21px;margin:0 0 12px;font-weight:600}
p{margin:0 0 14px}button{font:inherit;background:#1d4ed8;color:#fff;border:0;border-radius:10px;padding:12px 18px;cursor:pointer}a{color:#1d4ed8}</style></head>
<body><main><h1>${esc(titel)}</h1><p>${esc(text)}</p>${knopf ? `<form method="post" action="${esc(knopf.aktion)}"><button type="submit">${esc(knopf.text)}</button></form>` : ""}${link ? `<p style="margin-top:18px"><a href="${esc(link)}">Im Firmen-Cockpit öffnen</a></p>` : ""}</main></body></html>`;
}

router.get("/lead-dossier/selbst/:token", async (req, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const { selbstPruefen } = await import("../lib/fiaon-lead-dossier");
    const id = selbstPruefen(String(req.params.token || ""));
    if (!id) return res.status(400).send(selbstSeite("Dieser Link ist ungültig", "Bitte öffne den Lead im Firmen-Cockpit.", null, null));
    return res.send(selbstSeite("Rufst du selbst an?", "Dann schließt dieser Knopf den Auftrag an das Team — es ruft niemand zusätzlich an. Im Firmen-Cockpit steht danach eine Zeile dazu.",
      { aktion: `/api/fiaon/lead-dossier/selbst/${encodeURIComponent(String(req.params.token))}`, text: "Ja, ich rufe selbst an" }, null));
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-dossier/selbst (GET):", err);
    return res.status(500).send(selbstSeite("Das hat gerade nicht geklappt", "Bitte später noch einmal.", null, null));
  }
});

router.post("/lead-dossier/selbst/:token", async (req, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    const { selbstPruefen, selbstAnrufen } = await import("../lib/fiaon-lead-dossier");
    const id = selbstPruefen(String(req.params.token || ""));
    if (!id) return res.status(400).send(selbstSeite("Dieser Link ist ungültig", "Bitte öffne den Lead im Firmen-Cockpit.", null, null));
    const e = await selbstAnrufen(id);
    return res.status(e.ok ? 200 : 404).send(selbstSeite(e.ok ? "Erledigt" : "Nicht gefunden", e.text, null, e.cockpitUrl));
  } catch (err) {
    console.error("[LEAD-MOTOR] lead-dossier/selbst (POST):", err);
    return res.status(500).send(selbstSeite("Das hat gerade nicht geklappt", "Bitte später noch einmal — oder den Auftrag im Firmen-Cockpit schließen.", null, null));
  }
});

export default router;
