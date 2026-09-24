// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO · AUSKUNFT-VERKAUF — das Backend von /chef/s/auskunft (24.09.2026, E-240)
//
// Justin: Die Bonitätsauskunft soll „weggehen wie warme Semmeln", Ziel 150 am
// Tag. Diese Seite zeigt ehrlich, wo wir stehen — bestellt und bezahlt heute
// gegen das Ziel, die letzten 14 Tage, wer sie noch nicht hat, wer bestellt
// und nicht bezahlt hat, wer bezahlt hat und noch nichts geliefert bekam —
// und sie schaltet den Verkaufstakt (server/lib/fiaon-auskunft-verkauf.ts).
// Jede Zahl ist gezählt, keine geschätzt (Regel des Lagezimmers).
//
//   GET  /chef/auskunft              der ganze Stand in einer Antwort
//   GET  /chef/auskunft/vorschau     wer heute angeschrieben würde (nur lesen)
//   POST /chef/auskunft/einstellung  {key, value} — nur die zwei Schalter
//   POST /chef/auskunft/lieferung    {ref, mail} — die Lieferung einer bezahlten
//                                    Auskunft von Hand starten (Rückstand)
//   GET  /auskunft/k/:token          ÖFFENTLICH: der Knopf der WhatsApp-Vorlage
//
// Ein Startknopf fehlt ABSICHTLICH (wie in der Rückholung): Der Takt läuft
// alle 30 Minuten und gehorcht Schalter und Tagesdeckel. Wer ihn anhalten
// will, schaltet ihn hier aus.
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { requireChef, type ChefRequest } from "./fiaon-chef-zugang";
import { euroText, auskunftLand, auskunfteienText } from "@shared/fiaon-auskunft";
import { katalogpreisCents } from "../lib/fiaon-massgebliche-bestellung";
import {
  SCHALTER_AN, SCHALTER_PRO_TAG, HOECHSTENS_PRO_TAG, UWG_STICHTAG, HOECHSTENS_BERUEHRUNGEN, ANGEBOT_EVENT, WA_GRUPPE,
  poolZahlen, verkaufSchalter, beruehrungenHeute, whatsappMoeglich, vorschauHeute, istSendezeit, kurzTokenLesen,
} from "../lib/fiaon-auskunft-verkauf";

const router = Router();
const wache = requireChef("geschaeftsfuehrung");

/** Justins Ziel (24.09.2026): 150 Auskünfte am Tag. */
const ZIEL_PRO_TAG = 150;

const IST_AUSKUNFT = `(COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')`;
/** Bezahlt am — dieselbe Regel wie die Geld-Wahrheit (/chef/zahlen): paid_at, sonst completed_at. */
const BEZAHLT_AM = `COALESCE(a.paid_at, a.completed_at::timestamptz)`;
/** Berliner Kalendertag einer Zeile. created_at ist ohne Zeitzone — der Cast nimmt die der Sitzung, wie beim Schreiben. */
const TAG = (spalte: string) => `((${spalte}) AT TIME ZONE 'Europe/Berlin')::date`;

// ───────────────────────────────────────────────────────────────────────────
// Rückstand „bezahlt, nicht geliefert"
// ───────────────────────────────────────────────────────────────────────────

interface Rueckstand {
  personId: number; ref: string; name: string; land: string; auskunfteien: string;
  gekauftAm: string; tageSeitKauf: number; betreuer: string | null; vorgaenge: number;
}

/**
 * Aus rueckstandListe (fiaon-auskunft-lieferung.ts) — der einen Definition
 * von „geliefert". Fehlt sie (paralleler Bau), zählt die gleichwertige
 * Abfrage unten: jüngste bezahlte Auskunft je Person ohne schufa_pdf.
 */
