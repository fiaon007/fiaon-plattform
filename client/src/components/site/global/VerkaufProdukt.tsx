// ═══════════════════════════════════════════════════════════════════════════
// DAS EINE PRODUKT — „Ihre US-LLC: ein Mandat, acht Bereiche.“ (Register E-509, 12.11.2026; Wortlaut E-510, 13.11.2026)
//
// Justin: „die US LLC Gründung mit aktiver Betreuung (volle Package, perfekt animiert anführen aber clean halten, sauber
// halten, platz lassen, Rechtsberatung rein, Steuerberatung — all das)“. Stil: „seriös, Kanzlei-Stil mit guten Animationen“.
// 12.11.2026: „keine Magie, sondern knallharte Fakten“ — jeder Bereich nennt, wer entscheidet.
//
// Vier Bausteine, alle lesen ihre Sätze aus shared/fiaon-global-verkauf.ts (die festen Sätze kommen dort aus
// shared/fiaon-global-saetze.ts):
//   VerkaufProdukt   das Leistungsverzeichnis — acht Bereiche, römisch gezählt, an Haarlinien; ein Bereich klappt auf.
//                    Daneben die Urkunde mit dem Honorar zum Auftrag. Beim Hineinscrollen zeichnen sich die Linien, die
//                    Zeilen gleiten nacheinander hoch (einmal).
//   VerkaufGarantie  „Wenn die Finanzierung ausbleibt“: der Name als Überschrift, die Kurz-Form mit Fristbeginn, die drei
//                    Zeilen der Mittel-Form an Linien, darunter der Satz zu Ziffer 4 und zum Institut.
//   VerkaufRolle     „Was FIAON ist — und was nicht“: vier Abgrenzungen an Linien.
//   VerkaufKarte     die kompakte Karte „Ein Mandat“ für die Unterseiten — mit eigener Fassung für die Schweiz (ohne
//                    Konto und Karten) und für Österreich (nur Gründung und Unterlagen, ohne Betrag, Knopf zum Gespräch).
// Die sechs Schritte stehen in GlobalSchritte.tsx (vorher hier: VerkaufAblauf mit vier Schritten).
// Bei „weniger Bewegung“ und ohne JS steht alles sofort im Endbild (data-an fehlt dann oder ist „1“).
//
// Feinschliff 13.11.2026 (Justin: „ein paar mehr Animationen“, clean): Die Zeilen des Verzeichnisses und die vier Schritte
// kommen JE FÜR SICH, sobald sie selbst ins Bild rücken (useKinderEinmalSichtbar) — am Handy, wo die Listen höher sind als
// das Bild, lief der Auftritt sonst ab, bevor man die unteren Zeilen sah. Was zugleich erscheint, staffelt sich (--d).
// Die Linie der Schritte zieht sich einmal, jede Nummer leuchtet kurz auf, wenn die Linie sie erreicht.
//
// E-510 (13.11.2026, Gestaltung — „Papier, Linie, eine Bühne“, UX-Prüfung 3.5): Ein Kasten ist nur noch, was ein Gegenstand
// ist. Die Urkunde bleibt ein Blatt Papier (ohne Glanz, der darüberzieht). Die Geld-zurück-Garantie steht nicht mehr in
// einem Glaskasten, sondern als Band an Haarlinien: links Siegel, Name und Kurz-Form, rechts die drei Zeilen der Mittel-Form;
// darunter — im selben Band — „Was Sie vor dem Mandat wissen müssen“ (children). Zugeklappte Bereiche des Verzeichnisses
// sind für Tastatur und Screenreader aus (visibility), ohne acht eigene Regionen (UX-Prüfung M2).
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { VERKAUF_TEXTE, VERKAUF_PREISE, verkaufEur, verkaufKarte, verkaufPfad, type VerkaufSprache } from "@shared/fiaon-global-verkauf";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-tokens.css";
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
export function useKinderEinmalSichtbar(ref: RefObject<HTMLElement | null>, rand = "0px 0px -14% 0px") {
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
    <section className="fg-sek vk-produkt" id="produkt" ref={ref} aria-labelledby="vk-produkt-titel" style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2" id="vk-produkt-titel">{T.h2a} <em>{T.h2b}</em></h2></div>
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
                  <div className="vk-bereich-mehr" id={`vk-bereich-${i}`}>
                    <div><ul>{b.details.map((d) => <li key={d}>{W(d)}</li>)}</ul></div>
                  </div>
                </li>
              );
            })}
          </ol>
          <aside className="vk-urkunde" aria-label={T.name}>
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

