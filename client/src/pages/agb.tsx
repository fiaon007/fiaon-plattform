import { useEffect } from "react";

export default function AGBPage() {
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
          <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Allgemeine Geschäftsbedingungen (AGB)</h1>
          <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
            FIAON-Plattform
          </p>
        </div>

        {/* Content */}
        <div className="space-y-6 animate-[fadeInUp_.8s_ease]">
          {/* Präambel */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Präambel</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die SCP Real Estate KG, Pasinger Str. 1, 82166 Gräfelfing (nachfolgend „Anbieterin" oder „FIAON"), betreibt unter der Domain fiaon.com eine internetbasierte Software-as-a-Service (SaaS) und E-Learning-Plattform. Die Plattform bietet Nutzern KI-gestützte Datenanalysen, Score-Simulationen und Schulungsmodule zur strategischen Optimierung privater und geschäftlicher Finanzprofile (sog. „Credit-Building").
              </p>
              <p className="text-gray-700 leading-relaxed">
                Diese AGB regeln das Vertragsverhältnis zwischen der Anbieterin und den registrierten Nutzern (nachfolgend „Nutzer" oder „Kunde").
              </p>
            </div>
          </div>

          {/* § 1 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 1 Geltungsbereich</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Diese Allgemeinen Geschäftsbedingungen gelten für alle Verträge über die Nutzung der Software-Plattform FIAON, die zwischen der Anbieterin und dem Nutzer geschlossen werden.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Das Angebot richtet sich sowohl an Verbraucher im Sinne des § 13 BGB als auch an Unternehmer im Sinne des § 14 BGB.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Abweichende, entgegenstehende oder ergänzende Allgemeine Geschäftsbedingungen des Nutzers werden nur dann und insoweit Vertragsbestandteil, als die Anbieterin ihrer Geltung ausdrücklich in Textform zugestimmt hat. Dieses Zustimmungserfordernis gilt in jedem Fall, beispielsweise auch dann, wenn die Anbieterin in Kenntnis der AGB des Nutzers die Leistung vorbehaltlos ausführt.
              </p>
            </div>
          </div>

          {/* § 2 */}
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
                <h2 className="text-xl font-semibold text-gray-900">§ 2 Vertragsgegenstand und regulatorischer Status (Wichtiger Hinweis)</h2>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4">
                Vertragsgegenstand ist die entgeltliche Bereitstellung des Zugangs zur webbasierten Software FIAON sowie die Bereitstellung digitaler Informations- und Schulungsinhalte (SaaS).
              </p>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold mb-2">Keine Finanzvermittlung:</h3>
                  <p className="text-sm">Die Anbieterin betreibt ausdrücklich keine Kreditvermittlung, Darlehensvermittlung, Anlageberatung oder Finanzanlagenvermittlung im Sinne der §§ 34c, 34d, 34f oder 34i der Gewerbeordnung (GewO). Die Anbieterin ist kein Kredit- oder Finanzdienstleistungsinstitut nach dem Kreditwesengesetz (KWG) und unterliegt nicht der Aufsicht der BaFin.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Unabhängigkeit:</h3>
                  <p className="text-sm">FIAON vermittelt keine Finanzprodukte. Die Plattform erhält keine Affiliate-Provisionen, Lead-Vergütungen oder Kick-backs von Banken oder Kreditkartenherausgebern. Etwaige auf der Plattform erwähnte Anbieter oder Finanzprodukte (z. B. im „Kartenkompass") basieren auf neutralen Algorithmen und dienen ausschließlich Informationszwecken.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Eigenverantwortung:</h3>
                  <p className="text-sm">Die Software liefert datenbasierte Strategien. Der Nutzer trifft alle finanziellen Entscheidungen, insbesondere die Stellung von Kreditkartenanträgen, vollständig eigenverantwortlich und direkt beim jeweiligen Finanzinstitut.</p>
                </div>
              </div>
            </div>
          </div>

          {/* § 3 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 3 Vertragsschluss und Registrierung</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Präsentation der Leistungspakete (z. B. Starter, Pro, Ultra, High End) auf der Website stellt kein rechtlich bindendes Angebot dar, sondern eine Aufforderung zur Abgabe einer Bestellung (invitatio ad offerendum).
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Um die Plattform zu nutzen, muss der Nutzer ein Kundenkonto (Setup) anlegen. Der Vertrag kommt zustande, indem der Nutzer am Ende des Bestellprozesses den Button „Konto eröffnen" (oder eine entsprechend eindeutig beschriftete Schaltfläche) anklickt und die Anbieterin das Angebot durch eine Auftragsbestätigung per E-Mail oder durch die unmittelbare Freischaltung des Dashboards annimmt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Der Nutzer verpflichtet sich, bei der Registrierung wahrheitsgemäße und vollständige Angaben zu machen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Account-Sharing-Verbot:</strong> Die Zugangsdaten sind personalisiert und streng vertraulich zu behandeln. Die Weitergabe der Zugangsdaten an Dritte ist untersagt. Bei Zuwiderhandlung behält sich die Anbieterin das Recht vor, den Account fristlos zu sperren und Schadensersatz geltend zu machen.
              </p>
            </div>
          </div>

          {/* § 4 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 4 Leistungsumfang und Verfügbarkeit</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Der genaue Funktionsumfang (z. B. Umfang der KI-Profilanalyse, Nutzung des Score-Simulators, Coaching-Module, 1-on-1 Strategy-Calls) ergibt sich aus der jeweiligen Leistungsbeschreibung des gebuchten Pakets zum Zeitpunkt des Vertragsschlusses.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Anbieterin schuldet keinen bestimmten wirtschaftlichen Erfolg. Insbesondere wird keine Gewährleistung oder Garantie dafür übernommen, dass der Nutzer durch die Anwendung der bereitgestellten Strategien eine bestimmte Kreditkarte, ein bestimmtes Kreditlimit oder eine Verbesserung seines Bonitäts-Scores bei Auskunfteien (z. B. SCHUFA) erhält. Die Entscheidung hierüber obliegt ausschließlich den externen Banken und Algorithmen der Auskunfteien.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Die Anbieterin gewährleistet eine Verfügbarkeit der SaaS-Dienste von 98,5 % im Jahresmittel. Hiervon ausgenommen sind Zeiten, in denen die Plattform aufgrund von technischen oder sonstigen Problemen, die nicht im Einflussbereich der Anbieterin liegen (höhere Gewalt, Verschulden Dritter), nicht zu erreichen ist, sowie routinemäßige Wartungsarbeiten.
              </p>
            </div>
          </div>

          {/* § 5 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 5 Preise und Zahlungsbedingungen</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Es gelten die im Zeitpunkt der Bestellung auf der Website ausgewiesenen monatlichen Abonnement-Gebühren. Alle Preise verstehen sich in Euro. Für Verbraucher verstehen sich die Preise inklusive der gesetzlichen Umsatzsteuer.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Gebühren für das gewählte Abonnement sind jeweils monatlich im Voraus zur Zahlung fällig.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Zahlungsabwicklung erfolgt über den externen Zahlungsdienstleister Stripe. Der Nutzer ermächtigt die Anbieterin, den fälligen Betrag über das gewählte Zahlungsmittel (z. B. Kreditkarte, SEPA-Lastschrift) einzuziehen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Befindet sich der Nutzer im Zahlungsverzug, ist die Anbieterin berechtigt, den Zugang zum Dashboard bis zur vollständigen Begleichung der offenen Forderung zu sperren. Die Verpflichtung zur Zahlung der monatlichen Gebühr bleibt hiervon unberührt.
              </p>
            </div>
          </div>

          {/* § 6 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 6 Laufzeit, Kündigung und Upgrades</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Der Vertrag wird auf unbestimmte Zeit geschlossen. Die Mindestlaufzeit beträgt einen (1) Monat.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Das Abonnement kann von beiden Seiten jederzeit ohne Angabe von Gründen mit einer Frist von 24 Stunden zum Ende des jeweiligen Abrechnungsmonats gekündigt werden. Die Kündigung kann durch den Nutzer unkompliziert per Klick im Account-Dashboard oder durch eine E-Mail an support@fiaon.com erfolgen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Upgrades:</strong> Der Nutzer kann jederzeit in ein höheres Leistungspaket wechseln (Upgrade). Das Upgrade wird sofort wirksam. Die bereits entrichtete Gebühr für den laufenden Abrechnungsmonat wird anteilig auf den neuen Paketpreis angerechnet.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für die Anbieterin insbesondere vor, wenn der Nutzer die Plattform missbräuchlich nutzt, das Account-Sharing-Verbot verletzt oder mit fälligen Zahlungen in Verzug gerät.
              </p>
            </div>
          </div>

          {/* § 7 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 7 Geistiges Eigentum und Nutzungsrechte</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Software FIAON, alle damit verbundenen Quellcodes, Algorithmen, UI-Designs, Texte, Coaching-Videos sowie das zugrundeliegende methodische Konzept sind urheberrechtlich geschützt und geistiges Eigentum der SCP Real Estate KG.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dem Nutzer wird für die Dauer der Vertragslaufzeit ein einfaches, nicht übertragbares, nicht unterlizenzierbares und räumlich unbeschränktes Recht eingeräumt, die Software über einen Webbrowser bestimmungsgemäß zu nutzen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Es ist dem Nutzer strikt untersagt, die Software zu vervielfältigen, zu dekompilieren (Reverse Engineering), zu verändern oder automatisierte Skripte (Scraping) zur Datengewinnung einzusetzen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Die kommerzielle Weiterverwertung der Strategien:</strong> Der Nutzer darf die erlernten Strategien und Dashboards ausschließlich für eigene, interne Zwecke nutzen. Eine gewerbliche Nutzung, bei der der Nutzer als Berater auftritt und die FIAON-Inhalte an Dritte verkauft oder lizenziert, ist untersagt.
              </p>
            </div>
          </div>

          {/* § 8 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 8 Haftungsbeschränkung</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Anbieterin haftet nach den gesetzlichen Bestimmungen für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung der Anbieterin beruhen, sowie für sonstige Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung oder Arglist beruhen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Für einfache Fahrlässigkeit haftet die Anbieterin nur bei der Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht). Kardinalpflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Vertragspartner regelmäßig vertrauen darf. In diesem Fall ist die Haftung auf den Ersatz des vertragstypischen, vorhersehbaren Schadens begrenzt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Eine weitergehende Haftung der Anbieterin ist ausgeschlossen. Insbesondere wird jegliche Haftung für abgelehnte Anträge bei Banken, Verschlechterungen des Bonitäts-Scores oder entgangene Gewinne (etwa durch nicht gewährtes Cashback oder verwehrte Business-Kreditlinien) ausdrücklich ausgeschlossen. Der Nutzer handelt in allen Finanzangelegenheiten auf eigenes Risiko.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Soweit die Haftung der Anbieterin ausgeschlossen oder beschränkt ist, gilt dies auch für die persönliche Haftung von Arbeitnehmern, Vertretern und Erfüllungsgehilfen der Anbieterin.
              </p>
            </div>
          </div>

          {/* § 9 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 9 Datenschutz</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Erhebung und Verarbeitung personenbezogener Daten erfolgt streng nach den Vorgaben der Datenschutz-Grundverordnung (DSGVO).
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Es wird ausdrücklich klargestellt, dass die Anbieterin eine Software-Plattform ist und zu keinem Zeitpunkt selbstständig Bonitätsanfragen bei der SCHUFA Holding AG oder anderen Auskunfteien durchführt.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Weitere Details zur Datenverarbeitung sind der Datenschutzerklärung der Anbieterin unter fiaon.com/datenschutz zu entnehmen.
              </p>
            </div>
          </div>

          {/* § 10 */}
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
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c0 4.97-4.03 9-9 9a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">§ 10 Widerrufsrecht für Verbraucher</h2>
              </div>
              <p className="text-gray-700 leading-relaxed mb-4">
                Schließt der Nutzer den Vertrag als Verbraucher (§ 13 BGB), steht ihm das gesetzliche Widerrufsrecht zu.
              </p>
              
              <div className="mt-6 p-6 bg-white/50 rounded-xl border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Widerrufsbelehrung</h3>
                
                <h4 className="font-semibold text-gray-800 mb-2">Widerrufsrecht</h4>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Um Ihr Widerrufsrecht auszuüben, müssen Sie uns (SCP Real Estate KG, Pasinger Str. 1, 82166 Gräfelfing, E-Mail: support@fiaon.com, Telefon: +49 (0) 89 12345678) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
                </p>
                <p className="text-gray-700 leading-relaxed mb-6">
                  Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
                </p>
                
                <h4 className="font-semibold text-gray-800 mb-2">Folgen des Widerrufs</h4>
                <p className="text-gray-700 leading-relaxed mb-6">
                  Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
                </p>
                
                <h4 className="font-semibold text-gray-800 mb-2">Erlöschen des Widerrufsrechts bei digitalen Inhalten (WICHTIG)</h4>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Das Widerrufsrecht erlischt bei einem Vertrag über die Bereitstellung von nicht auf einem körperlichen Datenträger befindlichen digitalen Inhalten (wie dem Zugang zur SaaS-Plattform und den E-Learning-Modulen) vorzeitig, wenn wir mit der Ausführung des Vertrags begonnen haben, nachdem Sie:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>ausdrücklich zugestimmt haben, dass wir mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginnen, und</li>
                  <li>Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrags Ihr Widerrufsrecht verlieren.</li>
                </ul>
                <p className="text-sm text-gray-500 italic">
                  (Hinweis für die Umsetzung: Diesen Verzicht müsst ihr als Checkbox im Checkout-Prozess zwingend abfragen!)
                </p>
              </div>
              
              <div className="mt-6 p-6 bg-white/50 rounded-xl border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4">Muster-Widerrufsformular</h4>
                <p className="text-gray-500 text-sm mb-4">(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
                <p className="text-gray-700 mb-2"><strong>An:</strong> SCP Real Estate KG, Pasinger Str. 1, 82166 Gräfelfing, E-Mail: support@fiaon.com</p>
                <p className="text-gray-700 mb-2">Hiermit widerrufe(n) ich/wir () den von mir/uns () abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: Zugang zur FIAON-Software</p>
                <p className="text-gray-700 mb-2">Bestellt am (*)</p>
                <p className="text-gray-700 mb-2">Name des/der Verbraucher(s)</p>
                <p className="text-gray-700 mb-2">Anschrift des/der Verbraucher(s)</p>
                <p className="text-gray-700">Datum, Unterschrift (nur bei Mitteilung auf Papier)</p>
                <p className="text-gray-500 text-sm mt-2">(*) Unzutreffendes streichen.</p>
              </div>
            </div>
          </div>

          {/* § 11 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 11 Änderungen der Allgemeinen Geschäftsbedingungen</h2>
              <p className="text-gray-700 leading-relaxed">
                Die Anbieterin ist berechtigt, diese AGB mit Wirkung für die Zukunft zu ändern, sofern gesetzliche, behördliche oder technische Veränderungen dies erforderlich machen und der Nutzer hierdurch nicht unangemessen benachteiligt wird. Die Nutzer werden spätestens vier (4) Wochen vor dem geplanten Inkrafttreten der neuen AGB per E-Mail informiert. Widerspricht der Nutzer nicht innerhalb von vier Wochen nach Zugang der E-Mail, gelten die geänderten AGB als angenommen. Auf das Widerspruchsrecht und die Rechtsfolgen des Schweigens wird in der Änderungsmitteilung gesondert hingewiesen.
              </p>
            </div>
          </div>

          {/* § 12 */}
          <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
              background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
              backgroundSize: "200% 200%",
              animation: "limitGlow 6s ease-in-out infinite"
            }} />
            <div className="relative z-10">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 12 Schlussbestimmungen</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzbestimmungen des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, bleiben hiervon unberührt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ist der Nutzer Kaufmann, eine juristische Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen, ist der ausschließliche Gerichtsstand für alle Streitigkeiten aus diesem Vertrag München.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Europäische Kommission stellt unter https://ec.europa.eu/consumers/odr/ eine Plattform zur Online-Streitbeilegung (OS) bereit. Die Anbieterin ist weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, so wird hierdurch die Gültigkeit des Vertrages im Übrigen nicht berührt. Anstelle der unwirksamen Bestimmung gelten die gesetzlichen Vorschriften.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