async function rueckstand(): Promise<{ zeilen: Rueckstand[]; quelle: "lieferung" | "eigen" }> {
  try {
    const m: any = await import("../lib/fiaon-auskunft-lieferung");
    if (typeof m.rueckstandListe === "function") {
      const liste = (await m.rueckstandListe()) as any[];
      return {
        quelle: "lieferung",
        zeilen: liste.map((z) => ({
          personId: Number(z.personId), ref: String(z.ref), name: String(z.name || "Ohne Namen"),
          land: String(z.land || "DE"), auskunfteien: String(z.auskunfteien || ""),
          gekauftAm: String(z.gekauftAm), tageSeitKauf: Number(z.tageSeitKauf || 0),
          betreuer: z.betreuer?.name ? String(z.betreuer.name) : null,
          vorgaenge: Number(z.lieferung?.vorgaenge || 0),
        })),
      };
    }
  } catch (e) {
    console.warn("[CHEF-AUSKUNFT] rueckstandListe nicht verfügbar — eigene Abfrage:", String((e as Error)?.message || e).slice(0, 160));
  }
  // Gleichwertig zur Lieferung: jüngste bezahlte Auskunft je Person, keine Test-/zusammengeführte Person, kein Dokument.
  const zeilen = (await sqlPool.unsafe(`
    WITH kauf AS (
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, ${BEZAHLT_AM} AS bezahlt_am, a.created_at::timestamptz AS angelegt,
             a.assigned_agent_id, a.first_name, a.last_name
        FROM fiaon_applications a
       WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.payment_status = 'paid' AND ${IST_AUSKUNFT}
       ORDER BY a.person_id, ${BEZAHLT_AM} DESC NULLS LAST, a.created_at DESC
    )
    SELECT k.person_id, k.ref, COALESCE(k.bezahlt_am, k.angelegt) AS gekauft_am,
           COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', k.first_name, k.last_name)), ''), k.ref) AS name,
           (SELECT x.country FROM fiaon_applications x WHERE x.person_id = k.person_id AND x.merged_into IS NULL AND x.country IS NOT NULL
             ORDER BY (x.payment_status = 'paid') DESC, x.created_at DESC LIMIT 1) AS land,
           COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS betreuer
      FROM kauf k
      JOIN fiaon_persons p ON p.id = k.person_id
      LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, k.assigned_agent_id)
     WHERE p.ist_test_am IS NULL AND p.merged_into_person_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM fiaon_applications d WHERE d.person_id = k.person_id AND d.schufa_pdf IS NOT NULL)
     ORDER BY COALESCE(k.bezahlt_am, k.angelegt) ASC`)) as any[];
  const jetzt = Date.now();
  return {
    quelle: "eigen",
    zeilen: zeilen.map((z) => {
      const land = auskunftLand(z.land);
      const am = new Date(z.gekauft_am);
      return {
        personId: Number(z.person_id), ref: String(z.ref), name: String(z.name), land, auskunfteien: auskunfteienText(land),
        gekauftAm: am.toISOString(), tageSeitKauf: Math.max(0, Math.floor((jetzt - am.getTime()) / 86_400_000)),
        betreuer: z.betreuer ? String(z.betreuer) : null, vorgaenge: 0,
      };
    }),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// GET /chef/auskunft
// ───────────────────────────────────────────────────────────────────────────

router.get("/chef/auskunft", wache, async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const [tage, offen, pool, schalter, heuteBeruehrt, wa, rueck, wirkung, vorlage] = await Promise.all([
      // Die letzten 14 Berliner Tage: bestellt (ohne stillgelegte Doppel) und bezahlt.
      sqlPool.unsafe(`
        WITH t AS (
          SELECT d::date AS tag FROM generate_series((NOW() AT TIME ZONE 'Europe/Berlin')::date - 13,
                                                     (NOW() AT TIME ZONE 'Europe/Berlin')::date, INTERVAL '1 day') d
        ),
        -- Gegenlesen 24.09.2026: ohne zusammengeführte Doppel (merged_into) — sonst zählte ein
        -- doppelt angelegter Antrag als zwei Bestellungen (30 Tage bis 24.09.: 5 solche Zeilen).
        auskunft AS (
          SELECT a.* FROM fiaon_applications a
            LEFT JOIN fiaon_persons p ON p.id = a.person_id
           WHERE ${IST_AUSKUNFT} AND a.merged_into IS NULL AND a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL
        )
        SELECT to_char(t.tag, 'YYYY-MM-DD') AS tag,
               (SELECT COUNT(*) FROM auskunft a WHERE a.payment_status <> 'superseded' AND ${TAG("a.created_at::timestamptz")} = t.tag)::int AS bestellt,
               (SELECT COUNT(*) FROM auskunft a WHERE a.payment_status = 'paid' AND ${TAG(BEZAHLT_AM)} = t.tag)::int AS bezahlt,
               (SELECT COALESCE(SUM(ROUND(a.amount_due * 100)), 0) FROM auskunft a WHERE a.payment_status = 'paid' AND ${TAG(BEZAHLT_AM)} = t.tag)::bigint AS umsatz_cents
          FROM t ORDER BY t.tag`) as Promise<any[]>,
      // Bestellt, nicht bezahlt: mit Zahlungslink — das Geld liegt schon auf dem Tisch.
      sqlPool.unsafe(`
        SELECT a.ref, a.person_id, a.payment_reference, a.payment_status, a.amount_due, a.pack_key, a.created_at::timestamptz AS angelegt,
               a.claimed_paid_at, a.country,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)), ''), a.ref) AS name,
               COALESCE(NULLIF(ag.name, ''), TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name))) AS betreuer,
               (p.werbung_gesperrt_am IS NOT NULL) AS werbesperre
          FROM fiaon_applications a
          LEFT JOIN fiaon_persons p ON p.id = a.person_id
          LEFT JOIN fiaon_agents ag ON ag.id = COALESCE(p.assigned_agent_id, a.assigned_agent_id)
         WHERE ${IST_AUSKUNFT} AND a.merged_into IS NULL AND a.payment_status IN ('pending_payment', 'claimed_paid')
           AND a.ref NOT LIKE 'FIAON-TEST%' AND p.ist_test_am IS NULL AND a.gdpr_deleted_at IS NULL
         ORDER BY a.created_at DESC
         LIMIT 100`) as Promise<any[]>,
      poolZahlen(),
      verkaufSchalter(),
      beruehrungenHeute(),
      whatsappMoeglich(),
      rueckstand(),
      // Wirkung der Angebots-Mails der letzten 30 Tage: wer danach bestellt bzw. bezahlt hat.
      sqlPool.unsafe(`
        WITH m AS (
          SELECT person_id, MIN(created_at) AS am FROM fiaon_mail_log
           WHERE event = '${ANGEBOT_EVENT}' AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
             AND person_id IS NOT NULL AND created_at > NOW() - INTERVAL '30 days'
           GROUP BY 1
        )
        SELECT COUNT(*)::int AS angeschrieben,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND ${IST_AUSKUNFT} AND a.merged_into IS NULL
                                               AND a.created_at::timestamptz > m.am))::int AS bestellt,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.person_id = m.person_id AND ${IST_AUSKUNFT} AND a.merged_into IS NULL
                                               AND a.payment_status = 'paid' AND ${BEZAHLT_AM} > m.am))::int AS bezahlt,
               (SELECT COUNT(*) FROM fiaon_wa_aktion WHERE gruppe = '${WA_GRUPPE}' AND ok AND erstellt_am > NOW() - INTERVAL '30 days')::int AS whatsapp
          FROM m`) as Promise<any[]>,
      vorlageStand(),
    ]);

    const t = (tage as any[]).map((r) => ({ tag: String(r.tag), bestellt: Number(r.bestellt || 0), bezahlt: Number(r.bezahlt || 0), umsatzCents: Number(r.umsatz_cents || 0) }));
    const heute = t[t.length - 1] ?? { tag: "", bestellt: 0, bezahlt: 0, umsatzCents: 0 };
    const w = (wirkung as any[])[0] ?? {};
    res.json({
      ok: true,
      stand: new Date().toISOString(),
      ziel: ZIEL_PRO_TAG,
      heute,
      tage: t,
      pool,
      offen: (offen as any[]).map((o) => ({
        ref: String(o.ref), personId: o.person_id != null ? Number(o.person_id) : null, name: String(o.name),
        status: String(o.payment_status), gemeldetAm: o.claimed_paid_at ? new Date(o.claimed_paid_at).toISOString() : null,
        // E-181: Der Katalogpreis gilt; amount_due nur, wenn keiner bestimmbar ist (Gegenlesen 24.09.2026).
        // Integration 25.09.2026: über katalogpreisCents (erst die Kategorie, dann der Schlüssel) — sechs
        // Auskunft-Zeilen tragen vom Dubletten-Merge ein Stufenpaket im pack_key; der Schlüssel allein
        // hätte dort 99,99 € statt 74 € angezeigt.
        betrag: katalogpreisCents({ ref: o.ref, type: "schufa", pack_key: o.pack_key })
          ? euroText(katalogpreisCents({ ref: o.ref, type: "schufa", pack_key: o.pack_key })!)
          : o.amount_due != null ? euroText(Math.round(Number(o.amount_due) * 100)) : null,
        angelegt: new Date(o.angelegt).toISOString(),
        tage: Math.max(0, Math.floor((Date.now() - new Date(o.angelegt).getTime()) / 86_400_000)),
        land: auskunftLand(o.country), betreuer: o.betreuer ? String(o.betreuer) : null, werbesperre: !!o.werbesperre,
        zahlungsseite: o.payment_reference ? absoluteUrl(`/zahlung/${encodeURIComponent(String(o.payment_reference))}`) : null,
        verwendungszweck: o.payment_reference ? String(o.payment_reference) : null,
      })),
      rueckstand: rueck,
      takt: {
        an: schalter.an, proTag: schalter.proTag, hoechstensProTag: HOECHSTENS_PRO_TAG,
        heute: heuteBeruehrt, sendezeit: istSendezeit(),
        stichtag: UWG_STICHTAG, hoechstensBeruehrungen: HOECHSTENS_BERUEHRUNGEN,
        whatsapp: wa,
      },
      wirkung30: {
        angeschrieben: Number(w.angeschrieben || 0), bestellt: Number(w.bestellt || 0),
        bezahlt: Number(w.bezahlt || 0), whatsapp: Number(w.whatsapp || 0),
      },
      vorlage,
    });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] lesen:", err);
    res.status(500).json({ ok: false, error: "Der Stand ließ sich nicht laden." });
  }
});

