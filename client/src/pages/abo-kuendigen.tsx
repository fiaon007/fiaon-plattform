import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* === ANIMATIONS === */
if (typeof document !== "undefined" && !document.head.querySelector('style[data-ak-anim]')) {
  const s = document.createElement("style");
  s.setAttribute("data-ak-anim", "true");
  s.textContent = `
    @keyframes akFadeUp { from { opacity: 0; transform: translateY(24px) scale(.97); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
    @keyframes akShimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
    @keyframes akOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-20px) scale(1.08); } }
    @keyframes akOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-20px,25px) scale(1.06); } }
    @keyframes akSuccessPop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
    @keyframes akRingRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes akGlowPulse { 0%,100% { opacity: .25; } 50% { opacity: .6; } }
    @keyframes akCheckDraw { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes akLimitGlow { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
    .ak-card-enter { animation: akFadeUp .55s cubic-bezier(.22,1,.36,1) both; }
  `;
  document.head.appendChild(s);
}

/* === HELPERS === */
function Field({
  label,
  req,
  error,
  children,
}: {
  label: string;
  req?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
        {label}
        {req && <span className="text-[#2563eb]">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50/80 px-2.5 py-1 rounded-lg">
          {error}
        </p>
      )}
    </div>
  );
}

function PremiumBtn({
  children,
  onClick,
  disabled,
  type = "button",
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  variant?: "primary" | "danger";
}) {
  const base =
    "relative w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 rounded-full text-[15px] font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.01] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100";
  const gradient =
    variant === "danger"
      ? "bg-gradient-to-r from-rose-600 to-red-500 hover:shadow-[0_8px_24px_rgba(220,38,38,0.35)]"
      : "fiaon-btn-gradient hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)]";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${gradient}`}
      style={{ minHeight: 48 }}
    >
      <span className="relative z-10 flex items-center gap-2">{children}</span>
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,.22), transparent)",
          animation: "akShimmer 3.2s ease-in-out infinite",
        }}
      />
    </button>
  );
}

type Phase = "verify" | "form" | "done";

const REASONS = [
  "Ich nutze den Service nicht mehr",
  "Die Kosten sind zu hoch",
  "Ich habe eine bessere Alternative gefunden",
  "Ich bin mit dem Service unzufrieden",
  "Persönliche oder finanzielle Gründe",
  "Sonstiger Grund",
];

export default function AboKuendigenPage() {
  const [phase, setPhase] = useState<Phase>("verify");
  const topRef = useRef<HTMLDivElement>(null);

  /* Verify fields */
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  /* Cancellation form fields */
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [cancellationDate, setCancellationDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  /* Confirmed cancellation id */
  const [requestId, setRequestId] = useState<number | null>(null);

  /* Confirmation checkbox */
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [phase]);

  /* === STEP 1: Verify identity via existing application === */
  async function handleVerify() {
    setVerifyError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !birthdate) {
      setVerifyError("Bitte alle Pflichtfelder ausfüllen");
      return;
    }
    if (!email.includes("@")) {
      setVerifyError("Bitte eine gültige E-Mail eingeben");
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await fetch("/api/fiaon/abo-kuendigen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          birthdate,
          reason: "__verify_only__",
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setVerifyError(data.error || "Bereits ein offener Antrag vorhanden.");
      } else if (res.status === 404) {
        setVerifyError(
          "Keine Übereinstimmung gefunden. Bitte prüfe Vor- und Nachname, E-Mail sowie Geburtsdatum."
        );
      } else if (!data.ok) {
        setVerifyError(data.error || "Verifizierung fehlgeschlagen");
      } else {
        setPhase("form");
      }
    } catch {
      setVerifyError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setVerifyLoading(false);
    }
  }

  /* === STEP 2: Submit cancellation === */
  async function handleSubmit() {
    setFormError(null);
    const finalReason = reason === "Sonstiger Grund" ? customReason.trim() : reason;
    if (!finalReason) {
      setFormError("Bitte einen Kündigungsgrund auswählen");
      return;
    }
    if (!confirmed) {
      setFormError("Bitte bestätige, dass du kündigen möchtest");
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch("/api/fiaon/abo-kuendigen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          birthdate,
          reason: finalReason,
          cancellationDate: cancellationDate || null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFormError(data.error || "Fehler beim Absenden");
      } else {
        setRequestId(data.id ?? null);
        setPhase("done");
      }
    } catch {
      setFormError("Verbindungsfehler. Bitte erneut versuchen.");
    } finally {
      setFormLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute top-[-100px] left-1/3 w-[700px] h-[700px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, #ef4444, transparent 70%)",
            animation: "akOrb1 18s ease-in-out infinite",
          }}
        />
        <div
          className="absolute bottom-[-80px] right-1/4 w-[500px] h-[500px] rounded-full opacity-[0.025]"
          style={{
            background: "radial-gradient(circle, #2563eb, transparent 70%)",
            animation: "akOrb2 14s ease-in-out infinite",
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full opacity-[0.012]"
          style={{
            background: "radial-gradient(circle, #2563eb, transparent 60%)",
            animation: "akGlowPulse 8s ease-in-out infinite",
          }}
        />
      </div>

      <GlassNav />

      <div
        ref={topRef}
        className="relative z-10 max-w-[500px] mx-auto px-4 pt-28 sm:pt-32 pb-20"
      >
        {/* ══════════ PHASE: VERIFY ══════════ */}
        {phase === "verify" && (
          <div className="ak-card-enter">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full relative flex items-center justify-center">
                <div
                  className="absolute inset-[-2px] rounded-full"
                  style={{
                    background: "conic-gradient(#ef4444,#fca5a5,#ef4444)",
                    animation: "akRingRotate 4s linear infinite",
                  }}
                />
                <div className="w-[56px] h-[56px] rounded-full bg-white flex items-center justify-center relative z-10 shadow-sm">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-[.2em] mb-2">
                Konto-Verwaltung
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3">
                Abo kündigen
              </h1>
              <p className="text-[14px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                Bestätige deine Identität. Wir prüfen deinen Antrag und
                kontaktieren dich innerhalb von 1–2 Werktagen.
              </p>
            </div>

            {/* Card */}
            <div className="fiaon-glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 opacity-[.06]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(239,68,68,0.1), rgba(147,197,253,0.15), rgba(37,99,235,0.08))",
                    backgroundSize: "200% 200%",
                    animation: "akLimitGlow 8s ease-in-out infinite",
                  }}
                />
              </div>

              <div className="relative z-10">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vorname" req>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => {
                        setFirstName(e.target.value);
                        setVerifyError(null);
                      }}
                      placeholder="Max"
                      className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Nachname" req>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => {
                        setLastName(e.target.value);
                        setVerifyError(null);
                      }}
                      placeholder="Mustermann"
                      className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      autoComplete="family-name"
                    />
                  </Field>
                </div>

                {/* Email */}
                <Field label="E-Mail-Adresse" req>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setVerifyError(null);
                    }}
                    placeholder="max@beispiel.de"
                    className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                    autoComplete="email"
                    inputMode="email"
                  />
                </Field>

                {/* Birthdate */}
                <Field label="Geburtsdatum" req>
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => {
                      setBirthdate(e.target.value);
                      setVerifyError(null);
                    }}
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none"
                    autoComplete="bday"
                  />
                </Field>

                {/* Error */}
                {verifyError && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-[13px] font-medium text-red-600">
                      {verifyError}
                    </p>
                  </div>
                )}

                {/* Info note */}
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 mb-5">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="shrink-0 mt-0.5"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <p className="text-[12px] text-blue-700 leading-relaxed">
                    Deine Kündigung wird von unserem Team geprüft und innerhalb
                    von 1–2 Werktagen bearbeitet. Wir gleichen deine Angaben
                    sicher gegen unsere Daten ab.
                  </p>
                </div>

                <PremiumBtn
                  onClick={handleVerify}
                  disabled={verifyLoading}
                  variant="primary"
                >
                  {verifyLoading ? (
                    <>
                      <svg
                        className="animate-spin"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Wird geprüft…
                    </>
                  ) : (
                    <>
                      Weiter zur Kündigung
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </PremiumBtn>

                <div className="pt-5 text-center">
                  <a
                    href="/dashboard"
                    className="text-[13px] text-gray-400 hover:text-[#2563eb] transition-colors"
                  >
                    Zurück zum Dashboard
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ PHASE: FORM ══════════ */}
        {phase === "form" && (
          <div className="ak-card-enter">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-5 rounded-full relative flex items-center justify-center">
                <div
                  className="absolute inset-[-2px] rounded-full"
                  style={{
                    background: "conic-gradient(#f97316,#fdba74,#f97316)",
                    animation: "akRingRotate 4s linear infinite",
                  }}
                />
                <div className="w-[56px] h-[56px] rounded-full bg-white flex items-center justify-center relative z-10 shadow-sm">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                    <line x1="9" y1="11" x2="15" y2="11" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-[.2em] mb-2">
                Identität bestätigt
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-3">
                Kündigungsantrag
              </h1>
              <p className="text-[14px] text-gray-500 max-w-sm mx-auto">
                Teile uns den Grund mit. Unser Team prüft deinen Antrag und
                meldet sich bei dir.
              </p>
            </div>

            {/* Identity summary */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 mb-6">
              <div className="w-9 h-9 rounded-full bg-[#2563eb]/10 flex items-center justify-center shrink-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-800 truncate">
                  {firstName} {lastName}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{email} · geb. {birthdate}</p>
              </div>
              <button
                onClick={() => setPhase("verify")}
                className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              >
                Ändern
              </button>
            </div>

            <div className="fiaon-glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 opacity-[.05]"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(147,197,253,0.1), rgba(37,99,235,0.08))",
                    backgroundSize: "200% 200%",
                    animation: "akLimitGlow 6s ease-in-out infinite",
                  }}
                />
              </div>

              <div className="relative z-10">
                {/* Reason */}
                <Field label="Kündigungsgrund" req>
                  <div className="space-y-2">
                    {REASONS.map((r) => (
                      <label
                        key={r}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${
                          reason === r
                            ? "bg-[#2563eb]/5 border-[#2563eb]/25"
                            : "bg-white/60 border-slate-100 hover:border-slate-200"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                            reason === r
                              ? "border-[#2563eb] bg-[#2563eb]"
                              : "border-slate-300"
                          }`}
                        >
                          {reason === r && (
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                          )}
                        </span>
                        <span
                          className={`text-[13px] font-medium ${
                            reason === r ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {r}
                        </span>
                        <input
                          type="radio"
                          className="sr-only"
                          value={r}
                          checked={reason === r}
                          onChange={() => {
                            setReason(r);
                            setFormError(null);
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  {reason === "Sonstiger Grund" && (
                    <textarea
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Bitte beschreibe deinen Grund…"
                      rows={3}
                      className="mt-3 w-full px-4 py-3 rounded-xl fiaon-input-glass text-[14px] text-gray-900 outline-none placeholder:text-gray-300 resize-none"
                    />
                  )}
                </Field>

                {/* Desired cancellation date (optional) */}
                <Field label="Gewünschtes Kündigungsdatum (optional)">
                  <input
                    type="date"
                    value={cancellationDate}
                    onChange={(e) => setCancellationDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none"
                  />
                </Field>

                {/* Confirmation checkbox */}
                <label className="flex items-start gap-3 cursor-pointer mb-5 p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
                  <span
                    className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      confirmed
                        ? "bg-rose-500 border-rose-500"
                        : "border-slate-300 bg-white"
                    }`}
                    onClick={() => setConfirmed(!confirmed)}
                  >
                    {confirmed && (
                      <svg
                        width="11"
                        height="11"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span
                    className="text-[13px] text-slate-700 leading-relaxed"
                    onClick={() => setConfirmed(!confirmed)}
                  >
                    Ich bestätige, dass ich mein FIAON-Abo kündigen möchte und
                    verstehe, dass mein Antrag vom Team geprüft werden muss,
                    bevor die Kündigung wirksam wird.
                  </span>
                </label>

                {/* Error */}
                {formError && (
                  <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-100 mb-4">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="shrink-0"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p className="text-[13px] font-medium text-red-600">
                      {formError}
                    </p>
                  </div>
                )}

                <PremiumBtn
                  onClick={handleSubmit}
                  disabled={formLoading || !confirmed}
                  variant="danger"
                >
                  {formLoading ? (
                    <>
                      <svg
                        className="animate-spin"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Wird gesendet…
                    </>
                  ) : (
                    <>
                      Kündigungsantrag absenden
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </PremiumBtn>

                <div className="pt-4 text-center">
                  <button
                    onClick={() => setPhase("verify")}
                    className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    ← Zurück
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ PHASE: DONE ══════════ */}
        {phase === "done" && (
          <div className="ak-card-enter text-center py-8">
            <div
              className="relative w-28 h-28 mx-auto mb-8"
              style={{ animation: "akSuccessPop .6s cubic-bezier(.22,1,.36,1) both" }}
            >
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-green-500"
                style={{
                  boxShadow:
                    "0 0 60px rgba(34,197,94,.3), 0 0 120px rgba(34,197,94,.1)",
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 35% 25%, rgba(255,255,255,.35), transparent 60%)",
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline
                    points="20 6 9 17 4 12"
                    strokeDasharray="40"
                    strokeDashoffset="0"
                    style={{ animation: "akCheckDraw .5s .3s ease both" }}
                  />
                </svg>
              </div>
            </div>

            <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-[.2em] mb-2">
              Antrag eingegangen
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight fiaon-gradient-text-animated mb-4">
              Kündigung beantragt!
            </h2>
            <p className="text-[15px] text-gray-500 mb-2 max-w-sm mx-auto leading-relaxed">
              Dein Kündigungsantrag wurde erfolgreich übermittelt und wird von
              unserem Team geprüft.
            </p>
            {requestId && (
              <p className="text-[13px] text-gray-400 mb-2">
                Antragsnummer: <span className="font-bold text-slate-600">#{requestId}</span>
              </p>
            )}
            <p className="text-[13px] text-gray-400 mb-10">
              Wir melden uns innerhalb von 1–2 Werktagen bei dir per E-Mail.
            </p>

            <div className="max-w-xs mx-auto space-y-3">
              <a
                href="/dashboard"
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-6 fiaon-btn-gradient rounded-full text-[15px] font-semibold text-white transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)]"
                style={{ minHeight: 48 }}
              >
                Zum Dashboard
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-full text-[14px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Zurück zur Startseite
              </a>
            </div>
          </div>
        )}
      </div>

      <PremiumFooter />
    </div>
  );
}
