import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  Phone, FileText, X, ChevronDown, ChevronRight, Lock,
  CheckCircle2, Search, Send, CalendarPlus, Info, Pencil, AlertTriangle,
  Archive, PhoneCall, Undo2,
} from "lucide-react";
import {
  AgentShell, Badge, Card, FlashMessage, useAgentInfo, ConfirmDialog,
  api, fmtEur, fmtD, fmtDT, inputCls, btnPrimary, btnGhost, ACCENT,
} from "./shared";
import { SuccessPulse } from "./motion";
import { KontaktErgebnis, KUNDE_GRUPPEN } from "./kontakt-ergebnis";
import { jetztFuerEingabe } from "./zeit-eingabe";

// ============================================================================
// /agent/kunden — Arbeitsliste (NUR unbezahlte Kunden) + Kundendetail-Sheet.
// Paket AO: aus der früheren /agent-Startseite unverändert extrahiert —
// Suche, Filter, Soft-Lock, Notizen, Kontakt-Ergebnisse, Zahlungsdaten-Mail,
// Stammdaten-Korrektur (Paket AC) bleiben exakt wie bisher.
// ============================================================================

export interface Customer {
  ref: string;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  pack_name: string | null;
  amount_due: string | null;
  payment_reference: string | null;
  payment_status: string;
  payment_due_date: string | null;
  claimed_paid_at: string | null;
  promised_pay_date: string | null;
  agent_email_sent_at: string | null;
  invoice_number: string | null;
  created_at: string;
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  locked_by_name: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  completed_at?: string | null;
  superseded_by?: string | null;
  // P2-B Transparenz: Grund für (keine) Provision
  commission_basis?: "betreut" | "direktzahler" | "admin" | "altmodell" | null;
  commission_basis_note?: string | null;
  last_contact?: { type: string; outcome: string | null; agent_name: string; created_at: string } | null;
  next_appointment?: string | null;
  number_corrected_at?: string | null; // #23: Kunde hat seine Nummer selbst korrigiert
}

interface LogEntry {
  id: number;
  agent_id?: number | null;
  type: string;
  outcome: string | null;
  note: string | null;
  agent_name: string;
  scheduled_at: string | null;
  promised_date: string | null;
  voided_at?: string | null;
  created_at: string;
}

interface ContextScript { id: number; title: string; category: string; content_html: string | null; file_name: string | null }

export const OUTCOME_LABELS: Record<string, string> = {
  erreicht_zahlt_gleich: "Erreicht – zahlt gleich",
  erreicht_zahlt_am: "Erreicht – zahlt am …",
  erreicht_abgelehnt: "Erreicht – abgelehnt",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Nummer falsch",
};

// PROMPT 2/2 · A: Folgen-Text im Bestätigungsdialog (macht den Schutz sichtbar).
export const OUTCOME_CONSEQUENCE: Record<string, string> = {
  erreicht_zahlt_gleich: "Wird dokumentiert. Der Kunde bleibt in deiner Arbeitsliste, bis die Zahlung eingeht.",
  erreicht_zahlt_am: "Wird als Zahlungs-Zusage gespeichert (deutsche Zeit).",
  erreicht_abgelehnt: "Wird dokumentiert. Der Kunde bleibt sichtbar.",
  nicht_erreicht: "Wird dokumentiert — der Kunde bleibt in deiner Arbeitsliste.",
  mailbox: "Wird dokumentiert — der Kunde bleibt in deiner Arbeitsliste.",
  rueckruf_termin: "Legt einen Rückruf-Termin an (deutsche Zeit).",
  nummer_falsch: "Der Kunde erhält — falls eine E-Mail hinterlegt ist (max. 1×/Tag) — eine E-Mail zur Nummern-Korrektur.",
};

export function custName(c: Customer): string {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || "—";
}

export function custPhone(c: Customer): string | null {
  if (c.phone) return `${c.phone_country_code || ""}${c.phone}`.replace(/\s/g, "");
  if (c.contact_phone) return c.contact_phone.replace(/\s/g, "");
  return null;
}

// #23: Der Kunde hat seine Nummer selbst korrigiert und es gab seither KEINEN
// dokumentierten Kontakt → „erneut anrufen"-Signal für den Agenten.
export function numberCorrectedPending(c: Customer): boolean {
  if (!c.number_corrected_at) return false;
  const corrected = new Date(c.number_corrected_at).getTime();
  if (Number.isNaN(corrected)) return false;
  const lastContact = c.last_contact?.created_at ? new Date(c.last_contact.created_at).getTime() : 0;
  return corrected > lastContact;
}

// Ticket #14: lokaler Treffer-Test inkl. Telefonnummer (Ziffern-Teilstring, Format egal),
// damit auch bereits geladene Kunden bei Nummernsuche sichtbar bleiben (die serverseitige
// /agent/search liefert zusätzlich Bezahlte/Leads).
export function matchCustomer(c: Customer, q: string): boolean {
  const s = q.toLowerCase();
  const txt = `${custName(c)} ${c.email || ""} ${c.ref || ""} ${c.payment_reference || ""}`.toLowerCase();
  if (txt.includes(s)) return true;
  const qDigits = q.replace(/\D/g, "");
  if (qDigits.length >= 3) {
    const phoneDigits = (custPhone(c) || "").replace(/\D/g, "");
    if (phoneDigits.includes(qDigits)) return true;
  }
  return false;
}

type Filter = "alle" | "claimed" | "abgelaufen" | "termin" | "nicht_erreicht";

// Paket DA: Status-Gruppen im Gesamtbestand — klare Sprache statt Roh-Status
type AllFilter = "alle" | "offen" | "angekuendigt" | "bezahlt" | "abgelaufen" | "geschlossen";
const ALL_GROUPS: { key: AllFilter; label: string }[] = [
  { key: "alle", label: "Alle" },
  { key: "offen", label: "Offen" },
  { key: "angekuendigt", label: "Zahlung angekündigt" },
  { key: "bezahlt", label: "Bezahlt" },
  { key: "abgelaufen", label: "Abgelaufen" },
  { key: "geschlossen", label: "Geschlossen" },
];

function allGroupOf(c: Customer): AllFilter {
  if (c.payment_status === "pending_payment") return "offen";
  if (c.payment_status === "claimed_paid") return "angekuendigt";
  if (c.payment_status === "paid") return "bezahlt";
  if (c.payment_status === "expired") return "abgelaufen";
  return "geschlossen"; // superseded | refunded …
}

export default function AgentKundenPage() {
  return (
    <AgentShell>
      <KundenContent />
    </AgentShell>
  );
}

