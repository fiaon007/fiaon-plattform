// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-FEED AUF DER WEBSITE (E-296, 06.10.2026) — Daten holen, spät und einmal
//
// Der Feed (GET /api/fiaon/social/feed, Vertrag: shared/fiaon-sozial-feed.ts)
// ist eine kleine JSON-Antwort (5 Minuten Cache). Er wird geholt, sobald die
// Seite geladen ist und der Browser Luft hat (requestIdleCallback) — spätestens,
// wenn der Abschnitt bis auf zwei Bildschirmhöhen (mindestens 1.500 px)
// herankommt. Prüfung 06.10.2026: Mit nur 600 px Vorlauf kamen die Daten beim
// schnellen Wischen erst, als der Abschnitt schon im Bild war — das Handy
// ersetzte das Profilband vor den Augen des Besuchers (CLS bis 0,8). Bilder
// laden weiterhin erst in der Nähe (loading="lazy").
//
// Wichtig: Die Seiten der dunklen Bühne scrollen in #root, /business im
// Dokument (index.css, global-rahmen.css). Ein IntersectionObserver hilft hier
// nicht: Ohne eigenen root schneidet #root den rootMargin ab, mit root=#root
// sieht er nach dem Umschalten auf fg-dokument alles als „sichtbar“. Deshalb
// misst beiNaehe() den echten Abstand beim Scrollen (siehe dort).
//
// Fehler, leere Antworten und kaputte Daten verhalten sich wie „keine Beiträge“:
// Die Seite zeigt dann nur die Profile. Nie ein leeres Handy, nie eine Zahl,
// die nicht aus dem Feed kommt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState, type RefObject } from "react";
import { SOZIAL_FEED_PFAD, SOZIAL_FEED_MAX, type SozialFeedAntwort, type SozialFeedMarke, type SozialFeedPost } from "@shared/fiaon-sozial-feed";
import { SOZIALE_PROFILE, type SozialesProfil } from "@shared/fiaon-sozial";

export type SozialStand = "wartet" | "voll" | "leer";

export interface SozialDaten {
  stand: SozialStand;
  posts: SozialFeedPost[];
  profile: SozialesProfil[];
  anzahl: number;
  /** Welche Marke tatsächlich geliefert wurde (nach dem Rückfall auf „alle“). */
  marke: SozialFeedMarke;
}

const LEER = (marke: SozialFeedMarke): SozialDaten => ({ stand: "leer", posts: [], profile: SOZIALE_PROFILE, anzahl: 0, marke });

/** Nur Posts, die die Seite wirklich zeigen kann: mit Bild, Bild mit Adresse. */
function gueltig(p: unknown): p is SozialFeedPost {
  const x = p as SozialFeedPost;
  return !!x && typeof x.id === "number" && Array.isArray(x.bilder) && x.bilder.length > 0
    && x.bilder.every((b) => typeof b?.klein?.url === "string" && typeof b?.gross?.url === "string")
    && Array.isArray(x.themen) && typeof x.datum === "string";
}

const zwischenspeicher = new Map<string, Promise<SozialFeedAntwort | null>>();

/** Eine Anfrage je Adresse und Seitenaufruf — mehrere Abschnitte mit derselben Frage teilen sich die Antwort. */
function holen(marke: SozialFeedMarke, n: number, thema?: string): Promise<SozialFeedAntwort | null> {
  const q = new URLSearchParams({ marke, n: String(Math.max(1, Math.min(SOZIAL_FEED_MAX, n))) });
  if (thema) q.set("thema", thema);
  const adresse = `${SOZIAL_FEED_PFAD}?${q}`;
  let p = zwischenspeicher.get(adresse);
  if (!p) {
    p = fetch(adresse, { credentials: "omit", headers: { Accept: "application/json" } })
      .then(async (r) => {
        if (!r.ok) return null;
        const j = (await r.json().catch(() => null)) as SozialFeedAntwort | null;
        if (!j || !Array.isArray(j.posts)) return null;
        const posts = j.posts.filter(gueltig);
        const profile = Array.isArray(j.profile) && j.profile.length ? j.profile.filter((x) => x?.href && x?.kanal) : SOZIALE_PROFILE;
        const anzahl = Number.isFinite(j.anzahl) ? Math.max(j.anzahl, posts.length) : posts.length;
        return { posts, profile, anzahl };
      })
      .catch(() => null);
    // Ein Fehler soll beim nächsten Seitenaufruf neu fragen dürfen, nicht für immer „leer“ bleiben.
    p.then((x) => { if (!x) zwischenspeicher.delete(adresse); });
    zwischenspeicher.set(adresse, p);
  }
  return p;
}

/**
 * Ruft `los` einmal auf, sobald `el` bis auf `rand` px an den sichtbaren Bereich heranrückt.
 *
 * Bewusst KEIN IntersectionObserver: Die dunkle Bühne scrollt in #root, /business im Dokument — und welcher
 * von beiden es ist, entscheidet Dunkel() erst in seinem eigenen Effekt (fg-dokument), also NACH den Effekten
 * der Kinder. Ein Beobachter mit root=#root sah danach das ganze Dokument als „sichtbar“ und lud sofort (am
 * Prüfstand gemessen: /business holte den Feed beim Laden). Ein Scroll-Lauscher in der Capture-Phase hört jeden
 * Container; gemessen wird einmal je Bild (requestAnimationFrame) am echten Abstand zum Fenster.
 */
