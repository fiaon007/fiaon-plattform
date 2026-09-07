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
import { requireAgent, type AgentRequest } from "./fiaon-agent";
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

// ═══════════════════════════════════════════════════════════════════════════
// KÜNDIGUNG FÜR JEDEN MITARBEITER (07.09.2026, Justin: „für jeden Mitarbeiter
// freischalten, dass man Kündigungen durchsetzen kann … aber auch im Gespräch
// eine Kündigung reaktivieren kann — zentral und überall")
//
// Dieselbe Regel wie im Chefbüro und bei Mara: kuendigungSetzen /
// kuendigungZuruecknehmen aus server/lib/fiaon-kuendigung.ts. Der Betreuer
// entscheidet nichts Neues — er löst dieselbe Kette aus (Zahlungsmails enden,
// Bestätigungsmail geht raus, Raten nach der letzten entfallen) und kann sie
// im Gespräch genauso wieder zurücknehmen (Raten kommen zurück, Konto läuft).
// Tür: requireAgent + darfAnKunde. Quelle „telefon".
// ═══════════════════════════════════════════════════════════════════════════
async function bestellungFuerAgent(req: AgentRequest, res: Response): Promise<{ ref: string; personId: number } | null> {
  const personId = Number(req.params.personId);
  if (!Number.isFinite(personId) || personId <= 0) { res.status(400).json({ ok: false, error: "Ungültige Kundenkennung." }); return null; }
  const { rolleVon, darfAnKunde } = await import("../lib/fiaon-kundenzugriff");
  const rolle = req.agent?.rolle || await rolleVon(req.agent!.id);
  if (!(await darfAnKunde(req.agent!.id, rolle, personId))) { res.status(403).json({ ok: false, error: "Dieser Kunde wird von jemand anderem betreut." }); return null; }
  const [a] = (await sqlPool`
    SELECT ref FROM fiaon_applications
    WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL
      AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
    ORDER BY (payment_status = 'paid') DESC, created_at DESC LIMIT 1`) as any[];
  if (!a) { res.status(404).json({ ok: false, error: "Keine Paketbestellung zu diesem Kunden." }); return null; }
  return { ref: String(a.ref), personId };
}

/** GET /agent/kunden/:personId/kuendigung — Stand des Vertrags für die Akte. */
router.get("/agent/kunden/:personId/kuendigung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const [a] = (await sqlPool`
      SELECT ref, payment_status, pack_name, gekuendigt_am, kuendigung_quelle, kuendigung_grund, letzte_rate_nr,
             vertrag_ende_am, kuendigung_zurueckgenommen_am, kuendigung_bestaetigt_mail_am, kuendigung_rueckhol_bis,
             (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = fiaon_applications.ref AND r.status = 'offen') AS offene_raten
      FROM fiaon_applications WHERE ref = ${b.ref} LIMIT 1`) as any[];
    const gekuendigt = !!a.gekuendigt_am;
    res.json({
      ok: true, ref: a.ref, bezahlt: String(a.payment_status) === "paid", paket: a.pack_name ? String(a.pack_name).split("\n")[0] : null,
      gekuendigt, gekuendigtAm: a.gekuendigt_am, quelle: a.kuendigung_quelle, grund: a.kuendigung_grund,
      letzteRateNr: a.letzte_rate_nr, vertragEndeAm: a.vertrag_ende_am, zurueckgenommenAm: a.kuendigung_zurueckgenommen_am,
      bestaetigungsmailAm: a.kuendigung_bestaetigt_mail_am, rueckholBis: a.kuendigung_rueckhol_bis, offeneRaten: Number(a.offene_raten || 0),
      beendet: !!a.vertrag_ende_am && new Date(a.vertrag_ende_am).getTime() <= Date.now(),
    });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent stand:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/kunden/:personId/kuendigung { grund, sofort? } — Kündigung durchsetzen. */
router.post("/agent/kunden/:personId/kuendigung", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte den Grund in einem Satz — er steht dauerhaft am Kunden." });
    const sofort = req.body?.sofort === true;
    const erg = await kuendigungSetzen(b.ref, { quelle: "telefon", grund: `${grund} (${req.agent!.name})`, sofort });
    let mailGesendet = false;
    if (erg.ok && erg.weg !== "bereits") mailGesendet = await bestaetigungSenden(b.ref).catch(() => false);
    if (erg.ok) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${b.ref}, ${b.personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
                ${`Kündigung durchgesetzt durch ${req.agent!.name} (${erg.weg}${sofort ? ", Kulanz sofort" : ""}). Grund: ${grund.slice(0, 200)}. Bestätigungsmail: ${mailGesendet ? "gesendet" : "nicht gesendet"}.`}, NOW())`.catch(() => {});
      await sqlPool`
        UPDATE cancellation_requests SET status = 'confirmed', processed_at = NOW(),
               admin_note = COALESCE(admin_note, '') || ${` [durch ${req.agent!.name} bestätigt]`}
         WHERE ref = ${b.ref} AND status = 'pending'`.catch(() => {});
    }
    res.json({ ...erg, mailGesendet });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent setzen:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /agent/kunden/:personId/kuendigung/zuruecknehmen { grund } — im Gespräch reaktiviert. */
router.post("/agent/kunden/:personId/kuendigung/zuruecknehmen", requireAgent, async (req: AgentRequest, res: Response) => {
  try {
    const b = await bestellungFuerAgent(req, res); if (!b) return;
    const grund = String(req.body?.grund || "").trim();
    if (grund.length < 5) return res.status(400).json({ ok: false, error: "Bitte kurz festhalten, was der Kunde gesagt hat." });
    const [a] = (await sqlPool`SELECT gekuendigt_am, payment_status FROM fiaon_applications WHERE ref = ${b.ref}`) as any[];
    if (!a?.gekuendigt_am) return res.status(409).json({ ok: false, error: "Es liegt keine Kündigung vor." });
    if (String(a.payment_status) === "cancelled") {
      // Unbezahlte Bestellung war storniert — zurück auf „Zahlung offen", damit der Weg wieder läuft.
      await sqlPool`UPDATE fiaon_applications SET payment_status = 'pending_payment', cancelled_at = NULL, mahnstopp_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`;
    }
    const erg = await kuendigungZuruecknehmen(b.ref, `${grund} (${req.agent!.name}, Gespräch)`);
    await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = NULL, kuendigung_bestaetigt_mail_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`.catch(() => {});
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${b.ref}, ${b.personId}, ${req.agent!.id}, ${req.agent!.name}, 'system',
              ${`Kündigung im Gespräch zurückgenommen durch ${req.agent!.name} — Konto läuft weiter, ${erg.ratenZurueck} Rate(n) wieder offen. ${grund.slice(0, 200)}`}, NOW())`.catch(() => {});
    res.json({ ok: true, ratenZurueck: erg.ratenZurueck, meldung: `Kündigung zurückgenommen — das Konto läuft weiter${erg.ratenZurueck ? `, ${erg.ratenZurueck} Rate(n) wieder offen` : ""}.` });
  } catch (e: any) {
    console.error("[KÜNDIGUNG] agent zurücknehmen:", e);
    res.status(500).json({ ok: false, error: "Serverfehler" });
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
