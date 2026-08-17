import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Phone, Check, Clock, X, StickyNote, CalendarClock, ExternalLink } from "lucide-react";
import { AgentShell, Card, Badge, FlashMessage, api, fmtDT, fmtTime, inputCls, btnPrimary, btnGhost } from "./shared";
import { Reveal } from "./motion";

// ============================================================================
// /agent/kalender (J1) — Tages-/Wochenansicht der eigenen Rückruf-Termine
// und Zahlungs-Zusagen. Überfällige oben (dezenter Rahmen, kein Alarm-Rot).
// Erledigen/Verschieben direkt hier (erzeugt Log-Einträge).
// ============================================================================

interface Appointment {
  id: number;
  ref: string;
  payment_reference?: string | null;
  outcome: string | null;
  scheduled_at: string | null;
  promised_date: string | null;
  note: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  payment_status: string;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  // ── DIE HERKUNFT REIST MIT ──────────────────────────────────────────────
  // Diese Liste mischt ZWEI Tabellen: eigene Notizen (fiaon_contact_log) und
  // Termine, die der KUNDE gebucht hat (fiaon_termine). Beide zählen ihre
  // Kennungen ab 1 hoch.
  //
  // GEMESSEN am 16.08.2026: 101 Termine tragen eine Kennung, die auch ein
  // Verlaufseintrag trägt — bei 33 davon gehört der Verlaufseintrag einem
  // ANDEREN Menschen. Der Haken rief blind `/agent/calendar/:id/done`, also
  // den Weg für Verlaufseinträge. Ein Klick auf einen Kundentermin hätte den
  // Rückruf eines fremden Kunden als erledigt abgestempelt.
  //
  // Der Kommentar im Server sagte schon „der Client unterscheidet über
  // quelle" — der Client tat es nur nicht.
  art?: "verlauf" | "termin";
  schluessel?: string;
  status?: string;
  abgesagt?: boolean;
  absageText?: string | null;
  buchungsquelle?: string;
  person_id?: number | null;
}

function apptName(a: Appointment): string {
  return a.company_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || a.ref;
}

function apptPhone(a: Appointment): string | null {
  if (a.phone) return `${a.phone_country_code || ""}${a.phone}`.replace(/\s/g, "");
  return a.contact_phone ? a.contact_phone.replace(/\s/g, "") : null;
}

