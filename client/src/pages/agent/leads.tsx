import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Phone, ArrowLeft, Send, Pencil, Users, Lock, FolderOpen, ShieldCheck, ChevronDown, Search, Archive, PhoneCall, X } from "lucide-react";
import {
  AgentShell, api, Card, Badge, fmtDT, fmtD, inputCls, btnPrimary, btnGhost, FlashMessage, ConfirmDialog,
} from "./shared";

// Ticket #15: Gründe fürs Aussortieren („aus meiner Liste entfernen" — nie gelöscht).
const DISMISS_REASONS: { key: string; label: string }[] = [
  { key: "keine_telefonnummer", label: "keine Telefonnummer" },
  { key: "nummer_ungueltig", label: "Nummer ungültig" },
  { key: "kein_interesse", label: "kein Interesse" },
  { key: "dublette", label: "Dublette" },
];

// PROMPT 2/2 · A: Folgen-Text im Bestätigungsdialog (macht den Schutz sichtbar).
const LEAD_OUTCOME_CONSEQUENCE: Record<string, string> = {
  erreicht_interesse: "Wird dokumentiert — die Akte wird geschlossen.",
  erreicht_kein_interesse: "Wird dokumentiert — der Lead verlässt die Automatik.",
  nicht_erreicht: "Wird dokumentiert — Wiedervorlage in ca. 4 Stunden.",
  mailbox: "Wird dokumentiert — Wiedervorlage in ca. 4 Stunden.",
  rueckruf_termin: "Legt einen Rückruf-Termin an (deutsche Zeit).",
  nummer_falsch: "Der Lead erhält — falls eine E-Mail hinterlegt ist (max. 1×/Tag) — eine E-Mail zur Nummern-Korrektur. Die Akte wird geschlossen.",
};

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

