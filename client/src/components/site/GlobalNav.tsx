// ═══════════════════════════════════════════════════════════════════════════
// DER KOPF DER BUSINESS-WELT — FIAON GLOBAL (19.09.2026)
//
// Justin: „Wenn man auf /business ist, muss alles für die Business-Kunden
// ausgelegt sein … wenn man aufs Logo klickt, die Startseite von Business."
//
// Was hier NICHT steht, mit Absicht: „Konto eröffnen", „Login", Bonität,
// Ratgeber zu Einträgen, Karriere-Hinweis — alles, was zur Privatkunden-Linie
// gehört. Ein Geschäftskunde sieht nur FIAON Global: vier Themen (aus
// shared/fiaon-global-menue.ts, derselben Liste wie Seiten und Sitemap), den
// Weg zum laufenden Mandat und die Handlungen des Hauses.
//
// Seit 24.09.2026 (E-234) englisch genauso: dieselben vier Spalten mit den
// englischen Unterseiten; der Umschalter DE/EN führt auf die Schwesterseite
// (shared/fiaon-global-pfade.ts) und behält Abfrage und Anker.
//
// ── E-510 (13.11.2026): der Kopf im Kanzlei-Ton ────────────────────────────
//  · EINE Haupt-Handlung. Ihr Name kommt aus der einen Quelle der festen Sätze (handlung(), Leitfaden Abschnitt 7) und
//    heißt in Bühne, Kopf, Karte und Schlussband gleich. Das Gespräch steht daneben als ruhiger Textverweis. Auf der
//    Österreich-Seite ist das Gespräch die einzige Handlung, und im Panel steht kein Betrag (Leitfaden 5.12).
//  · Das Themen-Panel öffnet auf Befehl: Klick, Enter, Leertaste — mit der Maus nach 120 ms Verweilen. Der Fokus allein
//    öffnet nichts mehr (wer mit der Tastatur durch den Kopf ging, klappte vier Panels auf). Escape schließt und gibt
//    den Fokus an den Themen-Knopf zurück.
//  · Erstes Element der Seite ist der Sprunglink „Zum Inhalt“ (Ziel: <main id="inhalt">, DunkleBuehne.tsx).
//  · Das Menü am Telefon hält den Fokus: beim Öffnen auf dem ersten Punkt, Tab bleibt im Menü, Schließen gibt ihn zurück.
//  · Das neue Aussehen (feste Höhe, Schleier, eine Kante mit dem Inhalt, heller Fuß) tragen nur die öffentlichen
//    Global-Seiten (globalOeffentlich → Klasse gk-neu). Angebot, Auftrag und Konto-Tor behalten ihren Rahmen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { useSprache } from "@/i18n/sprache";
import { GLOBAL_FUSS_WOERTER } from "@/i18n/global";
import { globalMenue, type MenueGruppe } from "@shared/fiaon-global-menue";
import { globalStartPfad, globalSeitePfad } from "@shared/fiaon-global-wege";
import { globalSchwester } from "@shared/fiaon-global-pfade";
import { SERIOES_PFAD } from "@shared/fiaon-serioes";
import { BUSINESS_START, istBusinessPfad } from "@shared/fiaon-business-grenze";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
// Jeder feste Satz und jeder Betrag kommt aus der einen Quelle — hier wird keiner getippt.
import { SAETZE_BETRAEGE, beleg, handlung, hauptHandlung, satzLand, weitererSatz } from "@shared/fiaon-global-saetze";
import "@/styles/global-tokens.css";
import "@/styles/global-rahmen.css";
import "@/styles/global-rahmen-apple.css";
import { FiaonWortmarke } from "@/components/marke/FiaonWortmarke";
import { useApfelBewegung } from "@/components/site/global/ApfelBewegung";

type Sp = "de" | "en";

/** Seiten der Business-Welt, die NICHT öffentlich sind: das persönliche Angebot, der Auftrag, das Konto-Tor. */
const NICHT_OEFFENTLICH = /^\/(en\/)?business\/(angebot|auftrag|login|konto|zugang|passwort-vergessen|forgot-password|access|account)(\/|$)/;

