// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — DATENBANK, ABLAUF, MAILS (E-489, 09.11.2026)
//
// Justin: „Wenn er eintritt, muss er alle Infos für die NDA angeben, dann diese
// direkt unterzeichnen und dann soll er direkt Zugriff haben. Stelle ihm alles
// hoch, gut geordnet zu jedem Projekt mit allen Details und Inhalten."
//
// ── DER WEG DES GASTES ────────────────────────────────────────────────────
//   1. Persönlicher Link mit Einladungscode (/datenraum/zugang?c=…) oder Code
//      eintippen → signiertes Sitzungs-Plätzchen (fiaon_dr, nur /api/fiaon/datenraum).
//   2. Angaben für die Vereinbarung (vorbefüllt, änderbar, Pflichtfelder geprüft).
//   3. Vereinbarung lesen (seine Angaben als Partei 3, die Projekte des Raums als
//      Themen in § 1) → Häkchen → zeichnen + vollen Namen tippen → unterzeichnen.
//      Gespeichert: Bild, Name, Zeitpunkt, IP, Browser, Fassung, Prüfsumme des
//      Wortlauts, das PDF. Die FIAON-Seite nimmt mit der Freischaltung an.
//   4. Sofort Zugriff: Projekte als Ordner, Dokumente ansehen/herunterladen —
//      jede PDF-Seite mit „Vertraulich · Name · Datum“, jede Ansicht im Protokoll.
//   5. Mails: Kopie der Vereinbarung an den Gast, Meldung an Justin (mit PDF),
//      eine gebündelte Meldung je Gast und Tag beim ersten Öffnen eines Dokuments.
//
// ── WAS BEWUSST SO IST ────────────────────────────────────────────────────
//   · Eigene Tabellen (fiaon_dr_*), eigene Sitzung — mit keinem anderen
//     Datenraum des Hauses verbunden.
//   · Inhalte (Namen, Projekte, Dokumente) nur in der Datenbank — das Repo ist öffentlich.
//   · Codes nur als Prüfsumme; Fehlversuche bremst das Protokoll (je Anschluss
//     und insgesamt), über Instanzen hinweg.
//   · Keine Hard-Deletes: entfernt_am, gesperrt_am, archiviert_am.
//   · Eine Vereinbarung deckt die Projekte, die sie in § 1 nennt. Kommt ein Thema
//     mit Unterlagen dazu, bestätigt der Gast die ergänzte Fassung (Nachtrag).
//   · Jede schreibende Funktion nimmt `lauf` (Muster AGENTS.md). Schema IMMER vor
//     einer eigenen Transaktion anlegen (drSchema).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { berlinToday } from "./fiaon-time";
import {
  NDA_FASSUNG, NDA_FIAON, NDA_TITEL, DR_FELD_TEXT, drBriefAnrede, drGastAngabenPruefen, drNamePasst, drNdaBloecke,
  drNdaKanonisch, drCodeNormal, drCodeForm, drSeiteName, drVollName, drVorbefuellungPruefen, drBuchstabe, drPartei3Rolle,
  type DrGastAngaben, type DrNdaBlock, type DrNdaEingabe, type DrNdaProjekt, type DrNdaRaum,
} from "@shared/fiaon-datenraum-nda";
import { zeile, mehrzeilig } from "@shared/fiaon-partner-crm";
import {
  drCodeErzeugen, drCodeHash, drDateiTyp, drDateiname, drKennung, drPngAusDataUrl, drPngTintePruefen, drSha256,
  drZugriff, drBerlinZeitLang, drVermerkText, drDateiArtVonMime, type DrZugriff,
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

export interface DrKontext { ip: string; ua: string }

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
          erstellt_von TEXT,
          archiviert_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
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
      await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dr_gaeste_email ON fiaon_dr_gaeste (raum_id, lower(email))`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_dr_nda (
          id BIGSERIAL PRIMARY KEY,
          gast_id BIGINT NOT NULL REFERENCES fiaon_dr_gaeste(id),
          raum_id BIGINT NOT NULL REFERENCES fiaon_dr_raeume(id),
          fassung TEXT NOT NULL,
          text_hash VARCHAR(64) NOT NULL,
          angaben JSONB NOT NULL,
          projekt_ids BIGINT[] NOT NULL,
          unterschrift_png BYTEA NOT NULL,
          unterschrift_name TEXT NOT NULL,
          unterzeichnet_am TIMESTAMPTZ NOT NULL,
          angenommen_am TIMESTAMPTZ NOT NULL,
          ip TEXT,
          user_agent TEXT,
          pdf BYTEA NOT NULL,
          pdf_sha256 VARCHAR(64) NOT NULL,
          siegel TEXT,
          mail_gast_am TIMESTAMPTZ,
          mail_gast_fehler TEXT,
          mail_gast_versuche INTEGER NOT NULL DEFAULT 0,
          mail_justin_am TIMESTAMPTZ,
          mail_justin_fehler TEXT,
          mail_justin_versuche INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_dr_protokoll_bremse ON fiaon_dr_protokoll (art, ip, created_at DESC)`;
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
// PROTOKOLL — darf nie eine Anfrage kippen
// ═══════════════════════════════════════════════════════════════════════════
export const DR_PROTOKOLL_TEXT: Record<string, string> = {
  code_falsch: "Falscher Code", gebremst: "Zu viele Versuche — gebremst", eingetreten: "Eingetreten", gesperrt_versuch: "Gesperrt — abgewiesen",
  angaben: "Angaben gespeichert", nda_gelesen: "Vereinbarung geöffnet", nda_abgewiesen: "Unterschrift abgewiesen", nda_unterzeichnet: "Vereinbarung unterzeichnet",
  nda_pdf: "Eigenes Exemplar geladen", dokument_angesehen: "Angesehen", dokument_geladen: "Heruntergeladen", zugriff_verweigert: "Zugriff verweigert",
  ohne_vermerk: "Ohne Vermerk ausgeliefert", abgemeldet: "Abgemeldet", mail_gast: "Mail an den Gast", mail_justin: "Meldung an Justin",
  tagesmeldung: "Tagesmeldung an Justin", raum_angelegt: "Raum angelegt", raum_geaendert: "Raum geändert", projekt_gespeichert: "Projekt gespeichert",
  projekt_entfernt: "Projekt entfernt", gast_eingeladen: "Gast eingeladen", code_erneuert: "Code erneuert", gast_gesperrt: "Gast gesperrt",
  gast_entsperrt: "Gast entsperrt", dokument_hochgeladen: "Dokument hochgeladen", dokument_ersetzt: "Dokument ersetzt", dokument_geaendert: "Dokument geändert",
  dokument_entfernt: "Dokument entfernt", dokument_sichtbar: "Sichtbar geschaltet", dokument_unsichtbar: "Unsichtbar geschaltet",
};
export async function drProtokoll(
  e: { raumId?: number | null; gastId?: number | null; dokumentId?: number | null; art: string; detail?: string | null; wer?: string | null },
  ctx: DrKontext | null = null, lauf: Lauf = sqlPool,
): Promise<void> {
  try {
    await lauf`
      INSERT INTO fiaon_dr_protokoll (raum_id, gast_id, dokument_id, art, detail, wer, ip, ua)
      VALUES (${e.raumId ?? null}, ${e.gastId ?? null}, ${e.dokumentId ?? null}, ${e.art}, ${e.detail ? String(e.detail).slice(0, 500) : null},
              ${e.wer ?? null}, ${ctx?.ip ? String(ctx.ip).slice(0, 80) : null}, ${ctx?.ua ? String(ctx.ua).slice(0, 300) : null})`;
  } catch (err) { console.warn("[DATENRAUM] Protokoll fehlgeschlagen:", err instanceof Error ? err.message : err); }
}

// ═══════════════════════════════════════════════════════════════════════════
// EINTRETEN UND SITZUNG
// ═══════════════════════════════════════════════════════════════════════════
/** Je Anschluss höchstens 5 Fehlversuche in 15 Minuten; insgesamt höchstens 300 in 10 Minuten. */
export const DR_BREMSE = { jeAnschluss: 5, jeAnschlussMinuten: 15, gesamt: 300, gesamtMinuten: 10 } as const;
async function gebremst(ip: string): Promise<boolean> {
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE ip = ${ip} AND created_at > NOW() - make_interval(mins => ${DR_BREMSE.jeAnschlussMinuten}))::int AS anschluss,
           COUNT(*) FILTER (WHERE created_at > NOW() - make_interval(mins => ${DR_BREMSE.gesamtMinuten}))::int AS gesamt
      FROM fiaon_dr_protokoll WHERE art = 'code_falsch' AND created_at > NOW() - INTERVAL '20 minutes'`) as any[];
  return zahl(z?.anschluss) >= DR_BREMSE.jeAnschluss || zahl(z?.gesamt) >= DR_BREMSE.gesamt;
}

export const DR_TEXTE = {
  codeFalsch: "Dieser Einladungscode stimmt nicht. Bitte prüfen Sie ihn — am besten kopieren statt abtippen.",
  gebremst: `Zu viele Versuche. Bitte versuchen Sie es in ${DR_BREMSE.jeAnschlussMinuten} Minuten erneut.`,
  gesperrt: `Ihr Zugang ist derzeit nicht freigeschaltet. Bitte wenden Sie sich an ${NDA_FIAON.kontaktName} (${NDA_FIAON.kontaktEmail}).`,
  anmelden: "Bitte melden Sie sich mit Ihrem Einladungscode erneut an.",
} as const;

export async function drEintreten(codeRoh: unknown, ctx: DrKontext): Promise<Erg<{ gastId: number; version: number }>> {
  await drSchema();
  if (await gebremst(ctx.ip)) {
    await drProtokoll({ art: "gebremst", detail: drCodeForm(codeRoh) }, ctx);
    return nein(429, DR_TEXTE.gebremst);
  }
  const normal = drCodeNormal(codeRoh);
  const [g] = normal ? (await sqlPool`
    SELECT g.id, g.raum_id, g.sitzung_version, g.gesperrt_am, r.archiviert_am
      FROM fiaon_dr_gaeste g JOIN fiaon_dr_raeume r ON r.id = g.raum_id
     WHERE g.code_hash = ${drCodeHash(normal)} LIMIT 1`) as any[] : [];
  if (!g) {
    await drProtokoll({ art: "code_falsch", detail: `eingegeben: ${drCodeForm(codeRoh)}` }, ctx);
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
  raumTitel: string; raumNda: DrNdaRaum; partnerFirmaId: number | null;
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
    partnerFirmaId: g.partner_firma_id != null ? zahl(g.partner_firma_id) : null,
  };
}
async function gastLesen(gastId: number, lauf: Lauf = sqlPool): Promise<GastZeile | null> {
  const [g] = (await lauf`
    SELECT g.*, r.titel AS raum_titel, r.nda_angaben, r.archiviert_am, r.partner_firma_id
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
/** Alle Projekte, die eine der unterzeichneten Vereinbarungen des Gastes nennt — und die jüngste Vereinbarung. */
async function abgedeckt(gastId: number, lauf: Lauf = sqlPool): Promise<{ ids: number[] | null; letzte: any | null }> {
  const z = (await lauf`
    SELECT id, projekt_ids, unterzeichnet_am, fassung, text_hash FROM fiaon_dr_nda WHERE gast_id = ${gastId} ORDER BY unterzeichnet_am DESC, id DESC`) as any[];
  if (!z.length) return { ids: null, letzte: null };
  const ids = new Set<number>();
  for (const r of z) for (const i of idListe(r.projekt_ids)) ids.add(i);
  return { ids: Array.from(ids), letzte: z[0] };
}
const DATEI_TYP_TEXT = (mime: string, dateiname: string) => {
  if (mime === "application/pdf") return "PDF";
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  const e = dateiname.split(".").pop()?.toLowerCase() ?? "";
  return e === "docx" ? "Word" : e === "xlsx" ? "Excel" : e === "pptx" ? "PowerPoint" : "Datei";
};

// ═══════════════════════════════════════════════════════════════════════════
// DIE VEREINBARUNG FÜR EINEN GAST
// ═══════════════════════════════════════════════════════════════════════════
export interface DrNdaStand { bloecke: DrNdaBlock[]; hash: string; fassung: string; projektIds: number[]; eingabe: DrNdaEingabe; seite: string }
/** Die Vereinbarung mit den gespeicherten Angaben des Gastes und den aktuellen Projekten seines Raums. */
export async function drNdaFuerGast(g: GastZeile, lauf: Lauf = sqlPool): Promise<Erg<{ nda: DrNdaStand }>> {
  if (!g.angabenAm) return nein(409, "Bitte zuerst Ihre Angaben für die Vereinbarung eintragen.", { code: "ANGABEN" });
  const p = drGastAngabenPruefen(g.angaben);
  if (!p.ok) return nein(409, "Bitte vervollständigen Sie zuerst Ihre Angaben.", { code: "ANGABEN", fehler: p.fehler as Record<string, string> });
  const projekte = await projekteLesen(g.raumId, lauf);
  if (!projekte.length) return nein(409, "Der Datenraum wird gerade vorbereitet. Bitte versuchen Sie es etwas später noch einmal.", { code: "LEER" });
  const nprojekte: DrNdaProjekt[] = projekte.map((x) => ({ buchstabe: x.buchstabe, titel: x.titel, text: x.ndaText || x.beschreibung || x.titel, geschuetzt: x.geschuetzt || null }));
  const eingabe: DrNdaEingabe = { gast: p.wert, projekte: nprojekte, raum: g.raumNda };
  const bloecke = drNdaBloecke(eingabe);
  return { ok: true, nda: { bloecke, hash: drSha256(drNdaKanonisch(bloecke)), fassung: NDA_FASSUNG, projektIds: projekte.map((x) => x.id), eingabe, seite: drSeiteName(p.wert) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAND FÜR DIE SEITE DES GASTES
// ═══════════════════════════════════════════════════════════════════════════
export async function drStand(g: GastZeile): Promise<Record<string, unknown>> {
  const projekte = await projekteLesen(g.raumId);
  const { ids, letzte } = await abgedeckt(g.id);
  const docs = ids ? (await sqlPool`
    SELECT id, kennung, projekt_id, nr, titel, beschreibung, dateiname, mime, groesse, seiten FROM fiaon_dr_dokumente
     WHERE raum_id = ${g.raumId} AND entfernt_am IS NULL AND sichtbar = TRUE ORDER BY nr, titel, id`) as any[] : [];
  const mitDokumenten = new Set(docs.map((d: any) => zahl(d.projekt_id)));
  const liste = projekte.map((p) => {
    const offen = !!ids && ids.includes(p.id);
    return {
      buchstabe: p.buchstabe, titel: p.titel, beschreibung: p.beschreibung, abgedeckt: offen,
      dokumente: offen ? docs.filter((d: any) => zahl(d.projekt_id) === p.id).map((d: any) => ({
        kennung: String(d.kennung), nr: zahl(d.nr), titel: String(d.titel), beschreibung: String(d.beschreibung ?? ""),
        groesse: zahl(d.groesse), seiten: d.seiten != null ? zahl(d.seiten) : null, typ: DATEI_TYP_TEXT(String(d.mime), String(d.dateiname)),
        ansehen: drDateiArtVonMime(String(d.mime)) !== "office",
      })) : [],
      // Ohne Vereinbarung erfährt der Gast nicht, wie viele Unterlagen es gibt.
      anzahl: offen ? docs.filter((d: any) => zahl(d.projekt_id) === p.id).length : null,
    };
  });
  const nachtrag = !!ids && projekte.some((p) => !ids.includes(p.id) && mitDokumenten.has(p.id));
  const schritt = letzte ? "raum" : g.angabenAm ? "vereinbarung" : "angaben";
  return {
    ok: true, angemeldet: true, schritt, nachtrag,
    gast: { ...g.angaben, angabenAm: g.angabenAm },
    raum: { titel: g.raumTitel },
    projekte: liste,
    nda: letzte ? { unterzeichnetAm: zeit(letzte.unterzeichnet_am), fassung: String(letzte.fassung), hashKurz: String(letzte.text_hash).slice(0, 16) } : null,
    kontakt: { name: NDA_FIAON.kontaktName, email: NDA_FIAON.kontaktEmail },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANGABEN DES GASTES
// ═══════════════════════════════════════════════════════════════════════════
export async function drAngabenSpeichern(g: GastZeile, roh: unknown, ctx: DrKontext): Promise<Erg<{ nda: { bloecke: DrNdaBlock[]; hash: string; fassung: string } | null; hinweis?: string }>> {
  const p = drGastAngabenPruefen(roh);
  if (!p.ok) return nein(400, "Bitte prüfen Sie die markierten Felder.", { fehler: p.fehler as Record<string, string>, code: "FELDER" });
  const w = p.wert;
  try {
    await sqlPool`
      UPDATE fiaon_dr_gaeste SET anrede = ${w.anrede}, vorname = ${w.vorname}, nachname = ${w.nachname}, firma = ${w.firma}, funktion = ${w.funktion},
             strasse = ${w.strasse}, plz = ${w.plz}, ort = ${w.ort}, land = ${w.land}, email = ${w.email}, telefon = ${w.telefon},
             weitergabe = ${w.weitergabe}, angaben_am = NOW(), zuletzt_am = NOW(), updated_at = NOW()
       WHERE id = ${g.id}`;
  } catch (e: any) {
    if (String(e?.code) === "23505") return nein(409, "Diese E-Mail-Adresse ist in diesem Datenraum schon vergeben.", { fehler: { email: "Diese E-Mail-Adresse ist schon vergeben." }, code: "FELDER" });
    throw e;
  }
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "angaben" }, ctx);
  const neu = await gastLesen(g.id);
  const n = neu ? await drNdaFuerGast(neu) : null;
  if (!n || !n.ok) return { ok: true, nda: null, hinweis: n && !n.ok ? n.error : undefined };
  return { ok: true, nda: { bloecke: n.nda.bloecke, hash: n.nda.hash, fassung: n.nda.fassung } };
}

// ═══════════════════════════════════════════════════════════════════════════
// UNTERZEICHNEN
// ═══════════════════════════════════════════════════════════════════════════
export const DR_UNTERZEICHNEN_TEXTE = {
  geaendert: "Die Vereinbarung wurde in der Zwischenzeit ergänzt. Bitte lesen Sie die aktuelle Fassung noch einmal.",
  gelesen: "Bitte bestätigen Sie, dass Sie die Vereinbarung gelesen haben und einverstanden sind.",
  zeichnung: "Bitte unterschreiben Sie im Feld — mit dem Finger oder der Maus.",
  name: (soll: string) => `Bitte tragen Sie Ihren vollen Namen ein: ${soll}.`,
  roboter: "Diese Unterschrift können wir nicht entgegennehmen. Bitte öffnen Sie den Datenraum in Ihrem Browser und unterzeichnen Sie dort.",
  technik: "Ihre Unterschrift ließ sich gerade nicht speichern. Bitte versuchen Sie es in einer Minute noch einmal — es wurde nichts gespeichert.",
} as const;

export type DrSender = (m: {
  an: string; betreff: string; text: string; anrede?: string | null; absender: "global" | "team" | "legal";
  antwortAn?: { email: string; name?: string }; anhaenge?: { name: string; inhalt: Buffer }[]; baustein?: Record<string, unknown>;
}) => Promise<{ ok: boolean; messageId: string | null; grund?: string }>;

/** Der echte Versand: der Freitext-Weg des Mail-Motors (Brevo direkt, mit Anhängen). DATENRAUM_MAILS=aus schaltet ihn ab. */
export const drStandardSender: DrSender = async (m) => {
  if (String(process.env.DATENRAUM_MAILS ?? "").toLowerCase() === "aus") return { ok: false, messageId: null, grund: "Datenraum-Mails abgeschaltet (DATENRAUM_MAILS=aus)." };
  const { freitextSenden } = await import("../mail/motor");
  return freitextSenden({ an: m.an, betreff: m.betreff, text: m.text, anrede: m.anrede ?? null, absender: m.absender, antwortAn: m.antwortAn, anhaenge: m.anhaenge, baustein: m.baustein as any });
};

export async function drUnterzeichnen(g: GastZeile, body: any, ctx: DrKontext, opt: { sender?: DrSender; mailsSofort?: boolean } = {}): Promise<Erg<{ ndaId: number; schon?: boolean }>> {
  const n = await drNdaFuerGast(g);
  if (!n.ok) return n;
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
  let pdf: Buffer; let siegel: string;
  try {
    const roh = await ndaPdfErzeugen({
      bloecke: n.nda.bloecke, fassung: n.nda.fassung, textHash: n.nda.hash, seite: n.nda.seite, raumTitel: g.raumTitel,
      partei3: { name: drVollName(gast), rolle: drPartei3Rolle(gast), getippt, unterschriftPng: png! }, unterzeichnetAm: jetzt, freigeschaltetAm: jetzt, ip: ctx.ip, userAgent: ctx.ua,
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
      INSERT INTO fiaon_dr_nda (gast_id, raum_id, fassung, text_hash, angaben, projekt_ids, unterschrift_png, unterschrift_name,
                                unterzeichnet_am, angenommen_am, ip, user_agent, pdf, pdf_sha256, siegel)
      VALUES (${g.id}, ${g.raumId}, ${n.nda.fassung}, ${n.nda.hash}, ${jsonText(snapshot)}::text::jsonb, ${pgArray(n.nda.projektIds)}::bigint[],
              ${png}, ${getippt}, ${jetzt}, ${jetzt}, ${ctx.ip || null}, ${String(ctx.ua || "").slice(0, 500)}, ${pdf}, ${drSha256(pdf)}, ${siegel})
      RETURNING id`) as any[];
    ndaId = zahl(z.id);
    await tx`UPDATE fiaon_dr_gaeste SET zuletzt_am = NOW(), updated_at = NOW() WHERE id = ${g.id}`;
  });
  if (schon) return { ok: true, ndaId, schon: true };
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_unterzeichnet", detail: `Fassung ${n.nda.fassung} · ${n.nda.hash.slice(0, 16)} · ${n.nda.eingabe.projekte.map((p) => p.buchstabe).join(", ")}` }, ctx);
  // Die Mails gehen nach der Antwort raus — die Freischaltung wartet nicht auf Brevo. Scheitern sie, holt der Lauf sie nach.
  const mails = drMailsNachUnterschrift(ndaId, opt.sender ?? drStandardSender).catch((e) => console.error(`[DATENRAUM] NDA ${ndaId}: Mails:`, e));
  if (opt.mailsSofort) await mails;
  return { ok: true, ndaId };
}

// ═══════════════════════════════════════════════════════════════════════════
// DOKUMENT FÜR DEN GAST
// ═══════════════════════════════════════════════════════════════════════════
export async function drDokumentFuerGast(g: GastZeile | null, kennung: string, laden: boolean, ctx: DrKontext):
  Promise<{ ok: true; inhalt: Buffer; mime: string; dateiname: string; vermerkt: boolean } | { ok: false; status: number; error: string; grund: string }> {
  await drSchema();
  const k = /^[A-Za-z0-9_-]{16,40}$/.test(String(kennung ?? "")) ? String(kennung) : "";
  const [d] = k ? (await sqlPool`
    SELECT d.id, d.raum_id, d.projekt_id, d.sichtbar, d.entfernt_am, d.titel, d.dateiname, d.mime, d.vermerk_moeglich, d.inhalt,
           p.entfernt_am AS projekt_entfernt_am
      FROM fiaon_dr_dokumente d JOIN fiaon_dr_projekte p ON p.id = d.projekt_id WHERE d.kennung = ${k} LIMIT 1`) as any[] : [];
  const cov = g ? await abgedeckt(g.id) : { ids: null };
  const z: DrZugriff = drZugriff({
    angemeldet: !!g, gastRaumId: g?.raumId ?? null, gastGesperrt: !!g?.gesperrt, raumArchiviert: !!g?.raumArchiviert,
    ndaProjektIds: cov.ids,
    dokument: d ? { raumId: zahl(d.raum_id), projektId: zahl(d.projekt_id), sichtbar: !!d.sichtbar, entfernt: !!d.entfernt_am, projektEntfernt: !!d.projekt_entfernt_am } : null,
  });
  if (!z.erlaubt) {
    if (g) await drProtokoll({ raumId: g.raumId, gastId: g.id, dokumentId: d && zahl(d.raum_id) === g.raumId ? zahl(d.id) : null, art: "zugriff_verweigert", detail: `${z.grund} · ${k.slice(0, 6) || "ohne Kennung"}` }, ctx);
    return { ok: false, status: z.status, error: z.text, grund: z.grund };
  }
  const gast = g!;
  const roh = Buffer.from(d.inhalt);
  let inhalt = roh; let vermerkt = false;
  if (String(d.mime) === "application/pdf" && d.vermerk_moeglich !== false) {
    try { inhalt = await drPdfVermerken(roh, drVermerkText(drVollName(gast.angaben), new Date())); vermerkt = true; }
    catch (e) { console.warn(`[DATENRAUM] Dokument ${d.id}: Vermerk nicht gesetzt:`, e instanceof Error ? e.message : e); }
  }
  await drProtokoll({ raumId: gast.raumId, gastId: gast.id, dokumentId: zahl(d.id), art: laden ? "dokument_geladen" : "dokument_angesehen", detail: String(d.titel).slice(0, 200) }, ctx);
  if (String(d.mime) === "application/pdf" && !vermerkt) await drProtokoll({ raumId: gast.raumId, gastId: gast.id, dokumentId: zahl(d.id), art: "ohne_vermerk" }, ctx);
  await sqlPool`UPDATE fiaon_dr_gaeste SET zuletzt_am = NOW() WHERE id = ${gast.id}`.catch(() => {});
  // Eine Meldung je Gast und Tag — der Lauf schickt sie gebündelt, wenn der Gast eine Weile gelesen hat.
  await sqlPool`INSERT INTO fiaon_dr_tagesmeldung (gast_id, tag) VALUES (${gast.id}, ${berlinToday()}::date) ON CONFLICT (gast_id, tag) DO NOTHING`.catch((e: any) => console.warn("[DATENRAUM] Tagesmeldung:", e?.message ?? e));
  return { ok: true, inhalt, mime: String(d.mime), dateiname: String(d.dateiname), vermerkt };
}

/** Das eigene Exemplar der jüngsten Vereinbarung. */
export async function drNdaPdfFuerGast(g: GastZeile, ctx: DrKontext): Promise<{ pdf: Buffer; dateiname: string } | null> {
  const [n] = (await sqlPool`SELECT id, pdf, unterzeichnet_am FROM fiaon_dr_nda WHERE gast_id = ${g.id} ORDER BY unterzeichnet_am DESC, id DESC LIMIT 1`) as any[];
  if (!n) return null;
  await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "nda_pdf" }, ctx);
  return { pdf: Buffer.from(n.pdf), dateiname: ndaDateiname(g.angaben, new Date(n.unterzeichnet_am)) };
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
export async function drMailsNachUnterschrift(ndaId: number, sender: DrSender = drStandardSender): Promise<{ gast: boolean; justin: boolean }> {
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

  if (!n.mail_gast_am) {
    const betreff = "Ihre Vertraulichkeitsvereinbarung mit FIAON";
    const absaetze = [
      "vielen Dank für Ihre Unterzeichnung.",
      `Im Anhang finden Sie Ihr Exemplar der Vertraulichkeits- und Nichtumgehungsvereinbarung, unterzeichnet am ${wann}. Die Vereinbarung ist mit der Freischaltung durch FIAON in Kraft getreten.`,
      `Ihr Datenraum ist ab sofort geöffnet. Dort finden Sie die Unterlagen zu ${themen.length === 1 ? "dem Thema" : "allen Themen"}, geordnet nach Projekt.`,
    ];
    const daten = [{ label: "Datenraum", wert: String(n.raum_titel) }, { label: "Themen", wert: themen.join(", ") }, { label: "Fassung", wert: String(n.fassung) }];
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
    const betreff = `${name} hat die NDA unterschrieben`;
    const absaetze = [
      `${name}${gast.firma ? ` (${gast.firma})` : ""} hat eben die Vertraulichkeitsvereinbarung für den Datenraum „${n.raum_titel}“ unterschrieben — am ${wann}.`,
      "Der Datenraum ist für den Gast freigeschaltet, er sieht ab jetzt alle sichtbaren Unterlagen. Das unterschriebene PDF hängt an.",
    ];
    const daten = [
      { label: "Themen", wert: themen.join(", ") }, { label: "E-Mail", wert: gast.email }, { label: "Telefon", wert: gast.telefon },
      { label: "Anschrift", wert: `${gast.strasse}, ${gast.plz} ${gast.ort}, ${gast.land}` }, { label: "IP", wert: String(n.ip ?? "—") },
      { label: "Prüfsumme", wert: String(n.text_hash).slice(0, 16) },
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
 * 10 Minuten nach dem ersten Öffnen, mit allem, was der Gast bis dahin geöffnet hat — und das Nachholen gescheiterter
 * Mails nach der Unterschrift (höchstens drei Versuche). Liefert true, wenn etwas gesendet wurde.
 */
export async function drMeldungenLauf(opt: { sender?: DrSender; wartenMinuten?: number } = {}): Promise<boolean> {
  await drSchema();
  const sender = opt.sender ?? drStandardSender;
  const warten = Math.max(0, opt.wartenMinuten ?? 10);
  let etwas = false;
  const offen = (await sqlPool`
    SELECT n.id FROM fiaon_dr_nda n
     WHERE ((n.mail_gast_am IS NULL AND n.mail_gast_versuche < 3) OR (n.mail_justin_am IS NULL AND n.mail_justin_versuche < 3))
       AND n.created_at < NOW() - INTERVAL '2 minutes' AND n.created_at > NOW() - INTERVAL '3 days'
     ORDER BY n.id LIMIT 10`) as any[];
  for (const o of offen) { const r = await drMailsNachUnterschrift(zahl(o.id), sender); etwas = etwas || r.gast || r.justin; }

  const faellig = (await sqlPool`
    SELECT id FROM fiaon_dr_tagesmeldung
     WHERE gesendet_am IS NULL AND versuche < 3 AND angelegt_am < NOW() - make_interval(mins => ${warten})
     ORDER BY id LIMIT 20`) as any[];
  const { AUFRUF_MELDUNG_AN } = await import("./fiaon-global-angebot-aufrufe");
  const { mailProtokoll } = await import("./fiaon-mail-log");
  for (const f of faellig) {
    // Erst beanspruchen (eine zweite Instanz nimmt dieselbe Zeile nicht), dann senden; scheitert es, wird die Zeile wieder frei.
    const [m] = (await sqlPool`
      UPDATE fiaon_dr_tagesmeldung SET gesendet_am = NOW(), versuche = versuche + 1
       WHERE id = ${f.id} AND gesendet_am IS NULL RETURNING id, gast_id, tag::text AS tag`) as any[];
    if (!m) continue;
    const g = await gastLesen(zahl(m.gast_id));
    if (!g) continue;
    const zeilen = (await sqlPool`
      SELECT p.created_at, p.art, d.titel, pr.buchstabe FROM fiaon_dr_protokoll p
        JOIN fiaon_dr_dokumente d ON d.id = p.dokument_id JOIN fiaon_dr_projekte pr ON pr.id = d.projekt_id
       WHERE p.gast_id = ${g.id} AND p.art IN ('dokument_angesehen', 'dokument_geladen')
         AND (p.created_at AT TIME ZONE 'Europe/Berlin')::date = ${m.tag}::date
       ORDER BY p.created_at`) as any[];
    const uhr = (d: Date) => new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }).format(d);
    const liste = zeilen.map((z: any) => `${uhr(new Date(z.created_at))}  ${z.buchstabe} · ${z.titel} (${z.art === "dokument_geladen" ? "heruntergeladen" : "angesehen"})`);
    const name = drVollName(g.angaben);
    const anzahl = new Set(zeilen.map((z: any) => `${z.buchstabe}|${z.titel}`)).size;
    const betreff = `Datenraum: ${name} liest — ${anzahl} ${anzahl === 1 ? "Unterlage" : "Unterlagen"} geöffnet`;
    const text = [
      `${name} hat heute im Datenraum „${g.raumTitel}“ Unterlagen geöffnet. Bis jetzt:`,
      liste.join("\n") || "(keine Einzelheiten)",
      "Diese Meldung kommt einmal am Tag je Gast. Alles Weitere steht im Protokoll im Chefbüro.",
    ];
    const r = await sender({
      an: AUFRUF_MELDUNG_AN, betreff, absender: "team", anrede: "Hallo Justin,",
      text: [...text, `Im Chefbüro: ${chefLink(g.partnerFirmaId)}`].join("\n\n"),
      baustein: {
        betreff: escHtml(betreff), preheader: escHtml(`${name} hat Unterlagen geöffnet`), titel: "Ihr Gast liest", persoenlich: true, du: true, bereich: "business", fussStartseite: true, kopfSatz: "Datenraum",
        rechtsSatz: RECHTS_SATZ, absaetze: ["Hallo Justin,", escHtml(text[0]), liste.map(escHtml).join("\n") || "(keine Einzelheiten)", escHtml(text[2])],
        knopf: { text: "Protokoll im Chefbüro", url: chefLink(g.partnerFirmaId) },
      },
    }).catch((e: unknown) => ({ ok: false, messageId: null, grund: e instanceof Error ? e.message : String(e) }));
    if (r.ok) { etwas = true; await sqlPool`UPDATE fiaon_dr_tagesmeldung SET fehler = NULL WHERE id = ${m.id}`; }
    else await sqlPool`UPDATE fiaon_dr_tagesmeldung SET gesendet_am = NULL, fehler = ${String(r.grund ?? "unbekannt").slice(0, 500)} WHERE id = ${m.id}`;
    await drProtokoll({ raumId: g.raumId, gastId: g.id, art: "tagesmeldung", detail: r.ok ? `${anzahl} Unterlagen` : `nicht gesendet: ${String(r.grund ?? "").slice(0, 200)}` });
    await mailProtokoll({ event: "datenraum_tagesmeldung", empfaenger: AUFRUF_MELDUNG_AN, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? null : (r.grund ?? null), payload: { gast: g.id, tag: m.tag, unterlagen: anzahl }, ausgeloestVon: "Datenraum", brevoMessageId: r.messageId });
  }
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
  return { ok: true, id, meldung: `Datenraum „${titel}“ angelegt.` };
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
  return { ok: true, meldung: "Gespeichert." };
}

export async function drProjektSpeichern(raumId: number, roh: any, wer: string, lauf: Lauf = sqlPool, projektId: number | null = null): Promise<Erg<{ id: number; buchstabe: string; neu: boolean }>> {
  await drSchema();
  const r = projektPruefen(roh);
  if (!r.ok) return nein(400, r.error);
  const p = r.wert;
  const [raum] = (await lauf`SELECT id FROM fiaon_dr_raeume WHERE id = ${raumId}`) as any[];
  if (!raum) return nein(404, "Diesen Datenraum gibt es nicht.");
  const schluessel = p.schluessel || p.titel.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "projekt";
  const [da] = projektId
    ? (await lauf`SELECT id, buchstabe FROM fiaon_dr_projekte WHERE id = ${projektId} AND raum_id = ${raumId} AND entfernt_am IS NULL`) as any[]
    : (await lauf`SELECT id, buchstabe FROM fiaon_dr_projekte WHERE raum_id = ${raumId} AND lower(schluessel) = lower(${schluessel}) AND entfernt_am IS NULL`) as any[];
  if (projektId && !da) return nein(404, "Dieses Projekt gibt es nicht.");
  if (da) {
    await lauf`
      UPDATE fiaon_dr_projekte SET titel = ${p.titel}, beschreibung = ${p.beschreibung || null}, nda_text = ${p.ndaText || null},
             geschuetzt = ${p.geschuetzt || null}, updated_at = NOW() WHERE id = ${da.id}`;
    await drProtokoll({ raumId, art: "projekt_gespeichert", detail: `${da.buchstabe} · ${p.titel}`, wer }, null, lauf);
    return { ok: true, id: zahl(da.id), buchstabe: String(da.buchstabe), neu: false };
  }
  const buchstabe = await naechsterBuchstabe(raumId, lauf);
  try {
    const [z] = (await lauf`
      INSERT INTO fiaon_dr_projekte (raum_id, buchstabe, schluessel, titel, beschreibung, nda_text, geschuetzt)
      VALUES (${raumId}, ${buchstabe}, ${schluessel}, ${p.titel}, ${p.beschreibung || null}, ${p.ndaText || null}, ${p.geschuetzt || null}) RETURNING id`) as any[];
    await drProtokoll({ raumId, art: "projekt_gespeichert", detail: `${buchstabe} · ${p.titel} (neu)`, wer }, null, lauf);
    return { ok: true, id: zahl(z.id), buchstabe, neu: true };
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
  return { ok: true, meldung: `Projekt ${p.buchstabe} entfernt — seine Unterlagen sind für Gäste nicht mehr sichtbar (bleiben in der Datenbank).` };
}

const zugangsLink = (code: string) => absoluteUrl(`/datenraum/zugang?c=${encodeURIComponent(code)}`);

export async function drGastEinladen(raumId: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ id: number; code: string; link: string; meldung: string }>> {
  await drSchema();
  const v = drVorbefuellungPruefen(roh);
  if (!v.ok) return nein(400, v.error);
  const [raum] = (await lauf`SELECT id, archiviert_am FROM fiaon_dr_raeume WHERE id = ${raumId}`) as any[];
  if (!raum) return nein(404, "Diesen Datenraum gibt es nicht.");
  if (raum.archiviert_am) return nein(409, "Der Raum ist archiviert.");
  const w = v.wert;
  const c = drCodeErzeugen();
  try {
    const [z] = (await lauf`
      INSERT INTO fiaon_dr_gaeste (raum_id, code_hash, code_hinweis, anrede, vorname, nachname, firma, funktion, strasse, plz, ort, land, email, telefon, eingeladen_von)
      VALUES (${raumId}, ${c.hash}, ${c.hinweis}, ${w.anrede}, ${w.vorname}, ${w.nachname}, ${w.firma}, ${w.funktion}, ${w.strasse}, ${w.plz}, ${w.ort},
              ${w.land}, ${w.email}, ${w.telefon}, ${wer}) RETURNING id`) as any[];
    await drProtokoll({ raumId, gastId: zahl(z.id), art: "gast_eingeladen", detail: `${drVollName(w)} · …${c.hinweis}`, wer }, null, lauf);
    return { ok: true, id: zahl(z.id), code: c.code, link: zugangsLink(c.code), meldung: `${drVollName(w)} ist eingeladen. Code und Link werden nur jetzt angezeigt.` };
  } catch (e: any) {
    if (String(e?.code) === "23505") return nein(409, "Diese E-Mail-Adresse ist in diesem Raum schon eingeladen — dort „Neuer Code“ nutzen.");
    throw e;
  }
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
  const nr = Number.isInteger(ein.nr) ? Number(ein.nr) : 0;
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
    meldung: `„${titel}“ ${alt ? "ersetzt die alte Fassung" : "abgelegt"}${sichtbar ? "" : " — noch unsichtbar"}.${vermerkGrund ? ` ${vermerkGrund}` : ""}`,
  };
}

export async function drDokumentAendern(id: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Erg<{ meldung: string }>> {
  await drSchema();
  const [d] = (await lauf`SELECT id, raum_id, titel, beschreibung, nr, sichtbar FROM fiaon_dr_dokumente WHERE id = ${id} AND entfernt_am IS NULL`) as any[];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht.");
  const titel = roh?.titel !== undefined ? zeile(roh.titel, 200) : String(d.titel);
  if (titel.length < 2) return nein(400, "Der Titel fehlt.");
  const beschreibung = roh?.beschreibung !== undefined ? zeile(roh.beschreibung, 400) || null : d.beschreibung;
  const nr = roh?.nr !== undefined && Number.isInteger(Number(roh.nr)) ? Number(roh.nr) : zahl(d.nr);
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

export async function drDokumentLesen(id: number): Promise<{ inhalt: Buffer; mime: string; dateiname: string } | null> {
  await drSchema();
  const [d] = (await sqlPool`SELECT inhalt, mime, dateiname FROM fiaon_dr_dokumente WHERE id = ${id}`) as any[];
  return d ? { inhalt: Buffer.from(d.inhalt), mime: String(d.mime), dateiname: String(d.dateiname) } : null;
}
export async function drNdaPdfLesen(ndaId: number): Promise<{ pdf: Buffer; dateiname: string } | null> {
  await drSchema();
  const [n] = (await sqlPool`SELECT pdf, unterzeichnet_am, angaben FROM fiaon_dr_nda WHERE id = ${ndaId}`) as any[];
  if (!n) return null;
  const a = json<{ gast?: DrGastAngaben }>(n.angaben, {});
  return { pdf: Buffer.from(n.pdf), dateiname: ndaDateiname(a.gast ?? { nachname: "Gast" }, new Date(n.unterzeichnet_am)) };
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
  const [r] = (await sqlPool`SELECT * FROM fiaon_dr_raeume WHERE id = ${id}`) as any[];
  if (!r) return null;
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
    SELECT id, gast_id, fassung, text_hash, projekt_ids, unterzeichnet_am, unterschrift_name, ip, siegel, mail_gast_am, mail_gast_fehler, mail_justin_am, mail_justin_fehler
      FROM fiaon_dr_nda WHERE raum_id = ${id} ORDER BY unterzeichnet_am DESC, id DESC`) as any[];
  const protokoll = (await sqlPool`
    SELECT p.id, p.created_at, p.art, p.detail, p.wer, p.ip, p.gast_id, p.dokument_id, g.vorname, g.nachname, d.titel AS dokument_titel
      FROM fiaon_dr_protokoll p LEFT JOIN fiaon_dr_gaeste g ON g.id = p.gast_id LEFT JOIN fiaon_dr_dokumente d ON d.id = p.dokument_id
     WHERE p.raum_id = ${id} ORDER BY p.id DESC LIMIT 250`) as any[];
  const buchstabeVon = new Map(projekte.map((p) => [zahl(p.id), String(p.buchstabe)]));
  return {
    raum: {
      id: zahl(r.id), titel: String(r.titel), partnerFirmaId: r.partner_firma_id != null ? zahl(r.partner_firma_id) : null,
      nda: json<DrNdaRaum>(r.nda_angaben, {}), erstelltAm: zeit(r.created_at), erstelltVon: r.erstellt_von ?? null, archiviertAm: zeit(r.archiviert_am),
    },
    projekte: projekte.map((p) => ({
      id: zahl(p.id), buchstabe: String(p.buchstabe), schluessel: String(p.schluessel), titel: String(p.titel), beschreibung: String(p.beschreibung ?? ""),
      ndaText: String(p.nda_text ?? ""), geschuetzt: String(p.geschuetzt ?? ""),
      dokumente: docs.filter((d) => zahl(d.projekt_id) === zahl(p.id)).map((d) => ({
        id: zahl(d.id), kennung: String(d.kennung), nr: zahl(d.nr), titel: String(d.titel), beschreibung: String(d.beschreibung ?? ""), dateiname: String(d.dateiname),
        quelle: d.quelle ?? null, typ: DATEI_TYP_TEXT(String(d.mime), String(d.dateiname)), groesse: zahl(d.groesse), seiten: d.seiten != null ? zahl(d.seiten) : null,
        sichtbar: !!d.sichtbar, vermerkMoeglich: d.vermerk_moeglich ?? null, vermerkGrund: d.vermerk_grund ?? null, hochgeladenVon: d.hochgeladen_von ?? null,
        erstelltAm: zeit(d.created_at), ansichten: zahl(d.ansichten), sha256Kurz: String(d.sha256).slice(0, 12),
      })),
    })),
    gaeste: gaeste.map((g) => {
      const meine = ndas.filter((n) => zahl(n.gast_id) === zahl(g.id));
      const n = meine[0];
      const status = g.gesperrt_am ? "gesperrt" : n ? "unterzeichnet" : g.angaben_am ? "angaben" : "eingeladen";
      return {
        id: zahl(g.id), anrede: String(g.anrede ?? ""), vorname: String(g.vorname), nachname: String(g.nachname), firma: String(g.firma ?? ""),
        email: String(g.email), telefon: String(g.telefon ?? ""), anschrift: [g.strasse, `${g.plz ?? ""} ${g.ort ?? ""}`.trim(), g.land].filter((x) => String(x ?? "").trim()).join(", "),
        codeHinweis: g.code_hinweis ? `…${g.code_hinweis}` : null, status, angabenAm: zeit(g.angaben_am), zuletztAm: zeit(g.zuletzt_am), eingeladenAm: zeit(g.created_at),
        gesperrtAm: zeit(g.gesperrt_am), gesperrtGrund: g.gesperrt_grund ?? null, ansichten: zahl(g.ansichten),
        ndas: meine.map((x) => ({
          id: zahl(x.id), unterzeichnetAm: zeit(x.unterzeichnet_am), fassung: String(x.fassung), hashKurz: String(x.text_hash).slice(0, 16),
          themen: idListe(x.projekt_ids).map((pid) => buchstabeVon.get(pid) ?? "?").join(", "), name: String(x.unterschrift_name), ip: x.ip ?? null,
          siegel: x.siegel ?? null, mailGast: x.mail_gast_am ? "gesendet" : x.mail_gast_fehler ? `offen: ${x.mail_gast_fehler}` : "offen",
          mailJustin: x.mail_justin_am ? "gesendet" : x.mail_justin_fehler ? `offen: ${x.mail_justin_fehler}` : "offen",
        })),
      };
    }),
    protokoll: protokoll.map((p) => ({
      id: zahl(p.id), am: zeit(p.created_at), art: String(p.art), artText: DR_PROTOKOLL_TEXT[String(p.art)] ?? String(p.art),
      gast: p.gast_id ? `${p.vorname ?? ""} ${p.nachname ?? ""}`.trim() || `Gast ${p.gast_id}` : null, dokument: p.dokument_titel ?? null,
      detail: p.detail ?? null, wer: p.wer ?? null, ip: p.ip ?? null,
    })),
    felder: DR_FELD_TEXT,
    fassung: NDA_FASSUNG, titel: NDA_TITEL,
  };
}
