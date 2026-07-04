import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/recht — Rechtstexte-Review-Status (read-only)
// Zeigt LEGAL_REVIEW_PACKAGE.md aus dem Repo + Links zu den Live-Texten,
// damit der Review-Stand (LEXR) jederzeit sichtbar bleibt.
// ═══════════════════════════════════════════════════════════════════

const LIVE_PAGES = [
  { href: "/impressum", label: "Impressum" },
  { href: "/agb", label: "AGB" },
  { href: "/widerrufsbelehrung", label: "Widerrufsbelehrung" },
  { href: "/privacy", label: "Datenschutz" },
  { href: "/terms", label: "Terms" },
  { href: "/cookie-einstellungen", label: "Cookie-Einstellungen" },
];

export default function AdminRechtPage() {
  const [content, setContent] = useState<string | null>(null);
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/legal-review", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) { setContent(j.content); setExists(j.exists); }
        else setExists(false);
      })
      .catch(() => setExists(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Rechtstexte-Status</h1>
      <p className="text-[13px] text-slate-500 mb-5">
        Read-only Anzeige des Review-Pakets (LEGAL_REVIEW_PACKAGE.md) — Änderungen an Rechtstexten laufen über die Entwicklung, nicht über dieses Panel.
      </p>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-[13px] font-bold text-slate-900 mb-2.5">Live-Seiten (öffentlich)</h2>
        <div className="flex flex-wrap gap-2">
          {LIVE_PAGES.map((p) => (
            <a
              key={p.href}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors"
            >
              {p.label} <ExternalLink size={11} className="text-slate-400" />
            </a>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-[13px] font-bold text-slate-900 mb-2.5">Review-Paket (für LEXR / Steuerberater)</h2>
        {exists == null && <p className="text-[13px] text-slate-400">Lädt …</p>}
        {exists === false && (
          <p className="text-[13px] text-slate-500">
            LEGAL_REVIEW_PACKAGE.md wurde im Deployment nicht gefunden — der Review-Stand ist im Repository dokumentiert.
          </p>
        )}
        {content && (
          <pre className="text-[12px] leading-relaxed text-slate-600 whitespace-pre-wrap font-mono max-h-[60vh] overflow-y-auto bg-slate-50 border border-slate-100 rounded-xl p-4">
            {content}
          </pre>
        )}
      </div>
    </div>
  );
}
