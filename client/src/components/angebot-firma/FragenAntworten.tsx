// ═══════════════════════════════════════════════════════════════════════════
// FRAGEN & ANTWORTEN (E-301) — Akkordeon aus seite.fragen
// Weiches Aufklappen über grid-template-rows 0fr → 1fr (keine Höhe raten),
// mehrere dürfen offen sein; „weniger Bewegung“ klappt ohne Übergang.
// Runde 3 (Punkt 3): die ersten `sichtbar` Fragen stehen in der Liste, der Rest
// erscheint mit „Weitere Fragen“ (Knopf mit aria-expanded, dann dieselbe Liste).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { FirmaFrage } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf } from "./gemeinsam";

const WORTE = { weitere: "Weitere Fragen", weniger: "Weniger Fragen" };

export default function FragenAntworten({ liste, sichtbar = liste.length }: { liste: FirmaFrage[]; sichtbar?: number }) {
  const [offen, setOffen] = useState<Set<number>>(() => new Set());
  const [alle, setAlle] = useState(false);
  const rest = Math.max(0, liste.length - sichtbar);
  const umschalten = (i: number) => setOffen((o) => { const n = new Set(o); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  return (
    <Auf>
      <ul className="gaf-fragen" data-fiaon="firma-fragen">
        {liste.slice(0, alle ? liste.length : sichtbar).map((f, i) => {
          const auf = offen.has(i);
          return (
            <li key={f.frage} className={auf ? "auf" : undefined}>
              <button type="button" aria-expanded={auf} aria-controls={`gaf-frage-${i}`} onClick={() => umschalten(i)}>
                <span>{f.frage}</span><span className="gaf-plus" aria-hidden="true" />
              </button>
              <div className="gaf-klapp" id={`gaf-frage-${i}`} role="region" aria-label={f.frage}>
                <div>{f.antwort.map((a, j) => <p key={j}>{a}</p>)}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <button type="button" className="gaf-fragen-weitere" aria-expanded={alle} onClick={() => setAlle((a) => !a)}>
          <span>{alle ? WORTE.weniger : WORTE.weitere}</span><span className="gaf-plus" aria-hidden="true" />
        </button>
      )}
    </Auf>
  );
}
