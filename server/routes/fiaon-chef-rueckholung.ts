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
import { UMSATZ_QUELLE_SQL } from "../lib/fiaon-umsatz-quelle";

const router = Router();

/** Nur diese Schlüssel darf der Leitstand schreiben. */
const ERLAUBTE_SCHLUESSEL = new Set([
  "rueckhol_pro_tag",        // Tagesdeckel der Rückholung; 0 = aus
  "rueckhol_s1_an", "rueckhol_s2_an", "rueckhol_s3_an", "rueckhol_s4_an", "rueckhol_s5_an",
  "rueckhol_dauerpflege_abstand_tage", // Abstand der Dauerpflege-Mails (min. 21, serverseitig erzwungen)
  "frequenzbremse_an",       // 1 | 0 — die globale Empfänger-Bremse
  "frequenz_pro_tag", "frequenz_pro_woche", "frequenz_pro_monat",
  "max_reminders",           // Obergrenze Mahnungen je Bestellung (Mahnkette); 0 = ohne (E-182)
  "mahn_takte_pro_tag",      // wie oft am Tag die Mahnkette läuft
  "mahn_dauer_tage",         // E-182: Raten nach Stufe 5 alle N Tage weiter; 0 = Schluss nach Stufe 5
  // ── FIAON Global (17.09.2026, E-188) — drei Einstellungen des Bestellwegs ──
  "global_zustaendig_agent_id", // wer neue Global-Aufträge und den Start bekommt; leer = Vertriebsleitung
  "global_provision_prozent",   // Satz der Abschlussprovision für Global-Einmalpreise; Vorgabe 25, 0 = keine
  "rechnung_b2b_ust_modus",     // none | reverse_charge — gilt für NEUE Aufträge, steht danach fest an der Bestellung
  // E-458 Nr. 11 (29.10.2026): wer einspringt, wenn die Person der Global-Gespräche nicht da ist — leer = niemand (dann die Leitung)
  "global_vertretung_agent_id",
]);

/**
 * Schlüssel mit eigener Wertprüfung (E-188). Alle anderen bleiben „nur ganze Zahlen".
 * Gibt den Fehlertext zurück oder `null`, wenn der Wert in Ordnung ist.
 */
async function sonderPruefung(key: string, value: string): Promise<string | null | undefined> {
  if (key === "rechnung_b2b_ust_modus") {
    return value === "none" || value === "reverse_charge" ? null : "Erlaubt sind none und reverse_charge.";
  }
  if (key === "global_provision_prozent") {
    return /^\d{1,2}$/.test(value) && Number(value) <= 50 ? null : "Bitte eine ganze Zahl von 0 bis 50.";
  }
  if (key === "global_zustaendig_agent_id" || key === "global_vertretung_agent_id") {
    // leer = die Vertriebsleitung mit den wenigsten offenen Aufgaben bzw. (Vertretung) niemand — dann die Leitung
    if (value === "" || value === "0") return null;
    if (!/^\d{1,6}$/.test(value)) return "Bitte eine Person aus der Liste wählen.";
    const { globalMitarbeiter } = await import("../lib/fiaon-global-auftrag");
    return (await globalMitarbeiter()).some((m) => m.id === Number(value)) ? null : "Diese Person ist nicht aktiv oder gehört nicht zu Vertrieb und Leitung.";
  }
  return undefined; // kein Sonderfall
}

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
         WHERE status = 'fehlgeschlagen' AND (grund LIKE 'Frequenzbremse:%' OR grund LIKE 'Sperre:%')
           AND created_at > NOW() - INTERVAL '24 hours'`,
      // Wirkung: Rückhol-Mail → Termin → Zahlung, je Person nach dem Versand.
      // E-343 (13.10.2026): Zahlung = jede gebuchte Zahlung der Person NACH ihrer ersten Rückhol-Mail, aus der
      // EINEN Umsatzquelle. Vorher a.paid_at > erste Mail — paid_at wird seit 24.09. nicht mehr geschrieben,
      // die Stufe stand deshalb immer auf 0. „neu" = Personen ohne jede Zahlung vor der ersten Mail.
      sqlPool.unsafe(`
        WITH q AS (${UMSATZ_QUELLE_SQL}),
        post AS (
          SELECT person_id, MIN(created_at) erste
            FROM fiaon_mail_log
           WHERE event LIKE 'rueckhol_%' AND status = 'versandt' AND person_id IS NOT NULL
           GROUP BY 1
        ),
        danach AS (
          SELECT post.person_id, SUM(q.cents) AS cents,
                 NOT EXISTS (SELECT 1 FROM q q0 WHERE q0.person_id = post.person_id AND q0.am <= post.erste) AS neu
            FROM post JOIN q ON q.person_id = post.person_id AND q.am > post.erste
           GROUP BY post.person_id, post.erste
        )
        SELECT (SELECT COUNT(*) FROM post)::int AS angeschrieben,
               (SELECT COUNT(*) FROM post WHERE EXISTS (
                 SELECT 1 FROM fiaon_termine t WHERE t.person_id = post.person_id AND t.created_at > post.erste
               ))::int AS termine,
               (SELECT COUNT(*) FROM danach)::int AS bezahlt,
               (SELECT COALESCE(SUM(cents), 0) FROM danach)::bigint AS umsatz_cents,
               (SELECT COUNT(*) FROM danach WHERE neu)::int AS neu_bezahlt,
               (SELECT COALESCE(SUM(cents), 0) FROM danach WHERE neu)::bigint AS neu_umsatz_cents`),
      einstellungen([
        "rueckhol_pro_tag", "rueckhol_s1_an", "rueckhol_s2_an", "rueckhol_s3_an", "rueckhol_s4_an", "rueckhol_s5_an", "rueckhol_dauerpflege_abstand_tage",
        "frequenzbremse_an", "frequenz_pro_tag", "frequenz_pro_woche", "frequenz_pro_monat",
        "max_reminders", "mahn_takte_pro_tag", "mahn_dauer_tage",
        "global_zustaendig_agent_id", "global_provision_prozent", "rechnung_b2b_ust_modus", "global_vertretung_agent_id",
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
    // 19.09.2026 (E-194): Der Lauf „sepa-werbung" ist weg — GoCardless ist beendet.
    const laufNamen = ["rueckholung"];
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
        // E-343: davon Personen, die vor der ersten Rückhol-Mail nie gezahlt hatten.
        neu_bezahlt: Number(w.neu_bezahlt || 0), neu_umsatz_cents: Number(w.neu_umsatz_cents || 0),
      },
      schalter,
      laeufe,
      // E-188: die Auswahl für „zuständige Person FIAON Global" — aktive Mitarbeiter aus Vertrieb und Leitung.
      mitarbeiter: await import("../lib/fiaon-global-auftrag").then((m) => m.globalMitarbeiter()).catch(() => []),
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
    const sonder = await sonderPruefung(key, value);
    if (sonder) return res.status(400).json({ ok: false, error: sonder });
    if (sonder === undefined && !/^[0-9]{0,6}$/.test(value)) return res.status(400).json({ ok: false, error: "Nur ganze Zahlen." });
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
