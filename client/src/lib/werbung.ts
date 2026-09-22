// ═══════════════════════════════════════════════════════════════════════════
// EINWILLIGUNG, MESSUNG, ANZEIGEN-ZUORDNUNG (19.09.2026, E-191)
//
// ── WARUM ─────────────────────────────────────────────────────────────────
// fiaon.com lud Microsoft Clarity bei jedem Aufruf — ohne Einwilligung, obwohl
// Cookie-Seite und Datenschutzerklärung „keine Analyse-Tools" versprachen. Ein
// Google-Tag gab es nicht (analytics.ts rief ein gtag auf, das nie geladen
// wurde). Für Anzeigen (FIAON Global) braucht es Messung — und für Messung
// braucht es eine Einwilligung (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO).
//
// ── WAS HIER GILT ─────────────────────────────────────────────────────────
// · Drei Stufen: notwendig (immer), Statistik (Clarity, Google Analytics),
//   Marketing (Google Ads). Nichts lädt vor der Entscheidung.
// · Die Kennungen kommen vom Server (/api/fiaon/global/messung, aus Render).
//   Fehlt eine Kennung, lädt das zugehörige Werkzeug nicht — der Hinweis
//   erscheint nur, wenn es überhaupt etwas einzuwilligen gibt.
// · Consent Mode v2 in der Grundform: gtag.js lädt erst NACH der Zustimmung,
//   mit ausdrücklichen Einwilligungssignalen.
// · Kein Retargeting: ad_personalization bleibt IMMER „denied“ und die
//   Personalisierungssignale sind aus — gemessen wird nur, ob eine Anzeige zu
//   einem Gespräch oder Auftrag geführt hat. So steht es auf der Cookie-Seite.
// · Klick-Kennungen aus Anzeigen (gclid, gbraid, wbraid, utm_*) werden beim
//   Aufruf aus der Adresse gelesen und im Arbeitsspeicher gehalten — reicht
//   für die Landingpages, auf denen Klick und Buchung auf einer Seite liegen.
//   Über Seitenwechsel hinweg (sessionStorage) nur mit Marketing-Einwilligung.
// ═══════════════════════════════════════════════════════════════════════════

export interface Einwilligung { statistik: boolean; marketing: boolean; zeit: string; fassung: number }
import { META_EREIGNIS, metaEreignisId } from "@shared/fiaon-meta-ereignisse";

export interface Messung { ga4: string | null; ads: string | null; labels: { gespraech: string | null; auftrag: string | null }; clarity: string | null; metaPixel: string | null }

const SCHLUESSEL = "fiaon_einwilligung";
const FASSUNG = 1;
const KAMPAGNE_SCHLUESSEL = "fiaon_kampagne";
export const EINWILLIGUNG_EREIGNIS = "fiaon-einwilligung";

// analytics.ts deklariert w.gtag enger (ohne „consent") — hier ein eigener Blick auf dasselbe Fenster.
const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void; fbq?: ((...a: unknown[]) => void) & { queue?: unknown[]; callMethod?: (...a: unknown[]) => void; loaded?: boolean; version?: string; push?: unknown }; _fbq?: unknown };

// ── Einwilligung ─────────────────────────────────────────────────────────────
export function einwilligungLesen(): Einwilligung | null {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return null;
    const e = JSON.parse(roh) as Einwilligung;
    return e && e.fassung === FASSUNG ? e : null;
  } catch { return null; }
}

export function einwilligungSetzen(wahl: { statistik: boolean; marketing: boolean }): void {
  const e: Einwilligung = { statistik: !!wahl.statistik, marketing: !!wahl.marketing, zeit: new Date().toISOString(), fassung: FASSUNG };
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(e)); } catch { /* privates Fenster: gilt für diesen Aufruf */ }
  if (!e.marketing) { try { sessionStorage.removeItem(KAMPAGNE_SCHLUESSEL); } catch { /* egal */ } }
  if (e.marketing) kampagneSichern();
  window.dispatchEvent(new CustomEvent(EINWILLIGUNG_EREIGNIS, { detail: e }));
  void anwenden(e);
}

// ── Kennungen vom Server ─────────────────────────────────────────────────────
let messungVersprochen: Promise<Messung | null> | null = null;
export function messungLaden(): Promise<Messung | null> {
  if (!messungVersprochen) {
    messungVersprochen = fetch("/api/fiaon/global/messung").then((r) => (r.ok ? r.json() : null))
      .then((j) => (j?.ok ? { ga4: j.ga4 ?? null, ads: j.ads ?? null, labels: j.labels ?? { gespraech: null, auftrag: null }, clarity: j.clarity ?? null, metaPixel: j.metaPixel ?? null } : null))
      .catch(() => null);
  }
  return messungVersprochen;
}

