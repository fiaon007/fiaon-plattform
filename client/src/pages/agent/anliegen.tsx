import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentShell, ACCENT, useAgentInfo } from "./shared";
import { Reveal } from "./motion";

// ═══════════════════════════════════════════════════════════════════════════
// /agent/anliegen — was Kunden uns schreiben (E-019, 22.08.2026)
//
// Ein Anliegen ist ein Datensatz mit Zustand, keine Mail, die im Postfach
// versinkt. Hier sieht der Mitarbeiter: erst die eigenen Kunden, dann den
// Pool (Kunden ohne Betreuer), dann das, was er in den letzten 14 Tagen
// erledigt hat. Antworten landet beim Kunden im Bereich „Hilfe & Anliegen"
// UND im Verlauf der Akte — der nächste Kollege findet es.
//
// Zwei Knöpfe je Anliegen, nicht fünf: „Antworten" (offen lassen, falls noch
// etwas folgt) und „Antworten & erledigen". Wer aus dem Pool etwas übernimmt,
// tut das ausdrücklich — sonst arbeiten zwei dieselbe Frage.
// ═══════════════════════════════════════════════════════════════════════════

interface Anliegen {
  id: number; ref: string; betreff: string; text: string;
  status: "offen" | "beantwortet" | "erledigt"; antwort: string | null;
  created_at: string; updated_at: string; beantwortet_am: string | null;
  agent_id: number | null; kunde: string; email: string | null; telefon: string | null;
  betreuer: string | null; meins: boolean;
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}
const wann = (v: string | null) => v ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const alter = (v: string) => { const h = Math.floor((Date.now() - +new Date(v)) / 36e5); return h < 1 ? "gerade eben" : h < 24 ? `vor ${h} Std.` : `vor ${Math.floor(h / 24)} Tg.`; };

const CSS = `
.an-karte{position:relative;border-radius:var(--fi-radius-karte,14px);background:#fff;border:1px solid var(--fi-linie,#e2e8f0);
  box-shadow:var(--fi-schatten-ruhe),var(--fi-glanzkante);transition:box-shadow 280ms var(--fi-kurve),transform 280ms var(--fi-kurve)}
.an-karte[data-stufe="alt"]{border-left:3px solid var(--fi-tier1,#dc2626)}
.an-karte[data-stufe="offen"]{border-left:3px solid var(--fi-primaer,#1d4ed8)}
.an-karte[data-stufe="pool"]{border-left:3px solid var(--fi-tier2,#d97706)}
.an-karte[data-stufe="erledigt"]{opacity:.62}
.an-reiter{display:flex;gap:6px;background:var(--fi-flaeche-still,#f1f5f9);padding:4px;border-radius:12px}
.an-reiter button{flex:1;padding:8px 10px;border:0;border-radius:9px;background:transparent;font:600 12.5px/1 Inter,sans-serif;color:#64748b;cursor:pointer}
.an-reiter button[data-an]{background:#fff;color:#0f172a;box-shadow:var(--fi-schatten-ruhe)}
.an-antwort{width:100%;min-height:92px;border-radius:10px;border:1px solid var(--fi-linie,#e2e8f0);padding:10px 12px;font:500 13.5px/1.5 Inter,sans-serif;color:#0f172a;resize:vertical}
.an-antwort:focus{outline:2px solid ${ACCENT};outline-offset:1px;border-color:transparent}
.an-knopf{font:650 12.5px/1 Inter,sans-serif;padding:10px 14px;border-radius:10px;border:0;cursor:pointer;background:linear-gradient(180deg,#2563EB,#1D4ED8);color:#fff;box-shadow:0 5px 14px rgba(37,99,235,.3),inset 0 1px 0 rgba(255,255,255,.25)}
.an-knopf:disabled{opacity:.5;cursor:not-allowed}
.an-knopf.still{background:#fff;color:#475569;border:1px solid var(--fi-linie,#e2e8f0);box-shadow:var(--fi-schatten-ruhe)}
.an-lage{font:600 10.5px/1 Inter,sans-serif;padding:4px 9px;border-radius:999px;border:1px solid var(--fi-linie,#e2e8f0);color:#475569;background:#fff;white-space:nowrap}
.an-lage[data-t="offen"]{color:#1d4ed8;border-color:rgba(29,78,216,.25)}
.an-lage[data-t="beantwortet"]{color:#059669;border-color:rgba(5,150,105,.3)}
.an-lage[data-t="pool"]{color:#b45309;border-color:rgba(180,83,9,.3)}
.an-text{white-space:pre-wrap;font-size:13.5px;line-height:1.55;color:#1e293b}
.an-meta{font-size:11.5px;color:#94a3b8;display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px}
.an-meta b{color:#475569;font-weight:600}
`;

