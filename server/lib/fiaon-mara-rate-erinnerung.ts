// ═══════════════════════════════════════════════════════════════════════════
// MARA-INKASSO, ERSTE STUFE — DER SERVER HANDELT (19.10.2026, E-406 B1)
//
// Justin (19.10.2026, Vorschlag 3): „Mara erinnert freundlich und bietet einen Termin an … höchstens 3 Kontakte je
// Rate.“ Die Regel (wer, wann, wie oft) steht rein in shared/fiaon-mara-rate-erinnerung.ts — mit der Karte, was eine
// fällige Rate heute schon bekommt, und den Messungen. Hier:
//
//   1. VORMERKEN — jeder Takt merkt jede offene Rate einer bezahlten Bestellung vor, die seit 1–3 Tagen fällig ist
//      (ein Merker je Rate, PRIMARY KEY rate_id — „nie doppelt“). Auch wer gleich ausgelassen wird, bekommt einen
//      Merker mit Grund: So sieht Justin im Steuerpult, WARUM Mara jemandem nicht schrieb.
//   2. SENDEN — der Takt (routes.ts, tageslauf „mara_rate_erinnerung“, alle 10 Min.) nimmt fällige Merker atomar
//      (FOR UPDATE SKIP LOCKED), liest die Fakten frisch, fragt die Regel und verschickt über den einen Weg des Hauses
//      (versendenUndProtokollieren → Tür in make-webhook.ts: Adresse, Global-Wand, Werbesperre-Regel der Zahlungspost,
//      hart unzustellbar, Protokoll, Verlaufseintrag in der Akte). Vor dem Versand wird der fertige Text geprüft
//      (E-393-Sendesperre, Wortwand, keine Mahn-/Droh-/Verkaufswörter, KI-Offenlegung) — fällt er durch, geht nichts raus.
//
// WAS HIER NIE PASSIERT (E-182 „Bremse aus“): Abo-Motor, Mahnmotor, WhatsApp-Zentrale und Inkasso von Hand werden
// weder gebremst noch verschoben — diese Datei schreibt KEINE Spalte an fiaon_abo_raten (letzte_erinnerung_at bliebe
// sonst als 20-Stunden-Sperre für die nächste Mahnung stehen). Mara richtet sich nach ihnen, nie umgekehrt.
// Geld bucht Mara nie; eine Antwort des Kunden läuft über Mail-Mara (Postfach) mit ihren bestehenden Werkzeugen.
//
// Wirft nie nach außen: Fehler stehen im Server-Log und im Merker.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { ERINNERBARE_BESTELLUNG_SQL, FORDERUNG_AKTIV_SQL_FUER, RATE_NACH_ENDE_SQL_FUER } from "./fiaon-raten-storno";
import { KEIN_ABO_SQL } from "./fiaon-kein-abo";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "@shared/fiaon-kuendigung-regel";
import {
  GRUND, HOECHSTENS_KONTAKTE, KONTAKT_VORLAUF_TAGE, RATE_ERINNERUNG_EVENT, RATE_ERINNERUNG_HERKUNFT, RATE_ERINNERUNG_SCHALTER,
  TAGE_AB, TAGE_BIS, berlinTag, rateErinnerungUrteil, schalterAn, tagDanach, textPruefen, wannText,
  type RateErinnerungFakten, type RateErinnerungUrteil,
} from "@shared/fiaon-mara-rate-erinnerung";

type Lauf = any;
export const RATE_ERINNERUNG_TABELLE = "fiaon_mara_rate_erinnerung";

/** Merker-Zustände. vorgemerkt/in_arbeit sind offen, alle anderen abgeschlossen. */
export type MerkerStatus =
  | "vorgemerkt" | "in_arbeit" | "versandt" | "fehlgeschlagen" | "ohne_mail"
  | "ausgelassen" | "erledigt" | "verfallen" | "unklar";

let tabelleBereit: Promise<boolean> | null = null;
/**
 * Die Merker-Tabelle beim ersten Gebrauch anlegen — über den GLOBALEN Pool und mit kurzer Sperrfrist (AGENTS.md,
 * Falle 1). Eine NEUE Tabelle sperrt nichts Bestehendes. Scheitert das Anlegen, fällt nur diese Automatik aus.
 */
export function merkerTabelle(): Promise<boolean> {
  if (!tabelleBereit) {
    tabelleBereit = (async () => {
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          CREATE TABLE IF NOT EXISTS fiaon_mara_rate_erinnerung (
            rate_id INTEGER PRIMARY KEY,
            person_id INTEGER,
            ref TEXT,
            rate_nr INTEGER,
            betrag_cents INTEGER,
            faellig_am DATE,
            vorgemerkt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            status TEXT NOT NULL,
            grund TEXT,
            nicht_vor TIMESTAMPTZ,
            bearbeitet_am TIMESTAMPTZ,
            erledigt_am TIMESTAMPTZ,
            versandt_am TIMESTAMPTZ,
            kontakte INTEGER
          )`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_rate_erinnerung_offen ON fiaon_mara_rate_erinnerung (status, nicht_vor)`;
        await tx`CREATE INDEX IF NOT EXISTS fiaon_mara_rate_erinnerung_versandt ON fiaon_mara_rate_erinnerung (versandt_am)`;
      });
      return true;
    })().catch((e) => {
      console.error("[MARA-RATE] Merker-Tabelle nicht bereit — die erste Stufe ruht:", e?.message || e);
      tabelleBereit = null;
      return false;
    });
  }
  return tabelleBereit;
}

