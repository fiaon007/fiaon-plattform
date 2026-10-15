// ═══════════════════════════════════════════════════════════════════════════
// EIGENE BESUCHERMESSUNG — DIE REGELN (15.10.2026, E-378)
//
// Justin: „Besucher hat nie funktioniert … ich brauche super detaillierte
// Aufschlüsselungen." Microsoft Clarity gibt über die Schnittstelle nur die
// letzten ein bis drei Tage als Summe heraus, zehn Abrufe am Tag, und zählt nur,
// wer im Cookie-Hinweis zustimmt. Daraus wird nie ein Cockpit.
//
// Deshalb misst fiaon.com selbst — OHNE Cookies und OHNE Speicher im Browser
// (§ 25 TDDDG): kein localStorage, kein sessionStorage, keine Kennung im Gerät.
// Der Browser schickt je Seitenwechsel nur Pfad, Herkunfts-Host, Kampagnen-
// angaben (utm_*), ob eine Klick-Kennung (fbclid/gclid) in der Adresse stand
// (nie ihr Wert) und die sichtbare Zeit. Geräteklasse, Sprache und Land liest der
// Server aus den Kopfzeilen der Anfrage. Wer ein Besucher ist, rechnet der
// Server aus einem Tages-Salz, IP, Browserkennung und Host (server/lib/
// fiaon-besuch.ts) — die IP wird nie gespeichert, das Salz nie länger als den Tag.
//
// Diese Datei ist REIN (ohne Datenbank, ohne Browser): Browser, Server und der
// Prüfstand (scripts/pruef-e378.ts) lesen dieselben Regeln.
//
// ── DER PFAD IST DIE EINHEIT ──────────────────────────────────────────────
// Wie im Clarity-Teil (fiaon-chef-clarity.ts): ohne Abfrage, ohne Anker, ohne
// Schrägstrich am Ende, klein geschrieben. Persönliche Links (Zahlung, Termin,
// Zustimmung, Unterlagen …) tragen eine Kennung im Pfad — sie wird zu „…".
// Eine Kennung im Pfad ist ein Schlüssel zu einem Menschen, keine Seite.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Interne Bereiche — dieselbe Liste wie INTERN in components/site/EinwilligungsHinweis.tsx (dort liest
 * scripts/pruef-zugang-uebergabe.ts den Text; scripts/pruef-e378.ts hält beide Listen gleich).
 */
export const BEREICH_INTERN = /^\/(agent|admin|chef|akte|admindashboard|onboarding|inkasso|team-intern|buchhaltung|banking)(\/|$)/i;
/** Seiten mit Passwort, IBAN oder Vertrag im Bild — dort misst niemand, auch nicht mit Einwilligung (= OHNE_MESSUNG dort). */
export const BEREICH_OHNE_MESSUNG = /^\/(business\/angebot|zugang\/uebergabe|auszahlung-ausfuehren)(\/|$)/i;
/**
 * E-378: Der Kundenbereich (/app, „Mein Bereich", Kundensicht der Mitarbeiter) zählt NICHT als Besuch —
 * dort sind angemeldete Kunden, keine Reichweite. Gezählt wird, was ein Fremder auf fiaon.com sehen kann.
 */
export const BEREICH_KUNDE = /^\/(app|dashboard|dashboard-alt|mein-bereich|als-kunde|mitarbeiter)(\/|$)/i;

/** Zählt dieser Pfad als Besuch der öffentlichen Seite? Rein. */
export function besuchGezaehlt(pfad: string): boolean {
  return !BEREICH_INTERN.test(pfad) && !BEREICH_OHNE_MESSUNG.test(pfad) && !BEREICH_KUNDE.test(pfad);
}

/** Der Antrag — wer diese Pfade sieht, hat den Antrag geöffnet. */
export const ANTRAG_PFADE = ["/antrag", "/antrag-neu"] as const;

/**
 * Persönliche Links: alles hinter dem Anfang ist eine Kennung. Reihenfolge zählt —
 * „/termin/absagen/…" vor „/termin/…", „/termin/justin" ist die öffentliche Buchungsseite.
 */
const PERSOENLICH: [RegExp, string][] = [
  [/^\/termin\/absagen\/.+/, "/termin/absagen/…"],
  [/^\/termin\/(?!justin$)[^/]+/, "/termin/…"],
  [/^\/zustimmung\/.+/, "/zustimmung/…"],
  [/^\/unterlagen\/.+/, "/unterlagen/…"],
  [/^\/zahlung\/[^/]+\/danke$/, "/zahlung/…/danke"],
  [/^\/zahlung\/.+/, "/zahlung/…"],
  [/^\/zugang\/.+/, "/zugang/…"],
  [/^\/abmelden\/.+/, "/abmelden/…"],
  [/^\/business\/auftrag\/.+/, "/business/auftrag/…"],
  [/^\/en\/business\/auftrag\/.+/, "/en/business/auftrag/…"],
];

