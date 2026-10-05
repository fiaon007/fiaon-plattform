// ═══════════════════════════════════════════════════════════════════════════
// ALLGEMEINE GESCHÄFTSBEDINGUNGEN — FASSUNG VOM 05.10.2026 (E-283)
//
// Justin, 05.10.2026: „Ja pass die AGBs an". Neu gefasst sind Präambel, § 2,
// § 3, § 4, § 5 Abs. 3 und 4, § 7 (Weiterverwertung), § 8 (Entscheidungen
// Dritter), § 9 (Bonitätsanfragen), § 10 und § 12 (Streitbeilegung). Gründe:
//   · § 2 sagte, FIAON erhalte keine Provisionen von Banken — FIAON erhält aber
//     von der Partnerbank eine Vergütung je Kontoeröffnung
//     (server/lib/fiaon-konto-karte.ts). Jetzt steht da, was stimmt.
//   · § 3 passt zu BEIDEN Antragswegen (/antrag ohne, /antrag-neu mit
//     Unterschrift vor „Zahlungspflichtig annehmen“) und kennt die FIAON-PIN.
//   · § 5 Abs. 3: Stichtag der Raten ist der Eingang der ersten Rate, wie es
//     der Motor rechnet (server/lib/fiaon-abo-zyklus.ts) und der neue Vertrag
//     sagt; Abs. 4: keine Lastschrift mehr (seit E-194).
//   · § 10: die Belehrung aus EINER Quelle (shared/fiaon-global-widerruf.ts,
//     gesetzliches Muster mit Telefonnummer) — ohne die interne Umsetzungs-
//     notiz und ohne „Erlöschen bei digitalen Inhalten“.
//   · § 12: Die OS-Plattform der EU ist seit dem 20.07.2025 abgeschaltet.
//
// NICHT geändert: § 6 (Laufzeit — Justins beschlossene Fassung, bewacht von
// scripts/pruef-laufzeit.ts) und § 5 Abs. 1, 2, 5–7. Die Absatznummern 5 und 6
// in § 5 bleiben, der Vertrag verweist auf „§ 5 Absatz 5 und 6 der AGB“.
//
// Wer diese Seite inhaltlich ändert, erhöht AGB_FASSUNG
// (shared/fiaon-vertrag-paket.ts) und legt die bisherige Fassung WÖRTLICH ins
// Archiv (client/src/pages/agb-archiv/) — Verträge verlinken ihre Fassung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { AGB_FASSUNG } from "@shared/fiaon-vertrag-paket";
import { agbDatumLang } from "@shared/fiaon-antrag-neu";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import { FassungenListe } from "@/pages/agb-archiv/ArchivKopf";

/** Die Widerrufsbelehrung — dieselbe Quelle wie Anlage 1 und 2 des neuen Vertrags (gesetzliches Muster, wörtlich). */
const WB = globalWiderrufsbelehrung("de");

