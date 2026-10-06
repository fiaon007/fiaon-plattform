// ═══════════════════════════════════════════════════════════════════════════
// Zeichen des Social-Feeds (E-296) — selbst gezeichnet, 1,5 px Strich,
// currentColor (AGENTS.md: keine Icon-Bibliotheken, keine Fremdlogos als Bild).
// ═══════════════════════════════════════════════════════════════════════════
import type { SozialesProfil } from "@shared/fiaon-sozial";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";

type Z = { groesse?: number; className?: string };
const svg = (g: number, className?: string) => ({ width: g, height: g, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: "false" as const, className });

export function KanalZeichen({ kanal, groesse = 18, className }: Z & { kanal: SozialesProfil["kanal"] }) {
  if (kanal === "instagram") {
    return (
      <svg {...svg(groesse, className)} strokeWidth={1.7}>
        <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.05" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <path d="M13.6 21v-7.4h2.5l.4-2.9h-2.9V8.9c0-.8.2-1.4 1.4-1.4h1.6V4.9c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.1H8v2.9h2.5V21h3.1z" />
    </svg>
  );
}

/** Zwei versetzte Rechtecke — „mehrere Folien“. */
export function KarussellZeichen({ groesse = 16, className }: Z) {
  return <svg {...svg(groesse, className)} strokeWidth={1.8}><rect x="7.5" y="3.5" width="13" height="13" rx="2.5" /><path d="M16.5 20.5h-10a3 3 0 0 1-3-3v-10" /></svg>;
}

/** Abspiel-Zeichen im abgerundeten Rahmen — „Reel“. */
export function ReelZeichen({ groesse = 16, className }: Z) {
  return <svg {...svg(groesse, className)} strokeWidth={1.8}><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><path d="M10.2 8.8v6.4l5.2-3.2z" fill="currentColor" /></svg>;
}

export function PfeilZeichen({ richtung = "rechts", groesse = 16, className }: Z & { richtung?: "links" | "rechts" }) {
  return <svg {...svg(groesse, className)} strokeWidth={1.8}>{richtung === "rechts" ? <path d="m9 5 7 7-7 7" /> : <path d="m15 5-7 7 7 7" />}</svg>;
}

export function NachAussenZeichen({ groesse = 14, className }: Z) {
  return <svg {...svg(groesse, className)} strokeWidth={1.7}><path d="M7 17 17 7M9 7h8v8" /></svg>;
}

export function SchliessenZeichen({ groesse = 18, className }: Z) {
  return <svg {...svg(groesse, className)} strokeWidth={1.8}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

/** Das Profilbild: weißes F auf Navy (wie auf Instagram), im Verlaufsring einer Story. */
export function Profilbild({ groesse = 64, ring = true, className = "" }: { groesse?: number; ring?: boolean; className?: string }) {
  return (
    <span className={`sz-avatar${ring ? " mit-ring" : ""} ${className}`} style={{ width: groesse, height: groesse }} aria-hidden="true">
      {ring && <span className="sz-ring" />}
      <span className="sz-avatar-kern"><FiaonWortmarke variante="f" farbe="#ffffff" hoehe="46%" dekorativ /></span>
    </span>
  );
}

// ── Kleinteile des Handys (nur Dekor, aria-hidden über dem Container) ──
export function Statusleiste() {
  return (
    <div className="sz-status" aria-hidden="true">
      <span className="zeit">9:41</span>
      <span className="sz-insel" />
      <span className="rechts">
        <svg width="16" height="11" viewBox="0 0 16 11" fill="currentColor"><rect x="0" y="7" width="3" height="4" rx=".8" /><rect x="4.3" y="5" width="3" height="6" rx=".8" /><rect x="8.6" y="2.6" width="3" height="8.4" rx=".8" /><rect x="12.9" y="0" width="3" height="11" rx=".8" /></svg>
        <svg width="14" height="11" viewBox="0 0 14 11" fill="currentColor"><path d="M7 2.2c2 0 3.9.8 5.3 2.1l1-1.1A9.2 9.2 0 0 0 7 .7 9.2 9.2 0 0 0 .7 3.2l1 1.1A7.7 7.7 0 0 1 7 2.2Zm0 3c1.2 0 2.4.5 3.2 1.3l1-1.1A6.1 6.1 0 0 0 7 3.7c-1.6 0-3.1.6-4.2 1.7l1 1.1C4.6 5.7 5.8 5.2 7 5.2Zm0 3a1.4 1.4 0 0 0-1 .4L7 10.5l1-1.9a1.4 1.4 0 0 0-1-.4Z" /></svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none"><rect x=".5" y=".5" width="20" height="10" rx="2.6" stroke="currentColor" opacity=".45" /><rect x="2" y="2" width="15" height="7" rx="1.4" fill="currentColor" /><path d="M22 3.8v3.4c.7-.3 1.2-1 1.2-1.7s-.5-1.4-1.2-1.7Z" fill="currentColor" opacity=".45" /></svg>
      </span>
    </div>
  );
}

export function RasterZeichen({ groesse = 18 }: Z) {
  return <svg {...svg(groesse)} strokeWidth={1.6}><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" /></svg>;
}

export function UnterleisteZeichen({ art }: { art: "start" | "suche" | "neu" | "reels" }) {
  const p = {
    start: <path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />,
    suche: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5" /></>,
    neu: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M12 8v8M8 12h8" /></>,
    reels: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><path d="M3.5 8.5h17M8 3.5l2.5 5M13.5 3.5l2.5 5" /><path d="M10.5 12v5l4-2.5z" fill="currentColor" /></>,
  }[art];
  return <svg {...svg(20)} strokeWidth={1.7}>{p}</svg>;
}

export function KettenZeichen() {
  return <svg {...svg(11)} strokeWidth={2}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" /></svg>;
}
