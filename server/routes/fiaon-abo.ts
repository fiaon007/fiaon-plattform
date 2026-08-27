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
//  1. Fälligkeit: der MONATLICHE JAHRESTAG des Buchungstags (`paid_at`), in
//     Berliner Zeit. Gebucht am 05.07. → fällig am 05.08., 05.09., …
//     Monate ohne diesen Tag (der 31.) werden auf den letzten Monatstag
//     gekappt, der Anker bleibt aber der 31. Gerechnet wird das an EINER
//     Stelle: `server/lib/fiaon-abo-zyklus.ts`. Motor, Anzeige und Prüfstand
//     rufen dieselben Funktionen.
//
//     Bis zum 16.08.2026 stand hier „alle 30 Tage". Zwölf Monate zu 30 Tagen
//     sind 360 — der Termin wanderte jedes Jahr fünf Tage nach vorn. Gemessen
//     lagen 266 von 289 offenen Raten NICHT auf dem Jahrestag ihrer Buchung.
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
//     ein Punkt „Entscheidung nötig“ für den Vorgesetzten. Es wird NIEMALS
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
import {
  ankerTag, faelligkeit, kurzTag, naechsteFaelligkeit, tagMinus, zyklenBis, zyklusText,
} from "../lib/fiaon-abo-zyklus";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { FIAON_BANK_DETAILS } from "./fiaon-antrag";
import { getSettings, setSetting } from "./fiaon-agent";
import { absoluteUrl } from "../fiaon-base-url";
import { tageslauf } from "../lib/fiaon-crons";

const router = Router();

/** Ein Datenbankgriff — der gemeinsame Pool oder eine Transaktion des Prüfstands. */
type Lauf = typeof sqlPool;

/**
 * Die Zykluslänge steht NICHT mehr hier.
 *
 * Sie ist keine Zahl, sondern eine Kalenderregel: der monatliche Jahrestag.
 * Der Export bleibt als Auskunft für Anzeigen, die „monatlich" schreiben
 * wollen — als Rechengröße darf ihn niemand mehr benutzen.
 */
export const ABO_ZYKLUS = "monatlich zum Jahrestag der Buchung";
/** Mahnstufen: Tage nach Fälligkeit, an denen die jeweilige Stufe rausgeht. */
// ═══════════════════════════════════════════════════════════════════════════
// DIE ERINNERUNGS-ABSTÄNDE — TAGE NACH FÄLLIGKEIT
//
// ── DIE ENTSCHEIDUNG (Betreiber, 21.08.2026) ──────────────────────────────
// „Tag 0 (Fälligkeit): Zahlungserinnerung. Weitere Erinnerungen Tag 3, 7, 14,
//  21." Vorher waren es drei Sendungen (0 / 7 / 14) — zwischen Tag 0 und Tag 7
// lag eine Woche Stille, in der die meisten Zahlungen kippen.
//
// Der Index ist die Mahnstufe: Stufe 0 wird am Fälligkeitstag versandt, Stufe 1
// drei Tage danach, und so weiter. Nach der letzten Stufe kommt KEINE weitere
// Mail, sondern ein Punkt „Entscheidung nötig" in der Zahlungszentrale — eine
// sechste Mail liest niemand mehr.
// ═══════════════════════════════════════════════════════════════════════════
export const MAHNSTUFEN = [0, 3, 7, 14, 21] as const;

/**
 * Dieselben Abstände als SQL-CASE.
 *
 * ── WARUM DAS HIER STEHT (21.08.2026) ────────────────────────────────────
 * In `faelligeRaten` stand die Liste ein ZWEITES Mal, hartcodiert:
 *
 *     CASE r.mahnstufe WHEN 0 THEN 0 WHEN 1 THEN 7 ELSE 14 END
 *
 * Wer `MAHNSTUFEN` ändert und diese Zeile nicht, verschiebt die Anzeige und
 * nicht den Versand — genau die Fehlerklasse, die dieses Haus schon zweimal
 * Kunden gekostet hat (213 abgewiesene Buchungen, 139 gesperrte Rechnungen).
 * Jetzt wird der Ausdruck aus der Liste GEBAUT.
 */
export function mahnAbstandSql(spalte = "r.mahnstufe"): string {
  const zweige = MAHNSTUFEN
    .map((tage, stufe) => `WHEN ${stufe} THEN ${tage}`)
    .join(" ");
  // Der ELSE-Zweig kann nicht greifen (`mahnstufe < MAHNSTUFEN.length` steht in
  // der Bedingung), aber ein CASE ohne ELSE liefert NULL — und NULL >= x ist
  // niemals wahr. Dann fiele die Rate lautlos aus dem Lauf.
  return `CASE ${spalte} ${zweige} ELSE ${MAHNSTUFEN[MAHNSTUFEN.length - 1]} END`;
}
const ABO_BATCH = 40;

/** Vorab-Erinnerung: Vorgabe drei Tage vor Fälligkeit, abschaltbar (0). */
export const VORAB_TAGE_VORGABE = 3;

/**
 * Wie viele Tage vor der Fälligkeit geht die freundliche Vorabinfo raus?
 *
 * Einstellbar in /admin/einstellungen (`abo_vorab_tage`). 0 schaltet sie ab.
 * Sie hebt die Zahlquote — aber es ist die Entscheidung des Betreibers, ob
 * seine Kunden zweimal im Monat von ihm hören.
 */
export async function vorabTage(): Promise<number> {
  try {
    const s = await getSettings();
    if (s.abo_vorab_tage == null || s.abo_vorab_tage === "") return VORAB_TAGE_VORGABE;
    const n = Number(s.abo_vorab_tage);
    if (Number.isInteger(n) && n >= 0 && n <= 28) return n;
  } catch { /* Vorgabe gilt */ }
  return VORAB_TAGE_VORGABE;
}

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
    ADD COLUMN IF NOT EXISTS abo_stopp_grund TEXT,
    -- Der Anker des Zyklus (Migration 052). Auch hier, damit ein Server, der
    -- vor dem Migrationslauf startet, nicht an jeder Buchung scheitert.
    ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ
  `;
  // Storno, Rechnungs- und Überfällig-Stempel (Migration 052). Laufzeitnetz.
  await sqlPool`
    ALTER TABLE fiaon_abo_raten
    ADD COLUMN IF NOT EXISTS storniert_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS storno_grund TEXT,
    ADD COLUMN IF NOT EXISTS rechnung_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS vorab_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS ueberfaellig_seit DATE
  `;
  // ── LASTSCHRIFT-ZUSTAND (22.08.2026, E-022 / K1) ─────────────────────
  // Der Einzugsstand ist ein ZWEITES Feld neben `status`, kein neuer Wert
  // darin. Der erste Entwurf schrieb `status = 'fehlgeschlagen'` — und keine
  // der 30 Lesestellen kannte den Wert: Die Rate erschien in der Liste, die
  // Akte antwortete 404, der Motor mahnte nicht mehr, und der Tageslauf
  // legte trotzdem eine neue Rate an. Eine geplatzte Lastschrift ist eine
  // OFFENE Rate mit einer Geschichte — genau so steht sie jetzt da.
  await sqlPool`
    ALTER TABLE fiaon_abo_raten
    ADD COLUMN IF NOT EXISTS lastschrift_status VARCHAR,
    ADD COLUMN IF NOT EXISTS lastschrift_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lastschrift_grund TEXT,
    ADD COLUMN IF NOT EXISTS gc_payment_id VARCHAR
  `;
  // Nach zwölf Raten wird gefragt, nicht einfach weitergemacht (E-024).
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS abo_verlaengerung_gefragt_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS abo_verlaengert_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS abo_verlaengert_raten INTEGER NOT NULL DEFAULT 0
  `;
  // Ein GoCardless-Payment bucht genau eine Rate — auch wenn der Webhook
  // dreimal kommt (GoCardless wiederholt bei jedem Nicht-200).
  await sqlPool`
    CREATE UNIQUE INDEX IF NOT EXISTS fiaon_abo_raten_gc_payment_uidx
    ON fiaon_abo_raten (gc_payment_id) WHERE gc_payment_id IS NOT NULL
  `.catch((e) => console.warn("[FIAON-ABO] GC-Payment-Index:", e?.message));
  // Die Wand gegen Doppelrechnungen: eine offene Rate je Bestellung und
  // Fälligkeit. Der Tageslauf darf dadurch beliebig oft laufen.
  await sqlPool`
    CREATE UNIQUE INDEX IF NOT EXISTS fiaon_abo_raten_ref_faellig_uidx
    ON fiaon_abo_raten (ref, faellig_am) WHERE storniert_am IS NULL
  `.catch((e) => console.warn("[FIAON-ABO] Eindeutigkeits-Index:", e?.message));
  tabelleGeprueft = true;
}

