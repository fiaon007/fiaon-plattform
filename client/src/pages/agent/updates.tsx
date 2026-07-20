import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MessageSquarePlus, ArrowRight, ChevronDown, ListChecks, Hand } from "lucide-react";
import { AgentShell, ACCENT } from "./shared";
import { Reveal } from "./motion";
import { AGENT_UPDATES, markUpdatesSeen, fmtUpdateDate, getUnseenCount, type AgentUpdate, type UpdateCategory } from "./updates-data";

// ============================================================================
// /agent/updates — der agentengerechte Changelog: die letzten Updates aus
// GitHub, in einfacher Sprache erklärt („Was wurde gemacht“ + „So bedienst du
// es“). Aufklappbare Karten, moderne Animationen, FIAON-CI. Der Aufruf
// markiert alles als gesehen → Banner und Badge verschwinden sofort.
// ============================================================================

const CATEGORY_STYLE: Record<UpdateCategory, { label: string; cls: string }> = {
  Neu:         { label: "Neu",         cls: "text-white" },
  Verbessert:  { label: "Verbessert",  cls: "text-indigo-700 bg-indigo-50 border border-indigo-100" },
  Behoben:     { label: "Behoben",     cls: "text-emerald-700 bg-emerald-50 border border-emerald-100" },
  Hintergrund: { label: "Hintergrund", cls: "text-slate-500 bg-slate-50 border border-slate-200" },
};

export default function AgentUpdatesPage() {
  return (
    <AgentShell>
      <UpdatesContent />
    </AgentShell>
  );
}

function UpdatesContent() {
  // Neuester Eintrag standardmäßig offen — sofortiger Mehrwert.
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    AGENT_UPDATES[0] ? { [AGENT_UPDATES[0].id]: true } : {},
  );
  const unseen = getUnseenCount();

  useEffect(() => {
    // Beim Öffnen der Seite gilt alles als gesehen → Banner/Badge verschwinden.
    markUpdatesSeen();
  }, []);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Neuerungen</h1>
        <p className="text-[12px] text-slate-400 mb-5">
          Die letzten Updates an deinem Portal — was wir geändert haben und wie du es bedienst.
          {unseen > 0 && <span className="font-semibold" style={{ color: ACCENT }}> {unseen} neu.</span>}
        </p>
      </Reveal>

      <div className="space-y-3">
        {AGENT_UPDATES.map((u, i) => (
          <Reveal key={u.id} index={i + 1}>
            <UpdateCard u={u} isNew={i < unseen} open={!!open[u.id]} onToggle={() => toggle(u.id)} />
          </Reveal>
        ))}
      </div>

      {/* Feedback-Schleife — umgesetzte Vorschläge werden belohnt */}
      <Reveal index={AGENT_UPDATES.length + 2}>
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

function UpdateCard({ u, isNew, open, onToggle }: { u: AgentUpdate; isNew: boolean; open: boolean; onToggle: () => void }) {
  const cat = CATEGORY_STYLE[u.category];
  return (
    <article className={`agent-glass rounded-2xl overflow-hidden transition-shadow duration-200 ${open ? "shadow-[0_24px_56px_-30px_rgba(15,23,42,.34)]" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left px-5 py-4 flex items-start gap-3 transition-colors hover:bg-white/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cat.cls}`}
              style={u.category === "Neu" ? { background: ACCENT } : undefined}
            >
              {cat.label}
            </span>
            {isNew && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} aria-label="ungelesen" />}
            <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtUpdateDate(u.date)}</span>
          </span>
          <span className="block text-[14px] font-semibold text-slate-900 leading-snug">{u.title}</span>
          <span className="block text-[12.5px] text-slate-500 leading-relaxed mt-0.5">{u.summary}</span>
        </span>
        <ChevronDown
          size={18}
          className="text-slate-400 shrink-0 mt-0.5 transition-transform duration-300"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {/* Aufklapp-Bereich: weiche Höhen-Animation via grid-template-rows */}
      <div className={`agent-expand ${open ? "open" : ""}`}>
        <div>
          <div className="px-5 pb-5 pt-1">
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <section>
                <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                  <ListChecks size={13} strokeWidth={2} /> Was wurde gemacht
                </p>
                <ul className="space-y-1.5">
                  {u.changes.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-slate-600 leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </section>

              {u.howto && u.howto.length > 0 && (
                <section>
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: ACCENT }}>
                    <Hand size={13} strokeWidth={2} /> So bedienst du es
                  </p>
                  <ol className="space-y-1.5">
                    {u.howto.map((step, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] text-slate-700 leading-relaxed">
                        <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: ACCENT }}>{i + 1}</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {u.link && (
                <Link
                  href={u.link.href}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12.5px] font-semibold text-white transition-transform duration-150 active:scale-[.98]"
                  style={{ background: ACCENT }}
                >
                  {u.link.label} <ArrowRight size={15} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
