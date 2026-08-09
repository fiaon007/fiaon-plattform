import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

export default function ImpressumPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav />
      <div className="relative overflow-hidden">
        {/* Ambient background orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24">
          {/* Header */}
          <div className="text-center mb-10 animate-[fadeInUp_.6s_ease]">
            <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Impressum / Legal Notice</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
              Anbieterkennzeichnung gemäß § 5 Digitale-Dienste-Gesetz (DDG) sowie § 18 Abs. 2 Medienstaatsvertrag (MStV)
            </p>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mt-1">
              Provider identification pursuant to § 5 DDG (German Digital Services Act) and § 18 (2) MStV
            </p>
            {/* Anker-Navigation DE / EN */}
            <div className="flex items-center justify-center gap-3 mt-6">
              <a href="#impressum-de" className="px-5 py-2 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Deutsch</a>
              <a href="#impressum-en" className="px-5 py-2 rounded-full text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700 transition-colors">English</a>
            </div>
          </div>

          <div id="impressum-de" className="scroll-mt-24" />

          {/* Content */}
          <div className="space-y-8 animate-[fadeInUp_.8s_ease]">
            {/* Company Info */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <p className="text-sm text-gray-500 mb-4">Die Website und Plattform „FIAON" wird betrieben durch die:</p>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold text-lg">FIAON LTD</p>
                  <p>128 City Road</p>
                  <p>London, EC1V 2NX</p>
                  <p>Vereinigtes Königreich (United Kingdom)</p>
                  <p className="pt-2 text-sm">Eine nach dem Recht von England und Wales gegründete Limited Company (Companies Act 2006).</p>
                </div>
              </div>
            </div>

            {/* Representation */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Vertretungsberechtigte Personen</h2>
                <p className="text-gray-700">
                  Vertreten durch den vertretungsberechtigten Director: Justin Schwarzott
                </p>
              </div>
            </div>

            {/* Contact */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Kontakt</h2>
                <div className="space-y-2 text-gray-700">
                  <p>E-Mail: support@fiaon.com</p>
                  <p className="text-sm text-gray-500">Die Kontaktaufnahme ist in deutscher und englischer Sprache möglich.</p>
                </div>
              </div>
            </div>

            {/* Registry */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Registereintrag</h2>
                <div className="space-y-2 text-gray-700">
                  <p>Eingetragen im Gesellschaftsregister für England und Wales (Companies House).</p>
                  <p>Registerbehörde: Companies House (England and Wales)</p>
                  <p>Company Registration Number: 17318250</p>
                  <p>Gegründet nach dem Companies Act 2006.</p>
                </div>
              </div>
            </div>

            {/* Responsible Person */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Verantwortlich für redaktionelle und journalistische Inhalte (gem. § 18 Abs. 2 MStV)</h2>
                <p className="font-semibold text-gray-700 mb-2">Justin Schwarzott</p>
                <div className="text-gray-700">
                  <p>c/o FIAON LTD</p>
                  <p>128 City Road</p>
                  <p>London, EC1V 2NX</p>
                  <p>Vereinigtes Königreich (United Kingdom)</p>
                </div>
              </div>
            </div>

            {/* Regulatory Disclaimer */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-amber-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.2), rgba(245,158,11,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Regulatorischer Hinweis & Status-Offenlegung (Compliance Disclaimer)</h2>
                </div>
                <p className="text-gray-700 mb-4">
                  Die FIAON LTD (Betreiberin der Plattform „FIAON") erbringt ausschließlich Dienstleistungen in den Bereichen <strong>Software-as-a-Service (SaaS), Datenanalyse, E-Learning und Bereitstellung digitaler Informationssysteme</strong>.
                </p>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Keine Kredit- oder Darlehensvermittlung:</h3>
                    <p className="text-sm">Die Betreiberin ist ausdrücklich kein Kreditvermittler, Darlehensvermittler oder Finanzanlagenvermittler im Sinne der Gewerbeordnung (insbesondere § 34c, § 34d, § 34f, § 34k GewO). FIAON betreibt keine Anlageberatung, Rechtsberatung oder Steuerberatung. Es werden keine Finanzprodukte aktiv vermittelt, empfohlen oder vertrieben.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Keine Bankgeschäfte:</h3>
                    <p className="text-sm">Die Betreiberin ist kein Kreditinstitut oder Finanzdienstleistungsinstitut im Sinne des Kreditwesengesetzes (KWG) und unterliegt nicht der Aufsicht der Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin). Die Plattform gibt keine Kreditkarten heraus, gewährt keine Kredite und führt keine Bankgeschäfte durch.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Unabhängigkeit & Vergütung:</h3>
                    <p className="text-sm">FIAON ist vollständig unabhängig von Banken, Auskunfteien, Kreditkartenherausgebern und Zahlungsdienstleistern. Die Plattform finanziert sich ausschließlich durch die von den Nutzern entrichteten Abonnement-Gebühren (SaaS-Lizenzgebühren). Die Betreiberin erhält zu keinem Zeitpunkt Affiliate-Provisionen, Kick-backs, Cost-per-Lead-Vergütungen oder sonstige erfolgsbasierte Zahlungen von Dritten für den Abschluss von Kreditkartenverträgen. Etwaige auf der Plattform erwähnte Anbieter oder Finanzprodukte dienen ausschließlich Informations- und Bildungszwecken auf Basis neutraler Algorithmen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Eigenverantwortlichkeit des Nutzers:</h3>
                    <p className="text-sm">Alle bereitgestellten Analysen, Strategien (Credit-Building) und Daten-Dashboards dienen ausschließlich der finanziellen Bildung des Nutzers. Die Umsetzung der erlernten Strategien sowie die Stellung von Anträgen bei Finanzinstituten erfolgt zu 100 % in der Eigenverantwortung des Nutzers. Die Betreiberin übernimmt keinerlei Garantie, Haftung oder Gewährleistung für die erfolgreiche Bewilligung von Kreditkarten, Krediten oder spezifischen Kreditlimits durch externe Banken.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Haftungsausschluss (Disclaimer)</h2>
                <div className="space-y-6 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">Haftung für Inhalte</h3>
                    <p className="text-sm">Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.</p>
                    <p className="text-sm mt-2">Alle Berechnungen, Score-Simulationen und strategischen Hinweise, die durch unsere Software generiert werden, basieren auf theoretischen Modellen. Sie stellen keine verbindliche Vorhersage über das tatsächliche Verhalten von Banken oder Auskunfteien (wie z.B. der SCHUFA Holding AG) dar.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Haftung für Links</h3>
                    <p className="text-sm">Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Vorgesetzter der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung unzumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Urheberrecht</h3>
                    <p className="text-sm">Die durch die Seitenbetreiber erstellten Inhalte, Quellcodes, Algorithmen und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Vorgesetzter erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Dispute Resolution */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Streitbeilegung</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">EU-Streitschlichtung</h3>
                    <p className="text-sm">Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit, die Sie unter <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">https://ec.europa.eu/consumers/odr/</a> finden. Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Verbraucherstreitbeilegung / Universalschlichtungsstelle</h3>
                    <p className="text-sm">Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══════════ ENGLISH VERSION / LEGAL NOTICE ═══════════ */}
            <div id="impressum-en" className="scroll-mt-24 pt-8">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold fiaon-gradient-text-animated mb-2">Legal Notice (English Version)</h2>
                <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">
                  The German version above is the authoritative version. This English translation is provided for convenience.
                </p>
              </div>
            </div>

            {/* EN: Provider */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <p className="text-sm text-gray-500 mb-4">The website and platform "FIAON" is operated by:</p>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold text-lg">FIAON LTD</p>
                  <p>Registered Office: 128 City Road</p>
                  <p>London, EC1V 2NX</p>
                  <p>United Kingdom</p>
                  <p className="pt-2 text-sm">A private company limited by shares, incorporated in England and Wales under the Companies Act 2006.</p>
                </div>
              </div>
            </div>

            {/* EN: Representation, Registry, Contact */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Details</h2>
                <div className="space-y-2 text-gray-700 text-sm">
                  <p><strong>Represented by (Director):</strong> Justin Schwarzott</p>
                  <p><strong>Registrar:</strong> Companies House (England and Wales)</p>
                  <p><strong>Company Registration Number:</strong> 17318250</p>
                  <p><strong>Contact:</strong> support@fiaon.com (correspondence in English and German)</p>
                  <p><strong>Responsible for editorial content (§ 18 (2) MStV):</strong> Justin Schwarzott, c/o FIAON LTD, 128 City Road, London, EC1V 2NX, United Kingdom</p>
                </div>
              </div>
            </div>

            {/* EN: Regulatory Disclaimer */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-amber-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.2), rgba(245,158,11,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Regulatory Notice & Status Disclosure (Compliance Disclaimer)</h2>
                </div>
                <p className="text-gray-700 mb-4">
                  FIAON LTD (operator of the "FIAON" platform) exclusively provides services in the fields of <strong>Software-as-a-Service (SaaS), data analytics, e-learning and the provision of digital information systems</strong>.
                </p>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. No credit or loan brokerage:</h3>
                    <p className="text-sm">The operator is expressly not a credit broker, loan broker or financial investment broker within the meaning of the German Trade Regulation Act (Gewerbeordnung, in particular § 34c, § 34d, § 34f, § 34k GewO). FIAON does not provide investment advice, legal advice or tax advice. No financial products are actively brokered, recommended or distributed.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. No banking business:</h3>
                    <p className="text-sm">The operator is not a credit institution or financial services institution within the meaning of the German Banking Act (Kreditwesengesetz, KWG) and is not subject to supervision by the German Federal Financial Supervisory Authority (BaFin) or the UK Financial Conduct Authority (FCA). The platform does not issue credit cards, does not grant loans and does not conduct banking business of any kind.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Independence & remuneration:</h3>
                    <p className="text-sm">FIAON is fully independent of banks, credit bureaus, credit card issuers and payment service providers. The platform is financed exclusively through the subscription fees (SaaS licence fees) paid by its users. The operator does not, at any time, receive affiliate commissions, kick-backs, cost-per-lead remuneration or any other success-based payments from third parties for the conclusion of credit card contracts. Any providers or financial products mentioned on the platform serve exclusively informational and educational purposes based on neutral algorithms.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. User's own responsibility:</h3>
                    <p className="text-sm">All analyses, strategies (credit building) and data dashboards provided serve exclusively the financial education of the user. The implementation of the strategies learned as well as the submission of applications to financial institutions is carried out 100% at the user's own responsibility. The operator assumes no guarantee, liability or warranty whatsoever for the successful approval of credit cards, loans or specific credit limits by external banks.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* EN: Dispute Resolution */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Dispute Resolution</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">EU Online Dispute Resolution</h3>
                    <p className="text-sm">The European Commission provides a platform for online dispute resolution (ODR), which you can find at <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">https://ec.europa.eu/consumers/odr/</a>. Our e-mail address can be found above in this legal notice.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Consumer dispute resolution</h3>
                    <p className="text-sm">We are neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PremiumFooter />
    </div>
  );
}
