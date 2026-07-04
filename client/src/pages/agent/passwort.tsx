import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Card, api, inputCls, btnPrimary, ACCENT } from "./shared";

// ============================================================================
// /agent/passwort — Passwort-Reset per E-Mail-Link (F2, Token 1h gültig)
// Ohne ?token= zeigt die Seite das Anforderungs-Formular (Anti-Enumeration).
// ============================================================================

export default function AgentPasswortPage() {
  const [, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api("/agent/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
    setBusy(false);
    setInfo(r.json?.message || "Falls ein Konto existiert, wurde eine E-Mail versendet.");
  };

  const doReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setError("Passwörter stimmen nicht überein"); return; }
    setBusy(true);
    setError(null);
    const r = await api("/agent/reset-password", { method: "POST", body: JSON.stringify({ token, password: pw }) });
    setBusy(false);
    if (r.ok) navigate("/agent");
    else setError(r.json?.error || "Fehler");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/agent" className="text-xl font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</a>
          <h1 className="text-[15px] font-semibold text-slate-900 mt-1">
            {token ? "Neues Passwort festlegen" : "Passwort zurücksetzen"}
          </h1>
        </div>
        <Card className="p-6">
          {token ? (
            <form onSubmit={doReset} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Neues Passwort</label>
                <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="new-password" style={{ minHeight: 46 }} />
                <p className="text-[11px] text-slate-400 mt-1">Min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe.</p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Passwort wiederholen</label>
                <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} autoComplete="new-password" style={{ minHeight: 46 }} />
              </div>
              {error && (
                <div className="text-[12px] font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-2">
                  <p>{error}</p>
                  {/Link|Token|abgelaufen|ungültig/i.test(error) && (
                    <a href="/agent/passwort" className="block mt-1.5 font-semibold hover:underline" style={{ color: ACCENT }}>
                      Neuen Reset-Link anfordern
                    </a>
                  )}
                </div>
              )}
              <button type="submit" disabled={busy || !pw || !pw2} className={`${btnPrimary} w-full py-3`} style={{ minHeight: 48 }}>
                {busy ? "Speichern …" : "Passwort speichern und anmelden"}
              </button>
              <a href="/agent" className="block text-center text-[12px] text-slate-400 hover:text-slate-600">Zurück zur Anmeldung</a>
            </form>
          ) : (
            <form onSubmit={requestReset} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Login-E-Mail</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
              </div>
              {info && <p className="text-[12px] text-slate-500 border border-slate-200 rounded-lg px-3 py-2">{info}</p>}
              <button type="submit" disabled={busy || !email} className={`${btnPrimary} w-full py-3`} style={{ minHeight: 48 }}>
                {busy ? "Sende …" : "Reset-Link anfordern"}
              </button>
              <a href="/agent" className="block text-center text-[12px] text-slate-400 hover:text-slate-600">Zurück zur Anmeldung</a>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
