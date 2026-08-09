import { useState, useEffect, useCallback } from "react";
import { FiaonEbene } from "@/components/FiaonEbene";
import { Send, ChevronDown, ChevronRight, CheckCircle2, XCircle, AlertTriangle, User, FlaskConical } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

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
  recommendationOnly?: boolean;
  // GEMESSENER Stand statt Heuristik (09.08.2026). Siehe
  // server/lib/fiaon-mail-events.ts — `makeBranchReady` gibt es nicht mehr.
  verifikation?: "bestaetigt" | "nicht_bestaetigt" | "ungeprueft";
  verifikationsText?: string;
  brevoTemplateId?: number | null;
  brevoTemplateName?: string | null;
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

/**
 * Alle Zweige auf einmal prüfen.
 *
 * ── WAS EIN LAUF WIRKLICH TUT ──────────────────────────────────────────────
 * Jede Prüfung SENDET eine Probemail an die Testadresse und wartet, ob Brevo
 * eine Zustellung meldet. Bei 33 Ereignissen sind das 33 Mails. Das muss
 * vorher dastehen — sonst wundert sich der Vorgesetzte über ein volles
 * Postfach und traut dem Knopf beim nächsten Mal nicht mehr.
 *
 * ── DIE ARBEITSLISTE IST DAS EIGENTLICHE ERGEBNIS ──────────────────────────
 * Ein „22 von 33 bestätigt" ist eine Zahl. Was der Vorgesetzte braucht, ist die
 * Liste der elf fehlenden Zweige mit ihren Variablennamen — damit geht er zu
 * Make und legt sie an. Deshalb steht sie unten, mit Kopierknopf.
 */
