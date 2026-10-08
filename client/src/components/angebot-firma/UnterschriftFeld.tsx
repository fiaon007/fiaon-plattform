// ═══════════════════════════════════════════════════════════════════════════
// DIE UNTERSCHRIFT ZUR ANNAHME (E-301, Runde 2, Justin 08.10.2026, Punkt 11)
//
// Zwei Wege, einer ist Pflicht: mit Finger oder Maus ZEICHNEN (Canvas, „Neu“) —
// oder den Namen TIPPEN (Darstellung in Schreibschrift). Der Server prüft sie
// (server/lib/fiaon-global-angebot-firma.ts firmaUnterschriftPruefen: Tinte im
// Bild bzw. Nachname im getippten Namen) und speichert sie mit Zeit und IP; das
// Bild steht im Annahmevermerk des Vertrags-PDF.
// Gezeichnet wird auf durchsichtigem Grund in Navy (#1b3866); getippt setzt die
// Seite den Namen in „Mrs Saint Delafield“ auf ein eigenes Canvas und schickt das
// Bild mit (fürs PDF — maßgeblich bleibt der Name).
// Handy: Das Feld nimmt die volle Breite, touch-action: none (die Seite scrollt
// beim Zeichnen nicht mit), Pointer-Ereignisse für Finger, Stift und Maus.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import type { FirmaAnnahmeTexte, FirmaUnterschriftEingabe } from "@shared/fiaon-global-angebot-firma-typen";

const TINTE = "#1b3866";
const SCHRIFT = "Mrs Saint Delafield";
const SCHRIFT_HREF = "https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap";
type Punkt = [number, number, number];

export type UnterschriftStand = { da: boolean; eingabe: FirmaUnterschriftEingabe | null };

/** Den getippten Namen in Schreibschrift als PNG setzen (durchsichtiger Grund) — für das PDF. */
function namenBild(name: string): string | null {
  try {
    const c = document.createElement("canvas"); c.width = 900; c.height = 240;
    const x = c.getContext("2d"); if (!x) return null;
    let fs = 120;
    x.font = `${fs}px "${SCHRIFT}", cursive`;
    while (x.measureText(name).width > 840 && fs > 40) { fs -= 6; x.font = `${fs}px "${SCHRIFT}", cursive`; }
    x.fillStyle = TINTE; x.textBaseline = "alphabetic";
    x.fillText(name, 30, 170);
    return c.toDataURL("image/png");
  } catch { return null; }
}