/** Die WhatsApp-Vorlage des Takts: Entwurf, Text mit Beispielwerten, Stand bei Meta. */
async function vorlageStand() {
  const { WA_VORLAGEN_ENTWURF, WA_VORLAGEN, AUSKUNFT_VORLAGE } = await import("@shared/fiaon-lead-texte");
  const def = WA_VORLAGEN.find((v) => v.name === AUSKUNFT_VORLAGE) ?? WA_VORLAGEN_ENTWURF.find((v) => v.name === AUSKUNFT_VORLAGE);
  // Freigegeben? Aus dem 5-Minuten-Zwischenspeicher der Freigaben — kein Graph-Aufruf je Seitenaufruf.
  let freigegeben: boolean | null = null;
  try {
    const { waKonfig, freigegebeneVorlagen } = await import("../lib/fiaon-whatsapp");
    if (waKonfig().bereit) {
      const { istFrei } = await import("../lib/fiaon-wa-zentrale");
      freigegeben = istFrei(AUSKUNFT_VORLAGE, await freigegebeneVorlagen());
    }
  } catch { /* Meta nicht erreichbar — die Seite zeigt „unbekannt" */ }
  if (!def) return null;
  return {
    name: def.name, kopf: def.kopf ?? "", fuss: def.fuss ?? "", kategorie: def.kategorie,
    text: def.text, beispiel: def.text.replace(/\{\{(\d)\}\}/g, (_m, n) => def.beispiele[Number(n) - 1] ?? ""),
    knoepfe: def.knoepfe.map((k) => k.text),
    entwurf: !WA_VORLAGEN.some((v) => v.name === AUSKUNFT_VORLAGE),
    /** true/false; null = WhatsApp nicht eingerichtet oder Meta nicht erreichbar. */
    freigegeben,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// GET /chef/auskunft/vorschau — wer heute angeschrieben würde
// ───────────────────────────────────────────────────────────────────────────

router.get("/chef/auskunft/vorschau", wache, async (_req: Request, res: Response) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, ...(await vorschauHeute(30)) });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Vorschau:", err);
    res.status(500).json({ ok: false, error: "Die Vorschau ließ sich nicht laden." });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /chef/auskunft/einstellung — nur die zwei Schalter
// ───────────────────────────────────────────────────────────────────────────

router.post("/chef/auskunft/einstellung", wache, async (req: ChefRequest, res: Response) => {
  try {
    const key = String(req.body?.key || "");
    const value = String(req.body?.value ?? "").trim();
    if (key === SCHALTER_AN) {
      if (value !== "0" && value !== "1") return res.status(400).json({ ok: false, error: "Erlaubt sind 0 (aus) und 1 (an)." });
    } else if (key === SCHALTER_PRO_TAG) {
      if (!/^\d{1,4}$/.test(value) || Number(value) > HOECHSTENS_PRO_TAG) {
        return res.status(400).json({ ok: false, error: `Bitte eine ganze Zahl von 0 bis ${HOECHSTENS_PRO_TAG}.` });
      }
    } else {
      return res.status(400).json({ ok: false, error: "Diesen Schlüssel darf die Seite nicht schreiben." });
    }
    await sqlPool`
      INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()`;
    const wer = req.chef?.agentId ? `Chef #${req.chef.agentId}` : "Chefbüro";
    console.log(`[CHEF-AUSKUNFT] ${key} = ${value} durch ${wer}`);
    res.json({ ok: true, takt: await verkaufSchalter() });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Einstellung:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ───────────────────────────────────────────────────────────────────────────
// POST /chef/auskunft/lieferung — den Rückstand von Hand starten
//
// Integration 25.09.2026 (E-240): Die Lieferung (fiaon-auskunft-lieferung.ts)
// startet bei jeder NEUEN Zahlung von selbst (onCustomerPaid). Für den
// Rückstand — bezahlt vor dem 24.09., 59 Menschen ohne Dokument — sagt sie
// ausdrücklich „gestartet wird im Chefbüro von Hand, je Bestellung", und ihre
// Aufgaben („Anschrift fehlt", „ohne Person") verweisen auf „Auskunft-Rückstand
// … neu starten". Diesen Knopf gab es nicht: eine Liste ohne Hebel.
// Idempotent wie die Lieferung selbst — ein zweiter Klick legt nichts doppelt an.
// `mail: false` = ohne Mail an den Kunden (der Betreuer ruft an).
// ───────────────────────────────────────────────────────────────────────────

router.post("/chef/auskunft/lieferung", wache, async (req: ChefRequest, res: Response) => {
  try {
    const ref = String(req.body?.ref ?? "").trim();
    if (!/^FIAON-[A-Z0-9-]{3,60}$/i.test(ref)) return res.status(400).json({ ok: false, error: "Keine gültige Bestellnummer." });
    const mail = req.body?.mail !== false;
    const wer = req.chef?.agentId ? `Chefbüro (#${req.chef.agentId})` : "Chefbüro";
    const { lieferungStarten } = await import("../lib/fiaon-auskunft-lieferung");
    const erg = await lieferungStarten(ref, { mail, von: wer });
    console.log(`[CHEF-AUSKUNFT] Lieferung ${ref} von Hand (${wer}, Mail ${mail ? "ja" : "nein"}): ${erg.text}`);
    // ok = die Anfrage lief; ob geliefert wurde, sagt `lieferung` (ok, grund, text) — die Seite zeigt den Satz.
    res.json({ ok: true, lieferung: erg });
  } catch (err) {
    console.error("[CHEF-AUSKUNFT] Lieferung:", err);
    res.status(500).json({ ok: false, error: "Die Lieferung ließ sich nicht starten." });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ÖFFENTLICH — der Knopf der WhatsApp-Vorlage fiaon_kk_auskunft
//
// Meta hängt den Wert einer URL-Variable ans Ende der Adresse. Ein „?p=…&art=…"
// darin hinge an der Kodierung von Meta; deshalb trägt der Knopf den signierten
// Kauflink als EIN Pfadstück (kaufKurzToken) und diese Route macht daraus
// wieder genau den Link aus fiaon-auskunft-kauf.ts. Geprüft wird die Signatur
// DORT — hier nur die Form. Bestellt wird hier nichts: Das Ziel ist die
// Bestätigungsseite mit „zahlungspflichtig beauftragen" (§ 312j Abs. 3 BGB).
// Keine Chef-Wache: Das ist die Tür des Kunden.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/auskunft/k/:token", (req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  const t = kurzTokenLesen(req.params.token);
  // Falsche Form: auf die Bestätigungsseite ohne Signatur — sie sagt dem Kunden freundlich „ungültig" und nennt den Weg.
  const ziel = t
    ? `/api/fiaon/auskunft/bestellen?${new URLSearchParams({ p: t.p, art: t.art, exp: t.exp, sig: t.sig }).toString()}`
    : "/api/fiaon/auskunft/bestellen";
  res.redirect(303, absoluteUrl(ziel));
});

export default router;
