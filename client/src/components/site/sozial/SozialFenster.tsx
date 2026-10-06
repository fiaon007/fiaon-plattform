// ═══════════════════════════════════════════════════════════════════════════
// DAS SOCIAL-FENSTER (E-296, 06.10.2026)
//
// Justin: „zeig unsere Social Media Profile … auf der Startseite vielleicht
// Karussels, iPhone MockUp und innen der Feed … das überall ein wenig Leben
// reinkommt, aber eben mit coolen modernen Animationen“.
//
// Ein Abschnitt, zwei Looks:
//   · „dunkel“  — Startseite, /privatkunden, /en/personal (dunkle Bühne)
//   · „kanzlei“ — /business, /en/business (Papierweiß, Haarlinien, Serife)
// Drei Zustände:
//   · mit Beiträgen: ein iPhone aus CSS mit dem Profil @fiaon.ltd — Ring,
//     Name, „Folgen“ (KEINE Beitragszahl: die echte steht nur auf Instagram,
//     Prüfung 06.10.2026) —, darin das Raster, das langsam nach oben treibt
//     (nur im Bild, nie bei Hover/Fokus/weniger Bewegung, abschaltbar über
//     „Bewegung anhalten“, WCAG 2.2.2); daneben (am Handy darunter) die
//     neuesten Beiträge als Karten. Im Feed stehen nur Beiträge, die auf
//     Instagram als veröffentlicht gemeldet sind (Vertrag).
//   · ohne Beiträge (Stand heute in Produktion): kein Handy, nur die beiden
//     Profile als Band — nichts, was so tut, als gäbe es Inhalte.
//   · solange der Feed lädt: dasselbe Band, aber unsichtbar (Platz gehalten,
//     kein falscher Inhalt, kein Springen im leeren Fall). Die Einblendung
//     läuft erst zum tatsächlich gezeigten Inhalt.
// Klick auf Kachel oder Karte: die große Ansicht auf der Seite (SozialAnsicht)
// mit Folien, Text, KI-Hinweis und dem Link zum echten Post.
//
// Bewegung nur über transform, opacity, clip-path; Schleifen laufen nur im
// Bild und bei sichtbarem Tab (beobachteSichtbar); „weniger Bewegung“ zeigt
// den Endzustand ohne Schleife. Der Ring dreht sich einmal (unter 5 s).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FocusEvent, type ReactNode } from "react";
import type { SozialFeedMarke, SozialFeedPost } from "@shared/fiaon-sozial-feed";
import type { SozialesProfil } from "@shared/fiaon-sozial";
import { useWoerter } from "@/i18n/sprache";
import { SOZIAL_WOERTER, type SozialWoerter } from "@/i18n/sozial";
import { beobachteSichtbar, ruhigGewuenscht, useEinmalSichtbar, useNeigung } from "@/components/site/global/bewegung";
import { anzeigeText, bildMasse, sozialDatum, useSozialFeed } from "./sozial-daten";
import { SozialAnsicht, type SozialAussehen } from "./SozialAnsicht";
import { KanalZeichen, KarussellZeichen, KettenZeichen, NachAussenZeichen, PfeilZeichen, Profilbild, RasterZeichen, ReelZeichen, Statusleiste, UnterleisteZeichen } from "./SozialZeichen";
import { SozialBild } from "./SozialBild";
import "@/styles/sozial-fenster.css";

/** Wie viele Karten das Karussell höchstens zeigt — die neuesten. */
const KARTEN_MAX = 8;
/** Ab so vielen Kacheln treibt das Raster (drei volle Reihen füllen den Bildschirm des Handys). */
const TREIBEN_AB = 9;

const neuesteZuerst = (a: SozialFeedPost, b: SozialFeedPost) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : b.id - a.id);
/** Gemerkt je Besucher: „Bewegung anhalten“ (nur Bequemlichkeit — ohne Speicher läuft es eben wieder). */
const BEWEGUNG_SCHLUESSEL = "fiaon-sozial-bewegung";

/**
 * Was ein Screenreader zu einem Beitrag hört (Prüfung 06.10.2026): „Beitrag ansehen: <Titel>, Karussell, Mit KI
 * erstellt“. Der Titel steht in der Sprache des Beitrags (lang="de" auf den englischen Seiten, WCAG 3.1.2), der
 * KI-Hinweis gehört in den Namen (Art. 50 KI-VO) — nicht nur sichtbar an der Kachel.
 */
