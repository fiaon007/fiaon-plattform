import { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { createPortal } from "react-dom";

interface ArasConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ArasConfirmDialog({
  open, title, description, confirmLabel = "Bestätigen", cancelLabel = "Abbrechen",
  variant = "default", loading = false, onConfirm, onCancel,
}: ArasConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus confirm button on open
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  const isDanger = variant === "danger";

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
      onClick={() => !loading && onCancel()}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="aras-confirm-title"
      aria-describedby="aras-confirm-desc"
    >
      <div
        className="w-full max-w-sm rounded-[20px] overflow-hidden"
        style={{
          background: "#1a1a1c",
          border: "1px solid var(--aras-stroke)",
          boxShadow: "0 25px 60px -12px rgba(0,0,0,0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          {isDanger && (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: "rgba(239,68,68,0.1)" }}
            >
              <AlertCircle className="w-5 h-5" style={{ color: "#EF4444" }} />
            </div>
          )}
          <h3
            id="aras-confirm-title"
            className="font-orbitron text-base font-bold"
            style={{ color: "var(--aras-text)" }}
          >
            {title}
          </h3>
          <p
            id="aras-confirm-desc"
            className="text-sm mt-2 leading-relaxed"
            style={{ color: "var(--aras-muted)", opacity: 0.78 }}
          >
            {description}
          </p>
        </div>

        <div className="px-6 pb-6 pt-4 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--aras-muted)" }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{
              background: isDanger ? "#EF4444" : "var(--aras-orange)",
              color: isDanger ? "white" : "black",
              boxShadow: isDanger
                ? "0 0 16px rgba(239,68,68,0.2)"
                : "0 0 16px rgba(254,145,0,0.15)",
            }}
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Bitte warten...</>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
