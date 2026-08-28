// ═══════════════════════════════════════════════════════════════════════════
// DAS MAILWERK — sehen und steuern (28.08.2026)
//
// Justin: „Ich brauche sowas wo ich das sehen, steuern kann — so, dass es
// aber auch wirklich funktioniert."
//
// Diese Routen sind die Steuerzentrale über dem Mail-System:
//   · Jedes Ereignis mit Volumen, letztem Versand und Fehlerquote (30 Tage)
//   · Der Versandweg-Schalter (make | direkt) und die Ausnahmenliste
//   · Die Takte der Automatik (Mahnungen 2×/Tag, Lead-Strecke 2×/Tag)
//   · Prüfversand jeder Vorlage an eine Adresse deiner Wahl
//
// Verändert wird NUR über die Whitelist unten — ein Tippfehler im Schlüssel
// kann so keine fremde Einstellung überschreiben.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";
import { mailEvents } from "../lib/fiaon-mail-events";

const router = Router();

/** Nur diese Schlüssel darf das Mailwerk schreiben. */
const ERLAUBTE_SCHLUESSEL = new Set([
  "mail_versandweg",          // make | direkt
  "mail_direkt_ausnahmen",    // Kommaliste von Ereignissen, die bei Make bleiben
  "mahn_takte_pro_tag",       // 1..3 — wie oft am Tag Zahlungserinnerungen
  "max_reminders",            // Obergrenze Erinnerungen je Bestellung
  "reminder_window_start",    // Stunde (Berlin), ab der gemahnt wird
  "reminder_window_end",      // Stunde, bis zu der gemahnt wird
  "reminder_engine_enabled",  // 1 | 0 — Not-Aus Mahnungen
  "lead_followup_enabled",    // 1 | 0 — Not-Aus Lead-Strecke
  "lead_followup_times",      // z. B. "09:15,15:30" — die Tages-Slots
  "lead_followup_days",       // Stufenplan in Tagen seit Anlage
  "max_lead_followups",       // Obergrenze je Lead
  "mail_test_adresse",        // Ziel des Prüfversands
]);

