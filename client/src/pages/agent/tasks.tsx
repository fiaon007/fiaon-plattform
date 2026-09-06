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
  // E-029 (24.08.2026): der Austausch geht in beide Richtungen.
  frageAnAgent: boolean; neuFuerAgent: number; ergebnisPflicht: boolean; erledigtVon: string | null;
  /** Der Kunde hinter der Aufgabe (05.09.2026) — Daniel: „wer ist das?" */
  ref?: string | null; kunde?: string | null; kundeTelefon?: string | null; personId?: number | null;
}
interface Lage { offen: number; wartet: number; neu: number; frageAnMich: number }

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
  const [reiter, setReiter] = useState<"offen" | "auftraege" | "hinweise" | "erledigt">("offen");
  // E-029 (24.08.2026): VORHER nur EINE Zahl („auftraege"), die alles zählte,
  // was nicht erledigt war — auch das, was auf Justins Antwort wartet.
  // NACHHER die ehrliche Lage vom Server: offen zählt nur, was WIRKLICH bei mir
  // liegt; wartet und neu stehen daneben und sind Anzeige, keine Marke.
  const [lage, setLage] = useState<Lage>({ offen: 0, wartet: 0, neu: 0, frageAnMich: 0 });

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
          <div className="ta-lage-zeile"><span>Aufträge vom Betreiber</span><b>{lage.offen}</b></div>
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
        <button type="button" role="tab" aria-selected={reiter === "auftraege"} className={reiter === "auftraege" ? "an" : ""} onClick={() => setReiter("auftraege")}>
          Aufträge {lage.offen > 0 && <em>{lage.offen}</em>}{lage.neu > 0 && <i className="ta-punkt" aria-label="Neu von Justin" />}
        </button>
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

