import { useState, useEffect, useCallback } from "react";
import {
  Sparkles, MessageSquarePlus, Target, HandCoins, Eye, EyeOff,
  Trash2, Image as ImageIcon, ChevronDown, Save, Copy, Check,
} from "lucide-react";

// ============================================================================
// /admin/agent-portal — Pflegebereich fürs Agent-Portal (Pakete AM3/AN2/AG1):
// 1. Agent-Updates: posten ohne Deploy (Entwurf/veröffentlichen) → Banner
// 2. Agent-Feedback: Tickets prüfen, kommentieren, mit EINMALIGER
//    Provisions-Gutschrift (feedback_bonus) honorieren
// 3. Tagesziele: Provisions-/Kontaktziel pro Agent (Ziel-Ring im Dashboard)
// Läuft in der AdminShell; Agent-Tokens werden serverseitig mit 403 geblockt.
// ============================================================================

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-slate-400 outline-none transition-colors";
const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[12px] font-semibold transition-colors disabled:opacity-40 bg-slate-900 hover:bg-slate-700";
const btnGhost =
  "px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors disabled:opacity-40";

function fmtCents(c: number | null | undefined): string {
  if (c == null || isNaN(Number(c))) return "—";
  return `${(Number(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}
function fmtDT(v: string | null): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

interface UpdateRow {
  id: number; title: string; body: string; published: boolean;
  published_at: string | null; created_at: string; read_count: number;
}
interface FeedbackRow {
  id: number; agent_id: number; agent_name: string; agent_email: string;
  category: string; title: string; description: string; has_screenshot: boolean;
  status: string; admin_comment: string | null; reward_cents: number | null;
  created_at: string;
}
interface GoalRow { id: number; name: string; email: string; daily_goal_cents: number | null; daily_contacts_goal: number | null }

const CATEGORY_LABELS: Record<string, string> = {
  verbesserung: "Verbesserung", bug: "Bug", idee: "Idee", sonstiges: "Sonstiges",
};
const STATUS_OPTIONS = [
  { key: "offen", label: "Offen" },
  { key: "geprueft", label: "Geprüft" },
  { key: "umgesetzt", label: "Umgesetzt" },
  { key: "abgelehnt", label: "Abgelehnt" },
];

export default function AdminAgentPortalPage() {
  const [message, setMessage] = useState<string | null>(null);
  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4500); };

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-bold tracking-tight mb-1">Agent-Portal</h1>
      <p className="text-[12px] text-slate-400 mb-5">
        Updates posten (Banner im Agent-Portal), Feedback prüfen und belohnen, Tagesziele setzen.
      </p>
      {message && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{message}</div>
      )}
      <UpdatesSection flash={flash} />
      <div id="feedback" className="scroll-mt-20"><FeedbackSection flash={flash} /></div>
      <GoalsSection flash={flash} />
    </div>
  );
}

// ═══════════════ 1. Agent-Updates (AM3) ═══════════════

function UpdatesSection({ flash }: { flash: (m: string) => void }) {
  const [updates, setUpdates] = useState<UpdateRow[]>([]);
  const [activeAgents, setActiveAgents] = useState(0);
  const [form, setForm] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api("/admin/agent-updates").then((r) => {
      if (r.ok) { setUpdates(r.json.data); setActiveAgents(r.json.activeAgents); }
    });
  }, []);
  useEffect(load, [load]);

  const create = async (publish: boolean) => {
    if (!form.title.trim() || !form.body.trim()) return;
    setBusy(true);
    const r = await api("/admin/agent-updates", { method: "POST", body: JSON.stringify({ ...form, publish }) });
    setBusy(false);
    if (r.ok) {
      setForm({ title: "", body: "" });
      flash(publish ? "Update veröffentlicht — der Banner erscheint jetzt im Agent-Portal." : "Entwurf gespeichert.");
      load();
    } else flash(r.json?.error || "Fehler");
  };

  const togglePublish = async (u: UpdateRow) => {
    const r = await api(`/admin/agent-updates/${u.id}`, { method: "PATCH", body: JSON.stringify({ published: !u.published }) });
    if (r.ok) { flash(u.published ? "Update auf Entwurf zurückgesetzt." : "Update veröffentlicht."); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const remove = async (u: UpdateRow) => {
    if (!confirm(`Update „${u.title}" wirklich löschen?`)) return;
    const r = await api(`/admin/agent-updates/${u.id}`, { method: "DELETE" });
    if (r.ok) { flash("Update gelöscht."); load(); }
  };

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
        <Sparkles size={15} strokeWidth={1.8} className="text-slate-400" /> Agent-Updates
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-3">
        <div className="space-y-3">
          <input
            type="text" value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Titel des Updates" className={inputCls} maxLength={160}
          />
          <textarea
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Was ist neu? Beschreibe die Änderung so, dass Agents sie sofort verstehen …"
            rows={4} className={`${inputCls} resize-none`} maxLength={10000}
          />
          <div className="flex gap-2">
            <button type="button" onClick={(e) => { e.stopPropagation(); create(true); }} disabled={busy || !form.title.trim() || !form.body.trim()} className={btnPrimary}>
              {busy ? "…" : "Veröffentlichen"}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); create(false); }} disabled={busy || !form.title.trim() || !form.body.trim()} className={btnGhost}>
              Als Entwurf speichern
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-50">
        {updates.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-slate-400">Noch keine Updates angelegt.</p>}
        {updates.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
                {u.title}
                {!u.published && <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-semibold text-slate-500">Entwurf</span>}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {u.published ? `Veröffentlicht ${fmtDT(u.published_at)}` : `Angelegt ${fmtDT(u.created_at)}`}
                {u.published ? ` · gelesen von ${u.read_count}/${activeAgents} Agents` : ""}
              </p>
              <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">{u.body}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={(e) => { e.stopPropagation(); togglePublish(u); }} title={u.published ? "Auf Entwurf zurücksetzen" : "Veröffentlichen"}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center transition-colors">
                {u.published ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(u); }} title="Löschen"
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 flex items-center justify-center transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════ 2. Agent-Feedback (AN2) ═══════════════

function FeedbackSection({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [filter, setFilter] = useState<string>("alle");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [comments, setComments] = useState<Record<number, string>>({});
  const [screenshots, setScreenshots] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(() => {
    api("/admin/agent-feedback").then((r) => { if (r.ok) setItems(r.json.data); });
  }, []);
  useEffect(load, [load]);

  const setStatus = async (f: FeedbackRow, status: string) => {
    setBusy(f.id);
    const r = await api(`/admin/agent-feedback/${f.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    setBusy(null);
    if (r.ok) load(); else flash(r.json?.error || "Fehler");
  };

  const saveComment = async (f: FeedbackRow) => {
    setBusy(f.id);
    const r = await api(`/admin/agent-feedback/${f.id}`, { method: "PATCH", body: JSON.stringify({ adminComment: comments[f.id] ?? "" }) });
    setBusy(null);
    if (r.ok) { flash("Kommentar gespeichert — der Agent sieht ihn in seiner Übersicht."); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const reward = async (f: FeedbackRow) => {
    const input = prompt(`Einmalige Provisions-Gutschrift für „${f.title}" (${f.agent_name}) in EUR:`, "25");
    if (input == null) return;
    const eur = Number(String(input).replace(",", "."));
    if (isNaN(eur) || eur <= 0) { flash("Betrag ungültig"); return; }
    if (!confirm(`${eur.toFixed(2)} € als Feedback-Bonus an ${f.agent_name} gutschreiben?\n\nDer Betrag fließt in das normale Provisions-Guthaben (Auszahlung wie üblich nach Prüfung). Pro Ticket ist nur EINE Gutschrift möglich.`)) return;
    setBusy(f.id);
    const r = await api(`/admin/agent-feedback/${f.id}/reward`, { method: "POST", body: JSON.stringify({ amountCents: Math.round(eur * 100) }) });
    setBusy(null);
    if (r.ok) { flash(`${eur.toFixed(2)} € gutgeschrieben — Audit-Eintrag + Make-Event agent_feedback_rewarded ausgelöst.`); load(); }
    else flash(r.json?.error || "Fehler");
  };

  // Paket DF: Ticket-Volltext kopieren (Titel + Autor + Datum + Beschreibung) —
  // für Weitergabe an Entwicklung/Ticketsystem, Umbrüche bleiben erhalten.
  const copyTicket = async (f: FeedbackRow) => {
    const text = [
      `[${CATEGORY_LABELS[f.category] || f.category}] ${f.title}`,
      `Von: ${f.agent_name} (${f.agent_email}) · ${fmtDT(f.created_at)} · Ticket #${f.id} · Status: ${STATUS_OPTIONS.find((s) => s.key === f.status)?.label || f.status}`,
      "",
      f.description,
      f.admin_comment ? `\nAdmin-Kommentar: ${f.admin_comment}` : "",
    ].join("\n").trim();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(f.id);
      setTimeout(() => setCopiedId((c) => (c === f.id ? null : c)), 2000);
    } catch {
      flash("Kopieren nicht möglich — bitte Text manuell markieren");
    }
  };

  const showScreenshot = async (f: FeedbackRow) => {
    if (screenshots[f.id]) { setScreenshots((s) => { const n = { ...s }; delete n[f.id]; return n; }); return; }
    const r = await api(`/admin/agent-feedback/${f.id}/screenshot`);
    if (r.ok) setScreenshots((s) => ({ ...s, [f.id]: r.json.screenshot }));
  };

  const filtered = filter === "alle" ? items : items.filter((f) => f.status === filter);

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold text-slate-900 mb-3 flex items-center gap-2">
        <MessageSquarePlus size={15} strokeWidth={1.8} className="text-slate-400" /> Agent-Feedback
        <span className="text-[11px] font-semibold text-slate-400">({items.filter((f) => f.status === "offen").length} offen)</span>
      </h2>
      <div className="flex flex-wrap gap-2 mb-3">
        {[{ key: "alle", label: "Alle" }, ...STATUS_OPTIONS].map((s) => {
          // Paket DF: Zähler je Status — sofort sichtbar, wie viele Tickets wo liegen
          const count = s.key === "alle" ? items.length : items.filter((f) => f.status === s.key).length;
          return (
            <button key={s.key} type="button" onClick={(e) => { e.stopPropagation(); setFilter(s.key); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors ${
                filter === s.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-50">
        {filtered.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-slate-400">Keine Tickets in dieser Ansicht.</p>}
        {filtered.map((f) => (
          <div key={f.id} className="px-4 py-3">
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => ({ ...o, [f.id]: !o[f.id] })); if (comments[f.id] === undefined) setComments((c) => ({ ...c, [f.id]: f.admin_comment || "" })); }}
              className="w-full flex items-center justify-between gap-3 text-left">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 truncate flex items-center gap-2">
                  {f.title}
                  {f.reward_cents != null && (
                    <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-semibold text-slate-600 inline-flex items-center gap-1 shrink-0">
                      <HandCoins size={10} strokeWidth={2} /> {fmtCents(f.reward_cents)}
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {f.agent_name} · {CATEGORY_LABELS[f.category] || f.category} · {fmtDT(f.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                  f.status === "offen" ? "border-slate-400 text-slate-700" : "border-slate-200 text-slate-500"
                }`}>
                  {STATUS_OPTIONS.find((s) => s.key === f.status)?.label || f.status}
                </span>
                <ChevronDown size={15} className={`text-slate-400 transition-transform ${open[f.id] ? "" : "-rotate-90"}`} />
              </div>
            </button>
            {open[f.id] && (
              <div className="mt-3 space-y-3">
                {f.description && f.description.trim() ? (
                  <p className="text-[12.5px] text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-2.5">{f.description}</p>
                ) : (
                  <p className="text-[12.5px] italic text-slate-400 bg-slate-50 border border-slate-100 rounded-lg px-3.5 py-2.5">Keine Beschreibung angegeben — Rückfrage beim Agent nötig.</p>
                )}
                <button type="button" onClick={(e) => { e.stopPropagation(); copyTicket(f); }}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  {copiedId === f.id ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.8} />}
                  {copiedId === f.id ? "Kopiert" : "Ticket kopieren (Titel + Autor + Datum + Text)"}
                </button>
                {f.has_screenshot && (
                  <div>
                    <button type="button" onClick={(e) => { e.stopPropagation(); showScreenshot(f); }}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                      <ImageIcon size={13} strokeWidth={1.8} /> {screenshots[f.id] ? "Screenshot ausblenden" : "Screenshot anzeigen"}
                    </button>
                    {screenshots[f.id] && <img src={screenshots[f.id]} alt="" className="mt-2 max-h-80 rounded-lg border border-slate-200" />}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Status:</span>
                  {STATUS_OPTIONS.map((s) => (
                    <button key={s.key} type="button" disabled={busy === f.id} onClick={(e) => { e.stopPropagation(); setStatus(f, s.key); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold border transition-colors disabled:opacity-40 ${
                        f.status === s.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                      }`}>
                      {s.label}
                    </button>
                  ))}
                  {f.reward_cents == null ? (
                    <button type="button" disabled={busy === f.id} onClick={(e) => { e.stopPropagation(); reward(f); }}
                      className={`${btnPrimary} ml-auto inline-flex items-center gap-1.5`}>
                      <HandCoins size={13} strokeWidth={2} /> Bonus gutschreiben
                    </button>
                  ) : (
                    <span className="ml-auto text-[11.5px] font-semibold text-slate-500">Bereits honoriert: {fmtCents(f.reward_cents)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={comments[f.id] ?? f.admin_comment ?? ""} onChange={(e) => setComments((c) => ({ ...c, [f.id]: e.target.value }))}
                    placeholder="Kommentar für den Agent (sichtbar in seiner Feedback-Übersicht)" className={inputCls} maxLength={2000} />
                  <button type="button" disabled={busy === f.id} onClick={(e) => { e.stopPropagation(); saveComment(f); }} className={btnGhost}>
                    Speichern
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════ 3. Tagesziele pro Agent (AG1) ═══════════════

function GoalsSection({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<GoalRow[]>([]);
  const [defaults, setDefaults] = useState({ dailyGoalCents: 3000, dailyContactsGoal: 15 });
  const [edits, setEdits] = useState<Record<number, { goal: string; contacts: string }>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    api("/admin/agent-daily-goals").then((r) => {
      if (r.ok) {
        setRows(r.json.data);
        setDefaults(r.json.defaults);
        const e: Record<number, { goal: string; contacts: string }> = {};
        for (const a of r.json.data) {
          e[a.id] = {
            goal: a.daily_goal_cents != null ? String(a.daily_goal_cents / 100) : "",
            contacts: a.daily_contacts_goal != null ? String(a.daily_contacts_goal) : "",
          };
        }
        setEdits(e);
      }
    });
  }, []);
  useEffect(load, [load]);

  const save = async (a: GoalRow) => {
    const e = edits[a.id];
    const goalEur = e.goal.trim() === "" ? null : Number(e.goal.replace(",", "."));
    if (goalEur !== null && (isNaN(goalEur) || goalEur < 0)) { flash("Tagesziel ungültig"); return; }
    const contacts = e.contacts.trim() === "" ? null : Math.round(Number(e.contacts));
    if (contacts !== null && (isNaN(contacts) || contacts < 0)) { flash("Kontaktziel ungültig"); return; }
    setBusy(a.id);
    const r = await api(`/admin/agents/${a.id}/daily-goals`, {
      method: "PATCH",
      body: JSON.stringify({
        dailyGoalCents: goalEur === null ? "" : Math.round(goalEur * 100),
        dailyContactsGoal: contacts === null ? "" : contacts,
      }),
    });
    setBusy(null);
    if (r.ok) { flash(`Tagesziele für ${a.name} gespeichert.`); load(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-bold text-slate-900 mb-1 flex items-center gap-2">
        <Target size={15} strokeWidth={1.8} className="text-slate-400" /> Tagesziele (Ziel-Ring im Dashboard)
      </h2>
      <p className="text-[11.5px] text-slate-400 mb-3">
        Leer = Standard ({fmtCents(defaults.dailyGoalCents)} Provision · {defaults.dailyContactsGoal} Kontakte pro Tag).
      </p>
      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-50">
        {rows.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-slate-400">Keine aktiven Agents.</p>}
        {rows.map((a) => (
          <div key={a.id} className="px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1" style={{ minWidth: 160 }}>
              <p className="text-[13px] font-semibold text-slate-900 truncate">{a.name}</p>
              <p className="text-[11px] text-slate-400 truncate">{a.email}</p>
            </div>
            <div className="relative">
              <input type="number" min="0" step="5" value={edits[a.id]?.goal ?? ""} placeholder={String(defaults.dailyGoalCents / 100)}
                onChange={(e) => setEdits((x) => ({ ...x, [a.id]: { ...x[a.id], goal: e.target.value } }))}
                className={inputCls} style={{ width: 120 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">€/Tag</span>
            </div>
            <div className="relative">
              <input type="number" min="0" step="1" value={edits[a.id]?.contacts ?? ""} placeholder={String(defaults.dailyContactsGoal)}
                onChange={(e) => setEdits((x) => ({ ...x, [a.id]: { ...x[a.id], contacts: e.target.value } }))}
                className={inputCls} style={{ width: 130 }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">Kontakte</span>
            </div>
            <button type="button" disabled={busy === a.id} onClick={(e) => { e.stopPropagation(); save(a); }}
              className={`${btnGhost} inline-flex items-center gap-1.5`}>
              <Save size={13} strokeWidth={1.8} /> {busy === a.id ? "…" : "Speichern"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
