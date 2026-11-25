// ═══════════════════════════════════════════════════════════════════════════
// INDEXNOW — NEUE UND GEÄNDERTE SEITEN SOFORT AN BING MELDEN (27.10.2026, E-439)
//
// Bing (und Yandex, Seznam, Naver) nehmen Meldungen über IndexNow an; Bing speist
// die Websuche von ChatGPT und Copilot. Der Schlüssel liegt seit E-234 unter
// https://fiaon.com/<KEY>.txt (client/public). Automatisch gemeldet wird:
//   · nach jedem Start (= Deploy) jede indexierbare Seite und jeder Business-
//     Artikel, dessen Stand neuer ist als seine letzte ERFOLGREICHE Meldung,
//   · nach jedem veröffentlichten Tagesartikel genau dessen Adresse.
// Gemeldet wird nur im Betrieb: NODE_ENV=production, NICHT bei CRONS=aus (dieselbe
// Regel wie die Tagesläufe, fiaon-crons.ts — z. B. ein Server auf einer Datenkopie)
// und nicht bei INDEXNOW_AUS=1. Nie aus Prüfständen.
// Google nimmt IndexNow nicht an — dort zählen Sitemap und Search Console.
//
// ── E-530 B4 (25.11.2026): MIT PROTOKOLL ──────────────────────────────────
// Vorher: nach dem Start nur Seiten, deren Stand höchstens drei Tage alt war,
// und das Ergebnis stand nur im console.log. Ging eine Seite später als drei
// Tage nach ihrem Stand live, wurde sie nie gemeldet; scheiterte eine Meldung,
// merkte es niemand. Jetzt steht jede gemeldete Adresse mit Stand, Zeit und
// HTTP-Status in fiaon_indexnow_meldungen. Offen ist eine Seite, solange es zu
// ihrem Stand keine Meldung mit 2xx gibt — scheitert eine Meldung, bleibt sie
// offen. Wurde die letzte Meldung nach dem Start abgelehnt, setzt der nächste
// Start eine Pause lang aus (6 h, nach 429 „zu viele Anfragen“ 24 h): Sofort nach
// jedem Deploy oder Absturz-Neustart wieder alles zu schicken, verstärkt bei Bing
// das Spam-Signal. Höchstens 10.000 Adressen je Meldung (Grenze von IndexNow);
// nach einer Ablehnung gehen die weiteren Bündel desselben Starts nicht mehr raus.
// Chefbüro › Besucher › Google zeigt die letzte Meldung und wie viele Seiten offen
// sind (indexNowStand). Das Lesen fürs Chefbüro legt keine Tabelle an — gibt es
// das Protokoll noch nicht, ist eben noch nichts gemeldet.
//
// Die reinen Teile (Auswahl, Bündel, Pause) und das Melden gegen ein gefälschtes
// Netz prüft scripts/pruef-e530-korb-b.ts ohne Datenbank; die Datenbank-Teile
// prüft derselbe Prüfstand mit --db gegen eine lokale Datenbank.
// ═══════════════════════════════════════════════════════════════════════════
export const INDEXNOW_KEY = "21e00e2612ac8ff4d37a3caf4f087439";
const HOST = "fiaon.com";
/** Höchstens so viele Adressen in einer Meldung (Grenze von IndexNow). */
export const INDEXNOW_HOECHSTENS = 10_000;
/** Geht mit jeder Meldung nach dem Start mit — Seiten ohne eigenen Stand. */
export const INDEXNOW_BEIFANG = ["/sitemap.xml", "/llms.txt"] as const;
/** Anlass im Protokoll für die Meldung nach dem Start (die Pause schaut nur auf diese). */
export const INDEXNOW_ANLASS_START = "nach dem Start";
/** Nach einer abgelehnten Meldung nach dem Start so viele Stunden keine neue (bei 429 länger). */
export const INDEXNOW_PAUSE_STUNDEN = { fehler: 6, zuViele: 24 } as const;

export interface IndexNowSeite { pfad: string; stand: string }
export interface IndexNowErgebnis { am: string; anzahl: number; status: number | null; anlass: string }

// ═══════════════════════════════════════════════════════════════════════════
// REINE TEILE — ohne Netz, ohne Datenbank
// ═══════════════════════════════════════════════════════════════════════════

