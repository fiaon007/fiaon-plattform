// ═══════════════════════════════════════════════════════════════════════════
// FIAON ABO — die monatliche Paketrate
//
// Das Geschäft ist ein Abonnement: Der Kunde zahlt sein Paket MONATLICH
// (Starter 7,99 · Pro 59,99 · Ultra 79,99 · High End 99,99 …). Bisher kannte das
// System nur die ERSTE Zahlung — danach war der Kunde „bezahlt“ und niemand
// wusste, wann wieder Geld kommen muss. Genau das ist der laufende Umsatz.
//
// DIE REGELN (bewusst hier dokumentiert, weil sie Geld betreffen)
//
//  1. Fälligkeit: 30 Tage nach dem Tag, an dem die Zahlung GEBUCHT wurde
//     (payment_status = 'paid'). Danach alle 30 Tage.
//  2. Betrag: der Paketpreis, den der Kunde bezahlt hat (amount_due).
//  3. Der Bonitäts-Check (74 €) ist KEIN Abo — Einmalkauf, erzeugt keine Rate.
//  4. Referenz je Rate: Zahlungsreferenz der Bestellung + „-<Ratennummer>",
//     also FIAON-A1B2C3-2 für die zweite Rate. Damit ist jede Überweisung im
//     Verwendungszweck eindeutig einer Rate zuzuordnen — ohne diesen Zusatz
//     landen zwölf Zahlungen im Jahr auf derselben Referenz.
//  5. Es steht immer nur EINE offene Rate pro Kunde im Raum. Die nächste
//     entsteht erst, wenn die aktuelle bezahlt ist. So kann sich kein
//     Schuldenberg aufbauen, den niemand entschieden hat.
//  6. Mahnstufen: Erinnerung am Fälligkeitstag (Stufe 1), nach 7 Tagen
//     (Stufe 2), nach 14 Tagen (Stufe 3). Danach KEINE weitere Mail, sondern
//     ein Punkt „Entscheidung nötig“ für den Betreiber. Es wird NIEMALS
//     automatisch ein Konto gesperrt oder deaktiviert.
//
// BESTANDSKUNDEN (Einführung)
//     Für die bereits bezahlten Bestellungen wird die NÄCHSTE künftige Rate
//     angelegt — nicht die längst verstrichenen. Begründung: für Monate, die
//     wir nie in Rechnung gestellt haben, kann man niemanden mahnen. Wer das
//     anders will, kann die rückwirkenden Raten bewusst anlegen
//     (POST /admin/abo/nachziehen mit rueckwirkend=true) — mit Vorschau, wie
//     viele Mahnungen das auslöst.
//
// AUTOMATIK
//     Der Motor läuft stündlich, versendet aber nur im harten Fenster
//     08–20 Uhr Berlin, höchstens eine Mail je Rate pro 20 Stunden und
//     maximal ABO_BATCH pro Lauf. Not-Aus: Einstellung `abo_motor_enabled`.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response } from "express";
import { sqlPool } from "../lib/db-pool";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { berlinToday } from "../lib/fiaon-time";
import { FIAON_BANK_DETAILS } from "./fiaon-antrag";
import { getSettings, setSetting } from "./fiaon-agent";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();

/** Zykluslänge in Tagen. Bewusst 30 Tage und nicht „Monatserster“: der Kunde
 *  hat an seinem Tag bezahlt, und an seinem Tag ist wieder fällig. */
export const ABO_ZYKLUS_TAGE = 30;
/** Mahnstufen: Tage nach Fälligkeit, an denen die jeweilige Stufe rausgeht. */
export const MAHNSTUFEN = [0, 7, 14] as const;
const ABO_BATCH = 40;

let tabelleGeprueft = false;

