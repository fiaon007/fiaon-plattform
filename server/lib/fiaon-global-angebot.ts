// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS INDIVIDUALANGEBOT (Ablauf, Datenbank, Fristen)
// Individualangebot (01.10.2026), Register E-268
//
// Justin (01.10.2026): „Ja ich erlaube dir alles, umsetzen bitte." Ein Angebot
// für eine Person, in zwei Teilen, mit Bürgschaftszusage, Frist und vollständiger
// Erstattung. Die Texte stehen in shared/fiaon-global-angebot.ts, das Rendern in
// fiaon-global-angebot-vertrag.ts — hier nur der Ablauf.
//
// ── DER KERN: JEDER TEIL IST EINE GANZ NORMALE BESTELLZEILE ───────────────
// Katalogschlüssel „global_individuell" (shared/fiaon-pakete.ts, preisJeAngebot).
// Damit laufen Zahlungsseite, Buchung (mark-paid → onCustomerPaid), Rechnung aus
// dem einen Renderer und Nummernkreis, Provision, Meta-Kauf und alle Global-
// Ausschlüsse (kein Abo, keine Privatkunden-Mail, Rückholung, Mara) unverändert
// mit. Der Betrag kommt aus dem angenommenen Teil (fiaon_global_angebot_teile),
// der VOR dem Betrag an die Zeile gebunden wird (bestell_ref) — die Wand in
// Migration 087 prüft genau das.
//
// ── DER WEG ───────────────────────────────────────────────────────────────
//   Anlegen (Chefbüro, Reiter „Individualangebote") → signierter Link →
//   Kunde liest /business/angebot/:token → „Zahlungspflichtig annehmen":
//     1. Token, Status, Gültigkeit, Pflichtfelder der Bürgin, Roboter-Wand,
//     2. Prüfsumme des gezeigten Textes NACHRECHNEN (Schalter wie gezeigt),
//     3. Vertrags-PDF mit Annahmevermerk — ohne PDF keine Annahme,
//     4. Anspruch sichern (UPDATE … WHERE status = 'offen'): ein Doppelklick
//        findet nichts mehr und bekommt die Antwort des ersten,
//     5. Bestellzeile Teil 1 (Loopback wie /business/start), Teil binden,
//        Akte (fiaon_global_auftraege, „Mein Auftrag", Office, Zahlungstakt),
//        Bestellung über bestellungFuerAntrag: Zahlungsziel sofort, Rechnungsnummer,
//     6. hinter der Antwort: Aufgabe an die zuständige Person, Aufgabe an Justin,
//        Bestätigungsmail mit Vertrag und Rechnung Teil 1.
//   Zahlung Teil 1 → angebotNachZahlung: Start (bzw. nach der Widerrufsfrist),
//     Frist setzen (Beginn, Ende), Startmail mit Fristende als Datum.
//   Chef „Meilenstein erreicht" → Bestellzeile Teil 2, Rechnung, Zahlungsziel
//     sieben Tage, Mail mit Rechnung.
//   E-271 (Kreditgarantie): „Garantie erfüllt" (Kreditrahmen + Karten, Belege) beendet die Überwachung;
//   Frist abgelaufen ohne „Garantie erfüllt" → Chef „Garantiefall: Erstattung vormerken" — alles Gezahlte zurück
//   (Teil 1 + bezahlter Teil 2, offene Teil-2-Rechnung storniert). Bis E-271 galt: ohne Meilenstein → „Erstattung vormerken": Teil 2
//     entfällt, der bestehende Storno-Weg mit Erstattung (Aufgabe an Justin —
//     Geld bewegt nur Justin, von Hand), Mail an den Kunden.
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Kein Geld per SQL. Gebucht wird über den einen Weg, erstattet von Hand.
//   · Die Leitung kann nicht für den Kunden annehmen: Ein Klick mit Chef- oder
//     Admin-Cookie wird abgelehnt (die Zustimmung gibt nur der Kunde).
//   · Nichts wird gelöscht. Zurückziehen, Ablauf und Erstattung sind Status.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import {
  ANGEBOT_FASSUNG, ANGEBOT_FASSUNGEN, ANGEBOT_VORGABEN, ANGEBOT_GUELTIG_TAGE, ANGEBOT_ANNAHME, ANGEBOT_KNOPF, ANGEBOT_FEST, BUERGIN_VORGABE, BUERGIN_FELDER,
  angebotPflichtFehlen, angebotParameterFehler, angebotGesamtCents, angebotEur, angebotSeite, angebotBestellUebersicht,
  angebotKundeName, angebotKundeAnrede, angebotTag, angebotTeilTitel, angebotTeilPaketname, angebotRechnungsText, angebotVertragTitel,
  angebotVertragUnterzeile, zahlwort, pruefberichtErgebnis, angebotVersandSperre, ANGEBOT_START_SPAETESTENS_TAGE,
  angebotUsd, angebotKarten, angebotGarantie, angebotGarantieziel, ANGEBOT_GARANTIE_FEST,
  type AngebotDaten, type AngebotKunde, type AngebotParameter, type AngebotBuergin, type AngebotSchalter, type Pruefbericht, type AngebotLand,
} from "@shared/fiaon-global-angebot";
import { angebotTextHash, angebotVorschauHtml, angebotVertragPdf, angebotPruefberichtPdf, angebotAnlage1Pdf, buergschaftPruefsumme } from "./fiaon-global-angebot-vertrag";
import { globalWiderrufsfrist as widerrufsfristAb } from "./fiaon-global-vertrag";
import {
  ensureGlobalTabelle, globalAkteLesen, globalBestellungLesen, globalVerlauf, globalEinstellungen, globalMailSenden,
  globalMeinAuftragUrl, globalStartWartet, globalRechnungPdf, globalVertragPdfLesen, globalJahresbetreuungAus,
} from "./fiaon-global-auftrag";
import { globalOfficeAuftragPfad } from "@shared/fiaon-global-wege";
import { STARTGESPRAECH_TEXTE } from "@shared/fiaon-global-startgespraech";
import { GLOBAL_JAHRESBETREUUNG } from "@shared/fiaon-global";
import { dachNummer } from "@shared/fiaon-dach-telefon";
// E-301 (07.10.2026): das Firmenangebot (B2B) hat einen EIGENEN Pfad — hier nur die Verzweigungsstellen.
import { FIRMA_FASSUNG, istFirmenFassung } from "@shared/fiaon-global-angebot-firma";

export type AngebotStatus = "offen" | "angenommen" | "zurueckgezogen" | "abgelaufen";
export const ANGEBOT_PAKET_KEY = "global_individuell";

// ── E-301: die CHECKs der Teile für das Firmenangebot (Migration 096) — wiederholbar, nicht still gemerkt ──
// Nachprüfung 08.10.2026 (N6): Früher lief der Tausch einmal in ensureAngebotTabellen; scheiterte er (Sperre), blieb er bis zum
// Neustart aus, und eine Annahme lief halb durch (Monatsteile abgelehnt). Jetzt: Erfolg wird gemerkt, Misserfolg nicht —
// der nächste Aufruf (höchstens alle 30 Sekunden) versucht es wieder, und firmaAnnehmen fragt VOR der Annahme (sonst 503,
// nichts gespeichert). Die Anweisung läuft über die DDL-Wache (kurzes lock_timeout, db-pool.ts). E-268 braucht die neuen
// CHECKs nicht (nr 1/2, „sofort“/„meilenstein“ sind in beiden erlaubt).
let teileCheckOk = false;
let teileCheckVersuchAm = 0;
/** Nur lesen (pg_constraint, keine Sperre): stehen die CHECKs der Migration 096? Auch das Import-Skript fragt das vor --produktion. */
export async function firmaTeileCheckLesen(): Promise<boolean> {
  const zeilen = (await sqlPool`
    SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conname IN ('fiaon_global_angebot_teile_nr_check', 'fiaon_global_angebot_teile_faelligkeit_check')`) as any[];
  const def = (name: string) => String(zeilen.find((z) => z.conname === name)?.def ?? "");
  const f = def("fiaon_global_angebot_teile_faelligkeit_check");
  return /\b500\b/.test(def("fiaon_global_angebot_teile_nr_check")) && /'monatlich'/.test(f) && /'umsatz'/.test(f) && /'verkauf'/.test(f);
}
export async function firmaTeileCheckSichern(): Promise<boolean> {
  if (teileCheckOk) return true;
  try {
    if (await firmaTeileCheckLesen()) return (teileCheckOk = true);
    if (Date.now() - teileCheckVersuchAm < 30_000) return false;
    teileCheckVersuchAm = Date.now();
    await sqlPool`
      ALTER TABLE fiaon_global_angebot_teile
        DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_nr_check,
        DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_faelligkeit_check,
        ADD CONSTRAINT fiaon_global_angebot_teile_nr_check CHECK (nr BETWEEN 1 AND 500) NOT VALID,
        ADD CONSTRAINT fiaon_global_angebot_teile_faelligkeit_check CHECK (faelligkeit IN ('sofort', 'meilenstein', 'monatlich', 'umsatz', 'verkauf')) NOT VALID`;
    return (teileCheckOk = await firmaTeileCheckLesen());
  } catch (e) {
    console.error("[FIAON-ANGEBOT] CHECK-Tausch der Teile (Migration 096) gescheitert — nächster Versuch beim nächsten Aufruf:", e instanceof Error ? e.message : e);
    return false;
  }
}
/** Nur für den Prüfstand (scripts/pruef-angebot-firma.ts --lokal): das Gemerkte vergessen, damit der Wiederholweg prüfbar ist. */
export function firmaTeileCheckVergessen(): void { teileCheckOk = false; teileCheckVersuchAm = 0; }