/** Meldet IndexNow Erfolg? 200 (angenommen) und 202 (angenommen, Schlüssel wird noch geprüft) — alles 2xx. */
export function indexNowErfolg(status: number | null | undefined): boolean {
  return typeof status === "number" && status >= 200 && status < 300;
}

/** Nur ein echtes Datum JJJJ-MM-TT zählt als Stand, sonst leer. */
export function standOderLeer(stand: unknown): string {
  const s = String(stand ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

/** Heute als JJJJ-MM-TT in UTC — dieselbe Rechnung wie „geaendert“ der Business-Artikel (toISOString). */
export const standHeute = (jetzt: Date = new Date()) => jetzt.toISOString().slice(0, 10);

/**
 * Was gemeldet werden muss: Seiten ohne erfolgreiche Meldung, und Seiten, deren
 * Stand neuer ist als der Stand ihrer letzten erfolgreichen Meldung. Je Pfad
 * einmal (höchster Stand), neuester Stand zuerst.
 * `gemeldet`: Pfad → Stand der letzten Meldung mit 2xx.
 */
export function indexNowOffen(seiten: IndexNowSeite[], gemeldet: Map<string, string>): IndexNowSeite[] {
  const je = new Map<string, string>();
  for (const s of seiten) {
    const pfad = String(s?.pfad ?? "").trim();
    if (!pfad) continue;
    const stand = standOderLeer(s.stand);
    const alt = je.get(pfad);
    if (alt === undefined || stand > alt) je.set(pfad, stand);
  }
  const offen: IndexNowSeite[] = [];
  for (const [pfad, stand] of Array.from(je)) {
    const zuletzt = gemeldet.get(pfad);
    if (zuletzt === undefined || stand > standOderLeer(zuletzt)) offen.push({ pfad, stand });
  }
  return offen.sort((a, b) => (a.stand === b.stand ? a.pfad.localeCompare(b.pfad) : a.stand < b.stand ? 1 : -1));
}

/**
 * 29.10.2026 (E-461): /business und /en/business leiten per 301 auf / und /en —
 * ist die Startseite offen, gehen die alten Adressen mit (Bing sieht die 301 sonst
 * erst beim nächsten regulären Besuch).
 */
export function indexNowMitUmzug(offen: IndexNowSeite[]): IndexNowSeite[] {
  const start = offen.find((s) => s.pfad === "/");
  if (!start) return offen;
  const da = new Set(offen.map((s) => s.pfad));
  return [...offen, ...["/business", "/en/business"].filter((p) => !da.has(p)).map((pfad) => ({ pfad, stand: start.stand }))];
}

/**
 * In Meldungen zu höchstens `max` Adressen teilen. Der Beifang (Sitemap, llms.txt)
 * geht nur mit der ersten Meldung mit und zählt zur Grenze. Nichts offen → keine Meldung.
 */
export function indexNowBuendel(offen: IndexNowSeite[], beifang: IndexNowSeite[], max = INDEXNOW_HOECHSTENS): IndexNowSeite[][] {
  if (!offen.length || max < 1) return [];
  const bei = beifang.slice(0, Math.max(0, max - 1));
  const buendel: IndexNowSeite[][] = [];
  let rest = offen;
  let erste = true;
  while (rest.length) {
    const platz = erste ? max - bei.length : max;
    buendel.push(erste ? [...rest.slice(0, platz), ...bei] : rest.slice(0, platz));
    rest = rest.slice(platz);
    erste = false;
  }
  return buendel;
}

/** Pfad → volle Adresse auf fiaon.com (volle Adressen bleiben, wie sie sind). */
export function indexNowAdresse(pfad: string): string {
  return pfad.startsWith("http") ? pfad : `https://${HOST}${pfad.startsWith("/") ? "" : "/"}${pfad}`;
}

/**
 * Soll der Start diesmal aussetzen? Nur wenn die letzte Meldung nach dem Start NICHT
 * angenommen wurde (kein 2xx oder keine Antwort) und jünger ist als die Pause —
 * 6 Stunden, nach 429 („zu viele Anfragen“) 24 Stunden. Gibt das Ende der Pause
 * zurück, sonst null.
 */
export function indexNowPause(letzte: { am: string | Date; status: number | null } | null, jetzt: Date = new Date()): Date | null {
  if (!letzte || indexNowErfolg(letzte.status)) return null;
  const am = new Date(letzte.am).getTime();
  if (!Number.isFinite(am)) return null;
  const stunden = letzte.status === 429 ? INDEXNOW_PAUSE_STUNDEN.zuViele : INDEXNOW_PAUSE_STUNDEN.fehler;
  const bis = am + stunden * 3_600_000;
  return jetzt.getTime() < bis ? new Date(bis) : null;
}

/**
 * Warum meldet dieser Prozess nicht? null = er meldet. Dieselbe Regel wie die
 * Tagesläufe (fiaon-crons.ts): Betrieb heißt NODE_ENV=production, und CRONS=aus
 * schaltet auch dort ab. Zur Laufzeit gelesen (Prüfstände schalten um).
 */
export function indexNowAus(): "ausgeschaltet" | "nur im Betrieb" | null {
  if (process.env.NODE_ENV !== "production") return "nur im Betrieb";
  if (String(process.env.CRONS || "").toLowerCase() === "aus" || process.env.INDEXNOW_AUS === "1") return "ausgeschaltet";
  return null;
}

/** Meldet dieser Prozess überhaupt? */
export const indexNowAktiv = () => indexNowAus() === null;

// ═══════════════════════════════════════════════════════════════════════════
// DATENBANK — nur innerhalb der Funktionen geladen
// ═══════════════════════════════════════════════════════════════════════════
async function db() { return (await import("./db-pool")).sqlPool; }

let bereit: Promise<void> | null = null;
/** Die Protokoll-Tabelle — beim ersten Melden angelegt (die DDL-Wache sieht vorher im Katalog nach). */
export function ensureIndexNowTabelle(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const sqlPool = await db();
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_indexnow_meldungen (
          id           BIGSERIAL PRIMARY KEY,
          pfad         TEXT NOT NULL,
          stand        DATE,
          gemeldet_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          http_status  INTEGER,
          anlass       VARCHAR(40) NOT NULL,
          fehler       TEXT
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_indexnow_meldungen_pfad ON fiaon_indexnow_meldungen (pfad, stand)`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_indexnow_meldungen_am ON fiaon_indexnow_meldungen (gemeldet_am DESC)`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

/** Gibt es das Protokoll schon? Liest nur den Katalog (keine Sperre, keine DDL). */
async function tabelleDa(): Promise<boolean> {
  const sqlPool = await db();
  const [r] = (await sqlPool`SELECT to_regclass('public.fiaon_indexnow_meldungen') IS NOT NULL AS da`) as any[];
  return r?.da === true;
}

/** Pfad → Stand der letzten ERFOLGREICHEN Meldung (2xx). Die Tabelle muss da sein. */
export async function indexNowLetzteErfolge(): Promise<Map<string, string>> {
  const sqlPool = await db();
  const zeilen = (await sqlPool`
    SELECT pfad, COALESCE(to_char(MAX(stand), 'YYYY-MM-DD'), '') AS stand FROM fiaon_indexnow_meldungen
     WHERE http_status BETWEEN 200 AND 299 GROUP BY pfad`) as any[];
  return new Map(zeilen.map((z) => [String(z.pfad), String(z.stand ?? "")]));
}

/** Die letzte Meldung nach dem Start (für die Pause). Die Tabelle muss da sein. */
async function letzteStartMeldung(): Promise<{ am: string; status: number | null } | null> {
  const sqlPool = await db();
  const [r] = (await sqlPool`
    SELECT gemeldet_am, http_status FROM fiaon_indexnow_meldungen
     WHERE anlass = ${INDEXNOW_ANLASS_START} ORDER BY gemeldet_am DESC LIMIT 1`) as any[];
  return r ? { am: new Date(r.gemeldet_am).toISOString(), status: r.http_status == null ? null : Number(r.http_status) } : null;
}

/** Jede Adresse einer Meldung mit derselben Zeit — so lässt sich die Meldung später zusammenzählen. */
async function protokollieren(seiten: IndexNowSeite[], status: number | null, anlass: string, am: Date, fehler: string | null): Promise<void> {
  if (!seiten.length) return;
  await ensureIndexNowTabelle();
  const sqlPool = await db();
  const pfade = seiten.map((s) => s.pfad);
  // Leerer Text statt null im Feld — NULLIF macht daraus in SQL ein echtes NULL.
  const staende = seiten.map((s) => standOderLeer(s.stand));
  await sqlPool`
    INSERT INTO fiaon_indexnow_meldungen (pfad, stand, gemeldet_am, http_status, anlass, fehler)
    SELECT p, NULLIF(s, '')::date, ${am.toISOString()}::timestamptz, ${status}::int, ${anlass.slice(0, 40)}::text, ${fehler ? fehler.slice(0, 300) : null}::text
      FROM unnest(${pfade}::text[], ${staende}::text[]) AS x(p, s)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// MELDEN
// ═══════════════════════════════════════════════════════════════════════════

/** Austauschbar nur für Prüfstände (gefälschtes IndexNow, Protokoll ohne Datenbank). */
export const indexNowTechnik: { fetch: typeof fetch; protokoll: typeof protokollieren } = {
  fetch: (...a: Parameters<typeof fetch>) => fetch(...a),
  protokoll: (...a: Parameters<typeof protokollieren>) => protokollieren(...a),
};

/** „Offen“ fürs Chefbüro, 60 s im Speicher (die Seite fragt während eines Abrufs alle 4 s). */
let offenSpeicher: { bis: number; wert: number | null } | null = null;

/**
 * EINE Meldung an IndexNow (höchstens 10.000 Adressen) und ihr Protokoll.
 * Pfade ohne Stand (z. B. der Tagesartikel) bekommen den heutigen Tag.
 * Wirft nie; null = nicht im Betrieb oder nichts zu melden.
 */
export async function indexNowMelden(pfade: (string | IndexNowSeite)[], anlass: string): Promise<IndexNowErgebnis | null> {
  if (!indexNowAktiv()) return null;
  const heute = standHeute();
  const gesehen = new Set<string>();
  const seiten: IndexNowSeite[] = [];
  for (const p of pfade) {
    const s = typeof p === "string" ? { pfad: p, stand: heute } : { pfad: p.pfad, stand: standOderLeer(p.stand) || heute };
    if (!s.pfad || gesehen.has(indexNowAdresse(s.pfad))) continue;
    gesehen.add(indexNowAdresse(s.pfad));
    seiten.push(s);
  }
  const auswahl = seiten.slice(0, INDEXNOW_HOECHSTENS);
  if (!auswahl.length) return null;
  const am = new Date();
  let status: number | null = null;
  let fehler: string | null = null;
  try {
    const r = await indexNowTechnik.fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: INDEXNOW_KEY, keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`, urlList: auswahl.map((s) => indexNowAdresse(s.pfad)) }),
      signal: AbortSignal.timeout(15_000),
    });
    status = r.status;
    if (!indexNowErfolg(status)) fehler = (await r.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200) || `HTTP ${status}`;
    console.log(`[INDEXNOW] ${anlass}: ${auswahl.length} Adresse(n) gemeldet → ${status}`);
  } catch (e) {
    fehler = String((e as Error)?.message || e).slice(0, 200);
    console.error(`[INDEXNOW] ${anlass}:`, fehler);
  }
  await indexNowTechnik.protokoll(auswahl, status, anlass, am, fehler)
    .catch((e) => console.error("[INDEXNOW] Protokoll:", String((e as Error)?.message || e).slice(0, 160)));
  offenSpeicher = null;
  return { am: am.toISOString(), anzahl: auswahl.length, status, anlass };
}

