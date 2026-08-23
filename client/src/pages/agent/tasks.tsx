// ═══════════════════════════════════════════════════════════════════════════
// /agent/aufgaben — Raum „Tasks“ (23.08.2026, Plan §4/§11)
//
// Ersetzt aufgaben.tsx + auftraege-liste.tsx. Vier Reiter:
//   Zu tun    Aufgaben der Verwaltung mit Frist – nur ich hake sie ab.
//   Aufträge  Übergaben aus der TODO-Liste des Betreibers (E-028): annehmen,
//             Rückfrage, Notiz, Ergebnis melden, zurückgeben, Zeitleiste.
//   Hinweise  Notizen, die für mich freigegeben sind – nichts zu tun.
//   Erledigt  Abgehaktes.
// Endpunkte wie bisher: GET /agent/vermerke, GET /agent/vermerke/zahlen,
//   POST /agent/vermerke/:id/status { status }, GET /agent/auftraege,
//   POST /agent/auftraege/:id/{annehmen|frage|kommentar|erledigt|zurueck}.
// Hinweis: die alte Seite rief für „Ergebnis melden“ …/ergebnis – der Server
// kennt nur …/erledigt { ergebnis }. Hier der Pfad, den der Server hat.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Check, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-tasks.css";

interface Vermerk {
  id: number; art: "notiz" | "aufgabe"; ref: string | null; kunde: string | null; text: string;
  faelligAm: string | null; ueberfaellig: boolean; heuteFaellig: boolean; dringend: boolean;
  status: "offen" | "erledigt"; erledigtAm: string | null; erledigtVon: string | null; autorName: string; createdAt: string; meins: boolean;
}
interface Beitrag { id: number; autorArt: "betreiber" | "agent" | "system"; autorName: string; art: "kommentar" | "frage" | "antwort" | "ergebnis" | "status"; text: string; am: string }
interface Auftrag {
  id: number; titel: string; text: string | null; bereich: string; prioritaet: number; faelligAm: string | null; link: string | null;
  status: "offen" | "in_arbeit" | "wartet" | "erledigt"; frageOffen: boolean; ergebnis: string | null; erledigtAm: string | null; delegiertAm: string | null; zeitleiste: Beitrag[];
}

const tag = (iso: string | null) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
const zeit = (v: string | null) => v ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const rang = (v: Vermerk) => v.status === "erledigt" ? 9 : v.ueberfaellig ? 0 : v.heuteFaellig ? 1 : v.dringend ? 2 : !v.faelligAm ? 4 : 3;
const PRIO: Record<number, string> = { 1: "heute", 2: "diese Woche", 3: "wenn Zeit ist" };
const STATUS: Record<Auftrag["status"], { label: string; farbe: string }> = {
  offen: { label: "Neu — bitte annehmen", farbe: "#fbbf24" }, in_arbeit: { label: "In Arbeit", farbe: "#60a5fa" },
  wartet: { label: "Wartet auf Justins Antwort", farbe: "#f59e0b" }, erledigt: { label: "Erledigt", farbe: "#34d399" },
};
const geaendert = () => window.dispatchEvent(new Event("agent-aufgaben-geaendert"));

export default function AgentTasksPage() { return <AgentShell><TasksInnen /></AgentShell>; }

function TasksInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tasks"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [liste, setListe] = useState<Vermerk[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [reiter, setReiter] = useState<"offen" | "auftraege" | "hinweise" | "erledigt">("offen");
  const [auftraegeZahl, setAuftraegeZahl] = useState(0);

  const laden = useCallback(async () => {
    const r = await api("/agent/vermerke");
    if (r.ok) { setListe(r.json.vermerke || []); setFehler(null); } else setFehler(r.json?.error || "Die Aufgaben konnten nicht geladen werden.");
    setLaedt(false);
    const z = await api("/agent/vermerke/zahlen");
    if (z.ok) setAuftraegeZahl(Number(z.json.auftraege || 0));
  }, []);
  useEffect(() => { void laden(); }, [laden]);

  const abhaken = async (v: Vermerk) => {
    setBusy(v.id);
    const neu = v.status === "offen" ? "erledigt" : "offen";
    setListe((alt) => alt.map((x) => (x.id === v.id ? { ...x, status: neu } : x))); // sofort unter dem Finger
    const r = await api(`/agent/vermerke/${v.id}/status`, { method: "POST", body: JSON.stringify({ status: neu }) });
    setBusy(null);
    if (r.ok) geaendert();
    void laden();
  };

  const aufgabenOffen = useMemo(() => liste.filter((v) => v.art === "aufgabe" && v.status === "offen").sort((a, b) => rang(a) - rang(b)), [liste]);
  const hinweise = useMemo(() => liste.filter((v) => v.art === "notiz").sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)), [liste]);
  const erledigt = useMemo(() => liste.filter((v) => v.art === "aufgabe" && v.status === "erledigt").sort((a, b) => +new Date(b.erledigtAm || 0) - +new Date(a.erledigtAm || 0)), [liste]);
  const ueberfaellig = aufgabenOffen.filter((v) => v.ueberfaellig).length;
  const heute = aufgabenOffen.filter((v) => v.heuteFaellig).length;
  const sichtbar = reiter === "offen" ? aufgabenOffen : reiter === "hinweise" ? hinweise : reiter === "erledigt" ? erledigt : [];
  const gesamtOffen = aufgabenOffen.length + auftraegeZahl;

  return (
    <div className="ta">
      <section className="ta-kopf">
        <div>
          <span className="ta-pille">Tasks</span>
          <h1>{gesamtOffen === 0 ? <>Nichts offen – <span className="ta-verlauf">gut gemacht.</span></> : ueberfaellig > 0 ? <><span className="ta-verlauf">{ueberfaellig} überfällig</span>, {gesamtOffen} offen.</> : <><span className="ta-verlauf">{gesamtOffen} {gesamtOffen === 1 ? "Aufgabe" : "Aufgaben"}</span> offen.</>}</h1>
          <p>Was die Verwaltung dir zugewiesen hat, Aufträge vom Betreiber und Hinweise, die für dich freigegeben sind. Überfälliges zuerst, dann heute, dann der Rest.</p>
        </div>
        <div className="ta-lage">
          <small>Deine Lage</small>
          <div className="ta-lage-zahl"><b>{aufgabenOffen.length}</b><span>zu tun</span></div>
          <div className="ta-lage-zeile"><span>Heute fällig</span><b className={heute ? "warn" : ""}>{heute}</b></div>
          <div className="ta-lage-zeile"><span>Überfällig</span><b className={ueberfaellig ? "rot" : ""}>{ueberfaellig}</b></div>
          <div className="ta-lage-zeile"><span>Aufträge vom Betreiber</span><b>{auftraegeZahl}</b></div>
        </div>
      </section>

      {fehler && <p className="ta-fehler">{fehler}</p>}

      <div className="ta-reiter" role="tablist">
        <button type="button" role="tab" aria-selected={reiter === "offen"} className={reiter === "offen" ? "an" : ""} onClick={() => setReiter("offen")}>Zu tun {aufgabenOffen.length > 0 && <em>{aufgabenOffen.length}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "auftraege"} className={reiter === "auftraege" ? "an" : ""} onClick={() => setReiter("auftraege")}>Aufträge {auftraegeZahl > 0 && <em>{auftraegeZahl}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "hinweise"} className={reiter === "hinweise" ? "an" : ""} onClick={() => setReiter("hinweise")}>Hinweise {hinweise.length > 0 && <em>{hinweise.length}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "erledigt"} className={reiter === "erledigt" ? "an" : ""} onClick={() => setReiter("erledigt")}>Erledigt</button>
      </div>

      {reiter === "auftraege" && <Auftraege onGeaendert={() => void laden()} />}

      {reiter !== "auftraege" && laedt && <p className="ta-lade">Lade …</p>}
      {reiter !== "auftraege" && !laedt && sichtbar.length === 0 && (
        <div className="ta-leer">
          <b>{reiter === "offen" ? "Nichts offen." : reiter === "hinweise" ? "Keine Hinweise." : "Noch nichts erledigt."}</b>
          <span>{reiter === "offen" ? "Sobald die Verwaltung dir etwas zuweist, steht es hier – mit Frist." : reiter === "hinweise" ? "Hier erscheinen Notizen, die für dich oder das Team freigegeben wurden." : "Abgehakte Aufgaben sammeln sich hier."}</span>
        </div>
      )}
      {reiter !== "auftraege" && sichtbar.length > 0 && (
        <div className="ta-liste">
          {sichtbar.map((v) => {
            const stufe = v.status === "erledigt" ? "erledigt" : v.ueberfaellig ? "ueberfaellig" : v.heuteFaellig ? "heute" : v.dringend ? "dringend" : "";
            return (
              <div key={v.id} className={`ta-karte ${stufe}`}>
                {v.art === "aufgabe" && v.meins ? (
                  <button type="button" className={`ta-haken${v.status === "erledigt" ? " an" : ""}`} disabled={busy === v.id} onClick={() => void abhaken(v)} aria-label={v.status === "offen" ? "Als erledigt markieren" : "Wieder öffnen"}><Check size={18} strokeWidth={2.25} /></button>
                ) : (
                  <span className="ta-zeichen"><FileText size={18} strokeWidth={1.75} /></span>
                )}
                <div className="ta-text">
                  <p>{v.text}</p>
                  <div className="ta-meta">
                    {v.kunde && <b>{v.kunde}</b>}
                    {v.art === "aufgabe" && v.status === "offen" && <span className={v.ueberfaellig ? "rot" : v.heuteFaellig ? "blau" : ""}>{v.faelligAm ? (v.ueberfaellig ? `überfällig seit ${tag(v.faelligAm)}` : v.heuteFaellig ? "heute fällig" : `bis ${tag(v.faelligAm)}`) : "ohne Frist"}</span>}
                    {v.dringend && v.status === "offen" && <span className="warn">dringend</span>}
                    {v.status === "erledigt" && <span className="gut">erledigt {zeit(v.erledigtAm)}{v.erledigtVon ? ` · ${v.erledigtVon}` : ""}</span>}
                    <span>von {v.autorName}</span>
                  </div>
                  {v.ref && <Link href={`/agent/kunden?ref=${encodeURIComponent(v.ref)}`} className="ta-link"><ExternalLink size={13} strokeWidth={1.75} /> Kunde öffnen</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {!laedt && reiter === "offen" && aufgabenOffen.length > 0 && <p className="ta-fuss">Nur du kannst deine Aufgaben abhaken. Die Verwaltung sieht sofort, was erledigt ist – eine Rückmeldung per Nachricht ist nicht nötig.</p>}
    </div>
  );
}

// ── Aufträge vom Betreiber (E-028) ──────────────────────────────────────────
function Auftraege({ onGeaendert }: { onGeaendert: () => void }) {
  const [liste, setListe] = useState<Auftrag[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await api("/agent/auftraege");
    if (r.ok) { setListe(r.json.auftraege || []); setFehler(null); } else setFehler(r.json?.error || "Die Aufträge kamen nicht.");
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  const ersetzen = (t: Auftrag) => { setListe((alt) => (alt || []).map((x) => (x.id === t.id ? t : x))); onGeaendert(); geaendert(); };
  const weg = () => { void laden(); onGeaendert(); geaendert(); };

  if (liste === null && !fehler) return <p className="ta-lade">Lade …</p>;
  return (
    <div className="ta-liste">
      <p className="ta-fuss">Aufgaben, die Justin dir aus seiner Liste übergeben hat. Annehmen, Rückfrage stellen, Ergebnis melden – alles hier, in einer Zeitleiste, die beide Seiten sehen.</p>
      {fehler && <p className="ta-fehler">{fehler}</p>}
      {liste && liste.length === 0 && <div className="ta-leer"><b>Keine Aufträge.</b><span>Wenn Justin dir eine Aufgabe übergibt, steht sie hier – mit allem, was du dazu wissen musst.</span></div>}
      {(liste || []).map((a) => <AuftragKarte key={a.id} a={a} onChange={ersetzen} onWeg={weg} />)}
    </div>
  );
}

function AuftragKarte({ a, onChange, onWeg }: { a: Auftrag; onChange: (t: Auftrag) => void; onWeg: () => void }) {
  const [modus, setModus] = useState<null | "frage" | "ergebnis" | "zurueck" | "kommentar">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeitleisteAuf, setZeitleisteAuf] = useState(a.status === "wartet" || a.status === "in_arbeit");
  const tun = async (pfad: string, body?: any) => {
    setBusy(true); setFehler(null);
    const r = await api(`/agent/auftraege/${a.id}/${pfad}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    if (r.json?.todo) onChange(r.json.todo); else onWeg();
    setModus(null); setText("");
  };
  const st = STATUS[a.status];
  const letzteFrage = a.frageOffen ? [...a.zeitleiste].reverse().find((b) => b.art === "frage") : null;
  const mindest = modus === "ergebnis" ? 5 : modus === "kommentar" ? 2 : 3;
  return (
    <div className={`ta-auftrag ${a.status}`}>
      <div className="ta-auftrag-innen">
        <div className="ta-auftrag-kopf"><span className="ta-status" style={{ color: st.farbe }}><i />{st.label}</span><small>{a.faelligAm ? `bis ${tag(a.faelligAm)}` : `Priorität ${a.prioritaet} · ${PRIO[a.prioritaet] || ""}`}</small></div>
        <h3>{a.titel}</h3>
        {a.text && <p className="ta-auftrag-text">{a.text}</p>}
        {a.link && <a href={a.link} target={a.link.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="ta-link"><ExternalLink size={13} strokeWidth={1.75} /> Öffnen</a>}
        {letzteFrage && <div className="ta-kasten warn">Deine Frage ist bei Justin: „{letzteFrage.text}“ — sobald er antwortet, läuft der Auftrag weiter.</div>}
        {a.ergebnis && a.status === "erledigt" && <div className="ta-kasten gut"><b>Ergebnis:</b> {a.ergebnis}</div>}
        {fehler && <p className="ta-fehler" style={{ marginTop: 12 }}>{fehler}</p>}
        {a.status !== "erledigt" && !modus && (
          <div className="ta-knoepfe">
            {a.status === "offen" && <button type="button" className="ta-knopf haupt" disabled={busy} onClick={() => void tun("annehmen")}>Annehmen</button>}
            {a.status !== "offen" && <button type="button" className="ta-knopf gut" disabled={busy} onClick={() => setModus("ergebnis")}>Ergebnis melden</button>}
            {!a.frageOffen && <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("frage")}>Rückfrage an Justin</button>}
            <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("kommentar")}>Notiz</button>
            <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("zurueck")}>Zurückgeben</button>
          </div>
        )}
        {modus && (
          <div className="ta-form">
            <p>
              {modus === "frage" && "Was musst du wissen, um weiterzumachen? Die Frage geht sofort an Justin; der Auftrag wartet so lange."}
              {modus === "ergebnis" && "Was ist dabei herausgekommen? Justin liest genau das – bitte so konkret, dass er nichts nachfragen muss."}
              {modus === "zurueck" && "Warum kannst du den Auftrag nicht übernehmen? Er geht mit deiner Begründung zurück an Justin."}
              {modus === "kommentar" && "Eine Notiz für die Zeitleiste – Justin sieht sie, der Auftrag läuft weiter."}
            </p>
            <textarea className="ta-feld" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={modus === "frage" ? "Deine Frage …" : modus === "ergebnis" ? "Das Ergebnis …" : modus === "zurueck" ? "Der Grund …" : "Deine Notiz …"} />
            <div className="ta-knoepfe" style={{ marginTop: 0 }}>
              <button type="button" className="ta-knopf haupt" disabled={busy || text.trim().length < mindest}
                onClick={() => void tun(modus === "ergebnis" ? "erledigt" : modus, modus === "frage" ? { text } : modus === "ergebnis" ? { ergebnis: text } : modus === "zurueck" ? { grund: text } : { text })}>
                {busy ? "…" : modus === "frage" ? "Frage senden" : modus === "ergebnis" ? "Als erledigt melden" : modus === "zurueck" ? "Zurückgeben" : "Speichern"}
              </button>
              <button type="button" className="ta-knopf" onClick={() => { setModus(null); setText(""); }}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="ta-zeitleiste-knopf" onClick={() => setZeitleisteAuf((v) => !v)}>{zeitleisteAuf ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Zeitleiste{a.zeitleiste.length ? ` (${a.zeitleiste.length})` : ""}</button>
      {zeitleisteAuf && (
        <div className="ta-zeitleiste">
          <div className="ta-blase system">Übergeben {zeit(a.delegiertAm)}</div>
          {a.zeitleiste.map((b) => (
            <div key={b.id} className={`ta-blase ${b.autorArt} ${b.art === "frage" || b.art === "ergebnis" ? b.art : ""}`}>
              {b.art === "frage" && <strong>Frage</strong>}
              {b.art === "antwort" && <strong>Antwort von Justin</strong>}
              {b.art === "ergebnis" && <strong>Ergebnis</strong>}
              {b.text}
              {b.autorArt !== "system" && <small>{b.autorArt === "agent" ? "Du" : b.autorName} · {zeit(b.am)}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
