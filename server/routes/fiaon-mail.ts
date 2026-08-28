// ═══════════════════════════════════════════════════════════════════════════
// MAIL — Verifikation, Vorlagen, Vorschau, Sende-Menü, Mail-Zentrale
//
// Alle Wege laufen über `mailSenden` (server/lib/fiaon-mail-senden.ts). Hier
// steht ausschließlich, WER was darf.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { darfAnKunde, rolleVon } from "../lib/fiaon-kundenzugriff";
import { requireAgent, type AgentRequest } from "./fiaon-agent";
import { ensureRolleSpalte } from "./fiaon-vertrieb";
import {
  eventsFuerRolle, mailEvent, mailEvents, templateZuordnen, verifikationsText, type Rolle,
} from "../lib/fiaon-mail-events";
import { mailSenden, mailVorschau } from "../lib/fiaon-mail-senden";
import { brevoKonfiguriert, eigeneMailSenden, OHNE_SCHLUESSEL, rahmen, vorlagen, vorlagenHtml } from "../lib/fiaon-brevo";
import { alleZweigePruefen, zustellungAbgleichen, ZUSTELL_TEXT } from "../lib/fiaon-zustellung";
import { brevoKlartext } from "../lib/fiaon-brevo-fehler";
import { versandErlaubt, versandErlaubtViele, versandHistorie, type VersandArt } from "../lib/fiaon-versand";
import { empfaengerSuche, filterGruppen, zielgruppeLaden, bausteineFuellen, BAUSTEINE } from "../lib/fiaon-zentrale";

const router = Router();

