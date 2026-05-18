import { useEffect, useState, useRef, useCallback } from "react";
import Clarity from "@microsoft/clarity";

/* ── Inject dashboard-specific animations ── */
if (typeof document !== "undefined" && !document.head.querySelector("style[data-db-anim]")) {
  const s = document.createElement("style");
  s.setAttribute("data-db-anim", "true");
  s.textContent = `
    @keyframes dbFadeUp { from{opacity:0;transform:translateY(20px) scale(.98);filter:blur(2px)} to{opacity:1;transform:none;filter:blur(0)} }
    @keyframes dbSlideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:none} }
    @keyframes dbOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
    @keyframes dbOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-25px,35px) scale(1.07)} }
    @keyframes dbShimmer { 0%{transform:translateX(-150%)} 100%{transform:translateX(150%)} }
    @keyframes dbCardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes dbPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
    .db-enter { animation: dbFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
    .db-slide { animation: dbSlideIn .4s cubic-bezier(.22,1,.36,1) both; }
    .db-card-float { animation: dbCardFloat 6s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

type NavSection = "overview" | "account" | "documents" | "bank-guide" | "support";

interface SessionUser {
  ref: string;
  firstName: string;
  lastName: string;
  email: string;
  packName: string;
  approvedLimit: number;
}

/* ── Helpers ── */
const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

function packGradient(name: string): string {
  if (!name) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  const n = name.toLowerCase();
  if (n.includes("high") || n.includes("black")) return "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)";
  if (n.includes("ultra") || n.includes("elite")) return "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)";
  if (n.includes("pro") || n.includes("standard")) return "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)";
  return "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)";
}

/* ── 3-D Credit Card ── */
function CreditCard3D({ user }: { user: SessionUser }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const [mp, setMp] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    setMp({ x: e.clientX - b.left, y: e.clientY - b.top });
    setR({ x: ((e.clientY - b.top) / b.height - .5) * -10, y: ((e.clientX - b.left) / b.width - .5) * 10 });
  };
  const bg = packGradient(user.packName);
  return (
    <div ref={ref} className="w-full" style={{ perspective: 900 }} onMouseMove={move} onMouseLeave={() => { setR({ x: 0, y: 0 }); }}>
      <div className="w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none db-card-float" style={{
        background: bg,
        border: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 40px 80px -20px rgba(10,20,40,.55), 0 20px 40px -10px rgba(37,99,235,.25), inset 0 1px 0 rgba(255,255,255,.12)",
        transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`,
        transition: r.x === 0 ? "transform .6s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.3), transparent 55%)", mixBlendMode: "overlay" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at ${mp.x}px ${mp.y}px, rgba(255,255,255,.12) 0%, transparent 55%)` }} />
        <div className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(90deg,transparent,transparent 50px,rgba(255,255,255,.015) 50px,rgba(255,255,255,.015) 51px)" }} />
        <div className="absolute inset-0 p-5 sm:p-7 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <span className="text-xl font-bold tracking-tight text-white/90">FIAON</span>
            <span className="text-[10px] font-semibold tracking-[.18em] uppercase text-white/50">
              {user.packName?.split(" ").pop() || "Card"}
            </span>
          </div>
          <div className="w-11 h-8 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }}>
            <div className="w-full h-full opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.3) 2px,rgba(0,0,0,.3) 4px)", borderRadius: 4 }} />
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Kreditlimit</div>
              <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{eur(user.approvedLimit)}</div>
            </div>
            <div className="text-white/25 text-xs tracking-widest">•••• 4242</div>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-[11px] font-semibold tracking-[.12em] uppercase text-white/75">
              {user.firstName} {user.lastName}
            </div>
            <svg width="36" height="24" viewBox="0 0 36 24" className="opacity-60">
              <circle cx="14" cy="12" r="10" fill="#eb001b" opacity=".9"/>
              <circle cx="22" cy="12" r="10" fill="#f79e1b" opacity=".9"/>
              <path d="M18 5.5a10 10 0 0 1 0 13 10 10 0 0 1 0-13z" fill="#ff5f00" opacity=".9"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar NavItem ── */
function NavItem({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: string }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all duration-200 group ${active ? "bg-[#2563eb] text-white shadow-[0_4px_16px_rgba(37,99,235,.35)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
      <span className={`shrink-0 transition-colors ${active ? "text-white" : "text-slate-400 group-hover:text-slate-600"}`}>{icon}</span>
      <span className="text-[13px] font-semibold truncate">{label}</span>
      {badge && <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${active ? "bg-white/25 text-white" : "bg-amber-100 text-amber-600"}`}>{badge}</span>}
    </button>
  );
}

