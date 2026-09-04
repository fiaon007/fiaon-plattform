// ═══════════════════════════════════════════════════════════════════════════
// MEINE LISTE — Justins Aufgaben als Pipeline (E-025 → E-028, 22.08.2026)
//
// Vier Spalten: Bei mir · Beim Team · Rückfrage · Erledigt. Eine Aufgabe
// wandert: Justin erledigt sie selbst oder übergibt sie an einen Mitarbeiter;
// der nimmt an, fragt zurück (→ Rückfrage, liegt wieder bei Justin), meldet
// ein Ergebnis oder gibt zurück. Jede Bewegung steht in der Zeitleiste.
//
// Jeder Klick antwortet sofort (optimistisch) und meldet Fehler sichtbar —
// „ich klicke und nichts passiert" darf es hier nicht mehr geben.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X, Check, Undo2, Trash2, ExternalLink, Send, UserRound, MessageCircleQuestion, ArrowRightLeft } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

type Spalte = "offen" | "team" | "rueckfrage" | "erledigt";
interface Beitrag { id: number; autorArt: "betreiber" | "agent" | "system"; autorName: string; art: "kommentar" | "frage" | "antwort" | "ergebnis" | "status"; text: string; am: string }
interface Todo {
  id: number; schluessel: string | null; titel: string; text: string | null; bereich: string; prioritaet: number; faelligAm: string | null; link: string | null; quelle: string;
  erledigtAm: string | null; createdAt: string; status: "offen" | "in_arbeit" | "wartet" | "erledigt"; spalte: Spalte;
  zustaendig: { art: "betreiber" | "agent"; agentId: number | null; name: string };
  delegiertAm: string | null; angenommenAm: string | null; erledigtVon: string | null; ergebnis: string | null; frageOffen: boolean;
  letzteAktivitaet: string | null; beitraege: number; letzterBeitrag: { art: string; autor: string; text: string; am: string } | null;
  zeitleiste?: Beitrag[];
  // E-029 (24.08.2026): der Austausch geht in beide Richtungen — frageAnAgent
  // ist DEINE Frage an den Mitarbeiter, neuFuerBetreiber das, was er
  // geschrieben hat und du noch nicht gesehen hast.
  frageAnAgent: boolean; neuFuerBetreiber: number; neuFuerAgent: number; ergebnisPflicht: boolean;
}
interface Agent { id: number; name: string; rolle: string }

const BEREICH: Record<string, { label: string; farbe: string }> = {
  make: { label: "Make", farbe: "#7c3aed" }, brevo: { label: "Brevo", farbe: "#0ea5e9" }, konten: { label: "Konten & Zugänge", farbe: "#1d4ed8" },
  entscheidung: { label: "Entscheidung", farbe: "#d97706" }, pruefen: { label: "Prüfen", farbe: "#059669" }, partner: { label: "Partner", farbe: "#db2777" },
  // 24.08.2026: NEU. VORHER landete alles, was aus dem Haus gemeldet wird, in
  // „Sonstiges" und ging dort zwischen Presse-Fakten und Guthaben unter.
  // NACHHER hat die Meldung aus dem Posteingang („Problem an die IT melden")
  // einen eigenen Bereich. Grund: Justins Auftrag vom 24.08.2026.
  technik: { label: "Technik", farbe: "#0891b2" },
  // 04.09.2026 (E-115): Aufgaben, die Mara aus dem Postfach stellt.
  postmeister: { label: "Mara · Postfach", farbe: "#4f46e5" },
  sonstiges: { label: "Sonstiges", farbe: "#64748b" },
};
const PRIO: Record<number, string> = { 1: "heute", 2: "diese Woche", 3: "wenn Zeit ist" };
const SPALTEN: { key: Spalte; label: string; leer: string }[] = [
  { key: "offen", label: "Bei mir", leer: "Nichts liegt bei dir. Bester Stand." },
  { key: "team", label: "Beim Team", leer: "Noch nichts übergeben. Wähle eine Aufgabe und übergib sie." },
  { key: "rueckfrage", label: "Rückfrage", leer: "Keine offene Frage aus dem Team." },
  { key: "erledigt", label: "Erledigt", leer: "Noch nichts abgehakt." },
];
const STATUS_TEXT: Record<Todo["status"], string> = { offen: "offen", in_arbeit: "in Arbeit", wartet: "wartet auf Antwort", erledigt: "erledigt" };

