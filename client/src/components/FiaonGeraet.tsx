import type { ReactNode } from "react";
import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DER GERÄTEKÖRPER — ein Telefon, kein Kasten
//
// Der Vorgesetzte will beim Klick auf den Telefonknopf am Rechner ein
// zentriertes, glaubwürdiges Gerät sehen, nicht ein Formular in einer Ecke.
//
// ── WARUM ALLES IN CSS UND SVG ─────────────────────────────────────────────
// Ein Bitmap-Mockup ist auf einem Retina-Bildschirm unscharf, lässt sich nicht
// einfärben und wiegt hundert Kilobyte. Der Körper hier besteht aus vier
// Schichten Farbe und Schatten — er ist scharf auf jeder Auflösung, trägt die
// CI-Farben und kostet nichts.
//
// ── DIE VIER SCHICHTEN, VON AUSSEN NACH INNEN ──────────────────────────────
//   1. TITANRAHMEN   ein Verlauf, der oben Licht fängt und unten abdunkelt.
//                    Genau das macht Metall: Es reflektiert die Lichtquelle,
//                    statt gleichmäßig hell zu sein.
//   2. KANTENLICHT   eine 1 px helle Linie innen am Rahmen. Ohne sie sieht
//                    der Rahmen wie ein flacher Rand aus, nicht wie eine
//                    abgerundete Kante.
//   3. DISPLAYBETT   fast schwarz, mit einem angedeuteten Schlagschatten nach
//                    innen. Ein Display sitzt VERTIEFT im Rahmen.
//   4. GLASREFLEX    ein sehr schwacher, diagonaler Streifen über allem.
//                    Er ist das Einzige, was aus einer dunklen Fläche „Glas"
//                    macht — und er darf nicht stärker sein als 6 %, sonst
//                    wird der Inhalt darunter unleserlich.
//
// ── AUF 380 PX GIBT ES KEINEN KÖRPER ───────────────────────────────────────
// Dort IST das Gerät das Gerät. Ein gezeichnetes Telefon im Telefon wäre
// albern und würde den nutzbaren Platz halbieren. Stattdessen ein
// Bottom-Sheet mit Wischgriff.
// ═══════════════════════════════════════════════════════════════════════════

export function FiaonGeraet({
  offen, onZu, children, titel,
}: {
  offen: boolean;
  onZu: () => void;
  /** Der Inhalt des Displays. Als `children`, damit der Aufruf lesbar bleibt. */
  children: ReactNode;
  /** Für Vorleseprogramme — das Gerät selbst trägt keinen sichtbaren Titel. */
  titel: string;
}) {
  const [schmal, setSchmal] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  const [zieht, setZieht] = useState(0);
  const [drin, setDrin] = useState(false);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth < 640);
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  // Der Eintritt braucht einen Rahmen später als das Einhängen, sonst
  // springt die Animation nicht an (der Browser sieht keinen Übergang, wenn
  // Start- und Zielzustand im selben Rahmen gesetzt werden).
  useEffect(() => {
    if (!offen) { setDrin(false); return; }
    const t = window.setTimeout(() => setDrin(true), 20);
    return () => window.clearTimeout(t);
  }, [offen]);

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") onZu(); };
    window.addEventListener("keydown", taste);
    // Die Seite darunter darf nicht mitrollen.
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", taste);
      document.body.style.overflow = vorher;
    };
  }, [offen, onZu]);

  if (!offen) return null;

  // ── 380 px: ein Blatt, kein Gerät ───────────────────────────────────────
  if (schmal) {
    return (
      <>
        <div className="fi-ger-schleier" onClick={onZu} aria-hidden="true" />
        <div className="fi-ger-blatt" role="dialog" aria-modal="true" aria-label={titel}
             data-drin={drin ? "1" : "0"}
             style={zieht ? { transform: `translateY(${zieht}px)`, transition: "none" } : undefined}
             onTouchStart={(e) => { (e.currentTarget as any)._start = e.touches[0].clientY; }}
             onTouchMove={(e) => {
               const s = (e.currentTarget as any)._start ?? 0;
               setZieht(Math.max(0, e.touches[0].clientY - s));
             }}
             onTouchEnd={() => {
               // 110 px sind die Schwelle. Darunter federt es zurück —
               // sonst schließt sich das Blatt bei jedem Scrollversuch.
               if (zieht > 110) onZu();
               setZieht(0);
             }}>
          <div className="fi-ger-griff" aria-hidden="true" />
          <div className="fi-ger-blatt-inhalt">{children}</div>
        </div>
        <style>{GERAET_CSS}</style>
      </>
    );
  }

  // ── Rechner: das Gerät, zentriert ───────────────────────────────────────
  return (
    <>
      <div className="fi-ger-schleier" onClick={onZu} aria-hidden="true" />
      <div className="fi-ger-buehne" onClick={onZu}>
        <div className="fi-ger-koerper" role="dialog" aria-modal="true" aria-label={titel}
             data-drin={drin ? "1" : "0"}
             onClick={(e) => e.stopPropagation()}>

          {/* Die Seitentasten — nur angedeutet, aber sie machen den
              Unterschied zwischen „Rechteck" und „Gerät". */}
          <span className="fi-ger-taste-stumm" aria-hidden="true" />
          <span className="fi-ger-taste-lauter" aria-hidden="true" />
          <span className="fi-ger-taste-leiser" aria-hidden="true" />
          <span className="fi-ger-taste-seite" aria-hidden="true" />

          <div className="fi-ger-display">
            {/* Die Aussparung oben. Sie sitzt ÜBER dem Inhalt und muss ihn
                nicht verdecken — deshalb hat der Inhalt oben Platz. */}
            <span className="fi-ger-insel" aria-hidden="true">
              <span className="fi-ger-linse" />
            </span>
            <div className="fi-ger-inhalt">{children}</div>
            {/* Der Reflex liegt über allem, nimmt aber keine Klicks. */}
            <span className="fi-ger-reflex" aria-hidden="true" />
          </div>
        </div>
      </div>
      <style>{GERAET_CSS}</style>
    </>
  );
}

