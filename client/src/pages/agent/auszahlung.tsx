import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { AgentShell, Card, KpiCard, Badge, FlashMessage, api, fmtCents, fmtDT, btnPrimary } from "./shared";

// ============================================================================
// /agent/auszahlung (H1)
// Button erzeugt NUR eine Anforderung — löst NIEMALS eine Überweisung aus.
// Aktiv nur wenn: Bankdaten hinterlegt UND Guthaben ≥ Mindestbetrag.
// Es wird IMMER das volle verfügbare Guthaben beantragt (keine Teilbeträge).
// ============================================================================

interface PayoutRow {
  id: number;
  amount_cents: number;
  status: string;
  iban_masked: string | null;
  reject_reason: string | null;
  requested_at: string;
  processed_at: string | null;
}

export default function AgentAuszahlungPage() {
  return (
    <AgentShell>
      <AuszahlungContent />
    </AgentShell>
  );
}

function AuszahlungContent() {
  const [data, setData] = useState<{ balanceCents: number; minCents: number; hasBank: boolean; ibanMasked: string | null; history: PayoutRow[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4500); };

  const load = useCallback(() => {
    api("/agent/payouts").then((r) => { if (r.ok) setData(r.json); });
  }, []);
  useEffect(load, [load]);

  if (!data) return <p className="py-14 text-center text-[13px] text-slate-400">Lädt …</p>;

  const hasOpen = data.history.some((h) => h.status === "angefordert");
  const canRequest = data.hasBank && data.balanceCents >= data.minCents && !hasOpen;

  const request = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Auszahlung über ${fmtCents(data.balanceCents)} beantragen?\n\nEs wird immer das volle verfügbare Guthaben angefordert. Die Überweisung erfolgt nach Prüfung manuell.`)) return;
    setBusy(true);
    const r = await api("/agent/payouts/request", { method: "POST" });
    setBusy(false);
    if (r.ok) { flash("Auszahlung beantragt — sie wird nach Prüfung manuell überwiesen."); load(); }
    else flash(r.json?.error || "Fehler");
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-lg font-bold tracking-tight mb-1">Auszahlung</h1>
      <p className="text-[12px] text-slate-400 mb-5">Dein bestätigtes Provisions-Guthaben.</p>
      <FlashMessage message={message} />

      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <KpiCard label="Verfügbares Guthaben" value={fmtCents(data.balanceCents)} sub="Summe bestätigter Provisionen" />
        <KpiCard label="Mindestbetrag" value={fmtCents(data.minCents)} sub="für eine Auszahlung" />
      </div>

      <Card className="p-5 mb-6">
        <button
          type="button"
          onClick={request}
          disabled={!canRequest || busy}
          className={`${btnPrimary} w-full py-3.5`}
          style={{ minHeight: 50 }}
        >
          {busy ? "Beantrage …" : `Auszahlung beantragen (${fmtCents(data.balanceCents)})`}
        </button>
        <div className="mt-3 space-y-1">
          {!data.hasBank && (
            <p className="text-[12px] font-medium text-slate-600">
              Bitte zuerst <Link href="/agent/profil" className="underline hover:text-slate-900">Auszahlungsdaten im Profil</Link> hinterlegen.
            </p>
          )}
          {data.hasBank && data.balanceCents < data.minCents && (
            <p className="text-[12px] text-slate-500">Guthaben liegt unter dem Mindestbetrag von {fmtCents(data.minCents)}.</p>
          )}
          {hasOpen && <p className="text-[12px] text-slate-500">Eine Anforderung läuft bereits und wird gerade geprüft.</p>}
          {data.ibanMasked && <p className="text-[12px] text-slate-400">Auszahlung auf <span className="font-mono">{data.ibanMasked}</span></p>}
          <p className="text-[11px] text-slate-400 pt-1">
            Auszahlungen werden nach Prüfung manuell überwiesen, in der Regel innerhalb von 5 Werktagen.
          </p>
        </div>
      </Card>

      <h2 className="text-[13px] font-semibold text-slate-900 mb-2">Historie</h2>
      <Card className="divide-y divide-slate-50">
        {data.history.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-slate-400">Noch keine Auszahlungen.</p>}
        {data.history.map((h) => (
          <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 tabular-nums">{fmtCents(h.amount_cents)}</p>
              <p className="text-[11px] text-slate-400">
                Beantragt {fmtDT(h.requested_at)}
                {h.processed_at ? ` · Verarbeitet ${fmtDT(h.processed_at)}` : ""}
                {h.iban_masked ? ` · ${h.iban_masked}` : ""}
              </p>
              {h.reject_reason && <p className="text-[11px] text-slate-500 mt-0.5">Grund: {h.reject_reason}</p>}
            </div>
            <Badge status={h.status} />
          </div>
        ))}
      </Card>
    </div>
  );
}
