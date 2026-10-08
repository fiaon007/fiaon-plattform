// ═══════════════════════════════════════════════════════════════════════════
// /agent/aufgaben — Raum „Tasks“ (23.08.2026, Plan §4/§11)
//
// Ersetzt aufgaben.tsx + auftraege-liste.tsx. Vier Reiter:
//   Zu tun    Aufgaben der Verwaltung mit Frist – nur ich hake sie ab.
//   Aufträge  Übergaben aus der TODO-Liste des Betreibers (E-028) und Maras
//             Aufträge: NUR Offenes, als Liste Kunde · Art · Eingang · Status.
//   Hinweise  Notizen, die für mich freigegeben sind – nichts zu tun.
//   Erledigt  Abgehaktes – Aufgaben UND Aufträge (E-IT-F), mit „Wieder öffnen".
// Endpunkte: GET /agent/vermerke, GET /agent/vermerke/zahlen,
//   POST /agent/vermerke/:id/status { status }, GET /agent/auftraege,
//   GET /agent/auftraege/:id, POST /agent/auftraege/:id/{erledigt|frage|
//   kommentar|zurueck|gelesen|wieder-oeffnen}.
//
// ── E-IT-F (08.10.2026), Punkte (6) bis (9) aus dem IT-Feedback ────────────
// VORHER: Karten nach Priorität/Fälligkeit (64 % „dringend", 90 % überfällig),
// kein Eingang sichtbar, der Kundenname fehlte bei 53 %, erledigen kostete drei
// Klicks („Ich mach das" → „Als erledigt melden" → „Ohne Text melden"), die
// erledigte Karte blieb bis zum Ende des Neuladens mit aktivem Knopf oben stehen
// („Schon erledigt."), und „Zuletzt erledigt" stand im Reiter „Aufträge".
// NACHHER (Justins Entscheidungen vom 08.10.2026):
//   · Spalten Kunde · Art · Eingang · Status; der Kunde steht immer da.
//   · Dringend zuerst, darin nach Eingang — die ältesten zuerst, umschaltbar.
//     Die Reihenfolge kommt aus shared/fiaon-auftrag-arten.ts — dieselbe wie
//     der „nächste Auftrag" des Servers und die Akte-Leiste.
//   · „Erledigt" mit EINEM Klick; danach ist die Zeile sofort weg und der
//     nächste wirklich offene Auftrag aufgeklappt.
//   · Die Liste lädt bei Rückkehr in den Tab, beim Zurück aus der Akte und
//     jede Minute neu — nie, während ein Formular offen ist.
//   · „Akte" führt per App-Navigation in die Akte (das Telefon bleibt verbunden,
//     E-169), mit der Leiste dieses Auftrags (AuftragLeiste.tsx).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { Check, FileText, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import {
  auftraegeSortieren, auftragStatus, eingangText, naechsterAuftrag, vorTagen, berlinTagZeit, type AuftragRichtung,
} from "@shared/fiaon-auftrag-arten";
import { AgentShell, api } from "./shared";
import { useOffice } from "./OfficeShell";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "./rundgaenge";
import "@/styles/office-tasks.css";

interface Vermerk {
  id: number; art: "notiz" | "aufgabe"; ref: string | null; kunde: string | null; text: string;
  faelligAm: string | null; ueberfaellig: boolean; heuteFaellig: boolean; dringend: boolean;
  status: "offen" | "erledigt"; erledigtAm: string | null; erledigtVon: string | null; autorName: string; createdAt: string; meins: boolean;
}
interface Beitrag { id: number; autorArt: "betreiber" | "agent" | "system"; autorName: string; art: "kommentar" | "frage" | "antwort" | "ergebnis" | "status"; text: string; am: string }
export interface Auftrag {
  id: number; titel: string; text: string | null; textGekuerzt?: boolean; bereich: string; prioritaet: number; dringend?: boolean; faelligAm: string | null; link: string | null;
  strecke?: string[];
  status: "offen" | "in_arbeit" | "wartet" | "erledigt"; frageOffen: boolean; ergebnis: string | null; erledigtAm: string | null; delegiertAm: string | null;
  zeitleiste: Beitrag[]; zeitleisteGekuerzt?: boolean; beitraege?: number;
  // E-029 (24.08.2026): der Austausch geht in beide Richtungen.
  frageAnAgent: boolean; neuFuerAgent: number; ergebnisPflicht: boolean; erledigtVon: string | null;
  /** Der Kunde hinter der Aufgabe (05.09.2026; E-IT-F: aus person_id, nie leer in kundeAnzeige). */
  ref?: string | null; kunde?: string | null; kundeTelefon?: string | null; personId?: number | null; kundeAnzeige?: string;
  // E-IT-F (08.10.2026)
  art?: string; artLabel?: string; herkunft?: string; nurHand?: boolean; zustand?: boolean;
  eingangAm?: string | null; createdAt?: string | null; neuSeit?: string | null; ungelesen?: boolean;
  erledigtArt?: string | null; erledigtEreignis?: string | null;
  wiederOffenAm?: string | null; wiederOffenGrund?: string | null; wiederOffenZahl?: number;
  weitereZumKunden?: number;
}
interface Lage { offen: number; wartet: number; neu: number; frageAnMich: number }
type Reiter = "offen" | "auftraege" | "hinweise" | "erledigt";

const tag = (iso: string | null) => iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" }) : "";
const zeit = (v: string | null) => v ? new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const rang = (v: Vermerk) => v.status === "erledigt" ? 9 : v.ueberfaellig ? 0 : v.heuteFaellig ? 1 : v.dringend ? 2 : !v.faelligAm ? 4 : 3;
const REITER: Reiter[] = ["offen", "auftraege", "hinweise", "erledigt"];
const RICHTUNG_SCHLUESSEL = "fiaon-auftraege-richtung";
const TAKT_MS = 60_000;

