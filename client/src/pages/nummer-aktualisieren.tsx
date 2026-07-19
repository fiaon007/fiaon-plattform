import { useEffect, useMemo, useState } from "react";
import { checkPhone } from "@/lib/phone";

// ════════════════════════════════════════════════════════════════════
// #23 — Öffentliche Kundenseite „Telefonnummer aktualisieren" (Premium-CI).
// Der Kunde öffnet den signierten Link aus der „Falsche Nummer"-Mail (meist am
// Handy) und trägt seine korrekte Nummer ein. Kein Login (der signierte Link ist
// die Authentifizierung) — NUR die Telefonnummer ist änderbar, keine weiteren
// Stammdaten. Sie-Form, mobil perfekt, Live-Validierung.
// ════════════════════════════════════════════════════════════════════

export default function NummerAktualisierenPage() {
  const token = (() => { try { return new URLSearchParams(window.location.search).get("token") || ""; } catch { return ""; } })();
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">("loading");
  const [firstName, setFirstName] = useState("");
  const [maskedPhone, setMaskedPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    fetch(`/api/fiaon/number-update/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) { setFirstName(j.firstName || ""); setMaskedPhone(j.maskedPhone || null); setState("ready"); }
        else { setError(j?.error || null); setState("invalid"); }
      })
      .catch(() => setState("invalid"));
  }, [token]);

  // Live-Validierung (identische Logik wie im Antrags-Funnel, @/lib/phone).
  const check = useMemo(() => checkPhone(phone), [phone]);
  const showError = touched && phone.length > 0 && !check.valid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!check.valid) { setError(check.reason); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/fiaon/number-update/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: check.e164 }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) setState("done");
      else setError(j?.error || "Konnte nicht gespeichert werden.");
    } catch { setError("Verbindungsfehler — bitte erneut versuchen."); }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Kopf-Wortmarke */}
        <div className="text-center mb-5">
          <span className="text-[22px] font-extrabold tracking-tight text-slate-900">FIAON</span>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] border border-white/70 p-6 sm:p-8">
          {state === "loading" && <p className="text-center text-[14px] text-slate-400 py-10">Einen Moment …</p>}

          {state === "invalid" && (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
              </div>
              <h1 className="text-[19px] font-bold text-slate-900 mb-2">Dieser Link ist nicht mehr gültig</h1>
              <p className="text-[13.5px] text-slate-500 leading-relaxed">
                {error || "Der Link ist abgelaufen oder wurde bereits verwendet."} Kein Problem — unser Team meldet sich erneut bei Ihnen.
              </p>
            </div>
          )}

          {state === "done" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h1 className="text-[20px] font-bold text-slate-900 mb-2">Vielen Dank{firstName ? `, ${firstName}` : ""}</h1>
              <p className="text-[14px] text-slate-500 leading-relaxed">Ihre Telefonnummer wurde gespeichert. Wir melden uns in Kürze persönlich bei Ihnen.</p>
            </div>
          )}

          {state === "ready" && (
            <form onSubmit={submit} noValidate>
              <h1 className="text-[21px] font-bold text-slate-900 mb-2 leading-snug">
                {firstName ? `Hallo ${firstName},` : "Hallo,"}
              </h1>
              <p className="text-[14px] text-slate-600 leading-relaxed mb-5">
                wir haben versucht, Sie telefonisch zu erreichen — leider scheint Ihre hinterlegte Nummer nicht zu stimmen.
                Bitte aktualisieren Sie sie, damit wir Sie persönlich beraten können. Dauert keine 30 Sekunden.
              </p>

              {maskedPhone && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[12px] text-slate-400">Aktuell hinterlegt</span>
                  <div className="text-[15px] font-semibold text-slate-700 tabular-nums tracking-wide">{maskedPhone}</div>
                </div>
              )}

              <label htmlFor="phone" className="block text-[13px] font-semibold text-slate-700 mb-1.5">Neue Telefonnummer</label>
              <div className="relative">
                <input
                  id="phone" type="tel" inputMode="tel" autoFocus autoComplete="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); if (error) setError(null); }}
                  onBlur={() => setTouched(true)}
                  placeholder="z. B. 0176 12345678"
                  aria-invalid={showError}
                  className={`w-full px-4 py-3.5 rounded-2xl border text-[16px] outline-none transition-colors ${
                    showError
                      ? "border-rose-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-100"
                      : check.valid
                        ? "border-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  }`}
                  style={{ minHeight: 54 }}
                />
                {check.valid && (
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" aria-hidden>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </span>
                )}
              </div>

              {(showError || error) && (
                <p className="text-[13px] text-rose-600 mt-2">{error || check.reason}</p>
              )}

              <button
                type="submit" disabled={saving || !check.valid}
                className="w-full mt-6 py-4 rounded-2xl bg-[#2563eb] text-white text-[16px] font-semibold shadow-[0_10px_30px_-8px_rgba(37,99,235,0.6)] hover:bg-[#1d4fd7] active:scale-[0.99] disabled:opacity-40 disabled:shadow-none transition-all"
                style={{ minHeight: 54 }}
              >
                {saving ? "Wird gespeichert …" : "Telefonnummer speichern"}
              </button>
              <p className="text-[11.5px] text-slate-400 mt-4 text-center leading-relaxed">
                Über diesen Link lässt sich ausschließlich Ihre Telefonnummer ändern.<br />Ihre Daten werden vertraulich behandelt (DSGVO).
              </p>
            </form>
          )}
        </div>

        {/* Impressum-Fußzeile (wie bestehende Seiten) */}
        <p className="text-center text-[11px] text-slate-400 mt-5 leading-relaxed">
          FIAON LTD · 128 City Road, London, EC1V 2NX, United Kingdom<br />
          Company No. 17318250 · Director: Justin Schwarzott
        </p>
      </div>
    </div>
  );
}
