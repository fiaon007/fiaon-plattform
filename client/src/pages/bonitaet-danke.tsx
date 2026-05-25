import { useEffect, useState } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · Bonitäts-Auszug — Danke-Seite
   /bonitaet-danke  (Stripe return_url)
   ════════════════════════════════════════════ */

if (typeof document !== "undefined" && !document.head.querySelector('style[data-bd-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-bd-anims", "true");
  s.textContent = `
    @keyframes bdCheckDraw  { from{stroke-dashoffset:56;}to{stroke-dashoffset:0;} }
    @keyframes bdCircleIn   { from{opacity:0;transform:scale(.6);}to{opacity:1;transform:scale(1);} }
    @keyframes bdFadeUp     { from{opacity:0;transform:translateY(22px);}to{opacity:1;transform:none;} }
    @keyframes bdGlow       { 0%,100%{opacity:.3;}50%{opacity:.7;} }
    @keyframes bdPulseGreen { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.5);}50%{box-shadow:0 0 0 14px rgba(16,185,129,0);} }
    @keyframes bdShimmer    { 0%{transform:translateX(-130%);}100%{transform:translateX(230%);} }
    @keyframes bdFloat      { 0%,100%{transform:translateY(0);}50%{transform:translateY(-8px);} }
    @keyframes bdStepIn     { from{opacity:0;transform:translateX(-16px);}to{opacity:1;transform:none;} }
    @keyframes bdDotPulse   { 0%,100%{opacity:1;transform:scale(1);}50%{opacity:.4;transform:scale(.7);} }
  `;
  document.head.appendChild(s);
}

function G({ children }: { children: React.ReactNode }) {
  return <span className="fiaon-heading-gradient">{children}</span>;
}

/* ── Animated success checkmark ── */
function CheckCircle() {
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 120); return () => clearTimeout(t); }, []);

  return (
    <div className="relative w-28 h-28 mx-auto mb-8" style={{ animation: "bdCircleIn .55s cubic-bezier(.22,1,.36,1)" }}>
      {/* Glow ring */}
      <div className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.25), transparent 70%)", filter: "blur(12px)", animation: "bdPulseGreen 2.4s ease-in-out infinite" }} />
      {/* Circle */}
      <svg width="112" height="112" viewBox="0 0 112 112" fill="none" className="relative z-10">
        <circle cx="56" cy="56" r="52" fill="url(#bdGrad)" />
        <defs>
          <radialGradient id="bdGrad" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </radialGradient>
        </defs>
        {ready && (
          <polyline
            points="32 56 50 74 80 38"
            fill="none"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="56"
            strokeDashoffset="0"
            style={{ animation: "bdCheckDraw .45s ease-out .15s both" }}
          />
        )}
      </svg>
    </div>
  );
}

/* ── What happens next steps ── */
const STEPS = [
  {
    n: "01", delay: "0.1s",
    color: "#2563eb", bg: "rgba(37,99,235,0.09)",
    title: "Daten-Abgleich",
    text: "Wir gleichen Ihre Angaben mit den Schufa-Systemen ab und rufen Ihre tagesaktuelle Vollauskunft ab.",
    icon: "M9 12h6M9 16h6M13 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9zM13 4v5h5",
  },
  {
    n: "02", delay: "0.22s",
    color: "#7c3aed", bg: "rgba(124,58,237,0.09)",
    title: "KI-Analyse",
    text: "Unsere KI durchleuchtet jeden Eintrag, erkennt Fehler und erstellt Ihren persönlichen Bonitäts-Handlungsplan.",
    icon: "M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12",
  },
  {
    n: "03", delay: "0.34s",
    color: "#059669", bg: "rgba(5,150,105,0.09)",
    title: "E-Mail-Lieferung",
    text: "Sie erhalten Ihre Vollauskunft inkl. Handlungsplan noch am selben Werktag (Bestellung bis 15:00 Uhr) per E-Mail.",
    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
  },
];

