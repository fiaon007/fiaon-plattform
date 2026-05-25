import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · Bonitäts-Service Erklärung
   Für Behörden, Kunden, Anbieter & Partner
   ════════════════════════════════════════════ */

if (typeof document !== "undefined" && !document.head.querySelector('style[data-bs-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-bs-anims", "true");
  s.textContent = `
    @keyframes bsFadeUp   { from{opacity:0;transform:translateY(24px);}to{opacity:1;transform:none;} }
    @keyframes bsGlow     { 0%,100%{opacity:.3;}50%{opacity:.65;} }
    @keyframes bsPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(37,99,235,.4);}50%{box-shadow:0 0 0 10px rgba(37,99,235,0);} }
    @keyframes bsShimmer  { 0%{transform:translateX(-130%);}100%{transform:translateX(230%);} }
    @keyframes bsLineIn   { from{width:0;}to{width:100%;} }
  `;
  document.head.appendChild(s);
}

function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, set] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(true); io.disconnect(); } }, { threshold });
    io.observe(el); return () => io.disconnect();
  }, [threshold]);
  return { ref, v };
}

function G({ children }: { children: React.ReactNode }) {
  return <span className="fiaon-heading-gradient">{children}</span>;
}

/* ────────────────────────────────────────────
   HERO
   ──────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative pt-32 pb-20 sm:pt-44 sm:pb-28 overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-[600px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(37,99,235,0.12), transparent 65%)" }} />
      <div className="absolute -top-20 -left-24 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.07), transparent 65%)", filter: "blur(80px)", animation: "bsGlow 12s ease-in-out infinite" }} />
      <div className="absolute top-40 -right-24 w-[420px] h-[420px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.06), transparent 65%)", filter: "blur(80px)", animation: "bsGlow 16s ease-in-out infinite", animationDelay: "5s" }} />

      <div className="max-w-[900px] mx-auto px-5 sm:px-8 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-blue-200/60 bg-white/90 shadow-sm mb-8"
          style={{ backdropFilter: "blur(12px)" }}>
          <div className="w-2 h-2 rounded-full bg-[#2563eb]" style={{ animation: "bsPulse 2s ease-in-out infinite" }} />
          <span className="text-[12px] font-bold text-gray-600 tracking-widest uppercase">Service-Erklärung · Bonitäts-Auszug</span>
        </div>

        <h1 className="text-[2.6rem] sm:text-[3.5rem] lg:text-[4rem] font-extrabold tracking-tight leading-[1.03] mb-7">
          <G>KI-gestützte Bonitätsanalyse.</G>
          <br />
          <span className="text-gray-900">Transparent. Sicher. Wirksam.</span>
        </h1>

        <p className="text-[16px] sm:text-[18px] text-gray-500 leading-relaxed max-w-[620px] mx-auto mb-10">
          Diese Seite erklärt unsere Dienstleistung gegenüber Behörden, Kunden, Anbietern und Kooperationspartnern — vollständig, offen und ohne Interpretationsspielraum.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="/bonitaet"
            className="fiaon-btn-gradient relative inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[14.5px] font-bold text-white overflow-hidden"
            style={{ boxShadow: "0 12px 32px rgba(37,99,235,0.28)" }}>
            <span className="relative z-10">Zum Bonitäts-Auszug</span>
            <svg className="relative z-10" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)", animation: "bsShimmer 3s ease-in-out infinite" }} />
          </a>
          <a href="#zielgruppen"
            className="fiaon-btn-outline-animated px-7 py-3.5 text-[14.5px] font-semibold">
            Zielgruppen lesen
          </a>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   WAS WIR TUN — Kern-Erklärung
   ──────────────────────────────────────────── */
const WWTSteps = [
  {
    n: "01", color: "#2563eb", bg: "rgba(37,99,235,0.08)",
    iconPath: "M9 12h6M9 16h6M13 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z",
    iconPath2: "M13 4v5h5",
    title: "Schufa-Selbstauskunft",
    text: "Wir rufen als bevollmächtigter Dienstleister die vollständige Schufa-Akte des Nutzers ab. Dies erfolgt als scoreneutraler 'Eigenantrag' \u2014 bankseitig unsichtbar, DSGVO-konform, ohne Auswirkung auf den Score.",
  },
  {
    n: "02", color: "#7c3aed", bg: "rgba(124,58,237,0.08)",
    iconPath: "M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12",
    iconPath2: null,
    title: "KI-Analyse",
    text: "Unsere proprietäre KI-Engine durchsucht alle Einträge nach fehlerhaften, veralteten oder löschbaren Daten. Sie bewertet Risikopotenziale, erkennt Muster und priorisiert Handlungsfelder nach Wirksamkeit.",
  },
  {
    n: "03", color: "#059669", bg: "rgba(5,150,105,0.08)",
    iconPath: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
    iconPath2: null,
    title: "Handlungsanweisung",
    text: "Der Nutzer erhält eine klare, persönliche Roadmap: Welche Einträge löschbar sind, welche Fristen gelten, welche Schreiben versendet werden müssen \u2014 mit vorgefertigten Textbausteinen, sofort einsatzbereit.",
  },
];

