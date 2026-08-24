import { useState, useEffect } from "react";
import { raumStaerkeLesen, raumStaerkeSetzen, type RaumStaerke } from "@/components/FiaonRaum";
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

/**
 * Design — der Raum-Regler und die Knopf-Familie zum Ansehen.
 *
 * ── WARUM EIN STYLEGUIDE IM PRODUKT UND NICHT IN EINER DATEI ───────────────
 * Ein Styleguide, der neben dem Produkt liegt, veraltet still. Dieser hier
 * rendert dieselben Klassen, die überall benutzt werden — wenn ein Knopf
 * hier falsch aussieht, sieht er überall falsch aus.
 */
function DesignTafel() {
  const [staerke, setStaerke] = useState<RaumStaerke>(() => raumStaerkeLesen());
  const setzen = (v: RaumStaerke) => { raumStaerkeSetzen(v); setStaerke(v); };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <h2 className="text-[14px] font-bold text-slate-900 mb-1">Design</h2>
      <p className="text-[12px] text-slate-500 mb-4">
        Der Hintergrund und die Knopf-Familie. Was hier steht, ist dasselbe,
        was überall im System benutzt wird.
      </p>

      {/* ── Der Raum ─────────────────────────────────────────────────── */}
      <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500 mb-2">
        Hintergrund
      </p>
      <div className="flex flex-wrap gap-1.5">
        {([[0, "Aus"], [1, "Zurückhaltend"], [2, "Mittel"], [3, "Deutlich"]] as const).map(([v, t]) => (
          <button key={v} type="button" onClick={() => setzen(v as RaumStaerke)}
                  className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                  style={staerke === v
                    ? { background: "var(--fi-primaer)", color: "#fff" }
                    : { background: "rgba(15,23,42,.04)", color: "#475569" }}>
            {t}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-slate-500 leading-relaxed" style={{ maxWidth: 560 }}>
        Das Video lädt erst nach dem Seiteninhalt. Wer im Browser reduzierte Bewegung
        eingestellt hat oder im Datensparmodus surft, bekommt nur das Standbild — auf
        inhaltsdichten Seiten ist der Hintergrund automatisch schwächer.
        Die Einstellung gilt für dieses Gerät.
      </p>

      {/* ── Die Knopf-Familie ────────────────────────────────────────── */}
      <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500 mt-6 mb-2">
        Knöpfe
      </p>
      <div className="rounded-2xl p-4" style={{ background: "rgba(15,23,42,.025)" }}>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="fi-knopf-primaer px-5">Primär</button>
          <button type="button" className="fi-knopf-glas px-4">Sekundär (Glas)</button>
          <button type="button" className="fi-knopf-gefahr px-4">Gefahr</button>
          <button type="button" className="fi-knopf-gefahr fi-knopf-gefahr-voll px-4">
            Gefahr im Dialog
          </button>
          <button type="button" className="fi-knopf-primaer px-5" disabled>Gesperrt</button>
        </div>
        <p className="mt-3 text-[11.5px] text-slate-500 leading-relaxed">
          Regel: Wer eine dunkle Fläche trägt, bringt seine Schriftfarbe selbst mit — weiß,
          per <code className="font-mono">!important</code>. Nicht erben, nicht hoffen.
          Der Mindestkontrast von 4,5:1 wird im Prüfstand am gerenderten Knopf gemessen.
        </p>
      </div>

      {/* ── Dunkle Fläche ────────────────────────────────────────────── */}
      <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500 mt-6 mb-2">
        Dunkle Akzentfläche
      </p>
      <div className="p-4 rounded-2xl fi-flaeche-tief">
        <p className="text-[10.5px] font-bold uppercase tracking-[.12em] fi-leise">Beispiel</p>
        <p className="mt-1 text-[17px] font-bold">2.520,00 €</p>
        <p className="mt-1 text-[12px] fi-leise">
          #0A1A3C aus der CI. Alles darin ist hell — eine geerbte dunkle Schrift wäre hier
          praktisch unsichtbar.
        </p>
      </div>
    </div>
  );
}

/**
 * Telefon-Selbstdiagnose.
 *
 * ── WARUM SIEBEN SCHRITTE UND NICHT „bereit: ja/nein" ──────────────────────
 * Der Vorgesetzte hatte alle sechs Werte gesetzt, das Konto war aktiv, die
 * Nummer vorhanden — und im Panel stand „Das Telefon konnte nicht starten:
 * undefined". Zwischen „eingetragen" und „es klingelt" liegen sieben
 * Stellen. Ein einzelnes Ampellicht sagt nicht, welche davon klemmt.
 *
 * Jeder Schritt fragt TWILIO SELBST. Ob eine Variable gesetzt ist, sagt
 * nichts darüber, ob sie stimmt.
 */
function TelefonDiagnose() {
  const [d, setD] = useState<any>(null);
  const [laeuft, setLaeuft] = useState(false);

  const pruefen = async () => {
    setLaeuft(true);
    const r = await fetch("/api/fiaon/admin/telefon/diagnose", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(false);
    setD(j ?? { ok: false, error: "Die Diagnose war nicht erreichbar." });
  };

  const marke = (stand: string) => {
    const farbe = stand === "gut" ? "#059669" : stand === "fehler" ? "#dc2626"
      : stand === "warnung" ? "#d97706" : "#94a3b8";
    return (
      <span className="shrink-0 mt-0.5 inline-flex items-center justify-center"
            style={{ width: 18, height: 18, borderRadius: 999, background: `${farbe}1a`, color: farbe }}>
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none" stroke="currentColor"
             strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {stand === "gut" ? <path d="m4.5 10.5 3.5 3.5 7.5-8" />
            : stand === "fehler" ? <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
            : stand === "warnung" ? <><path d="M10 5.5v5" /><circle cx="10" cy="14" r=".6" fill="currentColor" /></>
            : <circle cx="10" cy="10" r="3.2" />}
        </svg>
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-slate-900 mb-1">Telefon — Verbindung prüfen</h2>
          <p className="text-[12px] text-slate-500 leading-relaxed" style={{ maxWidth: 560 }}>
            Läuft die ganze Kette bis Twilio durch und zeigt je Schritt, was gemessen wurde.
            Jeder Schritt fragt Twilio selbst — ob ein Wert gesetzt ist, sagt nichts darüber,
            ob er stimmt.
          </p>
        </div>
        <button type="button" onClick={() => void pruefen()} disabled={laeuft}
                className="fi-knopf-primaer px-4 shrink-0">
          {laeuft ? "Prüft …" : "Verbindung prüfen"}
        </button>
      </div>

      {d && !d.ok && (
        <p className="mt-4 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold"
           style={{ background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
          {d.error}
        </p>
      )}

      {d?.ok && (
        <>
          <p className="mt-4 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold leading-relaxed"
             style={d.bereit
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
            {d.zusammenfassung}
          </p>
          <div className="mt-3 rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
            {d.schritte.map((s2: any) => (
              <div key={s2.nr} className="flex gap-3 px-3.5 py-3"
                   style={{ borderBottom: "1px solid #f8fafc" }}>
                {marke(s2.stand)}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-slate-800">
                    {s2.nr}. {s2.titel}
                  </p>
                  <p className="text-[12px] text-slate-600 leading-snug mt-0.5"
                     style={{ overflowWrap: "anywhere" }}>{s2.befund}</p>
                  {s2.rat && (
                    <p className="text-[12px] leading-relaxed mt-1.5 px-3 py-2 rounded-lg"
                       style={{ background: "rgba(29,78,216,.05)", color: "#1e40af", overflowWrap: "anywhere" }}>
                      {s2.rat}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminEinstellungenPage() {
  const [form, setForm] = useState({ rate: "", min: "" });
  const [reminder, setReminder] = useState({ max: "6", start: "10", end: "11", enabled: true });
  const [distribution, setDistribution] = useState({ enabled: true, cap: "50" });
  const [officeUmbau, setOfficeUmbau] = useState(false); // E-038: Mitarbeiter-Sperre bis zur Freigabe des neuen Office
  const [partner, setPartner] = useState<{ overrideRate: string; thresholds: Array<{ key: string; label: string; min: string; bonus: string }>; prizes: Record<string, { title: string; description: string }> }>({ overrideRate: "5", thresholds: [], prizes: {} });
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
          setOfficeUmbau(Boolean(j.settings.officeUmbau));
          setDistribution({
            enabled: Boolean(j.settings.distributionEnabled),
            cap: String(j.settings.distributionCap ?? 50),
          });
          const prizes: Record<string, { title: string; description: string }> = {};
          for (const [k, v] of Object.entries((j.settings.partnerPrizes || {}) as Record<string, any>)) {
            prizes[k] = { title: v?.title || "", description: v?.description || "" };
          }
          setPartner({
            overrideRate: String((j.settings.partnerOverrideBp ?? 500) / 100).replace(".", ","),
            thresholds: ((j.settings.partnerThresholds || []) as any[]).map((t) => ({
              key: t.key, label: t.label,
              min: String(t.minCents / 100),
              bonus: String(t.bonusBp / 100).replace(".", ","),
            })),
            prizes,
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
        distributionEnabled: distribution.enabled,
        distributionCap: Math.round(Number(distribution.cap)),
        officeUmbau,
        partnerOverrideBp: Math.round(Number(partner.overrideRate.replace(",", ".")) * 100),
        partnerThresholds: partner.thresholds.map((t) => ({
          key: t.key, label: t.label,
          minCents: Math.round(Number(String(t.min).replace(",", ".")) * 100),
          bonusBp: Math.round(Number(String(t.bonus).replace(",", ".")) * 100),
        })),
        partnerPrizes: partner.prizes,
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
        <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">{message}</div>
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
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? "…" : "Speichern"}</button>
      </form>

      {/* E-038: Office-Umbau – Sperre für Mitarbeiter */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-[14px] font-bold text-slate-900">Mitarbeiter-Office: Umbau-Sperre</h2>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={officeUmbau} onChange={(e) => setOfficeUmbau(e.target.checked)} className="w-4 h-4 accent-[#2563eb]" />
            <span className="text-[12px] font-semibold text-slate-700">{officeUmbau ? "Sperre aktiv" : "Sperre aus"}</span>
          </label>
        </div>
        <p className="text-[12px] text-slate-400 mb-4">
          Bei aktiver Sperre sehen deaktivierte Mitarbeiter nach dem Login die Umbau-Bühne („Großes Update – seid gespannt“) statt des Office.
          Aktive Mitarbeiter sind nicht betroffen. Der Provisionssatz oben (Standard-Provisionssatz) gilt auch für den Gehaltsrechner im Office.
        </p>
        <button type="submit" disabled={busy} className={`${btnPrimary}`}>{busy ? "…" : "Speichern"}</button>
      </form>

      {/* 24.08.2026 (Justin: „Wo bzw. wie schalte ich die Mitarbeiter frei?"):
          VORHER war das Zurückschalten Handarbeit an zwei Orten — hier die
          Sperre aus, dann jedes der elf Konten einzeln in der Team-Zentrale.
          NACHHER erledigt ein Knopf beides, genau für die Konten, die vor der
          Aussperrung aktiv waren. */}
      <OfficeFreischaltung />

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
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? "…" : "Speichern"}</button>
      </form>

      {/* Paket AE1: Automatische Kundenverteilung */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="text-[14px] font-bold text-slate-900">Automatische Kundenverteilung</h2>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={distribution.enabled}
              onChange={(e) => setDistribution((d) => ({ ...d, enabled: e.target.checked }))}
              className="w-4 h-4 accent-[#2563eb]"
            />
            <span className={`text-[12px] font-bold ${distribution.enabled ? "text-emerald-600" : "text-red-600"}`}>
              {distribution.enabled ? "Verteilung AN" : "Verteilung AUS"}
            </span>
          </label>
        </div>
        <p className="text-[12px] text-slate-400 mb-4">
          Neue, unzugewiesene Bestellungen werden im Rotationsprinzip (Round-Robin) fair auf alle aktiven Mitarbeiter verteilt.
          Ob ein Mitarbeiter teilnimmt, steuerst du in der <Link href="/admin/team" className="font-semibold text-[#2563eb] hover:underline">Team-Übersicht</Link>.
          Das bestehende Auto-Claim für Altbestände bleibt erhalten.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Obergrenze offener Kunden pro Mitarbeiter</label>
            <input type="number" min={0} max={10000} value={distribution.cap} onChange={(e) => setDistribution((d) => ({ ...d, cap: e.target.value }))} className={inputCls} />
            <p className="text-[10px] text-slate-400 mt-1">Ist ein Mitarbeiter voll, rotiert die Verteilung weiter. 0 = unbegrenzt.</p>
          </div>
        </div>
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? "…" : "Speichern"}</button>
      </form>

      {/* Paket AE2/AE3: FIAON Partner-Programm */}
      <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
        <h2 className="text-[14px] font-bold text-slate-900 mb-1">FIAON Partner-Programm</h2>
        <p className="text-[12px] text-slate-400 mb-4">
          Partnerstatus entsteht ausschließlich aus dem kumulierten bestätigten EIGENumsatz eines Mitarbeiters
          (Team-Umsatzbeteiligungen zählen nicht). Zuschläge wirken nur auf neue Provisionseinträge (Einfrier-Prinzip).
          Die Team-Umsatzbeteiligung gilt strikt für EINE Ebene — keine Ketten.
        </p>
        <div className="mb-4">
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Standard-Umsatzbeteiligung für Werber (%)</label>
          <input type="text" inputMode="decimal" value={partner.overrideRate} onChange={(e) => setPartner((p) => ({ ...p, overrideRate: e.target.value }))} className={inputCls} style={{ maxWidth: 200 }} />
          <p className="text-[10px] text-slate-400 mt-1">Pro Beziehung überschreibbar (Team-Übersicht → Mitarbeiter bearbeiten).</p>
        </div>
        <div className="space-y-3">
          {partner.thresholds.map((t, i) => (
            <div key={t.key} className="p-3.5 rounded-xl border border-slate-200">
              <p className="text-[12px] font-bold text-slate-800 mb-2">{t.label}</p>
              <div className="grid sm:grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Meilenstein ab Eigenumsatz (€)</label>
                  <input type="text" inputMode="decimal" value={t.min} onChange={(e) => setPartner((p) => ({ ...p, thresholds: p.thresholds.map((x, xi) => xi === i ? { ...x, min: e.target.value } : x) }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Provisions-Zuschlag (Prozentpunkte)</label>
                  <input type="text" inputMode="decimal" value={t.bonus} onChange={(e) => setPartner((p) => ({ ...p, thresholds: p.thresholds.map((x, xi) => xi === i ? { ...x, bonus: e.target.value } : x) }))} className={inputCls} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Meilenstein-Prämie (Titel)</label>
                  <input type="text" value={partner.prizes[t.key]?.title || ""} onChange={(e) => setPartner((p) => ({ ...p, prizes: { ...p.prizes, [t.key]: { title: e.target.value, description: p.prizes[t.key]?.description || "" } } }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Prämien-Beschreibung</label>
                  <input type="text" value={partner.prizes[t.key]?.description || ""} onChange={(e) => setPartner((p) => ({ ...p, prizes: { ...p.prizes, [t.key]: { title: p.prizes[t.key]?.title || "", description: e.target.value } } }))} className={inputCls} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Sachprämien werden NIE automatisch als Geld gebucht — erreichte Meilensteine erscheinen als Aufgabe „Prämie ausliefern" in der Team-Übersicht.</p>
        <button type="submit" disabled={busy} className={`${btnPrimary} mt-4`}>{busy ? "…" : "Speichern"}</button>
      </form>

      <DesignTafel />
      <TelefonDiagnose />

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

// ═══════════════════════════════════════════════════════════════════════════
// MITARBEITER WIEDER FREISCHALTEN — der Rückweg aus der Umbau-Sperre (E-038)
//
// Zeigt zuerst, WER freigeschaltet würde (aus der Merkliste, die beim
// Aussperren geschrieben wurde), und sagt je Konto dazu, ob es danach auch
// wieder Kunden aus der Verteilung bekommt. Erst dann der Knopf.
// ═══════════════════════════════════════════════════════════════════════════
type FreiKonto = { id: number; name: string; rolle: string; aktiv: boolean; inVerteilung: boolean };

function OfficeFreischaltung() {
  const [stand, setStand] = useState<{ umbauSperre: boolean; leadVerteilung: boolean; konten: FreiKonto[] } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = async () => {
    try {
      const r = await fetch("/api/fiaon/admin/office-freischaltung", { credentials: "include" });
      const j = await r.json();
      if (j?.ok) setStand({ umbauSperre: j.umbauSperre, leadVerteilung: j.leadVerteilung, konten: j.konten || [] });
    } catch { /* stiller Fehlschlag – der Block ist eine Hilfe, kein Muss */ }
  };
  useEffect(() => { void laden(); }, []);

  const freischalten = async () => {
    if (!confirm("Alle Mitarbeiter der Merkliste wieder freischalten und die Umbau-Sperre ausschalten?")) return;
    setLaeuft(true); setFehler(null); setMeldung(null);
    try {
      const r = await fetch("/api/fiaon/admin/office-freischaltung", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!j?.ok) { setFehler(j?.error || "Nicht freigeschaltet."); return; }
      setMeldung(j.meldung || "Freigeschaltet.");
      await laden();
    } catch {
      setFehler("Der Server war nicht erreichbar.");
    } finally { setLaeuft(false); }
  };

  if (!stand || stand.konten.length === 0) return null;
  const gesperrte = stand.konten.filter((k) => !k.aktiv);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
      <h2 className="text-[14px] font-bold text-slate-900 mb-1">Mitarbeiter wieder freischalten</h2>
      <p className="text-[12px] text-slate-400 mb-3">
        {gesperrte.length > 0
          ? `${gesperrte.length} von ${stand.konten.length} Konten sind für den Umbau ausgesperrt. Ein Klick schaltet genau diese wieder frei und schaltet die Umbau-Sperre aus.`
          : "Alle Konten der Merkliste sind aktiv."}
        {" "}Verteilung und Lead-Automatik laufen danach von selbst weiter – dort ist nichts zusätzlich einzuschalten
        {stand.leadVerteilung ? "" : " (Achtung: die Lead-Verteilung ist derzeit ausgeschaltet)"}.
      </p>
      <ul className="mb-4 divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
        {stand.konten.map((k) => (
          <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span className="text-[12.5px] text-slate-700">
              <b className="font-semibold text-slate-900">{k.name}</b> <span className="text-slate-400">· {k.rolle}</span>
            </span>
            <span className="text-[11.5px] font-semibold">
              <span className={k.aktiv ? "text-emerald-600" : "text-amber-600"}>{k.aktiv ? "aktiv" : "ausgesperrt"}</span>
              <span className="text-slate-400 font-normal">
                {" · "}{k.inVerteilung ? "bekommt neue Kunden" : "ohne Verteilung"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {meldung && <p className="text-[12px] font-semibold text-emerald-600 mb-3">{meldung}</p>}
      {fehler && <p className="text-[12px] font-semibold text-red-600 mb-3">{fehler}</p>}
      <button type="button" onClick={() => void freischalten()} disabled={laeuft || gesperrte.length === 0}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-[#2563eb] text-white text-[13px] font-semibold disabled:opacity-40">
        {laeuft ? "Schaltet frei …" : `${gesperrte.length} Mitarbeiter freischalten`}
      </button>
    </div>
  );
}
