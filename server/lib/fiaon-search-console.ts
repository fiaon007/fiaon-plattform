// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE SEARCH CONSOLE IM CHEFBÜRO (28.10.2026, E-454)
//
// Justin: „Ja Zugang — die Google-Zahlen landen automatisch im Chefbüro."
//
// Bis heute las jemand die Search Console von Hand im Browser ab. Jetzt holt ein
// Tageslauf früh am Morgen (Berlin) alles, was Justin dort ansieht, und legt es
// in der Datenbank ab (db/migrations/126). Das Chefbüro (Besucher › Google)
// liest NUR von dort — nie direkt bei Google.
//
// ── WAS GEHOLT WIRD ───────────────────────────────────────────────────────
//   1. searchAnalytics.query — Klicks, Impressionen, CTR, Position der letzten
//      28 Tage mit Daten und der 28 davor (Vergleich), Verlauf je Tag, die
//      Suchanfragen (daraus „Fast auf Seite 1“: Position 8–20 mit Impressionen),
//      Seiten, Länder, Geräte.
//   2. sitemaps.list — eingereichte Sitemaps, wann Google sie gelesen hat.
//   3. urlInspection.index.inspect — je Adresse aus der Sitemap: Ist sie bei
//      Google? Höchstens 400 Prüfungen am Tag (Google erlaubt 2.000 je Tag und
//      Eigenschaft). Daraus entstehen „Neu bei Google“ und „Noch nicht bei Google“.
//
// ── E-530 KORB B (25.11.2026) ─────────────────────────────────────────────
//   B1  Die URL-Prüfung nimmt die am längsten nicht geprüften Adressen zuerst
//       (nie geprüft ganz vorn), die Priorität der Sitemap zählt nur bei
//       Gleichstand (derselbe Berliner Tag); jede Adresse ist spätestens nach
//       sieben Tagen wieder dran, auch wenn sich der Tageslauf verschiebt.
//       Vorher stand die Priorität vorn — bei 150 am Tag kamen Randseiten
//       wochenlang nicht dran und ihr altes Urteil blieb stehen.
//       Nach der Prüfung legt der Lauf die Index-Zahl des Tages ab
//       (fiaon_gsc_tage.index_stand: gesamt, bei Google, nicht bei Google je
//       Grund laut Google, überfällig, „Google kennt einen alten Stand“) — die
//       Zahl muss nicht mehr von Hand aus Chrome kommen. Der Stand der Sitemap
//       (lastmod) steht je Adresse in fiaon_gsc_adressen.sitemap_stand.
//   B2  Klick-Summen je Tag (fiaon_gsc_tage.klickarten): Marke (Suche passt
//       auf fiaon und ähnliche Schreibweisen), Name (Suchen nach dem Gründer,
//       Personenmarke), ohne Marke (sichtbare Suchen ohne beides), anonym
//       (Klicks laut Google minus alle sichtbaren Suchen — Google zeigt
//       seltene Suchen nicht). Dazu Global gegen Privat nach Seite und eine
//       kleine Ampel für feste Suchwörter. Die Wörter stehen nicht im Code,
//       sondern in der Server-Umgebung (GSC_AMPEL_WOERTER); fehlt sie, gibt
//       es keine Ampel. Abgelegt werden nur Zahlen und Pfade, nie Suchtexte.
//
// ── ZUGANG ────────────────────────────────────────────────────────────────
// Dasselbe Dienstkonto wie Gmail und Kalender (GOOGLE_SA_KEY), aber OHNE „sub“:
// Das Dienstkonto spricht für sich selbst und braucht in der Search Console
// eine eigene Freigabe (Nutzer mit Lesezugriff) — dazu muss im Google-Projekt
// die Search Console API eingeschaltet sein. Fehlt eins davon, antwortet Google
// mit 403. Das ist kein Absturz, sondern ein Zustand: „zugang_fehlt“ mit einem
// Satz, was fehlt. Der Raum zeigt dann „Zugang fehlt noch“ und holt von selbst
// nach, sobald der Zugang da ist.
//
// ── EIN LAUF OHNE DATEN MELDET KEINEN ERFOLG (Lehre Clarity, 27.08.) ──────
// Der Tageslauf wirft, wenn Google nichts geliefert hat — die Lauf-Ampel sieht
// das. Ein Fehlschlag überschreibt nie einen guten Stand desselben Tages.
//
// Die Datenbank wird nur innerhalb der Funktionen geladen: Die reinen Teile
// (Deuten, Rechnen, Auswählen) prüft scripts/pruef-search-console.ts ohne Netz
// und ohne Datenbank.
// ═══════════════════════════════════════════════════════════════════════════
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { berlinToday } from "./fiaon-time";

/** Die Eigenschaft in der Search Console (URL-Präfix). */
export const GSC_EIGENSCHAFT = String(process.env.GSC_PROPERTY || "https://fiaon.com/").trim();
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const API = "https://searchconsole.googleapis.com";
/** Unser Deckel für URL-Prüfungen je Berliner Tag. Google erlaubt 2.000 (E-530: 150 → 400). */
export const PRUEF_TAGESBUDGET = 400;
/** Spätestens nach so vielen Stunden ist jede Adresse wieder geprüft — sieben Tage (E-530 B1). */
export const PRUEF_HOECHSTENS_STUNDEN = 7 * 24;
/**
 * Spielraum für den Tageslauf: Eine Adresse wird schon so viele Stunden VOR den
 * sieben Tagen wieder fällig. Läuft der Tageslauf einmal später (Neuversuch nach
 * einem Google-Fehler, „Jetzt abrufen“ am Nachmittag), kommt sie trotzdem am
 * nächsten Morgen dran — höchstens 142 h plus ein Tag bis zum nächsten Lauf.
 */
export const PRUEF_SPIELRAUM_STUNDEN = 26;
/** Ampel für feste Suchwörter: gelb ab so vielen Impressionen im 28-Tage-Fenster, rot ab so vielen. */
export const AMPEL_GRENZEN = { gelb: 1, rot: 10 } as const;
/** Höchstens so viele feste Suchwörter liest die Ampel aus GSC_AMPEL_WOERTER. */
export const AMPEL_HOECHSTENS = 5;
/** „Fast auf Seite 1“: durchschnittliche Position von … bis … */
export const FAST_SEITE_1 = { von: 8, bis: 20 } as const;
/** Der Tageslauf holt ab dieser Berliner Stunde. */
export const FRUEH_STUNDE = 5;
/** Fehlt der Zugang, versucht der Lauf es höchstens alle drei Stunden neu. */
const NEUVERSUCH_STUNDEN = 3;
/** Wie viele URL-Prüfungen gleichzeitig laufen (Google: 600 je Minute). */
const PRUEF_PARALLEL = 3;
/** Nach so vielen Fehlern hintereinander hört die URL-Prüfung für heute auf. */
const PRUEF_FEHLER_STOPP = 5;

// ═══════════════════════════════════════════════════════════════════════════
// TYPEN
// ═══════════════════════════════════════════════════════════════════════════
export type GscZustand = "ok" | "zugang_fehlt" | "fehler";
/** Eine Zeile, wie searchAnalytics.query sie liefert. */
export interface GscZeile { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }
export interface Kennzahlen { klicks: number; impressionen: number; ctr: number; position: number | null }
export interface Eintrag extends Kennzahlen { name: string }
export interface Zeitraum { von: string; bis: string; vorherVon: string; vorherBis: string; tage: number }
export interface SitemapStand {
  pfad: string; eingereicht: string | null; gelesen: string | null; wartet: boolean;
  warnungen: number; fehler: number; adressen: number | null;
}
export interface PruefErgebnis {
  adresse: string; urteil: string; abdeckung: string | null; indexierung: string | null; abruf: string | null;
  robots: string | null; letzterCrawl: string | null; kanonisch: string | null; indexiert: boolean; link: string | null;
}
/** Eine Adresse der Sitemap: Priorität und Stand (lastmod, JJJJ-MM-TT), wenn die Sitemap einen nennt. */
export interface Kandidat { adresse: string; prio: number; stand?: string }
export interface Bekannt { zuletztGeprueft: Date | null; indexiert: boolean | null }

/** Was Google gemeldet hat, in einem Satz für Menschen. */
export interface GoogleDeutung { zustand: "zugang_fehlt" | "fehler" | "kontingent"; code: string; grund: string }

export class GoogleAntwortFehler extends Error {
  constructor(public status: number, public deutung: GoogleDeutung) { super(deutung.grund); }
}

