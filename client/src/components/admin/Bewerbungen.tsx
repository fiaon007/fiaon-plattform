// ═══════════════════════════════════════════════════════════════════════════
// BEWERBUNGEN — die Liste, die es bis zum 11.09.2026 nicht gab (E-177)
//
// Justin: „Wir haben ja für die Bewerbungen eine eigene Seite — wie viele
// Bewerber haben wir und wem, und wo sehen wir die?" Antwort damals: zehn
// Eingänge, sieben echte, null bearbeitet, sichtbar nur in einer
// zugeklappten Werkstatt-Karte ohne Status und ohne Knopf.
//
// Jetzt: eine Liste mit Status (neu · im Gespräch · zugesagt · abgesagt ·
// zurückgezogen), Zuständigem, Kundenbezug samt Akte, Notiz — und Knöpfen,
// die etwas TUN: Übernehmen und Übergeben legen den Auftrag an, Zusagen und
// Absagen schicken je eine Mail (mit Vorschau), die Zusage öffnet danach die
// bestehende Mitarbeiter-Einladung mit den Daten aus der Bewerbung.
//
// Läuft an zwei Stellen: /chef/s/bewerbungen (Chefbüro, Raum Team — die
// Chef-Hülle übersetzt die hellen Klassen ins Dunkle) und /admin/team →
// Reiter „Bewerbungen". Server: server/routes/fiaon-bewerbungen.ts.
// Rundgang: RUNDGANG_BEWERBUNGEN in pages/agent/rundgaenge.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiaonEbene } from "@/components/FiaonEbene";
import { InviteModal } from "@/components/admin/TeamVerwaltung";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";

const API = "/api/fiaon";

type Status = "neu" | "in_gespraech" | "zugesagt" | "abgesagt" | "zurueckgezogen";
type Filter = "offen" | "entschieden" | "tests" | "alle";

interface Zeile {
  id: number; name: string; email: string; telefon: string | null;
  bereich: string | null; land: string | null; landName: string | null; erfahrung: string | null;
  freitext: string; anstellung: string | null; start: string | null; stunden: string | null; linkedin: string | null; sprache: string | null;
  person_id: number | null; istKunde: boolean; kundeName: string | null; betreuer: string | null; ref: string | null; bezahlt: boolean;
  created_at: string; status: Status;
  zustaendig_agent_id: number | null; zustaendig_name: string | null;
  bearbeitet_am: string | null; bearbeitet_von: string | null; notiz: string | null; ist_test: boolean;
  agent_id: number | null; mitarbeiter_name: string | null;
  auftrag_id: number | null; auftrag_status: string | null;
}
interface Daten {
  zeilen: Zeile[];
  zustaendige: { id: number; name: string }[];
  standard: { agentId: number; name: string | null };
  ich: { agentId: number | null; stufe: string | null };
}
interface Einladung { firstName: string; lastName: string; email: string; phone: string; bewerbungId: number }

const STATUS: Record<Status, { text: string; farbe: string; grund: string }> = {
  neu:            { text: "Neu",            farbe: "#1d4ed8", grund: "rgba(37,99,235,.10)" },
  in_gespraech:   { text: "Im Gespräch",    farbe: "#b45309", grund: "rgba(217,119,6,.12)" },
  zugesagt:       { text: "Zugesagt",       farbe: "#047857", grund: "rgba(5,150,105,.12)" },
  abgesagt:       { text: "Abgesagt",       farbe: "#475569", grund: "rgba(71,85,105,.12)" },
  zurueckgezogen: { text: "Zurückgezogen",  farbe: "#475569", grund: "rgba(71,85,105,.12)" },
};

const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }) : "—");
const datumZeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—");
const monat = (s: string | null) => {
  if (!s) return "offen";
  const m = s.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : s;
};