async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null);
  return { ok: r.ok && j?.ok !== false, json: j, error: (j?.error as string | undefined) || (r.ok ? undefined : `Fehler ${r.status}`) };
}
const tag = (iso: string | null) => iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : "";
const zeit = (iso: string | null) => iso ? new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

const CSS = `
.td-board{display:grid;gap:14px;grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:1100px){.td-board{grid-template-columns:1fr}.td-spalte[data-aus="1"]{display:none}}
.td-spalte{background:#f6f8fb;border:1px solid #e6ebf2;border-radius:16px;padding:10px;min-height:120px}
.td-spalte-kopf{display:flex;align-items:center;justify-content:space-between;padding:4px 6px 10px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
.td-spalte-kopf b{display:inline-flex;min-width:22px;height:22px;align-items:center;justify-content:center;border-radius:999px;background:#fff;border:1px solid #e2e8f0;font-size:11.5px;color:#0f172a;font-weight:600}
.td-karte{position:relative;background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:12px 12px 10px 14px;cursor:pointer;transition:transform .18s,box-shadow .18s,border-color .18s;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.td-karte:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(15,23,42,.08);border-color:#cbd5e1}
.td-karte[data-an="1"]{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.td-karte::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:3px;background:var(--kante,#cbd5e1)}
.td-karte+.td-karte{margin-top:8px}
.td-titel{font-size:13.5px;font-weight:500;color:#0f172a;line-height:1.35}
.td-karte[data-fertig="1"] .td-titel{color:#94a3b8;text-decoration:line-through}
.td-meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:8px;font-size:11px;color:#64748b;align-items:center}
.td-chip{display:inline-flex;align-items:center;gap:5px;font-weight:500}
.td-chip i{width:7px;height:7px;border-radius:50%;background:var(--c,#64748b)}
.td-frage{display:inline-flex;align-items:center;gap:5px;color:#b45309;font-weight:600}
/* E-029 (24.08.2026): zwei neue Zeichen. VORHER sah man nur die Frage AUS dem
   Team; deine eigene Frage AN das Team und alles Ungelesene waren unsichtbar. */
.td-wartet{display:inline-flex;align-items:center;gap:5px;color:#7c3aed;font-weight:500}
.td-neu{display:inline-flex;align-items:center;font-size:10.5px;font-weight:500;color:#1d4ed8;padding:2px 8px;border-radius:999px;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.25)}
.td-letzt{margin-top:8px;font-size:11.5px;color:#475569;line-height:1.4;background:#f8fafc;border-radius:8px;padding:6px 8px}
.td-letzt b{font-weight:600;color:#0f172a}
.td-leer{font-size:12.5px;color:#94a3b8;padding:14px 8px;line-height:1.5}
.td-segment{display:none;gap:4px;padding:4px;border-radius:12px;background:#eef2f7;margin-bottom:12px}
@media(max-width:1100px){.td-segment{display:grid;grid-template-columns:repeat(4,1fr)}}
.td-segment button{padding:8px 4px;border-radius:9px;font-size:12px;font-weight:600;color:#64748b;background:none;border:0}
.td-segment button[data-an="1"]{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(15,23,42,.14)}
.td-lade{position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.35);backdrop-filter:blur(4px)}
.td-lade-box{position:absolute;right:0;top:0;bottom:0;width:min(560px,100%);background:#fff;box-shadow:-20px 0 60px rgba(15,23,42,.2);display:flex;flex-direction:column;animation:tdRein .28s cubic-bezier(.22,1,.36,1)}
@media(max-width:640px){.td-lade-box{left:0;top:auto;height:92vh;width:100%;border-radius:20px 20px 0 0;animation:tdHoch .3s cubic-bezier(.22,1,.36,1)}}
@keyframes tdRein{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes tdHoch{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.td-lade-kopf{padding:18px 20px 12px;border-bottom:1px solid #eef2f7;display:flex;gap:12px;align-items:flex-start}
.td-lade-inhalt{flex:1;overflow:auto;padding:16px 20px 24px}
.td-lade-fuss{padding:12px 20px 16px;border-top:1px solid #eef2f7;background:#fff}
.td-abschnitt{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;margin:18px 0 8px}
.td-feld{width:100%;padding:9px 11px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;font-size:13px;color:#0f172a;outline:none}
.td-feld:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
.td-zeile{display:grid;gap:8px;grid-template-columns:1fr 1fr}
.td-blase{padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.5;max-width:92%}
.td-blase[data-wer="betreiber"]{margin-left:auto;background:#1d4ed8;color:#fff;border-bottom-right-radius:4px}
.td-blase[data-wer="agent"]{background:#f1f5f9;color:#0f172a;border-bottom-left-radius:4px}
.td-blase[data-wer="system"]{margin:0 auto;background:none;color:#94a3b8;font-size:11.5px;text-align:center;max-width:100%;padding:2px 0}
.td-blase[data-art="frage"]{border:1px solid #f59e0b;background:#fffbeb}
.td-blase[data-art="ergebnis"]{border:1px solid #10b981;background:#ecfdf5}
.td-blase small{display:block;font-size:10.5px;opacity:.7;margin-top:4px}
.td-aktion{display:flex;flex-wrap:wrap;gap:8px}
.td-fehler{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.25);color:#b91c1c;font-size:12.5px;font-weight:500}
.td-ok{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;background:#0f172a;color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;box-shadow:0 12px 30px rgba(15,23,42,.3);animation:tdHoch .25s ease}
`;

