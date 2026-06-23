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
  is_demo?: boolean;
}
interface BenefitActivity {
  id: number; benefit_key: string; kind: string; title: string;
  details: string | null; status: string; scheduled_at: string | null; created_at: string;
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
  token_quantity: number | null; token_purchase_price_cents: number | null; token_current_price_cents: number | null;
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
  equity: "Beteiligung", bond: "Anleihe", loan: "Darlehen", fund: "Fonds", real_estate: "Immobilie", token: "🪙 ARAS Token", other: "Sonstiges",
};
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktiv", cls: "bg-emerald-50 text-emerald-700" },
  matured: { label: "Fällig", cls: "bg-[#0D1B3E]/8 text-[#0D1B3E]" },
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
   CUSTOM LINE ICONS — consistent 1.6px stroke
   ────────────────────────────────────────────────────────── */
const ICON_PATHS: Record<string, JSX.Element> = {
  overview: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  investments: <><path d="M3 17l5-5 4 4 8-8" /><path d="M16 8h5v5" /></>,
  returns: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.7a2.5 2.5 0 0 1 4.6.3c0 1.6-2.1 1.9-2.1 3.2" /><path d="M12 16.2v.3" /></>,
  card: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19" /><path d="M6 14.5h4" /></>,
  benefits: <><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" /></>,
  documents: <><path d="M6 2.5h7l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z" /><path d="M13 2.5v5h5" /><path d="M8.5 13h7M8.5 16.5h5" /></>,
  account: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-5.6 7-5.6s7 2.3 7 5.6" /></>,
  logout: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="M9.4 12l1.9 1.9 3.5-3.6" /></>,
  check: <><path d="M20 6L9 17l-5-5" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  withdraw: <><path d="M12 3v13" /><path d="M7 11l5 5 5-5" /><path d="M5 20h14" /></>,
  sparkle: <><path d="M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9z" /></>,
  x: <><path d="M18 6L6 18M6 6l12 12" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  flight: <><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L11 19v-5.5z" /></>,
  phone: <><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l-2 4v2a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" /></>,
  calendar: <><rect x="3.5" y="4.5" width="17" height="16" rx="2" /><path d="M3.5 9h17M8 3v3M16 3v3" /></>,
  scale: <><path d="M12 3v18M7 21h10" /><path d="M5 7h14M5 7l-2.5 6a3 3 0 0 0 5 0zM19 7l-2.5 6a3 3 0 0 0 5 0z" /></>,
  receipt: <><path d="M6 2.5h12v19l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8h6M9 12h6" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  home: <><path d="M4 11l8-7 8 7" /><path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" /></>,
  star: <><path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.3 3.1-5.6 7-5.6s7 2.3 7 5.6" /></>,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
};

