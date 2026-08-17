import { useEffect, useState, useRef, useCallback } from "react";
import { paketKurz } from "@shared/fiaon-paketname";
import Clarity from "@microsoft/clarity";
import { StartgespraechGate } from "@/components/StartgespraechGate";
import { PortalSperre } from "@/components/PortalSperre";
import WelcomeModal from "@/components/WelcomeModal";
import { welcomeConfig, type WelcomeState } from "@/config/welcome";
import RoadmapJourney from "@/components/roadmap/RoadmapJourney";
import {
  BonitaetsCheck, IhrWeg, NochZuErledigen, FahrplanVorschau, useBonitaetStatus,
} from "@/components/dashboard/naechste-schritte";
import { gruss } from "@/pages/agent/zeit";

/* ── Inject dashboard-specific animations ── */
if (typeof document !== "undefined" && !document.head.querySelector("style[data-db-anim]")) {
  const s = document.createElement("style");
  s.setAttribute("data-db-anim", "true");
  s.textContent = `
    /* Nur transform und opacity: der frühere Weichzeichner musste bei JEDEM
       Bild neu gerechnet werden und hat den Seitenwechsel auf schwachen Geräten
       sichtbar gebremst. Die Einblendung sieht unverändert weich aus. */
    @keyframes dbFadeUp { from{opacity:0;transform:translate3d(0,16px,0)} to{opacity:1;transform:none} }
    @keyframes dbSlideIn { from{opacity:0;transform:translateX(-16px)} to{opacity:1;transform:none} }
    @keyframes dbOrb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-30px) scale(1.1)} }
    @keyframes dbOrb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-25px,35px) scale(1.07)} }
    @keyframes dbShimmer { 0%{transform:translateX(-150%)} 100%{transform:translateX(150%)} }
    @keyframes dbCardFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
    @keyframes dbPulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
    @keyframes dbBannerIn { from{opacity:0;transform:translateY(-100%)} to{opacity:1;transform:translateY(0)} }
    @keyframes dbBannerShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
    @keyframes dbBannerPulse { 0%,100%{box-shadow:0 0 0 0 rgba(225,29,72,.25)} 50%{box-shadow:0 0 0 8px rgba(225,29,72,0)} }
    .db-enter { animation: dbFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
    .db-slide { animation: dbSlideIn .4s cubic-bezier(.22,1,.36,1) both; }
    .db-card-float { animation: dbCardFloat 6s ease-in-out infinite; }
    .db-banner { animation: dbBannerIn .4s cubic-bezier(.22,1,.36,1) both, dbBannerPulse 2.5s ease-in-out 0.5s 3; }
  `;
  document.head.appendChild(s);
}

type NavSection = "overview" | "roadmap" | "account" | "documents" | "bank-guide" | "support";

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
              {/* `split(" ").pop()` stand hier und ergab bei „FIAON High End
                  (Das Maximum)" das Wort „Maximum)" — letztes Wort samt
                  schließender Klammer. Siehe paketKurz(). */}
              {paketKurz(user.packName) || "Mitglied"}
            </span>
          </div>
          <div className="w-11 h-8 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }}>
            <div className="w-full h-full opacity-20" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.3) 2px,rgba(0,0,0,.3) 4px)", borderRadius: 4 }} />
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest mb-1">Paket-Rahmen</div>
              <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{eur(user.approvedLimit)}</div>
            </div>
          </div>
          <div className="flex justify-between items-end">
            <div className="text-[11px] font-semibold tracking-[.12em] uppercase text-white/75">
              {user.firstName} {user.lastName}
            </div>
            <span className="text-[9px] font-semibold tracking-[.2em] uppercase text-white/40">Mitgliedskarte</span>
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

