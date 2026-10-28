// ═══════════════════════════════════════════════════════════════════════════
// DIE GLAS-BÜHNE — der Hero von /business (E-442, 27.10.2026)
//
// Justin (27.10., mit dem Bild des Chefbüro-Sperrbildschirms): „Wir brauchen
// Apple Glas, Animationen, clean — mehr Abstände — mehr WOW — baue es im Apple
// Stil, wie hier die Zahlen in unserem Admin-Dashboard.“ Und direkt danach:
// „aber nicht mit dem Berg-Hintergrund — CLEAN!“
//
// Also: kein Film, kein Foto. Die Bühne ist der helle, ruhige Glasgrund der
// Seite selbst — eine kleine Zeile, EINE riesige dünne Zahl mit Glanz (der
// Festpreis „ab 2.499 €“), darunter in Kapitälchen der Satz dazu (einmalig,
// alle Gebühren des Pakets inklusive), die Überschrift dünn, zwei Pillen,
// drei Milchglas-Widgets: Kapitalrahmen (mit „das Institut entscheidet“,
// Blickfang-Regel), das Team im Wechsel (shared/fiaon-global-team.ts) und die
// Vertrauensleiste als Vertrag-Widget. Alle Sätze kommen aus i18n/global.ts —
// die Wortwand liest sie dort; hier steht kein eigener deutscher Satz.
//
// Auftakt erst nach dem Ladebildschirm (nachLadebild), gestaffelt; danach
// steht alles — nur der Glanz zieht alle neun Sekunden über die Zahl.
// Bei „weniger Bewegung“ steht sofort das Endbild.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { beobachteSichtbar, nachLadebild, ruhigGewuenscht, useEinmalSichtbar, useRuhig } from "@/components/site/global/bewegung";
import { KI_PORTRAIT_HINWEIS, portraitMitKi } from "@shared/fiaon-portraits";
import { GLOBAL_TEAM, GLOBAL_TEAM_TAKT_MS, teamFoto } from "@shared/fiaon-global-team";
import "@/styles/global-hero-glas.css";

export interface HeroGlasTexte {
  /** Die kleine Zeile über der Zahl (die Augenzeile der Seite, ggf. mit Link). */
  auge: ReactNode;
  /** „ab“ */
  ab: string;
  /** „2.499 €“ (aus dem Katalog) */
  preis: string;
  /** Der Satz zur Zahl, in Kapitälchen: „Festpreis · Einmalig, alle Gebühren des Pakets inklusive“ */
  label: string;
  h1a: string;
  h1b: string;
  /** Die Sätze, die sich in der zweiten Zeile selbst tippen (ohne: h1b steht still). */
  wechsel?: string[];
  /** Der Lead-Satz der Seite (mit antippbaren Begriffen). */
  lead: ReactNode;
  knopfPakete: string;
  knopfGespraech: string;
  mikro: string;
  kapitalTitel: string;
  kapitalWert: string;
  kapitalSatz: string;
  /** „Auch in Europa einsetzbar“ mit Fußnotennummer */
  kapitalFrei: string;
  fussnoteNr: number;
  fussnote: string;
  personTitel: string;
  /** „Ihr Team“ — die Kachel zeigt das ganze Team im Wechsel (Justin 28.10.). */
  teamTitel: string;
  /** Fußnote zu den Fotos: „Teamfotos teils Symbolbilder, mit KI erstellt.“ */
  teamHinweis: string;
  /** Beschriftung des Foto-Knopfs: „Wechsel anhalten“ / „Wechsel fortsetzen“. */
  teamAnhalten: string;
  teamFortsetzen: string;
  /** Kleine Zeile über der Vertragsliste („Ihr Vertrag“) — wie bei den beiden anderen Kacheln. */
  vertragTitel: string;
  /** Vier Zeilen der Vertrauensleiste; die zweite verlinkt den Mustervertrag. */
  vertrag: string[];
  mustervertragHref: string;
  /** Beschriftung des Winkels nach unten (aria-label). */
  weiter: string;
  /** Name des Abschnitts mit den drei Kacheln (für Screenreader, „Auf einen Blick“). */
  blickName: string;
}