// ═══════════════════════════════════════════════════════════════════════════
// REINE TEILE — ohne Netz, ohne Datenbank (geprüft in scripts/pruef-search-console.ts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deutet eine Fehlerantwort von Google. 403 heißt fast immer „Zugang fehlt“ —
 * aber zwei verschiedene Dinge können fehlen, und der Satz sagt, welches.
 * Kein Schlüssel, keine Projektnummer, keine Adresse aus der Antwort wandert
 * in den Satz (der steht in der Datenbank und im Chefbüro).
 */
export function googleFehlerDeuten(status: number, body: unknown): GoogleDeutung {
  const b = (body && typeof body === "object" ? body : {}) as any;
  const fehler = b.error && typeof b.error === "object" ? b.error : {};
  const text = [
    typeof b.error === "string" ? b.error : "", typeof b.error_description === "string" ? b.error_description : "",
    String(fehler.message ?? ""), String(fehler.status ?? ""),
    ...(Array.isArray(fehler.errors) ? fehler.errors.map((e: any) => `${e?.reason ?? ""} ${e?.message ?? ""}`) : []),
    ...(Array.isArray(fehler.details) ? fehler.details.map((d: any) => `${d?.reason ?? ""}`) : []),
  ].join(" ").toLowerCase();

  if (/service_disabled|accessnotconfigured|has not been used in project|it is disabled|api has not been used/.test(text)) {
    return { zustand: "zugang_fehlt", code: "api_aus", grund: "Die Search Console API ist im Google-Projekt noch ausgeschaltet." };
  }
  if (status === 403 && /sufficient permission|do not own this site|not part of this property|forbidden|permission_denied/.test(text)) {
    return { zustand: "zugang_fehlt", code: "keine_freigabe", grund: "Das Dienstkonto hat in der Search Console noch keinen Zugriff auf fiaon.com." };
  }
  if (status === 429 || /resource_exhausted|quota|ratelimitexceeded/.test(text)) {
    return { zustand: "kontingent", code: "kontingent", grund: "Google lässt heute keine weiteren Abrufe zu (Tageskontingent)." };
  }
  if (/invalid_grant|unauthorized_client|invalid_client|access_denied/.test(text)) {
    return { zustand: "fehler", code: "schluessel", grund: "Google nimmt den Schlüssel des Dienstkontos nicht an." };
  }
  if (status === 401) return { zustand: "fehler", code: "anmeldung", grund: "Google hat die Anmeldung abgelehnt (401)." };
  if (status === 403) return { zustand: "zugang_fehlt", code: "verboten", grund: "Google verweigert den Zugriff (403)." };
  return { zustand: "fehler", code: `http_${status || 0}`, grund: `Google antwortete mit ${status || "keiner Antwort"}.` };
}

/** Kalendertag plus n Tage — reine Datumsrechnung auf JJJJ-MM-TT. */
export function tagPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Die Berliner Stunde (0–23) — nie über Number(format()), siehe fiaon-zeit-berlin-falle. NaN gilt als Nacht. */
export function berlinStunde(at: Date = new Date()): number {
  const teil = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hourCycle: "h23" })
    .formatToParts(at).find((p) => p.type === "hour")?.value;
  const h = Number(teil);
  return Number.isFinite(h) ? h : -1;
}

/**
 * Die zwei Zeiträume: die letzten 28 Tage, für die Google schon Daten hat, und
 * die 28 davor. Google meldet mit 1–3 Tagen Verzug — deshalb zählt der letzte
 * Tag MIT Daten, nicht „gestern“ (sonst wäre der Vergleich immer schief).
 */
export function zeitraeume(letzterTag: string, tage = 28): Zeitraum {
  const bis = letzterTag;
  const von = tagPlus(bis, -(tage - 1));
  const vorherBis = tagPlus(von, -1);
  return { von, bis, vorherVon: tagPlus(vorherBis, -(tage - 1)), vorherBis, tage };
}

const zahlOder0 = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Summen über Zeilen. Die Position ist der Durchschnitt, gewichtet mit den
 * Impressionen — so rechnet Google selbst (Mittelwert über alle Einblendungen).
 */
export function summen(zeilen: GscZeile[]): Kennzahlen {
  let klicks = 0, impressionen = 0, posGewicht = 0;
  for (const z of zeilen) {
    const i = zahlOder0(z.impressions);
    klicks += zahlOder0(z.clicks);
    impressionen += i;
    posGewicht += zahlOder0(z.position) * i;
  }
  return {
    klicks, impressionen,
    ctr: impressionen > 0 ? klicks / impressionen : 0,
    position: impressionen > 0 ? Math.round((posGewicht / impressionen) * 10) / 10 : null,
  };
}

/** Zeilen einer Dimension als Einträge (name = erster Schlüssel). */
export function eintraege(zeilen: GscZeile[] | undefined): Eintrag[] {
  return (zeilen ?? []).map((z) => ({
    name: String(z.keys?.[0] ?? ""),
    klicks: zahlOder0(z.clicks),
    impressionen: zahlOder0(z.impressions),
    ctr: zahlOder0(z.ctr),
    position: z.position == null ? null : Math.round(zahlOder0(z.position) * 10) / 10,
  })).filter((e) => e.name !== "");
}

/** Suchanfragen auf Position 8–20 mit Impressionen — die kleinste Arbeit mit dem größten Sprung. */
export function fastSeiteEins(anfragen: Eintrag[], grenzen = FAST_SEITE_1): Eintrag[] {
  return anfragen
    .filter((a) => a.impressionen > 0 && a.position != null && a.position >= grenzen.von && a.position <= grenzen.bis)
    .sort((a, b) => b.impressionen - a.impressionen || (a.position ?? 99) - (b.position ?? 99));
}

/** Verlauf je Tag im aktuellen Zeitraum — Tage ohne Daten mit 0, damit die Linie keine Lücke verschweigt. */
export function verlaufJeTag(datumZeilen: GscZeile[], z: Zeitraum): (Kennzahlen & { tag: string })[] {
  const nachTag = new Map(datumZeilen.map((r) => [String(r.keys?.[0] ?? ""), r]));
  const raus: (Kennzahlen & { tag: string })[] = [];
  for (let t = z.von; t <= z.bis; t = tagPlus(t, 1)) {
    const r = nachTag.get(t);
    raus.push({ tag: t, ...summen(r ? [r] : []) });
  }
  return raus;
}

/** Datumszeilen in einem Bereich (einschließlich). */
export function imBereich(datumZeilen: GscZeile[], von: string, bis: string): GscZeile[] {
  return datumZeilen.filter((r) => { const t = String(r.keys?.[0] ?? ""); return t >= von && t <= bis; });
}

/** Die Antwort von sitemaps.list, ohne Zahlen als Text. */
export function sitemapStand(antwort: unknown): SitemapStand[] {
  const liste = Array.isArray((antwort as any)?.sitemap) ? (antwort as any).sitemap : [];
  return liste.map((s: any) => {
    const inhalte = Array.isArray(s?.contents) ? s.contents : [];
    const eingereicht = inhalte.reduce((n: number, c: any) => n + zahlOder0(c?.submitted), 0);
    return {
      pfad: String(s?.path ?? ""),
      eingereicht: s?.lastSubmitted ? String(s.lastSubmitted) : null,
      gelesen: s?.lastDownloaded ? String(s.lastDownloaded) : null,
      wartet: s?.isPending === true,
      warnungen: zahlOder0(s?.warnings),
      fehler: zahlOder0(s?.errors),
      adressen: inhalte.length ? eingereicht : null,
    };
  }).filter((s: SitemapStand) => s.pfad);
}

/** Die Antwort einer URL-Prüfung. PASS und PARTIAL heißen: Die Seite ist bei Google. */
export function pruefungDeuten(adresse: string, antwort: unknown): PruefErgebnis {
  const r = (antwort as any)?.inspectionResult ?? {};
  const s = r.indexStatusResult ?? {};
  const urteil = String(s.verdict ?? "VERDICT_UNSPECIFIED");
  return {
    adresse,
    urteil,
    abdeckung: s.coverageState ? String(s.coverageState).slice(0, 200) : null,
    indexierung: s.indexingState ? String(s.indexingState) : null,
    abruf: s.pageFetchState ? String(s.pageFetchState) : null,
    robots: s.robotsTxtState ? String(s.robotsTxtState) : null,
    letzterCrawl: s.lastCrawlTime && !String(s.lastCrawlTime).startsWith("1970") ? String(s.lastCrawlTime) : null,
    kanonisch: s.googleCanonical ? String(s.googleCanonical) : null,
    indexiert: urteil === "PASS" || urteil === "PARTIAL",
    link: r.inspectionResultLink ? String(r.inspectionResultLink) : null,
  };
}

