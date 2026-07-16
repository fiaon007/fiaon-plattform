import { useState, useRef, useEffect } from "react";
import { Markdown } from "./AiKit";

// High-End-Look im Gemini-Stil — bewusst OHNE Icon-Bibliothek, nur Farbe/Verlauf.
const GRAD = "linear-gradient(120deg, #4f46e5, #7c3aed, #db2777, #2563eb)";
const LINK = "#6d28d9";
const LS_KEY = "fiaon_cockpit_convos_v1";

// ═══════════════════════════════════════════════════════════════════
// KI-Cockpit — Chat mit dem eigenen System (Prompt 3/3).
// Frage in normaler Sprache → geprüfte, NUR-LESENDE SQL → echte Tabelle +
// KI-Einordnung. Jede Antwort zeigt aufklappbar die verwendete Abfrage (woher
// die Zahl kommt). Kundendaten gehen NIE an die KI — nur aggregierte Werte.
// Sitzt prominent oben auf /admin; bei KI-Ausfall bleibt der Rest der Seite nutzbar.
// ═══════════════════════════════════════════════════════════════════

interface AskResult {
  ok: boolean;
  question: string;
  sql?: string;
  columns?: string[];
  rows?: any[];
  rowCount?: number;
  truncated?: boolean;
  maxRows?: number;
  explanation?: string;
  error?: string;
  rejected?: boolean;
}
interface Turn { id: number; question: string; result: AskResult | null; error?: string }
interface Conversation { id: string; title: string; turns: Turn[]; updatedAt: number }

const CHIPS = [
  "Wie ist der Stand heute?",
  "Welche Zahlungen sind offen?",
  "Wie viele Kunden haben bezahlt?",
  "Beste Quellen nach Konversion",
];

function fmtCell(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  const s = String(v);
  // ISO-Zeitstempel hübsch (deutsche Zeit)
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  }
  return s;
}

/** ref-Spalten werden zu Links in die Zahlungszentrale (Detail öffnen). */
function CellValue({ col, value }: { col: string; value: any }) {
  const s = value == null ? "" : String(value);
  if (col.toLowerCase() === "ref" && /^FIAON-/i.test(s)) {
    return (
      <a href={`/admin/zahlungen?ref=${encodeURIComponent(s)}`} className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid" style={{ color: LINK }}>
        {s}
      </a>
    );
  }
  return <span>{fmtCell(value)}</span>;
}

