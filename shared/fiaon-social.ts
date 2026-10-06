// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO — Regeln, Kanäle, Wort-Check und API-Vertrag (06.10.2026, E-294)
//
// Justin (06.10.): „unser Content … muss auch auf der Plattform eine Seite haben,
// mit Termin, Post, Plattform, Texten … wie sieht Instagram aus wenn es fertig
// ist … dass man auch echt was machen kann von dort aus" und „alles über die
// Plattform steuern: Claude spielt die Posts ein, wir prüfen, bearbeiten und
// posten dort".
//
// Ort: Reiter „Social" im Mara-Steuerpult (/chef/s/mara?reiter=social). Keine
// neue Chef-Seite (Hausregel 26.09.).
//
// WARUM IN shared/: Server (server/routes/fiaon-social.ts), Oberfläche
// (ChefMaraSocial + social/*) und Prüfstand (scripts/pruef-social.ts) lesen
// dieselben Regeln. Eine Regel, ein Ort. Alles hier ist rein: kein DB-Zugriff,
// keine Node-Module, `jetzt` kommt als Parameter. Der Wort-Check läuft so live
// im Browser — VERBINDLICH ist aber immer der Server (Import, Freigeben).
//
// Inhalt:
//   1. Status und Übergänge
//   2. Kanäle mit Zeichengrenzen, Formate, Rollen
//   3. Checklisten je Kanal und KI-Pflichthaken
//   4. Instagram-Raster 3:4 (Mitte aus 4:5)
//   5. Wort-Check als Hülle um globalWortPruefen mit fester Ausnahmeliste
//   6. Manifest fiaon-social-post/1 (Import) — Prüfung und Import-Prüfsumme
//   7. Planprüfung (zwei Reels zur selben Zeit, Lücken)
//   8. API-Vertrag (Typen der Antworten, Pfade)
//   9. Website-Feed (E-296): Sichtbarkeit, Bilder, Text und Hashtags, Reihenfolge
//      — der Vertrag zur Seite steht in shared/fiaon-sozial-feed.ts
// ═══════════════════════════════════════════════════════════════════════════
import { globalWortPruefen, GLOBAL_SCHAERFER, type GlobalWorthinweis } from "./fiaon-global-wortregeln";
import { WORTREGELN } from "./fiaon-wortverbote";
import { ANGEBOT_GARANTIE_FEST } from "./fiaon-global-angebot";
import { globalPlanungText } from "./fiaon-global";
import { SOZIAL_WEBSITE_STATUS, SOZIAL_WEBSITE_KANAL, SOZIAL_FEED_MAX } from "./fiaon-sozial-feed";

// ── 1. STATUS ──────────────────────────────────────────────────────────────
export const SOCIAL_STATUS = ["entwurf", "zur_freigabe", "freigegeben", "eingeplant", "veroeffentlicht", "ausgewertet", "verworfen"] as const;
export type SocialStatus = (typeof SOCIAL_STATUS)[number];
export const istSocialStatus = (s: unknown): s is SocialStatus => (SOCIAL_STATUS as readonly string[]).includes(String(s ?? ""));

/** Anzeige je Status. `ton` passt zu den Mara-Statusfarben (gut/warn/krit/neutral). */
export const SOCIAL_STATUS_INFO: Record<SocialStatus, { titel: string; kurz: string; ton: "neutral" | "warn" | "gut" | "krit" | "blau"; erklaerung: string }> = {
  entwurf: { titel: "Entwurf", kurz: "Entwurf", ton: "neutral", erklaerung: "Liegt bei Claude zur Überarbeitung oder ist noch nicht fertig." },
  zur_freigabe: { titel: "Zur Freigabe", kurz: "Prüfen", ton: "warn", erklaerung: "Fertig eingespielt, wartet auf deine Prüfung." },
  freigegeben: { titel: "Freigegeben", kurz: "Frei", ton: "blau", erklaerung: "Geprüft. Darf zur Planzeit veröffentlicht werden." },
  eingeplant: { titel: "Eingeplant", kurz: "Geplant", ton: "blau", erklaerung: "Für die automatische Veröffentlichung vorgemerkt (Phase 2)." },
  veroeffentlicht: { titel: "Veröffentlicht", kurz: "Online", ton: "gut", erklaerung: "Steht im Kanal, mit Link zum Beitrag." },
  ausgewertet: { titel: "Ausgewertet", kurz: "Ausgewertet", ton: "gut", erklaerung: "Kennzahlen sind eingetragen." },
  verworfen: { titel: "Verworfen", kurz: "Verworfen", ton: "krit", erklaerung: "Wird nicht veröffentlicht. Der Grund steht im Verlauf." },
};

/** Erlaubte Übergänge. „veroeffentlicht → veroeffentlicht" heißt: weiteren Kanal melden. */
export const SOCIAL_UEBERGAENGE: Record<SocialStatus, SocialStatus[]> = {
  entwurf: ["zur_freigabe", "verworfen"],
  zur_freigabe: ["freigegeben", "entwurf", "verworfen"],
  freigegeben: ["eingeplant", "veroeffentlicht", "entwurf", "verworfen"],
  eingeplant: ["veroeffentlicht", "freigegeben", "entwurf", "verworfen"],
  veroeffentlicht: ["veroeffentlicht", "ausgewertet"],
  ausgewertet: [],
  verworfen: [],
};
export const darfUebergang = (von: SocialStatus, nach: SocialStatus): boolean => SOCIAL_UEBERGAENGE[von]?.includes(nach) ?? false;

/** Status, in denen der Termin noch verschoben werden darf. */
export const SOCIAL_VERSCHIEBBAR: SocialStatus[] = ["entwurf", "zur_freigabe", "freigegeben", "eingeplant"];

/**
 * Die Knöpfe im Post-Detail. „website“ (E-296): der Schalter „Auf der Website zeigen“ —
 * kein Statuswechsel, aber wie jede Aktion mit version und Verlauf.
 */
export const SOCIAL_AKTIONEN = ["freigeben", "zurueck", "verschieben", "veroeffentlicht", "verwerfen", "ki-haken", "checkliste", "website"] as const;
export type SocialAktion = (typeof SOCIAL_AKTIONEN)[number];

/** Welche Aktionen im aktuellen Status überhaupt angeboten werden (der Server prüft trotzdem jede einzeln). */
export function erlaubteAktionen(status: SocialStatus): SocialAktion[] {
  const a: SocialAktion[] = [];
  if (darfUebergang(status, "freigegeben") && status === "zur_freigabe") a.push("freigeben");
  if (darfUebergang(status, "entwurf")) a.push("zurueck");
  if (SOCIAL_VERSCHIEBBAR.includes(status)) a.push("verschieben");
  if (status === "freigegeben" || status === "eingeplant" || status === "veroeffentlicht") a.push("veroeffentlicht");
  if (darfUebergang(status, "verworfen")) a.push("verwerfen");
  if (status !== "verworfen" && status !== "ausgewertet") a.push("ki-haken", "checkliste");
  if (istWebsiteSchalterStatus(status)) a.push("website");
  return a;
}

// ── 2. KANÄLE, FORMATE, ROLLEN ─────────────────────────────────────────────
export const SOCIAL_KANAELE = ["instagram", "facebook", "tiktok", "youtube_shorts", "linkedin_firma", "linkedin_person", "linkedin_global", "threads"] as const;
export type SocialKanal = (typeof SOCIAL_KANAELE)[number];
export const istSocialKanal = (k: unknown): k is SocialKanal => (SOCIAL_KANAELE as readonly string[]).includes(String(k ?? ""));

export const SOCIAL_FORMATE = ["reel", "karussell", "bild", "story", "dokument", "text"] as const;
export type SocialFormat = (typeof SOCIAL_FORMATE)[number];
export const istSocialFormat = (f: unknown): f is SocialFormat => (SOCIAL_FORMATE as readonly string[]).includes(String(f ?? ""));

export const SOCIAL_MARKEN = ["fiaon", "global"] as const;
export type SocialMarke = (typeof SOCIAL_MARKEN)[number];

export const SOCIAL_ROLLEN = ["bild", "video", "cover", "dokument", "story"] as const;
export type SocialRolle = (typeof SOCIAL_ROLLEN)[number];

export const FORMAT_INFO: Record<SocialFormat, { titel: string }> = {
  reel: { titel: "Reel" },
  karussell: { titel: "Karussell" },
  bild: { titel: "Bild" },
  story: { titel: "Story" },
  dokument: { titel: "Dokument" },
  text: { titel: "Text" },
};

