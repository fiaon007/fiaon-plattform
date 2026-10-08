// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN — DIE EINE LOGIK (E-IT-C, 08.10.2026, Punkt 3 + 13)
//
// Grundsatz: Eine Datei ist ein Datensatz (fiaon_dokumente, art 'unterlage').
// Die Spalte an der Bestellung (bank_statement_pdf, id_card_pdf, schufa_pdf)
// ist nur noch die GEBUNDENE Akte-Fassung aller aktiven Dateien einer
// Kategorie. Dadurch bleiben ALLE Leser der Spalten unverändert: Karte-Tor,
// Kundenstufe, Rahmenweg, Analysen, Prüfung, Ansicht, Zusammenführung, DSGVO.
//
// Wer hier schreibt — und nur hier:
//   · Kundenbereich (/app, /dashboard) über server/routes/fiaon-unterlagen.ts
//   · /upload-kyc (Altweg, hängt jetzt an statt zu ersetzen)
//   · Akte (Mitarbeiter: Hinzufügen, Alles ersetzen, Entfernen, Geprüft)
//   · Chefbüro-Akte (Verwaltung, hinter dem Admin-Code)
//   · Beschaffte Auskunft (fiaon-auskunft-lieferung.ts) meldet ihre Fassung an
//     (akteFassungUebernehmen) — sie bleibt ihr eigener Weg mit Mail.
//
// Regeln und Texte: shared/fiaon-unterlagen.ts, Lesefehler: shared/fiaon-lesefehler.ts,
// Eingangsprüfung: server/lib/fiaon-datei-eingang.ts. DDL: db/migrations/099.
//
// ── BESTAND ───────────────────────────────────────────────────────────────
// Was VOR heute in einer Spalte lag, hat keine Zeile. Beim ersten Schreiben in
// eine Kategorie wird es als Datei „bisherige Unterlage" übernommen
// (bestandUebernehmen), damit „Hinzufügen" daran anhängt statt es zu
// verdrängen. Für alle auf einmal: scripts/it-c-einmal.ts (Trockenlauf).
// Schreibt jemand außerhalb dieses Moduls in eine Spalte (Zusammenführung,
// alte Wege), merkt das der Vergleich mit der zuletzt gebundenen Fassung
// (fiaon_unterlagen_akte) und übernimmt die geänderte Fassung als eine Datei.
//
// ── DER ANSTOSS ───────────────────────────────────────────────────────────
// Nach der letzten Datei einer Kategorie wartet der Server 45 s, dann läuft
// EINE Prüfung und EINE Analyse auf die neue Akte-Fassung und EINE Aufgabe an
// die Verwaltung entsteht — nicht je Datei. Der Zeitpunkt steht in der
// Datenbank (anstoss_faellig_am); ein Neustart verliert nichts, der Takt
// unterlagen_anstoss holt liegen Gebliebenes nach.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { DOKUMENTE, darfInhalt, type DokumentArt } from "./fiaon-dokumente";
import { dateiEingang, sha256Hex, pdfEntschluesseln, pdfVerschluesselt, typAmInhalt } from "./fiaon-datei-eingang";
import {
  UNTERLAGEN_GRENZEN, UNTERLAGEN_KATEGORIEN, STATUS_TEXT, kategorieInfo, istGebunden, unterartSauber, unterartLabel,
  kategorieStatus, monateLeiste, darfKundeEntfernen, ausweisBewerten, groesseText,
  type UnterlagenKategorie, type GebundeneKategorie, type DateiBefund, type AusweisUrteil,
  type UnterlagenDatei, type KategorieStand, type UnterlagenStand,
} from "@shared/fiaon-unterlagen";
import { lesefehlerSatz, type LeseKlasse } from "@shared/fiaon-lesefehler";
import { berlinToday } from "./fiaon-time";

type Lauf = typeof sqlPool;

/** Wer handelt — für Verlauf, Rechte und „von Ihnen / von FIAON". */
export interface Handelnder {
  art: "kunde" | "mitarbeiter" | "verwaltung" | "system";
  name: string;
  agentId?: number | null;
}

const ANSTOSS_NACH_MS = 45_000;

// ───────────────────────────────────────────────────────────────────────────
// Bereitschaft: die Spalten aus Migration 099
// ───────────────────────────────────────────────────────────────────────────
let bereit: Promise<boolean> | null = null;

/**
 * Sind Spalten und Tabelle da? Wenn nicht (lokaler Prüfstand ohne Migration),
 * werden sie EINMAL angelegt — dieselben Anweisungen wie db/migrations/099
 * (Abschrift), durch die DDL-Wache (prüft erst den Katalog, kurze Sperrfrist).
 */
export function unterlagenBereit(lauf: Lauf = sqlPool): Promise<boolean> {
  if (!bereit) {
    bereit = (async () => {
      const [z] = (await lauf`
        SELECT (SELECT count(*)::int FROM information_schema.columns
                 WHERE table_name = 'fiaon_dokumente'
                   AND column_name IN ('kategorie','unterart','notiz','seiten','lese_befund','zeitraum_von','zeitraum_bis','herkunft','agent_id','entfernt_am','entfernt_von','entfernt_grund')) AS spalten,
               to_regclass('public.fiaon_unterlagen_akte') IS NOT NULL AS akte`) as any[];
      if (Number(z?.spalten) === 12 && z?.akte) return true;
      await lauf.unsafe(`ALTER TABLE fiaon_dokumente
        ADD COLUMN IF NOT EXISTS kategorie TEXT, ADD COLUMN IF NOT EXISTS unterart TEXT, ADD COLUMN IF NOT EXISTS notiz TEXT,
        ADD COLUMN IF NOT EXISTS seiten INTEGER, ADD COLUMN IF NOT EXISTS lese_befund JSONB, ADD COLUMN IF NOT EXISTS zeitraum_von DATE,
        ADD COLUMN IF NOT EXISTS zeitraum_bis DATE, ADD COLUMN IF NOT EXISTS herkunft TEXT, ADD COLUMN IF NOT EXISTS agent_id BIGINT,
        ADD COLUMN IF NOT EXISTS entfernt_am TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS entfernt_von TEXT, ADD COLUMN IF NOT EXISTS entfernt_grund TEXT`);
      await lauf.unsafe(`CREATE INDEX IF NOT EXISTS fiaon_dokumente_unterlage_idx ON fiaon_dokumente (person_id, kategorie, hochgeladen_am)
        WHERE art = 'unterlage' AND entfernt_am IS NULL AND geloescht_am IS NULL`);
      await lauf.unsafe(`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dokumente_unterlage_einmal_idx ON fiaon_dokumente (person_id, kategorie, doc_hash)
        WHERE art = 'unterlage' AND entfernt_am IS NULL AND geloescht_am IS NULL`);
      await lauf.unsafe(`CREATE TABLE IF NOT EXISTS fiaon_unterlagen_akte (
        person_id BIGINT NOT NULL, kategorie TEXT NOT NULL, ref TEXT, akte_hash TEXT, dateien INTEGER NOT NULL DEFAULT 0,
        gebunden_am TIMESTAMPTZ, anstoss_faellig_am TIMESTAMPTZ, anstoss_lauf_am TIMESTAMPTZ, anstoss_von TEXT, anstoss_fehler TEXT,
        letzter_upload_am TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (person_id, kategorie))`);
      await lauf.unsafe(`CREATE INDEX IF NOT EXISTS fiaon_unterlagen_akte_faellig_idx ON fiaon_unterlagen_akte (anstoss_faellig_am) WHERE anstoss_faellig_am IS NOT NULL`);
      return true;
    })().catch((e) => {
      console.error("[UNTERLAGEN] Spalten nicht bereit:", String(e?.message || e).slice(0, 200));
      bereit = null;
      return false;
    });
  }
  return bereit;
}

/** Nur für Prüfstände: die Bereitschaft neu prüfen. */
export function unterlagenBereitVergessen(): void { bereit = null; }

// ───────────────────────────────────────────────────────────────────────────
// Person, Träger, Spalten
// ───────────────────────────────────────────────────────────────────────────
const spalteVon = (k: GebundeneKategorie): string => DOKUMENTE.find((d) => d.art === k)!.spalte;

