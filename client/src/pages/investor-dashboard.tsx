import { useEffect, useState } from "react";
import {
  TIERS, BENEFITS, BENEFIT_MAP, CARD_PRICE_EUR, CARD_DESIGNS,
  CARD_STATUS_LABEL, CARD_STATUS_STEPS, type InvestorTier, type CardDesign,
} from "@/lib/investorProgram";

/* ──────────────────────────────────────────────────────────
   TYPES
   ────────────────────────────────────────────────────────── */
interface Investor {
  id: string; email: string; salutation?: string;
  first_name: string; last_name: string; phone?: string; company?: string;
  investor_type: string; tier?: InvestorTier; status: string; iban?: string;
  street?: string; zip?: string; city?: string; country?: string;
}
interface CardOrder {
  id: number; cardholder_name: string | null; card_design: CardDesign;
  status: string; price_cents: number; is_free: boolean;
  shipping_street?: string | null; shipping_zip?: string | null;
  shipping_city?: string | null; shipping_country?: string | null;
  created_at: string;
}
interface BenefitRow { benefit_key: string; status: string; note: string | null; }
interface Investment {
  id: number; name: string; investment_type: string;
  principal_cents: number; current_value_cents: number | null; currency: string;
  interest_rate: number | null; status: string;
  start_date: string | null; maturity_date: string | null;
  payout_frequency: string | null; description: string | null;
}
interface Transaction {
  id: number; investment_id: number | null; transaction_type: string;
  amount_cents: number; currency: string; description: string | null;
  transaction_date: string; status: string;
}
interface InvestorDoc {
  id: number; investment_id: number | null; title: string;
  document_type: string; file_name: string | null; file_size: number | null; created_at: string;
}
interface Summary {
  totalInvestedCents: number; currentValueCents: number; totalReturnsCents: number;
  unrealizedGainCents: number; avgYieldPct: number; activeCount: number; currency: string;
}

/* ── helpers ── */
const eur = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format((cents || 0) / 100);
const eur2 = (cents: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }).format((cents || 0) / 100);
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
};

const INVESTMENT_TYPE_LABEL: Record<string, string> = {
  equity: "Beteiligung", bond: "Anleihe", loan: "Darlehen", fund: "Fonds", real_estate: "Immobilie", other: "Sonstiges",
};
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktiv", cls: "bg-emerald-50 text-emerald-700" },
  matured: { label: "Fällig", cls: "bg-blue-50 text-blue-700" },
  pending: { label: "Ausstehend", cls: "bg-amber-50 text-amber-700" },
  cancelled: { label: "Beendet", cls: "bg-slate-100 text-slate-500" },
};
const TX_LABEL: Record<string, { label: string; sign: number; cls: string }> = {
  deposit: { label: "Einzahlung", sign: 1, cls: "text-slate-800" },
  interest: { label: "Zinsen / Rendite", sign: 1, cls: "text-emerald-600" },
  payout: { label: "Auszahlung", sign: 1, cls: "text-emerald-600" },
  fee: { label: "Gebühr", sign: -1, cls: "text-rose-600" },
  withdrawal: { label: "Entnahme", sign: -1, cls: "text-rose-600" },
};

/* ──────────────────────────────────────────────────────────
   TRANSACTION TIMELINE — full chronological history
   ────────────────────────────────────────────────────────── */
