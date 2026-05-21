import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================
type EntryType = "expense_recurring" | "expense_onetime" | "income" | "withdrawal" | "investment" | "client_payment";
type EntryStatus = "planned" | "paid" | "cancelled" | "overdue";
type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

interface AccountingEntry {
  id: number;
  entry_type: EntryType;
  category: string;
  title: string;
  description?: string;
  amount_cents: number;
  currency: string;
  entry_date: string;
  is_recurring: boolean;
  frequency?: Frequency;
  status: EntryStatus;
  payment_method?: string;
  payment_reference?: string;
  vendor?: string;
  invoice_number?: string;
  created_at: string;
  updated_at: string;
}

interface Summary {
  balance: { cents: number; currency: string; note?: string; updatedAt?: string };
  kpis: { monthlyOutCents: number; monthlyInCents: number; monthlyBurnCents: number; runwayMonths: number; netCents: number };
  categoryBreakdown: { category: string; totalCents: number; count: number }[];
  cashflow: { month: string; outCents: number; inCents: number }[];
  upcoming: AccountingEntry[];
}

interface Prediction {
  hasData: boolean;
  message?: string;
  smartMessage?: string;
  trendLabel?: string;
  trendEmoji?: string;
  growthPct?: number;
  projectedBalance30d?: number;
  projectedIncome30d?: number;
  monthlyBurnCents?: number;
  last30IncomeCents?: number;
  avgDailyIncomeCents?: number;
}

// ============================================================================
// Constants
// ============================================================================
const TYPE_META: Record<EntryType, { label: string; sign: "+" | "-"; color: string }> = {
  expense_recurring: { label: "Laufende Kosten",  sign: "-", color: "#dc2626" },
  expense_onetime:   { label: "Einmalige Ausgabe", sign: "-", color: "#ea580c" },
  income:            { label: "Einnahme",          sign: "+", color: "#16a34a" },
  client_payment:    { label: "Kundenzahlung",     sign: "+", color: "#059669" },
  withdrawal:        { label: "Auszahlung",        sign: "-", color: "#7c3aed" },
  investment:        { label: "Investition",       sign: "-", color: "#2563eb" },
};

const CAT: Record<string, string> = {
  software: "Software", salary: "Gehalt", marketing: "Marketing", office: "Büro",
  legal: "Legal / Steuer", infrastructure: "Infrastruktur", hosting: "Hosting",
  tax: "Steuern", insurance: "Versicherung", consulting: "Beratung",
  misc: "Sonstiges", revenue: "Umsatz", client_payment: "Kundenzahlung",
  investment: "Investition", other: "Andere",
};

const PAY_METHODS = [
  { value: "bank_transfer", label: "Banküberweisung" },
  { value: "direct_debit",  label: "Lastschrift" },
  { value: "credit_card",   label: "Kreditkarte" },
  { value: "paypal",        label: "PayPal" },
  { value: "stripe",        label: "Stripe" },
  { value: "cash",          label: "Bar" },
];

