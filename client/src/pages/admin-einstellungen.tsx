import { useState, useEffect } from "react";
import { Link } from "wouter";

// ═══════════════════════════════════════════════════════════════════
// /admin/einstellungen — globale Einstellungen (bestehende Endpoints)
// + System-Diagnose: Base-URL (Quelle!), Make-Webhook-Status je Event,
//   INVOICE_VAT_MODE (read-only, TAX-REVIEW-Hinweis).
// Skript-Status-Mapping bleibt bei den Skripten unter /admin/team.
// ═══════════════════════════════════════════════════════════════════

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-900 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-colors";
const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors disabled:opacity-40 bg-[#2563eb] hover:bg-[#1d4fd7]";

const MAKE_EVENTS = [
  "welcome", "payment_details", "payment_reminder", "claim_received", "payment_confirmed",
  "followup_48h", "agent_payment_reminder", "agent_invite", "agent_password_reset",
  "agent_payout_done", "agent_payout_rejected", "agent_callback_reminder",
];

function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export default function AdminEinstellungenPage() {
  const [form, setForm] = useState({ rate: "", min: "" });
  const [reminder, setReminder] = useState({ max: "6", start: "10", end: "11", enabled: true });
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [sys, setSys] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  useEffect(() => {
    fetch("/api/fiaon/admin/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setForm({
            rate: String(j.settings.defaultCommissionRateBp / 100).replace(".", ","),
            min: String(j.settings.payoutMinCents / 100).replace(".", ","),
          });
          setStatusMap(j.settings.scriptStatusMap || {});
          setReminder({
            max: String(j.settings.maxReminders ?? 6),
            start: String(j.settings.reminderWindowStart ?? 10),
            end: String(j.settings.reminderWindowEnd ?? 11),
            enabled: Boolean(j.settings.reminderEngineEnabled),
          });
        }
      });
    fetch("/api/fiaon/admin/system-status", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setSys(j); });
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const res = await fetch("/api/fiaon/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        defaultCommissionRateBp: Math.round(Number(form.rate.replace(",", ".")) * 100),
        payoutMinCents: Math.round(Number(form.min.replace(",", ".")) * 100),
        scriptStatusMap: statusMap,
        maxReminders: Math.round(Number(reminder.max)),
        reminderWindowStart: Math.round(Number(reminder.start)),
        reminderWindowEnd: Math.round(Number(reminder.end)),
        reminderEngineEnabled: reminder.enabled,
      }),
    });
    const j = await res.json().catch(() => null);
    setBusy(false);
    flash(res.ok && j?.ok ? "Einstellungen gespeichert" : j?.error || "Fehler");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Einstellungen</h1>
      <p className="text-[13px] text-slate-500 mb-5">Globale Standardwerte und System-Diagnose.</p>

      {message && (
        <div className="fx-toast-in mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{message}</div>
      )}

      {/* Provisions-Standards */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-[14px] font-bold text-slate-900 mb-1">Provision & Auszahlung</h2>
        <p className="text-[12px] text-slate-400 mb-4">
          Der Standard-Satz gilt für Mitarbeiter ohne individuellen Satz — Änderungen wirken nur auf zukünftige Provisionen.
          Individuelle Sätze pflegst du in der <Link href="/admin/team" className="font-semibold text-[#2563eb] hover:underline">Team-Übersicht</Link>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Standard-Provisionssatz (%)</label>
            <input type="text" inputMode="decimal" value={form.rate} onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Mindest-Auszahlungsbetrag (€)</label>
            <input type="text" inputMode="decimal" value={form.min} onChange={(e) => setForm((f) => ({ ...f, min: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? <span className="fx-spinner" aria-hidden="true" /> : "Speichern"}</button>
      </form>

      {/* Paket V2: Tägliche Reminder-Engine */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-[14px] font-bold text-slate-900">Zahlungserinnerungen (tägliche Engine)</h2>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={reminder.enabled}
              onChange={(e) => setReminder((r) => ({ ...r, enabled: e.target.checked }))}
              className="w-4 h-4 accent-[#2563eb]"
            />
            <span className={`text-[12px] font-bold ${reminder.enabled ? "text-emerald-600" : "text-red-600"}`}>
              {reminder.enabled ? "Engine AN" : "Engine AUS (Not-Aus aktiv)"}
            </span>
          </label>
        </div>
        <p className="text-[12px] text-slate-400 mb-4">
          Jede unbezahlte Bestellung erhält einmal pro Tag das Make-Event <code className="font-mono">payment_reminder</code> —
          erste Erinnerung 24 h nach Bestellung, max. 1 Erinnerung pro 20 h (kanalübergreifend, inkl. Mitarbeiter-Mail und Bulk-Versand).
          Versand nie außerhalb 08–20 Uhr (Europa/Berlin).
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max. Erinnerungen pro Bestellung</label>
            <input type="number" min={0} max={30} value={reminder.max} onChange={(e) => setReminder((r) => ({ ...r, max: e.target.value }))} className={inputCls} />
            <p className="text-[10px] text-slate-400 mt-1">Danach läuft die Bestellung regulär ab (7-Tage-Frist).</p>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Versandfenster ab (Uhr)</label>
            <input type="number" min={8} max={19} value={reminder.start} onChange={(e) => setReminder((r) => ({ ...r, start: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Versandfenster bis (Uhr, exkl.)</label>
            <input type="number" min={9} max={20} value={reminder.end} onChange={(e) => setReminder((r) => ({ ...r, end: e.target.value }))} className={inputCls} />
          </div>
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? <span className="fx-spinner" aria-hidden="true" /> : "Speichern"}</button>
      </form>

      {/* System-Diagnose */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-[14px] font-bold text-slate-900 mb-1">System-Diagnose</h2>
        <p className="text-[12px] text-slate-400 mb-4">Read-only — Werte kommen aus dem Server-Environment.</p>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200">
            <div>
              <p className="text-[12px] font-semibold text-slate-700">Base-URL für generierte Links (E-Mails, Reset, Rechnungen)</p>
              <p className="text-[13px] font-mono text-slate-900 mt-0.5">{sys ? sys.baseUrl.value : "—"}</p>
            </div>
            {sys && (
              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                sys.baseUrl.source === "fallback" ? "border-slate-400 text-slate-700" : "border-slate-200 text-slate-500"
              }`}>
                {sys.baseUrl.source === "fallback" ? "ENV fehlt — Fallback aktiv, bitte APP_BASE_URL setzen" : `aus ${sys.baseUrl.source}`}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-slate-200">
            <div>
              <p className="text-[12px] font-semibold text-slate-700">Rechnungs-USt-Modus (INVOICE_VAT_MODE)</p>
              <p className="text-[11px] text-slate-400 mt-0.5">TAX REVIEW REQUIRED — nur mit Steuerberater ändern. „none" = kein Steuerausweis.</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-600 font-mono">
              {sys ? sys.invoiceVatMode : "—"}
            </span>
          </div>

          <div className="px-3.5 py-2.5 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[12px] font-semibold text-slate-700">Make.com-Webhook (E-Mail-Automationen)</p>
              <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${
                sys?.makeWebhookConfigured ? "border-slate-200 text-slate-500" : "border-slate-400 text-slate-700"
              }`}>
                {sys == null ? "—" : sys.makeWebhookConfigured ? "konfiguriert" : "MAKE_WEBHOOK_URL fehlt!"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">Letzter erfolgreicher Versand je Event-Typ:</p>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {MAKE_EVENTS.map((ev) => (
                <div key={ev} className="flex items-center justify-between text-[12px]">
                  <span className="font-mono text-slate-500">{ev}</span>
                  <span className={`tabular-nums ${sys?.makeLastEvents?.[ev] ? "text-slate-700 font-medium" : "text-slate-300"}`}>
                    {fmtDT(sys?.makeLastEvents?.[ev])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[12px] text-slate-400">
        Skript-Zuordnung nach Zahlungsstatus findest du bei den <Link href="/admin/team#skripte" className="font-semibold text-[#2563eb] hover:underline">Skripten in der Team-Übersicht</Link>.
      </p>
    </div>
  );
}