/* ════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════ */
export default function BonitaetDankePage() {
  const [tick, setTick] = useState(0);

  /* Animated "dots" timer for the live-status indicator */
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 3), 700);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative min-h-screen overflow-x-hidden"
      style={{ background: "linear-gradient(180deg,#f0f4ff 0%,#ffffff 35%,#f8faff 100%)" }}>

      {/* Ambient background */}
      <div className="fixed top-0 left-0 w-[700px] h-[700px] pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle at 15% 15%, rgba(16,185,129,0.08), transparent 55%)", filter: "blur(80px)", animation: "bdGlow 14s ease-in-out infinite" }} />
      <div className="fixed top-60 right-0 w-[500px] h-[500px] pointer-events-none -z-0"
        style={{ background: "radial-gradient(circle at 85% 30%, rgba(37,99,235,0.06), transparent 55%)", filter: "blur(80px)", animation: "bdGlow 18s ease-in-out infinite", animationDelay: "6s" }} />

      <GlassNav />

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-16 sm:pt-44 sm:pb-20 text-center z-10">
        <div className="max-w-[680px] mx-auto px-5">

          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-emerald-200/70 bg-white/90 shadow-sm mb-8"
            style={{ backdropFilter: "blur(12px)", animation: "bdFadeUp .5s ease-out" }}>
            <span className="w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: "bdPulseGreen 2s ease-in-out infinite" }} />
            <span className="text-[12px] font-bold text-gray-600 tracking-widest uppercase">Zahlung erfolgreich</span>
          </div>

          <CheckCircle />

          <h1 className="text-[2.6rem] sm:text-[3.4rem] font-extrabold tracking-tight leading-[1.04] mb-5"
            style={{ animation: "bdFadeUp .6s ease-out .1s both" }}>
            <G>Vielen Dank!</G>
            <br />
            <span className="text-gray-900">Ihre Auskunft ist in Bearbeitung.</span>
          </h1>

          <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed mb-6 max-w-[500px] mx-auto"
            style={{ animation: "bdFadeUp .6s ease-out .2s both" }}>
            Wir haben Ihre Zahlung erhalten und bearbeiten Ihren Auftrag jetzt sofort. Sie erhalten Ihre vollständige Schufa-Auskunft mit persönlichem KI-Handlungsplan noch am selben Werktag per E-Mail.
          </p>

          {/* Live status indicator */}
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-white border border-gray-100 shadow-sm mb-10"
            style={{ boxShadow: "0 4px 20px rgba(37,99,235,0.08)", animation: "bdFadeUp .6s ease-out .3s both" }}>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  style={{ animation: "bdDotPulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.25}s`, opacity: tick === i ? 1 : 0.3 }} />
              ))}
            </div>
            <span className="text-[13.5px] font-semibold text-gray-700">Auftrag wird bearbeitet…</span>
            <span className="text-[12px] text-gray-400 font-medium">Lieferung bis 18:00 Uhr</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3"
            style={{ animation: "bdFadeUp .6s ease-out .35s both" }}>
            <a href="/"
              className="fiaon-btn-gradient relative inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[14.5px] font-bold text-white overflow-hidden"
              style={{ boxShadow: "0 12px 32px rgba(37,99,235,0.26)" }}>
              <span className="relative z-10">Zurück zur Startseite</span>
              <svg className="relative z-10" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              <span className="absolute inset-y-0 w-1/3 pointer-events-none"
                style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)", animation: "bdShimmer 3s ease-in-out infinite" }} />
            </a>
            <a href="mailto:support@fiaon.com"
              className="fiaon-btn-outline-animated px-8 py-3.5 text-[14.5px] font-semibold">
              Support kontaktieren
            </a>
          </div>
        </div>
      </section>

      {/* ── What happens next ── */}
      <section className="relative z-10 pb-20 sm:pb-28">
        <div className="max-w-[860px] mx-auto px-5 sm:px-8">

          <div className="text-center mb-12">
            <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-3">Was als nächstes passiert</p>
            <h2 className="text-[1.8rem] sm:text-[2.2rem] font-extrabold text-gray-900 tracking-tight">
              In <G>3 Schritten</G> zu Ihrer Auskunft.
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {STEPS.map((step) => (
              <div
                key={step.n}
                className="bg-white rounded-3xl p-7 border border-gray-100 relative overflow-hidden"
                style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.07)", animation: `bdStepIn .55s ease-out ${step.delay} both` }}
              >
                {/* Accent line top */}
                <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-3xl"
                  style={{ background: `linear-gradient(90deg,transparent,${step.color},transparent)` }} />
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: step.bg }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={step.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d={step.icon} />
                    </svg>
                  </div>
                  <span className="font-mono text-[12px] font-bold text-gray-300">{step.n}</span>
                </div>
                <h3 className="text-[16px] font-bold text-gray-900 mb-2.5">{step.title}</h3>
                <p className="text-[13.5px] text-gray-500 leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust & FAQ strip ── */}
      <section className="relative z-10 pb-24 sm:pb-32">
        <div className="max-w-[860px] mx-auto px-5 sm:px-8">
          <div className="bg-white rounded-3xl p-8 sm:p-10 border border-gray-100"
            style={{ boxShadow: "0 4px 24px rgba(37,99,235,0.06)" }}>
            <div className="grid sm:grid-cols-2 gap-8">
              {/* Left: Trust */}
              <div>
                <h3 className="text-[16px] font-bold text-gray-900 mb-5">Ihre Sicherheit</h3>
                <ul className="space-y-3.5">
                  {[
                    { c: "#10b981", t: "Zahlung 100 % sicher über Stripe" },
                    { c: "#10b981", t: "AES-256 verschlüsselte Datenübertragung" },
                    { c: "#10b981", t: "Ihre Daten werden nach Lieferung gelöscht" },
                    { c: "#10b981", t: "EU-Hosting · DSGVO-konform" },
                    { c: "#10b981", t: "Kein Abo, keine Folgekosten" },
                  ].map(item => (
                    <li key={item.t} className="flex items-center gap-2.5 text-[13.5px] text-gray-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="12" fill="rgba(16,185,129,0.1)" />
                        <polyline points="6 12 10 16 18 8" stroke={item.c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.t}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Divider */}
              <div className="sm:border-l sm:border-gray-100 sm:pl-8">
                <h3 className="text-[16px] font-bold text-gray-900 mb-5">Häufige Fragen</h3>
                <div className="space-y-5">
                  {[
                    {
                      q: "Wann erhalte ich meine Auskunft?",
                      a: "Bei Bestellung bis 15:00 Uhr am selben Werktag. Danach am nächsten Werktag morgens.",
                    },
                    {
                      q: "An welche E-Mail wird sie gesendet?",
                      a: "An die E-Mail-Adresse, die Sie im Antragsformular angegeben haben.",
                    },
                    {
                      q: "Was, wenn ich keine E-Mail erhalte?",
                      a: "Schauen Sie in Ihren Spam-Ordner. Andernfalls schreiben Sie uns: support@fiaon.com",
                    },
                  ].map(f => (
                    <div key={f.q}>
                      <p className="text-[13.5px] font-semibold text-gray-800 mb-1">{f.q}</p>
                      <p className="text-[13px] text-gray-500 leading-relaxed">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom stripe */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <span className="text-[13px] text-gray-400">
                Fragen? <a href="mailto:support@fiaon.com" className="text-[#2563eb] font-semibold hover:underline">support@fiaon.com</a>
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500"
                  style={{ animation: "bdPulseGreen 2s ease-in-out infinite" }} />
                <span className="text-[12.5px] text-gray-400 font-medium">System operational · Bearbeitung läuft</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <PremiumFooter />
    </div>
  );
}