/** Adressen und Priorität aus einer Sitemap (urlset). */
export function sitemapAdressen(xml: string): Kandidat[] {
  const raus: Kandidat[] = [];
  const gesehen = new Set<string>();
  const ent = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const muster = /<url>([\s\S]*?)<\/url>/g;
  for (let m = muster.exec(String(xml)); m; m = muster.exec(String(xml))) {
    const loc = /<loc>\s*([^<]+?)\s*<\/loc>/.exec(m[1])?.[1];
    if (!loc) continue;
    const adresse = ent(loc);
    if (gesehen.has(adresse)) continue;
    gesehen.add(adresse);
    const p = Number(/<priority>\s*([\d.]+)\s*<\/priority>/.exec(m[1])?.[1]);
    const stand = /<lastmod>\s*(\d{4}-\d{2}-\d{2})/.exec(m[1])?.[1];
    raus.push({ adresse, prio: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5, ...(stand ? { stand } : {}) });
  }
  return raus;
}

/**
 * Wie lange nach der letzten Prüfung eine Adresse wieder dran ist (Stunden).
 * Was noch nicht bei Google ist, wollen wir am Tag sehen, an dem es hineinkommt —
 * die Kernseiten (Priorität ab 0,8) täglich, den Rest jeden zweiten Tag. Was
 * schon drin ist, reicht alle drei Tage (Kern) bzw. knapp sechs Tage: höchstens
 * sieben Tage minus Spielraum (142 h), damit „spätestens nach sieben Tagen“ auch
 * hält, wenn der Tageslauf sich einmal verschiebt.
 */
export function pruefAbstandStunden(prio: number, indexiert: boolean | null): number {
  const h = indexiert === true ? (prio >= 0.9 ? 70 : 166) : (prio >= 0.8 ? 20 : 44);
  return Math.min(h, PRUEF_HOECHSTENS_STUNDEN - PRUEF_SPIELRAUM_STUNDEN);
}

const BERLIN_TAG = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
/** Der Berliner Kalendertag als JJJJ-MM-TT — über formatToParts (nie Number(format()), siehe fiaon-zeit-berlin-falle). */
export function berlinTag(at: Date): string {
  const teile = BERLIN_TAG.formatToParts(at);
  const teil = (typ: string) => teile.find((p) => p.type === typ)?.value ?? "";
  return `${teil("year")}-${teil("month")}-${teil("day")}`;
}

/**
 * Welche Adressen heute geprüft werden (E-530 B1): alle fälligen, die am längsten
 * nicht geprüften zuerst (nie geprüft = ganz vorn). Die Priorität der Sitemap
 * entscheidet nur bei Gleichstand — gleich alt heißt: am selben Berliner Tag
 * geprüft (ein Lauf prüft alle seine Adressen innerhalb weniger Minuten; eine
 * Stundengrenze mitten im Lauf teilt ihn so nicht). Am selben Tag und mit gleicher
 * Priorität geht die ältere Prüfung vor. Eine Adresse, deren letzte Prüfung fast
 * sieben Tage zurückliegt, ist immer fällig und steht damit vor allem, was erst
 * seit Kurzem wieder dran ist.
 */
export function pruefAuswahl(kandidaten: Kandidat[], bekannt: Map<string, Bekannt>, jetzt: Date, budget: number): string[] {
  if (!(budget > 0)) return [];
  const zeit = new Map<string, { tag: string; t: number }>();
  const faellig = kandidaten.filter((k) => {
    const b = bekannt.get(k.adresse);
    const t = b?.zuletztGeprueft?.getTime();
    if (t == null || !Number.isFinite(t)) { zeit.set(k.adresse, { tag: "", t: -Infinity }); return true; }
    if (jetzt.getTime() - t < pruefAbstandStunden(k.prio, b?.indexiert ?? null) * 3_600_000) return false;
    zeit.set(k.adresse, { tag: berlinTag(new Date(t)), t });
    return true;
  });
  // Nie geprüft hat den Tag "" und steht damit vor jedem echten Tag.
  return faellig
    .sort((a, b) => {
      const x = zeit.get(a.adresse)!, y = zeit.get(b.adresse)!;
      if (x.tag !== y.tag) return x.tag < y.tag ? -1 : 1;
      return (b.prio - a.prio) || (x.t === y.t ? 0 : x.t < y.t ? -1 : 1);
    })
    .slice(0, Math.floor(budget))
    .map((k) => k.adresse);
}

// ── B1: die Index-Zahl des Tages ────────────────────────────────────────────
export interface IndexGrund { grund: string; anzahl: number }
export interface IndexStand {
  gemessenAm?: string;
  gesamt: number; indexiert: number; nichtIndexiert: number; ungeprueft: number;
  /** Adressen, deren letzte Prüfung älter als sieben Tage ist (soll nach B1 auf 0 gehen). */
  ueberfaellig: number;
  /**
   * Bei Google, aber Google war zuletzt VOR dem Stand der Sitemap da (letzter Crawl
   * älter als lastmod) — Kandidaten für eine Neu-Indexierung (B1).
   */
  alterStand: number;
  /** Nicht bei Google, je Grund laut Google (coverageState), häufigster zuerst. */
  gruende: IndexGrund[];
}
export interface IndexZeile {
  indexiert: boolean | null; abdeckung: string | null; zuletztGeprueft: Date | null;
  /** Letzter Besuch von Google und Stand der Sitemap (JJJJ-MM-TT) — nur für alterStand. */
  letzterCrawl?: Date | null; stand?: string | null;
}

/** Zählt den Stand der Adresstabelle — rein, ohne Datenbank. */
export function indexStandZaehlen(zeilen: IndexZeile[], jetzt: Date): IndexStand {
  let indexiert = 0, nicht = 0, ungeprueft = 0, ueberfaellig = 0, alterStand = 0;
  const gruende = new Map<string, number>();
  const grenze = jetzt.getTime() - PRUEF_HOECHSTENS_STUNDEN * 3_600_000;
  for (const z of zeilen) {
    const t = z.zuletztGeprueft?.getTime();
    if (t == null || !Number.isFinite(t) || t < grenze) ueberfaellig++;
    if (z.indexiert === true) {
      indexiert++;
      const crawl = z.letzterCrawl?.getTime();
      const stand = String(z.stand ?? "").slice(0, 10);
      // Kalendertag des Besuchs (UTC, wie lastmod) vor dem Stand der Sitemap → Google kennt einen alten Stand.
      if (crawl != null && Number.isFinite(crawl) && /^\d{4}-\d{2}-\d{2}$/.test(stand) && new Date(crawl).toISOString().slice(0, 10) < stand) alterStand++;
      continue;
    }
    if (z.indexiert !== false) { ungeprueft++; continue; }
    nicht++;
    const g = String(z.abdeckung ?? "").trim() || "ohne Angabe";
    gruende.set(g, (gruende.get(g) ?? 0) + 1);
  }
  return {
    gesamt: zeilen.length, indexiert, nichtIndexiert: nicht, ungeprueft, ueberfaellig, alterStand,
    gruende: Array.from(gruende, ([grund, anzahl]) => ({ grund, anzahl })).sort((a, b) => b.anzahl - a.anzahl || a.grund.localeCompare(b.grund, "de")),
  };
}

/**
 * Wie sich „bei Google“ verändert hat: der jüngste Tag gegen den jüngsten Tag, der
 * mindestens `tage` Tage davor liegt (sonst gegen den ältesten vorhandenen).
 * Weniger als zwei Tage → null.
 */
export function indexVeraenderung(verlauf: { tag: string; indexiert: number }[], tage = 7): { delta: number; seit: string } | null {
  const v = verlauf.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.tag) && Number.isFinite(x.indexiert)).sort((a, b) => (a.tag < b.tag ? 1 : -1));
  if (v.length < 2) return null;
  const grenze = tagPlus(v[0].tag, -tage);
  const vorher = v.find((x) => x.tag <= grenze) ?? v[v.length - 1];
  return { delta: v[0].indexiert - vorher.indexiert, seit: vorher.tag };
}

// ── B2: Marke, Name, ohne Marke, anonym — Global gegen Privat ───────────────
const klein = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/**
 * Die Marke in einer Suche. Eindeutig ist „fiaon“ am Wortanfang — egal, was
 * angehängt ist (fiaonglobal, fiaon24, fiaonerfahrungen, fiaon.com). Die unscharfen
 * Schreibweisen, die Menschen wirklich tippen (fion, fianon, fiaoon, fyaon, faion,
 * „fia on“), zählen nur als ganzes Wort, höchstens mit einem bekannten Anhängsel
 * (global, ltd, com …). Kein Treffer: fiona, fionn, fiano, finanzen, infion.
 */
