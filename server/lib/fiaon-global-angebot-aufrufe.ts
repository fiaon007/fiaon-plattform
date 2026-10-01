// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — WER HAT DAS ANGEBOT WANN, WIE OFT UND WO GEÖFFNET?
// Angebot-Aufrufe (01.10.2026), Register E-268 (Nachtrag)
//
// Justin (01.10.2026): „Ich will sehen, wann er es wie oft und wo geöffnet hat —
// und benachrichtigt werden!" (Herr Hildbrand, Angebot FIAON-IA-9E10FD, Link
// verschickt.)
//
// ── WAS PROTOKOLLIERT WIRD ─────────────────────────────────────────────────
// Jeder Abruf des persönlichen Links, den der Server ohnehin beantwortet:
//   · GET /api/fiaon/global/angebot/:token          → „Seite"
//     (mit ?wahl=1 → „Seite · nachgeladen": die Seite rechnet nach einem Häkchen
//     den Vertrag neu — das ist kein neues Öffnen und zählt nicht als „geöffnet")
//   · GET …/:token/vertrag.pdf                      → „Vertrag-PDF"
//   · GET …/:token/pruefbericht.pdf                 → „Anlage 2: Prüfbericht (PDF)"
// Je Zeile: Zeitpunkt, HTTP-Antwort, IP GEKÜRZT (IPv4 letztes Oktett 0, IPv6 /48),
// Gerät aus der Browserkennung (iPhone/iPad/Android/Mac/Windows + Browser + ggf.
// „In-App (…)"), Land/Region/Stadt NUR aus Kopfzeilen, die vor dem Server schon
// mitkommen. Vor Render sitzt Cloudflare (Antwortkopf „server: cloudflare", cf-ray);
// belegt ist cf-ipcountry (GET fiaon.com/api/fiaon/geo → quelle „header"). cf-ipcity,
// cf-region und die x-vercel-ip-*-Kopfzeilen werden gelesen, FALLS sie kommen —
// welche es waren, steht je Zeile in geo_quelle. KEIN Geo-Dienst, keine IP an Dritte,
// keine Cookies, keine Messung im Browser, kein Pixel.
//
// ── INTERN („du") ─────────────────────────────────────────────────────────
// intern = im Aufruf steckt eine gültige Chefbüro-Sitzung (fiaon_chef oder altes
// fiaon_admin) oder Mitarbeiter-Sitzung (fiaon_agent_token) — ODER der Anschluss
// war in den letzten 30 Tagen in einer Chefbüro-Sitzung. Dafür merkt sich
// `chefAnschlussMerken` (routes.ts, direkt hinter dem Admin-Tor) je Chef-Anfrage
// höchstens alle zehn Minuten den Anschluss — nur als HMAC der IP, nie im Klartext
// (fiaon_chef_anschluesse); IPv6 als /64, weil Datenschutz-Adressen den hinteren Teil
// wechseln (Gegenprüfung F3). Die IP kommt aus cf-connecting-ip, sonst aus dem ersten
// X-Forwarded-For-Eintrag (aufrufClientIp, Gegenprüfung F2). Automatische Abrufe (Bot-Kennung, die Maschine selbst —
// dieselbe Regel wie die Roboter-Wand der Annahme) sind „automatisch".
// Interne und automatische Aufrufe lösen NIE eine Meldung aus.
//
// ── DIE MELDUNG AN JUSTIN ─────────────────────────────────────────────────
// Beim ERSTEN Aufruf des Kunden und danach bei jedem neuen Besuch nach mindestens
// 30 Minuten Pause — nie öfter als einmal je 30 Minuten je Angebot. Entschieden
// unter einem Advisory-Lock je Angebot (zwei gleichzeitige Aufrufe melden nicht doppelt):
//   (a) EINE Aufgabe je Angebot auf Justins Board (fiaon_betreiber_todos, Schlüssel
//       global-angebot:<ref>:geoeffnet). Titel und Text werden aktualisiert statt
//       vermehrt; eine erledigte Aufgabe geht mit der neuen Meldung wieder auf; die
//       Zeitleiste bekommt je Meldung einen Eintrag. Zwischen zwei Meldungen wird die
//       Aufgabe still nachgeführt (Zähler, „zuletzt") — ohne Wiederöffnen, ohne Mail.
//   (b) Mail an js@fiaon.com über eigeneMailSenden (fiaon-brevo.ts) — derselbe Weg wie
//       die Termin-Meldungen an Mitarbeiter; keine neue Versandart. Ergebnis je Zeile
//       in meldung_ergebnis (ehrlich: „nicht gesendet (…)", wenn Brevo nicht will).
//   (c) Einen Push- oder Klingel-Weg für die Leitung gibt es im Haus nicht
//       (fiaon-push.ts kennt nur Kunden-Abos in /app, mit person_id). Die Aufgabe zählt
//       in der Marke „todoOffen" des Chefbüros (fiaon-admin-hub.ts) von selbst mit.
// Bei der Annahme: „angenommen am …" in DERSELBEN Aufgabe (aufrufeAnnahmeVermerken).
// Aufgabe und Mail nennen Zeit, Gerät und Ort — NIE eine IP, auch keine gekürzte (Gegenprüfung F1).
//
// ── SPEICHERDAUER ─────────────────────────────────────────────────────────
// 90 Tage nach Annahme, Rückzug bzw. Ende der Gültigkeit — dann löscht der
// Stundenlauf globalAngebotLauf (aufrufeAufraeumen). Chef-Anschlüsse nach 30 Tagen.
// Gegenprüfung 01.10.2026 (F1): Die Frist gilt auch für die Kopien — die Aufgabe bekommt
// einen neutralen Titel und Text, ihre Systembeiträge gehen weg; nach der Frist wird
// nichts mehr protokolliert (also auch keine neue Aufgabe, keine neue Mail). Eine schon
// verschickte Mail erreicht kein Lauf — deshalb trägt sie keine IP.
// Tabellen: db/migrations/088_global_angebot_aufrufe.sql — dieselbe DDL legt
// ensureAufrufTabellen beim ersten Gebrauch an (über die DDL-Wache am sqlPool).
//
// ── WAS BEWUSST NICHT PASSIERT ────────────────────────────────────────────
//   · Der Vertrag bleibt unberührt: Der Hinweis auf der Kundenseite steht außerhalb
//     des Vertragstextes; text_hash (ref|fassung|Rumpf) ändert sich nicht.
//   · Ein Fehler hier kippt nie die Antwort an den Kunden (die Route ruft „feuern und
//     vergessen"); ein Fehler der Meldung kippt nie die Protokollzeile.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { absoluteUrl } from "../fiaon-base-url";
import { istRoboterUnterschrift } from "./fiaon-vertrieb-zusage";
import { readChef } from "../routes/fiaon-chef-zugang";
import { hasAdminCode } from "../routes/fiaon-admin-zugang";
import { angebotTokenPruefen, ensureAngebotTabellen } from "./fiaon-global-angebot";
import { angebotKundeName, angebotTag, type AngebotKunde } from "@shared/fiaon-global-angebot";

