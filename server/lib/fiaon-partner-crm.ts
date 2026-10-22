// ═══════════════════════════════════════════════════════════════════════════
// GESCHÄFTSPARTNER-CRM — DATENBANK (E-425, 22.10.2026)
//
// Chefbüro › Global-Aufträge › Reiter „Geschäftspartner“ (keine neue Chef-Seite).
// Eine Partnerakte = Firma + Kontakte + Verlauf + Dokumente + Aufgaben. Kontakte
// dürfen auch ohne Firma stehen (Einzelkontakt). Regeln, Prüfungen und Suche:
// shared/fiaon-partner-crm.ts. KI: fiaon-partner-crm-ki.ts. Adressen:
// fiaon-adresse.ts. Routen: server/routes/fiaon-partner-crm.ts.
//
// ── WAS BEWUSST SO IST ────────────────────────────────────────────────────
//   · Keine Hard-Deletes: archiviert_am (Firma), entfernt_am (alles andere).
//   · Dateien liegen als BYTEA in der Datenbank wie die Global-Dokumente; der
//     Typ wird am INHALT erkannt (globalDateiTyp), nie am Namen.
//   · Die Suche läuft über eine normalisierte Spalte „suchtext“ je Zeile, die
//     beim Schreiben aus denselben Feldern gebaut wird (suchtextAus) — Firma,
//     Kontakte und Verlauf. Jedes Suchwort muss irgendwo treffen.
//   · Kooperationspartner aus IA-KOOP- (fiaon_global_angebote) erscheinen ohne
//     Akte als Vorschlag „als Partner-Akte anlegen“; mit Akte über angebot_id
//     (eindeutig, Teilindex).
//   · Jede Funktion, die schreibt, nimmt `lauf` (Transaktion im Prüfstand).
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { GLOBAL_DATEI_MAX_BYTES, globalDateiTyp, globalDateiname } from "./fiaon-global-bereich-regeln";
import {
  firmaPruefen, kontaktPruefen, verlaufPruefen, aufgabePruefen, dokumentMetaPruefen, suchWoerter, suchtextAus, likeMuster,
  partnerHinweise, zeile, mehrzeilig, firmenTreffer, landCodeAus, emailSauber, telefonSauber, suchNormal,
  type FirmaEingabe, type KontaktEingabe, type Kondition, type BestandFirma, type LageEingang, type LageHinweis, type MailVorschlag,
  type PartnerArt, type PartnerStatus,
} from "@shared/fiaon-partner-crm";