function ResultTable({ columns, rows }: { columns: string[]; rows: any[] }) {
  // Desktop: echte Tabelle; Mobile (<sm): jede Zeile als Karte.
  return (
    <div className="mt-3">
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 border-b border-slate-100">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 text-[13px] text-slate-700 tabular-nums whitespace-nowrap"><CellValue col={c} value={r[c]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
            <dl className="grid grid-cols-[minmax(0,40%)_1fr] gap-x-3 gap-y-1">
              {columns.map((c) => (
                <div key={c} className="contents">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 py-0.5 truncate">{c}</dt>
                  <dd className="text-[12.5px] text-slate-700 py-0.5 break-words"><CellValue col={c} value={r[c]} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const res = turn.result;

  const copyAnswer = () => {
    const parts = [`Frage: ${turn.question}`];
    if (res?.explanation) parts.push("", res.explanation);
    if (res?.sql) parts.push("", "Abfrage:", res.sql);
    navigator.clipboard?.writeText(parts.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div className="pt-6 first:pt-0">
      {/* Frage (Betreiber) — Verlaufs-Blase */}
      <div className="flex justify-end mb-3">
        <span className="max-w-[85%] rounded-[20px] rounded-br-md px-4 py-2.5 text-[14.5px] leading-snug text-white shadow-[0_6px_18px_-6px_rgba(124,58,237,0.6)]" style={{ background: GRAD }}>{turn.question}</span>
      </div>

      {/* Fehler (KI/DB/abgelehnt) — Zahlen bleiben ehrlich, kein Erfinden */}
      {turn.error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-[13px] text-amber-800">
          <p className="font-medium">{turn.error}</p>
          {res?.sql && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-amber-700">Vorschlag der KI ansehen</summary>
              <pre className="mt-1.5 whitespace-pre-wrap break-words text-[12px] bg-white/70 border border-amber-200 rounded-xl p-2.5">{res.sql}</pre>
            </details>
          )}
        </div>
      )}

      {/* Antwort */}
      {res?.ok && (
        <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-4">
          {res.explanation && <div className="text-[14.5px] leading-relaxed text-slate-700"><Markdown text={res.explanation} /></div>}
          {res.columns && res.rows && res.rows.length > 0 && (
            <ResultTable columns={res.columns} rows={res.rows} />
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3.5 text-[12.5px]">
            <span className="text-slate-400">
              {res.rowCount} {res.rowCount === 1 ? "Zeile" : "Zeilen"}
              {res.truncated ? ` · nur die ersten ${res.maxRows} gezeigt` : ""}
            </span>
            <button onClick={() => setShowSql((v) => !v)} className="font-semibold text-slate-500 hover:text-violet-700 transition-colors">
              {showSql ? "Abfrage verbergen" : "Abfrage anzeigen"}
            </button>
            <button onClick={copyAnswer} className="font-semibold text-slate-500 hover:text-violet-700 transition-colors">
              {copied ? "Kopiert!" : "Antwort kopieren"}
            </button>
          </div>
          {showSql && (
            <pre className="mt-2.5 whitespace-pre-wrap break-words text-[12px] text-slate-500 bg-white border border-slate-200 rounded-xl p-3.5">{res.sql}</pre>
          )}
        </div>
      )}
    </div>
  );
}

const COCKPIT_CSS = `
.cp-gradient-text{
  background:${GRAD}; background-size:200% auto;
  -webkit-background-clip:text; background-clip:text;
  -webkit-text-fill-color:transparent; color:transparent;
  animation:cpText 6s linear infinite;
}
@keyframes cpText{to{background-position:200% center}}
@keyframes cpFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

.cp-input-shell{position:relative;border-radius:24px;padding:2px;}
.cp-input-shell::before{
  content:"";position:absolute;inset:0;border-radius:inherit;padding:2px;pointer-events:none;
  background:linear-gradient(120deg,#4f46e5,#7c3aed,#db2777,#2563eb,#4f46e5);
  background-size:300% 300%;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
  animation:cpFlow 6s ease infinite;
}
.cp-input-shell::after{
  content:"";position:absolute;inset:-4px;border-radius:28px;z-index:-1;pointer-events:none;
  background:linear-gradient(120deg,#4f46e5,#7c3aed,#db2777,#2563eb);
  background-size:300% 300%;filter:blur(16px);opacity:.30;
  animation:cpFlow 6s ease infinite;transition:opacity .35s;
}
.cp-input-shell:focus-within::after{opacity:.72;}
.cp-input-shell.cp-busy::after{opacity:.8;}
.cp-input-inner{position:relative;z-index:1;display:flex;align-items:flex-end;gap:8px;background:#fff;border-radius:22px;padding:10px 10px 10px 16px;}

.cp-send{border-radius:16px;color:#fff;font-weight:700;font-size:14.5px;padding:0 22px;height:46px;min-width:92px;background:${GRAD};box-shadow:0 6px 18px -6px rgba(124,58,237,.55);transition:transform .15s,opacity .2s,box-shadow .2s;}
.cp-send:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 10px 24px -8px rgba(124,58,237,.7);}
.cp-send:disabled{opacity:.4;box-shadow:none;}

.cp-orb{width:72px;height:72px;border-radius:9999px;background:conic-gradient(from 0deg,#4f46e5,#7c3aed,#db2777,#2563eb,#4f46e5);box-shadow:0 0 48px -6px rgba(124,58,237,.6);animation:cpSpin 8s linear infinite;}
.cp-orb-core{position:absolute;inset:14px;border-radius:9999px;background:#fff;}
@keyframes cpSpin{to{transform:rotate(360deg)}}

.cp-dots{display:inline-flex;gap:5px;align-items:center;}
.cp-dots i{width:7px;height:7px;border-radius:9999px;background:linear-gradient(120deg,#7c3aed,#db2777);display:inline-block;animation:cpBounce 1s ease-in-out infinite;}
.cp-dots i:nth-child(2){animation-delay:.15s}
.cp-dots i:nth-child(3){animation-delay:.3s}
@keyframes cpBounce{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(-5px);opacity:1}}
`;

export default function Cockpit() {
  const [q, setQ] = useState("");
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Konversationen aus dem Browser laden (persistent über Reloads).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed) && parsed.length) {
          setConvos(parsed);
          setActiveId(parsed.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0].id);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Konversationen speichern (max. 50, damit der Speicher nicht vollläuft).
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(convos.slice(0, 50))); } catch { /* ignore */ }
  }, [convos]);

  const activeConv = convos.find((c) => c.id === activeId) || null;
  const turns = activeConv?.turns || [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns.length, busy, activeId]);

  // Textarea wächst mit dem Text (bis zu einer Grenze).
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [q]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    setBusy(true);
    const turnId = Date.now() + Math.random();
    const isNew = !(activeId && convos.some((c) => c.id === activeId));
    const convId = isNew ? `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : (activeId as string);
    setActiveId(convId);
    setConvos((prev) => {
      let list = [...prev];
      if (isNew) list = [{ id: convId, title: text.slice(0, 70), turns: [], updatedAt: Date.now() }, ...list];
      return list.map((c) => c.id === convId
        ? { ...c, title: c.turns.length ? c.title : text.slice(0, 70), turns: [...c.turns, { id: turnId, question: text, result: null }], updatedAt: Date.now() }
        : c);
    });
    try {
      const res = await fetch("/api/fiaon/admin/cockpit/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const json: AskResult = await res.json().catch(() => ({ ok: false, error: "Antwort nicht lesbar" } as AskResult));
      setConvos((prev) => prev.map((c) => c.id === convId
        ? { ...c, updatedAt: Date.now(), turns: c.turns.map((t) => t.id === turnId ? { ...t, result: json, error: json.ok ? undefined : (json.error || "Die Frage konnte nicht beantwortet werden.") } : t) }
        : c));
    } catch {
      setConvos((prev) => prev.map((c) => c.id === convId
        ? { ...c, turns: c.turns.map((t) => t.id === turnId ? { ...t, error: "Verbindung zur KI fehlgeschlagen. Der Rest des Dashboards funktioniert weiter." } : t) }
        : c));
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => { setActiveId(null); setQ(""); setShowHistory(false); };
  const openConv = (id: string) => { setActiveId(id); setShowHistory(false); };
  const deleteConv = (id: string) => {
    setConvos((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="mb-8">
      <style>{COCKPIT_CSS}</style>
      <div className="relative rounded-[28px] bg-white border border-slate-200/70 shadow-[0_20px_60px_-24px_rgba(79,70,229,0.28)] overflow-hidden">
        {/* Dekorativer Farbschimmer */}
        <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-56 w-[75%] rounded-full opacity-[0.18] blur-3xl" style={{ background: GRAD }} />

        {/* Kopf */}
        <div className="relative flex items-start gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight cp-gradient-text leading-tight">KI-Cockpit</h2>
            <p className="text-[13.5px] text-slate-500 mt-1">Frag dein Geschäft in normaler Sprache — echte Zahlen aus der Datenbank, mit sichtbarer Abfrage.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {turns.length > 0 && (
              <button onClick={newChat} className="px-4 py-2 rounded-full text-[12.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(124,58,237,0.6)] hover:opacity-90 transition" style={{ background: GRAD }}>Neuer Chat</button>
            )}
            {convos.length > 0 && (
              <button onClick={() => setShowHistory((v) => !v)} className={`px-4 py-2 rounded-full text-[12.5px] font-semibold border transition ${showHistory ? "border-violet-300 text-violet-700 bg-violet-50" : "border-slate-200 text-slate-600 bg-white hover:border-slate-300"}`}>Verlauf</button>
            )}
          </div>
        </div>

        {/* Verlauf gespeicherter Konversationen */}
        {showHistory && convos.length > 0 && (
          <div className="relative mx-6 mb-3 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-2 max-h-[280px] overflow-y-auto shadow-sm">
            {convos.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((c) => (
              <div key={c.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition ${c.id === activeId ? "bg-violet-50" : "hover:bg-slate-50"}`}>
                <button onClick={() => openConv(c.id)} className="flex-1 min-w-0 text-left">
                  <p className="text-[13.5px] font-medium text-slate-700 truncate">{c.title || "Neue Unterhaltung"}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{new Date(c.updatedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · {c.turns.length} Frage{c.turns.length === 1 ? "" : "n"}</p>
                </button>
                <button onClick={() => deleteConv(c.id)} className="text-[11.5px] font-semibold text-slate-300 hover:text-rose-500 transition shrink-0">Entfernen</button>
              </div>
            ))}
          </div>
        )}

        {/* Gesprächsbereich / Willkommens-Hero */}
        <div ref={scrollRef} className="relative px-6 overflow-y-auto" style={{ maxHeight: "58vh", minHeight: turns.length ? 260 : 320 }}>
          {turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="relative mb-6"><div className="cp-orb" /><div className="cp-orb-core" /></div>
              <h3 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight cp-gradient-text">Was möchtest du wissen?</h3>
              <p className="text-[14.5px] text-slate-500 mt-2.5 max-w-lg leading-relaxed">Stell eine Frage zu Kunden, Zahlungen, Provisionen oder Leads. Du bekommst echte Zahlen — inklusive der Abfrage, die dahintersteckt. Kundendaten gehen nie an die KI.</p>
              <div className="flex flex-wrap justify-center gap-2.5 mt-7 max-w-2xl">
                {CHIPS.map((c) => (
                  <button key={c} onClick={() => ask(c)} disabled={busy}
                    className="px-4 py-2.5 rounded-full text-[13.5px] font-medium text-slate-600 bg-white border border-slate-200 hover:border-violet-300 hover:text-violet-700 hover:shadow-[0_6px_16px_-8px_rgba(124,58,237,0.5)] transition disabled:opacity-50">
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {turns.map((t) => <TurnView key={t.id} turn={t} />)}
              {busy && (
                <div className="flex items-center gap-2.5 pt-6 text-[14px] text-slate-400">
                  <span className="cp-dots"><i /><i /><i /></span> Denkt nach, erzeugt eine geprüfte Abfrage …
                </div>
              )}
            </div>
          )}
        </div>

        {/* Eingabe mit leuchtendem Rand (mobil voll bedienbar) */}
        <div className="relative px-6 pb-6 pt-4">
          <div className={`cp-input-shell ${busy ? "cp-busy" : ""}`}>
            <div className="cp-input-inner">
              <textarea
                ref={taRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
                placeholder="Frag dein Geschäft … z. B. „Zeig mir alle Zahlungen von Terzi“"
                rows={1}
                className="flex-1 resize-none bg-transparent px-1 py-2 text-[15.5px] leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"
                style={{ maxHeight: 200 }}
              />
              <button onClick={() => ask(q)} disabled={busy || !q.trim()} className="cp-send">
                {busy ? "…" : "Fragen"}
              </button>
            </div>
          </div>
          <p className="text-[11.5px] text-slate-400 mt-2.5 text-center">Enter zum Senden · Shift + Enter für neue Zeile · Kundendaten gehen nie an die KI</p>
        </div>
      </div>
    </div>
  );
}