function Icon({ name, size = 18, className = "", strokeWidth = 1.6 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {ICON_PATHS[name] || null}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   BENEFIT SERVICE CONFIG — drives the per-benefit detail drawer
   ────────────────────────────────────────────────────────── */
interface BenefitServiceDef {
  icon: string;
  kind: string;
  actionLabel: string;
  titleLabel: string;
  titlePlaceholder: string;
  detailsPlaceholder: string;
  withDate: boolean;
  quotaPerYear?: number;
  quotaUnit?: string;
  intro: string;
  emptyHint: string;
  presets?: string[];
  isCard?: boolean;
}

const BENEFIT_SERVICE: Record<string, BenefitServiceDef> = {
  relationship: {
    icon: "user", kind: "request", actionLabel: "Rückruf anfragen", titleLabel: "Ihr Anliegen",
    titlePlaceholder: "Worum geht es?", detailsPlaceholder: "Beschreiben Sie Ihr Anliegen…", withDate: false,
    intro: "Ihr persönlicher Relationship Manager meldet sich zeitnah bei Ihnen.",
    emptyHint: "Noch keine Anfragen. Fordern Sie jederzeit einen Rückruf an.",
    presets: ["Rückruf vereinbaren", "Termin vor Ort", "Allgemeine Frage"],
  },
  consulting: {
    icon: "briefcase", kind: "consultation", actionLabel: "Beratung buchen", titleLabel: "Thema der Beratung",
    titlePlaceholder: "z. B. Portfolio-Strategie", detailsPlaceholder: "Ihre Fragestellung…", withDate: true,
    quotaPerYear: 6, quotaUnit: "Beratungen",
    intro: "Strategische Unternehmensberatung durch unsere Partner – kostenfrei.",
    emptyHint: "Noch keine Beratungen gebucht.",
    presets: ["Strategie-Review", "Nachfolgeplanung", "M&A / Beteiligung"],
  },
  card: {
    icon: "card", kind: "request", actionLabel: "Karte verwalten", titleLabel: "", titlePlaceholder: "",
    detailsPlaceholder: "", withDate: false, isCard: true,
    intro: "Ihre persönliche Schwarzott Metallkarte.",
    emptyHint: "",
  },
  flights: {
    icon: "flight", kind: "flight", actionLabel: "Flug anfragen", titleLabel: "Strecke",
    titlePlaceholder: "z. B. Zürich (ZRH) → Nizza (NCE)", detailsPlaceholder: "Passagiere, Gepäck, Sonderwünsche…", withDate: true,
    quotaPerYear: 12, quotaUnit: "Flüge",
    intro: "Privatjet-Charter & First-Class-Arrangements zu Vorzugskonditionen.",
    emptyHint: "Noch keine Flüge. Fragen Sie Ihren ersten Flug an.",
    presets: ["Zürich → London", "Zürich → Nizza", "Zürich → Genf"],
  },
  insurance: {
    icon: "shield", kind: "request", actionLabel: "Anliegen melden", titleLabel: "Anliegen",
    titlePlaceholder: "z. B. Schadenmeldung", detailsPlaceholder: "Details zu Ihrem Anliegen…", withDate: false,
    intro: "Umfassender Schutz für Sie, Ihre Familie und Ihre Investments.",
    emptyHint: "Noch keine Vorgänge erfasst.",
    presets: ["Schadenfall melden", "Police prüfen", "Beratung Versicherung"],
  },
  legal: {
    icon: "scale", kind: "consultation", actionLabel: "Rechtsberatung anfragen", titleLabel: "Rechtsthema",
    titlePlaceholder: "z. B. Vertragsprüfung", detailsPlaceholder: "Worum geht es rechtlich?…", withDate: true,
    quotaPerYear: 12, quotaUnit: "Beratungen",
    intro: "Direkter Zugang zu unserer hauseigenen Rechtsabteilung.",
    emptyHint: "Noch keine Rechtsberatungen.",
    presets: ["Vertragsprüfung", "Gesellschaftsrecht", "Vertretung"],
  },
  tax: {
    icon: "receipt", kind: "consultation", actionLabel: "Steuerberatung anfragen", titleLabel: "Steuerthema",
    titlePlaceholder: "z. B. Jahresabschluss", detailsPlaceholder: "Ihr steuerliches Anliegen…", withDate: true,
    quotaPerYear: 12, quotaUnit: "Beratungen",
    intro: "Steuerliche Optimierung und Strukturierung durch unsere Experten.",
    emptyHint: "Noch keine Steuerberatungen.",
    presets: ["Jahresabschluss", "Steueroptimierung", "Internationale Struktur"],
  },
  concierge: {
    icon: "bell", kind: "request", actionLabel: "Concierge beauftragen", titleLabel: "Ihr Wunsch",
    titlePlaceholder: "z. B. Restaurant-Reservierung", detailsPlaceholder: "Datum, Uhrzeit, Personen, Details…", withDate: false,
    intro: "Persönlicher Concierge-Service rund um die Uhr.",
    emptyHint: "Noch keine Aufträge. Ihr Concierge ist 24/7 für Sie da.",
    presets: ["Reservierung", "Reiseplanung", "Geschenk-Service"],
  },
  realestate: {
    icon: "home", kind: "request", actionLabel: "Off-Market Anfrage", titleLabel: "Ihre Suche",
    titlePlaceholder: "z. B. Penthouse Zürich", detailsPlaceholder: "Lage, Budget, Eckdaten…", withDate: false,
    intro: "Vorzugszugang zu exklusiven Immobilien abseits des Marktes.",
    emptyHint: "Noch keine Anfragen erfasst.",
    presets: ["Wohnimmobilie", "Anlageobjekt", "Gewerbe"],
  },
  events: {
    icon: "star", kind: "invitation", actionLabel: "Teilnahme anfragen", titleLabel: "Event",
    titlePlaceholder: "z. B. Investoren-Dinner", detailsPlaceholder: "Anzahl Personen, Anmerkungen…", withDate: true,
    intro: "Einladungen zu Investoren-Dinners, Salons und Circle-Gatherings.",
    emptyHint: "Aktuell keine Anmeldungen. Demnächst folgen neue Einladungen.",
    presets: ["Investoren-Dinner", "Circle Salon", "Private Viewing"],
  },
};

const ACTIVITY_STATUS: Record<string, { label: string; cls: string }> = {
  proposed: { label: "Bestätigung offen", cls: "bg-[#B8923A]/15 text-[#8a6d22]" },
  requested: { label: "Angefragt", cls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Bestätigt", cls: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Abgeschlossen", cls: "bg-[#0D1B3E]/8 text-[#0D1B3E]" },
  declined: { label: "Abgelehnt", cls: "bg-rose-50 text-rose-600" },
  cancelled: { label: "Storniert", cls: "bg-slate-100 text-slate-400" },
};

function benefitIconFor(key: string): string {
  return BENEFIT_SERVICE[key]?.icon || "benefits";
}

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
  const [tab, setTab] = useState<"overview" | "investments" | "returns" | "card" | "benefits" | "documents" | "account">("overview");
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [requestModal, setRequestModal] = useState<"deposit" | "withdrawal" | null>(null);
  const [showGreeting, setShowGreeting] = useState(false);
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  const [syncTimeLeft, setSyncTimeLeft] = useState<number | null>(null);
  const [benefitDrawer, setBenefitDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (investor && !sessionStorage.getItem("scp-greeted")) {
      setShowGreeting(true);
      sessionStorage.setItem("scp-greeted", "1");
    }

    const SYNC_START_KEY = "scp-sync-start";
    let syncStartTime = localStorage.getItem(SYNC_START_KEY);
    if (!syncStartTime) {
      syncStartTime = String(Date.now());
      localStorage.setItem(SYNC_START_KEY, syncStartTime);
    }
    const startTimestamp = Number(syncStartTime);
    const endTime = startTimestamp + 24 * 60 * 60 * 1000;

    const updateSyncTimer = () => {
      const timeLeft = endTime - Date.now();
      if (timeLeft > 0) {
        setSyncTimeLeft(timeLeft);
        setShowSyncBanner(true);
      } else {
        setShowSyncBanner(false);
        setSyncTimeLeft(null);
        localStorage.removeItem(SYNC_START_KEY);
      }
    };
    updateSyncTimer();
    const syncInterval = setInterval(updateSyncTimer, 1000);
    return () => clearInterval(syncInterval);
  }, [investor]);

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
        <div className="w-8 h-8 border-2 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: "#B8923A" }} />
      </div>
    );
  }

  const gainPositive = (summary?.unrealizedGainCents ?? 0) >= 0;
  const tier: InvestorTier = (investor?.tier as InvestorTier) || "standard";
  const tierDef = TIERS[tier];
  const activeBenefits = benefits.filter((b) => BENEFIT_MAP[b.benefit_key]);
  const contractualReturnCents = investments
    .filter((i) => i.status === "active")
    .reduce((acc, inv) => acc + Math.round(inv.principal_cents * (inv.interest_rate ?? 0) / 100), 0);
  const nextMaturityStr = fmtDate(
    investments.filter((i) => i.status === "active" && i.maturity_date).map((i) => i.maturity_date!).sort()[0]
  );
  const contractualRatePct = investments.find((i) => i.status === "active")?.interest_rate ?? 0;
  const pendingDepositsCents = transactions
    .filter((t) => t.status === "pending" && t.transaction_type === "deposit")
    .reduce((acc, t) => acc + (Number(t.amount_cents) || 0), 0);
  const TABS = [
    { id: "overview" as const, label: "Übersicht", icon: "overview" },
    { id: "investments" as const, label: "Investments", icon: "investments" },
    { id: "returns" as const, label: "Renditen", icon: "returns" },
    { id: "card" as const, label: "Karte", icon: "card" },
    { id: "benefits" as const, label: "Leistungen", icon: "benefits" },
    { id: "documents" as const, label: "Verträge", icon: "documents" },
    { id: "account" as const, label: "Konto", icon: "account" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F7F5EF" }}>
      {/* ═══ TOP NAV ═══ */}
      <header className="sticky top-0 z-30 backdrop-blur-md border-b" style={{ background: "rgba(247,245,239,.85)", borderColor: "#ECE7DC" }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display text-[17px] font-semibold text-white shrink-0" style={{ background: "linear-gradient(135deg,#0D1B3E,#1d2f5a)" }}>S</div>
            <div className="leading-tight">
              <p className="text-[13.5px] sm:text-[14px] font-semibold tracking-tight" style={{ color: "#0D1B3E" }}>Schwarzott Capital Partners</p>
              <p className="text-[9px] font-bold uppercase tracking-[.3em]" style={{ color: "#B8923A" }}>Private Banking</p>
            </div>
            {investor?.is_demo && (
              <span className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[.14em] text-white shrink-0" style={{ background: "linear-gradient(135deg,#B8923A,#8a6d24)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/90 animate-pulse" />
                Demo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("account")} className="flex items-center gap-2.5 pl-2.5 pr-1.5 sm:pr-3 py-1.5 rounded-full transition-colors hover:bg-white/70 border border-transparent" style={{ borderColor: tab === "account" ? "#ECE7DC" : "transparent" }}>
              <div className="hidden sm:block text-right">
                <p className="text-[12.5px] font-semibold" style={{ color: "#0D1B3E" }}>{investor?.salutation ? investor.salutation + " " : ""}{investor?.first_name} {investor?.last_name}</p>
                <p className="text-[10.5px] text-slate-400">{investor?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold text-white shrink-0" style={{ background: "linear-gradient(135deg,#B8923A,#9a7a2e)" }}>
                {(investor?.first_name?.[0] || "I").toUpperCase()}
              </div>
            </button>
            <button onClick={logout} title="Abmelden" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white/70 transition-colors">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </header>

      {showSyncBanner && syncTimeLeft !== null && (
        <SyncBanner timeLeft={syncTimeLeft} onDismiss={() => setShowSyncBanner(false)} />
      )}

      <main className="max-w-[1180px] mx-auto px-5 sm:px-8 py-7 sm:py-9 space-y-7">
        {/* ═══ PORTFOLIO HERO ═══ */}
        <section className="rounded-3xl p-7 sm:p-9 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#0D1B3E 0%,#142248 55%,#0D1B3E 100%)", boxShadow: "0 30px 60px -25px rgba(13,27,62,.6)" }}>
          <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(90deg,#fff,transparent 1px,transparent 60px,#fff 61px)" }} />
          <div className="absolute -top-20 -right-10 w-72 h-72 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#B8923A,transparent 70%)", filter: "blur(50px)" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4 mb-2">
              <p className="text-[12px] font-semibold uppercase tracking-[.18em]" style={{ color: "rgba(212,175,106,.8)" }}>Aktueller Portfolio-Wert</p>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[.12em] text-white shrink-0" style={{ background: tierDef.gradient, boxShadow: "0 6px 18px -6px rgba(0,0,0,.5)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
                {tierDef.label}
              </span>
            </div>
            <div className="flex items-end gap-4 flex-wrap">
              <h1 className="font-display text-[42px] sm:text-[54px] font-semibold text-white tracking-tight tabular-nums leading-none">{eur(summary?.currentValueCents ?? 0)}</h1>
            </div>
            {pendingDepositsCents > 0 && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(251,191,36,.12)", border: "1px solid rgba(251,191,36,.25)", color: "#fcd34d" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse shrink-0" />
                {eur2(pendingDepositsCents)} ausstehend · wird nach Buchungsbestätigung ergänzt
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-7">
              {([
                { label: "Investiertes Kapital", value: eur(summary?.totalInvestedCents ?? 0), goto: "investments" as const },
                { label: "Vertragl. Gesamtrendite", value: eur(contractualReturnCents), sub: contractualRatePct ? `${contractualRatePct} % p.a. · Fällig ${nextMaturityStr}` : undefined, goto: "returns" as const },
                { label: "Ø Rendite p.a.", value: `${(summary?.avgYieldPct ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`, goto: "returns" as const },
                { label: "Aktive Investments", value: String(summary?.activeCount ?? 0), goto: "investments" as const },
              ]).map((s) => (
                <button key={s.label} onClick={() => setTab(s.goto)}
                  className="group text-left rounded-xl p-3 -m-0.5 transition-colors hover:bg-white/[0.06] focus:outline-none focus:bg-white/[0.06]">
                  <p className="text-[10.5px] font-medium uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: "rgba(212,175,106,.65)" }}>
                    {s.label}
                    <Icon name="arrowRight" size={11} strokeWidth={2} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#d4af6a]" />
                  </p>
                  <p className="text-[18px] sm:text-[20px] font-bold text-white tabular-nums">{s.value}</p>
                  {s.sub && <p className="text-[10px] font-semibold mt-1 leading-tight" style={{ color: "#d4af6a" }}>{s.sub}</p>}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-white/10">
              <button onClick={() => setRequestModal("deposit")}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold text-[#0D1B3E] transition-all hover:brightness-105 active:scale-[.99]"
                style={{ background: "linear-gradient(135deg,#d4af6a,#B8923A)", boxShadow: "0 10px 28px -10px rgba(184,146,58,.7)" }}>
                <Icon name="plus" size={17} strokeWidth={2} /> Kapital einzahlen
              </button>
              <button onClick={() => setRequestModal("withdrawal")}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all hover:bg-white/10 active:scale-[.99]"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.18)" }}>
                <Icon name="withdraw" size={17} strokeWidth={2} /> Auszahlung anfragen
              </button>
            </div>
          </div>
        </section>

        {/* ═══ TABS ═══ */}
        <div className="-mx-5 sm:mx-0 px-5 sm:px-0 overflow-x-auto scp-scroll">
          <div className="flex items-center gap-1 bg-white rounded-2xl p-1.5 border w-max" style={{ borderColor: "#ECE7DC", boxShadow: "0 1px 2px rgba(13,27,62,.03)" }}>
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all whitespace-nowrap ${tab === t.id ? "text-white shadow-[0_4px_14px_rgba(13,27,62,.25)]" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"}`}
                style={tab === t.id ? { background: "#0D1B3E" } : undefined}>
                <Icon name={t.icon} size={16} strokeWidth={1.7} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══ OVERVIEW ═══ */}
        {tab === "overview" && (
          <div className="flex flex-col gap-6">
            {/* Transaktionsverlauf */}
            <div className="scp-card p-6">
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
            <div className="scp-card p-6">
              <h3 className="text-[15px] font-bold text-slate-900 mb-4">Ihre Investments</h3>
              {investments.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-8 text-center">Noch keine Investments hinterlegt.</p>
              ) : (
                <div className="space-y-2">
                  {investments.slice(0, 5).map((inv) => {
                    const cur = inv.current_value_cents == null ? inv.principal_cents : inv.current_value_cents;
                    const gain = cur - inv.principal_cents;
                    const st = STATUS_LABEL[inv.status] || STATUS_LABEL.active;
                    const isToken = inv.investment_type === "token";
                    return (
                      <div key={inv.id} onClick={() => setSelectedInvestment(inv)} className="flex flex-col gap-1.5 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 cursor-pointer">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-semibold text-slate-900 truncate">{inv.name}</p>
                          <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                        </div>
                        {isToken && inv.token_quantity != null ? (
                          <p className="text-[11px] text-slate-400">{Number(inv.token_quantity).toLocaleString("de-DE")} Token · Kurs {inv.token_current_price_cents != null ? (inv.token_current_price_cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 }) : "—"}</p>
                        ) : (
                          <p className="text-[11px] text-slate-400">{INVESTMENT_TYPE_LABEL[inv.investment_type] || inv.investment_type} · {inv.interest_rate ?? 0}% p.a.</p>
                        )}
                        <div className="flex items-baseline gap-2">
                          <p className="text-[14px] font-bold text-slate-900 tabular-nums">{eur(cur)}</p>
                          {inv.current_value_cents != null && <span className={`text-[11px] font-semibold tabular-nums ${gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{gain >= 0 ? "+" : ""}{eur(gain)}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {investments.length > 5 && (
                    <button onClick={() => setTab("investments")} className="mt-2 text-[12px] font-semibold hover:underline" style={{ color: "#B8923A" }}>Alle {investments.length} anzeigen</button>
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
              <div className="scp-card py-16 text-center text-[14px] text-slate-400">Noch keine Investments hinterlegt.</div>
            ) : investments.map((inv) => {
              const cur = inv.current_value_cents == null ? inv.principal_cents : inv.current_value_cents;
              const gain = cur - inv.principal_cents;
              const gainPct = inv.principal_cents > 0 ? (gain / inv.principal_cents) * 100 : null;
              const st = STATUS_LABEL[inv.status] || STATUS_LABEL.active;
              const isToken = inv.investment_type === "token";
              const eurFmt2dp = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
              const statsRow = isToken ? [
                { l: "Anzahl Token", v: inv.token_quantity != null ? Number(inv.token_quantity).toLocaleString("de-DE") : "—" },
                { l: "Einkaufskurs", v: inv.token_purchase_price_cents != null ? eurFmt2dp(inv.token_purchase_price_cents / 100) + " / Token" : "—" },
                { l: "Aktueller Kurs", v: inv.token_current_price_cents != null ? eurFmt2dp(inv.token_current_price_cents / 100) + " / Token" : "—" },
                { l: "Einkaufswert", v: eur(inv.principal_cents) },
              ] : [
                { l: "Eingesetzt", v: eur(inv.principal_cents) },
                { l: "Rendite p.a.", v: `${inv.interest_rate ?? 0} %` },
                { l: "Laufzeit ab", v: fmtDate(inv.start_date) },
                { l: "Fälligkeit", v: fmtDate(inv.maturity_date) },
              ];
              return (
                <div key={inv.id} onClick={() => setSelectedInvestment(inv)} className={`scp-card p-6 cursor-pointer hover:shadow-md transition-all ${isToken ? "border-amber-200 hover:border-amber-300" : "hover:border-slate-200"}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full min-h-[44px]" style={{ background: isToken ? "linear-gradient(180deg,#d4af6a,#B8923A)" : "linear-gradient(180deg,#0D1B3E,#B8923A)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-bold text-slate-900 truncate">{inv.name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                        {isToken && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">ARAS Token</span>}
                      </div>
                      <p className="text-[12px] text-slate-400 mt-0.5">{INVESTMENT_TYPE_LABEL[inv.investment_type] || inv.investment_type}{inv.description ? ` · ${inv.description}` : ""}</p>
                      <div className="mt-3">
                        <p className="text-[22px] font-bold text-slate-900 tabular-nums">{eur(cur)}</p>
                        {inv.current_value_cents != null ? (
                          <p className={`text-[12px] font-semibold mt-0.5 ${gain >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {gain >= 0 ? "+" : "−"}{eur(Math.abs(gain))} {isToken ? "Kursgewinn" : "Wertzuwachs"}{gainPct != null ? ` (${gain >= 0 ? "+" : ""}${gainPct.toFixed(2)} %)` : ""}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-50">
                    {statsRow.map((x) => (
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
          <div className="scp-card overflow-hidden">
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
          <BenefitsTab tier={tier} activeBenefits={activeBenefits} onOpenBenefit={(key) => key === "card" ? setTab("card") : setBenefitDrawer(key)} />
        )}

        {/* ═══ DOCUMENTS ═══ */}
        {tab === "documents" && (
          <div className="scp-card overflow-hidden">
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
                    <span className="text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#B8923A" }}>Herunterladen ↓</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ KONTO / ACCOUNT ═══ */}
        {tab === "account" && (
          <AccountTab investor={investor} onUpdated={(inv) => setInvestor(inv)} />
        )}

        <p className="text-center text-[11px] text-slate-400 pt-4">
          Schwarzott Capital Partners AG · Geschützter Investoren-Bereich · Alle Angaben ohne Gewähr.
        </p>
      </main>

      {selectedInvestment && (
        <InvestmentDetailDrawer
          investment={selectedInvestment}
          transactions={transactions}
          onClose={() => setSelectedInvestment(null)}
        />
      )}

      {requestModal && (
        <RequestModal
          type={requestModal}
          investments={investments}
          summary={summary}
          contractualRatePct={contractualRatePct}
          onClose={() => setRequestModal(null)}
        />
      )}

      {benefitDrawer && (
        <BenefitDetailDrawer
          benefitKey={benefitDrawer}
          onClose={() => setBenefitDrawer(null)}
        />
      )}

      {showGreeting && investor && (
        <GreetingOverlay
          investor={investor}
          summary={summary}
          contractualReturnCents={contractualReturnCents}
          contractualRatePct={contractualRatePct}
          nextMaturityStr={nextMaturityStr}
          pendingDepositsCents={pendingDepositsCents}
          onClose={() => setShowGreeting(false)}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   INVESTMENT DETAIL DRAWER
   ────────────────────────────────────────────────────────── */
function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "#B8923A" }} />
      <p className="text-[10.5px] font-bold uppercase tracking-[.2em] text-slate-500">{title}</p>
    </div>
  );
}

function InfoBox({ label, name, details }: { label: string; name: string; details: string }) {
  return (
    <div className="rounded-xl p-4 bg-slate-50 border border-slate-100 text-[12px]">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <p className="font-bold text-slate-900">{name}</p>
      <p className="text-slate-500 mt-0.5 leading-relaxed whitespace-pre-line">{details}</p>
    </div>
  );
}

function InvestmentDetailDrawer({
  investment,
  transactions,
  onClose,
}: {
  investment: Investment;
  transactions: Transaction[];
  onClose: () => void;
}) {
  const isZV1 = investment.name.includes("ZV1");
  const isToken = investment.investment_type === "token";
  const myTxs = transactions.filter((t) => t.investment_id === investment.id);
  const totalPayout = Math.round(investment.principal_cents * (1 + (investment.interest_rate ?? 0) / 100));
  const tokenCur = investment.current_value_cents ?? investment.principal_cents;
  const tokenGain = tokenCur - investment.principal_cents;
  const tokenGainPct = investment.principal_cents > 0 ? (tokenGain / investment.principal_cents) * 100 : 0;
  const eurFmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

  const tokenHeaderKpis = isToken ? [
    { l: "Token-Gesamtzahl", v: investment.token_quantity != null ? Number(investment.token_quantity).toLocaleString("de-DE") + " ARAS" : "—" },
    { l: "Einkaufskurs", v: investment.token_purchase_price_cents != null ? eurFmt(investment.token_purchase_price_cents / 100) + " / Token" : "—" },
    { l: "Aktueller Kurs", v: investment.token_current_price_cents != null ? eurFmt(investment.token_current_price_cents / 100) + " / Token" : "—" },
    { l: `Gesamtwert · ${tokenGain >= 0 ? "+" : ""}${tokenGainPct.toFixed(2)} %`, v: eur2(tokenCur) },
  ] : [
    { l: "Gesamteinlage", v: eur2(investment.principal_cents) },
    { l: "Zinssatz p.a.", v: `${investment.interest_rate ?? 0} %` },
    { l: "Laufzeit bis", v: fmtDate(investment.maturity_date) },
    { l: "Endfällige Auszahlung", v: eur2(totalPayout) },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B3E]/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white overflow-hidden"
        style={{ width: "min(720px,100vw)", boxShadow: "-20px 0 60px rgba(0,0,0,.25)", animation: "slideInRight .3s cubic-bezier(.4,0,.2,1)" }}
      >
        {/* Header */}
        <div className="shrink-0 px-7 pt-7 pb-6" style={{ background: isToken ? "linear-gradient(160deg,#1a1200 0%,#3a2800 100%)" : "linear-gradient(160deg,#0D1B3E 0%,#142248 100%)" }}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold uppercase tracking-[.3em] mb-1.5" style={{ color: "#B8923A" }}>
                {isToken ? "Private Sale Agreement · ARAS Token · Addendum Nr. 2" : `Investitionsvertrag · ${investment.currency}`}
              </p>
              <h2 className="text-[16px] font-bold text-white leading-snug">{investment.name}</h2>
              {isToken && <p className="text-[11px] mt-1" style={{ color: "rgba(212,175,106,0.7)" }}>ERC-20 · Arbitrum One Blockchain</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tokenHeaderKpis.map((x) => (
              <div key={x.l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(212,175,106,.7)" }}>{x.l}</p>
                <p className="text-[12.5px] font-bold text-white tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ARAS TOKEN DETAIL ── */}
          {isToken && (
            <>
              {/* Vertragsparteien */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Vertragsparteien · Addendum Nr. 2" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <InfoBox
                    label="Emittentin"
                    name="Schwarzott Capital Partners AG"
                    details={"Löwenstrasse 20, 8001 Zürich, Schweiz\nCHE-102.119.428\nVerwaltungsratspräsident: Justin Schwarzott"}
                  />
                  <InfoBox
                    label="Investor"
                    name="Iron Mountain Investment LLC"
                    details={"Sharjah Media City, Sharjah, VAE\nFormation Number 2218188\nDirector: Christian Schwab"}
                  />
                </div>
              </section>

              {/* Token-Zuteilung */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Token-Zuteilung · Investment EUR 50.000" />
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full">
                    <tbody>
                      {([
                        { pos: "01 · Basiszuteilung", sub: "EUR 50.000 Investitionsbetrag ÷ EUR 0,12 Zuteilungspreis", val: "416.666 ARAS" },
                        { pos: "02 · Investor Campaign Bonus (15 %)", sub: "15 % Bonus auf die Basiszuteilung gemäß Investoren-Kampagne", val: "62.499 ARAS" },
                        { pos: "03 · Zusatzbonus (6 %)", sub: "Weiterer Bonus von 6 % auf die Basiszuteilung", val: "24.999 ARAS" },
                      ] as const).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-4 py-3 text-[12.5px]">
                            <p className="font-semibold text-slate-900">{r.pos}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{r.sub}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">{r.val}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "linear-gradient(90deg,#1a1200,#3a2800)" }}>
                        <td className="px-4 py-3 text-[13px] font-bold text-white">Gesamt-Zuteilung</td>
                        <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums whitespace-nowrap" style={{ color: "#d4af6a" }}>504.164 ARAS Token</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 text-[12px] text-slate-700 leading-relaxed">
                  Zuteilungspreis: <strong>EUR 0,12 pro Token</strong> · Token-Transfer innerhalb von <strong>3 Werktagen</strong> nach Unterzeichnung (Vorausleistung der Emittentin) · Blockchain: <strong>Arbitrum One (ERC-20)</strong>
                </div>
              </section>

              {/* Kursentwicklung */}
              {investment.token_purchase_price_cents != null && investment.token_current_price_cents != null && (
                <section className="px-7 py-5 border-b border-slate-100">
                  <SectionHeader title="Kursentwicklung & aktueller Portfoliowert" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { l: "Einkaufskurs", v: eurFmt(investment.token_purchase_price_cents / 100) + " / Token" },
                      { l: "Aktueller Kurs", v: eurFmt(investment.token_current_price_cents / 100) + " / Token" },
                      { l: "Einkaufswert gesamt", v: eur2(investment.principal_cents) },
                      { l: tokenGain >= 0 ? "Kursgewinn" : "Kursverlust", v: `${tokenGain >= 0 ? "+" : ""}${eurFmt(tokenGain / 100)} (${tokenGain >= 0 ? "+" : ""}${tokenGainPct.toFixed(2)} %)` },
                    ].map((x) => (
                      <div key={x.l} className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{x.l}</p>
                        <p className={`text-[13px] font-bold mt-1 tabular-nums ${x.l.includes("gewinn") ? "text-emerald-600" : x.l.includes("verlust") ? "text-rose-600" : "text-slate-900"}`}>{x.v}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Blockchain & Transfer */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Blockchain · Transfer & Rechtliches" />
                <div className="space-y-2.5">
                  {[
                    { t: "Blockchain-Standard", tx: "ERC-20 Token auf der Arbitrum One Blockchain. Transfer an die hinterlegte Wallet-Adresse des Investors; Dokumentation per Tx-Hash / Blockchain-Explorer." },
                    { t: "Rechtsübergang", tx: "Mit Nachweis der Übertragung (Tx-Hash) gilt die rechtliche und wirtschaftliche Verfügungsmacht als auf den Investor übergegangen." },
                    { t: "Kein Rückabwicklungsanspruch", tx: "Nach erfolgter Tokenzuteilung besteht kein Anspruch auf Rückabwicklung oder Umwandlung in Fiatgeld aufgrund nachträglicher Markt-, Kurs- oder Projektentwicklungen." },
                    { t: "Rechtswahl & Gerichtsstand", tx: "Schweizer Recht (ohne Kollisionsnormen und UN-Kaufrecht). Ausschließlicher Gerichtsstand: Zürich, Schweiz." },
                  ].map((s, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50">
                      <p className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">{s.t}</p>
                      <p className="text-[12px] text-slate-500 leading-relaxed">{s.tx}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Dokument-Signatur */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Digitale Unterzeichnung via PandaDoc" />
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    {([
                      ["Dokument-Referenz", "O3GU8-SKXPJ-QXGYX-UVXM8"],
                      ["Unterzeichnet", "15. Dezember 2025 · Zürich"],
                      ["Unterzeichner (Emittentin)", "Justin Schwarzott · Schwarzott Capital Partners AG"],
                      ["Unterzeichner (Investor)", "Christian Schwab · Iron Mountain Investment LLC"],
                    ] as const).map(([k, v], i) => (
                      <div key={i}>
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{k}</p>
                        <p className="font-semibold text-slate-900 text-[11.5px]">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-[11px] font-semibold">Addendum Nr. 2 rechtsgültig unterzeichnet · Beide Parteien verifiziert</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {isZV1 && (
            <>
              {/* Vertragsparteien */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Vertragsparteien · Zusatzvereinbarung Nr. 1" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <InfoBox
                    label="Gesellschaft"
                    name="Schwarzott Capital Partners AG"
                    details={"Löwenstrasse 20, 8001 Zürich, Schweiz\nCHE-102.119.428\nVerwaltungsratspräsident: Justin Schwarzott"}
                  />
                  <InfoBox
                    label="Investor"
                    name="Iron Mountain Investment LLC"
                    details={"Sharjah Media City, Sharjah, VAE\nFormation Number 2218188\nGeschäftsführer: Christian Schwab\nReisepass C1TG9W5WG · gültig bis 21.06.2032"}
                  />
                </div>
              </section>

              {/* § 3 Gesamtinvestment */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="§ 3 · Gesamtinvestment & Tranchenstruktur" />
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full">
                    <tbody>
                      {([
                        { pos: "Prolongiertes Kapital (Ursprungsvertrag SCAG-INV-0425-IMI-164)", sub: "EUR 50.000 Kapital + 16,4 % Zinsen p.a. · Laufzeit April 2025 – April 2026", val: "EUR 58.200,00" },
                        { pos: "1. Tranche Neueinlage", sub: "Zahlungsziel 01. Juni 2026 · eingegangen ✓", val: "EUR 55.000,00" },
                        { pos: "2. Tranche Neueinlage", sub: "Zahlungsziel 01. Juli 2026", val: "EUR 36.800,00" },
                        { pos: "Option A – Kapitalisierung Überzahlung", sub: "Bestätigt per E-Mail 17.06.2026 (Christian Schwab)", val: "EUR 1.648,27" },
                      ] as const).map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-4 py-3 text-[12.5px]">
                            <p className="font-semibold text-slate-900">{r.pos}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">{r.sub}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">{r.val}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "#0D1B3E" }}>
                        <td className="px-4 py-3 text-[13px] font-bold text-white">Gesamtinvestment (inkl. Option A)</td>
                        <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums" style={{ color: "#d4af6a" }}>EUR 151.648,27</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* § 4 Konditionen */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="§ 4 · Konditionen & Laufzeit" />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { l: "Laufzeitbeginn", v: "01. Juli 2026" },
                    { l: "Laufzeitende", v: "01. Juli 2027" },
                    { l: "Fixe Verzinsung p.a.", v: "18,2 %" },
                    { l: "Gesamtauszahlung", v: "EUR 177.300,–" },
                    { l: "Auszahlungsart", v: "Endfällig" },
                    { l: "Laufzeit", v: "12 Monate" },
                  ].map((x) => (
                    <div key={x.l} className="flex flex-col justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{x.l}</p>
                      <p className="text-[13px] font-bold text-slate-900 mt-1 tabular-nums">{x.v}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 text-[12px] text-slate-700 leading-relaxed">
                  Kapital und Zinsertrag werden am <strong>01. Juli 2027</strong> einmalig endfällig in einem Betrag ausbezahlt (EUR 177.300,–).
                </div>
              </section>

              {/* § 5 Private Capital Partner */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="§ 5 · Status als Private Capital Partner" />
                <div className="space-y-2">
                  {[
                    "Größtmögliche Transparenz über Mittelverwendung und Investitionsfortschritt",
                    "Bevorzugte Nachinvestitionsrechte bei künftigen Investitionsrunden der Gesellschaft",
                    "Direkter Zugang zum exklusiven Netzwerk inkl. persönlicher Gespräche mit Geschäftsleitung und VR",
                    "Berechtigung zu weiteren Investitionen jederzeit (vorbehaltlich Kapazität und Regulatorik)",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-[12.5px] text-slate-700 py-1">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#B8923A" }} />
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              {/* § 6 Sicherheitsstruktur */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="§ 6 · Garantierte Verzinsung & Sicherheitsstruktur" />
                <div className="space-y-2.5">
                  {[
                    { t: "Liquiditätsdeckung", tx: "Rückflüsse basieren auf Kapitalumschlag durch KI-Projekte, Handelsaktivitäten, institutionelle Immobilienentwicklungen und Beteiligungsrenditen." },
                    { t: "Interne Rückstellungen", tx: "Zweckgebundene Rücklagen auf separaten Gesellschaftskonten zur Absicherung externer Kapitalgeber." },
                    { t: "Persönliche Haftungsübernahme VRP", tx: "Justin Schwarzott übernimmt volle persönliche Haftung mit seinem Privatvermögen für den Fall, dass die Gesellschaft ihren Zahlungsverpflichtungen nicht nachkommt." },
                  ].map((s, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50">
                      <p className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider mb-1">{s.t}</p>
                      <p className="text-[12px] text-slate-600 leading-relaxed">{s.tx}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* § 8 Auszahlungskonto */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="§ 8 · Auszahlungskonto des Investors" />
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-[12.5px]">
                    <tbody>
                      {([
                        ["Kontoinhaber", "Iron Mountain Investment LLC"],
                        ["IBAN", "AE43 0860 0000 0955 6455 398"],
                        ["BIC / SWIFT", "WIOBAEADXXX"],
                        ["Kontonummer", "9556455398"],
                        ["Währung", "EUR"],
                      ] as const).map(([k, v], i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="px-4 py-2.5 text-slate-500 font-medium w-[160px]">{k}</td>
                          <td className="px-4 py-2.5 font-bold text-slate-900 font-mono tracking-wide">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* PandaDoc Signatur */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Digitale Unterzeichnung via PandaDoc" />
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                    {([
                      ["Dokumenten-Referenz", "YUCYQ-RTPRU-TUJZW-ZHPMU"],
                      ["Unterzeichnet", "28. Apr. 2026 · 08:14:49 UTC"],
                      ["E-Mail Unterzeichner", "ironmountaininvest@gmail.com"],
                      ["Standort", "Hamburg, Germany"],
                      ["IP-Adresse", "94.156.150.130"],
                      ["E-Mail verifiziert", "28. Apr. 2026 · 08:09:33 UTC"],
                    ] as const).map(([k, v], i) => (
                      <div key={i}>
                        <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{k}</p>
                        <p className="font-semibold text-slate-900 font-mono text-[11.5px]">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                    <span className="text-[11px] font-semibold">Vertrag rechtsgültig unterzeichnet · Alle Parteien verifiziert</span>
                  </div>
                </div>
              </section>
            </>
          )}

          {/* Buchungsübersicht */}
          {myTxs.length > 0 && (
            <section className="px-7 py-5 border-b border-slate-100">
              <SectionHeader title="Buchungsübersicht" />
              <TransactionTimeline transactions={myTxs} />
            </section>
          )}

          {!isZV1 && investment.description && (
            <section className="px-7 py-5">
              <p className="text-[13px] text-slate-600 leading-relaxed">{investment.description}</p>
            </section>
          )}

          <div className="px-7 py-6 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Schwarzott Capital Partners AG · Löwenstrasse 20, 8001 Zürich · CHE-102.119.428
            </p>
          </div>
        </div>
      </div>
      <style>{`@keyframes slideInRight{from{transform:translateX(100%)}to{transform:none}}`}</style>
    </>
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
      <div className="scp-card p-6 sm:p-8 flex flex-col items-center">
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
      <div className="scp-card p-6 sm:p-8">
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
                        <span className={`w-3.5 h-3.5 rounded-full ${done ? "bg-[#B8923A]" : "bg-slate-200"} ${current ? "ring-4 ring-amber-100" : ""}`} />
                        {i < CARD_STATUS_STEPS.length - 1 && <span className={`w-px h-6 ${i < activeStepIndex ? "bg-[#B8923A]" : "bg-slate-200"}`} />}
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
                <input value={form.cardholderName} onChange={(e) => set("cardholderName", e.target.value)} className="scp-input" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Straße & Hausnummer</span>
                <input value={form.shippingStreet} onChange={(e) => set("shippingStreet", e.target.value)} className="scp-input" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">PLZ</span>
                  <input value={form.shippingZip} onChange={(e) => set("shippingZip", e.target.value)} className="scp-input" />
                </label>
                <label className="block col-span-2">
                  <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Ort</span>
                  <input value={form.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} className="scp-input" />
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
function BenefitsTab({ tier, activeBenefits, onOpenBenefit }: {
  tier: InvestorTier; activeBenefits: BenefitRow[]; onOpenBenefit: (key: string) => void;
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
          <h2 className="text-[24px] sm:text-[26px] font-bold mt-1">{tierDef.label}</h2>
          <p className="text-[13px] opacity-90 mt-1 max-w-md">{tierDef.tagline}</p>
          <p className="text-[12px] opacity-80 mt-3">{activeKeys.size} {activeKeys.size === 1 ? "Leistung" : "Leistungen"} freigeschaltet · tippen Sie eine Leistung an, um sie zu nutzen</p>
        </div>
      </section>

      {/* benefits grid */}
      <div className="grid sm:grid-cols-2 gap-4">
        {BENEFITS.map((b) => {
          const active = activeKeys.has(b.key);
          const note = noteByKey[b.key];
          const svc = BENEFIT_SERVICE[b.key];
          return (
            <button key={b.key} type="button" disabled={!active}
              onClick={() => active && onOpenBenefit(b.key)}
              className={`group text-left rounded-2xl border p-5 transition-all ${active ? "bg-white border-slate-100 shadow-sm hover:border-[#d4af6a]/60 hover:shadow-md cursor-pointer" : "bg-slate-50/60 border-slate-100 cursor-not-allowed"}`}>
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={active
                    ? { background: "rgba(184,146,58,.1)", border: "1px solid rgba(184,146,58,.25)", color: "#B8923A" }
                    : { background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#94a3b8" }}>
                  <Icon name={benefitIconFor(b.key)} size={20} strokeWidth={1.6} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`text-[15px] font-bold ${active ? "text-slate-900" : "text-slate-400"}`}>{b.title}</h3>
                    {active ? (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Aktiv</span>
                    ) : (
                      <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-400">Gesperrt</span>
                    )}
                  </div>
                  <p className={`text-[12.5px] mt-1 leading-relaxed ${active ? "text-slate-500" : "text-slate-400"}`}>{b.description}</p>
                  {active && note && <p className="text-[12px] mt-2 text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{note}</p>}
                  {active && (
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#B8923A" }}>
                      {svc?.isCard ? "Karte verwalten" : svc?.actionLabel || "Details ansehen"}
                      <Icon name="arrowRight" size={13} strokeWidth={2} className="group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  )}
                </div>
              </div>
            </button>
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

/* ──────────────────────────────────────────────────────────
   BENEFIT DETAIL DRAWER — history, quota & booking per benefit
   ────────────────────────────────────────────────────────── */
function BenefitDetailDrawer({ benefitKey, onClose }: { benefitKey: string; onClose: () => void }) {
  const def = BENEFIT_MAP[benefitKey];
  const svc = BENEFIT_SERVICE[benefitKey];
  const [activity, setActivity] = useState<BenefitActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/investor/benefits/${benefitKey}/activity`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) setActivity(d.activity || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [benefitKey]);

  const now = Date.now();
  const thisYear = new Date().getFullYear();
  const usedThisYear = activity.filter((a) => a.status !== "cancelled" && new Date(a.created_at).getFullYear() === thisYear).length;
  const quota = svc?.quotaPerYear;
  const remaining = quota != null ? Math.max(0, quota - usedThisYear) : null;

  const isUpcoming = (a: BenefitActivity) =>
    (a.status === "proposed" || a.status === "requested" || a.status === "confirmed") &&
    (!a.scheduled_at || new Date(a.scheduled_at).getTime() >= now - 12 * 60 * 60 * 1000);
  const upcoming = activity.filter(isUpcoming);
  const past = activity.filter((a) => !isUpcoming(a));

  const submit = async () => {
    setError(null);
    if (!title.trim()) { setError("Bitte geben Sie einen Betreff an."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/investor/benefits/${benefitKey}/activity`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: svc?.kind || "request", title: title.trim(), details: details.trim() || null, scheduledAt: scheduledAt || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error || "Anfrage fehlgeschlagen"); return; }
      setTitle(""); setDetails(""); setScheduledAt(""); setShowForm(false);
      setToast("Ihre Anfrage wurde übermittelt – wir melden uns bei Ihnen.");
      setTimeout(() => setToast(null), 3500);
      await load();
    } catch { setError("Verbindungsfehler."); }
    finally { setBusy(false); }
  };

  const cancel = async (id: number) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/investor/benefit-activity/${id}/cancel`, { method: "POST", credentials: "include" });
      if (r.ok) await load();
    } catch {} finally { setBusy(false); }
  };

  const respond = async (id: number, action: "accept" | "decline") => {
    setBusy(true);
    try {
      const r = await fetch(`/api/investor/benefit-activity/${id}/respond`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        setToast(action === "accept"
          ? "Verbindlich gebucht. Ihre Tickets stehen in Kürze in der App zum Download bereit."
          : "Vorschlag abgelehnt. Ihr Reisemanagement meldet sich mit einer Alternative.");
        setTimeout(() => setToast(null), 4500);
        await load();
      }
    } catch {} finally { setBusy(false); }
  };

  const fmtWhen = (a: BenefitActivity) => fmtDate(a.scheduled_at || a.created_at);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#0D1B3E]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#F7F5EF] overflow-hidden"
        style={{ width: "min(560px,100vw)", boxShadow: "-20px 0 60px rgba(0,0,0,.25)", animation: "slideInRight .3s cubic-bezier(.4,0,.2,1)" }}>
        {/* Header */}
        <div className="shrink-0 px-6 sm:px-7 pt-7 pb-6 relative overflow-hidden" style={{ background: "linear-gradient(160deg,#0D1B3E 0%,#142248 100%)" }}>
          <div className="absolute -top-16 -right-8 w-52 h-52 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#B8923A,transparent 70%)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(184,146,58,.15)", border: "1px solid rgba(184,146,58,.3)", color: "#d4af6a" }}>
                  <Icon name={benefitIconFor(benefitKey)} size={22} strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] mb-1" style={{ color: "#B8923A" }}>Circle Leistung</p>
                  <h2 className="text-[18px] font-bold text-white leading-snug">{def?.title || benefitKey}</h2>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0">
                <Icon name="x" size={16} strokeWidth={2} />
              </button>
            </div>
            <p className="text-[12.5px] mt-3 leading-relaxed" style={{ color: "rgba(255,255,255,.7)" }}>{svc?.intro || def?.description}</p>

            {quota != null && (
              <div className="mt-4 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex items-center justify-between text-[12px]">
                  <span style={{ color: "rgba(255,255,255,.7)" }}>{svc?.quotaUnit} {thisYear}</span>
                  <span className="font-bold text-white">{remaining} von {quota} verfügbar</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.12)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (usedThisYear / quota) * 100)}%`, background: "linear-gradient(90deg,#d4af6a,#B8923A)" }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scp-scroll px-5 sm:px-7 py-5 space-y-5">
          {/* Action / booking form */}
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold text-[#0D1B3E] transition-all hover:brightness-105 active:scale-[.99]"
              style={{ background: "linear-gradient(135deg,#d4af6a,#B8923A)", boxShadow: "0 10px 28px -12px rgba(184,146,58,.7)" }}>
              <Icon name="plus" size={17} strokeWidth={2} /> {svc?.actionLabel || "Anfrage stellen"}
            </button>
          ) : (
            <div className="scp-card p-5 space-y-3.5 scp-fade-up">
              <div className="flex items-center justify-between">
                <h4 className="text-[14px] font-bold text-slate-900">{svc?.actionLabel}</h4>
                <button onClick={() => { setShowForm(false); setError(null); }} className="text-slate-400 hover:text-slate-700"><Icon name="x" size={16} strokeWidth={2} /></button>
              </div>

              {svc?.presets && svc.presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {svc.presets.map((p) => (
                    <button key={p} onClick={() => setTitle(p)}
                      className={`text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${title === p ? "text-white border-transparent" : "text-slate-600 border-slate-200 hover:border-[#d4af6a]"}`}
                      style={title === p ? { background: "#0D1B3E" } : undefined}>{p}</button>
                  ))}
                </div>
              )}

              <div>
                <label className="scp-label">{svc?.titleLabel || "Betreff"}</label>
                <input className="scp-input" placeholder={svc?.titlePlaceholder} value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              {svc?.withDate && (
                <div>
                  <label className="scp-label">Wunschtermin</label>
                  <input type="date" className="scp-input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
                </div>
              )}

              <div>
                <label className="scp-label">Details (optional)</label>
                <textarea className="scp-input" rows={3} placeholder={svc?.detailsPlaceholder} value={details} onChange={(e) => setDetails(e.target.value)} />
              </div>

              {error && <p className="text-[12.5px] text-rose-600 font-medium">{error}</p>}

              <button onClick={submit} disabled={busy}
                className="w-full py-3 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#0D1B3E,#1d2f5a)" }}>
                {busy ? "Wird übermittelt…" : "Anfrage absenden"}
              </button>
              <p className="text-[10.5px] text-slate-400 text-center">Unverbindliche Anfrage · jede Anfrage wird persönlich geprüft.</p>
            </div>
          )}

          {toast && (
            <div className="rounded-xl px-4 py-3 text-[12.5px] font-medium flex items-center gap-2" style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.25)", color: "#047857" }}>
              <Icon name="check" size={15} strokeWidth={2} /> {toast}
            </div>
          )}

          {/* Upcoming */}
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <SectionHeader title="Anstehend" />
                  <div className="space-y-2.5">
                    {upcoming.map((a) => (
                      <BenefitActivityRow key={a.id} a={a} when={fmtWhen(a)} onCancel={() => cancel(a.id)} onRespond={(act) => respond(a.id, act)} busy={busy} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <SectionHeader title="Verlauf" />
                {past.length === 0 && upcoming.length === 0 ? (
                  <div className="scp-card py-10 text-center text-[13px] text-slate-400">{svc?.emptyHint || "Noch keine Aktivität."}</div>
                ) : past.length === 0 ? (
                  <p className="text-[12.5px] text-slate-400">Noch kein abgeschlossener Vorgang.</p>
                ) : (
                  <div className="space-y-2.5">
                    {past.map((a) => (
                      <BenefitActivityRow key={a.id} a={a} when={fmtWhen(a)} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function BenefitActivityRow({ a, when, onCancel, onRespond, busy }: { a: BenefitActivity; when: string; onCancel?: () => void; onRespond?: (action: "accept" | "decline") => void; busy?: boolean }) {
  const st = ACTIVITY_STATUS[a.status] || ACTIVITY_STATUS.requested;
  const [confirming, setConfirming] = useState(false);
  const isProposal = a.status === "proposed";
  return (
    <div className={`scp-card p-4 ${isProposal ? "ring-1 ring-[#B8923A]/40" : ""}`}
      style={isProposal ? { background: "linear-gradient(160deg,#fffdf8,#fbf6ea)" } : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-slate-900">{a.title}</p>
          {a.details && <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed whitespace-pre-line">{a.details}</p>}
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <Icon name="calendar" size={12} strokeWidth={1.7} /> {when}
          </p>
        </div>
        <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${st.cls}`}>{st.label}</span>
      </div>

      {isProposal && onRespond && (
        <div className="mt-3.5 pt-3.5 border-t border-[#B8923A]/20">
          {!confirming ? (
            <div className="flex items-center gap-2.5">
              <button onClick={() => setConfirming(true)} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold text-[#0D1B3E] transition-all hover:brightness-105 active:scale-[.99] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#d4af6a,#B8923A)", boxShadow: "0 8px 22px -12px rgba(184,146,58,.7)" }}>
                <Icon name="check" size={15} strokeWidth={2} /> Annehmen
              </button>
              <button onClick={() => onRespond("decline")} disabled={busy}
                className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50 transition-colors">
                Ablehnen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg px-3.5 py-3 text-[12px] leading-relaxed" style={{ background: "rgba(184,146,58,.1)", border: "1px solid rgba(184,146,58,.25)", color: "#6b541a" }}>
                Mit Ihrer Bestätigung wird die Reise <span className="font-semibold">verbindlich zu den genannten Daten gebucht</span>. Ihre Tickets stehen anschließend direkt hier in der App zum Download bereit.
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={() => onRespond("accept")} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#0D1B3E,#1d2f5a)" }}>
                  {busy ? "Wird gebucht…" : "Verbindlich buchen"}
                </button>
                <button onClick={() => setConfirming(false)} disabled={busy}
                  className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50 transition-colors">
                  Zurück
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {onCancel && (a.status === "requested" || a.status === "confirmed") && (
        <button onClick={onCancel} disabled={busy}
          className="mt-3 text-[12px] font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50 transition-colors">
          Stornieren
        </button>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   KONTO / ACCOUNT TAB — profile editing + password change
   ────────────────────────────────────────────────────────── */
function AccountTab({ investor, onUpdated }: { investor: Investor | null; onUpdated: (inv: Investor) => void }) {
  const [profile, setProfile] = useState({
    salutation: investor?.salutation || "",
    phone: investor?.phone || "",
    street: investor?.street || "",
    zip: investor?.zip || "",
    city: investor?.city || "",
    country: investor?.country || "",
  });
  const [pSaving, setPSaving] = useState(false);
  const [pMsg, setPMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const setP = (k: string, v: string) => setProfile((s) => ({ ...s, [k]: v }));

  const saveProfile = async () => {
    setPSaving(true); setPMsg(null);
    try {
      const r = await fetch("/api/investor/profile", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setPMsg({ ok: false, text: d.error || "Speichern fehlgeschlagen" }); return; }
      onUpdated(d.investor);
      setPMsg({ ok: true, text: "Ihre Daten wurden aktualisiert." });
    } catch { setPMsg({ ok: false, text: "Verbindungsfehler." }); }
    finally { setPSaving(false); }
  };

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const setPwField = (k: string, v: string) => setPw((s) => ({ ...s, [k]: v }));

  const changePassword = async () => {
    setPwMsg(null);
    if (pw.next.length < 8) { setPwMsg({ ok: false, text: "Das neue Passwort muss mindestens 8 Zeichen lang sein." }); return; }
    if (pw.next !== pw.confirm) { setPwMsg({ ok: false, text: "Die neuen Passwörter stimmen nicht überein." }); return; }
    setPwSaving(true);
    try {
      const r = await fetch("/api/investor/change-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setPwMsg({ ok: false, text: d.error || "Änderung fehlgeschlagen" }); return; }
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: true, text: "Ihr Passwort wurde erfolgreich geändert." });
    } catch { setPwMsg({ ok: false, text: "Verbindungsfehler." }); }
    finally { setPwSaving(false); }
  };

  const tier: InvestorTier = (investor?.tier as InvestorTier) || "standard";
  const identity = [
    { l: "Investor-ID", v: investor?.id || "—" },
    { l: "Name", v: `${investor?.salutation ? investor.salutation + " " : ""}${investor?.first_name || ""} ${investor?.last_name || ""}`.trim() },
    { l: "E-Mail", v: investor?.email || "—" },
    { l: "Unternehmen", v: investor?.company || "—" },
    { l: "Mitgliedschaft", v: TIERS[tier].label },
    { l: "Auszahlungs-IBAN", v: investor?.iban || "—" },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_1fr] gap-6 items-start scp-fade-up">
      {/* Identität (read-only) */}
      <div className="scp-card p-6 sm:p-7 lg:col-span-2">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="shield" size={18} className="text-[#B8923A]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#0D1B3E" }}>Ihre Stammdaten</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {identity.map((x) => (
            <div key={x.l} className="min-w-0">
              <p className="scp-label">{x.l}</p>
              <p className="text-[13.5px] font-semibold truncate" style={{ color: "#0D1B3E" }}>{x.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-5 pt-4 border-t" style={{ borderColor: "#ECE7DC" }}>
          Name, E-Mail und IBAN sind aus Sicherheitsgründen gesperrt. Änderungen veranlasst Ihr persönlicher Betreuer.
        </p>
      </div>

      {/* Kontaktdaten bearbeiten */}
      <div className="scp-card p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="edit" size={17} className="text-[#B8923A]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#0D1B3E" }}>Kontaktdaten</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="scp-label">Anrede</label>
              <select className="scp-input" value={profile.salutation} onChange={(e) => setP("salutation", e.target.value)}>
                <option value="">—</option>
                <option value="Herr">Herr</option>
                <option value="Frau">Frau</option>
                <option value="Divers">Divers</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="scp-label">Telefon</label>
              <input className="scp-input" value={profile.phone} onChange={(e) => setP("phone", e.target.value)} placeholder="+971 …" />
            </div>
          </div>
          <div>
            <label className="scp-label">Straße & Hausnummer</label>
            <input className="scp-input" value={profile.street} onChange={(e) => setP("street", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="scp-label">PLZ</label>
              <input className="scp-input" value={profile.zip} onChange={(e) => setP("zip", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="scp-label">Ort</label>
              <input className="scp-input" value={profile.city} onChange={(e) => setP("city", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="scp-label">Land</label>
            <input className="scp-input" value={profile.country} onChange={(e) => setP("country", e.target.value)} />
          </div>
          {pMsg && (
            <div className={`flex items-center gap-2 text-[12.5px] font-medium rounded-xl px-3.5 py-2.5 ${pMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {pMsg.ok && <Icon name="check" size={15} />}{pMsg.text}
            </div>
          )}
          <button onClick={saveProfile} disabled={pSaving}
            className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#0D1B3E,#1d2f5a)" }}>
            {pSaving ? "Wird gespeichert…" : "Änderungen speichern"}
          </button>
        </div>
      </div>

      {/* Passwort ändern */}
      <div className="scp-card p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="lock" size={17} className="text-[#B8923A]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#0D1B3E" }}>Passwort ändern</h3>
        </div>
        <p className="text-[12.5px] text-slate-400 mb-5">Wählen Sie ein sicheres Passwort mit mindestens 8 Zeichen.</p>
        <div className="space-y-4">
          <div>
            <label className="scp-label">Aktuelles Passwort</label>
            <input type="password" className="scp-input" value={pw.current} onChange={(e) => setPwField("current", e.target.value)} autoComplete="current-password" />
          </div>
          <div>
            <label className="scp-label">Neues Passwort</label>
            <input type="password" className="scp-input" value={pw.next} onChange={(e) => setPwField("next", e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className="scp-label">Neues Passwort bestätigen</label>
            <input type="password" className="scp-input" value={pw.confirm} onChange={(e) => setPwField("confirm", e.target.value)} autoComplete="new-password" />
          </div>
          {pwMsg && (
            <div className={`flex items-center gap-2 text-[12.5px] font-medium rounded-xl px-3.5 py-2.5 ${pwMsg.ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {pwMsg.ok && <Icon name="check" size={15} />}{pwMsg.text}
            </div>
          )}
          <button onClick={changePassword} disabled={pwSaving || !pw.current || !pw.next}
            className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#B8923A,#9a7a2e)" }}>
            {pwSaving ? "Wird geändert…" : "Passwort aktualisieren"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   GREETING OVERLAY — magical welcome on login
   ────────────────────────────────────────────────────────── */
function GreetingOverlay({ investor, summary, contractualReturnCents, contractualRatePct, nextMaturityStr, pendingDepositsCents, onClose }: {
  investor: Investor;
  summary: Summary | null;
  contractualReturnCents: number;
  contractualRatePct: number;
  nextMaturityStr: string;
  pendingDepositsCents: number;
  onClose: () => void;
}) {
  const h = new Date().getHours();
  const greeting = h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
  const lastName = `${investor.salutation ? investor.salutation + " " : ""}${investor.last_name}`.trim();

  const lines = [
    { l: "Aktueller Portfolio-Wert", v: eur2(summary?.currentValueCents ?? 0) },
    { l: "Investiertes Kapital", v: eur2(summary?.totalInvestedCents ?? 0) },
    { l: "Vertragliche Gesamtrendite", v: eur2(contractualReturnCents), sub: contractualRatePct ? `${contractualRatePct} % p.a. · fällig ${nextMaturityStr}` : undefined },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(13,27,62,.55)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[480px] rounded-3xl overflow-hidden scp-fade-up"
        style={{ background: "linear-gradient(165deg,#0D1B3E 0%,#15244a 60%,#0D1B3E 100%)", boxShadow: "0 40px 90px -25px rgba(0,0,0,.7)" }}>
        <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full opacity-25" style={{ background: "radial-gradient(circle,#B8923A,transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(184,146,58,.8),transparent)" }} />
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <Icon name="x" size={16} strokeWidth={2} />
        </button>

        <div className="relative z-[1] p-8 sm:p-9">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ background: "rgba(184,146,58,.12)", border: "1px solid rgba(184,146,58,.3)" }}>
            <Icon name="sparkle" size={13} className="text-[#d4af6a]" strokeWidth={1.8} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[.18em]" style={{ color: "#d4af6a" }}>Private Banking</span>
          </div>

          <h2 className="font-display text-[26px] sm:text-[30px] font-semibold text-white leading-tight">
            {greeting}, {lastName}.
          </h2>
          <p className="text-[13.5px] text-white/60 mt-2 leading-relaxed">
            Schön, dass Sie sich einloggen. Ein Überblick über Ihre Investitionen bei der Schwarzott Capital Partners AG:
          </p>

          <div className="mt-6 space-y-3">
            {lines.map((x) => (
              <div key={x.l} className="flex items-center justify-between gap-4 pb-3 border-b border-white/10 last:border-0">
                <p className="text-[12.5px] text-white/55">{x.l}</p>
                <div className="text-right">
                  <p className="font-display text-[17px] font-semibold text-white tabular-nums">{x.v}</p>
                  {x.sub && <p className="text-[10px] font-semibold" style={{ color: "#d4af6a" }}>{x.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {pendingDepositsCents > 0 && (
            <div className="mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px]" style={{ background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.22)", color: "#fcd34d" }}>
              <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
              <span>{eur2(pendingDepositsCents)} aus Tranche 2 sind in Prüfung und werden nach Bestätigung Ihrem Portfolio gutgeschrieben.</span>
            </div>
          )}

          <button onClick={onClose}
            className="w-full mt-7 py-3.5 rounded-xl text-[14px] font-semibold text-[#0D1B3E] transition-all hover:brightness-105"
            style={{ background: "linear-gradient(135deg,#d4af6a,#B8923A)" }}>
            Zu meinem Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   REQUEST MODAL — deposit top-up / withdrawal (manual review)
   ────────────────────────────────────────────────────────── */
function RequestModal({ type, investments, summary, contractualRatePct, onClose }: {
  type: "deposit" | "withdrawal";
  investments: Investment[];
  summary: Summary | null;
  contractualRatePct: number;
  onClose: () => void;
}) {
  void summary;
  const isDeposit = type === "deposit";
  const activeInvestments = investments.filter((i) => i.status === "active");
  const [investmentId, setInvestmentId] = useState<number | "">(activeInvestments[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const amt = Math.round(parseFloat(amount.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(amt) || amt <= 0) { setError("Bitte geben Sie einen gültigen Betrag ein."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/investor/requests", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: type, investmentId: investmentId || null, amountCents: amt, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setError(d.error || "Anfrage fehlgeschlagen"); return; }
      setDone(true);
    } catch { setError("Verbindungsfehler."); }
    finally { setBusy(false); }
  };

  const accent = isDeposit ? "#B8923A" : "#0D1B3E";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(13,27,62,.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[460px] bg-white rounded-3xl overflow-hidden scp-fade-up" style={{ boxShadow: "0 40px 90px -25px rgba(0,0,0,.5)" }}>
        <div className="px-7 pt-7 pb-5" style={{ background: "linear-gradient(160deg,#0D1B3E,#15244a)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}>
                <Icon name={isDeposit ? "plus" : "withdraw"} size={19} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: "#d4af6a" }}>{isDeposit ? "Einzahlung" : "Auszahlung"}</p>
                <h2 className="font-display text-[19px] font-semibold text-white leading-tight">{isDeposit ? "Kapital erhöhen" : "Auszahlung anfragen"}</h2>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="p-7">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(16,185,129,.1)", color: "#059669" }}>
                <Icon name="check" size={26} strokeWidth={2.2} />
              </div>
              <h3 className="font-display text-[19px] font-semibold" style={{ color: "#0D1B3E" }}>Anfrage übermittelt</h3>
              <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                Ihre {isDeposit ? "Einzahlungs-" : "Auszahlungs-"}anfrage wurde sicher übermittelt. Unser Team prüft sie persönlich und meldet sich zeitnah bei Ihnen.
                Es wird nichts automatisch ausgeführt.
              </p>
              <button onClick={onClose} className="w-full mt-6 py-3.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: "linear-gradient(135deg,#0D1B3E,#1d2f5a)" }}>Schließen</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[12.5px] text-slate-500 leading-relaxed">
                {isDeposit
                  ? "Erhöhen Sie Ihr Investment. Ihre Anfrage wird von unserem Team geprüft – Sie erhalten anschließend die Zahlungsdetails. Nichts wird automatisch ausgeführt."
                  : "Falls Sie kurzfristig auf Ihr Kapital zugreifen möchten, stellen Sie hier eine Anfrage. Wir prüfen diese individuell und melden uns persönlich bei Ihnen."}
              </p>

              {activeInvestments.length > 0 && (
                <div>
                  <label className="scp-label">Vertrag</label>
                  <select className="scp-input" value={investmentId} onChange={(e) => setInvestmentId(e.target.value ? Number(e.target.value) : "")}>
                    {activeInvestments.map((inv) => (
                      <option key={inv.id} value={inv.id}>{inv.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="scp-label">{isDeposit ? "Gewünschter Einzahlungsbetrag" : "Gewünschter Auszahlungsbetrag"} (EUR)</label>
                <input className="scp-input" inputMode="decimal" placeholder="z. B. 25.000" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>

              <div>
                <label className="scp-label">Nachricht (optional)</label>
                <textarea className="scp-input" rows={3} placeholder={isDeposit ? "Anmerkungen zu Ihrer Aufstockung…" : "Grund / gewünschter Zeitpunkt…"} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>

              {isDeposit && contractualRatePct > 0 && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px] text-slate-600" style={{ background: "rgba(184,146,58,.08)", border: "1px solid rgba(184,146,58,.2)" }}>
                  <Icon name="sparkle" size={14} className="mt-0.5 shrink-0 text-[#B8923A]" strokeWidth={1.8} />
                  <span>Zusätzliches Kapital wird zu Ihren bestehenden Konditionen von {contractualRatePct} % p.a. verzinst – vorbehaltlich Prüfung und Freigabe.</span>
                </div>
              )}

              {error && <p className="text-[12.5px] text-rose-600 font-medium">{error}</p>}

              <button onClick={submit} disabled={busy}
                className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: isDeposit ? "linear-gradient(135deg,#d4af6a,#B8923A)" : "linear-gradient(135deg,#0D1B3E,#1d2f5a)", color: isDeposit ? "#0D1B3E" : "#fff" }}>
                {busy ? "Wird übermittelt…" : isDeposit ? "Einzahlung anfragen" : "Auszahlung prüfen lassen"}
              </button>
              <p className="text-[10.5px] text-slate-400 text-center" style={{ color: accent === "#0D1B3E" ? undefined : undefined }}>
                Sichere, unverbindliche Anfrage · jede Anfrage wird manuell geprüft.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   SYNC BANNER — 24-hour contract synchronisation notice
   ────────────────────────────────────────────────────────── */
function SyncBanner({ timeLeft, onDismiss }: { timeLeft: number; onDismiss: () => void }) {
  const h = Math.floor(timeLeft / 3_600_000);
  const m = Math.floor((timeLeft % 3_600_000) / 60_000);
  const s = Math.floor((timeLeft % 60_000) / 1_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const countdown = `${pad(h)}:${pad(m)}:${pad(s)}`;
  const progressPct = ((24 * 3_600_000 - timeLeft) / (24 * 3_600_000)) * 100;

  return (
    <div className="relative w-full scp-fade-up overflow-hidden" style={{ background: "linear-gradient(90deg,#0D1B3E 0%,#162040 60%,#0D1B3E 100%)", borderBottom: "1px solid rgba(184,146,58,.25)" }}>
      {/* progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px]" style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#d4af6a,#B8923A)", transition: "width 1s linear" }} />

      <div className="max-w-[1180px] mx-auto px-5 sm:px-8 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(184,146,58,.15)", border: "1px solid rgba(184,146,58,.25)" }}>
          <Icon name="clock" size={14} className="text-[#d4af6a]" strokeWidth={1.6} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-3">
          <p className="text-[12.5px] font-semibold text-white shrink-0">Vertrags-Synchronisation läuft</p>
          <p className="text-[11.5px] truncate" style={{ color: "rgba(255,255,255,.55)" }}>
            Wir übertragen aktuell Ihre Verträge in das System – dieser Vorgang kann bis zu 24 Std. dauern.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[.1em]" style={{ color: "rgba(184,146,58,.7)" }}>Verbleibend</span>
            <span className="font-mono text-[12.5px] font-semibold" style={{ color: "#d4af6a" }}>{countdown}</span>
          </div>
          <button onClick={onDismiss} className="w-6 h-6 flex items-center justify-center rounded-full transition-colors hover:bg-white/10" style={{ color: "rgba(255,255,255,.4)" }} aria-label="Schließen">
            <Icon name="x" size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
