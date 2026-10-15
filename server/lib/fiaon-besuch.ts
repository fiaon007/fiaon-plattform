// ═══════════════════════════════════════════════════════════════════════════
// EIGENE BESUCHERMESSUNG — SERVER (15.10.2026, E-378)
//
// Justin: „Besucher hat nie funktioniert … ich brauche super detaillierte
// Aufschlüsselungen." Die Regeln (Pfad, Roboter, Kanal, Nutzlast) stehen rein in
// shared/fiaon-besuch.ts; hier steht, was eine Datenbank braucht:
//
//   1. WER IST EIN BESUCHER? — besucher = SHA-256(Tages-Salz, IP, Browserkennung,
//      Host), gekürzt auf 16 Zeichen. Wie Plausible: Das Salz gilt einen Berliner
//      Tag und wird beim Wechsel gelöscht (fiaon_besuch_salz hält nur heute). Die
//      IP fließt nur in den Hash und wird nirgends gespeichert. Folge, ehrlich
//      gesagt: Wer an zwei Tagen kommt, zählt zweimal — „Besucher" heißt
//      „Besucher je Tag, zusammengezählt".
//   2. WAS IST EINE SITZUNG? — derselbe Besucher mit Pausen unter 30 Minuten.
//      Seitenaufrufe, das Ende einer Seite (sichtbare Zeit) und jeder Schritt im
//      Antrag halten sie wach.
//   3. WOHER KAM DER ANTRAG? — Der Antrag misst sich selbst (fiaon_antrag_ereignisse,
//      Zufallskennung je Tab). Kommt sein erstes Ereignis an, rechnet der Server
//      für DIESELBE Anfrage denselben Besucher-Hash und hängt die Antrags-Sitzung an
//      die laufende Besuchs-Sitzung (fiaon_besuch_antraege). Daraus wird der Trichter
//      Besuch → Antrag geöffnet → angelegt → abgeschickt → bezahlt, nach Kanal,
//      Kampagne, Einstiegsseite und Gerät.
//      · Ein Antrag zählt für die Sitzung, in der er zuerst auftauchte (Erstkontakt) —
//        kommt jemand am nächsten Tag zurück, zählt der Kauf nicht doppelt.
//      · „abgeschickt" ist die Hausregel abgeschicktSql (shared/fiaon-antrag-stand.ts),
//        „bezahlt" und Umsatz kommen aus UMSATZ_QUELLE_SQL (E-343) — nie amount_due.
//   4. INTERN ZÄHLT NICHT — wer ein Chefbüro- oder Mitarbeiter-Cookie mitbringt, ist
//      Team, kein Besucher. Roboter (Browserkennung) ebenso. Und wer „Global Privacy
//      Control" oder „Do Not Track" schickt, widerspricht — er wird nicht gemessen.
//   5. GERÄT, SPRACHE, LAND kommen aus den Kopfzeilen (Browserkennung, Accept-Language,
//      cf-ipcountry von Cloudflare) — das Skript im Browser liest davon nichts aus.
// ═══════════════════════════════════════════════════════════════════════════
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Request } from "express";
import { sqlPool } from "./db-pool";
import { berlinToday, berlinZeitpunkt } from "./fiaon-time";
import { aufrufClientIp, ortAus } from "./fiaon-global-angebot-aufrufe";
import { UMSATZ_QUELLE_SQL } from "./fiaon-umsatz-quelle";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";
import {
  ANTRAG_PFADE, OHNE, besuchKanal, besuchPfad, geraetAusKennung, istBesuchRoboter, spracheKurz,
  type BesuchFilter, type BesuchFilterSchluessel, type BesuchNutzlast,
} from "@shared/fiaon-besuch";

type Lauf = typeof sqlPool;

/** Pause, nach der eine neue Sitzung beginnt. */
export const SITZUNG_PAUSE_MIN = 30;
/** Löschfrist der Messung. */
export const BESUCH_AUFBEWAHRUNG_TAGE = 400;

// ── Tabellen ────────────────────────────────────────────────────────────────
let bereit: Promise<void> | null = null;
export function ensureBesuchTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      const r = (await sqlPool`SELECT to_regclass('public.fiaon_besuch_antraege') AS t`) as any[];
      if (r[0]?.t) return;
      const datei = path.resolve(process.cwd(), "db", "migrations", "108_besuche.sql");
      // SET ohne LOCAL bliebe an der Verbindung des Pools hängen — hier nur für diese Transaktion.
      const text = readFileSync(datei, "utf8").replace(/^SET lock_timeout\b/m, "SET LOCAL lock_timeout");
      await sqlPool.begin(async (tx: any) => {
        await tx`SET LOCAL lock_timeout = '3s'`;
        await tx.unsafe(text);
      });
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

