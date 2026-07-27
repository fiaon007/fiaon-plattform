import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Users, Save, Undo2, Info, Layers, UserMinus } from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// /admin/kartei — Gegenseite zur offenen Kunden-Kartei (P1-H).
//
// Zeigt: Akten frei / vergeben / je Agent, Rückläufer und wer wie viel
// übernimmt und abarbeitet. Einstellbar: Gewichtungen, Fairness-Anteil,
// Auto-Release-Minuten, Hortungs-Frist. Notausgang: jede Akte freigeben
// oder gezielt zuweisen (Ausnahme, protokolliert).
//
// BEWUSST OHNE Zeit-/Anwesenheitsüberwachung — nur Ergebnisse
// (Scheinselbstständigkeit/DSGVO, wie in Phase 4 festgelegt).
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

interface Overview {
  gesamt: { frei: number; vergeben: number; in_bearbeitung: number; gesamt: number };
  jeAgent: { id: number; name: string; active: boolean; karten: number; betreut: number; unbearbeitet: number }[];
  aktivitaet: { agent_id: number; name: string | null; uebernahmen: number; ruecklaeufer: number; rueckgaben: number }[];
  letzteRuecklaeufer: { card_id: string; kind: string; event: string; reason: string | null; created_at: string; agent_name: string | null }[];
  einstellungen: Record<string, number>;
}

const SETTING_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: "queue_w_value", label: "Umsatzpotenzial", hint: "Teure Pakete und hohe offene Beträge steigen." },
  { key: "queue_w_react", label: "Reaktionssignal", hint: "Fälliger Rückruf, „Zahlung angekündigt“, korrigierte Nummer." },
  { key: "queue_w_fresh", label: "Frische", hint: "Neue Einträge stehen weiter oben." },
  { key: "queue_w_contact", label: "Kontakthistorie", hint: "Nie kontaktiert zählt am höchsten." },
  { key: "queue_fairness_nth", label: "Wartezeit-Ausgleich", hint: "Jeder N-te Platz kommt aus dem ältesten Bestand (2–10)." },
  { key: "akte_auto_release_min", label: "Auto-Release (Minuten)", hint: "Aktive Akte ohne Ergebnis wird freigegeben. 0 = nie." },
  { key: "kartei_hoarding_days", label: "Hortungs-Frist (Tage)", hint: "Nie bearbeitete Akte geht zurück in die Kartei. 0 = nie." },
  { key: "kartei_hoarding_warn_days", label: "Vorwarnung (Tage)", hint: "So viele Tage vorher wird der Agent gewarnt." },
];

const EVENT_LABEL: Record<string, string> = {
  release_hoarding: "Hortungs-Schutz",
  release_admin: "Admin-Freigabe",
  release_manual: "Rückgabe durch Agent",
};

