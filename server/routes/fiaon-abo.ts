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
import { sendMakeWebhookMitGrund, makePayloadFromRow } from "../make-webhook";
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
  // Zustellung: Ein Fehlschlag muss sichtbar bleiben, sonst mahnt man ins Leere.
  await sqlPool`
    ALTER TABLE fiaon_abo_raten
    ADD COLUMN IF NOT EXISTS letzter_fehler TEXT,
    ADD COLUMN IF NOT EXISTS letzter_fehler_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS fehlversuche INTEGER NOT NULL DEFAULT 0
  `;
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

/**
 * Prüft ein eingegebenes Zahlungsdatum. Vorgabe ist heute.
 *
 * Zwei Grenzen, beide aus der Praxis: In der Zukunft kann kein Geld eingegangen
 * sein, und ein Datum, das Jahre zurückliegt, ist fast immer ein Tippfehler im
 * Jahr — beides würde die ganze Ratenkette verschieben.
 */
export function pruefeZahlungsdatum(eingabe: unknown): { datum: string; fehler?: string } {
  const heute = berlinToday();
  const s = String(eingabe ?? "").trim();
  if (!s) return { datum: heute };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return { datum: heute, fehler: "Zahlungsdatum unlesbar (erwartet JJJJ-MM-TT)." };
  }
  if (s > heute) {
    return { datum: heute, fehler: "Das Zahlungsdatum liegt in der Zukunft — dann ist noch kein Geld eingegangen." };
  }
  if (tageZwischen(s, heute) > 365) {
    return { datum: heute, fehler: "Das Zahlungsdatum liegt über ein Jahr zurück — bitte prüfen (Jahr vertippt?)." };
  }
  return { datum: s };
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

/**
 * Nächste Rate nach einer bezahlten Rate — die Kette wächst nur nach Zahlung.
 *
 * `abDatum` ist das tatsächliche Zahlungsdatum. Ohne es würde ab der alten
 * Fälligkeit gerechnet: Wer zehn Tage zu spät zahlt, hätte dann schon nach
 * 20 Tagen die nächste Rate offen.
 */
async function naechsteRateAnlegen(
  ref: string,
  letzteRate: { rate_nr: number; faellig_am: any; betrag_cents: number; zahlungsreferenz: string },
  abDatum?: string,
) {
  const [app] = await sqlPool`
    SELECT payment_reference, ref, abo_gestoppt_am, amount_due FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!app || app.abo_gestoppt_am) return;
  const referenz = app.payment_reference || app.ref;
  const nr = Number(letzteRate.rate_nr) + 1;
  const basis = abDatum || new Date(letzteRate.faellig_am).toISOString().slice(0, 10);
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
/**
 * Stellt sicher, dass JEDE bezahlte Paketbestellung eine Ratenkette hat.
 *
 * Warum ohne Knopf: Wer ein Paket kauft, hat ein Abo — das ist keine
 * Einzelfallentscheidung, sondern die Regel des Geschäfts. Der frühere Knopf
 * „Ketten anlegen" verlangte vom Betreiber eine Zustimmung zu etwas, das
 * ohnehin gilt, und ließ bis zum Klick Umsatz unsichtbar. Angelegt wird die
 * NÄCHSTE künftige Fälligkeit — für Monate, die nie in Rechnung gestellt
 * wurden, kann niemand gemahnt werden.
 *
 * Idempotent und billig: Ist nichts offen, kostet der Aufruf eine Zählabfrage.
 */
export async function ketteSicherstellen(): Promise<{ neu: number }> {
  await ensureAboTabellen();
  const [offen] = await sqlPool`
    SELECT COUNT(*)::int AS c
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE)
      AND a.merged_into IS NULL AND a.completed_at IS NOT NULL AND a.abo_gestoppt_am IS NULL
      AND a.type <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
  `;
  if (Number(offen.c) === 0) return { neu: 0 };
  const erg = await aboNachziehen({ rueckwirkend: false });
  if (erg.neu > 0) console.log(`[FIAON-ABO] ${erg.neu} Ratenkette(n) automatisch angelegt`);
  return { neu: erg.neu };
}

export async function aboNachziehen(opts: { rueckwirkend?: boolean; nurZaehlen?: boolean } = {}): Promise<{
  geprueft: number; neu: number; uebersprungen: number; rueckwirkend: boolean;
}> {
  await ensureAboTabellen();
  const heute = berlinToday();
  const apps = await sqlPool`
    SELECT a.ref, a.payment_reference, a.pack_name, a.amount_due, a.completed_at
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE)
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
/**
 * Versandfenster in Berliner Zeit. Vorgabe 08–20 Uhr.
 *
 * Über die Einstellungen `abo_fenster_start` / `abo_fenster_ende` verschiebbar —
 * nicht aus Bequemlichkeit, sondern weil dieses Fenster die einzige Bremse gegen
 * nächtliche Kundenmails ist und deshalb sichtbar und prüfbar gehören muss,
 * statt als Zahl im Code zu stehen. Ein Wert außerhalb 0–24 wird verworfen.
 */
