import { useState, useEffect, useMemo } from "react";
import { PageIntro } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/audit — durchsuchbare Ansicht des Mitarbeiter-Audit-Logs
// (bestehender Endpoint /admin/agent-log, read-only).
// ═══════════════════════════════════════════════════════════════════

interface LogRow {
  id: number;
  agent_name: string | null;
  type: string;
  outcome: string | null;
  ref: string | null;
  note: string | null;
  created_at: string;
}

const TYPE_LABEL: Record<string, string> = {
  notiz: "Notiz",
  ergebnis: "Kontakt-Ergebnis",
  email: "Zahlungserinnerung",
  claim: "Kunde übernommen",
  termin_erledigt: "Termin erledigt",
  termin_verschoben: "Termin verschoben",
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/fiaon/admin/agent-log", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setRows(j.data); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.agent_name, r.type, r.outcome, r.ref, r.note]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <PageIntro
        id="audit"
        title="Audit-Log"
        subtitle="Hier kannst du jede Aktion im System nachvollziehen — wer hat wann was an welchem Kunden gemacht."
        steps={[
          "Suche nach Kunde, Referenz, Agent oder Stichwort — die Liste zeigt alle protokollierten Aktionen mit Zeitstempel.",
          "Auch System-Aktionen stehen hier (z. B. „Per Kontoabgleich verbucht“, „Attribution folgt der Betreuung“) — nichts passiert unsichtbar.",
          "Einträge werden nie gelöscht; Korrekturen erscheinen als eigener Eintrag (durchgestrichen bleibt sichtbar).",
        ]}
      />

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter: Mitarbeiter, Aktion, Referenz oder Notiz …"
        className="w-full sm:max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[14px] mb-4"
      />

      <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-50 overflow-hidden">
        {loading && <p className="px-4 py-10 text-center text-[13px] text-slate-400">Lädt …</p>}
        {!loading && filtered.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-slate-400">
            {q ? "Keine Treffer." : "Noch keine Aktionen protokolliert."}
          </p>
        )}
        {filtered.map((l) => (
          <div key={l.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-800">
                <span style={{ color: "#2563eb" }}>{l.agent_name || "System"}</span>
                <span className="text-slate-400 font-normal"> · </span>
                {TYPE_LABEL[l.type] || l.type}
                {l.outcome && <span className="text-slate-500 font-normal">: {l.outcome}</span>}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {l.ref && <span className="font-mono">{l.ref}</span>}
                {l.ref && l.note && " · "}
                {l.note}
              </p>
            </div>
            <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap shrink-0">
              {new Date(l.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">Zeigt die letzten Einträge; Konto-Ereignisse je Mitarbeiter (Bankdaten, Logins) findest du im Detail-Drawer der Team-Übersicht.</p>
    </div>
  );
}