// ── DIE ROLLE KOMMT AUS fiaon-kundenzugriff.ts ───────────────────────────
// Hier stand eine eigene Fassung. Die in fiaon-mail.ts deutete „inkasso"
// stillschweigend zu „agent" um — eine Erlaubnisliste aus drei Namen, die
// niemand erweiterte. Der Inkasso-Mitarbeiter bekam beim Senden 403.

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
    // ── DIESELBE LOGIK WIE DER SAMMELLAUF ────────────────────────────────
    // Vorher rief die Einzelprüfung `zweigPruefen`, der Sammellauf eine eigene
    // Schleife. Zwei Fassungen derselben Prüfung gehen auseinander — jemand
    // korrigiert die eine (hier: das Zukunftsdatum) und vergisst die andere,
    // und beide Prüfstände bleiben grün.
    //
    // Jetzt ist die Einzelprüfung der Sammellauf mit einem Element.
    const lauf = await alleZweigePruefen(an,
      { name: "Vorgesetzter", agentId: null, rolle: "admin" },
      {
        nur: [String(req.params.event)],
        wartenMs: Number(req.body?.maxWartenMs) || undefined,
        // Bei einem einzelnen Ereignis gibt es nichts zu staffeln.
        staffelMs: 0,
      });
    const z = lauf.zweige[0];
    res.json({
      ok: true,
      event: String(req.params.event),
      zustand: z?.zustand ?? "pruefung_gestoert",
      bestaetigt: z?.zustand === "bestaetigt",
      text: z?.text ?? "Unbekanntes Ereignis.",
      gewartetSekunden: lauf.dauerSekunden,
      gesehenAm: z?.gesehenAm ?? null,
      brevoZustand: z?.brevoZustand ?? null,
      brevo: lauf.klartext ?? null,
    });
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
    // ══════════════════════════════════════════════════════════════════════
    // EIN SAMMELLAUF STATT 35 EINZELPRÜFUNGEN (21.08.2026)
    //
    // Hier stand eine Schleife: 35 × (senden → 4 s warten → bei Brevo fragen).
    // Das dauerte über zwei Minuten und machte 35 Brevo-Abrufe, die die Bremse
    // reizen (HTTP 429).
    //
    // `alleZweigePruefen` schickt alle Mails gestaffelt ab, wartet EINMAL und
    // fragt EINMAL — Brevo liefert alle Ereignisse einer Adresse in einer
    // Antwort. Und es liefert DREI Zustände statt zwei; das ist der wichtigere
    // Teil (siehe fiaon-zustellung.ts).
    // ══════════════════════════════════════════════════════════════════════
    // ── „NUR NACHSEHEN" ────────────────────────────────────────────────────
    // Ohne neue Probemails: Der Lauf von gestern gab nach 25 Sekunden auf,
    // während die Mails längst bei Brevo lagen. 35 unnötige Mails an die
    // Testadresse kosten Zustellreputation.
    const nurNachsehen = req.body?.nurNachsehen === true;
    // Beim Nachsehen wird ab dem letzten Versand gesucht, nicht ab jetzt.
    const [letzter] = nurNachsehen
      ? (await sqlPool`
          -- Der Beginn des letzten Test-Versandschubs. Die Spalte heißt art
          -- mit den Werten 'echt' und 'test' — ein erster Entwurf fragte nach
          -- ist_test und fiel still auf „vor einer Stunde“ zurück. Ein
          -- stiller Rückfall ist schlimmer als ein Fehler: Er sucht im falschen
          -- Fenster und meldet dann „Zweig fehlt".
          SELECT MIN(created_at) AS ab FROM fiaon_mail_log
          WHERE created_at > NOW() - INTERVAL '2 hours' AND art = 'test'
        `.catch(() => [{ ab: null }])) as any[]
      : [{ ab: null }];
    const suchAb = letzter?.ab
      ? new Date(new Date(String(letzter.ab)).getTime() - 300_000)
      : new Date(Date.now() - 3600_000);

    const lauf = await alleZweigePruefen(an,
      { name: "Vorgesetzter", agentId: null, rolle: "admin" },
      nurNachsehen ? { nurNachsehen: true, suchAb } : {});
    const alle = await mailEvents();
    // Schlüssel bewusst als string: `z.event` kommt aus dem Sammellauf und ist
    // dort ein string. Eine Map<MakeEventType, …> würde ihn ablehnen, obwohl es
    // dieselben Werte sind.
    const beschriftung = new Map<string, (typeof alle)[number]>(
      alle.map((e) => [String(e.type), e]));

    const abgleich = await zustellungAbgleichen().catch((err) => ({
      ok: false, grund: err instanceof Error ? err.message : String(err),
    })) as any;

    res.json({
      ok: true,
      gepruefte: lauf.zweige.length,
      // ── DIE ZÄHLUNG TRENNT JETZT DREI DINGE ────────────────────────────
      // `beanstandet` hieß vorher „alles, was nicht bestätigt ist" — und die
      // Kachel machte daraus „35 ohne Zweig", auch wenn nur unsere Abfrage
      // kaputt war. Diese falsche Anschuldigung ist der Grund für den Umbau.
      sauber: lauf.bestaetigt,
      beanstandet: lauf.zweigFehlt,
      gestoert: lauf.gestoert,
      // Veraltete zählen in keiner Summe mit — sie stehen nur als Zeile da.
      veraltet: lauf.veraltet,
      dauerSekunden: lauf.dauerSekunden,
      nurNachgesehen: nurNachsehen,
      testAdresse: an,
      zweige: lauf.zweige.map((z) => ({
        ...z,
        // Die alte Oberfläche liest `bestaetigt` — sie bleibt bedient.
        bestaetigt: z.zustand === "bestaetigt",
        titel: beschriftung.get(z.event)?.label ?? z.event,
        beschreibung: beschriftung.get(z.event)?.description ?? "",
      })),
      abgleich,
      // Klartext statt roher API-Antwort — überall, wo Brevo im Spiel ist.
      brevo: lauf.klartext ?? abgleich?.klartext ?? null,
    });
  } catch (err) {
    console.error("[MAIL] alle-pruefen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SENDE-MENÜ AM KUNDEN (Team und Admin)
// ═══════════════════════════════════════════════════════════════════════════

// ── DIE ZUGRIFFSFRAGE STEHT IN fiaon-kundenzugriff.ts ─────────────────────
// Sie wurde hier UND in der jeweils anderen Datei beantwortet — zwei Kopien
// mit derselben Lücke: Das Forderungsmanagement fiel in den letzten Zweig
// (nach `assigned_agent_id`) und durfte niemanden anrufen und niemandem
// schreiben. Zweimal repariert wäre beim nächsten Mal wieder zweimal zu
// reparieren, und eine Stelle vergisst man.

/** GET /agent/mail/:personId — das Sende-Menü: Ereignisse, Ampel, Historie. */
router.get("/agent/mail/:personId", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    // Die Rolle kommt als Text, ungefiltert. Der enge Typ `Rolle` war genau
    // das Problem: Er zwang zu einer Erlaubnisliste, und „inkasso" fiel
    // hindurch.
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    // Registry und Historie hängen nicht voneinander ab — also nebeneinander.
    // Jede Runde zur Datenbank kostet rund eine Viertelsekunde (Oregon).
    const [alleEvents, historie] = await Promise.all([
      eventsFuerRolle(rolle as any),
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

// ═══════════════════════════════════════════════════════════════════════════
// VORSCHAU VOR DEM SENDEN + GALERIE (28.08.2026)
//
// Justins Auftrag: „bevor man sie versendet soll es eine Vorschau geben damit
// der Mitarbeiter sieht was er verschickt — außerdem eine Seite, wo das Team
// sämtliche E-Mails so sieht, wie sie der Kunde sieht."
//
// Die Vorschau ruft DIESELBE Payload- und Renderkette wie der Versand
// (sendePayloadBauen + Mail-Motor). Sie kann deshalb nicht lügen.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /agent/mail/:personId/:event/vorschau — die Mail, wie sie rausginge. */
router.get("/agent/mail/:personId/:event/vorschau", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const v = await mailVorschau({ event: String(req.params.event), personId, rolle: rolle as any });
    if (!v.ok) return res.json({ ok: false, error: v.grund });
    res.json(v);
  } catch (err) {
    console.error("[MAIL] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Die Galerie-Liste: alle Kundenmails mit Beispiel-Betreff, nach Gruppe. */
async function galerieListe(): Promise<any[]> {
  const events = (await mailEvents()).filter((e) => e.zielgruppe === "kunde" && !e.deprecated);
  const { mailRendern } = await import("../mail/motor");
  return events.map((e) => {
    const mail = mailRendern(e.type, (e.example ?? {}) as Record<string, unknown>);
    return {
      type: e.type, label: e.label, gruppe: e.gruppe, klartext: e.klartext,
      betreff: mail?.betreff ?? null, hatVorlage: !!mail,
      absender: mail?.absender?.name ?? null,
    };
  });
}

/** Eine Galerie-Mail als fertiges HTML (Beispieldaten) — fuer das iframe. */
async function galerieHtml(eventType: string): Promise<string | null> {
  const def = await mailEvent(eventType);
  if (!def || def.zielgruppe !== "kunde") return null;
  const { mailRendern } = await import("../mail/motor");
  const mail = mailRendern(def.type, (def.example ?? {}) as Record<string, unknown>);
  return mail?.html ?? null;
}

/** GET /agent/mail/galerie — Liste fuer die Team-Vorschauseite. */
router.get("/agent/mail/galerie", requireAgent, async (_req: AgentRequest, res: Response) => {
  try { res.json({ ok: true, mails: await galerieListe() }); }
  catch (err) { console.error("[MAIL] galerie:", err); res.status(500).json({ ok: false }); }
});

/** GET /agent/mail/galerie/:event — das fertige HTML einer Mail (iframe-Quelle). */
router.get("/agent/mail/galerie/:event", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const html = await galerieHtml(String(req.params.event));
    if (!html) return res.status(404).send("Keine Vorlage.");
    res.type("html").send(html);
  } catch (err) { console.error("[MAIL] galerie html:", err); res.status(500).send("Serverfehler"); }
});

// Admin-Spiegel (das Chefbuero hat keinen Agent-Zugang; /admin liegt hinter dem Code-Gate).
router.get("/admin/mail/galerie", async (_req: Request, res: Response) => {
  try { res.json({ ok: true, mails: await galerieListe() }); }
  catch (err) { console.error("[MAIL] admin galerie:", err); res.status(500).json({ ok: false }); }
});
router.get("/admin/mail/galerie/:event", async (req: Request, res: Response) => {
  try {
    const html = await galerieHtml(String(req.params.event));
    if (!html) return res.status(404).send("Keine Vorlage.");
    res.type("html").send(html);
  } catch (err) { console.error("[MAIL] admin galerie html:", err); res.status(500).send("Serverfehler"); }
});
router.get("/admin/mail/:personId(\\d+)/:event/vorschau", async (req: Request, res: Response) => {
  try {
    const v = await mailVorschau({ event: String(req.params.event), personId: Number(req.params.personId), rolle: "admin" });
    if (!v.ok) return res.json({ ok: false, error: v.grund });
    res.json(v);
  } catch (err) {
    console.error("[MAIL] admin vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/mail/:personId/:event — senden. */
router.post("/agent/mail/:personId/:event", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const personId = Number(req.params.personId);
    // Die Rolle kommt als Text, ungefiltert. Der enge Typ `Rolle` war genau
    // das Problem: Er zwang zu einer Erlaubnisliste, und „inkasso" fiel
    // hindurch.
    const rolle = await rolleVon(req.agent!.id);
    if (!(await darfAnKunde(req.agent!.id, rolle, personId))) {
      return res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." });
    }
    const erg = await mailSenden({
      event: String(req.params.event), personId,
      akteur: { name: req.agent!.name, agentId: req.agent!.id, rolle: rolle as any },
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

// ═══════════════════════════════════════════════════════════════════════════
// DAS ZUSTELLPROTOKOLL — was ging raus, was nicht, und warum nicht
//
// ── WARUM ES DIESE ROUTE BRAUCHTE ──────────────────────────────────────────
// Die Dashboard-Karte „Zustellung heute" nennt die Zahl der Fehlschläge. Eine
// Zahl ohne Weg dahin zwingt zum Suchen, und dann sucht niemand.
//
// Es gab dafür KEINE Anzeige. `client/src/pages/mail-zentrale.tsx` verlinkte
// auf „/admin/mail-protokoll" — diese Seite existiert nicht und hat nie
// existiert. Ein Link ins Leere sieht wie eine Möglichkeit aus; das ist
// schlimmer als kein Link.
//
// `status = fehlgeschlagen` ist der einzige Filter, der zählt: Wer das
// Protokoll öffnet, will wissen, was NICHT angekommen ist.
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Ein Auszug der Nutzlast — ohne sensible Werte.
 *
 * ── WARUM NICHT ALLES ─────────────────────────────────────────────────────
 * Die Nutzlast enthält Bankdaten, Rechnungs-Links mit Kennung und
 * Geburtsdaten. Ein Protokoll ist zum Nachsehen da, nicht zum Ausleiten. Also
 * werden die Felder gezeigt, die eine Zuordnung erlauben — und der Rest wird
 * gezählt, nicht gezeigt.
 */
function nutzlastAuszug(rohe: unknown): Record<string, unknown> | null {
  if (rohe == null) return null;
  let o: any;
  try { o = typeof rohe === "string" ? JSON.parse(rohe) : rohe; } catch { return null; }
  if (!o || typeof o !== "object") return null;
  const HARMLOS = ["event_type", "ref", "payment_reference", "pack_name", "amount_due",
                   "currency", "termin_datum", "termin_uhrzeit", "test", "first_name"];
  const SENSIBEL = /iban|bic|konto|geburt|birth|passwort|password|token|secret|schufa|invoice_url/i;
  const raus: Record<string, unknown> = {};
  let verborgen = 0;
  for (const [k, v] of Object.entries(o)) {
    if (SENSIBEL.test(k)) { verborgen++; continue; }
    if (!HARMLOS.includes(k)) { verborgen++; continue; }
    raus[k] = typeof v === "object" ? "…" : v;
  }
  if (verborgen > 0) raus["… weitere Felder"] = `${verborgen} (nicht angezeigt)`;
  return raus;
}

router.get("/admin/mail/protokoll", async (req: Request, res: Response) => {
  try {
    const { sqlPool } = await import("../lib/db-pool");
    const status = String(req.query.status || "").trim();
    const erlaubt = ["versandt", "fehlgeschlagen", "ausstehend", "uebersprungen"];
    // ══════════════════════════════════════════════════════════════════════
    // DREI FILTER MEHR — UND SEITEN STATT EINER OBERGRENZE (24.08.2026)
    //
    // Bisher gab es nur den Status. Wer wissen wollte „was ist mit Herrn X"
    // oder „welche Terminbestätigungen sind gescheitert", musste 200 Zeilen
    // durchsehen. Bei 10.446 Mails in 30 Tagen ist das keine Suche, sondern
    // Blättern.
    //
    // Neu: Ereignis, Empfänger (Name ODER Adresse), Zeitraum in Tagen, und
    // eine Seite (50 je Seite). Alles über die Adresszeile, damit ein Fund
    // weitergegeben werden kann.
    // ══════════════════════════════════════════════════════════════════════
    const proSeite = Math.min(200, Math.max(10, Number(req.query.proSeite) || 50));
    const seite = Math.max(0, Number(req.query.seite) || 0);
    const tage = Math.min(90, Math.max(1, Number(req.query.tage) || 14));
    // Nur bekannte Ereignisnamen zulassen: Ein freier String hier wäre eine
    // Einladung, in der Tabelle zu suchen, wo nichts zu suchen ist.
    const eventFilter = String(req.query.event || "").trim().slice(0, 60);
    const suche = String(req.query.suche || "").trim().slice(0, 120);
    const statusOk = erlaubt.includes(status) ? status : null;
    // Für CSV wird die Grenze angehoben: Ein Export über eine Seite ist kein
    // Export. 5.000 ist die Grenze, an der eine Tabellenkalkulation noch
    // arbeitet.
    const alsCsv = String(req.query.format || "") === "csv";
    const grenze = alsCsv ? 5000 : proSeite;
    const versatz = alsCsv ? 0 : seite * proSeite;

    const zeilen = (await sqlPool`
      SELECT l.id, l.event, l.person_id, l.empfaenger, l.status, l.grund,
             l.created_at, l.ausgeloest_von, l.betreff, l.art,
             l.zustellung, l.zustellung_am, l.zustellung_grund,
             l.brevo_message_id, l.abgeglichen_am, l.payload,
             TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS name
      FROM fiaon_mail_log l
      LEFT JOIN fiaon_persons p ON p.id = l.person_id
      WHERE l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
        AND (${statusOk}::text IS NULL OR l.status = ${statusOk})
        AND (${eventFilter || null}::text IS NULL OR l.event = ${eventFilter || null})
        -- Die Empfänger-Suche trifft Adresse UND Namen: Der Betreiber kennt
        -- meist den Namen, das Protokoll führt die Adresse.
        AND (${suche || null}::text IS NULL
             OR l.empfaenger ILIKE ${`%${suche}%`}
             OR TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE ${`%${suche}%`})
      ORDER BY l.created_at DESC
      LIMIT ${grenze} OFFSET ${versatz}
    `) as any[];

    // Wie viele gibt es insgesamt? Ohne diese Zahl weiß niemand, ob eine
    // zweite Seite existiert.
    const [gesamt] = (await sqlPool`
      SELECT COUNT(*)::int AS n
      FROM fiaon_mail_log l
      LEFT JOIN fiaon_persons p ON p.id = l.person_id
      WHERE l.created_at > NOW() - (${tage}::int * INTERVAL '1 day')
        AND (${statusOk}::text IS NULL OR l.status = ${statusOk})
        AND (${eventFilter || null}::text IS NULL OR l.event = ${eventFilter || null})
        AND (${suche || null}::text IS NULL
             OR l.empfaenger ILIKE ${`%${suche}%`}
             OR TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE ${`%${suche}%`})
    `) as any[];

    // ── DIE AKTEN-VERWEISE IN EINER ABFRAGE ────────────────────────────
    // Als Unterabfrage JE ZEILE gerechnet brauchte die Route 3,2 Sekunden
    // (200 Zeilen × eine Suche über fiaon_applications). Eine Seite, die drei
    // Sekunden braucht, öffnet niemand zweimal — und dann sieht niemand die
    // fehlgeschlagenen Mails.
    const personIds = Array.from(new Set(
      zeilen.map((z) => z.person_id).filter((v) => v != null).map(Number),
    ));
    const refJePerson = new Map<number, string>();
    if (personIds.length > 0) {
      for (const r of (await sqlPool`
        SELECT DISTINCT ON (person_id) person_id, ref
        FROM fiaon_applications
        WHERE person_id = ANY(${personIds}::int[]) AND merged_into IS NULL
        ORDER BY person_id, created_at DESC
      `) as any[]) {
        refJePerson.set(Number(r.person_id), String(r.ref));
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // CSV — DER GEFILTERTE AUSSCHNITT, NICHT ALLES
    //
    // Ein Export, der immer alles zieht, ist unbrauchbar: Wer nach einem
    // Empfänger gefiltert hat, will DIESE Zeilen. Deshalb geht der Export durch
    // dieselben Filter wie die Anzeige — nur mit höherer Grenze.
    //
    // Semikolon als Trennzeichen: Excel in deutscher Einstellung erwartet es
    // so; ein Komma landet in einer einzigen Spalte.
    // ══════════════════════════════════════════════════════════════════════
    if (alsCsv) {
      const feld = (v: unknown) => {
        const t = v == null ? "" : String(v).replace(/[\r\n]+/g, " ");
        return /[";]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
      };
      // ── DAS DATUM MUSS EINE TABELLENKALKULATION LESEN KÖNNEN ───────────
      // Erster Entwurf schrieb `z.created_at` direkt: „Mon Aug 17 2026 18:39:09
      // GMT+0200 (Central European Summer Time)". Damit kann Excel nichts
      // anfangen — es steht als Text da, und Sortieren nach Datum geht nicht.
      //
      // AGENTS.md: Zeitzone ist Europe/Berlin. Format TT.MM.JJJJ HH:MM, das
      // erkennt eine deutsche Tabellenkalkulation als Zeitstempel.
      const zeitpunkt = (v: unknown) => {
        const t = new Date(String(v));
        if (Number.isNaN(t.getTime())) return "";
        return new Intl.DateTimeFormat("de-DE", {
          timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }).format(t).replace(",", "");
      };
      const kopf = ["zeitpunkt", "ereignis", "status", "empfaenger", "name",
                    "betreff", "art", "ausgeloest_von", "zustellung", "grund"];
      const csv = [kopf.join(";"), ...zeilen.map((z) => [
        feld(zeitpunkt(z.created_at)), feld(z.event), feld(z.status), feld(z.empfaenger),
        feld(String(z.name || "").trim()), feld(z.betreff), feld(z.art),
        feld(z.ausgeloest_von), feld(z.zustellung),
        feld(z.grund || z.zustellung_grund),
      ].join(";"))].join("\n");
      const name = `zustellprotokoll-${new Date().toISOString().slice(0, 10)}`
        + `${statusOk ? `-${statusOk}` : ""}${eventFilter ? `-${eventFilter}` : ""}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
      // BOM, damit Excel die Umlaute richtig liest.
      return res.send(`\uFEFF${csv}\n`);
    }

    const [zahlen] = (await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE status = 'versandt')::int AS versandt,
        COUNT(*) FILTER (WHERE status = 'fehlgeschlagen')::int AS fehlgeschlagen,
        COUNT(*) FILTER (WHERE status = 'uebersprungen')::int AS uebersprungen,
        COUNT(*) FILTER (WHERE status = 'ausstehend')::int AS ausstehend
      FROM fiaon_mail_log
      WHERE created_at > NOW() - (${tage}::int * INTERVAL '1 day')
    `) as any[];

    res.json({
      ok: true,
      status: erlaubt.includes(status) ? status : "alle",
      tage,
      anzahl: zeilen.length,
      zahlen,
      // Die häufigsten Gründe zuerst: Zwanzig Zeilen „Make nicht erreichbar"
      // sind EIN Problem, nicht zwanzig.
      gruende: Array.from(
        zeilen.filter((z) => z.status === "fehlgeschlagen")
          .reduce((m: Map<string, number>, z: any) => {
            const g = String(z.grund || "Ohne Grund");
            return m.set(g, (m.get(g) ?? 0) + 1);
          }, new Map<string, number>())
          .entries(),
      ).sort((a, b) => b[1] - a[1]).map(([grund, anzahl]) => ({ grund, anzahl })),
      zeilen: zeilen.map((z) => ({
        id: Number(z.id), event: z.event, status: z.status,
        empfaenger: z.empfaenger || null, grund: z.grund || null,
        name: String(z.name || "").trim() || null,
        personId: z.person_id != null ? Number(z.person_id) : null,
        ref: z.person_id != null ? refJePerson.get(Number(z.person_id)) ?? null : null,
        akte: z.person_id != null && refJePerson.has(Number(z.person_id))
          ? `/admin/kunde/${encodeURIComponent(refJePerson.get(Number(z.person_id))!)}` : null,
        wann: z.created_at, ausgeloestVon: z.ausgeloest_von || null,
        betreff: z.betreff || null, art: z.art || null,
        zustellung: z.zustellung || null, zustellungGrund: z.zustellung_grund || null,
        // ── DIE ZUSTELLKETTE UND DER AUSLÖSER ──────────────────────────────
        // Für die aufklappbare Zeile: Wann an Make übergeben, wann von Brevo
        // bestätigt, wann abgeglichen. Und ein Auszug der Nutzlast, damit man
        // sieht, WAS geschickt wurde.
        zustellungAm: z.zustellung_am || null,
        brevoMessageId: z.brevo_message_id || null,
        abgeglichenAm: z.abgeglichen_am || null,
        payloadAuszug: nutzlastAuszug(z.payload),
      })),
      // Für die Seitenschaltung und die Filterleiste.
      gesamt: Number(gesamt?.n ?? 0),
      seite, proSeite,
      filter: { status: statusOk, event: eventFilter || null, suche: suche || null, tage },
    });
  } catch (err) {
    console.error("[MAIL] protokoll:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
