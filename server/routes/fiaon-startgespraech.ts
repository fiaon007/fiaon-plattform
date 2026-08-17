// ═══════════════════════════════════════════════════════════════════════════
// STARTGESPRÄCH — das Gate im Kundenportal
//
// Ein Mensch überweist 99,99 € im Monat und findet danach ein Konto vor, das
// er sich selbst erklären muss. Das Startgespräch schließt diese Lücke: 15
// Minuten, einmalig, mit einem Menschen.
//
// WARUM ES KEIN HARTES GATE IST
// „Später buchen" bleibt immer möglich. Einen zahlenden Kunden aus seinem
// eigenen Konto auszusperren, weil er gerade keinen Termin wählen will, wäre
// ein Eigentor: Er hat bezahlt, das Konto gehört ihm. Stattdessen bleibt ein
// dezenter Banner stehen, und 48 Stunden später kommt GENAU EINE Mail.
//
// DIE ZUGANGSFRAGE
// Das Kundenportal hat keine Server-Sitzung — der Browser hält die Anmeldung
// in `sessionStorage`, und die Seite kennt nur die Bestellreferenz. Diese
// Routen arbeiten deshalb mit der Referenz, genau wie die bereits vorhandene
// öffentliche Zahlungsseite (`/api/fiaon/payment-order/:paymentRef`). Sie
// geben ausschließlich preis, was auf dieser Seite ohnehin steht: Vorname und
// ob ein Startgespräch aussteht. Keine Beträge, keine Adressen, keine Historie.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { berlinDatumText, berlinUhrzeit, terminTokenErzeugen } from "../lib/fiaon-termine";
import { versendenUndProtokollieren } from "../lib/fiaon-mail-log";
import { terminLink } from "../lib/fiaon-termine";

const router = Router();

/** Stunden nach dem ersten „Später", bis die eine Erinnerung rausgeht. */
export const ERINNERUNG_STUNDEN = 48;

interface Lage {
  personId: number;
  vorname: string | null;
  bezahlt: boolean;
  termin: { beginn: string; datumText: string; uhrzeit: string; agentVorname: string } | null;
  erledigt: boolean;
  spaeterAm: string | null;
  /** Ist das Konto schon voll freigeschaltet? */
  vollAktiv: boolean;
  /** Gilt die HARTE Pflicht — buchen oder ausloggen, kein „Später"? */
  pflicht: boolean;
}