/**
 * Sieht dieser Pfadteil aus wie eine Kennung statt wie ein Wort?
 * FIAON-Referenz, UUID, reine Ziffern ab vier Stellen, oder 16+ Zeichen mit Ziffer, die kein Wort-Slug sind
 * („kredit-ohne-schufa-2026" bleibt, „a1b2c3d4e5f6g7h8" geht).
 */
export function istKennung(teil: string): boolean {
  if (!teil) return false;
  if (/^fiaon-/i.test(teil)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(teil)) return true;
  if (/^\d{4,}$/.test(teil)) return true;
  if (teil.length >= 16 && /\d/.test(teil) && !/^[a-zäöüß]+(-[a-zäöüß0-9]+)+$/.test(teil)) return true;
  return false;
}

/**
 * Aus einer Adresse den Pfad machen, der gezählt wird — oder null (intern, Kundenbereich, Unsinn).
 * Rein. Der Server ruft das IMMER selbst auf; was der Browser schickt, ist nur ein Vorschlag.
 */
export function besuchPfad(roh: unknown): string | null {
  let p = String(roh ?? "").split(/[?#]/)[0].trim();
  if (!p.startsWith("/")) return null;
  try { p = decodeURIComponent(p); } catch { /* roh lassen */ }
  // Steuerzeichen, Anführungszeichen und spitze Klammern haben in einem Pfad nichts zu suchen.
  p = p.replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "").toLowerCase().replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
  if (!p.startsWith("/")) return null;
  if (!besuchGezaehlt(p)) return null;
  for (const [muster, ersatz] of PERSOENLICH) if (muster.test(p)) return ersatz;
  p = p.split("/").map((t) => (istKennung(t) ? "…" : t)).join("/");
  return p.slice(0, 160);
}

// ── Geräteklasse und Sprache ────────────────────────────────────────────────
// E-378: Beides liest der SERVER aus den Kopfzeilen, die jeder Aufruf ohnehin mitbringt
// (Browserkennung, Accept-Language) — das Skript im Browser fragt weder Fensterbreite noch
// Sprache ab. Was nicht aus dem Gerät gelesen wird, muss auch niemand erklären.
export type GeraeteKlasse = "mobil" | "tablet" | "desktop";

/** Aus der Browserkennung die Klasse. iPads mit Desktop-Kennung (iPadOS) zählen als Computer — ehrlich ungenau. Rein. */
export function geraetAusKennung(ua: unknown): GeraeteKlasse {
  const s = String(ua ?? "");
  if (/ipad|tablet|kindle|silk|playbook|sm-t\d|tab\b/i.test(s) || (/android/i.test(s) && !/mobile/i.test(s))) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone|blackberry|opera mini/i.test(s)) return "mobil";
  return "desktop";
}

/** „de-DE,de;q=0.9,en;q=0.8" → „de". Nur zwei Buchstaben, sonst null. Rein. */
export function spracheKurz(roh: unknown): string | null {
  const erste = String(roh ?? "").split(",")[0].split(";")[0].trim().toLowerCase();
  const m = erste.match(/^([a-z]{2})(?:[-_][a-z0-9]+)*$/);
  return m ? m[1] : null;
}

// ── Roboter ─────────────────────────────────────────────────────────────────
/**
 * Browserkennungen, die kein Mensch hat. Suchmaschinen führen unser Skript aus und würden sonst
 * als Besucher zählen; Vorschau-Dienste (WhatsApp, Facebook) holen Seiten beim Teilen eines Links.
 * „bot" nur mit Trennzeichen dahinter oder als eigenes Wort — „Cubot X30" ist ein Telefon, kein Roboter.
 */
const ROBOTER = /bot[\/;)\-_]|\bbot\b|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|facebookcatalog|meta-externalagent|telegrambot|mediapartners|feedfetcher|apis-google|google-read-aloud|favicon|embedly|curl\/|wget\/|python|node-fetch|axios\/|go-http|okhttp|java\/|phantom|selenium|puppeteer|playwright|cypress|bingpreview|google-inspectiontool|chrome-lighthouse|pingdom|uptimerobot|statuscake|ahrefs|semrush|mj12|dotbot|petalbot|yandex|baiduspider|bytespider|gptbot|claudebot|ccbot|perplexity|amazonbot|applebot|duckduckbot|qwantify|seznam|sogou|exabot|ia_archiver|datanyze|screaming frog|sitebulb/i;

