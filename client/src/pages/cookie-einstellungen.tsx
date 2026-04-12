import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

export default function CookieEinstellungenPage() {
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
            <h1 className="text-5xl font-bold fiaon-gradient-text-animated mb-4">Cookie-Einstellungen & Lokale Speicherung</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold">
              Transparenz statt Tracking: Das FIAON Cookie-Versprechen
            </p>
          </div>

          {/* Content */}
          <div className="space-y-6 animate-[fadeInUp_.8s_ease]">
            {/* Intro */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-green-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(74,222,128,0.2), rgba(34,197,94,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Unser Versprechen</h2>
                </div>
                <p className="text-gray-700 leading-relaxed">
                  Als unabhängige Software-as-a-Service (SaaS) Plattform finanzieren wir uns ausschließlich durch die Abonnement-Gebühren unserer Nutzer. Wir verkaufen keine Daten, wir leiten Sie nicht über Affiliate-Links an Banken weiter und wir nutzen keine Werbenetzwerke.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Aus diesem Grund verzichten wir auf unserer Plattform und im Nutzer-Dashboard vollständig auf kommerzielle Drittanbieter-Tracker (wie z. B. Meta Pixel, Google Analytics Tracking-Cookies oder Werbe-Retargeting). Wir setzen ausschließlich Technologien ein, die für den sicheren und fehlerfreien Betrieb unserer Software zwingend erforderlich sind.
                </p>
                <p className="text-gray-700 leading-relaxed mt-4">
                  Die nachfolgende Übersicht informiert Sie darüber, welche Daten wir auf Ihrem Endgerät speichern.
                </p>
              </div>
            </div>

            {/* 1. Was sind Cookies und Local Storage */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Was sind Cookies und Local Storage?</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Cookies sind kleine Textdateien, die von einer Website auf Ihrem Endgerät (Computer, Tablet, Smartphone) abgelegt werden. Sie dienen dazu, Sie bei einem erneuten Besuch der Website wiederzuerkennen oder Sicherheitsfunktionen zu gewährleisten.
                </p>
                <p className="text-gray-700 leading-relaxed">
                  Local Storage (Lokale Speicherung) ist eine modernere Web-Technologie, die es unserer Web-App ermöglicht, Daten lokal und sicher im Cache Ihres Browsers zu speichern. Im Gegensatz zu Cookies werden Local Storage-Daten nicht bei jeder Anfrage an unsere Server übertragen, was die Plattform schneller und sicherer macht.
                </p>
              </div>
            </div>

            {/* 2. Zwingend erforderliche Technologien */}
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
                  <h2 className="text-xl font-semibold text-gray-900">2. Zwingend erforderliche Technologien (Essenziell)</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Diese Cookies und Speichertechnologien sind für die grundlegende Funktion der Website und der FIAON-Software zwingend notwendig. Ohne diese Technologien können Sie sich nicht in Ihr Dashboard einloggen, keine sicheren Zahlungen tätigen und die Plattform nicht nutzen.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Gemäß § 25 Abs. 2 TDDDG (Telekommunikation-Digitale-Dienste-Datenschutz-Gesetz) ist für den Einsatz dieser zwingend erforderlichen Technologien keine vorherige, aktive Einwilligung (Opt-in) erforderlich. Sie sind standardmäßig aktiviert.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4 font-semibold">
                  Wir nutzen essenzielle Technologien für folgende Zwecke:
                </p>
                <div className="space-y-4 text-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Sitzungsverwaltung (Session Management):</p>
                      <p className="text-sm">Um Sie nach dem Login in Ihr Konto als authentifizierten Nutzer zu identifizieren, damit Sie nicht bei jedem Klick Ihr Passwort neu eingeben müssen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Sicherheit (CSRF-Tokens):</p>
                      <p className="text-sm">Um sicherzustellen, dass Anfragen an unsere Server tatsächlich von Ihnen stammen und um Cross-Site-Request-Forgery-Angriffe zu verhindern.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Benutzeroberfläche (UI Preferences):</p>
                      <p className="text-sm">Um Ihre Interface-Einstellungen (z. B. die Auswahl zwischen Light Mode und Dark Mode oder das Ausblenden von Tooltips) lokal in Ihrem Browser zu speichern.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Cookies von Zahlungsdienstleistern */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Cookies von Zahlungsdienstleistern (Stripe)</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Für die sichere Abwicklung Ihres monatlichen Abonnements nutzen wir den externen und zertifizierten Zahlungsdienstleister Stripe.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Wenn Sie den Checkout-Prozess aufrufen oder Ihr Abonnement verwalten, setzt Stripe eigenständig sogenannte Sicherheits-Cookies. Diese Cookies dienen nicht dem Marketing, sondern sind gesetzlich und technisch zwingend erforderlich, um:
                </p>
                <ul className="list-disc list-inside text-gray-700 mb-4 space-y-2">
                  <li>Betrugsprävention und Risikoanalysen in Echtzeit durchzuführen.</li>
                  <li>Die Authentifizierung von Zahlungen (z. B. 3D-Secure-Verfahren Ihrer Bank) sicherzustellen.</li>
                  <li>Die Vorgaben der europäischen Zahlungsdiensterichtlinie (PSD2) zu erfüllen.</li>
                </ul>
                <p className="text-gray-700 leading-relaxed">
                  Weitere Informationen zu den von Stripe verwendeten Cookies finden Sie in der Cookie-Richtlinie von Stripe unter: <a href="https://stripe.com/de/cookie-settings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">stripe.com/de/cookie-settings</a>.
                </p>
              </div>
            </div>

            {/* 4. Keine Analyse-, Marketing- oder Affiliate-Cookies */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-green-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(74,222,128,0.2), rgba(34,197,94,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">4. Keine Analyse-, Marketing- oder Affiliate-Cookies</h2>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4 font-semibold">
                  Wir möchten es noch einmal in aller Deutlichkeit festhalten:
                </p>
                <div className="space-y-4 text-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Kein Affiliate-Tracking:</p>
                      <p className="text-sm">Wir setzen keine Cookies ein, um zu verfolgen, ob Sie nach der Nutzung unseres Kartenkompasses eine Kreditkarte bei einer Bank beantragen.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Kein Retargeting:</p>
                      <p className="text-sm">Wir verfolgen Sie nicht mit Werbeanzeigen über das Internet.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Kein Verkauf von Profilen:</p>
                      <p className="text-sm">Ihre lokal gespeicherten Sitzungsdaten werden niemals mit Drittanbietern geteilt.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Verwaltung Ihrer Browser-Einstellungen */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Verwaltung Ihrer Browser-Einstellungen</h2>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Da wir ausschließlich essenzielle Technologien verwenden, finden Sie auf unserer Plattform keinen komplexen „Cookie-Consent-Banner" mit Auswahlmöglichkeiten für Marketing-Cookies – weil es diese bei uns nicht gibt.
                </p>
                <p className="text-gray-700 leading-relaxed mb-4">
                  Wenn Sie dennoch nicht möchten, dass essenzielle Cookies oder Local Storage-Daten auf Ihrem Endgerät gespeichert werden, können Sie dies über die Einstellungen Ihres Webbrowsers verhindern oder bestehende Daten löschen.
                </p>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 mb-4">
                  <p className="text-sm text-amber-900">
                    <span className="font-semibold">Bitte beachten Sie:</span> Wenn Sie essenzielle Cookies in Ihrem Browser blockieren, ist ein Login in das FIAON-Dashboard und die Nutzung unserer Software aus Sicherheitsgründen nicht mehr möglich.
                  </p>
                </div>
                <p className="text-gray-700 leading-relaxed mb-4 font-semibold">
                  Anleitungen zur Verwaltung von Cookies in den gängigsten Browsern finden Sie hier:
                </p>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm"><strong>Google Chrome:</strong> Einstellungen &gt; Datenschutz und Sicherheit &gt; Cookies und andere Websitedaten</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm"><strong>Apple Safari:</strong> Einstellungen &gt; Datenschutz &gt; Cookies blockieren</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm"><strong>Mozilla Firefox:</strong> Einstellungen &gt; Datenschutz &amp; Sicherheit &gt; Cookies und Website-Daten</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Verantwortliche Stelle */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-gray-200/50">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Verantwortliche Stelle</h2>
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold">SCP Real Estate KG</p>
                  <p>Pasinger Str. 1</p>
                  <p>82166 Gräfelfing</p>
                  <p>Deutschland</p>
                  <p>E-Mail: support@fiaon.com</p>
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