/* ── Premium Glass Stat Card ── */
function PremiumStatCard({ label, value, sub, icon, bg, glow, badge, onClick }: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  bg: string; glow: string; badge?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 transition-all duration-300 group select-none ${
        onClick ? 'cursor-pointer hover:-translate-y-1.5 active:scale-[.98]' : ''
      }`}
      style={{ background: bg, boxShadow: `0 8px 32px ${glow}28, 0 1px 0 rgba(255,255,255,.12) inset` }}
    >
      {/* top shine line */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)' }} />
      {/* hover glow overlay */}
      {onClick && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" style={{ background: 'rgba(255,255,255,.06)' }} />}
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/90">{icon}</div>
          {onClick && (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          )}
        </div>
        <div className="text-[10px] font-bold text-white/50 uppercase tracking-[.15em] mb-1">{label}</div>
        <div className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-none">{value}</div>
        {sub && <div className="text-[11px] text-white/50 mt-1">{sub}</div>}
        {badge}
      </div>
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
  // ── DIE KONTO-STUFE ─────────────────────────────────────────────────────
  // Solange das Startgespräch fehlt, sind Fahrplan und Inhalte gesperrt — mit
  // einer Karte, die den Grund nennt, nicht mit einer leeren Seite. Die Stufe
  // entscheidet der SERVER (server/lib/fiaon-kontostufe.ts); hier wird nur
  // gezeichnet.
  const [stufe, setStufe] = useState<{
    vollAktiv: boolean; pflicht: boolean;
    termin: { datumText: string; uhrzeit: string; agentVorname: string } | null;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bankStatementFile, setBankStatementFile] = useState<File | null>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadSuccess, setIsUploadSuccess] = useState(() => localStorage.getItem("kyc_uploaded") === "true");
  const [serverDocStatus, setServerDocStatus] = useState({ hasBankStatement: false, hasIdCard: false, hasSchufa: false, documentsUploadedAt: null as string | null, kycStatus: 'pending' as string, accountStatus: 'pending' as string, adminNote: null as string | null, reuploadBankStatement: false, reuploadIdCard: false, adminProfileNote: null as string | null, profileChangesRequested: false, profileCompletedAt: null as string | null });
  const [profileData, setProfileData] = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string,boolean>>({});
  const [activeTooltip, setActiveTooltip] = useState<string|null>(null);
  const profileFormRef = useRef<HTMLDivElement>(null);
  const [profileForm, setProfileForm] = useState({
    movedRecently: false, previousStreet: '', previousZip: '', previousCity: '', previousCountry: 'Deutschland',
    passportNumber: '', passportExpiry: '',
    hasAdditionalIncome: false, additionalIncomeSources: '', additionalIncomeAmount: '',
    expensesFood: '', expensesTransport: '', expensesInsurance: '', expensesLoans: '', expensesSubscriptions: '', expensesOther: '',
  });
  const [bankTabOpen, setBankTabOpen] = useState<string | null>(null);
  const [bankCountry, setBankCountry] = useState<"de" | "at" | "ch">("de");
  const [activeModal, setActiveModal] = useState<null | 'limit' | 'status' | 'paket'>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [welcomeState, setWelcomeState] = useState<WelcomeState>('first');
  const [coaching, setCoaching] = useState<string | null>(null);
  const [schufaFile, setSchufaFile] = useState<File | null>(null);
  const [isSchufaUploading, setIsSchufaUploading] = useState(false);
  const [schufaModal, setSchufaModal] = useState(false);
  const [schufaGuideOpen, setSchufaGuideOpen] = useState(false);
  const fileInputRef1 = useRef<HTMLInputElement>(null);
  const fileInputRef2 = useRef<HTMLInputElement>(null);
  const fileInputRef3 = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<SessionUser>(() => { try { return JSON.parse(sessionStorage.getItem("fiaon_user") || "{}"); } catch { return {} as SessionUser; } });

  // Die Stufe kommt vom Server — hier wird nur gezeichnet.
  useEffect(() => {
    if (!user?.ref) return;
    let weg = false;
    void fetch(`/api/fiaon/kunde/${encodeURIComponent(user.ref)}/startgespraech`)
      .then((r) => r.json())
      .then((j) => {
        if (weg || !j?.ok) return;
        setStufe({
          // Kein Wert vom Server heißt: nicht einschränken. Ein Kunde, dessen
          // Stufe wir nicht kennen, darf nicht aus Versehen gesperrt werden.
          vollAktiv: j.vollAktiv !== false || j.erledigt === true,
          pflicht: j.pflicht === true,
          termin: j.termin ?? null,
        });
      })
      .catch(() => {});
    return () => { weg = true; };
  }, [user?.ref]);

  // Zustand des Bonitäts-Checks (nur lesend) — steuert den Held-Bereich der
  // Übersicht: Angebot, offene Zahlung, in Arbeit oder Auswertung fertig.
  // Muss NACH `user` stehen, sonst Zugriff vor der Initialisierung.
  const { status: bonitaet, loading: bonitaetLaedt } = useBonitaetStatus(user?.ref);
  // Deutsche Geschäftszeit statt Geräte-Uhrzeit (geprüfter Helfer, siehe
  // client/src/pages/agent/zeit.ts) — ein Kunde im Ausland wurde bisher falsch
  // begrüßt. Sie-Form bleibt: der Gruß wird unten mit dem Namen zusammengesetzt.
  const greeting = gruss();
  const docsOk = isUploadSuccess || (serverDocStatus.hasBankStatement && serverDocStatus.hasIdCard);
  const kycBadge = docsOk ? undefined : "!";

  /* ── Kontextabhängiger Zustand fürs Willkommens-Popup ── */
  const computeWelcomeState = useCallback((): WelcomeState => {
    if (serverDocStatus.accountStatus === 'active') return 'active';
    const profileDone = !!serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested;
    if (profileDone && docsOk && serverDocStatus.kycStatus !== 'changes_requested') return 'review';
    return 'incomplete';
  }, [serverDocStatus.accountStatus, serverDocStatus.profileCompletedAt, serverDocStatus.profileChangesRequested, serverDocStatus.kycStatus, docsOk]);

  /* Einmalig je Zustand zeigen; Erst-Login immer als herzliche Begrüßung.
     Merker in localStorage, damit es nicht nervt (version bricht bei Textänderung um). */
  useEffect(() => {
    if (!statusLoaded) return;
    const v = welcomeConfig.version;
    const firstKey = `fiaon_welcome_first_v${v}`;
    if (!localStorage.getItem(firstKey)) {
      setWelcomeState('first');
      setWelcomeOpen(true);
      return;
    }
    const st = computeWelcomeState();
    const stateKey = `fiaon_welcome_${st}_v${v}`;
    if (!localStorage.getItem(stateKey)) {
      setWelcomeState(st);
      setWelcomeOpen(true);
    }
  }, [statusLoaded, computeWelcomeState]);

  const closeWelcome = useCallback(() => {
    const v = welcomeConfig.version;
    if (welcomeState === 'first') localStorage.setItem(`fiaon_welcome_first_v${v}`, 'true');
    localStorage.setItem(`fiaon_welcome_${welcomeState}_v${v}`, 'true');
    setWelcomeOpen(false);
  }, [welcomeState]);

  /* ── KI-Login-Begrüßung laden (nur aggregierte Signale; nächste Zahlung/Frist + nächster Schritt) ── */
  useEffect(() => {
    if (!welcomeOpen || coaching || !user?.ref) return;
    let cancelled = false;
    fetch(`/api/fiaon/roadmap/${user.ref}/greeting`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.ok && d.greeting) setCoaching(d.greeting); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [welcomeOpen, coaching, user?.ref]);

  /* Manuelles Wiederöffnen über den „?"-Punkt — zeigt den aktuellen Zustand,
     ohne den „schon gesehen"-Merker zu verändern. */
  const reopenWelcome = useCallback(() => {
    setWelcomeState(computeWelcomeState());
    setWelcomeOpen(true);
  }, [computeWelcomeState]);

  useEffect(() => {
    setMounted(true);
    if (user?.email) { try { Clarity.identify(user.email); } catch {} }
    if (user?.ref) {
      fetch(`/api/fiaon/kyc-status/${user.ref}`).then(r => r.json()).then(d => {
        setServerDocStatus({ hasBankStatement: d.hasBankStatement, hasIdCard: d.hasIdCard, hasSchufa: d.hasSchufa ?? false, documentsUploadedAt: d.documentsUploadedAt, kycStatus: d.kycStatus ?? 'pending', accountStatus: d.accountStatus ?? 'pending', adminNote: d.adminNote ?? null, reuploadBankStatement: d.reuploadBankStatement ?? false, reuploadIdCard: d.reuploadIdCard ?? false, adminProfileNote: d.adminProfileNote ?? null, profileChangesRequested: d.profileChangesRequested ?? false, profileCompletedAt: d.profileCompletedAt ?? null });
        if (d.hasBankStatement && d.hasIdCard) { setIsUploadSuccess(true); localStorage.setItem("kyc_uploaded", "true"); }
        setStatusLoaded(true);
      }).catch(() => { setStatusLoaded(true); });
      // #20: Limit/Paket serverseitig frisch holen (korrigiert veraltete Session,
      // z. B. Ultra-Kunde, der bisher 250 € sah) — nur Anzeige, kein Geldbezug.
      fetch(`/api/fiaon/profile/${user.ref}`).then(r => r.json()).then(d => {
        if (!d?.ok) return;
        setUser((prev) => {
          const next = { ...prev, approvedLimit: d.approvedLimit ?? prev.approvedLimit, packName: d.packName ?? prev.packName };
          try { sessionStorage.setItem("fiaon_user", JSON.stringify(next)); } catch {}
          return next;
        });
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (section === 'account' && statusLoaded && !serverDocStatus.profileCompletedAt) {
      setTimeout(() => profileFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    }
  }, [section, statusLoaded]);

  useEffect(() => {
    if (section === 'account' && user?.ref && !profileData && !profileLoading) {
      setProfileLoading(true);
      fetch(`/api/fiaon/profile/${user.ref}`).then(r => r.json()).then(d => {
        if (d.ok) {
          setProfileData(d);
          setProfileForm({
            movedRecently: d.movedRecently ?? false,
            previousStreet: d.previousStreet ?? '', previousZip: d.previousZip ?? '',
            previousCity: d.previousCity ?? '', previousCountry: d.previousCountry ?? 'Deutschland',
            passportNumber: d.passportNumber ?? '', passportExpiry: d.passportExpiry ?? '',
            hasAdditionalIncome: d.hasAdditionalIncome ?? false,
            additionalIncomeSources: d.additionalIncomeSources ?? '',
            additionalIncomeAmount: String(d.additionalIncomeAmount ?? ''),
            expensesFood: String(d.expensesFood ?? ''), expensesTransport: String(d.expensesTransport ?? ''),
            expensesInsurance: String(d.expensesInsurance ?? ''), expensesLoans: String(d.expensesLoans ?? ''),
            expensesSubscriptions: String(d.expensesSubscriptions ?? ''), expensesOther: String(d.expensesOther ?? ''),
          });
        }
      }).catch(() => {}).finally(() => setProfileLoading(false));
    }
  }, [section]);

  const handleProfileSave = async () => {
    if (!user?.ref) return;
    // Validate required fields
    const errs: Record<string,boolean> = {};
    if (!profileForm.passportNumber.trim()) errs.passportNumber = true;
    if (!profileForm.passportExpiry) errs.passportExpiry = true;
    const hasExpense = ['expensesFood','expensesTransport','expensesInsurance','expensesLoans','expensesSubscriptions','expensesOther'].some(k => Number((profileForm as any)[k]) > 0);
    if (!hasExpense) errs.expenses = true;
    if (profileForm.movedRecently) {
      if (!profileForm.previousStreet.trim()) errs.previousStreet = true;
      if (!profileForm.previousCity.trim()) errs.previousCity = true;
    }
    if (profileForm.hasAdditionalIncome) {
      if (!profileForm.additionalIncomeSources.trim()) errs.additionalIncomeSources = true;
      if (!profileForm.additionalIncomeAmount) errs.additionalIncomeAmount = true;
    }
    if (Object.keys(errs).length > 0) {
      setProfileErrors(errs);
      profileFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setProfileErrors({});
    setProfileSaving(true);
    try {
      const res = await fetch(`/api/fiaon/profile/${user.ref}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        const now = new Date().toISOString();
        setProfileSaved(true);
        setProfileData((prev: any) => prev ? { ...prev, ...profileForm, profileChangesRequested: false, profileCompletedAt: now } : prev);
        setServerDocStatus(prev => ({ ...prev, profileChangesRequested: false, profileCompletedAt: now }));
        setTimeout(() => setProfileSaved(false), 3000);
      }
    } catch {}
    setProfileSaving(false);
  };

  /**
   * Unterlage öffnen — über einen signierten, 15 Minuten gültigen Link.
   *
   * Bis zum 10.08.2026 stand hier ein direkter Link auf
   * /api/fiaon/document/<ref>/<art>. Diese Route war ungeschützt: Wer eine
   * Bestellreferenz kannte, konnte fremde Ausweise herunterladen. Jetzt
   * verlangt sie ein Token, das nur bekommt, wer Referenz UND E-Mail nennt.
   */
  const unterlageOeffnen = async (art: "bank-statement" | "id-card" | "schufa") => {
    if (!user?.ref || !user?.email) return;
    const r = await fetch("/api/fiaon/document-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: user.ref, email: user.email, art }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) { alert(j?.error || "Die Unterlage konnte nicht geöffnet werden."); return; }
    window.open(j.url, "_blank", "noopener");
  };

  const handleSchufaUpload = async () => {
    if (!schufaFile || !user?.ref) return;
    setIsSchufaUploading(true);
    const fd = new FormData();
    fd.append('ref', user.ref);
    fd.append('schufaDoc', schufaFile);
    try {
      const res = await fetch('/api/fiaon/upload-kyc', { method: 'POST', body: fd });
      const d = await res.json();
      if (res.ok && d.ok) {
        setServerDocStatus(prev => ({ ...prev, hasSchufa: true }));
        setSchufaFile(null);
        if (fileInputRef3.current) fileInputRef3.current.value = '';
      }
    } catch {}
    setIsSchufaUploading(false);
  };

  const handleUpload = useCallback(async () => {
    if (!bankStatementFile && !idFile) return;
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("ref", user.ref || "");
      if (bankStatementFile) fd.append("bankStatement", bankStatementFile);
      if (idFile) fd.append("idCard", idFile);
      const res = await fetch("/api/fiaon/upload-kyc", { method: "POST", body: fd });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Upload fehlgeschlagen");
      }
      const d = await res.json();
      setServerDocStatus(prev => ({
        ...prev,
        hasBankStatement: d.hasBankStatement,
        hasIdCard: d.hasIdCard,
        documentsUploadedAt: new Date().toISOString(),
        kycStatus: d.kycStatus ?? prev.kycStatus,
        reuploadBankStatement: d.reuploadBankStatement ?? prev.reuploadBankStatement,
        reuploadIdCard: d.reuploadIdCard ?? prev.reuploadIdCard,
      }));
      setBankStatementFile(null);
      setIdFile(null);
      if (fileInputRef1.current) fileInputRef1.current.value = "";
      if (fileInputRef2.current) fileInputRef2.current.value = "";
      if (d.allDocumentsUploaded) { setIsUploadSuccess(true); localStorage.setItem("kyc_uploaded", "true"); }
    } catch (err: any) { alert(err?.message || "Fehler beim Upload. Bitte erneut versuchen."); }
    finally { setIsUploading(false); }
  }, [bankStatementFile, idFile, user.ref]);

  /* ── NAV CONFIG ── */
  const NAV: { id: NavSection; label: string; badge?: string; icon: React.ReactNode }[] = [
    { id: "overview",   label: "Übersicht",      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
    { id: "roadmap",    label: "Fahrplan",       icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7"/></svg> },
    { id: "account",    label: "Mein Konto", badge: serverDocStatus.profileChangesRequested ? "!" : undefined, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
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
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md uppercase tracking-wider">Mitgliedsbereich</span>
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
        <a href="/abo-kuendigen"
          className="w-full mt-1 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Abo kündigen
        </a>
        <button onClick={() => { sessionStorage.removeItem("fiaon_user"); window.location.href = "/login"; }}
          className="w-full mt-1 flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Abmelden
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#f8fafd] overflow-hidden" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* ── Startgespräch ─────────────────────────────────────────────────
          Beim ersten Login eines bezahlten Kunden die Vollbild-Tafel, danach
          nur noch ein dezenter Banner. Die Komponente entscheidet das selbst
          und liefert nichts aus, wenn nichts ansteht.

          NACH der Willkommens-Tour, nicht daneben: Zwei Vollbild-Tafeln
          übereinander sind keine Begrüßung, sondern ein Stau. Gesehen im
          Screenshot vom 08.08.2026 — beide standen gleichzeitig da. */}
      {user.ref && !welcomeOpen && <StartgespraechGate kundenRef={user.ref} />}

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
          <button
            onClick={reopenWelcome}
            aria-label="Begrüßung erneut anzeigen"
            title="Begrüßung erneut anzeigen"
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center text-[13px] font-bold"
          >
            ?
          </button>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${serverDocStatus.accountStatus === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">{serverDocStatus.accountStatus === 'active' ? 'Zugang aktiv' : 'In Prüfung'}</span>
          </div>
        </header>

        {/* ── STICKY BANNER — nur AUSSERHALB der Übersicht ──
            Auf der Übersicht steht dieselbe Aufgabe ausführlich in „Noch zu
            erledigen" (mit Grund und Knopf). Beides gleichzeitig war dieselbe
            Aufforderung in zwei Tonlagen — einmal drängend, einmal sachlich.
            Auf allen anderen Seiten bleibt der Balken die Erinnerung. */}
        {statusLoaded && section !== "overview" && serverDocStatus.profileChangesRequested && (
          <div className="db-banner shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-amber-500 text-white z-10 relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <span className="text-[12px] font-bold">Rückfrage von FIAON: </span>
              <span className="text-[12px] truncate">{serverDocStatus.adminProfileNote || 'Bitte prüf deine Profilangaben unter „Mein Konto“.'}</span>
            </div>
            <button onClick={() => setSection("account")} className="shrink-0 text-[11px] font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap">
              Jetzt beantworten →
            </button>
          </div>
        )}

        {/* ── PROFIL UNVOLLSTÄNDIG BANNER (außerhalb der Übersicht) ── */}
        {statusLoaded && section !== "overview" && !serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested && (
          <div className="db-banner shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-[#1d4ed8] text-white z-10 relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-bold">Profil unvollständig: </span>
              <span className="text-[12px]">Reisepass, Ausgaben und weitere Angaben sind für die Freischaltung deines Zugangs erforderlich.</span>
            </div>
            <button onClick={() => setSection("account")} className="shrink-0 text-[11px] font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap">
              Jetzt ausfüllen →
            </button>
          </div>
        )}

        {/* ── ADMIN-NACHRICHT STICKY BANNER (außerhalb der Übersicht) ── */}
        {section !== "overview" && serverDocStatus.kycStatus === 'changes_requested' && serverDocStatus.adminNote && (
          <div className="db-banner shrink-0 flex items-center gap-3 px-4 sm:px-6 py-3 bg-rose-600 text-white z-10 relative">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-bold">Nachricht von FIAON: </span>
              <span className="text-[12px]">{serverDocStatus.adminNote}</span>
            </div>
            <button
              onClick={() => setSection("documents")}
              className="shrink-0 text-[11px] font-bold bg-white/20 hover:bg-white/30 transition-colors px-3 py-1.5 rounded-lg whitespace-nowrap"
            >
              Dokumente hochladen →
            </button>
          </div>
        )}

        {/* ── SCROLL AREA ── */}
        <main className="flex-1 overflow-y-auto">
          {/* Auf der Übersicht darf der Inhalt breiter atmen (vorher eine
              schmale Spalte mit toten Rändern), alle anderen Bereiche behalten
              ihre Lesebreite. */}
          <div key={sectionKey} className={`db-enter mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6 ${section === "overview" ? "max-w-4xl xl:max-w-6xl" : "max-w-4xl"}`}>

            {/* ════════════════ FAHRPLAN (Kundenprodukt) ════════════════ */}
            {section === "roadmap" && (
              /* ── DER FAHRPLAN WARTET AUF DAS STARTGESPRÄCH ──────────────
                 Die Geschäftsregel: „Erst nach ERLEDIGTEM Startgespräch wird
                 der Account voll freigeschaltet." Der Fahrplan ist genau das,
                 was im Gespräch erklärt wird — ihn vorher zu zeigen, hieße das
                 Gespräch zu entwerten. */
              stufe && !stufe.vollAktiv ? (
                <PortalSperre
                  titel="Dein Fahrplan wartet auf das Startgespräch"
                  text="Im Fahrplan steht Schritt für Schritt, was wann passiert. Wir gehen ihn
                        gemeinsam durch — fünfzehn Minuten am Telefon, danach ist er hier
                        dauerhaft offen. So weiß du, was die einzelnen Schritte für DICH
                        bedeuten, statt eine Liste zu lesen."
                  termin={stufe.termin}
                  aktion={stufe.termin ? null : {
                    text: "Termin wählen",
                    onClick: () => { window.location.reload(); },
                  }}
                />
              ) : (
              <RoadmapJourney userRef={user.ref} firstName={user.firstName} />
            ))}

            {/* ════════════════ OVERVIEW ════════════════ */}
            {section === "overview" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Dashboard</p>
                  <h1 className="text-2xl sm:text-3xl font-bold fiaon-gradient-text-animated tracking-tight">{greeting}, {user.firstName || "—"}.</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Willkommen in deinem FIAON-Bereich.</p>
                </div>

                {/* ── DER BONITÄTS-CHECK — stärkstes Element der Seite ──
                    Steht bewusst VOR den Kennzahlen und der Karte: Er ist das
                    Herzstück des Angebots und muss auf 380 px ohne Scrollen mit
                    seinem Knopf sichtbar sein. Der Kauf läuft über den
                    bestehenden Bestellweg (Modal), nichts an der Zahlung ist neu. */}
                <BonitaetsCheck
                  status={bonitaet}
                  loading={bonitaetLaedt}
                  onKaufen={() => setSchufaModal(true)}
                  onFahrplan={() => setSection("roadmap")}
                />

                {/* ── PREMIUM STATS GRID ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

                  {/* Paket-Rahmen */}
                  <PremiumStatCard
                    label="Paket-Rahmen"
                    value={eur(user.approvedLimit || 0)}
                    sub={user.packName || 'FIAON Programm'}
                    bg="linear-gradient(145deg,#0f2d5c 0%,#1a4a8a 50%,#1e56a0 100%)"
                    glow="#1a4a8a"
                    onClick={() => setActiveModal('limit')}
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>}
                  />

                  {/* Status */}
                  <PremiumStatCard
                    label="Status"
                    value={serverDocStatus.accountStatus === 'active' ? 'Aktiv' : serverDocStatus.accountStatus === 'suspended' ? 'Gesperrt' : 'In Prüfung'}
                    sub={serverDocStatus.accountStatus === 'active' ? 'Freigeschaltet' : serverDocStatus.accountStatus === 'suspended' ? 'Konto gesperrt' : 'Wird geprüft'}
                    bg={
                      serverDocStatus.accountStatus === 'active'
                        ? 'linear-gradient(145deg,#064e3b,#065f46,#047857)'
                        : serverDocStatus.accountStatus === 'suspended'
                        ? 'linear-gradient(145deg,#4c0519,#7f1d1d,#991b1b)'
                        : 'linear-gradient(145deg,#451a03,#78350f,#92400e)'
                    }
                    glow={
                      serverDocStatus.accountStatus === 'active' ? '#065f46'
                      : serverDocStatus.accountStatus === 'suspended' ? '#7f1d1d'
                      : '#78350f'
                    }
                    onClick={() => setActiveModal('status')}
                    badge={
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          serverDocStatus.accountStatus === 'active' ? 'bg-emerald-400 animate-pulse'
                          : serverDocStatus.accountStatus === 'suspended' ? 'bg-rose-400'
                          : 'bg-amber-400 animate-pulse'
                        }`} />
                        <span className="text-[10px] font-bold text-white/60">
                          {serverDocStatus.accountStatus === 'active' ? 'Online' : serverDocStatus.accountStatus === 'suspended' ? 'Blockiert' : 'Ausstehend'}
                        </span>
                      </div>
                    }
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
                  />

                  {/* Dokumente */}
                  <PremiumStatCard
                    label="Dokumente"
                    value={serverDocStatus.kycStatus === 'approved' ? 'Genehmigt' : serverDocStatus.kycStatus === 'changes_requested' ? 'Änderung' : docsOk ? 'Eingereicht' : 'Ausstehend'}
                    sub={serverDocStatus.kycStatus === 'approved' ? 'KYC bestätigt' : serverDocStatus.kycStatus === 'changes_requested' ? 'Bitte hochladen' : docsOk ? 'In Prüfung' : 'Upload nötig'}
                    bg={
                      serverDocStatus.kycStatus === 'approved'
                        ? 'linear-gradient(145deg,#064e3b,#065f46,#047857)'
                        : serverDocStatus.kycStatus === 'changes_requested'
                        ? 'linear-gradient(145deg,#4c0519,#7f1d1d,#991b1b)'
                        : 'linear-gradient(145deg,#1e1b4b,#312e81,#3730a3)'
                    }
                    glow={
                      serverDocStatus.kycStatus === 'approved' ? '#065f46'
                      : serverDocStatus.kycStatus === 'changes_requested' ? '#7f1d1d'
                      : '#312e81'
                    }
                    onClick={() => setSection('documents')}
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
                  />

                  {/* Paket */}
                  <PremiumStatCard
                    label="Paket"
                    value={paketKurz(user.packName) || '—'}
                    sub="Mitgliedschaft"
                    bg="linear-gradient(145deg,#1a0533,#2d1065,#3b0764)"
                    glow="#2d1065"
                    onClick={() => setActiveModal('paket')}
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>}
                  />
                </div>

                {/* Card + quick info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="db-enter" style={{ animationDelay: ".08s" }}>
                    <CreditCard3D user={user} />
                  </div>
                  <div className="fiaon-glass-panel rounded-2xl p-5 space-y-3 border border-white/60">
                    <h3 className="text-[13px] font-bold text-slate-700 uppercase tracking-wider">Übersicht</h3>
                    {[
                      ["Mitglied", `${user.firstName || "—"} ${user.lastName || ""}`],
                      ["Referenz", user.ref || "—"],
                      ["Paket", user.packName || "—"],
                      ["Paket-Rahmen", eur(user.approvedLimit || 0)],
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

                {/* ── PRODUKT und VERWALTUNG, sichtbar getrennt ──
                    Vorher standen hier zwei Hinweis-Banner UND eine gemischte
                    Vierer-Liste („1 von 4 erledigt"), in der die Bonitätsauskunft
                    zwischen Ausweis-Upload und Prüfung verschwand. Jetzt:
                      „Dein Weg"          — die Produktreise, motivierend.
                      „Noch zu erledigen" — Verwaltung, kompakt, mit Grund.
                    Jede Aufgabe erscheint nur an EINER Stelle. */}
                {statusLoaded && (
                  <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                    <IhrWeg status={bonitaet} />
                    <NochZuErledigen
                      stand={{
                        docsOk,
                        kycStatus: serverDocStatus.kycStatus,
                        accountStatus: serverDocStatus.accountStatus,
                        profileCompletedAt: serverDocStatus.profileCompletedAt,
                        profileChangesRequested: serverDocStatus.profileChangesRequested,
                        adminNote: serverDocStatus.adminNote,
                        adminProfileNote: serverDocStatus.adminProfileNote,
                      }}
                      onUnterlagen={() => setSection("documents")}
                      onKonto={() => setSection("account")}
                    />
                    <div className="xl:col-span-2">
                      <FahrplanVorschau status={bonitaet} onFahrplan={() => setSection("roadmap")} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ════════════════ ACCOUNT ════════════════ */}
            {section === "account" && (() => {
              const fmtDate = (v: any) => v ? new Date(v).toLocaleDateString('de-DE') : '—';
              const fmtEur = (v: any) => v != null && v !== '' ? eur(Number(v)) : '—';
              const tip = (id: string, text: string) => (
                <div className="relative inline-block ml-1.5">
                  <button type="button" onClick={() => setActiveTooltip(activeTooltip === id ? null : id)}
                    className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-colors align-middle">?</button>
                  {activeTooltip === id && (
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-6 z-50 w-60 bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2.5 shadow-2xl leading-relaxed pointer-events-none">
                      {text}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
                    </div>
                  )}
                </div>
              );
              const pf = (label: string, value: string) => (
                <div className="flex items-start justify-between py-3 border-b border-slate-50 last:border-0 gap-4">
                  <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider shrink-0 mt-0.5">{label}</span>
                  <span className="text-[13px] font-medium text-slate-800 text-right break-words max-w-[60%]">{value || '—'}</span>
                </div>
              );
              const totalExpenses = ['expensesFood','expensesTransport','expensesInsurance','expensesLoans','expensesSubscriptions','expensesOther']
                .reduce((s, k) => s + (Number((profileForm as any)[k]) || 0), 0);
              return (
              <div className="space-y-5" onClick={() => setActiveTooltip(null)}>
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">Profilverwaltung</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mein Konto</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Deine persönlichen Daten, Finanzangaben und Vertragsdetails.</p>
                </div>

                {/* ── Was fehlt Guide ── */}
                {!serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested && (
                  <div className="rounded-2xl border border-blue-100 overflow-hidden shadow-sm">
                    <div className="px-5 py-4 flex items-center gap-3.5" style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                      <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-white">Profil vervollständigen — erforderlich für die Freischaltung</div>
                        <div className="text-[11px] text-white/70 mt-0.5">Bitte füll alle Pflichtangaben im Formular unten aus und speichere sie.</div>
                      </div>
                    </div>
                    <div className="bg-white px-5 py-4 space-y-2.5">
                      {[
                        {
                          label: 'Reisepass-Nummer & Ablaufdatum',
                          done: !!(profileForm.passportNumber && profileForm.passportExpiry),
                          hint: 'Abschnitt 2 — Reisedokument',
                        },
                        {
                          label: 'Monatliche Ausgaben (Haushaltsbuch)',
                          done: !!(profileForm.expensesFood || profileForm.expensesTransport || profileForm.expensesInsurance || profileForm.expensesLoans || profileForm.expensesSubscriptions || profileForm.expensesOther),
                          hint: 'Abschnitt 4 — Monatliche Ausgaben',
                        },
                        {
                          label: profileForm.movedRecently ? 'Frühere Anschrift vollständig' : 'Angabe: Umzug in den letzten 6 Monaten',
                          done: !profileForm.movedRecently || !!(profileForm.previousStreet && profileForm.previousCity),
                          hint: 'Abschnitt 1 — Frühere Anschrift',
                        },
                        {
                          label: 'Angabe zu weiteren Einkünften',
                          done: !profileForm.hasAdditionalIncome || !!(profileForm.additionalIncomeSources && profileForm.additionalIncomeAmount),
                          hint: 'Abschnitt 3 — Weitere Einkünfte',
                        },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${item.done ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                            {item.done
                              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className={`text-[12px] font-semibold ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</span>
                            {!item.done && <span className="text-[11px] text-slate-400 ml-2">↓ {item.hint}</span>}
                          </div>
                        </div>
                      ))}
                      <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-50 mt-1">Scroll nach unten zum Abschnitt „Profil vervollständigen" und klick auf „Angaben speichern".</p>
                    </div>
                  </div>
                )}

                {/* Admin-Rückfrage Banner */}
                {serverDocStatus.profileChangesRequested && (
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #fbbf24', background: '#fffbeb' }}>
                    <div className="flex items-center gap-3 px-5 py-3.5" style={{ background: '#f59e0b', borderBottom: '1px solid #fbbf24' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <span className="text-[12px] font-bold text-white tracking-wide uppercase">Rückfrage von FIAON — Aktion erforderlich</span>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[13px] font-semibold text-amber-900 leading-relaxed">
                        {(serverDocStatus.adminProfileNote || profileData?.adminProfileNote) || 'FIAON hat eine Rückfrage zu deinen Profilangaben. Bitte prüf die nachfolgenden Felder und speichere deine aktualisierten Angaben.'}
                      </p>
                      <p className="text-[12px] text-amber-700 mt-2">Aktualisiere die entsprechenden Felder im Formular unten und klick auf <strong>„Angaben speichern"</strong>.</p>
                    </div>
                  </div>
                )}

                {/* ── Block 1: Vertragsübersicht ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vertragsübersicht</p>
                  </div>
                  <div className="px-5 divide-y divide-slate-50">
                    {pf("Referenznummer", user.ref)}
                    {pf("Vertragspaket", user.packName)}
                    {pf("Paket-Rahmen", eur(user.approvedLimit || 0))}
                    {pf("Zugangsstatus", serverDocStatus.accountStatus === 'active' ? 'Aktiv' : serverDocStatus.accountStatus === 'suspended' ? 'Gesperrt' : 'Ausstehend')}
                    {pf("KYC-Prüfungsstatus", serverDocStatus.kycStatus === 'approved' ? 'Genehmigt' : serverDocStatus.kycStatus === 'changes_requested' ? 'Änderung angefordert' : 'In Prüfung')}
                  </div>
                  <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                    <a href={`/api/fiaon/contract/${user.ref}`} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2563eb] hover:text-blue-700 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Mitgliedsvertrag herunterladen (PDF)
                    </a>
                  </div>
                </div>

                {/* ── Block 2: Persönliche Angaben ── */}
                {profileLoading ? (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-3">{[...Array(6)].map((_,i) => <div key={i} className="h-8 rounded-lg bg-slate-50 animate-pulse" />)}</div>
                ) : profileData && (
                  <>
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Persönliche Angaben</p>
                    </div>
                    <div className="px-5 divide-y divide-slate-50">
                      {pf("Vollständiger Name", `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim())}
                      {pf("Geburtsdatum", fmtDate(profileData.birthdate))}
                      {pf("Staatsangehörigkeit", profileData.nationality)}
                      {pf("E-Mail-Adresse", profileData.email)}
                      {pf("Telefonnummer", [profileData.phoneCountryCode, profileData.phone].filter(Boolean).join(' '))}
                      {pf("Wohnanschrift", [profileData.street, [profileData.zip, profileData.city].filter(Boolean).join(' '), profileData.country].filter(Boolean).join(', '))}
                      {pf("Wohnsituation", profileData.housing)}
                    </div>
                  </div>

                  {/* ── Block 3: Finanzprofil ── */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Finanzprofil</p>
                    </div>
                    <div className="px-5 divide-y divide-slate-50">
                      {pf("Monatliches Nettoeinkommen", fmtEur(profileData.income))}
                      {pf("Monatliche Kaltmiete", fmtEur(profileData.rent))}
                      {pf("Bestehende Verbindlichkeiten", fmtEur(profileData.debts))}
                      {pf("Beschäftigungsverhältnis", profileData.employment)}
                      {pf("Arbeitgeber", profileData.employer)}
                      {pf("Beschäftigt seit", profileData.employedSince)}
                      {pf("Verwendungszweck", profileData.purpose)}
                    </div>
                  </div>
                  </>
                )}

                {/* ── Block 4: Profil vervollständigen (Formular) ── */}
                <div ref={profileFormRef} className={`rounded-2xl overflow-hidden shadow-sm ${Object.keys(profileErrors).length > 0 ? 'ring-2 ring-rose-400' : 'border border-slate-100'} bg-white`}>
                  <div className={`px-5 py-4 border-b flex items-center justify-between ${Object.keys(profileErrors).length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${Object.keys(profileErrors).length > 0 ? 'text-rose-500' : 'text-slate-400'}`}>Pflichtangaben</p>
                      <h3 className="text-[14px] font-bold text-slate-900">Profil vervollständigen</h3>
                    </div>
                    {Object.keys(profileErrors).length > 0
                      ? <span className="text-[11px] text-rose-600 font-semibold bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200 flex items-center gap-1.5"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{Object.keys(profileErrors).length} Feld{Object.keys(profileErrors).length > 1 ? 'er' : ''} fehlt</span>
                      : (serverDocStatus.profileCompletedAt || profileData?.profileCompletedAt) && (
                        <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">✓ Zuletzt gespeichert {fmtDate(serverDocStatus.profileCompletedAt || profileData?.profileCompletedAt)}</span>
                      )}
                  </div>
                  <div className="px-5 py-6 space-y-8" onClick={e => e.stopPropagation()}>

                    {/* — Frühere Anschrift — */}
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">1</span>
                        Frühere Anschrift
                        {tip('moved', 'Sofern du in den letzten 6 Monaten deinen Hauptwohnsitz gewechselt hast, gib bitte deine vorherige Adresse an. Das brauchen wir für die Vollständigkeit deines Profils.')}
                      </h4>
                      <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
                        <input type="checkbox" checked={profileForm.movedRecently} onChange={e => setProfileForm(p => ({ ...p, movedRecently: e.target.checked }))} className="mt-0.5 w-4 h-4 accent-[#2563eb]" />
                        <div>
                          <span className="text-[13px] font-semibold text-slate-800">Ich bin in den letzten 6 Monaten umgezogen</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">Angabe gemäß § 505a BGB erforderlich</p>
                        </div>
                      </label>
                      {profileForm.movedRecently && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: profileErrors.previousStreet ? '#e11d48' : '#64748b' }}>Straße und Hausnummer (frühere Anschrift){profileErrors.previousStreet && <span className="ml-1 normal-case font-normal">— Pflichtfeld</span>}</label>
                            <input type="text" value={profileForm.previousStreet} onChange={e => { setProfileForm(p => ({...p, previousStreet: e.target.value})); if (e.target.value.trim()) setProfileErrors(p => ({...p, previousStreet: false})); }} placeholder="z. B. Musterstraße 12" className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.previousStreet ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">PLZ</label>
                            <input type="text" value={profileForm.previousZip} onChange={e => setProfileForm(p => ({...p, previousZip: e.target.value}))} placeholder="z. B. 10115" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: profileErrors.previousCity ? '#e11d48' : '#64748b' }}>Ort{profileErrors.previousCity && <span className="ml-1 normal-case font-normal">— Pflichtfeld</span>}</label>
                            <input type="text" value={profileForm.previousCity} onChange={e => { setProfileForm(p => ({...p, previousCity: e.target.value})); if (e.target.value.trim()) setProfileErrors(p => ({...p, previousCity: false})); }} placeholder="z. B. Berlin" className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.previousCity ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Land</label>
                            <input type="text" value={profileForm.previousCountry} onChange={e => setProfileForm(p => ({...p, previousCountry: e.target.value}))} placeholder="z. B. Deutschland" className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* — Reisedokument — */}
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">2</span>
                        Reisedokument
                        {tip('passport', 'Die Angabe deiner Reisedokument-Daten dient der eindeutigen Identifizierung gemäß dem Geldwäschegesetz (GwG).')}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: profileErrors.passportNumber ? '#e11d48' : '#64748b' }}>
                            Reisepass-Nummer{profileErrors.passportNumber && <span className="font-normal normal-case">— Pflichtfeld</span>}
                            {tip('passNum', 'Deine Reisepassnummer befindet sich oben rechts auf der Datenseite deines Reisepasses. Sie beginnt in Deutschland mit einem Buchstaben, gefolgt von 8 Ziffern (z. B. C01X0006).')}
                          </label>
                          <input type="text" value={profileForm.passportNumber} onChange={e => { setProfileForm(p => ({...p, passportNumber: e.target.value})); if (e.target.value.trim()) setProfileErrors(p => ({...p, passportNumber: false})); }} placeholder="z. B. C01X0006" className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.passportNumber ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: profileErrors.passportExpiry ? '#e11d48' : '#64748b' }}>
                            Gültig bis (Ablaufdatum){profileErrors.passportExpiry && <span className="font-normal normal-case">— Pflichtfeld</span>}
                            {tip('passExp', 'Das Ablaufdatum deines Reisepasses findest du auf der Datenseite unter „Gültig bis". Dein Reisepass muss für die Antragstellung noch gültig sein.')}
                          </label>
                          <input type="date" value={profileForm.passportExpiry} onChange={e => { setProfileForm(p => ({...p, passportExpiry: e.target.value})); if (e.target.value) setProfileErrors(p => ({...p, passportExpiry: false})); }} className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.passportExpiry ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                        </div>
                      </div>
                    </div>

                    {/* — Weitere Einkünfte — */}
                    <div>
                      <h4 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">3</span>
                        Weitere Einkünfte
                        {tip('addInc', 'Weitere Einkünfte umfassen z. B. Mieteinnahmen, Kapitalerträge, Nebentätigkeiten, Unterhaltszahlungen oder sonstige regelmäßige Einnahmen neben deinem Hauptgehalt.')}
                      </h4>
                      <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
                        <input type="checkbox" checked={profileForm.hasAdditionalIncome} onChange={e => setProfileForm(p => ({...p, hasAdditionalIncome: e.target.checked}))} className="mt-0.5 w-4 h-4 accent-[#2563eb]" />
                        <div>
                          <span className="text-[13px] font-semibold text-slate-800">Ich verfüge über weitere Einkünfte neben meinem Haupteinkommen</span>
                          <p className="text-[11px] text-slate-400 mt-0.5">z. B. Mieteinnahmen, Kapitalerträge, Unterhalt</p>
                        </div>
                      </label>
                      {profileForm.hasAdditionalIncome && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-7">
                          <div className="col-span-2">
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: profileErrors.additionalIncomeSources ? '#e11d48' : '#64748b' }}>
                              Art der weiteren Einkünfte{profileErrors.additionalIncomeSources && <span className="font-normal normal-case">— Pflichtfeld</span>}
                              {tip('incType', 'Bitte beschreib die Herkunft deiner zusätzlichen Einkünfte, z. B. „Vermietung Eigentumswohnung", „Dividendeneinnahmen" oder „selbstständige Nebentätigkeit".')}
                            </label>
                            <textarea value={profileForm.additionalIncomeSources} onChange={e => { setProfileForm(p => ({...p, additionalIncomeSources: e.target.value})); if (e.target.value.trim()) setProfileErrors(p => ({...p, additionalIncomeSources: false})); }} placeholder="z. B. Mieteinnahmen aus Eigentumswohnung, freiberufliche Tätigkeit" rows={2} className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all resize-none ${profileErrors.additionalIncomeSources ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: profileErrors.additionalIncomeAmount ? '#e11d48' : '#64748b' }}>
                              Ungefährer Monatsbetrag (€){profileErrors.additionalIncomeAmount && <span className="font-normal normal-case">— Pflichtfeld</span>}
                              {tip('incAmt', 'Gib den durchschnittlichen monatlichen Nettobetrag deiner weiteren Einkünfte an.')}
                            </label>
                            <input type="number" min="0" value={profileForm.additionalIncomeAmount} onChange={e => { setProfileForm(p => ({...p, additionalIncomeAmount: e.target.value})); if (e.target.value) setProfileErrors(p => ({...p, additionalIncomeAmount: false})); }} placeholder="z. B. 500" className={`w-full px-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.additionalIncomeAmount ? 'border-rose-400 bg-rose-50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* — Monatliche Ausgaben — */}
                    <div>
                      <h4 className={`text-[12px] font-bold uppercase tracking-wider mb-1 flex items-center gap-2 ${profileErrors.expenses ? 'text-rose-600' : 'text-slate-700'}`}>
                        <span className={`w-5 h-5 rounded-md text-white text-[9px] font-bold flex items-center justify-center ${profileErrors.expenses ? 'bg-rose-500' : 'bg-slate-900'}`}>4</span>
                        Monatliche Ausgaben
                        {profileErrors.expenses && <span className="text-[11px] font-normal normal-case text-rose-500">— Mindestens ein Betrag erforderlich</span>}
                        {tip('expenses', 'Deine monatlichen Ausgaben helfen bei der Haushaltsübersicht innerhalb deines FIAON-Programms. Bitte gib Schätzwerte in Euro an. Bereits an anderer Stelle angegebene Verpflichtungen müssen nicht erneut aufgeführt werden.')}
                      </h4>
                      <p className="text-[11px] text-slate-400 mb-4 pl-7">Angaben zu deiner monatlichen Haushaltsübersicht — bitte in Euro/Monat</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: 'expensesFood',          label: 'Lebensmittel & Haushaltsbedarf',     tip: 'expF', tipText: 'Schätzung deiner monatlichen Ausgaben für Lebensmittel, Drogerieartikel und sonstige Haushaltswaren.' },
                          { key: 'expensesTransport',     label: 'Mobilität (Kfz, ÖPNV, Kraftstoff)',  tip: 'expT', tipText: 'Monatliche Kosten für Fahrzeugversicherung, Kraftstoff, ÖPNV-Tickets oder Leasing-/Kreditraten.' },
                          { key: 'expensesInsurance',     label: 'Versicherungsbeiträge',               tip: 'expI', tipText: 'Summe aller monatlichen Versicherungsbeiträge (Haftpflicht, Hausrat, Berufsunfähigkeit etc.), sofern nicht bereits als Lohnabzug ausgewiesen.' },
                          { key: 'expensesLoans',         label: 'Laufende Kredit- & Ratenverpflichtungen', tip: 'expL', tipText: 'Monatliche Raten für bestehende Darlehen, Ratenkäufe oder Leasingverträge (sofern nicht bereits unter „Verbindlichkeiten" angegeben).' },
                          { key: 'expensesSubscriptions', label: 'Abonnements & Mitgliedschaften',      tip: 'expS', tipText: 'Monatliche Ausgaben für Streaming-Dienste, Fitnessstudio, Zeitschriften und vergleichbare wiederkehrende Verpflichtungen.' },
                          { key: 'expensesOther',         label: 'Sonstige regelmäßige Ausgaben',       tip: 'expO', tipText: 'Alle weiteren monatlichen Ausgaben, die in den obigen Kategorien nicht erfasst sind (z. B. Kinderbetreuung, Unterhaltszahlungen).' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center">
                              {f.label}
                              {tip(f.tip, f.tipText)}
                            </label>
                            <div className="relative">
                              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium ${profileErrors.expenses ? 'text-rose-400' : 'text-slate-400'}`}>€</span>
                              <input type="number" min="0" value={(profileForm as any)[f.key]} onChange={e => { setProfileForm(p => ({...p, [f.key]: e.target.value})); if (Number(e.target.value) > 0) setProfileErrors(p => ({...p, expenses: false})); }} placeholder="0" className={`w-full pl-7 pr-3.5 py-2.5 rounded-xl border text-[13px] text-slate-800 focus:outline-none focus:ring-2 transition-all ${profileErrors.expenses ? 'border-rose-300 bg-rose-50/50 focus:ring-rose-100' : 'border-slate-200 bg-slate-50 focus:ring-blue-100 focus:border-blue-300'}`} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {totalExpenses > 0 && (
                        <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[12px] font-bold text-slate-600 uppercase tracking-wider">Gesamte monatliche Ausgaben</span>
                          <span className="text-[14px] font-bold text-slate-900">{eur(totalExpenses)}</span>
                        </div>
                      )}
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                      <button onClick={handleProfileSave} disabled={profileSaving} className="px-6 py-2.5 bg-slate-900 text-white text-[13px] font-bold rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors">
                        {profileSaving ? 'Wird gespeichert…' : 'Angaben speichern'}
                      </button>
                      {profileSaved && <span className="text-[12px] font-semibold text-emerald-600 flex items-center gap-1.5"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>Erfolgreich gespeichert</span>}
                    </div>
                  </div>
                </div>

                {/* ── Block 5: Sicherheit ── */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Sicherheit</p>
                  <h3 className="text-[13px] font-bold text-slate-800 mb-1">Zugangsdaten ändern</h3>
                  <p className="text-[12px] text-slate-500 mb-3">Nutze die Passwort-Vergessen-Funktion, um dein Kennwort zu erneuern.</p>
                  <a href="/passwort-vergessen" className="inline-flex items-center gap-2 text-[12px] font-semibold text-[#2563eb] hover:underline">
                    Passwort zurücksetzen →
                  </a>
                </div>
              </div>
              );
            })()}

            {/* ════════════════ DOCUMENTS ════════════════ */}
            {section === "documents" && (
              <div className="space-y-6">
                <div>
                  <p className="text-[11px] text-[#2563eb] font-bold uppercase tracking-[.18em] mb-1">KYC Verifizierung</p>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dokumente</h1>
                  <p className="text-[13px] text-slate-500 mt-1">Upload zur Freischaltung deines Zugangs. Alle Uploads sind verschlüsselt.</p>
                </div>

                {/* Admin-Nachricht prominent im Dokumente-Bereich */}
                {serverDocStatus.kycStatus === 'changes_requested' && serverDocStatus.adminNote && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-rose-800">Nachricht von FIAON</div>
                      <div className="text-[13px] text-rose-700 mt-1 leading-relaxed">„{serverDocStatus.adminNote}"</div>
                      <div className="text-[11px] text-rose-500 mt-2">Bitte lade deine Dokumente erneut hoch. Wir prüfen diese umgehend.</div>
                    </div>
                  </div>
                )}

                {/* ── CASE 1: changes_requested — selektiver Reupload ── */}
                {serverDocStatus.kycStatus === 'changes_requested' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Kontoauszug — nur wenn angefordert */}
                      {serverDocStatus.reuploadBankStatement ? (
                        <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-sm p-5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Neu erforderlich</span>
                          </div>
                          <h3 className="text-[14px] font-bold text-slate-800 mb-1">Kontoauszüge</h3>
                          <p className="text-[11px] text-slate-400 mb-4">Letzten 6 Monate, alle Seiten als PDF</p>
                          {!bankStatementFile ? (
                            <>
                              <div onClick={() => fileInputRef1.current?.click()} className="h-24 rounded-xl border-2 border-dashed border-rose-200 hover:border-rose-400 hover:bg-rose-50/30 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-rose-300 group-hover:text-rose-500 mb-1.5 transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                <span className="text-[12px] font-semibold text-slate-500 group-hover:text-rose-600 transition-colors">Neues PDF auswählen</span>
                                <span className="text-[10px] text-slate-300 mt-0.5">max. 10 MB</span>
                              </div>
                              <input ref={fileInputRef1} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setBankStatementFile(e.target.files[0])} />
                            </>
                          ) : (
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                              <div className="truncate pr-3">
                                <div className="text-[12px] font-semibold text-white truncate">{bankStatementFile.name}</div>
                                <div className="text-[10px] text-emerald-400">Bereit zum Hochladen</div>
                              </div>
                              <button onClick={() => setBankStatementFile(null)} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-widest font-bold shrink-0">×</button>
                            </div>
                          )}
                          <button onClick={() => setSection("bank-guide")} className="mt-3 text-[11px] font-semibold text-[#2563eb] hover:underline flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            Anleitung: PDF herunterladen
                          </button>
                        </div>
                      ) : (
                        /* Kontoauszug wurde NICHT angefordert — als akzeptiert anzeigen */
                        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-slate-800">Kontoauszüge</div>
                            <div className="text-[11px] text-emerald-600 font-semibold">Akzeptiert ✓</div>
                          </div>
                        </div>
                      )}

                      {/* Ausweis — nur wenn angefordert */}
                      {serverDocStatus.reuploadIdCard ? (
                        <div className="bg-white rounded-2xl border-2 border-rose-200 shadow-sm p-5">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Neu erforderlich</span>
                          </div>
                          <h3 className="text-[14px] font-bold text-slate-800 mb-1">Identitätsnachweis</h3>
                          <p className="text-[11px] text-slate-400 mb-4">Reisepass oder Personalausweis als PDF</p>
                          {!idFile ? (
                            <>
                              <div onClick={() => fileInputRef2.current?.click()} className="h-24 rounded-xl border-2 border-dashed border-rose-200 hover:border-rose-400 hover:bg-rose-50/30 flex flex-col items-center justify-center cursor-pointer transition-all group">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-rose-300 group-hover:text-rose-500 mb-1.5 transition-colors"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><circle cx="12" cy="13" r="2"/><path d="M8 17c0-1.1 1.8-2 4-2s4 .9 4 2"/></svg>
                                <span className="text-[12px] font-semibold text-slate-500 group-hover:text-rose-600 transition-colors">Neues PDF auswählen</span>
                                <span className="text-[10px] text-slate-300 mt-0.5">max. 10 MB</span>
                              </div>
                              <input ref={fileInputRef2} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files && setIdFile(e.target.files[0])} />
                            </>
                          ) : (
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl">
                              <div className="truncate pr-3">
                                <div className="text-[12px] font-semibold text-white truncate">{idFile.name}</div>
                                <div className="text-[10px] text-emerald-400">Bereit zum Hochladen</div>
                              </div>
                              <button onClick={() => setIdFile(null)} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-widest font-bold shrink-0">×</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Ausweis wurde NICHT angefordert */
                        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-slate-800">Identitätsnachweis</div>
                            <div className="text-[11px] text-emerald-600 font-semibold">Akzeptiert ✓</div>
                          </div>
                        </div>
                      )}
                    </div>

                    {(bankStatementFile || idFile) && (
                      <button onClick={handleUpload} disabled={isUploading} className="w-full py-3.5 rounded-xl text-[14px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#e11d48,#be123c)" }}>
                        {isUploading ? <><svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Hochladen…</> : <>Neue Dokumente hochladen<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                      </button>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                      Ende-zu-Ende verschlüsselt — deine Daten sind sicher
                    </div>
                  </div>
                )}

                {/* ── CASE 2: Dokumente hochgeladen & in Prüfung / approved ── */}
                {docsOk && serverDocStatus.kycStatus !== 'changes_requested' && (
                  <div className="space-y-4">
                    <div className={`fiaon-glass-panel rounded-2xl p-5 flex items-start gap-4 ${serverDocStatus.kycStatus === 'approved' ? 'border border-emerald-300 bg-emerald-50/50' : 'border border-emerald-200 bg-emerald-50/50'}`}>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-emerald-800">
                          {serverDocStatus.kycStatus === 'approved' ? 'Dokumente genehmigt' : 'Dokumente hochgeladen'}
                        </div>
                        <div className="text-[12px] text-emerald-700 mt-1">
                          {serverDocStatus.kycStatus === 'approved'
                            ? 'Deine Unterlagen wurden von FIAON geprüft und genehmigt.'
                            : 'Unser Team prüft deine Unterlagen. Wir melden uns innerhalb von 1–3 Werktagen.'}
                        </div>
                        <div className="flex items-center gap-1.5 mt-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-semibold text-emerald-600">
                            {serverDocStatus.kycStatus === 'approved' ? 'Genehmigt' : 'In Bearbeitung'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {serverDocStatus.documentsUploadedAt && (
                      <div className="text-[11px] text-slate-400 text-center">
                        Hochgeladen am {new Date(serverDocStatus.documentsUploadedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {serverDocStatus.hasBankStatement && (
                        <button type="button" onClick={() => void unterlageOeffnen("bank-statement")} className="w-full text-left flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-slate-800 truncate">Kontoauszüge</div>
                            <div className="text-[11px] text-slate-400">PDF herunterladen</div>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-300 group-hover:text-[#2563eb] transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      )}
                      {serverDocStatus.hasIdCard && (
                        <button type="button" onClick={() => void unterlageOeffnen("id-card")} className="w-full text-left flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><circle cx="12" cy="13" r="2"/><path d="M8 17c0-1.1 1.8-2 4-2s4 .9 4 2"/></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-slate-800 truncate">Identitätsnachweis</div>
                            <div className="text-[11px] text-slate-400">PDF herunterladen</div>
                          </div>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-slate-300 group-hover:text-[#2563eb] transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* ── CASE 3: Erstmaliger Upload — noch keine Dokumente ── */}
                {!docsOk && serverDocStatus.kycStatus !== 'changes_requested' && (
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

                {/* ── SCHUFA-NACHWEIS SEKTION (immer sichtbar) ── */}
                <div className={`rounded-2xl overflow-hidden border ${serverDocStatus.hasSchufa ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'} shadow-sm`}>
                  {/* Header */}
                  <div className={`px-5 py-4 flex items-center justify-between border-b ${serverDocStatus.hasSchufa ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${serverDocStatus.hasSchufa ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                        {serverDocStatus.hasSchufa
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        }
                      </div>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 ${serverDocStatus.hasSchufa ? 'text-emerald-500' : 'text-amber-500'}`}>03 — Neu erforderlich</p>
                        <h3 className="text-[14px] font-bold text-slate-800">SCHUFA-Nachweis</h3>
                      </div>
                    </div>
                    {serverDocStatus.hasSchufa
                      ? <span className="text-[11px] font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full">Hochgeladen ✓</span>
                      : bonitaet?.zustand === "bezahlt"
                        ? <span className="text-[11px] font-bold text-[#2563eb] bg-blue-50 px-3 py-1 rounded-full">Wird beschafft</span>
                        : bonitaet?.zustand === "zahlung_offen"
                          ? <span className="text-[11px] font-bold text-[#2563eb] bg-blue-50 px-3 py-1 rounded-full">Bestellt</span>
                          : <span className="text-[11px] font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full">Ausstehend</span>
                    }
                  </div>

                  <div className="px-5 py-5 space-y-5">
                    {/* Wer bei FIAON gekauft hat, wird hier NICHT mehr zum
                        Hochladen gedrängt — er erfährt seinen echten Stand.
                        Reine Anzeige; die Freischaltungslogik ist unverändert
                        (siehe SYSTEM_DIAGNOSE.md, Abschnitt B3). */}
                    {!serverDocStatus.hasSchufa && (bonitaet?.zustand === "bezahlt" || bonitaet?.zustand === "zahlung_offen") && (
                      <div className="rounded-xl px-4 py-3.5" style={{ background: "rgba(37,99,235,.06)", border: "1px solid rgba(37,99,235,.18)" }}>
                        <p className="text-[12.5px] font-bold text-slate-800 leading-snug">
                          {bonitaet?.zustand === "bezahlt"
                            ? "Du hast deine Auskunft bei FIAON bestellt und bezahlt."
                            : "Du hast deine Auskunft bei FIAON bestellt."}
                        </p>
                        <p className="text-[12px] text-slate-600 leading-relaxed mt-1">
                          {bonitaet?.zustand === "bezahlt"
                            ? "Wir beschaffen sie und melden uns per E-Mail. Du musst hier nichts hochladen — die Angaben unten gelten nur, wenn du die Auskunft selbst anfordern."
                            : "Sobald deine Zahlung eingeht, beschaffen wir die Auskunft für dich."}
                        </p>
                        {bonitaet?.zustand === "zahlung_offen" && bonitaet?.bestellung?.paymentReference && (
                          <a href={`/zahlung/${bonitaet.bestellung.paymentReference}`} className="inline-flex items-center gap-1.5 text-[12px] font-bold mt-2" style={{ color: "#2563eb" }}>
                            Zahlung abschließen
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                          </a>
                        )}
                      </div>
                    )}
                    {serverDocStatus.hasSchufa ? (
                      <div className="flex items-center gap-3 py-1">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        <p className="text-[13px] text-emerald-700 font-semibold">Dein SCHUFA-Nachweis wurde erfolgreich übermittelt. Vielen Dank!</p>
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] text-slate-500 leading-relaxed">
                          Für die Freischaltung deines Zugangs benötigen wir auch deine <strong className="text-slate-800">Bonitätsauskunft</strong>. Du hast zwei Möglichkeiten:
                        </p>

                        {/* Option A: FIAON kaufen */}
                        <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #2563eb', background: 'linear-gradient(135deg, #eff6ff, #f0f4ff)' }}>
                          <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Empfohlen — Sofort & mit Vorteilen</span>
                          </div>
                          <div className="px-4 py-4">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="text-[13px] font-bold text-slate-900">FIAON SCHUFA-Auskunft</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">Vollauskunft + Handlungsplan · Lieferung noch heute</p>
                              </div>
                              <span className="text-[14px] font-extrabold text-[#2563eb] shrink-0">74 €</span>
                            </div>
                            <ul className="space-y-1 mb-4">
                              {['Tagesaktuelle SCHUFA-Vollauskunft', 'Persönlicher Score-Verbesserungsplan', 'SCHUFA-neutraler Abruf', 'Express — Am selben Werktag'].map(f => (
                                <li key={f} className="flex items-center gap-2 text-[11px] text-slate-600">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="4 12 10 18 20 6"/></svg>
                                  {f}
                                </li>
                              ))}
                            </ul>
                            <button
                              onClick={() => setSchufaModal(true)}
                              className="w-full py-2.5 rounded-xl text-[13px] font-bold text-white flex items-center justify-center gap-2"
                              style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)', boxShadow: '0 6px 20px rgba(37,99,235,0.3)' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                              Jetzt bei FIAON bestellen (Daten bereits hinterlegt)
                            </button>
                          </div>
                        </div>

                        {/* Option B: Selbst anfordern */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                          <button
                            onClick={() => setSchufaGuideOpen(v => !v)}
                            className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              <span className="text-[12px] font-semibold text-slate-700">Selbst bei der SCHUFA anfordern (kostenlos)</span>
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" className={`transition-transform ${schufaGuideOpen ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                          </button>
                          {schufaGuideOpen && (
                            <div className="px-4 py-4 space-y-3 border-t border-slate-100">
                              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
                                <p className="text-[11px] text-amber-800 leading-relaxed"><strong>Wichtig:</strong> Die kostenlose Datenkopie nach Art. 15 DSGVO kann <strong>bis zu 4 Wochen</strong> dauern. Die Lieferung erfolgt per Post. Bis zum Eingang wird deine Freischaltung pausiert.</p>
                              </div>
                              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">Schritt-für-Schritt Anleitung:</p>
                              {[
                                { n: '1', text: 'Geh zu meineschufa.de → „Meine Schufa" → „Datenkopie nach Art. 15 DSGVO"' },
                                { n: '2', text: 'Wähl „Online beantragen“ und gib deine persönlichen Daten ein.' },
                                { n: '3', text: 'Schick den Antrag ab. Du erhältst eine Bestätigung per E-Mail.' },
                                { n: '4', text: 'Die SCHUFA sendet das Dokument innerhalb von 2–4 Wochen per Post an deine Meldeanschrift.' },
                                { n: '5', text: 'Scanne das Dokument als PDF und lad es hier hoch.' },
                              ].map(step => (
                                <div key={step.n} className="flex items-start gap-3">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step.n}</span>
                                  <p className="text-[12px] text-slate-600 leading-relaxed">{step.text}</p>
                                </div>
                              ))}
                              <a href="https://www.meineschufa.de" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2563eb] hover:underline mt-1">
                                meineschufa.de öffnen →
                              </a>
                            </div>
                          )}
                        </div>

                        {/* SCHUFA Upload */}
                        <div>
                          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Erhaltene SCHUFA hier hochladen:</p>
                          {!schufaFile ? (
                            <div onClick={() => fileInputRef3.current?.click()} className="h-20 rounded-xl border-2 border-dashed border-slate-200 hover:border-[#2563eb] hover:bg-blue-50/30 flex items-center justify-center gap-3 cursor-pointer transition-all group">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-slate-300 group-hover:text-[#2563eb] transition-colors"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                              <span className="text-[12px] font-semibold text-slate-500 group-hover:text-[#2563eb] transition-colors">SCHUFA-PDF auswählen</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between p-3 bg-slate-900 rounded-xl mb-2">
                              <div className="truncate pr-3">
                                <div className="text-[12px] font-semibold text-white truncate">{schufaFile.name}</div>
                                <div className="text-[10px] text-emerald-400">Bereit zum Hochladen</div>
                              </div>
                              <button onClick={() => setSchufaFile(null)} className="text-[10px] text-slate-400 hover:text-white uppercase tracking-widest font-bold shrink-0">×</button>
                            </div>
                          )}
                          <input ref={fileInputRef3} type="file" accept=".pdf,image/*" className="hidden" onChange={e => e.target.files && setSchufaFile(e.target.files[0])} />
                          {schufaFile && (
                            <button onClick={handleSchufaUpload} disabled={isSchufaUploading} className="mt-2 w-full py-2.5 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }}>
                              {isSchufaUploading ? <><svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>Wird hochgeladen…</> : <>SCHUFA hochladen<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

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

                {/* Cancellation */}
                <a href="/abo-kuendigen" className="flex items-center justify-between gap-4 p-5 bg-white border border-rose-100 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-rose-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0 group-hover:bg-rose-100 transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-800 group-hover:text-rose-600 transition-colors">Abo kündigen</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Antrag wird geprüft &amp; bestätigt</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </a>
                <div className="fiaon-glass-panel rounded-2xl border border-white/60 p-5">
                  <h3 className="text-[13px] font-bold text-slate-700 mb-4">Häufige Fragen</h3>
                  <div className="space-y-3">
                    {[
                      ["Wie lade ich meine Kontoauszüge hoch?", "Gehe zu Dokumente und wähle die PDF-Datei deiner Kontoauszüge aus. Nutze unsere Kontoauszüge-Seite für eine Anleitung je nach Bank."],
                      ["Wie lange dauert die Prüfung?", "Nach dem Upload prüft unser Team deine Unterlagen innerhalb von 1–3 Werktagen."],
                      ["Kann ich mein Passwort ändern?", "Ja, nutze die Passwort-Vergessen Funktion auf der Login-Seite — keine E-Mail-Bestätigung nötig."],
                      ["Was ist der Paket-Rahmen?", "Der Paket-Rahmen ist die deinem gewählten Paket zugeordnete Stufe innerhalb deines FIAON-Programms. Er dient der Orientierung über deinen Programm-Umfang."],
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

      {/* ══════════════ SCHUFA KAUF MODAL ══════════════ */}
      {schufaModal && (
        <div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(3,7,18,.80)', backdropFilter: 'blur(16px)' }}
          onClick={() => setSchufaModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl overflow-hidden db-enter"
            style={{ background: 'linear-gradient(165deg,#0d1117 0%,#161b27 100%)', border: '1px solid rgba(37,99,235,.25)', boxShadow: '0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(37,99,235,.12) inset' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #1d4ed8, #3b82f6, #1d4ed8)' }} />

            <div className="p-7">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#1d4ed8,#2563eb)' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">FIAON SCHUFA-Auskunft</span>
                  </div>
                  <h2 className="text-[18px] font-extrabold text-white leading-tight">SCHUFA-Vollauskunft bestellen</h2>
                  <p className="text-[12px] text-white/40 mt-1">Express-Lieferung noch heute · 74 € einmalig</p>
                </div>
                <button onClick={() => setSchufaModal(false)} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/12 transition-all">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Pre-filled data banner */}
              <div className="rounded-2xl mb-5 overflow-hidden" style={{ border: '1px solid rgba(37,99,235,.2)', background: 'rgba(37,99,235,.08)' }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(37,99,235,.12)', background: 'rgba(37,99,235,.12)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round"><polyline points="4 12 10 18 20 6"/></svg>
                  <span className="text-[11px] font-bold text-blue-300 uppercase tracking-wider">Deine Daten wurden bereits übernommen</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    { label: 'Name', value: `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—' },
                    { label: 'E-Mail', value: user.email || '—' },
                    { label: 'Referenz', value: user.ref || '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-[11px] text-white/35 font-medium">{row.label}</span>
                      <span className="text-[12px] text-white/75 font-semibold">{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefits */}
              <ul className="space-y-2 mb-6">
                {[
                  'Tagesaktuelle SCHUFA-Vollauskunft',
                  'Persönlicher Score-Verbesserungsplan von FIAON',
                  'SCHUFA-neutraler Abruf — kein Einfluss auf Score',
                  'Express: Lieferung per E-Mail am selben Werktag',
                  'Gilt als offizieller Nachweis für deine Freischaltung',
                ].map(b => (
                  <li key={b} className="flex items-center gap-2.5 text-[12px] text-white/60">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><polyline points="4 12 10 18 20 6"/></svg>
                    {b}
                  </li>
                ))}
              </ul>

              {/* CTA — Bestellung per Banküberweisung anlegen und zur Zahlungsseite */}
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const res = await fetch("/api/fiaon/payment-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        kind: "schufa",
                        email: user.email || "",
                        firstName: user.firstName || "",
                        lastName: user.lastName || "",
                      }),
                    });
                    const json = await res.json().catch(() => null);
                    if (res.ok && json?.ok && json.paymentReference) {
                      setSchufaModal(false);
                      window.location.href = `/zahlung/${json.paymentReference}`;
                    }
                  } catch {}
                }}
                className="block w-full text-center py-4 rounded-2xl text-[15px] font-extrabold text-white relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)', boxShadow: '0 16px 40px rgba(37,99,235,0.4)', letterSpacing: '0.04em' }}
              >
                <span className="relative z-10">Jetzt bezahlen &amp; Auskunft erhalten — 74 €</span>
                <div className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)', animation: 'bonShimmer 3s ease-in-out infinite' }} />
              </button>
              <p className="text-[11px] text-white/25 text-center mt-3 flex items-center justify-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z"/></svg>
                Aktivierung per Banküberweisung – Zugang nach Zahlungseingang · Einmalig
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ PREMIUM MODALS ══════════════ */}
      {activeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(3,7,18,.75)', backdropFilter: 'blur(14px)' }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl overflow-hidden db-enter"
            style={{ background: 'linear-gradient(165deg,#0d1117 0%,#161b27 100%)', border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 32px 80px rgba(0,0,0,.65), 0 1px 0 rgba(255,255,255,.06) inset' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent)' }} />

            {/* ── LIMIT MODAL ── */}
            {activeModal === 'limit' && (
              <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(145deg,#1a4a8a,#2563eb)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[.2em] mb-1">Paket-Rahmen</p>
                <div className="text-4xl font-bold text-white tracking-tight mb-1">{eur(user.approvedLimit || 0)}</div>
                <p className="text-[12px] text-white/35 mb-6">{user.packName || 'FIAON Standard'}</p>
                <div className="space-y-0 mb-6">
                  {[
                    ['Paket-Rahmen', eur(user.approvedLimit || 0)],
                    ['Paket', user.packName || '—'],
                    ['Status', 'Aktiv'],
                  ].map(([k, v], i) => (
                    <div key={k} className="flex items-center justify-between py-3 border-b border-white/[.05]">
                      <span className="text-[12px] text-white/45">{k}</span>
                      <span className={`text-[13px] font-semibold ${i === 2 ? 'text-emerald-400' : 'text-white/85'}`}>{v}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <p className="text-[12px] text-white/55 leading-relaxed">Möchtest du deinen Paket-Rahmen anpassen? Wende dich direkt an unser Team — wir prüfen deinen Wunsch individuell und diskret.</p>
                </div>
                <a href="mailto:limit@fiaon.com" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-[13px] text-white transition-all hover:opacity-90 active:scale-[.98]" style={{ background: 'linear-gradient(135deg,#1a4a8a,#2563eb)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  limit@fiaon.com kontaktieren
                </a>
              </div>
            )}

            {/* ── STATUS MODAL ── */}
            {activeModal === 'status' && (
              <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: serverDocStatus.accountStatus === 'active' ? 'linear-gradient(145deg,#065f46,#059669)' : serverDocStatus.accountStatus === 'suspended' ? 'linear-gradient(145deg,#7f1d1d,#dc2626)' : 'linear-gradient(145deg,#78350f,#d97706)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[.2em] mb-1">Zugangsstatus</p>
                <div className="text-3xl font-bold text-white tracking-tight mb-1">{serverDocStatus.accountStatus === 'active' ? 'Aktiv' : serverDocStatus.accountStatus === 'suspended' ? 'Gesperrt' : 'In Prüfung'}</div>
                <div className="flex items-center gap-2 mb-7">
                  <div className={`w-2 h-2 rounded-full ${serverDocStatus.accountStatus === 'active' ? 'bg-emerald-400 animate-pulse' : serverDocStatus.accountStatus === 'suspended' ? 'bg-rose-400' : 'bg-amber-400 animate-pulse'}`} />
                  <p className="text-[12px] text-white/40">{serverDocStatus.accountStatus === 'active' ? 'Zugang vollständig freigeschaltet' : serverDocStatus.accountStatus === 'suspended' ? 'Zugang vorübergehend gesperrt' : 'FIAON prüft deinen Antrag'}</p>
                </div>
                <div className="space-y-0 mb-5">
                  {([
                    {
                      label: 'Antrag eingereicht',
                      sub: 'Antrag vollständig übermittelt',
                      done: true, urgent: false,
                    },
                    {
                      label: 'Identitätsdokumente hochgeladen',
                      sub: serverDocStatus.kycStatus === 'changes_requested'
                        ? 'Neue Dokumente angefordert'
                        : docsOk ? 'Kontoauszug & Ausweis vorhanden'
                        : 'Kontoauszug & Personalausweis/Reisepass ausstehend',
                      done: docsOk && serverDocStatus.kycStatus !== 'changes_requested',
                      urgent: serverDocStatus.kycStatus === 'changes_requested',
                    },
                    {
                      label: 'Profil vervollständigt',
                      sub: serverDocStatus.profileChangesRequested
                        ? 'Rückfrage von FIAON ausstehend'
                        : serverDocStatus.profileCompletedAt ? 'Alle Pflichtangaben ausgefüllt'
                        : 'Reisepass, Ausgaben & weitere Angaben ausstehend',
                      done: !!serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested,
                      urgent: serverDocStatus.profileChangesRequested,
                    },
                    {
                      label: 'Unterlagen geprüft',
                      sub: serverDocStatus.kycStatus === 'approved'
                        ? 'Identität & Angaben erfolgreich geprüft'
                        : 'FIAON prüft Dokumente und Profilangaben',
                      done: serverDocStatus.kycStatus === 'approved',
                      urgent: false,
                    },
                    {
                      label: 'Zugang freigeschaltet',
                      sub: serverDocStatus.accountStatus === 'active'
                        ? 'Dein FIAON-Zugang ist vollständig freigeschaltet'
                        : 'Erfolgt nach abgeschlossener Prüfung',
                      done: serverDocStatus.accountStatus === 'active',
                      urgent: false,
                    },
                  ].map((step, i, arr) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500' : step.urgent ? 'bg-amber-500 animate-pulse' : 'border border-white/12'}`} style={!step.done && !step.urgent ? { background: 'rgba(255,255,255,0.05)' } : {}}>
                          {step.done
                            ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                            : step.urgent
                              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                              : <div className="w-2 h-2 rounded-full bg-white/20" />}
                        </div>
                        {i < arr.length - 1 && <div className={`w-px my-1 ${step.done ? 'bg-emerald-500/40' : 'bg-white/8'}`} style={{ height: '20px' }} />}
                      </div>
                      <div className="pb-2.5 pt-0.5">
                        <div className={`text-[12px] font-semibold ${step.done ? 'text-white' : step.urgent ? 'text-amber-300' : 'text-white/35'}`}>{step.label}</div>
                        <div className={`text-[10px] mt-0.5 ${step.urgent ? 'text-amber-400' : step.done ? 'text-white/30' : 'text-white/20'}`}>{step.sub}</div>
                      </div>
                    </div>
                  )))}
                </div>

                {/* Context-specific action boxes */}
                {serverDocStatus.accountStatus !== 'active' && (
                  <div className="space-y-2">
                    {serverDocStatus.kycStatus === 'changes_requested' && serverDocStatus.adminNote && (
                      <button onClick={() => { setActiveModal(null); setSection('documents'); }} className="w-full text-left rounded-xl p-3.5 transition-colors" style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.2)' }}>
                        <div className="text-[11px] font-bold text-rose-300 mb-0.5">Dokumente erneut hochladen</div>
                        <div className="text-[11px] text-rose-400/80">„{serverDocStatus.adminNote}"</div>
                        <div className="text-[10px] text-rose-400 mt-1.5 font-semibold">→ Jetzt hochladen</div>
                      </button>
                    )}
                    {!docsOk && serverDocStatus.kycStatus !== 'changes_requested' && (
                      <button onClick={() => { setActiveModal(null); setSection('documents'); }} className="w-full text-left rounded-xl p-3.5 transition-colors" style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.15)' }}>
                        <div className="text-[11px] font-bold text-amber-300 mb-0.5">Schritt ausstehend: Dokumente hochladen</div>
                        <div className="text-[11px] text-amber-400/70">Kontoauszug und Personalausweis/Reisepass erforderlich</div>
                        <div className="text-[10px] text-amber-400 mt-1.5 font-semibold">→ Jetzt hochladen</div>
                      </button>
                    )}
                    {serverDocStatus.profileChangesRequested && serverDocStatus.adminProfileNote && (
                      <button onClick={() => { setActiveModal(null); setSection('account'); }} className="w-full text-left rounded-xl p-3.5 transition-colors" style={{ background: 'rgba(245,158,11,.12)', border: '1px solid rgba(245,158,11,.2)' }}>
                        <div className="text-[11px] font-bold text-amber-300 mb-0.5">Rückfrage zu deinen Profilangaben</div>
                        <div className="text-[11px] text-amber-400/80">„{serverDocStatus.adminProfileNote}"</div>
                        <div className="text-[10px] text-amber-400 mt-1.5 font-semibold">→ Jetzt beantworten</div>
                      </button>
                    )}
                    {!serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested && (
                      <button onClick={() => { setActiveModal(null); setSection('account'); }} className="w-full text-left rounded-xl p-3.5 transition-colors" style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.18)' }}>
                        <div className="text-[11px] font-bold text-indigo-300 mb-0.5">Schritt ausstehend: Profil vervollständigen</div>
                        <div className="text-[11px] text-indigo-400/70">Reisepass-Daten, monatliche Ausgaben & weitere Pflichtangaben</div>
                        <div className="text-[10px] text-indigo-400 mt-1.5 font-semibold">→ Jetzt ausfüllen</div>
                      </button>
                    )}
                    {docsOk && !!serverDocStatus.profileCompletedAt && !serverDocStatus.profileChangesRequested && serverDocStatus.kycStatus !== 'changes_requested' && (
                      <div className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                        <div className="text-[11px] font-bold text-white/50 mb-0.5">Unterlagen werden geprüft</div>
                        <p className="text-[11px] text-white/30 leading-relaxed">Alle Unterlagen und Angaben wurden eingereicht. FIAON prüft deine Dokumente und Profildaten — dies dauert in der Regel 1–3 Werktage.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── PAKET MODAL ── */}
            {activeModal === 'paket' && (
              <div className="p-7">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(145deg,#2d1065,#7c3aed)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                  </div>
                  <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-white/40 uppercase tracking-[.2em] mb-1">Dein Paket</p>
                <div className="text-3xl font-bold text-white tracking-tight mb-5">{user.packName || '—'}</div>
                <div className="space-y-0 mb-6">
                  {([
                    ['Mitglied', `${user.firstName || '—'} ${user.lastName || ''}`],
                    ['Paket-Rahmen', eur(user.approvedLimit || 0)],
                    ['Referenz', user.ref || '—'],
                    ['E-Mail', user.email || '—'],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-3 border-b border-white/[.05]">
                      <span className="text-[12px] text-white/45">{k}</span>
                      <span className="text-[12px] font-semibold text-white/80 max-w-[55%] truncate text-right">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }}>
                  <p className="text-[12px] text-white/55 leading-relaxed">Für Paket-Upgrades oder Änderungen an deinen Konditionen steht dir unser Support jederzeit zur Verfügung.</p>
                </div>
                <a href="mailto:support@fiaon.com" className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-bold text-[13px] text-white transition-all hover:opacity-90 active:scale-[.98]" style={{ background: 'linear-gradient(135deg,#2d1065,#7c3aed)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  support@fiaon.com
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── KONTEXTABHÄNGIGES WILLKOMMENS-POPUP ── */}
      <WelcomeModal
        open={welcomeOpen}
        state={welcomeState}
        coaching={coaching}
        firstName={user.firstName}
        onClose={closeWelcome}
        onGoto={(s) => setSection(s)}
      />
    </div>
  );
}
