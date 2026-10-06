// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL-STUDIO — kleine Bausteine für Plan, Post-Detail und Vorschau
// (06.10.2026, E-294)
//
// Regeln, Pfade und Antwortformen stehen in shared/fiaon-social.ts (eine Regel,
// ein Ort). Hier nur, was die Oberfläche dreimal braucht: Schreiben an die
// Studio-API mit Versionsprüfung, Kanal-Kürzel, Format-Zeichen, Status-Pille,
// Kopieren und die Berliner Kalendertage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import { API } from "../chef-teile";
import {
  KANAL_INFO, SOCIAL_API, SOCIAL_STATUS_INFO, FORMAT_INFO, istSocialKanal,
  type SocialAktion, type SocialAktionAntwort, type SocialAktionKoerper, type SocialFehler,
  type SocialFormat, type SocialKanal, type SocialStatus,
} from "@shared/fiaon-social";

/** Fehler einer Studio-Aktion — mit dem Code des Servers (z. B. VERSION_VERALTET, WORTCHECK_ROT). */
export class SozialFehler extends Error {
  code: SocialFehler["code"] | undefined;
  daten: SocialFehler | null;
  status: number;
  constructor(text: string, status: number, daten: SocialFehler | null) {
    super(text);
    this.code = daten?.code;
    this.daten = daten;
    this.status = status;
  }
}

/**
 * Eine Aktion am Post (POST /chef/social/post/:id/<aktion>). Jede trägt `version`;
 * weicht sie ab, antwortet der Server 409 VERSION_VERALTET — die Oberfläche lädt
 * dann neu und sagt, dass jemand anderes schneller war.
 */
