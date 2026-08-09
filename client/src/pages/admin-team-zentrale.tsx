import { useCallback, useEffect, useMemo, useState } from "react";
import {
  InviteModal, MilestoneTasksCard, PartnerSuggestionsCard, ScriptsAdmin, SettingsCard,
} from "@/components/admin/TeamVerwaltung";
import { FiaonEbene } from "@/components/FiaonEbene";

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
  /** Maskiert — die vollständige IBAN kommt nur über den eigenen Endpunkt. */
  bank_iban_masked: string | null;
}

const ROLLE_TEXT: Record<string, string> = {
  agent: "Vertrieb", vertriebsleiter: "Vertriebsleitung", onboarding: "Onboarding",
  inkasso: "Forderungsmanagement",
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
  // Vier Blöcke, die aus der Altseite nachgezogen wurden. Reiter statt einer
  // endlos langen Seite: Wer Skripte pflegt, will nicht an dreißig
  // Mitarbeiterkarten vorbeiscrollen.
  const [reiter, setReiter] = useState<
    "menschen" | "neu" | "partner" | "praemien" | "skripte" | "einstellungen"
  >(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    return (["menschen", "neu", "partner", "praemien", "skripte", "einstellungen"].includes(String(t))
      ? t : "menschen") as any;
  });
  const [einladen, setEinladen] = useState(
    () => new URLSearchParams(window.location.search).get("einladen") === "1",
  );

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
            <button type="button" onClick={() => setNachrichtAn(team.filter((m) => m.active && (!m.is_test_account || m.pruefkonto)).map((m) => m.id))}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold bg-white border border-slate-200 text-slate-600">
              Nachricht ans Team
            </button>
            <button type="button" onClick={() => setEinladen(true)}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white bg-[#1d4ed8]">
              Teammitglied anlegen
            </button>
          </div>
        </div>

        {/* ── Reiter ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {([
            ["menschen", "Menschen"],
            ["neu", "Neu im Team"],
            ["partner", "Partner-Anfragen"],
            ["praemien", "Meilenstein-Prämien"],
            ["skripte", "Skripte & Leitfäden"],
            ["einstellungen", "Einstellungen"],
          ] as const).map(([w, t]) => (
            <button key={w} type="button"
                    onClick={() => {
                      setReiter(w);
                      const p = new URLSearchParams(window.location.search);
                      w === "menschen" ? p.delete("tab") : p.set("tab", w);
                      window.history.replaceState(null, "", `/admin/team${p.toString() ? `?${p}` : ""}`);
                    }}
                    className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                    style={reiter === w
                      ? { background: "#1d4ed8", color: "#fff" }
                      : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
              {t}
            </button>
          ))}
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

        {reiter === "neu" && <NeuImTeam onNachricht={(id) => setNachrichtAn([id])} />}
        {reiter === "partner" && (
          <PartnerSuggestionsCard flash={(m) => setMeldung({ art: "gut", text: m })} onChanged={laden} />
        )}
        {reiter === "praemien" && (
          <MilestoneTasksCard flash={(m) => setMeldung({ art: "gut", text: m })} />
        )}
        {reiter === "skripte" && (
          <ScriptsAdmin flash={(m) => setMeldung({ art: "gut", text: m })} />
        )}
        {reiter === "einstellungen" && (
          <SettingsCard flash={(m) => setMeldung({ art: "gut", text: m })} onSaved={laden} />
        )}

        {reiter === "menschen" && (
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
        )}
        <style>{`
          @keyframes teamAuf { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
          @media (prefers-reduced-motion: reduce) { [style*="teamAuf"] { animation: none !important } }
        `}</style>
      </div>

      {offen != null && (
        <MitgliedDetail id={offen} team={team} onZu={() => setOffen(null)}
                        onNachricht={(id) => setNachrichtAn([id])} onAenderung={laden} />
      )}
      {einladen && (
        <InviteModal
          defaults={{ commissionRateBp: 1500 }}
          onClose={() => setEinladen(false)}
          onDone={() => { setEinladen(false); void laden(); }}
          flash={(m: string) => setMeldung({ art: "gut", text: m })}
        />
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
  const [reiter, setReiter] = useState<
    "zahlen" | "verwaltung" | "protokoll" | "provision" | "verguetung"
  >("zahlen");
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
    <FiaonEbene
      offen onZu={onZu}
      titel={m.name}
      ueberschrift={ROLLE_TEXT[m.rolle] ?? m.rolle}
      unterzeile={`${m.email} · zuletzt ${wann(m.last_login_at)} angemeldet`}
      breite={760}
      marke={<Avatar src={m.avatar} name={m.name} size={36} />}
      kopf={
        <>
          <div className="flex items-start gap-3">
            <Avatar src={m.avatar} name={m.name} size={44} />
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-bold tracking-tight text-slate-900" style={{ overflowWrap: "anywhere" }}>
                {m.name}
              </h2>
              {/* UMBRECHEN statt kürzen — der Betreiber hat abgeschnittene
                  Texte gemeldet. Eine Mailadresse, die man nicht ganz sieht,
                  kann man nicht abtippen. */}
              <p className="text-[12px] text-slate-400 leading-snug" style={{ overflowWrap: "anywhere" }}>
                {ROLLE_TEXT[m.rolle] ?? m.rolle} · {m.email}
                <br />zuletzt {wann(m.last_login_at)} angemeldet
              </p>
            </div>
            <button type="button" onClick={onZu} aria-label="Schließen" className="fi-ebene-kreuz shrink-0">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
                   strokeWidth={1.6} strokeLinecap="round"><path d="m5 5 10 10M15 5 5 15" /></svg>
            </button>
          </div>
          {/* Die Reiterleiste rollt waagerecht, statt umzubrechen: Sechs
              Reiter auf 380 px sind sonst drei Zeilen hoch. */}
          <div className="mt-3.5 flex gap-1.5 overflow-x-auto pb-0.5"
               style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {([["zahlen", "Zahlen"], ["verwaltung", "Verwaltung"], ["provision", "Provisionen"],
               ["verguetung", "Vergütung & Stunden"], ["protokoll", "Protokoll"]] as const)
              .map(([w, t]) => (
                <button key={w} type="button" onClick={() => setReiter(w)}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-[12.5px] font-semibold whitespace-nowrap"
                        style={reiter === w
                          ? { background: "#1d4ed8", color: "#fff", boxShadow: "0 8px 18px -10px rgba(29,78,216,.6)" }
                          : { background: "rgba(15,23,42,.045)", color: "#64748b" }}>
                  {t}
                </button>
              ))}
            <button type="button" onClick={() => onNachricht(m.id)}
                    className="shrink-0 ml-auto px-3 py-1.5 rounded-xl text-[12.5px] font-semibold bg-white text-slate-600"
                    style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
              Nachricht
            </button>
          </div>
        </>
      }
      kinder={
        <>
          {hinweis && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">{hinweis}</p>}

          {reiter === "zahlen" && (
            <>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
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
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{k.t}</p>
                    <p className="text-[17px] font-bold text-slate-900 tabular-nums leading-tight mt-0.5">{k.w}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
                Provisionssatz
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                       aria-label="Provisionssatz in Prozent"
                       className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums outline-none"
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

          {reiter === "verwaltung" && (
            <VerwaltungTafel m={m} onAenderung={onAenderung} onHinweis={setHinweis} onZu={onZu} />
          )}

          {reiter === "verguetung" && <VerguetungTafel agentId={id} rolle={m.rolle} />}

          {reiter === "protokoll" && (
            <>
              {/* Die „genaue Klicks"-Ansicht. Alles hier steht seit Monaten
                  in der Datenbank — es war nur nie an einem Ort lesbar. */}
              <div className="flex flex-wrap gap-2 mb-3">
                <input value={logSuche} onChange={(e) => setLogSuche(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") void logsLaden(); }}
                       placeholder="Im Protokoll suchen …"
                       className="flex-1 min-w-[150px] px-3 py-2 rounded-xl border border-slate-200 text-[13px] outline-none"
                       style={{ minHeight: 40 }} />
                <select value={logArt} onChange={(e) => setLogArt(e.target.value)}
                        aria-label="Art"
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
                    <p className="text-[11.5px] text-slate-500 leading-snug mt-0.5"
                       style={{ overflowWrap: "anywhere" }}>
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
                    <span className="block font-semibold text-slate-800" style={{ overflowWrap: "anywhere" }}>
                      {k.customer_name || k.ref}
                    </span>
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
        </>
      }
    />
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
    <FiaonEbene
      offen onZu={onZu}
      titel={alsEvent ? "Ereignis verkünden" : "Persönliche Nachricht"}
      ueberschrift={alsEvent
        ? "Alle sehen es im Space"
        : `An ${agentIds.length} ${agentIds.length === 1 ? "Person" : "Personen"}`}
      unterzeile={alsEvent ? undefined : namen.join(", ")}
      breite={560}
      fuss={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onZu} className="text-[13px] font-semibold text-slate-500">
            Abbrechen
          </button>
          <button type="button" onClick={() => void senden()}
                  disabled={busy || text.trim().length < 3 || (alsEvent && titel.trim().length < 3)}
                  className="ml-auto px-5 py-2.5 rounded-xl text-[14px] font-bold text-white bg-[#1d4ed8] disabled:opacity-30"
                  style={{ boxShadow: "0 12px 26px -12px rgba(29,78,216,.6)" }}>
            {busy ? "…" : alsEvent ? "Verkünden" : "Zustellen"}
          </button>
        </div>
      }
      kinder={
        <>
          {fehler && <p className="mb-3 text-[12.5px] font-semibold text-amber-700">{fehler}</p>}

          <div className="flex gap-1.5 mb-3">
            {([[false, "Nachricht"], [true, "Ereignis"]] as const).map(([w, t]) => (
              <button key={String(w)} type="button" onClick={() => setAlsEvent(w)}
                      className="px-3 py-1.5 rounded-xl text-[12.5px] font-semibold"
                      style={alsEvent === w
                        ? { background: "#1d4ed8", color: "#fff" }
                        : { background: "rgba(15,23,42,.045)", color: "#64748b" }}>
                {t}
              </button>
            ))}
          </div>

          {alsEvent && (
            <input value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Überschrift"
                   aria-label="Überschrift"
                   className="w-full mb-2 px-3 py-2.5 rounded-xl border border-slate-200 text-[14px] font-semibold outline-none"
                   style={{ minHeight: 42 }} />
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
                    aria-label="Text"
                    placeholder={alsEvent
                      ? "Was gibt es zu verkünden? Landet als angepinnter Beitrag im Space."
                      : "Was soll die Person lesen? Erscheint als Banner über allem, bis sie „Verstanden“ klickt."}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] leading-relaxed outline-none resize-none" />

          {!alsEvent && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="text-[12.5px] text-slate-500">Banner läuft nach</label>
              <input value={tage} onChange={(e) => setTage(e.target.value)} inputMode="numeric"
                     aria-label="Tage"
                     className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 text-[13px] tabular-nums outline-none" />
              <span className="text-[12.5px] text-slate-500">Tagen ab — oder sobald bestätigt wurde.</span>
            </div>
          )}
          <p className="mt-3 text-[11.5px] text-slate-400 leading-snug">
            {alsEvent
              ? "Ein angepinnter Beitrag im Space, sichtbar für das ganze Team, dazu ein Banner für sieben Tage."
              : "Wer wann bestätigt hat, steht danach in der Team-Zentrale. Das ist der Zweck: nicht das Senden, sondern der Nachweis des Ankommens."}
          </p>
        </>
      }
    />
  );

}


// ═══════════════════════════════════════════════════════════════════════════
// NEU IM TEAM — wer hängt?
//
// Die Frage, die der Betreiber sonst nie stellt, weil sie Arbeit macht: Ist der
// Kollege von letzter Woche eigentlich angekommen? „Vertrag ✓, Erklärung ✓,
// Checkliste 3/7, noch keine Dokumentation" beantwortet sie in einer Zeile.
// ═══════════════════════════════════════════════════════════════════════════
function NeuImTeam({ onNachricht }: { onNachricht: (id: number) => void }) {
  const [neue, setNeue] = useState<any[] | null>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/erste-schritte", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setNeue(j?.ok ? j.neue : []))
      .catch(() => setNeue([]));
  }, []);

  if (!neue) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;
  if (neue.length === 0) {
    return (
      <p className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-[13px] text-slate-400">
        In den letzten 90 Tagen ist niemand neu dazugekommen.
      </p>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <p className="px-4 pt-4 pb-2 text-[12px] text-slate-500 leading-relaxed">
        Einarbeitung der letzten 90 Tage. „Hängt" heißt: seit über einer Woche dabei und noch
        kein einziges Ergebnis dokumentiert — dann fehlt es meistens nicht am Willen, sondern
        an einer Frage, die niemand gestellt hat.
      </p>
      {neue.map((n) => (
        <div key={n.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1"
             style={{ borderTop: "1px solid #f1f5f9" }}>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-slate-900">
              {n.name}
              {n.haengt && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(217,119,6,.1)", color: "#b45309" }}>
                  hängt
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-slate-400">
              {ROLLE_TEXT[n.rolle] ?? n.rolle} · dabei seit{" "}
              {new Date(n.seit).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
              {n.letzterLogin && ` · zuletzt ${wann(n.letzterLogin)} angemeldet`}
            </p>
          </div>
          <span className="text-[12px] text-slate-500">
            Vertrag {n.vertrag ? "ja" : "—"} · Erklärung {n.zusage ? "ja" : "—"}
          </span>
          <span className="text-[12.5px] font-semibold tabular-nums text-slate-700">
            Checkliste {n.fertig}/{n.gesamt}
          </span>
          <span className="text-[12px] text-slate-500">
            {n.ersteDokumentation
              ? `erste Doku ${new Date(n.ersteDokumentation).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}`
              : "noch keine Dokumentation"}
          </span>
          <button type="button" onClick={() => onNachricht(n.id)}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-semibold bg-white border border-slate-200 text-slate-600">
            Nachfassen
          </button>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VERGÜTUNG & STUNDEN
//
// Die Platzhalter sind ABSICHTLICH auffällig und stehen unter dem Hinweis
// „vom Betreiber zu bestätigen". Solange `verguetung_bestaetigt_am` leer ist,
// wird KEINE Prämie gebucht und lassen sich KEINE Stunden abrechnen — ein
// stiller Vorgabewert, den niemand prüft, wird sonst zur echten Abrechnung.
// ═══════════════════════════════════════════════════════════════════════════
function VerguetungTafel({ agentId, rolle }: { agentId: number; rolle: string }) {
  const [daten, setDaten] = useState<any>(null);
  const [satz, setSatz] = useState("");
  const [art, setArt] = useState("euro");
  const [wert, setWert] = useState("");
  const [monat, setMonat] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await fetch(`/api/fiaon/admin/inkasso/stunden/${agentId}`, { credentials: "include" }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) {
      setDaten(j);
      const v = j.verdienst ?? {};
      setSatz(String((Number(v.stundensatzCents ?? 0) / 100).toFixed(2)).replace(".", ","));
      setArt(String(v.praemieArt || "euro"));
      setWert(String((Number(v.praemieWert ?? 0) / 100).toFixed(2)).replace(".", ","));
    }
  }, [agentId]);
  useEffect(() => { void laden(); }, [laden]);

  if (!daten) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;
  const v = daten.verdienst ?? {};
  const offen = (daten.stunden ?? []).filter((s: any) => !s.bestaetigt_am);

  const speichern = async () => {
    setBusy("satz");
    const r = await fetch(`/api/fiaon/admin/inkasso/verguetung/${agentId}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stundensatzEuro: Number(satz.replace(",", ".")),
        praemieArt: art,
        praemieWert: Number(wert.replace(",", ".")),
      }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    setHinweis(j?.meldung || j?.error || "Fehler.");
    void laden();
  };

  return (
    <>
      {hinweis && <p className="mb-3 text-[12.5px] font-semibold text-emerald-700">{hinweis}</p>}

      {!v.verguetungBestaetigt && (
        <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] leading-relaxed"
           style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
          <b>Vom Betreiber zu bestätigen.</b> Die Werte unten sind Platzhalter. Solange du sie
          nicht bestätigt hast, wird keine Prämie gebucht und lassen sich keine Stunden
          abrechnen — die Arbeit wird aber vollständig festgehalten und ist nachträglich
          abrechenbar.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Stundensatz (€)
          </label>
          <input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal"
                 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
            Prämie je eingezogener Rate
          </label>
          <div className="flex gap-1.5">
            <input value={wert} onChange={(e) => setWert(e.target.value)} inputMode="decimal"
                   className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-slate-200 text-[13.5px] tabular-nums" />
            <select value={art} onChange={(e) => setArt(e.target.value)}
                    className="px-2.5 py-2.5 rounded-xl border border-slate-200 text-[13px]">
              <option value="euro">€</option>
              <option value="prozent">% der Rate</option>
            </select>
          </div>
        </div>
      </div>
      <button type="button" onClick={() => void speichern()} disabled={busy === "satz"}
              className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#1d4ed8] disabled:opacity-40">
        {busy === "satz" ? "…" : v.verguetungBestaetigt ? "Vergütung ändern" : "Vergütung bestätigen"}
      </button>
      <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
        Änderungen wirken auf künftige Prämien und Abrechnungen. Bereits gebuchte bleiben, wie
        sie sind. Eine Prämie entsteht nur, wenn eine Rate <b>bankbestätigt gebucht</b> wird und
        vorher dokumentiert bearbeitet wurde — Selbstzahler erzeugen keine.
      </p>

      {/* ── Stunden bestätigen ────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mt-5 mb-2">
        Stunden bestätigen
      </p>
      <div className="grid grid-cols-3 gap-2.5 mb-3">
        {[
          { t: "Offen", w: `${Math.floor(Number(v.offeneMinuten ?? 0) / 60)} Std ${Number(v.offeneMinuten ?? 0) % 60} Min` },
          { t: "Bestätigt (Monat)", w: `${Math.floor(Number(v.bestaetigtMinuten ?? 0) / 60)} Std` },
          { t: "Prämien (Monat)", w: `${(Number(v.praemienCents ?? 0) / 100).toFixed(2).replace(".", ",")} €` },
        ].map((k) => (
          <div key={k.t} className="p-3 rounded-xl bg-slate-50">
            <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400">{k.t}</p>
            <p className="text-[15px] font-bold tabular-nums text-slate-900 mt-0.5">{k.w}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="month" value={monat} onChange={(e) => setMonat(e.target.value)}
               className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px]" />
        <button type="button" disabled={busy === "best" || offen.length === 0}
                onClick={async () => {
                  setBusy("best");
                  const r = await fetch(`/api/fiaon/admin/inkasso/stunden/${agentId}/bestaetigen`, {
                    method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ monat }),
                  }).catch(() => null);
                  const j = await r?.json().catch(() => null);
                  setBusy(null);
                  setHinweis(j?.meldung || j?.error || "Fehler.");
                  void laden();
                }}
                className="px-4 py-2.5 rounded-xl text-[13px] font-bold text-white bg-[#047857] disabled:opacity-30">
          {busy === "best" ? "…" : "Monat bestätigen"}
        </button>
      </div>
      <p className="mt-2 text-[11.5px] text-slate-400 leading-snug">
        Bestätigen macht die Zeilen <b>unveränderlich</b> und legt sie als Position in den
        Auszahlungsweg. Auch du kannst sie danach nicht mehr ändern — das schützt beide Seiten.
      </p>

      <div className="mt-4">
        {(daten.stunden ?? []).slice(0, 30).map((s: any) => (
          <div key={s.id} className="py-2 flex flex-wrap items-center gap-x-3 text-[12.5px]"
               style={{ borderBottom: "1px solid #f8fafc" }}>
            <span className="font-semibold tabular-nums text-slate-800">
              {new Date(s.tag).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" })}
            </span>
            <span className="tabular-nums text-slate-500">
              {String(s.von).slice(0, 5)}–{String(s.bis).slice(0, 5)}
            </span>
            <span className="font-bold tabular-nums text-slate-800">
              {Math.floor(s.minuten / 60)}:{String(s.minuten % 60).padStart(2, "0")}
            </span>
            {s.notiz && <span className="text-[11.5px] text-slate-400 truncate">{s.notiz}</span>}
            <span className="ml-auto text-[11.5px] font-semibold"
                  style={{ color: s.bestaetigt_am ? "#047857" : "#b45309" }}>
              {s.bestaetigt_am ? "bestätigt" : "wartet"}
            </span>
          </div>
        ))}
        {(daten.stunden ?? []).length === 0 && (
          <p className="text-[13px] text-slate-400">
            {rolle === "inkasso"
              ? "Noch keine Zeiten erfasst."
              : "Zeiterfassung nutzt bisher nur das Forderungsmanagement."}
          </p>
        )}
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// VERWALTUNG — die Vollständigkeitsliste an einem Ort
//
// Der Betreiber musste bisher für Reset, Deaktivieren, Rolle, Bank und
// Umhängen zwischen Ansichten wechseln oder auf eine gelöschte Altseite. Alles
// davon liegt jetzt in einem Reiter im Mitarbeiter-Detail — ohne Seitenwechsel.
//
// Die Endpunkte sind unverändert die bestehenden. Neu gebaut wurde nur die
// LÖSCHUNG, weil es sie noch nicht gab.
// ═══════════════════════════════════════════════════════════════════════════
function VerwaltungTafel({
  m, onAenderung, onHinweis, onZu,
}: {
  m: Mitglied; onAenderung: () => void;
  onHinweis: (t: string) => void; onZu: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [bank, setBank] = useState<any>(null);
  const [loeschen, setLoeschen] = useState<any>(null);
  const [wortlaut, setWortlaut] = useState("");

  const ruf = async (pfad: string, koerper?: any, name = pfad) => {
    setBusy(name);
    const r = await fetch(`/api/fiaon${pfad}`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper ?? {}),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setBusy(null);
    onHinweis(j?.meldung || j?.error || (j?.ok ? "Erledigt." : "Fehler."));
    if (j?.ok) onAenderung();
    return j;
  };

  const ROLLEN: { wert: string; text: string; erklaerung: string }[] = [
    { wert: "agent", text: "Vertrieb", erklaerung: "Sieht nur die eigenen Kunden." },
    { wert: "vertriebsleiter", text: "Vertriebsleitung", erklaerung: "Sieht alle Kunden, kann zuweisen und korrigieren." },
    { wert: "onboarding", text: "Onboarding", erklaerung: "Führt die Startgespräche." },
    { wert: "inkasso", text: "Forderungsmanagement", erklaerung: "Sieht nur bezahlte Kunden mit laufender Ratenzahlung." },
  ];

  return (
    <>
      {/* ── Rolle ────────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Rolle</p>
      <div className="space-y-1.5 mb-5">
        {ROLLEN.map((r) => {
          const aktiv = String(m.rolle) === r.wert;
          return (
            <button key={r.wert} type="button" disabled={aktiv || busy != null}
                    onClick={() => void ruf(`/admin/agents/${m.id}/rolle`, { rolle: r.wert }, r.wert)}
                    className="w-full text-left px-3.5 py-2.5 rounded-xl disabled:cursor-default"
                    style={aktiv
                      ? { background: "rgba(29,78,216,.07)", boxShadow: "inset 0 0 0 1px rgba(29,78,216,.28)" }
                      : { background: "#f8fafc", boxShadow: "inset 0 0 0 1px transparent" }}>
              <span className="flex items-baseline gap-2">
                <span className="text-[13px] font-bold" style={{ color: aktiv ? "#1d4ed8" : "#0f172a" }}>
                  {r.text}
                </span>
                {aktiv && <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#1d4ed8]">aktuell</span>}
              </span>
              <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">{r.erklaerung}</span>
            </button>
          );
        })}
      </div>

      {/* ── Zugang ───────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Zugang</p>
      <div className="flex flex-wrap gap-1.5 mb-1.5">
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/force-reset`, {}, "reset")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700 disabled:opacity-40"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "reset" ? "…" : "Passwort-Reset erzwingen"}
        </button>
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/reinvite`, {}, "reinvite")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700 disabled:opacity-40"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "reinvite" ? "…" : "Einladung erneut senden"}
        </button>
        <button type="button" disabled={busy != null}
                onClick={() => void ruf(`/admin/agents/${m.id}/toggle`, {}, "toggle")}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold disabled:opacity-40"
                style={m.active
                  ? { background: "rgba(217,119,6,.08)", color: "#b45309" }
                  : { background: "rgba(5,150,105,.08)", color: "#047857" }}>
          {busy === "toggle" ? "…" : m.active ? "Deaktivieren" : "Wieder aktivieren"}
        </button>
      </div>
      <p className="text-[11.5px] text-slate-400 leading-snug mb-5">
        Ein Reset entwertet alle Sitzungen sofort und schickt einen Link, der eine Stunde gilt.
      </p>

      {/* ── Bankdaten ────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bankdaten</p>
      {bank ? (
        <p className="text-[13px] font-mono text-slate-800 mb-1.5" style={{ overflowWrap: "anywhere" }}>
          {bank.holder} · {bank.iban}{bank.bic ? ` · ${bank.bic}` : ""}
        </p>
      ) : (
        <p className="text-[12.5px] text-slate-500 mb-1.5">
          {m.bank_iban_masked || "Keine Bankdaten hinterlegt."}
        </p>
      )}
      {!bank && m.bank_iban_masked && (
        <button type="button" disabled={busy === "bank"}
                onClick={async () => {
                  setBusy("bank");
                  const r = await fetch(`/api/fiaon/admin/team/agents/${m.id}/bank`, { credentials: "include" }).catch(() => null);
                  const j = await r?.json().catch(() => null);
                  setBusy(null);
                  if (j?.ok) setBank(j.bank ?? j);
                  else onHinweis(j?.error || "Nicht abrufbar.");
                }}
                className="px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-white text-slate-700"
                style={{ boxShadow: "inset 0 0 0 1px #e2e8f0" }}>
          {busy === "bank" ? "…" : "Vollständig anzeigen"}
        </button>
      )}
      <p className="text-[11.5px] text-slate-400 leading-snug mt-1.5 mb-5">
        Das vollständige Anzeigen wird protokolliert — eine IBAN ist ein Zahlungsziel.
      </p>

      {/* ── Löschen ──────────────────────────────────────────────────────── */}
      <p className="text-[10.5px] font-bold uppercase tracking-wider mb-2" style={{ color: "#b91c1c" }}>
        Mitarbeiter löschen
      </p>
      {!loeschen ? (
        <>
          <button type="button" disabled={busy === "vorschau"}
                  onClick={async () => {
                    setBusy("vorschau");
                    const r = await fetch(`/api/fiaon/admin/agents/${m.id}/loesch-vorschau`, { credentials: "include" }).catch(() => null);
                    const j = await r?.json().catch(() => null);
                    setBusy(null);
                    if (j?.ok) { setLoeschen(j); setWortlaut(""); }
                    else onHinweis(j?.error || "Vorschau nicht möglich.");
                  }}
                  className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white disabled:opacity-40"
                  style={{ background: "#b91c1c", boxShadow: "0 10px 22px -12px rgba(185,28,28,.5)" }}>
            {busy === "vorschau" ? "…" : "Löschen …"}
          </button>
          <p className="text-[11.5px] text-slate-400 leading-snug mt-1.5">
            Wer Provisionen hat, wird anonymisiert statt entfernt — die Buchungen bleiben nach
            § 147 AO zehn Jahre lesbar. Die Vorschau zeigt vorher, was gilt.
          </p>
        </>
      ) : (
        <div className="p-3.5 rounded-2xl"
             style={{ background: "rgba(185,28,28,.045)", boxShadow: "inset 0 0 0 1px rgba(185,28,28,.16)" }}>
          <p className="text-[13px] font-bold" style={{ color: "#b91c1c" }}>
            {loeschen.art === "endgueltig" ? "Wird vollständig entfernt" : "Wird anonymisiert"}
          </p>
          {loeschen.hinweise.map((h: string, i: number) => (
            <p key={i} className="text-[12px] text-slate-600 leading-relaxed mt-1.5">{h}</p>
          ))}
          <label className="block text-[12px] font-semibold text-slate-600 mt-3 mb-1">
            Zur Bestätigung eintippen: <span className="font-mono text-slate-900">{loeschen.bestaetigung}</span>
          </label>
          <input value={wortlaut} onChange={(e) => setWortlaut(e.target.value)}
                 aria-label="Bestätigungstext"
                 className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] outline-none" />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setLoeschen(null)}
                    className="text-[12.5px] font-semibold text-slate-500">Abbrechen</button>
            <button type="button"
                    disabled={busy === "loeschen" || wortlaut.trim() !== loeschen.bestaetigung}
                    onClick={async () => {
                      const j = await ruf(`/admin/agents/${m.id}/loeschen`, { bestaetigung: wortlaut }, "loeschen");
                      if (j?.ok) onZu();
                    }}
                    className="ml-auto px-4 py-2.5 rounded-xl text-[13px] font-bold text-white disabled:opacity-30"
                    style={{ background: "#b91c1c" }}>
              {busy === "loeschen" ? "Läuft …" : "Ausführen"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