/**
 * Der Ankertag einer Bestellung — der Tag, ab dem monatlich gerechnet wird.
 *
 * Rangfolge, und sie ist wichtig:
 *   1. `paid_at`      — der Tag, an dem ein Mensch die Zahlung gegen den
 *                       Kontoauszug bestätigt hat. Das ist „die Verbuchung".
 *   2. die früheste angewendete Bankbuchung — falls `paid_at` fehlt.
 *   3. `completed_at` — die schlechteste Auskunft, aber die einzige übrige.
 *
 * `completed_at` wird beim Abschluss des Antrags gesetzt, nicht beim
 * Geldeingang. Wer am 01.07. abschickt und am 05.07. überweist, hätte damit
 * einen Anker vier Tage vor seinem Geld — und bekäme jede Rechnung zu früh.
 */
export async function aboAnker(ref: string): Promise<{ tag: string | null; quelle: string }> {
  const [a] = (await sqlPool`
    SELECT a.paid_at, a.completed_at,
           (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank,
           (SELECT MIN(r.faellig_am) FROM fiaon_abo_raten r
             WHERE r.ref = a.ref AND r.storniert_am IS NULL) AS erste_faelligkeit
    FROM fiaon_applications a WHERE a.ref = ${ref}
  `) as any[];
  if (!a) return { tag: null, quelle: "Bestellung nicht gefunden" };
  const ausPaid = ankerTag(a.paid_at);
  if (ausPaid) return { tag: ausPaid, quelle: "Verbuchung (paid_at)" };
  const ausBank = ankerTag(a.bank);
  if (ausBank) return { tag: ausBank, quelle: "Bankbuchung" };
  const ausAbschluss = ankerTag(a.completed_at);
  if (ausAbschluss) return { tag: ausAbschluss, quelle: "Antragsabschluss (ersatzweise)" };
  // ── LETZTER HALT: DER RHYTHMUS, DER SCHON LÄUFT ────────────────────────
  // Gemessen am 16.08.2026: 34 von 325 bezahlten Bestellungen mit offener
  // Rate haben ÜBERHAUPT keinen Buchungstag — paid_at, Bankbuchung und
  // completed_at sind alle leer. Ihre Raten stammen aus einem alten
  // Nachtrag, der `created_at` benutzte.
  //
  // Ohne Anker würde der Tageslauf sie überspringen: Diese 34 Kunden
  // bekämen ab jetzt lautlos keine Rechnung mehr. Ein Abo, das aufhört, weil
  // ein Feld leer ist, ist schlimmer als ein Termin, der einen Tag daneben
  // liegt.
  //
  // Deshalb wird der Anker aus der ERSTEN bestehenden Fälligkeit abgeleitet
  // (ein Monat davor) — das ist der Rhythmus, den der Kunde ohnehin kennt.
  // Ausdrücklich als „abgeleitet" benannt: Die Akte zeigt es an, und der
  // Betreiber sieht in reports/mess-ohne-anker.csv, wo er den echten
  // Buchungstag nachtragen sollte.
  const ausKette = ankerTag(a.erste_faelligkeit);
  if (ausKette) {
    const d = new Date(`${ausKette}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return {
      tag: d.toISOString().slice(0, 10),
      quelle: "abgeleitet aus der bestehenden Ratenkette — Buchungstag fehlt, bitte nachtragen",
    };
  }
  return { tag: null, quelle: "kein Buchungstag hinterlegt" };
}

/**
 * Derselbe Anker als SQL-Ausdruck, für Abfragen über viele Zeilen.
 *
 * Muss dieselbe Rangfolge treffen wie `aboAnker`. Zwei Fassungen wären zwei
 * Gelegenheiten, verschieden zu antworten — deshalb steht der Ausdruck hier
 * neben der Funktion und nicht in drei Abfragen.
 */
export const ABO_ANKER_SQL = `COALESCE(
  a.paid_at,
  (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t WHERE t.matched_ref = a.ref AND t.applied),
  a.completed_at,
  (SELECT MIN(r0.faellig_am) - INTERVAL '1 month' FROM fiaon_abo_raten r0
    WHERE r0.ref = a.ref AND r0.storniert_am IS NULL)
)`;

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
      SELECT ref, type, pack_key, payment_reference, pack_name, amount_due, payment_status,
             completed_at, paid_at, merged_into, abo_gestoppt_am
      FROM fiaon_applications WHERE ref = ${ref}
    `;
    if (!app) return { angelegt: false, grund: "Bestellung nicht gefunden" };
    // ── RATEN NUR FÜR BEZAHLTE PAKETE ────────────────────────────────────
    // Der Betreiber: „Rate entsteht NUR bei bankbestätigt bezahltem Paket."
    // `payment_status = 'paid'` wird ausschließlich von den drei Buchungswegen
    // gesetzt, an denen ein Mensch oder der Kontoabgleich die Zahlung gegen den
    // Kontoauszug bestätigt hat (mark-paid, Kontoabgleich, Vertriebsleitung).
    if (app.payment_status !== "paid") return { angelegt: false, grund: "nicht bezahlt" };
    if (app.merged_into) return { angelegt: false, grund: "zusammengeführt" };
    if (app.abo_gestoppt_am) return { angelegt: false, grund: "Abo gestoppt" };
    if (istBonitaetsCheck(app)) return { angelegt: false, grund: "Bonitäts-Check ist kein Abo" };
    const betrag = cents(app.amount_due) || paketPreisCents(app.pack_key);
    if (betrag <= 0) return { angelegt: false, grund: "Betrag unklar" };
    const referenz = app.payment_reference || app.ref;

    const { tag: anker } = await aboAnker(ref);
    if (!anker) return { angelegt: false, grund: "Kein Buchungstag — der Zyklus ist nicht berechenbar" };

    // Rate 1: die Startzahlung, als bezahlt dokumentiert. Ohne sie fehlt der
    // Ankerpunkt, von dem alle weiteren Fälligkeiten ausgehen.
    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${ref}, 1, ${referenz}, ${betrag}, ${anker}::date, 'bezahlt',
              ${app.paid_at || app.completed_at || new Date()}, 'auto', 'Startzahlung')
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;

    // Rate 2: erste Monatsrate — am Jahrestag des Buchungstags.
    const [vorhanden] = await sqlPool`
      SELECT COUNT(*)::int AS c FROM fiaon_abo_raten
      WHERE ref = ${ref} AND rate_nr > 1 AND storniert_am IS NULL
    `;
    if (Number(vorhanden.c) > 0) return { angelegt: false, grund: "Kette existiert bereits" };

    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle)
      VALUES (${ref}, 2, ${`${referenz}-2`}, ${betrag}, ${faelligkeit(anker, 1)}::date, 'offen', 'auto')
      ON CONFLICT DO NOTHING
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
 * ── DER TERMIN WANDERT NICHT MIT DER ZAHLUNG ───────────────────────────────
 * Hier wurde bis zum 16.08.2026 „30 Tage ab Zahlungseingang" gerechnet, mit
 * der Begründung, ein Säumiger dürfe nicht schon nach 20 Tagen wieder fällig
 * sein. Der Nebeneffekt: Wer dreimal eine Woche zu spät zahlt, hat seinen
 * Abo-Tag um drei Wochen verschoben — und niemand hat das entschieden.
 *
 * Der Anker ist der Buchungstag der ERSTZAHLUNG und bleibt es. Wer am 05.07.
 * gekauft hat, ist am 05. jedes Monats fällig, auch wenn er im August erst am
 * 19. gezahlt hat. Der Betreiber hat dafür einen Namen: „sein Tag".
 *
 * `abDatum` bleibt als Parameter erhalten, wird aber nur noch gebraucht, um
 * die richtige nächste Fälligkeit zu FINDEN (welcher Jahrestag ist der
 * nächste?), nicht um sie zu VERSCHIEBEN.
 */
export const ABO_LAUFZEIT_RATEN = 12;

export async function naechsteRateAnlegen(
  ref: string,
  letzteRate: { rate_nr: number; faellig_am: any; betrag_cents: number; zahlungsreferenz: string },
  abDatum?: string,
) {
  const [app] = await sqlPool`
    SELECT payment_reference, ref, abo_gestoppt_am, amount_due, pack_key, abo_verlaengert_raten
    FROM fiaon_applications WHERE ref = ${ref}
  `;
  if (!app || app.abo_gestoppt_am) return;
  // ── NACH RATE 12 WIRD GEFRAGT (E-024, 22.08.2026) ─────────────────────
  // Justin: „Nach der 12. Rate wird der Kunde gefragt, ob er bleiben will."
  // Die Kette endet hier; eine 13. Rate entsteht erst, wenn der Kunde im
  // Bereich Ja sagt (abo_verlaengert_raten wächst dann um 12).
  const grenze = ABO_LAUFZEIT_RATEN + Number(app.abo_verlaengert_raten || 0);
  if (Number(letzteRate.rate_nr) >= grenze) return;
  const { tag: anker } = await aboAnker(ref);
  if (!anker) return;
  const referenz = app.payment_reference || app.ref;
  const nr = Number(letzteRate.rate_nr) + 1;
  // Betrag immer frisch aus dem Katalog bzw. der Bestellung: ändert der
  // Betreiber das Paket, gilt der neue Preis ab der nächsten Rate.
  const betrag = paketPreisCents(app.pack_key) || cents(app.amount_due) || Number(letzteRate.betrag_cents);
  // Der nächste Jahrestag NACH der gerade bezahlten Fälligkeit. Nicht nach
  // dem Zahlungstag — sonst überspringt eine sehr späte Zahlung einen Monat.
  const bisher = ankerTag(letzteRate.faellig_am) ?? abDatum ?? berlinToday();
  const faellig = naechsteFaelligkeit(anker, bisher);
  await sqlPool`
    INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle)
    VALUES (${ref}, ${nr}, ${`${referenz}-${nr}`}, ${betrag}, ${faellig}::date, 'offen', 'auto')
    ON CONFLICT DO NOTHING
  `;
}

/**
 * Bestandsaufnahme: legt für ALLE bezahlten Bestellungen die Ratenkette an.
 *
 * `rueckwirkend = false` (Vorgabe): die offene Rate ist die NÄCHSTE künftige
 * Fälligkeit. Für Monate, die nie in Rechnung gestellt wurden, wird niemand
 * gemahnt.
 * `rueckwirkend = true`: die offene Rate ist die letzte verstrichene Fälligkeit
 * — der Kunde ist damit sofort überfällig. Bewusste Entscheidung des Vorgesetzten.
 */
/**
 * Stellt sicher, dass JEDE bezahlte Paketbestellung eine Ratenkette hat.
 *
 * Warum ohne Knopf: Wer ein Paket kauft, hat ein Abo — das ist keine
 * Einzelfallentscheidung, sondern die Regel des Geschäfts. Der frühere Knopf
 * „Ketten anlegen" verlangte vom Vorgesetzten eine Zustimmung zu etwas, das
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
      AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.pack_key IS DISTINCT FROM 'schufa'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r
                       WHERE r.ref = a.ref AND r.rate_nr > 1 AND r.storniert_am IS NULL)
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
    SELECT a.ref, a.type, a.pack_key, a.payment_reference, a.pack_name, a.amount_due,
           a.completed_at, a.paid_at,
           (SELECT MIN(t.booked_at) FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank_at
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND NOT COALESCE(a.alt_bestand, FALSE)
      AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      -- SCHUFA erzeugt NIE eine Rate. Dreifach abgesichert (Typ, Referenz,
      -- Paketname/Betrag), weil jedes einzelne Merkmal irgendwo fehlt.
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.pack_key IS DISTINCT FROM 'schufa'
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r
                       WHERE r.ref = a.ref AND r.rate_nr > 1 AND r.storniert_am IS NULL)
    ORDER BY COALESCE(a.paid_at, a.completed_at) DESC
  `;
  let neu = 0, uebersprungen = 0;
  for (const app of apps) {
    if (istBonitaetsCheck(app)) { uebersprungen++; continue; }
    const betrag = paketPreisCents(app.pack_key) || cents(app.amount_due);
    if (betrag <= 0) { uebersprungen++; continue; }
    // Derselbe Anker wie überall — ohne ihn ist der Zyklus nicht berechenbar
    // und der Kunde bekäme einen erfundenen Termin.
    const anker = ankerTag(app.paid_at) ?? ankerTag(app.bank_at) ?? ankerTag(app.completed_at);
    if (!anker) { uebersprungen++; continue; }

    const referenz = app.payment_reference || app.ref;
    // Rate 2 ist die erste Monatsrate. Vergangene Zyklen zählen mit, damit die
    // Ratennummer zum tatsächlichen Alter passt (und nicht jeder Bestandskunde
    // wieder bei Rate 2 anfängt).
    const vergangen = zyklenBis(anker, heute);
    const zyklusNr = opts.rueckwirkend ? Math.max(1, vergangen) : vergangen + 1;
    const rateNr = zyklusNr + 1;
    const faellig = faelligkeit(anker, zyklusNr);

    if (opts.nurZaehlen) { neu++; continue; }

    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, bezahlt_am, quelle, notiz)
      VALUES (${app.ref}, 1, ${referenz}, ${betrag}, ${anker}::date, 'bezahlt',
              ${app.paid_at || app.bank_at || app.completed_at}, 'auto', 'Startzahlung')
      ON CONFLICT (ref, rate_nr) DO NOTHING
    `;
    await sqlPool`
      INSERT INTO fiaon_abo_raten (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
      VALUES (${app.ref}, ${rateNr}, ${`${referenz}-${rateNr}`}, ${betrag}, ${faellig}::date, 'offen', 'nachgezogen',
              ${opts.rueckwirkend ? "Bestandsaufnahme (rückwirkend fällig)" : "Bestandsaufnahme (nächste Fälligkeit)"})
      ON CONFLICT DO NOTHING
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
           a.person_id, a.email, a.contact_email, a.billing_email, a.pack_name,
           a.amount_due, a.ref,
           ag.name AS agent_name
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE r.status = 'offen'
      AND r.storniert_am IS NULL
      AND r.faellig_am <= ${heute}::date
      AND r.mahnstufe < ${MAHNSTUFEN.length}
      -- ══════════════════════════════════════════════════════════════════
      -- HIER STAND EIN FILTER AUF DIE E-MAIL DER BESTELLZEILE.
      --
      -- Er hat Raten, an deren Bestellung keine Adresse steht, LAUTLOS aus
      -- dem Lauf genommen. Nicht als Fehler, nicht als Hinweis — sie waren
      -- einfach nicht dabei. Genau das ist der gemeldete Fall: „Die E-Mail
      -- war am zweiten Lead vorhanden, am Antrag leer, und der Versand
      -- scheiterte trotz Nachtrag."
      --
      -- Die Adresse löst jetzt „server/lib/fiaon-empfaenger.ts" über die
      -- PERSON auf (aktuelle Adresse, dann Aliase). Findet auch die nichts,
      -- scheitert der Versand SICHTBAR und steht mit Grund im Protokoll.
      -- Ein Kunde, den wir nicht erreichen können, muss auffallen.
      -- ══════════════════════════════════════════════════════════════════
      AND (r.letzte_erinnerung_at IS NULL OR r.letzte_erinnerung_at < NOW() - INTERVAL '20 hours')
      -- Stufe erst, wenn der Abstand erreicht ist. Der Ausdruck kommt aus
      -- MAHNSTUFEN (Tag 0/3/7/14/21) und steht nicht mehr zweimal da.
      AND (${heute}::date - r.faellig_am) >= ${sqlPool.unsafe(mahnAbstandSql())}
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

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF
//
// Drei Aufgaben, jeden Tag, in dieser Reihenfolge — und jede davon so gebaut,
// dass ein zweiter Lauf am selben Tag nichts doppelt macht:
//
//   1. AM FÄLLIGKEITSTAG entsteht die Rate (falls nicht vorhanden) und die
//      Monatsrechnung geht raus.
//   2. VORAB, X Tage davor, geht die freundliche Erinnerung raus. Sie ist
//      keine Mahnung: Die Mahnstufe bleibt, wo sie ist.
//   3. AM TAG DANACH wird die unbezahlte Rate überfällig, kommt in die
//      Inkasso-Arbeitsliste und bekommt einen Menschen zugeteilt.
//
// ── WARUM IDEMPOTENZ HIER KEIN FEINSCHLIFF IST ─────────────────────────────
// Der Lauf erzeugt RECHNUNGEN. Läuft er zweimal, bekommt ein Kunde zwei
// Rechnungen für denselben Monat — und ruft an. Die Wand steht deshalb nicht
// in diesem Code, sondern in der Datenbank: ein eindeutiger Index auf
// (ref, faellig_am) für alles, was nicht storniert ist. Ein zweiter Lauf
// prallt dort ab, auch wenn er gleichzeitig in einem anderen Prozess läuft.
// ═══════════════════════════════════════════════════════════════════════════

export interface TageslaufErgebnis {
  tag: string;
  ratenErzeugt: number;
  rechnungenVersandt: number;
  rechnungenFehlgeschlagen: number;
  vorabVersandt: number;
  ueberfaelligNeu: number;
  zugeteilt: number;
  uebersprungenFenster: boolean;
  meldung: string;
}

/**
 * Erzeugt die heute fälligen Raten. Gibt zurück, wie viele NEU entstanden.
 *
 * Eine Rate entsteht nur für ein bezahltes Paket. `aboNachziehen` hält diese
 * Grenze (payment_status = 'paid', kein SCHUFA, kein Abo-Stopp) — hier wird
 * sie deshalb nicht ein zweites Mal formuliert.
 */
async function ratenFuerHeuteErzeugen(heute: string, lauf: Lauf = sqlPool): Promise<number> {
  const kandidaten = (await lauf.unsafe(`
    SELECT a.ref, a.payment_reference, a.pack_key, a.amount_due,
           ${ABO_ANKER_SQL} AS anker_at,
           (SELECT MAX(r.rate_nr) FROM fiaon_abo_raten r WHERE r.ref = a.ref) AS letzte_nr
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
      AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.abo_gestoppt_am IS NULL AND NOT COALESCE(a.alt_bestand, FALSE)
      AND a.type IS DISTINCT FROM 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
      AND a.pack_key IS DISTINCT FROM 'schufa'
      -- Nichts anlegen, solange noch eine offene Rate im Raum steht: Es soll
      -- kein Schuldenberg entstehen, den niemand entschieden hat.
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r
                       WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL)
      -- E-024: nach der Laufzeit keine neue Rate ohne Ja des Kunden
      AND COALESCE((SELECT MAX(r.rate_nr) FROM fiaon_abo_raten r WHERE r.ref = a.ref), 0)
          < ${ABO_LAUFZEIT_RATEN} + COALESCE(a.abo_verlaengert_raten, 0)
  `)) as any[];

  let erzeugt = 0;
  for (const k of kandidaten) {
    const anker = ankerTag(k.anker_at);
    if (!anker) continue;
    // Ist HEUTE ein Fälligkeitstag dieses Kunden?
    const nr = zyklenBis(anker, heute);
    if (nr < 1 || faelligkeit(anker, nr) !== heute) continue;

    const betrag = paketPreisCents(k.pack_key) || cents(k.amount_due);
    if (betrag <= 0) continue;
    const referenz = k.payment_reference || k.ref;
    const rateNr = Math.max(Number(k.letzte_nr || 1) + 1, 2);
    const [neu] = (await lauf`
      INSERT INTO fiaon_abo_raten
        (ref, rate_nr, zahlungsreferenz, betrag_cents, faellig_am, status, quelle, notiz)
      VALUES (${k.ref}, ${rateNr}, ${`${referenz}-${rateNr}`}, ${betrag}, ${heute}::date,
              'offen', 'tageslauf', ${`Monatsrate zum Jahrestag der Buchung (${kurzTag(anker)})`})
      ON CONFLICT DO NOTHING
      RETURNING id
    `) as any[];
    if (neu) erzeugt++;
  }
  return erzeugt;
}

/**
 * Die freundliche Vorabinfo, X Tage vor der Fälligkeit.
 *
 * Sie hebt die Zahlquote — aber sie ist KEINE Mahnung. `stufeErhoehen: false`
 * ist deshalb nicht optional: Ein Kunde, der drei Tage vor dem Termin auf
 * Mahnstufe 1 gesetzt wird, steht nach zwei Wochen auf „Entscheidung nötig",
 * obwohl er nie zu spät war.
 *
 * `vorab_am` verhindert, dass sie zweimal rausgeht.
 */
async function vorabErinnern(heute: string, tage: number): Promise<number> {
  if (tage <= 0) return 0;
  const zielTag = tagMinus(heute, -tage); // heute + tage
  const batch = (await sqlPool`
    SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
           a.person_id, a.email, a.contact_email, a.billing_email, a.pack_name,
           a.amount_due, a.ref
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    WHERE r.status = 'offen' AND r.storniert_am IS NULL
      AND r.faellig_am = ${zielTag}::date
      AND r.vorab_am IS NULL
    ORDER BY r.id
    LIMIT ${ABO_BATCH}
  `) as any[];

  let raus = 0;
  for (const r of batch) {
    const erg = await rateErinnern(r, { stufeErhoehen: false });
    // Der Stempel wird auch bei einem Fehlschlag NICHT gesetzt — sonst
    // verlöre der Kunde seine Vorabinfo, weil Make einmal hustete.
    if (erg.ok) {
      await sqlPool`UPDATE fiaon_abo_raten SET vorab_am = NOW() WHERE id = ${r.id}`;
      raus++;
    }
  }
  return raus;
}

/**
 * Was gestern fällig war und nicht bezahlt ist, ist ab heute überfällig.
 *
 * Der Betreiber: „Ist die Rate am 06.08. nicht als bezahlt gebucht, steht er
 * im Forderungsmanagement." Genau dieser eine Tag Abstand — nicht drei, nicht
 * sieben.
 */
async function ueberfaelligStellen(
  heute: string, lauf: Lauf = sqlPool,
): Promise<{ neu: number; zugeteilt: number }> {
  const neu = (await lauf`
    UPDATE fiaon_abo_raten r
    SET ueberfaellig_seit = r.faellig_am + 1, updated_at = NOW()
    FROM fiaon_applications a
    WHERE a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
      AND a.payment_status = 'paid'
      AND r.status = 'offen' AND r.storniert_am IS NULL
      AND r.faellig_am < ${heute}::date
      AND r.ueberfaellig_seit IS NULL
    RETURNING r.id, r.ref, r.rate_nr, r.betrag_cents, r.faellig_am
  `) as any[];

  // ══════════════════════════════════════════════════════════════════════
  // DIE AKTE ERFÄHRT VOM ZUSTÄNDIGKEITSWECHSEL (21.08.2026)
  //
  // ── DER AUFTRAG ─────────────────────────────────────────────────────
  // „Tag 1 überfällig: Kunde wechselt in die Zuständigkeit
  //  Forderungsmanagement, erscheint in der Arbeitsliste, Akteneintrag."
  //
  // Die ersten zwei Teile liefen schon: `ueberfaellig_seit` wird gesetzt, und
  // `zustaendigeRolle` liest das Datum. Der Akteneintrag fehlte — und damit
  // die einzige Spur, die ein Mensch beim Öffnen der Akte sieht. Wer nicht
  // weiss, WANN und WARUM ein Kunde ins Forderungsmanagement gewandert ist,
  // beginnt das Gespräch mit einer Frage statt mit einer Auskunft.
  //
  // Kein `.catch(() => {})`: Bleibt der Eintrag aus, steht es im Log.
  // ══════════════════════════════════════════════════════════════════════
  for (const r of neu) {
    const betrag = (Number(r.betrag_cents || 0) / 100).toFixed(2);
    const faellig = new Date(r.faellig_am).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
    await lauf`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      SELECT ${String(r.ref)}, a.person_id, NULL, 'System', 'system',
             ${`Rate ${r.rate_nr} über ${betrag} € war am ${faellig} fällig und ist nicht `
               + "gebucht. Ab heute liegt die Zuständigkeit beim Forderungsmanagement — "
               + "der Kunde steht in deren Arbeitsliste."}
      FROM fiaon_applications a WHERE a.ref = ${String(r.ref)}
    `.catch((e) => console.error(`[FIAON-ABO] Akteneintrag zum Zuständigkeitswechsel `
      + `(${r.ref}, Rate ${r.rate_nr}) nicht geschrieben — die Akte zeigt den Wechsel nicht:`, e));
  }

  // Zuteilung an den Inkasso-Menschen mit der kleinsten Last — die bestehende
  // Logik, nicht eine zweite daneben.
  let zugeteilt = 0;
  try {
    const { inkassoVerteilen } = await import("../lib/fiaon-inkasso");
    const erg = await inkassoVerteilen({ schreiben: true, anzahl: 200 }, lauf);
    zugeteilt = erg.verteilt;
  } catch (e) {
    console.error("[FIAON-ABO] Zuteilung im Tageslauf:", e);
  }
  return { neu: neu.length, zugeteilt };
}

/**
 * Der Tageslauf. Einmal am Tag, idempotent, mit Klartext-Meldung.
 *
 * Der Versand hält sich ans Versandfenster (08–20 Uhr Berlin). Das ERZEUGEN
 * der Raten und das Überfälligstellen tun das NICHT: Eine Fälligkeit ist eine
 * Tatsache und hat keine Uhrzeit. Nur Mails an Menschen haben eine.
 */
/**
 * `lauf` ist der Griff in die Datenbank. In der Produktion der gemeinsame
 * Pool, im Prüfstand eine Transaktion, die am Ende zurückgerollt wird —
 * anders ließe sich ein Lauf, der Rechnungen erzeugt, nicht gegen die
 * Produktionsdatenbank prüfen.
 */
export async function aboTageslauf(
  opts: { force?: boolean; lauf?: Lauf } = {},
): Promise<TageslaufErgebnis> {
  const lauf = opts.lauf ?? sqlPool;
  // Die Tabellenprüfung läuft NICHT, wenn ein eigener Griff mitgegeben wurde.
  // Sie führt ALTER TABLE und CREATE INDEX aus — über den globalen Pool, also
  // auf einer ZWEITEN Verbindung. Hält der Prüfstand gerade eine Transaktion
  // auf fiaon_abo_raten offen, warten sich beide gegenseitig tot, bis das
  // Statement-Zeitlimit zuschlägt. Genau das ist am 16.08.2026 passiert.
  // Wer einen eigenen Griff mitgibt, hat die Tabellen ohnehin schon.
  if (!opts.lauf) await ensureAboTabellen();
  const heute = berlinToday();
  const erg: TageslaufErgebnis = {
    tag: heute, ratenErzeugt: 0, rechnungenVersandt: 0, rechnungenFehlgeschlagen: 0,
    vorabVersandt: 0, ueberfaelligNeu: 0, zugeteilt: 0, uebersprungenFenster: false,
    meldung: "",
  };

  // 1. Die Raten des Tages — immer, unabhängig vom Versandfenster.
  erg.ratenErzeugt = await ratenFuerHeuteErzeugen(heute, lauf);

  // 3. Überfällig und zuteilen — ebenfalls uhrzeitunabhängig. Bewusst VOR dem
  //    Versand: Wer heute überfällig wird, soll auch heute jemandem gehören.
  const ueber = await ueberfaelligStellen(heute, lauf);
  erg.ueberfaelligNeu = ueber.neu;
  erg.zugeteilt = ueber.zugeteilt;

  // 2. Der Versand — nur im Fenster und nur mit eingeschaltetem Motor.
  const settings = await getSettings();
  if (settings.abo_motor_enabled === "0" || (!(await imVersandfenster()) && !opts.force)) {
    erg.uebersprungenFenster = true;
    erg.meldung = `${erg.ratenErzeugt} Rate(n) angelegt, ${erg.ueberfaelligNeu} überfällig geworden. `
      + `Versand ausgesetzt (${settings.abo_motor_enabled === "0" ? "Motor aus" : "außerhalb 08–20 Uhr"}).`;
    return erg;
  }

  const motor = await aboMotor({ force: opts.force });
  erg.rechnungenVersandt = motor.gesendet;
  erg.rechnungenFehlgeschlagen = motor.fehlgeschlagen;
  erg.vorabVersandt = await vorabErinnern(heute, await vorabTage());

  const teile = [
    `${erg.ratenErzeugt} Rate(n) angelegt`,
    `${erg.rechnungenVersandt} Rechnung(en) versandt`,
  ];
  if (erg.vorabVersandt > 0) teile.push(`${erg.vorabVersandt} Vorabinfo(s)`);
  if (erg.rechnungenFehlgeschlagen > 0) teile.push(`${erg.rechnungenFehlgeschlagen} NICHT zugestellt`);
  teile.push(`${erg.ueberfaelligNeu} überfällig geworden`);
  if (erg.zugeteilt > 0) teile.push(`${erg.zugeteilt} zugeteilt`);
  erg.meldung = `${teile.join(" · ")}.`;
  console.log(`[FIAON-ABO] Tageslauf ${heute}: ${erg.meldung}`);
  return erg;
}

/**
 * Welche Mahnstufe gilt nach dieser Erinnerung?
 *
 * ── EINE STUFE SPRINGT NIE ────────────────────────────────────────────────
 * Zwei Bedingungen, und beide müssen erfüllt sein:
 *
 *   1. Genau EINE Stufe weiter. `Math.min(…, bisher + 1)` allein reicht
 *      nicht — es verhindert nur den Sprung nach oben, nicht den Fall, dass
 *      Stufe 2 vergeben wird, ohne dass Stufe 1 je verschickt wurde.
 *   2. Wer auf Stufe 1 oder höher steht, MUSS eine versandte Erinnerung
 *      vorweisen können (`letzte_erinnerung_at`). Steht dort nichts, ist die
 *      Stufe aus einem Bestandsnachtrag gekommen und nicht aus einer Mail —
 *      dann wird sie NICHT weitergezählt, sondern auf 1 gesetzt.
 *
 * Der Grund steht im Teamfeedback: Kunden trugen Mahnstufe 1 aus dem
 * Bestandsnachtrag, ohne je eine Mahnung gesehen zu haben. Wer darauf
 * aufbaut, schickt jemandem als ERSTE Nachricht eine zweite Mahnung.
 *
 * Als eigene, reine Funktion — damit der Prüfstand sie durchspielen kann,
 * ohne eine Mail zu verschicken.
 */
export function naechsteMahnstufe(
  bisher: number, stufeErhoehen: boolean, hatEchteVorstufe: boolean,
): number {
  if (!stufeErhoehen) return bisher;
  if (bisher >= 1 && !hatEchteVorstufe) return 1;
  return Math.min(MAHNSTUFEN.length, bisher + 1);
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
  const stufe = naechsteMahnstufe(
    Number(r.mahnstufe || 0), stufeErhoehen, r.letzte_erinnerung_at != null,
  );
  const versand = await sendMakeWebhookMitGrund("abo_payment_reminder", aboErinnerungPayload(r) as any);
  if (versand.ok) {
    // ── DIE STUFE UND IHR BELEG STEHEN ZUSAMMEN (Migration 073) ─────────
    // Die Stufe stieg schon vorher nur bei bestätigtem Versand — richtig, aber
    // nicht nachweisbar: Man sah die Stufe und musste glauben, dass eine Mail
    // dahinterstand. `mahnstufe_bestaetigt_am` ist dieser Nachweis.
    await sqlPool`
      UPDATE fiaon_abo_raten
      SET mahnstufe = ${stufe}, erinnerungen = erinnerungen + 1,
          letzte_erinnerung_at = NOW(),
          mahnstufe_bestaetigt_am = NOW(),
          mahnstufe_versuch_am = NOW(),
          mahnstufe_fehler = NULL,
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
        letzter_fehler_at = NOW(),
        -- Der VERSUCH wird festgehalten, die Stufe nicht. So ist im Nachhinein
        -- unterscheidbar: „nie versucht" gegen „versucht und gescheitert".
        mahnstufe_versuch_am = NOW(),
        mahnstufe_fehler = ${versand.grund || "Unbekannter Fehler beim Versand"},
        updated_at = NOW()
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
// ── ÜBER DIE EINE REGISTRATUR (17.08.2026) ─────────────────────────────────
// Hier stand eine eigene `if (NODE_ENV === "production" || ABO_MOTOR_LOKAL)`-
// Prüfung. Sie war richtig — aber die vierte Fassung derselben Regel im Haus.
// Der lokale Testschalter bleibt: `tageslauf` nimmt ihn als `auchWenn` auf.
//
// Der Tageslauf läuft STÜNDLICH, nicht einmal am Tag: Er ist idempotent, und
// ein Prozess, der um 03:00 neu startet, hätte bei einem echten Tageslauf den
// Tag verpasst. Stündlich heißt: Der Lauf holt sich selbst ein.
tageslauf(
  "abo-motor",
  () => { void aboTageslauf().catch((e) => console.error("[FIAON-ABO] Tageslauf:", e)); },
  60 * 60 * 1000,
  { auchWenn: process.env.ABO_MOTOR_LOKAL === "1", beimStartNach: 90_000 },
);

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
    zyklus: ABO_ZYKLUS,
    vorabTage: await vorabTage(),
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
             -- ══════════════════════════════════════════════════════════════
             -- WER IST FÜR DIESE RATE ZUSTÄNDIG?
             --
             -- ── DER BEFUND (13.08.2026) ───────────────────────────────────
             -- Der Vorgesetzte, mit Recht alarmiert: „Bei ‚Abo — monatliche
             -- Paketrate' — warum sind Agenten (Lucas, Florentine, Daniel)
             -- ausgewählt? ALLE Kunden, die eine offene Rate haben, müssen zum
             -- Forderungsmanagement. Warum haben die Agenten die Kunden
             -- drinnen? DAS DÜRFEN SIE NICHT!"
             --
             -- Gemessen: KEINE Rate ist einem Vertriebsagenten zugeteilt. Die
             -- Zuteilung war korrekt — 86 Raten bei Diana und Hans-Jürgen.
             --
             -- Hier stand „a.assigned_agent_id": der Vertriebsagent, der den
             -- Kunden GEWONNEN hat. Das ist Provisionsgeschichte, keine
             -- Zuständigkeit. Neben „fällig 14.08.26" gelesen sah es aus wie
             -- eine Zuweisung — und der Vorgesetzte hat es genau so gelesen.
             --
             -- Eine Anzeige, die einen Verantwortlichen suggeriert, wo keiner
             -- steht, ist schlimmer als eine leere Spalte.
             --
             -- Jetzt steht hier der INKASSO-Zuständige. Ist keiner zugeteilt,
             -- bleibt das Feld leer und die Oberfläche sagt es ausdrücklich.
             -- ══════════════════════════════════════════════════════════════
             ink.name AS agent_name,
             vertr.name AS vertrieb_name,
             ($1::date - r.faellig_am) AS tage_ueberfaellig
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
      LEFT JOIN fiaon_agents ink ON ink.id = r.inkasso_agent_id
      LEFT JOIN fiaon_agents vertr ON vertr.id = a.assigned_agent_id
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
        paket: r.paket || null,
        // Der INKASSO-Zustaendige. Leer heisst: noch niemand — das sagt die
        // Oberflaeche dann ausdruecklich, statt einen Namen zu erfinden.
        agent: r.agent_name || null,
        // Der Vertriebsagent bleibt sichtbar, aber getrennt benannt: Er ist die
        // Provisionsgeschichte, nicht der Verantwortliche fuer die Rate.
        vertrieb: r.vertrieb_name || null,
        notiz: r.notiz || null,
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
/**
 * EINE Buchung für „Rate ist bezahlt" — Admin-Knopf UND Lastschrift-Webhook.
 *
 * Vorher gab es zwei: Der Knopf buchte mit Prämie, nächster Rate und
 * Akteneintrag; der Webhook setzte nur `status = 'bezahlt'`. Wer per
 * Lastschrift zahlte, bekam damit keine Folge-Rate, der Inkasso-Mitarbeiter
 * keine Prämie, die Akte keinen Eintrag. Zwei Wege, eine Wahrheit weniger.
 */
export async function rateBezahltBuchen(opts: {
  rateId: number;
  /** YYYY-MM-DD — der Tag, an dem das Geld angekommen ist. */
  zahlungsdatum: string;
  quelle: "admin" | "gocardless" | "bank";
  notiz?: string | null;
  gcPaymentId?: string | null;
}): Promise<{ ok: boolean; schonBezahlt?: boolean; error?: string; naechsteFaelligkeit?: string | null }> {
  await ensureAboTabellen();
  const [rate] = await sqlPool`SELECT * FROM fiaon_abo_raten WHERE id = ${opts.rateId}`;
  if (!rate) return { ok: false, error: "Rate nicht gefunden" };
  if (rate.status === "bezahlt") return { ok: true, schonBezahlt: true };

  // ── EINE RATENKETTE LAEUFT VORWAERTS (27.08.2026) ───────────────────────
  // Justin fand eine Akte, in der Rate 1 am 19.08. bezahlt war und die Raten 2
  // bis 4 am 18.08. — einen Tag FRUEHER. Entstanden ist das, weil ein
  // Bereinigungslauf jeder Rate das Buchungsdatum des Bankeingangs gab, den er
  // gerade in der Hand hielt. Ein Zahldatum, das hinter das der Vorgaengerrate
  // zurueckfaellt, ist nie richtig — es ist entweder ein Vertipper oder eine
  // falsche Zuordnung.
  //
  // Die beiden Wege reagieren mit Absicht verschieden:
  //   · Von Hand gebucht        → ABLEHNEN. Der Mensch sieht den Hinweis und
  //     traegt das richtige Datum ein.
  //   · Lastschrift bestaetigt  → ANNEHMEN und das Datum vorziehen. Eine
  //     bestaetigte Abbuchung darf niemals verlorengehen, nur weil ein
  //     aelterer Eintrag ein krummes Datum traegt.
  const [vorherige] = await sqlPool`
    SELECT MAX(bezahlt_am) AS letzte
      FROM fiaon_abo_raten
     WHERE ref = ${rate.ref} AND rate_nr < ${rate.rate_nr}
       AND status = 'bezahlt' AND bezahlt_am IS NOT NULL
  `;
  let zahlungsdatum = opts.zahlungsdatum;
  let datumVorgezogen: string | null = null;
  if (vorherige?.letzte) {
    const vorherTag = new Date(vorherige.letzte).toISOString().slice(0, 10);
    if (zahlungsdatum < vorherTag) {
      if (opts.quelle === "gocardless") {
        datumVorgezogen = zahlungsdatum;
        zahlungsdatum = vorherTag;
      } else {
        return {
          ok: false,
          error: `Das Zahldatum ${zahlungsdatum} liegt vor der vorherigen Rate (bezahlt am ${vorherTag}). `
               + `Bitte pruefen: entweder stimmt das Datum nicht, oder der Eingang gehoert zu einer anderen Rate.`,
        };
      }
    }
  }


  // Wurde das Datum vorgezogen, steht das in der Akte — sonst waere spaeter
  // nicht mehr erkennbar, warum die Rate ein anderes Datum traegt als die Bank.
  const vermerk = datumVorgezogen
    ? [opts.notiz, `Zahldatum von ${datumVorgezogen} auf ${zahlungsdatum} vorgezogen: eine spaetere Rate kann nicht vor einer frueheren bezahlt sein.`]
        .filter(Boolean).join(" · ")
    : (opts.notiz ?? null);

  const geaendert = await sqlPool`
    UPDATE fiaon_abo_raten
    SET status = 'bezahlt', bezahlt_am = ${`${zahlungsdatum}T12:00:00Z`},
        quelle = ${opts.quelle === "admin" ? rate.quelle : opts.quelle},
        lastschrift_status = ${opts.quelle === "gocardless" ? "eingezogen" : rate.lastschrift_status ?? null},
        lastschrift_am = ${opts.quelle === "gocardless" ? new Date() : rate.lastschrift_am ?? null},
        gc_payment_id = COALESCE(${opts.gcPaymentId ?? null}, gc_payment_id),
        notiz = CASE WHEN ${vermerk}::text IS NULL THEN notiz
                     ELSE CONCAT_WS(' · ', NULLIF(notiz, ''), ${vermerk}::text) END,
        updated_at = NOW()
    WHERE id = ${opts.rateId} AND status <> 'bezahlt'
  `;
  if ((geaendert as any).count === 0) return { ok: true, schonBezahlt: true };

  // Die nächste Rate rechnet ab dem Zahlungsdatum — nicht ab der bisherigen
  // Fälligkeit. Zahlt jemand zehn Tage zu spät, ist der nächste Termin
  // 30 Tage nach seiner Zahlung.
  await naechsteRateAnlegen(rate.ref, rate as any, zahlungsdatum);

  // ── DIE FRAGE NACH RATE 12 (E-024) ────────────────────────────────────
  if (Number(rate.rate_nr) > 0 && Number(rate.rate_nr) % ABO_LAUFZEIT_RATEN === 0) {
    try {
      const [k] = (await sqlPool`
        SELECT a.ref, a.person_id, a.email, a.first_name, a.last_name, a.payment_reference, a.amount_due, a.pack_name, a.abo_verlaengerung_gefragt_am
        FROM fiaon_applications a WHERE a.ref = ${rate.ref}`) as any[];
      if (k && !k.abo_verlaengerung_gefragt_am) {
        await sqlPool`UPDATE fiaon_applications SET abo_verlaengerung_gefragt_am = NOW(), updated_at = NOW() WHERE ref = ${rate.ref}`;
        await sendMakeWebhookMitGrund("abo_verlaengerung_frage", {
          ...makePayloadFromRow(k), paket: k.pack_name || null,
          betrag: k.amount_due != null ? String(k.amount_due) : null,
          portal_url: absoluteUrl("/dashboard#abo"),
        } as any);
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
          VALUES (${rate.ref}, NULL, 'System', 'system', ${`Rate ${rate.rate_nr} bezahlt — Laufzeit erreicht. Der Kunde wurde gefragt, ob er bleiben möchte (E-024). Ohne Ja entsteht keine weitere Rate.`})
        `.catch(() => {});
      }
    } catch (e) { console.error("[FIAON-ABO] Verlängerungsfrage:", e); }
  }

  // ── Inkasso-Prämie ────────────────────────────────────────────────────
  // HIER und nur hier. Der Buchungsweg für eine Rate ist die einzige Stelle,
  // an der zuverlässig feststeht, dass Geld angekommen ist. `praemieBuchen`
  // entscheidet selbst, OB gebucht wird (Selbstzahler: nein). Ein Fehler hier
  // darf die Ratenbuchung nicht umwerfen — die ist die wichtigere Wahrheit.
  try {
    const { praemieBuchen } = await import("../lib/fiaon-inkasso");
    const p = await praemieBuchen(opts.rateId);
    if (!p.gebucht) console.log(`[FIAON-ABO] Rate ${opts.rateId}: keine Inkasso-Prämie (${p.grund})`);
  } catch (e) {
    console.error("[FIAON-ABO] Inkasso-Prämie:", e);
  }

  const quelleText = opts.quelle === "gocardless" ? "per Lastschrift eingezogen" : opts.quelle === "bank" ? "über den Kontoauszug gebucht" : "als bezahlt gebucht";
  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${rate.ref}, NULL, 'System', 'system',
            ${`Abo-Rate ${rate.rate_nr} (${rate.zahlungsreferenz}) ${quelleText} — Zahlungseingang ${zahlungsdatum}${opts.notiz ? ` (${opts.notiz})` : ""}`})
  `.catch(() => {});
  const { tag: anker } = await aboAnker(rate.ref);
  return { ok: true, naechsteFaelligkeit: anker ? naechsteFaelligkeit(anker, zahlungsdatum) : null };
}

router.post("/admin/abo/raten/:id/bezahlt", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const pruefung = pruefeZahlungsdatum(req.body?.zahlungsdatum);
    if (pruefung.fehler) return res.status(400).json({ ok: false, error: pruefung.fehler });
    const erg = await rateBezahltBuchen({ rateId: id, zahlungsdatum: pruefung.datum, quelle: "admin" });
    if (!erg.ok) return res.status(404).json({ ok: false, error: erg.error });
    res.json({ ok: true, schonBezahlt: erg.schonBezahlt ?? false, zahlungsdatum: pruefung.datum, naechsteFaelligkeit: erg.naechsteFaelligkeit ?? null });
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
             a.person_id, a.email, a.contact_email, a.billing_email, a.pack_name,
             a.amount_due, a.ref
      FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref
      WHERE r.id = ${id}
    `;
    if (!r) return res.status(404).json({ ok: false, error: "Rate nicht gefunden" });
    if (r.status !== "offen") return res.status(400).json({ ok: false, error: "Rate ist nicht offen" });
    // Die Adresse kommt von der PERSON, nicht von der Bestellzeile. Vorher
    // wurde hier abgelehnt, sobald die Bestellzeile leer war — auch wenn die
    // Person längst eine gültige Adresse trug.
    const { empfaengerAufloesen } = await import("../lib/fiaon-empfaenger");
    const ziel = await empfaengerAufloesen({
      personId: r.person_id ?? null, ref: r.ref, ausNutzlast: r.email,
    });
    if (!ziel) {
      return res.status(400).json({
        ok: false,
        error: "Keine zustellbare E-Mail-Adresse — weder an der Person, noch als Alias, noch an der Bestellung.",
      });
    }
    if (!(await imVersandfenster())) {
      return res.status(400).json({ ok: false, error: "Außerhalb des Versandfensters (08–20 Uhr Berlin)" });
    }
    const erg = await rateErinnern(r);
    if (!erg.ok) {
      // Ehrliche Rückmeldung: Der Vorgesetzte muss wissen, dass NICHTS rausging.
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

/** Den ganzen Tageslauf von Hand anstoßen — Raten, Rechnungen, Überfällig. */
router.post("/admin/abo/tageslauf", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await aboTageslauf({ force: true })) });
  } catch (err) {
    console.error("[FIAON-ABO] tageslauf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Was hat der Motor heute getan? — die Karte in der Zahlungszentrale.
 *
 * Der Betreiber soll den Motor arbeiten SEHEN. Ein Automatismus, von dem man
 * nur erfährt, wenn er versagt, wird nicht geglaubt: Beim ersten Zweifel
 * fängt jemand an, Rechnungen von Hand zu schicken — und dann bekommt der
 * Kunde zwei.
 */
router.get("/admin/abo/motor/heute", async (_req, res) => {
  try {
    await ensureAboTabellen();
    const heute = berlinToday();
    const [k] = (await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE r.created_at::date = ${heute}::date
                           AND r.quelle = 'tageslauf')::int AS raten_heute,
        COUNT(*) FILTER (WHERE (r.letzte_erinnerung_at AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS rechnungen_heute,
        COUNT(*) FILTER (WHERE (r.vorab_am AT TIME ZONE 'Europe/Berlin')::date = ${heute}::date)::int AS vorab_heute,
        COUNT(*) FILTER (WHERE r.ueberfaellig_seit = ${heute}::date)::int AS ueberfaellig_heute,
        COUNT(*) FILTER (WHERE r.status = 'offen' AND r.storniert_am IS NULL
                           AND r.faellig_am = ${heute}::date)::int AS faellig_heute,
        COUNT(*) FILTER (WHERE r.status = 'offen' AND r.storniert_am IS NULL
                           AND r.letzter_fehler IS NOT NULL)::int AS zustellfehler
      FROM fiaon_abo_raten r
    `) as any[];
    const settings = await getSettings();
    res.json({
      ok: true,
      tag: heute,
      ratenErzeugt: Number(k.raten_heute),
      rechnungenVersandt: Number(k.rechnungen_heute),
      vorabVersandt: Number(k.vorab_heute),
      ueberfaelligGeworden: Number(k.ueberfaellig_heute),
      faelligHeute: Number(k.faellig_heute),
      zustellfehler: Number(k.zustellfehler),
      motorAktiv: settings.abo_motor_enabled !== "0",
      vorabTage: await vorabTage(),
      imFenster: await imVersandfenster(),
      // Der eine Satz, den der Betreiber lesen soll.
      meldung: `Abo-Motor: heute ${Number(k.rechnungen_heute)} Rechnung(en) versandt, `
        + `${Number(k.ueberfaellig_heute)} überfällig geworden.`,
    });
  } catch (err) {
    console.error("[FIAON-ABO] motor/heute:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Der Zyklus einer Bestellung im Klartext — für Akte und Inkasso-Karte.
 *
 * Die Formulierung kommt aus `fiaon-abo-zyklus.ts`, damit alle drei Orte
 * denselben Satz zeigen.
 */
router.get("/admin/abo/:ref/zyklus", async (req: Request, res: Response) => {
  try {
    await ensureAboTabellen();
    const ref = String(req.params.ref);
    const [a] = (await sqlPool`
      SELECT abo_gestoppt_am, abo_stopp_grund, payment_status, pack_key
      FROM fiaon_applications WHERE ref = ${ref}
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    const { tag: anker, quelle } = await aboAnker(ref);
    const settings = await getSettings();
    const [naechste] = (await sqlPool`
      SELECT faellig_am, betrag_cents, zahlungsreferenz FROM fiaon_abo_raten
      WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL
      ORDER BY faellig_am ASC LIMIT 1
    `) as any[];
    res.json({
      ok: true,
      ref,
      anker,
      ankerQuelle: quelle,
      gestoppt: a.abo_gestoppt_am != null,
      stoppGrund: a.abo_stopp_grund || null,
      naechsteFaelligkeit: anker ? naechsteFaelligkeit(anker) : null,
      offeneRate: naechste
        ? {
            faelligAm: ankerTag(naechste.faellig_am),
            betragCents: Number(naechste.betrag_cents),
            verwendungszweck: naechste.zahlungsreferenz,
          }
        : null,
      text: zyklusText(anker, {
        gestoppt: a.abo_gestoppt_am != null,
        automatik: settings.abo_motor_enabled !== "0",
      }),
    });
  } catch (err) {
    console.error("[FIAON-ABO] zyklus:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ERINNERUNGS-LAUF FÜR DIE GEÖFFNETE ANSICHT
//
// Vorher hing der Knopf am Motor. Der schaut ausschließlich auf „heute oder
// früher fällig" UND respektiert den Einführungsstichtag — steht an dem Tag
// nichts an, meldet er „0 gesendet". Für den Vorgesetzten sah das aus wie ein
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

  // `ziel_mail` prüft jetzt dieselbe Rangfolge wie der Versand: Person,
  // Alias, Bestellzeile. Eine Vorschau, die anders urteilt als der Lauf,
  // verspricht Zahlen, die hinterher nicht stimmen.
  const { zustellbarSql } = await import("../lib/fiaon-empfaenger");
  return sqlPool.unsafe(`
    SELECT r.*, a.first_name, a.last_name, a.contact_name, a.company_name,
           a.person_id, a.email, a.contact_email, a.billing_email, a.pack_name,
           a.amount_due, a.ref,
           ag.name AS agent_name,
           COALESCE(
             (SELECT NULLIF(TRIM(p.primary_email),'') FROM fiaon_persons p WHERE p.id = a.person_id),
             (SELECT al.value_norm FROM fiaon_person_aliases al
               WHERE al.person_id = a.person_id AND al.kind = 'email'
               ORDER BY al.created_at DESC LIMIT 1),
             NULLIF(TRIM(a.email),''), NULLIF(TRIM(a.contact_email),''), NULLIF(TRIM(a.billing_email),'')
           ) AS ziel_mail,
           (r.letzte_erinnerung_at IS NOT NULL AND r.letzte_erinnerung_at >= NOW() - INTERVAL '20 hours') AS gesperrt
    FROM fiaon_abo_raten r
    JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.abo_gestoppt_am IS NULL
    LEFT JOIN fiaon_agents ag ON ag.id = a.assigned_agent_id
    WHERE r.status = 'offen' AND r.storniert_am IS NULL AND ${wo}
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