export async function sozialAktion<A extends SocialAktion>(id: number, aktion: A, koerper: SocialAktionKoerper[A]): Promise<SocialAktionAntwort> {
  let r: Response;
  try {
    r = await fetch(`${API}${SOCIAL_API.aktion(id, aktion)}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(koerper),
    });
  } catch {
    throw new SozialFehler("Keine Verbindung zum Server — bitte noch einmal.", 0, null);
  }
  const j = await r.json().catch(() => null);
  if (r.ok && j?.ok) return j as SocialAktionAntwort;
  if (r.status === 401) throw new SozialFehler("Die Anmeldung ist abgelaufen. Bitte neu anmelden.", 401, j);
  if (r.status === 409 && j?.code === "VERSION_VERALTET") {
    throw new SozialFehler("Der Post wurde inzwischen geändert (von dir in einem anderen Fenster, von Florentine oder durch einen neuen Import). Ich habe den neuen Stand geladen — bitte noch einmal prüfen.", 409, j);
  }
  throw new SozialFehler(j?.error || "Das hat nicht geklappt — bitte noch einmal.", r.status, j);
}

/** Text in die Zwischenablage — mit Rückfall für ältere Safari-Fassungen. */
export async function kopieren(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* Rückfall unten */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed"; ta.style.opacity = "0"; ta.style.top = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

// ── Kanäle ─────────────────────────────────────────────────────────────────
export function KanalKuerzel({ k }: { k: string }) {
  if (!istSocialKanal(k)) return null;
  const i = KANAL_INFO[k];
  return <span className="so-kanal" data-k={k} title={i.titel}>{i.kurz}</span>;
}
export function Kanaele({ liste }: { liste: readonly string[] }) {
  return (
    <span className="so-kanaele" aria-label={`Kanäle: ${liste.filter(istSocialKanal).map((k) => KANAL_INFO[k as SocialKanal].titel).join(", ")}`}>
      {liste.map((k) => <KanalKuerzel key={k} k={k} />)}
    </span>
  );
}

// ── Status ─────────────────────────────────────────────────────────────────
const TON_KLASSE: Record<string, string> = { neutral: "", warn: "warn", gut: "gut", krit: "krit", blau: "akz" };
export const statusKlasse = (s: SocialStatus) => TON_KLASSE[SOCIAL_STATUS_INFO[s]?.ton ?? "neutral"];
export function StatusPille({ s, kurz = false }: { s: SocialStatus; kurz?: boolean }) {
  const i = SOCIAL_STATUS_INFO[s];
  if (!i) return null;
  return <span className={`mara-pille ${statusKlasse(s)}`} title={i.erklaerung}>{kurz ? i.kurz : i.titel}</span>;
}
export function StatusPunkt({ s }: { s: SocialStatus }) {
  const i = SOCIAL_STATUS_INFO[s];
  const k = statusKlasse(s);
  // Blau hat keinen eigenen Punkt in chef-mara.css — Freigegeben/Eingeplant als Ring in der Akzentfarbe.
  const stil = k === "akz" ? { background: "var(--m-licht)", boxShadow: "0 0 0 3px rgba(40, 141, 250, .16)" } : undefined;
  return <span className={`mara-punkt ${k === "akz" ? "" : k}`} style={stil} title={i?.titel} aria-label={i?.titel} role="img" />;
}

// ── Format-Zeichen (eigene 1,5-px-Linien, keine Symbolbibliothek) ─────────
export function FormatZeichen({ f, className = "so-zeichen" }: { f: SocialFormat | "reel" | "karussell"; className?: string }) {
  const gemeinsam = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (f === "reel") {
    return (
      <svg {...gemeinsam}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <path d="M3 8.5h18M8.5 3l2.5 5.5M14 3l2.5 5.5" />
        <path d="M10 12v5l4.3-2.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (f === "karussell") {
    return (
      <svg {...gemeinsam}>
        <rect x="7" y="7" width="14" height="14" rx="3" />
        <path d="M17 7V5.5A2.5 2.5 0 0 0 14.5 3h-9A2.5 2.5 0 0 0 3 5.5v9A2.5 2.5 0 0 0 5.5 17H7" />
      </svg>
    );
  }
  if (f === "story") return <svg {...gemeinsam}><rect x="6" y="2.5" width="12" height="19" rx="3" /><circle cx="12" cy="12" r="3" /></svg>;
  if (f === "dokument") return <svg {...gemeinsam}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" /></svg>;
  if (f === "text") return <svg {...gemeinsam}><path d="M5 6h14M5 10h14M5 14h10M5 18h7" /></svg>;
  return <svg {...gemeinsam}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="1.8" /><path d="m4 18 5.5-5 4 3.5 3-2.5 4.5 4" /></svg>;
}
export function FormatEtikett({ f }: { f: SocialFormat }) {
  return <span className="so-format"><FormatZeichen f={f} />{FORMAT_INFO[f]?.titel ?? f}</span>;
}

// ── Berliner Kalendertage ──────────────────────────────────────────────────
// Rechnen nur mit „JJJJ-MM-TT" um 12:00 UTC — so kippt kein Tag über die
// Zeitumstellung (25.10.). Die Anzeige formatiert in Europe/Berlin.
export const tagPlus = (iso: string, n: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Montag der Woche (ISO). */
export const wochenStart = (iso: string): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  const wt = (d.getUTCDay() + 6) % 7;
  return tagPlus(iso, -wt);
};
export const monatsStart = (iso: string): string => `${iso.slice(0, 7)}-01`;
export const monatsEnde = (iso: string): string => {
  const d = new Date(`${iso.slice(0, 7)}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};
const WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
export const wochentag = (iso: string): string => WT[(new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7];
/** „06.10." */
export const tagKurz = (iso: string): string => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;
/** Kalenderwoche nach ISO 8601. */
export function kalenderwoche(iso: string): number {
  const d = new Date(`${iso}T12:00:00Z`);
  const wt = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - wt + 3);
  const ersterDo = new Date(Date.UTC(d.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((d.getTime() - ersterDo.getTime()) / 86_400_000 - 3 + ((ersterDo.getUTCDay() + 6) % 7)) / 7);
}
/** „heute", „morgen", „gestern" oder „Mi 08.10." */
export function tagWort(iso: string, heute: string): string {
  if (iso === heute) return "heute";
  if (iso === tagPlus(heute, 1)) return "morgen";
  if (iso === tagPlus(heute, -1)) return "gestern";
  return `${wochentag(iso)} ${tagKurz(iso)}`;
}
/** Bytes lesbar: „14,4 MB", „568 KB". */
export function groesse(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return "—";
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(b / 1024)).toLocaleString("de-DE")} KB`;
}
/** Restzeit bis zu einem Zeitpunkt in Worten: „in 2 Std. 14 Min.", „in 9 Min.", „jetzt". */
export function restzeit(bisMs: number, jetztMs: number): string {
  const ms = bisMs - jetztMs;
  if (ms <= 30_000) return "jetzt";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `in ${min} Min.`;
  const std = Math.floor(min / 60);
  const rest = min % 60;
  if (std < 24) return rest ? `in ${std} Std. ${rest} Min.` : `in ${std} Std.`;
  const tage = Math.floor(std / 24);
  return `in ${tage} ${tage === 1 ? "Tag" : "Tagen"}`;
}

// ── Zustand des Plans (lebt in ChefMaraSocial, damit Woche und Filter nach dem Post-Detail stehen) ──
export type SocialSicht = "plan" | "vorschau";
/** Vorschau: „alle" = das EINE Raster @fiaon.ltd (Vorgabe); fiaon/global = Filter darauf. */
export type VorschauKonto = "alle" | "fiaon" | "global";
export type PlanAnsicht = "woche" | "monat";
export interface PlanFilter { kanal: string; marke: string; status: string }
export interface PlanZustand { anker: string; ansicht: PlanAnsicht; filter: PlanFilter }

/** Heute in Berlin als „JJJJ-MM-TT" (formatToParts — nie Number(format()), Zeit-Falle 04.09.2026). */
export function heuteBerlin(): string {
  const t: Record<string, string> = {};
  const f = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
  for (const p of f.formatToParts(new Date())) t[p.type] = p.value;
  return `${t.year}-${t.month}-${t.day}`;
}

/** Der Zeitraum, den GET /chef/social/plan laden soll: die Woche (Mo–So) oder der Monat in ganzen Wochen. */
export function planZeitraum(z: PlanZustand): { von: string; bis: string } {
  if (z.ansicht === "monat") return { von: wochenStart(monatsStart(z.anker)), bis: tagPlus(wochenStart(monatsEnde(z.anker)), 6) };
  const von = wochenStart(z.anker);
  return { von, bis: tagPlus(von, 6) };
}

// ── Zurück zur Karte (Prüfung 06.10.2026) ─────────────────────────────────
/**
 * Nach „Zurück zum Plan“ bzw. „zur Vorschau“: sobald die Daten stehen, die
 * Karte des zuletzt geöffneten Posts wieder einblenden — sonst steht man bei
 * elf Posts wieder ganz oben. `selektor(id)` findet die Karte im DOM.
 */
export function useZurueckZurKarte(zuletzt: number | null | undefined, bereit: boolean, selektor: (id: number) => string, fertig?: () => void) {
  const erledigt = useRef<number | null>(null);
  useEffect(() => {
    if (!zuletzt || !bereit || erledigt.current === zuletzt) return;
    const el = document.querySelector(selektor(zuletzt)) as HTMLElement | null;
    erledigt.current = zuletzt;
    if (el) {
      try { el.scrollIntoView({ block: "center", behavior: "auto" }); } catch { /* egal */ }
      try { el.focus({ preventScroll: true }); } catch { /* egal */ }
    }
    fertig?.();
  }, [zuletzt, bereit]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Lücken im Plan zusammenfassen ─────────────────────────────────────────
/** Aufeinanderfolgende Tage zu Spannen: ["06.10.", "08.10.–12.10."]. */
export function tageZuSpannen(tage: string[]): { von: string; bis: string; n: number }[] {
  const sortiert = Array.from(new Set(tage)).sort();
  const out: { von: string; bis: string; n: number }[] = [];
  for (const t of sortiert) {
    const letzte = out[out.length - 1];
    if (letzte && tagPlus(letzte.bis, 1) === t) { letzte.bis = t; letzte.n++; }
    else out.push({ von: t, bis: t, n: 1 });
  }
  return out;
}

// ── Teilen / In Fotos sichern (Handy) ─────────────────────────────────────
/**
 * Kann dieses Gerät Dateien über das Teilen-Blatt weitergeben (iPhone, Android)?
 * Nur dann gibt es „In Fotos sichern“ — Instagram wählt am Handy aus „Fotos“,
 * nicht aus der Dateien-App, in der ein normaler Download landet.
 */
export function kannDateienTeilen(): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
    const grob = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (!grob) return false;
    return navigator.canShare({ files: [new File([new Uint8Array([0xff, 0xd8, 0xff])], "probe.jpg", { type: "image/jpeg" })] });
  } catch { return false; }
}

/** Lädt die Dateien (mit Sitzung) als File-Objekte — in der übergebenen Reihenfolge. */
export async function dateienHolen(liste: { url: string; name: string; mime: string }[]): Promise<File[]> {
  const out: File[] = [];
  for (const d of liste) {
    const r = await fetch(d.url, { credentials: "include" });
    if (!r.ok) throw new Error(`„${d.name}“ ließ sich nicht laden (HTTP ${r.status}).`);
    const b = await r.blob();
    out.push(new File([b], d.name, { type: d.mime || b.type }));
  }
  return out;
}