// ── Feste Größen ────────────────────────────────────────────────────────────
/** Pause, nach der ein Aufruf des Kunden als neuer Besuch gilt — und Mindestabstand zweier Meldungen. */
export const AUFRUF_PAUSE_MIN = 30;
/** So lange zählt ein Anschluss aus einer Chefbüro-Sitzung als „du". */
export const CHEF_ANSCHLUSS_TAGE = 30;
/** So lange bleiben die Zeilen nach Annahme, Rückzug bzw. Ende der Gültigkeit. */
export const AUFRUF_LOESCHEN_TAGE = 90;
/** Schutz gegen Fluten über einen weitergegebenen Link: mehr Zeilen je Angebot und Tag werden nicht geschrieben. */
export const AUFRUF_TAGES_DECKEL = 500;
/** Wohin die Meldung geht (Justin, 01.10.2026). */
export const AUFRUF_MELDUNG_AN = "js@fiaon.com";
/** Wo Justin die Liste sieht — der bestehende Reiter, keine neue Chef-Seite. */
export const AUFRUF_CHEF_PFAD = "/chef/s/global-auftraege?reiter=angebote";
/** Schlüssel der EINEN Aufgabe je Angebot. */
export const aufrufAufgabeSchluessel = (ref: string) => `global-angebot:${ref}:geoeffnet`;
/** Erster Schlüssel des Advisory-Locks (zweiter = Angebots-ID). */
const SPERRE = 2_681_001;

export type AufrufArt = "seite" | "auswahl" | "vertrag_pdf" | "pruefbericht_pdf";
export const AUFRUF_ARTEN: readonly AufrufArt[] = ["seite", "auswahl", "vertrag_pdf", "pruefbericht_pdf"];
export const AUFRUF_ART_TEXT: Record<AufrufArt, string> = {
  seite: "Seite",
  auswahl: "Seite · nachgeladen",
  vertrag_pdf: "Vertrag-PDF",
  pruefbericht_pdf: "Anlage 2: Prüfbericht (PDF)",
};
export type InternGrund = "chefbuero" | "mitarbeiter" | "chef-anschluss";

// ═══════════════════════════════════════════════════════════════════════════
// REINE HELFER (Prüfstand ohne Datenbank)
// ═══════════════════════════════════════════════════════════════════════════

/** Die acht Gruppen einer IPv6-Adresse (ausgeschrieben, ohne Zone) — unlesbar → null. */
function ipv6Gruppen(roh: string): string[] | null {
  const ip = roh.split("%")[0];
  if (!/^[0-9a-f:]+$/.test(ip)) return null;
  const teile = ip.split("::");
  if (teile.length > 2) return null;
  const vorn = teile[0] ? teile[0].split(":") : [];
  let gruppen: string[];
  if (teile.length === 1) {
    if (vorn.length !== 8) return null;
    gruppen = vorn;
  } else {
    const hinten = teile[1] ? teile[1].split(":") : [];
    const fehlt = 8 - vorn.length - hinten.length;
    if (fehlt < 1) return null;
    gruppen = [...vorn, ...Array<string>(fehlt).fill("0"), ...hinten];
  }
  if (gruppen.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return gruppen.map((g) => g.replace(/^0+(?=.)/, ""));
}
/** IPv4 (auch ::ffff:-Form) → die vier Oktette, sonst null. */
function ipv4Oktette(ip: string): number[] | null {
  const v4 = ip.replace(/^::ffff:(?=\d{1,3}(\.\d{1,3}){3}$)/, "").match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return null;
  const o = v4.slice(1, 5).map(Number);
  return o.some((x) => x > 255) ? null : o;
}

/** IP gekürzt: IPv4 → letztes Oktett 0; IPv6 → /48 (die ersten drei Gruppen). Unlesbar → null. */
export function ipKuerzen(roh: unknown): string | null {
  const ip = String(roh ?? "").trim().toLowerCase();
  if (!ip) return null;
  const o = ipv4Oktette(ip);
  if (o) return `${o[0]}.${o[1]}.${o[2]}.0`;
  const g = ipv6Gruppen(ip);
  return g ? `${g.slice(0, 3).join(":")}::/48` : null;
}

/**
 * Wofür der Chef-Anschluss gemerkt wird (Gegenprüfung 01.10.2026, F3): IPv4 als volle Adresse, IPv6 als /64.
 * Datenschutz-Adressen (IPv6-Privacy-Extensions) wechseln den hinteren Teil regelmäßig — der /64-Teil ist der
 * Anschluss. Unlesbares bleibt, wie es kam (nur für den HMAC, nie gespeichert).
 */
export function anschlussSchluessel(roh: unknown): string {
  const ip = String(roh ?? "").trim().toLowerCase();
  const o = ipv4Oktette(ip);
  if (o) return o.join(".");
  const g = ipv6Gruppen(ip);
  return g ? `${g.slice(0, 4).join(":")}::/64` : ip;
}

/**
 * Die IP des Aufrufers (Gegenprüfung 01.10.2026, F2): zuerst cf-connecting-ip — die setzt Cloudflare selbst und
 * überschreibt, was der Browser mitschickt —, sonst der erste X-Forwarded-For-Eintrag, sonst die Verbindung.
 * NICHT req.ip: Hinter Cloudflare ist das der Rand von Cloudflare (141.101.x.x), nicht der Kunde.
 */
export function aufrufClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string | null } | null }): string {
  const kopf = (n: string) => { const v = req.headers[n]; return String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim(); };
  return kopf("cf-connecting-ip") || kopf("x-forwarded-for").split(",")[0].trim() || String(req.socket?.remoteAddress || "");
}

/** „iPhone · Safari", „Android · Chrome · In-App (WhatsApp)", „Mac · Chrome" — aus der Browserkennung. */
export function geraetAus(uaRoh: unknown): string {
  const ua = String(uaRoh ?? "").slice(0, 800);
  if (!ua.trim()) return "Unbekanntes Gerät (keine Browserkennung)";
  const l = ua.toLowerCase();
  const geraet =
    /ipad/.test(l) ? "iPad"
    : /iphone|ipod/.test(l) ? "iPhone"
    : /android/.test(l) ? "Android"
    : /windows nt|windows phone/.test(l) ? "Windows"
    : /cros/.test(l) ? "Chromebook"
    : /macintosh|mac os x/.test(l) ? "Mac"
    : /linux/.test(l) ? "Linux"
    : "Unbekanntes Gerät";
  const browser =
    /edga?\/|edgios\//.test(l) ? "Edge"
    : /samsungbrowser\//.test(l) ? "Samsung Internet"
    : /opr\/|opios\//.test(l) ? "Opera"
    : /firefox\/|fxios\//.test(l) ? "Firefox"
    : /crios\/|chrome\//.test(l) ? "Chrome"
    : /safari\//.test(l) && /version\//.test(l) ? "Safari"
    : null;
  const ios = geraet === "iPhone" || geraet === "iPad";
  const inApp =
    /whatsapp/.test(l) ? "WhatsApp"
    : /fban|fbav|fb_iab/.test(l) ? "Facebook"
    : /instagram/.test(l) ? "Instagram"
    : /linkedinapp/.test(l) ? "LinkedIn"
    : /outlook/.test(l) ? "Outlook"
    : /gmail/.test(l) ? "Gmail"
    : /telegram/.test(l) ? "Telegram"
    : /\bgsa\//.test(l) ? "Google-App"
    // Android-WebView (; wv) bzw. iOS-WebView ohne „Safari/": eine App zeigt die Seite selbst an.
    : (geraet === "Android" && /; wv\)/.test(l)) || (ios && /applewebkit/.test(l) && !/safari\//.test(l)) ? "Mail/WhatsApp o. ä."
    : null;
  return [geraet, inApp && browser === "Chrome" && geraet === "Android" && /; wv\)/.test(l) ? null : browser, inApp ? `In-App (${inApp})` : null]
    .filter(Boolean).join(" · ");
}

