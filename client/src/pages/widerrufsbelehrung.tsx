// ═══════════════════════════════════════════════════════════════════════════
// /widerrufsbelehrung — EINE QUELLE MIT AGB § 10 UND DEM VERTRAG (05.10.2026, E-283)
//
// Verlinkt aus dem alten Antrag (Bestelluebersicht.tsx), dem Kundenbereich
// (app/Bausteine.tsx), dem Bündel-Sheet des neuen Antrags (antrag-neu/sheets.tsx)
// und von Kaufkarte und Kauflink der Bonitätsauskunft.
//
// Bis heute stand hier ein eigener Wortlaut: ohne Telefonnummer (Pflicht seit
// 2022), mit einem Block „Vorzeitiges Erlöschen … bei digitalen Inhalten“ (die
// Pakete sind Dienstleistungen) und einer zweiten Fassung des Wertersatz-Satzes.
// Jetzt liest die Seite das gesetzliche Muster aus shared/fiaon-global-widerruf.ts
// — wörtlich dasselbe wie AGB § 10 und Anlage 1/2 des neuen Vertrags. Für die
// Bonitätsauskunft kommt der Satz zum vorzeitigen Erlöschen aus ihrer eigenen
// Belehrung (shared/fiaon-auskunft-widerruf.ts) dazu — er gilt nur dort.
// Nicht „verbessern“: Jede Abweichung vom Muster kostet die Musterwirkung.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { globalWiderrufsbelehrung } from "@shared/fiaon-global-widerruf";
import { AUSKUNFT_WIDERRUF } from "@shared/fiaon-auskunft-widerruf";

const WB = globalWiderrufsbelehrung("de");

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
                  Die folgenden Regelungen zum Widerrufsrecht gelten ausschließlich für Nutzer, die einen Vertrag mit FIAON zu Zwecken abschließen, die überwiegend weder ihrer gewerblichen noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden können (Verbraucher im Sinne des § 13 BGB). Für Geschäftskunden (Unternehmer im Sinne des § 14 BGB) besteht kein gesetzliches Widerrufsrecht.
                </p>
              </div>
            </div>

            {/* Die Belehrung — Abschnitte aus dem gesetzlichen Muster (Widerrufsrecht, Folgen des Widerrufs) */}
            {WB.abschnitte.map((a, i) => (
              <div key={a.h} className={`fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden${i === 0 ? " border-2 border-blue-200/50" : ""}`}>
                <div className={`absolute inset-0 ${i === 0 ? "opacity-10" : "opacity-15"} pointer-events-none`} style={{
                  background: i === 0
                    ? "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(59,130,246,0.2), rgba(37,99,235,0.1))"
                    : "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                  backgroundSize: "200% 200%",
                  animation: "limitGlow 6s ease-in-out infinite"
                }} />
                <div className="relative z-10">
                  {i === 0 ? (
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 12l2 2 4-4" />
                          <path d="M21 12c0 4.97-4.03 9-9 9a9.86 9.86 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.97 4.03-9 9-9s9 4.03 9 9z" />
                        </svg>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900">{a.h}</h2>
                    </div>
                  ) : (
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">{a.h}</h2>
                  )}
                  {a.absaetze.map((t) => (
                    <p key={t} className="text-gray-700 leading-relaxed mb-4 last:mb-0">{t}</p>
                  ))}
                </div>
              </div>
            ))}

            {/* Wertersatz (ergänzt 02.09.2026, § 357a Abs. 2 BGB). E-283: Der erste Absatz wiederholte den Muster-Satz
                „Haben Sie verlangt …" in eigenen Worten — eine zweite Fassung derselben Regel. Er ist weg; die Erläuterung
                zur Berechnung bleibt, deutlich NACH der Belehrung und als Erläuterung überschrieben. */}
            <div className="fiaon-glass-panel rounded-2xl p-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Erläuterung zu den Paketen: Berechnung des Wertersatzes</h2>
              <p className="text-gray-700 leading-relaxed">
                Maßgeblich für die Berechnung ist die vereinbarte Gesamtvergütung nach § 5 Absatz 2 der Allgemeinen
                Geschäftsbedingungen. Bereits von Ihnen geleistete Zahlungen werden angerechnet; ein darüber hinausgehender
                Betrag wird Ihnen unverzüglich erstattet.
              </p>
            </div>

            {/* Nur für die Bonitätsauskunft: das vorzeitige Erlöschen (§ 356 Abs. 4 BGB) — aus ihrer eigenen Belehrung.
                ── NUR KOMMENTAR, NIE KUNDENTEXT (25.09.2026, E-240) ─────────────────
                Hier stand bis zum 25.09. öffentlich sichtbar eine Umsetzungsnotiz der Anbieterin („… holen wir diese
                Zustimmung … über eine zwingend anzukreuzende Checkbox im Checkout-Prozess ein"). Für die Auskunft war sie
                falsch: Dort ist der Haken freiwillig („Ohne diesen Haken beginnen wir nach Ablauf der Widerrufsfrist"). */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden border-2 border-amber-200/50">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.2), rgba(245,158,11,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Für die Bonitätsauskunft: {AUSKUNFT_WIDERRUF.erloeschen.h}</h2>
                <p className="text-gray-700 leading-relaxed">
                  {AUSKUNFT_WIDERRUF.erloeschen.text}
                </p>
              </div>
            </div>

            {/* Muster-Widerrufsformular — aus derselben Quelle */}
            <div className="fiaon-glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="relative z-10">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">{WB.formular.titel}</h2>
                <p className="text-gray-500 text-sm mb-6">{WB.formular.hinweis}</p>
                <div className="bg-white/50 rounded-xl p-6 space-y-3">
                  <p className="text-sm text-gray-700">{WB.formular.an}</p>
                  <div className="border-t border-gray-200 pt-4 mt-4 space-y-3">
                    {WB.formular.zeilen.map((z) => (
                      <p key={z} className="text-sm text-gray-700">{z}</p>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-4">{WB.formular.fuss}</p>
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
