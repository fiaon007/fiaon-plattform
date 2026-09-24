// ═══════════════════════════════════════════════════════════════════════════
// DATENSCHUTZERKLÄRUNG — /datenschutz und /privacy (eine Seite, deutsch)
//
// 17.09.2026 (E-188): zwei Abschnitte ergänzt, weil /business seit heute FIAON
// Global ist und dort Daten anfallen, die die Erklärung bisher nicht nannte:
//   VII a  FIAON Global — Auftrag für Unternehmen (Firma, Register, Unterzeichner,
//          Unterschrift als Bild, IP/Zeit der Unterschrift, Dokumentenraum)
//   VII b  Firmensuche und Auslesen des Impressums im Auftrag
// BEIDE ABSCHNITTE STEHEN ZUR ANWALTLICHEN DURCHSICHT MIT DEN GLOBAL-VERTRÄGEN
// (Register E-188 „offen: Anwalt"): Rechtsgrundlagen, die Weitergabe an Partner und
// Stellen in den USA (Art. 49 DSGVO) und der KI-Dienst beim Impressum sind nach
// bestem Wissen beschrieben, aber nicht anwaltlich geprüft. Genannt sind nur
// Anbieter, die heute wirklich angefragt werden (server/lib/firmensuche/index.ts):
// openregister.de für Deutschland, UID-Register und LINDAS für die Schweiz, VIES.
// Kommt ein Anbieter dazu (Schlüssel gesetzt), gehört er HIER hinein — vorher nicht.
// Die Nummern „VII a/b" sind Absicht: VIII–X behalten ihre Nummern, auf die
// Verträge und Mails verweisen können.
//
// 19.09.2026 (E-191): VI neu gefasst — Statistik (Microsoft Clarity, Google
// Analytics 4) und Anzeigenmessung (Google Ads) nur mit Einwilligung, dazu die
// Kampagnen-Zuordnung (gclid/utm, 13 Monate) und der Widerruf über den Knopf.
// VII a gilt jetzt für Unternehmen UND Privatpersonen. Beides zur anwaltlichen
// Durchsicht (Register E-191).
//
// 24.09.2026 (E-239): VI a neu — Meta (Facebook, Instagram). Seit 22.09. lädt die
// Marketing-Einwilligung den Meta-Pixel, der Server meldet dieselben Ereignisse per
// Conversions API (gehashte Kontaktdaten, IP, Browser, fbp/fbc), und Leads aus
// Meta-Lead-Formularen kommen direkt an (server/lib/fiaon-meta-leads.ts); ihre Stufen
// gehen nur mit der Lead-Kennung zurück (crmEreignis in server/lib/fiaon-meta-capi.ts).
// Die Erklärung nannte Meta nirgends. Einen Abschnitt zu WhatsApp Business gab es nicht
// — darum eigener Abschnitt statt Ergänzung. Nummer „VI a" wie bei VII a/b: die
// späteren Nummern bleiben. VI.3/VI.4 verweisen darauf, Stand auf 24.09. gesetzt.
// Beschrieben ist, was der Code HEUTE tut — auch, dass der Server einen Widerruf im
// Browser nicht erfährt (siehe VI a Nr. 7). ANWALT: VI a mit Controller Addendum prüfen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

// Öffnet die Cookie-Auswahl (components/site/EinwilligungsHinweis.tsx hört auf dieses Ereignis).
const auswahlOeffnen = () => window.dispatchEvent(new Event("fiaon-einwilligung-oeffnen"));