// ── Der Besucher-Hash ───────────────────────────────────────────────────────
/** Rein: derselbe Mensch am selben Tag → derselbe Hash; anderes Salz → anderer Hash. Die IP steckt nicht lesbar drin. */
export function besucherHash(salz: string, ip: string, ua: string, wirt: string): string {
  return createHash("sha256")
    .update(salz).update("\u0000").update(ip).update("\u0000").update(ua.slice(0, 600)).update("\u0000").update(wirt.toLowerCase())
    .digest("hex").slice(0, 16);
}

let salzSpeicher: { tag: string; salz: string } | null = null;
let salzUnterwegs: Promise<{ tag: string; salz: string }> | null = null;

/**
 * Das Salz des Berliner Tages. Mehrere Instanzen (beim Deploy laufen zwei) teilen es über die Tabelle:
 * Wer zuerst kommt, legt es an, alle lesen dasselbe. Beim Tageswechsel wird das alte gelöscht.
 */
export async function tagesSalz(lauf: Lauf = sqlPool, heute: string = berlinToday()): Promise<{ tag: string; salz: string }> {
  if (salzSpeicher?.tag === heute) return salzSpeicher;
  if (salzUnterwegs) return salzUnterwegs;
  salzUnterwegs = (async () => {
    await ensureBesuchTabellen();
    await lauf`INSERT INTO fiaon_besuch_salz (tag, salz) VALUES (${heute}, ${randomBytes(32).toString("hex")}) ON CONFLICT (tag) DO NOTHING`;
    const [z] = (await lauf`SELECT salz FROM fiaon_besuch_salz WHERE tag = ${heute}`) as any[];
    // Gestern ist vorbei: Ohne das Salz lässt sich kein Hash mehr einem Anschluss zuordnen.
    await lauf`DELETE FROM fiaon_besuch_salz WHERE tag < ${heute}`;
    salzSpeicher = { tag: heute, salz: String(z.salz) };
    return salzSpeicher;
  })().finally(() => { salzUnterwegs = null; });
  return salzUnterwegs;
}

type KopfReq = Pick<Request, "headers"> & { socket?: { remoteAddress?: string | null } | null; hostname?: string };
const kopf = (req: KopfReq, name: string): string => {
  const v = req.headers[name];
  return String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
};
/** Der Host der Anfrage (ohne Port) — gehört in den Hash, damit fiaon.com und die Render-Adresse getrennt bleiben. */
export function anfrageWirt(req: KopfReq): string {
  return (kopf(req, "x-forwarded-host") || kopf(req, "host") || String(req.hostname || "")).split(",")[0].trim().replace(/:\d+$/, "").toLowerCase();
}

/** Der Besucher dieser Anfrage. Die IP wird gelesen, gehasht und vergessen. */
export async function besucherKennung(req: KopfReq, lauf: Lauf = sqlPool): Promise<string> {
  const { salz } = await tagesSalz(lauf);
  return besucherHash(salz, aufrufClientIp(req as any), kopf(req, "user-agent"), anfrageWirt(req));
}

/** Team statt Besucher: Chefbüro-, alte Admin- oder Mitarbeiter-Sitzung im Cookie. */
export function istTeamAnfrage(req: KopfReq): boolean {
  return /(^|;\s*)(fiaon_chef|fiaon_admin|fiaon_agent_token)=/.test(kopf(req, "cookie"));
}

/**
 * Kein Besuch: Roboter, Team — oder ein Mensch, der widerspricht. „Global Privacy Control" und „Do Not Track"
 * sind der Widerspruch (Art. 21 DSGVO), den die Datenschutzerklärung III a nennt: Wer sie schickt, wird nicht gemessen.
 */
export function besuchZaehltNicht(req: KopfReq): "roboter" | "team" | "widerspruch" | null {
  if (istBesuchRoboter(kopf(req, "user-agent"))) return "roboter";
  if (istTeamAnfrage(req)) return "team";
  if (kopf(req, "sec-gpc") === "1" || kopf(req, "dnt") === "1") return "widerspruch";
  return null;
}