function WasWirTun() {
  const { ref, v } = useReveal();
  return (
    <section className="py-24 sm:py-32 relative" ref={ref}
      style={{ background: "linear-gradient(180deg,#f8faff 0%,#ffffff 100%)" }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">Was wir tun</p>
          <h2 className="text-[2rem] sm:text-[2.7rem] font-extrabold tracking-tight leading-tight">
            <G>Der FIAON Bonitäts-Service</G>
            <br /><span className="text-gray-900">in einem Satz.</span>
          </h2>
          <p className="mt-5 text-[16px] text-gray-500 leading-relaxed">
            FIAON ruft im Auftrag des Nutzers dessen tagesaktuelle Schufa-Selbstauskunft ab, analysiert die enthaltenen Daten mit KI und liefert eine individuell zugeschnittene, sofort umsetzbare Handlungsanweisung zur Verbesserung der Bonität.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {WWTSteps.map((s, i) => (
            <div key={s.n}
              className={`relative p-8 rounded-3xl bg-white border border-gray-100 transition-all duration-700 hover:-translate-y-1 hover:shadow-xl ${v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 120}ms`, boxShadow: "0 4px 24px rgba(37,99,235,0.06)" }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: s.bg }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={s.iconPath} />
                    {s.iconPath2 && <path d={s.iconPath2} />}
                  </svg>
                </div>
                <span className="font-mono text-[13px] font-bold" style={{ color: s.color }}>{s.n}</span>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-3">{s.title}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   ZIELGRUPPEN
   ──────────────────────────────────────────── */
function Zielgruppen() {
  const { ref, v } = useReveal(0.06);
  const [active, setActive] = useState(0);

  const groups = [
    {
      label: "Kunden",
      icon: <><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></>,
      color: "#2563eb",
      bg: "rgba(37,99,235,0.08)",
      headline: "Was Kunden wissen müssen",
      items: [
        { bold: "Ihr Auftrag, Ihre Daten:", text: "Sie erteilen uns den Auftrag, Ihre Schufa-Selbstauskunft einzuholen. Dies geschieht ausschließlich in Ihrem Namen und auf Ihr Verlangen hin." },
        { bold: "Scoreneutraler Abruf:", text: "Der Abruf wird als 'Eigenanfrage' deklariert und ist für Banken und Gläubiger vollständig unsichtbar. Ihr Score wird dadurch nicht beeinflusst." },
        { bold: "Einmalzahlung, kein Abo:", text: "Sie zahlen einmalig 74 €. Es gibt kein Abonnement, keine Folgekosten, keine automatische Verlängerung." },
        { bold: "Lieferung am selben Werktag:", text: "Bei Bestellung bis 15:00 Uhr erhalten Sie Ihre Vollauskunft und persönliche Handlungsanweisung noch am selben Werktag per E-Mail." },
        { bold: "Ihre Daten gehören Ihnen:", text: "Wir speichern Ihre Schufa-Daten nicht dauerhaft. Nach Lieferung werden alle persönlichen Daten gemäß DSGVO gelöscht." },
      ],
    },
    {
      label: "Behörden",
      icon: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
      color: "#0f172a",
      bg: "rgba(15,23,42,0.08)",
      headline: "Für Behörden & Aufsichtsstellen",
      items: [
        { bold: "Rechtliche Einordnung:", text: "FIAON ist eine Software-as-a-Service-Plattform (SaaS). Wir sind kein Kreditinstitut und kein Finanzdienstleister gemäß KWG. Wir erbringen keine Finanz- oder Anlageberatung." },
        { bold: "DSGVO-Konformität:", text: "Alle Datenverarbeitungen erfolgen auf Basis ausdrücklicher Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) und auf Veranlassung des Nutzers. Keine Daten werden ohne explizite Zustimmung verarbeitet." },
        { bold: "Datenspeicherung & Löschung:", text: "Nutzerdaten werden ausschließlich für die Dauer der Auftragsabwicklung gespeichert. Eine weitergehende Speicherung oder Weitergabe an Dritte erfolgt nicht." },
        { bold: "Hosting:", text: "Unsere Infrastruktur ist vollständig in der EU gehostet. Kein Transfer personenbezogener Daten in Drittstaaten." },
        { bold: "Verschlüsselung:", text: "Alle Datenübertragungen erfolgen AES-256-verschlüsselt nach aktuellen deutschen Datenschutzstandards." },
      ],
    },
    {
      label: "Anbieter",
      icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
      color: "#7c3aed",
      bg: "rgba(124,58,237,0.08)",
      headline: "Für Daten- & Technologieanbieter",
      items: [
        { bold: "Klare Datenlage:", text: "Wir arbeiten mit standardisierten, strukturierten Schufa-Datensätzen. Unsere KI-Engine ist auf das deutsche Bonitätssystem spezialisiert und liefert reproduzierbare Analyseergebnisse." },
        { bold: "API-Sicherheitsstandards:", text: "Jede Datenübertragung ist end-to-end verschlüsselt. Zugriffsberechtigungen werden nach dem Prinzip der minimalen Rechtevergabe (Least Privilege) vergeben." },
        { bold: "Keine Datenweitergabe:", text: "Nutzerdaten werden nicht an Drittanbieter, Werbetreibende oder Kooperationspartner weitergegeben. Keine Monetarisierung von Nutzerdaten." },
        { bold: "Technologiestack:", text: "EU-gehosted, DSGVO-konform, ISO-27001-orientierte Sicherheitsarchitektur, regelmäßige Penetrationstests." },
        { bold: "Transparente Verarbeitung:", text: "Jeder Verarbeitungsschritt ist dokumentiert und auditierbar. Auf Anfrage stellen wir Anbietern vollständige Verarbeitungsprotokolle zur Verfügung." },
      ],
    },
    {
      label: "Kooperationspartner",
      icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
      color: "#059669",
      bg: "rgba(5,150,105,0.08)",
      headline: "Für Kooperationspartner & Investoren",
      items: [
        { bold: "Marktpositionierung:", text: "FIAON ist das einzige deutsche Angebot, das KI-gestützte Schufa-Analyse mit tagesaktuellem Express-Abruf und konkreten Lösch-Handlungsempfehlungen kombiniert — alles als Einmalprodukt ohne Abo." },
        { bold: "Technologischer Vorsprung:", text: "Unsere proprietäre KI-Engine wurde speziell für das deutsche Bonitätssystem entwickelt. Die Fehlererkennungsrate bei Schufa-Einträgen übertrifft manuelle Prüfungen deutlich." },
        { bold: "Skalierbarkeit:", text: "Das Produkt ist vollständig digital und automatisiert. Keine manuellen Prozesse in der Kernlieferkette, unbegrenzte Skalierung ohne proportionale Kostensteigerung." },
        { bold: "Datenschutz als USP:", text: "In einem Markt, in dem Datenmissbrauch ein kritisches Thema ist, differenzieren wir uns durch Zero-Retention-Policy, EU-Hosting und maximale Transparenz." },
        { bold: "Kooperationsanfragen:", text: "Wir sind offen für strategische Partnerschaften mit Fintech-Unternehmen, Rechtsdienstleistern und Datenschutzexperten. Kontakt: support@fiaon.com" },
      ],
    },
  ];

  const active_ = groups[active];

  return (
    <section id="zielgruppen" className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#0b1628 0%,#0f1e38 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.18), transparent 55%)" }} />

      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[12px] font-bold text-blue-400 tracking-[0.22em] uppercase mb-4">Für wen wir transparent sind</p>
          <h2 className="text-[2rem] sm:text-[2.7rem] font-extrabold tracking-tight text-white leading-tight">
            Unsere Erklärung gegenüber{" "}
            <span className="fiaon-heading-gradient">allen Zielgruppen.</span>
          </h2>
        </div>

        {/* Tab nav */}
        <div className={`flex flex-wrap justify-center gap-3 mb-12 transition-all duration-700 ${v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          {groups.map((g, i) => (
            <button
              key={g.label}
              onClick={() => setActive(i)}
              className="px-5 py-2.5 rounded-full text-[13.5px] font-semibold transition-all duration-300"
              style={{
                background: active === i ? `linear-gradient(135deg,${g.color},${g.color}cc)` : "rgba(255,255,255,0.06)",
                color: active === i ? "white" : "rgba(255,255,255,0.5)",
                border: active === i ? "none" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: active === i ? `0 8px 24px ${g.color}44` : "none",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          key={active}
          className="rounded-3xl p-8 sm:p-10"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${active_.color}22`,
            boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${active_.color}11 inset`,
            animation: "bsFadeUp .4s ease-out",
          }}
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: active_.bg, border: `1px solid ${active_.color}33` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active_.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {active_.icon}
              </svg>
            </div>
            <h3 className="text-[20px] sm:text-[22px] font-bold text-white">{active_.headline}</h3>
          </div>
          <div className="space-y-5">
            {active_.items.map((item, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: active_.bg, minWidth: 20 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={active_.color} strokeWidth="3" strokeLinecap="round">
                    <polyline points="4 12 10 18 20 6" />
                  </svg>
                </div>
                <p className="text-[14.5px] text-white/65 leading-relaxed">
                  <b className="text-white">{item.bold}</b>{" "}{item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   KI & DATENSCHUTZ
   ──────────────────────────────────────────── */
function KiDatenschutz() {
  const { ref, v } = useReveal();
  const pillars = [
    {
      color: "#7c3aed", bg: "rgba(124,58,237,0.08)",
      icon: <><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></>,
      title: "KI-Analyse-Engine",
      subs: [
        "Erkennung veralteter & fehlerhafter Einträge",
        "Priorisierung nach Score-Impact",
        "Automatische Mustererkennung bei Anfragen",
        "Branchenspezifische Score-Auswertung",
        "Individuelle Lösch-Wahrscheinlichkeit je Eintrag",
      ],
    },
    {
      color: "#2563eb", bg: "rgba(37,99,235,0.08)",
      icon: <><path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" /></>,
      title: "Datenschutz-Architektur",
      subs: [
        "AES-256 Ende-zu-Ende-Verschlüsselung",
        "EU-Hosting (kein Drittstaaten-Transfer)",
        "Zero-Retention-Policy nach Lieferung",
        "DSGVO Art. 6 Abs. 1 lit. a konforme Basis",
        "Löschanfragen innerhalb 24h bearbeitet",
      ],
    },
    {
      color: "#059669", bg: "rgba(5,150,105,0.08)",
      icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>,
      title: "Qualität & Wirksamkeit",
      subs: [
        "Tagesaktueller Abruf direkt von Schufa",
        "Lieferung am selben Werktag (bis 15 Uhr)",
        "Vorgefertigte Widerspruchs-Textbausteine",
        "Fristen- & Löschzeitplan im Handlungsplan",
        "Kontinuierliche KI-Modell-Updates",
      ],
    },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#ffffff 0%,#f0f4ff 100%)" }}>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.07), transparent 65%)", filter: "blur(80px)", animation: "bsGlow 14s ease-in-out infinite" }} />

      <div className="max-w-[1100px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">Technologie & Standards</p>
          <h2 className="text-[2rem] sm:text-[2.7rem] font-extrabold tracking-tight leading-tight">
            <G>Maximale Power.</G>{" "}
            <span className="text-gray-900">Maximaler Schutz.</span>
          </h2>
          <p className="mt-5 text-[16px] text-gray-500 leading-relaxed max-w-[560px] mx-auto">
            Unsere KI analysiert schneller und präziser als jede manuelle Prüfung — auf einer Datenschutz-Architektur, die keine Kompromisse kennt.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className={`relative bg-white rounded-3xl p-8 border border-gray-100 transition-all duration-700 hover:-translate-y-1 hover:shadow-xl ${v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 120}ms`, boxShadow: "0 4px 24px rgba(37,99,235,0.06)" }}
            >
              <div className="absolute top-0 inset-x-0 h-[3px] rounded-t-3xl"
                style={{ background: `linear-gradient(90deg,transparent,${p.color},transparent)` }} />
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: p.bg }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{p.icon}</svg>
              </div>
              <h3 className="text-[17px] font-bold text-gray-900 mb-5">{p.title}</h3>
              <ul className="space-y-3">
                {p.subs.map(sub => (
                  <li key={sub} className="flex items-start gap-2.5 text-[13.5px] text-gray-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5">
                      <circle cx="12" cy="12" r="12" fill={p.bg} />
                      <polyline points="6 12 10 16 18 8" stroke={p.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {sub}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   WARUM FIAON BESSER IST
   ──────────────────────────────────────────── */
function WarumBesser() {
  const { ref, v } = useReveal();
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#0b1628 0%,#0a1220 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(37,99,235,0.12), transparent 60%)" }} />
      <div className="max-w-[900px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[12px] font-bold text-blue-400 tracking-[0.22em] uppercase mb-4">Der Unterschied</p>
          <h2 className="text-[2rem] sm:text-[2.7rem] font-extrabold tracking-tight text-white leading-tight">
            Warum FIAON{" "}
            <span className="fiaon-heading-gradient">kein Vergleich</span> ist.
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          {[
            { label: "Herkömmliche Schufa-Auskunft", items: ["Bis zu 4 Wochen Wartezeit per Post", "Nur rohe Datenliste — kein Plan", "Keine Fehleranalyse", "Kein Support, keine Erklärung", "Kein Lösch-Leitfaden", "Veraltet bis zum Eintreffen"], bad: true },
            { label: "FIAON Express-Auszug", items: ["Am selben Werktag (bis 15 Uhr)", "Vollauskunft + KI-Handlungsplan", "KI erkennt löschbare Einträge", "Personal Advisor Support", "Vorgefertigte Widerspruchs-Schreiben", "Immer tagesaktuell"], bad: false },
          ].map((col, i) => (
            <div
              key={col.label}
              className={`rounded-3xl p-8 transition-all duration-700 ${v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{
                transitionDelay: `${i * 150}ms`,
                background: col.bad ? "rgba(255,255,255,0.03)" : "rgba(37,99,235,0.12)",
                border: col.bad ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(37,99,235,0.3)",
                boxShadow: col.bad ? "none" : "0 20px 60px rgba(37,99,235,0.2)",
              }}
            >
              {!col.bad && (
                <div className="absolute top-0 inset-x-0 h-[2px] rounded-t-3xl"
                  style={{ background: "linear-gradient(90deg,transparent,#2563eb,#60a5fa,transparent)" }} />
              )}
              <div className="text-[13.5px] font-bold mb-5"
                style={{ color: col.bad ? "rgba(255,255,255,0.35)" : "#60a5fa" }}>
                {col.label}
              </div>
              <ul className="space-y-3">
                {col.items.map(it => (
                  <li key={it} className="flex items-center gap-3 text-[14px]"
                    style={{ color: col.bad ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)" }}>
                    {col.bad
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(239,68,68,0.5)" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="rgba(37,99,235,0.2)" /><polyline points="6 12 10 16 18 8" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" /></svg>
                    }
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────
   FINAL CTA
   ──────────────────────────────────────────── */
function FinalCTA() {
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#f8faff 0%,#ffffff 100%)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.08), transparent 65%)", filter: "blur(60px)" }} />
      <div className="max-w-[680px] mx-auto px-5 sm:px-8 text-center relative z-10">
        <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight mb-6">
          <G>Bereit für Ihre Vollauskunft?</G>
        </h2>
        <p className="text-[16px] text-gray-500 leading-relaxed mb-10 max-w-[480px] mx-auto">
          Fordern Sie jetzt Ihre tagesaktuelle Schufa-Vollauskunft inkl. KI-Handlungsplan an — einmalig, diskret, noch heute.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href="/bonitaet"
            className="fiaon-btn-gradient relative inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] font-bold text-white overflow-hidden"
            style={{ boxShadow: "0 16px 40px rgba(37,99,235,0.28)" }}>
            <span className="relative z-10">Jetzt Vollauskunft anfordern (74 €)</span>
            <svg className="relative z-10" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)", animation: "bsShimmer 3s ease-in-out infinite" }} />
          </a>
          <a href="mailto:support@fiaon.com"
            className="fiaon-btn-outline-animated px-8 py-4 text-[15px] font-semibold">
            Kontakt für Partner
          </a>
        </div>
        <p className="mt-6 text-[12px] text-gray-400 flex items-center justify-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" /></svg>
          AES-256 · EU-Hosting · DSGVO-konform · Kein Abo
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   PAGE EXPORT
   ════════════════════════════════════════════ */
export default function BonitaetServicePage() {
  return (
    <div className="relative min-h-screen bg-white overflow-x-hidden">
      <GlassNav />
      <Hero />
      <WasWirTun />
      <Zielgruppen />
      <KiDatenschutz />
      <WarumBesser />
      <FinalCTA />
      <PremiumFooter />
    </div>
  );
}