/**
 * Alle Seiten mit Stand: indexierbare Seiten (inklusive Business-Seiten) und Business-Artikel.
 * ausSpeicher: die Artikel aus der 5-Minuten-Liste nehmen (Chefbüro), nur wenn sie leer ist neu laden.
 */
async function indexNowKandidaten(ausSpeicher = false): Promise<IndexNowSeite[]> {
  const { seoIndexierbar } = await import("@shared/fiaon-seo-seiten");
  await import("./fiaon-global-seo"); // trägt die Business-Seiten in die Tabelle ein
  const { businessArtikel, businessArtikelLaden } = await import("./fiaon-business-artikel-liste");
  const { businessArtikelPfad } = await import("@shared/fiaon-business-artikel");
  const seiten = seoIndexierbar().map((s) => ({ pfad: s.pfad, stand: s.stand }));
  const gespeichert = ausSpeicher ? businessArtikel() : [];
  const liste = gespeichert.length ? gespeichert : await businessArtikelLaden();
  const artikel = liste.map((a) => ({ pfad: businessArtikelPfad(a.slug, a.sprache), stand: a.geaendert }));
  return [...seiten, ...artikel];
}

/** Nach dem Start: alles melden, was neuer ist als seine letzte erfolgreiche Meldung — außer in der Pause. */
export async function indexNowNachStart(jetzt: Date = new Date()): Promise<void> {
  if (!indexNowAktiv()) return;
  let offen: IndexNowSeite[];
  try {
    await ensureIndexNowTabelle();
    const pause = indexNowPause(await letzteStartMeldung(), jetzt);
    if (pause) {
      console.log(`[INDEXNOW] nach dem Start: Pause nach abgelehnter Meldung bis ${pause.toISOString()} — diesmal nichts gemeldet.`);
      return;
    }
    offen = indexNowMitUmzug(indexNowOffen(await indexNowKandidaten(), await indexNowLetzteErfolge()));
  } catch (e) {
    // Ohne Protokoll wissen wir nicht, was offen ist — der nächste Start versucht es wieder.
    console.error("[INDEXNOW] nach dem Start, Auswahl:", String((e as Error)?.message || e).slice(0, 160));
    return;
  }
  if (!offen.length) { console.log("[INDEXNOW] nach dem Start: nichts offen."); return; }
  const beifang = INDEXNOW_BEIFANG.map((pfad) => ({ pfad, stand: standHeute() }));
  for (const b of indexNowBuendel(offen, beifang)) {
    const r = await indexNowMelden(b, INDEXNOW_ANLASS_START);
    // Abgelehnt → die weiteren Bündel nicht hinterherschicken; der nächste Start nach der Pause holt sie nach.
    if (!r || !indexNowErfolg(r.status)) break;
  }
}