/** Gibt es überhaupt etwas, dem man zustimmen kann? Sonst erscheint kein Hinweis. */
export async function einwilligungNoetig(): Promise<boolean> {
  const m = await messungLaden();
  return !!(m && (m.ga4 || m.ads || m.clarity || m.metaPixel));
}

// ── Laden nach Zustimmung ────────────────────────────────────────────────────
let gtagGeladen = false;
let clarityGeladen = false;
let pixelGeladen = false;

async function anwenden(e: Einwilligung | null): Promise<void> {
  if (!e) return;
  const m = await messungLaden();
  if (!m) return;
  if (e.statistik && m.clarity && !clarityGeladen) {
    clarityGeladen = true;
    try { const { default: Clarity } = await import("@microsoft/clarity"); Clarity.init(m.clarity); } catch { /* ohne Clarity weiter */ }
  }
  // ── META-PIXEL (22.09.2026, E-210) ────────────────────────────────────────
  // Nur mit Marketing-Einwilligung, und nur, wenn die Einrichtung des
  // Lead-Motors einen Datensatz kennt. Die Ereignisse selbst kommen zusätzlich
  // vom Server (Conversions API) — dieselbe `eventID`, damit Meta sie als EINS
  // zählt statt doppelt. Ohne den Server sieht Meta nur, was der Browser durchlässt.
  if (e.marketing && m.metaPixel && !pixelGeladen) {
    pixelGeladen = true;
    const f: any = function (...a: unknown[]) { (f.callMethod ? f.callMethod.apply(f, a) : f.queue.push(a)); };
    f.queue = []; f.loaded = true; f.version = "2.0"; f.push = f;
    if (!w.fbq) { w.fbq = f; w._fbq = f; }
    const s2 = document.createElement("script");
    s2.async = true;
    s2.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s2);
    try {
      w.fbq!("consent", "grant");
      w.fbq!("init", m.metaPixel);
      w.fbq!("track", "PageView");
    } catch { /* ohne Pixel weiter */ }
  }

  const brauchtGtag = (e.statistik && m.ga4) || (e.marketing && m.ads);
  if (brauchtGtag && !gtagGeladen) {
    gtagGeladen = true;
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() { w.dataLayer!.push(arguments); };
    w.gtag("consent", "default", {
      ad_storage: e.marketing ? "granted" : "denied", ad_user_data: e.marketing ? "granted" : "denied",
      ad_personalization: "denied", analytics_storage: e.statistik ? "granted" : "denied",
    });
    w.gtag("set", { allow_ad_personalization_signals: false });
    w.gtag("js", new Date());
    if (e.statistik && m.ga4) w.gtag("config", m.ga4, { anonymize_ip: true, allow_google_signals: false });
    if (e.marketing && m.ads) w.gtag("config", m.ads, { allow_ad_personalization_signals: false });
    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent((e.statistik && m.ga4) || m.ads || "")}`;
    document.head.appendChild(s);
  } else if (gtagGeladen && w.gtag) {
    w.gtag("consent", "update", {
      ad_storage: e.marketing ? "granted" : "denied", ad_user_data: e.marketing ? "granted" : "denied",
      ad_personalization: "denied", analytics_storage: e.statistik ? "granted" : "denied",
    });
  }
}

/** Beim Start: gespeicherte Entscheidung anwenden, Klick-Kennungen aus der Adresse lesen. */
export function messungStarten(): void {
  kampagneAusAdresse();
  const e = einwilligungLesen();
  if (e) void anwenden(e);
}

// ── Anzeigen-Zuordnung ───────────────────────────────────────────────────────
const KAMPAGNE_FELDER = ["gclid", "gbraid", "wbraid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
let kampagneImSpeicher: Record<string, string> | null = null;

function kampagneAusAdresse(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const k: Record<string, string> = {};
    for (const f of KAMPAGNE_FELDER) { const v = q.get(f); if (v) k[f] = v.slice(0, 300); }
    if (Object.keys(k).length) {
      k.landing = window.location.pathname.slice(0, 300);
      kampagneImSpeicher = k;
      if (einwilligungLesen()?.marketing) kampagneSichern();
    }
  } catch { /* ohne Zuordnung weiter */ }
}

function kampagneSichern(): void {
  try { if (kampagneImSpeicher) sessionStorage.setItem(KAMPAGNE_SCHLUESSEL, JSON.stringify(kampagneImSpeicher)); } catch { /* egal */ }
}

/** Was ein Termin oder Auftrag an den Server mitnimmt — oder undefined. */
export function kampagne(): Record<string, string> | undefined {
  if (kampagneImSpeicher) return kampagneImSpeicher;
  if (!einwilligungLesen()?.marketing) return undefined;
  try { const roh = sessionStorage.getItem(KAMPAGNE_SCHLUESSEL); return roh ? JSON.parse(roh) : undefined; } catch { return undefined; }
}

// ── Ereignisse ───────────────────────────────────────────────────────────────
/** Ein Ereignis für die Statistik — nur mit Einwilligung, sonst still. */
export function werbeEreignis(name: string, daten: Record<string, string | number> = {}): void {
  const e = einwilligungLesen();
  if (!e?.statistik || !w.gtag) return;
  try { w.gtag("event", name, daten); } catch { /* egal */ }
}

/** Eine Konversion: Gespräch gebucht oder Auftrag erteilt. GA4 mit Statistik-, Google Ads mit Marketing-Einwilligung. */
export async function werbeKonversion(art: "gespraech" | "auftrag", daten: { wert?: number; id?: string; paket?: string } = {}): Promise<void> {
  const e = einwilligungLesen();
  if (!e || !w.gtag) return;
  const m = await messungLaden();
  try {
    if (e.statistik) {
      if (art === "gespraech") w.gtag("event", "generate_lead", { currency: "EUR", value: 0, paket: daten.paket ?? "" });
      else w.gtag("event", "purchase", { currency: "EUR", value: daten.wert ?? 0, transaction_id: daten.id ?? "", items: daten.paket ? [{ item_id: daten.paket }] : [] });
    }
    const label = art === "gespraech" ? m?.labels.gespraech : m?.labels.auftrag;
    if (e.marketing && m?.ads && label) {
      w.gtag("event", "conversion", { send_to: `${m.ads}/${label}`, value: daten.wert ?? 0, currency: "EUR", transaction_id: daten.id ?? "" });
    }
  } catch { /* egal */ }
  // Dasselbe an Meta: Gespräch = Schedule, Auftrag = SubmitApplication. „Purchase"
  // bleibt der Zahlung vorbehalten (der Server meldet sie, wenn das Geld da ist).
  metaEreignis(
    art === "gespraech" ? META_EREIGNIS.termin : META_EREIGNIS.auftrag,
    daten.id || `${art}.${Math.round(Date.now() / 60000)}`,
    { ...(daten.wert ? { value: daten.wert } : {}), ...(daten.paket ? { content_name: daten.paket } : {}) },
  );
}

// ── META: EREIGNISSE UND KENNUNGEN (22.09.2026, E-210) ──────────────────────
// `metaEreignis` feuert im Browser, `messungsDaten` reist mit jedem Speichern
// des Antrags zum Server. Beide tragen dieselbe Ereignis-Kennung, damit Meta
// das Pixel-Ereignis und das Server-Ereignis als EIN Ereignis zählt.

/** Ein Cookie lesen — fbp/fbc setzt der Pixel selbst. */
function keks(name: string): string | null {
  try {
    const treffer = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
    return treffer ? decodeURIComponent(treffer.slice(name.length + 1)) : null;
  } catch { return null; }
}

export { META_EREIGNIS, metaEreignisId };

/** Ein Meta-Ereignis im Browser. Ohne Marketing-Einwilligung still. */
export function metaEreignis(name: string, ref: string, daten: Record<string, unknown> = {}): void {
  if (!einwilligungLesen()?.marketing || !w.fbq) return;
  try { w.fbq("track", name, { currency: "EUR", ...daten }, { eventID: metaEreignisId(name, ref) }); } catch { /* egal */ }
}

/**
 * Meta zählt eine Seite nur, wenn sie gemeldet wird — in einem Einseiter wechselt
 * die Adresse aber ohne Neuladen. Deshalb meldet die App jeden Wechsel selbst.
 */
let letzteGemeldeteSeite = "";
export function metaSeitenwechsel(pfad: string): void {
  if (!einwilligungLesen()?.marketing || !w.fbq) return;
  if (!pfad || pfad === letzteGemeldeteSeite) return;
  letzteGemeldeteSeite = pfad;
  try { w.fbq("track", "PageView"); } catch { /* egal */ }
}

/** Was der Server für die Conversions API braucht — reist mit dem Antrag mit. */
export function messungsDaten(): { fbp: string | null; fbc: string | null; einwilligung: boolean; seite: string } {
  const fbclid = (() => { try { return new URLSearchParams(window.location.search).get("fbclid"); } catch { return null; } })();
  return {
    fbp: keks("_fbp"),
    // Kommt der Mensch frisch aus einer Anzeige, steht die Klick-Kennung noch in der Adresse.
    fbc: keks("_fbc") ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
    einwilligung: !!einwilligungLesen()?.marketing,
    seite: (() => { try { return window.location.pathname.slice(0, 300); } catch { return ""; } })(),
  };
}
