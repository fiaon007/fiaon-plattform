import { useCallback, useEffect, useMemo, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// TEAM-ZENTRALE — alles über einen Menschen an einem Ort
//
// Bisher lag das Wissen über einen Mitarbeiter auf vier Seiten: Stammdaten und
// Provisionssatz in „Team-Übersicht", Zahlen in „Leistung", Nachbuchungen auf
// einer eigenen Seite, Auszahlungen auf einer fünften. Wer eine Frage zu einer
// Person hatte, klickte sich durch alle.
//
// NEU UND ZENTRAL: das PROTOKOLL. „Was hat diese Person eigentlich gemacht?"
// war bisher unbeantwortbar, obwohl die Antwort seit Monaten in
// `fiaon_agent_events` und `fiaon_contact_log` steht. Es wird nichts NEUES
// mitgeschrieben — es war nur nie lesbar.
// ═══════════════════════════════════════════════════════════════════════════

interface Mitglied {
  id: number; name: string; vorname: string; email: string; avatar: string | null;
  rolle: string; active: boolean; distribution_active: boolean; is_test_account: boolean;
  commission_rate_bp: number | null; monthly_goal_cents: number | null;
  last_login_at: string | null;
  stufe_a: number; stufe_b: number; stufe_c: number; bestand: number;
  heute: number; woche: number; erreichbarkeit: number | null;
  abschluesse_monat: number; umsatz_monat_cents: string;
  offen_cents: string; ausgezahlt_cents: string; letzte_aktivitaet: string | null;
}

const ROLLE_TEXT: Record<string, string> = {
  agent: "Vertrieb", vertriebsleiter: "Vertriebsleitung", onboarding: "Onboarding",
};

function eur(cent: unknown): string {
  return `${(Number(cent ?? 0) / 100).toFixed(2).replace(".", ",")} €`;
}

function wann(iso: string | null): string {
  if (!iso) return "nie";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `vor ${Math.max(1, min)} Min`;
  if (min < 1440) return `vor ${Math.round(min / 60)} Std`;
  const t = Math.round(min / 1440);
  return t === 1 ? "gestern" : `vor ${t} Tagen`;
}

/** Anfangsbuchstaben, wenn kein Bild da ist. */
function Avatar({ src, name, size = 40 }: { src: string | null; name: string; size?: number }) {
  const kuerzel = name.split(/\s+/).slice(0, 2).map((t) => t[0]).join("").toUpperCase();
  return src
    ? <img src={src} alt="" width={size} height={size} className="rounded-full object-cover border border-slate-200 shrink-0" />
    : (
      <span style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
            className="rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-semibold flex items-center justify-center shrink-0">
        {kuerzel}
      </span>
    );
}

export default function AdminTeamZentrale() {
  const [team, setTeam] = useState<Mitglied[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [offen, setOffen] = useState<number | null>(null);
  const [rang, setRang] = useState(false);
  const [nachrichtAn, setNachrichtAn] = useState<number[] | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const r = await fetch("/api/fiaon/admin/zentrale/team", { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setTeam(j.team || []);
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const sortiert = useMemo(() => {
    const l = [...team];
    // Rangliste: nach Umsatz des Monats. Sonst: aktive zuerst, Testkonten ans
    // Ende — sie sind keine Kollegen, sondern Werkzeug.
    if (rang) l.sort((a, b) => Number(b.umsatz_monat_cents) - Number(a.umsatz_monat_cents));
    return l;
  }, [team, rang]);

  return (
    <>
      <div className="max-w-[1400px] mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-slate-900">Team-Zentrale</h1>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              Kennzahlen, Provisionen, Protokolle und Nachrichten — alles zu einem Menschen an einem Ort.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setRang((r) => !r)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={rang ? { background: "#1d4ed8", color: "#fff" } : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
              Rangliste Monat
            </button>
            <button type="button" onClick={() => setNachrichtAn(team.filter((m) => m.active && !m.is_test_account).map((m) => m.id))}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-600">
              Nachricht ans Team
            </button>
            <a href="/admin/team-alt" className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-500"
               style={{ display: "inline-flex", alignItems: "center" }}>
              Alte Ansicht
            </a>
          </div>
        </div>

        {meldung && (
          <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
             style={meldung.art === "gut"
               ? { background: "rgba(5,150,105,.08)", color: "#047857" }
               : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
            {meldung.text}
          </p>
        )}

        {laedt && <p className="py-10 text-center text-[13px] text-slate-400">Wird geladen …</p>}

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {sortiert.map((m, i) => (
            <div key={m.id}
                 className="bg-white rounded-2xl border border-slate-200 p-4 relative overflow-hidden"
                 style={{
                   boxShadow: "0 1px 2px rgba(15,23,42,.04)",
                   opacity: m.active ? 1 : 0.55,
                   animation: `teamAuf 420ms cubic-bezier(.32,.72,0,1) ${Math.min(i, 8) * 45}ms both`,
                 }}>
              {rang && i < 3 && (
                <span className="absolute right-0 top-0 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(29,78,216,.07)", color: "#1d4ed8", borderBottomLeftRadius: 10 }}>
                  Platz {i + 1}
                </span>
              )}
              <button type="button" onClick={() => setOffen(m.id)} className="w-full text-left">
                <div className="flex items-start gap-3">
                  <Avatar src={m.avatar} name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-bold text-slate-900 truncate">
                      {m.name}
                      {m.is_test_account && <span className="ml-2 text-[10px] font-bold uppercase text-slate-400">Testkonto</span>}
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      {ROLLE_TEXT[m.rolle] ?? m.rolle}
                      {!m.active && " · deaktiviert"}
                      {m.active && !m.distribution_active && " · keine Verteilung"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3.5">
                  {[
                    { t: "Umsatz Monat", w: eur(m.umsatz_monat_cents) },
                    { t: "Abschlüsse", w: String(m.abschluesse_monat) },
                    { t: "Erreichbar", w: m.erreichbarkeit != null ? `${m.erreichbarkeit} %` : "—" },
                  ].map((k) => (
                    <div key={k.t}>
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
                      <p className="text-[15px] font-bold text-slate-900 tabular-nums leading-tight">{k.w}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-3 pt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500"
                     style={{ borderTop: "1px solid #f1f5f9" }}>
                  <span>Bestand <b className="text-slate-800 tabular-nums">{m.bestand}</b></span>
                  <span className="tabular-nums">A {m.stufe_a} · B {m.stufe_b} · C {m.stufe_c}</span>
                  <span>heute <b className="text-slate-800 tabular-nums">{m.heute}</b></span>
                  <span className="ml-auto">{wann(m.letzte_aktivitaet)}</span>
                </div>

                <div className="mt-2 text-[11.5px] text-slate-400">
                  Offen <b className="text-slate-700">{eur(m.offen_cents)}</b> ·
                  ausgezahlt {eur(m.ausgezahlt_cents)}
                  {m.commission_rate_bp != null && ` · ${(m.commission_rate_bp / 100).toFixed(1).replace(".", ",")} %`}
                </div>
              </button>
            </div>
          ))}
        </div>
        <style>{`
          @keyframes teamAuf { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [style*="teamAuf"] { animation: none !important } }
        `}</style>
      </div>

      {offen != null && (
        <MitgliedDetail id={offen} team={team} onZu={() => setOffen(null)}
                        onNachricht={(id) => setNachrichtAn([id])} onAenderung={laden} />
      )}
      {nachrichtAn && (
        <NachrichtDialog agentIds={nachrichtAn} team={team} onZu={() => setNachrichtAn(null)}
                         onFertig={(t) => { setNachrichtAn(null); setMeldung({ art: "gut", text: t }); }} />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DETAIL — die Schublade
// ═══════════════════════════════════════════════════════════════════════════

function MitgliedDetail({
  id, team, onZu, onNachricht, onAenderung,
}: {
  id: number; team: Mitglied[]; onZu: () => void; onNachricht: (id: number) => void; onAenderung: () => void;
}) {
  const m = team.find((x) => x.id === id);
  const [reiter, setReiter] = useState<"zahlen" | "protokoll" | "provision">("zahlen");
  const [logs, setLogs] = useState<any>(null);
  const [logArt, setLogArt] = useState("");
  const [logSuche, setLogSuche] = useState("");
  const [satz, setSatz] = useState(m ? String((m.commission_rate_bp ?? 0) / 100) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [kandidaten, setKandidaten] = useState<any[] | null>(null);

  const logsLaden = useCallback(async () => {
    const p = new URLSearchParams();
    if (logArt) p.set("art", logArt);
    if (logSuche) p.set("q", logSuche);
    const r = await fetch(`/api/fiaon/admin/zentrale/team/${id}/logs?${p}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setLogs(j);
  }, [id, logArt, logSuche]);

  useEffect(() => { if (reiter === "protokoll") void logsLaden(); }, [reiter, logsLaden]);

  useEffect(() => {
    if (reiter !== "provision" || kandidaten) return;
    fetch("/api/fiaon/admin/commission-backfill/candidates", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setKandidaten(j?.candidates ?? j?.kandidaten ?? []))
      .catch(() => setKandidaten([]));
  }, [reiter, kandidaten]);

  if (!m) return null;

  const satzSpeichern = async () => {
    setBusy("satz");
    // DERSELBE Endpunkt wie in der alten Team-Seite. Kein zweiter Weg, der
    // eines Tages anders prüft als der erste.
    const r = await fetch(`/api/fiaon/admin/agents/${id}/update`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commissionRateBp: Math.round(Number(satz.replace(",", ".")) * 100) }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setHinweis(j?.ok ? "Provisionssatz gespeichert." : (j?.error || "Fehler."));
    if (j?.ok) onAenderung();
  };

  return (
    <>
      <div className="fixed inset-0 z-[400]" onClick={onZu} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.55)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
      <div className="fixed inset-0 z-[401] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label={`Detail zu ${m.name}`}
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{ maxWidth: 720, maxHeight: "92vh", background: "#fff", borderRadius: 22,
                      boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
          <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <div className="flex items-start gap-3">
              <Avatar src={m.avatar} name={m.name} size={44} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[19px] font-bold tracking-tight text-slate-900 truncate">{m.name}</h2>
                <p className="text-[12px] text-slate-400 truncate">
                  {m.email} · {ROLLE_TEXT[m.rolle] ?? m.rolle} · zuletzt {wann(m.last_login_at)} angemeldet
                </p>
              </div>
              <button type="button" onClick={onZu} aria-label="Schließen"
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 text-slate-400">
                <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </div>
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {([["zahlen", "Zahlen & Einstellungen"], ["protokoll", "Protokoll"], ["provision", "Provisionen"]] as const)
                .map(([w, t]) => (
                  <button key={w} type="button" onClick={() => setReiter(w)}
                          className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                          style={reiter === w
                            ? { background: "#1d4ed8", color: "#fff" }
                            : { background: "#f8fafc", color: "#64748b" }}>
                    {t}
                  </button>
                ))}
              <button type="button" onClick={() => onNachricht(m.id)}
                      className="ml-auto px-3 py-1.5 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-600">
                Nachricht
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
            {hinweis && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">{hinweis}</p>}

            {reiter === "zahlen" && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { t: "Umsatz Monat", w: eur(m.umsatz_monat_cents) },
                    { t: "Abschlüsse", w: String(m.abschluesse_monat) },
                    { t: "Kontakte Woche", w: String(m.woche) },
                    { t: "Erreichbarkeit", w: m.erreichbarkeit != null ? `${m.erreichbarkeit} %` : "—" },
                    { t: "Bestand A", w: String(m.stufe_a) },
                    { t: "Bestand B", w: String(m.stufe_b) },
                    { t: "Bestand C", w: String(m.stufe_c) },
                    { t: "Offen", w: eur(m.offen_cents) },
                  ].map((k) => (
                    <div key={k.t} className="p-3 rounded-xl bg-slate-50">
                      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
                      <p className="text-[17px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{k.w}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
                  Provisionssatz
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                         className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums outline-none"
                         style={{ minHeight: 42 }} />
                  <span className="text-[13px] text-slate-400">Prozent</span>
                  <button type="button" onClick={() => void satzSpeichern()} disabled={busy === "satz"}
                          className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
                    {busy === "satz" ? "…" : "Speichern"}
                  </button>
                </div>
                <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
                  Änderungen wirken auf künftige Buchungen. Bereits gebuchte Provisionen bleiben, wie sie sind.
                </p>
              </>
            )}

            {reiter === "protokoll" && (
              <>
                {/* Die „genaue Klicks"-Ansicht. Alles hier steht seit Monaten
                    in der Datenbank — es war nur nie an einem Ort lesbar. */}
                <div className="flex flex-wrap gap-2 mb-3">
                  <input value={logSuche} onChange={(e) => setLogSuche(e.target.value)}
                         onKeyDown={(e) => { if (e.key === "Enter") void logsLaden(); }}
                         placeholder="Im Protokoll suchen …"
                         className="flex-1 min-w-[160px] px-3 py-2 rounded-xl border border-slate-200 text-[13px] outline-none"
                         style={{ minHeight: 40 }} />
                  <select value={logArt} onChange={(e) => setLogArt(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-[12.5px]" style={{ minHeight: 40 }}>
                    <option value="">Alle Arten</option>
                    <option value="kontakt">Kundenkontakte</option>
                    {(logs?.arten ?? []).map((a: string) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                {!logs && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
                {logs?.eintraege?.length === 0 && (
                  <p className="text-[13px] text-slate-400">Kein Eintrag für diese Filter.</p>
                )}
                {(logs?.eintraege ?? []).map((e: any) => (
                  <div key={`${e.quelle}-${e.id}`} className="py-2 text-[12.5px]" style={{ borderBottom: "1px solid #f8fafc" }}>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {new Date(e.created_at).toLocaleString("de-DE", {
                          day: "2-digit", month: "2-digit", year: "2-digit",
                          hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
                        })}
                      </span>
                      <span className="font-bold text-slate-800">{e.art}</span>
                      {e.ref && <span className="font-mono text-[11px] text-slate-400">{e.ref}</span>}
                      {e.actor && <span className="text-[11px] text-slate-400">durch {e.actor}</span>}
                    </div>
                    {(e.reason || e.notiz || e.meta) && (
                      <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5 break-words">
                        {e.reason || e.notiz || String(e.meta).slice(0, 200)}
                      </p>
                    )}
                  </div>
                ))}
              </>
            )}

            {reiter === "provision" && (
              <>
                <p className="text-[12.5px] text-slate-500 leading-relaxed mb-3">
                  Bezahlte Bestellungen ohne gebuchte Provision. Früher eine eigene Seite
                  (<span className="font-mono text-[11.5px]">/admin/nachbuchung</span>) — jetzt hier, wo auch der Satz steht.
                </p>
                {!kandidaten && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
                {kandidaten?.length === 0 && (
                  <p className="text-[13px] text-slate-400">Nichts offen — jede bezahlte Bestellung hat ihre Provision.</p>
                )}
                {(kandidaten ?? []).filter((k: any) => !k.agent_id || k.agent_id === id).slice(0, 40).map((k: any) => (
                  <div key={k.ref} className="py-2.5 flex flex-wrap items-center gap-2 text-[12.5px]"
                       style={{ borderBottom: "1px solid #f8fafc" }}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-slate-800 truncate">{k.customer_name || k.ref}</span>
                      <span className="block text-[11px] text-slate-400">
                        {k.pack_name} · {k.amount_cents ? eur(k.amount_cents) : "Betrag unklar"}
                        {k.agent_suggested && " · Agent vorgeschlagen"}
                      </span>
                    </span>
                    <button type="button" disabled={busy === k.ref || k.status === "betrag_unklar"}
                            onClick={async () => {
                              setBusy(k.ref);
                              const r = await fetch(`/api/fiaon/admin/commission-backfill/${encodeURIComponent(k.ref)}/book`, {
                                method: "POST", credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ agentId: k.agent_id ?? id }),
                              }).catch(() => null);
                              const j = await r?.json().catch(() => null);
                              setBusy(null);
                              setHinweis(j?.ok ? `${k.ref} gebucht.` : (j?.error || "Fehler."));
                              setKandidaten(null);
                            }}
                            className="px-3 py-2 rounded-xl text-[12px] font-semibold text-white bg-[#1d4ed8] disabled:opacity-30">
                      {busy === k.ref ? "…" : "Buchen"}
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHRICHT — Banner im Team-Portal, mit Bestätigung
// ═══════════════════════════════════════════════════════════════════════════

function NachrichtDialog({
  agentIds, team, onZu, onFertig,
}: {
  agentIds: number[]; team: Mitglied[]; onZu: () => void; onFertig: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [tage, setTage] = useState("7");
  const [alsEvent, setAlsEvent] = useState(false);
  const [titel, setTitel] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const senden = async () => {
    setBusy(true);
    const pfad = alsEvent ? "event" : "nachricht";
    const koerper = alsEvent
      ? { titel, text, auchBanner: true, von: "Betreiber" }
      : {
          agentIds, text, von: "Betreiber",
          bannerBis: tage ? new Date(Date.now() + Number(tage) * 86_400_000).toISOString() : null,
        };
    const r = await fetch(`/api/fiaon/admin/zentrale/team/${pfad}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(false);
    if (!j?.ok) { setFehler(j?.error || "Fehler."); return; }
    onFertig(j.meldung);
  };

  const namen = team.filter((m) => agentIds.includes(m.id)).map((m) => m.vorname);

  return (
    <>
      <div className="fixed inset-0 z-[410]" onClick={onZu} aria-hidden="true"
           style={{ background: "rgba(7,11,22,.6)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }} />
      <div className="fixed inset-0 z-[411] flex items-end sm:items-center justify-center sm:p-6 pointer-events-none">
        <div role="dialog" aria-modal="true" aria-label="Nachricht ans Team"
             className="w-full flex flex-col overflow-hidden pointer-events-auto"
             style={{ maxWidth: 560, maxHeight: "90vh", background: "#fff", borderRadius: 22,
                      boxShadow: "0 40px 120px -24px rgba(13,26,63,.5)" }}>
          <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <p className="text-[10.5px] font-semibold uppercase tracking-[.2em] text-slate-400">
              {alsEvent ? "Alle sehen es im Space" : `An ${agentIds.length} ${agentIds.length === 1 ? "Person" : "Personen"}`}
            </p>
            <h2 className="mt-1 text-[19px] font-bold tracking-tight text-slate-900">
              {alsEvent ? "Ereignis verkünden" : "Persönliche Nachricht"}
            </h2>
            {!alsEvent && (
              <p className="text-[12px] text-slate-400 mt-1 truncate">{namen.join(", ")}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-4">
            {fehler && <p className="mb-3 text-[12.5px] font-semibold text-amber-700">{fehler}</p>}

            <div className="flex gap-1.5 mb-3">
              {([[false, "Nachricht"], [true, "Ereignis"]] as const).map(([w, t]) => (
                <button key={String(w)} type="button" onClick={() => setAlsEvent(w)}
                        className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                        style={alsEvent === w
                          ? { background: "#1d4ed8", color: "#fff" }
                          : { background: "#f8fafc", color: "#64748b" }}>
                  {t}
                </button>
              ))}
            </div>

            {alsEvent && (
              <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Überschrift"
                     className="w-full mb-2 px-3 py-2.5 rounded-xl border border-slate-200 text-[14px] font-semibold outline-none"
                     style={{ minHeight: 42 }} />
            )}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                      placeholder={alsEvent
                        ? "Was gibt es zu verkünden? Landet als angepinnter Beitrag im Space."
                        : "Was soll die Person lesen? Erscheint als Banner über allem, bis sie „Verstanden“ klickt."}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] leading-relaxed outline-none resize-none" />

            {!alsEvent && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="text-[12.5px] text-slate-500">Banner läuft nach</label>
                <input value={tage} onChange={(e) => setTage(e.target.value)} inputMode="numeric"
                       className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 text-[13px] tabular-nums outline-none" />
                <span className="text-[12.5px] text-slate-500">Tagen ab — oder sobald bestätigt wurde.</span>
              </div>
            )}
            <p className="mt-3 text-[11.5px] text-slate-400 leading-snug">
              {alsEvent
                ? "Ein angepinnter Beitrag im Space, sichtbar für das ganze Team, dazu ein Banner für sieben Tage."
                : "Wer wann bestätigt hat, steht danach in der Team-Zentrale. Das ist der Zweck: nicht das Senden, sondern der Nachweis des Ankommens."}
            </p>
          </div>

          <div className="px-5 sm:px-7 py-4 shrink-0 flex flex-wrap items-center gap-2"
               style={{ borderTop: "1px solid #f1f5f9" }}>
            <button type="button" onClick={onZu} className="text-[13px] font-semibold text-slate-500">Abbrechen</button>
            <button type="button" onClick={() => void senden()}
                    disabled={busy || text.trim().length < 3 || (alsEvent && titel.trim().length < 3)}
                    className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] disabled:opacity-30">
              {busy ? "…" : alsEvent ? "Verkünden" : "Zustellen"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
