// ═══════════════════════════════════════════════════════════════════════════
// DAS GLOBAL-MANDAT — Server (E-338, 12.10.2026)
//
// Justin: „Wir haben unser Dashboard gerade super vermischt mit Privatkunden …
//          Die Firmenkunden brauchen ein PERFEKTES Dashboard … UND unser Admin
//          Dashboard braucht eine Global Seite … 100 % synchron … und so, dass
//          sich das NICHT vermischt."
//
// Die Akte bleibt `fiaon_global_auftraege` (Schlüssel `ref`); Office, Chefbüro
// und Portal lesen dieselben Zeilen. Dieses Modul ergänzt, was dem Mandat
// fehlte — alles an derselben `ref`:
//
//   fiaon_global_schritte     der Fahrplan (Name → Gründung → EIN → Konto → Karten → Rahmen)
//   fiaon_global_kapital      Banken & Kapital: Konto, Karte, Kreditrahmen, Darlehen mit Status
//   fiaon_global_nachrichten  Anfragen und Antworten — ein Gesprächsfaden statt Einbahnstraße
//   fiaon_global_dokumente    + Titel, „vom Kunden gelesen", Post (Absender, Eingang), Unterschrift
//   fiaon_global_auftraege    + person_id, gesellschaft_plus (EIN, Registernummer, Agent, US-Adresse),
//                               ist_test_am, portal_neu_am (das neue Portal je Kunde freigeschaltet)
//
// FREIGABE: Das neue Portal sieht ein Kunde erst, wenn die Leitung es für
// IHN freischaltet (portal_neu_am). Bis dahin bleibt sein bisheriges „Mein
// Auftrag". Die Leitung sieht die Vorschau über das Chefbüro.
//
// VORSCHAU ZÄHLT NICHT: Öffnet die Leitung das Portal als Vorschau, wird
// nichts als „vom Kunden gelesen" vermerkt — keine Post, keine Antwort, kein
// Dokument (Justin, Regel „Kundenlinks nie selbst öffnen").
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { escapeHtml } from "./fiaon-html-pdf";
import {
  ensureGlobalBereich, lageLesen, verlaufSchreiben, dokumentSpeichern, nameAusMultipart, bereichMail, kundensatz, eingangMelden,
  globalBereichOfficeSicht, globalGesellschaftSetzen,
  type BereichAgent, type DateiEin, type Erg, type Lage,
} from "./fiaon-global-bereich";
import { globalDokumentArt, globalDokumentArtText, istIsoTag, type BereichSprache } from "@shared/fiaon-global-bereich";
import {
  GLOBAL_FAHRPLAN, GLOBAL_GESELLSCHAFT_PLUS_FELDER, globalEinFormat, globalKapitalArt, globalKapitalArtTitel, globalKapitalStatus,
  globalKapitalStatusTitel, globalKapitalZaehlt, globalSchrittStatus, globalSchrittText, globalSchrittTitel, globalSchrittVorlage,
  globalTresorKategorie, type GlobalGesellschaftPlus,
} from "@shared/fiaon-global-mandat";
import { GLOBAL_STATION_FELDER, globalPlusFuerKunde, globalPlusFuerTeam, stationVerlaufSaetze, stationWertePruefen } from "@shared/fiaon-global-stationen";
import { GLOBAL_DATEI_MAX_BYTES, GLOBAL_DOKUMENTE_MAX, globalDateiTyp, globalDateiname } from "./fiaon-global-bereich-regeln";
import { globalMeinAuftragUrl, globalTokenErzeugen } from "./fiaon-global-auftrag";

