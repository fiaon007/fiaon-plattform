// ═══════════════════════════════════════════════════════════════════════════
// MEINE LISTE — was Justin selbst tun muss (E-025, 22.08.2026)
//
// Make-Zweige, Brevo-Vorlagen, Konten, Entscheidungen: Dinge, die kein
// Mitarbeiter und kein Programm erledigen kann. Der Entwickler trägt sie
// ein, wenn etwas bei Justin liegt; Justin hakt ab. Getrennt von den
// Kundenaufgaben (/admin/aufgaben), weil es kein Kundenbezug ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { Check, Undo2, Plus, Trash2, ExternalLink } from "lucide-react";
import { PageIntro, Tip } from "@/components/admin/PageHelp";

interface Todo { id: number; schluessel: string | null; titel: string; text: string | null; bereich: string; prioritaet: number; faelligAm: string | null; link: string | null; quelle: string; erledigtAm: string | null; createdAt: string }

const BEREICH: Record<string, { label: string; farbe: string }> = {
  make: { label: "Make", farbe: "#7c3aed" }, brevo: { label: "Brevo", farbe: "#0ea5e9" }, konten: { label: "Konten & Zugänge", farbe: "#1d4ed8" },
  entscheidung: { label: "Entscheidung", farbe: "#d97706" }, pruefen: { label: "Prüfen", farbe: "#059669" }, partner: { label: "Partner", farbe: "#db2777" }, sonstiges: { label: "Sonstiges", farbe: "#64748b" },
};
const PRIO: Record<number, string> = { 1: "heute", 2: "diese Woche", 3: "wenn Zeit ist" };

async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null);
  return { ok: r.ok && j?.ok !== false, json: j };
}
const tag = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "";

