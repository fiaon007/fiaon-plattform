// ═══════════════════════════════════════════════════════════════════════════
// /business/angebot/:token — DAS FIRMENANGEBOT (B2B), Register E-301
//
// Verzweigung: business-angebot.tsx lädt die Kundensicht wie immer; ist sie
// art === "firma" UND status === "offen", zeigt sie diese Seite (lazy, eigener
// Chunk — three.js lädt erst das Glas). Angenommene Firmenangebote nutzen die
// bestehende Ansicht. Hildbrands Angebot (E-268) läuft unverändert weiter.
//
// Justin (07.10.2026): „Du musst es spektakulär bauen, gerade den Anfang —
// ‚Herzlichen Glückwunsch!‘, es soll eine Freude für sie sein … vielleicht ein
// Glas von ihr, das sich beim Scrollen öffnet.“ Und: Die erste Runde ist kein
// Ziel — sie ist nach Ziffer 7 garantiert (mit ihren Bedingungen, sonst
// Erstattung der Gründung); die Sätze dazu kommen allein aus kapital.garantie,
// eine Quelle im Server. Bilder kommen nur über den Link (…/bild/<name>).
//
// Reihenfolge (Bauauftrag Abschnitt 3): Auftakt · Hero mit Glas · Ihre Ziele ·
// Zeitstrahl · Was Sie bekommen · Ihr Kapital · Prüfbericht (die eine dunkle
// Navy-Bühne) · Ihre Investition mit Umsatzrechner · Fragen & Antworten · Ihr
// Ansprechpartner · Vertrag & Anlagen · Annahme · Pflichthinweise, Bildnachweis.
//
// Gestaltung: Kanzlei-Papier der Business-Welt (Navy #12284a, Newsreader 300,
// Inter 300/400, Haarlinien) mit Gold als Akzent. Kein
// klebendes Menü — die Kopfzeile steht oben im Fluss. Am Handy (360–430 px)
// stapelt alles, kein seitliches Scrollen; die Leiste „Zur Annahme“ erscheint
// erst ab „Vertrag & Anlagen“ (nie über Fragen oder Ansprechpartner) und
// verschwindet, sobald die Annahme im Bild ist; solange sie steht, hält die
// Seite unten Platz frei.
// Alle Inhalte kommen aus FirmaKundenSicht; hart im Client stehen nur
// Bedienbeschriftungen (WORTE unten und in den Bausteinen).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import type { FirmaKundenSicht } from "@shared/fiaon-global-angebot-firma-typen";
// Derselbe Satz wie beim Individualangebot (E-268): Aufrufe des Links werden protokolliert — Information nach Art. 13 DSGVO,
// außerhalb des Vertragstextes (nicht in der Prüfsumme, nicht im PDF). Gegenprüfung 07.10.2026.
import { ANGEBOT_AUFRUF_HINWEIS } from "@shared/fiaon-global-angebot";
import Glueckwunsch from "@/components/angebot-firma/Glueckwunsch";
import ProduktGlas3D from "@/components/angebot-firma/ProduktGlas3D";
import PhasenZeitstrahl from "@/components/angebot-firma/PhasenZeitstrahl";
import LeistungsKarten from "@/components/angebot-firma/LeistungsKarten";
import KapitalTafel from "@/components/angebot-firma/KapitalTafel";
import ComplianceBuehne from "@/components/angebot-firma/ComplianceBuehne";
import InvestitionsPosten from "@/components/angebot-firma/InvestitionsPosten";
import UmsatzRechner from "@/components/angebot-firma/UmsatzRechner";
import FragenAntworten from "@/components/angebot-firma/FragenAntworten";
import AnnahmeFirma from "@/components/angebot-firma/AnnahmeFirma";
import VertragsLeser from "@/components/angebot-firma/VertragsLeser";
import { Auf, MarkeGlobal, Zeichen, tagDe } from "@/components/angebot-firma/gemeinsam";
import "@/styles/global-angebot-firma.css";

const WORTE = {
  seitenTitel: "Ihr persönliches Angebot · FIAON Global",
  angebot: "Angebot", gueltig: "gültig bis", zurAnnahme: "Zur Annahme",
  vertragPdf: "Vertrag", anlage1: "Anlage 1 · Bürgschaftszusage", anlage2: "Anlage 2 · Prüfbericht",
  vorschau: "Vorschau der Leitung.", vorschauSatz: "Annehmen kann nur die Kundin bzw. der Kunde — aus dem Chefbüro heraus ist der Knopf gesperrt.", fehlt: "Für die Annahme fehlt noch:",
  impressum: "Impressum", datenschutz: "Datenschutzerklärung",
};

