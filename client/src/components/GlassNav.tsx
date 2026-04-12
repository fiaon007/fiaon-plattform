import { useState, useEffect, useRef } from "react";

interface GlassNavProps {
  activePage?: "startseite" | "privatkunden" | "business" | "was-ist-fiaon" | "plattform-konzept" | "login";
}

export default function GlassNav({ activePage = "startseite" }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mob, setMob] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setScrolled(y > 10);
    };
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const pages = [
    { label: "Startseite", href: "/", key: "startseite" },
    { label: "Was ist FIAON", href: "/was-ist-fiaon", key: "was-ist-fiaon", hasGradient: true },
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
                  <a
                    key={p.key}
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
                ))}
              </div>

              {/* Desktop: CTA buttons */}
              <div className="hidden md:flex items-center gap-3">
                <button
                  onClick={handleAntragClick}
                  className="fiaon-btn-outline-animated px-5 py-2 text-[13px] font-medium relative overflow-hidden group"
                >
                  <span className="relative z-10 group-hover:text-white transition-colors duration-300">Konto eröffnen</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#2563eb] to-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                  </div>
                </button>
                <a
                  href="/login"
                  className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Login
                </a>
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

        {/* Mobile full-screen menu overlay */}
        {mob && (
          <div className="md:hidden fixed inset-0 top-[72px] z-40 bg-white/95 backdrop-blur-xl">
            <div className="px-6 py-8 space-y-4">
              {pages.map((p) => (
                <a
                  key={p.key}
                  href={p.href}
                  onClick={() => setMob(false)}
                  className={`block py-4 text-lg font-medium transition-colors border-b border-gray-100 ${
                    activePage === p.key
                      ? "text-gray-900"
                      : "text-gray-600"
                  }`}
                >
                  {p.hasGradient ? (
                    <>
                      Was ist <span className="fiaon-gradient-text-animated">FIAON</span>
                    </>
                  ) : (
                    p.label
                  )}
                </a>
              ))}
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleAntragClick}
                  className="block w-full py-4 rounded-xl text-base font-semibold text-white fiaon-btn-gradient"
                >
                  Konto eröffnen
                </button>
                <a
                  href="/login"
                  className="block w-full py-4 rounded-xl text-base font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  Login
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Modal: Privatkunde oder Geschäftskunde */}
      {showModal && (
        <div
          className="fiaon-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="fiaon-modal max-w-[440px] relative overflow-hidden">
            {/* Animated gradient background */}
            <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-15" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.1))",
                backgroundSize: "200% 200%",
                animation: "limitGlow 6s ease-in-out infinite"
              }} />
              <div className="absolute inset-0 opacity-10" style={{
                background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)"
              }} />
            </div>

            <div className="relative z-10 text-center mb-8">
              <h3 className="text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-2">
                Konto eröffnen
              </h3>
              <p className="text-[15px] text-gray-500">
                Wie möchtest du fortfahren?
              </p>
            </div>

            <div className="relative z-10 space-y-4">
              {/* Privatkunde */}
              <a
                href="/antrag"
                className="group block w-full p-5 rounded-2xl fiaon-glass-panel hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] font-semibold text-gray-900 mb-1">
                      Als Privatkunde
                    </p>
                    <p className="text-[13px] text-gray-400">
                      Kreditkarte für persönliche Nutzung
                    </p>
                  </div>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="group-hover:translate-x-1 transition-all"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </a>

              {/* Geschäftskunde */}
              <div className="relative block w-full p-5 rounded-2xl fiaon-glass-panel opacity-60 cursor-not-allowed">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[16px] font-semibold text-gray-900 mb-1">
                      Als Geschäftskunde
                    </p>
                    <p className="text-[13px] text-gray-400">
                      Business-Kreditkarte für Unternehmen
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
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