export async function ensureAboTabellen(): Promise<void> {
  if (tabelleGeprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_abo_raten (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      rate_nr INTEGER NOT NULL,
      zahlungsreferenz VARCHAR NOT NULL,
      betrag_cents INTEGER NOT NULL,
      faellig_am DATE NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'offen',
      bezahlt_am TIMESTAMPTZ,
      mahnstufe INTEGER NOT NULL DEFAULT 0,
      erinnerungen INTEGER NOT NULL DEFAULT 0,
      letzte_erinnerung_at TIMESTAMPTZ,
      quelle VARCHAR NOT NULL DEFAULT 'auto',
      notiz TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (ref, rate_nr)
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_abo_raten_faellig_idx ON fiaon_abo_raten (status, faellig_am)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_abo_raten_ref_idx ON fiaon_abo_raten (ref)`;
  // Abo-Stopp am Antrag: Kündigung/Pause hält die Kette an, ohne Daten zu löschen.
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS abo_gestoppt_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS abo_stopp_grund TEXT
  `;
  tabelleGeprueft = true;
}

// ── Was ist überhaupt ein Abo? ───────────────────────────────────────────────
/** Der Bonitäts-Check ist ein Einmalkauf — Paketname oder 74-€-Betrag verraten ihn. */
function istBonitaetsCheck(app: { pack_name?: string | null; amount_due?: any }): boolean {
  const paket = String(app.pack_name || "").toLowerCase();
  if (paket.includes("schufa") || paket.includes("bonität") || paket.includes("bonitaet")) return true;
  return Math.round(Number(app.amount_due || 0) * 100) === 7400;
}

function cents(v: any): number {
  return Math.round(Number(v || 0) * 100);
}

/** Datum + n Tage als „YYYY-MM-DD“ (reine Datumsarithmetik, keine Zeitzonenfalle). */
function plusTage(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function tageZwischen(vonIso: string, bisIso: string): number {
  const a = new Date(`${vonIso}T12:00:00Z`).getTime();
  const b = new Date(`${bisIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Legt für eine bezahlte Bestellung die Ratenkette an:
 *   Rate 1 = die geleistete Startzahlung (Status bezahlt, dokumentarisch)
 *   Rate 2 = erste Monatsrate, fällig 30 Tage nach der Buchung
 *
 * Idempotent (UNIQUE ref+rate_nr, ON CONFLICT DO NOTHING) — darf bei jeder
 * Buchung erneut laufen. Wirft nie: eine Zahlung darf nicht daran scheitern,
 * dass das Abo-Modul etwas nicht anlegen kann.
 */
export async function aboBeiZahlungAnlegen(ref: string): Promise<{ angelegt: boolean; grund?: string }> {
  try {
    await ensureAboTabellen();
    const [app] = await sqlPool`
      SELECT ref, payment_reference, pack_name, amount_due, payment_status, completed_at,
             merged_into, abo_gestoppt_am
      FROM fiaon_applications WHERE ref = ${ref}
    `;
    if (!app) return { angelegt: false, grund: "Bestellung nicht gefunden" };
    if (app.payment_status !== "paid") return { angelegt: false, grund: "nicht bezahlt" };
    if (app.merged_into) return { angelegt: false, grund: "zusammengeführt" };
    if (app.abo_gestoppt_am) return { angelegt: false, grund: "Abo gestoppt" };
    if (istBonitaetsCheck(app)) return { angelegt: false, grund: "Bonitäts-Check ist kein Abo" };
    const betrag = cents(app.amount_due);
    if (betrag <= 0) return { angelegt: false, grund: "Betrag unklar" };
    const referenz = app.payment_reference || app.ref;

    const startTag = (app.completed_at ? new Date(app.completed_at) : new Date()).toISOString().slice(0, 10);

    // Rate 1: die Startzahlung, als bezahlt dokumentiert. Ohne sie fehlt der
    // Ankerpunkt, von dem alle weiteren Fälligkeiten ausgehen.
    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${ref}, 1, ${referenz}, ${betrag}, ${startTag}::date, 'bezahlt', ${app.completed_at || new Date()}, 'auto', 'Startzahlung')
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;

    // Rate 2: erste Monatsrate.
    const [vorhanden] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_abo_raten WHERE ref = ${ref} AND rate_nr > 1
    `;
    if (Number(vorhanden.c) > 0) return { angelegt: false, grund: "Kette existiert bereits" };

    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle)
      VALUES (${ref}, 2, ${`${referenz}-2`}, ${betrag}, ${plusTage(startTag, ABO_ZYKLUS_TAGE)}::date, 'offen', 'auto')
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;
    return { angelegt: true };
  } catch (err) {
    console.error("[FIAON-ABO] anlegen:", err);
    return { angelegt: false, grund: "Fehler" };
  }
}

/** Nächste Rate nach einer bezahlten Rate — die Kette wächst nur nach Zahlung. */
async function naechsteRateAnlegen(ref: string, letzteRate: { rate_nr: number; faellig_am: any; betrag_cents: number; zahlungsreferenz: string }) {
  const [app] = await sqlPool`
    SELECT payment_reference, ref, abo_gestoppt_am, amount_due FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!app || app.abo_gestoppt_am) return;
  const referenz = app.payment_reference || app.ref;
  const nr = Number(letzteRate.rate_nr) + 1;
  const basis = new Date(letzteRate.faellig_am).toISOString().slice(0, 10);
  // Betrag immer frisch aus der Bestellung: ändert der Betreiber das Paket,
  // gilt der neue Preis ab der nächsten Rate.
  const betrag = cents(app.amount_due) || Number(letzteRate.betrag_cents);
  await sqlPool`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle)
    VALUES (${ref}, ${nr}, ${`${referenz}-${nr}`}, ${betrag}, ${plusTage(basis, ABO_ZYKLUS_TAGE)}::date, 'offen', 'auto')
    ON CONFLICT (ref, rate_nr) DO NOTHING
  `;
}

/**
 * Bestandsaufnahme: legt für ALLE bezahlten Bestellungen die Ratenkette an.
 *
 * `rueckwirkend = false` (Vorgabe): die offene Rate ist die NÄCHSTE künftige
 * Fälligkeit. Für Monate, die nie in Rechnung gestellt wurden, wird niemand
 * gemahnt.
 * `rueckwirkend = true`: die offene Rate ist die letzte verstrichene Fälligkeit
 * — der Kunde ist damit sofort überfällig. Bewusste Entscheidung des Betreibers.
 */
export async function aboNachziehen(opts: { rueckwirkend?: boolean; nurZaehlen?: boolean } = {}): Promise<{
  geprueft: number; neu: number; uebersprungen: number; rueckwirkend: boolean;
}> {
  await ensureAboTabellen();
  const heute = berlinToday();
  const apps = await sqlPool`
    SELECT a.ref, a.payment_reference, a.pack_name, a.amount_due, a.completed_at
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.payment_reference IS NOT NULL
      AND a.merged_into IS NULL AND a.completed_at IS NOT NULL AND a.abo_gestoppt_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
    ORDER BY a.completed_at DESC
  `;
  let neu = 0, uebersprungen = 0;
  for (const app of apps) {
    if (istBonitaetsCheck(app) || cents(app.amount_due) <= 0) { uebersprungen++; continue; }
    const referenz = app.payment_reference || app.ref;
    const betrag = cents(app.amount_due);
    const startTag = new Date(app.completed_at).toISOString().slice(0, 10);

    // Wie viele Zyklen sind seit der Startzahlung vergangen?
    const tage = tageZwischen(startTag, heute);
    const zyklen = Math.floor(tage / ABO_ZYKLUS_TAGE);
    // Rate 2 ist die erste Monatsrate. Vergangene Zyklen zählen mit, damit die
    // Ratennummer zum tatsächlichen Alter passt (und nicht jeder Bestandskunde
    // wieder bei Rate 2 anfängt).
    const rateNr = 2 + Math.max(0, opts.rueckwirkend ? zyklen - 1 : zyklen);
    const faellig = plusTage(startTag, ABO_ZYKLUS_TAGE * (rateNr - 1));

    if (opts.nurZaehlen) { neu++; continue; }

    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${app.ref}, 1, ${referenz}, ${betrag}, ${startTag}::date, 'bezahlt', ${app.completed_at}, 'auto', 'Startzahlung')
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;
    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
      VALUES (${app.ref}, ${rateNr}, ${`${referenz}-${rateNr}`}, ${betrag}, ${faellig}::date, 'offen', 'nachgezogen',
              ${opts.rueckwirkend ? "Bestandsaufnahme (rückwirkend fällig)" : "Bestandsaufnahme (nächste Fälligkeit)"})
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;
    neu++;
  }
  return { geprueft: apps.length, neu, uebersprungen, rueckwirkend: !!opts.rueckwirkend };
}

// ── Erinnerungsmail ──────────────────────────────────────────────────────────
const MAHN_TEXT: Record<number, string> = {
  1: "Freundliche Erinnerung — heute ist Ihre Monatsrate fällig.",
  2: "Zweite Erinnerung — die Rate ist seit einer Woche offen.",
  3: "Letzte Erinnerung — die Rate ist seit zwei Wochen offen. Bitte melden Sie sich, wenn etwas unklar ist.",
};

/**
 * Baut die Nutzlast für Make. Enthält ALLES, was in der Mail stehen muss —
 * Empfänger, IBAN, BIC und den Verwendungszweck. Ohne den Verwendungszweck
 * kann der Kunde überweisen, und wir können die Zahlung nicht zuordnen.
 */
export function aboErinnerungPayload(r: any) {
  const faellig = new Date(r.faellig_am).toISOString().slice(0, 10);
  const heute = berlinToday();
  const ueberfaellig = Math.max(0, tageZwischen(faellig, heute));
  const stufe = Math.min(3, Math.max(1, Number(r.mahnstufe || 0) + 1));
  return {
    ...makePayloadFromRow(r),
    // Die Ratenreferenz ersetzt bewusst payment_reference: bestehende
    // Make-Vorlagen drucken dieses Feld als Verwendungszweck.
    payment_reference: r.zahlungsreferenz,
    betrag: (Number(r.betrag_cents) / 100).toFixed(2),
    rate_nr: Number(r.rate_nr),
    faellig_am: faellig,
    faellig_am_text: new Date(`${faellig}T12:00:00Z`).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
    }),
    tage_ueberfaellig: ueberfaellig,
    mahnstufe: stufe,
    mahnstufe_text: MAHN_TEXT[stufe],
    empfaenger: FIAON_BANK_DETAILS.recipient,
    iban: FIAON_BANK_DETAILS.ibanDisplay,
    bic: FIAON_BANK_DETAILS.bic,
    verwendungszweck: r.zahlungsreferenz,
    portal_url: absoluteUrl("/login"),
  };
}

/** Hartes Versandfenster: keine Kundenmail vor 08:00 oder nach 20:00 Berlin. */
function imVersandfenster(): boolean {
  const h = Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).find((p) => p.type === "hour")?.value || "12");
  return h >= 8 && h < 20;
}

/** Fällige Raten mit allen Kundendaten — Grundlage für Motor und Anzeige. */
async function faelligeRaten(limit: number, opts: { abStichtag?: string | null } = {}) {
  const heute = berlinToday();
  return sqlPool`
    SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
           a.email, a.contact_email, a.billing_email, a.pack_name, a.amount_due, a.ref,
           ag.name AS agent_name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE r.status = 'offen'
      AND r.faellig_am <= ${heute}::date
      AND r.mahnstufe < ${MAHNSTUFEN.length}
      AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL
      AND (r.letzte_erinnerung_at IS NULL OR r.letzte_erinnerung_at < NOW() - INTERVAL '20 hours')
      -- Stufe erst, wenn der Abstand erreicht ist (0 / 7 / 14 Tage nach Fälligkeit)
      AND (${heute}::date - r.faellig_am) >= (CASE r.mahnstufe WHEN 0 THEN 0 WHEN 1 THEN 7 ELSE 14 END)
      AND (${opts.abStichtag || null}::date IS NULL OR r.faellig_am >= ${opts.abStichtag || null}::date)
    ORDER BY r.faellig_am ASC
    LIMIT ${limit}
  `;
}

/**
 * Der Motor. Läuft stündlich, arbeitet nur im Versandfenster und schickt je
 * Rate maximal eine Mail pro 20 Stunden.
 *
 * `abStichtag` schützt die Einführung: Raten, die VOR dem Stichtag fällig
 * waren, bekommen keine automatische Mail. Sonst würde am Tag des Deploys eine
 * Mahnwelle an den gesamten Bestand rausgehen — für Monate, die nie in
 * Rechnung gestellt wurden. Diese Fälle bleiben sichtbar und können bewusst
 * per Sammelversand freigegeben werden.
 */
export async function aboMotor(opts: { force?: boolean } = {}): Promise<{
  gesendet: number; uebersprungenFenster: boolean; ueberfaelligMarkiert: number;
}> {
  await ensureAboTabellen();
  const ergebnis = { gesendet: 0, uebersprungenFenster: false, ueberfaelligMarkiert: 0 };
  const settings = await getSettings();
  if (settings.abo_motor_enabled === "0") {
    ergebnis.uebersprungenFenster = true;
    return ergebnis;
  }
  if (!imVersandfenster() && !opts.force) {
    ergebnis.uebersprungenFenster = true;
    return ergebnis;
  }
  // Stichtag beim ersten Lauf festschreiben.
  let stichtag = settings.abo_stichtag;
  if (!stichtag) {
    stichtag = berlinToday();
    await setSetting("abo_stichtag", stichtag);
  }

  const batch = await faelligeRaten(ABO_BATCH, { abStichtag: stichtag });
  for (const r of batch) {
    const stufe = Math.min(MAHNSTUFEN.length, Number(r.mahnstufe || 0) + 1);
    await sendMakeWebhook("abo_payment_reminder", aboErinnerungPayload(r) as any);
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET mahnstufe = ${stufe}, erinnerungen = erinnerungen + 1,
          letzte_erinnerung_at = NOW(), updated_at = NOW()
      WHERE id = ${r.id}
    `;
    ergebnis.gesendet++;
  }
  if (ergebnis.gesendet > 0) {
    console.log(`[FIAON-ABO] ${ergebnis.gesendet} Abo-Erinnerung(en) versendet`);
  }
  return ergebnis;
}

