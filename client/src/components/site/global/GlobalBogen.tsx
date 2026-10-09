// ═══════════════════════════════════════════════════════════════════════════
// „DER BOGEN“ — EUROPA · MIAMI · KAPITAL (09.10.2026)
//
// Justin wählte aus drei Hero-Entwürfen B für den Kopf und wollte C „Der Bogen“ zusätzlich „passend in einer
// Sektion“ — sie steht auf /business nach „Ein Ansprechpartner statt acht“. Ein Kinofenster: Punktkarte
// Europa–Atlantik–Florida in 3D, eigene Projektion auf Canvas (kein three.js auf der Seite). Der blaue Faden der
// Trailer zieht von Ihnen (DACH) nach Miami, dort erscheinen die vier Etappen, ein zweiter, hellerer Bogen führt
// zurück nach Europa: „Kapital auch in Europa einsetzbar“ (GLOBAL_KAPITAL_FREI, nie ohne „das Institut entscheidet“).
//
// Bewegung: Der Auftakt (≈ 5,5 s) startet EINMAL, wenn das Fenster ins Bild kommt (nie an die Scrollposition
// gekoppelt); danach wandern ruhige Lichtpunkte über beide Bögen — nur solange das Fenster sichtbar ist. Die Karte
// wird je Größe einmal vorgezeichnet; jedes Bild kopiert sie nur. Bei „weniger Bewegung“ steht sofort das Endbild.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { beobachteSichtbar, nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";
import { DACH, FLORIDA, KARTE_RAHMEN, ORTE, istLand, liegtIn, type Punkt } from "@/components/site/global/bogen-karte";
import type { GLOBAL_BUEHNE_WOERTER } from "@/i18n/global";
import "@/styles/global-buehne.css";

type V3 = [number, number, number];
const LAT0 = 40, LON0 = -35, KOS = Math.cos((LAT0 * Math.PI) / 180);
const welt = ([lon, lat]: Punkt): V3 => [(lon - LON0) * KOS, lat - LAT0, 0];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const kreuz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const klemmen = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const weichInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const ROEMISCH = ["I", "II", "III", "IV"] as const;

interface Kamera { F: number; zNah: number; zFern: number; p: (v: V3) => [number, number, number] | null }
/**
 * Kamera hinter Miami, seitlich versetzt und erhöht, Blick über den Atlantik nach Europa. Danach eingepasst: Brennweite
 * und Mitte so, dass Miami und „Sie“ an festen Stellen des Fensters stehen (unten links, oben rechts) — gleich, wie
 * breit das Fenster ist. Am Handy steht Miami höher; darunter liegen die Etappen als 2 × 2.
 */
function kamera(w: number, h: number): Kamera {
  const M = welt(ORTE.miami), S = welt(ORTE.sie);
  const mitte: V3 = [(M[0] + S[0]) / 2, (M[1] + S[1]) / 2, 0];
  const r0 = norm(sub(S, M));
  const quer: V3 = [r0[1], -r0[0], 0];
  const schmal = w < 440;
  const ziel = { mx: 0.18, my: schmal ? 0.62 : 0.8, sx: 0.76, sy: schmal ? 0.27 : 0.33 };
  const E: V3 = [mitte[0] - r0[0] * 82 + quer[0] * 36, mitte[1] - r0[1] * 82 + quer[1] * 36, 40];
  const T: V3 = [mitte[0] + r0[0] * 16, mitte[1] + r0[1] * 16, 6];
  const f = norm(sub(T, E));
  const r = norm(kreuz(f, [0, 0, 1]));
  const u = kreuz(r, f);
  const roh = (v: V3): V3 => { const d = sub(v, E); const z = dot(d, f); return [dot(d, r) / z, -dot(d, u) / z, z]; };
  const m = roh(M), s = roh(S);
  const zm = [ziel.mx * w, ziel.my * h], zs = [ziel.sx * w, ziel.sy * h];
  const F = Math.hypot(zs[0] - zm[0], zs[1] - zm[1]) / (Math.hypot(s[0] - m[0], s[1] - m[1]) || 1);
  const cx = (zm[0] + zs[0]) / 2 - (F * (m[0] + s[0])) / 2, cy = (zm[1] + zs[1]) / 2 - (F * (m[1] + s[1])) / 2;
  return {
    F, zNah: m[2], zFern: s[2],
    p: (v) => {
      const q = roh(v);
      if (q[2] < 2) return null;
      return [cx + q[0] * F, cy + q[1] * F, q[2]];
    },
  };
}

