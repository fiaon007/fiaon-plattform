import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [, setLocation] = useLocation();

  const searchString = useSearch();
  const token = new URLSearchParams(searchString).get("token");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsVerifying(false);
        setTokenValid(false);
        setErrorMessage("Kein Token vorhanden");
        return;
      }
      try {
        const response = await fetch(`/api/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        setTokenValid(data.valid);
        if (!data.valid) {
          setErrorMessage(data.message || "Ungültiger oder abgelaufener Link");
        }
      } catch {
        setTokenValid(false);
        setErrorMessage("Fehler bei der Token-Überprüfung");
      } finally {
        setIsVerifying(false);
      }
    };
    verifyToken();
  }, [token]);

  const passwordTooShort = newPassword.length > 0 && newPassword.length < 6;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= 6 && newPassword === confirmPassword && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (newPassword.length < 6) { setFormError("Das Passwort muss mindestens 6 Zeichen haben."); return; }
    if (newPassword !== confirmPassword) { setFormError("Die Passwörter stimmen nicht überein."); return; }

    setIsLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setResetSuccess(true);
      } else {
        setFormError(
          data.error === "invalid_or_expired" ? "Dieser Link ist ungültig oder abgelaufen."
            : data.error === "password_too_short" ? "Das Passwort muss mindestens 6 Zeichen haben."
            : "Passwort konnte nicht geändert werden."
        );
      }
    } catch {
      setFormError("Verbindung zum Server fehlgeschlagen.");
    } finally {
      setIsLoading(false);
    }
  };

  const headlineStyle = {
    fontFamily: "Orbitron, sans-serif",
    fontWeight: 700,
    background: "linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  } as const;

  const cardStyle = {
    maxWidth: 460,
    background: "rgba(10,10,10,0.6)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: "1px solid rgba(254,145,0,0.22)",
  } as const;

  const inputStyle = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    fontFamily: "Inter, system-ui, sans-serif",
    boxShadow: "inset 0 2px 8px rgba(0,0,0,0.6)",
  } as const;

  const btnPrimary = {
    fontFamily: "Inter, system-ui, sans-serif",
    background: "linear-gradient(180deg, rgba(254,145,0,0.16), rgba(255,255,255,0.02))",
    border: "1px solid rgba(254,145,0,0.30)",
    color: "#FE9100",
  } as const;

  const btnSecondary = {
    fontFamily: "Inter, system-ui, sans-serif",
    background: "linear-gradient(180deg, rgba(254,145,0,0.08), rgba(255,255,255,0.01))",
    border: "1px solid rgba(254,145,0,0.20)",
    color: "#FE9100",
  } as const;

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(to bottom, #0f0f0f, #141414)" }}
    >
      <div className="w-full p-8 sm:p-10 rounded-2xl" style={cardStyle}>
        {children}
      </div>
    </div>
  );

  // Loading
  if (isVerifying) {
    return (
      <Shell>
        <div className="text-center py-8">
          <div
            className="w-10 h-10 border-[3px] rounded-full animate-spin mx-auto mb-4"
            style={{ borderColor: "rgba(254,145,0,.25)", borderTopColor: "#FE9100" }}
          />
          <p className="text-[14px]" style={{ color: "rgba(245,245,247,.56)" }}>Link wird überprüft…</p>
        </div>
      </Shell>
    );
  }

  // Invalid token
  if (!tokenValid && !resetSuccess) {
    return (
      <Shell>
        <div className="text-center space-y-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(254,145,0,.10)" }}>
            <XCircle className="w-7 h-7" style={{ color: "#FE9100" }} />
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold" style={headlineStyle}>Link ungültig</h1>
          <p className="text-[14px]" style={{ color: "rgba(245,245,247,.56)" }}>{errorMessage}</p>
          <div className="space-y-3 pt-2">
            <button onClick={() => setLocation("/forgot-password")} className="w-full h-11 rounded-full text-sm font-semibold transition-all duration-200" style={btnPrimary}>
              Neuen Link anfordern
            </button>
            <button onClick={() => setLocation("/auth")} className="w-full h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200" style={btnSecondary}>
              <ArrowLeft className="w-3.5 h-3.5" /> Zur Anmeldung
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // Success
  if (resetSuccess) {
    return (
      <Shell>
        <div className="text-center space-y-5" role="status" aria-live="polite">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(74,222,128,.10)" }}>
            <CheckCircle className="w-7 h-7" style={{ color: "#4ade80" }} />
          </div>
          <h1 className="text-[22px] sm:text-[26px] font-bold" style={headlineStyle}>Passwort geändert</h1>
          <p className="text-[14px]" style={{ color: "rgba(245,245,247,.56)" }}>
            Dein Passwort wurde erfolgreich zurückgesetzt. Du kannst dich jetzt mit deinem neuen Passwort anmelden.
          </p>
          <button onClick={() => setLocation("/auth")} className="w-full h-11 rounded-full text-sm font-semibold transition-all duration-200" style={btnPrimary}>
            Zur Anmeldung
          </button>
        </div>
      </Shell>
    );
  }

  // Reset form
  return (
    <Shell>
      <button
        type="button"
        onClick={() => setLocation("/auth")}
        className="flex items-center gap-1.5 text-[13px] mb-6 transition-colors duration-200"
        style={{ color: "rgba(233,215,196,.72)", fontFamily: "Inter, system-ui, sans-serif" }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = "#FE9100"; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = "rgba(233,215,196,.72)"; }}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Zurück zur Anmeldung
      </button>

      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(254,145,0,.12)" }}>
          <Lock className="w-7 h-7" style={{ color: "#FE9100" }} />
        </div>
        <h1 className="text-[22px] sm:text-[26px] font-bold mb-2" style={headlineStyle}>Neues Passwort</h1>
        <p className="text-[14px]" style={{ color: "rgba(245,245,247,.56)" }}>Gib dein neues Passwort ein.</p>
      </div>

      {formError && (
        <div className="rounded-xl p-3.5 mb-5 text-[13px]" role="alert" style={{ background: "rgba(254,145,0,.08)", border: "1px solid rgba(254,145,0,.28)", color: "#FE9100" }}>
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="newPassword" className="block text-xs font-bold mb-1.5" style={{ color: "rgba(245,245,247,.56)" }}>Neues Passwort</label>
          <div className="relative">
            <input
              id="newPassword"
              type={showPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setFormError(""); }}
              placeholder="Mindestens 6 Zeichen"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full h-11 px-4 pr-10 rounded-xl text-sm text-white/90 placeholder:text-white/30 transition-all duration-200 focus:outline-none"
              style={inputStyle}
              aria-required="true"
              aria-invalid={passwordTooShort}
              onFocus={(e) => { e.target.style.borderColor = "rgba(254,145,0,0.55)"; e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.25), inset 0 2px 8px rgba(0,0,0,0.6)"; }}
              onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "inset 0 2px 8px rgba(0,0,0,0.6)"; }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "rgba(245,245,247,.40)" }}
              aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {passwordTooShort && <p className="text-[12px] mt-1" style={{ color: "#FE9100" }}>Mindestens 6 Zeichen</p>}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-xs font-bold mb-1.5" style={{ color: "rgba(245,245,247,.56)" }}>Passwort bestätigen</label>
          <input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setFormError(""); }}
            placeholder="Passwort wiederholen"
            required
            autoComplete="new-password"
            className="w-full h-11 px-4 rounded-xl text-sm text-white/90 placeholder:text-white/30 transition-all duration-200 focus:outline-none"
            style={inputStyle}
            aria-required="true"
            aria-invalid={passwordsMismatch}
            onFocus={(e) => { e.target.style.borderColor = "rgba(254,145,0,0.55)"; e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.25), inset 0 2px 8px rgba(0,0,0,0.6)"; }}
            onBlur={(e) => { e.target.style.borderColor = "rgba(255,255,255,0.08)"; e.target.style.boxShadow = "inset 0 2px 8px rgba(0,0,0,0.6)"; }}
          />
          {passwordsMismatch && <p className="text-[12px] mt-1" style={{ color: "#FE9100" }}>Passwörter stimmen nicht überein</p>}
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full h-11 rounded-full text-sm font-semibold transition-all duration-200"
          style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? "pointer" : "not-allowed" }}
          onMouseEnter={(e) => { if (canSubmit) { (e.target as HTMLElement).style.transform = "translateY(-2px)"; (e.target as HTMLElement).style.boxShadow = "0 22px 74px rgba(0,0,0,0.60)"; } }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = "translateY(0)"; (e.target as HTMLElement).style.boxShadow = "none"; }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-[#FE9100]/60 border-t-transparent rounded-full animate-spin" />
              Wird gespeichert…
            </span>
          ) : (
            "Passwort speichern"
          )}
        </button>
      </form>
    </Shell>
  );
}