async function versandfenster(): Promise<{ start: number; ende: number }> {
  try {
    const s = await getSettings();
    const start = Number(s.abo_fenster_start);
    const ende = Number(s.abo_fenster_ende);
    if (Number.isInteger(start) && Number.isInteger(ende) && start >= 0 && ende <= 24 && start < ende) {
      return { start, ende };
    }
  } catch { /* Vorgabe gilt */ }
  return { start: 8, ende: 20 };
}

function berlinStunde(): number {
  return Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false })
    .formatToParts(new Date()).find((p) => p.type === "hour")?.value || "12");
}

async function imVersandfenster(): Promise<boolean> {
  const { start, ende } = await versandfenster();
  const h = berlinStunde();
  return h >= start && h < ende;
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
  gesendet: number; fehlgeschlagen: number; uebersprungenFenster: boolean;
}> {
  await ensureAboTabellen();
  // Jede bezahlte Paketbestellung IST ein Abo. Fehlt die Ratenkette, wird sie
  // hier still angelegt — es braucht dafür keinen Knopf und keine Entscheidung.
  await ketteSicherstellen();
  const ergebnis = { gesendet: 0, fehlgeschlagen: 0, uebersprungenFenster: false };
  const settings = await getSettings();
  if (settings.abo_motor_enabled === "0") {
    ergebnis.uebersprungenFenster = true;
    return ergebnis;
  }
  if (!(await imVersandfenster()) && !opts.force) {
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
    const erg = await rateErinnern(r);
    if (erg.ok) ergebnis.gesendet++;
    else ergebnis.fehlgeschlagen++;
  }
  if (ergebnis.gesendet > 0) {
    console.log(`[FIAON-ABO] ${ergebnis.gesendet} Abo-Erinnerung(en) versendet`);
  }
  if (ergebnis.fehlgeschlagen > 0) {
    console.warn(`[FIAON-ABO] ${ergebnis.fehlgeschlagen} Erinnerung(en) NICHT zugestellt — Mahnstufe unverändert`);
  }
  return ergebnis;
}

/**
 * Eine Rate erinnern — und die Mahnstufe NUR bei erfolgreichem Versand erhöhen.
 *
 * Vorher schritt die Stufe auch dann fort, wenn Make den Event nicht annehmen
 * konnte. Ein Kunde landete damit nach 14 Tagen auf „Entscheidung nötig", ohne
 * je eine Mail gesehen zu haben — die schlimmste Sorte Fehler, weil sie wie
 * Absicht aussieht. Jetzt gilt: kein Versand, keine Stufe. Der Fehlgrund wird
 * an der Rate festgehalten und in der Zahlungszentrale angezeigt.
 */