// ── Schema (ensure-on-use wie ensureGlobalTabelle; DDL zusätzlich in Migration 087) ──
let bereit: Promise<void> | null = null;
export function ensureAngebotTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await ensureGlobalTabelle();
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_angebote (
          id SERIAL PRIMARY KEY,
          angebot_ref VARCHAR NOT NULL UNIQUE,
          person_id INTEGER,
          fassung VARCHAR NOT NULL,
          sprache VARCHAR NOT NULL DEFAULT 'de',
          kunde JSONB NOT NULL,
          parameter JSONB NOT NULL,
          buergin JSONB NOT NULL,
          pruefbericht JSONB,
          status VARCHAR NOT NULL DEFAULT 'offen',
          gueltig_bis DATE NOT NULL,
          erstellt_von TEXT,
          zurueckgezogen_am TIMESTAMPTZ,
          zurueckgezogen_von TEXT,
          zurueckgezogen_grund TEXT,
          angenommen_am TIMESTAMPTZ,
          ip VARCHAR,
          user_agent TEXT,
          text_hash VARCHAR,
          schalter JSONB,
          vertrag_pdf BYTEA,
          auftrag_ref VARCHAR UNIQUE,
          frist_beginn DATE,
          frist_ende DATE,
          frist_hemmung_tage INTEGER NOT NULL DEFAULT 0,
          frist_warnung_14_am TIMESTAMPTZ,
          frist_warnung_3_am TIMESTAMPTZ,
          frist_abgelaufen_am TIMESTAMPTZ,
          erstattung_ausgeloest_am TIMESTAMPTZ,
          erstattung_ausgeloest_von TEXT,
          erstattet_am DATE,
          erstattung_notiz TEXT,
          bestaetigung_mail_am TIMESTAMPTZ,
          bestaetigung_mail_fehler TEXT,
          start_mail_am TIMESTAMPTZ,
          nacharbeit_fehler TEXT,
          verlauf JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_angebot_teile (
          id SERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL REFERENCES fiaon_global_angebote(id),
          nr INTEGER NOT NULL CHECK (nr BETWEEN 1 AND 2),
          titel TEXT NOT NULL,
          betrag_cents BIGINT NOT NULL CHECK (betrag_cents > 0),
          faelligkeit VARCHAR NOT NULL CHECK (faelligkeit IN ('sofort', 'meilenstein')),
          zahlungsziel_tage INTEGER NOT NULL DEFAULT 0,
          bestell_ref VARCHAR UNIQUE,
          meilenstein_am DATE,
          meilenstein_art VARCHAR,
          meilenstein_beleg TEXT,
          meilenstein_von TEXT,
          eingetragen_am DATE,
          rechnung_am TIMESTAMPTZ,
          rechnung_mail_am TIMESTAMPTZ,
          bezahlt_am TIMESTAMPTZ,
          bezahlt_mail_am TIMESTAMPTZ,
          anruf_aufgabe_am TIMESTAMPTZ,
          entfallen_am TIMESTAMPTZ,
          entfallen_grund TEXT,
          UNIQUE (angebot_id, nr)
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_angebote_status_idx ON fiaon_global_angebote (status, created_at DESC)`;
      // E-271 (Kreditgarantie, Migration 089): „Garantie erfüllt“ und der Erstattungsbetrag im Garantiefall. Über die
      // DDL-Wache (Katalog-Vorabprüfung, kurzer lock_timeout) — nur ADD COLUMN IF NOT EXISTS ohne Vorgabewert.
      await sqlPool`
        ALTER TABLE fiaon_global_angebote
          ADD COLUMN IF NOT EXISTS garantie_erfuellt_am DATE,
          ADD COLUMN IF NOT EXISTS garantie_rahmen_usd BIGINT,
          ADD COLUMN IF NOT EXISTS garantie_karten INTEGER,
          ADD COLUMN IF NOT EXISTS garantie_beleg TEXT,
          ADD COLUMN IF NOT EXISTS garantie_von TEXT,
          ADD COLUMN IF NOT EXISTS garantie_eingetragen_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS erstattung_cents BIGINT`;
      // E-273 (02.10.2026, Migration 090): das Startgespräch, das das System nach der Annahme bucht. Bewusst NICHT
      // tragend: Scheitert diese DDL (Sperre), lesen Angebot und Kundenseite weiter wie bisher — OHNE_PDF kennt die
      // Spalten nicht, nur fiaon-global-angebot-startgespraech.ts liest sie. Die DDL-Wache holt „IF NOT EXISTS“
      // selbst nach; bis dahin meldet die Buchung „technik: …“, und der Stundenlauf versucht es erneut.
      await sqlPool`
        ALTER TABLE fiaon_global_angebote
          ADD COLUMN IF NOT EXISTS startgespraech_termin_id INTEGER,
          ADD COLUMN IF NOT EXISTS startgespraech_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS startgespraech_agent_id INTEGER,
          ADD COLUMN IF NOT EXISTS startgespraech_versuch_am TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS startgespraech_versuche INTEGER,
          ADD COLUMN IF NOT EXISTS startgespraech_fehler TEXT,
          ADD COLUMN IF NOT EXISTS startgespraech_mail_am TIMESTAMPTZ`
        .catch((e) => console.error("[FIAON-ANGEBOT] Spalten des Startgesprächs (Migration 090) nicht angelegt — die DDL-Wache holt sie nach:", e));
      // E-301 (07.10.2026, Migration 096): das Firmenangebot — Monats-, Umsatz- und Verkaufsteile (nr bis 500, neue
      // Fälligkeiten) und die Freigaben im Chefbüro. Nicht tragend für das Individualangebot: Scheitert es, liest und
      // rechnet E-268 weiter wie bisher (keine seiner Abfragen kennt diese Spalten); nur das Firmenangebot meldet Fehler.
      await (async () => {
        await sqlPool`
          ALTER TABLE fiaon_global_angebot_teile
            ADD COLUMN IF NOT EXISTS faellig_am DATE,
            ADD COLUMN IF NOT EXISTS bemessung_cents BIGINT,
            ADD COLUMN IF NOT EXISTS zeitraum TEXT,
            ADD COLUMN IF NOT EXISTS beleg TEXT,
            ADD COLUMN IF NOT EXISTS schuldner TEXT`;
        await sqlPool`ALTER TABLE fiaon_global_angebote ADD COLUMN IF NOT EXISTS freigaben JSONB`;
        // Die Bilder eines Angebots (nur hinter dem Link) — neue Tabelle ohne Fremdschlüssel, sperrt nichts Bestehendes.
        await sqlPool`
          CREATE TABLE IF NOT EXISTS fiaon_global_angebot_bilder (
            angebot_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/png', 'image/jpeg')),
            daten BYTEA NOT NULL,
            groesse INTEGER NOT NULL,
            sha256 TEXT NOT NULL,
            eingespielt_von TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (angebot_id, name)
          )`;
        // Der CHECK-Tausch scheitert nicht still: firmaTeileCheckSichern merkt sich nur den Erfolg und versucht es sonst beim
        // nächsten Aufruf wieder — spätestens vor jeder Annahme eines Firmenangebots (Nachprüfung 08.10.2026, N6).
        if (!(await firmaTeileCheckSichern())) console.error("[FIAON-ANGEBOT] CHECKs der Teile (Migration 096) noch alt — der nächste Aufruf versucht es wieder; ein Firmenangebot nimmt bis dahin keine Annahme an (503).");
      })().catch((e) => console.error("[FIAON-ANGEBOT] Spalten des Firmenangebots (Migration 096) nicht angelegt — die DDL-Wache holt ADD COLUMN nach:", e));
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── JSONB lesen und schreiben ─────────────────────────────────────────────────
// Schreiben IMMER über sqlPool.json() (Falle aus fiaon-global-bereich.ts: ein mit JSON.stringify gebauter
// Text auf ::jsonb landet als JSON-Text in der Spalte). Lesen verträgt beides.
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) as T; } catch { return leer; }
}
const jsonb = (v: unknown) => sqlPool.json(v as any);

// ── Token: Referenz + Ablauf + Signatur (HMAC wie der Global-Auftrag) ─────────
function geheimnis(): string {
  return process.env.SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-invoice-secret";
}
function signatur(ref: string, exp: number): string {
  return createHmac("sha256", geheimnis()).update(`global-angebot.${ref}.${exp}`).digest("hex").slice(0, 32);
}
/**
 * Der Link gilt bis zum Ende der Gültigkeit plus sieben Tage — danach ist auch die Bestätigungsseite zu.
 * Gegenprüfung 01.10.2026 (Datensparsamkeit): Über den Link ist Anlage 2 (Einkommen, Wohneigentum,
 * Geburtsdatum) ohne Anmeldung abrufbar; ein Nachlauf von dreißig Tagen war zu lang. Nach der Annahme
 * hat der Kunde „Mein Auftrag" mit eigenem Zugang für Vertrag und Rechnung.
 */
export const ANGEBOT_LINK_NACHLAUF_TAGE = 7;
/** Der späteste Zeitpunkt, zu dem ein Link dieses Angebots gilt: Ende der Gültigkeit plus Nachlauf. */
export function angebotLinkSpaetestens(gueltigBis: string): number {
  const ende = new Date(`${gueltigBis}T23:59:59+02:00`).getTime();
  return (Number.isFinite(ende) ? ende : Date.now()) + ANGEBOT_LINK_NACHLAUF_TAGE * 24 * 3600_000;
}
/**
 * Endabnahme 01.10.2026: Die Signatur hängt nur an ref+exp — ein Link, der vor der Verkürzung des
 * Nachlaufs (dreißig → sieben Tage) erzeugt wurde, bliebe sonst bis zu seinem alten exp gültig und
 * gäbe Anlage 2 (Einkommen, Geburtsdatum, Wohneigentum) länger ohne Anmeldung frei als gewollt.
 * Deshalb gilt zusätzlich zur Signatur: Kein Link lebt länger als „gültig bis + Nachlauf" — gerechnet
 * mit dem heutigen Nachlauf, nicht mit dem, der im Token steht.
 */
export function angebotLinkAbgelaufen(z: { gueltig_bis?: unknown }, jetzt = Date.now()): boolean {
  const g = isoTag(z.gueltig_bis);
  return !!g && jetzt > angebotLinkSpaetestens(g);
}
export function angebotTokenErzeugen(ref: string, gueltigBis: string, jetzt = Date.now()): string {
  const exp = Math.max(jetzt + 24 * 3600_000, angebotLinkSpaetestens(gueltigBis));
  return `${ref}.${exp}.${signatur(ref, exp)}`;
}
/** Nur für den Prüfstand und Sonderfälle: ein Token mit fester Ablaufzeit. */
export function angebotTokenMitAblauf(ref: string, exp: number): string {
  return `${ref}.${exp}.${signatur(ref, exp)}`;
}
export function angebotTokenPruefen(token: unknown): { ref: string; urteil: "gueltig" | "abgelaufen" } | null {
  const teile = String(token ?? "").split(".");
  if (teile.length !== 3) return null;
  const [ref, expRoh, sig] = teile;
  if (!/^FIAON-IA-[A-Z0-9]{6,10}$/.test(ref)) return null;
  const exp = Number(expRoh);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  const a = Buffer.from(signatur(ref, exp)); const b = Buffer.from(String(sig));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { ref, urteil: exp < Date.now() ? "abgelaufen" : "gueltig" };
}
export function angebotKundenPfad(token: string): string {
  return `/business/angebot/${encodeURIComponent(token)}`;
}

// ── Lesen ─────────────────────────────────────────────────────────────────────
const OHNE_PDF = `id, angebot_ref, person_id, fassung, sprache, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von,
  zurueckgezogen_am, zurueckgezogen_von, zurueckgezogen_grund, angenommen_am, ip, user_agent, text_hash, schalter, auftrag_ref,
  frist_beginn, frist_ende, frist_hemmung_tage, frist_warnung_14_am, frist_warnung_3_am, frist_abgelaufen_am,
  erstattung_ausgeloest_am, erstattung_ausgeloest_von, erstattet_am, erstattung_notiz, bestaetigung_mail_am, bestaetigung_mail_fehler,
  start_mail_am, nacharbeit_fehler, verlauf, created_at, updated_at, updated_at::text AS updated_at_txt, (vertrag_pdf IS NOT NULL) AS hat_vertrag,
  garantie_erfuellt_am, garantie_rahmen_usd, garantie_karten, garantie_beleg, garantie_von, garantie_eingetragen_am, erstattung_cents`;

export interface AngebotZeile { [k: string]: any }
export async function angebotLesen(wo: { id?: number; ref?: string }): Promise<AngebotZeile | null> {
  await ensureAngebotTabellen();
  const [a] = (wo.id != null
    ? await sqlPool.unsafe(`SELECT ${OHNE_PDF} FROM fiaon_global_angebote WHERE id = $1 LIMIT 1`, [wo.id])
    : await sqlPool.unsafe(`SELECT ${OHNE_PDF} FROM fiaon_global_angebote WHERE angebot_ref = $1 LIMIT 1`, [String(wo.ref ?? "")])) as any[];
  if (!a) return null;
  const teile = (await sqlPool`SELECT * FROM fiaon_global_angebot_teile WHERE angebot_id = ${a.id} ORDER BY nr`) as any[];
  return { ...a, teile };
}
const isoTag = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return berlinToday(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
export function angebotDatenAus(z: AngebotZeile): AngebotDaten {
  return {
    ref: String(z.angebot_ref),
    // Ein OFFENES Angebot zeigt immer den aktuellen Wortlaut — also auch die aktuelle Fassung (E-271). Angenommene
    // Angebote behalten die Fassung, mit der sie angenommen wurden (die Annahme schreibt sie fest).
    // E-301: ein offenes FIRMENangebot zeigt entsprechend die aktuelle Firmen-Fassung.
    fassung: String(z.status) === "offen" ? (istFirmenFassung(z.fassung) ? FIRMA_FASSUNG : ANGEBOT_FASSUNG) : String(z.fassung),
    kunde: json<AngebotKunde>(z.kunde, {} as AngebotKunde),
    parameter: { ...ANGEBOT_VORGABEN, ...json<Partial<AngebotParameter>>(z.parameter, {}) },
    buergin: { ...BUERGIN_VORGABE, ...json<Partial<AngebotBuergin>>(z.buergin, {}) },
    pruefbericht: z.pruefbericht ? json<Pruefbericht | null>(z.pruefbericht, null) : null,
    gueltigBis: isoTag(z.gueltig_bis) ?? berlinToday(),
  };
}
/** Der Status, wie ihn Kunde und Liste sehen — „abgelaufen" auch, bevor der Tageslauf ihn schreibt. */
export function angebotStatusAus(z: AngebotZeile, heute = berlinToday()): AngebotStatus {
  const s = String(z.status) as AngebotStatus;
  if (s === "offen" && (isoTag(z.gueltig_bis) ?? "9999-12-31") < heute) return "abgelaufen";
  return s;
}
export async function verlaufAngebot(id: number, wer: string, was: string, extra: Record<string, unknown> = {}): Promise<void> {
  await sqlPool`
    UPDATE fiaon_global_angebote
       SET verlauf = COALESCE(verlauf, '[]'::jsonb) || ${jsonb([{ am: new Date().toISOString(), wer, was, ...extra }])}, updated_at = NOW()
     WHERE id = ${id}`.catch((e) => console.error(`[FIAON-ANGEBOT] ${id}: Verlauf nicht geschrieben:`, e));
}

// ── Für die Bestellung (fiaon-antrag.ts) und die Rechnung (fiaon-invoice.ts) ──
/** Der Angebotsteil, der an dieser Bestellzeile hängt — Betrag und Zahlungsziel; null = keiner. */
export async function angebotTeilZurBestellung(ref: string): Promise<{ betragCents: number; zahlungszielTage: number; nr: number; angebotId: number } | null> {
  await ensureAngebotTabellen();
  const [t] = (await sqlPool`
    SELECT t.betrag_cents, t.zahlungsziel_tage, t.nr, t.angebot_id
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} AND a.status = 'angenommen' AND t.entfallen_am IS NULL LIMIT 1`) as any[];
  return t ? { betragCents: Number(t.betrag_cents), zahlungszielTage: Number(t.zahlungsziel_tage), nr: Number(t.nr), angebotId: Number(t.angebot_id) } : null;
}
/** Beschreibung und Zeitraum der Rechnungszeile eines Teils (shared: angebotRechnungsText). */
export async function angebotRechnungsZeile(ref: string): Promise<{ beschreibung: string; zeitraum: string } | null> {
  const [t] = (await sqlPool`
    SELECT t.nr, t.meilenstein_art, t.meilenstein_am, a.angebot_ref, a.auftrag_ref, a.fassung
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} LIMIT 1`.catch(() => [])) as any[];
  if (!t) return null;
  // E-301: Rechnungstexte des Firmenangebots (Gründung, Monat n, Umsatz-/Verkaufsbeteiligung).
  if (istFirmenFassung(t.fassung)) return (await import("./fiaon-global-angebot-firma")).firmaRechnungsZeile(ref);
  return angebotRechnungsText({ angebotRef: String(t.angebot_ref), nr: Number(t.nr) === 2 ? 2 : 1, auftragRef: String(t.auftrag_ref || ref), meilensteinArt: t.meilenstein_art, meilensteinAm: isoTag(t.meilenstein_am) });
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLEGEN UND ÄNDERN (Chefbüro)
// ═══════════════════════════════════════════════════════════════════════════
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
type Ergebnis<T = Record<string, unknown>> = { ok: true } & T | { ok: false; status: number; error: string };
const nein = (error: string, status = 400) => ({ ok: false as const, status, error });

export function angebotKundePruefen(k: any): { ok: true; kunde: AngebotKunde } | { ok: false; error: string } {
  const land = String(k?.land ?? "DE").toUpperCase() as AngebotLand;
  if (!["DE", "AT", "CH"].includes(land)) return { ok: false, error: "Land: Deutschland, Österreich oder Schweiz." };
  const kunde: AngebotKunde = {
    anrede: ["Herr", "Frau"].includes(String(k?.anrede)) ? (String(k.anrede) as "Herr" | "Frau") : "",
    vorname: text(k?.vorname, 80), nachname: text(k?.nachname, 80),
    geburtsdatum: text(k?.geburtsdatum, 10), strasse: text(k?.strasse, 160), plz: text(k?.plz, 10), ort: text(k?.ort, 120), land,
    email: text(k?.email, 160).toLowerCase(), telefon: text(k?.telefon, 40),
  };
  if (!kunde.vorname || !kunde.nachname) return { ok: false, error: "Vor- und Nachname fehlen." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kunde.geburtsdatum)) return { ok: false, error: "Geburtsdatum als JJJJ-MM-TT." };
  if (kunde.strasse.length < 3 || !kunde.ort) return { ok: false, error: "Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(kunde.plz)) return { ok: false, error: "Postleitzahl passt nicht zum Land." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "E-Mail-Adresse ungültig." };
  if (kunde.telefon) {
    const t = dachNummer(kunde.telefon, land);
    if (!t) return { ok: false, error: "Telefonnummer: bitte eine Nummer aus Deutschland, Österreich oder der Schweiz." };
    kunde.telefon = t;
  }
  return { ok: true, kunde };
}
function parameterAus(roh: any, basis: AngebotParameter = ANGEBOT_VORGABEN): AngebotParameter {
  const zahl = (v: unknown, alt: number) => (v === undefined || v === null || v === "" ? alt : Math.round(Number(v)));
  return {
    teil1Cents: zahl(roh?.teil1Cents, basis.teil1Cents), teil2Cents: zahl(roh?.teil2Cents, basis.teil2Cents),
    fristWochen: zahl(roh?.fristWochen, basis.fristWochen), erstattungTage: zahl(roh?.erstattungTage, basis.erstattungTage),
    teil2ZielTage: zahl(roh?.teil2ZielTage, basis.teil2ZielTage), kapitalZielUsd: zahl(roh?.kapitalZielUsd, basis.kapitalZielUsd),
    kartenZiel: zahl(roh?.kartenZiel, basis.kartenZiel), buergschaftUsd: zahl(roh?.buergschaftUsd, basis.buergschaftUsd),
  };
}
function buerginAus(roh: any, basis: AngebotBuergin = BUERGIN_VORGABE): AngebotBuergin {
  const feld = (k: keyof AngebotBuergin, max: number): string | null => {
    if (!roh || !(k in roh)) return (basis[k] as string | null) ?? null;
    const v = text(roh[k], max);
    return v || null;
  };
  const datum = feld("unterzeichnetAm", 10);
  return {
    name: basis.name,
    bundesstaat: feld("bundesstaat", 60), anschrift: feld("anschrift", 200), registerstelle: feld("registerstelle", 160),
    registernummer: feld("registernummer", 40), vertreter: feld("vertreter", 120), funktion: feld("funktion", 80),
    unterzeichnetAm: datum && /^\d{4}-\d{2}-\d{2}$/.test(datum) ? datum : null,
    bestaetigt: roh && "bestaetigt" in roh ? roh.bestaetigt === true : basis.bestaetigt,
    // Nachtrag (a), 01.10.2026: Die Bestätigung trägt ihre Grundlage („EIN-Antrag SS-4, vorgelegt 01.10.2026").
    bestaetigtGrundlage: feld("bestaetigtGrundlage", 200),
  };
}
function gueltigBisAus(roh: unknown): string | null {
  const s = String(roh ?? "").trim();
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).getTime()) ? s : null;
}
const plusTage = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * Vorbelegung aus dem JÜNGSTEN Antrag der Person (dort stehen die Namen richtig herum — Fall 13411).
 * Gegenprüfung 01.10.2026: fiaon_persons hat primary_email/primary_phone (nicht email/phone) — die alte
 * Abfrage warf, der `.catch(() => [])` machte daraus „Person gibt es nicht". Kein Schlucken mehr:
 * Ein SQL-Fehler kommt als 500 beim Chef an, nicht als falsche Auskunft.
 */
export async function angebotVorbelegung(personId: number): Promise<{ ok: true; kunde: Partial<AngebotKunde>; hinweise: string[]; personRef: string | null } | { ok: false; status: number; error: string }> {
  const [p] = (await sqlPool`SELECT id, person_ref, first_name, last_name, primary_email AS email, primary_phone AS phone, street, zip, city, country, birthdate FROM fiaon_persons WHERE id = ${personId} AND merged_into_person_id IS NULL LIMIT 1`) as any[];
  if (!p) return nein("Diese Person gibt es nicht (oder sie ist zusammengeführt).", 404);
  const [a] = (await sqlPool`
    SELECT ref, first_name, last_name, birthdate, street, zip, city, country, email, contact_email, phone, phone_country_code, contact_phone,
           pack_key, payment_reference, payment_status
      FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND COALESCE(type, '') <> 'schufa'
     ORDER BY created_at DESC LIMIT 1`) as any[];
  const hinweise: string[] = [];
  const offen = (await sqlPool`
    SELECT ref, pack_key, payment_reference FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND archived_at IS NULL AND cancelled_at IS NULL
       AND payment_status IN ('pending_payment', 'claimed_paid') AND COALESCE(pack_key, '') <> 'global_individuell'`) as any[];
  for (const o of offen) hinweise.push(`Offene Bestellung ${o.payment_reference || o.ref} (${o.pack_key || "ohne Paket"}, nicht bezahlt) — nach der Annahme über den Archiv-Weg stilllegen, sonst laufen Erinnerungen weiter.`);
  if (a && p.first_name && a.first_name && String(p.first_name).trim().toLowerCase() === String(a.last_name ?? "").trim().toLowerCase()) {
    hinweise.push(`In der Personenakte stehen Vor- und Nachname vertauscht („${p.first_name} ${p.last_name}“); vorbelegt ist die Schreibweise des Antrags. Die Akte bitte über den Admin-Weg korrigieren.`);
  }
  const quelle = a ?? p;
  const telefon = a ? (a.contact_phone || (a.phone ? `${a.phone_country_code || ""}${a.phone}` : "")) : p.phone;
  return {
    ok: true, personRef: p.person_ref ?? null, hinweise,
    kunde: {
      vorname: String(quelle.first_name ?? "").trim(), nachname: String(quelle.last_name ?? "").trim(),
      geburtsdatum: isoTag(quelle.birthdate) ?? "", strasse: String(quelle.street ?? "").trim(), plz: String(quelle.zip ?? "").trim(),
      ort: String(quelle.city ?? "").trim(), land: (["DE", "AT", "CH"].includes(String(quelle.country).toUpperCase()) ? String(quelle.country).toUpperCase() : "DE") as AngebotLand,
      email: String(a?.email || a?.contact_email || p.email || "").trim().toLowerCase(), telefon: String(telefon || "").trim(),
    },
  };
}

export async function angebotAnlegen(ein: any, wer: string): Promise<Ergebnis<{ id: number; ref: string; link: string }>> {
  await ensureAngebotTabellen();
  const fassung = String(ein?.fassung || ANGEBOT_FASSUNG);
  if (!(ANGEBOT_FASSUNGEN as readonly string[]).includes(fassung)) return nein("Diese Fassung gibt es nicht.");
  const k = angebotKundePruefen(ein?.kunde);
  if (!k.ok) return nein(k.error);
  const parameter = parameterAus(ein?.parameter);
  const pf = angebotParameterFehler(parameter);
  if (pf) return nein(pf);
  const buergin = buerginAus(ein?.buergin);
  const gueltigBis = gueltigBisAus(ein?.gueltigBis) ?? plusTage(berlinToday(), ANGEBOT_GUELTIG_TAGE);
  if (gueltigBis < berlinToday()) return nein("Das Datum „gültig bis“ liegt in der Vergangenheit.");
  const personId = Number(ein?.personId);
  const pb = ein?.pruefbericht && typeof ein.pruefbericht === "object" ? (ein.pruefbericht as Pruefbericht) : null;
  const ref = `FIAON-IA-${randomBytes(4).toString("hex").toUpperCase().slice(0, 6)}`;
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, pruefbericht, status, gueltig_bis, erstellt_von, verlauf)
    VALUES (${ref}, ${Number.isInteger(personId) && personId > 0 ? personId : null}, ${fassung}, ${jsonb(k.kunde)}, ${jsonb(parameter)}, ${jsonb(buergin)},
            ${pb ? jsonb(pb) : null}, 'offen', ${gueltigBis}::date, ${wer},
            ${jsonb([{ am: new Date().toISOString(), wer, was: "Angebot angelegt" }])})
    RETURNING id`) as any[];
  const id = Number(neu.id);
  await teileSchreiben(id, parameter);
  return { ok: true, id, ref, link: absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(ref, gueltigBis))) };
}
async function teileSchreiben(id: number, par: AngebotParameter): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage)
    VALUES (${id}, 1, ${angebotTeilTitel(1)}, ${par.teil1Cents}, 'sofort', 0),
           (${id}, 2, ${angebotTeilTitel(2)}, ${par.teil2Cents}, 'meilenstein', ${par.teil2ZielTage})
    ON CONFLICT (angebot_id, nr) DO UPDATE SET betrag_cents = EXCLUDED.betrag_cents, zahlungsziel_tage = EXCLUDED.zahlungsziel_tage
     WHERE fiaon_global_angebot_teile.bestell_ref IS NULL`;
}

/** Ändern, solange niemand angenommen hat. Jede Änderung steht mit der alten Prüfsumme im Verlauf. */
export async function angebotAendern(id: number, ein: any, wer: string): Promise<Ergebnis<{ fehlt: string[] }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein(`Das Angebot ist ${String(z.status)} — ändern geht nur, solange es offen ist.`, 409);
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaAendern(id, ein, wer); }
  const alt = angebotDatenAus(z);
  const altHash = angebotTextHash(alt, { sofortBeginn: false, jahresbetreuung: false });
  const neu: AngebotDaten = { ...alt };
  const geaendert: string[] = [];
  if (ein?.kunde) { const k = angebotKundePruefen({ ...alt.kunde, ...ein.kunde }); if (!k.ok) return nein(k.error); neu.kunde = k.kunde; geaendert.push("Kunde"); }
  if (ein?.parameter) { const par = parameterAus(ein.parameter, alt.parameter); const f = angebotParameterFehler(par); if (f) return nein(f); neu.parameter = par; geaendert.push("Teile und Fristen"); }
  if (ein?.buergin) { neu.buergin = buerginAus(ein.buergin, alt.buergin); geaendert.push("Bürgin"); }
  if (ein?.gueltigBis !== undefined) { const g = gueltigBisAus(ein.gueltigBis); if (!g || g < berlinToday()) return nein("„Gültig bis“: ein Datum ab heute."); neu.gueltigBis = g; geaendert.push("Gültigkeit"); }
  if (!geaendert.length) return nein("Es wurde nichts geändert.");
  await sqlPool`
    UPDATE fiaon_global_angebote
       SET kunde = ${jsonb(neu.kunde)}, parameter = ${jsonb(neu.parameter)}, buergin = ${jsonb(neu.buergin)}, gueltig_bis = ${neu.gueltigBis}::date, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen'`;
  await teileSchreiben(id, neu.parameter);
  await verlaufAngebot(id, wer, `geändert: ${geaendert.join(", ")}`, { alterHash: altHash });
  return { ok: true, fehlt: angebotPflichtFehlen(neu) };
}

/** Anlage 2, Teil IV neu aus den Daten der Person rechnen (Boni-Ampel E-202) — Teil A bleibt, wie er gemessen ist. */
export async function angebotPruefberichtBoniNeu(id: number, wer: string): Promise<Ergebnis<{ punkte: number | null }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein("Der Prüfbericht eines angenommenen Angebots bleibt, wie er angenommen wurde.", 409);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Der Prüfbericht (Kundenfassung) kommt aus dem Import-Skript scripts/angebot-firma-anlegen.ts.", 409);
  if (!z.person_id) return nein("Ohne Person keine Auswertung.");
  const { boniAmpelFuerPerson } = await import("./fiaon-boni-ampel");
  const ampel = await boniAmpelFuerPerson(Number(z.person_id));
  if (!ampel) return nein("Für diese Person liegt keine Auswertung vor (kein Antrag).", 409);
  const pb = json<Pruefbericht | null>(z.pruefbericht, null) ?? leererPruefbericht(angebotDatenAus(z), wer);
  const jetzt = new Date();
  pb.boni = {
    farbe: ampel.farbe, punkte: ampel.punkte, label: ampel.label,
    teile: ampel.teile.map((t) => ({ key: String(t.key), label: String(t.label), punkte: Number(t.punkte), quelle: t.quelle, text: String(t.text) })),
    belegt: Number(ampel.belegt ?? 0), deckel: ampel.deckel ?? null, befunde: (ampel.befunde ?? []).map((b) => String(b)),
    geschaetzt: ampel.geschaetzt === true,
    quelle: `boniAmpelFuerPerson(${z.person_id}) — eine Rechnung für alle Kunden (shared/fiaon-boni-ampel.ts)`,
    stand: jetzt.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
  };
  await sqlPool`UPDATE fiaon_global_angebote SET pruefbericht = ${jsonb(pb)}, updated_at = NOW() WHERE id = ${id} AND status = 'offen'`;
  await verlaufAngebot(id, wer, `Prüfbericht Teil IV neu gerechnet: ${pb.boni.punkte} Punkte`);
  return { ok: true, punkte: pb.boni.punkte };
}
/**
 * Anlage 2 aus der Saat setzen (Endabnahme 01.10.2026) — NICHT aus einem Formular (die Route nimmt
 * keinen Prüfbericht an). Nur solange das Angebot offen ist; die alte Prüfsumme steht im Verlauf,
 * damit der Kunde eine geänderte Fassung als „bitte neu laden" sieht (409 GEAENDERT).
 */
export async function angebotPruefberichtSetzen(id: number, pb: Pruefbericht, wer: string): Promise<Ergebnis> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (String(z.status) !== "offen") return nein("Der Prüfbericht eines angenommenen Angebots bleibt, wie er angenommen wurde.", 409);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Der Prüfbericht (Kundenfassung) kommt aus dem Import-Skript scripts/angebot-firma-anlegen.ts.", 409);
  const altHash = angebotTextHash(angebotDatenAus(z), { sofortBeginn: false, jahresbetreuung: false });
  await sqlPool`UPDATE fiaon_global_angebote SET pruefbericht = ${jsonb(pb)}, updated_at = NOW() WHERE id = ${id} AND status = 'offen'`;
  await verlaufAngebot(id, wer, `Prüfbericht (Anlage 2) aus der Saat gesetzt — ${pruefberichtErgebnis(pb).satz}`, { alterHash: altHash });
  return { ok: true };
}
function leererPruefbericht(d: AngebotDaten, wer: string): Pruefbericht {
  const heute = angebotTag(berlinToday());
  return {
    erstellt: heute, datenstand: heute, pruefer: wer, aktenzeichen: d.ref, eigenschaft: "Privatperson (Verbraucher)",
    vorhaben: "Gründung einer US-LLC (Teil 1) und Begleitung der Gesellschaft bei Kapital- und Kartenanträgen (Teil 2)",
    stammdaten: [], sanktionen: null,
    pep: { status: "offen", text: "FIAON nutzt keine PEP-Datenbank. Der Status wird durch Selbstauskunft im Vertrag festgestellt (Ziffer 7 Absatz 4)." },
    boni: null,
    eignung: { voraussetzungen: "Die persönlichen Voraussetzungen werden vor Beginn der Leistungen geprüft.", steuer: [], haftung: "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.", mitwirkung: "Ein gültiger Reisepass, Unterschriften und wahre Angaben.", einordnung: "Vorläufig." },
    auflagen: ["Identifizierung anhand des Reisepasses vor Beginn der Leistungen."],
  };
}