/** Die Person zu einer Bestellung — fehlt die Bindung, wird sie nachgeholt (P1-C). */
export async function personZuRef(ref: string, lauf: Lauf = sqlPool): Promise<number | null> {
  const [a] = (await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!a) return null;
  if (a.person_id != null) return Number(a.person_id);
  try {
    const { bindePersonAnAntrag } = await import("../fiaon-person-model");
    await bindePersonAnAntrag(ref);
  } catch (e) { console.error("[UNTERLAGEN] Person binden:", String((e as Error)?.message || e).slice(0, 160)); }
  const [b] = (await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  return b?.person_id != null ? Number(b.person_id) : null;
}

/**
 * Die Bestellung, die die Akte-Fassung trägt — dieselbe Reihenfolge wie die
 * Akte (dokumentStand) und die beschaffte Auskunft: bezahlte Paketbestellung
 * zuerst. Der Kundenweg schrieb bisher an die Sitzungs-ref (oft die
 * Auskunftsbestellung) — daher die „gespaltenen Fassungen" bei drei Personen.
 */
export async function traegerRef(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [t] = (await lauf`
    SELECT ref FROM fiaon_applications
     WHERE person_id = ${personId} AND merged_into IS NULL AND gdpr_deleted_at IS NULL
     ORDER BY (payment_status = 'paid') DESC,
              (COALESCE(type, '') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%') DESC,
              created_at DESC LIMIT 1`) as any[];
  return t?.ref ? String(t.ref) : null;
}

interface SpaltenLage {
  traeger: string | null;
  /** Je Kategorie: Bestellungen mit Inhalt (Länge > 0), Träger zuerst. */
  inhalte: Record<GebundeneKategorie, { ref: string; bytes: number; am: string | null }[]>;
  erneut: { kontoauszug: boolean; ausweis: boolean };
  kycFreigabeAm: string | null;
  schufaFreigabeAm: string | null;
  refs: string[];
}

async function spaltenLage(personId: number, lauf: Lauf): Promise<SpaltenLage> {
  const traeger = await traegerRef(personId, lauf);
  const zeilen = (await lauf`
    SELECT ref, LENGTH(bank_statement_pdf) AS g_k, LENGTH(id_card_pdf) AS g_a, LENGTH(schufa_pdf) AS g_s,
           COALESCE(documents_uploaded_at, updated_at) AS am,
           COALESCE(reupload_bank_statement, FALSE) AS re_k, COALESCE(reupload_id_card, FALSE) AS re_a,
           CASE WHEN kyc_status = 'approved' THEN admin_reviewed_at END AS kyc_am,
           CASE WHEN schufa_status = 'approved' THEN admin_reviewed_at END AS schufa_am,
           merged_into
      FROM fiaon_applications
     WHERE person_id = ${personId} AND gdpr_deleted_at IS NULL
     ORDER BY (ref = ${traeger ?? ""}) DESC, (merged_into IS NULL) DESC, created_at DESC`) as any[];
  const inhalte: SpaltenLage["inhalte"] = { kontoauszug: [], ausweis: [], schufa: [] };
  let reK = false, reA = false; let kyc: string | null = null; let schufa: string | null = null;
  for (const z of zeilen) {
    const am = z.am ? new Date(z.am).toISOString() : null;
    if (Number(z.g_k) > 0) inhalte.kontoauszug.push({ ref: String(z.ref), bytes: Number(z.g_k), am });
    if (Number(z.g_a) > 0) inhalte.ausweis.push({ ref: String(z.ref), bytes: Number(z.g_a), am });
    if (Number(z.g_s) > 0) inhalte.schufa.push({ ref: String(z.ref), bytes: Number(z.g_s), am });
    if (z.merged_into == null) { reK = reK || !!z.re_k; reA = reA || !!z.re_a; }
    const k = z.kyc_am ? new Date(z.kyc_am).toISOString() : null;
    const s = z.schufa_am ? new Date(z.schufa_am).toISOString() : null;
    if (k && (!kyc || k > kyc)) kyc = k;
    if (s && (!schufa || s > schufa)) schufa = s;
  }
  return { traeger, inhalte, erneut: { kontoauszug: reK, ausweis: reA }, kycFreigabeAm: kyc, schufaFreigabeAm: schufa, refs: zeilen.map((z) => String(z.ref)) };
}

// ───────────────────────────────────────────────────────────────────────────
// Die Zeilen
// ───────────────────────────────────────────────────────────────────────────
interface DateiZeile {
  id: number; kategorie: UnterlagenKategorie; unterart: string | null; dateiname: string; mime: string; bytes: number;
  seiten: number | null; hochgeladen_am: string; quelle: string; herkunft: string | null; notiz: string | null;
  lese_befund: DateiBefund | null; zeitraum_von: string | null; zeitraum_bis: string | null; geprueft_am: string | null;
  entfernt_am: string | null; entfernt_von: string | null; entfernt_grund: string | null; agent_id: number | null; doc_hash: string;
  /** Länge des gespeicherten Inhalts — 0, wenn der Kunde die Datei entfernt hat (Inhalt gelöscht). */
  inhalt_n: number;
}

function befundLesen(v: any): DateiBefund | null {
  if (!v) return null;
  if (typeof v === "string") { try { return JSON.parse(v); } catch { return null; } }
  return v as DateiBefund;
}
const isoTag = (v: any): string | null => (v ? new Date(v).toISOString().slice(0, 10) : null);

async function zeilenLaden(personId: number, lauf: Lauf, mitEntfernten = false): Promise<DateiZeile[]> {
  const rows = (await lauf`
    SELECT id, kategorie, unterart, dateiname, mime, bytes, seiten, hochgeladen_am, quelle, herkunft, notiz, lese_befund,
           zeitraum_von, zeitraum_bis, geprueft_am, entfernt_am, entfernt_von, entfernt_grund, agent_id, doc_hash,
           LENGTH(inhalt) AS inhalt_n
      FROM fiaon_dokumente
     WHERE person_id = ${personId} AND art = 'unterlage' AND geloescht_am IS NULL
       AND (${mitEntfernten} OR entfernt_am IS NULL)
     ORDER BY hochgeladen_am ASC, id ASC`) as any[];
  return rows.map((r) => ({
    id: Number(r.id), kategorie: String(r.kategorie) as UnterlagenKategorie, unterart: r.unterart ?? null, dateiname: String(r.dateiname),
    mime: String(r.mime), bytes: Number(r.bytes), seiten: r.seiten != null ? Number(r.seiten) : null,
    hochgeladen_am: new Date(r.hochgeladen_am).toISOString(), quelle: String(r.quelle), herkunft: r.herkunft ?? null, notiz: r.notiz ?? null,
    lese_befund: befundLesen(r.lese_befund), zeitraum_von: isoTag(r.zeitraum_von), zeitraum_bis: isoTag(r.zeitraum_bis),
    geprueft_am: r.geprueft_am ? new Date(r.geprueft_am).toISOString() : null,
    entfernt_am: r.entfernt_am ? new Date(r.entfernt_am).toISOString() : null, entfernt_von: r.entfernt_von ?? null,
    entfernt_grund: r.entfernt_grund ?? null, agent_id: r.agent_id != null ? Number(r.agent_id) : null, doc_hash: String(r.doc_hash),
    inhalt_n: Number(r.inhalt_n ?? 0),
  }));
}

interface AkteZeile {
  ref: string | null; akte_hash: string | null; dateien: number; gebunden_am: string | null;
  anstoss_faellig_am: string | null; anstoss_lauf_am: string | null; anstoss_von: string | null; anstoss_fehler: string | null;
}
async function akteLaden(personId: number, lauf: Lauf): Promise<Record<string, AkteZeile>> {
  const rows = (await lauf`SELECT * FROM fiaon_unterlagen_akte WHERE person_id = ${personId}`) as any[];
  const aus: Record<string, AkteZeile> = {};
  for (const r of rows) {
    aus[String(r.kategorie)] = {
      ref: r.ref ?? null, akte_hash: r.akte_hash ?? null, dateien: Number(r.dateien || 0),
      gebunden_am: r.gebunden_am ? new Date(r.gebunden_am).toISOString() : null,
      anstoss_faellig_am: r.anstoss_faellig_am ? new Date(r.anstoss_faellig_am).toISOString() : null,
      anstoss_lauf_am: r.anstoss_lauf_am ? new Date(r.anstoss_lauf_am).toISOString() : null,
      anstoss_von: r.anstoss_von ?? null, anstoss_fehler: r.anstoss_fehler ?? null,
    };
  }
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// Der Stand — eine Antwort für Kunde und Office
// ───────────────────────────────────────────────────────────────────────────
// Die Antwort-Typen (UnterlagenDatei, KategorieStand, UnterlagenStand) wohnen in shared/fiaon-unterlagen.ts —
// Server und Oberfläche lesen dieselbe Form.

function befundSatz(b: DateiBefund | null, anrede: "sie" | "du", kategorie: UnterlagenKategorie, selbstEntfernen?: boolean): string | null {
  if (!b || b.erkannt !== false || !b.aehnlich) return null;
  const was = b.aehnlich === "kontoauszug" ? "ein Kontoauszug" : b.aehnlich === "ausweis" ? "ein Ausweisdokument" : "eine Bonitätsauskunft";
  // E-IT-C Nachbesserung: „selbst entfernen" nur versprechen, wo der Knopf auch da ist.
  return lesefehlerSatz("falsche_art", anrede, { erkannt: was, kategorie: kategorieInfo(kategorie).kurz, selbstEntfernen: selbstEntfernen ?? null });
}

function befundText(b: DateiBefund | null): string | null {
  if (!b) return null;
  const teile: string[] = [];
  if (b.typ === "pdf") {
    teile.push(b.fotoseiten > 0 && b.textseiten === 0 ? `Scan/Foto, ${b.seiten} Seite${b.seiten === 1 ? "" : "n"}` : b.fotoseiten > 0 ? `${b.textseiten} Textseiten, ${b.fotoseiten} Fotoseiten` : `Text, ${b.seiten} Seite${b.seiten === 1 ? "" : "n"}`);
    if (b.geschuetzt) teile.push("von der Bank geschützt (nur Rechteschutz)");
  } else {
    teile.push(`Foto${b.ausTyp ? ` (aus ${String(b.ausTyp).toUpperCase()})` : ""}${b.verkleinert ? `, ${b.verkleinert.vonKb} → ${b.verkleinert.aufKb} KB` : ""}`);
  }
  // Der Zeitraum steht schon an der Datei (zeitraumVon/-Bis) — hier nicht ein zweites Mal.
  if (b.ausweis) teile.push(b.ausweis.pass ? "Reisepass erkannt" : b.ausweis.aufenthaltstitel ? "Aufenthaltstitel erkannt" : b.ausweis.vorne && b.ausweis.hinten ? "beide Seiten erkannt" : b.ausweis.vorne ? "Vorderseite erkannt" : b.ausweis.hinten ? "Rückseite erkannt" : "");
  return teile.filter(Boolean).join(" · ");
}
const tagText = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}`;

function alsDatei(z: DateiZeile, sicht: "kunde" | "office", verwaltungAm: string | null): UnterlagenDatei {
  const darfEntfernen = sicht === "kunde"
    ? darfKundeEntfernen({ quelle: z.quelle, herkunft: z.herkunft, geprueftAm: z.geprueft_am, hochgeladenAm: z.hochgeladen_am, verwaltungGeprueftAm: verwaltungAm, entferntAm: z.entfernt_am })
    : !z.entfernt_am;
  return {
    id: z.id, kategorie: z.kategorie, unterart: z.unterart, unterartLabel: unterartLabel(z.kategorie, z.unterart),
    name: z.dateiname, kb: Math.max(1, Math.round(z.bytes / 1024)), groesse: groesseText(z.bytes), seiten: z.seiten ?? z.lese_befund?.seiten ?? null,
    am: z.hochgeladen_am, von: z.quelle === "kunde" ? "sie" : "fiaon", herkunft: z.herkunft,
    // E-IT-C Nachbesserung: Die Notiz des Teams ist intern — der Kunde liest nur seine eigene.
    notiz: sicht === "kunde" && z.quelle !== "kunde" ? null : z.notiz,
    zeitraumVon: z.zeitraum_von, zeitraumBis: z.zeitraum_bis,
    satz: befundSatz(z.lese_befund, sicht === "kunde" ? "sie" : "du", z.kategorie, sicht === "kunde" ? darfEntfernen : undefined),
    befundText: sicht === "office" ? befundText(z.lese_befund) : null,
    geprueft: !!z.geprueft_am,
    darfEntfernen,
    ...(sicht === "office" && z.entfernt_am ? { entferntAm: z.entfernt_am, entferntVon: z.entfernt_von, entferntGrund: z.entfernt_grund, inhaltGeloescht: z.inhalt_n === 0 } : {}),
  };
}

async function letzteAnalyse(tabelle: "fiaon_kontoauszug_analysen" | "fiaon_schufa_analysen", refs: string[], lauf: Lauf): Promise<any | null> {
  if (!refs.length) return null;
  try {
    const sp = tabelle === "fiaon_kontoauszug_analysen" ? "zeitraum_von, zeitraum_bis," : "NULL::date AS zeitraum_von, NULL::date AS zeitraum_bis,";
    const [r] = (await lauf.unsafe(`SELECT status, ${sp} fehler, created_at FROM ${tabelle} WHERE ref = ANY($1) ORDER BY created_at DESC LIMIT 1`, [refs])) as any[];
    return r ?? null;
  } catch { return null; }
}

async function urteileJeArt(refs: string[], lauf: Lauf): Promise<Record<string, { urteil: any; am: string }>> {
  if (!refs.length) return {};
  try {
    const rows = (await lauf`SELECT art, urteil, updated_at FROM fiaon_dokument_pruefungen WHERE ref = ANY(${refs}) ORDER BY updated_at DESC`) as any[];
    const aus: Record<string, { urteil: any; am: string }> = {};
    for (const r of rows) {
      if (aus[String(r.art)]) continue;
      let u = r.urteil;
      if (typeof u === "string") { try { u = JSON.parse(u); } catch { u = null; } }
      if (u) aus[String(r.art)] = { urteil: u, am: new Date(r.updated_at).toISOString() };
    }
    return aus;
  } catch { return {}; }
}

/**
 * Ist die Bonitätsauskunft der Person schon geprüft (schufa_status approved) oder ausgewertet
 * (jüngste Analyse fertig, ohne Beanstandung)? Dann hängt der Kunde dort nichts mehr an — sonst
 * würde die Auswertung auf eine Mischdatei neu gerechnet, und ein Löschantrag-Vermerk an der
 * bisherigen Auswertung ginge verloren (E-IT-C Nachbesserung; dieselbe Folge wie fiaon-bonitaet-status
 * darfHochladen = false bei „geprueft"/„ausgewertet").
 */
export async function auskunftAbgeschlossen(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  try {
    const [z] = (await lauf`
      SELECT bool_or(schufa_status = 'approved' AND LENGTH(schufa_pdf) > 0) AS geprueft,
             bool_or(schufa_status IN ('changes_requested', 'rejected', 'requested') AND LENGTH(schufa_pdf) > 0) AS beanstandet,
             array_agg(ref) AS refs
        FROM fiaon_applications WHERE person_id = ${personId} AND gdpr_deleted_at IS NULL`) as any[];
    if (z?.geprueft) return true;
    if (z?.beanstandet) return false;
    const refs: string[] = (z?.refs ?? []).filter(Boolean).map(String);
    const sa = await letzteAnalyse("fiaon_schufa_analysen", refs, lauf);
    if (sa?.status !== "fertig") return false;
    const u = (await urteileJeArt(refs, lauf)).schufa?.urteil;
    return !(u && u.pruefbar !== false && u.erkannt === false);
  } catch { return false; }
}

/**
 * Der Stand je Kategorie. Liest NIE Dateiinhalte — nur Längen, Befunde, Urteile.
 * `sicht` entscheidet über Anrede, Rechte („Entfernen") und ob entfernte Dateien
 * und interne Befunde mitkommen.
 */
export async function unterlagenStand(personId: number, sicht: "kunde" | "office", lauf: Lauf = sqlPool): Promise<UnterlagenStand> {
  await unterlagenBereit(lauf);
  const [lage, zeilen, akte] = await Promise.all([
    spaltenLage(personId, lauf), zeilenLaden(personId, lauf, sicht === "office"), akteLaden(personId, lauf).catch(() => ({} as Record<string, AkteZeile>)),
  ]);
  const [ka, sa, urteile] = await Promise.all([
    letzteAnalyse("fiaon_kontoauszug_analysen", lage.refs, lauf), letzteAnalyse("fiaon_schufa_analysen", lage.refs, lauf), urteileJeArt(lage.refs, lauf),
  ]);
  const aktiv = zeilen.filter((z) => !z.entfernt_am);
  const heute = berlinToday();
  const jetzt = Date.now();
  const beschaffung = aktiv.some((z) => z.kategorie === "schufa" && z.herkunft === "beschaffung");
  const auskunftFertig = sicht === "kunde" && !beschaffung ? await auskunftAbgeschlossen(personId, lauf) : false;
  const titelUnterWeitere = aktiv.some((z) => z.kategorie === "weitere" && z.unterart === "aufenthaltstitel");

  const kategorien: KategorieStand[] = UNTERLAGEN_KATEGORIEN.map((info) => {
    const k = info.kategorie;
    const eigene = aktiv.filter((z) => z.kategorie === k);
    // Kontoauszüge in der Reihenfolge der Monate (wie die Akte-Fassung gebunden wird), sonst nach Upload.
    if (k === "kontoauszug") eigene.sort((x, y) => (x.zeitraum_von ?? "9999").localeCompare(y.zeitraum_von ?? "9999") || x.hochgeladen_am.localeCompare(y.hochgeladen_am));
    const a = akte[k];
    const verwaltungAm = k === "schufa" ? lage.schufaFreigabeAm : k === "weitere" ? null : lage.kycFreigabeAm;
    const dateien = eigene.map((z) => alsDatei(z, sicht, verwaltungAm));
    // Bestand: Inhalt in der Spalte, aber (noch) keine Zeile — als „bisherige Unterlage" zeigen.
    const spalte = istGebunden(k) ? lage.inhalte[k] : [];
    if (istGebunden(k) && eigene.length === 0 && spalte.length > 0) {
      const s = spalte[0];
      dateien.push({
        id: null, kategorie: k, unterart: null, unterartLabel: null, name: "Bisherige Unterlage", kb: Math.max(1, Math.round(s.bytes / 1024)),
        groesse: groesseText(s.bytes), seiten: null, am: s.am ?? new Date().toISOString(), von: "sie", herkunft: "bestand", notiz: null,
        zeitraumVon: null, zeitraumBis: null, satz: null, befundText: sicht === "office" ? "Fassung aus der Zeit vor dem 08.10.2026" : null,
        geprueft: !!verwaltungAm, darfEntfernen: false,
      });
    }
    // E-IT-C Nachbesserung: der JÜNGSTE Upload — nicht der letzte der Anzeige (Kontoauszüge stehen nach Zeitraum).
    // Sonst galt ein Juli, nach der Freigabe zum September nachgeladen, als „von der Verwaltung geprüft".
    const letzterUpload = eigene.length ? eigene.reduce((m, z) => (z.hochgeladen_am > m ? z.hochgeladen_am : m), "") : (spalte[0]?.am ?? null);
    const nachUpload = (am: string | null | undefined) => !!am && (!letzterUpload || am >= letzterUpload);
    const alleGeprueft = eigene.length > 0 && eigene.every((z) => !!z.geprueft_am);
    const verwaltungGeprueft = alleGeprueft || (!!verwaltungAm && nachUpload(verwaltungAm));
    const faellig = !!a?.anstoss_faellig_am;
    const laufFrisch = !!a?.anstoss_lauf_am && jetzt - new Date(a.anstoss_lauf_am).getTime() < 5 * 60_000;
    const analyseRoh = k === "kontoauszug" ? ka : k === "schufa" ? sa : null;
    const analyseAm = analyseRoh?.created_at ? new Date(analyseRoh.created_at).toISOString() : null;
    const analyseAktuell = !!analyseRoh && nachUpload(analyseAm);
    const liestGerade = faellig || (laufFrisch && (k === "kontoauszug" || k === "schufa") && (!analyseAktuell || analyseRoh?.status === "laeuft"));
    const u = urteile[k];
    const urteilAktuell = !!u && nachUpload(u.am);

    // Zeiträume für die Monatsleiste: Analyse, dann Prüfung, dann je Datei.
    const zeitraeume: { von: string | null; bis: string | null }[] = [];
    if (k === "kontoauszug") {
      if (analyseAktuell && analyseRoh?.status === "fertig") zeitraeume.push({ von: isoTag(analyseRoh.zeitraum_von), bis: isoTag(analyseRoh.zeitraum_bis) });
      if (urteilAktuell && u.urteil?.zeitraumVon) zeitraeume.push({ von: u.urteil.zeitraumVon, bis: u.urteil.zeitraumBis });
      for (const z of eigene) if (z.zeitraum_von) zeitraeume.push({ von: z.zeitraum_von, bis: z.zeitraum_bis });
    }
    const monate = k === "kontoauszug" && dateien.length ? monateLeiste(zeitraeume, heute) : undefined;
    const tage = analyseAktuell && analyseRoh?.zeitraum_von && analyseRoh?.zeitraum_bis
      ? Math.round((new Date(analyseRoh.zeitraum_bis).getTime() - new Date(analyseRoh.zeitraum_von).getTime()) / 86_400_000) : null;

    // Ausweis: die feste Regel über ALLE Dateien (gewählte Art + Textbefund je Datei).
    let ausweis: AusweisUrteil | null = null;
    if (k === "ausweis" && eigene.length) {
      const text = eigene.reduce<{ pass: boolean; vorne: boolean; hinten: boolean; aufenthaltstitel: boolean } | null>((acc, z) => {
        const b = z.lese_befund?.ausweis; if (!b) return acc;
        const x = acc ?? { pass: false, vorne: false, hinten: false, aufenthaltstitel: false };
        return { pass: x.pass || b.pass, vorne: x.vorne || b.vorne, hinten: x.hinten || b.hinten, aufenthaltstitel: x.aufenthaltstitel || b.aufenthaltstitel };
      }, null);
      ausweis = ausweisBewerten({
        erklaert: eigene.map((z) => z.unterart), text, seiten: eigene.reduce((n, z) => n + (z.seiten ?? z.lese_befund?.seiten ?? 1), 0),
        aufenthaltstitelUnterWeitere: titelUnterWeitere,
      });
    }

    const pruefung = k === "ausweis" && ausweis
      ? { erkannt: ausweis.erkannt, vollstaendig: ausweis.vollstaendig, hinweisKunde: ausweis.hinweisKunde, hinweisIntern: ausweis.hinweisIntern }
      : urteilAktuell ? { erkannt: u.urteil.erkannt ?? null, vollstaendig: u.urteil.vollstaendig ?? null, hinweisKunde: u.urteil.hinweisKunde ?? null, hinweisIntern: u.urteil.hinweisIntern ?? null } : null;
    const fehltMonate = (monate ?? []).filter((m) => !m.da).map((m) => m.label);
    const ergebnis = kategorieStatus({
      kategorie: k, dateien: dateien.length,
      erneutAngefordert: k === "kontoauszug" ? lage.erneut.kontoauszug : k === "ausweis" ? lage.erneut.ausweis : false,
      liestGerade, verwaltungGeprueft, pruefung, pruefungSicher: k === "ausweis" && !!ausweis,
      analyse: analyseAktuell ? { status: String(analyseRoh.status), tage, fehlerKunde: analyseRoh.status === "unlesbar" ? analyseRoh.fehler : null, fehlerIntern: analyseRoh.status === "fehler" ? `technisch: ${String(analyseRoh.fehler || "").slice(0, 120)}` : null } : null,
      dateiSaetze: dateien.map((d) => d.satz).filter((x): x is string => !!x),
      fehlendeMonate: fehltMonate,
      nurAufenthaltstitel: k === "ausweis" && titelUnterWeitere,
      nurBestand: istGebunden(k) && dateien.length > 0 && dateien.every((d) => d.herkunft === "bestand"),
    });

    // Darf hinzugefügt werden? Grenze je Kategorie; beschaffte Auskunft nur über das Team.
    let sperrSatz: string | null = null;
    if (eigene.length >= UNTERLAGEN_GRENZEN.dateienJeKategorie) sperrSatz = lesefehlerSatz("zu_viele", sicht === "kunde" ? "sie" : "du", { kategorie: info.kurz, anzahl: UNTERLAGEN_GRENZEN.dateienJeKategorie });
    else if (sicht === "kunde" && k === "schufa" && beschaffung) sperrSatz = lesefehlerSatz("beschafft", "sie");
    else if (sicht === "kunde" && k === "schufa" && auskunftFertig) sperrSatz = lesefehlerSatz("ausgewertet", "sie");

    let akteHinweis: string | null = null;
    if (sicht === "office" && a?.anstoss_fehler) akteHinweis = a.anstoss_fehler;

    const entfernte = sicht === "office" ? zeilen.filter((z) => z.kategorie === k && !!z.entfernt_am).map((z) => alsDatei(z, "office", verwaltungAm)) : undefined;
    return {
      kategorie: k, titel: info.titel, kurz: info.kurz, pflicht: info.pflicht,
      hinweis: sicht === "kunde" ? info.hinweisKunde : info.hinweisOffice,
      status: ergebnis.status, statusText: sicht === "kunde" ? STATUS_TEXT[ergebnis.status].kunde : STATUS_TEXT[ergebnis.status].office,
      satz: sicht === "kunde" ? ergebnis.satzKunde : (ergebnis.satzOffice ?? ergebnis.satzKunde),
      // E-IT-C Nachbesserung: EINE Botschaft — liegt der Auszug vor, keine Leiste mit „September – fehlt" darunter.
      dateien, ...(entfernte ? { entfernte } : {}), ...(monate && ergebnis.status !== "liegt_vor" ? { monate } : {}),
      darfHinzufuegen: !sperrSatz, sperrSatz, liestGerade,
      erneutAngefordert: k === "kontoauszug" ? lage.erneut.kontoauszug : k === "ausweis" ? lage.erneut.ausweis : false,
      ...(sicht === "office" ? { ausweis, akteHinweis } : {}),
      geprueft: verwaltungGeprueft,
    };
  });
  return {
    personId, ref: lage.traeger, kategorien,
    grenzen: { mbJeDatei: UNTERLAGEN_GRENZEN.mbJeDatei, dateienJeKategorie: UNTERLAGEN_GRENZEN.dateienJeKategorie },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Bestand übernehmen, binden, Fassung anmelden
// ───────────────────────────────────────────────────────────────────────────

/**
 * Inhalte der Spalten, die (noch) keine Zeile sind, als Dateien übernehmen.
 * · Keine Akte-Zeile → Bestand aus der Zeit vor dem 08.10.2026 (herkunft 'bestand').
 * · Akte-Zeile da, Spalte aber anders als zuletzt gebunden → jemand außerhalb hat
 *   geschrieben (Zusammenführung, Beschaffung): Die neue Fassung wird EINE Datei
 *   (herkunft 'fremd' bzw. wie übergeben), die zuvor gebundenen Dateien sind in
 *   ihr aufgegangen und werden mit Grund entfernt (nicht gelöscht).
 * Rückgabe: Zahl der übernommenen Fassungen.
 */
export async function bestandUebernehmen(
  personId: number, k: GebundeneKategorie, lauf: Lauf = sqlPool,
  opt: { herkunft?: string; quelle?: "kunde" | "mitarbeiter"; agentId?: number | null; name?: string } = {},
): Promise<number> {
  const spalte = spalteVon(k);
  const [akte] = (await lauf`SELECT akte_hash, gebunden_am FROM fiaon_unterlagen_akte WHERE person_id = ${personId} AND kategorie = ${k}`) as any[];
  const quellen = (await lauf.unsafe(
    `SELECT ref, encode(sha256(${spalte}), 'hex') AS h, LENGTH(${spalte}) AS n,
            CASE WHEN substring(${spalte} from 1 for 4) = '\\x25504446'::bytea THEN 'pdf' ELSE 'jpg' END AS typ,
            COALESCE(documents_uploaded_at, updated_at, NOW()) AS am,
            CASE WHEN kyc_status = 'approved' THEN admin_reviewed_at END AS kyc_am
       FROM fiaon_applications
      WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND LENGTH(${spalte}) > 0
      ORDER BY (merged_into IS NULL) DESC, created_at DESC`, [personId],
  )) as any[];
  // E-IT-C Nachbesserung: Die gebundene Fassung einer Person, die in diese aufgegangen ist
  // (Zusammenführung), ist durch ihre — mitgewanderten — Zeilen vertreten. Sie als „fremd"
  // zu übernehmen, entfernte die Dateien des Gewinners und doppelte die Seiten.
  const vertreten = new Set<string>(((await lauf`
    SELECT akte_hash FROM fiaon_unterlagen_akte
     WHERE kategorie = ${k} AND akte_hash IS NOT NULL
       AND person_id IN (SELECT id FROM fiaon_persons WHERE merged_into_person_id = ${personId})`) as any[]).map((r) => String(r.akte_hash)));
  let neu = 0;
  for (const q of quellen) {
    if (akte?.akte_hash && q.h === akte.akte_hash) continue; // unsere eigene Bindung
    if (vertreten.has(q.h)) continue; // Bindung einer zusammengeführten Person — ihre Teile sind Zeilen
    const [schon] = (await lauf`SELECT id FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k}
                                   AND doc_hash = ${q.h} AND geloescht_am IS NULL LIMIT 1`) as any[];
    if (schon) continue;
    const fremd = !!akte?.akte_hash;
    const herkunft = opt.herkunft ?? (fremd ? "fremd" : "bestand");
    if (fremd && akte?.gebunden_am) {
      // Was in der vorigen Bindung steckte, ist in der neuen Fassung aufgegangen (oder von ihr ersetzt).
      await lauf`UPDATE fiaon_dokumente SET entfernt_am = NOW(), entfernt_von = ${opt.name ?? "System"},
                        entfernt_grund = ${herkunft === "beschaffung" ? "durch die von FIAON beschaffte Auskunft ersetzt" : "in einer außerhalb geänderten Akte-Fassung aufgegangen"}
                  WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL
                    AND hochgeladen_am <= ${akte.gebunden_am}`;
    }
    // Mit Datum — eine Person mit zwei Bestandsfassungen sieht sonst zweimal denselben Namen.
    const tag = (() => { const d = new Date(q.am); return Number.isNaN(d.getTime()) ? "" : `-${d.toISOString().slice(0, 10)}`; })();
    const name = herkunft === "beschaffung" ? `beschaffte-auskunft${tag}.${q.typ}` : `bisherige-${k}${tag}.${q.typ}`;
    const ergebnis = (await lauf.unsafe(
      `INSERT INTO fiaon_dokumente (person_id, ref, art, kategorie, dateiname, mime, bytes, inhalt, quelle, herkunft, doc_hash, hochgeladen_am, geprueft_am, agent_id)
       SELECT $1, a.ref, 'unterlage', $2, $3, $4, LENGTH(a.${spalte}), a.${spalte}, $5, $6, $7, $8, $9, $10
         FROM fiaon_applications a WHERE a.ref = $11
       ON CONFLICT DO NOTHING RETURNING id`,
      [personId, k, name, q.typ === "pdf" ? "application/pdf" : "image/jpeg", opt.quelle ?? (herkunft === "beschaffung" ? "mitarbeiter" : "kunde"),
        herkunft, q.h, herkunft === "beschaffung" ? new Date() : q.am, q.kyc_am ?? null, opt.agentId ?? null, q.ref],
    )) as any[];
    neu += ergebnis.length;
    if (ergebnis[0]?.id) await bestandBefund(Number(ergebnis[0].id), k, lauf);
  }
  return neu;
}

/**
 * Einer übernommenen Fassung den Lese-Befund nachrechnen — Seiten, Text/Foto,
 * Zeitraum (sonst stünde der Juni-Bestand beim Binden hinter dem September).
 * Ohne KI, nur Textschicht; ein Fehler hier hält nichts auf.
 */
async function bestandBefund(id: number, k: GebundeneKategorie, lauf: Lauf): Promise<void> {
  try {
    const [d] = (await lauf`SELECT inhalt FROM fiaon_dokumente WHERE id = ${id}`) as any[];
    if (!d?.inhalt) return;
    const b: Buffer = Buffer.isBuffer(d.inhalt) ? d.inhalt : Buffer.from(d.inhalt);
    const typ = typAmInhalt(b);
    let befund: DateiBefund = { typ: typ === "pdf" ? "pdf" : typ === "png" ? "png" : "jpg", seiten: 1, textseiten: 0, fotoseiten: 1, geschuetzt: false };
    if (typ === "pdf") {
      const { pdfPruefen } = await import("./fiaon-datei-eingang");
      const pr = await pdfPruefen(b, 8000);
      if (pr.ok) befund = { typ: "pdf", seiten: pr.seiten, textseiten: pr.textseiten, fotoseiten: pr.fotoseiten, geschuetzt: pr.geschuetzt };
    }
    befund = await sofortblick(k, { buffer: b, typ: befund.typ, befund });
    await lauf`UPDATE fiaon_dokumente SET lese_befund = ${lauf.json(befund as any)}, seiten = ${befund.seiten},
                      zeitraum_von = ${befund.zeitraumVon ?? null}, zeitraum_bis = ${befund.zeitraumBis ?? null}
                WHERE id = ${id}`;
  } catch (e) {
    console.warn("[UNTERLAGEN] Bestand-Befund:", String((e as Error)?.message || e).slice(0, 160));
  }
}

export class BindeAbbruch extends Error {
  readonly klasse: LeseKlasse;
  constructor(klasse: LeseKlasse, text: string) { super(text); this.name = "BindeAbbruch"; this.klasse = klasse; }
}

type BindeErgebnis = { ok: boolean; ref: string | null; dateien: number; bytes: number; grund?: string };

/** Eine Beratungssperre je Person und Kategorie — zwei Bindungen (Kunde und Team zugleich) laufen nacheinander. */
async function bindeSperre(tx: Lauf, personId: number, k: GebundeneKategorie): Promise<void> {
  await tx`SELECT pg_advisory_xact_lock(hashtext(${`fiaon-unterlagen:${personId}:${k}`}))`;
}

/** Die aktiven Dateien einer Kategorie (IDs, aufsteigend) — der Vergleich vor dem Schreiben. */
async function aktiveIds(personId: number, k: GebundeneKategorie, lauf: Lauf): Promise<number[]> {
  const rows = (await lauf`SELECT id FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k}
                             AND entfernt_am IS NULL AND geloescht_am IS NULL ORDER BY id`) as any[];
  return rows.map((r) => Number(r.id));
}

interface FassungPlan { traeger: string | null; ids: number[]; pdf: Buffer | null; grund: string | null }

/**
 * Liest die aktiven Dateien und baut die Fassung — die Rechenarbeit (pdf-lib, Fotos, qpdf).
 * E-IT-C Nachbesserung: Das läuft OHNE Transaktion; vorher hielt jede Bindung eine
 * Pool-Verbindung samt Sperre für die ganze Rechenzeit (Pool: 12 Verbindungen).
 */
async function fassungBauen(personId: number, k: GebundeneKategorie, lauf: Lauf): Promise<FassungPlan> {
  const traeger = await traegerRef(personId, lauf);
  if (!traeger) return { traeger: null, ids: [], pdf: null, grund: "keine Bestellung" };
  const rows = (await lauf`
    SELECT id, dateiname, mime, inhalt, zeitraum_von, hochgeladen_am FROM fiaon_dokumente
     WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL
     ORDER BY hochgeladen_am ASC, id ASC`) as any[];
  // Kontoauszüge nach erkanntem Zeitraum (ohne Zeitraum ans Ende, in Upload-Reihenfolge).
  if (k === "kontoauszug") {
    const tag = (v: any) => (v ? new Date(v).getTime() : Number.POSITIVE_INFINITY);
    rows.sort((x, y) => tag(x.zeitraum_von) - tag(y.zeitraum_von) || new Date(x.hochgeladen_am).getTime() - new Date(y.hochgeladen_am).getTime() || Number(x.id) - Number(y.id));
  }
  const ids = rows.map((r) => Number(r.id)).sort((a, b) => a - b);
  if (!rows.length) return { traeger, ids, pdf: null, grund: null };
  const { bildAlsPdf } = await import("./fiaon-bild-zu-pdf");
  const { zuEinerPdf, BindeFehler } = await import("./fiaon-pdf-binden");
  const teile: { buffer: Buffer; name: string }[] = [];
  try {
    for (const r of rows) {
      let b: Buffer = Buffer.isBuffer(r.inhalt) ? r.inhalt : Buffer.from(r.inhalt);
      const typ = typAmInhalt(b);
      if (typ === "jpg" || typ === "png") b = await bildAlsPdf(b, String(r.dateiname));
      else if (typ === "pdf" && rows.length > 1 && pdfVerschluesselt(b)) {
        const offen = await pdfEntschluesseln(b);
        if (!offen) throw new BindeAbbruch("passwort", `„${r.dateiname}“ ist verschlüsselt und ließ sich nicht lösen — die bisherige Akte-Fassung bleibt, bitte die Datei ohne Schutz neu speichern lassen.`);
        b = offen;
      }
      teile.push({ buffer: b, name: String(r.dateiname) });
    }
    const pdf = await zuEinerPdf(teile);
    if (pdf.length > UNTERLAGEN_GRENZEN.mbAkteFassung * 1024 * 1024) {
      throw new BindeAbbruch("akte_zu_gross", lesefehlerSatz("akte_zu_gross", "du", { kategorie: kategorieInfo(k).kurz, mb: UNTERLAGEN_GRENZEN.mbAkteFassung }));
    }
    return { traeger, ids, pdf, grund: null };
  } catch (e) {
    const grund = e instanceof BindeAbbruch ? e.message
      : e instanceof BindeFehler ? `Bindung: ${e.grund}${e.datei ? ` (${e.datei})` : ""} — die bisherige Akte-Fassung bleibt stehen.`
      : `Bindung fehlgeschlagen: ${String((e as Error)?.message || e).slice(0, 160)}`;
    return { traeger, ids, pdf: null, grund };
  }
}

/** Schreibt eine gebaute Fassung — in der Transaktion des Aufrufers, unter der Sperre. */
async function fassungSchreiben(personId: number, k: GebundeneKategorie, plan: FassungPlan, lauf: Lauf): Promise<BindeErgebnis> {
  const spalte = spalteVon(k);
  if (!plan.traeger) return { ok: false, ref: null, dateien: 0, bytes: 0, grund: plan.grund ?? "keine Bestellung" };
  if (plan.grund) {
    console.error(`[UNTERLAGEN] ${personId}/${k}:`, plan.grund);
    await lauf`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, anstoss_fehler, updated_at) VALUES (${personId}, ${k}, ${plan.grund}, NOW())
               ON CONFLICT (person_id, kategorie) DO UPDATE SET anstoss_fehler = EXCLUDED.anstoss_fehler, updated_at = NOW()`;
    return { ok: false, ref: plan.traeger, dateien: plan.ids.length, bytes: 0, grund: plan.grund };
  }
  if (!plan.pdf) {
    await lauf.unsafe(`UPDATE fiaon_applications SET ${spalte} = NULL, updated_at = NOW() WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND ${spalte} IS NOT NULL`, [personId]);
    await akteMerken(personId, k, { ref: plan.traeger, hash: null, dateien: 0, fehler: null }, lauf);
    return { ok: true, ref: plan.traeger, dateien: 0, bytes: 0 };
  }
  await lauf.unsafe(`UPDATE fiaon_applications SET ${spalte} = $1, documents_uploaded_at = NOW() WHERE ref = $2`, [plan.pdf, plan.traeger]);
  // Andere Bestellungen der Person verlieren ihre (in Zeilen übernommene) Fassung — sonst fände ein Leser über die Schwester-ref die alte.
  await lauf.unsafe(`UPDATE fiaon_applications SET ${spalte} = NULL, updated_at = NOW()
                      WHERE person_id = $1 AND ref <> $2 AND gdpr_deleted_at IS NULL AND ${spalte} IS NOT NULL`, [personId, plan.traeger]);
  await akteMerken(personId, k, { ref: plan.traeger, hash: sha256Hex(plan.pdf), dateien: plan.ids.length, fehler: null }, lauf);
  return { ok: true, ref: plan.traeger, dateien: plan.ids.length, bytes: plan.pdf.length };
}

/**
 * Bindet alle aktiven Dateien einer Kategorie zur Akte-Fassung und schreibt sie
 * an die Trägerbestellung. Kontoauszüge nach erkanntem Zeitraum, sonst nach
 * Upload-Zeit. Fotos werden je eine PDF-Seite. Reiner Rechteschutz wird vor dem
 * Binden gelöst (qpdf). Gelingt das Binden nicht, bleibt die bisherige Fassung
 * stehen und der Grund steht in fiaon_unterlagen_akte.anstoss_fehler (Office sieht ihn).
 *
 * E-IT-C Nachbesserung (08.10.2026):
 *  · ZUERST wird übernommen, was nur in einer Spalte liegt (bestandUebernehmen, unter der
 *    Sperre) — sonst überschrieb das Binden nach einem Entfernen einen Altbestand ohne Zeile
 *    und ohne Archiv (endgültiger Verlust, z. B. nach einer Zusammenführung).
 *  · Gebaut wird außerhalb jeder Transaktion; geschrieben wird kurz, unter der Sperre, und
 *    nur, wenn sich Träger und Dateien seither nicht geändert haben (sonst neu bauen).
 *  · Mit einer Transaktion als `lauf` (Zusammenführung, Prüfstand) läuft alles in ihr.
 */
export async function akteFassungBinden(personId: number, k: GebundeneKategorie, lauf: Lauf = sqlPool, opt: { bestand?: boolean } = {}): Promise<BindeErgebnis> {
  const bestand = opt.bestand !== false;
  if (typeof (lauf as any).begin !== "function") {
    await bindeSperre(lauf, personId, k);
    if (bestand) await bestandUebernehmen(personId, k, lauf);
    return fassungSchreiben(personId, k, await fassungBauen(personId, k, lauf), lauf);
  }
  const pool = lauf as any;
  try {
    if (bestand) await pool.begin(async (tx: Lauf) => { await bindeSperre(tx, personId, k); await bestandUebernehmen(personId, k, tx); });
    for (let versuch = 0; versuch < 3; versuch++) {
      const plan = await fassungBauen(personId, k, lauf);
      const erg: BindeErgebnis | null = await pool.begin(async (tx: Lauf) => {
        await bindeSperre(tx, personId, k);
        const [ids, traeger] = await Promise.all([aktiveIds(personId, k, tx), traegerRef(personId, tx)]);
        if (traeger !== plan.traeger || ids.join(",") !== plan.ids.join(",")) return null; // inzwischen geändert — neu bauen
        return fassungSchreiben(personId, k, plan, tx);
      });
      if (erg) return erg;
    }
    // Viel Bewegung (drei Mal geändert): unter der Sperre bauen — dann sicher.
    return await pool.begin(async (tx: Lauf) => { await bindeSperre(tx, personId, k); return fassungSchreiben(personId, k, await fassungBauen(personId, k, tx), tx); });
  } catch (e) {
    const grund = `Bindung fehlgeschlagen: ${String((e as Error)?.message || e).slice(0, 160)}`;
    console.error(`[UNTERLAGEN] ${personId}/${k}:`, grund);
    await lauf`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, anstoss_fehler, updated_at) VALUES (${personId}, ${k}, ${grund}, NOW())
               ON CONFLICT (person_id, kategorie) DO UPDATE SET anstoss_fehler = EXCLUDED.anstoss_fehler, updated_at = NOW()`.catch(() => {});
    return { ok: false, ref: null, dateien: 0, bytes: 0, grund };
  }
}

/**
 * Muss die Akte-Fassung neu gebunden werden? Ja, wenn seit der letzten Bindung eine Datei
 * dazukam, die Zahl der aktiven Dateien sich änderte oder die letzte Bindung scheiterte.
 */
async function bindenNoetig(personId: number, k: GebundeneKategorie, lauf: Lauf): Promise<boolean> {
  const [z] = (await lauf`
    SELECT a.gebunden_am, a.letzter_upload_am, a.dateien, a.anstoss_fehler,
           (SELECT count(*)::int FROM fiaon_dokumente d WHERE d.person_id = ${personId} AND d.art = 'unterlage' AND d.kategorie = ${k}
                                                         AND d.entfernt_am IS NULL AND d.geloescht_am IS NULL) AS n
      FROM fiaon_unterlagen_akte a WHERE a.person_id = ${personId} AND a.kategorie = ${k}`) as any[];
  if (!z) return false;
  if (z.anstoss_fehler) return true;
  if (Number(z.n) !== Number(z.dateien || 0)) return true;
  return !!z.letzter_upload_am && (!z.gebunden_am || new Date(z.letzter_upload_am).getTime() > new Date(z.gebunden_am).getTime());
}

async function akteMerken(personId: number, k: string, w: { ref: string | null; hash: string | null; dateien: number; fehler: string | null }, lauf: Lauf): Promise<void> {
  await lauf`
    INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, ref, akte_hash, dateien, gebunden_am, anstoss_fehler, updated_at)
    VALUES (${personId}, ${k}, ${w.ref}, ${w.hash}, ${w.dateien}, NOW(), ${w.fehler}, NOW())
    ON CONFLICT (person_id, kategorie) DO UPDATE SET ref = EXCLUDED.ref, akte_hash = EXCLUDED.akte_hash, dateien = EXCLUDED.dateien,
      gebunden_am = EXCLUDED.gebunden_am, anstoss_fehler = EXCLUDED.anstoss_fehler, updated_at = NOW()`;
}

/**
 * Eine außerhalb geschriebene Fassung anmelden — die beschaffte Auskunft
 * (fiaon-auskunft-lieferung.ts, beschaffungHochladen) schreibt die Spalte selbst
 * (mit eigener Anhänge-Logik und Mail). Danach ist sie hier EINE Datei mit
 * Herkunft „beschaffung", die vorigen Dateien sind mit Grund entfernt, und das
 * nächste Hinzufügen bindet an DIESE Fassung an statt sie zu überschreiben.
 */
export async function akteFassungUebernehmen(personId: number, k: GebundeneKategorie, wer: { herkunft: string; name: string; agentId?: number | null }, lauf: Lauf = sqlPool): Promise<void> {
  if (!(await unterlagenBereit(lauf))) return;
  await bestandUebernehmen(personId, k, lauf, { herkunft: wer.herkunft, quelle: "mitarbeiter", agentId: wer.agentId ?? null, name: wer.name });
  const spalte = spalteVon(k);
  const traeger = await traegerRef(personId, lauf);
  const [z] = (await lauf.unsafe(`SELECT encode(sha256(${spalte}), 'hex') AS h FROM fiaon_applications WHERE ref = $1 AND LENGTH(${spalte}) > 0`, [traeger ?? ""])) as any[];
  const [n] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
  await akteMerken(personId, k, { ref: traeger, hash: z?.h ?? null, dateien: Number(n?.n || 0), fehler: null }, lauf);
}

// ───────────────────────────────────────────────────────────────────────────
// Der Upload-Link (E-IT-D) meldet seine Dateien an — Integration 08.10.2026
//
// Der Upload-Link ohne Anmeldung (server/lib/fiaon-unterlagen-link.ts, unterlageAnnehmen) bindet selbst
// (vorhandene Fassung vorn, neue dahinter; ein falsches Dokument wird ersetzt) und schreibt die Spalte der
// Trägerbestellung (dieselbe Reihenfolge wie traegerRef). Ohne Anmeldung hier sähe diese Ablage die Spalte
// als „fremd“: Die Link-Dateien stünden nicht in der Liste, und das nächste Hinzufügen fasste ALLE Dateien
// der Kategorie zu EINER zusammen. Deshalb:
//   · linkVorSchreiben  — vor dem Schreiben: Bestand ohne Zeile wird Zeile (wie vor jedem Hinzufügen).
//   · linkDateienAnmelden — danach: jede neue Datei eine Zeile (Herkunft „link“, vom Kunden), bei „ersetzen“
//     die bisherigen mit Grund entfernt (nicht gelöscht), und die geschriebene Spalte gilt als gebundene Fassung.
// Ist die Ablage nicht bereit (Migration 099 fehlt und lässt sich nicht nachziehen), passiert nichts.
// ───────────────────────────────────────────────────────────────────────────
export async function linkVorSchreiben(personId: number, k: GebundeneKategorie, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!(await unterlagenBereit(lauf))) return null;
  await bestandUebernehmen(personId, k, lauf);
  // Darf der Kunde hier überhaupt etwas hinzufügen? Dieselben zwei Sperren wie im Kundenbereich (Auskunft).
  if (k === "schufa") {
    const [b] = (await lauf`SELECT 1 AS ja FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = 'schufa'
                              AND herkunft = 'beschaffung' AND entfernt_am IS NULL AND geloescht_am IS NULL LIMIT 1`) as any[];
    if (b) return lesefehlerSatz("beschafft", "sie");
    if (await auskunftAbgeschlossen(personId, lauf)) return lesefehlerSatz("ausgewertet", "sie");
  }
  return null;
}

export async function linkDateienAnmelden(personId: number, k: GebundeneKategorie, ein: {
  dateien: { buffer: Buffer; name: string }[];
  /** Grund, wenn die neue Fassung die bisherige ERSETZT (falsches Dokument, neue Auskunft). */
  ersetzen: string | null;
  wer: Handelnder;
}, lauf: Lauf = sqlPool): Promise<void> {
  if (!(await unterlagenBereit(lauf))) return;
  try {
    if (ein.ersetzen) {
      await lauf`UPDATE fiaon_dokumente SET entfernt_am = NOW(), entfernt_von = ${ein.wer.name}, entfernt_grund = ${`ersetzt: ${ein.ersetzen}`.slice(0, 300)}
                  WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`;
    }
    const traeger = await traegerRef(personId, lauf);
    const quelle = ein.wer.art === "kunde" ? "kunde" : "mitarbeiter";
    for (const d of ein.dateien) {
      const typ = typAmInhalt(d.buffer);
      const [z] = (await lauf`
        INSERT INTO fiaon_dokumente (person_id, ref, art, kategorie, dateiname, mime, bytes, inhalt, quelle, herkunft, doc_hash, agent_id, hochgeladen_am)
        VALUES (${personId}, ${traeger}, 'unterlage', ${k}, ${String(d.name || "Datei").slice(0, 200)}, ${typ === "pdf" ? "application/pdf" : typ === "png" ? "image/png" : "image/jpeg"},
                ${d.buffer.length}, ${d.buffer}, ${quelle}, 'link', ${sha256Hex(d.buffer)}, ${ein.wer.agentId ?? null}, NOW())
        ON CONFLICT DO NOTHING RETURNING id`) as any[];
      if (z?.id) await bestandBefund(Number(z.id), k, lauf);
    }
    const spalte = spalteVon(k);
    const [h] = (await lauf.unsafe(`SELECT encode(sha256(${spalte}), 'hex') AS h FROM fiaon_applications WHERE ref = $1 AND LENGTH(${spalte}) > 0`, [traeger ?? ""])) as any[];
    const [n] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
    await akteMerken(personId, k, { ref: traeger, hash: h?.h ?? null, dateien: Number(n?.n || 0), fehler: null }, lauf);
  } catch (e) {
    // Die Datei liegt schon in der Spalte (der Kunde hat nichts verloren) — nur die Liste hinkt nach.
    console.error("[UNTERLAGEN] Link-Dateien anmelden:", String((e as Error)?.message || e).slice(0, 200));
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Hinzufügen
// ───────────────────────────────────────────────────────────────────────────
export type HinzufuegenErgebnis =
  | { ok: true; datei: UnterlagenDatei; satzKunde: string; satzOffice: string; doppelt?: boolean; gebunden: boolean }
  | { ok: false; status: number; klasse: LeseKlasse; satzKunde: string; satzOffice: string };

/** Abgewiesene Uploads messbar machen (vorher antwortete multer vor jedem DB-Zugriff — „zu groß" war unsichtbar). */
export async function abgewiesenMerken(personId: number | null, klasse: string, kategorie: string, bytes: number, lauf: Lauf = sqlPool): Promise<void> {
  if (!personId) return;
  await lauf`INSERT INTO fiaon_app_ereignisse (person_id, bildschirm, ereignis)
             VALUES (${personId}, 'unterlagen', ${`abgewiesen:${klasse}:${kategorie}:${Math.round(bytes / 1024)}KB`})`.catch(() => {});
}

async function verlauf(ref: string | null, personId: number, wer: Handelnder, note: string, lauf: Lauf): Promise<void> {
  // ref ist NOT NULL — ohne ref scheiterte der Eintrag des Mitarbeiter-Uploads 60 Tage lang still (0 Zeilen).
  const r = ref ?? (await traegerRef(personId, lauf));
  if (!r) return;
  await lauf`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
             VALUES (${r}, ${personId}, ${wer.agentId ?? null}, ${wer.name || "System"}, 'system', ${note}, NOW())`
    .catch((e: any) => console.error("[UNTERLAGEN] Verlauf:", String(e?.message || e).slice(0, 160)));
}

/** Sofortblick auf EINE Datei: nur Textschicht, keine KI — in der Antwort an den Menschen. */
async function sofortblick(k: UnterlagenKategorie, datei: { buffer: Buffer; typ: string; befund: DateiBefund }): Promise<DateiBefund> {
  const b = { ...datei.befund };
  if (k === "weitere" || datei.typ !== "pdf" || b.textseiten <= 0) return b;
  try {
    const { pdfTextUndZeilen } = await import("./fiaon-pdf-lesen");
    const { textBefund } = await import("./fiaon-dokument-pruefung");
    const { seiten, zeilen } = await Promise.race([
      pdfTextUndZeilen(datei.buffer),
      new Promise<never>((_, nein) => setTimeout(() => nein(new Error("Zeitgrenze")), 8000)),
    ]);
    const tb = textBefund(k as DokumentArt, seiten.join("\n"), zeilen.flat());
    b.erkannt = tb.erkannt;
    b.aehnlich = (tb.aehnlich as UnterlagenKategorie | null) ?? null;
    if (tb.zeitraumVon) { b.zeitraumVon = tb.zeitraumVon; b.zeitraumBis = tb.zeitraumBis; }
    if (tb.ausweis) b.ausweis = tb.ausweis;
  } catch (e) {
    console.warn("[UNTERLAGEN] Sofortblick:", String((e as Error)?.message || e).slice(0, 120));
  }
  return b;
}

/**
 * Eine Datei hinzufügen — der EINE Weg für Kunde, Mitarbeiter und Verwaltung.
 * `ersetzen` (nur Office): alle aktiven Dateien der Kategorie werden mit Grund
 * entfernt, aber erst NACHDEM die neue Datei die Eingangsprüfung bestanden hat.
 */
export async function unterlageHinzufuegen(ein: {
  personId: number;
  kategorie: UnterlagenKategorie;
  unterart?: unknown;
  notiz?: unknown;
  datei: { buffer: Buffer; name: string };
  wer: Handelnder;
  herkunft: "portal" | "antrag" | "mitarbeiter" | "verwaltung" | "link";
  ersetzen?: { grund: string } | null;
}, lauf: Lauf = sqlPool): Promise<HinzufuegenErgebnis> {
  const k = ein.kategorie;
  const info = kategorieInfo(k);
  const anredeFehler = (klasse: LeseKlasse, status: number, ctx: Record<string, any> = {}): HinzufuegenErgebnis =>
    ({ ok: false, status, klasse, satzKunde: lesefehlerSatz(klasse, "sie", { kategorie: info.kurz, ...ctx }), satzOffice: lesefehlerSatz(klasse, "du", { kategorie: info.kurz, ...ctx }) });
  if (!(await unterlagenBereit(lauf))) {
    return { ok: false, status: 503, klasse: "technisch", satzKunde: "Das Hochladen ist gerade nicht möglich. Bitte versuchen Sie es in einigen Minuten noch einmal.", satzOffice: "Unterlagen-Ablage nicht bereit (Migration 099 fehlt?)." };
  }
  const aktiv = (await lauf`
    SELECT id, herkunft, bytes FROM fiaon_dokumente
     WHERE person_id = ${ein.personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
  if (!ein.ersetzen && aktiv.length >= UNTERLAGEN_GRENZEN.dateienJeKategorie) {
    await abgewiesenMerken(ein.personId, "zu_viele", k, ein.datei.buffer.length, lauf);
    return anredeFehler("zu_viele", 409, { anzahl: UNTERLAGEN_GRENZEN.dateienJeKategorie });
  }
  if (ein.wer.art === "kunde" && k === "schufa" && aktiv.some((z) => z.herkunft === "beschaffung")) return anredeFehler("beschafft", 409);
  // E-IT-C Nachbesserung: An eine geprüfte oder ausgewertete Auskunft hängt der Kunde nichts mehr an (wie die Anzeige).
  if (ein.wer.art === "kunde" && k === "schufa" && (await auskunftAbgeschlossen(ein.personId, lauf))) return anredeFehler("ausgewertet", 409);

  const eingang = await dateiEingang(ein.datei.buffer, ein.datei.name);
  if (!eingang.ok) {
    await abgewiesenMerken(ein.personId, eingang.klasse, k, ein.datei.buffer.length, lauf);
    return anredeFehler(eingang.klasse, 400, { name: eingang.name, detail: eingang.detail, mb: UNTERLAGEN_GRENZEN.mbJeDatei });
  }
  const d = eingang.datei;
  const hash = sha256Hex(d.buffer);
  const [schon] = (await lauf`
    SELECT id FROM fiaon_dokumente WHERE person_id = ${ein.personId} AND art = 'unterlage' AND kategorie = ${k}
       AND doc_hash = ${hash} AND entfernt_am IS NULL AND geloescht_am IS NULL LIMIT 1`) as any[];
  if (schon && !ein.ersetzen) {
    const zeile = (await zeilenLaden(ein.personId, lauf)).find((z) => z.id === Number(schon.id))!;
    return { ok: true, doppelt: true, gebunden: false, datei: alsDatei(zeile, ein.wer.art === "kunde" ? "kunde" : "office", null),
      satzKunde: lesefehlerSatz("doppelt", "sie", { name: d.name }), satzOffice: lesefehlerSatz("doppelt", "du", { name: d.name }) };
  }
  const summe = (ein.ersetzen ? 0 : aktiv.reduce((n, z) => n + Number(z.bytes || 0), 0)) + d.buffer.length;
  if (istGebunden(k) && summe > UNTERLAGEN_GRENZEN.mbAkteFassung * 1024 * 1024) {
    await abgewiesenMerken(ein.personId, "akte_zu_gross", k, d.buffer.length, lauf);
    return anredeFehler("akte_zu_gross", 413, { mb: UNTERLAGEN_GRENZEN.mbAkteFassung });
  }

  const befund = await sofortblick(k, { buffer: d.buffer, typ: d.typ, befund: d.befund });
  const unterart = unterartSauber(k, ein.unterart);
  const notiz = String(ein.notiz ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120) || null;
  const quelle = ein.wer.art === "kunde" ? "kunde" : "mitarbeiter";
  const traeger = await traegerRef(ein.personId, lauf);
  let stapelLief = false;

  // Bestand vor dem ersten Schreiben übernehmen — sonst verdrängte die neue Datei die alte Fassung.
  if (istGebunden(k) && !ein.ersetzen) await bestandUebernehmen(ein.personId, k, lauf);

  const neu = await lauf.begin(async (tx: any) => {
    // Läuft für diese Kategorie schon ein Stapel (eine Datei in den letzten 45 s)? Dann bindet der Anstoß
    // EINMAL am Ende, statt jede weitere Datei die ganze Fassung neu binden zu lassen (E-IT-C Nachbesserung).
    const [vorher] = (await tx`SELECT anstoss_faellig_am FROM fiaon_unterlagen_akte WHERE person_id = ${ein.personId} AND kategorie = ${k}`) as any[];
    stapelLief = !!vorher?.anstoss_faellig_am;
    if (ein.ersetzen) {
      if (istGebunden(k)) {
        // Was ersetzt wird, geht nicht verloren: Bestand vorher als Zeile, die Spalte ins Archiv.
        await bestandUebernehmen(ein.personId, k, tx);
        const { unterlageSichern } = await import("./fiaon-dokumente");
        if (traeger) await unterlageSichern(traeger, k as DokumentArt, tx);
      }
      await tx`UPDATE fiaon_dokumente SET entfernt_am = NOW(), entfernt_von = ${ein.wer.name}, entfernt_grund = ${`ersetzt: ${ein.ersetzen.grund}`.slice(0, 300)}
                WHERE person_id = ${ein.personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL`;
    }
    const [z] = (await tx`
      INSERT INTO fiaon_dokumente (person_id, ref, art, kategorie, unterart, notiz, dateiname, mime, bytes, inhalt, quelle, herkunft,
                                   doc_hash, seiten, lese_befund, zeitraum_von, zeitraum_bis, agent_id, hochgeladen_am)
      VALUES (${ein.personId}, ${traeger}, 'unterlage', ${k}, ${unterart}, ${notiz}, ${d.name}, ${d.mime}, ${d.buffer.length}, ${d.buffer},
              ${quelle}, ${ein.herkunft}, ${hash}, ${d.seiten}, ${tx.json(befund as any)}, ${befund.zeitraumVon ?? null}, ${befund.zeitraumBis ?? null},
              ${ein.wer.agentId ?? null}, NOW())
      ON CONFLICT DO NOTHING
      RETURNING id`) as any[];
    await tx`
      INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, letzter_upload_am, anstoss_faellig_am, anstoss_von, updated_at)
      VALUES (${ein.personId}, ${k}, NOW(), NOW() + make_interval(secs => ${ANSTOSS_NACH_MS / 1000}), ${quelle}, NOW())
      ON CONFLICT (person_id, kategorie) DO UPDATE SET letzter_upload_am = NOW(), anstoss_faellig_am = EXCLUDED.anstoss_faellig_am,
        anstoss_von = CASE WHEN fiaon_unterlagen_akte.anstoss_von = 'kunde' AND fiaon_unterlagen_akte.anstoss_faellig_am IS NOT NULL THEN 'kunde' ELSE EXCLUDED.anstoss_von END,
        updated_at = NOW()`;
    return z ? Number(z.id) : null;
  });
  if (neu == null) {
    // Zwei gleiche Dateien gleichzeitig: die Eindeutigkeit hat die zweite abgewiesen.
    return { ok: false, status: 409, klasse: "doppelt", satzKunde: lesefehlerSatz("doppelt", "sie", { name: d.name }), satzOffice: lesefehlerSatz("doppelt", "du", { name: d.name }) };
  }

  // Sofort binden: die erste Datei eines Stapels, „Alles ersetzen" und wenn noch keine Fassung in der
  // Spalte steht (Karte-Tor, „liegt vor"). Jede weitere Datei desselben Stapels bindet der Anstoß einmal.
  let gebunden = true;
  if (istGebunden(k)) {
    const [hatFassung] = (await lauf.unsafe(`SELECT 1 FROM fiaon_applications WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND LENGTH(${spalteVon(k)}) > 0 LIMIT 1`, [ein.personId])) as any[];
    if (ein.ersetzen || !stapelLief || !hatFassung) gebunden = (await akteFassungBinden(ein.personId, k, lauf, { bestand: false })).ok;
  }
  await nachHinzufuegen(ein.personId, k, lauf);

  const zeile = (await zeilenLaden(ein.personId, lauf)).find((z) => z.id === neu)!;
  const datei = alsDatei(zeile, ein.wer.art === "kunde" ? "kunde" : "office", null);
  const kurzBefund = `${d.seiten} Seite${d.seiten === 1 ? "" : "n"}, ${groesseText(d.buffer.length)}${befund.zeitraumVon && befund.zeitraumBis ? `, ${tagText(befund.zeitraumVon)}–${tagText(befund.zeitraumBis)}` : ""}`;
  const art = `${info.kurz}${unterartLabel(k, unterart) ? ` (${unterartLabel(k, unterart)})` : ""}`;
  await verlauf(traeger, ein.personId, ein.wer,
    ein.wer.art === "kunde"
      ? `Kunde hat hochgeladen: ${art} „${d.name}“ (${kurzBefund}). Prüfung durch die Verwaltung steht aus.${datei.satz ? ` SOFORTBLICK: ${befundSatz(zeile.lese_befund, "du", k)}` : ""}`
      : `${art} für den Kunden ${ein.ersetzen ? "hochgeladen — ersetzt alle bisherigen Dateien" : "hinzugefügt"}: „${d.name}“ (${kurzBefund}) — von ${ein.wer.name}.${ein.ersetzen ? ` Grund: ${ein.ersetzen.grund}` : ""}`,
    lauf);
  anstossPlanen(ein.personId, k);
  // Integration E-IT-C × E-IT-F (08.10.2026): JEDE angenommene Datei ist das Ereignis „Unterlage erhalten“ — hier, an
  // der einen Stelle, durch die alle Wege laufen (Kundenbereich, Antrag /upload-kyc, Akte, Verwaltung, Upload-Link).
  // Es schließt „Unterlage anfordern“ nur bei passender Unterlage (unterlagePasst); eine eigene Bonitätsauskunft gibt
  // nur einen Beitrag „Leistung klären“ (Entscheidung 4a). ereignisMelden fängt selbst — der Upload scheitert nie daran.
  {
    const { ereignisMelden } = await import("./fiaon-auftraege");
    await ereignisMelden({
      ereignis: "unterlage_erhalten", personId: ein.personId, ref: traeger,
      akteur: ein.wer.art === "kunde" ? { id: null, name: "Kunde (Upload)" } : { id: ein.wer.agentId ?? null, name: ein.wer.name },
      detail: k === "schufa" ? "eigene Bonitätsauskunft" : info.kurz,
    }, lauf).catch(() => {});
  }
  // Integration E-IT-C × E-IT-D (08.10.2026, 4a): Kommt eine Auskunft in die Akte, während ein Beschaffungsauftrag
  // offen ist, wird daraus eine Leistungsfrage (bzw. im Datenkopie-Weg die Lieferung) — für JEDEN Weg hier an einer
  // Stelle (vorher je Route in /upload-kyc, Akte-Upload und Upload-Link). Ein Fehler hier hält den Upload nie auf.
  if (k === "schufa") {
    const { beschaffungBeiEigenemUpload } = await import("./fiaon-auskunft-lieferung");
    await beschaffungBeiEigenemUpload(ein.personId, ein.wer.art === "kunde" ? "kunde" : "mitarbeiter", ein.wer.art === "kunde" ? null : ein.wer.name, lauf)
      .catch((e: unknown) => console.error("[UNTERLAGEN] Beschaffung:", String((e as Error)?.message || e).slice(0, 160)));
  }

  const satzKunde = [
    `Eingegangen: „${d.name}“ (${kurzBefund}).`,
    datei.satz ?? null,
    k === "weitere" ? "Wir sehen sie uns an." : "Wir lesen die Datei jetzt — der Befund erscheint gleich hier.",
  ].filter(Boolean).join(" ");
  const satzOffice = `${art} liegt in der Akte („${d.name}“, ${kurzBefund}).${datei.satz ? ` ⚠ ${befundSatz(zeile.lese_befund, "du", k)}` : ""}${gebunden ? "" : " Die Akte-Fassung ließ sich nicht neu binden — siehe Hinweis an der Kategorie."}`;
  return { ok: true, datei, satzKunde, satzOffice, gebunden };
}

