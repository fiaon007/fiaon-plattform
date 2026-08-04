import { useState, useRef, useEffect } from "react";
import { Markdown } from "./AiKit";
import { ACCENT } from "./AdminShell";

// ═══════════════════════════════════════════════════════════════════════════
// Frag dein System — Frage in normaler Sprache → geprüfte, NUR-LESENDE SQL →
// echte Tabelle + Einordnung. Jede Antwort zeigt aufklappbar die verwendete
// Abfrage. Kundendaten gehen NIE an die KI, nur aggregierte Werte.
//
// Umbau 04.08.2026 — was vorher nicht ging:
//   · Ein vierfarbiger Verlauf (Indigo/Violett/Pink/Blau) und eine rotierende
//     Kugel. Nichts davon ist FIAON: das CI hat EINE Akzentfarbe, und die ist
//     für Primäraktionen reserviert. Ein Regenbogen-Kasten hat die Seite
//     dominiert, obwohl er das unwichtigste Element darauf ist.
//   · Der leere Zustand war 320px hoch — ein Drittel Bildschirm für „noch
//     nichts gefragt". Jetzt ist der Kasten so hoch wie sein Inhalt.
//   · Der Kasten stand ganz oben und schob die Tageszahlen unter die Falte.
//     Jetzt liegt er als Werkzeug unter den Zahlen, geschlossen bis man ihn
//     braucht.
// ═══════════════════════════════════════════════════════════════════════════

const LS_KEY = "fiaon_cockpit_convos_v1";

interface AskResult {
  ok: boolean; question: string; sql?: string; columns?: string[]; rows?: any[];
  rowCount?: number; truncated?: boolean; maxRows?: number;
  explanation?: string; error?: string; rejected?: boolean;
}
interface Turn { id: number; question: string; result: AskResult | null; error?: string }
interface Conversation { id: string; title: string; turns: Turn[]; updatedAt: number }

const VORSCHLAEGE = [
  "Wie ist der Stand heute?",
  "Welche Zahlungen sind offen?",
  "Umsatz pro Paket diesen Monat",
  "Beste Quellen nach Konversion",
];

function fmtCell(v: any): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("de-DE", { maximumFractionDigits: 2 });
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
  }
  return s;
}

/** Referenz-Spalten werden zu Links in die Kundenakte — eine Zahl, mit der man
 *  nichts anfangen kann, ist eine halbe Antwort. */
function Zelle({ col, value }: { col: string; value: any }) {
  const s = value == null ? "" : String(value);
  if (col.toLowerCase() === "ref" && /^FIAON-/i.test(s)) {
    return (
      <a href={`/admin/zahlungen?ref=${encodeURIComponent(s)}`}
        className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
        style={{ color: ACCENT }}>
        {s}
      </a>
    );
  }
  return <span>{fmtCell(value)}</span>;
}

/** Desktop: echte Tabelle (Kopf klebt oben, siehe admin-3d.css).
 *  Handy: jede Zeile als Kärtchen — eine 7-spaltige Tabelle auf 380px ist
 *  unlesbar, egal wie klein die Schrift wird. */