export default function AdminTodoPage() {
  const [todos, setTodos] = useState<Todo[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [reiter, setReiter] = useState<"offen" | "erledigt">("offen");
  const [neu, setNeu] = useState(false);
  const [form, setForm] = useState({ titel: "", text: "", bereich: "sonstiges", prioritaet: 2, faelligAm: "", link: "" });
  const [busy, setBusy] = useState(false);

  const laden = useCallback(async () => {
    const r = await api("/admin/todo");
    if (r.ok) { setTodos(r.json.todos); setFehler(null); } else setFehler(r.json?.error || "Die Liste kam nicht.");
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const setzen = async (t: Todo, erledigt: boolean) => {
    const r = await api(`/admin/todo/${t.id}`, { method: "PATCH", body: JSON.stringify({ erledigt }) });
    if (r.ok) void laden();
  };
  const loeschen = async (t: Todo) => {
    if (!window.confirm(`„${t.titel}“ endgültig entfernen?`)) return;
    const r = await api(`/admin/todo/${t.id}`, { method: "DELETE" }); if (r.ok) void laden();
  };
  const anlegen = async () => {
    if (form.titel.trim().length < 3) return;
    setBusy(true);
    const r = await api("/admin/todo", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) { setNeu(false); setForm({ titel: "", text: "", bereich: "sonstiges", prioritaet: 2, faelligAm: "", link: "" }); void laden(); }
  };

  const offen = (todos ?? []).filter((t) => !t.erledigtAm);
  const erledigt = (todos ?? []).filter((t) => !!t.erledigtAm);
  const heute = new Date().toISOString().slice(0, 10);
  const ueberfaellig = offen.filter((t) => t.faelligAm && t.faelligAm < heute).length;
  const sichtbar = reiter === "offen" ? offen : erledigt;
  const gruppen = Array.from(new Set(sichtbar.map((t) => t.bereich)));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-[26px] font-bold text-slate-900 tracking-[-.02em]">Meine Liste</h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">Was nur du tun kannst — Make, Brevo, Konten, Entscheidungen. Der Entwickler trägt ein, du hakst ab.</p>
        </div>
        <button type="button" onClick={() => setNeu((v) => !v)} className="a3-knopf inline-flex shrink-0" data-haupt="1"><Plus size={13} /> Neu</button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-4">
        {[
          { label: "Offen", wert: offen.length, ton: undefined, hilfe: "Alles, was bei dir liegt." },
          { label: "Heute", wert: offen.filter((t) => t.prioritaet === 1).length, ton: offen.some((t) => t.prioritaet === 1) ? ("warnung" as const) : undefined, hilfe: "Priorität 1 — ohne dich bleibt etwas still." },
          { label: "Überfällig", wert: ueberfaellig, ton: ueberfaellig > 0 ? ("warnung" as const) : undefined, hilfe: "Frist verstrichen." },
        ].map((k, i) => (
          <div key={k.label} className="a3-kachel a3-auf p-4 pl-[18px]" data-ton={k.ton} style={{ ["--i" as any]: i }}>
            <div className="flex items-start gap-1.5"><span className="flex-1 min-w-0 text-[10px] font-semibold uppercase tracking-[.07em] text-slate-500 leading-tight">{k.label}</span><span className="shrink-0"><Tip text={k.hilfe} /></span></div>
            <span className="block mt-2 text-[22px] font-bold text-slate-900 a3-zahl leading-none">{k.wert}</span>
          </div>
        ))}
      </div>

      {neu && (
        <section className="a3-tafel mb-4 p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <input className="sm:col-span-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" placeholder="Was ist zu tun?" value={form.titel} onChange={(e) => setForm({ ...form, titel: e.target.value })} />
            <textarea className="sm:col-span-2 w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" rows={2} placeholder="Details, Variablen, Links …" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} />
            <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" value={form.bereich} onChange={(e) => setForm({ ...form, bereich: e.target.value })}>
              {Object.entries(BEREICH).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" value={form.prioritaet} onChange={(e) => setForm({ ...form, prioritaet: Number(e.target.value) })}>
              {[1, 2, 3].map((p) => <option key={p} value={p}>Priorität {p} — {PRIO[p]}</option>)}
            </select>
            <input className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" type="date" value={form.faelligAm} onChange={(e) => setForm({ ...form, faelligAm: e.target.value })} />
            <input className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-[13px] outline-none focus:border-blue-400" placeholder="Link (optional)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          </div>
          <div className="flex gap-2 mt-3">
            <button type="button" className="a3-knopf inline-flex" data-haupt="1" disabled={busy || form.titel.trim().length < 3} onClick={() => void anlegen()}>Eintragen</button>
            <button type="button" className="a3-knopf inline-flex" onClick={() => setNeu(false)}>Abbrechen</button>
          </div>
        </section>
      )}

      {fehler && <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.25)", color: "#b91c1c" }}>{fehler}</div>}

      <section className="a3-tafel">
        <header className="a3-tafel-kopf flex-wrap">
          {([["offen", `Offen (${offen.length})`], ["erledigt", `Erledigt (${erledigt.length})`]] as const).map(([k, l]) => (
            <button key={k} type="button" className="a3-reiter" data-an={reiter === k ? "1" : undefined} onClick={() => setReiter(k)}>{l}</button>
          ))}
        </header>
        {todos === null && !fehler && <p className="px-4 py-6 text-[13px] text-slate-400">Lädt …</p>}
        {todos && sichtbar.length === 0 && <p className="px-4 py-8 text-center text-[13px] text-slate-400">{reiter === "offen" ? "Nichts offen. Das ist der beste Stand." : "Noch nichts abgehakt."}</p>}
        {gruppen.map((g) => (
          <div key={g}>
            <p className="px-4 pt-3 pb-1 text-[10.5px] font-bold uppercase tracking-[.12em]" style={{ color: BEREICH[g]?.farbe || "#64748b" }}>{BEREICH[g]?.label || g}</p>
            {sichtbar.filter((t) => t.bereich === g).map((t) => {
              const kante = t.erledigtAm ? "transparent" : t.faelligAm && t.faelligAm < heute ? "#dc2626" : t.prioritaet === 1 ? "#d97706" : BEREICH[g]?.farbe || "#1d4ed8";
              return (
                <div key={t.id} className="px-4 py-3 flex items-start gap-3" style={{ boxShadow: "inset 0 -1px 0 rgba(226,232,240,.8)", borderLeft: `3px solid ${kante}` }}>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] leading-snug ${t.erledigtAm ? "text-slate-400 line-through" : "text-slate-900 font-semibold"}`}>{t.titel}</p>
                    {t.text && <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{t.text}</p>}
                    <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-2">
                      <span>Priorität {t.prioritaet} · {PRIO[t.prioritaet]}</span>
                      {t.faelligAm && <span>· bis {tag(t.faelligAm)}</span>}
                      <span>· {t.quelle === "hand" ? "von Hand" : "vom Entwickler eingetragen"}</span>
                      {t.erledigtAm && <span className="text-emerald-600 font-semibold">· erledigt {tag(t.erledigtAm)}</span>}
                    </p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1.5">
                    {t.link && <a href={t.link} className="a3-knopf hidden sm:inline-flex" target={t.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer"><ExternalLink size={12} /> Öffnen</a>}
                    {!t.erledigtAm
                      ? <button type="button" className="a3-knopf inline-flex" data-haupt="1" onClick={() => void setzen(t, true)}><Check size={12} /> erledigt</button>
                      : <button type="button" className="a3-knopf inline-flex" onClick={() => void setzen(t, false)}><Undo2 size={12} /> öffnen</button>}
                    <button type="button" className="a3-knopf inline-flex" title="Entfernen" onClick={() => void loeschen(t)}><Trash2 size={12} /></button>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      <PageIntro id="admin-todo" title="So funktioniert diese Liste"
        subtitle="Priorität 1 = ohne dich bleibt etwas still (z. B. ein fehlender Make-Zweig). Priorität 2 = diese Woche. Priorität 3 = wenn Zeit ist."
        steps={[
          "Einträge „vom Entwickler eingetragen“ kommen aus der Arbeit am System; erledigte Einträge kommen nicht wieder.",
          "Die Zahl im Menü zählt alles Offene.",
        ]} />
    </div>
  );
}
