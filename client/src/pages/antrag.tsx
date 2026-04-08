import { useState, useEffect, useRef, useCallback } from "react";

const PACKS = [
  { key:"start", name:"FIAON Starter", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["Limit bis 500 €","E-Mail Support","NFC kontaktlos","Online-Banking"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ01" },
  { key:"pro", name:"FIAON Pro", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Limit bis 5.000 €","Priority Support","Cashback-Programm","NFC kontaktlos"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ02" },
  { key:"ultra", name:"FIAON Ultra", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Limit bis 15.000 €","Reise-Versicherung","Lounge-Zugang","Priority Support"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ03" },
  { key:"highend", name:"FIAON High End", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["Limit bis 25.000 €","24/7 VIP Support","Concierge-Service","Premium Lounge"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ04" },
];

function mkRef() { return "FIAON-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function eur(n: number) { return "€ " + n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

async function track(event: string, data?: any, ref?: string) {
  try { await fetch("/api/fiaon/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, data, ref, sessionId: sessionStorage.getItem("fiaon_sid") || "", page: location.pathname }) }); } catch {}
}

/* ═══ LIVE CREDIT CARD — realistic, auto-sizing name ═══ */
function LiveCard({ bg, name, lim, className = "" }: { bg: string; name: string; lim: string; className?: string }) {
  const displayName = name || "MAX MUSTERMANN";
  const nameLen = displayName.length;
  const nameSize = nameLen > 22 ? "text-[8px]" : nameLen > 16 ? "text-[10px]" : "text-xs";

  return (
    <div className={`w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none ${className}`} style={{ background: bg, boxShadow: "0 25px 60px -12px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.1), inset 0 -1px 0 rgba(0,0,0,.2)" }}>
      {/* Holographic overlay */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.3), transparent 50%)", mixBlendMode: "overlay" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,.5) 40px, rgba(255,255,255,.5) 41px)" }} />
      <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />

      <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-between z-10">
        {/* Top row */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {/* Chip */}
            <div className="w-9 h-6 sm:w-10 sm:h-7 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 3px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3)" }}>
              <div className="w-full h-full rounded opacity-30" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,.15) 3px, rgba(0,0,0,.15) 4px)" }} />
            </div>
            {/* Contactless */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.8"><path d="M8.5 16.5a5 5 0 0 1 0-9"/><path d="M5 13.5a1 1 0 0 1 0-3"/><path d="M12 19a9 9 0 0 0 0-14"/></svg>
          </div>
          <span className="text-[13px] font-medium tracking-wide" style={{ color: "rgba(255,255,255,.6)" }}>fiaon</span>
        </div>

        {/* Card number */}
        <div className="font-mono text-[11px] sm:text-[13px] tracking-[.18em]" style={{ color: "rgba(255,255,255,.45)" }}>5232 2702 5678 9012</div>

        {/* Bottom row */}
        <div className="flex justify-between items-end gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[7px] uppercase tracking-[.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Karteninhaber</div>
            <div className={`font-mono font-medium truncate ${nameSize}`} style={{ color: "rgba(255,255,255,.85)" }}>{displayName}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[7px] uppercase tracking-[.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,.3)" }}>Limit</div>
            <div className="font-mono text-[11px] sm:text-xs font-medium" style={{ color: "rgba(255,255,255,.85)" }}>bis {lim} €</div>
          </div>
          <span className="text-sm font-semibold tracking-[.12em] shrink-0" style={{ color: "rgba(255,255,255,.35)" }}>VISA</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ PROGRESS ═══ */
function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${i < step ? "bg-[#2563eb]" : i === step ? "bg-blue-200" : "bg-gray-100"}`}>
          {i === step && <div className="h-full rounded-full bg-[#2563eb] animate-pulse" style={{ width: "60%" }} />}
        </div>
      ))}
    </div>
  );
}

/* ═══ FORM HELPERS ═══ */
function Field({ label, req, error, hint, children }: { label: string; req?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="flex justify-between text-[12px] font-semibold text-gray-500 mb-1.5">{label}{req && <span className="text-[#2563eb] font-bold">*</span>}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg">{error}</p>}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = "text", ...p }: any) {
  return <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-[15px] text-gray-900 outline-none transition-all focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-300" {...p} />;
}

function Sel({ value, onChange, children, ...p }: any) {
  return <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-[15px] text-gray-900 outline-none transition-all focus:border-[#2563eb] focus:ring-4 focus:ring-blue-500/10 appearance-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "38px" }} {...p}>{children}</select>;
}

/* ═══ MAIN COMPONENT ═══ */
export default function AntragPage() {
  const [step, setStep] = useState(0);
  const [ref] = useState(mkRef);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pack, setPack] = useState<typeof PACKS[0] | null>(null);

  const [d, setD] = useState({ firstName: "", lastName: "", birthDay: "", birthMonth: "", birthYear: "1990", phone: "", street: "", zip: "", city: "", country: "", nationality: "", employment: "", employer: "", employedSince: "", income: 2500, rent: 0, debts: 0, housing: "", wantedLimit: 3000, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", email: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

  const up = useCallback((k: string, v: any) => setD(p => ({ ...p, [k]: v })), []);
  const cardName = (d.firstName + " " + d.lastName).trim().toUpperCase();

  function goStep(n: number) { setStep(n); setErrors({}); track("step_change", { from: step, to: n }, ref); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.firstName) e.firstName = "Vorname eingeben";
      if (!d.lastName) e.lastName = "Nachname eingeben";
      if (!d.birthDay || !d.birthMonth || !d.birthYear || d.birthYear.length < 4) e.birth = "Gültiges Datum eingeben";
      else { const age = new Date().getFullYear() - +d.birthYear; if (age < 18) e.birth = "Du musst mind. 18 sein"; }
      if (!d.phone) e.phone = "Telefonnummer eingeben";
      if (!d.street) e.street = "Adresse eingeben";
      if (!d.zip) e.zip = "PLZ eingeben";
      if (!d.city) e.city = "Ort eingeben";
      if (!d.country) e.country = "Land wählen";
      if (!d.nationality) e.nationality = "Bitte wählen";
    } else if (step === 2) {
      if (!d.employment) e.employment = "Status wählen";
      if (!d.employedSince) e.employedSince = "Bitte wählen";
      if (!d.housing) e.housing = "Bitte wählen";
    } else if (step === 3) {
      if (!d.purpose) e.purpose = "Bitte wählen";
    } else if (step === 6) {
      if (!d.email || !d.email.includes("@")) e.email = "Gültige E-Mail eingeben";
      if (d.billingMethod === "iban" && !d.iban) e.iban = "IBAN eingeben";
      if (!d.ag1 || !d.ag2 || !d.ag3) e.consent = "Bitte allen Bedingungen zustimmen";
    }
    if (Object.keys(e).length) { setErrors(e); return; }
    if (step === 3) { goStep(4); runVerify(); return; }
    if (step === 6) { goStep(7); setTimeout(() => goStep(8), 6000); return; }
    goStep(step + 1);
  }

  function runVerify() {
    setVerifyDone(false);
    setTimeout(() => {
      const mx = pack?.lim || 5000;
      let a = Math.round(d.wantedLimit * (1 + (Math.random() > .5 ? 1 : -1) * (0.05 + Math.random() * 0.1)) / 50) * 50;
      if (a > mx) a = mx; if (a < 250) a = 250;
      setApproved(a); setVerifyDone(true);
      setTimeout(() => goStep(5), 1500);
    }, 8000);
  }

  useEffect(() => {
    if (step > 0) {
      const status = ["started","personal_data","finances","config","verifying","approved","contract","processing","completed"][step] || "started";
      fetch("/api/fiaon/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, type: "private", status, currentStep: step, ...d, packKey: pack?.key, packName: pack?.name, approvedLimit: approved }) }).catch(() => {});
    }
  }, [step]);

  const sideCard = <LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={(pack?.lim || 5000).toLocaleString("de-DE")} className="shadow-2xl" />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] via-white to-white text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>

      {/* ── Topbar ── */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#2563eb] flex items-center justify-center"><span className="text-white text-[10px] font-semibold">F</span></div>
            <span className="text-[15px] font-semibold tracking-tight">FIAON</span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider ml-1 hidden sm:inline">Kreditkarten-Antrag</span>
          </a>
          <div className="flex items-center gap-2 text-[11px] font-medium text-gray-400">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/></svg>
            SSL-verschlüsselt
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-5xl mx-auto px-5 py-8 sm:py-12">
        <Progress step={step} total={9} />

        {/* ═══ STEP 0: Paketauswahl ═══ */}
        {step === 0 && (
          <div className="animate-[fadeInUp_.4s_ease]">
            <div className="text-center mb-10">
              <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Paket wählen</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight fiaon-heading-gradient mb-3">Wähle dein FIAON Paket</h1>
              <p className="text-[15px] text-gray-400 max-w-lg mx-auto">Entscheide dich für das passende Paket — du gelangst automatisch zum nächsten Schritt.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto">
              {PACKS.map(p => (
                <button key={p.key} onClick={() => { setPack(p); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 300); }} className={`text-left rounded-2xl border-2 overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl ${pack?.key === p.key ? "border-[#2563eb] shadow-lg ring-2 ring-blue-500/20" : "border-gray-100 hover:border-gray-200"} bg-white`}>
                  <div className="p-4"><LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} /></div>
                  <div className="px-4 pb-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[14px] font-semibold">{p.name}</span>
                      {p.rec && <span className="text-[8px] font-bold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-1.5 py-0.5 rounded">Empfohlen</span>}
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-xl font-semibold">{p.fee.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[11px] text-gray-400">€/Mt.</span>
                    </div>
                    <ul className="space-y-1">{p.feats.map((f, i) => <li key={i} className="flex items-center gap-1.5 text-[11px] text-gray-500"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3"><polyline points="6 12 10 16 18 8"/></svg>{f}</li>)}</ul>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-6">Das endgültige Kreditlimit wird individuell festgelegt.</p>
          </div>
        )}

        {/* ═══ STEPS 1-3 & 6: Form Steps ═══ */}
        {[1, 2, 3, 6].includes(step) && (
          <div className="animate-[fadeInUp_.4s_ease]">
            <div className="grid lg:grid-cols-[1fr,340px] gap-8 items-start">
              {/* Left: Form */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
                {step === 1 && <>
                  <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 1 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-heading-gradient mb-1">Persönliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Verschlüsselt übertragen und validiert.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Vorname" req error={errors.firstName}><Inp value={d.firstName} onChange={(v: string) => up("firstName", v)} placeholder="Max" /></Field>
                    <Field label="Nachname" req error={errors.lastName}><Inp value={d.lastName} onChange={(v: string) => up("lastName", v)} placeholder="Mustermann" /></Field>
                  </div>
                  <Field label="Geburtsdatum" req error={errors.birth}>
                    <div className="grid grid-cols-3 gap-2">
                      <Sel value={d.birthDay} onChange={(v: string) => up("birthDay", v)}><option value="">Tag</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}</Sel>
                      <Sel value={d.birthMonth} onChange={(v: string) => up("birthMonth", v)}><option value="">Monat</option>{["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</Sel>
                      <Inp type="number" value={d.birthYear} onChange={(v: string) => up("birthYear", v)} placeholder="1990" />
                    </div>
                  </Field>
                  <Field label="Telefon" req error={errors.phone}><Inp type="tel" value={d.phone} onChange={(v: string) => up("phone", v)} placeholder="+49 170 1234567" /></Field>
                  <Field label="Straße & Hausnummer" req error={errors.street}><Inp value={d.street} onChange={(v: string) => up("street", v)} placeholder="Musterstraße 12" /></Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="PLZ" req error={errors.zip}><Inp value={d.zip} onChange={(v: string) => up("zip", v)} placeholder="10115" /></Field>
                    <Field label="Ort" req error={errors.city}><Inp value={d.city} onChange={(v: string) => up("city", v)} placeholder="Berlin" /></Field>
                    <Field label="Land" req error={errors.country}><Sel value={d.country} onChange={(v: string) => up("country", v)}><option value="">Wählen</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option></Sel></Field>
                  </div>
                  <Field label="Staatsangehörigkeit" req error={errors.nationality}><Sel value={d.nationality} onChange={(v: string) => up("nationality", v)}><option value="">Wählen</option><option>Deutsch</option><option>Österreichisch</option><option>Schweizerisch</option><option>Andere EU</option><option>Nicht-EU</option></Sel></Field>
                </>}

                {step === 2 && <>
                  <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 2 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-heading-gradient mb-1">Beruf & Finanzen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Helfen bei der Limit-Berechnung.</p>
                  <Field label="Beschäftigungsstatus" req error={errors.employment}><Sel value={d.employment} onChange={(v: string) => up("employment", v)}><option value="">Wählen</option><option>Angestellt</option><option>Selbstständig</option><option>Freiberuflich</option><option>Beamter/in</option><option>Student/in</option><option>Rentner/in</option></Sel></Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Arbeitgeber"><Inp value={d.employer} onChange={(v: string) => up("employer", v)} placeholder="Optional" /></Field>
                    <Field label="Beschäftigt seit" req error={errors.employedSince}><Sel value={d.employedSince} onChange={(v: string) => up("employedSince", v)}><option value="">Wählen</option><option>{"< 6 Monate"}</option><option>6–12 Monate</option><option>1–3 Jahre</option><option>3–5 Jahre</option><option>{"> 5 Jahre"}</option></Sel></Field>
                  </div>
                  <Field label="Monatliches Nettoeinkommen" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold">{eur(d.income)}</span><span className="text-[12px] text-gray-400">/ Monat</span></div>
                    <input type="range" min={500} max={15000} step={100} value={d.income} onChange={e => up("income", +e.target.value)} className="w-full h-2 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>€ 500</span><span>€ 15.000</span></div>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Monatliche Miete" hint="Kaltmiete in EUR"><Inp type="number" value={d.rent || ""} onChange={(v: string) => up("rent", +v || 0)} placeholder="z.B. 850" /></Field>
                    <Field label="Verbindlichkeiten" hint="Ratenkredite etc."><Inp type="number" value={d.debts || ""} onChange={(v: string) => up("debts", +v || 0)} placeholder="z.B. 200" /></Field>
                  </div>
                  <Field label="Wohnsituation" req error={errors.housing}><Sel value={d.housing} onChange={(v: string) => up("housing", v)}><option value="">Wählen</option><option>Zur Miete</option><option>Eigentum</option><option>Bei Familie</option><option>Sonstiges</option></Sel></Field>
                </>}

                {step === 3 && <>
                  <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 3 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-heading-gradient mb-1">Karte konfigurieren</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Wähle dein Wunschlimit.</p>
                  <Field label="Wunsch-Kreditlimit" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold">{eur(d.wantedLimit)}</span><span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 5000)}</span></div>
                    <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-2 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                  </Field>
                  <Field label="Verwendungszweck" req error={errors.purpose}><Sel value={d.purpose} onChange={(v: string) => up("purpose", v)}><option value="">Wählen</option><option>Tägliche Ausgaben</option><option>Online-Shopping</option><option>Reisen</option><option>Geschäftlich</option><option>Finanzielle Reserve</option></Sel></Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Abrechnungsart"><Sel value={d.billing} onChange={(v: string) => up("billing", v)}><option>Vollzahlung (100%)</option><option>Teilzahlung</option><option>Revolving</option></Sel></Field>
                    <Field label="NFC kontaktlos"><Sel value={d.nfc} onChange={(v: string) => up("nfc", v)}><option>Ja, aktivieren</option><option>Nein</option></Sel></Field>
                  </div>
                </>}

                {step === 6 && <>
                  <p className="text-[11px] font-bold text-[#2563eb] uppercase tracking-wider mb-2">Schritt 4 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-heading-gradient mb-1">Vertrag annehmen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Bestätige deine Daten und nimm den Vertrag an.</p>
                  <Field label="E-Mail-Adresse" req error={errors.email} hint="Vertragsunterlagen werden hierhin gesendet."><Inp type="email" value={d.email} onChange={(v: string) => up("email", v)} placeholder="max@beispiel.de" /></Field>
                  <div className="flex gap-0 border border-gray-200 rounded-xl overflow-hidden mb-5">
                    {[["iban","SEPA-Lastschrift"],["paper","Papierrechnung"]].map(([k,l]) => (
                      <button key={k} onClick={() => up("billingMethod", k)} className={`flex-1 py-3 text-center text-[13px] font-semibold transition-all ${d.billingMethod === k ? "bg-blue-50 text-[#2563eb]" : "bg-gray-50 text-gray-400"}`}>{l}</button>
                    ))}
                  </div>
                  {d.billingMethod === "iban" && <Field label="IBAN" error={errors.iban}><Inp value={d.iban} onChange={(v: string) => up("iban", v)} placeholder="DE89 3704 0044 0532 0130 00" /></Field>}
                  {[["ag1","AGB & Datenschutz","Ich stimme zu und habe die vorvertraglichen Informationen erhalten."],["ag2","Bonitätsprüfung","Ich willige in die Übermittlung meiner Daten ein."],["ag3","Vertragsannahme","Ich nehme den Vertrag verbindlich an."]].map(([key,title,desc]) => (
                    <button key={key} onClick={() => up(key, !(d as any)[key])} className={`w-full flex gap-3 items-start p-4 rounded-xl border mb-3 text-left transition-all ${(d as any)[key] ? "border-green-300 bg-green-50/50" : "border-gray-200 hover:border-blue-200"}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${(d as any)[key] ? "border-green-500 bg-green-500" : "border-gray-300"}`}>
                        {(d as any)[key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="6 12 10 16 18 8"/></svg>}
                      </div>
                      <div><p className="text-[13px] font-semibold text-gray-900">{title}</p><p className="text-[12px] text-gray-500">{desc}</p></div>
                    </button>
                  ))}
                  {errors.consent && <p className="text-[11px] font-semibold text-red-500 bg-red-50 px-3 py-2 rounded-lg mb-3">{errors.consent}</p>}
                </>}

                {/* Buttons */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                  <button onClick={() => goStep(step === 6 ? 5 : step - 1)} className="px-5 py-3 rounded-xl border border-gray-200 text-[13px] font-medium text-gray-600 hover:bg-gray-50 transition-all">← Zurück</button>
                  <button onClick={next} className={`flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all ${step === 6 ? "bg-green-500 hover:bg-green-600" : "fiaon-btn-gradient"}`}>
                    {step === 3 ? "Prüfen lassen →" : step === 6 ? "Vertrag annehmen →" : "Weiter →"}
                  </button>
                </div>
              </div>

              {/* Right: Sidebar */}
              <div className="hidden lg:block">
                <div className="sticky top-20 space-y-5">
                  {sideCard}
                  <div className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dein Paket</p>
                    <p className="text-[15px] font-semibold text-gray-900">{pack?.name}</p>
                    <div className="h-px bg-gray-100" />
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div><span className="text-gray-400">Gebühr</span><br/><span className="font-semibold">{eur(pack?.fee || 0)}/Mt.</span></div>
                      <div><span className="text-gray-400">Limit</span><br/><span className="font-semibold">bis {(pack?.lim || 0).toLocaleString("de-DE")} €</span></div>
                    </div>
                    <p className="text-[10px] font-mono text-gray-300">{ref}</p>
                  </div>
                </div>
              </div>

              {/* Mobile card */}
              <div className="lg:hidden">{sideCard}</div>
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Verification ═══ */}
        {step === 4 && (
          <div className="animate-[fadeInUp_.4s_ease] flex flex-col items-center text-center py-16 sm:py-24">
            <div className="w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin" />
              <div className="absolute inset-4 rounded-full border-[3px] border-transparent border-b-blue-300 animate-[spin_1.5s_linear_infinite_reverse]" />
              <div className="absolute inset-8 rounded-full border-[3px] border-transparent border-t-blue-200 animate-[spin_2s_linear_infinite]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#2563eb] animate-pulse" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{verifyDone ? "Prüfung abgeschlossen!" : "Daten werden geprüft…"}</h3>
            <p className="text-[14px] text-gray-400 mb-10">Das dauert nur einen Moment.</p>
            <div className="w-full max-w-sm h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full bg-[#2563eb] transition-all ${verifyDone ? "w-full duration-500" : "w-[85%] duration-[8s]"} ease-linear`} />
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Result ═══ */}
        {step === 5 && (
          <div className="animate-[fadeInUp_.4s_ease] text-center py-12 sm:py-20">
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-green-50 border-2 border-green-400 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5"><polyline points="6 12 10 16 18 8"/></svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight fiaon-heading-gradient mb-3">Bonitätsprüfung bestanden!</h2>
            <p className="text-[15px] text-gray-400 mb-6">Dein bewilligter Kreditrahmen:</p>
            <p className="text-5xl sm:text-6xl font-bold tracking-tight fiaon-heading-gradient mb-3">{eur(approved)}</p>
            <p className="text-[15px] text-gray-400 mb-10">mit deinem <strong className="text-gray-900">{pack?.name}</strong> Paket</p>
            <button onClick={() => goStep(6)} className="fiaon-btn-gradient px-10 py-4 rounded-full text-[15px] font-semibold text-white">Vertrag annehmen & fortfahren →</button>
          </div>
        )}

        {/* ═══ STEP 7: Processing ═══ */}
        {step === 7 && (
          <div className="animate-[fadeInUp_.4s_ease] flex flex-col items-center text-center py-16 sm:py-24">
            <div className="w-24 h-24 mb-6 relative">
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[#2563eb] animate-spin" />
              <div className="absolute inset-4 rounded-full border-[3px] border-transparent border-b-blue-300 animate-[spin_1.5s_linear_infinite_reverse]" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Dein Vertrag wird erstellt…</h3>
            <p className="text-[14px] text-gray-400">Wir bereiten alles für dich vor.</p>
          </div>
        )}

        {/* ═══ STEP 8: Welcome ═══ */}
        {step === 8 && (
          <div className="animate-[fadeInUp_.4s_ease] text-center py-10 sm:py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full relative flex items-center justify-center">
              <div className="absolute inset-[-3px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: "conic-gradient(#2563eb,#60a5fa,#2563eb)" }} />
              <div className="w-[90px] h-[90px] rounded-full bg-white flex items-center justify-center relative z-10">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.6"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              </div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight fiaon-heading-gradient mb-3">Herzlich Willkommen!</h2>
            <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Deine FIAON Kreditkarte wird in Kürze aktiviert.</p>
            <p className="text-[13px] text-gray-400 mb-10">{d.firstName} {d.lastName} · {pack?.name} · Ref. {ref}</p>

            <div className="max-w-sm mx-auto mb-8">{sideCard}</div>

            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 p-7 max-w-sm mx-auto">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-2">Aktivierung abschließen</p>
              <p className="text-[14px] text-gray-700 mb-5">Schließe die Zahlung für dein {pack?.name} Paket ab.</p>
              <button onClick={() => { if (pack?.pay) window.open(pack.pay, "_blank"); track("payment_click", { pack: pack?.key }, ref); }} className="w-full py-4 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
                Jetzt bezahlen & Karte aktivieren →
              </button>
            </div>
            <p className="text-[11px] text-gray-400 font-mono mt-6">Referenz: {ref}</p>
          </div>
        )}
      </div>

      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