export default function AdminKarteiPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 5000); };

  const load = useCallback(async () => {
    const r = await apiF("/admin/kartei");
    if (r.ok) {
      setData(r.json);
      const f: Record<string, string> = {};
      for (const s of SETTING_FIELDS) f[s.key] = String(r.json.einstellungen[s.key] ?? "");
      setForm(f);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true);
    const r = await apiF("/admin/kartei/settings", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { say("Einstellungen gespeichert — sie gelten ab dem nächsten Kartei-Abruf."); load(); }
    else say(r.json?.error || "Speichern fehlgeschlagen.");
  };

  if (!data) return <p className="text-[13px] text-slate-400 py-10 text-center">Lädt …</p>;

  const g = data.gesamt;

  return (
    <div className="space-y-5">
      {msg && (
        <div className="px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{msg}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[19px] font-bold tracking-tight text-slate-900">Offene Kartei</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Ein gemeinsamer Bestand für alle Agenten. Zuweisung entsteht nur durch bewusste Übernahme.
          </p>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); load(); }}
          className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-300 inline-flex items-center gap-1.5"
        >
          <RefreshCw size={14} /> Aktualisieren
        </button>
      </div>

      {/* Übersicht */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Frei" value={g.frei} accent />
        <Kpi label="Vergeben" value={g.vergeben} />
        <Kpi label="Aktiv in Bearbeitung" value={g.in_bearbeitung} />
        <Kpi label="Karten gesamt" value={g.gesamt} />
      </div>

      {/* Je Agent */}
      <Panel title="Je Agent" icon={Users}>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="text-left font-semibold px-3 py-2">Agent</th>
                <th className="text-right font-semibold px-3 py-2">Karten</th>
                <th className="text-right font-semibold px-3 py-2">betreut</th>
                <th className="text-right font-semibold px-3 py-2">unbearbeitet</th>
                <th className="text-right font-semibold px-3 py-2">Übernahmen 30 T.</th>
                <th className="text-right font-semibold px-3 py-2">Rückläufer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.jeAgent.map((a) => {
                const act = data.aktivitaet.find((x) => x.agent_id === a.id);
                return (
                  <tr key={a.id} className={a.active ? "" : "opacity-50"}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {a.name}{a.active ? "" : " (inaktiv)"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.karten}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: ACCENT }}>{a.betreut}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{a.unbearbeitet}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{act?.uebernahmen ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{act?.ruecklaeufer ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[11.5px] text-slate-400 mt-2 leading-relaxed">
          „betreut" = mindestens ein dokumentierter Kontakt. Nur diese Akten bleiben dauerhaft beim Agenten;
          „unbearbeitet" läuft nach der Hortungs-Frist zurück in die Kartei.
        </p>
      </Panel>

      {/* Einstellungen */}
      <Panel title="Rangfolge und Fristen" icon={Layers}>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SETTING_FIELDS.map((s) => (
            <div key={s.key}>
              <label className="block text-[12px] font-semibold text-slate-600 mb-1">{s.label}</label>
              <input
                type="number"
                min={0}
                value={form[s.key] ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, [s.key]: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] tabular-nums focus:border-[#2563eb] outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{s.hint}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={(e) => { e.stopPropagation(); save(); }}
            className="px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold bg-[#2563eb] hover:bg-[#1d4fd7] disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            <Save size={14} /> {busy ? "Speichert …" : "Speichern"}
          </button>
          <p className="text-[11.5px] text-slate-400 inline-flex items-center gap-1.5">
            <Info size={12} /> Der Score selbst wird den Agenten nie angezeigt.
          </p>
        </div>
      </Panel>

      {/* Notausgang */}
      <Panel title="Notausgang" icon={UserMinus}>
        <ManualAction onDone={(m) => { say(m); load(); }} agents={data.jeAgent.filter((a) => a.active)} />
      </Panel>

      {/* Rückläufer */}
      <Panel title="Letzte Rückgaben und Rückläufer" icon={Undo2}>
        {data.letzteRuecklaeufer.length === 0 ? (
          <p className="text-[12.5px] text-slate-400">Noch keine Rückgaben protokolliert.</p>
        ) : (
          <div className="space-y-2">
            {data.letzteRuecklaeufer.map((r, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-lg border border-slate-200 bg-white">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 shrink-0">
                  {EVENT_LABEL[r.event] || r.event}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-slate-800 truncate">
                    {r.card_id}{r.agent_name ? ` · ${r.agent_name}` : ""}
                  </p>
                  {r.reason && <p className="text-[11.5px] text-slate-400 truncate">{r.reason}</p>}
                </div>
                <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                  {new Date(r.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ManualAction({ agents, onDone }: {
  agents: { id: number; name: string }[];
  onDone: (msg: string) => void;
}) {
  const [cardId, setCardId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (mode: "release" | "assign") => {
    if (!cardId.trim()) return onDone("Bitte eine Karten-Nummer angeben (Antrags-Referenz oder lead-<Nummer>).");
    if (mode === "assign" && !agentId) return onDone("Bitte einen Agenten auswählen.");
    setBusy(true);
    const r = await apiF(`/admin/kartei/${encodeURIComponent(cardId.trim())}/${mode}`, {
      method: "POST",
      body: JSON.stringify({ reason, agentId: agentId ? Number(agentId) : undefined }),
    });
    setBusy(false);
    if (r.ok) {
      onDone(mode === "release"
        ? `Akte ${cardId} ist zurück in der offenen Kartei (protokolliert).`
        : `Akte ${cardId} wurde ${r.json.agentName} zugewiesen (Ausnahme, protokolliert).`);
      setCardId(""); setReason("");
    } else onDone(r.json?.error || "Aktion fehlgeschlagen.");
  };

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Karten-Nummer</label>
          <input
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            placeholder="FIAON-… oder lead-1234"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
          />
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Agent (nur für Zuweisung)</label>
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] bg-white focus:border-[#2563eb] outline-none"
          >
            <option value="">— bitte wählen —</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[12px] font-semibold text-slate-600 mb-1">Grund</label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. Urlaub, Kundenwunsch"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button" disabled={busy}
          onClick={(e) => { e.stopPropagation(); run("release"); }}
          className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-40"
        >
          In die Kartei freigeben
        </button>
        <button
          type="button" disabled={busy}
          onClick={(e) => { e.stopPropagation(); run("assign"); }}
          className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-40"
        >
          Gezielt zuweisen
        </button>
      </div>
      <p className="text-[11.5px] text-slate-400 leading-relaxed">
        Beide Aktionen sind Ausnahmen und werden mit Grund, Zeit und vorherigem Bearbeiter protokolliert.
        Es wird nichts gelöscht und keine E-Mail ausgelöst.
      </p>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-[22px] font-bold tabular-nums mt-0.5" style={accent ? { color: ACCENT } : undefined}>
        {value.toLocaleString("de-DE")}
      </p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: {
  title: string; icon: typeof Users; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-[14px] font-bold text-slate-900 mb-3 inline-flex items-center gap-2">
        <Icon size={15} strokeWidth={1.9} className="text-slate-400" /> {title}
      </h2>
      {children}
    </div>
  );
}
