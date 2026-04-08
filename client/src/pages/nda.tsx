import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { SEOHead } from "@/components/seo-head";
import { cn } from "@/lib/utils";
import {
  Shield,
  Lock,
  FileText,
  Scale,
  Ban,
  AlertTriangle,
  Globe,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// NDA Version — single source of truth (must match server)
// ---------------------------------------------------------------------------
const NDA_VERSION = "2026-02-13-v1";

// ---------------------------------------------------------------------------
// NDA sections content
// ---------------------------------------------------------------------------
const NDA_SECTIONS = [
  {
    icon: Lock,
    title: "1. Confidentiality",
    content:
      "All information in the Data Room is confidential, including but not limited to: business models, product strategy, financials, marketing & sales strategies, technical documentation, investor materials.",
  },
  {
    icon: FileText,
    title: "2. Purpose Limitation",
    content:
      "Information may only be used to evaluate a potential business relationship or investment. No third-party disclosure without written consent.",
  },
  {
    icon: Ban,
    title: "3. No Reproduction",
    content:
      "Documents may not be reproduced, copied, forwarded, or published.",
  },
  {
    icon: AlertTriangle,
    title: "4. Contractual Penalty",
    content:
      "For each breach, a contractual penalty of EUR 50,000 is due, without prejudice to further damages.",
  },
  {
    icon: Globe,
    title: "5. Governing Law and Venue",
    content: "Swiss law applies. Venue: Zurich.",
  },
  {
    icon: Scale,
    title: "6. Digital Acceptance",
    content:
      'By entering the full name and clicking "I Agree & Enter Data Room", this NDA is concluded as legally binding.',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NdaPage() {
  const [, navigate] = useLocation();

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [checkingCookie, setCheckingCookie] = useState(true);

  // On mount: check if cookie already valid → redirect
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nda/verify");
        const data = await res.json();
        if (data.valid) {
          navigate("/data-room", { replace: true });
          return;
        }
      } catch {}
      setCheckingCookie(false);
    })();
  }, [navigate]);

  // Email-based recheck (debounced)
  useEffect(() => {
    if (!email || email.length < 5 || !email.includes("@")) {
      setAlreadyAccepted(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/nda/status?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        setAlreadyAccepted(!!data.accepted);
      } catch {
        setAlreadyAccepted(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [email]);

  const isValid = fullName.trim().length >= 3 && email.includes("@") && email.includes(".") && consent;

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isValid || status === "loading") return;

      setStatus("loading");
      setErrorMsg("");

      try {
        const res = await fetch("/api/nda/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            company: company.trim() || undefined,
            consent: true,
            pagePath: window.location.pathname,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.message || "Submission failed");
        }

        setStatus("success");
        // Short delay so user sees success state
        setTimeout(() => {
          navigate(data.redirectTo || "/data-room", { replace: true });
        }, 800);
      } catch (err: any) {
        setErrorMsg(err.message || "Something went wrong. Please try again.");
        setStatus("error");
      }
    },
    [fullName, email, company, consent, isValid, status, navigate]
  );

  // While checking cookie, show minimal loading
  if (checkingCookie) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0f0f0f" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#FE9100" }} />
      </div>
    );
  }

  const inputCls =
    "w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition-all duration-200" as const;

  return (
    <div className="relative min-h-screen" style={{ background: "#0f0f0f" }}>
      <SEOHead
        title="NDA — ARAS AI Data Room Access"
        description="Accept the Non-Disclosure Agreement to access the ARAS AI Data Room."
      />

      {/* Injected styles */}
      <style>{`
        .nda-input {
          border-color: rgba(233,215,196,0.12);
          background: rgba(255,255,255,0.025);
          color: rgba(245,245,247,0.92);
        }
        .nda-input::placeholder { color: rgba(245,245,247,0.25); }
        .nda-input:focus {
          border-color: rgba(254,145,0,0.4);
          box-shadow: 0 0 0 3px rgba(254,145,0,0.08);
        }
        .nda-checkbox {
          appearance: none;
          width: 20px; height: 20px;
          border: 2px solid rgba(233,215,196,0.20);
          border-radius: 6px;
          background: rgba(255,255,255,0.03);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
          position: relative;
        }
        .nda-checkbox:checked {
          background: #FE9100;
          border-color: #FE9100;
        }
        .nda-checkbox:checked::after {
          content: "✓";
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          color: #0f0f0f;
          font-size: 12px;
          font-weight: 700;
        }
        .nda-checkbox:focus-visible {
          outline: 2px solid rgba(254,145,0,0.5);
          outline-offset: 2px;
        }
        .nda-section-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid rgba(233,215,196,0.08);
          border-radius: 14px;
          background: rgba(255,255,255,0.012);
          color: rgba(245,245,247,0.88);
          cursor: pointer;
          transition: border-color 0.2s ease, background 0.2s ease;
          text-align: left;
        }
        .nda-section-btn:hover {
          border-color: rgba(254,145,0,0.18);
          background: rgba(255,255,255,0.02);
        }
        .nda-section-btn.open {
          border-color: rgba(254,145,0,0.25);
          background: rgba(254,145,0,0.03);
        }
        .nda-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 16px 28px;
          border-radius: 999px;
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.02em;
          border: 1px solid rgba(254,145,0,0.30);
          background: linear-gradient(180deg, rgba(254,145,0,0.16), rgba(255,255,255,0.02));
          color: rgba(255,255,255,0.96);
          box-shadow: 0 18px 64px rgba(254,145,0,0.10);
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease, opacity 0.2s ease;
        }
        .nda-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 26px 92px rgba(254,145,0,0.14), 0 22px 74px rgba(0,0,0,0.60);
        }
        .nda-submit:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .nda-submit:focus-visible {
          outline: 2px solid rgba(254,145,0,0.55);
          outline-offset: 3px;
        }
      `}</style>

      {/* Background auras */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(800px 500px at 50% 5%, rgba(254,145,0,0.10), transparent 65%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(600px 400px at 80% 80%, rgba(233,215,196,0.05), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />
      </div>

      {/* Content */}
      <div className="relative z-[1] max-w-2xl mx-auto px-4 sm:px-6" style={{ paddingTop: "clamp(40px, 6vh, 80px)", paddingBottom: 60 }}>
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ border: "1px solid rgba(233,215,196,0.16)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)" }}>
            <Shield className="w-4 h-4" style={{ color: "#FE9100" }} />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(233,215,196,0.85)" }}>
              Confidential Access
            </span>
          </div>

          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(1.5rem, 3.5vw, 2.2rem)", lineHeight: 1.1, color: "#e9d7c4", letterSpacing: "-0.01em" }}>
            Non-Disclosure Agreement
          </h1>
          <p className="mt-3" style={{ fontSize: 14, color: "rgba(245,245,247,0.50)", maxWidth: 440, margin: "12px auto 0" }}>
            Please review and accept the NDA below to access the ARAS AI Data Room.
          </p>
        </div>

        {/* NDA Sections (collapsible) */}
        <div className="space-y-2 mb-10">
          <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(254,145,0,0.75)", marginBottom: 8, fontFamily: "'Orbitron', sans-serif" }}>
            Digital Acceptance
          </p>
          {NDA_SECTIONS.map((section, i) => {
            const Icon = section.icon;
            const isOpen = expandedSection === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => setExpandedSection(isOpen ? null : i)}
                  className={cn("nda-section-btn", isOpen && "open")}
                >
                  <Icon className="w-4 h-4 shrink-0" style={{ color: isOpen ? "#FE9100" : "rgba(233,215,196,0.55)" }} />
                  <span className="flex-1 text-sm font-semibold">{section.title}</span>
                  <ChevronDown
                    className="w-4 h-4 shrink-0 transition-transform duration-200"
                    style={{ color: "rgba(233,215,196,0.35)", transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-3 pt-2 ml-8" style={{ fontSize: 13.5, lineHeight: 1.7, color: "rgba(245,245,247,0.55)" }}>
                    {section.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Form card */}
        <div style={{ borderRadius: 20, border: "1px solid rgba(233,215,196,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", padding: "28px" }}>

          {/* Already accepted hint */}
          {alreadyAccepted && status === "idle" && (
            <div className="flex items-center gap-2 mb-5 px-4 py-3 rounded-xl" style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.18)" }}>
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#10b981" }} />
              <p style={{ fontSize: 13, color: "rgba(16,185,129,0.9)" }}>
                This email has already accepted the NDA. Click submit to continue.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(233,215,196,0.7)" }}>
                Full Name <span style={{ color: "#FE9100" }}>*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Max Mustermann"
                className={cn(inputCls, "nda-input")}
                required
                minLength={3}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(233,215,196,0.7)" }}>
                Email <span style={{ color: "#FE9100" }}>*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={cn(inputCls, "nda-input")}
                required
              />
            </div>

            {/* Company */}
            <div>
              <label className="block text-[11px] font-semibold tracking-[0.15em] uppercase mb-1.5" style={{ color: "rgba(233,215,196,0.7)" }}>
                Company <span style={{ fontSize: 10, color: "rgba(245,245,247,0.30)" }}>(optional)</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Firm / Family Office"
                className={cn(inputCls, "nda-input")}
              />
            </div>

            {/* Consent checkbox */}
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="nda-checkbox mt-0.5"
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(245,245,247,0.65)" }}>
                I have read and agree to the Non-Disclosure Agreement above. I understand that this constitutes a legally binding digital acceptance.
              </span>
            </label>

            {/* Error */}
            {status === "error" && (
              <div className="rounded-2xl px-4 py-3" style={{ border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", fontSize: 13, color: "rgba(239,68,68,0.85)" }}>
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={!isValid || status === "loading" || status === "success"} className="nda-submit">
              {status === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : status === "success" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {status === "loading"
                ? "Processing…"
                : status === "success"
                  ? "Access Granted — Redirecting…"
                  : "I Agree & Enter Data Room"}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center mt-5" style={{ fontSize: 11, color: "rgba(245,245,247,0.25)" }}>
            All access is logged. NDA version: {NDA_VERSION}
          </p>
        </div>
      </div>
    </div>
  );
}
