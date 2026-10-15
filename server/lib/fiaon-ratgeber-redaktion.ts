// ═══════════════════════════════════════════════════════════════════════════
// DIE RATGEBER-REDAKTION — jeden Tag ein Artikel je Bereich (15.10.2026, E-379)
//
// Justin: „Die Redaktion erstellt keine Artikel mehr. Es muss jeden Tag 1 neuer
// Artikel für die Privatkunden-Seite und 1 neuer Artikel für die Business-Kunden
// live gehen — immer aktuell und PERFEKT passend. Bitte fixen!"
//
// ── WARUM NICHTS MEHR KAM ─────────────────────────────────────────────────
// Der Tageslauf nahm Themen aus einem festen Plan (40 Stück, shared/fiaon-ratgeber.ts).
// Seit dem 31.08. waren alle benutzt („0 von 40 Themen offen") — der Lauf fand nichts
// und kehrte still zurück, sechs Wochen lang, als „erfolg" in der Historie. Und selbst
// vorher schrieb er nur Entwürfe, die auf einen Klick warteten.
//
// ── WIE ES JETZT GEHT (je Bereich, ab 06:00 Berlin, alle 30 Minuten geprüft) ─
//   1. Ist heute schon ein Artikel des Bereichs erschienen? Dann nichts.
//   2. Die Arbeitszeile wird ZUERST angelegt (eindeutiger Index auf
//      bereich + tagesartikel): Zwei Läufe können denselben Tag nie doppelt
//      beginnen, und Versuche zählen an EINER Stelle (Tagesdeckel).
//   3. RECHERCHE (OpenAI /v1/responses + Websuche): Die KI sucht, was in DACH
//      gerade aktuell ist, wählt ein Thema, das es bei uns noch nicht gibt, und
//      liefert die Fakten mit Quelle und Datum. Doppelte Themen prüft der Server
//      selbst nach (Titel, Keyword, Adresse) — die KI bekommt die Liste, aber
//      die Wand steht im Code.
//   4. SCHREIBEN im Hausstil des Bereichs, NUR aus dieser Faktenbasis. Den
//      Quellenblock baut der Server aus den Adressen der Recherche — eine
//      Adresse, die die Suche nicht gesehen hat, kommt nicht hinein.
//   5. Der STRENGE Prüfstand (pruefstand mit streng: true) ist das Tor: ok →
//      veröffentlicht (quelle 'ki'). Sonst schreibt die KI mit den Fehlern
//      neu — höchstens drei Mal je Lauf; danach bleibt es ein Entwurf und der
//      nächste Lauf versucht es wieder, bis der Tagesdeckel erreicht ist.
//
// KEINE AUFGABE an den Betreiber (Justin 15.10.: „hör auf, mir Aufgaben zu
// geben"). Ein Tag ohne Artikel zeigt sich als Fehler in der Lauf-Historie und
// auf der Maschinen-Ampel (LAUF_FOLGEN „ratgeber-tagesartikel").
//
// KI nur über openaiFetch (Anbieter-Weiche, KI-Pause, Kosten in fiaon_ki_nutzung).
// Die KI ist austauschbar (RedaktionKi) — der Prüfstand scripts/pruef-e379.ts
// setzt eine Attrappe ein und ruft nie das Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { openaiFetch, kiPausiert, istKiPause, kiSchluessel, kiLesenMoeglich } from "./fiaon-ki-pause";
import { nutzungMerken } from "./fiaon-postmeister-schema";
import { berlinToday } from "./fiaon-time";
import {
  AUTORIN, BEREICHE, BEREICH_LABEL, KATEGORIEN, THEMEN, hausstilFuer, kategorienFuer, bereichVonKategorie, pruefstand,
  slugify, lesezeitVon, type Artikel, type Bereich, type Kategorie, type Land, type Pruefung, type Quelle,
} from "@shared/fiaon-ratgeber";
import { SEO_SEITEN } from "@shared/fiaon-seo-seiten";
import { GLOBAL_SEITEN } from "@shared/fiaon-global-seiten";
import { GLOBAL_PAKETE, globalPreisText } from "@shared/fiaon-global";
import { START_ARTIKEL } from "./fiaon-ratgeber-start";
import { START_ARTIKEL_2 } from "./fiaon-ratgeber-start-2";
import { INSIDER_ARTIKEL } from "./fiaon-ratgeber-insider";
// 02.09.2026 (E-080): zehn Ratgeber zu den zehn neuen Werkzeugen — Justin: „direkt veröffentlichen".
import { WERKZEUG_ARTIKEL_1 } from "./fiaon-ratgeber-werkzeuge-1";
import { WERKZEUG_ARTIKEL_2 } from "./fiaon-ratgeber-werkzeuge-2";
import { WERKZEUG_ARTIKEL_3 } from "./fiaon-ratgeber-werkzeuge-3";
import { WERKZEUG_ARTIKEL_4 } from "./fiaon-ratgeber-werkzeuge-4";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Lauf = any;

/** Der Name des Laufs — in tageslauf(…), LAUF_FOLGEN und der Redaktion derselbe. */
export const RATGEBER_LAUF = "ratgeber-tagesartikel";
/** Ab dieser Berliner Stunde erscheint der Tagesartikel. */
export const AB_STUNDE = 6;
/** Schreibversuche je Lauf und Bereich (mit den Fehlern des Prüfstands als Rückmeldung). */
export const VERSUCHE_JE_LAUF = 3;
/** Höchstens so viele KI-Aufrufe (Recherche + Schreiben) je Bereich und Tag — danach wartet der Bereich auf morgen. */
export const VERSUCHE_JE_TAG = 9;
/** Das Modell — dasselbe wie Mara und der Radar (Werkzeuge + Denken nur über /v1/responses). */
export const MODELL = () => process.env.FIAON_RATGEBER_MODELL || "gpt-5.5";

// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLE
// ═══════════════════════════════════════════════════════════════════════════
let tabelleDa = false;