export default function PrivacyPage() {
  useEffect(() => {
    // Ein Verweis mit Anker (z. B. /datenschutz#meta von der Cookie-Seite) springt zum Abschnitt —
    // die Seite lädt verzögert, der Browser findet den Anker allein nicht.
    // decodeURIComponent wirft bei kaputtem Anker (z. B. „#%E0") — dann einfach nach oben.
    const ziel = (() => { try { return window.location.hash ? document.getElementById(decodeURIComponent(window.location.hash.slice(1))) : null; } catch { return null; } })();
    if (ziel) ziel.scrollIntoView();
    else window.scrollTo(0, 0);
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
                {/* LEGAL REVIEW REQUIRED: Verantwortlicher außerhalb EU (UK Ltd) — Art. 27 DSGVO (EU-Vertreter) und internationale Datentransfers (UK Adequacy Decision) anwaltlich prüfen. */}
                <div className="space-y-2 text-gray-700">
                  <p className="font-semibold">FIAON LTD</p>
                  <p>128 City Road</p>
                  <p>London, EC1V 2NX</p>
                  <p>Vereinigtes Königreich (United Kingdom)</p>
                  <p className="mt-4">Vertreten durch den Director: Justin Schwarzott</p>
                  <p>Company Registration Number: 17318250 (Companies House, England and Wales)</p>
                  <p>E-Mail: support@fiaon.com</p>
                  <p>Website: fiaon.com</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">Hinweis: Die FIAON LTD hat ihren Sitz im Vereinigten Königreich. Für das Vereinigte Königreich besteht ein Angemessenheitsbeschluss der Europäischen Kommission gemäß Art. 45 DSGVO, sodass personenbezogene Daten auf dieser Grundlage übermittelt werden dürfen.</p>
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
                  <div>
                    <h3 className="font-semibold mb-2">4. Kundenbereich „Mein FIAON“ (App-Ansicht)</h3>
                    <p className="text-sm">Im Kundenbereich unter fiaon.com/app verarbeiten wir zusätzlich folgende Daten: (a) <strong>Nutzungsereignisse</strong> – welcher Bildschirm des Bereichs wann geöffnet wurde. Wir speichern dazu nur Ihre Kundennummer, den Bildschirm und den Zeitpunkt, keine IP-Adresse und keine Gerätekennung; die Einträge werden nach 90 Tagen gelöscht. Zweck ist die Verbesserung des Bereichs (Art. 6 Abs. 1 lit. f DSGVO); ein Widerspruch ist jederzeit per E-Mail möglich. (b) <strong>Anmelde-Link</strong> – auf Ihren Wunsch senden wir einen einmalig nutzbaren, 60 Minuten gültigen Link an Ihre bei uns hinterlegte E-Mail-Adresse; wir speichern dazu einen Prüfwert des Links, den Zeitpunkt der Nutzung sowie IP-Adresse und Browserkennung als Sicherheitsnachweis (Art. 6 Abs. 1 lit. b und f DSGVO). (c) <strong>Mitteilungen auf Ihr Gerät</strong> – nur, wenn Sie sie in Ihrem Bereich einschalten; wir speichern die von Ihrem Browser vergebene Empfangsadresse und können sie jederzeit in Ihrem Bereich wieder löschen. Mitteilungen enthalten keine Beträge und keine Namen Dritter und werden nicht zwischen 21 und 8 Uhr versandt. (d) <strong>Elektronische Unterschrift</strong> – unterschreiben Sie eine Vollmacht oder ein Schreiben in Ihrem Bereich, speichern wir das Schriftbild, Ihren Namen, den Zeitpunkt, die IP-Adresse und die Browserkennung als Nachweis der Erklärung (Art. 6 Abs. 1 lit. b DSGVO). (e) <strong>Dokumente</strong> – von Ihnen fotografierte Briefe und die erzeugten Schreiben liegen in Ihrer Akte auf unseren EU-Servern und sind nur für Sie und Ihr FIAON-Team zugänglich.</p>
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
                <h2 className="text-xl font-semibold text-gray-900 mb-4">V. Zahlungsabwicklung (SEPA-Banküberweisung / Vorkasse)</h2>
                {/* LEGAL REVIEW REQUIRED: Datenschutz-Passage Zahlungsabwicklung nach Stripe-Ablösung — Bankverbindung/Zahlungsdienstleister-Angaben anwaltlich prüfen. */}
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Umfang der Verarbeitung</h3>
                    <p className="text-sm">Die Bezahlung der Abonnement-Gebühren erfolgt per Vorkasse durch SEPA-Banküberweisung auf das Geschäftskonto der Anbieterin. Bei der Bestellung erhalten Sie eine individuelle Zahlungsreferenz. Im Rahmen der Zahlungszuordnung verarbeiten wir die von Ihrer Bank übermittelten Überweisungsdaten (Name des Kontoinhabers, IBAN, Verwendungszweck, Betrag, Buchungsdatum). Kreditkartendaten werden von der Anbieterin zu keinem Zeitpunkt erhoben oder gespeichert.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Zweck und Rechtsgrundlage</h3>
                    <p className="text-sm">Die Verarbeitung der Zahlungsdaten erfolgt ausschließlich zum Zwecke der Zahlungsabwicklung, der Zuordnung des Zahlungseingangs zu Ihrer Bestellung sowie der Abrechnung des gewählten Abonnements. Rechtsgrundlage ist die Vertragserfüllung gemäß Art. 6 Abs. 1 lit. b DSGVO sowie die Erfüllung gesetzlicher Aufbewahrungspflichten gemäß Art. 6 Abs. 1 lit. c DSGVO.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Kontoführendes Institut</h3>
                    <p className="text-sm">Das Geschäftskonto der Anbieterin wird bei einem in der Europäischen Union regulierten Zahlungsinstitut geführt. Ihre Überweisung erfolgt über Ihre eigene Bank; für deren Datenverarbeitung ist Ihre Bank eigenständig verantwortlich.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Information über eigene ähnliche Dienstleistungen (§ 7 Abs. 3 UWG)</h3>
                    <p className="text-sm">Wir nutzen die bei Ihrem Antrag angegebene E-Mail-Adresse, um Sie über Ihren Vorgang und über eigene ähnliche Dienstleistungen zu informieren (§ 7 Abs. 3 UWG, Art. 6 Abs. 1 lit. f DSGVO). Dem können Sie jederzeit widersprechen — mit einer Antwort „Stopp“ auf jede E-Mail oder über den Abmeldelink am Ende jeder Nachricht, ohne dass hierfür andere als die Übermittlungskosten nach den Basistarifen entstehen. Nachrichten zu einer laufenden Bestellung (Zugangsdaten, Rechnungen, Terminbestätigungen) sind davon nicht berührt.</p>
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
                    <p className="text-sm">Wir setzen Cookies und Local Storage primär dazu ein, um die Login-Sitzung in unserem geschützten Dashboard aufrechtzuerhalten und die IT-Sicherheit zu gewährleisten. Dazu gehört auch Ihre Entscheidung im Cookie-Hinweis, die wir im Local Storage Ihres Browsers speichern, damit wir Sie nicht bei jedem Aufruf erneut fragen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sowie § 25 Abs. 2 Nr. 2 TDDDG). Unser berechtigtes Interesse liegt in der sicheren und fehlerfreien Bereitstellung unserer Dienste.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Statistik und Anzeigenmessung — nur mit Ihrer Einwilligung</h3>
                    <p className="text-sm">Mit Ihrer Einwilligung setzen wir folgende Dienste ein. Ohne Einwilligung wird keines ihrer Skripte geladen und kein Cookie gesetzt.</p>
                    <ul className="list-disc pl-5 text-sm space-y-2 mt-2">
                      <li><b>Microsoft Clarity</b> (Statistik) — Anbieter: Microsoft Corporation, One Microsoft Way, Redmond, WA 98052, USA; in der EU Microsoft Ireland Operations Limited, One Microsoft Place, South County Business Park, Leopardstown, Dublin 18, Irland. Zweck: Nutzung der Website verstehen (aufgerufene Seiten, Klicks, Scrolltiefe, Heatmaps und Sitzungsaufzeichnungen, in denen Formulareingaben maskiert sind). Cookies: _clck (1 Jahr), _clsk (1 Tag).</li>
                      <li><b>Google Analytics 4</b> (Statistik) — Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Zweck: Zugriffszahlen und Wege durch die Website; Google-Signale und Personalisierung sind ausgeschaltet. Cookies: _ga und _ga_* (2 Jahre).</li>
                      <li><b>Google Ads Conversion-Messung</b> (Marketing) — Anbieter: Google Ireland Limited (Anschrift wie oben). Zweck: zu erkennen, ob ein Gespräch oder ein Auftrag aus einer unserer Anzeigen kam. Personalisierte Werbung und Retargeting sind ausgeschaltet. Cookie: _gcl_au (90 Tage).</li>
                      <li><b>Meta Pixel und Conversions API</b> (Marketing) — Anbieter: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland. Zweck: Messung und Optimierung unserer Anzeigen auf Facebook und Instagram. Cookies: _fbp und _fbc (90 Tage). Einzelheiten, auch zur gemeinsamen Verantwortlichkeit mit Meta, in Abschnitt VI a.</li>
                    </ul>
                    <p className="text-sm mt-2">Rechtsgrundlage ist Ihre Einwilligung nach § 25 Abs. 1 TDDDG und Art. 6 Abs. 1 lit. a DSGVO. Microsoft, Google und Meta können Daten in den USA verarbeiten; alle drei sind nach dem EU-US Data Privacy Framework zertifiziert, für das die Europäische Kommission am 10. Juli 2023 ein angemessenes Datenschutzniveau festgestellt hat (Art. 45 DSGVO).</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Zuordnung von Anzeigen und Kampagnen</h3>
                    <p className="text-sm">Kommen Sie über eine Anzeige oder einen Kampagnen-Link zu uns, enthält die Adresse Kampagnenangaben (zum Beispiel utm_campaign oder die Klick-Kennungen gclid von Google und fbclid von Meta). Vereinbaren Sie während desselben Besuchs ein Gespräch oder erteilen Sie einen Auftrag, speichern wir diese Angaben zusammen mit der Buchung oder dem Auftrag, um zu erkennen, welche Kampagne zu einem Auftrag geführt hat. Auf Ihrem Gerät abgelegt (Session Storage, „fiaon_kampagne“) werden die Angaben nur mit Ihrer Einwilligung in Marketing. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist die Bewertung unserer Werbung. An Google geben wir diese Angaben nicht weiter. Die Meta-Klick-Kennung fbclid gehört nicht zu diesen gespeicherten Kampagnenangaben: Nur mit Ihrer Einwilligung in Marketing halten wir sie als Kennung _fbc bei Ihrem Antrag, Gespräch oder Auftrag fest und übermitteln sie mit den Ereignissen in Abschnitt VI a an Meta. Wir löschen die Kampagnenangaben nach 13 Monaten.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">5. Widerruf Ihrer Einwilligung</h3>
                    <p className="text-sm">Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft ändern oder widerrufen — über den Knopf unten oder die Seite <a href="/cookie-einstellungen" className="text-blue-600 hover:text-blue-700 underline">Cookie-Einstellungen</a>. Bereits gesetzte Cookies der Anbieter löschen Sie über Ihren Browser.</p>
                    <button type="button" onClick={auswahlOeffnen} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#12284a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#0b1c36] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Cookie-Einstellungen öffnen</button>
                  </div>
                </div>
              </div>
            </div>

            {/* VI a. Meta (Facebook, Instagram) — E-239, 24.09.2026 */}
            {/* LEGAL REVIEW REQUIRED: gemeinsame Verantwortlichkeit (Art. 26) mit dem Meta Controller Addendum abgleichen; Rechtsgrundlage lit. f für die Stufenmeldung der Lead-Formulare; Speicherdauer (bisher keine Löschfrist im Code für fiaon_meta_messung / fiaon_meta_capi). */}
            <div id="meta" className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">VI a. Meta (Facebook, Instagram): Pixel, Conversions API und Lead-Formulare</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Anbieter und gemeinsame Verantwortlichkeit</h3>
                    <p className="text-sm">Anbieter ist die Meta Platforms Ireland Limited, Merrion Road, Dublin 4, D04 X2K5, Irland („Meta“). Für die Erhebung der Daten auf fiaon.com und ihre Übermittlung an Meta sind wir und Meta gemeinsam verantwortlich (Art. 26 DSGVO). Die Vereinbarung dazu ist der Nachtrag von Meta für gemeinsam Verantwortliche (<a href="https://www.facebook.com/legal/controller_addendum" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Controller Addendum</a>). Danach informieren wir Sie über die gemeinsame Verarbeitung — mit diesem Abschnitt —, und Meta ist für Ihre Rechte nach Art. 15 bis 20 DSGVO zu den Daten zuständig, die Meta nach der Übermittlung speichert. Sie können Ihre Rechte aber gegenüber jedem von uns geltend machen (Art. 26 Abs. 3 DSGVO). Was Meta nach der Übermittlung mit den Daten tut, verantwortet Meta allein; Einzelheiten stehen in der <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 underline">Datenschutzrichtlinie von Meta</a>.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Der Meta-Pixel im Browser</h3>
                    <p className="text-sm">Nur wenn Sie Marketing zustimmen, lädt fiaon.com den Meta-Pixel. Er meldet Meta die aufgerufenen Seiten und diese Schritte: Antrag begonnen, Paket gewechselt, Antrag abgeschickt, Gespräch gebucht und Auftrag erteilt — soweit vorhanden mit dem gewählten Paket und seinem Preis. Dabei erhält Meta Ihre IP-Adresse, Angaben zu Browser und Gerät, die aufgerufene Adresse und die Cookies _fbp (Kennung Ihres Browsers) und _fbc (Klick-Kennung aus der Anzeige), beide 90 Tage gültig. Sind Sie im selben Browser bei Facebook oder Instagram angemeldet, kann Meta den Besuch Ihrem Konto zuordnen. Den automatischen Abgleich von Formulareingaben durch den Pixel („Advanced Matching“) und seine automatischen Ereignisse (etwa selbst erkannte Klicks auf Schaltflächen) haben wir ausgeschaltet.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Conversions API: dasselbe Ereignis von unserem Server</h3>
                    <p className="text-sm">Werbeblocker und Browser-Einstellungen verhindern oft, dass der Pixel meldet. Deshalb übermittelt unser Server die wichtigen Ereignisse zusätzlich direkt an Meta: Antrag begonnen, Antrag abgeschickt, Gespräch gebucht, Auftrag erteilt und — sobald sie bei uns eingeht — Ihre Zahlung. Jedes Ereignis trägt dieselbe Kennung wie im Pixel, sodass Meta es nur einmal zählt. Übermittelt werden: E-Mail-Adresse, Telefonnummer, Vor- und Nachname, Postleitzahl, Ort und Land als SHA-256-Hashwert (Meta bildet aus den eigenen Daten dieselben Hashwerte und ordnet so das Ereignis einem Konto zu), IP-Adresse und Browser-Kennung, die Kennungen _fbp und _fbc, Art, Zeitpunkt und Seite des Ereignisses, Ihre Antrags- oder Auftragsnummer, Paket und Produktart sowie beim Auftrag und beim Kauf der Betrag. Angaben zu Bonität, Einkommen, Schulden oder SCHUFA-Einträgen übermitteln wir nicht. Auch dieser Weg läuft nur mit Ihrer Einwilligung in Marketing.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Rechtsgrundlage für Pixel und Server-Ereignisse</h3>
                    <p className="text-sm">Rechtsgrundlage ist Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO; für das Setzen und Lesen der Cookies in Verbindung mit § 25 Abs. 1 TDDDG). Ohne Einwilligung lädt der Pixel nicht, und unser Server meldet Meta keine Ereignisse zu Ihrem Besuch oder Antrag. Einzige Ausnahme sind Anfragen, die über ein Lead-Formular von Meta zu uns kamen: Deren Stufe melden wir nach Nr. 5 ohne Kontaktdaten zurück.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">5. Lead-Formulare auf Facebook und Instagram</h3>
                    <p className="text-sm">Füllen Sie in einer unserer Anzeigen auf Facebook oder Instagram ein Formular aus, übermittelt Meta uns, was Sie dort eintragen oder bestätigen (Name, E-Mail-Adresse, Telefonnummer, Land, Antworten auf die Fragen des Formulars, Zustimmungen im Formular), dazu die Lead-Kennung von Meta sowie Anzeige, Kampagne und Plattform, über die Sie kamen. Wir nutzen diese Angaben, um Sie wie gewünscht zu kontaktieren und Ihre Anfrage zu bearbeiten (Art. 6 Abs. 1 lit. b DSGVO). Stellen Sie danach Ihren Antrag fertig oder geht Ihre Zahlung ein, melden wir Meta diese Stufe („Antrag fertig“ oder „bezahlt“) — nur mit der Lead-Kennung, die Meta selbst vergeben hat, dem Zeitpunkt und gegebenenfalls dem Betrag, ohne Namen, E-Mail-Adresse, Telefonnummer oder andere Angaben im Klartext. So erkennt Meta, welche Anzeigen zu Kunden führen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist, unsere Werbung auf die Menschen auszurichten, denen wir tatsächlich helfen können. Sie können dem jederzeit widersprechen (Art. 21 DSGVO) — eine Nachricht an support@fiaon.com genügt.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">6. Übermittlung in die USA</h3>
                    <p className="text-sm">Meta verarbeitet Daten auch bei der Meta Platforms, Inc. in den USA. Meta Platforms, Inc. ist nach dem EU-US Data Privacy Framework zertifiziert, für das die Europäische Kommission am 10. Juli 2023 ein angemessenes Datenschutzniveau festgestellt hat (Art. 45 DSGVO).</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">7. Widerruf und Widerspruch</h3>
                    <p className="text-sm">Ihre Einwilligung widerrufen Sie jederzeit mit Wirkung für die Zukunft über die <a href="/cookie-einstellungen" className="text-blue-600 hover:text-blue-700 underline">Cookie-Einstellungen</a> oder den Knopf in Abschnitt VI Nr. 5. Ab dann meldet der Pixel nichts mehr und lädt bei späteren Aufrufen nicht mehr, und Ihr Browser gibt uns keine Meta-Kennungen mehr mit. Ihr Widerruf erreicht auch unseren Server: Ereignisse, die erst später bei uns entstehen — etwa der Eingang Ihrer Zahlung —, meldet er danach nicht mehr an Meta. Bereits gesetzte Cookies löschen Sie über Ihren Browser. Welche Werbung Meta Ihnen zeigt, stellen Sie in Ihrem Facebook- oder Instagram-Konto unter den Werbepräferenzen ein.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">8. Dauer der Speicherung</h3>
                    <p className="text-sm">Die Cookies _fbp und _fbc gelten 90 Tage. Die Kennungen (_fbp, _fbc, IP-Adresse, Browser-Kennung, Kampagnen-Kennung des Anzeigenklicks) speichern wir nur mit Ihrer Einwilligung; sie und der Nachweis der an Meta übermittelten Ereignisse werden nach 13 Monaten gelöscht, nach einem Widerruf werden die Kennungen sofort entfernt. Angaben aus Lead-Formularen behandeln wir wie jede andere Anfrage. Wie lange Meta die Daten speichert, legt Meta in seiner Datenschutzrichtlinie fest.</p>
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

            {/* VII a. FIAON Global — Auftrag für Unternehmen (E-188) */}
            {/* LEGAL REVIEW REQUIRED: zur anwaltlichen Durchsicht mit den Global-Verträgen — Rechtsgrundlagen, Weitergabe an Partner, Übermittlung in die USA (Art. 49 DSGVO), Aufbewahrung. */}
            <div id="fiaon-global" className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">VII a. FIAON Global — Auftrag für Unternehmen und Privatpersonen</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Beschreibung und Umfang der Datenverarbeitung</h3>
                    <p className="text-sm">FIAON Global richtet sich an Unternehmen und an Privatpersonen. Erteilt ein Unternehmen auf unserer Website einen Auftrag, verarbeiten wir: die Angaben zum Unternehmen (Firma, Rechtsform, Sitz und Anschrift, Registergericht und Registernummer, USt-IdNr., Website), die Angaben zur unterzeichnenden Person (Anrede, Vor- und Nachname, Funktion im Unternehmen, geschäftliche E-Mail-Adresse und Telefonnummer), die vor der Unterschrift abgegebenen Bestätigungen, die Unterschrift als Bild sowie Zeitpunkt, IP-Adresse und Browser-Kennung der Unterschrift und einen Prüfwert (Hash) über den unterschriebenen Text. Beauftragen Sie als Privatperson, verarbeiten wir statt der Angaben zum Unternehmen Ihren Namen und Ihre Wohnanschrift, Ihre E-Mail-Adresse und Telefonnummer sowie Ihre Entscheidung, ob wir vor Ablauf der Widerrufsfrist beginnen sollen. Aus diesen Angaben erstellen wir den Auftrag und die Rechnung als PDF. Vereinbaren Sie vorab ein Gespräch, verarbeiten wir dafür Name, Unternehmen (freiwillig), E-Mail-Adresse, Telefonnummer, den gewählten Termin und Ihr Anliegen.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Dokumentenraum und „Mein Auftrag“</h3>
                    <p className="text-sm">Nach dem Zahlungseingang führen wir zu Ihrem Auftrag eine Seite „Mein Auftrag“ mit einem Dokumentenraum. Dort liegen die Unterlagen, die Sie hochladen oder die wir für Sie einstellen — zum Beispiel Ausweiskopien und Adressnachweise der Gesellschafter und der Geschäftsführung, Registerauszüge und Gründungsunterlagen —, dazu der Stand des Auftrags, Fristen, Ihre Nachrichten an die zuständige Person und der Verlauf der Bearbeitung. Die Seite hat kein Passwort: Sie öffnet sich über einen signierten Link, der an Ihre Auftragsnummer gebunden ist und 30 Tage gilt. Einen neuen Link senden wir ausschließlich an die E-Mail-Adresse, die am Auftrag hinterlegt ist.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Zweck und Rechtsgrundlage</h3>
                    <p className="text-sm">Die Verarbeitung dient dem Abschluss und der Durchführung des Auftrags: Vertrag und Rechnung ausfertigen, den Zahlungseingang zuordnen und an eine offene Zahlung erinnern, die Gründung und die weiteren Schritte vorbereiten, Fristen führen und mit Ihnen in Kontakt bleiben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Unterschriftsbild, Zeitpunkt, IP-Adresse und Prüfwert dienen dem Nachweis, wer den Auftrag wann in welcher Fassung erteilt hat; Rechtsgrundlage ist insoweit Art. 6 Abs. 1 lit. b und lit. f DSGVO. Soweit wir Unterlagen nach Handels- und Steuerrecht aufbewahren müssen, ist Rechtsgrundlage Art. 6 Abs. 1 lit. c DSGVO.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">4. Empfänger</h3>
                    <p className="text-sm">Im Haus haben die für Ihren Auftrag zuständige Person und die Leitung Zugriff. An Partner — Steuerberater, Anwälte, den Registered Agent — sowie an Behörden und Institute geben wir Daten und Unterlagen nur auf Ihre Veranlassung weiter: wenn Sie uns beauftragen, etwas einzureichen oder weiterzuleiten, oder wenn Sie den Partner selbst mandatieren. Steuerberater und Anwälte arbeiten auf eigenes Mandat und sind für die dort verarbeiteten Daten selbst verantwortlich. Gehen Daten dabei an Stellen in den USA (Behörden, Registered Agent, Institute), geschieht das zur Erfüllung Ihres Auftrags und auf Ihre Veranlassung (Art. 49 Abs. 1 lit. b DSGVO). Für das Hosting (Server in der Europäischen Union, siehe Abschnitt IV) und den E-Mail-Versand setzen wir technische Dienstleister ein, die die Daten nur nach unserer Weisung verarbeiten.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">5. Dauer der Speicherung</h3>
                    <p className="text-sm">Auftrag, Rechnung, Zahlungsdaten und die dazugehörige Korrespondenz bewahren wir nach den handels- und steuerrechtlichen Fristen auf. Unterlagen im Dokumentenraum bewahren wir für die Dauer des Auftrags auf; danach gelten dieselben Fristen, soweit die Unterlagen zu den Geschäftsunterlagen gehören. Unterlagen, für die keine Aufbewahrungspflicht besteht, löschen wir auf Ihren Wunsch — eine Nachricht an support@fiaon.com genügt.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* VII b. Firmensuche im Auftrag (E-188) */}
            {/* LEGAL REVIEW REQUIRED: zur anwaltlichen Durchsicht mit den Global-Verträgen — Anbieter der Registerdaten, KI-Dienst beim Auslesen des Impressums (Drittland), Rechtsgrundlage lit. b/f. */}
            <div id="firmensuche" className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">VII b. Firmensuche und Auslesen des Impressums im Auftrag</h2>
                <div className="space-y-4 text-gray-700">
                  <div>
                    <h3 className="font-semibold mb-2">1. Beschreibung und Umfang der Datenverarbeitung</h3>
                    <p className="text-sm">Im Auftrag für Unternehmen können Sie Ihr Unternehmen suchen, statt alle Angaben von Hand einzutragen. Ihr Suchbegriff und das gewählte Land gehen dazu von unserem Server an einen Anbieter von Registerdaten: für Deutschland an openregister.de (Daten aus dem Handelsregister), für die Schweiz an das UID-Register des Bundesamts für Statistik und an den Linked-Data-Dienst LINDAS des Bundes. Übermittelt werden nur Suchbegriff und Land — nicht Ihre IP-Adresse und keine Kontaktdaten. Zurück kommen die im Register veröffentlichten Angaben (Firma, Rechtsform, Sitz, Register und Registernummer, vertretungsberechtigte Personen). Geben Sie eine USt-IdNr. an, prüfen wir sie über das System VIES der Europäischen Kommission, eine Schweizer UID über das UID-Register; übermittelt wird nur die Nummer.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">2. Auslesen des Impressums</h3>
                    <p className="text-sm">Nennen Sie stattdessen die Website Ihres Unternehmens, ruft unser Server höchstens drei öffentlich zugängliche Seiten ab (Startseite, Impressum oder Kontakt) und liest daraus die Pflichtangaben aus. Beim Auslesen hilft ein KI-Dienst (OpenAI, USA), an den der Text dieser öffentlichen Seite geht — ohne Ihre Kontaktdaten. Übernommen werden nur Werte, die wörtlich auf der Seite stehen; jeden Wert bestätigen oder ändern Sie selbst.</p>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">3. Zweck, Rechtsgrundlage und Speicherung</h3>
                    <p className="text-sm">Suche und Auslesen dienen allein dazu, den Auftrag richtig und ohne Tipparbeit vorzubefüllen; sie sind freiwillig, und jedes Feld lässt sich von Hand ausfüllen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen auf Ihre Anfrage) sowie Art. 6 Abs. 1 lit. f DSGVO (richtige Unternehmensdaten im Vertrag). Treffer halten wir höchstens 24 Stunden im Zwischenspeicher. Dauerhaft gespeichert werden nur die Werte, die Sie im Auftrag bestätigen — zusammen mit der Angabe, aus welcher Quelle sie stammen (siehe Abschnitt VII a).</p>
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
                  Diese Datenschutzerklärung ist aktuell gültig und hat den Stand 24. September 2026. Durch die Weiterentwicklung unserer SaaS-Plattform, die Implementierung neuer KI-Features oder aufgrund geänderter gesetzlicher bzw. behördlicher Vorgaben kann es notwendig werden, diese Datenschutzerklärung zu ändern. Die jeweils aktuelle Datenschutzerklärung kann jederzeit auf unserer Website unter <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline">fiaon.com/privacy</a> von Ihnen abgerufen und ausgedruckt werden.
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