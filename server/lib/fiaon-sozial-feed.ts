// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-FEED FÜR DIE WEBSITE (06.10.2026, E-296)
//
// Justin (06.10.): „zeig unsere Social Media Profile … auf der Startseite
// vielleicht Karussels, iPhone MockUp und innen der Feed … genauso auf der
// Business Seite“. Quelle sind die Posts des Social-Studios (E-294).
//
// Vertrag zur Seite: shared/fiaon-sozial-feed.ts (Pfade, Antwortform).
// Regeln (Sichtbarkeit, Bilder, Text, Hashtags, Reihenfolge): shared/fiaon-social.ts §9.
// Routen: server/routes/fiaon-social.ts (GET /social/feed, GET /social/bild/:id).
//
// Leitplanken:
//   • Öffentlich, ohne Anmeldung — deshalb liefert der Feed NUR, was die Regel
//     erlaubt (Schalter, auf Instagram als veröffentlicht gemeldet, Plantag in
//     Berliner Zeit, Wort-Check nach den aktuellen Regeln nicht rot, mit Bild).
//     Die Bild-Route liefert nur Dateien, die der Feed gerade zeigt (Vorrat), und
//     prüft Schalter, Status und Plantag zusätzlich bei JEDER Anfrage in SQL.
//   • Ein Vorrat je Minute: die sichtbaren Posts aller Marken stehen 60 s im
//     Speicher; Marke, Thema und Anzahl werden daraus gerechnet. So trifft kein
//     erfundenes ?thema= die Datenbank, und es gibt nur EINEN Eintrag im Speicher.
//     Jede Studio-Aktion und jeder Import leeren den Vorrat sofort.
//   • Listen lesen NIE die Spalte inhalt.
//   • Keine erfundenen Zahlen: `anzahl` zählt nur die sichtbaren Posts.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday, berlinDatum, berlinZeitpunkt } from "./fiaon-time";
import { ensureSocialTabellen } from "./fiaon-social";
import { webVarianten } from "./fiaon-social-dateien";
import { SOZIALE_PROFILE } from "@shared/fiaon-sozial";
import {
  SOZIAL_WEBSITE_STATUS, SOZIAL_WEBSITE_KANAL, sozialBildPfad,
  type SozialFeedAntwort, type SozialFeedPost, type SozialFeedBild,
} from "@shared/fiaon-sozial-feed";
import {
  feedBildEintraege, captionOhneHashtags, feedTextKuerzen, feedHashtags, feedSortierung, feedNachThema,
  feedThemaSlug, feedAnzahl, feedMarke, permalinkPruefen, istSocialKanal, textNormal, socialWortcheck,
  type FeedDateiEintrag, type SocialKanal,
} from "@shared/fiaon-social";

/** Ein Post im Vorrat: der Vertragstyp plus die Sortierschlüssel (gehen nicht nach außen). */
interface FeedEintrag { post: SozialFeedPost; zeit_ms: number; reihenfolge: number | null; id: number }

/** Wie lange der Vorrat gilt. Die Antwort selbst trägt Cache-Control: public, max-age=300. */
export const FEED_VORRAT_MS = 60_000;
/** Mehr Posts liest der Feed nie (die Seite zeigt höchstens 12). */
const FEED_ZEILEN_MAX = 500;
/** Alt-Text auf der Website höchstens so lang (Karussell-Alt-Texte beschreiben alle Folien). */
const ALT_MAX = 1000;

/** Der Vorrat: die sichtbaren Posts und die ids ALLER Bilddateien, die der Feed gerade zeigt (klein und groß). */
interface Vorrat { liste: FeedEintrag[]; bildIds: Set<number> }
let vorrat: { tag: string; seit: number; daten: Vorrat } | null = null;
let laufend: Promise<Vorrat> | null = null;
let generation = 0;

/** Nach jeder Änderung im Studio (Schalter, Status, Termin, Import, Web-Bilder): der nächste Abruf liest neu. */
export function sozialFeedLeeren(): void {
  vorrat = null;
  generation++;
}

