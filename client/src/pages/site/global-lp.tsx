// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DIE ANZEIGEN-LANDINGPAGE (19.09.2026, E-191)
//
// Eine Seite hinter einer Anzeige. Google bewertet sie nach Relevanz,
// Transparenz und Tempo; der Mensch dahinter hat genau eine Frage — „ist das
// seriös, was kostet es, wie fange ich an?". Darum: kein Menü, die Überschrift
// wiederholt die Suche, der Festpreis steht oben, der Kalender gleich darunter,
// Vertragspartner und Registernummer im Kopf. Nicht im Index (noindex,follow).
// Konto, Karten und Kapitalrahmen stehen hier bewusst NICHT im Blickfang —
// Googles Regeln für Finanzanzeigen (siehe shared/fiaon-global-seiten/landingpages.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Auf, Fragen } from "@/components/site/DunkleBuehne";
import GlobalGespraech from "@/components/site/GlobalGespraech";
import NotFound from "@/pages/not-found";
import { globalLandingpage } from "@shared/fiaon-global-seiten";
import { GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_GELD_ZURUECK, globalPaket, globalPreisText } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { seoSeite } from "@shared/fiaon-seo-seiten";
import { FIAON_FIRMA } from "@shared/fiaon-firma";
import { werbeEreignis } from "@/lib/werbung";
import { Haken, Pfeil, Standorte } from "@/pages/site/global-seite";
import "@/styles/global.css";
import "@/styles/global-seiten.css";

