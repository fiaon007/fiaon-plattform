// ═══════════════════════════════════════════════════════════════════════════
// DIE FUSSZEILE — aufgeräumt statt überladen (01.09.2026, Justin)
//
// VORHER: über 30 Links flach untereinander; die PLATTFORM-Spalte allein
// hatte 20 Zeilen. Auf dem Handy ein endloser Scrollweg, am PC eine Wand.
//
// NACHHER, drei Ideen:
//   1. Die Spalten tragen nur noch den KERN (je 5–10 Links).
//   2. Die 14 Ratgeber-/Themenseiten wohnen in einem eigenen, aufklappbaren
//      Band „Wissen von A bis Z" — sanfte Höhen-Animation, die Links blenden
//      gestaffelt ein. Zugeklappt ist es EINE Zeile statt vierzehn.
//   3. Am Handy wird jede Spalte zum Akkordeon (Pfeil dreht sich, Inhalt
//      gleitet auf); am PC stehen die Spalten fest offen — der Aufklapp-Kopf
//      wird dort zur normalen Überschrift.
//
// SEO bleibt intakt: ALLE Links stehen immer im HTML (nur per CSS-Höhe
// zusammengefaltet) — jede Themenseite bleibt von jeder Seite verlinkt.
// prefers-reduced-motion schaltet alle Bewegungen ab.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";

const WISSEN: [string, string][] = [
  ["/schufa-eintrag-loeschen", "SCHUFA-Eintrag löschen"],
  ["/bonitaet-verbessern", "Bonität verbessern"],
  ["/kredit-ohne-schufa", "Kredit ohne SCHUFA — die Wahrheit"],
  ["/auskunfteien", "Auskunfteien im Vergleich"],
  ["/schufa-score-verstehen", "SCHUFA-Score verstehen"],
  ["/bonitaetsauskunft-beantragen", "Bonitätsauskunft beantragen"],
  ["/inkasso-brief-erhalten", "Inkasso-Brief erhalten?"],
  ["/eintrag-verjaehrung", "Eintrag & Verjährung"],
  ["/girokonto-trotz-negativer-bonitaet", "Girokonto trotz negativer Bonität"],
  ["/ratenzahlung-und-bonitaet", "Ratenzahlung & Bonität"],
  ["/selbstauskunft-checkliste", "Selbstauskunft-Checkliste"],
  ["/schufa-neutral-anfragen", "SCHUFA-neutral anfragen"],
  ["/bonitaet-service", "Bonitäts-Auszug (Erklärung)"],
  ["/glossar-bonitaet", "Bonitäts-Glossar A–Z"],
];

const PLATTFORM: [string, string][] = [
  ["/", "Startseite"],
  ["/ratgeber", "Ratgeber"],
  ["/werkzeuge", "Kostenlose Werkzeuge"],
  ["/preise", "Preise & Pakete"],
  ["/kreditkarte", "Kreditkarte trotz Eintrag"],
  ["/privatkunden", "Privatkunden Setup"],
  ["/business", "Business Setup"],
];

const UNTERNEHMEN: [string, string][] = [
  ["/was-ist-fiaon", "Über FIAON"],
  ["/fiaon-erfahrungen", "So arbeitet FIAON"],
  ["/sicherheit", "Datenschutz & Sicherheit"],
  ["/team", "Team"],
  ["/karriere", "Karriere"],
  ["/partner", "Partner"],
  ["/presse", "Presse"],
  ["/investoren", "Investoren"],
  ["/datenraum", "Datenraum (Due Diligence)"],
  ["/kontakt", "Kontakt & Support"],
];

const RECHTLICHES: [string, string][] = [
  ["/impressum", "Impressum"],
  ["/privacy", "Datenschutzerklärung"],
  ["/agb", "Allgemeine Geschäftsbedingungen (AGB)"],
  ["/widerrufsbelehrung", "Widerrufsbelehrung"],
  ["/cookie-einstellungen", "Cookie-Einstellungen"],
];

