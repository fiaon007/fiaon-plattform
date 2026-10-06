/**
 * DER SOCIAL-FEED AUF DER WEBSITE (E-296, 06.10.2026) — der Vertrag zwischen Server und Seite.
 *
 * Justin, 06.10.2026: „zeig unsere Social Media Profile … auf der Startseite vielleicht Karussels, iPhone MockUp und innen
 * der Feed, oder zu einem passenden Thema ein Beitrag, bau es auf passende Seiten ein (genauso auf der Business Seite) …
 * mit coolen modernen Animationen“.
 *
 * Quelle sind die Posts des Social-Studios (E-294, fiaon_social_posts). Auf die Website kommt ein Post NUR, wenn
 *   · website_sichtbar = TRUE (Schalter im Studio; „als veröffentlicht melden“ setzt ihn beim ersten Melden mit —
 *     außer, er wurde für diese Fassung schon einmal bewusst geschaltet), und
 *   · er auf INSTAGRAM als veröffentlicht gemeldet ist (Status veröffentlicht/ausgewertet, Permalink in
 *     `veroeffentlicht.instagram`) — das Handy ist die Darstellung von @fiaon.ltd, also steht darin nur, was dort
 *     wirklich steht (Fix 06.10.2026: vorher reichte „freigegeben“ — ein nie geposteter Beitrag stand dann als
 *     Instagram-Beitrag auf fiaon.com, UWG), und
 *   · sein Plantag (Europe/Berlin) erreicht ist — nie etwas vor seinem Tag, und
 *   · sein Wort-Check nach den AKTUELLEN Regeln nicht rot ist (beim Ausliefern gerechnet, nicht nur beim Einschalten).
 * Der Schalter darf schon ab „freigegeben“ an sein (vorgemerkt) — gezeigt wird erst nach der Instagram-Meldung.
 * Ohne solche Posts liefert der Feed eine leere Liste; die Seite zeigt dann nur die Profile (SOZIALE_PROFILE) — kein
 * leeres Handy, keine erfundenen Zahlen.
 */
import type { SozialesProfil } from "./fiaon-sozial";

/** Öffentliche Adressen (NICHT unter /api/admin — dort fängt der ARAS-Router mit requireAdmin alles ab). */
export const SOZIAL_FEED_PFAD = "/api/fiaon/social/feed";
export const sozialBildPfad = (dateiId: number) => `/api/fiaon/social/bild/${dateiId}`;

/** Status, die auf der Website stehen dürfen (zusammen mit website_sichtbar, Instagram-Meldung und erreichtem Plantag). */
export const SOZIAL_WEBSITE_STATUS = ["veroeffentlicht", "ausgewertet"] as const;
/** Auf diesem Kanal muss der Post als veröffentlicht gemeldet sein (Schlüssel in fiaon_social_posts.veroeffentlicht). */
export const SOZIAL_WEBSITE_KANAL = "instagram";

export type SozialFeedMarke = "fiaon" | "global" | "alle";

/** Ein Bild in zwei Größen: klein für Kacheln (web_480, falls vorhanden, sonst das Original), groß für die Ansicht. */
export interface SozialFeedBild {
  klein: { url: string; breite: number | null; hoehe: number | null };
  gross: { url: string; breite: number | null; hoehe: number | null };
}

export interface SozialFeedPost {
  id: number;
  titel: string;
  /** reel → nur das Titelbild (cover) mit Abspiel-Zeichen; Videos laufen auf der Website nicht. */
  format: "reel" | "karussell" | "bild" | "story" | "dokument" | "text";
  marke: "fiaon" | "global";
  themen: string[];
  /** Tag des Beitrags (YYYY-MM-DD): Veröffentlichungstag, sonst Plantag. */
  datum: string;
  /** Bildunterschrift ohne Hashtags, höchstens 280 Zeichen (an einer Wortgrenze gekürzt, „…“). */
  text: string;
  /** Höchstens fünf, ohne „#“. */
  hashtags: string[];
  /** Alt-Text aus dem Studio; leer → die Seite nimmt den Titel. */
  alt: string;
  /** Links zu den echten Beiträgen (geprüfte Permalinks). `instagram` ist bei jedem gelieferten Post gesetzt. */
  links: { instagram?: string; facebook?: string; linkedin?: string; tiktok?: string };
  /** Als KI-Inhalt gekennzeichnet (Art. 50 KI-VO) → sichtbarer Hinweis an Kachel und Ansicht. */
  ki: boolean;
  /** Folien in Reihenfolge (Karussell), bei Bild/Reel genau eines. Nie leer — Posts ohne Bild kommen nicht in den Feed. */
  bilder: SozialFeedBild[];
}

export interface SozialFeedAntwort {
  profile: SozialesProfil[];
  posts: SozialFeedPost[];
  /**
   * Zahl ALLER sichtbaren Posts der Marke (nicht nur der gelieferten). Die Seite zeigt sie NICHT als Profilzahl im
   * Handy: Die echte Beitragszahl von @fiaon.ltd steht nur auf Instagram (Prüfung 06.10.2026, keine erfundenen Zahlen).
   */
  anzahl: number;
}

/** Anfrage: ?marke=fiaon|global|alle (Standard alle) · &thema=<slug> (passende zuerst) · &n=1…12 (Standard 9). */
export const SOZIAL_FEED_MAX = 12;
