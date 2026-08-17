import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, AlertTriangle, Skull, ExternalLink, GraduationCap,
  Presentation, ChevronLeft, ChevronRight, Printer, X,
} from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/funktionen — FUNKTIONS-/SCHULUNGSSEITE (Prompt 2/2 · B)
// (a) Katalog aller Funktionen (gruppiert, mit Klartext + Direktlink),
// (b) Selbsttest „Button → Event → zuletzt gefeuert → Status" (aus der
//     Registry + Versand-Verlauf — kein Versand an echte Kunden),
// (c) Schulungsmodus: große Typo, ein Bereich pro Bildschirm, druckbar.
// (d) Verdrahtungs-Audit (Phase 0): jeder Event-Button gegen die Registry.
// KEINE Geschäftslogik — nur Anzeige/Doku. Nutzt /admin/events/registry.
// ═══════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

interface EventDef {
  type: string;
  label: string;
  description: string;
  customerBound: boolean;
  deprecated?: boolean;
  recommendationOnly?: boolean;
  verifikation?: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
}
interface Registry {
  events: EventDef[];
  lastEvents: Record<string, string>;
  makeWebhookConfigured: boolean;
}

type FnEntry = {
  name: string;
  desc: string;
  href?: string;
  event?: string;
  button?: string;
};
type FnGroup = { title: string; intro: string; items: FnEntry[] };

