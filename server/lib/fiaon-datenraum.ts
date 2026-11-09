// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DATENBANK, ABLAUF, MAILS (E-489, 09.11.2026)
//
// Justin: „Wenn er eintritt, muss er alle Infos für die NDA angeben, dann diese
// direkt unterzeichnen und dann soll er direkt Zugriff haben. Stelle ihm alles
// hoch, gut geordnet zu jedem Projekt mit allen Details und Inhalten."
//
// ── DER WEG DES GASTES ────────────────────────────────────────────────────
//   1. Persönlicher Link mit Einladungscode (/datenraum/zugang#c=…) oder Code
//      eintippen → signiertes Sitzungs-Plätzchen (fiaon_dr, nur /api/fiaon/datenraum).
//   2. Angaben für die Vereinbarung (vorbefüllt, änderbar, Pflichtfelder geprüft).
//      Eine andere E-Mail als die der Einladung bestätigt der Gast mit einem Code.
//   3. Vereinbarung lesen (seine Angaben als Partei 3, die Projekte des Raums als
//      Themen in § 1) → Häkchen → zeichnen + vollen Namen tippen → unterzeichnen.
//      Gespeichert: Bild, Name, Zeitpunkt, IP (+ rohe Kette), Browser, Fassung,
//      Wortlaut und seine Prüfsumme, Zustimmung, wann angezeigt, Zugang, das PDF.
//      Die FIAON-Seite nimmt mit der Freischaltung an.
//   4. Sofort Zugriff: Projekte als Ordner, Dokumente ansehen/herunterladen —
//      jede PDF-Seite mit „Vertraulich · Name · Datum · DR-Vorgang“, jede
//      Auslieferung VORHER im Protokoll (Kette aus Prüfsummen).
//   5. Mails: Kopie der Vereinbarung an den Gast, Meldung an Justin (mit PDF),
//      eine gebündelte Meldung je Gast und Tag beim ersten Öffnen eines Dokuments.
//
// ── WAS BEWUSST SO IST ────────────────────────────────────────────────────
//   · Eigene Tabellen (fiaon_dr_*), eigene Sitzung — mit keinem anderen
//     Datenraum des Hauses verbunden.
//   · Inhalte (Namen, Projekte, Dokumente) nur in der Datenbank — das Repo ist öffentlich.
//   · Codes nur als HMAC-Prüfsumme; Fehlversuche bremst das Protokoll je Anschluss
//     (IP des Gastes hinter Cloudflare), über Instanzen hinweg. Sehr viele falsche
//     Codes insgesamt sperren niemanden, sondern melden sich bei Justin (Alarm).
//   · Keine Hard-Deletes: entfernt_am, gesperrt_am, archiviert_am.
//   · Eine Vereinbarung deckt ein Projekt nur in der Fassung, die sie in § 1 nennt
//     (Prüfsumme aus Buchstabe, Titel, §-1-Text, geschützter Gesellschaft). Kommt
//     ein Thema mit Unterlagen dazu oder ändert sich eines, bestätigt der Gast die
//     ergänzte Fassung (Nachtrag) — mit seinen festgeschriebenen Angaben.
//   · Nach der ersten Unterschrift sind die Angaben des Gastes fest (Änderungen per
//     E-Mail an Justin). Der Vermerk trägt den Namen der ersten Vereinbarung.
//   · Bevor ein Gast eine Vereinbarung sieht, gibt die Verwaltung den Wortlaut des
//     Raums frei („Vereinbarung ansehen“ → „Freigeben“). Ändern sich Zusätze oder
//     Projekte, gilt die Freigabe nicht mehr — kein Gast unterschreibt Ungeprüftes.
//   · Jede schreibende Funktion nimmt `lauf` (Muster AGENTS.md). Schema IMMER vor
//     einer eigenen Transaktion anlegen (drSchema).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { berlinToday } from "./fiaon-time";
import {
  NDA_FASSUNG, NDA_FIAON, NDA_TITEL, DR_FELD_TEXT, DR_ZUSTIMMUNG, drBriefAnrede, drGastAngabenPruefen, drNamePasst, drNdaBloecke,
  drNdaKanonisch, drCodeNormal, drCodeForm, drSeiteName, drVollName, drVorbefuellungPruefen, drBuchstabe, drPartei3Rolle, drProjektKanon,
  drWeitergabeListe, drCodeAnzeige,
  type DrGastAngaben, type DrNdaBlock, type DrNdaEingabe, type DrNdaProjekt, type DrNdaRaum,
} from "@shared/fiaon-datenraum-nda";
import { zeile, mehrzeilig } from "@shared/fiaon-partner-crm";
import {
  drCodeErzeugen, drCodeHash, drDateiTyp, drDateiname, drKennung, drPngAusDataUrl, drPngTintePruefen, drSha256, drGleich,
  drZugriff, drBerlinZeitLang, drVermerkText, drDateiArtVonMime, drEmailCodeErzeugen, drEmailCodeHash, drVorgang, drWarteschlange,
  type DrZugriff,
} from "./fiaon-datenraum-regeln";
import { drPdfPruefen, drPdfVermerken, drVersiegeln, ndaPdfErzeugen } from "./fiaon-datenraum-pdf";

type Lauf = any;
type Erg<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string; fehler?: Record<string, string>; code?: string };
const nein = (status: number, error: string, extra: { fehler?: Record<string, string>; code?: string } = {}) => ({ ok: false as const, status, error, ...extra });
const zahl = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const zeit = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object" && !Buffer.isBuffer(v)) return v as T;
  try { const x = JSON.parse(String(v ?? "")); return (typeof x === "string" ? JSON.parse(x) : x) ?? leer; } catch { return leer; }
}
const jsonText = (v: unknown) => JSON.stringify(v ?? {});
const idListe = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);
const pgArray = (ids: number[]) => `{${ids.filter((n) => Number.isInteger(n) && n > 0).join(",")}}`;

/** Wer fragt an — IP des Gastes (hinter Cloudflare), Schlüssel der Bremse, rohe Kette, Browser. */
export interface DrKontext { ip: string; ua: string; anschluss?: string; kette?: string }