export async function ensureRatgeberTabelle(): Promise<void> {
  if (tabelleDa) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_ratgeber (
      id SERIAL PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      titel TEXT NOT NULL,
      untertitel TEXT,
      teaser TEXT NOT NULL DEFAULT '',
      inhalt TEXT NOT NULL DEFAULT '',
      kategorie TEXT NOT NULL DEFAULT 'grundlagen',
      land TEXT NOT NULL DEFAULT 'DE',
      keyword TEXT NOT NULL DEFAULT '',
      schlagworte JSONB NOT NULL DEFAULT '[]'::jsonb,
      faq JSONB NOT NULL DEFAULT '[]'::jsonb,
      meta_titel TEXT NOT NULL DEFAULT '',
      meta_beschreibung TEXT NOT NULL DEFAULT '',
      lesezeit INTEGER NOT NULL DEFAULT 6,
      status TEXT NOT NULL DEFAULT 'entwurf',
      quelle TEXT NOT NULL DEFAULT 'hand',
      modell TEXT,
      pruefung JSONB,
      thema_slug TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      published_at TIMESTAMPTZ
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_ratgeber_status_idx ON fiaon_ratgeber (status, published_at DESC)`;
  // E-379: dieselben Spalten wie db/migrations/109_ratgeber_bereich.sql — für Datenbanken, auf denen die Wanderung
  // (noch) nicht lief. „sprache" legte die Wanderung 083 des Zweigs vom 09.09. auf der Produktion an; hier nur,
  // wo sie fehlt (ADD COLUMN IF NOT EXISTS, die DDL-Wache prüft vorher im Katalog).
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS sprache TEXT NOT NULL DEFAULT 'de'`;
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS bereich TEXT NOT NULL DEFAULT 'privat'`;
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS tagesartikel DATE`;
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS recherche JSONB`;
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS anlass TEXT`;
  await sqlPool`ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS versuche INTEGER NOT NULL DEFAULT 0`;
  await sqlPool`UPDATE fiaon_ratgeber SET bereich = 'business' WHERE kategorie = 'firmen' AND bereich <> 'business'`;
  await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_ratgeber_tagesartikel_uq ON fiaon_ratgeber (bereich, tagesartikel) WHERE tagesartikel IS NOT NULL`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_ratgeber_bereich_idx ON fiaon_ratgeber (bereich, status, published_at DESC)`;
  // Die Startartikel — einmalig, von Hand geschrieben, sofort veröffentlicht.
  for (const a of [...START_ARTIKEL, ...START_ARTIKEL_2, ...INSIDER_ARTIKEL, ...WERKZEUG_ARTIKEL_1, ...WERKZEUG_ARTIKEL_2, ...WERKZEUG_ARTIKEL_3, ...WERKZEUG_ARTIKEL_4]) {
    const p = pruefstand({ titel: a.titel, teaser: a.teaser, inhalt: a.inhalt, faq: a.faq, metaTitel: a.metaTitel, metaBeschreibung: a.metaBeschreibung, keyword: a.keyword });
    await sqlPool`
      INSERT INTO fiaon_ratgeber (slug, titel, untertitel, teaser, inhalt, kategorie, land, keyword, schlagworte, faq, meta_titel, meta_beschreibung, lesezeit, status, quelle, pruefung, thema_slug, published_at, bereich)
      VALUES (${a.slug}, ${a.titel}, ${a.untertitel}, ${a.teaser}, ${a.inhalt}, ${a.kategorie}, ${a.land}, ${a.keyword}, ${JSON.stringify(a.schlagworte)}::text::jsonb, ${JSON.stringify(a.faq)}::text::jsonb,
              ${a.metaTitel}, ${a.metaBeschreibung}, ${lesezeitVon(a.inhalt)}, 'veroeffentlicht', 'hand', ${JSON.stringify(p)}::text::jsonb, ${a.slug}, NOW(), ${bereichVonKategorie(a.kategorie)})
      ON CONFLICT (slug) DO NOTHING`;
  }
  tabelleDa = true;
}

/** JSONB lesen, egal ob als Objekt oder (alt, doppelt verpackt) als Text gespeichert. */
export function jsonLesen<T>(v: unknown, ersatz: T): T {
  let x: unknown = v;
  for (let i = 0; i < 2 && typeof x === "string"; i++) { try { x = JSON.parse(x); } catch { return ersatz; } }
  return (x ?? ersatz) as T;
}

const datumText = (v: unknown): string | null => {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
};

export function zeile(r: any): Artikel {
  const recherche = jsonLesen<any>(r.recherche, null);
  return {
    id: Number(r.id), slug: r.slug, titel: r.titel, untertitel: r.untertitel ?? null, teaser: r.teaser || "", inhalt: r.inhalt || "",
    kategorie: r.kategorie, land: r.land, keyword: r.keyword || "", schlagworte: jsonLesen<string[]>(r.schlagworte, []) || [], faq: jsonLesen<any[]>(r.faq, []) || [],
    metaTitel: r.meta_titel || "", metaBeschreibung: r.meta_beschreibung || "", lesezeit: Number(r.lesezeit || 6),
    status: r.status, quelle: r.quelle, modell: r.modell ?? null, pruefung: r.pruefung ? jsonLesen<Pruefung | null>(r.pruefung, null) : null,
    erstelltAm: r.created_at, aktualisiertAm: r.updated_at, veroeffentlichtAm: r.published_at ?? null,
    bereich: (r.bereich === "business" ? "business" : r.bereich === "privat" ? "privat" : bereichVonKategorie(r.kategorie)),
    tagesartikel: datumText(r.tagesartikel),
    quellen: Array.isArray(recherche?.quellen) ? recherche.quellen : [],
    anlass: r.anlass ?? recherche?.anlass ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TAG UND BEREICH — reine Rechnungen
// ═══════════════════════════════════════════════════════════════════════════
/** Die Berliner Stunde — formatToParts, nie Number(format()) (Hausfalle 02.09.2026: „08 Uhr" → NaN). */
export function berlinStunde(jetzt: Date): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" }).formatToParts(jetzt);
  return Number(teile.find((t) => t.type === "hour")?.value ?? "0");
}

/**
 * Ein Berliner Kalendertag plus n Tage — gerechnet auf dem DATUM, nicht auf der Uhr. (berlinPlusTage rechnet von der
 * Serverzeit aus; auf Render (UTC) liegt zwischen 00:00 und 02:00 Berlin dort noch der Vortag — „gestern" wäre vorgestern.) Rein.
 */
export function tagPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Welcher Tag ist dran? Ab 06:00 Berlin ist es HEUTE, und der Artikel ist fällig. Davor wird nichts geschrieben —
 * aber der Lauf prüft den VORTAG: Fehlte gestern ein Artikel, darf die Nacht nicht als „erfolg" in der Historie
 * stehen (sonst bliebe die Ampel grün, obwohl der Tag ausfiel — der stille Ausfall vom August).
 */
export function faelligerTag(jetzt: Date): { tag: string; faellig: boolean; vortag: string } {
  const tag = berlinToday(jetzt);
  const stunde = berlinStunde(jetzt);
  return { tag, faellig: Number.isFinite(stunde) && stunde >= AB_STUNDE, vortag: tagPlus(tag, -1) };
}

/** Wann läuft die Redaktion als Nächstes los? Für die Kopfzeile der Redaktion. Rein. */
export function naechsterLauf(jetzt: Date, letzterBeginn: Date | null, beideFertig: boolean, taktMs = 30 * 60_000): Date {
  const { tag, faellig } = faelligerTag(jetzt);
  const sechsUhr = (datum: string) => {
    // 06:00 Berlin als Zeitpunkt — über die Mittagsrechnung, damit die Sommerzeit nicht einen Tag kostet.
    for (const utc of [4, 5]) {
      const d = new Date(`${datum}T0${utc}:00:00Z`);
      if (berlinStunde(d) === AB_STUNDE && berlinToday(d) === datum) return d;
    }
    return new Date(`${datum}T05:00:00Z`);
  };
  if (beideFertig) return sechsUhr(tagPlus(tag, 1));
  if (!faellig) return sechsUhr(tag);
  if (!letzterBeginn) return jetzt;
  const n = new Date(letzterBeginn.getTime() + taktMs);
  return n.getTime() < jetzt.getTime() ? jetzt : n;
}

// ── Doppelte Themen ──────────────────────────────────────────────────────
const STOPPWORTE = new Set(("der die das den dem des ein eine einen einem einer und oder aber mit ohne fuer von vom zu zum zur im in an auf aus bei "
  + "nach vor ueber unter was wie wann warum wer welche welcher welches sie ihr ihre ihren ihrem ihres ist sind wird werden hat haben "
  + "sich nicht kein keine jetzt neu neue neuen neues so als auch nur noch schon mehr am bis es man kann koennen muss muessen darf "
  + "heute 2025 2026 2027 alles alle was-sie the and for").split(/\s+/));

/** Die tragenden Wörter eines Titels oder Keywords — klein, ohne Umlaute, ohne Füllwörter. Rein. */
export function themenWoerter(s: string): string[] {
  const t = String(s || "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  return Array.from(new Set(t.split(/[^a-z0-9§]+/).filter((w) => w.length >= 3 && !STOPPWORTE.has(w))));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  const schnitt = a.filter((w) => B.has(w)).length;
  return schnitt / (a.length + b.length - schnitt);
}

export interface VorhandenesThema { titel: string; keyword: string; slug: string; themaSlug?: string | null; bereich?: string }

/**
 * Gibt es dieses Thema schon? null = neu, sonst der Grund. Drei Wände: dieselbe Adresse, dasselbe Keyword
 * (gleiche tragende Wörter), ein Titel, der zu mehr als der Hälfte aus denselben Wörtern besteht. Rein.
 */
export function themaDoppelt(k: { titel: string; keyword: string }, vorhandene: VorhandenesThema[]): string | null {
  const slug = slugify(k.titel);
  const kw = themenWoerter(k.keyword).sort().join(" ");
  const tw = themenWoerter(k.titel);
  for (const v of vorhandene) {
    if (slug && (v.slug === slug || v.themaSlug === slug)) return `gleiche Adresse wie „${v.titel}“`;
    const vkw = themenWoerter(v.keyword).sort().join(" ");
    if (kw && vkw && kw === vkw) return `gleiches Keyword wie „${v.titel}“ (${v.keyword})`;
    const j = jaccard(tw, themenWoerter(v.titel));
    if (j >= 0.5) return `fast derselbe Titel wie „${v.titel}“`;
  }
  return null;
}

// ── Links und Quellen ────────────────────────────────────────────────────
/** Die Seiten, auf die ein Privat-Artikel zeigen darf — Titel und Text aus der EINEN SEO-Tabelle. */
const PRIVAT_PFADE = [
  "/privatkunden", "/antrag", "/bonitaetsauskunft", "/bonitaetsauskunft/schufa", "/bonitaetsauskunft/oesterreich", "/bonitaetsauskunft/schweiz",
  "/bonitaetsauskunft-beantragen", "/partnerbank-dkb", "/kreditkarte", "/girokonto-trotz-negativer-bonitaet", "/schufa-eintrag-loeschen",
  "/schufa-score-verstehen", "/inkasso-brief-erhalten", "/eintrag-verjaehrung", "/kredit-ohne-schufa", "/auskunfteien", "/oesterreich",
  "/schweiz", "/ratenzahlung-und-bonitaet", "/schufa-neutral-anfragen", "/glossar-bonitaet", "/werkzeuge", "/werkzeuge/selbstauskunft",
  "/werkzeuge/eintrag-pruefen", "/werkzeuge/loeschfrist", "/werkzeuge/verjaehrung", "/werkzeuge/inkassokosten", "/werkzeuge/widerspruch",
  "/werkzeuge/mahnbescheid", "/werkzeuge/ratenplan", "/werkzeuge/inkasso-antwort", "/werkzeuge/basiskonto", "/werkzeuge/pfaendungsrechner",
  "/werkzeuge/schulden-check", "/werkzeuge/kreditrechner", "/werkzeuge/dispo-rechner", "/werkzeuge/schuldenplan", "/werkzeuge/karten-check",
];

export interface LinkZiel { pfad: string; titel: string; text: string }

/** Die erlaubten internen Ziele je Bereich. Business bleibt in der Business-Welt (lib/bereich.ts: nie auf die Privat-Seite). */
export function linkZiele(b: Bereich): LinkZiel[] {
  if (b === "business") {
    return GLOBAL_SEITEN
      .filter((s) => s.pfad.startsWith("/business") && !/\/(auftrag|angebot|widerrufsbelehrung|mustervertrag)(\/|$)/.test(s.pfad))
      .map((s) => ({ pfad: s.pfad, titel: `${s.h1}${s.h1b ? ` ${s.h1b}` : ""}`, text: s.seo.beschreibung }))
      .concat([{ pfad: "/business", titel: "FIAON Global — Pakete und Erstgespräch", text: "Die Startseite von FIAON Global: vier Pakete mit Festpreis, „Erst sprechen“ (/business#gespraech), „Pakete“ (/business#pakete)." },
        { pfad: "/business/start", titel: "Direkt beauftragen", text: "Den Auftrag in vier Schritten erteilen." }]);
  }
  return PRIVAT_PFADE.map((p) => SEO_SEITEN[p]).filter(Boolean).map((s) => ({ pfad: s.pfad, titel: s.h1, text: s.beschreibung }));
}

/** Verfolgungs-Anhängsel, die in keine Quellenangabe gehören (Echtlauf 15.10.2026: „?trk=public_post_comment-text“). */
const VERFOLGUNG = /^(utm_\w+|trk|trkinfo|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|srsltid|igshid|ref_src|ref)$/i;

/** Eine Adresse säubern: ohne Anker und ohne Verfolgungs-Anhängsel. Unlesbares → "". Rein. */
export function urlSauber(u: string): string {
  try {
    const x = new URL(String(u).trim());
    if (!/^https?:$/.test(x.protocol)) return "";
    x.hash = "";
    for (const k of Array.from(x.searchParams.keys())) if (VERFOLGUNG.test(k)) x.searchParams.delete(k);
    return x.toString();
  } catch { return ""; }
}

/** Eine Adresse vergleichbar machen: gesäubert, ohne Schrägstrich am Ende, Host klein, ohne www. Rein. */
export function urlNorm(u: string): string {
  const s = urlSauber(u);
  if (!s) return "";
  const x = new URL(s);
  return `${x.protocol}//${x.host.toLowerCase().replace(/^www\./, "")}${x.pathname.replace(/\/+$/, "")}${x.search}`;
}

/** Kürzen an einer Wortgrenze, mit „…" — für Teaser und Meta-Felder. Rein. */
export function kuerzen(text: string, max: number): string {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const schnitt = t.slice(0, max - 1);
  const i = schnitt.lastIndexOf(" ");
  return `${(i > max * 0.6 ? schnitt.slice(0, i) : schnitt).replace(/[\s,;:–-]+$/, "")}…`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KI-SCHNITTSTELLE — austauschbar für den Prüfstand
// ═══════════════════════════════════════════════════════════════════════════
export interface Fakt { aussage: string; quelle: string; url: string; datum: string }

export interface Recherche {
  titel: string; keyword: string; kategorie: Kategorie; land: Land;
  anlass: string; fokus: string; suchintention: string; fiaonBezug: string;
  fakten: Fakt[];
  /** Alle Adressen, die die Suche wirklich gesehen hat (Belege + Quellen der Websuche), dazu die der Fakten, die darunter sind. */
  quellen: Quelle[];
  gefundenAm: string;
}

export interface ArtikelDaten {
  titel: string; untertitel: string; teaser: string; inhalt: string;
  faq: { frage: string; antwort: string }[];
  metaTitel: string; metaBeschreibung: string; schlagworte: string[];
  quellen: Quelle[];
}

export interface ThemaAuftrag { bereich: Bereich; heute: string; vorhandene: VorhandenesThema[]; offenePlanthemen: string[]; ausschliessen: string[] }
export interface SchreibAuftrag { bereich: Bereich; heute: string; recherche: Recherche; links: LinkZiel[]; vorlage?: ArtikelDaten | null; fehler?: string[] }

export interface RedaktionKi {
  themaFinden(a: ThemaAuftrag): Promise<{ recherche: Recherche; modell: string }>;
  artikelSchreiben(a: SchreibAuftrag): Promise<{ daten: ArtikelDaten; modell: string }>;
}

// ── Der Weg zur KI: /v1/responses über openaiFetch ──────────────────────────
interface KiAntwort<T> { daten: T; quellen: string[]; modell: string }

/** Denkt das Modell (Reasoning)? Nur dann geht „reasoning" mit — gpt-4.1 lehnt es ab. */
const denkt = (m: string) => /^(gpt-5|o\d)/i.test(m);

async function kiAntwort<T>(ein: {
  zweck: string; anweisung: string; eingabe: string; schema: Record<string, unknown>;
  webSuche?: boolean; aufwand?: "low" | "medium" | "high"; maxTokens: number; ausfuehrlich?: boolean;
}): Promise<KiAntwort<T>> {
  const modell = MODELL();
  const start = Date.now();
  // Drei Fassungen der Websuche, von der reichsten zur einfachsten — ältere Modellstände kennen nicht jedes Feld.
  const werkzeuge: (any[] | null)[] = ein.webSuche
    ? [[{ type: "web_search", search_context_size: "medium", user_location: { type: "approximate", country: "DE", timezone: "Europe/Berlin" } }], [{ type: "web_search" }], [{ type: "web_search_preview" }]]
    : [null];
  let letzterFehler = "";
  try {
    for (let i = 0; i < werkzeuge.length; i++) {
      const body: any = {
        model: modell,
        instructions: ein.anweisung,
        input: ein.eingabe,
        max_output_tokens: ein.maxTokens,
        text: { format: { type: "json_schema", name: ein.zweck, strict: true, schema: ein.schema }, ...(ein.ausfuehrlich && /^gpt-5/i.test(modell) ? { verbosity: "high" } : {}) },
      };
      if (denkt(modell)) body.reasoning = { effort: ein.aufwand ?? "medium" };
      if (werkzeuge[i]) {
        body.tools = werkzeuge[i];
        body.tool_choice = "auto";
        if (i === 0) body.include = ["web_search_call.action.sources"];
      }
      const abbruch = new AbortController();
      const uhr = setTimeout(() => abbruch.abort(), 6 * 60_000);
      let res: Response; let roh: any;
      try {
        res = await openaiFetch("ratgeber", "/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${kiSchluessel()}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abbruch.signal,
        });
        roh = await res.json().catch(() => null);
      } finally { clearTimeout(uhr); }
      if (!res.ok) {
        letzterFehler = `HTTP ${res.status}: ${JSON.stringify(roh?.error ?? roh ?? "").slice(0, 240)}`;
        // Nur ein abgelehntes Feld der Websuche ist ein Grund für die nächste, einfachere Fassung.
        if (res.status === 400 && i < werkzeuge.length - 1 && /web_search|user_location|search_context|include|tool/i.test(letzterFehler)) continue;
        throw new Error(`KI antwortet nicht (${letzterFehler})`);
      }
      if (roh?.status === "incomplete") throw new Error(`KI-Antwort unvollständig (${roh?.incomplete_details?.reason ?? "unbekannt"}) — Budget max_output_tokens ${ein.maxTokens}`);
      const quellen = new Set<string>();
      let text = "";
      for (const t of Array.isArray(roh?.output) ? roh.output : []) {
        if (t?.type === "web_search_call") {
          for (const q of Array.isArray(t?.action?.sources) ? t.action.sources : []) if (q?.url) quellen.add(String(q.url));
        }
        if (t?.type !== "message" || !Array.isArray(t.content)) continue;
        let teil = "";
        for (const c of t.content) {
          if (c?.type === "output_text" && typeof c.text === "string") teil += c.text;
          for (const a of Array.isArray(c?.annotations) ? c.annotations : []) if (a?.type === "url_citation" && a.url) quellen.add(String(a.url));
        }
        if (teil.trim()) text = teil;
      }
      if (!text) text = String(roh?.output_text ?? "");
      let daten: T;
      try { daten = JSON.parse(text) as T; } catch { throw new Error("Die KI-Antwort war kein gültiges JSON."); }
      const u = roh?.usage ?? {};
      await nutzungMerken({
        dienst: "ratgeber", modell, dauerMs: Date.now() - start, ok: true,
        usage: { ...u, prompt_tokens: u.input_tokens, completion_tokens: u.output_tokens, completion_tokens_details: { reasoning_tokens: u.output_tokens_details?.reasoning_tokens } },
      });
      return { daten, quellen: Array.from(quellen), modell };
    }
    throw new Error(`KI antwortet nicht (${letzterFehler || "keine Fassung der Websuche angenommen"})`);
  } catch (e: any) {
    if (!istKiPause(e)) await nutzungMerken({ dienst: "ratgeber", modell, dauerMs: Date.now() - start, ok: false, fehler: String(e?.message || e).slice(0, 200) });
    if (e?.name === "AbortError") throw new Error("Die KI hat zu lange gebraucht (über sechs Minuten).");
    throw e;
  }
}

// ── Die Anweisungen ──────────────────────────────────────────────────────
const WOCHENTAG = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" });

const FELDER: Record<Bereich, string> = {
  privat: "SCHUFA, KSV1870, CRIF und Score; Einträge, Löschfristen und Datenschutzrechte gegenüber Auskunfteien; Inkasso, Mahnung und "
    + "Mahnbescheid; Kontopfändung und P-Konto; Girokonto und Basiskonto; Kreditkarte, Dispo, Ratenkauf/„Buy now, pay later“ und Konsumkredit; "
    + "Verbraucherinsolvenz und Restschuldbefreiung; Bonität beim Mieten, Mobilfunk, Strom.",
  business: "Firmenbonität (Creditreform, CRIF, Bonitätsindex, Zahlungserfahrungen); Gründung und Rechtsform (GmbH, UG, LLC); Finanzierung "
    + "und Kapitalzugang (Bankkredit, Kreditvergabe der Banken, Förderkredite, Firmenkarten, Kreditrahmen); Zahlungsausfälle, Zahlungsmoral "
    + "und Insolvenztrends; Geschäftskonto und Kontokündigung; internationale Strukturen und Expansion in die USA (US-Gesellschaft, Tochter, "
    + "EIN, US-Konto, US-Meldepflichten).",
};

const AKTUELL: Record<Bereich, string> = {
  privat: "eine neue Regel oder Frist (z. B. die EU-Verbraucherkreditrichtlinie (EU) 2023/2225, die ab 20. November 2026 gilt), ein neues "
    + "Urteil (BGH, EuGH, OGH, Schweizer Bundesgericht), eine Entscheidung oder Warnung der BaFin, FMA, FINMA oder einer Datenschutzbehörde, "
    + "neue Zahlen (SchuldnerAtlas, Destatis, Statistik Austria, KSV1870), eine Änderung bei SCHUFA, KSV1870 oder CRIF, eine saisonale Lage "
    + "(Jahresende, Nebenkostenabrechnung, Weihnachtseinkäufe auf Raten).",
  business: "neue Insolvenzzahlen (Destatis, Creditreform, KSV1870, Creditreform Schweiz), Zinsentscheidungen der EZB und ihre Wirkung auf "
    + "Firmenkredite, Umfragen zur Kreditvergabe (Bank Lending Survey, ifo-Kredithürde, KfW), neue Gesetze und Fristen (Offenlegung, "
    + "E-Rechnung, Zahlungsverzug, US-Meldepflichten), Urteile des BGH oder EuGH zu Haftung und Zahlungsverkehr, Kontokündigungen durch Banken, "
    + "Zölle und Handelsfragen mit den USA.",
};

function angebotText(b: Bereich): string {
  if (b === "business") {
    const pakete = GLOBAL_PAKETE.map((p) => `- ${p.de.name} (${globalPreisText(p.key, "de")} Festpreis): ${p.de.fuer} Enthalten u. a.: ${p.de.leistungen.slice(0, 3).join("; ")}.`).join("\n");
    return `DAS ANGEBOT VON FIAON GLOBAL (für den Abschnitt „So übernimmt FIAON Global …“ — nur das, nichts dazu erfinden):
${pakete}
Alle Pakete stehen auf /business#pakete, das Erstgespräch auf /business#gespraech. Leistungsseiten: /business/us-firmengruendung,
/business/ein-itin, /business/us-geschaeftskonto, /business/firmenkarten-kapital, /business/us-pflichten, /business/kosten.
Nenne KEINEN Kapitalrahmen als Zahl, keine Zinsen, keine Dauer als Zusage.`;
  }
  return `DAS ANGEBOT VON FIAON (für den Abschnitt „Was FIAON dabei übernimmt“ — nur das, nichts dazu erfinden):
- Die Pakete für Privatkunden (/privatkunden): FIAON erklärt jeden Eintrag Ihrer selbst angeforderten, kostenlosen Datenkopie (SCHUFA, KSV1870, CRIF),
  bereitet die Schreiben vor und versendet sie (Löschantrag, Widerspruch, Ratenangebot), verfolgt Fristen und Antworten im Kundenbereich.
- Die FIAON-Bonitätsauswertung (/bonitaetsauskunft): Ihre Bonität aus Sicht einer Bank — aus Ausweis und Kontoauszügen: Haushaltsrechnung,
  Ampel, Handlungsplan. Für neue Paketkunden im Paket enthalten.
- Danach der Link unserer Partnerbank (DKB, /partnerbank-dkb) für Girokonto und Visa-Kreditkarte — über Konto, Karte und Rahmen entscheidet die Bank.
- Der Antrag (/antrag) dauert rund fünf Minuten.
FIAON beschafft keine Auskünfte für Privatkunden, vergibt und vermittelt keine Kredite und verspricht keine Löschung.`;
}

const SPERRWORTE = `GESPERRTE FORMULIERUNGEN (eine Prüfung lehnt den Text sonst ab): Beratung/beraten (auch in Zusammensetzungen wie „Steuerberatung“,
„Rechtsberatung“ — erlaubt sind nur „Schuldnerberatung“ für die staatlich anerkannten Stellen sowie „Steuerberater“ und „Anwalt“),
Empfehlung/empfehlen, Garantie/garantiert, „sicher zu“, „auf jeden Fall“, „Score verbessern“, „Ihre Bonität verbessern“, Kreditvermittlung,
„Affiliate“, Zusagen von Geld, Karte oder Rahmen („der Kredit ist sofort verfügbar“, „Sie bekommen die Karte“, „Ihr Limit steht“),
dass jemand eine Karte oder PIN verschickt, die Wendung „innerhalb/binnen von <Ziffer> Tagen/Wochen/Monaten“ (schreibe „14 Tage ab Zustellung“ oder „zwei Wochen“),
Superlative und Werbewörter („Gamechanger“, „die beste“, „Nummer 1“, „einzigartig“, „revolutionär“, „Marktführer“), die Du-Form.
ZAHLEN IN ZIFFERN: Jahreszahlen (2026), Daten (20. November 2026), Beträge (200 Euro), Prozentwerte, Paragraphen (§ 506 BGB) und
gesetzliche Fristen („50 Tage“, „drei Jahre“ oder „3 Jahre“) stehen wie in der Quelle. Nie eine Jahreszahl ausschreiben („zweitausendsechsundzwanzig“).`;

const RECHERCHE_SCHEMA = (b: Bereich) => ({
  type: "object", additionalProperties: false,
  properties: {
    titel: { type: "string", description: "Arbeitstitel des Artikels, konkret, mit dem Haupt-Keyword, höchstens 110 Zeichen" },
    keyword: { type: "string", description: "Das Haupt-Suchwort als natürliche deutsche Wortgruppe (klein geschrieben, 2–5 Wörter), die genau so in einem Satz stehen kann — z. B. „bonitätsprüfung beim ratenkauf“, „kredit ohne schufa“; keine Reihung von Substantiven wie „ratenkauf bonitätsprüfung 2026“" },
    kategorie: { type: "string", enum: kategorienFuer(b) },
    land: { type: "string", enum: ["DE", "AT", "CH", "DACH"] },
    anlass: { type: "string", description: "Warum gerade jetzt — 1–2 Sätze mit Datum" },
    fokus: { type: "string", description: "Was der Artikel klären muss — 2–4 Sätze" },
    suchintention: { type: "string", description: "Welche Frage der Leser in die Suche tippt" },
    fiaonBezug: { type: "string", description: "Welches Angebot von FIAON ehrlich passt und warum — 1–2 Sätze" },
    fakten: {
      type: "array", minItems: 6, maxItems: 14,
      items: {
        type: "object", additionalProperties: false,
        properties: {
          aussage: { type: "string", description: "Ein belegter Fakt (Zahl, Datum, Norm, Urteil) in einem Satz" },
          quelle: { type: "string", description: "Herausgeber und Titel der Quelle" },
          url: { type: "string", description: "Die Adresse genau so, wie die Suche sie gefunden hat" },
          datum: { type: "string", description: "Datum oder Jahr der Quelle" },
        },
        required: ["aussage", "quelle", "url", "datum"],
      },
    },
  },
  required: ["titel", "keyword", "kategorie", "land", "anlass", "fokus", "suchintention", "fiaonBezug", "fakten"],
});

const ARTIKEL_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    titel: { type: "string", description: "Titel, höchstens 110 Zeichen, mit dem Haupt-Keyword" },
    untertitel: { type: "string", description: "Ein bis zwei Sätze unter dem Titel" },
    teaser: { type: "string", description: "Höchstens 160 Zeichen" },
    inhalt: { type: "string", description: "Der Artikel in Markdown (## und ### Überschriften, Listen, ggf. eine Tabelle), 1.500–2.000 Wörter, OHNE Quellenblock" },
    faq: { type: "array", minItems: 5, maxItems: 6, items: { type: "object", additionalProperties: false, properties: { frage: { type: "string" }, antwort: { type: "string" } }, required: ["frage", "antwort"] } },
    metaTitel: { type: "string", description: "Höchstens 60 Zeichen, enthält das Keyword" },
    metaBeschreibung: { type: "string", description: "Höchstens 155 Zeichen" },
    schlagworte: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } },
    quellen: {
      type: "array", minItems: 3, maxItems: 10,
      items: { type: "object", additionalProperties: false, properties: { titel: { type: "string", description: "Herausgeber: Titel (Jahr)" }, url: { type: "string" } }, required: ["titel", "url"] },
    },
  },
  required: ["titel", "untertitel", "teaser", "inhalt", "faq", "metaTitel", "metaBeschreibung", "schlagworte", "quellen"],
} as const;