/** Die Links zu den echten Beiträgen — nur geprüfte https-Adressen des richtigen Kanals. */
function linksAus(veroeff: unknown): SozialFeedPost["links"] {
  const out: SozialFeedPost["links"] = {};
  const v = veroeff && typeof veroeff === "object" ? (veroeff as Record<string, { permalink?: unknown }>) : {};
  for (const [k, x] of Object.entries(v)) {
    if (!istSocialKanal(k)) continue;
    const url = String(x?.permalink ?? "").trim();
    if (!url || permalinkPruefen(k as SocialKanal, url)) continue;
    if (k === "instagram" && !out.instagram) out.instagram = url;
    else if (k === "facebook" && !out.facebook) out.facebook = url;
    else if (k === "tiktok" && !out.tiktok) out.tiktok = url;
    else if (k.startsWith("linkedin") && !out.linkedin) out.linkedin = url;
  }
  return out;
}

const formatOk = (f: unknown): SozialFeedPost["format"] =>
  (["reel", "karussell", "bild", "story", "dokument", "text"].includes(String(f)) ? String(f) : "bild") as SozialFeedPost["format"];

const arr = (x: unknown): string[] => (Array.isArray(x) ? x.map(String) : []);

/**
 * Wort-Check nach den AKTUELLEN Regeln (Prüfung 06.10.2026): Eingeschaltet wird nur bei nicht-rotem Check —
 * werden die Regeln danach schärfer, darf ein jetzt roter Post nicht weiter öffentlich stehen. Dieselben Felder
 * wie im Studio (wortcheckFuer in fiaon-social.ts).
 */
function istRot(r: any): boolean {
  return socialWortcheck({
    marke: r.marke, titel: r.titel, caption: r.caption, erster_kommentar: r.erster_kommentar, alt_text: r.alt_text,
    hashtags: arr(r.hashtags), bildtexte: arr(r.bildtexte), ausnahmen: arr(r.ausnahmen),
    ausnahmen_unbekannt: arr(r.ausnahmen_unbekannt), manifest: r.wortcheck_manifest ?? null,
  }).ergebnis === "rot";
}

