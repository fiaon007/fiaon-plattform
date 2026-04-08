import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SupportDockProps = {
  children: React.ReactNode;
  autoHideMs?: number;
};

export function SupportDock({ children, autoHideMs = 5000 }: SupportDockProps) {
  const [open, setOpen] = React.useState(true);
  const [interacted, setInteracted] = React.useState(false);

  React.useEffect(() => {
    // Optional persist from localStorage
    try {
      const saved = localStorage.getItem("aras_support_dock");
      if (saved === "closed") setOpen(false);
      if (saved === "open") setOpen(true);
    } catch {}

    // Auto-hide timer
    const t = window.setTimeout(() => {
      if (!interacted) setOpen(false);
    }, autoHideMs);

    return () => window.clearTimeout(t);
  }, [autoHideMs, interacted]);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("aras_support_dock", next ? "open" : "closed");
      } catch {}
      return next;
    });
    setInteracted(true);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <div
        className="flex items-end gap-2"
        onMouseEnter={() => setInteracted(true)}
        onFocus={() => setInteracted(true)}
      >
        {/* Panel - slides in/out */}
        <div
          className={[
            "overflow-hidden transition-all duration-300 ease-out",
            open ? "w-[240px] opacity-100" : "w-0 opacity-0 pointer-events-none",
          ].join(" ")}
        >
          <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl shadow-2xl p-2">
            <div className="flex flex-col gap-2">{children}</div>
          </div>
        </div>

        {/* Handle - always visible, right aligned */}
        <button
          type="button"
          onClick={toggle}
          className="h-11 w-11 flex-shrink-0 rounded-full border border-[#ff6a00]/40 bg-black/70 backdrop-blur-xl shadow-lg transition hover:shadow-[0_0_24px_rgba(255,106,0,0.35)] focus:outline-none"
          aria-label={open ? "Support einklappen" : "Support ausklappen"}
        >
          <span className="flex items-center justify-center text-[#ff6a00]">
            {open ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </span>
        </button>
      </div>
    </div>
  );
}
