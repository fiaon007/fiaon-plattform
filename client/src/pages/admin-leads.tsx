import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Send, Users, Play, Settings2, X, Upload, Pencil, Check, Link2, Activity, Info, ChevronDown, HelpCircle, FlaskConical, Trash2, Radio, Clock, Plus } from "lucide-react";
import ImportDialog from "./admin-leads-import";

type FlashKind = "ok" | "err" | "info";
type Flash = { text: string; kind: FlashKind };

// Kleiner Info-Tooltip („i"), funktioniert per Hover (Desktop) und Tap (Mobile).
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label="Erklärung anzeigen"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        className="text-slate-300 hover:text-slate-500 ml-1"><Info size={13} /></button>
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 top-6 z-30 w-56 rounded-lg bg-slate-800 text-white text-[11px] leading-snug px-2.5 py-2 shadow-lg normal-case font-normal tracking-normal">
          {text}
        </span>
      )}
    </span>
  );
}

// ════════════════════════════════════════════════════════════════════
// /admin/leads — Lead-Management (Pakete BA/BB/BC).
// Läuft in der AdminShell (Sidebar/Breadcrumb liefert der Wrapper).
// Design: monochrom slate, Akzent #2563eb, keine bunten Icons/Emojis.
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

const STATUS: Record<string, string> = {
  neu: "Neu", kontaktiert: "Kontaktiert", nicht_erreichbar: "Nicht erreichbar",
  konvertiert: "Konvertiert", kein_interesse: "Kein Interesse", tot: "Tot",
};
// Ticket #15: Klartext-Gründe fürs Aussortieren.
const DISMISS_LABEL: Record<string, string> = {
  keine_telefonnummer: "keine Telefonnummer",
  nummer_ungueltig: "Nummer ungültig",
  kein_interesse: "kein Interesse",
  dublette: "Dublette",
  sonstiges: "sonstiges",
};
// BE3: gruppierte Filter-Chips (Alle · Offen · Konvertiert · Tot/Kein Interesse)
const GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "", label: "Alle", statuses: [] },
  { key: "offen", label: "Offene Leads", statuses: ["neu", "kontaktiert", "nicht_erreichbar"] },
  { key: "konvertiert", label: "Konvertiert (Kunde)", statuses: ["konvertiert"] },
  { key: "tot", label: "Tot / Kein Interesse", statuses: ["tot", "kein_interesse"] },
  // Ticket #15: von Agenten aus der Arbeitsliste entfernt — nie gelöscht, zurückholbar.
  { key: "aussortiert", label: "Aussortiert", statuses: [] },
];

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function fmtD(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}
const PAY_LABEL: Record<string, string> = { pending_payment: "offen", claimed_paid: "angekündigt", paid: "bezahlt", expired: "abgelaufen", refunded: "erstattet" };