function KundenContent() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [message, setMessage] = useState<string | null>(null);
  const [detailRef, setDetailRef] = useState<string | null>(null);
  // Paket DA: Gesamtbestand (alle je zugewiesenen Kunden, auch bezahlt/geschlossen)
  const [view, setView] = useState<"arbeit" | "alle">("arbeit");
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [allFilter, setAllFilter] = useState<AllFilter>("alle");
  // Paket DC: serverseitige Suche (findet auch Bezahlte + Leads)
  const [searchResult, setSearchResult] = useState<{ customers: any[]; leads: any[] } | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 5000); };

  const load = useCallback(async () => {
    const c = await api("/agent/customers");
    if (c.ok) setCustomers(c.json.data);
    setLoading(false);
  }, []);

  const loadAll = useCallback(async () => {
    const r = await api("/agent/customers/all");
    if (r.ok) { setAllCustomers(r.json.data); setAllLoaded(true); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (view === "alle" && !allLoaded) loadAll(); }, [view, allLoaded, loadAll]);

  // Ticket #14: Deep-Link aus der Suche (/agent/kunden?ref=<ref>) — Kunde direkt öffnen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const refParam = params.get("ref");
    if (refParam) {
      setDetailRef(refParam);
      window.history.replaceState({}, "", "/agent/kunden");
    }
  }, []);

  // Debounced Server-Suche: ab 2 Zeichen — findet auch bezahlte Kunden + Leads
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (q && !matchCustomer(c, q)) return false;
      if (filter === "claimed") return c.payment_status === "claimed_paid";
      if (filter === "abgelaufen") return c.payment_status === "expired";
      if (filter === "termin") return !!c.next_appointment;
      if (filter === "nicht_erreicht") return c.last_contact?.outcome === "nicht_erreicht" || c.last_contact?.outcome === "mailbox";
      return true;
    });
  }, [customers, search, filter]);

  const claimedCount = customers.filter((c) => c.payment_status === "claimed_paid").length;

  // Gesamtbestand: Suche + Gruppen-Filter
  const filteredAll = useMemo(() => {
    const q = search.trim();
    return allCustomers.filter((c) => {
      if (q && !matchCustomer(c, q)) return false;
      if (allFilter !== "alle" && allGroupOf(c) !== allFilter) return false;
      return true;
    });
  }, [allCustomers, search, allFilter]);

  const groupCount = (g: AllFilter) => (g === "alle" ? allCustomers.length : allCustomers.filter((c) => allGroupOf(c) === g).length);

  // Server-Suchtreffer, die NICHT schon in der aktuellen Liste stehen (z. B. Bezahlte)
  const localRefs = useMemo(() => new Set((view === "alle" ? filteredAll : customers).map((c) => c.ref)), [view, filteredAll, customers]);
  const extraHits = (searchResult?.customers || []).filter((c: any) => !localRefs.has(c.ref));

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight">Kunden</h1>
        <span className="text-[12px] text-slate-400">({view === "alle" ? allCustomers.length : customers.length})</span>
      </div>
      <p className="text-[12px] text-slate-400 mb-4">
        {view === "alle"
          ? "Gesamtbestand — ALLE Kunden, die dir je zugewiesen waren (auch bezahlte und geschlossene). Kein Kunde verschwindet."
          : "Deine Arbeitsliste — offene Zahlungen bearbeiten und dokumentieren."}
      </p>

      {/* Paket DA: Umschalter Arbeitsliste / Gesamtbestand */}
      <div className="mb-4 inline-flex bg-slate-100 rounded-xl p-1">
        {([["arbeit", "Arbeitsliste (offen)"], ["alle", "Gesamtbestand (Alle)"]] as const).map(([k, lbl]) => (
          <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setView(k); }}
            className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 inline-flex items-center gap-1.5 ${
              view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}>
            {k === "alle" && <Archive size={13} strokeWidth={1.8} />}
            {lbl}
          </button>
        ))}
      </div>

      <FlashMessage message={message} />

      {/* ── Suche + Filter ── */}
      <div className="mb-4 space-y-2.5">
        <div className="relative" style={{ maxWidth: 420 }}>
          <Search size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Name, E-Mail, Telefon, Referenz …"
            className={`${inputCls} pl-10`}
            style={{ minHeight: 46 }}
          />
        </div>
        {view === "arbeit" ? (
          <div className="flex flex-wrap gap-2">
            {([
              { key: "alle", label: `Alle (${customers.length})` },
              { key: "claimed", label: `Zahlung angekündigt (${claimedCount})` },
              { key: "abgelaufen", label: `Abgelaufen (${customers.filter((c) => c.payment_status === "expired").length})` },
              { key: "termin", label: "Termin vereinbart" },
              { key: "nicht_erreicht", label: "Nicht erreicht" },
            ] as const).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setFilter(f.key); }}
                className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-all duration-150 ${
                  filter === f.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {ALL_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); setAllFilter(g.key); }}
                className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-all duration-150 ${
                  allFilter === g.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                {g.label} ({groupCount(g.key)})
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="agent-skeleton h-16 rounded-xl" />)}
        </div>
      )}
      {!loading && (view === "alle" ? filteredAll : filtered).length === 0 && (
        <div className="py-14 text-center">
          <p className="text-[13px] text-slate-400">
            {view === "alle"
              ? (search || allFilter !== "alle" ? "Keine Treffer in dieser Gruppe." : "Dir wurden noch keine Kunden zugewiesen.")
              : (search || filter !== "alle" ? "Keine Treffer in der Arbeitsliste — bezahlte/geschlossene Kunden findest du im Gesamtbestand oder unten unter „Weitere Treffer“." : "Aktuell keine unbezahlten Kunden in deiner Liste.")}
          </p>
        </div>
      )}

      {/* ── Mobile Karten ── */}
      <div className="space-y-2.5 md:hidden">
        {(view === "alle" ? filteredAll : filtered).map((c) => (
          <CustomerCard key={c.ref} c={c} onOpen={() => setDetailRef(c.ref)} />
        ))}
      </div>

      {/* ── Desktop Tabelle ── */}
      {!loading && (view === "alle" ? filteredAll : filtered).length > 0 && (
        <Card className="hidden md:block overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {["Name", "E-Mail", "Telefon", "Paket", "Betrag", "Status", "Zuletzt", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(view === "alle" ? filteredAll : filtered).map((c) => {
                const phone = custPhone(c);
                return (
                  <tr key={c.ref} onClick={() => setDetailRef(c.ref)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-900">{custName(c)}</p>
                      <p className="text-[11px] font-mono text-slate-400">{c.payment_reference || c.ref}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap tabular-nums">{phone || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{(c.pack_name || "—").replace(/\n/g, " ")}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap tabular-nums">{fmtEur(c.amount_due)}</td>
                    <td className="px-4 py-3">
                      <Badge status={c.payment_status} />
                      {c.locked_by_name && (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Lock size={10} /> {c.locked_by_name}</p>
                      )}
                      {c.next_appointment && <p className="text-[10px] text-slate-500 mt-1">Termin {fmtDT(c.next_appointment)}</p>}
                      {c.promised_pay_date && <p className="text-[10px] text-slate-500 mt-1">Zusage {fmtD(c.promised_pay_date)}</p>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[170px]">
                      {c.last_contact
                        ? `${c.last_contact.type === "note" ? "Notiz" : c.last_contact.type === "claim" ? "Zugewiesen" : OUTCOME_LABELS[c.last_contact.outcome || ""] || c.last_contact.type} · ${fmtDT(c.last_contact.created_at)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`${btnPrimary} px-3 py-2 inline-flex items-center gap-1.5`}
                          >
                            <Phone size={13} strokeWidth={2} /> Anrufen
                          </a>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDetailRef(c.ref); }} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors">
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* ── Paket DC: Weitere Server-Suchtreffer (Bezahlte, Geschlossene, Leads) ── */}
      {searchResult && (extraHits.length > 0 || searchResult.leads.length > 0) && (
        <div className="mt-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Weitere Treffer (Gesamtbestand & Leads)
          </h2>
          {extraHits.length > 0 && (
            <Card className="divide-y divide-slate-50 mb-2">
              {extraHits.map((c: any) => (
                <button key={c.ref} type="button" onClick={(e) => { e.stopPropagation(); setDetailRef(c.ref); }}
                  className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 transition-colors">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{custName(c)}</p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {c.email || "—"} · {c.payment_reference || c.ref}
                      {c.assigned_agent_name ? ` · Betreut von ${c.assigned_agent_name}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={c.payment_status} />
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </Card>
          )}
          {searchResult.leads.length > 0 && (
            <Card className="divide-y divide-slate-50">
              {searchResult.leads.map((l: any) => (
                <div key={l.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-700 truncate flex items-center gap-1.5">
                      <PhoneCall size={12} className="text-slate-400 shrink-0" />
                      {[l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon || `Lead #${l.id}`}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">Lead · {l.telefon || l.email || "—"} · Status: {l.status}</p>
                  </div>
                  {/* Ticket #14: direkt diesen Lead öffnen (auch wenn nicht übernommen) */}
                  <Link href={`/agent/leads?open=${l.id}`} className="text-[12px] font-semibold shrink-0" style={{ color: ACCENT }}>
                    Öffnen
                  </Link>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ENTFERNT 03.08.2026 — „Von Kollegen betreut".

          Dieser Abschnitt listete die Kunden ANDERER Agenten mit Namen, Status
          und einem „Ansehen"-Knopf, der deren Detailansicht öffnete. Er war der
          sichtbare Teil des Datenlecks: ein Testkonto ohne eigene Kunden sah
          hier fremde Datensätze samt Namen des betreuenden Kollegen.

          Der Server liefert `colleagues` jetzt immer leer, der Abschnitt würde
          also nie mehr erscheinen. Er ist trotzdem gelöscht statt stehen
          gelassen: Ein Block, der nur deshalb unsichtbar ist, weil das Backend
          gerade nichts liefert, ist eine Falle für den Nächsten, der die
          Abfrage „aufräumt". */}

      {detailRef && (
        <CustomerDetail
          refId={detailRef}
          onClose={() => setDetailRef(null)}
          onChanged={() => { load(); if (allLoaded) loadAll(); }}
          flash={flash}
        />
      )}
    </div>
  );
}

export function CustomerCard({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const phone = custPhone(c);
  const numberCorrected = numberCorrectedPending(c);
  return (
    <Card className={`p-4 cursor-pointer active:bg-slate-50 ${numberCorrected ? "border-emerald-300 ring-1 ring-emerald-100" : c.payment_status === "claimed_paid" ? "border-slate-300" : ""}`}>
      <div onClick={onOpen}>
        {numberCorrected && (
          <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-700">
            <PhoneCall size={11} strokeWidth={2} /> Nummer vom Kunden korrigiert — erneut anrufen
          </div>
        )}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-slate-900 truncate">{custName(c)}</p>
            <p className="text-[12px] text-slate-400 truncate">{c.email || "—"}</p>
          </div>
          <Badge status={c.payment_status} />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-3 flex-wrap">
          <span className="font-semibold text-slate-800 tabular-nums">{fmtEur(c.amount_due)}</span>
          <span>{(c.pack_name || "—").replace(/\n/g, " ")}</span>
          {c.next_appointment && <span>Termin {fmtDT(c.next_appointment)}</span>}
          {c.promised_pay_date && <span>Zusage {fmtD(c.promised_pay_date)}</span>}
          {c.locked_by_name && <span className="flex items-center gap-1"><Lock size={11} /> {c.locked_by_name}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className={`${btnPrimary} flex-1 text-center py-3 inline-flex items-center justify-center gap-2`}
            style={{ minHeight: 46 }}
          >
            <Phone size={15} strokeWidth={2} /> Anrufen
          </a>
        ) : (
          <span className="flex-1 text-center py-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 text-[13px] font-medium">Keine Nummer</span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className={btnGhost} style={{ minHeight: 46 }}>
          Details
        </button>
      </div>
    </Card>
  );
}

// #15/#22: „Aus meiner Liste entfernen" — kein echtes Löschen. Grund-Auswahl,
// klarer Hinweis, dass nichts gelöscht wird. Wiederverwendbar (offen + abgelaufen).
const CUST_DISMISS_REASONS: Record<string, string> = {
  keine_nummer: "Keine Telefonnummer",
  nummer_ungueltig: "Ungültige Nummer",
  abgelehnt: "100 % abgelehnt",
  kein_interesse: "Kein Interesse",
  dublette: "Dublette",
};
/**
 * PROMPT 2/2 · A: Auslöser für das Aussortieren. Die Gründe und die Folge
 * stehen jetzt im modalen Dialog (ConfirmDialog) statt in einem Inline-Panel —
 * ein Tap öffnet, der Dialog bestätigt.
 */
function DismissButton({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="w-full py-2.5 rounded-xl border border-slate-200 text-[12px] font-medium text-slate-400 hover:text-slate-600 hover:border-slate-300 inline-flex items-center justify-center gap-1.5"
        style={{ minHeight: 44 }}
      >
        <X size={13} strokeWidth={1.9} /> Aus meiner Liste entfernen
      </button>
    </div>
  );
}

// ═══════════════ Kundendetail (Sheet) — unverändert aus /agent extrahiert ═══════════════

export function CustomerDetail({ refId, onClose, onChanged, flash }: {
  refId: string;
  onClose: () => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const { agent } = useAgentInfo();
  const [detail, setDetail] = useState<Customer | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [canReactivate, setCanReactivate] = useState(false);
  const [scripts, setScripts] = useState<ContextScript[]>([]);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // PROMPT 2/2 · A: EIN Bestätigungsdialog statt Doppel-Tap. `pending` hält das
  // gewählte Kontakt-Ergebnis (inkl. optionalem Datum), bis der Nutzer im Dialog
  // bestätigt. `voidConfirmId` und `confirmReactivate` steuern die übrigen Dialoge.
  const [pending, setPending] = useState<{ key: string; date: string } | null>(null);
  const [voidConfirmId, setVoidConfirmId] = useState<number | null>(null);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  // PROMPT 2/2 · A: Auch die Zahlungsdaten-Mail und das Aussortieren laufen jetzt
  // über den modalen Dialog — der Agent muss wissen, dass eine E-Mail rausgeht.
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState<string | null>(null);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [mobileTab, setMobileTab] = useState<"stamm" | "aktion" | "verlauf">("aktion");
  const [checkKey, setCheckKey] = useState<string | null>(null);
  // FLIESSBAND: Nach einem dokumentierten Ergebnis ist die Akte serverseitig
  // geschlossen. Der Agent soll dann nicht suchen muessen, wie es weitergeht —
  // der Weg zur naechsten Akte steht direkt da. Dieser Rhythmus (dokumentieren,
  // weiter, naechste) ist der Unterschied zwischen Abarbeiten und Verwalten.
  const [akteFertig, setAkteFertig] = useState(false);
  const [closeAkteOpen, setCloseAkteOpen] = useState(false);
  const [closeReason, setCloseReason] = useState("");
  // Paket AC/DE: Stammdaten-Bearbeitung (Vorname/Nachname/E-Mail/Telefon + Adresse)
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: "", lastName: "", email: "", phone: "", street: "", zip: "", city: "" });
  const [editErr, setEditErr] = useState<string | null>(null);
  const [dupWarn, setDupWarn] = useState<{ ref: string; payment_status: string; name: string } | null>(null);
  const [loginHint, setLoginHint] = useState<string | null>(null);
  // #15/#22: „Aus meiner Liste entfernen" (kein echtes Löschen)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ticket #16: eine wiederverwendbare Ladefunktion — so kann der Drawer nach einem
  // Statuswechsel (z. B. Reaktivierung) in-place neu laden, ohne sich zu schließen.
  const loadDetail = useCallback(async (opts: { closeOnError?: boolean } = {}) => {
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}`);
    if (r.ok) {
      setDetail(r.json.data);
      setLog(r.json.log || []);
      setReadOnly(!!r.json.readOnly);
      setCanReactivate(!!r.json.canReactivate);
      setScripts(r.json.contextScripts || []);
      if (r.json.data.agent_email_sent_at) {
        setLockUntil(new Date(r.json.data.agent_email_sent_at).getTime() + 10 * 60 * 1000);
      }
    } else if (opts.closeOnError) {
      flash(r.json?.error || "Kunde nicht gefunden");
      onClose();
    }
  }, [refId]);

  useEffect(() => { loadDetail({ closeOnError: true }); }, [loadDetail]);

  if (!detail) return null;

  const phone = custPhone(detail);
  const lockSec = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  // Paket DA/DB: geschlossene Bestellungen (bezahlt/abgelaufen/ersetzt) sind read-only
  const isOpenStatus = detail.payment_status === "pending_payment" || detail.payment_status === "claimed_paid";

  const saveNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!noteText.trim()) return;
    setBusy("note");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/notes`, { method: "POST", body: JSON.stringify({ note: noteText.trim() }) });
    setBusy(null);
    if (r.ok) {
      setLog((l) => [r.json.entry, ...l]);
      setNoteText("");
      if (r.json.claimed) { flash("Kunde wurde dir zugewiesen"); onChanged(); }
    } else flash(r.json?.error || "Fehler");
  };

  // Abgelaufenen Kunden reaktivieren (neue 7-Tage-Frist + Zuweisung an mich).
  // Ticket #16: NICHT das Fenster schließen — der Drawer lädt in-place neu, zeigt
  // den neuen Status und alle Aktionen sind sofort nutzbar. Ein Statuswechsel darf
  // nie dazu führen, dass ein geöffneter Datensatz aus dem Fenster verschwindet.
  const doReactivate = async () => {
    setConfirmReactivate(false);
    setBusy("reactivate");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/reactivate`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      await loadDetail();
      const bis = r.json?.data?.payment_due_date ? ` Neue Zahlungsfrist bis ${fmtD(r.json.data.payment_due_date)}.` : "";
      flash(`Reaktiviert — ${custName(detail)} steht jetzt wieder unter „Offen".${bis} Zahlungsdaten wurden erneut gesendet.`);
      onChanged();
    } else flash(r.json?.error || "Reaktivierung fehlgeschlagen");
  };

  // #15/#22: Kunde aus der eigenen Arbeitsliste entfernen (kein echtes Löschen).
  const doDismiss = async (reason: string) => {
    setConfirmDismiss(null);
    setBusy("dismiss");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/dismiss`, { method: "POST", body: JSON.stringify({ reason }) });
    setBusy(null);
    if (r.ok) {
      flash("Aus deiner Liste entfernt — bleibt vollständig gespeichert und ist im Admin jederzeit zurückholbar.");
      onChanged();
      onClose();
    } else flash(r.json?.error || "Konnte nicht entfernt werden");
  };

  const outcomeNeedsDate = (o: string) => o === "rueckruf_termin" || o === "erreicht_zahlt_am";

  // PROMPT 2/2 · A: Ein Tap öffnet den Bestätigungsdialog (Datum ist dort eingebettet) —
  // kein blinder Doppel-Tap mehr. Der Schutz vor Versehen bleibt, wird nur sichtbar.
  const pickOutcome = (e: React.MouseEvent, outcome: string) => {
    e.stopPropagation();
    setPending({ key: outcome, date: "" });
  };

  const saveOutcome = async () => {
    if (!pending) return;
    const outcome = pending.key;
    const dateValue = pending.date;
    if (outcomeNeedsDate(outcome) && !dateValue) return;
    setBusy(outcome);
    const body: any = { outcome };
    if (outcome === "rueckruf_termin") body.scheduledAt = dateValue;
    if (outcome === "erreicht_zahlt_am") body.promisedDate = dateValue;
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/contact-result`, { method: "POST", body: JSON.stringify(body) });
    setBusy(null);
    setPending(null);
    if (r.ok) {
      setLog((l) => [r.json.entry, ...l]);
      setCheckKey(outcome);
      setTimeout(() => setCheckKey((k) => (k === outcome ? null : k)), 900);
      // Der Server hat `opened_at` genullt — die naechste Akte ist frei.
      if (r.json.akteClosed) setAkteFertig(true);
      // Ticket #13: gespeicherte Zeit sofort im Klartext zurückspiegeln (deutsche Zeit),
      // damit ein Fehler direkt auffällt statt erst später.
      if (outcome === "rueckruf_termin" && r.json.entry?.scheduled_at) {
        flash(`Rückruf gespeichert: ${fmtDT(r.json.entry.scheduled_at)} Uhr (deutsche Zeit).`);
      } else if (outcome === "erreicht_zahlt_am" && r.json.entry?.promised_date) {
        flash(`Zahlungs-Zusage gespeichert: ${fmtD(r.json.entry.promised_date)} (deutsche Zeit).`);
      } else if (outcome === "nummer_falsch") {
        // #23: Rückmeldung, ob die Selbst-Update-Mail rausging.
        const nu = r.json.numberUpdateMail;
        flash(nu?.sent
          ? "Falsche Nummer dokumentiert — dem Kunden wurde eine Mail zur Nummern-Aktualisierung gesendet."
          : nu?.reason === "keine_email"
            ? "Falsche Nummer dokumentiert. Keine E-Mail hinterlegt — keine Korrektur-Mail möglich."
            : nu?.reason === "rate_limit"
              ? "Falsche Nummer dokumentiert. Korrektur-Mail wurde heute bereits gesendet."
              : "Falsche Nummer dokumentiert.");
      } else {
        // Paket DA: erklären, wo der Kunde jetzt zu finden ist — nichts „verschwindet"
        const wohin = outcome === "erreicht_zahlt_gleich"
          ? " — der Kunde bleibt in deiner Arbeitsliste, bis die Zahlung eingeht (danach: Gesamtbestand → Bezahlt)"
          : " — der Kunde bleibt in deiner Arbeitsliste sichtbar";
        flash(`${OUTCOME_LABELS[outcome]} dokumentiert${wohin}.`);
      }
      onChanged();
    } else flash(r.json?.error || "Fehler");
  };

  // Paket DD: eigenen Verlaufseintrag als irrtümlich markieren (Soft-Delete, bleibt sichtbar).
  // PROMPT 2/2 · A: Bestätigung jetzt über den modalen Dialog statt Doppel-Tap.
  const voidEntry = async () => {
    const entryId = voidConfirmId;
    if (entryId == null) return;
    setVoidConfirmId(null);
    setBusy("void");
    const r = await api(`/agent/log/${entryId}/void`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      setLog((l) => [r.json.entry, ...l.map((x) => (x.id === entryId ? { ...x, voided_at: new Date().toISOString() } : x))]);
      flash("Eintrag als irrtümlich markiert — er bleibt durchgestrichen im Verlauf (nichts wird gelöscht).");
      onChanged();
    } else flash(r.json?.error || "Fehler");
  };

  // Akte OHNE Ergebnis schliessen — der Notausgang. Begruendung Pflicht,
  // zaehlt NICHT als Betreuung (kein Provisionsanspruch aus einem Abbruch).
  const doCloseAkte = async () => {
    if (closeReason.trim().length < 3) return;
    setBusy("close");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/close-akte`, {
      method: "POST", body: JSON.stringify({ reason: closeReason.trim() }),
    });
    setBusy(null);
    if (r.ok) {
      setCloseAkteOpen(false);
      setCloseReason("");
      setAkteFertig(true);
      flash("Akte ohne Ergebnis geschlossen — zählt nicht als Betreuung. Die nächste Akte ist frei.");
      onChanged();
    } else flash(r.json?.error || "Fehler");
  };

  const sendEmail = async () => {
    setConfirmEmail(false);
    setBusy("email");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/send-payment-email`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      setLockUntil(new Date(r.json.lockedUntil).getTime());
      flash(`✓ E-Mail wurde versendet — ${custName(detail)} hat die Zahlungsdaten erhalten.`);
      onChanged();
    } else if (r.status === 429 && r.json?.lockedUntil) {
      setLockUntil(new Date(r.json.lockedUntil).getTime());
      flash("E-Mail wurde vor Kurzem gesendet — Sperre aktiv");
    } else flash(r.json?.error || "Fehler");
  };

  const lockPct = lockSec > 0 ? Math.max(0, Math.min(100, ((600 - lockSec) / 600) * 100)) : 0;

  // Paket AC: Bearbeiten-Modus starten/speichern
  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditForm({
      firstName: detail.first_name || "",
      lastName: detail.last_name || "",
      email: detail.email || "",
      phone: phone || "",
      street: detail.street || "",
      zip: detail.zip || "",
      city: detail.city || "",
    });
    setEditErr(null);
    setEditMode(true);
  };

  const saveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editForm.firstName.trim() || !editForm.lastName.trim()) { setEditErr("Vor- und Nachname sind Pflichtfelder"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(editForm.email.trim())) { setEditErr("E-Mail-Format ungültig"); return; }
    setBusy("edit");
    setEditErr(null);
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/contact-data`, {
      method: "PATCH",
      body: JSON.stringify({
        firstName: editForm.firstName.trim(), lastName: editForm.lastName.trim(),
        email: editForm.email.trim(), phone: editForm.phone.trim(),
        street: editForm.street.trim(), zip: editForm.zip.trim(), city: editForm.city.trim(),
      }),
    });
    setBusy(null);
    if (!r.ok) { setEditErr(r.json?.error || "Fehler beim Speichern"); return; }
    setEditMode(false);
    setDupWarn(r.json.duplicate || null);
    setLoginHint(r.json.loginEmailChanged ? `Der Kunde meldet sich künftig mit ${editForm.email.trim().toLowerCase()} an — bitte im Gespräch erwähnen.` : null);
    if ((r.json.changes || []).length > 0) {
      flash(`Stammdaten aktualisiert (${(r.json.changes as any[]).map((c) => c.field).join(", ")})`);
      // Detail + Verlauf neu laden (Audit-Einträge erscheinen in der Timeline)
      const d = await api(`/agent/customers/${encodeURIComponent(refId)}`);
      if (d.ok) { setDetail(d.json.data); setLog(d.json.log || []); }
      onChanged();
    } else {
      flash("Keine Änderungen");
    }
  };

  // ── Stammdaten (linke Spalte / Mobile-Tab „Stammdaten") ──
  const stammBlock = (
    <div className="space-y-4">
      {!readOnly && !editMode && (
        <button type="button" onClick={startEdit}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors">
          <Pencil size={12} strokeWidth={2} /> Stammdaten bearbeiten
        </button>
      )}

      {editMode ? (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stammdaten korrigieren</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Vorname *</label>
              <input type="text" value={editForm.firstName} onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Nachname *</label>
              <input type="text" value={editForm.lastName} onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">E-Mail *</label>
            <input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Telefon (+49 …)</label>
            <input type="tel" value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} placeholder="+49 151 2345678" />
          </div>
          {/* Paket DE: Adresse direkt im Gespräch korrigieren (mit Audit) */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Straße & Hausnummer</label>
            <input type="text" value={editForm.street} onChange={(e) => setEditForm((f) => ({ ...f, street: e.target.value }))} className={inputCls} placeholder="Musterstraße 12" />
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">PLZ</label>
              <input type="text" inputMode="numeric" value={editForm.zip} onChange={(e) => setEditForm((f) => ({ ...f, zip: e.target.value }))} className={inputCls} placeholder="10115" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Ort</label>
              <input type="text" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} className={inputCls} placeholder="Berlin" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">Paket, Betrag, Status und Referenz können nur vom Admin geändert werden. Jede Änderung wird im Verlauf protokolliert.</p>
          {editErr && <p className="text-[12px] font-medium text-red-600">{editErr}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} disabled={busy === "edit"} className={`${btnPrimary} flex-1 py-2.5 disabled:opacity-50`}>
              {busy === "edit" ? "Speichert …" : "Speichern"}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setEditMode(false); setEditErr(null); }} className={btnGhost}>
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-[13px]">
          <Field label="E-Mail" value={detail.email || "—"} breakAll />
          <Field label="Telefon" value={phone || "—"} />
          <Field label="Paket" value={(detail.pack_name || "—").replace(/\n/g, " ")} />
          <Field label="Betrag" value={fmtEur(detail.amount_due)} />
          <Field label="Zahlungsreferenz" value={detail.payment_reference || "—"} mono />
          <Field label="Fällig bis" value={fmtD(detail.payment_due_date)} />
          {(detail.street || detail.city) && (
            <div className="col-span-2">
              <Field label="Adresse" value={[detail.street, [detail.zip, detail.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
            </div>
          )}
        </div>
      )}

      {/* Paket AC5: Dubletten-Warnung nach E-Mail-Änderung */}
      {dupWarn && (
        <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-[12px] text-amber-800">
          <p className="font-semibold flex items-center gap-1.5 mb-1"><AlertTriangle size={13} strokeWidth={2} /> Mögliche Dublette</p>
          <p>Diese E-Mail gehört bereits zu <span className="font-semibold">{dupWarn.name}</span> ({dupWarn.ref}, Status: {dupWarn.payment_status}).</p>
          <p className="mt-1">Als Dublette behandeln: Der Admin führt die Datensätze in der Dubletten-Verwaltung (Admin → Zahlungen) zusammen — wird eine Bestellung bezahlt, werden offene Schwestern automatisch geschlossen.</p>
        </div>
      )}

      {/* Paket AC3: Hinweis nach Login-relevanter E-Mail-Änderung */}
      {loginHint && (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-[12px] text-slate-700">
          <p className="font-semibold flex items-center gap-1.5 mb-1"><Info size={13} strokeWidth={2} /> Login-Änderung</p>
          <p>{loginHint}</p>
        </div>
      )}
      <a
        href={`/api/fiaon/agent/customers/${encodeURIComponent(refId)}/invoice.pdf`}
        target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        className={`${btnGhost} w-full py-3 inline-flex items-center justify-center gap-2`}
        style={{ minHeight: 46 }}
      >
        <FileText size={14} strokeWidth={1.8} /> Rechnung (PDF) öffnen
      </a>
    </div>
  );

  // ── Verlauf/Timeline (linke Spalte / Mobile-Tab „Verlauf") ──
  const verlaufBlock = (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Verlauf</h3>
      <div className="space-y-2">
        {log.length === 0 && <p className="text-[12px] text-slate-400">Noch keine Einträge.</p>}
        {log.map((l, i) => {
          const voided = !!l.voided_at;
          const canVoid = !voided && (l.type === "note" || l.type === "result") && l.agent_name === agent?.name;
          return (
            <div key={l.id} className={`relative pl-4 ${i === 0 ? "agent-check-in" : ""}`}>
              <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: voided ? "#e2e8f0" : i === 0 ? ACCENT : "#cbd5e1" }} />
              <div className={`p-3 rounded-lg border border-slate-100 bg-slate-50/60 ${voided ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <span className={`text-[11px] font-semibold text-slate-600 ${voided ? "line-through" : ""}`}>
                    {l.type === "note" ? "Notiz"
                      : l.type === "email_sent" ? "Zahlungsdaten-E-Mail"
                      : l.type === "claim" ? "Zuweisung"
                      : l.type === "edit" ? "Korrektur"
                      : l.type === "system" ? "System"
                      : OUTCOME_LABELS[l.outcome || ""] || l.outcome}
                    {voided && <span className="ml-1.5 no-underline text-[10px] font-semibold text-slate-400">(irrtümlich)</span>}
                  </span>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{l.agent_name} · {fmtDT(l.created_at)}</span>
                </div>
                {l.scheduled_at && <p className={`text-[12px] font-medium text-slate-700 ${voided ? "line-through" : ""}`}>Termin: {fmtDT(l.scheduled_at)}</p>}
                {l.promised_date && <p className={`text-[12px] font-medium text-slate-700 ${voided ? "line-through" : ""}`}>Zahlt am: {fmtD(l.promised_date)}</p>}
                {l.note && <p className={`text-[12px] text-slate-600 whitespace-pre-wrap ${voided ? "line-through" : ""}`}>{l.note}</p>}
                {canVoid && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setVoidConfirmId(l.id); }} disabled={busy === "void"}
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                    <Undo2 size={11} strokeWidth={2} />
                    Irrtümlich erfasst?
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Aktionsbereich (rechte Spalte / Mobile-Tab „Aktion") ──
  const aktionBlock = (
    <div className="space-y-5">
      {/* Gesprächsleitfaden */}
      {scripts.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button type="button" onClick={(e) => { e.stopPropagation(); setScriptsOpen((v) => !v); }}
            className="w-full px-4 py-3 flex items-center justify-between text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <span className="flex items-center gap-2"><FileText size={14} strokeWidth={1.8} /> Gesprächsleitfaden ({scripts.length})</span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${scriptsOpen ? "" : "-rotate-90"}`} />
          </button>
          {scriptsOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto agent-scroll">
              {scripts.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-slate-800 mb-1">{s.title}</p>
                  {s.content_html && (
                    <div className="text-[12px] text-slate-600 leading-relaxed prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_b]:font-semibold" dangerouslySetInnerHTML={{ __html: s.content_html }} />
                  )}
                  {s.file_name && (
                    <a href={`/api/fiaon/agent/scripts/${s.id}/file`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="text-[12px] font-semibold hover:underline" style={{ color: ACCENT }}>
                      PDF öffnen: {s.file_name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {readOnly ? (
        <div className="space-y-2.5">
          <div className="px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-medium text-slate-600 flex items-center gap-2">
            <Info size={14} strokeWidth={1.8} />
            {!isOpenStatus
              ? detail.payment_status === "paid"
                ? `Bestellung ist bezahlt${detail.completed_at ? ` (am ${fmtD(detail.completed_at)})` : ""} — keine Aktionen mehr nötig, Verlauf bleibt einsehbar`
                : detail.payment_status === "expired"
                  ? "Zahlungsfrist abgelaufen — der Kunde bleibt im Vertriebsnetz. Nach Kontakt/Zusage kannst du ihn reaktivieren."
                  : `Bestellung ist geschlossen (${detail.payment_status === "superseded" ? "durch Dublette ersetzt" : detail.payment_status}) — nur Lesezugriff`
              : detail.assigned_agent_name
                ? `Betreut von ${detail.assigned_agent_name} — nur Lesezugriff`
                : `In Bearbeitung durch ${detail.locked_by_name} — nur Lesezugriff`}
          </div>
          {canReactivate && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmReactivate(true); }} disabled={busy === "reactivate"}
              className={`${btnPrimary} w-full py-3 inline-flex items-center justify-center gap-2`} style={{ minHeight: 48 }}>
              <Undo2 size={16} strokeWidth={1.9} />
              {busy === "reactivate" ? "Reaktiviere …" : "Kunde reaktivieren (neue Zahlungsfrist)"}
            </button>
          )}
          {/* #15/#22: auch abgelaufene eigene Kunden aus der Liste nehmen (kein Löschen) */}
          {canReactivate && <DismissButton onOpen={() => setConfirmDismiss("")} />}
        </div>
      ) : (
        <>
          {/* Kontakt-Ergebnis */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">
              Wie ist das Gespräch ausgegangen?
            </h3>
            {checkKey ? (
              <div className="agent-check-in flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3.5"
                   style={{ minHeight: 56, color: ACCENT }}>
                <CheckCircle2 size={16} strokeWidth={2} />
                <span className="text-[13px] font-semibold">{OUTCOME_LABELS[checkKey] || "Erfasst"} — gespeichert</span>
              </div>
            ) : (
              <KontaktErgebnis
                gruppen={KUNDE_GRUPPEN}
                disabled={busy !== null}
                onWaehle={(code) => setPending({ key: code, date: "" })}
                zahlungsdaten={{ onSend: sendEmail, gesperrtSek: lockSec || undefined }}
              />
            )}

            {/* FLIESSBAND — der Weg zur nächsten Akte steht direkt da. */}
            {akteFertig ? (
              <div className="mt-3 rounded-xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white p-4">
                <p className="text-[13px] font-semibold text-slate-800 mb-0.5">Akte abgeschlossen.</p>
                <p className="text-[12px] text-slate-500 leading-snug mb-3">
                  Die Akte ist geschlossen — du kannst die nächste öffnen. {custName(detail)} bleibt dir zugewiesen.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Link href="/agent/kartei" className={`${btnPrimary} flex-1 inline-flex items-center justify-center gap-2 py-3`}
                        style={{ minHeight: 48 }}>
                    <PhoneCall size={15} strokeWidth={2} /> Nächste Akte öffnen
                  </Link>
                  <button type="button" onClick={onClose} className={`${btnGhost} sm:flex-none px-4 py-3`} style={{ minHeight: 48 }}>
                    Hier bleiben
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCloseAkteOpen(true)}
                disabled={busy !== null}
                className="mt-3 w-full text-[12px] text-slate-500 hover:text-slate-800 underline underline-offset-2 disabled:opacity-40"
                style={{ minHeight: 44 }}
              >
                Ohne Ergebnis schließen
              </button>
            )}
          </div>

          {/* Notiz schreiben */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Notiz</h3>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Neue Notiz … (nach dem Speichern nicht mehr änderbar)" rows={3}
              className={`${inputCls} resize-none`} />
            <button type="button" onClick={saveNote} disabled={busy !== null || !noteText.trim()}
              className={`${btnPrimary} w-full mt-2 py-2.5 inline-flex items-center justify-center gap-2`}>
              {busy === "note" ? "Speichern …" : "Notiz speichern"}
            </button>
          </div>

          {/* Zahlungsdaten-E-Mail mit ruhigem Sperr-Fortschritt */}
          <div>
            <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmEmail(true); }} disabled={lockSec > 0 || busy === "email"}
              className={`${btnGhost} w-full py-3 inline-flex items-center justify-center gap-2 relative overflow-hidden`} style={{ minHeight: 48 }}>
              {lockSec > 0 && (
                <span className="absolute left-0 top-0 bottom-0 bg-slate-100" style={{ width: `${lockPct}%`, transition: "width 1s linear" }} />
              )}
              <span className="relative inline-flex items-center gap-2">
                <Send size={14} strokeWidth={1.8} />
                {busy === "email" ? "Wird gesendet …" : lockSec > 0
                  ? `Gesendet — erneut in ${Math.floor(lockSec / 60)}:${String(lockSec % 60).padStart(2, "0")}`
                  : "Zahlungsdaten-E-Mail senden"}
              </span>
            </button>
          </div>

          <DismissButton onOpen={() => setConfirmDismiss("")} />
        </>
      )}
    </div>
  );

  return (
    <>
    <div className="agent-scope fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] agent-reveal" style={{ animationDuration: ".25s" }} />
      <div
        className="absolute inset-x-0 bottom-0 top-10 md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-[min(920px,100vw)] bg-white md:border-l border-slate-200 rounded-t-2xl md:rounded-none shadow-2xl flex flex-col agent-panel-in"
        style={{ animationDuration: ".3s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (voll breit, Anruf-Button jederzeit erreichbar) */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 text-[13px] font-semibold hidden sm:flex items-center justify-center shrink-0">
              {(custName(detail).match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-slate-900 truncate">{custName(detail)}</p>
              <p className="font-mono text-[11px] text-slate-400 truncate">
                {detail.payment_reference || detail.ref}{detail.invoice_number ? ` · ${detail.invoice_number}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}
                className={`${btnPrimary} px-4 py-2.5 hidden md:inline-flex items-center gap-2`} style={{ minHeight: 42 }}>
                <Phone size={14} strokeWidth={2} /> Anrufen
              </a>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status-Strip (voll breit) + Erfolgs-Moment bei Statuswechsel */}
        <div className="shrink-0 px-5 py-3 border-b border-slate-100">
          <SuccessPulse trigger={detail.payment_status}>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={detail.payment_status} />
              {/* Paket DB: Zahlungsstand transparent — wann ist das Geld eingegangen? */}
              {detail.payment_status === "paid" && detail.completed_at && <Badge label={`Bezahlt am ${fmtD(detail.completed_at)}`} />}
              {detail.payment_status === "superseded" && detail.superseded_by && <Badge label={`Ersetzt durch ${detail.superseded_by}`} />}
              {detail.promised_pay_date && detail.payment_status !== "paid" && <Badge label={`Zusage ${fmtD(detail.promised_pay_date)}`} />}
              {detail.assigned_agent_name && !readOnly && <Badge label={`Betreut von ${detail.assigned_agent_name}`} />}
              {/* P2-B Transparenz: WARUM gab es Provision (oder nicht) — keine Blackbox */}
              {detail.commission_basis === "direktzahler" && <Badge label="Direktzahler — keine Provision" />}
              {detail.commission_basis === "betreut" && <Badge label="Provision: Betreuung dokumentiert" />}
              {detail.commission_basis === "admin" && <Badge label="Provision: Admin-Entscheid" />}
              {detail.commission_basis === "altmodell" && <Badge label="Provision: Altmodell (vor Stichtag)" />}
            </div>
            {detail.commission_basis_note && (
              <p className="mt-1.5 text-[11.5px] text-slate-400">{detail.commission_basis_note}</p>
            )}
          </SuccessPulse>
        </div>

        {/* Mobile Segment-Control (einhändig, sticky unter Header) */}
        <div className="md:hidden shrink-0 px-3 py-2 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-xl p-1">
            {([["stamm", "Stammdaten"], ["aktion", "Aktion"], ["verlauf", "Verlauf"]] as const).map(([k, lbl]) => (
              <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setMobileTab(k); }}
                className={`py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  mobileTab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Body: Desktop zweispaltig, Mobile per Segment-Control */}
        <div className="flex-1 overflow-y-auto agent-scroll">
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:divide-x md:divide-slate-100">
            {/* Links: Stammdaten + Verlauf */}
            <div className="px-5 py-5 space-y-6 md:min-h-full">
              <div className={`${mobileTab === "stamm" ? "block" : "hidden"} md:block`}>{stammBlock}</div>
              <div className={`${mobileTab === "verlauf" ? "block" : "hidden"} md:block`}>{verlaufBlock}</div>
            </div>
            {/* Rechts: Aktionen */}
            <div className={`px-5 py-5 bg-slate-50/40 ${mobileTab === "aktion" ? "block" : "hidden"} md:block`}>
              {aktionBlock}
            </div>
          </div>
        </div>

        {/* Mobile sticky Anruf-Aktion */}
        {phone && (
          <div className="md:hidden shrink-0 border-t border-slate-100 bg-white px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}
              className={`${btnPrimary} w-full py-3 inline-flex items-center justify-center gap-2`} style={{ minHeight: 48 }}>
              <Phone size={15} strokeWidth={2} /> {custName(detail)} anrufen
            </a>
          </div>
        )}
      </div>
    </div>

    {/* PROMPT 2/2 · A: Kontakt-Ergebnis bestätigen (ein Tap → Dialog, Datum eingebettet) */}
    <ConfirmDialog
      open={!!pending}
      title={pending ? OUTCOME_LABELS[pending.key] || "Kontakt-Ergebnis" : ""}
      message={pending ? `Für ${custName(detail)} dokumentieren?` : ""}
      consequence={pending ? OUTCOME_CONSEQUENCE[pending.key] : undefined}
      confirmLabel="Speichern"
      busy={busy !== null}
      confirmDisabled={
        !!pending && outcomeNeedsDate(pending.key) &&
        (!pending.date ||
          (pending.key === "rueckruf_termin" && new Date(pending.date).getTime() < Date.now() - 5 * 60_000))
      }
      onConfirm={saveOutcome}
      onCancel={() => setPending(null)}
    >
      {pending && outcomeNeedsDate(pending.key) && (
        <div>
          <label className="block text-[12px] font-medium text-slate-500 mb-1.5">
            {pending.key === "rueckruf_termin" ? "Rückruf-Termin" : "Kunde zahlt am"}
          </label>
          <input
            type={pending.key === "rueckruf_termin" ? "datetime-local" : "date"}
            value={pending.date}
            /* Ein Termin in der Vergangenheit wird nie faellig und verschwindet
               lautlos. Genau das ist passiert: am 27.07. gespeichert, Termin
               stand auf dem 12.07. Der Browser sperrt jetzt alles davor — und
               der Server prueft es zusaetzlich, falls das Feld umgangen wird. */
            min={jetztFuerEingabe(pending.key === "rueckruf_termin")}
            onChange={(e) => setPending((p) => (p ? { ...p, date: e.target.value } : p))}
            className={inputCls}
            style={{ minHeight: 44 }}
          />
          {pending.key === "rueckruf_termin" && (
            <p className="text-[11px] text-slate-400 mt-1.5">Uhrzeit in deutscher Zeit (Europe/Berlin)</p>
          )}
          {pending.date && new Date(pending.date).getTime() < Date.now() - 5 * 60_000 && (
            <p className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 leading-snug">
              Dieser Zeitpunkt liegt in der Vergangenheit. Ein vergangener Termin wird nie fällig — bitte in die Zukunft legen.
            </p>
          )}
        </div>
      )}
    </ConfirmDialog>

    {/* Notausgang: Akte ohne Ergebnis schließen (Begründung Pflicht) */}
    <ConfirmDialog
      open={closeAkteOpen}
      title="Ohne Ergebnis schließen?"
      message="Die Akte wird geschlossen und du kannst die nächste öffnen."
      consequence="Zählt NICHT als Betreuung — es entsteht kein Provisionsanspruch. Der Kunde bleibt dir zugewiesen und vollständig gespeichert."
      confirmLabel="Schließen"
      busy={busy !== null}
      confirmDisabled={closeReason.trim().length < 3}
      onConfirm={doCloseAkte}
      onCancel={() => { setCloseAkteOpen(false); setCloseReason(""); }}
    >
      <div>
        <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Kurze Begründung</label>
        <input
          value={closeReason}
          onChange={(e) => setCloseReason(e.target.value)}
          placeholder="z. B. Feierabend, Kunde legte auf"
          className={inputCls}
          style={{ minHeight: 44 }}
          autoFocus
        />
      </div>
    </ConfirmDialog>

    {/* Reaktivieren bestätigen */}
    <ConfirmDialog
      open={confirmReactivate}
      title={`${custName(detail)} reaktivieren?`}
      message="Die Bestellung erhält eine neue 7-Tage-Zahlungsfrist und wird dir zugewiesen."
      consequence="Die Zahlungsdaten werden dem Kunden erneut per E-Mail gesendet."
      confirmLabel="Reaktivieren"
      busy={busy === "reactivate"}
      onConfirm={doReactivate}
      onCancel={() => setConfirmReactivate(false)}
    />

    {/* Verlaufseintrag als irrtümlich markieren */}
    <ConfirmDialog
      open={voidConfirmId != null}
      title="Eintrag als irrtümlich markieren?"
      message="Der Eintrag bleibt durchgestrichen im Verlauf sichtbar — es wird nichts gelöscht."
      confirmLabel="Als irrtümlich markieren"
      danger
      busy={busy === "void"}
      onConfirm={voidEntry}
      onCancel={() => setVoidConfirmId(null)}
    />

    {/* Zahlungsdaten-Mail — löst eine echte E-Mail aus, deshalb im Klartext angesagt */}
    <ConfirmDialog
      open={confirmEmail}
      title="Zahlungsdaten per E-Mail senden?"
      message={`${custName(detail)} erhält die Zahlungsdaten zu dieser Bestellung.`}
      consequence={`Es geht sofort eine E-Mail an ${detail.email || "die hinterlegte Adresse"} — mit Betrag, Verwendungszweck und Bankverbindung. Danach ist die Aktion für 10 Minuten gesperrt, damit der Kunde keine Mail doppelt bekommt.`}
      confirmLabel="E-Mail senden"
      busy={busy === "email"}
      onConfirm={sendEmail}
      onCancel={() => setConfirmEmail(false)}
    />

    {/* Aussortieren — Grund wählen im Dialog statt Inline-Panel */}
    <ConfirmDialog
      open={confirmDismiss !== null}
      title="Aus deiner Liste entfernen?"
      message={`${custName(detail)} verschwindet aus deiner Arbeitsliste.`}
      consequence="Es wird nichts gelöscht und keine E-Mail versendet. Der Datensatz bleibt vollständig gespeichert und kann vom Admin jederzeit zurückgeholt werden."
      confirmLabel="Entfernen"
      danger
      busy={busy === "dismiss"}
      confirmDisabled={!confirmDismiss}
      onConfirm={() => confirmDismiss && doDismiss(confirmDismiss)}
      onCancel={() => setConfirmDismiss(null)}
    >
      <div>
        <label className="block text-[12px] font-medium text-slate-500 mb-1.5">Grund</label>
        <div className="grid gap-1.5">
          {Object.entries(CUST_DISMISS_REASONS).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDismiss(key); }}
              className={`px-3 py-2.5 rounded-lg border text-[12.5px] font-medium text-left transition-colors ${
                confirmDismiss === key
                  ? "border-slate-400 bg-slate-50 text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
              style={{ minHeight: 44 }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </ConfirmDialog>
    </>
  );
}

function Field({ label, value, mono, breakAll }: { label: string; value: string; mono?: boolean; breakAll?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-medium text-slate-800 ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}