/**
 * Kopf der Seite setzen, Suchmaschinen fernhalten, das Dokument scrollen lassen (wie /business). Das vorhandene
 * robots-Tag aus index.html wird überschrieben (nicht ein zweites angehängt) und beim Verlassen zurückgesetzt; der Server
 * sendet für /business/angebot/* zusätzlich X-Robots-Tag: noindex, nofollow.
 */
function useSeitenRahmen(titel: string) {
  useEffect(() => {
    const vorher = document.title;
    document.title = titel;
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const neu = !robots;
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    const robotsVorher = robots.content;
    robots.content = "noindex, nofollow";
    document.documentElement.classList.add("fg-dokument", "gaf-seite");
    window.scrollTo(0, 0);
    return () => {
      document.title = vorher;
      if (neu) robots!.remove(); else robots!.content = robotsVorher;
      document.documentElement.classList.remove("fg-dokument", "gaf-seite", "gaf-leiste-an");
    };
  }, [titel]);
}

/** Die Leiste „Zur Annahme“ am Handy: erst ab „Vertrag & Anlagen“, weg, sobald die Annahme im Bild ist. */
function useLeisteSichtbar(): boolean {
  const [an, setAn] = useState(false);
  useEffect(() => {
    let raf = 0;
    const pruefen = () => {
      raf = 0;
      const ab = document.getElementById("vertrag"), annahme = document.getElementById("annahme");
      if (!ab || !annahme) return;
      const vh = window.innerHeight;
      const imVertrag = ab.getBoundingClientRect().top < vh * 0.6;
      const annahmeDa = annahme.getBoundingClientRect().top < vh * 0.9;
      const sicht = imVertrag && !annahmeDa;
      setAn(sicht);
      // Solange die Leiste steht, hält die Seite unten Platz frei — sie verdeckt nie dauerhaft Text.
      document.documentElement.classList.toggle("gaf-leiste-an", sicht);
    };
    const anstoss = () => { if (!raf) raf = requestAnimationFrame(pruefen); };
    pruefen();
    document.addEventListener("scroll", anstoss, { capture: true, passive: true });
    window.addEventListener("resize", anstoss);
    return () => { if (raf) cancelAnimationFrame(raf); document.removeEventListener("scroll", anstoss, { capture: true } as EventListenerOptions); window.removeEventListener("resize", anstoss); };
  }, []);
  return an;
}

function Kopf({ titel, sub, auge, hell = false }: { titel: string; sub?: string; auge?: string; hell?: boolean }) {
  return (
    <Auf className={`gaf-kopf${hell ? " gaf-kopf-hell" : ""}`}>
      {auge && <p className="gaf-auge">{auge}</p>}
      <h2 className="gaf-h2">{titel}</h2>
      {sub && <p className="gaf-sub">{sub}</p>}
    </Auf>
  );
}