interface KartenPunkt { v: V3; art: 0 | 1 | 2 } // 0 Meer, 1 Land, 2 hervorgehoben (DACH, Florida)
let KARTEN_PUNKTE: KartenPunkt[] | null = null;
function kartenPunkte(): KartenPunkt[] {
  if (KARTEN_PUNKTE) return KARTEN_PUNKTE;
  const out: KartenPunkt[] = [];
  const S = 0.62;
  const x0 = (KARTE_RAHMEN.lonMin - LON0) * KOS, x1 = (KARTE_RAHMEN.lonMax - LON0) * KOS;
  const y0 = KARTE_RAHMEN.latMin - LAT0, y1 = KARTE_RAHMEN.latMax - LAT0;
  let reihe = 0;
  for (let y = y0; y <= y1; y += S, reihe++) {
    const versatz = reihe % 2 ? S / 2 : 0;
    for (let x = x0 + versatz; x <= x1; x += S) {
      const lon = x / KOS + LON0, lat = y + LAT0;
      if (istLand(lon, lat)) out.push({ v: [x, y, 0], art: liegtIn(lon, lat, DACH) || liegtIn(lon, lat, FLORIDA) ? 2 : 1 });
      else if (reihe % 2 === 0 && Math.round((x - x0) / S) % 2 === 0) out.push({ v: [x, y, 0], art: 0 });
    }
  }
  KARTEN_PUNKTE = out;
  return out;
}

/** Quadratischer Bogen im Raum von a nach b, Scheitel über der Mitte (hoch), seitlich versetzt (quer). */
function bogenPunkt(a: V3, b: V3, hoch: number, quer: number, t: number): V3 {
  const r0 = norm(sub(b, a));
  const q: V3 = [-r0[1], r0[0], 0];
  const c: V3 = [(a[0] + b[0]) / 2 + q[0] * quer, (a[1] + b[1]) / 2 + q[1] * quer, hoch];
  const s = 1 - t;
  return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1], s * s * a[2] + 2 * s * t * c[2] + t * t * b[2]];
}

/** Der Auftakt in ms ab Start: Sie leuchtet → Faden nach Miami → Etappen → Bogen zurück → Kapital. */
const ZEIT = { sie: 250, hin: [900, 2500] as const, miami: 2500, etappen: 2750, zurueck: [3900, 5500] as const, kapital: 5400 };
const HIN = { hoch: 30, quer: -4 }, ZURUECK = { hoch: 46, quer: 9 };

