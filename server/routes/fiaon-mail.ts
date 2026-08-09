// ═══════════════════════════════════════════════════════════════════════════
// MAIL — Verifikation, Vorlagen, Vorschau, Sende-Menü, Mail-Zentrale
//
// Alle Wege laufen über `mailSenden` (server/lib/fiaon-mail-senden.ts). Hier
// steht ausschließlich, WER was darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  eventsFuerRolle, mailEvent, mailEvents, templateZuordnen, verifikationsText, type Rolle,
} from "../lib/fiaon-mail-events";
import { mailSenden } from "../lib/fiaon-mail-senden";
import { brevoKonfiguriert, eigeneMailSenden, OHNE_SCHLUESSEL, rahmen, vorlagen, vorlagenHtml } from "../lib/fiaon-brevo";
import { zustellungAbgleichen, zweigPruefen, ZUSTELL_TEXT } from "../lib/fiaon-zustellung";
import { brevoKlartext } from "../lib/fiaon-brevo-fehler";
import { versandErlaubt, versandErlaubtViele, versandHistorie, type VersandArt } from "../lib/fiaon-versand";
import { empfaengerSuche, filterGruppen, zielgruppeLaden, bausteineFuellen, BAUSTEINE } from "../lib/fiaon-zentrale";

const router = Router();

async function rolleVon(agentId: number): Promise<Rolle> {
  await ensureRolleSpalte();
  const [a] = (await sqlPool`SELECT rolle FROM fiaon_agents WHERE id = ${agentId} AND active`) as any[];
  const r = String(a?.rolle || "agent");
  return (["vertriebsleiter", "onboarding", "agent"].includes(r) ? r : "agent") as Rolle;
}

