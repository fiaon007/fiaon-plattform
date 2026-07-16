import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Send, ChevronDown, Copy as CopyIcon, Check, Code2, AlertTriangle, History, ExternalLink } from "lucide-react";
import { ACCENT } from "./AdminShell";
import { Markdown } from "./AiKit";

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
      <a href={`/admin/zahlungen?ref=${encodeURIComponent(s)}`} className="inline-flex items-center gap-1 font-medium hover:underline" style={{ color: ACCENT }}>
        {s} <ExternalLink size={11} />
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
    <div className="border-t border-slate-100 pt-3 first:border-0 first:pt-0">
      {/* Frage (Betreiber) */}
      <div className="flex justify-end mb-2">
        <span className="max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] text-white" style={{ background: ACCENT }}>{turn.question}</span>
      </div>

      {/* Fehler (KI/DB/abgelehnt) — Zahlen bleiben ehrlich, kein Erfinden */}
      {turn.error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-800 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p>{turn.error}</p>
            {res?.sql && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[11.5px] font-semibold text-amber-700">Vorschlag der KI ansehen</summary>
                <pre className="mt-1 whitespace-pre-wrap break-words text-[11.5px] bg-white/60 border border-amber-200 rounded-lg p-2">{res.sql}</pre>
              </details>
            )}
          </div>
        </div>
      )}

      {/* Antwort */}
      {res?.ok && (
        <div>
          {res.explanation && <Markdown text={res.explanation} />}
          {res.columns && res.rows && res.rows.length > 0 && (
            <ResultTable columns={res.columns} rows={res.rows} />
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span className="text-[11px] text-slate-400">
              {res.rowCount} {res.rowCount === 1 ? "Zeile" : "Zeilen"}
              {res.truncated ? ` (nur die ersten ${res.maxRows} gezeigt)` : ""}
            </span>
            <button onClick={() => setShowSql((v) => !v)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-800">
              <Code2 size={12} /> {showSql ? "Abfrage verbergen" : "Abfrage anzeigen"}
            </button>
            <button onClick={copyAnswer} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-800">
              {copied ? <Check size={12} /> : <CopyIcon size={12} />} {copied ? "Kopiert" : "Antwort kopieren"}
            </button>
          </div>
          {showSql && (
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11.5px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">{res.sql}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function Cockpit() {
  const [q, setQ] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const loadHistory = useCallback(() => {
    fetch("/api/fiaon/admin/cockpit/history", { credentials: "include" })
      .then((r) => r.json()).then((j) => {
        if (j?.ok) {
          const seen = new Set<string>();
          const qs: string[] = [];
          for (const h of j.history as any[]) {
            const t = String(h.question || "").trim();
            if (t && !seen.has(t)) { seen.add(t); qs.push(t); }
            if (qs.length >= 12) break;
          }
          setHistory(qs);
        }
      }).catch(() => {});
  }, []);
  useEffect(loadHistory, [loadHistory]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns, busy]);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setQ("");
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question: text, result: null }]);
    setBusy(true);
    try {
      const res = await fetch("/api/fiaon/admin/cockpit/ask", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const json: AskResult = await res.json().catch(() => ({ ok: false, error: "Antwort nicht lesbar" } as AskResult));
      setTurns((t) => t.map((x) => x.id === id ? {
        ...x,
        result: json,
        error: json.ok ? undefined : (json.error || "Die Frage konnte nicht beantwortet werden."),
      } : x));
      loadHistory();
    } catch {
      setTurns((t) => t.map((x) => x.id === id ? { ...x, error: "Verbindung zur KI fehlgeschlagen. Der Rest des Dashboards funktioniert weiter." } : x));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 bg-white border border-slate-200 rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04)] overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: ACCENT }}>
          <Sparkles size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-slate-900">KI-Cockpit</p>
          <p className="text-[11px] text-slate-400 leading-tight">Frag dein Geschäft in normaler Sprache — echte Zahlen aus der Datenbank, mit sichtbarer Abfrage.</p>
        </div>
        {history.length > 0 && (
          <button onClick={() => setShowHistory((v) => !v)} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-500 hover:text-slate-800 shrink-0">
            <History size={13} /> Verlauf
          </button>
        )}
      </div>

      {/* Verlauf der letzten Fragen (aus dem Audit-Log) */}
      {showHistory && history.length > 0 && (
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap gap-1.5">
          {history.map((h, i) => (
            <button key={i} onClick={() => ask(h)} disabled={busy}
              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[11.5px] text-slate-600 hover:border-slate-300 disabled:opacity-50 truncate max-w-full">
              {h}
            </button>
          ))}
        </div>
      )}

      {/* Ergebnisse (scrollbar) */}
      {turns.length > 0 && (
        <div ref={scrollRef} className="px-4 py-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {turns.map((t) => <TurnView key={t.id} turn={t} />)}
          {busy && (
            <div className="flex items-center gap-2 text-[12.5px] text-slate-400">
              <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" />
              Denkt nach, erzeugt eine geprüfte Abfrage …
            </div>
          )}
        </div>
      )}

      {/* Starter-Chips (nur solange leer) */}
      {turns.length === 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button key={c} onClick={() => ask(c)} disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 hover:border-slate-300 transition-colors disabled:opacity-50">
              {c}
            </button>
          ))}
        </div>
      )}

      {/* Eingabe unten (mobil voll bedienbar) */}
      <div className="p-3 flex items-end gap-2">
        <textarea
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          placeholder="z. B. „Zeig mir alle Zahlungen von Terzi“ oder „Wie viele bezahlt diesen Monat?“"
          rows={1}
          className="flex-1 resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-slate-400 placeholder:text-slate-400 min-h-[44px]"
        />
        <button onClick={() => ask(q)} disabled={busy || !q.trim()}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-4 text-[13px] font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ background: ACCENT, minHeight: 44 }}>
          <Send size={14} /> Fragen
        </button>
      </div>
    </div>
  );
}
