// ═══════════════════════════════════════════════════════════════════════════
// „IHR KAPITAL“ (E-301) — die erste Runde, die Garantie, die Bürgschaft
//
// Der Betrag steht groß in Gold und zählt beim Hineinscrollen einmal hoch
// (bei „weniger Bewegung“ steht er sofort). Die Garantie-Sätze kommen
// AUSSCHLIESSLICH aus kapital.garantie (eine Quelle: firmaGarantie() im Server,
// Prüfstand) — die Oberfläche setzt keinen eigenen Garantie-Satz. Seit
// Fassung B (Justin, 07.10.2026): eine Auszahlung statt Tranchen und genau zwei
// Bedingungen der Bürgschaft — sie stehen offen nebeneinander, jede mit ihrem
// „warum“ (kein Akkordeon für zwei Punkte, kein Block „Sicherheiten“). Darunter
// der Satz „kein gesondertes Entgelt“, die Plakette der Bürgin und das Siegel
// der Sonderfreigabe (nur, wenn der Server einen Vermerk liefert).
// Überschriften der Teillisten (Bedingungen, Bürgin) sind Bedienbeschriftungen
// der Seite (LISTEN unten) — die Daten tragen dafür kein Feld.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import type { FirmaSeite } from "@shared/fiaon-global-angebot-firma-typen";
import SonderfreigabeSiegel from "./SonderfreigabeSiegel";
import { Auf, Zeichen, ruhig } from "./gemeinsam";

const LISTEN = { bedingungen: "Bedingungen der Bürgschaft", buergin: "Bürgin" };

/** Zählt die Zahl im Betrag einmal hoch, sobald er im Bild ist („250.000 USD“ → 0 … 250.000 USD). */
function Betrag({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const treffer = /(\d{1,3}(?:\.\d{3})+|\d+)/.exec(text);
  const ziel = treffer ? Number(treffer[1].replace(/\./g, "")) : 0;
  const [wert, setWert] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !treffer || ruhig() || typeof IntersectionObserver === "undefined") return;
    setWert(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now(), dauer = 1600;
      const schritt = (t: number) => {
        const x = Math.min(1, (t - start) / dauer);
        const k = 1 - Math.pow(1 - x, 4);
        setWert(Math.round((ziel * k) / 1000) * 1000);
        if (x < 1) raf = requestAnimationFrame(schritt); else setWert(null);
      };
      raf = requestAnimationFrame(schritt);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
    // Einmal je Betrag.
  }, [text]);
  const anzeige = wert === null || !treffer ? text : text.replace(treffer[1], wert.toLocaleString("de-DE"));
  return <p ref={ref} className="gaf-kapital-betrag" aria-label={text}><span aria-hidden="true">{anzeige}</span></p>;
}

export default function KapitalTafel({ k }: { k: FirmaSeite["kapital"] }) {
  return (
    <div className="gaf-kapital" data-fiaon="firma-kapital">
      <div className="gaf-kapital-raster">
        <Auf className="gaf-kapital-links">
          <div className="gaf-kapital-buehne">
            <span className="gaf-kapital-schein" aria-hidden="true" />
            <Betrag text={k.betrag} />
            <p className="gaf-kapital-auszahlung">{k.auszahlung}</p>
          </div>
          <div className="gaf-garantie" data-fiaon="firma-garantie">
            <span className="gaf-garantie-zeichen"><Zeichen art="schild" groesse={26} /></span>
            <div>
              {k.garantie.map((g, i) => <p key={i} className={i === 0 ? "gaf-garantie-kern" : "gaf-garantie-satz"}>{g}</p>)}
            </div>
          </div>
        </Auf>

        <Auf className="gaf-kapital-rechts" verz={120}>
          <h3 className="gaf-h3">{LISTEN.bedingungen}</h3>
          <p className="gaf-bed-sub">{k.bedingungenSub}</p>
          <ol className="gaf-bedingungen" data-fiaon="firma-bedingungen">
            {k.bedingungen.map((b, i) => (
              <li key={b.titel}>
                <span className="gaf-bed-nr" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p className="gaf-bed-titel">{b.titel}</p>
                  <p className="gaf-bed-text">{b.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="gaf-ohne-entgelt"><Zeichen art="haken" groesse={16} /><span>{k.ohneEntgelt}</span></p>
        </Auf>
      </div>

      <div className="gaf-kapital-unten">
        <Auf className="gaf-buergin">
          <span className="gaf-buergin-plakette" aria-hidden="true">
            <svg viewBox="0 0 120 120" width="96" height="96">
              <defs>
                <linearGradient id="gaf-metall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f6f9" /><stop offset=".45" stopColor="#b9c1cd" /><stop offset=".7" stopColor="#e4e8ee" /><stop offset="1" stopColor="#9aa4b3" /></linearGradient>
              </defs>
              <circle cx="60" cy="60" r="57" fill="url(#gaf-metall)" />
              <circle cx="60" cy="60" r="50" fill="none" stroke="#12284a" strokeOpacity=".35" />
              <circle cx="60" cy="60" r="34" fill="none" stroke="#12284a" strokeOpacity=".25" />
              <text x="60" y="67" textAnchor="middle" className="gaf-buergin-mono">{k.buergin.name.split(/\s+/).filter((w) => /^[A-ZÄÖÜ]/.test(w) && w !== "LLC").slice(0, 2).map((w) => w[0]).join("")}</text>
            </svg>
          </span>
          <div className="gaf-buergin-text">
            <p className="gaf-auge">{LISTEN.buergin}</p>
            <p className="gaf-buergin-name">{k.buergin.name}</p>
            <p className="gaf-buergin-zeile">{k.buergin.sitz}</p>
            <p className="gaf-buergin-zeile">{k.buergin.vertreter} · {k.buergin.funktion}</p>
          </div>
        </Auf>
        {k.sonderfreigabe.text.trim() && (
          <Auf className="gaf-kapital-siegel" verz={140}>
            <SonderfreigabeSiegel sf={k.sonderfreigabe} />
          </Auf>
        )}
      </div>
    </div>
  );
}