// Eigene Meldungen an Popup und Zähler — und der Zeitpunkt, damit die eigene Liste
// ihr eigenes Echo nicht noch einmal lädt.
let zuletztGemeldet = 0;
const geaendert = () => { zuletztGemeldet = Date.now(); window.dispatchEvent(new Event("agent-aufgaben-geaendert")); };

function reiterAusUrl(): Reiter {
  try {
    const r = new URLSearchParams(window.location.search).get("reiter");
    return (REITER as string[]).includes(String(r)) ? (r as Reiter) : new URLSearchParams(window.location.search).get("auftrag") ? "auftraege" : "offen";
  } catch { return "offen"; }
}
function richtungLesen(): AuftragRichtung {
  try { return window.localStorage.getItem(RICHTUNG_SCHLUESSEL) === "neu" ? "neu" : "alt"; } catch { return "alt"; }
}

/** Wohin „Akte" führt — in die eigene Akte, mit dem Auftrag für die Leiste. */
export function akteZiel(a: Pick<Auftrag, "id" | "personId" | "ref">): string | null {
  if (a.personId) return `/agent/kunden?person=${a.personId}&auftrag=${a.id}`;
  if (a.ref) return `/agent/kunden?ref=${encodeURIComponent(a.ref)}&auftrag=${a.id}`;
  return null;
}

export default function AgentTasksPage() { return <AgentShell><TasksInnen /></AgentShell>; }

// ── Die Aufträge: laden, neu laden, entfernen — ein Zustand für zwei Reiter ──
function useAuftraege() {
  const [offen, setOffen] = useState<Auftrag[] | null>(null);
  const [erledigt, setErledigt] = useState<Auftrag[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigtTage, setErledigtTage] = useState(30);
  /** true, solange ein Formular offen ist oder ein Klick läuft — dann lädt der Takt nicht neu. */
  const sperre = useRef(false);
  const laeuft = useRef(false);
  /**
   * Zählt lokale Änderungen (erledigt, entfernt, wieder offen). Eine Antwort, die VOR einer solchen Änderung
   * angefragt wurde, kennt sie nicht — sie würde die eben erledigte Zeile zurückholen (Gegenprüfung 08.10., Fund 14).
   */
  const stand = useRef(0);
  const laden = useCallback(async (leise = false) => {
    if (laeuft.current) return;
    if (leise && (sperre.current || document.hidden)) return;
    laeuft.current = true;
    const beimStart = stand.current;
    try {
      const r = await api("/agent/auftraege");
      if (r.ok && beimStart !== stand.current) return;
      if (r.ok) {
        setOffen(r.json.auftraege || []); setErledigt(r.json.erledigt || []);
        setErledigtTage(Number(r.json.erledigtTage || 30)); setFehler(null);
      } else if (!leise) setFehler(r.json?.error || "Die Aufträge kamen nicht.");
    } finally { laeuft.current = false; }
  }, []);
  useEffect(() => {
    void laden();
    const uhr = window.setInterval(() => void laden(true), TAKT_MS);
    const zurueck = () => { if (!document.hidden) void laden(true); };
    const beiSeite = (e: PageTransitionEvent) => { if (e.persisted) void laden(true); };
    const beiAenderung = () => { if (Date.now() - zuletztGemeldet > 1500) void laden(true); };
    window.addEventListener("focus", zurueck);
    document.addEventListener("visibilitychange", zurueck);
    window.addEventListener("pageshow", beiSeite);
    window.addEventListener("agent-aufgaben-geaendert", beiAenderung);
    return () => {
      window.clearInterval(uhr);
      window.removeEventListener("focus", zurueck);
      document.removeEventListener("visibilitychange", zurueck);
      window.removeEventListener("pageshow", beiSeite);
      window.removeEventListener("agent-aufgaben-geaendert", beiAenderung);
    };
  }, [laden]);
  /** Ein Auftrag ist erledigt: sofort aus „offen", vorn in „erledigt". */
  const alsErledigt = useCallback((id: number, todo?: Auftrag | null) => {
    stand.current += 1;
    setOffen((alt) => (alt || []).filter((x) => x.id !== id));
    if (todo) setErledigt((alt) => [todo, ...alt.filter((x) => x.id !== id)]);
  }, []);
  const ersetzen = useCallback((t: Auftrag) => {
    if (t.status === "erledigt") { alsErledigt(t.id, t); return; }
    setOffen((alt) => (alt || []).map((x) => (x.id === t.id ? { ...x, ...t, zeitleiste: t.zeitleiste ?? x.zeitleiste } : x)));
  }, [alsErledigt]);
  const entfernen = useCallback((id: number) => { stand.current += 1; setOffen((alt) => (alt || []).filter((x) => x.id !== id)); }, []);
  const wiederOffen = useCallback((t: Auftrag) => {
    stand.current += 1;
    setErledigt((alt) => alt.filter((x) => x.id !== t.id));
    setOffen((alt) => [t, ...(alt || []).filter((x) => x.id !== t.id)]);
  }, []);
  return { offen, erledigt, fehler, erledigtTage, laden, sperre, alsErledigt, ersetzen, entfernen, wiederOffen };
}

function TasksInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tasks"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [liste, setListe] = useState<Vermerk[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  // 24.08.2026: Von der Bestellreferenz zur Person — siehe Kommentar am Knopf.
  const [oeffnet, setOeffnet] = useState<number | null>(null);
  const [kundeFehler, setKundeFehler] = useState<{ id: number; text: string } | null>(null);
  const kundeOeffnen = async (ref: string, id: number) => {
    setOeffnet(id); setKundeFehler(null);
    const r = await api(`/agent/crm/person-zu-ref/${encodeURIComponent(ref)}`);
    setOeffnet(null);
    if (r.ok && r.json?.personId) { window.location.href = `/agent/pipeline?person=${r.json.personId}`; return; }
    setKundeFehler({ id, text: r.json?.error || "Zu dieser Aufgabe gibt es keinen Kunden, den du öffnen darfst." });
  };
  // E-IT-F: Der Reiter steht in der URL (?reiter=auftraege) — das Zurück aus der Akte landet wieder hier.
  const [reiter, setReiterRoh] = useState<Reiter>(reiterAusUrl);
  const setReiter = (r: Reiter) => {
    setReiterRoh(r);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("reiter", r);
      if (r !== "auftraege") u.searchParams.delete("auftrag");
      window.history.replaceState(window.history.state, "", `${u.pathname}${u.search}`);
    } catch { /* ohne URL bleibt der Reiter bis zum Neuladen */ }
  };
  // E-029 (24.08.2026): VORHER nur EINE Zahl („auftraege"), die alles zählte,
  // was nicht erledigt war — auch das, was auf Justins Antwort wartet.
  // NACHHER die ehrliche Lage vom Server: offen zählt nur, was WIRKLICH bei mir
  // liegt; wartet und neu stehen daneben und sind Anzeige, keine Marke.
  const [lage, setLage] = useState<Lage>({ offen: 0, wartet: 0, neu: 0, frageAnMich: 0 });
  const auftraege = useAuftraege();

  const laden = useCallback(async () => {
    const r = await api("/agent/vermerke");
    if (r.ok) { setListe(r.json.vermerke || []); setFehler(null); } else setFehler(r.json?.error || "Die Aufgaben konnten nicht geladen werden.");
    setLaedt(false);
    const z = await api("/agent/vermerke/zahlen");
    if (z.ok) setLage({
      offen: Number(z.json.auftraege || 0), wartet: Number(z.json.auftraegeWartet || 0),
      neu: Number(z.json.auftraegeNeu || 0), frageAnMich: Number(z.json.auftraegeFrageAnMich || 0),
    });
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
  const gesamtOffen = aufgabenOffen.length + lage.offen;
  const erledigteAuftraege = auftraege.erledigt;

  return (
    <div className="ta">
      <Rundgang raum="tasks" titel={RUNDGAENGE.tasks.titel} schritte={RUNDGAENGE.tasks.schritte} />
      <section className="ta-kopf">
        <div>
          <span className="ta-pille">Tasks</span>
          <h1>{gesamtOffen === 0 ? <>Nichts offen – <span className="ta-verlauf">gut gemacht.</span></> : ueberfaellig > 0 ? <><span className="ta-verlauf">{ueberfaellig} überfällig</span>, {gesamtOffen} offen.</> : <><span className="ta-verlauf">{gesamtOffen} {gesamtOffen === 1 ? "Aufgabe" : "Aufgaben"}</span> offen.</>}</h1>
          <p>Was die Verwaltung dir zugewiesen hat, Aufträge von Justin und Mara und Hinweise, die für dich freigegeben sind. Aufträge: dringend zuerst, dann nach Eingang.</p>
        </div>
        <div className="ta-lage">
          <small>Deine Lage</small>
          <div className="ta-lage-zahl"><b>{aufgabenOffen.length}</b><span>zu tun</span></div>
          <div className="ta-lage-zeile"><span>Heute fällig</span><b className={heute ? "warn" : ""}>{heute}</b></div>
          <div className="ta-lage-zeile"><span>Überfällig</span><b className={ueberfaellig ? "rot" : ""}>{ueberfaellig}</b></div>
          <div className="ta-lage-zeile"><span>Offene Aufträge</span><b>{lage.offen}</b></div>
          {/* E-029: nur zeigen, was es gibt. Eine Zeile mit einer Null ist eine
              Zeile, die man wegsieht — und dann sieht man auch die Eins nicht. */}
          {lage.wartet > 0 && <div className="ta-lage-zeile"><span>Wartet auf Justin</span><b>{lage.wartet}</b></div>}
          {lage.neu > 0 && <div className="ta-lage-zeile"><span>Neu von Justin</span><b className="warn">{lage.neu}</b></div>}
        </div>
      </section>

      {fehler && <p className="ta-fehler">{fehler}</p>}

      <div className="ta-reiter" role="tablist">
        <button type="button" role="tab" aria-selected={reiter === "offen"} className={reiter === "offen" ? "an" : ""} onClick={() => setReiter("offen")}>Zu tun {aufgabenOffen.length > 0 && <em>{aufgabenOffen.length}</em>}</button>
        {/* E-029: die Zahl im Reiter ist die ehrliche Zahl. Der Punkt daneben
            erscheint nur, wenn Justin geschrieben hat und ich es noch nicht
            gelesen habe — und verschwindet, sobald ich die Zeitleiste öffne. */}
        <button type="button" role="tab" aria-selected={reiter === "auftraege"} className={reiter === "auftraege" ? "an" : ""} onClick={() => setReiter("auftraege")} data-reiter="auftraege">
          Aufträge {lage.offen > 0 && <em>{lage.offen}</em>}{lage.neu > 0 && <i className="ta-punkt" aria-label="Neu von Justin" />}
        </button>
        <button type="button" role="tab" aria-selected={reiter === "hinweise"} className={reiter === "hinweise" ? "an" : ""} onClick={() => setReiter("hinweise")}>Hinweise {hinweise.length > 0 && <em>{hinweise.length}</em>}</button>
        <button type="button" role="tab" aria-selected={reiter === "erledigt"} className={reiter === "erledigt" ? "an" : ""} onClick={() => setReiter("erledigt")} data-reiter="erledigt">Erledigt</button>
      </div>

      {reiter === "auftraege" && <Auftraege daten={auftraege} onGeaendert={() => void laden()} />}

      {reiter !== "auftraege" && laedt && <p className="ta-lade">Lade …</p>}
      {reiter !== "auftraege" && !laedt && sichtbar.length === 0 && !(reiter === "erledigt" && erledigteAuftraege.length > 0) && (
        <div className="ta-leer">
          <b>{reiter === "offen" ? "Nichts offen." : reiter === "hinweise" ? "Keine Hinweise." : "Noch nichts erledigt."}</b>
          <span>{reiter === "offen" ? "Sobald die Verwaltung dir etwas zuweist, steht es hier – mit Frist." : reiter === "hinweise" ? "Hier erscheinen Notizen, die für dich oder das Team freigegeben wurden." : "Abgehakte Aufgaben und erledigte Aufträge sammeln sich hier."}</span>
        </div>
      )}
      {/* E-IT-F: Erledigte Aufträge stehen hier, nicht mehr im Reiter „Aufträge" — mit Herkunft und „Wieder öffnen". */}
      {reiter === "erledigt" && erledigteAuftraege.length > 0 && (
        <ErledigteAuftraege liste={erledigteAuftraege} tage={auftraege.erledigtTage}
          onWieder={(t) => { auftraege.wiederOffen(t); geaendert(); void laden(); }} />
      )}
      {reiter !== "auftraege" && sichtbar.length > 0 && (
        <div className="ta-liste">
          {reiter === "erledigt" && erledigteAuftraege.length > 0 && <p className="ta-abschnitt">Aufgaben der Verwaltung</p>}
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
                  {/* 24.08.2026 (Justin): VORHER führte „Kunde öffnen" auf
                      /agent/kunden?ref=… — die Pipeline liest aber nur
                      `?person=`, also landete man einfach auf der Pipeline und
                      es öffnete sich gar nichts. NACHHER wird die Referenz
                      erst in eine Person aufgelöst (mit derselben
                      Rechteprüfung wie die Akte). Gehört der Kunde jemand
                      anderem, sagt der Knopf das — statt ins Leere zu führen. */}
                  {v.ref && (
                    <button type="button" className="ta-link" disabled={oeffnet === v.id}
                            onClick={() => void kundeOeffnen(v.ref!, v.id)}>
                      <ExternalLink size={13} strokeWidth={1.75} /> {oeffnet === v.id ? "Öffne …" : "Kunde öffnen"}
                    </button>
                  )}
                  {kundeFehler?.id === v.id && <p className="ta-kunde-fehler">{kundeFehler.text}</p>}
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

// ── Erledigte Aufträge (E-IT-F) ─────────────────────────────────────────────
function ErledigteAuftraege({ liste, tage, onWieder }: { liste: Auftrag[]; tage: number; onWieder: (t: Auftrag) => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [fehler, setFehler] = useState<{ id: number; text: string } | null>(null);
  const wieder = async (a: Auftrag) => {
    setBusy(a.id); setFehler(null);
    const r = await api(`/agent/auftraege/${a.id}/wieder-oeffnen`, { method: "POST", body: JSON.stringify({}) });
    setBusy(null);
    if (!r.ok || !r.json?.todo) { setFehler({ id: a.id, text: r.json?.error || "Das ließ sich nicht wieder öffnen." }); return; }
    onWieder(r.json.todo);
  };
  return (
    <div className="ta-liste ta-erledigt-auftraege">
      <p className="ta-abschnitt">Aufträge · erledigt in den letzten {tage} Tagen</p>
      {liste.map((a) => {
        const st = auftragStatus(a);
        return (
          <div key={a.id} className="ta-karte erledigt ta-auftrag-erledigt">
            <span className="ta-zeichen"><Check size={18} strokeWidth={2} /></span>
            <div className="ta-text">
              <p><b className="ta-erl-kunde">{a.kundeAnzeige || a.kunde || "ohne Kundenbezug"}</b> · {a.artLabel || a.titel}</p>
              <div className="ta-meta">
                <span className="gut">{st.text} {zeit(a.erledigtAm)}</span>
                {st.grund && <span>{a.erledigtArt === "auto" ? `durch ${st.grund}` : st.grund}</span>}
                <span>{eingangText(a.eingangAm ?? a.createdAt ?? null)}</span>
              </div>
              {a.ergebnis && a.erledigtArt !== "auto" && <p className="ta-erl-ergebnis">Ergebnis: {a.ergebnis}</p>}
              <button type="button" className="ta-link" disabled={busy === a.id} onClick={() => void wieder(a)}>
                {busy === a.id ? "Öffne …" : "Wieder öffnen"}
              </button>
              {fehler?.id === a.id && <p className="ta-kunde-fehler">{fehler.text}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Aufträge (E-028 → E-IT-F) ───────────────────────────────────────────────
//
// VORHER (E-029): Karten, oben Offenes, darunter „Zuletzt erledigt". Die erledigte
// Karte blieb stehen, bis das Neuladen fertig war — mit aktivem Knopf.
// NACHHER (E-IT-F): eine Liste nur offener Aufträge, Zeile je Auftrag mit Kunde,
// Art, Eingang und Status; ein Klick klappt auf (Text, Strecke, Zeitleiste,
// Rückfrage). „Erledigt" nimmt die Zeile sofort heraus und klappt den nächsten auf.
type AuftraegeDaten = ReturnType<typeof useAuftraege>;

function Auftraege({ daten, onGeaendert }: { daten: AuftraegeDaten; onGeaendert: () => void }) {
  const [richtung, setRichtungRoh] = useState<AuftragRichtung>(richtungLesen);
  const [offenId, setOffenId] = useState<number | null>(() => {
    try { const n = Number(new URLSearchParams(window.location.search).get("auftrag")); return n > 0 ? n : null; } catch { return null; }
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [zeilenFehler, setZeilenFehler] = useState<{ id: number; text: string } | null>(null);
  const [pflichtFuer, setPflichtFuer] = useState<number | null>(null);
  const fokusNach = useRef<number | null>(null);
  const liste = daten.offen;
  const sortiert = useMemo(() => auftraegeSortieren(liste || [], richtung), [liste, richtung]);

  const setRichtung = (r: AuftragRichtung) => {
    setRichtungRoh(r);
    try { window.localStorage.setItem(RICHTUNG_SCHLUESSEL, r); } catch { /* nur bis zum Neuladen */ }
  };

  // Nach „Erledigt": die nächste Zeile ins Bild holen und fokussieren (Tastatur: Enter klappt auf).
  useEffect(() => {
    const id = fokusNach.current;
    if (!id) return;
    fokusNach.current = null;
    const el = document.getElementById(`auftrag-${id}`);
    if (el) { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); (el.querySelector(".ta-zeile-knopf") as HTMLElement | null)?.focus({ preventScroll: true }); }
  }, [offenId, sortiert]);

  const naechsterAufklappen = (ohne: number[], vomServer?: { id: number } | null) => {
    const rest = (liste || []).filter((x) => !ohne.includes(x.id));
    const n = (vomServer && rest.some((x) => x.id === vomServer.id) ? rest.find((x) => x.id === vomServer.id) : null) ?? naechsterAuftrag(rest, ohne, richtung);
    setOffenId(n ? n.id : null);
    fokusNach.current = n ? n.id : null;
  };

  /** EIN Klick. Pflichtsatz (Frage im Verlauf, Recht, Lage-Auftrag): dann klappt die Zeile mit dem Satzfeld auf. */
  const erledigen = async (a: Auftrag, ergebnis?: string): Promise<boolean> => {
    if (a.ergebnisPflicht && !(ergebnis && ergebnis.trim().length >= 5)) { setOffenId(a.id); setPflichtFuer(a.id); return false; }
    setBusy(a.id); setZeilenFehler(null); daten.sperre.current = true;
    const r = await api(`/agent/auftraege/${a.id}/erledigt`, { method: "POST", body: JSON.stringify({ ergebnis: ergebnis ?? "", richtung }) });
    setBusy(null); daten.sperre.current = false;
    if (!r.ok) {
      if (r.json?.code === "NICHT_BEI_DIR") { daten.entfernen(a.id); setHinweis(r.json.error); naechsterAufklappen([a.id]); return true; }
      if (r.json?.code === "ERGEBNIS_PFLICHT") { setOffenId(a.id); setPflichtFuer(a.id); }
      setZeilenFehler({ id: a.id, text: r.json?.error || "Das hat nicht geklappt." });
      return false;
    }
    const todo: Auftrag | null = r.json?.todo ?? null;
    daten.alsErledigt(a.id, todo);
    const st = todo ? auftragStatus(todo) : null;
    setHinweis(r.json?.schonErledigt
      ? `War schon erledigt${st?.grund ? ` – ${todo?.erledigtArt === "auto" ? "automatisch: " : ""}${st.grund}` : ""}: ${a.kundeAnzeige || a.titel}.`
      : `Erledigt: ${a.kundeAnzeige || a.titel} · ${a.artLabel || a.titel}.`);
    setPflichtFuer(null);
    naechsterAufklappen([a.id], r.json?.naechster ?? null);
    onGeaendert(); geaendert();
    return true;
  };

  if (liste === null && !daten.fehler) return <p className="ta-lade">Lade …</p>;
  return (
    <div className="ta-auf">
      <div className="ta-auf-leiste">
        <span className="ta-auf-zahl">{sortiert.length} offen <small>· dringend zuerst, dann nach Eingang</small></span>
        <div className="ta-sort" role="group" aria-label="Reihenfolge nach Eingang">
          <button type="button" aria-pressed={richtung === "alt"} className={richtung === "alt" ? "an" : ""} onClick={() => setRichtung("alt")}>Älteste zuerst</button>
          <button type="button" aria-pressed={richtung === "neu"} className={richtung === "neu" ? "an" : ""} onClick={() => setRichtung("neu")}>Neueste zuerst</button>
        </div>
      </div>
      {daten.fehler && <p className="ta-fehler">{daten.fehler}</p>}
      {hinweis && <p className="ta-hinweis" role="status">{hinweis} <button type="button" onClick={() => setHinweis(null)} aria-label="Hinweis schließen">×</button></p>}
      {liste && liste.length === 0 && (
        <div className="ta-leer">
          <b>Nichts offen.</b>
          <span>{daten.erledigt.length > 0 ? "Alles erledigt. Was du gemeldet hast, steht im Reiter „Erledigt“." : "Wenn Justin oder Mara dir einen Auftrag geben, steht er hier – mit Kunde, Art und Eingang."}</span>
        </div>
      )}
      {sortiert.length > 0 && (
        <div className="ta-tabelle" role="table" aria-label="Offene Aufträge">
          <div className="ta-kopfzeile" role="row">
            <span role="columnheader">Kunde</span><span role="columnheader">Art</span><span role="columnheader">Eingang</span><span role="columnheader">Status</span><span role="columnheader" className="ta-sp-aktion-kopf">Aktion</span>
          </div>
          {sortiert.map((a) => (
            <AuftragZeile key={a.id} a={a} auf={offenId === a.id} busy={busy === a.id}
              pflicht={pflichtFuer === a.id} fehler={zeilenFehler?.id === a.id ? zeilenFehler.text : null}
              sperre={daten.sperre}
              onToggle={() => { setOffenId((v) => (v === a.id ? null : a.id)); if (pflichtFuer !== a.id) setPflichtFuer(null); }}
              onErledigen={(ergebnis) => erledigen(a, ergebnis)}
              onChange={(t) => daten.ersetzen(t)}
              onWeg={(naechster) => { daten.entfernen(a.id); naechsterAufklappen([a.id], naechster); onGeaendert(); geaendert(); }}
              onGeaendert={() => { onGeaendert(); geaendert(); }} />
          ))}
        </div>
      )}
      <p className="ta-fuss">„Erledigt“ schließt mit einem Klick; einen Satz zum Ergebnis kannst du in der aufgeklappten Zeile mitschicken – Pflicht ist er nur, wo eine Frage im Spiel war oder bei Kündigung, Widerruf, Beschwerde und Lage-Aufträgen. Viele Aufträge erledigen sich auch selbst, sobald du in der Akte ein Ergebnis erfasst, zurückrufst, auf WhatsApp antwortest oder eine Unterlage anforderst – das steht dann im Reiter „Erledigt“.</p>
    </div>
  );
}

function AuftragZeile({ a, auf, busy, pflicht, fehler, sperre, onToggle, onErledigen, onChange, onWeg, onGeaendert }: {
  a: Auftrag; auf: boolean; busy: boolean; pflicht: boolean; fehler: string | null;
  sperre: { current: boolean };
  onToggle: () => void; onErledigen: (ergebnis?: string) => Promise<boolean>; onChange: (t: Auftrag) => void;
  onWeg: (naechster?: { id: number } | null) => void; onGeaendert: () => void;
}) {
  const st = auftragStatus(a);
  const eingang = a.eingangAm ?? a.createdAt ?? null;
  const neueNachricht = !!a.neuSeit && !!eingang && new Date(a.neuSeit).getTime() - new Date(eingang).getTime() > 3_600_000;
  const akte = akteZiel(a);
  return (
    <div className={`ta-zeile${auf ? " auf" : ""}${a.dringend ? " dringend" : ""} ton-${st.ton}`} role="row" id={`auftrag-${a.id}`}>
      <button type="button" className="ta-zeile-knopf" onClick={onToggle} aria-expanded={auf} aria-controls={`auftrag-${a.id}-inhalt`}>
        <span className="ta-sp ta-sp-kunde" role="cell">
          <b>{a.kundeAnzeige || a.kunde || "ohne Kundenbezug"}</b>
          <small>{[a.ref, a.kundeTelefon, a.weitereZumKunden ? `+${a.weitereZumKunden} weitere zu diesem Kunden` : null].filter(Boolean).join(" · ") || a.titel}</small>
        </span>
        <span className="ta-sp ta-sp-art" role="cell">
          <b>{a.artLabel || a.titel}</b>
          <small>{a.herkunft || ""}{a.dringend ? " · dringend" : ""}</small>
        </span>
        <span className="ta-sp ta-sp-eingang" role="cell">
          <b>{eingangText(eingang)}</b>
          <small>{vorTagen(eingang)}{neueNachricht ? ` · neue Nachricht ${berlinTagZeit(a.neuSeit!)}` : ""}</small>
        </span>
        <span className="ta-sp ta-sp-status" role="cell">
          <b><i aria-hidden="true" />{st.text}</b>
          {st.grund ? <small title={st.grund}>{st.grund}</small> : a.wiederOffenZahl ? <small>{a.wiederOffenZahl}× wieder geöffnet</small> : null}
        </span>
      </button>
      <span className="ta-sp-aktion" role="cell">
        {akte && <Link href={akte} className="ta-knopf klein" aria-label={`Akte von ${a.kundeAnzeige || "diesem Kunden"} öffnen`}>Akte</Link>}
        {a.status !== "wartet" && !a.frageOffen && (
          <button type="button" className="ta-knopf gut klein" disabled={busy} onClick={() => void onErledigen()} aria-label={`Auftrag ${a.artLabel || a.titel} für ${a.kundeAnzeige || "diesen Kunden"} als erledigt melden`}>
            {busy ? "…" : "Erledigt"}
          </button>
        )}
      </span>
      {fehler && !auf && <p className="ta-fehler ta-zeile-fehler">{fehler}</p>}
      {auf && <AuftragInhalt a={a} pflicht={pflicht} fehlerVonAussen={fehler} sperre={sperre} onErledigen={onErledigen} onChange={onChange} onWeg={onWeg} onGeaendert={onGeaendert} />}
    </div>
  );
}

// E-029 (24.08.2026) — der Inhalt eines Auftrags (vorher die ganze Karte).
//   · Hat Justin geschrieben und ich es noch nicht gelesen, sagt der Inhalt das
//     oben; das Aufklappen meldet dem Server „gesehen".
//   · Stellt Justin eine Frage, steht sie als Kasten da, MIT Antwort-Knopf.
//   · „Erledigt" verlangt den Ergebnis-Satz nur, wenn eine Frage im Spiel war oder
//     die Art es verlangt (ergebnisPflicht vom Server) — sonst ist er freiwillig.
// E-IT-F: Beim Aufklappen kommt der ganze Auftrag (voller Text, ganze Zeitleiste) —
// die Liste trägt nur das Nötige. Gleiche Systemzeilen hintereinander werden gefaltet.
function AuftragInhalt({ a, pflicht, fehlerVonAussen, sperre, onErledigen, onChange, onWeg, onGeaendert }: {
  a: Auftrag; pflicht: boolean; fehlerVonAussen: string | null; sperre: { current: boolean };
  onErledigen: (ergebnis?: string) => Promise<boolean>; onChange: (t: Auftrag) => void;
  onWeg: (naechster?: { id: number } | null) => void; onGeaendert: () => void;
}) {
  const [modus, setModus] = useState<null | "frage" | "ergebnis" | "zurueck" | "kommentar" | "antwort">(pflicht ? "ergebnis" : null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [voll, setVoll] = useState<Auftrag | null>(null);
  const [zeitleisteAuf, setZeitleisteAuf] = useState(a.neuFuerAgent > 0 || a.frageAnAgent || a.status === "wartet");
  const z = voll ?? a;

  useEffect(() => { if (pflicht) setModus("ergebnis"); }, [pflicht]);
  // Solange ein Formular offen ist, lädt die Liste nicht neu (die Zeile springt sonst unter dem Finger weg).
  useEffect(() => { sperre.current = !!modus; return () => { sperre.current = false; }; }, [modus, sperre]);

  // Den ganzen Auftrag laden — und „gesehen" melden (Marke „Neu" fällt, wie beim Aufklappen der Zeitleiste).
  useEffect(() => {
    let lebt = true;
    void api(`/agent/auftraege/${a.id}`).then((r) => { if (lebt && r.ok && r.json?.todo) setVoll(r.json.todo); });
    if (a.neuFuerAgent > 0 || a.ungelesen) {
      void api(`/agent/auftraege/${a.id}/gelesen`, { method: "POST" }).then((r) => { if (lebt && r.ok && r.json?.todo) { onChange({ ...r.json.todo, zeitleiste: a.zeitleiste }); } });
    }
    return () => { lebt = false; };
  }, [a.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tun = async (pfad: string, body?: any) => {
    setBusy(true); setFehler(null);
    const r = await api(`/agent/auftraege/${a.id}/${pfad}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) {
      if (r.json?.code === "NICHT_BEI_DIR") { onWeg(null); return; }
      if (r.json?.todo) onChange(r.json.todo);
      setFehler(r.json?.error || "Das hat nicht geklappt."); return;
    }
    setModus(null); setText("");
    if (pfad === "zurueck") { onWeg(r.json?.naechster ?? null); return; }
    if (r.json?.todo) { setVoll(r.json.todo); onChange(r.json.todo); }
    onGeaendert();
  };

  const melden = async () => {
    setBusy(true); setFehler(null);
    const ok = await onErledigen(text.trim());
    setBusy(false);
    if (ok) { setModus(null); setText(""); }
  };

  const zl = z.zeitleiste || [];
  const letzteFrage = z.frageOffen ? [...zl].reverse().find((b) => b.art === "frage" && b.autorArt === "agent") : null;
  const frageVonJustin = z.frageAnAgent ? [...zl].reverse().find((b) => b.art === "frage" && b.autorArt === "betreiber") : null;
  const letzteAntwort = a.neuFuerAgent > 0 ? [...zl].reverse().find((b) => b.autorArt === "betreiber") : null;
  // Freiwilliger Satz: leer abschicken ist erlaubt. Pflicht: mindestens ein Satz.
  const mindest = modus === "ergebnis" ? (z.ergebnisPflicht ? 5 : 0) : modus === "kommentar" || modus === "antwort" ? 2 : 3;
  const linkOk = !!z.link && (z.link.startsWith("http") || z.link.startsWith("/agent"));
  const vorgang = !!z.link && z.link.startsWith("/agent/app-vorgaenge/");
  const gefaltet = falten(zl);

  return (
    <div className="ta-zeile-inhalt" id={`auftrag-${a.id}-inhalt`}>
      <h3>{z.titel}</h3>
      {(z.kunde || z.ref) && (
        <p className="ta-auftrag-text ta-kunde-zeile">
          Kunde: <b>{z.kunde || z.ref}</b>{z.kundeTelefon ? <> · <a href={`tel:${z.kundeTelefon}`}>{z.kundeTelefon}</a></> : ""}{z.kunde && z.ref ? ` · ${z.ref}` : ""}
        </p>
      )}
      {z.text && <p className="ta-auftrag-text">{z.text}</p>}
      {/* 06.09.2026: Aufträge aus dem Kundenbereich tragen den Link auf die Vorgangsseite. */}
      {linkOk && (!z.personId || vorgang) ? (
        <a href={z.link!} target={z.link!.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="ta-link"><ExternalLink size={13} strokeWidth={1.75} /> {vorgang ? "Vorgang öffnen" : "Öffnen"}</a>
      ) : null}
      {/* 07.09.2026 (Justin): die Strecke — was genau tun, wo, und was am Ende. */}
      {z.strecke && z.strecke.length > 0 && (
        <ol className="ta-strecke">
          {z.strecke.map((sch, i) => <li key={i}>{sch}</li>)}
        </ol>
      )}
      {frageVonJustin && <div className="ta-kasten warn"><b>Justin fragt dich:</b> „{frageVonJustin.text}“</div>}
      {!frageVonJustin && letzteAntwort && <div className="ta-kasten neu"><b>Neu von Justin:</b> „{letzteAntwort.text}“</div>}
      {letzteFrage && <div className="ta-kasten warn">Deine Frage ist bei Justin: „{letzteFrage.text}“ — sobald er antwortet, läuft der Auftrag weiter.</div>}
      {z.wiederOffenAm && z.wiederOffenGrund && <div className="ta-kasten neu"><b>Wieder offen:</b> {z.wiederOffenGrund}</div>}
      {(fehler || fehlerVonAussen) && <p className="ta-fehler" style={{ marginTop: 12 }}>{fehler || fehlerVonAussen}</p>}

      {!modus && (
        <div className="ta-knoepfe">
          {z.frageAnAgent && <button type="button" className="ta-knopf haupt" disabled={busy} onClick={() => setModus("antwort")}>Justin antworten</button>}
          {z.status !== "wartet" && !z.frageOffen && <button type="button" className="ta-knopf gut" disabled={busy} onClick={() => setModus("ergebnis")}>Mit Ergebnis erledigen</button>}
          {!z.frageOffen && !z.frageAnAgent && <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("frage")}>Rückfrage an Justin</button>}
          <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("kommentar")}>Notiz</button>
          <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("zurueck")}>Zurückgeben</button>
        </div>
      )}
      {modus && (
        <div className="ta-form">
          <p>
            {modus === "frage" && "Was musst du wissen, um weiterzumachen? Die Frage geht sofort an Justin; der Auftrag wartet so lange."}
            {modus === "antwort" && "Deine Antwort geht direkt an Justin und steht in der Zeitleiste, die er sieht."}
            {modus === "ergebnis" && (z.ergebnisPflicht
              ? (z.frageOffen || z.frageAnAgent || zl.some((b) => b.art === "frage")
                ? "Zu diesem Auftrag gab es eine Frage – halte bitte in einem Satz fest, wie sie ausgegangen ist. Justin liest genau das."
                : z.zustand
                  ? "Halte bitte in einem Satz fest, was geklärt ist (z. B. neue Adresse eingetragen, Kunde erreicht) – sonst meldet sich der Auftrag wieder."
                  : "Bei Kündigung, Widerruf, Beschwerde oder Löschantrag gehört ein Satz dazu, was veranlasst ist.")
              : "Was hast du gemacht? Ein Satz genügt, und er ist freiwillig – du kannst auch direkt melden.")}
            {modus === "zurueck" && "Warum kannst du den Auftrag nicht übernehmen? Er geht mit deiner Begründung zurück an Justin."}
            {modus === "kommentar" && "Eine Notiz für die Zeitleiste – Justin sieht sie, der Auftrag läuft weiter."}
          </p>
          <textarea className="ta-feld" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus
            placeholder={modus === "frage" ? "Deine Frage …" : modus === "antwort" ? "Deine Antwort …" : modus === "ergebnis" ? (z.ergebnisPflicht ? "Das Ergebnis …" : "Was hast du gemacht? (freiwillig)") : modus === "zurueck" ? "Der Grund …" : "Deine Notiz …"} />
          <div className="ta-knoepfe" style={{ marginTop: 0 }}>
            <button type="button" className="ta-knopf haupt" disabled={busy || text.trim().length < mindest}
              onClick={() => (modus === "ergebnis" ? void melden() : void tun(
                modus === "antwort" ? "kommentar" : modus,
                modus === "frage" ? { text } : modus === "zurueck" ? { grund: text } : { text },
              ))}>
              {busy ? "…" : modus === "frage" ? "Frage senden" : modus === "antwort" ? "Antwort senden" : modus === "ergebnis" ? (text.trim() || z.ergebnisPflicht ? "Als erledigt melden" : "Ohne Text melden") : modus === "zurueck" ? "Zurückgeben" : "Speichern"}
            </button>
            <button type="button" className="ta-knopf" onClick={() => { setModus(null); setText(""); }}>Abbrechen</button>
          </div>
        </div>
      )}
      <button type="button" className="ta-zeitleiste-knopf" onClick={() => setZeitleisteAuf((v) => !v)}>
        {zeitleisteAuf ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Zeitleiste{z.beitraege || zl.length ? ` (${Math.max(Number(z.beitraege || 0), zl.length)})` : ""}
        {a.neuFuerAgent > 0 && <em className="ta-punkt-zeile">{a.neuFuerAgent} neu</em>}
      </button>
      {zeitleisteAuf && (
        <div className="ta-zeitleiste">
          <div className="ta-blase system">{eingangText(z.eingangAm ?? z.createdAt ?? null)}{z.delegiertAm ? ` · übergeben ${zeit(z.delegiertAm)}` : ""}</div>
          {!voll && a.zeitleisteGekuerzt && <div className="ta-blase system">Lade die ganze Zeitleiste …</div>}
          {gefaltet.map(({ b, mal }) => (
            <div key={b.id} className={`ta-blase ${b.autorArt} ${b.art === "frage" || b.art === "ergebnis" ? b.art : ""}`}>
              {b.art === "frage" && <strong>{b.autorArt === "agent" ? "Deine Frage" : "Frage von Justin"}</strong>}
              {b.art === "antwort" && <strong>{b.autorArt === "agent" ? "Deine Antwort" : "Antwort von Justin"}</strong>}
              {b.art === "ergebnis" && <strong>Ergebnis</strong>}
              {mal > 1 ? `${mal}× derselbe Hinweis: ` : ""}{b.text}
              {b.autorArt !== "system" ? <small>{b.autorArt === "agent" ? "Du" : b.autorName} · {zeit(b.am)}</small> : <small>{b.autorName} · {zeit(b.am)}</small>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Aufeinanderfolgende gleiche Systemzeilen zu einer zusammenfassen (nichts wird gelöscht — nur gefaltet). */
function falten(zl: Beitrag[]): { b: Beitrag; mal: number }[] {
  const aus: { b: Beitrag; mal: number }[] = [];
  for (const b of zl) {
    const vor = aus[aus.length - 1];
    if (vor && b.autorArt === "system" && vor.b.autorArt === "system" && vor.b.text === b.text) { vor.mal += 1; vor.b = b; continue; }
    aus.push({ b, mal: 1 });
  }
  return aus;
}
