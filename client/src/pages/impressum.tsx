import { useEffect } from "react";

export default function ImpressumPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="text-center mb-16 animate-[fadeInUp_.6s_ease]">
          <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Impressum</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
            Anbieterkennzeichnung gemäß § 5 DDG sowie § 18 Abs. 2 MStV
          </p>
        </div>

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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Anbieter</h2>
              <div className="space-y-2 text-gray-700">
                <p className="font-semibold">SCP Real Estate KG</p>
                <p>Pasinger Str. 1</p>
                <p>82166 Gräfelfing</p>
                <p>Deutschland</p>
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
                Vertreten durch den Geschäftsführer / persönlich haftenden Gesellschafter: Hans-Jürgen Gerhold
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
                <p>Telefon: +49 (0) 89 12345678</p>
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
                <p>Eintragung im Handelsregister</p>
                <p>Registergericht: Amtsgericht München</p>
                <p>Registernummer: HRA 120072</p>
              </div>
            </div>
          </div>

          {/* VAT ID */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Umsatzsteuer-Identifikationsnummer</h2>
              <p className="text-gray-700">
                Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE[Deine USt-IdNr. einfügen]
              </p>
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Verantwortlich für redaktionelle und journalistische Inhalte</h2>
              <p className="font-semibold text-gray-700 mb-2">Hans-Jürgen Gerhold</p>
              <div className="text-gray-700">
                <p>Pasinger Str. 1</p>
                <p>82166 Gräfelfing</p>
                <p>Deutschland</p>
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
                <h2 className="text-xl font-semibold text-gray-900">Regulatorischer Hinweis & Status-Offenlegung</h2>
              </div>
              <p className="text-gray-700 mb-4">
                Die SCP Real Estate KG (Betreiberin der Plattform „FIAON“) erbringt ausschließlich Dienstleistungen in den Bereichen Software-as-a-Service (SaaS), Datenanalyse, E-Learning und Bereitstellung digitaler Informationssysteme.
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
                  <p className="text-sm">Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung unzumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Urheberrecht</h3>
                  <p className="text-sm">Die durch die Seitenbetreiber erstellten Inhalte, Quellcodes, Algorithmen und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.</p>
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
        </div>
      </div>
    </div>
  );
}
