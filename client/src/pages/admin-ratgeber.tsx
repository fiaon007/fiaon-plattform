// ═══════════════════════════════════════════════════════════════════════════
// /admin/ratgeber — die Redaktion (23.08.2026)
//
// Justin: „Jeden Tag drei Artikel, ich schaue drüber — einmal Text, einmal
// Vorschau — wenn's passt, wird veröffentlicht. Ich muss auch selbst jederzeit
// einen Artikel online stellen können, auch fünf am Tag."
//
// Links die Liste (Entwürfe zuerst), rechts der Arbeitsplatz mit drei Reitern:
// Text (alle Felder), Vorschau (so, wie es auf der Seite steht), Prüfstand
// (Worthygiene, Länge, Struktur). Oben: „Entwürfe erzeugen" (Anzahl wählbar)
// und „Neuer Artikel" (leer oder aus dem Themenplan). Veröffentlichen ist ein
// Klick — der Prüfstand blockiert nur bei Fehlern, und selbst das lässt sich
// bewusst übergehen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageIntro } from "@/components/admin/PageHelp";
import { KATEGORIEN, THEMEN, pruefstand, type Artikel, type Kategorie, type Status } from "@shared/fiaon-ratgeber";
import { markdownZuHtml } from "@shared/fiaon-markdown";
import "@/styles/ratgeber.css";

type Liste = (Omit<Artikel, "inhalt"> & { inhalt?: string })[];
const STATUS: Record<Status, { label: string; farbe: string }> = {
  entwurf: { label: "Entwurf", farbe: "#d97706" }, geprueft: { label: "Geprüft", farbe: "#2563eb" }, veroeffentlicht: { label: "Veröffentlicht", farbe: "#059669" }, archiv: { label: "Zurückgezogen", farbe: "#64748b" },
};
const api = async (pfad: string, init?: RequestInit) => {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", headers: init?.body ? { "Content-Type": "application/json" } : undefined, ...init });
  const j = await r.json().catch(() => null); return { ok: r.ok && j?.ok, status: r.status, json: j };
};
const datum = (s: string | null | undefined) => s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "–";

