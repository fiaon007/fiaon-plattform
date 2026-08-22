// ═══════════════════════════════════════════════════════════════════════════
// DIE 3D-BÜHNE — die Kamera ist der Scroll
//
// Gelernt aus scroll-world (github.com/oso95/scroll-world): Eine Seite, durch
// die man „fliegt", statt einer, die man liest. Dort mit vorgerenderten
// Videoclips; hier — ohne Guthaben für zwanzig Clips — mit echter CSS-
// Perspektive: Ebenen in verschiedenen Tiefen, die der Scroll relativ
// zueinander bewegt, und eine Karte, die der Maus folgt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";

export function useScroll(ref: React.RefObject<HTMLElement | null>) {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect(); const vh = window.innerHeight;
      setP(Math.max(-1, Math.min(1, (vh / 2 - (r.top + r.height / 2)) / vh)));
    }); };
    fn(); window.addEventListener("scroll", fn, { passive: true }); window.addEventListener("resize", fn);
    return () => { window.removeEventListener("scroll", fn); window.removeEventListener("resize", fn); cancelAnimationFrame(raf); };
  }, [ref]);
  return p;
}

/** Die Karte im Raum — Neigung zur Maus, Tiefe zum Scroll. */
export function Karte3D({ ziel = "25.000 €", name = "IHR NAME", tilt = true }: { ziel?: string; name?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div ref={ref} style={{ perspective: 1200 }}
         onMouseMove={(e) => { if (!tilt || ruhe || !ref.current) return; const b = ref.current.getBoundingClientRect(); setR({ x: ((e.clientY - b.top) / b.height - .5) * -14, y: ((e.clientX - b.left) / b.width - .5) * 16 }); }}
         onMouseLeave={() => setR({ x: 0, y: 0 })}>
      <div className="ws-karte3d" style={{ transform: `rotateX(${12 + r.x}deg) rotateY(${-10 + r.y}deg)` }}>
        <span className="chip" /><span className="wort">FIAON</span>
        <span className="ziel"><small>Ziel-Rahmen</small><b>{ziel}</b></span>
        <span className="nr">{name}</span>
      </div>
      <div className="ws-schatten" />
    </div>
  );
}

/** Eine Ebene in der Tiefe: bewegt sich mit dem Scroll, je nach Tiefe verschieden schnell. */
export function Ebene({ tiefe, scroll, children, style, className = "" }: { tiefe: number; scroll: number; children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`ws-ebene ${className}`} style={{ transform: `translate3d(0, ${scroll * tiefe * -120}px, ${tiefe * 80}px)`, ...style }}>{children}</div>
  );
}

/** Die Bühne: ein Container mit Perspektive, der seinen Scroll-Fortschritt an die Ebenen gibt. */
export function Buehne({ children, hoehe = 560, className = "" }: { children: (scroll: number) => ReactNode; hoehe?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const p = useScroll(ref);
  return <div ref={ref} className={`ws-buehne ${className}`} style={{ minHeight: hoehe }}>{children(p)}</div>;
}

/** Das Gerät mit der Plattform darin — eine Vorschau aus echten Bausteinen, kein Foto. */
export function Geraet({ scroll = 0 }: { scroll?: number }) {
  return (
    <div className="ws-geraet" style={{ transform: `rotateY(${-12 + scroll * 10}deg) rotateX(${4 - scroll * 4}deg)` }}>
      <span className="kerbe" />
      <div className="schirm">
        <div className="ws-ui">
          <div className="kopf"><span>FIAON</span><span style={{ fontSize: 10, fontWeight: 600, color: "var(--w-stumm)", letterSpacing: ".12em" }}>MEIN BEREICH</span></div>
          <div className="karte"><div style={{ fontWeight: 700, fontSize: 12 }}>Guten Tag, Justin.</div><div style={{ color: "var(--w-stumm)" }}>Ihr Fahrplan: Etappe 3 von 7</div><div className="balken" style={{ marginTop: 8 }}><i style={{ width: "43%" }} /></div></div>
          <div className="karte" style={{ textAlign: "center" }}><div style={{ fontSize: 10, letterSpacing: ".14em", color: "var(--w-stumm)", fontWeight: 700 }}>IHR WERT</div><div className="bogen" /><div className="zahl" style={{ fontWeight: 800, fontSize: 18, marginTop: -2 }}>64</div><div style={{ color: "var(--w-stumm)" }}>3 Einträge geprüft · 1 angreifbar</div></div>
          <div className="karte"><div style={{ fontWeight: 700 }}>Ihre Finanzen</div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span>Einnahmen</span><b className="zahl">2.640 €</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>Fixkosten</span><b className="zahl">1.415 €</b></div><div style={{ display: "flex", justifyContent: "space-between", color: "var(--w-gut)" }}><span>Spielraum</span><b className="zahl">+ 612 €</b></div></div>
          <div className="karte" style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#fff", border: 0 }}><div style={{ fontWeight: 700 }}>Nächster Schritt</div><div style={{ opacity: .85 }}>Löschantrag an die SCHUFA — vorbereitet, 1 Klick</div></div>
        </div>
      </div>
    </div>
  );
}