const GERAET_CSS = `
/* ── Schleier ────────────────────────────────────────────────────────────── */
.fi-ger-schleier {
  position: fixed; inset: 0; z-index: 420;
  background: radial-gradient(1200px 800px at 50% 40%, rgba(7,17,41,.62), rgba(3,8,22,.82));
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  animation: fiGerAuf 320ms ease both;
}
@keyframes fiGerAuf { from { opacity: 0 } to { opacity: 1 } }

/* ── Bühne mit Tiefe ─────────────────────────────────────────────────────── */
.fi-ger-buehne {
  position: fixed; inset: 0; z-index: 421;
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  perspective: 1800px;
  perspective-origin: 50% 45%;
}

/* ── Der Körper: Titanrahmen ─────────────────────────────────────────────── */
.fi-ger-koerper {
  position: relative;
  width: 392px; height: 812px;
  max-height: calc(100vh - 48px);
  border-radius: 56px;
  padding: 12px;
  /* Der Rahmen: oben Licht, unten Schatten — so verhält sich Metall. */
  background:
    linear-gradient(158deg, #8e97a6 0%, #5c6575 18%, #3a4250 42%,
                    #2a3140 62%, #454d5c 84%, #1e2431 100%);
  box-shadow:
    /* Aussen: das Gerät liegt auf etwas. */
    0 60px 120px -30px rgba(3,8,22,.9),
    0 24px 50px -20px rgba(3,8,22,.7),
    /* Farbschein in der CI-Farbe — sehr schwach, gibt der Szene Ton. */
    0 0 120px -30px rgba(59,130,246,.35),
    /* Kantenlicht innen: macht aus dem Rand eine Kante. */
    inset 0 1.5px 0 rgba(255,255,255,.5),
    inset 0 -1.5px 0 rgba(0,0,0,.5),
    inset 1.5px 0 0 rgba(255,255,255,.14),
    inset -1.5px 0 0 rgba(0,0,0,.3);
  transform: translateZ(-180px) rotateX(9deg) scale(.94);
  opacity: 0;
  transition: transform 620ms cubic-bezier(.22,.68,0,1), opacity 380ms ease;
}
.fi-ger-koerper[data-drin="1"] { transform: none; opacity: 1; }

/* ── Seitentasten ────────────────────────────────────────────────────────── */
.fi-ger-koerper > span[class^="fi-ger-taste"] {
  position: absolute; border-radius: 3px;
  background: linear-gradient(90deg, #222936, #4a5262 40%, #2b323f);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.2), -1px 0 2px rgba(0,0,0,.4);
}
.fi-ger-taste-stumm  { left: -2.5px; top: 148px; width: 3.5px; height: 30px; }
.fi-ger-taste-lauter { left: -2.5px; top: 208px; width: 3.5px; height: 58px; }
.fi-ger-taste-leiser { left: -2.5px; top: 280px; width: 3.5px; height: 58px; }
.fi-ger-taste-seite  { right: -2.5px; top: 232px; width: 3.5px; height: 92px;
  background: linear-gradient(270deg, #222936, #4a5262 40%, #2b323f); }

/* ── Displaybett ─────────────────────────────────────────────────────────── */
.fi-ger-display {
  position: relative; width: 100%; height: 100%;
  border-radius: 45px; overflow: hidden;
  /* Dunkles CI-Navy, nicht Schwarz: Das Gerät gehört zu FIAON. */
  background: linear-gradient(178deg, #0d1c3f 0%, #0a1a3c 46%, #070f22 100%);
  box-shadow:
    inset 0 0 0 1px rgba(0,0,0,.7),
    inset 0 3px 14px rgba(0,0,0,.6);
}

/* Dynamic Island */
.fi-ger-insel {
  position: absolute; top: 11px; left: 50%; transform: translateX(-50%);
  width: 118px; height: 33px; border-radius: 999px; z-index: 6;
  background: #05080f;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,.05), 0 1px 3px rgba(0,0,0,.6);
  display: flex; align-items: center; justify-content: flex-end;
  padding-right: 11px;
}
.fi-ger-linse {
  width: 11px; height: 11px; border-radius: 999px;
  background: radial-gradient(circle at 34% 30%, #2b3a55 0%, #101827 55%, #05080f 100%);
  box-shadow: inset 0 0 0 .5px rgba(120,170,255,.28);
}

/* Der Inhalt beginnt UNTER der Insel. */
.fi-ger-inhalt {
  position: absolute; inset: 0;
  padding: 54px 18px 26px;
  overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  z-index: 2;
}
.fi-ger-inhalt::-webkit-scrollbar { width: 0; }

/* ── Glasreflex ──────────────────────────────────────────────────────────
   Sechs Prozent. Mehr ist ein Effekt, weniger ist unsichtbar. */
.fi-ger-reflex {
  position: absolute; inset: 0; z-index: 5; pointer-events: none;
  border-radius: 45px;
  background: linear-gradient(118deg,
    rgba(255,255,255,0) 22%,
    rgba(255,255,255,.06) 36%,
    rgba(255,255,255,.02) 46%,
    rgba(255,255,255,0) 58%);
}

/* ── 380 px: Bottom-Sheet ────────────────────────────────────────────────── */
.fi-ger-blatt {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 421;
  max-height: 92vh; display: flex; flex-direction: column;
  border-radius: 26px 26px 0 0;
  background: linear-gradient(178deg, #0d1c3f 0%, #0a1a3c 46%, #070f22 100%);
  box-shadow:
    0 -30px 70px -20px rgba(3,8,22,.9),
    inset 0 1px 0 rgba(255,255,255,.12);
  transform: translateY(100%);
  transition: transform 460ms cubic-bezier(.22,.68,0,1);
}
.fi-ger-blatt[data-drin="1"] { transform: none; }
.fi-ger-griff {
  width: 42px; height: 4px; border-radius: 999px; margin: 11px auto 4px;
  background: rgba(255,255,255,.26); flex-shrink: 0;
}
.fi-ger-blatt-inhalt {
  padding: 10px 18px 26px; overflow-y: auto; overscroll-behavior: contain;
}

@media (prefers-reduced-motion: reduce) {
  .fi-ger-koerper, .fi-ger-blatt, .fi-ger-schleier { transition: none !important; animation: none !important; }
  .fi-ger-koerper { transform: none; opacity: 1; }
  .fi-ger-blatt { transform: none; }
}
`;

