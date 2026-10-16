// ═══════════════════════════════════════════════════════════════════════════
// /partnernetzwerk (+ /vorsorge /recht /steuern /energie /telekommunikation) · /en/partner-network/… (E-388, Neubau E-390)
//
// Justin (16.10.2026): „richtig schöne Seiten … cinematisch“ — dann: „Das muss ein wenig schlanker, cleaner, mehr und bessere
// Animationen“. Neubau: kompakter Hero (Wörter blenden einzeln ein, Bild mit Parallaxe und Lichtkante), Laufband statt
// Chip-Säule, Bereichsleiste mit gleitender Markierung, schlanke Vorteilszeilen in zwei Spalten statt zwölf Karten,
// Lichtkegel unter der Maus, Brücke mit Lichtpaketen, Zeitstrahl, der sich beim Scrollen füllt, hochzählender Preis mit
// umlaufender Kante, Häkchen, die sich zeichnen, Demo-Bildschirm mit Neigung zur Maus, feine Fortschrittslinie oben.
// Texte: client/src/i18n/partnernetz.ts · Preise: shared/fiaon-partnernetz.ts · Demo: /partner/demo (koop-partner.tsx).
// Bewegung: styles/partnernetz.css; bei prefers-reduced-motion still und vollständig sichtbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode, type CSSProperties, type MouseEvent as MausEreignis, type RefObject } from "react";
import { useLocation } from "wouter";
import { Dunkel, Knopf, Fragen, Anfrage } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { PARTNERNETZ_WOERTER, type NetzKarte, type NetzSeite, type NetzSymbol } from "@/i18n/partnernetz";
import { NETZ_BEREICHE, NETZ_PFAD, NETZ_BEREICH_NAME, netzBereichAusPfad, netzDemoPfad, type NetzBereich } from "@shared/fiaon-partnernetz";
import "@/styles/partnernetz.css";

const BILD: Record<NetzBereich | "hub", string> = {
  hub: "/kino/partnernetz-netz.jpg", vorsorge: "/kino/partnernetz-vorsorge.jpg", recht: "/kino/partnernetz-recht.jpg",
  steuern: "/kino/partnernetz-steuern.jpg", energie: "/kino/partnernetz-energie.jpg", telekom: "/kino/partnernetz-telekom.jpg",
};

/** Feine Linien-Symbole, 24er Raster, Strichstärke 1.6 — eine Familie für alle Seiten des Netzwerks. */
const PFADE: Record<NetzSymbol, ReactNode> = {
  termin: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 13.5h3" /></>,
  schild: <><path d="M12 3 5 6v5c0 4.4 3 8.4 7 10 4-1.6 7-5.6 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  herz: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />,
  waage: <><path d="M12 4v16M7 20h10M5 8h14" /><path d="m5 8-2.5 6a3 3 0 0 0 5 0L5 8ZM19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" /></>,
  beleg: <><path d="M6 3h9l3 3v15l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2L6 21V3Z" /><path d="M9 9h6M9 13h6" /></>,
  blitz: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  funk: <><path d="M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0" /><circle cx="12" cy="12" r="1.2" /><path d="M12 13v8" /></>,
  uhr: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  haken: <><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  pfad: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /></>,
  rechnung: <><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  menge: <path d="M4 20V10M10 20V5M16 20v-8M22 20H2" />,
  auge: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  hand: <><path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7" /><path d="M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 5 14.5V11a1.5 1.5 0 0 1 3 0" /></>,
  netz: <><circle cx="12" cy="5" r="2" /><circle cx="5" cy="17" r="2" /><circle cx="19" cy="17" r="2" /><path d="M11 6.8 6 15.2M13 6.8l5 8.4M7 17h10" /></>,
  stern: <path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" />,
};
function Zeichen({ s }: { s: NetzSymbol }) {
  return <span className="pn-zeichen" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{PFADE[s]}</svg></span>;
}
/** Ein Häkchen, das sich beim Erscheinen selbst zeichnet. */
function Haken() {
  return <svg className="pn-haken" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="m8 12.4 2.7 2.7L16.2 9.4" /></svg>;
}
const BEREICH_ZEICHEN: Record<NetzBereich, NetzSymbol> = { vorsorge: "herz", recht: "waage", steuern: "beleg", energie: "blitz", telekom: "funk" };
const v = (i: number) => ({ ["--v" as any]: i }) as CSSProperties;

