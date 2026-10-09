// ═══════════════════════════════════════════════════════════════════════════
// HERO „IHR AUFTRAG“ AUF /business (09.10.2026) — statt der Gründungsurkunde
//
// Justin: „Lass dir als HERO … was anderes einfallen als die Urkunde, die Urkunde passt nicht“ — aus drei bewegten
// Entwürfen (04_Fahrplan/BUSINESS_HERO_2026-10/) wählte er B. Die Leistung selbst als schwebende helle Glasoberfläche
// in Ebenen: Kapitalziel (die eine Navy-Fläche), die Akte einer Beispiel-Gesellschaft mit Gründung ✓, EIN ✓,
// ITIN läuft, davor der echte Ansprechpartner (VISITENKARTEN.daniel) und eine Meldung, die einfliegt.
//
// Ehrlich: Gesellschaft und Fortschritt sind erfunden — sichtbar „Beispielansicht“ (wie der KI-Hinweis der Urkunde).
// Das Kapitalziel steht nie ohne „über den Rahmen entscheidet das Institut“.
//
// Bewegung: ein Auftakt nach dem Ladebildschirm (≈ 3 s, CSS), danach nur Schweben von Person und Meldung; die
// Szene neigt sich bei feinem Zeiger (useNeigung). Bei „weniger Bewegung“ steht sofort das Endbild.
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState } from "react";
import { nachLadebild, ruhigGewuenscht, useNeigung } from "@/components/site/global/bewegung";
import { VISITENKARTEN } from "@shared/fiaon-visitenkarte";
import type { GLOBAL_BUEHNE_WOERTER } from "@/i18n/global";
import "@/styles/global-buehne.css";

/** Zustand je Schritt der Beispielakte (Reihenfolge wie GLOBAL_BUEHNE_WOERTER.schritte). */
const ZUSTAND = ["fertig", "fertig", "laeuft", "offen", "spaeter"] as const;

export default function HeroAuftrag({ w, en }: { w: (typeof GLOBAL_BUEHNE_WOERTER)["de"]; en: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [an, setAn] = useState(false);
  useNeigung(ref);
  useLayoutEffect(() => {
    if (ruhigGewuenscht()) { setAn(true); return; }
    let raf = 0;
    const weg = nachLadebild(() => { raf = requestAnimationFrame(() => setAn(true)); });
    return () => { weg(); cancelAnimationFrame(raf); };
  }, []);
  const person = VISITENKARTEN.daniel;
  return (
    <div ref={ref} className="hb hb-b" data-an={an ? "1" : "0"} role="img" aria-label={w.heroLabel(person.name)}>
      <div className="hb-b-licht" aria-hidden="true"><i /><i /></div>
      <div className="hb-b-szene" aria-hidden="true">
        <div className="hb-b-ebene hb-b-kapital-ort">
          <div className="hb-b-kapital">
            <span className="hb-auge hell">{w.kapitalAuge}</span>
            <span className="hb-b-kapital-zeile">
              <b>{w.kapitalBetrag}</b>
              <svg viewBox="0 0 120 64" className="hb-b-bogen">
                <path className="spur" d="M10 58 A50 50 0 0 1 110 58" pathLength={1} />
                <path className="wert" d="M10 58 A50 50 0 0 1 110 58" pathLength={1} />
              </svg>
            </span>
            <small>{w.kapitalZeile}</small>
          </div>
        </div>
        <div className="hb-b-ebene hb-b-akte-ort">
          <div className="hb-b-akte">
            <div className="hb-b-akte-kopf">
              <span className="hb-b-siegel">LLC</span>
              <div>
                <small>{w.akteAuge}</small>
                <b>{w.akteName}</b>
                <span>{w.akteOrt}</span>
              </div>
              <div className="hb-b-ring">
                <svg viewBox="0 0 44 44"><circle className="spur" cx="22" cy="22" r="18" /><circle className="wert" cx="22" cy="22" r="18" pathLength={1} /></svg>
                <b>2<small>/5</small></b>
              </div>
            </div>
            <ol className="hb-b-schritte">
              {w.schritte.map((s, i) => (
                <li key={s.titel} data-z={ZUSTAND[i]} style={{ ["--i" as string]: i }}>
                  <i className="hb-b-zeichen">
                    {ZUSTAND[i] === "fertig" && <svg viewBox="0 0 20 20"><path d="M5.5 10.4l3 3L14.6 7.2" pathLength={1} /></svg>}
                    {ZUSTAND[i] === "laeuft" && <span className="punkte"><i /><i /><i /></span>}
                  </i>
                  <span><b>{s.titel}</b><small>{s.zeile}</small></span>
                  <em>{s.marke}</em>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="hb-b-ebene hb-b-person-ort">
          <div className="hb-b-person-ein"><div className="hb-b-person">
            <span className="hb-b-bild"><img src="/portraits/daniel.jpg" alt="" width={56} height={56} decoding="async" /><i /></span>
            <div><small>{w.person}</small><b>{person.name}</b><span>{person.rolle[en ? "en" : "de"]}</span></div>
            <span className="hb-b-wege">
              <i title={w.mail}><svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="m4.5 7 7.5 6 7.5-6" /></svg></i>
              <i title={w.telefon}><svg viewBox="0 0 24 24"><path d="M6.6 4.5h2.6l1.4 3.6-1.8 1.2a10.5 10.5 0 0 0 5.9 5.9l1.2-1.8 3.6 1.4v2.6a1.8 1.8 0 0 1-1.9 1.8A15.4 15.4 0 0 1 4.8 6.4a1.8 1.8 0 0 1 1.8-1.9Z" /></svg></i>
            </span>
          </div></div>
        </div>
        <div className="hb-b-ebene hb-b-meldung-ort">
          <div className="hb-b-meldung-ein"><div className="hb-b-meldung">
            <span className="hb-b-glocke"><svg viewBox="0 0 24 24"><path d="M6 17h12l-1.6-2.2V10a4.4 4.4 0 0 0-8.8 0v4.8L6 17Zm4.2 2.2a1.9 1.9 0 0 0 3.6 0" /></svg></span>
            <div><b>{w.meldungTitel}</b><span>{w.meldungText}</span></div>
            <em>{w.meldungZeit}</em>
          </div></div>
        </div>
      </div>
      <span className="hb-nachweis">{w.beispiel}</span>
    </div>
  );
}