/** Wie viele Zeichen zwei Sätze vorn teilen — „Ihr Weg “ bleibt stehen, nur der Rest wird gelöscht und neu getippt. */
function gemeinsam(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * DIE TIPP-ZEILE (E-442, 28.10.2026) — Justin: „Den Weg zum Kapital planen. — da muss eine Animation her, mit Tipp-Animation:
 * ‚Ihr Weg zum Kapital‘, ‚Ihr Weg zur US-Gesellschaft‘, ‚Ihr Weg in das US-Finanzsystem‘ …“
 * Ablauf: Satz steht 2,6 s → nur der Teil hinter dem gemeinsamen Anfang wird gelöscht (28 ms je Zeichen) → kurze Pause →
 * der nächste Satz tippt sich (52 ms je Zeichen, leicht unregelmäßig wie von Hand). Der Strich blinkt nur, solange der Satz steht.
 * Die Zeile reserviert ihren Platz mit allen Sätzen unsichtbar übereinander — nichts darunter springt.
 * Läuft nur, wenn die Bühne im Bild und der Tab vorn ist; bei „weniger Bewegung“ steht der erste Satz still, ohne Strich.
 * Für Screenreader und Suchmaschinen steht die ruhige Fassung (h1b) unsichtbar in der Überschrift; die Tipp-Zeile ist aria-hidden
 * und steht AUSSERHALB der h1 (sonst läsen Crawler alle Sätze als Überschrift).
 */
function TippZeile({ saetze, startbereit }: { saetze: string[]; startbereit: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [stand, setStand] = useState({ i: 0, n: saetze[0]?.length ?? 0, tippt: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || !startbereit || saetze.length < 2 || ruhigGewuenscht()) return;
    let i = 0, n = saetze[0].length, modus: "halten" | "loeschen" | "pause" | "tippen" = "halten";
    let uhr = 0, sichtbar = false;
    const zeigen = (tippt: boolean) => setStand({ i, n, tippt });
    const plan = (ms: number) => { uhr = window.setTimeout(() => { uhr = 0; schritt(); }, ms); };
    const schritt = () => {
      if (!sichtbar) return;
      const naechster = (i + 1) % saetze.length;
      const bis = gemeinsam(saetze[i], saetze[naechster]);
      if (modus === "halten") { modus = "loeschen"; zeigen(false); plan(2600); return; }
      if (modus === "loeschen") {
        if (n > bis) { n--; zeigen(true); plan(28); return; }
        modus = "pause"; plan(360); return;
      }
      if (modus === "pause") { i = naechster; modus = "tippen"; zeigen(true); plan(90); return; }
      const satz = saetze[i];
      if (n < satz.length) { n++; zeigen(true); plan(satz[n - 1] === " " ? 90 : 40 + ((n * 37) % 30)); return; }
      modus = "halten"; zeigen(false); schritt();
    };
    const weg = beobachteSichtbar(el, (s) => {
      sichtbar = s;
      if (!s) { window.clearTimeout(uhr); uhr = 0; return; }
      if (uhr) return;
      // Unterbrochen, während der Satz stand (weggescrollt, Tab hinten)? Dann erst wieder ganz halten, nicht sofort löschen.
      if (modus === "loeschen" && n === saetze[i].length) { zeigen(false); plan(2600); } else schritt();
    });
    return () => { weg(); window.clearTimeout(uhr); };
  }, [saetze, startbereit]);
  // „Ihr Weg “ steht ruhig in Navy, nur das wechselnde Ende leuchtet in Glasblau.
  const fest = saetze.reduce((p, s) => Math.min(p, gemeinsam(saetze[0], s)), saetze[0]?.length ?? 0);
  const satz = saetze[stand.i] ?? "";
  const text = satz.slice(0, stand.n);
  // Der noch nicht getippte Rest steht unsichtbar dahinter: So gelten immer die Umbrüche und die Breite des FERTIGEN Satzes —
  // nichts bricht beim Tippen neu um, und „Ihr Weg “ wandert nicht mit jedem Zeichen zur Seite (Gegenprüfung 28.10.).
  return (
    <div ref={ref} className="hg-tipp" aria-hidden="true">
      {saetze.map((s) => <span key={s} className="hg-tipp-mass">{s}</span>)}
      <span className="hg-tipp-text">
        <span className="fest">{text.slice(0, fest)}</span><span className="wechsel">{text.slice(fest)}</span>
        <i className={`hg-tipp-strich${stand.tippt ? "" : " blinkt"}`} /><span className="hg-tipp-rest">{satz.slice(stand.n)}</span>
      </span>
    </div>
  );
}

// ── „Ihr Team“ (Justin 28.10.2026): Die Kachel zeigt das ganze Team im Wechsel — Daniel, Florentine, Justin, Mag. Sarah
// Anderst und alle weiteren (shared/fiaon-global-team.ts). Jede Person steht 2,4 s; ein feiner Glasblau-Ring um das Foto
// zeigt, wann die nächste kommt — sein Ende (animationend) löst den Wechsel aus, so bleiben Ring und Wechsel immer gleich.
// Foto und Zeilen blenden weich über (alt nach oben, neu von unten, Apple-artig). Alle Personen liegen übereinander im
// selben Raster: Die Kachel ist immer so hoch wie der längste Eintrag, nichts springt.
// Gegenprüfung 28.10.: Start erst, wenn die Kachel aufgetaucht ist (Daniel zuerst, volle 2,4 s); Pause bei Maus darüber,
// bei Tastatur-Fokus (nicht nach Klick/Tippen — sonst blieb der Wechsel nach dem Pfeil für immer stehen), außer Sicht
// und Tab hinten; das Foto ist ein Knopf „Wechsel anhalten / fortsetzen“ (WCAG 2.2.2, auch am Telefon). Justins
// KI-Porträt trägt den Hinweis am Bild (wie auf /team), die Fußnote nennt alle Fotos genau. Screenreader lesen die ganze
// Liste einmal. Bei „weniger Bewegung“ (auch später umgeschaltet): kein Wechsel, Daniel als Ansprechpartner.
type TeamTexte = { titel: string; titelRuhig: string; nr: number; knopf: string; anhalten: string; fortsetzen: string };
function TeamKachel({ en, ruhig, x, onGespraech }: { en: boolean; ruhig: boolean; x: TeamTexte; onGespraech: () => void }) {
  const sp = en ? "en" : "de";
  const [i, setI] = useState(0);
  const [vorher, setVorher] = useState(-1);
  const [lauf, setLauf] = useState(false);
  const [angehalten, setAngehalten] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || ruhig) return;
    let sicht = false, maus = false, fokus = false;
    // Erst wenn der Abschnitt aufgetaucht und die Kachel fertig hochgeglitten ist (hg-hoch), beginnt der Takt.
    const blick = el.closest(".hg-blick");
    let offen = !blick || blick.getAttribute("data-an") === "1";
    const pruefen = () => setLauf(offen && sicht && !maus && !fokus);
    let warte = 0;
    const aufgetaucht = () => { if (offen) return; offen = true; window.clearTimeout(warte); pruefen(); };
    const perEnde = (e: AnimationEvent) => { if (e.target === el && e.animationName === "hg-hoch") aufgetaucht(); };
    el.addEventListener("animationend", perEnde);
    const mo = new MutationObserver(() => {
      if (blick?.getAttribute("data-an") !== "1") return;
      mo.disconnect();
      warte = window.setTimeout(aufgetaucht, 1300); // falls kein animationend kommt
    });
    if (!offen && blick) mo.observe(blick, { attributes: true, attributeFilter: ["data-an"] });
    const weg = beobachteSichtbar(el, (s) => { sicht = s; if (!s) fokus = false; pruefen(); });
    const rein = () => { maus = true; pruefen(); }, raus = () => { maus = false; pruefen(); };
    const fRein = (e: FocusEvent) => { fokus = !!(e.target as Element | null)?.matches?.(":focus-visible"); pruefen(); };
    const fRaus = (e: FocusEvent) => { if (!el.contains(e.relatedTarget as Node | null)) { fokus = false; pruefen(); } };
    el.addEventListener("pointerenter", rein); el.addEventListener("pointerleave", raus);
    el.addEventListener("focusin", fRein); el.addEventListener("focusout", fRaus);
    return () => {
      weg(); mo.disconnect(); window.clearTimeout(warte);
      el.removeEventListener("animationend", perEnde);
      el.removeEventListener("pointerenter", rein); el.removeEventListener("pointerleave", raus);
      el.removeEventListener("focusin", fRein); el.removeEventListener("focusout", fRaus);
    };
  }, [ruhig]);
  const weiter = () => { setVorher(i); setI((i + 1) % GLOBAL_TEAM.length); };
  const knopfEl = (
    <button type="button" className="hg-w-knopf" aria-label={x.knopf} onClick={onGespraech}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  );
  if (ruhig) {
    const p = GLOBAL_TEAM[0];
    return (
      <div className="hg-widget hg-w-person" style={{ ["--i" as string]: 1 }}>
        <span className="hg-w-bild"><img className="an" src={teamFoto(p.kuerzel)} alt="" width={54} height={54} loading="lazy" decoding="async" /></span>
        <div className="hg-w-wer"><span className="hg-w-auge">{x.titelRuhig}</span><b>{p.name}</b><small>{p.rolle[sp]}</small></div>
        {knopfEl}
      </div>
    );
  }
  const stand = (k: number) => (k === i ? "an" : k === vorher ? "weg" : undefined);
  const ki = (kuerzel: string) => portraitMitKi(kuerzel) ? KI_PORTRAIT_HINWEIS[sp] : null;
  return (
    <div ref={ref} className="hg-widget hg-w-person hg-w-team" data-lauf={lauf && !angehalten ? "1" : "0"} data-angehalten={angehalten ? "1" : undefined}
      style={{ ["--i" as string]: 1, ["--takt" as string]: `${GLOBAL_TEAM_TAKT_MS}ms` }}>
      <button type="button" className="hg-w-bild" aria-pressed={angehalten} aria-label={angehalten ? x.fortsetzen : x.anhalten}
        onClick={() => setAngehalten((a) => !a)}>
        {GLOBAL_TEAM.map((p, k) => <img key={p.kuerzel} className={stand(k)} src={teamFoto(p.kuerzel)} alt="" title={ki(p.kuerzel) ?? undefined} width={54} height={54} loading="lazy" decoding="async" />)}
        <svg className="hg-w-ring" viewBox="0 0 62 62" aria-hidden="true">
          <circle className="spur" cx="31" cy="31" r="30" />
          <circle key={i} className="lauf" cx="31" cy="31" r="30" pathLength={100} onAnimationEnd={weiter} />
        </svg>
        <span className="hg-w-halt" aria-hidden="true">
          {angehalten
            ? <svg viewBox="0 0 12 12"><path d="M4 2.6v6.8L9.4 6z" /></svg>
            : <svg viewBox="0 0 12 12"><path d="M4 3v6M8 3v6" /></svg>}
        </span>
      </button>
      <div className="hg-w-wer">
        <span className="hg-w-auge">{x.titel}<sup>{x.nr}</sup></span>
        <span className="hg-w-stapel" aria-hidden="true">
          {GLOBAL_TEAM.map((p, k) => (
            <span key={p.kuerzel} className={`hg-w-eintrag${stand(k) ? ` ${stand(k)}` : ""}`}>
              <b>{p.name}</b><small>{p.rolle[sp]}</small>{ki(p.kuerzel) && <small className="hg-w-ki">{ki(p.kuerzel)}</small>}
            </span>
          ))}
        </span>
        <span className="hg-sr">{GLOBAL_TEAM.map((p) => `${p.name}, ${p.rolle[sp]}${ki(p.kuerzel) ? ` (${ki(p.kuerzel)})` : ""}`).join("; ")}.</span>
      </div>
      {knopfEl}
    </div>
  );
}