type Kopf = Record<string, string | string[] | undefined>;
/** Die Kopfzeilen, aus denen ein Ort kommen DARF — nur solche, die vor dem Server schon gesetzt werden. */
export const GEO_KOPFZEILEN = {
  land: ["cf-ipcountry", "x-vercel-ip-country"],
  region: ["cf-region", "x-vercel-ip-country-region", "cf-region-code"],
  stadt: ["cf-ipcity", "x-vercel-ip-city"],
} as const;
const kopfWert = (h: Kopf, name: string): string => {
  const v = h[name];
  return String(Array.isArray(v) ? v[0] ?? "" : v ?? "").trim();
};
const sauber = (s: string, max = 80): string => {
  let x = s;
  try { if (/%[0-9a-f]{2}/i.test(x)) x = decodeURIComponent(x); } catch { /* roh lassen */ }
  return x.replace(/[\u0000-\u001f\u007f<>"`]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
};

export interface AufrufOrt { land: string | null; region: string | null; stadt: string | null; quelle: string | null }
/** Land/Region/Stadt aus den Kopfzeilen des Netzbetreibers — sonst leer. KEIN Nachschlagen der IP. */
export function ortAus(h: Kopf): AufrufOrt {
  const genutzt: string[] = [];
  const erstes = (namen: readonly string[], gilt: (s: string) => boolean = () => true): string | null => {
    for (const n of namen) {
      const w = sauber(kopfWert(h, n));
      if (w && gilt(w)) { genutzt.push(n); return w; }
    }
    return null;
  };
  // „XX" = unbekannt, „T1" = Tor bei Cloudflare — beides ist kein Land.
  const land = erstes(GEO_KOPFZEILEN.land, (w) => /^[A-Za-z]{2}$/.test(w) && !/^(xx|t1)$/i.test(w));
  const region = erstes(GEO_KOPFZEILEN.region);
  const stadt = erstes(GEO_KOPFZEILEN.stadt);
  return { land: land ? land.toUpperCase() : null, region, stadt, quelle: genutzt.length ? genutzt.join(", ") : null };
}

let laenderNamen: Intl.DisplayNames | null | undefined;
/** „DE" → „Deutschland" (ohne ICU: der Code). */
export function landName(code: string | null | undefined): string | null {
  if (!code) return null;
  if (laenderNamen === undefined) { try { laenderNamen = new Intl.DisplayNames(["de"], { type: "region" }); } catch { laenderNamen = null; } }
  try { return laenderNamen?.of(code.toUpperCase()) ?? code.toUpperCase(); } catch { return code.toUpperCase(); }
}
/** Ehrlich: Ort nur, wenn vorhanden — sonst „Ort unbekannt". */
export function ortText(o: { land?: string | null; region?: string | null; stadt?: string | null }): string {
  const land = landName(o.land ?? null);
  const region = o.region && !/^[A-Z0-9]{1,3}$/.test(o.region) ? o.region : null;
  if (o.stadt) {
    const klammer = [region, land].filter(Boolean).join(", ");
    return klammer ? `${o.stadt} (${klammer})` : o.stadt;
  }
  const rest = [region, land].filter(Boolean).join(", ");
  return rest || "Ort unbekannt";
}
/** Kurz für den Titel: Stadt, sonst Region, sonst Land, sonst „Ort unbekannt". */
export function ortKurz(o: { land?: string | null; region?: string | null; stadt?: string | null }): string {
  return o.stadt || (o.region && !/^[A-Z0-9]{1,3}$/.test(o.region) ? o.region : null) || landName(o.land ?? null) || "Ort unbekannt";
}

/**
 * Die Entscheidung je Aufruf (unter dem Lock):
 *   neuerBesuch = extern UND (noch nie extern ODER letzter externer Aufruf ≥ 30 Min. her)
 *   melden      = neuerBesuch UND (noch nie gemeldet ODER letzte Meldung ≥ 30 Min. her)
 */
export function besuchEntscheidung(e: { jetzt: Date; extern: boolean; letzterExtern: Date | null; letzteMeldung: Date | null }): { neuerBesuch: boolean; melden: boolean } {
  const pause = AUFRUF_PAUSE_MIN * 60_000;
  const t = e.jetzt.getTime();
  const neuerBesuch = e.extern && (!e.letzterExtern || t - e.letzterExtern.getTime() >= pause);
  const melden = neuerBesuch && (!e.letzteMeldung || t - e.letzteMeldung.getTime() >= pause);
  return { neuerBesuch, melden };
}

// ── Zeit in Berlin (nie Number(Intl.format()) — Falle aus dem Gedächtnis) ────
const ZEIT = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
const TAG_KURZ = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit" });
const TAG_LANG = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
const alsDatum = (v: Date | string): Date => (v instanceof Date ? v : new Date(v));
/** „01.10.2026, 15:42" (Berlin). */
export function zeitLang(v: Date | string): string { const d = alsDatum(v); return `${TAG_LANG.format(d)}, ${ZEIT.format(d)}`; }
/** „15:42" am selben Tag, sonst „30.09., 15:42" (Berlin). */
export function zeitKurz(v: Date | string, jetzt: Date = new Date()): string {
  const d = alsDatum(v);
  // TAG_KURZ liefert „30.09." schon mit Punkt.
  return berlinToday(d) === berlinToday(jetzt) ? ZEIT.format(d) : `${TAG_KURZ.format(d).replace(/\.?$/, ".")}, ${ZEIT.format(d)}`;
}

// ── Zusammenfassung über die Zeilen eines Angebots ──────────────────────────
export interface AufrufZeile {
  id: number; am: Date | string; art: AufrufArt; antwort: number | null; ip_gekuerzt: string | null; geraet: string | null;
  land: string | null; region: string | null; stadt: string | null; intern: boolean; intern_grund: string | null;
  intern_agent_id: number | null; roboter: boolean; gemeldet: boolean; meldung_ergebnis?: string | null;
}
export interface AufrufZusammenfassung {
  /** Wie oft der KUNDE die Seite geöffnet hat (ohne „nachgeladen", ohne PDFs, ohne du/Team/automatisch). */
  geoeffnet: number;
  vertragPdf: number; pruefberichtPdf: number;
  /** Alle Aufrufe des Kunden (jede Art) und daraus die Besuche (Pause ≥ 30 Min.). */
  kundeAufrufe: number; besuche: number;
  intern: number; automatisch: number; gesamt: number;
  erster: AufrufZeile | null; zuletzt: AufrufZeile | null;
}
const istKunde = (z: AufrufZeile) => !z.intern && !z.roboter;
export function aufrufZusammenfassung(zeilenRoh: AufrufZeile[]): AufrufZusammenfassung {
  const zeilen = [...zeilenRoh].sort((a, b) => alsDatum(a.am).getTime() - alsDatum(b.am).getTime());
  const kunde = zeilen.filter(istKunde);
  let besuche = 0; let vorher: number | null = null;
  for (const z of kunde) {
    const t = alsDatum(z.am).getTime();
    if (vorher === null || t - vorher >= AUFRUF_PAUSE_MIN * 60_000) besuche++;
    vorher = t;
  }
  return {
    geoeffnet: kunde.filter((z) => z.art === "seite").length,
    vertragPdf: kunde.filter((z) => z.art === "vertrag_pdf").length,
    pruefberichtPdf: kunde.filter((z) => z.art === "pruefbericht_pdf").length,
    kundeAufrufe: kunde.length, besuche,
    intern: zeilen.filter((z) => z.intern).length,
    automatisch: zeilen.filter((z) => !z.intern && z.roboter).length,
    gesamt: zeilen.length,
    erster: kunde[0] ?? null, zuletzt: kunde[kunde.length - 1] ?? null,
  };
}

// ── Titel, Aufgabe, Mail (rein) ─────────────────────────────────────────────
export interface MeldungLage {
  ref: string; kunde: Pick<AngebotKunde, "anrede" | "vorname" | "nachname">; status: string; gueltigBis: string | null;
  angenommenAm: Date | string | null; s: AufrufZusammenfassung; letzte: AufrufZeile[];
}
const wer = (k: MeldungLage["kunde"]) => (k.anrede === "Herr" || k.anrede === "Frau") && String(k.nachname || "").trim()
  ? `${k.anrede} ${String(k.nachname).trim()}` : angebotKundeName(k) || "Der Kunde";
const sein = (k: MeldungLage["kunde"]) => (k.anrede === "Herr" ? "sein" : k.anrede === "Frau" ? "ihr" : "das");
const geraetKurz = (g: string | null) => String(g || "Gerät unbekannt").split(" · ")[0];

/** „Herr Hildbrand hat sein Angebot geöffnet (2×, zuletzt 15:42, iPhone, Heidelberg)" — höchstens 160 Zeichen. */
export function meldungTitel(m: MeldungLage, jetzt: Date = new Date()): string {
  const z = m.s.zuletzt;
  if (!z) return `${wer(m.kunde)} hat ${sein(m.kunde)} Angebot noch nicht geöffnet`;
  const zahl = m.s.geoeffnet > 0 ? `${m.s.geoeffnet}×` : AUFRUF_ART_TEXT[z.art];
  let t = `${wer(m.kunde)} hat ${sein(m.kunde)} Angebot geöffnet (${zahl}, zuletzt ${zeitKurz(z.am, jetzt)}, ${geraetKurz(z.geraet)}, ${ortKurz(z)})`;
  if (m.angenommenAm) t += ` — angenommen am ${zeitKurz(m.angenommenAm, jetzt)}`;
  return t.length > 160 ? `${t.slice(0, 159)}…` : t;
}

// Gegenprüfung 01.10.2026 (F1): Aufgabe und Mail tragen KEINE IP — auch keine gekürzte. Die steht nur in der
// Tabelle und im Reiter, wo die Löschfrist greift. Die Mail liegt danach in Postfach und Brevo-Protokoll außerhalb
// jeder Frist; die Aufgabe räumt aufrufeAufraeumen mit auf (neutraler Satz, Systembeiträge weg).
function zeileText(z: AufrufZeile): string {
  return `· ${zeitLang(z.am)} — ${AUFRUF_ART_TEXT[z.art]} — ${z.geraet || "Gerät unbekannt"} — ${ortText(z)}`;
}
function lageZeilen(m: MeldungLage): string[] {
  const s = m.s; const z = s.zuletzt;
  const stand = m.angenommenAm
    ? `angenommen am ${zeitLang(m.angenommenAm)}`
    : `${m.status === "offen" ? "offen" : m.status}${m.gueltigBis ? `, gültig bis ${angebotTag(m.gueltigBis)}` : ""}`;
  return [
    `Seite geöffnet: ${s.geoeffnet}× · Vertrag-PDF: ${s.vertragPdf}× · Prüfbericht-PDF: ${s.pruefberichtPdf}× · Besuche: ${s.besuche}`,
    ...(s.erster ? [`Erster Aufruf: ${zeitLang(s.erster.am)}${z && z.id !== s.erster.id ? ` · zuletzt: ${zeitLang(z.am)}` : ""}`] : []),
    ...(z ? [`Zuletzt: ${z.geraet || "Gerät unbekannt"} · ${ortText(z)}`] : []),
    `Stand des Angebots: ${stand}`,
  ];
}
const FUSS = [
  `Gemeldet wird beim ersten Öffnen durch den Kunden und danach bei jedem neuen Besuch nach mindestens ${AUFRUF_PAUSE_MIN} Minuten Pause. `
    + "Deine eigenen Aufrufe (Chefbüro, Mitarbeiter-Sitzung, dein Anschluss) und automatische Abrufe lösen nichts aus. "
    + "Der Ort kommt nur aus den Angaben des Netzbetreibers — fehlt er, steht „Ort unbekannt“.",
];
/** Der Text der EINEN Aufgabe (wird bei jedem Aufruf neu geschrieben, nicht angehängt). */
export function aufgabeText(m: MeldungLage): string {
  return [
    `${angebotKundeName(m.kunde) || "Der Kunde"} hat ${sein(m.kunde)} persönliches Angebot ${m.ref} über den Link geöffnet.`,
    ...lageZeilen(m),
    "",
    "Letzte Aufrufe des Kunden (Zeit Berlin):",
    ...(m.letzte.length ? m.letzte.map(zeileText) : ["· noch keine"]),
    "",
    `Alle Aufrufe mit Zeit, Gerät und Ort (deine als „du“): ${AUFRUF_CHEF_PFAD}`,
    ...FUSS,
  ].join("\n").slice(0, 3900);
}
/** Betreff + Text der Mail an Justin. */
export function meldungMail(m: MeldungLage, jetzt: Date = new Date()): { betreff: string; text: string } {
  const z = m.s.zuletzt;
  return {
    betreff: meldungTitel(m, jetzt),
    text: [
      "Hallo Justin,",
      "",
      z
        ? `${angebotKundeName(m.kunde) || "Der Kunde"} hat ${sein(m.kunde)} persönliches Angebot ${m.ref} ${m.s.besuche > 1 ? "wieder" : "gerade"} geöffnet — ${zeitLang(z.am)}, ${z.geraet || "Gerät unbekannt"}, ${ortText(z)}.`
        : `Zum Angebot ${m.ref} gibt es noch keinen Aufruf des Kunden.`,
      "",
      ...lageZeilen(m),
      "",
      "Letzte Aufrufe des Kunden:",
      ...(m.letzte.length ? m.letzte.map(zeileText) : ["· noch keine"]),
      "",
      ...FUSS,
    ].join("\n"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
let bereit: Promise<void> | null = null;
/** Dieselbe DDL wie Migration 088 — additiv, über die DDL-Wache (Katalog-Vorabprüfung, kurzes lock_timeout). */
export function ensureAufrufTabellen(): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_angebot_aufrufe (
          id BIGSERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          art VARCHAR NOT NULL,
          antwort SMALLINT,
          ip_gekuerzt VARCHAR,
          geraet TEXT,
          land VARCHAR(2),
          region TEXT,
          stadt TEXT,
          geo_quelle TEXT,
          intern BOOLEAN NOT NULL DEFAULT FALSE,
          intern_grund VARCHAR,
          intern_agent_id INTEGER,
          roboter BOOLEAN NOT NULL DEFAULT FALSE,
          gemeldet BOOLEAN NOT NULL DEFAULT FALSE,
          meldung_ergebnis TEXT
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_angebot_aufrufe_angebot_idx ON fiaon_global_angebot_aufrufe (angebot_id, am DESC)`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_chef_anschluesse (
          ip_hash VARCHAR PRIMARY KEY,
          agent_id INTEGER,
          zuletzt TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
    })().catch((e) => { bereit = null; throw e; });
  }
  return bereit;
}

function geheimnis(): string {
  return process.env.SESSION_SECRET || "fiaon-dev-chef-anschluss";
}
/** Der Anschluss nur als HMAC — so steht keine Chef-IP im Klartext in der Datenbank. IPv6 als /64 (anschlussSchluessel). */
export function anschlussHash(ip: string): string {
  return createHmac("sha256", geheimnis()).update(`chef-anschluss:${anschlussSchluessel(ip)}`).digest("hex").slice(0, 40);
}

// ── Chefbüro-Anschlüsse merken (Middleware, routes.ts hinter dem Admin-Tor) ──
/** Anschluss → wann zuletzt geschrieben, von wem. Dient zugleich als schnelle Antwort im selben Prozess: Ruft Justin
 *  Sekundenbruchteile nach einer Chef-Anfrage den Kundenlink auf, ist die Zeile in der Datenbank vielleicht noch
 *  nicht geschrieben (feuern und vergessen) — der Prüfstand hat genau das gemessen. */
const gemerkt = new Map<string, { am: number; agentId: number | null }>();
/**
 * Merkt sich je Chefbüro-Anfrage unter /api/fiaon den Anschluss (HMAC der IP) — höchstens alle zehn Minuten
 * je Anschluss und Prozess, feuern und vergessen. Ruft IMMER next(); ein Fehler hier kippt keine Anfrage.
 */
export function chefAnschlussMerken(req: Request, _res: Response, next: NextFunction): void {
  try {
    const kekse = (req as any).cookies;
    if (kekse && (kekse.fiaon_chef || kekse.fiaon_admin)) {
      const chef = readChef(req);
      if (chef || hasAdminCode(req)) {
        const ip = aufrufClientIp(req);
        const merk = anschlussSchluessel(ip);
        const jetzt = Date.now();
        if (ip && jetzt - (gemerkt.get(merk)?.am ?? 0) > 10 * 60_000) {
          if (gemerkt.size > 2000) gemerkt.clear();
          gemerkt.set(merk, { am: jetzt, agentId: chef?.agentId ?? null });
          void anschlussSchreiben(ip, chef?.agentId ?? null).catch((e) => {
            gemerkt.delete(merk);
            console.warn("[FIAON-ANGEBOT] Chef-Anschluss nicht gemerkt:", e instanceof Error ? e.message : e);
          });
        }
      }
    }
  } catch { /* nie eine Anfrage kippen */ }
  next();
}
export async function anschlussSchreiben(ip: string, agentId: number | null): Promise<void> {
  await ensureAufrufTabellen();
  await sqlPool`
    INSERT INTO fiaon_chef_anschluesse (ip_hash, agent_id, zuletzt) VALUES (${anschlussHash(ip)}, ${agentId}, NOW())
    ON CONFLICT (ip_hash) DO UPDATE SET zuletzt = NOW(), agent_id = EXCLUDED.agent_id`;
}

// ── Protokollieren ──────────────────────────────────────────────────────────
export interface AufrufKontext {
  ip: string;
  userAgent: string;
  /** Die Kopfzeilen des Aufrufs — gelesen werden NUR die GEO_KOPFZEILEN. */
  kopf: Kopf;
  /** Eine Sitzung im Aufruf (von der Route aus den Cookies gelesen) — null = keine. */
  sitzung: { grund: "chefbuero" | "mitarbeiter"; agentId: number | null } | null;
}
export interface AufrufErgebnis { id: number; angebotId: number; intern: boolean; internGrund: InternGrund | null; roboter: boolean; neuerBesuch: boolean; melden: boolean }

/** Eine Zeile je Aufruf; danach (nur beim Kunden) Aufgabe nachführen bzw. melden. Gibt null, wenn nichts zu schreiben war. */
export async function aufrufProtokollieren(token: string, art: AufrufArt, antwort: number, k: AufrufKontext): Promise<AufrufErgebnis | null> {
  const t = angebotTokenPruefen(token);
  if (!t || !AUFRUF_ARTEN.includes(art)) return null;
  await ensureAngebotTabellen();
  await ensureAufrufTabellen();
  const [a] = (await sqlPool`SELECT id FROM fiaon_global_angebote WHERE angebot_ref = ${t.ref} LIMIT 1`) as any[];
  if (!a) return null;
  const angebotId = Number(a.id);
  // Gegenprüfung 01.10.2026 (F1): Nach der Löschfrist wird nichts mehr protokolliert — sonst entstünden jenseits
  // der Frist neue Kopien (Aufgabe, Mail), die der Kundenseite („Löschung 90 Tage nach Abschluss") widersprechen.
  if ((await loeschfaelligeAngebote([angebotId])).length) return null;
  const ort = ortAus(k.kopf || {});
  const roboter = istRoboterUnterschrift(k.ip || null, k.userAgent || null).roboter;
  let intern: { grund: InternGrund; agentId: number | null } | null = k.sitzung ? { grund: k.sitzung.grund, agentId: k.sitzung.agentId } : null;
  const imProzess = k.ip ? gemerkt.get(anschlussSchluessel(k.ip)) : undefined;
  if (!intern && imProzess && Date.now() - imProzess.am < CHEF_ANSCHLUSS_TAGE * 864e5) intern = { grund: "chef-anschluss", agentId: imProzess.agentId };
  if (!intern && k.ip) {
    const [m] = (await sqlPool`
      SELECT agent_id FROM fiaon_chef_anschluesse
       WHERE ip_hash = ${anschlussHash(k.ip)} AND zuletzt > NOW() - make_interval(days => ${CHEF_ANSCHLUSS_TAGE}) LIMIT 1`) as any[];
    if (m) intern = { grund: "chef-anschluss", agentId: m.agent_id != null ? Number(m.agent_id) : null };
  }
  const erg = await sqlPool.begin(async (tx: any) => {
    // Ein Angebot, eine Entscheidung zur Zeit: Zwei gleichzeitige Aufrufe melden nicht doppelt.
    await tx`SELECT pg_advisory_xact_lock(${SPERRE}::int, ${angebotId}::int)`;
    const [s] = (await tx`
      SELECT NOW() AS jetzt,
             MAX(am) FILTER (WHERE NOT intern AND NOT roboter) AS letzter_extern,
             MAX(am) FILTER (WHERE gemeldet) AS letzte_meldung,
             COUNT(*) FILTER (WHERE am > NOW() - interval '1 day')::int AS heute
        FROM fiaon_global_angebot_aufrufe WHERE angebot_id = ${angebotId}`) as any[];
    if (Number(s?.heute ?? 0) >= AUFRUF_TAGES_DECKEL) return null;
    const e = besuchEntscheidung({
      jetzt: new Date(s.jetzt), extern: !intern && !roboter,
      letzterExtern: s.letzter_extern ? new Date(s.letzter_extern) : null,
      letzteMeldung: s.letzte_meldung ? new Date(s.letzte_meldung) : null,
    });
    const [z] = (await tx`
      INSERT INTO fiaon_global_angebot_aufrufe
        (angebot_id, am, art, antwort, ip_gekuerzt, geraet, land, region, stadt, geo_quelle, intern, intern_grund, intern_agent_id, roboter, gemeldet)
      VALUES (${angebotId}, NOW(), ${art}, ${Number.isFinite(antwort) ? Math.trunc(antwort) : null}, ${ipKuerzen(k.ip)}, ${geraetAus(k.userAgent)},
              ${ort.land}, ${ort.region}, ${ort.stadt}, ${ort.quelle}, ${!!intern}, ${intern?.grund ?? null}, ${intern?.agentId ?? null}, ${roboter}, ${e.melden})
      RETURNING id`) as any[];
    return { id: Number(z.id), ...e };
  });
  if (!erg) return null;
  const ergebnis: AufrufErgebnis = { id: erg.id, angebotId, intern: !!intern, internGrund: intern?.grund ?? null, roboter, neuerBesuch: erg.neuerBesuch, melden: erg.melden };
  if (!intern && !roboter) {
    // Die Protokollzeile steht — eine scheiternde Meldung darf sie nicht kippen.
    await meldungNachfuehren(angebotId, erg.melden, erg.id).catch((e) => console.error(`[FIAON-ANGEBOT] ${t.ref}: Meldung zum Aufruf:`, e));
  }
  return ergebnis;
}

async function zeilenLesen(angebotIds: number[]): Promise<AufrufZeile[]> {
  if (!angebotIds.length) return [];
  const r = (await sqlPool`
    SELECT angebot_id, id, am, art, antwort, ip_gekuerzt, geraet, land, region, stadt, intern, intern_grund, intern_agent_id, roboter, gemeldet, meldung_ergebnis
      FROM fiaon_global_angebot_aufrufe WHERE angebot_id = ANY(${angebotIds}::int[]) ORDER BY am DESC, id DESC LIMIT 5000`) as any[];
  return r.map((x) => ({ ...x, id: Number(x.id), angebot_id: Number(x.angebot_id), intern_agent_id: x.intern_agent_id != null ? Number(x.intern_agent_id) : null, antwort: x.antwort != null ? Number(x.antwort) : null }));
}

/** Die Lage für Titel, Aufgabe und Mail. */
async function meldungLage(angebotId: number): Promise<MeldungLage | null> {
  const [a] = (await sqlPool`SELECT id, angebot_ref, kunde, status, gueltig_bis, angenommen_am FROM fiaon_global_angebote WHERE id = ${angebotId} LIMIT 1`) as any[];
  if (!a) return null;
  let kunde: any = a.kunde;
  if (typeof kunde === "string") { try { kunde = JSON.parse(kunde); if (typeof kunde === "string") kunde = JSON.parse(kunde); } catch { kunde = {}; } }
  const zeilen = await zeilenLesen([angebotId]);
  const s = aufrufZusammenfassung(zeilen);
  const gueltigBis = a.gueltig_bis instanceof Date ? berlinToday(a.gueltig_bis) : a.gueltig_bis ? String(a.gueltig_bis).slice(0, 10) : null;
  return {
    ref: String(a.angebot_ref), kunde: kunde || {}, status: String(a.status), gueltigBis,
    angenommenAm: a.angenommen_am ?? null, s,
    letzte: zeilen.filter(istKunde).slice(0, 8),
  };
}

/** Aufgabe still nachführen (Zähler, zuletzt) — oder, wenn `melden`: wieder öffnen, Zeitleiste, Mail. */
async function meldungNachfuehren(angebotId: number, melden: boolean, aufrufId: number): Promise<void> {
  const m = await meldungLage(angebotId);
  if (!m) return;
  const schluessel = aufrufAufgabeSchluessel(m.ref);
  const titel = meldungTitel(m);
  const text = aufgabeText(m);
  const { ensureTodoTabelle } = await import("../routes/fiaon-betreiber-todo");
  await ensureTodoTabelle();
  if (!melden) {
    await sqlPool`UPDATE fiaon_betreiber_todos SET titel = ${titel}, text = ${text}, updated_at = NOW() WHERE schluessel = ${schluessel}`;
    return;
  }
  // (a) die EINE Aufgabe: anlegen oder aktualisieren; eine erledigte geht wieder auf (erledigt_am weg — sonst
  //     setzt ensureTodoTabelle sie beim nächsten Start wieder auf „erledigt").
  const [r] = (await sqlPool`
    INSERT INTO fiaon_betreiber_todos (schluessel, titel, text, bereich, prioritaet, faellig_am, link, quelle, status, letzte_aktivitaet)
    VALUES (${schluessel}, ${titel}, ${text}, 'konten', 2, ${berlinToday()}, ${AUFRUF_CHEF_PFAD}, 'global', 'offen', NOW())
    ON CONFLICT (schluessel) DO UPDATE
      SET titel = EXCLUDED.titel, text = EXCLUDED.text, faellig_am = EXCLUDED.faellig_am, link = EXCLUDED.link,
          status = CASE WHEN fiaon_betreiber_todos.status = 'erledigt'
                        THEN (CASE WHEN fiaon_betreiber_todos.zustaendig_art = 'agent' THEN 'in_arbeit' ELSE 'offen' END)
                        ELSE fiaon_betreiber_todos.status END,
          erledigt_am = NULL, erledigt_von = NULL, letzte_aktivitaet = NOW(), updated_at = NOW()
    RETURNING id, (xmax = 0) AS neu`) as any[];
  const todoId = r?.id ? Number(r.id) : null;
  const z = m.s.zuletzt;
  if (todoId && z) {
    await sqlPool`
      INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
      VALUES (${todoId}, 'system', 'FIAON Global', 'kommentar',
              ${`${m.s.besuche > 1 ? "Neuer Besuch" : "Erster Aufruf"}: ${zeitLang(z.am)} · ${AUFRUF_ART_TEXT[z.art]} · ${z.geraet || "Gerät unbekannt"} · ${ortText(z)}`})`
      .catch((e) => console.warn(`[FIAON-ANGEBOT] ${m.ref}: Zeitleiste der Aufgabe:`, e instanceof Error ? e.message : e));
  }
  // (b) die Mail an Justin — derselbe Weg wie die Termin-Meldungen (eigeneMailSenden, direkt über Brevo).
  let mailSatz: string;
  try {
    const { eigeneMailSenden } = await import("./fiaon-brevo");
    const mail = meldungMail(m);
    const v = await eigeneMailSenden({ an: AUFRUF_MELDUNG_AN, name: "Justin", betreff: mail.betreff, text: mail.text, knoepfe: meldungKnoepfe() });
    mailSatz = v.ok ? `Mail an ${AUFRUF_MELDUNG_AN} gesendet` : `Mail an ${AUFRUF_MELDUNG_AN} nicht gesendet (${String(v.grund || "unbekannt").slice(0, 160)})`;
  } catch (e) {
    mailSatz = `Mail an ${AUFRUF_MELDUNG_AN} nicht gesendet (${(e instanceof Error ? e.message : String(e)).slice(0, 160)})`;
  }
  const satz = `${todoId ? `Aufgabe #${todoId}${r?.neu ? " angelegt" : " aktualisiert"}` : "Aufgabe nicht geschrieben"} · ${mailSatz}`;
  await sqlPool`UPDATE fiaon_global_angebot_aufrufe SET meldung_ergebnis = ${satz} WHERE id = ${aufrufId}`;
  if (mailSatz.includes("nicht gesendet")) console.warn(`[FIAON-ANGEBOT] ${m.ref}: ${satz}`);
}

const meldungKnoepfe = () => [{ text: "Alle Aufrufe ansehen", url: absoluteUrl(AUFRUF_CHEF_PFAD) }];

/** Für Prüfstand und Vorschau: Titel, Aufgabentext und die Mail (Betreff, Text, HTML im FIAON-Rahmen) — ohne zu senden. */
export async function aufrufMeldungVorschau(angebotId: number): Promise<{ titel: string; aufgabe: string; betreff: string; text: string; html: string } | null> {
  const m = await meldungLage(angebotId);
  if (!m) return null;
  const mail = meldungMail(m);
  const { rahmen } = await import("./fiaon-brevo");
  return { titel: meldungTitel(m), aufgabe: aufgabeText(m), betreff: mail.betreff, text: mail.text, html: rahmen(mail.betreff, mail.text, false, { knoepfe: meldungKnoepfe() }) };
}

/** Bei der Annahme: „angenommen" in DERSELBEN Aufgabe (bestehende Meldung bleibt; keine zweite Aufgabe, keine Mail). */
export async function aufrufeAnnahmeVermerken(angebotId: number): Promise<boolean> {
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebot_aufrufe') AS tab`) as any[];
  if (!t?.tab) return false;
  const m = await meldungLage(angebotId);
  if (!m || !m.angenommenAm) return false;
  const schluessel = aufrufAufgabeSchluessel(m.ref);
  const [r] = (await sqlPool`
    UPDATE fiaon_betreiber_todos SET titel = ${meldungTitel(m)}, text = ${aufgabeText(m)}, letzte_aktivitaet = NOW(), updated_at = NOW()
     WHERE schluessel = ${schluessel} RETURNING id`) as any[];
  if (!r) return false;
  await sqlPool`
    INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
    VALUES (${Number(r.id)}, 'system', 'FIAON Global', 'kommentar', ${`Angebot angenommen am ${zeitLang(m.angenommenAm)}.`})`.catch(() => {});
  return true;
}

// ── Für den Reiter der Leitung ──────────────────────────────────────────────
export interface AufrufListe {
  geoeffnet: number; vertragPdf: number; pruefberichtPdf: number; kundeAufrufe: number; besuche: number;
  intern: number; automatisch: number; gesamt: number;
  /** „01.10.2026, 15:42" — letzter Aufruf des Kunden (Zeit Berlin). */
  kundeZuletzt: { am: string; amText: string; art: string; geraet: string; ort: string } | null;
  kundeErster: { am: string; amText: string } | null;
  aufgabeSchluessel: string;
  /** Die Löschfrist ist erreicht (90 Tage nach Abschluss) — der Reiter sagt dann „gelöscht" statt „Noch nicht geöffnet". */
  geloescht: boolean;
  liste: { id: number; am: string; amText: string; art: string; geraet: string; ort: string; ip: string | null; wer: string; kunde: boolean; gemeldet: boolean; meldung: string | null; antwort: number | null }[];
}
/** Je Angebot: Zähler, „Kunde zuletzt" und die Liste (neueste zuerst, höchstens 100). „du" = der Betrachter selbst. */
export async function aufrufeFuerListe(angebote: { id: number; ref: string }[], betrachterAgentId: number | null): Promise<Map<number, AufrufListe>> {
  const aus = new Map<number, AufrufListe>();
  if (!angebote.length) return aus;
  const [t] = (await sqlPool`SELECT to_regclass('public.fiaon_global_angebot_aufrufe') AS tab`) as any[];
  const zeilen = t?.tab ? await zeilenLesen(angebote.map((a) => a.id)) : [];
  const faellig = new Set((await loeschfaelligeAngebote(angebote.map((a) => a.id))).map((f) => f.id));
  const agentIds = Array.from(new Set(zeilen.map((z) => z.intern_agent_id).filter((x): x is number => x != null && x !== betrachterAgentId)));
  const namen = new Map<number, string>();
  if (agentIds.length) {
    for (const r of (await sqlPool`SELECT id, name FROM fiaon_agents WHERE id = ANY(${agentIds}::int[])`.catch(() => [])) as any[]) namen.set(Number(r.id), String(r.name || ""));
  }
  const werText = (z: AufrufZeile): string => {
    if (!z.intern) return z.roboter ? "automatisch" : "Kunde";
    if (z.intern_agent_id == null || z.intern_agent_id === betrachterAgentId) return "du";
    return namen.get(z.intern_agent_id) || "Team";
  };
  for (const a of angebote) {
    const eigene = zeilen.filter((z: any) => z.angebot_id === a.id);
    const s = aufrufZusammenfassung(eigene);
    const zl = s.zuletzt;
    aus.set(a.id, {
      geoeffnet: s.geoeffnet, vertragPdf: s.vertragPdf, pruefberichtPdf: s.pruefberichtPdf, kundeAufrufe: s.kundeAufrufe, besuche: s.besuche,
      intern: s.intern, automatisch: s.automatisch, gesamt: s.gesamt,
      kundeZuletzt: zl ? { am: alsDatum(zl.am).toISOString(), amText: zeitLang(zl.am), art: AUFRUF_ART_TEXT[zl.art], geraet: zl.geraet || "Gerät unbekannt", ort: ortText(zl) } : null,
      kundeErster: s.erster ? { am: alsDatum(s.erster.am).toISOString(), amText: zeitLang(s.erster.am) } : null,
      aufgabeSchluessel: aufrufAufgabeSchluessel(a.ref),
      geloescht: faellig.has(a.id),
      liste: eigene.slice(0, 100).map((z) => ({
        id: z.id, am: alsDatum(z.am).toISOString(), amText: zeitLang(z.am), art: AUFRUF_ART_TEXT[z.art] ?? String(z.art),
        geraet: z.geraet || "Gerät unbekannt", ort: ortText(z), ip: z.ip_gekuerzt, wer: werText(z), kunde: istKunde(z),
        gemeldet: !!z.gemeldet, meldung: z.meldung_ergebnis ?? null, antwort: z.antwort,
      })),
    });
  }
  return aus;
}

// ── Aufräumen (Stundenlauf globalAngebotLauf) ───────────────────────────────
/**
 * Die EINE Regel der Speicherdauer — Aufräumen, Protokoll und Reiter lesen dieselbe Abfrage:
 * 90 Tage nach Annahme, Rückzug bzw. Ende der Gültigkeit. `ids` = null → alle Angebote.
 */
export async function loeschfaelligeAngebote(ids: number[] | null): Promise<{ id: number; ref: string; kunde: MeldungLage["kunde"] }[]> {
  if (ids && !ids.length) return [];
  const heute = berlinToday();
  const r = (await sqlPool`
    SELECT a.id, a.angebot_ref, a.kunde
      FROM fiaon_global_angebote a
     WHERE (${ids}::int[] IS NULL OR a.id = ANY(${ids}::int[]))
       AND ((a.status = 'angenommen' AND a.angenommen_am < NOW() - make_interval(days => ${AUFRUF_LOESCHEN_TAGE}))
         OR (a.status = 'zurueckgezogen' AND COALESCE(a.zurueckgezogen_am, a.updated_at) < NOW() - make_interval(days => ${AUFRUF_LOESCHEN_TAGE}))
         OR (a.status IN ('offen', 'abgelaufen') AND a.gueltig_bis < ${heute}::date - ${AUFRUF_LOESCHEN_TAGE}::int))`) as any[];
  return r.map((x) => {
    let kunde: any = x.kunde;
    if (typeof kunde === "string") { try { kunde = JSON.parse(kunde); if (typeof kunde === "string") kunde = JSON.parse(kunde); } catch { kunde = {}; } }
    return { id: Number(x.id), ref: String(x.angebot_ref), kunde: kunde || {} };
  });
}

/** Woran eine schon geleerte Aufgabe zu erkennen ist (der Lauf schreibt sie nicht jede Stunde neu). */
export const AUFGABE_GELOESCHT_ANFANG = "Aufrufprotokoll gelöscht:";
/** Titel und Text der Aufgabe nach der Löschfrist — ohne Zeitpunkt, Gerät, Ort oder IP. */
export function aufgabeNachLoeschung(ref: string, kunde: MeldungLage["kunde"]): { titel: string; text: string } {
  return {
    titel: `${wer(kunde)} — Angebot ${ref}: Aufrufprotokoll nach ${AUFRUF_LOESCHEN_TAGE} Tagen gelöscht`.slice(0, 160),
    text: `${AUFGABE_GELOESCHT_ANFANG} Die Aufrufe des persönlichen Links zu Angebot ${ref} sind ${AUFRUF_LOESCHEN_TAGE} Tage nach `
      + "Abschluss gelöscht, wie auf der Kundenseite angekündigt. Deshalb stehen Zeitpunkte, Geräte und Orte auch hier nicht mehr, "
      + "und die Einträge der Zeitleiste dazu sind entfernt.",
  };
}

/**
 * 90 Tage nach Annahme / Rückzug / Ende der Gültigkeit löschen; Chef-Anschlüsse nach 30 Tagen.
 * Gegenprüfung 01.10.2026 (F1): Die Frist gilt auch für die Kopien — die EINE Aufgabe je Angebot bekommt einen
 * neutralen Titel und Text, ihre Systembeiträge („Erster Aufruf …", „Neuer Besuch …", „angenommen am …") gehen weg.
 * Was Justin selbst in die Aufgabe geschrieben hat, bleibt. Die Mail liegt in seinem Postfach — die erreicht kein Lauf;
 * deshalb trägt sie keine IP.
 */
export async function aufrufeAufraeumen(): Promise<{ aufrufe: number; anschluesse: number; aufgaben: number; beitraege: number }> {
  const [t] = (await sqlPool`
    SELECT to_regclass('public.fiaon_global_angebot_aufrufe') AS aufrufe, to_regclass('public.fiaon_chef_anschluesse') AS anschluesse,
           to_regclass('public.fiaon_betreiber_todos') AS todos, to_regclass('public.fiaon_betreiber_todo_beitraege') AS beitraege`) as any[];
  let aufrufe = 0; let anschluesse = 0; let aufgaben = 0; let beitraege = 0;
  if (t?.aufrufe) {
    const faellig = await loeschfaelligeAngebote(null);
    const weg = await sqlPool`
      DELETE FROM fiaon_global_angebot_aufrufe u
       WHERE u.angebot_id = ANY(${faellig.map((f) => f.id)}::int[])
          OR NOT EXISTS (SELECT 1 FROM fiaon_global_angebote a WHERE a.id = u.angebot_id)`;
    aufrufe = Number((weg as any).count ?? 0);
    if (t.todos && faellig.length) {
      const neu = faellig.map((f) => ({ schluessel: aufrufAufgabeSchluessel(f.ref), ...aufgabeNachLoeschung(f.ref, f.kunde) }));
      const geleert = (await sqlPool`
        UPDATE fiaon_betreiber_todos t
           SET titel = n.titel, text = n.text, updated_at = NOW()
          FROM unnest(${neu.map((x) => x.schluessel)}::text[], ${neu.map((x) => x.titel)}::text[], ${neu.map((x) => x.text)}::text[]) AS n(schluessel, titel, text)
         WHERE t.schluessel = n.schluessel AND position(${AUFGABE_GELOESCHT_ANFANG} in COALESCE(t.text, '')) <> 1
        RETURNING t.id`) as any[];
      aufgaben = geleert.length;
      if (t.beitraege) {
        const bw = await sqlPool`
          DELETE FROM fiaon_betreiber_todo_beitraege b
           USING fiaon_betreiber_todos t
           WHERE b.todo_id = t.id AND t.schluessel = ANY(${neu.map((x) => x.schluessel)}::text[])
             AND b.autor_art = 'system' AND b.autor_name = 'FIAON Global'`;
        beitraege = Number((bw as any).count ?? 0);
      }
    }
  }
  if (t?.anschluesse) {
    const weg = await sqlPool`DELETE FROM fiaon_chef_anschluesse WHERE zuletzt < NOW() - make_interval(days => ${CHEF_ANSCHLUSS_TAGE})`;
    anschluesse = Number((weg as any).count ?? 0);
  }
  return { aufrufe, anschluesse, aufgaben, beitraege };
}
