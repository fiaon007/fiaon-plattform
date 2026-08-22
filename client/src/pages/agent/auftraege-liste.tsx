// ═══════════════════════════════════════════════════════════════════════════
// Aufträge der Leitung — die Gegenseite von Justins Liste (E-028, 22.08.2026)
//
// Justin übergibt eine Aufgabe → sie steht hier. Der Mitarbeiter nimmt an,
// stellt eine Rückfrage (geht sofort zu Justin zurück), meldet ein Ergebnis
// oder gibt den Auftrag begründet zurück. Jede Bewegung steht in der
// Zeitleiste, die beide Seiten sehen. Wird auf /agent/aufgaben eingebettet.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { ACCENT } from "./shared";

interface Beitrag { id: number; autorArt: "betreiber" | "agent" | "system"; autorName: string; art: "kommentar" | "frage" | "antwort" | "ergebnis" | "status"; text: string; am: string }
interface Auftrag {
  id: number; titel: string; text: string | null; bereich: string; prioritaet: number; faelligAm: string | null; link: string | null;
  status: "offen" | "in_arbeit" | "wartet" | "erledigt"; frageOffen: boolean; ergebnis: string | null; erledigtAm: string | null; delegiertAm: string | null;
  zeitleiste: Beitrag[];
}

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json, error: (json?.error as string | undefined) || (res.ok ? undefined : `Fehler ${res.status}`) };
}
const zeit = (v: string | null) => v ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const tag = (iso: string | null) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
const PRIO: Record<number, string> = { 1: "heute", 2: "diese Woche", 3: "wenn Zeit ist" };
const STATUS: Record<Auftrag["status"], { label: string; farbe: string }> = {
  offen: { label: "Neu — bitte annehmen", farbe: "#d97706" }, in_arbeit: { label: "In Arbeit", farbe: "#1d4ed8" }, wartet: { label: "Wartet auf Justins Antwort", farbe: "#b45309" }, erledigt: { label: "Erledigt", farbe: "#059669" },
};

const CSS = `
.af-karte{background:#fff;border:1px solid var(--fi-linie,#e2e8f0);border-radius:var(--fi-radius-karte,14px);box-shadow:var(--fi-schatten-ruhe),var(--fi-glanzkante);overflow:hidden}
.af-karte[data-status="offen"]{border-left:3px solid #d97706}
.af-karte[data-status="in_arbeit"]{border-left:3px solid #1d4ed8}
.af-karte[data-status="wartet"]{border-left:3px solid #b45309}
.af-karte[data-status="erledigt"]{opacity:.7}
.af-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.af-status i{width:7px;height:7px;border-radius:50%;background:currentColor}
.af-knopf{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:11px;font-size:13px;font-weight:700;border:1px solid var(--fi-linie,#e2e8f0);background:#fff;color:#0f172a;transition:all 180ms var(--fi-kurve)}
.af-knopf[data-haupt="1"]{background:linear-gradient(180deg,#2563eb,#1d4ed8);color:#fff;border-color:transparent;box-shadow:0 4px 12px -4px rgba(37,99,235,.6)}
.af-knopf[data-gut="1"]{background:linear-gradient(180deg,#10b981,#059669);color:#fff;border-color:transparent}
.af-knopf:disabled{opacity:.5}
.af-feld{width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--fi-linie,#e2e8f0);font-size:14px;outline:none;background:#fff}
.af-feld:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.af-blase{padding:9px 11px;border-radius:11px;font-size:13px;line-height:1.45;max-width:92%}
.af-blase[data-wer="betreiber"]{background:#f1f5f9;color:#0f172a;border-bottom-left-radius:4px}
.af-blase[data-wer="agent"]{margin-left:auto;background:#1d4ed8;color:#fff;border-bottom-right-radius:4px}
.af-blase[data-wer="system"]{margin:0 auto;background:none;color:#94a3b8;font-size:11.5px;text-align:center;max-width:100%;padding:2px 0}
.af-blase[data-art="frage"]{border:1px solid #f59e0b}
.af-blase[data-art="ergebnis"]{border:1px solid #10b981}
.af-blase small{display:block;font-size:10.5px;opacity:.7;margin-top:3px}
.af-fehler{padding:9px 12px;border-radius:10px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.25);color:#b91c1c;font-size:12.5px;font-weight:600}
`;