export const MARKEN_MUSTER = /(?:^|[^a-z0-9])(?:fiaon|f(?:[iy]a?n?|ai)o+n(?:global|ltd|com|de|app|login|karte|kreditkarte)?(?=$|[^a-z0-9]))/;

export function istMarke(suche: string): boolean {
  const q = klein(suche).replace(/(^|[^a-z0-9])fia[\s.\-_]+on(?=$|[^a-z0-9])/g, "$1fiaon");
  return MARKEN_MUSTER.test(q);
}

/**
 * Suchen nach dem Namen des Gründers (Personenmarke, Plan E-530 §4): der Nachname
 * als ganzes Wort, auch mit Vorname davor. Solche Suchen kommen von Menschen, die
 * den Namen schon kennen — sie zählen deshalb NICHT als „ohne Marke“.
 */
export const NAME_MUSTER = /(?:^|[^a-z0-9])schwarzott?(?=$|[^a-z0-9])/;

/** Ein festes Suchwort der Ampel: ein neutraler Schlüssel (w1, w2 …) und das Muster. Das Wort selbst wird nie abgelegt. */
export interface AmpelWort { schluessel: string; muster: RegExp }

/**
 * Die festen Suchwörter der Ampel stehen nicht im Code, sondern in der
 * Server-Umgebung: GSC_AMPEL_WOERTER, durch Komma getrennt, höchstens fünf.
 * Ganze Wörter; Leerzeichen, Punkt, Binde- und Unterstrich zwischen den Teilen
 * sind frei („a b“ trifft auch „a-b“ und „ab“). Fehlt die Angabe: keine Ampel.
 */
export function ampelWoerter(roh: string | undefined = process.env.GSC_AMPEL_WOERTER): AmpelWort[] {
  const raus: AmpelWort[] = [];
  for (const w of String(roh ?? "").split(",")) {
    const teile = klein(w).split(/[^a-z0-9]+/).filter(Boolean);
    if (!teile.length || raus.length >= AMPEL_HOECHSTENS) continue;
    raus.push({ schluessel: `w${raus.length + 1}`, muster: new RegExp(`(?:^|[^a-z0-9])${teile.join("[\\s.\\-_]*")}(?=$|[^a-z0-9])`) });
  }
  return raus;
}

export type SuchArt = "marke" | "feste" | "name" | "ohne";

/**
 * Was für eine Suche das ist. Reihenfolge: Marke vor den festen Suchwörtern vor dem
 * Namen; „ohne Marke“ bleibt nur, was nichts davon trifft. So landet eine Suche mit
 * einem festen Suchwort nie in „ohne Marke“ und nie beim Namen.
 */
export function sucheArt(suche: string, woerter: AmpelWort[] = ampelWoerter()): SuchArt {
  if (istMarke(suche)) return "marke";
  const q = klein(suche);
  if (woerter.some((w) => w.muster.test(q))) return "feste";
  if (NAME_MUSTER.test(q)) return "name";
  return "ohne";
}

export type Bereich = "global" | "privat";

/**
 * Global = /, /en, /business (genau, /business/… oder /business-…), dasselbe unter
 * /en/business, und /justin-schwarzott (genau oder /justin-schwarzott/…, auch unter
 * /en). Alles andere Privat. Eine leere oder kaputte Adresse zählt nirgends (null).
 */
export function seitenBereich(adresse: string): Bereich | null {
  const roh = String(adresse ?? "").trim();
  if (!roh) return null;
  let p: string;
  try { p = new URL(roh, "https://fiaon.com").pathname; } catch { return null; }
  p = p.toLowerCase().replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/en") return "global";
  if (/^(?:\/en)?\/business(?:$|[/-])/.test(p)) return "global";
  if (/^(?:\/en)?\/justin-schwarzott(?:$|\/)/.test(p)) return "global";
  return "privat";
}

/** Klicks, deren Suche Google nicht zeigt: alle Klicks minus alle sichtbaren Suchen (nie unter 0). */
export function anonymKlicks(gesamt: number, sichtbar: number): number {
  return Math.max(0, zahlOder0(gesamt) - zahlOder0(sichtbar));
}

export type AmpelStufe = "gruen" | "gelb" | "rot";
export function ampelStufe(impressionen: number, grenzen: { gelb: number; rot: number } = AMPEL_GRENZEN): AmpelStufe {
  const n = zahlOder0(impressionen);
  return n >= grenzen.rot ? "rot" : n >= grenzen.gelb ? "gelb" : "gruen";
}

/** Nur der Pfad einer fiaon.com-Adresse (andere Hosts: null). */
function fiaonPfad(adresse: string): string | null {
  try {
    const u = new URL(String(adresse ?? ""), "https://fiaon.com");
    return /(^|\.)fiaon\.com$/.test(u.hostname) ? (u.pathname || "/") : null;
  } catch { return null; }
}

export interface BezugAmpel {
  stufe: AmpelStufe; impressionen: number; suchen: number;
  /** Impressionen je festem Suchwort, nur unter neutralem Schlüssel (w1, w2 …). */
  je: Record<string, number>;
  /** Die (höchstens drei) Seiten mit den meisten Impressionen dafür — nur Pfade; leer, wenn Suche × Seite fehlte. */
  seiten: { pfad: string; impressionen: number }[];
}

/**
 * Impressionen sichtbarer Suchen mit einem der festen Suchwörter — nur Zahlen und
 * Pfade, nie die Suchtexte. Ohne Suchwörter (GSC_AMPEL_WOERTER fehlt): null.
 */
export function bezugAmpel(anfragen: GscZeile[], woerter: AmpelWort[] = ampelWoerter(), anfrageSeiten: GscZeile[] | null = null): BezugAmpel | null {
  if (!woerter.length) return null;
  const je: Record<string, number> = Object.fromEntries(woerter.map((w) => [w.schluessel, 0]));
  let impressionen = 0, suchen = 0;
  for (const z of anfragen) {
    const q = klein(z.keys?.[0]);
    const treffer = woerter.filter((w) => w.muster.test(q));
    if (!treffer.length) continue;
    const i = zahlOder0(z.impressions);
    impressionen += i; suchen++;
    for (const w of treffer) je[w.schluessel] += i;
  }
  const jeSeite = new Map<string, number>();
  for (const z of anfrageSeiten ?? []) {
    const q = klein(z.keys?.[0]);
    if (!woerter.some((w) => w.muster.test(q))) continue;
    const pfad = fiaonPfad(String(z.keys?.[1] ?? ""));
    if (pfad) jeSeite.set(pfad, (jeSeite.get(pfad) ?? 0) + zahlOder0(z.impressions));
  }
  const seiten = Array.from(jeSeite, ([pfad, n]) => ({ pfad, impressionen: n }))
    .filter((s) => s.impressionen > 0)
    .sort((a, b) => b.impressionen - a.impressionen || a.pfad.localeCompare(b.pfad))
    .slice(0, 3);
  return { stufe: ampelStufe(impressionen), impressionen, suchen, je, seiten };
}

export interface KlickTeil {
  gesamt: number; marke: number; name: number; feste: number; ohneMarke: number; anonym: number;
  /** anonym / gesamt in diesem Bereich (null ohne Klicks). */
  anteilAnonym: number | null;
}
export interface KlickArten {
  /** Klicks laut Google (alle Suchen, auch die nicht gezeigten). */
  gesamt: number;
  /** Summe der sichtbaren Suchen = marke + name + feste + ohneMarke. */
  sichtbar: number;
  marke: number; name: number; feste: number; ohneMarke: number; anonym: number;
  anteilAnonym: number | null;
  /** Suchen nach dem Namen (Plan E-530 §4): Klicks, Impressionen, wie viele verschiedene Suchen. */
  nameSuchen: { klicks: number; impressionen: number; suchen: number };
  /** null, wenn Google „Suche × Seite“ an dem Tag nicht lieferte (Grund in hinweis). */
  global: KlickTeil | null; privat: KlickTeil | null;
  /** null ohne feste Suchwörter. */
  ampel: BezugAmpel | null;
  hinweis: string | null;
}

/**
 * Die Summen. gesamtKlicks = Klicks laut Google im Zeitraum (aus den Tageszeilen);
 * anfragen = Zeilen nach Suche; anfrageSeiten = nach Suche und Seite (null, wenn
 * Google sie nicht lieferte); seiten = nach Seite (enthält auch die anonymen Klicks).
 */
