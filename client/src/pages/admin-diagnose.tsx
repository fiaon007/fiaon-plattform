import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, AlertTriangle, AlertCircle, Info, RefreshCw, Download, Trash2,
  Sparkles, Terminal, ExternalLink, ChevronDown, Copy, Check,
} from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";
import { AiButton, Markdown } from "@/components/admin/AiKit";

// ═══════════════════════════════════════════════════════════════════
// /admin/diagnose — System-Diagnose (Phase 5).
// PRIMÄR: strukturierte Ereignis-/Problem-Konsole (Tab „Konsole").
// SEKUNDÄR: Roh-Log-Tail (Tab „Rohdaten") für Tiefenanalyse.
//
// DESIGN (P5-E): Header/Nav/Buttons bleiben im hellen Admin-CI; NUR die
// Konsolen-Fläche ist Matrix-/Terminal-Optik (dunkel, Monospace, farbcodierte
// Schweregrade). Kein Zeichenregen, keine Emojis. Mobil umbrechend.
//
// SICHERHEIT (P5-B): Maskierung passiert SERVERSEITIG — hier wird nur
// angezeigt, was der Server bereits redigiert hat.
// ═══════════════════════════════════════════════════════════════════

type Severity = "kritisch" | "warnung" | "info";

interface DiagEvent {
  synthetic: boolean;
  id: string;
  severity: Severity;
  category: string;
  code: string;
  message: string;
  hint?: string;
  link?: string;
  action?: { kind: string; label: string; ref?: string } | null;
  count: number;
  at: string;
  firstSeen?: string;
  lastSeen?: string;
}

const SEV_META: Record<Severity, { label: string; dot: string; text: string; border: string }> = {
  kritisch: { label: "KRITISCH", dot: "bg-rose-500", text: "text-rose-300", border: "border-l-rose-500" },
  warnung: { label: "WARNUNG", dot: "bg-amber-400", text: "text-amber-300", border: "border-l-amber-400" },
  info: { label: "INFO", dot: "bg-sky-400", text: "text-sky-300", border: "border-l-sky-400" },
};

const CAT_LABEL: Record<string, string> = {
  email_make: "E-Mail/Make", lead: "Lead-Eingang", zahlung: "Zahlungen",
  agent: "Agenten", kunde: "Kunden", system: "System",
};

