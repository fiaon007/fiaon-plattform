// ═══════════════════════════════════════════════════════════════════════════
// DER UMSATZRECHNER (E-301) — Umsatz wählen → Beteiligung pro Jahr
//
// Rechnet NUR Satz × max(0, Umsatz − Schwelle) — keine Annahmen über Margen,
// Kosten oder Wachstum. Alle Sätze kommen aus investition.rechner (Platzhalter
// {umsatz}, {beteiligung}, {schwelle}, {satz}, {cent}); die Oberfläche setzt nur
// die Zahlen ein (Tausenderpunkt wie im übrigen Angebot, ganze Euro).
//
// Gestaltung (Justin, 07.10.2026): oben groß die Beteiligung pro Jahr, darunter
// der Regler als feine Linie mit Gold-Füllung bis zum Griff, runder Griff mit
// 28 px Trefferfläche und Fokusring, der Wert als Pille über dem Griff, die
// Schwelle als Markierung auf der Skala, Beschriftung aus rechner.skala. Keine
// Optik des Browsers: Das native <input type="range"> bleibt (Tastatur, Vorleser),
// Spur und Füllung zeichnet die Seite, den Griff stylen ::-webkit-slider-thumb
// und ::-moz-range-thumb. Gefüllt wird bis zur MITTE des Griffs:
// 14 px + Anteil × (Breite − 28 px) — genau dort, wo der Browser den Griff setzt.
// ═══════════════════════════════════════════════════════════════════════════
import { useId, useLayoutEffect, useRef, useState } from "react";
import type { FirmaRechner } from "@shared/fiaon-global-angebot-firma-typen";
import { einsetzen } from "./gemeinsam";

const euro = (cents: number) => `${Math.round(cents / 100).toLocaleString("de-DE")} €`;
const GRIFF = 28;

export default function UmsatzRechner({ r }: { r: FirmaRechner }) {
  const id = useId();
  const [umsatz, setUmsatz] = useState(() => Math.min(r.maxCents, Math.max(r.minCents, r.startCents)));
  const spur = useRef<HTMLDivElement>(null);
  const pille = useRef<HTMLSpanElement>(null);
  const ueber = Math.max(0, umsatz - r.schwelleCents);
  const beteiligung = Math.round((ueber * r.satzProzent) / 100);
  const werte = { umsatz: euro(umsatz), beteiligung: euro(beteiligung), schwelle: euro(r.schwelleCents), satz: `${r.satzProzent} %`, cent: String(r.satzProzent) };
  const anteil = (c: number) => Math.min(1, Math.max(0, (c - r.minCents) / Math.max(1, r.maxCents - r.minCents)));
  const a = anteil(umsatz);
  const lage = (x: number) => `calc(${GRIFF / 2}px + ${x.toFixed(4)} * (100% - ${GRIFF}px))`;

  // Die Pille sitzt über dem Griff, bleibt aber ganz in der Spur (an den Enden nicht über den Rand).
  useLayoutEffect(() => {
    const setzen = () => {
      const s = spur.current, p = pille.current;
      if (!s || !p) return;
      const w = s.clientWidth, pw = p.offsetWidth;
      const x = GRIFF / 2 + a * (w - GRIFF);
      p.style.left = `${Math.min(w - pw / 2, Math.max(pw / 2, x))}px`;
    };
    setzen();
    window.addEventListener("resize", setzen);
    return () => window.removeEventListener("resize", setzen);
  }, [a, werte.umsatz]);

  return (
    <div className="gaf-rechner" data-fiaon="firma-rechner">
      <div className="gaf-rechner-kopf">
        <h3 className="gaf-h3">{r.titel}</h3>
        <p className="gaf-rechner-sub">{r.sub}</p>
      </div>
      <div className="gaf-rechner-ergebnis" aria-live="polite">
        <p className="gaf-rechner-titel">{r.zahlTitel}</p>
        <p className="gaf-rechner-zahl">{werte.beteiligung}</p>
        <p className="gaf-rechner-satz">{beteiligung > 0 ? einsetzen(r.zeileBeteiligung, werte) : einsetzen(r.zeileUnterSchwelle, werte)}</p>
      </div>
      <div className="gaf-regler" ref={spur}>
        <span className="gaf-regler-pille" ref={pille} aria-hidden="true">{werte.umsatz}</span>
        <div className="gaf-regler-bahn" aria-hidden="true">
          <span className="gaf-regler-linie" />
          <span className="gaf-regler-gold" style={{ width: lage(a) }} />
        </div>
        <input id={id} className="gaf-regler-feld" type="range" min={r.minCents} max={r.maxCents} step={r.schrittCents} value={umsatz}
          aria-label={r.zeileUmsatz} aria-valuetext={werte.umsatz} onChange={(e) => setUmsatz(Number(e.target.value))} />
        <ol className="gaf-regler-skala" aria-hidden="true">
          {r.skala.map((p, i) => (
            <li key={p.cents} className={[p.schwelle ? "schwelle" : "", i === r.skala.length - 1 ? "ende" : "", i === 1 && r.skala.length > 3 ? "eng" : ""].filter(Boolean).join(" ")}
              style={{ left: lage(anteil(p.cents)) }}>
              <span className="strich" />
              <span className="text">{p.text}{p.schwelle && <em>{r.schwelleText}</em>}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
