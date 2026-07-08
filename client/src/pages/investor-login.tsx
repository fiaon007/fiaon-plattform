import { useState, useEffect } from "react";
import { BtnLabel, useShakeClass } from "@/components/feedback/fx";

export default function InvestorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const shakeClass = useShakeClass(error);

  // Already logged in? → straight to portal
  useEffect(() => {
    let active = true;
    fetch("/api/investor/me", { credentials: "include" })
      .then((r) => { if (active && r.ok) window.location.href = "/banking/dashboard"; })
      .catch(() => {})
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/investor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || "Anmeldung fehlgeschlagen");
        setIsLoading(false);
        return;
      }
      window.location.href = "/banking/dashboard";
    } catch {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0a0f1c] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col" style={{ background: "linear-gradient(160deg,#0a0f1c 0%,#0d1b3e 55%,#0a0f1c 100%)" }}>
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-24 left-1/4 w-[640px] h-[640px] rounded-full opacity-10" style={{ background: "radial-gradient(circle,#1e3a8a,transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-0 right-1/3 w-[460px] h-[460px] rounded-full opacity-[0.08]" style={{ background: "radial-gradient(circle,#B8923A,transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff,transparent 1px,transparent 80px,#fff 81px)" }} />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-6 sm:px-10 py-6">
        <div className="leading-tight">
          <p className="text-white text-[16px] font-semibold tracking-tight">Schwarzott Group</p>
          <p className="text-[10px] font-bold uppercase tracking-[.3em]" style={{ color: "#B8923A" }}>Banking</p>
        </div>
        <a href="/" className="text-[13px] text-white/50 hover:text-white/90 transition-colors">← FIAON.com</a>
      </header>

      {/* Login card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[440px] animate-[fadeInUp_.6s_ease]">
          <div className="rounded-3xl p-8 sm:p-10 relative overflow-hidden" style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(24px) saturate(150%)",
            WebkitBackdropFilter: "blur(24px) saturate(150%)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 40px 80px -20px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.08)",
          }}>
            <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(184,146,58,.7),transparent)" }} />

            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ background: "rgba(184,146,58,.1)", border: "1px solid rgba(184,146,58,.3)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#B8923A" }} />
                <span className="text-[11px] font-semibold uppercase tracking-[.15em]" style={{ color: "#d4af6a" }}>Investoren-Portal</span>
              </div>
              <h1 className="font-display text-[34px] font-semibold tracking-tight mb-2 text-white">Willkommen zurück</h1>
              <p className="text-[14px] text-white/50 leading-relaxed">Melden Sie sich an, um Ihr Portfolio,<br />Ihre Renditen und Verträge einzusehen.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[12px] font-semibold text-white/60 mb-2 uppercase tracking-wider">E-Mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="investor@email.com"
                  autoComplete="email"
                  className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none transition-all text-[14px]" style={{ boxShadow: "none" }} onFocus={e=>e.currentTarget.style.borderColor='#B8923A'} onBlur={e=>e.currentTarget.style.borderColor=''}
                  required
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-white/60 mb-2 uppercase tracking-wider">Passwort</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    className="w-full px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 outline-none transition-all text-[14px]" style={{ boxShadow: "none" }} onFocus={e=>e.currentTarget.style.borderColor='#B8923A'} onBlur={e=>e.currentTarget.style.borderColor=''}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                    {showPassword ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="fx-error-in p-3 rounded-xl text-[13px] text-red-200 text-center" style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className={`w-full py-4 rounded-xl text-[15px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group ${shakeClass}`} style={{ background: "linear-gradient(135deg,#0D1B3E 0%,#162548 100%)", boxShadow: "0 8px 24px rgba(13,27,62,.5)" }}>
                <span className="relative z-10"><BtnLabel busy={isLoading}>Anmelden</BtnLabel></span>
                <div className="absolute inset-0 flex items-center justify-center"><div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" style={{ background: "linear-gradient(90deg,transparent,rgba(212,175,106,.15),transparent)" }} /></div>
              </button>
            </form>

            <div className="mt-8 pt-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <p className="text-[12px] text-white/40 leading-relaxed">
                Noch keinen Zugang? Ihr persönlicher Investoren-Zugang wird durch die Schwarzott Group eingerichtet.
                <br />
                <a href="mailto:invest@schwarzott-group.com" className="transition-colors hover:text-white/80" style={{ color: "#d4af6a" }}>invest@schwarzott-group.com</a>
              </p>
            </div>
          </div>

          <p className="text-center text-[11px] text-white/25 mt-6 leading-relaxed">
            Geschützter Bereich · Schwarzott Group Banking<br />
            Alle Verbindungen sind Ende-zu-Ende verschlüsselt.
          </p>
        </div>
      </main>

      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