async function rateErinnern(r: any, opts: { stufeErhoehen?: boolean } = {}): Promise<{ ok: boolean; grund?: string }> {
  // Die Mahnstufe steigt nur, wenn die Rate WIRKLICH fällig ist. Eine
  // freundliche Vorabinfo drei Tage vor dem Termin ist keine Mahnung — sie
  // würde den Kunden sonst auf Stufe 1 setzen, bevor er überhaupt zahlen musste.
  const faellig = String(r.faellig_am ? new Date(r.faellig_am).toISOString().slice(0, 10) : "");
  const istFaellig = !faellig || faellig <= berlinToday();
  const stufeErhoehen = opts.stufeErhoehen ?? istFaellig;
  const stufe = stufeErhoehen
    ? Math.min(MAHNSTUFEN.length, Number(r.mahnstufe || 0) + 1)
    : Number(r.mahnstufe || 0);
  const versand = await sendMakeWebhookMitGrund("abo_payment_reminder", aboErinnerungPayload(r) as any);
  if (versand.ok) {
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET mahnstufe = ${stufe}, erinnerungen = erinnerungen + 1,
          letzte_erinnerung_at = NOW(),
          letzter_fehler = NULL, letzter_fehler_at = NULL,
          updated_at = NOW()
      WHERE id = ${r.id}
    `;
    return { ok: true };
  }
  // Fehlschlag: Stufe und Zähler bleiben unangetastet. `letzte_erinnerung_at`
  // wird bewusst NICHT gesetzt — sonst würde die 20-Stunden-Sperre einen
  // erneuten Versuch blockieren, obwohl nie etwas rausging.
  await sqlPool`
    UPDATE fiaon_abo_raten
    SET fehlversuche = fehlversuche + 1,
        letzter_fehler = ${versand.grund || "Unbekannter Fehler beim Versand"},
        letzter_fehler_at = NOW(), updated_at = NOW()
    WHERE id = ${r.id}
  `;
  return { ok: false, grund: versand.grund };
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
      COUNT(*) FILTER (WHERE r.status = 'offen' AND r.letzter_fehler IS NOT NULL)::int AS zustellfehler_anzahl,
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
    WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE) AND a.merged_into IS NULL
      AND a.completed_at IS NOT NULL AND a.abo_gestoppt_am IS NULL
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.rate_nr > 1)
  `;
  const zahl = (v: any) => Number(v || 0);
  return {
    heute: { anzahl: zahl(k.heute_anzahl), cents: zahl(k.heute_cents) },
    woche: { anzahl: zahl(k.woche_anzahl), cents: zahl(k.woche_cents) },
    ueberfaellig: { anzahl: zahl(k.ueberfaellig_anzahl), cents: zahl(k.ueberfaellig_cents) },
    entscheidung: zahl(k.entscheidung_anzahl),
    // Erinnerungen, die Make nicht angenommen hat: Diese Kunden haben KEINE
    // Mail bekommen, ihre Mahnstufe steht bewusst still.
    zustellfehler: zahl(k.zustellfehler_anzahl),
    monatBezahlt: { anzahl: zahl(k.monat_bezahlt_anzahl), cents: zahl(k.monat_bezahlt_cents) },
    laufend: { abos: zahl(mrr.abos), cents: zahl(mrr.cents) },
    ohneKette: zahl(ohne.c),
    motorAktiv: settings.abo_motor_enabled !== "0",
    // Das Versandfenster geht mit an die Oberfläche, damit der Fußtext nicht
    // „08 bis 20 Uhr" behauptet, während in den Einstellungen etwas anderes steht.
    fenster: await versandfenster(),
    imFenster: await imVersandfenster(),
    stichtag: settings.abo_stichtag || null,
    zyklusTage: ABO_ZYKLUS_TAGE,
  };
}

router.get("/admin/abo/uebersicht", async (_req, res) => {
  try {
    // Selbstheilend: Fehlt einer bezahlten Bestellung die Ratenkette, entsteht
    // sie beim Ansehen der Tafel. Damit stimmen die Zahlen immer — ohne dass
    // jemand einen Knopf drücken muss.
    await ketteSicherstellen();
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
      : art === "zustellfehler" ? `r.status = 'offen' AND r.letzter_fehler IS NOT NULL`
      : art === "bezahlt" ? `r.status = 'bezahlt' AND r.rate_nr > 1`
      : `r.status = 'offen'`;
    // Sortierung: bei offenen die dringendste zuerst, bei bezahlten die neueste.
    const sortierung = art === "bezahlt" ? "r.bezahlt_am DESC NULLS LAST" : "r.faellig_am ASC";

    const rows = await sqlPool.unsafe(`
      SELECT r.id, r.ref, r.rate_nr, r.zahlungsreferenz, r.betrag_cents, r.faellig_am, r.status,
             r.mahnstufe, r.erinnerungen, r.letzte_erinnerung_at, r.bezahlt_am, r.notiz,
             r.letzter_fehler, r.letzter_fehler_at, r.fehlversuche,
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
        letzterFehler: r.letzter_fehler || null,
        letzterFehlerAt: r.letzter_fehler_at || null,
        fehlversuche: Number(r.fehlversuche || 0),
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

/**
 * Rate als bezahlt buchen — erzeugt automatisch die nächste Fälligkeit.
 *
 * `zahlungsdatum` (YYYY-MM-DD, Vorgabe heute) ist das TATSÄCHLICHE Datum des
 * Geldeingangs, nicht der Zeitpunkt des Klicks. Da manuell gebucht wird, können
 * dazwischen Tage liegen; die nächste Fälligkeit muss vom Eingang aus rechnen,
 * sonst wandert der Zyklus mit jeder verspäteten Buchung nach hinten.
 */
router.post("/admin/abo/raten/:id/bezahlt", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const id = Number(req.params.id);
    const [rate] = await sqlPool`SELECT * FROM fiaon_abo_raten WHERE id = ${id}`;
    if (!rate) return res.status(404).json({ ok: false, error: "Rate nicht gefunden" });
    if (rate.status === "bezahlt") return res.json({ ok: true, schonBezahlt: true });

    const pruefung = pruefeZahlungsdatum(req.body?.zahlungsdatum);
    if (pruefung.fehler) return res.status(400).json({ ok: false, error: pruefung.fehler });
    const zahlungsdatum = pruefung.datum;

    await sqlPool`
      UPDATE fiaon_abo_raten
      SET status = 'bezahlt', bezahlt_am = ${`${zahlungsdatum}T12:00:00Z`}, updated_at = NOW()
      WHERE id = ${id}
    `;
    // Die nächste Rate rechnet ab dem Zahlungsdatum — nicht ab der bisherigen
    // Fälligkeit. Zahlt jemand zehn Tage zu spät, ist der nächste Termin
    // 30 Tage nach seiner Zahlung.
    await naechsteRateAnlegen(rate.ref, rate as any, zahlungsdatum);
    // Im Kundenverlauf dokumentieren, damit die Akte die Wahrheit zeigt.
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rate.ref}, NULL, 'System', 'system',
              ${`Abo-Rate ${rate.rate_nr} (${rate.zahlungsreferenz}) als bezahlt gebucht — Zahlungseingang ${zahlungsdatum}`})
    `.catch(() => {});
    res.json({ ok: true, zahlungsdatum, naechsteFaelligkeit: plusTage(zahlungsdatum, ABO_ZYKLUS_TAGE) });
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
    if (!(await imVersandfenster())) {
      return res.status(400).json({ ok: false, error: "Außerhalb des Versandfensters (08–20 Uhr Berlin)" });
    }
    const erg = await rateErinnern(r);
    if (!erg.ok) {
      // Ehrliche Rückmeldung: Der Betreiber muss wissen, dass NICHTS rausging.
      return res.status(502).json({ ok: false, error: `Erinnerung konnte nicht zugestellt werden: ${erg.grund}` });
    }
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

// ═══════════════════════════════════════════════════════════════════════════
// ERINNERUNGS-LAUF FÜR DIE GEÖFFNETE ANSICHT
//
// Vorher hing der Knopf am Motor. Der schaut ausschließlich auf „heute oder
// früher fällig" UND respektiert den Einführungsstichtag — steht an dem Tag
// nichts an, meldet er „0 gesendet". Für den Betreiber sah das aus wie ein
// kaputter Knopf, obwohl die Regel griff.
//
// Jetzt gilt: Der Lauf verschickt an GENAU die Raten, die gerade in der Liste
// stehen. Wer „Nächste 7 Tage" geöffnet hat, informiert die kommenden Termine
// vorab; wer „Überfällig" geöffnet hat, mahnt die überfälligen. Das ist keine
// Bequemlichkeit, sondern die Erwartung: Ein Knopf über einer Liste wirkt auf
// diese Liste.
//
// Zwei Regeln bleiben unangetastet, weil sie den Kunden schützen:
//   · Versand nur zwischen 08 und 20 Uhr Berliner Zeit.
//   · Höchstens eine Mail je Rate pro 20 Stunden.
// Beides wird jetzt AUSGEWIESEN statt stillschweigend zu 0 zu führen.
// ═══════════════════════════════════════════════════════════════════════════
type LaufArt = "heute" | "woche" | "ueberfaellig" | "offen" | "entscheidung" | "zustellfehler";

const LAUF_TEXT: Record<LaufArt, string> = {
  heute: "heute fällige Raten",
  woche: "Raten der nächsten 7 Tage (Vorabinfo)",
  ueberfaellig: "überfällige Raten",
  offen: "alle offenen Raten",
  entscheidung: "Raten nach Mahnstufe 3 (Entscheidung nötig)",
  zustellfehler: "Raten, deren Erinnerung nicht zugestellt wurde",
};

/** Kandidaten der gewählten Ansicht — inklusive Begründung, was übersprungen wird. */
async function laufKandidaten(art: LaufArt) {
  const heute = berlinToday();
  const wo =
    art === "heute" ? `r.faellig_am = '${heute}'::date`
    : art === "woche" ? `r.faellig_am > '${heute}'::date AND r.faellig_am <= '${heute}'::date + 7`
    : art === "ueberfaellig" ? `r.faellig_am < '${heute}'::date`
    : art === "entscheidung" ? `r.faellig_am < '${heute}'::date AND r.mahnstufe >= ${MAHNSTUFEN.length}`
    : art === "zustellfehler" ? `r.letzter_fehler IS NOT NULL`
    : `TRUE`;

  return sqlPool.unsafe(`
    SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
           a.email, a.contact_email, a.billing_email, a.pack_name, a.amount_due, a.ref,
           ag.name AS agent_name,
           COALESCE(NULLIF(a.email,''), NULLIF(a.contact_email,''), NULLIF(a.billing_email,'')) AS ziel_mail,
           (r.letzte_erinnerung_at IS NOT NULL AND r.letzte_erinnerung_at >= NOW() - INTERVAL '20 hours') AS gesperrt
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE r.status = 'offen' AND ${wo}
    ORDER BY r.faellig_am ASC
    LIMIT ${ABO_BATCH}
  `);
}

function laufAufteilen(kandidaten: any[]) {
  const senden = kandidaten.filter((r) => r.ziel_mail && !r.gesperrt);
  return {
    senden,
    ohneMail: kandidaten.filter((r) => !r.ziel_mail).length,
    gesperrt: kandidaten.filter((r) => r.ziel_mail && r.gesperrt).length,
  };
}

router.get("/admin/abo/lauf/vorschau", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const art = (String(req.query.art || "heute") as LaufArt);
    const kandidaten = await laufKandidaten(LAUF_TEXT[art] ? art : "heute");
    const { senden, ohneMail, gesperrt } = laufAufteilen(kandidaten as any[]);
    res.json({
      ok: true,
      art, artText: LAUF_TEXT[art] || LAUF_TEXT.heute,
      gefunden: kandidaten.length,
      sendbar: senden.length,
      summeCents: senden.reduce((s, r) => s + Number(r.betrag_cents || 0), 0),
      uebersprungen: { ohneMail, gesperrt },
      imFenster: await imVersandfenster(),
      // Bei künftigen Raten steigt die Mahnstufe NICHT — das muss vor dem Klick
      // klar sein, sonst wirkt der Lauf wie eine Mahnwelle.
      alsVorabinfo: art === "woche",
    });
  } catch (err) {
    console.error("[FIAON-ABO] lauf-vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/abo/lauf", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const art = (String(req.body?.art || "heute") as LaufArt);
    if (!LAUF_TEXT[art]) return res.status(400).json({ ok: false, error: "Unbekannte Ansicht" });
    if (!(await imVersandfenster())) {
      return res.status(400).json({
        ok: false,
        error: "Außerhalb des Versandfensters (08–20 Uhr Berliner Zeit). Kundenmails gehen nachts nicht raus.",
      });
    }
    const kandidaten = await laufKandidaten(art);
    const { senden, ohneMail, gesperrt } = laufAufteilen(kandidaten as any[]);

    let gesendet = 0;
    let fehlgeschlagen = 0;
    const fehler: string[] = [];
    for (const r of senden) {
      // „woche" ist eine Vorabinfo: Die Rate ist noch nicht fällig, also darf
      // die Mahnstufe nicht steigen.
      const erg = await rateErinnern(r, { stufeErhoehen: art !== "woche" });
      if (erg.ok) gesendet++;
      else {
        fehlgeschlagen++;
        if (erg.grund && !fehler.includes(erg.grund)) fehler.push(erg.grund);
      }
    }

    const teile = [`${gesendet} Erinnerung(en) versendet`];
    if (fehlgeschlagen > 0) teile.push(`${fehlgeschlagen} NICHT zugestellt (Mahnstufe unverändert)`);
    if (gesperrt > 0) teile.push(`${gesperrt} übersprungen (vor weniger als 20 Stunden schon erinnert)`);
    if (ohneMail > 0) teile.push(`${ohneMail} ohne E-Mail-Adresse`);
    if (kandidaten.length === 0) teile[0] = `Keine Rate in der Ansicht „${LAUF_TEXT[art]}"`;

    res.json({
      ok: true, art, artText: LAUF_TEXT[art],
      gesendet, fehlgeschlagen,
      uebersprungen: { ohneMail, gesperrt },
      fehlerGruende: fehler,
      rest: kandidaten.length === ABO_BATCH,
      meldung: `${teile.join(" · ")}.`,
    });
  } catch (err) {
    console.error("[FIAON-ABO] lauf:", err);
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
      stichtag, imFenster: await imVersandfenster(),
    });
  } catch (err) {
    console.error("[FIAON-ABO] sammel-vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/abo/sammelversand", async (_req, res) => {
  try {
    await ensureAboTabellen();
    if (!(await imVersandfenster())) {
      return res.status(400).json({ ok: false, error: "Außerhalb des Versandfensters (08–20 Uhr Berlin)" });
    }
    // Ohne Stichtag-Grenze, aber mit denselben Schutzregeln (20h-Sperre, Stufen).
    const batch = await faelligeRaten(ABO_BATCH);
    let gesendet = 0;
    let fehlgeschlagen = 0;
    for (const r of batch) {
      const erg = await rateErinnern(r);
      if (erg.ok) gesendet++; else fehlgeschlagen++;
    }
    res.json({ ok: true, gesendet, fehlgeschlagen, rest: batch.length === ABO_BATCH });
  } catch (err) {
    console.error("[FIAON-ABO] sammelversand:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
