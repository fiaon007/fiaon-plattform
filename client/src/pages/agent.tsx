import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Wallet, Users, CheckCircle2, ChevronRight } from "lucide-react";
import { AgentShell, api, fmtCents, isToday, inputCls, ACCENT } from "./agent/shared";
import { AuthLayout, SubmitButton, Reveal, LiveCount } from "./agent/motion";
import { gruss, monatName } from "./agent/zeit";
import { KUNDENSTATUS, zahlungsstatusText } from "@shared/fiaon-kundenstatus";

// ============================================================================
// /agent — die Startseite. Vier Blöcke, klare Rangfolge:
//   1. Begrüßung — wer du bist, wie viele Kunden auf Betreuung warten.
//   2. Kontostand — die dominante Zahl der Seite, Auszahlung einen Klick weit.
//   3. EINE Handlung — „Nächste Akte öffnen" (bzw. „Akte fortsetzen").
//   4. Mein Bestand — RÜCKBLICK, kein Arbeitsvorrat: Segmente mit Zahlen und
//      die letzten Abschlüsse. Keine Anruf-Knöpfe, keine offenen Aufgaben —
//      gearbeitet wird über die Primäraktion und in der Kartei.
// Alle Beträge kommen fertig gerechnet vom Server (Integer-Cents).
// Aktualisierung per Polling (45 s) — kein neuer Realtime-Stack.
// Desktop nutzt die Breite (Kontostand/Handlung links, Bestand rechts); auf
// dem Handy bleibt die Reihenfolge 1 → 2 → 3 → 4 unverändert.
// ============================================================================

const POLL_MS = 45_000;

/** Nur das, was der Kontostand braucht (aus /agent/dashboard). */
interface VerdienstKurz {
  weekCents: number;
  monthCents: number;
}

/** Guthaben-Stand (aus /agent/payouts) — dieselbe Quelle wie /agent/auszahlung. */
interface PayoutStand {
  balanceCents: number;
  minCents: number;
  hasBank: boolean;
  history: { id: number; amount_cents: number; status: string }[];
}

/** Kartei-Kurzstand für Begrüßung und Primäraktion (aus /agent/kartei/status). */
interface KarteiStatus {
  activeCardId: string | null;
  freieKarten: number;
  meineKarten: number;
}

/** Aus /agent/customers wird hier NUR der Rückruf-Termin gebraucht. */
interface KundeKurz {
  next_appointment: string | null;
}

/** Segment-Zahlen des eigenen Bestands (aus /agent/kartei/segmente). */
interface Segmente {
  betreuung: number;
  angekuendigt: number;
  abgeschlossen: number;
}

/** Ein Abschluss aus /agent/dashboard (`closes`) — Roh-Spalten der Abfrage. */
interface Abschluss {
  id: number;
  ref: string;
  pack_name: string | null;
  amount_cents: number;
  is_bonus: boolean;
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
}

function kundenName(a: Abschluss): string {
  const person = [a.first_name, a.last_name].filter(Boolean).join(" ").trim();
  return person || a.company_name || a.contact_name || a.ref;
}

export default function AgentPortalPage() {
  return (
    <AgentShell>
      <AgentHome />
    </AgentShell>
  );
}

