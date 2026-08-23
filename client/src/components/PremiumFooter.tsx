export default function PremiumFooter() {
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

        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-16">
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

          {/* Column 2: Platform */}
          <div>
            <h3 className="pf-kopf text-[13px] font-medium uppercase tracking-[.15em] mb-6">
              PLATTFORM
            </h3>
            <ul className="space-y-4">
              <li>
                <a href="/" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Startseite
                </a>
              </li>
              <li>
                <a href="/ratgeber" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Ratgeber
                </a>
              </li>
              <li>
                <a href="/privatkunden" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Privatkunden Setup
                </a>
              </li>
              <li>
                <a href="/bonitaet-service" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Bonitäts-Auszug (Erklärung)
                </a>
              </li>
              <li>
                <a href="/business" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Business Setup
                </a>
              </li>
              <li>
                <a href="/preise" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Preise & Pakete
                </a>
              </li>
              <li>
                <a href="/kreditkarte" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Kreditkarte trotz Eintrag
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="pf-kopf text-[13px] font-medium uppercase tracking-[.15em] mb-6">
              UNTERNEHMEN
            </h3>
            <ul className="space-y-4">
              {[
                ["/was-ist-fiaon", "Über FIAON"],
                ["/sicherheit", "Datenschutz & Sicherheit"],
                ["/preise", "Preise & Pakete"],
                ["/kreditkarte", "Kreditkarte"],
                ["/team", "Team"],
                ["/karriere", "Karriere — Werden Sie Teil des Teams"],
                ["/partner", "Partner"],
                ["/presse", "Presse"],
                ["/investoren", "Investoren"],
                ["/datenraum", "Datenraum (Due Diligence)"],
                ["/kontakt", "Kontakt & Support"],
              ].map(([href, label]) => (
                <li key={href}>
                  <a href={href} className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="pf-kopf text-[13px] font-medium uppercase tracking-[.15em] mb-6">
              RECHTLICHES
            </h3>
            <ul className="space-y-4">
              <li>
                <a href="/impressum" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Impressum
                </a>
              </li>
              <li>
                <a href="/privacy" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Datenschutzerklärung
                </a>
              </li>
              <li>
                <a href="/agb" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Allgemeine Geschäftsbedingungen (AGB)
                </a>
              </li>
              <li>
                <a href="/widerrufsbelehrung" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Widerrufsbelehrung
                </a>
              </li>
              <li>
                <a href="/cookie-einstellungen" className="pf-text text-[14px] transition-all duration-200 hover:translate-x-1">
                  Cookie-Einstellungen
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer Block */}
        <div className="pt-8 mb-8" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <p className="pf-leise text-[12px] leading-relaxed">
            FIAON ist eine Software-as-a-Service (SaaS) und E-Learning-Plattform, bereitgestellt von der FIAON LTD (128 City Road, London, EC1V 2NX, United Kingdom · Companies House No. 17318250). FIAON ist kein Kreditinstitut, kein Finanzdienstleister und erbringt ausdrücklich keine Anlage-, Steuer- oder Rechtsberatung im Sinne des Kreditwesengesetzes (KWG). Ebenso betreiben wir keine Kredit- oder Darlehensvermittlung gemäß der Gewerbeordnung (insbesondere § 34c GewO). Wir vermitteln keine Finanzprodukte, setzen keine Affiliate-Tracking-Links ein und erhalten keinerlei Provisionen, Kick-backs oder erfolgsabhängige Vergütungen von Banken oder Kreditkartenherausgebern. Alle durch die Software generierten Daten, Analysen, Score-Simulationen und strategischen Dashboards dienen ausschließlich der finanziellen Bildung. Die Umsetzung der erlernten Strategien sowie die Antragstellung bei Finanzinstituten erfolgen vollumfänglich und in alleiniger Eigenverantwortung des Nutzers. Die finale Entscheidung über die Vergabe einer Kreditkarte oder die Gewährung eines spezifischen Kreditlimits obliegt zu 100 % dem jeweiligen Finanzinstitut. Es wird ausdrücklich keine Garantie, Haftung oder Gewährleistung für eine erfolgreiche Bewilligung übernommen.
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
        @media (prefers-reduced-motion: reduce) { .pf-text, .pf-kopf, .pf-leise { animation: none; } }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
        }
      `}</style>
    </footer>
  );
}