export function klickArten(e: {
  gesamtKlicks: number; anfragen: GscZeile[]; anfrageSeiten: GscZeile[] | null; seiten: GscZeile[];
  woerter?: AmpelWort[]; hinweis?: string | null;
}): KlickArten {
  const woerter = e.woerter ?? ampelWoerter();
  const arten = new Map<string, SuchArt>();
  const art = (q: string) => { let a = arten.get(q); if (!a) { a = sucheArt(q, woerter); arten.set(q, a); } return a; };
  const summe: Record<SuchArt, number> = { marke: 0, feste: 0, name: 0, ohne: 0 };
  const nameSuchen = { klicks: 0, impressionen: 0, suchen: 0 };
  for (const z of e.anfragen) {
    const k = zahlOder0(z.clicks);
    const a = art(String(z.keys?.[0] ?? ""));
    summe[a] += k;
    if (a === "name") { nameSuchen.klicks += k; nameSuchen.impressionen += zahlOder0(z.impressions); nameSuchen.suchen++; }
  }
  let global: KlickTeil | null = null, privat: KlickTeil | null = null;
  if (e.anfrageSeiten) {
    const teil = (): KlickTeil => ({ gesamt: 0, marke: 0, name: 0, feste: 0, ohneMarke: 0, anonym: 0, anteilAnonym: null });
    const t: Record<Bereich, KlickTeil> = { global: teil(), privat: teil() };
    for (const z of e.anfrageSeiten) {
      const b = seitenBereich(String(z.keys?.[1] ?? ""));
      if (!b) continue;
      const a = art(String(z.keys?.[0] ?? ""));
      t[b][a === "ohne" ? "ohneMarke" : a] += zahlOder0(z.clicks);
    }
    for (const z of e.seiten) {
      const b = seitenBereich(String(z.keys?.[0] ?? ""));
      if (b) t[b].gesamt += zahlOder0(z.clicks);
    }
    for (const b of Object.values(t)) {
      b.anonym = anonymKlicks(b.gesamt, b.marke + b.name + b.feste + b.ohneMarke);
      b.anteilAnonym = b.gesamt > 0 ? b.anonym / b.gesamt : null;
    }
    global = t.global; privat = t.privat;
  }
  const sichtbar = summe.marke + summe.feste + summe.name + summe.ohne;
  const gesamt = zahlOder0(e.gesamtKlicks);
  const anonym = anonymKlicks(gesamt, sichtbar);
  return {
    gesamt, sichtbar, marke: summe.marke, name: summe.name, feste: summe.feste, ohneMarke: summe.ohne, anonym,
    anteilAnonym: gesamt > 0 ? anonym / gesamt : null,
    nameSuchen, global, privat,
    ampel: bezugAmpel(e.anfragen, woerter, e.anfrageSeiten),
    hinweis: e.hinweis ?? null,
  };
}

/** Was die Kacheln zeigen: Summen jetzt und davor, aus den Datumszeilen. */
export function auswerten(datumZeilen: GscZeile[], z: Zeitraum): { jetzt: Kennzahlen; vorher: Kennzahlen } {
  return { jetzt: summen(imBereich(datumZeilen, z.von, z.bis)), vorher: summen(imBereich(datumZeilen, z.vorherVon, z.vorherBis)) };
}

// ═══════════════════════════════════════════════════════════════════════════
// NETZ — Token und Anfragen
// ═══════════════════════════════════════════════════════════════════════════

/** Austauschbar nur für den Prüfstand (gefälschtes Google ohne Netz). */
export const gscTechnik: { fetch: typeof fetch } = { fetch: (...a: Parameters<typeof fetch>) => fetch(...a) };

interface Dienstkonto { client_email: string; private_key: string; token_uri?: string }
function dienstkonto(): Dienstkonto | null {
  try {
    const j = process.env.GOOGLE_SA_KEY ? JSON.parse(process.env.GOOGLE_SA_KEY) : null;
    return j?.client_email && j?.private_key ? j : null;
  } catch { return null; }
}
const b64url = (s: Buffer | string) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Die signierte Anfrage für den Token — ohne „sub“: Das Dienstkonto spricht für sich selbst. */
export function tokenAnfrage(sa: Dienstkonto, jetztSek: number): { ziel: string; body: string } {
  const ziel = sa.token_uri || "https://oauth2.googleapis.com/token";
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const rumpf = b64url(JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: ziel, iat: jetztSek, exp: jetztSek + 3600 }));
  const sig = b64url(createSign("RSA-SHA256").update(`${kopf}.${rumpf}`).sign(sa.private_key));
  return { ziel, body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${kopf}.${rumpf}.${sig}` };
}

let tokenSpeicher: { konto: string; token: string; bis: number } | null = null;
export async function gscToken(): Promise<string> {
  const sa = dienstkonto();
  if (!sa) {
    throw new GoogleAntwortFehler(0, { zustand: "zugang_fehlt", code: "schluessel_fehlt", grund: "Der Schlüssel des Google-Dienstkontos fehlt (GOOGLE_SA_KEY)." });
  }
  if (tokenSpeicher && tokenSpeicher.konto === sa.client_email && tokenSpeicher.bis > Date.now() + 5 * 60_000) return tokenSpeicher.token;
  const { ziel, body } = tokenAnfrage(sa, Math.floor(Date.now() / 1000));
  const res = await gscTechnik.fetch(ziel, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
    signal: AbortSignal.timeout(20_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new GoogleAntwortFehler(res.status, googleFehlerDeuten(res.status, j));
  tokenSpeicher = { konto: sa.client_email, token: String(j.access_token), bis: Date.now() + Number(j.expires_in || 3600) * 1000 };
  return tokenSpeicher.token;
}

async function google(methode: "GET" | "POST", pfad: string, body?: unknown): Promise<any> {
  const token = await gscToken();
  const res = await gscTechnik.fetch(`${API}${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new GoogleAntwortFehler(res.status, googleFehlerDeuten(res.status, j));
  return j ?? {};
}

const eigenschaftPfad = () => `/webmasters/v3/sites/${encodeURIComponent(GSC_EIGENSCHAFT)}`;

async function analyse(von: string, bis: string, dimensionen: string[], zeilen: number): Promise<GscZeile[]> {
  const j = await google("POST", `${eigenschaftPfad()}/searchAnalytics/query`, {
    startDate: von, endDate: bis, dimensions: dimensionen, type: "web", dataState: "all", rowLimit: zeilen,
  });
  return Array.isArray(j?.rows) ? j.rows : [];
}

export interface GscDaten {
  zeitraum: Zeitraum;
  summen: { jetzt: Kennzahlen; vorher: Kennzahlen };
  verlauf: (Kennzahlen & { tag: string })[];
  anfragen: Eintrag[]; seiten: Eintrag[]; laender: Eintrag[]; geraete: Eintrag[];
  sitemaps: SitemapStand[];
  /** E-530 B2: Marke / Name / ohne Marke / anonym, Global gegen Privat, Ampel. */
  klickArten: KlickArten;
}

/** Zeilen je Abruf: Google liefert höchstens 25.000 — für die Summen brauchen wir ALLE sichtbaren Suchen. */
const ALLE_ZEILEN = 25_000;

/**
 * Alles aus searchAnalytics und sitemaps — sechs Anfragen plus eine. Wirft GoogleAntwortFehler.
 * Die siebte (Suche × Seite, nur für Global gegen Privat) ist bei Google die teuerste:
 * Scheitert NUR sie (Kontingent, Zeitlimit, 5xx), laufen Kacheln, URL-Prüfung und
 * Index-Zahl trotzdem — Global/Privat fehlt dann für diesen Tag, der Grund steht in
 * klickArten.hinweis.
 */
export async function gscHolen(jetzt: Date = new Date()): Promise<GscDaten> {
  const gestern = tagPlus(berlinToday(jetzt), -1);
  // 60 Tage je Tag — daraus der letzte Tag mit Daten und beide Zeiträume.
  const datum = await analyse(tagPlus(gestern, -59), gestern, ["date"], 100);
  const letzter = datum.map((r) => String(r.keys?.[0] ?? "")).filter(Boolean).sort().pop() ?? gestern;
  const z = zeitraeume(letzter);
  const [anfragen, seiten, laender, geraete, karten, suchSeite] = await Promise.all([
    analyse(z.von, z.bis, ["query"], ALLE_ZEILEN),
    analyse(z.von, z.bis, ["page"], ALLE_ZEILEN),
    analyse(z.von, z.bis, ["country"], 30),
    analyse(z.von, z.bis, ["device"], 5),
    google("GET", `${eigenschaftPfad()}/sitemaps`),
    analyse(z.von, z.bis, ["query", "page"], ALLE_ZEILEN).then(
      (zeilen) => ({ zeilen, grund: null as string | null }),
      (e) => ({
        zeilen: null,
        grund: e instanceof GoogleAntwortFehler ? e.deutung.grund : `Google war nicht erreichbar: ${String((e as Error)?.message || e).slice(0, 120)}`,
      }),
    ),
  ]);
  const anfrageSeiten = suchSeite.zeilen;
  if (suchSeite.grund) console.log(`[GSC] Suche × Seite fehlt heute: ${suchSeite.grund}`);
  const summenJetzt = auswerten(datum, z);
  return {
    zeitraum: z,
    summen: summenJetzt,
    verlauf: verlaufJeTag(datum, z),
    anfragen: eintraege(anfragen),
    seiten: eintraege(seiten),
    laender: eintraege(laender),
    geraete: eintraege(geraete),
    sitemaps: sitemapStand(karten),
    klickArten: klickArten({
      gesamtKlicks: summenJetzt.jetzt.klicks, anfragen, anfrageSeiten, seiten,
      hinweis: suchSeite.grund ? `Global gegen Privat fehlt heute: ${suchSeite.grund}` : null,
    }),
  };
}

/** Eine Adresse bei Google prüfen. Wirft GoogleAntwortFehler. */
export async function gscAdressePruefen(adresse: string): Promise<PruefErgebnis> {
  const j = await google("POST", "/v1/urlInspection/index:inspect", { inspectionUrl: adresse, siteUrl: GSC_EIGENSCHAFT, languageCode: "de-DE" });
  return pruefungDeuten(adresse, j);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
async function db() { return (await import("./db-pool")).sqlPool; }
/** jsonb immer als Text übergeben und in SQL umwandeln — sonst legt postgres.js einen JSON-TEXT ab (E-377). */
const j = (x: unknown) => JSON.stringify(x ?? null);

let bereit: Promise<void> | null = null;
export function ensureGscTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const sqlPool = await db();
      const r = (await sqlPool`SELECT to_regclass('public.fiaon_gsc_adressen') AS a, to_regclass('public.fiaon_gsc_tage') AS t`) as any[];
      if (!(r[0]?.a && r[0]?.t)) {
        const datei = path.resolve(process.cwd(), "db", "migrations", "126_google_search_console.sql");
        // SET ohne LOCAL bliebe an der Verbindung des Pools hängen — hier nur für diese Transaktion.
        const text = readFileSync(datei, "utf8").replace(/^SET lock_timeout\b/m, "SET LOCAL lock_timeout");
        await sqlPool.begin(async (tx: any) => {
          await tx`SET LOCAL lock_timeout = '3s'`;
          await tx.unsafe(text);
        });
      }
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/**
 * E-530 Korb B: drei Spalten dazu — fiaon_gsc_tage.klickarten (B2) und .index_stand
 * (B1, Index-Zahl des Tages), fiaon_gsc_adressen.sitemap_stand (B1, lastmod).
 * Die DDL-Wache sieht vorher im Katalog nach (keine Sperre, wenn sie schon da sind).
 * Wirft nie: Scheitert es (Sperre, Abkühlzeit der Wache), arbeiten Abruf und Chefbüro
 * ohne die neuen Spalten weiter — die Google-Karte bleibt —, und der nächste Aufruf
 * versucht es wieder. true = alle Spalten da.
 */
let spalten: Promise<boolean> | null = null;
export function gscSpalten(): Promise<boolean> {
  if (!spalten) {
    spalten = (async () => {
      const sqlPool = await db();
      await sqlPool`ALTER TABLE fiaon_gsc_tage ADD COLUMN IF NOT EXISTS klickarten JSONB, ADD COLUMN IF NOT EXISTS index_stand JSONB`;
      await sqlPool`ALTER TABLE fiaon_gsc_adressen ADD COLUMN IF NOT EXISTS sitemap_stand DATE`;
      return true;
    })().catch((e) => {
      console.error("[GSC] neue Spalten (E-530):", String((e as Error)?.message || e).slice(0, 160));
      spalten = null;
      return false;
    });
  }
  return spalten;
}

/** Die Adressen der Sitemap, aus denselben Funktionen, die /sitemap.xml baut. */
export async function sitemapKandidaten(): Promise<Kandidat[]> {
  const { sitemapEintraege } = await import("./fiaon-seiten-seo");
  const { sitemapXml } = await import("../routes/fiaon-ratgeber");
  const statisch = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEintraege()}\n</urlset>`;
  return sitemapAdressen(await sitemapXml(statisch));
}

/** Wie viele URL-Prüfungen heute (Berliner Tag) schon liefen. */
async function heuteGeprueft(): Promise<number> {
  const sqlPool = await db();
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_gsc_adressen
     WHERE (zuletzt_geprueft AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date`) as any[];
  return Number(r?.n ?? 0);
}