/** Kein Besuch: leere oder Roboter-Kennung, oder eine ohne „Mozilla/" (jeder Browser schickt das). Rein. */
export function istBesuchRoboter(ua: unknown): boolean {
  const s = String(ua ?? "").slice(0, 600);
  if (s.trim().length < 20) return true;
  if (!/mozilla\//i.test(s)) return true;
  return ROBOTER.test(s);
}

// ── Herkunft und Kanal ──────────────────────────────────────────────────────
/** Unsere eigenen Wirte — ein Verweis von dort ist ein Seitenwechsel, keine Herkunft. */
export const EIGENE_WIRTE = /(^|\.)fiaon\.com$|^fiaon-plattform\.onrender\.com$|^localhost$|^127\.0\.0\.1$/i;

/** Den Host eines Verweises säubern: klein, ohne „www.", „m.", „l.", „lm."; eigene Wirte → null. Rein. */
export function herkunftHost(roh: unknown, eigenerWirt?: string | null): string | null {
  let h = String(roh ?? "").trim().toLowerCase();
  if (!h) return null;
  if (!/^[a-z0-9.-]{1,120}$/.test(h) || !h.includes(".")) return null;
  if (EIGENE_WIRTE.test(h) || (eigenerWirt && h === eigenerWirt.toLowerCase())) return null;
  h = h.replace(/^(www|m|l|lm|mobile|out)\./, "");
  return h;
}

export interface Kampagne {
  source: string | null; medium: string | null; campaign: string | null; content: string | null; term: string | null;
}
export const KAMPAGNE_LEER: Kampagne = { source: null, medium: null, campaign: null, content: null, term: null };

/** Die Kanäle in der Reihenfolge, in der die Seite sie erklärt. */
export const KANAELE = [
  "Meta-Anzeige", "Google-Anzeige", "Anzeige (sonstige)", "Facebook/Instagram", "Suche", "Social", "WhatsApp",
  "E-Mail", "KI-Assistent", "Kampagne", "Verweis", "Direkt",
] as const;
export type Kanal = (typeof KANAELE)[number];

const SUCHE = /(^|\.)(google|bing|duckduckgo|ecosia|yahoo|qwant|startpage|yandex|baidu|brave|search\.brave|ask|web\.de|gmx\.(net|de)|t-online)\.[a-z.]+$|^search\./;
const SOCIAL_META = /(^|\.)(facebook|instagram|fb)\.(com|me)$/;
const SOCIAL = /(^|\.)(t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|tiktok\.com|youtube\.com|youtu\.be|pinterest\.[a-z.]+|reddit\.com|xing\.com|threads\.net|snapchat\.com)$/;
const WHATSAPP = /(^|\.)(whatsapp\.com|wa\.me|wl\.co)$/;
const MAIL = /(^|\.)(mail\.google\.com|outlook\.(live|office)\.com|email\.t-online\.de|mail\.yahoo\.com|webmail\.|mail\.)/;
const KI = /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|gemini\.google\.com|copilot\.microsoft\.com|claude\.ai|you\.com|phind\.com)$/;
const BEZAHLT = /^(cpc|ppc|paid|paid[_ -]?social|paidsocial|ads?|cpm|display|sponsored|paid[_ -]?search)$/i;

/**
 * Woher kommt eine Sitzung? Kampagnenangaben vor Klick-Kennung vor Verweis. Rein.
 * fbclid ohne utm heißt nur „von Facebook/Instagram" — Meta hängt sie an JEDEN ausgehenden Link,
 * an Anzeigen wie an Beiträge. „Meta-Anzeige" nur, wenn die Anzeige es selbst sagt (utm_medium bezahlt).
 */
export function besuchKanal(e: { herkunft: string | null; kampagne: Kampagne; fbclid: boolean; gclid: boolean }): Kanal {
  const src = String(e.kampagne.source ?? "").toLowerCase();
  const med = String(e.kampagne.medium ?? "").toLowerCase();
  const istMeta = /^(facebook|fb|instagram|ig|meta|an|audience_network|messenger)$/.test(src) || /facebook|instagram/.test(src);
  if (BEZAHLT.test(med) || e.gclid) {
    if (istMeta || (e.fbclid && !e.gclid)) return "Meta-Anzeige";
    if (e.gclid || /google|adwords/.test(src)) return "Google-Anzeige";
    return "Anzeige (sonstige)";
  }
  if (src) {
    if (istMeta) return "Facebook/Instagram";
    if (/whatsapp|^wa$/.test(src)) return "WhatsApp";
    if (/mail|newsletter|brevo/.test(src) || /mail/.test(med)) return "E-Mail";
    if (/google|bing/.test(src) && /organic/.test(med)) return "Suche";
    return "Kampagne";
  }
  if (e.fbclid) return "Facebook/Instagram";
  const h = e.herkunft;
  if (!h) return "Direkt";
  if (SOCIAL_META.test(h)) return "Facebook/Instagram";
  if (WHATSAPP.test(h)) return "WhatsApp";
  if (KI.test(h)) return "KI-Assistent";
  if (MAIL.test(h)) return "E-Mail";
  if (SUCHE.test(h)) return "Suche";
  if (SOCIAL.test(h)) return "Social";
  return "Verweis";
}

