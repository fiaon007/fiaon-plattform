// ═══════════════════════════════════════════════════════════════════════════
// DIE VIER BÜHNEN ÜBER DEN PAKETTAFELN (16.10.2026, E-387) — ersetzt WegLinie
//
// Justin wählte aus drei Entwürfen „A · Vier Bühnen“: je Etappe eine helle
// Kachel mit einem echten 3D-Objekt (etappen-szene.ts), darunter Titel, ein
// Satz, wer dabei ist (nur Namen — „keine Icons“) und „In jedem Paket“ bzw.
// „Ab …“. Unter den Kacheln ein Navy-Band „Ihr Team im Festpreis“: wer in
// jedem Paket mitarbeitet, Honorare inklusive (Sätze aus GLOBAL_ROLLEN). Die
// Pakettafeln darunter bleiben unverändert.
//
// Rechner: vier Spalten (721–1120 px zwei), Handy: die Kacheln wischen seitlich
// (scroll-snap) mit Punkten darunter — so bleibt Platz für jede Bühne, ohne
// vier Bildschirme Weg vor den Paketen. Am Handy werden Etappen außerhalb des
// gewählten Pakets blass (`bis`), wie bisher an der Wegleiste.
//
// three.js kommt per import() als eigener Chunk und nur mit WebGL; der Takt
// läuft nur im Bild (beobachteSichtbar). Bei „weniger Bewegung“ steht ein
// ruhiges Einzelbild. Ohne WebGL zeigt die Bühne die römische Ziffer groß.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { beobachteSichtbar, ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import type { EtappenSzene } from "./etappen-szene";

const ROEMISCH = ["I", "II", "III", "IV"];

const webglDa = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};

export interface BuehnenEtappe {
  titel: string;
  /** Titel mit antippbaren Begriffen (optional). */
  titelInhalt?: ReactNode;
  kurz: string;
  leute: string[];
  /** „In jedem Paket“ bzw. „Ab Global Banking“. */
  abzeichen: string;
  /** Ab Etappe II: Hier entscheidet das Institut. */
  institut: boolean;
  dauer: string;
  text: ReactNode;
}

