import { useState, useEffect, useCallback } from "react";
import { useRoute, Link } from "wouter";
import {
  User, CreditCard, Mail, Users, Clock, Copy, Pencil, Check, X,
  AlertTriangle, FileText, ArrowLeft, Send, StickyNote, Undo2, Info,
} from "lucide-react";
import { DokumenteSektion } from "@/components/DokumenteSektion";
import { FiaonEbene } from "@/components/FiaonEbene";
import VermerkTafel from "@/components/admin/VermerkTafel";
import ArchivDialog from "@/components/admin/ArchivDialog";
import { KUNDENSTATUS, zahlungsstatusText } from "@shared/fiaon-kundenstatus";

/** Klartext der Archivgründe — dieselbe Liste wie im Server (fiaon-antrag-archiv.ts). */
const ARCHIV_GRUND_TEXT: Record<string, string> = {
  doppelt: "Doppelt angelegt", testeintrag: "Testeintrag",
  widerrufen: "Kunde widerrufen", sonstiges: "Sonstiges",
};

// ═══════════════════════════════════════════════════════════════════
// DIE ZENTRALE KUNDENAKTE — /admin/kunde/:id (Prompt 1/2)
// „Eine Seite. Alles." — Kopf, Stammdaten, Zahlungen, E-Mail-Center,
// Agent & Betreuung, Dubletten, Verlauf. Alle Geld-Aktionen rufen die
// BESTEHENDEN Endpoints (bezahlt inkl. Provisions-Hook, Storno, Merge).
// ═══════════════════════════════════════════════════════════════════