/** Ein Ergebnis ablegen — mit dem Übergang „war nicht drin → ist drin“ (Neu bei Google). */
async function pruefungAblegen(e: PruefErgebnis): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    UPDATE fiaon_gsc_adressen SET
      zuerst_geprueft  = COALESCE(zuerst_geprueft, NOW()),
      zuletzt_geprueft = NOW(),
      urteil = ${e.urteil}, abdeckung = ${e.abdeckung}, indexierung = ${e.indexierung}, abruf = ${e.abruf},
      robots = ${e.robots}, letzter_crawl = ${e.letzterCrawl}, kanonisch = ${e.kanonisch}, pruef_link = ${e.link},
      fehler = NULL,
      indexiert_seit = CASE WHEN ${e.indexiert} THEN COALESCE(CASE WHEN indexiert THEN indexiert_seit END, NOW()) ELSE NULL END,
      neu_beobachtet = CASE WHEN ${e.indexiert} THEN (CASE WHEN indexiert THEN neu_beobachtet ELSE indexiert IS NOT NULL END) ELSE FALSE END,
      indexiert = ${e.indexiert}
    WHERE adresse = ${e.adresse}`;
}

async function pruefFehlerAblegen(adresse: string, grund: string): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    UPDATE fiaon_gsc_adressen SET zuerst_geprueft = COALESCE(zuerst_geprueft, NOW()), zuletzt_geprueft = NOW(), fehler = ${grund.slice(0, 300)}
     WHERE adresse = ${adresse}`;
}

/**
 * Die Sitemap in die Adresstabelle spiegeln: neue anlegen, Priorität und Stand der
 * Sitemap (lastmod, nur mit der neuen Spalte) nachziehen, verschwundene markieren.
 */
async function adressenSpiegeln(kandidaten: Kandidat[], mitStand: boolean): Promise<void> {
  if (!kandidaten.length) return;
  const sqlPool = await db();
  const adressen = kandidaten.map((k) => k.adresse);
  const prios = kandidaten.map((k) => k.prio);
  // Leerer Text statt null im Feld — NULLIF macht daraus in SQL ein echtes NULL.
  const staende = kandidaten.map((k) => (/^\d{4}-\d{2}-\d{2}$/.test(String(k.stand ?? "")) ? String(k.stand) : ""));
  if (mitStand) {
    await sqlPool`
      INSERT INTO fiaon_gsc_adressen (adresse, prio, in_sitemap, sitemap_stand)
      SELECT a, p, TRUE, NULLIF(s, '')::date FROM unnest(${adressen}::text[], ${prios}::numeric[], ${staende}::text[]) AS x(a, p, s)
      ON CONFLICT (adresse) DO UPDATE SET prio = EXCLUDED.prio, in_sitemap = TRUE, sitemap_stand = EXCLUDED.sitemap_stand`;
  } else {
    await sqlPool`
      INSERT INTO fiaon_gsc_adressen (adresse, prio, in_sitemap)
      SELECT a, p, TRUE FROM unnest(${adressen}::text[], ${prios}::numeric[]) AS x(a, p)
      ON CONFLICT (adresse) DO UPDATE SET prio = EXCLUDED.prio, in_sitemap = TRUE`;
  }
  await sqlPool`UPDATE fiaon_gsc_adressen SET in_sitemap = FALSE WHERE in_sitemap AND NOT (adresse = ANY(${adressen}::text[]))`;
}

export interface PruefLauf { geprueft: number; fehler: number; gestoppt: string | null; budgetRest: number }