export default function AgentAnliegenPage() {
  return <AgentShell><Inhalt /></AgentShell>;
}

function Inhalt() {
  const { agent } = useAgentInfo();
  const [liste, setListe] = useState<Anliegen[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [reiter, setReiter] = useState<"meine" | "pool" | "erledigt">("meine");
  const [offenId, setOffenId] = useState<number | null>(null);
  const [antwort, setAntwort] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    api("/agent/tickets").then((r) => { if (r.ok) setListe(r.json.tickets || []); }).finally(() => setLaedt(false));
  }, []);
  useEffect(() => { laden(); const iv = setInterval(laden, 90_000); return () => clearInterval(iv); }, [laden]);

  const meine = useMemo(() => liste.filter((a) => a.status !== "erledigt" && a.agent_id != null), [liste]);
  const pool = useMemo(() => liste.filter((a) => a.status !== "erledigt" && a.agent_id == null), [liste]);
  const erledigt = useMemo(() => liste.filter((a) => a.status === "erledigt"), [liste]);
  const sichtbar = reiter === "meine" ? meine : reiter === "pool" ? pool : erledigt;
  const offenGesamt = liste.filter((a) => a.status === "offen").length;
  const aelterAls24h = liste.filter((a) => a.status === "offen" && Date.now() - +new Date(a.created_at) > 864e5).length;

  const senden = async (a: Anliegen, erledigen: boolean) => {
    if (antwort.trim().length < 2) return;
    setBusy(a.id); setMeldung(null);
    const r = await api(`/agent/tickets/${a.id}/antwort`, { method: "POST", body: JSON.stringify({ antwort: antwort.trim(), erledigt: erledigen }) });
    setBusy(null);
    if (r.ok) { setMeldung(erledigen ? "Beantwortet und erledigt." : "Antwort gespeichert — das Anliegen bleibt offen."); setAntwort(""); setOffenId(null); laden(); window.dispatchEvent(new Event("agent-anliegen-geaendert")); }
    else setMeldung(r.json?.error || "Das hat nicht geklappt.");
  };
  const uebernehmen = async (a: Anliegen) => {
    setBusy(a.id);
    const r = await api(`/agent/tickets/${a.id}/uebernehmen`, { method: "POST" });
    setBusy(null);
    if (r.ok) { setReiter("meine"); laden(); window.dispatchEvent(new Event("agent-anliegen-geaendert")); }
    else setMeldung(r.json?.error || "Konnte nicht übernommen werden.");
  };

  return (
    <div className="max-w-2xl pb-24 md:pb-8">
      <style>{CSS}</style>
      <Reveal index={0}>
        <h1 className="text-xl font-bold tracking-tight mb-1">Anliegen</h1>
        <p className="text-[12px] text-slate-400 mb-4">Was Kunden uns über „Hilfe & Anliegen" schreiben. Deine Antwort sehen sie in ihrem Bereich — und sie steht im Verlauf der Akte.</p>
      </Reveal>

      <Reveal index={1}>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          {[
            { label: "Offen", wert: offenGesamt, farbe: "#0f172a" },
            { label: "Im Pool", wert: pool.length, farbe: pool.length > 0 ? "#b45309" : "#94a3b8" },
            { label: "Älter als 24 h", wert: aelterAls24h, farbe: aelterAls24h > 0 ? "#dc2626" : "#94a3b8" },
          ].map((k) => (
            <div key={k.label} className="an-karte px-3.5 py-3">
              <p className="text-[22px] font-bold leading-none" style={{ color: k.farbe, fontVariantNumeric: "tabular-nums" }}>{k.wert}</p>
              <p className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-400 mt-1">{k.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal index={2}>
        <div className="an-reiter mb-4">
          <button type="button" data-an={reiter === "meine" ? "1" : undefined} onClick={() => setReiter("meine")}>Zugeteilt {meine.length > 0 ? `(${meine.length})` : ""}</button>
          <button type="button" data-an={reiter === "pool" ? "1" : undefined} onClick={() => setReiter("pool")}>Pool {pool.length > 0 ? `(${pool.length})` : ""}</button>
          <button type="button" data-an={reiter === "erledigt" ? "1" : undefined} onClick={() => setReiter("erledigt")}>Erledigt</button>
        </div>
      </Reveal>

      {meldung && <p className="text-[12.5px] mb-3" style={{ color: meldung.includes("nicht") ? "#dc2626" : "#059669" }}>{meldung}</p>}
      {laedt && liste.length === 0 && <p className="text-[13px] text-slate-400">Wird geladen …</p>}
      {!laedt && sichtbar.length === 0 && (
        <Reveal index={3}><div className="an-karte px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-slate-800">{reiter === "meine" ? "Nichts offen." : reiter === "pool" ? "Der Pool ist leer." : "Noch nichts erledigt."}</p>
          <p className="text-[12.5px] text-slate-400 mt-1">{reiter === "meine" ? "Sobald ein Kunde von dir schreibt, steht es hier." : reiter === "pool" ? "Anliegen von Kunden ohne Betreuer landen hier — wer antwortet, übernimmt sie." : "Erledigte Anliegen der letzten 14 Tage sammeln sich hier."}</p>
        </div></Reveal>
      )}

      <div className="space-y-2.5">
        {sichtbar.map((a, i) => {
          const alt24 = a.status === "offen" && Date.now() - +new Date(a.created_at) > 864e5;
          const stufe = a.status === "erledigt" ? "erledigt" : a.agent_id == null ? "pool" : alt24 ? "alt" : "offen";
          const offenHier = offenId === a.id;
          return (
            <Reveal key={a.id} index={Math.min(i + 3, 8)}>
              <div className="an-karte px-4 py-3.5" data-stufe={stufe}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-slate-900 leading-snug">{a.betreff}</p>
                    <div className="an-meta">
                      <b>{a.kunde || a.ref}</b>
                      {a.telefon && <a href={`tel:${a.telefon}`} style={{ color: ACCENT, fontWeight: 600 }}>{a.telefon}</a>}
                      <span>{alter(a.created_at)}</span>
                      {a.betreuer && !a.meins && <span>bei <b>{a.betreuer}</b></span>}
                      <a href={`/agent/kunden?ref=${encodeURIComponent(a.ref)}`} style={{ color: ACCENT, fontWeight: 600 }}>Akte</a>
                    </div>
                  </div>
                  <span className="an-lage" data-t={a.agent_id == null && a.status !== "erledigt" ? "pool" : a.status}>
                    {a.status === "erledigt" ? "Erledigt" : a.agent_id == null ? "Pool" : a.status === "beantwortet" ? "Beantwortet" : "Offen"}
                  </span>
                </div>
                <p className="an-text mt-2.5">{a.text}</p>
                {a.antwort && (
                  <div className="mt-2.5 rounded-[10px] px-3 py-2.5" style={{ background: "var(--fi-flaeche-akzent,#f1f5ff)" }}>
                    <p className="text-[11px] font-semibold text-slate-500 mb-1">Antwort{a.beantwortet_am ? ` · ${wann(a.beantwortet_am)}` : ""}</p>
                    <p className="an-text">{a.antwort}</p>
                  </div>
                )}
                {a.status !== "erledigt" && (
                  <div className="mt-3">
                    {a.agent_id == null && !offenHier ? (
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" className="an-knopf" disabled={busy === a.id} onClick={() => uebernehmen(a)}>Übernehmen</button>
                      </div>
                    ) : !offenHier ? (
                      <div className="flex gap-2 flex-wrap">
                        <button type="button" className="an-knopf" onClick={() => { setOffenId(a.id); setAntwort(a.antwort ? "" : ""); }}>{a.antwort ? "Erneut antworten" : "Antworten"}</button>
                        {a.antwort && <button type="button" className="an-knopf still" disabled={busy === a.id} onClick={async () => { setBusy(a.id); const r = await api(`/agent/tickets/${a.id}/antwort`, { method: "POST", body: JSON.stringify({ antwort: a.antwort, erledigt: true }) }); setBusy(null); if (r.ok) laden(); }}>Erledigt</button>}
                      </div>
                    ) : (
                      <div>
                        <textarea className="an-antwort" value={antwort} onChange={(e) => setAntwort(e.target.value)} placeholder={`Antwort an ${a.kunde || "den Kunden"} — kurz, konkret, in Sie-Form.`} autoFocus />
                        <div className="flex gap-2 flex-wrap mt-2">
                          <button type="button" className="an-knopf" disabled={busy === a.id || antwort.trim().length < 2} onClick={() => senden(a, true)}>Antworten &amp; erledigen</button>
                          <button type="button" className="an-knopf still" disabled={busy === a.id || antwort.trim().length < 2} onClick={() => senden(a, false)}>Antworten, offen lassen</button>
                          <button type="button" className="an-knopf still" onClick={() => { setOffenId(null); setAntwort(""); }}>Abbrechen</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Reveal>
          );
        })}
      </div>
      {agent && <p className="text-[11px] text-slate-400 mt-6">Angemeldet als {agent.name}. Der Pool zeigt Kunden ohne Betreuer — Leitung und Admin sehen alle Anliegen.</p>}
    </div>
  );
}