export async function angebotZurueckziehen(id: number, grundRoh: unknown, wer: string): Promise<Ergebnis> {
  const grund = text(grundRoh, 500);
  if (grund.length < 5) return nein("Bitte einen Grund angeben.");
  const r = (await sqlPool`
    UPDATE fiaon_global_angebote SET status = 'zurueckgezogen', zurueckgezogen_am = NOW(), zurueckgezogen_von = ${wer}, zurueckgezogen_grund = ${grund}, updated_at = NOW()
     WHERE id = ${id} AND status = 'offen' RETURNING id`) as any[];
  if (!r.length) return nein("Nur ein offenes Angebot lässt sich zurückziehen.", 409);
  await verlaufAngebot(id, wer, `zurückgezogen: ${grund}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSEITE
// ═══════════════════════════════════════════════════════════════════════════
export function schalterAus(q: any, jetzt: Date = new Date()): AngebotSchalter {
  // Nur ein echtes „1"/true zählt — nie vorangekreuzt, nie per Link vorbelegt (der Link trägt keine Schalter).
  const an = (v: unknown) => v === true || v === "1" || v === 1;
  const jb = an(q?.jahresbetreuung);
  // „Wann sollen wir beginnen?" (Justin, 01.10.2026): „Sofort starten" oder „Starten ab" mit Datum.
  if (q?.beginn === "sofort") return { sofortBeginn: true, jahresbetreuung: jb };
  if (q?.beginn === "datum" || q?.startAm) {
    const r = angebotStartRahmen(jetzt);
    const tag = String(q?.startAm ?? "");
    // Ungültiger oder fehlender Tag: kein Start-Wunsch — die Annahme verlangt dann eine Wahl (Code BEGINN).
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || tag < r.morgen || tag > r.spaetestens) return { sofortBeginn: false, jahresbetreuung: jb };
    // Liegt der Tag vor dem Start nach der Widerrufsfrist, ist es ein Beginn vor Ablauf — mit derselben Erklärung wie „Sofort".
    return { sofortBeginn: tag < r.widerrufStartAb, jahresbetreuung: jb, startAm: tag };
  }
  return { sofortBeginn: an(q?.sofortBeginn), jahresbetreuung: jb };
}
/** Die Grenzen für „Starten ab": morgen … +90 Tage; ab widerrufStartAb braucht es keine Erklärung zum früheren Beginn. */
export function angebotStartRahmen(jetzt: Date = new Date()): { morgen: string; spaetestens: string; widerrufStartAb: string; widerrufEnde: string } {
  const heute = berlinToday(jetzt);
  const wf = widerrufsfristAb(jetzt);
  return { morgen: plusTage(heute, 1), spaetestens: plusTage(heute, ANGEBOT_START_SPAETESTENS_TAGE), widerrufStartAb: wf.startAb, widerrufEnde: wf.fristEnde };
}

/** Was GET /global/angebot/:token liefert — für genau diese Schalterstellung. */
export async function angebotKundenSicht(token: string, s: AngebotSchalter, opts: { leitung?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { status: 403, body: { ok: false, error: "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus unserer Nachricht." } };
  if (t.urteil === "abgelaufen") return { status: 410, body: { ok: false, error: "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com — wir melden uns bei Ihnen." } };
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return { status: 404, body: { ok: false, error: "Zu diesem Link finden wir kein Angebot." } };
  if (angebotLinkAbgelaufen(z)) return { status: 410, body: { ok: false, error: "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com — wir melden uns bei Ihnen." } };
  const status = angebotStatusAus(z);
  if (status === "zurueckgezogen") return { status: 410, body: { ok: false, error: "Dieses Angebot gilt nicht mehr. Bei Fragen erreichen Sie uns unter support@fiaon.com." } };
  if (status === "abgelaufen") return { status: 410, body: { ok: false, error: `Dieses Angebot galt bis zum ${angebotTag(z.gueltig_bis instanceof Date ? berlinToday(z.gueltig_bis) : String(z.gueltig_bis))}. Möchten Sie es weiter annehmen, schreiben Sie uns an support@fiaon.com.` } };
  const d = angebotDatenAus(z);
  if (status === "angenommen") {
    // Gegenprüfung 01.10.2026: Hing nach der Annahme die Bestellung oder Rechnung (Antwort 202), heilt sich das
    // hier beim nächsten Aufruf des Links — beide Schritte sind wiederholbar, nichts entsteht doppelt.
    if (!z.auftrag_ref || z.nacharbeit_fehler || !(await globalBestellungLesen(String(z.auftrag_ref)))?.payment_reference) {
      const fertig = await angebotFertigstellen(Number(z.id)).catch((e) => { console.error(`[FIAON-ANGEBOT] ${d.ref}: Nachholen beim Lesen:`, e); return { ok: false }; });
      if (fertig.ok) void angebotNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Nacharbeit beim Lesen:`, e));
    }
    return { status: 200, body: { ok: true, status, ...(await angenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
  }
  // E-301: ein offenes Firmenangebot liefert FirmaKundenSicht (shared/fiaon-global-angebot-firma-typen.ts).
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaKundenSicht(token, z, opts); }
  const fehlt = angebotPflichtFehlen(d);
  const seite = angebotSeite(d);
  return {
    status: 200,
    body: {
      ok: true, status, ref: d.ref, fassung: d.fassung, gueltigBis: d.gueltigBis,
      kundeName: angebotKundeName(d.kunde), kundeAnrede: angebotKundeAnrede(d.kunde), email: d.kunde.email,
      seite, uebersicht: angebotBestellUebersicht(d, s), annahme: { ...ANGEBOT_ANNAHME, unterKnopf: ANGEBOT_ANNAHME.unterKnopf(angebotEur(d.parameter.teil1Cents)), fertigSofort: undefined, fertigWartet: undefined, fertigAb: undefined, fehltDatum: undefined },
      teil1Cents: d.parameter.teil1Cents, teil2Cents: d.parameter.teil2Cents, gesamtCents: angebotGesamtCents(d.parameter),
      schalter: s, html: angebotVorschauHtml(d, s), textHash: angebotTextHash(d, s),
      // „Starten ab": Grenzen des Datumswählers und ab wann es keine Erklärung zum früheren Beginn braucht.
      beginn: angebotStartRahmen(),
      // Ohne Pflichtfelder keine Annahme — der Kunde sieht nur den ruhigen Satz, die Leitung die Liste.
      annahmeBereit: fehlt.length === 0 && !opts.leitung,
      gesperrtGrund: fehlt.length ? ANGEBOT_ANNAHME.gesperrt : null,
      ...(opts.leitung ? { vorschauLeitung: true, fehlt } : {}),
      vertragPdf: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/vertrag.pdf`,
      pruefberichtPdf: `/api/fiaon/global/angebot/${encodeURIComponent(token)}/pruefbericht.pdf`,
    },
  };
}
async function angenommenAntwort(z: AngebotZeile): Promise<Record<string, unknown>> {
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaAngenommenAntwort(z); }
  const ref1 = z.auftrag_ref ? String(z.auftrag_ref) : null;
  const b = ref1 ? await globalBestellungLesen(ref1) : null;
  const sch = json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false });
  const kunde = json<AngebotKunde>(z.kunde, {} as AngebotKunde);
  const meinAuftrag = ref1 ? globalMeinAuftragUrl(ref1) : null;
  const t = meinAuftrag ? new URL(meinAuftrag).searchParams.get("t") : null;
  // E-273 (02.10.2026): „Ihr Startgespräch: <Tag>, <Uhrzeit> Uhr mit <Name>" + Kalender + Verschieben — oder der ehrliche
  // Satz, warum (noch) keiner da ist. Liest nie den Vertrag; scheitert das Lesen, fehlt nur dieser Block.
  const startgespraech = await import("./fiaon-global-angebot-startgespraech")
    .then(async (m) => m.startgespraechFuerKunde(await m.startgespraechStand(Number(z.id))))
    .catch((e) => { console.error(`[FIAON-ANGEBOT] ${z.angebot_ref}: Startgespräch für die Antwort:`, e); return null; });
  return {
    startgespraech,
    ref: String(z.angebot_ref), auftragRef: ref1, email: kunde.email, sofortBeginn: sch.sofortBeginn === true,
    angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null,
    betragCents: Number(json<AngebotParameter>(z.parameter, ANGEBOT_VORGABEN).teil1Cents),
    zahlungsseite: b?.payment_reference ? `/zahlung/${b.payment_reference}?bereich=business` : null,
    meinAuftrag: ref1 && t ? `/business/auftrag/${encodeURIComponent(ref1)}?t=${encodeURIComponent(t)}` : null,
    vertragUrl: ref1 && t ? `/api/fiaon/global/auftrag/${encodeURIComponent(ref1)}/vertrag.pdf?t=${encodeURIComponent(t)}` : null,
    rechnungUrl: ref1 && t && b?.payment_reference ? `/api/fiaon/global/auftrag/${encodeURIComponent(ref1)}/rechnung.pdf?t=${encodeURIComponent(t)}` : null,
    fertigText: sch.startAm ? ANGEBOT_ANNAHME.fertigAb(kunde.email, angebotTag(sch.startAm))
      : sch.sofortBeginn ? ANGEBOT_ANNAHME.fertigSofort(kunde.email) : ANGEBOT_ANNAHME.fertigWartet(kunde.email),
    fertigTitel: ANGEBOT_ANNAHME.fertigTitel,
    // Ist Teil 1 schon bezahlt, gibt es keinen Weg zur Zahlung mehr — nur noch „Mein Auftrag".
    // Gibt es noch keine Zahlungsseite (Rechnung hängt), sagt die Seite das ehrlich statt auf sie zu verweisen.
    teil1Bezahlt: String(b?.payment_status) === "paid",
    fertigZahlung: String(b?.payment_status) === "paid"
      ? ANGEBOT_ANNAHME.fertigBezahlt
      : b?.payment_reference
        ? ANGEBOT_ANNAHME.fertigFaellig(angebotEur(Number(json<AngebotParameter>(z.parameter, ANGEBOT_VORGABEN).teil1Cents)))
        : ANGEBOT_ANNAHME.fertigRechnungFolgt(angebotEur(Number(json<AngebotParameter>(z.parameter, ANGEBOT_VORGABEN).teil1Cents))),
    fertigFuss: ANGEBOT_ANNAHME.fertigFuss,
  };
}

/** Der Entwurf als PDF (Wasserzeichen) — nach der Annahme die Ausfertigung aus der Akte. */
export async function angebotPdfFuerToken(token: string, art: "vertrag" | "pruefbericht" | "anlage1", s: AngebotSchalter): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { status: 403, error: "Dieser Link ist ungültig." };
  if (t.urteil === "abgelaufen") return { status: 410, error: "Dieser Link ist abgelaufen." };
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return { status: 404, error: "Kein Angebot zu diesem Link." };
  if (angebotLinkAbgelaufen(z)) return { status: 410, error: "Dieser Link ist abgelaufen." };
  const st = angebotStatusAus(z);
  if (st === "zurueckgezogen") return { status: 410, error: "Dieses Angebot gilt nicht mehr." };
  // E-301: Anlage 1 als eigenes PDF über den Kundenlink gibt es nur beim Firmenangebot (Individualangebot: im Vertrag).
  if (art === "anlage1" && !istFirmenFassung(z.fassung)) return { status: 404, error: "Dieses Dokument gibt es zu diesem Angebot nicht einzeln." };
  return angebotPdfErzeugen(z, art, s);
}
export async function angebotPdfErzeugen(z: AngebotZeile, art: "vertrag" | "pruefbericht" | "anlage1", s: AngebotSchalter): Promise<{ status: number; pdf?: Buffer; dateiname?: string; error?: string }> {
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaPdfErzeugen(z, art); }
  const d = angebotDatenAus(z);
  if (art === "pruefbericht") {
    if (!d.pruefbericht) return { status: 404, error: "Zu diesem Angebot liegt noch kein Prüfbericht vor." };
    return { status: 200, pdf: await angebotPruefberichtPdf(d), dateiname: `FIAON_Pruefbericht_${d.ref}.pdf` };
  }
  // Anlage 1 allein — das Blatt zum eigenhändigen Unterschreiben (nur für die Leitung, Gegenprüfung 01.10.2026).
  if (art === "anlage1") return { status: 200, pdf: await angebotAnlage1Pdf(d), dateiname: `FIAON_Anlage1_Buergschaftszusage_${d.ref}.pdf` };
  if (String(z.status) === "angenommen") {
    const [r] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${z.id} LIMIT 1`) as any[];
    if (r?.vertrag_pdf) return { status: 200, pdf: Buffer.from(r.vertrag_pdf), dateiname: `FIAON_Global_Individualvereinbarung_${d.ref}.pdf` };
  }
  return { status: 200, pdf: await angebotVertragPdf(d, s, null), dateiname: `FIAON_Global_Angebot_${d.ref}_Entwurf.pdf` };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ANNAHME
// ═══════════════════════════════════════════════════════════════════════════
const jeIp = new Map<string, number[]>();
function zuViel(ip: string): boolean {
  const jetzt = Date.now();
  const liste = (jeIp.get(ip) ?? []).filter((t) => jetzt - t < 15 * 60_000);
  if (liste.length >= 8) { jeIp.set(ip, liste); return true; }
  liste.push(jetzt); jeIp.set(ip, liste);
  return false;
}
/** Zwei gleichzeitige Klicks warten aufeinander — der zweite bekommt die Antwort des ersten. */
const laufend = new Map<string, Promise<{ status: number; body: Record<string, unknown> }>>();

export interface AnnahmeKontext { ip: string; userAgent: string; leitung: boolean }
export async function angebotAnnehmen(token: string, body: any, kontext: AnnahmeKontext): Promise<{ status: number; body: Record<string, unknown> }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { status: 403, body: { ok: false, error: "Dieser Link ist ungültig. Bitte öffnen Sie den Link aus unserer Nachricht." } };
  const schon = laufend.get(t.ref);
  if (schon) return schon;
  const lauf = annehmen(t, body, kontext).finally(() => laufend.delete(t.ref));
  laufend.set(t.ref, lauf);
  return lauf;
}

async function annehmen(t: { ref: string; urteil: "gueltig" | "abgelaufen" }, body: any, kontext: AnnahmeKontext): Promise<{ status: number; body: Record<string, unknown> }> {
  const fehler = (status: number, error: string, extra: Record<string, unknown> = {}) => ({ status, body: { ok: false, error, ...extra } });
  if (t.urteil === "abgelaufen") return fehler(410, "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com.");
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return fehler(404, "Zu diesem Link finden wir kein Angebot.");
  if (angebotLinkAbgelaufen(z)) return fehler(410, "Dieser Link ist abgelaufen. Schreiben Sie uns bitte an support@fiaon.com.");
  const status = angebotStatusAus(z);
  // Doppelklick oder zweiter Tab: Die Annahme steht schon — dieselbe Antwort, nichts doppelt.
  if (status === "angenommen") {
    await angebotFertigstellen(Number(z.id)).catch((e) => console.error(`[FIAON-ANGEBOT] ${t.ref}: Nachholen:`, e));
    return { status: 200, body: { ok: true, schon: true, ...(await angenommenAntwort((await angebotLesen({ id: Number(z.id) }))!)) } };
  }
  if (status === "zurueckgezogen") return fehler(410, "Dieses Angebot gilt nicht mehr.");
  if (status === "abgelaufen") return fehler(410, "Dieses Angebot ist abgelaufen. Schreiben Sie uns an support@fiaon.com.");
  if (kontext.leitung) return fehler(403, "Aus dem Chefbüro heraus lässt sich ein Angebot nicht annehmen — die Zustimmung gibt nur der Kunde.");
  if (String(body?.falle ?? "").trim()) return fehler(400, "Ihre Angaben konnten nicht verarbeitet werden. Bitte laden Sie die Seite neu.");
  // E-301: Firmenangebot — Häkchen Unternehmergeschäft + Vertretung, Startwahl, eigener Vertrag (shared/fiaon-global-angebot-firma.ts).
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaAnnehmen(z, body, kontext, { zuViel }); }
  const d = angebotDatenAus(z);
  const fehlt = angebotPflichtFehlen(d);
  if (fehlt.length) return fehler(409, ANGEBOT_ANNAHME.gesperrt, { code: "PFLICHTFELDER" });
  if (zuViel(kontext.ip)) return fehler(429, "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(kontext.ip, kontext.userAgent).roboter) {
    return fehler(403, "Diese Annahme können wir nicht entgegennehmen. Bitte öffnen Sie die Seite in Ihrem Browser und nehmen Sie dort an.");
  }
  const s = schalterAus(body);
  // „Wann sollen wir beginnen?" — die Seite schickt seit 01.10.2026 immer „beginn". Fehlt die Wahl oder ist der Tag
  // ungültig, nennt die Antwort genau das (die Seite zeigt es am Feld). Eine ältere, noch offene Seite ohne „beginn"
  // nimmt weiter wie bisher an (Start nach der Widerrufsfrist bzw. sofort) — ihr Vertragstext ist unverändert gültig.
  if (body && Object.prototype.hasOwnProperty.call(body, "beginn")) {
    if (body.beginn !== "sofort" && body.beginn !== "datum") return fehler(400, ANGEBOT_ANNAHME.fehltBeginn, { code: "BEGINN" });
    if (body.beginn === "datum" && !s.startAm) {
      const r = angebotStartRahmen();
      return fehler(400, ANGEBOT_ANNAHME.fehltDatum(angebotTag(r.morgen), angebotTag(r.spaetestens)), { code: "STARTDATUM" });
    }
  }
  const hash = angebotTextHash(d, s);
  if (String(body?.textHash ?? "") !== hash) return fehler(409, ANGEBOT_ANNAHME.neuLaden, { code: "GEAENDERT" });

  // ── Ohne PDF keine Annahme ────────────────────────────────────────────────
  const jetzt = new Date();
  let pdf: Buffer;
  try {
    pdf = await angebotVertragPdf(d, s, { am: jetzt, ip: kontext.ip, userAgent: kontext.userAgent, hash });
    if (!pdf || pdf.length < 1000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[FIAON-ANGEBOT] ${t.ref}: Vertrags-PDF:`, e);
    return fehler(500, "Ihr Vertrag konnte gerade nicht ausgefertigt werden — bitte versuchen Sie es in einer Minute noch einmal. Es wurde nichts gespeichert.");
  }
  // ── Anspruch sichern: genau eine Annahme ──────────────────────────────────
  // Gegenprüfung 01.10.2026: `updated_at` als optimistische Sperre — hat die Leitung zwischen dem Lesen
  // (oben) und diesem Schreiben etwas geändert (Kunde, Teile, Bürgin), gewinnt NICHT die Annahme mit dem
  // alten Text, sondern der Kunde bekommt „bitte neu laden" (409 GEAENDERT). Vergleich als Text, weil
  // JavaScript die Mikrosekunden der Spalte verliert.
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET status = 'angenommen', angenommen_am = ${jetzt}, ip = ${kontext.ip}, user_agent = ${String(kontext.userAgent || "").slice(0, 500)},
           text_hash = ${hash}, schalter = ${jsonb(s)}, vertrag_pdf = ${pdf}, fassung = ${d.fassung}, updated_at = NOW()
     WHERE id = ${z.id} AND status = 'offen' AND gueltig_bis >= ${berlinToday()}::date AND updated_at::text = ${String(z.updated_at_txt)}
     RETURNING id`) as any[];
  if (!frei) {
    const neu = await angebotLesen({ id: Number(z.id) });
    if (neu && String(neu.status) === "angenommen") return { status: 200, body: { ok: true, schon: true, ...(await angenommenAntwort(neu)) } };
    if (neu && String(neu.status) === "offen") return fehler(409, ANGEBOT_ANNAHME.neuLaden, { code: "GEAENDERT" });
    return fehler(409, "Das Angebot lässt sich gerade nicht annehmen. Bitte laden Sie die Seite neu.");
  }
  await verlaufAngebot(Number(z.id), angebotKundeName(d.kunde), `angenommen (${ANGEBOT_KNOPF}) — Prüfsumme ${hash.slice(0, 12)}…, sofortiger Beginn ${s.sofortBeginn ? "ja" : "nein"}${s.startAm ? `, Starttag ${angebotTag(s.startAm)}` : ""}, Jahresbetreuung ${s.jahresbetreuung ? "ja" : "nein"}`);
  // Angebot-Aufrufe (01.10.2026): „angenommen" in DIESELBE Aufgabe „… hat sein Angebot geöffnet" — hinter der Antwort.
  void import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAnnahmeVermerken(Number(z.id)))
    .catch((e) => console.error(`[FIAON-ANGEBOT] ${t.ref}: Annahme in der Aufruf-Aufgabe:`, e));

  const fertig = await angebotFertigstellen(Number(z.id));
  const neu = (await angebotLesen({ id: Number(z.id) }))!;
  if (!fertig.ok) {
    // Die Annahme steht (Vertrag mit Prüfsumme liegt fest) — Bestellung oder Rechnung hängen. Ein zweiter
    // Klick holt nach; die Leitung sieht den Fehler im Reiter „Individualangebote".
    return { status: 202, body: { ok: true, teilweise: true, hinweis: "Ihre Annahme ist gespeichert. Die Rechnung wird gerade erstellt — Sie erhalten sie per E-Mail.", ...(await angenommenAntwort(neu)) } };
  }
  // E-273 (02.10.2026): Das Startgespräch VOR der Antwort buchen — der Kunde sieht Tag und Uhrzeit sofort (Justins Zusage
  // per WhatsApp: „… bucht das System automatisch den nächsten freien Termin"). Höchstens acht Sekunden: Dauert es länger,
  // läuft die Buchung weiter, die Nacharbeit wartet auf ihre Sperre und findet den Termin, die Mail nennt ihn.
  await Promise.race([
    import("./fiaon-global-angebot-startgespraech").then((m) => m.angebotStartgespraechBuchen(Number(z.id), { anlass: "annahme" })),
    new Promise((fertigNach) => setTimeout(fertigNach, 8_000)),
  ]).catch((e) => console.error(`[FIAON-ANGEBOT] ${t.ref}: Startgespräch bei der Annahme — die Nacharbeit holt es nach:`, e));
  void angebotNacharbeit(Number(z.id)).catch((e) => console.error(`[FIAON-ANGEBOT] ${t.ref}: Nacharbeit abgebrochen — bitte im Reiter „Individualangebote" nachsehen:`, e));
  return { status: 200, body: { ok: true, ...(await angenommenAntwort((await angebotLesen({ id: Number(z.id) })) ?? neu)) } };
}

