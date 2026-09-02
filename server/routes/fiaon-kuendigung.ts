// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNGEN — ein Ort für alle Quellen (02.09.2026, E-092)
//
// Bis heute liefen Kündigungen in drei Töpfen, die nichts voneinander wussten:
// das Formular (`cancellation_requests`, 127 unbearbeitete Anträge seit Mai),
// die Mails an support@/welcome@ (der Postmeister legte nur einen Vermerk an)
// und das Telefon (gar nichts). Keiner der drei wirkte auf das Abo.
//
// Hier laufen sie zusammen: eine Liste, ein Knopf, eine Regel.
// Die Regel steht in server/lib/fiaon-kuendigung.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { kuendigungSetzen, kuendigungZuruecknehmen, kuendigungSpalten, type KuendigungQuelle } from "../lib/fiaon-kuendigung";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();
const QUELLEN: KuendigungQuelle[] = ["mail", "formular", "telefon", "admin", "altbestand"];

/** Bestätigungsmail — einmalig je Bestellung (Vertragspost, keine Werbung). */
async function bestaetigungSenden(ref: string): Promise<boolean> {
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.email, a.first_name, a.last_name, a.payment_reference, a.pack_name,
           a.letzte_rate_nr, a.kuendigung_bestaetigt_mail_am, a.payment_status,
           r.zahlungsreferenz, r.betrag_cents, r.faellig_am
    FROM fiaon_applications a
    LEFT JOIN LATERAL (
      SELECT zahlungsreferenz, betrag_cents, faellig_am FROM fiaon_abo_raten x
      WHERE x.ref = a.ref AND x.rate_nr = a.letzte_rate_nr AND x.status = 'offen' LIMIT 1
    ) r ON TRUE
    WHERE a.ref = ${ref} LIMIT 1
  `) as any[];
  if (!a || a.kuendigung_bestaetigt_mail_am) return false;
  // Ohne offene Rate gibt es nichts zu bezahlen — dann ist der Vertrag schon
  // beendet und die Abschlussmail hat der Buchungsweg geschickt.
  if (!a.zahlungsreferenz) return false;
  const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
  const faellig = a.faellig_am ? new Date(`${String(a.faellig_am).slice(0, 10)}T12:00:00Z`) : null;
  const erg: any = await sendMakeWebhookMitGrund("kuendigung_bestaetigt", {
    ...makePayloadFromRow(a),
    paket: a.pack_name ? String(a.pack_name).split("\n")[0] : null,
    rate_nr: String(a.letzte_rate_nr ?? ""),
    betrag: (Number(a.betrag_cents) / 100).toFixed(2),
    verwendungszweck: a.zahlungsreferenz,
    faellig_am_text: faellig ? faellig.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
    portal_url: absoluteUrl("/login"),
  } as any);
  if (erg === false) return false;
  await sqlPool`UPDATE fiaon_applications SET kuendigung_bestaetigt_mail_am = NOW() WHERE ref = ${ref}`.catch(() => {});
  return true;
}

// WICHTIG: Diese Route steht VOR `/admin/kuendigung/:ref` — sonst fängt der
// Platzhalter das Wort „altbestand" ab und sucht eine Bestellung mit diesem
// Namen (Fund im Praxistest, 02.09.2026).
/**
 * POST /admin/kuendigung/altbestand {schreiben:false, mail:false}
 * Die offenen Anträge nach der neuen Regel abarbeiten. Vorschau zeigt BEIDE
 * Summen: was fällig bleibt und was entfällt — Justin entscheidet mit Zahlen.
 */
router.post("/admin/kuendigung/altbestand", async (req: Request, res: Response) => {
  try {
    await kuendigungSpalten();
    const schreiben = req.body?.schreiben === true;
    const mailSenden = req.body?.mail === true;
    const deckel = Math.min(300, Math.max(1, Number(req.body?.deckel) || 300));
    const kandidaten = (await sqlPool`
      SELECT DISTINCT ON (c.ref) c.ref, c.created_at, c.reason
        FROM cancellation_requests c
        JOIN fiaon_applications a ON a.ref = c.ref AND a.merged_into IS NULL
       WHERE c.status = 'pending' AND a.gekuendigt_am IS NULL
       ORDER BY c.ref, c.created_at ASC
    `) as any[];
    const ergebnisse: any[] = [];
    let bleibtCents = 0, entfaelltCents = 0, mails = 0;
    for (const k of kandidaten.slice(0, deckel)) {
      const erg = await kuendigungSetzen(k.ref, {
        quelle: "altbestand", grund: k.reason ?? null, am: k.created_at, probe: !schreiben,
      }).catch((e) => ({ ok: false, ref: k.ref, weg: "unbekannt", grund: String(e).slice(0, 120) } as any));
      if (erg.letzteRateBetragCents) bleibtCents += Number(erg.letzteRateBetragCents);
      if (erg.stornierteRaten) {
        const [s] = (await sqlPool`
          SELECT COALESCE(SUM(betrag_cents), 0)::int AS c FROM fiaon_abo_raten
           WHERE ref = ${k.ref} AND rate_nr > ${erg.letzteRateNr ?? 0} AND status IN ('offen', 'storniert')
        `) as any[];
        entfaelltCents += Number(s?.c || 0);
      }
      if (schreiben && erg.ok) {
        // Den Formular-Topf mitziehen — sonst zeigt die alte Liste weiter „offen".
        await sqlPool`
          UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(),
                 admin_note = COALESCE(admin_note, '') || ' [E-092 nach neuer Regel bearbeitet]'
           WHERE ref = ${k.ref} AND status = 'pending'
        `.catch(() => {});
      }
      if (schreiben && mailSenden && erg.ok) { if (await bestaetigungSenden(k.ref).catch(() => false)) mails += 1; }
      ergebnisse.push({ ref: k.ref, weg: erg.weg, letzteRate: erg.letzteRateNr, storniert: erg.stornierteRaten, grund: erg.grund });
    }
    const jeWeg: Record<string, number> = {};
    for (const e of ergebnisse) jeWeg[e.weg] = (jeWeg[e.weg] || 0) + 1;
    res.json({
      ok: true, schreiben, mailSenden, kandidaten: kandidaten.length, bearbeitet: ergebnisse.length, jeWeg,
      forderungBleibtEuro: Math.round(bleibtCents) / 100,
      forderungEntfaelltEuro: Math.round(entfaelltCents) / 100,
      mails, beispiele: ergebnisse.slice(0, 10),
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] altbestand:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** POST /admin/kuendigung/:ref — Kündigung setzen (idempotent). */
router.post("/admin/kuendigung/:ref", async (req: Request, res: Response) => {
  try {
    const quelle = QUELLEN.includes(req.body?.quelle) ? req.body.quelle as KuendigungQuelle : "admin";
    const erg = await kuendigungSetzen(String(req.params.ref), {
      quelle, grund: req.body?.grund ?? null, am: req.body?.am ?? null,
      postmeisterId: req.body?.postmeisterId ?? null, probe: req.body?.probe === true,
    });
    let mailGesendet = false;
    if (erg.ok && req.body?.probe !== true && req.body?.mail !== false) {
      mailGesendet = await bestaetigungSenden(String(req.params.ref)).catch(() => false);
    }
    // Antrag im Formular-Topf mitziehen, falls vorhanden.
    if (erg.ok && req.body?.probe !== true) {
      await sqlPool`
        UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(),
               admin_note = COALESCE(admin_note, '') || ' [E-092 automatisch bestätigt]'
         WHERE ref = ${String(req.params.ref)} AND status = 'pending'
      `.catch(() => {});
    }
    res.json({ ...erg, mailGesendet });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] setzen:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** POST /admin/kuendigung/:ref/zuruecknehmen */
router.post("/admin/kuendigung/:ref/zuruecknehmen", async (req: Request, res: Response) => {
  try {
    res.json(await kuendigungZuruecknehmen(String(req.params.ref), req.body?.grund ?? null));
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

/** GET /admin/kuendigungen — alle Quellen an einem Ort. */
router.get("/admin/kuendigungen", async (req: Request, res: Response) => {
  try {
    await kuendigungSpalten();
    const offen = String(req.query.status || "offen") !== "alle";
    const zeilen = (await sqlPool`
      WITH quellen AS (
        SELECT c.ref, 'formular' AS quelle, c.created_at AS am, c.reason AS grund, c.status AS antrag_status
          FROM cancellation_requests c WHERE c.ref IS NOT NULL
        UNION ALL
        SELECT pm.ref, 'mail' AS quelle, pm.empfangen_am AS am, LEFT(COALESCE(pm.begruendung, pm.betreff), 200), NULL
          FROM fiaon_postmeister pm WHERE pm.kategorie = 'kuendigung' AND pm.ref IS NOT NULL
      ), gebuendelt AS (
        SELECT ref, MIN(am) AS erste_meldung, string_agg(DISTINCT quelle, '+') AS quellen,
               (array_agg(grund ORDER BY am DESC))[1] AS grund,
               bool_or(antrag_status = 'pending') AS antrag_offen
          FROM quellen GROUP BY ref
      )
      SELECT g.ref, g.erste_meldung, g.quellen, g.grund, g.antrag_offen,
             a.first_name, a.last_name, a.email, a.payment_status, a.pack_name, a.person_id,
             a.gekuendigt_am, a.letzte_rate_nr, a.vertrag_ende_am, a.kuendigung_bestaetigt_mail_am,
             (SELECT COUNT(*) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS raten_offen,
             (SELECT COALESCE(SUM(r.betrag_cents), 0) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS offen_cents,
             (SELECT MAX(r.mahnstufe) FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen')::int AS mahnstufe
        FROM gebuendelt g
        JOIN fiaon_applications a ON a.ref = g.ref AND a.merged_into IS NULL
       WHERE ${offen ? sqlPool`a.gekuendigt_am IS NULL` : sqlPool`TRUE`}
       ORDER BY g.erste_meldung DESC LIMIT 300
    `) as any[];
    res.json({
      ok: true, offen,
      anzahl: zeilen.length,
      summeOffenEuro: Math.round(zeilen.reduce((s, z) => s + Number(z.offen_cents || 0), 0)) / 100,
      zeilen: zeilen.map((z) => ({
        ref: z.ref, quellen: z.quellen, erste_meldung: z.erste_meldung, grund: z.grund,
        name: [z.first_name, z.last_name].filter(Boolean).join(" "), email: z.email,
        payment_status: z.payment_status, paket: z.pack_name ? String(z.pack_name).split("\n")[0] : null,
        person_id: z.person_id, gekuendigt_am: z.gekuendigt_am, letzte_rate_nr: z.letzte_rate_nr,
        vertrag_ende_am: z.vertrag_ende_am, bestaetigt_am: z.kuendigung_bestaetigt_mail_am,
        raten_offen: z.raten_offen, offen_euro: Number(z.offen_cents || 0) / 100, mahnstufe: z.mahnstufe,
      })),
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] liste:", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

export default router;
