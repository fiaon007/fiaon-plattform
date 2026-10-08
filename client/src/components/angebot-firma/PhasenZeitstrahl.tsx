// ═══════════════════════════════════════════════════════════════════════════
// DER ZEITSTRAHL „IHR WEG IN DIE WELT“ (E-301) — Etappen 0…6 aus seite.phasen
//
// Eine senkrechte Haarlinie; darüber zeichnet sich eine goldene Linie beim
// Scrollen (transform: scaleY, nur Compositor — kein Ruckeln), jede Etappe
// gleitet einmal ein, sobald sie ins Bild kommt, und ihr Knoten rastet golden
// ein, wenn die Linie ihn erreicht. Etappen mit Szenenbild (bild) stehen breit
// mit Bild daneben; der KI-Hinweis sitzt am Bild. Die Nummer ist hier
// Information (die Reihenfolge ist der Weg), darum steht sie am Knoten —
// Justin (07.10.2026): Navy-Ziffer, optisch exakt zentriert (Inter, tabular,
// line-height 1, Flex), auf Elfenbein im Goldring; erreicht = kräftiger Ring.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import type { FirmaPhase } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf, Bild, ruhig, useScrollFortschritt } from "./gemeinsam";

export default function PhasenZeitstrahl({ liste }: { liste: FirmaPhase[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const linie = useRef<HTMLSpanElement>(null);

  useScrollFortschritt(ref, (_p, r) => {
    const el = ref.current, l = linie.current;
    if (!el || !l) return;
    // Die Linie folgt der Fenstermitte: so weit, wie die Mitte des Fensters in die Liste hineinreicht.
    const mitte = window.innerHeight * 0.62;
    const anteil = ruhig() ? 1 : Math.min(1, Math.max(0, (mitte - r.top) / Math.max(1, r.height)));
    l.style.transform = `scaleY(${anteil.toFixed(4)})`;
    el.querySelectorAll<HTMLElement>("[data-knoten]").forEach((k) => {
      const kr = k.getBoundingClientRect();
      k.toggleAttribute("data-erreicht", ruhig() || kr.top + kr.height / 2 < mitte);
    });
  });

  return (
    <ol ref={ref} className="gaf-weg" data-fiaon="firma-zeitstrahl">
      <span className="gaf-weg-schiene" aria-hidden="true"><span ref={linie} className="gaf-weg-gold" /></span>
      {liste.map((ph) => (
        <Auf als="li" key={ph.nr} className={`gaf-etappe${ph.bild ? " mit-bild" : ""}`}>
          <span className="gaf-etappe-knoten" data-knoten aria-hidden="true"><span>{ph.nr}</span></span>
          <div className="gaf-etappe-inhalt">
            <div className="gaf-etappe-text">
              <p className="gaf-etappe-dauer">{ph.dauer}</p>
              <h3 className="gaf-etappe-titel">
                <span className="gaf-nur-leser">{ph.nr} · </span>{ph.titel}
                {ph.abzeichen && <span className="gaf-etappe-abzeichen">{ph.abzeichen}</span>}
              </h3>
              <p className="gaf-etappe-satz">{ph.text}</p>
            </div>
            {ph.bild && <Bild bild={ph.bild} className="gaf-etappe-bild" groessen="(max-width: 900px) 92vw, 520px" />}
          </div>
        </Auf>
      ))}
    </ol>
  );
}