/** GET /chef/mailwerk — der ganze Stand auf einen Blick. */
router.get("/chef/mailwerk", requireChef("geschaeftsfuehrung"), async (_req: Request, res: Response) => {
  try {
    const [events, statistik, einstellungen, motor, crons] = await Promise.all([
      mailEvents(),
      sqlPool`
        SELECT event,
               COUNT(*)::int AS gesamt,
               COUNT(*) FILTER (WHERE status = 'versandt')::int AS versandt,
               COUNT(*) FILTER (WHERE status <> 'versandt')::int AS probleme,
               MAX(created_at) AS letzter
        FROM fiaon_mail_log
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY event
      ` as Promise<any[]>,
      sqlPool`
        SELECT key, value FROM fiaon_settings WHERE key = ANY(${Array.from(ERLAUBTE_SCHLUESSEL)})
      ` as Promise<any[]>,
      import("../mail/motor"),
      import("../lib/fiaon-crons"),
    ]);

    const statJeEvent = new Map(statistik.map((s: any) => [s.event, s]));
    const werte: Record<string, string> = Object.fromEntries(
      einstellungen.map((e: any) => [e.key, String(e.value ?? "")]));

    const ereignisse = events
      .filter((e: any) => !e.deprecated)
      .map((e: any) => {
        const s = statJeEvent.get(e.type);
        return {
          type: e.type, label: e.label, gruppe: e.gruppe, zielgruppe: e.zielgruppe,
          klartext: e.klartext,
          hatVorlage: motor.hatVorlage(e.type),
          absender: motor.absenderFuer(e.type).name,
          volumen30: s?.gesamt ?? 0,
          versandt30: s?.versandt ?? 0,
          probleme30: s?.probleme ?? 0,
          letzter: s?.letzter ?? null,
        };
      })
      .sort((a: any, b: any) => b.volumen30 - a.volumen30);

    // Die zwei Automatik-Läufe, um die es Justin geht — mit Ampel.
    const laufNamen = ["zahlungserinnerungen", "lead-nachfass-und-verteilung", "abo-motor"];
    const laeufe = await Promise.all(laufNamen.map(async (name) => {
      const st = await crons.laufStand(name);
      return { name, ...st, ampel: crons.ampelFuer(st.stundenHer) };
    }));

    res.json({
      ok: true,
      ereignisse,
      schalter: {
        versandweg: werte.mail_versandweg === "direkt" ? "direkt" : "make",
        ausnahmen: werte.mail_direkt_ausnahmen || "",
      },
      takte: {
        mahnTakte: Number(werte.mahn_takte_pro_tag) || 2,
        mahnFensterVon: Number(werte.reminder_window_start) || 10,
        mahnFensterBis: Number(werte.reminder_window_end) || 11,
        mahnObergrenze: Number(werte.max_reminders) || 6,
        mahnAn: werte.reminder_engine_enabled !== "0",
        leadAn: werte.lead_followup_enabled !== "0",
        leadZeiten: werte.lead_followup_times || "09:15,19:10",
        leadPlan: werte.lead_followup_days || "1,2,4,5,6,7,10,14,21,30",
        leadObergrenze: Number(werte.max_lead_followups) || 60,
      },
      testAdresse: werte.mail_test_adresse || "",
      laeufe,
    });
  } catch (err) {
    console.error("[MAILWERK] Übersicht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /chef/mailwerk/einstellung — {key, value}, nur Whitelist. */
router.post("/chef/mailwerk/einstellung", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const key = String(req.body?.key || "");
    const value = String(req.body?.value ?? "");
    if (!ERLAUBTE_SCHLUESSEL.has(key)) {
      return res.status(400).json({ ok: false, error: `„${key}“ ist keine Mailwerk-Einstellung.` });
    }
    // Der Versandweg kennt genau zwei Werte — alles andere wäre ein stiller
    // Rückfall auf „make", der im Mailwerk wie „direkt" aussähe.
    if (key === "mail_versandweg" && value !== "make" && value !== "direkt") {
      return res.status(400).json({ ok: false, error: "Versandweg ist 'make' oder 'direkt'." });
    }
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `;
    const { versandwegCacheLeeren } = await import("../make-webhook");
    versandwegCacheLeeren();
    res.json({ ok: true });
  } catch (err) {
    console.error("[MAILWERK] Einstellung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * POST /chef/mailwerk/pruefversand/:event — {an?}
 * Rendert die Vorlage mit den Beispieldaten der Registry und sendet sie
 * DIREKT über Brevo an die angegebene Adresse. Steht als art='test' im
 * Protokoll und zählt gegen kein Limit.
 */
router.post("/chef/mailwerk/pruefversand/:event", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const eventType = String(req.params.event);
    const [defListe, motor] = await Promise.all([mailEvents(), import("../mail/motor")]);
    const def = defListe.find((e: any) => e.type === eventType);
    if (!def) return res.status(404).json({ ok: false, error: "Unbekanntes Ereignis." });
    if (!motor.hatVorlage(eventType)) {
      return res.status(400).json({ ok: false, error: "Für dieses Ereignis gibt es noch keine Quelltext-Vorlage." });
    }
    let an = String(req.body?.an || "").trim();
    if (!an) {
      const [s] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'`) as any[];
      an = String(s?.value || process.env.BETREIBER_MAIL || "").trim();
    }
    if (!an) return res.status(400).json({ ok: false, error: "Keine Zieladresse — trage eine Testadresse ein." });

    const payload = { ...((def as any).example ?? {}), email: an, test: true };
    const erg = await motor.mailDirektSenden(eventType, payload as Record<string, unknown>);
    const { mailProtokoll } = await import("../lib/fiaon-mail-log");
    await mailProtokoll({
      event: eventType, empfaenger: an,
      status: erg.ok ? "versandt" : "fehlgeschlagen",
      grund: erg.ok ? (erg.grund ?? null) : (erg.grund ?? "unbekannt"),
      ausgeloestVon: "Prüfversand (Mailwerk)",
      brevoMessageId: erg.messageId,
    });
    await sqlPool`
      UPDATE fiaon_mail_log SET art = 'test'
      WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${eventType})
    `.catch(() => {});
    res.json(erg.ok
      ? { ok: true, meldung: `Prüfversand an ${an} raus (Brevo ${erg.messageId ?? "ohne Id"}).${erg.grund ? ` Hinweis: ${erg.grund}` : ""}` }
      : { ok: false, error: erg.grund });
  } catch (err) {
    console.error("[MAILWERK] Prüfversand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
