import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { SEOHead } from "@/components/seo-head";
import {
  Shield,
  Lock,
  FileText,
  BarChart3,
  Presentation,
  Download,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// NDA Guard — checks cookie via /api/nda/verify on mount
// ---------------------------------------------------------------------------
function useNdaGuard() {
  const [, navigate] = useLocation();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/nda/verify");
        const data = await res.json();
        if (data.valid) {
          setVerified(true);
        } else {
          navigate("/nda?return=/data-room", { replace: true });
        }
      } catch {
        navigate("/nda?return=/data-room", { replace: true });
      } finally {
        setChecking(false);
      }
    })();
  }, [navigate]);

  return { verified, checking };
}

// ---------------------------------------------------------------------------
// Placeholder data room documents
// ---------------------------------------------------------------------------
const DOCUMENTS = [
  {
    icon: Presentation,
    title: "Investor Deck",
    description: "Company overview, market opportunity, traction, and roadmap.",
    tag: "PDF",
  },
  {
    icon: BarChart3,
    title: "Financial Model",
    description: "Revenue projections, unit economics, and funding scenarios.",
    tag: "XLSX",
  },
  {
    icon: FileText,
    title: "Technical Architecture",
    description: "Platform stack overview, infrastructure, and security documentation.",
    tag: "PDF",
  },
  {
    icon: Shield,
    title: "Compliance & Governance",
    description: "GDPR readiness, data residency, and Swiss governance framework.",
    tag: "PDF",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DataRoomPage() {
  const { verified, checking } = useNdaGuard();

  if (checking || !verified) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: "#0f0f0f" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#FE9100" }} />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" style={{ background: "#0f0f0f" }}>
      <SEOHead
        title="Data Room — ARAS AI"
        description="Confidential investor data room for ARAS AI."
      />

      {/* Styles */}
      <style>{`
        .dr-card {
          position: relative;
          border-radius: 18px;
          border: 1px solid rgba(233,215,196,0.10);
          background: rgba(255,255,255,0.014);
          padding: 24px;
          transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
          cursor: pointer;
        }
        .dr-card:hover {
          border-color: rgba(254,145,0,0.22);
          background: rgba(255,255,255,0.022);
          transform: translateY(-2px);
        }
        .dr-tag {
          display: inline-flex;
          align-items: center;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          border: 1px solid rgba(254,145,0,0.22);
          background: rgba(254,145,0,0.06);
          color: rgba(233,215,196,0.85);
        }
      `}</style>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(800px 500px at 50% 5%, rgba(254,145,0,0.08), transparent 65%)" }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />
      </div>

      {/* Content */}
      <div className="relative z-[1] max-w-4xl mx-auto px-4 sm:px-6" style={{ paddingTop: "clamp(40px, 6vh, 80px)", paddingBottom: 60 }}>
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ border: "1px solid rgba(233,215,196,0.16)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)" }}>
            <Lock className="w-4 h-4" style={{ color: "#FE9100" }} />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(233,215,196,0.85)" }}>
              Confidential Data Room
            </span>
          </div>

          <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(1.6rem, 3.5vw, 2.4rem)", lineHeight: 1.1, color: "#e9d7c4", letterSpacing: "-0.01em" }}>
            ARAS AI — Data Room
          </h1>
          <p className="mt-3" style={{ fontSize: 15, lineHeight: 1.7, color: "rgba(245,245,247,0.50)", maxWidth: 560 }}>
            Welcome. All documents below are subject to the NDA you accepted. Please do not share, copy, or redistribute any materials.
          </p>
        </div>

        {/* Document grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCUMENTS.map((doc) => {
            const Icon = doc.icon;
            return (
              <div key={doc.title} className="dr-card">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div style={{ width: 44, height: 44, borderRadius: 14, border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon className="w-[18px] h-[18px]" style={{ color: "rgba(233,215,196,0.85)" }} />
                  </div>
                  <span className="dr-tag">{doc.tag}</span>
                </div>
                <h3 className="mb-2" style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: 14.5, color: "rgba(245,245,247,0.92)" }}>
                  {doc.title}
                </h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "rgba(245,245,247,0.50)" }}>
                  {doc.description}
                </p>
                <div className="flex items-center gap-2 mt-4" style={{ fontSize: 12, color: "rgba(254,145,0,0.75)", fontWeight: 600 }}>
                  <Download className="w-3.5 h-3.5" />
                  Coming soon
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8" style={{ borderTop: "1px solid rgba(233,215,196,0.06)" }}>
          <p style={{ fontSize: 11, lineHeight: 1.7, color: "rgba(245,245,247,0.20)" }}>
            This Data Room is provided for evaluation purposes only. All content is confidential and protected under the executed NDA. Unauthorized distribution will be prosecuted. © ARAS AI — Zurich, Switzerland.
          </p>
        </div>
      </div>
    </div>
  );
}
