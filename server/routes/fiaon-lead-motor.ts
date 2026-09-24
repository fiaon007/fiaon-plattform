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
  META_NACHHOL_BIS, adressen,
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

export default router;
