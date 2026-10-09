// ═══════════════════════════════════════════════════════════════════════════
// „DIE SCHALTZENTRALE“ — EIN ANSPRECHPARTNER STATT ACHT ANLAUFSTELLEN (09.10.2026, E-323)
//
// Justin zum bisherigen Stern (GlobalStern.tsx, E-293): „die Striche also das Netzwerk muss viel besser gemacht
// werden und genauer, und viel besser animiert — es soll ja super clean und strukturiert aussehen MIT FIAON“. Aus
// zwei bewegten Vorschlägen (04_Fahrplan/BUSINESS_HERO_2026-10/) wählte er 1 „Die Schaltzentrale“.
//
// Desktop: acht gleich gebaute Glaskarten in zwei Spalten (links Gründung und Dokumente, rechts Steuern und Geld),
// in der Mitte die Navy-Zentrale „Ihr Ansprechpartner“. Die Leitungen laufen rechtwinklig mit runden Ecken wie auf
// einer Platine, verschachtelt, sodass sich keine kreuzt. Die Bühne hat feste Entwurfsmaße (1040 × 600) und wird
// als Ganzes auf die Spaltenbreite skaliert (--k) — Leitungen und Karten liegen pixelgenau, ohne zu messen.
// Handy (≤ 860 px): derselbe Gedanke als Baum — Sie → Zentrale → eine Leiste links zu allen acht Stellen.
//
// „Mit“: Sie → Zentrale, dann wachsen die acht Leitungen gleichzeitig (je 70 ms versetzt) aus der Zentrale; wo eine
// ankommt, leuchtet der Anschluss, die Karte glimmt kurz, das Zeichen erscheint. Danach wandert alle 0,8 s ein
// Lichtimpuls zur nächsten Stelle (Runde 6,4 s). „Ohne“: keine Zentrale, acht verschlungene Wege von Ihnen zu jeder
// Stelle, die Karten liegen schief. Selbstlauf wie bisher: außer Sicht geladen → „Ohne“, beim Hineinscrollen EINMAL
// → „Mit“; danach der Schalter (gestaucht, --t .55). „Weniger Bewegung“: sofort „Mit“, ohne Übergänge.
//
// Versprechen wie bisher: sechs Stellen mit Haken „Im Festpreis enthalten“, Banken und Kartenherausgeber nur der
// offene Kreis „Antrag vorbereitet — das Institut entscheidet“. Ein Tipp auf einen Namen zeigt den Satz aus
// GLOBAL_INKLUSIVE (Begriff.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { GlobalSternKnoten } from "@/i18n/global";
import { Begriff, mitBegriffen } from "@/components/site/global/Begriff";
import { ruhigGewuenscht } from "@/components/site/global/bewegung";
import "@/styles/global-schaltzentrale.css";

const W = 1040, H = 600;
const HUB = { x: 520, y: 318, r: 58 };
const SIE = { x: 520, y: 44 };
const KARTE = { w: 272, h: 78 };
const YS = [150, 262, 374, 486];
// Links Gründung und Dokumente, rechts Steuern und Geld (Index in sternKnoten).
const LINKS = [0, 1, 3, 2], RECHTS = [4, 5, 6, 7];
const DY = [-33, -11, 11, 33];
// Schiefe Lage im Zustand „Ohne“ (px, px, Grad) je Platz.
const SCHIEF = [[-14, 10, -3], [8, -12, 2], [-6, 14, 2.5], [12, 6, -2], [10, -8, 3], [-12, 12, -2.5], [6, 10, -3], [-10, -6, 2]] as const;
const STRICH = ["2 5", "6 4", "1 4", "9 4 2 4", "3 4", "11 5", "1 6", "5 3 1 3"];

interface Platz { i: number; seite: -1 | 1; x: number; y: number; port: [number, number]; d: string; ohne: string }

/** Rechtwinkliger Pfad durch Punkte mit runden Ecken (Radius r, an kurzen Stücken kleiner). */
function eckig(p: [number, number][], r = 16): string {
  const z = (n: number) => n.toFixed(1);
  let d = `M${z(p[0][0])} ${z(p[0][1])}`;
  for (let k = 1; k < p.length - 1; k++) {
    const [ax, ay] = p[k - 1], [bx, by] = p[k], [cx, cy] = p[k + 1];
    const l1 = Math.hypot(bx - ax, by - ay), l2 = Math.hypot(cx - bx, cy - by);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    const ix = bx - ((bx - ax) / l1) * rr, iy = by - ((by - ay) / l1) * rr;
    const ox = bx + ((cx - bx) / l2) * rr, oy = by + ((cy - by) / l2) * rr;
    d += ` L${z(ix)} ${z(iy)} Q${z(bx)} ${z(by)} ${z(ox)} ${z(oy)}`;
  }
  const e = p[p.length - 1];
  return d + ` L${z(e[0])} ${z(e[1])}`;
}