export function beiNaehe(el: Element, los: () => void, rand = Math.max(1500, 2 * (window.innerHeight || 800))): () => void {
  let fertig = false, raf = 0;
  const pruefen = () => {
    raf = 0;
    if (fertig) return;
    const r = el.getBoundingClientRect();
    const h = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < h + rand && r.bottom > -rand) { fertig = true; aufraeumen(); los(); }
  };
  const bald = () => { if (!raf && !fertig) raf = requestAnimationFrame(pruefen); };
  const aufraeumen = () => {
    document.removeEventListener("scroll", bald, true);
    window.removeEventListener("resize", bald);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  };
  document.addEventListener("scroll", bald, { capture: true, passive: true });
  window.addEventListener("resize", bald, { passive: true });
  // Erst nach dem ersten Bild messen — dann stehen Rahmen (fg-dokument) und Höhen der Seite.
  const t = window.setTimeout(bald, 120);
  return () => { fertig = true; window.clearTimeout(t); aufraeumen(); };
}

/** Ruft `los` einmal auf, wenn die Seite geladen ist und der Browser nichts Dringenderes zu tun hat. */
export function imLeerlauf(los: () => void): () => void {
  const w = window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  let aus = false, id = 0, t = 0;
  const planen = () => {
    if (aus) return;
    if (typeof w.requestIdleCallback === "function") id = w.requestIdleCallback(() => { if (!aus) los(); }, { timeout: 2500 });
    else t = window.setTimeout(() => { if (!aus) los(); }, 1500);
  };
  if (document.readyState === "complete") planen(); else window.addEventListener("load", planen, { once: true });
  return () => {
    aus = true;
    window.removeEventListener("load", planen);
    if (id && typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id);
    window.clearTimeout(t);
  };
}

/**
 * Holt den Feed, sobald die Seite Luft hat oder `ref` in die Nähe kommt — was zuerst eintritt, genau einmal.
 * `mindestens`: Liefert die Marke weniger Posts, fragt der Hook noch einmal mit `ersatz` (z. B. global → alle).
 */
export function useSozialFeed(ref: RefObject<Element | null>, opt: { marke: SozialFeedMarke; n?: number; thema?: string; ersatz?: SozialFeedMarke; mindestens?: number }): SozialDaten {
  const { marke, n = 9, thema, ersatz, mindestens = 1 } = opt;
  const [daten, setDaten] = useState<SozialDaten>(() => ({ ...LEER(marke), stand: "wartet" }));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let aktiv = true, gestartet = false;
    const los = async () => {
      if (gestartet) return;
      gestartet = true;
      stoppNaehe(); stoppLeerlauf();
      let a = await holen(marke, n, thema);
      let geliefert: SozialFeedMarke = marke;
      if (ersatz && ersatz !== marke && (a?.posts.length ?? 0) < mindestens) {
        const b = await holen(ersatz, n, thema);
        if ((b?.posts.length ?? 0) > (a?.posts.length ?? 0)) { a = b; geliefert = ersatz; }
      }
      if (!aktiv) return;
      if (!a || a.posts.length === 0) { setDaten({ ...LEER(geliefert), profile: a?.profile?.length ? a.profile : SOZIALE_PROFILE }); return; }
      setDaten({ stand: "voll", posts: a.posts, profile: a.profile, anzahl: a.anzahl, marke: geliefert });
    };
    const stoppNaehe = beiNaehe(el, () => void los());
    const stoppLeerlauf = imLeerlauf(() => void los());
    return () => { aktiv = false; stoppNaehe(); stoppLeerlauf(); };
  }, [ref, marke, n, thema, ersatz, mindestens]);
  return daten;
}

/** „2026-10-06“ → „6. Okt. 2026“ / „6 Oct 2026“ — als Kalendertag, ohne Zeitzonen-Verschiebung. */
export function sozialDatum(iso: string, locale: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const d = new Date(`${iso}T12:00:00Z`);
  try { return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); }
  catch { return iso; }
}

/**
 * Text für die Website: ohne Emoji (die Website zeigt keine — AGENTS.md), Zahl und Einheit nie getrennt
 * („1.590 €“, „24 h“). Der Inhalt selbst bleibt, wie das Studio ihn liefert.
 */
export function anzeigeText(t: string): string {
  // Emoji ohne u-Flag (Ziel ES5 im tsconfig): Symbole/Dingbats, Sterne, die Emoji-Ebene (Ersatzpaare), Verbinder — Pfeile bleiben.
  return t.replace(/(?:[\u2300-\u23FF\u2600-\u27BF\u2B00-\u2BFF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])[\uFE0E\uFE0F]?|\u200D/g, "").replace(/[ \t]{2,}/g, " ").replace(/ +\n/g, "\n").replace(/(\d) (€|%|h|CHF|USD|\$)(?=\s|$|[.,;:!?)])/g, "$1\u00a0$2").trim();
}

/** Seitenverhältnis eines Bildes für width/height-Attribute (Platz reservieren, kein Springen). */
export function bildMasse(b: { breite: number | null; hoehe: number | null }, ersatzBreite = 1080, ersatzHoehe = 1350) {
  const w = b.breite && b.breite > 0 ? b.breite : ersatzBreite;
  const h = b.hoehe && b.hoehe > 0 ? b.hoehe : ersatzHoehe;
  return { width: w, height: h };
}
