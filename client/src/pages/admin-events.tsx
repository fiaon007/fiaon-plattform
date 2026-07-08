import { useState, useEffect, useCallback } from "react";
import { Send, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, User, FlaskConical } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/events — Event-Test-Konsole (Paket T)
// Alle Make-Event-Typen aus der Code-Registry (server/make-events-registry.ts):
// Test-Versand mit editierbarem Payload (test: true, email ersetzt),
// „Für echten Kunden senden" (mit Vorschau + Bestätigung), Diagnose-Tabelle
// (letzter Versand je Event) und Verlauf der letzten 20 Test-/Real-Sends.
// ═══════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";
const LS_KEY = "fiaon_admin_test_email";

interface EventDef {
  type: string;
  label: string;
  description: string;
  customerBound: boolean;
  deprecated?: boolean;
  example: Record<string, unknown>;
}

interface RegistryResponse {
  ok: boolean;
  events: EventDef[];
  makeWebhookConfigured: boolean;
  lastEvents: Record<string, string>;
  history: { event: string; email: string; ok: boolean; mode: "test" | "real"; at: string }[];
}

interface RealPreview {
  eventType: string;
  customer: string;
  email: string;
  status: string;
  payload: Record<string, unknown>;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminEventsPage() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState(() => localStorage.getItem(LS_KEY) || "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [refInputs, setRefInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [preview, setPreview] = useState<RealPreview | null>(null);

  const load = useCallback(() => {
    fetch("/api/fiaon/admin/events/registry", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setData(j);
          setPayloads((prev) => {
            const next = { ...prev };
            for (const e of j.events as EventDef[]) {
              if (!next[e.type]) next[e.type] = JSON.stringify(e.example, null, 2);
            }
            return next;
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { localStorage.setItem(LS_KEY, testEmail); }, [testEmail]);

  const setResult = (type: string, ok: boolean, text: string) => setResults((m) => ({ ...m, [type]: { ok, text } }));

  const sendTest = async (ev: EventDef) => {
    let payload: Record<string, unknown> | undefined;
    try {
      payload = JSON.parse(payloads[ev.type] || "{}");
    } catch {
      setResult(ev.type, false, "Payload ist kein gültiges JSON");
      return;
    }
    setBusy(`test:${ev.type}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: ev.type, email: testEmail.trim(), payload }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setResult(ev.type, j.sent, j.sent ? `Test gesendet an ${testEmail.trim()} — ${fmtTime(j.at)}` : "Make hat den Webhook nicht angenommen (Log prüfen)");
        load();
      } else {
        setResult(ev.type, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(ev.type, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
    }
  };

  const checkReal = async (ev: EventDef) => {
    const ref = (refInputs[ev.type] || "").trim();
    if (!ref) { setResult(ev.type, false, "Bitte Referenz eingeben"); return; }
    setBusy(`real:${ev.type}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/send-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: ev.type, paymentRef: ref, dryRun: true }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setPreview({ eventType: ev.type, customer: j.customer, email: j.email, status: j.status, payload: j.payload });
      } else {
        setResult(ev.type, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(ev.type, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
    }
  };

  const confirmReal = async () => {
    if (!preview) return;
    const ref = (refInputs[preview.eventType] || "").trim();
    setBusy(`confirm:${preview.eventType}`);
    try {
      const res = await fetch("/api/fiaon/admin/events/send-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ eventType: preview.eventType, paymentRef: ref }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok && j?.ok) {
        setResult(preview.eventType, j.sent, j.sent ? `An echten Kunden gesendet: ${j.customer} (${j.email}) — ${fmtTime(j.at)}` : "Make hat den Webhook nicht angenommen");
        load();
      } else {
        setResult(preview.eventType, false, j?.error || `HTTP ${res.status}`);
      }
    } catch {
      setResult(preview.eventType, false, "Netzwerkfehler");
    } finally {
      setBusy(null);
      setPreview(null);
    }
  };

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim());

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <p className="text-[11px] font-bold uppercase tracking-[.2em] mb-1" style={{ color: ACCENT }}>System</p>
      <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">E-Mail-Events (Make)</h1>
      <p className="text-[13px] text-slate-500 mb-5 max-w-2xl">
        Alle Event-Typen aus der Code-Registry. Ein Test-Versand lässt Make die Payload-Struktur eines Events lernen,
        ohne den echten Workflow auszulösen — Pflicht vor dem Anlegen neuer Router-Zweige/Brevo-Templates.
      </p>

      {data && !data.makeWebhookConfigured && (
        <div className="mb-5 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-[13px] text-amber-800 flex items-center gap-2">
          <AlertTriangle size={15} className="shrink-0" />
          <span><b>MAKE_WEBHOOK_URL ist nicht gesetzt</b> — Versand ist deaktiviert, bis die Umgebungsvariable im Deployment hinterlegt ist.</span>
        </div>
      )}

      {/* Test-Adresse */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 flex flex-wrap items-center gap-3">
        <FlaskConical size={16} className="text-slate-400 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-700">Test-E-Mail-Adresse</p>
          <p className="text-[11px] text-slate-400">Ersetzt bei jedem Test-Versand das Feld <code className="font-mono">email</code>; zusätzlich wird <code className="font-mono">test: true</code> mitgesendet.</p>
        </div>
        <input
          type="email"
          value={testEmail}
          onChange={(e) => setTestEmail(e.target.value)}
          placeholder="deine-admin@adresse.de"
          className="ml-auto w-full sm:w-72 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[13px]"
        />
      </div>

      {/* T3: Diagnose */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Webhook-Diagnose — letzter erfolgreicher Versand je Event</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Event", "Beschreibung", "Letzter Versand", ""].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-slate-400">Lädt …</td></tr>}
                {data?.events.map((ev) => {
                  const last = data.lastEvents[ev.type];
                  return (
                    <tr key={ev.type} className="border-b border-slate-50">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="text-[12px] font-mono font-semibold text-slate-800">{ev.type}</span>
                        {ev.deprecated && <span className="ml-2 px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-bold text-slate-500 uppercase">veraltet</span>}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500 max-w-[340px]">{ev.label}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {last ? (
                          <span className="text-[12px] text-slate-700 tabular-nums">{fmtTime(last)}</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-[11px] font-semibold text-amber-700">noch nie gesendet</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setExpanded(expanded === ev.type ? null : ev.type); }}
                          className="text-[12px] font-semibold hover:underline"
                          style={{ color: ACCENT }}
                        >
                          {expanded === ev.type ? "Schließen" : "Testen"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* T1/T2: Event-Karten */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Event-Katalog — Payload prüfen und senden</h2>
        <div className="space-y-2.5">
          {data?.events.map((ev) => {
            const open = expanded === ev.type;
            const result = results[ev.type];
            return (
              <div key={ev.type} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpanded(open ? null : ev.type); }}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-slate-50/60 transition-colors"
                >
                  {open ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-bold text-slate-900">{ev.label}</span>
                      <span className="text-[11px] font-mono text-slate-400">{ev.type}</span>
                      {ev.deprecated && <span className="px-1.5 py-0.5 rounded border border-slate-300 text-[10px] font-bold text-slate-500 uppercase">veraltet</span>}
                      {ev.customerBound && !ev.deprecated && (
                        <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[10px] font-bold uppercase" style={{ color: ACCENT }}>kundengebunden</span>
                      )}
                    </span>
                    <span className="block text-[12px] text-slate-400 mt-0.5">{ev.description}</span>
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5 mt-3">Payload (editierbar — Beispielwerte vorausgefüllt)</p>
                    <textarea
                      value={payloads[ev.type] || ""}
                      onChange={(e) => setPayloads((m) => ({ ...m, [ev.type]: e.target.value }))}
                      rows={Math.min(12, (payloads[ev.type] || "").split("\n").length + 1)}
                      spellCheck={false}
                      className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 font-mono text-[12px] leading-relaxed focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2.5 mt-3">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); sendTest(ev); }}
                        disabled={!emailValid || busy != null || !data?.makeWebhookConfigured}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity"
                        style={{ background: ACCENT }}
                        title={!emailValid ? "Erst Test-E-Mail-Adresse oben eintragen" : undefined}
                      >
                        <Send size={13} /> {busy === `test:${ev.type}` ? "Sendet …" : "Test an Make senden"}
                      </button>

                      {ev.customerBound && !ev.deprecated && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <input
                            type="text"
                            value={refInputs[ev.type] || ""}
                            onChange={(e) => setRefInputs((m) => ({ ...m, [ev.type]: e.target.value }))}
                            placeholder="Zahlungs- oder Antragsreferenz"
                            className="w-56 px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono text-[12px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); checkReal(ev); }}
                            disabled={busy != null}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-[13px] font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40 transition-colors"
                          >
                            <User size={13} /> {busy === `real:${ev.type}` ? "Prüft …" : "Für echten Kunden senden"}
                          </button>
                        </div>
                      )}
                    </div>

                    {result && (
                      <p className={`mt-3 text-[12.5px] font-semibold flex items-center gap-1.5 ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {result.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {result.text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Verlauf */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Verlauf — letzte {data?.history.length ?? 0} Sends über die Konsole</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {(!data || data.history.length === 0) ? (
            <p className="px-4 py-6 text-center text-[13px] text-slate-400">Noch keine Test-Sends.</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Zeit", "Event", "Empfänger", "Modus", "Status"].map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.history.map((h, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="px-4 py-2.5 text-[12px] text-slate-500 tabular-nums whitespace-nowrap">{fmtTime(h.at)}</td>
                    <td className="px-4 py-2.5 text-[12px] font-mono font-semibold text-slate-800 whitespace-nowrap">{h.event}</td>
                    <td className="px-4 py-2.5 text-[12px] text-slate-600 break-all">{h.email}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase ${h.mode === "real" ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-500"}`}>
                        {h.mode === "real" ? "Echter Kunde" : "Test"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {h.ok
                        ? <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600"><CheckCircle2 size={13} /> OK</span>
                        : <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-red-600"><XCircle size={13} /> Fehler</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Bestätigungsdialog „Für echten Kunden senden" */}
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" onClick={() => setPreview(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={17} className="text-amber-500" />
              <h3 className="text-[15px] font-bold text-slate-900">Der Kunde erhält wirklich diese E-Mail</h3>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 mb-4 text-[13px] space-y-1">
              <p><span className="text-slate-400">Event:</span> <span className="font-mono font-semibold">{preview.eventType}</span></p>
              <p><span className="text-slate-400">Kunde:</span> <span className="font-semibold">{preview.customer}</span></p>
              <p><span className="text-slate-400">E-Mail:</span> <span className="font-semibold break-all">{preview.email}</span></p>
              <p><span className="text-slate-400">Status:</span> <span className="font-semibold">{preview.status}</span></p>
            </div>
            <p className="text-[12px] text-slate-500 mb-4">
              Es werden die echten Kundendaten gesendet (kein <code className="font-mono">test</code>-Feld) — Make löst die reale E-Mail aus.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreview(null); }}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); confirmReal(); }}
                disabled={busy != null}
                className="px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold disabled:opacity-40"
                style={{ background: ACCENT }}
              >
                {busy?.startsWith("confirm:") ? "Sendet …" : "Ja, an Kunden senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