export interface KanalInfo {
  titel: string;
  kurz: string;
  /** CSS-Token für die Kanalfarbe (chef-social.css), getrennt von Status- und Blau-Farben. */
  farbToken: string;
  /** Zeichengrenze der Beschreibung (Caption) laut Plattform. */
  captionMax: number;
  /** Zeichengrenze des ersten Kommentars (null = gibt es dort nicht sinnvoll). */
  kommentarMax: number | null;
  /** Grenze für den Titel (YouTube) — sonst null. */
  titelMax: number | null;
  /** Mit den Inhalten in Phase 1 nur manuell veröffentlicht. */
  manuell: boolean;
}

/** Zeichengrenzen nach Konzept §2.3 (IG 2.200, LinkedIn 3.000, TikTok 2.200, Bio 150). */
export const KANAL_INFO: Record<SocialKanal, KanalInfo> = {
  instagram: { titel: "Instagram", kurz: "IG", farbToken: "--so-kanal-instagram", captionMax: 2200, kommentarMax: 2200, titelMax: null, manuell: true },
  facebook: { titel: "Facebook", kurz: "FB", farbToken: "--so-kanal-facebook", captionMax: 63206, kommentarMax: 8000, titelMax: null, manuell: true },
  tiktok: { titel: "TikTok", kurz: "TT", farbToken: "--so-kanal-tiktok", captionMax: 2200, kommentarMax: 150, titelMax: null, manuell: true },
  youtube_shorts: { titel: "YouTube Shorts", kurz: "YT", farbToken: "--so-kanal-youtube", captionMax: 5000, kommentarMax: 10000, titelMax: 100, manuell: true },
  linkedin_firma: { titel: "LinkedIn · FIAON", kurz: "LI", farbToken: "--so-kanal-linkedin", captionMax: 3000, kommentarMax: 1250, titelMax: null, manuell: true },
  linkedin_person: { titel: "LinkedIn · Justin", kurz: "LI·J", farbToken: "--so-kanal-linkedin", captionMax: 3000, kommentarMax: 1250, titelMax: null, manuell: true },
  linkedin_global: { titel: "LinkedIn · FIAON Global", kurz: "LI·G", farbToken: "--so-kanal-linkedin", captionMax: 3000, kommentarMax: 1250, titelMax: null, manuell: true },
  threads: { titel: "Threads", kurz: "TH", farbToken: "--so-kanal-threads", captionMax: 500, kommentarMax: 500, titelMax: null, manuell: true },
};

/** Profil-Bio (Instagram/TikTok) — für Scheibe 2 (Profile). */
export const BIO_MAX = 150;

/**
 * Zeichen zählen wie die Apps: nach Unicode-Codepunkten, nicht nach UTF-16-Einheiten
 * (ein Emoji zählt nicht doppelt). Zeilenumbrüche zählen mit.
 */
export function zeichenZaehlen(text: string | null | undefined): number {
  return Array.from(String(text ?? "").normalize("NFC")).length;
}

export interface ZeichenStand { kanal: SocialKanal; feld: "caption" | "erster_kommentar"; zeichen: number; max: number; ueber: boolean }

/** Zeichenstand je Kanal für Caption und ersten Kommentar — die Oberfläche zeigt „1.234 / 2.200". */
export function zeichenStaende(p: { caption: string | null; erster_kommentar: string | null; kanaele: readonly string[] }): ZeichenStand[] {
  const out: ZeichenStand[] = [];
  const c = zeichenZaehlen(p.caption);
  const k = zeichenZaehlen(p.erster_kommentar);
  for (const kanal of p.kanaele) {
    if (!istSocialKanal(kanal)) continue;
    const i = KANAL_INFO[kanal];
    out.push({ kanal, feld: "caption", zeichen: c, max: i.captionMax, ueber: c > i.captionMax });
    if (p.erster_kommentar && i.kommentarMax) out.push({ kanal, feld: "erster_kommentar", zeichen: k, max: i.kommentarMax, ueber: k > i.kommentarMax });
  }
  return out;
}

// ── 3. CHECKLISTEN JE KANAL ────────────────────────────────────────────────
export interface ChecklistenPunkt {
  punkt: string;
  text: string;
  /** Pflicht vor „Als veröffentlicht melden" (sonst nur Hilfe). */
  pflicht: boolean;
}

/** Der KI-Haken: bei ki_noetig in JEDEM Kanal Pflicht, bevor „Veröffentlicht" geht (Art. 50 KI-VO, Meta-Regel). */
export const KI_PUNKT = "ki_info";

/**
 * Checkliste je Kanal für genau diesen Post (Konzept §2.3). Rein aus Format,
 * KI-Pflicht und Link berechnet — gespeichert wird nur, was abgehakt ist.
 */
export function checklisteSoll(p: { format: SocialFormat; ki_noetig: boolean; link: string | null; kanaele: readonly string[] }): Partial<Record<SocialKanal, ChecklistenPunkt[]>> {
  const out: Partial<Record<SocialKanal, ChecklistenPunkt[]>> = {};
  const video = p.format === "reel";
  const ki: ChecklistenPunkt[] = p.ki_noetig ? [{ punkt: KI_PUNKT, text: "KI-Info beim Hochladen eingeschaltet", pflicht: true }] : [];
  for (const k of p.kanaele) {
    if (!istSocialKanal(k)) continue;
    const l: ChecklistenPunkt[] = [];
    if (k === "instagram") {
      if (video) l.push({ punkt: "titelbild", text: "Titelbild gewählt", pflicht: false });
      l.push(...ki);
      if (p.kanaele.includes("facebook")) l.push({ punkt: "auch_facebook", text: "„Auch auf Facebook teilen“ an", pflicht: false });
      if (video) l.push({ punkt: "musik", text: "Musik nur aus der Instagram-Bibliothek", pflicht: false });
      if (p.format !== "reel") l.push({ punkt: "alt_text", text: "Alt-Text eingetragen (Erweiterte Einstellungen)", pflicht: false });
    } else if (k === "facebook") {
      l.push(...ki);
    } else if (k === "tiktok") {
      l.push({ punkt: "titelbild", text: "Titelbild gewählt", pflicht: false });
      l.push({ punkt: "beschreibung", text: "Beschreibung eingefügt", pflicht: false });
      l.push(...ki);
    } else if (k === "youtube_shorts") {
      l.push({ punkt: "titel", text: "Titel gesetzt (höchstens 100 Zeichen)", pflicht: false });
      l.push(...(p.ki_noetig ? [{ punkt: KI_PUNKT, text: "„Veränderte oder synthetische Inhalte“ auf Ja", pflicht: true }] : []));
    } else if (k.startsWith("linkedin")) {
      if (p.link) l.push({ punkt: "link_kommentar", text: "Link in den ersten Kommentar", pflicht: false });
      l.push(...ki);
    } else if (k === "threads") {
      l.push(...ki);
    }
    out[k] = l;
  }
  return out;
}

/** Gespeicherte Haken: { instagram: { ki_info: { am, von } } }. */
export type SocialCheckliste = Partial<Record<SocialKanal, Record<string, { am: string; von: string }>>>;

/**
 * Was fehlt, bevor dieser Kanal als veröffentlicht gemeldet werden darf?
 * Liefert die offenen PFLICHT-Punkte (heute nur der KI-Haken).
 */
export function offenePflichtpunkte(soll: Partial<Record<SocialKanal, ChecklistenPunkt[]>>, ist: SocialCheckliste, kanal: SocialKanal): ChecklistenPunkt[] {
  return (soll[kanal] ?? []).filter((p) => p.pflicht && !ist[kanal]?.[p.punkt]);
}

// ── 4. INSTAGRAM-RASTER 3:4 ────────────────────────────────────────────────
/**
 * Instagram zeigt das Profil-Raster seit 2025 im Format 3:4 und schneidet die
 * 4:5-Beiträge seitlich aus der MITTE. Ergebnis in Prozent des Originals — die
 * Oberfläche nutzt `aspect-ratio: 3/4; object-fit: cover; object-position: 50% 50%`,
 * das hier ist dieselbe Rechnung für den Prüfstand und für Zuschnitt-Hinweise.
 */