// ============================================================================
// Helpers
// ============================================================================
const eur = (cents: number, sign = false, compact = false): string => {
  const n = Math.abs(cents) / 100;
  const s = compact && n >= 1000
    ? n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} Mio.` : `${(n / 1000).toFixed(1)}k`
    : n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (sign && cents > 0) return `+${s} €`;
  return `${s} €`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

const fmtMonth = (ym: string): string => {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
};

const isOut = (t: EntryType) =>
  ["expense_recurring", "expense_onetime", "withdrawal", "investment"].includes(t);

// Backward-compat aliases used by legacy component body
const fmt = eur;
const isOutflow = isOut;
const ACCENT = "#1e293b";
const ENTRY_TYPE_META = TYPE_META as Record<EntryType, { label: string; sign: "+" | "-"; color: string; bgColor: string; icon: string }>;
const CATEGORY_META: Record<string, { label: string; icon: string }> =
  Object.fromEntries(Object.entries(CAT).map(([k, v]) => [k, { label: v as string, icon: "" }]));
const STATUS_META: Record<EntryStatus, { label: string; cls: string; dot: string }> = {
  planned:   { label: "Geplant",    cls: "bg-amber-50 text-amber-700",    dot: "bg-amber-400" },
  paid:      { label: "Bezahlt",    cls: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Storniert",  cls: "bg-slate-100 text-slate-500",   dot: "bg-slate-400" },
  overdue:   { label: "Überfällig", cls: "bg-red-50 text-red-700",        dot: "bg-red-400" },
};
const PAYMENT_METHODS = PAY_METHODS;

// ============================================================================
// Entry Modal — clean minimal form
// ============================================================================
const TYPE_OPTS: { value: EntryType; label: string; sign: string }[] = [
  { value: "income",           label: "Einnahme",      sign: "+" },
  { value: "client_payment",   label: "Kundenzahlung", sign: "+" },
  { value: "expense_recurring",label: "Laufende Kosten",sign: "−" },
  { value: "expense_onetime",  label: "Einmalige Ausgabe",sign: "−" },
  { value: "withdrawal",       label: "Auszahlung",    sign: "−" },
  { value: "investment",       label: "Investition",   sign: "−" },
];

function EntryModal({
  entry, onSave, onClose,
}: {
  entry: Partial<AccountingEntry> | null;
  onSave: (data: Partial<AccountingEntry>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!entry?.id;
  const [form, setForm] = useState<Partial<AccountingEntry>>({
    entry_type: "income",
    category: "revenue",
    title: "",
    amount_cents: 0,
    currency: "EUR",
    entry_date: new Date().toISOString().split("T")[0],
    is_recurring: false,
    status: "paid",
    vendor: "",
    description: "",
    ...entry,
  });
  const [saving, setSaving] = useState(false);
  const [amtStr, setAmtStr] = useState<string>(
    entry?.amount_cents ? String(entry.amount_cents / 100) : ""
  );

  const set = (k: keyof AccountingEntry, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amtStr || parseFloat(amtStr) <= 0) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        amount_cents: Math.round(parseFloat(amtStr.replace(",", ".")) * 100),
      });
    } finally { setSaving(false); }
  };

  const selectedType = TYPE_OPTS.find(t => t.value === form.entry_type);
  const isIncome = ["income", "client_payment"].includes(form.entry_type ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-md sm:mx-4 sm:rounded-2xl rounded-t-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {isEdit ? "Bearbeiten" : "Neue Transaktion"}
            </p>
            <p className="text-[15px] font-bold text-slate-900 mt-0.5">
              {isEdit ? form.title || "Eintrag" : "Transaktion hinzufügen"}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Type selector — 2 columns, clean chips */}
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTS.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  set("entry_type", t.value);
                  set("category", ["income","client_payment"].includes(t.value) ? "revenue" : "software");
                }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-semibold border transition-all text-left ${
                  form.entry_type === t.value
                    ? isIncome
                      ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                      : "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white"
                }`}
              >
                <span className={`text-[13px] font-bold ${form.entry_type === t.value ? "" : "opacity-50"}`}>
                  {t.sign}
                </span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Amount — prominent */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Betrag (EUR) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-bold text-slate-300">€</span>
              <input
                required
                type="number"
                step="0.01"
                min="0.01"
                value={amtStr}
                onChange={e => setAmtStr(e.target.value)}
                placeholder="0.00"
                autoFocus={!isEdit}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[20px] font-bold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Bezeichnung *
            </label>
            <input
              required
              value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder={isIncome ? "z.B. Kundenzahlung Mai" : "z.B. OpenAI API"}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[14px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-400 transition-all"
            />
          </div>

          {/* Date + Status side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Datum</label>
              <input
                type="date"
                value={form.entry_date?.split("T")[0] ?? ""}
                onChange={e => set("entry_date", e.target.value)}
                className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Status</label>
              <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                {[
                  { v: "paid",    l: "Bezahlt" },
                  { v: "planned", l: "Geplant" },
                ].map(s => (
                  <button key={s.v} type="button" onClick={() => set("status", s.v)}
                    className={`flex-1 py-3 text-[12px] font-semibold transition-colors ${
                      form.status === s.v ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                    }`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Vendor optional */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Anbieter <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              value={form.vendor ?? ""}
              onChange={e => set("vendor", e.target.value)}
              placeholder="z.B. Render, Stripe, …"
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-[13px] text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/20 transition-all"
            />
          </div>

          {/* Save button */}
          <button
            type="submit"
            disabled={saving || !amtStr || parseFloat(amtStr) <= 0}
            className="w-full py-3.5 rounded-xl bg-slate-900 text-white text-[14px] font-bold hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mt-1"
          >
            {saving ? "Wird gespeichert…" : isEdit ? "Aktualisieren" : `${selectedType?.sign} ${amtStr ? `${amtStr} €` : "Speichern"}`}
          </button>

          {/* Cancel link */}
          <button type="button" onClick={onClose}
            className="w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors pb-1">
            Abbrechen
          </button>
        </form>
      </div>
    </div>
  );
}


