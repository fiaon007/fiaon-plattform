import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, GripVertical, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// TEAM-VERWALTUNG — vier Blöcke, die fast verschwunden wären
//
// Am 09.08.2026 ging die alte Team-Seite in der Team-Zentrale auf. Vier
// Funktionsblöcke waren dabei NICHT mitgezogen worden: Skripte, Partner-
// Anfragen, Meilenstein-Prämien und die Team-Einstellungen. Als am 10.08. die
// Altseite entfernt wurde, waren sie unbedienbar — nicht kaputt, sondern
// unerreichbar. Das ist die unangenehmere Sorte Fehler: Nichts meldet sich.
//
// Diese Datei hält die vier Blöcke WÖRTLICH so, wie sie waren: dieselben
// Endpunkte, dieselben Felder, dasselbe Verhalten. Ein Umbau wäre die
// Gelegenheit gewesen, still etwas zu verlieren.
// ═══════════════════════════════════════════════════════════════════════════

/** Derselbe Aufrufer wie in der alten Seite. */
async function api(pfad: string, init: RequestInit = {}): Promise<{ ok: boolean; json: any }> {
  const r = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  }).catch(() => null);
  const json = await r?.json().catch(() => null);
  return { ok: !!r?.ok && json?.ok !== false, json };
}

interface PartnerSuggestion {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  reason: string | null;
  status: string;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  created_agent_id: number | null;
  suggested_by_name: string | null;
  suggested_by_id: number | null;
}

interface MilestoneTask {
  id: number;
  agent_id: number;
  agent_name: string | null;
  milestone_key: string;
  achieved_at: string;
  prize_status: string;
  prize_done_at: string | null;
  prize_title: string | null;
}