/**
 * Ist das eine öffentliche Seite von FIAON Global (Startseite, Unterseiten, Honorarrechner, Landingpages, Rechtsseiten)?
 * Nur dort gelten der neue Kopf und der helle Fuß (E-510). Gemeinsame Seiten mit ?bereich=business zählen nicht dazu.
 */
export function globalOeffentlich(pfad?: string): boolean {
  const roh = pfad ?? (typeof window !== "undefined" ? window.location.pathname : "");
  const p = (roh.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();
  return istBusinessPfad(p) && !NICHT_OEFFENTLICH.test(p);
}

/** Die Wörter des Kopfs, die keine festen Sätze sind. Kurz, als Hauptwort oder als Handlung. */
const WORT = {
  de: {
    sprung: "Zum Inhalt", themen: "Themen von FIAON Global", start: "FIAON Global — Startseite", sprache: "English version",
    menue: "Menü", auf: "Menü öffnen", zu: "Menü schließen", uebersicht: "Übersicht",
    blatt: "Honorar", auftrag: "mit Ihrem Auftrag", eintragung: "mit der Eintragung: Erfolgshonorar", jahr: "ab dem zweiten Jahr: Jahresbetreuung",
    mindestens: "mindestens", imJahr: "im Jahr",
    leistungen: "Ein Mandat, ein Vertrag, ein Ansprechpartner.", leistungenText: "Wir legen Ihnen jede Unterlage unterschriftsreif vor.", leistungenKnopf: "Leistungen ansehen",
    fuerwen: "Für wen es nicht passt.",
  },
  en: {
    sprung: "Skip to content", themen: "FIAON Global topics", start: "FIAON Global — home", sprache: "Deutsche Fassung",
    menue: "Menu", auf: "Open menu", zu: "Close menu", uebersicht: "Overview",
    blatt: "Fees", auftrag: "on engagement", eintragung: "on registration: success fee", jahr: "from the second year: annual administration",
    mindestens: "at least", imJahr: "a year",
    leistungen: "One engagement, one agreement, one dedicated contact.", leistungenText: "We present every document ready for your signature.", leistungenKnopf: "View the services",
    fuerwen: "Who it is not for.",
  },
} as const;

function Pfeil({ groesse = 13 }: { groesse?: number }) {
  return <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function Winkel() {
  return <svg className="gk-winkel" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>;
}

/** Die Marke: FIAON + Global. Führt immer zur Startseite — seit E-461 (29.10.2026) fiaon.com/ selbst. */
export function GlobalMarke({ en = false, hell = false }: { en?: boolean; hell?: boolean }) {
  return (
    <a href={en ? BUSINESS_START.en : BUSINESS_START.de} className={`gk-marke${hell ? " hell" : ""}`} aria-label={WORT[en ? "en" : "de"].start}>
      <FiaonWortmarke variante="global" dekorativ hoehe={null} />
    </a>
  );
}

/** Alles, was im Menü am Telefon den Fokus tragen kann. */
const FOKUSSIERBAR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** So lange verweilt die Maus auf einem Thema, bevor das Panel aufgeht — ein Streifen über den Kopf öffnet nichts. */
const VERWEILEN_MS = 120;

export default function GlobalNav() {
  // E-442 (28.10.2026): Bewegung für jede Seite der Business-Welt (Auftritt beim Hineinscrollen, dichtere Kopf-Pille).
  useApfelBewegung();
  const sprache = useSprache();
  const en = sprache === "en";
  const sp: Sp = en ? "en" : "de";
  const w = WORT[sp];
  const pfad = typeof window !== "undefined" ? window.location.pathname : BUSINESS_START.de;
  const oeffentlich = globalOeffentlich(pfad);
  const land = satzLand(pfad);
  const [offen, setOffen] = useState<MenueGruppe | null>(null);
  const [mobil, setMobil] = useState(false);
  const [mobilGruppe, setMobilGruppe] = useState<MenueGruppe | null>(null);
  const [gescrollt, setGescrollt] = useState(false);
  const uhr = useRef<number | null>(null);
  const kopf = useRef<HTMLElement>(null);
  const burger = useRef<HTMLButtonElement>(null);
  const menue = useRef<HTMLDivElement>(null);

  // Business-Seiten scrollen im Dokument, gemeinsame Seiten (Impressum mit ?bereich=business) noch in #root.
  useEffect(() => {
    const root = document.getElementById("root");
    const fn = () => setGescrollt(Math.max(window.scrollY, root?.scrollTop ?? 0) > 8);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    root?.addEventListener("scroll", fn, { passive: true });
    return () => { window.removeEventListener("scroll", fn); root?.removeEventListener("scroll", fn); };
  }, []);
  // Escape schließt Panel und Handy-Menü; ein Klick daneben schließt das Panel.
  // 06.10.2026 (E-293): Auch die Tastatur schließt es — verlässt der Fokus den Kopf (Tab in den Inhalt), geht das Panel
  // zu. Escape aus dem Panel heraus gibt den Fokus an den Themen-Knopf zurück (sonst fiele er ins Leere).
  // relatedTarget null (Klick auf eine leere Fläche im Panel) schließt nicht — dafür gibt es den Klick daneben.
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const k = kopf.current;
      if (k && document.activeElement instanceof HTMLElement && document.activeElement.closest(".gk-panel")) {
        k.querySelector<HTMLElement>('.gk-thema[aria-expanded="true"]')?.focus();
      }
      setOffen(null); setMobil(false);
    };
    const klick = (e: MouseEvent) => { if (kopf.current && !kopf.current.contains(e.target as Node)) setOffen(null); };
    const k = kopf.current;
    const fokusRaus = (e: FocusEvent) => { const n = e.relatedTarget as Node | null; if (k && n && !k.contains(n)) setOffen(null); };
    window.addEventListener("keydown", taste);
    document.addEventListener("mousedown", klick);
    k?.addEventListener("focusout", fokusRaus);
    return () => { window.removeEventListener("keydown", taste); document.removeEventListener("mousedown", klick); k?.removeEventListener("focusout", fokusRaus); };
  }, []);
  useEffect(() => () => { if (uhr.current) window.clearTimeout(uhr.current); }, []);

  // Das Handy-Menü sperrt das Scrollen der Seite dahinter und hält den Fokus (E-510): Beim Öffnen steht er auf dem ersten
  // Punkt, Tab läuft im Kreis durch Menüknopf und Menü, beim Schließen kehrt er zum Menüknopf zurück.
  const warOffen = useRef(false);
  useEffect(() => {
    if (!mobil) {
      if (warOffen.current) { warOffen.current = false; burger.current?.focus({ preventScroll: true }); }
      return;
    }
    warOffen.current = true;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const liste = () => [burger.current, ...Array.from(menue.current?.querySelectorAll<HTMLElement>(FOKUSSIERBAR) ?? [])]
      .filter((e): e is HTMLElement => !!e && e.getClientRects().length > 0);
    const start = window.requestAnimationFrame(() => (liste()[1] ?? liste()[0])?.focus({ preventScroll: true }));
    const falle = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const l = liste();
      if (!l.length) return;
      const i = l.indexOf(document.activeElement as HTMLElement);
      if (i === -1) { e.preventDefault(); l[e.shiftKey ? l.length - 1 : 0].focus(); return; }
      if (!e.shiftKey && i === l.length - 1) { e.preventDefault(); l[0].focus(); }
      else if (e.shiftKey && i === 0) { e.preventDefault(); l[l.length - 1].focus(); }
    };
    document.addEventListener("keydown", falle);
    return () => { window.cancelAnimationFrame(start); document.removeEventListener("keydown", falle); document.body.style.overflow = vorher; };
  }, [mobil]);

  // Mit der Maus: erst nach kurzem Verweilen auf, beim Verlassen des Kopfs mit kleiner Frist zu. Ist schon ein Panel
  // offen, wechselt das Thema sofort (man ist dann im Menü und sucht).
  const stopp = () => { if (uhr.current) { window.clearTimeout(uhr.current); uhr.current = null; } };
  const aufSofort = (g: MenueGruppe) => { stopp(); setOffen(g); };
  const aufNachVerweilen = (g: MenueGruppe) => { stopp(); if (offen) { setOffen(g); return; } uhr.current = window.setTimeout(() => setOffen(g), VERWEILEN_MS); };
  const zuSpaeter = () => { stopp(); uhr.current = window.setTimeout(() => setOffen(null), 160); };
  // Mit der Tastatur geöffnet (Enter, Leertaste) oder Pfeil nach unten: Der Fokus geht in das Panel — sonst führte Tab
  // erst durch den Rest des Kopfs. Escape bringt ihn zum Themen-Knopf zurück.
  const insPanel = (g: MenueGruppe) => window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`#gk-panel-${g} a[href]`)?.focus());

  // Auf dem Honorarrechner und im Auftrag selbst braucht es keinen zweiten Weg dorthin.
  const imAuftrag = /^\/(en\/)?business\/(start|auftrag)(\/|$)/.test(pfad);
  // 19.09.2026 (E-196): Auf der Startseite für Privatpersonen führt auch der Kopf in den Weg als Privatperson.
  const privatSeite = pfad === "/business/privatpersonen" || pfad === "/en/business/private-individuals";
  const startHref = globalStartPfad(undefined, sp, privatSeite ? "privat" : undefined);
  // Der Umschalter DE/EN: die Schwesterseite; im Rechner und im Auftrag reisen Abfrage (?paket, ?art, ?t) und Anker mit.
  const sprachHref = (() => {
    const loc = typeof window !== "undefined" ? window.location : null;
    // 29.10.2026 (E-459): Die Vertrauensseite liegt außerhalb von /business — ihr Paar kommt aus ihrer kleinen Quelle.
    const pn = (pfad.replace(/\/+$/, "") || "/").toLowerCase();
    const serioes = pn === SERIOES_PFAD.de || pn === SERIOES_PFAD.en ? SERIOES_PFAD[en ? "de" : "en"] : null;
    const ziel = serioes ?? globalSchwester(pfad, en ? "de" : "en") ?? globalSeitePfad(en ? "de" : "en");
    return ziel + (/\/business\/(start|auftrag)(\/|$)/.test(ziel) ? (loc?.search ?? "") : "") + (loc?.hash ?? "");
  })();
  const gespraechHref = en ? "/en#gespraech" : "/#gespraech";
  // E-423: Der Weg zum laufenden Mandat führt zur Anmeldung — dort steht auch der Weg ohne Zugang (Link anfordern).
  const auftragHref = en ? "/en/business/login" : "/business/login";
  // Das Wort dafür pflegt die Fußzeile (i18n/global.ts) — Kopf und Fuß sagen so immer dasselbe.
  const auftragWort = GLOBAL_FUSS_WOERTER[sp].auftrag;
  // Wo ein Kalender auf der Seite steht, gleitet „Gespräch vereinbaren" dorthin statt neu zu laden.
  const zumGespraech = (e: React.MouseEvent) => {
    const ziel = document.getElementById("gespraech");
    if (!ziel) return;
    e.preventDefault(); setMobil(false); setOffen(null);
    ziel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  // Die Haupt-Handlung dieser Seite: „Angebot anfordern“ — in Österreich und im Rechner selbst das Gespräch (Leitfaden 5.12, 7).
  const angebotWort = handlung("angebot", sp);
  const gespraechWort = handlung("gespraech", sp);
  const nurGespraech = imAuftrag || hauptHandlung(sp, land) === gespraechWort;
  const knopfGespraech = <a href={gespraechHref} onClick={zumGespraech} className="gk-knopf">{gespraechWort}</a>;
  const knopfAngebot = <a href={startHref} className="gk-knopf">{angebotWort}</a>;
  const zumInhalt = (e: React.MouseEvent) => {
    const ziel = document.getElementById("inhalt") ?? document.querySelector<HTMLElement>("main");
    if (!ziel) return;
    e.preventDefault();
    if (!ziel.hasAttribute("tabindex")) ziel.setAttribute("tabindex", "-1");
    ziel.focus({ preventScroll: true });
    ziel.scrollIntoView();
  };
  const gruppen = globalMenue(sp);
  const B = SAETZE_BETRAEGE[sp];
  // Österreich-Seite: kein Betrag — auch nicht in der Unterzeile eines Menüpunkts (Leitfaden 5.12).
  const unterzeile = (text: string) => (land === "AT" && /[€$]/.test(text) ? "" : text);
  // Das Blatt rechts im Panel: je Thema ein Satz aus dem Leitfaden und ein Weg. Unter „Honorar“ die drei Honorarzeilen —
  // immer zusammen (Leitfaden 5.6), auf der Österreich-Seite ohne Betrag (5.12).
  const blatt = (g: MenueGruppe) => {
    const wegAngebot = nurGespraech
      ? <a href={gespraechHref} onClick={zumGespraech} className="gk-promo-link">{gespraechWort}<Pfeil /></a>
      : <a href={startHref} className="gk-promo-link">{angebotWort}<Pfeil /></a>;
    if (g === "preise") {
      return (
        <div className="gk-promo gk-promo-pakete">
          <p className="gk-panel-titel">{w.blatt}</p>
          {land === "AT" ? (
            <p className="gk-promo-text">{weitererSatz("HONORAR-AT", sp)}</p>
          ) : (
            <>
              <dl className="gk-honorar">
                <div className="gk-paket"><dt>{w.auftrag}</dt><dd>{B.honorarAuftrag}</dd></div>
                <div className="gk-paket"><dt>{w.eintragung}</dt><dd><small>{w.mindestens}</small> {B.erfolgMin}</dd></div>
                <div className="gk-paket"><dt>{w.jahr}</dt><dd>{B.jahresbetreuung} <small>{w.imJahr}</small></dd></div>
              </dl>
              <p className="gk-promo-text">{beleg("honorarVorab", sp)}</p>
            </>
          )}
          {wegAngebot}
        </div>
      );
    }
    if (g === "leistungen") {
      return (
        <div className="gk-promo">
          <p className="gk-promo-titel">{w.leistungen}</p>
          <p className="gk-promo-text">{w.leistungenText}</p>
          <a href={en ? "/en#produkt" : "/#produkt"} className="gk-promo-link">{w.leistungenKnopf}<Pfeil /></a>
        </div>
      );
    }
    if (g === "fuerwen") {
      return (
        <div className="gk-promo">
          <p className="gk-promo-titel">{w.fuerwen}</p>
          <p className="gk-promo-text">{beleg("fuerWenNicht", sp)}</p>
          <a href={gespraechHref} onClick={zumGespraech} className="gk-promo-link">{gespraechWort}<Pfeil /></a>
        </div>
      );
    }
    return (
      <div className="gk-promo">
        <p className="gk-promo-titel">{weitererSatz("LEITSATZ", sp)}</p>
        <p className="gk-promo-text">{land === "AT" ? weitererSatz("HONORAR-AT", sp) : beleg("honorarVorab", sp)}</p>
        {wegAngebot}
      </div>
    );
  };

  return (
    <>
    <a className="gk-sprung" href="#inhalt" onClick={zumInhalt}>{w.sprung}</a>
    <header ref={kopf} className={`gk${oeffentlich ? " gk-neu" : ""}${gescrollt || offen ? " gk-fest" : ""}`} onMouseLeave={zuSpaeter}>
      <div className="gk-leiste">
        <GlobalMarke en={en} />

        <nav className="gk-themen" aria-label={w.themen}>
          {gruppen.map((g) => (
            <button key={g.gruppe} type="button" className="gk-thema" aria-expanded={offen === g.gruppe} aria-controls={`gk-panel-${g.gruppe}`}
                    data-an={g.eintraege.some((e) => e.pfad === pfad) ? "1" : undefined}
                    onMouseEnter={() => aufNachVerweilen(g.gruppe)} onMouseLeave={() => { if (!offen) stopp(); }}
                    onClick={(ev) => { if (offen === g.gruppe) { stopp(); setOffen(null); } else { aufSofort(g.gruppe); if (ev.detail === 0) insPanel(g.gruppe); } }}
                    onKeyDown={(ev) => { if (ev.key === "ArrowDown") { ev.preventDefault(); aufSofort(g.gruppe); insPanel(g.gruppe); } }}>
              {g.titel}<Winkel />
            </button>
          ))}
        </nav>

        <div className="gk-tun">
          <a href={auftragHref} className="gk-leise" data-an={pfad.includes("/business/auftrag") ? "1" : undefined}>{auftragWort}</a>
          {nurGespraech ? knopfGespraech : (
            <>
              {/* Öffentlich: das Gespräch als ruhiger Textverweis neben der einen Haupt-Handlung. */}
              <a href={gespraechHref} onClick={zumGespraech} className={oeffentlich ? "gk-text" : "gk-knopf hell"}>{gespraechWort}</a>
              {knopfAngebot}
            </>
          )}
          <a href={sprachHref} className="gk-sprache" hrefLang={en ? "de" : "en"} lang={en ? "de" : "en"} aria-label={w.sprache}>
            <span data-an={en ? undefined : "1"}>DE</span><i aria-hidden="true">·</i><span data-an={en ? "1" : undefined}>EN</span>
          </a>
        </div>

        <button ref={burger} type="button" className="gk-burger" aria-expanded={mobil} aria-controls="gk-mobil" aria-label={mobil ? w.zu : w.auf} onClick={() => setMobil(!mobil)}>
          <span /><span /><span />
        </button>
      </div>

      {/* ── Das Panel am Rechner ─────────────────────────────────────────────── */}
      {gruppen.map((g) => (
        <div key={g.gruppe} id={`gk-panel-${g.gruppe}`} className="gk-panel" data-auf={offen === g.gruppe ? "1" : undefined} onMouseEnter={() => aufSofort(g.gruppe)} hidden={offen !== g.gruppe}>
          <div className="gk-panel-innen">
            <div className="gk-panel-liste">
              <p className="gk-panel-titel">{g.titel}</p>
              <ul>
                {g.eintraege.map((e) => (
                  <li key={e.pfad}>
                    <a href={e.pfad} aria-current={e.pfad === pfad ? "page" : undefined} onClick={(ev) => { if (/^\/(en)?#/.test(e.pfad)) { const id = e.pfad.split("#")[1]; const z = document.getElementById(id); if (z) { ev.preventDefault(); setOffen(null); z.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); } } }}>
                      <b>{e.titel}</b>{unterzeile(e.text) && <span>{unterzeile(e.text)}</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            {blatt(g.gruppe)}
          </div>
        </div>
      ))}

    </header>

      {/* ── Das Menü am Telefon ──────────────────────────────────────────────────
          NEBEN dem Kopf, nicht darin: Der Kopf trägt backdrop-filter, und ein Filter
          macht ihn zum Bezugsrahmen für position:fixed — das Menü wäre 72 px hoch. */}
      {mobil && (
        <div ref={menue} id="gk-mobil" className={`gk-mobil${oeffentlich ? " gk-neu" : ""}`} role="dialog" aria-modal="true" aria-label={w.menue}>
          <div className="gk-mobil-rumpf">
            <a href={globalSeitePfad(sp)} className="gk-mobil-start" onClick={() => setMobil(false)}><b>{w.uebersicht}</b><span>{weitererSatz("PRODUKTNAME", sp)}</span></a>
            {gruppen.map((g) => (
              <div key={g.gruppe} className="gk-mobil-gruppe" data-auf={mobilGruppe === g.gruppe ? "1" : undefined}>
                <button type="button" aria-expanded={mobilGruppe === g.gruppe} onClick={() => setMobilGruppe(mobilGruppe === g.gruppe ? null : g.gruppe)}>
                  {g.titel}<Winkel />
                </button>
                {mobilGruppe === g.gruppe && (
                  <ul className="gk-mobil-liste">
                    {g.eintraege.map((e) => (
                      <li key={e.pfad}><a href={e.pfad} aria-current={e.pfad === pfad ? "page" : undefined} onClick={() => setMobil(false)}><b>{e.titel}</b>{unterzeile(e.text) && <span>{unterzeile(e.text)}</span>}</a></li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <div className="gk-mobil-zeile">
              <a href={`tel:${FIAON_FIRMA.telefonTel}`}>{FIAON_FIRMA.telefon}</a>
              <a href={auftragHref}>{auftragWort}</a>
              <a href={sprachHref} hrefLang={en ? "de" : "en"} lang={en ? "de" : "en"}>{en ? "Deutsch" : "English"}</a>
            </div>
          </div>
          <div className="gk-mobil-fuss">
            {nurGespraech ? knopfGespraech : (
              <>
                <a href={gespraechHref} onClick={zumGespraech} className="gk-knopf hell">{gespraechWort}</a>
                {knopfAngebot}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
