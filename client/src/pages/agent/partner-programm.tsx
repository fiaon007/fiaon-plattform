import { useState, useEffect, useCallback } from "react";
import { Award, Users, TrendingUp, Send, CheckCircle2 } from "lucide-react";
import { AgentShell, Card, FlashMessage, api, fmtCents, inputCls, btnPrimary, btnGhost, ACCENT } from "./shared";
import { Reveal, CountUp } from "./motion";

// ============================================================================
// /agent/partner-programm (Paket AE3/AE4)
// FIAON Partner-Programm: Partnerstatus aus kumuliertem bestätigtem EIGENumsatz,
// Meilensteine (KEINE „Level"/„Punkte"/„Stufen"), Team-Umsatzbeteiligung
// (Override, exakt EINE Ebene) und „Partner vorschlagen"-Flow.
// Design: bestehende monochrome CRM-Linie — ruhig, edel, keine Gamification.
// ============================================================================

interface PartnerData {
  status: { key: string; label: string; bonusBp: number };
  revenueCents: number;
  next: { key: string; label: string; minCents: number; bonusBp: number; remainingCents: number } | null;
  thresholds: { key: string; label: string; minCents: number; bonusBp: number; prize: { title: string; description?: string } | null }[];
  milestones: { milestone_key: string; achieved_at: string; prize_status: string }[];
  team: { members: number; deals: number; revenueCents: number; overrideCents: number };
  suggestions: { id: number; first_name: string; last_name: string; status: string; created_at: string }[];
}

export default function AgentPartnerProgrammPage() {
  return (
    <AgentShell>
      <PartnerContent />
    </AgentShell>
  );
}