async function lageZu(ref: string): Promise<Lage | null> {
  const [row] = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name, a.first_name) AS vorname,
           p.startgespraech_spaeter_am,
           EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = p.id
                     AND x.merged_into IS NULL AND x.payment_status = 'paid') AS bezahlt,
           -- ── DIE KONTO-STUFE ────────────────────────────────────────────
           -- Über ALLE bezahlten Bestellungen dieses Menschen: Wer EINE voll
           -- aktive hat, ist voll aktiv. Eine Zweitbestellung darf einen
           -- freigeschalteten Kunden nicht zurück in den Wartezustand werfen.
           EXISTS (SELECT 1 FROM fiaon_applications x2 WHERE x2.person_id = p.id
                     AND x2.merged_into IS NULL AND x2.payment_status = 'paid'
                     AND x2.onboarding_stufe = 'voll_aktiv') AS voll_aktiv,
           -- Die HARTE Pflicht gilt, wenn sie an einer wartenden Bestellung
           -- gesetzt ist. Der Bestand hat sie nicht (siehe Migration 054).
           EXISTS (SELECT 1 FROM fiaon_applications x3 WHERE x3.person_id = p.id
                     AND x3.merged_into IS NULL AND x3.payment_status = 'paid'
                     AND x3.onboarding_stufe = 'wartet_auf_onboarding'
                     AND x3.onboarding_pflicht) AS pflicht
    FROM fiaon_applications a
    JOIN fiaon_persons p ON p.id = a.person_id
    WHERE (a.payment_reference = ${ref} OR a.ref = ${ref})
      AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
      AND p.merged_into_person_id IS NULL
    ORDER BY a.created_at DESC LIMIT 1
  `) as any[];
  if (!row) return null;

  const [termin] = (await sqlPool`
    SELECT t.beginn, COALESCE(NULLIF(ag.first_name, ''), ag.name) AS agent_vorname
    FROM fiaon_termine t LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.person_id = ${row.id} AND t.quelle = 'onboarding_call' AND t.status = 'gebucht'
      AND t.beginn > NOW()
    ORDER BY t.beginn ASC LIMIT 1
  `) as any[];

  const [erledigt] = (await sqlPool`
    SELECT 1 AS ok FROM fiaon_termine
    WHERE person_id = ${row.id} AND quelle = 'onboarding_call' AND status = 'erledigt' LIMIT 1
  `) as any[];

  return {
    personId: Number(row.id),
    vorname: row.vorname || null,
    bezahlt: !!row.bezahlt,
    termin: termin
      ? {
          beginn: termin.beginn,
          datumText: berlinDatumText(termin.beginn),
          uhrzeit: berlinUhrzeit(termin.beginn),
          agentVorname: String(termin.agent_vorname || "dein Ansprechpartner"),
        }
      : null,
    erledigt: !!erledigt,
    spaeterAm: row.startgespraech_spaeter_am || null,
    vollAktiv: !!row.voll_aktiv,
    pflicht: !!row.pflicht,
  };
}

/**
 * GET /kunde/:ref/startgespraech
 *
 * Sagt der Portalseite, ob das Gate zu zeigen ist. Drei Ausgänge:
 *   faellig     bezahlt, kein Termin, nichts erledigt → Vollbild-Tafel
 *   banner      dasselbe, aber schon einmal weggeklickt → dezente Zeile
 *   nichts      unbezahlt, gebucht oder erledigt
 */
router.get("/kunde/:ref/startgespraech", async (req: Request, res: Response) => {
  try {
    const lage = await lageZu(String(req.params.ref));
    if (!lage) return res.json({ ok: true, faellig: false, banner: false, termin: null });

    // Nur bezahlte Kunden. Wer noch nicht gezahlt hat, wird zur Zahlung geführt
    // und nicht zusätzlich zu einem Termin — zwei Aufforderungen auf einmal
    // beantwortet niemand.
    const offen = lage.bezahlt && !lage.termin && !lage.erledigt;

    // ══════════════════════════════════════════════════════════════════════
    // PFLICHT FÜR NEUE, BANNER FÜR DEN BESTAND
    //
    // ── DIE ENTSCHEIDUNG UND IHRE ZAHL ────────────────────────────────────
    // GEMESSEN am 16.08.2026: 349 bezahlte Paketkunden — und **null** mit
    // einem Startgespräch. Es gab in der ganzen Datenbank keinen einzigen
    // Termin der Quelle „onboarding_call".
    //
    // Eine harte Pflicht für alle hätte also am Tag des Deploys 349 ZAHLENDE
    // Kunden vor eine verschlossene Tür gestellt, mit der Aufforderung zu
    // einem Gespräch, für das es noch kein Team-Verfahren gab. Das ist
    // Support-Feuer, kein Onboarding.
    //
    // Deshalb:
    //   NEU aktiviert (`onboarding_pflicht`) → `pflicht: true`, kein „Später".
    //   BESTAND                              → Banner und Einladung, Zugang
    //                                          bleibt. Der Betreiber kann die
    //                                          Härte pro Fall über die Akte
    //                                          setzen.
    // ══════════════════════════════════════════════════════════════════════
    const pflicht = offen && lage.pflicht;
    res.json({
      ok: true,
      // Bei Pflicht bleibt die Tafel stehen, auch wenn schon „Später" geklickt
      // wurde: Ein „Später" von gestern hebt eine Pflicht von heute nicht auf.
      faellig: offen && (pflicht || !lage.spaeterAm),
      banner: offen && !pflicht && !!lage.spaeterAm,
      pflicht,
      vorname: lage.vorname,
      termin: lage.termin,
      erledigt: lage.erledigt,
      vollAktiv: lage.vollAktiv,
      // Das Buchungs-Token wird NUR mitgegeben, wenn wirklich etwas ansteht.
      token: offen ? terminTokenErzeugen(lage.personId) : null,
    });
  } catch (err) {
    console.error("[STARTGESPRAECH] lage:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** POST /kunde/:ref/startgespraech/spaeter — die Tafel wegklicken. */
router.post("/kunde/:ref/startgespraech/spaeter", async (req: Request, res: Response) => {
  try {
    const lage = await lageZu(String(req.params.ref));
    if (!lage) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    // ── BEI PFLICHT GIBT ES KEIN „SPÄTER" ────────────────────────────────
    // Die Wand steht im SERVER, nicht in der Oberfläche. Ein Knopf, den man
    // in der Konsole nachbauen kann, ist keine Pflicht, sondern eine Bitte.
    if (lage.pflicht && !lage.termin && !lage.erledigt) {
      return res.status(403).json({
        ok: false,
        pflicht: true,
        error: "Das Startgespräch ist Voraussetzung für die Freischaltung. "
          + "Bitte wähle einen Termin — es dauert 15 Minuten.",
      });
    }
    // COALESCE: Der ERSTE Klick zählt. Sonst schöbe jeder weitere Besuch die
    // 48-Stunden-Uhr nach hinten, und die Erinnerung käme nie.
    await sqlPool`
      UPDATE fiaon_persons
      SET startgespraech_spaeter_am = COALESCE(startgespraech_spaeter_am, NOW()), updated_at = NOW()
      WHERE id = ${lage.personId}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[STARTGESPRAECH] spaeter:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Der Tageslauf: genau EINE Einladung, 48 Stunden nach dem ersten „Später".
 *
 * Idempotent über `startgespraech_mail_am`. Ohne Make-Kanal läuft nichts —
 * dieselbe Bremse wie beim Wiedereinstieg (Vorfall vom 08.08.2026: 26 Kunden
 * als angeschrieben markiert, null Mails versandt).
 */
