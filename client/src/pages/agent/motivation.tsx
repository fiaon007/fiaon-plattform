import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "wouter";
import {
  CheckCircle2, TrendingUp, Users, Award, Target, BarChart3,
  ListChecks, X, HandCoins, Save, Info,
} from "lucide-react";
import { api, fmtCents, fmtTime, fmtD, isToday, inputCls, btnPrimary, ACCENT } from "./shared";

// ============================================================================
// Motivations-Bausteine (Pakete AH/AK/AO) — gemeinsam genutzt von
// /agent (Dashboard „Mein Tag") und /agent/verdienst.
// WICHTIG (AH): Der Feed zeigt AUSSCHLIESSLICH echte Ereignisse und klar als
// Statistik gekennzeichnete Benchmark-Impulse — KEINE fiktiven Personen.
// ============================================================================

const POLL_MS = 45_000; // AJ: leichtgewichtiges Polling, kein neuer Realtime-Stack

// ═══════════════ AH — Aktivitäts-Feed ═══════════════

interface FeedEvent {
  id: string;
  type: string; // own_deal | override | feedback_bonus | team_deal | milestone
  title: string;
  sub: string | null;
  amountCents: number | null;
  at: string;
  highlight: boolean;
}

function feedIcon(type: string) {
  if (type === "own_deal") return CheckCircle2;
  if (type === "override") return Users;
  if (type === "milestone") return Award;
  if (type === "feedback_bonus") return HandCoins;
  return TrendingUp; // team_deal
}

/**
 * Zeitangabe so, wie ein Mensch sie sagt: „gerade eben", „vor 12 Minuten",
 * „vor 3 Stunden", „gestern 14:20". Erst ab einer Woche das reine Datum.
 */