export default function GlobalBogen({ w, etappen }: {
  w: (typeof GLOBAL_BUEHNE_WOERTER)["de"];
  /** Die vier Etappen-Titel (GLOBAL_WOERTER[s].weg) — wortgleich mit der Wegleiste. */
  etappen: readonly string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const leinwand = useRef<HTMLCanvasElement>(null);
  const [lage, setLage] = useState<{ sie: [number, number]; miami: [number, number] } | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const el = ref.current, cv = leinwand.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const ruhig = ruhigGewuenscht() || typeof IntersectionObserver === "undefined";
    let breite = 0, hoehe = 0, dpr = 1, kam: Kamera | null = null;
    let grund: HTMLCanvasElement | null = null;
    const A = welt(ORTE.sie), B = welt(ORTE.miami);

    const aufbauen = () => {
      breite = el.offsetWidth; hoehe = el.offsetHeight;
      if (!breite || !hoehe) return;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(breite * dpr); cv.height = Math.round(hoehe * dpr);
      kam = kamera(breite, hoehe);
      // Die Karte einmal vorzeichnen — jedes Bild kopiert sie nur noch.
      grund = document.createElement("canvas");
      grund.width = cv.width; grund.height = cv.height;
      const g = grund.getContext("2d");
      if (!g) return;
      g.scale(dpr, dpr);
      for (const pk of kartenPunkte()) {
        const q = kam.p(pk.v);
        if (!q || q[0] < -10 || q[0] > breite + 10 || q[1] < -10 || q[1] > hoehe + 10) continue;
        const nebel = klemmen(1 - (q[2] - kam.zNah * 0.8) / ((kam.zFern - kam.zNah) * 2.4), 0.14, 1);
        const r = Math.max(0.45, (0.15 * kam.F) / q[2]);
        if (pk.art === 0) g.fillStyle = `rgba(120,170,240,${(0.1 * nebel).toFixed(3)})`;
        else if (pk.art === 1) g.fillStyle = `rgba(156,200,255,${(0.62 * nebel).toFixed(3)})`;
        else g.fillStyle = `rgba(222,238,255,${(0.95 * nebel).toFixed(3)})`;
        g.beginPath(); g.arc(q[0], q[1], pk.art === 0 ? r * 0.7 : pk.art === 2 ? r * 1.15 : r, 0, Math.PI * 2); g.fill();
      }
      const s = kam.p(A), m = kam.p(B);
      if (s && m) setLage({ sie: [s[0], s[1]], miami: [m[0], m[1]] });
    };

    const bogenZeichnen = (art: typeof HIN, bis: number, farbe: [number, number, number], staerke: number) => {
      if (!kam || bis <= 0) return null;
      const N = 90, pts: [number, number][] = [], schatten: [number, number][] = [];
      for (let i = 0; i <= N * bis; i++) {
        const t = Math.min(bis, i / N);
        const v = art === HIN ? bogenPunkt(A, B, art.hoch, art.quer, t) : bogenPunkt(B, A, art.hoch, art.quer, t);
        const q = kam.p(v), qs = kam.p([v[0], v[1], 0]);
        if (q) pts.push([q[0], q[1]]);
        if (qs) schatten.push([qs[0], qs[1]]);
      }
      if (pts.length < 2) return null;
      const linie = (p: [number, number][]) => { ctx.beginPath(); p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
      const [r, g, b] = farbe;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      // Schatten auf der Karte — gibt dem Bogen seine Höhe.
      ctx.setLineDash([2, 5]); ctx.strokeStyle = `rgba(${r},${g},${b},.22)`; ctx.lineWidth = 1; linie(schatten); ctx.setLineDash([]);
      ctx.strokeStyle = `rgba(${r},${g},${b},.12)`; ctx.lineWidth = 9 * staerke; linie(pts);
      ctx.strokeStyle = `rgba(${r},${g},${b},.35)`; ctx.lineWidth = 3.6 * staerke; linie(pts);
      ctx.strokeStyle = `rgba(${Math.min(255, r + 70)},${Math.min(255, g + 50)},255,.95)`; ctx.lineWidth = 1.4 * staerke; linie(pts);
      return pts;
    };
    const glimmen = (x: number, y: number, r: number, a: number) => {
      if (r <= 0 || a <= 0) return;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.25, `rgba(156,200,255,${a * 0.75})`); gr.addColorStop(1, "rgba(40,141,250,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    const bodenRing = (o: V3, rad: number, a: number) => {
      if (!kam || a <= 0) return;
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const w0 = (i / 48) * Math.PI * 2;
        const q = kam.p([o[0] + Math.cos(w0) * rad, o[1] + Math.sin(w0) * rad, 0]);
        if (!q) return;
        if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
      }
      ctx.strokeStyle = `rgba(156,200,255,${a})`; ctx.lineWidth = 1.2; ctx.stroke();
    };

    let t0 = 0, raf = 0, sichtbar = false, gestartet = false, letztePhase = -1;
    const zeichnen = (jetzt: number) => {
      if (!kam || !grund) return;
      const t = ruhig ? 1e6 : gestartet ? jetzt - t0 : -1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.drawImage(grund, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ph = t >= ZEIT.kapital ? 6 : t >= ZEIT.zurueck[0] ? 5 : t >= ZEIT.etappen ? 4 : t >= ZEIT.miami ? 3 : t >= ZEIT.hin[0] ? 2 : t >= ZEIT.sie ? 1 : 0;
      if (ph !== letztePhase) { letztePhase = ph; setPhase(ph); }
      if (t < 0) return;
      const hin = weichInOut(klemmen((t - ZEIT.hin[0]) / (ZEIT.hin[1] - ZEIT.hin[0])));
      const zur = weichInOut(klemmen((t - ZEIT.zurueck[0]) / (ZEIT.zurueck[1] - ZEIT.zurueck[0])));
      // Ruhige Pulse an beiden Enden — nach dem Auftakt alle 4,2 s (bei „weniger Bewegung“ keine).
      const puls = (seit: number) => (ruhig || seit < 0 ? -1 : (seit % 4200) / 4200);
      const s = kam.p(A), m = kam.p(B);
      const ps = puls(t - ZEIT.sie), pm = puls(t - ZEIT.miami);
      if (ps >= 0) bodenRing(A, 1 + ps * 7, 0.55 * (1 - ps));
      if (pm >= 0) bodenRing(B, 1 + pm * 7, 0.55 * (1 - pm));
      const hinPts = bogenZeichnen(HIN, hin, [40, 141, 250], 1);
      const zurPts = bogenZeichnen(ZURUECK, zur, [150, 200, 255], 1.15);
      if (s && t >= ZEIT.sie) glimmen(s[0], s[1], 16, 0.9);
      if (m && t >= ZEIT.miami) glimmen(m[0], m[1], 20 + Math.max(0, 1 - (t - ZEIT.miami) / 600) * 26, 0.95);
      // Kometen an der Spitze, solange gezeichnet wird; danach wandern Lichtpunkte über beide Bögen.
      if (hinPts && hin < 1) { const [x, y] = hinPts[hinPts.length - 1]; glimmen(x, y, 15, 1); }
      if (zurPts && zur < 1) { const [x, y] = zurPts[zurPts.length - 1]; glimmen(x, y, 19, 1); }
      if (zur >= 1 && !ruhig) {
        const lauf = (art: typeof HIN, von: V3, nach: V3, n: number, dauer: number, groesse: number) => {
          for (let k = 0; k < n; k++) {
            const u = ((t / dauer) + k / n) % 1;
            const q = kam?.p(bogenPunkt(von, nach, art.hoch, art.quer, u));
            if (q) glimmen(q[0], q[1], groesse, Math.sin(Math.PI * u) * 0.85);
          }
        };
        lauf(HIN, A, B, 3, 5200, 6);
        lauf(ZURUECK, B, A, 3, 6400, 7.5);
      }
    };
    const schleife = (jetzt: number) => {
      zeichnen(jetzt);
      raf = sichtbar && gestartet && !ruhig ? requestAnimationFrame(schleife) : 0;
    };
    aufbauen();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { aufbauen(); zeichnen(performance.now()); });
    ro?.observe(el);
    if (ruhig) { zeichnen(0); return () => ro?.disconnect(); }
    zeichnen(performance.now()); // Die Karte steht schon, bevor der Faden losläuft.

    // Start EINMAL, wenn 35 % des Fensters im Bild sind — und erst nach dem Ladebildschirm.
    let los = () => {};
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      los = nachLadebild(() => { gestartet = true; t0 = performance.now(); if (!raf && sichtbar) raf = requestAnimationFrame(schleife); });
    }, { threshold: 0.35, rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    // Danach läuft die Schleife nur, solange das Fenster sichtbar ist (und der Tab vorn).
    const weg = beobachteSichtbar(el, (an) => {
      sichtbar = an;
      if (an && gestartet && !raf) raf = requestAnimationFrame(schleife);
    });
    return () => { ro?.disconnect(); io.disconnect(); weg(); los(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={ref} className="hb hb-c" data-phase={phase} role="img" aria-label={w.bogenLabel}>
      <canvas ref={leinwand} className="hb-c-leinwand" aria-hidden="true" />
      <div className="hb-c-nebel" aria-hidden="true" />
      {lage && (
        <>
          <div className="hb-c-sie" aria-hidden="true" style={{ top: lage.sie[1] + 18 }}>
            <span data-an={phase >= 1 ? "1" : "0"}><b>{w.bogenSie}</b><small>{w.bogenSieZeile}</small></span>
            <span className="kapital" data-an={phase >= 6 ? "1" : "0"}><b>{w.bogenKapital}</b><small>{w.bogenKapitalZeile}</small></span>
          </div>
          <div className="hb-c-ort miami" aria-hidden="true" data-an={phase >= 3 ? "1" : "0"} style={{ left: lage.miami[0], top: lage.miami[1] }}>
            <span><b>{w.bogenMiami}</b><small>{w.bogenMiamiZeile}</small></span>
          </div>
        </>
      )}
      <ol className="hb-c-etappen" aria-hidden="true" data-an={phase >= 4 ? "1" : "0"}>
        {etappen.map((e, i) => (
          <li key={e} style={{ ["--i" as string]: i }}><i>{ROEMISCH[i]}</i><span className="lang">{e}</span><span className="kurz">{w.bogenEtappenKurz[i]}</span></li>
        ))}
      </ol>
    </div>
  );
}
