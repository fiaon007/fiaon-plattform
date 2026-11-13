// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ANZEIGEN-LANDINGPAGE (19.09.2026, E-191)
//
// Eine Seite hinter einer Anzeige. Google bewertet sie nach Relevanz,
// Transparenz und Tempo; der Mensch dahinter hat genau eine Frage — wer ist das,
// was kostet es, wie fange ich an? Darum: kein Menü, die Überschrift wiederholt
// die Suche, Vertragspartner und Registernummer stehen im Kopf. Nicht im Index
// (noindex,follow). Konto, Karten und Kapitalrahmen stehen hier bewusst NICHT im
// Blickfang — Googles Regeln für Finanzanzeigen (shared/fiaon-global-seiten/landingpages.ts).
//
// ── E-510 (13.11.2026): auf der Vorlage der Unterseiten, im Kanzlei-Ton ─────
// Aufbau nach Sprachleitfaden 7.6: Kopf (Suchwort, zwei Sätze, die eine Handlung) mit der Karteikarte „Auf einen Blick“
// → Vertrauens-Band (vier Tatsachen mit Verweis) → Leistung an Haarlinien → drei Schritte (Ihr Mandat beginnt, Gründung,
// Unterlagen — jeder mit seiner Bedingung) → Honorar (der feste Satz mit BEIDEN Teilen) → Fragen → Erstgespräch auf Wunsch
// → Schlussband (die eine dunkle Fläche) → Fuß mit dem Rollen-Satz. Feste Sätze, Schritte und Beträge kommen aus
// shared/fiaon-global-saetze.ts; hier wird keiner getippt. Kein Inline-Stil mehr — alles in styles/global-apple.css (.lp-).
// Der Kalender lädt erst auf Wunsch (wie auf den Unterseiten), die Seite bleibt damit leicht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Auf, Fragen } from "@/components/site/DunkleBuehne";
import GespraechKarte from "@/components/site/global-seite/GespraechKarte";
import Merkblatt from "@/components/site/global-seite/Merkblatt";
import GlobalVertrauen from "@/components/site/global/GlobalVertrauen";
import NotFound from "@/pages/not-found";
import { globalLandingpage } from "@shared/fiaon-global-seiten";
import { GLOBAL_PFLICHTHINWEIS } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { seoSeite } from "@shared/fiaon-seo-seiten";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { SCHRITTE_KOPF, beleg, handlung, satz, sechsSchritte, weitererSatz } from "@shared/fiaon-global-saetze";
import { GLOBAL_SEITE_WOERTER } from "@/i18n/global-seite";
import { werbeEreignis } from "@/lib/werbung";
import { Pfeil } from "@/pages/site/global-seite";
import "@/styles/global-tokens.css";
import "@/styles/global.css";
import "@/styles/global-seiten.css";
import "@/styles/global-rahmen.css";
import "@/styles/global-apple.css";
import { FiaonWortmarke, MARKE_NAVY } from "@/components/marke/FiaonWortmarke";
import { useApfelBewegung } from "@/components/site/global/ApfelBewegung";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { ohneBindestrichBruch } from "@/components/site/global/Wortbruch";
import "@/styles/global-rahmen-apple.css";

/** Die Wörter der Landingpage, die keine festen Sätze sind (die Seite gibt es nur deutsch). */
const WORT = {
  sprung: "Zum Inhalt",
  start: "FIAON Global — Startseite",
  kennung: "FG · LP",
  vertragspartner: "Vertragspartner",
  honorar: "Honorar",
  zahlung: "Zahlung",
  leistungAuge: "Leistung",
  leistungH2: "Im ersten Jahr enthalten.",
  schritteH2: "Drei Schritte. Jeder mit seiner Bedingung.",
  mandat: "Ihr Mandat beginnt",
  honorarH2: "Honorar. Vor der Unterschrift.",
  wissenAuge: "Was Sie vor dem Mandat wissen müssen",
  fragenAuge: "Fragen",
  fragenH2: "Fragen zur Gründung.",
  gespraechAuge: "Erstgespräch",
  gespraechH2: "Dreißig Minuten, kostenfrei.",
  mehr: "Mehr zu diesem Thema:",
  rechtliches: "Rechtliches",
} as const;