async function api(pfad: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; json: any }> {
  const r = await fetch(`${API}${pfad}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
    ...init,
  }).catch(() => null);
  const json = await r?.json().catch(() => null);
  return { ok: !!r?.ok && json?.ok !== false, status: r?.status ?? 0, json };
}

function Knopf({ children, onClick, ton = "still", busy, titel }: { children: React.ReactNode; onClick: () => void; ton?: "haupt" | "still" | "gut" | "leise"; busy?: boolean; titel?: string }) {
  const stil = ton === "haupt" ? { background: "#1d4ed8", color: "#fff", border: "1px solid #1d4ed8" }
    : ton === "gut" ? { background: "#047857", color: "#fff", border: "1px solid #047857" }
    : ton === "leise" ? { background: "transparent", color: "#64748b", border: "1px solid transparent" }
    : { background: "#fff", color: "#334155", border: "1px solid #e2e8f0" };
  return (
    <button type="button" onClick={onClick} disabled={busy} title={titel}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50"
            style={stil}>
      {children}
    </button>
  );
}

export default function Bewerbungen() {
  const [d, setD] = useState<Daten | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ art: "gut" | "schlecht"; text: string } | null>(null);
  const [filter, setFilter] = useState<Filter>("offen");
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ art: "zusage" | "absage"; zeile: Zeile } | null>(null);
  const [einladung, setEinladung] = useState<Einladung | null>(null);
  const [uebergabe, setUebergabe] = useState<Record<number, number>>({});
  // Aus der Werkstatt, aus dem Auftrag: ?id=<Bewerbung> hebt eine Zeile hervor.
  const [hervor] = useState<number | null>(() => Number(new URLSearchParams(window.location.search).get("id")) || null);
  const imChef = typeof window !== "undefined" && window.location.pathname.startsWith("/chef");

  const laden = useCallback(async () => {
    setLaedt(true); setFehler(null);
    const r = await api("/chef/bewerbungen");
    if (r.ok) setD(r.json);
    else setFehler(r.status === 401 ? "Bitte im Chefbüro anmelden." : (r.json?.error || "Die Bewerbungen ließen sich nicht laden."));
    setLaedt(false);
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  // Eine hervorgehobene Zeile, die im Filter „offen" nicht vorkommt, würde
  // sonst unsichtbar bleiben — dann auf „alle" schalten und hinscrollen.
  useEffect(() => {
    if (!d || !hervor) return;
    const z = d.zeilen.find((x) => x.id === hervor);
    if (!z) return;
    const offen = !z.ist_test && (z.status === "neu" || z.status === "in_gespraech");
    if (!offen) setFilter("alle");
    window.setTimeout(() => document.getElementById(`bewerbung-${hervor}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  }, [d, hervor]);

  const zaehler = useMemo(() => {
    const z = d?.zeilen ?? [];
    const echt = z.filter((x) => !x.ist_test);
    return {
      offen: echt.filter((x) => x.status === "neu" || x.status === "in_gespraech").length,
      neu: echt.filter((x) => x.status === "neu").length,
      entschieden: echt.filter((x) => x.status === "zugesagt" || x.status === "abgesagt" || x.status === "zurueckgezogen").length,
      zugesagt: echt.filter((x) => x.status === "zugesagt").length,
      tests: z.filter((x) => x.ist_test).length,
      alle: z.length,
    };
  }, [d]);

  const sichtbar = useMemo(() => {
    const z = d?.zeilen ?? [];
    if (filter === "alle") return z;
    if (filter === "tests") return z.filter((x) => x.ist_test);
    if (filter === "entschieden") return z.filter((x) => !x.ist_test && (x.status === "zugesagt" || x.status === "abgesagt" || x.status === "zurueckgezogen"));
    return z.filter((x) => !x.ist_test && (x.status === "neu" || x.status === "in_gespraech"));
  }, [d, filter]);

  const zeileErsetzen = (neu: Zeile) => setD((alt) => (alt ? { ...alt, zeilen: alt.zeilen.map((z) => (z.id === neu.id ? neu : z)) } : alt));

  const aktion = async (schluessel: string, pfad: string, body?: unknown, gut?: string) => {
    setBusy(schluessel); setMeldung(null);
    const r = await api(pfad, { method: "POST", body: JSON.stringify(body ?? {}) });
    setBusy(null);
    if (r.ok) {
      if (r.json?.zeile) zeileErsetzen(r.json.zeile);
      setMeldung({ art: "gut", text: r.json?.meldung || gut || "Gespeichert." });
    } else {
      setMeldung({ art: "schlecht", text: r.json?.error || "Das hat nicht geklappt." });
    }
    return r;
  };

  const standardSetzen = async (agentId: number) => {
    const r = await aktion("standard", "/chef/bewerbungen/standard", { agentId });
    if (r.ok && r.json?.standard) setD((alt) => (alt ? { ...alt, standard: r.json.standard } : alt));
  };

  const notizSpeichern = async (z: Zeile, notiz: string) => {
    if ((z.notiz || "") === notiz.trim()) return;
    await aktion(`notiz-${z.id}`, `/chef/bewerbungen/${z.id}/notiz`, { notiz }, "Notiz gespeichert.");
  };

  const akteLink = (z: Zeile): string | null => {
    if (!z.istKunde) return null;
    if (imChef) return z.person_id ? `/chef/s/akte?id=${z.person_id}` : null;
    return z.ref ? `/admin/kunde/${z.ref}` : (z.person_id ? `/chef/s/akte?id=${z.person_id}` : null);
  };

  if (laedt && !d) return <p className="py-10 text-center text-[13px] text-slate-400">Bewerbungen werden geladen …</p>;
  if (fehler && !d) return <p className="py-10 text-center text-[13px]" style={{ color: "#b45309" }}>{fehler}</p>;
  if (!d) return null;

  return (
    <div className="max-w-6xl mx-auto">
      <Rundgang raum="bewerbungen" titel="Bewerbungen" schritte={RUNDGAENGE.bewerbungen.schritte} />

      {/* ── Kopf ──────────────────────────────────────────────────────────── */}
      <div className="bw-kopf bg-white rounded-2xl border border-slate-200 p-4 mb-3" style={{ boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 m-0">Bewerbungen</h2>
            <p className="text-[12.5px] text-slate-500 mt-1 mb-0 max-w-2xl">
              Wer sich über fiaon.com/karriere beworben hat — mit Stand, zuständiger Person und Kundenbezug.
              Die Website verspricht: „Florentine Lombardi meldet sich persönlich bei Ihnen." Hier wird das eingelöst:
              erst sprechen, dann zusagen oder absagen. Beides schickt eine Mail, die du vorher siehst.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              ["Offen", zaehler.offen, "#1d4ed8"],
              ["davon neu", zaehler.neu, "#b45309"],
              ["Zugesagt", zaehler.zugesagt, "#047857"],
              ["Tests", zaehler.tests, "#64748b"],
            ].map(([t, n, f]) => (
              <div key={String(t)} className="px-3 py-2 rounded-xl" style={{ background: "rgba(15,23,42,.03)", minWidth: 78 }}>
                <div className="text-[18px] font-bold leading-none" style={{ color: String(f) }}>{n}</div>
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 mt-1">{t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bw-standard flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
          <span className="text-[12.5px] text-slate-600">Neue Bewerbungen gehen als Auftrag an:</span>
          <select className="text-[12.5px] rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-slate-800"
                  value={d.standard.agentId}
                  disabled={busy === "standard"}
                  onChange={(e) => void standardSetzen(Number(e.target.value))}>
            {!d.zustaendige.some((a) => a.id === d.standard.agentId) && (
              <option value={d.standard.agentId}>{d.standard.name || `Konto ${d.standard.agentId} (nicht aktiv)`}</option>
            )}
            {d.zustaendige.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <span className="text-[11.5px] text-slate-400">Ändern kann das die Geschäftsführung. Die Person bekommt je Bewerbung die Mail „Neuer Auftrag für dich".</span>
        </div>
      </div>

      {meldung && (
        <p className="mb-3 px-3.5 py-2.5 rounded-xl text-[12.5px] font-semibold"
           style={meldung.art === "gut" ? { background: "rgba(5,150,105,.08)", color: "#047857" } : { background: "rgba(217,119,6,.08)", color: "#b45309" }}>
          {meldung.text}
        </p>
      )}

      {/* ── Filter ────────────────────────────────────────────────────────── */}
      <div className="bw-filter flex flex-wrap gap-1.5 mb-3">
        {([
          ["offen", `Offen (${zaehler.offen})`],
          ["entschieden", `Entschieden (${zaehler.entschieden})`],
          ["tests", `Tests (${zaehler.tests})`],
          ["alle", `Alle (${zaehler.alle})`],
        ] as const).map(([w, t]) => (
          <button key={w} type="button" onClick={() => setFilter(w)}
                  className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold"
                  style={filter === w ? { background: "#1d4ed8", color: "#fff" } : { background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}>
            {t}
          </button>
        ))}
      </div>

      {sichtbar.length === 0 && (
        <p className="py-10 text-center text-[13px] text-slate-400">
          {filter === "offen" ? "Keine offene Bewerbung — alles ist entschieden oder übergeben." : "Nichts in dieser Ansicht."}
        </p>
      )}

      {/* ── Die Karten ────────────────────────────────────────────────────── */}
      <div className="grid gap-3">
        {sichtbar.map((z) => {
          const st = STATUS[z.status] ?? STATUS.neu;
          const offen = !z.ist_test && (z.status === "neu" || z.status === "in_gespraech");
          const link = akteLink(z);
          const hervorgehoben = hervor === z.id;
          return (
            <article key={z.id} id={`bewerbung-${z.id}`}
                     className="bw-karte bg-white rounded-2xl border p-4"
                     style={{
                       borderColor: hervorgehoben ? "#1d4ed8" : "#e2e8f0",
                       boxShadow: hervorgehoben ? "0 0 0 3px rgba(37,99,235,.12)" : "0 1px 2px rgba(15,23,42,.04)",
                       opacity: z.ist_test ? 0.6 : 1,
                     }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold text-slate-900 m-0">{z.name || "ohne Namen"}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: st.farbe, background: st.grund }}>{st.text}</span>
                    {z.ist_test && <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: "#64748b", background: "rgba(71,85,105,.12)" }}>Test</span>}
                    {z.istKunde && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ color: z.bezahlt ? "#047857" : "#b45309", background: z.bezahlt ? "rgba(5,150,105,.10)" : "rgba(217,119,6,.10)" }}>
                        {z.bezahlt ? "Kunde, bezahlt" : "Kunde, Zahlung offen"}
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1 mb-0">
                    Eingegangen {datumZeit(z.created_at)} · #{z.id}
                    {z.bearbeitet_am && <> · zuletzt {datumZeit(z.bearbeitet_am)}{z.bearbeitet_von ? ` von ${z.bearbeitet_von}` : ""}</>}
                  </p>
                </div>
                <div className="text-[12px] text-right">
                  <div className="text-slate-500">Zuständig</div>
                  <div className="font-semibold text-slate-800">{z.zustaendig_name || "niemand"}</div>
                  {z.auftrag_status && <div className="text-[11px] text-slate-400">Auftrag {z.auftrag_status === "erledigt" ? "erledigt" : z.auftrag_status === "in_arbeit" ? "in Arbeit" : z.auftrag_status === "wartet" ? "wartet" : "offen"}</div>}
                </div>
              </div>

              <dl className="grid gap-x-4 gap-y-2 mt-3 text-[12.5px]" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {[
                  ["Bereich", z.bereich || "—"],
                  ["Land", z.landName || "—"],
                  ["Erfahrung", z.erfahrung || "—"],
                  ["Zusammenarbeit", z.anstellung || "—"],
                  ["Frühester Start", monat(z.start)],
                  ["Stunden/Woche", z.stunden || "—"],
                  ["Sprache", z.sprache === "en" ? "Englisch" : "Deutsch"],
                ].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{k}</dt><dd className="m-0 text-slate-800">{v}</dd></div>
                ))}
                <div>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Kontakt</dt>
                  <dd className="m-0 text-slate-800">
                    <a href={`mailto:${z.email}`} className="underline">{z.email}</a>
                    {z.telefon && <> · <a href={`tel:${z.telefon}`} className="underline">{z.telefon}</a></>}
                  </dd>
                </div>
                {z.linkedin && (
                  <div><dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">LinkedIn / Website</dt>
                    <dd className="m-0 text-slate-800 break-all"><a href={/^https?:\/\//i.test(z.linkedin) ? z.linkedin : `https://${z.linkedin}`} target="_blank" rel="noreferrer" className="underline">{z.linkedin}</a></dd></div>
                )}
                <div>
                  <dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Kunde</dt>
                  <dd className="m-0 text-slate-800">
                    {z.istKunde ? (
                      <>
                        {z.kundeName && z.kundeName !== z.name ? `${z.kundeName}` : "ja"}
                        {z.betreuer ? ` · Betreuer ${z.betreuer}` : " · ohne Betreuer"}
                        {link && <> · <a href={link} className="underline font-semibold">Akte öffnen</a></>}
                      </>
                    ) : "kein Kunde"}
                  </dd>
                </div>
                {z.agent_id && (
                  <div><dt className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Mitarbeiter</dt>
                    <dd className="m-0 text-slate-800">{z.mitarbeiter_name || `Konto ${z.agent_id}`} — eingeladen</dd></div>
                )}
              </dl>

              {z.freitext && (
                <p className="mt-3 mb-0 text-[13px] text-slate-700 whitespace-pre-line rounded-xl px-3 py-2.5" style={{ background: "rgba(15,23,42,.03)" }}>
                  <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400 block mb-1">Warum FIAON</span>
                  {z.freitext}
                </p>
              )}

              <label className="bw-notiz block mt-3">
                <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Notiz (Gespräch, Rückruf, was fehlt)</span>
                <textarea defaultValue={z.notiz || ""} rows={2}
                          onBlur={(e) => void notizSpeichern(z, e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-800 bg-white"
                          placeholder="Noch keine Notiz." />
              </label>

              <div className="bw-knoepfe flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                {offen && (
                  <>
                    <Knopf ton="haupt" busy={busy === `ueber-${z.id}`} onClick={() => void aktion(`ueber-${z.id}`, `/chef/bewerbungen/${z.id}/uebernehmen`)}
                           titel="Macht dich (oder die Standard-Person) zuständig und legt den Auftrag an.">
                      {z.zustaendig_agent_id && d.ich.agentId === z.zustaendig_agent_id ? "Auftrag erneuern" : "Übernehmen"}
                    </Knopf>
                    <span className="inline-flex items-center gap-1">
                      <select className="text-[12px] rounded-lg border border-slate-200 px-2 py-1.5 bg-white text-slate-800"
                              value={uebergabe[z.id] ?? ""}
                              onChange={(e) => setUebergabe((u) => ({ ...u, [z.id]: Number(e.target.value) }))}>
                        <option value="">Übergeben an …</option>
                        {d.zustaendige.filter((a) => a.id !== z.zustaendig_agent_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {uebergabe[z.id] ? (
                        <Knopf busy={busy === `ueber-${z.id}`} onClick={() => void aktion(`ueber-${z.id}`, `/chef/bewerbungen/${z.id}/uebernehmen`, { agentId: uebergabe[z.id] })}>Übergeben</Knopf>
                      ) : null}
                    </span>
                    <span className="flex-1" />
                    <Knopf ton="gut" onClick={() => setDialog({ art: "zusage", zeile: z })}>Zusagen</Knopf>
                    <Knopf onClick={() => setDialog({ art: "absage", zeile: z })}>Absagen</Knopf>
                    <Knopf ton="leise" busy={busy === `status-${z.id}`} onClick={() => void aktion(`status-${z.id}`, `/chef/bewerbungen/${z.id}/status`, { status: "zurueckgezogen" }, "Als zurückgezogen vermerkt.")}
                           titel="Der Bewerber hat selbst abgesagt — keine Mail.">Zurückgezogen</Knopf>
                  </>
                )}
                {!z.ist_test && z.status === "zugesagt" && !z.agent_id && (
                  <Knopf ton="haupt" onClick={() => {
                    const teile = z.name.trim().split(/\s+/);
                    setEinladung({ firstName: teile[0] || "", lastName: teile.slice(1).join(" "), email: z.email, phone: z.telefon || "", bewerbungId: z.id });
                  }}>Als Mitarbeiter einladen</Knopf>
                )}
                {!z.ist_test && (z.status === "abgesagt" || z.status === "zurueckgezogen") && (
                  <Knopf busy={busy === `status-${z.id}`} onClick={() => void aktion(`status-${z.id}`, `/chef/bewerbungen/${z.id}/status`, { status: "neu" }, "Wieder geöffnet.")}>Wieder öffnen</Knopf>
                )}
                {!offen && <span className="flex-1" />}
                <Knopf ton="leise" busy={busy === `test-${z.id}`}
                       onClick={() => void aktion(`test-${z.id}`, `/chef/bewerbungen/${z.id}/test`, { istTest: !z.ist_test }, z.ist_test ? "Testmarke entfernt." : "Als Test markiert.")}>
                  {z.ist_test ? "Test aufheben" : "Als Test markieren"}
                </Knopf>
              </div>
            </article>
          );
        })}
      </div>

      {dialog && (
        <EntscheidungsDialog
          art={dialog.art} zeile={dialog.zeile}
          onZu={() => setDialog(null)}
          onFertig={(j) => {
            setDialog(null);
            if (j?.zeile) zeileErsetzen(j.zeile);
            setMeldung({ art: "gut", text: j?.meldung || "Erledigt." });
            if (dialog.art === "zusage" && j?.einladung) setEinladung(j.einladung);
          }}
        />
      )}

      {einladung && (
        <InviteModal
          defaults={{ commissionRateBp: 1500 }}
          prefill={{ firstName: einladung.firstName, lastName: einladung.lastName, email: einladung.email, phone: einladung.phone, bewerbungId: einladung.bewerbungId }}
          onClose={() => { setEinladung(null); setMeldung({ art: "schlecht", text: "Einladung nicht verschickt — die Bewerbung bleibt zugesagt. „Als Mitarbeiter einladen“ holt das nach." }); }}
          onDone={() => { setEinladung(null); void laden(); }}
          flash={(m: string) => setMeldung({ art: "gut", text: m })}
        />
      )}
    </div>
  );
}

// ── Zusage / Absage: Vorschau, dann senden ────────────────────────────────
// Die Vorschau kommt vom Server aus derselben Vorlage und derselben Nutzlast
// wie der Versand — sie kann nicht etwas anderes zeigen als das, was rausgeht.
function EntscheidungsDialog({ art, zeile, onZu, onFertig }: { art: "zusage" | "absage"; zeile: Zeile; onZu: () => void; onFertig: (j: any) => void }) {
  const [vorschau, setVorschau] = useState<{ betreff: string; html: string; empfaenger: string; fehlend: string[] } | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [notiz, setNotiz] = useState("");
  const [sendet, setSendet] = useState(false);

  useEffect(() => {
    let an = true;
    api(`/chef/bewerbungen/${zeile.id}/vorschau?art=${art}`).then((r) => {
      if (!an) return;
      if (r.ok) setVorschau(r.json); else setFehler(r.json?.error || "Die Vorschau ließ sich nicht laden.");
    });
    return () => { an = false; };
  }, [zeile.id, art]);

  const senden = async () => {
    setSendet(true); setFehler(null);
    const r = await api(`/chef/bewerbungen/${zeile.id}/${art === "zusage" ? "zusagen" : "absagen"}`, { method: "POST", body: JSON.stringify({ notiz }) });
    setSendet(false);
    if (r.ok) onFertig(r.json); else setFehler(r.json?.error || "Das hat nicht geklappt.");
  };

  return (
    <FiaonEbene
      offen onZu={onZu}
      titel={art === "zusage" ? `${zeile.name} zusagen` : `${zeile.name} absagen`}
      ueberschrift={art === "zusage" ? "Mail „Wir möchten mit Ihnen arbeiten“, danach die Einladung" : "Mail „Vielen Dank für Ihre Bewerbung“"}
      breite={680}
      kinder={
        <div>
          <p className="text-[12.5px] leading-relaxed mb-3" style={{ color: "var(--fi-text-still)" }}>
            {art === "zusage"
              ? "Diese Mail geht sofort an den Bewerber. Danach öffnet sich die Mitarbeiter-Einladung — sie schickt den Zugangslink und legt Position und Vergütung fest. Ohne Einladung hat der Bewerber die Zusage, aber keinen Zugang."
              : "Diese Mail geht sofort an den Bewerber. Sie ist freundlich, nennt keinen Grund und keine Frist. Ein Kundenkonto bleibt unberührt."}
          </p>
          {vorschau && (
            <>
              <div className="text-[12px] mb-1.5" style={{ color: "var(--fi-text-still)" }}>
                An <b>{vorschau.empfaenger}</b> · Betreff: <b>{vorschau.betreff}</b>
              </div>
              {vorschau.fehlend?.length > 0 && (
                <p className="text-[12px] mb-2 font-semibold" style={{ color: "#b45309" }}>Leere Platzhalter: {vorschau.fehlend.join(", ")}</p>
              )}
              <iframe title="Vorschau" srcDoc={vorschau.html} sandbox="" className="w-full rounded-xl border border-slate-200 bg-white" style={{ height: 380 }} />
            </>
          )}
          {!vorschau && !fehler && <p className="text-[12.5px] text-slate-400">Vorschau wird gebaut …</p>}
          <label className="block mt-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--fi-text-still)" }}>Notiz für die Akte der Bewerbung (optional)</span>
            <textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} rows={2}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] bg-white text-slate-800"
                      placeholder={art === "zusage" ? "z. B. Start 01.10., 20 Stunden, Onboarding" : "z. B. kein Bedarf im Bereich, gern später"} />
          </label>
          {fehler && <p className="text-[12.5px] font-semibold mt-2" style={{ color: "#b45309" }}>{fehler}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <Knopf onClick={onZu}>Abbrechen</Knopf>
            <Knopf ton={art === "zusage" ? "gut" : "haupt"} busy={sendet || !vorschau} onClick={() => void senden()}>
              {sendet ? "Wird gesendet …" : art === "zusage" ? "Mail senden und zusagen" : "Mail senden und absagen"}
            </Knopf>
          </div>
        </div>
      }
    />
  );
}