function AgentHome() {
  const [agent, setAgent] = useState<{ name: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api("/agent/me").then((r) => {
      setAgent(r.ok ? r.json.agent : null);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) return <p className="py-16 text-center text-[13px] text-slate-400">Lädt …</p>;
  if (!agent) return <LoginView onLogin={setAgent} />;
  return <Dashboard agentName={agent.name} />;
}

// ═══════════════ Login (inkl. „Passwort vergessen", F2) ═══════════════

function LoginView({ onLogin }: { onLogin: (a: { name: string; email: string }) => void }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/agent/login", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      onLogin(r.json.agent);
      window.location.reload();
    } else setError(r.json?.error || "Anmeldung fehlgeschlagen");
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api("/agent/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email }) });
    setBusy(false);
    setInfo(r.json?.message || "Falls ein Konto existiert, wurde eine E-Mail versendet.");
  };

  return (
    <AuthLayout
      title={forgotMode ? "Passwort zurücksetzen" : "Mitarbeiter-Anmeldung"}
      subtitle={forgotMode ? "Gib deine Login-E-Mail ein — wir senden dir einen Link." : "Dein Vertriebs-Cockpit wartet."}
    >
      {forgotMode ? (
        <form onSubmit={forgot} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Login-E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
          </div>
          {info && <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">{info}</p>}
          <SubmitButton loading={busy} disabled={!form.email}>
            {busy ? "Sende …" : "Reset-Link anfordern"}
          </SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(false); setInfo(null); }}
            className="block w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
            Zurück zur Anmeldung
          </button>
        </form>
      ) : (
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Passwort</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} autoComplete="current-password" style={{ minHeight: 46 }} />
          </div>
          {error && <p className="text-[12px] font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-2.5">{error}</p>}
          <SubmitButton loading={busy} disabled={!form.email || !form.password}>
            {busy ? "Anmelden …" : "Anmelden"}
          </SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(true); setError(null); }}
            className="block w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
            Passwort vergessen?
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

// ═══════════════ Startseite: Begrüßung · Kontostand · Handlung · Bestand ═══════════════

/** Fällig heißt: der Termin ist vorbei ODER er liegt im heutigen Tag. */
function rueckrufFaellig(v: string | null): boolean {
  if (!v) return false;
  const t = new Date(v).getTime();
  if (!Number.isFinite(t)) return false;
  return t <= Date.now() || isToday(v);
}

function Dashboard({ agentName }: { agentName: string }) {
  const [verdienst, setVerdienst] = useState<VerdienstKurz | null>(null);
  const [payout, setPayout] = useState<PayoutStand | null>(null);
  const [kartei, setKartei] = useState<KarteiStatus | null>(null);
  const [rueckrufe, setRueckrufe] = useState(0);
  const [segmente, setSegmente] = useState<Segmente | null>(null);
  const [abschluesse, setAbschluesse] = useState<Abschluss[]>([]);

  const load = useCallback(async () => {
    const [d, p, k, c, s] = await Promise.all([
      api("/agent/dashboard"),
      api("/agent/payouts"),
      api("/agent/kartei/status"),
      api("/agent/customers"),
      api("/agent/kartei/segmente"),
    ]);
    if (d.ok) {
      setVerdienst({ weekCents: d.json.weekCents, monthCents: d.json.monthCents });
      // Nur echte Abschlüsse — Boni und Gutschriften sind kein Verkauf.
      const echte: Abschluss[] = (d.json.closes || []).filter((x: Abschluss) => !x.is_bonus);
      setAbschluesse(echte.slice(0, 3));
    }
    if (s.ok) {
      setSegmente({
        betreuung: s.json.betreuung,
        angekuendigt: s.json.angekuendigt,
        abgeschlossen: s.json.abgeschlossen,
      });
    }
    if (p.ok) {
      setPayout({
        balanceCents: p.json.balanceCents,
        minCents: p.json.minCents,
        hasBank: !!p.json.hasBank,
        history: p.json.history || [],
      });
    }
    if (k.ok) {
      setKartei({
        activeCardId: k.json.activeCardId,
        freieKarten: k.json.freieKarten,
        meineKarten: k.json.meineKarten,
      });
    }
    if (c.ok) {
      const liste: KundeKurz[] = c.json.data || [];
      setRueckrufe(liste.filter((x) => rueckrufFaellig(x.next_appointment)).length);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const firstName = useMemo(() => agentName.split(" ")[0], [agentName]);

  // Erst zeigen, wenn Kontostand und Kartei-Stand da sind — eine halbe
  // Startseite ist schlimmer als ein kurzer, ruhiger Ladezustand.
  if (!payout || !kartei) {
    return (
      <div className="max-w-2xl lg:max-w-none mx-auto pt-1">
        <div className="agent-skeleton h-[74px] rounded-2xl mb-4" />
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-5 lg:items-start">
          <div className="grid gap-3 content-start">
            <div className="agent-skeleton h-[172px] rounded-3xl" />
            <div className="agent-skeleton h-[68px] rounded-3xl" />
          </div>
          <div className="agent-skeleton h-[196px] rounded-3xl" />
        </div>
      </div>
    );
  }

  const frei = kartei.freieKarten;
  const aktiv = !!kartei.activeCardId;

  // Genau EINE Primäraktion. Die Reihenfolge der Akten macht der Server
  // (Zahlung angekündigt → fällige Rückrufe → offene Anträge → Leads).
  const aktion = aktiv
    ? {
        label: "Akte fortsetzen",
        href: "/agent/kartei?akte=aktiv",
        hinweis: "Du hast eine Akte in Bearbeitung — bring sie zu Ende, dann wird die nächste frei.",
      }
    : frei > 0
      ? {
          label: "Nächste Akte öffnen",
          href: "/agent/kartei",
          hinweis: "Zahlung angekündigt zuerst, dann fällige Rückrufe, offene Anträge, Leads.",
        }
      : {
          label: "Kartei öffnen",
          href: "/agent/kartei",
          hinweis: "Gerade liegt keine freie Karte bereit. Sobald etwas frei wird, steht es hier.",
        };

  const offeneAnforderung = payout.history.find((h) => h.status === "angefordert") || null;
  const fehlt = Math.max(0, payout.minCents - payout.balanceCents);
  const auszahlbar = payout.hasBank && payout.balanceCents >= payout.minCents;

  return (
    <div className="relative max-w-2xl lg:max-w-none mx-auto">
      {/* Lichtschimmer: reine CSS-Verläufe, sehr langsam bewegt (transform only).
          Liegt hinter allem und fängt keine Tipps ab. */}
      <span className="agent-aura" aria-hidden="true" />

      <div className="relative">
        {/* ── 1. Begrüßung ── */}
        <Reveal index={0}>
          <div className="pt-0.5 pb-4 sm:pb-5">
            <h1 className="text-[24px] sm:text-[30px] font-black tracking-tight text-slate-900 leading-[1.12]">
              {gruss()}, {firstName}
            </h1>
            <p className="text-[13.5px] sm:text-[14px] text-slate-500 mt-1.5 leading-relaxed">
              {frei === 0
                ? "Aktuell wartet kein Kunde auf Betreuung."
                : frei === 1
                  ? "Aktuell wartet 1 Kunde auf Betreuung."
                  : `Aktuell warten ${frei.toLocaleString("de-DE")} Kunden auf Betreuung.`}
            </p>
            {rueckrufe > 0 && (
              <p className="text-[12px] sm:text-[12.5px] text-slate-400 mt-1 leading-relaxed">
                {rueckrufe === 1 ? "1 Rückruf ist" : `${rueckrufe} Rückrufe sind`} heute fällig — sie stehen in deiner nächsten Akte ganz oben.
              </p>
            )}
          </div>
        </Reveal>

        {/* Desktop: zwei Spalten, damit die Fläche nicht tot daliegt. Die
            DOM-Reihenfolge ist gleich der Handy-Reihenfolge — kein Umsortieren
            per CSS, also auch keine andere Tab-Reihenfolge. */}
        <div className="grid gap-3 lg:grid-cols-2 lg:gap-5 lg:items-start">
          <div className="grid gap-3 content-start">
            {/* ── 2. Der Kontostand — der Held der Seite ── */}
            <Reveal index={1}>
              <section className="agent-glass-strong agent-raise rounded-3xl px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex items-center gap-2.5">
              <span
                className="rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(37,99,235,.10)", color: ACCENT, width: 26, height: 26 }}
              >
                <Wallet size={14} strokeWidth={1.9} />
              </span>
              <h2 className="text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400">
                Dein Kontostand
              </h2>
            </div>

            <p className="text-[34px] sm:text-[42px] font-black tracking-tight text-slate-900 leading-none mt-3 tabular-nums">
              <LiveCount value={payout.balanceCents} format={fmtCents} durationMs={1100} />
            </p>

            {verdienst && (
              <p className="text-[12px] text-slate-500 mt-2 leading-relaxed">
                Diese Woche <span className="font-semibold text-slate-700 tabular-nums">+{fmtCents(verdienst.weekCents)}</span>
                <span className="text-slate-300 mx-1.5">·</span>
                Im {monatName()} <span className="font-semibold text-slate-700 tabular-nums">+{fmtCents(verdienst.monthCents)}</span>
              </p>
            )}

            <div className="mt-4">
              {offeneAnforderung ? (
                <div className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
                  <p className="text-[12.5px] text-slate-600 leading-relaxed">
                    Eine Auszahlung über <span className="font-semibold text-slate-900 tabular-nums">{fmtCents(offeneAnforderung.amount_cents)}</span> ist
                    angefordert und wird geprüft.
                  </p>
                  <Link
                    href="/agent/auszahlung"
                    className="text-[12.5px] font-semibold inline-flex items-center gap-1 mt-1 hover:underline"
                    style={{ color: ACCENT }}
                  >
                    Stand ansehen <ArrowRight size={12} strokeWidth={2.2} />
                  </Link>
                </div>
              ) : !payout.hasBank ? (
                <>
                  <p className="text-[12.5px] text-slate-500 leading-relaxed mb-3">
                    Für die Auszahlung fehlen noch deine Bankdaten.
                  </p>
                  <Link
                    href="/agent/profil"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-5 text-[13.5px] font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 transition-colors"
                    style={{ minHeight: 46 }}
                  >
                    Auszahlungsdaten hinterlegen <ArrowRight size={14} strokeWidth={2.2} />
                  </Link>
                </>
              ) : auszahlbar ? (
                <Link
                  href="/agent/auszahlung"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-5 text-[13.5px] font-semibold text-slate-800 hover:border-slate-300 transition-colors"
                  style={{ minHeight: 46 }}
                >
                  Auszahlung <ArrowRight size={14} strokeWidth={2.2} />
                </Link>
              ) : (
                <p className="text-[12.5px] text-slate-500 leading-relaxed">
                  Ab {fmtCents(payout.minCents)} kannst du jederzeit auszahlen — dir fehlen noch{" "}
                  <span className="font-semibold text-slate-700 tabular-nums">{fmtCents(fehlt)}</span>.
                </p>
              )}
            </div>
              </section>
            </Reveal>

            {/* ── 3. Die eine Handlung ── */}
            <Reveal index={2}>
              <Link
                href={aktion.href}
                className="agent-cta flex items-center gap-3.5 rounded-3xl px-5 py-4 sm:px-5 sm:py-4 text-white"
                style={{ minHeight: 68 }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15.5px] sm:text-[17px] font-bold tracking-tight leading-snug">
                    {aktion.label}
                  </span>
                  <span className="block text-[11.5px] sm:text-[12px] text-white/75 mt-0.5 leading-relaxed">
                    {aktion.hinweis}
                  </span>
                </span>
                <span className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <ArrowRight size={17} strokeWidth={2.3} />
                </span>
              </Link>
            </Reveal>
          </div>

          {/* ── 4. Mein Bestand — Rückblick, kein Arbeitsvorrat ── */}
          <Reveal index={3}>
            <Bestand segmente={segmente} abschluesse={abschluesse} />
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// ═══════════════ Mein Bestand: Segmente + letzte Abschlüsse ═══════════════

/**
 * BEWUSST KEIN ARBEITSBEREICH: keine Anruf-Knöpfe, keine offenen Aufgaben,
 * keine Liste zum Abarbeiten. Diese Sektion beantwortet zwei Fragen, die ein
 * Agent sonst nirgends beiläufig beantwortet bekommt: „Was betreue ich?" und
 * „Was habe ich geschafft?". Gearbeitet wird über die Primäraktion darüber
 * und in der Kartei.
 *
 * Jede Segment-Zahl verlinkt in die Liste mit GENAU diesem Filter — die Zahl
 * und die Liste danach stammen aus derselben Bedingung (siehe
 * /agent/kartei/segmente im Server).
 */
// Die Filternamen sind die der EINEN Kundenliste (05.08.2026). Vorher zeigten
// sie auf /agent/meine-kunden mit eigenen Namen — nach der Zusammenlegung wäre
// jeder dieser Kacheln ein Klick ins Nichts gewesen.
const SEGMENTE: { key: keyof Segmente; label: string; filter: string }[] = [
  { key: "betreuung", label: "In Betreuung", filter: "alle" },
  { key: "angekuendigt", label: zahlungsstatusText("claimed_paid"), filter: "tier1" },
  { key: "abgeschlossen", label: "Abgeschlossen", filter: "bezahlt" },
];

function Bestand({ segmente, abschluesse }: { segmente: Segmente | null; abschluesse: Abschluss[] }) {
  if (!segmente) return <div className="agent-skeleton h-[196px] rounded-3xl" />;

  const gesamt = segmente.betreuung + segmente.angekuendigt + segmente.abgeschlossen;

  return (
    <section className="agent-glass agent-lift rounded-3xl px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex items-center gap-2.5">
        <span
          className="rounded-lg flex items-center justify-center shrink-0 text-slate-500 bg-slate-100/80"
          style={{ width: 26, height: 26 }}
        >
          <Users size={14} strokeWidth={1.9} />
        </span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.15em] text-slate-400">
          Mein Bestand
        </h2>
      </div>

      {gesamt === 0 && abschluesse.length === 0 ? (
        /* Leerer Bestand: ein Weg nach vorne, keine leere Fläche. */
        <div className="mt-3">
          <p className="text-[14px] font-semibold text-slate-800 leading-snug">
            Noch keine eigene Akte.
          </p>
          <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
            Übernimm deine erste aus der Kartei — sie bleibt danach dauerhaft hier bei dir,
            mit allem, was du dokumentierst.
          </p>
          <Link
            href="/agent/kartei"
            className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold hover:underline"
            style={{ color: ACCENT }}
          >
            Zur Kartei <ArrowRight size={13} strokeWidth={2.2} />
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SEGMENTE.map((s) => (
              <Link
                key={s.key}
                href={`/agent/kunden?filter=${s.filter}`}
                className="agent-tile rounded-2xl px-3 py-3 text-left"
                style={{ minHeight: 76 }}
              >
                <span className="block text-[22px] sm:text-[24px] font-black tracking-tight text-slate-900 tabular-nums leading-none">
                  {segmente[s.key].toLocaleString("de-DE")}
                </span>
                <span className="block text-[10.5px] font-semibold text-slate-500 mt-1.5 leading-tight">
                  {s.label}
                </span>
              </Link>
            ))}
          </div>

          {abschluesse.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200/70">
              <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
                Zuletzt abgeschlossen
              </p>
              <ul className="mt-2 space-y-1.5">
                {abschluesse.map((a) => (
                  <li key={a.id} className="flex items-center gap-2.5">
                    <CheckCircle2 size={14} strokeWidth={2} className="shrink-0" style={{ color: ACCENT }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-slate-800 truncate leading-tight">
                        {kundenName(a)}
                      </span>
                      {a.pack_name && (
                        <span className="block text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                          {a.pack_name.replace(/\n/g, " ")}
                        </span>
                      )}
                    </span>
                    <span className="text-[13px] font-bold text-slate-900 tabular-nums shrink-0">
                      +{fmtCents(a.amount_cents)}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/agent/verdienst"
                className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Alle Abschlüsse <ChevronRight size={13} strokeWidth={2.2} />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
