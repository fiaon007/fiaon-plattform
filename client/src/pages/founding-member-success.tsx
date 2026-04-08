import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type FormState = "idle" | "submitting" | "success" | "error";

export default function FoundingMemberSuccess() {
  const [, setLocation] = useLocation();

  // Form fields
  const [arasLogin, setArasLogin] = useState("");
  const [stripeEmail, setStripeEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [alphaChecked, setAlphaChecked] = useState(false);
  const [hp, setHp] = useState(""); // honeypot

  // Submission state
  const [formState, setFormState] = useState<FormState>("idle");
  const [ref, setRef] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = alphaChecked && arasLogin.trim().length >= 3 && formState !== "submitting";

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setFormState("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/public/founding/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arasLogin: arasLogin.trim(),
          stripeEmail: stripeEmail.trim() || undefined,
          notes: notes.trim() || undefined,
          alphaConfirm: true,
          hp,
        }),
      });

      if (res.status === 429) {
        setErrorMsg("Zu viele Versuche — bitte in 60 Minuten erneut versuchen.");
        setFormState("error");
        return;
      }

      if (res.status === 204) {
        // honeypot triggered — pretend success
        setRef("FM-000000");
        setFormState("success");
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Ein Fehler ist aufgetreten.");
        setFormState("error");
        return;
      }

      setRef(data.ref);
      setAlreadySubmitted(!!data.alreadySubmitted);
      setFormState("success");
    } catch {
      setErrorMsg("Verbindungsfehler — bitte erneut versuchen.");
      setFormState("error");
    }
  }, [canSubmit, arasLogin, stripeEmail, notes, hp]);

  /* ─── Success State ───────────────────────────────────────────────────── */
  if (formState === "success") {
    return (
      <main
        className="relative min-h-screen w-full flex items-center justify-center px-4 md:px-6 lg:px-8"
        style={{ background: "var(--aras-bg)" }}
      >
        <div className="max-w-lg w-full text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center mb-8"
          >
            <div className="w-20 h-20 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="font-orbitron font-bold text-2xl md:text-3xl mb-4"
            style={{ color: "var(--aras-text)" }}
          >
            {alreadySubmitted ? "Bereits eingereicht." : "Aktivierung angestoßen."}
          </motion.h1>

          {ref && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="font-orbitron text-lg mb-3"
              style={{ color: "var(--aras-orange)" }}
            >
              Dein Ticket: {ref}
            </motion.p>
          )}

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base leading-relaxed mb-10"
            style={{ color: "var(--aras-muted)" }}
          >
            Wir ordnen das manuell zu und schalten PRO frei — meist innerhalb von 24 Stunden.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => setLocation("/auth")}
              className="aras-btn--primary rounded-full px-7 py-3 font-inter font-semibold text-base transition-all duration-300"
            >
              Zum Login
              <ArrowRight className="inline-block w-4 h-4 ml-1.5 -mt-0.5" />
            </button>
            <button
              onClick={() => setLocation("/founding")}
              className="aras-btn--secondary rounded-full px-6 py-3 font-inter text-sm border border-[rgba(233,215,196,0.15)] hover:border-[rgba(254,145,0,0.3)] transition-all duration-300"
              style={{ color: "var(--aras-muted)" }}
            >
              <ArrowLeft className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
              Zurück zur Landingpage
            </button>
          </motion.div>
        </div>
      </main>
    );
  }

  /* ─── Form State ──────────────────────────────────────────────────────── */
  return (
    <main
      className="relative min-h-screen w-full px-4 md:px-6 lg:px-8 py-16 md:py-24"
      style={{ background: "var(--aras-bg)" }}
    >
      <div className="max-w-lg w-full mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="flex items-center justify-center mb-6"
        >
          <div className="w-16 h-16 rounded-full bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-orbitron font-bold text-2xl md:text-3xl mb-3 text-center"
          style={{ color: "var(--aras-text)" }}
        >
          Zahlung erfolgreich.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-base leading-relaxed mb-10 text-center"
          style={{ color: "var(--aras-muted)" }}
        >
          Wir ordnen deine Zahlung deinem ARAS-Account zu und schalten PRO frei.
        </motion.p>

        {/* Claim Card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="rounded-[24px] border border-[rgba(233,215,196,0.12)] bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] shadow-[0_18px_70px_rgba(0,0,0,0.55)] p-6 md:p-8"
          id="claim"
        >
          <h2
            className="font-orbitron font-bold text-lg md:text-xl mb-6"
            style={{ color: "var(--aras-text)" }}
          >
            Deinen ARAS-Account zuordnen
          </h2>

          <div className="space-y-4">
            {/* ARAS Login */}
            <div>
              <label
                htmlFor="aras-login"
                className="block text-sm font-inter font-medium mb-1.5"
                style={{ color: "var(--aras-muted)" }}
              >
                ARAS Login <span style={{ color: "var(--aras-orange)" }}>*</span>
              </label>
              <input
                id="aras-login"
                type="text"
                value={arasLogin}
                onChange={(e) => setArasLogin(e.target.value)}
                placeholder="z.B. deine Login-E-Mail"
                className="w-full h-[44px] rounded-[14px] px-4 text-sm font-inter bg-transparent outline-none transition-all duration-200"
                style={{
                  border: "1px solid rgba(233,215,196,0.14)",
                  color: "var(--aras-text)",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.55)")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Stripe Email */}
            <div>
              <label
                htmlFor="stripe-email"
                className="block text-sm font-inter font-medium mb-1.5"
                style={{ color: "var(--aras-muted)" }}
              >
                Stripe Zahlungs-E-Mail <span className="text-xs opacity-60">(optional)</span>
              </label>
              <input
                id="stripe-email"
                type="email"
                value={stripeEmail}
                onChange={(e) => setStripeEmail(e.target.value)}
                placeholder="falls abweichend vom Login"
                className="w-full h-[44px] rounded-[14px] px-4 text-sm font-inter bg-transparent outline-none transition-all duration-200"
                style={{
                  border: "1px solid rgba(233,215,196,0.14)",
                  color: "var(--aras-text)",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.55)")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Notes */}
            <div>
              <label
                htmlFor="notes"
                className="block text-sm font-inter font-medium mb-1.5"
                style={{ color: "var(--aras-muted)" }}
              >
                Notiz <span className="text-xs opacity-60">(optional, max 500)</span>
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="z.B. Firmenname, besondere Hinweise"
                rows={3}
                className="w-full rounded-[14px] px-4 py-3 text-sm font-inter bg-transparent outline-none transition-all duration-200 resize-none"
                style={{
                  border: "1px solid rgba(233,215,196,0.14)",
                  color: "var(--aras-text)",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.55)")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Honeypot — visually hidden */}
            <div style={{ position: "absolute", left: "-9999px", opacity: 0 }} aria-hidden="true">
              <input
                type="text"
                name="hp"
                tabIndex={-1}
                autoComplete="off"
                value={hp}
                onChange={(e) => setHp(e.target.value)}
              />
            </div>

            {/* Alpha Checkbox */}
            <label className="flex items-center gap-3 cursor-pointer select-none group pt-2">
              <span
                className={`relative flex items-center justify-center w-5 h-5 rounded border-2 transition-all duration-200 ${
                  alphaChecked
                    ? "border-[var(--aras-orange)] bg-[var(--aras-orange)]"
                    : "border-[rgba(233,215,196,0.3)] bg-transparent group-hover:border-[rgba(254,145,0,0.5)]"
                }`}
              >
                {alphaChecked && <Check className="w-3.5 h-3.5 text-black" />}
                <input
                  type="checkbox"
                  checked={alphaChecked}
                  onChange={(e) => setAlphaChecked(e.target.checked)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </span>
              <span className="text-sm" style={{ color: "var(--aras-muted)" }}>
                Ich bin Alpha-User und habe einen ARAS-Account.
              </span>
            </label>

            {/* Error */}
            {formState === "error" && errorMsg && (
              <p className="text-sm text-red-400">{errorMsg}</p>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`aras-btn--primary w-full rounded-[14px] h-[44px] font-inter font-semibold text-base transition-all duration-300 mt-2 ${
                canSubmit ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
              }`}
            >
              {formState === "submitting" ? (
                <Loader2 className="inline-block w-5 h-5 animate-spin" />
              ) : (
                "Aktivierung anstoßen"
              )}
            </button>
          </div>
        </motion.div>

        {/* Footer links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex items-center justify-center gap-4 mt-8"
        >
          <button
            onClick={() => setLocation("/auth")}
            className="text-sm font-inter hover:underline transition-opacity"
            style={{ color: "var(--aras-muted)" }}
          >
            Zum Login
          </button>
          <span style={{ color: "var(--aras-soft)" }}>·</span>
          <button
            onClick={() => setLocation("/founding")}
            className="text-sm font-inter hover:underline transition-opacity"
            style={{ color: "var(--aras-muted)" }}
          >
            Zurück zur Landingpage
          </button>
        </motion.div>
      </div>
    </main>
  );
}