export async function runStartgespraechEinladungen(): Promise<number> {
  if (!process.env.MAKE_WEBHOOK_URL) return 0;

  const faellig = (await sqlPool`
    SELECT p.id, COALESCE(NULLIF(p.first_name, ''), p.contact_name) AS vorname,
           COALESCE(NULLIF(p.primary_email, ''), (
             SELECT NULLIF(COALESCE(a.email, a.contact_email, a.billing_email), '')
             FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL
             ORDER BY a.created_at DESC LIMIT 1)) AS email,
           (SELECT a2.ref FROM fiaon_applications a2
             WHERE a2.person_id = p.id AND a2.merged_into IS NULL AND a2.archived_at IS NULL
             ORDER BY a2.created_at DESC LIMIT 1) AS ref
    FROM fiaon_persons p
    WHERE p.merged_into_person_id IS NULL
      AND p.startgespraech_spaeter_am IS NOT NULL
      AND p.startgespraech_mail_am IS NULL
      AND p.startgespraech_spaeter_am < NOW() - (${ERINNERUNG_STUNDEN} || ' hours')::interval
      AND NOT p.is_blocked
      AND EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = p.id
                    AND x.merged_into IS NULL AND x.payment_status = 'paid')
      AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = p.id
                        AND t.quelle = 'onboarding_call'
                        AND (t.status = 'erledigt' OR (t.status = 'gebucht' AND t.beginn > NOW())))
    LIMIT 100
  `) as any[];

  let versandt = 0;
  for (const p of faellig) {
    const erg = await versendenUndProtokollieren(
      "onboarding_einladung",
      {
        email: String(p.email || ""),
        vorname: p.vorname || null,
        termin_link: terminLink(Number(p.id), "onboarding_call"),
      },
      {
        personId: Number(p.id), verlaufRef: p.ref || null,
        verlaufText: "Einladung zum Startgespräch versandt (48 Stunden nach dem Überspringen).",
      },
    );
    // Auch bei Fehlschlag markieren — sonst versucht es der Lauf morgen erneut
    // und füllt das Protokoll mit derselben Meldung. Der Fehlschlag steht
    // sichtbar in der Akte. Bei fehlender E-Mail wird NICHT markiert: Da kann
    // eine Adresse nachgetragen werden und die Einladung soll dann greifen.
    if (erg.status !== "uebersprungen") {
      await sqlPool`UPDATE fiaon_persons SET startgespraech_mail_am = NOW() WHERE id = ${p.id}`;
    }
    if (erg.status === "versandt") versandt++;
  }
  if (versandt) console.log(`[STARTGESPRAECH] Einladungen versandt: ${versandt}/${faellig.length}`);
  return versandt;
}

/**
 * Unerledigte Termine der Vergangenheit auf „verpasst" setzen.
 *
 * WICHTIG: Das ist ein INTERNER Vorgang. Er schreibt bewusst KEINEN
 * Verlaufseintrag und erhöht KEINEN Zähler — die Falle aus dem letzten Paket
 * (dreimal getroffen: `assigned_at`, Systemnotiz, toter Kanal). Ein Termin,
 * den niemand dokumentiert hat, ist ein vergessener Termin, kein
 * Kundenkontakt. Wer ihn wirklich als „nicht erschienen" wertet, tut das im
 * Onboarding-Bereich mit einem Klick — und DANN zählt es.
 */
export async function runVerpassteTermine(): Promise<number> {
  const rows = (await sqlPool`
    UPDATE fiaon_termine SET status = 'verpasst', updated_at = NOW()
    WHERE status = 'gebucht' AND beginn < NOW() - INTERVAL '12 hours'
    RETURNING id
  `) as any[];
  if (rows.length) console.log(`[STARTGESPRAECH] ${rows.length} unerledigte Termine als verpasst markiert`);
  return rows.length;
}

export default router;
