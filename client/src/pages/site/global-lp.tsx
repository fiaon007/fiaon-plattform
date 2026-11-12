// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ANZEIGEN-LANDINGPAGE (19.09.2026, E-191)
//
// Eine Seite hinter einer Anzeige. Google bewertet sie nach Relevanz,
// Transparenz und Tempo; der Mensch dahinter hat genau eine Frage — „ist das
// seriös, was kostet es, wie fange ich an?". Darum: kein Menü, die Überschrift
// wiederholt die Suche, der Preis steht oben, der Kalender gleich darunter,
// Vertragspartner und Registernummer im Kopf. Nicht im Index (noindex,follow).
// Konto, Karten und Kapitalrahmen stehen hier bewusst NICHT im Blickfang —
// Googles Regeln für Finanzanzeigen (siehe shared/fiaon-global-seiten/landingpages.ts).
// E-509 (12.11.2026): EIN Produkt statt vier Pakete — der eine Preis aus EIN_PRODUKT, der Knopf führt zum Konfigurator.
// Das Erfolgshonorar wird offen genannt (fällig mit der Eintragung), ohne Kapital oder Bürgschaft herauszustellen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import NotFound from "@/pages/not-found";
import { globalLandingpage } from "@shared/fiaon-global-seiten";
import { GLOBAL_PFLICHTHINWEIS } from "@shared/fiaon-global";
import { EIN_PRODUKT } from "@shared/fiaon-global-seiten/ein-produkt";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { seoSeite } from "@shared/fiaon-seo-seiten";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { werbeEreignis } from "@/lib/werbung";
import { Haken, Pfeil, Standorte } from "@/pages/site/global-seite";
import "@/styles/global.css";
import "@/styles/global-seiten.css";
import "@/styles/global-rahmen.css";
import "@/styles/global-apple.css";
import { FiaonWortmarke, MARKE_NAVY } from "@/components/marke/FiaonWortmarke";
import { useApfelBewegung } from "@/components/site/global/ApfelBewegung";
import { ohneBindestrichBruch } from "@/components/site/global/Wortbruch";
import "@/styles/global-rahmen-apple.css";