/** Bestellzeile anlegen — derselbe Weg wie /business/start (Loopback auf POST /api/fiaon/application). */
async function bestellzeileAnlegen(ref: string, d: AngebotDaten, nr: 1 | 2, kontext: { ip: string; userAgent: string }): Promise<boolean> {
  const k = d.kunde;
  const port = process.env.PORT || 5000;
  const [jahr, monat, tag] = k.geburtsdatum.split("-");
  const antwort = await fetch(`http://127.0.0.1:${port}/api/fiaon/application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": kontext.ip || "", "user-agent": kontext.userAgent || "fiaon-global-angebot" },
    body: JSON.stringify({
      ref, type: "business", status: "submitted", currentStep: 6,
      packKey: ANGEBOT_PAKET_KEY, packName: angebotTeilPaketname(nr),
      // Privatperson: KEIN Firmenname — die Rechnung nennt die Person (wie der Privatauftrag E-191).
      companyName: null, legalForm: null, taxId: null,
      firstName: k.vorname, lastName: k.nachname, birthDay: tag, birthMonth: monat, birthYear: jahr,
      contactFirstName: k.vorname, contactLastName: k.nachname,
      contactEmail: k.email, email: k.email, billingEmail: k.email, contactPhone: k.telefon || null,
      street: k.strasse, zip: k.plz, city: k.ort, country: k.land,
      // Gegenprüfung 01.10.2026: Ziffer 15 schließt die AGB aus — die Akte darf keine AGB-Zustimmung behaupten (consent_agb bleibt leer).
      // Der Vertrag selbst ist angenommen (ag3 → consent_contract); eine Bonitätsabfrage gibt es nicht (ag2).
      ag1: false, ag2: false, ag3: true,
      // Endabnahme 01.10.2026: Auf diesem Weg gibt es KEINE Messung — weder Pixel/Web noch die Lead-Stufe an Meta
      // (Nachtrag d; Ziffer 14 des Vertrags nennt Meta nicht). `webMessungAus` allein ließ die CRM-Meldung durch.
      webMessungAus: true, messungAus: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!antwort.ok) {
    console.error(`[FIAON-ANGEBOT] ${ref}: application ${antwort.status}:`, (await antwort.text().catch(() => "")).slice(0, 200));
    return false;
  }
  return true;
}

/**
 * Alles nach der Annahme, was eine Antwort braucht — WIEDERHOLBAR: Bestellzeile Teil 1, Teil binden,
 * Akte, Bestellung mit Rechnungsnummer. Jeder Schritt prüft, ob er schon getan ist.
 */
export async function angebotFertigstellen(id: number): Promise<{ ok: boolean; grund?: string }> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen") return { ok: false, grund: "nicht angenommen" };
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaFertigstellen(id); }
  const d = angebotDatenAus(z);
  const s = json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false });
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  if (!teil1) return { ok: false, grund: "Teil 1 fehlt" };
  try {
    let ref1 = teil1.bestell_ref ? String(teil1.bestell_ref) : (z.auftrag_ref ? String(z.auftrag_ref) : null);
    if (!ref1) {
      ref1 = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
      // Erst die Nummer am Angebot festhalten — ein Abbruch danach legt beim nächsten Versuch keine zweite Zeile an.
      await sqlPool`UPDATE fiaon_global_angebote SET auftrag_ref = ${ref1}, updated_at = NOW() WHERE id = ${id} AND auftrag_ref IS NULL`;
      const [w] = (await sqlPool`SELECT auftrag_ref FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      ref1 = String(w.auftrag_ref);
    }
    const [da] = (await sqlPool`SELECT ref, person_id FROM fiaon_applications WHERE ref = ${ref1} LIMIT 1`) as any[];
    if (!da) {
      const ok = await bestellzeileAnlegen(ref1, d, 1, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
      if (!ok) throw new Error("Bestellzeile Teil 1 ließ sich nicht anlegen");
    }
    // Den Teil binden, BEVOR ein Betrag an der Zeile steht (Wand, Migration 087).
    await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref1} WHERE angebot_id = ${id} AND nr = 1 AND bestell_ref IS NULL`;
    const [person] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref1}`) as any[];
    if (person?.person_id) await sqlPool`UPDATE fiaon_global_angebote SET person_id = COALESCE(person_id, ${Number(person.person_id)}) WHERE id = ${id}`;

    // ── Die Akte (fiaon_global_auftraege) — „Mein Auftrag", Office, Zahlungstakt, Widerrufsstart, Storno ──
    if (!(await globalAkteLesen(ref1))) {
      const [pdfZeile] = (await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
      const firma = { art: "privat", land: d.kunde.land, name: angebotKundeName(d.kunde), rechtsform: "Privatperson", registergericht: null, registernummer: null, strasse: d.kunde.strasse, plz: d.kunde.plz, ort: d.kunde.ort, ustId: null, website: null, quelleRegister: null };
      const ansprechpartner = { anrede: d.kunde.anrede, vorname: d.kunde.vorname, nachname: d.kunde.nachname, funktion: "Privatperson", email: d.kunde.email, telefon: d.kunde.telefon };
      const bestaetigungen = { annahme: ANGEBOT_KNOPF, sofortBeginn: s.sofortBeginn === true, jahresbetreuung: s.jahresbetreuung === true, am: new Date(z.angenommen_am).toISOString(),
        // „Starten ab": globalStartWartet hält den Start bis zu diesem Tag zurück (auch wenn früher gezahlt wird).
        ...(s.startAm ? { startAm: s.startAm } : {}) };
      // Dieselbe Schreibweise wie globalAuftragAnlegen (JSON-Text auf ::jsonb) — alle Leser der Akte kennen sie.
      await sqlPool`
        INSERT INTO fiaon_global_auftraege
          (ref, paket_key, land, firma, ansprechpartner, ust_id, bestaetigungen, unterschrift_png, vertrag_pdf, vertrag_version, vertrag_sprache,
           unterschrieben_am, ip, user_agent, quelle, status, doc_hash, firma_name, email, rechnung_ust_modus, ust_hinweis,
           jahresbetreuung, jahresbetreuung_preis_cents, angebot_id)
        VALUES
          (${ref1}, ${ANGEBOT_PAKET_KEY}, ${d.kunde.land}, ${JSON.stringify(firma)}::jsonb, ${JSON.stringify(ansprechpartner)}::jsonb, ${null},
           ${JSON.stringify(bestaetigungen)}::jsonb, ${null}, ${pdfZeile?.vertrag_pdf ?? null}, ${d.fassung}, 'de',
           ${new Date(z.angenommen_am)}, ${z.ip}, ${z.user_agent}, 'individualangebot', 'offen', ${z.text_hash}, ${firma.name}, ${d.kunde.email}, 'none', ${null},
           ${s.jahresbetreuung === true}, ${s.jahresbetreuung ? GLOBAL_JAHRESBETREUUNG.preisCents : null}, ${id})
        ON CONFLICT (ref) DO NOTHING`;
    }
    // ── Die Bestellung: Betrag aus dem Teil, Zahlungsziel sofort, Rechnungsnummer aus dem einen Kreis ──
    const b = await globalBestellungLesen(ref1);
    if (!b?.payment_reference || !["pending_payment", "claimed_paid", "paid"].includes(String(b.payment_status))) {
      const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
      const erg = await bestellungFuerAntrag(ref1, { globalMailFolgt: true });
      if (erg.status !== 200) throw new Error(`Bestellung: ${erg.status} ${JSON.stringify(erg.body).slice(0, 160)}`);
      await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = 'none' WHERE ref = ${ref1}`.catch(() => {});
    }
    await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = COALESCE(rechnung_am, NOW()) WHERE angebot_id = ${id} AND nr = 1`;
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = NULL, updated_at = NOW() WHERE id = ${id} AND nacharbeit_fehler IS NOT NULL`;
    return { ok: true };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.error(`[FIAON-ANGEBOT] ${z.angebot_ref}: Fertigstellen:`, e);
    await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = ${grund.slice(0, 500)}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    // Gegenprüfung 01.10.2026: Ein hängender Abschluss bekommt eine dringende Aufgabe an Justin — nicht nur roten
    // Text im Reiter. Derselbe Schlüssel je Angebot: beim zweiten Fehlschlag wird der Text angehängt, nicht verdoppelt.
    try {
      const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
      await auftragFuerKunden({
        personId: z.person_id != null ? Number(z.person_id) : null, ref: z.auftrag_ref ? String(z.auftrag_ref) : null,
        titel: `Individualangebot ${z.angebot_ref}: Annahme gespeichert, Bestellung/Rechnung hängt — ${angebotKundeName(d.kunde)}`,
        text: `Die Annahme steht (Prüfsumme in der Akte), aber Bestellzeile, Akte oder Rechnung ließen sich nicht anlegen: ${grund.slice(0, 300)}. Der Kunde hat noch keine Zahlungsseite. Nachholen: Reiter „Individualangebote“ → „Nachholen“ (oder der Kunde öffnet seinen Link erneut — der Stundenlauf versucht es ebenfalls).`,
        dringend: true, anBetreiber: true, schluessel: `global:${z.angebot_ref}:nacharbeit`, bereich: "technik", quelle: "global", autorName: "FIAON Global",
        link: "/chef/s/global-auftraege?reiter=angebote",
      });
    } catch (e2) { console.error(`[FIAON-ANGEBOT] ${z.angebot_ref}: Aufgabe „Nacharbeit hängt":`, e2); }
    return { ok: false, grund };
  }
}

/** Hinter der Antwort: Aufgaben (zuständige Person + Justin) und die Bestätigungsmail mit Vertrag und Rechnung. */
export async function angebotNacharbeit(id: number): Promise<void> {
  const z = await angebotLesen({ id });
  if (!z || String(z.status) !== "angenommen" || !z.auftrag_ref) return;
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaNacharbeit(id); }
  const ref1 = String(z.auftrag_ref);
  const d = angebotDatenAus(z);
  const s = json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false });
  const b = await globalBestellungLesen(ref1);
  const akte = await globalAkteLesen(ref1);
  const name = angebotKundeName(d.kunde);
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const einstellungen = await globalEinstellungen();
  const { globalWiderrufsfrist } = await import("./fiaon-global-vertrag");
  const frist = globalWiderrufsfrist(new Date(z.angenommen_am));
  const teilText = `Teil 1 „Gründung“ ${angebotEur(d.parameter.teil1Cents)} (Rechnung ${b?.invoice_number ?? "—"}, Verwendungszweck ${b?.payment_reference ?? "—"}, sofort fällig) · Teil 2 „Kapital-Begleitung“ ${angebotEur(d.parameter.teil2Cents)} erst beim Meilenstein`;
  // ── E-273 (02.10.2026): das Startgespräch — VOR Aufgaben und Bestätigungsmail, damit beide Tag und Uhrzeit nennen ──
  // Wiederholbar: Hat die Annahme schon gebucht, findet es den Termin. Ist die Bestätigung schon draußen (Nachholen),
  // geht Tag und Uhrzeit in einer eigenen Mail. Scheitert es, liegt eine dringende Aufgabe bei Justin.
  const SG = await import("./fiaon-global-angebot-startgespraech");
  await SG.angebotStartgespraechSicherstellen(id, { anlass: "nacharbeit" })
    .catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Startgespräch in der Nacharbeit:`, e));
  const sg = await SG.startgespraechStand(id).catch(() => null);
  const sgZeile = sg?.stand === "gebucht" && sg.termin
    ? `STARTGESPRÄCH: vom System gebucht — ${sg.termin.tagText}, ${sg.termin.uhrzeit} Uhr mit ${sg.termin.mit} (steht im Kalender, der Kunde hat Tag und Uhrzeit auf der Seite und per Mail).`
    // Gegenprüfung E-273 (technik, 02.10.2026): „keins“ heißt hier, der Stand ist nicht lesbar (Spalten der Migration 090
    // noch nicht da) — dann gibt es auch KEINE Aufgabe „von Hand buchen“; die Zeile darf keine behaupten.
    : !sg || sg.stand === "keins"
      ? "STARTGESPRÄCH: Stand gerade nicht lesbar (Spalten der Migration 090?) — der Stundenlauf bucht nach, sobald sie da sind; bitte im Reiter „Individualangebote“ nachsehen."
      : `STARTGESPRÄCH: noch nicht gebucht${sg.fehler ? ` (${sg.fehler})` : ""} — Justin hat die Aufgabe „Startgespräch von Hand buchen“.`;
  // ── Aufgabe an die zuständige Person ──
  try {
    let zustaendig: number | null = akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null;
    if (!zustaendig) {
      const erg = await auftragFuerKunden({
        personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1,
        titel: `FIAON Global: Individualangebot angenommen — ${name}`,
        text: [
          `${name} hat das Individualangebot ${d.ref} angenommen (${new Date(z.angenommen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}).`,
          teilText,
          `GARANTIE (Ziffer 3 Absatz 1, Ziffer 6): bis zum Fristende ${angebotGarantieziel(d.parameter)} für die Gesellschaft — sonst erstattet FIAON alles Gezahlte, eine offene Teil-2-Rechnung entfällt.`,
          s.startAm
            ? `PRIVATPERSON: Widerrufsrecht bis ${angebotTag(frist.fristEnde)}. Gewählter Starttag: ${angebotTag(s.startAm)}${s.sofortBeginn ? " (vor Ablauf der Widerrufsfrist — Beginn ausdrücklich verlangt)" : ""} — Start an diesem Tag, frühestens mit dem Zahlungseingang. Vorher nichts beantragen.`
            : s.sofortBeginn
            ? `PRIVATPERSON: Widerrufsrecht bis ${angebotTag(frist.fristEnde)}. Sofortiger Beginn verlangt — Start mit dem Zahlungseingang.`
            : `PRIVATPERSON: Widerrufsrecht bis ${angebotTag(frist.fristEnde)}. KEIN sofortiger Beginn — Start frühestens am ${angebotTag(frist.startAb)}, auch wenn die Zahlung früher kommt. Bis dahin nichts beantragen.`,
          `Die Frist von ${zahlwort(d.parameter.fristWochen)} Wochen beginnt mit dem Start — das Fristende steht danach im Reiter „Individualangebote“ und geht dem Kunden per Mail zu.`,
          sgZeile,
          "Bitte kurz anrufen, die Annahme bestätigen und Fragen zur Überweisung klären. Vor Leistungsbeginn: Reisepass prüfen und die Sanktionslisten erneut abgleichen (Ziffer 7 des Vertrags).",
          `Office: ${globalOfficeAuftragPfad(ref1)} · Leitung: /chef/s/global-auftraege?reiter=angebote`,
        ].join("\n"),
        schluessel: `global:${ref1}:auftrag`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: globalOfficeAuftragPfad(ref1), agentId: einstellungen.zustaendigAgentId,
        anlageText: `Individualangebot ${d.ref} auf /business/angebot angenommen.`,
      });
      if (erg.agentId) {
        zustaendig = erg.agentId;
        await sqlPool`UPDATE fiaon_global_auftraege SET zustaendig_agent_id = ${erg.agentId}, updated_at = NOW() WHERE ref = ${ref1} AND zustaendig_agent_id IS NULL`;
      }
    }
  } catch (e) { console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe an die zuständige Person:`, e); }
  // ── Aufgabe an Justin (die Zahlungsstelle) ──
  await auftragFuerKunden({
    personId: b?.person_id != null ? Number(b.person_id) : null, ref: ref1,
    titel: `Individualangebot angenommen: ${name} — ${angebotEur(d.parameter.teil1Cents)} erwartet`,
    text: [
      `${name} hat das Individualangebot ${d.ref} angenommen. ${teilText}.`,
      sgZeile,
      "Bitte den Zahlungseingang von Teil 1 wie immer über den einen Weg buchen (Zahlungen verbuchen). Mit der Buchung startet der Auftrag bzw. wartet auf das Ende der Widerrufsfrist.",
      `Bürgschaftszusage: das eigenhändig unterschriebene Original (${angebotTag(d.buergin.unterzeichnetAm)}) per Post an ${d.kunde.strasse}, ${d.kunde.plz} ${d.kunde.ort} schicken, falls noch nicht geschehen. Das Original muss GENAU die angenommene Fassung der Anlage 1 tragen — Prüfsumme ${buergschaftPruefsumme(d).slice(0, 16)}… (steht auf dem Blatt „Anlage 1 zum Unterschreiben“ und im Vertrag).`,
      "Offen vor Leistungsbeginn: Reisepass prüfen, Sanktionslisten erneut abgleichen, PEP-Erklärung (Ziffer 7 Absatz 4).",
    ].join("\n"),
    anBetreiber: true, schluessel: `global:${ref1}:angebot-justin`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
    link: "/chef/s/global-auftraege?reiter=angebote", anlageText: `Individualangebot ${d.ref} angenommen.`,
  }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe an Justin:`, e));
  // Justin 08.10.2026: dazu SOFORT eine Mail an ihn — die Aufgabe auf dem Board allein mailt nicht.
  await import("./fiaon-global-angebot-aufrufe")
    .then((A) => A.annahmeMelden({ ref: d.ref, name, art: "Individualangebot", betrag: angebotEur(d.parameter.teil1Cents), zeilen: [teilText, sgZeile] }))
    .then((s) => console.log(`[FIAON-ANGEBOT] ${d.ref}: Annahme — ${s}`))
    .catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Annahme-Mail an Justin:`, e));
  // ── Die Bestätigungsmail — höchstens einmal, nachholbar ──
  await bestaetigungSenden(id).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Bestätigungsmail:`, e));
  await globalVerlauf(ref1, `FIAON Global: Individualangebot ${d.ref} angenommen (${ANGEBOT_KNOPF}). Vertrag mit Prüfsumme in der Akte; Rechnung Teil 1 ${b?.invoice_number ?? ""} über ${angebotEur(d.parameter.teil1Cents)}, sofort fällig.`);
}

/**
 * Die Meldung von „Nachholen“ (POST …/nachholen) — rein. Beim Firmenangebot geht keine Mail raus: Die Meldung sagt das, damit
 * niemand glaubt, die Kundin habe eine Bestätigung bekommen (Nachprüfung 08.10.2026, N1). E-268 unverändert.
 */
export function nachholenMeldung(mail: { ok: boolean; grund: string | null; firma?: true }): string {
  if (mail.firma) return "Bestellung und Akte stehen — beim Firmenangebot geht keine Mail an die Kundin: Vertrag und Rechnung schickt der Ansprechpartner von Hand.";
  return mail.ok ? "Bestellung, Akte und Bestätigungsmail stehen." : `Bestellung und Akte stehen — die Mail ging nicht raus: ${mail.grund}`;
}
export async function bestaetigungSenden(id: number): Promise<{ ok: boolean; grund: string | null; firma?: true }> {
  // E-301: Für das Firmenangebot gibt es (noch) keine Bestätigungsmail — die Vorlage spricht von Teil 1/Teil 2 und Widerruf.
  // Vertrag und Rechnung schickt der Ansprechpartner (Aufgabe aus firmaNacharbeit). Hier wird nichts versandt — „firma“ sagt
  // das dem Aufrufer, damit „Nachholen“ keine Bestätigungsmail meldet (Nachprüfung 08.10.2026, N1).
  const [fa] = (await sqlPool`SELECT fassung FROM fiaon_global_angebote WHERE id = ${id} LIMIT 1`) as any[];
  if (istFirmenFassung(fa?.fassung)) return { ok: true, grund: "Firmenangebot — keine automatische Bestätigungsmail", firma: true };
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NOW(), bestaetigung_mail_fehler = NULL, updated_at = NOW()
     WHERE id = ${id} AND status = 'angenommen' AND bestaetigung_mail_am IS NULL AND auftrag_ref IS NOT NULL RETURNING auftrag_ref`) as any[];
  if (!frei) return { ok: true, grund: null };
  const ref1 = String(frei.auftrag_ref);
  const z = (await angebotLesen({ id }))!;
  const d = angebotDatenAus(z);
  const akte = await globalAkteLesen(ref1); const b = await globalBestellungLesen(ref1);
  // E-273 (02.10.2026): Ist das Startgespräch gebucht, nennt die Bestätigung Tag, Uhrzeit, Dauer, mit wem, wie, Kalender
  // und Verschieben. Ohne Termin bleiben die Felder leer — der Absatz entfällt, die Mail ist die bisherige.
  const sgFelder = await import("./fiaon-global-angebot-startgespraech")
    .then(async (m) => { const st = await m.startgespraechStand(id); return st.stand === "gebucht" ? m.startgespraechMailFelder(st.termin) : {}; })
    .catch((e) => { console.error(`[FIAON-ANGEBOT] ${d.ref}: Startgespräch für die Bestätigung:`, e); return {} as Record<string, string>; });
  let mail: { ok: boolean; grund: string | null };
  try {
    const vertrag = await globalVertragPdfLesen(ref1);
    if (!vertrag) throw new Error("der angenommene Vertrag liegt nicht als PDF in der Akte");
    const rechnung = await globalRechnungPdf(ref1);
    if (!rechnung) throw new Error("die Rechnung ließ sich nicht erzeugen");
    mail = await globalMailSenden("global_angebot_angenommen", akte, b, {
      anhaenge: [{ name: `FIAON_Global_Individualvereinbarung_${d.ref}.pdf`, inhalt: vertrag }, { name: rechnung.dateiname, inhalt: rechnung.pdf }],
      zusatz: { ...angebotMailZusatz(z, d), ...sgFelder },
    });
  } catch (e) { mail = { ok: false, grund: e instanceof Error ? e.message : String(e) }; }
  if (mail.ok) {
    // E-273: Tag und Uhrzeit sind beim Kunden — keine eigene Mail zum Startgespräch mehr nötig.
    if (sgFelder.startgespraech_html) await sqlPool`UPDATE fiaon_global_angebote SET startgespraech_mail_am = COALESCE(startgespraech_mail_am, NOW()) WHERE id = ${id}`.catch(() => {});
    await sqlPool`UPDATE fiaon_global_auftraege SET auftrag_mail_am = COALESCE(auftrag_mail_am, NOW()), updated_at = NOW() WHERE ref = ${ref1}`.catch(() => {});
    await sqlPool`UPDATE fiaon_applications SET payment_email_sent_at = COALESCE(payment_email_sent_at, NOW()), welcome_sent_at = COALESCE(welcome_sent_at, NOW()) WHERE ref = ${ref1}`.catch(() => {});
  } else {
    await sqlPool`UPDATE fiaon_global_angebote SET bestaetigung_mail_am = NULL, bestaetigung_mail_fehler = ${mail.grund}, updated_at = NOW() WHERE id = ${id}`.catch(() => {});
    await sqlPool`UPDATE fiaon_global_auftraege SET auftrag_mail_fehler = ${mail.grund}, updated_at = NOW() WHERE ref = ${ref1}`.catch(() => {});
  }
  return mail;
}

