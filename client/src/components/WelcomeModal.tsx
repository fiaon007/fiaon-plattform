import { welcomeConfig, fillName, type WelcomeState } from "@/config/welcome";

interface WelcomeModalProps {
  open: boolean;
  state: WelcomeState;
  firstName?: string;
  /** KI-gestützte, kontextsensible Coaching-Nachricht (nur aggregierte Signale). */
  coaching?: string | null;
  onClose: () => void;
  onGoto?: (section: "overview" | "account" | "documents") => void;
}

/* ── Kontextabhängiges Willkommens-Popup (Kunden-Dashboard) ──
   Reine Begrüßung (title + body) ist immer aktiv.
   Die Orientierungs-Schritte erscheinen nur, wenn welcomeConfig.tourEnabled. */
export default function WelcomeModal({ open, state, firstName, coaching, onClose, onGoto }: WelcomeModalProps) {
  if (!open) return null;
  const block = welcomeConfig.content[state];
  const showSteps = welcomeConfig.tourEnabled && !!block.steps?.length;

  const handleCta = () => {
    if (block.gotoSection && onGoto) onGoto(block.gotoSection);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden bg-white db-enter"
        style={{
          fontFamily: "'Inter',-apple-system,sans-serif",
          boxShadow: "0 32px 80px -12px rgba(15,23,42,.35), 0 1px 0 rgba(255,255,255,.6) inset",
          border: "1px solid rgba(226,232,240,.8)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Kopf-Verlauf im CI */}
        <div className="relative px-7 pt-8 pb-7 overflow-hidden" style={{ background: "linear-gradient(135deg,#0f2d5c 0%,#1a4a8a 55%,#2563eb 100%)" }}>
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)" }} />
          <div
            className="absolute -top-10 -right-8 w-40 h-40 rounded-full opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle,#60a5fa,transparent 70%)" }}
          />
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          <div className="relative flex items-center gap-2 mb-4">
            <span className="text-base font-bold tracking-tight text-white">FIAON</span>
            <span className="text-[9px] font-semibold text-white/70 bg-white/15 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Mitgliedsbereich</span>
          </div>
          <h2 className="relative text-2xl font-bold text-white tracking-tight leading-tight">
            {fillName(block.title, firstName)}
          </h2>
        </div>

        {/* Inhalt */}
        <div className="px-7 py-6">
          <p className="text-[14px] text-slate-600 leading-relaxed">{block.body}</p>

          {/* KI-Coaching-Begrüßung (kontextsensibel, nur aggregierte Signale) */}
          {coaching && (
            <div className="mt-4 rounded-2xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(145deg,#f8fafc,#eff6ff)", border: "1px solid #dbeafe" }}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/></svg>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#2563eb]">Dein FIAON-Coach</span>
              </div>
              <p className="text-[13px] text-slate-700 leading-relaxed">{coaching}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">Bildungsinhalt · keine Finanzberatung</span>
            </div>
          )}

          {showSteps && (
            <div className="mt-5 space-y-2.5">
              {block.steps!.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
                    {i + 1}
                  </div>
                  <p className="text-[13px] text-slate-700 leading-relaxed pt-0.5">{step}</p>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleCta}
            className="mt-6 w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[.98]"
            style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)", boxShadow: "0 8px 24px rgba(37,99,235,.3)" }}
          >
            {block.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
