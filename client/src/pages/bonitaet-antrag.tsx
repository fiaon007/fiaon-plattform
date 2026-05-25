import { useState, useEffect } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · Bonitäts-Auszug Antrag  /bonitaet-antrag
   ════════════════════════════════════════════ */

if (typeof document !== "undefined" && !document.head.querySelector('style[data-ba-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-ba-anims", "true");
  s.textContent = `
    @keyframes baFadeUp   { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;} }
    @keyframes baSuccess  { from{opacity:0;transform:scale(.93);}to{opacity:1;transform:scale(1);} }
    @keyframes baPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.45);}50%{box-shadow:0 0 0 10px rgba(16,185,129,0);} }
    @keyframes baDot      { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.55);}50%{box-shadow:0 0 0 8px rgba(16,185,129,0);} }
    @keyframes baGlow     { 0%,100%{opacity:.35;}50%{opacity:.7;} }
    @keyframes baShimmer  { 0%{transform:translateX(-130%);}100%{transform:translateX(230%);} }
    @keyframes baSpin     { to{transform:rotate(360deg);} }
    @keyframes baCheckIn  { from{stroke-dashoffset:30;}to{stroke-dashoffset:0;} }
  `;
  document.head.appendChild(s);
}

/* ── helpers ── */
const validateEmail  = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const validatePhone  = (v: string) =>
  /^(\+49|0)[1-9]\d{8,10}$/.test(v.replace(/[\s\-\(\)]/g, "")) ||
  /^(\+43|0)[1-9]\d{7,11}$/.test(v.replace(/[\s\-\(\)]/g, ""));
const validatePLZ    = (v: string, country = "DE") =>
  country === "AT" ? /^\d{4}$/.test(v.trim()) : /^\d{5}$/.test(v.trim());
const validateDate   = (v: string) => { const d = new Date(v); return !isNaN(d.getTime()) && d < new Date(); };

/* ── input field ── */
function Field({
  label, placeholder, type = "text", value, onChange, error, hint, disabled, children,
}: {
  label: string; placeholder?: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; hint?: string; disabled?: boolean; children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 mb-2">{label}</label>
      {children ? children : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-3 rounded-xl text-[14.5px] border outline-none transition-all
            ${error ? "border-red-300 bg-red-50/40 focus:ring-2 focus:ring-red-100" : disabled ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-gray-200 bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100"}
          `}
        />
      )}
      {error && <p className="mt-1.5 text-[12px] text-red-500 flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
        {error}
      </p>}
      {hint && !error && <p className="mt-1.5 text-[11.5px] text-gray-400">{hint}</p>}
    </div>
  );
}

/* ── section header ── */
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "linear-gradient(135deg,rgba(37,99,235,.1),rgba(59,130,246,.18))" }}>
        {icon}
      </div>
      <div>
        <div className="text-[15px] font-bold text-gray-900">{title}</div>
        <div className="text-[12px] text-gray-400 mt-0.5">{subtitle}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════ */
export default function BonitaetAntragPage() {
  const [step, setStep] = useState<"form" | "validating" | "success">("form");
  const [formData, setFormData] = useState({
    fullName: "", birthDate: "", birthPlace: "",
    street: "", plz: "", city: "",
    phone: "", email: "", country: "DE",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  const set = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err: Record<string, string> = {};

    if (!formData.fullName.trim())   err.fullName   = "Bitte geben Sie Ihren vollständigen Namen ein.";
    if (!validateDate(formData.birthDate)) err.birthDate = "Bitte geben Sie ein gültiges Geburtsdatum ein.";
    if (!formData.birthPlace.trim()) err.birthPlace  = "Bitte geben Sie Ihren Geburtsort ein.";
    if (!formData.street.trim())     err.street      = "Bitte geben Sie Ihre Straße ein.";
    if (!validatePLZ(formData.plz, formData.country))
      err.plz = formData.country === "AT"
        ? "Bitte geben Sie eine gültige 4-stellige PLZ ein."
        : "Bitte geben Sie eine gültige 5-stellige PLZ ein.";
    if (!formData.city.trim())       err.city        = "Bitte geben Sie Ihren Ort ein.";
    if (!formData.phone.trim())      err.phone       = "Bitte geben Sie Ihre Telefonnummer ein.";
    else if (!validatePhone(formData.phone)) err.phone = "Bitte geben Sie eine gültige Telefonnummer ein (+49 oder +43).";
    if (!formData.email.trim())      err.email       = "Bitte geben Sie Ihre E-Mail-Adresse ein.";
    else if (!validateEmail(formData.email)) err.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein.";

    if (Object.keys(err).length > 0) { setErrors(err); return; }

    setStep("validating");
    const delay = 4000 + Math.random() * 6000;
    await new Promise(r => setTimeout(r, delay));
    setStep("success");
  };

  /* ── formatted address for summary ── */
  const countryLabel = formData.country === "AT" ? "Österreich" : "Deutschland";
  const addressFull = `${formData.street}, ${formData.plz} ${formData.city}, ${countryLabel}`;

  return (
    <div className="relative min-h-screen" style={{ background: "linear-gradient(180deg,#f0f4ff 0%,#ffffff 40%,#f8faff 100%)" }}>
      {/* Ambient orbs */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle at 15% 20%, rgba(37,99,235,0.07), transparent 60%)", filter: "blur(80px)", animation: "baGlow 12s ease-in-out infinite" }} />
      <div className="fixed top-40 right-0 w-[500px] h-[500px] pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle at 85% 30%, rgba(16,185,129,0.05), transparent 60%)", filter: "blur(80px)", animation: "baGlow 16s ease-in-out infinite", animationDelay: "5s" }} />

      <GlassNav />

      {/* ── Header ── */}
      <header className="relative pt-32 pb-10 sm:pt-40 sm:pb-14 text-center z-10">
        <div className="max-w-[700px] mx-auto px-5">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-200/70 bg-white/90 shadow-sm mb-7"
            style={{ backdropFilter: "blur(12px)" }}>
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: "baDot 1.8s ease-in-out infinite" }} />
            <span className="text-[12px] font-bold text-gray-600 tracking-widest uppercase">Express-Abruf · Noch heute</span>
          </div>
          <h1 className="text-[2.3rem] sm:text-[3rem] font-extrabold tracking-tight leading-[1.04] mb-5 fiaon-heading-gradient">
            Bonitäts-Auszug anfordern
          </h1>
          <p className="text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-[500px] mx-auto">
            Füllen Sie das Formular in unter 2 Minuten aus. Ihre Vollauskunft inkl. Handlungsplan erhalten Sie noch am selben Werktag per E-Mail.
          </p>
        </div>
      </header>

      {/* ── Progress bar ── */}
      {step === "form" && (
        <div className="max-w-[680px] mx-auto px-5 mb-8 z-10 relative">
          <div className="flex items-center justify-between text-[12px] font-semibold text-gray-400 mb-2">
            <span className="text-[#2563eb]">Daten eingeben</span>
            <span>Prüfung</span>
            <span>Zahlung</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all" style={{ width: "33%" }} />
          </div>
        </div>
      )}
      {step === "validating" && (
        <div className="max-w-[680px] mx-auto px-5 mb-8 z-10 relative">
          <div className="flex items-center justify-between text-[12px] font-semibold text-gray-400 mb-2">
            <span className="text-[#10b981]">✓ Daten eingegeben</span>
            <span className="text-[#2563eb]">Prüfung läuft…</span>
            <span>Zahlung</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all" style={{ width: "66%" }} />
          </div>
        </div>
      )}
      {step === "success" && (
        <div className="max-w-[680px] mx-auto px-5 mb-8 z-10 relative">
          <div className="flex items-center justify-between text-[12px] font-semibold mb-2">
            <span className="text-[#10b981]">✓ Daten eingegeben</span>
            <span className="text-[#10b981]">✓ Prüfung</span>
            <span className="text-[#2563eb]">Zahlung</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 transition-all" style={{ width: "100%" }} />
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="relative z-10 pb-24 sm:pb-32">
        <div className="max-w-[680px] mx-auto px-5 sm:px-8">

          {/* ══ FORM ══ */}
          {step === "form" && (
            <form onSubmit={handleSubmit} noValidate style={{ animation: "baFadeUp .5s ease-out" }}>
              <div className="space-y-5">

                {/* Block 1: Person */}
                <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-sm border border-gray-100/80"
                  style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.07)" }}>
                  <SectionHeader
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                    title="Persönliche Daten"
                    subtitle="Vollständiger Name, Geburtsdatum und -ort"
                  />
                  <div className="space-y-5">
                    <Field label="Vollständiger Name *" placeholder="Vor- und Nachname" value={formData.fullName}
                      onChange={v => set("fullName", v)} error={errors.fullName} />
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Field label="Geburtsdatum *" type="date" value={formData.birthDate}
                        onChange={v => set("birthDate", v)} error={errors.birthDate} />
                      <Field label="Geburtsort *" placeholder="Stadt" value={formData.birthPlace}
                        onChange={v => set("birthPlace", v)} error={errors.birthPlace} />
                    </div>
                  </div>
                </div>

                {/* Block 2: Adresse */}
                <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-sm border border-gray-100/80"
                  style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.07)" }}>
                  <SectionHeader
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>}
                    title="Aktuelle Wohnanschrift"
                    subtitle="Meldeanschrift — muss mit Schufa-Daten übereinstimmen"
                  />
                  <div className="space-y-5">
                    <Field label="Straße + Hausnummer *" placeholder="Musterstraße 42" value={formData.street}
                      onChange={v => set("street", v)} error={errors.street} />
                    <div className="grid grid-cols-[140px_1fr] gap-5">
                      <Field label="PLZ *" placeholder="12345" value={formData.plz}
                        onChange={v => set("plz", v)} error={errors.plz} />
                      <Field label="Ort *" placeholder="Berlin" value={formData.city}
                        onChange={v => set("city", v)} error={errors.city} />
                    </div>
                    {/* Land — DE / AT selector */}
                    <div>
                      <label className="block text-[13px] font-semibold text-gray-700 mb-2">Land *</label>
                      <div className="flex gap-3">
                        {([
                          { code: "DE", flag: "🇩🇪", label: "Deutschland", sub: "SCHUFA" },
                          { code: "AT", flag: "🇦🇹", label: "Österreich",  sub: "CRIF · KSV1870" },
                        ] as const).map(c => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => set("country", c.code)}
                            className={`flex-1 flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-all ${
                              formData.country === c.code
                                ? "border-blue-400 bg-blue-50/60"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <span className="text-[18px] shrink-0">{c.flag}</span>
                            <div className="text-left flex-1 min-w-0">
                              <div className="text-[13px] font-semibold text-gray-800 leading-tight">{c.label}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">{c.sub}</div>
                            </div>
                            {formData.country === c.code && (
                              <svg className="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="4 12 10 18 20 6"/></svg>
                            )}
                          </button>
                        ))}
                      </div>
                      {formData.country === "AT" && (
                        <div className="mt-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200/70 flex gap-2.5 items-start">
                          <span className="text-[16px] shrink-0 mt-0.5">🇦🇹</span>
                          <p className="text-[12px] text-amber-800 leading-snug">
                            Ihre Bonitätsauskunft wird bei <b>CRIF Bürgel GmbH</b> und <b>KSV1870</b> abgerufen. Sie erhalten eine auf Österreich zugeschnittene Handlungsanleitung.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Block 3: Kontakt */}
                <div className="bg-white rounded-3xl p-7 sm:p-8 shadow-sm border border-gray-100/80"
                  style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.07)" }}>
                  <SectionHeader
                    icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                    title="Kontaktdaten"
                    subtitle="Hierüber senden wir Ihre Auskunft"
                  />
                  <div className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Field label="Telefonnummer *" placeholder="+49 170 12345678" type="tel" value={formData.phone}
                        onChange={v => set("phone", v)} error={errors.phone} />
                      <Field label="E-Mail-Adresse *" placeholder="max@mustermann.de" type="email" value={formData.email}
                        onChange={v => set("email", v)} error={errors.email}
                        hint="Ihre Auskunft wird an diese Adresse gesendet." />
                    </div>
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="submit"
                  className="fiaon-btn-gradient relative w-full py-4 rounded-2xl text-[16px] font-bold text-white overflow-hidden flex items-center justify-center gap-2.5"
                  style={{ minHeight: 58, boxShadow: "0 16px 40px rgba(37,99,235,0.28)" }}
                >
                  <span className="relative z-10">Daten prüfen &amp; weiter</span>
                  <svg className="relative z-10" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)", animation: "baShimmer 3.2s ease-in-out infinite" }} />
                </button>

                {/* Trust strip */}
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12px] text-gray-400 font-medium">
                  {[
                    { icon: "#10b981", text: "SSL-verschlüsselt" },
                    { icon: "#10b981", text: "Kein Konto erforderlich" },
                    { icon: "#10b981", text: "Schufa-neutral" },
                  ].map(t => (
                    <span key={t.text} className="inline-flex items-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2.8" strokeLinecap="round"><polyline points="4 12 10 18 20 6"/></svg>
                      {t.text}
                    </span>
                  ))}
                </div>
              </div>
            </form>
          )}

          {/* ══ VALIDATING ══ */}
          {step === "validating" && (
            <div className="bg-white rounded-3xl p-10 sm:p-12 text-center shadow-sm border border-gray-100"
              style={{ boxShadow: "0 8px 40px rgba(37,99,235,0.1)", animation: "baFadeUp .4s ease-out" }}>
              <div className="w-20 h-20 rounded-full mx-auto mb-7 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,rgba(37,99,235,0.12),rgba(59,130,246,0.2))", border: "2px solid rgba(37,99,235,0.2)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"
                  style={{ animation: "baSpin 1.2s linear infinite" }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </div>
              <h2 className="text-[1.6rem] font-extrabold text-gray-900 mb-3">Daten werden geprüft…</h2>
              <p className="text-[14.5px] text-gray-500 leading-relaxed max-w-[380px] mx-auto">
                Wir verifizieren Ihre Angaben sicher und bereiten Ihren Express-Auftrag vor
                {formData.country === "AT" ? " via CRIF Bürgel & KSV1870" : " via SCHUFA"}.
              </p>
              <div className="mt-7 flex gap-1.5 justify-center">
                {[0, 0.25, 0.5].map(d => (
                  <div key={d} className="w-2 h-2 rounded-full bg-blue-400"
                    style={{ animation: `baDot 1.4s ease-in-out infinite`, animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ══ SUCCESS ══ */}
          {step === "success" && (
            <div style={{ animation: "baSuccess .65s cubic-bezier(.22,1,.36,1)" }}>
              {/* Hero success card */}
              <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-gray-100 mb-5"
                style={{ boxShadow: "0 8px 48px rgba(37,99,235,0.1)" }}>
                <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg,#10b981,#059669)", boxShadow: "0 16px 48px rgba(16,185,129,0.35)", animation: "baPulse 2.5s ease-in-out infinite" }}>
                  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 12 10 18 20 6" strokeDasharray="30" strokeDashoffset="0" style={{ animation: "baCheckIn .5s ease-out .2s both" }}/>
                  </svg>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 mb-5">
                  <span className="text-[11.5px] font-bold text-emerald-600 uppercase tracking-wider">Prüfung erfolgreich</span>
                </div>
                <h2 className="text-[2rem] sm:text-[2.4rem] font-extrabold tracking-tight mb-4 fiaon-heading-gradient">
                  Geschafft!
                </h2>
                <p className="text-[15.5px] sm:text-[16px] text-gray-600 leading-relaxed mb-3 max-w-[420px] mx-auto">
                  Zahlung abschließen — Sie erhalten Ihre Selbstauskunft inkl. persönlichem Handlungsplan noch am <b className="text-gray-900">selben Werktag</b> per E-Mail.
                </p>
                <p className="text-[13px] text-gray-400 mb-8">
                  Lieferung an: <b className="text-gray-700">{formData.email}</b>
                  {formData.country === "AT" && (
                    <span className="block mt-1.5 text-[12px] text-amber-600 font-semibold">
                      🇦🇹 Abfrage via CRIF Bürgel GmbH &amp; KSV1870
                    </span>
                  )}
                </p>

                {/* CTA */}
                <a
                  href="https://buy.stripe.com/3cI7sN51dftYa2v5QCfnO06"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fiaon-btn-gradient relative inline-flex items-center justify-center gap-3 px-9 py-4 rounded-2xl text-[16px] font-bold text-white overflow-hidden"
                  style={{ minHeight: 58, boxShadow: "0 16px 40px rgba(37,99,235,0.3)" }}
                >
                  <span className="relative z-10">Jetzt bezahlen &amp; Auskunft erhalten (74 €)</span>
                  <svg className="relative z-10" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)", animation: "baShimmer 3s ease-in-out infinite" }} />
                </a>
                <p className="mt-3 text-[12px] text-gray-400 flex items-center justify-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z"/></svg>
                  Sichere Zahlung über Stripe · AES-256 verschlüsselt
                </p>
              </div>

              {/* Data summary */}
              <div className="bg-white rounded-3xl p-7 border border-gray-100"
                style={{ boxShadow: "0 4px 20px rgba(37,99,235,0.06)" }}>
                <div className="text-[12px] font-bold text-gray-400 uppercase tracking-widest mb-4">Zusammenfassung Ihrer Angaben</div>
                <div className="space-y-0 divide-y divide-gray-50">
                  {[
                    { label: "Name", value: formData.fullName },
                    { label: "Geburtsdatum", value: formData.birthDate },
                    { label: "Geburtsort", value: formData.birthPlace },
                    { label: "Adresse", value: addressFull },
                    { label: "E-Mail", value: formData.email },
                    { label: "Telefon", value: formData.phone },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-3 gap-4">
                      <span className="text-[13px] text-gray-400 shrink-0">{row.label}</span>
                      <span className="text-[13px] font-medium text-gray-800 text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      <PremiumFooter />
    </div>
  );
}