const PLAETZE: Platz[] = [...LINKS.map((i, j) => ({ i, j, seite: -1 as const })), ...RECHTS.map((i, j) => ({ i, j, seite: 1 as const }))].map(({ i, j, seite }, n) => {
  const y = YS[j];
  const x = seite < 0 ? 20 : W - 20 - KARTE.w;
  const portX = seite < 0 ? x + KARTE.w : x;
  const hy = HUB.y + DY[j];
  const hx = HUB.x + seite * Math.sqrt(HUB.r * HUB.r - DY[j] * DY[j]);
  // Außen liegende Karten biegen nah an der Zentrale ab, innen liegende weiter draußen — so kreuzt sich nichts.
  const bus = HUB.x + seite * (j === 0 || j === 3 ? 80 : 120);
  const d = eckig([[hx, hy], [bus, hy], [bus, y], [portX, y]]);
  const c1x = SIE.x + seite * (-170 + (j % 4) * 105), c1y = 90 + ((n * 67) % 240);
  const c2x = portX - seite * (-130 + (j % 3) * 120), c2y = y + (n % 2 ? -160 : 150);
  const ohne = `M${SIE.x} ${SIE.y + 20} C${c1x} ${c1y} ${c2x} ${c2y} ${portX} ${y}`;
  return { i, seite, x, y, port: [portX, y], d, ohne };
});

/** Skaliert die Bühne (Entwurfsbreite W) auf die Breite des Rahmens: setzt --k (höchstens 1). */
function useBuehne(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const setzen = () => el.style.setProperty("--k", String(Math.min(1, (el.offsetWidth || W) / W)));
    setzen();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(setzen);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
}

/** Außer Sicht geladen → „Ohne“; kommt die Grafik ins Bild, nach `pause` ms EINMAL selbst → „Mit“. Danach der Schalter. */
function useOhneMit(ref: RefObject<HTMLElement | null>, pause = 450) {
  const [mit, setMit] = useState(true);
  const [selbst, setSelbst] = useState(false);
  const zeit = useRef(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || ruhigGewuenscht() || typeof IntersectionObserver === "undefined") return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.9 && r.bottom > 0) return;
    setMit(false); setSelbst(true);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      zeit.current = window.setTimeout(() => setMit(true), pause);
    }, { threshold: 0.3, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(zeit.current); };
  }, [ref, pause]);
  const waehle = (wert: boolean) => { window.clearTimeout(zeit.current); setSelbst(false); setMit(wert); };
  return { mit, selbst, waehle };
}

function Zeichen({ status }: { status: "fest" | "antrag" }) {
  return status === "fest" ? (
    <svg className="sn-zeichen fest" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" /><path d="M6 10.4l2.7 2.7L14.2 7.4" /></svg>
  ) : (
    <svg className="sn-zeichen antrag" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.2" /></svg>
  );
}

/** Ein Strichsymbol je Stelle (Reihenfolge wie sternKnoten). */
function Symbol({ i }: { i: number }) {
  const d = [
    "M4 20V9l8-5 8 5v11M9 20v-6h6v6M3 20h18", // Gründungsdienst
    "M4 8h16v11H4zM4 8l8 6 8-6M8 4h8", // Registered Agent (Post)
    "M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18", // US-Steuerbehörde
    "M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a2.8 2.8 0 0 0 5 0L5 8M19 8l-2.5 6a2.8 2.8 0 0 0 5 0L19 8", // Anwalt (Waage)
    "M6 3h12v18H6zM9 7h6M9 11h1M12 11h1M9 14h1M12 14h1M9 17h1M12 17h1M15 11v6", // Steuerberater (Rechner)
    "M7 3h10v18l-2.5-1.5L12 21l-2.5-1.5L7 21zM10 8h4M10 12h4", // US-CPA (Beleg)
    "M3 9l9-5 9 5H3M5 11v6M9.5 11v6M14.5 11v6M19 11v6M3 20h18", // Banken
    "M3 6h18v12H3zM3 10h18M7 15h4", // Kartenherausgeber
  ][i] ?? "M4 12h16";
  return <svg className="sn-symbol" viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
}

function Person() {
  return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="14.5" r="6.2" /><path d="M8.5 33c1.8-6.4 6.3-9.6 11.5-9.6S29.7 26.6 31.5 33" /></svg>;
}