// ── Aufträge vom Betreiber (E-028, Austausch E-029 am 24.08.2026) ───────────
//
// VORHER: eine einzige Liste, in der offene und erledigte Aufträge gemischt
// standen — der Mitarbeiter hakte etwas ab und die Karte blieb, wo sie war.
// NACHHER: Was zu tun ist, steht oben. Erledigtes rutscht in einen
// eingeklappten Abschnitt darunter, ist aber nicht weg — man muss nachlesen
// können, was man gemeldet hat. Grund: Justins Auftrag vom 24.08.,
// „danach verschwindet die Aufgabe aus seiner offenen Liste".
function Auftraege({ onGeaendert }: { onGeaendert: () => void }) {
  const [liste, setListe] = useState<Auftrag[] | null>(null);
  const [fertig, setFertig] = useState<Auftrag[]>([]);
  const [fertigAuf, setFertigAuf] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const laden = useCallback(async () => {
    const r = await api("/agent/auftraege");
    if (r.ok) { setListe(r.json.auftraege || []); setFertig(r.json.erledigt || []); setFehler(null); }
    else setFehler(r.json?.error || "Die Aufträge kamen nicht.");
  }, []);
  useEffect(() => { void laden(); }, [laden]);
  // Ein erledigter Auftrag gehört nicht mehr in die offene Liste: neu laden,
  // damit er dort verschwindet und unten bei „Zuletzt erledigt" auftaucht.
  const ersetzen = (t: Auftrag) => {
    if (t.status === "erledigt") { void laden(); } else setListe((alt) => (alt || []).map((x) => (x.id === t.id ? t : x)));
    onGeaendert(); geaendert();
  };
  const weg = () => { void laden(); onGeaendert(); geaendert(); };

  if (liste === null && !fehler) return <p className="ta-lade">Lade …</p>;
  return (
    <div className="ta-liste">
      <p className="ta-fuss">Aufgaben, die Justin dir aus seiner Liste übergeben hat. Annehmen, Rückfrage stellen, antworten, Ergebnis melden – alles hier, in einer Zeitleiste, die beide Seiten sehen.</p>
      {fehler && <p className="ta-fehler">{fehler}</p>}
      {liste && liste.length === 0 && (
        <div className="ta-leer">
          <b>Nichts offen.</b>
          <span>{fertig.length > 0 ? "Alles gemeldet. Was du erledigt hast, steht unten." : "Wenn Justin dir eine Aufgabe übergibt, steht sie hier – mit allem, was du dazu wissen musst."}</span>
        </div>
      )}
      {(liste || []).map((a) => <AuftragKarte key={a.id} a={a} onChange={ersetzen} onWeg={weg} />)}

      {fertig.length > 0 && (
        <>
          <button type="button" className="ta-zeitleiste-knopf ta-fertig-knopf" onClick={() => setFertigAuf((v) => !v)}>
            {fertigAuf ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Zuletzt erledigt ({fertig.length})
          </button>
          {fertigAuf && fertig.map((a) => <AuftragKarte key={a.id} a={a} onChange={ersetzen} onWeg={weg} />)}
        </>
      )}
    </div>
  );
}

// E-029 (24.08.2026) — die Karte eines Auftrags.
//
// VORHER: annehmen, fragen, Notiz, Ergebnis (immer Pflichttext), zurückgeben.
// Justins Frage konnte es nicht geben, und ob er geantwortet hatte, stand
// eingeklappt in der Zeitleiste.
//
// NACHHER, entlang Justins Auftrag „das es Austausch zwischen Admins und
// Mitarbeiter gibt":
//   · Hat Justin geschrieben und ich es noch nicht gelesen, sagt die Karte das
//     oben und klappt die Zeitleiste von selbst auf. Das Aufklappen meldet dem
//     Server „gesehen" — die Marke verschwindet dadurch, nicht durch Zeitablauf.
//   · Stellt Justin eine Frage, steht sie als Kasten da, MIT Antwort-Knopf.
//     Kein Zustand ohne sichtbaren nächsten Schritt.
//   · „Erledigt melden" verlangt den Ergebnis-Satz nur, wenn eine Frage im
//     Spiel war (ergebnisPflicht vom Server) — sonst ist er freiwillig.
function AuftragKarte({ a, onChange, onWeg }: { a: Auftrag; onChange: (t: Auftrag) => void; onWeg: () => void }) {
  const [modus, setModus] = useState<null | "frage" | "ergebnis" | "zurueck" | "kommentar" | "antwort">(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [zeitleisteAuf, setZeitleisteAuf] = useState(a.neuFuerAgent > 0 || a.frageAnAgent || a.status === "wartet" || a.status === "in_arbeit");

  const tun = async (pfad: string, body?: any) => {
    setBusy(true); setFehler(null);
    const r = await api(`/agent/auftraege/${a.id}/${pfad}`, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!r.ok) { setFehler(r.json?.error || "Das hat nicht geklappt."); return; }
    if (r.json?.todo) onChange(r.json.todo); else onWeg();
    setModus(null); setText("");
  };

  // Aufgeklappte Zeitleiste heißt gelesen. Der Server setzt den Zeitpunkt, die
  // Marke leitet sich daraus ab — sie kann also nicht stehen bleiben.
  useEffect(() => {
    if (!zeitleisteAuf || a.neuFuerAgent < 1 || a.status === "erledigt") return;
    let lebt = true;
    void api(`/agent/auftraege/${a.id}/gelesen`, { method: "POST" }).then((r) => { if (lebt && r.ok && r.json?.todo) onChange(r.json.todo); });
    return () => { lebt = false; };
  }, [zeitleisteAuf, a.id, a.neuFuerAgent, a.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = STATUS[a.status];
  const letzteFrage = a.frageOffen ? [...a.zeitleiste].reverse().find((b) => b.art === "frage" && b.autorArt === "agent") : null;
  const frageVonJustin = a.frageAnAgent ? [...a.zeitleiste].reverse().find((b) => b.art === "frage" && b.autorArt === "betreiber") : null;
  const letzteAntwort = a.neuFuerAgent > 0 ? [...a.zeitleiste].reverse().find((b) => b.autorArt === "betreiber") : null;
  // Freiwilliger Satz: leer abschicken ist erlaubt. Pflicht: mindestens ein Satz.
  const mindest = modus === "ergebnis" ? (a.ergebnisPflicht ? 5 : 0) : modus === "kommentar" || modus === "antwort" ? 2 : 3;

  return (
    <div className={`ta-auftrag ${a.status}${a.frageAnAgent ? " gefragt" : ""}`}>
      <div className="ta-auftrag-innen">
        <div className="ta-auftrag-kopf">
          <span className="ta-status" style={{ color: a.frageAnAgent ? "#fbbf24" : st.farbe }}><i />{a.frageAnAgent ? "Justin wartet auf deine Antwort" : st.label}</span>
          <small>{a.status === "erledigt" ? `gemeldet ${zeit(a.erledigtAm)}` : a.faelligAm ? `bis ${tag(a.faelligAm)}` : `Priorität ${a.prioritaet} · ${PRIO[a.prioritaet] || ""}`}</small>
        </div>
        <h3>{a.titel}</h3>
        {/* 05.09.2026 — Florentine: „manche Aufgaben sind ohne Namen", Daniel:
            „würde gerne anrufen … aber wer ist das?" Der Kunde steht jetzt
            unter dem Titel, mit Nummer und Referenz, und der Knopf führt in
            die eigene Akte — nicht mehr in die Verwaltung. */}
        {(a.kunde || a.ref) && (
          <p className="ta-auftrag-text" style={{ marginTop: 4 }}>
            Kunde: <b>{a.kunde || a.ref}</b>{a.kundeTelefon ? ` · ${a.kundeTelefon}` : ""}{a.kunde && a.ref ? ` · ${a.ref}` : ""}
          </p>
        )}
        {a.text && <p className="ta-auftrag-text">{a.text}</p>}
        {/* 06.09.2026: Aufträge aus dem Kundenbereich tragen den Link auf die Vorgangsseite
            (/agent/app-vorgaenge/…) — der steht jetzt NEBEN „Kunde öffnen", nicht mehr dahinter
            versteckt. Vorher blendete der Kunde-Knopf jeden weiteren Link aus. */}
        {(() => {
          const linkOk = !!a.link && (a.link.startsWith("http") || a.link.startsWith("/agent"));
          const vorgang = !!a.link && a.link.startsWith("/agent/app-vorgaenge/");
          return (
            <>
              {a.personId ? (
                <a href={`/agent/pipeline?person=${a.personId}`} className="ta-link"><ExternalLink size={13} strokeWidth={1.75} /> Kunde öffnen</a>
              ) : null}
              {linkOk && (!a.personId || vorgang) ? (
                <a href={a.link!} target={a.link!.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="ta-link" style={a.personId ? { marginLeft: 10 } : undefined}><ExternalLink size={13} strokeWidth={1.75} /> {vorgang ? "Vorgang öffnen" : "Öffnen"}</a>
              ) : null}
            </>
          );
        })()}

        {frageVonJustin && <div className="ta-kasten warn"><b>Justin fragt dich:</b> „{frageVonJustin.text}“</div>}
        {!frageVonJustin && letzteAntwort && a.status !== "erledigt" && (
          <div className="ta-kasten neu"><b>Neu von Justin:</b> „{letzteAntwort.text}“</div>
        )}
        {letzteFrage && <div className="ta-kasten warn">Deine Frage ist bei Justin: „{letzteFrage.text}“ — sobald er antwortet, läuft der Auftrag weiter.</div>}
        {a.status === "erledigt" && (
          <div className="ta-kasten gut">
            {a.ergebnis ? <><b>Dein Ergebnis:</b> {a.ergebnis}</> : <>Als erledigt gemeldet{a.erledigtVon ? ` von ${a.erledigtVon}` : ""}. Justin sieht das in seiner Liste.</>}
          </div>
        )}
        {fehler && <p className="ta-fehler" style={{ marginTop: 12 }}>{fehler}</p>}

        {a.status !== "erledigt" && !modus && (
          <div className="ta-knoepfe">
            {a.frageAnAgent && <button type="button" className="ta-knopf haupt" disabled={busy} onClick={() => setModus("antwort")}>Justin antworten</button>}
            {!a.frageAnAgent && a.status === "offen" && <button type="button" className="ta-knopf haupt" disabled={busy} onClick={() => void tun("annehmen")}>Ich mach das</button>}
            {a.status !== "offen" && <button type="button" className="ta-knopf gut" disabled={busy} onClick={() => setModus("ergebnis")}>Als erledigt melden</button>}
            {!a.frageOffen && !a.frageAnAgent && <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("frage")}>Rückfrage an Justin</button>}
            <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("kommentar")}>Notiz</button>
            <button type="button" className="ta-knopf" disabled={busy} onClick={() => setModus("zurueck")}>Zurückgeben</button>
          </div>
        )}
        {modus && (
          <div className="ta-form">
            <p>
              {modus === "frage" && "Was musst du wissen, um weiterzumachen? Die Frage geht sofort an Justin; der Auftrag wartet so lange."}
              {modus === "antwort" && "Deine Antwort geht direkt an Justin und steht in der Zeitleiste, die er sieht."}
              {modus === "ergebnis" && (a.ergebnisPflicht
                ? "Zu diesem Auftrag gab es eine Frage – halte bitte in einem Satz fest, wie sie ausgegangen ist. Justin liest genau das."
                : "Was hast du gemacht? Ein Satz genügt, und er ist freiwillig – du kannst auch direkt melden.")}
              {modus === "zurueck" && "Warum kannst du den Auftrag nicht übernehmen? Er geht mit deiner Begründung zurück an Justin."}
              {modus === "kommentar" && "Eine Notiz für die Zeitleiste – Justin sieht sie, der Auftrag läuft weiter."}
            </p>
            <textarea className="ta-feld" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus
              placeholder={modus === "frage" ? "Deine Frage …" : modus === "antwort" ? "Deine Antwort …" : modus === "ergebnis" ? (a.ergebnisPflicht ? "Das Ergebnis …" : "Was hast du gemacht? (freiwillig)") : modus === "zurueck" ? "Der Grund …" : "Deine Notiz …"} />
            <div className="ta-knoepfe" style={{ marginTop: 0 }}>
              <button type="button" className="ta-knopf haupt" disabled={busy || text.trim().length < mindest}
                onClick={() => void tun(
                  modus === "ergebnis" ? "erledigt" : modus === "antwort" ? "kommentar" : modus,
                  modus === "frage" ? { text } : modus === "ergebnis" ? { ergebnis: text } : modus === "zurueck" ? { grund: text } : { text },
                )}>
                {busy ? "…" : modus === "frage" ? "Frage senden" : modus === "antwort" ? "Antwort senden" : modus === "ergebnis" ? (text.trim() ? "Als erledigt melden" : "Ohne Text melden") : modus === "zurueck" ? "Zurückgeben" : "Speichern"}
              </button>
              <button type="button" className="ta-knopf" onClick={() => { setModus(null); setText(""); }}>Abbrechen</button>
            </div>
          </div>
        )}
      </div>
      <button type="button" className="ta-zeitleiste-knopf" onClick={() => setZeitleisteAuf((v) => !v)}>
        {zeitleisteAuf ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Zeitleiste{a.zeitleiste.length ? ` (${a.zeitleiste.length})` : ""}
        {a.neuFuerAgent > 0 && <em className="ta-punkt-zeile">{a.neuFuerAgent} neu</em>}
      </button>
      {zeitleisteAuf && (
        <div className="ta-zeitleiste">
          <div className="ta-blase system">Übergeben {zeit(a.delegiertAm)}</div>
          {a.zeitleiste.map((b) => (
            <div key={b.id} className={`ta-blase ${b.autorArt} ${b.art === "frage" || b.art === "ergebnis" ? b.art : ""}`}>
              {b.art === "frage" && <strong>{b.autorArt === "agent" ? "Deine Frage" : "Frage von Justin"}</strong>}
              {b.art === "antwort" && <strong>{b.autorArt === "agent" ? "Deine Antwort" : "Antwort von Justin"}</strong>}
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
