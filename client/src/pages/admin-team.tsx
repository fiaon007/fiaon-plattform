import { useState, useEffect, useCallback, useMemo } from "react";
import { X, ChevronDown, GripVertical, FileText } from "lucide-react";

// ============================================================================
// /admin/team (Paket K) — Agent-Statistik & Steuerung
// + Einladungs-Onboarding (F1), Einstellungen (G1), Skript-Verwaltung (I1)
// Design nach Paket E: monochrom, Text-Badges, keine Emojis/bunten Icons.
// Geld wird NUR serverseitig berechnet — hier reine Anzeige (Integer-Cents).
// ============================================================================

interface AgentStat {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  active: boolean;
  avatar: string | null;
  commission_rate_bp: number | null;
  effective_rate_bp: number;
  monthly_goal_cents: number | null;
  bank_iban_masked: string | null;
  bank_change_ack: boolean;
  has_password: boolean;
  invite_expires_at: string | null;
  last_login_at: string | null;
  assigned_count: number;
  contacts_today: number;
  contacts_week: number;
  reached_quote: number | null;
  conversions: number;
  revenue_cents: number;
  confirmed_cents: number;
  in_payout_cents: number;
  paid_out_cents: number;
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

async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

export default function AdminTeamPage() {
  const [stats, setStats] = useState<AgentStat[]>([]);
  const [defaults, setDefaults] = useState<{ commissionRateBp: number }>({ commissionRateBp: 1500 });
  const [message, setMessage] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4500); };

  const load = useCallback(() => {
    api("/admin/team/stats").then((r) => {
      if (r.ok) { setStats(r.json.data); setDefaults(r.json.defaults); }
    });
  }, []);
  useEffect(load, [load]);

  const bankChanges = stats.filter((a) => !a.bank_change_ack);

  const ackBankChanges = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const r = await api("/admin/agents/bank-changes/ack", { method: "POST" });
    if (r.ok) { flash("Bankdaten-Hinweise quittiert"); load(); }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2563eb] mb-1">Admin</p>
            <h1 className="text-2xl font-bold tracking-tight">Team</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Mitarbeiter, Provisionen und Leistung. Auszahlungen verwaltest du in der{" "}
              <a href="/admin/zahlungen" className="font-semibold text-[#2563eb] hover:underline">Zahlungszentrale</a>.
            </p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); setInviteOpen(true); }} className={btnPrimary}>
            Mitarbeiter einladen
          </button>
        </div>

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{message}</div>
        )}

        {/* F3: Betrugsschutz-Banner bei geänderten Bankdaten */}
        {bankChanges.length > 0 && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-slate-400 bg-white flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-semibold text-slate-800">
              Bankdaten geändert: {bankChanges.map((a) => `${a.name} (${a.bank_iban_masked || "—"})`).join(", ")}
              <span className="font-normal text-slate-500"> — bitte prüfen (Betrugsschutz).</span>
            </p>
            <button type="button" onClick={ackBankChanges} className={btnGhost}>Geprüft, Hinweis entfernen</button>
          </div>
        )}

        {/* K: Übersichtstabelle */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Mitarbeiter", "Kunden", "Kontakte heute / Woche", "Erreicht-Quote", "Conversions", "Umsatz", "Provision offen / in Auszahlung / ausgezahlt", "Letzter Login", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-[13px] text-slate-400">Noch keine Mitarbeiter — lade den ersten ein.</td></tr>
                )}
                {stats.map((a) => (
                  <tr key={a.id} onClick={() => setDetailId(a.id)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {a.name}
                        {!a.active && <span className="ml-2 px-2 py-0.5 rounded-full border border-slate-200 text-[10px] font-semibold text-slate-400">deaktiviert</span>}
                        {!a.has_password && <span className="ml-2 px-2 py-0.5 rounded-full border border-slate-300 text-[10px] font-semibold text-slate-500">Einladung offen</span>}
                      </p>
                      <p className="text-[11px] text-slate-400">{a.email} · Satz {(a.effective_rate_bp / 100).toLocaleString("de-DE")} %{a.commission_rate_bp == null ? " (Standard)" : ""}</p>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums">{a.assigned_count}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 tabular-nums whitespace-nowrap">{a.contacts_today} / {a.contacts_week}</td>
                    <td className="px-4 py-3 text-[13px] text-slate-600 tabular-nums">{a.reached_quote == null ? "—" : `${a.reached_quote} %`}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums">{a.conversions}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold tabular-nums whitespace-nowrap">{fmtCents(a.revenue_cents)}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 tabular-nums whitespace-nowrap">
                      {fmtCents(a.confirmed_cents)} / {fmtCents(a.in_payout_cents)} / {fmtCents(a.paid_out_cents)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{fmtDT(a.last_login_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-[12px] font-semibold text-slate-400">Details</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <SettingsCard flash={flash} onSaved={load} />
        <ScriptsAdmin flash={flash} />
      </div>

      {inviteOpen && <InviteModal defaults={defaults} onClose={() => setInviteOpen(false)} onDone={() => { setInviteOpen(false); load(); }} flash={flash} />}
      {detailId != null && (
        <AgentDetailDrawer
          id={detailId}
          agents={stats}
          onClose={() => setDetailId(null)}
          onChanged={load}
          flash={flash}
        />
      )}
    </div>
  );
}

// ═══════════════ F1: Einladen ═══════════════

function InviteModal({ defaults, onClose, onDone, flash }: {
  defaults: { commissionRateBp: number };
  onClose: () => void;
  onDone: () => void;
  flash: (m: string) => void;
}) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", rate: "", goal: "" });
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

function AgentDetailDrawer({ id, agents, onClose, onChanged, flash }: {
  id: number;
  agents: AgentStat[];
  onClose: () => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", rate: "", goal: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [selectedRefs, setSelectedRefs] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"aktivitaet" | "provisionen" | "kunden">("kunden");

  const load = useCallback(() => {
    api(`/admin/team/agents/${id}`).then((r) => {
      if (r.ok) {
        setData(r.json);
        const a = r.json.agent;
        setForm({
          firstName: a.first_name || "",
          lastName: a.last_name || "",
          phone: a.phone || "",
          rate: a.commission_rate_bp == null ? "" : String(a.commission_rate_bp / 100).replace(".", ","),
          goal: a.monthly_goal_cents == null ? "" : String(a.monthly_goal_cents / 100).replace(".", ","),
        });
      }
    });
  }, [id]);
  useEffect(load, [load]);

  if (!data) return null;
  const a = data.agent;

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy("save");
    const r = await api(`/admin/agents/${id}/update`, {
      method: "POST",
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        commissionRateBp: form.rate === "" ? null : Math.round(Number(form.rate.replace(",", ".")) * 100),
        monthlyGoalCents: form.goal === "" ? null : Math.round(Number(form.goal.replace(",", ".")) * 100),
      }),
    });
    setBusy(null);
    if (r.ok) { flash("Einstellungen gespeichert (Satz wirkt nur auf künftige Provisionen)"); onChanged(); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const action = async (e: React.MouseEvent, path: string, label: string, confirmText?: string) => {
    e.stopPropagation();
    if (confirmText && !confirm(confirmText)) return;
    setBusy(path);
    const r = await api(path, { method: "POST" });
    setBusy(null);
    if (r.ok) { flash(label); onChanged(); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const reassign = async (e: React.MouseEvent, refs: string[]) => {
    e.stopPropagation();
    if (refs.length === 0) { flash("Keine Kunden ausgewählt"); return; }
    const toId = reassignTo === "" ? null : Number(reassignTo);
    const target = toId == null ? "Zuweisung entfernen" : agents.find((x) => x.id === toId)?.name || "";
    if (!confirm(`${refs.length} Kunde(n) → ${target}?`)) return;
    setBusy("reassign");
    const r = await api("/admin/team/reassign", { method: "POST", body: JSON.stringify({ refs, toAgentId: toId }) });
    setBusy(null);
    if (r.ok) { flash(`${r.json.updated} Kunde(n) neu zugewiesen`); setSelectedRefs(new Set()); onChanged(); load(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[560px] bg-white border-l border-slate-200 shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[15px] font-bold text-slate-900">{a.name}</p>
            <p className="text-[11px] text-slate-400">{a.email}{a.bank_iban_masked ? ` · ${a.bank_iban_masked}` : ""}</p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center"><X size={16} /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Einstellungen */}
          <form onSubmit={saveSettings} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-slate-900">Einstellungen</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Vorname" className={inputCls} />
              <input type="text" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Nachname" className={inputCls} />
            </div>
            <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Telefon" className={inputCls} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Provisionssatz % (leer = Standard)</label>
                <input type="text" inputMode="decimal" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Monatsziel € (optional)</label>
                <input type="text" inputMode="decimal" value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">Satzänderungen wirken nur auf ZUKÜNFTIGE Provisionen — bestehende Einträge behalten den eingefrorenen Satz.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy === "save"} className={btnPrimary}>{busy === "save" ? "…" : "Speichern"}</button>
              <button type="button" onClick={(e) => action(e, `/admin/agents/${id}/toggle`, a.active ? "Deaktiviert" : "Aktiviert")} className={btnGhost}>
                {a.active ? "Deaktivieren" : "Aktivieren"}
              </button>
              {!a.has_password && (
                <button type="button" onClick={(e) => action(e, `/admin/agents/${id}/reinvite`, "Einladung erneut gesendet (alter Link verfällt)")} className={btnGhost}>
                  Einladung erneut senden
                </button>
              )}
              <button
                type="button"
                onClick={(e) => action(e, `/admin/agents/${id}/force-reset`, "Passwort-Reset erzwungen — alle Sitzungen beendet", `Passwort-Reset für ${a.name} erzwingen?\n\nAlle laufenden Sitzungen werden sofort beendet, der Mitarbeiter erhält eine Reset-E-Mail (1 h gültig).`)}
                className={btnGhost}
              >
                Passwort-Reset erzwingen
              </button>
            </div>
          </form>

          {/* Tabs */}
          <div className="flex gap-2">
            {([["kunden", `Kunden (${data.customers.length})`], ["provisionen", `Provisionen (${data.commissions.length})`], ["aktivitaet", "Aktivität"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setTab(key); }}
                className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                  tab === key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Kunden + Neuzuweisung (einzeln + Masse) */}
          {tab === "kunden" && (
            <div className="space-y-3">
              <div className="flex gap-2 items-center">
                <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className={inputCls} style={{ maxWidth: 260 }}>
                  <option value="">Zuweisung entfernen</option>
                  {agents.filter((x) => x.id !== id && x.active).map((x) => (
                    <option key={x.id} value={x.id}>Übertragen an {x.name}</option>
                  ))}
                </select>
                <button type="button" onClick={(e) => reassign(e, Array.from(selectedRefs))} disabled={busy === "reassign" || selectedRefs.size === 0} className={btnGhost}>
                  {selectedRefs.size > 0 ? `${selectedRefs.size} ausgewählte übertragen` : "Auswahl übertragen"}
                </button>
                <button
                  type="button"
                  onClick={(e) => reassign(e, data.customers.map((c: any) => c.ref))}
                  disabled={busy === "reassign" || data.customers.length === 0}
                  className={btnGhost}
                >
                  Alle übertragen
                </button>
              </div>
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-50 max-h-80 overflow-y-auto">
                {data.customers.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-slate-400">Keine offenen zugewiesenen Kunden.</p>}
                {data.customers.map((c: any) => {
                  const name = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || c.ref;
                  const checked = selectedRefs.has(c.ref);
                  return (
                    <label key={c.ref} className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-slate-50/70">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedRefs((s) => { const n = new Set(s); checked ? n.delete(c.ref) : n.add(c.ref); return n; })}
                        className="accent-[#2563eb]"
                      />
                      <span className="text-[13px] font-medium text-slate-800 flex-1 truncate">{name}</span>
                      <span className="text-[11px] text-slate-400 font-mono">{c.payment_reference || c.ref}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Provisions-Historie */}
          {tab === "provisionen" && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {data.commissions.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-slate-400">Noch keine Provisionen.</p>}
              {data.commissions.map((k: any) => (
                <div key={k.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold tabular-nums">
                      {fmtCents(k.amount_cents)}
                      <span className="font-normal text-slate-400 text-[11px]"> · {(k.rate_bp / 100).toLocaleString("de-DE")} % von {fmtCents(k.base_amount_cents)}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{k.ref}{k.note ? ` · ${k.note}` : ""} · {fmtDT(k.created_at)}</p>
                  </div>
                  <span className="shrink-0 px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500">
                    {k.status === "bestaetigt" ? "Bestätigt" : k.status === "in_auszahlung" ? "In Auszahlung" : k.status === "ausgezahlt" ? "Ausgezahlt" : "Storniert"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Aktivitäts-Log */}
          {tab === "aktivitaet" && (
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {[...data.events.map((ev: any) => ({ ...ev, kind: "event" })), ...data.contactLog.map((l: any) => ({ ...l, kind: "contact" }))]
                .sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime())
                .slice(0, 100)
                .map((item: any) => (
                  <div key={`${item.kind}-${item.id}`} className="px-4 py-2.5">
                    <p className="text-[12px] font-medium text-slate-700">
                      {item.kind === "event" ? item.type : `${item.type}${item.outcome ? `: ${item.outcome}` : ""} · ${item.ref}`}
                    </p>
                    <p className="text-[11px] text-slate-400">{fmtDT(item.created_at)}{item.note ? ` · ${item.note}` : ""}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ G1: Einstellungen ═══════════════

function SettingsCard({ flash, onSaved }: { flash: (m: string) => void; onSaved: () => void }) {
  const [form, setForm] = useState({ rate: "", min: "" });
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api("/admin/settings"), api("/admin/scripts")]).then(([s, sc]) => {
      if (s.ok) {
        setForm({
          rate: String(s.json.settings.defaultCommissionRateBp / 100).replace(".", ","),
          min: String(s.json.settings.payoutMinCents / 100).replace(".", ","),
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

function ScriptsAdmin({ flash }: { flash: (m: string) => void }) {
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
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