/* ── Stat Card ── */
function StatCard({ label, value, sub, icon, color = "blue" }: { label: string; value: string; sub?: string; icon: React.ReactNode; color?: "blue" | "green" | "amber" | "purple" }) {
  const colors = { blue: "bg-blue-50 text-[#2563eb]", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", purple: "bg-violet-50 text-violet-600" };
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>{icon}</div>
      </div>
      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-1">{label}</div>
      <div className="text-xl font-bold text-slate-900 tracking-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── D/A/CH Bank Data ── */
const BANKS = {
  de: [
    { name: "Deutsche Bank", steps: ["Meine Bank → Online Banking", "Konten & Karten → Kontoauszüge", "Zeitraum wählen → Als PDF herunterladen"] },
    { name: "Commerzbank", steps: ["Banking → Meine Konten", "Umsätze → Kontoauszüge", "Monat auswählen → PDF Export"] },
    { name: "Sparkasse", steps: ["Online-Banking → Mein Konto", "Service → Kontoauszüge", "Zeitraum wählen → PDF Abruf"] },
    { name: "Volksbank / Raiffeisen", steps: ["VR-Banking → Konto", "Auszüge & Dokumente", "Datum wählen → Als PDF laden"] },
    { name: "ING", steps: ["ING App / Web → Mein Konto", "Kontoumsätze → Kontoauszüge", "Monat wählen → PDF Download"] },
    { name: "DKB", steps: ["Postfach → Kontoauszüge", "Zeitraum filtern", "PDF herunterladen"] },
    { name: "N26", steps: ["App → Statistiken / Konto", "Konto-Details", "Exportieren → PDF (max. 90 Tage)"] },
    { name: "Postbank", steps: ["Online Banking → Postfach", "Kontoauszüge → Zeitraum", "Herunterladen als PDF"] },
    { name: "Comdirect", steps: ["Mein Depot → Nachrichten", "Kontoauszüge → Filter", "PDF-Download"] },
    { name: "HypoVereinsbank (UniCredit)", steps: ["Online Banking → Konten", "Kontoauszüge / Umsätze", "Zeitraum → PDF Abruf"] },
    { name: "Targobank", steps: ["Online Banking → Konten", "Auszüge & Dokumente", "Monat wählen → PDF Download"] },
  ],
  at: [
    { name: "Bank Austria", steps: ["netbanking → Mein Konto", "Kontoauszüge → Archiv", "Zeitraum → PDF Download"] },
    { name: "Erste Bank / George", steps: ["George App / Web → Konto", "Dokumente → Auszüge", "Zeitraum → PDF Download"] },
    { name: "Raiffeisen (ELBA)", steps: ["ELBA-internet → Konten", "Auszüge & Dokumente", "Zeitraum → PDF Herunterladen"] },
    { name: "BAWAG P.S.K.", steps: ["easybank → Konto", "Kontoauszüge → Filter", "PDF Download"] },
    { name: "Volksbank", steps: ["Online Banking → Konto", "Meine Auszüge", "Zeitraum wählen → PDF"] },
    { name: "Oberbank", steps: ["Online Banking → Konten", "Kontoauszüge / Umsätze", "PDF Download"] },
  ],
  ch: [
    { name: "UBS", steps: ["E-Banking → Konten", "Kontoauszug → Detailansicht", "PDF exportieren"] },
    { name: "Zürcher Kantonalbank (ZKB)", steps: ["E-Banking → Konto", "Dokumente → Kontoauszüge", "Zeitraum → PDF laden"] },
    { name: "PostFinance", steps: ["E-Finance → Konto", "Auszüge → Archiv", "Zeitraum wählen → PDF"] },
    { name: "Raiffeisen Schweiz", steps: ["e-banking → Zahlungsverkehr", "Kontoauszüge → Archiv", "PDF Download"] },
    { name: "Migros Bank", steps: ["E-Banking → Konto", "Auszüge → Zeitraum", "PDF Herunterladen"] },
    { name: "Valiant", steps: ["E-Banking → Konto", "Kontoauszüge", "Zeitraum → PDF Export"] },
  ],
};

/* ═══════════════════════════════════════
   MAIN DASHBOARD PAGE
═══════════════════════════════════════ */
export default function DashboardPage() {
  const [section, setSection] = useState<NavSection>("overview");
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(() => localStorage.getItem("kyc_uploaded") === "true");
  const [serverDocStatus, setServerDocStatus] = useState({ hasBankStatement: false, hasIdCard: false });
  const [bankTabOpen, setBankTabOpen] = useState<string | null>(null);
  const [bankCountry, setBankCountry] = useState<"de" | "at" | "ch">("de");
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const user: SessionUser = (() => { try { return JSON.parse(sessionStorage.getItem("fiaon_user") || "{}"); } catch { return {} as SessionUser; } })();
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend"; })();
  const docsOk = isUploadSuccess || (serverDocStatus.hasBankStatement && serverDocStatus.hasIdCard);
  const kycBadge = docsOk ? undefined : "!";

  useEffect(() => {
    setMounted(true);
    if (user?.email) { try { Clarity.identify(user.email); } catch {} }
    if (user?.ref) {
      fetch(`/api/fiaon/kyc-status/${user.ref}`).then(r => r.json()).then(d => {
        setServerDocStatus({ hasBankStatement: d.hasBankStatement, hasIdCard: d.hasIdCard });
        if (d.hasBankStatement && d.hasIdCard) { setIsUploadSuccess(true); localStorage.setItem("kyc_uploaded", "true"); }
      }).catch(() => {});
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!bankStatementFile && !idFile) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("ref", user.ref || "");
      if (bankStatementFile) fd.append("bankStatement", bankStatementFile);
      if (idFile) fd.append("idCard", idFile);
      const res = await fetch("/api/fiaon/upload-kyc", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setServerDocStatus({ hasBankStatement: d.hasBankStatement, hasIdCard: d.hasIdCard });
      if (d.allDocumentsUploaded) { setIsUploadSuccess(true); localStorage.setItem("kyc_uploaded", "true"); }
    } catch { alert("Fehler beim Upload. Bitte erneut versuchen."); }
    finally { setIsUploading(false); }
  }, [bankStatementFile, idFile, user.ref]);

  /* ── NAV CONFIG ── */
  const NAV: { id: NavSection; label: string; badge?: string; icon: React.ReactNode }[] = [
    { id: "overview",   label: "Übersicht",      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "account",    label: "Mein Konto",      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { id: "documents",  label: "Dokumente",  badge: kycBadge, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: "bank-guide", label: "Kontoauszüge",    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
    { id: "support",    label: "Support",          icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
  ];

  const sectionKey = section; // for animation rekey

  /* ── SIDEBAR ── */
  const Sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 pt-6 pb-5 border-b border-slate-100">
        <a href="/" className="flex items-center gap-2">
          <span className="text-lg font-bold fiaon-gradient-text-animated tracking-tight">FIAON</span>
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Banking</span>
        </a>
      </div>
      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[.18em] px-3.5 mb-2">Navigation</p>
        {NAV.map(n => (
          <NavItem key={n.id} icon={n.icon} label={n.label} active={section === n.id} onClick={() => { setSection(n.id); setSidebarOpen(false); }} badge={n.badge} />
        ))}
      </nav>
      {/* User block */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg,#2563eb,#1d4ed8)" }}>
            {(user.firstName?.[0] || "?")}{(user.lastName?.[0] || "")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-slate-800 truncate">{user.firstName} {user.lastName}</div>
            <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
          </div>
        </div>
        <button onClick={() => { sessionStorage.removeItem("fiaon_user"); window.location.href = "/login"; }}
          className="w-full mt-2 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Abmelden
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafd] overflow-hidden" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* ── Ambient orbs ── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[50vw] h-[50vw] rounded-full opacity-[.04]" style={{ background: "radial-gradient(circle,#2563eb,transparent 70%)", animation: "dbOrb1 20s ease-in-out infinite" }} />
        <div className="absolute bottom-[-5%] left-[5%] w-[40vw] h-[40vw] rounded-full opacity-[.03]" style={{ background: "radial-gradient(circle,#3b82f6,transparent 70%)", animation: "dbOrb2 16s ease-in-out infinite" }} />
      </div>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden lg:flex flex-col w-[220px] shrink-0 bg-white border-r border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,.03)] z-20 relative">
        {Sidebar}
      </aside>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[240px] bg-white h-full shadow-2xl z-10 db-slide">
            {Sidebar}
          </div>
        </div>
      )}

      {/* ── MAIN AREA ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── TOP BAR ── */}
        <header className="shrink-0 h-14 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center px-4 sm:px-6 gap-3 z-10">
          <button className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors" onClick={() => setSidebarOpen(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[13px] font-semibold text-slate-700">{NAV.find(n => n.id === section)?.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">Konto aktiv</span>
          </div>
        </header>

        {/* ── SCROLL AREA ── */}
        <main className="flex-1 overflow-y-auto">
          <div key={sectionKey} className="db-enter max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6">

            {/* ════════════════ OVERVIEW ════════════════ */}
            {section === "overview" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Dashboard</p>
                  <h1 className="text-2xl sm:text-3xl font-bold fiaon-gradient-text-animated tracking-tight">{greeting}, {user.firstName || "—"}.</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Willkommen in deinem FIAON Banking-Portal.</p>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard label="Kreditlimit" value={eur(user.approvedLimit || 0)} sub={user.packName} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>} color="blue" />
                  <StatCard label="Status" value="Aktiv" sub="Konto freigeschaltet" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>} color="green" />
                  <StatCard label="Dokumente" value={docsOk ? "Komplett" : "Ausstehend"} sub={docsOk ? "In Prüfung" : "Upload erforderlich"} icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} color={docsOk ? "green" : "amber"} />
                  <StatCard label="Paket" value={user.packName?.split(" ").pop() || "—"} sub="FIAON Card" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>} color="purple" />
                </div>

                {/* Card + quick info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="db-enter" style={{ animationDelay: ".08s" }}>
                    <CreditCard3D user={user} />
                  </div>
                  <div className="fiaon-glass-panel rounded-2xl p-5 space-y-3 border border-white/60">
                    <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Kontoübersicht</h3>
                    {[
                      ["Karteninhaber", `${user.firstName || "—"} ${user.lastName || ""}`],
                      ["Referenz", user.ref || "—"],
                      ["Paket", user.packName || "—"],
                      ["Limit", eur(user.approvedLimit || 0)],
                      ["E-Mail", user.email || "—"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{k}</span>
                        <span className="text-[13px] font-semibold text-slate-800 text-right max-w-[55%] truncate">{v}</span>
                      </div>
                    ))}
                    <a href={`/api/fiaon/contract/${user.ref}`} className="flex items-center gap-2 mt-2 text-[12px] font-semibold text-[#2563eb] hover:text-blue-700 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Vertrag herunterladen
                    </a>
                  </div>
                </div>

                {/* Action banner if docs missing */}
                {!docsOk && (
                  <button onClick={() => setSection("documents")} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-amber-200 bg-amber-50 hover:bg-amber-100/80 transition-colors text-left group">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-amber-800">Aktion erforderlich: Dokumente hochladen</div>
                      <div className="text-[11px] text-amber-600 mt-0.5">Kontoauszüge & Identitätsnachweis ausstehend — hier klicken</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                )}
              </div>
            )}

            {/* ════════════════ ACCOUNT ════════════════ */}
            {section === "account" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Profil</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mein Konto</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Deine persönlichen Daten und Vertragsdetails.</p>
                </div>
                <div className="fiaon-glass-panel rounded-2xl border border-white/60 overflow-hidden">
                  {[
                    ["Name", `${user.firstName || "—"} ${user.lastName || ""}`],
                    ["E-Mail", user.email || "—"],
                    ["Referenznummer", user.ref || "—"],
                    ["Paket", user.packName || "—"],
                    ["Kreditlimit", eur(user.approvedLimit || 0)],
                  ].map(([k, v], i) => (
                    <div key={k} className={`flex items-center justify-between px-5 py-4 ${i < 4 ? "border-b border-slate-100" : ""}`}>
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{k}</span>
                      <span className="text-[13px] font-semibold text-slate-800">{v}</span>
                    </div>
                  ))}
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <a href={`/api/fiaon/contract/${user.ref}`} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2563eb] hover:text-blue-700 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      FIAON-Vertrag herunterladen (PDF)
                    </a>
                  </div>
                </div>
                <div className="fiaon-glass-panel rounded-2xl border border-white/60 p-5">
                  <h3 className="text-[13px] font-bold text-slate-700 mb-3">Passwort ändern</h3>
                  <p className="text-[12px] text-slate-500 mb-4">Um dein Passwort zu ändern, nutze die Passwort-Vergessen Funktion.</p>
                  <a href="/passwort-vergessen" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#2563eb] hover:underline">
                    Passwort zurücksetzen →
                  </a>
                </div>
              </div>
            )}

            {/* ════════════════ DOCUMENTS ════════════════ */}
            {section === "documents" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">KYC Verifizierung</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dokumente</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Upload zur Kontofreischaltung. Alle Uploads sind verschlüsselt.</p>
                </div>

                {docsOk ? (
                  <div className="fiaon-glass-panel rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-emerald-800">Dokumente hochgeladen</div>
                      <div className="text-[12px] text-emerald-700 mt-1">Unser Team prüft deine Unterlagen. Wir melden uns innerhalb von 1–3 Werktagen.</div>
                      <div className="flex items-center gap-1.5 mt-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-semibold text-emerald-600">In Bearbeitung</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Bank Statement upload */}
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-slate-300 font-bold">01</span>
                          {(serverDocStatus.hasBankStatement || bankStatementFile) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        <h3 className="text-[14px] font-bold text-slate-800 mb-1">Kontoauszüge</h3>
                        <p className="text-[11px] text-slate-400 mb-4">Letzten 6 Monate, alle Seiten als PDF</p>
                        {!bankStatementFile && !serverDocStatus.hasBankStatement ? (
                          <>
                            <div onClick={() => fileInputRef1.current?.click()} className="h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#2563eb] hover:bg-blue-50/30 flex flex-col items-center justify-center cursor-pointer transition-all group">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-300 group-hover:text-[#2563eb] mb-1.5 transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              <span className="text-[12px] font-semibold text-slate-500 group-hover:text-[#2563eb] transition-colors">PDF auswählen</span>
                              <span className="text-[10px] text-slate-300 mt-0.5">max. 10 MB</span>
                            </div>
                            <input ref={fileInputRef1} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setBankStatementFile(e.target.files[0])} />
                          </>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div className="truncate pr-3">
                              <div className="text-[12px] font-semibold text-white truncate">{bankStatementFile?.name || "Kontoauszüge.pdf"}</div>
                              <div className="text-[10px] text-slate-400">{serverDocStatus.hasBankStatement ? "Hochgeladen ✓" : "Bereit"}</div>
                            </div>
                            {bankStatementFile && !serverDocStatus.hasBankStatement && (
                              <button onClick={() => setBankStatementFile(null)} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-widest font-bold shrink-0">×</button>
                            )}
                          </div>
                        )}
                        <button onClick={() => setSection("bank-guide")} className="mt-3 text-[11px] font-semibold text-[#2563eb] hover:underline flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                          Anleitung: PDF herunterladen
                        </button>
                      </div>

                      {/* ID upload */}
                      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-[10px] text-slate-300 font-bold">02</span>
                          {(serverDocStatus.hasIdCard || idFile) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                        </div>
                        <h3 className="text-[14px] font-bold text-slate-800 mb-1">Identitätsnachweis</h3>
                        <p className="text-[11px] text-slate-400 mb-4">Reisepass oder Personalausweis als PDF</p>
                        {!idFile && !serverDocStatus.hasIdCard ? (
                          <>
                            <div onClick={() => fileInputRef2.current?.click()} className="h-24 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#2563eb] hover:bg-blue-50/30 flex flex-col items-center justify-center cursor-pointer transition-all group">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-300 group-hover:text-[#2563eb] mb-1.5 transition-colors"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><circle cx="12" cy="13" r="2"/><path d="M8 17c0-1.1 1.8-2 4-2s4 .9 4 2"/></svg>
                              <span className="text-[12px] font-semibold text-slate-500 group-hover:text-[#2563eb] transition-colors">PDF auswählen</span>
                              <span className="text-[10px] text-slate-300 mt-0.5">max. 10 MB</span>
                            </div>
                            <input ref={fileInputRef2} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setIdFile(e.target.files[0])} />
                          </>
                        ) : (
                          <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                            <div className="truncate pr-3">
                              <div className="text-[12px] font-semibold text-white truncate">{idFile?.name || "Ausweis.pdf"}</div>
                              <div className="text-[10px] text-slate-400">{serverDocStatus.hasIdCard ? "Hochgeladen ✓" : "Bereit"}</div>
                            </div>
                            {idFile && !serverDocStatus.hasIdCard && (
                              <button onClick={() => setIdFile(null)} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-widest font-bold shrink-0">×</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {(bankStatementFile || idFile) && (
                      <button onClick={handleUpload} disabled={isUploading} className="w-full py-3.5 fiaon-btn-gradient rounded-xl text-[14px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2">
                        {isUploading ? <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Hochladen…</> : <>Dokumente sicher hochladen<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Ende-zu-Ende verschlüsselt — deine Daten sind sicher
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ════════════════ BANK GUIDE ════════════════ */}
            {section === "bank-guide" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Hilfe</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kontoauszüge als PDF</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Schritt-für-Schritt Anleitung für alle großen D/A/CH Banken.</p>
                </div>

                {/* Info box */}
                <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-[12px] text-blue-800 leading-relaxed">Wir benötigen die Kontoauszüge der <strong>letzten 6 Monate</strong> als PDF. Bitte lade alle Seiten hoch. Screenshots werden nicht akzeptiert.</p>
                </div>

                {/* Country tabs */}
                <div className="flex gap-2 bg-slate-100 p-1 rounded-xl w-fit">
                  {(["de", "at", "ch"] as const).map(c => (
                    <button key={c} onClick={() => { setBankCountry(c); setBankTabOpen(null); }} className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${bankCountry === c ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                      {c === "de" ? "🇩🇪 Deutschland" : c === "at" ? "🇦🇹 Österreich" : "🇨🇭 Schweiz"}
                    </button>
                  ))}
                </div>

                {/* Bank list */}
                <div className="space-y-2">
                  {BANKS[bankCountry].map((bank, i) => (
                    <div key={bank.name} className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                      <button onClick={() => setBankTabOpen(bankTabOpen === bank.name ? null : bank.name)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[10px] text-slate-300 w-5 shrink-0">{String(i+1).padStart(2,"0")}</span>
                          <span className="text-[14px] font-semibold text-slate-800">{bank.name}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className={`text-slate-300 transition-transform duration-300 ${bankTabOpen === bank.name ? "rotate-180" : ""}`}><path d="M19 9l-7 7-7-7"/></svg>
                      </button>
                      {bankTabOpen === bank.name && (
                        <div className="px-5 pb-4 border-t border-slate-50">
                          <div className="pt-3 space-y-2.5">
                            {bank.steps.map((step, si) => (
                              <div key={si} className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-blue-50 text-[#2563eb] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{si+1}</div>
                                <span className="text-[13px] text-slate-700 leading-relaxed">{step}</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 mt-3 p-3 bg-slate-50 rounded-xl">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              <span className="text-[11px] text-slate-500">Heruntergeladene PDF direkt <button onClick={() => setSection("documents")} className="text-[#2563eb] font-semibold hover:underline">hier hochladen</button></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ════════════════ SUPPORT ════════════════ */}
            {section === "support" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Hilfe & Kontakt</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Wir sind für dich da.</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { icon: "✉️", title: "E-Mail", desc: "support@fiaon.com", sub: "Antwort innerhalb 24h", href: "mailto:support@fiaon.com" },
                    { icon: "🌐", title: "Website", desc: "www.fiaon.com", sub: "Informationen & FAQ", href: "https://fiaon.com" },
                  ].map(c => (
                    <a key={c.title} href={c.href} className="flex items-start gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                      <span className="text-2xl">{c.icon}</span>
                      <div>
                        <div className="text-[13px] font-bold text-slate-800 group-hover:text-[#2563eb] transition-colors">{c.title}</div>
                        <div className="text-[12px] text-[#2563eb] font-medium mt-0.5">{c.desc}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{c.sub}</div>
                      </div>
                    </a>
                  ))}
                </div>
                <div className="fiaon-glass-panel rounded-2xl border border-white/60 p-5">
                  <h3 className="text-[13px] font-bold text-slate-700 mb-4">Häufige Fragen</h3>
                  <div className="space-y-3">
                    {[
                      ["Wie lade ich meine Kontoauszüge hoch?", "Gehe zu Dokumente und wähle die PDF-Datei deiner Kontoauszüge aus. Nutze unsere Kontoauszüge-Seite für eine Anleitung je nach Bank."],
                      ["Wie lange dauert die Prüfung?", "Nach dem Upload prüft unser Team deine Unterlagen innerhalb von 1–3 Werktagen."],
                      ["Kann ich mein Passwort ändern?", "Ja, nutze die Passwort-Vergessen Funktion auf der Login-Seite — keine E-Mail-Bestätigung nötig."],
                      ["Was ist das Kreditlimit?", "Das bewilligte Limit entspricht dem Betrag, der dir für Zahlungen über deine FIAON-Karte zur Verfügung steht."],
                    ].map(([q, a]) => (
                      <details key={q} className="group bg-white border border-slate-100 rounded-xl overflow-hidden">
                        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-[13px] font-semibold text-slate-800 hover:text-[#2563eb] transition-colors list-none">
                          {q}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-slate-300 group-open:rotate-180 transition-transform"><path d="M19 9l-7 7-7-7"/></svg>
                        </summary>
                        <div className="px-4 pb-3 text-[12px] text-slate-500 leading-relaxed border-t border-slate-50">{a}</div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-100 flex z-30 safe-area-pb" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)} className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[9px] font-semibold uppercase tracking-wider transition-colors relative ${section === n.id ? "text-[#2563eb]" : "text-slate-400"}`}>
              {n.badge && <span className="absolute top-1 right-1/4 w-4 h-4 rounded-full bg-amber-500 text-white text-[8px] font-bold flex items-center justify-center">{n.badge}</span>}
              <span className={`transition-transform ${section === n.id ? "scale-110" : ""}`}>{n.icon}</span>
              <span className="hidden xs:block">{n.label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
