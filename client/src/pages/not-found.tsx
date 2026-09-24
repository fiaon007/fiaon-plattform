import { Link, useLocation } from "wouter";
import { Compass } from "lucide-react";
import { istBusinessBereich } from "@/lib/bereich";

// ═══════════════════════════════════════════════════════════════════
// Rollenbewusste 404 (Paket N4): Statt Sackgasse zeigt die Seite je
// nach URL-Kontext (/admin, /agent, öffentlich) die passenden Auswege.
// 19.09.2026 (E-192): Unter /business führen die Auswege zu FIAON Global —
// nie zur Startseite, zum Login oder zu „Was ist FIAON?" der Privatkunden.
// ═══════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

export default function NotFound() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const isAgent = location.startsWith("/agent");
  const business = !isAdmin && !isAgent && istBusinessBereich(location, typeof window !== "undefined" ? window.location.search : "");
  const en = location.startsWith("/en/") || location === "/en";

  if (business) {
    const start = en ? "/en/business" : "/business";
    const NAVY = "#12284a";
    const wege = en
      ? [{ href: `${start}#pakete`, label: "Packages and prices" }, { href: `${start}#gespraech`, label: "Arrange a first call" }, { href: "/en/business/faq", label: "Questions and answers" }]
      : [{ href: `${start}#pakete`, label: "Pakete und Preise" }, { href: `${start}#gespraech`, label: "Erstgespräch vereinbaren" }, { href: "/business/fragen", label: "Fragen und Antworten" }];
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <p className="text-lg tracking-tight mb-5" style={{ color: NAVY }}><b>FIAON</b> <i style={{ fontFamily: "'Newsreader', Georgia, serif" }}>Global</i></p>
          <span className="inline-flex w-12 h-12 rounded-full border border-slate-200 items-center justify-center text-slate-400 mb-4">
            <Compass size={20} strokeWidth={1.7} />
          </span>
          <h1 className="text-[16px] font-bold text-slate-900 mb-1.5">{en ? "This page does not exist" : "Diese Seite existiert nicht"}</h1>
          <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
            {en ? "The address " : "Die Adresse "}<span className="font-mono text-slate-600 break-all">{location}</span>
            {en ? " leads nowhere — perhaps a typo or an outdated link." : " führt ins Leere — vielleicht ein Tippfehler oder ein veralteter Link."}
          </p>
          <a href={start} className="inline-block w-full px-5 py-3 rounded-xl text-white text-[13px] font-semibold mb-3" style={{ background: NAVY }}>
            {en ? "Go to FIAON Global" : "Zu FIAON Global"}
          </a>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {wege.map((w) => <a key={w.href} href={w.href} className="text-[12px] font-semibold text-slate-500 hover:text-slate-800">{w.label}</a>)}
          </div>
        </div>
      </div>
    );
  }

  const primary = isAdmin
    ? { href: "/admin", label: "Zum Admin-Dashboard" }
    : isAgent
      ? { href: "/agent", label: "Zum Mitarbeiter-Portal" }
      : { href: "/", label: "Zur Startseite" };

  const secondary = isAdmin
    ? [{ href: "/admin/zahlungen", label: "Zahlungszentrale" }, { href: "/admin/team", label: "Team" }, { href: "/", label: "Startseite" }]
    : isAgent
      ? [{ href: "/agent/kalender", label: "Kalender" }, { href: "/agent/profil", label: "Profil" }, { href: "/", label: "Startseite" }]
      : [{ href: "/login", label: "Kunden-Login" }, { href: "/was-ist-fiaon", label: "Was ist FIAON?" }];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-lg font-bold tracking-tight mb-5" style={{ color: ACCENT }}>FIAON</p>
        <span className="inline-flex w-12 h-12 rounded-full border border-slate-200 items-center justify-center text-slate-400 mb-4">
          <Compass size={20} strokeWidth={1.7} />
        </span>
        <h1 className="text-[16px] font-bold text-slate-900 mb-1.5">Diese Seite existiert nicht</h1>
        <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
          Die Adresse <span className="font-mono text-slate-600 break-all">{location}</span> führt ins Leere —
          vielleicht ein Tippfehler oder ein veralteter Link.
        </p>
        <Link
          href={primary.href}
          className="inline-block w-full px-5 py-3 rounded-xl text-white text-[13px] font-semibold mb-3"
          style={{ background: ACCENT }}
        >
          {primary.label}
        </Link>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          {secondary.map((s) => (
            <Link key={s.href} href={s.href} className="text-[12px] font-semibold text-slate-400 hover:text-slate-700">
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