// ── Bewegung: sichtbar werden, Scroll, Hochzählen, Lichtkegel ──────────────
const ruhig = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
function useSichtbar<T extends Element>(schwelle = 0.16): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [da, setDa] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el || da) return;
    if (typeof IntersectionObserver === "undefined") { setDa(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setDa(true); io.disconnect(); } }, { threshold: schwelle, rootMargin: "0px 0px -6% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [da, schwelle]);
  return [ref, da];
}
/** Erscheint beim Hereinscrollen (weich, mit Unschärfe); Kinder mit --v staffeln sich in CSS. */
function Zeig({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  const [ref, da] = useSichtbar<HTMLDivElement>();
  return <div ref={ref} className={`pn-zeig${da ? " pn-da" : ""} ${className}`} style={style}>{children}</div>;
}
/** Wer scrollt: auf der Website meist #root (Rahmen der App), sonst das Dokument. */
function scrollStand(): { y: number; h: number } {
  const r = document.getElementById("root");
  if (r && r.scrollHeight > r.clientHeight + 4 && r.scrollTop > 0) return { y: r.scrollTop, h: r.scrollHeight - r.clientHeight };
  const d = document.scrollingElement ?? document.documentElement;
  return { y: d.scrollTop, h: d.scrollHeight - window.innerHeight };
}
/** Ruft cb bei jedem Scroll-Bild (rAF-gedrosselt) mit Anteil 0…1 und Scrollhöhe — egal, welches Element scrollt. */
function useScroll(cb: (anteil: number, y: number) => void) {
  const cbRef = useRef(cb); cbRef.current = cb;
  useEffect(() => {
    let f = 0;
    const lauf = () => { f = 0; const { y, h } = scrollStand(); cbRef.current(h > 0 ? Math.min(1, Math.max(0, y / h)) : 0, y); };
    const an = () => { if (!f) f = requestAnimationFrame(lauf); };
    lauf();
    document.addEventListener("scroll", an, { passive: true, capture: true });
    window.addEventListener("resize", an);
    return () => { document.removeEventListener("scroll", an, { capture: true }); window.removeEventListener("resize", an); if (f) cancelAnimationFrame(f); };
  }, []);
}
function Fortschritt() {
  const ref = useRef<HTMLDivElement>(null);
  useScroll((a) => { if (ref.current) ref.current.style.transform = `scaleX(${a})`; });
  return <div className="pn-fortschritt" aria-hidden="true"><div ref={ref} /></div>;
}
/** „89 €“, „690 €“, „18“ — die Ziffern zählen beim Erscheinen hoch, der Rest steht. */
function Zahl({ wert, dauer = 1500 }: { wert: string; dauer?: number }) {
  const [ref, da] = useSichtbar<HTMLSpanElement>(0.4);
  const m = wert.match(/^(\D*)([\d.]+)(.*)$/);
  const ziel = m ? Number(m[2].replace(/\./g, "")) : 0;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!da || !m) return;
    if (ruhig()) { setN(ziel); return; }
    let f = 0; const t0 = performance.now();
    const schritt = (t: number) => { const p = Math.min(1, (t - t0) / dauer); setN(Math.round(ziel * (1 - Math.pow(1 - p, 4)))); if (p < 1) f = requestAnimationFrame(schritt); };
    f = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(f);
  }, [da]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m) return <>{wert}</>;
  return <span ref={ref} aria-label={wert} className="pn-zahl"><span aria-hidden="true">{m[1]}{n.toLocaleString("de-DE")}{m[3]}</span></span>;
}
/** Lichtkegel unter der Maus: setzt --mx/--my auf dem Element. */
function kegel(e: MausEreignis<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

// ── Hero ──────────────────────────────────────────────────────────────────
function Woerter({ text, start }: { text: string; start: number }) {
  let n = 0;
  return <>{text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : <span key={i} className="pn-wort" style={{ ["--w" as any]: start + n++ }}>{w}</span>))}</>;
}
function NetzHero({ bild, pille, a, b, lead, chips, knoepfe, symbolbild }: { bild: string; pille: string; a: string; b: string; lead: string; chips: string[]; knoepfe: ReactNode; symbolbild: string }) {
  const bildRef = useRef<HTMLDivElement>(null);
  useScroll((_a, y) => { if (bildRef.current && !ruhig()) bildRef.current.style.transform = `translate3d(0,${Math.min(y, 1000) * 0.3}px,0)`; });
  const nA = a.trim().split(/\s+/).length, nB = b.trim().split(/\s+/).length;
  const band = [...chips, ...chips, ...chips, ...chips];
  return (
    <section className="pn-hero">
      <div className="pn-hero-bild" ref={bildRef} aria-hidden="true">
        <img src={bild} alt="" decoding="async" {...({ fetchpriority: "high" } as any)} />
      </div>
      <div className="pn-schleier" aria-hidden="true" /><div className="pn-kante" aria-hidden="true" />
      <div className="pn-rahmen pn-hero-rahmen">
        <span className="pn-pille pn-ein" style={{ ["--w" as any]: 0 }}><i />{pille}</span>
        <h1 className="pn-h1"><Woerter text={a} start={1} /><span className="pn-blau"><Woerter text={b} start={1 + nA} /></span></h1>
        <p className="pn-lead pn-ein" style={{ ["--w" as any]: 2 + nA + nB }}>{lead}</p>
        <div className="pn-knoepfe pn-ein" style={{ ["--w" as any]: 3 + nA + nB }}>{knoepfe}</div>
      </div>
      <div className="pn-band pn-ein" style={{ ["--w" as any]: 4 + nA + nB }} aria-hidden="true">
        <div className="pn-band-lauf">{band.map((c, i) => <span key={i}><i />{c}</span>)}</div>
      </div>
      <span className="pn-symbolbild">{symbolbild}</span>
    </section>
  );
}