/** Der Schalter (fiaon_settings.mara_rate_erinnerung). Fehlt er: AN. Lesefehler: AUS (lieber keine Mail). */
export async function schalterLesen(lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${RATE_ERINNERUNG_SCHALTER}`) as any[];
    return schalterAn(z?.value);
  } catch (e) {
    console.error("[MARA-RATE] Schalter nicht lesbar — nichts senden:", e instanceof Error ? e.message : e);
    return false;
  }
}

export async function schalterSetzen(an: boolean): Promise<void> {
  const wert = an ? "an" : "aus";
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${RATE_ERINNERUNG_SCHALTER}, ${wert})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// ── DIE GRUNDMENGE: offene Raten bezahlter Bestellungen, seit 1–3 Tagen fällig (Berliner Tag) ──
// Nur die Bestellung muss eine Forderung tragen können (ERINNERBARE_BESTELLUNG_SQL, wie Mahnmotor und Inkasso);
// alles Weitere entscheidet die Regel MIT Grund — damit das Steuerpult zeigt, wer warum ausgelassen wurde.
const GRUNDMENGE_SQL = `
  SELECT r.id AS rate_id, a.person_id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
   WHERE r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
     AND a.person_id IS NOT NULL
     AND ${ERINNERBARE_BESTELLUNG_SQL("a")}
     AND r.faellig_am BETWEEN $1::date - ${TAGE_BIS} AND $1::date - ${TAGE_AB}
     AND NOT EXISTS (SELECT 1 FROM fiaon_mara_rate_erinnerung m WHERE m.rate_id = r.id)`;

/** Neue Merker anlegen (nie doppelt: PRIMARY KEY rate_id). Gibt die Zahl der neuen zurück. */
export async function vormerken(heute: string, lauf: Lauf = sqlPool): Promise<number> {
  const neu = (await lauf.unsafe(`
    INSERT INTO fiaon_mara_rate_erinnerung (rate_id, person_id, ref, rate_nr, betrag_cents, faellig_am, status)
    SELECT g.rate_id, g.person_id, g.ref, g.rate_nr, g.betrag_cents, g.faellig_am, 'vorgemerkt'
      FROM (${GRUNDMENGE_SQL} ORDER BY r.faellig_am DESC LIMIT 300) g
    ON CONFLICT (rate_id) DO NOTHING
    RETURNING rate_id`, [heute])) as any[];
  return neu.length;
}

// ── DIE FAKTEN ─────────────────────────────────────────────────────────────
/** Postfach-Lampen aus fiaon_postmeister.flags (jsonb, teils als JSON-Text) — dieselbe Lesart wie die Mara-Aktion. */
const lampe = (namen: string) => `flags::text ~ '(${namen})\\\\?"\\s*:\\s*true'`;

/** Alles, was die Regel über diese Rate wissen muss. Vorsichtig: Was nicht lesbar ist, schließt aus. */
export async function faktenLaden(rateId: number, heute: string, lauf: Lauf = sqlPool): Promise<{ fakten: RateErinnerungFakten; personId: number | null; ref: string | null; rateNr: number | null } | null> {
  const { mahnAbstandSql, MAHNSTUFEN } = await import("../routes/fiaon-abo");
  const { unzustellbarSql } = await import("./fiaon-empfaenger");
  const [z] = (await lauf.unsafe(`
    SELECT r.id, r.ref, r.rate_nr, r.faellig_am::text AS faellig, a.person_id,
           (r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS rate_offen,
           (${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL AND NOT ${KEIN_ABO_SQL}) AS bestellung_aktiv,
           ${FORDERUNG_AKTIV_SQL_FUER("a", "r")} AS forderung_aktiv,
           ${RATE_NACH_ENDE_SQL_FUER("a", "r")} AS nach_ende,
           ${KUENDIGUNG_UNGEBUCHT_SQL("a.person_id")} AS kuendigung_ungebucht,
           (a.gekuendigt_am IS NOT NULL AND a.kuendigung_zurueckgenommen_am IS NULL) AS kuendigung_gebucht,
           (a.mahnstopp_am IS NOT NULL AND a.mahnstopp_am > COALESCE((SELECT MIN(r1.bezahlt_am) FROM fiaon_abo_raten r1
              WHERE r1.ref = a.ref AND r1.status = 'bezahlt'), a.paid_at, a.created_at)) AS mahnstopp,
           EXISTS (SELECT 1 FROM fiaon_persons pt WHERE pt.id = a.person_id AND pt.ist_test_am IS NOT NULL) AS test_person,
           (r.eskaliert_am IS NOT NULL) AS eskaliert,
           -- Widerruf, Bestreiten, Anwalt, Rechtliches (Postfach, 90 Tage)
           EXISTS (SELECT 1 FROM fiaon_postmeister pw WHERE pw.person_id = a.person_id
                     AND COALESCE(pw.empfangen_am, pw.created_at) > NOW() - INTERVAL '90 days'
                     AND pw.${lampe("widerruf|bestreitet|droht_anwalt|rechtlich")}) AS widerruf,
           -- heikel in 30 Tagen: „kann nicht zahlen“, Beschwerde (Postfach) oder ein heikler Fall aus Mail/WhatsApp
           (EXISTS (SELECT 1 FROM fiaon_postmeister pe WHERE pe.person_id = a.person_id
                      AND COALESCE(pe.empfangen_am, pe.created_at) > NOW() - INTERVAL '30 days'
                      AND pe.${lampe("zahlungsunfaehig|beschwerde")})
            OR EXISTS (SELECT 1 FROM fiaon_betreiber_todos th WHERE th.person_id = a.person_id
                         AND th.art IN ('kuendigung', 'mara_wa_heikel', 'beschwerde', 'mara_mail_heikel')
                         AND th.created_at > NOW() - INTERVAL '30 days')) AS einwand,
           -- „habe bezahlt“ (Postfach, 14 Tage) oder ein Beleg im Inkasso (14 Tage)
           (EXISTS (SELECT 1 FROM fiaon_postmeister pz WHERE pz.person_id = a.person_id
                      AND COALESCE(pz.empfangen_am, pz.created_at) > NOW() - INTERVAL '14 days'
                      AND pz.${lampe("zahlung_behauptet")})
            OR EXISTS (SELECT 1 FROM fiaon_raten_arbeit ra WHERE ra.rate_id = r.id AND ra.ergebnis = 'ueberwiesen_beleg'
                         AND ra.created_at > NOW() - INTERVAL '14 days')) AS zahlung_gemeldet,
           -- ein passender, noch nicht verbuchter Eingang (dieselbe Lesart wie die WhatsApp-Zentrale, RATE_ERINNERBAR)
           EXISTS (SELECT 1 FROM fiaon_bank_txns t
                    WHERE t.applied = FALSE AND t.amount_cents > 0 AND t.booked_at > NOW() - INTERVAL '30 days'
                      AND (t.matched_ref = a.ref
                           OR UPPER(REGEXP_REPLACE(COALESCE(t.extracted_ref, ''), '[^A-Za-z0-9]', '', 'g'))
                              LIKE UPPER(REGEXP_REPLACE(COALESCE(a.payment_reference, a.ref), '[^A-Za-z0-9]', '', 'g')) || '%'
                           OR (LENGTH(TRIM(COALESCE(a.last_name, ''))) >= 4 AND t.payer_name ILIKE '%' || TRIM(a.last_name) || '%'))) AS eingang,
           (r.inkasso_zusage_am >= $2::date
            OR EXISTS (SELECT 1 FROM fiaon_persons pp WHERE pp.id = a.person_id AND pp.promised_payment_date >= $2::date)) AS zusage,
           (EXISTS (SELECT 1 FROM fiaon_termine tt WHERE tt.person_id = a.person_id AND tt.status = 'gebucht' AND tt.beginn > NOW())
            OR EXISTS (SELECT 1 FROM fiaon_contact_log cr
                        WHERE (cr.person_id = a.person_id OR cr.ref = a.ref)
                          AND cr.outcome = 'rueckruf_termin' AND cr.done_at IS NULL AND cr.voided_at IS NULL
                          AND cr.scheduled_at > NOW())) AS termin,
           -- KONTAKTE ZU DIESER RATE über alle Wege, ab KONTAKT_VORLAUF_TAGE Tagen vor der Fälligkeit — seit der Abnahme
           -- (19.10., Justin: „100 % auf Verkauf“) ist das 0: Die Zählung beginnt mit der Fälligkeit, die Vorabinfo vom
           -- Tag −3 zählt nicht. Raten-Mails (Abo-Motor, Mahnmotor, Inkasso von Hand, Sende-Menü — alle als
           -- abo_payment_reminder), Maras eigene, WhatsApp-Raten-Vorlagen (Zentrale) und Anrufe mit Ergebnis. Je Person
           -- gezählt: Hat er daneben eine ältere offene Rate, zählen deren Mahnungen mit — er ist dann kein frischer Fall.
           ((SELECT COUNT(*) FROM fiaon_mail_log m
              WHERE m.person_id = a.person_id AND m.event IN ('abo_payment_reminder', '${RATE_ERINNERUNG_EVENT}')
                AND m.status = 'versandt' AND COALESCE(m.art, 'echt') = 'echt'
                AND m.created_at >= (r.faellig_am - ${KONTAKT_VORLAUF_TAGE})::timestamp AT TIME ZONE 'Europe/Berlin')
            + (SELECT COUNT(*) FROM fiaon_whatsapp w
                WHERE w.person_id = a.person_id AND w.richtung = 'raus' AND COALESCE(w.status, '') <> 'fehler'
                  AND w.vorlage ~ '^fiaon_kkb?_rate(_v[0-9]+)?$'
                  AND w.created_at >= (r.faellig_am - ${KONTAKT_VORLAUF_TAGE})::timestamp AT TIME ZONE 'Europe/Berlin')
            + (SELECT COUNT(*) FROM fiaon_contact_log c
                WHERE (c.person_id = a.person_id OR c.ref = a.ref) AND c.type = 'result' AND c.voided_at IS NULL
                  AND c.created_at >= r.faellig_am::timestamp AT TIME ZONE 'Europe/Berlin'))::int AS kontakte,
           GREATEST(
             (SELECT MAX(wi.created_at) FROM fiaon_whatsapp wi WHERE wi.person_id = a.person_id AND wi.richtung = 'rein'),
             (SELECT MAX(COALESCE(pi.empfangen_am, pi.created_at)) FROM fiaon_postmeister pi WHERE pi.person_id = a.person_id),
             -- Integration E-406 Welle 1 (B1 × C1): auch ein Anliegen im Kundenbereich ist „er schreibt gerade selbst“.
             (SELECT MAX(ti.created_at) FROM fiaon_tickets ti WHERE ti.person_id = a.person_id)) AS kunde_schrieb,
           -- Heute (Berlin) schon Ratenpost: Rechnung/Mahnung (Mail), WhatsApp-Rate, oder ein Stempel an einer Rate des Vertrags.
           (EXISTS (SELECT 1 FROM fiaon_mail_log mh WHERE mh.person_id = a.person_id AND mh.event = 'abo_payment_reminder'
                      AND mh.status = 'versandt' AND COALESCE(mh.art, 'echt') = 'echt'
                      AND (mh.created_at AT TIME ZONE 'Europe/Berlin')::date = $2::date)
            OR EXISTS (SELECT 1 FROM fiaon_whatsapp wh WHERE wh.person_id = a.person_id AND wh.richtung = 'raus'
                         AND COALESCE(wh.status, '') <> 'fehler' AND wh.vorlage ~ '^fiaon_kkb?_rate(_v[0-9]+)?$'
                         AND (wh.created_at AT TIME ZONE 'Europe/Berlin')::date = $2::date)
            OR EXISTS (SELECT 1 FROM fiaon_abo_raten rh WHERE rh.ref = r.ref
                         AND ((rh.letzte_erinnerung_at AT TIME ZONE 'Europe/Berlin')::date = $2::date
                              OR (rh.vorab_am AT TIME ZONE 'Europe/Berlin')::date = $2::date))) AS heute_post,
           -- Ist der Abo-Motor heute mit DIESER Rate dran? Seine eigene Bedingung (faelligeRaten): Abstand der Mahnstufe
           -- erreicht, heute noch keine Erinnerung, heute kein Fehlversuch, Adresse nicht hart unzustellbar, Motor an.
           (COALESCE((SELECT value FROM fiaon_settings WHERE key = 'abo_motor_enabled'), '1') <> '0'
            AND r.mahnstufe < ${MAHNSTUFEN.length}
            AND ($2::date - r.faellig_am) >= ${mahnAbstandSql("r.mahnstufe")}
            AND (r.letzte_erinnerung_at IS NULL OR (r.letzte_erinnerung_at AT TIME ZONE 'Europe/Berlin')::date < $2::date)
            AND (r.letzter_fehler_at IS NULL OR (r.letzter_fehler_at AT TIME ZONE 'Europe/Berlin')::date < $2::date)
            AND NOT ${unzustellbarSql("a")}) AS motor_heute
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
     WHERE r.id = $1`, [rateId, heute])) as any[];
  if (!z) return null;
  const personId = z.person_id ? Number(z.person_id) : null;

  // Offene Entscheidungskarte bei Justin? Eigene Abfrage: Die Kartentabelle legt fiaon-mara-entscheidungen.ts erst beim
  // ersten Gebrauch an. Fehlt sie, gibt es keine Karte; scheitert die Abfrage sonst, gilt vorsichtig „Karte offen“.
  let karteOffen = false;
  if (personId) {
    karteOffen = await lauf`SELECT EXISTS (SELECT 1 FROM fiaon_mara_entscheidungen WHERE person_id = ${personId} AND status = 'offen') AS ja`
      .then((r: any[]) => r[0]?.ja === true)
      .catch(async () => {
        const [t] = (await lauf`SELECT to_regclass('fiaon_mara_entscheidungen') IS NOT NULL AS da`.catch(() => [{ da: true }])) as any[];
        return t?.da !== false;
      });
  }

  // Personen-Fakten über die bestehenden Regeln — über den Pool, ein Fehler dort kostet nur diese eine Mail.
  let globalKunde = true, vertriebssperre = true, testFamilie = true, hatEmail = false, kiPause = true;
  if (personId) {
    const { istGlobalKunde } = await import("./fiaon-global-kunde");
    const { menschSperre } = await import("./fiaon-mail-frequenz");
    const { hatZustellbareMail } = await import("./fiaon-empfaenger");
    const { kiPausiert } = await import("./fiaon-ki-pause");
    globalKunde = await istGlobalKunde(personId).catch(() => true);
    const s = await menschSperre(personId).catch(() => "fehler" as const);
    vertriebssperre = s === "fehler" ? true : !!s?.vertriebssperre;
    testFamilie = s === "fehler" ? true : !!s?.test;
    hatEmail = await hatZustellbareMail(personId).catch(() => false);
    kiPause = await kiPausiert().catch(() => true);
  }

  const fakten: RateErinnerungFakten = {
    rateOffen: z.rate_offen === true,
    faelligAm: String(z.faellig).slice(0, 10),
    bestellungAktiv: z.bestellung_aktiv === true,
    nachVertragsende: z.nach_ende === true,
    kuendigungUngebucht: z.kuendigung_ungebucht === true,
    kuendigungGebucht: z.kuendigung_gebucht === true,
    widerrufOderRecht: z.widerruf === true,
    mahnstopp: z.mahnstopp === true,
    testperson: z.test_person === true || testFamilie,
    globalKunde,
    vertriebssperre,
    eskaliert: z.eskaliert === true,
    karteOffen,
    einwand: z.einwand === true,
    zahlungGemeldet: z.zahlung_gemeldet === true,
    eingangPasst: z.eingang === true,
    zusageOffen: z.zusage === true,
    terminSteht: z.termin === true,
    hatEmail,
    kontakte: Number(z.kontakte || 0),
    letzteKundenNachrichtAm: z.kunde_schrieb ?? null,
    heuteRatenpost: z.heute_post === true,
    motorHeuteDran: z.motor_heute === true,
    kiPause,
  };
  // EINE Regel für „Forderung aktiv“ (E-391): Sagt FORDERUNG_AKTIV_SQL_FUER nein, ohne dass einer der Einzelgründe
  // oben es erklärt, gilt es trotzdem — als Mahnstopp-Fall, der vorsichtigste Grund mit derselben Wirkung.
  if (z.forderung_aktiv !== true && !fakten.nachVertragsende && !fakten.kuendigungUngebucht && !fakten.mahnstopp && !fakten.testperson) {
    fakten.mahnstopp = true;
  }
  return { fakten, personId, ref: z.ref ? String(z.ref) : null, rateNr: z.rate_nr != null ? Number(z.rate_nr) : null };
}

// ── DER TAKT ──────────────────────────────────────────────────────────────
export interface TaktErgebnis {
  aus: boolean;
  neu: number;
  versandt: number;
  fehlgeschlagen: number;
  ohneMail: number;
  ausgelassen: number;
  erledigt: number;
  wartet: number;
  verfallen: number;
  unklar: number;
}
const LEER = (): TaktErgebnis => ({ aus: false, neu: 0, versandt: 0, fehlgeschlagen: 0, ohneMail: 0, ausgelassen: 0, erledigt: 0, wartet: 0, verfallen: 0, unklar: 0 });
export const istBearbeitet = (e: TaktErgebnis) =>
  e.neu + e.versandt + e.fehlgeschlagen + e.ohneMail + e.ausgelassen + e.erledigt + e.verfallen + e.unklar > 0;

/** Den Merker abschließen (oder zurück auf „vorgemerkt“ mit neuem nicht_vor). */
async function merkerSetzen(rateId: number, status: MerkerStatus, grund: string | null, extra: { nichtVor?: Date | null; kontakte?: number | null } = {}): Promise<void> {
  const fertig = status !== "vorgemerkt" && status !== "in_arbeit";
  await sqlPool`
    UPDATE fiaon_mara_rate_erinnerung
       SET status = ${status}, grund = ${grund ? String(grund).slice(0, 500) : null}, nicht_vor = ${extra.nichtVor ?? null},
           erledigt_am = ${fertig ? new Date() : null},
           versandt_am = ${status === "versandt" ? new Date() : null},
           kontakte = COALESCE(${extra.kontakte ?? null}::int, kontakte)
     WHERE rate_id = ${rateId}`;
}

const eur = (cents: number) => (Number(cents || 0) / 100).toFixed(2).replace(".", ",");

/** Die Nutzlast: Person (Adresse, Anrede) und Terminlink aus sendePayloadBauen, die Rate aus aboErinnerungPayload. */
async function nutzlastBauen(rateId: number, personId: number): Promise<{ nutzlast: Record<string, unknown>; ref: string | null; rateNr: number; betragCents: number; faelligText: string } | { fehler: string }> {
  const { sendePayloadBauen } = await import("./fiaon-mail-senden");
  const g = await sendePayloadBauen(RATE_ERINNERUNG_EVENT, personId);
  if (!g || g.fehler) return { fehler: g?.fehler ?? "Kunde nicht gefunden" };
  // Dieselben Felder wie die Raten-Erinnerung des Abo-Motors (faelligeRaten → aboErinnerungPayload): EINE Rechnung für
  // Betrag, Ratenreferenz (Verwendungszweck) und Bankdaten — nie amount_due der Bestellung (E-173).
  const [r] = (await sqlPool`
    SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
           a.person_id, a.email, a.contact_email, a.billing_email, a.pack_name, a.amount_due, a.ref
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
     WHERE r.id = ${rateId}`) as any[];
  if (!r) return { fehler: "Rate nicht gefunden" };
  const { aboErinnerungPayload } = await import("../routes/fiaon-abo");
  const ausRate = aboErinnerungPayload(r) as Record<string, unknown>;
  const nutzlast: Record<string, unknown> = {
    ...g.basis, ...g.links,
    antrag_id: ausRate.antrag_id ?? (g.basis as any).antrag_id ?? r.ref,
    payment_reference: ausRate.payment_reference, verwendungszweck: ausRate.verwendungszweck,
    betrag: ausRate.betrag, rate_nr: ausRate.rate_nr, faellig_am: ausRate.faellig_am, faellig_am_text: ausRate.faellig_am_text,
    tage_ueberfaellig: ausRate.tage_ueberfaellig,
    empfaenger: ausRate.empfaenger, iban: ausRate.iban, bic: ausRate.bic,
    email: ausRate.email || (g.basis as any).email,
    person_id: personId,
  };
  return { nutzlast, ref: (r.ref as string) || g.ref, rateNr: Number(r.rate_nr), betragCents: Number(r.betrag_cents || 0), faelligText: String(ausRate.faellig_am_text ?? "") };
}

/** Einen genommenen Merker abarbeiten — Fakten frisch, die Regel, dann senden oder abschließen. */
async function einen(rateId: number, jetzt: Date, e: TaktErgebnis): Promise<void> {
  const geladen = await faktenLaden(rateId, berlinTag(jetzt));
  if (!geladen) { await merkerSetzen(rateId, "erledigt", "Rate nicht mehr da"); e.erledigt++; return; }
  const { fakten: f, personId } = geladen;
  const u: RateErinnerungUrteil = rateErinnerungUrteil(f, jetzt);
  if (u.art === "warten") { await merkerSetzen(rateId, "vorgemerkt", u.grund, { nichtVor: u.nichtVor, kontakte: f.kontakte }); e.wartet++; return; }
  if (u.art === "auslassen") {
    const status: MerkerStatus = u.grund === GRUND.keineMail ? "ohne_mail" : "ausgelassen";
    await merkerSetzen(rateId, status, u.grund, { kontakte: f.kontakte });
    if (status === "ohne_mail") e.ohneMail++; else e.ausgelassen++;
    return;
  }
  if (u.art === "erledigt") { await merkerSetzen(rateId, "erledigt", u.grund, { kontakte: f.kontakte }); e.erledigt++; return; }
  if (u.art === "verfallen") { await merkerSetzen(rateId, "verfallen", u.grund, { kontakte: f.kontakte }); e.verfallen++; return; }
  if (!personId) { await merkerSetzen(rateId, "fehlgeschlagen", "Keine Person an der Bestellung"); e.fehlgeschlagen++; return; }

  // ── SENDEN ──
  const b = await nutzlastBauen(rateId, personId);
  if ("fehler" in b) { await merkerSetzen(rateId, "fehlgeschlagen", b.fehler, { kontakte: f.kontakte }); e.fehlgeschlagen++; return; }
  // Der fertige Text wird geprüft, bevor er rausgeht — fällt er durch, geht NICHTS raus (E-393-Sendesperre & Co.).
  const { mailRendern } = await import("../mail/motor");
  const m = mailRendern(RATE_ERINNERUNG_EVENT, b.nutzlast);
  const pflicht = ["termin_link", "verwendungszweck", "betrag", "faellig_am_text"].filter((k) => m?.fehlend.includes(k));
  if (!m || pflicht.length || m.knopfEntfallen) {
    await merkerSetzen(rateId, "fehlgeschlagen", !m ? "Vorlage fehlt" : `Pflichtfeld fehlt: ${[...pflicht, ...m.entfalleneKnoepfe.map((k) => k.platzhalter)].join(", ")}`, { kontakte: f.kontakte });
    e.fehlgeschlagen++;
    return;
  }
  const probleme = textPruefen(`${m.betreff}\n\n${m.text}`);
  if (probleme.length) {
    await merkerSetzen(rateId, "fehlgeschlagen", `Textprüfung: ${probleme.join(" · ")}`, { kontakte: f.kontakte });
    e.fehlgeschlagen++;
    return;
  }
  const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
  const verlaufText = `Mara: freundliche Mail zur Rate ${b.rateNr} (${eur(b.betragCents)} €, fällig ${b.faelligText}) — `
    + "zahlen, kurz antworten oder Rückruf wählen. Keine Mahnung; der Abo-Motor erinnert wie gewohnt weiter.";
  const erg = await versendenUndProtokollieren(RATE_ERINNERUNG_EVENT as any, b.nutzlast as any, { personId, verlaufRef: b.ref, verlaufText });
  if (erg.status === "versandt") { await merkerSetzen(rateId, "versandt", null, { kontakte: f.kontakte }); e.versandt++; return; }
  if (erg.status === "uebersprungen") { await merkerSetzen(rateId, "ohne_mail", erg.grund ?? null, { kontakte: f.kontakte }); e.ohneMail++; return; }
  await merkerSetzen(rateId, "fehlgeschlagen", erg.grund ?? null, { kontakte: f.kontakte });
  e.fehlgeschlagen++;
}

/**
 * Der Takt (alle 10 Minuten, routes.ts): Hängengebliebenes → „unklar“ (nie erneut gesendet), über Tag 3 Wartendes →
 * „verfallen“, neue Raten vormerken, dann bis zu `hoechstens` fällige Merker prüfen und senden.
 */
export async function rateErinnerungTakt(opts: { jetzt?: Date; hoechstens?: number } = {}): Promise<TaktErgebnis> {
  const e = LEER();
  const jetzt = opts.jetzt ?? new Date();
  const heute = berlinTag(jetzt);
  if (!(await merkerTabelle())) return e;
  if (!(await schalterLesen())) { e.aus = true; return e; }
  // Ein Absturz mitten im Senden: lieber keine zweite Mail als eine doppelte.
  const haengt = (await sqlPool`
    UPDATE fiaon_mara_rate_erinnerung
       SET status = 'unklar', grund = 'Beim Senden unterbrochen — wird nicht wiederholt (nie doppelt)', erledigt_am = NOW()
     WHERE status = 'in_arbeit' AND bearbeitet_am < NOW() - INTERVAL '30 minutes'
    RETURNING rate_id`) as any[];
  e.unklar += haengt.length;
  const alt = (await sqlPool`
    UPDATE fiaon_mara_rate_erinnerung
       SET status = 'verfallen', grund = COALESCE(grund || ' · ', '') || ${GRUND.zuAlt}, erledigt_am = NOW()
     WHERE status = 'vorgemerkt' AND faellig_am < ${heute}::date - ${TAGE_BIS}::int
    RETURNING rate_id`) as any[];
  e.verfallen += alt.length;
  e.neu = await vormerken(heute);

  const n = Math.max(1, Math.min(100, Math.floor(opts.hoechstens ?? 30)));
  const faellig = (await sqlPool`
    UPDATE fiaon_mara_rate_erinnerung SET status = 'in_arbeit', bearbeitet_am = NOW()
     WHERE rate_id IN (
       SELECT rate_id FROM fiaon_mara_rate_erinnerung
        WHERE status = 'vorgemerkt' AND (nicht_vor IS NULL OR nicht_vor <= ${jetzt})
        ORDER BY faellig_am DESC, vorgemerkt_am
        LIMIT ${n}
        FOR UPDATE SKIP LOCKED)
    RETURNING rate_id`) as any[];
  for (const z of faellig) {
    const id = Number(z.rate_id);
    try {
      await einen(id, jetzt, e);
    } catch (err) {
      console.error(`[MARA-RATE] Rate ${id}:`, err instanceof Error ? err.message : err);
      await merkerSetzen(id, "fehlgeschlagen", `Fehler: ${err instanceof Error ? err.message : String(err)}`).catch(() => {});
      e.fehlgeschlagen++;
    }
  }
  if (istBearbeitet(e)) {
    console.log(`[MARA-RATE] Takt: ${e.neu} neu vorgemerkt, ${e.versandt} versandt, ${e.wartet} wartet, ${e.ausgelassen} ausgelassen, ${e.erledigt} erledigt, ${e.verfallen} verfallen, ${e.fehlgeschlagen} fehlgeschlagen.`);
  }
  return e;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER STAND FÜRS CHEFBÜRO (/chef/s/mara?reiter=mail, Karte „Raten: frisch fällig“)
// „Die tägliche Wirkung als Zahl: angeschrieben, danach bezahlt.“ Danach bezahlt = DIESE Rate ist gebucht, Eingangstag
// STRENG nach dem Tag der Mail, höchstens 14 Tage später (dieselbe Lesart wie Maras Bilanz, danachSql) — zeitliche
// Folge, kein Beweis. Termine: über den Link der Mail gebucht (Herkunft mara_rate_mail).
// ═══════════════════════════════════════════════════════════════════════════
export interface RateErinnerungStand {
  an: boolean;
  eingerichtet: boolean;
  heute: { angeschrieben: number; bezahlt: number };
  woche: { angeschrieben: number; bezahlt: number; bezahltCents: number; termine: number; ausgelassen: number; erledigt: number; fehlgeschlagen: number };
  /** Je Tag der letzten 7 (Berlin): angeschrieben und davon (bis heute) bezahlt — neuester zuerst. */
  tage: { tag: string; angeschrieben: number; bezahlt: number }[];
  wartet: number;
  naechste: string | null;
  gruende: { grund: string; n: number }[];
  hoechstensKontakte: number;
}

const BEZAHLT_DANACH = `(r.status = 'bezahlt' AND m.versandt_am IS NOT NULL
   AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date > (m.versandt_am AT TIME ZONE 'Europe/Berlin')::date
   AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date <= (m.versandt_am AT TIME ZONE 'Europe/Berlin')::date + 14)`;

export async function rateErinnerungStand(jetzt: Date = new Date()): Promise<RateErinnerungStand> {
  const an = await schalterLesen();
  const eingerichtet = await merkerTabelle();
  const leer: RateErinnerungStand = {
    an, eingerichtet, heute: { angeschrieben: 0, bezahlt: 0 },
    woche: { angeschrieben: 0, bezahlt: 0, bezahltCents: 0, termine: 0, ausgelassen: 0, erledigt: 0, fehlgeschlagen: 0 },
    tage: [], wartet: 0, naechste: null, gruende: [], hoechstensKontakte: HOECHSTENS_KONTAKTE,
  };
  if (!eingerichtet) return leer;
  const heute = berlinTag(jetzt);
  const [z] = (await sqlPool.unsafe(`
    SELECT
      COUNT(*) FILTER (WHERE m.status = 'versandt' AND (m.versandt_am AT TIME ZONE 'Europe/Berlin')::date = $1::date)::int AS heute,
      COUNT(*) FILTER (WHERE r.status = 'bezahlt' AND m.versandt_am IS NOT NULL AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date = $1::date
                         AND ${BEZAHLT_DANACH})::int AS heute_bezahlt,
      COUNT(*) FILTER (WHERE m.status = 'versandt' AND m.versandt_am > NOW() - INTERVAL '7 days')::int AS woche,
      COUNT(*) FILTER (WHERE m.status = 'versandt' AND m.versandt_am > NOW() - INTERVAL '7 days' AND ${BEZAHLT_DANACH})::int AS woche_bezahlt,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE m.status = 'versandt' AND m.versandt_am > NOW() - INTERVAL '7 days' AND ${BEZAHLT_DANACH}), 0)::bigint AS woche_cents,
      COUNT(*) FILTER (WHERE m.status IN ('ausgelassen', 'ohne_mail') AND m.erledigt_am > NOW() - INTERVAL '7 days')::int AS ausgelassen,
      COUNT(*) FILTER (WHERE m.status IN ('erledigt', 'verfallen') AND m.erledigt_am > NOW() - INTERVAL '7 days')::int AS erledigt,
      COUNT(*) FILTER (WHERE m.status IN ('fehlgeschlagen', 'unklar') AND m.erledigt_am > NOW() - INTERVAL '7 days')::int AS fehlgeschlagen,
      COUNT(*) FILTER (WHERE m.status IN ('vorgemerkt', 'in_arbeit'))::int AS wartet,
      MIN(m.nicht_vor) FILTER (WHERE m.status = 'vorgemerkt' AND m.nicht_vor > NOW()) AS naechste
    FROM fiaon_mara_rate_erinnerung m LEFT JOIN fiaon_abo_raten r ON r.id = m.rate_id`, [heute])) as any[];
  const tage = (await sqlPool.unsafe(`
    SELECT (m.versandt_am AT TIME ZONE 'Europe/Berlin')::date::text AS tag, COUNT(*)::int AS angeschrieben,
           COUNT(*) FILTER (WHERE ${BEZAHLT_DANACH})::int AS bezahlt
      FROM fiaon_mara_rate_erinnerung m LEFT JOIN fiaon_abo_raten r ON r.id = m.rate_id
     WHERE m.status = 'versandt' AND (m.versandt_am AT TIME ZONE 'Europe/Berlin')::date > $1::date - 7
     GROUP BY 1 ORDER BY 1 DESC`, [heute])) as any[];
  const [t] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine
     WHERE herkunft = ${RATE_ERINNERUNG_HERKUNFT} AND created_at > NOW() - INTERVAL '7 days'`.catch(() => [{ n: 0 }])) as any[];
  const gruende = (await sqlPool`
    SELECT grund, COUNT(*)::int AS n FROM fiaon_mara_rate_erinnerung
     WHERE status IN ('ausgelassen', 'ohne_mail', 'erledigt', 'verfallen') AND erledigt_am > NOW() - INTERVAL '7 days' AND grund IS NOT NULL
     GROUP BY grund ORDER BY n DESC LIMIT 5`) as any[];
  return {
    an, eingerichtet,
    heute: { angeschrieben: Number(z?.heute || 0), bezahlt: Number(z?.heute_bezahlt || 0) },
    woche: {
      angeschrieben: Number(z?.woche || 0), bezahlt: Number(z?.woche_bezahlt || 0), bezahltCents: Number(z?.woche_cents || 0),
      termine: Number(t?.n || 0), ausgelassen: Number(z?.ausgelassen || 0), erledigt: Number(z?.erledigt || 0),
      fehlgeschlagen: Number(z?.fehlgeschlagen || 0),
    },
    tage: tage.map((x: any) => ({ tag: String(x.tag), angeschrieben: Number(x.angeschrieben), bezahlt: Number(x.bezahlt) })),
    wartet: Number(z?.wartet || 0),
    naechste: z?.naechste ? wannText(new Date(z.naechste), jetzt) : null,
    gruende: gruende.map((r: any) => ({ grund: String(r.grund), n: Number(r.n) })),
    hoechstensKontakte: HOECHSTENS_KONTAKTE,
  };
}

// Für den Prüfstand: der Tag nach `heute` (re-export, damit er die Zeitlogik nicht nachbauen muss).
export { tagDanach };