export function VerkaufGarantie({ sprache, children }: { sprache: VerkaufSprache; children?: ReactNode }) {
  const T = VERKAUF_TEXTE[sprache].garantie;
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  return (
    <section className="fg-sek vk-garantie" id="geld-zurueck" ref={ref} aria-labelledby="vk-garantie-titel" style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="vk-garantie-band">
          <div className="vk-garantie-kopf">
            <svg className="vk-siegel" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false">
              <circle cx="28" cy="28" r="26.5" pathLength={1} className="kreis" />
              <path d="M18.5 28.8l6.6 6.6L38 22" pathLength={1} className="haken" />
            </svg>
            <span className="fg-auge">{T.auge}</span>
            <h2 className="fg-h2" id="vk-garantie-titel">{T.h2}</h2>
            <p className="fg-lead">{W(T.text)}</p>
          </div>
          <div className="vk-garantie-text">
            {/* Die Mittel-Form: Frist · Erstattung · Ihre Gesellschaft — drei Zeilen an Linien. */}
            <ul className="vk-garantie-mittel">{T.mittel.map((m, i) => <li key={m} style={stufe(i)}>{W(m)}</li>)}</ul>
            <p className="vk-garantie-fein">{W(T.fein)}</p>
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

/** „Was FIAON ist — und was nicht“: die Einordnung vor dem Erstgespräch. `children` steht unter der Liste (etwa „Für wen“). */
export function VerkaufRolle({ sprache, children }: { sprache: VerkaufSprache; children?: ReactNode }) {
  const T = VERKAUF_TEXTE[sprache].rolle;
  const ref = useRef<HTMLElement>(null);
  const liste = useRef<HTMLUListElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -20% 0px");
  useKinderEinmalSichtbar(liste);
  return (
    <section className="fg-sek vk-rolle" id="rolle" ref={ref} aria-labelledby="vk-rolle-titel" style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{T.auge}</span><h2 className="fg-h2" id="vk-rolle-titel">{T.h2}</h2></div>
          <p className="fg-lead">{W(T.lead)}</p>
        </div>
        <ul className="vk-rolle-liste" ref={liste}>
          {T.punkte.map((p) => (
            <li key={p.titel}>
              <h3>{p.titel}</h3>
              <p>{W(p.text)}</p>
            </li>
          ))}
        </ul>
        {children}
      </div>
    </section>
  );
}

/**
 * Die kompakte Karte für die Unterseiten — überall dort, wo bis E-509 eine Paketkarte oder alle vier standen.
 * `ort` ist die Adresse der Seite: Auf der Schweiz-Seite steht die Fassung ohne Konto und Karten, auf der Österreich-Seite
 * die Fassung ohne Betrag, deren Knopf zum Erstgespräch führt (Leitfaden 5.12).
 */
export function VerkaufKarte({ sprache, ort = "karte" }: { sprache: VerkaufSprache; ort?: string }) {
  const T = verkaufKarte(sprache, ort);
  const ziel = T.zumGespraech ? (sprache === "en" ? "/en#gespraech" : "/#gespraech") : verkaufPfad(sprache);
  return (
    <div className="vk-karte" data-ort={ort}>
      <div className="vk-karte-text">
        <span className="fg-auge">{T.auge}</span>
        <h3>{T.titel}</h3>
        <p>{T.zeile}</p>
        <ul>{T.punkte.map((p) => <li key={p}>{p}</li>)}</ul>
      </div>
      <div className={`vk-karte-preis${T.mitBetrag ? "" : " ohne-betrag"}`}>
        <span>{T.preisLabel}</span>
        {T.mitBetrag && <b>{verkaufEur(VERKAUF_PREISE.gruendungCents, sprache)}</b>}
        <a className="fg-knopf" href={ziel}>{T.knopf}<Pfeil /></a>
        <small>{T.fein}</small>
      </div>
    </div>
  );
}
