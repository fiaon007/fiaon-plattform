import { useEffect, useState } from "react";
import { TIERS, TIER_ORDER, BENEFITS, CARD_DESIGNS, CARD_STATUS_LABEL, type InvestorTier } from "@/lib/investorProgram";

/* ── types ── */
interface InvestorRow {
  id: string; email: string; salutation?: string; first_name: string; last_name: string;
  phone?: string; company?: string; investor_type: string; tier?: InvestorTier; status: string;
  last_login_at?: string; created_at: string;
  total_invested_cents: number; current_value_cents: number; active_investments: number;
}
interface CardOrder {
  id: number; cardholder_name: string | null; card_design: string; status: string;
  price_cents: number; is_free: boolean; created_at: string;
}
interface BenefitRow { benefit_key: string; status: string; note: string | null; }
interface TokenAllocation { label: string; note?: string; tokens: number; }
interface TokenMeta {
  contractRef?: string; signedDate?: string; signedLocation?: string;
  blockchain?: string; tokenStandard?: string; walletAddress?: string;
  allocations?: TokenAllocation[];
}
interface Investment {
  id: number; name: string; investment_type: string; principal_cents: number;
  current_value_cents: number | null; currency: string; interest_rate: number | null;
  status: string; start_date: string | null; maturity_date: string | null;
  payout_frequency: string | null; description: string | null;
  token_quantity: number | null; token_purchase_price_cents: number | null; token_current_price_cents: number | null;
  token_meta: TokenMeta | null;
}
interface Transaction {
  id: number; investment_id: number | null; transaction_type: string; amount_cents: number;
  currency: string; description: string | null; transaction_date: string; status: string;
}
interface InvestorDoc {
  id: number; investment_id: number | null; title: string; document_type: string;
  file_name: string | null; file_size: number | null; created_at: string;
}
interface CapitalRequest {
  id: number; investment_id: number | null; request_type: string; amount_cents: number | null;
  currency: string; note: string | null; status: string; created_at: string;
}
interface Detail {
  investor: any; investments: Investment[]; transactions: Transaction[]; documents: InvestorDoc[];
  cardOrders: CardOrder[]; benefits: BenefitRow[]; requests?: CapitalRequest[];
}
const CARD_STATUSES = ["requested", "approved", "in_production", "shipped", "active", "cancelled"];

const eur = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format((cents || 0) / 100);
const fmtDate = (v?: string | null) => { if (!v) return "—"; try { return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; } };
const api = (url: string, opts: RequestInit = {}) => fetch(url, {
  ...opts,
  credentials: "include",
  headers: {
    ...(opts.headers as Record<string, string> ?? {}),
    "x-admin-token": "fiaon-admin-2024",
  },
});

const INV_TYPES = [["fund", "Fonds"], ["equity", "Beteiligung"], ["bond", "Anleihe"], ["loan", "Darlehen"], ["real_estate", "Immobilie"], ["token", "🪙 ARAS Token"], ["other", "Sonstiges"]];
const INV_STATUS = [["active", "Aktiv"], ["matured", "Fällig"], ["pending", "Ausstehend"], ["cancelled", "Beendet"]];
const TX_TYPES = [["interest", "Zinsen / Rendite"], ["payout", "Auszahlung"], ["deposit", "Einzahlung"], ["fee", "Gebühr"], ["withdrawal", "Entnahme"]];
const TX_STATUS = [["completed", "Abgeschlossen"], ["pending", "Ausstehend"], ["scheduled", "Geplant"]];
const DOC_TYPES = [["contract", "Vertrag"], ["statement", "Abrechnung"], ["tax", "Steuer"], ["report", "Report"], ["other", "Sonstiges"]];

