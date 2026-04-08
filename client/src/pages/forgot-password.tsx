import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || cooldown > 0) return;
    setIsLoading(true);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // Always show success (no enumeration)
    } finally {
      setIsLoading(false);
      setEmailSent(true);
      setCooldown(20);
    }
  }, [email, isLoading, cooldown]);

  const handleResend = useCallback(async () => {
    if (isLoading || cooldown > 0) return;
    setIsLoading(true);
    try {
      await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // silent
    } finally {
      setIsLoading(false);
      setCooldown(20);
    }
  }, [email, isLoading, cooldown]);

  const headlineStyle = {
    fontFamily: "Orbitron, sans-serif",
    fontWeight: 700,
    background: "linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  } as const;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(to bottom, #0f0f0f, #141414)" }}
    >
      <div
        className="w-full p-8 sm:p-10 rounded-2xl"
        style={{
          maxWidth: 460,
          background: "rgba(10,10,10,0.6)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          border: "1px solid rgba(254,145,0,0.22)",
        }}
      >
        {/* Back to login */}
        <button
          type="button"
          onClick={() => setLocation("/auth")}
          className="flex items-center gap-1.5 text-[13px] mb-6 transition-colors duration-200"
          style={{ color: "rgba(233,215,196,.72)", fontFamily: "Inter, system-ui, sans-serif" }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#FE9100"; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(233,215,196,.72)"; }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Zurück zur Anmeldung
        </button>

        {!emailSent ? (
          <>
            <div className="text-center mb-6">
              <h1 className="text-[22px] sm:text-[26px] font-bold mb-2" style={headlineStyle}>
                Reset Link anfordern
              </h1>
              <p className="text-[14px] leading-relaxed" style={{ color: "rgba(245,245,247,.56)" }}>
                Wenn ein Konto existiert, senden wir dir einen Link.
                <br />
                <span style={{ color: "rgba(245,245,247,.40)" }}>(gültig 60 Minuten)</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-bold mb-1.5"
                  style={{ color: "rgba(245,245,247,.56)" }}
                >
                  E-Mail-Adresse
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@firma.de"
                  required
                  autoComplete="email"
                  aria-required="true"
                  className="w-full h-11 px-4 rounded-xl text-sm text-white/90 placeholder:text-white/30 transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontFamily: "Inter, system-ui, sans-serif",
                    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
                  }}
                  onFocus={(e) => { e.target.style.borderColor = "rgba(254,145,0,0.55)"; e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.25), inset 0 2px 8px rgba(0,0,0,0.6)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "inset 0 2px 8px rgba(0,0,0,0.6)"; }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 rounded-full text-sm font-semibold transition-all duration-200"
                style={{
                  fontFamily: "Inter, system-ui, sans-serif",
                  background: "linear-gradient(180deg, rgba(254,145,0,0.16), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(254,145,0,0.30)",
                  color: "#FE9100",
                  cursor: isLoading ? "wait" : "pointer",
                }}
                onMouseEnter={(e) => { if (!isLoading) { (e.target as HTMLElement).style.transform = "translateY(-2px)"; (e.target as HTMLElement).style.boxShadow = "0 22px 74px rgba(0,0,0,0.60)"; } }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "translateY(0)"; (e.target as HTMLElement).style.boxShadow = "none"; }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-[#FE9100]/60 border-t-transparent rounded-full animate-spin" />
                    Wird gesendet…
                  </span>
                ) : (
                  "Reset Link senden"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center space-y-5" role="status" aria-live="polite">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
              style={{ background: "rgba(254,145,0,.12)" }}
            >
              <Mail className="w-7 h-7" style={{ color: "#FE9100" }} />
            </div>

            <div>
              <h1 className="text-[22px] sm:text-[26px] font-bold mb-2" style={headlineStyle}>
                E-Mail prüfen
              </h1>
              <p className="text-[14px]" style={{ color: "rgba(245,245,247,.56)" }}>
                Falls ein Konto mit{" "}
                <span style={{ color: "#FE9100" }}>{email}</span>{" "}
                existiert, haben wir einen Link gesendet.
              </p>
            </div>

            <div
              className="rounded-xl p-4 text-left text-[13px] leading-relaxed"
              style={{
                background: "rgba(254,145,0,.06)",
                border: "1px solid rgba(254,145,0,.18)",
                color: "rgba(245,245,247,.56)",
              }}
            >
              Prüfe auch deinen Spam-Ordner. Der Link ist 60 Minuten gültig und kann nur einmal verwendet werden.
            </div>

            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading || cooldown > 0}
              className="w-full h-11 rounded-full text-sm font-semibold transition-all duration-200"
              style={{
                fontFamily: "Inter, system-ui, sans-serif",
                background: "linear-gradient(180deg, rgba(254,145,0,0.08), rgba(255,255,255,0.01))",
                border: "1px solid rgba(254,145,0,0.20)",
                color: cooldown > 0 ? "rgba(254,145,0,0.4)" : "#FE9100",
                cursor: cooldown > 0 ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#FE9100]/40 border-t-transparent rounded-full animate-spin" />
                  Wird gesendet…
                </span>
              ) : cooldown > 0 ? (
                `Erneut senden (${cooldown}s)`
              ) : (
                "Erneut senden"
              )}
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-[13px]" style={{ color: "rgba(245,245,247,.45)" }}>
            Passwort doch bekannt?{" "}
            <a
              href="/auth"
              onClick={(e) => { e.preventDefault(); setLocation("/auth"); }}
              className="transition-colors duration-200"
              style={{ color: "#FE9100" }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#e9d7c4"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "#FE9100"; }}
            >
              Anmelden
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}