/** Die echte KI. */
export const OPENAI_REDAKTION: RedaktionKi = {
  async themaFinden(a) {
    const b = a.bereich;
    const liste = a.vorhandene.slice(0, 160).map((v) => `- ${v.titel} [${v.keyword}]`).join("\n");
    // Die festen Seiten des Bereichs (Wissen von FIAON Global, Pfeilerseiten privat) — dort steht das Grundwissen schon.
    const feste = linkZiele(b).map((l) => `- ${l.titel} (${l.pfad})`).join("\n");
    const anweisung = `Du bist die Themenredaktion von FIAON (fiaon.com) für ${b === "business" ? "Unternehmer, Gründer und Geschäftsführer (FIAON Global, /business)" : "Privatpersonen mit Bonitätssorgen (/ratgeber)"} in Deutschland, Österreich und der Schweiz.
Heute ist ${WOCHENTAG(a.heute)}. Suche mit der Websuche, was GERADE JETZT aktuell ist, wähle daraus das EINE Thema für den heutigen Artikel und recherchiere die Fakten dafür.

Unsere Felder: ${FELDER[b]}
Aktuell heißt: ${AKTUELL[b]} Bevorzugt ist, was in den letzten vier Wochen veröffentlicht wurde oder in den nächsten Monaten wirksam wird — immer mit Datum.

REGELN
- Nur Fakten, die du in DIESER Suche in einer Quelle gefunden hast; jede Zahl, jedes Datum, jedes Urteil mit Quelle, Adresse (url genau so, wie gefunden) und Datum.
  Bevorzugt amtliche und Primärquellen (gesetze-im-internet.de, eur-lex.europa.eu, bundesgerichtshof.de, curia.europa.eu, bafin.de, destatis.de,
  bundesbank.de, ecb.europa.eu, ris.bka.gv.at, admin.ch, fedlex.admin.ch, schufa.de, ksv.at, creditreform.de, verbraucherzentrale.de, irs.gov) vor Presse.
- Nichts erfinden. Was du nicht belegen kannst, lässt du weg. Keine Gerüchte, keine Entwürfe als geltendes Recht.
- Das Thema darf es bei uns NICHT schon geben — weder derselbe Titel noch dasselbe Keyword. Ein neuer, aktueller Blickwinkel auf ein bekanntes
  Feld ist erlaubt, wenn er wirklich Neues bringt (neue Regel, neues Urteil, neue Zahlen).
- Das Thema muss so gewählt sein, dass ${b === "business" ? "FIAON Global (US-Gesellschaft, EIN/ITIN, US-Konto, Firmenkarten und Kapitalaufbau, Pflichtenkalender)" : "FIAON (Einträge erklären, Schreiben, Fristen, Bonitätsauswertung, Konto und Karte über die Partnerbank)"} ehrlich als Lösung passt.
- Der Artikel muss Wochen später noch nützlich sein: kein Thema, dessen Anlass heute oder in den nächsten Tagen schon vorbei ist
  (eine Frist, die heute abläuft) — dann lieber die Regel dahinter oder die nächste Frist.
- Kategorie und Land passend wählen (DACH nur, wenn es wirklich alle drei Länder betrifft).

SCHON ERSCHIENEN (nicht wiederholen):
${liste || "- (noch nichts)"}

FESTE SEITEN MIT GRUNDWISSEN (nicht nacherzählen — ein Artikel braucht einen aktuellen Anlass, der über sie hinausgeht):
${feste}
${a.offenePlanthemen.length ? `\nTHEMENPLAN (noch offen — nur, wenn nichts Aktuelleres da ist):\n${a.offenePlanthemen.map((t) => `- ${t}`).join("\n")}` : ""}
${a.ausschliessen.length ? `\nABGELEHNT, weil schon vorhanden — wähle ein anderes Thema:\n${a.ausschliessen.map((t) => `- ${t}`).join("\n")}` : ""}

Liefere JSON nach Schema.`;
    const r = await kiAntwort<Omit<Recherche, "quellen" | "gefundenAm">>({
      zweck: "ratgeber_recherche", anweisung, eingabe: `Finde das Thema für ${WOCHENTAG(a.heute)} (${BEREICH_LABEL[b]}) und recherchiere es.`,
      schema: RECHERCHE_SCHEMA(b), webSuche: true, aufwand: "medium", maxTokens: 24_000,
    });
    return { recherche: rechercheBereinigen(r.daten, r.quellen, b), modell: r.modell };
  },

  async artikelSchreiben(a) {
    const b = a.bereich;
    const r = a.recherche;
    const fakten = r.fakten.map((f, i) => `${i + 1}. ${f.aussage} — ${f.quelle}, ${f.datum} — ${f.url}`).join("\n");
    const links = a.links.map((l) => `- ${l.pfad} — ${l.titel}: ${l.text.slice(0, 140)}`).join("\n");
    const anweisung = `${hausstilFuer(b)}

${angebotText(b)}

${SPERRWORTE}

QUELLEN UND ZAHLEN (Regel E-034): Jede Zahl, jedes Datum, jedes Urteil im Text stammt aus der FAKTENBASIS des Auftrags und nennt seine Quelle
im Satz („laut Destatis (Oktober 2026)“, „BGH, Urteil vom …, Az. …“). Bei Gesetzen nennst du die Norm selbst („§ 30 BDSG in der Fassung ab
20. November 2026“), nie die Website, auf der sie steht („laut Deutsche Rentenversicherung“). Allgemeine Rechtsgrundlagen aus dem Hausstil
darfst du zusätzlich nennen.
SPRACHE: Das Haupt-Keyword ist ein Suchbegriff, keine Formulierung. Seine Wörter kommen natürlich vor — richtig geschrieben und gebeugt
(„die Bonitätsprüfung beim Ratenkauf“), nie als starre Wortkette, weder klein („eine ratenkauf bonitätsprüfung“) noch groß („Die Ratenkauf
Bonitätsprüfung 2026 ist …“). Der Titel ist ein guter deutscher Satz, keine Keyword-Reihung. Keine Zeile zur Lesezeit, keine Überschrift „Einleitung“.
Erfinde keine Gesetze, Urteile, Aktenzeichen, Zahlen oder Studien. Den Abschnitt „## Quellen“ setzt das System aus dem Feld „quellen“ selbst
ans Ende — schreibe ihn nicht in „inhalt“. Im Feld „quellen“ stehen 3–8 Einträge, NUR mit Adressen aus der Faktenbasis (genau übernommen).
Autorin (nur für den Ton, nicht nennen): ${AUTORIN.name}, ${AUTORIN.rolle}.`;
    let eingabe = `HEUTE: ${WOCHENTAG(a.heute)} — schreibe für Leser, die heute suchen; nenne Daten konkret („ab 20. November 2026“), nie „bald“ ohne Datum.

THEMA: ${r.titel}
Haupt-Keyword: ${r.keyword}
Kategorie: ${KATEGORIEN[r.kategorie]?.label ?? r.kategorie} · Land: ${r.land === "DACH" ? "Deutschland, Österreich, Schweiz" : r.land === "AT" ? "Österreich" : r.land === "CH" ? "Schweiz" : "Deutschland"}
Warum jetzt: ${r.anlass}
Was der Artikel klären muss: ${r.fokus}
Wonach Leser suchen: ${r.suchintention}
Wie FIAON passt: ${r.fiaonBezug}

FAKTENBASIS (nur diese Zahlen, Daten, Urteile und Normen):
${fakten}

INTERNE LINKS — nur diese Seiten, als Markdown [Text](/pfad); im Abschnitt über ${b === "business" ? "FIAON Global" : "FIAON"} mindestens ein Link auf die passende Angebotsseite, im ganzen Text 2–5 Links:
${links}

Liefere JSON nach Schema. „inhalt“ ist Markdown und beginnt direkt mit dem ersten Absatz (keine H1, der Titel steht separat).`;
    if (a.vorlage && a.fehler?.length) {
      eingabe += `\n\nÜBERARBEITUNG: Dein voriger Entwurf ist am Prüfstand gescheitert. Behebe GENAU diese Punkte und behalte alles, was gut war:
${a.fehler.map((f) => `- ${f}`).join("\n")}

DER VORIGE ENTWURF (JSON):
${JSON.stringify(a.vorlage)}`;
    }
    const k = await kiAntwort<ArtikelDaten>({
      zweck: "ratgeber_artikel", anweisung, eingabe, schema: ARTIKEL_SCHEMA as any,
      aufwand: a.vorlage ? "low" : "medium", maxTokens: 32_000, ausfuehrlich: true,
    });
    return { daten: k.daten, modell: k.modell };
  },
};