export default function GlobalLandingPage() {
  const lp = globalLandingpage(typeof window !== "undefined" ? window.location.pathname : "");
  useEffect(() => {
    if (!lp) return;
    const e = seoSeite(lp.pfad);
    document.title = e?.titel ?? lp.seo.titel;
    window.scrollTo(0, 0);
  }, [lp?.pfad]);
  if (!lp) return <NotFound />;
  const paket = globalPaket(lp.paket)!;
  const zumGespraech = (e: React.MouseEvent) => { e.preventDefault(); document.getElementById("gespraech")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); };

  return (
    <div className="fg fd" style={{ minHeight: "100vh", background: "var(--papier)" }}>
      {/* ── Schlanker Kopf: Marke, Vertragspartner, eine Handlung ─────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(255,255,255,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--linie)" }}>
        <div className="fg-rahmen" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 66 }}>
          <a href="/business" style={{ display: "flex", alignItems: "baseline", gap: 10, textDecoration: "none" }}>
            <b style={{ fontSize: 19, letterSpacing: "-.01em", color: "var(--tinte)" }}>FIAON</b>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 16, color: "var(--navy)" }}>Global</span>
          </a>
          <a className="fg-knopf" href="#gespraech" onClick={zumGespraech} style={{ minHeight: 42, padding: "0 18px", fontSize: 13.5 }}>Gespräch vereinbaren</a>
        </div>
      </header>

      {/* ── Kopf ────────────────────────────────────────────────────────── */}
      <section className="fd-kopf" style={{ paddingTop: 72 }}>
        <div className="fg-rahmen fd-kopf-raster">
          <Auf>
            <span className="fg-auge">{lp.auge}</span>
            <h1 className="fg-h1 fd-h1">{lp.h1}{lp.h1b && <><br /><em>{lp.h1b}</em></>}</h1>
            <p className="fd-lead">{lp.lead}</p>
            <ul className="fd-punkte" style={{ marginTop: 22 }}>{lp.vorteile.map((v) => <li key={v}><Haken />{v}</li>)}</ul>
            <div className="fg-knoepfe">
              <a className="fg-knopf" href={globalStartPfad(lp.paket, "de")} onClick={() => werbeEreignis("global_beauftragen_klick", { paket: lp.paket, seite: lp.pfad })}>{paket.de.name} beauftragen<Pfeil /></a>
              <a className="fg-knopf hell" href="#gespraech" onClick={zumGespraech}>Erst sprechen — dreißig Minuten</a>
            </div>
          </Auf>
          <Auf verzoegerung={120}>
            <aside className="fd-merkblatt" aria-label="Das Wichtigste">
              <div className="fd-merkblatt-kopf"><b>{paket.de.name}</b><span>Festpreis</span></div>
              <div style={{ padding: "22px 24px 8px" }}>
                <div className="fg-preis" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                  <b className="fg-glanz">{globalPreisText(lp.paket)}</b>
                  <span>Festpreis · einmalig · alle Gebühren inklusive</span>
                </div>
              </div>
              <dl>
                <div><dt>Vertragspartner</dt><dd>{FIAON_FIRMA.name}, London · Companies House {FIAON_FIRMA.companyNo}</dd></div>
                <div><dt>Vor Ort</dt><dd>Schwarzott Global LLC, Miami</dd></div>
                <div><dt>Begleitung</dt><dd>{paket.de.dauer}</dd></div>
                <div><dt>{GLOBAL_GELD_ZURUECK.de.titel}</dt><dd>{GLOBAL_GELD_ZURUECK.de.text}</dd></div>
              </dl>
              <div className="fd-merkblatt-fuss"><span>Für Unternehmen und Privatpersonen</span><span>DE · AT · CH</span></div>
            </aside>
          </Auf>
        </div>
      </section>

      {/* ── Gespräch ────────────────────────────────────────────────────── */}
      <section id="gespraech" className="fg-sek stein" style={{ scrollMarginTop: 72, paddingTop: 72 }}>
        <div className="fg-rahmen">
          <div className="fg-kopf">
            <div><span className="fg-auge">Gespräch</span><h2 className="fg-h2">Erst sprechen, dann entscheiden.</h2></div>
            <p className="fg-lead">Dreißig Minuten mit Ihrem Ansprechpartner: Vorhaben, Wohnsitz, Ziel — und welches Paket passt. Ohne Verpflichtung.</p>
          </div>
          <GlobalGespraech paket={lp.paket} />
        </div>
      </section>

      {/* ── Pakete ──────────────────────────────────────────────────────── */}
      <section className="fg-sek eng">
        <div className="fg-rahmen">
          <span className="fg-auge">Pakete</span>
          <h2 className="fg-h2">Vier Pakete. Ein Festpreis, alles inklusive.</h2>
          <div className="fd-pakete" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {GLOBAL_PAKETE.map((p) => (
              <a key={p.key} className={`fd-paket${p.key === lp.paket ? " fokus" : ""}`} href={globalStartPfad(p.key, "de")} onClick={() => werbeEreignis("global_beauftragen_klick", { paket: p.key, seite: lp.pfad })}>
                <span className="marke">{p.de.marke}</span>
                <span className="name">{p.de.name}</span>
                <span style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text)", fontWeight: 300, marginTop: 6 }}>{p.de.fuer}</span>
                <span className="zeile"><span>{p.de.dauerKurz.charAt(0).toUpperCase() + p.de.dauerKurz.slice(1)}</span><b>{globalPreisText(p.key)}</b></span>
                <span className="pfeil"><Pfeil /></span>
              </a>
            ))}
          </div>
          <p className="fg-paket-fuss">Unternehmen: zuzüglich Umsatzsteuer, soweit sie anfällt. Privatpersonen: Endpreise.</p>
        </div>
      </section>

      {/* ── Standorte, Fragen, Hinweise ─────────────────────────────────── */}
      <section className="fg-sek stein eng">
        <div className="fg-rahmen">
          <span className="fg-auge">Drei Standorte, ein Vertrag</span>
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
      <footer style={{ borderTop: "1px solid var(--linie)", padding: "28px 0 40px", background: "var(--stein)" }}>
        <div className="fg-rahmen" style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", justifyContent: "space-between", fontSize: 12.5, color: "var(--leise)" }}>
          <span>{FIAON_FIRMA.name} · {FIAON_FIRMA.strasse} · {FIAON_FIRMA.ortZeile} · Companies House {FIAON_FIRMA.companyNo}</span>
          <span style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a href="/business" style={{ color: "var(--navy)" }}>FIAON Global</a>
            {/* 19.09.2026: Rechtliches der Business-Welt — die AGB der Privatkunden-Linie gelten für FIAON Global nicht. */}
            <a href="/impressum?bereich=business" style={{ color: "var(--navy)" }}>Impressum</a>
            <a href="/datenschutz?bereich=business" style={{ color: "var(--navy)" }}>Datenschutz</a>
            <a href="/business/mustervertrag" style={{ color: "var(--navy)" }}>Mustervertrag</a>
            <a href="/business/widerrufsbelehrung" style={{ color: "var(--navy)" }}>Widerrufsbelehrung</a>
            <a href="/cookie-einstellungen?bereich=business" style={{ color: "var(--navy)" }}>Cookie-Einstellungen</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