export default function GlobalLandingPage() {
  const lp = globalLandingpage(typeof window !== "undefined" ? window.location.pathname : "");
  useApfelBewegung();
  // Wie die Business-Seiten: Das Dokument scrollt (styles/global-rahmen.css, fg-dokument).
  useEffect(() => {
    document.documentElement.classList.add("fg-dokument");
    return () => document.documentElement.classList.remove("fg-dokument");
  }, []);
  useEffect(() => {
    if (!lp) return;
    const e = seoSeite(lp.pfad);
    document.title = e?.titel ?? lp.seo.titel;
    window.scrollTo(0, 0);
  }, [lp?.pfad]);
  if (!lp) return <NotFound />;
  const P = EIN_PRODUKT.de;
  // ?paket= stellt im Konfigurator nur noch den Start-Rahmen des Reglers.
  const start = globalStartPfad(lp.paket, "de");
  const klick = () => werbeEreignis("global_beauftragen_klick", { paket: lp.paket, seite: lp.pfad });
  const zumGespraech = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };

  return (
    <div className="fg fd lp">
      {/* ── Schlanker Kopf: Marke, Vertragspartner, eine Handlung ─────────── */}
      {/* E-442 (27.10.2026): Kopf als schwebende Glaspille, Stile in global-apple.css (.lp-*) statt inline. */}
      <header className="lp-kopf">
        <div className="lp-kopf-innen">
          <a href="/" className="lp-marke">
            <FiaonWortmarke variante="global" hoehe={20} farbe={MARKE_NAVY} />
          </a>
          <a className="fg-knopf lp-knopf" href="#gespraech" onClick={zumGespraech}>Gespräch vereinbaren</a>
        </div>
      </header>

      {/* ── Kopf ────────────────────────────────────────────────────────── */}
      <section className="fd-kopf" style={{ paddingTop: 72 }}>
        <div className="fg-rahmen fd-kopf-raster">
          <Auf>
            <span className="fg-auge">{lp.auge}</span>
            <h1 className="fg-h1 fd-h1">{ohneBindestrichBruch(lp.h1)}{lp.h1b && <><br /><em>{ohneBindestrichBruch(lp.h1b)}</em></>}</h1>
            <p className="fd-lead">{lp.lead}</p>
            <ul className="fd-punkte" style={{ marginTop: 22 }}>{lp.vorteile.map((v) => <li key={v}><Haken />{v}</li>)}</ul>
            <div className="fg-knoepfe">
              <a className="fg-knopf" href={start} onClick={klick}>Angebot zusammenstellen<Pfeil /></a>
              <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>Erst sprechen — dreißig Minuten</a>
            </div>
          </Auf>
          <Auf verzoegerung={120}>
            <aside className="fd-merkblatt" aria-label="Das Wichtigste">
              <div className="fd-merkblatt-kopf"><b>{P.name}</b><span>Ein Auftrag</span></div>
              <div style={{ padding: "22px 24px 8px" }}>
                <div className="fg-preis" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                  <b className="fg-glanz">{P.preis}</b>
                  <span>mit Ihrem Auftrag · erstes Jahr inklusive · Endpreis</span>
                </div>
              </div>
              <dl>
                <div><dt>Vertragspartner</dt><dd>{FIAON_FIRMA.name}, London · Companies House {FIAON_FIRMA.companyNo}</dd></div>
                <div><dt>Vor Ort</dt><dd>Schwarzott Group, Miami</dd></div>
                <div><dt>Mit der Eintragung</dt><dd>Erfolgshonorar — Ihren Preis zeigt der Konfigurator</dd></div>
                <div><dt>Ab dem zweiten Jahr</dt><dd>Jahresbetreuung auf Wunsch, {P.jahres} im Jahr</dd></div>
              </dl>
              <div className="fd-merkblatt-fuss"><span>Für Unternehmer und Privatpersonen</span><span>DE · AT · CH</span></div>
            </aside>
          </Auf>
        </div>
      </section>

      {/* ── Gespräch ────────────────────────────────────────────────────── */}
      <section id="gespraech" className="fg-sek stein" style={{ scrollMarginTop: 72, paddingTop: 72 }}>
        <div className="fg-rahmen">
          <div className="fg-kopf">
            <div><span className="fg-auge">Gespräch</span><h2 className="fg-h2">Erst sprechen, dann entscheiden.</h2></div>
            <p className="fg-lead">Dreißig Minuten mit Ihrem Ansprechpartner: Vorhaben, Wohnsitz, Ziel — und was dazu passt. Ohne Verpflichtung.</p>
          </div>
          <GlobalGespraech />
        </div>
      </section>

      {/* ── Ein Auftrag (bis E-509: die vier Pakete) ───────────────────────── */}
      <section className="fg-sek eng">
        <div className="fg-rahmen">
          <span className="fg-auge">Ihr Auftrag</span>
          <h2 className="fg-h2">Ein Auftrag. Ein Ansprechpartner.</h2>
          <div className="fd-pakete" style={{ gridTemplateColumns: "minmax(240px,520px)" }}>
            <a className="fd-paket fokus" href={start} onClick={klick}>
              <span className="marke">Angebot zusammenstellen</span>
              <span className="name">{P.name}</span>
              <span className="zeile"><span>Mit Ihrem Auftrag, erstes Jahr inklusive</span><b>{P.preis}</b></span>
              <span className="pfeil"><Pfeil /></span>
            </a>
          </div>
          <p className="fg-paket-fuss">Alle Beträge sind Endpreise. Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig; Ihren Preis zeigt der Konfigurator. Ab dem zweiten Jahr auf Wunsch die Jahresbetreuung für {P.jahres} im Jahr.</p>
        </div>
      </section>

      {/* ── Standorte, Fragen, Hinweise ─────────────────────────────────── */}
      <section className="fg-sek stein eng">
        <div className="fg-rahmen">
          {/* E-466/E-233: „ein Ansprechpartner“ statt „ein Vertrag“ (Partner arbeiten auf eigenes Mandat). */}
          <span className="fg-auge">Drei Standorte, ein Ansprechpartner</span>
          <Standorte />
        </div>
      </section>
      <section className="fg-sek eng">
        <div className="fg-rahmen schmal">
          <span className="fg-auge">Häufige Fragen</span>
          <div className="fd-fragen"><Fragen items={lp.fragen} /></div>
          <div className="fd-hinweis" style={{ marginTop: 36 }}>
            <span className="fd-marke">Was Sie wissen müssen</span>
            <ol>{GLOBAL_PFLICHTHINWEIS.de.map((h) => <li key={h.slice(0, 40)}><span>{h}</span></li>)}</ol>
          </div>
          <p className="fg-leise" style={{ marginTop: 24 }}>Mehr zu diesem Thema: <a href={lp.quelle} style={{ color: "var(--navy)" }}>{seoSeite(lp.quelle)?.h1 ?? "FIAON Global"}</a></p>
        </div>
      </section>

      {/* ── Fuß: nur das Nötige ─────────────────────────────────────────── */}
      <footer className="lp-fuss">
        <div className="fg-rahmen lp-fuss-innen">
          <span>{FIAON_FIRMA.name} · {FIAON_FIRMA.strasse} · {FIAON_FIRMA.ortZeile} · Companies House {FIAON_FIRMA.companyNo} · FIAON ist keine Bank und keine Kanzlei.</span>
          <span className="lp-fuss-links">
            <a href="/">FIAON Global</a>
            {/* 19.09.2026: Rechtliches der Business-Welt — die AGB der Privatkunden-Linie gelten für FIAON Global nicht. */}
            <a href="/impressum?bereich=business">Impressum</a>
            <a href="/datenschutz?bereich=business">Datenschutz</a>
            <a href="/business/mustervertrag">Mustervertrag</a>
            <a href="/business/widerrufsbelehrung">Widerrufsbelehrung</a>
            <a href="/cookie-einstellungen?bereich=business">Cookie-Einstellungen</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