function Vorlesen({ p, w }: { p: SozialFeedPost; w: SozialWoerter }) {
  const art = p.format === "karussell" && p.bilder.length > 1 ? w.karussell : p.format === "reel" ? w.reel : "";
  return (
    <>
      <span className="sz-unsichtbar">{w.ansehenVor} </span>
      <span className="sz-unsichtbar" lang={w.inhaltLang || undefined}>{anzeigeText(p.titel)}</span>
      {art && <span className="sz-unsichtbar">, {art}</span>}
      {p.ki && <span className="sz-unsichtbar">, {w.kiHinweis}</span>}
    </>
  );
}

// ── Die Kachel im Handy ─────────────────────────────────────────────────────
function Kachel({ p, w, onOeffnen, doppel, i }: { p: SozialFeedPost; w: SozialWoerter; onOeffnen: (p: SozialFeedPost) => void; doppel?: boolean; i: number }) {
  const b = p.bilder[0].klein;
  const m = bildMasse(b);
  const inhalt = (
    <>
      <SozialBild src={b.url} width={m.width} height={m.height} />
      {p.format === "karussell" && p.bilder.length > 1 && <span className="sz-art" aria-hidden="true"><KarussellZeichen groesse={13} /></span>}
      {p.format === "reel" && <span className="sz-art" aria-hidden="true"><ReelZeichen groesse={13} /></span>}
      {/* Oben links: Im stehenden Raster ist der obere Teil jeder Kachel sichtbar, im treibenden taucht er zuerst auf. */}
      {p.ki && <span className="sz-ki" aria-hidden="true">{w.kiHinweis}</span>}
    </>
  );
  const stil = { ["--i" as string]: i } as CSSProperties;
  // Die zweite Hälfte der Schleife ist nur Bild: kein Tab-Halt, kein zweites Vorlesen.
  if (doppel) return <span className="sz-kachel" style={stil} aria-hidden="true">{inhalt}</span>;
  return <button type="button" className="sz-kachel" style={stil} onClick={() => onOeffnen(p)}>{inhalt}<Vorlesen p={p} w={w} /></button>;
}

