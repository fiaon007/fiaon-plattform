import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

export default function WiderrufsbelehrungPage() {
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
            <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Widerrufsbelehrung</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
              Verbraucherinformation gemäß § 312g BGB i. V. m. Art. 246a EGBGB
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 animate-[fadeInUp_.8s_ease]">
            {/* Intro */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <p className="text-gray-700 leading-relaxed">
                  Die folgenden Regelungen zum Widerrufsrecht gelten ausschließlich für Nutzer, die das FIAON-Abonnement zu Zwecken abschließen, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können (Verbraucher im Sinne des § 13 BGB). Für Geschäftskunden (Unternehmer im Sinne des § 14 BGB) besteht kein gesetzliches Widerrufsrecht.
                </p>
              </div>
            </div>

            {/* Widerrufsrecht */}
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
                  <h2 className="text-xl font-semibold text-gray-900">Widerrufsrecht</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Um Ihr Widerrufsrecht auszuüben, müssen Sie uns:
                </p>
                <div className="bg-white/50 rounded-xl p-4 mb-4">
                  <p className="font-semibold text-gray-900 mb-2">SCP Real Estate KG</p>
                  <p className="text-sm text-gray-700">Pasinger Str. 1</p>
                  <p className="text-sm text-gray-700">82166 Gräfelfing</p>
                  <p className="text-sm text-gray-700">Deutschland</p>
                  <p className="text-sm text-gray-700 mt-2">Telefon: +49 (0) 89 12345678</p>
                  <p className="text-sm text-gray-700">E-Mail: support@fiaon.com</p>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
                </p>
              </div>
            </div>

            {/* Folgen des Widerrufs */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Folgen des Widerrufs</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Haben Sie verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so haben Sie uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem Sie uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichten, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.
                </p>
              </div>
            </div>

            {/* Vorzeitiges Erlöschen */}
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
                  <h2 className="text-xl font-semibold text-gray-900">⚠️ Wichtiger Hinweis: Vorzeitiges Erlöschen des Widerrufsrechts bei digitalen Inhalten (Software & E-Learning)</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Das FIAON-Abonnement umfasst die Bereitstellung von digitalen Inhalten und Dienstleistungen, die sich nicht auf einem körperlichen Datenträger befinden (Zugang zur SaaS-Plattform, Score-Simulator, Video-Coachings und Dashboards).
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Ihr Widerrufsrecht erlischt bei einem Vertrag über die Bereitstellung von digitalen Inhalten vorzeitig, wenn:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>wir mit der Ausführung des Vertrags (Freischaltung des Dashboards) begonnen haben,</li>
                  <li>Sie zuvor ausdrücklich zugestimmt haben, dass wir mit der Ausführung des Vertrags vor Ablauf der Widerrufsfrist beginnen, und</li>
                  <li>Sie Ihre Kenntnis davon bestätigt haben, dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrags Ihr Widerrufsrecht verlieren.</li>
                </ul>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-sm text-amber-900">
                    <span className="font-semibold">(Hinweis der Anbieterin:</span> Um Ihnen den sofortigen Zugang zu unseren Systemen direkt nach der Buchung zu ermöglichen, holen wir diese Zustimmung und Bestätigung über eine zwingend anzukreuzende Checkbox im Checkout-Prozess ein).
                  </p>
                </div>
              </div>
            </div>

            {/* Muster-Widerrufsformular */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Muster-Widerrufsformular</h2>
                <p className="text-gray-500 text-sm mb-6">
                  (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück. Die Nutzung des Formulars ist nicht zwingend, Sie können den Widerruf auch formlos per E-Mail an support@fiaon.com formulieren).
                </p>
                <div className="bg-white/50 rounded-xl p-6 space-y-3">
                  <p className="text-sm text-gray-700"><strong>An:</strong></p>
                  <p className="text-sm text-gray-700">SCP Real Estate KG</p>
                  <p className="text-sm text-gray-700">Pasinger Str. 1</p>
                  <p className="text-sm text-gray-700">82166 Gräfelfing</p>
                  <p className="text-sm text-gray-700">Deutschland</p>
                  <p className="text-sm text-gray-700">E-Mail: support@fiaon.com</p>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="text-sm text-gray-700 mb-4">Hiermit widerrufe(n) ich/wir () den von mir/uns () abgeschlossenen Vertrag über den Kauf der folgenden Waren () / die Erbringung der folgenden Dienstleistung ():</p>
                    <p className="text-sm text-gray-700 mb-2">Zugang zur FIAON-Software (Abonnement-Paket: ........................................................)</p>
                    <p className="text-sm text-gray-700 mb-2">Bestellt am (*): ....................................................</p>
                    <p className="text-sm text-gray-700 mb-2">Name des/der Verbraucher(s): ....................................................</p>
                    <p className="text-sm text-gray-700 mb-2">Anschrift des/der Verbraucher(s): ....................................................</p>
                    <p className="text-sm text-gray-700 mb-2">E-Mail-Adresse des/der Verbraucher(s) (zur Zuordnung des Accounts): ....................................................</p>
                    <div className="border-t border-gray-200 pt-4 mt-4">
                      <p className="text-sm text-gray-700">.........................................................................................</p>
                      <p className="text-sm text-gray-700">Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier)</p>
                      <p className="text-sm text-gray-700 mt-2">.........................................................................................</p>
                      <p className="text-sm text-gray-700">Datum</p>
                    </div>
                    <p className="text-sm text-gray-500 mt-4">() Unzutreffendes streichen.*</p>
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
