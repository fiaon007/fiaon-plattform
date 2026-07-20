import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import { Search, Users } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ════════════════════════════════════════════════════════════════════
// /admin/kunden — DIE EINE LISTE (Prompt 1/2, ersetzt die Fragmente).
// Alle Personen (Leads + Kunden vereint), serverseitig paginiert,
// kombinierbare Filter. JEDER Treffer öffnet die Akte /admin/kunde/:id —
// keine Sackgassen, kein „nur Rechnung". Der frühere Inhalt dieser Datei
// (AdminApplicationsManager) lebt als Arbeits-Fokus in admin-antraege.tsx
// (/admin/database) weiter.
// ════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 50;

const LIFECYCLE_CHIPS: Array<{ key: string; label: string }> = [
  { key: "", label: "Alle" },
  { key: "lead", label: "Leads" },
  { key: "offen", label: "Offen" },
  { key: "angekuendigt", label: "Angekündigt" },
  { key: "bezahlt", label: "Bezahlt" },
  { key: "abgelaufen", label: "Abgelaufen" },
  { key: "storniert", label: "Storniert" },
  { key: "direktzahler", label: "Direktzahler" },
];

const BADGE: Record<string, string> = {
  lead: "bg-sky-50 text-sky-700",
  antrag: "bg-slate-50 text-slate-500",
  offen: "bg-blue-50 text-blue-700",
  angekuendigt: "bg-amber-50 text-amber-700",
  bezahlt: "bg-emerald-50 text-emerald-700",
  abgelaufen: "bg-rose-50 text-rose-600",
  storniert: "bg-slate-100 text-slate-500",
  ersetzt: "bg-slate-100 text-slate-400",
};
const BADGE_LABEL: Record<string, string> = {
  lead: "Lead", antrag: "Antrag", offen: "Offen", angekuendigt: "Angekündigt",
  bezahlt: "Bezahlt", abgelaufen: "Abgelaufen", storniert: "Storniert", ersetzt: "Ersetzt",
};