/** Ein Abschnitt der Landingpage: links Augenzeile und Überschrift, rechts der Inhalt an Haarlinien. Erscheint einmal als Ganzes. */
function Abschnitt({ id, auge, h2, children }: { id?: string; auge: string; h2: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -12% 0px");
  return (
    <section ref={ref} id={id} className="lp-sek">
      <div className="fg-rahmen lp-sek-raster">
        <div className="lp-sek-kopf">
          <span className="fg-auge">{auge}</span>
          <h2 className="fg-h2 fd-h2">{h2}</h2>
        </div>
        <div className="lp-sek-inhalt">{children}</div>
      </div>
    </section>
  );
}

export default function GlobalLandingPage() {
  const lp = globalLandingpage(typeof window !== "undefined" ? window.location.pathname : "");
  useApfelBewegung();
  const [gespraechOffen, setGespraechOffen] = useState(() => typeof window !== "undefined" && window.location.hash === "#gespraech");
  // Wie die Business-Seiten: Das Dokument scrollt (styles/global-rahmen.css, fg-dokument); die Browserleiste am Handy ist hell.
  useEffect(() => {
    document.documentElement.classList.add("fg-dokument");
    const m = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const alt = m?.getAttribute("content") || "";
    m?.setAttribute("content", "#f4f8ff");
    return () => { document.documentElement.classList.remove("fg-dokument"); if (alt) m?.setAttribute("content", alt); };
  }, []);
  useEffect(() => {
    if (!lp) return;
    const e = seoSeite(lp.pfad);
    document.title = e?.titel ?? lp.seo.titel;
    window.scrollTo(0, 0);
  }, [lp?.pfad]);
  if (!lp) return <NotFound />;
  const u = GLOBAL_SEITE_WOERTER.de;
  // ?paket= stellt im Honorarrechner nur noch den Start-Rahmen des Reglers.
  const start = globalStartPfad(lp.paket, "de");
  const klick = () => werbeEreignis("global_beauftragen_klick", { paket: lp.paket, seite: lp.pfad });
  const glatt = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth") as ScrollBehavior;
  const zumGespraech = (e: React.MouseEvent) => {
    e.preventDefault();
    setGespraechOffen(true);
    requestAnimationFrame(() => document.getElementById("gespraech")?.scrollIntoView({ behavior: glatt() }));
  };
  const zumInhalt = (e: React.MouseEvent) => { e.preventDefault(); const z = document.getElementById("inhalt"); z?.focus({ preventScroll: true }); z?.scrollIntoView(); };
  const angebot = handlung("angebot", "de");
  const gespraech = handlung("gespraech", "de");
  // Die Landingpage wirbt nur für die Gründung: die Schritte Gründung und Unterlagen (wie auf der Österreich-Seite gekürzt),
  // davor ohne Nummer „Ihr Mandat beginnt“ (Leitfaden 2.1).
  const schritte = sechsSchritte("de", "AT").schritte;
  // Pflichthinweise ohne die Zeile zu Konto und Karte — beides steht auf dieser Seite nicht.
  const hinweise = GLOBAL_PFLICHTHINWEIS.de.filter((h) => !/Konto|Karte/.test(h));
  const blick: [string, string][] = [
    [WORT.vertragspartner, `${FIAON_FIRMA.name}, London · Companies House Nr. ${FIAON_FIRMA.companyNo}`],
    [WORT.honorar, beleg("honorarVorab", "de")],
    [WORT.zahlung, weitererSatz("ZAHLUNG", "de")],
  ];

  return (
    <div className="fg fd lp">
      <a className="gk-sprung" href="#inhalt" onClick={zumInhalt}>{WORT.sprung}</a>
      {/* ── Schlanker Kopf: Marke und die eine Handlung ───────────────────── */}
      <header className="lp-kopf">
        <div className="lp-kopf-innen">
          <a href="/" className="lp-marke" aria-label={WORT.start}>
            <FiaonWortmarke variante="global" hoehe={20} farbe={MARKE_NAVY} dekorativ />
          </a>
          <a className="fg-knopf lp-knopf" href={start} onClick={klick}>{angebot}</a>
        </div>
      </header>

      <main id="inhalt" tabIndex={-1}>
        {/* ── Kopf: das Suchwort, zwei Sätze, die Handlungen — rechts die Karteikarte ── */}
        <section className="fd-kopf neu lp-buehne">
          <div className="fg-rahmen fd-kopf-raster">
            <Auf>
              <span className="fg-auge">{lp.auge}</span>
              <h1 className="fg-h1 fd-h1">{ohneBindestrichBruch(lp.h1)}{lp.h1b && <><br /><em>{ohneBindestrichBruch(lp.h1b)}</em></>}</h1>
              <p className="fd-lead">{lp.lead}</p>
              <div className="fg-knoepfe fd-kopf-knoepfe">
                <a className="fg-knopf" href={start} onClick={klick}>{angebot}<Pfeil /></a>
                <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{gespraech}</a>
              </div>
            </Auf>
            <Auf verzoegerung={140}>
              <Merkblatt titel={u.blick} kennung={WORT.kennung} zeilen={blick} alle={u.alleAngaben} punkte={u.blickPunkte(blick.length)}
                stand={weitererSatz("PRODUKTNAME", "de")} firma={`${FIAON_FIRMA.name} · Companies House ${FIAON_FIRMA.companyNo}`} />
            </Auf>
          </div>
        </section>

        {/* ── Vertrauens-Band: vier Tatsachen mit Verweis, die Presse-Zeile genau einmal ── */}
        <GlobalVertrauen sprache="de" />

        {/* ── Leistung: fünf Zeilen an Haarlinien ───────────────────────────── */}
        <Abschnitt auge={WORT.leistungAuge} h2={WORT.leistungH2}>
          <ul className="lp-liste">{lp.vorteile.map((v) => <li key={v}>{v}</li>)}</ul>
        </Abschnitt>

        {/* ── Ablauf: Ihr Mandat beginnt, dann Gründung und Unterlagen — jeder Schritt mit seiner Bedingung ── */}
        <Abschnitt auge={SCHRITTE_KOPF.de.auge} h2={WORT.schritteH2}>
          <ol className="lp-schritte">
            <li>
              <span className="nr" aria-hidden="true">—</span>
              <div><h3>{WORT.mandat}</h3><p>{beleg("honorarVorab", "de")} {beleg("zahlung", "de")}</p></div>
            </li>
            {schritte.map((x) => (
              <li key={x.nr}>
                <span className="nr">{x.nr}</span>
                <div><h3>{x.titel}</h3><p>{x.satz}</p><p className="bedingung">{x.bedingung}</p></div>
              </li>
            ))}
          </ol>
        </Abschnitt>

        {/* ── Honorar: der feste Satz mit beiden Teilen (Leitfaden 7.6) ─────── */}
        <Abschnitt auge={WORT.honorar} h2={WORT.honorarH2}>
          <p className="lp-satz">{weitererSatz("HONORAR-LANDINGPAGE", "de")}</p>
          <p className="lp-klein">{weitererSatz("HONORAR-SCHLUSS", "de")} {weitererSatz("ZAHLUNG", "de")}</p>
          <div className="lp-wissen">
            <span className="fd-marke">{WORT.wissenAuge}</span>
            <ol>
              <li><span>{satz("S3", "de")}</span></li>
              {hinweise.map((h) => <li key={h.slice(0, 40)}><span>{h}</span></li>)}
            </ol>
          </div>
        </Abschnitt>

        {/* ── Fragen ────────────────────────────────────────────────────────── */}
        <Abschnitt auge={WORT.fragenAuge} h2={WORT.fragenH2}>
          <div className="fd-fragen"><Fragen items={lp.fragen} ebene={3} /></div>
          <p className="lp-klein lp-mehr">{WORT.mehr} <a href={lp.quelle}>{seoSeite(lp.quelle)?.h1 ?? "FIAON Global"}</a></p>
        </Abschnitt>

        {/* ── Erstgespräch: die Karte, der Kalender erst auf Wunsch ─────────── */}
        <Abschnitt id="gespraech" auge={WORT.gespraechAuge} h2={WORT.gespraechH2}>
          <GespraechKarte sp="de" offen={gespraechOffen} onOeffnen={() => setGespraechOffen(true)} paket={null} />
        </Abschnitt>

        {/* ── Schlussband: die eine dunkle Fläche — ein Satz, die Handlungen ── */}
        <section className="fg-schluss ruhig">
          <div className="fg-rahmen">
            <Auf>
              <div className="fg-schluss-text">
                <h2 className="fg-h2">{weitererSatz("SCHLUSS", "de")}</h2>
                <div className="fg-knoepfe">
                  <a className="fg-knopf" href={start} onClick={klick}>{angebot}<Pfeil /></a>
                  <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>{gespraech}</a>
                </div>
              </div>
            </Auf>
          </div>
        </section>
      </main>

      {/* ── Fuß: nur das Nötige — Register-Zeile, Rollen-Satz, Rechtliches ──── */}
      <footer className="lp-fuss">
        <div className="fg-rahmen lp-fuss-innen">
          <div className="lp-fuss-firma">
            <p>© {new Date().getFullYear()} {FIAON_FIRMA.name} · {FIAON_FIRMA.strasse} · {FIAON_FIRMA.ortZeile} · Companies House Nr. {FIAON_FIRMA.companyNo}</p>
            <p>{satz("S8", "de")}</p>
          </div>
          <nav className="lp-fuss-links" aria-label={WORT.rechtliches}>
            <a href="/">FIAON Global</a>
            {/* 19.09.2026: Rechtliches der Business-Welt — die AGB der Privatkunden-Linie gelten für FIAON Global nicht. */}
            <a href="/impressum?bereich=business">Impressum</a>
            <a href="/datenschutz?bereich=business">Datenschutz</a>
            <a href="/business/mustervertrag">Vertrag im Überblick</a>
            <a href="/business/widerrufsbelehrung">Widerrufsbelehrung</a>
            <a href="/cookie-einstellungen?bereich=business">Cookie-Einstellungen</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