export default function AdminRatgeberPage() {
  const [liste, setListe] = useState<Liste>([]);
  const [info, setInfo] = useState<{ themenOffen: number; themenGesamt: number; heuteErzeugt: number; generatorBereit: boolean } | null>(null);
  const [filter, setFilter] = useState<Status | "alle">("alle");
  const [aktiv, setAktiv] = useState<Artikel | null>(null);
  const [reiter, setReiter] = useState<"text" | "vorschau" | "pruefstand">("text");
  const [meldung, setMeldung] = useState<{ art: "ok" | "fehler"; text: string } | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [anzahl, setAnzahl] = useState(3);
  const [neuOffen, setNeuOffen] = useState(false);
  const [schmutzig, setSchmutzig] = useState(false);

  const laden = useCallback(async () => {
    const r = await api("/admin/ratgeber");
    if (r.ok) { setListe(r.json.artikel); setInfo({ themenOffen: r.json.themenOffen, themenGesamt: r.json.themenGesamt, heuteErzeugt: r.json.heuteErzeugt, generatorBereit: r.json.generatorBereit }); }
    else setMeldung({ art: "fehler", text: r.json?.error || "Liste nicht ladbar." });
  }, []);
  useEffect(() => { laden(); }, [laden]);
  useEffect(() => { if (!meldung) return; const t = setTimeout(() => setMeldung(null), 6000); return () => clearTimeout(t); }, [meldung]);

  const oeffnen = async (id: number) => {
    if (schmutzig && !confirm("Ungespeicherte Änderungen verwerfen?")) return;
    const r = await api(`/admin/ratgeber/${id}`);
    if (r.ok) { setAktiv(r.json.artikel); setReiter("text"); setSchmutzig(false); }
  };
  const feld = <K extends keyof Artikel>(k: K, v: Artikel[K]) => { setAktiv((a) => (a ? { ...a, [k]: v } : a)); setSchmutzig(true); };

  const speichern = async (): Promise<Artikel | null> => {
    if (!aktiv) return null;
    setLaeuft("speichern");
    const r = await api(`/admin/ratgeber/${aktiv.id}`, { method: "PATCH", body: JSON.stringify({ slug: aktiv.slug, titel: aktiv.titel, untertitel: aktiv.untertitel, teaser: aktiv.teaser, inhalt: aktiv.inhalt, kategorie: aktiv.kategorie, land: aktiv.land, keyword: aktiv.keyword, schlagworte: aktiv.schlagworte, faq: aktiv.faq, metaTitel: aktiv.metaTitel, metaBeschreibung: aktiv.metaBeschreibung }) });
    setLaeuft(null);
    if (r.ok) { setAktiv(r.json.artikel); setSchmutzig(false); setMeldung({ art: "ok", text: "Gespeichert." }); laden(); return r.json.artikel; }
    setMeldung({ art: "fehler", text: r.json?.error || "Speichern fehlgeschlagen." }); return null;
  };
  const pruefen = async () => {
    const a = schmutzig ? await speichern() : aktiv; if (!a) return;
    setLaeuft("pruefen"); const r = await api(`/admin/ratgeber/${a.id}/pruefen`, { method: "POST" }); setLaeuft(null);
    if (r.ok) { setAktiv({ ...a, pruefung: r.json.pruefung, status: r.json.status }); setReiter("pruefstand"); laden(); }
    else setMeldung({ art: "fehler", text: r.json?.error || "Prüfung fehlgeschlagen." });
  };
  const veroeffentlichen = async (trotzdem = false) => {
    const a = schmutzig ? await speichern() : aktiv; if (!a) return;
    setLaeuft("veroeffentlichen"); const r = await api(`/admin/ratgeber/${a.id}/veroeffentlichen`, { method: "POST", body: JSON.stringify({ trotzdem }) }); setLaeuft(null);
    if (r.ok) { setMeldung({ art: "ok", text: `Veröffentlicht: ${r.json.url}` }); setAktiv({ ...a, status: "veroeffentlicht" }); laden(); }
    else if (r.status === 409) { setAktiv({ ...a, pruefung: r.json.pruefung }); setReiter("pruefstand"); setMeldung({ art: "fehler", text: r.json.error }); }
    else setMeldung({ art: "fehler", text: r.json?.error || "Veröffentlichen fehlgeschlagen." });
  };
  const zurueckziehen = async () => { if (!aktiv || !confirm("Artikel von der Website nehmen?")) return; const r = await api(`/admin/ratgeber/${aktiv.id}/zurueckziehen`, { method: "POST" }); if (r.ok) { setAktiv({ ...aktiv, status: "archiv" }); laden(); } };
  const loeschen = async () => { if (!aktiv || !confirm("Entwurf endgültig löschen?")) return; const r = await api(`/admin/ratgeber/${aktiv.id}`, { method: "DELETE" }); if (r.ok) { setAktiv(null); laden(); } };
  const erzeugen = async () => {
    setLaeuft("erzeugen"); setMeldung({ art: "ok", text: `Der Generator schreibt ${anzahl} Entwürfe – das dauert je Artikel etwa eine Minute.` });
    const r = await api("/admin/ratgeber/generieren", { method: "POST", body: JSON.stringify({ anzahl }) }); setLaeuft(null);
    if (r.ok) { setMeldung({ art: r.json.fehler?.length ? "fehler" : "ok", text: `${r.json.erzeugt.length} Entwürfe erzeugt${r.json.fehler?.length ? ` · Fehler: ${r.json.fehler.join(" | ")}` : ""}` }); laden(); }
    else setMeldung({ art: "fehler", text: r.json?.error || "Generator fehlgeschlagen." });
  };
  const neu = async (themaSlug?: string) => {
    const r = await api("/admin/ratgeber", { method: "POST", body: JSON.stringify(themaSlug ? { themaSlug } : { titel: "Neuer Ratgeber" }) });
    setNeuOffen(false);
    if (r.ok) { setAktiv(r.json.artikel); setReiter("text"); setSchmutzig(false); laden(); }
  };

  const gefiltert = useMemo(() => liste.filter((a) => filter === "alle" || a.status === filter), [liste, filter]);
  const zaehler = useMemo(() => ({ entwurf: liste.filter((a) => a.status === "entwurf").length, geprueft: liste.filter((a) => a.status === "geprueft").length, veroeffentlicht: liste.filter((a) => a.status === "veroeffentlicht").length }), [liste]);
  const lokalePruefung = useMemo(() => (aktiv ? pruefstand(aktiv) : null), [aktiv]);
  const benutzteThemen = useMemo(() => new Set(liste.map((a: any) => a.themaSlug).filter(Boolean)), [liste]);

  return (
    <div className="p-4 sm:p-6 max-w-[1500px] mx-auto">
      <PageIntro id="ratgeber" title="Ratgeber-Redaktion" subtitle="Jeden Morgen entstehen drei Entwürfe aus dem Themenplan. Du liest den Text, siehst die Vorschau, lässt den Prüfstand laufen – und veröffentlichst mit einem Klick. Eigene Artikel jederzeit, so viele du willst." steps={["Entwurf links öffnen – Text lesen, Vorschau ansehen", "Prüfstand laufen lassen (Worthygiene, Länge, Struktur)", "Veröffentlichen – der Artikel steht sofort unter /ratgeber", "Eigener Artikel: „Neuer Artikel“ – leer oder aus dem Themenplan"]} />

      {/* Kopf: Zahlen + Aktionen */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {(["entwurf", "geprueft", "veroeffentlicht"] as Status[]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(filter === s ? "alle" : s)} className="px-3 py-2 rounded-xl border text-[13px]" style={{ borderColor: filter === s ? STATUS[s].farbe : "#e5e7eb", background: filter === s ? `${STATUS[s].farbe}14` : "#fff", color: STATUS[s].farbe }}>
            {STATUS[s].label} <b>{zaehler[s as keyof typeof zaehler]}</b>
          </button>
        ))}
        <span className="text-[12px] text-slate-500 ml-1">{info ? `${info.themenOffen} von ${info.themenGesamt} Themen offen · heute ${info.heuteErzeugt} erzeugt` : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[12px] text-slate-500">Anzahl</label>
          <input type="number" min={1} max={10} value={anzahl} onChange={(e) => setAnzahl(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} className="w-16 px-2 py-2 rounded-lg border border-slate-200 text-[13px]" />
          <button type="button" disabled={!!laeuft || !info?.generatorBereit} onClick={erzeugen} className="px-4 py-2 rounded-xl bg-[#2563eb] text-white text-[13px] font-medium disabled:opacity-50" title={info?.generatorBereit ? "" : "OPENAI_API_KEY fehlt"}>
            {laeuft === "erzeugen" ? "Schreibt …" : `${anzahl} Entwürfe erzeugen`}
          </button>
          <div className="relative">
            <button type="button" onClick={() => setNeuOffen(!neuOffen)} className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-[13px] font-medium">Neuer Artikel</button>
            {neuOffen && (
              <div className="absolute right-0 mt-2 w-[380px] max-h-[360px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl z-20 p-2">
                <button type="button" onClick={() => neu()} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-[13px] font-medium">Leerer Artikel (selbst schreiben)</button>
                <p className="px-3 pt-2 pb-1 text-[10.5px] uppercase tracking-wider text-slate-400">Aus dem Themenplan</p>
                {THEMEN.filter((t) => !benutzteThemen.has(t.slug)).map((t) => <button key={t.slug} type="button" onClick={() => neu(t.slug)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-[12.5px] text-slate-700">{t.titel}</button>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {meldung && <div className={`mb-4 px-4 py-3 rounded-xl text-[13px] ${meldung.art === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{meldung.text}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-5 items-start">
        {/* Liste */}
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {gefiltert.length === 0 && <p className="p-6 text-[13px] text-slate-500">Nichts in dieser Ansicht.</p>}
          {gefiltert.map((a) => (
            <button key={a.id} type="button" onClick={() => oeffnen(a.id)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${aktiv?.id === a.id ? "bg-blue-50/60" : ""}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: STATUS[a.status].farbe }}>{STATUS[a.status].label}</span>
                <span className="text-[10.5px] text-slate-400">{KATEGORIEN[a.kategorie as Kategorie]?.label} · {a.land} · {a.quelle === "ki" ? "Generator" : "Hand"}</span>
              </div>
              <div className="text-[13.5px] text-slate-900 leading-snug">{a.titel}</div>
              <div className="text-[11px] text-slate-400 mt-1">{a.lesezeit} Min. · {a.pruefung ? (a.pruefung.ok ? "Prüfstand ok" : "Prüfstand: Fehler") : "ungeprüft"} · {datum(a.aktualisiertAm)}</div>
            </button>
          ))}
        </div>

        {/* Arbeitsplatz */}
        <div className="rounded-2xl border border-slate-200 bg-white min-h-[500px]">
          {!aktiv ? (
            <div className="p-10 text-center text-slate-500 text-[14px]">Wähle links einen Artikel – oder erzeuge Entwürfe.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100">
                {(["text", "vorschau", "pruefstand"] as const).map((r) => (
                  <button key={r} type="button" onClick={() => setReiter(r)} className={`px-3 py-1.5 rounded-lg text-[13px] ${reiter === r ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{r === "text" ? "Text" : r === "vorschau" ? "Vorschau" : "Prüfstand"}</button>
                ))}
                <span className="text-[11px] ml-2" style={{ color: STATUS[aktiv.status].farbe }}>{STATUS[aktiv.status].label}{schmutzig ? " · ungespeichert" : ""}</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <a href={`/ratgeber/${aktiv.slug}?vorschau=1`} target="_blank" rel="noreferrer" className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px] text-slate-700">Auf der Seite ansehen</a>
                  <button type="button" onClick={speichern} disabled={laeuft === "speichern"} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px]">Speichern</button>
                  <button type="button" onClick={pruefen} disabled={!!laeuft} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px]">Prüfen</button>
                  {aktiv.status !== "veroeffentlicht"
                    ? <button type="button" onClick={() => veroeffentlichen(false)} disabled={!!laeuft} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[12.5px] font-medium">Veröffentlichen</button>
                    : <button type="button" onClick={zurueckziehen} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 text-[12.5px]">Zurückziehen</button>}
                  {aktiv.status !== "veroeffentlicht" && <button type="button" onClick={loeschen} className="px-3 py-1.5 rounded-lg text-[12.5px] text-red-600">Löschen</button>}
                </div>
              </div>

              {reiter === "text" && (
                <div className="p-4 grid gap-3">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr,160px,120px] gap-3">
                    <Feld label="Titel"><input value={aktiv.titel} onChange={(e) => feld("titel", e.target.value)} className="rg-eingabe" /></Feld>
                    <Feld label="Kategorie"><select value={aktiv.kategorie} onChange={(e) => feld("kategorie", e.target.value as Kategorie)} className="rg-eingabe">{Object.entries(KATEGORIEN).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Feld>
                    <Feld label="Land"><select value={aktiv.land} onChange={(e) => feld("land", e.target.value as Artikel["land"])} className="rg-eingabe"><option>DE</option><option>AT</option><option>CH</option><option>DACH</option></select></Feld>
                  </div>
                  <Feld label="Untertitel"><input value={aktiv.untertitel || ""} onChange={(e) => feld("untertitel", e.target.value)} className="rg-eingabe" /></Feld>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Feld label="Adresse (Slug)"><input value={aktiv.slug} onChange={(e) => feld("slug", e.target.value)} className="rg-eingabe font-mono text-[12.5px]" /></Feld>
                    <Feld label="Haupt-Keyword"><input value={aktiv.keyword} onChange={(e) => feld("keyword", e.target.value)} className="rg-eingabe" /></Feld>
                  </div>
                  <Feld label={`Teaser (${aktiv.teaser.length}/160)`}><textarea value={aktiv.teaser} onChange={(e) => feld("teaser", e.target.value)} rows={2} className="rg-eingabe" /></Feld>
                  <Feld label={`Text (Markdown · ${aktiv.inhalt.split(/\s+/).filter(Boolean).length} Wörter)`}><textarea value={aktiv.inhalt} onChange={(e) => feld("inhalt", e.target.value)} rows={26} className="rg-eingabe font-mono text-[12.5px] leading-relaxed" /></Feld>
                  <Feld label="FAQ (Frage und Antwort, je ein Block)">
                    <div className="grid gap-2">
                      {aktiv.faq.map((f, i) => (
                        <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr,2fr,auto] gap-2">
                          <input value={f.frage} onChange={(e) => feld("faq", aktiv.faq.map((x, j) => (j === i ? { ...x, frage: e.target.value } : x)))} className="rg-eingabe" placeholder="Frage" />
                          <textarea value={f.antwort} onChange={(e) => feld("faq", aktiv.faq.map((x, j) => (j === i ? { ...x, antwort: e.target.value } : x)))} rows={2} className="rg-eingabe" placeholder="Antwort" />
                          <button type="button" onClick={() => feld("faq", aktiv.faq.filter((_, j) => j !== i))} className="text-[12px] text-red-600 px-2">×</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => feld("faq", [...aktiv.faq, { frage: "", antwort: "" }])} className="justify-self-start px-3 py-1.5 rounded-lg border border-slate-200 text-[12.5px]">Frage hinzufügen</button>
                    </div>
                  </Feld>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Feld label={`Meta-Titel (${aktiv.metaTitel.length}/60)`}><input value={aktiv.metaTitel} onChange={(e) => feld("metaTitel", e.target.value)} className="rg-eingabe" /></Feld>
                    <Feld label="Schlagwörter (Komma)"><input value={aktiv.schlagworte.join(", ")} onChange={(e) => feld("schlagworte", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} className="rg-eingabe" /></Feld>
                  </div>
                  <Feld label={`Meta-Beschreibung (${aktiv.metaBeschreibung.length}/155)`}><textarea value={aktiv.metaBeschreibung} onChange={(e) => feld("metaBeschreibung", e.target.value)} rows={2} className="rg-eingabe" /></Feld>
                </div>
              )}

              {reiter === "vorschau" && (
                <div className="p-6">
                  <p className="text-[11px] uppercase tracking-wider text-[#1d4ed8] mb-2">{KATEGORIEN[aktiv.kategorie]?.label} · {aktiv.land}</p>
                  <h1 className="text-[28px] leading-tight font-normal text-slate-900 mb-2" style={{ letterSpacing: "-.02em" }}>{aktiv.titel}</h1>
                  {aktiv.untertitel && <p className="text-[16px] text-slate-500 mb-6">{aktiv.untertitel}</p>}
                  <div className="rg-inhalt" dangerouslySetInnerHTML={{ __html: markdownZuHtml(aktiv.inhalt) }} />
                  {aktiv.faq.length > 0 && <section className="rg-faq"><h2>Häufige Fragen</h2>{aktiv.faq.map((f, i) => <details key={i}><summary>{f.frage}</summary><p>{f.antwort}</p></details>)}</section>}
                </div>
              )}

              {reiter === "pruefstand" && lokalePruefung && (
                <div className="p-6">
                  <div className={`px-4 py-3 rounded-xl text-[13.5px] mb-4 ${lokalePruefung.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                    {lokalePruefung.ok ? "Der Prüfstand hat nichts zu beanstanden." : "Der Prüfstand meldet Fehler – bitte beheben oder bewusst übergehen."} · {lokalePruefung.worte} Wörter
                  </div>
                  <ul className="grid gap-2">
                    {lokalePruefung.punkte.map((p, i) => (
                      <li key={i} className="flex gap-3 items-start text-[13.5px]">
                        <span className="mt-1 w-2.5 h-2.5 rounded-full shrink-0" style={{ background: p.art === "fehler" ? "#dc2626" : p.art === "hinweis" ? "#d97706" : "#059669" }} />
                        <span className={p.art === "fehler" ? "text-red-700" : p.art === "hinweis" ? "text-amber-700" : "text-slate-700"}>{p.text}</span>
                      </li>
                    ))}
                  </ul>
                  {!lokalePruefung.ok && aktiv.status !== "veroeffentlicht" && (
                    <button type="button" onClick={() => veroeffentlichen(true)} className="mt-5 px-4 py-2 rounded-xl border border-amber-300 text-amber-800 text-[13px]">Trotzdem veröffentlichen</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`.rg-eingabe{width:100%;padding:9px 11px;border:1px solid #e2e8f0;border-radius:10px;font:inherit;font-size:13.5px;color:#0f172a;background:#fff;outline:none}.rg-eingabe:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}`}</style>
    </div>
  );
}

function Feld({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-1"><span className="text-[10.5px] uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