export function rasterZuschnitt(breite: number | null, hoehe: number | null): { x: number; y: number; breite: number; hoehe: number } {
  const b = Number(breite) || 0, h = Number(hoehe) || 0;
  if (b <= 0 || h <= 0) return { x: 0, y: 0, breite: 100, hoehe: 100 };
  const ziel = 3 / 4;
  const ist = b / h;
  if (Math.abs(ist - ziel) < 1e-6) return { x: 0, y: 0, breite: 100, hoehe: 100 };
  if (ist > ziel) {
    // zu breit (z. B. 4:5 = 0,8) → seitlich schneiden
    const w = (h * ziel) / b * 100;
    return { x: round2((100 - w) / 2), y: 0, breite: round2(w), hoehe: 100 };
  }
  // zu hoch (z. B. 9:16) → oben und unten schneiden
  const hh = (b / ziel) / h * 100;
  return { x: 0, y: round2((100 - hh) / 2), breite: 100, hoehe: round2(hh) };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Symbol in der Rasterkachel wie in der App. */
export const rasterSymbol = (f: SocialFormat): "reel" | "karussell" | null => (f === "reel" ? "reel" : f === "karussell" ? "karussell" : null);

/** Der Zeitregler der Instagram-Vorschau: heute, in 7 Tagen, in 30 Tagen. */
export const VORSCHAU_TAGE = [0, 7, 30] as const;
export type VorschauTage = (typeof VORSCHAU_TAGE)[number];

// ── 5. WORT-CHECK ──────────────────────────────────────────────────────────
// Verbindlich: globalWortPruefen (Hauswand + Global-Regeln E-188). Ausnahmen
// entstehen NUR durch Herausnehmen eines wortgleichen Satzes aus einer festen
// Liste — wie scripts/pruef-wortwand-de.ts und scripts/pruef-individualangebot.ts.
// Hauswand und GLOBAL_SCHAERFER bleiben unverändert. Ein Komma statt Gedanken-
// strich ist NICHT wortgleich und bleibt rot. `gedeckt` bleibt leer: In einem
// öffentlichen Post deckt kein Werkzeug eine Zusage.

export interface SocialAusnahme {
  schluessel: "garantie_annahme" | "vip_bis_zu";
  titel: string;
  grund: string;
  /** Der Satz, der wortgleich herausgenommen wird. */
  satz: string;
  /** Nur bei dieser Marke. */
  marke: SocialMarke;
  /** Muss im SELBEN Feld zusätzlich stehen, sonst greift die Ausnahme nicht. */
  begleitsatz: RegExp | null;
}

export const SOCIAL_AUSNAHMEN: SocialAusnahme[] = [
  {
    schluessel: "garantie_annahme",
    titel: "Garantie-Satz des persönlichen Angebots",
    grund: "E-271: einziger Satz, der „garantieren“ tragen darf — wortgleich ANGEBOT_GARANTIE_FEST.annahmeUnterKnopf",
    satz: ANGEBOT_GARANTIE_FEST.annahmeUnterKnopf,
    marke: "global",
    begleitsatz: /Es gelten Ziel, Frist und Bedingungen (Ihres|des) Vertrags\./,
  },
  {
    schluessel: "vip_bis_zu",
    titel: "„bis zu“ an der VIP-Zahl",
    grund: "E-190: „bis zu“ nur vor dem VIP-Kapitalrahmen",
    satz: globalPlanungText("global_vip", "de"),
    marke: "global",
    begleitsatz: null,
  },
];
export type SocialAusnahmeSchluessel = SocialAusnahme["schluessel"];
export const istAusnahmeSchluessel = (s: unknown): s is SocialAusnahmeSchluessel => SOCIAL_AUSNAHMEN.some((a) => a.schluessel === s);

/** NFC, geschützte und schmale Leerzeichen zu normalen. */
export function textNormal(t: string | null | undefined): string {
  return String(t ?? "").normalize("NFC").replace(/[    ]/g, " ").replace(/\r\n?/g, "\n");
}

/**
 * Freitext-Ausnahmen aus dem Manifest streng auf Schlüssel abbilden.
 * Alles, was nicht eindeutig passt, wird NICHT angewandt (ausnahmen_unbekannt).
 */
export function ausnahmenAusManifest(freitext: unknown): { schluessel: SocialAusnahmeSchluessel[]; unbekannt: string[] } {
  const liste = Array.isArray(freitext) ? freitext.map((x) => String(x ?? "")).filter(Boolean) : [];
  const schluessel = new Set<SocialAusnahmeSchluessel>();
  const unbekannt: string[] = [];
  for (const s of liste) {
    if (s.includes("ANGEBOT_GARANTIE_FEST.annahmeUnterKnopf")) schluessel.add("garantie_annahme");
    else if (/bis zu/i.test(s) && /VIP/.test(s)) schluessel.add("vip_bis_zu");
    else unbekannt.push(s);
  }
  return { schluessel: Array.from(schluessel), unbekannt };
}

export interface SocialWortFeld {
  /** caption, titel, erster_kommentar, alt_text, hashtags, bildtexte[3] … */
  feld: string;
  /** Lesbare Bezeichnung: „Caption", „Folie 4" … */
  titel: string;
  treffer: GlobalWorthinweis[];
  ausnahmen_genutzt: SocialAusnahmeSchluessel[];
}

export interface SocialWortcheck {
  ergebnis: "gruen" | "gruen_mit_ausnahmen" | "rot";
  /** Fingerabdruck der Regelquellen — ändert er sich, prüft der Server neu. */
  regelstand: string;
  geprueft_am: string;
  /** Nur Felder mit Treffern oder genutzten Ausnahmen. */
  felder: SocialWortFeld[];
  /** Freigegebene Ausnahmen dieses Posts (Schlüssel aus SOCIAL_AUSNAHMEN). */
  ausnahmen: SocialAusnahmeSchluessel[];
  ausnahmen_unbekannt: string[];
  /** Selbstauskunft aus dem Manifest — nur angezeigt, nie übernommen. */
  manifest: { ergebnis: string | null; ausnahmen: string[] } | null;
  /** Manifest sagt grün, Server sagt rot (oder umgekehrt). */
  abweichung_zum_manifest: boolean;
}

/** Kleiner, reiner Fingerabdruck (cyrb53) — läuft im Browser und im Server gleich. */
export function fingerabdruck(s: string): string {
  let h1 = 0xdeadbeef ^ 0, h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

/** Regelstand: über alle Muster der Wand, der Global-Regeln und der Ausnahmeliste. */
export const SOCIAL_REGELSTAND: string = fingerabdruck(
  [
    ...WORTREGELN.map((r: { muster: RegExp }) => `${r.muster.source}/${r.muster.flags}`),
    ...GLOBAL_SCHAERFER.map((r) => `${r.muster.source}/${r.muster.flags}`),
    ...SOCIAL_AUSNAHMEN.map((a) => `${a.schluessel}|${a.marke}|${a.satz}|${a.begleitsatz?.source ?? ""}`),
  ].join("\n"),
);

export interface SocialWortEingabe {
  marke: SocialMarke | string;
  titel?: string | null;
  caption?: string | null;
  erster_kommentar?: string | null;
  alt_text?: string | null;
  hashtags?: readonly string[] | null;
  bildtexte?: readonly string[] | null;
  /** Freigegebene Ausnahme-Schlüssel dieses Posts. */
  ausnahmen?: readonly string[] | null;
  ausnahmen_unbekannt?: readonly string[] | null;
  manifest?: { ergebnis: string | null; ausnahmen: string[] } | null;
}

/** Ein Feld prüfen: Ausnahmesätze herausnehmen (nur wenn Marke + Begleitsatz passen), dann globalWortPruefen. */
export function socialFeldPruefen(text: string, marke: string, ausnahmen: readonly string[]): { treffer: GlobalWorthinweis[]; genutzt: SocialAusnahmeSchluessel[] } {
  let t = textNormal(text);
  const genutzt: SocialAusnahmeSchluessel[] = [];
  for (const a of SOCIAL_AUSNAHMEN) {
    if (!ausnahmen.includes(a.schluessel) || a.marke !== marke) continue;
    if (!t.includes(a.satz)) continue;
    if (a.begleitsatz && !a.begleitsatz.test(t)) continue;
    t = t.split(a.satz).join(" ");
    genutzt.push(a.schluessel);
  }
  return { treffer: globalWortPruefen(t, []), genutzt };
}

/** Der Wort-Check eines Posts — jedes Feld einzeln, damit das Studio die Stelle zeigen kann. */
export function socialWortcheck(p: SocialWortEingabe, jetzt: Date = new Date()): SocialWortcheck {
  const ausn = (p.ausnahmen ?? []).filter(istAusnahmeSchluessel);
  const marke = String(p.marke ?? "");
  const felder: SocialWortFeld[] = [];
  const pruefe = (feld: string, titel: string, text: string | null | undefined) => {
    if (!text || !String(text).trim()) return;
    const r = socialFeldPruefen(String(text), marke, ausn);
    if (r.treffer.length || r.genutzt.length) felder.push({ feld, titel, treffer: r.treffer, ausnahmen_genutzt: r.genutzt });
  };
  pruefe("titel", "Titel", p.titel);
  pruefe("caption", "Caption", p.caption);
  pruefe("erster_kommentar", "Erster Kommentar", p.erster_kommentar);
  pruefe("alt_text", "Alt-Text", p.alt_text);
  if (p.hashtags?.length) pruefe("hashtags", "Hashtags", p.hashtags.join(" "));
  (p.bildtexte ?? []).forEach((b, i) => pruefe(`bildtexte[${i}]`, `Folie ${i + 1}`, b));
  const rot = felder.some((f) => f.treffer.length > 0);
  const mitAusn = felder.some((f) => f.ausnahmen_genutzt.length > 0);
  const ergebnis: SocialWortcheck["ergebnis"] = rot ? "rot" : mitAusn ? "gruen_mit_ausnahmen" : "gruen";
  const mErg = p.manifest?.ergebnis ?? null;
  const manifestGruen = mErg == null ? null : /gr(ü|ue)n/i.test(mErg);
  return {
    ergebnis,
    regelstand: SOCIAL_REGELSTAND,
    geprueft_am: jetzt.toISOString(),
    felder,
    ausnahmen: ausn,
    ausnahmen_unbekannt: [...(p.ausnahmen_unbekannt ?? [])],
    manifest: p.manifest ?? null,
    abweichung_zum_manifest: manifestGruen == null ? false : manifestGruen === rot,
  };
}

/** Kurze Zahl für Karten: wie viele Treffer insgesamt. */
export const wortTrefferZahl = (w: SocialWortcheck | null | undefined): number => (w?.felder ?? []).reduce((n, f) => n + f.treffer.length, 0);

/** Mindestlänge für Begründungen (trotzdem freigeben, verwerfen, zurück an Claude). */
export const GRUND_MIN = 10;

// ── 6. MANIFEST fiaon-social-post/1 ────────────────────────────────────────
export const MANIFEST_SCHEMA = "fiaon-social-post/1";
/** Grenzen des Imports (Auftrag E-294). */
export const IMPORT_MAX_DATEI_BYTES = 40 * 1024 * 1024;
export const IMPORT_MAX_DATEIEN = 14;
export const IMPORT_MAX_META_BYTES = 64 * 1024;
/**
 * Gesamtgrenze je Import-Anfrage (E-294, Prüfung 06.10.2026): 14 × 40 MB wären
 * 560 MB auf einem Render-Prozess, in dem auch Telefonie, Mara und Zahlungen
 * laufen. 120 MB reichen für ein Reel samt Titelbild und jedes Karussell.
 */
export const IMPORT_MAX_GESAMT_BYTES = 120 * 1024 * 1024;
/** Mindestlänge des Import-Schlüssels SOCIAL_IMPORT_TOKEN — kürzer gilt als nicht eingerichtet. */
export const IMPORT_TOKEN_MIN = 32;
/** Länge, über die eine Video-Dauer (Sekunden) nicht glaubhaft ist — darüber: null. */
export const SEKUNDEN_GLAUBHAFT = 3600;

export interface ManifestDatei { datei: string; rolle: SocialRolle; sekunden?: number | null; sha256?: string | null }

/** Geprüftes Manifest — nur die Felder, die das Studio braucht; der Rest bleibt in meta_roh. */
export interface SocialManifest {
  schema: string;
  id: string;
  serie: string | null;
  titel: string;
  format: SocialFormat;
  welt: string | null;
  marke: SocialMarke;
  kanaele: SocialKanal[];
  plan: { datum: string; zeit: string | null; zeitzone: string; reihenfolge: number | null };
  status: string | null;
  dateien: ManifestDatei[];
  hashtags: string[];
  themen: string[];
  link: string | null;
  erster_kommentar: string | null;
  ki: { noetig: boolean; grund: string | null };
  wortcheck: { ergebnis: string | null; ausnahmen: string[] } | null;
  bildtexte: string[];
}

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;
const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;
export const EXTERN_ID = /^[a-z0-9][a-z0-9._-]{2,80}$/;

const echtesDatum = (s: string) => {
  if (!ISO_DATUM.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
export const istPlanDatum = echtesDatum;
export const istPlanZeit = (s: unknown): s is string => typeof s === "string" && UHRZEIT.test(s);

/**
 * Prüft ein Manifest. Fehler sind deutsche Sätze. Warnungen sperren nicht.
 * Tolerant: unbekannte Felder werden nicht bemängelt (sie bleiben in meta_roh).
 */
export function manifestPruefen(roh: unknown): { ok: true; manifest: SocialManifest; warnungen: string[] } | { ok: false; fehler: string[] } {
  const f: string[] = [];
  const w: string[] = [];
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return { ok: false, fehler: ["meta.json ist kein JSON-Objekt."] };
  const m = roh as Record<string, any>;
  const schema = String(m.schema ?? "");
  if (!schema.startsWith(MANIFEST_SCHEMA)) f.push(`Das Schema muss „${MANIFEST_SCHEMA}“ sein, gefunden: „${schema || "leer"}“.`);
  const id = String(m.id ?? "");
  if (!EXTERN_ID.test(id)) f.push("Die id fehlt oder enthält unzulässige Zeichen (erlaubt: a–z, 0–9, Punkt, Bindestrich, Unterstrich; 3–81 Zeichen).");
  const titel = String(m.titel ?? "").trim();
  if (!titel) f.push("Der Titel fehlt.");
  if (!istSocialFormat(m.format)) f.push(`Das Format „${String(m.format ?? "")}“ ist unbekannt (erlaubt: ${SOCIAL_FORMATE.join(", ")}).`);
  if (!(SOCIAL_MARKEN as readonly string[]).includes(String(m.marke))) f.push(`Die Marke „${String(m.marke ?? "")}“ ist unbekannt (erlaubt: fiaon, global).`);
  const kanaeleRoh: unknown[] = Array.isArray(m.kanaele) ? m.kanaele : [];
  const kanaele = kanaeleRoh.filter(istSocialKanal) as SocialKanal[];
  const fremd = kanaeleRoh.filter((k) => !istSocialKanal(k));
  if (!kanaele.length) f.push("Es ist kein gültiger Kanal angegeben.");
  if (fremd.length) f.push(`Unbekannte Kanäle: ${fremd.map(String).join(", ")}.`);
  const plan = m.plan && typeof m.plan === "object" ? m.plan : {};
  const datum = String(plan.datum ?? "");
  if (!echtesDatum(datum)) f.push("plan.datum fehlt oder ist kein Datum im Format JJJJ-MM-TT.");
  const zeit = plan.zeit == null || plan.zeit === "" ? null : String(plan.zeit);
  if (zeit !== null && !UHRZEIT.test(zeit)) f.push("plan.zeit muss HH:MM oder null sein.");
  const zeitzone = String(plan.zeitzone ?? "Europe/Berlin");
  if (zeitzone !== "Europe/Berlin") w.push(`Zeitzone „${zeitzone}“ — das Studio rechnet in Berliner Zeit.`);
  const reihenfolge = Number.isInteger(plan.reihenfolge) ? Number(plan.reihenfolge) : Number.isInteger(m.position_im_raster) ? Number(m.position_im_raster) : null;
  const dateienRoh: unknown[] = Array.isArray(m.dateien) ? m.dateien : [];
  const dateien: ManifestDatei[] = [];
  const namen = new Set<string>();
  dateienRoh.forEach((d: any, i) => {
    const name = String(d?.datei ?? "");
    if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) { f.push(`dateien[${i}]: Dateiname fehlt oder enthält einen Pfad.`); return; }
    if (namen.has(name)) { f.push(`dateien[${i}]: „${name}“ steht doppelt im Manifest.`); return; }
    namen.add(name);
    if (!(SOCIAL_ROLLEN as readonly string[]).includes(String(d?.rolle))) { f.push(`dateien[${i}]: Rolle „${String(d?.rolle ?? "")}“ ist unbekannt.`); return; }
    const sha = d?.sha256 == null ? null : String(d.sha256).toLowerCase();
    if (sha !== null && !/^[0-9a-f]{64}$/.test(sha)) { f.push(`dateien[${i}]: sha256 ist keine 64-stellige Hex-Zahl.`); return; }
    const sek = d?.sekunden == null ? null : Number(d.sekunden);
    // 0–3600 s; alles darüber ist kein Reel, sondern ein Tippfehler (und liefe in NUMERIC(6,2) über).
    const sekOk = sek !== null && Number.isFinite(sek) && sek >= 0 && sek <= SEKUNDEN_GLAUBHAFT;
    if (sek !== null && !sekOk) w.push(`dateien[${i}]: sekunden „${String(d.sekunden)}“ ist nicht glaubhaft (0–${SEKUNDEN_GLAUBHAFT}) — nicht übernommen.`);
    dateien.push({ datei: name, rolle: d.rolle, sekunden: sekOk ? Math.round(sek! * 100) / 100 : null, sha256: sha });
  });
  if (dateien.length > IMPORT_MAX_DATEIEN) f.push(`Höchstens ${IMPORT_MAX_DATEIEN} Dateien je Post, das Manifest nennt ${dateien.length}.`);
  const format = m.format as SocialFormat;
  if (istSocialFormat(format) && format !== "text" && !dateien.length) f.push("Das Manifest nennt keine Datei.");
  if (format === "reel" && !dateien.some((d) => d.rolle === "video")) f.push("Ein Reel braucht eine Datei mit Rolle „video“.");
  const bildtexte = Array.isArray(m.bildtexte) ? m.bildtexte.map((x: unknown) => String(x ?? "")) : [];
  const bilder = dateien.filter((d) => d.rolle === "bild").length;
  if (format === "karussell" && bildtexte.length && bildtexte.length !== bilder) w.push(`Karussell: ${bilder} Bilder, aber ${bildtexte.length} Bildtexte.`);
  const ki = m.ki_kennzeichnung && typeof m.ki_kennzeichnung === "object" ? m.ki_kennzeichnung : null;
  if (!ki || typeof ki.noetig !== "boolean") f.push("ki_kennzeichnung.noetig (ja/nein) fehlt — die KI-Kennzeichnung ist Pflicht.");
  const strListe = (x: unknown) => (Array.isArray(x) ? x.map((y) => String(y ?? "").trim()).filter(Boolean) : []);
  if (f.length) return { ok: false, fehler: f };
  return {
    ok: true,
    warnungen: w,
    manifest: {
      schema, id, serie: m.serie ? String(m.serie) : null, titel, format, welt: m.welt ? String(m.welt) : null,
      marke: m.marke as SocialMarke, kanaele: Array.from(new Set(kanaele)),
      plan: { datum, zeit, zeitzone, reihenfolge },
      status: m.status ? String(m.status) : null,
      dateien,
      hashtags: strListe(m.hashtags),
      themen: strListe(m.themen),
      link: m.link ? String(m.link) : null,
      erster_kommentar: m.erster_kommentar ? String(m.erster_kommentar) : null,
      ki: { noetig: !!ki!.noetig, grund: ki!.grund ? String(ki!.grund) : null },
      wortcheck: m.wortcheck && typeof m.wortcheck === "object" ? { ergebnis: m.wortcheck.ergebnis ? String(m.wortcheck.ergebnis) : null, ausnahmen: strListe(m.wortcheck.ausnahmen) } : null,
      bildtexte,
    },
  };
}

/**
 * Kanonischer Text, über den der Server die Import-Prüfsumme (sha256) bildet.
 * OHNE status, plan, erstellt, register und wortcheck.ergebnis — ein verschobener
 * Termin oder ein neuer Status im Manifest ist keine neue Fassung. Dateinamen
 * zählen nicht (Umbenennen ist keine Änderung), nur Reihenfolge, Rolle, sha256.
 */
export function importKanon(m: SocialManifest, caption: string, altText: string | null, dateien: { pos: number; rolle: string; sha256: string }[]): string {
  const norm = (s: string | null) => (s == null ? null : textNormal(s).replace(/[ \t]+$/gm, "").trimEnd());
  return JSON.stringify({
    id: m.id, serie: m.serie, titel: m.titel, format: m.format, welt: m.welt, marke: m.marke,
    kanaele: [...m.kanaele].sort(), hashtags: m.hashtags, themen: m.themen, link: m.link,
    erster_kommentar: norm(m.erster_kommentar), ki: m.ki, ausnahmen: m.wortcheck?.ausnahmen ?? [], bildtexte: m.bildtexte.map((b) => norm(b)),
    caption: norm(caption), alt_text: norm(altText),
    dateien: dateien.map((d) => [d.pos, d.rolle, d.sha256]),
  });
}

/** Ordnerpfade mit „_verworfen…" werden nie importiert (Kollision von launch-09). */
export const istVerworfenerOrdner = (pfad: string | null | undefined): boolean => String(pfad ?? "").split(/[\\/]/).some((s) => s.startsWith("_verworfen"));

// ── 7. PLANPRÜFUNG ─────────────────────────────────────────────────────────
export interface PlanHinweis { art: "reels_gleichzeitig" | "luecke" | "ohne_uhrzeit" | "ueberfaellig"; text: string; datum: string; post_ids: number[] }

/** Warnt vor zwei Reels zur selben Zeit, Tagen ohne Post und überfälligen Freigaben. */
export function planHinweise(
  posts: { id: number; format: string; status: string; plan_datum: string; plan_zeit: string | null }[],
  von: string, bis: string, heute: string,
): PlanHinweis[] {
  const out: PlanHinweis[] = [];
  const aktiv = posts.filter((p) => p.status !== "verworfen");
  const reels = new Map<string, number[]>();
  for (const p of aktiv) {
    if (p.format !== "reel" || !p.plan_zeit) continue;
    const k = `${p.plan_datum} ${p.plan_zeit}`;
    reels.set(k, [...(reels.get(k) ?? []), p.id]);
  }
  reels.forEach((ids, k) => {
    if (ids.length > 1) out.push({ art: "reels_gleichzeitig", text: `${ids.length} Reels zur selben Zeit (${k.slice(11)} Uhr).`, datum: k.slice(0, 10), post_ids: ids });
  });
  const tage = new Set(aktiv.map((p) => p.plan_datum));
  if (echtesDatum(von) && echtesDatum(bis)) {
    const start = von < heute ? heute : von;
    for (let d = new Date(`${start}T12:00:00Z`); d.toISOString().slice(0, 10) <= bis; d.setUTCDate(d.getUTCDate() + 1)) {
      const s = d.toISOString().slice(0, 10);
      if (!tage.has(s)) out.push({ art: "luecke", text: "An diesem Tag ist nichts geplant.", datum: s, post_ids: [] });
    }
  }
  for (const p of aktiv) {
    if (p.plan_datum < heute && (p.status === "zur_freigabe" || p.status === "entwurf")) {
      out.push({ art: "ueberfaellig", text: "Der Termin ist vorbei, der Post ist noch nicht freigegeben.", datum: p.plan_datum, post_ids: [p.id] });
    }
  }
  return out;
}

/** Sortierung im Plan: Datum, dann Uhrzeit (ohne Uhrzeit zuerst), dann Reihenfolge, dann id. */
export function planSortierung(a: { plan_datum: string; plan_zeit: string | null; reihenfolge: number | null; id: number }, b: typeof a): number {
  if (a.plan_datum !== b.plan_datum) return a.plan_datum < b.plan_datum ? -1 : 1;
  const za = a.plan_zeit ?? "", zb = b.plan_zeit ?? "";
  if (za !== zb) return za < zb ? -1 : 1;
  const ra = a.reihenfolge ?? 0, rb = b.reihenfolge ?? 0;
  if (ra !== rb) return ra - rb;
  return a.id - b.id;
}

/** Permalink-Prüfung je Kanal: https und der richtige Host. */
export const PERMALINK_HOSTS: Record<SocialKanal, RegExp> = {
  instagram: /^(www\.)?instagram\.com$/,
  facebook: /^((www|m|web)\.)?facebook\.com$|^fb\.watch$/,
  tiktok: /^((www|vm|vt)\.)?tiktok\.com$/,
  youtube_shorts: /^((www|m)\.)?youtube\.com$|^youtu\.be$/,
  linkedin_firma: /^((www|de)\.)?linkedin\.com$|^lnkd\.in$/,
  linkedin_person: /^((www|de)\.)?linkedin\.com$|^lnkd\.in$/,
  linkedin_global: /^((www|de)\.)?linkedin\.com$|^lnkd\.in$/,
  threads: /^(www\.)?threads\.(net|com)$/,
};
export function permalinkPruefen(kanal: SocialKanal, url: string): string | null {
  let u: URL;
  try { u = new URL(String(url ?? "").trim()); } catch { return "Der Link ist keine gültige Adresse."; }
  if (u.protocol !== "https:") return "Der Link muss mit https:// beginnen.";
  if (!PERMALINK_HOSTS[kanal].test(u.hostname.toLowerCase())) return `Der Link gehört nicht zu ${KANAL_INFO[kanal].titel}.`;
  if (u.pathname.length < 2) return "Der Link zeigt auf die Startseite, nicht auf den Beitrag.";
  return null;
}

// ── 8. API-VERTRAG ─────────────────────────────────────────────────────────
// Alle Studio-Wege: /api/fiaon/chef/social/* (requireChef „geschaeftsfuehrung"),
// Import: POST /api/fiaon/social/import (Bearer SOCIAL_IMPORT_TOKEN).
// Jede Antwort: { ok: true, … } oder SocialFehler { ok:false, error, code }. Schreibende Aktionen
// erwarten `version` (Optimistic Locking) und antworten bei Abweichung mit 409
// { code: "VERSION_VERALTET", version: <aktuell> }.

export const SOCIAL_API = {
  plan: (von: string, bis: string) => `/chef/social/plan?von=${von}&bis=${bis}`,
  post: (id: number) => `/chef/social/post/${id}`,
  aktion: (id: number, a: SocialAktion) => `/chef/social/post/${id}/${a}`,
  zip: (id: number) => `/api/fiaon/chef/social/post/${id}/zip`,
  datei: (id: number) => `/api/fiaon/chef/social/datei/${id}`,
  dateiDownload: (id: number) => `/api/fiaon/chef/social/datei/${id}?download=1`,
  /** marke „alle" (Vorgabe): EIN Raster @fiaon.ltd — das Launch-Raster mischt FIAON und Global (Reihenfolge 1→10). */
  instagram: (tage: number, marke: SocialMarke | "alle" = "alle") => `/chef/social/vorschau/instagram?tage=${tage}&marke=${marke}`,
  /** Nur die Zähler je Status — für die Zahlmarke am Reiter (statt des ganzen Plans). */
  zaehler: "/chef/social/zaehler",
  import: "/api/fiaon/social/import",
  /** E-296: kleine Web-Bilder (480 px JPEG) hochladen — multipart, je Datei ein Feld mit der quelle_id als Name. */
  webVarianten: (id: number) => `/api/fiaon/chef/social/post/${id}/web-varianten`,
} as const;
/** Adresse des Post-Details in der Oberfläche (auch für ICS und Import-Antwort). */
export const studioUrl = (id: number) => `/chef/s/mara?reiter=social&sicht=plan&post=${id}`;

export type SocialFehlerCode =
  | "VERSION_VERALTET" | "WORTCHECK_ROT" | "NUR_INHABER" | "GRUND_FEHLT" | "UEBERGANG_UNZULAESSIG"
  | "KI_HAKEN_FEHLT" | "PERMALINK_FEHLT" | "NICHT_GEFUNDEN" | "UNGUELTIG"
  | "IMPORT_NICHT_EINGERICHTET" | "TOKEN_FALSCH" | "PRUEFSUMME" | "DATEI_FEHLT" | "DATEI_TYP" | "ZU_GROSS"
  | "BEREITS_VEROEFFENTLICHT" | "VERWORFEN" | "VERWORFENER_ORDNER" | "KEIN_BILD" | "KEIN_INSTAGRAM";

export interface SocialFehler {
  ok: false;
  /** Deutscher Satz für die Meldung am Knopf (Hausform wie useDaten/post: `error`). */
  error: string;
  code?: SocialFehlerCode;
  /** Bei VERSION_VERALTET: die aktuelle Version. */
  version?: number;
  /** Bei WORTCHECK_ROT: die roten Felder. */
  felder?: SocialWortFeld[];
  /** Bei KI_HAKEN_FEHLT: die Kanäle ohne Haken. */
  kanaele?: SocialKanal[];
}

export interface SocialIch { stufe: "inhaber" | "geschaeftsfuehrung" | "leitung"; agentId: number | null; name: string; darfTrotzdem: boolean }

export interface SocialDatei {
  id: number;
  pos: number;
  rolle: SocialRolle;
  dateiname: string;
  mime: string;
  bytes: number;
  breite: number | null;
  hoehe: number | null;
  sekunden: number | null;
  sha256: string;
  /** Für img/video im Studio (Range-fähig). */
  url: string;
  /** Download mit Foliennummer im Namen. */
  download_url: string;
  /** „FIAON_03_Folie-02.jpg" — so heißt der Download. */
  download_name: string;
  /** E-296: kleines Web-Bild (480 px breit) für die Website-Kacheln — null, solange keins angelegt ist. */
  web_480: { id: number; breite: number | null; hoehe: number | null } | null;
}

export interface SocialVeroeffentlichung { am: string; permalink: string; plattform_id: string | null; von: string }

/** Eine Karte im Plan. */
export interface SocialPostKarte {
  id: number;
  extern_id: string;
  /** Optimistic Locking: bei jeder Änderung +1. */
  version: number;
  /** Fassung aus dem Import: 1, 2, 3 … (neue Fassung = neuer Inhalt von Claude). */
  fassung: number;
  titel: string;
  serie: string | null;
  format: SocialFormat;
  marke: SocialMarke;
  kanaele: SocialKanal[];
  themen: string[];
  plan_datum: string;
  plan_zeit: string | null;
  /** ISO-Zeitpunkt nur, wenn eine Uhrzeit da ist. */
  plan_zeitpunkt: string | null;
  reihenfolge: number | null;
  status: SocialStatus;
  ki_noetig: boolean;
  wortcheck_ergebnis: SocialWortcheck["ergebnis"] | null;
  wort_treffer: number;
  /** Vorschaubild (Cover bzw. erstes Bild), sonst null. */
  vorschau: { datei_id: number; url: string; breite: number | null; hoehe: number | null } | null;
  dateien_anzahl: number;
  /** Kanäle, die schon als veröffentlicht gemeldet sind. */
  veroeffentlicht_kanaele: SocialKanal[];
  /** E-296: Schalter „Auf der Website zeigen“. */
  website_sichtbar: boolean;
  /** E-296: steht JETZT auf der Website (Schalter, Status, Plantag erreicht, mit Bild). */
  website_jetzt: boolean;
}

export interface SocialVerlaufEintrag { id: number; art: string; von: string; fassung: number | null; grund: string | null; am: string; vorher: unknown; nachher: unknown }

export interface SocialPostDetail extends SocialPostKarte {
  caption: string;
  hashtags: string[];
  erster_kommentar: string | null;
  alt_text: string | null;
  bildtexte: string[];
  link: string | null;
  welt: string | null;
  ki_grund: string | null;
  ausnahmen: SocialAusnahmeSchluessel[];
  wortcheck: SocialWortcheck | null;
  checkliste: SocialCheckliste;
  checkliste_soll: Partial<Record<SocialKanal, ChecklistenPunkt[]>>;
  zeichen: ZeichenStand[];
  freigabe: { von: string | null; am: string | null; grund: string | null; trotz_rot: boolean } | null;
  veroeffentlicht: Partial<Record<SocialKanal, SocialVeroeffentlichung>>;
  kennzahlen: Record<string, unknown>;
  notizen: string | null;
  /** Letzte „Zurück an Claude"-Notiz, solange der Post im Entwurf liegt. */
  zurueck_notiz: string | null;
  /** Seit dem letzten Import im Studio geändert (Re-Import → neue Fassung zur Freigabe). */
  im_studio_bearbeitet: boolean;
  dateien: SocialDatei[];
  zip_url: string;
  verlauf: SocialVerlaufEintrag[];
  erlaubte_aktionen: SocialAktion[];
  /** Warum ein Knopf gesperrt ist — z. B. { freigeben: "Wort-Check rot: …" }. */
  sperren: Partial<Record<SocialAktion, string>>;
  zuletzt_importiert_am: string | null;
  meta_hinweise: string[];
  /** E-296: Stand auf der Website, mit dem Grund, warum (noch) nicht. */
  website: SocialWebsiteStand;
}

export interface SocialPlanAntwort {
  ok: true;
  ich: SocialIch;
  von: string;
  bis: string;
  heute: string;
  posts: SocialPostKarte[];
  hinweise: PlanHinweis[];
  zaehler: Record<SocialStatus, number>;
  /**
   * Die Posts von HEUTE (Berliner Tag), unabhängig vom geblätterten Zeitraum —
   * die Kopfkarte „Heute zu posten" rechnet nur damit (E-294, Prüfung 06.10.2026).
   */
  heute_posts: SocialPostKarte[];
  /**
   * „Zurück an Claude": Entwürfe mit Notiz. Claude liest sie in Scheibe 1 NICHT
   * selbst — die Liste steht im Plan, Justin sagt Claude in der Social-Sitzung Bescheid.
   */
  bei_claude: { id: number; titel: string; plan_datum: string; notiz: string }[];
  /** Nächster Termin ab jetzt (für „Heute zu posten" mit Countdown). */
  naechster: { id: number; titel: string; plan_zeitpunkt: string | null; plan_datum: string; status: SocialStatus } | null;
  speicher_bytes: number;
}

export interface SocialPostAntwort { ok: true; ich: SocialIch; post: SocialPostDetail }

/** Antwort jeder Aktion: der Post nach der Änderung (mit neuer version). */
export interface SocialAktionAntwort { ok: true; post: SocialPostDetail; meldung: string }

export interface SocialRasterKachel {
  post_id: number;
  titel: string;
  format: SocialFormat;
  status: SocialStatus;
  /** Noch nicht veröffentlicht — die Oberfläche zeigt es gedämpft mit Datum. */
  geplant: boolean;
  plan_datum: string;
  plan_zeit: string | null;
  bild: { datei_id: number; url: string; breite: number | null; hoehe: number | null } | null;
  zuschnitt: { x: number; y: number; breite: number; hoehe: number };
  symbol: "reel" | "karussell" | null;
  ki_noetig: boolean;
}

export interface SocialInstagramAntwort {
  ok: true;
  ich: SocialIch;
  tage: number;
  /** „alle" = ein gemeinsames Raster (heute: nur das Konto @fiaon.ltd); „global" erst, wenn es ein eigenes Global-Konto gibt. */
  marke: SocialMarke | "alle";
  /**
   * true: „nur FIAON" / „nur Global" ist ein FILTER auf dem gemeinsamen Raster
   * @fiaon.ltd — im echten Profil stehen die anderen Posts dazwischen. false: das
   * ganze Raster eines eigenen Kontos (Vorgabe „alle" oder ein eigenes Global-Profil).
   */
  nur_filter: boolean;
  stichtag: string;
  profil: { handle: string; name: string; bio: string | null; links: string[]; profilbild_url: string | null; beitraege: number; follower: number | null; quelle: "profil" | "vorgabe" };
  /** Neueste zuerst (oben links), wie in der App. */
  kacheln: SocialRasterKachel[];
}

/** Body der Aktionen (alle mit version). */
export interface SocialAktionKoerper {
  freigeben: { version: number; trotzdem?: boolean; grund?: string };
  zurueck: { version: number; notiz: string };
  verschieben: { version: number; datum: string; zeit: string | null };
  veroeffentlicht: { version: number; meldungen: { kanal: SocialKanal; permalink: string; plattform_id?: string | null }[] };
  verwerfen: { version: number; grund: string };
  "ki-haken": { version: number; noetig: boolean; grund: string };
  checkliste: { version: number; kanal: SocialKanal; punkt: string; erledigt: boolean };
  website: { version: number; sichtbar: boolean };
}

export interface SocialImportAntwort {
  ok: true;
  ergebnis: "neu" | "unveraendert" | "neue_version";
  id: number;
  extern_id: string;
  version: number;
  fassung: number;
  status: SocialStatus;
  vorher_status: SocialStatus | null;
  /** Seit dem letzten Import im Studio geändert — die Studio-Fassung bleibt im Verlauf. */
  konflikt: boolean;
  studio_url: string;
  dateien: { gespeichert: number; schon_vorhanden: number; fehlend: string[] };
  wortcheck: { ergebnis: SocialWortcheck["ergebnis"]; treffer: number; abweichung_zum_manifest: boolean };
  hinweise: string[];
}

// ── 9. WEBSITE-FEED (E-296) ────────────────────────────────────────────────
// Justin (06.10.): „zeig unsere Social Media Profile … auf der Startseite …
// genauso auf der Business Seite“. Der Vertrag zur Seite (Pfade, Antwortform)
// steht in shared/fiaon-sozial-feed.ts; hier die reinen Regeln, die Server
// (server/lib/fiaon-sozial-feed.ts), Studio und Prüfstand gemeinsam lesen.
//
// Auf die Website kommt ein Post NUR, wenn ALLES zutrifft:
//   · Schalter website_sichtbar an (Studio; „als veröffentlicht melden“ setzt ihn beim ersten
//     Melden mit — außer bei rotem Wort-Check, ohne Instagram-Kanal, ohne Bild, oder wenn der
//     Schalter für diese Fassung schon einmal von Hand geschaltet wurde),
//   · freigegeben (freigegeben/eingeplant/veröffentlicht/ausgewertet) mit Instagram als Kanal —
//     Justin 06.10.2026 abends, nach Hinweis auf das Gutachten (nur Gemeldetes zeigen): sofort zeigen,
//     was er freigegeben hat; der Instagram-Link erscheint, sobald er gemeldet ist,
//   · Plantag (Europe/Berlin) erreicht — nie etwas vor seinem Tag,
//   · Wort-Check nach den AKTUELLEN Regeln nicht rot (der Feed rechnet ihn bei jedem Laden neu),
//   · mindestens ein Bild (JPEG/PNG): Karussell und Bild die Folien, Reel das Titelbild.

/** Status, in denen ein Post auf der Website STEHT (ab der Freigabe, mit Instagram-Kanal). */
export const istWebsiteStatus = (s: unknown): boolean => (SOZIAL_WEBSITE_STATUS as readonly string[]).includes(String(s ?? ""));
/** Status, in denen der Schalter „Auf der Website zeigen“ eingeschaltet (vorgemerkt) werden darf. */
export const WEBSITE_SCHALTER_STATUS = ["freigegeben", "eingeplant", "veroeffentlicht", "ausgewertet"] as const;
export const istWebsiteSchalterStatus = (s: unknown): boolean => (WEBSITE_SCHALTER_STATUS as readonly string[]).includes(String(s ?? ""));

/** Rollen, deren Bilder öffentlich ausgeliefert werden dürfen (Original oder web_480). */
export const WEB_BILD_ROLLEN = ["bild", "cover"] as const;
export const WEB_BILD_MIMES = ["image/jpeg", "image/png"] as const;
/** Breite der kleinen Web-Bilder (Kacheln) und die Obergrenze, die der Server annimmt. */
export const WEB_480_BREITE = 480;
export const WEB_480_MAX_BREITE = 600;
export const WEB_480_QUALITAET = 0.82;
/** Ein kleines Web-Bild ist höchstens so groß — 480 px JPEG liegen bei 30–90 KB. */
export const WEB_480_MAX_BYTES = 1024 * 1024;

/** Kurze Regel für Studio und Prüfstand — wortgleich an einem Ort. */
export const WEBSITE_REGEL = "Steht auf fiaon.com (Startseite, Privatkunden, Business und passende Ratgeber) ab dem Plantag — nach der Freigabe, nur Posts für Instagram, nur mit Bild und nur bei grünem Wort-Check. „Auf Instagram ansehen“ erscheint, sobald der Link gemeldet ist.";

export interface FeedDateiEintrag { datei_id: number; pos: number; rolle: string; mime?: string | null; breite?: number | null; hoehe?: number | null }

/**
 * Welche Bilder eines Posts auf die Website kommen, in Reihenfolge:
 * Reel → das Titelbild (cover); sonst die Folien (rolle bild, nach pos);
 * gibt es keine Folie, das Titelbild. Nur JPEG/PNG, jede Datei einmal.
 */
export function feedBildEintraege<T extends FeedDateiEintrag>(format: string, dateien: readonly T[]): T[] {
  const bildArtig = (d: T) => !d.mime || (WEB_BILD_MIMES as readonly string[]).includes(String(d.mime));
  const sortiert = [...(dateien ?? [])].filter((d) => d && Number.isFinite(Number(d.datei_id))).sort((a, b) => Number(a.pos) - Number(b.pos));
  const cover = sortiert.filter((d) => d.rolle === "cover" && bildArtig(d));
  const folien = sortiert.filter((d) => d.rolle === "bild" && bildArtig(d));
  const wahl = format === "reel" ? cover.slice(0, 1) : folien.length ? folien : cover.slice(0, 1);
  const gesehen = new Set<number>();
  return wahl.filter((d) => (gesehen.has(Number(d.datei_id)) ? false : (gesehen.add(Number(d.datei_id)), true)));
}

export type WebsiteGrund = "aus" | "status" | "instagram" | "plantag" | "kein_bild" | "wortcheck";
export interface SocialWebsiteStand {
  /** Schalter an? */
  sichtbar: boolean;
  /** Steht jetzt auf der Website? */
  jetzt: boolean;
  /** Warum (noch) nicht — null, wenn jetzt sichtbar. */
  grund: WebsiteGrund | null;
  /** Ab diesem Tag (Plantag), wenn der Schalter an ist. */
  ab: string;
  /** Darf der Schalter eingeschaltet werden (Status ab Freigabe, Instagram-Kanal, Bild da, Wort-Check nicht rot)? */
  darf_an: boolean;
  /** Satz für das Studio. */
  satz: string;
  /** Wie viele Bilder die Website zeigt und wie viele davon schon ein kleines Web-Bild haben. */
  bilder: number;
  web_480: number;
}

/**
 * Die eine Sichtbarkeitsregel (rein; `heute` = Berliner Tag JJJJ-MM-TT).
 * Der Feed rechnet sie in SQL (Schalter, Status, Instagram-Meldung, Plantag) und in JS (Bild, Wort-Check) —
 * gleiches Ergebnis. `kanaele`: Kanäle des Posts; `gemeldet`: Kanäle, die als veröffentlicht gemeldet sind.
 * Ohne Angabe von `kanaele` gilt Instagram als vorhanden (alte Aufrufer), ohne `gemeldet` gilt: gemeldet, wenn der
 * Status veröffentlicht/ausgewertet ist.
 */
export function websiteStand(p: {
  website_sichtbar: boolean; status: string; plan_datum: string; format: string; dateien: readonly FeedDateiEintrag[];
  wortcheck_rot?: boolean; web_480_ids?: ReadonlySet<number>; kanaele?: readonly string[]; gemeldet?: readonly string[];
}, heute: string): SocialWebsiteStand {
  const bilder = feedBildEintraege(p.format, p.dateien ?? []);
  const web = bilder.filter((b) => p.web_480_ids?.has(Number(b.datei_id))).length;
  const schalterOk = istWebsiteSchalterStatus(p.status);
  const hatKanal = p.kanaele ? p.kanaele.includes(SOZIAL_WEBSITE_KANAL) : true;
  const darfAn = schalterOk && hatKanal && bilder.length > 0 && !p.wortcheck_rot;
  const tag = String(p.plan_datum ?? "");
  const tagText = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? `${tag.slice(8, 10)}.${tag.slice(5, 7)}.${tag.slice(0, 4)}` : tag;
  let grund: WebsiteGrund | null = null;
  if (!p.website_sichtbar) grund = "aus";
  else if (!schalterOk) grund = "status";
  else if (!bilder.length) grund = "kein_bild";
  else if (p.wortcheck_rot) grund = "wortcheck";
  else if (!hatKanal) grund = "instagram";
  else if (tag > heute) grund = "plantag";
  const satz = grund === null ? "Steht jetzt auf der Website."
    : grund === "aus" ? (darfAn ? "Nicht auf der Website." : !schalterOk ? "Nicht auf der Website — erst nach der Freigabe möglich." : !hatKanal ? "Nicht auf der Website — der Post geht nicht auf Instagram." : !bilder.length ? "Nicht auf der Website — der Post hat kein Bild." : "Nicht auf der Website — der Wort-Check ist rot.")
    : grund === "status" ? "Schalter an, aber der Post ist nicht (mehr) freigegeben — die Website zeigt ihn nicht."
    : grund === "kein_bild" ? "Schalter an, aber ohne Bild zeigt die Website nichts."
    : grund === "wortcheck" ? "Schalter an, aber der Wort-Check ist rot — die Website zeigt ihn nicht."
    : grund === "instagram" ? "Schalter an, aber der Post geht nicht auf Instagram — die Website zeigt ihn nicht."
    : `Schalter an — steht ab dem Plantag ${tagText} auf der Website.`;
  return { sichtbar: !!p.website_sichtbar, jetzt: grund === null, grund, ab: tag, darf_an: darfAn, satz, bilder: bilder.length, web_480: web };
}

// Text und Hashtags für die Website
export const FEED_TEXT_MAX = 280;
export const FEED_HASHTAGS_MAX = 5;
// Unicode-Klassen (\p{L}: Umlaute in #Bonität) über den Konstruktor — das Ziel im tsconfig kennt das u-Flag als Literal nicht.
const HASHTAG_ZEICHEN = "[\\p{L}\\p{N}_]";
const HASHTAG = new RegExp(`(^|[\\s(\\[{"„“'‚‘])#${HASHTAG_ZEICHEN}+`, "gu");
const HASHTAG_FANGEN = new RegExp(`#(${HASHTAG_ZEICHEN}+)`, "gu");
const HASHTAG_GANZ = new RegExp(`^${HASHTAG_ZEICHEN}{1,60}$`, "u");

/** Bildunterschrift ohne Hashtags; leere Abstandszeilen („.“) und doppelte Leerzeilen raus. */
export function captionOhneHashtags(caption: string | null | undefined): string {
  const ohne = textNormal(caption).replace(HASHTAG, "$1");
  const zeilen = ohne.split("\n").map((z) => z.replace(/[ \t]+/g, " ").trim()).map((z) => (/^[.·•\-–—_]+$/.test(z) ? "" : z));
  return zeilen.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Abkürzungen, nach deren Punkt KEIN Satz endet („zzgl. USt.“, „z. B.“, „Art. 15“). */
const ABKUERZUNGEN = new Set(["z", "b", "d", "h", "u", "a", "o", "bzw", "ca", "inkl", "zzgl", "ggf", "evtl", "usw", "etc", "nr", "art", "abs", "dr", "hr", "fr", "st", "vgl", "sog", "mio", "mrd", "tsd", "max", "min", "mind", "gem", "jan", "feb", "mrz", "apr", "jun", "jul", "aug", "sep", "sept", "okt", "nov", "dez", "tel", "std", "mo", "di", "mi", "do", "sa", "so"]);

/**
 * Höchstens `max` Zeichen (Codepunkte, wie zeichenZaehlen), mit „…“ — das „…“ zählt mit.
 * Gekürzt wird bevorzugt nach einem GANZEN Satz oder einer ganzen Zeile (dann „ …“):
 * ein halber Satz kann den Sinn umdrehen („Die Bank erhöht…“ statt „… erhöht nicht von
 * selbst“). Nur wenn im hinteren Teil kein Satzende liegt, an der letzten Wortgrenze.
 * Zeilenumbrüche bleiben (die Seite setzt white-space: pre-line).
 */
export function feedTextKuerzen(text: string, max: number = FEED_TEXT_MAX): string {
  const t = String(text ?? "").trim();
  const z = Array.from(t);
  if (z.length <= max) return t;
  // 1) Satzende oder Zeilenende — frühestens nach 40 % der Länge.
  const roh = z.slice(0, max - 2).join("");
  let satz = -1;
  for (const m of Array.from(roh.matchAll(/[.!?…](?=["“”»)]?\s)|\n/g))) {
    const i = m.index ?? -1;
    let ende = i;
    if (m[0] !== "\n") {
      const wort = (/([A-Za-zÄÖÜäöüß]+)$/.exec(roh.slice(0, i))?.[1] ?? "").toLowerCase();
      // „1. Juli“, „2.499 €“: Ziffer vor dem Punkt ist kein Satzende; Abkürzungen auch nicht.
      if (m[0] === "." && (/\d$/.test(roh.slice(0, i)) || ABKUERZUNGEN.has(wort))) continue;
      ende = i + 1;
      if (/["“”»)]/.test(roh[ende] ?? "")) ende++;
    }
    if (Array.from(roh.slice(0, ende)).length >= max * 0.4) satz = ende;
  }
  if (satz > 0) return `${roh.slice(0, satz).trimEnd()} …`;
  // 2) Rückfall: an der letzten Wortgrenze (wenn dabei nicht mehr als ein Drittel verloren geht).
  let stueck = z.slice(0, max - 1).join("");
  const grenze = Math.max(stueck.lastIndexOf(" "), stueck.lastIndexOf("\n"));
  if (grenze > (max * 2) / 3) stueck = stueck.slice(0, grenze);
  stueck = stueck.replace(/[\s,;:–—\-(/]+$/, "");
  return `${stueck}…`;
}

/** Hashtags für die Website: aus der Liste des Posts (sonst aus der Caption), ohne „#“, ohne Doppelte, höchstens fünf. */
export function feedHashtags(liste: readonly string[] | null | undefined, caption?: string | null): string[] {
  const roh = (liste ?? []).length ? (liste ?? []).map(String) : Array.from(textNormal(caption).matchAll(HASHTAG_FANGEN)).map((m) => m[1]);
  const out: string[] = [];
  const gesehen = new Set<string>();
  for (const h of roh) {
    const t = h.trim().replace(/^#+/, "");
    if (!t || !HASHTAG_GANZ.test(t)) continue;
    const k = t.toLocaleLowerCase("de-DE");
    if (gesehen.has(k)) continue;
    gesehen.add(k);
    out.push(t);
    if (out.length >= FEED_HASHTAGS_MAX) break;
  }
  return out;
}

/** ?thema=… streng: a–z, 0–9, Bindestrich, Unterstrich, 1–40 Zeichen — sonst kein Thema. */
export function feedThemaSlug(roh: unknown): string | null {
  const s = String(roh ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s) ? s : null;
}
/** ?n=… 1…12, Standard 9. */
export function feedAnzahl(roh: unknown): number {
  const n = Number(roh);
  if (roh == null || roh === "" || !Number.isFinite(n)) return 9;
  return Math.min(SOZIAL_FEED_MAX, Math.max(1, Math.round(n)));
}
/** ?marke=… fiaon | global | alle (Standard). */
export const feedMarke = (roh: unknown): "fiaon" | "global" | "alle" => (roh === "fiaon" || roh === "global" ? roh : "alle");

/**
 * Reihenfolge im Feed: neueste zuerst — Veröffentlichung, sonst geplanter Zeitpunkt,
 * sonst Plantag (Berliner Mitternacht). Gleichstand: höhere Reihenfolge (später gepostet)
 * zuerst, dann höhere id.
 */
export function feedSortierung(a: { zeit_ms: number; reihenfolge: number | null; id: number }, b: typeof a): number {
  if (a.zeit_ms !== b.zeit_ms) return b.zeit_ms - a.zeit_ms;
  const ra = a.reihenfolge ?? -1, rb = b.reihenfolge ?? -1;
  if (ra !== rb) return rb - ra;
  return b.id - a.id;
}

/** Passende zuerst (Thema im Post), sonst die Reihenfolge behalten. */
export function feedNachThema<T extends { themen: readonly string[] }>(liste: readonly T[], thema: string | null): T[] {
  if (!thema) return [...liste];
  const passt = (p: T) => p.themen.some((t) => String(t).toLowerCase() === thema);
  return [...liste.filter(passt), ...liste.filter((p) => !passt(p))];
}
