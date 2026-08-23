// ═══════════════════════════════════════════════════════════════════════════
// /login — neu gebaut auf der dunklen Bühne (23.08.2026, Justin: „muss so
// high end sein wie der Rest — denk mit, neue Sektionen, mach es perfekt").
//
// Links das Glas mit dem Formular (E-Mail, Passwort, angemeldet bleiben), rechts
// die 3D-Karte und das, was im Bereich wartet. Darunter im Licht: drei Wege,
// wenn jemand nicht hineinkommt (Passwort vergessen, Antrag unterbrochen, noch
// kein Konto), und die Sicherheitszeile. Die Server-Antwort bleibt dieselbe:
// /api/fiaon/login mit Gründen AUTH-01…05, Hinweis und Aktion.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { EmailVorschlaege } from "@/components/EmailVorschlaege";
import { Dunkel, Licht, Block, Knopf, Auf, Glas } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import "@/styles/login.css";

type LoginProblem = { code?: string; error: string; hint?: string; action?: string; actionHref?: string; retryable?: boolean };

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zeigen, setZeigen] = useState(false);
  const [bleiben, setBleiben] = useState(true);
  const [problem, setProblem] = useState<LoginProblem | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [schonDrin, setSchonDrin] = useState<{ ref: string; vorname: string | null } | null>(null);

  // Wer ein gültiges Cookie hat, muss nichts tippen.
  useEffect(() => {
    fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => r.json()).then((j) => { if (j?.eingeloggt && j.ref) setSchonDrin({ ref: j.ref, vorname: j.vorname || null }); }).catch(() => {});
    document.title = "Anmelden · FIAON";
  }, []);

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault(); setLaeuft(true); setProblem(null);
    try {
      const r = await fetch("/api/fiaon/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, bleiben }) });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.ok) {
        setProblem({ code: data?.code, error: data?.error || "Anmeldung derzeit nicht möglich.", hint: data?.hint, action: data?.action, actionHref: data?.actionHref, retryable: data?.retryable });
        setLaeuft(false); return;
      }
      sessionStorage.setItem("fiaon_user", JSON.stringify(data));
      try { if (bleiben) localStorage.setItem("fiaon_user", JSON.stringify(data)); else localStorage.removeItem("fiaon_user"); } catch { /* privater Modus */ }
      window.location.href = "/dashboard";
    } catch {
      setProblem({ error: "Technisches Problem – bitte in einem Moment erneut versuchen.", hint: "Ihre Anmeldedaten sind in Ordnung. Wir konnten den Server gerade nicht erreichen.", retryable: true });
      setLaeuft(false);
    }
  };

  return (
    <Dunkel seite="login" titel="Anmelden" beschreibung="Melden Sie sich in Ihrem FIAON-Bereich an: Fahrplan, Auskunft, Schreiben und Fristen, Abo – alles an einem Ort.">
      <section className="dk-hero lg-hero">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" fetchPriority="high" /><div className="schleier" /></div>
        <div className="dk-rahmen lg-raster">
          <Auf>
            <form className="lg-karte" onSubmit={absenden} noValidate>
              <span className="dk-pille">Mein Bereich</span>
              <h1 className="lg-titel">Willkommen <span className="dk-verlauf">zurück.</span></h1>
              <p className="lg-lead">Ihre Akte, Ihre Fristen, Ihr nächster Schritt – alles an einem Ort.</p>

              {schonDrin && (
                <a href="/dashboard" className="lg-drin">
                  <span>Sie sind noch angemeldet{schonDrin.vorname ? `, ${schonDrin.vorname}` : ""}.</span><b>Direkt in den Bereich →</b>
                </a>
              )}

              <label className="lg-feld">
                <span>E-Mail-Adresse</span>
                <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@beispiel.de" required />
              </label>
              <div className="lg-vorschlaege"><EmailVorschlaege wert={email} land={null} onWahl={(v) => setEmail(v)} /></div>
              <label className="lg-feld">
                <span>Passwort <a href="/passwort-vergessen" className="lg-klein">Vergessen?</a></span>
                <div className="lg-pw">
                  <input type={zeigen ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Ihr Passwort" required />
                  <button type="button" onClick={() => setZeigen(!zeigen)} aria-label={zeigen ? "Passwort verbergen" : "Passwort anzeigen"}>{zeigen ? "Verbergen" : "Anzeigen"}</button>
                </div>
              </label>
              <label className="lg-bleiben">
                <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} />
                <span><b>Angemeldet bleiben</b><small>30 Tage auf diesem Gerät – nicht auf fremden Rechnern.</small></span>
              </label>

              {problem && (
                <div className="lg-problem" role="alert">
                  <b>{problem.error}</b>
                  {problem.hint && <p>{problem.hint}</p>}
                  {problem.action && problem.actionHref && <a href={problem.actionHref}>{problem.action} →</a>}
                </div>
              )}

              <button type="submit" className="dk-knopf lg-knopf" disabled={laeuft}>{laeuft ? "Wird geprüft …" : "Anmelden"}</button>
              <p className="lg-unten">Noch kein Konto? <a href="/antrag">In zwei Minuten eröffnen</a></p>
            </form>
          </Auf>
          <Auf verzoegerung={150}>
            <div className="lg-rechts">
              <div className="dk-szene gross lg-szene"><KartenSzene anzahl={1} className="absolute inset-0" /></div>
              <ul className="lg-punkte">
                <li><b>Ihr Fahrplan</b><span>Welche Etappe jetzt dran ist – und was FIAON gerade für Sie tut.</span></li>
                <li><b>Ihre Auskunft</b><span>Jeder Eintrag erklärt, mit Einschätzung und nächstem Schritt.</span></li>
                <li><b>Schreiben &amp; Fristen</b><span>Was versendet wurde, was läuft, was Sie freigeben können.</span></li>
                <li><b>Ihre Ansprechpartnerin</b><span>Mit Namen. Nachrichten und Termine an einem Ort.</span></li>
              </ul>
            </div>
          </Auf>
        </div>
      </section>

      <Licht>
        <Block pille="Wenn es hakt" titel={<>Drei Wege <span className="dk-verlauf">hinein.</span></>} mitte
               lead="Die meisten Anmeldeprobleme haben einen von drei Gründen. Für jeden gibt es einen kurzen Weg.">
          <div className="dk-raster" style={{ textAlign: "left", marginTop: 36 }}>
            <Auf><Glas tag="Passwort vergessen" titel="Neu setzen in einer Minute">Sie bekommen einen Link an Ihre E-Mail-Adresse. Der Link ist 60 Minuten gültig; danach fordern Sie einfach einen neuen an.<div className="dk-knoepfe" style={{ marginTop: 16 }}><Knopf href="/passwort-vergessen" still>Passwort zurücksetzen</Knopf></div></Glas></Auf>
            <Auf verzoegerung={80}><Glas tag="Antrag unterbrochen" titel="Genau dort weitermachen">Ihre Angaben sind gespeichert. Mit dem Link aus unserer E-Mail landen Sie im Antrag an der Stelle, an der Sie aufgehört haben – ohne neu zu beginnen.<div className="dk-knoepfe" style={{ marginTop: 16 }}><Knopf href="/antrag" still>Zum Antrag</Knopf></div></Glas></Auf>
            <Auf verzoegerung={160}><Glas tag="Noch kein Konto" titel="In zwei Minuten eröffnen">Paket wählen, wenige Angaben, Vertrag annehmen – und Sie sind in Ihrem Bereich. Die Zahlung und das erste Gespräch wählen Sie dort.<div className="dk-knoepfe" style={{ marginTop: 16 }}><Knopf href="/antrag">Konto eröffnen</Knopf></div></Glas></Auf>
          </div>
        </Block>
        <Block pille="Sicherheit" mitte>
          <div className="lg-sicher">
            {[["Verschlüsselt", "Jede Verbindung per TLS, jedes Passwort als Hash – niemand bei FIAON kann es lesen."], ["Server in der EU", "Ihre Akte liegt auf europäischen Servern, DSGVO-konform, täglich gesichert."], ["Sie bestimmen", "Abmelden jederzeit, Passwort ändern im Bereich, Daten löschen auf Anfrage."]].map(([t, s]) => (
              <div key={t} className="lg-sicher-karte"><b>{t}</b><span>{s}</span></div>
            ))}
          </div>
        </Block>
      </Licht>

      <section className="dk-block" style={{ paddingTop: 40 }}>
        <div className="dk-rahmen mitte">
          <p className="dk-leise">Sie wollen sehen, wie der Bereich aussieht, bevor Sie ein Konto haben? <a href="/demo/kundenbereich" className="lg-link">Zur Präsentation</a></p>
        </div>
      </section>
    </Dunkel>
  );
}