// Stündlicher Lauf, fail-safe (wie die Zahlungs-Reminder-Engine).
//
// NUR in der Produktion automatisch: Auf einem Entwicklungsrechner liegt oft
// eine .env mit der ECHTEN Make-URL. Ohne diese Bremse hätte jeder lokale
// Serverstart 90 Sekunden später echte Mahnmails an echte Kunden geschickt.
// Lokal testen geht über POST /admin/abo/motor (bewusster Klick) oder
// ABO_MOTOR_LOKAL=1.
if (process.env.NODE_ENV === "production" || process.env.ABO_MOTOR_LOKAL === "1") {
  setInterval(() => { void aboMotor().catch((e) => console.error("[FIAON-ABO] Motor:", e)); }, 60 * 60 * 1000);
  setTimeout(() => { void aboMotor().catch(() => {}); }, 90_000);
} else {
  console.log("[FIAON-ABO] Motor pausiert (kein Produktionsbetrieb) — manueller Lauf über /admin/abo/motor");
}

// ═══════════════════════════════════════════════════════════════════════════
// Endpoints (alle unter /admin — Agent-403 und Zugangscode greifen davor)
// ═══════════════════════════════════════════════════════════════════════════

/** Kennzahlen: laufender Monatsumsatz, Fälligkeiten, Rückstand. */
export async function aboUebersicht() {
  await ensureAboTabellen();
  const heute = berlinToday();
  const [k] = await sqlPool`
    SELECT
      COUNT(*) FILTER (WHERE r.status = 'offen' AND r.faellig_am = ${heute}::date)::int AS heute_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.status = 'offen' AND r.faellig_am = ${heute}::date), 0)::bigint AS heute_cents,
      COUNT(*) FILTER (WHERE r.status = 'offen' AND r.faellig_am > ${heute}::date AND r.faellig_am <= ${heute}::date + 7)::int AS woche_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.status = 'offen' AND r.faellig_am > ${heute}::date AND r.faellig_am <= ${heute}::date + 7), 0)::bigint AS woche_cents,
      COUNT(*) FILTER (WHERE r.status = 'offen' AND r.faellig_am < ${heute}::date)::int AS ueberfaellig_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.status = 'offen' AND r.faellig_am < ${heute}::date), 0)::bigint AS ueberfaellig_cents,
      COUNT(*) FILTER (WHERE r.status = 'offen' AND r.faellig_am < ${heute}::date AND r.mahnstufe >= ${MAHNSTUFEN.length})::int AS entscheidung_anzahl,
      COUNT(*) FILTER (WHERE r.status = 'bezahlt' AND r.rate_nr > 1 AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date)::int AS monat_bezahlt_anzahl,
      COALESCE(SUM(r.betrag_cents) FILTER (WHERE r.status = 'bezahlt' AND r.rate_nr > 1 AND (r.bezahlt_am AT TIME ZONE 'Europe/Berlin')::date >= date_trunc('month', ${heute}::date)::date), 0)::bigint AS monat_bezahlt_cents
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
  `;
  // Erwarteter Monatsumsatz = Summe der laufenden Abos (eine Rate je Kunde).
  const [mrr] = await sqlPool`
    SELECT COUNT(DISTINCT r.ref)::int AS abos,
           COALESCE(SUM(x.betrag), 0)::bigint AS cents
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    JOIN LATERAL (SELECT MAX(betrag_cents) AS betrag FROM fiaon_abo_raten r2 WHERE r2.ref = r.ref) x ON TRUE
    WHERE r.status = 'offen'
  `;
  const settings = await getSettings();
  const [ohne] = await sqlPool`
    SELECT COUNT(*)::int AS c FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.payment_reference IS NOT NULL AND a.merged_into IS NULL
      AND a.completed_at IS NOT NULL AND a.abo_gestoppt_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
  `;
  const zahl = (v: any) => Number(v || 0);
  return {
    heute: { anzahl: zahl(k.heute_anzahl), cents: zahl(k.heute_cents) },
    woche: { anzahl: zahl(k.woche_anzahl), cents: zahl(k.woche_cents) },
    ueberfaellig: { anzahl: zahl(k.ueberfaellig_anzahl), cents: zahl(k.ueberfaellig_cents) },
    entscheidung: zahl(k.entscheidung_anzahl),
    monatBezahlt: { anzahl: zahl(k.monat_bezahlt_anzahl), cents: zahl(k.monat_bezahlt_cents) },
    laufend: { abos: zahl(mrr.abos), cents: zahl(mrr.cents) },
    ohneKette: zahl(ohne.c),
    motorAktiv: settings.abo_motor_enabled !== "0",
    stichtag: settings.abo_stichtag || null,
    zyklusTage: ABO_ZYKLUS_TAGE,
  };
}