function Ergebnis({ columns, rows }: { columns: string[]; rows: any[] }) {
  return (
    <div className="mt-3">
      <div className="hidden sm:block overflow-x-auto rounded-xl border" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
        <table className="w-full text-left">
          <thead>
            <tr>{columns.map((c) => <th key={c} className="px-3 py-2">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 text-[13px] text-slate-700 whitespace-nowrap"><Zelle col={c} value={r[c]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sm:hidden space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="rounded-xl border bg-white p-3" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
            <dl className="grid grid-cols-[minmax(0,42%)_1fr] gap-x-3 gap-y-1">
              {columns.map((c) => (
                <div key={c} className="contents">
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 py-0.5 truncate">{c}</dt>
                  <dd className="text-[12.5px] text-slate-700 py-0.5 break-words a3-zahl"><Zelle col={c} value={r[c]} /></dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function Runde({ turn }: { turn: Turn }) {
  const [sqlOffen, setSqlOffen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const res = turn.result;

  const kopieren = () => {
    const teile = [`Frage: ${turn.question}`];
    if (res?.explanation) teile.push("", res.explanation);
    if (res?.sql) teile.push("", "Abfrage:", res.sql);
    navigator.clipboard?.writeText(teile.join("\n")).then(() => {
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    });
  };

  return (
    <div className="pt-4 first:pt-0">
      {/* Die eigene Frage: rechts, im Akzent — so wie in jedem Messenger, damit
          man Frage und Antwort ohne Nachdenken auseinanderhält. */}
      <div className="flex justify-end mb-2.5">
        <span
          className="max-w-[85%] rounded-2xl rounded-br-md px-3.5 py-2 text-[13.5px] leading-snug text-white"
          style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.6)" }}
        >
          {turn.question}
        </span>
      </div>

      {turn.error && (
        <div className="rounded-xl border px-3.5 py-2.5 text-[12.5px]"
          style={{ borderColor: "#fcd9b6", background: "rgba(217,119,6,.05)", color: "#92400e" }}>
          <p className="font-semibold">{turn.error}</p>
          {res?.sql && (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[12px] font-semibold">Vorschlag der KI ansehen</summary>
              <pre className="mt-1.5 whitespace-pre-wrap break-words text-[11.5px] bg-white/80 border rounded-lg p-2.5" style={{ borderColor: "#fcd9b6" }}>{res.sql}</pre>
            </details>
          )}
        </div>
      )}

      {res?.ok && (
        <div className="rounded-xl border px-3.5 py-3" style={{ borderColor: "var(--a3-linie,#e4e9f2)", background: "#fbfcfe" }}>
          {res.explanation && (
            <div className="text-[13.5px] leading-relaxed text-slate-700"><Markdown text={res.explanation} /></div>
          )}
          {res.columns && res.rows && res.rows.length > 0 && <Ergebnis columns={res.columns} rows={res.rows} />}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[12px]">
            <span className="text-slate-400 a3-zahl">
              {res.rowCount} {res.rowCount === 1 ? "Zeile" : "Zeilen"}
              {res.truncated ? ` · nur die ersten ${res.maxRows} gezeigt` : ""}
            </span>
            <button type="button" onClick={() => setSqlOffen((v) => !v)} className="font-semibold text-slate-500 hover:text-slate-800">
              {sqlOffen ? "Abfrage verbergen" : "Abfrage anzeigen"}
            </button>
            <button type="button" onClick={kopieren} className="font-semibold text-slate-500 hover:text-slate-800">
              {kopiert ? "Kopiert" : "Antwort kopieren"}
            </button>
          </div>
          {sqlOffen && (
            <pre className="mt-2 whitespace-pre-wrap break-words text-[11.5px] text-slate-500 bg-white border rounded-lg p-3"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>{res.sql}</pre>
          )}
        </div>
      )}
    </div>
  );
}

const CSS = `
.ki-punkte{display:inline-flex;gap:4px;align-items:center}
.ki-punkte i{width:6px;height:6px;border-radius:9999px;background:${ACCENT};display:inline-block;animation:kiHuepf 1s ease-in-out infinite}
.ki-punkte i:nth-child(2){animation-delay:.15s}
.ki-punkte i:nth-child(3){animation-delay:.3s}
@keyframes kiHuepf{0%,100%{transform:translateY(0);opacity:.35}50%{transform:translateY(-4px);opacity:1}}
@media (prefers-reduced-motion: reduce){.ki-punkte i{animation:none}}
`;

export default function Cockpit() {
  const [offen, setOffen] = useState(false);
  const [q, setQ] = useState("");
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verlaufOffen, setVerlaufOffen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

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
    } catch { /* Ein defekter Speicher darf das Dashboard nicht aufhalten. */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(convos.slice(0, 50))); } catch { /* voll oder gesperrt */ }
  }, [convos]);

  const conv = convos.find((c) => c.id === activeId) || null;
  const turns = conv?.turns || [];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [turns.length, busy, activeId]);

  // Eingabefeld wächst mit dem Text — eine einzeilige Zeile für eine
  // dreizeilige Frage zwingt zum Blindtippen.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [q, offen]);

  const fragen = async (frage: string) => {
    const text = frage.trim();
    if (!text || busy) return;
    setQ("");
    setBusy(true);
    setOffen(true);
    const turnId = Date.now() + Math.random();
    const neu = !(activeId && convos.some((c) => c.id === activeId));
    const convId = neu ? `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : (activeId as string);
    setActiveId(convId);
    setConvos((prev) => {
      let list = [...prev];
      if (neu) list = [{ id: convId, title: text.slice(0, 70), turns: [], updatedAt: Date.now() }, ...list];
      return list.map((c) => c.id === convId
        ? { ...c, title: c.turns.length ? c.title : text.slice(0, 70), turns: [...c.turns, { id: turnId, question: text, result: null }], updatedAt: Date.now() }
        : c);
    });
    try {
      const res = await fetch("/api/fiaon/admin/cockpit/ask", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const json: AskResult = await res.json().catch(() => ({ ok: false, error: "Antwort nicht lesbar" } as AskResult));
      setConvos((prev) => prev.map((c) => c.id === convId
        ? { ...c, updatedAt: Date.now(), turns: c.turns.map((t) => t.id === turnId ? { ...t, result: json, error: json.ok ? undefined : (json.error || "Die Frage konnte nicht beantwortet werden.") } : t) }
        : c));
    } catch {
      setConvos((prev) => prev.map((c) => c.id === convId
        ? { ...c, turns: c.turns.map((t) => t.id === turnId ? { ...t, error: "Keine Verbindung zur KI. Der Rest des Dashboards funktioniert weiter." } : t) }
        : c));
    } finally {
      setBusy(false);
    }
  };

  const neuerChat = () => { setActiveId(null); setQ(""); setVerlaufOffen(false); };

  return (
    <section className="a3-tafel">
      <style>{CSS}</style>

      {/* Kopf — zugeklappt ein Knopf, aufgeklappt eine Werkzeugleiste. */}
      <header className="a3-tafel-kopf">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)", color: ACCENT }}>
          {/* Kein Icon-Zoo: zwei Striche und ein Punkt genügen als Zeichen für
              „Frage an die Datenbank“. */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h10M4 17h6" />
            <circle cx="18" cy="17" r="2.2" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-slate-900">Frag dein System</h2>
          <p className="hidden sm:block text-[11.5px] text-slate-500 leading-tight">
            Frage in normaler Sprache — echte Zahlen, mit Abfrage zum Nachsehen. Kundendaten gehen nie an die KI.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {offen && turns.length > 0 && (
            <button type="button" onClick={neuerChat}
              className="px-2.5 py-1.5 rounded-lg border bg-white text-[11.5px] font-semibold text-slate-600"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
              Neu
            </button>
          )}
          {offen && convos.length > 0 && (
            <button type="button" onClick={() => setVerlaufOffen((v) => !v)}
              className="px-2.5 py-1.5 rounded-lg border bg-white text-[11.5px] font-semibold text-slate-600"
              style={{ borderColor: verlaufOffen ? ACCENT : "var(--a3-linie,#e4e9f2)", color: verlaufOffen ? ACCENT : undefined }}>
              Verlauf
            </button>
          )}
          <button type="button" onClick={() => setOffen((v) => !v)}
            className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold"
            style={offen
              ? { border: "1px solid var(--a3-linie,#e4e9f2)", background: "#fff", color: "#64748b" }
              : { background: ACCENT, color: "#fff", boxShadow: "0 4px 12px -4px rgba(29,78,216,.55)" }}>
            {offen ? "Schließen" : "Frage stellen"}
          </button>
        </div>
      </header>

      {offen && (
        <div className="p-3.5 sm:p-4">
          {verlaufOffen && convos.length > 0 && (
            <div className="mb-3 rounded-xl border bg-white p-1.5 max-h-[220px] overflow-y-auto" style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
              {convos.slice().sort((a, b) => b.updatedAt - a.updatedAt).map((c) => (
                <div key={c.id} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 ${c.id === activeId ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                  <button type="button" onClick={() => { setActiveId(c.id); setVerlaufOffen(false); }} className="flex-1 min-w-0 text-left">
                    <p className="text-[12.5px] font-medium text-slate-700 truncate">{c.title || "Neue Unterhaltung"}</p>
                    <p className="text-[10.5px] text-slate-400">
                      {new Date(c.updatedAt).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · {c.turns.length} Frage{c.turns.length === 1 ? "" : "n"}
                    </p>
                  </button>
                  <button type="button"
                    onClick={() => { setConvos((prev) => prev.filter((x) => x.id !== c.id)); if (activeId === c.id) setActiveId(null); }}
                    className="text-[11px] font-semibold text-slate-300 hover:text-red-500 shrink-0">
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Gespräch — nur so hoch wie nötig, höchstens halber Bildschirm. */}
          {turns.length > 0 && (
            <div ref={scrollRef} className="overflow-y-auto mb-3" style={{ maxHeight: "50vh" }}>
              {turns.map((t) => <Runde key={t.id} turn={t} />)}
              {busy && (
                <div className="flex items-center gap-2 pt-3 text-[12.5px] text-slate-400">
                  <span className="ki-punkte"><i /><i /><i /></span> denkt nach …
                </div>
              )}
            </div>
          )}

          {/* Eingabe */}
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void fragen(q); }
              }}
              rows={1}
              placeholder="Zum Beispiel: Wie viele Kunden haben diesen Monat bezahlt?"
              className="flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-[13.5px] outline-none bg-white"
              style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}
            />
            <button
              type="button"
              onClick={() => void fragen(q)}
              disabled={busy || !q.trim()}
              className="shrink-0 h-[42px] px-4 rounded-xl text-[13px] font-bold text-white disabled:opacity-40"
              style={{ background: `linear-gradient(180deg,${ACCENT},#1e40af)`, boxShadow: "0 4px 14px -6px rgba(29,78,216,.6)" }}
            >
              Fragen
            </button>
          </div>

          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {VORSCHLAEGE.map((v) => (
                <button key={v} type="button" onClick={() => void fragen(v)}
                  className="px-2.5 py-1.5 rounded-lg border bg-white text-[12px] text-slate-600 hover:text-slate-900"
                  style={{ borderColor: "var(--a3-linie,#e4e9f2)" }}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