/** Die URL-Prüfung des Tages: höchstens bis zum Tagesbudget, älteste Prüfung zuerst (pruefAuswahl). */
async function adressenPruefen(kandidaten: Kandidat[], jetzt: Date, mitStand: boolean): Promise<PruefLauf> {
  const sqlPool = await db();
  await adressenSpiegeln(kandidaten, mitStand);
  const budget = Math.max(0, PRUEF_TAGESBUDGET - (await heuteGeprueft()));
  const zeilen = (await sqlPool`SELECT adresse, zuletzt_geprueft, indexiert FROM fiaon_gsc_adressen WHERE in_sitemap`) as any[];
  const bekannt = new Map<string, Bekannt>(zeilen.map((z) => [String(z.adresse), {
    zuletztGeprueft: z.zuletzt_geprueft ? new Date(z.zuletzt_geprueft) : null,
    indexiert: z.indexiert == null ? null : Boolean(z.indexiert),
  }]));
  const auswahl = pruefAuswahl(kandidaten, bekannt, jetzt, budget);
  let geprueft = 0, fehler = 0, inFolge = 0;
  let gestoppt: string | null = null;
  let i = 0;
  const arbeiter = async () => {
    while (!gestoppt && i < auswahl.length) {
      const adresse = auswahl[i++];
      try {
        await pruefungAblegen(await gscAdressePruefen(adresse));
        geprueft++; inFolge = 0;
      } catch (e) {
        const d = e instanceof GoogleAntwortFehler ? e.deutung : null;
        if (d && (d.zustand === "zugang_fehlt" || d.zustand === "kontingent")) { gestoppt = d.grund; break; }
        fehler++; inFolge++;
        await pruefFehlerAblegen(adresse, d?.grund ?? (e instanceof Error ? e.message : String(e))).catch(() => {});
        if (inFolge >= PRUEF_FEHLER_STOPP) gestoppt = `${PRUEF_FEHLER_STOPP} Fehler hintereinander — für heute aufgehört.`;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PRUEF_PARALLEL, auswahl.length) }, arbeiter));
  return { geprueft, fehler, gestoppt, budgetRest: Math.max(0, budget - geprueft - fehler) };
}

/** Zählt den Stand der Adressen (für Schnappschuss und Anzeige). */
async function adressenZahlen(): Promise<{ gesamt: number; beiGoogle: number; nicht: number; ungeprueft: number; heute: number }> {
  const sqlPool = await db();
  const [r] = (await sqlPool`
    SELECT COUNT(*)::int AS gesamt,
           COUNT(*) FILTER (WHERE indexiert IS TRUE)::int AS bei_google,
           COUNT(*) FILTER (WHERE indexiert IS FALSE)::int AS nicht,
           COUNT(*) FILTER (WHERE indexiert IS NULL)::int AS ungeprueft,
           COUNT(*) FILTER (WHERE (zuletzt_geprueft AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute
      FROM fiaon_gsc_adressen WHERE in_sitemap`) as any[];
  return { gesamt: Number(r?.gesamt ?? 0), beiGoogle: Number(r?.bei_google ?? 0), nicht: Number(r?.nicht ?? 0), ungeprueft: Number(r?.ungeprueft ?? 0), heute: Number(r?.heute ?? 0) };
}

/** B1: die Index-Zahl des Tages aus dem API-Stand der Adresstabelle (nach der URL-Prüfung). */
async function indexStandMessen(jetzt: Date, mitStand: boolean): Promise<IndexStand> {
  const sqlPool = await db();
  const zeilen = (await sqlPool`
    SELECT indexiert, abdeckung, zuletzt_geprueft, letzter_crawl,
           ${mitStand ? sqlPool`to_char(sitemap_stand, 'YYYY-MM-DD')` : sqlPool`NULL::text`} AS stand
      FROM fiaon_gsc_adressen WHERE in_sitemap`) as any[];
  return {
    gemessenAm: jetzt.toISOString(),
    ...indexStandZaehlen(zeilen.map((z) => ({
      indexiert: z.indexiert == null ? null : Boolean(z.indexiert),
      abdeckung: z.abdeckung == null ? null : String(z.abdeckung),
      zuletztGeprueft: z.zuletzt_geprueft ? new Date(z.zuletzt_geprueft) : null,
      letzterCrawl: z.letzter_crawl ? new Date(z.letzter_crawl) : null,
      stand: z.stand == null ? null : String(z.stand),
    })), jetzt),
  };
}

export interface AbrufErgebnis { zustand: GscZustand; grund: string | null; code: string | null; pruefung: PruefLauf | null }

/** Einen Zustand ohne Daten ablegen — überschreibt nie einen guten Stand desselben Tages. */
async function zustandAblegen(tag: string, zustand: Exclude<GscZustand, "ok">, d: GoogleDeutung, vonHand: boolean): Promise<void> {
  const sqlPool = await db();
  await sqlPool`
    INSERT INTO fiaon_gsc_tage (tag, geholt_am, zustand, grund_code, grund, von_hand, eigenschaft)
    VALUES (${tag}, NOW(), ${zustand}, ${d.code}, ${d.grund}, ${vonHand}, ${GSC_EIGENSCHAFT})
    ON CONFLICT (tag) DO UPDATE SET geholt_am = NOW(), zustand = EXCLUDED.zustand, grund_code = EXCLUDED.grund_code,
      grund = EXCLUDED.grund, von_hand = EXCLUDED.von_hand
    WHERE fiaon_gsc_tage.zustand <> 'ok'`;
}

/**
 * Der ganze Abruf: Zahlen holen, Tag ablegen, Adressen prüfen.
 * Wirft nie wegen Google — das Ergebnis sagt, wie es ausging.
 */
export async function gscAbruf(opts: { vonHand?: boolean; jetzt?: Date; kandidaten?: Kandidat[] } = {}): Promise<AbrufErgebnis> {
  await ensureGscTabellen();
  const jetzt = opts.jetzt ?? new Date();
  const tag = berlinToday(jetzt);
  const vonHand = !!opts.vonHand;
  let daten: GscDaten;
  try {
    daten = await gscHolen(jetzt);
  } catch (e) {
    const d: GoogleDeutung = e instanceof GoogleAntwortFehler
      ? (e.deutung.zustand === "kontingent" ? { ...e.deutung, zustand: "fehler" } : e.deutung)
      : { zustand: "fehler", code: "netz", grund: `Google war nicht erreichbar: ${String((e as Error)?.message || e).slice(0, 160)}` };
    const zustand = d.zustand === "zugang_fehlt" ? "zugang_fehlt" : "fehler";
    await zustandAblegen(tag, zustand, d, vonHand);
    console.log(`[GSC] Abruf ohne Daten (${d.code}): ${d.grund}`);
    return { zustand, grund: d.grund, code: d.code, pruefung: null };
  }

  const sqlPool = await db();
  // E-530: Fehlen die neuen Spalten (DDL gescheitert), wird ohne sie geschrieben — die Kacheln kommen trotzdem.
  const mitSpalten = await gscSpalten();
  const schreiben = async (pruefung: unknown) => sqlPool`
    INSERT INTO fiaon_gsc_tage (tag, geholt_am, zustand, grund_code, grund, von_hand, eigenschaft,
                                zeitraum, summen, verlauf, anfragen, seiten, laender, geraete, sitemaps, pruefung
                                ${mitSpalten ? sqlPool`, klickarten` : sqlPool``})
    VALUES (${tag}, NOW(), 'ok', NULL, NULL, ${vonHand}, ${GSC_EIGENSCHAFT},
            ${j(daten.zeitraum)}::text::jsonb, ${j(daten.summen)}::text::jsonb, ${j(daten.verlauf)}::text::jsonb,
            ${j(daten.anfragen.slice(0, 500))}::text::jsonb, ${j(daten.seiten.slice(0, 100))}::text::jsonb, ${j(daten.laender)}::text::jsonb,
            ${j(daten.geraete)}::text::jsonb, ${j(daten.sitemaps)}::text::jsonb, ${j(pruefung)}::text::jsonb
            ${mitSpalten ? sqlPool`, ${j(daten.klickArten)}::text::jsonb` : sqlPool``})
    ON CONFLICT (tag) DO UPDATE SET geholt_am = NOW(), zustand = 'ok', grund_code = NULL, grund = NULL,
      von_hand = EXCLUDED.von_hand, eigenschaft = EXCLUDED.eigenschaft, zeitraum = EXCLUDED.zeitraum, summen = EXCLUDED.summen,
      verlauf = EXCLUDED.verlauf, anfragen = EXCLUDED.anfragen, seiten = EXCLUDED.seiten, laender = EXCLUDED.laender,
      geraete = EXCLUDED.geraete, sitemaps = EXCLUDED.sitemaps, pruefung = EXCLUDED.pruefung
      ${mitSpalten ? sqlPool`, klickarten = EXCLUDED.klickarten` : sqlPool``}`;
  // Erst die Zahlen ablegen — die URL-Prüfung dauert eine Minute, die Kacheln sollen nicht darauf warten.
  await schreiben(null);

  let pruefung: PruefLauf | null = null;
  try {
    const kandidaten = opts.kandidaten ?? await sitemapKandidaten();
    pruefung = await adressenPruefen(kandidaten, jetzt, mitSpalten);
  } catch (e) {
    pruefung = { geprueft: 0, fehler: 0, gestoppt: `URL-Prüfung gescheitert: ${String((e as Error)?.message || e).slice(0, 160)}`, budgetRest: 0 };
  }
  const stand = await adressenZahlen().catch(() => null);
  // B1: die Index-Zahl des Tages — auch wenn die Prüfung heute früh aufhörte (dann ist es der Stand von gestern plus heute).
  // Scheitert die Messung, bleibt ein schon abgelegter Stand desselben Tages stehen (COALESCE).
  const index = mitSpalten
    ? await indexStandMessen(new Date(), true).catch((e) => { console.error("[GSC] Index-Zahl:", String((e as Error)?.message || e).slice(0, 160)); return null; })
    : null;
  await sqlPool`UPDATE fiaon_gsc_tage SET pruefung = ${j({ ...pruefung, ...(stand ?? {}) })}::text::jsonb
    ${mitSpalten ? sqlPool`, index_stand = COALESCE(${index ? j(index) : null}::text::jsonb, index_stand)` : sqlPool``}
    WHERE tag = ${tag}`;
  console.log(`[GSC] Abruf abgelegt (${vonHand ? "von Hand" : "Tageslauf"}): ${daten.summen.jetzt.klicks} Klicks, `
    + `${pruefung.geprueft} Adressen geprüft${pruefung.gestoppt ? ` — ${pruefung.gestoppt}` : ""}`);
  return { zustand: "ok", grund: pruefung.gestoppt, code: null, pruefung };
}

