import { useState, useEffect, useMemo } from "react";
import { FileText, ChevronDown, Search } from "lucide-react";
import { AgentShell, Card, api, inputCls, fmtD, ACCENT } from "./shared";
import { Reveal } from "./motion";

// ============================================================================
// /agent/skripte (I2) — durchsuchbare, nach Kategorie gruppierte Leitfäden.
// Rich-Text direkt lesbar, PDFs im Viewer (neuer Tab).
// ============================================================================

interface Script {
  id: number;
  title: string;
  category: string;
  content_html: string | null;
  file_name: string | null;
  updated_at: string;
}

export default function AgentSkriptePage() {
  return (
    <AgentShell>
      <SkripteContent />
    </AgentShell>
  );
}

function SkripteContent() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});

  useEffect(() => {
    api("/agent/scripts").then((r) => {
      if (r.ok) setScripts(r.json.data);
      setLoading(false);
    });
  }, []);

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? scripts.filter((s) => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q) || (s.content_html || "").toLowerCase().includes(q))
      : scripts;
    const map = new Map<string, Script[]>();
    for (const s of filtered) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [scripts, search]);

  return (
    <div className="max-w-3xl">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Skripte</h1>
        <p className="text-[12px] text-slate-400 mb-5">Gesprächsvorlagen und Leitfäden für deine Telefonate.</p>
      </Reveal>

      <Reveal index={1}>
        <div className="relative" style={{ maxWidth: 420 }}>
          <Search size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche in Titel, Kategorie oder Inhalt …"
            className={`${inputCls} pl-10`}
            style={{ minHeight: 46 }}
          />
        </div>
      </Reveal>

      {loading && <p className="py-14 text-center text-[13px] text-slate-400">Lädt …</p>}
      {!loading && grouped.length === 0 && (
        <p className="py-14 text-center text-[13px] text-slate-400">
          {search ? "Keine Treffer." : "Noch keine Skripte hinterlegt."}
        </p>
      )}

      <div className="mt-5 space-y-6">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{category}</h2>
            <Card className="divide-y divide-slate-50">
              {items.map((s) => (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [s.id]: !o[s.id] })); }}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <FileText size={15} strokeWidth={1.7} className="text-slate-400 shrink-0" />
                      <span className="text-[13px] font-semibold text-slate-800 truncate">{s.title}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-slate-400 hidden sm:inline">Stand {fmtD(s.updated_at)}</span>
                      <ChevronDown size={15} className={`text-slate-400 transition-transform ${open[s.id] ? "" : "-rotate-90"}`} />
                    </span>
                  </button>
                  {open[s.id] && (
                    <div className="px-4 pb-4 pt-1">
                      {s.content_html && (
                        <div
                          className="text-[13px] text-slate-600 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_b]:font-semibold [&_p]:mb-2"
                          dangerouslySetInnerHTML={{ __html: s.content_html }}
                        />
                      )}
                      {s.file_name && (
                        <a
                          href={`/api/fiaon/agent/scripts/${s.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 mt-1 text-[13px] font-semibold hover:underline"
                          style={{ color: ACCENT }}
                        >
                          <FileText size={13} strokeWidth={1.8} /> {s.file_name} öffnen
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