// ── Bereichsleiste mit gleitender Markierung ───────────────────────────────
function Leiste({ aktiv, en, hubText }: { aktiv: NetzBereich | "hub"; en: boolean; hubText: string }) {
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  const navRef = useRef<HTMLElement>(null);
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);
  const setzen = (el: HTMLElement | null | undefined) => {
    const nav = navRef.current; if (!el || !nav) return;
    setMark({ x: el.offsetLeft, w: el.offsetWidth });
  };
  const aktivesEl = () => navRef.current?.querySelector<HTMLElement>("a.an");
  useEffect(() => {
    const el = aktivesEl(); setzen(el);
    el?.scrollIntoView?.({ block: "nearest", inline: "center" });
    const neu = () => setzen(aktivesEl());
    window.addEventListener("resize", neu);
    document.fonts?.ready.then(neu).catch(() => {});
    return () => window.removeEventListener("resize", neu);
  }, [aktiv]);
  const eintraege: [NetzBereich | "hub", string, string][] = [["hub", P.hub, hubText], ...NETZ_BEREICHE.map((b) => [b, P[b], NETZ_BEREICH_NAME[b][en ? "en" : "de"]] as [NetzBereich, string, string])];
  return (
    <div className="pn-leiste-rahmen">
      <nav className="pn-leiste" ref={navRef} aria-label={en ? "Areas" : "Bereiche"} onMouseLeave={() => setzen(aktivesEl())}>
        {mark && <span className="pn-leiste-mark" style={{ transform: `translateX(${mark.x}px)`, width: mark.w }} aria-hidden="true" />}
        {eintraege.map(([k, href, name]) => (
          <a key={k} href={href} className={aktiv === k ? "an" : ""} aria-current={aktiv === k ? "page" : undefined} onMouseEnter={(e) => setzen(e.currentTarget)}>
            {k !== "hub" && <Zeichen s={BEREICH_ZEICHEN[k]} />}{name}
          </a>
        ))}
      </nav>
    </div>
  );
}

function Kopf({ pille, a, b, lead }: { pille?: string; a: string; b: string; lead?: string }) {
  return (
    <Zeig className="pn-kopf">
      {pille && <span className="pn-auge">{pille}</span>}
      <h2 className="pn-h2">{a}<span className="pn-blau">{b}</span></h2>
      {lead && <p className="pn-text">{lead}</p>}
    </Zeig>
  );
}

