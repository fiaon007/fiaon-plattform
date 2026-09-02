// ═══════════════════════════════════════════════════════════════════════════
// BANKWECHSEL — Kunden über die neue Bankverbindung informieren (02.09.2026)
//
// DER ANLASS: Das Wise-Konto wurde am 02.09.2026 morgens gesperrt. Jede
// Zahlungs-Mail der letzten 24 Stunden nannte noch die alte IBAN. Wer jetzt
// dorthin überweist, schickt Geld auf ein gesperrtes Konto.
//
// WAS DIESER ENDPUNKT TUT: Er sucht jede Adresse, die in den letzten
// `stunden` (Standard 24) eine Mail MIT Bankdaten bekommen hat (Startzahlung,
// Rate, Zahlungsdaten, Zahlungsmeldung, Lastschrift-Einladung, Rückholung),
// und schickt genau EINE Mail „Neue Bankverbindung" je Adresse — mit ihrem
// Verwendungszweck, über die eine Versand-Tür (sendMakeWebhookMitGrund).
// Die Mail steht in PFLICHTMAILS: Die Frequenzbremse darf sie nicht stoppen.
//
// `senden: false` (Standard) = nur zählen und die Liste zeigen. Erst
// `senden: true` verschickt. Doppelte Sendungen verhindert das Mail-Log:
// Wer bankverbindung_neu schon bekommen hat, bekommt sie nicht noch einmal.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { BANK, BANK_ALT_GESPERRT } from "@shared/fiaon-bank";

const router = Router();

/** Ereignisse, deren Mails Bankdaten enthalten. */
const BANK_EREIGNISSE = [
  "payment_details", "payment_reminder", "abo_payment_reminder", "claim_received",
  "sepa_einrichten", "rueckhol_s1", "rueckhol_s2", "rueckhol_s3", "rueckhol_s4", "rueckhol_s5",
  "schufa_requested", "abo_rate_faellig", "abo_rate_erinnerung", "rechnung",
];

async function betroffene(stunden: number): Promise<any[]> {
  return (await sqlPool`
    WITH roh AS (
      -- Das Log speichert die Nutzlast als JSON-Text IN einem JSON-String
      -- (doppelt kodiert). Erst auspacken, dann lesen.
      SELECT m.*, CASE WHEN jsonb_typeof(m.payload::jsonb) = 'string'
                       THEN (m.payload::jsonb #>> '{}')::jsonb
                       ELSE m.payload::jsonb END AS nutzlast
      FROM fiaon_mail_log m
      WHERE m.created_at > NOW() - (${stunden} || ' hours')::interval
        AND m.status = 'versandt' AND m.art = 'echt'
        AND m.event = ANY(${BANK_EREIGNISSE})
    ), letzte AS (
      SELECT DISTINCT ON (LOWER(m.empfaenger))
             LOWER(m.empfaenger) AS email, m.event, m.created_at, m.person_id,
             m.nutzlast ->> 'payment_reference' AS zahlungsreferenz_mail,
             m.nutzlast ->> 'antrag_id' AS ref_mail
      FROM roh m
      WHERE m.created_at > NOW() - (${stunden} || ' hours')::interval
        AND m.status = 'versandt' AND m.art = 'echt'
        AND m.event = ANY(${BANK_EREIGNISSE})
        AND m.empfaenger ~ '^[^@\\s]+@[^@\\s]+\\.[A-Za-z]{2,}$'
      ORDER BY LOWER(m.empfaenger), m.created_at DESC
    )
    SELECT l.email, l.event AS letztes_ereignis, l.created_at AS letzte_mail,
           a.ref, a.payment_reference, a.first_name, a.last_name, a.contact_name,
           a.pack_name, a.amount_due, a.payment_status, a.person_id
    FROM letzte l
    LEFT JOIN LATERAL (
      SELECT a2.* FROM fiaon_applications a2
      WHERE a2.merged_into IS NULL
        AND (a2.ref = l.ref_mail OR a2.payment_reference = l.zahlungsreferenz_mail
             OR LOWER(a2.email) = l.email)
      ORDER BY (a2.ref = l.ref_mail) DESC, (a2.payment_status <> 'paid') DESC, a2.created_at DESC
      LIMIT 1
    ) a ON TRUE
    WHERE NOT EXISTS (
      -- Sperre über Adresse UND Person: Die Versand-Tür schickt an die aktuelle
      -- Adresse der Person, die vom alten Log-Eintrag abweichen kann (Lehre
      -- 02.09.: drei Personen bekamen die Mail je fünfmal, weil nur die
      -- Adresse verglichen wurde).
      SELECT 1 FROM fiaon_mail_log x
      WHERE x.event = 'bankverbindung_neu'
        AND (LOWER(x.empfaenger) = l.email
             OR (x.person_id IS NOT NULL AND x.person_id = COALESCE(l.person_id, a.person_id)))
        AND x.created_at > NOW() - INTERVAL '7 days'
    )
    ORDER BY l.created_at DESC
  `) as any[];
}