function AlleZweigePruefen({ anzahl, testAdresse, onFertig }: {
  anzahl: number; testAdresse: string; onFertig: () => void;
}) {
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [erg, setErg] = useState<any>(null);
  const [kopiert, setKopiert] = useState(false);

  const starten = async () => {
    setFrage(false);
    setLaeuft(true);
    setErg(null);
    const r = await fetch("/api/fiaon/admin/mail/alle-pruefen", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testAdresse }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setLaeuft(false);
    setErg(j ?? { ok: false, error: "Der Lauf war nicht erreichbar." });
    onFertig();
  };

  const fehlende = (erg?.zweige ?? []).filter((z: any) => !z.bestaetigt);
  const liste = fehlende.map((z: any) => z.event).join("\n");

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-bold text-slate-900">Alle Zweige prüfen</h2>
          <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5" style={{ maxWidth: 620 }}>
            Sendet an jeden der {anzahl || "—"} Ereignistypen eine Probemail an deine
            Testadresse und wartet, ob Brevo die Zustellung meldet. Danach steht hier,
            welche Zweige in Make noch fehlen.
          </p>
        </div>
        <button type="button" onClick={() => setFrage(true)} disabled={laeuft || !anzahl}
                className="fi-knopf-primaer px-5 shrink-0">
          {laeuft ? `Prüft ${anzahl} Zweige …` : "Alle Zweige prüfen"}
        </button>
      </div>

      {laeuft && (
        <div className="mt-4">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(15,23,42,.07)" }}>
            <div style={{
              height: "100%", width: "40%", borderRadius: 999,
              background: "linear-gradient(90deg, transparent, #1d4ed8, transparent)",
              animation: "fiLauf 1.4s ease-in-out infinite",
            }} />
          </div>
          <style>{"@keyframes fiLauf{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}"}</style>
          <p className="mt-2 text-[12px] text-slate-500">
            Jeder Zweig bekommt bis zu vier Sekunden Zeit — der ganze Lauf dauert
            etwa {Math.max(1, Math.round((anzahl * 4) / 60))} Minuten. Fenster offen lassen.
          </p>
        </div>
      )}

      {erg && !erg.ok && (
        <p className="mt-4 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold"
           style={{ background: "rgba(220,38,38,.07)", color: "#b91c1c" }}>
          {erg.error}
        </p>
      )}

      {erg?.ok && (
        <>
          <div className="mt-4 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }}>
            {[
              ["bestätigt", erg.sauber, "#059669"],
              ["ohne Zweig", erg.beanstandet, "#d97706"],
              ["geprüft", erg.gepruefte, "#64748b"],
            ].map(([t, w, f]) => (
              <div key={String(t)} className="px-3.5 py-3 rounded-xl"
                   style={{ background: `${f}0f`, boxShadow: `inset 0 0 0 1px ${f}2e` }}>
                <p className="text-[22px] font-bold leading-none tabular-nums" style={{ color: String(f) }}>
                  {String(w)}
                </p>
                <p className="text-[11.5px] font-semibold mt-1" style={{ color: String(f) }}>{String(t)}</p>
              </div>
            ))}
          </div>

          {erg.brevo && (
            <div className="mt-3 px-3.5 py-3 rounded-xl"
                 style={{ background: "rgba(217,119,6,.08)", boxShadow: "inset 0 0 0 1px rgba(217,119,6,.22)" }}>
              <p className="text-[12.5px] font-bold" style={{ color: "#b45309" }}>{erg.brevo.titel}</p>
              {(erg.brevo.anleitung ?? []).map((a: string, i: number) => (
                <p key={i} className="text-[12px] mt-1" style={{ color: "#92400e" }}>· {a}</p>
              ))}
            </div>
          )}

          {fehlende.length > 0 && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[.1em] text-slate-500">
                  Diese Zweige fehlen in Make
                </p>
                <button type="button"
                        onClick={() => { void navigator.clipboard.writeText(liste); setKopiert(true); }}
                        className="fi-knopf-glas px-3 py-1.5 text-[11.5px]">
                  {kopiert ? "Kopiert" : "Liste kopieren"}
                </button>
              </div>
              <div className="mt-2 rounded-xl overflow-hidden" style={{ boxShadow: "inset 0 0 0 1px #eef2f7" }}>
                {fehlende.map((z: any) => (
                  <div key={z.event} className="px-3.5 py-2.5" style={{ borderBottom: "1px solid #f8fafc" }}>
                    <p className="text-[12.5px] font-semibold text-slate-800">
                      <span className="font-mono text-[#1d4ed8]">{z.event}</span>
                      {z.titel && <span className="ml-2 font-normal text-slate-500">{z.titel}</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5">
                      {/* BEIDE Ursachen nennen: Der Vorgesetzte kann von hier aus
                          nicht sehen, welche zutrifft — und eine falsche
                          Vermutung kostet ihn eine halbe Stunde in Make. */}
                      {z.text || "Keine Zustellung gemeldet. Entweder gibt es in Make keinen Zweig "
                        + "für diesen Typ — oder er existiert, hat aber die Mail nicht ausgelöst."}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {fehlende.length === 0 && (
            <p className="mt-3 px-3.5 py-3 rounded-xl text-[12.5px] font-semibold"
               style={{ background: "rgba(5,150,105,.08)", color: "#047857" }}>
              Jeder Zweig hat geantwortet. Alle {erg.gepruefte} Ereignisse kommen beim Kunden an.
            </p>
          )}
        </>
      )}

      <FiaonEbene
        offen={frage}
        onZu={() => setFrage(false)}
        titel={`${anzahl} Probemails senden?`}
        ueberschrift="Bitte einmal bestätigen"
        breite={480}
        kinder={
          <>
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--fi-text-leise)" }}>
              Der Lauf sendet an <b>jeden</b> Ereignistyp eine Probemail — das sind{" "}
              <b>{anzahl} Mails</b> an{" "}
              <b style={{ fontFamily: "ui-monospace, monospace" }}>{testAdresse || "deine Testadresse"}</b>.
              Kunden bekommen nichts davon zu sehen; jede Mail trägt <code>test: true</code>.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--fi-text-still)" }}>
              Der Lauf braucht etwa {Math.max(1, Math.round((anzahl * 4) / 60))} Minuten.
            </p>
            {!testAdresse && (
              <p className="mt-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
                 style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
                Trag zuerst oben eine Testadresse ein — sonst weiß niemand, wohin die Mails gehen.
              </p>
            )}
          </>
        }
        fuss={
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setFrage(false)}
                    className="text-[13px] font-semibold" style={{ color: "var(--fi-text-still)" }}>
              Abbrechen
            </button>
            <button type="button" onClick={() => void starten()} disabled={!testAdresse}
                    className="ml-auto fi-knopf-primaer px-5">
              {anzahl} Probemails senden
            </button>
          </div>
        }
      />
    </div>
  );
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
  const [pruefeLaeuft, setPruefeLaeuft] = useState<string | null>(null);

  /**
   * Zweig prüfen: Testversand raus, dann bei Brevo nachsehen.
   *
   * Das kann bis zu drei Minuten dauern — Make arbeitet asynchron, Brevo
   * protokolliert verzögert. Der Knopf sagt das, statt so zu tun, als ginge
   * es sofort.
   */
  const zweigPruefen = useCallback(async (typ: string) => {
    setPruefeLaeuft(typ);
    const r = await fetch(`/api/fiaon/admin/mail/registry/${encodeURIComponent(typ)}/pruefen`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testAdresse: testEmail }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setPruefeLaeuft(null);
    setResults((m) => ({ ...m, [typ]: { ok: !!j?.bestaetigt, text: j?.text || j?.error || "Prüfung nicht möglich." } }));
    load();
  }, [testEmail]);

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
      <PageIntro
        id="events"
        title="E-Mail-Events (Make)"
        subtitle="Hier testest du jede automatische Kunden-Mail und siehst, welcher Event-Typ zuletzt (oder noch nie) gefeuert hat."
        steps={[
          "Jede Zeile ist ein Event-Typ aus dem Code (z. B. payment_confirmed). „Noch nie gefeuert“ heißt: Make kennt die Struktur noch nicht — vor dem Anlegen eines neuen Make-Zweigs hier einmal testen.",
          "„Test senden“ schickt das Event mit Beispieldaten an DEINE Test-Adresse (test: true) — es löst keinen echten Workflow aus.",
          "„Für echten Kunden senden“ nutzt die ECHTEN Kundendaten — mit Vorschau und Bestätigung. Vorsicht bei payment_reminder: das zählt als echte Erinnerung.",
          "Steht oben „Seit X Stunden kein Lead-Eingang“ im Dashboard, prüfe hier zuerst, ob der Make-Webhook konfiguriert ist und Events ankommen.",
        ]}
      />

      {/* ══════════════════════════════════════════════════════════════════
          ALLE ZWEIGE PRÜFEN
          Der Server konnte das seit dem 11.08. — nur klicken konnte es
          niemand. Der Prüfstand von damals sah ausschließlich in den
          SERVERQUELLTEXT („die Route existiert") und war grün, während die
          Funktion für einen Menschen unerreichbar war.

          Daraus die Regel, die jetzt in AGENTS.md steht: Eine Funktion gilt
          erst als geliefert, wenn ein Browsertest den KNOPF findet und
          drückt.
          ══════════════════════════════════════════════════════════════════ */}
      <AlleZweigePruefen anzahl={data?.events?.length ?? 0}
                         testAdresse={testEmail}
                         onFertig={() => void load()} />

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
                      {ev.recommendationOnly && !ev.deprecated && (
                        <span className="px-1.5 py-0.5 rounded border border-violet-200 bg-violet-50 text-[10px] font-bold uppercase text-violet-700">Empfehlung</span>
                      )}
                      {ev.customerBound && !ev.deprecated && (
                        <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-[10px] font-bold uppercase" style={{ color: ACCENT }}>kundengebunden</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "bestaetigt" && (
                        <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[10px] font-bold uppercase text-emerald-700">Zweig bestätigt</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "nicht_bestaetigt" && (
                        <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-[10px] font-bold uppercase text-amber-700">nicht bestätigt</span>
                      )}
                      {!ev.deprecated && ev.verifikation === "ungeprueft" && (
                        <span className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-bold uppercase text-slate-500">ungeprüft</span>
                      )}
                    </span>
                    <span className="block text-[12px] text-slate-400 mt-0.5">{ev.description}</span>
                  </span>
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-slate-100">
                    {/* ── GEMESSEN, NICHT BEHAUPTET ─────────────────────
                        Hier stand bis zum 09.08.2026 eine Warnung über einen
                        angeblich fehlenden Zweig
                        — ausgelöst davon, dass in unserer eigenen
                        Beschreibung das Wort „Vorgesetzten-TODO" vorkam. 23 von
                        33 Ereignissen waren so gekennzeichnet, obwohl alle 21
                        Zweige aktiv waren. */}
                    {!ev.deprecated && (
                      <div className="mt-3 px-3.5 py-2.5 rounded-xl border text-[12px] leading-relaxed"
                           style={ev.verifikation === "bestaetigt"
                             ? { borderColor: "#a7f3d0", background: "#ecfdf5", color: "#065f46" }
                             : { borderColor: "#e2e8f0", background: "#f8fafc", color: "#475569" }}>
                        {ev.verifikationsText}
                        {ev.verifikation !== "bestaetigt" && (
                          <button type="button" onClick={() => void zweigPruefen(ev.type)}
                                  disabled={pruefeLaeuft === ev.type}
                                  className="ml-2 font-bold underline disabled:opacity-50">
                            {pruefeLaeuft === ev.type ? "prüft … (bis zu 3 Minuten)" : "Zweig prüfen"}
                          </button>
                        )}
                        {ev.recommendationOnly && <><br />Für dieses Ereignis löst der Code noch keinen automatischen Versand aus — es lässt sich aber testen.</>}
                      </div>
                    )}
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
