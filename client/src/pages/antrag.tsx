import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";

/* ═══════════════════════════════════════
   FIAON Antragsstrecke — Privatkunden
   ═══════════════════════════════════════ */

const PACKS = [
  { key:"start", name:"FIAON Starter", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["Limit bis 500 \u20AC","E-Mail Support","NFC kontaktlos","Online-Banking"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ01" },
  { key:"pro", name:"FIAON Pro", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Limit bis 5.000 \u20AC","Priority Support","Cashback-Programm","NFC kontaktlos"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ02" },
  { key:"ultra", name:"FIAON Ultra", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Limit bis 15.000 \u20AC","Reise-Versicherung","Lounge-Zugang","Priority Support"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ03" },
  { key:"highend", name:"FIAON High End", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["Limit bis 25.000 \u20AC","24/7 VIP Support","Concierge-Service","Premium Lounge"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ04" },
];

function mkRef() { return "FIAON-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function eur(n: number) { return "\u20AC " + n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

/* ── track click ── */
async function track(event: string, data?: any, ref?: string) {
  try { await fetch("/api/fiaon/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, data, ref, sessionId: sessionStorage.getItem("fiaon_sid") || "", page: location.pathname }) }); } catch {}
}

/* ═══ LIVE CREDIT CARD ═══ */
function LiveCard({ bg, name, lim, className = "" }: { bg: string; name: string; lim: string; className?: string }) {
  return (
    <div className={`w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none ${className}`} style={{ background: bg, border: "1px solid rgba(255,255,255,.1)", boxShadow: "0 20px 50px -8px rgba(0,0,0,.3)" }}>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.25), transparent 55%)", mixBlendMode: "overlay" }} />
      <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />
      <div className="absolute inset-0 p-5 flex flex-col justify-between z-10">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-7 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.8"><path d="M8.5 16.5a5 5 0 0 1 0-9"/><path d="M5 13.5a1 1 0 0 1 0-3"/><path d="M12 19a9 9 0 0 0 0-14"/></svg>
          </div>
          <span className="text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>fiaon</span>
        </div>
        <div className="font-mono text-xs sm:text-sm tracking-[.2em]" style={{ color: "rgba(255,255,255,.5)" }}>5232 2702 5678 9012</div>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-[7px] uppercase tracking-[.14em] font-medium" style={{ color: "rgba(255,255,255,.3)" }}>Karteninhaber</div>
            <div className="font-mono text-xs sm:text-sm font-medium truncate max-w-[140px]" style={{ color: "rgba(255,255,255,.85)" }}>{name || "MAX MUSTERMANN"}</div>
          </div>
          <div className="text-right">
            <div className="text-[7px] uppercase tracking-[.14em] font-medium" style={{ color: "rgba(255,255,255,.3)" }}>Limit</div>
            <div className="font-mono text-xs sm:text-sm font-medium" style={{ color: "rgba(255,255,255,.85)" }}>bis {lim} &euro;</div>
          </div>
          <span className="text-sm font-semibold tracking-[.12em]" style={{ color: "rgba(255,255,255,.4)" }}>VISA</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ PROGRESS BAR ═══ */
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1 mb-7">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${i < step ? "bg-[#2563eb]" : i === step ? "bg-blue-200" : "bg-gray-100"}`}>
          {i === step && <div className="h-full rounded-full bg-[#2563eb] animate-pulse" style={{ width: "60%" }} />}
        </div>
      ))}
    </div>
  );
}

/* ═══ FIELD COMPONENTS ═══ */
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="flex justify-between text-[12px] font-semibold text-gray-500 mb-1.5">{label} {required && <span className="text-[#2563eb]">*</span>}</label>
      {children}
      {error && <p className="mt-1 text-[11px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded-lg">{error}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", ...props }: any) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-[15px] text-gray-900 outline-none transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-300" {...props} />;
}

function Select({ value, onChange, children, ...props }: any) {
  return <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-[15px] text-gray-900 outline-none transition-all focus:bg-white focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10 appearance-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "38px" }} {...props}>{children}</select>;
}

/* ═══ MAIN APPLICATION COMPONENT ═══ */
export default function AntragPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [ref] = useState(mkRef);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pack, setPack] = useState<typeof PACKS[0] | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Form state
  const [d, setD] = useState({ firstName: "", lastName: "", birthDay: "", birthMonth: "", birthYear: "1990", phone: "", street: "", zip: "", city: "", country: "", nationality: "", employment: "", employer: "", employedSince: "", income: 2500, rent: 0, debts: 0, housing: "", wantedLimit: 3000, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja, aktivieren", email: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);

  // Session ID
  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); }, []);

  const up = useCallback((k: string, v: any) => setD(p => ({ ...p, [k]: v })), []);
  const cardName = (d.firstName + " " + d.lastName).trim().toUpperCase();

  function goStep(n: number) {
    setStep(n);
    setErrors({});
    track("step_change", { from: step, to: n }, ref);
    shellRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Validate & proceed
  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.firstName) e.firstName = "Vorname eingeben";
      if (!d.lastName) e.lastName = "Nachname eingeben";
      if (!d.birthDay || !d.birthMonth || !d.birthYear || d.birthYear.length < 4) e.birth = "G\u00FCltiges Datum eingeben";
      else { const age = new Date().getFullYear() - +d.birthYear; if (age < 18) e.birth = "Du musst mind. 18 sein"; }
      if (!d.phone) e.phone = "Telefonnummer eingeben";
      if (!d.street) e.street = "Adresse eingeben";
      if (!d.zip) e.zip = "PLZ eingeben";
      if (!d.city) e.city = "Ort eingeben";
      if (!d.country) e.country = "Land w\u00E4hlen";
      if (!d.nationality) e.nationality = "Bitte w\u00E4hlen";
    } else if (step === 2) {
      if (!d.employment) e.employment = "Status w\u00E4hlen";
      if (!d.employedSince) e.employedSince = "Bitte w\u00E4hlen";
      if (!d.housing) e.housing = "Bitte w\u00E4hlen";
    } else if (step === 3) {
      if (!d.purpose) e.purpose = "Bitte w\u00E4hlen";
    } else if (step === 6) {
      if (!d.email || !d.email.includes("@")) e.email = "G\u00FCltige E-Mail";
      if (d.billingMethod === "iban" && !d.iban) e.iban = "IBAN eingeben";
      if (!d.ag1 || !d.ag2 || !d.ag3) e.consent = "Bitte allen Bedingungen zustimmen";
    }
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});

    if (step === 3) { goStep(4); runVerification(); return; }
    if (step === 6) { goStep(7); runShowcase(); return; }
    goStep(step + 1);
  }

  // Fake verification
  function runVerification() {
    setVerifyDone(false);
    track("verification_start", {}, ref);
    setTimeout(() => {
      const w = d.wantedLimit, mx = pack?.lim || 5000;
      const dir = Math.random() > .5 ? 1 : -1, pct = 0.05 + Math.random() * 0.1;
      let a = Math.round(w * (1 + dir * pct) / 50) * 50;
      if (a > mx) a = mx; if (a < 250) a = 250;
      setApproved(a);
      setVerifyDone(true);
      track("verification_done", { approved: a }, ref);
      setTimeout(() => goStep(5), 1500);
    }, 8000);
  }

  // Fake showcase
  function runShowcase() {
    track("contract_submitted", { email: d.email }, ref);
    setTimeout(() => goStep(8), 6000);
  }

  // Save application to API
  async function saveApp(status: string, stepNum: number) {
    try {
      await fetch("/api/fiaon/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, type: "private", status, currentStep: stepNum, ...d, packKey: pack?.key, packName: pack?.name, approvedLimit: approved }) });
    } catch {}
  }

  // Save on each step change
  useEffect(() => {
    if (step > 0) saveApp(["started", "personal_data", "finances", "config", "verifying", "approved", "contract", "processing", "completed"][step] || "started", step);
  }, [step]);

  return (
    <div className="min-h-screen bg-[#f8faff] text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Topbar */}
      <div ref={shellRef} className="max-w-[960px] mx-auto px-4 sm:px-6 pt-6 pb-20">
        <div className="rounded-[24px] border border-gray-100 bg-white/90 backdrop-blur-xl shadow-xl overflow-hidden relative">
          {/* Animated top line */}
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#2563eb,#60a5fa,#2563eb,#60a5fa)", backgroundSize: "300% 100%", animation: "borderGrad 4s linear infinite" }} />

          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white/95 sticky top-0 z-20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center"><span className="text-white text-xs font-semibold">F</span></div>
              <div>
                <span className="text-[15px] font-semibold tracking-tight text-gray-900">FIAON</span>
                <span className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Kreditkarten-Antrag</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>
              SSL-verschl&uuml;sselt
            </div>
          </div>

          {/* Content */}
          <div className="px-5 sm:px-6 py-6">
            <Progress step={step} total={9} />

            {/* ═══ STEP 0: Paketauswahl ═══ */}
            {step === 0 && (
              <div className="animate-[fadeInUp_.4s_ease]">
                <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Paket w&auml;hlen</p>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 mb-2 fiaon-heading-gradient">W&auml;hle dein FIAON Paket</h2>
                <p className="text-[14px] text-gray-500 mb-6">Entscheide dich f&uuml;r das passende Paket &ndash; du gelangst automatisch zum n&auml;chsten Schritt.</p>

                <div className="grid sm:grid-cols-2 gap-4">
                  {PACKS.map(p => (
                    <button key={p.key} onClick={() => { setPack(p); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 300); }} className={`text-left rounded-2xl border-2 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${pack?.key === p.key ? "border-[#2563eb] shadow-lg ring-4 ring-blue-500/10" : "border-gray-100 hover:border-gray-200"}`}>
                      <div className="p-4"><LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} /></div>
                      <div className="px-4 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[15px] font-semibold text-gray-900">{p.name}</span>
                          {p.rec && <span className="text-[9px] font-bold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                        </div>
                        <div className="flex items-baseline gap-1 mb-3">
                          <span className="text-2xl font-semibold text-gray-900">{p.fee.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                          <span className="text-[12px] text-gray-400">&euro; / Monat</span>
                        </div>
                        <ul className="space-y-1.5">{p.feats.map((f, i) => <li key={i} className="flex items-center gap-2 text-[12px] text-gray-500"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>{f}</li>)}</ul>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-4">Das endg&uuml;ltige Kreditlimit wird individuell festgelegt.</p>
              </div>
            )}

            {/* ═══ STEP 1: Persönliche Daten ═══ */}
            {step === 1 && (
              <div className="animate-[fadeInUp_.4s_ease]">
                <div className="grid lg:grid-cols-[1fr,300px] gap-6">
                  <div>
                    <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 1 von 5</p>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 fiaon-heading-gradient">Pers&ouml;nliche Daten</h2>
                    <p className="text-[14px] text-gray-500 mb-6">Verschl&uuml;sselt &uuml;bertragen und validiert.</p>

                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Vorname" required error={errors.firstName}><Input value={d.firstName} onChange={(v: string) => up("firstName", v)} placeholder="Max" /></Field>
                      <Field label="Nachname" required error={errors.lastName}><Input value={d.lastName} onChange={(v: string) => up("lastName", v)} placeholder="Mustermann" /></Field>
                    </div>
                    <Field label="Geburtsdatum" required error={errors.birth}>
                      <div className="grid grid-cols-3 gap-2">
                        <Select value={d.birthDay} onChange={(v: string) => up("birthDay", v)}><option value="">Tag</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}</Select>
                        <Select value={d.birthMonth} onChange={(v: string) => up("birthMonth", v)}><option value="">Monat</option>{["Jan","Feb","M\u00E4r","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</Select>
                        <Input type="number" value={d.birthYear} onChange={(v: string) => up("birthYear", v)} placeholder="1990" />
                      </div>
                    </Field>
                    <Field label="Telefon" required error={errors.phone}><Input type="tel" value={d.phone} onChange={(v: string) => up("phone", v)} placeholder="+49 170 1234567" /></Field>
                    <Field label="Stra\u00DFe & Hausnummer" required error={errors.street}><Input value={d.street} onChange={(v: string) => up("street", v)} placeholder="Musterstra\u00DFe 12" /></Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="PLZ" required error={errors.zip}><Input value={d.zip} onChange={(v: string) => up("zip", v)} placeholder="10115" /></Field>
                      <Field label="Ort" required error={errors.city}><Input value={d.city} onChange={(v: string) => up("city", v)} placeholder="Berlin" /></Field>
                      <Field label="Land" required error={errors.country}><Select value={d.country} onChange={(v: string) => up("country", v)}><option value="">W&auml;hlen</option><option value="DE">Deutschland</option><option value="AT">&Ouml;sterreich</option><option value="CH">Schweiz</option></Select></Field>
                    </div>
                    <Field label="Staatsangeh\u00F6rigkeit" required error={errors.nationality}><Select value={d.nationality} onChange={(v: string) => up("nationality", v)}><option value="">W&auml;hlen</option><option>Deutsch</option><option>&Ouml;sterreichisch</option><option>Schweizerisch</option><option>Andere EU</option><option>Nicht-EU</option></Select></Field>

                    <div className="flex gap-3 mt-6">
                      <button onClick={() => goStep(0)} className="px-5 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-all">&larr; Zur&uuml;ck</button>
                      <button onClick={next} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white fiaon-btn-gradient">Weiter &rarr;</button>
                    </div>
                  </div>

                  {/* Sidebar: Live Card */}
                  <div className="hidden lg:block">
                    <div className="sticky top-24 space-y-4">
                      <LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={(pack?.lim || 5000).toLocaleString("de-DE")} />
                      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 space-y-2">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dein Paket</p>
                        <p className="text-[14px] font-semibold text-gray-900">{pack?.name}</p>
                        <p className="text-[12px] text-gray-500">{eur(pack?.fee || 0)} / Monat</p>
                        <p className="text-[10px] font-mono text-gray-400">{ref}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: Beruf & Finanzen ═══ */}
            {step === 2 && (
              <div className="animate-[fadeInUp_.4s_ease]">
                <div className="grid lg:grid-cols-[1fr,300px] gap-6">
                  <div>
                    <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 2 von 5</p>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 fiaon-heading-gradient">Beruf & Finanzen</h2>
                    <p className="text-[14px] text-gray-500 mb-6">Helfen bei der Limit-Berechnung.</p>

                    <Field label="Besch\u00E4ftigungsstatus" required error={errors.employment}><Select value={d.employment} onChange={(v: string) => up("employment", v)}><option value="">W&auml;hlen</option><option>Angestellt</option><option>Selbstst&auml;ndig</option><option>Freiberuflich</option><option>Beamter/in</option><option>Student/in</option><option>Rentner/in</option></Select></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Arbeitgeber"><Input value={d.employer} onChange={(v: string) => up("employer", v)} placeholder="Optional" /></Field>
                      <Field label="Besch\u00E4ftigt seit" required error={errors.employedSince}><Select value={d.employedSince} onChange={(v: string) => up("employedSince", v)}><option value="">W&auml;hlen</option><option>&lt; 6 Monate</option><option>6&ndash;12 Monate</option><option>1&ndash;3 Jahre</option><option>3&ndash;5 Jahre</option><option>&gt; 5 Jahre</option></Select></Field>
                    </div>
                    <Field label="Monatl. Nettoeinkommen" required>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-semibold text-gray-900">{eur(d.income)}</span>
                        <span className="text-[12px] text-gray-400">/ Monat</span>
                      </div>
                      <input type="range" min={500} max={15000} step={100} value={d.income} onChange={e => up("income", +e.target.value)} className="w-full h-2 rounded-full bg-gray-200 appearance-none cursor-pointer accent-[#2563eb]" />
                      <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>&euro; 500</span><span>&euro; 15.000</span></div>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Monatl. Miete"><Input type="number" value={d.rent || ""} onChange={(v: string) => up("rent", +v || 0)} placeholder="z.B. 850" /></Field>
                      <Field label="Verbindlichkeiten"><Input type="number" value={d.debts || ""} onChange={(v: string) => up("debts", +v || 0)} placeholder="z.B. 200" /></Field>
                    </div>
                    <Field label="Wohnsituation" required error={errors.housing}><Select value={d.housing} onChange={(v: string) => up("housing", v)}><option value="">W&auml;hlen</option><option>Zur Miete</option><option>Eigentum</option><option>Bei Familie</option><option>Sonstiges</option></Select></Field>

                    <div className="flex gap-3 mt-6">
                      <button onClick={() => goStep(1)} className="px-5 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-all">&larr; Zur&uuml;ck</button>
                      <button onClick={next} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white fiaon-btn-gradient">Weiter &rarr;</button>
                    </div>
                  </div>
                  <div className="hidden lg:block"><div className="sticky top-24"><LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={(pack?.lim || 5000).toLocaleString("de-DE")} /></div></div>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: Karte konfigurieren ═══ */}
            {step === 3 && (
              <div className="animate-[fadeInUp_.4s_ease]">
                <div className="grid lg:grid-cols-[1fr,300px] gap-6">
                  <div>
                    <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 3 von 5</p>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 fiaon-heading-gradient">Karte konfigurieren</h2>
                    <p className="text-[14px] text-gray-500 mb-6">W&auml;hle dein Wunschlimit.</p>

                    <Field label="Wunsch-Kreditlimit" required>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl font-semibold text-gray-900">{eur(d.wantedLimit)}</span>
                        <span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 5000)}</span>
                      </div>
                      <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-2 rounded-full bg-gray-200 appearance-none cursor-pointer accent-[#2563eb]" />
                    </Field>
                    <Field label="Verwendungszweck" required error={errors.purpose}><Select value={d.purpose} onChange={(v: string) => up("purpose", v)}><option value="">W&auml;hlen</option><option>T&auml;gliche Ausgaben</option><option>Online-Shopping</option><option>Reisen</option><option>Gesch&auml;ftlich</option><option>Finanzielle Reserve</option></Select></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Abrechnungsart"><Select value={d.billing} onChange={(v: string) => up("billing", v)}><option>Vollzahlung (100%)</option><option>Teilzahlung</option><option>Revolving</option></Select></Field>
                      <Field label="NFC kontaktlos"><Select value={d.nfc} onChange={(v: string) => up("nfc", v)}><option>Ja, aktivieren</option><option>Nein</option></Select></Field>
                    </div>

                    <div className="flex gap-3 mt-6">
                      <button onClick={() => goStep(2)} className="px-5 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-all">&larr; Zur&uuml;ck</button>
                      <button onClick={next} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white fiaon-btn-gradient">Pr&uuml;fen lassen &rarr;</button>
                    </div>
                  </div>
                  <div className="hidden lg:block"><div className="sticky top-24"><LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={d.wantedLimit.toLocaleString("de-DE")} /></div></div>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: Verification ═══ */}
            {step === 4 && (
              <div className="animate-[fadeInUp_.4s_ease] flex flex-col items-center text-center py-10">
                <div className="w-20 h-20 mb-5 relative">
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin" />
                  <div className="absolute inset-3 rounded-full border-[3px] border-transparent border-b-blue-300 animate-[spin_1.5s_linear_infinite_reverse]" />
                  <div className="absolute inset-6 rounded-full border-[3px] border-transparent border-t-blue-200 animate-[spin_2s_linear_infinite]" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#2563eb] animate-pulse" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{verifyDone ? "Pr\u00FCfung abgeschlossen!" : "Daten werden gepr\u00FCft\u2026"}</h3>
                <p className="text-[14px] text-gray-400 mb-8">Das dauert nur einen Moment.</p>
                <div className="w-full max-w-[400px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-[8s] ease-linear ${verifyDone ? "w-full" : "w-[85%]"}`} />
                </div>
              </div>
            )}

            {/* ═══ STEP 5: Ergebnis ═══ */}
            {step === 5 && (
              <div className="animate-[fadeInUp_.4s_ease] text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 border-2 border-green-400 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 fiaon-heading-gradient">Bonitätspr&uuml;fung bestanden!</h2>
                <p className="text-[14px] text-gray-500 mb-6">Dein bewilligter Kreditrahmen:</p>
                <p className="text-4xl sm:text-5xl font-bold tracking-tight fiaon-heading-gradient mb-2">{eur(approved)}</p>
                <p className="text-[14px] text-gray-400 mb-8">mit deinem {pack?.name} Paket</p>

                <button onClick={() => goStep(6)} className="fiaon-btn-gradient px-8 py-3.5 rounded-full text-[15px] font-semibold text-white">
                  Vertrag annehmen &amp; fortfahren &rarr;
                </button>
              </div>
            )}

            {/* ═══ STEP 6: Vertrag ═══ */}
            {step === 6 && (
              <div className="animate-[fadeInUp_.4s_ease]">
                <div className="grid lg:grid-cols-[1fr,300px] gap-6">
                  <div>
                    <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 4 von 5</p>
                    <h2 className="text-xl sm:text-2xl font-semibold tracking-tight mb-2 fiaon-heading-gradient">Vertrag annehmen</h2>
                    <p className="text-[14px] text-gray-500 mb-6">Best&auml;tige deine Daten und nimm den Vertrag an.</p>

                    <Field label="E-Mail-Adresse" required error={errors.email}><Input type="email" value={d.email} onChange={(v: string) => up("email", v)} placeholder="max@beispiel.de" /></Field>

                    <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden mb-4">
                      {["iban", "paper"].map(m => (
                        <button key={m} onClick={() => up("billingMethod", m)} className={`flex-1 py-3 text-center text-[13px] font-semibold transition-all ${d.billingMethod === m ? "bg-blue-50 text-[#2563eb]" : "bg-gray-50 text-gray-400"}`}>
                          {m === "iban" ? "SEPA-Lastschrift" : "Papierrechnung"}
                        </button>
                      ))}
                    </div>
                    {d.billingMethod === "iban" && <Field label="IBAN" error={errors.iban}><Input value={d.iban} onChange={(v: string) => up("iban", v)} placeholder="DE89 3704 0044 0532 0130 00" /></Field>}

                    {[["ag1", "AGB & Datenschutz", "Ich stimme zu und habe die vorvertraglichen Informationen erhalten."], ["ag2", "Bonitätspr\u00FCfung", "Ich willige in die \u00DCbermittlung meiner Daten ein."], ["ag3", "Vertragsannahme", "Ich nehme den Kreditkartenvertrag verbindlich an."]].map(([key, title, desc]) => (
                      <button key={key} onClick={() => up(key, !(d as any)[key])} className={`w-full flex gap-3 items-start p-3.5 rounded-xl border mb-3 text-left transition-all ${(d as any)[key] ? "border-green-300 bg-green-50/50" : "border-blue-100 bg-blue-50/30 hover:border-blue-200"}`}>
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${(d as any)[key] ? "border-green-500 bg-green-500" : "border-gray-300 bg-white"}`}>
                          {(d as any)[key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>}
                        </div>
                        <div><p className="text-[13px] font-semibold text-gray-900">{title}</p><p className="text-[12px] text-gray-500">{desc}</p></div>
                      </button>
                    ))}
                    {errors.consent && <p className="text-[11px] font-semibold text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{errors.consent}</p>}

                    <div className="flex gap-3 mt-4">
                      <button onClick={() => goStep(5)} className="px-5 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-all">&larr; Zur&uuml;ck</button>
                      <button onClick={next} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white bg-green-500 hover:bg-green-600 transition-all">Vertrag annehmen &rarr;</button>
                    </div>
                  </div>
                  <div className="hidden lg:block"><div className="sticky top-24"><LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={approved.toLocaleString("de-DE")} /></div></div>
                </div>
              </div>
            )}

            {/* ═══ STEP 7: Processing ═══ */}
            {step === 7 && (
              <div className="animate-[fadeInUp_.4s_ease] flex flex-col items-center text-center py-10">
                <div className="w-20 h-20 mb-5 relative">
                  <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin" />
                  <div className="absolute inset-3 rounded-full border-[3px] border-transparent border-b-blue-300 animate-[spin_1.5s_linear_infinite_reverse]" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Dein Vertrag wird erstellt&hellip;</h3>
                <p className="text-[14px] text-gray-400">Wir bereiten alles f&uuml;r dich vor.</p>
              </div>
            )}

            {/* ═══ STEP 8: Willkommen ═══ */}
            {step === 8 && (
              <div className="animate-[fadeInUp_.4s_ease] text-center py-6">
                <div className="w-20 h-20 mx-auto mb-5 rounded-full relative flex items-center justify-center">
                  <div className="absolute inset-[-3px] rounded-full animate-spin" style={{ background: "conic-gradient(#2563eb,#60a5fa,#2563eb)" }} />
                  <div className="w-[74px] h-[74px] rounded-full bg-white flex items-center justify-center relative z-10">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  </div>
                </div>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 fiaon-heading-gradient">Herzlich Willkommen!</h2>
                <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Wir freuen uns, dich als neuen FIAON Kunden begr&uuml;&szlig;en zu d&uuml;rfen.</p>
                <p className="text-[13px] text-gray-400 mb-8">{d.firstName} {d.lastName} &middot; {pack?.name} &middot; Ref. {ref}</p>

                <div className="max-w-md mx-auto mb-6">
                  <LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={approved.toLocaleString("de-DE")} />
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 p-6 max-w-md mx-auto mb-6">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Aktivierung abschlie&szlig;en</p>
                  <p className="text-[14px] text-gray-700 mb-4">Schlie&szlig;e die Zahlung f&uuml;r dein {pack?.name} Paket ab.</p>
                  <button onClick={() => { const url = pack?.pay; if (url) window.open(url, "_blank"); track("payment_click", { pack: pack?.key }, ref); }} className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:shadow-lg transition-all">
                    Jetzt bezahlen &amp; Karte aktivieren &rarr;
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 font-mono">Referenz: {ref}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fade-in animation */}
      <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