/** Die Zusatzfelder der Angebots-Mails — Teile, Frist, Angebot (Werte entschärft). */
export function angebotMailZusatz(z: AngebotZeile, d: AngebotDaten, extra: Record<string, string> = {}): Record<string, string> {
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const fristEnde = isoTag(z.frist_ende);
  return {
    angebot_ref: esc(d.ref),
    teil1_text: angebotEur(d.parameter.teil1Cents),
    teil2_text: angebotEur(d.parameter.teil2Cents),
    gesamt_text: angebotEur(angebotGesamtCents(d.parameter)),
    frist_wochen_text: zahlwort(d.parameter.fristWochen),
    erstattung_tage_text: zahlwort(d.parameter.erstattungTage),
    teil2_ziel_text: zahlwort(d.parameter.teil2ZielTage),
    frist_ende_text: fristEnde ? angebotTag(fristEnde) : "",
    frist_beginn_text: isoTag(z.frist_beginn) ? angebotTag(isoTag(z.frist_beginn)) : "",
    buergin: esc(d.buergin.name),
    // E-271: Kreditgarantie — Ziel und der EINE Garantie-Satz aus angebotGarantie() (die Vorlagen tippen ihn nicht ab).
    kreditrahmen_text: angebotUsd(d.parameter.kapitalZielUsd),
    karten_text: angebotKarten(d.parameter.kartenZiel),
    garantie_text: esc(angebotGarantie(d.parameter).mail),
    // Gegenprüfung (logik-5): Nach erfüllter Garantie gibt es keine Erstattung mehr — die Teil-2-Mails sagen das.
    teil2_folge_text: z.garantie_erfuellt_am
      ? esc(ANGEBOT_GARANTIE_FEST.mailErfuellt)
      : `Wir begleiten Ihre Gesellschaft weiter, bis der Kreditrahmen von ${angebotUsd(d.parameter.kapitalZielUsd)} und ${angebotKarten(d.parameter.kartenZiel)} vollständig da sind (Ziffer 3 Absatz 1). Erreicht sie das bis zum ${fristEnde ? angebotTag(fristEnde) : "Ende Ihrer Frist"} nicht, erhalten Sie auch diese Zahlung zurück (Ziffer 6).`,
    // E-273 (02.10.2026): global_angebot_start — der Rest des Satzes „Ihr Ansprechpartner ist …". Vorgabe ist der Wortlaut bis
    // E-273; mit gebuchtem Startgespräch setzt angebotNachZahlung Tag und Uhrzeit ein (extra überschreibt).
    startgespraech_start_html: STARTGESPRAECH_TEXTE.mailStartOhne,
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLUNG (gerufen aus globalNachZahlung — alle Buchungswege gehen durch onCustomerPaid)
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Fristbeginn und -ende: Zahlungseingang, ohne sofortigen Beginn frühestens der Starttag nach der Widerrufsfrist —
 * und mit gewähltem Starttag („Starten ab", 01.10.2026) frühestens dieser Tag.
 */
export function angebotFristBerechnen(z: { bezahltAm: string; sofortBeginn: boolean; startAb: string | null; startAm?: string | null; wochen: number; hemmungTage: number }): { beginn: string; ende: string } {
  const kandidaten = [z.bezahltAm, !z.sofortBeginn && z.startAb ? z.startAb : null, z.startAm ?? null].filter((x): x is string => !!x && /^\d{4}-\d{2}-\d{2}$/.test(x));
  const beginn = kandidaten.reduce((a, b) => (b > a ? b : a), z.bezahltAm);
  return { beginn, ende: plusTage(beginn, z.wochen * 7 + Math.max(0, z.hemmungTage)) };
}

export async function angebotNachZahlung(ref: string, opts: { jetzt?: Date } = {}): Promise<{ gestartet: boolean; grund?: string }> {
  await ensureAngebotTabellen();
  const [t] = (await sqlPool`
    SELECT t.*, a.id AS a_id FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
     WHERE t.bestell_ref = ${ref} LIMIT 1`) as any[];
  if (!t) return { gestartet: false, grund: "kein Angebotsteil an dieser Bestellung" };
  const z = (await angebotLesen({ id: Number(t.a_id) }))!;
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaNachZahlung(ref, t, z); }
  const d = angebotDatenAus(z);
  const b = await globalBestellungLesen(ref);
  if (!b || String(b.payment_status) !== "paid") return { gestartet: false, grund: "nicht bezahlt" };
  // Gegenprüfung (logik-1): Erst-Buchung atomar erkennen — angebotNachZahlung ist wiederholbar (mark-paid, Abgleich, Nachbuchung).
  const [erstmals] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_am = ${b.completed_at ?? new Date()} WHERE id = ${t.id} AND bezahlt_am IS NULL RETURNING id`) as any[];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  const ref1 = String(z.auftrag_ref || ref);
  const akte1 = await globalAkteLesen(ref1);
  const zustaendig = (akte1?.zustaendig_agent_id ? Number(akte1.zustaendig_agent_id) : null) ?? (await globalEinstellungen()).zustaendigAgentId;
  const name = angebotKundeName(d.kunde);

  // ── Teil 2 bezahlt: nichts starten, vermerken und Bescheid geben ──
  if (Number(t.nr) === 2 && (z.erstattung_ausgeloest_am || t.entfallen_am)) {
    // E-271: Eine Zahlung für Teil 2 NACH dem Garantiefall (die Zeile war storniert; alsBezahltBuchen bucht ohne
    // Statusfilter) — keine Danke-Mail, sondern Justin: auch diesen Betrag erstatten. Nur bei der ERSTEN Buchung
    // (war Teil 2 schon vorher bezahlt, steckt er bereits im Erstattungsbetrag).
    if (!erstmals) return { gestartet: false, grund: "Teil 2 nach dem Garantiefall — schon vermerkt" };
    const plus = Number(t.betrag_cents);
    await sqlPool`UPDATE fiaon_global_angebote SET erstattung_cents = COALESCE(erstattung_cents, 0) + ${plus}, updated_at = NOW() WHERE id = ${z.id}`;
    await verlaufAngebot(Number(z.id), "System", `Zahlung Teil 2 NACH dem Garantiefall eingegangen (${angebotEur(plus)}, ${b.payment_reference}) — ebenfalls zu erstatten`);
    await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1,
      titel: `Garantiefall: Zahlung Teil 2 nach dem Fristende eingegangen — ${angebotEur(plus)} ebenfalls erstatten (${name})`,
      text: `Für das Individualangebot ${d.ref} ist der Garantiefall vorgemerkt; trotzdem ging eine Zahlung für Teil 2 ein (${angebotEur(plus)}, Verwendungszweck ${b.payment_reference}). Nach Ziffer 6 Absatz 2 erstattet FIAON alles Gezahlte — bitte diesen Betrag zusätzlich zurücküberweisen und die Bestellung wieder auf „storniert“ setzen. Das System hat KEIN Geld bewegt.`,
      dringend: true, anBetreiber: true, schluessel: `global:${ref1}:teil2-nach-garantiefall`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: "/chef/s/global-auftraege?reiter=angebote",
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe Teil 2 nach Garantiefall:`, e));
    return { gestartet: false, grund: "Teil 2 nach dem Garantiefall bezahlt — Erstattung an Justin" };
  }
  if (Number(t.nr) === 2) {
    await verlaufAngebot(Number(z.id), "System", `Teil 2 bezahlt (${angebotEur(Number(t.betrag_cents))})`);
    // E-271 / Ziffer 6 Abs. 3 (Gegenprüfung, vertrag-3): Die Frist ruhte, solange die fällige Teil-2-Rechnung offen war —
    // vom Tag nach der Fälligkeit bis zum Eingang. Einmal je Zahlung (erstmals), nur solange die Garantie läuft.
    const faellig = b.payment_due_date ? berlinToday(new Date(b.payment_due_date)) : null;
    const eingang = berlinToday(new Date(b.completed_at ?? new Date()));
    if (erstmals && faellig && eingang > faellig && z.frist_ende && !z.garantie_erfuellt_am && !z.erstattung_ausgeloest_am) {
      const tage = Math.round((new Date(`${eingang}T12:00:00Z`).getTime() - new Date(`${faellig}T12:00:00Z`).getTime()) / 864e5);
      if (tage > 0) {
        const [r] = (await sqlPool`
          UPDATE fiaon_global_angebote SET frist_hemmung_tage = frist_hemmung_tage + ${tage}, frist_ende = frist_ende + ${tage}::int, updated_at = NOW()
           WHERE id = ${z.id} AND garantie_erfuellt_am IS NULL AND erstattung_ausgeloest_am IS NULL RETURNING frist_ende`) as any[];
        if (r) {
          const von = plusTage(faellig, 1);
          const ende = isoTag(r.frist_ende)!;
          await verlaufAngebot(Number(z.id), "System", `Frist ruhte vom ${angebotTag(von)} bis ${angebotTag(eingang)} (${tage} Tage, Teil-2-Rechnung nach Fälligkeit offen, Ziffer 6 Absatz 3) — neues Fristende ${angebotTag(ende)}`, { hemmungVon: von, hemmungBis: eingang, hemmungTage: tage });
          await globalVerlauf(ref1, `FIAON Global: Frist des Individualangebots ruhte vom ${angebotTag(von)} bis ${angebotTag(eingang)} (Teil 2 nach Fälligkeit offen). Neues Fristende ${angebotTag(ende)}.`);
          if (akte1) {
            const z3 = (await angebotLesen({ id: Number(z.id) }))!;
            await globalMailSenden("global_angebot_hemmung", akte1, b, {
              zusatz: angebotMailZusatz(z3, d, { hemmung_von_text: angebotTag(von), hemmung_bis_text: angebotTag(eingang), hemmung_grund_text: "die Rechnung über Teil 2 war nach ihrer Fälligkeit noch offen" }),
            }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Mail Ruhezeit Teil 2:`, e));
          }
        }
      }
    }
    await globalVerlauf(ref1, `FIAON Global: Teil 2 „Kapital-Begleitung“ des Individualangebots ${d.ref} bezahlt (${b.payment_reference}).`);
    await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref: ref1,
      titel: `FIAON Global: Teil 2 bezahlt — ${name}`,
      text: `Die Rechnung über Teil 2 „Kapital-Begleitung“ (${angebotEur(Number(t.betrag_cents))}, Verwendungszweck ${b.payment_reference}) ist bezahlt. ${z.garantie_erfuellt_am ? "Die Garantie ist erfüllt — die Kapital-Begleitung ist am Ziel." : `Die Kapital-Begleitung läuft weiter bis zum garantierten Ziel (${angebotGarantieziel(d.parameter)}, Ziffer 3 Absatz 1), längstens bis zum Fristende — wird es nicht erreicht, wird auch Teil 2 erstattet (Ziffer 6).`}`,
      schluessel: `global:${ref1}:teil2-bezahlt`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref1), agentId: zustaendig, anlageText: "Zahlung Teil 2 gebucht.",
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe Teil 2 bezahlt:`, e));
    const [frei] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_mail_am = NOW() WHERE id = ${t.id} AND bezahlt_mail_am IS NULL RETURNING id`) as any[];
    if (frei && akte1) {
      const mail = await globalMailSenden("global_angebot_teil2_bezahlt", akte1, b, { zusatz: angebotMailZusatz(z, d) });
      if (!mail.ok) await sqlPool`UPDATE fiaon_global_angebot_teile SET bezahlt_mail_am = NULL WHERE id = ${t.id}`.catch(() => {});
    }
    return { gestartet: false, grund: "Teil 2 bezahlt — kein Start" };
  }

  // ── Teil 1: bezahlt vermerken, ggf. auf die Widerrufsfrist warten, dann starten ──
  await sqlPool`UPDATE fiaon_global_auftraege SET status = 'bezahlt', bezahlt_am = COALESCE(bezahlt_am, ${b.completed_at ?? new Date()}), updated_at = NOW() WHERE ref = ${ref} AND status = 'offen'`;
  const akte = await globalAkteLesen(ref);
  if (!akte) return { gestartet: false, grund: "Akte fehlt" };
  const warten = globalStartWartet(akte, opts.jetzt);
  if (warten) {
    // „Starten ab" (01.10.2026): Der Kunde hat einen Starttag gewählt — der Auftrag wartet bis dahin.
    const wunsch = warten.wunschtermin ?? null;
    await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: wunsch ? `FIAON Global: Teil 1 bezahlt, Start am gewählten Tag (${angebotTag(warten.startAb)}) — ${name}` : `FIAON Global: Teil 1 bezahlt, Start nach der Widerrufsfrist — ${name}`,
      text: [
        wunsch
          ? `Die Zahlung für Teil 1 (${angebotEur(d.parameter.teil1Cents)}) ist eingegangen. ${name} hat als Starttag den ${angebotTag(wunsch)} gewählt.`
          : `Die Zahlung für Teil 1 (${angebotEur(d.parameter.teil1Cents)}) ist eingegangen. ${name} hat NICHT verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen.`,
        `Die Widerrufsfrist endet am ${angebotTag(warten.fristEnde)}. Der Auftrag startet am ${angebotTag(warten.startAb)} von selbst — mit ihm beginnt die Frist von ${zahlwort(d.parameter.fristWochen)} Wochen.`,
        "Bis dahin: nichts beantragen und keine Gebühren auslösen. Widerruft der Kunde, sofort die Leitung informieren: Das Geld geht binnen vierzehn Tagen vollständig zurück.",
      ].join("\n"),
      schluessel: `global:${ref}:widerruf`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref), agentId: zustaendig, anlageText: "Zahlungseingang Teil 1 — Start nach der Widerrufsfrist.",
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe Widerrufsfrist:`, e));
    await globalVerlauf(ref, `FIAON Global: Teil 1 bezahlt. Start am ${angebotTag(warten.startAb)} (Widerrufsfrist bis ${angebotTag(warten.fristEnde)}).`);
    return { gestartet: false, grund: wunsch ? `Start am ${angebotTag(warten.startAb)}, dem gewählten Starttag` : `Start am ${angebotTag(warten.startAb)}, nach der Widerrufsfrist` };
  }

  // Frist setzen — einmal, beim Start.
  const sch = json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false });
  const { globalWiderrufsfrist } = await import("./fiaon-global-vertrag");
  const wf = globalWiderrufsfrist(new Date(z.angenommen_am));
  const bezahltAm = berlinToday(new Date(b.completed_at ?? new Date()));
  const frist = angebotFristBerechnen({ bezahltAm, sofortBeginn: sch.sofortBeginn === true, startAb: wf.startAb, startAm: sch.startAm ?? null, wochen: d.parameter.fristWochen, hemmungTage: Number(z.frist_hemmung_tage || 0) });
  await sqlPool`UPDATE fiaon_global_angebote SET frist_beginn = ${frist.beginn}::date, frist_ende = ${frist.ende}::date, updated_at = NOW() WHERE id = ${z.id} AND frist_beginn IS NULL`;
  const z2 = (await angebotLesen({ id: Number(z.id) }))!;
  const fristEnde = isoTag(z2.frist_ende) ?? frist.ende;

  let aufgabeId: number | null = null; let agentId: number | null = null;
  try {
    const erg = await auftragFuerKunden({
      personId: b.person_id != null ? Number(b.person_id) : null, ref,
      titel: `FIAON Global: Individualangebot starten — ${name}`,
      text: [
        `Die Zahlung für Teil 1 (${angebotEur(d.parameter.teil1Cents)}) liegt vor — der Auftrag startet JETZT. Der Kunde bekommt die Startmail mit deinem Namen und dem Fristende.`,
        `FRIST: ${zahlwort(d.parameter.fristWochen)} Wochen, vom ${angebotTag(isoTag(z2.frist_beginn))} bis ${angebotTag(fristEnde)}. FIAON GARANTIERT bis dahin ${angebotGarantieziel(d.parameter)} für die Gesellschaft (Ziffer 3 Absatz 1); wird das nicht vollständig erreicht, erstattet FIAON alles Gezahlte (Teil 1 und ggf. Teil 2, Ziffer 6). Ruhen darf die Frist nur nach schriftlicher Aufforderung mit mindestens sieben Tagen Frist (Leitung: „Frist hemmen“).`,
        "1. Startgespräch führen. 2. Reisepass prüfen, Sanktionslisten erneut abgleichen, PEP-Erklärung festhalten. 3. Bundesstaat mit Partner-Steuerberater, Gründung, EIN, Geschäftskonto. 4. Kapital-Begleitung: Kartenleiter und Anträge vorbereiten — kein Bankname gegenüber dem Kunden.",
        "Sobald das erste Kapital ausgezahlt oder die erste Karte freigeschaltet ist: der Leitung sagen — sie drückt „Meilenstein erreicht“, dann geht die Rechnung über Teil 2 raus. Die Garantie läuft danach weiter: Sind Kreditrahmen und Karten vollständig da, ebenfalls der Leitung sagen („Garantie erfüllt“).",
        `Bürgin: ${d.buergin.name} (Anlage 1). Fordert ein Institut eine Bürgschaft an, über die Leitung abstimmen.`,
      ].join("\n"),
      dringend: true, schluessel: `global:${ref}:start`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      link: globalOfficeAuftragPfad(ref), agentId: zustaendig, anlageText: "Zahlungseingang Teil 1 — Individualangebot startet.",
    });
    aufgabeId = erg.id; agentId = erg.agentId;
  } catch (e) { console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe „Individualangebot starten":`, e); }
  if (!aufgabeId) return { gestartet: false, grund: "Aufgabe nicht angelegt" };
  await sqlPool`
    UPDATE fiaon_global_auftraege SET status = 'gestartet', gestartet_am = COALESCE(gestartet_am, NOW()), zustaendig_agent_id = COALESCE(${agentId}, zustaendig_agent_id), updated_at = NOW()
     WHERE ref = ${ref} AND status IN ('offen', 'bezahlt')`;
  await import("./fiaon-global-bereich").then((m) => m.globalStartVermerken(ref)).catch((e) => console.error(`[FIAON-ANGEBOT] ${ref}: Etappe 1:`, e));
  await verlaufAngebot(Number(z.id), "System", `gestartet — Frist bis ${angebotTag(fristEnde)}`);
  // Die Startmail — genau einmal (dieselbe Marke wie der Global-Start).
  const [frei] = (await sqlPool`UPDATE fiaon_applications SET confirmed_email_sent_at = NOW() WHERE ref = ${ref} AND confirmed_email_sent_at IS NULL RETURNING ref`) as any[];
  if (frei) {
    const frisch = (await globalAkteLesen(ref)) ?? akte;
    // E-273 (02.10.2026): Steht das Startgespräch schon im Kalender, nennt die Startmail es statt „meldet sich … zu vereinbaren“.
    const startSatz = await import("./fiaon-global-angebot-startgespraech")
      .then(async (m) => m.startgespraechStartSatz(await m.startgespraechStand(Number(z.id))))
      .catch(() => STARTGESPRAECH_TEXTE.mailStartOhne);
    const mail = await globalMailSenden("global_angebot_start", frisch, b, { zusatz: angebotMailZusatz(z2, d, { startgespraech_start_html: startSatz }) });
    if (mail.ok) {
      await sqlPool`UPDATE fiaon_global_auftraege SET start_mail_am = NOW(), start_mail_fehler = NULL, updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
      await sqlPool`UPDATE fiaon_global_angebote SET start_mail_am = NOW() WHERE id = ${z.id}`.catch(() => {});
      await globalVerlauf(ref, `FIAON Global: Teil 1 bezahlt, Auftrag gestartet, Frist bis ${angebotTag(fristEnde)} — Startmail verschickt.`);
    } else {
      await sqlPool`UPDATE fiaon_applications SET confirmed_email_sent_at = NULL WHERE ref = ${ref}`.catch(() => {});
      await sqlPool`UPDATE fiaon_global_auftraege SET start_mail_fehler = ${mail.grund}, updated_at = NOW() WHERE ref = ${ref}`.catch(() => {});
      await globalVerlauf(ref, `FIAON Global: Auftrag gestartet, Frist bis ${angebotTag(fristEnde)} — die Startmail ging NICHT raus (${mail.grund}). Bitte dem Kunden das Fristende in Textform mitteilen.`);
    }
  }
  return { gestartet: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// MEILENSTEIN → TEIL 2
// ═══════════════════════════════════════════════════════════════════════════
export function meilensteinPruefen(lage: { status: string; teil1Bezahlt: boolean; teil2: any; fristEnde: string | null; heute: string; garantieErfuelltAm?: string | null }, ein: any):
  { ok: true; daten: { art: "kapital" | "karte"; datum: string; eingetragenAm: string; beleg: string } } | { ok: false; error: string } {
  if (lage.status !== "angenommen") return { ok: false, error: "Das Angebot ist nicht angenommen." };
  if (!lage.teil1Bezahlt) return { ok: false, error: "Teil 1 ist noch nicht bezahlt — der Meilenstein kommt nach dem Start." };
  if (!lage.teil2 || lage.teil2.bestell_ref) return { ok: false, error: "Teil 2 ist bereits berechnet." };
  if (lage.teil2.entfallen_am) return { ok: false, error: "Teil 2 ist entfallen (Garantiefall)." };
  // E-271 (Gegenprüfung, logik-4): Nach dem Fristende entfällt eine noch nicht berechnete Teil-2-Vergütung, wenn das
  // Garantieziel nicht erreicht war (Ziffer 6 Abs. 2) — dann zuerst „Garantie erfüllt“ eintragen, sonst Garantiefall.
  if (lage.fristEnde && lage.heute > lage.fristEnde && !lage.garantieErfuelltAm) return { ok: false, error: `Die Frist endete am ${angebotTag(lage.fristEnde)} — zuerst „Garantie erfüllt“ eintragen; sonst gilt der Garantiefall.` };
  const art = ein?.art === "karte" ? "karte" : ein?.art === "kapital" ? "kapital" : null;
  if (!art) return { ok: false, error: "Bitte wählen: Kapital ausgezahlt oder Karte freigeschaltet." };
  const datum = String(ein?.datum ?? "").trim(); const eingetragenAm = String(ein?.eingetragenAm ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ok: false, error: "Datum der Auszahlung bzw. Freischaltung fehlt." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eingetragenAm)) return { ok: false, error: "Datum der Eintragung der Gesellschaft fehlt." };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (eingetragenAm > datum) return { ok: false, error: "Die Gesellschaft muss vor der Auszahlung bzw. Freischaltung eingetragen sein." };
  if (lage.fristEnde && datum > lage.fristEnde) return { ok: false, error: `Das Ereignis liegt nach dem Fristende (${angebotTag(lage.fristEnde)}) — dann gilt der Garantiefall (Ziffer 6).` };
  const beleg = text(ein?.beleg, 600);
  if (beleg.length < 20) return { ok: false, error: "Bitte den Beleg in einem Satz festhalten (mindestens 20 Zeichen) — er bleibt intern, der Kunde sieht keinen Banknamen." };
  return { ok: true, daten: { art, datum, eingetragenAm, beleg } };
}

export async function angebotMeilenstein(id: number, ein: any, wer: string): Promise<Ergebnis<{ ref2: string; meldung: string }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Bitte die Knöpfe des Firmenangebots verwenden (Bedingungen, erste Runde, Garantiefall).", 409);
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  const teil2 = (z.teile as any[]).find((x) => Number(x.nr) === 2);
  const b1 = teil1?.bestell_ref ? await globalBestellungLesen(String(teil1.bestell_ref)) : null;
  const p = meilensteinPruefen({ status: String(z.status), teil1Bezahlt: String(b1?.payment_status) === "paid", teil2, fristEnde: isoTag(z.frist_ende), heute: berlinToday(), garantieErfuelltAm: isoTag(z.garantie_erfuellt_am) }, ein);
  if (!p.ok) return nein(p.error, 409);
  if (z.erstattung_ausgeloest_am) return nein("Der Garantiefall ist vorgemerkt — es gibt keine Rechnung über Teil 2 mehr.", 409);
  const d = angebotDatenAus(z);
  const ref1 = String(z.auftrag_ref);
  // Erst die Angaben am Teil festhalten (Beschreibung der Rechnung liest sie), dann die Zeile, dann binden.
  const ref2 = `FIAON-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").slice(0, 4).toUpperCase()}`;
  const [gesichert] = (await sqlPool`
    UPDATE fiaon_global_angebot_teile
       SET meilenstein_am = ${p.daten.datum}::date, meilenstein_art = ${p.daten.art}, meilenstein_beleg = ${p.daten.beleg}, meilenstein_von = ${wer},
           eingetragen_am = ${p.daten.eingetragenAm}::date
     WHERE id = ${teil2.id} AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
  if (!gesichert) return nein("Teil 2 wurde gerade schon berechnet.", 409);
  const ok = await bestellzeileAnlegen(ref2, d, 2, { ip: String(z.ip || ""), userAgent: String(z.user_agent || "") });
  if (!ok) return nein("Die Bestellzeile für Teil 2 ließ sich nicht anlegen — bitte noch einmal versuchen.", 502);
  // Gegenprüfung (logik-4): Nicht an einen Teil binden, der inzwischen (Garantiefall) entfallen ist.
  const [gebunden] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET bestell_ref = ${ref2} WHERE id = ${teil2.id} AND bestell_ref IS NULL AND entfallen_am IS NULL RETURNING id`) as any[];
  if (!gebunden) {
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${ref2} AND payment_status IN ('pending', 'pending_payment')`.catch(() => {});
    return nein("Teil 2 ist inzwischen entfallen (Garantiefall) — keine Rechnung.", 409);
  }
  const { bestellungFuerAntrag } = await import("../routes/fiaon-antrag");
  const erg = await bestellungFuerAntrag(ref2, { globalMailFolgt: true });
  if (erg.status !== 200) return nein(`Die Rechnung für Teil 2 ließ sich nicht anlegen: ${String((erg.body as any)?.error || erg.status)}`, 502);
  await sqlPool`UPDATE fiaon_applications SET rechnung_ust_modus = 'none' WHERE ref = ${ref2}`.catch(() => {});
  await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_am = NOW() WHERE id = ${teil2.id}`;
  const ereignis = p.daten.art === "karte" ? "erste Business-Kreditkarte freigeschaltet" : "erstes Kapital ausgezahlt";
  await verlaufAngebot(id, wer, `Meilenstein: ${ereignis} am ${angebotTag(p.daten.datum)}, Gesellschaft eingetragen am ${angebotTag(p.daten.eingetragenAm)} — Rechnung Teil 2 (${ref2})`, { beleg: p.daten.beleg });
  await globalVerlauf(ref1, `FIAON Global: Meilenstein des Individualangebots ${d.ref} erreicht (${ereignis} am ${angebotTag(p.daten.datum)}). Rechnung über Teil 2 „Kapital-Begleitung“ angelegt (${ref2}).`);
  // Mail mit Rechnung Teil 2 — an die Akte von Teil 1 (Anschrift, Ansprechpartner), Bestellung = Teil 2.
  const akte1 = await globalAkteLesen(ref1); const b2 = await globalBestellungLesen(ref2);
  let meldung = `Rechnung über Teil 2 (${angebotEur(d.parameter.teil2Cents)}) angelegt, zahlbar binnen ${zahlwort(d.parameter.teil2ZielTage)} Tagen.`;
  try {
    const r = await globalRechnungPdf(ref2);
    if (!r) throw new Error("Rechnung Teil 2 nicht erzeugt");
    const z2 = (await angebotLesen({ id }))!;
    const mail = await globalMailSenden("global_angebot_teil2", akte1, b2, {
      anhaenge: [{ name: r.dateiname, inhalt: r.pdf }],
      zusatz: angebotMailZusatz(z2, d, { ereignis_text: p.daten.art === "karte" ? "die erste Business-Kreditkarte für Ihre Gesellschaft freigeschaltet" : "das erste Kapital an Ihre Gesellschaft ausgezahlt", ereignis_am_text: angebotTag(p.daten.datum) }),
      ausgeloestVon: wer,
    });
    if (mail.ok) await sqlPool`UPDATE fiaon_global_angebot_teile SET rechnung_mail_am = NOW() WHERE id = ${teil2.id}`;
    meldung += mail.ok ? " Die Mail mit der Rechnung ist beim Kunden." : ` Die Mail ging NICHT raus (${mail.grund}) — bitte die Rechnung von Hand schicken.`;
  } catch (e) { meldung += ` Die Mail ging NICHT raus (${e instanceof Error ? e.message : String(e)}).`; }
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: b2?.person_id != null ? Number(b2.person_id) : null, ref: ref1,
    titel: `FIAON Global: Meilenstein erreicht — Rechnung Teil 2 an ${angebotKundeName(d.kunde)}`,
    text: `${wer} hat den Meilenstein eingetragen (${ereignis} am ${angebotTag(p.daten.datum)}). Rechnung über Teil 2 (${angebotEur(d.parameter.teil2Cents)}, Verwendungszweck ${b2?.payment_reference ?? "—"}) ist raus, zahlbar binnen ${zahlwort(d.parameter.teil2ZielTage)} Tagen. Die Garantie läuft weiter: bis zum Fristende ${angebotGarantieziel(d.parameter)} — sind beide vollständig da, der Leitung sagen („Garantie erfüllt“).`,
    schluessel: `global:${ref1}:teil2`, bereich: "konten", quelle: "global", autorName: wer,
    link: globalOfficeAuftragPfad(ref1), agentId: akte1?.zustaendig_agent_id ? Number(akte1.zustaendig_agent_id) : null,
    anlageText: "Meilenstein im Reiter „Individualangebote“ eingetragen.",
  }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe Meilenstein:`, e));
  return { ok: true, ref2, meldung };
}

// ═══════════════════════════════════════════════════════════════════════════
// FRIST HEMMEN · ERSTATTUNG VORMERKEN · ERSTATTUNG ÜBERWIESEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Die Ruhezeit nach Ziffer 6 Absatz 3 — gerechnet, nicht getippt (Gegenprüfung 01.10.2026):
 * Die Frist ruht ab dem Ablauf der Aufforderungsfrist (Aufforderung in Textform + sieben Tage) bis zu dem
 * Tag, an dem die Mitwirkung erbracht ist (offen: bis heute). Was eine frühere Hemmung schon gezählt hat
 * (`bisher` = letzter gezählter Tag), zählt nicht noch einmal. Rein — der Prüfstand rechnet sie nach.
 */
export function hemmungRechnen(ein: { aufgefordertAm: string; erbrachtAm: string | null; heute: string; bisher: string | null }):
  { ok: true; von: string; bis: string; tage: number } | { ok: false; error: string } {
  const tag = /^\d{4}-\d{2}-\d{2}$/;
  if (!tag.test(ein.aufgefordertAm) || ein.aufgefordertAm > ein.heute) return { ok: false, error: "Datum der Aufforderung in Textform (nicht in der Zukunft)." };
  const ruhtAb = plusTage(ein.aufgefordertAm, ANGEBOT_FEST.hemmungAufforderungTage);
  if (ruhtAb > ein.heute) return { ok: false, error: `Die Aufforderungsfrist von ${zahlwort(ANGEBOT_FEST.hemmungAufforderungTage)} Tagen läuft noch bis ${angebotTag(ruhtAb)} — vorher ruht die Frist nicht (Ziffer 6 Absatz 3).` };
  if (ein.erbrachtAm !== null && (!tag.test(ein.erbrachtAm) || ein.erbrachtAm > ein.heute)) return { ok: false, error: "Datum, an dem die Mitwirkung erbracht wurde (nicht in der Zukunft) — oder leer, wenn sie noch fehlt." };
  if (ein.erbrachtAm !== null && ein.erbrachtAm < ruhtAb) return { ok: false, error: `Die Mitwirkung kam am ${angebotTag(ein.erbrachtAm)}, vor Ablauf der Aufforderungsfrist (${angebotTag(ruhtAb)}) — die Frist hat nicht geruht.` };
  // Der Tag der Mitwirkung zählt nicht mehr (kundenfreundlich); fehlt sie noch, zählt bis heute einschließlich.
  const bis = ein.erbrachtAm !== null ? plusTage(ein.erbrachtAm, -1) : ein.heute;
  // Ab dem Tag nach der letzten gezählten Hemmung — derselbe Tag wird nie zweimal gezählt.
  const von = ein.bisher && plusTage(ein.bisher, 1) > ruhtAb ? plusTage(ein.bisher, 1) : ruhtAb;
  const tage = Math.round((new Date(`${bis}T12:00:00Z`).getTime() - new Date(`${von}T12:00:00Z`).getTime()) / 864e5) + 1;
  if (tage < 1) return { ok: false, error: ein.bisher && ein.bisher >= ruhtAb ? `Bis ${angebotTag(ein.bisher)} ist die Ruhezeit schon gezählt — es kommt kein Tag dazu.` : "Es ergibt sich keine Ruhezeit — die Mitwirkung kam am Tag nach Ablauf der Aufforderungsfrist." };
  if (tage > 180) return { ok: false, error: "Mehr als ein halbes Jahr Ruhen — bitte den Fall mit Justin klären, bevor die Frist weiter ruht." };
  return { ok: true, von, bis, tage };
}

export async function angebotFristHemmen(id: number, ein: any, wer: string): Promise<Ergebnis<{ fristEnde: string; tage: number; von: string; bis: string }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Bitte die Knöpfe des Firmenangebots verwenden (Bedingungen, erste Runde, Garantiefall).", 409);
  if (!z.frist_ende) return nein("Die Frist läuft noch nicht — sie beginnt mit dem Start.", 409);
  // E-271: Die Frist läuft auch nach dem Meilenstein weiter (Garantie bis zum Fristende) — Hemmen geht bis zur
  // erfüllten Garantie oder zum Garantiefall.
  if (z.garantie_erfuellt_am || z.erstattung_ausgeloest_am) return nein("Nach erfüllter Garantie oder vorgemerktem Garantiefall gibt es keine Frist mehr zu hemmen.", 409);
  const grund = text(ein?.grund, 500);
  if (grund.length < 20) return nein("Welche Mitwirkung fehlt? Bitte in einem Satz (mindestens 20 Zeichen) — die Frist ruht nur bei schuldhaft fehlender Mitwirkung nach Aufforderung (Ziffer 6 Absatz 3).");
  const erbrachtRoh = String(ein?.erbrachtAm ?? "").trim();
  // Der letzte schon gezählte Tag steht im Verlauf (hemmungBis) — so zählt keine Ruhezeit doppelt.
  const bisher = json<any[]>(z.verlauf, []).map((v) => (typeof v?.hemmungBis === "string" ? v.hemmungBis : null)).filter((x): x is string => !!x).sort().pop() ?? null;
  const h = hemmungRechnen({ aufgefordertAm: String(ein?.aufgefordertAm ?? "").trim(), erbrachtAm: erbrachtRoh || null, heute: berlinToday(), bisher });
  if (!h.ok) return nein(h.error);
  const [r] = (await sqlPool`
    UPDATE fiaon_global_angebote SET frist_hemmung_tage = frist_hemmung_tage + ${h.tage}, frist_ende = frist_ende + ${h.tage}::int, updated_at = NOW()
     WHERE id = ${id} RETURNING frist_ende`) as any[];
  const ende = isoTag(r.frist_ende)!;
  const d = angebotDatenAus(z);
  await verlaufAngebot(id, wer, `Frist ruhte vom ${angebotTag(h.von)} bis ${angebotTag(h.bis)} (${h.tage} Tage; Aufforderung vom ${angebotTag(String(ein.aufgefordertAm))}${erbrachtRoh ? `, Mitwirkung erbracht am ${angebotTag(erbrachtRoh)}` : ", Mitwirkung noch offen"}): ${grund} — neues Fristende ${angebotTag(ende)}`, { hemmungVon: h.von, hemmungBis: h.bis, hemmungTage: h.tage });
  const ref1 = String(z.auftrag_ref);
  await globalVerlauf(ref1, `FIAON Global: Frist des Individualangebots ruhte vom ${angebotTag(h.von)} bis ${angebotTag(h.bis)} (${wer}). Neues Fristende ${angebotTag(ende)}.`);
  // Ziffer 6 Absatz 1 verlangt die Mitteilung in Textform — die Mail geht im selben Schritt (Protokoll in fiaon_mail_log).
  const akte1 = await globalAkteLesen(ref1); const b1 = await globalBestellungLesen(ref1);
  let mitgeteilt = false; let mailGrund: string | null = null;
  if (akte1) {
    const z2 = (await angebotLesen({ id }))!;
    const mail = await globalMailSenden("global_angebot_hemmung", akte1, b1, {
      zusatz: angebotMailZusatz(z2, d, { hemmung_von_text: angebotTag(h.von), hemmung_bis_text: angebotTag(h.bis), hemmung_grund_text: grund.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") }),
      ausgeloestVon: wer,
    });
    mitgeteilt = mail.ok; mailGrund = mail.grund;
  }
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  await auftragFuerKunden({
    personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
    titel: `FIAON Global: Frist ruhte, neues Fristende ${angebotTag(ende)} — ${angebotKundeName(d.kunde)}`,
    text: mitgeteilt
      ? `${wer} hat die Ruhezeit eingetragen (vom ${angebotTag(h.von)} bis ${angebotTag(h.bis)}: ${grund}). Der Kunde hat das neue Fristende ${angebotTag(ende)} per Mail bekommen. Bitte beim nächsten Gespräch kurz ansprechen.`
      : `${wer} hat die Ruhezeit eingetragen (vom ${angebotTag(h.von)} bis ${angebotTag(h.bis)}: ${grund}). Die Mail an den Kunden ging NICHT raus (${mailGrund ?? "kein Grund"}) — der Vertrag verlangt die Mitteilung in Textform: bitte das neue Fristende ${angebotTag(ende)} schriftlich mitteilen.`,
    dringend: !mitgeteilt, schluessel: `global:${ref1}:hemmung:${ende}`, bereich: "konten", quelle: "global", autorName: wer, link: globalOfficeAuftragPfad(ref1),
    agentId: akte1?.zustaendig_agent_id ? Number(akte1.zustaendig_agent_id) : null,
  }).catch((e) => console.error(`[FIAON-ANGEBOT] ${z.angebot_ref}: Aufgabe Hemmung:`, e));
  return { ok: true, fristEnde: ende, tage: h.tage, von: h.von, bis: h.bis };
}

/** Seit wann eine berechnete Teil-2-Rechnung fällig und offen ist (Ziffer 6 Abs. 3: die Frist ruht) — sonst null. */
export function teil2OffenSeit(b2: { payment_status?: unknown; payment_due_date?: unknown } | null | undefined, heute: string): string | null {
  if (!b2 || !["pending_payment", "claimed_paid", "expired"].includes(String(b2.payment_status))) return null;
  const f = b2.payment_due_date ? (b2.payment_due_date instanceof Date ? berlinToday(b2.payment_due_date) : String(b2.payment_due_date).slice(0, 10)) : null;
  return f && /^\d{4}-\d{2}-\d{2}$/.test(f) && f < heute ? f : null;
}

/**
 * Wann der Garantiefall vorgemerkt werden darf (E-271): angenommen, Teil 1 bezahlt, Frist abgelaufen, Garantie NICHT als
 * erfüllt eingetragen, noch nicht vorgemerkt. Der Meilenstein (erstes Kapital/erste Karte) sperrt NICHT mehr — die Garantie
 * gilt bis zum Fristende für Kreditrahmen UND Karten.
 */
export function erstattungPruefen(lage: { status: string; teil1Bezahlt: boolean; teil2: any; fristEnde: string | null; heute: string; schon: boolean; garantieErfuelltAm?: string | null; akteStatus?: string | null; teil2OffenSeit?: string | null }):
  { ok: true } | { ok: false; error: string } {
  if (lage.status !== "angenommen") return { ok: false, error: "Das Angebot ist nicht angenommen." };
  if (lage.schon) return { ok: false, error: "Der Garantiefall ist bereits vorgemerkt." };
  if (lage.garantieErfuelltAm) return { ok: false, error: `Die Garantie ist erfüllt (am ${angebotTag(lage.garantieErfuelltAm)}) — kein Garantiefall.` };
  // Gegenprüfung (logik-3): Nach Kündigung oder Widerruf (Akte storniert) entfallen Garantie und Erstattung (Ziffer 10 Abs. 2, Ziffer 11).
  if (lage.akteStatus === "storniert") return { ok: false, error: "Der Auftrag ist storniert (Kündigung oder Widerruf) — es gibt keinen Garantiefall." };
  // Gegenprüfung (vertrag-3): Solange eine fällige Teil-2-Rechnung offen ist, ruht die Frist (Ziffer 6 Abs. 3).
  if (lage.teil2OffenSeit) return { ok: false, error: `Die Rechnung über Teil 2 ist seit ${angebotTag(lage.teil2OffenSeit)} fällig und offen — die Frist ruht (Ziffer 6 Absatz 3), kein Garantiefall.` };
  if (!lage.teil1Bezahlt) return { ok: false, error: "Teil 1 ist nicht bezahlt — es gibt nichts zu erstatten." };
  if (!lage.fristEnde) return { ok: false, error: "Die Frist läuft noch nicht." };
  if (lage.heute <= lage.fristEnde) return { ok: false, error: `Die Frist läuft bis ${angebotTag(lage.fristEnde)} — erst danach.` };
  return { ok: true };
}

/** Was im Garantiefall mit Teil 2 geschieht — aus dem Stand der Bestellung (rein, der Prüfstand rechnet nach). */
export type Teil2Fall = "nicht berechnet" | "offen → storniert" | "bezahlt → erstattet" | "schon storniert";
export function garantiefallRechnen(lage: { teil1Cents: number; teil2Cents: number; teil2BestellRef: string | null; teil2Zahlung: string | null }):
  { teil2Fall: Teil2Fall; summeCents: number } {
  const z = String(lage.teil2Zahlung ?? "");
  const teil2Fall: Teil2Fall = !lage.teil2BestellRef || z === "" || z === "pending" ? "nicht berechnet"
    : z === "paid" ? "bezahlt → erstattet"
    : ["cancelled", "superseded", "refunded"].includes(z) ? "schon storniert"
    : "offen → storniert";
  return { teil2Fall, summeCents: lage.teil1Cents + (teil2Fall === "bezahlt → erstattet" ? lage.teil2Cents : 0) };
}

/**
 * „Garantie erfüllt“ (E-271): Kreditrahmen ≥ Ziel UND Karten ≥ Ziel, bis zum Fristende, mit internem Beleg. Erst nach dem
 * Meilenstein (Teil 2 berechnet) — der Meilenstein ist das erste Kapital bzw. die erste Karte. Rein — Prüfstand und Knöpfe.
 */
export function garantiePruefen(
  lage: { status: string; teil1Bezahlt: boolean; teil2: any; fristEnde: string | null; heute: string; erstattungAusgeloest: boolean; erfuelltAm: string | null; ziel: { rahmenUsd: number; karten: number } },
  ein: any,
): { ok: true; daten: { erfuelltAm: string; rahmenUsd: number; karten: number; beleg: string } } | { ok: false; error: string } {
  if (lage.status !== "angenommen") return { ok: false, error: "Das Angebot ist nicht angenommen." };
  if (lage.erfuelltAm) return { ok: false, error: `Die Garantie ist schon als erfüllt eingetragen (${angebotTag(lage.erfuelltAm)}).` };
  if (lage.erstattungAusgeloest) return { ok: false, error: "Der Garantiefall ist vorgemerkt — die Garantie lässt sich nicht mehr als erfüllt eintragen." };
  if (!lage.teil1Bezahlt) return { ok: false, error: "Teil 1 ist noch nicht bezahlt." };
  if (!lage.fristEnde) return { ok: false, error: "Die Frist läuft noch nicht." };
  const erfuelltAm = String(ein?.erfuelltAm ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(erfuelltAm)) return { ok: false, error: "Datum, an dem Kreditrahmen und Karten vollständig vorlagen (JJJJ-MM-TT)." };
  if (erfuelltAm > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (erfuelltAm > lage.fristEnde) return { ok: false, error: `Das Datum liegt nach dem Fristende (${angebotTag(lage.fristEnde)}) — dann gilt der Garantiefall.` };
  const ms = lage.teil2?.meilenstein_am ? (lage.teil2.meilenstein_am instanceof Date ? berlinToday(lage.teil2.meilenstein_am) : String(lage.teil2.meilenstein_am).slice(0, 10)) : null;
  if (ms && erfuelltAm < ms) return { ok: false, error: `Das Datum liegt vor dem Meilenstein (${angebotTag(ms)}).` };
  // Gegenprüfung (logik-2): streng — ganze US-Dollar, Tausenderpunkte erlaubt, KEINE Nachkommastellen („750.000,00“ ist nicht 75.000.000).
  const rohRahmen = String(ein?.rahmenUsd ?? "").trim();
  if (!/^\d+$|^\d{1,3}([.\s]\d{3})+$/.test(rohRahmen)) return { ok: false, error: "Kreditrahmen in ganzen US-Dollar ohne Cent eintragen (z. B. 800.000)." };
  const rahmenUsd = Number(rohRahmen.replace(/[.\s]/g, ""));
  const rohKarten = String(ein?.karten ?? "").trim();
  if (!/^\d+$/.test(rohKarten)) return { ok: false, error: "Zahl der freigeschalteten Karten als ganze Zahl eintragen." };
  const karten = Number(rohKarten);
  if (!Number.isFinite(rahmenUsd) || rahmenUsd < lage.ziel.rahmenUsd) return { ok: false, error: `Der eingeräumte Kreditrahmen muss zusammen mindestens ${angebotUsd(lage.ziel.rahmenUsd)} betragen (Kartenlimits zählen nicht).` };
  if (!Number.isFinite(karten) || karten < lage.ziel.karten) return { ok: false, error: `Es müssen mindestens ${angebotKarten(lage.ziel.karten)} freigeschaltet sein.` };
  const beleg = text(ein?.beleg, 800);
  if (beleg.length < 20) return { ok: false, error: "Bitte die Belege in einem Satz festhalten (mindestens 20 Zeichen) — intern, der Kunde sieht keinen Banknamen." };
  return { ok: true, daten: { erfuelltAm, rahmenUsd, karten, beleg } };
}

export async function angebotGarantieErfuellt(id: number, ein: any, wer: string): Promise<Ergebnis<{ meldung: string }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Bitte die Knöpfe des Firmenangebots verwenden (Bedingungen, erste Runde, Garantiefall).", 409);
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  const teil2 = (z.teile as any[]).find((x) => Number(x.nr) === 2);
  const b1 = teil1?.bestell_ref ? await globalBestellungLesen(String(teil1.bestell_ref)) : null;
  const d = angebotDatenAus(z);
  const p = garantiePruefen({
    status: String(z.status), teil1Bezahlt: String(b1?.payment_status) === "paid", teil2, fristEnde: isoTag(z.frist_ende), heute: berlinToday(),
    erstattungAusgeloest: !!z.erstattung_ausgeloest_am, erfuelltAm: isoTag(z.garantie_erfuellt_am),
    ziel: { rahmenUsd: d.parameter.kapitalZielUsd, karten: d.parameter.kartenZiel },
  }, ein);
  if (!p.ok) return nein(p.error, 409);
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote
       SET garantie_erfuellt_am = ${p.daten.erfuelltAm}::date, garantie_rahmen_usd = ${p.daten.rahmenUsd}, garantie_karten = ${p.daten.karten},
           garantie_beleg = ${p.daten.beleg}, garantie_von = ${wer}, garantie_eingetragen_am = NOW(), updated_at = NOW()
     WHERE id = ${id} AND garantie_erfuellt_am IS NULL AND erstattung_ausgeloest_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein("Die Garantie wurde gerade schon eingetragen — oder der Garantiefall ist vorgemerkt.", 409);
  const satz = `Garantie erfüllt am ${angebotTag(p.daten.erfuelltAm)}: Kreditrahmen ${angebotUsd(p.daten.rahmenUsd)}, ${angebotKarten(p.daten.karten)}`;
  await verlaufAngebot(id, wer, satz, { beleg: p.daten.beleg });
  const ref1 = String(z.auftrag_ref || "");
  if (ref1) {
    await globalVerlauf(ref1, `FIAON Global: ${satz} (Individualangebot ${d.ref}, eingetragen von ${wer}). Kein Garantiefall mehr; die Kapital-Begleitung ist am Ziel (Ziffer 3 Absatz 5).`);
    const akte1 = await globalAkteLesen(ref1);
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
      titel: `FIAON Global: Garantie erfüllt — ${angebotKundeName(d.kunde)}`,
      text: `${wer} hat eingetragen: ${satz}. Bitte dem Kunden gratulieren und die Unterlagen (Kreditverträge, Kartenbestätigungen) im Dokumentenraum ablegen.`,
      schluessel: `global:${ref1}:garantie`, bereich: "konten", quelle: "global", autorName: wer,
      link: globalOfficeAuftragPfad(ref1), agentId: akte1?.zustaendig_agent_id ? Number(akte1.zustaendig_agent_id) : null,
      anlageText: "Garantie erfüllt im Reiter „Individualangebote“ eingetragen.",
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe Garantie erfüllt:`, e));
  }
  return { ok: true, meldung: `${satz}. Kein Garantiefall mehr; die Fristwarnungen enden.` };
}