/* ── small UI ── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label className="block"><span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</span>{children}</label>);
}
const inputCls = "w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminInvestorsManager() {
  const [investors, setInvestors] = useState<InvestorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailTab, setDetailTab] = useState<"profile" | "investments" | "transactions" | "requests" | "card" | "benefits" | "documents">("profile");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<null | "newInvestor" | "newInvestment" | "newTransaction" | "newDocument" | "password">(null);
  const [editInv, setEditInv] = useState<Investment | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const loadList = async () => {
    setLoading(true);
    try { const r = await api("/api/admin/investors"); const d = await r.json(); if (d.ok) setInvestors(d.investors || []); }
    catch {} finally { setLoading(false); }
  };
  const loadDetail = async (id: string) => {
    try { const r = await api(`/api/admin/investors/${id}`); const d = await r.json(); if (d.ok) setDetail(d); }
    catch {}
  };
  useEffect(() => { loadList(); }, []);
  useEffect(() => { if (selectedId) { setDetail(null); setDetailTab("profile"); loadDetail(selectedId); } }, [selectedId]);

  const filtered = investors.filter((i) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return `${i.first_name} ${i.last_name} ${i.email} ${i.company || ""}`.toLowerCase().includes(q);
  });

  /* ── actions ── */
  const createInvestor = async (form: any) => {
    setBusy(true);
    try {
      const r = await api("/api/admin/investors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (!r.ok || !d.ok) { flash(d.error || "Fehler"); return; }
      setModal(null); flash("Investor angelegt"); await loadList(); setSelectedId(d.investor.id);
    } finally { setBusy(false); }
  };
  const saveProfile = async (updates: any) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
      const d = await r.json();
      if (d.ok) { flash("Gespeichert"); await loadDetail(selectedId); await loadList(); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const resetPassword = async (password: string) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}/password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const d = await r.json();
      if (d.ok) { flash("Passwort gesetzt"); setModal(null); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const deleteInvestor = async () => {
    if (!selectedId || !confirm("Investor und alle zugehörigen Daten wirklich löschen?")) return;
    await api(`/api/admin/investors/${selectedId}`, { method: "DELETE" });
    flash("Gelöscht"); setSelectedId(null); setDetail(null); loadList();
  };
  const addInvestment = async (form: any) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}/investments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { flash("Investment hinzugefügt"); setModal(null); await loadDetail(selectedId); await loadList(); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const updateInvestment = async (invId: number, form: any) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}/investments/${invId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { flash("Investment aktualisiert"); setEditInv(null); await loadDetail(selectedId); await loadList(); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const deleteInvestment = async (invId: number) => {
    if (!selectedId || !confirm("Investment löschen?")) return;
    await api(`/api/admin/investors/${selectedId}/investments/${invId}`, { method: "DELETE" });
    await loadDetail(selectedId); await loadList();
  };
  const updateRequest = async (reqId: number, status: string) => {
    if (!selectedId) return;
    const r = await api(`/api/admin/investors/${selectedId}/requests/${reqId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const d = await r.json();
    if (d.ok) { flash("Anfrage aktualisiert"); await loadDetail(selectedId); } else flash(d.error || "Fehler");
  };
  const deleteRequest = async (reqId: number) => {
    if (!selectedId || !confirm("Anfrage löschen?")) return;
    await api(`/api/admin/investors/${selectedId}/requests/${reqId}`, { method: "DELETE" });
    await loadDetail(selectedId);
  };
  const addTransaction = async (form: any) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}/transactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.ok) { flash("Buchung hinzugefügt"); setModal(null); await loadDetail(selectedId); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const deleteTransaction = async (txId: number) => {
    if (!selectedId || !confirm("Buchung löschen?")) return;
    await api(`/api/admin/investors/${selectedId}/transactions/${txId}`, { method: "DELETE" });
    await loadDetail(selectedId);
  };
  const uploadDocument = async (formData: FormData) => {
    if (!selectedId) return; setBusy(true);
    try {
      const r = await api(`/api/admin/investors/${selectedId}/documents`, { method: "POST", body: formData });
      const d = await r.json();
      if (d.ok) { flash("Dokument hochgeladen"); setModal(null); await loadDetail(selectedId); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const deleteDocument = async (docId: number) => {
    if (!selectedId || !confirm("Dokument löschen?")) return;
    await api(`/api/admin/investors/${selectedId}/documents/${docId}`, { method: "DELETE" });
    await loadDetail(selectedId);
  };
  // ── card ──
  const createCard = async (isFree: boolean) => {
    if (!selectedId) return; setBusy(true);
    try {
      const tier = detail?.investor?.tier;
      const r = await api(`/api/admin/investors/${selectedId}/card`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardholderName: `${detail?.investor?.first_name ?? ""} ${detail?.investor?.last_name ?? ""}`.trim(), cardDesign: tier === "circle" ? "circle" : tier === "premium" ? "gold" : "classic", isFree, priceCents: isFree ? 0 : 49900 }),
      });
      const d = await r.json();
      if (d.ok) { flash("Karte erstellt"); await loadDetail(selectedId); } else flash(d.error || "Fehler");
    } finally { setBusy(false); }
  };
  const updateCardStatus = async (orderId: number, status: string) => {
    if (!selectedId) return;
    const r = await api(`/api/admin/investors/${selectedId}/card/${orderId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    const d = await r.json();
    if (d.ok) { flash("Status aktualisiert"); await loadDetail(selectedId); } else flash(d.error || "Fehler");
  };
  const deleteCard = async (orderId: number) => {
    if (!selectedId || !confirm("Kartenbestellung löschen?")) return;
    await api(`/api/admin/investors/${selectedId}/card/${orderId}`, { method: "DELETE" });
    await loadDetail(selectedId);
  };
  // ── benefits ──
  const toggleBenefit = async (key: string) => {
    if (!selectedId || !detail) return;
    const current = new Set(detail.benefits.map((b) => b.benefit_key));
    if (current.has(key)) current.delete(key); else current.add(key);
    const r = await api(`/api/admin/investors/${selectedId}/benefits`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ benefits: Array.from(current) }),
    });
    const d = await r.json();
    if (d.ok) { await loadDetail(selectedId); } else flash(d.error || "Fehler");
  };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-5 right-5 z-[60] px-4 py-2.5 bg-slate-900 text-white text-[13px] font-semibold rounded-xl shadow-lg">{toast}</div>}

      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-0.5">Schwarzott Group Banking</p>
          <h2 className="text-[18px] font-bold text-slate-900">Investoren-Verwaltung</h2>
        </div>
        <button onClick={() => setModal("newInvestor")} className="px-4 py-2.5 bg-[#2563eb] text-white text-[13px] font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-[0_4px_14px_rgba(37,99,235,.3)]">+ Neuer Investor</button>
      </div>

      <div className="grid lg:grid-cols-[340px_1fr] gap-5">
        {/* ── LIST ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-fit">
          <div className="p-4 border-b border-slate-100">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen…" className={inputCls} />
          </div>
          <div className="max-h-[640px] overflow-auto divide-y divide-slate-50">
            {loading ? (
              <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-slate-50 animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-[13px] text-slate-400">Keine Investoren</div>
            ) : filtered.map((inv) => (
              <button key={inv.id} onClick={() => setSelectedId(inv.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selectedId === inv.id ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-[12px] font-bold shrink-0">{(inv.first_name?.[0] || "?").toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate">{inv.first_name} {inv.last_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{inv.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[12px] font-bold text-slate-900 tabular-nums">{eur(inv.current_value_cents)}</p>
                  {inv.tier && inv.tier !== "standard" && <span className="inline-block text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ background: (TIERS[inv.tier] || TIERS.standard).gradient }}>{(TIERS[inv.tier] || TIERS.standard).label}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── DETAIL ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
          {!selectedId ? (
            <div className="h-full flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-2xl mb-4">🏦</div>
              <p className="text-[14px] font-semibold text-slate-700">Investor auswählen</p>
              <p className="text-[12px] text-slate-400 mt-1">Wählen Sie links einen Investor aus oder legen Sie einen neuen an.</p>
            </div>
          ) : !detail ? (
            <div className="p-6 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-50 animate-pulse" />)}</div>
          ) : (
            <div>
              {/* detail header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-[16px] font-bold">{(detail.investor.first_name?.[0] || "?").toUpperCase()}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[16px] font-bold text-slate-900">{detail.investor.salutation ? detail.investor.salutation + " " : ""}{detail.investor.first_name} {detail.investor.last_name}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white" style={{ background: (TIERS[(detail.investor.tier as InvestorTier)] || TIERS.standard).gradient }}>{(TIERS[(detail.investor.tier as InvestorTier)] || TIERS.standard).label}</span>
                    </div>
                    <p className="text-[12px] text-slate-400">{detail.investor.email} · {detail.investor.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setModal("password")} className="px-3 py-2 text-[12px] font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Passwort</button>
                  <button onClick={deleteInvestor} className="px-3 py-2 text-[12px] font-semibold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">Löschen</button>
                </div>
              </div>

              {/* tabs */}
              <div className="px-6 pt-4 flex items-center gap-1.5 border-b border-slate-100 overflow-x-auto">
                {(() => {
                  const pendingReqs = (detail.requests || []).filter((r) => r.status === "pending").length;
                  const tabs: [string, React.ReactNode][] = [
                    ["profile", "Profil"],
                    ["investments", `Investments (${detail.investments.length})`],
                    ["transactions", `Buchungen (${detail.transactions.length})`],
                    ["requests", <span className="flex items-center gap-1.5">Anfragen {pendingReqs > 0 && <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold">{pendingReqs}</span>}</span>],
                    ["card", "Karte"],
                    ["benefits", `Leistungen (${detail.benefits.length})`],
                    ["documents", `Dokumente (${detail.documents.length})`],
                  ];
                  return tabs.map(([id, label]) => (
                    <button key={id} onClick={() => setDetailTab(id as any)} className={`px-3.5 py-2.5 text-[13px] font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${detailTab === id ? "text-[#2563eb] border-[#2563eb]" : "text-slate-500 border-transparent hover:text-slate-800"}`}>{label}</button>
                  ));
                })()}
              </div>

              <div className="p-6">
                {detailTab === "profile" && <ProfileTab investor={detail.investor} onSave={saveProfile} busy={busy} />}
                {detailTab === "investments" && (
                  <div className="space-y-3">
                    <div className="flex justify-end"><button onClick={() => setModal("newInvestment")} className="px-3.5 py-2 text-[12px] font-bold text-white bg-[#2563eb] rounded-lg hover:bg-blue-700 transition-colors">+ Investment</button></div>
                    {detail.investments.length === 0 ? <p className="py-10 text-center text-[13px] text-slate-400">Keine Investments</p> : detail.investments.map((inv) => {
                      const isToken = inv.investment_type === "token";
                      const pnlCents = (inv.current_value_cents ?? inv.principal_cents) - inv.principal_cents;
                      const pnlPct = inv.principal_cents > 0 ? (pnlCents / inv.principal_cents) * 100 : null;
                      const eurFmt = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
                      return (
                        <div key={inv.id} className={`p-3.5 rounded-xl border ${isToken ? "border-amber-200 bg-amber-50/40" : "border-slate-100"}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-semibold text-slate-900">{isToken ? "🪙 " : ""}{inv.name}</p>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{INV_STATUS.find(s => s[0] === inv.status)?.[1] || inv.status}</span>
                              </div>
                              {isToken && inv.token_quantity != null ? (
                                <div className="mt-1 space-y-0.5">
                                  <p className="text-[11px] text-slate-500">
                                    {Number(inv.token_quantity).toLocaleString("de-DE")} Token · Einkauf {inv.token_purchase_price_cents != null ? eurFmt.format(inv.token_purchase_price_cents / 100) : "—"} / Token · Aktuell {inv.token_current_price_cents != null ? eurFmt.format(inv.token_current_price_cents / 100) : "—"} / Token
                                  </p>
                                  <p className="text-[11px] text-slate-400">Einkaufswert: {eur(inv.principal_cents)}</p>
                                </div>
                              ) : (
                                <p className="text-[11px] text-slate-400">{eur(inv.principal_cents)} · {inv.interest_rate ?? 0} % p.a.</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[13px] font-bold text-slate-900 tabular-nums">{eur(inv.current_value_cents ?? inv.principal_cents)}</p>
                              {pnlPct != null && inv.current_value_cents != null && (
                                <p className={`text-[11px] font-semibold tabular-nums ${pnlCents >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                  {pnlCents >= 0 ? "+" : ""}{eur(pnlCents)} ({pnlCents >= 0 ? "+" : ""}{pnlPct.toFixed(2)} %)
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => setEditInv(inv)} className="px-2 py-1 text-[11px] font-semibold text-[#2563eb] bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Bearbeiten</button>
                              <button onClick={() => deleteInvestment(inv.id)} className="text-slate-300 hover:text-rose-500 transition-colors px-1">✕</button>
                            </div>
                          </div>
                          {isToken && (
                            <p className="mt-2 pt-2 border-t border-amber-200/60 text-[10.5px] text-amber-700">
                              Tipp: Über <strong>Bearbeiten</strong> den aktuellen Kurs anpassen — Wert &amp; Gewinn/Verlust beim Investor aktualisieren sich automatisch.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {detailTab === "transactions" && (
                  <div className="space-y-3">
                    <div className="flex justify-end"><button onClick={() => setModal("newTransaction")} className="px-3.5 py-2 text-[12px] font-bold text-white bg-[#2563eb] rounded-lg hover:bg-blue-700 transition-colors">+ Buchung</button></div>
                    {detail.transactions.length === 0 ? <p className="py-10 text-center text-[13px] text-slate-400">Keine Buchungen</p> : detail.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900">{tx.description || TX_TYPES.find(t => t[0] === tx.transaction_type)?.[1]}</p>
                          <p className="text-[11px] text-slate-400">{TX_TYPES.find(t => t[0] === tx.transaction_type)?.[1]} · {fmtDate(tx.transaction_date)} · {tx.status}</p>
                        </div>
                        <p className="text-[13px] font-bold text-slate-900 tabular-nums">{eur(tx.amount_cents)}</p>
                        <button onClick={() => deleteTransaction(tx.id)} className="text-slate-300 hover:text-rose-500 transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {detailTab === "requests" && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-slate-400">Einzahlungs- &amp; Auszahlungsanfragen der Investoren. Nichts wird automatisch ausgeführt — jede Anfrage wird hier manuell geprüft.</p>
                    {(detail.requests || []).length === 0 ? <p className="py-10 text-center text-[13px] text-slate-400">Keine Anfragen</p> : (detail.requests || []).map((rq) => {
                      const isDeposit = rq.request_type === "deposit";
                      const stCls = rq.status === "pending" ? "bg-amber-50 text-amber-700" : rq.status === "approved" || rq.status === "completed" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700";
                      const stLabel = ({ pending: "Offen", approved: "Genehmigt", rejected: "Abgelehnt", completed: "Erledigt" } as Record<string, string>)[rq.status] || rq.status;
                      const linkedInv = detail.investments.find((i) => i.id === rq.investment_id);
                      return (
                        <div key={rq.id} className={`p-3.5 rounded-xl border ${rq.status === "pending" ? "border-amber-200 bg-amber-50/30" : "border-slate-100"}`}>
                          <div className="flex items-start gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-[15px] shrink-0 ${isDeposit ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{isDeposit ? "↓" : "↑"}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[13px] font-semibold text-slate-900">{isDeposit ? "Einzahlung anfragen" : "Auszahlung anfragen"}</p>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stCls}`}>{stLabel}</span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(rq.created_at)}{linkedInv ? ` · ${linkedInv.name}` : ""}</p>
                              {rq.note && <p className="text-[12px] text-slate-600 mt-1.5 leading-snug bg-white border border-slate-100 rounded-lg px-2.5 py-1.5">{rq.note}</p>}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[15px] font-bold text-slate-900 tabular-nums">{rq.amount_cents != null ? eur(rq.amount_cents) : "—"}</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                            {rq.status === "pending" ? (
                              <>
                                <button onClick={() => updateRequest(rq.id, "approved")} className="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Genehmigen</button>
                                <button onClick={() => updateRequest(rq.id, "rejected")} className="px-3 py-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">Ablehnen</button>
                              </>
                            ) : (
                              <button onClick={() => updateRequest(rq.id, "pending")} className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Zurücksetzen</button>
                            )}
                            <button onClick={() => deleteRequest(rq.id)} className="px-2 py-1.5 text-[11px] text-slate-300 hover:text-rose-500 transition-colors">Löschen</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {detailTab === "card" && (
                  <div className="space-y-3">
                    {detail.cardOrders.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-[13px] text-slate-400 mb-4">Keine Kartenbestellung vorhanden.</p>
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => createCard(detail.investor.tier === "circle")} disabled={busy} className="px-3.5 py-2 text-[12px] font-bold text-white bg-[#2563eb] rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">Karte anlegen{detail.investor.tier === "circle" ? " (kostenlos)" : " (499 €)"}</button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-3">Der Investor kann seine Karte auch selbst im Portal bestellen.</p>
                      </div>
                    ) : detail.cardOrders.map((order) => (
                      <div key={order.id} className="rounded-xl border border-slate-100 p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div>
                            <p className="text-[13px] font-semibold text-slate-900">{(CARD_DESIGNS as Record<string, { label: string }>)[order.card_design]?.label || order.card_design}-Karte · {order.cardholder_name || "—"}</p>
                            <p className="text-[11px] text-slate-400">{order.is_free ? "Kostenlos" : `${(order.price_cents / 100).toLocaleString("de-DE")} €`} · bestellt {fmtDate(order.created_at)}</p>
                          </div>
                          <button onClick={() => deleteCard(order.id)} className="text-slate-300 hover:text-rose-500 transition-colors px-1">✕</button>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {CARD_STATUSES.map((s) => (
                            <button key={s} onClick={() => updateCardStatus(order.id, s)}
                              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${order.status === s ? "bg-[#2563eb] text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                              {CARD_STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {detailTab === "benefits" && (
                  <div className="space-y-3">
                    <p className="text-[12px] text-slate-400">Aktivieren Sie die Leistungen, die diesem Investor zur Verfügung stehen. Änderungen werden sofort gespeichert.</p>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {BENEFITS.map((b) => {
                        const active = detail.benefits.some((x) => x.benefit_key === b.key);
                        return (
                          <button key={b.key} onClick={() => toggleBenefit(b.key)}
                            className={`text-left p-3.5 rounded-xl border transition-all ${active ? "border-[#2563eb] bg-blue-50/50" : "border-slate-100 hover:border-slate-200 bg-white"}`}>
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-[13px] font-semibold ${active ? "text-slate-900" : "text-slate-600"}`}>{b.title}</p>
                              <span className={`mt-0.5 w-9 h-5 rounded-full shrink-0 relative transition-colors ${active ? "bg-[#2563eb]" : "bg-slate-200"}`}>
                                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${active ? "left-[18px]" : "left-0.5"}`} />
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 leading-snug">{b.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {detailTab === "documents" && (
                  <div className="space-y-3">
                    <div className="flex justify-end"><button onClick={() => setModal("newDocument")} className="px-3.5 py-2 text-[12px] font-bold text-white bg-[#2563eb] rounded-lg hover:bg-blue-700 transition-colors">+ Dokument</button></div>
                    {detail.documents.length === 0 ? <p className="py-10 text-center text-[13px] text-slate-400">Keine Dokumente</p> : detail.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{doc.title}</p>
                          <p className="text-[11px] text-slate-400">{DOC_TYPES.find(t => t[0] === doc.document_type)?.[1]} · {doc.file_name} · {fmtDate(doc.created_at)}</p>
                        </div>
                        <a href={`/api/admin/investors/${selectedId}/documents/${doc.id}/download`} className="text-[12px] font-semibold text-[#2563eb] hover:underline">↓</a>
                        <button onClick={() => deleteDocument(doc.id)} className="text-slate-300 hover:text-rose-500 transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS ── */}
      {modal === "newInvestor" && <NewInvestorModal onClose={() => setModal(null)} onSubmit={createInvestor} busy={busy} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} onSubmit={resetPassword} busy={busy} />}
      {modal === "newInvestment" && <InvestmentModal onClose={() => setModal(null)} onSubmit={addInvestment} busy={busy} />}
      {editInv && <InvestmentModal onClose={() => setEditInv(null)} onSubmit={(form) => updateInvestment(editInv.id, form)} busy={busy} initial={editInv} />}
      {modal === "newTransaction" && <TransactionModal onClose={() => setModal(null)} onSubmit={addTransaction} busy={busy} investments={detail?.investments || []} />}
      {modal === "newDocument" && <DocumentModal onClose={() => setModal(null)} onSubmit={uploadDocument} busy={busy} investments={detail?.investments || []} />}
    </div>
  );
}

/* ════════ PROFILE TAB ════════ */
function ProfileTab({ investor, onSave, busy }: { investor: any; onSave: (u: any) => void; busy: boolean }) {
  const [f, setF] = useState({
    salutation: investor.salutation || "", firstName: investor.first_name || "", lastName: investor.last_name || "",
    email: investor.email || "", phone: investor.phone || "", company: investor.company || "",
    investorType: investor.investor_type || "private", tier: investor.tier || "standard", status: investor.status || "active",
    street: investor.street || "", zip: investor.zip || "", city: investor.city || "",
    country: investor.country || "Deutschland", iban: investor.iban || "", taxId: investor.tax_id || "", notes: investor.notes || "",
  });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Anrede"><select value={f.salutation} onChange={(e) => set("salutation", e.target.value)} className={inputCls}><option value="">—</option><option>Herr</option><option>Frau</option><option>Divers</option></select></Field>
        <Field label="Vorname"><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} /></Field>
        <Field label="Nachname"><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="E-Mail"><input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
        <Field label="Telefon"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Firma"><input value={f.company} onChange={(e) => set("company", e.target.value)} className={inputCls} /></Field>
        <Field label="Typ"><select value={f.investorType} onChange={(e) => set("investorType", e.target.value)} className={inputCls}><option value="private">Privat</option><option value="institutional">Institutionell</option></select></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Mitgliedschaft (Tier)"><select value={f.tier} onChange={(e) => set("tier", e.target.value)} className={inputCls}>{TIER_ORDER.map((t) => <option key={t} value={t}>{TIERS[t].label}</option>)}</select></Field>
        <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}><option value="active">Aktiv</option><option value="pending">Ausstehend</option><option value="inactive">Deaktiviert</option></select></Field>
      </div>
      <div className="grid sm:grid-cols-4 gap-4">
        <Field label="Straße"><input value={f.street} onChange={(e) => set("street", e.target.value)} className={inputCls} /></Field>
        <Field label="PLZ"><input value={f.zip} onChange={(e) => set("zip", e.target.value)} className={inputCls} /></Field>
        <Field label="Ort"><input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} /></Field>
        <Field label="Land"><input value={f.country} onChange={(e) => set("country", e.target.value)} className={inputCls} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="IBAN (Auszahlungen)"><input value={f.iban} onChange={(e) => set("iban", e.target.value)} className={inputCls} /></Field>
        <Field label="Steuer-ID"><input value={f.taxId} onChange={(e) => set("taxId", e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="Interne Notizen"><textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls} /></Field>
      <div className="flex justify-end"><button disabled={busy} onClick={() => onSave(f)} className="px-5 py-2.5 bg-slate-900 text-white text-[13px] font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">{busy ? "Speichern…" : "Speichern"}</button></div>
    </div>
  );
}

/* ════════ MODALS ════════ */
function NewInvestorModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (f: any) => void; busy: boolean }) {
  const [f, setF] = useState({ salutation: "", firstName: "", lastName: "", email: "", phone: "", company: "", password: "", investorType: "private", tier: "standard", status: "active" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const gen = () => set("password", Math.random().toString(36).slice(2, 10) + "A1!");
  return (
    <Modal title="Neuer Investor" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Anrede"><select value={f.salutation} onChange={(e) => set("salutation", e.target.value)} className={inputCls}><option value="">—</option><option>Herr</option><option>Frau</option><option>Divers</option></select></Field>
          <Field label="Vorname *"><input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} className={inputCls} /></Field>
          <Field label="Nachname *"><input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="E-Mail *"><input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon"><input value={f.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} /></Field>
          <Field label="Firma"><input value={f.company} onChange={(e) => set("company", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Passwort *">
          <div className="flex gap-2">
            <input value={f.password} onChange={(e) => set("password", e.target.value)} className={inputCls} placeholder="min. 6 Zeichen" />
            <button onClick={gen} className="px-3 py-2 text-[12px] font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 whitespace-nowrap">Generieren</button>
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Typ"><select value={f.investorType} onChange={(e) => set("investorType", e.target.value)} className={inputCls}><option value="private">Privat</option><option value="institutional">Institutionell</option></select></Field>
          <Field label="Tier"><select value={f.tier} onChange={(e) => set("tier", e.target.value)} className={inputCls}>{TIER_ORDER.map((t) => <option key={t} value={t}>{TIERS[t].label}</option>)}</select></Field>
          <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}><option value="active">Aktiv</option><option value="pending">Ausstehend</option></select></Field>
        </div>
        <button disabled={busy} onClick={() => onSubmit(f)} className="w-full py-3 bg-[#2563eb] text-white text-[13px] font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">{busy ? "Anlegen…" : "Investor anlegen"}</button>
      </div>
    </Modal>
  );
}

function PasswordModal({ onClose, onSubmit, busy }: { onClose: () => void; onSubmit: (p: string) => void; busy: boolean }) {
  const [pw, setPw] = useState("");
  return (
    <Modal title="Passwort zurücksetzen" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Neues Passwort"><input value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="min. 6 Zeichen" /></Field>
        <button disabled={busy || pw.length < 6} onClick={() => onSubmit(pw)} className="w-full py-3 bg-slate-900 text-white text-[13px] font-bold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50">{busy ? "Speichern…" : "Passwort setzen"}</button>
      </div>
    </Modal>
  );
}

const fmtNum = (n: number | null | undefined) => (n == null ? "" : String(n));
const centsToStr = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
const dateToInput = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : "");

function InvestmentModal({ onClose, onSubmit, busy, initial }: { onClose: () => void; onSubmit: (f: any) => void; busy: boolean; initial?: Investment }) {
  const isEdit = !!initial;
  const m = initial?.token_meta || null;
  const [f, setF] = useState({
    name: initial?.name ?? "ARAS Token",
    investmentType: initial?.investment_type ?? "token",
    principal: isEdit && initial!.investment_type !== "token" ? centsToStr(initial!.principal_cents) : "",
    currentValue: isEdit && initial!.investment_type !== "token" ? centsToStr(initial!.current_value_cents) : "",
    interestRate: initial?.interest_rate != null ? String(initial.interest_rate) : "",
    status: initial?.status ?? "active",
    startDate: dateToInput(initial?.start_date),
    maturityDate: dateToInput(initial?.maturity_date),
    payoutFrequency: initial?.payout_frequency ?? "yearly",
    description: initial?.description ?? "",
    tokenQty: fmtNum(initial?.token_quantity),
    tokenBuyPrice: centsToStr(initial?.token_purchase_price_cents),
    tokenCurPrice: centsToStr(initial?.token_current_price_cents),
    investmentAmount: initial?.investment_type === "token" ? centsToStr(initial?.principal_cents) : "",
    contractRef: m?.contractRef ?? "",
    signedDate: dateToInput(m?.signedDate),
    signedLocation: m?.signedLocation ?? "",
    blockchain: m?.blockchain ?? "Arbitrum One",
    tokenStandard: m?.tokenStandard ?? "ERC-20",
    walletAddress: m?.walletAddress ?? "",
  });
  const [allocations, setAllocations] = useState<{ label: string; note: string; tokens: string }[]>(
    m?.allocations?.length ? m.allocations.map((a) => ({ label: a.label ?? "", note: a.note ?? "", tokens: a.tokens != null ? String(a.tokens) : "" })) : []
  );
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const isToken = f.investmentType === "token";

  const tokenQtyN = parseFloat(f.tokenQty || "0");
  const tokenBuyN = parseFloat(f.tokenBuyPrice || "0");
  const tokenCurN = parseFloat(f.tokenCurPrice || "0");
  const investN = parseFloat(f.investmentAmount || "0");
  // Principal = explicit invested capital, else quantity × purchase price
  const previewPrincipal = isToken ? (investN > 0 ? investN : (tokenQtyN > 0 && tokenBuyN > 0 ? tokenQtyN * tokenBuyN : null)) : null;
  const previewCurrent = isToken && tokenQtyN > 0 && tokenCurN > 0 ? tokenQtyN * tokenCurN : null;
  const pnl = previewPrincipal != null && previewCurrent != null ? previewCurrent - previewPrincipal : null;
  const pnlPct = previewPrincipal != null && previewPrincipal > 0 && pnl != null ? (pnl / previewPrincipal) * 100 : null;
  const eurF = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
  const allocSum = allocations.reduce((s, a) => s + (parseFloat(a.tokens || "0") || 0), 0);

  const setAlloc = (i: number, k: string, v: string) => setAllocations((p) => p.map((a, idx) => (idx === i ? { ...a, [k]: v } : a)));
  const addAlloc = () => setAllocations((p) => [...p, { label: "", note: "", tokens: "" }]);
  const removeAlloc = (i: number) => setAllocations((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    if (isToken) {
      const cleanAllocs = allocations
        .filter((a) => a.label.trim() && a.tokens.trim())
        .map((a) => ({ label: a.label.trim(), note: a.note.trim() || undefined, tokens: Math.round(Number(a.tokens)) }));
      const tokenMeta = {
        contractRef: f.contractRef.trim() || undefined,
        signedDate: f.signedDate || undefined,
        signedLocation: f.signedLocation.trim() || undefined,
        blockchain: f.blockchain.trim() || undefined,
        tokenStandard: f.tokenStandard.trim() || undefined,
        walletAddress: f.walletAddress.trim() || undefined,
        allocations: cleanAllocs.length ? cleanAllocs : undefined,
      };
      onSubmit({
        name: f.name, investmentType: f.investmentType, status: f.status, description: f.description,
        startDate: f.startDate || null, maturityDate: f.maturityDate || null, payoutFrequency: f.payoutFrequency,
        tokenQuantity: f.tokenQty === "" ? null : Number(f.tokenQty),
        tokenPurchasePriceCents: f.tokenBuyPrice === "" ? null : Math.round(Number(f.tokenBuyPrice) * 100),
        tokenCurrentPriceCents: f.tokenCurPrice === "" ? null : Math.round(Number(f.tokenCurPrice) * 100),
        investmentAmountCents: f.investmentAmount === "" ? null : Math.round(Number(f.investmentAmount) * 100),
        interestRate: null,
        tokenMeta,
      });
    } else {
      onSubmit({
        name: f.name, investmentType: f.investmentType, status: f.status, payoutFrequency: f.payoutFrequency, description: f.description,
        startDate: f.startDate || null, maturityDate: f.maturityDate || null,
        principalCents: Math.round(parseFloat(f.principal || "0") * 100),
        currentValueCents: f.currentValue === "" ? null : Math.round(parseFloat(f.currentValue) * 100),
        interestRate: f.interestRate === "" ? null : parseFloat(f.interestRate),
      });
    }
  };
  return (
    <Modal title={isEdit ? "Investment bearbeiten" : "Neues Investment"} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Bezeichnung *"><input value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="z.B. FIAON Wachstums-Fonds I" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Typ"><select value={f.investmentType} onChange={(e) => { set("investmentType", e.target.value); if (e.target.value === "token" && !f.name) set("name", "ARAS Token"); }} className={inputCls}>{INV_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>{INV_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        </div>

        {isToken ? (
          <>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[12px] text-amber-800 font-medium">
              🪙 Token-Investment — Anzahl, Zuteilungs- und aktueller Kurs werden pro Token angegeben. Wert &amp; Gewinn/Verlust beim Investor werden automatisch berechnet.
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Anzahl Token *"><input type="number" step="1" min="0" value={f.tokenQty} onChange={(e) => set("tokenQty", e.target.value)} className={inputCls} placeholder="z.B. 504164" /></Field>
              <Field label="Zuteilungskurs (€/Token) *"><input type="number" step="0.0001" min="0" value={f.tokenBuyPrice} onChange={(e) => set("tokenBuyPrice", e.target.value)} className={inputCls} placeholder="z.B. 0.12" /></Field>
              <Field label="Aktueller Kurs (€/Token) *"><input type="number" step="0.0001" min="0" value={f.tokenCurPrice} onChange={(e) => set("tokenCurPrice", e.target.value)} className={inputCls} placeholder="z.B. 0.15" /></Field>
            </div>
            <Field label="Investitionsbetrag (€) — tatsächlich eingezahltes Kapital">
              <input type="number" step="0.01" min="0" value={f.investmentAmount} onChange={(e) => set("investmentAmount", e.target.value)} className={inputCls} placeholder="optional – leer = Anzahl × Zuteilungskurs" />
            </Field>
            {previewPrincipal != null && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Berechnung (Vorschau)</p>
                <div className="flex justify-between text-[13px]"><span className="text-slate-600">Investiertes Kapital</span><span className="font-semibold text-slate-900">{eurF.format(previewPrincipal)}</span></div>
                {previewCurrent != null && <div className="flex justify-between text-[13px]"><span className="text-slate-600">Aktueller Wert ({tokenQtyN.toLocaleString("de-DE")} × {eurF.format(tokenCurN)})</span><span className="font-semibold text-slate-900">{eurF.format(previewCurrent)}</span></div>}
                {pnl != null && (
                  <div className="flex justify-between text-[13px] pt-1 border-t border-slate-200"><span className="text-slate-600">Gewinn / Verlust</span>
                    <span className={`font-bold ${pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{pnl >= 0 ? "+" : ""}{eurF.format(pnl)}{pnlPct != null && <> ({pnl >= 0 ? "+" : ""}{pnlPct.toFixed(2)} %)</>}</span>
                  </div>
                )}
              </div>
            )}

            {/* Contract metadata */}
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Vertragsdetails (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vertragsreferenz"><input value={f.contractRef} onChange={(e) => set("contractRef", e.target.value)} className={inputCls} placeholder="z.B. O3GU8-SKXPJ-…" /></Field>
                <Field label="Unterzeichnet am"><input type="date" value={f.signedDate} onChange={(e) => set("signedDate", e.target.value)} className={inputCls} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Ort"><input value={f.signedLocation} onChange={(e) => set("signedLocation", e.target.value)} className={inputCls} placeholder="z.B. Zürich" /></Field>
                <Field label="Blockchain"><input value={f.blockchain} onChange={(e) => set("blockchain", e.target.value)} className={inputCls} /></Field>
                <Field label="Token-Standard"><input value={f.tokenStandard} onChange={(e) => set("tokenStandard", e.target.value)} className={inputCls} /></Field>
              </div>
              <Field label="Wallet-Adresse"><input value={f.walletAddress} onChange={(e) => set("walletAddress", e.target.value)} className={inputCls} placeholder="0x…" /></Field>
            </div>

            {/* Allocation breakdown */}
            <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Zuteilungs-Aufschlüsselung (optional)</p>
                <button onClick={addAlloc} className="text-[11px] font-semibold text-[#2563eb] hover:underline">+ Position</button>
              </div>
              {allocations.length === 0 && <p className="text-[11px] text-slate-400">Z.B. Basiszuteilung + Bonus-Token. Wird dem Investor als Tabelle angezeigt.</p>}
              {allocations.map((a, i) => (
                <div key={i} className="space-y-1.5 pb-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-2">
                    <input value={a.label} onChange={(e) => setAlloc(i, "label", e.target.value)} className={inputCls + " flex-1"} placeholder="Bezeichnung (z.B. Basiszuteilung)" />
                    <input type="number" value={a.tokens} onChange={(e) => setAlloc(i, "tokens", e.target.value)} className={inputCls + " w-32"} placeholder="Token" />
                    <button onClick={() => removeAlloc(i)} className="text-slate-300 hover:text-rose-500 px-1 shrink-0">✕</button>
                  </div>
                  <input value={a.note} onChange={(e) => setAlloc(i, "note", e.target.value)} className={inputCls + " text-[12px]"} placeholder="Notiz (z.B. EUR 50.000 ÷ EUR 0,12)" />
                </div>
              ))}
              {allocations.length > 0 && (
                <p className={`text-[11px] font-semibold ${tokenQtyN > 0 && Math.round(allocSum) !== Math.round(tokenQtyN) ? "text-amber-600" : "text-slate-400"}`}>
                  Summe Positionen: {allocSum.toLocaleString("de-DE")} Token{tokenQtyN > 0 && Math.round(allocSum) !== Math.round(tokenQtyN) ? ` · weicht von Anzahl Token (${tokenQtyN.toLocaleString("de-DE")}) ab` : ""}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Kapital (€) *"><input type="number" value={f.principal} onChange={(e) => set("principal", e.target.value)} className={inputCls} /></Field>
            <Field label="Akt. Wert (€)"><input type="number" value={f.currentValue} onChange={(e) => set("currentValue", e.target.value)} className={inputCls} placeholder="optional" /></Field>
            <Field label="Rendite % p.a."><input type="number" step="0.1" value={f.interestRate} onChange={(e) => set("interestRate", e.target.value)} className={inputCls} /></Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={isToken ? "Zuteilungsdatum" : "Start"}><input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} className={inputCls} /></Field>
          <Field label="Fälligkeit"><input type="date" value={f.maturityDate} onChange={(e) => set("maturityDate", e.target.value)} className={inputCls} /></Field>
        </div>
        {!isToken && <Field label="Auszahlung"><select value={f.payoutFrequency} onChange={(e) => set("payoutFrequency", e.target.value)} className={inputCls}><option value="yearly">Jährlich</option><option value="quarterly">Quartalsweise</option><option value="monthly">Monatlich</option><option value="on_maturity">Bei Fälligkeit</option></select></Field>}
        <Field label="Beschreibung"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={2} className={inputCls} /></Field>
        <button disabled={busy || !f.name || (isToken && (!f.tokenQty || !f.tokenBuyPrice || !f.tokenCurPrice))} onClick={submit} className="w-full py-3 bg-[#2563eb] text-white text-[13px] font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">{busy ? "Speichern…" : isEdit ? "Änderungen speichern" : "Hinzufügen"}</button>
      </div>
    </Modal>
  );
}

function TransactionModal({ onClose, onSubmit, busy, investments }: { onClose: () => void; onSubmit: (f: any) => void; busy: boolean; investments: Investment[] }) {
  const [f, setF] = useState({ transactionType: "interest", amount: "", description: "", transactionDate: new Date().toISOString().split("T")[0], status: "completed", investmentId: "" });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => onSubmit({ transactionType: f.transactionType, description: f.description, transactionDate: f.transactionDate, status: f.status, investmentId: f.investmentId || null, amountCents: Math.round(parseFloat(f.amount || "0") * 100) });
  return (
    <Modal title="Neue Buchung" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Art"><select value={f.transactionType} onChange={(e) => set("transactionType", e.target.value)} className={inputCls}>{TX_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Betrag (€) *"><input type="number" value={f.amount} onChange={(e) => set("amount", e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Investment (optional)"><select value={f.investmentId} onChange={(e) => set("investmentId", e.target.value)} className={inputCls}><option value="">— Allgemein —</option>{investments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Datum"><input type="date" value={f.transactionDate} onChange={(e) => set("transactionDate", e.target.value)} className={inputCls} /></Field>
          <Field label="Status"><select value={f.status} onChange={(e) => set("status", e.target.value)} className={inputCls}>{TX_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        </div>
        <Field label="Beschreibung"><input value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} placeholder="z.B. Quartalsausschüttung Q2" /></Field>
        <button disabled={busy} onClick={submit} className="w-full py-3 bg-[#2563eb] text-white text-[13px] font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">{busy ? "Speichern…" : "Buchung hinzufügen"}</button>
      </div>
    </Modal>
  );
}

function DocumentModal({ onClose, onSubmit, busy, investments }: { onClose: () => void; onSubmit: (fd: FormData) => void; busy: boolean; investments: Investment[] }) {
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState("contract");
  const [investmentId, setInvestmentId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = () => {
    if (!file || !title) return;
    const fd = new FormData();
    fd.append("title", title); fd.append("documentType", documentType);
    if (investmentId) fd.append("investmentId", investmentId);
    fd.append("file", file);
    onSubmit(fd);
  };
  return (
    <Modal title="Dokument hochladen" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Titel *"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="z.B. Beteiligungsvertrag 2026" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Typ"><select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className={inputCls}>{DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Investment"><select value={investmentId} onChange={(e) => setInvestmentId(e.target.value)} className={inputCls}><option value="">— Allgemein —</option>{investments.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
        </div>
        <Field label="Datei (PDF, max. 20 MB) *"><input type="file" accept=".pdf,application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-[13px] text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-[12px] file:font-semibold file:text-slate-700" /></Field>
        <button disabled={busy || !file || !title} onClick={submit} className="w-full py-3 bg-[#2563eb] text-white text-[13px] font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">{busy ? "Hochladen…" : "Hochladen"}</button>
      </div>
    </Modal>
  );
}