export interface IndexNowStand {
  aktiv: boolean;
  /** Warum hier nicht gemeldet wird („ausgeschaltet“ / „nur im Betrieb“), sonst null. */
  aus: "ausgeschaltet" | "nur im Betrieb" | null;
  letzte: IndexNowErgebnis | null;
  offen: number | null;
  letzterErfolg: string | null;
  /** Bis wann der nächste Start nach einer Ablehnung aussetzt, sonst null. */
  pauseBis: string | null;
}

/**
 * Für das Chefbüro: letzte Meldung, letzte angenommene, Pause und wie viele Seiten
 * noch offen sind. Liest nur — legt auch keine Tabelle an.
 */
export async function indexNowStand(jetzt: Date = new Date()): Promise<IndexNowStand> {
  const aus = indexNowAus();
  const da = await tabelleDa();
  let letzte: IndexNowErgebnis | null = null;
  let letzterErfolg: string | null = null;
  let pauseBis: string | null = null;
  if (da) {
    const sqlPool = await db();
    // Eine Meldung = alle Zeilen mit derselben Zeit (protokollieren schreibt sie so).
    const [l] = (await sqlPool`
      SELECT gemeldet_am, anlass, http_status, COUNT(*)::int AS anzahl FROM fiaon_indexnow_meldungen
       WHERE gemeldet_am = (SELECT MAX(gemeldet_am) FROM fiaon_indexnow_meldungen)
       GROUP BY gemeldet_am, anlass, http_status ORDER BY COUNT(*) DESC LIMIT 1`) as any[];
    const [erfolg] = (await sqlPool`
      SELECT MAX(gemeldet_am) AS am FROM fiaon_indexnow_meldungen WHERE http_status BETWEEN 200 AND 299`) as any[];
    letzte = l
      ? { am: new Date(l.gemeldet_am).toISOString(), anzahl: Number(l.anzahl), status: l.http_status == null ? null : Number(l.http_status), anlass: String(l.anlass) }
      : null;
    letzterErfolg = erfolg?.am ? new Date(erfolg.am).toISOString() : null;
    pauseBis = indexNowPause(await letzteStartMeldung(), jetzt)?.toISOString() ?? null;
  }
  if (!offenSpeicher || offenSpeicher.bis < Date.now()) {
    let wert: number | null;
    try {
      wert = indexNowMitUmzug(indexNowOffen(await indexNowKandidaten(true), da ? await indexNowLetzteErfolge() : new Map())).length;
    } catch { wert = null; }
    offenSpeicher = { bis: Date.now() + 60_000, wert };
  }
  return { aktiv: aus === null, aus, letzte, offen: offenSpeicher.wert, letzterErfolg, pauseBis };
}
