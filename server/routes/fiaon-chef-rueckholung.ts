// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · RÜCKHOLUNG — das Backend des Leitstands (02.09.2026, E-074)
//
// Justins Auftrag wörtlich: „der gesamte Prozess muss ein System sein was ich
// einsehe und verstehe“. Diese Route liefert dafür EINE Antwort mit allem:
// Trichter, Zustellbarkeit, Bremsen, Schaltern, Wirkung und Läufen. Jede Zahl
// ist gezählt, keine geschätzt — die Regel stammt aus dem Lagezimmer, wo eine
// geschätzte Zahl die Seite bei der ersten Nachfrage erledigt hätte.
//
// Der Startknopf fehlt ABSICHTLICH: Der alte Massenversand
// (/admin/payments/bulk-reminder/start) lief ohne Route-Wache und ohne
// Protokoll und ist die Quelle der 18.641 Mahnungen. Die Rückholung startet
// nicht per Knopf, sondern über den Takt — und der gehorcht dem Tagesdeckel,
// der hier gesetzt wird. Wer sie anhalten will, stellt den Deckel auf 0.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { requireChef } from "./fiaon-chef-zugang";
import { rueckholSegmente, rueckholKandidaten, type Segment } from "../lib/fiaon-rueckholung";

const router = Router();

/** Nur diese Schlüssel darf der Leitstand schreiben. */
const ERLAUBTE_SCHLUESSEL = new Set([
  "rueckhol_pro_tag",        // Tagesdeckel der Rückholung; 0 = aus
  "rueckhol_s1_an", "rueckhol_s2_an", "rueckhol_s3_an", "rueckhol_s4_an", "rueckhol_s5_an",
  "frequenzbremse_an",       // 1 | 0 — die globale Empfänger-Bremse
  "frequenz_pro_tag", "frequenz_pro_woche", "frequenz_pro_monat",
  "max_reminders",           // Obergrenze Mahnungen je Bestellung (Mahnkette)
  "mahn_takte_pro_tag",      // wie oft am Tag die Mahnkette läuft
]);

const SEGMENTE: Segment[] = ["s1_frisch", "s2_behauptet", "s3_preis_fehlt", "s4_nie_gemahnt", "s5_altbestand"];