// ── Katalog (gruppiert nach Bereich). Typografische Quotes „…" bewusst,
//    damit keine ASCII-Anführungszeichen die Strings zerbrechen. ──
const CATALOG: FnGroup[] = [
  {
    title: "Kundenakte",
    intro: "Eine Seite pro Person — hier siehst, änderst und löst du alles aus.",
    items: [
      { name: "Zentrale Kundenakte", desc: "Eine Seite pro Person: Kopf, Stammdaten, Zahlungen, E-Mails, Agent, Verlauf, Dubletten.", href: "/admin/kunden" },
      { name: "Die eine Liste", desc: "Alle Personen (Leads + Kunden vereint), serverseitig paginiert, kombinierbare Filter. Jeder Treffer öffnet die Akte.", href: "/admin/kunden" },
      { name: "Stammdaten bearbeiten", desc: "Name, E-Mail, Telefon, Adresse, Geburtsdatum — jede Änderung mit Audit (alt → neu, wer, wann).", href: "/admin/kunden" },
      { name: "Konditionen ändern", desc: "Limit, Betrag, Zahlungsfrist, Paket — sensible Felder mit Bestätigungsdialog; Betrag bei bezahlter Bestellung gesperrt.", href: "/admin/kunden" },
      { name: "Dubletten zusammenführen", desc: "Gewinner-Vorschlag + 1-Klick-Merge mit Undo. Zusammenführen statt Löschen — Historie bleibt beweisbar.", href: "/admin/dubletten" },
    ],
  },
  {
    title: "Zahlungen",
    intro: "Offene Zahlungen prüfen und freischalten — die Geld-Hooks bleiben unverändert.",
    items: [
      { name: "Als bezahlt markieren", desc: "Schaltet frei, sendet die Bestätigungs-Mail und bucht die Provision. Aus Zahlungszentrale ODER Kundenakte.", href: "/admin/zahlungen", event: "payment_confirmed", button: "Als bezahlt markieren (Zahlungszentrale/Akte)" },
      { name: "Zahlungserinnerung an alle offenen", desc: "Bulk-Versand der Zahlungsdaten-Erinnerung (20/Min, Versandfenster 08–20 Uhr).", href: "/admin/zahlungen", event: "payment_reminder", button: "Zahlungserinnerung an alle offenen" },
      { name: "Stornieren", desc: "Setzt die Bestellung auf storniert, stoppt Erinnerungen, storniert Provisionen (Clawback).", href: "/admin/zahlungen" },
      { name: "Reaktivieren", desc: "Neue 7-Tage-Frist; sendet die Zahlungsdaten erneut.", href: "/admin/zahlungen", event: "payment_details", button: "Reaktivieren (Zahlungszentrale/Akte)" },
      { name: "Kontoabgleich verbuchen", desc: "Bank-Eingang zuordnen und verbuchen — identisch zum Bezahlt-Button (inkl. Provision).", href: "/admin/kontoabgleich", event: "payment_confirmed", button: "Verbuchen (Kontoabgleich)" },
      { name: "Rechnung (PDF)", desc: "Rechnung je Bestellung öffnen/laden; alle Rechnungen als ZIP.", href: "/admin/rechnungen" },
      { name: "Auszahlungen freigeben", desc: "Provisions-Anforderungen des Teams bestätigen oder ablehnen.", href: "/admin/zahlungen#auszahlungen", event: "agent_payout_done", button: "Auszahlung ausführen" },
    ],
  },
  {
    title: "Leads / Warteschlange",
    intro: "Intake, Automatik und die Anruf-Warteschlange der Agenten.",
    items: [
      { name: "Antrags-/Zahlungslink senden", desc: "Schickt dem Lead den Antrags-Link (10-Min-Sperre gegen Doppelversand).", href: "/admin/leads", event: "lead_application_link", button: "Antrag/Zahlungslink senden (Lead)" },
      { name: "Follow-up jetzt senden", desc: "Ein manueller Nachfass für genau diesen Lead (8h-Dedupe).", href: "/admin/leads", event: "lead_followup", button: "Follow-up jetzt (Lead)" },
      { name: "Nachfass-Automatik", desc: "Automatischer Lead-Nachfass an festen Sendezeiten (steuerbar in den Lead-Einstellungen).", href: "/admin/leads", event: "lead_followup", button: "Nachfass-Engine (automatisch)" },
      { name: "Arbeitswarteschlange (Agent)", desc: "Verdeckte Queue, Akte öffnen mit Bestätigung, nur EINE offene Akte gleichzeitig.", href: "/agent/leads" },
      { name: "Aussortieren / Zurückholen", desc: "Lead/Kunde verlässt die Arbeitsliste (nie gelöscht), im Admin unter Aussortiert zurückholbar.", href: "/admin/leads" },
    ],
  },
  {
    title: "E-Mails / Events",
    intro: "Alle Make-Events testen und den Verdrahtungs-Status prüfen — ohne an echte Kunden zu senden.",
    items: [
      { name: "Willkommen", desc: "Feuert automatisch, sobald ein Antrag mit E-Mail abgeschlossen wurde.", href: "/admin/events", event: "welcome", button: "welcome (automatisch)" },
      { name: "Zahlungsdaten", desc: "Feuert beim Übergang zu offen (Bestellung/Reaktivierung), enthält Rechnungs-Link.", href: "/admin/events", event: "payment_details", button: "payment_details (automatisch)" },
      { name: "Überweisung angekündigt", desc: "Feuert, wenn der Kunde Ich habe überwiesen klickt.", href: "/admin/events", event: "claim_received", button: "claim_received (automatisch)" },
      { name: "Nummer-Update-Link", desc: "Bei Kontakt-Ergebnis Nummer falsch — Selbst-Korrektur-Mail an den Kunden.", href: "/admin/events", event: "number_update_request", button: "number_update_request (Kontakt-Ergebnis)" },
      { name: "Test-Versand", desc: "Jedes Event mit Beispiel-Payload an eine Test-Adresse senden (test: true).", href: "/admin/events" },
      { name: "Für echten Kunden senden", desc: "Mit Vorschau + Bestätigung; nur kundengebundene, verdrahtete Events.", href: "/admin/events" },
    ],
  },
  {
    title: "Agent-Portal",
    intro: "Was die Agenten sehen und auslösen — mit sichtbarem Bestätigungsdialog statt Doppel-Tap.",
    items: [
      { name: "Kontakt-Ergebnis dokumentieren", desc: "Ein Tap → Bestätigungsdialog (zeigt die Folge). Rückruf-Termin ist im Dialog eingebettet (deutsche Zeit).", href: "/agent/kunden" },
      { name: "Nummer falsch", desc: "Ein Tap → Dialog: Der Kunde erhält eine E-Mail zur Nummern-Korrektur → Bestätigen.", href: "/agent/leads", event: "number_update_request", button: "Kontakt-Ergebnis Nummer falsch" },
      { name: "Zahlungsdaten-Mail (Agent)", desc: "Ein-Klick-Mail Wie besprochen (10-Min-Sperre pro Kunde).", href: "/agent/kunden", event: "agent_payment_reminder", button: "Zahlungsdaten-E-Mail senden" },
      { name: "Rückruf-Erinnerung", desc: "15 Min vor dem Termin bekommt der Agent eine Erinnerung.", href: "/agent/kalender", event: "agent_callback_reminder", button: "agent_callback_reminder (automatisch)" },
      { name: "Reaktivieren / Akte schließen", desc: "Beide über den modalen Bestätigungsdialog — der Schutz vor Versehen bleibt, wird nur sichtbar.", href: "/agent/kunden" },
    ],
  },
  {
    title: "Team / Provision",
    intro: "Mitarbeiter, Sätze, Auszahlungen und Nachbuchungen.",
    items: [
      { name: "Agent anlegen / einladen", desc: "Neuen Mitarbeiter per E-Mail einladen (Setup-Link 48h gültig).", href: "/admin/team", event: "agent_invite", button: "Agent anlegen" },
      { name: "Passwort zurücksetzen", desc: "Force-Reset oder Passwort vergessen — signierter Link (1h gültig).", href: "/admin/team", event: "agent_password_reset", button: "Passwort zurücksetzen" },
      { name: "Auszahlung ablehnen", desc: "Auszahlungs-Anforderung mit Begründung ablehnen.", href: "/admin/zahlungen#auszahlungen", event: "agent_payout_rejected", button: "Auszahlung ablehnen" },
      { name: "Provision nachbuchen", desc: "Bezahlte Bestellungen ohne Provision erkennen und einzeln/gesammelt buchen.", href: "/admin/team?tab=nachbuchung" },
      { name: "Feedback beantworten / belohnen", desc: "Vorgesetzten-Antwort im Feedback-Thread bzw. Bonus gutschreiben.", href: "/admin/agent-portal", event: "agent_feedback_reply", button: "Feedback-Antwort / Bonus" },
    ],
  },
];