// ── Aufnehmen ───────────────────────────────────────────────────────────────
/**
 * Ein Seitenaufruf. Gibt die Sitzung zurück — oder null, wenn der Pfad nicht zählt.
 * Die laufende Sitzung des Besuchers (letzte Bewegung vor weniger als 30 Minuten) wird fortgesetzt,
 * sonst beginnt eine neue mit allem, was ihren Ursprung ausmacht.
 */
export async function besuchAufnehmen(req: KopfReq, n: BesuchNutzlast, lauf: Lauf = sqlPool): Promise<{ sitzung: string; neu: boolean } | null> {
  const pfad = besuchPfad(n.pfad);
  if (!pfad) return null;
  await ensureBesuchTabellen();
  const besucher = await besucherKennung(req, lauf);
  const istAntrag = (ANTRAG_PFADE as readonly string[]).includes(pfad);
  const [alt] = (await lauf`
    SELECT sitzung FROM fiaon_besuch_sitzungen
     WHERE besucher = ${besucher} AND zuletzt > NOW() - make_interval(mins => ${SITZUNG_PAUSE_MIN})
     ORDER BY zuletzt DESC LIMIT 1`) as any[];
  if (alt) {
    await lauf`
      UPDATE fiaon_besuch_sitzungen
         SET seiten = seiten + 1, zuletzt = NOW(), ausstieg = ${pfad}, antrag = antrag OR ${istAntrag}
       WHERE sitzung = ${alt.sitzung}`;
    await lauf`INSERT INTO fiaon_besuche (sitzung, pfad, erste) VALUES (${alt.sitzung}, ${pfad}, FALSE)`;
    return { sitzung: String(alt.sitzung), neu: false };
  }
  const sitzung = randomBytes(8).toString("hex");
  const k = n.kampagne;
  const kanal = besuchKanal({ herkunft: n.herkunft, kampagne: k, fbclid: n.fbclid, gclid: n.gclid });
  await lauf`
    INSERT INTO fiaon_besuch_sitzungen (
      sitzung, besucher, einstieg, ausstieg, antrag, kanal, herkunft,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, geraet, sprache, land)
    VALUES (
      ${sitzung}, ${besucher}, ${pfad}, ${pfad}, ${istAntrag}, ${kanal}, ${n.herkunft},
      ${k.source}, ${k.medium}, ${k.campaign}, ${k.content}, ${k.term}, ${n.fbclid}, ${n.gclid},
      ${geraetAusKennung(kopf(req, "user-agent"))}, ${spracheKurz(kopf(req, "accept-language"))}, ${ortAus(req.headers as any).land})`;
  await lauf`INSERT INTO fiaon_besuche (sitzung, pfad, erste) VALUES (${sitzung}, ${pfad}, TRUE)`;
  return { sitzung, neu: true };
}

/**
 * Das Ende einer Seite: die sichtbare Zeit, aufsummiert vom Browser (jede Meldung trägt die ganze bisherige
 * Zeit — eine doppelte oder verspätete Meldung macht nichts kaputt, es zählt die größte). Die Sitzung bekommt
 * nur den Zuwachs und bleibt wach.
 */
export async function besuchEnde(req: KopfReq, n: BesuchNutzlast, lauf: Lauf = sqlPool): Promise<boolean> {
  const pfad = besuchPfad(n.pfad);
  if (!pfad || n.ms == null) return false;
  await ensureBesuchTabellen();
  const besucher = await besucherKennung(req, lauf);
  const r = (await lauf`
    WITH s AS (
      SELECT sitzung FROM fiaon_besuch_sitzungen
       WHERE besucher = ${besucher} AND zuletzt > NOW() - INTERVAL '6 hours'
       ORDER BY zuletzt DESC LIMIT 1),
    b AS (
      SELECT b.id, COALESCE(b.dauer_ms, 0) AS vorher
        FROM fiaon_besuche b JOIN s ON s.sitzung = b.sitzung
       WHERE b.pfad = ${pfad}
       ORDER BY b.am DESC LIMIT 1),
    u AS (
      UPDATE fiaon_besuche x SET dauer_ms = GREATEST(b.vorher, ${n.ms}::int)
        FROM b WHERE x.id = b.id
      RETURNING x.sitzung, GREATEST(b.vorher, ${n.ms}::int) - b.vorher AS plus)
    UPDATE fiaon_besuch_sitzungen z
       SET dauer_ms = z.dauer_ms + u.plus, zuletzt = GREATEST(z.zuletzt, NOW())
      FROM u WHERE z.sitzung = u.sitzung
    RETURNING z.sitzung`) as any[];
  return r.length > 0;
}

