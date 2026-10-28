import { useEffect, useState } from "react";
import {
  TIERS, BENEFITS, BENEFIT_MAP, CARD_PRICE_EUR, CARD_DESIGNS,
  CARD_STATUS_LABEL, CARD_STATUS_STEPS, type InvestorTier, type CardDesign,
} from "@/lib/investorProgram";
import "@/styles/investor-glas.css";

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
interface TokenAllocation { label: string; note?: string; tokens: number; }
interface TokenMeta {
  contractRef?: string; signedDate?: string; signedLocation?: string;
  blockchain?: string; tokenStandard?: string; walletAddress?: string;
  allocations?: TokenAllocation[];
  vertrag?: VertragsDaten;
}
// E-446: Vertragsdetails je Anlage stehen in der Datenbank (investor_investments.token_meta.vertrag) und
// kommen nur nach der Anmeldung zum Investor — nie als fester Text in diesen öffentlich ausgelieferten Code.
interface VertragsDaten {
  titel?: string;
  parteien?: { label: string; name: string; details?: string }[];
  positionen?: { pos: string; sub?: string; val: string }[];
  summe?: { label: string; val: string };
  konditionen?: { l: string; v: string }[];
  hinweis?: string;
  vorzuege?: string[];
  sicherheiten?: { t: string; tx: string }[];
  konto?: [string, string][];
  unterzeichnung?: [string, string][];
}
interface Investment {
  id: number; name: string; investment_type: string;
  principal_cents: number; current_value_cents: number | null; currency: string;
  interest_rate: number | null; status: string;
  start_date: string | null; maturity_date: string | null;
  payout_frequency: string | null; description: string | null;
  token_quantity: number | null; token_purchase_price_cents: number | null; token_current_price_cents: number | null;
  token_meta?: TokenMeta | null;
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
  equity: "Beteiligung", bond: "Anleihe", loan: "Darlehen", fund: "Fonds", real_estate: "Immobilie", token: "🪙 Token", other: "Sonstiges",
};
const tokenBadge = (name: string) => (name.toUpperCase().includes("ARAS") ? "ARAS Token" : "Token");
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: "Aktiv", cls: "bg-emerald-50 text-emerald-700" },
  matured: { label: "Fällig", cls: "bg-[#12284a]/8 text-[#12284a]" },
  pending: { label: "Ausstehend", cls: "bg-[#288DFA]/12 text-[#1D4ED8]" },
  cancelled: { label: "Beendet", cls: "bg-slate-100 text-slate-500" },
};
const TX_LABEL: Record<string, { label: string; sign: number; cls: string }> = {
  deposit: { label: "Einzahlung", sign: 1, cls: "text-slate-800" },
  interest: { label: "Zinsen / Rendite", sign: 1, cls: "text-emerald-600" },
  payout: { label: "Auszahlung", sign: 1, cls: "text-emerald-600" },
  fee: { label: "Gebühr", sign: -1, cls: "text-[#12284a]" },
  withdrawal: { label: "Entnahme", sign: -1, cls: "text-[#12284a]" },
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
  proposed: { label: "Bestätigung offen", cls: "bg-[#288DFA]/15 text-[#1D4ED8]" },
  requested: { label: "Angefragt", cls: "bg-[#288DFA]/12 text-[#1D4ED8]" },
  confirmed: { label: "Bestätigt", cls: "bg-emerald-50 text-emerald-700" },
  completed: { label: "Abgeschlossen", cls: "bg-[#12284a]/8 text-[#12284a]" },
  declined: { label: "Abgelehnt", cls: "bg-[#12284a]/8 text-[#12284a]" },
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
                  {pending && <span className="text-[10px] font-semibold text-[#1D4ED8]">geplant</span>}
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
  const [benefitDrawer, setBenefitDrawer] = useState<string | null>(null);

  useEffect(() => {
    if (investor && !sessionStorage.getItem("scp-greeted")) {
      setShowGreeting(true);
      sessionStorage.setItem("scp-greeted", "1");
    }

    // E-446: Das frühere „Vertrags-Synchronisation läuft“-Banner war nur ein Zeitzähler im Browser
    // ohne echten Vorgang dahinter — entfernt; den alten Merker räumen wir weg.
    try { localStorage.removeItem("scp-sync-start"); } catch { /* privat */ }
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
        <div className="w-8 h-8 border-2 border-slate-200 rounded-full animate-spin" style={{ borderTopColor: "#288DFA" }} />
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
    <div className="ib-glas">
      {/* ═══ KOPF: schwebende Glaspille (klebt nicht) ═══ */}
      <header className="ib-kopf">
        <div className="ib-kopf-innen">
          <div className="ib-marke">
            <div className="ib-marke-zeichen" aria-hidden="true">S</div>
            <div className="min-w-0">
              <p className="ib-marke-name">Schwarzott Capital Partners</p>
              <p className="ib-marke-zeile">Private Banking</p>
            </div>
            {investor?.is_demo && (
              <span className="ib-stufe !text-[#1D4ED8] !bg-[#e8f1ff] !border-[#cfe1ff] ml-1 shrink-0"><i />Demo</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setTab("account")} className={`ib-person ${tab === "account" ? "an" : ""}`}>
              <div className="hidden sm:block text-right leading-tight">
                <p className="text-[12.5px] text-[#12284a]" style={{ fontWeight: 500 }}>{investor?.salutation ? investor.salutation + " " : ""}{investor?.first_name} {investor?.last_name}</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">{investor?.email}</p>
              </div>
              <div className="ib-avatar">{(investor?.first_name?.[0] || "I").toUpperCase()}</div>
            </button>
            <button onClick={logout} title="Abmelden" aria-label="Abmelden" className="ib-runder-knopf">
              <Icon name="logout" size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-7">
        {/* ═══ BÜHNE: die eine blaue Stelle, eine große dünne Zahl ═══ */}
        <section className="ib-buehne">
          <div className="ib-buehne-zeile">
            <p className="ib-augenzeile">Aktueller Portfolio-Wert</p>
            <span className="ib-stufe"><i />{tierDef.label}</span>
          </div>
          <h1 className="ib-zahl">{eur(summary?.currentValueCents ?? 0)}</h1>
          <p className="ib-zahl-unter">{investor?.company?.trim() || `${investor?.first_name ?? ""} ${investor?.last_name ?? ""}`.trim()}</p>
          {pendingDepositsCents > 0 && (
            <div className="ib-offen"><i />{eur2(pendingDepositsCents)} ausstehend · wird nach Buchungsbestätigung ergänzt</div>
          )}
          <div className="ib-pillen">
            {([
              { label: "Investiertes Kapital", value: eur(summary?.totalInvestedCents ?? 0), goto: "investments" as const },
              { label: "Vertragl. Gesamtrendite", value: eur(contractualReturnCents), sub: contractualRatePct ? `${contractualRatePct} % p.a. · fällig ${nextMaturityStr}` : undefined, goto: "returns" as const },
              { label: "Ø Rendite p.a.", value: `${(summary?.avgYieldPct ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`, goto: "returns" as const },
              { label: "Aktive Investments", value: String(summary?.activeCount ?? 0), goto: "investments" as const },
            ]).map((s) => (
              <button key={s.label} onClick={() => setTab(s.goto)} className="ib-pille">
                <p className="ib-pille-l">{s.label}</p>
                <p className="ib-pille-v">{s.value}</p>
                {s.sub && <p className="ib-pille-s">{s.sub}</p>}
              </button>
            ))}
          </div>
          <div className="ib-aktionen">
            <button onClick={() => setRequestModal("deposit")} className="ib-knopf-hell">
              <Icon name="plus" size={17} strokeWidth={1.8} /> Kapital einzahlen
            </button>
            <button onClick={() => setRequestModal("withdrawal")} className="ib-knopf-klar">
              <Icon name="withdraw" size={17} strokeWidth={1.8} /> Auszahlung anfragen
            </button>
          </div>
        </section>

        {/* ═══ REITER ═══ */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scp-scroll">
          <div className="ib-reiter" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={tab === t.id ? "an" : ""}>
                <Icon name={t.icon} size={16} strokeWidth={1.6} />
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
                    <button onClick={() => setTab("investments")} className="mt-2 text-[12px] font-semibold hover:underline" style={{ color: "#288DFA" }}>Alle {investments.length} anzeigen</button>
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
                <div key={inv.id} onClick={() => setSelectedInvestment(inv)} className={`scp-card p-6 cursor-pointer hover:shadow-md transition-all `}>
                  <div className="flex items-start gap-3">
                    <div className="w-1 self-stretch rounded-full min-h-[44px]" style={{ background: isToken ? "linear-gradient(180deg,#A6D2FF,#288DFA)" : "linear-gradient(180deg,#4f9dff,#1D4ED8)" }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-[16px] font-bold text-slate-900 truncate">{inv.name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
                        {isToken && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e8f1ff] text-[#1D4ED8]">{tokenBadge(inv.name)}</span>}
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
                    <span className="text-[12px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#288DFA" }}>Herunterladen ↓</span>
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
          investor={investor}
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
      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: "#288DFA" }} />
      <p className="text-[10.5px] font-bold uppercase tracking-[.2em] text-slate-500">{title}</p>
    </div>
  );
}

function VertragsDetails({ v }: { v: VertragsDaten }) {
  return (
    <>
      {v.parteien?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title={v.titel ? `Vertragsparteien · ${v.titel}` : "Vertragsparteien"} />
          <div className="grid sm:grid-cols-2 gap-3">
            {v.parteien.map((p) => <InfoBox key={p.label} label={p.label} name={p.name} details={p.details || ""} />)}
          </div>
        </section>
      ) : null}
      {v.positionen?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Investment & Tranchen" />
          <div className="ib-tafel">
            {v.positionen.map((r, i) => (
              <div key={i} className="ib-tafel-zeile">
                <div className="min-w-0">
                  <p className="ib-tafel-pos">{r.pos}</p>
                  {r.sub && <p className="ib-tafel-sub">{r.sub}</p>}
                </div>
                <p className="ib-tafel-wert">{r.val}</p>
              </div>
            ))}
            {v.summe && (
              <div className="ib-tafel-zeile ib-tafel-summe">
                <p className="ib-tafel-pos">{v.summe.label}</p>
                <p className="ib-tafel-wert">{v.summe.val}</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
      {v.konditionen?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Konditionen & Laufzeit" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {v.konditionen.map((x) => (
              <div key={x.l} className="ib-kachel">
                <p className="ib-kachel-l">{x.l}</p>
                <p className="ib-kachel-v">{x.v}</p>
              </div>
            ))}
          </div>
          {v.hinweis && <p className="ib-hinweis mt-3">{v.hinweis}</p>}
        </section>
      ) : null}
      {v.vorzuege?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Status als Private Capital Partner" />
          <div className="space-y-2">
            {v.vorzuege.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12.5px] text-slate-700 py-1">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: "#288DFA" }} />
                {item}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {v.sicherheiten?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Verzinsung & Sicherheitsstruktur" />
          <div className="space-y-2.5">
            {v.sicherheiten.map((x, i) => (
              <div key={i} className="ib-kachel">
                <p className="ib-kachel-l">{x.t}</p>
                <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1">{x.tx}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {v.konto?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Auszahlungskonto" />
          <div className="ib-tafel">
            {v.konto.map(([k, val]) => (
              <div key={k} className="ib-tafel-zeile">
                <p className="ib-tafel-sub !mt-0">{k}</p>
                <p className="ib-tafel-wert font-mono">{val}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {v.unterzeichnung?.length ? (
        <section className="px-7 py-5 border-b border-slate-100">
          <SectionHeader title="Unterzeichnung" />
          <div className="grid grid-cols-2 gap-2.5">
            {v.unterzeichnung.map(([k, val]) => (
              <div key={k} className="ib-kachel">
                <p className="ib-kachel-l">{k}</p>
                <p className="ib-kachel-v font-mono text-[12px]">{val}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
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
  investor,
  onClose,
}: {
  investment: Investment;
  transactions: Transaction[];
  investor: Investor | null;
  onClose: () => void;
}) {
  const isToken = investment.investment_type === "token";
  const vertrag = !isToken ? investment.token_meta?.vertrag : undefined;
  const myTxs = transactions.filter((t) => t.investment_id === investment.id);
  const totalPayout = Math.round(investment.principal_cents * (1 + (investment.interest_rate ?? 0) / 100));
  const tokenCur = investment.current_value_cents ?? investment.principal_cents;
  const tokenGain = tokenCur - investment.principal_cents;
  const tokenGainPct = investment.principal_cents > 0 ? (tokenGain / investment.principal_cents) * 100 : 0;
  const eurFmt = (v: number) => v.toLocaleString("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });

  // ── token contract metadata (data-driven, per investor) ──
  const meta = investment.token_meta || {};
  const tokenName = (investment.name || "Token").replace(/^🪙\s*/, "");
  const tokenSymbol = tokenName.toUpperCase().includes("ARAS") ? "ARAS" : (tokenName.split(/\s+/)[0] || "Token").toUpperCase();
  const blockchain = meta.blockchain || "Arbitrum One";
  const tokenStandard = meta.tokenStandard || "ERC-20";
  const investorName = investor?.company?.trim() || `${investor?.first_name ?? ""} ${investor?.last_name ?? ""}`.trim() || "Investor";
  const investorDetailLines = [
    [investor?.street, [investor?.zip, investor?.city].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    investor?.country,
    investor?.company && (investor?.first_name || investor?.last_name) ? `Vertreten durch: ${[investor?.first_name, investor?.last_name].filter(Boolean).join(" ")}` : "",
  ].filter(Boolean).join("\n");
  const qtyNum = investment.token_quantity != null ? Number(investment.token_quantity) : null;
  const buyPrice = investment.token_purchase_price_cents != null ? investment.token_purchase_price_cents / 100 : null;
  // allocation rows: from metadata, else a single derived row
  const allocRows: TokenAllocation[] = meta.allocations?.length
    ? meta.allocations
    : qtyNum != null
      ? [{ label: "Token-Zuteilung", note: buyPrice != null ? `${eur2(investment.principal_cents)} ÷ ${eurFmt(buyPrice)} Zuteilungspreis` : undefined, tokens: qtyNum }]
      : [];
  const allocTotal = allocRows.reduce((s, r) => s + (r.tokens || 0), 0) || (qtyNum ?? 0);
  const signedStr = meta.signedDate
    ? `${fmtDate(meta.signedDate)}${meta.signedLocation ? " · " + meta.signedLocation : ""}`
    : (meta.signedLocation || null);

  const tokenHeaderKpis = isToken ? [
    { l: "Token-Gesamtzahl", v: investment.token_quantity != null ? Number(investment.token_quantity).toLocaleString("de-DE") + " " + tokenSymbol : "—" },
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
      <div className="fixed inset-0 z-40 bg-[#12284a]/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-white overflow-hidden"
        style={{ width: "min(720px,100vw)", boxShadow: "-20px 0 60px rgba(0,0,0,.25)", animation: "slideInRight .3s cubic-bezier(.4,0,.2,1)" }}
      >
        {/* Header */}
        <div className="shrink-0 px-7 pt-7 pb-6" style={{ background: "var(--ib-buehne)" }}>
          <div className="flex items-start justify-between mb-5">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[10px] font-bold uppercase tracking-[.3em] mb-1.5" style={{ color: "#A6D2FF" }}>
                {isToken ? `Token Purchase Agreement${meta.contractRef ? " · " + meta.contractRef : ""}` : `Investitionsvertrag · ${investment.currency}`}
              </p>
              <h2 className="text-[16px] font-bold text-white leading-snug">{investment.name}</h2>
              {isToken && <p className="text-[11px] mt-1" style={{ color: "rgba(166,210,255,0.7)" }}>{tokenStandard} · {blockchain} Blockchain</p>}
            </div>
            <button
              onClick={onClose}
              className="w-11 h-11 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {tokenHeaderKpis.map((x) => (
              <div key={x.l} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: "rgba(166,210,255,.7)" }}>{x.l}</p>
                <p className="text-[12.5px] font-bold text-white tabular-nums">{x.v}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── TOKEN DETAIL (data-driven per investor) ── */}
          {isToken && (
            <>
              {/* Vertragsparteien */}
              <section className="px-7 py-5 border-b border-slate-100">
                <SectionHeader title="Vertragsparteien" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <InfoBox
                    label="Emittentin"
                    name="Schwarzott Capital Partners AG"
                    details={"Schifflände 26, 8001 Zürich, Schweiz\nCHE-102.119.428\nVerwaltungsratspräsident: Justin Schwarzott"}
                  />
                  <InfoBox
                    label="Investor"
                    name={investorName}
                    details={investorDetailLines || "—"}
                  />
                </div>
              </section>

              {/* Token-Zuteilung */}
              {allocRows.length > 0 && (
                <section className="px-7 py-5 border-b border-slate-100">
                  <SectionHeader title={`Token-Zuteilung · Investment ${eur(investment.principal_cents)}`} />
                  <div className="rounded-xl overflow-hidden border border-slate-200">
                    <table className="w-full">
                      <tbody>
                        {allocRows.map((r, i) => (
                          <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                            <td className="px-4 py-3 text-[12.5px]">
                              <p className="font-semibold text-slate-900">{r.label}</p>
                              {r.note && <p className="text-[11px] text-slate-400 mt-0.5">{r.note}</p>}
                            </td>
                            <td className="px-4 py-3 text-right text-[13px] font-bold text-slate-900 tabular-nums whitespace-nowrap">{r.tokens.toLocaleString("de-DE")} {tokenSymbol}</td>
                          </tr>
                        ))}
                        <tr style={{ background: "linear-gradient(120deg,#13377f,#1f5bd0)" }}>
                          <td className="px-4 py-3 text-[13px] font-bold text-white">Gesamt-Zuteilung</td>
                          <td className="px-4 py-3 text-right text-[14px] font-bold tabular-nums whitespace-nowrap" style={{ color: "#A6D2FF" }}>{allocTotal.toLocaleString("de-DE")} {tokenSymbol} Token</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {buyPrice != null && (
                    <div className="mt-3 p-3.5 ib-hinweis">
                      Zuteilungspreis: <strong>{eurFmt(buyPrice)} pro Token</strong> · Blockchain: <strong>{blockchain} ({tokenStandard})</strong>
                    </div>
                  )}
                </section>
              )}

              {/* Kursentwicklung */}
              {investment.token_purchase_price_cents != null && investment.token_current_price_cents != null && (
                <section className="px-7 py-5 border-b border-slate-100">
                  <SectionHeader title="Kursentwicklung & aktueller Portfoliowert" />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { l: "Einkaufskurs", v: eurFmt(investment.token_purchase_price_cents / 100) + " / Token" },
                      { l: "Aktueller Kurs", v: eurFmt(investment.token_current_price_cents / 100) + " / Token" },
                      { l: "Investiertes Kapital", v: eur2(investment.principal_cents) },
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
                {meta.walletAddress && (
                  <div className="mb-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Wallet-Adresse des Investors</p>
                    <p className="text-[12px] font-mono font-semibold text-slate-800 break-all">{meta.walletAddress}</p>
                  </div>
                )}
                <div className="space-y-2.5">
                  {[
                    { t: "Blockchain-Standard", tx: `${tokenStandard} Token auf der ${blockchain} Blockchain. Transfer an die hinterlegte Wallet-Adresse des Investors; Dokumentation per Tx-Hash / Blockchain-Explorer.` },
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
              {(meta.contractRef || signedStr) && (
                <section className="px-7 py-5 border-b border-slate-100">
                  <SectionHeader title="Digitale Unterzeichnung" />
                  <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                    <div className="grid grid-cols-2 gap-y-3 gap-x-6">
                      {([
                        meta.contractRef ? ["Dokument-Referenz", meta.contractRef] : null,
                        signedStr ? ["Unterzeichnet", signedStr] : null,
                        ["Unterzeichner (Emittentin)", "Justin Schwarzott · Schwarzott Capital Partners AG"],
                        ["Unterzeichner (Investor)", investorName],
                      ].filter(Boolean) as [string, string][]).map(([k, v], i) => (
                        <div key={i}>
                          <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">{k}</p>
                          <p className="font-semibold text-slate-900 text-[11.5px]">{v}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                      <span className="text-[11px] font-semibold">Vertrag rechtsgültig unterzeichnet · Beide Parteien verifiziert</span>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {vertrag && <VertragsDetails v={vertrag} />}

          {/* Buchungsübersicht */}
          {myTxs.length > 0 && (
            <section className="px-7 py-5 border-b border-slate-100">
              <SectionHeader title="Buchungsübersicht" />
              <TransactionTimeline transactions={myTxs} />
            </section>
          )}

          {!vertrag && investment.description && (
            <section className="px-7 py-5">
              <p className="text-[13px] text-slate-600 leading-relaxed">{investment.description}</p>
            </section>
          )}

          <div className="px-7 py-6 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Schwarzott Capital Partners AG · Schifflände 26, 8001 Zürich · CHE-102.119.428
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
                        <span className={`w-3.5 h-3.5 rounded-full ${done ? "bg-[#288DFA]" : "bg-slate-200"} ${current ? "ring-4 ring-[#dbeaff]" : ""}`} />
                        {i < CARD_STATUS_STEPS.length - 1 && <span className={`w-px h-6 ${i < activeStepIndex ? "bg-[#288DFA]" : "bg-slate-200"}`} />}
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

              <button onClick={submit} disabled={busy || !form.cardholderName} className="w-full min-h-[48px] py-3.5 rounded-full text-[14px] text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
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
      {/* Mitgliedschaft: helles Milchglas (die blaue Bühne oben bleibt die eine dunkle Stelle) */}
      <section className="ib-karte rounded-[26px] p-6 sm:p-8">
        <p className="ib-kachel-l flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full" style={{ background: tierDef.accent }} />Ihre Mitgliedschaft</p>
        <h2 className="text-[24px] sm:text-[26px] mt-2 text-[#12284a]">{tierDef.label}</h2>
        <p className="text-[13.5px] text-slate-600 mt-1 max-w-md" style={{ fontWeight: 300 }}>{tierDef.tagline}</p>
        <p className="text-[12px] text-slate-500 mt-3">{activeKeys.size} {activeKeys.size === 1 ? "Leistung" : "Leistungen"} freigeschaltet · tippen Sie eine Leistung an, um sie zu nutzen</p>
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
              className={`group text-left rounded-2xl border p-5 transition-all ${active ? "bg-white border-slate-100 shadow-sm hover:border-[#A6D2FF]/60 hover:shadow-md cursor-pointer" : "bg-slate-50/60 border-slate-100 cursor-not-allowed"}`}>
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={active
                    ? { background: "rgba(40,141,250,.1)", border: "1px solid rgba(40,141,250,.25)", color: "#288DFA" }
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
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "#288DFA" }}>
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
      <div className="fixed inset-0 z-40 bg-[#12284a]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#f4f8ff] overflow-hidden"
        style={{ width: "min(560px,100vw)", boxShadow: "-20px 0 60px rgba(0,0,0,.25)", animation: "slideInRight .3s cubic-bezier(.4,0,.2,1)" }}>
        {/* Header */}
        <div className="shrink-0 px-6 sm:px-7 pt-7 pb-6 relative overflow-hidden" style={{ background: "var(--ib-buehne)" }}>
          <div className="absolute -top-16 -right-8 w-52 h-52 rounded-full opacity-20" style={{ background: "radial-gradient(circle,#7cc0ff,transparent 70%)", filter: "blur(40px)" }} />
          <div className="relative z-10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "rgba(40,141,250,.15)", border: "1px solid rgba(40,141,250,.3)", color: "#A6D2FF" }}>
                  <Icon name={benefitIconFor(benefitKey)} size={22} strokeWidth={1.6} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[.3em] mb-1" style={{ color: "#A6D2FF" }}>Circle Leistung</p>
                  <h2 className="text-[18px] font-bold text-white leading-snug">{def?.title || benefitKey}</h2>
                </div>
              </div>
              <button onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0">
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
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (usedThisYear / quota) * 100)}%`, background: "linear-gradient(90deg,#7cc0ff,#288DFA)" }} />
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
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all hover:brightness-105 active:scale-[.99]"
              style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)", boxShadow: "0 10px 28px -12px rgba(40,141,250,.7)" }}>
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
                      className={`text-[11.5px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${title === p ? "text-white border-transparent" : "text-slate-600 border-slate-200 hover:border-[#A6D2FF]"}`}
                      style={title === p ? { background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" } : undefined}>{p}</button>
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
                style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
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
    <div className={`scp-card p-4 ${isProposal ? "ring-1 ring-[#288DFA]/40" : ""}`}
      style={isProposal ? { background: "linear-gradient(160deg,#fbfdff,#eef5ff)" } : undefined}>
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
        <div className="mt-3.5 pt-3.5 border-t border-[#288DFA]/20">
          {!confirming ? (
            <div className="flex items-center gap-2.5">
              <button onClick={() => setConfirming(true)} disabled={busy}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:brightness-105 active:scale-[.99] disabled:opacity-50"
                style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)", boxShadow: "0 8px 22px -12px rgba(40,141,250,.7)" }}>
                <Icon name="check" size={15} strokeWidth={2} /> Annehmen
              </button>
              <button onClick={() => onRespond("decline")} disabled={busy}
                className="px-4 py-2.5 rounded-lg text-[13px] font-semibold text-rose-600 border border-rose-200 hover:bg-rose-50 disabled:opacity-50 transition-colors">
                Ablehnen
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg px-3.5 py-3 text-[12px] leading-relaxed" style={{ background: "rgba(40,141,250,.1)", border: "1px solid rgba(40,141,250,.25)", color: "#1D4ED8" }}>
                Mit Ihrer Bestätigung wird die Reise <span className="font-semibold">verbindlich zu den genannten Daten gebucht</span>. Ihre Tickets stehen anschließend direkt hier in der App zum Download bereit.
              </div>
              <div className="flex items-center gap-2.5">
                <button onClick={() => onRespond("accept")} disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
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
          <Icon name="shield" size={18} className="text-[#288DFA]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#12284a" }}>Ihre Stammdaten</h3>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
          {identity.map((x) => (
            <div key={x.l} className="min-w-0">
              <p className="scp-label">{x.l}</p>
              <p className="text-[13.5px] font-semibold truncate" style={{ color: "#12284a" }}>{x.v}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-5 pt-4 border-t" style={{ borderColor: "#dce6f5" }}>
          Name, E-Mail und IBAN sind aus Sicherheitsgründen gesperrt. Änderungen veranlasst Ihr persönlicher Betreuer.
        </p>
      </div>

      {/* Kontaktdaten bearbeiten */}
      <div className="scp-card p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-5">
          <Icon name="edit" size={17} className="text-[#288DFA]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#12284a" }}>Kontaktdaten</h3>
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
            style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
            {pSaving ? "Wird gespeichert…" : "Änderungen speichern"}
          </button>
        </div>
      </div>

      {/* Passwort ändern */}
      <div className="scp-card p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="lock" size={17} className="text-[#288DFA]" />
          <h3 className="font-display text-[18px] font-semibold" style={{ color: "#12284a" }}>Passwort ändern</h3>
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
            style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
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
        style={{ background: "var(--ib-buehne)", boxShadow: "0 40px 90px -25px rgba(0,0,0,.7)" }}>
        <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full opacity-25" style={{ background: "radial-gradient(circle,#7cc0ff,transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg,transparent,rgba(40,141,250,.8),transparent)" }} />
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
          <Icon name="x" size={16} strokeWidth={2} />
        </button>

        <div className="relative z-[1] p-8 sm:p-9">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5" style={{ background: "rgba(40,141,250,.12)", border: "1px solid rgba(40,141,250,.3)" }}>
            <Icon name="sparkle" size={13} className="text-[#A6D2FF]" strokeWidth={1.8} />
            <span className="text-[10.5px] font-semibold uppercase tracking-[.18em]" style={{ color: "#A6D2FF" }}>Private Banking</span>
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
                  {x.sub && <p className="text-[10px] font-semibold" style={{ color: "#A6D2FF" }}>{x.sub}</p>}
                </div>
              </div>
            ))}
          </div>

          {pendingDepositsCents > 0 && (
            <div className="mt-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px]" style={{ background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.26)", color: "#fff" }}>
              <Icon name="clock" size={14} className="mt-0.5 shrink-0" />
              <span>{eur2(pendingDepositsCents)} sind in Prüfung und werden nach Bestätigung Ihrem Portfolio gutgeschrieben.</span>
            </div>
          )}

          <button onClick={onClose}
            className="ib-knopf-hell w-full mt-7">
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


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: "rgba(13,27,62,.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-[460px] bg-white rounded-3xl overflow-hidden scp-fade-up" style={{ boxShadow: "0 40px 90px -25px rgba(0,0,0,.5)" }}>
        <div className="px-7 pt-7 pb-5" style={{ background: "var(--ib-buehne)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)" }}>
                <Icon name={isDeposit ? "plus" : "withdraw"} size={19} strokeWidth={2} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em]" style={{ color: "#A6D2FF" }}>{isDeposit ? "Einzahlung" : "Auszahlung"}</p>
                <h2 className="font-display text-[19px] font-semibold text-white leading-tight">{isDeposit ? "Kapital erhöhen" : "Auszahlung anfragen"}</h2>
              </div>
            </div>
            <button onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors">
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
              <h3 className="font-display text-[19px] font-semibold" style={{ color: "#12284a" }}>Anfrage übermittelt</h3>
              <p className="text-[13px] text-slate-500 mt-2 leading-relaxed">
                Ihre {isDeposit ? "Einzahlungs-" : "Auszahlungs-"}anfrage wurde sicher übermittelt. Unser Team prüft sie persönlich und meldet sich zeitnah bei Ihnen.
                Es wird nichts automatisch ausgeführt.
              </p>
              <button onClick={onClose} className="w-full mt-6 py-3.5 rounded-xl text-[14px] font-semibold text-white" style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>Schließen</button>
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
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px] text-slate-600" style={{ background: "rgba(40,141,250,.08)", border: "1px solid rgba(40,141,250,.2)" }}>
                  <Icon name="sparkle" size={14} className="mt-0.5 shrink-0 text-[#288DFA]" strokeWidth={1.8} />
                  <span>Zusätzliches Kapital wird zu Ihren bestehenden Konditionen von {contractualRatePct} % p.a. verzinst – vorbehaltlich Prüfung und Freigabe.</span>
                </div>
              )}

              {error && <p className="text-[12.5px] text-rose-600 font-medium">{error}</p>}

              <button onClick={submit} disabled={busy}
                className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all disabled:opacity-50"
                style={{ background: "linear-gradient(140deg,#4f9dff,#1D4ED8)" }}>
                {busy ? "Wird übermittelt…" : isDeposit ? "Einzahlung anfragen" : "Auszahlung prüfen lassen"}
              </button>
              <p className="text-[10.5px] text-slate-400 text-center">
                Sichere, unverbindliche Anfrage · jede Anfrage wird manuell geprüft.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