const nein = (status: number, error: string) => ({ ok: false as const, status, error });
const iso = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const tag = (v: unknown): string | null => {
  if (!v) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
const knapp = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const absatz = (v: unknown, max: number) => String(v ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const t = (s: BereichSprache, de: string, en: string) => (s === "en" ? en : de);
function json<T>(v: unknown, leer: T): T {
  if (v && typeof v === "object") return v as T;
  try { return (JSON.parse(String(v ?? "")) as T) ?? leer; } catch { return leer; }
}

// ── SCHEMA ───────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureGlobalMandat(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await ensureGlobalBereich();
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx`
          ALTER TABLE fiaon_global_auftraege
            ADD COLUMN IF NOT EXISTS person_id INTEGER,
            ADD COLUMN IF NOT EXISTS gesellschaft_plus JSONB,
            ADD COLUMN IF NOT EXISTS ist_test_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS portal_neu_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS portal_neu_von TEXT`;
        await tx`
          ALTER TABLE fiaon_global_dokumente
            ADD COLUMN IF NOT EXISTS titel TEXT,
            ADD COLUMN IF NOT EXISTS kunde_gelesen_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS fiaon_gesehen_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS post_absender TEXT,
            ADD COLUMN IF NOT EXISTS post_eingang_am DATE,
            ADD COLUMN IF NOT EXISTS unterschrift_gefordert BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS unterschrieben_am TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS unterschrift_name TEXT,
            ADD COLUMN IF NOT EXISTS unterschrift_ip TEXT,
            ADD COLUMN IF NOT EXISTS unterschrift_von_id BIGINT`;
      });
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_schritte (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          schluessel TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'in_arbeit', 'beantragt', 'erledigt', 'entfaellt')),
          datum DATE,
          beantragt_am DATE,
          hinweis TEXT,
          intern TEXT,
          geaendert_von TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (ref, schluessel)
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_kapital (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          art TEXT NOT NULL,
          institut TEXT,
          produkt TEXT,
          status TEXT NOT NULL DEFAULT 'vorbereitung',
          betrag_cents BIGINT,
          beantragt_am DATE,
          entschieden_am DATE,
          hinweis TEXT,
          intern TEXT,
          sichtbar BOOLEAN NOT NULL DEFAULT TRUE,
          geaendert_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          geloescht_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_kapital_ref_idx ON fiaon_global_kapital (ref) WHERE geloescht_am IS NULL`;
      // Stationen-Editor (22.10.2026, Migration 121): „beantragt“ als Status, Antragsdatum, Karte privat/Firma.
      await stationenSchemaSichern();
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_nachrichten (
          id BIGSERIAL PRIMARY KEY,
          ref VARCHAR NOT NULL,
          von TEXT NOT NULL CHECK (von IN ('kunde', 'fiaon')),
          agent_id INTEGER,
          autor TEXT,
          text TEXT NOT NULL,
          dokument_id BIGINT,
          verlauf_id BIGINT UNIQUE,
          gelesen_kunde_am TIMESTAMPTZ,
          gelesen_fiaon_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_nachrichten_ref_idx ON fiaon_global_nachrichten (ref, created_at)`;
      // Die Person an der Akte: bisher nur über die Bestellzeile erreichbar — jetzt ein Feld.
      await sqlPool`
        UPDATE fiaon_global_auftraege g SET person_id = a.person_id
          FROM fiaon_applications a
         WHERE a.ref = g.ref AND g.person_id IS NULL AND a.person_id IS NOT NULL`.catch((e) => console.error("[GLOBAL-MANDAT] person_id nachtragen:", e));
      // Nachrichten, die Kunden vor E-338 aus „Mein Auftrag" schickten, stehen nur im Verlauf — sie kommen in den Faden.
      await sqlPool`
        INSERT INTO fiaon_global_nachrichten (ref, von, text, verlauf_id, gelesen_fiaon_am, created_at)
        SELECT v.ref, 'kunde', v.text, v.id, v.created_at, v.created_at
          FROM fiaon_global_verlauf v
         WHERE v.art = 'nachricht' AND v.von = 'kunde'
           AND NOT EXISTS (SELECT 1 FROM fiaon_global_nachrichten n WHERE n.verlauf_id = v.id)`.catch((e) => console.error("[GLOBAL-MANDAT] Nachrichten übernehmen:", e));
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * Migration 121 zur Laufzeit: Spalten dazu (IF NOT EXISTS, keine Sperre auf Daten) und die Status-Wand WEITER machen —
 * nur, wenn sie „beantragt“ noch nicht kennt (pg_constraint lesen, dann EIN ALTER mit NOT VALID, ohne Tabellen-Scan).
 * Muster: firmaTeileCheckSichern (fiaon-global-angebot.ts).
 */
async function stationenSchemaSichern(): Promise<void> {
  await sqlPool.begin(async (tx: any) => {
    await tx`SET LOCAL lock_timeout = '3s'`;
    await tx`ALTER TABLE fiaon_global_schritte ADD COLUMN IF NOT EXISTS beantragt_am DATE`;
    await tx`ALTER TABLE fiaon_global_kapital ADD COLUMN IF NOT EXISTS inhaber TEXT`;
    const [c] = (await tx`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'fiaon_global_schritte_status_check' LIMIT 1`) as any[];
    if (!c || !/'beantragt'/.test(String(c.def))) {
      await tx`
        ALTER TABLE fiaon_global_schritte
          DROP CONSTRAINT IF EXISTS fiaon_global_schritte_status_check,
          ADD CONSTRAINT fiaon_global_schritte_status_check CHECK (status IN ('offen', 'in_arbeit', 'beantragt', 'erledigt', 'entfaellt')) NOT VALID`;
    }
  });
}

// ── LESEN ────────────────────────────────────────────────────────────────────
interface SchrittZeile { schluessel: string; etappe: number; titel: string; text: string; status: string; datum: string | null; beantragtAm: string | null; hinweis: string | null; intern?: string | null; geaendertVon?: string | null; geaendertAm?: string | null }

async function schritteLesen(ref: string, sprache: BereichSprache, fuer: "kunde" | "chef"): Promise<SchrittZeile[]> {
  const zeilen = (await sqlPool`
    SELECT schluessel, status, datum, beantragt_am, hinweis, intern, geaendert_von, updated_at FROM fiaon_global_schritte WHERE ref = ${ref}`) as any[];
  const nach = new Map(zeilen.map((z) => [String(z.schluessel), z]));
  return GLOBAL_FAHRPLAN.map((v) => {
    const z = nach.get(v.schluessel);
    return {
      schluessel: v.schluessel, etappe: v.etappe,
      titel: globalSchrittTitel(v.schluessel, sprache), text: globalSchrittText(v.schluessel, sprache),
      status: z ? String(z.status) : "offen", datum: z ? tag(z.datum) : null, beantragtAm: z ? tag(z.beantragt_am) : null, hinweis: z?.hinweis ? String(z.hinweis) : null,
      ...(fuer === "chef" ? { intern: z?.intern ? String(z.intern) : null, geaendertVon: z?.geaendert_von ?? null, geaendertAm: iso(z?.updated_at) } : {}),
    };
  }).filter((s) => fuer === "chef" || s.status !== "entfaellt");
}

async function kapitalLesen(ref: string, sprache: BereichSprache, fuer: "kunde" | "chef"): Promise<Record<string, unknown>[]> {
  const zeilen = (await sqlPool`
    SELECT id, art, institut, produkt, inhaber, status, betrag_cents, beantragt_am, entschieden_am, hinweis, intern, sichtbar, geaendert_von, updated_at
      FROM fiaon_global_kapital WHERE ref = ${ref} AND geloescht_am IS NULL
     ORDER BY COALESCE(beantragt_am, created_at::date) ASC, id ASC`) as any[];
  // 22.10.2026 (Stationen-Editor): Der Kunde sieht nie Institut oder Produktnamen (keine Banknamen) und einen Betrag
  // erst, wenn er zugesagt bzw. aktiv ist — über Konto, Karte und Rahmen entscheidet das Institut.
  const kunde = fuer === "kunde";
  return zeilen.filter((z) => !kunde || z.sichtbar).map((z) => ({
    id: Number(z.id), art: String(z.art), artText: globalKapitalArtTitel(String(z.art), sprache),
    institut: !kunde && z.institut ? String(z.institut) : null, produkt: !kunde && z.produkt ? String(z.produkt) : null,
    inhaber: z.inhaber === "privat" || z.inhaber === "firma" ? String(z.inhaber) : null,
    status: String(z.status), statusText: globalKapitalStatusTitel(String(z.status), sprache),
    betragCents: z.betrag_cents != null && (!kunde || z.status === "zugesagt" || z.status === "aktiv") ? Number(z.betrag_cents) : null,
    beantragtAm: tag(z.beantragt_am), entschiedenAm: tag(z.entschieden_am), hinweis: z.hinweis ? String(z.hinweis) : null,
    ...(fuer === "chef" ? { intern: z.intern ? String(z.intern) : null, sichtbar: !!z.sichtbar, geaendertVon: z.geaendert_von ?? null, geaendertAm: iso(z.updated_at) } : {}),
  }));
}

async function nachrichtenLesen(ref: string, fuer: "kunde" | "chef"): Promise<Record<string, unknown>[]> {
  const zeilen = (await sqlPool`
    SELECT n.id, n.von, n.autor, n.text, n.dokument_id, n.gelesen_kunde_am, n.gelesen_fiaon_am, n.created_at, ag.name AS agent_name, ag.first_name
      FROM fiaon_global_nachrichten n LEFT JOIN fiaon_agents ag ON ag.id = n.agent_id
     WHERE n.ref = ${ref} ORDER BY n.created_at ASC, n.id ASC LIMIT 500`) as any[];
  return zeilen.map((n) => ({
    id: Number(n.id), von: String(n.von), text: String(n.text), am: iso(n.created_at),
    autor: n.von === "kunde" ? null : (n.autor ? String(n.autor) : (n.agent_name ? String(n.agent_name) : "FIAON")),
    ...(n.dokument_id ? { dokumentId: Number(n.dokument_id) } : {}),
    gelesen: n.von === "kunde" ? !!n.gelesen_fiaon_am : !!n.gelesen_kunde_am,
    ...(fuer === "chef" ? { gelesenAm: iso(n.von === "kunde" ? n.gelesen_fiaon_am : n.gelesen_kunde_am) } : {}),
  }));
}

/** Die Zusatzfelder der Dokumente (Titel, Post, Unterschrift, gelesen) — nach id. */
async function dokumentZusatzLesen(ref: string): Promise<Map<number, any>> {
  const zeilen = (await sqlPool`
    SELECT id, art, titel, kunde_gelesen_am, fiaon_gesehen_am, post_absender, post_eingang_am, unterschrift_gefordert, unterschrieben_am,
           unterschrift_name, unterschrift_von_id, mime
      FROM fiaon_global_dokumente WHERE ref = ${ref} AND geloescht_am IS NULL`) as any[];
  return new Map(zeilen.map((z) => [Number(z.id), z]));
}

function dokumentZusatz(z: any): Record<string, unknown> {
  if (!z) return {};
  return {
    kategorie: globalTresorKategorie(z.art),
    ...(z.titel ? { titel: String(z.titel) } : {}),
    gelesen: !!z.kunde_gelesen_am,
    ...(String(z.art) === "post" ? { post: { absender: z.post_absender ? String(z.post_absender) : null, eingangAm: tag(z.post_eingang_am) } } : {}),
    ...(z.unterschrift_gefordert ? { unterschrift: { gefordert: true, unterschrieben: !!z.unterschrieben_am, am: iso(z.unterschrieben_am), name: z.unterschrift_name ?? null } } : {}),
    ...(z.unterschrift_von_id ? { unterschriebeneFassungVon: Number(z.unterschrift_von_id) } : {}),
    istPdf: String(z.mime) === "application/pdf",
  };
}

function gesellschaftPlusLesen(akte: any): GlobalGesellschaftPlus {
  return json<GlobalGesellschaftPlus>(akte?.gesellschaft_plus, {});
}
async function plusRoh(ref: string): Promise<GlobalGesellschaftPlus> {
  const [z] = (await sqlPool`SELECT gesellschaft_plus FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  return gesellschaftPlusLesen(z);
}

async function mandatZeile(ref: string): Promise<any | null> {
  await ensureGlobalMandat();
  const [z] = (await sqlPool`
    SELECT ref, person_id, gesellschaft_plus, ist_test_am, portal_neu_am, portal_neu_von, angebot_id, email
      FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  return z ?? null;
}

/** Ist für diesen Auftrag das neue Portal freigeschaltet? */
export async function globalPortalNeuFrei(ref: string): Promise<boolean> {
  const z = await mandatZeile(ref).catch(() => null);
  return !!z?.portal_neu_am;
}

/**
 * Der Zusatz für das NEUE Portal — nur, wenn es für den Kunden freigeschaltet ist
 * oder die Leitung die Vorschau öffnet. `token` ist der gültige Link-Schlüssel.
 */
export async function globalMandatKundenZusatz(ref: string, token: string, sprache: BereichSprache, vorschau: boolean): Promise<Record<string, unknown>> {
  const z = await mandatZeile(ref);
  const [schritte, kapital, nachrichten, zusatz, dienste] = await Promise.all([
    schritteLesen(ref, sprache, "kunde"), kapitalLesen(ref, sprache, "kunde"), nachrichtenLesen(ref, "kunde"), dokumentZusatzLesen(ref),
    // Scheibe 1 „Ihr US-Büro“: gebuchte Zusatzdienste und was der Auftrag schon enthält (Texte liest die Seite aus shared/).
    // Ein Fehler hier leert nur den Bereich „Ihr Büro erweitern“ — das Portal lädt trotzdem.
    // Freigabe je Dienst: Der Kunde bekommt nur die freigegebenen; die Vorschau der Leitung alle (die Seite markiert den Rest).
    import("./fiaon-global-zusatz").then(async (m) => ({ gebucht: await m.zusatzKundenSicht(ref, token, vorschau), enthalten: await m.zusatzEnthalten(ref), freigegeben: await m.zusatzFreigabeLesen() }))
      .catch((e) => { console.error(`[GLOBAL-MANDAT] ${ref}: Zusatzdienste nicht gelesen:`, e); return { gebucht: [], enthalten: [], freigegeben: [] as string[], fehler: true }; }),
  ]);
  // Die Anrede für den Gruß („Guten Abend, Herr Hildbrand“) — nur Anrede und Nachname, nichts sonst.
  const [akte] = (await sqlPool`SELECT ansprechpartner FROM fiaon_global_auftraege WHERE ref = ${ref} LIMIT 1`) as any[];
  const ap = json<Record<string, any>>(akte?.ansprechpartner, {});
  const anrede = ["Herr", "Frau", "Mr", "Mrs", "Ms"].includes(String(ap.anrede || "").trim()) ? String(ap.anrede).trim() : null;
  return {
    portalNeu: true,
    gruss: {
      anrede, nachname: ap.nachname ? String(ap.nachname).trim() : null, vorname: ap.vorname ? String(ap.vorname).trim() : null,
      name: [ap.vorname, ap.nachname].filter(Boolean).join(" ").trim() || (ap.name ? String(ap.name).trim() : null),
    },
    ...(vorschau ? { vorschau: true } : {}),
    schritte, kapital, nachrichten, dienste,
    // Nur freigegebene Felder; die ITIN als Maske (Klartext nur über „Anzeigen“ → /itin).
    gesellschaftPlus: globalPlusFuerKunde(gesellschaftPlusLesen(z)),
    dokumentZusatz: Object.fromEntries(Array.from(zusatz.entries()).map(([id, d]) => [String(id), dokumentZusatz(d)])),
  };
}

// ── CHEFBÜRO: DIE LISTE ──────────────────────────────────────────────────────
export async function globalMandateListe(): Promise<Record<string, unknown>> {
  await ensureGlobalMandat();
  const akten = (await sqlPool`
    SELECT g.ref, g.paket_key, g.firma_name, g.firma, g.ansprechpartner, g.email, g.etappe, g.gesellschaft, g.gesellschaft_plus,
           g.stichtag, g.naechster_schritt, g.naechster_schritt_bis, g.created_at, g.ist_test_am, g.portal_neu_am, g.person_id,
           g.zustaendig_agent_id, ag.name AS zustaendig_name,
           (SELECT COUNT(*)::int FROM fiaon_global_nachrichten n WHERE n.ref = g.ref AND n.von = 'kunde' AND n.gelesen_fiaon_am IS NULL) AS anfragen_neu,
           (SELECT COUNT(*)::int FROM fiaon_global_dokumente d WHERE d.ref = g.ref AND d.von = 'kunde' AND d.fiaon_gesehen_am IS NULL AND d.geloescht_am IS NULL) AS uploads_neu,
           (SELECT COUNT(*)::int FROM fiaon_global_dokumente d WHERE d.ref = g.ref AND d.unterschrift_gefordert AND d.unterschrieben_am IS NULL AND d.geloescht_am IS NULL) AS unterschriften_offen,
           (SELECT COUNT(*)::int FROM fiaon_global_dokumente d WHERE d.ref = g.ref AND d.art = 'post' AND d.kunde_gelesen_am IS NULL AND d.geloescht_am IS NULL) AS post_ungelesen,
           (SELECT MIN(f.faellig_am) FROM fiaon_global_fristen f WHERE f.ref = g.ref AND f.erledigt_am IS NULL) AS naechste_frist,
           (SELECT COUNT(*)::int FROM fiaon_global_schritte s WHERE s.ref = g.ref AND s.status = 'erledigt') AS schritte_erledigt,
           (SELECT COUNT(*)::int FROM fiaon_global_schritte s WHERE s.ref = g.ref AND s.status = 'entfaellt') AS schritte_entfallen
      FROM fiaon_global_auftraege g
      LEFT JOIN fiaon_agents ag ON ag.id = g.zustaendig_agent_id
     ORDER BY g.created_at DESC`) as any[];
  const mandate: Record<string, unknown>[] = [];
  for (const a of akten) {
    const l = await lageLesen(String(a.ref)).catch(() => null);
    const firma = json<Record<string, any>>(a.firma, {});
    const ap = json<Record<string, any>>(a.ansprechpartner, {});
    const g = json<Record<string, any>>(a.gesellschaft, {});
    const kunde = [ap.vorname, ap.nachname].filter(Boolean).join(" ").trim() || String(firma.name || a.firma_name || "");
    const gesamt = GLOBAL_FAHRPLAN.length - Number(a.schritte_entfallen || 0);
    mandate.push({
      ref: String(a.ref), status: l?.status ?? "offen", paket: String(a.paket_key),
      kunde, firma: firma.art === "privat" ? null : String(firma.name || a.firma_name || "") || null,
      email: a.email ? String(a.email) : null, personId: a.person_id != null ? Number(a.person_id) : null,
      llc: g.name ? String(g.name) : null, bundesstaat: g.bundesstaat ? String(g.bundesstaat) : null,
      etappe: l?.etappe ?? Number(a.etappe || 0),
      fortschritt: { erledigt: Number(a.schritte_erledigt || 0), gesamt: Math.max(1, gesamt) },
      naechsterSchritt: a.naechster_schritt ? String(a.naechster_schritt) : null,
      stichtag: tag(a.stichtag), naechsteFrist: tag(a.naechste_frist),
      zustaendig: a.zustaendig_name ? String(a.zustaendig_name) : null,
      anfragenNeu: Number(a.anfragen_neu || 0), uploadsNeu: Number(a.uploads_neu || 0),
      unterschriftenOffen: Number(a.unterschriften_offen || 0), postUngelesen: Number(a.post_ungelesen || 0),
      test: !!a.ist_test_am, portalNeu: !!a.portal_neu_am, angelegtAm: iso(a.created_at),
    });
  }
  const angebote = (await sqlPool`
    SELECT a.id, a.angebot_ref, a.fassung, a.status, a.kunde, a.gueltig_bis, a.angenommen_am, a.person_id, a.created_at
      FROM fiaon_global_angebote a
     WHERE a.auftrag_ref IS NULL AND a.status IN ('offen', 'angenommen')
     ORDER BY a.created_at DESC`) as any[];
  const echt = mandate.filter((m) => !m.test && m.status !== "storniert");
  const heute = berlinToday();
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  return {
    mandate,
    angebote: angebote.map((a) => {
      const k = json<Record<string, any>>(a.kunde, {});
      const fassung = String(a.fassung || "");
      return {
        id: Number(a.id), angebotRef: String(a.angebot_ref), status: String(a.status),
        art: fassung.startsWith("IA-FIRMA") ? "firma" : fassung.startsWith("IA-BEGLEIT") ? "begleit" : fassung.startsWith("IA-KOOP") ? "koop" : fassung.startsWith("IA-KAPITAL") ? "kapital" : "individuell",
        kunde: String(k.name || [k.vorname, k.nachname].filter(Boolean).join(" ") || k.firma || "—"),
        firma: k.firma ? String(k.firma) : null,
        gueltigBis: tag(a.gueltig_bis), angenommenAm: iso(a.angenommen_am), personId: a.person_id != null ? Number(a.person_id) : null,
      };
    }),
    kennzahlen: {
      aktiv: echt.filter((m) => m.status !== "abgeschlossen").length,
      zahlungOffen: echt.filter((m) => m.status === "offen").length,
      anfragenNeu: echt.reduce((s, m) => s + Number(m.anfragenNeu), 0),
      uploadsNeu: echt.reduce((s, m) => s + Number(m.uploadsNeu), 0),
      unterschriftenOffen: echt.reduce((s, m) => s + Number(m.unterschriftenOffen), 0),
      fristen30: echt.filter((m) => m.naechsteFrist && String(m.naechsteFrist) >= heute && String(m.naechsteFrist) <= in30).length,
      angeboteOffen: angebote.filter((a) => String(a.status) === "offen").length,
    },
  };
}

// ── CHEFBÜRO: EIN MANDAT ─────────────────────────────────────────────────────
export async function globalMandatChefSicht(ref: string): Promise<Record<string, unknown> | null> {
  await ensureGlobalMandat();
  const office = await globalBereichOfficeSicht(ref);
  if (!office) return null;
  const z = await mandatZeile(ref);
  const [schritte, kapital, nachrichten, zusatz] = await Promise.all([
    schritteLesen(ref, "de", "chef"), kapitalLesen(ref, "de", "chef"), nachrichtenLesen(ref, "chef"), dokumentZusatzLesen(ref),
  ]);
  // Was der Kunde hochgeladen hat, gilt mit dem Öffnen der Akte als gesehen — die Marke „neu" in der Liste verschwindet.
  await sqlPool`UPDATE fiaon_global_dokumente SET fiaon_gesehen_am = NOW() WHERE ref = ${ref} AND von = 'kunde' AND fiaon_gesehen_am IS NULL`.catch(() => {});
  let person: Record<string, unknown> | null = null;
  if (z?.person_id) {
    const [p] = (await sqlPool`
      SELECT id, first_name, last_name, primary_email, primary_phone, is_blocked FROM fiaon_persons WHERE id = ${Number(z.person_id)} LIMIT 1`.catch(() => [])) as any[];
    if (p) person = { id: Number(p.id), name: [p.first_name, p.last_name].filter(Boolean).join(" "), email: p.primary_email ?? null, telefon: p.primary_phone ?? null, gesperrt: !!p.is_blocked };
  }
  const zugesagtCents = (kapital as any[]).filter((k) => globalKapitalZaehlt(String(k.art), String(k.status))).reduce((s, k) => s + Number(k.betragCents || 0), 0);
  const r = encodeURIComponent(ref);
  return {
    ...office,
    // Im Chefbüro über die Chefbüro-Wege (requireChef) — nicht über die Office-Wege, die eine Office-Sitzung erwarten.
    dokumente: (office.dokumente as any[]).map((d) => ({ ...d, ...dokumentZusatz(zusatz.get(Number(d.id))), url: `/api/fiaon/chef/global/mandate/${r}/dokument/${d.id}` })),
    vertragUrl: office.vertragUrl ? `/api/fiaon/admin/global/auftraege/${r}/vertrag.pdf` : null,
    rechnungUrl: office.rechnungUrl ? `/api/fiaon/admin/global/auftraege/${r}/rechnung.pdf` : null,
    schritte, kapital, nachrichten, zugesagtCents,
    gesellschaftPlus: globalPlusFuerTeam(gesellschaftPlusLesen(z)),
    person,
    test: !!z?.ist_test_am,
    portal: { neu: !!z?.portal_neu_am, seit: iso(z?.portal_neu_am), von: z?.portal_neu_von ?? null },
  };
}

/** Der Link, mit dem die Leitung das NEUE Portal so sieht wie der Kunde — ohne dass etwas als gelesen gilt. */
export function globalVorschauLink(ref: string): string {
  const token = globalTokenErzeugen(ref, 2 * 60 * 60 * 1000);
  return `/business/auftrag/${encodeURIComponent(ref)}?t=${encodeURIComponent(token)}&vorschau=neu`;
}
/** Der Link, den der Kunde bekommt (ein Jahr gültig, verlängert sich beim Besuch). */
export function globalKundenLink(ref: string): string {
  return globalMeinAuftragUrl(ref);
}

// ── CHEFBÜRO: SCHREIBEN ──────────────────────────────────────────────────────
async function lageOder404(ref: string): Promise<Lage | { fehler: ReturnType<typeof nein> }> {
  await ensureGlobalMandat();
  const l = await lageLesen(ref);
  return l ?? { fehler: nein(404, "Diesen Auftrag gibt es nicht.") };
}

export async function globalSchrittSetzen(ref: string, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  const v = globalSchrittVorlage(ein.schluessel);
  if (!v) return nein(400, "Diesen Schritt gibt es nicht.");
  const status = globalSchrittStatus(ein.status) ?? "offen";
  const datum = ein.datum ? String(ein.datum) : null;
  if (datum && !istIsoTag(datum)) return nein(400, "Das Datum ist ungültig.");
  const hinweis = absatz(ein.hinweis, 600) || null;
  if (hinweis) { const f = kundensatz(hinweis); if (f) return nein(400, f); }
  const intern = absatz(ein.intern, 1200) || null;
  const [vorher] = (await sqlPool`SELECT status FROM fiaon_global_schritte WHERE ref = ${ref} AND schluessel = ${v.schluessel}`) as any[];
  const datumWert = datum ?? (status === "erledigt" && vorher?.status !== "erledigt" ? berlinToday() : null);
  await sqlPool`
    INSERT INTO fiaon_global_schritte (ref, schluessel, status, datum, hinweis, intern, geaendert_von, updated_at)
    VALUES (${ref}, ${v.schluessel}, ${status}, ${datumWert}, ${hinweis}, ${intern}, ${agent.name}, NOW())
    ON CONFLICT (ref, schluessel) DO UPDATE SET status = EXCLUDED.status,
      datum = COALESCE(EXCLUDED.datum, CASE WHEN EXCLUDED.status = fiaon_global_schritte.status THEN fiaon_global_schritte.datum END),
      hinweis = EXCLUDED.hinweis, intern = EXCLUDED.intern, geaendert_von = EXCLUDED.geaendert_von, updated_at = NOW()`;
  if (status === "erledigt" && vorher?.status !== "erledigt") {
    await verlaufSchreiben(ref, { art: "schritt", text: t(l.sprache, `Erledigt: ${globalSchrittTitel(v.schluessel, "de")}.`, `Done: ${globalSchrittTitel(v.schluessel, "en")}.`), sichtbar: true, agentId: agent.id });
  } else if (vorher?.status !== status) {
    await verlaufSchreiben(ref, { art: "schritt", text: `Schritt „${globalSchrittTitel(v.schluessel, "de")}“ → ${status}.`, sichtbar: false, agentId: agent.id });
  }
  return { ok: true, meldung: `„${globalSchrittTitel(v.schluessel, "de")}“ gespeichert.` };
}

export async function globalGesellschaftPlusSetzen(ref: string, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  // Die Grundangaben (Name, Form, Bundesstaat, gegründet, EIN ja/nein, ITIN) über den bestehenden Weg — der setzt auch die Pflichtfristen.
  const grund = ein.grund && typeof ein.grund === "object" ? (ein.grund as Record<string, unknown>) : null;
  let fristen = "";
  if (grund) {
    const g = await globalGesellschaftSetzen(ref, grund, agent, { vorZahlung: true });
    if (!g.ok) return g;
    const f = g.fristen;
    if (f.neu || f.geaendert || f.entfernt) fristen = ` Pflichtenkalender: ${f.neu} neu, ${f.geaendert} geändert, ${f.entfernt} entfernt.`;
  }
  // 22.10.2026: Die Felder des Stationen-Editors (ITIN, D-U-N-S, Konto, Adressen …) bleiben stehen, und von den sechs
  // Feldern dieses Formulars ändert sich nur, was MITGESCHICKT wird (leer = leeren). Vorher ersetzte es das ganze JSON
  // und hätte die ITIN gelöscht.
  const plus: GlobalGesellschaftPlus = { ...(await plusRoh(ref)) };
  const roh = ein.plus && typeof ein.plus === "object" ? (ein.plus as Record<string, unknown>) : {};
  for (const f of GLOBAL_GESELLSCHAFT_PLUS_FELDER) {
    if (!(f.feld in roh)) continue;
    // Adresse und Hinweis behalten ihre Zeilen (Straße / Ort), alles andere ist eine Zeile.
    const w = f.feld === "hinweis" || f.feld === "usAdresse" ? absatz(roh[f.feld], f.max) : knapp(roh[f.feld], f.max);
    delete (plus as any)[f.feld];
    if (!w) continue;
    if (f.feld === "ein") {
      const e = globalEinFormat(w);
      if (!e) return nein(400, "Die EIN hat neun Ziffern (Format 12-3456789).");
      plus.ein = e;
    } else (plus as any)[f.feld] = w;
  }
  if (plus.hinweis) { const f = kundensatz(plus.hinweis); if (f) return nein(400, f); }
  await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft_plus = ${sqlPool.json(plus as any)}, updated_at = NOW() WHERE ref = ${ref}`;
  await verlaufSchreiben(ref, { art: "gesellschaft", text: `Gesellschaftsdaten aktualisiert (${GLOBAL_GESELLSCHAFT_PLUS_FELDER.map((f) => f.feld).filter((k) => (plus as any)[k]).join(", ") || "leer"}).`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: `Gesellschaftsdaten gespeichert.${fristen}` };
}

export async function globalKapitalSpeichern(ref: string, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string; id: number }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  const art = globalKapitalArt(ein.art);
  if (!art) return nein(400, "Bitte die Art wählen (Konto, Karte, Kreditrahmen, Darlehen).");
  const status = globalKapitalStatus(ein.status) ?? "vorbereitung";
  const betragRoh = String(ein.betragUsd ?? "").replace(/[^\d]/g, "");
  const betragCents = betragRoh ? Math.min(Number(betragRoh), 100_000_000) * 100 : null;
  const beantragt = ein.beantragtAm ? String(ein.beantragtAm) : null;
  const entschieden = ein.entschiedenAm ? String(ein.entschiedenAm) : null;
  if ((beantragt && !istIsoTag(beantragt)) || (entschieden && !istIsoTag(entschieden))) return nein(400, "Ein Datum ist ungültig.");
  const hinweis = absatz(ein.hinweis, 600) || null;
  if (hinweis) { const f = kundensatz(hinweis); if (f) return nein(400, f); }
  const institut = knapp(ein.institut, 120) || null;
  const produkt = knapp(ein.produkt, 120) || null;
  // Je Karte: Firmenkarte oder private Karte (Score-Aufbau). Nur bei Karten.
  const inhaberRoh = String(ein.inhaber ?? "").trim();
  if (inhaberRoh && !["firma", "privat"].includes(inhaberRoh)) return nein(400, "Karte: bitte Firma oder privat wählen.");
  const inhaber = art === "karte" ? (inhaberRoh || "firma") : null;
  if (entschieden && entschieden > berlinToday()) return nein(400, "„Entschieden am“ liegt in der Zukunft.");
  if (beantragt && beantragt > berlinToday()) return nein(400, "„Beantragt am“ liegt in der Zukunft.");
  if (betragCents != null && (status === "abgelehnt")) return nein(400, "Ein abgelehnter Antrag hat keinen Betrag — bitte das Feld leeren.");
  const intern = absatz(ein.intern, 1200) || null;
  const sichtbar = ein.sichtbar !== false;
  const id = Number(ein.id);
  let neu: any;
  if (Number.isInteger(id) && id > 0) {
    [neu] = (await sqlPool`
      UPDATE fiaon_global_kapital SET art = ${art}, institut = ${institut}, produkt = ${produkt}, inhaber = ${inhaber}, status = ${status}, betrag_cents = ${betragCents},
             beantragt_am = ${beantragt}, entschieden_am = ${entschieden}, hinweis = ${hinweis}, intern = ${intern}, sichtbar = ${sichtbar},
             geaendert_von = ${agent.name}, updated_at = NOW()
       WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL RETURNING id`) as any[];
    if (!neu) return nein(404, "Diesen Eintrag gibt es nicht (mehr).");
  } else {
    [neu] = (await sqlPool`
      INSERT INTO fiaon_global_kapital (ref, art, institut, produkt, inhaber, status, betrag_cents, beantragt_am, entschieden_am, hinweis, intern, sichtbar, geaendert_von)
      VALUES (${ref}, ${art}, ${institut}, ${produkt}, ${inhaber}, ${status}, ${betragCents}, ${beantragt}, ${entschieden}, ${hinweis}, ${intern}, ${sichtbar}, ${agent.name})
      RETURNING id`) as any[];
  }
  const was = `${globalKapitalArtTitel(art, "de")}${institut ? ` (${institut})` : ""} — ${globalKapitalStatusTitel(status, "de")}`;
  await verlaufSchreiben(ref, {
    art: "kapital", agentId: agent.id, sichtbar: sichtbar && (status === "zugesagt" || status === "aktiv"),
    text: sichtbar && (status === "zugesagt" || status === "aktiv")
      ? t(l.sprache, `${globalKapitalArtTitel(art, "de")}: ${globalKapitalStatusTitel(status, "de")}.`, `${globalKapitalArtTitel(art, "en")}: ${globalKapitalStatusTitel(status, "en")}.`)
      : `Banken & Kapital: ${was}.`,
  });
  return { ok: true, id: Number(neu.id), meldung: `Gespeichert: ${was}.` };
}

export async function globalKapitalEntfernen(ref: string, idRoh: unknown, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalMandat();
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    UPDATE fiaon_global_kapital SET geloescht_am = NOW(), geaendert_von = ${agent.name} WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL RETURNING art`) as any[]) : [];
  if (!d) return nein(404, "Diesen Eintrag gibt es nicht (mehr).");
  await verlaufSchreiben(ref, { art: "kapital", text: `Banken & Kapital: Eintrag (${globalKapitalArtTitel(String(d.art), "de")}) entfernt.`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: "Eintrag entfernt." };
}

// ── STATIONEN-EDITOR (22.10.2026) ────────────────────────────────────────────
// Justin: „Die Schritte wie ITIN, D-U-N-S, EIN … wir müssen die echten Werte eintragen können — 100 % funktional.“
// EIN Weg für Chefbüro und Office: Status mit Datum UND die Werte der Station. Erst wird ALLES geprüft
// (stationWertePruefen, shared/fiaon-global-stationen.ts), dann geschrieben: Grunddaten über globalGesellschaftSetzen
// (setzt die Fristen), die übrigen Werte in gesellschaft_plus (die ITIN verschlüsselt), der Status in
// fiaon_global_schritte. Der Kunde liest beim ERSTEN Eintragen einen Satz im Verlauf („Ihre ITIN ist da.“), das Team
// eine interne Zeile mit Namen. Nie steht die ITIN im Verlauf, im Protokoll oder in einer Antwort.
const FELD_TITEL = new Map(Object.values(GLOBAL_STATION_FELDER).flat().map((f) => [f.feld, f.titel]));
const leerWert = (v: unknown) => v == null || String(v).trim() === "";

export async function globalStationSpeichern(ref: string, ein: Record<string, unknown>, agent: BereichAgent, opts: { vorZahlung?: boolean } = {}): Promise<Erg<{ meldung: string; gesellschaftPlus: Record<string, unknown> }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  if (l.status === "storniert") return nein(409, "Der Auftrag ist storniert.");
  const v = globalSchrittVorlage(ein.schluessel);
  if (!v) return nein(400, "Diese Station gibt es nicht.");
  const heute = berlinToday();
  // 1 · PRÜFEN — bevor irgendetwas geschrieben wird
  const statusNeu = ein.status === undefined ? undefined : globalSchrittStatus(ein.status);
  if (statusNeu === null) return nein(400, "Diesen Status gibt es nicht (offen, in Arbeit, beantragt, erledigt, entfällt).");
  const datumPruefen = (roh: unknown, was: string): string | null | { fehler: string } => {
    const d = String(roh ?? "").trim();
    if (!d) return null;
    if (!istIsoTag(d)) return { fehler: `${was}: bitte ein gültiges Datum wählen.` };
    if (d > heute) return { fehler: `${was}: Das Datum liegt in der Zukunft.` };
    return d;
  };
  const datumRoh = ein.datum === undefined ? undefined : datumPruefen(ein.datum, "Erledigt am");
  const beantragtRoh = ein.beantragtAm === undefined ? undefined : datumPruefen(ein.beantragtAm, "Beantragt am");
  for (const d of [datumRoh, beantragtRoh]) if (d && typeof d === "object") return nein(400, d.fehler);
  const datum = datumRoh as string | null | undefined;
  const beantragtAm = beantragtRoh as string | null | undefined;
  const hinweis = ein.hinweis === undefined ? undefined : (absatz(ein.hinweis, 600) || null);
  if (hinweis) { const f = kundensatz(hinweis); if (f) return nein(400, f); }
  const intern = ein.intern === undefined ? undefined : (absatz(ein.intern, 1200) || null);
  const werteRoh = ein.werte && typeof ein.werte === "object" ? (ein.werte as Record<string, unknown>) : {};
  const p = stationWertePruefen(v.schluessel, werteRoh, heute);
  // `feld` reist mit: Der Editor rahmt das Feld rot, an dem es hängt.
  if (!p.ok) return { ok: false as const, status: 400, error: p.error, feld: p.feld } as ReturnType<typeof nein>;

  // 2 · GRUNDDATEN (Name, Form, Bundesstaat, Gründungstag) über den bestehenden Weg — er setzt die Pflichtfristen
  const g = l.gesellschaft ?? {};
  const grund: Record<string, unknown> = {};
  for (const [k, w] of Object.entries(p.werte.grund)) if ((w ?? null) !== ((g as any)[k] ?? null)) grund[k] = w ?? "";
  // Die alten Merker ziehen mit: EIN da → einVorhanden; ITIN da → itinStand „vorhanden“, beantragt → „beantragt“.
  if ("ein" in p.werte.plus && !!p.werte.plus.ein !== !!g.einVorhanden) grund.einVorhanden = !!p.werte.plus.ein;
  if (v.schluessel === "itin") {
    const itinDa = "itin" in p.werte.plus ? !!p.werte.plus.itin : !!(await plusRoh(ref)).itinEnc;
    let stand: string | null = g.itinStand ?? null;
    if (itinDa) stand = "vorhanden";
    else if (statusNeu === "beantragt") stand = "beantragt";
    else if (stand === "vorhanden") stand = "offen"; // die ITIN wurde geleert
    if (stand !== (g.itinStand ?? null)) grund.itinStand = stand ?? "";
  }
  let fristen = "";
  if (Object.keys(grund).length) {
    const r = await globalGesellschaftSetzen(ref, grund, agent, { vorZahlung: opts.vorZahlung === true });
    if (!r.ok) return r;
    const f = r.fristen;
    if (f.neu || f.geaendert || f.entfernt) fristen = ` Pflichtenkalender: ${f.neu} neu, ${f.geaendert} geändert, ${f.entfernt} entfernt.`;
  }

  // 3 · WERTE in gesellschaft_plus (die ITIN nur verschlüsselt)
  const vorher = await plusRoh(ref);
  const neu: Record<string, unknown> = { ...vorher };
  const gesetzt: string[] = []; const geaendert: string[] = []; const geleert: string[] = [];
  for (const [k, w] of Object.entries(p.werte.plus)) {
    if (k === "itin") {
      const { encryptSecret, decryptSecret } = await import("../routes/fiaon-agent");
      const alt = vorher.itinEnc ? decryptSecret(vorher.itinEnc) : null;
      if (!w) { if (vorher.itinEnc) { delete neu.itinEnc; delete neu.itinEnde; geleert.push(k); } continue; }
      if (alt === w) continue;
      neu.itinEnc = encryptSecret(w); neu.itinEnde = w.replace(/\D/g, "").slice(-4);
      (vorher.itinEnc ? geaendert : gesetzt).push(k);
      continue;
    }
    const alt = (vorher as Record<string, unknown>)[k];
    if (!w) { if (!leerWert(alt)) { delete neu[k]; geleert.push(k); } continue; }
    if (alt === w) continue;
    neu[k] = w;
    (leerWert(alt) ? gesetzt : geaendert).push(k);
  }
  if (gesetzt.length || geaendert.length || geleert.length) {
    await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft_plus = ${sqlPool.json(neu as any)}, updated_at = NOW() WHERE ref = ${ref}`;
  }

  // 4 · STATUS der Station
  const [alt] = (await sqlPool`SELECT status, datum, beantragt_am, hinweis, intern FROM fiaon_global_schritte WHERE ref = ${ref} AND schluessel = ${v.schluessel}`) as any[];
  const altStatus = alt ? String(alt.status) : "offen";
  const status = statusNeu ?? altStatus;
  const wechsel = status !== altStatus;
  // „Erledigt am“: gesetzt oder — beim Wechsel auf erledigt ohne Datum — heute; bei einem anderen Wechsel leer.
  const datumWert = datum !== undefined ? datum : wechsel ? (status === "erledigt" ? heute : null) : tag(alt?.datum);
  const beantragtWert = beantragtAm !== undefined ? beantragtAm : (wechsel && status === "beantragt" && !alt?.beantragt_am ? heute : tag(alt?.beantragt_am));
  const hinweisWert = hinweis !== undefined ? hinweis : (alt?.hinweis ?? null);
  const internWert = intern !== undefined ? intern : (alt?.intern ?? null);
  const schrittAnders = !alt || wechsel || datumWert !== tag(alt.datum) || beantragtWert !== tag(alt.beantragt_am) || hinweisWert !== (alt.hinweis ?? null) || internWert !== (alt.intern ?? null);
  if (schrittAnders) {
    await sqlPool`
      INSERT INTO fiaon_global_schritte (ref, schluessel, status, datum, beantragt_am, hinweis, intern, geaendert_von, updated_at)
      VALUES (${ref}, ${v.schluessel}, ${status}, ${datumWert}, ${beantragtWert}, ${hinweisWert}, ${internWert}, ${agent.name}, NOW())
      ON CONFLICT (ref, schluessel) DO UPDATE SET status = EXCLUDED.status, datum = EXCLUDED.datum, beantragt_am = EXCLUDED.beantragt_am,
        hinweis = EXCLUDED.hinweis, intern = EXCLUDED.intern, geaendert_von = EXCLUDED.geaendert_von, updated_at = NOW()`;
  }

  // 5 · VERLAUF — der Kunde liest das Neue, das Team alles
  const titelDe = globalSchrittTitel(v.schluessel, "de");
  for (const satz of stationVerlaufSaetze(gesetzt, l.sprache)) await verlaufSchreiben(ref, { art: "station", text: satz, sichtbar: true, agentId: agent.id });
  if (wechsel && (status === "erledigt" || status === "beantragt")) {
    const titel = globalSchrittTitel(v.schluessel, l.sprache);
    const satz = status === "erledigt" ? t(l.sprache, `Erledigt: ${titel}.`, `Done: ${titel}.`) : t(l.sprache, `Beantragt: ${titel}.`, `Applied for: ${titel}.`);
    await verlaufSchreiben(ref, { art: "schritt", text: satz, sichtbar: true, agentId: agent.id });
  }
  const teile: string[] = [];
  if (wechsel) teile.push(`Status ${altStatus} → ${status}`);
  const benenne = (liste: string[], wie: string) => { if (liste.length) teile.push(`${liste.map((k) => FELD_TITEL.get(k) ?? k).join(", ")} ${wie}`); };
  benenne(gesetzt, "eingetragen"); benenne(geaendert, "geändert"); benenne(geleert, "geleert");
  if (!wechsel && schrittAnders && alt) teile.push("Datum/Hinweis angepasst");
  if (teile.length) await verlaufSchreiben(ref, { art: "station", text: `Station „${titelDe}“: ${teile.join("; ")} (${agent.name}).`, sichtbar: false, agentId: agent.id });
  const kundeSieht = stationVerlaufSaetze(gesetzt, l.sprache).length > 0 || (wechsel && (status === "erledigt" || status === "beantragt"));
  return {
    ok: true,
    gesellschaftPlus: globalPlusFuerTeam(neu as GlobalGesellschaftPlus),
    meldung: teile.length
      ? `„${titelDe}“ gespeichert${kundeSieht ? " — der Kunde sieht es jetzt in seinem Portal" : ""}.${fristen}`
      : `„${titelDe}“: nichts geändert.`,
  };
}

/** Die ITIN im Klartext — nur für „Anzeigen“ (Kunde im eigenen Portal, Team im Editor). Das Team hinterlässt eine interne Zeile. */
export async function globalItinKlartext(ref: string, wer: { team: BereichAgent | null }): Promise<string | null> {
  await ensureGlobalMandat();
  const p = await plusRoh(ref);
  if (!p.itinEnc) return null;
  const { decryptSecret } = await import("../routes/fiaon-agent");
  const klar = decryptSecret(p.itinEnc);
  if (klar && wer.team) await verlaufSchreiben(ref, { art: "station", text: `ITIN im Klartext angezeigt (${wer.team.name}).`, sichtbar: false, agentId: wer.team.id || null });
  return klar;
}

/** Für das Office (/agent/global/:ref): Stationen, Grunddaten, Werte (ITIN maskiert) und Karten/Rahmen — wie im Chefbüro. */
export async function globalStationenSicht(ref: string): Promise<Record<string, unknown> | null> {
  await ensureGlobalMandat();
  const l = await lageLesen(ref);
  if (!l) return null;
  const [schritte, kapital, plus] = await Promise.all([schritteLesen(ref, "de", "chef"), kapitalLesen(ref, "de", "chef"), plusRoh(ref)]);
  return { status: l.status, gesellschaft: l.gesellschaft, gesellschaftPlus: globalPlusFuerTeam(plus), schritte, kapital };
}

/**
 * Ein Dokument aus dem Chefbüro — jederzeit (auch vor dem Zahlungseingang, nur nicht bei Storno).
 * Optional: Titel, Post (Absender, Eingang), „Unterschrift anfordern", Mail an den Kunden.
 */
export async function globalMandatDokument(ref: string, ein: {
  art: unknown; datei: DateiEin | null; titel?: unknown; sichtbar: boolean; mitteilen: boolean; unterschrift: boolean;
  postAbsender?: unknown; postEingang?: unknown;
}, agent: BereichAgent): Promise<Erg<{ meldung: string; id: number }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  if (l.status === "storniert") return nein(409, "Der Auftrag ist storniert.");
  const art = globalDokumentArt(ein.art);
  if (!art) return nein(400, "Bitte die Art des Dokuments wählen.");
  const datei = ein.datei;
  if (!datei?.buffer?.length) return nein(400, "Es ist keine Datei angekommen.");
  if (datei.buffer.length > GLOBAL_DATEI_MAX_BYTES) return nein(400, "Die Datei ist größer als 15 MB.");
  const typ = globalDateiTyp(datei.buffer);
  if (!typ) return nein(400, "Diese Datei lässt sich nicht ablegen. Möglich sind PDF, JPG, PNG und HEIC — geprüft wird der Inhalt, nicht die Endung.");
  if (ein.unterschrift && typ.mime !== "application/pdf") return nein(400, "Eine Unterschrift lässt sich nur für ein PDF anfordern.");
  const [anz] = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_dokumente WHERE ref = ${ref} AND von = 'fiaon' AND geloescht_am IS NULL`) as any[];
  if (Number(anz?.n || 0) >= GLOBAL_DOKUMENTE_MAX * 3) return nein(409, "Für diesen Auftrag liegen schon sehr viele Dokumente von FIAON im Tresor. Bitte erst Überholtes entfernen.");
  const istPost = art.art === "post";
  const absender = istPost ? knapp(ein.postAbsender, 160) : "";
  const eingang = istPost ? String(ein.postEingang ?? "") : "";
  if (istPost && !absender) return nein(400, "Bitte den Absender des Briefs angeben.");
  if (istPost && eingang && !istIsoTag(eingang)) return nein(400, "Das Eingangsdatum ist ungültig.");
  const titel = knapp(ein.titel, 160) || null;
  const sichtbar = ein.sichtbar || ein.unterschrift || istPost;
  const name = globalDateiname(nameAusMultipart(datei.originalname), typ.endung);
  const d = await dokumentSpeichern({ ref, von: "fiaon", art: art.art, dateiname: name, mime: typ.mime, inhalt: datei.buffer, sichtbar, agentId: agent.id });
  await sqlPool`
    UPDATE fiaon_global_dokumente SET titel = COALESCE(${titel}, titel),
           post_absender = ${istPost ? absender : null}, post_eingang_am = ${istPost ? (eingang || berlinToday()) : null},
           unterschrift_gefordert = ${ein.unterschrift}
     WHERE id = ${d.id} AND ref = ${ref}`;
  if (d.doppelt) return { ok: true, id: d.id, meldung: "Genau diese Datei liegt schon im Tresor — die Angaben wurden aktualisiert." };
  const anzeige = titel || globalDokumentArtText(art.art, l.sprache);
  const kundenText = istPost
    ? t(l.sprache, `Post für Ihre Gesellschaft eingegangen: ${absender}.`, `Mail for your company received: ${absender}.`)
    : ein.unterschrift
      ? t(l.sprache, `Zur Unterschrift bereitgestellt: ${anzeige}.`, `Ready for your signature: ${anzeige}.`)
      : t(l.sprache, `Neues Dokument in Ihrem Tresor: ${anzeige}.`, `New document in your vault: ${anzeige}.`);
  await verlaufSchreiben(ref, { art: istPost ? "post" : ein.unterschrift ? "unterschrift_angefordert" : "dokument", text: sichtbar ? kundenText : `Internes Dokument abgelegt: ${art.de} („${name}“).`, sichtbar, agentId: agent.id });
  if (!sichtbar) return { ok: true, id: d.id, meldung: "Dokument intern abgelegt — der Kunde sieht es nicht." };
  if (!ein.mitteilen) return { ok: true, id: d.id, meldung: "Abgelegt. Der Kunde sieht es im Portal; eine Mail ging nicht raus." };
  const mail = await bereichMail("global_dokument", l, {
    dokument_art: escapeHtml(istPost ? t(l.sprache, `Eingegangene Post — ${absender}`, `Incoming mail — ${absender}`) : ein.unterschrift ? t(l.sprache, `${anzeige} (zur Unterschrift)`, `${anzeige} (for signature)`) : anzeige),
    dokument_name: escapeHtml(name),
  }, agent.name);
  if (mail.ok) await verlaufSchreiben(ref, { art: "mail_dokument", text: `Mail „neues Dokument“ an den Kunden (${name}).`, sichtbar: false, agentId: agent.id });
  return { ok: true, id: d.id, meldung: mail.ok ? "Abgelegt und dem Kunden per Mail mitgeteilt." : `Abgelegt — die Mail an den Kunden ging NICHT raus (${mail.grund}).` };
}

