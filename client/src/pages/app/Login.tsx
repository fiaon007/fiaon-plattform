// ═══════════════════════════════════════════════════════════════════════════
// /app/login — das neue Kunden-Login (05.09.2026).
//
// Hell, eine Karte, eine Handlung. Läuft parallel zu /login, bis der neue
// Bereich fertig ist (Justin: „komplett neues Login, damit das aktuelle nicht
// ersetzt wird"). Server bleibt derselbe: POST /api/fiaon/login mit den
// Gründen AUTH-01…05, Hinweis und Aktion. Nach Erfolg geht es nach /app.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { EmailVorschlaege } from "@/components/EmailVorschlaege";
import "@/styles/app.css";

type Problem = { code?: string; error: string; hint?: string; action?: string; actionHref?: string; retryable?: boolean };

export default function AppLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [bleiben, setBleiben] = useState(true);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [schonDrin, setSchonDrin] = useState<{ ref: string; vorname: string | null } | null>(null);

  useEffect(() => {
    document.title = "Anmelden · FIAON";
    fetch("/api/fiaon/kunde/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.eingeloggt && j.ref) setSchonDrin({ ref: j.ref, vorname: j.vorname || null }); })
      .catch(() => {});
  }, []);

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setProblem(null);
    try {
      const r = await fetch("/api/fiaon/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ email: email.trim(), password, bleiben }) });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setProblem({ code: data?.code, error: data?.error || "Anmeldung derzeit nicht möglich.", hint: data?.hint, action: data?.action, actionHref: data?.actionHref, retryable: data?.retryable });
        setLaeuft(false); return;
      }
      window.location.href = "/app";
    } catch {
      setProblem({ error: "Wir konnten den Server gerade nicht erreichen.", hint: "Ihre Anmeldedaten sind in Ordnung. Bitte versuchen Sie es in einem Moment noch einmal.", retryable: true });
      setLaeuft(false);
    }
  };

  return (
    <div className="ap-root ap-login">
      <header className="ap-login-kopf">
        <a className="ap-marke" href="/" aria-label="FIAON Startseite">
          <span className="ap-marke-zeichen">F</span>
          <span className="ap-marke-wort">FIAON</span>
        </a>
        <a className="ap-link" href="/antrag" style={{ fontSize: 14 }}>Noch kein Zugang?</a>
      </header>

      <main className="ap-login-mitte">
        <div className="ap-auf">
          <h1>Ihr Weg zur Karte<br /><span>beginnt hier.</span></h1>
          <p className="ap-login-lead">Ihr Ziel, Ihr Stand, Ihr nächster Schritt – auf einen Blick.</p>
        </div>

        {schonDrin && (
          <a href="/app" className="ap-karte ap-drin ap-auf v1">
            <span>Sie sind noch angemeldet{schonDrin.vorname ? `, ${schonDrin.vorname}` : ""}.</span>
            <b>Weiter →</b>
          </a>
        )}

        <form className="ap-karte ap-auf v2" onSubmit={absenden} noValidate>
          <label className="ap-feld">
            <span>E-Mail-Adresse</span>
            <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@beispiel.de" required />
          </label>
          <EmailVorschlaege wert={email} land={null} onWahl={(v) => setEmail(v)} />
          <label className="ap-feld">
            <span>Passwort <a href="/passwort-vergessen" className="ap-link">Vergessen?</a></span>
            <div className="ap-pw">
              <input type={zeigen ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ihr Passwort" required />
              <button type="button" onClick={() => setZeigen(!zeigen)} aria-label={zeigen ? "Passwort verbergen" : "Passwort anzeigen"}>{zeigen ? "Verbergen" : "Anzeigen"}</button>
            </div>
          </label>
          <label className="ap-bleiben">
            <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
            <span><b>Angemeldet bleiben</b>30 Tage auf diesem Gerät. Auf fremden Geräten bitte abwählen.</span>
          </label>

          {problem && (
            <div className="ap-problem" role="alert">
              <b>{problem.error}</b>
              {problem.hint && <p>{problem.hint}</p>}
              {problem.action && problem.actionHref && <a className="ap-link" href={problem.actionHref}>{problem.action} →</a>}
            </div>
          )}

          <button type="submit" className="ap-knopf" disabled={laeuft}>{laeuft ? "Wird geprüft …" : "Anmelden"}</button>
        </form>
      </main>

      <footer className="ap-login-fuss">
        Verschlüsselt · Server in der EU · <a href="/datenschutz">Datenschutz</a>
      </footer>
    </div>
  );
}