/** Testadresse aus den Einstellungen — eine Stelle, nicht drei. */
async function testAdresse(): Promise<string> {
  const [s] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'`) as any[];
  return String(s?.value || "").trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY UND VERIFIKATION (Admin)
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/mail/registry — alle Ereignisse mit gemessenem Stand. */
router.get("/admin/mail/registry", async (_req: Request, res: Response) => {
  try {
    const events = (await mailEvents()).map((e) => ({ ...e, verifikationsText: verifikationsText(e) }));
    res.json({
      ok: true,
      events,
      brevoKonfiguriert: brevoKonfiguriert(),
      brevoHinweis: brevoKonfiguriert() ? null : OHNE_SCHLUESSEL,
      makeKonfiguriert: !!process.env.MAKE_WEBHOOK_URL,
      testAdresse: await testAdresse(),
    });
  } catch (err) {
    console.error("[MAIL] registry:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/mail/vorlagen — die Brevo-Vorlagen zum Zuordnen. */
router.get("/admin/mail/vorlagen", async (_req: Request, res: Response) => {
  try {
    const v = await vorlagen();
    res.json({ ok: v.ok, vorlagen: v.liste, grund: v.grund ?? null });
  } catch (err) {
    console.error("[MAIL] vorlagen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** PUT /admin/mail/registry/:event/template */
router.put("/admin/mail/registry/:event/template", async (req: Request, res: Response) => {
  try {
    const id = req.body?.templateId == null ? null : Number(req.body.templateId);
    await templateZuordnen(String(req.params.event), id, req.body?.templateName ?? null);
    res.json({ ok: true });
  } catch (err) {
    console.error("[MAIL] template:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/mail/registry/:event/pruefen — Zweig prüfen. */
router.post("/admin/mail/registry/:event/pruefen", async (req: Request, res: Response) => {
  try {
    const an = String(req.body?.testAdresse || "").trim() || (await testAdresse());
    if (!an) return res.status(400).json({ ok: false, error: "Keine Testadresse hinterlegt." });
    if (req.body?.testAdresse) {
      await sqlPool`
        INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('mail_test_adresse', ${an}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `;
    }
    const erg = await zweigPruefen(String(req.params.event), an,
      { name: "Vorgesetzter", agentId: null, rolle: "admin" },
      { maxWartenMs: Number(req.body?.maxWartenMs) || undefined });
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[MAIL] pruefen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /admin/mail/vorschau/:event — Live-Vorschau der Vorlage. */
const vorschauCache = new Map<number, { html: string; betreff: string; bis: number }>();
router.get("/admin/mail/vorschau/:event", async (req: Request, res: Response) => {
  try {
    const def = await mailEvent(String(req.params.event));
    if (!def) return res.status(404).json({ ok: false, error: "Unbekanntes Ereignis." });
    if (!def.brevoTemplateId) {
      return res.json({ ok: true, html: null, grund: "Diesem Ereignis ist noch keine Brevo-Vorlage zugeordnet." });
    }
    // Eine Stunde Zwischenspeicher: Vorlagen ändern sich selten, und die
    // Vorschau wird beim Durchklicken sonst zur Dauerlast auf Brevos API.
    const jetzt = Date.now();
    let eintrag = vorschauCache.get(def.brevoTemplateId);
    if (!eintrag || eintrag.bis < jetzt) {
      const v = await vorlagenHtml(def.brevoTemplateId);
      if (!v.ok) return res.json({ ok: true, html: null, grund: v.grund });
      eintrag = { html: v.html, betreff: v.betreff, bis: jetzt + 3600_000 };
      vorschauCache.set(def.brevoTemplateId, eintrag);
    }
    // {{ params.x }} mit den Beispielwerten der Registry füllen — so sieht der
    // Vorgesetzter, was der Kunde sieht, und nicht ein Gerüst aus Platzhaltern.
    let html = eintrag.html;
    let betreff = eintrag.betreff;
    for (const p of def.parameter) {
      const muster = new RegExp(`\\{\\{\\s*params\\.${p.name}\\s*\\}\\}`, "g");
      const wert = String(p.beispiel ?? "");
      html = html.replace(muster, wert);
      betreff = betreff.replace(muster, wert);
    }
    res.json({ ok: true, html, betreff, templateId: def.brevoTemplateId, templateName: def.brevoTemplateName });
  } catch (err) {
    console.error("[MAIL] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /admin/mail/abgleich — Zustellstatus jetzt abgleichen. */
router.post("/admin/mail/abgleich", async (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, ...(await zustellungAbgleichen()) });
  } catch (err) {
    console.error("[MAIL] abgleich:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/mail/alle-pruefen — jeden Zweig der Registry durchsehen.
 *
 * GEMELDET 11.08.2026: Der Knopf war nirgends sichtbar. Es gab die Einzelprüfung
 * je Ereignis, aber keinen Weg, alle auf einmal zu befragen — also hat es
 * niemand getan, und der Zustand blieb unbekannt.
 *
 * Scheitert etwas an Brevo, kommt hier KEINE rohe API-Antwort zurück, sondern
 * der Klartext mit Anleitung (fiaon-brevo-fehler.ts).
 */
router.post("/admin/mail/alle-pruefen", async (req: Request, res: Response) => {
  try {
    const an = String(req.body?.testAdresse || "").trim() || (await testAdresse());
    if (!an) {
      return res.status(400).json({
        ok: false,
        error: "Für die Prüfung braucht es eine Testadresse — sonst weiß niemand, wohin die Probemails gehen.",
      });
    }
    // Jede Prüfung SENDET eine Probemail. Bei 29 Zweigen sind das 29 Mails an
    // die Testadresse — das muss vorher klar sein, deshalb steht die Zahl in
    // der Antwort und der Knopf fragt vorher.
    const alle = await mailEvents();
    const zweige: any[] = [];
    let sauber = 0;
    let beanstandet = 0;
    let brevoKlar: any = null;

    for (const e of alle) {
      const p = await zweigPruefen(e.type, an,
        { name: "Vorgesetzter", agentId: null, rolle: "admin" },
        // Kurz warten: 29 × 20 Sekunden wären zehn Minuten, in denen der
        // Vorgesetzter auf einen Ladebalken schaut. Wer eine Bestätigung
        // vermisst, prüft den Zweig einzeln nach.
        { maxWartenMs: 4000 },
      ).catch((err) => ({
        event: e.type, bestaetigt: false, gewartetSekunden: 0,
        text: err instanceof Error ? err.message : String(err),
      }));
      if (p.bestaetigt) sauber++; else beanstandet++;
      // Sobald Brevo einmal blockt, blockt es überall — die Anleitung genügt
      // einmal, statt neunundzwanzigmal dieselbe Zeile.
      if (!brevoKlar && /brevo/i.test(String(p.text))) {
        brevoKlar = brevoKlartext(/HTTP (\d{3})/.exec(String(p.text)) ? Number(RegExp.$1) : 401, p.text);
      }
      zweige.push({ ...p, titel: e.label, beschreibung: e.description });
    }

    const abgleich = await zustellungAbgleichen().catch((err) => ({
      ok: false, grund: err instanceof Error ? err.message : String(err),
    })) as any;
    if (!brevoKlar && abgleich?.klartext) brevoKlar = abgleich.klartext;

    res.json({
      ok: true,
      gepruefte: zweige.length, sauber, beanstandet,
      testAdresse: an, zweige, abgleich,
      // Klartext statt roher API-Antwort — überall, wo Brevo im Spiel ist.
      brevo: brevoKlar,
    });
  } catch (err) {
    console.error("[MAIL] alle-pruefen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SENDE-MENÜ AM KUNDEN (Team und Admin)
// ═══════════════════════════════════════════════════════════════════════════

async function darfAnKunde(agentId: number, rolle: Rolle, personId: number): Promise<boolean> {
  if (rolle === "vertriebsleiter" || rolle === "admin") return true;
  if (rolle === "onboarding") {
    const [t] = (await sqlPool`
      SELECT 1 AS ok FROM fiaon_termine
      WHERE person_id = ${personId} AND agent_id = ${agentId} AND quelle = 'onboarding_call' LIMIT 1
    `) as any[];
    return !!t;
  }
  const [p] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_persons
    WHERE id = ${personId} AND assigned_agent_id = ${agentId} AND merged_into_person_id IS NULL
  `) as any[];
  return !!p;
}

/** GET /agent/mail/:personId — das Sende-Menü: Ereignisse, Ampel, Historie. */
router.get("/agent/mail/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    // Registry und Historie hängen nicht voneinander ab — also nebeneinander.
    // Jede Runde zur Datenbank kostet rund eine Viertelsekunde (Oregon).
    const [alleEvents, historie] = await Promise.all([
      eventsFuerRolle(rolle),
      versandHistorie(personId),
    ]);
    const events = alleEvents.filter((x) => x.zielgruppe === "kunde");
    // PARALLEL, nicht nacheinander: Vierzehn Zustandsprüfungen in Folge sind
    // vierzehn Runden zur Datenbank. Im Screenshot vom 09.08.2026 stand das
    // Menü deshalb sekundenlang auf „Wird geladen …". Nebeneinander kostet es
    // eine Runde.
    const zustaende = await versandErlaubtViele(personId, events.map((e) => e.type as VersandArt))
      .catch(() => ({} as Record<string, { erlaubt: boolean; grund: string | null; heute: number }>));
    const mitZustand = events.map((e) => {
      const p = zustaende[e.type] ?? { erlaubt: true, grund: null, heute: 0 };
      return {
        type: e.type, label: e.label, gruppe: e.gruppe, klartext: e.klartext,
        verifikation: e.verifikation, verifikationsText: verifikationsText(e),
        hatVorlage: !!e.brevoTemplateId,
        erlaubt: p.erlaubt, grund: p.grund, heute: p.heute,
      };
    });
    res.json({ ok: true, rolle, events: mitZustand, historie, zustellText: ZUSTELL_TEXT });
  } catch (err) {
    console.error("[MAIL] menue:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/mail/:personId/:event — senden. */
router.post("/agent/mail/:personId/:event", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const erg = await mailSenden({
      event: String(req.params.event), personId,
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle },
    });
    res.json({ ...erg, historie: await versandHistorie(personId) });
  } catch (err) {
    console.error("[MAIL] senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIL-ZENTRALE
// ═══════════════════════════════════════════════════════════════════════════

/** GET /mail/zentrale/suche?q= — Empfänger-Autocomplete ab dem 1. Zeichen. */
router.get("/mail/zentrale/suche", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    res.json({ ok: true, treffer: await empfaengerSuche(String(req.query.q || ""), nurEigene) });
  } catch (err) {
    console.error("[MAIL] suche:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /mail/zentrale/gruppen — Filtergruppen mit Live-Zähler. */
router.get("/mail/zentrale/gruppen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    res.json({
      ok: true,
      gruppen: await filterGruppen(nurEigene),
      bausteine: BAUSTEINE,
      rolle,
      maxEmpfaenger: rolle === "admin" || rolle === "vertriebsleiter" ? 5000 : 10,
    });
  } catch (err) {
    console.error("[MAIL] gruppen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /mail/zentrale/vorschau — Pflicht vor jedem Versand an mehr als einen.
 *
 * Liefert die Empfängerliste UND die fertig personalisierte erste Mail. Ohne
 * diesen Schritt gibt es kein Versand-Merkmal, und der Versand lehnt ab.
 */
router.post("/mail/zentrale/vorschau", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    const ziel = await zielgruppeLaden(req.body || {}, nurEigene);
    if (ziel.empfaenger.length === 0) {
      return res.json({ ok: false, error: "Kein Empfänger — die Auswahl ist leer." });
    }
    const erster = ziel.empfaenger[0];
    const betreff = bausteineFuellen(String(req.body?.betreff || ""), erster);
    const text = bausteineFuellen(String(req.body?.text || ""), erster);
    const merkmal = `${req.agent!.id}-${Date.now().toString(36)}`;
    vorschauMerker.set(merkmal, { anzahl: ziel.empfaenger.length, bis: Date.now() + 20 * 60_000 });
    res.json({
      ok: true, merkmal,
      anzahl: ziel.empfaenger.length,
      empfaenger: ziel.empfaenger.slice(0, 25).map((e) => ({ name: e.name, email: e.email, extern: e.extern })),
      ausgeschlossen: ziel.ausgeschlossen,
      betreff, html: rahmen(betreff, text),
    });
  } catch (err) {
    console.error("[MAIL] zentrale vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN-SPIEGEL DER MAIL-ZENTRALE
//
// DER BUG (gemeldet 11.08.2026): Der Menüpunkt „Mail-Zentrale" im Admin-Bereich
// zeigte auf /agent/mail-zentrale. Der Vorgesetzte hat keinen Agent-Zugang — er
// landete auf einer Anmeldeaufforderung für ein Konto, das er nicht besitzt.
//
// Diese Routen sind KEINE zweite Mail-Zentrale. Sie rufen exakt dieselben
// Funktionen (`empfaengerSuche`, `filterGruppen`, `zielgruppeLaden`,
// `bausteineFuellen`) mit fest gesetzter Rolle 'admin'. Eine eigene Fassung
// wäre die sichere Quelle für zwei unterschiedliche Sendeverhalten.
//
// Sie liegen hinter dem Admin-Code-Gate wie alle /admin/-Routen.
// ═══════════════════════════════════════════════════════════════════════════

/** Der Vorgesetzte hat kein Empfängerlimit — aber eine Obergrenze gegen Unfälle. */
const ADMIN_GRENZE = 5000;

/** Vorschau-Merkmale. Geteilt zwischen Team- und Admin-Weg. */
const vorschauMerker = new Map<string, { anzahl: number; bis: number }>();

router.get("/admin/mail/zentrale/suche", async (req: Request, res: Response) => {
  try {
    res.json({ ok: true, treffer: await empfaengerSuche(String(req.query.q || ""), null) });
  } catch (err) {
    console.error("[MAIL] admin suche:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/mail/zentrale/gruppen", async (_req: Request, res: Response) => {
  try {
    res.json({
      ok: true,
      gruppen: await filterGruppen(null),
      bausteine: BAUSTEINE,
      rolle: "admin",
      maxEmpfaenger: ADMIN_GRENZE,
      absender: "Vorgesetzter",
    });
  } catch (err) {
    console.error("[MAIL] admin gruppen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/mail/zentrale/vorschau", async (req: Request, res: Response) => {
  try {
    const ziel = await zielgruppeLaden(req.body || {}, null);
    if (ziel.empfaenger.length === 0) {
      return res.json({ ok: false, error: "Kein Empfänger — die Auswahl ist leer." });
    }
    const erster = ziel.empfaenger[0];
    const betreff = bausteineFuellen(String(req.body?.betreff || ""), erster);
    const text = bausteineFuellen(String(req.body?.text || ""), erster);
    const merkmal = `admin-${Date.now().toString(36)}`;
    vorschauMerker.set(merkmal, { anzahl: ziel.empfaenger.length, bis: Date.now() + 20 * 60_000 });
    res.json({
      ok: true, merkmal,
      anzahl: ziel.empfaenger.length,
      empfaenger: ziel.empfaenger.slice(0, 25).map((e) => ({ name: e.name, email: e.email, extern: e.extern })),
      ausgeschlossen: ziel.ausgeschlossen,
      betreff, html: rahmen(betreff, text),
    });
  } catch (err) {
    console.error("[MAIL] admin vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/mail/zentrale/senden", async (req: Request, res: Response) => {
  try {
    const ziel = await zielgruppeLaden(req.body || {}, null);
    if (ziel.empfaenger.length === 0) return res.status(400).json({ ok: false, error: "Kein Empfänger." });
    if (ziel.empfaenger.length > ADMIN_GRENZE) {
      return res.status(400).json({
        ok: false,
        error: `${ziel.empfaenger.length} Empfänger sind mehr als die Obergrenze von ${ADMIN_GRENZE}. `
          + "Grenze die Auswahl ein — ein Versand an alle auf einmal ist fast immer ein Versehen.",
      });
    }
    // Die Vorschau-Pflicht gilt auch für den Vorgesetzten: Sie ist kein Rechte-
    // Thema, sondern der Schutz davor, eine kaputte Personalisierung an
    // tausend Menschen zu schicken.
    const merkmal = String(req.body?.merkmal || "");
    const merker = vorschauMerker.get(merkmal);
    if (ziel.empfaenger.length > 1 && (!merker || merker.bis < Date.now())) {
      return res.status(400).json({
        ok: false,
        error: "Für mehr als einen Empfänger ist eine Vorschau nötig. Sieh dir die erste Mail an, dann sende.",
      });
    }
    // DIESELBE Funktion wie der Team-Weg — inklusive Staffelung und Protokoll.
    const { zentraleSenden } = await import("../lib/fiaon-zentrale");
    const erg = await zentraleSenden({
      empfaenger: ziel.empfaenger,
      betreff: String(req.body?.betreff || ""),
      text: String(req.body?.text || ""),
      akteur: { name: "Vorgesetzter", agentId: null },
    });
    vorschauMerker.delete(merkmal);
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[MAIL] admin senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/mail/zentrale/test", async (req: Request, res: Response) => {
  try {
    const an = String(req.body?.email || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(an)) {
      return res.status(400).json({ ok: false, error: "Bitte eine gültige Adresse für den Test angeben." });
    }
    const r = await eigeneMailSenden({
      an, name: "Vorgesetzter",
      betreff: `[TEST] ${String(req.body?.betreff || "")}`,
      text: String(req.body?.text || ""),
    });
    res.json(r.ok ? { ok: true, meldung: `Testmail an ${an} unterwegs.` } : { ok: false, error: r.grund });
  } catch (err) {
    console.error("[MAIL] admin test:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /mail/zentrale/senden */
router.post("/mail/zentrale/senden", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const rolle = await rolleVon(req.agent!.id);
    const nurEigene = rolle === "agent" ? req.agent!.id : null;
    const grenze = rolle === "admin" || rolle === "vertriebsleiter" ? 5000 : 10;

    const ziel = await zielgruppeLaden(req.body || {}, nurEigene);
    if (ziel.empfaenger.length === 0) return res.status(400).json({ ok: false, error: "Kein Empfänger." });
    if (ziel.empfaenger.length > grenze) {
      return res.status(403).json({
        ok: false,
        error: `Deine Rolle darf an höchstens ${grenze} Empfänger senden (gewählt: ${ziel.empfaenger.length}).`,
      });
    }

    // ── PFLICHT-VORSCHAU ──────────────────────────────────────────────────
    // Ab zwei Empfängern muss jemand gesehen haben, was rausgeht. Eine
    // Rundmail mit einem Tippfehler im Namensbaustein ist nicht zurückholbar.
    if (ziel.empfaenger.length > 1) {
      const merkmal = String(req.body?.merkmal || "");
      const m = vorschauMerker.get(merkmal);
      if (!m || m.bis < Date.now()) {
        return res.status(428).json({
          ok: false, code: "vorschau_noetig",
          error: "Bitte zuerst die Vorschau ansehen — ab zwei Empfängern ist sie Pflicht.",
        });
      }
      vorschauMerker.delete(merkmal);
    }

    const { zentraleSenden } = await import("../lib/fiaon-zentrale");
    const erg = await zentraleSenden({
      empfaenger: ziel.empfaenger,
      betreff: String(req.body?.betreff || ""),
      text: String(req.body?.text || ""),
      akteur: { name: req.agent!.name, agentId: req.agent!.id },
    });
    res.json({ ok: true, ...erg });
  } catch (err) {
    console.error("[MAIL] zentrale senden:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /mail/zentrale/test — „Test an mich". */
router.post("/mail/zentrale/test", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const [a] = (await sqlPool`SELECT email, COALESCE(NULLIF(first_name,''), name) AS vorname FROM fiaon_agents WHERE id = ${req.agent!.id}`) as any[];
    if (!a?.email) return res.status(400).json({ ok: false, error: "Für dein Konto ist keine E-Mail hinterlegt." });
    const probe = {
      personId: null, name: req.agent!.name, email: String(a.email), vorname: String(a.vorname || ""),
      extern: false, zahlungsreferenz: "FIAON-BEISPIEL", betrag: "99.99", agentVorname: String(a.vorname || ""),
    };
    const betreff = bausteineFuellen(String(req.body?.betreff || ""), probe as any);
    const text = bausteineFuellen(String(req.body?.text || ""), probe as any);
    const r = await eigeneMailSenden({ an: String(a.email), name: req.agent!.name, betreff, text });
    res.json({ ok: r.ok, grund: r.grund ?? null, meldung: r.ok ? `Probe an ${a.email} raus.` : `Nicht verschickt: ${r.grund}` });
  } catch (err) {
    console.error("[MAIL] zentrale test:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /admin/mail/zentrale/ki — derselbe Assistent für den Vorgesetzten.
 *
 * ── WARUM ES DIE ÜBERHAUPT BRAUCHT ─────────────────────────────────────────
 * Die Team-Route hängt an `requireAgent`. Der Vorgesetzte hat keine
 * Agent-Sitzung — von /admin/mail-zentrale lief jeder KI-Aufruf in ein 401.
 * Genau dieselbe Lücke wie bei der Mail-Zentrale selbst; sie war nur nicht
 * aufgefallen, weil die Fehlermeldung „KI nicht verfügbar" nach einem
 * fehlenden Schlüssel klingt und nicht nach einer fehlenden Route.
 */
router.post("/admin/mail/zentrale/ki", async (req: Request, res: Response) => {
  try {
    const { kiEntwurf } = await import("../lib/fiaon-mail-ki");
    const erg = await kiEntwurf(String(req.body?.art || "entwurf"), String(req.body?.eingabe || ""));
    res.json({ ok: erg.ok, text: erg.text, betreff: erg.betreff ?? null, grund: erg.grund ?? null, entfernt: erg.entfernt ?? [] });
  } catch (err) {
    console.error("[MAIL] admin ki:", err);
    res.status(500).json({ ok: false, grund: "Serverfehler beim KI-Aufruf." });
  }
});

/** POST /mail/zentrale/ki — Entwurf, Ton glätten, kürzen. */
router.post("/mail/zentrale/ki", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const { kiEntwurf } = await import("../lib/fiaon-mail-ki");
    const erg = await kiEntwurf(String(req.body?.art || "entwurf"), String(req.body?.eingabe || ""));
    res.json({
      ok: erg.ok, text: erg.text, betreff: erg.betreff ?? null,
      grund: erg.grund ?? null, entfernt: erg.entfernt ?? [],
    });
  } catch (err) {
    console.error("[MAIL] ki:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