export function LeadDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [note, setNote] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ vorname: "", nachname: "", email: "", telefon: "" });
  // PROMPT 2/2 · A: EIN modaler Bestätigungsdialog statt Doppel-Tap.
  const [pending, setPending] = useState<{ key: string; date: string } | null>(null);
  const [closeAkteOpen, setCloseAkteOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  // Ticket #15: „Aus meiner Liste entfernen" (nie gelöscht)
  // PROMPT 2/2 · A: Aussortieren und Antrags-Link laufen über den modalen Dialog.
  // `dismissOpen` = Dialog offen, `dismissReason` = gewählter Grund.
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [confirmLink, setConfirmLink] = useState(false);

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

  const outcomeNeedsDate = (o: string) => o === "rueckruf_termin";

  // PROMPT 2/2 · A: ein Tap öffnet den Bestätigungsdialog (Datum eingebettet) —
  // kein blinder Doppel-Tap mehr. Der Schutz vor Versehen bleibt, wird nur sichtbar.
  const saveOutcome = async () => {
    if (!pending) return;
    const outcome = pending.key;
    const date = pending.date;
    if (outcomeNeedsDate(outcome) && !date) return;
    setBusy(true);
    const r = await api(`/agent/leads/${id}/contact-result`, {
      method: "POST",
      body: JSON.stringify({ outcome, scheduledAt: outcome === "rueckruf_termin" ? date : null }),
    });
    setBusy(false);
    setPending(null);
    if (r.ok) {
      // #23: bei „Nummer falsch" Rückmeldung zur Selbst-Update-Mail geben.
      const nu = r.json?.numberUpdateMail;
      if (outcome === "nummer_falsch") {
        setFlash(nu?.sent
          ? "Nummer falsch dokumentiert — dem Lead wurde eine Mail zur Nummern-Aktualisierung gesendet. Sobald er eine neue Nummer einträgt, ist er wieder anrufbar."
          : nu?.reason === "keine_email"
            ? "Nummer falsch dokumentiert. Keine E-Mail hinterlegt — keine Korrektur-Mail möglich."
            : nu?.reason === "rate_limit"
              ? "Nummer falsch dokumentiert. Korrektur-Mail wurde heute bereits gesendet."
              : "Nummer falsch dokumentiert — Akte geschlossen.");
      } else {
        setFlash("Ergebnis gespeichert — Akte geschlossen. Du kannst jetzt die nächste Akte öffnen.");
      }
      load(); onChanged();
    }
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
    setConfirmLink(false);
    setBusy(true);
    const r = await api(`/agent/leads/${id}/move-to-application`, { method: "POST" });
    setBusy(false);
    if (r.ok) { setFlash("✓ E-Mail wurde versendet — der Interessent hat den Antrags-Link erhalten."); load(); onChanged(); } else setFlash(r.json?.error || "Fehler.");
  };

  // V2 (Phase 2B): Notausgang — Akte ohne Ergebnis schließen (Begründung Pflicht).
  // Der Agent darf sich nie ausgesperrt fühlen; zählt NICHT als Kontakt.
  // PROMPT 2/2 · A: modaler Dialog mit Pflicht-Begründung statt window.prompt.
  const doCloseAkte = async () => {
    if (closeReason.trim().length < 3) return;
    setBusy(true);
    const r = await api(`/agent/leads/${id}/close-akte`, { method: "POST", body: JSON.stringify({ reason: closeReason.trim() }) });
    setBusy(false);
    if (r.ok) { setCloseAkteOpen(false); onChanged(); onClose(); } else setFlash(r.json?.error || "Fehler.");
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
    <>
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
              {/* Kontakt-Ergebnisse — ein Tap öffnet den Bestätigungsdialog */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kontakt-Ergebnis</p>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOMES.map((o) => (
                    <button key={o.key} disabled={busy} onClick={() => setPending({ key: o.key, date: "" })}
                      className={`${btnGhost} text-left`} style={{ minHeight: 46 }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className={btnPrimary + " w-full inline-flex items-center justify-center gap-2"} disabled={busy} onClick={(e) => { e.stopPropagation(); setConfirmLink(true); }}>
                <Send size={14} /> Zum Antrag bewegen (Link senden)
              </button>

              {/* Notiz */}
              <div>
                <textarea className={inputCls} rows={2} placeholder="Notiz hinzufügen…" value={note} onChange={(e) => setNote(e.target.value)} />
                <button className={btnGhost + " mt-2"} disabled={busy || !note.trim()} onClick={saveNote}>Notiz speichern</button>
              </div>

              {/* V2: Notausgang — nie ausgesperrt sein */}
              {lead.opened_at && (
                <button className="w-full text-[12px] text-slate-400 hover:text-slate-600 py-1" disabled={busy} onClick={() => { setCloseReason(""); setCloseAkteOpen(true); }}>
                  Akte schließen ohne Ergebnis (mit Begründung) — Lead geht zurück in die Warteschlange
                </button>
              )}

              {/* Ticket #15: Aus meiner Liste entfernen (nie gelöscht) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  className="w-full text-[12px] font-semibold text-slate-500 hover:text-slate-700 py-1.5 inline-flex items-center justify-center gap-1.5"
                  style={{ minHeight: 44 }}
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); setDismissReason(""); setDismissOpen(true); }}
                >
                  <Archive size={13} /> Aus meiner Liste entfernen
                </button>
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

    {/* PROMPT 2/2 · A: Kontakt-Ergebnis bestätigen (ein Tap → Dialog, Datum eingebettet) */}
    <ConfirmDialog
      open={!!pending}
      title={pending ? (OUTCOMES.find((o) => o.key === pending.key)?.label || "Kontakt-Ergebnis") : ""}
      message={pending ? `Für ${name} dokumentieren?` : ""}
      consequence={pending ? LEAD_OUTCOME_CONSEQUENCE[pending.key] : undefined}
      confirmLabel="Speichern"
      busy={busy}
      confirmDisabled={!!pending && outcomeNeedsDate(pending.key) && !pending.date}
      onConfirm={saveOutcome}
      onCancel={() => setPending(null)}
    >
      {pending && outcomeNeedsDate(pending.key) && (
        <div>
          <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Rückruf-Termin</label>
          <input
            type="datetime-local"
            value={pending.date}
            onChange={(e) => setPending((p) => (p ? { ...p, date: e.target.value } : p))}
            className={inputCls}
            style={{ minHeight: 44 }}
          />
          <p className="text-[11px] text-slate-400 mt-1.5">Uhrzeit in deutscher Zeit (Europe/Berlin)</p>
        </div>
      )}
    </ConfirmDialog>

    {/* Akte ohne Ergebnis schließen (Begründung Pflicht) */}
    <ConfirmDialog
      open={closeAkteOpen}
      title="Akte ohne Ergebnis schließen?"
      message="Der Lead geht zurück in die Warteschlange. Dies zählt NICHT als Kontakt."
      confirmLabel="Akte schließen"
      busy={busy}
      confirmDisabled={closeReason.trim().length < 3}
      onConfirm={doCloseAkte}
      onCancel={() => setCloseAkteOpen(false)}
    >
      <div>
        <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Kurze Begründung (Pflicht)</label>
        <input
          type="text"
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="z. B. Feierabend, Kunde legte auf"
          className={inputCls}
          style={{ minHeight: 44 }}
        />
      </div>
    </ConfirmDialog>

    {/* Antrags-/Zahlungslink — löst eine echte E-Mail aus */}
    <ConfirmDialog
      open={confirmLink}
      title="Antrags-Link senden?"
      message={`${name} bekommt den Link zum Antrag mit den Zahlungsdaten.`}
      consequence={`Es geht sofort eine E-Mail an ${lead?.email || "die hinterlegte Adresse"}. Darüber kann der Interessent den Antrag selbst abschließen und bezahlen.`}
      confirmLabel="E-Mail senden"
      busy={busy}
      onConfirm={moveToApplication}
      onCancel={() => setConfirmLink(false)}
    />

    {/* Aussortieren — Grund im Dialog, nichts wird gelöscht */}
    <ConfirmDialog
      open={dismissOpen}
      title="Aus deiner Liste entfernen?"
      message={`${name} verschwindet aus deiner Warteschlange.`}
      consequence="Es wird nichts gelöscht und keine E-Mail versendet. Der Lead bleibt vollständig gespeichert und kann vom Admin jederzeit zurückgeholt werden."
      confirmLabel="Entfernen"
      danger
      busy={busy}
      confirmDisabled={!dismissReason}
      onConfirm={dismiss}
      onCancel={() => { setDismissOpen(false); setDismissReason(""); }}
    >
      <div>
        <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Grund</label>
        <div className="grid grid-cols-2 gap-1.5">
          {DISMISS_REASONS.map((rsn) => (
            <button
              key={rsn.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setDismissReason(rsn.key); }}
              className={`px-2.5 py-2 rounded-lg border text-[12px] font-medium text-left transition-colors ${
                dismissReason === rsn.key
                  ? "border-slate-400 bg-slate-50 text-slate-900"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
              style={{ minHeight: 44 }}
            >
              {rsn.label}
            </button>
          ))}
        </div>
      </div>
    </ConfirmDialog>
    </>
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
            <Card key={l.id} className={`p-4 flex items-center gap-3 ${l.number_corrected ? "border-emerald-300 ring-1 ring-emerald-100" : ""}`}>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${l.number_corrected ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                {l.number_corrected ? <PhoneCall size={15} /> : <Lock size={15} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-slate-900 truncate">
                  Lead · {l.quelle || "unbekannte Quelle"}
                </p>
                {l.number_corrected && (
                  <p className="text-[11.5px] font-semibold text-emerald-700">Nummer vom Kunden korrigiert — erneut anrufen</p>
                )}
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