router.get("/admin/abo/uebersicht", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await aboUebersicht()) });
  } catch (err) {
    console.error("[FIAON-ABO] uebersicht:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Ratenliste. `art`: heute | woche | ueberfaellig | offen | bezahlt | entscheidung */
router.get("/admin/abo/raten", async (req, res) => {
  try {
    await ensureAboTabellen();
    const art = String(req.query.art || "offen");
    const heute = berlinToday();
    const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 300));

    const filter =
      art === "heute" ? `r.status = 'offen' AND r.faellig_am = $1::date`
      : art === "woche" ? `r.status = 'offen' AND r.faellig_am > $1::date AND r.faellig_am <= $1::date + 7`
      : art === "ueberfaellig" ? `r.status = 'offen' AND r.faellig_am < $1::date`
      : art === "entscheidung" ? `r.status = 'offen' AND r.faellig_am < $1::date AND r.mahnstufe >= ${MAHNSTUFEN.length}`
      : art === "bezahlt" ? `r.status = 'bezahlt' AND r.rate_nr > 1`
      : `r.status = 'offen'`;
    // Sortierung: bei offenen die dringendste zuerst, bei bezahlten die neueste.
    const sortierung = art === "bezahlt" ? "r.bezahlt_am DESC NULLS LAST" : "r.faellig_am ASC";

    const rows = await sqlPool.unsafe(`
      SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.faellig_am, r.status,
             r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at, r.bezahlt_am, r.notiz,
             COALESCE(NULLIF(TRIM(a.company_name),''), NULLIF(TRIM(CONCAT_WS(' ', a.first_name, a.last_name)),''),
                      NULLIF(TRIM(a.contact_name),''), a.ref) AS name,
             COALESCE(NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''), NULLIF(TRIM(a.billing_email),'')) AS email,
             NULLIF(TRIM(CONCAT(COALESCE(a.phone_country_code,''), COALESCE(a.phone,''))),'') AS telefon,
             NULLIF(TRIM(regexp_replace(COALESCE(a.pack_name,''), '\\s+', ' ', 'g')),'') AS paket,
             ag.name AS agent_name,
             ($1::date - r.faellig_am) AS tage_ueberfaellig
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
      LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
      WHERE ${filter}
      ORDER BY ${sortierung}
      LIMIT ${limit}
    `, [heute]);

    res.json({
      ok: true, art, anzahl: rows.length,
      summeCents: rows.reduce((s: number, r: any) => s + Number(r.betrag_cents || 0), 0),
      raten: rows.map((r: any) => ({
        id: Number(r.id), ref: r.ref, rateNr: Number(r.rate_nr),
        zahlungsreferenz: r.zahlungsreferenz, betragCents: Number(r.betrag_cents),
        faelligAm: new Date(r.faellig_am).toISOString().slice(0, 10),
        status: r.status, mahnstufe: Number(r.mahnstufe), erinnerungen: Number(r.erinnerungen),
        letzteErinnerung: r.letzte_erinnerung_at || null, bezahltAm: r.bezahlt_am || null,
        tageUeberfaellig: Number(r.tage_ueberfaellig || 0),
        name: r.name, email: r.email || null, telefon: r.telefon || null,
        paket: r.paket || null, agent: r.agent_name || null, notiz: r.notiz || null,
        akte: `/admin/kunde/${encodeURIComponent(r.ref)}`,
      })),
    });
  } catch (err) {
    console.error("[FIAON-ABO] raten:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Rate als bezahlt buchen — erzeugt automatisch die nächste Fälligkeit. */
router.post("/admin/abo/raten/:id/bezahlt", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const id = Number(req.params.id);
    const [rate] = await sqlPool`SELECT * FROM fiaon_abo_raten WHERE id = ${id}`;
    if (!rate) return res.status(404).json({ ok: false, error: "Rate nicht gefunden" });
    if (rate.status === "bezahlt") return res.json({ ok: true, schonBezahlt: true });

    await sqlPool`
      UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW(), updated_at = NOW() WHERE id = ${id}
    `;
    await naechsteRateAnlegen(rate.ref, rate as any);
    // Im Kundenverlauf dokumentieren, damit die Akte die Wahrheit zeigt.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rate.ref}, NULL, 'System', 'system',
              ${`Abo-Rate ${rate.rate_nr} (${rate.zahlungsreferenz}) als bezahlt gebucht`})
    `.catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ABO] bezahlt:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Einzelne Erinnerung von Hand senden (auch vor Fälligkeit möglich). */
router.post("/admin/abo/raten/:id/erinnern", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const id = Number(req.params.id);
    const [r] = await sqlPool`
      SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
             a.email, a.contact_email, a.billing_email, a.pack_name, a.amount_due, a.ref
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.id = ${id}
    `;
    if (!r) return res.status(404).json({ ok: false, error: "Rate nicht gefunden" });
    if (r.status !== "offen") return res.status(400).json({ ok: false, error: "Rate ist nicht offen" });
    const mail = r.email || r.contact_email || r.billing_email;
    if (!mail) return res.status(400).json({ ok: false, error: "Keine E-Mail-Adresse hinterlegt" });
    if (!imVersandfenster()) {
      return res.status(400).json({ ok: false, error: "Außerhalb des Versandfensters (08–20 Uhr Berlin)" });
    }
    await sendMakeWebhook("abo_payment_reminder", aboErinnerungPayload(r) as any);
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET mahnstufe = LEAST(${MAHNSTUFEN.length}, mahnstufe + 1), erinnerungen = erinnerungen + 1,
          letzte_erinnerung_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ABO] erinnern:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Abo anhalten (Kündigung/Pause) — löscht nichts, stoppt nur die Kette. */
router.post("/admin/abo/:ref/stoppen", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const ref = String(req.params.ref);
    const grund = String(req.body?.grund || "").slice(0, 500) || null;
    await sqlPool`
      UPDATE fiaon_applications SET abo_gestoppt_am = NOW(), abo_stopp_grund = ${grund}, updated_at = NOW()
      WHERE ref = ${ref}
    `;
    await sqlPool`
      UPDATE fiaon_abo_raten SET status = 'storniert', notiz = COALESCE(notiz,'') || ' · Abo gestoppt', updated_at = NOW()
      WHERE ref = ${ref} AND status = 'offen'
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ABO] stoppen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Abo wieder aufnehmen. */
router.post("/admin/abo/:ref/fortsetzen", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const ref = String(req.params.ref);
    await sqlPool`
      UPDATE fiaon_applications SET abo_gestoppt_am = NULL, abo_stopp_grund = NULL, updated_at = NOW()
      WHERE ref = ${ref}
    `;
    const ergebnis = await aboBeiZahlungAnlegen(ref);
    res.json({ ok: true, ...ergebnis });
  } catch (err) {
    console.error("[FIAON-ABO] fortsetzen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Vorschau: was würde ein Nachziehen anlegen? */
router.get("/admin/abo/nachziehen/vorschau", async (req, res) => {
  try {
    const rueckwirkend = String(req.query.rueckwirkend || "") === "1";
    res.json({ ok: true, ...(await aboNachziehen({ rueckwirkend, nurZaehlen: true })) });
  } catch (err) {
    console.error("[FIAON-ABO] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Ratenketten für den Bestand anlegen. */
router.post("/admin/abo/nachziehen", async (req, res) => {
  try {
    const rueckwirkend = req.body?.rueckwirkend === true;
    res.json({ ok: true, ...(await aboNachziehen({ rueckwirkend })) });
  } catch (err) {
    console.error("[FIAON-ABO] nachziehen:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Motor von Hand anstoßen (ignoriert nur das Feinfenster, nie 08–20 Uhr). */
router.post("/admin/abo/motor", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await aboMotor({ force: true })) });
  } catch (err) {
    console.error("[FIAON-ABO] motor:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Sammelversand für Raten VOR dem Stichtag (die der Motor bewusst nicht
 * anfasst). Mit Vorschau, weil es die einzige Stelle ist, an der eine größere
 * Mailwelle absichtlich ausgelöst wird.
 */
router.get("/admin/abo/sammelversand/vorschau", async (_req, res) => {
  try {
    await ensureAboTabellen();
    const settings = await getSettings();
    const stichtag = settings.abo_stichtag || berlinToday();
    const heute = berlinToday();
    const [row] = await sqlPool`
      SELECT COUNT(*)::int AS anzahl, COALESCE(SUM(r.betrag_cents),0)::bigint AS cents
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      WHERE r.status = 'offen' AND r.faellig_am <= ${heute}::date AND r.faellig_am < ${stichtag}::date
        AND r.mahnstufe < ${MAHNSTUFEN.length}
        AND COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) IS NOT NULL
    `;
    res.json({
      ok: true, anzahl: Number(row.anzahl), summeCents: Number(row.cents),
      stichtag, imFenster: imVersandfenster(),
    });
  } catch (err) {
    console.error("[FIAON-ABO] sammel-vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/abo/sammelversand", async (_req, res) => {
  try {
    await ensureAboTabellen();
    if (!imVersandfenster()) {
      return res.status(400).json({ ok: false, error: "Außerhalb des Versandfensters (08–20 Uhr Berlin)" });
    }
    // Ohne Stichtag-Grenze, aber mit denselben Schutzregeln (20h-Sperre, Stufen).
    const batch = await faelligeRaten(ABO_BATCH);
    let gesendet = 0;
    for (const r of batch) {
      const stufe = Math.min(MAHNSTUFEN.length, Number(r.mahnstufe || 0) + 1);
      await sendMakeWebhook("abo_payment_reminder", aboErinnerungPayload(r) as any);
      await sqlPool`
        UPDATE fiaon_abo_raten
        SET mahnstufe = ${stufe}, erinnerungen = erinnerungen + 1, letzte_erinnerung_at = NOW(), updated_at = NOW()
        WHERE id = ${r.id}
      `;
      gesendet++;
    }
    res.json({ ok: true, gesendet, rest: batch.length === ABO_BATCH });
  } catch (err) {
    console.error("[FIAON-ABO] sammelversand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