// ── Phase-0 Verdrahtungs-Audit (Button → Event → verdrahtet?) ────────────────
// Systematisch jeder Event-auslösende Button geprüft (server: sendMakeWebhook).
// Ergebnis: KEIN toter/falsch verlinkter Event-Button — jeder gefeuerte Event
// ist in der Registry (server/make-events-registry.ts). Der Zustellstand
// heißt: Code feuert korrekt, aber der Make-Zweig ist noch anzulegen — kein
// Code-Fehler. Der Live-Status steht im Selbsttest.
const WIRING_AUDIT: { button: string; event: string; ort: string; verdrahtet: boolean }[] = [
  { button: "Als bezahlt markieren", event: "payment_confirmed", ort: "Zahlungszentrale / Akte / Kontoabgleich", verdrahtet: true },
  { button: "Zahlungserinnerung an alle", event: "payment_reminder", ort: "Zahlungszentrale", verdrahtet: true },
  { button: "Reaktivieren", event: "payment_details", ort: "Zahlungszentrale / Akte", verdrahtet: true },
  { button: "Antrag/Zahlungslink senden", event: "lead_application_link", ort: "Leads (Admin + Agent)", verdrahtet: true },
  { button: "Follow-up jetzt / Automatik", event: "lead_followup", ort: "Leads", verdrahtet: true },
  { button: "Kontakt-Ergebnis Nummer falsch", event: "number_update_request", ort: "Agent/Admin (Kunde + Lead)", verdrahtet: true },
  { button: "Zahlungsdaten-E-Mail (Agent)", event: "agent_payment_reminder", ort: "Agent-Kundendetail", verdrahtet: true },
  { button: "Agent anlegen / Einladung", event: "agent_invite", ort: "Team", verdrahtet: true },
  { button: "Passwort zurücksetzen", event: "agent_password_reset", ort: "Team / Login", verdrahtet: true },
  { button: "Auszahlung ausführen", event: "agent_payout_done", ort: "Auszahlungen", verdrahtet: true },
  { button: "Auszahlung ablehnen", event: "agent_payout_rejected", ort: "Auszahlungen", verdrahtet: true },
  { button: "Rückruf-Erinnerung", event: "agent_callback_reminder", ort: "Kalender (automatisch)", verdrahtet: true },
  { button: "Feedback beantworten", event: "agent_feedback_reply", ort: "Agent-Updates & Feedback", verdrahtet: true },
  { button: "Feedback-Bonus", event: "agent_feedback_rewarded", ort: "Agent-Updates & Feedback", verdrahtet: true },
];

function fmtDT(iso: string | undefined): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