function TransactionTimeline({ transactions, emptyHint }: { transactions: Transaction[]; emptyHint?: string }) {
  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center text-[13px] text-slate-400">
        {emptyHint || "Sobald Buchungen verbucht werden, erscheinen sie hier in Ihrem Verlauf."}
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-slate-100" />
      <div className="space-y-1">
        {transactions.map((tx) => {
          const meta = TX_LABEL[tx.transaction_type] || TX_LABEL.interest;
          const pending = tx.status !== "completed";
          const positive = meta.sign >= 0;
          return (
            <div key={tx.id} className="relative flex items-start gap-4 pl-6 py-3 group">
              <span
                className={`absolute left-0 top-4 w-[15px] h-[15px] rounded-full border-2 border-white ${positive ? "bg-emerald-500" : "bg-rose-500"} ${pending ? "opacity-40" : ""}`}
                style={{ boxShadow: "0 0 0 3px #f8fafc" }}
              />
              <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-slate-900 truncate">{tx.description || meta.label}</p>
                  <p className="text-[11.5px] text-slate-400">
                    {meta.label} · {fmtDate(tx.transaction_date)}{pending ? " · geplant" : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-bold tabular-nums ${meta.cls}`}>
                    {meta.sign < 0 ? "−" : "+"}{eur2(tx.amount_cents)}
                  </p>
                  {pending && <span className="text-[10px] font-semibold text-amber-600">geplant</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────────────────── */
export default function InvestorDashboardPage() {
  const [investor, setInvestor] = useState<Investor | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [documents, setDocuments] = useState<InvestorDoc[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [cardData, setCardData] = useState<{ tier: InvestorTier; pricing: { priceCents: number; isFree: boolean }; order: CardOrder | null } | null>(null);
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"overview" | "investments" | "returns" | "card" | "benefits" | "documents">("overview");

  const reloadCard = async () => {
    try {
      const r = await fetch("/api/investor/card", { credentials: "include" });
      if (r.ok) setCardData(await r.json());
    } catch {}
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const meRes = await fetch("/api/investor/me", { credentials: "include" });
        if (!meRes.ok) { window.location.href = "/banking"; return; }
        const meData = await meRes.json();
        const [pfRes, cardRes, benRes] = await Promise.all([
          fetch("/api/investor/portfolio", { credentials: "include" }),
          fetch("/api/investor/card", { credentials: "include" }),
          fetch("/api/investor/benefits", { credentials: "include" }),
        ]);
        const pfData = await pfRes.json();
        const cardJson = cardRes.ok ? await cardRes.json() : null;
        const benJson = benRes.ok ? await benRes.json() : null;
        if (!active) return;
        setInvestor(meData.investor);
        setInvestments(pfData.investments || []);
        setTransactions(pfData.transactions || []);
        setDocuments(pfData.documents || []);
        setSummary(pfData.summary || null);
        setCardData(cardJson);
        setBenefits(benJson?.benefits || []);
      } catch {
        if (active) window.location.href = "/banking";
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const logout = async () => {
    await fetch("/api/investor/logout", { method: "POST", credentials: "include" }).catch(() => {});
    window.location.href = "/banking";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-[#2563eb] rounded-full animate-spin" />
      </div>
    );
  }

  const gainPositive = (summary?.unrealizedGainCents ?? 0) >= 0;
  const tier: InvestorTier = (investor?.tier as InvestorTier) || "standard";
  const tierDef = TIERS[tier];
  const activeBenefits = benefits.filter((b) => BENEFIT_MAP[b.benefit_key]);
  const TABS = [
    { id: "overview" as const, label: "Übersicht" },
    { id: "investments" as const, label: "Investments" },
    { id: "returns" as const, label: "Renditen" },
    { id: "card" as const, label: "Karte" },
    { id: "benefits" as const, label: "Leistungen" },
    { id: "documents" as const, label: "Verträge" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ TOP NAV ═══ */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
              <span className="text-white text-[13px] font-bold">S</span>
            </div>
            <div className="leading-tight">
              <p className="text-[14px] font-semibold text-slate-900 tracking-tight">Schwarzott Group</p>
              <p className="text-[10px] text-[#2563eb] font-bold uppercase tracking-[.2em]">Banking</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-[13px] font-semibold text-slate-800">{investor?.salutation ? investor.salutation + " " : ""}{investor?.first_name} {investor?.last_name}</p>
              <p className="text-[11px] text-slate-400">{investor?.email}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-[13px] font-bold">
              {(investor?.first_name?.[0] || "I").toUpperCase()}
            </div>
            <button onClick={logout} className="text-[12px] font-semibold text-slate-500 hover:text-rose-600 transition-colors px-3 py-2 rounded-lg hover:bg-slate-100">Abmelden</button>
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-5 sm:px-8 py-8 space-y-8">
        {/* ═══ PORTFOLIO HERO ═══ */}
        <section className="rounded-3xl p-7 sm:p-9 relative overflow-hidden" style={{ background: "linear-gradient(135deg,#0d1b3e 0%,#1e3a8a 60%,#2563eb 100%)", boxShadow: "0 30px 60px -25px rgba(37,99,235,.5)" }}>
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff,transparent 1px,transparent 60px,#fff 61px)" }} />
          <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full opacity-30" style={{ background: "radial-gradient(circle,#60a5fa,transparent 70%)", filter: "blur(30px)" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-2">
              <p className="text-[12px] text-blue-200/80 font-semibold uppercase tracking-[.18em]">Aktueller Portfolio-Wert</p>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[.12em] text-white shrink-0" style={{ background: tierDef.gradient, boxShadow: "0 6px 18px -6px rgba(0,0,0,.5)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                {tierDef.label}
              </span>
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight tabular-nums">{eur(summary?.currentValueCents ?? 0)}</h1>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-1.5 text-[12px] font-semibold ${gainPositive ? "bg-emerald-400/20 text-emerald-200" : "bg-rose-400/20 text-rose-200"}`}>
                {gainPositive ? "+" : "−"}{eur(Math.abs(summary?.unrealizedGainCents ?? 0))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-7">
              {[
                { label: "Investiertes Kapital", value: eur(summary?.totalInvestedCents ?? 0) },
                { label: "Gesamtrendite", value: eur(summary?.totalReturnsCents ?? 0) },
                { label: "Ø Rendite p.a.", value: `${(summary?.avgYieldPct ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %` },
                { label: "Aktive Investments", value: String(summary?.activeCount ?? 0) },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-[11px] text-blue-200/70 font-medium uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-[18px] sm:text-[20px] font-bold text-white tabular-nums">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TABS ═══ */}
        <div className="flex items-center gap-1.5 bg-white rounded-2xl p-1.5 border border-slate-100 shadow-sm w-fit">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${tab === t.id ? "bg-[#2563eb] text-white shadow-[0_4px_14px_rgba(37,99,235,.3)]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div className="grid lg:grid-cols-[1.45fr_1fr] gap-6 items-start">
            {/* Transaktionsverlauf */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Kontobewegungen</p>
                  <h3 className="text-[15px] font-bold text-slate-900">Transaktionsverlauf</h3>
                </div>
                <span className="text-[12px] font-semibold text-slate-500">{transactions.length} {transactions.length === 1 ? "Buchung" : "Buchungen"}</span>
              </div>
              <div className="max-h-[520px] overflow-auto -mx-1 px-1">
                <TransactionTimeline transactions={transactions} />
              </div>
            </div>

            {/* Investments summary */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <h3 className="text-[15px] font-bold text-slate-900 mb-4">Ihre Investments</h3>
              {investments.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-8 text-center">Noch keine Investments hinterlegt.</p>
              ) : (
                <div className="space-y-2">
                  {investments.slice(0, 5).map((inv) => {
                    const cur = inv.current_value_cents == null ? inv.principal_cents : inv.current_value_cents;
                    const st = STATUS_LABEL[inv.status] || STATUS_LABEL.active;
                    return (
                      <div key={inv.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{inv.name}</p>
                          <p className="text-[11px] text-slate-400">{INVESTMENT_TYPE_LABEL[inv.investment_type] || inv.investment_type} · {inv.interest_rate ?? 0}% p.a.</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[13px] font-bold text-slate-900 tabular-nums">{eur(cur)}</p>
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        </div>
                      </div>
                    );
                  })}
                  {investments.length > 5 && (
                    <button onClick={() => setTab("investments")} className="mt-2 text-[12px] font-semibold text-[#2563eb] hover:underline">Alle {investments.length} anzeigen</button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ INVESTMENTS ═══ */}
        {tab === "investments" && (
          <div className="space-y-4">
            {investments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm py-16 text-center text-[14px] text-slate-400">Noch keine Investments hinterlegt.</div>
            ) : investments.map((inv) => {
              const cur = inv.current_value_cents == null ? inv.principal_cents : inv.current_value_cents;
              const gain = cur - inv.principal_cents;
              const st = STATUS_LABEL[inv.status] || STATUS_LABEL.active;
              return (
                <div key={inv.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-3">
                      <div className="w-1 self-stretch rounded-full min-h-[44px]" style={{ background: "linear-gradient(180deg,#2563eb,#1d4ed8)" }} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-[16px] font-bold text-slate-900">{inv.name}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                        </div>
                        <p className="text-[12px] text-slate-400 mt-0.5">{INVESTMENT_TYPE_LABEL[inv.investment_type] || inv.investment_type}{inv.description ? ` · ${inv.description}` : ""}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[22px] font-bold text-slate-900 tabular-nums">{eur(cur)}</p>
                      <p className={`text-[12px] font-semibold ${gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{gain >= 0 ? "+" : "−"}{eur(Math.abs(gain))} Wertzuwachs</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-50">
                    {[
                      { l: "Eingesetzt", v: eur(inv.principal_cents) },
                      { l: "Rendite p.a.", v: `${inv.interest_rate ?? 0} %` },
                      { l: "Laufzeit ab", v: fmtDate(inv.start_date) },
                      { l: "Fälligkeit", v: fmtDate(inv.maturity_date) },
                    ].map((x) => (
                      <div key={x.l}>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">{x.l}</p>
                        <p className="text-[14px] font-semibold text-slate-800 tabular-nums">{x.v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══ RETURNS ═══ */}
        {tab === "returns" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-slate-900">Rendite- & Buchungshistorie</h3>
              <span className="text-[12px] font-semibold text-emerald-600">{eur(summary?.totalReturnsCents ?? 0)} Rendite gesamt</span>
            </div>
            <div className="px-6 py-2">
              <TransactionTimeline transactions={transactions} emptyHint="Noch keine Buchungen vorhanden." />
            </div>
          </div>
        )}

        {/* ═══ KARTE ═══ */}
        {tab === "card" && (
          <CardTab investor={investor} tier={tier} cardData={cardData} onOrdered={reloadCard} />
        )}

        {/* ═══ LEISTUNGEN ═══ */}
        {tab === "benefits" && (
          <BenefitsTab tier={tier} activeBenefits={activeBenefits} onGoToCard={() => setTab("card")} />
        )}

        {/* ═══ DOCUMENTS ═══ */}
        {tab === "documents" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-[15px] font-bold text-slate-900">Verträge & Dokumente</h3>
              <p className="text-[12px] text-slate-400 mt-0.5">Ihre Verträge, Abrechnungen und Steuerunterlagen zum Download.</p>
            </div>
            {documents.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-slate-400">Noch keine Dokumente hinterlegt.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {documents.map((doc) => (
                  <a key={doc.id} href={`/api/investor/documents/${doc.id}/download`} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><span className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{({ contract: "VTR", statement: "ABR", tax: "STR", report: "RPT" } as Record<string, string>)[doc.document_type] || "DOK"}</span></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-900 truncate">{doc.title}</p>
                      <p className="text-[11px] text-slate-400">{doc.file_name || "Dokument"} · {fmtDate(doc.created_at)}</p>
                    </div>
                    <span className="text-[12px] font-semibold text-[#2563eb] opacity-0 group-hover:opacity-100 transition-opacity">Herunterladen ↓</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-slate-400 pt-4">
          Schwarzott Group Banking · Geschützter Investoren-Bereich · Alle Angaben ohne Gewähr.
        </p>
      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   CARD VISUAL
   ────────────────────────────────────────────────────────── */
function CardVisual({ design, holder, tierLabelText }: { design: CardDesign; holder: string; tierLabelText: string }) {
  const d = CARD_DESIGNS[design] || CARD_DESIGNS.classic;
  return (
    <div className="relative w-full max-w-[400px] aspect-[1.586/1] rounded-2xl overflow-hidden select-none"
      style={{ background: d.face, boxShadow: "0 30px 60px -20px rgba(0,0,0,.55)", color: d.ink }}>
      <div className="absolute inset-0" style={{ background: d.sheen }} />
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${d.ink}, transparent 70%)`, filter: "blur(20px)" }} />
      <div className="relative z-10 h-full p-6 flex flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[15px] font-bold tracking-[.18em]">SCHWARZOTT</p>
            <p className="text-[9px] font-semibold tracking-[.4em] opacity-70">GROUP · BANKING</p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[.2em] opacity-80">{tierLabelText}</span>
        </div>
        {/* chip */}
        <div className="w-11 h-8 rounded-md" style={{ background: "linear-gradient(135deg,rgba(255,255,255,.35),rgba(255,255,255,.05))", border: "1px solid rgba(255,255,255,.25)" }} />
        <div>
          <p className="text-[15px] tracking-[.25em] tabular-nums opacity-90">••••　••••　••••</p>
          <div className="flex items-end justify-between mt-2">
            <p className="text-[12px] font-semibold tracking-[.12em] uppercase truncate max-w-[70%]">{holder || "INVESTOR"}</p>
            <p className="text-[9px] font-semibold tracking-[.2em] opacity-70">MEMBER</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   CARD TAB
   ────────────────────────────────────────────────────────── */
function CardTab({ investor, tier, cardData, onOrdered }: {
  investor: Investor | null; tier: InvestorTier;
  cardData: { tier: InvestorTier; pricing: { priceCents: number; isFree: boolean }; order: CardOrder | null } | null;
  onOrdered: () => void;
}) {
  const isFree = cardData?.pricing?.isFree ?? (tier === "circle");
  const design: CardDesign = tier === "circle" ? "circle" : tier === "premium" ? "gold" : "classic";
  const holderDefault = investor ? `${investor.first_name} ${investor.last_name}`.trim() : "";
  const order = cardData?.order || null;

  const [form, setForm] = useState({
    cardholderName: holderDefault,
    shippingStreet: investor?.street || "",
    shippingZip: investor?.zip || "",
    shippingCity: investor?.city || "",
    shippingCountry: investor?.country || "Deutschland",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/investor/card", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, cardDesign: design }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error || "Bestellung fehlgeschlagen"); return; }
      onOrdered();
    } catch { setError("Verbindungsfehler."); }
    finally { setBusy(false); }
  };

  const activeStepIndex = order ? CARD_STATUS_STEPS.findIndex((s) => s.key === order.status) : -1;

  return (
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      {/* Left — visual + summary */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8 flex flex-col items-center">
        <CardVisual design={design} holder={order?.cardholder_name || holderDefault} tierLabelText={TIERS[tier].label} />
        <div className="mt-6 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ausgabegebühr</p>
          {isFree ? (
            <p className="text-[24px] font-bold text-emerald-600">Kostenlos</p>
          ) : (
            <p className="text-[24px] font-bold text-slate-900">{CARD_PRICE_EUR.toLocaleString("de-DE")} €</p>
          )}
          <p className="text-[12px] text-slate-400 mt-1">
            {isFree
              ? "Als Circle Investor ist Ihre Karte ohne Ausgabegebühr inklusive."
              : "Einmalige Ausgabegebühr. Für Circle Investoren entfällt diese Gebühr."}
          </p>
        </div>
      </div>

      {/* Right — order or status */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sm:p-8">
        {order ? (
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Status Ihrer Karte</p>
            <h3 className="text-[18px] font-bold text-slate-900 mb-6">{CARD_STATUS_LABEL[order.status] || order.status}</h3>

            {order.status !== "cancelled" ? (
              <div className="space-y-0">
                {CARD_STATUS_STEPS.map((s, i) => {
                  const done = i <= activeStepIndex;
                  const current = i === activeStepIndex;
                  return (
                    <div key={s.key} className="flex items-center gap-3 py-2">
                      <div className="flex flex-col items-center">
                        <span className={`w-3.5 h-3.5 rounded-full ${done ? "bg-[#2563eb]" : "bg-slate-200"} ${current ? "ring-4 ring-blue-100" : ""}`} />
                        {i < CARD_STATUS_STEPS.length - 1 && <span className={`w-px h-6 ${i < activeStepIndex ? "bg-[#2563eb]" : "bg-slate-200"}`} />}
                      </div>
                      <span className={`text-[13px] ${done ? "font-semibold text-slate-900" : "text-slate-400"}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-slate-500">Diese Bestellung wurde storniert. Bitte kontaktieren Sie Ihren Betreuer für eine Neubestellung.</p>
            )}

            <div className="mt-6 pt-5 border-t border-slate-50 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-400">Karteninhaber</span><span className="font-semibold text-slate-800">{order.cardholder_name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Design</span><span className="font-semibold text-slate-800">{CARD_DESIGNS[order.card_design]?.label || order.card_design}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Gebühr</span><span className="font-semibold text-slate-800">{order.is_free ? "Kostenlos" : `${(order.price_cents / 100).toLocaleString("de-DE")} €`}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Bestellt am</span><span className="font-semibold text-slate-800">{fmtDate(order.created_at)}</span></div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Ihre persönliche Karte</p>
            <h3 className="text-[18px] font-bold text-slate-900 mb-1">Schwarzott Card bestellen</h3>
            <p className="text-[13px] text-slate-400 mb-6">Ihre Metallkarte – exklusiv für Investoren der Schwarzott Group.</p>

            <div className="space-y-4">
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Name auf der Karte</span>
                <input value={form.cardholderName} onChange={(e) => set("cardholderName", e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Straße & Hausnummer</span>
                <input value={form.shippingStreet} onChange={(e) => set("shippingStreet", e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">PLZ</span>
                  <input value={form.shippingZip} onChange={(e) => set("shippingZip", e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
                </label>
                <label className="block col-span-2">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ort</span>
                  <input value={form.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300" />
                </label>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[13px] font-semibold text-slate-700">Ausgabegebühr</span>
                <span className={`text-[15px] font-bold ${isFree ? "text-emerald-600" : "text-slate-900"}`}>{isFree ? "Kostenlos" : `${CARD_PRICE_EUR.toLocaleString("de-DE")} €`}</span>
              </div>

              {error && <p className="text-[12px] text-rose-600 font-medium">{error}</p>}

              <button onClick={submit} disabled={busy || !form.cardholderName} className="w-full py-3.5 rounded-xl text-[14px] font-bold text-white transition-all disabled:opacity-50" style={{ background: TIERS[tier].gradient }}>
                {busy ? "Wird bestellt…" : isFree ? "Karte kostenlos anfordern" : `Kostenpflichtig bestellen · ${CARD_PRICE_EUR.toLocaleString("de-DE")} €`}
              </button>
              <p className="text-[11px] text-slate-400 text-center">Die Bestellung wird durch unser Team geprüft und freigegeben.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   BENEFITS / LEISTUNGEN TAB
   ────────────────────────────────────────────────────────── */
function BenefitsTab({ tier, activeBenefits, onGoToCard }: {
  tier: InvestorTier; activeBenefits: BenefitRow[]; onGoToCard: () => void;
}) {
  const activeKeys = new Set(activeBenefits.map((b) => b.benefit_key));
  const noteByKey: Record<string, string | null> = Object.fromEntries(activeBenefits.map((b) => [b.benefit_key, b.note]));
  const tierDef = TIERS[tier];

  return (
    <div className="space-y-6">
      {/* tier band */}
      <section className="rounded-2xl p-6 sm:p-8 relative overflow-hidden text-white" style={{ background: tierDef.gradient, boxShadow: "0 24px 50px -22px rgba(0,0,0,.5)" }}>
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-25" style={{ background: "radial-gradient(circle,#fff,transparent 70%)", filter: "blur(30px)" }} />
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] opacity-80">Ihre Mitgliedschaft</p>
          <h2 className="text-[26px] font-bold mt-1">{tierDef.label}</h2>
          <p className="text-[13px] opacity-90 mt-1 max-w-md">{tierDef.tagline}</p>
          <p className="text-[12px] opacity-80 mt-3">{activeKeys.size} {activeKeys.size === 1 ? "Leistung" : "Leistungen"} freigeschaltet</p>
        </div>
      </section>

      {/* benefits grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {BENEFITS.map((b) => {
          const active = activeKeys.has(b.key);
          const note = noteByKey[b.key];
          return (
            <div key={b.key}
              className={`rounded-2xl border p-5 transition-all ${active ? "bg-white border-slate-100 shadow-sm" : "bg-slate-50/60 border-slate-100"}`}>
              <div className="flex items-start justify-between gap-3">
                <h3 className={`text-[15px] font-bold ${active ? "text-slate-900" : "text-slate-400"}`}>{b.title}</h3>
                {active ? (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Aktiv</span>
                ) : (
                  <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-400">Gesperrt</span>
                )}
              </div>
              <p className={`text-[13px] mt-1.5 leading-relaxed ${active ? "text-slate-500" : "text-slate-400"}`}>{b.description}</p>
              {active && note && <p className="text-[12px] mt-2 text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{note}</p>}
              {active && b.key === "card" && (
                <button onClick={onGoToCard} className="mt-3 text-[12px] font-semibold text-[#2563eb] hover:underline">Karte verwalten</button>
              )}
            </div>
          );
        })}
      </div>

      {tier !== "circle" && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
          <p className="text-[14px] font-semibold text-slate-700">Mehr erleben als <span style={{ color: TIERS.circle.accent }}>Circle Investor</span></p>
          <p className="text-[12px] text-slate-400 mt-1 max-w-lg mx-auto">Circle Investoren erhalten Zugang zu sämtlichen Leistungen – von Private Aviation über unsere Rechtsabteilung bis zum 24/7 Concierge. Sprechen Sie Ihren Betreuer an.</p>
        </div>
      )}
    </div>
  );
}