router.post("/admin/bankwechsel/informieren", async (req: Request, res: Response) => {
  try {
    const stunden = Math.min(168, Math.max(1, Number(req.body?.stunden) || 24));
    const senden = req.body?.senden === true;
    const deckel = Math.min(2000, Math.max(1, Number(req.body?.deckel) || 2000));
    const liste = await betroffene(stunden);

    if (!senden) {
      const jeEreignis: Record<string, number> = {};
      for (const z of liste) jeEreignis[z.letztes_ereignis] = (jeEreignis[z.letztes_ereignis] || 0) + 1;
      return res.json({
        ok: true, vorschau: true, stunden, betroffene: liste.length, jeEreignis,
        ohneAkte: liste.filter((z) => !z.ref).length,
        beispiele: liste.slice(0, 8).map((z) => ({ email: z.email, ereignis: z.letztes_ereignis, ref: z.payment_reference, status: z.payment_status })),
      });
    }

    const { sendMakeWebhookMitGrund, makePayloadFromRow } = await import("../make-webhook");
    let gesendet = 0, fehler = 0;
    for (const z of liste.slice(0, deckel)) {
      try {
        const basis = z.ref ? makePayloadFromRow({
          ref: z.ref, person_id: z.person_id, email: z.email, first_name: z.first_name,
          last_name: z.last_name, contact_name: z.contact_name, payment_reference: z.payment_reference,
          amount_due: z.amount_due, pack_name: z.pack_name,
        } as any) : { email: z.email, vorname: "", nachname: "", antrag_id: null, payment_reference: null } as any;
        const erg: any = await sendMakeWebhookMitGrund("bankverbindung_neu", {
          ...basis,
          email: z.email,
          empfaenger: BANK.empfaenger, iban: BANK.ibanDisplay, bic: BANK.bic, bank: BANK.bank,
          alte_iban: BANK_ALT_GESPERRT.ibanDisplay,
          verwendungszweck: z.payment_reference || "Ihre Zahlungsreferenz aus unserer letzten E-Mail",
          betrag: z.amount_due != null ? String(z.amount_due) : null,
          paket: z.pack_name ? String(z.pack_name).split("\n")[0] : null,
        } as any);
        if (erg === false) fehler += 1; else gesendet += 1;
      } catch (e) {
        fehler += 1;
        console.error("[BANKWECHSEL] Versand:", z.email, String(e).slice(0, 140));
      }
    }
    console.log(`[BANKWECHSEL] Information verschickt: ${gesendet} gesendet, ${fehler} Fehler (von ${liste.length})`);
    res.json({ ok: true, vorschau: false, stunden, betroffene: liste.length, gesendet, fehler });
  } catch (e: any) {
    console.error("[BANKWECHSEL]", e);
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

export default router;
