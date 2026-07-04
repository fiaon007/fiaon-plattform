import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { api, inputCls, ACCENT } from "./shared";
import { AuthLayout, SubmitButton } from "./motion";

// ============================================================================
// /agent/setup/:token — Passwort festlegen nach Einladung (F2)
// Policy: min. 10 Zeichen, Zahl, Groß- und Kleinbuchstabe. Danach eingeloggt.
// ============================================================================

function policyChecks(pw: string) {
  return [
    { ok: pw.length >= 10, label: "Mindestens 10 Zeichen" },
    { ok: /[0-9]/.test(pw), label: "Mindestens eine Zahl" },
    { ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw), label: "Groß- und Kleinbuchstaben" },
  ];
}

export default function AgentSetupPage() {
  const [, params] = useRoute("/agent/setup/:token");
  const [, navigate] = useLocation();
  const token = params?.token || "";

  const [state, setState] = useState<"checking" | "valid" | "invalid">("checking");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/agent/setup/validate?token=${encodeURIComponent(token)}`).then((r) => {
      if (r.ok) {
        setFirstName(r.json.firstName);
        setState("valid");
      } else {
        setError(r.json?.error || "Einladung ungültig oder abgelaufen");
        setState("invalid");
      }
    });
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw !== pw2) { setError("Passwörter stimmen nicht überein"); return; }
    setBusy(true);
    setError(null);
    const r = await api("/agent/setup", { method: "POST", body: JSON.stringify({ token, password: pw }) });
    setBusy(false);
    if (r.ok) navigate("/agent");
    else setError(r.json?.error || "Fehler beim Speichern");
  };

  const checks = policyChecks(pw);
  const allOk = checks.every((c) => c.ok) && pw === pw2 && pw2.length > 0;

  return (
    <AuthLayout
      title="Zugang einrichten"
      subtitle={state === "valid" && firstName ? `Willkommen, ${firstName} — bitte lege dein Passwort fest.` : undefined}
      homeHref="/agent"
    >
      {state === "checking" && (
        <div className="py-4 space-y-2.5">
          <div className="agent-skeleton h-11 rounded-lg" />
          <div className="agent-skeleton h-11 rounded-lg" />
          <p className="text-[12px] text-slate-400 text-center pt-1">Einladung wird geprüft …</p>
        </div>
      )}

      {state === "invalid" && (
        <div className="text-center py-2">
          <p className="text-[13px] font-medium text-slate-700 mb-2">{error}</p>
          <p className="text-[12px] text-slate-400 leading-relaxed mb-5">
            Einladungs-Links sind 48 Stunden gültig und können nur einmal verwendet werden.
            Bitte deinen Administrator um eine neue Einladung — er kann sie in der Team-Übersicht mit einem Klick erneut senden.
          </p>
          <a
            href="/agent"
            className="inline-flex w-full items-center justify-center px-5 py-3 rounded-xl text-white text-[13px] font-semibold transition-all active:scale-[.99]"
            style={{ background: ACCENT, boxShadow: "0 8px 20px -10px rgba(37,99,235,.6)" }}
          >
            Zur Anmeldung
          </a>
          <a href="/" className="block mt-3 text-[12px] text-slate-400 hover:text-slate-600 transition-colors">Zur Startseite</a>
        </div>
      )}

      {state === "valid" && (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Neues Passwort</label>
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} autoComplete="new-password" style={{ minHeight: 46 }} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Passwort wiederholen</label>
            <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} autoComplete="new-password" style={{ minHeight: 46 }} />
          </div>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.label} className={`text-[12px] flex items-center gap-2 transition-colors ${c.ok ? "text-slate-700" : "text-slate-400"}`}>
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${c.ok ? "" : "bg-slate-300"}`} style={c.ok ? { background: ACCENT } : undefined} />
                {c.label}
              </li>
            ))}
          </ul>
          {error && <p className="text-[12px] font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-2.5">{error}</p>}
          <SubmitButton loading={busy} disabled={!allOk}>
            {busy ? "Speichern …" : "Passwort festlegen und anmelden"}
          </SubmitButton>
        </form>
      )}
    </AuthLayout>
  );
}
