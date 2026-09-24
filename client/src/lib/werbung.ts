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
//   Marketing (Google Ads, Meta-Pixel samt Conversions API vom Server).
//   Nichts lädt vor der Entscheidung.
// · Die Kennungen kommen vom Server (/api/fiaon/global/messung, aus Render).
//   Fehlt eine Kennung, lädt das zugehörige Werkzeug nicht — der Hinweis
//   erscheint nur, wenn es überhaupt etwas einzuwilligen gibt.
// · Consent Mode v2 in der Grundform: gtag.js lädt erst NACH der Zustimmung,
//   mit ausdrücklichen Einwilligungssignalen.
// · Kein Retargeting: ad_personalization bleibt IMMER „denied“ und die
//   Personalisierungssignale sind aus — gemessen wird nur, ob eine Anzeige zu
//   einem Gespräch oder Auftrag geführt hat. So steht es auf der Cookie-Seite.
// · Klick-Kennungen aus Anzeigen (gclid, gbraid, wbraid, fbclid, utm_*) werden
//   beim Aufruf aus der Adresse gelesen und im Arbeitsspeicher gehalten — reicht
//   für die Landingpages, auf denen Klick und Buchung auf einer Seite liegen.
//   Über Seitenwechsel hinweg (sessionStorage) nur mit Marketing-Einwilligung.
//
// ── EINWILLIGUNG NENNT META, FASSUNG 2 (24.09.2026, E-239) ──────────────────
// Seit 22.09. lädt die Marketing-Einwilligung den Meta-Pixel, und der Server
// meldet dieselben Ereignisse per Conversions API. Hinweis, Cookie-Seite und
// Datenschutzerklärung nannten aber nur Google Ads — eine Einwilligung, die den
// Empfänger nicht nennt, ist nicht informiert (Art. 4 Nr. 11, Art. 7 DSGVO).
// Deshalb FASSUNG 2: Jede alte Entscheidung gilt nicht mehr, der Hinweis
// erscheint jedem einmal neu — jetzt mit Meta im Text.
// Dazu überlebt fbclid den Seitenwechsel wie gclid (mit Ankunftszeit, denn Meta
// will in fbc die Zeit des ERSTEN Aufrufs mit fbclid, nicht die des Absendens).
// ═══════════════════════════════════════════════════════════════════════════

export interface Einwilligung { statistik: boolean; marketing: boolean; zeit: string; fassung: number }
import { META_EREIGNIS, metaEreignisId } from "@shared/fiaon-meta-ereignisse";

export interface Messung { ga4: string | null; ads: string | null; labels: { gespraech: string | null; auftrag: string | null }; clarity: string | null; metaPixel: string | null }