/** Zwei schlanke Spalten: was der Kunde hat — was der Partner hat. Dazwischen eine Naht aus Licht. */
type Spalte = { auge: string; titel: string; lead?: string; items: NetzKarte[] };
function ZweiSeiten({ links, rechts }: { links: Spalte; rechts: Spalte }) {
  const spalte = (s: Spalte, art: string) => (
    <Zeig className={`pn-spalte ${art}`}>
      <span className="pn-auge">{s.auge}</span>
      <h3>{s.titel}</h3>
      {s.lead && <p className="pn-spalte-lead">{s.lead}</p>}
      <ul>
        {s.items.map((k, i) => (
          <li key={k.titel} style={v(i)} onMouseMove={kegel}>
            <Zeichen s={k.s} />
            <div><b>{k.titel}</b>{k.text && <span>{k.text}</span>}</div>
          </li>
        ))}
      </ul>
    </Zeig>
  );
  return <div className="pn-zwei">{spalte(links, "kunde")}<div className="pn-naht" aria-hidden="true"><span /></div>{spalte(rechts, "partner")}</div>;
}

function Bruecke({ b }: { b: NetzSeite["bruecke"] }) {
  return (
    <Zeig className="pn-bruecke">
      <div className="pn-pol"><small>{b.links}</small><p>{b.linksText}</p></div>
      <div className="pn-leitung" aria-hidden="true"><i /><i /></div>
      <div className="pn-mitte"><b>FIAON</b><p>{b.mitte}</p></div>
      <div className="pn-leitung" aria-hidden="true"><i /><i /></div>
      <div className="pn-pol rechts"><small>{b.rechts}</small><p>{b.rechtsText}</p></div>
    </Zeig>
  );
}