/** Titel, Sichtbarkeit oder „Unterschrift anfordern" eines bestehenden Dokuments ändern. */
export async function globalMandatDokumentAendern(ref: string, idRoh: unknown, ein: Record<string, unknown>, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalMandat();
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    SELECT id, von, mime, art, dateiname, sichtbar_fuer_kunde, unterschrift_gefordert, unterschrieben_am FROM fiaon_global_dokumente
     WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL`) as any[]) : [];
  if (!d) return nein(404, "Dieses Dokument gibt es nicht (mehr).");
  const titel = ein.titel !== undefined ? (knapp(ein.titel, 160) || null) : undefined;
  const sichtbar = ein.sichtbar !== undefined ? ein.sichtbar === true : undefined;
  const unterschrift = ein.unterschrift !== undefined ? ein.unterschrift === true : undefined;
  if (unterschrift && String(d.mime) !== "application/pdf") return nein(400, "Eine Unterschrift lässt sich nur für ein PDF anfordern.");
  if (unterschrift === false && d.unterschrieben_am) return nein(409, "Dieses Dokument ist schon unterschrieben.");
  if (sichtbar === false && d.von === "kunde") return nein(400, "Was der Kunde selbst hochgeladen hat, sieht er immer.");
  await sqlPool`
    UPDATE fiaon_global_dokumente SET
      titel = CASE WHEN ${titel !== undefined} THEN ${titel ?? null} ELSE titel END,
      sichtbar_fuer_kunde = CASE WHEN ${sichtbar !== undefined || unterschrift === true} THEN ${(sichtbar ?? true) || unterschrift === true} ELSE sichtbar_fuer_kunde END,
      unterschrift_gefordert = CASE WHEN ${unterschrift !== undefined} THEN ${unterschrift ?? false} ELSE unterschrift_gefordert END
     WHERE id = ${id} AND ref = ${ref}`;
  const teile: string[] = [];
  if (titel !== undefined) teile.push("Titel");
  if (sichtbar !== undefined) teile.push(sichtbar ? "für den Kunden sichtbar" : "nur intern");
  if (unterschrift !== undefined) teile.push(unterschrift ? "Unterschrift angefordert" : "Unterschrift nicht mehr angefordert");
  await verlaufSchreiben(ref, { art: "dokument", text: `Dokument „${String(d.dateiname)}“: ${teile.join(", ")}.`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: `Gespeichert: ${teile.join(", ")}.` };
}

/** Antwort von FIAON auf eine Anfrage — im Faden, optional mit Mail. Offene Nachrichten-Aufgaben werden erledigt. */
export async function globalMandatAntwort(ref: string, ein: { text?: unknown; mitteilen?: unknown }, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  const text = absatz(ein.text, 4000);
  if (text.length < 2) return nein(400, "Bitte eine Antwort schreiben.");
  const f = kundensatz(text);
  if (f) return nein(400, f);
  await sqlPool`INSERT INTO fiaon_global_nachrichten (ref, von, agent_id, autor, text) VALUES (${ref}, 'fiaon', ${agent.id || null}, ${agent.name}, ${text})`;
  await sqlPool`UPDATE fiaon_global_nachrichten SET gelesen_fiaon_am = COALESCE(gelesen_fiaon_am, NOW()) WHERE ref = ${ref} AND von = 'kunde'`;
  await sqlPool`
    UPDATE fiaon_betreiber_todos SET status = 'erledigt', erledigt_am = COALESCE(erledigt_am, NOW()), ergebnis = COALESCE(ergebnis, 'Im Global-Arbeitsraum beantwortet.'), updated_at = NOW()
     WHERE schluessel LIKE ${`global:${ref}:nachricht:%`} AND status <> 'erledigt'`.catch(() => {});
  await verlaufSchreiben(ref, { art: "antwort", text: `Antwort an den Kunden: „${text.slice(0, 300)}${text.length > 300 ? " …" : ""}“`, sichtbar: false, agentId: agent.id });
  if (ein.mitteilen !== true) return { ok: true, meldung: "Antwort gespeichert. Der Kunde sieht sie im Portal; eine Mail ging nicht raus." };
  const mail = await bereichMail("global_nachricht", l, {}, agent.name);
  return { ok: true, meldung: mail.ok ? "Antwort gespeichert und dem Kunden per Mail mitgeteilt." : `Antwort gespeichert — die Mail ging NICHT raus (${mail.grund}).` };
}

export async function globalMandatAnfragenGelesen(ref: string): Promise<void> {
  await ensureGlobalMandat();
  await sqlPool`UPDATE fiaon_global_nachrichten SET gelesen_fiaon_am = NOW() WHERE ref = ${ref} AND von = 'kunde' AND gelesen_fiaon_am IS NULL`;
}

export async function globalMandatTest(ref: string, an: boolean, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalMandat();
  const [z] = (await sqlPool`UPDATE fiaon_global_auftraege SET ist_test_am = CASE WHEN ${an} THEN COALESCE(ist_test_am, NOW()) END WHERE ref = ${ref} RETURNING ref`) as any[];
  if (!z) return nein(404, "Diesen Auftrag gibt es nicht.");
  await verlaufSchreiben(ref, { art: "test", text: an ? "Als Test / intern markiert." : "Test-Markierung entfernt.", sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: an ? "Als Test markiert — zählt in keiner Kennzahl mehr." : "Test-Markierung entfernt." };
}

export async function globalMandatPortal(ref: string, an: boolean, agent: BereichAgent): Promise<Erg<{ meldung: string }>> {
  await ensureGlobalMandat();
  const [z] = (await sqlPool`
    UPDATE fiaon_global_auftraege SET portal_neu_am = CASE WHEN ${an} THEN COALESCE(portal_neu_am, NOW()) END, portal_neu_von = ${an ? agent.name : null}
     WHERE ref = ${ref} RETURNING ref`) as any[];
  if (!z) return nein(404, "Diesen Auftrag gibt es nicht.");
  await verlaufSchreiben(ref, { art: "portal", text: an ? `Neues Kundenportal für diesen Kunden freigeschaltet (${agent.name}).` : `Neues Kundenportal wieder ausgeschaltet (${agent.name}).`, sichtbar: false, agentId: agent.id });
  return { ok: true, meldung: an ? "Freigeschaltet — der Kunde sieht ab seinem nächsten Besuch das neue Portal." : "Ausgeschaltet — der Kunde sieht wieder das bisherige Portal." };
}

// ── KUNDE: NACHRICHT IN DEN FADEN, GELESEN, UNTERSCHRIFT ─────────────────────
/** Aus globalKundenNachricht: die Verlaufszeile der Kundennachricht wird zur Zeile im Faden. */
export async function globalNachrichtAusVerlauf(ref: string, verlaufId: number | null, text: string): Promise<void> {
  await ensureGlobalMandat();
  await sqlPool`
    INSERT INTO fiaon_global_nachrichten (ref, von, text, verlauf_id) VALUES (${ref}, 'kunde', ${text}, ${verlaufId})
    ON CONFLICT (verlauf_id) DO NOTHING`;
}

export async function globalKundeHatGelesen(ref: string, was: "nachrichten" | { dokument: number }): Promise<void> {
  await ensureGlobalMandat();
  if (was === "nachrichten") {
    await sqlPool`UPDATE fiaon_global_nachrichten SET gelesen_kunde_am = NOW() WHERE ref = ${ref} AND von = 'fiaon' AND gelesen_kunde_am IS NULL`;
  } else {
    await sqlPool`UPDATE fiaon_global_dokumente SET kunde_gelesen_am = COALESCE(kunde_gelesen_am, NOW()) WHERE ref = ${ref} AND id = ${was.dokument}`;
  }
}

/** pdf-lib schreibt mit WinAnsi — Zeichen außerhalb (z. B. „ł") werden ohne Akzent geschrieben statt das Blatt zu sprengen. */
function sicher(font: PDFFont, s: string): string {
  try { font.encodeText(s); return s; } catch {
    const ohne = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return Array.from(ohne).map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");
  }
}

/**
 * POST /global/mein-auftrag/:ref/unterschrift/:id — der Kunde unterschreibt ein angefordertes PDF.
 * Ergebnis: die Originalseiten + ein Unterschriftsblatt (Name, Zeitpunkt, IP, Prüfsumme des Originals,
 * die gezeichnete Unterschrift) als NEUES Dokument; das Original wird als unterschrieben vermerkt.
 */
export async function globalKundeUnterschreibt(ref: string, idRoh: unknown, ein: { name?: unknown; bild?: unknown; zustimmung?: unknown; ip: string; userAgent: string }): Promise<Erg<{ meldung: string; id: number }>> {
  const l = await lageOder404(ref);
  if ("fehler" in l) return l.fehler;
  const s = l.sprache;
  const id = Number(idRoh);
  const [d] = Number.isInteger(id) && id > 0 ? ((await sqlPool`
    SELECT id, art, titel, dateiname, mime, inhalt, unterschrift_gefordert, unterschrieben_am, sichtbar_fuer_kunde
      FROM fiaon_global_dokumente WHERE id = ${id} AND ref = ${ref} AND geloescht_am IS NULL`) as any[]) : [];
  if (!d || !d.unterschrift_gefordert || !d.sichtbar_fuer_kunde) return nein(404, t(s, "Dieses Dokument wartet nicht auf Ihre Unterschrift.", "This document is not waiting for your signature."));
  if (d.unterschrieben_am) return nein(409, t(s, "Dieses Dokument haben Sie bereits unterschrieben.", "You have already signed this document."));
  if (ein.zustimmung !== true) return nein(400, t(s, "Bitte bestätigen Sie, dass Sie das Dokument gelesen haben und unterschreiben möchten.", "Please confirm that you have read the document and wish to sign it."));
  const name = knapp(ein.name, 120);
  if (name.length < 3 || !/\s/.test(name)) return nein(400, t(s, "Bitte geben Sie Ihren vollständigen Namen ein (Vor- und Nachname).", "Please enter your full name (first and last name)."));
  const bild = String(ein.bild ?? "");
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(bild);
  const png = m ? Buffer.from(m[1], "base64") : null;
  if (!png || png.length < 200 || png.length > 600_000) return nein(400, t(s, "Bitte zeichnen Sie Ihre Unterschrift in das Feld.", "Please draw your signature in the field."));
  const original = Buffer.from(d.inhalt);
  const hash = createHash("sha256").update(original).digest("hex");
  let ausgabe: Buffer;
  try {
    const pdf = await PDFDocument.load(original, { ignoreEncryption: false });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
    const zeichen = await pdf.embedPng(png);
    const jetzt = new Date();
    const wann = new Intl.DateTimeFormat(s === "en" ? "en-GB" : "de-DE", { timeZone: "Europe/Berlin", dateStyle: "long", timeStyle: "medium" }).format(jetzt);
    const titel = String(d.titel || globalDokumentArtText(d.art, s));
    // Fußzeile auf jeder Originalseite.
    const seiten = pdf.getPages();
    seiten.forEach((p, i) => {
      const { width } = p.getSize();
      p.drawText(sicher(font, `${t(s, "Elektronisch unterschrieben", "Signed electronically")} · ${name} · ${wann} · ${t(s, "Seite", "Page")} ${i + 1}/${seiten.length} · SHA-256 ${hash.slice(0, 16)}`), {
        x: 36, y: 14, size: 6.5, font, color: rgb(0.42, 0.46, 0.53), maxWidth: width - 72,
      });
    });
    // Das Unterschriftsblatt.
    const blatt = pdf.addPage([595.28, 841.89]);
    const navy = rgb(0.07, 0.157, 0.29);
    const leise = rgb(0.42, 0.46, 0.53);
    let y = 770;
    blatt.drawText("FIAON Global", { x: 56, y, size: 11, font: fett, color: navy }); y -= 34;
    blatt.drawText(sicher(fett, t(s, "Unterschriftsblatt", "Signature page")), { x: 56, y, size: 22, font: fett, color: navy }); y -= 26;
    blatt.drawText(sicher(font, t(s, "Elektronische Unterschrift in „Mein Auftrag“", "Electronic signature in “My order”")), { x: 56, y, size: 11, font, color: leise }); y -= 40;
    const zeile = (k: string, v: string) => {
      blatt.drawText(sicher(font, k), { x: 56, y, size: 9.5, font, color: leise });
      blatt.drawText(sicher(fett, v), { x: 210, y, size: 10, font: fett, color: navy, maxWidth: 330 });
      y -= 22;
    };
    zeile(t(s, "Dokument", "Document"), titel.slice(0, 90));
    zeile(t(s, "Datei", "File"), String(d.dateiname).slice(0, 90));
    zeile(t(s, "Auftrag", "Order"), ref);
    zeile(t(s, "Unterschrieben von", "Signed by"), name);
    zeile(t(s, "Zeitpunkt", "Time"), `${wann} (${t(s, "Berlin", "Berlin time")})`);
    zeile(t(s, "IP-Adresse", "IP address"), ein.ip || "—");
    zeile(t(s, "Prüfsumme (SHA-256)", "Checksum (SHA-256)"), `${hash.slice(0, 32)}`);
    blatt.drawText(sicher(font, hash.slice(32)), { x: 210, y: y + 10, size: 10, font: fett, color: navy }); y -= 22;
    y -= 14;
    blatt.drawText(sicher(font, t(s, "Unterschrift", "Signature")), { x: 56, y, size: 9.5, font, color: leise }); y -= 10;
    const breite = 260; const hoehe = Math.min(120, (zeichen.height / zeichen.width) * breite);
    blatt.drawRectangle({ x: 56, y: y - hoehe - 16, width: breite + 24, height: hoehe + 24, borderColor: rgb(0.89, 0.91, 0.93), borderWidth: 1 });
    blatt.drawImage(zeichen, { x: 68, y: y - hoehe - 4, width: breite, height: hoehe });
    y -= hoehe + 50;
    const erklaerung = t(s,
      `${name} hat dieses Dokument am ${wann} in „Mein Auftrag“ geöffnet, die Bestätigung „gelesen und einverstanden“ gegeben und mit dieser Unterschrift unterschrieben. Die Prüfsumme belegt, welche Fassung unterschrieben wurde.`,
      `${name} opened this document in “My order” on ${wann}, confirmed “read and agreed” and signed it with this signature. The checksum shows which version was signed.`);
    let rest = erklaerung;
    while (rest.length) {
      let n = Math.min(rest.length, 95);
      if (n < rest.length) { const leer = rest.lastIndexOf(" ", n); if (leer > 40) n = leer; }
      blatt.drawText(sicher(font, rest.slice(0, n).trim()), { x: 56, y, size: 9.5, font, color: leise });
      rest = rest.slice(n).trim(); y -= 15;
    }
    ausgabe = Buffer.from(await pdf.save());
  } catch (e) {
    console.error(`[GLOBAL-MANDAT] ${ref}: Unterschrift ${id} nicht erzeugt:`, e);
    return nein(422, t(s, "Dieses PDF lässt sich nicht elektronisch unterschreiben. Ihr Ansprechpartner schickt Ihnen eine andere Fassung.", "This PDF cannot be signed electronically. Your contact will send you another version."));
  }
  const basis = String(d.dateiname).replace(/\.pdf$/i, "");
  const neu = await dokumentSpeichern({ ref, von: "kunde", art: String(d.art), dateiname: `${basis}_${t(s, "unterschrieben", "signed")}.pdf`, mime: "application/pdf", inhalt: ausgabe, sichtbar: true, agentId: null });
  await sqlPool`UPDATE fiaon_global_dokumente SET titel = ${`${String(d.titel || globalDokumentArtText(d.art, s))} — ${t(s, "unterschrieben", "signed")}`}, unterschrift_von_id = ${id}, unterschrift_name = ${name}, unterschrieben_am = NOW(), kunde_gelesen_am = NOW() WHERE id = ${neu.id}`;
  await sqlPool`UPDATE fiaon_global_dokumente SET unterschrieben_am = NOW(), unterschrift_name = ${name}, unterschrift_ip = ${ein.ip.slice(0, 64)}, kunde_gelesen_am = COALESCE(kunde_gelesen_am, NOW()) WHERE id = ${id}`;
  const titel = String(d.titel || globalDokumentArtText(d.art, "de"));
  await verlaufSchreiben(ref, { art: "unterschrift", text: t(s, `Sie haben unterschrieben: ${titel}.`, `You signed: ${titel}.`), sichtbar: true, von: "kunde" });
  await eingangMelden(l, `Der Kunde hat im Portal unterschrieben: „${titel}“ (${name}). Die unterschriebene Fassung liegt im Tresor.`);
  return { ok: true, id: neu.id, meldung: t(s, "Danke — Ihre Unterschrift ist gespeichert. Die unterschriebene Fassung liegt in Ihrem Tresor.", "Thank you — your signature has been saved. The signed version is in your vault.") };
}

