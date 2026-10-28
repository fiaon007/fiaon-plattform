import { useState, useEffect } from "react";
import "@/styles/investor-glas.css";

export default function InvestorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checking, setChecking] = useState(true);

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
      <div className="ib-glas ib-anmeldung flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/25 border-t-white/90 rounded-full animate-spin" />
      </div>
    );
  }

  // E-446: Anmeldung als Sperrbildschirm im Apple-Glas — blaue Bühne, eine Milchglas-Karte, dünne Schrift.
  return (
    <div className="ib-glas ib-anmeldung flex flex-col">
      <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 py-5 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="ib-marke-zeichen" aria-hidden="true">S</div>
          <div className="leading-tight">
            <p className="m-0 text-[15px] text-white" style={{ fontWeight: 400, letterSpacing: "-.01em" }}>Schwarzott Group</p>
            <p className="m-0 mt-1 text-[9.5px] uppercase tracking-[.28em] text-white/70" style={{ fontWeight: 500 }}>Private Banking</p>
          </div>
        </div>
        <a href="/" className="text-[13px] text-white/70 hover:text-white transition-colors min-h-[44px] inline-flex items-center">← FIAON.com</a>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-10">
        <div className="w-full max-w-[440px]">
          <div className="ib-anmeldung-karte">
            <div className="text-center mb-8">
              <span className="ib-stufe"><i />Investoren-Portal</span>
              <h1 className="mt-5 mb-2 text-[34px] text-white" style={{ fontWeight: 300, letterSpacing: "-.03em" }}>Willkommen zurück</h1>
              <p className="m-0 text-[14px] leading-relaxed text-white/75" style={{ fontWeight: 300 }}>Melden Sie sich an, um Ihr Portfolio, Ihre Renditen und Verträge einzusehen.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="ib-feld-l" htmlFor="ib-email">E-Mail</label>
                <input id="ib-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="investor@email.com" autoComplete="email" className="ib-feld" required />
              </div>
              <div>
                <label className="ib-feld-l" htmlFor="ib-passwort">Passwort</label>
                <div className="relative">
                  <input id="ib-passwort" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" className="ib-feld pr-12" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-white/55 hover:text-white transition-colors">
                    {showPassword ? (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    ) : (
                      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-2xl text-[13px] text-white text-center" style={{ background: "rgba(239,68,68,.18)", border: "1px solid rgba(255,160,160,.35)" }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={isLoading} className="ib-knopf-hell w-full disabled:opacity-60 disabled:cursor-not-allowed">
                {isLoading ? "Wird angemeldet…" : "Anmelden"}
              </button>
            </form>

            <div className="mt-8 pt-6 text-center" style={{ borderTop: "1px solid rgba(255,255,255,.16)" }}>
              <p className="m-0 text-[12.5px] text-white/85 leading-relaxed" style={{ fontWeight: 300 }}>
                Noch keinen Zugang? Ihr persönlicher Investoren-Zugang wird durch die Schwarzott Group eingerichtet.
                <br />
                <a href="mailto:invest@schwarzott-group.com" className="text-white underline-offset-4 hover:underline">invest@schwarzott-group.com</a>
              </p>
            </div>
          </div>

          <p className="text-center text-[11.5px] text-white/90 mt-6 leading-relaxed" style={{ fontWeight: 400 }}>
            Geschützter Bereich · Schwarzott Group Banking<br />
            Verbindung TLS-verschlüsselt.
          </p>
        </div>
      </main>
    </div>
  );
}