/**
 * DER GARANTIEFALL (E-271, Ziffer 6 Abs. 2): Frist abgelaufen, Garantie nicht als erfüllt eingetragen.
 * Reihenfolge: Anspruch sichern → Teil 2 (nicht berechnet: entfällt; offen: Storno; bezahlt: Storno, wird erstattet) →
 * Teil 1 über den Storno-Weg mit Erstattung (ohne eigene Erstattungsaufgabe) → EINE Aufgabe an Justin mit der Summe →
 * Mail an den Kunden. Geld bewegt das System nicht — überwiesen wird von Hand.
 */
export async function angebotErstattungVormerken(id: number, wer: string): Promise<Ergebnis<{ meldung: string }>> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (istFirmenFassung(z.fassung)) return nein("Firmenangebot: Bitte die Knöpfe des Firmenangebots verwenden (Bedingungen, erste Runde, Garantiefall).", 409);
  const teil1 = (z.teile as any[]).find((x) => Number(x.nr) === 1);
  const teil2 = (z.teile as any[]).find((x) => Number(x.nr) === 2);
  const ref1 = String(z.auftrag_ref || "");
  const b1 = ref1 ? await globalBestellungLesen(ref1) : null;
  const ref2 = teil2?.bestell_ref ? String(teil2.bestell_ref) : null;
  const b2 = ref2 ? await globalBestellungLesen(ref2) : null;
  const fristEnde = isoTag(z.frist_ende);
  const akteG = ref1 ? await globalAkteLesen(ref1) : null;
  const heute = berlinToday();
  const p = erstattungPruefen({
    status: String(z.status), teil1Bezahlt: String(b1?.payment_status) === "paid", teil2, fristEnde, heute, schon: !!z.erstattung_ausgeloest_am,
    garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), akteStatus: akteG ? String(akteG.status) : null, teil2OffenSeit: teil2OffenSeit(b2, heute),
  });
  if (!p.ok) return nein(p.error, 409);
  const d = angebotDatenAus(z);
  const teil1Cents = Number(teil1?.betrag_cents ?? d.parameter.teil1Cents);
  const teil2Cents = Number(teil2?.betrag_cents ?? d.parameter.teil2Cents);
  const [frei] = (await sqlPool`
    UPDATE fiaon_global_angebote SET erstattung_ausgeloest_am = NOW(), erstattung_ausgeloest_von = ${wer}, updated_at = NOW()
     WHERE id = ${id} AND erstattung_ausgeloest_am IS NULL AND garantie_erfuellt_am IS NULL RETURNING id`) as any[];
  if (!frei) return nein("Der Garantiefall ist bereits vorgemerkt — oder die Garantie wurde gerade als erfüllt eingetragen.", 409);
  // Gegenprüfung (logik-7): den Stand von Teil 2 NACH dem Anspruch lesen — eine Zahlung dazwischen zählt mit.
  const b2jetzt = ref2 ? await globalBestellungLesen(ref2) : null;
  const fall = garantiefallRechnen({ teil1Cents, teil2Cents, teil2BestellRef: ref2, teil2Zahlung: b2jetzt ? String(b2jetzt.payment_status ?? "") : null });
  await sqlPool`UPDATE fiaon_global_angebote SET erstattung_cents = ${fall.summeCents} WHERE id = ${id}`;
  const zuruecksetzen = async () => {
    await sqlPool`UPDATE fiaon_global_angebote SET erstattung_ausgeloest_am = NULL, erstattung_ausgeloest_von = NULL, erstattung_cents = NULL WHERE id = ${id}`;
  };
  const grundTeil2 = `Garantiefall: Frist am ${angebotTag(fristEnde)} abgelaufen, Garantieziel (${angebotGarantieziel(d.parameter)}) nicht vollständig erreicht`;
  // ── Teil 2 ──
  if (fall.teil2Fall === "offen → storniert" || fall.teil2Fall === "bezahlt → erstattet") {
    const { bestellungStornieren } = await import("../routes/fiaon-antrag");
    const st = await bestellungStornieren({ ref: ref2 }, wer).catch((e) => { console.error(`[FIAON-ANGEBOT] ${d.ref}: Storno Teil 2:`, e); return null; });
    if (!st) {
      const neu2 = await globalBestellungLesen(ref2!);
      if (!["cancelled", "superseded"].includes(String(neu2?.payment_status))) {
        await zuruecksetzen();
        return nein("Die Rechnung über Teil 2 ließ sich nicht stornieren — es wurde nichts geändert. Bitte noch einmal versuchen.", 409);
      }
    }
  }
  // Gegenprüfung (logik-8): Eine gebundene, aber nie berechnete Teil-2-Zeile (Status 'pending') direkt stornieren.
  if (fall.teil2Fall === "nicht berechnet" && ref2) {
    await sqlPool`UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW() WHERE ref = ${ref2} AND payment_status = 'pending'`.catch(() => {});
  }
  if (teil2) {
    await sqlPool`UPDATE fiaon_global_angebot_teile SET entfallen_am = NOW(), entfallen_grund = ${`${grundTeil2} — ${fall.teil2Fall}`} WHERE id = ${teil2.id} AND entfallen_am IS NULL`;
  }
  // ── Teil 1 ──
  const bis = plusTage(fristEnde!, d.parameter.erstattungTage);
  const { globalAuftragStornieren } = await import("./fiaon-global-storno");
  // Gegenprüfung (logik-6): Eine Ausnahme im Storno-Weg darf den Garantiefall nicht halb stehen lassen.
  const storno = await globalAuftragStornieren(ref1, {
    grund: `${grundTeil2}. Garantie Ziffer 3 Absatz 1 und Ziffer 6 des Individualangebots ${d.ref}: alles Gezahlte zurück (${angebotEur(fall.summeCents)}); Teil 2 ${fall.teil2Fall}; die Gesellschaft bleibt beim Kunden.`,
    erstattung: true, ohneErstattungsAufgabe: true, auchAbgeschlossen: true,
  }, wer).catch((e) => ({ ok: false as const, status: 500, error: e instanceof Error ? e.message : String(e) }));
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  if (!storno.ok) {
    if (fall.teil2Fall === "nicht berechnet" || fall.teil2Fall === "schon storniert") {
      // Nichts Unumkehrbares geschehen — zurück auf den alten Stand.
      await zuruecksetzen();
      if (teil2) await sqlPool`UPDATE fiaon_global_angebot_teile SET entfallen_am = NULL, entfallen_grund = NULL WHERE id = ${teil2.id}`;
      return nein(`Der Storno-Weg lehnte ab: ${storno.error}`, storno.status ?? 409);
    }
    // Teil 2 ist schon storniert — kein Zurücksetzen, sondern Justin Bescheid geben.
    await auftragFuerKunden({
      personId: b1?.person_id != null ? Number(b1.person_id) : null, ref: ref1,
      titel: `Garantiefall halb ausgeführt — Teil 1 bitte von Hand stornieren (${angebotKundeName(d.kunde)})`,
      text: `Teil 2 (${ref2}) ist storniert, der Storno von Teil 1 (${ref1}) lehnte ab: ${storno.error}. Bitte Teil 1 im Reiter „Global-Aufträge“ mit Erstattung stornieren; zu erstatten sind insgesamt ${angebotEur(fall.summeCents)} bis ${angebotTag(bis)}.`,
      dringend: true, anBetreiber: true, schluessel: `global:${ref1}:garantiefall-halb`, bereich: "konten", quelle: "global", autorName: wer,
      link: "/chef/s/global-auftraege?reiter=angebote",
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Aufgabe halber Garantiefall:`, e));
  }
  // ── EINE Aufgabe an Justin mit der Summe ──
  const posten = [`Teil 1 ${angebotEur(teil1Cents)} (Zweck ${b1?.payment_reference ?? "—"}${b1?.invoice_number ? `, Rechnung ${b1.invoice_number}` : ""})`];
  if (fall.teil2Fall === "bezahlt → erstattet") posten.push(`Teil 2 ${angebotEur(teil2Cents)} (Zweck ${b2?.payment_reference ?? "—"}${b2?.invoice_number ? `, Rechnung ${b2.invoice_number}` : ""})`);
  await auftragFuerKunden({
    personId: b1?.person_id != null ? Number(b1.person_id) : null, ref: ref1,
    titel: `Erstattung veranlassen (Garantie): ${angebotEur(fall.summeCents)} an ${angebotKundeName(d.kunde)}`,
    text: [
      `GARANTIE (Ziffer 3 Absatz 1 und Ziffer 6 des Individualangebots ${d.ref}): Das Garantieziel (${angebotGarantieziel(d.parameter)}) ist bis zum Fristende ${angebotTag(fristEnde)} nicht vollständig erreicht.`,
      `Zu erstatten: alles Gezahlte, ${angebotEur(fall.summeCents)} — ${posten.join(" + ")} — vollständig und ohne Abzug binnen ${zahlwort(d.parameter.erstattungTage)} Tagen nach Fristende, also bis spätestens ${angebotTag(bis)}, auf das Konto, von dem gezahlt wurde.`,
      fall.teil2Fall === "offen → storniert" ? `Die offene Rechnung über Teil 2 (${ref2}) ist storniert — der Kunde muss sie nicht zahlen.` : fall.teil2Fall === "nicht berechnet" ? "Teil 2 war noch nicht berechnet und entfällt." : "",
      "Das System hat KEIN Geld bewegt. Gutschriften zu den Rechnungen bitte mit der Buchhaltung klären. Danach im Reiter „Individualangebote“ „Erstattung überwiesen“ eintragen.",
    ].filter(Boolean).join("\n"),
    dringend: true, anBetreiber: true, faelligAm: bis, schluessel: `global:${ref1}:erstattung`, bereich: "konten", quelle: "global", autorName: wer,
    link: "/chef/s/global-auftraege?reiter=angebote",
  }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Erstattungsaufgabe:`, e));
  await verlaufAngebot(id, wer, `Garantiefall vorgemerkt — ${angebotEur(fall.summeCents)} bis ${angebotTag(bis)} zu erstatten; Teil 2 ${fall.teil2Fall}`);
  let meldung = `Garantiefall vorgemerkt: ${angebotEur(fall.summeCents)} bis ${angebotTag(bis)} zu erstatten (Teil 2: ${fall.teil2Fall}). Justin hat die dringende Aufgabe „Erstattung veranlassen“ — überwiesen wird von Hand.`;
  const akte1 = await globalAkteLesen(ref1);
  if (akte1) {
    const z2 = (await angebotLesen({ id }))!;
    const teil2Satz = fall.teil2Fall === "bezahlt → erstattet" ? `Auch Ihre Zahlung für Teil 2 über ${angebotEur(teil2Cents)} erstatten wir.`
      : fall.teil2Fall === "offen → storniert" ? "Die offene Rechnung über Teil 2 ist storniert — Sie müssen sie nicht bezahlen."
      : "Teil 2 entfällt.";
    const mail = await globalMailSenden("global_angebot_erstattung", akte1, b1, { zusatz: angebotMailZusatz(z2, d, { erstattung_bis_text: angebotTag(bis), erstattung_betrag_text: angebotEur(fall.summeCents), teil2_satz_text: teil2Satz }), ausgeloestVon: wer });
    meldung += mail.ok ? " Der Kunde ist per Mail informiert." : ` Die Mail an den Kunden ging NICHT raus (${mail.grund}) — bitte schriftlich mitteilen.`;
  }
  if (!storno.ok) meldung += ` ACHTUNG: Teil 1 ließ sich nicht stornieren (${storno.error}) — Justin hat die Aufgabe „Garantiefall halb ausgeführt“.`;
  return { ok: true, meldung };
}