/** Liest die sichtbaren Posts (alle Marken) samt Bildern — EINE Abfrage für die Posts, eine für die Bilder, eine für die Web-Bilder. */
async function sichtbareLaden(heute: string): Promise<Vorrat> {
  await ensureSocialTabellen();
  const status = [...SOZIAL_WEBSITE_STATUS] as string[];
  const rows = (await sqlPool`
    SELECT p.id, p.titel, p.format, p.marke, p.themen, p.caption, p.hashtags, p.alt_text, p.ki_noetig, p.dateien,
           p.erster_kommentar, p.bildtexte, p.ausnahmen, p.ausnahmen_unbekannt, p.wortcheck_manifest,
           p.veroeffentlicht, p.veroeffentlicht_am, p.plan_zeitpunkt, p.plan_datum::text AS pd, p.reihenfolge
      FROM fiaon_social_posts p
     WHERE p.website_sichtbar AND p.status = ANY(${status}::text[]) AND p.plan_datum <= ${heute}::date
       AND ${SOZIAL_WEBSITE_KANAL} = ANY(p.kanaele)
     ORDER BY p.plan_datum DESC, p.id DESC
     LIMIT ${FEED_ZEILEN_MAX}`) as any[];
  const bildIds = new Set<number>();
  if (!rows.length) return { liste: [], bildIds };

  // Welche Dateien braucht die Website? Je Post die Folien bzw. das Titelbild (shared: feedBildEintraege).
  const jePost = new Map<number, FeedDateiEintrag[]>();
  const ids: number[] = [];
  for (const r of rows) {
    const liste = feedBildEintraege(String(r.format), (Array.isArray(r.dateien) ? r.dateien : []) as FeedDateiEintrag[]);
    jePost.set(Number(r.id), liste);
    for (const d of liste) ids.push(Number(d.datei_id));
  }
  // Nur Originale, die es noch gibt, mit Inhalt, als JPEG/PNG und zu DIESEM Post gehörend.
  const koepfe = new Map<number, { post_id: number; breite: number | null; hoehe: number | null }>();
  if (ids.length) {
    const k = (await sqlPool`
      SELECT id, post_id, breite, hoehe FROM fiaon_social_dateien
       WHERE id = ANY(${ids}::bigint[]) AND geloescht_am IS NULL AND inhalt_geleert_am IS NULL AND ablage = 'db'
         AND variante = 'original' AND mime IN ('image/jpeg', 'image/png')`) as any[];
    for (const x of k) koepfe.set(Number(x.id), { post_id: Number(x.post_id), breite: x.breite == null ? null : Number(x.breite), hoehe: x.hoehe == null ? null : Number(x.hoehe) });
  }
  const web = await webVarianten(Array.from(koepfe.keys()));

  const out: FeedEintrag[] = [];
  for (const r of rows) {
    const id = Number(r.id);
    // Nicht rot nach den Regeln von heute. Instagram-Kanal prüft die Abfrage; der Link kommt mit, sobald er gemeldet ist.
    const links = linksAus(r.veroeffentlicht);
    if (istRot(r)) continue;
    const bilder: SozialFeedBild[] = [];
    for (const d of jePost.get(id) ?? []) {
      const kopf = koepfe.get(Number(d.datei_id));
      if (!kopf || kopf.post_id !== id) continue;
      const gross = { url: sozialBildPfad(Number(d.datei_id)), breite: kopf.breite, hoehe: kopf.hoehe };
      const w = web.get(Number(d.datei_id));
      bilder.push({ klein: w ? { url: sozialBildPfad(w.id), breite: w.breite, hoehe: w.hoehe } : gross, gross });
    }
    // Posts ohne Bild kommen nicht in den Feed (Vertrag: bilder ist nie leer).
    if (!bilder.length) continue;
    for (const b of bilder) { bildIds.add(idAusPfad(b.klein.url)); bildIds.add(idAusPfad(b.gross.url)); }
    const pd = String(r.pd);
    const veroeffAm = r.veroeffentlicht_am ? new Date(r.veroeffentlicht_am) : null;
    const planAm = r.plan_zeitpunkt ? new Date(r.plan_zeitpunkt) : null;
    const zeit = veroeffAm ?? planAm ?? berlinZeitpunkt(pd, 0);
    const alt = textNormal(r.alt_text ?? "").trim();
    out.push({
      id, reihenfolge: r.reihenfolge == null ? null : Number(r.reihenfolge), zeit_ms: zeit.getTime(),
      post: {
        id,
        titel: String(r.titel ?? ""),
        format: formatOk(r.format),
        marke: r.marke === "global" ? "global" : "fiaon",
        themen: (Array.isArray(r.themen) ? r.themen : []).map((t: unknown) => String(t)),
        datum: veroeffAm ? berlinDatum(veroeffAm) : pd,
        text: feedTextKuerzen(captionOhneHashtags(r.caption)),
        hashtags: feedHashtags(Array.isArray(r.hashtags) ? r.hashtags.map(String) : [], r.caption),
        alt: alt ? feedTextKuerzen(alt, ALT_MAX) : "",
        links,
        ki: !!r.ki_noetig,
        bilder,
      },
    });
  }
  bildIds.delete(0);
  return { liste: out.sort(feedSortierung), bildIds };
}

/** „/api/fiaon/social/bild/123“ → 123 (0, wenn es keine Bild-Adresse ist). */
function idAusPfad(url: string): number {
  const m = /\/(\d+)$/.exec(url);
  return m ? Number(m[1]) : 0;
}

/** Der Vorrat (60 s, je Berliner Tag). Gleichzeitige Abrufe teilen sich EINE Abfrage. */
async function vorratHolen(): Promise<Vorrat> {
  const heute = berlinToday();
  const jetzt = Date.now();
  if (vorrat && vorrat.tag === heute && jetzt - vorrat.seit < FEED_VORRAT_MS) return vorrat.daten;
  if (!laufend) {
    const gen = generation;
    laufend = sichtbareLaden(heute)
      .then((daten) => {
        // Kam während des Lesens eine Änderung (sozialFeedLeeren), nicht als frisch ablegen.
        if (gen === generation) vorrat = { tag: heute, seit: Date.now(), daten };
        return daten;
      })
      .finally(() => { laufend = null; });
  }
  return laufend;
}

