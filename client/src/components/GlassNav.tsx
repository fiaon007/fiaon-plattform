import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import KarrierePopup from "@/components/site/KarrierePopup";

interface GlassNavProps {
  activePage?: "startseite" | "privatkunden" | "business" | "was-ist-fiaon" | "plattform-konzept" | "login" | "investoren" | "karriere" | "presse" | "partner" | "datenraum" | "team" | "demo" | "ratgeber" | "kontakt";
}

export default function GlassNav({ activePage = "startseite" }: GlassNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mob, setMob] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Mega-Menü am Rechner: öffnet beim Überfahren der Leiste, schließt mit kurzer Verzögerung
  const [mega, setMega] = useState(false);
  const megaTimer = useRef<number | null>(null);
  const oeffneMega = () => { if (megaTimer.current) window.clearTimeout(megaTimer.current); setMega(true); };
  const schliesseMega = () => { if (megaTimer.current) window.clearTimeout(megaTimer.current); megaTimer.current = window.setTimeout(() => setMega(false), 180); };
  // leichte 3D-Neigung der Leiste zur Maus
  const leisteRef = useRef<HTMLDivElement>(null);
  const neigen = (e: React.MouseEvent) => {
    const el = leisteRef.current; if (!el) return;
    const b = el.getBoundingClientRect();
    const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) translateZ(0)`;
  };
  const geradeStellen = () => { const el = leisteRef.current; if (el) el.style.transform = ""; };
  // Angemeldete Kunden sehen „Mein Bereich“ statt „Login“ — sonst bleibt alles, wie es war.
  const [eingeloggt, setEingeloggt] = useState(false);
  useEffect(() => {
    let weg = false;
    fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => r.json())
      .then((j) => { if (!weg && j?.eingeloggt) setEingeloggt(true); }).catch(() => {});
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
            ref={leisteRef}
            className={`fiaon-glass-nav nav-3d rounded-full ${scrolled ? "shadow-lg" : ""}`}
            onMouseEnter={oeffneMega} onMouseLeave={() => { schliesseMega(); geradeStellen(); }} onMouseMove={neigen}
          >
            {/* Drei Zonen in einer Zeile: Marke · Links (nehmen den Platz dazwischen) · Knöpfe.
                Die Links sind NICHT mehr absolut zentriert — so können sie bei schmalen
                Fenstern nicht über Marke oder Knöpfe laufen. Unter 1024px: Hamburger. */}
            <div className="relative z-10 h-[72px] px-5 flex items-center justify-between gap-4">
              {/* Logo */}
              <a href="/" className="flex items-center shrink-0">
                <span className="text-xl font-bold tracking-tight fiaon-gradient-text-animated">FIAON</span>
              </a>

              {/* Desktop: Links in der Mitte — das volle Menü öffnet sich beim Überfahren der Leiste */}
              <div className="hidden lg:flex items-center justify-center gap-6 xl:gap-8 flex-1 min-w-0 whitespace-nowrap">
                {pages.map((p) => (
                  <a key={p.key} href={p.href}
                     className={`relative text-[13px] font-medium pb-0.5 transition-colors duration-300 ${activePage === p.key ? "text-gray-900" : "text-gray-500 hover:text-gray-900"}`}>
                    {p.hasGradient ? <>Was ist <span className="fiaon-gradient-text-animated">FIAON</span></> : p.label}
                    {activePage === p.key && <span className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 6px rgba(37,99,235,.4)" }} />}
                  </a>
                ))}
              </div>

              {/* Desktop: CTA buttons */}
              <div className="hidden lg:flex items-center gap-3 shrink-0 whitespace-nowrap">
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
                  href={eingeloggt ? "/dashboard" : "/login"}
                  className="px-4 py-2 text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {eingeloggt ? "Mein Bereich" : "Login"}
                </a>
              </div>

              {/* Mobile hamburger */}
              <button
                className="lg:hidden p-1"
                onClick={() => setMob(!mob)}
                aria-label={mob ? "Menü schließen" : "Menü öffnen"}
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

        {/* Desktop: Mega-Menü — alle Seiten, öffnet beim Überfahren der Leiste */}
        <div className={`hidden lg:block nav-mega ${mega ? "auf" : ""}`} onMouseEnter={oeffneMega} onMouseLeave={schliesseMega} aria-hidden={!mega}>
          <div className="nav-mega-innen">
            {[
              { titel: "Für Kunden", eintraege: [
                { href: "/", label: "Startseite", text: "Einsicht · Aktion · Zugang" },
                { href: "/was-ist-fiaon", label: "Was ist FIAON", text: "Die Vision, genau erklärt" },
                { href: "/privatkunden", label: "Privatkunden", text: "Pakete, Ablauf, Preise" },
                { href: "/bonitaet", label: "Bonitäts-Auszug", text: "Ihre Auskunft, beantragt durch FIAON" },
                { href: "/business", label: "Business", text: "Firmenbonität und Geschäftskonto" },
              ] },
              { titel: "Unternehmen", eintraege: [
                { href: "/team", label: "Team", text: "Wer FIAON baut" },
                { href: "/karriere", label: "Karriere", text: "Von zuhause für FIAON arbeiten" },
                { href: "/partner", label: "Partner", text: "Banken, Auskunfteien, Vermittler" },
                { href: "/presse", label: "Presse", text: "Fakten, Zahlen, Ansprechpartner" },
                { href: "/investoren", label: "Investoren", text: "Das Modell, der Datenraum" },
                { href: "/datenraum", label: "Datenraum", text: "Due Diligence auf Anfrage" },
              ] },
            ].map((g) => (
              <div key={g.titel} className="nav-mega-gruppe">
                <p className="nav-mega-titel">{g.titel}</p>
                {g.eintraege.map((e) => (
                  <a key={e.href} href={e.href} className="nav-mega-eintrag" data-an={activePage === e.href.replace("/", "") || (e.href === "/" && activePage === "startseite") ? "1" : undefined}>
                    <span className="label">{e.label}</span>
                    <span className="text">{e.text}</span>
                  </a>
                ))}
              </div>
            ))}
            <div className="nav-mega-gruppe nav-mega-konto">
              <p className="nav-mega-titel">Ihr Konto</p>
              <p className="nav-mega-satz">Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie begleitet.</p>
              <button type="button" onClick={handleAntragClick} className="nav-mega-knopf">Konto eröffnen</button>
              <a href={eingeloggt ? "/dashboard" : "/login"} className="nav-mega-knopf still">{eingeloggt ? "Mein Bereich" : "Login"}</a>
              <p className="nav-mega-fuss">SEPA-Lastschrift · EU-Hosting · Anwaltlich geprüft</p>
            </div>
          </div>
        </div>

        {/* ── Handy-Menü (neu 22.08.2026): dunkle Glasbühne statt leerer weißer Fläche.
            Zwei Gruppen (Für Kunden · Unternehmen), jede Zeile mit Zweitzeile,
            darunter die beiden Knöpfe und die Vertrauenszeile. Gleiche Sprache wie die Website. */}
        {mob && (
          <div className="lg:hidden fixed inset-0 z-40" style={{ animation: "mobMenuIn .22s ease both" }}>
            {/* Leichter Schleier — tippen daneben schließt */}
            <button type="button" aria-label="Menü schließen" onClick={() => setMob(false)} className="absolute inset-0 w-full h-full"
                    style={{ background: "rgba(10,22,40,.28)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }} />
            {/* Die schwebende Karte unter der Kopfzeile: helles Glas, dunkle Schrift */}
            <div className="absolute left-3 right-3 top-[82px] rounded-[26px] overflow-hidden flex flex-col"
                 style={{ maxHeight: "calc(100dvh - 100px)", background: "rgba(255,255,255,.86)", border: "1px solid rgba(255,255,255,.9)",
                          boxShadow: "0 30px 80px rgba(15,23,42,.28), inset 0 1px 0 #fff", backdropFilter: "blur(28px) saturate(160%)", WebkitBackdropFilter: "blur(28px) saturate(160%)",
                          animation: "mobItemIn .45s cubic-bezier(.22,1,.36,1) both" }}>
              <div className="overflow-y-auto px-4 pt-4 pb-3">
                {[
                  { titel: "Für Kunden", eintraege: [
                    { href: "/", label: "Startseite", text: "Einsicht · Aktion · Zugang", key: "startseite" },
                    { href: "/was-ist-fiaon", label: "Was ist FIAON", text: "Die Plattform in drei Schichten", key: "was-ist-fiaon" },
                    { href: "/ratgeber", label: "Ratgeber", text: "Einträge, Auskunft, Karte – ehrlich erklärt", key: "ratgeber" },
                    { href: "/werkzeuge/eintrag-pruefen", label: "Eintrag prüfen", text: "Fünf Fragen – ist Ihr Eintrag angreifbar?", key: "werkzeuge" },
                    { href: "/privatkunden", label: "Privatkunden", text: "Pakete, Ablauf, Preise", key: "privatkunden" },
                    { href: "/bonitaet", label: "Bonitäts-Auszug", text: "Ihre Auskunft, beantragt durch FIAON", key: "bonitaet" },
                    { href: "/business", label: "Business", text: "Firmenbonität und Geschäftskonto", key: "business" },
                  ] },
                  { titel: "Unternehmen", eintraege: [
                    { href: "/team", label: "Team", text: "Wer FIAON baut", key: "team" },
                    { href: "/karriere", label: "Karriere", text: "Fest oder frei, remote in DACH", key: "karriere" },
                    { href: "/partner", label: "Partner", text: "Banken, Auskunfteien, Vermittler", key: "partner" },
                    { href: "/presse", label: "Presse", text: "Fakten, Zahlen, Ansprechpartner", key: "presse" },
                    { href: "/investoren", label: "Investoren", text: "Das Modell, der Datenraum", key: "investoren" },
                    { href: "/kontakt", label: "Kontakt & Support", text: "Telefon, E-Mail, Assistent, Dringend melden", key: "kontakt" },
                  ] },
                ].map((g, gi) => (
                  <div key={g.titel} className={gi ? "mt-4" : ""} style={{ animation: `mobItemIn .45s cubic-bezier(.22,1,.36,1) ${0.06 + gi * 0.08}s both` }}>
                    <p className="text-[10.5px] uppercase tracking-[.2em] mb-1.5 px-2" style={{ color: "#2563eb" }}>{g.titel}</p>
                    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,.55)", border: "1px solid rgba(15,23,42,.06)" }}>
                      {g.eintraege.map((e, i) => (
                        <a key={e.href} href={e.href} onClick={() => setMob(false)}
                           className="flex items-center justify-between gap-3 px-3.5 py-3 active:bg-blue-50"
                           style={{ borderTop: i ? "1px solid rgba(15,23,42,.06)" : undefined, background: activePage === e.key ? "rgba(37,99,235,.08)" : undefined }}>
                          <span className="min-w-0">
                            <span className="block text-[15px]" style={{ fontWeight: 400, color: "#0f172a" }}>{e.label}</span>
                            <span className="block text-[11.5px] mt-0.5" style={{ color: "#64748b" }}>{e.text}</span>
                          </span>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" className="shrink-0"><path d="M9 18l6-6-6-6" /></svg>
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4 pt-2 flex gap-2.5" style={{ borderTop: "1px solid rgba(15,23,42,.06)", animation: "mobItemIn .45s cubic-bezier(.22,1,.36,1) .22s both" }}>
                <button onClick={handleAntragClick}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-[14.5px] text-white active:scale-[.98] transition-transform"
                        style={{ fontWeight: 400, background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 10px 24px rgba(37,99,235,.3), inset 0 1px 0 rgba(255,255,255,.25)" }}>
                  Konto eröffnen
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
                <a href={eingeloggt ? "/dashboard" : "/login"}
                   className="flex-1 flex items-center justify-center py-3 rounded-full text-[14.5px] active:scale-[.98] transition-transform"
                   style={{ fontWeight: 400, color: "#1d4ed8", background: "#fff", border: "1px solid rgba(37,99,235,.35)" }}>
                  {eingeloggt ? "Mein Bereich" : "Login"}
                </a>
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
                  Wie möchten Sie <span className="fiaon-gradient-text-animated">fortfahren</span>?
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
      <KarrierePopup />
    </>
  );
}