// ═══════════════════════════════════════════════════════════════════════════
// DIE WÄHLTASTATUR
//
// Ziffern mit Buchstabenzeile, wie auf einem Telefon. Die Buchstaben sind
// nicht Nostalgie: Sie sind der Grund, warum die Tasten unterschiedlich
// aussehen und man sie blind findet.
// ═══════════════════════════════════════════════════════════════════════════

const TASTEN: [string, string][] = [
  ["1", ""], ["2", "ABC"], ["3", "DEF"],
  ["4", "GHI"], ["5", "JKL"], ["6", "MNO"],
  ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"],
  ["*", ""], ["0", "+"], ["#", ""],
];

export function FiaonTastatur({
  onZiffer, onLoeschen, klein = false,
}: {
  onZiffer: (z: string) => void;
  onLoeschen?: () => void;
  /** Im Gespräch kleiner — dort steht die Tastatur über der Statuszeile. */
  klein?: boolean;
}) {
  return (
    <div className={`fi-tast ${klein ? "fi-tast-klein" : ""}`}>
      {TASTEN.map(([z, b]) => (
        <button key={z} type="button" className="fi-tast-taste"
                onClick={() => {
                  onZiffer(z);
                  // Ein kurzes Rütteln, wo das Gerät es kann. Auf dem
                  // Rechner passiert nichts — kein Fehler, nur keine Wirkung.
                  if (navigator.vibrate) navigator.vibrate(8);
                }}
                aria-label={b ? `${z} ${b}` : z}>
          <span className="fi-tast-ziffer">{z === "0" ? "0" : z}</span>
          {b && <span className="fi-tast-buchstaben">{b}</span>}
        </button>
      ))}
      {onLoeschen && (
        <button type="button" className="fi-tast-weg" onClick={onLoeschen} aria-label="Letzte Ziffer löschen">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 5H9.5L3 12l6.5 7H20a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
            <path d="m12 9.5 5 5M17 9.5l-5 5" />
          </svg>
        </button>
      )}
      <style>{TASTATUR_CSS}</style>
    </div>
  );
}

