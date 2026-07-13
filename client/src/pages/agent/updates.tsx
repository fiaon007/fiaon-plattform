import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Sparkles, MessageSquarePlus, ArrowRight } from "lucide-react";
import { AgentShell, api, fmtD, ACCENT } from "./shared";
import { Reveal } from "./motion";

// ============================================================================
// /agent/updates (Paket AM) — chronologische Liste aller veröffentlichten
// Portal-Updates. Der Aufruf markiert alles als gelesen (Banner verschwindet,
// Gelesen-Status pro Agent serverseitig in fiaon_agent_update_reads).
// ============================================================================

interface UpdateItem {
  id: number;
  title: string;
  body: string;
  published_at: string;
  read_at: string | null;
}

export default function AgentUpdatesPage() {
  return (
    <AgentShell>
      <UpdatesContent />
    </AgentShell>
  );
}

function UpdatesContent() {
  const [updates, setUpdates] = useState<UpdateItem[] | null>(null);

  useEffect(() => {
    (async () => {
      const r = await api("/agent/updates");
      if (r.ok) setUpdates(r.json.data);
      // Gelesen-Status setzen NACH dem Laden — „Neu"-Markierungen bleiben
      // für diese Ansicht sichtbar, der Banner verschwindet ab jetzt.
      api("/agent/updates/read", { method: "POST" }).catch(() => {});
      // Shell-Banner sofort aktualisieren
      window.dispatchEvent(new CustomEvent("agent-updates-read"));
    })();
  }, []);

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Updates</h1>
        <p className="text-[12px] text-slate-400 mb-5">Alle Neuerungen und Verbesserungen an deinem Agent-Portal.</p>
      </Reveal>

      {updates === null && (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="agent-skeleton h-24 rounded-2xl" />)}</div>
      )}

      {updates !== null && updates.length === 0 && (
        <Reveal index={1}>
          <div className="agent-glass rounded-2xl px-5 py-10 text-center">
            <Sparkles size={22} strokeWidth={1.6} className="mx-auto text-slate-300 mb-2" />
            <p className="text-[13px] font-medium text-slate-500">Noch keine Updates veröffentlicht.</p>
            <p className="text-[12px] text-slate-400 mt-0.5">Sobald es Neuerungen gibt, erscheinen sie hier.</p>
          </div>
        </Reveal>
      )}

      <div className="space-y-3">
        {(updates || []).map((u, i) => (
          <Reveal key={u.id} index={i + 1}>
            <article className="agent-glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h2 className="text-[14px] font-semibold text-slate-900 leading-snug">{u.title}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {!u.read_at && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: ACCENT }}>Neu</span>
                  )}
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtD(u.published_at)}</span>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap">{u.body}</p>
            </article>
          </Reveal>
        ))}
      </div>

      {/* AN-Teaser: Feedback-Schleife — Verbesserungen werden belohnt */}
      <Reveal index={(updates?.length || 0) + 2}>
        <Link href="/agent/feedback" className="mt-5 agent-glass rounded-2xl px-5 py-4 flex items-center gap-3 transition-transform duration-150 active:scale-[.995] hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.32)]">
          <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <MessageSquarePlus size={17} strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-semibold text-slate-900">Du hast eine Idee fürs Portal?</span>
            <span className="block text-[11.5px] text-slate-400">Reiche Feedback ein — umgesetzte Vorschläge werden mit einer Provisions-Gutschrift belohnt.</span>
          </span>
          <ArrowRight size={16} className="text-slate-300 shrink-0" />
        </Link>
      </Reveal>
    </div>
  );
}