// ── Prüfstand: Mail und Gmail-Entwurf austauschbar (nie in der Produktion gesetzt) ──
export type DrSender = (m: {
  an: string; betreff: string; text: string; anrede?: string | null; absender: "global" | "team" | "legal";
  antwortAn?: { email: string; name?: string }; anhaenge?: { name: string; inhalt: Buffer }[]; baustein?: Record<string, unknown>;
}) => Promise<{ ok: boolean; messageId: string | null; grund?: string }>;
export type DrEntwurf = (m: { vonName: string; an: string; betreff: string; text: string; html: string }) => Promise<string>;
let senderErsatz: DrSender | null = null;
let entwurfErsatz: DrEntwurf | null = null;
/** Nur für scripts/pruef-datenraum.ts: Mails und Gmail-Entwürfe gehen an eine Attrappe. */
export function drPruefHaken(h: { sender?: DrSender | null; entwurf?: DrEntwurf | null }): void {
  if (h.sender !== undefined) senderErsatz = h.sender;
  if (h.entwurf !== undefined) entwurfErsatz = h.entwurf;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA — nur anlegen, was fehlt (die DDL-Wache in db-pool.ts prüft vorher im Katalog)
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
export function drSchema(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_raeume (
          id BIGSERIAL PRIMARY KEY,
          titel TEXT NOT NULL,
          partner_firma_id INTEGER,
          nda_angaben JSONB NOT NULL DEFAULT '{}'::jsonb,
          nda_freigabe JSONB,
          erstellt_von TEXT,
          archiviert_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_dr_raeume ADD COLUMN IF NOT EXISTS nda_freigabe JSONB`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_raeume_partner ON fiaon_dr_raeume (partner_firma_id)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_projekte (
          id BIGSERIAL PRIMARY KEY,
          raum_id BIGINT NOT NULL REFERENCES fiaon_dr_raeume(id),
          buchstabe TEXT NOT NULL,
          schluessel TEXT NOT NULL,
          titel TEXT NOT NULL,
          beschreibung TEXT,
          nda_text TEXT,
          geschuetzt TEXT,
          entfernt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dr_projekte_schluessel ON fiaon_dr_projekte (raum_id, lower(schluessel)) WHERE entfernt_am IS NULL`;
      // Raumtour: die Bühne je Projekt (Schema shared/fiaon-datenraum-buehne.ts, Logik fiaon-datenraum-tour.ts).
      await sqlPool`ALTER TABLE fiaon_dr_projekte ADD COLUMN IF NOT EXISTS buehne JSONB`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_dokumente (
          id BIGSERIAL PRIMARY KEY,
          kennung TEXT NOT NULL UNIQUE,
          raum_id BIGINT NOT NULL REFERENCES fiaon_dr_raeume(id),
          projekt_id BIGINT NOT NULL REFERENCES fiaon_dr_projekte(id),
          nr INTEGER NOT NULL DEFAULT 0,
          titel TEXT NOT NULL,
          beschreibung TEXT,
          dateiname TEXT NOT NULL,
          quelle TEXT,
          mime TEXT NOT NULL,
          groesse INTEGER NOT NULL,
          sha256 VARCHAR(64) NOT NULL,
          inhalt BYTEA NOT NULL,
          seiten INTEGER,
          vermerk_moeglich BOOLEAN,
          vermerk_grund TEXT,
          sichtbar BOOLEAN NOT NULL DEFAULT TRUE,
          hochgeladen_von TEXT,
          ersetzt_durch BIGINT,
          entfernt_am TIMESTAMPTZ,
          entfernt_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dr_dokumente_inhalt ON fiaon_dr_dokumente (projekt_id, sha256) WHERE entfernt_am IS NULL`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_dokumente_raum ON fiaon_dr_dokumente (raum_id) WHERE entfernt_am IS NULL`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_gaeste (
          id BIGSERIAL PRIMARY KEY,
          raum_id BIGINT NOT NULL REFERENCES fiaon_dr_raeume(id),
          code_hash VARCHAR(64) NOT NULL UNIQUE,
          code_hinweis TEXT,
          anrede TEXT NOT NULL DEFAULT '',
          vorname TEXT NOT NULL DEFAULT '',
          nachname TEXT NOT NULL DEFAULT '',
          firma TEXT NOT NULL DEFAULT '',
          funktion TEXT NOT NULL DEFAULT '',
          strasse TEXT NOT NULL DEFAULT '',
          plz TEXT NOT NULL DEFAULT '',
          ort TEXT NOT NULL DEFAULT '',
          land TEXT NOT NULL DEFAULT '',
          email TEXT NOT NULL,
          telefon TEXT NOT NULL DEFAULT '',
          weitergabe TEXT NOT NULL DEFAULT '',
          einladung JSONB NOT NULL DEFAULT '{}'::jsonb,
          einladung_email TEXT NOT NULL DEFAULT '',
          email_bestaetigt TEXT,
          email_bestaetigt_am TIMESTAMPTZ,
          email_code_hash VARCHAR(64),
          email_code_fuer TEXT,
          email_code_bis TIMESTAMPTZ,
          email_code_versuche INTEGER NOT NULL DEFAULT 0,
          nda_angezeigt JSONB,
          aufgabe_id INTEGER,
          angaben_am TIMESTAMPTZ,
          sitzung_version INTEGER NOT NULL DEFAULT 1,
          gesperrt_am TIMESTAMPTZ,
          gesperrt_von TEXT,
          gesperrt_grund TEXT,
          eingeladen_von TEXT,
          code_erneuert_am TIMESTAMPTZ,
          zuletzt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS weitergabe TEXT NOT NULL DEFAULT ''`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS einladung JSONB NOT NULL DEFAULT '{}'::jsonb`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS einladung_email TEXT NOT NULL DEFAULT ''`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_bestaetigt TEXT`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_bestaetigt_am TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_code_hash VARCHAR(64)`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_code_fuer TEXT`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_code_bis TIMESTAMPTZ`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS email_code_versuche INTEGER NOT NULL DEFAULT 0`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS nda_angezeigt JSONB`;
      await sqlPool`ALTER TABLE fiaon_dr_gaeste ADD COLUMN IF NOT EXISTS aufgabe_id INTEGER`;
      // Eindeutig ist die E-Mail der EINLADUNG (nicht die, die der Gast einträgt): Ändert er seine Adresse, verrät keine
      // Fehlermeldung, wer sonst im Raum eingeladen ist.
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dr_gaeste_einladung ON fiaon_dr_gaeste (raum_id, lower(einladung_email)) WHERE einladung_email <> ''`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_nda (
          id BIGSERIAL PRIMARY KEY,
          gast_id BIGINT NOT NULL REFERENCES fiaon_dr_gaeste(id),
          raum_id BIGINT NOT NULL REFERENCES fiaon_dr_raeume(id),
          fassung TEXT NOT NULL,
          text_hash VARCHAR(64) NOT NULL,
          text_kanonisch TEXT,
          angaben JSONB NOT NULL,
          projekt_ids BIGINT[] NOT NULL,
          projekt_hashes JSONB NOT NULL DEFAULT '{}'::jsonb,
          zustimmung_text TEXT,
          nda_angezeigt_am TIMESTAMPTZ,
          unterschrift_png BYTEA NOT NULL,
          unterschrift_name TEXT NOT NULL,
          unterzeichnet_am TIMESTAMPTZ NOT NULL,
          angenommen_am TIMESTAMPTZ NOT NULL,
          ip TEXT,
          ip_kette TEXT,
          user_agent TEXT,
          code_hinweis TEXT,
          sitzung_version INTEGER,
          email TEXT,
          email_herkunft TEXT,
          pdf BYTEA NOT NULL,
          pdf_sha256 VARCHAR(64) NOT NULL,
          siegel TEXT,
          pdf_siegel BYTEA,
          siegel_am TIMESTAMPTZ,
          mail_gast_am TIMESTAMPTZ,
          mail_gast_fehler TEXT,
          mail_gast_versuche INTEGER NOT NULL DEFAULT 0,
          mail_justin_am TIMESTAMPTZ,
          mail_justin_fehler TEXT,
          mail_justin_versuche INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      for (const s of [
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS text_kanonisch TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS projekt_hashes JSONB NOT NULL DEFAULT '{}'::jsonb`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS zustimmung_text TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS nda_angezeigt_am TIMESTAMPTZ`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS ip_kette TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS code_hinweis TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS sitzung_version INTEGER`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS email TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS email_herkunft TEXT`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS pdf_siegel BYTEA`,
        sqlPool`ALTER TABLE fiaon_dr_nda ADD COLUMN IF NOT EXISTS siegel_am TIMESTAMPTZ`,
      ]) await s;
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dr_nda_einmal ON fiaon_dr_nda (gast_id, text_hash)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_nda_gast ON fiaon_dr_nda (gast_id, unterzeichnet_am DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_protokoll (
          id BIGSERIAL PRIMARY KEY,
          raum_id BIGINT,
          gast_id BIGINT,
          dokument_id BIGINT,
          art TEXT NOT NULL,
          detail TEXT,
          wer TEXT,
          ip TEXT,
          ua TEXT,
          anschluss TEXT,
          kette VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`ALTER TABLE fiaon_dr_protokoll ADD COLUMN IF NOT EXISTS anschluss TEXT`;
      await sqlPool`ALTER TABLE fiaon_dr_protokoll ADD COLUMN IF NOT EXISTS kette VARCHAR(64)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_protokoll_anschluss ON fiaon_dr_protokoll (art, anschluss, created_at DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_protokoll_raum ON fiaon_dr_protokoll (raum_id, id DESC)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_protokoll_gast ON fiaon_dr_protokoll (gast_id, created_at DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_tagesmeldung (
          id BIGSERIAL PRIMARY KEY,
          gast_id BIGINT NOT NULL REFERENCES fiaon_dr_gaeste(id),
          tag DATE NOT NULL,
          angelegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          gesendet_am TIMESTAMPTZ,
          versuche INTEGER NOT NULL DEFAULT 0,
          fehler TEXT,
          UNIQUE (gast_id, tag)
        )`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTOKOLL — mit Kette aus Prüfsummen (jede Zeile trägt die Summe der vorigen)
// ═══════════════════════════════════════════════════════════════════════════
export const DR_PROTOKOLL_TEXT: Record<string, string> = {
  code_falsch: "Falscher Code", gebremst: "Zu viele Versuche — gebremst", eingetreten: "Eingetreten", gesperrt_versuch: "Gesperrt — abgewiesen",
  angaben: "Angaben gespeichert", angaben_abgewiesen: "Angaben nach der Unterschrift abgewiesen", email_code: "Bestätigungscode an neue E-Mail",
  email_code_falsch: "Bestätigungscode falsch", email_bestaetigt: "Neue E-Mail bestätigt",
  nda_gelesen: "Vereinbarung angezeigt", nda_entwurf: "Vereinbarung als Entwurf (PDF) geöffnet", nda_abgewiesen: "Unterschrift abgewiesen",
  gebremst_unterschrift: "Zu viele Unterschriftsversuche — gebremst", nda_unterzeichnet: "Vereinbarung unterzeichnet",
  nda_pdf: "Eigenes Exemplar geladen", dokument_angesehen: "Ausgeliefert (Ansicht)", dokument_geladen: "Ausgeliefert (Download)",
  gebremst_dokument: "Zu viele Abrufe — gebremst", zugriff_verweigert: "Zugriff verweigert",
  ohne_vermerk: "Ohne Vermerk ausgeliefert", abgemeldet: "Abgemeldet", mail_gast: "Mail an den Gast", mail_justin: "Meldung an Justin",
  tagesmeldung: "Tagesmeldung an Justin", alarm_bremse: "Alarm an Justin: viele falsche Codes", raum_angelegt: "Raum angelegt", raum_geaendert: "Raum geändert",
  projekt_gespeichert: "Projekt gespeichert", projekt_entfernt: "Projekt entfernt", nda_freigegeben: "Vereinbarung freigegeben",
  chef_vorschau: "Vorschau der Vereinbarung geöffnet", gast_eingeladen: "Gast eingeladen", einladung_entwurf: "Einladung als Entwurf in js@",
  code_erneuert: "Code erneuert", gast_gesperrt: "Gast gesperrt", gast_entsperrt: "Gast entsperrt", dokument_hochgeladen: "Dokument hochgeladen",
  dokument_ersetzt: "Dokument ersetzt", dokument_geaendert: "Dokument geändert", dokument_entfernt: "Dokument entfernt",
  dokument_sichtbar: "Sichtbar geschaltet", dokument_unsichtbar: "Unsichtbar geschaltet", chef_angesehen: "Original im Chefbüro geöffnet",
  chef_nda: "NDA im Chefbüro geöffnet", protokoll_export: "Protokoll exportiert", nachgesiegelt: "Nachträglich versiegelt",
};
const KETTE_SCHLOSS = 489_489_001;
const KETTE_START = "fiaon-dr-protokoll.v1";
type ProtokollEintrag = { raumId?: number | null; gastId?: number | null; dokumentId?: number | null; art: string; detail?: string | null; wer?: string | null };
const idOderNull = (v: unknown) => (v == null || v === "" ? null : Number(v));
/** Ein Glied der Kette: Prüfsumme über die vorige Summe und die Felder der Zeile, genau wie gespeichert. */
function ketteGlied(vorher: string, z: { am: string; raumId: unknown; gastId: unknown; dokumentId: unknown; art: string; detail: string | null; wer: string | null; ip: string | null; ua: string | null }): string {
  return drSha256(`${vorher}|${JSON.stringify([z.am, idOderNull(z.raumId), idOderNull(z.gastId), idOderNull(z.dokumentId), z.art, z.detail ?? null, z.wer ?? null, z.ip ?? null, z.ua ?? null])}`);
}
async function protokollEinfuegen(e: ProtokollEintrag, ctx: DrKontext | null, tx: Lauf): Promise<number> {
  // Eine Sperre für die ganze Kette, bis die eigene Transaktion endet — zwei Zeilen hängen nie an derselben Vorgängerin.
  await tx`SELECT pg_advisory_xact_lock(${KETTE_SCHLOSS})`;
  const [v] = (await tx`SELECT kette FROM fiaon_dr_protokoll WHERE kette IS NOT NULL ORDER BY id DESC LIMIT 1`) as any[];
  const z = {
    am: new Date().toISOString(), raumId: e.raumId ?? null, gastId: e.gastId ?? null, dokumentId: e.dokumentId ?? null, art: e.art,
    detail: e.detail ? String(e.detail).slice(0, 500) : null, wer: e.wer ? String(e.wer).slice(0, 120) : null,
    ip: ctx?.ip ? String(ctx.ip).slice(0, 80) : null, ua: ctx?.ua ? String(ctx.ua).slice(0, 300) : null,
  };
  const kette = ketteGlied(v?.kette ?? KETTE_START, z);
  const [r] = (await tx`
    INSERT INTO fiaon_dr_protokoll (raum_id, gast_id, dokument_id, art, detail, wer, ip, ua, anschluss, created_at, kette)
    VALUES (${z.raumId}, ${z.gastId}, ${z.dokumentId}, ${z.art}, ${z.detail}, ${z.wer}, ${z.ip}, ${z.ua},
            ${ctx?.anschluss ? String(ctx.anschluss).slice(0, 80) : null}, ${new Date(z.am)}, ${kette})
    RETURNING id`) as any[];
  return zahl(r.id);
}
/** Protokoll, das eine Anfrage nie kippt (Fehler → Warnung, null). */
export async function drProtokoll(e: ProtokollEintrag, ctx: DrKontext | null = null, lauf: Lauf = sqlPool): Promise<number | null> {
  try { return await drProtokollPflicht(e, ctx, lauf); } catch (err) { console.warn("[DATENRAUM] Protokoll fehlgeschlagen:", err instanceof Error ? err.message : err); return null; }
}
/** Protokoll, ohne das nichts ausgeliefert wird (wirft). In einer fremden Transaktion hält die Sperre bis zu deren Ende. */
export async function drProtokollPflicht(e: ProtokollEintrag, ctx: DrKontext | null = null, lauf: Lauf = sqlPool): Promise<number> {
  if (lauf === sqlPool) return sqlPool.begin((tx: any) => protokollEinfuegen(e, ctx, tx)) as Promise<number>;
  return protokollEinfuegen(e, ctx, lauf);
}
/** Rechnet die Kette nach: Wurde eine Zeile nachträglich geändert oder entfernt, bricht sie dort. */
export async function drProtokollKette(): Promise<{ ok: boolean; zeilen: number; bruchBei: number | null }> {
  await drSchema();
  let vorher = KETTE_START; let n = 0; let abId = 0;
  for (;;) {
    const z = (await sqlPool`
      SELECT id, created_at, raum_id, gast_id, dokument_id, art, detail, wer, ip, ua, kette FROM fiaon_dr_protokoll
       WHERE kette IS NOT NULL AND id > ${abId} ORDER BY id LIMIT 2000`) as any[];
    if (!z.length) break;
    for (const r of z) {
      const soll = ketteGlied(vorher, { am: new Date(r.created_at).toISOString(), raumId: r.raum_id, gastId: r.gast_id, dokumentId: r.dokument_id, art: String(r.art), detail: r.detail ?? null, wer: r.wer ?? null, ip: r.ip ?? null, ua: r.ua ?? null });
      if (soll !== String(r.kette)) return { ok: false, zeilen: n, bruchBei: zahl(r.id) };
      vorher = soll; n++; abId = zahl(r.id);
    }
    if (n > 200_000) break;
  }
  return { ok: true, zeilen: n, bruchBei: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// EINTRETEN UND SITZUNG
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Je Anschluss höchstens 5 Fehlversuche in 15 Minuten — das sperrt. Mehr als 300 falsche Codes in 10 Minuten
 * insgesamt sperren NIEMANDEN (sonst könnte jeder mit vielen Anschlüssen neue Gäste aussperren), sondern melden
 * sich einmal je Stunde bei Justin (Lauf „datenraum-meldungen“). Rund 59 Bit Zufall im Code machen Raten aussichtslos.
 */
export const DR_BREMSE = { jeAnschluss: 5, jeAnschlussMinuten: 15, alarmGesamt: 300, alarmMinuten: 10 } as const;
async function gebremst(anschluss: string): Promise<boolean> {
  if (!anschluss) return false;
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_dr_protokoll
     WHERE art = 'code_falsch' AND anschluss = ${anschluss} AND created_at > NOW() - make_interval(mins => ${DR_BREMSE.jeAnschlussMinuten})`) as any[];
  return zahl(z?.n) >= DR_BREMSE.jeAnschluss;
}

export const DR_TEXTE = {
  codeFalsch: "Dieser Einladungscode stimmt nicht. Bitte prüfen Sie ihn — am besten kopieren statt abtippen.",
  gebremst: `Zu viele Versuche. Bitte versuchen Sie es in ${DR_BREMSE.jeAnschlussMinuten} Minuten erneut.`,
  gesperrt: `Ihr Zugang ist derzeit nicht freigeschaltet. Bitte wenden Sie sich an ${NDA_FIAON.kontaktName} (${NDA_FIAON.kontaktEmail}).`,
  anmelden: "Bitte melden Sie sich mit Ihrem Einladungscode erneut an.",
  vorbereitung: "Der Datenraum wird gerade vorbereitet. Bitte versuchen Sie es etwas später noch einmal.",
  angabenFest: `Ihre Angaben sind mit Ihrer Unterschrift festgeschrieben. Änderungen schreiben Sie bitte per E-Mail an ${NDA_FIAON.kontaktName} (${NDA_FIAON.kontaktEmail}).`,
} as const;

export async function drEintreten(codeRoh: unknown, ctx: DrKontext): Promise<Erg<{ gastId: number; version: number }>> {
  await drSchema();
  if (await gebremst(ctx.anschluss ?? ctx.ip)) {
    await drProtokoll({ art: "gebremst", detail: drCodeForm(codeRoh) }, ctx);
    return nein(429, DR_TEXTE.gebremst);
  }
  const normal = drCodeNormal(codeRoh);
  const [g] = normal ? (await sqlPool`
    SELECT g.id, g.raum_id, g.sitzung_version, g.gesperrt_am, r.archiviert_am
      FROM fiaon_dr_gaeste g JOIN fiaon_dr_raeume r ON r.id = g.raum_id
     WHERE g.code_hash = ${drCodeHash(normal)} LIMIT 1`) as any[] : [];
  if (!g) {
    await drProtokoll({ art: "code_falsch", detail: `eingegeben: ${drCodeForm(codeRoh)}` }, { ...ctx, anschluss: ctx.anschluss ?? ctx.ip });
    await new Promise((r) => setTimeout(r, 350));
    return nein(403, DR_TEXTE.codeFalsch);
  }
  if (g.gesperrt_am || g.archiviert_am) {
    await drProtokoll({ raumId: zahl(g.raum_id), gastId: zahl(g.id), art: "gesperrt_versuch" }, ctx);
    return nein(403, DR_TEXTE.gesperrt, { code: "GESPERRT" });
  }
  await sqlPool`UPDATE fiaon_dr_gaeste SET zuletzt_am = NOW() WHERE id = ${g.id}`;
  await drProtokoll({ raumId: zahl(g.raum_id), gastId: zahl(g.id), art: "eingetreten" }, ctx);
  return { ok: true, gastId: zahl(g.id), version: zahl(g.sitzung_version) };
}

interface GastZeile {
  id: number; raumId: number; version: number; gesperrt: boolean; raumArchiviert: boolean; angaben: DrGastAngaben; angabenAm: string | null;
  raumTitel: string; raumNda: DrNdaRaum; raumFreigabe: { hash?: string; am?: string; von?: string } | null; partnerFirmaId: number | null;
  einladungEmail: string; emailBestaetigt: string | null; emailBestaetigtAm: string | null; codeHinweis: string;
  emailCode: { hash: string | null; fuer: string | null; bis: string | null; versuche: number };
  ndaAngezeigt: { hash?: string; am?: string } | null; aufgabeId: number | null;
}
function gastAus(g: any): GastZeile {
  return {
    id: zahl(g.id), raumId: zahl(g.raum_id), version: zahl(g.sitzung_version), gesperrt: !!g.gesperrt_am, raumArchiviert: !!g.archiviert_am,
    angaben: {
      anrede: g.anrede === "herr" || g.anrede === "frau" ? g.anrede : "", vorname: String(g.vorname ?? ""), nachname: String(g.nachname ?? ""),
      firma: String(g.firma ?? ""), funktion: String(g.funktion ?? ""), strasse: String(g.strasse ?? ""), plz: String(g.plz ?? ""),
      ort: String(g.ort ?? ""), land: String(g.land ?? ""), email: String(g.email ?? ""), telefon: String(g.telefon ?? ""),
      weitergabe: String(g.weitergabe ?? ""),
    },
    angabenAm: zeit(g.angaben_am), raumTitel: String(g.raum_titel ?? ""), raumNda: json<DrNdaRaum>(g.nda_angaben, {}),
    raumFreigabe: g.nda_freigabe ? json<any>(g.nda_freigabe, null) : null,
    partnerFirmaId: g.partner_firma_id != null ? zahl(g.partner_firma_id) : null,
    einladungEmail: String(g.einladung_email || g.email || "").toLowerCase(), emailBestaetigt: g.email_bestaetigt ? String(g.email_bestaetigt).toLowerCase() : null,
    emailBestaetigtAm: zeit(g.email_bestaetigt_am), codeHinweis: String(g.code_hinweis ?? ""),
    emailCode: { hash: g.email_code_hash ?? null, fuer: g.email_code_fuer ?? null, bis: zeit(g.email_code_bis), versuche: zahl(g.email_code_versuche) },
    ndaAngezeigt: g.nda_angezeigt ? json<any>(g.nda_angezeigt, null) : null, aufgabeId: g.aufgabe_id != null ? zahl(g.aufgabe_id) : null,
  };
}
async function gastLesen(gastId: number, lauf: Lauf = sqlPool): Promise<GastZeile | null> {
  const [g] = (await lauf`
    SELECT g.*, r.titel AS raum_titel, r.nda_angaben, r.nda_freigabe, r.archiviert_am, r.partner_firma_id
      FROM fiaon_dr_gaeste g JOIN fiaon_dr_raeume r ON r.id = g.raum_id WHERE g.id = ${gastId}`) as any[];
  return g ? gastAus(g) : null;
}
/** Die Sitzung des Gastes — nur mit passendem Sitzungsstand, nicht gesperrt, Raum offen. */
export async function drSitzungGast(s: { gastId: number; version: number } | null): Promise<GastZeile | null> {
  if (!s) return null;
  await drSchema();
  const g = await gastLesen(s.gastId);
  if (!g || g.version !== s.version || g.gesperrt || g.raumArchiviert) return null;
  return g;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJEKTE, DOKUMENTE UND DIE ABGEDECKTEN THEMEN EINES GASTES
// ═══════════════════════════════════════════════════════════════════════════
interface ProjektZeile { id: number; buchstabe: string; schluessel: string; titel: string; beschreibung: string; ndaText: string; geschuetzt: string }
async function projekteLesen(raumId: number, lauf: Lauf = sqlPool): Promise<ProjektZeile[]> {
  const z = (await lauf`
    SELECT id, buchstabe, schluessel, titel, beschreibung, nda_text, geschuetzt FROM fiaon_dr_projekte
     WHERE raum_id = ${raumId} AND entfernt_am IS NULL ORDER BY length(buchstabe), buchstabe, id`) as any[];
  return z.map((p) => ({
    id: zahl(p.id), buchstabe: String(p.buchstabe), schluessel: String(p.schluessel), titel: String(p.titel),
    beschreibung: String(p.beschreibung ?? ""), ndaText: String(p.nda_text ?? ""), geschuetzt: String(p.geschuetzt ?? ""),
  }));
}
/** Wie das Projekt in § 1 steht: eigener §-1-Text, sonst die Ordnerbeschreibung, sonst der Titel. */
const ndaProjekt = (x: ProjektZeile): DrNdaProjekt => ({ buchstabe: x.buchstabe, titel: x.titel, text: x.ndaText || x.beschreibung || x.titel, geschuetzt: x.geschuetzt || null });
const projektHash = (x: ProjektZeile) => drSha256(drProjektKanon(ndaProjekt(x)));
/** Die Prüfsumme des Wortlauts eines Raums (ohne Gast) — daran hängt die Freigabe durch die Verwaltung. */
function raumNdaHash(raumNda: DrNdaRaum, projekte: ProjektZeile[]): string {
  return drSha256(JSON.stringify({ f: NDA_FASSUNG, r: raumNdaPruefen(raumNda), p: projekte.map((p) => drProjektKanon(ndaProjekt(p))) }));
}
interface Abdeckung { ids: number[] | null; letzte: any | null; erste: any | null; fest: DrGastAngaben | null; anzahl: number }
/**
 * Welche Projekte decken die unterzeichneten Vereinbarungen des Gastes — in ihrer HEUTIGEN Fassung? Ein Projekt, dessen
 * §-1-Fassung sich seit der Unterschrift geändert hat, ist nicht mehr gedeckt (Nachtrag). `fest` = die Angaben der
 * jüngsten Vereinbarung (festgeschrieben), `erste` = die erste Vereinbarung (ihr Name steht im Vermerk).
 */
async function abdeckung(gastId: number, projekte: ProjektZeile[], lauf: Lauf = sqlPool): Promise<Abdeckung> {
  const z = (await lauf`
    SELECT id, projekt_hashes, unterzeichnet_am, fassung, text_hash, angaben, unterschrift_name FROM fiaon_dr_nda
     WHERE gast_id = ${gastId} ORDER BY unterzeichnet_am DESC, id DESC`) as any[];
  if (!z.length) return { ids: null, letzte: null, erste: null, fest: null, anzahl: 0 };
  const hashes = z.map((r) => json<Record<string, string>>(r.projekt_hashes, {}));
  const ids = projekte.filter((p) => { const h = projektHash(p); return hashes.some((m) => m[String(p.id)] === h); }).map((p) => p.id);
  const fest = json<{ gast?: DrGastAngaben }>(z[0].angaben, {}).gast ?? null;
  return { ids, letzte: z[0], erste: z[z.length - 1], fest, anzahl: z.length };
}
const DATEI_TYP_TEXT = (mime: string, dateiname: string) => {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  const e = dateiname.split(".").pop()?.toLowerCase() ?? "";
  return e === "docx" ? "Word" : e === "xlsx" ? "Excel" : e === "pptx" ? "PowerPoint" : "Datei";
};
/** Der Name, der im Vermerk steht: aus der ERSTEN Vereinbarung (festgeschrieben), sonst aus den Angaben. */
function vermerkName(g: GastZeile, ab: Abdeckung): string {
  const erste = ab.erste ? json<{ gast?: DrGastAngaben }>(ab.erste.angaben, {}).gast : null;
  return drVollName(erste ?? ab.fest ?? g.angaben);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE VEREINBARUNG FÜR EINEN GAST
// ═══════════════════════════════════════════════════════════════════════════
export interface DrNdaStand {
  bloecke: DrNdaBlock[]; hash: string; kanon: string; fassung: string; projektIds: number[]; projektHashes: Record<string, string>;
  eingabe: DrNdaEingabe; seite: string; abdeckung: Abdeckung; nachtragFaellig: boolean;
}
/**
 * Die Vereinbarung für den Gast: vor der ersten Unterschrift mit seinen gespeicherten Angaben, danach mit den Angaben
 * der jüngsten Vereinbarung (festgeschrieben) — immer mit den aktuellen Projekten. Nur, wenn die Verwaltung den
 * Wortlaut des Raums in dieser Form freigegeben hat.
 */
export async function drNdaFuerGast(g: GastZeile, lauf: Lauf = sqlPool): Promise<Erg<{ nda: DrNdaStand }>> {
  const projekte = await projekteLesen(g.raumId, lauf);
  if (!projekte.length) return nein(409, DR_TEXTE.vorbereitung, { code: "LEER" });
  if (!g.raumFreigabe?.hash || g.raumFreigabe.hash !== raumNdaHash(g.raumNda, projekte)) return nein(409, DR_TEXTE.vorbereitung, { code: "LEER" });
  const ab = await abdeckung(g.id, projekte, lauf);
  let gast: DrGastAngaben;
  if (ab.fest) gast = ab.fest;
  else {
    if (!g.angabenAm) return nein(409, "Bitte zuerst Ihre Angaben für die Vereinbarung eintragen.", { code: "ANGABEN" });
    const p = drGastAngabenPruefen(g.angaben);
    if (!p.ok) return nein(409, "Bitte vervollständigen Sie zuerst Ihre Angaben.", { code: "ANGABEN", fehler: p.fehler as Record<string, string> });
    gast = p.wert;
  }
  const eingabe: DrNdaEingabe = { gast, projekte: projekte.map(ndaProjekt), raum: g.raumNda };
  const bloecke = drNdaBloecke(eingabe);
  const kanon = drNdaKanonisch(bloecke);
  const projektHashes: Record<string, string> = {};
  for (const p of projekte) projektHashes[String(p.id)] = projektHash(p);
  return {
    ok: true,
    nda: {
      bloecke, hash: drSha256(kanon), kanon, fassung: NDA_FASSUNG, projektIds: projekte.map((x) => x.id), projektHashes, eingabe, seite: drSeiteName(gast),
      abdeckung: ab, nachtragFaellig: !!ab.ids && projekte.some((p) => !ab.ids!.includes(p.id)),
    },
  };
}
/** Merkt, welche Fassung dem Gast wann angezeigt wurde (für den Nachweis), und protokolliert es. */
async function angezeigt(g: GastZeile, n: DrNdaStand, ctx: DrKontext | null): Promise<void> {
  await sqlPool`UPDATE fiaon_dr_gaeste SET nda_angezeigt = ${jsonText({ hash: n.hash, am: new Date().toISOString() })}::text::jsonb WHERE id = ${g.id}`.catch(() => {});
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_gelesen", detail: `Fassung ${n.fassung} · ${n.hash.slice(0, 16)}` }, ctx);
}
/** GET /datenraum/nda — die Vereinbarung zum Lesen. */
export async function drNdaZeigen(g: GastZeile, ctx: DrKontext): Promise<Erg<{ nda: { bloecke: DrNdaBlock[]; hash: string; fassung: string } }>> {
  const n = await drNdaFuerGast(g);
  if (!n.ok) return n;
  await angezeigt(g, n.nda, ctx);
  return { ok: true, nda: { bloecke: n.nda.bloecke, hash: n.nda.hash, fassung: n.nda.fassung } };
}
/** Die Vereinbarung als Entwurf (PDF) — zum Gegenlesen, ohne Unterschrift. */
export async function drNdaEntwurfPdf(g: GastZeile, ctx: DrKontext): Promise<Erg<{ pdf: Buffer; dateiname: string }>> {
  const n = await drNdaFuerGast(g);
  if (!n.ok) return n;
  const pdf = Buffer.from(await ndaPdfErzeugen({ entwurf: true, bloecke: n.nda.bloecke, fassung: n.nda.fassung, textHash: n.nda.hash, seite: n.nda.seite, raumTitel: g.raumTitel }));
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_entwurf", detail: n.nda.hash.slice(0, 16) }, ctx);
  return { ok: true, pdf, dateiname: drDateiname(`FIAON_NDA_Entwurf_${n.nda.eingabe.gast.nachname}`, "pdf") };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAND FÜR DIE SEITE DES GASTES
// ═══════════════════════════════════════════════════════════════════════════
export async function drStand(g: GastZeile): Promise<Record<string, unknown>> {
  const projekte = await projekteLesen(g.raumId);
  const ab = await abdeckung(g.id, projekte);
  const ids = ab.ids;
  const docs = ids ? (await sqlPool`
    SELECT id, kennung, projekt_id, nr, titel, beschreibung, dateiname, mime, groesse, seiten FROM fiaon_dr_dokumente
     WHERE raum_id = ${g.raumId} AND entfernt_am IS NULL AND sichtbar = TRUE ORDER BY nr, titel, id`) as any[] : [];
  const mitDokumenten = new Set(docs.map((d: any) => zahl(d.projekt_id)));
  const freigegeben = !!g.raumFreigabe?.hash && g.raumFreigabe.hash === raumNdaHash(g.raumNda, projekte);
  const liste = projekte.map((p) => {
    const offen = !!ids && ids.includes(p.id);
    return {
      // Vor der Unterschrift nur Buchstabe und Titel — die Ordnerbeschreibung ist Inhalt (Gutachten 09.11.2026);
      // der Text in § 1 steht ohnehin in der Vereinbarung.
      buchstabe: p.buchstabe, titel: p.titel, beschreibung: offen ? p.beschreibung : "", abgedeckt: offen,
      dokumente: offen ? docs.filter((d: any) => zahl(d.projekt_id) === p.id).map((d: any) => ({
        kennung: String(d.kennung), nr: zahl(d.nr), titel: String(d.titel), beschreibung: String(d.beschreibung ?? ""),
        groesse: zahl(d.groesse), seiten: d.seiten != null ? zahl(d.seiten) : null, typ: DATEI_TYP_TEXT(String(d.mime), String(d.dateiname)),
        ansehen: drDateiArtVonMime(String(d.mime)) !== "office",
      })) : [],
      // Ohne Vereinbarung erfährt der Gast nicht, wie viele Unterlagen es gibt.
      anzahl: offen ? docs.filter((d: any) => zahl(d.projekt_id) === p.id).length : null,
    };
  });
  // Nachtrag: ein Thema mit Unterlagen, das keine unterschriebene Fassung deckt (neu oder geändert) — erst nach der Freigabe.
  const nachtrag = !!ids && freigegeben && projekte.some((p) => !ids.includes(p.id) && mitDokumenten.has(p.id));
  const schritt = ab.letzte ? "raum" : g.angabenAm ? "vereinbarung" : "angaben";
  return {
    ok: true, angemeldet: true, schritt, nachtrag,
    gast: { ...(ab.fest ?? g.angaben), angabenAm: g.angabenAm, fest: !!ab.letzte },
    raum: { titel: g.raumTitel },
    projekte: liste,
    nda: ab.letzte ? { unterzeichnetAm: zeit(ab.letzte.unterzeichnet_am), fassung: String(ab.letzte.fassung), hashKurz: String(ab.letzte.text_hash).slice(0, 16) } : null,
    kontakt: { name: NDA_FIAON.kontaktName, email: NDA_FIAON.kontaktEmail },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANGABEN DES GASTES
// ═══════════════════════════════════════════════════════════════════════════
const EMAIL_CODE = { minuten: 15, versuche: 5, jeStunde: 3 } as const;
/** Vorher→Nachher der geänderten Felder fürs Protokoll (ohne Weitergabe-Liste im Klartext zu kürzen). */
function aenderungen(alt: DrGastAngaben, neu: DrGastAngaben): string {
  const t: string[] = [];
  for (const k of Object.keys(DR_FELD_TEXT) as (keyof DrGastAngaben)[]) {
    const a = String(alt[k] ?? ""); const b = String(neu[k] ?? "");
    if (a !== b) t.push(`${k}: ${a || "—"} → ${b || "—"}`);
  }
  return t.length ? t.join("; ").slice(0, 480) : "unverändert";
}
async function emailCodeSenden(g: GastZeile, email: string, ctx: DrKontext, sender: DrSender): Promise<Erg> {
  const [z] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_dr_protokoll WHERE gast_id = ${g.id} AND art = 'email_code' AND created_at > NOW() - INTERVAL '60 minutes'`) as any[];
  if (zahl(z?.n) >= EMAIL_CODE.jeStunde) return nein(429, `Es wurden schon mehrere Codes geschickt. Bitte nutzen Sie den letzten Code, versuchen Sie es in einer Stunde erneut oder schreiben Sie an ${NDA_FIAON.kontaktEmail}.`, { code: "EMAIL_CODE", fehler: { email: "Bitte den Code aus der letzten E-Mail eintragen." } });
  const code = drEmailCodeErzeugen();
  await sqlPool`
    UPDATE fiaon_dr_gaeste SET email_code_hash = ${drEmailCodeHash(g.id, email, code)}, email_code_fuer = ${email},
           email_code_bis = NOW() + make_interval(mins => ${EMAIL_CODE.minuten}), email_code_versuche = 0, updated_at = NOW()
     WHERE id = ${g.id}`;
  const betreff = "Ihr Bestätigungscode für den FIAON-Datenraum";
  const absaetze = [
    `Ihr Bestätigungscode lautet: ${code}`,
    `Bitte tragen Sie ihn im Datenraum ein. Er gilt ${EMAIL_CODE.minuten} Minuten und bestätigt, dass diese E-Mail-Adresse für Ihre Vertraulichkeitsvereinbarung gilt.`,
    "Haben Sie keinen Code angefordert? Dann ignorieren Sie diese Nachricht bitte.",
  ];
  const r = await sender({
    an: email, betreff, anrede: "Guten Tag,", absender: "global", antwortAn: { email: NDA_FIAON.kontaktEmail, name: NDA_FIAON.kontaktName },
    text: absaetze.join("\n\n"),
    baustein: { betreff: escHtml(betreff), preheader: "Ihr Code für den Datenraum", titel: "Ihr Bestätigungscode", persoenlich: false, bereich: "business", fussStartseite: true, kopfSatz: "Datenraum", rechtsSatz: RECHTS_SATZ, absaetze: ["Guten Tag,", ...absaetze.map(escHtml)] },
  }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "email_code", detail: r.ok ? `an ${email}` : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` }, ctx);
  if (!r.ok) return nein(503, `Die Bestätigung per E-Mail ist gerade nicht möglich. Bitte nutzen Sie die E-Mail-Adresse aus Ihrer Einladung oder schreiben Sie an ${NDA_FIAON.kontaktEmail}.`, { code: "EMAIL_CODE_AUS", fehler: { email: "Bitte die Adresse aus Ihrer Einladung nutzen." } });
  return nein(409, `Wir haben Ihnen einen sechsstelligen Code an ${email} geschickt. Bitte tragen Sie ihn unten ein — er gilt ${EMAIL_CODE.minuten} Minuten.`, { code: "EMAIL_CODE" });
}
export async function drAngabenSpeichern(g: GastZeile, roh: unknown, ctx: DrKontext, opt: { sender?: DrSender } = {}):
  Promise<Erg<{ gast: Record<string, unknown>; nda: { bloecke: DrNdaBlock[]; hash: string; fassung: string } | null; hinweis?: string }>> {
  const [schon] = (await sqlPool`SELECT id FROM fiaon_dr_nda WHERE gast_id = ${g.id} LIMIT 1`) as any[];
  if (schon) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "angaben_abgewiesen" }, ctx);
    return nein(409, DR_TEXTE.angabenFest, { code: "ANGABEN_FEST" });
  }
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const p = drGastAngabenPruefen(r.angaben ?? r);
  if (!p.ok) return nein(400, "Bitte prüfen Sie die markierten Felder.", { fehler: p.fehler as Record<string, string>, code: "FELDER" });
  const w = p.wert;
  // Eine andere E-Mail als die der Einladung gilt erst nach dem Code an genau diese Adresse (Gutachten 09.11.2026):
  // Sonst ginge das unterschriebene PDF an einen Tippfehler, und § 9 nennte eine Adresse, die niemand bestätigt hat.
  const neu = w.email.toLowerCase();
  let bestaetigtJetzt = false;
  if (neu !== g.einladungEmail && neu !== g.emailBestaetigt) {
    const code = String(r.emailCode ?? "").replace(/\D/g, "").slice(0, 6);
    if (!code) return emailCodeSenden(g, neu, ctx, opt.sender ?? aktuellerSender()) as Promise<any>;
    const c = g.emailCode;
    const gueltig = !!c.hash && c.fuer === neu && !!c.bis && new Date(c.bis).getTime() > Date.now() && c.versuche < EMAIL_CODE.versuche
      && drGleich(drEmailCodeHash(g.id, neu, code), c.hash);
    if (!gueltig) {
      await sqlPool`UPDATE fiaon_dr_gaeste SET email_code_versuche = email_code_versuche + 1 WHERE id = ${g.id}`;
      await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "email_code_falsch" }, ctx);
      return nein(400, "Dieser Code stimmt nicht oder ist abgelaufen. Lassen Sie das Feld leer und senden Sie erneut, dann kommt ein neuer Code.", { code: "EMAIL_CODE_FALSCH", fehler: { email: "Code prüfen." } });
    }
    bestaetigtJetzt = true;
  }
  await sqlPool`
    UPDATE fiaon_dr_gaeste SET anrede = ${w.anrede}, vorname = ${w.vorname}, nachname = ${w.nachname}, firma = ${w.firma}, funktion = ${w.funktion},
           strasse = ${w.strasse}, plz = ${w.plz}, ort = ${w.ort}, land = ${w.land}, email = ${w.email}, telefon = ${w.telefon},
           weitergabe = ${w.weitergabe}, angaben_am = NOW(), zuletzt_am = NOW(), updated_at = NOW(),
           email_bestaetigt = CASE WHEN ${bestaetigtJetzt} THEN ${neu} ELSE email_bestaetigt END,
           email_bestaetigt_am = CASE WHEN ${bestaetigtJetzt} THEN NOW() ELSE email_bestaetigt_am END,
           email_code_hash = CASE WHEN ${bestaetigtJetzt} THEN NULL ELSE email_code_hash END
     WHERE id = ${g.id}`;
  if (bestaetigtJetzt) await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "email_bestaetigt", detail: neu }, ctx);
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "angaben", detail: aenderungen(g.angaben, w) }, ctx);
  const neuG = await gastLesen(g.id);
  if (!neuG) return nein(404, DR_TEXTE.anmelden);
  const n = await drNdaFuerGast(neuG);
  const gast = { ...neuG.angaben, angabenAm: neuG.angabenAm, fest: false };
  if (!n.ok) return { ok: true, gast, nda: null, hinweis: n.error };
  await angezeigt(neuG, n.nda, ctx);
  return { ok: true, gast, nda: { bloecke: n.nda.bloecke, hash: n.nda.hash, fassung: n.nda.fassung } };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNTERZEICHNEN
// ═══════════════════════════════════════════════════════════════════════════
export const DR_UNTERZEICHNEN_TEXTE = {
  geaendert: "Die Vereinbarung wurde in der Zwischenzeit ergänzt. Bitte lesen Sie die aktuelle Fassung noch einmal.",
  gelesen: "Bitte bestätigen Sie, dass Sie die Vereinbarung gelesen haben und einverstanden sind.",
  zeichnung: "Bitte unterschreiben Sie im Feld — mit dem Finger oder der Maus.",
  name: (soll: string) => `Bitte tragen Sie Ihren vollen Namen genau so ein: ${soll}.`,
  roboter: "Diese Unterschrift können wir nicht entgegennehmen. Bitte öffnen Sie den Datenraum in Ihrem Browser und unterzeichnen Sie dort.",
  technik: "Ihre Unterschrift ließ sich gerade nicht speichern. Bitte versuchen Sie es in einer Minute noch einmal — es wurde nichts gespeichert.",
  gebremst: "Zu viele Versuche. Bitte warten Sie zehn Minuten und versuchen Sie es dann noch einmal.",
} as const;

/** Der echte Versand: der Freitext-Weg des Mail-Motors (Brevo direkt, mit Anhängen). DATENRAUM_MAILS=aus schaltet ihn ab. */
export const drStandardSender: DrSender = async (m) => {
  if (String(process.env.DATENRAUM_MAILS ?? "").toLowerCase() === "aus") return { ok: false, messageId: null, grund: "Datenraum-Mails abgeschaltet (DATENRAUM_MAILS=aus)." };
  const { freitextSenden } = await import("../mail/motor");
  return freitextSenden({ an: m.an, betreff: m.betreff, text: m.text, anrede: m.anrede ?? null, absender: m.absender, antwortAn: m.antwortAn, anhaenge: m.anhaenge, baustein: m.baustein as any });
};
const aktuellerSender = (): DrSender => senderErsatz ?? drStandardSender;

/**
 * Je Gast höchstens 10 abgewiesene Unterschriftsversuche in 10 Minuten — vor jeder teuren Prüfung (Bild entpacken, PDF
 * bauen). Gelungene Unterschriften zählen nicht: Es gibt sie nur einmal und je echtem Nachtrag.
 */
async function unterzeichnenGebremst(gastId: number): Promise<boolean> {
  const [z] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_dr_protokoll
     WHERE gast_id = ${gastId} AND art = 'nda_abgewiesen' AND created_at > NOW() - INTERVAL '10 minutes'`) as any[];
  return zahl(z?.n) >= 10;
}

/** Partner-Akte (Wiedervorlage, Verlauf) — darf den Datenraum nie aufhalten. */
async function crm<T>(f: (m: typeof import("./fiaon-partner-crm")) => Promise<T>): Promise<T | null> {
  try { return await f(await import("./fiaon-partner-crm")); } catch (e) { console.warn("[DATENRAUM] Partner-Akte:", e instanceof Error ? e.message : e); return null; }
}

export async function drUnterzeichnen(g: GastZeile, body: any, ctx: DrKontext, opt: { sender?: DrSender; mailsSofort?: boolean } = {}): Promise<Erg<{ ndaId: number; schon?: boolean }>> {
  const n = await drNdaFuerGast(g);
  if (!n.ok) return n;
  // Hat der Gast schon unterschrieben, gibt es eine neue Vereinbarung NUR für einen echten Nachtrag (ein Thema ist neu
  // oder geändert) — keine zweite Mail, keine zweite Meldung für dieselbe Lage.
  if (n.nda.abdeckung.letzte && !n.nda.nachtragFaellig) return { ok: true, ndaId: zahl(n.nda.abdeckung.letzte.id), schon: true };
  if (await unterzeichnenGebremst(g.id)) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "gebremst_unterschrift" }, ctx);
    return nein(429, DR_UNTERZEICHNEN_TEXTE.gebremst, { code: "GEBREMST" });
  }
  const abweisen = async (status: number, text: string, code: string) => {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_abgewiesen", detail: code }, ctx);
    return nein(status, text, { code });
  };
  if (String(body?.textHash ?? "") !== n.nda.hash) return abweisen(409, DR_UNTERZEICHNEN_TEXTE.geaendert, "GEAENDERT");
  if (body?.gelesen !== true) return abweisen(400, DR_UNTERZEICHNEN_TEXTE.gelesen, "GELESEN");
  const png = drPngAusDataUrl(body?.png);
  if (drPngTintePruefen(png)) return abweisen(400, DR_UNTERZEICHNEN_TEXTE.zeichnung, "ZEICHNUNG");
  const getippt = zeile(body?.name, 160);
  const gast = n.nda.eingabe.gast;
  if (!drNamePasst(getippt, gast)) return abweisen(400, DR_UNTERZEICHNEN_TEXTE.name(drVollName(gast)), "NAME");
  const { istRoboterUnterschrift } = await import("./fiaon-vertrieb-zusage");
  if (istRoboterUnterschrift(ctx.ip, ctx.ua).roboter) return abweisen(403, DR_UNTERZEICHNEN_TEXTE.roboter, "ROBOTER");

  const [da] = (await sqlPool`SELECT id FROM fiaon_dr_nda WHERE gast_id = ${g.id} AND text_hash = ${n.nda.hash} LIMIT 1`) as any[];
  if (da) return { ok: true, ndaId: zahl(da.id), schon: true };

  const jetzt = new Date();
  const angezeigtAm = g.ndaAngezeigt?.hash === n.nda.hash && g.ndaAngezeigt.am ? new Date(g.ndaAngezeigt.am) : null;
  const mail = gast.email.toLowerCase();
  const emailHerkunft = mail === g.einladungEmail ? "wie in der Einladung"
    : mail === g.emailBestaetigt ? `bestätigt per Code an diese Adresse${g.emailBestaetigtAm ? ` am ${drBerlinZeitLang(new Date(g.emailBestaetigtAm))}` : ""}`
      : "nicht gesondert bestätigt";
  const nachweis: [string, string][] = [
    ["Zustimmung", `„${DR_ZUSTIMMUNG}“ — Häkchen gesetzt`],
    ["Vereinbarung angezeigt", angezeigtAm ? `${drBerlinZeitLang(angezeigtAm)} (${angezeigtAm.toISOString()})` : "mit dieser Unterzeichnung"],
    ["Zugang", `persönlicher Einladungscode …${g.codeHinweis || "?"} (Sitzungsstand ${g.version})`],
    ["E-Mail-Adresse (§ 9)", `${gast.email} — ${emailHerkunft}`],
  ];
  let pdf: Buffer; let siegel: string;
  try {
    const roh = await ndaPdfErzeugen({
      bloecke: n.nda.bloecke, fassung: n.nda.fassung, textHash: n.nda.hash, seite: n.nda.seite, raumTitel: g.raumTitel,
      partei3: { name: drVollName(gast), rolle: drPartei3Rolle(gast), getippt, unterschriftPng: png! }, unterzeichnetAm: jetzt, freigeschaltetAm: jetzt,
      ip: ctx.ip, userAgent: ctx.ua, nachweis,
    });
    const v = await drVersiegeln(roh, jetzt);
    pdf = v.pdf; siegel = v.siegel;
    if (!pdf || pdf.length < 2000) throw new Error("PDF leer");
  } catch (e) {
    console.error(`[DATENRAUM] Gast ${g.id}: Vereinbarungs-PDF:`, e);
    return nein(500, DR_UNTERZEICHNEN_TEXTE.technik, { code: "TECHNIK" });
  }
  const snapshot = { gast, projekte: n.nda.eingabe.projekte, raum: n.nda.eingabe.raum, raumTitel: g.raumTitel, seite: n.nda.seite };
  let ndaId = 0; let schon = false;
  await sqlPool.begin(async (tx: any) => {
    await tx`SELECT id FROM fiaon_dr_gaeste WHERE id = ${g.id} FOR UPDATE`;
    const [vorher] = (await tx`SELECT id FROM fiaon_dr_nda WHERE gast_id = ${g.id} AND text_hash = ${n.nda.hash} LIMIT 1`) as any[];
    if (vorher) { ndaId = zahl(vorher.id); schon = true; return; }
    const [z] = (await tx`
      INSERT INTO fiaon_dr_nda (gast_id, raum_id, fassung, text_hash, text_kanonisch, angaben, projekt_ids, projekt_hashes, zustimmung_text, nda_angezeigt_am,
                                unterschrift_png, unterschrift_name, unterzeichnet_am, angenommen_am, ip, ip_kette, user_agent, code_hinweis, sitzung_version,
                                email, email_herkunft, pdf, pdf_sha256, siegel)
      VALUES (${g.id}, ${g.raumId}, ${n.nda.fassung}, ${n.nda.hash}, ${n.nda.kanon}, ${jsonText(snapshot)}::text::jsonb, ${pgArray(n.nda.projektIds)}::bigint[],
              ${jsonText(n.nda.projektHashes)}::text::jsonb, ${DR_ZUSTIMMUNG}, ${angezeigtAm},
              ${png}, ${getippt}, ${jetzt}, ${jetzt}, ${ctx.ip || null}, ${ctx.kette ?? null}, ${String(ctx.ua || "").slice(0, 500)}, ${g.codeHinweis || null}, ${g.version},
              ${gast.email}, ${emailHerkunft}, ${pdf}, ${drSha256(pdf)}, ${siegel})
      RETURNING id`) as any[];
    ndaId = zahl(z.id);
    await tx`UPDATE fiaon_dr_gaeste SET zuletzt_am = NOW(), updated_at = NOW() WHERE id = ${g.id}`;
  });
  if (schon) return { ok: true, ndaId, schon: true };
  const themen = n.nda.eingabe.projekte.map((p) => p.buchstabe).join(", ");
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_unterzeichnet", detail: `Fassung ${n.nda.fassung} · ${n.nda.hash.slice(0, 16)} · ${themen}` }, ctx);
  // Partner-Akte: Wiedervorlage erledigt, Eintrag im Verlauf.
  const name = drVollName(gast);
  if (g.aufgabeId) await crm((m) => m.aufgabeSpeichern(g.aufgabeId!, { erledigt: true }, "Datenraum (Unterschrift)"));
  if (g.partnerFirmaId) {
    await crm((m) => m.verlaufAnlegen({
      firmaId: g.partnerFirmaId, typ: "vereinbarung", titel: `Datenraum: ${n.nda.abdeckung.letzte ? "Nachtrag" : "NDA"} unterschrieben — ${name}`,
      text: `Raum „${g.raumTitel}“ · Themen ${themen} · Fassung ${n.nda.fassung} · Prüfsumme ${n.nda.hash.slice(0, 16)}. Das unterschriebene PDF liegt im Reiter „Datenraum“.`,
    }, "Datenraum"));
  }
  // Die Mails gehen nach der Antwort raus — die Freischaltung wartet nicht auf Brevo. Scheitern sie, holt der Lauf sie nach.
  const mails = drMailsNachUnterschrift(ndaId, opt.sender ?? aktuellerSender()).catch((e) => console.error(`[DATENRAUM] NDA ${ndaId}: Mails:`, e));
  if (opt.mailsSofort) await mails;
  return { ok: true, ndaId };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENT FÜR DEN GAST
// ═══════════════════════════════════════════════════════════════════════════
/** Je Gast höchstens 60 Auslieferungen in 10 Minuten und 4 gleichzeitig; im ganzen Server 3 Vermerke gleichzeitig. */
export const DR_ABRUF = { jeGast: 60, minuten: 10, gleichzeitigJeGast: 4, vermerkeGleichzeitig: 3, wartenMs: 30_000 } as const;
const vermerkSchlange = drWarteschlange(DR_ABRUF.vermerkeGleichzeitig, DR_ABRUF.wartenMs);
const laufendJeGast = new Map<number, number>();

export async function drDokumentFuerGast(g: GastZeile | null, kennung: string, laden: boolean, ctx: DrKontext):
  Promise<{ ok: true; inhalt: Buffer; mime: string; dateiname: string; vermerkt: boolean; vorgang: string } | { ok: false; status: number; error: string; grund: string }> {
  await drSchema();
  const k = /^[A-Za-z0-9_-]{16,40}$/.test(String(kennung ?? "")) ? String(kennung) : "";
  // Erst Sitzung und Metadaten — der Inhalt (bis 25 MB) kommt erst, wenn der Zugriff erlaubt ist.
  if (!g) return { ok: false, status: 401, error: DR_TEXTE.anmelden, grund: "anmeldung" };
  const [d] = k ? (await sqlPool`
    SELECT d.id, d.raum_id, d.projekt_id, d.sichtbar, d.entfernt_am, d.titel, d.dateiname, d.mime, d.vermerk_moeglich, d.sha256,
           p.entfernt_am AS projekt_entfernt_am
      FROM fiaon_dr_dokumente d JOIN fiaon_dr_projekte p ON p.id = d.projekt_id WHERE d.kennung = ${k} LIMIT 1`) as any[] : [];
  const projekte = await projekteLesen(g.raumId);
  const ab = await abdeckung(g.id, projekte);
  const z: DrZugriff = drZugriff({
    angemeldet: true, gastRaumId: g.raumId, gastGesperrt: g.gesperrt, raumArchiviert: g.raumArchiviert,
    ndaProjektIds: ab.ids,
    dokument: d ? { raumId: zahl(d.raum_id), projektId: zahl(d.projekt_id), sichtbar: !!d.sichtbar, entfernt: !!d.entfernt_am, projektEntfernt: !!d.projekt_entfernt_am } : null,
  });
  if (!z.erlaubt) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, dokumentId: d && zahl(d.raum_id) === g.raumId ? zahl(d.id) : null, art: "zugriff_verweigert", detail: `${z.grund} · ${k.slice(0, 6) || "ohne Kennung"}` }, ctx);
    return { ok: false, status: z.status, error: z.text, grund: z.grund };
  }
  const [b] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_dr_protokoll
     WHERE gast_id = ${g.id} AND art IN ('dokument_angesehen', 'dokument_geladen') AND created_at > NOW() - make_interval(mins => ${DR_ABRUF.minuten})`) as any[];
  const laufend = laufendJeGast.get(g.id) ?? 0;
  if (zahl(b?.n) >= DR_ABRUF.jeGast || laufend >= DR_ABRUF.gleichzeitigJeGast) {
    await drProtokoll({ raumId: g.raumId, gastId: g.id, dokumentId: zahl(d.id), art: "gebremst_dokument", detail: laufend >= DR_ABRUF.gleichzeitigJeGast ? "gleichzeitig" : `${zahl(b?.n)} in ${DR_ABRUF.minuten} Minuten` }, ctx);
    return { ok: false, status: 429, error: "Sehr viele Abrufe in kurzer Zeit. Bitte warten Sie einen Moment und versuchen Sie es dann noch einmal.", grund: "gebremst" };
  }
  laufendJeGast.set(g.id, laufend + 1);
  try {
    // Die Protokollzeile entsteht VOR der Auslieferung — ohne sie geht nichts raus. Ihre Kennung ist die Vorgangsnummer im Vermerk.
    let pid: number;
    try {
      pid = await drProtokollPflicht({ raumId: g.raumId, gastId: g.id, dokumentId: zahl(d.id), art: laden ? "dokument_geladen" : "dokument_angesehen", detail: `${String(d.titel).slice(0, 160)} · SHA-256 ${String(d.sha256).slice(0, 16)}` }, ctx);
    } catch (e) {
      console.error(`[DATENRAUM] Dokument ${d.id}: Protokoll fehlgeschlagen — nichts ausgeliefert:`, e instanceof Error ? e.message : e);
      return { ok: false, status: 503, error: "Der Datenraum ist gerade nicht erreichbar. Bitte versuchen Sie es in einer Minute noch einmal.", grund: "protokoll" };
    }
    const vorgang = drVorgang(pid);
    const name = vermerkName(g, ab);
    const erg = await vermerkSchlange(async () => {
      const [i] = (await sqlPool`SELECT inhalt FROM fiaon_dr_dokumente WHERE id = ${d.id}`) as any[];
      const roh = Buffer.from(i.inhalt);
      if (String(d.mime) === "application/pdf" && d.vermerk_moeglich !== false) {
        try { return { inhalt: await drPdfVermerken(roh, drVermerkText(name, new Date(), vorgang), vorgang), vermerkt: true }; }
        catch (e) { console.warn(`[DATENRAUM] Dokument ${d.id}: Vermerk nicht gesetzt:`, e instanceof Error ? e.message : e); }
      }
      return { inhalt: roh, vermerkt: false };
    });
    if (!erg.ok) return { ok: false, status: 503, error: "Gerade werden viele Unterlagen gleichzeitig vorbereitet. Bitte versuchen Sie es in einem Moment noch einmal.", grund: "warteschlange" };
    if (String(d.mime) === "application/pdf" && !erg.wert.vermerkt) await drProtokoll({ raumId: g.raumId, gastId: g.id, dokumentId: zahl(d.id), art: "ohne_vermerk", detail: vorgang }, ctx);
    await sqlPool`UPDATE fiaon_dr_gaeste SET zuletzt_am = NOW() WHERE id = ${g.id}`.catch(() => {});
    // Eine Meldung je Gast und Tag — der Lauf schickt sie gebündelt, wenn der Gast eine Weile gelesen hat.
    await sqlPool`INSERT INTO fiaon_dr_tagesmeldung (gast_id, tag) VALUES (${g.id}, ${berlinToday()}::date) ON CONFLICT (gast_id, tag) DO NOTHING`.catch((e: any) => console.warn("[DATENRAUM] Tagesmeldung:", e?.message ?? e));
    return { ok: true, inhalt: erg.wert.inhalt, mime: String(d.mime), dateiname: String(d.dateiname), vermerkt: erg.wert.vermerkt, vorgang };
  } finally {
    const n = (laufendJeGast.get(g.id) ?? 1) - 1;
    if (n <= 0) laufendJeGast.delete(g.id); else laufendJeGast.set(g.id, n);
  }
}

/** Das eigene Exemplar der jüngsten Vereinbarung. */
export async function drNdaPdfFuerGast(g: GastZeile, ctx: DrKontext): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const [n] = (await sqlPool`SELECT id, pdf, unterzeichnet_am, angaben FROM fiaon_dr_nda WHERE gast_id = ${g.id} ORDER BY unterzeichnet_am DESC, id DESC LIMIT 1`) as any[];
  if (!n) return null;
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_pdf" }, ctx);
  const a = json<{ gast?: DrGastAngaben }>(n.angaben, {});
  return { pdf: Buffer.from(n.pdf), dateiname: ndaDateiname(a.gast ?? g.angaben, new Date(n.unterzeichnet_am)) };
}
function ndaDateiname(a: Pick<DrGastAngaben, "nachname">, am: Date): string {
  return drDateiname(`FIAON_NDA_${a.nachname}_${berlinToday(am)}`, "pdf");
}

// ═══════════════════════════════════════════════════════════════════════════
// MAILS
// ═══════════════════════════════════════════════════════════════════════════
const RAUM_LINK = () => absoluteUrl("/datenraum/raum");
function chefLink(partnerFirmaId: number | null): string {
  return absoluteUrl(partnerFirmaId ? `/chef/s/global-auftraege?reiter=partner&partner=${partnerFirmaId}&akte=datenraum` : "/chef/s/global-auftraege?reiter=partner");
}
const escHtml = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RECHTS_SATZ = "Vertraulich. Diese Nachricht und ihre Anlagen sind ausschließlich für den genannten Empfänger bestimmt.";

/** Kopie an den Gast und Meldung an Justin — jede nur, solange sie noch nicht raus ist (der Lauf holt Fehlschläge nach). */
export async function drMailsNachUnterschrift(ndaId: number, sender: DrSender = aktuellerSender()): Promise<{ gast: boolean; justin: boolean }> {
  await drSchema();
  const [n] = (await sqlPool`
    SELECT n.*, r.titel AS raum_titel, r.partner_firma_id FROM fiaon_dr_nda n JOIN fiaon_dr_raeume r ON r.id = n.raum_id WHERE n.id = ${ndaId}`) as any[];
  if (!n) return { gast: false, justin: false };
  const a = json<{ gast?: DrGastAngaben; projekte?: DrNdaProjekt[] }>(n.angaben, {});
  const gast = a.gast ?? null;
  if (!gast) return { gast: false, justin: false };
  const am = new Date(n.unterzeichnet_am);
  const wann = drBerlinZeitLang(am);
  const datei = { name: ndaDateiname(gast, am), inhalt: Buffer.from(n.pdf) };
  const themen = (a.projekte ?? []).map((p) => `${p.buchstabe} · ${p.titel}`);
  const erg = { gast: !!n.mail_gast_am, justin: !!n.mail_justin_am };
  const { mailProtokoll } = await import("./fiaon-mail-log");
  // Beide Mails tragen die vollen Prüfsummen von Wortlaut und Datei — ein unabhängiger Beleg mit Zeitstempel im Postfach.
  const pruefWortlaut = String(n.text_hash); const pruefDatei = String(n.pdf_sha256);

  if (!n.mail_gast_am) {
    const betreff = "Ihre Vertraulichkeitsvereinbarung mit FIAON";
    const absaetze = [
      "vielen Dank für Ihre Unterzeichnung.",
      `Im Anhang finden Sie Ihr Exemplar der Vertraulichkeits- und Nichtumgehungsvereinbarung, unterzeichnet am ${wann}. Die Vereinbarung ist mit der Freischaltung durch FIAON in Kraft getreten.`,
      `Ihr Datenraum ist ab sofort geöffnet. Dort finden Sie die Unterlagen zu ${themen.length === 1 ? "dem Thema" : "allen Themen"}, geordnet nach Projekt.`,
    ];
    const daten = [
      { label: "Datenraum", wert: String(n.raum_titel) }, { label: "Themen", wert: themen.join(", ") }, { label: "Fassung", wert: String(n.fassung) },
      { label: "Prüfsumme des Wortlauts (SHA-256)", wert: pruefWortlaut }, { label: "Prüfsumme der PDF-Datei (SHA-256)", wert: pruefDatei },
    ];
    const fuss = `Auf einem anderen Gerät öffnen Sie den Datenraum mit Ihrem persönlichen Einladungslink. Bei Fragen erreichen Sie ${NDA_FIAON.kontaktName} direkt unter ${NDA_FIAON.kontaktEmail}.`;
    const r = await sender({
      an: gast.email, betreff, anrede: drBriefAnrede(gast), absender: "global", antwortAn: { email: NDA_FIAON.kontaktEmail, name: NDA_FIAON.kontaktName },
      text: [...absaetze, daten.map((d) => `${d.label}: ${d.wert}`).join("\n"), `Zum Datenraum: ${RAUM_LINK()}`, fuss].join("\n\n"),
      anhaenge: [datei],
      baustein: {
        betreff: escHtml(betreff), preheader: "Ihr Exemplar der Vereinbarung und der Zugang zum Datenraum.", titel: "Ihr Datenraum ist geöffnet", persoenlich: false,
        bereich: "business", fussStartseite: true, kopfSatz: "Datenraum", rechtsSatz: RECHTS_SATZ, automatischSatz: "Diese Nachricht wurde mit Ihrer Unterzeichnung im Datenraum erstellt.",
        absaetze: [escHtml(drBriefAnrede(gast)), ...absaetze.map(escHtml)], daten: daten.map((d) => ({ label: escHtml(d.label), wert: escHtml(d.wert) })),
        knopf: { text: "Zum Datenraum", url: RAUM_LINK() }, fussnote: escHtml(fuss),
      },
    }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
    await sqlPool`UPDATE fiaon_dr_nda SET mail_gast_am = ${r.ok ? new Date() : null}, mail_gast_fehler = ${r.ok ? null : String(r.grund ?? "unbekannt").slice(0, 500)},
                         mail_gast_versuche = mail_gast_versuche + 1 WHERE id = ${ndaId}`;
    await drProtokoll({ raumId: zahl(n.raum_id), gastId: zahl(n.gast_id), art: "mail_gast", detail: r.ok ? `an ${gast.email}` : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` });
    await mailProtokoll({ event: "datenraum_nda_kopie", empfaenger: gast.email, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? null : (r.grund ?? null), payload: { nda: ndaId, anhang: "Vereinbarung (PDF)" }, ausgeloestVon: "Datenraum", brevoMessageId: r.messageId });
    erg.gast = r.ok;
  }
  if (!n.mail_justin_am) {
    const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
    const name = drVollName(gast);
    const liste = drWeitergabeListe(gast.weitergabe);
    const betreff = `${name} hat die NDA unterschrieben`;
    const absaetze = [
      // Hat der Gast in Anlage 1 frühere Empfänger genannt, steht das GANZ OBEN — die Freischaltung wartet nicht darauf.
      ...(liste.length ? [`Bitte ansehen: In Anlage 1 nennt ${name} frühere Empfänger von Informationen — ${liste.join("; ")}. Sie gelten als seine Empfänger nach § 3.`] : []),
      `${name}${gast.firma ? ` (${gast.firma})` : ""} hat eben die Vertraulichkeitsvereinbarung für den Datenraum „${n.raum_titel}“ unterschrieben — am ${wann}.`,
      "Der Datenraum ist für den Gast freigeschaltet. Der Gast sieht ab jetzt alle sichtbaren Unterlagen. Das unterschriebene PDF hängt an.",
    ];
    const daten = [
      { label: "Themen", wert: themen.join(", ") }, { label: "E-Mail", wert: `${gast.email}${n.email_herkunft ? ` (${n.email_herkunft})` : ""}` }, { label: "Telefon", wert: gast.telefon || "—" },
      { label: "Anschrift", wert: `${gast.strasse}, ${gast.plz} ${gast.ort}, ${gast.land}` }, { label: "IP", wert: String(n.ip ?? "—") },
      { label: "Prüfsumme Wortlaut", wert: pruefWortlaut }, { label: "Prüfsumme PDF", wert: pruefDatei },
    ];
    const r = await sender({
      an: AUFRUF_MELDUNG_AN, betreff, absender: "team", anrede: "Hallo Justin,",
      text: [...absaetze, daten.map((d) => `${d.label}: ${d.wert}`).join("\n"), `Im Chefbüro: ${chefLink(n.partner_firma_id != null ? zahl(n.partner_firma_id) : null)}`].join("\n\n"),
      anhaenge: [datei],
      baustein: {
        betreff: escHtml(betreff), preheader: escHtml(`${name} · Datenraum freigeschaltet`), titel: "NDA unterschrieben", persoenlich: true, du: true, bereich: "business", fussStartseite: true, kopfSatz: "Datenraum",
        rechtsSatz: RECHTS_SATZ, absaetze: ["Hallo Justin,", ...absaetze.map(escHtml)], daten: daten.map((d) => ({ label: escHtml(d.label), wert: escHtml(d.wert) })),
        knopf: { text: "Im Chefbüro ansehen", url: chefLink(n.partner_firma_id != null ? zahl(n.partner_firma_id) : null) },
      },
    }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
    await sqlPool`UPDATE fiaon_dr_nda SET mail_justin_am = ${r.ok ? new Date() : null}, mail_justin_fehler = ${r.ok ? null : String(r.grund ?? "unbekannt").slice(0, 500)},
                         mail_justin_versuche = mail_justin_versuche + 1 WHERE id = ${ndaId}`;
    await drProtokoll({ raumId: zahl(n.raum_id), gastId: zahl(n.gast_id), art: "mail_justin", detail: r.ok ? "gesendet" : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` });
    await mailProtokoll({ event: "datenraum_nda_meldung", empfaenger: AUFRUF_MELDUNG_AN, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? null : (r.grund ?? null), payload: { nda: ndaId }, ausgeloestVon: "Datenraum", brevoMessageId: r.messageId });
    erg.justin = r.ok;
  }
  return erg;
}

/**
 * Der Lauf (alle 5 Minuten, nur im Betrieb): gebündelte Tagesmeldungen an Justin — je Gast und Tag eine, frühestens
 * 10 Minuten nach dem ersten Öffnen, mit allem, was der Gast bis dahin geöffnet hat —, das Nachholen gescheiterter
 * Mails nach der Unterschrift (höchstens drei Versuche), der Alarm bei sehr vielen falschen Codes (höchstens einmal je
 * Stunde) und das nachträgliche Siegel, sobald der Schlüssel da ist. Liefert true, wenn etwas gesendet wurde.
 */
export async function drMeldungenLauf(opt: { sender?: DrSender; wartenMinuten?: number } = {}): Promise<boolean> {
  await drSchema();
  const sender = opt.sender ?? aktuellerSender();
  const warten = Math.max(0, opt.wartenMinuten ?? 10);
  let etwas = false;
  const offen = (await sqlPool`
    SELECT n.id FROM fiaon_dr_nda n
     WHERE ((n.mail_gast_am IS NULL AND n.mail_gast_versuche < 3) OR (n.mail_justin_am IS NULL AND n.mail_justin_versuche < 3))
       AND n.created_at < NOW() - INTERVAL '2 minutes' AND n.created_at > NOW() - INTERVAL '3 days'
     ORDER BY n.id LIMIT 10`) as any[];
  for (const o of offen) { const r = await drMailsNachUnterschrift(zahl(o.id), sender); etwas = etwas || r.gast || r.justin; }

  const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
  const { mailProtokoll } = await import("./fiaon-mail-log");

  // Alarm statt Sperre: viele falsche Codes von vielen Anschlüssen.
  const [fz] = (await sqlPool`SELECT COUNT(*)::int AS n, COUNT(DISTINCT anschluss)::int AS a FROM fiaon_dr_protokoll WHERE art = 'code_falsch' AND created_at > NOW() - make_interval(mins => ${DR_BREMSE.alarmMinuten})`) as any[];
  if (zahl(fz?.n) >= DR_BREMSE.alarmGesamt) {
    const [schon] = (await sqlPool`SELECT 1 AS x FROM fiaon_dr_protokoll WHERE art = 'alarm_bremse' AND created_at > NOW() - INTERVAL '60 minutes' LIMIT 1`) as any[];
    if (!schon) {
      const betreff = `Datenraum: ${zahl(fz.n)} falsche Codes in ${DR_BREMSE.alarmMinuten} Minuten`;
      const text = `Hallo Justin,\n\nim Datenraum kamen in den letzten ${DR_BREMSE.alarmMinuten} Minuten ${zahl(fz.n)} falsche Einladungscodes von ${zahl(fz.a)} Anschlüssen an. Gesperrt wird nur je Anschluss (5 Fehlversuche, 15 Minuten) — echte Gäste kommen weiter hinein. Raten ist bei rund 59 Bit Zufall je Code aussichtslos; das ist eine Warnung, keine Lücke.\n\nIm Chefbüro: ${chefLink(null)}`;
      const r = await sender({ an: AUFRUF_MELDUNG_AN, betreff, absender: "team", anrede: "Hallo Justin,", text }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
      await drProtokoll({ art: "alarm_bremse", detail: `${zahl(fz.n)} falsche Codes, ${zahl(fz.a)} Anschlüsse${r.ok ? "" : ` — nicht gesendet: ${String(r.grund ?? "").slice(0, 120)}`}` });
      etwas = etwas || r.ok;
    }
  }

  const faellig = (await sqlPool`
    SELECT id FROM fiaon_dr_tagesmeldung
     WHERE gesendet_am IS NULL AND versuche < 3 AND angelegt_am < NOW() - make_interval(mins => ${warten})
     ORDER BY id LIMIT 20`) as any[];
  for (const f of faellig) {
    // Erst beanspruchen (eine zweite Instanz nimmt dieselbe Zeile nicht), dann senden; scheitert es, wird die Zeile wieder frei.
    const [m] = (await sqlPool`
      UPDATE fiaon_dr_tagesmeldung SET gesendet_am = NOW(), versuche = versuche + 1
       WHERE id = ${f.id} AND gesendet_am IS NULL RETURNING id, gast_id, tag::text AS tag`) as any[];
    if (!m) continue;
    const g = await gastLesen(zahl(m.gast_id));
    if (!g) continue;
    const ab = await abdeckung(g.id, []);
    const zeilen = (await sqlPool`
      SELECT p.id, p.created_at, p.art, d.titel, pr.buchstabe FROM fiaon_dr_protokoll p
        JOIN fiaon_dr_dokumente d ON d.id = p.dokument_id JOIN fiaon_dr_projekte pr ON pr.id = d.projekt_id
       WHERE p.gast_id = ${g.id} AND p.art IN ('dokument_angesehen', 'dokument_geladen')
         AND (p.created_at AT TIME ZONE 'Europe/Berlin')::date = ${m.tag}::date
       ORDER BY p.created_at`) as any[];
    const uhr = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(d);
    const liste = zeilen.map((z: any) => `${uhr(new Date(z.created_at))}  ${z.buchstabe} · ${z.titel} (${z.art === "dokument_geladen" ? "heruntergeladen" : "angesehen"}, ${drVorgang(zahl(z.id))})`);
    const name = vermerkName(g, ab);
    const anzahl = new Set(zeilen.map((z: any) => `${z.buchstabe}|${z.titel}`)).size;
    const betreff = `Datenraum: ${name} liest — ${anzahl} ${anzahl === 1 ? "Unterlage" : "Unterlagen"} geöffnet`;
    const text = [
      `${name} hat heute im Datenraum „${g.raumTitel}“ Unterlagen geöffnet. Bis jetzt:`,
      liste.join("\n") || "(keine Einzelheiten)",
      "Diese Meldung kommt einmal am Tag je Gast. Alles Weitere steht im Protokoll im Chefbüro (dort auch als Liste zum Herunterladen).",
    ];
    const r = await sender({
      an: AUFRUF_MELDUNG_AN, betreff, absender: "team", anrede: "Hallo Justin,",
      text: [...text, `Im Chefbüro: ${chefLink(g.partnerFirmaId)}`].join("\n\n"),
      baustein: {
        betreff: escHtml(betreff), preheader: escHtml(`${name} hat Unterlagen geöffnet`), titel: "Dein Gast liest", persoenlich: true, du: true, bereich: "business", fussStartseite: true, kopfSatz: "Datenraum",
        rechtsSatz: RECHTS_SATZ, absaetze: ["Hallo Justin,", escHtml(text[0]), liste.map(escHtml).join("\n") || "(keine Einzelheiten)", escHtml(text[2])],
        knopf: { text: "Protokoll im Chefbüro", url: chefLink(g.partnerFirmaId) },
      },
    }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
    if (r.ok) { etwas = true; await sqlPool`UPDATE fiaon_dr_tagesmeldung SET fehler = NULL WHERE id = ${m.id}`; }
    else await sqlPool`UPDATE fiaon_dr_tagesmeldung SET gesendet_am = NULL, fehler = ${String(r.grund ?? "unbekannt").slice(0, 500)} WHERE id = ${m.id}`;
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "tagesmeldung", detail: r.ok ? `${anzahl} Unterlagen` : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` });
    await mailProtokoll({ event: "datenraum_tagesmeldung", empfaenger: AUFRUF_MELDUNG_AN, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? null : (r.grund ?? null), payload: { gast: g.id, tag: m.tag, unterlagen: anzahl }, ausgeloestVon: "Datenraum", brevoMessageId: r.messageId });
  }

  // Nachträgliches Siegel: sobald FIAON_SIGN_CERT_PEM/FIAON_SIGN_KEY_PEM gesetzt sind. Das Original (dessen Prüfsumme in den
  // Mails steht) bleibt unverändert; die versiegelte Fassung liegt daneben und ist als nachträglich gekennzeichnet.
  try {
    const { siegelSchluessel } = await import("./fiaon-global-siegel");
    if (!("fehlt" in siegelSchluessel())) {
      const zuSiegeln = (await sqlPool`SELECT id, pdf, raum_id, gast_id FROM fiaon_dr_nda WHERE pdf_siegel IS NULL AND (siegel IS NULL OR siegel LIKE 'ausstehend%') ORDER BY id LIMIT 5`) as any[];
      for (const s of zuSiegeln) {
        const v = await drVersiegeln(Buffer.from(s.pdf), new Date(), `Nachträglich versiegelt im FIAON-Datenraum — ${NDA_TITEL}`);
        if (v.siegel !== "versiegelt") break;
        await sqlPool`UPDATE fiaon_dr_nda SET pdf_siegel = ${v.pdf}, siegel = ${`nachträglich versiegelt am ${new Date().toISOString()}`}, siegel_am = NOW() WHERE id = ${s.id}`;
        await drProtokoll({ raumId: zahl(s.raum_id), gastId: zahl(s.gast_id), art: "nachgesiegelt", detail: `NDA ${s.id} · SHA-256 der versiegelten Fassung ${drSha256(v.pdf).slice(0, 16)}` });
      }
    }
  } catch (e) { console.warn("[DATENRAUM] Nachträgliches Siegel:", e instanceof Error ? e.message : e); }
  return etwas;
}

// ═══════════════════════════════════════════════════════════════════════════
// VERWALTUNG (Chefbüro › Geschäftspartner › Akte › Datenraum, und scripts/datenraum.ts)
// ═══════════════════════════════════════════════════════════════════════════
export interface DrProjektEingabe { schluessel?: string; titel: string; beschreibung?: string; ndaText?: string; geschuetzt?: string }
function projektPruefen(roh: any): { ok: true; wert: Required<DrProjektEingabe> } | { ok: false; error: string } {
  const titel = zeile(roh?.titel, 160);
  if (titel.length < 2) return { ok: false, error: "Jedes Projekt braucht einen Titel." };
  return {
    ok: true,
    wert: {
      schluessel: zeile(roh?.schluessel, 60).toLowerCase().replace(/[^a-z0-9äöüß_-]+/g, "-").replace(/^-+|-+$/g, ""),
      titel, beschreibung: mehrzeilig(roh?.beschreibung, 600), ndaText: mehrzeilig(roh?.ndaText ?? roh?.nda_text, 1200).replace(/\s*\n\s*/g, " "),
      geschuetzt: zeile(roh?.geschuetzt, 400),
    },
  };
}
function raumNdaPruefen(roh: any): DrNdaRaum {
  const r = roh && typeof roh === "object" ? roh : {};
  return {
    vorgestellt: zeile(r.vorgestellt, 200) || null, zweck: zeile(r.zweck, 400) || null, vorab: zeile(r.vorab, 300) || null,
    partei2Zusatz: zeile(r.partei2Zusatz, 300) || null, zusatz4: zeile(r.zusatz4, 600) || null,
  };
}
async function naechsterBuchstabe(raumId: number, lauf: Lauf): Promise<string> {
  const [z] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_dr_projekte WHERE raum_id = ${raumId}`) as any[];
  return drBuchstabe(zahl(z?.n));
}

export async function drRaumAnlegen(roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ id: number; meldung: string }>> {
  await drSchema();
  const titel = zeile(roh?.titel, 160);
  if (titel.length < 3) return nein(400, "Der Raum braucht einen Titel.");
  const firma = Number(roh?.firmaId ?? roh?.partnerFirmaId);
  const projekte = Array.isArray(roh?.projekte) ? roh.projekte : [];
  if (projekte.length > 26) return nein(400, "Höchstens 26 Projekte je Raum.");
  const geprueft: Required<DrProjektEingabe>[] = [];
  for (const p of projekte) { const r = projektPruefen(p); if (!r.ok) return nein(400, r.error); geprueft.push(r.wert); }
  const [r] = (await lauf`
    INSERT INTO fiaon_dr_raeume (titel, partner_firma_id, nda_angaben, erstellt_von)
    VALUES (${titel}, ${Number.isInteger(firma) && firma > 0 ? firma : null}, ${jsonText(raumNdaPruefen(roh?.nda))}::text::jsonb, ${wer}) RETURNING id`) as any[];
  const id = zahl(r.id);
  for (const p of geprueft) { const e = await drProjektSpeichern(id, p, wer, lauf); if (!e.ok) return e; }
  await drProtokoll({ raumId: id, art: "raum_angelegt", detail: titel, wer }, null, lauf);
  return { ok: true, id, meldung: `Datenraum „${titel}“ angelegt. Vor der ersten Einladung: „Vereinbarung ansehen“ und freigeben.` };
}

export async function drRaumAendern(id: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const [r] = (await lauf`SELECT id, titel, nda_angaben, partner_firma_id FROM fiaon_dr_raeume WHERE id = ${id}`) as any[];
  if (!r) return nein(404, "Diesen Datenraum gibt es nicht.");
  const titel = roh?.titel !== undefined ? zeile(roh.titel, 160) : String(r.titel);
  if (titel.length < 3) return nein(400, "Der Raum braucht einen Titel.");
  const nda = roh?.nda !== undefined ? raumNdaPruefen(roh.nda) : json<DrNdaRaum>(r.nda_angaben, {});
  const firmaRoh = roh?.firmaId !== undefined ? Number(roh.firmaId) : r.partner_firma_id != null ? Number(r.partner_firma_id) : null;
  const firma = firmaRoh != null && Number.isInteger(firmaRoh) && firmaRoh > 0 ? firmaRoh : null;
  const archiv = roh?.archivieren === true ? "an" : roh?.archivieren === false ? "aus" : null;
  await lauf`
    UPDATE fiaon_dr_raeume SET titel = ${titel}, nda_angaben = ${jsonText(nda)}::text::jsonb, partner_firma_id = ${firma},
           archiviert_am = CASE WHEN ${archiv}::text = 'an' THEN COALESCE(archiviert_am, NOW()) WHEN ${archiv}::text = 'aus' THEN NULL ELSE archiviert_am END,
           updated_at = NOW()
     WHERE id = ${id}`;
  await drProtokoll({ raumId: id, art: "raum_geaendert", detail: titel, wer }, null, lauf);
  const geaendert = jsonText(raumNdaPruefen(json<DrNdaRaum>(r.nda_angaben, {}))) !== jsonText(nda);
  return { ok: true, meldung: geaendert ? "Gespeichert. Die Zusätze der Vereinbarung haben sich geändert — bitte „Vereinbarung ansehen“ und neu freigeben." : "Gespeichert." };
}

export async function drProjektSpeichern(raumId: number, roh: any, wer: string, lauf: Lauf = sqlPool, projektId: number | null = null): Promise<Erg<{ id: number; buchstabe: string; neu: boolean; meldung: string }>> {
  await drSchema();
  const r = projektPruefen(roh);
  if (!r.ok) return nein(400, r.error);
  const p = r.wert;
  const [raum] = (await lauf`SELECT id FROM fiaon_dr_raeume WHERE id = ${raumId}`) as any[];
  if (!raum) return nein(404, "Diesen Datenraum gibt es nicht.");
  const schluessel = p.schluessel || p.titel.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "projekt";
  const [da] = projektId
    ? (await lauf`SELECT * FROM fiaon_dr_projekte WHERE id = ${projektId} AND raum_id = ${raumId} AND entfernt_am IS NULL`) as any[]
    : (await lauf`SELECT * FROM fiaon_dr_projekte WHERE raum_id = ${raumId} AND lower(schluessel) = lower(${schluessel}) AND entfernt_am IS NULL`) as any[];
  if (projektId && !da) return nein(404, "Dieses Projekt gibt es nicht.");
  if (da) {
    const alt: ProjektZeile = { id: zahl(da.id), buchstabe: String(da.buchstabe), schluessel: String(da.schluessel), titel: String(da.titel), beschreibung: String(da.beschreibung ?? ""), ndaText: String(da.nda_text ?? ""), geschuetzt: String(da.geschuetzt ?? "") };
    const neu: ProjektZeile = { ...alt, titel: p.titel, beschreibung: p.beschreibung, ndaText: p.ndaText, geschuetzt: p.geschuetzt };
    await lauf`
      UPDATE fiaon_dr_projekte SET titel = ${p.titel}, beschreibung = ${p.beschreibung || null}, nda_text = ${p.ndaText || null},
             geschuetzt = ${p.geschuetzt || null}, updated_at = NOW() WHERE id = ${da.id}`;
    const ndaGeaendert = projektHash(alt) !== projektHash(neu);
    let unterschrieben = 0;
    if (ndaGeaendert) {
      const [u] = (await lauf`SELECT COUNT(DISTINCT gast_id)::int AS n FROM fiaon_dr_nda WHERE raum_id = ${raumId} AND projekt_hashes ? ${String(da.id)}`) as any[];
      unterschrieben = zahl(u?.n);
    }
    await drProtokoll({ raumId, art: "projekt_gespeichert", detail: `${da.buchstabe} · ${p.titel}${ndaGeaendert ? " · Wortlaut in § 1 geändert" : ""}`, wer }, null, lauf);
    return {
      ok: true, id: zahl(da.id), buchstabe: String(da.buchstabe), neu: false,
      meldung: !ndaGeaendert ? "Gespeichert." : `Gespeichert. Der Text in der Vereinbarung hat sich geändert — bitte neu freigeben.${unterschrieben ? ` ${unterschrieben} ${unterschrieben === 1 ? "Gast bestätigt" : "Gäste bestätigen"} danach eine ergänzte Fassung, bevor die Unterlagen dieses Projekts wieder sichtbar sind.` : ""}`,
    };
  }
  const buchstabe = await naechsterBuchstabe(raumId, lauf);
  try {
    const [z] = (await lauf`
      INSERT INTO fiaon_dr_projekte (raum_id, buchstabe, schluessel, titel, beschreibung, nda_text, geschuetzt)
      VALUES (${raumId}, ${buchstabe}, ${schluessel}, ${p.titel}, ${p.beschreibung || null}, ${p.ndaText || null}, ${p.geschuetzt || null}) RETURNING id`) as any[];
    await drProtokoll({ raumId, art: "projekt_gespeichert", detail: `${buchstabe} · ${p.titel} (neu)`, wer }, null, lauf);
    return { ok: true, id: zahl(z.id), buchstabe, neu: true, meldung: `Projekt ${buchstabe} angelegt — bitte die Vereinbarung neu freigeben.` };
  } catch (e: any) {
    if (String(e?.code) === "23505") return nein(409, `Ein Projekt mit dem Schlüssel „${schluessel}“ gibt es in diesem Raum schon.`);
    throw e;
  }
}

export async function drProjektEntfernen(projektId: number, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const [p] = (await lauf`UPDATE fiaon_dr_projekte SET entfernt_am = NOW(), updated_at = NOW() WHERE id = ${projektId} AND entfernt_am IS NULL RETURNING raum_id, buchstabe, titel`) as any[];
  if (!p) return nein(404, "Dieses Projekt gibt es nicht.");
  await drProtokoll({ raumId: zahl(p.raum_id), art: "projekt_entfernt", detail: `${p.buchstabe} · ${p.titel}`, wer }, null, lauf);
  return { ok: true, meldung: `Projekt ${p.buchstabe} entfernt — seine Unterlagen sind für Gäste nicht mehr sichtbar (bleiben in der Datenbank). Bitte die Vereinbarung neu freigeben.` };
}

/** Wortlaut und Stand der Freigabe eines Raums — für Vorschau, Freigabe und die Akte. */
async function raumLage(raumId: number): Promise<{ raum: any; projekte: ProjektZeile[]; hash: string; freigabe: { hash?: string; am?: string; von?: string } | null; freigegeben: boolean } | null> {
  const [raum] = (await sqlPool`SELECT * FROM fiaon_dr_raeume WHERE id = ${raumId}`) as any[];
  if (!raum) return null;
  const projekte = await projekteLesen(raumId);
  const hash = raumNdaHash(json<DrNdaRaum>(raum.nda_angaben, {}), projekte);
  const freigabe = raum.nda_freigabe ? json<any>(raum.nda_freigabe, null) : null;
  return { raum, projekte, hash, freigabe, freigegeben: !!freigabe?.hash && freigabe.hash === hash };
}
/** Platzhalter für die Vorschau ohne Gast — deutlich als Platzhalter zu erkennen. */
const VORSCHAU_GAST: DrGastAngaben = { anrede: "", vorname: "‹Vorname›", nachname: "‹Nachname›", firma: "", funktion: "", strasse: "‹Strasse und Hausnummer›", plz: "‹PLZ›", ort: "‹Ort›", land: "‹Land›", email: "‹E-Mail des Gastes›", telefon: "", weitergabe: "" };
/**
 * Die Vereinbarung, wie ein Gast sie sehen wird: mit den Angaben eines eingeladenen Gastes (vorbefüllt oder schon
 * festgeschrieben) oder mit Platzhaltern. Für „Vereinbarung ansehen“ im Chefbüro und nda-vorschau im Skript.
 */
export async function drNdaVorschau(raumId: number, gastId: number | null): Promise<Erg<{ bloecke: DrNdaBlock[]; hash: string; raumHash: string; freigegeben: boolean; freigabe: any; seite: string; raumTitel: string; gast: DrGastAngaben }>> {
  await drSchema();
  const l = await raumLage(raumId);
  if (!l) return nein(404, "Diesen Datenraum gibt es nicht.");
  if (!l.projekte.length) return nein(409, "Der Raum hat noch kein Projekt.");
  let gast = VORSCHAU_GAST;
  if (gastId) {
    const g = await gastLesen(gastId);
    if (!g || g.raumId !== raumId) return nein(404, "Diesen Gast gibt es in diesem Raum nicht.");
    const ab = await abdeckung(g.id, l.projekte);
    gast = ab.fest ?? { ...VORSCHAU_GAST, ...Object.fromEntries(Object.entries(g.angaben).filter(([, v]) => String(v ?? "").trim())) } as DrGastAngaben;
  }
  const bloecke = drNdaBloecke({ gast, projekte: l.projekte.map(ndaProjekt), raum: json<DrNdaRaum>(l.raum.nda_angaben, {}) });
  return { ok: true, bloecke, hash: drSha256(drNdaKanonisch(bloecke)), raumHash: l.hash, freigegeben: l.freigegeben, freigabe: l.freigabe, seite: drSeiteName(gast), raumTitel: String(l.raum.titel), gast };
}
export async function drNdaVorschauPdf(raumId: number, gastId: number | null, wer: string): Promise<Erg<{ pdf: Buffer; dateiname: string }>> {
  const v = await drNdaVorschau(raumId, gastId);
  if (!v.ok) return v;
  const pdf = Buffer.from(await ndaPdfErzeugen({ entwurf: true, bloecke: v.bloecke, fassung: NDA_FASSUNG, textHash: v.hash, seite: v.seite, raumTitel: v.raumTitel }));
  await drProtokoll({ raumId, gastId, art: "chef_vorschau", detail: `${gastId ? `mit den Angaben von Gast ${gastId}` : "mit Platzhaltern"} · Raum-Fassung ${v.raumHash.slice(0, 12)}`, wer });
  return { ok: true, pdf, dateiname: drDateiname(`FIAON_NDA_Vorschau_${v.raumTitel}`, "pdf") };
}
/** „Freigeben“: Ab jetzt sehen Gäste genau diesen Wortlaut. Jede Änderung an Zusätzen oder Projekten hebt die Freigabe auf. */
export async function drNdaFreigeben(raumId: number, wer: string, erwartet?: string | null): Promise<Erg<{ meldung: string; hash: string }>> {
  await drSchema();
  const l = await raumLage(raumId);
  if (!l) return nein(404, "Diesen Datenraum gibt es nicht.");
  if (!l.projekte.length) return nein(409, "Der Raum hat noch kein Projekt.");
  if (erwartet && erwartet !== l.hash) return nein(409, "Die Vereinbarung hat sich seit der Vorschau geändert — bitte noch einmal ansehen.", { code: "GEAENDERT" });
  await sqlPool`UPDATE fiaon_dr_raeume SET nda_freigabe = ${jsonText({ hash: l.hash, am: new Date().toISOString(), von: wer, fassung: NDA_FASSUNG })}::text::jsonb, updated_at = NOW() WHERE id = ${raumId}`;
  await drProtokoll({ raumId, art: "nda_freigegeben", detail: `Fassung ${NDA_FASSUNG} · Raum-Fassung ${l.hash.slice(0, 12)} · Themen ${l.projekte.map((p) => p.buchstabe).join(", ")}`, wer });
  return { ok: true, hash: l.hash, meldung: "Vereinbarung freigegeben — eingeladene Gäste können jetzt unterzeichnen." };
}

/**
 * Der persönliche Link: Der Code steht im ANKER (#c=…). Ein Anker geht nie an den Server — er steht nicht in den
 * Zugriffs-Logs von Cloudflare und Render und bleibt bei der Weiterleitung www → ohne www erhalten (Gutachten 09.11.2026).
 */
const zugangsLink = (code: string) => absoluteUrl(`/datenraum/zugang#c=${encodeURIComponent(code)}`);

export async function drGastEinladen(raumId: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ id: number; code: string; link: string; meldung: string }>> {
  await drSchema();
  const v = drVorbefuellungPruefen(roh);
  if (!v.ok) return nein(400, v.error);
  const l = await raumLage(raumId);
  if (!l) return nein(404, "Diesen Datenraum gibt es nicht.");
  if (l.raum.archiviert_am) return nein(409, "Der Raum ist archiviert.");
  // Kein Gast unterschreibt einen Wortlaut, den niemand angesehen hat (Gutachten 09.11.2026).
  if (!l.freigegeben) return nein(409, "Bitte zuerst die Vereinbarung ansehen und freigeben — sie ist neu oder hat sich seit der letzten Freigabe geändert.", { code: "FREIGABE" });
  const w = v.wert;
  const c = drCodeErzeugen();
  let id = 0;
  try {
    const [z] = (await lauf`
      INSERT INTO fiaon_dr_gaeste (raum_id, code_hash, code_hinweis, anrede, vorname, nachname, firma, funktion, strasse, plz, ort, land, email, telefon,
                                   einladung, einladung_email, eingeladen_von)
      VALUES (${raumId}, ${c.hash}, ${c.hinweis}, ${w.anrede}, ${w.vorname}, ${w.nachname}, ${w.firma}, ${w.funktion}, ${w.strasse}, ${w.plz}, ${w.ort},
              ${w.land}, ${w.email}, ${w.telefon}, ${jsonText({ ...w, am: new Date().toISOString(), von: wer })}::text::jsonb, ${w.email.toLowerCase()}, ${wer}) RETURNING id`) as any[];
    id = zahl(z.id);
  } catch (e: any) {
    if (String(e?.code) === "23505") return nein(409, "Diese E-Mail-Adresse ist in diesem Raum schon eingeladen — dort „Neuer Code“ nutzen.");
    throw e;
  }
  const name = drVollName(w);
  await drProtokoll({ raumId, gastId: id, art: "gast_eingeladen", detail: `${name} · …${c.hinweis}`, wer }, null, lauf);
  // Wiedervorlage (Regel Nr. 1): Aufgabe in der Partner-Akte, fällig in drei Werktagen — sie erledigt sich mit der Unterschrift.
  const firmaId = l.raum.partner_firma_id != null ? zahl(l.raum.partner_firma_id) : null;
  let wiedervorlage = "";
  if (firmaId) {
    const { werktagPlus } = await import("@shared/fiaon-global-lead-texte");
    const { istFeiertag } = await import("@shared/fiaon-feiertage");
    const faellig = werktagPlus(berlinToday(), 3, (t) => istFeiertag("DE", t));
    const a = await crm((m) => m.aufgabeSpeichern(null, {
      firmaId, titel: `Datenraum: Unterschrift von ${name} nachfassen`, faelligAm: faellig,
      notiz: `Eingeladen in „${String(l.raum.titel)}“ (Code …${c.hinweis}). Die Aufgabe erledigt sich mit der Unterschrift von selbst.`,
    }, wer));
    if (a && a.ok) { await sqlPool`UPDATE fiaon_dr_gaeste SET aufgabe_id = ${a.id} WHERE id = ${id}`; wiedervorlage = ` Wiedervorlage am ${faellig.split("-").reverse().join(".")} in der Akte.`; }
    await crm((m) => m.verlaufAnlegen({ firmaId, typ: "vereinbarung", titel: `Datenraum: ${name} eingeladen`, text: `Raum „${String(l.raum.titel)}“ · Code …${c.hinweis}. Vereinbarung und Unterlagen im Reiter „Datenraum“.` }, wer));
  }
  return { ok: true, id, code: c.code, link: zugangsLink(c.code), meldung: `${name} ist eingeladen. Code und Link werden nur jetzt angezeigt.${wiedervorlage}` };
}

export async function drGastCodeNeu(gastId: number, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ code: string; link: string; meldung: string }>> {
  await drSchema();
  const c = drCodeErzeugen();
  const [g] = (await lauf`
    UPDATE fiaon_dr_gaeste SET code_hash = ${c.hash}, code_hinweis = ${c.hinweis}, code_erneuert_am = NOW(), sitzung_version = sitzung_version + 1, updated_at = NOW()
     WHERE id = ${gastId} RETURNING raum_id, vorname, nachname`) as any[];
  if (!g) return nein(404, "Diesen Gast gibt es nicht.");
  await drProtokoll({ raumId: zahl(g.raum_id), gastId, art: "code_erneuert", detail: `…${c.hinweis} — alter Code und offene Sitzungen ungültig`, wer }, null, lauf);
  return { ok: true, code: c.code, link: zugangsLink(c.code), meldung: "Neuer Code — der alte gilt nicht mehr, offene Sitzungen sind beendet." };
}

export async function drGastSperren(gastId: number, sperren: boolean, grund: unknown, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const text = zeile(grund, 300) || null;
  const [g] = sperren
    ? (await lauf`UPDATE fiaon_dr_gaeste SET gesperrt_am = NOW(), gesperrt_von = ${wer}, gesperrt_grund = ${text}, sitzung_version = sitzung_version + 1, updated_at = NOW()
                   WHERE id = ${gastId} RETURNING raum_id`) as any[]
    : (await lauf`UPDATE fiaon_dr_gaeste SET gesperrt_am = NULL, gesperrt_von = NULL, gesperrt_grund = NULL, updated_at = NOW() WHERE id = ${gastId} RETURNING raum_id`) as any[];
  if (!g) return nein(404, "Diesen Gast gibt es nicht.");
  await drProtokoll({ raumId: zahl(g.raum_id), gastId, art: sperren ? "gast_gesperrt" : "gast_entsperrt", detail: text, wer }, null, lauf);
  return { ok: true, meldung: sperren ? "Gesperrt — der Gast ist sofort draußen." : "Wieder freigegeben." };
}

/**
 * Die Einladung als Gmail-ENTWURF in js@ (Regel: Justin drückt nur noch „Senden“). Der Code steht nur im Speicher des
 * Browsers, der ihn eben angezeigt hat — er kommt mit der Anfrage und wird gegen die gespeicherte Prüfsumme geprüft.
 */
export async function drEinladungEntwurf(gastId: number, codeRoh: unknown, wer: string): Promise<Erg<{ meldung: string; entwurfId: string }>> {
  await drSchema();
  const g = await gastLesen(gastId);
  if (!g) return nein(404, "Diesen Gast gibt es nicht.");
  const normal = drCodeNormal(codeRoh);
  const [z] = (await sqlPool`SELECT code_hash FROM fiaon_dr_gaeste WHERE id = ${gastId}`) as any[];
  if (!normal || !z || !drGleich(drCodeHash(normal), String(z.code_hash))) return nein(400, "Der Code passt nicht zu diesem Gast — bitte den eben angezeigten Code nutzen oder einen neuen erzeugen.");
  const code = drCodeAnzeige(normal);
  const link = zugangsLink(code);
  const anrede = drBriefAnrede(g.angaben);
  const betreff = "Ihr persönlicher Zugang zum FIAON-Datenraum";
  const absaetze = [
    "anbei Ihr persönlicher Zugang zu unserem Datenraum. Dort finden Sie die Unterlagen zu den besprochenen Themen, geordnet nach Projekt.",
    `Ihr Zugang: ${link}`,
    `Einladungscode (falls Sie ihn eintippen möchten): ${code}`,
    "Beim ersten Öffnen bestätigen Sie Ihre Angaben und unterzeichnen unsere gegenseitige Vertraulichkeitsvereinbarung direkt im Browser. Danach stehen Ihnen alle Unterlagen sofort zur Verfügung.",
    "Bei Fragen erreichen Sie mich jederzeit direkt.",
  ];
  let absender: { name: string; signaturHtml: string; signaturText: string } | null = null;
  try {
    const { radarAbsenderFuer } = await import("./fiaon-radar");
    const a = await radarAbsenderFuer(NDA_FIAON.kontaktEmail);
    if (a) absender = { name: a.name, signaturHtml: a.signaturHtml, signaturText: a.signaturText };
  } catch (e) { console.warn("[DATENRAUM] Unterschrift js@:", e instanceof Error ? e.message : e); }
  const vonName = absender?.name || NDA_FIAON.kontaktName;
  const text = [anrede, ...absaetze, "Mit freundlichen Grüßen", absender?.signaturText || vonName].join("\n\n");
  const zeilenHtml = [escHtml(anrede), ...absaetze.map((s) => (s.startsWith("Ihr Zugang: ") ? `Ihr Zugang: <a href="${escHtml(link)}">${escHtml(link)}</a>` : escHtml(s))), "Mit freundlichen Grüßen"];
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1f2937">${zeilenHtml.map((s) => `<p>${s}</p>`).join("")}${absender?.signaturHtml ? `<div>${absender.signaturHtml}</div>` : `<p>${escHtml(vonName)}</p>`}</div>`;
  let entwurfId = "";
  try {
    if (entwurfErsatz) entwurfId = await entwurfErsatz({ vonName, an: g.angaben.email || g.einladungEmail, betreff, text, html });
    else {
      const { neueMailEntwurf, gmailBereit } = await import("./fiaon-gmail");
      if (!gmailBereit()) return nein(503, "Gmail ist auf diesem Server nicht eingerichtet — Code und Link bitte kopieren.");
      entwurfId = await neueMailEntwurf(NDA_FIAON.kontaktEmail, { vonName, an: g.angaben.email || g.einladungEmail, betreff, text, html });
    }
  } catch (e) {
    console.error("[DATENRAUM] Entwurf:", e);
    return nein(502, "Der Entwurf ließ sich nicht anlegen — Code und Link bitte kopieren.");
  }
  await drProtokoll({ raumId: g.raumId, gastId, art: "einladung_entwurf", detail: `an ${g.angaben.email || g.einladungEmail} · Entwurf ${entwurfId.slice(0, 24)}`, wer });
  return { ok: true, entwurfId, meldung: `Entwurf liegt in ${NDA_FIAON.kontaktEmail} — dort prüfen und auf „Senden“ drücken.` };
}

/**
 * Ein Dokument ablegen. Idempotent über SHA-256 je Projekt: derselbe Inhalt → dieselbe Zeile (Titel/Beschreibung/Reihenfolge
 * werden aufgefrischt, die Sichtbarkeit bleibt). Neuer Inhalt mit derselben Quelle (Dateiname im Manifest) ersetzt die alte
 * Fassung: Die alte wird entfernt (nicht gelöscht), die neue übernimmt ihre Sichtbarkeit.
 */
export async function drDokumentAblegen(
  ein: { projektId: number; buffer: Buffer; dateiname: string; titel?: string; beschreibung?: string; sichtbar?: boolean; nr?: number; quelle?: string | null },
  wer: string, lauf: Lauf = sqlPool,
): Promise<Erg<{ id: number; kennung: string; neu: boolean; ersetzt: number | null; vermerkMoeglich: boolean | null; vermerkGrund: string | null; meldung: string }>> {
  await drSchema();
  const typ = drDateiTyp(ein.buffer);
  if ("fehler" in typ) return nein(400, typ.fehler);
  const [p] = (await lauf`SELECT id, raum_id, buchstabe FROM fiaon_dr_projekte WHERE id = ${ein.projektId} AND entfernt_am IS NULL`) as any[];
  if (!p) return nein(404, "Dieses Projekt gibt es nicht.");
  const dateiname = drDateiname(ein.dateiname, typ.endung);
  const titel = zeile(ein.titel, 200) || dateiname.replace(/\.[a-z0-9]+$/i, "").replace(/[_-]+/g, " ");
  const beschreibung = zeile(ein.beschreibung, 400) || null;
  const nr = Number.isInteger(ein.nr) ? Math.max(0, Math.min(999, Number(ein.nr))) : 0;
  const quelle = zeile(ein.quelle ?? "", 200) || null;
  const sha = drSha256(ein.buffer);
  const [gleich] = (await lauf`SELECT id, kennung, vermerk_moeglich, vermerk_grund FROM fiaon_dr_dokumente WHERE projekt_id = ${p.id} AND sha256 = ${sha} AND entfernt_am IS NULL`) as any[];
  if (gleich) {
    await lauf`UPDATE fiaon_dr_dokumente SET titel = ${titel}, beschreibung = ${beschreibung}, nr = ${nr}, quelle = COALESCE(${quelle}, quelle), updated_at = NOW() WHERE id = ${gleich.id}`;
    return { ok: true, id: zahl(gleich.id), kennung: String(gleich.kennung), neu: false, ersetzt: null, vermerkMoeglich: gleich.vermerk_moeglich ?? null, vermerkGrund: gleich.vermerk_grund ?? null, meldung: `„${titel}“ war schon da (gleicher Inhalt) — Angaben aufgefrischt.` };
  }
  let seiten: number | null = null; let vermerkMoeglich: boolean | null = null; let vermerkGrund: string | null = null;
  if (typ.art === "pdf") { const pr = await drPdfPruefen(ein.buffer); seiten = pr.seiten; vermerkMoeglich = pr.vermerkMoeglich; vermerkGrund = pr.grund; }
  const [alt] = quelle ? (await lauf`SELECT id, sichtbar FROM fiaon_dr_dokumente WHERE projekt_id = ${p.id} AND quelle = ${quelle} AND entfernt_am IS NULL ORDER BY id DESC LIMIT 1`) as any[] : [];
  const sichtbar = alt ? !!alt.sichtbar : ein.sichtbar !== false;
  const kennung = drKennung();
  const [z] = (await lauf`
    INSERT INTO fiaon_dr_dokumente (kennung, raum_id, projekt_id, nr, titel, beschreibung, dateiname, quelle, mime, groesse, sha256, inhalt, seiten,
                                    vermerk_moeglich, vermerk_grund, sichtbar, hochgeladen_von)
    VALUES (${kennung}, ${p.raum_id}, ${p.id}, ${nr}, ${titel}, ${beschreibung}, ${dateiname}, ${quelle}, ${typ.mime}, ${ein.buffer.length}, ${sha}, ${ein.buffer},
            ${seiten}, ${vermerkMoeglich}, ${vermerkGrund}, ${sichtbar}, ${wer}) RETURNING id`) as any[];
  const id = zahl(z.id);
  if (alt) await lauf`UPDATE fiaon_dr_dokumente SET entfernt_am = NOW(), entfernt_von = ${wer}, ersetzt_durch = ${id}, updated_at = NOW() WHERE id = ${alt.id}`;
  await drProtokoll({ raumId: zahl(p.raum_id), dokumentId: id, art: alt ? "dokument_ersetzt" : "dokument_hochgeladen", detail: `${p.buchstabe} · ${titel}${sichtbar ? "" : " (unsichtbar)"}`, wer }, null, lauf);
  return {
    ok: true, id, kennung, neu: true, ersetzt: alt ? zahl(alt.id) : null, vermerkMoeglich, vermerkGrund,
    meldung: `„${titel}“ ${alt ? "ersetzt die alte Fassung" : "abgelegt"}${sichtbar ? "" : " — noch unsichtbar"}.${vermerkGrund ? ` ${vermerkGrund}` : ""}${typ.art !== "pdf" ? " Bilder und Office-Dateien gehen ohne Vermerk raus — wo möglich als PDF einstellen." : ""}`,
  };
}

export async function drDokumentAendern(id: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const [d] = (await lauf`SELECT id, raum_id, titel, beschreibung, nr, sichtbar FROM fiaon_dr_dokumente WHERE id = ${id} AND entfernt_am IS NULL`) as any[];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht.");
  const titel = roh?.titel !== undefined ? zeile(roh.titel, 200) : String(d.titel);
  if (titel.length < 2) return nein(400, "Der Titel fehlt.");
  const beschreibung = roh?.beschreibung !== undefined ? zeile(roh.beschreibung, 400) || null : d.beschreibung;
  const nr = roh?.nr !== undefined && roh?.nr !== "" && Number.isInteger(Number(roh.nr)) ? Math.max(0, Math.min(999, Number(roh.nr))) : zahl(d.nr);
  const sichtbar = typeof roh?.sichtbar === "boolean" ? roh.sichtbar : !!d.sichtbar;
  await lauf`UPDATE fiaon_dr_dokumente SET titel = ${titel}, beschreibung = ${beschreibung}, nr = ${nr}, sichtbar = ${sichtbar}, updated_at = NOW() WHERE id = ${id}`;
  const art = sichtbar !== !!d.sichtbar ? (sichtbar ? "dokument_sichtbar" : "dokument_unsichtbar") : "dokument_geaendert";
  await drProtokoll({ raumId: zahl(d.raum_id), dokumentId: id, art, detail: titel, wer }, null, lauf);
  return { ok: true, meldung: sichtbar !== !!d.sichtbar ? (sichtbar ? `„${titel}“ ist jetzt sichtbar.` : `„${titel}“ ist jetzt unsichtbar.`) : "Gespeichert." };
}

export async function drDokumentEntfernen(id: number, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const [d] = (await lauf`UPDATE fiaon_dr_dokumente SET entfernt_am = NOW(), entfernt_von = ${wer}, updated_at = NOW() WHERE id = ${id} AND entfernt_am IS NULL RETURNING raum_id, titel`) as any[];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht.");
  await drProtokoll({ raumId: zahl(d.raum_id), dokumentId: id, art: "dokument_entfernt", detail: String(d.titel), wer }, null, lauf);
  return { ok: true, meldung: `„${d.titel}“ entfernt (bleibt in der Datenbank).` };
}

/** Original im Chefbüro — jede Ansicht steht mit Name im Protokoll. */
export async function drDokumentLesen(id: number, wer: string, ctx: DrKontext | null): Promise<{ inhalt: Buffer; mime: string; dateiname: string } | null> {
  await drSchema();
  const [d] = (await sqlPool`SELECT raum_id, titel, inhalt, mime, dateiname FROM fiaon_dr_dokumente WHERE id = ${id}`) as any[];
  if (!d) return null;
  await drProtokoll({ raumId: zahl(d.raum_id), dokumentId: id, art: "chef_angesehen", detail: String(d.titel).slice(0, 200), wer }, ctx);
  return { inhalt: Buffer.from(d.inhalt), mime: String(d.mime), dateiname: String(d.dateiname) };
}
/** Unterschriebenes PDF im Chefbüro — die nachträglich versiegelte Fassung, wenn es sie gibt; jede Ansicht im Protokoll. */
export async function drNdaPdfLesen(ndaId: number, wer: string, ctx: DrKontext | null): Promise<{ pdf: Buffer; dateiname: string } | null> {
  await drSchema();
  const [n] = (await sqlPool`SELECT raum_id, gast_id, pdf, pdf_siegel, unterzeichnet_am, angaben FROM fiaon_dr_nda WHERE id = ${ndaId}`) as any[];
  if (!n) return null;
  await drProtokoll({ raumId: zahl(n.raum_id), gastId: zahl(n.gast_id), art: "chef_nda", detail: `NDA ${ndaId}${n.pdf_siegel ? " (versiegelt)" : ""}`, wer }, ctx);
  const a = json<{ gast?: DrGastAngaben }>(n.angaben, {});
  const name = ndaDateiname(a.gast ?? { nachname: "Gast" }, new Date(n.unterzeichnet_am));
  return { pdf: Buffer.from(n.pdf_siegel ?? n.pdf), dateiname: n.pdf_siegel ? name.replace(/\.pdf$/, "_versiegelt.pdf") : name };
}

/** Protokoll eines Gastes als CSV (Semikolon, UTF-8 mit BOM) — Zeit, Vorgang, Was, Dokument mit Prüfsumme, IP, Browser, Kette. */
export async function drProtokollCsv(gastId: number, wer: string): Promise<{ csv: string; dateiname: string } | null> {
  await drSchema();
  const g = await gastLesen(gastId);
  if (!g) return null;
  const z = (await sqlPool`
    SELECT p.id, p.created_at, p.art, p.detail, p.wer, p.ip, p.ua, p.kette, d.titel, d.sha256 FROM fiaon_dr_protokoll p
      LEFT JOIN fiaon_dr_dokumente d ON d.id = p.dokument_id WHERE p.gast_id = ${gastId} ORDER BY p.id`) as any[];
  const feld = (v: unknown) => {
    let s = String(v ?? "").replace(/\r?\n/g, " ");
    if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
    return /[;"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const berlin = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
  const kopf = ["Vorgang", "Zeit (Berlin)", "Zeit (UTC)", "Was", "Dokument", "SHA-256 des Dokuments", "IP", "Browser", "Detail", "Wer", "Kette"];
  const zeilen = z.map((r) => [drVorgang(zahl(r.id)), berlin(new Date(r.created_at)), new Date(r.created_at).toISOString(), DR_PROTOKOLL_TEXT[String(r.art)] ?? r.art, r.titel ?? "", r.sha256 ?? "", r.ip ?? "", r.ua ?? "", r.detail ?? "", r.wer ?? "", r.kette ?? ""].map(feld).join(";"));
  await drProtokoll({ raumId: g.raumId, gastId, art: "protokoll_export", detail: `${z.length} Zeilen`, wer });
  return { csv: `﻿${kopf.join(";")}\n${zeilen.join("\n")}\n`, dateiname: drDateiname(`Datenraum_Protokoll_${g.angaben.nachname}_${berlinToday()}`, "csv") };
}

/** Räume eines Partners (oder alle) mit Zählern — dazu die Räume ohne Partner (zum Zuordnen). */
export async function drRaeume(firmaId: number | null): Promise<{ raeume: any[]; ohnePartner: any[] }> {
  await drSchema();
  const zeilen = (await sqlPool`
    SELECT r.id, r.titel, r.partner_firma_id, r.archiviert_am, r.created_at,
           (SELECT COUNT(*)::int FROM fiaon_dr_projekte p WHERE p.raum_id = r.id AND p.entfernt_am IS NULL) AS projekte,
           (SELECT COUNT(*)::int FROM fiaon_dr_dokumente d WHERE d.raum_id = r.id AND d.entfernt_am IS NULL) AS dokumente,
           (SELECT COUNT(*)::int FROM fiaon_dr_dokumente d WHERE d.raum_id = r.id AND d.entfernt_am IS NULL AND d.sichtbar) AS sichtbar,
           (SELECT COUNT(*)::int FROM fiaon_dr_gaeste g WHERE g.raum_id = r.id) AS gaeste,
           (SELECT COUNT(DISTINCT n.gast_id)::int FROM fiaon_dr_nda n WHERE n.raum_id = r.id) AS unterzeichnet
      FROM fiaon_dr_raeume r
     WHERE (${firmaId}::int IS NULL OR r.partner_firma_id = ${firmaId}::int OR r.partner_firma_id IS NULL)
     ORDER BY r.archiviert_am NULLS FIRST, r.id DESC`) as any[];
  const aus = (r: any) => ({
    id: zahl(r.id), titel: String(r.titel), partnerFirmaId: r.partner_firma_id != null ? zahl(r.partner_firma_id) : null,
    archiviertAm: zeit(r.archiviert_am), erstelltAm: zeit(r.created_at),
    zaehler: { projekte: zahl(r.projekte), dokumente: zahl(r.dokumente), sichtbar: zahl(r.sichtbar), gaeste: zahl(r.gaeste), unterzeichnet: zahl(r.unterzeichnet) },
  });
  if (firmaId == null) return { raeume: zeilen.map(aus), ohnePartner: zeilen.filter((r) => r.partner_firma_id == null).map(aus) };
  return { raeume: zeilen.filter((r) => r.partner_firma_id != null).map(aus), ohnePartner: zeilen.filter((r) => r.partner_firma_id == null).map(aus) };
}

/** Die ganze Akte eines Raums für die Verwaltung. */
export async function drRaumAkte(id: number): Promise<Record<string, unknown> | null> {
  await drSchema();
  const l = await raumLage(id);
  if (!l) return null;
  const r = l.raum;
  const projekte = (await sqlPool`SELECT * FROM fiaon_dr_projekte WHERE raum_id = ${id} AND entfernt_am IS NULL ORDER BY length(buchstabe), buchstabe, id`) as any[];
  const docs = (await sqlPool`
    SELECT d.id, d.kennung, d.projekt_id, d.nr, d.titel, d.beschreibung, d.dateiname, d.quelle, d.mime, d.groesse, d.seiten, d.sichtbar,
           d.vermerk_moeglich, d.vermerk_grund, d.hochgeladen_von, d.created_at, d.sha256,
           (SELECT COUNT(*)::int FROM fiaon_dr_protokoll p WHERE p.dokument_id = d.id AND p.art IN ('dokument_angesehen', 'dokument_geladen')) AS ansichten
      FROM fiaon_dr_dokumente d WHERE d.raum_id = ${id} AND d.entfernt_am IS NULL ORDER BY d.nr, d.titel, d.id`) as any[];
  const gaeste = (await sqlPool`
    SELECT g.*, (SELECT COUNT(*)::int FROM fiaon_dr_protokoll p WHERE p.gast_id = g.id AND p.art IN ('dokument_angesehen', 'dokument_geladen')) AS ansichten
      FROM fiaon_dr_gaeste g WHERE g.raum_id = ${id} ORDER BY g.id`) as any[];
  const ndas = (await sqlPool`
    SELECT id, gast_id, fassung, text_hash, pdf_sha256, projekt_ids, unterzeichnet_am, unterschrift_name, ip, siegel, pdf_siegel IS NOT NULL AS versiegelt,
           email, email_herkunft, mail_gast_am, mail_gast_fehler, mail_justin_am, mail_justin_fehler
      FROM fiaon_dr_nda WHERE raum_id = ${id} ORDER BY unterzeichnet_am DESC, id DESC`) as any[];
  const protokoll = (await sqlPool`
    SELECT p.id, p.created_at, p.art, p.detail, p.wer, p.ip, p.gast_id, p.dokument_id, g.vorname, g.nachname, d.titel AS dokument_titel
      FROM fiaon_dr_protokoll p LEFT JOIN fiaon_dr_gaeste g ON g.id = p.gast_id LEFT JOIN fiaon_dr_dokumente d ON d.id = p.dokument_id
     WHERE p.raum_id = ${id} ORDER BY p.id DESC LIMIT 250`) as any[];
  const kette = await drProtokollKette().catch(() => ({ ok: false, zeilen: 0, bruchBei: null }));
  const buchstabeVon = new Map(projekte.map((p) => [zahl(p.id), String(p.buchstabe)]));
  return {
    raum: {
      id: zahl(r.id), titel: String(r.titel), partnerFirmaId: r.partner_firma_id != null ? zahl(r.partner_firma_id) : null,
      nda: json<DrNdaRaum>(r.nda_angaben, {}), erstelltAm: zeit(r.created_at), erstelltVon: r.erstellt_von ?? null, archiviertAm: zeit(r.archiviert_am),
      freigabe: l.freigabe ? { am: l.freigabe.am ?? null, von: l.freigabe.von ?? null } : null, freigegeben: l.freigegeben, ndaHash: l.hash,
    },
    projekte: projekte.map((p) => ({
      id: zahl(p.id), buchstabe: String(p.buchstabe), schluessel: String(p.schluessel), titel: String(p.titel), beschreibung: String(p.beschreibung ?? ""),
      ndaText: String(p.nda_text ?? ""), geschuetzt: String(p.geschuetzt ?? ""),
      dokumente: docs.filter((d) => zahl(d.projekt_id) === zahl(p.id)).map((d) => ({
        id: zahl(d.id), kennung: String(d.kennung), nr: zahl(d.nr), titel: String(d.titel), beschreibung: String(d.beschreibung ?? ""), dateiname: String(d.dateiname),
        quelle: d.quelle ?? null, typ: DATEI_TYP_TEXT(String(d.mime), String(d.dateiname)), groesse: zahl(d.groesse), seiten: d.seiten != null ? zahl(d.seiten) : null,
        sichtbar: !!d.sichtbar, vermerkMoeglich: d.vermerk_moeglich ?? null, vermerkGrund: d.vermerk_grund ?? null, hochgeladenVon: d.hochgeladen_von ?? null,
        erstelltAm: zeit(d.created_at), ansichten: zahl(d.ansichten), sha256: String(d.sha256), sha256Kurz: String(d.sha256).slice(0, 12),
      })),
    })),
    gaeste: gaeste.map((g) => {
      const meine = ndas.filter((n) => zahl(n.gast_id) === zahl(g.id));
      const n = meine[0];
      const status = g.gesperrt_am ? "gesperrt" : n ? "unterzeichnet" : g.angaben_am ? "angaben" : "eingeladen";
      return {
        id: zahl(g.id), anrede: String(g.anrede ?? ""), vorname: String(g.vorname), nachname: String(g.nachname), firma: String(g.firma ?? ""),
        email: String(g.email), einladungEmail: String(g.einladung_email ?? ""), emailBestaetigt: g.email_bestaetigt ?? null, telefon: String(g.telefon ?? ""),
        anschrift: [g.strasse, `${g.plz ?? ""} ${g.ort ?? ""}`.trim(), g.land].filter((x) => String(x ?? "").trim()).join(", "),
        codeHinweis: g.code_hinweis ? `…${g.code_hinweis}` : null, status, angabenAm: zeit(g.angaben_am), zuletztAm: zeit(g.zuletzt_am), eingeladenAm: zeit(g.created_at),
        gesperrtAm: zeit(g.gesperrt_am), gesperrtGrund: g.gesperrt_grund ?? null, ansichten: zahl(g.ansichten), weitergabe: String(g.weitergabe ?? ""),
        ndas: meine.map((x) => ({
          id: zahl(x.id), unterzeichnetAm: zeit(x.unterzeichnet_am), fassung: String(x.fassung), hashKurz: String(x.text_hash).slice(0, 16), pdfKurz: String(x.pdf_sha256).slice(0, 16),
          themen: idListe(x.projekt_ids).map((pid) => buchstabeVon.get(pid) ?? "?").join(", "), name: String(x.unterschrift_name), ip: x.ip ?? null,
          siegel: x.siegel ?? null, versiegelt: !!x.versiegelt, email: x.email ?? null, emailHerkunft: x.email_herkunft ?? null,
          mailGast: x.mail_gast_am ? "gesendet" : x.mail_gast_fehler ? `offen: ${x.mail_gast_fehler}` : "offen",
          mailJustin: x.mail_justin_am ? "gesendet" : x.mail_justin_fehler ? `offen: ${x.mail_justin_fehler}` : "offen",
        })),
      };
    }),
    protokoll: protokoll.map((p) => ({
      id: zahl(p.id), am: zeit(p.created_at), art: String(p.art), artText: DR_PROTOKOLL_TEXT[String(p.art)] ?? String(p.art), vorgang: drVorgang(zahl(p.id)),
      gast: p.gast_id ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || `Gast ${p.gast_id}` : null, dokument: p.dokument_titel ?? null,
      detail: p.detail ?? null, wer: p.wer ?? null, ip: p.ip ?? null,
    })),
    kette: { ok: kette.ok, zeilen: kette.zeilen },
    felder: DR_FELD_TEXT,
    fassung: NDA_FASSUNG, titel: NDA_TITEL,
  };
}