const SCHLUESSEL = "fiaon_einwilligung";
// 24.09.2026 (E-239): 1 → 2. Fassung 1 nannte bei Marketing nur Google Ads, geladen
// wurde aber auch der Meta-Pixel — diese Einwilligungen decken Meta nicht. Mit der
// neuen Nummer liest einwilligungLesen() sie als „keine Entscheidung", der Hinweis
// fragt neu. Jede spätere Änderung am Kreis der Empfänger zählt hier eins weiter.
const FASSUNG = 2;
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
  // E-239: War Marketing vorher erlaubt (auch in Fassung 1) und ist es jetzt aus,
  // erfährt es der Server — sonst meldete er spätere Ereignisse (etwa die
  // Zahlung) weiter an Meta. Die Pixel-Kennung wird VOR dem Überschreiben gelesen.
  let vorherMarketing = false;
  try { vorherMarketing = !!(JSON.parse(localStorage.getItem(SCHLUESSEL) || "null") as Einwilligung | null)?.marketing; } catch { /* egal */ }
  if (vorherMarketing && !wahl.marketing) {
    try {
      void fetch("/api/meta/widerruf", {
        method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "same-origin",
        body: JSON.stringify({ fbp: keks("_fbp") }),
      }).catch(() => { /* der nächste Antrag schickt „keine Einwilligung" ohnehin mit */ });
    } catch { /* egal */ }
  }
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
      // 24.09.2026 (E-239): keine automatischen Ereignisse (erkannte Knopf-Klicks, Seiten-
      // Metadaten) — der Pixel meldet nur, was hier ausdrücklich steht. So steht es in der
      // Datenschutzerklärung VI a Nr. 2. Muss VOR „init" stehen.
      w.fbq!("set", "autoConfig", false, m.metaPixel);
      w.fbq!("init", m.metaPixel);
      w.fbq!("track", "PageView");
    } catch { /* ohne Pixel weiter */ }
  } else if (pixelGeladen && w.fbq) {
    // 24.09.2026 (E-239): Widerruf auf derselben Seite. Das Skript lässt sich nicht entladen —
    // „revoke" hält es still, bis die Seite neu lädt (dann lädt es ohne Einwilligung gar nicht).
    // Wer danach wieder zustimmt, gibt es mit „grant" frei.
    try { w.fbq("consent", e.marketing ? "grant" : "revoke"); } catch { /* egal */ }
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
// 24.09.2026 (E-239): fbclid dazu. Bis hier las nur messungsDaten() die Klick-Kennung
// aus der AKTUELLEN Adresse — nach dem ersten Seitenwechsel war sie weg, und wer ohne
// Pixel-Cookie (_fbc) weiterging, kam beim Server ohne Klick an. `fbclid_zeit` ist die
// Ankunftszeit in Millisekunden: Meta verlangt in fbc die Zeit des ersten Aufrufs mit
// fbclid. Beides liegt wie alles hier vor der Einwilligung NUR im Arbeitsspeicher.
const KAMPAGNE_FELDER = ["gclid", "gbraid", "wbraid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
let kampagneImSpeicher: Record<string, string> | null = null;

function kampagneAusAdresse(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const k: Record<string, string> = {};
    for (const f of KAMPAGNE_FELDER) { const v = q.get(f); if (v) k[f] = v.slice(0, 300); }
    if (Object.keys(k).length) {
      k.landing = window.location.pathname.slice(0, 300);
      // Neu laden mit derselben Adresse ist kein neuer Klick — die erste Ankunftszeit bleibt.
      if (k.fbclid) k.fbclid_zeit = ankunftVon(kampagne(), k.fbclid) ?? String(Date.now());
      kampagneImSpeicher = k;
      if (einwilligungLesen()?.marketing) kampagneSichern();
    }
  } catch { /* ohne Zuordnung weiter */ }
}

/** Die gemerkte Ankunftszeit (ms) zu genau dieser fbclid — oder null. */
function ankunftVon(k: Record<string, string> | undefined, fbclid: string): string | null {
  const zeit = k && k.fbclid === fbclid ? k.fbclid_zeit : undefined;
  return zeit && /^\d{13}$/.test(zeit) ? zeit : null;
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

/**
 * Eine Konversion: Gespräch gebucht oder Auftrag erteilt. GA4 mit Statistik-,
 * Google Ads und Meta mit Marketing-Einwilligung. `id` ist die Kennung, die auch
 * der Server meldet (Gespräch: `messRef` aus der Antwort, Auftrag: die Referenz).
 */
export async function werbeKonversion(art: "gespraech" | "auftrag", daten: { wert?: number; id?: string; paket?: string } = {}): Promise<void> {
  // ── META ZUERST, UND OHNE GOOGLE (23.09.2026, E-231) ──────────────────────
  // Hier stand als erste Zeile `if (!e || !w.gtag) return;`, der Meta-Aufruf
  // erst am Ende. Live ist kein Google-Tag eingerichtet (ga4 und ads leer) —
  // w.gtag wurde also nie geladen, die Funktion kehrte sofort zurück, und Meta
  // bekam aus dem Browser weder Schedule noch SubmitApplication, auch mit
  // Marketing-Einwilligung nicht. Meta hängt nur an der Marketing-Einwilligung
  // und am geladenen Pixel; beides prüft `metaEreignis` selbst.
  // Gespräch = Schedule, Auftrag = SubmitApplication. „Purchase" bleibt der
  // Zahlung vorbehalten (der Server meldet sie, wenn das Geld da ist).
  metaEreignis(
    art === "gespraech" ? META_EREIGNIS.termin : META_EREIGNIS.auftrag,
    daten.id || `${art}.${Math.round(Date.now() / 60000)}`,
    { ...(daten.wert ? { value: daten.wert } : {}), ...(daten.paket ? { content_name: daten.paket } : {}) },
  );
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

/**
 * Die Klick-Kennung als fbc (24.09.2026, E-239): `fb.1.<Ankunftszeit ms>.<fbclid>`.
 * Reihenfolge: fbclid aus der aktuellen Adresse, sonst die gemerkte aus kampagne().
 * Die Zeit ist immer die der ANKUNFT — bis hier stand Date.now() beim Absenden,
 * und Meta sah jeden Klick so jung wie das Speichern des Antrags.
 */
function fbcAusKlick(): string | null {
  try {
    const inAdresse = new URLSearchParams(window.location.search).get("fbclid")?.slice(0, 300) || null;
    // Steht eine fbclid in der Adresse, die noch nicht gemerkt ist (Wechsel innerhalb des Einseiters), jetzt merken.
    if (inAdresse && kampagne()?.fbclid !== inAdresse) kampagneAusAdresse();
    const k = kampagne();
    const fbclid = inAdresse ?? k?.fbclid ?? null;
    if (!fbclid) return null;
    return `fb.1.${ankunftVon(k, fbclid) ?? String(Date.now())}.${fbclid}`;
  } catch { return null; }
}

/**
 * Was der Server für die Conversions API braucht — reist mit dem Antrag mit.
 * fbp und fbc nur mit Marketing-Einwilligung (E-239): Ohne sie meldet der Server
 * ohnehin nichts an Meta, also braucht er die Kennungen auch nicht. Und ein altes
 * _fbp-Cookie nach einem Widerruf reist so nicht weiter.
 */
export function messungsDaten(): { fbp: string | null; fbc: string | null; einwilligung: boolean; seite: string; fassung: number; kampagne?: Record<string, string> } {
  const einwilligung = !!einwilligungLesen()?.marketing;
  // E-239: Die Fassung des Hinweises reist mit (der Server meldet nur ab Fassung 2, die Meta
  // nennt), und mit Einwilligung die Kampagnen-Kennung des Klicks (utm_campaign/utm_id) —
  // damit der Kostenbericht einen Kauf über die Website seiner Kampagne zuordnen kann.
  const k = einwilligung ? kampagne() : undefined;
  return {
    fassung: FASSUNG,
    ...(k ? { kampagne: k } : {}),
    fbp: einwilligung ? keks("_fbp") : null,
    // Der Pixel setzt _fbc selbst, wenn er die fbclid in der Adresse sieht. Kam die
    // Einwilligung erst nach einem Seitenwechsel, fehlt das Cookie — dann gilt der gemerkte Klick.
    fbc: einwilligung ? (keks("_fbc") ?? fbcAusKlick()) : null,
    einwilligung,
    seite: (() => { try { return window.location.pathname.slice(0, 300); } catch { return ""; } })(),
  };
}
