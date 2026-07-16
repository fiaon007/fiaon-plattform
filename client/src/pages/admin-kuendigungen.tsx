import { useState, useEffect, useCallback } from "react";
import { RefreshCw, LogOut, Check, X, Mail, Phone, Cake, Calendar, FileText } from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// /admin/kuendigungen — Kündigungsanträge bearbeiten (P3-B).
// Zuvor nur in der versteckten /admin/database-Sidebar erreichbar; jetzt
// eigener Nav-Punkt. Echter FIAON-Workflow über /api/fiaon/admin/cancellations.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";
type Filter = "pending" | "confirmed" | "rejected" | "all";
type Cancellation = {
  id: number; ref: string | null; first_name: string | null; last_name: string | null;
  email: string | null; phone: string | null; package_name: string | null;
  reason: string | null; cancellation_date: string | null; status: string;
  admin_note: string | null; created_at: string; processed_at: string | null;
};

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATUS_LABEL: Record<string, string> = { pending: "Ausstehend", confirmed: "Bestätigt", rejected: "Abgelehnt" };

function fmtDate(d: string | null): string {
  return d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "—";
}

export default function AdminKuendigungen() {
  const [items, setItems] = useState<Cancellation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [selected, setSelected] = useState<Cancellation | null>(null);
  const [note, setNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [flash, setFlash] = useState<{ text: string; kind: "ok" | "err" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { ok, json } = await apiF("/admin/cancellations");
    if (ok) setItems(json.rows || json.cancellations || json.data || []);
    else setFlash({ text: "Konnte Kündigungen nicht laden", kind: "err" });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 4000); return () => clearTimeout(t); }, [flash]);

  const act = async (status: "confirmed" | "rejected") => {
    if (!selected) return;
    setActionBusy(true);
    const { ok, json } = await apiF(`/admin/cancellations/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status, adminNote: note.trim() || null }),
    });
    if (ok) {
      setFlash({ text: status === "confirmed" ? "Kündigung bestätigt" : "Kündigung abgelehnt", kind: "ok" });
      setSelected(null); setNote("");
      await load();
    } else setFlash({ text: `Fehler: ${json?.error || "Unbekannt"}`, kind: "err" });
    setActionBusy(false);
  };

  const filtered = items.filter((c) => filter === "all" || c.status === filter);
  const count = (f: Filter) => items.filter((c) => f === "all" || c.status === f).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <LogOut size={20} className="text-slate-400" />
        <h1 className="text-[19px] font-bold text-slate-900 flex-1 min-w-0">Kündigungen</h1>
        <button onClick={load} disabled={loading}
          className="px-3 py-2 min-h-[38px] rounded-lg border border-slate-200 text-[12.5px] font-semibold text-slate-600 inline-flex items-center gap-1.5 hover:border-slate-300 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Aktualisieren
        </button>
      </div>
      <p className="text-[13px] text-slate-500 mb-4 max-w-3xl">
        Eingehende Kündigungsanträge der Kunden prüfen, bestätigen oder ablehnen. Jede Entscheidung wird protokolliert.
      </p>

      {flash && (
        <div className={`mb-4 px-3.5 py-2.5 rounded-lg text-[13px] ${flash.kind === "ok" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
          {flash.text}
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["pending", "confirmed", "rejected", "all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-semibold border inline-flex items-center gap-2 ${filter === f ? "text-white border-transparent" : "text-slate-600 border-slate-200 hover:border-slate-300"}`}
            style={filter === f ? { background: ACCENT } : {}}>
            {f === "pending" ? "Ausstehend" : f === "confirmed" ? "Bestätigt" : f === "rejected" ? "Abgelehnt" : "Alle"}
            <span className={`px-1.5 py-0.5 rounded text-[11px] ${filter === f ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{count(f)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-[13px] text-slate-400">Lädt…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Check size={26} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-[14px] font-semibold text-slate-800">Keine Kündigungsanträge</p>
          <p className="text-[12.5px] text-slate-500 mt-1">In dieser Ansicht liegt nichts vor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => { setSelected(c); setNote(c.admin_note || ""); }}
              className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-slate-900 truncate">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE[c.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{STATUS_LABEL[c.status] || c.status}</span>
                </div>
                <div className="text-[11.5px] text-slate-500 flex flex-wrap gap-x-3 mt-0.5">
                  {c.email && <span className="inline-flex items-center gap-1"><Mail size={11} />{c.email}</span>}
                  {c.package_name && <span>{c.package_name}</span>}
                  {c.ref && <span className="font-mono">{c.ref}</span>}
                </div>
              </div>
              <span className="text-[11.5px] text-slate-400">{fmtDate(c.created_at)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Detail-Overlay */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 sticky top-0 bg-white">
              <h2 className="text-[15px] font-bold text-slate-900">Kündigungsantrag</h2>
              <button onClick={() => setSelected(null)} aria-label="Schließen" className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name" value={[selected.first_name, selected.last_name].filter(Boolean).join(" ") || "—"} />
                <Field label="Paket" value={selected.package_name || "—"} />
                <Field icon={<Mail size={12} />} label="E-Mail" value={selected.email || "—"} />
                <Field icon={<Phone size={12} />} label="Telefon" value={selected.phone || "—"} />
                <Field icon={<Calendar size={12} />} label="Gewünschtes Datum" value={fmtDate(selected.cancellation_date)} />
                <Field label="Referenz" value={selected.ref || "—"} mono />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1"><FileText size={11} /> Kündigungsgrund</p>
                <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 rounded-xl px-3.5 py-2.5">{selected.reason || "—"}</p>
              </div>

              {selected.status === "pending" ? (
                <>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Notiz (optional)</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                      className="w-full text-[13px] rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                      placeholder="Interne Notiz zur Entscheidung…" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => act("confirmed")} disabled={actionBusy}
                      className="flex-1 px-3.5 py-2.5 rounded-lg bg-emerald-600 text-white text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-emerald-700 disabled:opacity-50">
                      <Check size={15} /> Kündigung bestätigen
                    </button>
                    <button onClick={() => act("rejected")} disabled={actionBusy}
                      className="flex-1 px-3.5 py-2.5 rounded-lg border border-rose-300 text-rose-700 text-[13px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-rose-50 disabled:opacity-50">
                      <X size={15} /> Ablehnen
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-[12.5px] text-slate-500">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_BADGE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span>
                  {selected.processed_at && <span className="ml-2">am {fmtDate(selected.processed_at)}</span>}
                  {selected.admin_note && <p className="mt-2 bg-slate-50 rounded-lg px-3 py-2">{selected.admin_note}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, icon, mono }: { label: string; value: string; icon?: JSX.Element; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 inline-flex items-center gap-1">{icon}{label}</p>
      <p className={`text-[13px] text-slate-700 break-words ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