export default function BusinessAngebotFirma({ sicht, token, onAngenommen, onNeuLaden }: {
  sicht: FirmaKundenSicht; token: string; onAngenommen: (antwort: unknown) => void; onNeuLaden: () => void;
}) {
  const [auftakt, setAuftakt] = useState<"offen" | "geht" | "vorbei">("offen");
  const [ohneBild, setOhneBild] = useState(false);
  const [ohneTeamBild, setOhneTeamBild] = useState<Record<string, boolean>>({});
  const leiste = useLeisteSichtbar();
  const wurzel = useRef<HTMLDivElement>(null);
  useSeitenRahmen(WORTE.seitenTitel);
  const auftaktGeht = useCallback(() => setAuftakt((a) => (a === "offen" ? "geht" : a)), []);
  const auftaktEnde = useCallback(() => setAuftakt("vorbei"), []);

  const S = sicht.seite, P = sicht.ansprechpartner, I = S.investition;
  const betreff = encodeURIComponent(`${WORTE.angebot} ${sicht.ref}`);

  return (
    <div ref={wurzel} className={`gaf${auftakt === "offen" ? " gaf-wartet" : ""}`} data-fiaon="angebot-firma">
      {auftakt !== "vorbei" && (
        <Glueckwunsch auge={S.auftakt.auge} gruss={S.auftakt.gruss} zeile={S.auftakt.zeile} weiter={S.auftakt.weiter} onWeg={auftaktGeht} onEnde={auftaktEnde} />
      )}

      <header className="gaf-leiste-oben">
        <div className="gaf-rahmen gaf-leiste-oben-innen">
          <MarkeGlobal hoehe={17} className="gaf-marke" />
          <span className="gaf-leiste-ref">{WORTE.angebot} {sicht.ref} · {WORTE.gueltig} {tagDe(sicht.gueltigBis)}</span>
        </div>
      </header>

      {sicht.vorschauLeitung && (
        <div className="gaf-rahmen"><p className="gaf-vorschau" role="note"><b>{WORTE.vorschau}</b> {WORTE.vorschauSatz}{sicht.fehlt && sicht.fehlt.length > 0 && <> {WORTE.fehlt} {sicht.fehlt.join(" · ")}.</>}</p></div>
      )}

      {/* 2 — Hero mit dem Glas */}
      <ProduktGlas3D glas={S.hero.glas} wegZeile={S.phasen.titel} wegSub={S.phasen.sub} bereit={auftakt !== "offen"}
        nach={<><p className="gaf-hero-unter">{S.hero.unter}</p><ul className="gaf-nutzen">{S.hero.nutzen.map((n) => <li key={n}>{n}</li>)}</ul></>}>
        <p className="gaf-auge gaf-auge-gold">{S.hero.auge}</p>
        <h1 className="gaf-h1">{S.hero.titel}</h1>
        <p className="gaf-hero-unter">{S.hero.unter}</p>
        <ul className="gaf-nutzen">{S.hero.nutzen.map((n) => <li key={n}>{n}</li>)}</ul>
        <a className="gaf-hero-anker" href="#ziele"><span>{S.ziele.titel}</span><Zeichen art="pfeilRunter" groesse={16} /></a>
      </ProduktGlas3D>

      <main className="gaf-inhalt">
        {/* 3 — Ihre Ziele */}
        <section className="gaf-abschnitt" id="ziele" aria-label={S.ziele.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.ziele.titel} sub={S.ziele.sub} />
            <ul className="gaf-ziele">
              {S.ziele.punkte.map((z, i) => (
                <Auf als="li" key={z.titel} verz={i * 90} className="gaf-ziel">
                  <span className="gaf-ziel-strich" aria-hidden="true" />
                  <h3>{z.titel}</h3>
                  <p>{z.text}</p>
                </Auf>
              ))}
            </ul>
          </div>
        </section>

        {/* 4 — Zeitstrahl */}
        <section className="gaf-abschnitt gaf-abschnitt-weg" id="weg" aria-label={S.phasen.titel}>
          <div className="gaf-rahmen">
            {/* „Ihr Weg in die Welt“ stand eben groß im Licht des Glases — hier als Auge, die Etappen tragen die Überschrift. */}
            <Kopf auge={S.phasen.titel} titel={S.phasen.sub} />
            <PhasenZeitstrahl liste={S.phasen.liste} />
          </div>
        </section>

        {/* 5 — Was Sie bekommen */}
        <section className="gaf-abschnitt" id="leistungen" aria-label={S.leistungen.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.leistungen.titel} sub={S.leistungen.sub} />
            <LeistungsKarten karten={S.leistungen.karten} />
          </div>
        </section>

        {/* 6 — Ihr Kapital */}
        <section className="gaf-abschnitt gaf-abschnitt-kapital" id="kapital" aria-label={S.kapital.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.kapital.titel} sub={S.kapital.sub} />
            <KapitalTafel k={S.kapital} />
          </div>
        </section>

        {/* 7 — Ihr Prüfbericht: die eine dunkle Navy-Bühne */}
        <ComplianceBuehne c={sicht.compliance} texte={S.pruefbericht} pdf={sicht.pruefberichtPdf} sonderfreigabe={S.kapital.sonderfreigabe.text.trim() ? S.kapital.sonderfreigabe : null} />

        {/* 8 — Ihre Investition */}
        <section className="gaf-abschnitt" id="investition" aria-label={I.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={I.titel} sub={I.sub} />
            <InvestitionsPosten posten={I.posten} />
            <Auf><UmsatzRechner r={I.rechner} /></Auf>
            {/* Was die Kundin direkt an Dritte zahlt, steht nur im Vertrag (Ziffer 10 Absatz 4) — Justin, 07.10.2026. */}
            <Auf className="gaf-feinhinweise">
              {I.fein.map((f) => <p key={f}>{f}</p>)}
            </Auf>
          </div>
        </section>

        {/* 9 — Fragen & Antworten */}
        <section className="gaf-abschnitt" id="fragen" aria-label={S.fragen.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={S.fragen.titel} sub={S.fragen.sub} />
            <FragenAntworten liste={S.fragen.liste} />
          </div>
        </section>

        {/* 10 — Ihr Ansprechpartner */}
        <section className="gaf-abschnitt" id="ansprechpartner" aria-label={S.ansprechpartner.titel}>
          <div className="gaf-rahmen">
            <Auf className="gaf-person" >
              <div className="gaf-person-bild">
                {ohneBild
                  ? <span className="gaf-person-mono" aria-hidden="true">{P.name.split(/\s+/).map((t) => t[0]).join("").slice(0, 2)}</span>
                  : <img src={P.portrait} alt={P.name} width={320} height={320} loading="lazy" decoding="async" onError={() => setOhneBild(true)} />}
                {!ohneBild && P.portraitHinweis && <span className="gaf-ki gaf-ki-rund">{P.portraitHinweis}</span>}
              </div>
              <div className="gaf-person-text">
                <p className="gaf-auge">{S.ansprechpartner.titel}</p>
                <h2 className="gaf-person-name">{P.name}</h2>
                <p className="gaf-person-rolle">{P.rolle}</p>
                <p className="gaf-sub">{S.ansprechpartner.sub}</p>
                <div className="gaf-person-wege">
                  <a href={`mailto:${P.email}?subject=${betreff}`}><Zeichen art="mail" groesse={18} /><span>{P.email}</span></a>
                  <a href={`tel:${P.telefon.replace(/\s/g, "")}`}><Zeichen art="telefon" groesse={18} /><span>{P.telefon}</span></a>
                </div>
              </div>
            </Auf>
            {/* Die Leitung aus ANGEBOT_ANSPRECHPARTNER (Justin 07.10.2026: nur Florentine Lombardi und Daniel Stripling). */}
            <div className="gaf-team" data-fiaon="firma-team">
              <Kopf titel={S.team.titel} sub={S.team.sub} />
              <ul className="gaf-team-raster">
                {S.team.personen.map((t, i) => (
                  <Auf als="li" key={t.name} verz={(i % 2) * 90} className="gaf-team-person">
                    <span className="gaf-team-bild">
                      {ohneTeamBild[t.name]
                        ? <span className="gaf-team-mono" aria-hidden="true">{t.initialen}</span>
                        : <img src={t.portrait} alt={t.name} width={240} height={240} loading="lazy" decoding="async" onError={() => setOhneTeamBild((o) => ({ ...o, [t.name]: true }))} />}
                    </span>
                    <span className="gaf-team-name">{t.name}</span>
                    <span className="gaf-team-rolle">{t.rolle}</span>
                    {t.portraitHinweis && !ohneTeamBild[t.name] && <span className="gaf-team-ki">{t.portraitHinweis}</span>}
                  </Auf>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 11 — Vertrag & Anlagen */}
        <section className="gaf-abschnitt" id="vertrag" aria-label={S.vertrag.titel}>
          <div className="gaf-rahmen">
            <Kopf titel={S.vertrag.titel} sub={S.vertrag.sub} />
            <VertragsLeser v={S.vertrag} html={sicht.html} pdfs={[
              { titel: WORTE.vertragPdf, href: sicht.vertragPdf },
              { titel: WORTE.anlage1, href: sicht.anlage1Pdf },
              { titel: WORTE.anlage2, href: sicht.pruefberichtPdf },
            ]} />
            <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          </div>
        </section>

        {/* 12 — Annahme */}
        <section className="gaf-abschnitt gaf-abschnitt-annahme" id="annahme" aria-label={sicht.annahme.titel}>
          <div className="gaf-rahmen gaf-rahmen-schmal">
            <Kopf titel={sicht.annahme.titel} sub={sicht.annahme.sub} auge={sicht.kunde.firma} />
            <AnnahmeFirma sicht={sicht} token={token} onAngenommen={onAngenommen} onNeuLaden={onNeuLaden} />
          </div>
        </section>
      </main>

      {/* 13 — Pflichthinweise, Bildnachweis, Fuß */}
      <footer className="gaf-fuss">
        <div className="gaf-rahmen">
          <MarkeGlobal hoehe={16} className="gaf-marke" />
          <ul className="gaf-pflicht">{S.pflicht.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="gaf-bildnachweis">{S.bildnachweis}</p>
          <p className="gaf-aufruf-hinweis">{ANGEBOT_AUFRUF_HINWEIS}</p>
          <p className="gaf-fuss-links"><a href="/impressum">{WORTE.impressum}</a> · <a href="/datenschutz">{WORTE.datenschutz}</a></p>
          <p className="gaf-fuss-ref">{WORTE.angebot} {sicht.ref} · {sicht.fassung}</p>
        </div>
      </footer>

      <a className={`gaf-leiste-unten${leiste ? " an" : ""}`} href="#annahme" aria-hidden={!leiste || undefined} tabIndex={leiste ? 0 : -1}>
        <span>{WORTE.zurAnnahme}</span><Zeichen art="pfeilRunter" groesse={16} />
      </a>
    </div>
  );
}
