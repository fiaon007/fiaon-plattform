// ═══════════════════════════════════════════════════════════════════════════
// „IHRE INVESTITION“ (E-301) — vier Posten, jeder mit Was / Wann / Warum / Wie
//
// Helle Tafel (kein zweites Navy-Glas): oben die vier Beträge groß
// (6.900 € · 1.990 € · 10 % · 5 % — als Text aus den Daten), darunter je Posten
// die vier Fragen. Am Rechner stehen sie offen; am Handy klappt jeder Posten
// auf (Knopf mit aria-expanded) — die Beträge bleiben immer sichtbar.
// Die Wörter „Was / Wann / Warum / Wie“ sind Bedienbeschriftungen (FRAGEN).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import type { FirmaInvestPosten } from "@shared/fiaon-global-angebot-firma-typen";
import { Auf } from "./gemeinsam";

const FRAGEN: { k: "was" | "wann" | "warum" | "wie"; wort: string }[] = [
  { k: "was", wort: "Was" }, { k: "wann", wort: "Wann" }, { k: "warum", wort: "Warum" }, { k: "wie", wort: "Wie" },
];

export default function InvestitionsPosten({ posten }: { posten: FirmaInvestPosten[] }) {
  const [offen, setOffen] = useState<Record<string, boolean>>({});
  return (
    <ul className="gaf-posten" data-fiaon="firma-posten">
      {posten.map((p, i) => {
        const auf = !!offen[p.schluessel];
        return (
          <Auf als="li" key={p.schluessel} verz={i * 80} className={`gaf-posten-karte gaf-posten-${p.schluessel}${auf ? " auf" : ""}`}>
            <p className="gaf-posten-titel">{p.titel}</p>
            <p className="gaf-posten-betrag">{p.betrag}</p>
            <p className="gaf-posten-einheit">{p.einheit}</p>
            <button type="button" className="gaf-posten-knopf" aria-expanded={auf} aria-controls={`gaf-posten-${p.schluessel}`}
              onClick={() => setOffen((o) => ({ ...o, [p.schluessel]: !o[p.schluessel] }))}>
              <span>{FRAGEN.map((f) => f.wort).join(" · ")}</span><span className="gaf-plus" aria-hidden="true" />
            </button>
            <div className="gaf-posten-klapp" id={`gaf-posten-${p.schluessel}`}>
              <dl className="gaf-posten-fragen">
                {FRAGEN.map((f) => <div key={f.k}><dt>{f.wort}</dt><dd>{p[f.k]}</dd></div>)}
              </dl>
            </div>
          </Auf>
        );
      })}
    </ul>
  );
}