function feedTime(at: string): string {
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) return fmtD(at);
  const min = Math.floor((Date.now() - t) / 60000);

  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} ${min === 1 ? "Minute" : "Minuten"}`;

  const std = Math.floor(min / 60);
  if (isToday(at)) return `vor ${std} ${std === 1 ? "Stunde" : "Stunden"}`;

  const gestern = new Date(Date.now() - 86_400_000);
  const d = new Date(at);
  if (d.toDateString() === gestern.toDateString()) return `gestern ${fmtTime(at)}`;

  const tage = Math.floor(min / 1440);
  if (tage < 7) return `vor ${tage} Tagen`;
  return fmtD(at);
}

export function FeedPanel({ className = "" }: { className?: string }) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [impulses, setImpulses] = useState<{ id: string; text: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await api("/agent/feed");
    if (!r.ok) return;
    const next: FeedEvent[] = r.json.events || [];
    // Neue Einträge markieren (weiche Einblendung) — nur nach dem Erst-Load
    if (knownIds.current.size > 0) {
      const fresh = new Set<string>();
      for (const e of next) if (!knownIds.current.has(e.id)) fresh.add(e.id);
      if (fresh.size > 0) setFreshIds(fresh);
    }
    knownIds.current = new Set(next.map((e) => e.id));
    setEvents(next);
    setImpulses(r.json.impulses || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className={className}>
      {/* Benchmark-Impulse: ausdrücklich als Statistik gekennzeichnet (AH3) */}
      {impulses.length > 0 && (
        <div className="agent-glass rounded-2xl p-4 mb-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5 flex items-center gap-1.5">
            <BarChart3 size={12} strokeWidth={2} /> Benchmarks · Statistik aus echten Zahlen
          </p>
          <div className="space-y-2">
            {impulses.map((im) => (
              <p key={im.id} className="text-[12.5px] text-slate-600 leading-relaxed pl-3 border-l-2 border-slate-200">
                {im.text}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="agent-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100/80 flex items-center gap-2">
          <TrendingUp size={14} strokeWidth={1.8} className="text-slate-400" />
          <h2 className="text-[13px] font-semibold text-slate-900">Aktivität</h2>
        </div>
        {!loaded && <div className="p-4 space-y-2">{[0, 1, 2].map((i) => <div key={i} className="agent-skeleton h-12 rounded-xl" />)}</div>}
        {loaded && events.length === 0 && (
          <p className="px-4 py-8 text-center text-[12px] text-slate-400">
            Hier erscheinen deine Abschlüsse und die Bewegung im Vertrieb.
          </p>
        )}
        <div className="divide-y divide-slate-50 max-h-[520px] overflow-y-auto agent-scroll">
          {events.map((e) => {
            const Icon = feedIcon(e.type);
            return (
              <div key={e.id} className={`px-4 py-3 flex items-start gap-3 ${freshIds.has(e.id) ? "agent-feed-in" : ""}`}>
                <span
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={e.highlight ? { background: "rgba(37,99,235,.10)", color: ACCENT } : { background: "#f1f5f9", color: "#94a3b8" }}
                >
                  <Icon size={15} strokeWidth={1.9} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[12.5px] leading-snug ${e.highlight ? "font-semibold text-slate-900" : "font-medium text-slate-600"}`}>
                    {e.title}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {[e.sub, feedTime(e.at)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {e.amountCents != null && (
                  <span className="text-[13px] font-bold tabular-nums shrink-0" style={{ color: e.highlight ? ACCENT : "#334155" }}>
                    +{fmtCents(e.amountCents)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════ AK — Wunschgehalt-Simulator (rechnet serverseitig) ═══════════════

interface SimData {
  desiredCents: number | null;
  monthCents: number;
  remainingCents?: number;
  baseRateBp?: number;
  sim: {
    achieved: boolean;
    dealsNeeded: number;
    perWorkday: number;
    todayTarget: number;
    workdaysLeft: number;
    avgDealCents: number;
    avgSource: string;
    avgThin: boolean;
    segments: { rateBp: number; deals: number; label: string }[];
    reachable: boolean;
    ceilingPerWorkday: number;
    suggestedCents: number | null;
  } | null;
}

export function SalarySimulatorCard({ className = "" }: { className?: string }) {
  const [data, setData] = useState<SimData | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showAnnahmen, setShowAnnahmen] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/agent/wunschgehalt");
    if (r.ok) {
      setData(r.json);
      if (r.json.desiredCents) setInput(String(Math.round(r.json.desiredCents / 100)));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const eur = Number(input.replace(",", "."));
    if (isNaN(eur) || eur < 0) return;
    await persist(Math.round(eur * 100));
  };

  const persist = async (cents: number) => {
    setBusy(true);
    const r = await api("/agent/wunschgehalt", { method: "POST", body: JSON.stringify({ amountCents: cents }) });
    setBusy(false);
    if (r.ok) { setEditing(false); load(); }
  };

  if (!data) return <div className={`agent-skeleton h-40 rounded-2xl ${className}`} />;

  const sim = data.sim;
  const hasGoal = data.desiredCents != null && data.desiredCents > 0;

  return (
    <div className={`agent-glass rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
          <Target size={15} strokeWidth={1.8} className="text-slate-400" /> Mein Wunschgehalt diesen Monat
        </h2>
        {hasGoal && !editing && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="text-[11.5px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
            Ändern
          </button>
        )}
      </div>

      {(!hasGoal || editing) ? (
        <form onSubmit={save} className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number" min="0" step="50" inputMode="numeric"
              value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="z. B. 3000" className={inputCls} style={{ minHeight: 46 }}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 pointer-events-none">€</span>
          </div>
          <button type="submit" disabled={busy || !input} className={`${btnPrimary} inline-flex items-center gap-1.5`} style={{ minHeight: 46 }}>
            <Save size={13} strokeWidth={2} /> {busy ? "…" : "Speichern"}
          </button>
        </form>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3 mb-3">
            <p className="text-[24px] font-bold tracking-tight text-slate-900 tabular-nums">{fmtCents(data.desiredCents!)}</p>
            <p className="text-[12px] text-slate-500 tabular-nums pb-1">bisher {fmtCents(data.monthCents)}</p>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, (data.monthCents / data.desiredCents!) * 100)}%`, background: ACCENT }}
            />
          </div>

          {sim?.achieved ? (
            <p className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={15} strokeWidth={2} style={{ color: ACCENT }} />
              Ziel erreicht — stark. Alles Weitere ist Bonus.
            </p>
          ) : sim && !sim.reachable ? (
            /* Unerreichbar: KEINE hochgerechnete Fantasiezahl, sondern ein
               ehrliches Zwischenziel aus echten Daten. */
            <div className="space-y-3">
              <p className="text-[13px] text-slate-700 leading-relaxed">
                Mit deinem aktuellen Schnitt ist{" "}
                <span className="font-semibold tabular-nums">{fmtCents(data.desiredCents!)}</span>{" "}
                in diesem Monat nicht erreichbar — setz dir ein Zwischenziel.
              </p>
              <p className="text-[12px] text-slate-500 leading-relaxed">
                Dafür wären rund <span className="font-semibold tabular-nums">{sim.perWorkday}</span> Abschlüsse
                pro Werktag nötig. Die beste Tagesleistung im Team lag zuletzt bei{" "}
                <span className="font-semibold tabular-nums">{sim.ceilingPerWorkday}</span>.
              </p>
              {sim.suggestedCents != null && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); persist(sim.suggestedCents!); }}
                  disabled={busy}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100 disabled:opacity-60"
                  style={{ minHeight: 46 }}
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Realistisches Zwischenziel</span>
                  <span className="block text-[15px] font-bold tabular-nums text-slate-900 mt-0.5">
                    {fmtCents(sim.suggestedCents)}
                    <span className="ml-2 text-[11.5px] font-semibold" style={{ color: ACCENT }}>übernehmen</span>
                  </span>
                </button>
              )}
              <AnnahmenHinweis sim={sim} open={showAnnahmen} onToggle={() => setShowAnnahmen((v) => !v)} />
            </div>
          ) : sim ? (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-700 leading-relaxed">
                Für <span className="font-semibold tabular-nums">{fmtCents(data.desiredCents!)}</span> brauchst du noch{" "}
                <span className="font-bold tabular-nums" style={{ color: ACCENT }}>{sim.dealsNeeded} Abschlüsse</span>{" "}
                — ca. <span className="font-semibold tabular-nums">{sim.perWorkday}</span> pro verbleibendem Werktag
                ({sim.workdaysLeft} Werktage), heute noch{" "}
                <span className="font-semibold tabular-nums">~{sim.todayTarget}</span>.
              </p>
              {/* Gestaffelte Sätze: Meilenstein-Sprung transparent ausweisen */}
              {sim.segments.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {sim.segments.map((s, i) => (
                    <span key={i} className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10.5px] font-medium text-slate-500 tabular-nums">
                      {s.deals}× zu {(s.rateBp / 100).toLocaleString("de-DE")} % ({s.label})
                    </span>
                  ))}
                </div>
              )}
              <AnnahmenHinweis sim={sim} open={showAnnahmen} onToggle={() => setShowAnnahmen((v) => !v)} />
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">Noch keine Datenbasis für die Berechnung.</p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Erklärt die Annahmen hinter der Rechnung in einem Satz — aufklappbar statt
 * Hover-Tooltip, damit es auf dem Handy bedienbar bleibt. Ist die Datenbasis
 * dünn (weniger als fünf eigene Abschlüsse), wird das ausdrücklich gesagt.
 */
function AnnahmenHinweis({
  sim, open, onToggle,
}: {
  sim: { avgDealCents: number; avgSource: string; avgThin: boolean };
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
        style={{ minHeight: 32 }}
        aria-expanded={open}
      >
        <Info size={12} strokeWidth={2} />
        Wie wird das gerechnet?
      </button>
      {open && (
        <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
          Gerechnet wird mit einem Ø-Auftragswert von{" "}
          <span className="font-semibold tabular-nums">{fmtCents(sim.avgDealCents)}</span>{" "}
          ({sim.avgSource}), deinem aktuellen Provisionssatz inklusive Partnerstatus-Zuschlag
          und den Meilenstein-Sprüngen, die während des Monats greifen.
          {sim.avgThin && " Du hast noch zu wenige eigene Abschlüsse für einen eigenen Schnitt — deshalb der Team-Wert."}
          {" "}Boni und Team-Beteiligungen zählen zu deinem Verdienst, aber nicht als Abschluss.
          <span className="block mt-1 text-slate-400">Orientierung — keine Zusage.</span>
        </p>
      )}
    </div>
  );
}

// ═══════════════ AO — Erste-Schritte-Panel (neue Agents) ═══════════════

interface FirstStep { key: string; label: string; done: boolean }

export function FirstStepsPanel({ className = "" }: { className?: string }) {
  const [steps, setSteps] = useState<FirstStep[] | null>(null);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    const r = await api("/agent/first-steps");
    if (r.ok) {
      if (r.json.dismissed || r.json.allDone) { setHidden(true); return; }
      setSteps(r.json.steps);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (hidden || !steps) return null;

  const doneCount = steps.filter((s) => s.done).length;

  const markScripts = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api("/agent/first-steps", { method: "POST", body: JSON.stringify({ key: "skripte" }) });
    load();
  };
  const dismiss = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await api("/agent/first-steps", { method: "POST", body: JSON.stringify({ key: "dismiss" }) });
    setHidden(true);
  };

  const stepLink: Record<string, string> = {
    profil: "/agent/profil",
    iban: "/agent/profil",
    skripte: "/agent/skripte",
    anruf: "/agent/meine-kunden",
    notiz: "/agent/meine-kunden",
  };

  return (
    <div className={`agent-glass rounded-2xl p-5 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-2">
          <ListChecks size={15} strokeWidth={1.8} className="text-slate-400" /> Erste Schritte
          <span className="text-[11px] font-semibold text-slate-400">{doneCount}/{steps.length}</span>
        </h2>
        <button type="button" onClick={dismiss} title="Ausblenden"
          className="w-7 h-7 rounded-lg text-slate-300 hover:text-slate-500 flex items-center justify-center transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1.5">
        {steps.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5 py-1">
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                s.done ? "border-transparent text-white" : "border-slate-300 text-transparent"
              }`}
              style={s.done ? { background: ACCENT } : undefined}
            >
              <CheckCircle2 size={12} strokeWidth={2.5} />
            </span>
            {s.done ? (
              <span className="text-[12.5px] text-slate-400 line-through decoration-slate-300">{s.label}</span>
            ) : (
              <Link href={stepLink[s.key] || "/agent"} className="text-[12.5px] font-medium text-slate-700 hover:text-slate-900 transition-colors">
                {s.label}
              </Link>
            )}
            {s.key === "skripte" && !s.done && (
              <button type="button" onClick={markScripts}
                className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-slate-600 shrink-0 transition-colors">
                Erledigt
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
