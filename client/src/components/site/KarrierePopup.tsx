// ═══════════════════════════════════════════════════════════════════════════
// KarrierePopup — „Wir stellen ein" (23.08.2026, Justin)
//
// Erscheint auf den öffentlichen Seiten (nicht im Antrag, nicht auf /karriere
// selbst, nicht in Kunden-/Mitarbeiterbereichen) einmal je Sitzung, nach einer
// kurzen Verweildauer. Glas, Nachtblau, wandernder CI-Rand, leichte 3D-Neigung
// zur Maus. Unten rechts am Rechner, als Bogen von unten am Handy. Ein Klick
// führt zur Karriereseite; „Später" schließt — und die Sitzung merkt es sich.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";

const ERLAUBT = ["/", "/was-ist-fiaon", "/privatkunden", "/business", "/plattform-konzept", "/bonitaet", "/bonitaet-service", "/team", "/partner", "/presse", "/investoren", "/datenraum"];
const KEY = "fiaon_karriere_popup";

export default function KarrierePopup() {
  const [auf, setAuf] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pfad = window.location.pathname.replace(/\/+$/, "") || "/";
    if (!ERLAUBT.includes(pfad)) return;
    try { if (sessionStorage.getItem(KEY)) return; } catch { /* egal */ }
    const t = window.setTimeout(() => setAuf(true), 7000);
    return () => window.clearTimeout(t);
  }, []);

  const schliessen = () => { setAuf(false); try { sessionStorage.setItem(KEY, "1"); } catch { /* egal */ } };
  const neigen = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`;
  };
  const gerade = () => { const el = ref.current; if (el) el.style.transform = ""; };

  if (!auf) return null;
  return (
    <div className="kp-wrap" role="dialog" aria-label="Wir stellen ein">
      <div ref={ref} className="kp-karte" onMouseMove={neigen} onMouseLeave={gerade}>
        <button type="button" className="kp-zu" onClick={schliessen} aria-label="Schließen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="kp-kugel" aria-hidden="true"><img src="/kino/kugel.jpg" alt="" decoding="async" /></div>
        <p className="kp-ueber">Wir stellen ein</p>
        <h3 className="kp-titel">Möchten Sie Teil des <span className="dk-verlauf">FIAON-Teams</span> werden?</h3>
        <p className="kp-text">Ein junges, schnell wachsendes Start-up – fest angestellt oder frei, remote in Deutschland, Österreich und der Schweiz. Sieben Bereiche suchen Verstärkung.</p>
        <div className="kp-knoepfe">
          <a href="/karriere" className="dk-knopf" onClick={schliessen}>Bereiche ansehen</a>
          <button type="button" className="dk-knopf still" onClick={schliessen}>Später</button>
        </div>
      </div>
    </div>
  );
}
