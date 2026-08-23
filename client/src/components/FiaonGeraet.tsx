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
// ── AUF DEM HANDY GIBT ES KEINEN KÖRPER ────────────────────────────────────
// Dort IST das Gerät das Gerät. Ein gezeichnetes Telefon im Telefon wäre
// albern und würde den nutzbaren Platz halbieren.
//
// ── VOM BLATT ZUR VOLLBILD-EBENE (23.08.2026) ──────────────────────────────
// Der Vorgesetzte: „Am Handy ist es eine Katastrophe zu bedienen — man muss
// darin scrollen. Es darf am Handy nicht zu scrollen sein im Phone, da
// verklickt man sich immer." Das Blatt (92vh, rollender Inhalt) ist deshalb
// eine Vollbild-Ebene geworden: 100dvh, safe-area-insets, der Inhalt eine
// Spalte mit festen Zonen. Was nicht auf einen Bildschirm passt, wird im
// Softphone eine EIGENE Vollbild-Ansicht (Tastatur, Notiz, Offene) — nicht
// Scrollstrecke.
//
// Der Wischgriff bleibt, aber er zieht nur noch am KOPFSTREIFEN: Vorher lag
// der Zieh-Anfasser auf dem ganzen Blatt, und jede Berührung im Inhalt
// (Tastendruck mit minimalem Wischen) verschob das Telefon unter dem Daumen —
// genau das „Verklicken" aus der Meldung.
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
  // 700 statt 640: Die Bauvorgabe fürs Office setzt die Handy-Grenze bei
  // 700 px — dieselbe Grenze wie im Softphone (dort entscheidet sie, welche
  // Dinge eine eigene Vollbild-Ansicht bekommen). Zwei verschiedene Grenzen
  // hießen: ein Fenster zwischen 640 und 700 bekäme den Gerätekörper UND die
  // Handy-Bedienung — halb Gerät, halb Blatt.
  const [schmal, setSchmal] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= 700,
  );
  const [zieht, setZieht] = useState(0);
  const [drin, setDrin] = useState(false);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth <= 700);
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

  // ── Handy: eine Vollbild-Ebene, kein Gerät ──────────────────────────────
  if (schmal) {
    return (
      <>
        <div className="fi-ger-schleier" onClick={onZu} aria-hidden="true" />
        <div className="fi-ger-blatt" role="dialog" aria-modal="true" aria-label={titel}
             data-drin={drin ? "1" : "0"}
             style={zieht ? { transform: `translateY(${zieht}px)`, transition: "none" } : undefined}>
          {/* Der Zieh-Anfasser liegt NUR auf dem Kopfstreifen. Vorher lag er
              auf der ganzen Ebene — jeder Tastendruck mit minimalem Wischen
              verschob das Telefon unter dem Daumen. */}
          <div className="fi-ger-kopfgriff"
               onTouchStart={(e) => { (e.currentTarget as any)._start = e.touches[0].clientY; }}
               onTouchMove={(e) => {
                 const s = (e.currentTarget as any)._start ?? 0;
                 setZieht(Math.max(0, e.touches[0].clientY - s));
               }}
               onTouchEnd={() => {
                 // 110 px sind die Schwelle. Darunter federt es zurück —
                 // sonst schließt sich die Ebene bei jedem Wischversuch.
                 if (zieht > 110) onZu();
                 setZieht(0);
               }}>
            <div className="fi-ger-griff" aria-hidden="true" />
          </div>
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
  /* ── WÄHREND EINES GESPRÄCHS AUS ────────────────────────────────────────
     Rückmeldung eines Agenten (iPhone 15 Pro Max): „Die Oberfläche reagiert
     zeitversetzt, Buttons hängen kurz, und während des Telefonats habe ich
     immer wieder ein starkes Klackern, fast wie bei Netzproblemen. Am Laptop
     läuft es einwandfrei."

     Es liegt nicht am Gerät. Die Weichzeichnung auf einer bildschirmfüllenden
     Fläche zwingt Safari, bei JEDEM Bild den gesamten Hintergrund neu zu
     zeichnen — auf einem Telefon mit 460 dpi sind das über zwei Millionen
     Bildpunkte, sechzigmal je Sekunde. Solange nur eine Seite dasteht, fällt
     das nicht auf. Läuft daneben WebRTC, konkurrieren Zeichnen und
     Audio-Verarbeitung um dieselbe Zeit — und die Audio-Puffer laufen leer.
     Das hört man als Klackern.

     Deshalb: Sobald ein Ruf aufgebaut wird, geht die Weichzeichnung aus. Eine
     matte Fläche sieht ein wenig schlichter aus; ein knackendes Gespräch
     kostet einen Kunden.

     ── KEIN ÜBERGANG AUF DEM FILTER (24.08.2026) ──────────────────────────
     Hier stand `transition: backdrop-filter 200ms, background 200ms`. Eine
     ANIMIERTE Weichzeichnung über den ganzen Bildschirm ist das Teuerste,
     was CSS zu vergeben hat — beim Umschalten in den Sparmodus zeichnete der
     Browser 200 ms lang Zwischenstufen des Blurs. Der Wechsel ist jetzt
     hart; das sieht niemand, aber jeder spürt es. */
  animation: fiGerAuf 200ms ease both;
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
  /* 24.08.2026: 620/380 ms → 200 ms. Justin: „die Bedienung ist zäh." Der
     Auftritt aus der Tiefe bleibt (transform/opacity, einmalig) — er dauert
     nur nicht mehr länger als ein Wimpernschlag. */
  transition: transform 200ms cubic-bezier(.22,.68,0,1), opacity 200ms ease;
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

/* ── Handy: Vollbild-Ebene ─────────────────────────────────────────────────
   100dvh statt 92vh, safe-area-insets, KEINE Scrollstrecke als Normalfall:
   Der Inhalt ist eine Spalte mit festen Zonen (das Softphone pinnt seine
   Bedienleiste mit margin-top:auto nach unten). overflow-y:auto bleibt als
   Sicherheitsnetz für sehr kleine Fenster — im Regelfall (375×667 aufwärts)
   passt jede Ansicht auf einen Bildschirm. */
.fi-ger-blatt {
  position: fixed; inset: 0; z-index: 421;
  height: 100dvh; max-height: 100dvh;
  display: flex; flex-direction: column;
  border-radius: 0;
  padding-top: env(safe-area-inset-top, 0px);
  background: linear-gradient(178deg, #0d1c3f 0%, #0a1a3c 46%, #070f22 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
  transform: translateY(100%);
  transition: transform 460ms cubic-bezier(.22,.68,0,1);
}
.fi-ger-blatt[data-drin="1"] { transform: none; }
/* Der Kopfstreifen ist der einzige Zieh-Anfasser — 28 px hoch, damit der
   Daumen ihn trifft, ohne dass er Inhalt kostet. */
.fi-ger-kopfgriff { flex-shrink: 0; padding: 8px 0 5px; touch-action: none; }
.fi-ger-griff {
  width: 42px; height: 4px; border-radius: 999px; margin: 0 auto;
  background: rgba(255,255,255,.26); flex-shrink: 0;
}
.fi-ger-blatt-inhalt {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column;
  padding: 4px 16px calc(14px + env(safe-area-inset-bottom, 0px));
  overflow-y: auto; overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
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
/* ── ENGER AUF DEM RECHNER (24.08.2026, Plan §4/§11) ───────────────────────
   VORHER: Kreise mit aspect-ratio 1 in einem 292-px-Raster — vier Reihen
   waren zusammen rund 380 px hoch, und die Wählansicht wuchs am PC über die
   Panelhöhe („am PC muss/kann ich darin scrollen"). NACHHER: flache Pillen
   mit fester Höhe 54 px — vier Reihen sind ~243 px, die Ansicht passt bei
   900 px Fensterhöhe ohne Rollen. Beschriftung, Reihenfolge, Rütteln und
   das Einsinken beim Drücken sind unverändert; das Handy (≤ 700 px) hatte
   seine flachen Tasten schon und behält sie über den Media-Block unten. */
.fi-tast {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 9px 16px; margin: 0 auto; max-width: 286px;
  position: relative;
}
.fi-tast-klein { gap: 8px 12px; max-width: 250px; }

.fi-tast-taste {
  position: relative;
  height: 54px; border: 0; cursor: pointer; border-radius: 999px;
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
.fi-tast-klein .fi-tast-taste { height: 44px; }
.fi-tast-taste:hover { background: linear-gradient(178deg, rgba(255,255,255,.2), rgba(255,255,255,.1)); }
/* Beim Drücken SINKT die Taste ein und der Schatten darunter verschwindet.
   Das ist der ganze Unterschied zwischen „Fläche" und „Knopf". */
.fi-tast-taste:active {
  transform: scale(.94);
  background: rgba(255,255,255,.26);
  box-shadow: inset 0 2px 6px rgba(0,0,0,.5);
}
.fi-tast-ziffer {
  font-size: 23px; font-weight: 400; line-height: 1;
  letter-spacing: -.01em; font-variant-numeric: tabular-nums;
}
.fi-tast-klein .fi-tast-ziffer { font-size: 20px; }
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

/* ── Handy (23.08.2026): breite Tasten statt Kreise ────────────────────────
   Kreise mit aspect-ratio 1 wurden auf 375 px zu einer 378-px-Säule — der
   Hauptgrund, warum im Telefon gescrollt werden musste. Breite, flache
   Tasten (mindestens 48 px, höchstens 62 px, dazwischen an der
   Bildschirmhöhe orientiert) halten die ganze Wählansicht auf einem
   Bildschirm — auch auf einem iPhone SE (375×667). */
@media (max-width: 700px) {
  .fi-tast { max-width: none; gap: 8px 10px; }
  .fi-tast-taste {
    aspect-ratio: auto;
    height: clamp(48px, 8dvh, 62px);
    border-radius: 16px;
    flex-direction: row; gap: 7px; align-items: baseline;
  }
  .fi-tast-ziffer { font-size: 23px; }
  .fi-tast-buchstaben { font-size: 8.5px; }
}
@media (max-width: 700px) and (max-height: 620px) {
  .fi-tast { gap: 6px 8px; }
  .fi-tast-taste { height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .fi-tast-taste, .fi-tast-weg { transition: none !important; }
}
`;


/* ═══════════════════════════════════════════════════════════════════════════
   SPARMODUS WÄHREND EINES GESPRÄCHS

   Gesetzt wird `data-gespraech="1"` am <body>, sobald ein Ruf aufgebaut wird
   (siehe Softphone.tsx). Drei Dinge fallen dann weg:

     1. Die Weichzeichnung des Schleiers — der teuerste Effekt überhaupt.
     2. Jede Dauer-Animation — sie hält den Compositor wach.
     3. Die Übergänge — sie erzeugen bei jeder Zustandsänderung neue Bilder.

   Alles drei ist auf einem Rechner unmerklich und auf einem Telefon der
   Unterschied zwischen einem sauberen und einem knackenden Gespräch.
   ═══════════════════════════════════════════════════════════════════════════ */
export const GERAET_SPARMODUS_CSS = `
body[data-gespraech="1"] .fi-ger-schleier {
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  background: rgba(7, 12, 24, .84) !important;
}
body[data-gespraech="1"] .fi-ger-koerper,
body[data-gespraech="1"] .fi-ger-buehne { transition: none !important; }
body[data-gespraech="1"] *[style*="animation"],
body[data-gespraech="1"] .fi-tel-punkt { animation: none !important; }

/* Auf schmalen Geräten generell weniger: Auch ohne laufendes Gespräch ist ein
   14-px-Blur auf einem Telefonbildschirm teurer, als er aussieht. */
@media (max-width: 640px) {
  .fi-ger-schleier {
    backdrop-filter: blur(6px) saturate(110%);
    -webkit-backdrop-filter: blur(6px) saturate(110%);
  }
}
`;