export function AuftraegeListe({ onGeaendert }: { onGeaendert?: () => void }) {
  const [liste, setListe] = useState<Auftrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const r = await api("/agent/auftraege");
    if (r.ok) { setListe(r.json.auftraege); setFehler(null); } else setFehler(r.error || "Die Aufträge kamen nicht.");
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const ersetzen = (t: Auftrag) => { setListe((alt) => (alt || []).map((x) => (x.id === t.id ? t : x))); onGeaendert?.(); window.dispatchEvent(new Event("agent-aufgaben-geaendert")); };

  if (liste === null && !fehler) return <p className="text-[13px] text-slate-400">Wird geladen …</p>;
  return (
    <div className="space-y-3">
      <style>{CSS}</style>
      {fehler && <div className="af-fehler">{fehler}</div>}
      {liste && liste.length === 0 && (
        <div className="au-karte px-5 py-8 text-center">
          <p className="text-[14px] font-semibold text-slate-800">Keine Aufträge.</p>
          <p className="text-[12.5px] text-slate-400 mt-1">Wenn Justin dir eine Aufgabe übergibt, steht sie hier — mit allem, was du dazu wissen musst.</p>
        </div>
      )}
      {(liste || []).map((a) => <Karte key={a.id} a={a} onChange={ersetzen} onWeg={() => { void laden(); onGeaendert?.(); window.dispatchEvent(new Event("agent-aufgaben-geaendert")); }} />)}
    </div>
  );
}

