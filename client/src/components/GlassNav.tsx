import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";

interface GlassNavProps {
  activePage?: "startseite" | "privatkunden" | "business" | "was-ist-fiaon" | "plattform-konzept" | "login" | "investoren" | "karriere" | "presse" | "partner" | "datenraum";
}

export default function GlassNav({ activePage = "startseite" }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mob, setMob] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [privatOpen, setPrivatOpen] = useState(false);
  const [privatMobileOpen, setPrivatMobileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);
  // ── WER IST ANGEMELDET? (22.08.2026, Justins Kundentest) ────────────────
  // Die Kopfzeile zeigte jedem „Login" — auch dem Kunden mit gültiger
  // Sitzung. Jetzt fragt sie das Cookie (/kunde/me) und zeigt „Mein Bereich".
  const [kunde, setKunde] = useState<{ vorname: string | null; name: string | null } | null>(null);
  useEffect(() => {
    let weg = false;
    fetch("/api/fiaon/kunde/me", { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (!weg && j?.eingeloggt) setKunde({ vorname: j.vorname ?? null, name: j.name ?? null }); })
      .catch(() => {});
    return () => { weg = true; };
  }, []);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const inButton = dropdownRef.current?.contains(e.target as Node);
      const inPanel  = dropdownPanelRef.current?.contains(e.target as Node);
      if (!inButton && !inPanel) setPrivatOpen(false);
    };
    if (privatOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [privatOpen]);

  const pages = [
    { label: "Startseite", href: "/", key: "startseite" },
    { label: "Was ist FIAON", href: "/was-ist-fiaon", key: "was-ist-fiaon", hasGradient: true },
    { label: "Privatkunden", href: "/privatkunden", key: "privatkunden" },
    { label: "Business", href: "/business", key: "business" },
    { label: "Karriere", href: "/karriere", key: "karriere" },
    { label: "Investoren", href: "/investoren", key: "investoren" },
  ];

  const handleAntragClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMob(false);
    setShowModal(true);
  };

  return (
    <>
      <nav
        className="fixed top-0 inset-x-0 z-50 transition-all duration-500"
      >
        <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-3">
          {/* Glass pill container */}
          <div
            className={`fiaon-glass-nav rounded-full transition-all duration-500 ${
              scrolled ? "shadow-lg" : ""
            }`}
          >
            <div className="relative z-10 h-[72px] px-5 flex items-center justify-between">
              {/* Logo */}
              <a href="/" className="flex items-center shrink-0">
                <span className="text-xl font-bold tracking-tight fiaon-gradient-text-animated">FIAON</span>
              </a>

              {/* Desktop: centered links */}
              <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                {pages.map((p) => (
                  <div
                    key={p.key}
                    className="relative"
                    ref={p.key === "privatkunden" ? dropdownRef : null}
                  >
                    {p.key === "privatkunden" ? (
                      <button
                        onClick={(e) => { e.preventDefault(); setPrivatOpen(!privatOpen); }}
                        className={`relative text-[13px] font-medium pb-0.5 transition-colors duration-300 ${
                          activePage === p.key
                            ? "text-gray-900"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {p.label}
                        {activePage === p.key && (
                          <span
                            className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] rounded-full bg-[#2563eb]"
                            style={{
                              boxShadow: "0 0 6px rgba(37,99,235,.4)",
                            }}
                          />
                        )}
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                          className="inline-block ml-1 transition-transform duration-300"
                          style={{ transform: privatOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    ) : (
                      <a
                        href={p.href}
                        className={`relative text-[13px] font-medium pb-0.5 transition-colors duration-300 ${
                          activePage === p.key
                            ? "text-gray-900"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        {p.hasGradient ? (
                          <>
                            Was ist <span className="fiaon-gradient-text-animated">FIAON</span>
                          </>
                        ) : (
                          p.label
                        )}
                        {activePage === p.key && (
                          <span
                            className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] rounded-full bg-[#2563eb]"
                            style={{
                              boxShadow: "0 0 6px rgba(37,99,235,.4)",
                            }}
                          />
                        )}
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: CTA buttons */}
              <div className="hidden md:flex items-center gap-3">
                {!kunde && <button
                  onClick={handleAntragClick}
                  className="fiaon-btn-outline-animated px-5 py-2 text-[13px] font-medium relative overflow-hidden group"
                >
                  <span className="relative z-10 group-hover:text-white transition-colors duration-300">Konto eröffnen</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  </div>
                </button>}
                {kunde ? (
                  <a href="/dashboard"
                     className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold text-white"
                     style={{ background: "linear-gradient(180deg,#2563eb,#1d4ed8)", boxShadow: "0 6px 16px rgba(37,99,235,.3)" }}>
                    <span className="w-6 h-6 rounded-full bg-white/20 grid place-items-center text-[11px] font-bold">
                      {(kunde.vorname || kunde.name || "K").slice(0, 1).toUpperCase()}
                    </span>
                    Mein Bereich
                  </a>
                ) : (
                  <a
                    href="/login"
                    className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Login
                  </a>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-1"
                onClick={() => setMob(!mob)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#1f2937"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  {mob ? (
                    <>
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </>
                  ) : (
                    <>
                      <path d="M4 7h16" />
                      <path d="M4 12h16" />
                      <path d="M4 17h16" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Desktop: Privatkunden Dropdown (outside glass container to prevent clipping) */}
        {privatOpen && (
          <div className="hidden md:block absolute top-[88px] left-1/2 -translate-x-1/2 z-[100]">
            <div ref={dropdownPanelRef} className="fiaon-glass-panel rounded-2xl py-2 shadow-xl border border-gray-100 min-w-[200px]" 
              style={{ 
                backdropFilter: "blur(20px)", 
                WebkitBackdropFilter: "blur(20px)",
                background: "rgba(255, 255, 255, 0.85)"
              }}
            >
              <a
                href="/privatkunden"
                onClick={() => setPrivatOpen(false)}
                className="block px-5 py-3 text-[13.5px] font-medium text-gray-700 hover:text-gray-900 hover:bg-blue-50/50 transition-colors rounded-xl"
              >
                Privatkunden Startseite
              </a>
              <a
                href="/bonitaet"
                onClick={() => setPrivatOpen(false)}
                className="block px-5 py-3 text-[13.5px] font-medium text-gray-700 hover:text-gray-900 hover:bg-blue-50/50 transition-colors rounded-xl"
              >
                Bonitäts-Auszug
              </a>
            </div>
          </div>
        )}

        {/* Mobile full-screen menu overlay */}
        {mob && (
          <div className="md:hidden fixed inset-0 z-40" style={{ animation: "mobMenuIn .25s ease both" }}>
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-white/90"
              style={{ backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)" }}
            />
            {/* Ambient glow */}
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[420px] pointer-events-none"
              style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,.10), transparent 65%)" }}
            />
            {/* Der Hamburger in der Pille wird selbst zum X — ein zweiter
                Schließen-Knopf lag genau darüber und sah aus wie ein Fehler. */}
            <div className="relative h-full flex flex-col pt-[104px] px-5 pb-8 overflow-y-auto">
              {kunde && (
                <a href="/dashboard" onClick={() => setMob(false)}
                   className="flex items-center gap-3 px-4 py-3.5 mb-3 rounded-2xl text-white"
                   style={{ background: "linear-gradient(180deg,#2563eb,#1d4ed8)", boxShadow: "0 10px 24px rgba(37,99,235,.28)", animation: "mobItemIn .45s cubic-bezier(.22,1,.36,1) both" }}>
                  <span className="w-9 h-9 rounded-full bg-white/20 grid place-items-center text-[13px] font-bold">
                    {(kunde.vorname || kunde.name || "K").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-[.14em] opacity-80">Angemeldet{kunde.vorname ? ` als ${kunde.vorname}` : ""}</span>
                    <span className="block text-[16px] font-semibold">Mein Bereich öffnen</span>
                  </span>
                </a>
              )}
              {/* Nav items */}
              <div className="space-y-1.5">
                {pages.map((p, i) => (
                  <div key={p.key} style={{ animation: `mobItemIn .5s cubic-bezier(.22,1,.36,1) ${0.05 + i * 0.06}s both` }}>
                    {p.key === "privatkunden" ? (
                      <>
                        <button
                          onClick={() => setPrivatMobileOpen(!privatMobileOpen)}
                          className={`w-full flex items-center justify-between px-4 py-4 rounded-2xl text-[17px] font-semibold transition-all ${
                            activePage === p.key ? "text-gray-900 bg-blue-50/70" : "text-gray-700 active:bg-gray-100"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            {activePage === p.key && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />}
                            {p.label}
                          </span>
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                              privatMobileOpen ? "bg-[#2563eb] text-white rotate-180" : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </span>
                        </button>
                        {/* Mobile submenu for Privatkunden */}
                        {privatMobileOpen && (
                          <div className="mt-1 mb-1 ml-4 pl-4 border-l-2 border-blue-100 space-y-0.5" style={{ animation: "mobItemIn .35s ease both" }}>
                            <a
                              href="/privatkunden"
                              onClick={() => { setMob(false); setPrivatMobileOpen(false); }}
                              className="flex items-center justify-between px-3 py-3.5 rounded-xl text-[15px] font-medium text-gray-600 active:bg-blue-50/60 transition-colors"
                            >
                              Privatkunden Startseite
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </a>
                            <a
                              href="/bonitaet"
                              onClick={() => { setMob(false); setPrivatMobileOpen(false); }}
                              className="flex items-center justify-between px-3 py-3.5 rounded-xl text-[15px] font-medium text-gray-600 active:bg-blue-50/60 transition-colors"
                            >
                              Bonitäts-Auszug
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M9 18l6-6-6-6" />
                              </svg>
                            </a>
                          </div>
                        )}
                      </>
                    ) : (
                      <a
                        href={p.href}
                        onClick={() => setMob(false)}
                        className={`flex items-center justify-between px-4 py-4 rounded-2xl text-[17px] font-semibold transition-all ${
                          activePage === p.key ? "text-gray-900 bg-blue-50/70" : "text-gray-700 active:bg-gray-100"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          {activePage === p.key && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />}
                          {p.hasGradient ? (
                            <>
                              Was ist&nbsp;<span className="fiaon-gradient-text-animated">FIAON</span>
                            </>
                          ) : (
                            p.label
                          )}
                        </span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* CTA area */}
              <div className="mt-auto pt-8 space-y-3" style={{ animation: "mobItemIn .5s cubic-bezier(.22,1,.36,1) .32s both" }}>
                {!kunde && <button
                  onClick={handleAntragClick}
                  className="fiaon-btn-gradient w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-[16px] font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,.30)] active:scale-[.98] transition-transform"
                >
                  Konto eröffnen
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>}
                <a
                  href={kunde ? "/dashboard" : "/login"}
                  className="w-full flex items-center justify-center py-4 rounded-2xl text-[15px] font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm active:scale-[.98] transition-transform"
                >
                  {kunde ? "Mein Bereich" : "Login"}
                </a>
                <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[11px] text-gray-400">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Kostenlos &amp; unverbindlich starten
                </p>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Modal: Privatkunde oder Geschäftskunde */}
      {showModal && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" style={{ animation: "modalFadeIn .2s ease" }}>
          {/* Backdrop */}
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
            onClick={() => setShowModal(false)}
          />
          {/* Panel */}
          <div
            className="relative w-full sm:max-w-[440px] bg-white rounded-t-[28px] sm:rounded-[28px] px-6 pt-5 pb-7 sm:p-8 sm:mx-4 overflow-hidden"
            style={{
              boxShadow: "0 30px 80px rgba(15,23,42,.28)",
              animation: "sheetUp .38s cubic-bezier(.22,1,.36,1)",
            }}
          >
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[380px] h-[240px]" style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,.12), transparent 70%)" }} />
            </div>

            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Schließen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="relative z-10">
              {/* Drag handle (mobile) */}
              <div className="sm:hidden w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

              <div className="text-center mb-7">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#2563eb] text-[11px] font-bold uppercase tracking-[.16em] mb-4">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-[#2563eb] opacity-60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
                  </span>
                  Konto eröffnen
                </div>
                <h3 className="text-[24px] font-semibold tracking-tight text-gray-900 leading-snug">
                  Wie möchtest du <span className="fiaon-gradient-text-animated">fortfahren</span>?
                </h3>
              </div>

              <div className="space-y-3">
                {/* Privatkunde */}
                <a
                  href="/antrag"
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(37,99,235,.28)] group-hover:scale-105 transition-transform duration-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15.5px] font-semibold text-gray-900">Als Privatkunde</p>
                    <p className="text-[13px] text-gray-500">Kreditkarte für persönliche Nutzung</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </a>

                {/* Geschäftskunde */}
                <Link
                  href="/business"
                  onClick={() => setShowModal(false)}
                  className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(30,64,175,.28)] group-hover:scale-105 transition-transform duration-300">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15.5px] font-semibold text-gray-900">Als Geschäftskunde</p>
                    <p className="text-[13px] text-gray-500">Business-Kreditkarte für Unternehmen</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </Link>
              </div>

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Kostenlos &amp; unverbindlich · SSL-verschlüsselt
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
