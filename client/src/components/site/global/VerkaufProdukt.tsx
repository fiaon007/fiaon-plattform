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
//
// Feinschliff 13.11.2026 (Justin: „ein paar mehr Animationen“, clean): Die Zeilen des Verzeichnisses und die vier Schritte
// kommen JE FÜR SICH, sobald sie selbst ins Bild rücken (useKinderEinmalSichtbar) — am Handy, wo die Listen höher sind als
// das Bild, lief der Auftritt sonst ab, bevor man die unteren Zeilen sah. Was zugleich erscheint, staffelt sich (--d).
// Die Linie der Schritte zieht sich einmal, jede Nummer leuchtet kurz auf, wenn die Linie sie erreicht.
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur, verkaufPfad, type VerkaufSprache } from "@shared/fiaon-global-verkauf";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-verkauf.css";

/** Die Stufe eines Elements in einer Staffel (--i) — das Stylesheet rechnet daraus die Verzögerung. */
const stufe = (i: number): CSSProperties => ({ ["--i" as string]: String(i) });
const Pfeil = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/**
 * Wie useEinmalSichtbar, aber je Kind: Jedes Kind der Liste bekommt einmal data-an="1", sobald es selbst ins Bild kommt
 * (die Liste selbst mit dem ersten Kind). Kinder, die im selben Augenblick erscheinen, zählen über --d durch (0, 1, 2 …) —
 * daraus macht das Stylesheet die Staffel. Dieselben Sicherungen wie dort: ohne Beobachter und bei „weniger Bewegung“ steht
 * sofort das Endbild; wer per Tastatur hineinkommt oder druckt, sieht alles.
 */
function useKinderEinmalSichtbar(ref: RefObject<HTMLElement | null>, rand = "0px 0px -14% 0px") {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute("data-an") === "1") return;
    const kinder = Array.from(el.children);
    const alle = () => { el.setAttribute("data-an", "1"); for (const k of kinder) k.setAttribute("data-an", "1"); };
    if (ruhigGewuenscht() || typeof IntersectionObserver === "undefined") { alle(); return; }
    el.setAttribute("data-an", "0");
    for (const k of kinder) k.setAttribute("data-an", "0");
    const io = new IntersectionObserver((eintraege) => {
      let d = 0;
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).style.setProperty("--d", String(d++));
        e.target.setAttribute("data-an", "1");
        el.setAttribute("data-an", "1");
        io.unobserve(e.target);
      }
    }, { threshold: 0, rootMargin: rand });
    for (const k of kinder) io.observe(k);
    const sofort = () => { io.disconnect(); alle(); };
    el.addEventListener("focusin", sofort, { once: true });
    window.addEventListener("beforeprint", sofort);
    const druck = window.matchMedia?.("print");
    const perDruck = (e: MediaQueryListEvent) => { if (e.matches) sofort(); };
    druck?.addEventListener?.("change", perDruck);
    return () => { io.disconnect(); el.removeEventListener("focusin", sofort); window.removeEventListener("beforeprint", sofort); druck?.removeEventListener?.("change", perDruck); };
  }, [ref, rand]);
}

export function VerkaufProdukt({ sprache, onKonfigurator }: { sprache: VerkaufSprache; onKonfigurator: () => void }) {
  const T = VERKAUF_TEXTE[sprache].produkt;
  const ref = useRef<HTMLElement>(null);
  const liste = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -20% 0px");
  useKinderEinmalSichtbar(liste);
  const [offen, setOffen] = useState<number | null>(0);
  return (
    <section className="fg-sek vk-produkt" id="produkt" ref={ref} style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2">{T.h2a} <em>{T.h2b}</em></h2></div>
          <p className="fg-lead">{W(T.lead)}</p>
        </div>
        <div className="vk-produkt-raster">
          <ol className="vk-verzeichnis" ref={liste}>
            {T.bereiche.map((b, i) => {
              const auf = offen === i;
              return (
                <li key={b.nr} className={auf ? "auf" : ""}>
                  <button type="button" aria-expanded={auf} aria-controls={`vk-bereich-${i}`} onClick={() => setOffen(auf ? null : i)}>
                    <span className="vk-roemisch" aria-hidden="true">{b.nr}</span>
                    <span className="vk-bereich-text"><b>{b.titel}</b><span>{W(b.zeile)}</span></span>
                    <span className="vk-plus" aria-hidden="true"><i /></span>
                    <span className="vk-nur-sr">{auf ? T.weniger : T.mehr}</span>
                  </button>
                  <div className="vk-bereich-mehr" id={`vk-bereich-${i}`} role="region" aria-label={b.titel}>
                    <div><ul>{b.details.map((d) => <li key={d}>{W(d)}</li>)}</ul></div>
                  </div>
                </li>
              );
            })}
          </ol>
          <aside className="vk-urkunde" aria-label={T.name}>
            <div className="vk-urkunde-glanz" aria-hidden="true" />
            <p className="vk-urkunde-auge" style={stufe(0)}>{T.auge}</p>
            <p className="vk-urkunde-name" style={stufe(1)}>{W(T.name)}</p>
            <p className="vk-urkunde-label" style={stufe(2)}>{T.preisLabel}</p>
            <p className="vk-urkunde-preis" style={stufe(3)}>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</p>
            <p className="vk-urkunde-satz" style={stufe(4)}>{T.preisSatz}</p>
            <button type="button" className="fg-knopf" style={stufe(5)} onClick={onKonfigurator}>{T.knopf}<Pfeil /></button>
            <p className="vk-urkunde-fein" style={stufe(6)}>{W(T.preisFein)}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}

export function VerkaufAblauf({ sprache }: { sprache: VerkaufSprache }) {
  const T = VERKAUF_TEXTE[sprache].ablauf;
  const ref = useRef<HTMLElement>(null);
  const liste = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  useKinderEinmalSichtbar(liste, "0px 0px -18% 0px");
  return (
    <section className="fg-sek vk-ablauf" id="ablauf" ref={ref} style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2">{T.h2a} <em>{T.h2b}</em></h2></div>
          <p className="fg-lead">{W(T.lead)}</p>
        </div>
        <ol className="vk-schritte" ref={liste}>
          {T.schritte.map((s) => (
            <li key={s.nr}>
              <span className="vk-schritt-nr" aria-hidden="true">{s.nr}</span>
              <h3>{s.titel}</h3>
              <p>{W(s.text)}</p>
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
          <div className="vk-garantie-text">
            <span className="fg-auge" style={stufe(0)}>{T.auge}</span>
            <h2 className="fg-h2" style={stufe(1)}>{T.h2}</h2>
            <p className="fg-lead" style={stufe(2)}>{W(T.text)}</p>
            <p className="vk-garantie-fein" style={stufe(3)}>{W(T.fein)}</p>
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