const BERLIN: Intl.DateTimeFormatOptions = { timeZone: "Europe/Berlin" };
function fmtDT(v: any): string {
  if (!v) return "—";
  return new Date(v).toLocaleString("de-DE", { ...BERLIN, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";
}
function fmtD(v: any): string {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("de-DE", { ...BERLIN, day: "2-digit", month: "2-digit", year: "numeric" });
}
function eur(v: any): string {
  if (v == null || v === "") return "—";
  return `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

/** Klartext für ergänzte Felder — „phone_country_code" sagt einem Menschen nichts. */
const FELD_NAME: Record<string, string> = {
  first_name: "Vorname", last_name: "Nachname", contact_name: "Ansprechpartner",
  company_name: "Firma", email: "E-Mail", contact_email: "E-Mail (Kontakt)",
  billing_email: "E-Mail (Rechnung)", phone: "Telefon",
  phone_country_code: "Ländervorwahl", contact_phone: "Telefon (Kontakt)",
  street: "Straße", zip: "PLZ", city: "Ort", country: "Land",
  birthdate: "Geburtsdatum", nationality: "Staatsangehörigkeit",
};

// Die TEXTE kommen aus dem einen Vokabular (shared/fiaon-kundenstatus.ts), die
// Farben bleiben hier — sie gehören zur Ansicht, nicht zur Bedeutung.
const LIFECYCLE_FARBE: Record<string, string> = {
  lead: "bg-sky-50 text-sky-700 border-sky-200",
  antrag: "bg-slate-50 text-slate-600 border-slate-200",
  offen: "bg-blue-50 text-blue-700 border-blue-200",
  angekuendigt: "bg-amber-50 text-amber-700 border-amber-300",
  bezahlt: "bg-emerald-50 text-emerald-700 border-emerald-200",
  abgelaufen: "bg-rose-50 text-rose-600 border-rose-200",
  storniert: "bg-slate-100 text-slate-500 border-slate-200",
  ersetzt: "bg-slate-100 text-slate-400 border-slate-200",
  unbekannt: "bg-slate-50 text-slate-400 border-slate-200",
};
/** Lebenszyklus-Kürzel der Admin-Liste → Zahlungsstand des Vokabulars. */
const LIFECYCLE_ZAHLUNG: Record<string, string | null> = {
  lead: null, antrag: "pending", offen: "pending_payment", angekuendigt: "claimed_paid",
  bezahlt: "paid", abgelaufen: "expired", storniert: "cancelled", ersetzt: "superseded",
  unbekannt: null,
};
const LIFECYCLE_BADGE = new Proxy({} as Record<string, { label: string; cls: string }>, {
  get: (_z, schluessel: string) => ({
    label: LIFECYCLE_ZAHLUNG[schluessel]
      ? zahlungsstatusText(LIFECYCLE_ZAHLUNG[schluessel])
      : (schluessel === "lead" ? KUNDENSTATUS.lead.text : "—"),
    cls: LIFECYCLE_FARBE[schluessel] ?? LIFECYCLE_FARBE.unbekannt,
  }),
});

const PAY_FARBE: Record<string, string> = {
  pending: "bg-slate-50 text-slate-600",
  pending_payment: "bg-blue-50 text-blue-700",
  claimed_paid: "bg-amber-50 text-amber-700",
  paid: "bg-emerald-50 text-emerald-700",
  expired: "bg-rose-50 text-rose-600",
  cancelled: "bg-slate-100 text-slate-500",
  superseded: "bg-slate-100 text-slate-400",
};
const PAY_BADGE = new Proxy({} as Record<string, { label: string; cls: string }>, {
  get: (_z, schluessel: string) => ({
    label: zahlungsstatusText(schluessel),
    cls: PAY_FARBE[schluessel] ?? "bg-slate-100 text-slate-500",
  }),
});

function PayBadge({ status }: { status: string | null }) {
  const b = (status && PAY_BADGE[status]) || { label: status || "—", cls: "bg-slate-50 text-slate-500" };
  // Der Text darf UMBRECHEN, nicht kürzen. „Kunde meldet Zahlung (noch nicht
  // bankbestätigt)" ist mit Absicht lang — ohne den Zusatz liest jemand
  // „Zahlung" und hört auf zu prüfen (shared/fiaon-kundenstatus.ts). Mit
  // `whitespace-nowrap` sprengte die Marke auf 380 px die Karte und der rechte
  // Rand wurde abgeschnitten.
  return <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold ${b.cls}`}>{b.label}</span>;
}

async function api(path: string, body?: any, method = "POST"): Promise<any> {
  const res = await fetch(`/api/fiaon${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

// ── Abschnitts-Karte ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, warn }: { title: string; icon: any; children: any; warn?: boolean }) {
  return (
    // `min-w-0`: Ohne das darf eine Rasterzelle nicht unter die Mindestbreite
    // ihres Inhalts schrumpfen. Auf einem 380-px-Telefon wurden die Karten
    // dadurch 477 px breit und der rechte Rand — Fristen, Datum, Beträge —
    // schlicht abgeschnitten (gemessen am 08.08.2026).
    <div className={`min-w-0 bg-white border rounded-2xl p-5 ${warn ? "border-amber-300" : "border-slate-200"}`}>
      <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-900 mb-4">
        <Icon size={15} className={warn ? "text-amber-500" : "text-slate-400"} /> {title}
      </h2>
      {children}
    </div>
  );
}

// ── Editierbares Feld (Stammdaten) ───────────────────────────────────────────
function Field({ label, value, onSave, type = "text", sensitive, placeholder }: {
  label: string; value: string; onSave: (v: string) => Promise<string | null>;
  type?: string; sensitive?: boolean; placeholder?: string;
}) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setV(value); }, [value]);

  const save = async () => {
    if (v === value) { setEdit(false); return; }
    if (sensitive && !confirm(`${label} wirklich ändern?\n\nAlt: ${value || "—"}\nNeu: ${v || "—"}\n\nDie Änderung wird mit alt → neu, Akteur und Zeit protokolliert.`)) return;
    setBusy(true); setErr(null);
    const e = await onSave(v);
    setBusy(false);
    if (e) setErr(e); else setEdit(false);
  };

  return (
    <div className="py-2 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          {!edit ? (
            <p className="text-[13.5px] font-medium text-slate-800 break-words">{value || <span className="text-slate-300">—</span>}</p>
          ) : (
            <div className="flex items-center gap-1.5 mt-1">
              <input
                type={type}
                value={v}
                placeholder={placeholder}
                onChange={(e) => setV(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setV(value); setEdit(false); } }}
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 text-[13px] focus:border-[#2563eb] outline-none"
                autoFocus
              />
              <button type="button" onClick={save} disabled={busy} className="p-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-50" title="Speichern"><Check size={14} /></button>
              <button type="button" onClick={() => { setV(value); setEdit(false); setErr(null); }} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-400" title="Abbrechen"><X size={14} /></button>
            </div>
          )}
          {err && <p className="text-[11px] font-semibold text-rose-600 mt-1">{err}</p>}
        </div>
        {!edit && (
          <button type="button" onClick={() => setEdit(true)} className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 shrink-0" title={`${label} bearbeiten`}>
            <Pencil size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminKundeAktePage() {
  const [, params] = useRoute("/admin/kunde/:id");
  const id = params?.id ? decodeURIComponent(params.id) : "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [eventPreview, setEventPreview] = useState<any>(null);
  const [lastMergeBatch, setLastMergeBatch] = useState<string | null>(null);
  const [timelineLimit, setTimelineLimit] = useState(30);
  /** Offener Archiv-Dialog (Teil 3) — welche Bestellung wird gerade betrachtet. */
  const [archivRef, setArchivRef] = useState<string | null>(null);
  // Mehrfachauswahl über die Bestellungen — der Betreiber konnte bisher
  // nichts entfernen, auch nicht eine versehentlich angelegte Zeile.
  const [gewaehlteRefs, setGewaehlteRefs] = useState<Set<string>>(new Set());
  const [bestellDialog, setBestellDialog] = useState<any>(null);
  const [bestellWortlaut, setBestellWortlaut] = useState("");

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 6000); };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const r = await api(`/admin/kunden/akte?id=${encodeURIComponent(id)}`, undefined, "GET");
    if (r.ok) { setData(r.json); setError(null); }
    else setError(r.json?.error || `Fehler ${r.status}`);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api("/admin/events/registry", undefined, "GET").then((r) => {
      if (r.ok) setEvents((r.json.events || []).filter((e: any) => e.customerBound && !e.deprecated));
    });
  }, []);

  const app = data?.app;
  const head = data?.head;
  const ref = app?.ref;
  const payRef = app?.paymentReference;

  // ── Aktionen (rufen die BESTEHENDEN Endpoints) ──────────────────────────────
  const act = async (key: string, fn: () => Promise<any>, okMsg: string) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (r.ok) { flash(okMsg); load(); }
    else flash(`Fehler: ${r.json?.error || r.status}`);
  };

  const markPaid = () => {
    if (!confirm(`„${head?.name}" als BEZAHLT markieren?\n\nDas schaltet den Zugang frei, sendet die Bestätigungs-Mail und bucht die Provision exakt wie der bestehende „bezahlt"-Button.`)) return;
    act("paid", () => api(`/admin/payments/${encodeURIComponent(payRef)}/mark-paid`, {}), "✓ Als bezahlt markiert — Freischaltung, Mail und Provisions-Hook sind gelaufen.");
  };
  const cancelOrder = () => {
    if (!confirm(`Bestellung ${payRef} STORNIEREN?\n\nStoppt Erinnerungen sofort und storniert vorhandene Provisionen (bestehende Clawback-Mechanik).`)) return;
    act("cancel", () => api(`/admin/payments/${encodeURIComponent(payRef)}/cancel`, {}), "✓ Storniert — Erinnerungen gestoppt, Provisionen verrechnet.");
  };
  const reactivate = () => {
    act("react", () => api(`/admin/payments/${encodeURIComponent(payRef)}/reactivate`, {}), "✓ Reaktiviert — neue 7-Tage-Frist, Zahlungsdaten-Mail erneut versendet.");
  };
  const saveStammdaten = (field: string) => async (v: string): Promise<string | null> => {
    const r = await api(`/admin/kunden/${encodeURIComponent(ref)}/stammdaten`, { [field]: v });
    if (!r.ok) return r.json?.error || "Fehler";
    if (r.json.duplicate) flash(`⚠️ Achtung: Diese E-Mail gehört bereits zu ${r.json.duplicate.name} (${r.json.duplicate.ref}) — Dubletten-Verdacht.`);
    load();
    return null;
  };
  const saveKondition = (field: string) => async (v: string): Promise<string | null> => {
    const r = await api(`/admin/kunden/${encodeURIComponent(ref)}/konditionen`, { [field]: v, confirmed: true });
    if (!r.ok) return r.json?.error || "Fehler";
    load();
    return null;
  };
  const reassignAgent = async (toAgentId: string) => {
    const target = toAgentId === "" ? null : Number(toAgentId);
    act("agent", () => api(`/admin/team/reassign`, { refs: [ref], toAgentId: target }),
      target == null ? "✓ Zuweisung entfernt." : "✓ Agent neu zugewiesen (protokolliert).");
  };
  const assignLeadAgent = async (leadId: number, toAgentId: string) => {
    act(`leadagent-${leadId}`, () => api(`/admin/leads/${leadId}/assign`, { agentId: toAgentId === "" ? null : Number(toAgentId) }), "✓ Lead-Zuweisung geändert.");
  };
  const addNote = () => {
    if (!note.trim()) return;
    act("note", async () => {
      const r = ref
        ? await api(`/admin/kunden/${encodeURIComponent(ref)}/note`, { note })
        : await api(`/admin/leads/${data.leads[0]?.id}/notes`, { note });
      if (r.ok) setNote("");
      return r;
    }, "✓ Notiz gespeichert.");
  };

  // E-Mail-Center: Vorschau (dryRun) → Bestätigen → echter Versand
  const previewEvent = async (ev: any) => {
    if (!payRef) { flash("Kein Zahlungsvorgang — kundengebundene Events brauchen eine Bestellung."); return; }
    setBusy(`ev-${ev.type}`);
    const r = await api(`/admin/events/send-real`, { eventType: ev.type, paymentRef: payRef, dryRun: true });
    setBusy(null);
    if (r.ok) setEventPreview({ ...r.json, eventType: ev.type, label: ev.label, verifikation: ev.verifikation });
    else flash(`Fehler: ${r.json?.error || r.status}`);
  };
  const confirmEvent = async () => {
    if (!eventPreview) return;
    setBusy(`evsend-${eventPreview.eventType}`);
    const r = await api(`/admin/events/send-real`, { eventType: eventPreview.eventType, paymentRef: payRef });
    setBusy(null);
    setEventPreview(null);
    if (r.ok) { flash(r.json.sent ? `✓ „${eventPreview.label}" an ${eventPreview.email} gesendet.` : "Make hat den Webhook nicht angenommen — Zweig prüfen."); load(); }
    else flash(`Fehler: ${r.json?.error || r.status}`);
  };

  // Dubletten: 1-Klick-Merge mit Gewinner-Vorschlag + Undo
  const mergeFamily = async () => {
    const dup = data.duplicates;
    const winner = dup.suggestedWinner;
    const losers = dup.family.map((f: any) => f.ref).filter((r: string) => r !== winner);
    if (!winner || losers.length === 0) return;
    if (!confirm(`Zusammenführen statt Löschen:\n\nGewinner: ${winner}\nZusammengeführt werden: ${losers.join(", ")}\n\nErgebnis ist EIN Eintrag — Zahlungs- und Provisionshistorie bleibt beweisbar erhalten. Jederzeit per Undo umkehrbar.`)) return;
    setBusy("merge");
    const r = await api(`/admin/applications/merge`, { primaryRef: winner, duplicateRefs: losers, reviewed: true });
    setBusy(null);
    if (r.ok) {
      setLastMergeBatch(r.json.batch || null);
      flash(`✓ Zusammengeführt in ${r.json.mergedInto} (${r.json.merged} Datensätze, umkehrbar).`);
      if (winner !== id) { window.location.href = `/admin/kunde/${encodeURIComponent(winner)}`; return; }
      load();
    } else flash(`Fehler: ${r.json?.error || r.status}`);
  };
  const undoMerge = async () => {
    if (!lastMergeBatch) return;
    act("undo", () => api(`/admin/applications/merge/undo`, { batch: lastMergeBatch }), "✓ Merge rückgängig gemacht.");
    setLastMergeBatch(null);
  };
  const attachLead = async (leadId: number) => {
    if (!ref) return;
    act(`attach-${leadId}`, () => api(`/admin/leads/${leadId}/attach-to-order`, { ref }), "✓ Lead mit dieser Akte verknüpft — kein Doppelanruf mehr.");
  };

  if (!id) return <div className="min-h-screen bg-slate-50" />;
  if (loading && !data) {
    return <div className="min-h-screen bg-slate-50"><div className="max-w-5xl mx-auto px-4 py-16 text-center text-[13px] text-slate-400">Akte lädt …</div></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <p className="text-[14px] font-semibold text-slate-700 mb-2">Akte nicht gefunden</p>
          <p className="text-[12px] text-slate-400 mb-4">{error}</p>
          <Link href="/admin/kunden" className="text-[13px] font-semibold text-[#2563eb] hover:underline">← Zur Kundenliste</Link>
        </div>
      </div>
    );
  }

  const badge = LIFECYCLE_BADGE[head.lifecycle] || LIFECYCLE_BADGE.unbekannt;
  const openLeads = (data.leads || []).filter((l: any) => !l.convertedOrderId && !["konvertiert", "tot", "kein_interesse"].includes(l.status));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Link href="/admin/kunden" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-slate-600 mb-4">
          <ArrowLeft size={13} /> Alle Kunden
        </Link>

        {msg && <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] font-semibold text-blue-800">{msg}</div>}

        {/* ── KOPF ── */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                <h1 className="text-xl font-bold text-slate-900">{head.name}</h1>
                {/* Der EINE Statustext. Kommt seit 08.08.2026 vom Server
                    (head.status) — dieselbe Quelle, die Agentenliste und
                    Vertrieb benutzen. Der Rückfall auf `badge` bleibt für
                    Leads ohne Bestellung. */}
                <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${badge.cls}`}>
                  {head.status?.anzeige || badge.label}
                </span>
                {head.commissionBasis === "direktzahler" && (
                  <span className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">Direktzahler</span>
                )}
                {head.gdprDeleted && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">DSGVO gelöscht</span>}
                {head.dismissedAt && <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-500">Aussortiert</span>}
              </div>
              <p className="text-[12.5px] text-slate-500">
                {head.email || "keine E-Mail"} · {head.phone || "kein Telefon"} · seit {fmtD(head.seit)}
                {head.agentName ? <> · betreut von <b className="text-slate-700">{head.agentName}</b></> : " · kein Agent"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {payRef && (app.paymentStatus === "pending_payment" || app.paymentStatus === "claimed_paid") && (
                <button type="button" onClick={markPaid} disabled={busy === "paid"}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12.5px] font-bold disabled:opacity-50">
                  {busy === "paid" ? "…" : "Als bezahlt markieren"}
                </button>
              )}
              {payRef && app.paymentStatus === "expired" && (
                <button type="button" onClick={reactivate} disabled={busy === "react"}
                  className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-[12.5px] font-bold disabled:opacity-50">
                  {busy === "react" ? "…" : "Reaktivieren"}
                </button>
              )}
              {payRef && ["pending_payment", "claimed_paid", "expired", "paid"].includes(app.paymentStatus) && (
                <button type="button" onClick={cancelOrder} disabled={busy === "cancel"}
                  className="px-4 py-2.5 rounded-xl bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-[12.5px] font-bold disabled:opacity-50">
                  Stornieren
                </button>
              )}
              {payRef && (
                <a href={`/api/fiaon/admin/payments/${encodeURIComponent(payRef)}/invoice.pdf`} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-slate-300 text-[12.5px] font-bold">
                  Rechnung (PDF)
                </a>
              )}
            </div>
          </div>
          {/* Nur ECHTE Dubletten schlagen Alarm: mehrere offene Bestellungen
              DERSELBEN Produktart. Vorher galt jede zweite Bestellung als
              Verdacht — also auch die Bonitätsauskunft neben dem Paket. Das ist
              ein regulärer Zweitkauf, und ein Zusammenführen wäre dort falsch. */}
          {head.duplicateSuspicion && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12px] font-semibold text-amber-800 flex items-center gap-2">
              <AlertTriangle size={13} /> Echte Dublette: mehrere offene Bestellungen derselben Produktart — unten zusammenführen.
            </div>
          )}
          {!head.duplicateSuspicion && head.namensHinweise > 0 && (
            <p className="mt-3 text-[11.5px] text-slate-400">
              {head.namensHinweise} Person{head.namensHinweise === 1 ? "" : "en"} mit gleichem Namen, aber anderer E-Mail und
              anderer Nummer. Das ist kein Dublettenverdacht — nur ein Hinweis, unten nachsehbar.
            </p>
          )}
          {/* Ergänzte Felder offenlegen: Diese Werte stehen nicht an DIESER
              Bestellung, sondern an einer früheren derselben Person. Ohne den
              Hinweis wirkt die Akte inkonsistent zur Bestellung. */}
          {Array.isArray(data.ergaenzt) && data.ergaenzt.length > 0 && (
            <p className="mt-2 text-[11.5px] text-slate-500">
              {data.ergaenzt.length} Feld{data.ergaenzt.length === 1 ? "" : "er"} aus einer früheren Bestellung derselben
              Person ergänzt ({Array.from(new Set(data.ergaenzt.map((e: any) => FELD_NAME[e.feld] || e.feld))).join(", ")}) —
              so ist die Akte vollständig, ohne dass etwas überschrieben wurde.
            </p>
          )}
          {head.commissionBasisNote && (
            <p className="mt-2 text-[11.5px] text-slate-400">Provisions-Lage: {head.commissionBasisNote}</p>
          )}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          {/* ── STAMMDATEN ── */}
          {app ? (
            <Section title="Stammdaten — alles editierbar, alles mit Audit" icon={User}>
              <Field label="Vorname" value={app.firstName || ""} onSave={saveStammdaten("firstName")} />
              <Field label="Nachname" value={app.lastName || ""} onSave={saveStammdaten("lastName")} />
              <Field label="E-Mail" value={app.email || ""} onSave={saveStammdaten("email")} sensitive type="email" />
              <Field label="Telefon" value={app.phone || ""} onSave={saveStammdaten("phone")} placeholder="+49 …" />
              <Field label="Straße" value={app.street || ""} onSave={saveStammdaten("street")} />
              <Field label="PLZ" value={app.zip || ""} onSave={saveStammdaten("zip")} />
              <Field label="Ort" value={app.city || ""} onSave={saveStammdaten("city")} />
              <Field label="Geburtsdatum (JJJJ-MM-TT)" value={app.birthdate ? String(app.birthdate).slice(0, 10) : ""} onSave={saveStammdaten("birthdate")} type="date" />
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Konditionen (sensibel — mit Bestätigungsdialog)</p>
                <Field label="Kreditlimit (approved_limit, €)" value={app.approvedLimit != null ? String(app.approvedLimit) : ""} onSave={saveKondition("approvedLimit")} sensitive type="number" />
                <Field label="Betrag (amount_due, €)" value={app.amountDue != null ? Number(app.amountDue).toFixed(2) : ""} onSave={saveKondition("amountDue")} sensitive type="number" />
                <Field label="Zahlungsfrist (JJJJ-MM-TT)" value={app.paymentDueDate ? String(app.paymentDueDate).slice(0, 10) : ""} onSave={saveKondition("paymentDueDate")} sensitive type="date" />
                <div className="py-2">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Paket</p>
                  <div className="flex items-center gap-2 mt-1">
                    <select
                      value={app.packKey || ""}
                      onChange={(e) => {
                        if (!e.target.value || e.target.value === app.packKey) return;
                        if (!confirm(`Paket wirklich ändern?\n\nAlt: ${app.packName || "—"}\nNeu: ${e.target.value}\n\nDer Betrag wird bewusst NICHT automatisch angepasst.`)) { e.target.value = app.packKey || ""; return; }
                        saveKondition("packKey")(e.target.value);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[13px] bg-white"
                    >
                      <option value="">{app.packName || "— Paket wählen —"}</option>
                      {["start", "pro", "ultra", "highend", "business_starter", "business_pro", "business_ultra", "business_enterprise"].map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </Section>
          ) : (
            <Section title="Stammdaten (Lead — noch kein Antrag)" icon={User}>
              <p className="text-[12.5px] text-slate-500 mb-3">
                Diese Person existiert bisher nur als Lead. Kontaktdaten änderst du hier; sobald ein Antrag entsteht,
                verknüpft die Prävention (P1) ihn automatisch mit dieser Akte.
              </p>
              {(data.leads || []).slice(0, 1).map((l: any) => (
                <div key={l.id}>
                  <Field label="Vorname" value={l.vorname || ""} onSave={async (v) => { const r = await api(`/admin/leads/${l.id}/contact-data`, { vorname: v }, "PATCH"); if (!r.ok) return r.json?.error || "Fehler"; load(); return null; }} />
                  <Field label="Nachname" value={l.nachname || ""} onSave={async (v) => { const r = await api(`/admin/leads/${l.id}/contact-data`, { nachname: v }, "PATCH"); if (!r.ok) return r.json?.error || "Fehler"; load(); return null; }} />
                  <Field label="E-Mail" value={l.email || ""} onSave={async (v) => { const r = await api(`/admin/leads/${l.id}/contact-data`, { email: v }, "PATCH"); if (!r.ok) return r.json?.error || "Fehler"; load(); return null; }} sensitive />
                  <Field label="Telefon" value={l.telefon || ""} onSave={async (v) => { const r = await api(`/admin/leads/${l.id}/contact-data`, { telefon: v }, "PATCH"); if (!r.ok) return r.json?.error || "Fehler"; load(); return null; }} placeholder="+49 …" />
                </div>
              ))}
            </Section>
          )}

          {/* ── AGENT & BETREUUNG ── */}
          <Section title="Agent & Betreuung" icon={Users}>
            {app && (
              <div className="mb-3">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Zugewiesener Agent (Bestellung)</p>
                <select
                  value={head.agentId || ""}
                  onChange={(e) => reassignAgent(e.target.value)}
                  disabled={busy === "agent"}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 text-[13px] bg-white"
                >
                  <option value="">— kein Agent —</option>
                  {(data.agents || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <div className="mb-3">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Provisions-Lage</p>
              {data.commissions.length > 0 ? (
                <div className="space-y-1">
                  {data.commissions.map((c: any) => (
                    <p key={c.id} className="text-[12.5px] text-slate-700">
                      <b>{eur(c.amount_cents / 100)}</b> · {c.agent_name || `Agent #${c.agent_id}`} · {c.kind === "override" ? "Override" : "eigen"} · {c.status}
                      <span className="text-slate-400"> ({fmtD(c.created_at)}, {c.ref})</span>
                    </p>
                  ))}
                </div>
              ) : head.commissionBasis === "direktzahler" ? (
                <p className="text-[12.5px] text-slate-500">Direktzahler — keine Provision (keine dokumentierte Betreuung vor Zahlung).</p>
              ) : app?.paymentStatus === "paid" ? (
                <p className="text-[12.5px] text-amber-700">
                  Bezahlt, aber keine Provision gebucht — <a href="/admin/nachbuchung" className="font-semibold text-[#2563eb] hover:underline">im Nachbuchungs-Center prüfen</a>.
                </p>
              ) : (
                <p className="text-[12.5px] text-slate-400">Noch keine Provision (Bestellung nicht bezahlt).</p>
              )}
            </div>
            {(data.leads || []).length > 0 && (
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Leads dieser Person</p>
                <div className="space-y-2">
                  {data.leads.map((l: any) => (
                    <div key={l.id} className="px-3 py-2 rounded-lg border border-slate-100 bg-slate-50/60">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[12.5px] font-semibold text-slate-700">
                          Lead #{l.id} · {l.status}{l.quelle ? ` · ${l.quelle}` : ""}{l.kampagne ? ` · ${l.kampagne}` : ""}
                          <span className="text-slate-400 font-normal"> · seit {fmtD(l.erstelltAm)}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <select
                            value={l.agentId || ""}
                            onChange={(e) => assignLeadAgent(l.id, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-200 text-[11.5px] bg-white"
                          >
                            <option value="">— Agent —</option>
                            {(data.agents || []).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                          {!l.convertedOrderId && ref && (
                            <button type="button" onClick={() => attachLead(l.id)} disabled={busy === `attach-${l.id}`}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11.5px] font-bold text-slate-600 hover:border-slate-300">
                              Mit Akte verknüpfen
                            </button>
                          )}
                        </div>
                      </div>
                      {l.convertedOrderId && <p className="text-[11px] text-slate-400 mt-0.5">konvertiert → {l.convertedOrderId}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* ── WARUM DIESER STATUS? ──────────────────────────────────────
              Schluss mit Raten: welche Bestellung, welches Ereignis, welches
              Datum den Status bestimmt. Ein Status ohne Begründung ist eine
              Behauptung — und genau daran ist am 07.08. ein Kunde als „bezahlt"
              missverstanden worden. */}
          {head.status?.warum && (
            <Section title="Warum dieser Status?" icon={Info}>
              <div className="space-y-2">
                <p className="text-[13px] text-slate-800">
                  <b>{head.status.anzeige}</b>
                  {head.status.hinweis ? <span className="text-slate-500"> — {head.status.hinweis}</span> : null}
                </p>
                <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-[12.5px]">
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Maßgebliche Bestellung</dt>
                    <dd className="text-slate-800 font-mono text-[12px]">
                      {head.status.warum.verwendungszweck || head.status.warum.ref || "—"}
                      {head.status.warum.paket ? <span className="font-sans text-slate-500"> · {head.status.warum.paket}</span> : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Letztes Ereignis</dt>
                    <dd className="text-slate-800">
                      {head.status.warum.ereignis || "—"}
                      {head.status.warum.ereignisAm ? <span className="text-slate-500"> · {fmtDT(head.status.warum.ereignisAm)}</span> : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Zahlungsstand (roh)</dt>
                    <dd className="text-slate-800 font-mono text-[12px]">{head.status.warum.zahlungsstatus || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Frist</dt>
                    <dd className="text-slate-800">
                      {head.status.warum.frist ? fmtD(head.status.warum.frist) : "—"}
                      {head.status.etikett ? <span className="text-rose-600 font-semibold"> · {head.status.etikett}</span> : null}
                    </dd>
                  </div>
                </dl>
                <p className="text-[12px] text-slate-500 leading-snug">{head.status.warum.begruendung}</p>
              </div>
            </Section>
          )}

          {/* ── ZAHLUNGEN ── */}
          <Section title="Zahlungen — alle Bestellungen dieser Person" icon={CreditCard}>
            {/* Produktstand in EINER Zeile. Ein Konto hat genau eine Stufe; alles
                andere ist Zusatzprodukt oder stillgelegt. Vorher standen hier
                fünf Bestellungen gleichwertig untereinander. */}
            {head.produkt && (
              <div className="mb-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">Produktstand</p>
                <p className="text-[14px] font-bold text-slate-900">{head.produkt.text}</p>
                {head.produkt.mehrfachStufe && (
                  <p className="text-[12px] text-rose-700 font-semibold mt-0.5">
                    Zwei offene Stufen — das darf nicht sein. Bitte über die Produkt-Hygiene bereinigen.
                  </p>
                )}
                {head.produkt.stillgelegt?.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="text-[12px] text-slate-500 cursor-pointer">
                      {head.produkt.stillgelegt.length} stillgelegte oder archivierte Bestellung(en)
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {head.produkt.stillgelegt.map((s: any) => (
                        <li key={s.ref} className="text-[11.5px] text-slate-500">
                          <span className="font-mono">{s.ref}</span> · {s.name} · {s.grund}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {data.orders.length === 0 && <p className="text-[12.5px] text-slate-400">Noch keine Bestellung.</p>}
            <div className="space-y-2">
              {gewaehlteRefs.size > 0 && (
                <div className="mb-2 px-3 py-2.5 rounded-xl flex flex-wrap items-center gap-2"
                     style={{ background: "rgba(29,78,216,.05)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.18)" }}>
                  <span className="text-[12.5px] font-bold text-[#1d4ed8]">
                    {gewaehlteRefs.size} gewählt
                  </span>
                  <button type="button" onClick={() => setGewaehlteRefs(new Set())}
                          className="text-[12px] font-semibold text-slate-500">Auswahl aufheben</button>
                  <button type="button"
                          onClick={async () => {
                            const r = await fetch("/api/fiaon/admin/bestellungen/vorschau", {
                              method: "POST", credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ refs: Array.from(gewaehlteRefs) }),
                            }).catch(() => null);
                            const j = await r?.json().catch(() => null);
                            if (j?.ok) { setBestellDialog(j); setBestellWortlaut(""); }
                          }}
                          className="ml-auto px-3.5 py-2 rounded-xl text-[12px] font-bold text-white bg-[#b91c1c]"
                          style={{ boxShadow: "0 10px 22px -12px rgba(185,28,28,.5)" }}>
                    Auswahl entfernen …
                  </button>
                </div>
              )}
              {data.orders.map((o: any) => (
                <div key={o.ref} className={`px-3 py-2.5 rounded-xl border ${o.isPrimary ? "border-slate-300 bg-white" : "border-slate-100 bg-slate-50/60"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center shrink-0 mr-1"
                           style={{ minWidth: 22, minHeight: 22 }}>
                      <input type="checkbox" aria-label={`${o.paymentReference || o.ref} wählen`}
                             checked={gewaehlteRefs.has(o.ref)}
                             onChange={() => setGewaehlteRefs((g) => {
                               const n = new Set(g);
                               n.has(o.ref) ? n.delete(o.ref) : n.add(o.ref);
                               return n;
                             })} />
                    </label>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-slate-800">
                        <span className="font-mono text-[#2563eb]">{o.paymentReference || o.ref}</span>
                        {o.invoiceNumber && <span className="ml-2 text-[11px] text-slate-400 font-mono">{o.invoiceNumber}</span>}
                      </p>
                      <p className="text-[11.5px] text-slate-400">
                        {o.packName ? `${String(o.packName).replace(/\n/g, " ")} · ` : ""}{eur(o.amountDue)} · angelegt {fmtD(o.createdAt)}
                        {o.claimedPaidAt ? ` · angekündigt ${fmtDT(o.claimedPaidAt)}` : ""}
                        {o.paymentDueDate && o.paymentStatus !== "paid" ? ` · Frist ${fmtD(o.paymentDueDate)}` : ""}
                        {o.mergedInto ? ` · zusammengeführt in ${o.mergedInto}` : ""}
                        {o.supersededBy ? ` · ersetzt durch ${o.supersededBy}` : ""}
                        {o.agentName ? ` · Agent: ${o.agentName}` : ""}
                      </p>
                      {/* Archiv (08.08.2026): Eine archivierte Bestellung bleibt
                          hier lesbar — mit Grund und Namen. Sie aus der Akte zu
                          verstecken wäre genau das, was wir abschaffen. */}
                      {o.archiviertAm && (
                        <p className="text-[11.5px] text-slate-500 mt-0.5">
                          Im Archiv seit {fmtD(o.archiviertAm)}
                          {o.archivGrund ? ` · ${ARCHIV_GRUND_TEXT[o.archivGrund] ?? o.archivGrund}` : ""}
                          {o.archiviertVon ? ` · ${o.archiviertVon}` : ""}
                          {o.archivNotiz ? ` — ${o.archivNotiz}` : ""}
                        </p>
                      )}
                    </div>
                    {/* `flex-wrap`: Marke, Rechnung und „Archivieren" standen in
                        einer Zeile, die nicht umbrechen durfte — auf 380 px
                        zusammen 409 px breit, der rechte Rand fiel weg. */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <PayBadge status={o.paymentStatus} />
                      {o.archiviertAm && (
                        <span className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-500">
                          Archiv
                        </span>
                      )}
                      {o.paymentReference && (
                        <a href={`/api/fiaon/admin/payments/${encodeURIComponent(o.paymentReference)}/invoice.pdf`} target="_blank" rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-slate-300" title="Rechnung (PDF)">
                          <FileText size={12} className="inline" />
                        </a>
                      )}
                      {/* Gesperrt bei bezahlt oder gebuchter Provision — die
                          Begründung steht im Dialog, nicht als stummer Klick. */}
                      <button type="button" onClick={() => setArchivRef(o.ref)}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-slate-300">
                        {o.archiviertAm ? "Archiv ansehen" : "Archivieren"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.bankTxns.length > 0 && (
              <div className="mt-4">
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Bankeingänge (Kontoabgleich)</p>
                <div className="space-y-1.5">
                  {data.bankTxns.map((t: any) => (
                    <p key={t.id} className="text-[12px] text-slate-600">
                      <b>{eur(t.amount_cents / 100)}</b> · {t.payer_name || "—"} · {fmtD(t.booked_at)} ·{" "}
                      {t.applied ? <span className="text-emerald-600 font-semibold">verbucht</span> : <span className="text-amber-600 font-semibold">zugeordnet, nicht verbucht</span>}
                      {t.amount_ok === false && <span className="text-rose-600 font-semibold"> · Betrag weicht ab</span>}
                    </p>
                  ))}
                </div>
                <a href="/admin/kontoabgleich" className="inline-block mt-1.5 text-[11.5px] font-semibold text-[#2563eb] hover:underline">→ Zum Kontoabgleich (verbuchen)</a>
              </div>
            )}
          </Section>

          {/* ── DOKUMENTE ──────────────────────────────────────────────────
              Bis zum 10.08.2026 gab es in der Akte KEINE Dokumentansicht: Ob
              ein Ausweis vorliegt, stand nirgends — man musste raten oder im
              Kundenportal nachsehen. Eine Lücke sieht hier jetzt aus wie eine
              Lücke, mit Knopf zum Anfordern. */}
          <Section title="Dokumente — Ausweis, Kontoauszug, Bonitätsauskunft" icon={FileText}>
            {app?.ref ? (
              // Die Betreiberansicht liest über die REFERENZ — die steht immer
              // zur Verfügung. `personId` ist nur für „Anfordern" nötig.
              <DokumenteSektion
                personId={Number(app?.personId ?? 0) || 0}
                kundenRef={app.ref}
                adminSicht
              />
            ) : (
              <p className="text-[12.5px] text-slate-400">
                Für einen Lead ohne Bestellung gibt es noch keine Unterlagen.
              </p>
            )}
          </Section>

          {/* ── ANRUFE ─────────────────────────────────────────────────── */}
          {app?.personId && <AnrufeSektion personId={Number(app.personId)} />}

          {/* ── E-MAIL-CENTER ── */}
          <Section title="E-Mail-Center — jedes Kunden-Event mit Vorschau" icon={Mail}>
            {!payRef ? (
              <p className="text-[12.5px] text-slate-400">Kundengebundene Events brauchen eine Bestellung (Zahlungsreferenz).{openLeads.length > 0 ? " Für Leads gibt es den Antrags-Link-Versand unten." : ""}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-3">
                {events.map((ev) => (
                  <button key={ev.type} type="button" onClick={() => previewEvent(ev)} disabled={busy === `ev-${ev.type}`}
                    title={ev.description}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50">
                    {ev.label}
                  </button>
                ))}
              </div>
            )}
            {/* Die Warnzeile ist ersatzlos weg (09.08.2026). Sie behauptete, ein
                Zweig fehle, weil in unserer eigenen Beschreibung ein Notizwort
                stand — und lag bei 23 von 33 Ereignissen falsch. Der gemessene
                Stand steht unter „E-Mail-Events" und im Sende-Menü. */}
            {openLeads.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {openLeads.map((l: any) => (
                  <button key={l.id} type="button" disabled={busy === `leadlink-${l.id}`}
                    onClick={() => act(`leadlink-${l.id}`, () => api(`/admin/leads/${l.id}/send-application-link`, {}), "✓ Antrags-Link an Lead gesendet.")}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-300 disabled:opacity-50">
                    Antrags-Link an Lead #{l.id} senden
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Versand-Historie dieser Person</p>
            {data.emailHistory.length === 0 ? (
              <p className="text-[12px] text-slate-400">Noch kein Versand protokolliert.</p>
            ) : (
              <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                {data.emailHistory.map((m: any, i: number) => (
                  <p key={i} className="text-[12px] text-slate-600">
                    <span className="text-slate-400 tabular-nums">{fmtDT(m.at)}</span> — {m.label}
                  </p>
                ))}
              </div>
            )}
          </Section>

          {/* ── NOTIZEN & AUFGABEN ──────────────────────────────────────────
              Steht bewusst weit oben, direkt nach den harten Fakten: Was an
              dieser Person zu tun ist, muss man sehen, bevor man handelt — nicht
              erst nach dem Scrollen durch Zahlungen und Dubletten. */}
          <VermerkTafel
            ziel={{
              ref: data.head?.ref || (id.startsWith("lead-") ? null : id),
              leadId: id.startsWith("lead-") ? Number(id.replace("lead-", "")) : null,
              name: head.name,
            }}
            onMeldung={flash}
          />

          {/* ── DUBLETTEN ── */}
          <Section title="Dubletten — Zusammenführen statt Löschen" icon={Copy} warn={head.duplicateSuspicion}>
            <p className="text-[11.5px] text-slate-500 mb-3">
              Zusammenführen statt Löschen — das Ergebnis ist dasselbe (EIN Eintrag), aber die Zahlungs- und
              Provisionshistorie bleibt beweisbar. Jeder Merge ist per Undo exakt umkehrbar.
            </p>
            {data.duplicates.family.length > 1 ? (
              <div className="mb-3">
                <div className="space-y-1.5 mb-2">
                  {data.duplicates.family.map((f: any) => (
                    <p key={f.ref} className="text-[12.5px] text-slate-700">
                      <span className="font-mono">{f.paymentReference || f.ref}</span> · {f.name} · <PayBadge status={f.paymentStatus} />
                      {f.ref === data.duplicates.suggestedWinner && <span className="ml-1.5 text-[10.5px] font-bold text-emerald-600">← Gewinner-Vorschlag</span>}
                    </p>
                  ))}
                </div>
                <button type="button" onClick={mergeFamily} disabled={busy === "merge"}
                  className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-[12.5px] font-bold disabled:opacity-50">
                  {busy === "merge" ? "…" : "1-Klick zusammenführen (mit Undo)"}
                </button>
              </div>
            ) : (
              <p className="text-[12.5px] text-slate-400 mb-3">Keine sicheren Dubletten in dieser Akte.</p>
            )}
            {lastMergeBatch && (
              <button type="button" onClick={undoMerge} disabled={busy === "undo"}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-bold text-slate-600 hover:border-slate-300 mb-3">
                <Undo2 size={13} /> Letzten Merge rückgängig machen
              </button>
            )}
            {data.duplicates.nameSuspects.length > 0 && (
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Unsichere Namens-Treffer (zur Prüfung)</p>
                {data.duplicates.nameSuspects.map((s: any) => (
                  <p key={s.ref} className="text-[12px] text-slate-600">
                    <Link href={`/admin/kunde/${encodeURIComponent(s.ref)}`} className="font-semibold text-[#2563eb] hover:underline">{s.name}</Link>
                    {" "}· {s.email || "keine E-Mail"} · <PayBadge status={s.payment_status} /> · {fmtD(s.created_at)}
                  </p>
                ))}
                <a href="/admin/dubletten" className="inline-block mt-1.5 text-[11.5px] font-semibold text-[#2563eb] hover:underline">→ Zur Dubletten-Prüfung</a>
              </div>
            )}
          </Section>
        </div>

        {/* ── NOTIZ + VERLAUF ── */}
        <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-900 mb-4">
            <Clock size={15} className="text-slate-400" /> Verlauf — alles chronologisch (Berlin-Zeit)
          </h2>
          {(ref || (data.leads || []).length > 0) && (
            <div className="flex gap-2 mb-4">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addNote(); }}
                placeholder="Notiz für den Verlauf …"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
              />
              <button type="button" onClick={addNote} disabled={busy === "note" || !note.trim()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-[12.5px] font-bold text-slate-600 hover:border-slate-300 disabled:opacity-40">
                <StickyNote size={13} /> Speichern
              </button>
            </div>
          )}
          {data.timeline.length === 0 ? (
            <p className="text-[12.5px] text-slate-400">Noch keine Ereignisse.</p>
          ) : (
            <div className="space-y-2.5">
              {data.timeline.slice(0, timelineLimit).map((t: any, i: number) => (
                <div key={i} className={`flex gap-3 ${t.voided ? "opacity-40 line-through" : ""}`}>
                  <p className="w-32 shrink-0 text-[11px] text-slate-400 tabular-nums pt-0.5">{fmtDT(t.at)}</p>
                  <div className="min-w-0">
                    <p className="text-[12.5px] text-slate-700">
                      <b>{t.actor}</b>
                      <span className="text-slate-400"> · {t.scope === "lead" ? `Lead #${t.leadId}` : t.ref} · {t.type}{t.outcome ? ` (${t.outcome})` : ""}</span>
                    </p>
                    {t.note && <p className="text-[12px] text-slate-500 break-words">{t.note}</p>}
                  </div>
                </div>
              ))}
              {data.timeline.length > timelineLimit && (
                <button type="button" onClick={() => setTimelineLimit((n) => n + 50)}
                  className="text-[12px] font-semibold text-[#2563eb] hover:underline">
                  Mehr anzeigen ({data.timeline.length - timelineLimit} weitere)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Event-Vorschau (Bestätigungsdialog) ── */}
      {eventPreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center px-4" onClick={() => setEventPreview(null)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">„{eventPreview.label}" senden?</h3>
            <p className="text-[13px] text-slate-600 mb-3">
              An <b>{eventPreview.customer}</b> ({eventPreview.email}) — Status: {eventPreview.status}
            </p>
            {eventPreview.verifikation && eventPreview.verifikation !== "bestaetigt" && (
              <p className="text-[12px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mb-3">
                Für dieses Ereignis ist noch nicht geprüft, ob eine Mail wirklich ankommt. Der Versand geht
                trotzdem raus — ob er zugestellt wird, siehst du danach im Protokoll. Prüfen unter E-Mail-Events.
              </p>
            )}
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1">Payload (Vorschau)</p>
            <pre className="text-[11px] bg-slate-50 border border-slate-100 rounded-lg p-3 overflow-x-auto mb-4">{JSON.stringify(eventPreview.payload, null, 2)}</pre>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setEventPreview(null)} className="px-4 py-2.5 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600">Abbrechen</button>
              <button type="button" onClick={confirmEvent} disabled={busy === `evsend-${eventPreview.eventType}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-[13px] font-bold disabled:opacity-50">
                <Send size={13} /> Jetzt senden
              </button>
            </div>
          </div>
        </div>
      )}

        {/* ── Bestellungen entfernen ────────────────────────────────────
          Dieselbe Bauweise wie die Personen-Löschung: zwei Kategorien
          getrennt gezählt, Begründung je Zeile, Bestätigung durch
          wörtliches Eintippen. */}
      <FiaonEbene
        offen={!!bestellDialog}
        onZu={() => setBestellDialog(null)}
        titel="Was mit diesen Bestellungen passiert"
        ueberschrift="Bitte genau lesen"
        breite={580}
        fuss={bestellDialog ? (
          <>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
              Zur Bestätigung eintippen:{" "}
              <span className="font-mono text-slate-900">{bestellDialog.bestaetigung}</span>
            </label>
            <input value={bestellWortlaut} onChange={(e) => setBestellWortlaut(e.target.value)}
                   aria-label="Bestätigungstext"
                   className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none focus:border-[#b91c1c]"
                   style={{ minHeight: 42 }} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setBestellDialog(null)}
                      className="text-[13px] font-semibold text-slate-500">Abbrechen</button>
              <button type="button"
                      disabled={bestellWortlaut.trim() !== bestellDialog.bestaetigung}
                      onClick={async () => {
                        const r = await fetch("/api/fiaon/admin/bestellungen/entfernen", {
                          method: "POST", credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            refs: Array.from(gewaehlteRefs),
                            bestaetigung: bestellWortlaut,
                          }),
                        }).catch(() => null);
                        const j = await r?.json().catch(() => null);
                        if (j?.ok) {
                          setBestellDialog(null);
                          setGewaehlteRefs(new Set());
                          void load();
                        }
                      }}
                      className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#b91c1c] disabled:opacity-30"
                      style={{ boxShadow: "0 12px 26px -12px rgba(185,28,28,.55)" }}>
                Ausführen
              </button>
            </div>
          </>
        ) : undefined}
        kinder={bestellDialog ? (
          <>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-3.5 rounded-2xl"
                   style={{ background: "linear-gradient(160deg, rgba(185,28,28,.09), rgba(185,28,28,.03))",
                            boxShadow: "inset 0 0 0 1px rgba(185,28,28,.16)" }}>
                <p className="text-[26px] font-bold leading-none text-[#b91c1c] tabular-nums">
                  {bestellDialog.endgueltig}
                </p>
                <p className="text-[11.5px] font-semibold mt-1 text-[#b91c1c]">endgültig entfernt</p>
              </div>
              <div className="p-3.5 rounded-2xl"
                   style={{ background: "linear-gradient(160deg, rgba(217,119,6,.09), rgba(217,119,6,.03))",
                            boxShadow: "inset 0 0 0 1px rgba(217,119,6,.16)" }}>
                <p className="text-[26px] font-bold leading-none text-[#b45309] tabular-nums">
                  {bestellDialog.archivieren}
                </p>
                <p className="text-[11.5px] font-semibold mt-1 text-[#b45309]">archiviert</p>
              </div>
            </div>
            {bestellDialog.hinweise.map((h: string, i: number) => (
              <p key={i} className="text-[12.5px] leading-relaxed text-slate-600 mb-2.5">{h}</p>
            ))}
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
              Im Einzelnen
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
              {bestellDialog.kandidaten.map((k: any) => (
                <div key={k.ref} className="px-3.5 py-2.5 text-[12px]"
                     style={{ borderBottom: "1px solid #f8fafc" }}>
                  <span className="font-mono font-semibold text-slate-800">{k.ref}</span>
                  <span className="ml-2 font-bold" style={{
                    color: k.art === "endgueltig" ? "#b91c1c" : k.art === "archivieren" ? "#b45309" : "#94a3b8",
                  }}>
                    {k.art === "endgueltig" ? "endgültig" : k.art === "archivieren" ? "archiviert" : "übersprungen"}
                  </span>
                  {k.betrag && <span className="ml-2 text-slate-500">{k.betrag}</span>}
                  <span className="block text-[11px] text-slate-400 leading-snug mt-0.5">{k.begruendung}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      />

      {/* Archiv-Dialog: archivieren und (nur hier, im Admin) zurückholen. */}
      {archivRef && (
        <ArchivDialog
          bestellung={archivRef}
          offen={true}
          aufSchliessen={() => setArchivRef(null)}
          aufFertig={() => { void load(); flash("Archiv aktualisiert."); }}
          pfade={{
            pruefung: "/admin/antraege/:ref/archiv-pruefung",
            archivieren: "/admin/antraege/:ref/archivieren",
            wiederherstellen: "/admin/antraege/:ref/wiederherstellen",
          }}
        />
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ANRUFE — was am Telefon besprochen wurde
//
// Zeigt Dauer, Ergebnis und die automatische Zusammenfassung. Ist die
// Transkription gescheitert, steht der Grund da UND ein Knopf zum Nachholen —
// ein Fehlschlag, den man nur ansehen kann, ist eine Sackgasse.
// ═══════════════════════════════════════════════════════════════════════════
function AnrufeSektion({ personId }: { personId: number }) {
  const [anrufe, setAnrufe] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/telefon/person/${personId}/anrufe`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setAnrufe(j?.ok ? j.anrufe : []);
  }, [personId]);
  useEffect(() => { void laden(); }, [laden]);

  if (!anrufe || anrufe.length === 0) return null;

  return (
    <Section title="Anrufe — Dauer, Ergebnis, Zusammenfassung" icon={FileText}>
      {anrufe.map((a) => (
        <div key={a.id} className="py-2.5" style={{ borderBottom: "1px solid #f8fafc" }}>
          <div className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
            <span className="font-semibold text-slate-800">
              {new Date(a.beginn).toLocaleString("de-DE", {
                day: "2-digit", month: "2-digit", year: "2-digit",
                hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
              })}
            </span>
            {a.dauer_sek != null && (
              <span className="text-slate-500 tabular-nums">
                {Math.floor(a.dauer_sek / 60)}:{String(a.dauer_sek % 60).padStart(2, "0")} Min
              </span>
            )}
            {a.agent && <span className="text-slate-400">{a.agent}</span>}
            {a.ergebnis
              ? <span className="font-semibold text-emerald-700">{a.ergebnis}</span>
              : <span className="font-semibold text-amber-700">Ergebnis fehlt</span>}
          </div>
          {a.zusammenfassung && (
            <p className="text-[12.5px] text-slate-600 leading-relaxed mt-1">{a.zusammenfassung}</p>
          )}
          {a.transkript_status === "fehlgeschlagen" && (
            <p className="text-[11.5px] text-slate-400 mt-1">
              {a.transkript_grund}
              <button type="button" disabled={busy === a.id}
                      onClick={async () => {
                        setBusy(a.id);
                        await fetch(`/api/fiaon/telefon/${a.id}/nachbereiten`, {
                          method: "POST", credentials: "include",
                        }).catch(() => {});
                        setBusy(null);
                        void laden();
                      }}
                      className="ml-2 font-semibold text-[#2563eb] underline disabled:opacity-40">
                {busy === a.id ? "läuft …" : "nachholen"}
              </button>
            </p>
          )}
        </div>
      ))}
    </Section>
  );
}