// ============================================================================
// Balance Update Modal
// ============================================================================
function BalanceModal({ current, onSave, onClose }: { current: number; onSave: (cents: number, note: string) => Promise<void>; onClose: () => void }) {
  const [val, setVal] = useState(String(current / 100));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(Math.round(parseFloat(val.replace(",", ".")) * 100), note);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1d4ed8] to-[#2563eb] p-6 text-white">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">Kontostand aktualisieren</p>
          <h3 className="text-xl font-bold">Aktueller Saldo</h3>
          <p className="text-3xl font-bold mt-2 tabular-nums">{fmt(current)}</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Neuer Kontostand (EUR) *</label>
            <input
              required
              type="number"
              step="0.01"
              value={val}
              onChange={e => setVal(e.target.value)}
              className="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Notiz (optional)</label>
            <input
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="z.B. Stand nach Überweisung"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="flex gap-2.5">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              Abbrechen
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-[#2563eb] text-white text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Mini Bar Chart
// ============================================================================
function CashflowChart({ data }: { data: { month: string; outCents: number; inCents: number }[] }) {
  const max = Math.max(...data.flatMap(d => [d.outCents, d.inCents]), 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {data.map(d => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end gap-0.5 h-16">
            <div
              className="flex-1 rounded-t-sm bg-red-400/70 transition-all duration-500"
              style={{ height: `${(d.outCents / max) * 100}%`, minHeight: d.outCents > 0 ? "2px" : "0" }}
              title={`Ausgaben: ${fmt(d.outCents)}`}
            />
            <div
              className="flex-1 rounded-t-sm bg-emerald-400/70 transition-all duration-500"
              style={{ height: `${(d.inCents / max) * 100}%`, minHeight: d.inCents > 0 ? "2px" : "0" }}
              title={`Einnahmen: ${fmt(d.inCents)}`}
            />
          </div>
          <span className="text-[9px] font-semibold text-slate-400 text-center">{fmtMonth(d.month)}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Optimization Tips
// ============================================================================
function OptimizationTips({ summary }: { summary: Summary | null }) {
  if (!summary) return null;
  const tips: { icon: string; text: string; severity: "warn" | "info" | "ok" }[] = [];

  const burn = summary.kpis.monthlyBurnCents;
  const balance = summary.balance.cents;
  const runway = summary.kpis.runwayMonths;

  if (runway < 6) tips.push({ icon: "🚨", text: `Runway nur ${runway} Monate – Kostenreduktion empfohlen.`, severity: "warn" });
  else if (runway < 12) tips.push({ icon: "⚠️", text: `Runway ${runway} Monate – Puffer aufbauen.`, severity: "warn" });
  else tips.push({ icon: "✅", text: `Guter Runway: ${runway} Monate.`, severity: "ok" });

  const recurring = summary.categoryBreakdown.filter(c => c.totalCents > 0);
  const softwareCosts = recurring.find(c => c.category === "software")?.totalCents ?? 0;
  if (softwareCosts > burn * 0.4) {
    tips.push({ icon: "💡", text: `Software-Kosten (${fmt(softwareCosts)}) sind über 40% der Ausgaben – Lizenzen prüfen.`, severity: "warn" });
  }

  if (summary.kpis.netCents < 0) {
    tips.push({ icon: "📉", text: `Negativer Cashflow diesen Monat: ${fmt(summary.kpis.netCents, true)}`, severity: "warn" });
  }

  if (summary.upcoming.length > 0) {
    tips.push({ icon: "📅", text: `${summary.upcoming.length} Zahlung(en) fällig in den nächsten 30 Tagen.`, severity: "info" });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">AI Optimierungshinweise</p>
      <div className="space-y-2.5">
        {tips.map((t, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-xl text-sm ${
              t.severity === "warn" ? "bg-amber-50 text-amber-800" :
              t.severity === "ok" ? "bg-emerald-50 text-emerald-800" :
              "bg-blue-50 text-blue-800"
            }`}
          >
            <span className="text-base shrink-0 mt-0.5">{t.icon}</span>
            <span className="font-medium">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Prediction Card
// ============================================================================
function PredictionCard({ pred }: { pred: Prediction | null }) {
  if (!pred) return <div className="h-28 rounded-xl bg-slate-50 animate-pulse border border-slate-100" />;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-slate-900 px-5 py-3 flex items-center justify-between">
        <p className="text-[10px] tracking-widest uppercase text-white/50 font-semibold">KI-Prognose · 30 Tage</p>
        {pred.hasData && <span className="text-[11px] text-white/70 font-semibold">{pred.trendEmoji} {pred.trendLabel}</span>}
      </div>
      <div className="bg-white px-5 py-4">
        {!pred.hasData ? (
          <p className="text-sm text-slate-500">{pred.message}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] text-slate-700 leading-relaxed">{pred.smartMessage}</p>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-100">
              {[
                { label: "Einnahmen letzte 30T", val: eur(pred.last30IncomeCents ?? 0), col: "#16a34a" },
                { label: "Prognose Einnahmen",   val: eur(pred.projectedIncome30d ?? 0),  col: "#1e293b" },
                { label: "Kontostand in 30T",    val: eur(pred.projectedBalance30d ?? 0), col: (pred.projectedBalance30d ?? 0) >= 0 ? "#1e293b" : "#dc2626" },
              ].map(k => (
                <div key={k.label}>
                  <p className="text-[9px] tracking-widest uppercase text-slate-400 font-semibold">{k.label}</p>
                  <p className="text-[14px] font-bold tabular-nums mt-0.5" style={{ color: k.col }}>{k.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Cashflow Bar Chart
// ============================================================================
function CashflowBars({ data }: { data: { month: string; outCents: number; inCents: number }[] }) {
  const max = Math.max(...data.flatMap(d => [d.outCents, d.inCents]), 1);
  return (
    <div className="flex items-end gap-3 h-28">
      {data.map(d => {
        const net = d.inCents - d.outCents;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center gap-0.5 h-20">
              <div className="flex-1 rounded-t" style={{ height: `${(d.outCents / max) * 100}%`, minHeight: d.outCents > 0 ? 2 : 0, backgroundColor: "#fca5a5" }} title={`Ausgaben: ${eur(d.outCents)}`} />
              <div className="flex-1 rounded-t" style={{ height: `${(d.inCents / max) * 100}%`, minHeight: d.inCents > 0 ? 2 : 0, backgroundColor: "#86efac" }} title={`Einnahmen: ${eur(d.inCents)}`} />
            </div>
            <div className="text-center">
              <p className="text-[9px] font-semibold text-slate-400 uppercase">{fmtMonth(d.month)}</p>
              <p className={`text-[9px] font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>{eur(net, true, true)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export default function AccountingDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);

  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editEntry, setEditEntry] = useState<AccountingEntry | null>(null);
  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const [tab, setTab] = useState<"overview" | "entries" | "breakdown" | "cashflow">("overview");

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounting/summary", { credentials: "include" });
      if (res.ok) setSummary(await res.json());
    } finally { setLoading(false); }
  }, []);

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams({ limit: "300" });
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/accounting/entries?${params}`, { credentials: "include" });
      if (res.ok) setEntries((await res.json()).entries ?? []);
    } catch {} finally { setLoadingEntries(false); }
  }, [typeFilter, statusFilter]);

  const loadPrediction = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/accounting/prediction", { credentials: "include" });
      if (res.ok) setPrediction(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadSummary(); loadPrediction(); }, [loadSummary, loadPrediction]);
  useEffect(() => { loadEntries(); }, [loadEntries]);

  const refresh = () => Promise.all([loadSummary(), loadEntries(), loadPrediction()]);

  // ── Save entry ──────────────────────────────────────────────────────────────
  const handleSaveEntry = async (data: Partial<AccountingEntry>) => {
    const isEdit = !!data.id;
    await fetch(
      isEdit ? `/api/admin/accounting/entries/${data.id}` : "/api/admin/accounting/entries",
      { method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) }
    );
    setShowEntryModal(false); setEditEntry(null);
    await refresh();
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!confirm("Eintrag löschen?")) return;
    await fetch(`/api/admin/accounting/entries/${id}`, { method: "DELETE", credentials: "include" });
    await refresh();
  };

  // ── Update balance ──────────────────────────────────────────────────────────
  const handleUpdateBalance = async (cents: number, note: string) => {
    await fetch("/api/admin/accounting/balance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ balance_cents: cents, note }),
    });
    setShowBalanceModal(false);
    await loadSummary();
  };

  // ── Filtered entries ───────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e =>
      (!q || e.title.toLowerCase().includes(q) || (e.vendor ?? "").toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q))
    );
  }, [entries, search]);

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const bal = summary?.balance.cents ?? 5500000;

  return (
    <div className="space-y-4 pb-20">

      {/* ── Balance Hero — dark slate banking */}
      <div className="bg-slate-900 rounded-xl text-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] tracking-widest uppercase font-semibold opacity-40 mb-2">FIAON GmbH · Unternehmenskonto</p>
            <p className="text-[40px] font-bold tabular-nums leading-none tracking-tight">{fmt(bal)}</p>
            {summary?.balance.note && <p className="text-[12px] opacity-40 mt-1.5">{summary.balance.note}</p>}
            {summary?.balance.updatedAt && <p className="text-[11px] opacity-30 mt-0.5">Stand: {fmtDate(summary.balance.updatedAt)}</p>}
          </div>
          <button onClick={() => setShowBalanceModal(true)}
            className="shrink-0 px-4 py-2 rounded-lg border border-white/10 text-[12px] font-medium text-white/60 hover:bg-white/10 transition-colors">
            Anpassen
          </button>
        </div>
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px mt-5 bg-white/10 rounded-lg overflow-hidden">
            {[
              { label: "Monatl. Burn",    val: fmt(summary.kpis.monthlyBurnCents), note: "Wiederk. Kosten" },
              { label: "Monat Ausgaben",  val: fmt(summary.kpis.monthlyOutCents),  note: "Akt. Monat" },
              { label: "Monat Einnahmen", val: fmt(summary.kpis.monthlyInCents),   note: "Akt. Monat" },
              { label: "Runway",          val: summary.kpis.runwayMonths >= 999 ? "∞" : `${summary.kpis.runwayMonths} Mo`, note: "Monate" },
            ].map(k => (
              <div key={k.label} className="bg-white/5 px-4 py-3">
                <p className="text-[9px] tracking-widest uppercase opacity-40 font-semibold">{k.label}</p>
                <p className="text-[15px] font-bold tabular-nums mt-0.5">{k.val}</p>
                <p className="text-[9px] opacity-30 mt-0.5">{k.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Prediction Card */}
      <PredictionCard pred={prediction} />

      {/* ── Tabs */}
      <div className="flex gap-px bg-slate-100 rounded-lg overflow-hidden p-0.5">
        {([
          { id: "overview",  label: "Übersicht" },
          { id: "entries",   label: "Transaktionen" },
          { id: "breakdown", label: "Kategorien" },
          { id: "cashflow",  label: "Cashflow" },
        ] as { id: typeof tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 rounded-md text-[12px] font-semibold transition-all ${
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ══════════ TAB: OVERVIEW ══════════ */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Upcoming payments */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Anstehende Zahlungen (30 Tage)</p>
            {(summary?.upcoming.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Keine anstehenden Zahlungen</p>
            ) : (
              <div className="space-y-2">
                {summary!.upcoming.map(e => {
                  const tm = ENTRY_TYPE_META[e.entry_type as EntryType] ?? ENTRY_TYPE_META.expense_onetime;
                  return (
                    <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: tm.bgColor, color: tm.color }}>
                        {tm.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-900 truncate">{e.title}</p>
                        <p className="text-[11px] text-slate-400">{fmtDate(e.entry_date)}</p>
                      </div>
                      <p className="text-[13px] font-bold tabular-nums" style={{ color: tm.color }}>
                        {tm.sign}{fmt(e.amount_cents)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Optimization tips */}
          <OptimizationTips summary={summary} />

          {/* Quick cashflow chart */}
          {summary && summary.cashflow.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 col-span-1 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Cashflow · Letzte 6 Monate</p>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-400/70 inline-block" />Ausgaben</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-400/70 inline-block" />Einnahmen</span>
                </div>
              </div>
              <CashflowBars data={summary.cashflow} />
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: TRANSACTIONS ══════════ */}
      {tab === "entries" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Buchhaltung</p>
                <h3 className="text-[14px] font-bold text-slate-900">Alle Transaktionen</h3>
              </div>
              <button
                onClick={() => { setEditEntry(null); setShowEntryModal(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-[12px] font-semibold hover:bg-slate-800 transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Neu
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Suchen…"
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                />
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="all">Alle Typen</option>
                {(Object.keys(ENTRY_TYPE_META) as EntryType[]).map(t => (
                  <option key={t} value={t}>{ENTRY_TYPE_META[t].label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="all">Alle Status</option>
                <option value="planned">Geplant</option>
                <option value="paid">Bezahlt</option>
                <option value="overdue">Überfällig</option>
                <option value="cancelled">Storniert</option>
              </select>
            </div>
          </div>

          {loadingEntries ? (
            <div className="p-4 space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-slate-50 animate-pulse" />)}</div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-2xl mb-2">💳</p>
              <p className="text-sm font-semibold text-slate-600">Keine Einträge</p>
              <button
                onClick={() => setShowEntryModal(true)}
                className="mt-3 px-4 py-2 rounded-xl bg-[#2563eb] text-white text-xs font-bold hover:bg-blue-700 transition-colors"
              >
                Ersten Eintrag hinzufügen
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Typ", "Bezeichnung", "Betrag", "Datum", "Status", "Methode", ""].map(h => (
                      <th key={h} className={`text-left py-3 px-4 text-[10px] uppercase tracking-wider font-semibold text-slate-400 ${h === "Betrag" ? "text-right" : ""} ${h === "" ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map(e => {
                    const tm = ENTRY_TYPE_META[e.entry_type as EntryType] ?? ENTRY_TYPE_META.expense_onetime;
                    const sm = STATUS_META[e.status as EntryStatus] ?? STATUS_META.planned;
                    const cat = CATEGORY_META[e.category] ?? CATEGORY_META.misc;
                    return (
                      <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: tm.bgColor, color: tm.color }}>
                              {tm.icon}
                            </span>
                            <div className="hidden sm:block">
                              <p className="text-[10px] font-semibold text-slate-500">{tm.label}</p>
                              {e.is_recurring && <p className="text-[9px] text-blue-500 font-bold">↻ {e.frequency}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-[13px] font-semibold text-slate-900">{e.title}</p>
                          <p className="text-[11px] text-slate-400">{cat.icon} {cat.label}{e.vendor ? ` · ${e.vendor}` : ""}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[14px] font-bold tabular-nums" style={{ color: tm.color }}>
                            {tm.sign}{fmt(e.amount_cents)}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="text-xs text-slate-500">{fmtDate(e.entry_date)}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sm.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                            {sm.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-400">
                            {e.payment_method ? PAYMENT_METHODS.find(m => m.value === e.payment_method)?.label ?? e.payment_method : "—"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => { setEditEntry(e); setShowEntryModal(true); }}
                              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                              title="Bearbeiten"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(e.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="Löschen"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round">
                                <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="px-4 py-3 border-t border-slate-50 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">{filteredEntries.length} Einträge</p>
                <div className="flex items-center gap-4 text-[12px]">
                  <span className="font-semibold text-red-500">
                    Ausgaben: {fmt(filteredEntries.filter(e => isOutflow(e.entry_type as EntryType)).reduce((s, e) => s + e.amount_cents, 0))}
                  </span>
                  <span className="font-semibold text-emerald-600">
                    Einnahmen: {fmt(filteredEntries.filter(e => !isOutflow(e.entry_type as EntryType)).reduce((s, e) => s + e.amount_cents, 0))}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: CATEGORIES ══════════ */}
      {tab === "breakdown" && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-4">Ausgaben nach Kategorien · Letzte 30 Tage</p>
          {(summary?.categoryBreakdown.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Keine Daten</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const total = (summary?.categoryBreakdown ?? []).reduce((s, c) => s + c.totalCents, 0) || 1;
                return summary!.categoryBreakdown.map(c => {
                  const pct = Math.round((c.totalCents / total) * 100);
                  const cat = CATEGORY_META[c.category] ?? CATEGORY_META.misc;
                  return (
                    <div key={c.category}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-[13px] font-semibold text-slate-800">{cat.label}</span>
                          <span className="text-[11px] text-slate-400">{c.count}×</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold text-slate-700 tabular-nums">{fmt(c.totalCents)}</span>
                          <span className="text-[11px] text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: ACCENT }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* ══════════ TAB: CASHFLOW ══════════ */}
      {tab === "cashflow" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monatlicher Cashflow</p>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-red-400/70 inline-block" />Ausgaben</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-2 rounded-sm bg-emerald-400/70 inline-block" />Einnahmen</span>
              </div>
            </div>
            {(summary?.cashflow.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Noch keine Daten für den Cashflow-Chart</p>
            ) : (
              <CashflowChart data={summary!.cashflow} />
            )}
          </div>

          {/* Monthly table */}
          {(summary?.cashflow.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Monat</th>
                    <th className="text-right py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Ausgaben</th>
                    <th className="text-right py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Einnahmen</th>
                    <th className="text-right py-3 px-5 text-[10px] uppercase tracking-wider font-semibold text-slate-400">Netto</th>
                  </tr>
                </thead>
                <tbody>
                  {summary!.cashflow.map(row => {
                    const net = row.inCents - row.outCents;
                    return (
                      <tr key={row.month} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-5 text-[13px] font-semibold text-slate-800">{fmtMonth(row.month)}</td>
                        <td className="py-3.5 px-5 text-right text-[13px] font-semibold text-red-500 tabular-nums">{fmt(row.outCents)}</td>
                        <td className="py-3.5 px-5 text-right text-[13px] font-semibold text-emerald-600 tabular-nums">{fmt(row.inCents)}</td>
                        <td className={`py-3.5 px-5 text-right text-[13px] font-bold tabular-nums ${net >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {fmt(net, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Floating Add Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => { setEditEntry(null); setShowEntryModal(true); }}
          className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-slate-900 text-white text-[13px] font-semibold shadow-md hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Transaktion
        </button>
      </div>

      {/* Modals */}
      {showEntryModal && (
        <EntryModal
          entry={editEntry}
          onSave={handleSaveEntry}
          onClose={() => { setShowEntryModal(false); setEditEntry(null); }}
        />
      )}
      {showBalanceModal && (
        <BalanceModal
          current={bal}
          onSave={handleUpdateBalance}
          onClose={() => setShowBalanceModal(false)}
        />
      )}
    </div>
  );
}