/** Was nach jedem Hinzufügen gilt — 1:1 wie bisher /upload-kyc (Status, Neu-Anforderung). */
async function nachHinzufuegen(personId: number, k: UnterlagenKategorie, lauf: Lauf): Promise<void> {
  if (k === "kontoauszug" || k === "ausweis") {
    const flag = k === "kontoauszug" ? "reupload_bank_statement" : "reupload_id_card";
    await lauf.unsafe(`UPDATE fiaon_applications SET ${flag} = FALSE,
                         kyc_status = CASE WHEN kyc_status = 'changes_requested'
                                            AND NOT COALESCE(${flag === "reupload_bank_statement" ? "reupload_id_card" : "reupload_bank_statement"}, FALSE)
                                           THEN 'pending' ELSE kyc_status END,
                         updated_at = NOW()
                        WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND COALESCE(${flag}, FALSE)`, [personId]).catch(() => {});
  }
  await traegerWeiter(personId, lauf);
}

/** Hat der Kunde damit alles beisammen? Dann rückt die Trägerbestellung weiter (auch nach einer Bindung im Anstoß). */
async function traegerWeiter(personId: number, lauf: Lauf): Promise<void> {
  const traeger = await traegerRef(personId, lauf);
  if (traeger) {
    await lauf`
      UPDATE fiaon_applications SET status = 'documents_submitted'
       WHERE ref = ${traeger}
         AND EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = ${personId} AND x.gdpr_deleted_at IS NULL AND LENGTH(x.bank_statement_pdf) > 0)
         AND EXISTS (SELECT 1 FROM fiaon_applications x WHERE x.person_id = ${personId} AND x.gdpr_deleted_at IS NULL AND LENGTH(x.id_card_pdf) > 0)
         -- Wie bisher /upload-kyc (setzte es bei beiden Unterlagen IMMER) — aber nie über eine Freigabe oder
         -- einen laufenden Schritt der Verwaltung hinweg (approved, verifying, processing bleiben).
         AND status IN ('pending', 'documents_requested', 'submitted', 'payment_completed', 'completed')`.catch(() => {});
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Entfernen, Geprüft, Leeren
// ───────────────────────────────────────────────────────────────────────────
export type AktionErgebnis = { ok: true; satz: string } | { ok: false; status: number; satz: string };

export async function unterlageEntfernen(personId: number, id: number, wer: Handelnder, grund: string, lauf: Lauf = sqlPool): Promise<AktionErgebnis> {
  if (!(await unterlagenBereit(lauf))) return { ok: false, status: 503, satz: "Gerade nicht möglich." };
  const zeile = (await zeilenLaden(personId, lauf)).find((z) => z.id === id);
  if (!zeile) return { ok: false, status: 404, satz: wer.art === "kunde" ? "Diese Datei gibt es nicht (mehr)." : "Diese Datei gibt es nicht (mehr)." };
  if (wer.art === "kunde") {
    const lage = await spaltenLage(personId, lauf);
    const verw = zeile.kategorie === "schufa" ? lage.schufaFreigabeAm : zeile.kategorie === "weitere" ? null : lage.kycFreigabeAm;
    if (!darfKundeEntfernen({ quelle: zeile.quelle, herkunft: zeile.herkunft, geprueftAm: zeile.geprueft_am, hochgeladenAm: zeile.hochgeladen_am, verwaltungGeprueftAm: verw, entferntAm: zeile.entfernt_am })) {
      return { ok: false, status: 403, satz: "Diese Datei wurde bereits geprüft oder von FIAON abgelegt — entfernen kann sie nur Ihr Ansprechpartner. Schreiben Sie ihm kurz, was nicht stimmt." };
    }
  } else if (String(grund || "").trim().length < 5) {
    return { ok: false, status: 400, satz: "Bitte kurz begründen — der Grund steht im Verlauf." };
  }
  const g = String(grund || (wer.art === "kunde" ? "vom Kunden entfernt" : "")).trim().slice(0, 300);
  // E-IT-C Nachbesserung (Art. 5 Abs. 1 lit. c/e DSGVO): Was der Kunde selbst entfernt — eine eigene,
  // ungeprüfte Datei, meist versehentlich hochgeladen (der Auszug des Partners, ein Attest) —, wird
  // gelöscht; es bleibt nur der Vermerk, dass es sie gab (Name, Größe, Prüfsumme, wann). Entfernt das
  // Team (mit Grund), bleibt die Datei im Archiv der Akte.
  const vomKunden = wer.art === "kunde";
  await lauf`UPDATE fiaon_dokumente SET entfernt_am = NOW(), entfernt_von = ${wer.name}, entfernt_grund = ${g},
                    inhalt = CASE WHEN ${vomKunden} THEN '\\x'::bytea ELSE inhalt END
              WHERE id = ${id} AND person_id = ${personId} AND entfernt_am IS NULL`;
  const k = zeile.kategorie;
  if (istGebunden(k)) await akteFassungBinden(personId, k, lauf);
  // Ein Entfernen ist kein Eingang: Es erzeugt keine neue Aufgabe „Unterlagen eingegangen" — außer ein
  // Kunden-Upload dieses Stapels steht noch aus (dann bleibt „kunde").
  await lauf`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, anstoss_faellig_am, anstoss_von, updated_at)
             VALUES (${personId}, ${k}, NOW() + make_interval(secs => ${ANSTOSS_NACH_MS / 1000}), ${vomKunden ? "kunde_entfernt" : "mitarbeiter"}, NOW())
             ON CONFLICT (person_id, kategorie) DO UPDATE SET anstoss_faellig_am = EXCLUDED.anstoss_faellig_am,
               anstoss_von = CASE WHEN fiaon_unterlagen_akte.anstoss_von = 'kunde' AND fiaon_unterlagen_akte.anstoss_faellig_am IS NOT NULL THEN 'kunde' ELSE EXCLUDED.anstoss_von END,
               updated_at = NOW()`.catch(() => {});
  anstossPlanen(personId, k);
  await verlauf(null, personId, wer, `${kategorieInfo(k).kurz}: Datei „${zeile.dateiname}“ entfernt (von ${wer.name}). Grund: ${g}. ${vomKunden ? "Der Inhalt ist gelöscht (eigene, ungeprüfte Datei des Kunden) — vermerkt bleibt nur, dass es sie gab." : "Die Datei bleibt im Archiv der Akte."}`, lauf);
  return { ok: true, satz: wer.art === "kunde" ? `„${zeile.dateiname}“ ist entfernt.` : `„${zeile.dateiname}“ entfernt — der Grund steht im Verlauf.` };
}

/** Die Verwaltung (bzw. der Betreuer) hat die Kategorie geprüft: Ab jetzt entfernt der Kunde dort nichts mehr selbst. */
export async function kategorieGeprueft(personId: number, k: UnterlagenKategorie, wer: Handelnder, lauf: Lauf = sqlPool): Promise<AktionErgebnis> {
  if (!(await unterlagenBereit(lauf))) return { ok: false, status: 503, satz: "Gerade nicht möglich." };
  if (istGebunden(k)) await bestandUebernehmen(personId, k, lauf);
  const r = (await lauf`UPDATE fiaon_dokumente SET geprueft_am = NOW(), geprueft_von_agent_id = ${wer.agentId ?? null}
                         WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL AND geprueft_am IS NULL
                         RETURNING id`) as any[];
  if (!r.length) return { ok: false, status: 409, satz: "Hier gibt es nichts (mehr) zu prüfen." };
  await verlauf(null, personId, wer, `${kategorieInfo(k).kurz} geprüft (${r.length} Datei${r.length === 1 ? "" : "en"}) — von ${wer.name}.`, lauf);
  return { ok: true, satz: `${kategorieInfo(k).kurz}: als geprüft vermerkt.` };
}

/** „Löschen" der ganzen Kategorie (alter Knopf in der Akte): Dateien entfernen, Fassung archivieren, Spalten leeren. */
export async function kategorieLeeren(personId: number, k: GebundeneKategorie, wer: Handelnder, grund: string, lauf: Lauf = sqlPool): Promise<AktionErgebnis> {
  if (!(await unterlagenBereit(lauf))) return { ok: false, status: 503, satz: "Gerade nicht möglich." };
  await bestandUebernehmen(personId, k, lauf);
  const spalte = spalteVon(k);
  const traeger = (await lauf.unsafe(`SELECT ref FROM fiaon_applications WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND ${spalte} IS NOT NULL`, [personId])) as any[];
  const { unterlageSichern } = await import("./fiaon-dokumente");
  for (const t of traeger) await unterlageSichern(String(t.ref), k, lauf);
  const r = (await lauf`UPDATE fiaon_dokumente SET entfernt_am = NOW(), entfernt_von = ${wer.name}, entfernt_grund = ${`gelöscht: ${grund}`.slice(0, 300)}
                         WHERE person_id = ${personId} AND art = 'unterlage' AND kategorie = ${k} AND entfernt_am IS NULL AND geloescht_am IS NULL
                         RETURNING id`) as any[];
  if (!r.length && !traeger.length) return { ok: false, status: 404, satz: "Es liegt kein solches Dokument vor." };
  await akteFassungBinden(personId, k, lauf);
  await verlauf(traeger[0]?.ref ? String(traeger[0].ref) : null, personId, wer, `Dokument gelöscht: ${kategorieInfo(k).kurz} (${r.length} Datei${r.length === 1 ? "" : "en"}, Fassung im Archiv). Grund: ${grund}`, lauf);
  return { ok: true, satz: `${kategorieInfo(k).kurz} gelöscht — der Kunde (oder du) kann jetzt das richtige Dokument hochladen.` };
}

// ───────────────────────────────────────────────────────────────────────────
// Eine Datei lesen (Ansehen)
// ───────────────────────────────────────────────────────────────────────────
export async function dateiLesen(personId: number, id: number, lauf: Lauf = sqlPool, opt: { nurAktiv?: boolean } = {}): Promise<{ inhalt: Buffer; mime: string; dateiname: string; kategorie: string; ref: string | null } | null> {
  // E-IT-C Nachbesserung: Der Kunde öffnet nur AKTIVE Dateien — eine vom Team entfernte (z. B. „falsche
  // Person") bleibt für ihn zu, auch wenn er die fortlaufende ID errät. Das Office öffnet auch Entferntes.
  const nurAktiv = opt.nurAktiv === true;
  const [d] = (await lauf`SELECT inhalt, mime, dateiname, kategorie, ref FROM fiaon_dokumente
                           WHERE id = ${id} AND person_id = ${personId} AND art = 'unterlage' AND geloescht_am IS NULL
                             AND (${!nurAktiv} OR entfernt_am IS NULL) LIMIT 1`) as any[];
  if (!d) return null;
  const inhalt: Buffer = Buffer.isBuffer(d.inhalt) ? d.inhalt : Buffer.from(d.inhalt);
  if (!inhalt.length) return null; // vom Kunden entfernt — der Inhalt ist gelöscht
  const typ = typAmInhalt(inhalt);
  return { inhalt, mime: typ === "pdf" ? "application/pdf" : typ === "png" ? "image/png" : "image/jpeg", dateiname: String(d.dateiname), kategorie: String(d.kategorie), ref: d.ref ?? null };
}

// ───────────────────────────────────────────────────────────────────────────
// Ausweis-Kontext für die Prüfung der Akte-Fassung
// ───────────────────────────────────────────────────────────────────────────
export async function ausweisKontextFuerRef(ref: string, lauf: Lauf = sqlPool): Promise<{ erklaert: (string | null)[]; aufenthaltstitelUnterWeitere: boolean }> {
  if (!(await unterlagenBereit(lauf))) return { erklaert: [], aufenthaltstitelUnterWeitere: false };
  const [a] = (await lauf`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
  if (!a?.person_id) return { erklaert: [], aufenthaltstitelUnterWeitere: false };
  const rows = (await lauf`SELECT kategorie, unterart FROM fiaon_dokumente
                            WHERE person_id = ${a.person_id} AND art = 'unterlage' AND kategorie IN ('ausweis', 'weitere')
                              AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
  return {
    erklaert: rows.filter((r) => r.kategorie === "ausweis").map((r) => r.unterart ?? null),
    aufenthaltstitelUnterWeitere: rows.some((r) => r.kategorie === "weitere" && r.unterart === "aufenthaltstitel"),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Der Anstoß — entprellt, dauerhaft
// ───────────────────────────────────────────────────────────────────────────
const uhren = new Map<string, ReturnType<typeof setTimeout>>();

/** Plant Prüfung + Analyse nach der letzten Datei (Zeitpunkt steht schon in der Datenbank). */
export function anstossPlanen(personId: number, k: UnterlagenKategorie, nachMs = ANSTOSS_NACH_MS + 1000): void {
  const schluessel = `${personId}:${k}`;
  const alt = uhren.get(schluessel);
  if (alt) clearTimeout(alt);
  const uhr = setTimeout(() => {
    uhren.delete(schluessel);
    void anstossAusfuehren(personId, k).catch((e) => console.error("[UNTERLAGEN] Anstoß:", String(e?.message || e).slice(0, 200)));
  }, nachMs);
  (uhr as any).unref?.();
  uhren.set(schluessel, uhr);
}

/** Sofort lesen („Neu lesen" im Office) — derselbe Weg wie der entprellte Anstoß. */
export async function sofortLesen(personId: number, k: UnterlagenKategorie, wer: Handelnder, lauf: Lauf = sqlPool): Promise<AktionErgebnis> {
  if (!(await unterlagenBereit(lauf))) return { ok: false, status: 503, satz: "Gerade nicht möglich." };
  if (istGebunden(k)) {
    const [da] = (await lauf.unsafe(`SELECT 1 FROM fiaon_applications WHERE person_id = $1 AND gdpr_deleted_at IS NULL AND LENGTH(${spalteVon(k)}) > 0 LIMIT 1`, [personId])) as any[];
    if (!da) return { ok: false, status: 409, satz: `${kategorieInfo(k).kurz}: Hier liegt noch nichts zum Lesen.` };
  }
  // „neu_lesen": wertet auch eine schon ausgewertete Auskunft neu aus (sonst nicht automatisch) und legt
  // keine neue Aufgabe „Unterlagen eingegangen" an — außer ein Kunden-Upload dieses Stapels steht noch aus.
  await lauf`INSERT INTO fiaon_unterlagen_akte (person_id, kategorie, anstoss_faellig_am, anstoss_von, updated_at)
             VALUES (${personId}, ${k}, NOW(), 'neu_lesen', NOW())
             ON CONFLICT (person_id, kategorie) DO UPDATE SET anstoss_faellig_am = NOW(),
               anstoss_von = CASE WHEN fiaon_unterlagen_akte.anstoss_von = 'kunde' AND fiaon_unterlagen_akte.anstoss_faellig_am IS NOT NULL THEN 'kunde' ELSE 'neu_lesen' END,
               updated_at = NOW()`;
  anstossPlanen(personId, k, 50);
  return { ok: true, satz: `${kategorieInfo(k).kurz} wird neu gelesen — der Befund steht in ein bis drei Minuten hier.` };
}

/**
 * Prüfung + Analyse + EINE Aufgabe an die Verwaltung. Atomar beansprucht: Zwei
 * Instanzen (oder Uhr und Takt) lesen denselben Stapel nie doppelt; ein neuerer
 * Upload, der die Fälligkeit nach hinten schob, gewinnt.
 */
export async function anstossAusfuehren(personId: number, k: UnterlagenKategorie, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!(await unterlagenBereit(lauf))) return false;
  const [anspruch] = (await lauf`
    UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NULL, anstoss_lauf_am = NOW(), updated_at = NOW()
     WHERE person_id = ${personId} AND kategorie = ${k} AND anstoss_faellig_am IS NOT NULL AND anstoss_faellig_am <= NOW()
     RETURNING anstoss_von`) as any[];
  if (!anspruch) return false;
  const vomKunden = anspruch.anstoss_von === "kunde";
  const traeger = await traegerRef(personId, lauf);
  if (!traeger) return true;
  // E-IT-C Nachbesserung: Die weiteren Dateien eines Stapels bindet der Anstoß EINMAL — vor dem Lesen der Spalte.
  if (istGebunden(k) && (await bindenNoetig(personId, k, lauf))) {
    await akteFassungBinden(personId, k, lauf);
    await traegerWeiter(personId, lauf);
  }
  const stand = await unterlagenStand(personId, "office", lauf).catch(() => null);
  const kat = stand?.kategorien.find((x) => x.kategorie === k);
  let befund = "";
  if (istGebunden(k)) {
    const spalte = spalteVon(k);
    const [z] = (await lauf.unsafe(`SELECT ${spalte} AS pdf FROM fiaon_applications WHERE ref = $1 AND LENGTH(${spalte}) > 0`, [traeger])) as any[];
    if (z?.pdf) {
      const pdf: Buffer = Buffer.isBuffer(z.pdf) ? z.pdf : Buffer.from(z.pdf);
      try {
        const { pruefungAnstossen } = await import("./fiaon-dokument-pruefung");
        const ctx = k === "ausweis" ? await ausweisKontextFuerRef(traeger, lauf) : undefined;
        const u = await pruefungAnstossen(traeger, k as DokumentArt, pdf, 180_000, ctx);
        if (u && (u.erkannt === false || u.vollstaendig === false) && u.hinweisIntern) befund = u.hinweisIntern;
      } catch (e) { console.error("[UNTERLAGEN] Prüfung:", String((e as Error)?.message || e).slice(0, 160)); }
      if (k === "kontoauszug") {
        await import("./fiaon-kontoauszug-analyse").then(({ kontoauszugAnalysieren }) => kontoauszugAnalysieren(traeger, { erzwingen: true }))
          .catch((e) => console.error("[UNTERLAGEN] Analyse:", String(e?.message || e).slice(0, 160)));
      }
      if (k === "schufa") {
        // E-IT-C Nachbesserung: Eine schon geprüfte/ausgewertete Auskunft wird nicht automatisch neu gerechnet
        // (sonst kippte die Auswertung auf die Mischdatei und der Löschantrag-Vermerk ginge verloren) — nur
        // über „Neu lesen".
        if (anspruch.anstoss_von === "neu_lesen" || !(await auskunftAbgeschlossen(personId, lauf))) {
          await import("./fiaon-schufa-analyse").then(({ schufaAnalysieren }) => schufaAnalysieren(traeger, { erzwingen: true }))
            .catch((e) => console.error("[UNTERLAGEN] SCHUFA-Analyse:", String(e?.message || e).slice(0, 160)));
        } else {
          befund = befund || "Auskunft war schon ausgewertet — die neue Fassung wertet erst „Neu lesen“ aus.";
        }
      }
    }
  }
  // EINE Aufgabe an die Verwaltung je Stapel — und keine zweite, solange eine offene da ist: Die offene
  // System-Aufgabe der letzten 24 Stunden bekommt dann den neuen Stand (alle Kategorien des Stapels).
  if (vomKunden && (kat?.dateien.length ?? 0) > 0) {
    const stapel = (await lauf`
      SELECT kategorie, count(*)::int AS n FROM fiaon_dokumente
       WHERE person_id = ${personId} AND art = 'unterlage' AND quelle = 'kunde' AND entfernt_am IS NULL AND geloescht_am IS NULL
         AND hochgeladen_am > NOW() - INTERVAL '24 hours'
       GROUP BY kategorie ORDER BY kategorie`) as any[];
    const was = (stapel.length ? stapel : [{ kategorie: k, n: kat?.dateien.length ?? 1 }])
      .map((z: any) => `${kategorieInfo(String(z.kategorie) as UnterlagenKategorie).kurz}: ${z.n} Datei${Number(z.n) === 1 ? "" : "en"}`).join(", ");
    const text = `Unterlagen eingegangen (${was}) — bitte prüfen und in der Akte unter Dokumente „Geprüft“ setzen. Der Kunde sieht „Wird geprüft“.${befund ? ` ⚠ Automatische Prüfung meldet: ${befund}` : ""}`;
    const [offen] = (await lauf`SELECT id FROM fiaon_vermerke WHERE ref = ${traeger} AND art = 'aufgabe' AND status = 'offen' AND autor_art = 'system'
                                 AND text LIKE 'Unterlagen eingegangen%' AND created_at > NOW() - INTERVAL '24 hours' ORDER BY id DESC LIMIT 1`) as any[];
    if (offen) {
      await lauf`UPDATE fiaon_vermerke SET text = ${text}, dringend = (dringend OR ${!!befund}), updated_at = NOW() WHERE id = ${offen.id}`
        .catch((e: any) => console.error("[UNTERLAGEN] Aufgabe nicht ergänzt:", e?.message));
    } else {
      await lauf`
        INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
        VALUES ('aufgabe', ${traeger}, ${text}, 'betreiber', TRUE, ${!!befund}, 'offen', 'system', 'System', ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 2))`
        .catch((e: any) => console.error("[UNTERLAGEN] Aufgabe nicht angelegt:", e?.message));
    }
  }
  return true;
}

/** Takt unterlagen_anstoss: was eine Uhr verpasst hat (Neustart, Deploy), holt dieser Lauf nach. */
export async function anstoesseNachholen(grenze = 10, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!(await unterlagenBereit(lauf))) return false;
  const rows = (await lauf`SELECT person_id, kategorie FROM fiaon_unterlagen_akte
                            WHERE anstoss_faellig_am IS NOT NULL AND anstoss_faellig_am < NOW() - INTERVAL '20 seconds'
                            ORDER BY anstoss_faellig_am ASC LIMIT ${grenze}`) as any[];
  let getan = false;
  for (const r of rows) {
    const ok = await anstossAusfuehren(Number(r.person_id), String(r.kategorie) as UnterlagenKategorie, lauf)
      .catch((e) => { console.error("[UNTERLAGEN] Nachholen:", String(e?.message || e).slice(0, 160)); return false; });
    getan = getan || ok;
  }
  return getan;
}

// ───────────────────────────────────────────────────────────────────────────
// Personen-Zusammenführung (server/lib/fiaon-person-merge.ts, in DERSELBEN Transaktion)
// ───────────────────────────────────────────────────────────────────────────
const GEBUNDENE: GebundeneKategorie[] = ["kontoauszug", "ausweis", "schufa"];

/**
 * VOR dem Umhängen der Bestellungen: Was bei Gewinner oder Verlierer nur in einer Spalte liegt
 * (Bestand ohne Zeile), wird jetzt Zeile — danach hängen die Bestellungen um und niemand kann
 * es mehr zuordnen. E-IT-C Nachbesserung.
 */
export async function vorZusammenfuehrung(gewinnerId: number, verliererId: number, lauf: Lauf): Promise<void> {
  for (const pid of [verliererId, gewinnerId]) for (const k of GEBUNDENE) await bestandUebernehmen(pid, k, lauf);
}

/**
 * NACH dem Umhängen (Bestellungen, Dateien, Verlierer ist Wegweiser): Die Akte des Gewinners wird
 * je Kategorie EINMAL aus allen aktiven Dateien gebunden. Die alten Fassungen beider Seiten (an den
 * jetzt gemeinsamen Bestellungen) sind durch Zeilen vertreten und werden dabei ersetzt bzw. geleert —
 * ohne diese Bindung erkannte das nächste Hinzufügen die Fassung des Verlierers als „fremd", entfernte
 * die Dateien des Gewinners und doppelte die Seiten (E-IT-C Nachbesserung). Kategorien ohne aktive
 * Datei bleiben unberührt. Der Verlierer behält seine Akte-Zeilen als Wegweiser (ihre Prüfsummen
 * erkennt bestandUebernehmen), aber ohne offenen Anstoß.
 */
export async function nachZusammenfuehrung(gewinnerId: number, verliererId: number, lauf: Lauf): Promise<void> {
  for (const k of GEBUNDENE) {
    const [n] = (await lauf`SELECT count(*)::int AS n FROM fiaon_dokumente WHERE person_id = ${gewinnerId} AND art = 'unterlage' AND kategorie = ${k}
                              AND entfernt_am IS NULL AND geloescht_am IS NULL`) as any[];
    if (!Number(n?.n)) continue;
    const erg = await akteFassungBinden(gewinnerId, k, lauf);
    if (!erg.ok) console.warn(`[UNTERLAGEN] Zusammenführung ${verliererId} → ${gewinnerId}/${k}: ${erg.grund ?? "nicht gebunden"}`);
  }
  await lauf`UPDATE fiaon_unterlagen_akte SET anstoss_faellig_am = NULL, updated_at = NOW() WHERE person_id = ${verliererId} AND anstoss_faellig_am IS NOT NULL`;
}

/** Darf diese Rolle Inhalte sehen? Wie die Akte (darfInhalt) — plus wer den Kunden betreut. */
export function inhaltErlaubt(rolle: string, zustaendig: boolean): boolean {
  return darfInhalt(rolle) || zustaendig;
}
