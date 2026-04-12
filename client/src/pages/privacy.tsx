import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

export default function PrivacyPage() {
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
          <div className="text-center mb-16 animate-[fadeInUp_.6s_ease]">
            <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Datenschutzerklärung</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
              Der FIAON-Plattform
            </p>
          </div>

          {/* Intro */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden mb-8 animate-[fadeInUp_.8s_ease]">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <p className="text-gray-700 leading-relaxed">
                Der Schutz Ihrer personenbezogenen Daten ist für uns nicht nur eine gesetzliche Pflicht, sondern ein zentrales Prinzip unseres Geschäftsmodells. Als Anbieterin einer unabhängigen Software-as-a-Service (SaaS) Plattform für finanzielle Strategien (Credit-Building) verarbeiten wir hochsensible Daten. Wir verkaufen keine Daten an Banken, Werbenetzwerke oder Auskunfteien und führen keine eigenständigen Bonitätsabfragen durch.
              </p>
              <p className="text-gray-700 leading-relaxed mt-4">
                Die nachfolgende Datenschutzerklärung informiert Sie ausführlich, transparent und lückenlos darüber, welche Daten wir erheben, zu welchem Zweck dies geschieht und auf welcher Rechtsgrundlage die Verarbeitung beruht.
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-6 animate-[fadeInUp_.8s_ease]">
            {/* I. Name und Anschrift */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">I. Name und Anschrift des Verantwortlichen</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Verantwortlicher im Sinne der EU-Datenschutz-Grundverordnung (DSGVO) und anderer nationaler Datenschutzgesetze der Mitgliedsstaaten sowie sonstiger datenschutzrechtlicher Bestimmungen ist die:
                </p>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold">SCP Real Estate KG</p>
                  <p>Pasinger Str. 1</p>
                  <p>82166 Gräfelfing</p>
                  <p>Deutschland</p>
                  <p className="mt-4">Vertreten durch den persönlich haftenden Gesellschafter: Hans-Jürgen Gerhold</p>
                  <p>Telefon: +49 (0) 89 12345678</p>
                  <p>E-Mail: support@fiaon.com</p>
                  <p>Website: fiaon.com</p>
                </div>
              </div>
            </div>

            {/* II. Allgemeines zur Datenverarbeitung */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">II. Allgemeines zur Datenverarbeitung</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Umfang der Verarbeitung personenbezogener Daten</h3>
                    <p className="text-sm">Wir erheben und verwenden personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies zur Bereitstellung einer funktionsfähigen Website, unserer SaaS-Software, unserer E-Learning-Inhalte und unserer Leistungen erforderlich ist.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Rechtsgrundlage für die Verarbeitung personenbezogener Daten</h3>
                    <p className="text-sm">Soweit wir für Verarbeitungsvorgänge personenbezogener Daten eine Einwilligung der betroffenen Person einholen, dient Art. 6 Abs. 1 lit. a DSGVO als Rechtsgrundlage. Bei der Verarbeitung von personenbezogenen Daten, die zur Erfüllung eines Vertrages, dessen Vertragspartei die betroffene Person ist, erforderlich ist, dient Art. 6 Abs. 1 lit. b DSGVO als Rechtsgrundlage. Soweit eine Verarbeitung zur Wahrung eines berechtigten Interesses unseres Unternehmens erforderlich ist, dient Art. 6 Abs. 1 lit. f DSGVO als Rechtsgrundlage.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Datenlöschung und Speicherdauer</h3>
                    <p className="text-sm">Die personenbezogenen Daten der betroffenen Person werden gelöscht oder gesperrt, sobald der Zweck der Speicherung entfällt. Eine Speicherung kann darüber hinaus erfolgen, wenn dies durch den europäischen oder nationalen Gesetzgeber vorgesehen wurde (z. B. handels- und steuerrechtliche Aufbewahrungspflichten bis zu 10 Jahren).</p>
                  </div>
                </div>
              </div>
            </div>

            {/* III. Bereitstellung der Website */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">III. Bereitstellung der Website und Erstellung von Logfiles</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Beschreibung und Umfang der Datenverarbeitung</h3>
                    <p className="text-sm">Bei jedem Aufruf unserer Internetseite erfasst unser System automatisiert Daten und Informationen vom Computersystem des aufrufenden Rechners. Folgende Daten werden hierbei erhoben: Informationen über den Browsertyp und die verwendete Version, das Betriebssystem des Nutzers, den Internet-Service-Provider des Nutzers, die IP-Adresse des Nutzers, Datum und Uhrzeit des Zugriffs, Websites, von denen das System des Nutzers auf unsere Internetseite gelangt. Diese Daten werden in den Logfiles unseres Systems gespeichert.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Zweck und Rechtsgrundlage der Datenverarbeitung</h3>
                    <p className="text-sm">Die vorübergehende Speicherung der IP-Adresse durch das System ist notwendig, um eine Auslieferung der Website an den Rechner des Nutzers zu ermöglichen. Die Speicherung in Logfiles erfolgt, um die Funktionsfähigkeit der Website sicherzustellen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Dauer der Speicherung</h3>
                    <p className="text-sm">Die Daten werden gelöscht, sobald sie für die Erreichung des Zweckes ihrer Erhebung nicht mehr erforderlich sind. Im Falle der Erfassung der Daten zur Bereitstellung der Website ist dies der Fall, wenn die jeweilige Sitzung beendet ist. Im Falle der Speicherung der Daten in Logfiles ist dies nach spätestens sieben Tagen der Fall.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* IV. Registrierung und Software-Nutzung */}
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
                  <h2 className="text-xl font-semibold text-gray-900">IV. Registrierung, Software-Nutzung und Datenanalyse (Das FIAON-Dashboard)</h2>
                </div>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Beschreibung und Umfang der Datenverarbeitung</h3>
                    <p className="text-sm">Auf unserer Internetseite bieten wir Nutzern die Möglichkeit, sich unter Angabe personenbezogener Daten zu registrieren und ein kostenpflichtiges Abonnement abzuschließen. Im Rahmen der Nutzung der SaaS-Plattform erheben wir hochsensible, vom Nutzer freiwillig eingegebene Profildaten zur Durchführung der KI-gestützten Finanz- und Strategieanalyse. Zu diesen Daten gehören unter anderem: Vor- und Nachname, E-Mail-Adresse, Selbstauskünfte zu Einkommensverhältnissen, Wohnsituation und beruflichem Status, Bestehende Kreditkarten, aktuelle Kreditlimits und Ziel-Limits, Nutzungshistorie der Software.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Zweck und Rechtsgrundlage der Datenverarbeitung</h3>
                    <p className="text-sm">Die Verarbeitung der eingegebenen Profil- und Finanzdaten dient ausschließlich der Erfüllung des SaaS-Vertrages gemäß Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden genutzt, um das persönliche Dashboard zu generieren, datenbasierte Insights (z. B. den „Kartenkompass") bereitzustellen und den Score-Simulator zu betreiben.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. EU-Hosting und Verschlüsselung</h3>
                    <p className="text-sm">Sämtliche von Ihnen eingegebenen Profildaten werden nach höchsten Sicherheitsstandards (AES-256) verschlüsselt auf Servern gespeichert, die sich physisch ausschließlich innerhalb der Europäischen Union (EU) befinden. Ein Transfer dieser spezifischen Analysedaten in Drittländer findet nicht statt.</p>
                  </div>
                  <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-sm font-semibold text-amber-900 mb-2">WICHTIGER HINWEIS (Keine SCHUFA-Abfrage):</p>
                    <p className="text-sm text-amber-800">Wir übermitteln diese eingegebenen Daten nicht an Auskunfteien (wie z. B. die SCHUFA Holding AG) und führen keine externen Bonitätsabfragen durch. Die Daten werden ausschließlich intern von unserer proprietären Engine verarbeitet, um Ihnen den vertraglich geschuldeten Strategie- und Analyse-Service bereitzustellen.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* V. Zahlungsabwicklung */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">V. Zahlungsabwicklung (Stripe)</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Umfang der Verarbeitung</h3>
                    <p className="text-sm">Zur Abwicklung der monatlichen Abonnement-Gebühren setzen wir den Zahlungsdienstleister Stripe ein (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland). Wenn Sie ein kostenpflichtiges Paket bei FIAON buchen, werden die von Ihnen eingegebenen Zahlungsdaten direkt an Stripe übermittelt und dort verarbeitet. Die Anbieterin (SCP Real Estate KG) speichert Ihre vollständigen Kreditkartendaten zu keinem Zeitpunkt selbst auf eigenen Servern.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Zweck und Rechtsgrundlage</h3>
                    <p className="text-sm">Die Übermittlung der Daten an Stripe erfolgt ausschließlich zum Zwecke der Zahlungsabwicklung und Abrechnung des gewählten Abonnements. Rechtsgrundlage ist die Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Weitere Datenschutzhinweise zu Stripe</h3>
                    <p className="text-sm">Stripe fungiert bei der Zahlungsabwicklung als eigenständiger Verantwortlicher. Stripe stellt die Einhaltung des europäischen Datenschutzniveaus durch den Abschluss von EU-Standardvertragsklauseln sicher. Weitere Informationen zum Datenschutz bei Stripe finden Sie unter: <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">stripe.com/privacy</a>.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VI. Cookies und Local Storage */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">VI. Verwendung von Cookies und Local Storage</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Umfang der Verarbeitung</h3>
                    <p className="text-sm">Unsere Website und die Web-App nutzen Cookies sowie die Local Storage-Technologie Ihres Browsers. Local Storage ermöglicht es uns, nutzerspezifische Präferenzen (z. B. Dark Mode / Light Mode Einstellungen oder aktive Sitzungs-Tokens) direkt in Ihrem Browser zu speichern, um die App-Erfahrung flüssig und sicher zu gestalten.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Technisch notwendige Daten (Essenziell)</h3>
                    <p className="text-sm">Wir setzen Cookies und Local Storage primär dazu ein, um die Login-Sitzung in unserem geschützten Dashboard aufrechtzuerhalten und die IT-Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sowie § 25 Abs. 2 TTDSG). Unser berechtigtes Interesse liegt in der sicheren und fehlerfreien Bereitstellung der bezahlten SaaS-Infrastruktur.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Keine Drittanbieter-Tracking-Cookies</h3>
                    <p className="text-sm">Als unabhängige Softwareplattform finanzieren wir uns ausschließlich durch die Abonnement-Gebühren unserer Nutzer. Daher verzichten wir strikt auf den Einsatz von werblichen Drittanbieter-Cookies (wie z. B. Meta Pixel oder Google Ads Tracking), die Ihr Nutzerverhalten über Webseiten hinweg verfolgen, um Sie zu Werbezwecken zu profilieren.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VII. Kontaktformular */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">VII. Kontaktformular und E-Mail-Kontakt</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Beschreibung und Umfang der Datenverarbeitung</h3>
                    <p className="text-sm">Auf unserer Internetseite ist ein Kontaktformular vorhanden, welches für die elektronische Kontaktaufnahme genutzt werden kann. Nimmt ein Nutzer diese Möglichkeit wahr, so werden die in der Eingabemaske eingegebenen Daten (Name, E-Mail-Adresse, Betreff, Nachrichtentext) an uns übermittelt und gespeichert. Alternativ ist eine Kontaktaufnahme über die bereitgestellte E-Mail-Adresse (support@fiaon.com) möglich.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Zweck und Rechtsgrundlage</h3>
                    <p className="text-sm">Die Verarbeitung der personenbezogenen Daten aus der Eingabemaske dient uns allein zur Bearbeitung der Kontaktaufnahme und des Support-Falles. Rechtsgrundlage ist bei Vorliegen einer Einwilligung des Nutzers Art. 6 Abs. 1 lit. a DSGVO. Zielt die Kontaktaufnahme auf den Abschluss eines Vertrages ab oder betrifft sie Support-Leistungen im Rahmen eines bestehenden Abonnements, so ist zusätzliche Rechtsgrundlage Art. 6 Abs. 1 lit. b DSGVO.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VIII. Datensicherheit */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-blue-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(59,130,246,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">VIII. Datensicherheit</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  Wir bedienen uns technischer und organisatorischer Sicherheitsmaßnahmen (TOMs), um Ihre durch uns verwalteten Daten gegen zufällige oder vorsätzliche Manipulationen, Verlust, Zerstörung oder gegen den Zugriff unberechtigter Personen zu schützen. Zu unseren Sicherheitsmaßnahmen gehören: Durchgängige TLS-Verschlüsselung (Transport Layer Security) für den gesamten Datenverkehr der Website, Verschlüsselung ruhender Daten auf unseren Datenbank-Servern mit dem Advanced Encryption Standard (AES-256), Strenge Zugangskontrollen und restriktives Rechte-Management innerhalb unserer Entwicklungs- und Support-Teams, Regelmäßige Sicherheitsüberprüfungen unserer Server-Architektur.
                </p>
              </div>
            </div>

            {/* IX. Rechte der betroffenen Person */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">IX. Rechte der betroffenen Person</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Werden personenbezogene Daten von Ihnen verarbeitet, sind Sie Betroffener i.S.d. DSGVO und es stehen Ihnen folgende Rechte gegenüber uns als Verantwortlichem zu:
                </p>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Auskunftsrecht (Art. 15 DSGVO)</h3>
                    <p className="text-sm">Sie können von uns eine Bestätigung darüber verlangen, ob personenbezogene Daten, die Sie betreffen, von uns verarbeitet werden. Ist dies der Fall, haben Sie ein Recht auf Auskunft über diese Daten sowie auf weitere Informationen gemäß Art. 15 DSGVO.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Recht auf Berichtigung (Art. 16 DSGVO)</h3>
                    <p className="text-sm">Sie haben ein Recht auf Berichtigung und/oder Vervollständigung, sofern die verarbeiteten personenbezogenen Daten, die Sie betreffen, unrichtig oder unvollständig sind. Viele dieser Daten können Sie auch selbstständig und jederzeit in Ihrem FIAON-Dashboard korrigieren.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Recht auf Löschung / "Recht auf Vergessenwerden" (Art. 17 DSGVO)</h3>
                    <p className="text-sm">Sie können von uns verlangen, dass die Sie betreffenden personenbezogenen Daten unverzüglich gelöscht werden, sofern einer der in Art. 17 DSGVO genannten Gründe zutrifft. Wir bieten unseren Nutzern zudem in den Account-Einstellungen eine "One-Click-Deletion" an, um das gesamte Profil rückstandslos zu entfernen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</h3>
                    <p className="text-sm">Unter den gesetzlichen Voraussetzungen des Art. 18 DSGVO haben Sie das Recht, die Einschränkung der Verarbeitung Ihrer Daten zu verlangen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">5. Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</h3>
                    <p className="text-sm">Sie haben das Recht, die Sie betreffenden personenbezogenen Daten, die Sie uns bereitgestellt haben, in einem strukturierten, gängigen und maschinenlesbaren Format zu erhalten, um diese an einen anderen Verantwortlichen zu übermitteln.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">6. Widerspruchsrecht (Art. 21 DSGVO)</h3>
                    <p className="text-sm">Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, jederzeit gegen die Verarbeitung der Sie betreffenden personenbezogenen Daten Widerspruch einzulegen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">7. Recht auf Widerruf der datenschutzrechtlichen Einwilligungserklärung (Art. 7 Abs. 3 DSGVO)</h3>
                    <p className="text-sm">Sie haben das Recht, Ihre datenschutzrechtliche Einwilligungserklärung jederzeit zu widerrufen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">8. Recht auf Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</h3>
                    <p className="text-sm">Unbeschadet eines anderweitigen verwaltungsrechtlichen oder gerichtlichen Rechtsbehelfs steht Ihnen das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde zu.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* X. Aktualität */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">X. Aktualität und Änderung dieser Datenschutzerklärung</h2>
                <p className="text-gray-700 leading-relaxed">
                  Diese Datenschutzerklärung ist aktuell gültig und hat den Stand April 2026. Durch die Weiterentwicklung unserer SaaS-Plattform, die Implementierung neuer KI-Features oder aufgrund geänderter gesetzlicher bzw. behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu ändern. Die jeweils aktuelle Datenschutzerklärung kann jederzeit auf unserer Website unter <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">fiaon.com/privacy</a> von Ihnen abgerufen und ausgedruckt werden.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <PremiumFooter />
    </div>
  );
}