/** Recherche säubern: Kategorie im Bereich, Fakten nur mit echter Adresse, Quellen = gesehene Adressen + Fakten-Adressen. Rein. */
export function rechercheBereinigen(d: any, gesehen: string[], b: Bereich): Recherche {
  const kat = (kategorienFuer(b) as string[]).includes(String(d?.kategorie)) ? (d.kategorie as Kategorie) : kategorienFuer(b)[0];
  const land = (["DE", "AT", "CH", "DACH"] as const).includes(d?.land) ? (d.land as Land) : "DE";
  const gesehenNorm = new Set(gesehen.map(urlNorm).filter(Boolean));
  let fakten: Fakt[] = (Array.isArray(d?.fakten) ? d.fakten : [])
    .map((f: any) => ({ aussage: String(f?.aussage || "").trim(), quelle: String(f?.quelle || "").trim(), url: urlSauber(String(f?.url || "")), datum: String(f?.datum || "").trim() }))
    .filter((f: Fakt) => f.aussage && /^https?:\/\//i.test(f.url) && urlNorm(f.url));
  // Hat die Suche ihre Quellen genannt, zählen nur Fakten, deren Adresse sie wirklich gesehen hat (Host + Pfad).
  // Ohne Liste (z. B. Claude-Weiche ohne Belege) bleibt es bei den Fakten der Antwort.
  if (gesehenNorm.size) {
    const hosts = new Set(Array.from(gesehenNorm).map((u) => u.split("/")[2]));
    fakten = fakten.filter((f) => gesehenNorm.has(urlNorm(f.url)) || hosts.has(urlNorm(f.url).split("/")[2]));
  }
  const quellen: Quelle[] = [];
  const schon = new Set<string>();
  for (const f of fakten) { const n = urlNorm(f.url); if (!schon.has(n)) { schon.add(n); quellen.push({ titel: f.quelle || n, url: f.url }); } }
  for (const u of gesehen) { const n = urlNorm(u); if (n && !schon.has(n)) { schon.add(n); quellen.push({ titel: n.split("/")[2] ?? n, url: urlSauber(u) }); } }
  return {
    titel: String(d?.titel || "").trim().slice(0, 140), keyword: String(d?.keyword || "").trim().toLowerCase().slice(0, 80),
    kategorie: kat, land, anlass: String(d?.anlass || "").trim(), fokus: String(d?.fokus || "").trim(),
    suchintention: String(d?.suchintention || "").trim(), fiaonBezug: String(d?.fiaonBezug || "").trim(),
    fakten, quellen: quellen.slice(0, 40), gefundenAm: new Date().toISOString(),
  };
}

/**
 * Den Entwurf der KI zum Artikel machen: H1 weg, eigener Quellenblock weg, der Quellenblock aus den Adressen der
 * Recherche dran (eine Adresse, die die Recherche nicht kennt, fällt heraus), Meta-Felder an Wortgrenzen gekürzt. Rein.
 */
export function artikelNachbereiten(d: ArtikelDaten, recherche: Recherche): ArtikelDaten {
  let inhalt = String(d?.inhalt || "").replace(/\r\n/g, "\n").trim();
  inhalt = inhalt.replace(/^# [^\n]*\n+/, "");
  // Eine Zeile „Geschätzte Lesezeit …“ am Anfang — die Seite zeigt die Lesezeit selbst.
  inhalt = inhalt.replace(/^(\*{0,2})(geschätzte\s+)?lesezeit\b[^\n]*\n+/i, "");
  const qi = inhalt.search(/^##\s+Quellen\b/im);
  if (qi >= 0) inhalt = inhalt.slice(0, qi).trim();
  const bekannt = new Map(recherche.quellen.concat(recherche.fakten.map((f) => ({ titel: f.quelle, url: f.url }))).map((q) => [urlNorm(q.url), q]));
  const quellen: Quelle[] = [];
  const schon = new Set<string>();
  for (const q of Array.isArray(d?.quellen) ? d.quellen : []) {
    const n = urlNorm(String(q?.url || ""));
    if (!n || schon.has(n) || !bekannt.has(n)) continue;
    schon.add(n);
    quellen.push({ titel: String(q?.titel || bekannt.get(n)!.titel).replace(/[[\]]/g, "").trim(), url: urlSauber(bekannt.get(n)!.url) || bekannt.get(n)!.url });
  }
  if (quellen.length) inhalt += `\n\n## Quellen\n\n${quellen.map((q) => `- [${q.titel}](${q.url})`).join("\n")}`;
  return {
    titel: String(d?.titel || recherche.titel).trim(),
    untertitel: String(d?.untertitel || "").trim(),
    teaser: kuerzen(d?.teaser || "", 160),
    inhalt,
    faq: (Array.isArray(d?.faq) ? d.faq : []).map((f: any) => ({ frage: String(f?.frage || "").trim(), antwort: String(f?.antwort || "").trim() })).filter((f) => f.frage && f.antwort),
    metaTitel: kuerzen(d?.metaTitel || d?.titel || "", 60),
    metaBeschreibung: kuerzen(d?.metaBeschreibung || d?.teaser || "", 155),
    schlagworte: (Array.isArray(d?.schlagworte) ? d.schlagworte : []).map((s: any) => String(s).trim()).filter(Boolean).slice(0, 6),
    quellen,
  };
}

/** Der strenge Prüfstand eines Entwurfs — das Tor zur Veröffentlichung. */
export function torPruefen(d: ArtikelDaten, recherche: Recherche, b: Bereich, links: LinkZiel[]): Pruefung {
  return pruefstand(
    { titel: d.titel, teaser: d.teaser, inhalt: d.inhalt, faq: d.faq, metaTitel: d.metaTitel, metaBeschreibung: d.metaBeschreibung, keyword: recherche.keyword },
    { streng: true, bereich: b, erlaubteLinks: links.map((l) => l.pfad) },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESSTAND
// ═══════════════════════════════════════════════════════════════════════════
export interface StandBereich {
  erledigt: boolean;
  /** Der Artikel, der den Tag erfüllt — oder die Arbeitszeile des Tages. */
  artikel: { id: number; slug: string; titel: string; status: string; quelle: string; automatisch: boolean; versuche: number } | null;
}

/** Ist der Tag im Bereich erfüllt? Ja, wenn heute ein (deutscher) Artikel erschien — von Hand oder automatisch — oder der Tagesartikel zurückgezogen wurde. */
export async function tagesStand(tag: string, lauf: Lauf = sqlPool): Promise<Record<Bereich, StandBereich>> {
  const rows = (await lauf`
    SELECT id, slug, titel, status, quelle, bereich, tagesartikel, versuche, published_at
      FROM fiaon_ratgeber
     WHERE sprache = 'de'
       AND ((status = 'veroeffentlicht' AND (published_at AT TIME ZONE 'Europe/Berlin')::date = ${tag}::date)
            OR tagesartikel = ${tag}::date)
     ORDER BY (status = 'veroeffentlicht') DESC, published_at ASC NULLS LAST, id ASC`) as any[];
  const aus: Record<Bereich, StandBereich> = { privat: { erledigt: false, artikel: null }, business: { erledigt: false, artikel: null } };
  for (const b of BEREICHE) {
    const eigene = rows.filter((r) => (r.bereich === "business" ? "business" : "privat") === b);
    const fertig = eigene.find((r) => r.status === "veroeffentlicht") ?? eigene.find((r) => r.status === "archiv" && datumText(r.tagesartikel) === tag);
    const r = fertig ?? eigene.find((x) => datumText(x.tagesartikel) === tag) ?? null;
    aus[b] = {
      erledigt: !!fertig,
      artikel: r ? { id: Number(r.id), slug: r.slug, titel: r.titel, status: r.status, quelle: r.quelle, automatisch: datumText(r.tagesartikel) === tag, versuche: Number(r.versuche || 0) } : null,
    };
  }
  return aus;
}

async function vorhandeneThemen(lauf: Lauf): Promise<VorhandenesThema[]> {
  const rows = (await lauf`SELECT titel, keyword, slug, thema_slug, bereich FROM fiaon_ratgeber WHERE COALESCE(inhalt, '') <> '' ORDER BY COALESCE(published_at, created_at) DESC`) as any[];
  return rows.map((r) => ({ titel: r.titel, keyword: r.keyword || "", slug: r.slug, themaSlug: r.thema_slug, bereich: r.bereich }));
}

/** Freie Adresse aus einem Titel — „-2", „-3" …, wenn es sie schon gibt (die eigene Zeile zählt nicht). */
async function freieAdresse(titel: string, lauf: Lauf, eigeneId?: number): Promise<string> {
  const basis = slugify(titel).slice(0, 80).replace(/-+$/, "") || `ratgeber-${Date.now().toString(36)}`;
  const belegt = new Set(((await lauf`
    SELECT slug FROM fiaon_ratgeber WHERE (slug = ${basis} OR slug LIKE ${`${basis}-%`}) AND id <> ${eigeneId ?? -1}`) as any[]).map((r) => r.slug));
  for (let n = 1; n < 500; n++) {
    const kandidat = n === 1 ? basis : `${basis}-${n}`;
    if (!belegt.has(kandidat)) return kandidat;
  }
  return `${basis}-${Date.now().toString(36)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN ARTIKEL — recherchieren, schreiben, prüfen
// ═══════════════════════════════════════════════════════════════════════════
export interface BereichErgebnis {
  bereich: Bereich;
  ergebnis: "veroeffentlicht" | "entwurf" | "erledigt" | "parallel" | "deckel" | "fehler";
  id?: number; slug?: string; titel?: string;
  versuche: number;
  fehler: string[];
}

/** Recherche mit Wand gegen doppelte Themen: höchstens zwei Suchen, die zweite mit dem abgelehnten Titel. */
async function themaMitWand(b: Bereich, heute: string, ki: RedaktionKi, lauf: Lauf, zaehlen: () => Promise<void>): Promise<{ recherche: Recherche; modell: string }> {
  const vorhandene = await vorhandeneThemen(lauf);
  const eigene = vorhandene.filter((v) => (v.bereich === "business" ? "business" : "privat") === b);
  const benutzt = new Set(vorhandene.flatMap((v) => [v.slug, v.themaSlug].filter(Boolean) as string[]));
  const offenePlanthemen = b === "privat" ? THEMEN.filter((t) => !benutzt.has(t.slug)).map((t) => `${t.titel} [${t.keyword}]`) : [];
  const ausschliessen: string[] = [];
  for (let i = 0; i < 2; i++) {
    await zaehlen();
    const r = await ki.themaFinden({ bereich: b, heute, vorhandene: eigene, offenePlanthemen, ausschliessen });
    const doppelt = themaDoppelt(r.recherche, vorhandene);
    if (!r.recherche.titel || !r.recherche.keyword) { ausschliessen.push("(leerer Titel)"); continue; }
    if (r.recherche.fakten.length < 3) { ausschliessen.push(`${r.recherche.titel} — zu wenige belegte Fakten`); continue; }
    if (!doppelt) return r;
    ausschliessen.push(`${r.recherche.titel} [${r.recherche.keyword}] — ${doppelt}`);
  }
  throw new Error(`Kein neues Thema gefunden: ${ausschliessen.join(" | ").slice(0, 400)}`);
}

/**
 * Schreiben und prüfen, bis der strenge Prüfstand nichts mehr findet — höchstens `versuche` Mal. Schreibt jeden
 * Stand in die Zeile (die Redaktion sieht den letzten Entwurf und seine Prüfung). Gibt zurück, ob er durch ist.
 */
async function schreibenBisDurch(ein: {
  id: number; b: Bereich; heute: string; recherche: Recherche; ki: RedaktionKi; lauf: Lauf; versuche: number;
  vorlage: ArtikelDaten | null; fehler: string[]; zaehlen: () => Promise<boolean>;
}): Promise<{ durch: boolean; versuche: number; fehler: string[]; daten: ArtikelDaten | null }> {
  const links = linkZiele(ein.b);
  let vorlage = ein.vorlage;
  let fehler = ein.fehler;
  let n = 0;
  for (; n < ein.versuche; n++) {
    if (!(await ein.zaehlen())) break;
    const { daten: roh, modell } = await ein.ki.artikelSchreiben({ bereich: ein.b, heute: ein.heute, recherche: ein.recherche, links, vorlage: fehler.length ? vorlage : null, fehler });
    const d = artikelNachbereiten(roh, ein.recherche);
    const p = torPruefen(d, ein.recherche, ein.b, links);
    const slug = await freieAdresse(d.titel, ein.lauf, ein.id);
    await ein.lauf`
      UPDATE fiaon_ratgeber SET
        slug = ${slug}, titel = ${d.titel}, untertitel = ${d.untertitel}, teaser = ${d.teaser}, inhalt = ${d.inhalt},
        kategorie = ${ein.recherche.kategorie}, land = ${ein.recherche.land}, keyword = ${ein.recherche.keyword},
        schlagworte = ${JSON.stringify(d.schlagworte)}::text::jsonb, faq = ${JSON.stringify(d.faq)}::text::jsonb,
        meta_titel = ${d.metaTitel}, meta_beschreibung = ${d.metaBeschreibung}, lesezeit = ${lesezeitVon(d.inhalt)},
        modell = ${modell}, pruefung = ${JSON.stringify(p)}::text::jsonb,
        status = CASE WHEN status IN ('veroeffentlicht', 'archiv') THEN status WHEN ${p.ok} THEN 'geprueft' ELSE 'entwurf' END,
        updated_at = NOW()
      WHERE id = ${ein.id}`;
    vorlage = d;
    fehler = p.punkte.filter((x) => x.art === "fehler").map((x) => x.text);
    if (p.ok) return { durch: true, versuche: n + 1, fehler: [], daten: d };
  }
  return { durch: false, versuche: n, fehler, daten: vorlage };
}

/** Die Zeile als Recherche lesen (für den Wiederanlauf eines Entwurfs). */
function gespeicherteRecherche(r: any): Recherche | null {
  const x = jsonLesen<any>(r?.recherche, null);
  return x && Array.isArray(x.fakten) && x.titel ? (x as Recherche) : null;
}

function entwurfAusZeile(r: any): ArtikelDaten | null {
  if (!r?.inhalt) return null;
  const a = zeile(r);
  return { titel: a.titel, untertitel: a.untertitel || "", teaser: a.teaser, inhalt: a.inhalt, faq: a.faq, metaTitel: a.metaTitel, metaBeschreibung: a.metaBeschreibung, schlagworte: a.schlagworte, quellen: [] };
}

/**
 * Den Tagesartikel eines Bereichs fertig machen. Idempotent: Ist der Tag erfüllt, passiert nichts. Die Arbeitszeile
 * (bereich + tagesartikel, eindeutig) entsteht VOR der ersten KI-Anfrage — ein zweiter, gleichzeitiger Lauf bekommt
 * sie nicht und hört auf; jeder KI-Aufruf zählt an ihr (Tagesdeckel VERSUCHE_JE_TAG).
 */
export async function bereichAbarbeiten(b: Bereich, tag: string, ki: RedaktionKi = OPENAI_REDAKTION, lauf: Lauf = sqlPool): Promise<BereichErgebnis> {
  const stand = await tagesStand(tag, lauf);
  if (stand[b].erledigt) return { bereich: b, ergebnis: "erledigt", id: stand[b].artikel?.id, titel: stand[b].artikel?.titel, versuche: 0, fehler: [] };

  let [row] = (await lauf`SELECT * FROM fiaon_ratgeber WHERE bereich = ${b} AND tagesartikel = ${tag}::date LIMIT 1`) as any[];
  if (!row) {
    const platzhalter = `tagesartikel-${b}-${tag}`;
    [row] = (await lauf`
      INSERT INTO fiaon_ratgeber (slug, titel, kategorie, land, status, quelle, bereich, tagesartikel, sprache)
      VALUES (${platzhalter}, ${`Tagesartikel ${BEREICH_LABEL[b]} ${tag} — Recherche läuft`}, ${kategorienFuer(b)[0]}, 'DE', 'entwurf', 'ki', ${b}, ${tag}::date, 'de')
      ON CONFLICT DO NOTHING
      RETURNING *`) as any[];
    if (!row) return { bereich: b, ergebnis: "parallel", versuche: 0, fehler: ["Ein anderer Lauf hat den Tag schon begonnen."] };
  }
  const id = Number(row.id);
  let versuche = Number(row.versuche || 0);
  if (versuche >= VERSUCHE_JE_TAG) return { bereich: b, ergebnis: "deckel", id, versuche: 0, fehler: [`Tagesdeckel erreicht (${VERSUCHE_JE_TAG} KI-Aufrufe) — morgen geht es weiter.`] };

  let gezaehlt = 0;
  const zaehlen = async (): Promise<boolean> => {
    if (versuche >= VERSUCHE_JE_TAG) return false;
    versuche++; gezaehlt++;
    await lauf`UPDATE fiaon_ratgeber SET versuche = versuche + 1, updated_at = NOW() WHERE id = ${id}`;
    return true;
  };

  let recherche = gespeicherteRecherche(row);
  if (!recherche) {
    const r = await themaMitWand(b, tag, ki, lauf, async () => { await zaehlen(); });
    recherche = r.recherche;
    const slug = await freieAdresse(recherche.titel, lauf, id);
    await lauf`
      UPDATE fiaon_ratgeber SET slug = ${slug}, titel = ${recherche.titel}, kategorie = ${recherche.kategorie}, land = ${recherche.land},
             keyword = ${recherche.keyword}, anlass = ${recherche.anlass}, recherche = ${JSON.stringify(recherche)}::text::jsonb,
             modell = ${r.modell}, updated_at = NOW()
       WHERE id = ${id}`;
  }

  const alt = jsonLesen<Pruefung | null>(row.pruefung, null);
  const s = await schreibenBisDurch({
    id, b, heute: tag, recherche, ki, lauf, versuche: VERSUCHE_JE_LAUF,
    vorlage: entwurfAusZeile(row), fehler: alt && !alt.ok ? alt.punkte.filter((p) => p.art === "fehler").map((p) => p.text) : [],
    zaehlen,
  });
  if (!s.durch) return { bereich: b, ergebnis: "entwurf", id, titel: s.daten?.titel, versuche: gezaehlt, fehler: s.fehler };

  // Das Tor ist offen: veröffentlichen — nur, wenn der Tag nicht inzwischen anders erfüllt wurde (ein Mensch hat parallel veröffentlicht).
  const nachher = await tagesStand(tag, lauf);
  if (nachher[b].erledigt) return { bereich: b, ergebnis: "erledigt", id, versuche: gezaehlt, fehler: [] };
  const [pub] = (await lauf`
    UPDATE fiaon_ratgeber SET status = 'veroeffentlicht', quelle = 'ki', published_at = NOW(), updated_at = NOW()
     WHERE id = ${id} AND status NOT IN ('veroeffentlicht', 'archiv')
    RETURNING slug, titel`) as any[];
  return { bereich: b, ergebnis: pub ? "veroeffentlicht" : "erledigt", id, slug: pub?.slug, titel: pub?.titel, versuche: gezaehlt, fehler: [] };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAGESLAUF
// ═══════════════════════════════════════════════════════════════════════════
export interface TageslaufErgebnis {
  tag: string;
  faellig: boolean;
  /** Bereiche, deren Artikel für `tag` fehlt — nach diesem Lauf. */
  fehlt: Bereich[];
  veroeffentlicht: number;
  bereiche: BereichErgebnis[];
  grund: string | null;
}

/**
 * Ein Durchgang der Redaktion. Wirft NIE — der Rückgabewert sagt, was fehlt. Der Takt (server/routes.ts) macht daraus
 * einen Fehler in der Historie, sobald etwas fehlt (ratgeberLaufPruefen); Prüfstände und die Redaktion lesen ihn.
 */
export async function tagesartikelLauf(opt: { jetzt?: Date; ki?: RedaktionKi; lauf?: Lauf; nurBereich?: Bereich; sofort?: boolean } = {}): Promise<TageslaufErgebnis> {
  const jetzt = opt.jetzt ?? new Date();
  const lauf = opt.lauf ?? sqlPool;
  const ki = opt.ki ?? OPENAI_REDAKTION;
  await ensureRatgeberTabelle();
  const zeit = faelligerTag(jetzt);
  // „Tagesartikel jetzt" in der Redaktion: auch vor 06:00 — eine Entscheidung eines Menschen, kein Nebeneffekt des Takts.
  const { tag, vortag } = zeit;
  const faellig = zeit.faellig || !!opt.sofort;
  const bereiche = opt.nurBereich ? [opt.nurBereich] : BEREICHE;

  if (!faellig) {
    // Vor 06:00: nichts schreiben — aber ehrlich sagen, ob der Vortag erfüllt war.
    const st = await tagesStand(vortag, lauf);
    const fehlt = bereiche.filter((b) => !st[b].erledigt);
    return { tag: vortag, faellig: false, fehlt, veroeffentlicht: 0, bereiche: [], grund: fehlt.length ? "Vortag ohne Artikel" : "vor 06:00" };
  }

  const st = await tagesStand(tag, lauf);
  const offen = bereiche.filter((b) => !st[b].erledigt);
  if (!offen.length) return { tag, faellig: true, fehlt: [], veroeffentlicht: 0, bereiche: [], grund: "erledigt" };
  // Ohne KI (kein Schlüssel, Pause) kein Aufruf — aber auch kein „erfolg": Es fehlt etwas.
  if (!opt.ki && !kiLesenMoeglich()) return { tag, faellig: true, fehlt: offen, veroeffentlicht: 0, bereiche: [], grund: "kein KI-Schlüssel" };
  if (!opt.ki && (await kiPausiert())) return { tag, faellig: true, fehlt: offen, veroeffentlicht: 0, bereiche: [], grund: "KI pausiert" };

  const ergebnisse: BereichErgebnis[] = [];
  let grund: string | null = null;
  for (const b of offen) {
    try {
      ergebnisse.push(await bereichAbarbeiten(b, tag, ki, lauf));
    } catch (e: any) {
      const text = String(e?.message || e).slice(0, 400);
      ergebnisse.push({ bereich: b, ergebnis: "fehler", versuche: 0, fehler: [text] });
      console.error(`[RATGEBER] Tagesartikel ${b}:`, text);
      // E-246: KI pausiert — den anderen Bereich nicht auch noch scheitern lassen.
      if (istKiPause(e)) { grund = "KI pausiert"; break; }
    }
  }
  const nachher = await tagesStand(tag, lauf);
  const fehlt = bereiche.filter((b) => !nachher[b].erledigt);
  const veroeffentlicht = ergebnisse.filter((e) => e.ergebnis === "veroeffentlicht").length;
  if (!grund && fehlt.length) grund = ergebnisse.filter((e) => fehlt.includes(e.bereich)).map((e) => `${BEREICH_LABEL[e.bereich]}: ${e.ergebnis}${e.fehler.length ? ` (${e.fehler.slice(0, 3).join("; ")})` : ""}`).join(" · ").slice(0, 600) || "unbekannt";
  for (const e of ergebnisse) console.log(`[RATGEBER] Tagesartikel ${e.bereich}: ${e.ergebnis}${e.titel ? ` — ${e.titel}` : ""} (${e.versuche} KI-Aufrufe)`);
  return { tag, faellig: true, fehlt, veroeffentlicht, bereiche: ergebnisse, grund };
}

/** Für den Takt: Fehlt nach dem Lauf ein Artikel, ist der Lauf KEIN Erfolg (Historie „fehler", Ampel, Warnmail). */
export function ratgeberLaufPruefen(e: TageslaufErgebnis): { tag: string; veroeffentlicht: number; privat: number; business: number; grund: string | null } {
  if (e.fehlt.length) {
    throw new Error(`Tagesartikel fehlt für ${e.tag}: ${e.fehlt.map((b) => BEREICH_LABEL[b]).join(" und ")} — ${e.grund ?? "unbekannt"}`);
  }
  return { tag: e.tag, veroeffentlicht: e.veroeffentlicht, privat: e.fehlt.includes("privat") ? 0 : 1, business: e.fehlt.includes("business") ? 0 : 1, grund: e.grund };
}

// ═══════════════════════════════════════════════════════════════════════════
// EIN ENTWURF VON HAND (Redaktion: „Entwurf erzeugen") — ohne Tagesbindung, ohne Veröffentlichung
// ═══════════════════════════════════════════════════════════════════════════
export async function entwurfErzeugen(b: Bereich, ki: RedaktionKi = OPENAI_REDAKTION, lauf: Lauf = sqlPool, jetzt = new Date()): Promise<Artikel> {
  await ensureRatgeberTabelle();
  const heute = berlinToday(jetzt);
  // Erst recherchieren, dann die Zeile anlegen — ein gescheiterter Versuch hinterlässt keine leere Zeile (und nichts zu löschen).
  let aufrufe = 0;
  const r = await themaMitWand(b, heute, ki, lauf, async () => { aufrufe++; });
  const slug = await freieAdresse(r.recherche.titel, lauf);
  const [row] = (await lauf`
    INSERT INTO fiaon_ratgeber (slug, titel, kategorie, land, keyword, status, quelle, modell, bereich, sprache, anlass, recherche, versuche)
    VALUES (${slug}, ${r.recherche.titel}, ${r.recherche.kategorie}, ${r.recherche.land}, ${r.recherche.keyword}, 'entwurf', 'ki', ${r.modell}, ${b}, 'de',
            ${r.recherche.anlass}, ${JSON.stringify(r.recherche)}::text::jsonb, ${aufrufe})
    RETURNING *`) as any[];
  const id = Number(row.id);
  let versuche = aufrufe;
  const zaehlen = async () => {
    if (versuche >= VERSUCHE_JE_TAG) return false;
    versuche++;
    await lauf`UPDATE fiaon_ratgeber SET versuche = versuche + 1 WHERE id = ${id}`;
    return true;
  };
  await schreibenBisDurch({ id, b, heute, recherche: r.recherche, ki, lauf, versuche: VERSUCHE_JE_LAUF, vorlage: null, fehler: [], zaehlen });
  const [fertig] = (await lauf`SELECT * FROM fiaon_ratgeber WHERE id = ${id}`) as any[];
  return zeile(fertig);
}
