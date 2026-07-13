import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Send, Users, Play, Settings2, X, Upload, Pencil, Check, Link2, Activity } from "lucide-react";
import ImportDialog from "./admin-leads-import";

// ════════════════════════════════════════════════════════════════════
// /admin/leads — Lead-Management (Pakete BA/BB/BC).
// Läuft in der AdminShell (Sidebar/Breadcrumb liefert der Wrapper).
// Design: monochrom slate, Akzent #2563eb, keine bunten Icons/Emojis.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

const STATUS: Record<string, string> = {
  neu: "Neu", kontaktiert: "Kontaktiert", nicht_erreichbar: "Nicht erreichbar",
  konvertiert: "Konvertiert", kein_interesse: "Kein Interesse", tot: "Tot",
};
// BE3: gruppierte Filter-Chips (Alle · Offen · Konvertiert · Tot/Kein Interesse)
const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "", label: "Alle", statuses: [] },
  { key: "offen", label: "Offene Leads", statuses: ["neu", "kontaktiert", "nicht_erreichbar"] },
  { key: "konvertiert", label: "Konvertiert (Kunde)", statuses: ["konvertiert"] },
  { key: "tot", label: "Tot / Kein Interesse", statuses: ["tot", "kein_interesse"] },
];

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtD(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}
const PAY_LABEL: Record<string, string> = { pending_payment: "offen", claimed_paid: "angekündigt", paid: "bezahlt", expired: "abgelaufen", refunded: "erstattet" };

