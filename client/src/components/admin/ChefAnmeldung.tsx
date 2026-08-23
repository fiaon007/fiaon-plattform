// ═══════════════════════════════════════════════════════════════════════════
// ChefAnmeldung — die Tür zum Chefbüro (24.08.2026)
// Bezug: CHEFBUERO_PLAN_2026-08-24.md §2.2 (E-053), Scheibe 1.
//
// Persönliche Anmeldung statt Sammel-Code: E-Mail + Passwort des eigenen
// Mitarbeiter-Kontos. Das Code-Feld erscheint ERST, wenn der Server es
// verlangt (Antwort CODE_NOETIG — nur die Stufe 'inhaber' braucht den
// Chef-Code als zweiten Faktor). Wer schon angemeldet ist (neues fiaon_chef-
// Cookie oder — Übergang — das alte fiaon_admin-Cookie), rutscht ohne Frage
// durch: /chef/status entscheidet.
//
// Die Sperre hier ist nur Anzeige — die Wahrheit liegt im Server
// (server/routes/fiaon-chef-zugang.ts). Stile: chefbuero.css (.cb-anmeldung).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import "@/styles/chefbuero.css";

export interface ChefStatus { stufe: string; name: string | null; quelle: "chef" | "alt" }

export default function ChefAnmeldung({ onAngemeldet }: { onAngemeldet: (status: ChefStatus) => void }) {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [code, setCode] = useState("");
  const [codeNoetig, setCodeNoetig] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pruefeStatus, setPruefeStatus] = useState(true);
  const codeFeld = useRef<HTMLInputElement>(null);

  // Schon drin? Dann keine Maske — /chef/status kennt beide Cookies.
  useEffect(() => {
    let weg = false;
    fetch("/api/fiaon/chef/status", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (weg) return;
        if (j?.ok && j.angemeldet) onAngemeldet({ stufe: String(j.stufe), name: j.name ?? null, quelle: j.quelle === "alt" ? "alt" : "chef" });
        else setPruefeStatus(false);
      })
      .catch(() => { if (!weg) setPruefeStatus(false); });
    return () => { weg = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sobald der Server den Code verlangt, gehört der Fokus dorthin.
  useEffect(() => { if (codeNoetig) codeFeld.current?.focus(); }, [codeNoetig]);

  const anmelden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const res = await fetch("/api/fiaon/chef/anmelden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim(), passwort, ...(codeNoetig && code ? { code } : {}) }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        onAngemeldet({ stufe: String(json.stufe), name: json.name ?? null, quelle: "chef" });
        return;
      }
      if (json?.code === "CODE_NOETIG") {
        // Kein Fehler: E-Mail und Passwort stimmen — jetzt fehlt nur der Code.
        setCodeNoetig(true);
        setFehler(null);
        return;
      }
      setFehler(json?.error || "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      if (json?.code === "CODE_FALSCH") setCode("");
    } catch {
      setFehler("Keine Verbindung. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cb-anmeldung">
      <div className="cb-anmeldung-karte" role="dialog" aria-label="Anmeldung Chefbüro">
        <p className="cb-anmeldung-marke">FIAON</p>
        <p className="cb-anmeldung-unter">Chefbüro</p>
        <p className="cb-anmeldung-satz">
          {pruefeStatus
            ? "Einen Moment …"
            : codeNoetig
              ? "Fast geschafft — für den Inhaber-Zugang fehlt noch dein Chef-Code."
              : "Melde dich mit deinem Mitarbeiter-Konto an."}
        </p>
        {!pruefeStatus && (
          <form onSubmit={anmelden}>
            <div className="cb-feld">
              <label htmlFor="cb-email">E-Mail</label>
              <input
                id="cb-email" type="email" autoComplete="email" required
                value={email} onChange={(e) => { setEmail(e.target.value); setFehler(null); }}
                placeholder="dein.name@fiaon.de" disabled={busy}
              />
            </div>
            <div className="cb-feld">
              <label htmlFor="cb-passwort">Passwort</label>
              <input
                id="cb-passwort" type="password" autoComplete="current-password" required
                value={passwort} onChange={(e) => { setPasswort(e.target.value); setFehler(null); }}
                placeholder="••••••••" disabled={busy}
              />
            </div>
            {codeNoetig && (
              <div className="cb-feld">
                <label htmlFor="cb-code">Chef-Code</label>
                <input
                  id="cb-code" ref={codeFeld} type="password" inputMode="numeric" autoComplete="one-time-code" required
                  value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setFehler(null); }}
                  placeholder="8-stelliger Code" maxLength={8} disabled={busy}
                />
              </div>
            )}
            <p className="cb-anmeldung-fehler" role="alert">{fehler}</p>
            <button type="submit" className="cb-anmeldung-knopf" disabled={busy}>
              {busy ? "Prüfe …" : codeNoetig ? "Mit Code anmelden" : "Anmelden"}
            </button>
          </form>
        )}
        <p className="cb-anmeldung-fuss">
          Kein Zugang? <a href="/">Zur Website</a> · <a href="/agent">Office</a>
        </p>
      </div>
    </div>
  );
}