// ── EIN Abruf zur Zeit in diesem Prozess (Tageslauf und Knopf teilen ihn) ──
let laufend: Promise<AbrufErgebnis> | null = null;
let handErgebnis: { am: string; ergebnis: AbrufErgebnis } | null = null;
export const gscLaeuft = () => laufend !== null;
export const gscHandErgebnis = () => handErgebnis;

export function gscAbrufEinmal(opts: { vonHand?: boolean; jetzt?: Date } = {}): Promise<AbrufErgebnis> {
  if (laufend) return laufend;
  laufend = gscAbruf(opts)
    .then((e) => { if (opts.vonHand) handErgebnis = { am: new Date().toISOString(), ergebnis: e }; return e; })
    .catch((e) => {
      const ergebnis: AbrufErgebnis = { zustand: "fehler", grund: String((e as Error)?.message || e).slice(0, 200), code: "intern", pruefung: null };
      if (opts.vonHand) handErgebnis = { am: new Date().toISOString(), ergebnis };
      throw e;
    })
    .finally(() => { laufend = null; });
  return laufend;
}

/**
 * Der Tageslauf (stündlicher Takt, nurMitErgebnis): ab 05:00 Berlin einmal am Tag.
 * Gibt true zurück, wenn er Daten geholt hat; nichts, wenn nichts zu tun war;
 * wirft, wenn Google nichts geliefert hat (Lauf-Ampel).
 */
export async function gscTageslauf(jetzt: Date = new Date()): Promise<boolean | undefined> {
  if (berlinStunde(jetzt) < FRUEH_STUNDE) return undefined;
  await ensureGscTabellen();
  const sqlPool = await db();
  const [heute] = (await sqlPool`SELECT zustand, geholt_am FROM fiaon_gsc_tage WHERE tag = ${berlinToday(jetzt)}`) as any[];
  if (heute?.zustand === "ok") return undefined;
  if (heute?.geholt_am && jetzt.getTime() - new Date(heute.geholt_am).getTime() < NEUVERSUCH_STUNDEN * 3_600_000) return undefined;
  const e = await gscAbrufEinmal({ vonHand: false, jetzt });
  if (e.zustand !== "ok") throw new Error(`Google Search Console ohne Daten: ${e.grund ?? e.zustand}`);
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// FÜR DAS CHEFBÜRO — liest nur aus der Datenbank
// ═══════════════════════════════════════════════════════════════════════════
const zeitText = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
/** jsonb tolerant lesen — auch alte doppelt verpackte Zeilen (E-377). */
const jsonLesen = (v: unknown) => {
  if (typeof v !== "string") return v ?? null;
  try { return JSON.parse(v); } catch { return null; }
};

export async function gscStand(): Promise<Record<string, unknown>> {
  await ensureGscTabellen();
  const sqlPool = await db();
  const [letzter] = (await sqlPool`
    SELECT tag, geholt_am, zustand, grund_code, grund, von_hand FROM fiaon_gsc_tage ORDER BY tag DESC LIMIT 1`) as any[];
  const [gut] = (await sqlPool`
    SELECT * FROM fiaon_gsc_tage WHERE zustand = 'ok' ORDER BY tag DESC LIMIT 1`) as any[];
  const neu = (await sqlPool`
    SELECT adresse, indexiert_seit, letzter_crawl FROM fiaon_gsc_adressen
     WHERE in_sitemap AND indexiert IS TRUE AND neu_beobachtet AND indexiert_seit > NOW() - INTERVAL '14 days'
     ORDER BY indexiert_seit DESC LIMIT 50`) as any[];
  const fehlt = (await sqlPool`
    SELECT adresse, prio, abdeckung, letzter_crawl, zuletzt_geprueft, pruef_link FROM fiaon_gsc_adressen
     WHERE in_sitemap AND indexiert IS FALSE
     ORDER BY prio DESC, adresse LIMIT 400`) as any[];
  const zahlen = await adressenZahlen();
  // B1: Index-Zahl je Tag (jüngste 30) — für „seit … +n“ und die Gründe. Ohne die neue Spalte: keine.
  const indexTage = (await gscSpalten())
    ? (await sqlPool`
        SELECT to_char(tag, 'YYYY-MM-DD') AS tag, index_stand FROM fiaon_gsc_tage
         WHERE index_stand IS NOT NULL ORDER BY tag DESC LIMIT 30`) as any[]
    : [];
  const indexVerlauf = indexTage
    .map((r) => ({ tag: String(r.tag), stand: jsonLesen(r.index_stand) as IndexStand | null }))
    .filter((r): r is { tag: string; stand: IndexStand } => !!r.stand && typeof r.stand === "object" && Number.isFinite(Number(r.stand.indexiert)));

  const anfragen = (jsonLesen(gut?.anfragen) as Eintrag[] | null) ?? [];
  return {
    eigenschaft: GSC_EIGENSCHAFT,
    zustand: letzter ? String(letzter.zustand) : "leer",
    grund: letzter?.grund ?? null,
    grundCode: letzter?.grund_code ?? null,
    letzterVersuch: zeitText(letzter?.geholt_am),
    stand: zeitText(gut?.geholt_am),
    zeitraum: jsonLesen(gut?.zeitraum),
    summen: jsonLesen(gut?.summen),
    verlauf: jsonLesen(gut?.verlauf) ?? [],
    fastSeiteEins: fastSeiteEins(anfragen).slice(0, 40),
    anfragen: anfragen.slice(0, 25),
    seiten: ((jsonLesen(gut?.seiten) as Eintrag[] | null) ?? []).slice(0, 25),
    laender: jsonLesen(gut?.laender) ?? [],
    geraete: jsonLesen(gut?.geraete) ?? [],
    sitemaps: jsonLesen(gut?.sitemaps) ?? [],
    pruefung: jsonLesen(gut?.pruefung),
    klickArten: jsonLesen(gut?.klickarten) ?? null,
    index: indexVerlauf[0]
      ? {
          tag: indexVerlauf[0].tag,
          ...indexVerlauf[0].stand,
          veraenderung: indexVeraenderung(indexVerlauf.map((r) => ({ tag: r.tag, indexiert: Number(r.stand.indexiert) }))),
        }
      : null,
    adressen: {
      ...zahlen,
      budget: PRUEF_TAGESBUDGET,
      neu: neu.map((r) => ({ adresse: String(r.adresse), seit: zeitText(r.indexiert_seit), crawl: zeitText(r.letzter_crawl) })),
      fehlt: fehlt.map((r) => ({
        adresse: String(r.adresse), prio: Number(r.prio), abdeckung: r.abdeckung ?? null,
        crawl: zeitText(r.letzter_crawl), geprueft: zeitText(r.zuletzt_geprueft), link: r.pruef_link ?? null,
      })),
    },
  };
}