export default function AGBPage() {
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
                Die FIAON LTD, 128 City Road, London, EC1V 2NX, Vereinigtes Königreich, eingetragen im Companies House (England and Wales) unter der Company Registration Number 17318250, vertreten durch den Director Justin Schwarzott (nachfolgend „Anbieterin" oder „FIAON"), betreibt unter der Domain fiaon.com eine Plattform, über die sie ihre Kunden auf dem Weg zu einer geordneten Bonität und einer eigenen Kreditkarte begleitet: mit Auswertungen der eigenen Unterlagen, einem persönlichen Fahrplan im Kundenbereich und – je nach Paket – persönlicher Begleitung.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Diese AGB regeln das Vertragsverhältnis zwischen der Anbieterin und den registrierten Nutzern (nachfolgend „Nutzer" oder „Kunde").
              </p>
            </div>
          </div>

          {/* Fassung und Geltung — E-283 (05.10.2026): Datum aus AGB_FASSUNG, frühere Fassungen im Archiv /agb/<Fassung>.
              Vorher stand hier „steht in Ihrer Bestellbestätigung und in Ihrem Kundenbereich" — der alte Antrag
              verschickt keine Bestätigung mit Fassung, der Kundenbereich zeigt sie nur im Vertrags-PDF. */}
          <div className="fiaon-glass-panel rounded-2xl p-6" data-agb-fassung={AGB_FASSUNG}>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong>Fassung vom {agbDatumLang(AGB_FASSUNG)}.</strong> Diese Bedingungen gelten für Verträge, die ab diesem Tag geschlossen werden; nennt Ihr Vertrag oder Ihre Vertragsbestätigung eine andere Fassung, gilt jene.
              Gegenüber der Fassung vom 26. September 2026 sind neu gefasst: Präambel, § 2, § 3, § 4, § 5 Absatz 3 und 4, § 7 (Weiterverwertung), § 8 (Entscheidungen Dritter), § 9 (Bonitätsanfragen), § 10 und § 12 (Streitbeilegung).
              Für früher geschlossene Verträge gelten die jeweils bei Vertragsschluss vereinbarten Bedingungen fort.
            </p>
            <p className="text-sm text-gray-600 leading-relaxed mt-2">
              Frühere Fassungen zum Nachlesen und Speichern: <FassungenListe />
            </p>
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
                Vertragsgegenstand ist der Zugang zur FIAON-Plattform (Kundenbereich mit Auswertungen und persönlichem Fahrplan) und die Erbringung der im gebuchten Paket beschriebenen Leistungen (§ 4).
              </p>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold mb-2">Keine Finanzvermittlung:</h3>
                  <p className="text-sm">Die Anbieterin vermittelt keine Kredite, Darlehen, Versicherungen oder Finanzanlagen und übt keine Tätigkeit aus, die nach §§ 34c, 34d, 34f oder 34i der Gewerbeordnung (GewO) einer Erlaubnis bedarf. Die Anbieterin ist kein Kredit- oder Finanzdienstleistungsinstitut nach dem Kreditwesengesetz (KWG) und unterliegt nicht der Aufsicht der BaFin.</p>
                </div>
                {/* E-283: Hier stand unter „Unabhängigkeit", die Plattform erhalte keine Provisionen, Lead-Vergütungen oder
                    Kick-backs von Banken. Falsch, seit FIAON den Antragslink der Partnerbank (DKB) verschickt und je Kontoeröffnung
                    vergütet wird (server/lib/fiaon-konto-karte.ts). Der einzige vergütete Link ist dieser; andere genannte
                    Anbieter bringen FIAON nichts ein. „Über den Rahmen …" steht hier bewusst NICHT (Justin, E-281: nur
                    dort, wo ein Limit genannt ist — das ist § 4 Absatz 2). */}
                <div>
                  <h3 className="font-semibold mb-2">Partnerbank und Vergütung:</h3>
                  <p className="text-sm">FIAON arbeitet mit einer Partnerbank zusammen. Erhält der Nutzer von FIAON den Antragslink der Partnerbank, stellt er den Antrag selbst und im eigenen Namen. Eröffnet die Partnerbank daraufhin ein Konto, erhält FIAON dafür eine Vergütung. Für den Nutzer entstehen dadurch keine Kosten, und der Preis seines Pakets hängt davon nicht ab. Über Konto und Karte entscheidet allein die Bank. Andere auf der Plattform genannte Anbieter und Finanzprodukte nennt FIAON nur zur Information; von ihnen erhält FIAON keine Vergütung.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Entscheidungen des Nutzers:</h3>
                  <p className="text-sm">Der Nutzer trifft alle finanziellen Entscheidungen, insbesondere über Konto- und Kartenanträge, selbst und stellt Anträge direkt beim jeweiligen Institut.</p>
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
              {/* E-244 (26.09.2026): Der Knopf heißt „Zahlungspflichtig annehmen" (§ 312j Abs. 3 BGB); die Anbieterin gibt
                  das Angebot ab, der Nutzer nimmt es an. E-283 (05.10.2026): Absatz 2 und 3 gelten für BEIDE Antragswege —
                  /antrag (Schritt „Vertrag", Bestellübersicht über dem Knopf) und /antrag-neu (ausformulierter Vertrag,
                  Unterschrift Pflicht, Übersicht und Knopf im Schritt „Unterschrift", antrag-neu/schritte-abschluss.tsx).
                  Den Ausklappblock „Frühere Fassung von § 3" (03.09.) gibt es nicht mehr: Die ganze Fassung vom 03.09.
                  steht unter /agb/2026-09-03, die vom 26.09. mit diesem Block unter /agb/2026-09-26. */}
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(1)</strong> Die Darstellung der Leistungspakete (z. B. Start, Pro, Ultra, High-End) auf der Website ist noch kein rechtlich bindendes Angebot.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(2) Angebot der Anbieterin.</strong> Im Antrag wählt der Nutzer ein Leistungspaket und macht seine Angaben. Danach unterbreitet die Anbieterin ihm im Antrag ein verbindliches Angebot zum Abschluss des Vertrages über das gewählte Paket; legt sie dazu einen ausformulierten Vertrag vor, ist dieser ihr Angebot. Paket, Leistung, Höhe der Monatsrate, Gesamtvergütung, Laufzeit, Zahlungsweise und Kündigungsregel stehen in der Bestellübersicht unmittelbar über der Schaltfläche nach Absatz 3.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(3) Annahme durch den Nutzer.</strong> Der Nutzer nimmt das Angebot an, indem er die Schaltfläche „Zahlungspflichtig annehmen" anklickt; sieht der Antrag eine Unterschrift vor, unterschreibt er vorher im dafür vorgesehenen Feld. Mit dem Klick kommt der Vertrag zustande. Bis dahin kann der Nutzer seine Angaben und das gewählte Paket prüfen und über die dafür vorgesehenen Schaltflächen (z. B. „Angaben ändern", „Paket ändern") oder durch Zurückgehen im Antrag berichtigen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(4) Nachgeholte Erklärung.</strong> Fehlt nach dem Antrag noch die Annahme des Vertrages, kann der Nutzer sie über einen persönlichen Bestätigungslink nachholen, sofern Paket und Monatsrate feststehen. Auch dort stehen die Angaben nach Absatz 2 unmittelbar über der Schaltfläche „Zahlungspflichtig annehmen", und der Vertrag kommt mit deren Anklicken zustande.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(5)</strong> Der Nutzer verpflichtet sich, bei der Registrierung wahrheitsgemäße und vollständige Angaben zu machen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(6) Weitergabeverbot:</strong> Die Zugangsdaten und die persönliche FIAON-PIN sind vertraulich zu behandeln; die Weitergabe an Dritte ist untersagt. Bei Zuwiderhandlung behält sich die Anbieterin das Recht vor, den Account fristlos zu sperren und Schadensersatz geltend zu machen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>(7) Persönliche FIAON-PIN.</strong> Legt der Nutzer eine persönliche FIAON-PIN fest, dient sie allein dazu, ihn am Telefon zu erkennen. Der Nutzer kann sie jederzeit in seinem Kundenbereich ändern. Sie ist keine PIN einer Bankkarte; diese vergibt allein die Bank.
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
              {/* E-283: Absatz 1 und 2 behalten ihre Bedeutung (bestelluebersicht-daten.ts verweist auf „§ 4 Abs. 1" und
                  „§ 4 Abs. 2 (Bank entscheidet)"). Der Satz zu den Paketgesprächen gilt, seit die Buchung des
                  Limit-Gesprächs im Kundenbereich live ist (derselbe Deploy). Kein „Garantie" mehr (Wortwand). */}
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(1) Leistungsbeschreibung.</strong> Der genaue Leistungsumfang ergibt sich aus der Leistungsbeschreibung des gebuchten Pakets zum Zeitpunkt des Vertragsschlusses, wie sie in der Bestellübersicht und – wo die Anbieterin einen ausformulierten Vertrag vorlegt – im Vertrag steht (z. B. Auswertung der Bonitätsauskunft, Kontoauszug-Analyse, persönlicher Fahrplan im Kundenbereich, feste Ansprechpartnerin, Limit-Gespräch). Gespräche, die zum Paket gehören (z. B. Startgespräch, Limit-Gespräch), bucht der Nutzer in seinem Kundenbereich. Das erste Limit-Gespräch kann er dort frühestens drei Monate nach Eingang der ersten Monatsrate buchen, jedes weitere frühestens drei Monate nach dem letzten geführten Limit-Gespräch. Voraussetzung ist, dass das Startgespräch geführt ist; ist eine Rate überfällig, erst nach deren Ausgleich. Nicht genutzte Gespräche werden nicht nachgeholt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(2) Kein geschuldeter Erfolg.</strong> Die Anbieterin schuldet keinen bestimmten wirtschaftlichen Erfolg, insbesondere nicht, dass der Nutzer eine bestimmte Kreditkarte, ein bestimmtes Kreditlimit oder eine Veränderung seines Scores bei Auskunfteien (z. B. SCHUFA, KSV1870, CRIF) erreicht. Ein im Antrag angegebenes Ziel-Limit ist die Angabe des Nutzers. Über Konto, Karte und Rahmen entscheidet allein die Bank, über Einträge und Scores die jeweilige Auskunftei.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(3) Bonitätsauskunft.</strong> Die Bonitätsauskunft selbst ist nicht Bestandteil der Pakete. Das Paket umfasst die Auswertung einer Auskunft, die der Nutzer selbst anfordert, oder einer Auskunft, die er gesondert als Zusatzleistung beauftragt. Für die Zusatzleistung gelten Leistung, Einmalpreis, Fälligkeit und Widerrufsbelehrung aus ihrer Bestellung; § 5 Absatz 2 und 3 sowie § 6 Absatz 1, 2, 4 und 7 gelten für sie nicht.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>(4) Verfügbarkeit.</strong> Die Anbieterin gewährleistet eine Verfügbarkeit der SaaS-Dienste von 98,5 % im Jahresmittel. Hiervon ausgenommen sind Zeiten, in denen die Plattform aufgrund von technischen oder sonstigen Problemen, die nicht im Einflussbereich der Anbieterin liegen (höhere Gewalt, Verschulden Dritter), nicht zu erreichen ist, sowie routinemäßige Wartungsarbeiten.
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
              <h2 className="text-xl font-semibold text-gray-900 mb-4">§ 5 Preise, Ratenzahlung und Zahlungsverzug</h2>
              {/* E-283: Absatz 3 — Stichtag ist der Eingang der ersten Rate (server/lib/fiaon-abo-zyklus.ts: Anker = Tag der
                  bankbestätigten Buchung; Vertrag § 5 Abs. 2; ZAHLUNG_ZEILE in bestelluebersicht-daten.ts). Absatz 4 — keine
                  Lastschrift mehr (E-194). Absatz 2 bleibt unverändert: Was nach Rate 12 gezahlt wird, ist offen (golive A6). */}
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(1)</strong> Es gelten die im Zeitpunkt der Bestellung auf der Website ausgewiesenen Preise des gewählten Leistungspakets. Alle Preise verstehen sich in Euro. Gegenüber Verbrauchern verstehen sich die Preise als Endpreise einschließlich einer etwaig anfallenden Umsatzsteuer.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(2) Gesamtvergütung und Ratenzahlung.</strong> Die Vergütung für die Erstlaufzeit nach § 6 Absatz 1 ist eine Gesamtvergütung. Sie wird dem Nutzer aus Gründen der Zahlungserleichterung in zwölf gleich hohen Monatsraten zur Zahlung gestellt; die Ratenzahlung ist zinsfrei. Die Höhe der Monatsrate und die Gesamtvergütung werden vor Vertragsschluss in der Bestellübersicht ausgewiesen und in der Bestellbestätigung wiederholt. Die Ratenzahlung begründet kein monatliches Vertragsverhältnis.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(3) Fälligkeit.</strong> Die erste Rate ist mit Vertragsschluss fällig; der Zugang zur Plattform wird nach ihrem Eingang freigeschaltet. Die weiteren Raten sind jeweils monatlich im Voraus fällig, und zwar jeweils am Kalendertag, an dem die erste Rate bei der Anbieterin eingegangen ist. Fällt dieser Tag in einem Monat nicht an, tritt der letzte Tag des Monats an seine Stelle.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(4) Zahlungsweg.</strong> Die Zahlung erfolgt per Überweisung auf das in der Rechnung und auf der Zahlungsseite genannte Konto der Anbieterin unter Angabe des dort genannten Verwendungszwecks.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(5) Verzug.</strong> Gerät der Nutzer mit einer Rate in Verzug, ist die Anbieterin berechtigt, Verzugszinsen in gesetzlicher Höhe (§ 288 BGB) zu verlangen. Die Anbieterin ist ferner berechtigt, den Zugang zur Plattform bis zur vollständigen Begleichung der offenen Forderung zu sperren; die Zahlungspflicht bleibt hiervon unberührt. Eine Mahnpauschale wird gegenüber Verbrauchern nicht erhoben.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(6) Abgabe an ein Inkassounternehmen.</strong> Bleibt eine fällige Forderung nach zwei erfolglosen Mahnungen in Textform und nach Ablauf einer jeweils gesetzten angemessenen Zahlungsfrist unbeglichen, ist die Anbieterin berechtigt, die Forderung zur Einziehung an ein Inkassounternehmen oder einen Rechtsanwalt zu übergeben. Die dadurch entstehenden Kosten der zweckentsprechenden Rechtsverfolgung trägt der Nutzer nach Maßgabe der gesetzlichen Bestimmungen; die Höhe erstattungsfähiger Inkassokosten richtet sich nach § 13e RDG. Eine Übermittlung von Daten an Auskunfteien erfolgt ausschließlich unter den Voraussetzungen des § 31 Absatz 2 Bundesdatenschutzgesetz und nur, soweit die Forderung nicht bestritten ist; der Nutzer wird hierauf zuvor gesondert hingewiesen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>(7) Aufrechnung und Zurückbehaltung.</strong> Der Nutzer kann nur mit unbestrittenen oder rechtskräftig festgestellten Forderungen aufrechnen. Ein Zurückbehaltungsrecht steht ihm nur zu, soweit es auf demselben Vertragsverhältnis beruht.
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
                <strong>(1) Erstlaufzeit.</strong> Der Vertrag über ein Leistungspaket wird mit einer festen Erstlaufzeit von zwölf (12) Monaten geschlossen. Die Laufzeit beginnt mit dem Vertragsschluss. Die Vergütung für die Erstlaufzeit wird nach § 5 Absatz 2 in zwölf Monatsraten gestellt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(2) Kündigung zum Ende der Erstlaufzeit.</strong> Der Vertrag kann von beiden Seiten mit einer Frist von einem (1) Monat zum Ende der Erstlaufzeit gekündigt werden. Wird nicht gekündigt, verlängert sich der Vertrag auf unbestimmte Zeit und kann danach von beiden Seiten jederzeit mit einer Frist von einem (1) Monat gekündigt werden.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(3) Form und Weg der Kündigung.</strong> Die Kündigung bedarf der Textform. Sie kann jederzeit über die Kündigungsschaltfläche auf der Website (fiaon.com/abo-kuendigen), im Kundenbereich oder formlos per E-Mail an support@fiaon.com erklärt werden. Die Anbieterin bestätigt den Zugang der Kündigung sowie den Zeitpunkt der Vertragsbeendigung unverzüglich in Textform.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(4) Vorzeitige Beendigung aus Kulanz.</strong> Wünscht der Nutzer die Beendigung des Vertrages vor Ablauf der Erstlaufzeit, kann die Anbieterin einer vorzeitigen Aufhebung zustimmen. Die Zustimmung setzt voraus, dass sämtliche zum Zeitpunkt des Kündigungswunsches bereits fälligen oder in Rechnung gestellten Raten vollständig ausgeglichen sind. Mit dem Eingang der letzten in Rechnung gestellten Rate endet der Vertrag; weitere Raten werden nicht mehr gestellt. Ein Anspruch auf vorzeitige Aufhebung besteht nicht; die Anbieterin entscheidet nach billigem Ermessen. Ein Verzicht auf bereits entstandene Forderungen ist mit der Aufhebung nicht verbunden.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(5) Außerordentliche Kündigung.</strong> Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für die Anbieterin insbesondere vor, wenn der Nutzer die Plattform missbräuchlich nutzt, das Verbot der Weitergabe von Zugangsdaten verletzt oder mit mindestens zwei aufeinanderfolgenden Raten in Verzug gerät und trotz Fristsetzung nicht zahlt. Für den Nutzer liegt ein wichtiger Grund insbesondere vor, wenn die Anbieterin die geschuldete Leistung trotz angemessener Fristsetzung dauerhaft nicht erbringt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(6) Widerrufsrecht.</strong> Das gesetzliche Widerrufsrecht für Verbraucher nach § 355 BGB bleibt von den Regelungen dieses Paragrafen unberührt. Einzelheiten regelt die Widerrufsbelehrung.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>(7) Upgrades.</strong> Der Nutzer kann jederzeit in ein höheres Leistungspaket wechseln. Das Upgrade wird mit der nächsten fälligen Rate wirksam; ab diesem Zeitpunkt gilt der Preis des höheren Pakets für die verbleibenden Raten der Erstlaufzeit. Bereits gezahlte Beträge des laufenden Monats werden angerechnet. Die Erstlaufzeit verlängert sich durch ein Upgrade nicht.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>(8) Bestandsverträge.</strong> Für Verträge, die vor dem 3. September 2026 geschlossen wurden, gelten die zum Zeitpunkt des jeweiligen Vertragsschlusses vereinbarten Bedingungen fort, insbesondere hinsichtlich Laufzeit und Kündigungsfrist. Absatz 1 bis 3 dieser Fassung finden auf solche Verträge keine Anwendung.
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
                Die Software FIAON, alle damit verbundenen Quellcodes, Algorithmen, UI-Designs, Texte, Coaching-Videos sowie das zugrundeliegende methodische Konzept sind urheberrechtlich geschützt und geistiges Eigentum der FIAON LTD.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Dem Nutzer wird für die Dauer der Vertragslaufzeit ein einfaches, nicht übertragbares, nicht unterlizenzierbares und räumlich unbeschränktes Recht eingeräumt, die Software über einen Webbrowser bestimmungsgemäß zu nutzen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Es ist dem Nutzer strikt untersagt, die Software zu vervielfältigen, zu dekompilieren (Reverse Engineering), zu verändern oder automatisierte Skripte (Scraping) zur Datengewinnung einzusetzen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                <strong>Weiterverwertung:</strong> Der Nutzer darf Inhalte, Auswertungen und Dashboards nur für eigene Zwecke nutzen. Er darf FIAON-Inhalte nicht gewerblich an Dritte verkaufen oder lizenzieren.
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
              {/* E-283: Der dritte Absatz schloss „jegliche Haftung" aus und sagte „auf eigenes Risiko" — das widersprach
                  den beiden Absätzen davor. Jetzt wie der neue Vertrag § 11: keine Haftung für Entscheidungen Dritter. */}
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Anbieterin haftet nach den gesetzlichen Bestimmungen für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung der Anbieterin beruhen, sowie für sonstige Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung oder Arglist beruhen.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Für einfache Fahrlässigkeit haftet die Anbieterin nur bei der Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht). Kardinalpflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Vertragspartner regelmäßig vertrauen darf. In diesem Fall ist die Haftung auf den Ersatz des vertragstypischen, vorhersehbaren Schadens begrenzt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Für Entscheidungen Dritter – insbesondere von Banken, Kartenherausgebern und Auskunfteien, etwa die Ablehnung eines Antrags, die Höhe eines Rahmens oder die Veränderung eines Scores – haftet die Anbieterin nicht. Die Haftung nach den beiden vorstehenden Absätzen bleibt unberührt.
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
                Die Anbieterin führt zu keinem Zeitpunkt Bonitätsanfragen bei der SCHUFA Holding AG oder anderen Auskunfteien durch. Beauftragt der Nutzer die Bonitätsauskunft als Zusatzleistung, fordert die Anbieterin in seinem Auftrag seine eigene Datenkopie (bei der Firmen-Bonitätsauskunft auch die Daten seines Unternehmens) bei den Auskunfteien an.
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
              {/* E-283 (05.10.2026): Die Belehrung kommt aus EINER Quelle — shared/fiaon-global-widerruf.ts, das gesetzliche
                  Muster für Dienstleistungen mit Telefonnummer und Wertersatz-Absatz, wortgleich mit Anlage 1 und 2 des
                  neuen Vertrags. Weggefallen: die Umsetzungsnotiz „(Hinweis für die Umsetzung: … Checkbox …)", die Kunden
                  sahen, und „Erlöschen des Widerrufsrechts bei digitalen Inhalten" (die Pakete sind Dienstleistungen; der
                  Satz „Haben Sie verlangt …" greift nur, wenn der Nutzer den früheren Beginn verlangt hat). */}
              <p className="text-gray-700 leading-relaxed mb-4">
                Schließt der Nutzer den Vertrag als Verbraucher (§ 13 BGB), steht ihm das gesetzliche Widerrufsrecht nach der folgenden Widerrufsbelehrung zu. Für die gesondert beauftragte Bonitätsauskunft gilt die Widerrufsbelehrung, die bei ihrer Bestellung angezeigt wird.
              </p>

              <div className="mt-6 p-6 bg-white/50 rounded-xl border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Widerrufsbelehrung</h3>
                {WB.abschnitte.map((a) => (
                  <div key={a.h} className="mb-4 last:mb-0">
                    <h4 className="font-semibold text-gray-800 mb-2">{a.h}</h4>
                    {a.absaetze.map((t) => (
                      <p key={t} className="text-gray-700 leading-relaxed mb-4 last:mb-0">{t}</p>
                    ))}
                  </div>
                ))}
              </div>

              <div className="mt-6 p-6 bg-white/50 rounded-xl border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4">{WB.formular.titel}</h4>
                <p className="text-gray-500 text-sm mb-4">{WB.formular.hinweis}</p>
                <p className="text-gray-700 mb-2">{WB.formular.an}</p>
                {WB.formular.zeilen.map((z) => (
                  <p key={z} className="text-gray-700 mb-2">{z}</p>
                ))}
                <p className="text-gray-500 text-sm mt-2">{WB.formular.fuss}</p>
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
              {/* LEGAL REVIEW REQUIRED: Rechtswahl/Gerichtsstand UK Ltd vs. deutsches Verbraucherrecht — bestehender Text bewusst NICHT umformuliert, anwaltliche Prüfung (LEXR) ausstehend. */}
              {/* E-283: Der Satz zur OS-Plattform der EU ist weg — die Plattform ist seit dem 20.07.2025 abgeschaltet. */}
              <p className="text-gray-700 leading-relaxed mb-4">
                Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Zwingende Verbraucherschutzbestimmungen des Staates, in dem der Verbraucher seinen gewöhnlichen Aufenthalt hat, bleiben hiervon unberührt.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Ist der Nutzer Kaufmann, eine juristische Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen, ist der ausschließliche Gerichtsstand für alle Streitigkeiten aus diesem Vertrag München.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Die Anbieterin ist weder verpflichtet noch bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Sollten einzelne Bestimmungen dieses Vertrages unwirksam sein oder werden, so wird hierdurch die Gültigkeit des Vertrages im Übrigen nicht berührt. Anstelle der unwirksamen Bestimmung gelten die gesetzlichen Vorschriften.
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
