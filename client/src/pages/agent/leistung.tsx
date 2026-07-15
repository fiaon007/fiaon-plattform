import { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart3, ShieldCheck } from "lucide-react";
import { AgentShell, api, Card, fmtD } from "./shared";

// ═══════════════════════════════════════════════════════════════════
// /agent/leistung — SPIEGELANSICHT (Phase 4, P4-C).
// Jeder Agent sieht exakt die Zahlen, die auch der Admin über ihn sieht —
// Transparenz statt Geheim-Logs. Ausgewertet werden nur Arbeitsergebnisse
// (selbst dokumentierte Kontakte, Akten, Abschlüsse). KEINE Arbeitszeit-,
// Pausen- oder Anwesenheits-Erfassung.
// ═══════════════════════════════════════════════════════════════════

const OUTCOME_LABEL: Record<string, string> = {
  erreicht_interesse: "Erreicht – Interesse",
  erreicht_kein_interesse: "Erreicht – kein Interesse",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox",
  rueckruf_termin: "Rückruf-Termin",
  nummer_falsch: "Nummer falsch",
};

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

type RangeKey = "heute" | "7t" | "30t";

export default function AgentLeistungPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30t");
  const range = useMemo(() => {
    const now = new Date();
    const days = rangeKey === "heute" ? 1 : rangeKey === "7t" ? 7 : 30;
    const from = new Date(now.getTime() - days * 864e5);
    if (rangeKey === "heute") from.setHours(0, 0, 0, 0);
    return { from: from.toISOString(), to: now.toISOString() };
  }, [rangeKey]);

  const [me, setMe] = useState<any>(null);
  const [teamAvg, setTeamAvg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api(`/agent/leistung?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`)
      .then((r) => { if (r.ok) { setMe(r.json.me); setTeamAvg(r.json.teamAvg); } })
      .finally(() => setLoading(false));
  }, [range]);
  useEffect(load, [load]);

  return (
    <AgentShell onRefresh={load}>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Meine Leistung</h1>
        <p className="text-[13px] text-slate-500">Deine Arbeitsergebnisse — exakt die Zahlen, die auch die Verwaltung sieht.</p>
      </div>

      <div className="mb-4 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[12.5px] text-slate-600 flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-[#2563eb] shrink-0 mt-0.5" />
        <span>
          <b className="text-slate-800">Volle Transparenz:</b> Hier stehen ausschließlich Ergebnisse, die du selbst dokumentierst
          (Akten, Kontakt-Ergebnisse, Links, Abschlüsse). Es gibt keine Arbeitszeit-, Pausen- oder Anwesenheits-Erfassung — und keine Geheim-Logs.
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        {([["heute", "Heute"], ["7t", "7 Tage"], ["30t", "30 Tage"]] as [RangeKey, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setRangeKey(k)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${rangeKey === k ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500"}`}>{l}</button>
        ))}
      </div>

      {loading ? <p className="text-[13px] text-slate-400">Lädt…</p> : !me ? (
        <Card className="p-8 text-center text-[13px] text-slate-400">
          Noch keine dokumentierte Aktivität im Zeitraum — sobald du Akten übernimmst und Ergebnisse dokumentierst, erscheinen hier deine Zahlen.
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {([
              ["Übernommene Akten", me.akten],
              ["Dokumentierte Kontakte", me.kontakte],
              ["Antragslinks gesendet", me.links],
              ["Konversionen", me.konversionen],
              ["Abschlüsse", me.abschluesse],
              ["Umsatz", eur(me.umsatzCents)],
            ] as [string, any][]).map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Reaktionszeit</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{me.reaktionStunden != null ? `${me.reaktionStunden} h` : "—"}</p>
              <p className="text-[11px] text-slate-400">Ø Lead-Eingang → dein erster Kontakt</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Rückgabequote</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{me.rueckgabeQuote != null ? `${me.rueckgabeQuote} %` : "—"}</p>
              <p className="text-[11px] text-slate-400">Akten ohne Ergebnis geschlossen</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Provision</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">{eur(me.provisionCents)}</p>
              <p className="text-[11px] text-slate-400">im Zeitraum gebucht</p>
            </Card>
          </div>

          {Object.keys(me.outcomes || {}).length > 0 && (
            <Card className="p-4 mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 flex items-center gap-1.5"><BarChart3 size={13} /> Deine Kontakt-Ergebnisse nach Typ</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(me.outcomes).map(([k, v]) => (
                  <span key={k} className="px-2.5 py-1 rounded-lg border border-slate-200 text-[12px] text-slate-600">
                    {OUTCOME_LABEL[k] || k}: <b className="tabular-nums">{v as number}</b>
                  </span>
                ))}
              </div>
            </Card>
          )}

          {teamAvg && (
            <Card className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Zur Einordnung: Team-Durchschnitt (ohne Namen)</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><p className="text-[15px] font-bold text-slate-900 tabular-nums">{teamAvg.kontakte}</p><p className="text-[11px] text-slate-400">Kontakte</p></div>
                <div><p className="text-[15px] font-bold text-slate-900 tabular-nums">{teamAvg.abschluesse}</p><p className="text-[11px] text-slate-400">Abschlüsse</p></div>
                <div><p className="text-[15px] font-bold text-slate-900 tabular-nums">{eur(teamAvg.umsatzCents)}</p><p className="text-[11px] text-slate-400">Umsatz</p></div>
              </div>
            </Card>
          )}

          <p className="text-[11px] text-slate-400 mt-4">Zeitraum: {fmtD(range.from)} – {fmtD(range.to)}</p>
        </>
      )}
    </AgentShell>
  );
}