// ── Was der Browser schicken darf ───────────────────────────────────────────
export const BESUCH_ENDE_HOECHSTENS_MS = 6 * 3_600_000;

export interface BesuchNutzlast {
  art: "ansicht" | "ende";
  pfad: string;
  herkunft: string | null;
  kampagne: Kampagne;
  fbclid: boolean;
  gclid: boolean;
  /** Nur bei „ende": sichtbare Zeit auf dieser Seite, aufsummiert. */
  ms: number | null;
}

/** Ein Kampagnenwert: Text bis 150 Zeichen, ohne Steuerzeichen; mit „@" (E-Mail-Adresse) gar nicht. Rein. */
export function kampagnenWert(roh: unknown): string | null {
  if (typeof roh !== "string" && typeof roh !== "number") return null;
  const s = String(roh).replace(/[\u0000-\u001f\u007f<>"`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 150);
  if (!s || s.includes("@")) return null;
  return s;
}

/**
 * Was vom Browser kommt, in die eine erlaubte Form bringen — oder null. Rein.
 * Alles, was hier nicht genannt ist, fällt weg; der Pfad wird erst auf dem Server zum Messpfad.
 */
export function besuchNutzlast(roh: unknown, eigenerWirt?: string | null): BesuchNutzlast | null {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) return null;
  const b = roh as Record<string, unknown>;
  const art = b.art === "ende" ? "ende" : b.art === "ansicht" ? "ansicht" : null;
  if (!art) return null;
  const pfad = typeof b.pfad === "string" ? b.pfad.slice(0, 300) : "";
  if (!pfad.startsWith("/")) return null;
  const k = (b.kampagne && typeof b.kampagne === "object" && !Array.isArray(b.kampagne)) ? b.kampagne as Record<string, unknown> : {};
  let ms: number | null = null;
  if (art === "ende") {
    const n = Math.round(Number(b.ms));
    if (!Number.isFinite(n) || n < 0) return null;
    ms = Math.min(n, BESUCH_ENDE_HOECHSTENS_MS);
  }
  return {
    art, pfad,
    herkunft: herkunftHost(b.herkunft, eigenerWirt),
    kampagne: {
      source: kampagnenWert(k.source), medium: kampagnenWert(k.medium), campaign: kampagnenWert(k.campaign),
      content: kampagnenWert(k.content), term: kampagnenWert(k.term),
    },
    fbclid: b.fbclid === true,
    gclid: b.gclid === true,
    ms,
  };
}

// ── Die Auswertung: Zeiträume und Filter (Server und Seite) ─────────────────
export const BESUCH_ZEITRAEUME = [
  { key: "heute", label: "Heute" },
  { key: "gestern", label: "Gestern" },
  { key: "7", label: "7 Tage" },
  { key: "30", label: "30 Tage" },
  { key: "90", label: "90 Tage" },
  { key: "eigen", label: "Zeitraum" },
] as const;
export type BesuchZeitraum = (typeof BESUCH_ZEITRAEUME)[number]["key"];

/**
 * Wonach die ganze Seite gefiltert werden kann — jede Tabelle setzt einen dieser Schlüssel.
 * Werte sind die angezeigten Namen; „(ohne)" heißt: kein Wert.
 */
export const BESUCH_FILTER = {
  kanal: "Kanal", herkunft: "Herkunft", quelle: "Quelle", kampagne: "Kampagne", inhalt: "Anzeige",
  gruppe: "Anzeigengruppe", seite: "Seite", einstieg: "Einstieg", ausstieg: "Ausstieg",
  geraet: "Gerät", sprache: "Sprache", land: "Land",
} as const;
export type BesuchFilterSchluessel = keyof typeof BESUCH_FILTER;
export type BesuchFilter = Partial<Record<BesuchFilterSchluessel, string>>;
export const OHNE = "(ohne)";

/** Filter aus einer Abfrage lesen — nur bekannte Schlüssel, Werte bis 160 Zeichen. Rein. */
export function besuchFilterAus(q: Record<string, unknown>): BesuchFilter {
  const f: BesuchFilter = {};
  for (const k of Object.keys(BESUCH_FILTER) as BesuchFilterSchluessel[]) {
    const v = q[k];
    if (typeof v === "string" && v.trim()) f[k] = v.trim().slice(0, 160);
  }
  return f;
}
