import { useState, useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · Bonitäts-Auszug Antrag  /bonitaet-antrag
   Express Vollauskunft — 74 EUR
   ════════════════════════════════════════════ */

/* ── Keyframe injection ── */
if (typeof document !== "undefined" && !document.head.querySelector('style[data-bonitaet-antrag-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-bonitaet-antrag-anims", "true");
  s.textContent = `
    @keyframes bonReqFadeIn { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:none;} }
    @keyframes bonReqSuccess { from{opacity:0;transform:scale(0.95);}to{opacity:1;transform:scale(1);} }
    @keyframes bonReqCheck { 0%{border-color:#d1d5db;}50%{border-color:#2563eb;}100%{border-color:#10b981;} }
    @keyframes bonReqPulse { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4);}50%{box-shadow:0 0 0 8px rgba(16,185,129,0);} }
    @media (prefers-reduced-motion:reduce) { * { animation-duration:.01ms!important; } }
  `;
  document.head.appendChild(s);
}

/* ── Form validation ── */
function validateAddress(address: string): boolean {
  // Basic German address validation: Street + Number + Zip + City
  const regex = /^[a-zA-ZäöüÄÖÜß\s\-\.]+\s\d+[a-zA-Z]?,?\s*\d{5}\s+[a-zA-ZäöüÄÖÜß\s\-\.]+$/;
  return regex.test(address.trim());
}

function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

function validatePhone(phone: string): boolean {
  // German phone: +49 or 0 followed by 9-11 digits
  const regex = /^(\+49|0)[1-9]\d{8,10}$/;
  return regex.test(phone.replace(/[\s\-\(\)]/g, ""));
}

function validateDate(date: string): boolean {
  const d = new Date(date);
  return !isNaN(d.getTime()) && d < new Date();
}

/* ════════════════════════════════════════════
   PAGE COMPONENT
   ════════════════════════════════════════════ */
export default function BonitaetAntragPage() {
  const [step, setStep] = useState<"form" | "success">("form");
  const [formData, setFormData] = useState({
    fullName: "",
    birthDate: "",
    birthPlace: "",
    address: "",
    phone: "",
    email: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidating(true);
    setErrors({});

    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Bitte geben Sie Ihren vollständigen Namen ein.";
    if (!formData.birthDate || !validateDate(formData.birthDate)) newErrors.birthDate = "Bitte geben Sie ein gültiges Geburtsdatum ein.";
    if (!formData.birthPlace.trim()) newErrors.birthPlace = "Bitte geben Sie Ihren Geburtsort ein.";
    if (!formData.address.trim()) newErrors.address = "Bitte geben Sie Ihre Adresse ein.";
    else if (!validateAddress(formData.address)) newErrors.address = "Bitte geben Sie eine gültige deutsche Adresse ein (Straße Nr., PLZ Stadt).";
    if (!formData.phone.trim()) newErrors.phone = "Bitte geben Sie Ihre Telefonnummer ein.";
    else if (!validatePhone(formData.phone)) newErrors.phone = "Bitte geben Sie eine gültige deutsche Telefonnummer ein.";
    if (!formData.email.trim()) newErrors.email = "Bitte geben Sie Ihre E-Mail-Adresse ein.";
    else if (!validateEmail(formData.email)) newErrors.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setValidating(false);
      return;
    }

    // Simulate validation process
    await new Promise(resolve => setTimeout(resolve, 1500));
    setStep("success");
    setValidating(false);
  };

  return (
    <div className="relative min-h-screen bg-white">
      <GlassNav />

      {/* Header */}
      <section className="pt-32 pb-12 sm:pt-40 sm:pb-16">
        <div className="max-w-[800px] mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-200/60 bg-white/90 shadow-sm mb-6"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: "bonReqPulse 1.8s ease-in-out infinite" }} />
            <span className="text-[12px] font-semibold text-gray-700 tracking-wide uppercase">Express-Abruf</span>
          </div>
          <h1 className="text-[2.2rem] sm:text-[2.8rem] font-extrabold tracking-tight mb-4 fiaon-heading-gradient">
            Bonitäts-Auszug anfordern
          </h1>
          <p className="text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-[540px] mx-auto">
            Füllen Sie das Formular aus. Wir verifizieren Ihre Daten und senden Ihnen Ihre Vollauskunft inkl. Handlungsplan noch am selben Werktag per E-Mail.
          </p>
        </div>
      </section>

      {/* Form Container */}
      <section className="pb-24 sm:pb-32">
        <div className="max-w-[640px] mx-auto px-5 sm:px-8">
          {step === "form" ? (
            <form onSubmit={handleSubmit} className="fiaon-glass-panel rounded-3xl p-8 sm:p-10 shadow-xl"
              style={{ animation: "bonReqFadeIn 0.5s ease-out" }}>
              <div className="space-y-6">
                {/* Vollständiger Name */}
                <div>
                  <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                    Vollständiger Name *
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    placeholder="Vor- und Nachname"
                    className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                      errors.fullName ? "border-red-300" : "border-gray-200"
                    } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                  />
                  {errors.fullName && (
                    <p className="mt-1.5 text-[12.5px] text-red-500">{errors.fullName}</p>
                  )}
                </div>

                {/* Geburtsdatum & Geburtsort */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                      Geburtsdatum *
                    </label>
                    <input
                      type="date"
                      value={formData.birthDate}
                      onChange={(e) => handleChange("birthDate", e.target.value)}
                      className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                        errors.birthDate ? "border-red-300" : "border-gray-200"
                      } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                    />
                    {errors.birthDate && (
                      <p className="mt-1.5 text-[12.5px] text-red-500">{errors.birthDate}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                      Geburtsort *
                    </label>
                    <input
                      type="text"
                      value={formData.birthPlace}
                      onChange={(e) => handleChange("birthPlace", e.target.value)}
                      placeholder="Stadt"
                      className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                        errors.birthPlace ? "border-red-300" : "border-gray-200"
                      } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                    />
                    {errors.birthPlace && (
                      <p className="mt-1.5 text-[12.5px] text-red-500">{errors.birthPlace}</p>
                    )}
                  </div>
                </div>

                {/* Adresse */}
                <div>
                  <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                    Adresse *
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="Musterstraße 123, 12345 Berlin"
                    className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                      errors.address ? "border-red-300" : "border-gray-200"
                    } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                  />
                  {errors.address && (
                    <p className="mt-1.5 text-[12.5px] text-red-500">{errors.address}</p>
                  )}
                  <p className="mt-1.5 text-[11.5px] text-gray-400">
                    Format: Straße Nr., PLZ Stadt
                  </p>
                </div>

                {/* Telefonnummer & E-Mail */}
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                      Telefonnummer *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      placeholder="+49 170 12345678"
                      className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                        errors.phone ? "border-red-300" : "border-gray-200"
                      } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                    />
                    {errors.phone && (
                      <p className="mt-1.5 text-[12.5px] text-red-500">{errors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-[13.5px] font-semibold text-gray-900 mb-2">
                      E-Mail *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      placeholder="max@mustermann.de"
                      className={`fiaon-input-glass w-full px-4 py-3 rounded-xl text-[15px] border ${
                        errors.email ? "border-red-300" : "border-gray-200"
                      } focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all`}
                    />
                    {errors.email && (
                      <p className="mt-1.5 text-[12.5px] text-red-500">{errors.email}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={validating}
                  className="fiaon-btn-gradient w-full py-4 rounded-xl text-[15px] font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {validating ? (
                    <>
                      <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                      Daten werden geprüft...
                    </>
                  ) : (
                    <>
                      Weiter zur Zahlung
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>

                {/* Trust note */}
                <div className="flex items-center justify-center gap-2 text-[12px] text-gray-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" />
                  </svg>
                  SSL-verschlüsselt · Kein Konto erforderlich
                </div>
              </div>
            </form>
          ) : (
            /* Success State */
            <div className="fiaon-glass-panel rounded-3xl p-10 sm:p-12 text-center shadow-xl"
              style={{ animation: "bonReqSuccess 0.6s cubic-bezier(.22,1,.36,1)" }}>
              {/* Success Icon */}
              <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
                style={{
                  background: "linear-gradient(135deg, #10b981, #059669)",
                  boxShadow: "0 12px 40px rgba(16,185,129,0.3)",
                  animation: "bonReqPulse 2s ease-in-out infinite"
                }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 12 10 18 20 6" />
                </svg>
              </div>

              <h2 className="text-[1.8rem] sm:text-[2.2rem] font-extrabold text-gray-900 mb-4 fiaon-heading-gradient">
                Geschafft!
              </h2>
              <p className="text-[15px] sm:text-[16px] text-gray-600 leading-relaxed mb-8 max-w-[420px] mx-auto">
                Zahlung abschließen. Sie erhalten Ihre Selbstauskunft in wenigen Minuten per E-Mail!
              </p>

              {/* Data Summary */}
              <div className="bg-gray-50 rounded-2xl p-5 mb-8 text-left">
                <div className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Ihre Daten</div>
                <div className="space-y-2 text-[13.5px] text-gray-700">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name:</span>
                    <span className="font-medium">{formData.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Geburtsdatum:</span>
                    <span className="font-medium">{formData.birthDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Geburtsort:</span>
                    <span className="font-medium">{formData.birthPlace}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">E-Mail:</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                </div>
              </div>

              {/* Payment Button */}
              <a
                href="https://buy.stripe.com/3cI7sN51dftYa2v5QCfnO06"
                target="_blank"
                rel="noopener noreferrer"
                className="fiaon-btn-gradient inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl text-[15px] font-bold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35 transition-all"
              >
                <span>Zahlung abschließen (74 €)</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>

              <p className="mt-4 text-[12px] text-gray-400">
                Sie werden zu Stripe weitergeleitet
              </p>
            </div>
          )}
        </div>
      </section>

      <PremiumFooter />
    </div>
  );
}