function fmtDT(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function ageDays(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "heute" : d === 1 ? "1 Tag" : `${d} Tage`;
}

function EnginePanel({ onAction }: { onAction: (msg: string) => void }) {
  const [s, setS] = useState<any>(null);
  const [bulk, setBulk] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const [sentToday, setSentToday] = useState<number | null>(null);
  const load = useCallback(() => {
    apiF("/admin/leads/settings").then((r) => { if (r.ok) { setS(r.json.settings); setSentToday(r.json.sentToday ?? null); } });
    apiF("/admin/leads/followup-bulk/preview").then((r) => r.ok && setBulk(r.json));
    apiF("/admin/leads/followup-bulk/status").then((r) => r.ok && setJob(r.json.job));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(() => apiF("/admin/leads/followup-bulk/status").then((r) => r.ok && setJob(r.json.job)), 5000);
    return () => clearInterval(t);
  }, [job?.running]);

  if (!s) return null;
  const set = (k: string, v: string) => setS({ ...s, [k]: v });
  const save = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/settings", { method: "POST", body: JSON.stringify(s) });
    setBusy(false);
    onAction(r.ok ? "Einstellungen gespeichert." : "Fehler beim Speichern.");
  };
  const runNow = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/run-followups", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? `Nachfass-Lauf: ${r.json.sent} gesendet, ${r.json.markedDead} auf „tot".` : "Fehler.");
    load();
  };
  const startBulk = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/followup-bulk/start", { method: "POST" });
    setBusy(false);
    if (r.ok) { onAction(`Bulk gestartet: ${r.json.planned} geplant.`); load(); }
    else onAction(r.json?.error || "Bulk konnte nicht gestartet werden.");
  };
  const distribute = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/distribute", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? `${r.json.assigned} Lead(s) verteilt.` : "Fehler.");
  };
  const backfill = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/backfill-convert", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? `Backfill: ${r.json.converted} Lead(s) rückwirkend konvertiert.` : "Fehler.");
  };

  const inp = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] w-full";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Settings2 size={15} className="text-slate-400" />
        <p className="text-[13px] font-semibold text-slate-800">Nachfass-Automatik & Verteilung</p>
        {sentToday != null && <span className="text-[11px] font-semibold text-slate-500">Heute versendet: {sentToday}</span>}
        <span className="ml-auto text-[11px] text-slate-400">{bulk?.withinWindow ? "Versandfenster offen (08–20 Uhr)" : "außerhalb Versandfenster"}</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        <label className="text-[12px] text-slate-500">Engine
          <select className={inp} value={s.lead_followup_enabled} onChange={(e) => set("lead_followup_enabled", e.target.value)}>
            <option value="1">An</option><option value="0">Aus (Not-Aus)</option>
          </select>
        </label>
        <label className="text-[12px] text-slate-500">Nachfass-Tage
          <input className={inp} value={s.lead_followup_days} onChange={(e) => set("lead_followup_days", e.target.value)} placeholder="1,2,4,7" />
        </label>
        <label className="text-[12px] text-slate-500">Fenster Start–Ende
          <div className="flex gap-1">
            <input className={inp} value={s.lead_followup_window_start} onChange={(e) => set("lead_followup_window_start", e.target.value)} />
            <input className={inp} value={s.lead_followup_window_end} onChange={(e) => set("lead_followup_window_end", e.target.value)} />
          </div>
        </label>
        <label className="text-[12px] text-slate-500">Max. Nachfässe
          <input className={inp} value={s.max_lead_followups} onChange={(e) => set("max_lead_followups", e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={save} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Speichern</button>
        <button disabled={busy} onClick={runNow} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5"><Play size={13} /> Jetzt ausführen</button>
        <button disabled={busy || job?.running} onClick={startBulk} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5">
          <Send size={13} /> Bulk an alle offenen{bulk ? ` (${bulk.eligible} senden / ${bulk.skipped} übersprungen)` : ""}
        </button>
        <button disabled={busy} onClick={distribute} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5"><Users size={13} /> Verteilen</button>
        <button disabled={busy} onClick={backfill} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Backfill-Konversion</button>
      </div>
      {job?.running && <p className="mt-2 text-[12px] text-slate-500">Bulk läuft: {job.sent}/{job.planned} gesendet, {job.errors} Fehler …</p>}
      {job && !job.running && job.finishedAt && <p className="mt-2 text-[12px] text-slate-400">Letzter Bulk: {job.sent}/{job.planned} gesendet, {job.errors} Fehler.</p>}
    </div>
  );
}

function IntakeDiagnostics({ onAction }: { onAction: (msg: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { apiF("/admin/leads/intake-diagnostics").then((r) => r.ok && setD(r.json)); }, []);
  useEffect(load, [load]);
  if (!d) return null;
  const testIntake = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/test-intake", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? `Test-Lead angelegt (HTTP ${r.json.httpStatus}) — Intake funktioniert.` : (r.json?.error || `Test fehlgeschlagen (HTTP ${r.json?.httpStatus ?? "?"}).`));
    load();
  };
  const delTests = async () => { setBusy(true); const r = await apiF("/admin/leads/test-leads", { method: "DELETE" }); setBusy(false); onAction(r.ok ? `${r.json.deleted} Test-Lead(s) gelöscht.` : "Fehler."); load(); };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={15} className="text-slate-400" />
        <p className="text-[13px] font-semibold text-slate-800">Lead-Eingang (Intake) — Test & Diagnose</p>
        <span className={`ml-auto text-[11px] font-semibold ${d.secretConfigured ? "text-emerald-600" : "text-amber-600"}`}>{d.secretConfigured ? "Secret konfiguriert" : "LEAD_INTAKE_SECRET fehlt"}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div><p className="text-[11px] text-slate-400">Letzter Intake</p><p className="text-[13px] font-semibold text-slate-800">{d.lastIntake ? fmtDT(d.lastIntake.created_at) : "—"}</p><p className="text-[11px] text-slate-400">{d.lastIntake?.quelle || ""}</p></div>
        <div><p className="text-[11px] text-slate-400">Intakes 24h / 7d</p><p className="text-[13px] font-semibold text-slate-800 tabular-nums">{d.counts.ok24h} / {d.counts.ok7d}</p></div>
        <div><p className="text-[11px] text-slate-400">Abgelehnt (Auth, 7d)</p><p className="text-[13px] font-semibold text-slate-800 tabular-nums">{d.counts.rejected7d}</p></div>
        <div><p className="text-[11px] text-slate-400">Ungültig (7d)</p><p className="text-[13px] font-semibold text-slate-800 tabular-nums">{d.counts.invalid7d}</p></div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button disabled={busy} onClick={testIntake} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Test-Lead simulieren</button>
        <button disabled={busy} onClick={delTests} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Test-Leads löschen</button>
      </div>
      <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
        <p>Erwartetes Format an <span className="font-mono text-slate-500">{d.doc.intakeUrl}</span> · Header <span className="font-mono text-slate-500">{d.doc.secretHeader}: &lt;LEAD_INTAKE_SECRET&gt;</span></p>
        <p>Felder: <span className="font-mono text-slate-500">{d.doc.payloadFields.join(", ")}</span></p>
        {d.recentRejected?.length > 0 && (
          <div className="mt-2">
            <p className="font-semibold text-slate-500">Zuletzt abgelehnt:</p>
            {d.recentRejected.map((r: any, i: number) => <p key={i}>{fmtDT(r.created_at)} · {r.status} · {r.detail}</p>)}
          </div>
        )}
      </div>
    </div>
  );
}

const RESULTS = [
  { key: "erreicht_interesse", label: "Erreicht – Interesse" },
  { key: "erreicht_kein_interesse", label: "Kein Interesse" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "mailbox", label: "Mailbox" },
  { key: "rueckruf_termin", label: "Rückruf vereinbart" },
  { key: "nummer_falsch", label: "Falsche Nummer" },
];
const MANUAL_STATUS = ["neu", "kontaktiert", "nicht_erreichbar", "kein_interesse", "tot"];
const OPEN = ["neu", "kontaktiert", "nicht_erreichbar"];

function LeadDrawer({ id, agents, onClose, onChanged }: { id: number; agents: any[]; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", telefon: "" });
  const [note, setNote] = useState("");
  const [rueckruf, setRueckruf] = useState("");

  const load = useCallback(() => {
    apiF(`/admin/leads/${id}`).then((r) => { if (r.ok) { setLead(r.json.lead); setLog(r.json.log || []); } });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);
  if (!lead) return null;

  const name = [lead.vorname, lead.nachname].filter(Boolean).join(" ") || lead.email || lead.telefon || `Lead #${lead.id}`;
  const isOpen = OPEN.includes(lead.status);
  const refresh = () => { load(); onChanged(); };
  const act = async (path: string, body?: any, okMsg?: string) => {
    setBusy(true);
    const r = await apiF(`/admin/leads/${id}${path}`, { method: body === undefined ? "POST" : "POST", body: JSON.stringify(body || {}) });
    setBusy(false);
    setMsg(r.ok ? (okMsg || "Erledigt.") : (r.json?.error || "Fehler."));
    if (r.ok) refresh();
    return r.ok;
  };
  const assign = async (agentId: string) => {
    const r = await apiF(`/admin/leads/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId: agentId === "" ? null : Number(agentId) }) });
    if (r.ok) { setMsg("Zuweisung aktualisiert."); refresh(); }
  };
  const startEdit = () => { setForm({ vorname: lead.vorname || "", nachname: lead.nachname || "", email: lead.email || "", telefon: lead.telefon || "" }); setEditing(true); };
  const saveEdit = async () => {
    setBusy(true);
    const r = await apiF(`/admin/leads/${id}/contact-data`, { method: "PATCH", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setEditing(false); setMsg("Kontaktdaten gespeichert."); refresh(); } else setMsg(r.json?.error || "Fehler.");
  };
  const result = async (key: string) => {
    if (key === "rueckruf_termin" && !rueckruf) { setMsg("Bitte Rückruf-Termin wählen."); return; }
    await act("/contact-result", { outcome: key, scheduledAt: key === "rueckruf_termin" ? new Date(rueckruf).toISOString() : null }, "Kontakt-Ergebnis gespeichert.");
    setRueckruf("");
  };
  const sendNote = async () => { if (!note.trim()) return; if (await act("/notes", { note: note.trim() }, "Notiz gespeichert.")) setNote(""); };

  const ipt = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] w-full";
  const btnS = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-slate-900 truncate">{name}</p>
            <p className="text-[11px] text-slate-400">{STATUS[lead.status]} · Quelle {lead.quelle || "—"}{lead.kampagne ? ` · ${lead.kampagne}` : ""}</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><X size={15} /></button>
        </div>

        {msg && <div className="mx-5 mt-3 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700">{msg}</div>}

        <div className="p-5 space-y-4 text-[13px]">
          {/* Kontaktdaten (bearbeitbar) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kontaktdaten</p>
              {!editing && <button onClick={startEdit} className="text-[11px] text-slate-500 inline-flex items-center gap-1 hover:text-slate-800"><Pencil size={12} /> Bearbeiten</button>}
            </div>
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className={ipt} placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })} />
                  <input className={ipt} placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })} />
                </div>
                <input className={ipt} placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={ipt} placeholder="Telefon (+49 …)" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1" style={{ background: ACCENT }}><Check size={13} /> Speichern</button>
                  <button onClick={() => setEditing(false)} className={btnS}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div><span className="text-slate-400">E-Mail</span><br />{lead.email || "—"}</div>
                <div><span className="text-slate-400">Telefon</span><br />{lead.telefon || "—"}</div>
                <div><span className="text-slate-400">Angelegt</span><br />{fmtDT(lead.erstellt_am)}</div>
                <div><span className="text-slate-400">Letzter Kontakt</span><br />{fmtDT(lead.letzter_kontakt_am)}</div>
                {lead.converted_order_id && <div className="col-span-2"><span className="text-slate-400">Konvertiert → Antrag</span><br />{lead.converted_order_id}</div>}
              </div>
            )}
          </div>

          {/* Versand-Aktionen */}
          {isOpen && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act("/send-application-link", {}, "Antrags-/Zahlungslink gesendet.")} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT }}><Link2 size={13} /> Antrag/Zahlungslink senden</button>
              <button disabled={busy} onClick={() => act("/send-followup", {}, "Follow-up gesendet.")} className={btnS + " inline-flex items-center gap-1.5"}><Send size={13} /> Follow-up jetzt</button>
            </div>
          )}

          {/* Kontakt-Ergebnis */}
          {isOpen && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kontakt-Ergebnis</p>
              <div className="grid grid-cols-2 gap-2">
                {RESULTS.map((o) => (
                  <button key={o.key} disabled={busy} onClick={() => result(o.key)} className={btnS + " text-left"}>{o.label}</button>
                ))}
              </div>
              <input type="datetime-local" value={rueckruf} onChange={(e) => setRueckruf(e.target.value)} className={ipt + " mt-2"} />
            </div>
          )}

          {/* Manueller Status + Zuweisung */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Status</p>
              <select disabled={lead.status === "konvertiert"} className={ipt} value={MANUAL_STATUS.includes(lead.status) ? lead.status : ""} onChange={(e) => act("/status", { status: e.target.value }, "Status gesetzt.")}>
                {lead.status === "konvertiert" ? <option value="">Konvertiert</option> : MANUAL_STATUS.map((st) => <option key={st} value={st}>{STATUS[st]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Zuweisung</p>
              <select className={ipt} value={lead.assigned_agent_id || ""} onChange={(e) => assign(e.target.value)}>
                <option value="">— nicht zugewiesen —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.active ? "" : " (inaktiv)"}</option>)}
              </select>
            </div>
          </div>

          {/* Notiz */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Notiz hinzufügen</p>
            <textarea className={ipt} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interne Notiz …" />
            <button disabled={busy || !note.trim()} onClick={sendNote} className={btnS + " mt-1"}>Notiz speichern</button>
          </div>

          {/* Historie */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 inline-flex items-center gap-1"><Activity size={12} /> Historie</p>
            <div className="space-y-2">
              {log.length === 0 && <p className="text-[12px] text-slate-400">Keine Einträge.</p>}
              {log.map((e) => (
                <div key={e.id} className="border-l-2 border-slate-200 pl-3 py-0.5">
                  <p className="text-slate-700 text-[12px]">{e.note || e.outcome || e.type}{e.scheduled_at ? ` · Termin ${fmtDT(e.scheduled_at)}` : ""}</p>
                  <p className="text-slate-400 text-[11px]">{e.agent_name} · {fmtDT(e.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminLeadsPage() {
  const [data, setData] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [group, setGroup] = useState("");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (group) params.set("group", group);
    if (q.trim()) params.set("q", q.trim());
    apiF(`/admin/leads?${params.toString()}`).then((r) => {
      if (r.ok) { setData(r.json.data || []); setCounts(r.json.counts || {}); setStats(r.json.stats || null); }
    }).finally(() => setLoading(false));
  }, [group, q]);
  useEffect(load, [load]);
  useEffect(() => { apiF("/admin/agents").then((r) => r.ok && setAgents(r.json.data || [])); }, []);
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 4000); return () => clearTimeout(t); } }, [flash]);

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-[13px] text-slate-500">Interessenten aus Lead-Ads und Import — automatisch verknüpft, nachgefasst und an das Team verteilt.</p>
        </div>
        <button onClick={() => setShowImport(true)} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0" style={{ background: ACCENT }}><Upload size={13} /> Leads importieren</button>
      </div>

      {flash && <div className="mb-4 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-[13px] text-slate-700">{flash}</div>}

      {/* BE3: Kennzahlen X Leads → Y Kunden → Z zahlend */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Leads gesamt</p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.total}</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Konvertiert</p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.converted}{stats.convertedPct != null ? <span className="text-[12px] font-medium text-slate-400"> · {stats.convertedPct}%</span> : null}</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Zahlend</p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.paying}<span className="text-[12px] font-medium text-slate-400"> · {eur(stats.revenueCents)}</span></p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400">Offene Leads</p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.open}</p></div>
        </div>
      )}

      <EnginePanel onAction={(m) => { setFlash(m); load(); }} />
      <IntakeDiagnostics onAction={(m) => setFlash(m)} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {GROUPS.map((g) => {
          const c = g.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
          return (
            <button key={g.key} onClick={() => setGroup(g.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${group === g.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
              {g.label}{g.key ? ` (${c})` : ""}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, E-Mail, Telefon…" className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] w-52" />
          <button onClick={load} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold">Kontakt</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden sm:table-cell">Quelle</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Agent</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden lg:table-cell">Kunde / Zahlung</th>
              <th className="text-left px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Lädt…</td></tr>}
            {!loading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Keine Leads.</td></tr>}
            {data.map((l) => {
              const name = [l.vorname, l.nachname].filter(Boolean).join(" ") || "—";
              const isConv = l.status === "konvertiert";
              return (
                <tr key={l.id} onClick={() => setOpenId(l.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{name}</td>
                  <td className="px-4 py-2.5 text-slate-500">{l.telefon || l.email || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">{l.kampagne || l.quelle || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{l.agent_name || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell text-[12px]">
                    {isConv && l.converted_order_id
                      ? <span>Kunde seit {fmtD(l.konvertiert_am)}<br /><span className="text-slate-400">{l.converted_order_id} · {PAY_LABEL[l.payment_status] || l.payment_status || "—"}{l.amount_due != null ? ` · ${eur(Math.round(Number(l.amount_due) * 100))}` : ""}</span></span>
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500">{STATUS[l.status] || l.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId !== null && <LeadDrawer id={openId} agents={agents} onClose={() => setOpenId(null)} onChanged={load} />}
      {showImport && <ImportDialog onClose={() => { setShowImport(false); load(); }} onDone={(m) => setFlash(m)} />}
    </div>
  );
}