export default function AdminTodoPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [agenten, setAgenten] = useState<Agent[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [spalteMobil, setSpalteMobil] = useState<Spalte>("offen");
  const [offenId, setOffenId] = useState<number | null>(null);
  const [neu, setNeu] = useState(false);

  const laden = useCallback(async () => {
    const r = await api("/admin/todo");
    if (r.ok) { setTodos(r.json.todos); setAgenten(r.json.agenten || []); setFehler(null); } else setFehler(r.error || "Die Liste kam nicht.");
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 2600); return () => clearTimeout(t); }, [meldung]);

  /** Eine Aufgabe im Zustand ersetzen — nach jeder Antwort des Servers. */
  const ersetzen = (t: Todo) => setTodos((alt) => (alt || []).map((x) => (x.id === t.id ? { ...x, ...t } : x)));

  const nachSpalte = useMemo(() => {
    const m: Record<Spalte, Todo[]> = { offen: [], team: [], rueckfrage: [], erledigt: [] };
    for (const t of todos || []) m[t.spalte].push(t);
    m.erledigt.sort((a, b) => +new Date(b.erledigtAm || 0) - +new Date(a.erledigtAm || 0));
    return m;
  }, [todos]);
  const heute = new Date().toISOString().slice(0, 10);
  const offenes = useMemo(() => (todos || []).find((t) => t.id === offenId) || null, [todos, offenId]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      <style>{CSS}</style>
      <div className="flex items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-semibold text-slate-900 tracking-[-.02em]">Meine Liste</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Was bei dir liegt, was beim Team liegt, wer eine Frage hat — und was erledigt ist.</p>
        </div>
        <button type="button" onClick={() => setNeu(true)} className="a3-knopf inline-flex shrink-0" data-haupt="1"><Plus size={13} /> Neu</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-5">
        {[
          { label: "Bei mir", wert: nachSpalte.offen.length, ton: nachSpalte.offen.some((t) => t.prioritaet === 1) ? ("offen" as const) : undefined },
          { label: "Beim Team", wert: nachSpalte.team.length, ton: undefined },
          { label: "Rückfragen", wert: nachSpalte.rueckfrage.length, ton: nachSpalte.rueckfrage.length ? ("warnung" as const) : undefined },
          // E-029 (24.08.2026): NEU — was man sonst nirgends sieht: ungelesene
          // Nachrichten aus dem Team. Die Zahl fällt auf null, sobald du die
          // Akten geöffnet hast; sie kann nicht stehen bleiben.
          { label: "Neu vom Team", wert: (todos || []).filter((t) => t.neuFuerBetreiber > 0).length, ton: (todos || []).some((t) => t.neuFuerBetreiber > 0) ? ("warnung" as const) : undefined },
          { label: "Überfällig", wert: [...nachSpalte.offen, ...nachSpalte.team, ...nachSpalte.rueckfrage].filter((t) => t.faelligAm && t.faelligAm < heute).length, ton: undefined },
        ].map((k, i) => (
          <div key={k.label} className="a3-kachel a3-auf p-4 pl-[18px]" data-ton={k.ton} style={{ ["--i" as any]: i }}>
            <span className="block text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500">{k.label}</span>
            <span className="block mt-2 text-[22px] font-semibold text-slate-900 a3-zahl leading-none">{k.wert}</span>
          </div>
        ))}
      </div>

      {fehler && <div className="td-fehler">{fehler}</div>}

      <div className="td-segment">
        {SPALTEN.map((s) => <button key={s.key} type="button" data-an={spalteMobil === s.key ? "1" : undefined} onClick={() => setSpalteMobil(s.key)}>{s.label} {nachSpalte[s.key].length ? `(${nachSpalte[s.key].length})` : ""}</button>)}
      </div>

      <div className="td-board">
        {SPALTEN.map((s) => (
          <div key={s.key} className="td-spalte" data-aus={spalteMobil !== s.key ? "1" : undefined}>
            <div className="td-spalte-kopf"><span>{s.label}</span><b>{nachSpalte[s.key].length}</b></div>
            {todos === null && !fehler && <p className="td-leer">Lädt …</p>}
            {todos && nachSpalte[s.key].length === 0 && <p className="td-leer">{s.leer}</p>}
            {nachSpalte[s.key].map((t) => {
              const kante = t.spalte === "erledigt" ? "#cbd5e1" : t.frageOffen ? "#f59e0b" : t.faelligAm && t.faelligAm < heute ? "#dc2626" : t.prioritaet === 1 ? "#d97706" : BEREICH[t.bereich]?.farbe || "#2563eb";
              return (
                <div key={t.id} className="td-karte" data-an={offenId === t.id ? "1" : undefined} data-fertig={t.spalte === "erledigt" ? "1" : undefined} style={{ ["--kante" as any]: kante }} onClick={() => setOffenId(t.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setOffenId(t.id); }}>
                  <p className="td-titel">{t.titel}</p>
                  <div className="td-meta">
                    <span className="td-chip" style={{ ["--c" as any]: BEREICH[t.bereich]?.farbe }}><i />{BEREICH[t.bereich]?.label || t.bereich}</span>
                    {t.spalte !== "erledigt" && <span>P{t.prioritaet} · {PRIO[t.prioritaet]}</span>}
                    {t.faelligAm && t.spalte !== "erledigt" && <span style={{ color: t.faelligAm < heute ? "#dc2626" : undefined, fontWeight: t.faelligAm < heute ? 600 : undefined }}>bis {tag(t.faelligAm)}</span>}
                    {t.zustaendig.art === "agent" && <span className="td-chip"><UserRound size={11} />{t.zustaendig.name} · {STATUS_TEXT[t.status]}</span>}
                    {t.frageOffen && <span className="td-frage"><MessageCircleQuestion size={12} /> Frage</span>}
                    {/* E-029: deine eigene Frage steht beim Mitarbeiter — du wartest, nicht er. */}
                    {t.frageAnAgent && <span className="td-wartet"><MessageCircleQuestion size={12} /> wartet auf Antwort</span>}
                    {/* E-029: zählt nur, was du noch nicht gesehen hast, und fällt beim Öffnen weg. */}
                    {t.neuFuerBetreiber > 0 && <span className="td-neu">{t.neuFuerBetreiber} neu</span>}
                    {t.spalte === "erledigt" && <span style={{ color: "#059669", fontWeight: 600 }}>{t.erledigtVon || "erledigt"} · {tag(t.erledigtAm)}</span>}
                  </div>
                  {t.letzterBeitrag && t.letzterBeitrag.art !== "status" && (
                    <div className="td-letzt"><b>{t.letzterBeitrag.autor}:</b> {t.letzterBeitrag.text}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {offenes && (
        <Lade todo={offenes} agenten={agenten} onClose={() => setOffenId(null)} onChange={ersetzen} onDelete={(id) => { setTodos((alt) => (alt || []).filter((x) => x.id !== id)); setOffenId(null); }} melden={setMeldung} />
      )}
      {neu && <Neu agenten={agenten} onClose={() => setNeu(false)} onDone={(t) => { setTodos((alt) => [t, ...(alt || [])]); setNeu(false); setMeldung("Eingetragen."); }} />}
      {meldung && <div className="td-ok">{meldung}</div>}

      <PageIntro id="admin-todo-pipeline" title="So läuft eine Aufgabe"
        subtitle="Bei mir → (an Mitarbeiter übergeben) → Beim Team → Rückfrage (liegt wieder bei dir) → Erledigt. Die Zahl im Menü zählt, was bei dir liegt: eigene Aufgaben plus offene Fragen."
        steps={[
          "Aufgabe anklicken: rechts öffnet sich die Akte mit Zeitleiste. Dort erledigen, übergeben, antworten, löschen.",
          "Übergibst du eine Aufgabe, sieht der Mitarbeiter sie im Portal unter Aufgaben → Aufträge. Er nimmt an, fragt zurück oder meldet ein Ergebnis.",
          "Eine Rückfrage kommt sofort zu dir zurück (Spalte „Rückfrage“). Deine Antwort setzt die Aufgabe wieder in Arbeit.",
          "Du kannst auch selbst fragen: „Als Frage senden“ unten in der Akte. Beim Mitarbeiter steht sie mit einem Antwort-Knopf, bis er antwortet.",
          "„Neu vom Team“ zählt nur, was du noch nicht gesehen hast. Öffnest du die Akte, ist es gelesen und die Zahl fällt — sie bleibt nicht stehen.",
        ]} />
    </div>
  );
}

function Lade({ todo, agenten, onClose, onChange, onDelete, melden }: { todo: Todo; agenten: Agent[]; onClose: () => void; onChange: (t: Todo) => void; onDelete: (id: number) => void; melden: (m: string) => void }) {
  const [detail, setDetail] = useState<Todo | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [antwort, setAntwort] = useState("");
  const [ergebnis, setErgebnis] = useState("");
  const [ergebnisOffen, setErgebnisOffen] = useState(false);
  const [uebergabe, setUebergabe] = useState<{ agentId: string; hinweis: string } | null>(null);
  const [meta, setMeta] = useState({ prioritaet: todo.prioritaet, faelligAm: todo.faelligAm || "", bereich: todo.bereich, link: todo.link || "" });

  // E-029 (24.08.2026): VORHER holte das Öffnen nur die Akte. NACHHER meldet es
  // dem Server zusätzlich „gesehen" — die Marke „neu vom Team" verschwindet
  // dadurch, nicht durch Zeitablauf. Wer die Akte offen hatte, hat gelesen.
  const laden = useCallback(async () => {
    const r = await api(`/admin/todo/${todo.id}`);
    if (r.ok) { setDetail(r.json.todo); onChange(r.json.todo); } else { setFehler(r.error || "Akte kam nicht."); return; }
    if (Number(r.json.todo?.neuFuerBetreiber || 0) > 0) {
      const g = await api(`/admin/todo/${todo.id}/gelesen`, { method: "POST" });
      if (g.ok && g.json?.todo) { setDetail(g.json.todo); onChange(g.json.todo); }
    }
  }, [todo.id, onChange]);
  useEffect(() => { void laden(); }, [laden]);
  useEffect(() => { setMeta({ prioritaet: todo.prioritaet, faelligAm: todo.faelligAm || "", bereich: todo.bereich, link: todo.link || "" }); }, [todo.id, todo.prioritaet, todo.faelligAm, todo.bereich, todo.link]);

  const t = detail || todo;
  const tun = async (pfad: string, body?: any, method = "POST", erfolg?: string) => {
    setBusy(true); setFehler(null);
    const r = await api(pfad, { method, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) { setFehler(r.error || "Das hat nicht geklappt."); return false; }
    if (r.json?.todo) { setDetail(r.json.todo); onChange(r.json.todo); }
    if (erfolg) melden(erfolg);
    return true;
  };

  const erledigen = async () => { if (await tun(`/admin/todo/${t.id}`, { erledigt: true, ergebnis: ergebnis.trim() || undefined }, "PATCH", "Erledigt.")) { setErgebnis(""); setErgebnisOffen(false); } };
  const oeffnen = () => tun(`/admin/todo/${t.id}`, { erledigt: false }, "PATCH", "Wieder offen.");
  // E-029 (24.08.2026): VORHER war jede Nachricht ein Kommentar, den niemand
  // beantworten musste. NACHHER kannst du mit „Als Frage senden" eine Antwort
  // VERLANGEN — beim Mitarbeiter steht sie als Frage mit Antwort-Knopf.
  const antworten = async (alsFrage = false) => {
    const meldung = alsFrage ? "Frage an den Mitarbeiter gesendet." : t.frageOffen ? "Antwort gesendet." : "Nachricht gespeichert.";
    if (await tun(`/admin/todo/${t.id}/beitrag`, { text: antwort, art: alsFrage ? "frage" : undefined }, "POST", meldung)) setAntwort("");
  };
  const uebergeben = async () => {
    if (!uebergabe?.agentId) return;
    if (await tun(`/admin/todo/${t.id}/delegieren`, { agentId: Number(uebergabe.agentId), hinweis: uebergabe.hinweis }, "POST", "Übergeben.")) setUebergabe(null);
  };
  const zurueck = () => tun(`/admin/todo/${t.id}/delegieren`, { agentId: null }, "POST", "Liegt wieder bei dir.");
  const metaSpeichern = () => tun(`/admin/todo/${t.id}`, meta, "PATCH", "Gespeichert.");
  const loeschen = async () => {
    if (!window.confirm(`„${t.titel}“ endgültig entfernen?`)) return;
    setBusy(true);
    const r = await api(`/admin/todo/${t.id}`, { method: "DELETE" });
    setBusy(false);
    if (r.ok) { onDelete(t.id); melden("Entfernt."); } else setFehler(r.error || "Konnte nicht entfernen.");
  };

  const metaGeaendert = meta.prioritaet !== t.prioritaet || meta.faelligAm !== (t.faelligAm || "") || meta.bereich !== t.bereich || meta.link !== (t.link || "");

  return (
    <div className="td-lade" onClick={onClose}>
      <div className="td-lade-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t.titel}>
        <div className="td-lade-kopf">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[11px]">
              <span className="td-chip" style={{ ["--c" as any]: BEREICH[t.bereich]?.farbe }}><i />{BEREICH[t.bereich]?.label || t.bereich}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">{STATUS_TEXT[t.status]}</span>
              <span className="text-slate-500">· {t.zustaendig.art === "agent" ? `bei ${t.zustaendig.name}` : "bei dir"}</span>
            </div>
            <h2 className="text-[17px] font-semibold text-slate-900 leading-snug">{t.titel}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0" aria-label="Schließen"><X size={16} /></button>
        </div>

        <div className="td-lade-inhalt">
          {fehler && <div className="td-fehler">{fehler}</div>}
          {t.text && <p className="text-[13.5px] text-slate-700 leading-relaxed whitespace-pre-wrap">{t.text}</p>}
          {t.link && <a href={t.link} target={t.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-medium text-blue-700"><ExternalLink size={13} /> Öffnen</a>}
          {t.ergebnis && (
            <div className="mt-4 p-3 rounded-xl" style={{ background: "#ecfdf5", border: "1px solid #a7f3d0" }}>
              <p className="text-[10.5px] font-semibold uppercase tracking-[.1em] text-emerald-700 mb-1">Ergebnis · {t.erledigtVon} · {zeit(t.erledigtAm)}</p>
              <p className="text-[13px] text-slate-800 whitespace-pre-wrap">{t.ergebnis}</p>
            </div>
          )}

          <p className="td-abschnitt">Aktion</p>
          <div className="td-aktion">
            {t.status !== "erledigt" && !ergebnisOffen && <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy} onClick={() => setErgebnisOffen(true)}><Check size={13} /> Erledigt</button>}
            {t.status === "erledigt" && <button type="button" className="a3-knopf inline-flex" disabled={busy} onClick={() => void oeffnen()}><Undo2 size={13} /> Wieder öffnen</button>}
            {t.status !== "erledigt" && t.zustaendig.art === "betreiber" && !uebergabe && agenten.length > 0 && <button type="button" className="a3-knopf inline-flex" disabled={busy} onClick={() => setUebergabe({ agentId: "", hinweis: "" })}><ArrowRightLeft size={13} /> An Mitarbeiter übergeben</button>}
            {t.status !== "erledigt" && t.zustaendig.art === "agent" && <button type="button" className="a3-knopf inline-flex" disabled={busy} onClick={() => void zurueck()}><Undo2 size={13} /> Zurück zu mir</button>}
            {t.status !== "erledigt" && t.zustaendig.art === "agent" && !uebergabe && agenten.length > 1 && <button type="button" className="a3-knopf inline-flex" disabled={busy} onClick={() => setUebergabe({ agentId: "", hinweis: "" })}><ArrowRightLeft size={13} /> Anderer Mitarbeiter</button>}
            <button type="button" className="a3-knopf inline-flex" disabled={busy} onClick={() => void loeschen()} title="Entfernen"><Trash2 size={13} /></button>
          </div>
          {ergebnisOffen && (
            <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-[12px] text-slate-600 mb-2">Kurz festhalten, was dabei herausgekommen ist — optional, aber hilfreich für später.</p>
              <textarea className="td-feld" rows={2} placeholder="Ergebnis (optional)" value={ergebnis} onChange={(e) => setErgebnis(e.target.value)} autoFocus />
              <div className="flex gap-2 mt-2">
                <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy} onClick={() => void erledigen()}><Check size={13} /> Als erledigt ablegen</button>
                <button type="button" className="a3-knopf inline-flex" onClick={() => setErgebnisOffen(false)}>Abbrechen</button>
              </div>
            </div>
          )}
          {uebergabe && (
            <div className="mt-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-[12px] text-slate-600 mb-2">Der Mitarbeiter sieht die Aufgabe sofort im Portal unter Aufgaben → Aufträge und kann Rückfragen stellen.</p>
              <select className="td-feld" value={uebergabe.agentId} onChange={(e) => setUebergabe({ ...uebergabe, agentId: e.target.value })}>
                <option value="">Mitarbeiter wählen …</option>
                {agenten.filter((a) => a.id !== t.zustaendig.agentId).map((a) => <option key={a.id} value={a.id}>{a.name}{a.rolle === "vertriebsleiter" ? " · Leitung" : a.rolle === "onboarding" ? " · Onboarding" : ""}</option>)}
              </select>
              <textarea className="td-feld mt-2" rows={2} placeholder="Hinweis an den Mitarbeiter (optional)" value={uebergabe.hinweis} onChange={(e) => setUebergabe({ ...uebergabe, hinweis: e.target.value })} />
              <div className="flex gap-2 mt-2">
                <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy || !uebergabe.agentId} onClick={() => void uebergeben()}><Send size={13} /> Übergeben</button>
                <button type="button" className="a3-knopf inline-flex" onClick={() => setUebergabe(null)}>Abbrechen</button>
              </div>
            </div>
          )}

          <p className="td-abschnitt">Einordnung</p>
          <div className="td-zeile">
            <select className="td-feld" value={meta.prioritaet} onChange={(e) => setMeta({ ...meta, prioritaet: Number(e.target.value) })}>{[1, 2, 3].map((p) => <option key={p} value={p}>Priorität {p} — {PRIO[p]}</option>)}</select>
            <select className="td-feld" value={meta.bereich} onChange={(e) => setMeta({ ...meta, bereich: e.target.value })}>{Object.entries(BEREICH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <input className="td-feld" type="date" value={meta.faelligAm} onChange={(e) => setMeta({ ...meta, faelligAm: e.target.value })} />
            <input className="td-feld" placeholder="Link (optional)" value={meta.link} onChange={(e) => setMeta({ ...meta, link: e.target.value })} />
          </div>
          {metaGeaendert && <button type="button" className="a3-knopf inline-flex mt-2" data-haupt="1" disabled={busy} onClick={() => void metaSpeichern()}>Speichern</button>}

          <p className="td-abschnitt">Zeitleiste</p>
          <div className="flex flex-col gap-2">
            <div className="td-blase" data-wer="system">Eingetragen {zeit(t.createdAt)} · {t.quelle === "hand" ? "von Hand" : "vom Entwickler"}</div>
            {(t.zeitleiste || []).map((b) => (
              <div key={b.id} className="td-blase" data-wer={b.autorArt} data-art={b.art}>
                {b.art === "frage" && <strong className="block text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "#b45309" }}>Frage von {b.autorArt === "betreiber" ? "dir" : b.autorName}</strong>}
                {/* E-029: Antworten sind jetzt auf beiden Seiten möglich — der Verlauf muss sagen, wessen. */}
                {b.art === "antwort" && <strong className="block text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "#1d4ed8" }}>Antwort von {b.autorArt === "betreiber" ? "dir" : b.autorName}</strong>}
                {b.art === "ergebnis" && <strong className="block text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "#047857" }}>Ergebnis von {b.autorName}</strong>}
                {b.text}
                {b.autorArt !== "system" && <small>{b.autorArt === "betreiber" ? "Du" : b.autorName} · {zeit(b.am)}</small>}
              </div>
            ))}
            {!detail && <p className="td-leer">Zeitleiste lädt …</p>}
          </div>
        </div>

        {t.status !== "erledigt" && (
          <div className="td-lade-fuss">
            {t.frageOffen && <p className="text-[12px] font-medium mb-1.5" style={{ color: "#b45309" }}>{t.zustaendig.name} wartet auf deine Antwort.</p>}
            {t.frageAnAgent && <p className="text-[12px] font-medium mb-1.5" style={{ color: "#7c3aed" }}>Deine Frage liegt bei {t.zustaendig.name} — du wartest auf die Antwort.</p>}
            <div className="flex gap-2">
              <input className="td-feld" placeholder={t.frageOffen ? "Antwort schreiben …" : t.zustaendig.art === "agent" ? `Nachricht an ${t.zustaendig.name} …` : "Notiz für dich …"} value={antwort} onChange={(e) => setAntwort(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && antwort.trim().length >= 2) void antworten(); }} />
              <button type="button" className="a3-knopf inline-flex shrink-0" data-haupt="1" disabled={busy || antwort.trim().length < 2} onClick={() => void antworten()} title="Senden"><Send size={13} /></button>
            </div>
            {/* E-029: Der zweite Knopf verlangt eine Antwort. Er erscheint nur,
                wenn die Aufgabe bei einem Mitarbeiter liegt — eine Frage an
                niemanden wäre eine Sackgasse. */}
            {t.zustaendig.art === "agent" && (
              <button type="button" className="a3-knopf inline-flex mt-2" disabled={busy || antwort.trim().length < 2} onClick={() => void antworten(true)}>
                <MessageCircleQuestion size={13} /> Als Frage senden — {t.zustaendig.name} muss antworten
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Neu({ agenten, onClose, onDone }: { agenten: Agent[]; onClose: () => void; onDone: (t: Todo) => void }) {
  const [form, setForm] = useState({ titel: "", text: "", bereich: "sonstiges", prioritaet: 2, faelligAm: "", link: "", agentId: "", hinweis: "" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const anlegen = async () => {
    setBusy(true); setFehler(null);
    const r = await api("/admin/todo", { method: "POST", body: JSON.stringify({ ...form, agentId: form.agentId ? Number(form.agentId) : undefined }) });
    setBusy(false);
    if (r.ok) onDone(r.json.todo); else setFehler(r.error || "Konnte nicht anlegen.");
  };
  return (
    <div className="td-lade" onClick={onClose}>
      <div className="td-lade-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Neue Aufgabe">
        <div className="td-lade-kopf">
          <h2 className="text-[17px] font-semibold text-slate-900 flex-1">Neue Aufgabe</h2>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 shrink-0" aria-label="Schließen"><X size={16} /></button>
        </div>
        <div className="td-lade-inhalt">
          {fehler && <div className="td-fehler">{fehler}</div>}
          <input className="td-feld" placeholder="Was ist zu tun?" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} autoFocus />
          <textarea className="td-feld mt-2" rows={3} placeholder="Details, Variablen, Links …" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
          <p className="td-abschnitt">Einordnung</p>
          <div className="td-zeile">
            <select className="td-feld" value={form.bereich} onChange={(e) => setForm({ ...form, bereich: e.target.value })}>{Object.entries(BEREICH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            <select className="td-feld" value={form.prioritaet} onChange={(e) => setForm({ ...form, prioritaet: Number(e.target.value) })}>{[1, 2, 3].map((p) => <option key={p} value={p}>Priorität {p} — {PRIO[p]}</option>)}</select>
            <input className="td-feld" type="date" value={form.faelligAm} onChange={(e) => setForm({ ...form, faelligAm: e.target.value })} />
            <input className="td-feld" placeholder="Link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          </div>
          {agenten.length > 0 && (
            <>
              <p className="td-abschnitt">Wer macht es?</p>
              <select className="td-feld" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                <option value="">Ich selbst</option>
                {agenten.map((a) => <option key={a.id} value={a.id}>{a.name}{a.rolle === "vertriebsleiter" ? " · Leitung" : ""}</option>)}
              </select>
              {form.agentId && <textarea className="td-feld mt-2" rows={2} placeholder="Hinweis an den Mitarbeiter (optional)" value={form.hinweis} onChange={(e) => setForm({ ...form, hinweis: e.target.value })} />}
            </>
          )}
        </div>
        <div className="td-lade-fuss flex gap-2">
          <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy || form.titel.trim().length < 3} onClick={() => void anlegen()}><Plus size={13} /> Eintragen</button>
          <button type="button" className="a3-knopf inline-flex" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