// ── Das Handy ───────────────────────────────────────────────────────────────
function Handy({ posts, profile, w, aussehen, onOeffnen }: { posts: SozialFeedPost[]; profile: SozialesProfil[]; w: SozialWoerter; aussehen: SozialAussehen; onOeffnen: (p: SozialFeedPost) => void }) {
  const neigung = useRef<HTMLDivElement>(null);
  const fenster = useRef<HTMLDivElement>(null);
  useNeigung(neigung);
  const ig = profile.find((x) => x.kanal === "instagram");
  const fb = profile.find((x) => x.kanal === "facebook");
  // Treiben nur mit drei vollen Reihen (sonst bliebe unten eine Lücke in der Schleife) — 9 oder 12 Kacheln.
  const treibt = posts.length >= TREIBEN_AB;
  const satz = treibt ? posts.slice(0, Math.floor(Math.min(posts.length, 12) / 3) * 3) : posts.slice(0, 12);
  const reihen = Math.ceil(satz.length / 3);
  // WCAG 2.2.2: Was sich länger als fünf Sekunden von selbst bewegt, lässt sich anhalten — sichtbar, für alle.
  const [angehalten, setAngehalten] = useState(() => { try { return localStorage.getItem(BEWEGUNG_SCHLUESSEL) === "aus"; } catch { return false; } });
  const umschalten = () => setAngehalten((a) => {
    try { if (a) localStorage.removeItem(BEWEGUNG_SCHLUESSEL); else localStorage.setItem(BEWEGUNG_SCHLUESSEL, "aus"); } catch { /* ohne Speicher */ }
    return !a;
  });
  // Der Knopf hält auch das selbst blätternde Karussell an (Reihe liest denselben Schlüssel) — darum schon ab zwei Beiträgen.
  const knopfZeigen = (treibt || posts.length >= 2) && !ruhigGewuenscht();
  // Tastatur im treibenden Raster (WCAG 2.4.7/2.4.11): Fokus hält das Treiben an (CSS: animation none, das Raster
  // steht oben) und holt die Kachel ins Fenster; wer das Fenster verlässt, bekommt es wieder von oben.
  const beimFokus = (e: FocusEvent<HTMLDivElement>) => {
    const ziel = e.target as HTMLElement;
    requestAnimationFrame(() => ziel.scrollIntoView?.({ block: "nearest", inline: "nearest" }));
  };
  const beimVerlassen = (e: FocusEvent<HTMLDivElement>) => {
    if (fenster.current && !fenster.current.contains(e.relatedTarget as Node | null)) fenster.current.scrollTop = 0;
  };
  return (
    <div className={`sz-handy-ort${treibt ? " treibt" : ""}`} data-angehalten={angehalten ? "1" : undefined}>
      <div className="sz-schein" aria-hidden="true" />
      <div ref={neigung} className="sz-neigung">
        <div className="sz-handy" role="group" aria-label={w.handyLabel}>
          <span className="sz-taste a" aria-hidden="true" /><span className="sz-taste b" aria-hidden="true" /><span className="sz-taste c" aria-hidden="true" /><span className="sz-taste d" aria-hidden="true" />
          <div className="sz-schirm">
            <div className="sz-schirm-inhalt">
              <Statusleiste />
              <div className="sz-oben" aria-hidden="true">
                <b>fiaon.ltd</b>
                <span className="sz-oben-rechts"><UnterleisteZeichen art="neu" /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></span>
              </div>
              <div className="sz-profilkopf">
                <Profilbild groesse={62} />
                {/* Keine Zahl der Beiträge: Die echte steht nur auf Instagram — eine Zahl an dieser Stelle läse sich als Profil-Kennzahl. */}
                <div className="sz-profil-zahlen">
                  <b className="sz-profil-name">{aussehen === "kanzlei" ? w.profilNameKanzlei : w.profilName}</b>
                </div>
              </div>
              <div className="sz-bio">
                <small>{w.kategorie}</small>
                {aussehen !== "kanzlei" && <p>{w.bio}</p>}
                <span className="sz-bio-link"><KettenZeichen /> fiaon.com</span>
              </div>
              <div className="sz-profil-knoepfe">
                {ig && <a className="sz-folgen" href={ig.href} target="_blank" rel="noopener noreferrer" aria-label={w.folgenAria}>{w.folgen}</a>}
                {fb && <a className="sz-zweit" href={fb.href} target="_blank" rel="noopener noreferrer" aria-label={w.facebookAria}>{w.facebook}</a>}
              </div>
              <div className="sz-reiter" aria-hidden="true"><span className="an"><RasterZeichen /></span><span><UnterleisteZeichen art="reels" /></span></div>
              <div ref={fenster} className={`sz-raster-fenster${treibt ? " treibt" : ""}`} onFocus={beimFokus} onBlur={beimVerlassen}>
                <div className="sz-spur" style={{ ["--sz-dauer" as string]: `${reihen * 6.5}s` } as CSSProperties}>
                  <div className="sz-raster">{satz.map((p, i) => <Kachel key={p.id} p={p} w={w} onOeffnen={onOeffnen} i={i} />)}</div>
                  {treibt && <div className="sz-raster" aria-hidden="true">{satz.map((p, i) => <Kachel key={`d${p.id}`} p={p} w={w} onOeffnen={onOeffnen} doppel i={i} />)}</div>}
                </div>
                {/* Wenige Beiträge: kein leerer Bildschirm, sondern der Weg zu allen — wie Instagram unter einem jungen Profil. */}
                {!treibt && ig && (
                  <a className="sz-mehr" href={ig.href} target="_blank" rel="noopener noreferrer">
                    <span className="sz-mehr-ring" aria-hidden="true"><KanalZeichen kanal="instagram" /></span>
                    <b>{w.mehrTitel}</b>
                    <span className="blau">{w.mehrLink}</span>
                  </a>
                )}
              </div>
              <div className="sz-unterleiste" aria-hidden="true">
                <UnterleisteZeichen art="start" /><UnterleisteZeichen art="suche" /><UnterleisteZeichen art="neu" /><UnterleisteZeichen art="reels" /><Profilbild groesse={22} ring={false} className="klein" />
              </div>
              <span className="sz-heimbalken" aria-hidden="true" />
            </div>
            <span className="sz-glanz" aria-hidden="true" />
          </div>
        </div>
      </div>
      {knopfZeigen && (
        <button type="button" className="sz-bewegung" onClick={umschalten}>
          <span className="sz-bewegung-zeichen" aria-hidden="true">{angehalten ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1.8v8.4L10 6z" /></svg> : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><rect x="2.4" y="2" width="2.4" height="8" rx=".6" /><rect x="7.2" y="2" width="2.4" height="8" rx=".6" /></svg>}</span>
          {angehalten ? w.bewegungAn : w.bewegungAus}
        </button>
      )}
    </div>
  );
}

// ── Die Karten der neuesten Beiträge ───────────────────────────────────────
function Karte({ p, w, onOeffnen, i }: { p: SozialFeedPost; w: SozialWoerter; onOeffnen: (p: SozialFeedPost) => void; i: number }) {
  const textId = useId();
  const nameId = useId();
  const b = p.bilder[0].klein;
  const m = bildMasse(b);
  const datum = sozialDatum(p.datum, w.locale);
  const stil = { ["--i" as string]: i } as CSSProperties;
  return (
    <li className="sz-karte" style={stil}>
      <button type="button" className="sz-karte-flaeche" onClick={() => onOeffnen(p)} aria-labelledby={nameId} aria-describedby={textId}>
        <span className="sz-karte-kopf" aria-hidden="true"><Profilbild groesse={24} ring={false} /><b>fiaon.ltd</b>{datum && <time dateTime={p.datum}>{datum}</time>}</span>
        <span className="sz-karte-bild">
          <SozialBild src={b.url} width={m.width} height={m.height} />
          {p.format === "karussell" && p.bilder.length > 1 && <span className="sz-art" aria-hidden="true"><KarussellZeichen groesse={15} /></span>}
          {p.format === "reel" && <span className="sz-art" aria-hidden="true"><ReelZeichen groesse={15} /></span>}
          {p.ki && <span className="sz-ki" aria-hidden="true">{w.kiHinweis}</span>}
        </span>
        <span id={textId} className="sz-karte-text" lang={w.inhaltLang || undefined}>{anzeigeText(p.text || p.titel)}</span>
        <span className="sz-karte-mehr" aria-hidden="true">{w.ansehen}<PfeilZeichen groesse={14} /></span>
        <span id={nameId} className="sz-unsichtbar"><Vorlesen p={p} w={w} /></span>
      </button>
    </li>
  );
}

function Reihe({ posts, w, onOeffnen }: { posts: SozialFeedPost[]; w: SozialWoerter; onOeffnen: (p: SozialFeedPost) => void }) {
  const spur = useRef<HTMLUListElement>(null);
  const balken = useRef<HTMLElement>(null);
  const [rand, setRand] = useState({ anfang: true, ende: posts.length < 2 });
  useEffect(() => {
    const s = spur.current; if (!s) return;
    let raf = 0;
    const lesen = () => {
      raf = 0;
      const max = Math.max(0, s.scrollWidth - s.clientWidth);
      const anteil = s.scrollWidth > 0 ? Math.min(1, s.clientWidth / s.scrollWidth) : 1;
      const pos = max > 0 ? s.scrollLeft / max : 0;
      // Der Fortschritt ist ein Balken, der wandert (transform) — keine Breite, kein Layout.
      if (balken.current) { balken.current.style.setProperty("--anteil", anteil.toFixed(4)); balken.current.style.setProperty("--pos", pos.toFixed(4)); }
      setRand((r) => { const n = { anfang: s.scrollLeft < 4, ende: s.scrollLeft > max - 4 }; return r.anfang === n.anfang && r.ende === n.ende ? r : n; });
    };
    const beim = () => { if (!raf) raf = requestAnimationFrame(lesen); };
    lesen();
    s.addEventListener("scroll", beim, { passive: true });
    window.addEventListener("resize", beim);
    return () => { s.removeEventListener("scroll", beim); window.removeEventListener("resize", beim); if (raf) cancelAnimationFrame(raf); };
  }, [posts.length]);
  const blaettern = (richtung: 1 | -1) => {
    const s = spur.current; if (!s) return;
    const karte = s.querySelector<HTMLElement>(".sz-karte");
    const schritt = karte ? karte.getBoundingClientRect().width + parseFloat(getComputedStyle(s).columnGap || "16") : s.clientWidth * 0.8;
    s.scrollBy({ left: richtung * schritt, behavior: ruhigGewuenscht() ? "auto" : "smooth" });
  };
  // 06.10.2026 abends (Justin: „präsenter … Karussell“): Das Karussell blättert von selbst, alle 4,5 s eine Karte, am Ende
  // weich zurück zum Anfang. Nie bei „weniger Bewegung“, nie außer Sicht oder im Hintergrund-Tab, nie solange Zeiger oder
  // Fokus darauf liegen, 9 s Ruhe nach jedem Wischen/Klicken — und aus, wenn „Bewegung anhalten“ gedrückt ist (WCAG 2.2.2).
  useEffect(() => {
    const s = spur.current;
    if (!s || posts.length < 2 || ruhigGewuenscht()) return;
    let darauf = false, zuletzt = 0;
    const an = () => { darauf = true; };
    const ab = () => { darauf = false; };
    const beruehrt = () => { zuletzt = Date.now(); };
    s.addEventListener("pointerenter", an); s.addEventListener("pointerleave", ab);
    s.addEventListener("focusin", an); s.addEventListener("focusout", ab);
    s.addEventListener("pointerdown", beruehrt); s.addEventListener("wheel", beruehrt, { passive: true });
    s.addEventListener("touchstart", beruehrt, { passive: true });
    const takt = window.setInterval(() => {
      if (darauf || Date.now() - zuletzt < 9000 || document.visibilityState !== "visible") return;
      if (s.closest(".sz")?.getAttribute("data-laeuft") !== "1") return;
      try { if (localStorage.getItem(BEWEGUNG_SCHLUESSEL) === "aus") return; } catch { /* ohne Speicher: läuft */ }
      const max = s.scrollWidth - s.clientWidth;
      if (max <= 4) return;
      if (s.scrollLeft >= max - 4) s.scrollTo({ left: 0, behavior: "smooth" }); else blaettern(1);
    }, 4500);
    return () => {
      window.clearInterval(takt);
      s.removeEventListener("pointerenter", an); s.removeEventListener("pointerleave", ab);
      s.removeEventListener("focusin", an); s.removeEventListener("focusout", ab);
      s.removeEventListener("pointerdown", beruehrt); s.removeEventListener("wheel", beruehrt);
      s.removeEventListener("touchstart", beruehrt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);
  return (
    <div className="sz-reihe-ort" data-fest={rand.anfang && rand.ende ? "1" : undefined} data-weiter={rand.anfang ? undefined : "1"}>
      <div className="sz-reihe-kopf">
        <span className="sz-reihe-titel">{w.neueste}</span>
        <span className="sz-reihe-knoepfe">
          <button type="button" onClick={() => blaettern(-1)} disabled={rand.anfang} aria-label={w.zurueck}><PfeilZeichen richtung="links" /></button>
          <button type="button" onClick={() => blaettern(1)} disabled={rand.ende} aria-label={w.weiter}><PfeilZeichen /></button>
        </span>
      </div>
      <ul ref={spur} className="sz-reihe" tabIndex={0} aria-label={w.reiheLabel}
          onKeyDown={(e) => { if (e.target !== e.currentTarget) return; if (e.key === "ArrowRight") { e.preventDefault(); blaettern(1); } else if (e.key === "ArrowLeft") { e.preventDefault(); blaettern(-1); } }}>
        {posts.map((p, i) => <Karte key={p.id} p={p} w={w} onOeffnen={onOeffnen} i={i} />)}
      </ul>
      <span className="sz-fortschritt" aria-hidden="true"><i ref={balken} /></span>
    </div>
  );
}

// ── Die Profile (immer sichtbar; ohne Beiträge sind sie der ganze Abschnitt) ──
function ProfilLinks({ profile, w, gross }: { profile: SozialesProfil[]; w: SozialWoerter; gross?: boolean }) {
  return (
    <ul className={`sz-profile${gross ? " gross" : ""}`} aria-label={w.profileLabel}>
      {profile.map((p, i) => (
        <li key={p.kanal} style={{ ["--i" as string]: i } as CSSProperties}>
          {/* Ohne aria-label: Der sichtbare Text („Instagram @fiaon.ltd Profil öffnen“) ist der Name (WCAG 2.5.3). */}
          <a className="sz-profil" href={p.href} target="_blank" rel="noopener noreferrer">
            {gross
              ? <span className="sz-profil-bild"><Profilbild groesse={58} /><span className="sz-profil-kanal" aria-hidden="true"><KanalZeichen kanal={p.kanal} groesse={13} /></span></span>
              : <span className="sz-profil-glyphe"><KanalZeichen kanal={p.kanal} groesse={17} /></span>}
            <span className="sz-profil-text">
              <small>{p.name}</small>
              <b>{p.handle}</b>
              {gross && <span className="sz-profil-aktion">{w.profilAktion[p.kanal]}<PfeilZeichen groesse={14} /></span>}
            </span>
            {!gross && <NachAussenZeichen className="sz-profil-pfeil" />}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Titel({ aussehen, a, b, id }: { aussehen: SozialAussehen; a: string; b: string; id: string }): ReactNode {
  return aussehen === "kanzlei"
    ? <h2 id={id} className="fg-h2">{a}<em>{b}</em></h2>
    : <h2 id={id} className="dk-h2">{a}<span className="dk-verlauf">{b}</span></h2>;
}

/**
 * Der Abschnitt. `marke`: welche Beiträge (Startseite „alle“, Privat „fiaon“, Business „global“);
 * `ersatz` + `mindestens`: Rückfall, wenn die Marke zu wenige hat (Privat: unter drei → „alle“). Business hat
 * KEINEN Rückfall — die Business-Welt zeigt nie Privatthemen wie Bonität oder P-Konto (E-192, Prüfung 06.10.2026).
 */
export function SozialFenster({ aussehen, marke, ersatz, mindestens = 1, id = "social" }: { aussehen: "dunkel" | "kanzlei"; marke: SozialFeedMarke; ersatz?: SozialFeedMarke; mindestens?: number; id?: string }) {
  const w = useWoerter(SOZIAL_WOERTER);
  const ref = useRef<HTMLElement>(null);
  const titelId = useId();
  const ohne = useRef<HTMLElement>(null);
  const daten = useSozialFeed(ref, { marke, n: 12, ersatz, mindestens });
  const [offen, setOffen] = useState<SozialFeedPost | null>(null);
  // Die Einblendung gilt dem, was wirklich kommt (Band oder Handy) — nicht dem unsichtbaren Platzhalter beim Laden.
  const bereit = daten.stand !== "wartet";
  useEinmalSichtbar(bereit ? ref : ohne, 0, "0px 0px -18% 0px");
  // Schleifen (Raster, Ring, Schein) laufen nur, solange der Abschnitt im Bild und der Tab sichtbar ist.
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (ruhigGewuenscht()) { el.setAttribute("data-laeuft", "0"); return; }
    return beobachteSichtbar(el, (an) => el.setAttribute("data-laeuft", an ? "1" : "0"));
  }, []);

  const voll = daten.stand === "voll";
  const karten = useMemo(() => [...daten.posts].sort(neuesteZuerst).slice(0, KARTEN_MAX), [daten.posts]);
  const kanzlei = aussehen === "kanzlei";
  const klasse = `sz sz-${aussehen}${voll ? " sz-voll" : " sz-leer"} ${kanzlei ? `fg-sek${voll ? "" : " eng"}` : `dk-block${voll ? "" : " eng"}`}`;
  const rahmen = kanzlei ? "fg-rahmen" : "dk-rahmen";

  return (
    <section ref={ref} id={id} className={klasse} data-stand={daten.stand} aria-labelledby={titelId} style={{ scrollMarginTop: 72 }}>
      <div className={rahmen}>
        {!voll ? (
          <div className="sz-band" aria-hidden={bereit ? undefined : true}>
            <div className="sz-band-text">
              {kanzlei ? <span className="fg-auge">{w.leer.pille}</span> : <span className="dk-pille">{w.leer.pille}</span>}
              <Titel aussehen={aussehen} a={w.leer.h2a} b={w.leer.h2b} id={titelId} />
              <p className={kanzlei ? "fg-lead" : "dk-lead"}>{kanzlei ? w.leer.textKanzlei : w.leer.textDunkel}</p>
            </div>
            <ProfilLinks profile={daten.profile} w={w} gross />
          </div>
        ) : (
          <div className="sz-buehne">
            <div className="sz-kopf">
              <div className="sz-kopf-a">
                {kanzlei ? <span className="fg-auge">{w.kanzlei.auge}</span> : <span className="dk-pille">{w.dunkel.pille}</span>}
                {kanzlei
                  ? <Titel aussehen={aussehen} a={w.kanzlei.h2a} b={w.kanzlei.h2b} id={titelId} />
                  : <Titel aussehen={aussehen} a={w.dunkel.h2a} b={w.dunkel.h2b} id={titelId} />}
              </div>
              <div className="sz-kopf-b">
                <p className={kanzlei ? "fg-lead" : "dk-lead"}>{kanzlei ? (daten.marke === "global" ? w.kanzlei.leadGlobal : w.kanzlei.leadAlle) : w.dunkel.lead}</p>
                <ProfilLinks profile={daten.profile} w={w} />
              </div>
            </div>
            <Handy posts={daten.posts} profile={daten.profile} w={w} aussehen={aussehen} onOeffnen={setOffen} />
            <Reihe posts={karten} w={w} onOeffnen={setOffen} />
          </div>
        )}
      </div>
      {offen && <SozialAnsicht post={offen} w={w} aussehen={aussehen} onSchliessen={() => setOffen(null)} />}
    </section>
  );
}

export default SozialFenster;
