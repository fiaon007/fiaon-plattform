import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { TrendingUp, CheckCircle2, Clock, Wallet, Award, ChevronRight, HandCoins } from "lucide-react";
import { AgentShell, Card, Badge, ProgressBar, api, fmtCents, fmtDT, ACCENT } from "./shared";
import { Reveal, CountUp } from "./motion";
import { SalarySimulatorCard } from "./motivation";

// ============================================================================
// /agent/verdienst (Paket AO) — Abschlüsse, Provisionen, Wunschgehalt und
// die Wege zu Auszahlung + Partner-Programm an EINEM Ort. Alle Beträge
// kommen fertig gerechnet vom Server (/agent/earnings, Integer-Cents).
// ============================================================================

interface Earnings {
  rateBp: number;
  potentialCents: number;
  potentialCount: number;
  confirmedCents: number;
  inPayoutCents: number;
  paidOutCents: number;
  monthCents: number;
  monthlyGoalCents: number | null;
  overrideCents: number;
  overrideCount: number;
  entries: {
    id: number; ref: string; payment_reference: string | null; pack_name: string | null;
    base_amount_cents: number; rate_bp: number; amount_cents: number; status: string;
    created_at: string; kind: string;
    first_name: string | null; last_name: string | null; contact_name: string | null; company_name: string | null;
  }[];
}

export default function AgentVerdienstPage() {
  return (
    <AgentShell>
      <VerdienstContent />
    </AgentShell>
  );
}

function Tile({ label, cents, sub, icon: Icon, accent }: {
  label: string; cents: number; sub?: string; icon: typeof TrendingUp; accent?: boolean;
}) {
  return (
    <div className="agent-glass rounded-2xl p-4 sm:p-5 h-full">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{label}</p>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={accent ? { background: "rgba(37,99,235,.10)", color: ACCENT } : { background: "#f1f5f9", color: "#94a3b8" }}
        >
          <Icon size={15} strokeWidth={1.9} />
        </span>
      </div>
      <p className="text-[22px] sm:text-[24px] font-bold tracking-tight text-slate-900">
        <CountUp value={cents} format={fmtCents} />
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function VerdienstContent() {
  const [earnings, setEarnings] = useState<Earnings | null>(null);

  const load = useCallback(() => {
    api("/agent/earnings").then((r) => { if (r.ok) setEarnings(r.json); });
  }, []);
  useEffect(load, [load]);

  if (!earnings) {
    return (
      <div className="space-y-4">
        <div className="agent-skeleton h-28 rounded-2xl" />
        <div className="agent-skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Verdienst & Partner</h1>
        <p className="text-[12px] text-slate-400 mb-5">Deine Abschlüsse, dein Guthaben und dein Weg zum nächsten Meilenstein.</p>
      </Reveal>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Reveal index={1}>
          <Tile label="Potenziell" cents={earnings.potentialCents} icon={TrendingUp}
            sub={`${earnings.potentialCount} offen · ${(earnings.rateBp / 100).toLocaleString("de-DE")} %`} />
        </Reveal>
        <Reveal index={2}>
          <Tile label="Bestätigt · Guthaben" cents={earnings.confirmedCents} icon={CheckCircle2} accent sub="auszahlbar" />
        </Reveal>
        <Reveal index={3}>
          <Tile label="In Auszahlung" cents={earnings.inPayoutCents} icon={Clock} sub="Anforderung läuft" />
        </Reveal>
        <Reveal index={4}>
          <Tile label="Ausgezahlt" cents={earnings.paidOutCents} icon={Wallet} sub="seit Beginn" />
        </Reveal>
      </div>

      {/* Monatsziel (Admin-gepflegt) */}
      {earnings.monthlyGoalCents != null && earnings.monthlyGoalCents > 0 && (
        <Reveal index={5}>
          <div className="agent-glass rounded-2xl px-5 py-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monatsziel</p>
              <p className="text-[12px] text-slate-500 tabular-nums">
                {fmtCents(earnings.monthCents)} / {fmtCents(earnings.monthlyGoalCents)}
              </p>
            </div>
            <ProgressBar value={earnings.monthCents} max={earnings.monthlyGoalCents} />
          </div>
        </Reveal>
      )}

      {/* Wunschgehalt-Simulator (AK) */}
      <Reveal index={6}>
        <SalarySimulatorCard className="mb-4" />
      </Reveal>

      {/* Schnellwege: Auszahlung + Partner-Programm */}
      <Reveal index={7}>
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <Link href="/agent/auszahlung" className="agent-glass rounded-2xl px-5 py-4 flex items-center gap-3 transition-transform duration-150 active:scale-[.995] hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.32)]">
            <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Wallet size={17} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900">Auszahlung</span>
              <span className="block text-[11.5px] text-slate-400">
                {earnings.confirmedCents > 0 ? `${fmtCents(earnings.confirmedCents)} verfügbar` : "Guthaben & Anforderung"}
              </span>
            </span>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </Link>
          <Link href="/agent/partner-programm" className="agent-glass rounded-2xl px-5 py-4 flex items-center gap-3 transition-transform duration-150 active:scale-[.995] hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.32)]">
            <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
              <Award size={17} strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-slate-900">Partner-Programm</span>
              <span className="block text-[11.5px] text-slate-400">Meilensteine, Prämien, Team-Beteiligung</span>
            </span>
            <ChevronRight size={16} className="text-slate-300 shrink-0" />
          </Link>
        </div>
      </Reveal>

      {/* Abschluss-/Provisionsliste */}
      <Reveal index={8}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Deine Abschlüsse</h2>
          <span className="text-[12px] text-slate-400">({earnings.entries.length})</span>
          {earnings.overrideCents > 0 && (
            <span className="ml-auto text-[11px] text-slate-400">davon Team-Umsatzbeteiligung: <span className="font-semibold text-slate-600">{fmtCents(earnings.overrideCents)}</span></span>
          )}
        </div>
        <Card className="divide-y divide-slate-50">
          {earnings.entries.length === 0 && (
            <p className="px-4 py-10 text-center text-[12px] text-slate-400">
              Hier erscheinen deine Abschlüsse, sobald ein Kunde bezahlt hat.
            </p>
          )}
          {earnings.entries.map((k) => {
            const isBonus = k.kind === "feedback_bonus";
            const kName = isBonus
              ? "Feedback-Dankeschön"
              : k.company_name || [k.first_name, k.last_name].filter(Boolean).join(" ") || k.contact_name || k.payment_reference || k.ref;
            return (
              <div key={k.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {kName}
                    {k.kind === "override" && (
                      <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-semibold text-slate-500 shrink-0">Team-Beteiligung</span>
                    )}
                    {isBonus && (
                      <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-semibold text-slate-500 shrink-0 inline-flex items-center gap-1">
                        <HandCoins size={10} strokeWidth={2} /> Feedback-Bonus
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isBonus
                      ? `Einmalige Gutschrift · ${fmtDT(k.created_at)}`
                      : `${(k.pack_name || "—").replace(/\n/g, " ")} · ${fmtCents(k.base_amount_cents)} Umsatz · ${(k.rate_bp / 100).toLocaleString("de-DE")} % · ${fmtDT(k.created_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <p className="text-[14px] font-bold tabular-nums text-slate-900">{fmtCents(k.amount_cents)}</p>
                  <Badge status={k.status} />
                </div>
              </div>
            );
          })}
        </Card>
      </Reveal>
    </div>
  );
}