export default function UnterschriftFeld({ t, fehlt, onAenderung, gesperrt = false }: {
  t: FirmaAnnahmeTexte["unterschrift"]; fehlt: boolean; onAenderung: (s: UnterschriftStand) => void; gesperrt?: boolean;
}) {
  const [art, setArt] = useState<"zeichnen" | "tippen">("zeichnen");
  const [name, setName] = useState("");
  const [hatTinte, setHatTinte] = useState(false);
  const feld = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const striche = useRef<Punkt[][]>([]);
  const strich = useRef<Punkt[] | null>(null);
  const masse = useRef({ w: 1, h: 1 });
  const dick = useRef(2.4);
  const zuletzt = useRef(0);
  const melden = useRef(onAenderung);
  melden.current = onAenderung;

  // Die Schreibschrift einmal nachladen (wie das Siegel der Sonderfreigabe).
  useEffect(() => {
    if (document.querySelector(`link[href="${SCHRIFT_HREF}"]`)) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = SCHRIFT_HREF; document.head.appendChild(l);
  }, []);

  const neuZeichnen = useCallback(() => {
    const c = cv.current?.getContext("2d"); if (!c) return;
    const { w, h } = masse.current;
    c.clearRect(0, 0, w, h);
    c.strokeStyle = TINTE; c.lineCap = "round"; c.lineJoin = "round";
    for (const s of striche.current) for (let j = 1; j < s.length; j++) {
      c.lineWidth = s[j][2]; c.beginPath(); c.moveTo(s[j - 1][0] * w, s[j - 1][1] * h); c.lineTo(s[j][0] * w, s[j][1] * h); c.stroke();
    }
  }, []);
  const groesse = useCallback(() => {
    const q = feld.current?.getBoundingClientRect(); const c = cv.current;
    if (!q || !c || q.width < 10) return;
    if (Math.round(q.width) === Math.round(masse.current.w) && Math.round(q.height) === Math.round(masse.current.h)) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    masse.current = { w: q.width, h: q.height };
    c.width = Math.round(q.width * dpr); c.height = Math.round(q.height * dpr);
    c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    neuZeichnen();
  }, [neuZeichnen]);
  useEffect(() => {
    if (art !== "zeichnen") return;
    masse.current = { w: 1, h: 1 };
    groesse();
    if (typeof ResizeObserver === "undefined" || !feld.current) return;
    const ro = new ResizeObserver(() => groesse()); ro.observe(feld.current);
    return () => ro.disconnect();
  }, [art, groesse]);

  const laenge = () => {
    const { w, h } = masse.current; let n = 0;
    for (const s of striche.current) for (let j = 1; j < s.length; j++) n += Math.hypot((s[j][0] - s[j - 1][0]) * w, (s[j][1] - s[j - 1][1]) * h);
    return n;
  };
  const zeichnungMelden = () => {
    const da = laenge() > 50;
    setHatTinte(striche.current.length > 0);
    let png: string | null = null;
    if (da) { try { png = cv.current?.toDataURL("image/png") ?? null; } catch { png = null; } }
    melden.current({ da: da && !!png, eingabe: da && png ? { art: "gezeichnet", png } : null });
  };

  const pos = (e: React.PointerEvent) => { const q = cv.current!.getBoundingClientRect(); return [e.clientX - q.left, e.clientY - q.top]; };
  const runter = (e: React.PointerEvent) => {
    if (gesperrt) return;
    e.preventDefault(); groesse();
    const [x, y] = pos(e);
    strich.current = [[x / masse.current.w, y / masse.current.h, dick.current]];
    striche.current.push(strich.current);
    zuletzt.current = performance.now();
    try { cv.current?.setPointerCapture(e.pointerId); } catch { /* egal */ }
    setHatTinte(true);
  };
  const ziehen = (e: React.PointerEvent) => {
    if (!strich.current) return;
    const [x, y] = pos(e); const n = performance.now();
    const l = strich.current[strich.current.length - 1];
    const lx = l[0] * masse.current.w, ly = l[1] * masse.current.h;
    const d = Math.hypot(x - lx, y - ly);
    if (d < 0.6) return;
    const v = d / Math.max(1, n - zuletzt.current);
    dick.current = dick.current * 0.7 + Math.max(1.3, 3.2 - v * 1.5) * 0.3;
    const c = cv.current!.getContext("2d")!;
    c.strokeStyle = TINTE; c.lineCap = "round"; c.lineWidth = dick.current;
    c.beginPath(); c.moveTo(lx, ly); c.lineTo(x, y); c.stroke();
    strich.current.push([x / masse.current.w, y / masse.current.h, dick.current]);
    zuletzt.current = n;
  };
  const hoch = () => { if (!strich.current) return; strich.current = null; zeichnungMelden(); };
  const leeren = () => { striche.current = []; neuZeichnen(); setHatTinte(false); melden.current({ da: false, eingabe: null }); };

  // Getippt: bei jeder Eingabe melden; das Bild erst, wenn die Schrift geladen ist.
  useEffect(() => {
    if (art !== "tippen") return;
    const n = name.replace(/\s+/g, " ").trim();
    if (n.length < 3) { melden.current({ da: false, eingabe: null }); return; }
    let aus = false;
    melden.current({ da: true, eingabe: { art: "getippt", name: n, png: null } });
    const fertig = () => { if (!aus) melden.current({ da: true, eingabe: { art: "getippt", name: n, png: namenBild(n) } }); };
    const f = document.fonts?.load?.(`80px "${SCHRIFT}"`);
    if (f) void f.then(fertig, fertig); else fertig();
    return () => { aus = true; };
  }, [art, name]);

  const wechseln = (neu: "zeichnen" | "tippen") => {
    if (neu === art) return;
    setArt(neu);
    if (neu === "zeichnen") { striche.current = []; setHatTinte(false); }
    melden.current({ da: false, eingabe: null });
  };

  return (
    <div className={`gaf-signatur${fehlt ? " fehlt" : ""}`} id="gaf-unterschrift" data-fiaon="firma-unterschrift">
      <h3 className="gaf-h3">{t.titel}</h3>
      <p className="gaf-signatur-sub">{t.sub}</p>
      <div className="gaf-signatur-wahl" role="tablist" aria-label={t.titel}>
        <button type="button" role="tab" aria-selected={art === "zeichnen"} className={art === "zeichnen" ? "an" : ""} onClick={() => wechseln("zeichnen")} disabled={gesperrt}>{t.zeichnen}</button>
        <button type="button" role="tab" aria-selected={art === "tippen"} className={art === "tippen" ? "an" : ""} onClick={() => wechseln("tippen")} disabled={gesperrt}>{t.tippen}</button>
      </div>
      {art === "zeichnen" ? (
        <div className="gaf-signatur-flaeche">
          <div className="gaf-signatur-feld" ref={feld}>
            <canvas ref={cv} onPointerDown={runter} onPointerMove={ziehen} onPointerUp={hoch} onPointerCancel={hoch} onPointerLeave={hoch}
              role="img" aria-label={t.platz} data-fiaon="firma-unterschrift-canvas" />
            <span className="gaf-signatur-linie" aria-hidden="true" />
            <span className="gaf-signatur-x" aria-hidden="true">×</span>
            {!hatTinte && <span className="gaf-signatur-platz" aria-hidden="true">{t.platz}</span>}
          </div>
          <button type="button" className="gaf-signatur-neu" onClick={leeren} disabled={gesperrt || !hatTinte}>{t.neu}</button>
        </div>
      ) : (
        <div className="gaf-signatur-tippen">
          <label htmlFor="gaf-unterschrift-name">{t.tippenFeld}</label>
          <input id="gaf-unterschrift-name" type="text" autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} disabled={gesperrt}
            aria-describedby="gaf-unterschrift-name-hinweis" data-fiaon="firma-unterschrift-name" />
          <p className="gaf-fein" id="gaf-unterschrift-name-hinweis">{t.tippenHinweis}</p>
          <div className="gaf-signatur-vorschau" aria-live="polite">
            <span className="gaf-signatur-vorschau-auge">{t.vorschau}</span>
            <span className="gaf-signatur-schrift">{name.trim() || " "}</span>
            <span className="gaf-signatur-linie" aria-hidden="true" />
          </div>
        </div>
      )}
      {fehlt && <p className="gaf-feld-hinweis" id="gaf-unterschrift-hinweis">{t.fehlt}</p>}
    </div>
  );
}