function Karte({ a, onChange, onWeg }: { a: Auftrag; onChange: (t: Auftrag) => void; onWeg: () => void }) {
  const [modus, setModus] = useState<null | "frage" | "ergebnis" | "zurueck" | "kommentar">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeitleisteAuf, setZeitleisteAuf] = useState(a.status === "wartet" || a.status === "in_arbeit");

  const tun = async (pfad: string, body?: any) => {
    setBusy(true); setFehler(null);
    const r = await api(`/agent/auftraege/${a.id}/${pfad}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) { setFehler(r.error || "Das hat nicht geklappt."); return false; }
    if (r.json?.todo) onChange(r.json.todo); else onWeg();
    setModus(null); setText("");
    return true;
  };
  const st = STATUS[a.status];
  const letzteFrage = a.frageOffen ? [...a.zeitleiste].reverse().find((b) => b.art === "frage") : null;

  return (
    <div className="af-karte" data-status={a.status}>
      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <span className="af-status" style={{ color: st.farbe }}><i />{st.label}</span>
          <span className="text-[11px] text-slate-400">{a.faelligAm ? `bis ${tag(a.faelligAm)}` : `Priorität ${a.prioritaet} · ${PRIO[a.prioritaet]}`}</span>
        </div>
        <p className={`text-[14.5px] leading-snug ${a.status === "erledigt" ? "text-slate-400 line-through" : "text-slate-900 font-semibold"}`}>{a.titel}</p>
        {a.text && <p className="text-[13px] text-slate-600 mt-1.5 leading-relaxed whitespace-pre-wrap">{a.text}</p>}
        {a.link && <a href={a.link} target={a.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-[12.5px] font-semibold" style={{ color: ACCENT }}>Öffnen →</a>}
        {letzteFrage && (
          <div className="mt-3 px-3 py-2 rounded-xl text-[12.5px]" style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>
            Deine Frage ist bei Justin: „{letzteFrage.text}“ — sobald er antwortet, läuft der Auftrag weiter.
          </div>
        )}
        {a.ergebnis && a.status === "erledigt" && (
          <div className="mt-3 px-3 py-2 rounded-xl text-[12.5px]" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
            <b>Ergebnis:</b> {a.ergebnis}
          </div>
        )}

        {fehler && <div className="af-fehler mt-3">{fehler}</div>}

        {a.status !== "erledigt" && !modus && (
          <div className="flex flex-wrap gap-2 mt-3">
            {a.status === "offen" && <button type="button" className="af-knopf" data-haupt="1" disabled={busy} onClick={() => void tun("annehmen")}>Annehmen</button>}
            {a.status !== "offen" && <button type="button" className="af-knopf" data-gut="1" disabled={busy} onClick={() => setModus("ergebnis")}>Ergebnis melden</button>}
            {!a.frageOffen && <button type="button" className="af-knopf" disabled={busy} onClick={() => setModus("frage")}>Rückfrage an Justin</button>}
            <button type="button" className="af-knopf" disabled={busy} onClick={() => setModus("kommentar")}>Notiz</button>
            <button type="button" className="af-knopf" disabled={busy} onClick={() => setModus("zurueck")}>Zurückgeben</button>
          </div>
        )}
        {modus && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
            <p className="text-[12px] text-slate-600 mb-2">
              {modus === "frage" && "Was musst du wissen, um weiterzumachen? Die Frage geht sofort an Justin; der Auftrag wartet so lange."}
              {modus === "ergebnis" && "Was ist dabei herausgekommen? Justin liest genau das — bitte so konkret, dass er nichts nachfragen muss."}
              {modus === "zurueck" && "Warum kannst du den Auftrag nicht übernehmen? Er geht mit deiner Begründung zurück an Justin."}
              {modus === "kommentar" && "Eine Notiz für die Zeitleiste — Justin sieht sie, der Auftrag läuft weiter."}
            </p>
            <textarea className="af-feld" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus
              placeholder={modus === "frage" ? "Deine Frage …" : modus === "ergebnis" ? "Das Ergebnis …" : modus === "zurueck" ? "Der Grund …" : "Deine Notiz …"} />
            <div className="flex gap-2 mt-2">
              <button type="button" className="af-knopf" data-haupt="1" disabled={busy || text.trim().length < (modus === "ergebnis" ? 5 : 3)}
                onClick={() => void tun(modus, modus === "frage" ? { text } : modus === "ergebnis" ? { ergebnis: text } : modus === "zurueck" ? { grund: text } : { text })}>
                {modus === "frage" ? "Frage senden" : modus === "ergebnis" ? "Als erledigt melden" : modus === "zurueck" ? "Zurückgeben" : "Speichern"}
              </button>
              <button type="button" className="af-knopf" onClick={() => { setModus(null); setText(""); }}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>

      <button type="button" className="w-full text-left px-4 py-2.5 text-[12px] font-semibold text-slate-500" style={{ borderTop: "1px solid #eef2f7", background: "#fbfcfe" }} onClick={() => setZeitleisteAuf((v) => !v)}>
        Zeitleiste {a.zeitleiste.length ? `(${a.zeitleiste.length})` : ""} {zeitleisteAuf ? "ausblenden" : "anzeigen"}
      </button>
      {zeitleisteAuf && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2" style={{ background: "#fbfcfe" }}>
          <div className="af-blase" data-wer="system">Übergeben {zeit(a.delegiertAm)}</div>
          {a.zeitleiste.map((b) => (
            <div key={b.id} className="af-blase" data-wer={b.autorArt} data-art={b.art}>
              {b.art === "frage" && <strong className="block text-[10.5px] uppercase tracking-wide mb-0.5" style={{ color: b.autorArt === "agent" ? "#fde68a" : "#b45309" }}>Frage</strong>}
              {b.art === "antwort" && <strong className="block text-[10.5px] uppercase tracking-wide mb-0.5" style={{ color: "#1d4ed8" }}>Antwort von Justin</strong>}
              {b.art === "ergebnis" && <strong className="block text-[10.5px] uppercase tracking-wide mb-0.5" style={{ color: b.autorArt === "agent" ? "#a7f3d0" : "#047857" }}>Ergebnis</strong>}
              {b.text}
              {b.autorArt !== "system" && <small>{b.autorArt === "agent" ? "Du" : b.autorName} · {zeit(b.am)}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
