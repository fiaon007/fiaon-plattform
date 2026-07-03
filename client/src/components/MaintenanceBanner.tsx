import { MAINTENANCE_MODE, MAINTENANCE_TITLE, MAINTENANCE_MESSAGE } from "@/lib/maintenance";

/**
 * Globaler Wartungs-Banner — wird in App.tsx auf jeder Seite gerendert.
 * Gesteuert über MAINTENANCE_MODE in client/src/lib/maintenance.ts
 */
export default function MaintenanceBanner() {
  if (!MAINTENANCE_MODE) return null;

  return (
    <div
      className="sticky top-0 z-[100] w-full"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)",
        borderBottom: "1px solid rgba(251,191,36,.35)",
      }}
      role="alert"
    >
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-center gap-3 flex-wrap sm:flex-nowrap">
        <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 whitespace-nowrap">{MAINTENANCE_TITLE}</span>
        </span>
        <p className="text-[11.5px] sm:text-[12px] font-medium text-white/85 leading-snug text-center sm:text-left">
          {MAINTENANCE_MESSAGE}
        </p>
      </div>
    </div>
  );
}

/**
 * Wartungs-Panel für blockierte Zahlungs-/Antragsschritte.
 * Ersetzt Stripe-Checkout-Elemente, solange MAINTENANCE_MODE aktiv ist.
 */
export function MaintenancePaymentBlock() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8 text-center max-w-lg mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300 flex items-center justify-center mx-auto mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <h3 className="text-[16px] font-bold text-amber-900 mb-2">{MAINTENANCE_TITLE}</h3>
      <p className="text-[13px] text-amber-800/90 leading-relaxed mb-4">{MAINTENANCE_MESSAGE}</p>
      <p className="text-[11.5px] text-amber-700/70">
        Deine bisherigen Angaben wurden gespeichert — du musst nichts erneut ausfüllen.
      </p>
    </div>
  );
}