/**
 * GET /api/fiaon/social/feed?marke=fiaon|global|alle&thema=<slug>&n=1…12.
 * Wirft bei Datenbankfehlern — die Route antwortet dann 200 mit leerer Liste.
 */
export async function sozialFeed(q: { marke?: unknown; thema?: unknown; n?: unknown }): Promise<SozialFeedAntwort> {
  const marke = feedMarke(q.marke);
  const thema = feedThemaSlug(q.thema);
  const n = feedAnzahl(q.n);
  const alle = (await vorratHolen()).liste;
  const liste = marke === "alle" ? alle : alle.filter((e) => e.post.marke === marke);
  const posts = feedNachThema(liste.map((e) => e.post), thema).slice(0, n);
  return { profile: SOZIALE_PROFILE, posts, anzahl: liste.length };
}

/** Die Antwort, wenn etwas schiefgeht: nur die Profile — die Seite zeigt dann ihren leeren Zustand. */
export const sozialFeedLeer = (): SozialFeedAntwort => ({ profile: SOZIALE_PROFILE, posts: [], anzahl: 0 });

/**
 * Darf diese Datei JETZT öffentlich ausgeliefert werden? Zwei Prüfungen, beide müssen passen:
 *   1. Der Feed zeigt sie gerade (Vorrat, höchstens 60 s alt, jede Studio-Aktion leert ihn): genau die Folien
 *      bzw. das Titelbild laut feedBildEintraege, nur Posts mit Instagram-Meldung und nicht-rotem Wort-Check.
 *      Prüfung 06.10.2026: Vorher lieferte die Route jede Datei mit Rolle bild/cover eines sichtbaren Posts —
 *      auch Titelbilder von Karussells und Bilder von Reels, die nirgends auf der Website stehen.
 *   2. Frisch in SQL bei jeder Anfrage: JPEG/PNG, Original oder web_480, nicht gelöscht, mit Inhalt; ihr Post:
 *      Schalter an, Status ab Freigabe mit Instagram-Kanal, Plantag (Berlin) erreicht; das
 *      Original (bei web_480: die quelle_id) steht in der AKTUELLEN Dateiliste — alte Fassungen bleiben privat.
 */
export async function websiteBild(dateiId: number): Promise<{ id: number; mime: string; bytes: number; sha256: string } | null> {
  if (!(await vorratHolen()).bildIds.has(dateiId)) return null;
  const status = [...SOZIAL_WEBSITE_STATUS] as string[];
  const heute = berlinToday();
  const r = (await sqlPool`
    SELECT d.id, d.mime, d.bytes, d.sha256
      FROM fiaon_social_dateien d
      JOIN fiaon_social_posts p ON p.id = d.post_id
     WHERE d.id = ${dateiId} AND d.geloescht_am IS NULL AND d.inhalt_geleert_am IS NULL AND d.ablage = 'db'
       AND d.mime IN ('image/jpeg', 'image/png') AND d.rolle IN ('bild', 'cover') AND d.variante IN ('original', 'web_480')
       AND (d.variante = 'original' OR d.quelle_id IS NOT NULL)
       AND p.website_sichtbar AND p.status = ANY(${status}::text[]) AND p.plan_datum <= ${heute}::date
       AND ${SOZIAL_WEBSITE_KANAL} = ANY(p.kanaele)
       AND p.dateien @> jsonb_build_array(jsonb_build_object(
             'datei_id', CASE WHEN d.variante = 'web_480' THEN d.quelle_id ELSE d.id END,
             'rolle', d.rolle))
     LIMIT 1`) as any[];
  if (!r[0]) return null;
  return { id: Number(r[0].id), mime: String(r[0].mime), bytes: Number(r[0].bytes), sha256: String(r[0].sha256).trim() };
}