type Status = "ok" | "warn" | "dead" | "none";
function statusOf(def: EventDef | undefined): Status {
  if (!def) return "none";
  if (def.deprecated) return "dead";
  // Gemessener Stand statt Heuristik: „warn" heißt jetzt „noch nicht als
  // zugestellt nachgewiesen" — eine Aussage über unseren Kenntnisstand.
  if (def.verifikation !== "bestaetigt") return "warn";
  return "ok";
}

function StatusChip({ s }: { s: Status }) {
  if (s === "none") return <span className="text-slate-300 text-[12px]">—</span>;
  if (s === "dead") return <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-slate-400"><Skull size={13} /> veraltet</span>;
  if (s === "warn") return <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-amber-600"><AlertTriangle size={13} /> Zweig nicht bestätigt</span>;
  return <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-600"><CheckCircle2 size={13} /> läuft</span>;
}

export default function AdminFunktionenPage() {
  const [reg, setReg] = useState<Registry | null>(null);
  const [loading, setLoading] = useState(true);
  const [schulung, setSchulung] = useState(false);
  const [slide, setSlide] = useState(0);

  const load = useCallback(() => {
    fetch("/api/fiaon/admin/events/registry", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setReg({ events: j.events || [], lastEvents: j.lastEvents || {}, makeWebhookConfigured: !!j.makeWebhookConfigured }); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const defOf = (type?: string) => (type ? reg?.events.find((e) => e.type === type) : undefined);

  const selfTest = CATALOG.flatMap((g) =>
    g.items.filter((it) => it.event).map((it) => ({
      area: g.title,
      button: it.button || it.name,
      event: it.event as string,
      last: reg?.lastEvents[it.event as string],
      status: statusOf(defOf(it.event)),
    })),
  );

  // ── Schulungsmodus: ein Bereich pro Bildschirm, große Typo, druckbar ──
  if (schulung) {
    const g = CATALOG[Math.max(0, Math.min(slide, CATALOG.length - 1))];
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-8 print:hidden">
            <span className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-slate-400">
              <GraduationCap size={16} /> Schulungsmodus · Bereich {slide + 1}/{CATALOG.length}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => window.print()} className="px-3 py-2 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300 inline-flex items-center gap-1.5"><Printer size={14} /> Drucken</button>
              <button type="button" onClick={() => setSchulung(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300 inline-flex items-center gap-1.5"><X size={14} /> Schließen</button>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight mb-2">{g.title}</h1>
          <p className="text-[18px] text-slate-500 mb-8">{g.intro}</p>

          <div className="space-y-5">
            {g.items.map((it) => (
              <div key={it.name} className="border-b border-slate-100 pb-5">
                <div className="flex items-baseline justify-between gap-4 flex-wrap">
                  <h2 className="text-[22px] font-semibold">{it.name}</h2>
                  {it.event && <StatusChip s={statusOf(defOf(it.event))} />}
                </div>
                <p className="text-[16px] text-slate-600 leading-relaxed mt-1">{it.desc}</p>
                {it.href && <p className="text-[14px] text-slate-400 mt-1">Zu finden unter <span className="font-mono">{it.href}</span></p>}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-10 print:hidden">
            <button type="button" disabled={slide === 0} onClick={() => setSlide((s) => s - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-[14px] font-semibold text-slate-600 disabled:opacity-40 inline-flex items-center gap-1.5"><ChevronLeft size={16} /> Zurück</button>
            <div className="flex gap-1.5">
              {CATALOG.map((_, i) => (
                <button key={i} type="button" onClick={() => setSlide(i)} aria-label={`Bereich ${i + 1}`}
                  className="w-2.5 h-2.5 rounded-full transition-colors" style={{ background: i === slide ? ACCENT : "#e2e8f0" }} />
              ))}
            </div>
            <button type="button" disabled={slide >= CATALOG.length - 1} onClick={() => setSlide((s) => s + 1)}
              className="px-4 py-2.5 rounded-xl text-white text-[14px] font-semibold disabled:opacity-40 inline-flex items-center gap-1.5" style={{ background: ACCENT }}>Weiter <ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <PageIntro
              id="funktionen"
              title="Funktionen & Schulung"
              subtitle="Alle Funktionen auf einen Blick — für Schulungen und zum Prüfen, ob alles verdrahtet ist."
              steps={[
                "Der Katalog listet jede Funktion mit Klartext-Erklärung und Direktlink.",
                "Der Selbsttest zeigt Button, erwartetes Event, zuletzt gefeuert und Status — ohne an echte Kunden zu senden. Zum Testen: /admin/events.",
                "Der Zustellstand kommt aus einer echten Messung: Zweig bestätigt heißt, ein Testversand ist nachweislich bei Brevo angekommen. Nicht bestätigt nennt beide möglichen Ursachen. Prüfen unter /admin/events.",
                "Schulungsmodus öffnet eine aufgeräumte, druckbare Ansicht — ein Bereich pro Bildschirm.",
              ]}
            />
          </div>
          <button type="button" onClick={() => { setSlide(0); setSchulung(true); }}
            className="shrink-0 px-4 py-2.5 rounded-xl text-white text-[13px] font-bold inline-flex items-center gap-2" style={{ background: ACCENT }}>
            <Presentation size={15} /> Schulungsmodus
          </button>
        </div>

        {reg && !reg.makeWebhookConfigured && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-[12.5px] font-semibold text-amber-800 flex items-center gap-2">
            <AlertTriangle size={14} /> MAKE_WEBHOOK_URL ist nicht gesetzt — Versand ist deaktiviert. Der Status unten zeigt die Registry-Verdrahtung, nicht den Live-Versand.
          </div>
        )}

        {/* ── Katalog ── */}
        <div className="mt-6 grid md:grid-cols-2 gap-4">
          {CATALOG.map((g) => (
            <div key={g.title} className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-[15px] font-bold text-slate-900">{g.title}</h2>
              <p className="text-[12px] text-slate-400 mb-3">{g.intro}</p>
              <div className="divide-y divide-slate-50">
                {g.items.map((it) => (
                  <div key={it.name} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[13px] font-semibold text-slate-800">{it.name}</p>
                        {it.event && <StatusChip s={statusOf(defOf(it.event))} />}
                      </div>
                      <p className="text-[12px] text-slate-500 leading-relaxed">{it.desc}</p>
                    </div>
                    {it.href && (
                      <a href={it.href} className="shrink-0 mt-0.5 text-slate-300 hover:text-[#2563eb]" title={`Öffnen: ${it.href}`}>
                        <ExternalLink size={15} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Selbsttest ── */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-[15px] font-bold text-slate-900 mb-1">Selbsttest — löst jeder Knopf das richtige Event aus?</h2>
          <p className="text-[12px] text-slate-400 mb-4">
            Aus der Event-Registry + Versand-Verlauf. „Zuletzt gefeuert" ist der letzte reale ODER Test-Versand (Berlin-Zeit).
            Zum gefahrlosen Testen ohne echten Kunden: <a href="/admin/events" className="font-semibold text-[#2563eb] hover:underline">/admin/events</a>.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Bereich", "Button", "Erwartetes Event", "Zuletzt gefeuert", "Status"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="px-3 py-8 text-center text-[13px] text-slate-400">Lädt …</td></tr>}
                {!loading && selfTest.map((row, i) => (
                  <tr key={`${row.event}-${i}`} className="border-b border-slate-50">
                    <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap">{row.area}</td>
                    <td className="px-3 py-2.5 text-[12.5px] font-medium text-slate-800">{row.button}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-slate-500 whitespace-nowrap">{row.event}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">{fmtDT(row.last)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><StatusChip s={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Verdrahtungs-Audit (Phase 0) ── */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-[15px] font-bold text-slate-900 mb-1">Verdrahtungs-Audit (Phase 0)</h2>
          <p className="text-[12px] text-slate-400 mb-4">
            Jeder Event-auslösende Button wurde systematisch gegen die Registry geprüft. Ergebnis: kein toter oder
            falsch verlinkter Button — jeder gefeuerte Event ist registriert. Ob eine Mail beim Kunden ankommt,
            steht auf einem anderen Blatt: Das misst die Zweig-Prüfung unter /admin/events gegen Brevo.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Button", "Event", "Ort", "Verdrahtet?"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WIRING_AUDIT.map((row) => (
                  <tr key={row.event} className="border-b border-slate-50">
                    <td className="px-3 py-2.5 text-[12.5px] font-medium text-slate-800">{row.button}</td>
                    <td className="px-3 py-2.5 text-[12px] font-mono text-slate-500 whitespace-nowrap">{row.event}</td>
                    <td className="px-3 py-2.5 text-[12px] text-slate-500">{row.ort}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.verdrahtet
                        ? <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-600"><CheckCircle2 size={13} /> ja</span>
                        : <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-rose-600"><AlertTriangle size={13} /> nein</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