const RANGES: { key: string; label: string; hours: number }[] = [
  { key: "24h", label: "24 Stunden", hours: 24 },
  { key: "7d", label: "7 Tage", hours: 168 },
  { key: "1h", label: "1 Stunde", hours: 1 },
];

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export default function AdminDiagnosePage() {
  const [tab, setTab] = useState<"konsole" | "rohdaten">("konsole");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageIntro
        id="diagnose"
        title="System-Diagnose"
        subtitle="Hier siehst du, was im System gerade klemmt — technisch, bei Kunden, bei Agenten — bevor jemand ein Ticket schreibt."
        steps={[
          "Der Tab „Konsole“ ist die Hauptansicht: jedes Problem in Klartext mit Schweregrad, Zeit, Bedeutung, Lösungshinweis und — wo möglich — Direktlink oder Aktion.",
          "Standard sind kritische + Warnungen der letzten 24 Stunden. Über die Filter kannst du Schweregrad, Kategorie, Zeitraum und Freitext eingrenzen.",
          "Gleiche Fehler werden gebündelt („23× …“) — die Zahl zeigt, wie oft es auftrat. Kritische Ereignisse erscheinen zusätzlich als Warnung auf dem Dashboard.",
          "„Probleme zusammenfassen“ lässt die KI in Klartext sagen: was ist kaputt, was wiederholt sich, wahrscheinliche Ursache, Reihenfolge der Behebung — nur maskierte, aggregierte Daten.",
          "Der Tab „Rohdaten“ ist der Roh-Log-Auszug für die Tiefenanalyse (begrenzt, maskiert, durchsuchbar, als Datei ladbar).",
          "Alle Daten sind serverseitig maskiert (Keys, Tokens, IBANs, E-Mails, Telefonnummern) und werden nach 7 Tagen automatisch gelöscht.",
        ]}
      />

      {/* Tab-Umschalter (im hellen CI) */}
      <div className="flex gap-1 mb-4 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        <button onClick={() => setTab("konsole")}
          className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors ${tab === "konsole" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
          <Activity size={13} /> Konsole
        </button>
        <button onClick={() => setTab("rohdaten")}
          className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors ${tab === "rohdaten" ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"}`}>
          <Terminal size={13} /> Rohdaten
        </button>
      </div>

      {tab === "konsole" ? <ConsoleTab /> : <RawTab />}
    </div>
  );
}

// ═══════════════ KONSOLE (strukturierte Ereignisse) ═══════════════
function ConsoleTab() {
  const [events, setEvents] = useState<DiagEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [sev, setSev] = useState<Severity[]>(["kritisch", "warnung"]);
  const [cats, setCats] = useState<string[]>([]);
  const [range, setRange] = useState("24h");
  const [q, setQ] = useState("");
  const [ai, setAi] = useState<{ text: string; provider: string; at: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const qTimer = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(qTimer.current);
  }, [q]);

  const rangeHours = RANGES.find((r) => r.key === range)?.hours || 24;
  const load = useCallback(() => {
    const from = new Date(Date.now() - rangeHours * 3600_000).toISOString();
    const params = new URLSearchParams({ from, to: new Date().toISOString() });
    if (sev.length) params.set("severity", sev.join(","));
    if (cats.length) params.set("category", cats.join(","));
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/fiaon/admin/diagnose/events?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) { setEvents(j.events || []); setCounts(j.counts || {}); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [rangeHours, sev, cats, debouncedQ]);

  // Live: Polling alle 8 s (kein Realtime-Stack).
  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const toggleSev = (s: Severity) => setSev((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);
  const toggleCat = (c: string) => setCats((cur) => cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]);

  const runAi = async () => {
    setAiBusy(true); setAiError(null);
    try {
      const from = new Date(Date.now() - rangeHours * 3600_000).toISOString();
      const r = await fetch("/api/fiaon/admin/diagnose/ai", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: new Date().toISOString() }),
      });
      const j = await r.json();
      if (j?.ok) setAi(j.summary); else setAiError(j?.error || "KI-Auswertung fehlgeschlagen");
    } catch { setAiError("Verbindung zur KI fehlgeschlagen."); }
    finally { setAiBusy(false); }
  };

  const doAction = async (e: DiagEvent) => {
    if (!e.action) return;
    if (e.action.kind === "release_akte" && e.action.ref) {
      if (!confirm("Diese Lead-Akte wirklich freigeben? Der Lead geht zurück in die Warteschlange.")) return;
      const r = await fetch(`/api/fiaon/admin/leads/${e.action.ref}/release-akte`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      setFlash(r.ok && j?.ok ? `Akte freigegeben (war offen bei ${j.releasedFrom}).` : (j?.error || "Freigabe fehlgeschlagen."));
      setTimeout(() => setFlash(null), 5000);
      load();
    } else if (e.action.kind === "resend_event" && e.action.ref) {
      window.location.href = `/admin/events?ref=${encodeURIComponent(e.action.ref)}`;
    }
  };

  const purge = async () => {
    if (!confirm("Alle gespeicherten Diagnose-Ereignisse jetzt löschen? (Live-Signale bleiben, da sie laufend neu berechnet werden.)")) return;
    const r = await fetch("/api/fiaon/admin/diagnose/purge", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
    });
    const j = await r.json().catch(() => null);
    setFlash(r.ok && j?.ok ? `${j.deleted} Ereignis(se) gelöscht.` : "Löschen fehlgeschlagen.");
    setTimeout(() => setFlash(null), 5000);
    load();
  };

  const exportUrl = () => {
    const from = new Date(Date.now() - rangeHours * 3600_000).toISOString();
    return `/api/fiaon/admin/diagnose/export?from=${encodeURIComponent(from)}&to=${encodeURIComponent(new Date().toISOString())}`;
  };

  return (
    <>
      {/* Steuerleiste (helles CI) */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(["kritisch", "warnung", "info"] as Severity[]).map((s) => (
          <button key={s} onClick={() => toggleSev(s)}
            className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border inline-flex items-center gap-1.5 transition-colors ${sev.includes(s) ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${SEV_META[s].dot}`} />
            {SEV_META[s].label}<span className="tabular-nums opacity-70">{counts[s] ? ` ${counts[s]}` : ""}</span>
          </button>
        ))}
        <span className="w-px h-5 bg-slate-200 mx-1" />
        <select value={range} onChange={(e) => setRange(e.target.value)}
          className="px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border border-slate-200 text-slate-600 bg-white">
          {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Freitext filtern …"
          className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] outline-none focus:border-slate-400" />
        <button onClick={load} title="Aktualisieren"
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300"><RefreshCw size={13} /></button>
      </div>

      {/* Kategorie-Filter */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(CAT_LABEL).map(([k, label]) => (
          <button key={k} onClick={() => toggleCat(k)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${cats.includes(k) ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
            {label}
          </button>
        ))}
        {cats.length > 0 && <button onClick={() => setCats([])} className="px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600">zurücksetzen</button>}
      </div>

      {/* Aktions-Leiste */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <AiButton onClick={runAi} busy={aiBusy}>Probleme zusammenfassen</AiButton>
        <a href={exportUrl()} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:border-slate-300">
          <Download size={13} /> Export
        </a>
        <button onClick={purge} className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-[12.5px] font-semibold inline-flex items-center gap-1.5 hover:border-rose-300 hover:text-rose-600">
          <Trash2 size={13} /> Gespeicherte löschen
        </button>
      </div>

      {flash && <div className="mb-3 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-[13px] text-slate-700">{flash}</div>}

      {ai && <AiPanel ai={ai} onClose={() => setAi(null)} />}
      {aiError && <div className="mb-4 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-[13px] text-amber-800">{aiError}</div>}

      {/* ═══ KONSOLEN-FLÄCHE (dunkel, Monospace — nur hier) ═══ */}
      <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] overflow-hidden shadow-inner">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 bg-[#0e131d]">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-[11px] font-mono text-slate-500">fiaon@diagnose — live (aktualisiert alle 8 s)</span>
          <span className="ml-auto text-[11px] font-mono text-slate-600 tabular-nums">{events.length} Ereignis(se)</span>
        </div>
        <div className="divide-y divide-slate-800/70 max-h-[60vh] overflow-y-auto">
          {loading && events.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] font-mono text-slate-500">Lädt …</p>
          ) : events.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] font-mono text-emerald-400/80">Keine Probleme im gewählten Filter. System läuft sauber.</p>
          ) : (
            events.map((e) => <EventRow key={e.id} e={e} onAction={doAction} />)
          )}
        </div>
      </div>
    </>
  );
}

function EventRow({ e, onAction }: { e: DiagEvent; onAction: (e: DiagEvent) => void }) {
  const [open, setOpen] = useState(false);
  const m = SEV_META[e.severity];
  return (
    <div className={`border-l-2 ${m.border} px-4 py-3 hover:bg-white/[0.02]`}>
      <div className="flex items-start gap-3 font-mono">
        <span className={`shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${m.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className={`font-bold ${m.text}`}>{m.label}</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400">{CAT_LABEL[e.category] || e.category}</span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-500 tabular-nums">{fmtTime(e.at)}</span>
            {e.count > 1 && <span className="px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-200 text-[10px] font-bold tabular-nums">{e.count}×</span>}
            {e.synthetic && <span className="px-1.5 py-0.5 rounded bg-sky-900/50 text-sky-300 text-[10px] font-semibold">live</span>}
            <span className="text-slate-600 text-[10px]">{e.code}</span>
          </div>
          {/* Klartext — umbrechend, nicht horizontal scrollend */}
          <p className="text-[13px] text-slate-100 leading-relaxed mt-1 break-words whitespace-pre-wrap">{e.message}</p>
          {e.hint && (
            <button onClick={() => setOpen((v) => !v)} className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-slate-400 hover:text-slate-200">
              <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} /> Lösungshinweis
            </button>
          )}
          {open && e.hint && <p className="text-[12px] text-slate-400 leading-relaxed mt-1 break-words">{e.hint}</p>}
          {e.count > 1 && e.firstSeen && (
            <p className="text-[10.5px] text-slate-600 mt-1 tabular-nums">zuerst {fmtTime(e.firstSeen)} · zuletzt {fmtTime(e.lastSeen || e.at)}</p>
          )}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {e.action && (
            <button onClick={() => onAction(e)}
              className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-semibold hover:bg-white whitespace-nowrap">
              {e.action.label}
            </button>
          )}
          {e.link && (
            <a href={e.link} className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300 text-[11px] font-semibold hover:border-slate-500 inline-flex items-center gap-1 whitespace-nowrap">
              Öffnen <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function AiPanel({ ai, onClose }: { ai: { text: string; provider: string; at: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(ai.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  return (
    <div className="mb-4 bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-[#2563eb]" />
        <span className="text-[12.5px] font-bold text-slate-800">KI-Auswertung</span>
        <span className="text-[11px] text-slate-400">{ai.provider} · {fmtTime(ai.at)}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={copy} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-500 text-[11px] font-semibold inline-flex items-center gap-1 hover:border-slate-300">
            {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Kopiert" : "Kopieren"}
          </button>
          <button onClick={onClose} className="px-2 py-1 rounded-lg border border-slate-200 text-slate-400 text-[11px] hover:border-slate-300">schließen</button>
        </div>
      </div>
      <Markdown text={ai.text} />
    </div>
  );
}

// ═══════════════ ROHDATEN (Ring-Puffer-Tail) ═══════════════
function RawTab() {
  const [data, setData] = useState<{ lines: { at: string; level: string; text: string }[]; totalLines: number; totalBytes: number; maxLines: number; maxBytes: number } | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const qTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(qTimer.current);
    qTimer.current = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(qTimer.current);
  }, [q]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/fiaon/admin/diagnose/raw?${params}`, { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setData(j); }).catch(() => {});
  }, [debouncedQ]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const levelColor = (lvl: string) => lvl === "error" || lvl === "kritisch" ? "text-rose-300" : lvl === "warn" || lvl === "warnung" ? "text-amber-300" : "text-slate-400";
  const bytePct = data ? Math.min(100, Math.round((data.totalBytes / data.maxBytes) * 100)) : 0;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rohdaten durchsuchen …"
          className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] outline-none focus:border-slate-400" />
        <a href={`/api/fiaon/admin/diagnose/raw?download=1${debouncedQ ? `&q=${encodeURIComponent(debouncedQ)}` : ""}`}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-[12px] font-semibold inline-flex items-center gap-1.5 hover:border-slate-300">
          <Download size={13} /> Herunterladen
        </a>
        <button onClick={load} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300"><RefreshCw size={13} /></button>
      </div>

      {/* Speicher-Auslastung des Ring-Puffers (512-MB-Budget sichtbar) */}
      {data && (
        <div className="flex items-center gap-3 mb-3 text-[11px] text-slate-500">
          <span className="tabular-nums">{data.totalLines}/{data.maxLines} Zeilen</span>
          <span className="tabular-nums">{bytesLabel(data.totalBytes)} / {bytesLabel(data.maxBytes)}</span>
          <div className="flex-1 max-w-[220px] h-1.5 rounded-full bg-slate-200 overflow-hidden">
            <div className={`h-full ${bytePct > 85 ? "bg-amber-400" : "bg-slate-400"}`} style={{ width: `${bytePct}%` }} />
          </div>
          <span className="text-slate-400">Ring-Puffer (hart begrenzt, maskiert)</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-[#0b0f17] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 bg-[#0e131d]">
          <Terminal size={13} className="text-slate-500" />
          <span className="text-[11px] font-mono text-slate-500">fiaon@diagnose:~/logs — tail (neueste zuerst)</span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto px-3 py-2 font-mono text-[11.5px] leading-relaxed">
          {!data ? (
            <p className="px-1 py-6 text-center text-slate-500">Lädt …</p>
          ) : data.lines.length === 0 ? (
            <p className="px-1 py-6 text-center text-slate-500">Keine Rohdaten{debouncedQ ? " für diesen Filter" : " im Puffer"}.</p>
          ) : (
            data.lines.map((l, i) => (
              <div key={i} className="py-0.5 flex gap-2 break-words whitespace-pre-wrap">
                <span className="shrink-0 text-slate-600 tabular-nums">{fmtTime(l.at)}</span>
                <span className={`shrink-0 uppercase text-[10px] font-bold ${levelColor(l.level)}`}>{l.level}</span>
                <span className="text-slate-300 break-all">{l.text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
