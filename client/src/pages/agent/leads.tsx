import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Phone, ArrowLeft, Send, Pencil, Users } from "lucide-react";
import {
  AgentShell, api, Card, Badge, fmtDT, fmtD, inputCls, btnPrimary, btnGhost, FlashMessage,
} from "./shared";

// ════════════════════════════════════════════════════════════════════
// Agent-Anrufliste „Leads" (Paket BC1) — getrennt von „Kunden".
// Zweck: Interessenten ohne Antrag reaktivieren und zum Abschluss bringen.
// Priorisierung: offene Kunden-Anträge haben Vorrang (Hinweis im Kopf).
// ════════════════════════════════════════════════════════════════════

const LEAD_STATUS: Record<string, string> = {
  neu: "Neu",
  kontaktiert: "Kontaktiert",
  nicht_erreichbar: "Nicht erreichbar",
  konvertiert: "Konvertiert",
  kein_interesse: "Kein Interesse",
  tot: "Tot",
};

const OUTCOMES: { key: string; label: string; needsDate?: boolean }[] = [
  { key: "erreicht_interesse", label: "Erreicht — Interesse" },
  { key: "erreicht_kein_interesse", label: "Kein Interesse" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "mailbox", label: "Mailbox" },
  { key: "rueckruf_termin", label: "Rückruf am…", needsDate: true },
  { key: "nummer_falsch", label: "Nummer falsch" },
];

function ageDays(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "heute" : d === 1 ? "1 Tag" : `${d} Tage`;
}

function LeadDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ vorname: "", nachname: "", email: "", telefon: "" });
  const [rueckrufAt, setRueckrufAt] = useState("");
  // Paket DD: Zwei-Schritt-Bestätigung — erst auswählen, dann bestätigen
  const [armed, setArmed] = useState<string | null>(null);

  const load = useCallback(() => {
    api(`/agent/leads/${id}`).then((r) => {
      if (r.ok) {
        setLead(r.json.lead);
        setLog(r.json.log || []);
        setReadOnly(!!r.json.readOnly);
        setEdit({
          vorname: r.json.lead.vorname || "", nachname: r.json.lead.nachname || "",
          email: r.json.lead.email || "", telefon: r.json.lead.telefon || "",
        });
      }
    });
  }, [id]);
  useEffect(load, [load]);

  if (!lead) return null;
  const name = [lead.vorname, lead.nachname].filter(Boolean).join(" ") || lead.email || lead.telefon || `Lead #${lead.id}`;

  const result = async (outcome: string) => {
    if (outcome === "rueckruf_termin" && !rueckrufAt) { setFlash("Bitte Rückruf-Termin wählen."); return; }
    // Paket DD: erster Klick wählt aus, zweiter Klick bestätigt — kein Versehen mehr
    if (armed !== outcome) { setArmed(outcome); return; }
    setArmed(null);
    setBusy(true);
    const r = await api(`/agent/leads/${id}/contact-result`, {
      method: "POST",
      body: JSON.stringify({ outcome, scheduledAt: outcome === "rueckruf_termin" ? rueckrufAt : null }),
    });
    setBusy(false);
    if (r.ok) { setFlash("Ergebnis gespeichert — der Lead bleibt in deiner Liste bzw. wandert in den passenden Status."); setRueckrufAt(""); load(); onChanged(); }
    else setFlash(r.json?.error || "Fehler.");
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    const r = await api(`/agent/leads/${id}/notes`, { method: "POST", body: JSON.stringify({ note }) });
    setBusy(false);
    if (r.ok) { setNote(""); setFlash("Notiz gespeichert."); load(); } else setFlash(r.json?.error || "Fehler.");
  };

  const saveEdit = async () => {
    setBusy(true);
    const r = await api(`/agent/leads/${id}/contact-data`, { method: "PATCH", body: JSON.stringify(edit) });
    setBusy(false);
    if (r.ok) { setEditing(false); setFlash("Kontaktdaten gespeichert."); load(); onChanged(); } else setFlash(r.json?.error || "Fehler.");
  };

  const moveToApplication = async () => {
    setBusy(true);
    const r = await api(`/agent/leads/${id}/move-to-application`, { method: "POST" });
    setBusy(false);
    if (r.ok) { setFlash("Antrags-Link an den Interessenten gesendet."); load(); onChanged(); } else setFlash(r.json?.error || "Fehler.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-6 px-3" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><ArrowLeft size={15} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold text-slate-900 truncate">{name}</p>
            <p className="text-[11px] text-slate-400">Quelle: {lead.quelle || "—"} · Alter: {ageDays(lead.erstellt_am)}</p>
          </div>
          <Badge label={LEAD_STATUS[lead.status] || lead.status} />
        </div>

        <div className="p-5 space-y-4">
          <FlashMessage message={flash} />

          {/* Kontakt */}
          <div className="flex flex-wrap gap-2">
            {lead.telefon && (
              <a href={`tel:${lead.telefon}`} className={btnPrimary + " inline-flex items-center gap-2"}>
                <Phone size={14} /> {lead.telefon}
              </a>
            )}
            {lead.email && <span className="px-3 py-2.5 rounded-lg border border-slate-200 text-[13px] text-slate-600">{lead.email}</span>}
            {!readOnly && (
              <button className={btnGhost + " inline-flex items-center gap-2"} onClick={() => setEditing((v) => !v)}>
                <Pencil size={13} /> Daten korrigieren
              </button>
            )}
          </div>

          {editing && !readOnly && (
            <Card className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input className={inputCls} placeholder="Vorname" value={edit.vorname} onChange={(e) => setEdit({ ...edit, vorname: e.target.value })} />
                <input className={inputCls} placeholder="Nachname" value={edit.nachname} onChange={(e) => setEdit({ ...edit, nachname: e.target.value })} />
              </div>
              <input className={inputCls} placeholder="E-Mail" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              <input className={inputCls} placeholder="Telefon (+49 …)" value={edit.telefon} onChange={(e) => setEdit({ ...edit, telefon: e.target.value })} />
              <button className={btnPrimary} disabled={busy} onClick={saveEdit}>Speichern</button>
            </Card>
          )}

          {!readOnly && (
            <>
              {/* Kontakt-Ergebnisse */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kontakt-Ergebnis</p>
                <div className="flex flex-col gap-2">
                  <input type="datetime-local" className={inputCls} value={rueckrufAt} onChange={(e) => setRueckrufAt(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    {OUTCOMES.map((o) => (
                      <button key={o.key} disabled={busy} onClick={() => result(o.key)}
                        className={`${btnGhost} text-left ${armed === o.key ? "!border-[#2563eb] !text-[#2563eb]" : ""}`}>
                        {armed === o.key ? `Bestätigen: ${o.label}` : o.label}
                      </button>
                    ))}
                  </div>
                  {armed && (
                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-[11.5px] text-slate-500">Zum Speichern erneut auf den markierten Button tippen.</p>
                      <button className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600" onClick={() => setArmed(null)}>Abbrechen</button>
                    </div>
                  )}
                </div>
              </div>

              <button className={btnPrimary + " w-full inline-flex items-center justify-center gap-2"} disabled={busy} onClick={moveToApplication}>
                <Send size={14} /> Zum Antrag bewegen (Link senden)
              </button>

              {/* Notiz */}
              <div>
                <textarea className={inputCls} rows={2} placeholder="Notiz hinzufügen…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className={btnGhost + " mt-2"} disabled={busy || !note.trim()} onClick={saveNote}>Notiz speichern</button>
              </div>
            </>
          )}

          {/* Historie */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kontakthistorie</p>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {log.length === 0 && <p className="text-[12px] text-slate-400">Noch keine Einträge.</p>}
              {log.map((e) => (
                <div key={e.id} className="text-[12px] border-l-2 border-slate-200 pl-3 py-0.5">
                  <p className="text-slate-700">{e.note || e.outcome || e.type}</p>
                  <p className="text-slate-400 text-[11px]">{e.agent_name} · {fmtDT(e.created_at)}{e.scheduled_at ? ` · Termin ${fmtDT(e.scheduled_at)}` : ""}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AgentLeadsPage() {
  const [leads, setLeads] = useState<any[]>([]);
  const [openCustomers, setOpenCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api("/agent/leads").then((r) => {
      if (r.ok) { setLeads(r.json.data || []); setOpenCustomers(Number(r.json.openCustomerCount) || 0); }
    }).finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <AgentShell onRefresh={load}>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Leads</h1>
        <p className="text-[13px] text-slate-500">Interessenten ohne Antrag — reaktivieren und zum Abschluss bringen.</p>
      </div>

      {/* Priorisierungs-Hinweis (BC1) */}
      {openCustomers > 0 ? (
        <div className="mb-4 px-4 py-3 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 flex items-center gap-2">
          <Users size={15} className="text-slate-400 shrink-0" />
          Du hast <b className="mx-1">{openCustomers}</b> offene Kunden-Anträge — diese haben Vorrang.
          <Link href="/agent/kunden" className="ml-auto font-semibold" style={{ color: "#2563eb" }}>Zu den Kunden</Link>
        </div>
      ) : (
        <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[13px] text-slate-600">
          Keine offenen Kunden — jetzt Leads reaktivieren.
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-slate-400">Lädt…</p>
      ) : leads.length === 0 ? (
        <Card className="p-8 text-center text-[13px] text-slate-400">Aktuell keine offenen Leads zugewiesen.</Card>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const name = [l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`;
            return (
              <Card key={l.id} className="p-4 flex items-center gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpenId(l.id)}>
                  <p className="text-[14px] font-semibold text-slate-900 truncate">{name}</p>
                  <p className="text-[12px] text-slate-400 truncate">
                    {l.telefon || l.email || "—"} · {l.quelle || "—"} · {ageDays(l.erstellt_am)}
                  </p>
                </button>
                <Badge label={LEAD_STATUS[l.status] || l.status} />
                {l.telefon && (
                  <a href={`tel:${l.telefon}`} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 flex items-center justify-center shrink-0" title="Anrufen">
                    <Phone size={15} />
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {openId !== null && <LeadDetail id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </AgentShell>
  );
}