function fmtDT(v: string | null) {
  if (!v) return "—";
  // Ticket #13: immer deutsche Zeit anzeigen (Europe/Berlin), unabhängig vom Betrachter.
  try { return new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}
function ageDays(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return d <= 0 ? "heute" : d === 1 ? "1 Tag" : `${d} Tage`;
}

const WD = [{ n: "1", l: "Mo" }, { n: "2", l: "Di" }, { n: "3", l: "Mi" }, { n: "4", l: "Do" }, { n: "5", l: "Fr" }, { n: "6", l: "Sa" }, { n: "7", l: "So" }];

function EnginePanel({ onAction }: { onAction: (msg: string, kind?: FlashKind) => void }) {
  const [s, setS] = useState<any>(null);
  const [bulk, setBulk] = useState<any>(null);      // preview (versendbare)
  const [bulkAll, setBulkAll] = useState<any>(null); // preview-all (alle offenen)
  const [job, setJob] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sentToday, setSentToday] = useState<number | null>(null);
  const [nextRun, setNextRun] = useState<string | null>(null);
  const [confirmMode, setConfirmMode] = useState<null | "eligible" | "all">(null);

  const load = useCallback(() => {
    apiF("/admin/leads/settings").then((r) => { if (r.ok) { setS(r.json.settings); setSentToday(r.json.sentToday ?? null); setNextRun(r.json.nextRunLabel ?? null); } });
    apiF("/admin/leads/followup-bulk/preview").then((r) => r.ok && setBulk(r.json));
    apiF("/admin/leads/followup-bulk/preview-all").then((r) => r.ok && setBulkAll(r.json));
    apiF("/admin/leads/followup-bulk/status").then((r) => r.ok && setJob(r.json.job));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!job?.running) return;
    const t = setInterval(() => apiF("/admin/leads/followup-bulk/status").then((r) => r.ok && setJob(r.json.job)), 5000);
    return () => clearInterval(t);
  }, [job?.running]);

  if (!s) return null;
  const set = (k: string, v: string) => setS({ ...s, [k]: v });
  const times: string[] = (s.lead_followup_times || "").split(",").filter(Boolean);
  const days = new Set<string>((s.lead_followup_weekdays || "").split(",").filter(Boolean));
  const setTimes = (arr: string[]) => set("lead_followup_times", Array.from(new Set(arr.filter(Boolean))).sort().join(","));
  const toggleDay = (n: string) => { const d = new Set(days); d.has(n) ? d.delete(n) : d.add(n); set("lead_followup_weekdays", WD.map((w) => w.n).filter((n2) => d.has(n2)).join(",")); };

  const save = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/settings", { method: "POST", body: JSON.stringify(s) });
    setBusy(false);
    onAction(r.ok ? "Einstellungen gespeichert." : (r.json?.error || "Konnte nicht gespeichert werden."), r.ok ? "ok" : "err");
    if (r.ok) load();
  };
  const runNow = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/run-followups", { method: "POST" });
    setBusy(false);
    if (r.ok) onAction(`Nachfass-Lauf fertig: ${r.json.sent} Mail(s) verschickt${r.json.markedDead ? `, ${r.json.markedDead} Lead(s) als „tot" markiert` : ""}.`, "ok");
    else onAction(r.json?.error || "Nachfass-Lauf fehlgeschlagen.", "err");
    load();
  };
  const startBulk = async (mode: "eligible" | "all") => {
    setBusy(true);
    const r = await apiF("/admin/leads/followup-bulk/start", { method: "POST", body: JSON.stringify({ mode }) });
    setBusy(false);
    setConfirmMode(null);
    if (r.ok) { onAction(`Versand gestartet: ${r.json.planned} Lead(s) werden angeschrieben (ca. ${Math.max(1, Math.ceil(r.json.planned / 20))} Min., 20/Min.). Fortschritt siehe unten.`, "ok"); load(); }
    else onAction(r.json?.error || "Versand konnte nicht gestartet werden.", "err");
  };
  const distribute = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/distribute", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? (r.json.assigned > 0 ? `${r.json.assigned} Lead(s) an das Team verteilt.` : "Alle Leads sind bereits zugewiesen.") : (r.json?.error || "Verteilen fehlgeschlagen."), r.ok ? "ok" : "err");
    load();
  };
  const backfill = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/backfill-convert", { method: "POST" });
    setBusy(false);
    onAction(r.ok ? (r.json.converted > 0 ? `${r.json.converted} Lead(s) als Kunde erkannt und markiert.` : "Keine neuen Übereinstimmungen gefunden.") : (r.json?.error || "Abgleich fehlgeschlagen."), r.ok ? "ok" : "err");
    load();
  };

  const hardOpen = bulk?.withinWindow !== false;
  const nowStr = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  const enabled = s.lead_followup_enabled === "1";

  const inp = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] w-full";
  const lbl = "text-[12px] text-slate-500 flex flex-col !items-start gap-1";
  const btnSec = "px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-40 inline-flex items-center gap-1.5";
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Settings2 size={16} className="text-slate-400" />
        <p className="text-[14px] font-bold text-slate-900">Nachfass-Automatik & Verteilung</p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${enabled ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>{enabled ? "Automatik aktiv" : "Automatik pausiert"}</span>
        {sentToday != null && <span className="ml-auto text-[12px] text-slate-500">Heute versendet: <b className="text-slate-800 tabular-nums">{sentToday}</b></span>}
      </div>
      <p className="text-[12px] text-slate-500 mb-3 max-w-2xl">Hier stellst du ein, ob und wann Interessenten ohne Antrag automatisch per E-Mail erinnert werden — und wie neue Leads aufs Team verteilt werden.</p>

      <div className={`text-[12px] rounded-lg px-3 py-2 mb-4 ${enabled ? "bg-slate-50 text-slate-600" : "bg-amber-50 text-amber-800"}`}>
        {enabled
          ? (nextRun ? <>Nächster automatischer Versand: <b className="text-slate-800">{nextRun}</b>. {!hardOpen && <span className="text-amber-700">Es ist {nowStr} Uhr — außerhalb 08–20 Uhr wird pausiert.</span>}</>
                     : "Kein Sendezeitpunkt gesetzt — bitte unten mindestens eine Sendezeit angeben.")
          : "Die Automatik ist ausgeschaltet (Not-Aus). Es werden keine automatischen Mails versendet."}
      </div>

      {/* Grundeinstellungen */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        <label className={lbl}><span className="flex items-center">Automatik an/aus<InfoTip text="Schaltet die automatischen Nachfass-Mails komplett ein oder aus (Not-Aus)." /></span>
          <select className={inp} value={s.lead_followup_enabled} onChange={(e) => set("lead_followup_enabled", e.target.value)}>
            <option value="1">An</option><option value="0">Aus (Not-Aus)</option>
          </select>
        </label>
        <label className={lbl}><span className="flex items-center">Nachfass-Tage<InfoTip text="An diesen Tagen nach Eingang bekommt ein Lead automatisch eine Erinnerung — z. B. am 1., 2., 4. Tag usw." /></span>
          <input className={inp} value={s.lead_followup_days} onChange={(e) => set("lead_followup_days", e.target.value)} placeholder="1,2,4,7,14,21" />
        </label>
        <label className={lbl}><span className="flex items-center">Max. Nachfässe<InfoTip text="Nach so vielen erfolglosen Erinnerungen wird der Lead als ‚tot' markiert und nicht mehr angeschrieben." /></span>
          <input className={inp} value={s.max_lead_followups} onChange={(e) => set("max_lead_followups", e.target.value)} placeholder="6" />
        </label>
      </div>

      {/* P2-C: Arbeitswarteschlange der Agenten — Gewichtung + Fairness */}
      <div className="rounded-lg border border-slate-200 p-3 mb-4">
        <p className="text-[12px] font-semibold text-slate-700 flex items-center mb-1">
          Arbeitswarteschlange der Agenten
          <InfoTip text="Agenten sehen Leads verdeckt und in dieser Server-Reihenfolge. Die Gewichte bestimmen, was oben steht — die Agenten sehen die Gewichtung bewusst nicht." />
        </p>
        <p className="text-[11px] text-slate-400 mb-3">Höheres Gewicht = stärkerer Einfluss auf die Reihenfolge. Fairness: jeder N-te Lead kommt aus dem ältesten Bestand.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <label className={lbl}><span className="flex items-center">Frische<InfoTip text="Neue Leads stehen höher (nimmt mit dem Alter ab, Halbwertszeit ~7 Tage)." /></span>
            <input className={inp} value={s.queue_w_fresh ?? ""} onChange={(e) => set("queue_w_fresh", e.target.value)} placeholder="40" />
          </label>
          <label className={lbl}><span className="flex items-center">Umsatzpotenzial<InfoTip text="Leads aus Business-Kampagnen (höherwertiges Paketinteresse) stehen höher." /></span>
            <input className={inp} value={s.queue_w_value ?? ""} onChange={(e) => set("queue_w_value", e.target.value)} placeholder="25" />
          </label>
          <label className={lbl}><span className="flex items-center">Reaktionssignal<InfoTip text="Leads mit fälligem, dokumentiertem Rückruf-Termin stehen deutlich höher." /></span>
            <input className={inp} value={s.queue_w_react ?? ""} onChange={(e) => set("queue_w_react", e.target.value)} placeholder="50" />
          </label>
          <label className={lbl}><span className="flex items-center">Kontakthistorie<InfoTip text="Nie kontaktierte Leads stehen höher; lange nicht kontaktierte rücken langsam nach oben." /></span>
            <input className={inp} value={s.queue_w_contact ?? ""} onChange={(e) => set("queue_w_contact", e.target.value)} placeholder="30" />
          </label>
          <label className={lbl}><span className="flex items-center">Fairness (jeder N-te)<InfoTip text="Jeder N-te Slot in der Warteschlange kommt aus dem ältesten Bestand, damit alte Leads nicht ewig liegenbleiben (2–10)." /></span>
            <input className={inp} value={s.queue_fairness_nth ?? ""} onChange={(e) => set("queue_fairness_nth", e.target.value)} placeholder="4" />
          </label>
          <label className={lbl}><span className="flex items-center">Akte-Auto-Freigabe (Min.)<InfoTip text="Eine offene Akte ohne dokumentiertes Kontakt-Ergebnis wird nach so vielen Minuten automatisch freigegeben (Deadlock-Schutz, z. B. Feierabend). 0 = nie." /></span>
            <input className={inp} value={s.akte_auto_release_min ?? ""} onChange={(e) => set("akte_auto_release_min", e.target.value)} placeholder="30" />
          </label>
        </div>
        {/* V1 (Phase 2B): Stichtag der Provisionsregel — nur Anzeige, bewusst nicht editierbar */}
        <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
          Provisionsregel-Stichtag:{" "}
          {s.commission_cutoff_at
            ? <b className="text-slate-600">{new Date(s.commission_cutoff_at).toLocaleString("de-DE")} — Bestellungen davor laufen nach dem alten Modell (Zuweisung genügt), danach gilt „Betreuung dokumentiert“.</b>
            : <b className="text-amber-700">noch nicht gesetzt — für ALLE Bestellungen gilt das alte Modell (Zuweisung genügt). Scharfstellung erfolgt einmalig per Skript.</b>}
        </p>
      </div>

      {/* Zeitplan */}
      <div className="rounded-lg border border-slate-200 p-3 mb-4">
        <p className="text-[12px] font-semibold text-slate-700 flex items-center mb-1"><Clock size={13} className="text-slate-400 mr-1.5" />Automatischer Versand: Wann?<InfoTip text="Zu diesen Uhrzeiten prüft das System automatisch, welche Leads eine Nachfass-Mail bekommen sollen, und versendet sie." /></p>
        <p className="text-[11px] text-slate-400 mb-3">Uhrzeiten (Europa/Berlin), zu denen der automatische Lauf startet. Empfohlen innerhalb 08–20 Uhr.</p>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {times.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 pl-2 pr-1 py-1">
              <input type="time" value={t} onChange={(e) => { const a = [...times]; a[i] = e.target.value; setTimes(a); }} className="text-[13px] outline-none" />
              <button type="button" onClick={() => setTimes(times.filter((_, j) => j !== i))} className="text-slate-300 hover:text-red-500" aria-label="Zeit entfernen"><X size={13} /></button>
            </span>
          ))}
          {times.length < 6 && (
            <button type="button" onClick={() => setTimes([...times, "12:00"])} className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-700 border border-dashed border-slate-300 rounded-lg px-2.5 py-1.5"><Plus size={13} /> Zeit hinzufügen</button>
          )}
        </div>
        <p className="text-[12px] font-semibold text-slate-700 flex items-center mb-2">Versandtage<InfoTip text="An diesen Wochentagen läuft der automatische Versand. Sonntags standardmäßig aus." /></p>
        <div className="flex flex-wrap gap-1.5">
          {WD.map((w) => (
            <button key={w.n} type="button" onClick={() => toggleDay(w.n)}
              className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border ${days.has(w.n) ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}>{w.l}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button disabled={busy} onClick={save} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Einstellungen speichern</button>
        <button disabled={busy} onClick={runNow} className={btnSec}>
          <Play size={13} /> Automatik jetzt einmalig ausführen<InfoTip text="Startet einen Nachfass-Lauf sofort von Hand (statt auf die nächste Sendezeit zu warten). Schreibt nur die jetzt fälligen Leads an." />
        </button>
        <button disabled={busy} onClick={distribute} className={btnSec}><Users size={13} /> Verteilen<InfoTip text="Ordnet noch nicht zugewiesene Leads gleichmäßig den aktiven Agenten zu." /></button>
        <button disabled={busy} onClick={backfill} className="px-3 py-2 rounded-lg text-[12px] font-medium text-slate-400 hover:text-slate-600 inline-flex items-center gap-1">
          Leads mit Kunden abgleichen<InfoTip text="Prüft nachträglich, welche Leads inzwischen einen Antrag gestellt haben, und markiert sie als Kunde. Selten nötig." />
        </button>
      </div>

      {/* Manueller Versand: zwei klar getrennte Aktionen */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
        <p className="text-[12px] font-semibold text-slate-700 mb-2 flex items-center"><Send size={13} className="text-slate-400 mr-1.5" />Jetzt manuell versenden</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button disabled={busy || job?.running || !bulk} onClick={() => setConfirmMode("eligible")} className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-[13px] font-semibold text-slate-700 hover:border-slate-400 disabled:opacity-40 inline-flex items-center justify-center gap-1.5">
            Jetzt versendbare anschreiben ({bulk?.eligible ?? 0})<InfoTip text="Schreibt alle Leads an, die JETZT dran sind — ohne die, die in den letzten 8 Stunden schon eine Mail bekommen haben, und ohne bereits konvertierte/tote." />
          </button>
          <button disabled={busy || job?.running || !bulkAll} onClick={() => setConfirmMode("all")} className="flex-1 px-3 py-2.5 rounded-lg text-white text-[13px] font-semibold disabled:opacity-40 inline-flex items-center justify-center gap-1.5" style={{ background: ACCENT }}>
            <Send size={14} /> Allen offenen Leads schreiben<InfoTip text="Schreibt ALLEN offenen Leads (die noch keinen Antrag gestellt haben), auch importierten Alt-Leads, die noch nie kontaktiert wurden." />
          </button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2">„Allen offenen" bezieht auch importierte Alt-Leads ein — aktuell {bulkAll?.openTotal ?? 0} offen, {bulkAll?.eligible ?? 0} davon jetzt versendbar.</p>
        {job?.running && <p className="mt-2 text-[12px] text-slate-600">Versand läuft ({job.mode === "all" ? "alle offenen" : "versendbare"}): <b className="tabular-nums">{job.sent}</b>/{job.planned} verschickt{job.errors ? `, ${job.errors} Fehler` : ""} …</p>}
        {job && !job.running && job.finishedAt && <p className="mt-2 text-[12px] text-slate-400">Letzter Versand ({job.mode === "all" ? "alle offenen" : "versendbare"}): {job.sent}/{job.planned} verschickt{job.errors ? `, ${job.errors} Fehler` : ""}.</p>}
      </div>

      {confirmMode === "eligible" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmMode(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold text-slate-900 mb-1">Jetzt versendbare Leads anschreiben?</p>
            <p className="text-[13px] text-slate-500 mb-3">
              Es werden <b className="text-slate-800">{bulk?.eligible ?? 0}</b> Lead(s) angeschrieben. <b className="text-slate-800">{bulk?.skipped ?? 0}</b> werden übersprungen (in den letzten 8 Std. schon kontaktiert oder bereits Kunde/„tot"). Versand gedrosselt auf 20/Minute.
            </p>
            {!hardOpen && <p className="text-[12px] text-amber-800 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-3">Aktuell außerhalb 08–20 Uhr — dieser Versand wird pausiert. Bitte innerhalb der Zeiten senden.</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmMode(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Abbrechen</button>
              <button disabled={busy || !hardOpen} onClick={() => startBulk("eligible")} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40" style={{ background: ACCENT }}><Send size={13} /> Ja, senden</button>
            </div>
          </div>
        </div>
      )}

      {confirmMode === "all" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmMode(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[15px] font-bold text-slate-900 mb-2">Allen offenen Leads eine E-Mail senden?</p>
            <p className="text-[13px] text-slate-600 mb-3">
              Du schreibst jetzt <b className="text-slate-900">{bulkAll?.eligible ?? 0}</b> offene Leads an. Davon <b className="text-slate-900">{bulkAll?.importedNeverContacted ?? 0}</b> importierte Alt-Leads, die noch nie kontaktiert wurden. <b className="text-slate-900">{bulkAll?.skipped ?? 0}</b> werden übersprungen (in den letzten 8 Std. bereits angeschrieben).
            </p>
            <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
              Das versendet bis zu <b>{bulkAll?.eligible ?? 0}</b> E-Mails. Bei sehr vielen Empfängern kann das die Zustellbarkeit beeinträchtigen — der Versand wird automatisch gedrosselt (max. 20/Minute, also ca. <b>{Math.max(1, Math.ceil((bulkAll?.eligible ?? 0) / 20))} Minuten</b>).
            </div>
            {!hardOpen && <p className="text-[12px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 mb-3">Hinweis: Es ist {nowStr} Uhr — außerhalb der üblichen Sendezeiten (08–20 Uhr). Da du bewusst auslöst, wird trotzdem gesendet.</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmMode(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Abbrechen</button>
              <button disabled={busy || (bulkAll?.eligible ?? 0) === 0} onClick={() => startBulk("all")} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-40" style={{ background: ACCENT }}><Send size={13} /> Ja, {bulkAll?.eligible ?? 0} Leads anschreiben</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tip, sub, warn }: { label: string; value: string | number; tip: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${warn ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-[11px] text-slate-400 flex items-center">{label}<InfoTip text={tip} /></p>
      <p className={`text-[15px] font-bold tabular-nums ${warn ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
    </div>
  );
}

function IntakeDiagnostics({ onAction, onRefresh }: { onAction: (msg: string, kind?: FlashKind) => void; onRefresh: () => void }) {
  const [d, setD] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const load = useCallback(() => { apiF("/admin/leads/intake-diagnostics").then((r) => r.ok && setD(r.json)); }, []);
  useEffect(load, [load]);
  if (!d) return null;
  const testIntake = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/test-intake", { method: "POST" });
    setBusy(false);
    if (r.ok) onAction(`Test-Lead ${r.json.deduped ? "aktualisiert" : "angelegt"} — der Eingang funktioniert. Der Test-Lead ist unten in der Liste als „TEST" markiert.`, "ok");
    else onAction(`Test fehlgeschlagen${r.status ? ` (Fehler ${r.status})` : ""}: ${r.json?.error || "unbekannter Grund"}.`, "err");
    load(); onRefresh();
  };
  const delTests = async () => {
    setBusy(true);
    const r = await apiF("/admin/leads/test-leads", { method: "DELETE" });
    setBusy(false); setConfirmDel(false);
    onAction(r.ok ? (r.json.deleted > 0 ? `${r.json.deleted} Test-Lead(s) gelöscht.` : "Keine Test-Leads vorhanden.") : (r.json?.error || "Löschen fehlgeschlagen."), r.ok ? "ok" : "err");
    load(); onRefresh();
  };
  const rejected = d.counts.rejected7d > 0;
  const c = d.counts;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Radio size={16} className="text-slate-400" />
        <p className="text-[14px] font-bold text-slate-900">Lead-Eingang (Facebook → System)</p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${d.secretConfigured ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>{d.secretConfigured ? "Sicherheits-Schlüssel gesetzt" : "Schlüssel fehlt"}</span>
      </div>
      <p className="text-[12px] text-slate-500 mb-3 max-w-2xl">Zeigt, ob neue Leads von Facebook wirklich im System ankommen — und lässt dich den Eingang testen.</p>

      {!d.secretConfigured && (
        <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          Der Sicherheits-Schlüssel <span className="font-mono">LEAD_INTAKE_SECRET</span> ist nicht gesetzt. Facebook/Make erhält beim Senden eine Fehlermeldung (503) — es kommen keine echten Leads an, bis der Schlüssel hinterlegt ist. (Der Test-Lead-Button funktioniert trotzdem.)
        </div>
      )}
      {rejected && (
        <div className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {c.rejected7d} Zugriff(e) mit falschem Schlüssel in den letzten 7 Tagen. Bitte in Make den Header <span className="font-mono">x-lead-secret</span> prüfen.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Metric label="Letzter Lead-Eingang" tip="Wann zuletzt ein Lead empfangen wurde und aus welcher Quelle."
          value={d.lastIntake ? fmtDT(d.lastIntake.created_at) : "noch keiner"} sub={d.lastIntake?.quelle || "Sobald Facebook einen Lead sendet, erscheint er hier."} />
        <Metric label="Eingänge 24 Std / 7 Tage" tip="Wie viele Leads in den letzten 24 Stunden bzw. 7 Tagen angekommen sind."
          value={`${c.ok24h} / ${c.ok7d}`} />
        <Metric label="Abgelehnt (falscher Schlüssel)" tip="Zugriffe mit falschem Sicherheits-Schlüssel — sollte 0 sein. Falls größer 0: Header/Secret in Make prüfen." value={c.rejected7d} warn={rejected} />
        <Metric label="Ungültig (ohne Kontakt)" tip="Empfangene Datensätze ohne E-Mail und ohne Telefon — konnten nicht als Lead gespeichert werden." value={c.invalid7d} warn={c.invalid7d > 0} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button disabled={busy} onClick={testIntake} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT }}>
          <FlaskConical size={13} /> Test-Lead simulieren<InfoTip text="Legt einen künstlichen Test-Lead an, um zu prüfen, ob der Eingang funktioniert. Unabhängig von Uhrzeit und Facebook." />
        </button>
        <button disabled={busy} onClick={() => setConfirmDel(true)} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 inline-flex items-center gap-1.5"><Trash2 size={13} /> Test-Leads löschen</button>
      </div>

      <details className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
        <summary className="cursor-pointer text-slate-500 select-none">Technische Details für Make/Facebook</summary>
        <div className="mt-2 space-y-0.5">
          <p>Ziel-Adresse: <span className="font-mono text-slate-500">{d.doc.intakeUrl}</span></p>
          <p>Sicherheits-Header: <span className="font-mono text-slate-500">{d.doc.secretHeader}: &lt;LEAD_INTAKE_SECRET&gt;</span></p>
          <p>Felder: <span className="font-mono text-slate-500">{d.doc.payloadFields.join(", ")}</span></p>
          {d.recentRejected?.length > 0 && (
            <div className="mt-1">
              <p className="font-semibold text-slate-500">Zuletzt abgelehnt/ungültig:</p>
              {d.recentRejected.map((r: any, i: number) => <p key={i}>{fmtDT(r.created_at)} · {r.status} · {r.detail}</p>)}
            </div>
          )}
        </div>
      </details>

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDel(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-[14px] font-bold text-slate-900 mb-1">Alle Test-Leads löschen?</p>
            <p className="text-[13px] text-slate-500 mb-3">Entfernt nur die künstlich angelegten Test-Leads (Quelle „test"). Echte Leads bleiben unberührt.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600">Abbrechen</button>
              <button disabled={busy} onClick={delTests} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ background: "#dc2626" }}><Trash2 size={13} /> Ja, löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const RESULTS = [
  { key: "erreicht_interesse", label: "Erreicht – Interesse" },
  { key: "erreicht_kein_interesse", label: "Kein Interesse" },
  { key: "nicht_erreicht", label: "Nicht erreicht" },
  { key: "mailbox", label: "Mailbox" },
  { key: "rueckruf_termin", label: "Rückruf vereinbart" },
  { key: "nummer_falsch", label: "Falsche Nummer" },
];
const MANUAL_STATUS = ["neu", "kontaktiert", "nicht_erreichbar", "kein_interesse", "tot"];
const OPEN = ["neu", "kontaktiert", "nicht_erreichbar"];

function LeadDrawer({ id, agents, onClose, onChanged }: { id: number; agents: any[]; onClose: () => void; onChanged: () => void }) {
  const [lead, setLead] = useState<any>(null);
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ vorname: "", nachname: "", email: "", telefon: "" });
  const [note, setNote] = useState("");
  const [rueckruf, setRueckruf] = useState("");

  const load = useCallback(() => {
    apiF(`/admin/leads/${id}`).then((r) => { if (r.ok) { setLead(r.json.lead); setLog(r.json.log || []); } });
  }, [id]);
  useEffect(load, [load]);
  useEffect(() => { if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); } }, [msg]);
  if (!lead) return null;

  const name = [lead.vorname, lead.nachname].filter(Boolean).join(" ") || lead.email || lead.telefon || `Lead #${lead.id}`;
  const isOpen = OPEN.includes(lead.status);
  const refresh = () => { load(); onChanged(); };
  const act = async (path: string, body?: any, okMsg?: string) => {
    setBusy(true);
    const r = await apiF(`/admin/leads/${id}${path}`, { method: body === undefined ? "POST" : "POST", body: JSON.stringify(body || {}) });
    setBusy(false);
    setMsg(r.ok ? (okMsg || "Erledigt.") : (r.json?.error || "Fehler."));
    if (r.ok) refresh();
    return r.ok;
  };
  const assign = async (agentId: string) => {
    const r = await apiF(`/admin/leads/${id}/assign`, { method: "POST", body: JSON.stringify({ agentId: agentId === "" ? null : Number(agentId) }) });
    if (r.ok) { setMsg("Zuweisung aktualisiert."); refresh(); }
  };
  const startEdit = () => { setForm({ vorname: lead.vorname || "", nachname: lead.nachname || "", email: lead.email || "", telefon: lead.telefon || "" }); setEditing(true); };
  const saveEdit = async () => {
    setBusy(true);
    const r = await apiF(`/admin/leads/${id}/contact-data`, { method: "PATCH", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setEditing(false); setMsg("Kontaktdaten gespeichert."); refresh(); } else setMsg(r.json?.error || "Fehler.");
  };
  const result = async (key: string) => {
    if (key === "rueckruf_termin" && !rueckruf) { setMsg("Bitte Rückruf-Termin wählen."); return; }
    // Ticket #13: naive datetime-local-Eingabe unverändert senden — der Server
    // deutet sie als deutsche Zeit (Europe/Berlin). Kein toISOString() (das wäre
    // Browser-lokal und hängt vom Standort des Betrachters ab).
    await act("/contact-result", { outcome: key, scheduledAt: key === "rueckruf_termin" ? rueckruf : null }, "Kontakt-Ergebnis gespeichert.");
    setRueckruf("");
  };
  const sendNote = async () => { if (!note.trim()) return; if (await act("/notes", { note: note.trim() }, "Notiz gespeichert.")) setNote(""); };

  const ipt = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px] w-full";
  const btnS = "px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:border-slate-300 disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0 flex-1"><p className="text-[15px] font-bold text-slate-900 truncate">{name}</p>
            <p className="text-[11px] text-slate-400">{STATUS[lead.status]} · Quelle {lead.quelle || "—"}{lead.kampagne ? ` · ${lead.kampagne}` : ""}</p></div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><X size={15} /></button>
        </div>

        {msg && <div className="mx-5 mt-3 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[12px] text-slate-700">{msg}</div>}

        {/* Ticket #15: aussortiert — nie gelöscht, jederzeit zurückholbar */}
        {lead.dismissed_at && (
          <div className="mx-5 mt-3 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50 flex items-center justify-between gap-2">
            <span className="text-[12px] text-amber-800">
              Aussortiert am {fmtDT(lead.dismissed_at)}{lead.dismissed_by_name ? ` von ${lead.dismissed_by_name}` : ""} · Grund: {DISMISS_LABEL[lead.dismissed_reason] || lead.dismissed_reason || "—"}
            </span>
            <button disabled={busy} onClick={() => act("/restore", {}, "Lead zurückgeholt — steht wieder in der Arbeitswarteschlange.")}
              className="shrink-0 px-2.5 py-1 rounded-lg border border-amber-300 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
              Zurückholen
            </button>
          </div>
        )}

        <div className="p-5 space-y-4 text-[13px]">
          {/* Kontaktdaten (bearbeitbar) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Kontaktdaten</p>
              {!editing && <button onClick={startEdit} className="text-[11px] text-slate-500 inline-flex items-center gap-1 hover:text-slate-800"><Pencil size={12} /> Bearbeiten</button>}
            </div>
            {editing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className={ipt} placeholder="Vorname" value={form.vorname} onChange={(e) => setForm({ ...form, vorname: e.target.value })} />
                  <input className={ipt} placeholder="Nachname" value={form.nachname} onChange={(e) => setForm({ ...form, nachname: e.target.value })} />
                </div>
                <input className={ipt} placeholder="E-Mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <input className={ipt} placeholder="Telefon (+49 …)" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
                <div className="flex gap-2">
                  <button disabled={busy} onClick={saveEdit} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1" style={{ background: ACCENT }}><Check size={13} /> Speichern</button>
                  <button onClick={() => setEditing(false)} className={btnS}>Abbrechen</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div><span className="text-slate-400">E-Mail</span><br />{lead.email || "—"}</div>
                <div><span className="text-slate-400">Telefon</span><br />{lead.telefon || "—"}</div>
                <div><span className="text-slate-400">Angelegt</span><br />{fmtDT(lead.erstellt_am)}</div>
                <div><span className="text-slate-400">Letzter Kontakt</span><br />{fmtDT(lead.letzter_kontakt_am)}</div>
                {/* V2 (Phase 2B): offene Akte sichtbar + Admin-Notausgang */}
                {lead.opened_at && (
                  <div className="col-span-2 flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200">
                    <span className="text-[12px] text-amber-800">Akte offen seit {fmtDT(lead.opened_at)}{lead.opened_by_name ? ` bei ${lead.opened_by_name}` : ""}</span>
                    <button disabled={busy} onClick={() => act("/release-akte", {}, "Akte freigegeben — Lead ist zurück in der Warteschlange.")}
                      className="shrink-0 px-2.5 py-1 rounded-lg border border-amber-300 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                      Akte freigeben
                    </button>
                  </div>
                )}
                {lead.converted_order_id && <div className="col-span-2"><span className="text-slate-400">Konvertiert → Antrag</span><br />{lead.converted_order_id}</div>}
              </div>
            )}
          </div>

          {/* Versand-Aktionen */}
          {isOpen && (
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => act("/send-application-link", {}, "Antrags-/Zahlungslink gesendet.")} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ background: ACCENT }}><Link2 size={13} /> Antrag/Zahlungslink senden</button>
              <button disabled={busy} onClick={() => act("/send-followup", {}, "Follow-up gesendet.")} className={btnS + " inline-flex items-center gap-1.5"}><Send size={13} /> Follow-up jetzt</button>
            </div>
          )}

          {/* Kontakt-Ergebnis */}
          {isOpen && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Kontakt-Ergebnis</p>
              <div className="grid grid-cols-2 gap-2">
                {RESULTS.map((o) => (
                  <button key={o.key} disabled={busy} onClick={() => result(o.key)} className={btnS + " text-left"}>{o.label}</button>
                ))}
              </div>
              <input type="datetime-local" value={rueckruf} onChange={(e) => setRueckruf(e.target.value)} className={ipt + " mt-2"} />
              <p className="text-[10.5px] text-slate-400 mt-1">Uhrzeit in deutscher Zeit (Europe/Berlin)</p>
            </div>
          )}

          {/* Manueller Status + Zuweisung */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Status</p>
              <select disabled={lead.status === "konvertiert"} className={ipt} value={MANUAL_STATUS.includes(lead.status) ? lead.status : ""} onChange={(e) => act("/status", { status: e.target.value }, "Status gesetzt.")}>
                {lead.status === "konvertiert" ? <option value="">Konvertiert</option> : MANUAL_STATUS.map((st) => <option key={st} value={st}>{STATUS[st]}</option>)}
              </select>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Zuweisung</p>
              <select className={ipt} value={lead.assigned_agent_id || ""} onChange={(e) => assign(e.target.value)}>
                <option value="">— nicht zugewiesen —</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.active ? "" : " (inaktiv)"}</option>)}
              </select>
            </div>
          </div>

          {/* Notiz */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Notiz hinzufügen</p>
            <textarea className={ipt} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Interne Notiz …" />
            <button disabled={busy || !note.trim()} onClick={sendNote} className={btnS + " mt-1"}>Notiz speichern</button>
          </div>

          {/* Historie */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 inline-flex items-center gap-1"><Activity size={12} /> Historie</p>
            <div className="space-y-2">
              {log.length === 0 && <p className="text-[12px] text-slate-400">Keine Einträge.</p>}
              {log.map((e) => (
                <div key={e.id} className="border-l-2 border-slate-200 pl-3 py-0.5">
                  <p className="text-slate-700 text-[12px]">{e.note || e.outcome || e.type}{e.scheduled_at ? ` · Termin ${fmtDT(e.scheduled_at)}` : ""}</p>
                  <p className="text-slate-400 text-[11px]">{e.agent_name} · {fmtDT(e.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OnboardingHelp() {
  const [open, setOpen] = useState(() => localStorage.getItem("fiaon_leads_help_collapsed") !== "1");
  const toggle = () => { const n = !open; setOpen(n); localStorage.setItem("fiaon_leads_help_collapsed", n ? "0" : "1"); };
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl mb-5">
      <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-3 text-left">
        <HelpCircle size={16} className="text-slate-400 shrink-0" />
        <span className="text-[13px] font-semibold text-slate-700">Wie funktioniert diese Seite?</span>
        <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-[13px] text-slate-600 leading-relaxed max-w-3xl">
          Leads kommen automatisch von Facebook (oder per Import) ins System. Sie werden gleichmäßig aufs Team
          verteilt und — solange niemand einen Antrag stellt — automatisch per E-Mail nachgefasst. Sobald jemand
          einen Antrag stellt, wird er automatisch zum Kunden. Oben steuerst du die Automatik und prüfst den
          Eingang; in der Liste unten arbeitest du einzelne Leads ab (anrufen, Notiz, Mail senden, Status setzen).
        </div>
      )}
    </div>
  );
}

export default function AdminLeadsPage() {
  const [data, setData] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [group, setGroup] = useState("");
  const [q, setQ] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [loading, setLoading] = useState(true);
  const notify = useCallback((text: string, kind: FlashKind = "info") => setFlash({ text, kind }), []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (group) params.set("group", group);
    if (q.trim()) params.set("q", q.trim());
    apiF(`/admin/leads?${params.toString()}`).then((r) => {
      if (r.ok) { setData(r.json.data || []); setCounts(r.json.counts || {}); setStats(r.json.stats || null); }
    }).finally(() => setLoading(false));
  }, [group, q]);
  useEffect(load, [load]);
  useEffect(() => { apiF("/admin/agents").then((r) => r.ok && setAgents(r.json.data || [])); }, []);
  useEffect(() => { if (flash) { const t = setTimeout(() => setFlash(null), 5000); return () => clearTimeout(t); } }, [flash]);

  const flashCls = flash?.kind === "err"
    ? "border-red-200 bg-red-50 text-red-700"
    : flash?.kind === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-slate-300 bg-white text-slate-700";

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Leads</h1>
          <p className="text-[13px] text-slate-500">Interessenten aus Lead-Ads und Import — automatisch verknüpft, nachgefasst und an das Team verteilt.</p>
        </div>
        <button onClick={() => setShowImport(true)} className="px-3 py-2 rounded-lg text-white text-[12px] font-semibold inline-flex items-center gap-1.5 shrink-0" style={{ background: ACCENT }}><Upload size={13} /> Leads importieren</button>
      </div>

      {flash && <div className={`mb-4 px-4 py-2.5 rounded-lg border text-[13px] ${flashCls}`}>{flash.text}</div>}

      <OnboardingHelp />

      {/* Überblick */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Überblick</p>
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400 flex items-center">Leads gesamt<InfoTip text="Alle jemals empfangenen oder importierten Interessenten." /></p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.total}</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400 flex items-center">Konvertiert<InfoTip text="Leads, die inzwischen einen Antrag gestellt haben und damit Kunde wurden." /></p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.converted}{stats.convertedPct != null ? <span className="text-[12px] font-medium text-slate-400"> · {stats.convertedPct}%</span> : null}</p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400 flex items-center">Zahlend<InfoTip text="Konvertierte Kunden, die bereits bezahlt haben — inkl. Umsatzsumme." /></p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.paying}<span className="text-[12px] font-medium text-slate-400"> · {eur(stats.revenueCents)}</span></p></div>
          <div className="bg-white border border-slate-200 rounded-xl p-3"><p className="text-[11px] text-slate-400 flex items-center">Offene Leads<InfoTip text="Noch nicht konvertierte, nicht als ‚tot' markierte Interessenten, die weiter bearbeitet werden." /></p><p className="text-lg font-bold text-slate-900 tabular-nums">{stats.open}</p></div>
        </div>
      )}

      {/* Steuerung */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Steuerung & Eingang</p>
      <EnginePanel onAction={notify} />
      <IntakeDiagnostics onAction={notify} onRefresh={load} />

      {/* Liste */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Lead-Liste</p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        {GROUPS.map((g) => {
          const c = g.key === "aussortiert" ? (counts.aussortiert || 0) : g.statuses.reduce((sum, s) => sum + (counts[s] || 0), 0);
          return (
            <button key={g.key} onClick={() => setGroup(g.key)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${group === g.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>
              {g.label}{g.key ? ` (${c})` : ""}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, E-Mail, Telefon…" className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] w-52" />
          <button onClick={load} className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center"><RefreshCw size={15} /></button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-semibold">Name</th>
              <th className="text-left px-4 py-2.5 font-semibold">Kontakt</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden sm:table-cell">Quelle</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden md:table-cell">Agent</th>
              <th className="text-left px-4 py-2.5 font-semibold hidden lg:table-cell">Kunde / Zahlung</th>
              <th className="text-left px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Lädt…</td></tr>}
            {!loading && data.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Keine Leads.</td></tr>}
            {data.map((l) => {
              const name = [l.vorname, l.nachname].filter(Boolean).join(" ") || "—";
              const isConv = l.status === "konvertiert";
              return (
                <tr key={l.id} onClick={() => setOpenId(l.id)} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">
                    <span className="inline-flex items-center gap-1.5">{name}{l.quelle === "test" && <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold tracking-wide">TEST</span>}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{l.telefon || l.email || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden sm:table-cell">{l.kampagne || l.quelle || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden md:table-cell">{l.agent_name || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500 hidden lg:table-cell text-[12px]">
                    {isConv && l.converted_order_id
                      ? <span>Kunde seit {fmtD(l.konvertiert_am)}<br /><span className="text-slate-400">{l.converted_order_id} · {PAY_LABEL[l.payment_status] || l.payment_status || "—"}{l.amount_due != null ? ` · ${eur(Math.round(Number(l.amount_due) * 100))}` : ""}</span></span>
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500">{STATUS[l.status] || l.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openId !== null && <LeadDrawer id={openId} agents={agents} onClose={() => setOpenId(null)} onChanged={load} />}
      {showImport && <ImportDialog onClose={() => { setShowImport(false); load(); }} onDone={(m) => notify(m, "ok")} />}
    </div>
  );
}