function fmtD(v: any): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminKundenPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);

  // Filter (kombinierbar)
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [agent, setAgent] = useState("");
  const [quelle, setQuelle] = useState("");
  const [paket, setPaket] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [ohneAgent, setOhneAgent] = useState(false);
  const [ohneTelefon, setOhneTelefon] = useState(false);
  const [dubletten, setDubletten] = useState(false);
  const [ueberfaellig, setUeberfaellig] = useState(false);
  const [anonyme, setAnonyme] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (pageArg: number) => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (q.trim().length >= 2) p.set("q", q.trim());
      if (status) p.set("status", status);
      if (agent) p.set("agent", agent);
      if (quelle) p.set("quelle", quelle);
      if (paket) p.set("paket", paket);
      if (von) p.set("von", von);
      if (bis) p.set("bis", bis);
      if (ohneAgent) p.set("ohne_agent", "1");
      if (ohneTelefon) p.set("ohne_telefon", "1");
      if (dubletten) p.set("dubletten", "1");
      if (ueberfaellig) p.set("ueberfaellig", "1");
      if (anonyme) p.set("anonyme", "1");
      p.set("limit", String(PAGE_SIZE));
      p.set("offset", String(pageArg * PAGE_SIZE));
      const res = await fetch(`/api/fiaon/admin/kunden?${p.toString()}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) { setRows(json.rows); setTotal(json.total); }
      else { setRows([]); setTotal(0); }
    } finally {
      setLoading(false);
    }
  }, [q, status, agent, quelle, paket, von, bis, ohneAgent, ohneTelefon, dubletten, ueberfaellig, anonyme]);

  // Debounce bei Freitext, sofort bei Filtern
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setPage(0); load(0); }, 250);
    return () => clearTimeout(timer.current);
  }, [load]);

  useEffect(() => {
    fetch(`/api/fiaon/admin/agents`, { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setAgents((j.data || []).filter((a: any) => a.active)); })
      .catch(() => {});
  }, []);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const goto = (p: number) => { setPage(p); load(p); };

  const toggle = (v: boolean, set: (b: boolean) => void) => () => set(!v);
  const chipCls = (active: boolean) =>
    `px-3.5 py-2 rounded-xl text-[12.5px] font-bold transition-all ${active ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/25" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageIntro
          id="kunden-akte"
          title="Kunden — die eine Liste"
          subtitle="Jede Person (Lead, Antragsteller, Kunde, bezahlt, storniert) genau einmal. Jeder Treffer öffnet die Akte — dort siehst, änderst und löst du alles aus."
          steps={[
            "Suche nach Name, E-Mail, Telefon oder Referenz — oder nutze die Filter (kombinierbar).",
            "Klick auf eine Zeile öffnet die Akte: Stammdaten ändern, bezahlt markieren (bucht Provision wie bisher), Mails senden, Agent zuweisen, Dubletten zusammenführen.",
            "Zahlungszentrale und Leads bleiben als Arbeits-Fokusse — die Wahrheit über eine Person steht aber immer hier in der Akte.",
            "Der Filter Dubletten-Verdacht zeigt Personen mit identischer E-Mail/Telefonnummer in mehreren Datensätzen — Zusammenführen (mit Undo) direkt in der Akte.",
          ]}
        />

        {/* Suche */}
        <div className="flex items-center gap-2.5 px-4 bg-white border border-slate-200 rounded-2xl focus-within:border-slate-400 transition-colors mt-4 mb-4">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, E-Mail, Telefon oder Referenz …"
            className="w-full py-3.5 text-[14px] outline-none placeholder:text-slate-400 bg-transparent"
          />
        </div>

        {/* Lifecycle-Chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {LIFECYCLE_CHIPS.map((c) => (
            <button key={c.key} type="button" onClick={() => setStatus(c.key)} className={chipCls(status === c.key)}>
              {c.label}
            </button>
          ))}
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select value={agent} onChange={(e) => setAgent(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600">
            <option value="">Agent: alle</option>
            {agents.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={quelle} onChange={(e) => setQuelle(e.target.value)} placeholder="Quelle/Kampagne …"
            className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[12.5px] w-40" />
          <select value={paket} onChange={(e) => setPaket(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[12.5px] font-semibold text-slate-600">
            <option value="">Paket: alle</option>
            {["start", "pro", "ultra", "highend", "business_starter", "business_pro", "business_ultra", "business_enterprise"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input type="date" value={von} onChange={(e) => setVon(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[12.5px]" title="Zeitraum von" />
          <input type="date" value={bis} onChange={(e) => setBis(e.target.value)} className="px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-[12.5px]" title="Zeitraum bis" />
          <button type="button" onClick={toggle(ohneAgent, setOhneAgent)} className={chipCls(ohneAgent)}>ohne Agent</button>
          <button type="button" onClick={toggle(ohneTelefon, setOhneTelefon)} className={chipCls(ohneTelefon)}>ohne Telefon</button>
          <button type="button" onClick={toggle(dubletten, setDubletten)} className={chipCls(dubletten)}>Dubletten-Verdacht</button>
          <button type="button" onClick={toggle(ueberfaellig, setUeberfaellig)} className={chipCls(ueberfaellig)} title="Zahlung angekündigt, seit mehr als 7 Tagen unbestätigt">Zahlung &gt; 7 Tage unbestätigt</button>
          <button type="button" onClick={toggle(anonyme, setAnonyme)} className={chipCls(anonyme)} title="Funnel-Abbrecher ohne E-Mail/Telefon einblenden">anonyme Abbrecher</button>
        </div>

        {/* Tabelle */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Name", "Status", "Kontakt", "Referenz", "Paket / Betrag", "Agent", "Quelle", "Seit"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-slate-400">Lädt …</td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-[13px] text-slate-400">Keine Personen für diese Filter.</td></tr>
                )}
                {!loading && rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => { window.location.href = `/admin/kunde/${encodeURIComponent(r.id)}`; }}
                    className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-800 whitespace-nowrap">{r.name}</p>
                      {r.dismissedAt && <p className="text-[10.5px] text-slate-400">aussortiert</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap ${BADGE[r.lifecycle] || "bg-slate-50 text-slate-500"}`}>
                        {BADGE_LABEL[r.lifecycle] || r.lifecycle}
                      </span>
                      {r.commissionBasis === "direktzahler" && <p className="text-[10px] text-slate-400 mt-0.5">Direktzahler</p>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">
                      <p className="truncate max-w-[220px]">{r.email || "—"}</p>
                      <p className="whitespace-nowrap">{r.phone || "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-500 whitespace-nowrap">{r.paymentReference || r.ref || `Lead #${r.leadId}`}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                      {(r.packName || "—").replace(/\n/g, " ")}
                      {r.amountDue != null && <span className="font-bold text-slate-700"> · {Number(r.amountDue).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{r.agentName || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{r.quelle || "—"}{r.kampagne ? ` · ${r.kampagne}` : ""}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 whitespace-nowrap">{fmtD(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination (serverseitig) */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4">
          <p className="text-[12px] text-slate-400">
            <Users size={12} className="inline mr-1" />
            {total.toLocaleString("de-DE")} Personen · Seite {page + 1} von {pages}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page === 0} onClick={() => goto(page - 1)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[12.5px] font-bold text-slate-600 disabled:opacity-40">← Zurück</button>
            <button type="button" disabled={page + 1 >= pages} onClick={() => goto(page + 1)}
              className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[12.5px] font-bold text-slate-600 disabled:opacity-40">Weiter →</button>
          </div>
        </div>

        <p className="mt-4 text-[11.5px] text-slate-400">
          Arbeits-Fokusse: <Link href="/admin/zahlungen" className="font-semibold text-[#2563eb] hover:underline">Zahlungszentrale</Link> (offene Zahlungen abarbeiten) ·{" "}
          <Link href="/admin/leads" className="font-semibold text-[#2563eb] hover:underline">Leads</Link> (Intake/Automatik) ·{" "}
          <Link href="/admin/database" className="font-semibold text-[#2563eb] hover:underline">Anträge & KYC</Link>. Detail-Wahrheit ist immer die Akte.
        </p>
      </div>
    </div>
  );
}