async function einstellungen(schluessel: string[]): Promise<Record<string, string | null>> {
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key = ANY(${schluessel})`) as any[];
  const map: Record<string, string | null> = Object.fromEntries(schluessel.map((k) => [k, null]));
  for (const z of zeilen) map[z.key] = z.value == null ? null : String(z.value);
  return map;
}

/** GET /chef/rueckholung — der ganze Stand in einer Antwort. */
router.get("/chef/rueckholung", requireChef("geschaeftsfuehrung"), async (_req: Request, res: Response) => {
  try {
    const [trichter, zustell, wochen, bremse24, wirkung, schalter, laufzeilen] = await Promise.all([
      rueckholSegmente(),
      // Zustellbarkeit über ALLE Mails der letzten 30 Tage — die Rückholung
      // teilt sich die Domain mit jeder anderen Mail des Hauses.
      sqlPool`
        SELECT COUNT(*)::int AS sendungen,
               COUNT(DISTINCT LOWER(TRIM(empfaenger)))::int AS empfaenger,
               COUNT(*) FILTER (WHERE zustellung = 'zugestellt')::int AS zugestellt,
               COUNT(*) FILTER (WHERE zustellung = 'geoeffnet')::int AS geoeffnet,
               COUNT(*) FILTER (WHERE zustellung = 'geklickt')::int AS geklickt,
               COUNT(*) FILTER (WHERE zustellung = 'blockiert')::int AS blockiert,
               COUNT(*) FILTER (WHERE zustellung = 'gebounct')::int AS gebounct,
               COUNT(*) FILTER (WHERE zustellung = 'spam')::int AS spam,
               (SELECT MAX(n) FROM (SELECT COUNT(*) n FROM fiaon_mail_log
                  WHERE status = 'versandt' AND art = 'echt' AND created_at > NOW() - INTERVAL '30 days'
                    AND empfaenger IS NOT NULL GROUP BY LOWER(TRIM(empfaenger))) x)::int AS maximum_je_kopf
          FROM fiaon_mail_log
         WHERE status = 'versandt' AND art = 'echt' AND created_at > NOW() - INTERVAL '30 days'`,
      // Blockquote je Woche — nur Zeilen MIT Rückmeldung, sonst lügt die Quote.
      sqlPool`
        SELECT to_char(date_trunc('week', created_at), 'DD.MM.') AS woche,
               ROUND(COUNT(*) FILTER (WHERE zustellung IN ('blockiert','gebounct')) * 100.0
                     / NULLIF(COUNT(*) FILTER (WHERE zustellung IS NOT NULL), 0), 1) AS quote
          FROM fiaon_mail_log
         WHERE created_at > NOW() - INTERVAL '5 weeks' AND art = 'echt'
         GROUP BY date_trunc('week', created_at) ORDER BY date_trunc('week', created_at)`,
      sqlPool`
        SELECT COUNT(*)::int n FROM fiaon_mail_log
         WHERE status = 'fehlgeschlagen' AND grund LIKE 'Frequenzbremse:%'
           AND created_at > NOW() - INTERVAL '24 hours'`,
      // Wirkung: Rückhol-Mail → Termin → Zahlung, je Person nach dem Versand.
      sqlPool`
        WITH post AS (
          SELECT person_id, MIN(created_at) erste
            FROM fiaon_mail_log
           WHERE event LIKE 'rueckhol_%' AND status = 'versandt' AND person_id IS NOT NULL
           GROUP BY 1
        )
        SELECT COUNT(*)::int AS angeschrieben,
               COUNT(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM fiaon_termine t WHERE t.person_id = post.person_id AND t.created_at > post.erste
               ))::int AS termine,
               COUNT(*) FILTER (WHERE EXISTS (
                 SELECT 1 FROM fiaon_applications a
                  WHERE a.person_id = post.person_id AND a.payment_status = 'paid'
                    AND a.paid_at > post.erste
               ))::int AS bezahlt,
               COALESCE(SUM((SELECT ROUND(SUM(a.amount_due) * 100) FROM fiaon_applications a
                  WHERE a.person_id = post.person_id AND a.payment_status = 'paid'
                    AND a.paid_at > post.erste)), 0)::bigint AS umsatz_cents
          FROM post`,
      einstellungen([
        "rueckhol_pro_tag", "rueckhol_s1_an", "rueckhol_s2_an", "rueckhol_s3_an", "rueckhol_s4_an", "rueckhol_s5_an",
        "frequenzbremse_an", "frequenz_pro_tag", "frequenz_pro_woche", "frequenz_pro_monat",
        "max_reminders", "mahn_takte_pro_tag",
      ]),
      // Rückhol-Versand je Segment, heute und gesamt.
      sqlPool`
        SELECT event,
               COUNT(*)::int AS gesamt,
               COUNT(*) FILTER (WHERE created_at > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute,
               COUNT(*) FILTER (WHERE zustellung = 'geklickt')::int AS geklickt
          FROM fiaon_mail_log
         WHERE event LIKE 'rueckhol_%' AND status = 'versandt' AND art = 'echt'
         GROUP BY 1`,
    ]);

    const { laufStand, ampelFuer } = await import("../lib/fiaon-crons");
    const laufNamen = ["rueckholung", "sepa-werbung"];
    const laeufe = await Promise.all(laufNamen.map(async (name) => {
      const s = await laufStand(name);
      return { name, ...s, ampel: ampelFuer(s.stundenHer) };
    }));

    const z: any = (zustell as any[])[0] || {};
    const w: any = (wirkung as any[])[0] || {};
    res.json({
      ok: true,
      stand: new Date().toISOString(),
      trichter,
      versand: Object.fromEntries((laufzeilen as any[]).map((l: any) => [l.event, { gesamt: l.gesamt, heute: l.heute, geklickt: l.geklickt }])),
      zustellbarkeit: {
        sendungen30: Number(z.sendungen || 0), empfaenger30: Number(z.empfaenger || 0),
        schnitt: z.empfaenger ? Math.round((z.sendungen / z.empfaenger) * 10) / 10 : 0,
        maximum: Number(z.maximum_je_kopf || 0),
        zugestellt: Number(z.zugestellt || 0), geoeffnet: Number(z.geoeffnet || 0), geklickt: Number(z.geklickt || 0),
        blockiert: Number(z.blockiert || 0), gebounct: Number(z.gebounct || 0), spam: Number(z.spam || 0),
        blockquoteWochen: (wochen as any[]).map((r: any) => ({ woche: r.woche, quote: Number(r.quote || 0) })),
      },
      bremse: { zurueckgehalten24h: Number((bremse24 as any[])[0]?.n || 0) },
      wirkung: {
        angeschrieben: Number(w.angeschrieben || 0), termine: Number(w.termine || 0),
        bezahlt: Number(w.bezahlt || 0), umsatz_cents: Number(w.umsatz_cents || 0),
      },
      schalter,
      laeufe,
    });
  } catch (err) {
    console.error("[CHEF-RUECKHOLUNG] lesen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** GET /chef/rueckholung/segment/:segment — die nächsten 50 Fälle, wie der Lauf sie ziehen würde. */
router.get("/chef/rueckholung/segment/:segment", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const segment = String(req.params.segment) as Segment;
    if (!SEGMENTE.includes(segment)) return res.status(400).json({ ok: false, error: "Unbekanntes Segment." });
    const faelle = await rueckholKandidaten(segment, 50);
    // Keine vollen Mailadressen an den Browser — der Leitstand braucht sie
    // nicht, und jede Adresse weniger im Netzverkehr ist eine weniger.
    res.json({ ok: true, faelle: faelle.map((f) => ({
      ref: f.ref, vorname: f.vorname,
      mail: f.email ? f.email.replace(/^(.{2}).*(@.*)$/, "$1…$2") : null,
      telefon: f.telefon ? f.telefon.replace(/.(?=.{3})/g, "·") : null,
      paket: f.paket, betrag: f.betrag, alterTage: f.alterTage,
      mahnungen: f.mahnungen, bisherige: f.bisherige,
    })) });
  } catch (err) {
    console.error("[CHEF-RUECKHOLUNG] segment:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /chef/rueckholung/einstellung {key, value} — nur die Whitelist. */
router.post("/chef/rueckholung/einstellung", requireChef("geschaeftsfuehrung"), async (req: Request, res: Response) => {
  try {
    const key = String(req.body?.key || "");
    const value = String(req.body?.value ?? "");
    if (!ERLAUBTE_SCHLUESSEL.has(key)) return res.status(400).json({ ok: false, error: "Diesen Schlüssel darf der Leitstand nicht schreiben." });
    if (!/^[0-9]{0,6}$/.test(value)) return res.status(400).json({ ok: false, error: "Nur ganze Zahlen." });
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[CHEF-RUECKHOLUNG] Einstellung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
