import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Sparkles, MessageSquarePlus, User, Wallet, Award, ChevronRight, LogOut, BarChart3, GraduationCap } from "lucide-react";
import { AgentShell, useAgentInfo, Avatar, ACCENT } from "./shared";
import { Reveal } from "./motion";
import { FirstStepsPanel } from "./motivation";
import { getUnseenCount } from "./updates-data";

// ============================================================================
// /agent/mehr (Paket AO) — alle weiteren Bereiche an einem ruhigen Ort:
// Skripte, Updates, Feedback, Profil (+ Schnellwege Auszahlung/Partner).
// Hier steht auch „Erste Schritte": die Startseite trägt genau drei Elemente,
// die Einstiegshilfe für neue Agents gehört aber nicht gelöscht — sie steht
// jetzt hier und verschwindet weiterhin von selbst, sobald sie erledigt ist.
// ============================================================================

const AREAS: { href: string; label: string; desc: string; icon: typeof FileText; badgeKey?: string; nurLeitung?: boolean }[] = [
  // ── DIE ACADEMY (28.08.2026) ────────────────────────────────────────────
  // Sie steht GANZ OBEN: Ein neuer Mitarbeiter soll sie finden, ohne zu
  // scrollen — und ein alter soll daran erinnert werden, dass sie es gibt.
  { href: "/agent/academy", label: "Academy", desc: "Der Ablauf deines Bereichs, Kapitel für Kapitel — mit gespeichertem Fortschritt", icon: GraduationCap },
  // ── NUR FÜR DIE LEITUNG (29.08.2026) ────────────────────────────────────
  // `nurLeitung` blendet den Eintrag für alle anderen aus. Die Seite selbst
  // prüft es ebenfalls (über `istLeitung` vom Server) — die Anzeige ist die
  // Bequemlichkeit, die Wand steht dort.
  { href: "/agent/schulung", label: "Schulung", desc: "Reisen zum Vorführen, Funktionskatalog und der Stand deines Teams", icon: GraduationCap, nurLeitung: true },
  { href: "/agent/skripte", label: "Skripte", desc: "Gesprächsvorlagen und Leitfäden für deine Telefonate", icon: FileText },
  { href: "/agent/updates", label: "Updates", desc: "Neuerungen an deinem Agent-Portal", icon: Sparkles, badgeKey: "updates" },
  { href: "/agent/feedback", label: "Feedback", desc: "Verbesserungen vorschlagen — Umsetzung wird belohnt", icon: MessageSquarePlus },
  { href: "/agent/dokumente", label: "Meine Dokumente", desc: "Vertrag und Provisions-Abrechnungen als PDF", icon: FileText },
  { href: "/agent/profil", label: "Profil", desc: "Konto, Passwort und Auszahlungsdaten", icon: User },
  { href: "/agent/auszahlung", label: "Auszahlung", desc: "Guthaben prüfen und Auszahlung beantragen", icon: Wallet },
  { href: "/agent/partner-programm", label: "Partner-Programm", desc: "Meilensteine, Prämien und Team-Beteiligung", icon: Award },
  // P4-C Spiegelansicht: dieselben Zahlen, die auch die Verwaltung sieht — Transparenz.
  { href: "/agent/leistung", label: "Meine Leistung", desc: "Deine Arbeitsergebnisse — exakt das, was auch die Verwaltung sieht", icon: BarChart3 },
];

export default function AgentMehrPage() {
  return (
    <AgentShell>
      <MehrContent />
    </AgentShell>
  );
}

function MehrContent() {
  const { agent } = useAgentInfo();
  const [, navigate] = useLocation();
  const [unreadUpdates, setUnreadUpdates] = useState(0);
  // ── IST DER NUTZER LEITUNG? ────────────────────────────────────────────
  // Der SERVER sagt es (`istLeitung` aus /agent/academy) — kein Rollen-Vergleich
  // hier. Eine zweite Fassung derselben Regel geht auseinander.
  const [istLeitung, setIstLeitung] = useState(false);
  useEffect(() => {
    void fetch("/api/fiaon/agent/academy", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setIstLeitung(j?.istLeitung === true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setUnreadUpdates(getUnseenCount());
    const onSeen = () => setUnreadUpdates(0);
    window.addEventListener("agent-updates-seen", onSeen);
    return () => window.removeEventListener("agent-updates-seen", onSeen);
  }, []);

  const logout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/fiaon/agent/logout", { method: "POST", credentials: "include" }).catch(() => {});
    navigate("/agent");
    window.location.reload();
  };

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Mehr</h1>
        <p className="text-[12px] text-slate-400 mb-5">Skripte, Updates, Feedback und dein Konto.</p>
      </Reveal>

      {agent && (
        <Reveal index={1}>
          <Link href="/agent/profil" className="agent-glass rounded-2xl px-5 py-4 mb-4 flex items-center gap-3 transition-transform duration-150 active:scale-[.995]">
            <Avatar name={agent.name} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-slate-900 truncate">{agent.name}</p>
              <p className="text-[12px] text-slate-400 truncate">{agent.email}</p>
            </div>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </Link>
        </Reveal>
      )}

      <FirstStepsPanel className="mb-4" />

      <div className="space-y-2.5">
        {AREAS.filter((a) => !a.nurLeitung || istLeitung).map((a, i) => {
          const Icon = a.icon;
          const badge = a.badgeKey === "updates" ? unreadUpdates : 0;
          return (
            <Reveal key={a.href} index={i + 2}>
              <Link href={a.href} className="agent-glass rounded-2xl px-5 py-4 flex items-center gap-3 transition-transform duration-150 active:scale-[.995] hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.32)]">
                <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
                    {a.label}
                    {badge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: ACCENT }}>{badge}</span>
                    )}
                  </span>
                  <span className="block text-[11.5px] text-slate-400">{a.desc}</span>
                </span>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </Link>
            </Reveal>
          );
        })}
      </div>

      <Reveal index={AREAS.length + 2}>
        <button
          type="button"
          onClick={logout}
          className="mt-5 w-full py-3 rounded-2xl border border-slate-200 bg-white text-[13px] font-semibold text-slate-500 hover:text-slate-700 hover:border-slate-300 inline-flex items-center justify-center gap-2 transition-colors"
          style={{ minHeight: 48 }}
        >
          <LogOut size={15} strokeWidth={1.8} /> Abmelden
        </button>
      </Reveal>
    </div>
  );
}