function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function HeroGlas({ t, en, onPakete, onGespraech }: { t: HeroGlasTexte; en: boolean; onPakete: () => void; onGespraech: () => void }) {
  const [an, setAn] = useState(false);
  // Eine Quelle für Team-Kachel und Fußnote ² (auch wenn „weniger Bewegung“ später umgeschaltet wird).
  const ruhig = useRuhig();
  // E-442 (28.10.2026, Justin): „Man soll nur den Hero am Anfang sehen — erst wenn man scrollt, die Kacheln.“ Die drei
  // Kacheln und die Fußnote stehen darum in einem eigenen Abschnitt UNTER der Bühne und gleiten beim Hineinscrollen hoch.
  const blick = useRef<HTMLElement>(null);
  useEinmalSichtbar(blick, 0, "0px 0px -18% 0px");

  useLayoutEffect(() => {
    if (ruhigGewuenscht()) { setAn(true); return; }
    let raf = 0;
    const weg = nachLadebild(() => { raf = requestAnimationFrame(() => setAn(true)); });
    return () => { weg(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
    <section className="hg" data-an={an ? "1" : "0"}>
      <div className="hg-licht" aria-hidden="true" />
      <div className="hg-inhalt">
        <p className="hg-auge">{t.auge}</p>
        {/* Kein aria-label auf <p> (für die Rolle „paragraph“ verboten) und kein aria-hidden am „ab“: Screenreader lesen „ab 2.499 €“ wie alle. */}
        <p className="hg-zahl"><span className="hg-zahl-ab">{t.ab} </span>{t.preis}</p>
        <p className="hg-label">{t.label}</p>
        {t.wechsel && t.wechsel.length > 1 ? (
          // Die Überschrift trägt nur die ruhigen Sätze (für Suchmaschinen und Screenreader); die Tipp-Zeile steht als eigene,
          // aria-hidden Zeile direkt darunter — sonst stünden alle Mass-Sätze im Text der h1 (Gegenprüfung 28.10.).
          <><h1 className="hg-h1 mit-tipp">{t.h1a} <span className="hg-sr">{t.h1b}</span></h1><TippZeile saetze={t.wechsel} startbereit={an} /></>
        ) : (
          <h1 className="hg-h1">{t.h1a} <em>{t.h1b}</em></h1>
        )}
        {/* Der eine Satz, was im Festpreis steckt — mit den antippbaren Begriffen EIN und ITIN (Prüfung 27.10.: ging mit dem alten Hero verloren). */}
        <p className="hg-lead">{t.lead}</p>
        <div className="hg-pillen">
          <button type="button" className="hg-pille voll" onClick={onPakete}>{t.knopfPakete}<Pfeil /></button>
          <button type="button" className="hg-pille" style={{ ["--i" as string]: 1 }} onClick={onGespraech}>{t.knopfGespraech}</button>
        </div>
        <p className="hg-mikro">{t.mikro}</p>
      </div>

      <a className="hg-weiter" href="#auf-einen-blick" aria-label={t.weiter} onClick={(e) => {
        e.preventDefault();
        // Fokus zuerst in den Abschnitt: Der Winkel blendet beim Scrollen aus — der Fokus fiele sonst auf <body> (Gegenprüfung 28.10.).
        blick.current?.focus({ preventScroll: true });
        blick.current?.scrollIntoView({ behavior: ruhigGewuenscht() ? "auto" : "smooth", block: "start" });
      }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </a>
    </section>

    <section ref={blick} id="auf-einen-blick" className="hg-blick" tabIndex={-1} aria-label={t.blickName} style={{ scrollMarginTop: 96 }}>
        <div className="hg-widgets">
          <div className="hg-widget" style={{ ["--i" as string]: 0 }}>
            <span className="hg-w-auge">{t.kapitalTitel}</span>
            <b>{t.kapitalWert}</b>
            <small>{t.kapitalSatz}</small>
            <span className="hg-w-chip">{t.kapitalFrei}<sup>{t.fussnoteNr}</sup></span>
          </div>
          <TeamKachel en={en} ruhig={ruhig} onGespraech={onGespraech}
            x={{ titel: t.teamTitel, titelRuhig: t.personTitel, nr: t.fussnoteNr + 1, knopf: t.knopfGespraech, anhalten: t.teamAnhalten, fortsetzen: t.teamFortsetzen }} />
          <div className="hg-widget hg-w-vertrag" style={{ ["--i" as string]: 2 }}>
            <span className="hg-w-auge">{t.vertragTitel}</span>
            <ul>
              {t.vertrag.map((x, i) => (
                <li key={x}>{i === 1 ? <a href={t.mustervertragHref}>{x}</a> : <span>{x}</span>}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="hg-fussnote"><sup>{t.fussnoteNr}</sup> {t.fussnote}</p>
        {!ruhig && <p className="hg-fussnote hg-fussnote-team"><sup>{t.fussnoteNr + 1}</sup> {t.teamHinweis}</p>}
    </section>
    </>
  );
}
