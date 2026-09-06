import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { KeyRound, Check } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// PASSWORT FESTLEGEN ÜBER DEN SETZ-LINK (06.09.2026)
//
// Ein Mitarbeiter kann einem Kunden den Zugang „retten": Der Server baut einen
// signierten, zeitlich begrenzten Link /zugang/<ref>?exp=…&e=…&sig=… und
// verschickt ihn. Bis heute gab es dazu keine Seite — der Kunde landete auf
// „Diese Seite existiert nicht". Hier prüft die Seite den Link
// (GET /zugang/:ref/pruefen), nimmt ein neues Passwort entgegen
// (POST /zugang/:ref/setzen) und schickt zur Anmeldung. Kunden werden gesiezt.
// ═══════════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

type Lage = "pruefe" | "gueltig" | "ungueltig" | "fertig";

export default function ZugangSetzenPage() {
  const [, params] = useRoute("/zugang/:ref");
  const ref = decodeURIComponent(params?.ref || "");
  const q = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const exp = q.get("exp") || "";
  const e = q.get("e") || "";
  const sig = q.get("sig") || "";

  const [lage, setLage] = useState<Lage>("pruefe");
  const [grund, setGrund] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (!ref) { setGrund("Dieser Link ist unvollständig."); setLage("ungueltig"); return; }
    const url = `/api/fiaon/zugang/${encodeURIComponent(ref)}/pruefen?exp=${encodeURIComponent(exp)}&e=${encodeURIComponent(e)}&sig=${encodeURIComponent(sig)}`;
    fetch(url, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (r.ok && j?.ok) setLage("gueltig");
        else { setGrund(j?.error || "Dieser Link ist nicht mehr gültig."); setLage("ungueltig"); }
      })
      .catch(() => { setGrund("Keine Verbindung. Bitte versuchen Sie es gleich noch einmal."); setLage("ungueltig"); });
  }, [ref, exp, e, sig]);

  const speichern = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setFehler(null);
    if (pw.length < 8) { setFehler("Das Passwort braucht mindestens 8 Zeichen."); return; }
    if (pw !== pw2) { setFehler("Die beiden Eingaben stimmen nicht überein."); return; }
    setLaeuft(true);
    try {
      const r = await fetch(`/api/fiaon/zugang/${encodeURIComponent(ref)}/setzen`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exp, e, sig, passwort: pw }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setFehler(j?.error || "Das Passwort konnte nicht gespeichert werden."); setLaeuft(false); return; }
      setLage("fertig");
    } catch {
      setFehler("Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.");
      setLaeuft(false);
    }
  };

  const feld = "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8">
        <p className="text-lg font-bold tracking-tight mb-5 text-center" style={{ color: ACCENT }}>FIAON</p>
        <span className="mx-auto flex w-12 h-12 rounded-full border border-slate-200 items-center justify-center text-slate-400 mb-4">
          {lage === "fertig" ? <Check size={20} strokeWidth={1.7} /> : <KeyRound size={20} strokeWidth={1.7} />}
        </span>

        {lage === "pruefe" && (
          <p className="text-[13px] text-slate-500 text-center">Einen Moment – wir prüfen Ihren Link.</p>
        )}

        {lage === "ungueltig" && (
          <>
            <h1 className="text-[16px] font-bold text-slate-900 mb-1.5 text-center">Dieser Link funktioniert nicht mehr</h1>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-6 text-center">{grund}</p>
            <a href="/passwort-vergessen" className="block w-full text-center rounded-xl py-2.5 text-[14px] font-semibold text-white" style={{ background: ACCENT }}>Passwort neu setzen</a>
            <a href="/login" className="block w-full text-center mt-3 text-[13px] text-slate-500 underline underline-offset-4">Zur Anmeldung</a>
          </>
        )}

        {lage === "gueltig" && (
          <form onSubmit={speichern} noValidate>
            <h1 className="text-[16px] font-bold text-slate-900 mb-1.5 text-center">Legen Sie Ihr Passwort fest</h1>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-5 text-center">
              Für Ihr Konto <span className="font-mono text-slate-600">{ref}</span>. Mindestens 8 Zeichen.
            </p>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1">Neues Passwort</label>
            <input type="password" autoComplete="new-password" className={feld} value={pw} onChange={(ev) => setPw(ev.target.value)} />
            <label className="block text-[12px] font-semibold text-slate-600 mb-1 mt-3">Noch einmal</label>
            <input type="password" autoComplete="new-password" className={feld} value={pw2} onChange={(ev) => setPw2(ev.target.value)} />
            {fehler && <p className="mt-3 text-[13px] text-red-500">{fehler}</p>}
            <button type="submit" disabled={laeuft} className="mt-5 w-full rounded-xl py-2.5 text-[14px] font-semibold text-white disabled:opacity-60" style={{ background: ACCENT }}>
              {laeuft ? "Wird gespeichert …" : "Passwort speichern"}
            </button>
          </form>
        )}

        {lage === "fertig" && (
          <>
            <h1 className="text-[16px] font-bold text-slate-900 mb-1.5 text-center">Ihr Passwort ist gespeichert</h1>
            <p className="text-[13px] text-slate-500 leading-relaxed mb-6 text-center">
              Melden Sie sich jetzt mit Ihrer E-Mail-Adresse und dem neuen Passwort an.
            </p>
            <a href="/login" className="block w-full text-center rounded-xl py-2.5 text-[14px] font-semibold text-white" style={{ background: ACCENT }}>Zur Anmeldung</a>
          </>
        )}
      </div>
    </div>
  );
}
