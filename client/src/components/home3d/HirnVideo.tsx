// ═══════════════════════════════════════════════════════════════════════════
// HirnVideo — das KI-Hirn als Hologramm (22.08.2026)
//
// Das Hirn wird von Higgsfield gerendert (rotierend, pulsierend, auf reinem
// Schwarz) und hier als Video gezeigt. Mit `mix-blend-mode: screen` wird das
// Schwarz unsichtbar — das Hirn schwebt frei über der Nachtblau-Bühne.
// Dazu eine weiche Lichtaura und Staubpartikel, damit es im Raum steht.
// Reduzierte Bewegung: nur das Standbild.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

export default function HirnVideo({ className = "", groesse = "min(78vh, 760px)", ruhig = false }: { className?: string; groesse?: string; ruhig?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current; if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <div className={`hirn ${className}`} aria-hidden="true" style={{ opacity: ruhig ? 0.75 : 1 }}>
      <div className="hirn-aura" />
      <video ref={ref} className="hirn-video" src="/kino/hirn.mp4" poster="/kino/hirn.jpg" muted loop playsInline preload="metadata" style={{ width: groesse, height: groesse }} />
    </div>
  );
}