/** Zeitstrahl: die Linie füllt sich mit dem Scrollen, die Knoten leuchten nacheinander auf. */
function Zeitstrahl({ items }: { items: { titel: string; text: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useScroll(() => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    const p = ruhig() ? 1 : Math.min(1, Math.max(0, (vh * 0.82 - r.top) / (r.height + vh * 0.25)));
    el.style.setProperty("--p", p.toFixed(3));
    el.querySelectorAll("li").forEach((li, i) => li.classList.toggle("an", p * items.length >= i + 0.2));
  });
  return (
    <div ref={ref} className="pn-zeit-huelle">
      <span className="pn-zeit-spur" aria-hidden="true"><span /></span>
      <ol className="pn-zeit" style={{ ["--n" as any]: items.length }}>
        {items.map((s, i) => (
          <li key={s.titel} style={v(i)}>
            <span className="pn-knoten">{String(i + 1).padStart(2, "0")}</span>
            <div><h3>{s.titel}</h3><p>{s.text}</p></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Preis({ p, netto }: { p: NetzSeite["preis"]; netto: string }) {
  return (
    <Zeig className="pn-preis">
      <div className="pn-preis-innen" onMouseMove={kegel}>
        <div className="pn-preis-werte">
          <div><b><Zahl wert={p.wert} /></b><span>{p.einheit}</span></div>
          {p.zweitWert && <div><b><Zahl wert={p.zweitWert} /></b><span>{p.zweitEinheit}</span></div>}
        </div>
        <ul>{p.punkte.map((x, i) => <li key={x} style={v(i)}><Haken />{x}</li>)}</ul>
        <p className="pn-fein">{p.fein}</p>
        <span className="sr-only">{netto}</span>
      </div>
    </Zeig>
  );
}

/** Der Demo-Bildschirm: neigt sich zur Maus, Zahlen zählen hoch, Balken wachsen, Zeilen gleiten herein. */
function DemoBildschirm({ href, titel, text, punkte, knopf, en }: { href: string; titel: ReactNode; text: string; punkte: string[]; knopf: string; en: boolean }) {
  const zeilen = en
    ? [["Sarah K.", "Pension", "Tue 10:00"], ["Thomas M.", "Health cover", "Tue 14:00"], ["Lena B.", "Children", "Wed 09:00"], ["Jonas W.", "Wealth", "Wed 11:00"]]
    : [["Sarah K.", "Altersvorsorge", "Di 10:00"], ["Thomas M.", "Krankenzusatz", "Di 14:00"], ["Lena B.", "Kinder", "Mi 09:00"], ["Jonas W.", "Vermögen", "Mi 11:00"]];
  const neigen = (e: MausEreignis<HTMLAnchorElement>) => {
    if (ruhig()) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -7}deg`);
    e.currentTarget.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 9}deg`);
    kegel(e);
  };
  const zurueck = (e: MausEreignis<HTMLAnchorElement>) => { e.currentTarget.style.removeProperty("--rx"); e.currentTarget.style.removeProperty("--ry"); };
  return (
    <div className="pn-demo">
      <Zeig className="pn-demo-text">
        <h2 className="pn-h2">{titel}</h2>
        <p className="pn-text">{text}</p>
        <ul>{punkte.map((x, i) => <li key={x} style={v(i)}><Haken />{x}</li>)}</ul>
        <div className="pn-knoepfe"><Knopf href={href}>{knopf}</Knopf></div>
      </Zeig>
      <Zeig className="pn-demo-buehne">
        <a href={href} className="pn-schirm" aria-label={knopf} onMouseMove={neigen} onMouseLeave={zurueck}>
          <span className="pn-schirm-band">{en ? "DEMO · SAMPLE DATA" : "DEMO · BEISPIELDATEN"}</span>
          <div className="pn-schirm-kopf">
            <div><small>{en ? "This week" : "Diese Woche"}</small><b><Zahl wert="18" /><i>/20</i></b></div>
            <div><small>{en ? "This month" : "Dieser Monat"}</small><b><Zahl wert="74" /></b></div>
            <div><small>{en ? "No claim" : "Ohne Reklamation"}</small><b><Zahl wert="96" /><i>%</i></b></div>
          </div>
          <div className="pn-schirm-balken" aria-hidden="true">{[38, 52, 47, 61, 69, 74, 82].map((h, i) => <span key={i} style={{ ...v(i), height: `${h}%` }} />)}</div>
          <ul className="pn-schirm-liste">{zeilen.map(([n, t, z], i) => <li key={n} style={v(i)}><b>{n}</b><span>{t}</span><em>{z}</em></li>)}</ul>
          <span className="pn-schirm-glanz" aria-hidden="true" />
        </a>
      </Zeig>
    </div>
  );
}

function Bewerbung({ g, bereich, en }: { g: Record<string, string>; bereich: NetzBereich | null; en: boolean }) {
  const namen = NETZ_BEREICHE.map((b) => NETZ_BEREICH_NAME[b][en ? "en" : "de"]);
  return (
    <section id="bewerbung" className="pn-abschnitt">
      <div className="pn-rahmen schmal">
        <Kopf pille={g.bewerbungPille} a={g.bewerbungA} b={g.bewerbungB} lead={g.bewerbungLead} />
        <Zeig className="pn-form">
          <Anfrage art="netzwerk" en={en} knopf={g.fKnopf} hinweis={g.fHinweis}
            vorbelegt={bereich ? { bereich: NETZ_BEREICH_NAME[bereich][en ? "en" : "de"] } : undefined}
            felder={[
              { name: "name", label: g.fName, pflicht: true },
              { name: "firma", label: g.fFirma, pflicht: true },
              { name: "email", label: g.fEmail, typ: "email", pflicht: true },
              { name: "telefon", label: g.fTelefon, typ: "tel", pflicht: true },
              { name: "bereich", label: g.fBereich, pflicht: true, optionen: namen },
              { name: "region", label: g.fRegion },
              { name: "zulassung", label: g.fZulassung, breit: true },
              { name: "menge", label: g.fMenge, breit: true },
              { name: "text", label: g.fText, typ: "textarea", breit: true },
            ]} />
        </Zeig>
      </div>
    </section>
  );
}

type KachelText = { titel: string; text: string; wer: string; preis: string };
function Kacheln({ en, texte, ohne }: { en: boolean; texte?: Record<string, KachelText>; ohne?: NetzBereich }) {
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  return (
    <Zeig className={`pn-kacheln${texte ? "" : " klein"}`}>
      {NETZ_BEREICHE.filter((b) => b !== ohne).map((b, i) => {
        const x = texte?.[b];
        return (
          <a key={b} href={P[b]} className="pn-kachel" style={v(i)} onMouseMove={kegel}>
            <img src={BILD[b]} alt="" loading="lazy" decoding="async" />
            <span className="pn-kachel-schleier" />
            <span className="pn-kachel-inhalt">
              <Zeichen s={BEREICH_ZEICHEN[b]} />
              {x && <small>{x.wer}</small>}
              <b>{x?.titel ?? NETZ_BEREICH_NAME[b][en ? "en" : "de"]}</b>
              {x && <p>{x.text}</p>}
              {x ? <em>{x.preis}<span aria-hidden="true">→</span></em> : <em className="pfeil" aria-hidden="true">→</em>}
            </span>
          </a>
        );
      })}
    </Zeig>
  );
}

function Schluss({ a, b, text, knoepfe }: { a: string; b: string; text: string; knoepfe: ReactNode }) {
  return (
    <section className="pn-abschnitt pn-schluss">
      <div className="pn-schluss-licht" aria-hidden="true" />
      <div className="pn-rahmen schmal">
        <Zeig className="pn-schluss-innen">
          <h2 className="pn-h2">{a}<span className="pn-blau">{b}</span></h2>
          <p className="pn-text">{text}</p>
          <div className="pn-knoepfe">{knoepfe}</div>
        </Zeig>
      </div>
    </section>
  );
}

function FragenBlock({ en, items }: { en: boolean; items: { f: string; a: string }[] }) {
  return (
    <section className="pn-abschnitt">
      <div className="pn-rahmen schmal">
        <Kopf pille={en ? "Questions" : "Fragen"} a={en ? "Asked " : "Offen "} b={en ? "openly." : "gefragt."} />
        <Zeig className="pn-fragen"><Fragen items={items} /></Zeig>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function PartnerNetz() {
  const [pfad] = useLocation();
  const w = useWoerter(PARTNERNETZ_WOERTER);
  const sprache = useSprache();
  const en = sprache === "en";
  const g = w.gemeinsam;
  const welche = netzBereichAusPfad(pfad) ?? "hub";
  if (welche === "hub") return <Hub en={en} />;
  const t = w[welche];
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  const demo = netzDemoPfad(welche) + (en ? "&lang=en" : "");
  return (
    <Dunkel seite="partner" titel={t.metaTitel} beschreibung={t.metaBeschreibung} sprache={sprache}>
      <SeoDaten pfad={P[welche]} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen}
                krumen={[{ name: w.hub.krume, pfad: P.hub }, { name: t.krume, pfad: P[welche] }]} />
      <div className="pn">
        <Fortschritt />
        <NetzHero bild={BILD[welche]} pille={t.pille} a={t.h1a} b={t.h1b} lead={t.lead} chips={t.chips} symbolbild={g.symbolbild}
                  knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
        <Leiste aktiv={welche} en={en} hubText={g.alleBereiche} />

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <ZweiSeiten links={{ auge: t.kundePille, titel: t.kundeH2a + t.kundeH2b, lead: t.kundeLead, items: t.kunde }}
                        rechts={{ auge: t.partnerPille, titel: t.partnerH2a + t.partnerH2b, lead: t.partnerLead, items: t.partner }} />
            <Bruecke b={t.bruecke} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <Kopf pille={t.ablaufPille} a={t.ablaufH2a} b={t.ablaufH2b} />
            <Zeitstrahl items={t.ablauf} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen pn-preis-raster">
            <div>
              <Kopf pille={t.preisPille} a={t.preisH2a} b={t.preisH2b} lead={t.preisLead} />
              <Zeig className="pn-anf">
                <span className="pn-auge">{t.anforderungPille}</span>
                <h3>{t.anforderungH2a}{t.anforderungH2b}</h3>
                <ul>{t.anforderungen.map((x, i) => <li key={x} style={v(i)}><Haken />{x}</li>)}</ul>
              </Zeig>
            </div>
            <Preis p={t.preis} netto={g.netto} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <DemoBildschirm href={demo} titel={<>{w.hub.demoH2a}<span className="pn-blau">{w.hub.demoH2b}</span></>} text={w.hub.demoText} punkte={w.hub.demoPunkte} knopf={g.demo} en={en} />
          </div>
        </section>

        <FragenBlock en={en} items={t.fragen} />
        <Bewerbung g={g} bereich={welche} en={en} />

        <section className="pn-abschnitt eng">
          <div className="pn-rahmen">
            <Zeig><p className="pn-ueber">{g.weitere}</p></Zeig>
            <Kacheln en={en} ohne={welche} />
          </div>
        </section>

        <Schluss a={t.abschlussA} b={t.abschlussB} text={t.abschlussText}
                 knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
      </div>
    </Dunkel>
  );
}

function Hub({ en }: { en: boolean }) {
  const w = useWoerter(PARTNERNETZ_WOERTER);
  const sprache = useSprache();
  const g = w.gemeinsam; const t = w.hub;
  const P = en ? NETZ_PFAD.en : NETZ_PFAD.de;
  const demo = netzDemoPfad("vorsorge") + (en ? "&lang=en" : "");
  const alsKarte = (xs: string[], s: NetzSymbol): NetzKarte[] => xs.map((titel) => ({ s, titel, text: "" }));
  return (
    <Dunkel seite="partner" titel={t.metaTitel} beschreibung={t.metaBeschreibung} sprache={sprache}>
      <SeoDaten pfad={P.hub} titel={t.metaTitel} beschreibung={t.metaBeschreibung} fragen={t.fragen} krumen={[{ name: t.krume, pfad: P.hub }]} />
      <div className="pn">
        <Fortschritt />
        <NetzHero bild={BILD.hub} pille={t.pille} a={t.h1a} b={t.h1b} lead={t.lead} chips={t.chips} symbolbild={g.symbolbild}
                  knoepfe={<><Knopf href="#bereiche">{g.alleBereiche}</Knopf><Knopf href={demo} still>{g.demo}</Knopf></>} />
        <Leiste aktiv="hub" en={en} hubText={g.alleBereiche} />

        <section id="bereiche" className="pn-abschnitt">
          <div className="pn-rahmen">
            <Kopf pille={t.bereichePille} a={t.bereicheH2a} b={t.bereicheH2b} lead={t.bereicheLead} />
            <Kacheln en={en} texte={t.bereiche} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <Kopf pille={t.zweiPille} a={t.zweiH2a} b={t.zweiH2b} lead={t.zweiLead} />
            <ZweiSeiten links={{ auge: g.kundenSeite, titel: t.kundeTitel, items: alsKarte(t.kunde, "haken") }}
                        rechts={{ auge: g.partnerSeite, titel: t.partnerTitel, items: alsKarte(t.partner, "stern") }} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <Kopf pille={t.wegPille} a={t.wegH2a} b={t.wegH2b} />
            <Zeitstrahl items={t.weg} />
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <Kopf pille={t.grundPille} a={t.grundH2a} b={t.grundH2b} />
            <Zeig className="pn-grund">
              {t.grund.map((k, i) => <article key={k.titel} style={v(i)} onMouseMove={kegel}><Zeichen s={k.s} /><h3>{k.titel}</h3><p>{k.text}</p></article>)}
            </Zeig>
          </div>
        </section>

        <section className="pn-abschnitt">
          <div className="pn-rahmen">
            <DemoBildschirm href={demo} titel={<>{t.demoH2a}<span className="pn-blau">{t.demoH2b}</span></>} text={t.demoText} punkte={t.demoPunkte} knopf={g.demo} en={en} />
          </div>
        </section>

        <FragenBlock en={en} items={t.fragen} />
        <Bewerbung g={g} bereich={null} en={en} />
        <Schluss a={t.abschlussA} b={t.abschlussB} text={t.abschlussText}
                 knoepfe={<><Knopf href="#bewerbung">{g.bewerben}</Knopf><Knopf href="#bereiche" still>{g.alleBereiche}</Knopf></>} />
      </div>
    </Dunkel>
  );
}