export default function EtappenBuehnen({ id, label, etappen, bis = 4, stempel, ablauf, sprache, team }: {
  id?: string;
  label: string;
  etappen: BuehnenEtappe[];
  /** Bis zu welcher Etappe das gewählte Paket begleitet (Handy: die übrigen blass). */
  bis?: number;
  /** „Hier entscheidet das Institut“. */
  stempel: string;
  /** Beschriftung der Klappe mit Dauer und Ablauf. */
  ablauf: string;
  sprache: "de" | "en";
  team: { titel: string; sub: string; satz: string; liste: { name: string; was: string; zusatz?: string }[] };
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const reihe = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const plaetze = useRef<(HTMLDivElement | null)[]>([]);
  const szene = useRef<EtappenSzene | null>(null);
  const [modus, setModus] = useState<"laedt" | "3d" | "flach">(() => (typeof window !== "undefined" && webglDa() ? "laedt" : "flach"));
  const [aktuell, setAktuell] = useState(0);
  const [handy, setHandy] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(max-width: 720px)").matches);
  useEinmalSichtbar(wurzel, 0.2);

  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 720px)");
    if (!mq) return;
    const neu = () => setHandy(mq.matches);
    mq.addEventListener?.("change", neu);
    return () => mq.removeEventListener?.("change", neu);
  }, []);

  // three.js laden, sobald die Leiste in die Nähe kommt; aufräumen beim Verlassen.
  useEffect(() => {
    if (modus === "flach" || !canvas.current || !wurzel.current) return;
    let weg = false;
    let stoppSicht = () => {};
    let stoppNah = () => {};
    const laden = async () => {
      try {
        const { etappenSzeneBauen } = await import("./etappen-szene");
        if (weg || !canvas.current) return;
        const s = await etappenSzeneBauen(canvas.current, () => plaetze.current, { sprache, ruhig: ruhigGewuenscht() });
        if (weg) { s.dispose(); return; }
        szene.current = s;
        setModus("3d");
        let erstesMal = true;
        stoppSicht = beobachteSichtbar(wurzel.current!, (an) => {
          if (an && erstesMal) { erstesMal = false; s.auftritt(); }
          s.takt(an);
        });
      } catch {
        if (!weg) setModus("flach");
      }
    };
    if (typeof IntersectionObserver === "undefined") void laden();
    else {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); void laden(); } }, { rootMargin: "800px 0px" });
      io.observe(wurzel.current);
      stoppNah = () => io.disconnect();
    }
    return () => { weg = true; stoppNah(); stoppSicht(); szene.current?.dispose(); szene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprache]);

  // Blass nur am Handy (dort wählt man oben ein Paket); am Rechner zeigt jede Tafel ihren eigenen Umfang.
  useEffect(() => {
    etappen.forEach((_, i) => szene.current?.aktiv(i, !handy || i < bis));
  }, [bis, handy, modus, etappen.length]);

  // Handy: welche Kachel steht vorn (für die Punkte), und ohne Dauerlauf neu zeichnen.
  useEffect(() => {
    const r = reihe.current;
    if (!r) return;
    let rahmen = 0;
    const bei = () => {
      cancelAnimationFrame(rahmen);
      rahmen = requestAnimationFrame(() => {
        const kinder = Array.from(r.children) as HTMLElement[];
        const mitte = r.scrollLeft + r.clientWidth / 2;
        let best = 0, abstand = Infinity;
        kinder.forEach((k, i) => { const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - mitte); if (d < abstand) { abstand = d; best = i; } });
        setAktuell(best);
        szene.current?.zeichnen();
      });
    };
    r.addEventListener("scroll", bei, { passive: true });
    return () => { r.removeEventListener("scroll", bei); cancelAnimationFrame(rahmen); };
  }, []);

  const fein = typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  const zeiger = (i: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (!fein) return;
    const r = e.currentTarget.getBoundingClientRect();
    szene.current?.zeiger(i, [((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1]);
  };
  const springen = (i: number) => {
    const r = reihe.current, k = r?.children[i] as HTMLElement | undefined;
    if (r && k) r.scrollTo({ left: k.offsetLeft - (r.clientWidth - k.offsetWidth) / 2, behavior: ruhigGewuenscht() ? "auto" : "smooth" });
  };

  return (
    <div ref={wurzel} id={id} className={`fg-eb${modus === "3d" ? " mit-3d" : ""}${modus === "flach" ? " flach" : ""}`} role="group" aria-label={label} style={{ scrollMarginTop: 96 }}>
      <div className="fg-eb-flaeche">
        <div className="fg-eb-reihe" ref={reihe}>
          {etappen.map((e, i) => {
            const an = !handy || i < bis;
            return (
              <article key={e.titel} className={`fg-eb-kachel${an ? "" : " aus"}`} style={{ "--i": i } as React.CSSProperties}
                onPointerMove={zeiger(i)} onPointerLeave={() => szene.current?.zeiger(i, null)}>
                <div className="fg-eb-buehne" ref={(el) => { plaetze.current[i] = el; }}>
                  <span className="fg-eb-nr" aria-hidden="true">{ROEMISCH[i]}</span>
                  {e.institut && <span className="fg-eb-institut">{stempel}</span>}
                  {modus === "flach" && <span className="fg-eb-ersatz" aria-hidden="true">{ROEMISCH[i]}</span>}
                </div>
                <div className="fg-eb-text">
                  <span className={`fg-eb-ab${i < 2 ? " jedes" : ""}`}>{e.abzeichen}</span>
                  <h3 className="fg-eb-titel">{e.titelInhalt ?? e.titel}</h3>
                  <p className="fg-eb-kurz">{e.kurz}</p>
                  <ul className="fg-eb-leute">{e.leute.map((l) => <li key={l}>{l}</li>)}</ul>
                  <details className="fg-eb-mehr">
                    <summary>{ablauf}</summary>
                    <b>{e.dauer}</b>
                    <p>{e.text}</p>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
        <canvas ref={canvas} className="fg-eb-leinwand" aria-hidden="true" />
      </div>
      <div className="fg-eb-punkte" aria-hidden="true">
        {etappen.map((e, i) => <button key={e.titel} type="button" tabIndex={-1} className={i === aktuell ? "an" : undefined} onClick={() => springen(i)} />)}
      </div>

      <div className="fg-eb-team">
        <div className="fg-eb-team-kopf"><b>{team.titel}</b><span>{team.sub}</span></div>
        <ul className="fg-eb-team-liste">
          {team.liste.map((x) => (
            <li key={x.name}><b>{x.name}</b><span>{x.was}{x.zusatz ? <em> · {x.zusatz}</em> : null}</span></li>
          ))}
        </ul>
        <p className="fg-eb-team-satz">{team.satz}</p>
      </div>
    </div>
  );
}
