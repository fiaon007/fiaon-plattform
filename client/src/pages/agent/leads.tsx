import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Phone, ArrowLeft, Send, Pencil, Users, Lock, FolderOpen, ShieldCheck, ChevronDown, Search, Archive, PhoneCall, X } from "lucide-react";
import {
  AgentShell, api, Card, Badge, fmtDT, fmtD, inputCls, btnPrimary, btnGhost, FlashMessage,
} from "./shared";

// Ticket #15: Gründe fürs Aussortieren („aus meiner Liste entfernen" — nie gelöscht).
const DISMISS_REASONS: { key: string; label: string }[] = [
  { key: "keine_telefonnummer", label: "keine Telefonnummer" },
  { key: "nummer_ungueltig", label: "Nummer ungültig" },
  { key: "kein_interesse", label: "kein Interesse" },
  { key: "dublette", label: "Dublette" },
];

// ════════════════════════════════════════════════════════════════════
// P2-C — ARBEITSWARTESCHLANGE (statt Lead-Friedhof).
// Kontaktdaten sind VERDECKT, bis der Agent die Akte öffnet (dokumentierte
// Übernahme, Bestätigungs-Dialog). Nur EINE offene Akte gleichzeitig — die
// nächste erst nach dokumentiertem Kontakt-Ergebnis. Reihenfolge kommt vom
// Server (Score + Fairness); der Agent sieht bewusst nicht, warum ein Lead
// oben steht. Mobil UND Desktop vollständig bedienbar.
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
  // Ticket #15: „Aus meiner Liste entfernen" (nie gelöscht)
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

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
    if (r.ok) { setFlash("Ergebnis gespeichert — Akte geschlossen. Du kannst jetzt die nächste Akte öffnen."); setRueckrufAt(""); load(); onChanged(); }
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

  // V2 (Phase 2B): Notausgang — Akte ohne Ergebnis schließen (Begründung Pflicht).
  // Der Agent darf sich nie ausgesperrt fühlen; zählt NICHT als Kontakt.
  const closeWithoutResult = async () => {
    const reason = window.prompt("Akte ohne Kontakt-Ergebnis schließen — kurze Begründung (z. B. Feierabend, Kunde legte auf):");
    if (reason === null) return;
    setBusy(true);
    const r = await api(`/agent/leads/${id}/close-akte`, { method: "POST", body: JSON.stringify({ reason }) });
    setBusy(false);
    if (r.ok) { onChanged(); onClose(); } else setFlash(r.json?.error || "Fehler.");
  };

  // Ticket #15: „Aus meiner Liste entfernen" — Lead verlässt die Warteschlange,
  // bleibt aber vollständig gespeichert (nie gelöscht). Grund Pflicht, alles im Audit.
  const dismiss = async () => {
    if (!dismissReason) { setFlash("Bitte einen Grund wählen."); return; }
    setBusy(true);
    const r = await api(`/agent/leads/${id}/dismiss`, { method: "POST", body: JSON.stringify({ reason: dismissReason }) });
    setBusy(false);
    if (r.ok) { onChanged(); onClose(); } else setFlash(r.json?.error || "Fehler.");
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
                  <p className="text-[11px] text-slate-400 -mt-1">Uhrzeit in deutscher Zeit (Europe/Berlin)</p>
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

              {/* V2: Notausgang — nie ausgesperrt sein */}
              {lead.opened_at && (
                <button className="w-full text-[12px] text-slate-400 hover:text-slate-600 py-1" disabled={busy} onClick={closeWithoutResult}>
                  Akte schließen ohne Ergebnis (mit Begründung) — Lead geht zurück in die Warteschlange
                </button>
              )}

              {/* Ticket #15: Aus meiner Liste entfernen (nie gelöscht) */}
              <div className="pt-2 border-t border-slate-100">
                {!dismissOpen ? (
                  <button className="w-full text-[12px] font-semibold text-slate-500 hover:text-slate-700 py-1.5 inline-flex items-center justify-center gap-1.5"
                    disabled={busy} onClick={() => setDismissOpen(true)}>
                    <Archive size={13} /> Aus meiner Liste entfernen
                  </button>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-[12px] font-semibold text-slate-700">Aus meiner Liste entfernen</p>
                    <p className="text-[11.5px] text-slate-500">Leads werden nie gelöscht — sie verschwinden nur aus deiner Liste. Der Admin kann sie jederzeit zurückholen.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DISMISS_REASONS.map((rsn) => (
                        <button key={rsn.key} onClick={() => setDismissReason(rsn.key)}
                          className={`px-2.5 py-2 rounded-lg border text-[12px] font-medium text-left ${dismissReason === rsn.key ? "!border-[#2563eb] !text-[#2563eb] bg-[#2563eb]/5" : "border-slate-200 text-slate-600"}`}>
                          {rsn.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button className={btnPrimary + " flex-1"} disabled={busy || !dismissReason} onClick={dismiss}>
                        {busy ? "Entfernt…" : "Entfernen"}
                      </button>
                      <button className={btnGhost} disabled={busy} onClick={() => { setDismissOpen(false); setDismissReason(""); }}>Abbrechen</button>
                    </div>
                  </div>
                )}
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

/** Bestätigungs-Dialog „Akte übernehmen?" — Klick + Bestätigen (kein Versehen). */
function ConfirmOpenSheet({ lead, busy, onConfirm, onCancel }: {
  lead: any; busy: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative w-full sm:max-w-md bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center shrink-0">
            <FolderOpen size={18} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-slate-900">Akte übernehmen?</p>
            <p className="text-[12px] text-slate-500">{lead.quelle || "Lead"}{lead.kampagne ? ` · ${lead.kampagne}` : ""} · {ageDays(lead.erstellt_am)}</p>
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-600 space-y-1">
          <p>Mit der Übernahme werden die Kontaktdaten sichtbar und du wirst als zuständiger Agent protokolliert.</p>
          <p className="font-semibold text-slate-700">Die nächste Akte kannst du erst öffnen, wenn du ein Kontakt-Ergebnis dokumentiert hast.</p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost + " flex-1 !py-3"} onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button className={btnPrimary + " flex-1 !py-3"} onClick={onConfirm} disabled={busy}>
            {busy ? "Öffnet…" : "Ja, Akte öffnen"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentLeadsPage() {
  const [active, setActive] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [openCustomers, setOpenCustomers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirmLead, setConfirmLead] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  // Ticket #14: serverseitige Suche (Telefon/Name/E-Mail/Referenz über Kunden UND Leads)
  const [search, setSearch] = useState("");
  const [searchResult, setSearchResult] = useState<{ customers: any[]; leads: any[] } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ticket #14: „Aktuelle Akte parken?"-Dialog, wenn beim Öffnen bereits eine Akte offen ist.
  const [parkPrompt, setParkPrompt] = useState<{ id: number } | null>(null);

  const load = useCallback((append = false, offset = 0) => {
    if (!append) setLoading(true);
    api(`/agent/leads?limit=50&offset=${offset}`).then((r) => {
      if (r.ok) {
        setActive(r.json.active || null);
        setQueue((prev) => (append ? [...prev, ...(r.json.queue || [])] : r.json.queue || []));
        setTotal(Number(r.json.total) || 0);
        setHasMore(!!r.json.hasMore);
        setOpenCustomers(Number(r.json.openCustomerCount) || 0);
      }
    }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Debounced Server-Suche ab 2 Zeichen — findet auch Nummern (Ticket #14).
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = search.trim();
    if (q.length < 2) { setSearchResult(null); return; }
    searchTimer.current = setTimeout(async () => {
      const r = await api(`/agent/search?q=${encodeURIComponent(q)}`);
      if (r.ok) setSearchResult({ customers: r.json.customers || [], leads: r.json.leads || [] });
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  // Öffnet einen Lead direkt (aus Suche/Deep-Link). Ist bereits eine Akte offen,
  // bietet parkCurrent an, sie zu parken (Ticket #14) — ein Rückruf ist echte Arbeit.
  const doOpen = async (id: number, parkCurrent = false) => {
    setBusy(true);
    const r = await api(`/agent/leads/${id}/open`, { method: "POST", body: JSON.stringify({ parkCurrent }) });
    setBusy(false);
    setConfirmLead(null);
    if (r.ok) {
      setParkPrompt(null);
      setFlash(null);
      load();
      setOpenId(id);
    } else if (r.status === 409 && r.json?.openLeadId) {
      // Es ist bereits eine andere Akte offen → Park-Dialog anbieten.
      setParkPrompt({ id });
    } else {
      setFlash(r.json?.error || "Akte konnte nicht geöffnet werden.");
      load();
    }
  };

  const openAkte = (lead: any) => doOpen(lead.id);

  // Ticket #14: Deep-Link aus der Kundensuche (/agent/leads?open=<id>) — Lead sofort öffnen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openParam = params.get("open");
    if (openParam && /^\d+$/.test(openParam)) {
      doOpen(Number(openParam));
      // URL bereinigen, damit ein Reload den Lead nicht erneut öffnet.
      window.history.replaceState({}, "", "/agent/leads");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeName = active
    ? [active.vorname, active.nachname].filter(Boolean).join(" ") || active.email || active.telefon || `Lead #${active.id}`
    : null;

  return (
    <AgentShell onRefresh={() => load()}>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Arbeitswarteschlange</h1>
        <p className="text-[13px] text-slate-500">{total} Leads warten — einer nach dem anderen, in der Reihenfolge des Systems.</p>
      </div>

      <FlashMessage message={flash} />

      {/* Ticket #14: Suche über Kunden UND Leads — auch nach Telefonnummer.
          Der klassische Fall: unbekannte Nummer ruft zurück → Nummer tippen →
          sehen wer das ist und die Akte sofort öffnen (auch wenn nicht übernommen). */}
      <div className="mb-4">
        <div className="relative">
          <Search size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rückruf? Nummer, Name, E-Mail oder Referenz suchen …"
            className={`${inputCls} pl-10`}
            style={{ minHeight: 46 }}
          />
        </div>
        {searchResult && (searchResult.customers.length > 0 || searchResult.leads.length > 0) && (
          <Card className="mt-2 divide-y divide-slate-50">
            {searchResult.customers.map((c: any) => {
              const cname = c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || c.email || c.ref;
              const cphone = c.phone ? `${c.phone_country_code || ""}${c.phone}` : c.contact_phone;
              return (
                <Link key={`c${c.ref}`} href={`/agent/kunden?ref=${encodeURIComponent(c.ref)}`}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{cname} <span className="text-[11px] font-normal text-slate-400">· Kunde</span></p>
                    <p className="text-[11px] text-slate-400 truncate">{cphone || c.email || "—"} · {c.payment_reference || c.ref}</p>
                  </div>
                  <Badge status={c.payment_status} />
                </Link>
              );
            })}
            {searchResult.leads.map((l: any) => (
              <div key={`l${l.id}`} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-700 truncate flex items-center gap-1.5">
                    <PhoneCall size={12} className="text-slate-400 shrink-0" />
                    {[l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`}
                    <span className="text-[11px] font-normal text-slate-400">· Lead</span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{l.telefon || l.email || "—"} · Status: {LEAD_STATUS[l.status] || l.status}</p>
                </div>
                <button className={btnPrimary + " shrink-0 !px-3"} disabled={busy} onClick={() => doOpen(l.id)}>
                  Öffnen
                </button>
              </div>
            ))}
          </Card>
        )}
        {searchResult && searchResult.customers.length === 0 && searchResult.leads.length === 0 && (
          <p className="mt-2 text-[12px] text-slate-400 px-1">Keine Treffer für „{search.trim()}".</p>
        )}
      </div>

      {/* Gleichbehandlungs-Hinweis (P2-C, Klartext) */}
      <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[12.5px] text-slate-600 flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-[#2563eb] shrink-0 mt-0.5" />
        <span>
          <b className="text-slate-800">Alle Leads werden gleich behandelt</b> — Kontaktdaten werden erst beim Öffnen der
          Akte sichtbar. So wird niemand übersprungen und jede Chance genutzt.
        </span>
      </div>

      {/* Priorisierungs-Hinweis (BC1) */}
      {openCustomers > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-slate-300 bg-white text-[13px] text-slate-700 flex items-center gap-2">
          <Users size={15} className="text-slate-400 shrink-0" />
          Du hast <b className="mx-1">{openCustomers}</b> offene Kunden-Anträge — diese haben Vorrang.
          <Link href="/agent/kunden" className="ml-auto font-semibold" style={{ color: "#2563eb" }}>Zu den Kunden</Link>
        </div>
      )}

      {/* Offene Akte — prominent, blockiert die nächste Übernahme */}
      {active && (
        <Card className="p-4 mb-4 border-[#2563eb]/40 bg-[#2563eb]/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2563eb] text-white flex items-center justify-center shrink-0">
              <FolderOpen size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2563eb]">Deine offene Akte</p>
              <p className="text-[14px] font-bold text-slate-900 truncate">{activeName}</p>
              <p className="text-[12px] text-slate-500 truncate">Seit {fmtDT(active.opened_at)} · Ergebnis dokumentieren, um die nächste zu öffnen</p>
            </div>
            <button className={btnPrimary + " shrink-0"} onClick={() => setOpenId(active.id)}>Weiterarbeiten</button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-[13px] text-slate-400">Lädt…</p>
      ) : queue.length === 0 && !active ? (
        <Card className="p-8 text-center text-[13px] text-slate-400">Aktuell keine Leads in der Warteschlange.</Card>
      ) : (
        <div className="space-y-2">
          {queue.map((l, idx) => (
            <Card key={l.id} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                <Lock size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900 truncate">
                  Lead · {l.quelle || "unbekannte Quelle"}
                </p>
                <p className="text-[12px] text-slate-400 truncate">
                  {l.kampagne || "—"} · {ageDays(l.erstellt_am)} · {l.hat_telefon ? "Telefon vorhanden" : l.hat_email ? "E-Mail vorhanden" : "—"}
                  {l.callback_due ? " · Rückruf fällig" : ""}
                </p>
              </div>
              <Badge label={idx === 0 && !active ? "Als Nächstes" : LEAD_STATUS[l.status] || l.status} />
              <button
                className={btnPrimary + " shrink-0 !px-3.5"}
                disabled={!!active || busy}
                title={active ? "Erst das Ergebnis der offenen Akte dokumentieren" : "Akte öffnen"}
                onClick={() => setConfirmLead(l)}
              >
                Akte öffnen
              </button>
            </Card>
          ))}
          {hasMore && (
            <button className={btnGhost + " w-full inline-flex items-center justify-center gap-2 !py-3"} onClick={() => load(true, queue.length)}>
              <ChevronDown size={14} /> Mehr laden ({total - queue.length} weitere)
            </button>
          )}
        </div>
      )}

      {confirmLead && (
        <ConfirmOpenSheet lead={confirmLead} busy={busy} onConfirm={() => openAkte(confirmLead)} onCancel={() => setConfirmLead(null)} />
      )}

      {/* Ticket #14: Park-Dialog — Rückruf öffnen, obwohl bereits eine Akte offen ist. */}
      {parkPrompt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setParkPrompt(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full sm:max-w-md bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><FolderOpen size={18} /></div>
              <div>
                <p className="text-[15px] font-bold text-slate-900">Aktuelle Akte parken?</p>
                <p className="text-[12px] text-slate-500">Du hast bereits eine offene Akte. Für den Rückruf parken wir sie zurück in die Warteschlange.</p>
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-[12.5px] text-slate-600">
              Kein Datenverlust: Die geparkte Akte bleibt vollständig erhalten und kann jederzeit weiterbearbeitet werden. Ein Rückruf ist echte Arbeit und hat Vorrang.
            </div>
            <div className="flex gap-2">
              <button className={btnGhost + " flex-1 !py-3"} onClick={() => setParkPrompt(null)} disabled={busy}>Abbrechen</button>
              <button className={btnPrimary + " flex-1 !py-3"} onClick={() => doOpen(parkPrompt.id, true)} disabled={busy}>
                {busy ? "Öffnet…" : "Parken & Rückruf öffnen"}
              </button>
            </div>
          </div>
        </div>
      )}

      {openId !== null && <LeadDetail id={openId} onClose={() => setOpenId(null)} onChanged={() => load()} />}
    </AgentShell>
  );
}
