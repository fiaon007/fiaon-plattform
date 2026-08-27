import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* === ANIMATIONS === */
if (typeof document !== "undefined" && !document.head.querySelector('style[data-pw-reset]')) {
  const s = document.createElement("style");
  s.setAttribute("data-pw-reset", "true");
  s.textContent = `
    @keyframes pwFadeUp { from { opacity: 0; transform: translateY(24px) scale(.97); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
    @keyframes pwShimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
    @keyframes pwOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.08); } }
    @keyframes pwOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,25px) scale(1.06); } }
    @keyframes pwSuccessPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes pwRingRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes pwGlowPulse { 0%,100% { opacity: .25; } 50% { opacity: .6; } }
    @keyframes pwCheckDraw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes pwLimitGlow {
      0%,100% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
    }
    .pw-card-enter { animation: pwFadeUp .55s cubic-bezier(.22,1,.36,1) both; }
    .pw-shimmer { position: absolute; inset-y-0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); animation: pwShimmer 2.8s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

/* === HELPERS === */
function Field({ label, req, error, children }: { label: string; req?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        {req && <span className="text-[#2563eb]">*</span>}
      </label>
      {children}
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50/80 px-2.5 py-1 rounded-lg">{error}</p>}
    </div>
  );
}

function PremiumBtn({ children, onClick, disabled, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="relative w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 fiaon-btn-gradient rounded-full text-[15px] font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      style={{ minHeight: 48 }}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)", animation: "pwShimmer 3.2s ease-in-out infinite" }} />
    </button>
  );
}

type Phase = "verify" | "newpass" | "done";

export default function PasswortVergessenPage() {
  const [phase, setPhase] = useState<Phase>("verify");
  // Was der Server über den Zugang sagt — null heißt: die Tür ist offen.
  const [zugang, setZugang] = useState<{ hinweis: string; erklaerung: string; weiter: { text: string; href: string } | null } | null>(null);

  /* Verify fields */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [birthDay, setBirthDay]   = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  /* New password fields */
  const [token, setToken]               = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [confirmPass, setConfirmPass]   = useState("");
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [passError, setPassError]       = useState<string | null>(null);
  const [passLoading, setPassLoading]   = useState(false);

  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { topRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" }); }, [phase]);

  /* Password strength */
  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8)  s++;
    if (newPassword.length >= 12) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthLabel = ["", "Schwach", "Mäßig", "Gut", "Stark", "Sehr stark"][strength];
  const strengthColor = ["", "#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"][strength];

  /* === STEP 1: Verify identity === */
  async function handleVerify() {
    setVerifyError(null);
    if (!firstName || !lastName || !email || !birthDay || !birthMonth || !birthYear) {
      setVerifyError("Bitte alle Felder ausfüllen"); return;
    }
    if (!email.includes("@")) {
      setVerifyError("Bitte eine gültige E-Mail eingeben"); return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/fiaon/verify-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, birthDay, birthMonth, birthYear }),
      });
      const data = await res.json();
      if (!data.ok) {
        setVerifyError(data.error || "Verifizierung fehlgeschlagen");
      } else {
        setToken(data.token);
        setPhase("newpass");
      }
    } catch {
      setVerifyError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setVerifyLoading(false);
    }
  }

  /* === STEP 2: Set new password === */
  async function handleReset() {
    setPassError(null);
    if (newPassword.length < 8) {
      setPassError("Passwort muss mindestens 8 Zeichen haben"); return;
    }
    if (newPassword !== confirmPass) {
      setPassError("Passwörter stimmen nicht überein"); return;
    }
    setPassLoading(true);
    try {
      const res = await fetch("/api/fiaon/reset-password-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPassError(data.error || "Fehler beim Zurücksetzen");
      } else {
        // 27.08.2026: Der Server sagt jetzt mit, ob die Tür überhaupt offen
        // ist. Vorher stand hier „Du kannst dich jetzt anmelden" — und jeder
        // Fünfte lief Sekunden später gegen „Zahlung noch nicht eingegangen".
        setZugang(data.zugangOffen === false ? {
          hinweis: data.hinweis || "Dein Zugang ist noch nicht offen.",
          erklaerung: data.erklaerung || "",
          weiter: data.weiter || null,
        } : null);
        setPhase("done");
      }
    } catch {
      setPassError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setPassLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-100px] left-1/3 w-[700px] h-[700px] rounded-full opacity-[0.035]"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)", animation: "pwOrb1 18s ease-in-out infinite" }} />
        <div className="absolute bottom-[-80px] right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, #3b82f6, transparent 70%)", animation: "pwOrb2 14s ease-in-out infinite" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.015]"
          style={{ background: "radial-gradient(circle, #2563eb, transparent 60%)", animation: "pwGlowPulse 8s ease-in-out infinite" }} />
      </div>

      <GlassNav />

      <div ref={topRef} className="relative z-10 max-w-[480px] mx-auto px-4 pt-28 sm:pt-32 pb-20">

        {/* === PHASE: VERIFY === */}
        {phase === "verify" && (
          <div className="pw-card-enter">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full relative flex items-center justify-center">
                <div className="absolute inset-[-2px] rounded-full" style={{ background: "conic-gradient(#2563eb,#93c5fd,#2563eb)", animation: "pwRingRotate 4s linear infinite" }} />
                <div className="w-[56px] h-[56px] rounded-full bg-white flex items-center justify-center relative z-10 shadow-sm">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Konto-Wiederherstellung</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3">Passwort zurücksetzen</h1>
              <p className="text-[14px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                Bestätige deine Identität — kein E-Mail-Link nötig. Neues Passwort sofort festlegen.
              </p>
            </div>

            {/* Card */}
            <div className="fiaon-glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              {/* Gradient overlay */}
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-[.08]" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                  backgroundSize: "200% 200%",
                  animation: "pwLimitGlow 8s ease-in-out infinite"
                }} />
              </div>

              <div className="relative z-10 space-y-0">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vorname" req>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => { setFirstName(e.target.value); setVerifyError(null); }}
                      placeholder="Max"
                      className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Nachname" req>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => { setLastName(e.target.value); setVerifyError(null); }}
                      placeholder="Mustermann"
                      className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="family-name"
                    />
                  </Field>
                </div>

                {/* Email */}
                <Field label="E-Mail-Adresse" req>
                  <input
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setVerifyError(null); }}
                    placeholder="max@beispiel.de"
                    className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                    autoComplete="email"
                    inputMode="email"
                  />
                </Field>

                {/* Birthdate */}
                <Field label="Geburtsdatum" req>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Day */}
                    <div className="relative">
                      <select
                        value={birthDay}
                        onChange={e => { setBirthDay(e.target.value); setVerifyError(null); }}
                        className="w-full px-3 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none appearance-none"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
                      >
                        <option value="">Tag</option>
                        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{String(i + 1).padStart(2, "0")}</option>)}
                      </select>
                    </div>
                    {/* Month */}
                    <div className="relative">
                      <select
                        value={birthMonth}
                        onChange={e => { setBirthMonth(e.target.value); setVerifyError(null); }}
                        className="w-full px-3 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none appearance-none"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
                      >
                        <option value="">Monat</option>
                        {["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].map((m, i) => (
                          <option key={i} value={String(i + 1)}>{m}</option>
                        ))}
                      </select>
                    </div>
                    {/* Year */}
                    <div className="relative">
                      <select
                        value={birthYear}
                        onChange={e => { setBirthYear(e.target.value); setVerifyError(null); }}
                        className="w-full px-3 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none appearance-none"
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: "28px" }}
                      >
                        <option value="">Jahr</option>
                        {Array.from({ length: 80 }, (_, i) => {
                          const y = new Date().getFullYear() - 17 - i;
                          return <option key={y} value={String(y)}>{y}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                </Field>

                {/* Error */}
                {verifyError && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-[13px] font-medium text-red-600">{verifyError}</p>
                  </div>
                )}

                {/* Security note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 mb-5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <p className="text-[12px] text-blue-700 leading-relaxed">Deine Daten werden sicher verifiziert. Kein Link per E-Mail nötig.</p>
                </div>

                <PremiumBtn onClick={handleVerify} disabled={verifyLoading}>
                  {verifyLoading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      Wird geprüft…
                    </>
                  ) : (
                    <>
                      Identität bestätigen
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </>
                  )}
                </PremiumBtn>

                <div className="pt-5 text-center">
                  <a href="/login" className="text-[13px] text-gray-400 hover:text-[#2563eb] transition-colors">
                    Zurück zum Login
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === PHASE: NEW PASSWORD === */}
        {phase === "newpass" && (
          <div className="pw-card-enter">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full relative flex items-center justify-center">
                <div className="absolute inset-[-2px] rounded-full" style={{ background: "conic-gradient(#22c55e,#86efac,#22c55e)", animation: "pwRingRotate 4s linear infinite" }} />
                <div className="w-[56px] h-[56px] rounded-full bg-white flex items-center justify-center relative z-10 shadow-sm">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-[.2em] mb-2">Identität bestätigt</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3">Neues Passwort festlegen</h1>
              <p className="text-[14px] text-gray-500 max-w-sm mx-auto">
                Wähle ein sicheres Passwort für dein FIAON Konto.
              </p>
            </div>

            {/* Card */}
            <div className="fiaon-glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-[.06]" style={{
                  background: "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(147,197,253,0.15), rgba(37,99,235,0.1))",
                  backgroundSize: "200% 200%",
                  animation: "pwLimitGlow 6s ease-in-out infinite"
                }} />
              </div>

              <div className="relative z-10">
                {/* New password */}
                <Field label="Neues Passwort" req>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setPassError(null); }}
                      placeholder="Mindestens 8 Zeichen"
                      className="w-full pl-4 pr-12 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowNew(!showNew)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
                      {showNew
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                  {/* Strength bar */}
                  {newPassword.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                            style={{ background: i <= strength ? strengthColor : "#e5e7eb" }} />
                        ))}
                      </div>
                      <p className="text-[11px] font-semibold transition-colors" style={{ color: strengthColor }}>{strengthLabel}</p>
                    </div>
                  )}
                </Field>

                {/* Confirm password */}
                <Field label="Passwort bestätigen" req>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      value={confirmPass}
                      onChange={e => { setConfirmPass(e.target.value); setPassError(null); }}
                      placeholder="Passwort wiederholen"
                      className="w-full pl-4 pr-12 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1">
                      {showConfirm
                        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                    {confirmPass && confirmPass === newPassword && (
                      <div className="absolute right-10 top-1/2 -translate-y-1/2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                </Field>

                {/* Password requirements */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-5 p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  {[
                    ["Mindestens 8 Zeichen", newPassword.length >= 8],
                    ["Einen Großbuchstaben", /[A-Z]/.test(newPassword)],
                    ["Eine Zahl", /[0-9]/.test(newPassword)],
                    ["Passwörter stimmen überein", newPassword === confirmPass && confirmPass.length > 0],
                  ].map(([label, met]) => (
                    <div key={label as string} className="flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={met ? "#22c55e" : "#cbd5e1"} strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span className="text-[11px] transition-colors" style={{ color: met ? "#16a34a" : "#94a3b8" }}>{label as string}</span>
                    </div>
                  ))}
                </div>

                {/* Error */}
                {passError && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-[13px] font-medium text-red-600">{passError}</p>
                  </div>
                )}

                <PremiumBtn onClick={handleReset} disabled={passLoading || strength < 2}>
                  {passLoading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" /></svg>
                      Wird gespeichert…
                    </>
                  ) : (
                    <>
                      Passwort speichern
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </>
                  )}
                </PremiumBtn>

                <div className="pt-4 text-center">
                  <button onClick={() => { setPhase("verify"); setToken(""); }}
                    className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors">
                    ← Zurück zur Identifikation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === PHASE: DONE === */}
        {phase === "done" && (
          <div className="pw-card-enter text-center py-8">
            {/* Success icon */}
            <div className="relative w-28 h-28 mx-auto mb-8" style={{ animation: "pwSuccessPop .6s cubic-bezier(.22,1,.36,1) both" }}>
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-green-500"
                style={{ boxShadow: "0 0 60px rgba(34,197,94,.3), 0 0 120px rgba(34,197,94,.1)" }} />
              <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 35% 25%, rgba(255,255,255,.35), transparent 60%)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" strokeDasharray="40" strokeDashoffset="0" style={{ animation: "pwCheckDraw .5s .3s ease both" }} />
                </svg>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-[.2em] mb-2">Erfolgreich</p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-4">
              Passwort gespeichert!
            </h2>

            {zugang ? (
              <>
                {/* Die ehrliche Auskunft: Das Passwort steht, die Tür noch nicht
                    offen. Besser hier in Ruhe erklärt als gleich als Abweisung. */}
                <p className="text-[15px] text-gray-600 mb-3 max-w-md mx-auto leading-relaxed">
                  {zugang.hinweis}
                </p>
                {zugang.erklaerung && (
                  <p className="text-[13.5px] text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
                    {zugang.erklaerung}
                  </p>
                )}
                <div className="max-w-xs mx-auto space-y-3">
                  {zugang.weiter && (
                    <a
                      href={zugang.weiter.href}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 fiaon-btn-gradient rounded-full text-[15px] font-semibold text-white transition-all duration-300 hover:scale-[1.01]"
                      style={{ minHeight: 48 }}
                    >
                      {zugang.weiter.text}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </a>
                  )}
                  <a
                    href="/kontakt"
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full text-[15px] font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800 transition-all duration-300"
                    style={{ minHeight: 48 }}
                  >
                    Beleg schicken oder Frage stellen
                  </a>
                </div>
              </>
            ) : (
              <>
                <p className="text-[15px] text-gray-500 mb-2 max-w-sm mx-auto leading-relaxed">
                  Dein neues Passwort wurde gesetzt. Du kannst dich jetzt damit anmelden.
                </p>
                <p className="text-[13px] text-gray-400 mb-10">Das Fenster wird in wenigen Sekunden weitergeleitet.</p>

                <div className="max-w-xs mx-auto space-y-3">
                  <a
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 fiaon-btn-gradient rounded-full text-[15px] font-semibold text-white transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)]"
                    style={{ minHeight: 48 }}
                  >
                    Jetzt einloggen
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  </a>
                </div>

                {/* Weiterleiten NUR, wenn die Anmeldung auch gelingen kann. */}
                <AutoRedirect />
              </>
            )}
          </div>
        )}
      </div>

      <PremiumFooter />
    </div>
  );
}

function AutoRedirect() {
  const [secs, setSecs] = useState(5);
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s - 1), 1000);
    const r = setTimeout(() => { window.location.href = "/login"; }, 5000);
    return () => { clearInterval(t); clearTimeout(r); };
  }, []);
  return <p className="mt-4 text-[12px] text-gray-400">Weiterleitung in {secs}s…</p>;
}