export async function angebotErstattungUeberwiesen(id: number, ein: any, wer: string): Promise<Ergebnis> {
  const z = await angebotLesen({ id });
  if (!z) return nein("Dieses Angebot gibt es nicht.", 404);
  if (!z.erstattung_ausgeloest_am) return nein("Zuerst den Garantiefall vormerken.", 409);
  if (z.erstattet_am) return nein("Die Überweisung ist bereits eingetragen.", 409);
  const am = String(ein?.am ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(am) || am > berlinToday()) return nein("Datum der Überweisung (nicht in der Zukunft).");
  const notiz = text(ein?.notiz, 300);
  if (notiz.length < 5) return nein("Bitte die Bankreferenz oder eine kurze Notiz eintragen.");
  await sqlPool`UPDATE fiaon_global_angebote SET erstattet_am = ${am}::date, erstattung_notiz = ${notiz}, updated_at = NOW() WHERE id = ${id}`;
  await verlaufAngebot(id, wer, `Erstattung überwiesen am ${angebotTag(am)} (${notiz})`);
  if (z.auftrag_ref) await globalVerlauf(String(z.auftrag_ref), `FIAON Global: Erstattung (Garantie) ${z.erstattung_cents != null ? `von ${angebotEur(Number(z.erstattung_cents))} ` : ""}am ${angebotTag(am)} überwiesen (${wer}).`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE DER LEITUNG
// ═══════════════════════════════════════════════════════════════════════════
export async function angebotListe(opts: { betrachterAgentId?: number | null } = {}): Promise<Record<string, unknown>[]> {
  await ensureAngebotTabellen();
  const zeilen = (await sqlPool.unsafe(`SELECT ${OHNE_PDF} FROM fiaon_global_angebote ORDER BY created_at DESC LIMIT 200`)) as any[];
  // Angebot-Aufrufe (01.10.2026): Wer hat wann, wie oft und wo geöffnet — fehlt die Tabelle oder hakt es,
  // bleibt die Liste trotzdem lesbar (aufrufe: null, der Reiter sagt das ehrlich).
  const aufrufe = await import("./fiaon-global-angebot-aufrufe")
    .then((m) => m.aufrufeFuerListe(zeilen.map((z) => ({ id: Number(z.id), ref: String(z.angebot_ref) })), opts.betrachterAgentId ?? null))
    .catch((e) => { console.error("[FIAON-ANGEBOT] Aufrufe für die Liste:", e); return null; });
  const alleTeile = (await sqlPool`
    SELECT t.*, a.payment_status, a.payment_reference, a.invoice_number, a.payment_due_date, a.completed_at
      FROM fiaon_global_angebot_teile t LEFT JOIN fiaon_applications a ON a.ref = t.bestell_ref`) as any[];
  // Gegenprüfung (logik-3): Stand der Akten — nach Kündigung/Widerruf (storniert) gibt es keinen Garantiefall.
  const aktenRefs = zeilen.map((z) => z.auftrag_ref).filter(Boolean).map(String);
  const aktenStand = new Map<string, string>(aktenRefs.length
    ? ((await sqlPool`SELECT ref, status FROM fiaon_global_auftraege WHERE ref = ANY(${aktenRefs})`) as any[]).map((r) => [String(r.ref), String(r.status)])
    : []);
  // E-273 (02.10.2026): das Startgespräch je angenommenem Angebot — gebucht (wann, mit wem) oder warum nicht. Hakt das
  // Lesen, bleibt die Liste lesbar (startgespraech: null).
  const sgStaende = await import("./fiaon-global-angebot-startgespraech")
    .then((m) => m.startgespraechStaende(zeilen.filter((z) => String(z.status) === "angenommen").map((z) => Number(z.id))))
    .catch((e) => { console.error("[FIAON-ANGEBOT] Startgespräche für die Liste:", e); return new Map(); });
  const heute = berlinToday();
  // E-301: Firmenangebote bekommen ihren eigenen Eintrag (art „firma“) — Teile, Garantie, Freigaben, Knöpfe.
  const firmaIds = zeilen.filter((z) => istFirmenFassung(z.fassung)).map((z) => Number(z.id));
  const F = firmaIds.length ? await import("./fiaon-global-angebot-firma") : null;
  const firmaFreigaben = F ? await F.firmaFreigabenFuer(firmaIds) : new Map();
  return zeilen.map((z) => {
    if (F && istFirmenFassung(z.fassung)) {
      const sg = sgStaende.get(Number(z.id));
      return F.firmaListenEintrag(z, alleTeile.filter((t) => Number(t.angebot_id) === Number(z.id)), {
        fr: firmaFreigaben.get(Number(z.id)) ?? {}, heute, aufrufe: aufrufe ? aufrufe.get(Number(z.id)) ?? null : null,
        startgespraech: sg ? { stand: sg.stand, terminId: sg.gebuchtTerminId, neuGebucht: sg.neuGebucht, fehler: sg.fehler, versuche: sg.versuche, versuchAm: sg.versuchAm, mailAm: sg.mailAm, abgesagtVon: sg.abgesagtVon, terminStatus: sg.terminStatus, zeile: sg.termin ? sg.termin.zeile : null, beginn: sg.termin ? sg.termin.beginn : null } : null,
      });
    }
    const d = angebotDatenAus(z);
    const teile = alleTeile.filter((t) => Number(t.angebot_id) === Number(z.id)).sort((a, b) => Number(a.nr) - Number(b.nr));
    const t1 = teile.find((t) => Number(t.nr) === 1); const t2 = teile.find((t) => Number(t.nr) === 2);
    const status = angebotStatusAus(z, heute);
    const fehlt = angebotPflichtFehlen(d);
    const fristEnde = isoTag(z.frist_ende);
    const teil1Bezahlt = String(t1?.payment_status) === "paid";
    // Knopf-Zustand: dieselbe Prüfung wie beim Klick, mit einem Probedatum am oder vor dem Fristende
    // (ein Meilenstein VOR dem Fristende darf auch danach noch eingetragen werden).
    const probe = fristEnde && fristEnde < heute ? fristEnde : heute;
    const meil = meilensteinPruefen({ status: String(z.status), teil1Bezahlt, teil2: t2, fristEnde, heute, garantieErfuelltAm: isoTag(z.garantie_erfuellt_am) }, { art: "kapital", datum: probe, eingetragenAm: probe, beleg: "x".repeat(20) });
    const erst = erstattungPruefen({
      status: String(z.status), teil1Bezahlt, teil2: t2, fristEnde, heute, schon: !!z.erstattung_ausgeloest_am, garantieErfuelltAm: isoTag(z.garantie_erfuellt_am),
      akteStatus: z.auftrag_ref ? aktenStand.get(String(z.auftrag_ref)) ?? null : null, teil2OffenSeit: teil2OffenSeit(t2, heute),
    });
    // E-271: „Garantie erfüllt“ — dieselbe Prüfung wie beim Klick, mit dem Ziel als Probewert.
    const gar = garantiePruefen({
      status: String(z.status), teil1Bezahlt, teil2: t2, fristEnde, heute, erstattungAusgeloest: !!z.erstattung_ausgeloest_am,
      erfuelltAm: isoTag(z.garantie_erfuellt_am), ziel: { rahmenUsd: d.parameter.kapitalZielUsd, karten: d.parameter.kartenZiel },
    }, { erfuelltAm: probe < (isoTag(t2?.meilenstein_am) ?? probe) ? (isoTag(t2?.meilenstein_am) ?? probe) : probe, rahmenUsd: String(d.parameter.kapitalZielUsd), karten: String(d.parameter.kartenZiel), beleg: "x".repeat(20) });
    const fall = garantiefallRechnen({ teil1Cents: Number(t1?.betrag_cents ?? d.parameter.teil1Cents), teil2Cents: Number(t2?.betrag_cents ?? d.parameter.teil2Cents), teil2BestellRef: t2?.bestell_ref ?? null, teil2Zahlung: t2?.payment_status ?? null });
    const pb = d.pruefbericht;
    const teilAus = (t: any) => t ? ({
      nr: Number(t.nr), titel: String(t.titel), betragCents: Number(t.betrag_cents), faelligkeit: String(t.faelligkeit), zahlungszielTage: Number(t.zahlungsziel_tage),
      bestellRef: t.bestell_ref ?? null, verwendungszweck: t.payment_reference ?? null, rechnungsnummer: t.invoice_number ?? null,
      zahlungsstatus: t.payment_status ?? null, faelligAm: t.payment_due_date ? berlinToday(new Date(t.payment_due_date)) : null,
      bezahltAm: t.bezahlt_am ? new Date(t.bezahlt_am).toISOString() : (String(t.payment_status) === "paid" && t.completed_at ? new Date(t.completed_at).toISOString() : null),
      meilensteinAm: isoTag(t.meilenstein_am), meilensteinArt: t.meilenstein_art ?? null, eingetragenAm: isoTag(t.eingetragen_am),
      entfallenAm: t.entfallen_am ? new Date(t.entfallen_am).toISOString() : null, entfallenGrund: t.entfallen_grund ?? null,
      rechnungUrl: t.bestell_ref && t.payment_reference ? `/api/fiaon/admin/global/auftraege/${encodeURIComponent(String(t.bestell_ref))}/rechnung.pdf` : null,
      zahlungsseite: t.payment_reference ? `/zahlung/${t.payment_reference}?bereich=business` : null,
    }) : null;
    return {
      id: Number(z.id), ref: d.ref, status, fassung: d.fassung, personId: z.person_id ?? null,
      kunde: d.kunde, kundeName: angebotKundeName(d.kunde), parameter: d.parameter, gesamtCents: angebotGesamtCents(d.parameter),
      buergin: d.buergin, fehlt, annahmeBereit: fehlt.length === 0 && status === "offen",
      // Endabnahme 01.10.2026: Versand des Links nur mit Registernachweis der Bürgin — der Grund steht am Link.
      versandSperre: angebotVersandSperre(d.buergin),
      gueltigBis: d.gueltigBis, erstelltAm: new Date(z.created_at).toISOString(), erstelltVon: z.erstellt_von ?? null,
      link: status === "offen" || status === "angenommen" ? absoluteUrl(angebotKundenPfad(angebotTokenErzeugen(d.ref, d.gueltigBis))) : null,
      vertragUrl: `/api/fiaon/admin/global/angebote/${z.id}/vertrag.pdf`,
      pruefberichtUrl: pb ? `/api/fiaon/admin/global/angebote/${z.id}/pruefbericht.pdf` : null,
      anlage1Url: `/api/fiaon/admin/global/angebote/${z.id}/anlage1.pdf`,
      anlage1Pruefsumme: buergschaftPruefsumme(d),
      pruefbericht: pb ? { ergebnis: pruefberichtErgebnis(pb).satz, boniPunkte: pb.boni?.punkte ?? null, boniLabel: pb.boni?.label ?? null, sanktionen: !!pb.sanktionen } : null,
      angenommenAm: z.angenommen_am ? new Date(z.angenommen_am).toISOString() : null, ip: z.ip ?? null, textHash: z.text_hash ?? null,
      schalter: z.schalter ? json<AngebotSchalter>(z.schalter, { sofortBeginn: false, jahresbetreuung: false }) : null,
      auftragRef: z.auftrag_ref ?? null, officeLink: z.auftrag_ref ? globalOfficeAuftragPfad(String(z.auftrag_ref)) : null,
      fristBeginn: isoTag(z.frist_beginn), fristEnde, fristHemmungTage: Number(z.frist_hemmung_tage || 0),
      erstattungAusgeloestAm: z.erstattung_ausgeloest_am ? new Date(z.erstattung_ausgeloest_am).toISOString() : null,
      erstattetAm: isoTag(z.erstattet_am), erstattungNotiz: z.erstattung_notiz ?? null,
      // E-271: Garantie — erfüllt (mit Werten) bzw. was der Garantiefall heute erstatten würde.
      garantieErfuelltAm: isoTag(z.garantie_erfuellt_am), garantieRahmenUsd: z.garantie_rahmen_usd != null ? Number(z.garantie_rahmen_usd) : null,
      garantieKarten: z.garantie_karten != null ? Number(z.garantie_karten) : null, garantieVon: z.garantie_von ?? null,
      erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null,
      erstattungVorschau: { teil2Fall: fall.teil2Fall, summeCents: fall.summeCents },
      bestaetigungMailAm: z.bestaetigung_mail_am ? new Date(z.bestaetigung_mail_am).toISOString() : null,
      bestaetigungMailFehler: z.bestaetigung_mail_fehler ?? null, nacharbeitFehler: z.nacharbeit_fehler ?? null,
      zurueckgezogenAm: z.zurueckgezogen_am ? new Date(z.zurueckgezogen_am).toISOString() : null, zurueckgezogenGrund: z.zurueckgezogen_grund ?? null,
      teile: [teilAus(t1), teilAus(t2)].filter(Boolean),
      // Knopf-Zustand vom Server (AGENTS.md): frei oder der Grund, warum nicht.
      knoepfe: {
        meilenstein: meil.ok ? null : meil.error,
        erstattung: erst.ok ? null : erst.error,
        garantie: gar.ok ? null : gar.error,
        hemmung: fristEnde && !z.garantie_erfuellt_am && !z.erstattung_ausgeloest_am ? null : "Nur während die Frist läuft.",
        aendern: String(z.status) === "offen" ? null : "Nur solange das Angebot offen ist.",
      },
      verlauf: json<any[]>(z.verlauf, []).slice(-12),
      aufrufe: aufrufe ? aufrufe.get(Number(z.id)) ?? null : null,
      startgespraech: (() => {
        const sg = sgStaende.get(Number(z.id));
        if (!sg) return null;
        return {
          stand: sg.stand, terminId: sg.gebuchtTerminId, neuGebucht: sg.neuGebucht, fehler: sg.fehler, versuche: sg.versuche,
          versuchAm: sg.versuchAm, mailAm: sg.mailAm, abgesagtVon: sg.abgesagtVon, terminStatus: sg.terminStatus,
          zeile: sg.termin ? sg.termin.zeile : null, beginn: sg.termin ? sg.termin.beginn : null,
        };
      })(),
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF — Ablauf, Fristwarnungen, Fristende, Nachfrage Teil 2
// Schreibt Aufgaben, KEINE Kundenmail, bewegt KEIN Geld. Wiederholbar über Marken.
// Registriert in routes.ts als tageslauf("global_angebot_lauf", …, 60 Minuten).
// ═══════════════════════════════════════════════════════════════════════════
export async function globalAngebotLauf(jetzt: Date = new Date()): Promise<{ abgelaufen: number; warnungen: number; fristende: number; nachfrage: number; nachgeholt: number; startgespraeche: number; aufrufeGeloescht: number; aufrufAufgabenGeleert: number; aufrufBeitraegeGeloescht: number; firmaRechnungen: number }> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS tabelle`) as any[];
  if (!t?.tabelle) return { abgelaufen: 0, warnungen: 0, fristende: 0, nachfrage: 0, nachgeholt: 0, startgespraeche: 0, aufrufeGeloescht: 0, aufrufAufgabenGeleert: 0, aufrufBeitraegeGeloescht: 0, firmaRechnungen: 0 };
  const heute = berlinToday(jetzt);
  const abgelaufen = (await sqlPool`UPDATE fiaon_global_angebote SET status = 'abgelaufen', updated_at = NOW() WHERE status = 'offen' AND gueltig_bis < ${heute}::date RETURNING id`) as any[];
  const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
  // Gegenprüfung 01.10.2026: Hängt nach einer Annahme die Bestellung oder Rechnung, holt der Stundenlauf nach —
  // derselbe wiederholbare Weg wie der Chef-Knopf „Nachholen" und der erneute Aufruf des Kundenlinks.
  let nachgeholt = 0;
  const haengend = (await sqlPool`
    SELECT id, angebot_ref FROM fiaon_global_angebote
     WHERE status = 'angenommen' AND (nacharbeit_fehler IS NOT NULL OR auftrag_ref IS NULL) LIMIT 20`) as any[];
  for (const h of haengend) {
    const erg = await angebotFertigstellen(Number(h.id)).catch((e) => ({ ok: false, grund: String(e) }));
    if (!erg.ok) continue;
    await angebotNacharbeit(Number(h.id)).catch((e) => console.error(`[FIAON-ANGEBOT] ${h.angebot_ref}: Nacharbeit im Stundenlauf:`, e));
    nachgeholt++;
  }
  // E-273 (02.10.2026): Startgespräch nachholen — angenommen, Auftrag steht, noch kein Termin, und der letzte Versuch
  // scheiterte TECHNISCH (oder es gab keinen). „kein_platz"/„keine_person" nicht: Dafür hat Justin die Aufgabe, und ein
  // zweiter, automatischer Termin neben seinem Handtermin wäre falsch. Nur bis drei Tage nach der Annahme.
  let startgespraeche = 0;
  const geradeGebucht = new Set<number>();
  const ohneStart = (await sqlPool`
    SELECT id, angebot_ref, bestaetigung_mail_am FROM fiaon_global_angebote
     WHERE status = 'angenommen' AND auftrag_ref IS NOT NULL AND nacharbeit_fehler IS NULL AND startgespraech_termin_id IS NULL
       AND (startgespraech_fehler IS NULL OR startgespraech_fehler LIKE 'technik:%')
       AND (startgespraech_versuch_am IS NULL OR startgespraech_versuch_am < ${new Date(jetzt.getTime() - 30 * 60_000)})
       AND angenommen_am > ${new Date(jetzt.getTime() - 3 * 864e5)}
     LIMIT 10`.catch((e) => { console.error("[FIAON-ANGEBOT] Startgespräche nachholen (Migration 090?):", e); return []; })) as any[];
  for (const o of ohneStart) {
    const SG = await import("./fiaon-global-angebot-startgespraech");
    const erg = await SG.angebotStartgespraechSicherstellen(Number(o.id), { anlass: "stundenlauf" })
      .catch((e) => { console.error(`[FIAON-ANGEBOT] ${o.angebot_ref}: Startgespräch im Stundenlauf:`, e); return null; });
    if (erg?.status !== "gebucht") continue;
    startgespraeche++; geradeGebucht.add(Number(o.id));
    // Ging die Bestätigung noch gar nicht raus, nennt sie den Termin jetzt selbst (höchstens einmal, wie immer).
    if (!o.bestaetigung_mail_am) await bestaetigungSenden(Number(o.id)).catch((e) => console.error(`[FIAON-ANGEBOT] ${o.angebot_ref}: Bestätigung im Stundenlauf:`, e));
  }
  // E-273: Die eigene Mail zum Startgespräch nachholen, wenn sie scheiterte — nur für einen gebuchten, künftigen Termin,
  // nur wenn die Bestätigung schon OHNE ihn draußen ist (sonst nennt die Bestätigung ihn selbst), drei Tage lang.
  const ohneMitteilung = (await sqlPool`
    SELECT a.id, a.angebot_ref FROM fiaon_global_angebote a JOIN fiaon_termine t ON t.id = a.startgespraech_termin_id
     WHERE a.status = 'angenommen' AND a.startgespraech_mail_am IS NULL AND a.bestaetigung_mail_am IS NOT NULL
       AND t.status = 'gebucht' AND t.beginn > ${jetzt} AND a.angenommen_am > ${new Date(jetzt.getTime() - 3 * 864e5)}
     LIMIT 10`.catch(() => [])) as any[];
  for (const o of ohneMitteilung) {
    if (geradeGebucht.has(Number(o.id))) continue; // eben gebucht: die Mail hat Sicherstellen schon versucht
    await import("./fiaon-global-angebot-startgespraech").then((m) => m.startgespraechMitteilen(Number(o.id)))
      .catch((e) => console.error(`[FIAON-ANGEBOT] ${o.angebot_ref}: Mail zum Startgespräch im Stundenlauf:`, e));
  }
  const laufend = (await sqlPool`
    SELECT a.*, t2.id AS t2_id, b2.payment_status AS t2_zahlung, b2.payment_due_date AS t2_faellig FROM fiaon_global_angebote a
      JOIN fiaon_global_angebot_teile t2 ON t2.angebot_id = a.id AND t2.nr = 2
      LEFT JOIN fiaon_applications b2 ON b2.ref = t2.bestell_ref
      LEFT JOIN fiaon_global_auftraege g ON g.ref = a.auftrag_ref
     WHERE a.status = 'angenommen' AND a.frist_ende IS NOT NULL AND a.erstattung_ausgeloest_am IS NULL
       AND a.garantie_erfuellt_am IS NULL AND (g.status IS NULL OR g.status <> 'storniert')
       AND a.fassung NOT LIKE 'IA-FIRMA-%'
     LIMIT 100`) as any[];
  // E-271: Die Frist wird bis zur erfüllten Garantie überwacht — auch nach dem Meilenstein (erstes Kapital/erste Karte).
  let warnungen = 0; let fristende = 0;
  for (const z of laufend) {
    const ende = isoTag(z.frist_ende)!; const d = angebotDatenAus(z); const ref1 = String(z.auftrag_ref);
    const tageBis = Math.round((new Date(`${ende}T12:00:00Z`).getTime() - new Date(`${heute}T12:00:00Z`).getTime()) / 864e5);
    const akte = await globalAkteLesen(ref1);
    const zustaendig = akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null;
    for (const [grenze, spalte] of [[14, "frist_warnung_14_am"], [3, "frist_warnung_3_am"]] as const) {
      if (tageBis > grenze || tageBis < 0 || z[spalte]) continue;
      const [frei] = (await sqlPool.unsafe(`UPDATE fiaon_global_angebote SET ${spalte} = NOW() WHERE id = $1 AND ${spalte} IS NULL RETURNING id`, [z.id])) as any[];
      if (!frei) continue;
      const satz = `Die Frist des Individualangebots ${d.ref} endet am ${angebotTag(ende)} (noch ${tageBis} Tage). FIAON garantiert bis dahin ${angebotGarantieziel(d.parameter)} für die Gesellschaft; sonst erstattet FIAON alles Gezahlte (Teil 1 und ggf. Teil 2). Stand der Anträge prüfen: Sind Kreditrahmen und Karten vollständig da, der Leitung sagen („Garantie erfüllt“); ist erst das erste Kapital oder die erste Karte da: „Meilenstein erreicht“.`;
      for (const anBetreiber of [false, true]) {
        await auftragFuerKunden({
          personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
          titel: `Frist läuft ab am ${angebotTag(ende)} — ${angebotKundeName(d.kunde)} (Individualangebot)`,
          text: satz, dringend: grenze === 3, anBetreiber, agentId: anBetreiber ? null : zustaendig,
          schluessel: `global:${ref1}:frist-${grenze}${anBetreiber ? "-justin" : ""}`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
          link: anBetreiber ? "/chef/s/global-auftraege?reiter=angebote" : globalOfficeAuftragPfad(ref1),
        }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Fristwarnung:`, e));
      }
      warnungen++;
    }
    // Gegenprüfung (vertrag-3): Ist eine fällige Teil-2-Rechnung offen, ruht die Frist — noch kein Fristende melden.
    const verzug = teil2OffenSeit({ payment_status: z.t2_zahlung, payment_due_date: z.t2_faellig }, heute);
    if (tageBis < 0 && !z.frist_abgelaufen_am && !verzug) {
      const [frei] = (await sqlPool`UPDATE fiaon_global_angebote SET frist_abgelaufen_am = NOW() WHERE id = ${z.id} AND frist_abgelaufen_am IS NULL RETURNING id`) as any[];
      if (!frei) continue;
      const bis = plusTage(ende, d.parameter.erstattungTage);
      await auftragFuerKunden({
        personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
        titel: `Frist abgelaufen — Garantie prüfen, Erstattung bis ${angebotTag(bis)} auslösen (${angebotKundeName(d.kunde)})`,
        text: `Die Frist des Individualangebots ${d.ref} endete am ${angebotTag(ende)}, ohne dass „Garantie erfüllt“ eingetragen ist. Lagen ${angebotGarantieziel(d.parameter)} vor dem Fristende vollständig vor: „Garantie erfüllt“ mit Datum und Belegen eintragen. Sonst: „Garantiefall: Erstattung vormerken“ (alles Gezahlte zurück — Teil 1 und ein bezahlter Teil 2; eine offene Teil-2-Rechnung wird storniert; Mail an den Kunden) und bis ${angebotTag(bis)} überweisen.`,
        dringend: true, anBetreiber: true, faelligAm: heute, schluessel: `global:${ref1}:fristende`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
        link: "/chef/s/global-auftraege?reiter=angebote",
      }).catch((e) => console.error(`[FIAON-ANGEBOT] ${d.ref}: Fristende:`, e));
      fristende++;
    }
  }
  // Ruhige Nachfrage zu Teil 2: drei Tage nach Fälligkeit eine Aufgabe „anrufen" — keine Mahnmail.
  const offen2 = (await sqlPool`
    SELECT t.id, t.bestell_ref, a.angebot_ref, a.person_id, a.auftrag_ref, a.kunde, b.payment_due_date, b.payment_reference
      FROM fiaon_global_angebot_teile t JOIN fiaon_global_angebote a ON a.id = t.angebot_id
      JOIN fiaon_applications b ON b.ref = t.bestell_ref
     WHERE t.nr = 2 AND t.anruf_aufgabe_am IS NULL AND b.payment_status IN ('pending_payment', 'claimed_paid')
       AND a.fassung NOT LIKE 'IA-FIRMA-%'
       -- E-271: Nach vorgemerktem Garantiefall nicht mehr nachfragen (die Rechnung ist dann storniert). Solange sie offen ist,
       -- ruht die Frist (Ziffer 6 Abs. 3) — die ruhige Nachfrage bleibt richtig.
       AND a.erstattung_ausgeloest_am IS NULL
       AND b.payment_due_date IS NOT NULL AND b.payment_due_date < ${new Date(jetzt.getTime() - 3 * 864e5)}
     LIMIT 50`) as any[];
  let nachfrage = 0;
  for (const z of offen2) {
    const [frei] = (await sqlPool`UPDATE fiaon_global_angebot_teile SET anruf_aufgabe_am = NOW() WHERE id = ${z.id} AND anruf_aufgabe_am IS NULL RETURNING id`) as any[];
    if (!frei) continue;
    const ref1 = String(z.auftrag_ref);
    const akte = await globalAkteLesen(ref1);
    await auftragFuerKunden({
      personId: z.person_id != null ? Number(z.person_id) : null, ref: ref1,
      titel: `Teil 2 offen — bitte anrufen (${angebotKundeName(json<AngebotKunde>(z.kunde, {} as AngebotKunde))})`,
      text: `Die Rechnung über Teil 2 (Verwendungszweck ${z.payment_reference}) war am ${angebotTag(berlinToday(new Date(z.payment_due_date)))} fällig und ist nicht gebucht. Bitte ruhig nachfragen — keine Mahnung, kein Druck.`,
      schluessel: `global:${ref1}:teil2-anruf`, bereich: "konten", quelle: "global", autorName: "FIAON Global",
      agentId: akte?.zustaendig_agent_id ? Number(akte.zustaendig_agent_id) : null, link: globalOfficeAuftragPfad(ref1),
    }).catch((e) => console.error(`[FIAON-ANGEBOT] ${z.angebot_ref}: Nachfrage Teil 2:`, e));
    nachfrage++;
  }
  // Angebot-Aufrufe (01.10.2026): Speicherdauer — 90 Tage nach Annahme, Rückzug bzw. Ende der Gültigkeit;
  // Chef-Anschlüsse nach 30 Tagen. Gegenprüfung (F1): dieselbe Frist leert die Kopien in Justins Aufgabe.
  // Ein Fehler hier hält den Lauf nicht an.
  const aufraeumen = await import("./fiaon-global-angebot-aufrufe").then((m) => m.aufrufeAufraeumen())
    .catch((e) => { console.error("[FIAON-ANGEBOT] Aufrufe aufräumen:", e); return { aufrufe: 0, anschluesse: 0, aufgaben: 0, beitraege: 0 }; });
  // E-301: Firmenangebote — Monatsrechnung am Fälligkeitstag (Berlin), Verlängerung, Fristende der Garantie. Ein Fehler dort hält den Lauf nicht an.
  const firma = await import("./fiaon-global-angebot-firma").then((m) => m.firmaStundenlauf(jetzt))
    .catch((e) => { console.error("[FIAON-ANGEBOT] Stundenlauf Firmenangebote:", e); return { rechnungen: 0 }; });
  return {
    abgelaufen: abgelaufen.length, warnungen, fristende, nachfrage, nachgeholt, startgespraeche,
    aufrufeGeloescht: aufraeumen.aufrufe, aufrufAufgabenGeleert: aufraeumen.aufgaben, aufrufBeitraegeGeloescht: aufraeumen.beitraege,
    firmaRechnungen: firma.rechnungen,
  };
}