function apptTime(a: Appointment): Date {
  return new Date(a.scheduled_at || a.promised_date || 0);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export default function AgentKalenderPage() {
  return (
    <AgentShell>
      <KalenderContent />
    </AgentShell>
  );
}

function KalenderContent() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"tag" | "woche">("tag");
  const [message, setMessage] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<{ id: number; value: string } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // #17: angeklickter Termin → Detail-Popup (mobil Bottom-Sheet)
  const [detail, setDetail] = useState<Appointment | null>(null);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const load = useCallback(() => {
    api("/agent/calendar").then((r) => {
      if (r.ok) {
        // ── ZWEI QUELLEN, EINE LISTE ──────────────────────────────────────
        // `data` sind die eigenen Notizen (Rückrufe, Zusagen).
        // `gebuchteTermine` sind die, die der KUNDE selbst über seinen
        // Buchungslink gewählt hat. Sie standen bis zum 11.08.2026 in einer
        // eigenen Tabelle und tauchten hier NICHT auf: Der Kunde bekam eine
        // Bestätigung mit Uhrzeit, hielt sie ein — und der Agent wusste
        // nichts davon. Ein Termin, von dem nur eine Seite weiß, ist keiner.
        setAppointments([...(r.json.data ?? []), ...(r.json.gebuchteTermine ?? [])]);
      }
      setLoading(false);
    });
  }, []);
  useEffect(load, [load]);

  const now = new Date();
  const { overdue, today, week } = useMemo(() => {
    const overdue = appointments.filter((a) => apptTime(a) < now && dayKey(apptTime(a)) !== dayKey(now));
    const today = appointments.filter((a) => dayKey(apptTime(a)) === dayKey(now));
    const week: { key: string; label: string; items: Appointment[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const key = dayKey(d);
      const items = appointments.filter((a) => dayKey(apptTime(a)) === key);
      week.push({
        key,
        label: i === 0 ? "Heute" : i === 1 ? "Morgen" : `${WEEKDAYS[d.getDay()]}, ${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`,
        items,
      });
    }
    return { overdue, today, week };
  }, [appointments]);

  /**
   * Erledigt — auf dem Weg, der zur HERKUNFT gehört.
   *
   * Ein Kundentermin liegt in `fiaon_termine` und wird über
   * `/agent/termine/:id/ergebnis` abgeschlossen. Ein eigener Rückruf liegt in
   * `fiaon_contact_log` und geht über `/agent/calendar/:id/done`. Beide
   * Kennungen überlappen — wer den falschen Weg nimmt, trifft einen fremden
   * Menschen.
   */
  const markDone = async (e: React.MouseEvent, a: Appointment) => {
    e.stopPropagation();
    setBusy(a.id);
    const r = a.art === "termin"
      ? await api(`/agent/termine/${a.id}/ergebnis`, {
          method: "POST", body: JSON.stringify({ ergebnis: "erledigt" }),
        })
      : await api(`/agent/calendar/${a.id}/done`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      flash(r.json?.hinweis || "Termin als erledigt markiert");
      // Sofort aus der Ansicht nehmen, nicht erst nach dem Neuladen: Der
      // Mensch soll sehen, dass sein Klick gewirkt hat.
      setAppointments((v) => v.filter((x) => (x.schluessel ?? String(x.id)) !== (a.schluessel ?? String(a.id))));
      load();
    } else flash(r.json?.error || "Fehler");
  };

  /** Nicht erschienen — zählt als Fehlversuch (bestehende Logik). */
  const markVerpasst = async (e: React.MouseEvent, a: Appointment) => {
    e.stopPropagation();
    if (a.art !== "termin") return;
    setBusy(a.id);
    const r = await api(`/agent/termine/${a.id}/ergebnis`, {
      method: "POST", body: JSON.stringify({ ergebnis: "verpasst" }),
    });
    setBusy(null);
    if (r.ok) {
      flash(r.json?.hinweis || "Als nicht erschienen vermerkt");
      setAppointments((v) => v.filter((x) => (x.schluessel ?? String(x.id)) !== (a.schluessel ?? String(a.id))));
      load();
    } else flash(r.json?.error || "Fehler");
  };

  const doReschedule = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!reschedule?.value) return;
    setBusy(reschedule.id);
    const r = await api(`/agent/calendar/${reschedule.id}/reschedule`, { method: "POST", body: JSON.stringify({ scheduledAt: reschedule.value }) });
    setBusy(null);
    if (r.ok) { flash("Termin verschoben"); setReschedule(null); load(); }
    else flash(r.json?.error || "Fehler");
  };

  const Row = ({ a, showDate }: { a: Appointment; showDate?: boolean }) => {
    const phone = apptPhone(a);
    const isOverdue = apptTime(a) < now;
    return (
      <div
        className={`px-4 py-3 cursor-pointer hover:bg-slate-50/70 transition-colors ${isOverdue ? "border-l-2 border-l-slate-400" : ""}`}
        onClick={() => setDetail(a)}
        role="button"
        title="Termin-Details öffnen"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {/* #17: Name nicht mehr abschneiden (break-words statt truncate) */}
            <p className="text-[13px] font-semibold text-slate-900 break-words">
              <span className="tabular-nums text-slate-500 mr-2">{showDate ? fmtDT(a.scheduled_at || a.promised_date) : fmtTime(a.scheduled_at || a.promised_date)}</span>
              {apptName(a)}
            </p>
            {/* ── DIE ABSAGE STEHT DA, MIT ZEIT UND URHEBER ──────────────
                Bis zum 16.08.2026 verschwand ein abgesagter Termin sofort aus
                jeder Ansicht. Der Zuständige erfuhr es nie und saß zur
                vereinbarten Zeit da. Sieben Tage sichtbar. */}
            {a.absageText && (
              <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#b45309" }}>
                {a.absageText}
              </p>
            )}
            {a.status === "verpasst" && (
              <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#b91c1c" }}>
                Nicht erschienen — bitte abschließen
              </p>
            )}
            <p className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap mt-0.5">
              {/* ── DER KUNDE HAT SELBST GEWÄHLT ──────────────────────────
                  Das ist verbindlicher als eine Notiz, die sich der Agent
                  selbst gemacht hat: Der Kunde hat eine Uhrzeit angeklickt
                  und eine Bestätigung bekommen. Deshalb eine eigene Marke,
                  keine graue Zeile. */}
              {(a as any).quelle === "termin" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold"
                      style={{ background: "rgba(5,150,105,.1)", color: "#047857" }}>
                  Kunde hat gebucht
                </span>
              ) : (
                <span>{a.scheduled_at ? "Rückruf" : "Zahlungs-Zusage"}</span>
              )}
              <Badge status={a.payment_status} />
              {isOverdue && <span className="inline-flex items-center gap-1"><Clock size={10} /> überfällig</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {phone && (
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className={`${btnPrimary} px-3 py-2 inline-flex items-center gap-1.5`}>
                <Phone size={13} strokeWidth={2} />
                <span className="hidden sm:inline">Anrufen</span>
              </a>
            )}
            <button
              type="button"
              // Ein vom Kunden gebuchter Termin wird nicht vom Agenten
              // verschoben: Der Kunde hat die Zeit gewählt, und eine
              // Verschiebung hinter seinem Rücken wäre ein Wortbruch. Er
              // bekommt seinen Absage-Link in der Bestätigungsmail.
              disabled={(a as any).quelle === "termin"}
              title={(a as any).quelle === "termin"
                ? "Diesen Termin hat der Kunde selbst gewählt. Ruf ihn an, wenn er nicht passt."
                : undefined}
              onClick={(e) => { e.stopPropagation(); setReschedule({ id: a.id, value: "" }); }}
              className={`${btnGhost} px-3 py-2 text-[12px] disabled:opacity-30`}
            >
              Verschieben
            </button>
            {/* ── NICHT ERSCHIENEN ──────────────────────────────────────
                Nur bei Kundenterminen: Ein Rückruf, den man sich selbst
                notiert hat, kann nicht „nicht erscheinen". */}
            {a.art === "termin" && !a.abgesagt && (
              <button
                type="button"
                onClick={(e) => markVerpasst(e, a)}
                disabled={busy === a.id}
                title="Kunde ist nicht erschienen — zählt als Fehlversuch"
                className={`${btnGhost} px-3 py-2 text-[12px] disabled:opacity-30`}
              >
                Nicht erschienen
              </button>
            )}
            <button
              type="button"
              onClick={(e) => markDone(e, a)}
              /* Ein abgesagter Termin ist nichts, was man erledigen kann. Er
                 steht nur noch da, damit der Zuständige die Absage SIEHT. */
              disabled={busy === a.id || a.abgesagt === true}
              title={a.abgesagt ? "Dieser Termin ist abgesagt." : "Erledigt"}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-400 flex items-center justify-center transition-colors disabled:opacity-40"
            >
              <Check size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
        {reschedule?.id === a.id && (
          <div className="mt-2.5 flex gap-2">
            <input
              type="datetime-local"
              value={reschedule.value}
              onChange={(e) => setReschedule((r) => (r ? { ...r, value: e.target.value } : r))}
              className={inputCls}
              style={{ maxWidth: 240 }}
            />
            <button type="button" onClick={doReschedule} disabled={!reschedule.value || busy === a.id} className={btnPrimary}>
              Speichern
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); setReschedule(null); }} className={btnGhost}>
              Abbrechen
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl">
      <Reveal index={0} className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-bold tracking-tight">Kalender</h1>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden">
          {(["tag", "woche"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={(e) => { e.stopPropagation(); setView(v); }}
              className={`px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                view === v ? "bg-slate-900 text-white" : "bg-white text-slate-500 hover:text-slate-800"
              }`}
            >
              {v === "tag" ? "Tag" : "Woche"}
            </button>
          ))}
        </div>
      </Reveal>
      <p className="text-[12px] text-slate-400 mb-5">Deine Rückruf-Termine und Zahlungs-Zusagen.</p>
      <FlashMessage message={message} />

      {loading && <p className="py-14 text-center text-[13px] text-slate-400">Lädt …</p>}

      {!loading && overdue.length > 0 && (
        <div className="mb-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Überfällig ({overdue.length})</h2>
          <Card className="divide-y divide-slate-50">
            {overdue.map((a) => <Row key={a.id} a={a} showDate />)}
          </Card>
        </div>
      )}

      {!loading && view === "tag" && (
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">Heute</h2>
          <Card className="divide-y divide-slate-50">
            {today.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-slate-400">Keine Termine heute.</p>}
            {today.map((a) => <Row key={a.id} a={a} />)}
          </Card>
        </div>
      )}

      {!loading && view === "woche" && (
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {week.map((day) => (
            <div key={day.key}>
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">{day.label}</h2>
              <Card className="divide-y divide-slate-50">
                {day.items.length === 0 && <p className="px-4 py-5 text-center text-[12px] text-slate-300">—</p>}
                {day.items.map((a) => <Row key={a.id} a={a} />)}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* #17: Termin-Detail — Desktop zentriert, Handy als Bottom-Sheet */}
      {detail && (
        <div className="agent-scope fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div
            className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <div className="min-w-0">
                {/* Langer Name bricht um, wird nicht abgeschnitten */}
                <p className="text-[16px] font-bold text-slate-900 break-words">{apptName(detail)}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5 break-all">{detail.payment_reference || detail.ref}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)} className="p-2 rounded-lg hover:bg-slate-100 shrink-0" aria-label="Schließen">
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-2.5 text-[13px] text-slate-700">
                <CalendarClock size={16} className="text-slate-400 shrink-0" strokeWidth={1.9} />
                <span className="font-semibold">{fmtDT(detail.scheduled_at || detail.promised_date)} Uhr</span>
                <span className="text-slate-400">(deutsche Zeit)</span>
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px] text-slate-600">
                <span className="text-slate-400">{detail.scheduled_at ? "Rückruf-Termin" : "Zahlungs-Zusage"}</span>
                <Badge status={detail.payment_status} />
              </div>
              {detail.note && (
                <div className="flex items-start gap-2.5 text-[12.5px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <StickyNote size={15} className="text-slate-400 shrink-0 mt-0.5" strokeWidth={1.9} />
                  <p className="whitespace-pre-wrap break-words">{detail.note}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {apptPhone(detail) && (
                  <a href={`tel:${apptPhone(detail)}`} className={`${btnPrimary} px-4 py-2.5 inline-flex items-center gap-1.5`}>
                    <Phone size={14} strokeWidth={2} /> Anrufen
                  </a>
                )}
                <Link href={`/agent/kunden?ref=${encodeURIComponent(detail.ref)}`}
                  className={`${btnGhost} px-4 py-2.5 inline-flex items-center gap-1.5`}>
                  <ExternalLink size={14} strokeWidth={2} /> Zur Kundenakte
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
