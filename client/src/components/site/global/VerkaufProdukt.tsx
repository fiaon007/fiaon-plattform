// ═══════════════════════════════════════════════════════════════════════════
// DAS EINE PRODUKT — „Ein Mandat. Alles darin.“ (Register E-509, 12.11.2026)
//
// Justin: „die US LLC Gründung mit aktiver Betreuung (volle Package, perfekt animiert anführen aber clean halten, sauber
// halten, platz lassen, Rechtsberatung rein, Steuerberatung — all das)“. Stil: „seriös, Kanzlei-Stil mit guten Animationen“.
//
// Vier Bausteine, alle lesen ihre Sätze aus shared/fiaon-global-verkauf.ts (jeder Satz steht so im Vertrag):
//   VerkaufProdukt   das Leistungsverzeichnis — acht Bereiche, römisch gezählt, an Haarlinien; ein Bereich klappt auf.
//                    Daneben die Urkunde mit dem einen Preis. Beim Hineinscrollen zeichnen sich die Linien, die Zeilen
//                    gleiten nacheinander hoch (einmal).
//   VerkaufAblauf    vier Schritte an einer Linie, die sich einmal zieht.
//   VerkaufGarantie  ein ruhiges Band mit der Geld-zurück-Garantie.
//   VerkaufKarte     die kompakte Karte „Ein Mandat“ für die Unterseiten (ersetzt dort die Paketkarten).
// Bei „weniger Bewegung“ und ohne JS steht alles sofort im Endbild (data-an fehlt dann oder ist „1“).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useState } from "react";
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur, verkaufPfad, type VerkaufSprache } from "@shared/fiaon-global-verkauf";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import "@/styles/global-verkauf.css";

const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function VerkaufProdukt({ sprache, onKonfigurator }: { sprache: VerkaufSprache; onKonfigurator: () => void }) {
  const T = VERKAUF_TEXTE[sprache].produkt;
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -20% 0px");
  const [offen, setOffen] = useState<number | null>(0);
  return (
    <section className="fg-sek vk-produkt" id="produkt" ref={ref} style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2">{T.h2a} <em>{T.h2b}</em></h2></div>
          <p className="fg-lead">{T.lead}</p>
        </div>
        <div className="vk-produkt-raster">
          <ol className="vk-verzeichnis">
            {T.bereiche.map((b, i) => {
              const auf = offen === i;
              return (
                <li key={b.nr} className={auf ? "auf" : ""} style={{ ["--i" as string]: String(i) }}>
                  <button type="button" aria-expanded={auf} aria-controls={`vk-bereich-${i}`} onClick={() => setOffen(auf ? null : i)}>
                    <span className="vk-roemisch" aria-hidden="true">{b.nr}</span>
                    <span className="vk-bereich-text"><b>{b.titel}</b><span>{b.zeile}</span></span>
                    <span className="vk-plus" aria-hidden="true" />
                    <span className="vk-nur-sr">{auf ? T.weniger : T.mehr}</span>
                  </button>
                  <div className="vk-bereich-mehr" id={`vk-bereich-${i}`} role="region" aria-label={b.titel}>
                    <ul>{b.details.map((d) => <li key={d}>{d}</li>)}</ul>
                  </div>
                </li>
              );
            })}
          </ol>
          <aside className="vk-urkunde" aria-label={T.name}>
            <div className="vk-urkunde-glanz" aria-hidden="true" />
            <p className="vk-urkunde-auge">{T.auge}</p>
            <p className="vk-urkunde-name">{T.name}</p>
            <p className="vk-urkunde-label">{T.preisLabel}</p>
            <p className="vk-urkunde-preis">{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</p>
            <p className="vk-urkunde-satz">{T.preisSatz}</p>
            <button type="button" className="fg-knopf" onClick={onKonfigurator}>{T.knopf}<Pfeil /></button>
            <p className="vk-urkunde-fein">{T.preisFein}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function VerkaufAblauf({ sprache }: { sprache: VerkaufSprache }) {
  const T = VERKAUF_TEXTE[sprache].ablauf;
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  return (
    <section className="fg-sek vk-ablauf" id="ablauf" ref={ref} style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2">{T.h2a} <em>{T.h2b}</em></h2></div>
          <p className="fg-lead">{T.lead}</p>
        </div>
        <ol className="vk-schritte">
          {T.schritte.map((s, i) => (
            <li key={s.nr} style={{ ["--i" as string]: String(i) }}>
              <span className="vk-schritt-nr" aria-hidden="true">{s.nr}</span>
              <h3>{s.titel}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function VerkaufGarantie({ sprache }: { sprache: VerkaufSprache }) {
  const T = VERKAUF_TEXTE[sprache].garantie;
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0.3);
  return (
    <section className="fg-sek vk-garantie" ref={ref}>
      <div className="fg-rahmen">
        <div className="vk-garantie-band">
          <svg className="vk-siegel" viewBox="0 0 96 96" width="96" height="96" aria-hidden="true">
            <circle cx="48" cy="48" r="44" className="aussen" />
            <circle cx="48" cy="48" r="35" className="innen" />
            <path d="M33 49.5l10.5 10.5L64 38" className="haken" />
          </svg>
          <div>
            <span className="fg-auge">{T.auge}</span>
            <h2 className="fg-h2">{T.h2}</h2>
            <p className="fg-lead">{T.text}</p>
            <p className="vk-garantie-fein">{T.fein}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Die kompakte Karte für die Unterseiten — überall dort, wo bis E-509 eine Paketkarte oder alle vier standen. */
export function VerkaufKarte({ sprache, ort = "karte" }: { sprache: VerkaufSprache; ort?: string }) {
  const T = VERKAUF_TEXTE[sprache].karte;
  return (
    <div className="vk-karte" data-ort={ort}>
      <div className="vk-karte-text">
        <span className="fg-auge">{T.auge}</span>
        <h3>{T.titel}</h3>
        <p>{T.zeile}</p>
        <ul>{T.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      <div className="vk-karte-preis">
        <span>{T.preisLabel}</span>
        <b>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</b>
        <a className="fg-knopf" href={verkaufPfad(sprache)}>{T.knopf}<Pfeil /></a>
        <small>{T.fein}</small>
      </div>
    </div>
  );
}