/** Die Sicht für „Mein Auftrag" und das Office: Teile, Frist, Bürgin — nur lesen. */
export async function angebotSichtZurAkte(ref1: string): Promise<Record<string, unknown> | null> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebote') AS tabelle`.catch(() => [])) as any[];
  if (!t?.tabelle) return null;
  const [a] = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE auftrag_ref = ${ref1} LIMIT 1`) as any[];
  if (!a) return null;
  const z = (await angebotLesen({ id: Number(a.id) }))!;
  if (istFirmenFassung(z.fassung)) { const F = await import("./fiaon-global-angebot-firma"); return F.firmaSichtZurAkte(z); }
  const d = angebotDatenAus(z);
  const teile = await Promise.all((z.teile as any[]).map(async (x) => {
    const b = x.bestell_ref ? await globalBestellungLesen(String(x.bestell_ref)) : null;
    const stand = z.erstattung_ausgeloest_am && x.bezahlt_am ? "erstattet" : x.entfallen_am ? "entfallen" : b ? (String(b.payment_status) === "paid" ? "bezahlt" : ["cancelled", "superseded", "refunded"].includes(String(b.payment_status)) ? "storniert" : "offen") : "noch nicht fällig";
    return { nr: Number(x.nr), titel: String(x.titel), betragCents: Number(x.betrag_cents), stand, rechnungsnummer: b?.invoice_number ?? null, bestellRef: x.bestell_ref ?? null };
  }));
  return {
    ref: d.ref, teile, fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), buergin: d.buergin.name,
    erstattungAusgeloest: !!z.erstattung_ausgeloest_am, teil2Bedingung: "erst nach Eintragung der Gesellschaft und dem ersten Kapital oder der ersten Karte",
    // E-271: Garantie — Ziel, erfüllt am, Erstattungsbetrag im Garantiefall.
    garantieZiel: angebotGarantieziel(d.parameter), garantieErfuelltAm: isoTag(z.garantie_erfuellt_am),
    erstattungCents: z.erstattung_cents != null ? Number(z.erstattung_cents) : null,
    // E-273 (02.10.2026): „Ihr Startgespräch" — Tag, Uhrzeit, mit wem, Kalender, Verschieben (oder der Satz, warum nicht).
    startgespraech: await import("./fiaon-global-angebot-startgespraech")
      .then(async (m) => m.startgespraechFuerKunde(await m.startgespraechStand(Number(z.id))))
      .catch(() => null),
  };
}

/** Für den Prüfstand: die Vertragsdaten eines Angebots (ohne Datenbankzugriff von außen nötig). */
export { angebotVertragTitel, angebotVertragUnterzeile, BUERGIN_FELDER };
