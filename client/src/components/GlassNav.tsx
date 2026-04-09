import { useState, useEffect, useRef } from "react";
import logo from "@/assets/LOGO_fiaon.png";

interface GlassNavProps {
  activePage?: "startseite" | "privatkunden" | "business";
}

export default function GlassNav({ activePage = "startseite" }: GlassNavProps) {
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);
  const [mob, setMob] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setVisible(y < 60 || y < lastY.current);
      setScrolled(y > 10);
      lastY.current = y;
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const pages = [
    { label: "Startseite", href: "/", key: "startseite" },
    { label: "Privatkunden", href: "/privatkunden", key: "privatkunden" },
    { label: "Business", href: "/business", key: "business" },
  ];

  const handleAntragClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMob(false);
    setShowModal(true);
  };

  return (
    <>
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
          visible ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 py-3">
          {/* Glass pill container */}
          <div
            className={`fiaon-glass-nav rounded-full transition-all duration-500 ${
              scrolled ? "shadow-lg" : ""
            }`}
          >
            <div className="relative z-10 h-[52px] px-5 flex items-center justify-between">
              {/* Logo */}
              <a href="/" className="flex items-center shrink-0">
                <img src={logo} alt="FIAON Logo" className="h-8 w-auto" />
              </a>

              {/* Desktop: centered links */}
              <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
                {pages.map((p) => (
                  <a
                    key={p.key}
                    href={p.href}
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
                  </a>
                ))}
              </div>

              {/* Desktop: CTA button */}
              <div className="hidden md:flex items-center">
                <button
                  onClick={handleAntragClick}
                  className="fiaon-btn-outline-animated px-5 py-2 text-[13px] font-medium"
                >
                  Antrag starten
                </button>
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

            {/* Mobile dropdown */}
            <div
              className={`md:hidden overflow-hidden transition-all duration-300 ${
                mob ? "max-h-[280px]" : "max-h-0"
              }`}
            >
              <div className="px-5 pb-4 pt-1 space-y-1 border-t border-white/30">
                {pages.map((p) => (
                  <a
                    key={p.key}
                    href={p.href}
                    onClick={() => setMob(false)}
                    className={`flex items-center gap-2 text-sm font-medium py-2.5 transition-colors ${
                      activePage === p.key
                        ? "text-gray-900"
                        : "text-gray-500"
                    }`}
                  >
                    {p.label}
                    {activePage === p.key && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[#2563eb]"
                        style={{
                          boxShadow: "0 0 6px rgba(37,99,235,.5)",
                        }}
                      />
                    )}
                  </a>
                ))}
                <button
                  onClick={handleAntragClick}
                  className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-white fiaon-btn-gradient mt-2"
                >
                  Antrag starten
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Modal: Privatkunde oder Geschäftskunde */}
      {showModal && (
        <div
          className="fiaon-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="fiaon-modal max-w-[480px] relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-20" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,197,253,0.25), rgba(37,99,235,0.12), rgba(147,197,253,0.18))",
                backgroundSize: "300% 300%",
                animation: "limitGlow 8s ease-in-out infinite"
              }} />
              <div className="absolute inset-0 opacity-10" style={{
                background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)"
              }} />
            </div>

            <div className="relative z-10 text-center mb-8">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] flex items-center justify-center mx-auto mb-5 shadow-2xl shadow-blue-500/30">
                <span className="text-white text-2xl font-bold">F</span>
              </div>
              <h3 className="text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-2">
                Antrag starten
              </h3>
              <p className="text-[15px] text-gray-500">
                Wie möchtest du fortfahren?
              </p>
            </div>

            <div className="relative z-10 space-y-4">
              {/* Privatkunde */}
              <a
                href="/antrag"
                className="group block w-full p-5 rounded-2xl fiaon-glass-card hover:scale-[1.02] transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-gray-900 mb-1 tracking-tight">
                        Als Privatkunde
                      </p>
                      <p className="text-[13px] text-gray-400">
                        Kreditkarte für persönliche Nutzung
                      </p>
                    </div>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#9ca3af"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="group-hover:stroke-[#2563eb] group-hover:translate-x-1 transition-all duration-300"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </a>

              {/* Geschäftskunde */}
              <div className="relative block w-full p-5 rounded-2xl fiaon-glass-panel opacity-60 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gray-200 flex items-center justify-center">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-gray-900 mb-1 tracking-tight">
                        Als Geschäftskunde
                      </p>
                      <p className="text-[13px] text-gray-400">
                        Business-Kreditkarte für Unternehmen
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100/80 px-3 py-1.5 rounded-full">
                    Bald verfügbar
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="relative z-10 w-full mt-6 py-3 text-[13px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </>
  );
}