export default function SternZentrale(p: {
  knoten: GlobalSternKnoten[];
  /** Die acht Zeilen des Zustands „Ohne“ (je Knoten eine). */
  ohne: string[];
  schalter: [string, string];
  mitte: string;
  sie: string;
  legende: [string, string];
  label: string;
  /** GLOBAL_INKLUSIVE[sprache] — der Satz je Stelle für die Erklärung. */
  inklusive: readonly string[];
  /** Begriffe, die in Namen und Umfang antippbar werden (Registered Agent, Operating Agreement, US-CPA). */
  begriffe: { wort: string; erklaerung: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const flaeche = useRef<HTMLDivElement>(null);
  useBuehne(flaeche);
  const { mit, selbst, waehle } = useOhneMit(ref);
  const erklaerung = (i: number) => {
    const k = p.knoten[i];
    const begriff = p.begriffe.find((b) => b.wort.toLowerCase() === k.name.toLowerCase())?.erklaerung;
    const satz = k.status === "fest" && k.inkl !== undefined ? p.inklusive[k.inkl] : p.legende[1];
    return [begriff, satz].filter(Boolean).join(" — ");
  };
  const inhalt = (i: number) => {
    const k = p.knoten[i];
    return (
      <>
        <span className="sn-karte-symbol"><Symbol i={i} /></span>
        <span className="sn-karte-text">
          <span className="mit-text">
            <b><Begriff wort={k.name} erklaerung={erklaerung(i)} /></b>
            {k.umfang ? <small>{mitBegriffen(k.umfang, p.begriffe)}</small> : <small>{p.legende[1]}</small>}
          </span>
          <span className="ohne-text">{p.ohne[i]}</span>
        </span>
        <span className="sn-karte-zeichen"><Zeichen status={k.status} /></span>
      </>
    );
  };

  return (
    <div ref={ref} className={`sn sn-z ${mit ? "mit" : "ohne"}${selbst ? " selbst" : ""}`}>
      <div className="fg-stern-schalter sn-schalter" role="group" aria-label={p.label}>
        <button type="button" aria-pressed={!mit} onClick={() => waehle(false)}>{p.schalter[0]}</button>
        <button type="button" aria-pressed={mit} onClick={() => waehle(true)}>{p.schalter[1]}</button>
      </div>

      {/* ── Desktop: die Platine ── */}
      <div ref={flaeche} className="sn-flaeche" style={{ ["--h" as string]: `${H}px` }} role="group" aria-label={p.label}>
        <div className="sn-buehne" style={{ width: W, height: H }}>
          <svg className="sn-leitungen" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
            <defs>
              <pattern id="snzPunkte" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="1.1" /></pattern>
              <radialGradient id="snzVerlauf" cx="50%" cy="53%" r="52%">
                <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset=".7" stopColor="#fff" stopOpacity=".35" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <mask id="snzMaske"><rect width={W} height={H} fill="url(#snzVerlauf)" /></mask>
            </defs>
            {/* Punktraster der Platine — läuft nach außen aus, gibt der Ordnung einen Grund */}
            <rect className="sn-raster" width={W} height={H} fill="url(#snzPunkte)" mask="url(#snzMaske)" />
            <g className="sn-ohne">
              {PLAETZE.map((pl, n) => <path key={n} d={pl.ohne} style={{ strokeDasharray: STRICH[n] }} />)}
            </g>
            <g className="sn-mit">
              <path className="sn-zur-mitte" d={`M${SIE.x} ${SIE.y + 22} L${HUB.x} ${HUB.y - HUB.r}`} pathLength={1} />
              {PLAETZE.map((pl, n) => (
                <g key={n} style={{ ["--n" as string]: n }}>
                  <path className="spur" d={pl.d} />
                  <path className="leitung" d={pl.d} pathLength={1} />
                  <path className="puls" d={pl.d} pathLength={1} />
                  <circle className="anschluss" cx={pl.port[0]} cy={pl.port[1]} r="4.5" />
                </g>
              ))}
            </g>
          </svg>

          <div className="sn-sie" style={{ left: SIE.x, top: SIE.y }}><i />{p.sie}</div>
          <div className="sn-zentrale" style={{ left: HUB.x, top: HUB.y, width: HUB.r * 2, height: HUB.r * 2 }} aria-hidden="true">
            <span className="halo" /><Person />
          </div>
          <div className="sn-zentrale-name" style={{ left: HUB.x, top: HUB.y + HUB.r + 18 }}>{p.mitte}</div>

          {PLAETZE.map((pl, n) => {
            const [sx, sy, sr] = SCHIEF[n];
            return (
              <div key={p.knoten[pl.i].name} className={`sn-karte ${p.knoten[pl.i].status}`}
                style={{ left: pl.x, top: pl.y - KARTE.h / 2, width: KARTE.w, height: KARTE.h, ["--n" as string]: n,
                  ["--sx" as string]: `${sx}px`, ["--sy" as string]: `${sy}px`, ["--sr" as string]: `${sr}deg` }}>
                {inhalt(pl.i)}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Handy: der Baum — Sie → Zentrale → eine Leiste zu allen acht Stellen ── */}
      <div className="sn-mobil" role="group" aria-label={p.label}>
        <span className="sn-m-sie"><i />{p.sie}</span>
        <span className="sn-m-zu" aria-hidden="true" />
        <div className="sn-m-kopf">
          <span className="sn-m-zentrale" aria-hidden="true"><span className="halo" /><Person /></span>
          <b>{p.mitte}</b>
        </div>
        <ul className="sn-m-liste">
          {PLAETZE.map((pl, n) => {
            const [sx, , sr] = SCHIEF[n];
            return (
              <li key={p.knoten[pl.i].name} className={`sn-karte sn-m-karte ${p.knoten[pl.i].status}`}
                style={{ ["--n" as string]: n, ["--sx" as string]: `${sx / 2}px`, ["--sr" as string]: `${sr / 2}deg` }}>
                {inhalt(pl.i)}
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="fg-stern-legende sn-legende">
        <li><Zeichen status="fest" />{p.legende[0]}</li>
        <li><Zeichen status="antrag" />{p.legende[1]}</li>
      </ul>
    </div>
  );
}