type Lauf = any;
type Ergebnis<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; status: number; error: string };
const nein = (error: string, status = 400) => ({ ok: false as const, status, error });
const iso = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return berlinToday(v);
  const s = String(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const zeit = (v: unknown): string | null => (v ? new Date(v as any).toISOString() : null);
const leerNull = (s: string | null | undefined) => (s && String(s).trim() ? String(s) : null);

// ── Tabellen ───────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie db/migrations/121_partner_crm.sql — die DDL-Wache prüft vorher im Katalog. */
export function ensurePartnerTabellen(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_partner_firmen (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          art VARCHAR(20) NOT NULL DEFAULT 'sonstige',
          status VARCHAR(20) NOT NULL DEFAULT 'gespraech',
          website TEXT,
          email TEXT,
          telefon TEXT,
          strasse TEXT,
          hausnummer TEXT,
          adresszusatz TEXT,
          plz TEXT,
          ort TEXT,
          region TEXT,
          land_code VARCHAR(2),
          register_nr TEXT,
          steuer_nr TEXT,
          ust_id TEXT,
          leistung TEXT,
          konditionen JSONB NOT NULL DEFAULT '[]'::jsonb,
          tags TEXT[] NOT NULL DEFAULT '{}',
          notizen TEXT,
          betreuer_agent_id INTEGER,
          vertraulich BOOLEAN NOT NULL DEFAULT FALSE,
          angebot_id INTEGER,
          person_id INTEGER,
          suchtext TEXT NOT NULL DEFAULT '',
          erstellt_von TEXT,
          archiviert_am TIMESTAMPTZ,
          archiviert_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_partner_firmen_angebot_eins ON fiaon_partner_firmen (angebot_id) WHERE angebot_id IS NOT NULL AND archiviert_am IS NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_partner_kontakte (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
          name TEXT NOT NULL,
          rolle TEXT,
          email TEXT,
          telefon TEXT,
          mobil TEXT,
          durchwahl TEXT,
          erreichbarkeit TEXT,
          sprache TEXT,
          strasse TEXT,
          hausnummer TEXT,
          adresszusatz TEXT,
          plz TEXT,
          ort TEXT,
          region TEXT,
          land_code VARCHAR(2),
          notizen TEXT,
          haupt BOOLEAN NOT NULL DEFAULT FALSE,
          suchtext TEXT NOT NULL DEFAULT '',
          erstellt_von TEXT,
          entfernt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_partner_kontakte_firma ON fiaon_partner_kontakte (firma_id) WHERE entfernt_am IS NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_partner_dokumente (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
          kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
          art VARCHAR(20) NOT NULL DEFAULT 'sonstiges',
          titel TEXT NOT NULL,
          dateiname TEXT NOT NULL,
          mime TEXT NOT NULL,
          groesse INTEGER NOT NULL,
          pruefsumme VARCHAR(64) NOT NULL,
          inhalt BYTEA NOT NULL,
          gueltig_ab DATE,
          gueltig_bis DATE,
          notiz TEXT,
          hochgeladen_von TEXT,
          entfernt_am TIMESTAMPTZ,
          entfernt_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_partner_dokumente_firma ON fiaon_partner_dokumente (firma_id) WHERE entfernt_am IS NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_partner_verlauf (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
          kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
          typ VARCHAR(20) NOT NULL DEFAULT 'notiz',
          am DATE NOT NULL,
          titel TEXT NOT NULL,
          text TEXT,
          autor TEXT,
          dokument_id INTEGER REFERENCES fiaon_partner_dokumente(id),
          suchtext TEXT NOT NULL DEFAULT '',
          entfernt_am TIMESTAMPTZ,
          entfernt_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_partner_verlauf_firma ON fiaon_partner_verlauf (firma_id, am DESC) WHERE entfernt_am IS NULL`;
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_partner_aufgaben (
          id SERIAL PRIMARY KEY,
          firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
          kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
          titel TEXT NOT NULL,
          notiz TEXT,
          faellig_am DATE,
          zustaendig TEXT,
          erledigt_am TIMESTAMPTZ,
          erledigt_von TEXT,
          erstellt_von TEXT,
          entfernt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS fiaon_partner_aufgaben_firma ON fiaon_partner_aufgaben (firma_id) WHERE entfernt_am IS NULL`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Suchtexte ──────────────────────────────────────────────────────────────
const firmaSuchtext = (f: FirmaEingabe) => suchtextAus(
  [f.name, f.website, f.email, f.telefon, f.strasse, f.hausnummer, f.plz, f.ort, f.region, f.landCode, f.registerNr, f.steuerNr, f.ustId, f.leistung, f.tags, f.notizen, f.konditionen.map((k) => `${k.label} ${k.value}`)],
  [f.telefon],
);
const kontaktSuchtext = (k: KontaktEingabe) => suchtextAus(
  [k.name, k.rolle, k.email, k.telefon, k.mobil, k.durchwahl, k.erreichbarkeit, k.sprache, k.strasse, k.plz, k.ort, k.region, k.landCode, k.notizen],
  [k.telefon, k.mobil],
);
const verlaufSuchtext = (titel: string, text: string) => suchtextAus([titel, text]);

// ── Zeilen → Antwort ───────────────────────────────────────────────────────
export interface FirmaSicht {
  id: number; name: string; art: PartnerArt; status: PartnerStatus; website: string; email: string; telefon: string;
  strasse: string; hausnummer: string; adresszusatz: string; plz: string; ort: string; region: string; landCode: string;
  registerNr: string; steuerNr: string; ustId: string; leistung: string; konditionen: Kondition[]; tags: string[]; notizen: string;
  betreuerAgentId: number | null; betreuer: string | null; vertraulich: boolean; angebotId: number | null; personId: number | null;
  archiviertAm: string | null; erstelltVon: string | null; erstelltAm: string; geaendertAm: string;
}
function firmaAusZeile(z: any): FirmaSicht {
  return {
    id: Number(z.id), name: String(z.name), art: z.art, status: z.status, website: z.website ?? "", email: z.email ?? "", telefon: z.telefon ?? "",
    strasse: z.strasse ?? "", hausnummer: z.hausnummer ?? "", adresszusatz: z.adresszusatz ?? "", plz: z.plz ?? "", ort: z.ort ?? "", region: z.region ?? "",
    landCode: z.land_code ?? "", registerNr: z.register_nr ?? "", steuerNr: z.steuer_nr ?? "", ustId: z.ust_id ?? "", leistung: z.leistung ?? "",
    konditionen: Array.isArray(z.konditionen) ? z.konditionen : [], tags: Array.isArray(z.tags) ? z.tags : [], notizen: z.notizen ?? "",
    betreuerAgentId: z.betreuer_agent_id != null ? Number(z.betreuer_agent_id) : null, betreuer: z.betreuer_name ?? null, vertraulich: !!z.vertraulich,
    angebotId: z.angebot_id != null ? Number(z.angebot_id) : null, personId: z.person_id != null ? Number(z.person_id) : null,
    archiviertAm: zeit(z.archiviert_am), erstelltVon: z.erstellt_von ?? null, erstelltAm: zeit(z.created_at)!, geaendertAm: zeit(z.updated_at)!,
  };
}
export interface KontaktSicht {
  id: number; firmaId: number | null; firmaName: string | null; name: string; rolle: string; email: string; telefon: string; mobil: string; durchwahl: string;
  erreichbarkeit: string; sprache: string; strasse: string; hausnummer: string; adresszusatz: string; plz: string; ort: string; region: string; landCode: string;
  notizen: string; haupt: boolean; erstelltAm: string;
}
function kontaktAusZeile(z: any): KontaktSicht {
  return {
    id: Number(z.id), firmaId: z.firma_id != null ? Number(z.firma_id) : null, firmaName: z.firma_name ?? null, name: String(z.name), rolle: z.rolle ?? "",
    email: z.email ?? "", telefon: z.telefon ?? "", mobil: z.mobil ?? "", durchwahl: z.durchwahl ?? "", erreichbarkeit: z.erreichbarkeit ?? "", sprache: z.sprache ?? "",
    strasse: z.strasse ?? "", hausnummer: z.hausnummer ?? "", adresszusatz: z.adresszusatz ?? "", plz: z.plz ?? "", ort: z.ort ?? "", region: z.region ?? "",
    landCode: z.land_code ?? "", notizen: z.notizen ?? "", haupt: !!z.haupt, erstelltAm: zeit(z.created_at)!,
  };
}

// ── Liste mit Suche ────────────────────────────────────────────────────────
export interface PartnerKarte {
  id: number; name: string; art: PartnerArt; status: PartnerStatus; vertraulich: boolean; ort: string; landCode: string; tags: string[];
  hauptkontakt: { name: string; rolle: string; email: string; telefon: string; durchwahl: string } | null; kontakte: number;
  naechsteAufgabe: { titel: string; faelligAm: string | null; ueberfaellig: boolean } | null; offeneAufgaben: number; ueberfaellig: number;
  letzteAktivitaet: { am: string; typ: string; titel: string } | null; betreuer: string | null; angebotRef: string | null; personId: number | null;
  /** Warum diese Karte zur Suche passt, wenn nicht über den Namen (z. B. „Kontakt: …“). */
  fund: string | null; archiviert: boolean;
}
export interface KoopOhneAkte { angebotId: number; ref: string; status: string; name: string; email: string; telefon: string; ort: string }

export async function partnerListe(ein: { q?: unknown; art?: unknown; status?: unknown; archiv?: boolean }, lauf: Lauf = sqlPool): Promise<{
  firmen: PartnerKarte[]; kontakte: KontaktSicht[]; koopOhneAkte: KoopOhneAkte[]; zaehler: { gesamt: number; aktiv: number; ueberfaellig: number };
}> {
  await ensurePartnerTabellen();
  const woerter = suchWoerter(ein.q);
  const art = zeile(ein.art, 20); const status = zeile(ein.status, 20);
  const heute = berlinToday();
  // Je Suchwort: Firma ODER einer ihrer Kontakte ODER ein Verlaufseintrag trifft.
  let bed = lauf`TRUE`;
  for (const w of woerter) {
    const m = likeMuster(w);
    bed = lauf`${bed} AND (f.suchtext LIKE ${m}
      OR EXISTS (SELECT 1 FROM fiaon_partner_kontakte k WHERE k.firma_id = f.id AND k.entfernt_am IS NULL AND k.suchtext LIKE ${m})
      OR EXISTS (SELECT 1 FROM fiaon_partner_verlauf v WHERE v.firma_id = f.id AND v.entfernt_am IS NULL AND v.suchtext LIKE ${m}))`;
  }
  const zeilen = (await lauf`
    SELECT f.*, a.name AS betreuer_name, ga.angebot_ref,
           hk.name AS hk_name, hk.rolle AS hk_rolle, hk.email AS hk_email, hk.telefon AS hk_telefon, hk.durchwahl AS hk_durchwahl,
           (SELECT COUNT(*) FROM fiaon_partner_kontakte k WHERE k.firma_id = f.id AND k.entfernt_am IS NULL)::int AS kontakte,
           (SELECT COUNT(*) FROM fiaon_partner_aufgaben t WHERE t.firma_id = f.id AND t.entfernt_am IS NULL AND t.erledigt_am IS NULL)::int AS offen,
           (SELECT COUNT(*) FROM fiaon_partner_aufgaben t WHERE t.firma_id = f.id AND t.entfernt_am IS NULL AND t.erledigt_am IS NULL AND t.faellig_am < ${heute}::date)::int AS ueber,
           na.titel AS na_titel, na.faellig_am AS na_faellig,
           lv.am AS lv_am, lv.typ AS lv_typ, lv.titel AS lv_titel
      FROM fiaon_partner_firmen f
      LEFT JOIN fiaon_agents a ON a.id = f.betreuer_agent_id
      LEFT JOIN fiaon_global_angebote ga ON ga.id = f.angebot_id
      LEFT JOIN LATERAL (SELECT * FROM fiaon_partner_kontakte k WHERE k.firma_id = f.id AND k.entfernt_am IS NULL ORDER BY k.haupt DESC, k.id ASC LIMIT 1) hk ON TRUE
      LEFT JOIN LATERAL (SELECT titel, faellig_am FROM fiaon_partner_aufgaben t WHERE t.firma_id = f.id AND t.entfernt_am IS NULL AND t.erledigt_am IS NULL
                          ORDER BY t.faellig_am ASC NULLS LAST, t.id ASC LIMIT 1) na ON TRUE
      LEFT JOIN LATERAL (SELECT am, typ, titel FROM fiaon_partner_verlauf v WHERE v.firma_id = f.id AND v.entfernt_am IS NULL ORDER BY v.am DESC, v.id DESC LIMIT 1) lv ON TRUE
     WHERE ${ein.archiv ? lauf`f.archiviert_am IS NOT NULL` : lauf`f.archiviert_am IS NULL`}
       AND ${art ? lauf`f.art = ${art}` : lauf`TRUE`}
       AND ${status ? lauf`f.status = ${status}` : lauf`TRUE`}
       AND ${bed}
     ORDER BY (f.status = 'beendet') ASC, ueber DESC, COALESCE(lv.am, f.created_at::date) DESC, f.name ASC
     LIMIT 300`) as any[];

  // Fundstelle für die Anzeige: Traf der Name nicht, welcher Kontakt bzw. Eintrag trug die Suche?
  const fundstellen = new Map<number, string>();
  if (woerter.length) {
    const idsOhneNamenstreffer = zeilen.filter((z) => !woerter.every((w) => suchtextAus([z.name]).includes(w))).map((z) => Number(z.id));
    if (idsOhneNamenstreffer.length) {
      const m = likeMuster(woerter[0]);
      const k = (await lauf`SELECT DISTINCT ON (firma_id) firma_id, name FROM fiaon_partner_kontakte
                              WHERE firma_id = ANY(${idsOhneNamenstreffer}) AND entfernt_am IS NULL AND suchtext LIKE ${m} ORDER BY firma_id, haupt DESC`) as any[];
      for (const r of k) fundstellen.set(Number(r.firma_id), `Kontakt: ${r.name}`);
      const v = (await lauf`SELECT DISTINCT ON (firma_id) firma_id, titel, am FROM fiaon_partner_verlauf
                              WHERE firma_id = ANY(${idsOhneNamenstreffer}) AND entfernt_am IS NULL AND suchtext LIKE ${m} ORDER BY firma_id, am DESC`) as any[];
      for (const r of v) if (!fundstellen.has(Number(r.firma_id))) fundstellen.set(Number(r.firma_id), `Verlauf: ${r.titel}`);
    }
  }

  const firmen: PartnerKarte[] = zeilen.map((z) => ({
    id: Number(z.id), name: String(z.name), art: z.art, status: z.status, vertraulich: !!z.vertraulich, ort: z.ort ?? "", landCode: z.land_code ?? "",
    tags: Array.isArray(z.tags) ? z.tags : [],
    hauptkontakt: z.hk_name ? { name: z.hk_name, rolle: z.hk_rolle ?? "", email: z.hk_email ?? "", telefon: z.hk_telefon ?? "", durchwahl: z.hk_durchwahl ?? "" } : null,
    kontakte: Number(z.kontakte), offeneAufgaben: Number(z.offen), ueberfaellig: Number(z.ueber),
    naechsteAufgabe: z.na_titel ? { titel: z.na_titel, faelligAm: iso(z.na_faellig), ueberfaellig: !!(iso(z.na_faellig) && iso(z.na_faellig)! < heute) } : null,
    letzteAktivitaet: z.lv_am ? { am: iso(z.lv_am)!, typ: z.lv_typ, titel: z.lv_titel } : null,
    betreuer: z.betreuer_name ?? null, angebotRef: z.angebot_ref ?? null, personId: z.person_id != null ? Number(z.person_id) : null,
    fund: fundstellen.get(Number(z.id)) ?? null, archiviert: !!z.archiviert_am,
  }));

  // Einzelkontakte (ohne Firma) — bei Suche nur die treffenden, sonst alle.
  let kbed = lauf`TRUE`;
  for (const w of woerter) kbed = lauf`${kbed} AND k.suchtext LIKE ${likeMuster(w)}`;
  const kontakte = ((await lauf`SELECT k.* FROM fiaon_partner_kontakte k WHERE k.firma_id IS NULL AND k.entfernt_am IS NULL AND ${kbed} ORDER BY k.name LIMIT 200`) as any[]).map(kontaktAusZeile);

  // IA-KOOP-Partner ohne Akte (Vorschlag „als Partner-Akte anlegen“).
  const koop = (await lauf`
    SELECT ga.id, ga.angebot_ref, ga.status, ga.kunde FROM fiaon_global_angebote ga
     WHERE ga.fassung LIKE 'IA-KOOP-%' AND ga.status IN ('offen', 'angenommen')
       AND NOT EXISTS (SELECT 1 FROM fiaon_partner_firmen f WHERE f.angebot_id = ga.id AND f.archiviert_am IS NULL)
     ORDER BY ga.id DESC LIMIT 50`.catch((e: unknown) => { console.error("[PARTNER-CRM] Kooperationen nicht lesbar:", e instanceof Error ? e.message : e); return []; })) as any[];
  const koopOhneAkte: KoopOhneAkte[] = koop.map((z) => {
    const k = (z.kunde && typeof z.kunde === "object" ? z.kunde : {}) as Record<string, string>;
    const person = [k.vorname, k.nachname].filter(Boolean).join(" ");
    // „firma“ ist im Kooperationsvertrag die Geschäftsbezeichnung („Finanz- und Vermögensberatung“), kein Name — der Name ist die Person.
    const name = [person, zeile(k.firma)].filter(Boolean).join(" · ") || String(z.angebot_ref);
    return { angebotId: Number(z.id), ref: String(z.angebot_ref), status: String(z.status), name, email: k.email ?? "", telefon: k.telefon ?? "", ort: [k.plz, k.ort].filter(Boolean).join(" ") };
  }).filter((x) => !woerter.length || woerter.every((w) => suchtextAus([x.name, x.email, x.ort, x.ref], [x.telefon]).includes(w)));

  const [z] = (await lauf`SELECT COUNT(*)::int AS gesamt, COUNT(*) FILTER (WHERE status = 'aktiv')::int AS aktiv,
                                 COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM fiaon_partner_aufgaben t WHERE t.firma_id = f.id AND t.entfernt_am IS NULL AND t.erledigt_am IS NULL AND t.faellig_am < ${heute}::date))::int AS ueber
                            FROM fiaon_partner_firmen f WHERE f.archiviert_am IS NULL`) as any[];
  return { firmen, kontakte, koopOhneAkte, zaehler: { gesamt: Number(z?.gesamt ?? 0), aktiv: Number(z?.aktiv ?? 0), ueberfaellig: Number(z?.ueber ?? 0) } };
}

// ── Akte ───────────────────────────────────────────────────────────────────
export interface VerlaufSicht { id: number; typ: string; am: string; titel: string; text: string; autor: string | null; kontaktId: number | null; dokumentId: number | null; dokumentTitel: string | null; erstelltAm: string }
export interface DokumentSicht { id: number; art: string; titel: string; dateiname: string; mime: string; groesse: number; gueltigAb: string | null; gueltigBis: string | null; notiz: string; hochgeladenVon: string | null; erstelltAm: string; kontaktId: number | null }
export interface AufgabeSicht { id: number; titel: string; notiz: string; faelligAm: string | null; zustaendig: string; erledigtAm: string | null; erledigtVon: string | null; erstelltVon: string | null; kontaktId: number | null; erstelltAm: string }
export interface PartnerAkte {
  firma: FirmaSicht; kontakte: KontaktSicht[]; verlauf: VerlaufSicht[]; dokumente: DokumentSicht[]; aufgaben: AufgabeSicht[];
  koop: { id: number; ref: string; status: string; angenommenAm: string | null } | null;
  hinweise: LageHinweis[];
}

export async function partnerAkte(id: number, lauf: Lauf = sqlPool): Promise<PartnerAkte | null> {
  await ensurePartnerTabellen();
  const [f] = (await lauf`SELECT f.*, a.name AS betreuer_name FROM fiaon_partner_firmen f LEFT JOIN fiaon_agents a ON a.id = f.betreuer_agent_id WHERE f.id = ${id}`) as any[];
  if (!f) return null;
  const firma = firmaAusZeile(f);
  const kontakte = ((await lauf`SELECT * FROM fiaon_partner_kontakte WHERE firma_id = ${id} AND entfernt_am IS NULL ORDER BY haupt DESC, name ASC`) as any[]).map(kontaktAusZeile);
  const verlauf: VerlaufSicht[] = ((await lauf`
    SELECT v.*, d.titel AS dokument_titel FROM fiaon_partner_verlauf v LEFT JOIN fiaon_partner_dokumente d ON d.id = v.dokument_id AND d.entfernt_am IS NULL
     WHERE v.firma_id = ${id} AND v.entfernt_am IS NULL ORDER BY v.am DESC, v.id DESC LIMIT 500`) as any[]).map((z) => ({
    id: Number(z.id), typ: z.typ, am: iso(z.am)!, titel: z.titel, text: z.text ?? "", autor: z.autor ?? null, kontaktId: z.kontakt_id != null ? Number(z.kontakt_id) : null,
    dokumentId: z.dokument_titel ? Number(z.dokument_id) : null, dokumentTitel: z.dokument_titel ?? null, erstelltAm: zeit(z.created_at)!,
  }));
  const dokumente: DokumentSicht[] = ((await lauf`
    SELECT id, art, titel, dateiname, mime, groesse, gueltig_ab, gueltig_bis, notiz, hochgeladen_von, created_at, kontakt_id
      FROM fiaon_partner_dokumente WHERE firma_id = ${id} AND entfernt_am IS NULL ORDER BY created_at DESC`) as any[]).map((z) => ({
    id: Number(z.id), art: z.art, titel: z.titel, dateiname: z.dateiname, mime: z.mime, groesse: Number(z.groesse), gueltigAb: iso(z.gueltig_ab), gueltigBis: iso(z.gueltig_bis),
    notiz: z.notiz ?? "", hochgeladenVon: z.hochgeladen_von ?? null, erstelltAm: zeit(z.created_at)!, kontaktId: z.kontakt_id != null ? Number(z.kontakt_id) : null,
  }));
  const aufgaben: AufgabeSicht[] = ((await lauf`
    SELECT * FROM fiaon_partner_aufgaben WHERE firma_id = ${id} AND entfernt_am IS NULL
     ORDER BY (erledigt_am IS NOT NULL) ASC, faellig_am ASC NULLS LAST, id ASC`) as any[]).map((z) => ({
    id: Number(z.id), titel: z.titel, notiz: z.notiz ?? "", faelligAm: iso(z.faellig_am), zustaendig: z.zustaendig ?? "", erledigtAm: zeit(z.erledigt_am),
    erledigtVon: z.erledigt_von ?? null, erstelltVon: z.erstellt_von ?? null, kontaktId: z.kontakt_id != null ? Number(z.kontakt_id) : null, erstelltAm: zeit(z.created_at)!,
  }));
  let koop: PartnerAkte["koop"] = null;
  if (firma.angebotId) {
    const [g] = (await lauf`SELECT id, angebot_ref, status, angenommen_am FROM fiaon_global_angebote WHERE id = ${firma.angebotId}`.catch(() => [])) as any[];
    if (g) koop = { id: Number(g.id), ref: String(g.angebot_ref), status: String(g.status), angenommenAm: zeit(g.angenommen_am) };
  }
  const hinweise = partnerHinweise(lageEingang({ firma, kontakte, verlauf, dokumente, aufgaben }));
  return { firma, kontakte, verlauf, dokumente, aufgaben, koop, hinweise };
}

export function lageEingang(a: Pick<PartnerAkte, "firma" | "kontakte" | "verlauf" | "dokumente" | "aufgaben">): LageEingang {
  return {
    heute: berlinToday(), status: a.firma.status, art: a.firma.art, konditionen: a.firma.konditionen,
    kontakte: a.kontakte.map((k) => ({ name: k.name, email: k.email, telefon: k.telefon || k.mobil, haupt: k.haupt })),
    aufgaben: a.aufgaben.map((t) => ({ titel: t.titel, faelligAm: t.faelligAm, erledigt: !!t.erledigtAm })),
    verlauf: a.verlauf.map((v) => ({ am: v.am, typ: v.typ, titel: v.titel })),
    dokumente: a.dokumente.map((d) => ({ titel: d.titel, art: d.art, gueltigBis: d.gueltigBis })),
  };
}

// ── Firma ──────────────────────────────────────────────────────────────────
async function betreuerPruefen(id: number | null, lauf: Lauf): Promise<string | null> {
  if (!id) return null;
  const [a] = (await lauf`SELECT id FROM fiaon_agents WHERE id = ${id} AND COALESCE(active, TRUE)`) as any[];
  return a ? null : "Diese zuständige Person gibt es nicht (oder sie ist nicht aktiv).";
}

export async function firmaAnlegen(roh: unknown, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  const p = firmaPruefen(roh);
  if (!p.ok) return nein(p.error);
  const f = p.wert;
  const bf = await betreuerPruefen(f.betreuerAgentId, lauf);
  if (bf) return nein(bf);
  if (f.angebotId) {
    const [schon] = (await lauf`SELECT id, name FROM fiaon_partner_firmen WHERE angebot_id = ${f.angebotId} AND archiviert_am IS NULL`) as any[];
    if (schon) return nein(`Zu dieser Kooperation gibt es schon die Akte „${schon.name}“.`, 409);
  }
  const [z] = (await lauf`
    INSERT INTO fiaon_partner_firmen (name, art, status, website, email, telefon, strasse, hausnummer, adresszusatz, plz, ort, region, land_code,
      register_nr, steuer_nr, ust_id, leistung, konditionen, tags, notizen, betreuer_agent_id, vertraulich, angebot_id, person_id, suchtext, erstellt_von)
    VALUES (${f.name}, ${f.art}, ${f.status}, ${leerNull(f.website)}, ${leerNull(f.email)}, ${leerNull(f.telefon)}, ${leerNull(f.strasse)}, ${leerNull(f.hausnummer)},
      ${leerNull(f.adresszusatz)}, ${leerNull(f.plz)}, ${leerNull(f.ort)}, ${leerNull(f.region)}, ${leerNull(f.landCode)}, ${leerNull(f.registerNr)}, ${leerNull(f.steuerNr)},
      ${leerNull(f.ustId)}, ${leerNull(f.leistung)}, ${lauf.json(f.konditionen as any)}, ${f.tags}, ${leerNull(f.notizen)}, ${f.betreuerAgentId}, ${f.vertraulich},
      ${f.angebotId}, ${f.personId}, ${firmaSuchtext(f)}, ${wer})
    RETURNING id`) as any[];
  return { ok: true, id: Number(z.id), meldung: `Partner „${f.name}“ angelegt.` };
}

/** Ändert die Stammdaten. Felder, die im Aufruf fehlen, bleiben (es wird der gespeicherte Stand ergänzt). */
export async function firmaAendern(id: number, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [alt] = (await lauf`SELECT * FROM fiaon_partner_firmen WHERE id = ${id}`) as any[];
  if (!alt) return nein("Diesen Partner gibt es nicht.", 404);
  const a = firmaAusZeile(alt);
  const p = firmaPruefen({ ...a, ...(roh && typeof roh === "object" ? roh : {}) });
  if (!p.ok) return nein(p.error);
  const f = p.wert;
  const bf = f.betreuerAgentId !== a.betreuerAgentId ? await betreuerPruefen(f.betreuerAgentId, lauf) : null;
  if (bf) return nein(bf);
  await lauf`
    UPDATE fiaon_partner_firmen SET name = ${f.name}, art = ${f.art}, status = ${f.status}, website = ${leerNull(f.website)}, email = ${leerNull(f.email)},
      telefon = ${leerNull(f.telefon)}, strasse = ${leerNull(f.strasse)}, hausnummer = ${leerNull(f.hausnummer)}, adresszusatz = ${leerNull(f.adresszusatz)},
      plz = ${leerNull(f.plz)}, ort = ${leerNull(f.ort)}, region = ${leerNull(f.region)}, land_code = ${leerNull(f.landCode)}, register_nr = ${leerNull(f.registerNr)},
      steuer_nr = ${leerNull(f.steuerNr)}, ust_id = ${leerNull(f.ustId)}, leistung = ${leerNull(f.leistung)}, konditionen = ${lauf.json(f.konditionen as any)},
      tags = ${f.tags}, notizen = ${leerNull(f.notizen)}, betreuer_agent_id = ${f.betreuerAgentId}, vertraulich = ${f.vertraulich},
      angebot_id = ${f.angebotId}, person_id = ${f.personId}, suchtext = ${firmaSuchtext(f)}, updated_at = NOW()
    WHERE id = ${id}`;
  // Ein Statuswechsel ist ein Ereignis — er steht im Verlauf (wer, wann, von → nach).
  if (a.status !== f.status) {
    await verlaufSchreiben({ firmaId: id, kontaktId: null, typ: "notiz", am: berlinToday(), titel: `Status: ${statusText(a.status)} → ${statusText(f.status)}`, text: "", dokumentId: null }, wer, lauf);
  }
  return { ok: true, meldung: "Gespeichert." };
}
const statusText = (s: string) => ({ gespraech: "Im Gespräch", aktiv: "Aktiv", pausiert: "Pausiert", beendet: "Beendet" } as Record<string, string>)[s] ?? s;

export async function firmaArchivieren(id: number, zurueck: boolean, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [z] = (await lauf`
    UPDATE fiaon_partner_firmen SET archiviert_am = ${zurueck ? null : lauf`NOW()`}, archiviert_von = ${zurueck ? null : wer}, updated_at = NOW()
     WHERE id = ${id} RETURNING name`) as any[];
  if (!z) return nein("Diesen Partner gibt es nicht.", 404);
  return { ok: true, meldung: zurueck ? `„${z.name}“ ist wieder in der Liste.` : `„${z.name}“ archiviert — unter „Archiv“ jederzeit zurückholbar.` };
}

// ── Kontakt ────────────────────────────────────────────────────────────────
async function firmaDa(id: number | null, lauf: Lauf): Promise<boolean> {
  if (!id) return true;
  const [f] = (await lauf`SELECT 1 AS ja FROM fiaon_partner_firmen WHERE id = ${id}`) as any[];
  return !!f;
}

export async function kontaktSpeichern(id: number | null, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  let basis: Record<string, unknown> = {};
  if (id) {
    const [alt] = (await lauf`SELECT * FROM fiaon_partner_kontakte WHERE id = ${id} AND entfernt_am IS NULL`) as any[];
    if (!alt) return nein("Diesen Kontakt gibt es nicht.", 404);
    basis = kontaktAusZeile(alt) as unknown as Record<string, unknown>;
  }
  const p = kontaktPruefen({ ...basis, ...(roh && typeof roh === "object" ? roh : {}) });
  if (!p.ok) return nein(p.error);
  const k = p.wert;
  if (!(await firmaDa(k.firmaId, lauf))) return nein("Diesen Partner gibt es nicht.", 404);
  // Höchstens ein Hauptkontakt je Firma: Wer ihn setzt, nimmt ihn den anderen.
  if (k.haupt && k.firmaId) await lauf`UPDATE fiaon_partner_kontakte SET haupt = FALSE, updated_at = NOW() WHERE firma_id = ${k.firmaId} AND haupt AND id <> ${id ?? 0}`;
  let neuId = id;
  if (id) {
    await lauf`
      UPDATE fiaon_partner_kontakte SET firma_id = ${k.firmaId}, name = ${k.name}, rolle = ${leerNull(k.rolle)}, email = ${leerNull(k.email)}, telefon = ${leerNull(k.telefon)},
        mobil = ${leerNull(k.mobil)}, durchwahl = ${leerNull(k.durchwahl)}, erreichbarkeit = ${leerNull(k.erreichbarkeit)}, sprache = ${leerNull(k.sprache)},
        strasse = ${leerNull(k.strasse)}, hausnummer = ${leerNull(k.hausnummer)}, adresszusatz = ${leerNull(k.adresszusatz)}, plz = ${leerNull(k.plz)}, ort = ${leerNull(k.ort)},
        region = ${leerNull(k.region)}, land_code = ${leerNull(k.landCode)}, notizen = ${leerNull(k.notizen)}, haupt = ${k.haupt}, suchtext = ${kontaktSuchtext(k)}, updated_at = NOW()
      WHERE id = ${id}`;
  } else {
    // Der erste Kontakt einer Firma wird Hauptkontakt, ohne dass jemand daran denken muss.
    let haupt = k.haupt;
    if (!haupt && k.firmaId) {
      const [n] = (await lauf`SELECT COUNT(*)::int AS n FROM fiaon_partner_kontakte WHERE firma_id = ${k.firmaId} AND entfernt_am IS NULL`) as any[];
      haupt = Number(n?.n ?? 0) === 0;
    }
    const [z] = (await lauf`
      INSERT INTO fiaon_partner_kontakte (firma_id, name, rolle, email, telefon, mobil, durchwahl, erreichbarkeit, sprache, strasse, hausnummer, adresszusatz,
        plz, ort, region, land_code, notizen, haupt, suchtext, erstellt_von)
      VALUES (${k.firmaId}, ${k.name}, ${leerNull(k.rolle)}, ${leerNull(k.email)}, ${leerNull(k.telefon)}, ${leerNull(k.mobil)}, ${leerNull(k.durchwahl)},
        ${leerNull(k.erreichbarkeit)}, ${leerNull(k.sprache)}, ${leerNull(k.strasse)}, ${leerNull(k.hausnummer)}, ${leerNull(k.adresszusatz)}, ${leerNull(k.plz)},
        ${leerNull(k.ort)}, ${leerNull(k.region)}, ${leerNull(k.landCode)}, ${leerNull(k.notizen)}, ${haupt}, ${kontaktSuchtext(k)}, ${wer})
      RETURNING id`) as any[];
    neuId = Number(z.id);
  }
  if (k.firmaId) await lauf`UPDATE fiaon_partner_firmen SET updated_at = NOW() WHERE id = ${k.firmaId}`;
  return { ok: true, id: neuId!, meldung: id ? "Kontakt gespeichert." : `Kontakt „${k.name}“ angelegt.` };
}

export async function kontaktEntfernen(id: number, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [z] = (await lauf`UPDATE fiaon_partner_kontakte SET entfernt_am = NOW(), haupt = FALSE, updated_at = NOW() WHERE id = ${id} AND entfernt_am IS NULL RETURNING name`) as any[];
  return z ? { ok: true, meldung: `Kontakt „${z.name}“ entfernt.` } : nein("Diesen Kontakt gibt es nicht.", 404);
}

// ── Verlauf ────────────────────────────────────────────────────────────────
async function verlaufSchreiben(v: { firmaId: number | null; kontaktId: number | null; typ: string; am: string; titel: string; text: string; dokumentId: number | null }, wer: string, lauf: Lauf): Promise<number> {
  const [z] = (await lauf`
    INSERT INTO fiaon_partner_verlauf (firma_id, kontakt_id, typ, am, titel, text, autor, dokument_id, suchtext)
    VALUES (${v.firmaId}, ${v.kontaktId}, ${v.typ}, ${v.am}, ${v.titel}, ${leerNull(v.text)}, ${wer}, ${v.dokumentId}, ${verlaufSuchtext(v.titel, v.text)})
    RETURNING id`) as any[];
  if (v.firmaId) await lauf`UPDATE fiaon_partner_firmen SET updated_at = NOW() WHERE id = ${v.firmaId}`;
  return Number(z.id);
}

export async function verlaufAnlegen(roh: unknown, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  const p = verlaufPruefen(roh, berlinToday());
  if (!p.ok) return nein(p.error);
  const v = p.wert;
  if (!(await firmaDa(v.firmaId, lauf))) return nein("Diesen Partner gibt es nicht.", 404);
  if (v.dokumentId) {
    const [d] = (await lauf`SELECT firma_id FROM fiaon_partner_dokumente WHERE id = ${v.dokumentId} AND entfernt_am IS NULL`) as any[];
    if (!d || (v.firmaId && Number(d.firma_id) !== v.firmaId)) return nein("Das Dokument gehört nicht zu diesem Partner.");
  }
  const id = await verlaufSchreiben(v, wer, lauf);
  return { ok: true, id, meldung: "Im Verlauf eingetragen." };
}

export async function verlaufEntfernen(id: number, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [z] = (await lauf`UPDATE fiaon_partner_verlauf SET entfernt_am = NOW(), entfernt_von = ${wer} WHERE id = ${id} AND entfernt_am IS NULL RETURNING id`) as any[];
  return z ? { ok: true, meldung: "Eintrag entfernt." } : nein("Diesen Eintrag gibt es nicht.", 404);
}

// ── Aufgaben ───────────────────────────────────────────────────────────────
export async function aufgabeSpeichern(id: number | null, roh: any, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  if (id) {
    const [alt] = (await lauf`SELECT * FROM fiaon_partner_aufgaben WHERE id = ${id} AND entfernt_am IS NULL`) as any[];
    if (!alt) return nein("Diese Aufgabe gibt es nicht.", 404);
    // Nur „erledigt“ umschalten?
    if (roh && typeof roh === "object" && "erledigt" in roh && Object.keys(roh).length === 1) {
      const erledigt = roh.erledigt === true;
      await lauf`UPDATE fiaon_partner_aufgaben SET erledigt_am = ${erledigt ? lauf`NOW()` : null}, erledigt_von = ${erledigt ? wer : null}, updated_at = NOW() WHERE id = ${id}`;
      if (erledigt && alt.firma_id) {
        await verlaufSchreiben({ firmaId: Number(alt.firma_id), kontaktId: alt.kontakt_id != null ? Number(alt.kontakt_id) : null, typ: "aufgabe", am: berlinToday(), titel: `Erledigt: ${alt.titel}`, text: "", dokumentId: null }, wer, lauf);
      }
      return { ok: true, id, meldung: erledigt ? "Erledigt." : "Wieder offen." };
    }
    const p = aufgabePruefen({ firmaId: alt.firma_id, kontaktId: alt.kontakt_id, titel: alt.titel, notiz: alt.notiz, faelligAm: iso(alt.faellig_am) ?? "", zustaendig: alt.zustaendig, ...roh });
    if (!p.ok) return nein(p.error);
    const t = p.wert;
    await lauf`UPDATE fiaon_partner_aufgaben SET titel = ${t.titel}, notiz = ${leerNull(t.notiz)}, faellig_am = ${t.faelligAm || null}, zustaendig = ${leerNull(t.zustaendig)}, updated_at = NOW() WHERE id = ${id}`;
    return { ok: true, id, meldung: "Aufgabe gespeichert." };
  }
  const p = aufgabePruefen(roh);
  if (!p.ok) return nein(p.error);
  const t = p.wert;
  if (!(await firmaDa(t.firmaId, lauf))) return nein("Diesen Partner gibt es nicht.", 404);
  const [z] = (await lauf`
    INSERT INTO fiaon_partner_aufgaben (firma_id, kontakt_id, titel, notiz, faellig_am, zustaendig, erstellt_von)
    VALUES (${t.firmaId}, ${t.kontaktId}, ${t.titel}, ${leerNull(t.notiz)}, ${t.faelligAm || null}, ${leerNull(t.zustaendig)}, ${wer}) RETURNING id`) as any[];
  if (t.firmaId) await lauf`UPDATE fiaon_partner_firmen SET updated_at = NOW() WHERE id = ${t.firmaId}`;
  return { ok: true, id: Number(z.id), meldung: "Aufgabe angelegt." };
}

export async function aufgabeEntfernen(id: number, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [z] = (await lauf`UPDATE fiaon_partner_aufgaben SET entfernt_am = NOW(), updated_at = NOW() WHERE id = ${id} AND entfernt_am IS NULL RETURNING id`) as any[];
  return z ? { ok: true, meldung: "Aufgabe entfernt." } : nein("Diese Aufgabe gibt es nicht.", 404);
}

// ── Dokumente ──────────────────────────────────────────────────────────────
export async function dokumentAblegen(meta: unknown, datei: { buffer: Buffer; originalname: string } | null, wer: string, opt: { ohneVerlauf?: boolean } = {}, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  const p = dokumentMetaPruefen(meta);
  if (!p.ok) return nein(p.error);
  const m = p.wert;
  if (!datei?.buffer?.length) return nein("Bitte eine Datei wählen.");
  if (datei.buffer.length > GLOBAL_DATEI_MAX_BYTES) return nein("Die Datei ist größer als 15 MB.");
  const typ = globalDateiTyp(datei.buffer);
  if (!typ) return nein("Nur PDF, JPG, PNG oder HEIC — erkannt am Inhalt der Datei.");
  if (!(await firmaDa(m.firmaId, lauf))) return nein("Diesen Partner gibt es nicht.", 404);
  const dateiname = globalDateiname(datei.originalname, typ.endung);
  const titel = m.titel || dateiname.replace(/\.[a-z0-9]+$/i, "");
  const pruefsumme = createHash("sha256").update(datei.buffer).digest("hex");
  const [z] = (await lauf`
    INSERT INTO fiaon_partner_dokumente (firma_id, kontakt_id, art, titel, dateiname, mime, groesse, pruefsumme, inhalt, gueltig_ab, gueltig_bis, notiz, hochgeladen_von)
    VALUES (${m.firmaId}, ${m.kontaktId}, ${m.art}, ${titel}, ${dateiname}, ${typ.mime}, ${datei.buffer.length}, ${pruefsumme}, ${datei.buffer},
      ${m.gueltigAb || null}, ${m.gueltigBis || null}, ${leerNull(m.notiz)}, ${wer})
    RETURNING id`) as any[];
  const id = Number(z.id);
  if (!opt.ohneVerlauf) {
    const typV = m.art === "vertrag" || m.art === "vereinbarung" || m.art === "rechnung" ? m.art : "notiz";
    await verlaufSchreiben({ firmaId: m.firmaId, kontaktId: m.kontaktId, typ: typV, am: berlinToday(), titel: `Dokument abgelegt: ${titel}`, text: m.notiz, dokumentId: id }, wer, lauf);
  }
  return { ok: true, id, meldung: `„${titel}“ abgelegt.` };
}

export async function dokumentLesen(id: number, lauf: Lauf = sqlPool): Promise<{ dateiname: string; mime: string; inhalt: Buffer } | null> {
  await ensurePartnerTabellen();
  const [d] = (await lauf`SELECT dateiname, mime, inhalt FROM fiaon_partner_dokumente WHERE id = ${id} AND entfernt_am IS NULL`) as any[];
  return d ? { dateiname: String(d.dateiname), mime: String(d.mime), inhalt: Buffer.from(d.inhalt) } : null;
}

export async function dokumentEntfernen(id: number, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ meldung: string }>> {
  await ensurePartnerTabellen();
  const [z] = (await lauf`UPDATE fiaon_partner_dokumente SET entfernt_am = NOW(), entfernt_von = ${wer} WHERE id = ${id} AND entfernt_am IS NULL RETURNING titel`) as any[];
  return z ? { ok: true, meldung: `„${z.titel}“ entfernt (bleibt im Archiv der Datenbank).` } : nein("Dieses Dokument gibt es nicht.", 404);
}

// ── Kooperation (IA-KOOP-) → Partner-Akte ──────────────────────────────────
export async function ausKoopAnlegen(angebotId: number, wer: string, lauf: Lauf = sqlPool): Promise<Ergebnis<{ id: number; meldung: string }>> {
  await ensurePartnerTabellen();
  const [g] = (await lauf`SELECT id, angebot_ref, fassung, status, person_id, kunde, angenommen_am, created_at FROM fiaon_global_angebote WHERE id = ${angebotId}`) as any[];
  if (!g || !String(g.fassung).startsWith("IA-KOOP-")) return nein("Diesen Kooperationsvertrag gibt es nicht.", 404);
  const k = (g.kunde && typeof g.kunde === "object" ? g.kunde : {}) as Record<string, string>;
  const person = zeile([k.vorname, k.nachname].filter(Boolean).join(" "), 120);
  // „firma“ ist im Kooperationsvertrag die Geschäftsbezeichnung (z. B. „Finanz- und Vermögensberatung“) — der Name ist die Person.
  const bezeichnung = zeile(k.firma, 160);
  const name = person || bezeichnung || String(g.angebot_ref);
  const erg = await firmaAnlegen({
    name, art: "kooperation", status: g.status === "angenommen" ? "aktiv" : "gespraech", email: emailSauber(k.email), telefon: telefonSauber(k.telefon),
    strasse: k.strasse, plz: k.plz, ort: k.ort, landCode: landCodeAus(k.land), angebotId: Number(g.id), personId: g.person_id != null ? Number(g.person_id) : null,
    leistung: `${bezeichnung ? `${bezeichnung}. ` : ""}Kooperation „Termine für Ihre Beratung“ — Vertrag, Empfehlungen und Provision unten im Reiter unter „Kooperationsverträge“.`,
  }, wer, lauf);
  if (!erg.ok) return erg;
  if (person) {
    const kt = await kontaktSpeichern(null, { firmaId: erg.id, name: person, rolle: "Inhaber", email: emailSauber(k.email), telefon: telefonSauber(k.telefon), haupt: true, sprache: "de" }, wer, lauf);
    if (!kt.ok) console.error(`[PARTNER-CRM] ${g.angebot_ref}: Kontakt nicht angelegt: ${kt.error}`);
  }
  const amVertrag = iso(g.angenommen_am) ?? iso(g.created_at) ?? berlinToday();
  await verlaufSchreiben({
    firmaId: erg.id, kontaktId: null, typ: "vertrag", am: amVertrag,
    titel: g.status === "angenommen" ? `Kooperationsvertrag ${g.angebot_ref} angenommen` : `Kooperationsvertrag ${g.angebot_ref} angeboten`,
    text: "Aus dem Kooperationsvertrag übernommen (Name und Kontaktdaten).", dokumentId: null,
  }, wer, lauf);
  return { ok: true, id: erg.id, meldung: `Partner-Akte „${name}“ aus ${g.angebot_ref} angelegt.` };
}

// ── „Aus E-Mail übernehmen“: Bestand für Treffer und bestätigtes Speichern ──
export async function bestandFuerTreffer(lauf: Lauf = sqlPool): Promise<BestandFirma[]> {
  await ensurePartnerTabellen();
  const z = (await lauf`
    SELECT f.id, f.name, f.website, f.email, COALESCE(array_agg(k.email) FILTER (WHERE k.email IS NOT NULL AND k.entfernt_am IS NULL), '{}') AS mails
      FROM fiaon_partner_firmen f LEFT JOIN fiaon_partner_kontakte k ON k.firma_id = f.id
     WHERE f.archiviert_am IS NULL GROUP BY f.id`) as any[];
  return z.map((r) => ({ id: Number(r.id), name: String(r.name), website: r.website ?? null, email: r.email ?? null, kontaktEmails: Array.isArray(r.mails) ? r.mails : [] }));
}

export interface Uebernahme {
  /** Bestehender Partner — dann wird die Firma NICHT überschrieben, nur leere Felder ergänzt. */
  firmaId?: number | null;
  firma?: MailVorschlag["firma"] & { status?: string; konditionen?: Kondition[]; tags?: string[]; vertraulich?: boolean };
  kontakte?: (MailVorschlag["kontakte"][number] & { haupt?: boolean; aktualisieren?: number | null })[];
  verlauf?: MailVorschlag["verlauf"];
  aufgabe?: MailVorschlag["aufgabe"];
  quelltext?: string;
}
/**
 * Speichert, was ein Mensch in der Vorschau bestätigt hat — in EINER Transaktion: Firma (neu oder ergänzt), Kontakte
 * (neu; gleiche E-Mail beim Partner = ergänzt statt doppelt), ein Verlaufseintrag mit der Mail als Text, eine Aufgabe.
 */
export async function uebernehmen(u: Uebernahme, wer: string): Promise<Ergebnis<{ id: number; meldung: string; angelegt: string[] }>> {
  await ensurePartnerTabellen();
  try {
    return await sqlPool.begin(async (tx: any) => {
      const angelegt: string[] = [];
      let firmaId = Number(u.firmaId) || 0;
      if (firmaId) {
        const [alt] = (await tx`SELECT * FROM fiaon_partner_firmen WHERE id = ${firmaId} FOR UPDATE`) as any[];
        if (!alt) throw new UebernahmeFehler("Diesen Partner gibt es nicht.", 404);
        if (u.firma) {
          const a = firmaAusZeile(alt);
          const ergaenzt: Record<string, unknown> = {};
          for (const key of ["website", "email", "telefon", "strasse", "hausnummer", "adresszusatz", "plz", "ort", "region", "landCode", "registerNr", "steuerNr", "ustId", "leistung"] as const) {
            if (!(a as any)[key] && (u.firma as any)[key]) ergaenzt[key] = (u.firma as any)[key];
          }
          const neueKond = (u.firma.konditionen ?? []).filter((k) => !a.konditionen.some((x) => x.label === k.label && x.value === k.value));
          if (neueKond.length) ergaenzt.konditionen = [...a.konditionen, ...neueKond];
          const neueTags = (u.firma.tags ?? []).filter((t) => !a.tags.includes(t));
          if (neueTags.length) ergaenzt.tags = [...a.tags, ...neueTags];
          if (Object.keys(ergaenzt).length) {
            const e = await firmaAendern(firmaId, ergaenzt, wer, tx);
            if (!e.ok) throw new UebernahmeFehler(e.error, e.status);
            angelegt.push(`ergänzt: ${Object.keys(ergaenzt).length} Feld${Object.keys(ergaenzt).length === 1 ? "" : "er"}`);
          }
        }
      } else {
        if (!u.firma) throw new UebernahmeFehler("Ohne Partner kann nichts übernommen werden.");
        const e = await firmaAnlegen(u.firma, wer, tx);
        if (!e.ok) throw new UebernahmeFehler(e.error, e.status);
        firmaId = e.id;
        angelegt.push(`Partner „${zeile(u.firma.name, 80)}“`);
      }
      // Bestehende Kontakte des Partners: gleiche E-Mail ODER gleicher Name (normalisiert) = derselbe Mensch — ergänzen statt doppelt.
      const da = (await tx`SELECT id, name, email FROM fiaon_partner_kontakte WHERE firma_id = ${firmaId} AND entfernt_am IS NULL`) as any[];
      for (const k of u.kontakte ?? []) {
        const mail = emailSauber(k.email);
        const name = suchNormal(k.name);
        const gleich = da.find((x) => (mail && String(x.email ?? "").toLowerCase() === mail) || (name && suchNormal(x.name) === name));
        const zielId = Number(k.aktualisieren) || (gleich ? Number(gleich.id) : null);
        const eingabe: Record<string, unknown> = { ...k, firmaId, notizen: k.notiz };
        if (zielId) {
          // Ergänzen, nicht überschreiben: nur Felder, die beim gespeicherten Kontakt leer sind.
          const [alt] = (await tx`SELECT * FROM fiaon_partner_kontakte WHERE id = ${zielId}`) as any[];
          const a = alt ? kontaktAusZeile(alt) : null;
          const nur: Record<string, unknown> = {};
          for (const key of ["rolle", "email", "telefon", "mobil", "durchwahl", "erreichbarkeit", "sprache", "notizen"] as const) if (a && !(a as any)[key] && eingabe[key]) nur[key] = eingabe[key];
          if (k.haupt) nur.haupt = true;
          if (Object.keys(nur).length) {
            const e = await kontaktSpeichern(zielId, nur, wer, tx);
            if (!e.ok) throw new UebernahmeFehler(`${k.name}: ${e.error}`, e.status);
            angelegt.push(`Kontakt ${a?.name ?? k.name} ergänzt`);
          }
        } else {
          const e = await kontaktSpeichern(null, eingabe, wer, tx);
          if (!e.ok) throw new UebernahmeFehler(`${k.name}: ${e.error}`, e.status);
          da.push({ id: e.id, name: k.name, email: mail });
          angelegt.push(`Kontakt ${zeile(k.name, 60)}`);
        }
      }
      if (u.verlauf && (zeile(u.verlauf.titel) || zeile(u.verlauf.text))) {
        const quelle = mehrzeilig(u.quelltext, 20000);
        const text = [mehrzeilig(u.verlauf.text, 2000), quelle ? `— Originaltext —\n${quelle}` : ""].filter(Boolean).join("\n\n");
        const e = await verlaufAnlegen({ firmaId, typ: u.verlauf.typ, am: u.verlauf.am, titel: u.verlauf.titel, text }, wer, tx);
        if (!e.ok) throw new UebernahmeFehler(`Verlauf: ${e.error}`, e.status);
        angelegt.push("Verlaufseintrag");
      }
      if (u.aufgabe && zeile(u.aufgabe.titel).length >= 3) {
        const e = await aufgabeSpeichern(null, { firmaId, titel: u.aufgabe.titel, faelligAm: u.aufgabe.faelligAm, notiz: u.aufgabe.notiz }, wer, tx);
        if (!e.ok) throw new UebernahmeFehler(`Aufgabe: ${e.error}`, e.status);
        angelegt.push("Aufgabe");
      }
      return { ok: true as const, id: firmaId, angelegt, meldung: `Übernommen: ${angelegt.join(" · ") || "nichts Neues"}.` };
    });
  } catch (e) {
    if (e instanceof UebernahmeFehler) return nein(e.message, e.status);
    throw e;
  }
}
class UebernahmeFehler extends Error { constructor(m: string, public status = 400) { super(m); } }

/** Wer im Chefbüro arbeitet, kann Betreuer werden (keine Prüfkonten, keine gesperrten Zugänge). */
export async function partnerMitarbeiter(lauf: Lauf = sqlPool): Promise<{ id: number; name: string }[]> {
  const z = (await lauf`
    SELECT id, name FROM fiaon_agents
     WHERE COALESCE(active, TRUE) AND NOT COALESCE(is_test_account, FALSE)
       AND COALESCE(rolle, 'agent') IN ('agent', 'vertriebsleiter', 'admin', 'onboarding', 'inkasso')
     ORDER BY name ASC`.catch((e: unknown) => { console.error("[PARTNER-CRM] Mitarbeiter nicht lesbar:", e instanceof Error ? e.message : e); return []; })) as any[];
  return z.map((r) => ({ id: Number(r.id), name: String(r.name) }));
}