/** Eine Spalte: am PC fest offen, am Handy ein Akkordeon. */
function Spalte({ titel, links }: { titel: string; links: [string, string][] }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className="pf-spalte">
      <button type="button" className="pf-spalte-kopf" aria-expanded={offen}
              onClick={() => setOffen(!offen)}>
        <span role="heading" aria-level={3} className="pf-kopf text-[13px] font-medium uppercase tracking-[.15em]">{titel}</span>
        <svg className={`pf-pfeil${offen ? " auf" : ""}`} width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`pf-falt${offen ? " auf" : ""}`}>
        <ul className="pf-falt-innen space-y-3.5 pt-1">
          {links.map(([href, label]) => (
            <li key={href + label}>
              <a href={href} className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1 inline-block">{label}</a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function PremiumFooter() {
  const [wissenOffen, setWissenOffen] = useState(false);
  return (
    <footer className="relative overflow-hidden" style={{ background: "#0A0F1C" }}>
      {/* Top Gradient Border */}
      <div className="h-px" style={{
        background: "linear-gradient(90deg, rgba(192, 192, 192, 0.3), rgba(10, 15, 28, 0.8), rgba(192, 192, 192, 0.3))"
      }} />

      {/* Main Footer Content */}
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        {/* Die Demo-Präsentation — der Kundenbereich, wie er gemeint ist (Justin, 23.08.2026: „in der Fußzeile schön präsentieren") */}
        {/* Nicht im Antrag und auf Zahlungsseiten — dort hat die Demo nichts verloren (Justin, 23.08.). */}
        {!/^\/(antrag|bonitaet-antrag|business-antrag|zahlung|termin|login|dashboard|mein-bereich)/.test(typeof window !== "undefined" ? window.location.pathname : "") && (
        <a href="/demo/kundenbereich" className="pf-demo" aria-label="Präsentation des Kundenbereichs öffnen">
          <span className="pf-demo-marke" aria-hidden="true"><i /></span>
          <span className="pf-demo-text"><b>Für Investoren und Partner:</b> Sehen Sie den Kundenbereich, wie er gemeint ist – eine geführte Präsentation in fünfzehn Stationen.</span>
          <span className="pf-demo-knopf">Präsentation ansehen<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></span>
        </a>
        )}

        {/* Marke + drei schlanke Spalten */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-16 gap-y-2 md:gap-y-10 mb-10">
          {/* Column 1: Brand & Mission */}
          <div>
            <div className="mb-6">
              <span className="text-2xl font-bold tracking-tight text-white fiaon-gradient-text-animated">
                FIAON
              </span>
            </div>
            <p className="pf-text text-[14px] leading-relaxed mb-6">
              Das Betriebssystem für Bonität: Einsicht, Aktion, Zugang. Für Deutschland, Österreich und die Schweiz.
            </p>
            {/* Trust Badge */}
            <div className="inline-block px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
              <span className="pf-text text-xs font-medium">Hosted in EU / DSGVO Compliant</span>
            </div>
          </div>

          <Spalte titel="Plattform" links={PLATTFORM} />
          <Spalte titel="Unternehmen" links={UNTERNEHMEN} />
          <Spalte titel="Rechtliches" links={RECHTLICHES} />
        </div>

        {/* ── WISSEN VON A BIS Z — ein Band statt vierzehn Zeilen ──────────── */}
        <div className={`pf-wissen${wissenOffen ? " auf" : ""} mb-12`}>
          <button type="button" className="pf-wissen-kopf" aria-expanded={wissenOffen}
                  onClick={() => setWissenOffen(!wissenOffen)}>
            <span className="pf-wissen-titel">
              <span role="heading" aria-level={3} className="pf-kopf text-[13px] font-medium uppercase tracking-[.15em]">Wissen von A bis Z</span>
              <span className="pf-wissen-zahl">{WISSEN.length} Ratgeber-Themen</span>
            </span>
            <span className="pf-wissen-hinweis pf-leise text-[12px]">
              {wissenOffen ? "Einklappen" : "Alle Themen zeigen"}
            </span>
            <svg className={`pf-pfeil gross${wissenOffen ? " auf" : ""}`} width="16" height="16" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div className={`pf-falt${wissenOffen ? " auf" : ""}`}>
            <ul className="pf-falt-innen pf-wissen-raster">
              {WISSEN.map(([href, label], i) => (
                <li key={href} style={{ transitionDelay: wissenOffen ? `${60 + i * 28}ms` : "0ms" }}>
                  <a href={href} className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1 inline-block">{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer Block */}
        <div className="pt-8 mb-8" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <p className="pf-leise text-[12px] leading-relaxed">
            FIAON ist eine Software-as-a-Service (SaaS) und E-Learning-Plattform, bereitgestellt von der FIAON LTD (128 City Road, London, EC1V 2NX, United Kingdom · Companies House No. 17318250). FIAON ist kein Kreditinstitut, kein Finanzdienstleister und erbringt ausdrücklich keine Anlage-, Steuer- oder Rechtsberatung im Sinne des Kreditwesengesetzes (KWG). Ebenso betreiben wir keine Kredit- oder Darlehensvermittlung gemäß der Gewerbeordnung (insbesondere § 34c GewO). Wir setzen keine Affiliate-Tracking-Links ein. Soweit FIAON im Rahmen von Partnerschaften mit Banken oder anderen Anbietern eine Vergütung erhält, hat dies keinen Einfluss auf die Darstellung oder Empfehlung; die Entscheidung über jedes Finanzprodukt trifft ausschließlich der jeweilige Anbieter. Alle durch die Software generierten Daten, Analysen, Score-Simulationen und strategischen Dashboards dienen ausschließlich der finanziellen Bildung. Die Umsetzung der erlernten Strategien sowie die Antragstellung bei Finanzinstituten erfolgen vollumfänglich und in alleiniger Eigenverantwortung des Nutzers. Die finale Entscheidung über die Vergabe einer Kreditkarte oder die Gewährung eines spezifischen Kreditlimits obliegt zu 100 % dem jeweiligen Finanzinstitut. Es wird ausdrücklich keine Garantie, Haftung oder Gewährleistung für eine erfolgreiche Bewilligung übernommen.
          </p>
        </div>

        {/* Final Line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
          {/* Copyright */}
          <span className="pf-leise text-[12px]">
            © 2026 FIAON – FIAON LTD, Registered in England and Wales, Companies House No. 17318250 · Director: Justin Schwarzott. Alle Rechte vorbehalten. / All rights reserved.
          </span>

          {/* ── MITARBEITER-ZUGANG ────────────────────────────────────────────
              Dezent in der Fußzeile, neben dem Systemstatus — nicht in der
              Hauptnavigation.

              Der Grund: Ein Kunde, der „Mitarbeiter-Login" oben im Menü
              sieht, fragt sich, ob er hier richtig ist. Wer den Zugang
              braucht, sind zehn Menschen, die ihn kennen — und die suchen
              unten, nicht oben.

              Keine Nennung von „Agent" oder „Vertrieb": Die Fußzeile einer
              Kundenseite soll nicht verraten, wie das Haus innen gebaut ist. */}
          <div className="flex items-center gap-5">
            <a href="/agent"
               className="group inline-flex items-center gap-1.5 pf-leise text-[12px] transition-colors duration-200"
               title="Zugang für FIAON-Mitarbeiter">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
                   className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                   aria-hidden="true">
                <rect x="4.5" y="8.5" width="11" height="8" rx="2" />
                <path d="M7.5 8.5V6.5a2.5 2.5 0 0 1 5 0v2" />
              </svg>
              Mitarbeiter-Zugang
            </a>

            {/* System Status */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation: "pulse 2s ease-in-out infinite" }} />
              <span className="pf-leise text-[12px]">System Status: All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* Fußzeile: kein grelles Weiß. Die Schrift trägt einen sanften, langsam
           wandernden Verlauf aus Silber und Hellblau — seriös, ruhig, lesbar. */
        .pf-text, .pf-kopf, .pf-leise {
          background: linear-gradient(100deg, #c3ccd9 0%, #9fb8e6 30%, #d6dde8 55%, #a9c4ee 80%, #c3ccd9 100%);
          background-size: 300% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: pfVerlauf 18s linear infinite;
        }
        .pf-kopf { opacity: .95; }
        .pf-leise { opacity: .72; }
        a.pf-text:hover, a.pf-leise:hover { opacity: 1; background-image: linear-gradient(100deg, #ffffff, #dbeafe); }
        @keyframes pfVerlauf { from { background-position: 0% 50%; } to { background-position: 300% 50%; } }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        /* ── Auf- und Zuklappen: die Höhe gleitet über den Gitter-Trick
           (0fr → 1fr) — weich, ohne feste Pixelhöhen, ohne Springen. */
        .pf-falt {
          display: grid; grid-template-rows: 0fr;
          transition: grid-template-rows .45s cubic-bezier(.22,.8,.26,1);
        }
        .pf-falt.auf { grid-template-rows: 1fr; }
        .pf-falt-innen { overflow: hidden; min-height: 0; margin: 0; }
        .pf-pfeil { transition: transform .35s cubic-bezier(.22,.8,.26,1); color: #9fb8e6; opacity: .8; }
        .pf-pfeil.auf { transform: rotate(180deg); }

        /* Spalten-Köpfe: am Handy Knöpfe mit Trennlinie, volle Breite. */
        .pf-spalte-kopf {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          width: 100%; background: none; border: 0; padding: 12px 0; cursor: pointer; text-align: left;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .pf-spalte .pf-falt-innen { padding: 0; list-style: none; transition: padding .45s cubic-bezier(.22,.8,.26,1); }
        .pf-spalte .pf-falt.auf .pf-falt-innen { padding: 14px 0 6px; }

        /* Am PC (lg) stehen die Spalten fest offen: Kopf wird zur Überschrift,
           Pfeil verschwindet, nichts ist klickbar. */
        @media (min-width: 1024px) {
          .pf-spalte-kopf { pointer-events: none; border-bottom: 0; padding: 0 0 18px; }
          .pf-spalte-kopf .pf-pfeil { display: none; }
          .pf-spalte .pf-falt { grid-template-rows: 1fr; }
          .pf-spalte .pf-falt-innen { padding: 0 0 6px; }
        }

        /* ── Das Wissens-Band: eine ruhige Glasfläche, die sich öffnet. ── */
        .pf-wissen {
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.015));
          transition: border-color .4s ease, background .4s ease;
        }
        .pf-wissen.auf { border-color: rgba(159,184,230,.28); }
        .pf-wissen-kopf {
          display: flex; align-items: center; gap: 14px; width: 100%;
          background: none; border: 0; cursor: pointer; text-align: left;
          padding: 16px 20px;
        }
        .pf-wissen-titel { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; flex: 1; min-width: 0; }
        .pf-wissen-zahl {
          font-size: 11.5px; letter-spacing: .02em; color: #9fb8e6; opacity: .85;
          border: 1px solid rgba(159,184,230,.3); border-radius: 999px; padding: 2px 10px; white-space: nowrap;
        }
        .pf-wissen-hinweis { white-space: nowrap; }
        .pf-pfeil.gross { flex-shrink: 0; }
        .pf-wissen .pf-falt-innen { padding: 0 20px; transition: padding .45s cubic-bezier(.22,.8,.26,1); }
        .pf-wissen.auf .pf-falt-innen { padding: 4px 20px 18px; }

        /* Die Themen als luftiges Raster: 1 Spalte am Handy, bis 3 am PC.
           Beim Öffnen gleiten die Links gestaffelt herein (transition-delay
           kommt je Eintrag aus dem Markup). */
        .pf-wissen-raster {
          display: grid; grid-template-columns: 1fr; gap: 12px 32px; list-style: none;
        }
        @media (min-width: 640px) { .pf-wissen-raster { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .pf-wissen-raster { grid-template-columns: 1fr 1fr 1fr; } }
        .pf-wissen-raster li {
          opacity: 0; transform: translateY(6px);
          transition: opacity .4s ease, transform .4s cubic-bezier(.22,.8,.26,1);
        }
        .pf-wissen.auf .pf-wissen-raster li { opacity: 1; transform: none; }

        @media (prefers-reduced-motion: reduce) {
          .pf-text, .pf-kopf, .pf-leise { animation: none; }
          .pf-falt, .pf-pfeil, .pf-wissen, .pf-wissen-raster li { transition: none; }
        }
      `}</style>
    </footer>
  );
}
