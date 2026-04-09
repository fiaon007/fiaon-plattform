export default function PremiumFooter() {
  return (
    <footer className="relative overflow-hidden" style={{ background: "#0A0F1C" }}>
      {/* Top Gradient Border */}
      <div className="h-px" style={{
        background: "linear-gradient(90deg, rgba(192, 192, 192, 0.3), rgba(10, 15, 28, 0.8), rgba(192, 192, 192, 0.3))"
      }} />

      {/* Main Footer Content */}
      <div className="max-w-[1280px] mx-auto px-6 py-16">
        {/* 4-Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 mb-16">
          {/* Column 1: Brand & Mission */}
          <div>
            <div className="mb-6">
              <span className="text-2xl font-bold tracking-tight text-white fiaon-gradient-text-animated">
                FIAON
              </span>
            </div>
            <p className="text-[14px] text-gray-400 leading-relaxed mb-6">
              Die unabhängige SaaS-Plattform für datenbasierte Finanzstrategien und Credit-Building. Keine Bank. Kein Makler. 100 % Technologie.
            </p>
            {/* Trust Badge */}
            <div className="inline-block px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg">
              <span className="text-xs font-semibold text-gray-300">Hosted in EU / DSGVO Compliant</span>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div>
            <h3 className="text-[13px] font-bold text-white uppercase tracking-[.15em] mb-6">
              PLATTFORM
            </h3>
            <ul className="space-y-4">
              <li>
                <a href="/" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Startseite
                </a>
              </li>
              <li>
                <a href="/privatkunden" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Privatkunden Setup
                </a>
              </li>
              <li>
                <a href="/business" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Business Setup
                </a>
              </li>
              <li>
                <a href="/plattform-konzept" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Preise & Pakete
                </a>
              </li>
              <li>
                <a href="/plattform-konzept" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Kartenkompass (Daten-Insights)
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Company */}
          <div>
            <h3 className="text-[13px] font-bold text-white uppercase tracking-[.15em] mb-6">
              UNTERNEHMEN
            </h3>
            <ul className="space-y-4">
              <li>
                <a href="/plattform-konzept" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Die Engine (Technologie & Konzept)
                </a>
              </li>
              <li>
                <a href="/was-ist-fiaon" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Unsere Methodik (US Credit-Building)
                </a>
              </li>
              <li>
                <a href="/was-ist-fiaon" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Über FIAON
                </a>
              </li>
              <li>
                <a href="/plattform-konzept" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Sicherheit & Architektur
                </a>
              </li>
              <li>
                <a href="mailto:support@fiaon.com" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Kontakt & Support
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h3 className="text-[13px] font-bold text-white uppercase tracking-[.15em] mb-6">
              RECHTLICHES
            </h3>
            <ul className="space-y-4">
              <li>
                <a href="#" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Impressum
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Datenschutzerklärung
                </a>
              </li>
              <li>
                <a href="/terms" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Allgemeine Geschäftsbedingungen (AGB)
                </a>
              </li>
              <li>
                <a href="#" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Widerrufsbelehrung
                </a>
              </li>
              <li>
                <a href="#" className="text-[14px] text-gray-400 hover:text-white transition-all duration-200 hover:translate-x-1">
                  Cookie-Einstellungen
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer Block */}
        <div className="pt-8 mb-8" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <p className="text-[12px] text-gray-500 leading-relaxed">
            FIAON ist eine Software-as-a-Service (SaaS) und E-Learning-Plattform, bereitgestellt von der Schwarzott Capital Partners AG (Zürich, Schweiz). EU-Vertreter gemäß Art. 27 DSGVO: [Name/Firma in Deutschland].
            FIAON ist keine Bank, kein Kreditvermittler und erbringt keine Anlage- oder Rechtsberatung im Sinne der GewO oder des KWG. Wir vermitteln keine Finanzprodukte, nutzen keine Affiliate-Tracking-Links und erhalten keine Provisionen von Kreditkartenherausgebern. Alle von der Software generierten Analysen und Strategien dienen ausschließlich der finanziellen Bildung und erfordern die eigenverantwortliche Umsetzung durch den Nutzer. Die finale Entscheidung über eine Kreditkartenvergabe oder Limit-Erhöhung obliegt zu 100 % dem jeweiligen Finanzinstitut. Es besteht keine Garantie auf Bewilligung.
          </p>
        </div>

        {/* Final Line */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4" style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)" }}>
          {/* Copyright */}
          <span className="text-[12px] text-gray-600">
            © 2026 FIAON – Ein Produkt der SCP Real Estate KG - Schwarzott Group. Alle Rechte vorbehalten.
          </span>

          {/* System Status */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" style={{ animation: "pulse 2s ease-in-out infinite" }} />
            <span className="text-[12px] text-gray-500">System Status: All Systems Operational</span>
          </div>
        </div>
      </div>

      <style>{`
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