interface Script {
  id: number;
  title: string;
  category: string;
  content_html: string | null;
  file_name: string | null;
  sort_order: number;
  active: boolean;
  updated_at: string;
}

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-colors";
const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors disabled:opacity-40 bg-[#2563eb] hover:bg-[#1d4fd7]";
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

// Lesbare Labels für die Konto-Ereignisse (fiaon_agent_events) im Aktivitätslog.
export function InviteModal({ defaults, prefill, onClose, onDone, flash }: {
  defaults: { commissionRateBp: number };
  prefill?: { firstName: string; lastName: string; email: string; phone: string; recruitedBy: number | null; suggestionId: number };
  onClose: () => void;
  onDone: () => void;
  flash: (m: string) => void;
}) {
  const [form, setForm] = useState({
    firstName: prefill?.firstName || "", lastName: prefill?.lastName || "",
    email: prefill?.email || "", phone: prefill?.phone || "", rate: "", goal: "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const r = await api("/admin/agents", {
      method: "POST",
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        commissionRateBp: form.rate === "" ? null : Math.round(Number(form.rate.replace(",", ".")) * 100),
        monthlyGoalCents: form.goal === "" ? null : Math.round(Number(form.goal.replace(",", ".")) * 100),
        // Paket AE4: aus Partner-Anfrage angenommen → Werber automatisch setzen
        recruitedBy: prefill?.recruitedBy ?? null,
        suggestionId: prefill?.suggestionId ?? null,
      }),
    });
    setBusy(false);
    if (r.ok) {
      flash(`Einladung an ${form.email} versendet (Make: agent_invite) — Link 48 h gültig`);
      onDone();
    } else flash(r.json?.error || "Fehler");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold">Mitarbeiter einladen</h2>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center"><X size={15} /></button>
        </div>
        <p className="text-[12px] text-slate-400 mb-4">
          Es wird KEIN Passwort gesetzt — der Mitarbeiter erhält per E-Mail einen 48 h gültigen Link, um sein Passwort selbst festzulegen.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Vorname" className={inputCls} required />
            <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Nachname" className={inputCls} required />
          </div>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Login-E-Mail" className={inputCls} required />
          <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Telefon (optional)" className={inputCls} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <input type="text" inputMode="decimal" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} placeholder={`Satz % (leer = ${(defaults.commissionRateBp / 100).toLocaleString("de-DE")})`} className={inputCls} />
            </div>
            <input type="text" inputMode="decimal" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} placeholder="Monatsziel € (optional)" className={inputCls} />
          </div>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-3`}>
            {busy ? "Sende …" : "Einladung senden"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ═══════════════ K: Agent-Detail ═══════════════

export function PartnerSuggestionsCard({ flash, onChanged }: {
  flash: (m: string) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<PartnerSuggestion[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [accept, setAccept] = useState<PartnerSuggestion | null>(null);

  const load = useCallback(() => {
    api("/admin/team/partner-suggestions").then((r) => { if (r.ok) setRows(r.json.data); });
  }, []);
  useEffect(load, [load]);

  const reject = async (e: React.MouseEvent, s: PartnerSuggestion) => {
    e.stopPropagation();
    const reason = prompt(`Vorschlag für ${s.first_name} ${s.last_name} ablehnen?\n\nOptionaler Grund (nur intern, der Kandidat wird NICHT informiert):`);
    if (reason === null) return;
    setBusy(s.id);
    const r = await api(`/admin/team/partner-suggestions/${s.id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
    setBusy(null);
    if (r.ok) { flash("Vorschlag abgelehnt"); load(); } else flash(r.json?.error || "Fehler");
  };

  const open = rows.filter((r) => r.status === "offen");
  const STATUS_LABEL: Record<string, string> = { offen: "Offen", angenommen: "Angenommen", abgelehnt: "Abgelehnt" };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-[14px] font-bold text-slate-900">Partner-Anfragen</h2>
        {open.length > 0 && <span className="px-2 py-0.5 rounded-full border border-slate-400 text-[11px] font-semibold text-slate-700">{open.length} offen</span>}
      </div>
      <p className="text-[12px] text-slate-400 mb-4">
        Von Mitarbeitern vorgeschlagene Partner. Annahme startet den Einladungs-Flow und setzt den Werber automatisch (Override greift ab dann).
        Für das Vorschlagen selbst gibt es bewusst keine Prämie.
      </p>
      {rows.length === 0 ? (
        <p className="text-[12px] text-slate-400">Noch keine Anfragen.</p>
      ) : (
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-50">
          {rows.map((s) => (
            <div key={s.id} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900">{s.first_name} {s.last_name}</p>
                <p className="text-[11px] text-slate-400">{s.email}{s.phone ? ` · ${s.phone}` : ""}</p>
                <p className="text-[11px] text-slate-400">Vorgeschlagen von {s.suggested_by_name || "—"} · {fmtDT(s.created_at)}</p>
                {s.reason && <p className="text-[12px] text-slate-600 mt-1 max-w-lg">{s.reason}</p>}
                {s.status === "abgelehnt" && s.decision_reason && <p className="text-[11px] text-slate-400 mt-1">Abgelehnt: {s.decision_reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                {s.status === "offen" ? (
                  <>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setAccept(s); }} disabled={busy === s.id} className={btnPrimary}>Annehmen</button>
                    <button type="button" onClick={(e) => reject(e, s)} disabled={busy === s.id} className={btnGhost}>Ablehnen</button>
                  </>
                ) : (
                  <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${s.status === "angenommen" ? "border-slate-400 text-slate-800" : "border-slate-200 text-slate-400"}`}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {accept && (
        <InviteModal
          defaults={{ commissionRateBp: 1500 }}
          prefill={{ firstName: accept.first_name, lastName: accept.last_name, email: accept.email, phone: accept.phone || "", recruitedBy: accept.suggested_by_id, suggestionId: accept.id }}
          onClose={() => setAccept(null)}
          onDone={() => { setAccept(null); load(); onChanged(); flash("Partner angenommen — Einladung versendet, Werber gesetzt"); }}
          flash={flash}
        />
      )}
    </div>
  );
}

// ═══════════════ AE3: Meilenstein-Prämien (Aufgaben) ═══════════════

export function MilestoneTasksCard({ flash }: { flash: (m: string) => void }) {
  const [rows, setRows] = useState<MilestoneTask[]>([]);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    api("/admin/team/milestones").then((r) => { if (r.ok) setRows(r.json.data); });
  }, []);
  useEffect(load, [load]);

  const markDone = async (e: React.MouseEvent, m: MilestoneTask) => {
    e.stopPropagation();
    setBusy(m.id);
    const r = await api(`/admin/team/milestones/${m.id}/done`, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash("Prämie als ausgeliefert markiert"); load(); } else flash(r.json?.error || "Fehler");
  };

  if (rows.length === 0) return null;
  const open = rows.filter((r) => r.prize_status === "offen");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="text-[14px] font-bold text-slate-900">Meilenstein-Prämien</h2>
        {open.length > 0 && <span className="px-2 py-0.5 rounded-full border border-slate-400 text-[11px] font-semibold text-slate-700">{open.length} auszuliefern</span>}
      </div>
      <p className="text-[12px] text-slate-400 mb-4">
        Erreichte Partner-Meilensteine mit Sachprämie. Keine automatische Geldbuchung — als Aufgabe hier abhaken, sobald ausgeliefert.
      </p>
      <div className="border border-slate-200 rounded-xl divide-y divide-slate-50">
        {rows.map((m) => (
          <div key={m.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900">{m.agent_name || `Agent #${m.agent_id}`}</p>
              <p className="text-[11px] text-slate-400">{m.prize_title || m.milestone_key} · erreicht {fmtDT(m.achieved_at)}</p>
            </div>
            {m.prize_status === "offen" ? (
              <button type="button" onClick={(e) => markDone(e, m)} disabled={busy === m.id} className={btnGhost}>Als ausgeliefert markieren</button>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-400">Erledigt {m.prize_done_at ? fmtDT(m.prize_done_at) : ""}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════ G1: Einstellungen ═══════════════

export function SettingsCard({ flash, onSaved }: { flash: (m: string) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ rate: "", min: "", maxRetained: "" });
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api("/admin/settings"), api("/admin/scripts")]).then(([s, sc]) => {
      if (s.ok) {
        setForm({
          rate: String(s.json.settings.defaultCommissionRateBp / 100).replace(".", ","),
          min: String(s.json.settings.payoutMinCents / 100).replace(".", ","),
          maxRetained: String(s.json.settings.payoutMaxRetainedCents / 100).replace(".", ","),
        });
        setStatusMap(s.json.settings.scriptStatusMap || {});
      }
      if (sc.ok) setCategories(Array.from(new Set(sc.json.data.map((x: Script) => x.category))) as string[]);
    });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const r = await api("/admin/settings", {
      method: "POST",
      body: JSON.stringify({
        defaultCommissionRateBp: Math.round(Number(form.rate.replace(",", ".")) * 100),
        payoutMinCents: Math.round(Number(form.min.replace(",", ".")) * 100),
        payoutMaxRetainedCents: Math.round(Number(form.maxRetained.replace(",", ".")) * 100),
        scriptStatusMap: statusMap,
      }),
    });
    setBusy(false);
    if (r.ok) { flash("Einstellungen gespeichert"); onSaved(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      <h2 className="text-[15px] font-bold text-slate-900 mb-1">Einstellungen</h2>
      <p className="text-[12px] text-slate-400 mb-4">Änderungen am Provisionssatz wirken nur auf zukünftige Provisionen.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Standard-Provisionssatz (%)</label>
          <input type="text" inputMode="decimal" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mindest-Auszahlungsbetrag (€)</label>
          <input type="text" inputMode="decimal" value={form.min} onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))} className={inputCls} />
          <p className="text-[10.5px] text-slate-400 mt-1">Ab hier kann der Agent selbst auszahlen (Vertrag: „Minimum Payout Threshold“).</p>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Obergrenze Guthaben (€)</label>
          <input type="text" inputMode="decimal" value={form.maxRetained} onChange={(e) => setForm((f) => ({ ...f, maxRetained: e.target.value }))} className={inputCls} />
          <p className="text-[10.5px] text-slate-400 mt-1">Darüber zahlt FIAON den Überschuss aus (Vertrag: „Maximum Retained Balance“). Nur Timing, kein Einbehalt.</p>
        </div>
        {(["pending_payment", "claimed_paid"] as const).map((status) => (
          <div key={status}>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">
              Leitfaden bei „{status === "pending_payment" ? "Offen" : "Zahlung angekündigt"}"
            </label>
            <select
              value={statusMap[status] || ""}
              onChange={(e) => setStatusMap((m) => ({ ...m, [status]: e.target.value }))}
              className={inputCls}
            >
              <option value="">— keiner —</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ))}
      </div>
      <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? "…" : "Speichern"}</button>
    </form>
  );
}

// ═══════════════ I1: Skript-Verwaltung ═══════════════

export function ScriptsAdmin({ flash }: { flash: (m: string) => void }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [form, setForm] = useState({ title: "", category: "", content: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);

  const load = useCallback(() => {
    api("/admin/scripts").then((r) => { if (r.ok) setScripts(r.json.data); });
  }, []);
  useEffect(load, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Script[]>();
    for (const s of scripts) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return Array.from(map.entries());
  }, [scripts]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.title || !form.category) { flash("Titel und Kategorie erforderlich"); return; }
    if (file && file.size > 10 * 1024 * 1024) { flash("Datei zu groß (max. 10 MB)"); return; }
    setBusy(true);
    let fileDataUrl: string | null = null;
    if (file) {
      fileDataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
    }
    const r = await api("/admin/scripts", {
      method: "POST",
      body: JSON.stringify({
        title: form.title,
        category: form.category,
        contentHtml: form.content ? form.content.replace(/\n/g, "<br>") : null,
        fileDataUrl,
        fileName: file?.name || null,
      }),
    });
    setBusy(false);
    if (r.ok) { flash("Skript angelegt"); setForm({ title: "", category: "", content: "" }); setFile(null); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const toggle = async (e: React.MouseEvent, s: Script) => {
    e.stopPropagation();
    const r = await api(`/admin/scripts/${s.id}/update`, { method: "POST", body: JSON.stringify({ active: !s.active, contentHtml: s.content_html }) });
    if (r.ok) load();
  };

  const remove = async (e: React.MouseEvent, s: Script) => {
    e.stopPropagation();
    if (!confirm(`Skript „${s.title}" entfernen? (Soft-Delete — bleibt rekonstruierbar)`)) return;
    const r = await api(`/admin/scripts/${s.id}/delete`, { method: "POST" });
    if (r.ok) { flash("Skript entfernt (Soft-Delete)"); load(); }
  };

  // Drag&Drop-Sortierung innerhalb einer Kategorie
  const onDrop = async (e: React.DragEvent, target: Script, items: Script[]) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragId == null || dragId === target.id) return;
    const ids = items.map((x) => x.id).filter((x) => x !== dragId);
    ids.splice(ids.indexOf(target.id), 0, dragId);
    setDragId(null);
    const r = await api("/admin/scripts/reorder", { method: "POST", body: JSON.stringify({ ids }) });
    if (r.ok) load();
  };

  return (
    <div id="skripte" className="bg-white border border-slate-200 rounded-2xl p-5 scroll-mt-16">
      <h2 className="text-[15px] font-bold text-slate-900 mb-1">Skripte &amp; Gesprächsvorlagen</h2>
      <p className="text-[12px] text-slate-400 mb-4">
        Kategorien sind frei definierbar (z. B. „Eröffnung", „Einwand: zu teuer", „Abschluss"). Sortierung per Ziehen am Griff.
      </p>

      <form onSubmit={create} className="grid sm:grid-cols-2 gap-3 mb-5">
        <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Titel" className={inputCls} />
        <input type="text" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Kategorie" className={inputCls} list="script-categories" />
        <datalist id="script-categories">
          {grouped.map(([c]) => <option key={c} value={c} />)}
        </datalist>
        <textarea
          value={form.content}
          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
          placeholder="Inhalt (Text; Zeilenumbrüche bleiben erhalten) — ODER PDF wählen"
          rows={3}
          className={`${inputCls} sm:col-span-2 resize-y`}
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <label className={`${btnGhost} cursor-pointer`}>
            {file ? file.name : "PDF wählen (max. 10 MB)"}
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {file && <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[12px] text-slate-400 hover:text-slate-600">Entfernen</button>}
          <button type="submit" disabled={busy} className={`${btnPrimary} ml-auto`}>{busy ? "…" : "Skript anlegen"}</button>
        </div>
      </form>

      <div className="space-y-4">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{category}</h3>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-50">
              {items.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragId(s.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDrop(e, s, items)}
                  className={`px-3.5 py-2.5 flex items-center gap-3 ${dragId === s.id ? "opacity-40" : ""}`}
                >
                  <GripVertical size={14} className="text-slate-300 cursor-grab shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] font-medium ${s.active ? "text-slate-800" : "text-slate-400 line-through"}`}>
                      {s.title}
                      {s.file_name && <FileText size={12} className="inline ml-1.5 text-slate-400" />}
                    </p>
                    <p className="text-[11px] text-slate-400">Zuletzt geändert {fmtDT(s.updated_at)}</p>
                  </div>
                  <button type="button" onClick={(e) => toggle(e, s)} className={btnGhost}>
                    {s.active ? "Deaktivieren" : "Aktivieren"}
                  </button>
                  <button type="button" onClick={(e) => remove(e, s)} className="text-[12px] font-semibold text-slate-400 hover:text-slate-600">
                    Entfernen
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {scripts.length === 0 && <p className="text-[12px] text-slate-400 text-center py-4">Noch keine Skripte angelegt.</p>}
      </div>
    </div>
  );
}