function PartnerContent() {
  const [data, setData] = useState<PartnerData | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4500); };

  const load = useCallback(() => {
    api("/agent/partner-program").then((r) => { if (r.ok) setData(r.json); });
  }, []);
  useEffect(load, [load]);

  if (!data) {
    return <div className="py-16 text-center text-[13px] text-slate-400">Lädt …</div>;
  }

  const { status, revenueCents, next, thresholds, milestones, team } = data;
  // Fortschritt zum nächsten Meilenstein (ruhige Leiste, kein Konfetti)
  const prevMin = (() => {
    let p = 0;
    for (const t of thresholds) if (revenueCents >= t.minCents) p = t.minCents;
    return p;
  })();
  const pct = next ? Math.max(0, Math.min(100, ((revenueCents - prevMin) / (next.minCents - prevMin)) * 100)) : 100;
  const achievedKeys = new Set(milestones.map((m) => m.milestone_key));

  return (
    <div className="pb-24 md:pb-8">
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Partner-Programm</h1>
        <p className="text-[12px] text-slate-400 mb-5">Dein Partnerstatus wächst ausschließlich mit deinem eigenen bestätigten Umsatz.</p>
      </Reveal>
      <FlashMessage message={message} />

      {/* Status + Fortschritt */}
      <Reveal index={1}>
        <Card className="p-5 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Aktueller Partnerstatus</p>
              <p className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Award size={20} strokeWidth={1.8} className="text-slate-400" /> {status.label}
              </p>
              {status.bonusBp > 0 && (
                <p className="text-[12px] text-slate-500 mt-1">+{(status.bonusBp / 100).toLocaleString("de-DE")} Prozentpunkte auf neue Abschlüsse</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Bestätigter Eigenumsatz</p>
              <p className="text-2xl font-bold tracking-tight tabular-nums text-slate-900"><CountUp value={revenueCents} format={(v) => fmtCents(v)} /></p>
            </div>
          </div>
          {next ? (
            <div>
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="font-medium text-slate-600">Nächster Meilenstein: {next.label}</span>
                <span className="text-slate-400 tabular-nums">Noch {fmtCents(next.remainingCents)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: ACCENT }} />
              </div>
            </div>
          ) : (
            <p className="text-[12px] font-medium text-slate-500">Höchster Meilenstein erreicht.</p>
          )}
        </Card>
      </Reveal>

      {/* Meilenstein-Übersicht */}
      <Reveal index={2}>
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Meilensteine & Vorteile</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MilestoneCard label="Partner" minText="Start" bonusText="Basis-Provisionssatz laut Vertrag" prize={null} achieved active={status.key === "partner"} />
          {thresholds.map((t) => (
            <MilestoneCard
              key={t.key}
              label={t.label}
              minText={`ab ${fmtCents(t.minCents)}`}
              bonusText={`+${(t.bonusBp / 100).toLocaleString("de-DE")} Prozentpunkte auf künftige Abschlüsse`}
              prize={t.prize}
              achieved={revenueCents >= t.minCents || achievedKeys.has(t.key)}
              active={status.key === t.key}
            />
          ))}
        </div>
      </Reveal>

      {/* Mein Team (nur wenn geworbene Partner existieren) */}
      {team.members > 0 && (
        <Reveal index={3}>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Mein Team</h2>
          <div className="grid sm:grid-cols-3 gap-3 mb-6">
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5"><Users size={12} /> Geworbene Partner</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{team.members}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{team.deals} bestätigte Abschlüsse</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1.5"><TrendingUp size={12} /> Team-Umsatz</p>
              <p className="text-xl font-bold tabular-nums text-slate-900">{fmtCents(team.revenueCents)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">anonym aggregiert</p>
            </Card>
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Deine Team-Umsatzbeteiligung</p>
              <p className="text-xl font-bold tabular-nums" style={{ color: ACCENT }}>{fmtCents(team.overrideCents)}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">fließt in dein normales Guthaben</p>
            </Card>
          </div>
        </Reveal>
      )}

      {/* Partner vorschlagen */}
      <Reveal index={4}>
        <SuggestPartner suggestions={data.suggestions} onSubmitted={() => { load(); flash("Vorschlag eingereicht — das Admin-Team prüft die Anfrage"); }} onError={flash} />
      </Reveal>
    </div>
  );
}

function MilestoneCard({ label, minText, bonusText, prize, achieved, active }: {
  label: string; minText: string; bonusText: string;
  prize: { title: string; description?: string } | null;
  achieved: boolean; active: boolean;
}) {
  return (
    <Card className={`p-4 ${active ? "border-slate-400" : ""} ${achieved ? "" : "opacity-80"}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[13px] font-bold text-slate-900">{label}</p>
        {achieved && <CheckCircle2 size={14} className="shrink-0" style={{ color: ACCENT }} />}
      </div>
      <p className="text-[11px] font-semibold text-slate-400 mb-2">{minText}</p>
      <p className="text-[12px] text-slate-600 leading-relaxed">{bonusText}</p>
      {prize && (
        <p className="text-[12px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
          <span className="font-semibold text-slate-700">Meilenstein-Prämie:</span> {prize.title}
        </p>
      )}
    </Card>
  );
}

// Paket AE4: Formular „Partner vorschlagen" — erzeugt eine Admin-Anfrage,
// KEIN automatisches Anlegen, KEINE Prämie für den Vorschlag selbst.
function SuggestPartner({ suggestions, onSubmitted, onError }: {
  suggestions: PartnerData["suggestions"];
  onSubmitted: () => void;
  onError: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", reason: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) { onError("Vorname, Nachname und E-Mail erforderlich"); return; }
    setBusy(true);
    const r = await api("/agent/partner-suggestions", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      setForm({ firstName: "", lastName: "", email: "", phone: "", reason: "" });
      setOpen(false);
      onSubmitted();
    } else onError(r.json?.error || "Fehler");
  };

  const STATUS_LABEL: Record<string, string> = { offen: "In Prüfung", angenommen: "Angenommen", abgelehnt: "Abgelehnt" };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div>
          <h2 className="text-[14px] font-bold text-slate-900">Partner vorschlagen</h2>
          <p className="text-[12px] text-slate-400 mt-0.5 max-w-lg">
            Du kennst jemanden, der zu FIAON passt? Das Admin-Team prüft jeden Vorschlag.
            Wird die Person Partner, erhältst du eine Umsatzbeteiligung an ihren Abschlüssen.
          </p>
        </div>
        {!open && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(true); }} className={btnPrimary} style={{ minHeight: 42 }}>
            <span className="inline-flex items-center gap-1.5"><Send size={13} /> Vorschlagen</span>
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-3" onClick={(e) => e.stopPropagation()}>
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="text" placeholder="Vorname *" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
            <input type="text" placeholder="Nachname *" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <input type="email" placeholder="E-Mail *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
            <input type="tel" placeholder="Telefon (+49 …)" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
          </div>
          <textarea
            placeholder="Warum passt die Person zu FIAON?"
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            rows={3}
            className={`${inputCls} resize-none`}
          />
          <div className="flex gap-2">
            <button type="button" onClick={submit} disabled={busy} className={`${btnPrimary} disabled:opacity-50`} style={{ minHeight: 42 }}>
              {busy ? "Sendet …" : "Vorschlag einreichen"}
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); }} className={btnGhost} style={{ minHeight: 42 }}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Deine Vorschläge</p>
          <div className="space-y-1.5">
            {suggestions.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-slate-700">{s.first_name} {s.last_name}</span>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                  s.status === "angenommen" ? "border-slate-400 text-slate-800"
                  : s.status === "abgelehnt" ? "border-slate-200 text-slate-400"
                  : "border-slate-300 text-slate-600"
                }`}>{STATUS_LABEL[s.status] || s.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