const TASTATUR_CSS = `
.fi-tast {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 14px 20px; margin: 0 auto; max-width: 292px;
  position: relative;
}
.fi-tast-klein { gap: 9px 14px; max-width: 250px; }

.fi-tast-taste {
  position: relative;
  aspect-ratio: 1; border: 0; cursor: pointer; border-radius: 999px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1px; color: #eef3fb;
  /* Eine Taste hat oben Licht und unten Schatten — sonst ist es ein Kreis. */
  background: linear-gradient(178deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.075) 52%, rgba(255,255,255,.045) 100%);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.24),
    inset 0 0 0 .5px rgba(255,255,255,.08),
    0 6px 14px -8px rgba(0,0,0,.7);
  transition: background 120ms, box-shadow 140ms, transform 90ms;
}
.fi-tast-klein .fi-tast-taste { aspect-ratio: 1.28; }
.fi-tast-taste:hover { background: linear-gradient(178deg, rgba(255,255,255,.2), rgba(255,255,255,.1)); }
/* Beim Drücken SINKT die Taste ein und der Schatten darunter verschwindet.
   Das ist der ganze Unterschied zwischen „Fläche" und „Knopf". */
.fi-tast-taste:active {
  transform: scale(.94);
  background: rgba(255,255,255,.26);
  box-shadow: inset 0 2px 6px rgba(0,0,0,.5);
}
.fi-tast-ziffer {
  font-size: 27px; font-weight: 400; line-height: 1;
  letter-spacing: -.01em; font-variant-numeric: tabular-nums;
}
.fi-tast-klein .fi-tast-ziffer { font-size: 21px; }
.fi-tast-buchstaben {
  font-size: 9.5px; font-weight: 600; letter-spacing: .16em;
  color: rgba(191,214,247,.62); text-transform: uppercase;
}
.fi-tast-klein .fi-tast-buchstaben { display: none; }

.fi-tast-weg {
  position: absolute; right: -6px; bottom: 0;
  width: 46px; height: 46px; border: 0; cursor: pointer; border-radius: 999px;
  display: inline-flex; align-items: center; justify-content: center;
  background: none; color: rgba(191,214,247,.72);
  transition: color 140ms, transform 90ms;
}
.fi-tast-weg:hover { color: #eef3fb; }
.fi-tast-weg:active { transform: scale(.9); }

@media (prefers-reduced-motion: reduce) {
  .fi-tast-taste, .fi-tast-weg { transition: none !important; }
}
`;