// ── Die Brücke zum Antrag ───────────────────────────────────────────────────
const verknuepft = new Map<string, number>();

/**
 * Aus /antrag-neu/ereignis (beide Wege): Die Antrags-Sitzung gehört zur laufenden Besuchs-Sitzung desselben
 * Besuchers. Jeder Antragsschritt hält die Besuchs-Sitzung wach — wer zwanzig Minuten im Formular steht,
 * ist noch da. Ohne Besuchs-Sitzung (Messung kam noch nicht an): nichts, der nächste Stapel versucht es wieder.
 */
export async function antragBesuchVerknuepfen(req: KopfReq, antragSitzung: string, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!/^[a-z0-9]{8,40}$/i.test(antragSitzung)) return null;
  if (besuchZaehltNicht(req)) return null;
  await ensureBesuchTabellen();
  const besucher = await besucherKennung(req, lauf);
  const [s] = (await lauf`
    UPDATE fiaon_besuch_sitzungen SET zuletzt = GREATEST(zuletzt, NOW())
     WHERE sitzung = (
       SELECT sitzung FROM fiaon_besuch_sitzungen
        WHERE besucher = ${besucher} AND zuletzt > NOW() - INTERVAL '6 hours'
        ORDER BY zuletzt DESC LIMIT 1)
    RETURNING sitzung`) as any[];
  if (!s) return null;
  const schluessel = `${s.sitzung}:${antragSitzung}`;
  if (!verknuepft.has(schluessel)) {
    await lauf`
      INSERT INTO fiaon_besuch_antraege (sitzung, antrag_sitzung) VALUES (${s.sitzung}, ${antragSitzung})
      ON CONFLICT DO NOTHING`;
    verknuepft.set(schluessel, Date.now());
    if (verknuepft.size > 5000) for (const k of Array.from(verknuepft.keys()).slice(0, 1000)) verknuepft.delete(k);
  }
  return String(s.sitzung);
}

// ── Aufräumen ───────────────────────────────────────────────────────────────
/** Löschfrist 400 Tage, in Stapeln über die Zeit-Indizes. Das Salz räumt tagesSalz selbst. */
export async function besuchAufraeumen(lauf: Lauf = sqlPool): Promise<number> {
  await ensureBesuchTabellen();
  const grenze = new Date(Date.now() - BESUCH_AUFBEWAHRUNG_TAGE * 864e5);
  let n = 0;
  for (let runde = 0; runde < 200; runde++) {
    const z = (await lauf`
      DELETE FROM fiaon_besuche WHERE id IN (SELECT id FROM fiaon_besuche WHERE am < ${grenze} ORDER BY am LIMIT 5000)
      RETURNING id`) as any[];
    n += z.length;
    if (z.length < 5000) break;
  }
  for (let runde = 0; runde < 200; runde++) {
    const z = (await lauf`
      DELETE FROM fiaon_besuch_sitzungen
       WHERE sitzung IN (SELECT sitzung FROM fiaon_besuch_sitzungen WHERE start < ${grenze} ORDER BY start LIMIT 5000)
      RETURNING sitzung`) as any[];
    n += z.length;
    if (z.length < 5000) break;
  }
  const z = (await lauf`DELETE FROM fiaon_besuch_antraege WHERE am < ${grenze} RETURNING sitzung`) as any[];
  return n + z.length;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AUSWERTUNG — alles in SQL, in EINEM Durchgang über die Sitzungen
//
// BESUCHER OHNE COUNT(DISTINCT): Jede Sitzung trägt „erster" = die erste Sitzung dieses
// Besuchers an diesem Tag (innerhalb der gefilterten Sitzungen). Die Summe davon ist für
// den Kopf und jeden Tag genau die Zahl verschiedener Besucher; in einer Rangliste zählt
// ein Besucher dort, wo sein erster Besuch des Tages lag. Gemessen mit 150.000 Sitzungen
// über 90 Tage: COUNT(DISTINCT) je Gruppe brauchte 8,8 s, so sind es Bruchteile davon.
//
// Jede Rangliste der Seite (Kanal, Herkunft, Kampagne, Einstieg, Gerät …), der
// Verlauf, die Wochen-Stunden-Karte und die Kopfzahlen sind dieselbe Rechnung,
// nur anders gruppiert. GROUPING SETS rechnet sie in einem Durchgang — und weil
// es EINE Rechnung ist, stimmen die Zahlen zwischen den Tafeln überein.
// ═══════════════════════════════════════════════════════════════════════════
export interface BesuchBereich { von: string; bis: string; tage: number; stunden: boolean }

/** ISO-Tag plus n Tage — reine Kalenderrechnung über UTC-Mittag (keine Uhrzeit, keine Sommerzeit). */
export function tagPlus(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}
function tageZwischen(von: string, bis: string): number {
  const a = Date.UTC(+von.slice(0, 4), +von.slice(5, 7) - 1, +von.slice(8, 10));
  const b = Date.UTC(+bis.slice(0, 4), +bis.slice(5, 7) - 1, +bis.slice(8, 10));
  return Math.round((b - a) / 864e5) + 1;
}

/** Aus „heute | gestern | 7 | 30 | 90 | eigen" den Zeitraum (Berliner Tage, beide einschließlich). Rein. */
export function besuchBereich(z: string, vonRoh?: unknown, bisRoh?: unknown, heute: string = berlinToday()): BesuchBereich {
  const iso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
  let von = heute, bis = heute;
  if (z === "gestern") { von = bis = tagPlus(heute, -1); }
  else if (z === "7" || z === "30" || z === "90") { von = tagPlus(heute, -(Number(z) - 1)); }
  else if (z === "eigen") {
    const a = iso(vonRoh), b = iso(bisRoh);
    if (a && b) {
      von = a <= b ? a : b; bis = a <= b ? b : a;
      if (bis > heute) bis = heute;
      if (von > bis) von = bis;
      if (tageZwischen(von, bis) > BESUCH_AUFBEWAHRUNG_TAGE) von = tagPlus(bis, -(BESUCH_AUFBEWAHRUNG_TAGE - 1));
    }
  } else if (z !== "heute") { von = tagPlus(heute, -6); }
  const tage = tageZwischen(von, bis);
  return { von, bis, tage, stunden: tage === 1 };
}

/** Der gleich lange Zeitraum direkt davor. */
export function besuchVorher(b: BesuchBereich): BesuchBereich {
  return { von: tagPlus(b.von, -b.tage), bis: tagPlus(b.von, -1), tage: b.tage, stunden: b.stunden };
}

/** Spalte je Filter — feste Liste, nie aus der Anfrage. */
const FILTER_SPALTE: Record<Exclude<BesuchFilterSchluessel, "seite">, string> = {
  kanal: "kanal", herkunft: "herkunft", quelle: "utm_source", kampagne: "utm_campaign", inhalt: "utm_content",
  gruppe: "utm_term", einstieg: "einstieg", ausstieg: "ausstieg", geraet: "geraet", sprache: "sprache", land: "land",
};

/** Die gefilterten Sitzungen eines Zeitraums als Fragment (FROM fiaon_besuch_sitzungen, ohne Alias). */
function sitzungenSql(lauf: Lauf, b: BesuchBereich, f: BesuchFilter) {
  const von = berlinZeitpunkt(b.von, 0);
  const bis = berlinZeitpunkt(tagPlus(b.bis, 1), 0);
  const teile = (Object.keys(FILTER_SPALTE) as (keyof typeof FILTER_SPALTE)[])
    .filter((k) => f[k] != null)
    .map((k) => {
      const spalte = lauf.unsafe(FILTER_SPALTE[k]);
      return f[k] === OHNE ? lauf`AND ${spalte} IS NULL` : lauf`AND ${spalte} = ${f[k]!}`;
    });
  const seite = f.seite != null
    ? lauf`AND EXISTS (SELECT 1 FROM fiaon_besuche fb WHERE fb.sitzung = fiaon_besuch_sitzungen.sitzung AND fb.pfad = ${f.seite})`
    : lauf``;
  return lauf`
    SELECT * FROM fiaon_besuch_sitzungen
     WHERE start >= ${von} AND start < ${bis}
     ${teile.reduce((acc, t) => lauf`${acc} ${t}`, lauf``)}
     ${seite}`;
}

/** Die Gruppen, in die die Seite aufschlüsselt — Schlüssel → Spalte in der Rechnung. */
const DIMENSIONEN = [
  ["kanal", "kanal"], ["herkunft", "herkunft"], ["quelle", "utm_source"], ["kampagne", "utm_campaign"],
  ["inhalt", "utm_content"], ["gruppe", "utm_term"], ["einstieg", "einstieg"], ["ausstieg", "ausstieg"],
  ["geraet", "geraet"], ["sprache", "sprache"], ["land", "land"], ["zeit", "zeit"],
] as const;
export type BesuchDimension = (typeof DIMENSIONEN)[number][0] | "heat";

export interface BesuchZahlen {
  sitzungen: number; besucher: number; seiten: number; absprung: number; dauerMs: number;
  geoeffnet: number; angelegt: number; abgeschickt: number; bezahlt: number; umsatzCents: number;
}
export interface BesuchZeile extends BesuchZahlen { name: string }

const ZAHL0: BesuchZahlen = { sitzungen: 0, besucher: 0, seiten: 0, absprung: 0, dauerMs: 0, geoeffnet: 0, angelegt: 0, abgeschickt: 0, bezahlt: 0, umsatzCents: 0 };

/**
 * Die eine Rechnung. `nurVerlauf` rechnet nur Kopf und Verlauf (für den Vergleichszeitraum).
 * Ergebnis: je Dimension die Zeilen (ungekürzt, nach Sitzungen absteigend).
 */
export async function besuchRechnung(b: BesuchBereich, f: BesuchFilter, o: { nurVerlauf?: boolean } = {}, lauf: Lauf = sqlPool): Promise<{
  gesamt: BesuchZahlen; je: Record<BesuchDimension, BesuchZeile[]>;
}> {
  await ensureBesuchTabellen();
  const dims = o.nurVerlauf ? DIMENSIONEN.filter(([k]) => k === "zeit") : DIMENSIONEN;
  const spalten = dims.map(([, s]) => s);
  const mitHeat = !o.nurVerlauf;
  const sets = ["()", ...spalten.map((s) => `(${s})`), ...(mitHeat ? ["(wt, std)"] : [])].join(", ");
  const dimFall = [
    ...dims.map(([k, s]) => `WHEN GROUPING(${s}) = 0 THEN '${k}'`),
    ...(mitHeat ? ["WHEN GROUPING(wt) = 0 THEN 'heat'"] : []),
  ].join(" ");
  const wertFall = [
    ...dims.map(([, s]) => `WHEN GROUPING(${s}) = 0 THEN ${s}::text`),
    ...(mitHeat ? ["WHEN GROUPING(wt) = 0 THEN wt::text || '-' || std::text"] : []),
  ].join(" ");
  const zeitFormat = b.stunden ? "HH24" : "YYYY-MM-DD";

  const zeilen = (await lauf`
    WITH s AS (${sitzungenSql(lauf, b, f)}),
    erst AS (
      SELECT DISTINCT ON (e.ref) e.ref, l.sitzung
        FROM fiaon_besuch_antraege l
        JOIN fiaon_antrag_ereignisse e ON e.sitzung = l.antrag_sitzung AND e.ref IS NOT NULL
        JOIN fiaon_besuch_sitzungen s0 ON s0.sitzung = l.sitzung
       WHERE e.ref NOT LIKE 'FIAON-TEST%'
       ORDER BY e.ref, s0.start, l.sitzung),
    q AS (${lauf.unsafe(UMSATZ_QUELLE_SQL)}),
    qz AS (SELECT ref, BOOL_OR(erste) AS gekauft, SUM(cents)::bigint AS cents FROM q GROUP BY ref),
    r AS (
      SELECT erst.sitzung,
             COUNT(*)::int AS angelegt,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM fiaon_applications a WHERE a.ref = erst.ref AND ${lauf.unsafe(abgeschicktSql("a"))}))::int AS abgeschickt,
             COUNT(*) FILTER (WHERE qz.gekauft)::int AS bezahlt,
             COALESCE(SUM(qz.cents), 0)::bigint AS cents
        FROM erst
        JOIN s ON s.sitzung = erst.sitzung
        LEFT JOIN qz ON qz.ref = erst.ref
       GROUP BY erst.sitzung),
    ps AS (
      SELECT (ROW_NUMBER() OVER (PARTITION BY s.besucher, (s.start AT TIME ZONE 'Europe/Berlin')::date ORDER BY s.start, s.sitzung) = 1)::int AS erster,
             s.seiten, s.kanal, s.herkunft, s.utm_source, s.utm_campaign, s.utm_content, s.utm_term,
             s.einstieg, s.ausstieg, s.geraet, s.sprache, s.land,
             GREATEST(s.dauer_ms, (EXTRACT(EPOCH FROM (s.zuletzt - s.start)) * 1000)::bigint) AS dauer,
             (s.antrag OR EXISTS (SELECT 1 FROM fiaon_besuch_antraege l WHERE l.sitzung = s.sitzung)) AS geoeffnet,
             COALESCE(r.angelegt, 0) AS angelegt, COALESCE(r.abgeschickt, 0) AS abgeschickt,
             COALESCE(r.bezahlt, 0) AS bezahlt, COALESCE(r.cents, 0) AS cents,
             to_char(s.start AT TIME ZONE 'Europe/Berlin', ${zeitFormat}) AS zeit,
             EXTRACT(ISODOW FROM s.start AT TIME ZONE 'Europe/Berlin')::int AS wt,
             EXTRACT(HOUR FROM s.start AT TIME ZONE 'Europe/Berlin')::int AS std
        FROM s LEFT JOIN r ON r.sitzung = s.sitzung)
    SELECT CASE ${lauf.unsafe(dimFall)} ELSE 'gesamt' END AS dim,
           CASE ${lauf.unsafe(wertFall)} END AS wert,
           COUNT(*)::int AS sitzungen,
           COALESCE(SUM(erster), 0)::int AS besucher,
           COALESCE(SUM(seiten), 0)::int AS seiten,
           COUNT(*) FILTER (WHERE seiten = 1)::int AS absprung,
           COALESCE(AVG(dauer), 0)::float8 AS dauer_ms,
           COUNT(*) FILTER (WHERE geoeffnet)::int AS geoeffnet,
           COALESCE(SUM(angelegt), 0)::int AS angelegt,
           COALESCE(SUM(abgeschickt), 0)::int AS abgeschickt,
           COALESCE(SUM(bezahlt), 0)::int AS bezahlt,
           COALESCE(SUM(cents), 0)::bigint AS cents
      FROM ps
     GROUP BY GROUPING SETS (${lauf.unsafe(sets)})`) as any[];

  const je = {} as Record<BesuchDimension, BesuchZeile[]>;
  for (const [k] of DIMENSIONEN) je[k] = [];
  je.heat = [];
  let gesamt: BesuchZahlen = { ...ZAHL0 };
  for (const z of zeilen) {
    const zahlen: BesuchZahlen = {
      sitzungen: Number(z.sitzungen) || 0, besucher: Number(z.besucher) || 0, seiten: Number(z.seiten) || 0,
      absprung: Number(z.sitzungen) > 0 ? (Number(z.absprung) / Number(z.sitzungen)) * 100 : 0,
      dauerMs: Math.round(Number(z.dauer_ms) || 0),
      geoeffnet: Number(z.geoeffnet) || 0, angelegt: Number(z.angelegt) || 0, abgeschickt: Number(z.abgeschickt) || 0,
      bezahlt: Number(z.bezahlt) || 0, umsatzCents: Number(z.cents) || 0,
    };
    if (z.dim === "gesamt") { gesamt = zahlen; continue; }
    const liste = je[z.dim as BesuchDimension];
    if (liste) liste.push({ name: z.wert == null ? OHNE : String(z.wert), ...zahlen });
  }
  for (const k of Object.keys(je) as BesuchDimension[]) {
    if (k === "zeit" || k === "heat") je[k].sort((a, c) => a.name.localeCompare(c.name));
    else je[k].sort((a, c) => c.sitzungen - a.sitzungen || a.name.localeCompare(c.name));
  }
  return { gesamt, je };
}

/** Die Seiten (Seitenaufrufe, nicht Sitzungen) der gefilterten Sitzungen. */
export async function besuchSeiten(b: BesuchBereich, f: BesuchFilter, lauf: Lauf = sqlPool): Promise<{ pfad: string; aufrufe: number; dauerMs: number | null }[]> {
  await ensureBesuchTabellen();
  const z = (await lauf`
    WITH s AS (SELECT sitzung FROM (${sitzungenSql(lauf, b, f)}) x)
    SELECT fb.pfad, COUNT(*)::int AS aufrufe,
           AVG(fb.dauer_ms) FILTER (WHERE fb.dauer_ms > 0)::float8 AS dauer_ms
      FROM fiaon_besuche fb JOIN s ON s.sitzung = fb.sitzung
     GROUP BY fb.pfad ORDER BY aufrufe DESC, fb.pfad LIMIT 60`) as any[];
  return z.map((r) => ({ pfad: String(r.pfad), aufrufe: Number(r.aufrufe), dauerMs: r.dauer_ms == null ? null : Math.round(Number(r.dauer_ms)) }));
}

/** Wer ist jetzt da (letzte Bewegung vor höchstens fünf Minuten) — und auf welcher Seite. Ohne Filter. */
export async function besuchLive(lauf: Lauf = sqlPool): Promise<{ jetzt: number; seiten: { pfad: string; n: number }[] }> {
  await ensureBesuchTabellen();
  const z = (await lauf`
    SELECT ausstieg AS pfad, COUNT(DISTINCT besucher)::int AS n
      FROM fiaon_besuch_sitzungen
     WHERE start > NOW() - INTERVAL '1 day' AND zuletzt > NOW() - INTERVAL '5 minutes'
     GROUP BY ausstieg ORDER BY n DESC, ausstieg`) as any[];
  const [g] = (await lauf`
    SELECT COUNT(DISTINCT besucher)::int AS n FROM fiaon_besuch_sitzungen
     WHERE start > NOW() - INTERVAL '1 day' AND zuletzt > NOW() - INTERVAL '5 minutes'`) as any[];
  return { jetzt: Number(g?.n) || 0, seiten: z.slice(0, 6).map((r) => ({ pfad: String(r.pfad), n: Number(r.n) })) };
}

/** Seit wann misst fiaon.com selbst? (Erste Sitzung, Berliner Tag) — oder null. */
export async function besuchMessbeginn(lauf: Lauf = sqlPool): Promise<string | null> {
  await ensureBesuchTabellen();
  const [z] = (await lauf`SELECT to_char(MIN(start) AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD') AS tag FROM fiaon_besuch_sitzungen`) as any[];
  return z?.tag ?? null;
}

/** Den Verlauf lückenlos machen: jeder Tag (bzw. jede Stunde) bekommt eine Zeile, auch ohne Besuch. */
export function verlaufFuellen(b: BesuchBereich, zeilen: BesuchZeile[]): BesuchZeile[] {
  const da = new Map(zeilen.map((z) => [z.name, z]));
  const namen = b.stunden
    ? Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"))
    : Array.from({ length: b.tage }, (_, i) => tagPlus(b.von, i));
  return namen.map((name) => da.get(name) ?? { name, ...ZAHL0 });
}

/** Alles, was die Seite braucht — eine Antwort. */
export async function besuchAuswertung(z: string, von: unknown, bis: unknown, f: BesuchFilter, vergleich: boolean, lauf: Lauf = sqlPool) {
  const b = besuchBereich(z, von, bis);
  const vb = besuchVorher(b);
  const [jetzt, vorher, seiten, live, ab] = await Promise.all([
    besuchRechnung(b, f, {}, lauf),
    vergleich ? besuchRechnung(vb, f, { nurVerlauf: true }, lauf) : Promise.resolve(null),
    besuchSeiten(b, f, lauf),
    besuchLive(lauf),
    besuchMessbeginn(lauf),
  ]);
  const kuerzen = (l: BesuchZeile[], n = 40) => l.slice(0, n);
  return {
    bereich: b,
    vorherBereich: vergleich ? vb : null,
    messbeginn: ab,
    live,
    kopf: jetzt.gesamt,
    vorher: vorher?.gesamt ?? null,
    verlauf: verlaufFuellen(b, jetzt.je.zeit),
    verlaufVorher: vorher ? verlaufFuellen(vb, vorher.je.zeit) : null,
    seiten,
    einstiege: kuerzen(jetzt.je.einstieg),
    ausstiege: kuerzen(jetzt.je.ausstieg),
    kanaele: kuerzen(jetzt.je.kanal),
    herkunft: kuerzen(jetzt.je.herkunft),
    quellen: kuerzen(jetzt.je.quelle),
    kampagnen: kuerzen(jetzt.je.kampagne),
    inhalte: kuerzen(jetzt.je.inhalt),
    gruppen: kuerzen(jetzt.je.gruppe),
    geraete: jetzt.je.geraet,
    sprachen: kuerzen(jetzt.je.sprache, 20),
    laender: kuerzen(jetzt.je.land, 30),
    heat: jetzt.je.heat.map((h) => {
      const [wt, std] = h.name.split("-").map(Number);
      return { wt, std, sitzungen: h.sitzungen };
    }),
  };
}
