// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Abschlussprüfung (23.08.2026, Plan §11 Nachtrag)
// Schummelsicher: Fragen kommen ohne Lösungen vom Server, jede Antwort wird mit
// Zeitstempel gemeldet, Tab-/Fensterwechsel werden gezählt, Auswertung im Server.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { Award, Clock, Download, AlertTriangle, Check, ShieldCheck } from "lucide-react";
import { api } from "../shared";
import type { PruefungsLage, Zertifikat } from "./fortschritt";

interface Frage { id: string; frage: string; antworten: string[] }
interface Sitzung { sitzung: number; fragen: Frage[]; beantwortet: string[]; gestartetAm: string; regeln: PruefungsLage["regeln"] }
interface Ergebnis { punkte: number; gesamt: number; prozent: number; bestanden: boolean; tabwechsel: number; jeKapitel: Record<string, { richtig: number; gesamt: number }>; zertifikat: Zertifikat | null }

const KAPITEL_NAMEN: Record<string, string> = { fiaon: "Was FIAON ist", plattform: "Plattform", ablauf: "Ablauf", gespraech: "Gespräch", recht: "Rechtswissen", schufa: "SCHUFA", oesterreich: "Österreich", schweiz: "Schweiz", werkzeuge: "Werkzeuge", situationen: "Situationen" };
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const datum = (iso: string) => new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });

export function Pruefung({ lage, zertifikat, onNeu }: { lage: PruefungsLage; zertifikat: Zertifikat | null; onNeu: () => void }) {
  const [sitzung, setSitzung] = useState<Sitzung | null>(null);
  const [index, setIndex] = useState(0);
  const [wahl, setWahl] = useState<number | null>(null);
  const [restFrage, setRestFrage] = useState(0);
  const [restGesamt, setRestGesamt] = useState(0);
  const [tabwechsel, setTabwechsel] = useState(0);
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const frageStart = useRef(Date.now());
  const abschlussLaeuft = useRef(false);

  // Tab-/Fensterwechsel zählen (visibilitychange) – wird mit jeder Antwort gemeldet
  useEffect(() => {
    if (!sitzung || ergebnis) return;
    const auf = () => { if (document.hidden) setTabwechsel((t) => t + 1); };
    document.addEventListener("visibilitychange", auf); window.addEventListener("blur", auf);
    return () => { document.removeEventListener("visibilitychange", auf); window.removeEventListener("blur", auf); };
  }, [sitzung, ergebnis]);

  // Uhren
  useEffect(() => {
    if (!sitzung || ergebnis) return;
    const tick = () => {
      const gesamt = sitzung.regeln.sekundenGesamt - Math.floor((Date.now() - new Date(sitzung.gestartetAm).getTime()) / 1000);
      setRestGesamt(gesamt);
      setRestFrage(sitzung.regeln.sekundenJeFrage - Math.floor((Date.now() - frageStart.current) / 1000));
      if (gesamt <= 0) abschliessen();
    };
    tick(); const i = setInterval(tick, 500); return () => clearInterval(i);
  }, [sitzung, index, ergebnis]); // eslint-disable-line react-hooks/exhaustive-deps

  // Zeit je Frage abgelaufen → als unbeantwortet melden und weiter
  useEffect(() => { if (sitzung && !ergebnis && restFrage < 0 && !sendet) antworten(null); }, [restFrage]); // eslint-disable-line react-hooks/exhaustive-deps

  const starten = async () => {
    setFehler(null); setSendet(true);
    const r = await api("/agent/academy/pruefung/start", { method: "POST", body: JSON.stringify({}) });
    setSendet(false);
    if (!r.ok) { setFehler(r.json?.error || "Die Prüfung konnte nicht gestartet werden."); return; }
    const s: Sitzung = r.json;
    const erste = s.fragen.findIndex((f) => !s.beantwortet.includes(f.id));
    setSitzung(s); setIndex(Math.max(0, erste)); setWahl(null); setTabwechsel(0); frageStart.current = Date.now();
  };

  const antworten = async (antwort: number | null) => {
    if (!sitzung || sendet) return;
    const f = sitzung.fragen[index]; if (!f) return;
    setSendet(true); setFehler(null);
    const r = await api("/agent/academy/pruefung/antwort", { method: "POST", body: JSON.stringify({ sitzung: sitzung.sitzung, frageId: f.id, antwort, tabwechsel }) });
    setSendet(false);
    if (!r.ok) { if (r.json?.abgelaufen) { await abschliessen(); return; } setFehler(r.json?.error || "Antwort nicht gespeichert."); return; }
    const naechste = sitzung.fragen.findIndex((x, i) => i > index && !sitzung.beantwortet.includes(x.id));
    sitzung.beantwortet.push(f.id);
    if (naechste === -1) { await abschliessen(); return; }
    setIndex(naechste); setWahl(null); frageStart.current = Date.now();
  };

  const abschliessen = async () => {
    if (!sitzung || abschlussLaeuft.current) return;
    abschlussLaeuft.current = true; setSendet(true);
    const r = await api("/agent/academy/pruefung/abschluss", { method: "POST", body: JSON.stringify({ sitzung: sitzung.sitzung, tabwechsel }) });
    setSendet(false); abschlussLaeuft.current = false;
    if (!r.ok) { setFehler(r.json?.error || "Die Prüfung konnte nicht ausgewertet werden."); return; }
    setErgebnis(r.json); onNeu();
  };

  // ── Ergebnis ──
  if (ergebnis) return (
    <div className={`ac-pr-ergebnis${ergebnis.bestanden ? " gut" : ""}`}>
      <div className="ac-pr-ergebnis-kopf">{ergebnis.bestanden ? <Award size={34} strokeWidth={1.5} /> : <AlertTriangle size={30} strokeWidth={1.5} />}<div><small>{ergebnis.bestanden ? "Bestanden" : "Nicht bestanden"}</small><b>{ergebnis.punkte} von {ergebnis.gesamt} · {ergebnis.prozent} %</b></div></div>
      <div className="ac-pr-kapitel">{Object.entries(ergebnis.jeKapitel).map(([k, v]) => <div key={k} className={v.richtig === v.gesamt ? "voll" : v.richtig === 0 ? "leer" : ""}><span>{KAPITEL_NAMEN[k] || k}</span><b>{v.richtig}/{v.gesamt}</b></div>)}</div>
      {ergebnis.tabwechsel > 0 && <p className="ac-leise">Vermerkt: {ergebnis.tabwechsel} Tab- oder Fensterwechsel während der Prüfung.</p>}
      {ergebnis.bestanden && ergebnis.zertifikat ? <Urkunde z={ergebnis.zertifikat} /> : ergebnis.bestanden ? <p className="ac-leise">Deine Urkunde wird erstellt – lade die Seite gleich neu.</p> : <p className="ac-absatz">Eine Wiederholung ist frühestens nach {lage.regeln.sperreStunden} Stunden möglich, höchstens {lage.regeln.versucheJeWoche} Versuche je Woche. Lies die Kapitel, in denen Fragen fehlten, noch einmal.</p>}
    </div>
  );

  // ── Laufende Prüfung ──
  if (sitzung) {
    const f = sitzung.fragen[index]; const nr = sitzung.beantwortet.length + 1;
    return (
      <div className="ac-pr-lauf">
        <div className="ac-pr-uhr"><span><Clock size={15} /> Frage {mmss(restFrage)}</span><span className="ac-pr-fortschritt">Frage {nr} von {sitzung.fragen.length}</span><span className={restGesamt < 120 ? "alarm" : ""}>Gesamt {mmss(restGesamt)}</span></div>
        <div className="ac-pr-balken"><i style={{ width: `${Math.max(0, Math.min(100, (restFrage / sitzung.regeln.sekundenJeFrage) * 100))}%` }} /></div>
        <div className="ac-pr-frage">
          <p className="ac-frage-text gross">{f.frage}</p>
          <div className="ac-antworten">{f.antworten.map((a, i) => <button key={i} type="button" disabled={sendet} className={`ac-antwort${wahl === i ? " gewaehlt" : ""}`} onClick={() => setWahl(i)}><span className="ac-antwort-text">{a}</span></button>)}</div>
          <div className="ac-uebung-fuss"><button type="button" className="ac-knopf" disabled={wahl === null || sendet} onClick={() => antworten(wahl)}>{sendet ? "…" : nr === sitzung.fragen.length ? "Antworten und Prüfung abschließen" : "Antworten und weiter"}</button><small>Keine Rückkehr zu beantworteten Fragen. Tab-Wechsel werden vermerkt{tabwechsel > 0 ? ` (${tabwechsel})` : ""}.</small></div>
        </div>
        {fehler && <p className="ac-fehler">{fehler}</p>}
      </div>
    );
  }

  // ── Einstieg ──
  const gesperrt = !lage.frei;
  const sperre = lage.sperreBis && new Date(lage.sperreBis) > new Date() ? lage.sperreBis : null;
  return (
    <div className="ac-pr-einstieg">
      {zertifikat && <Urkunde z={zertifikat} />}
      <div className="ac-pr-regeln">
        <div className="ac-pr-regel"><b>{lage.regeln.fragen}</b><span>Fragen, zufällig aus dem Pool, Antworten gemischt</span></div>
        <div className="ac-pr-regel"><b>{lage.regeln.sekundenJeFrage} s</b><span>je Frage · {Math.round(lage.regeln.sekundenGesamt / 60)} Minuten gesamt</span></div>
        <div className="ac-pr-regel"><b>{Math.round(lage.regeln.schwelle * 100)} %</b><span>zum Bestehen</span></div>
        <div className="ac-pr-regel"><b>{lage.regeln.versucheJeWoche}</b><span>Versuche je Woche · Wiederholung nach {lage.regeln.sperreStunden} h</span></div>
      </div>
      <ul className="ac-liste">
        <li>Die Fragen sind überwiegend situativ: ein Fall, eine Entscheidung. Die Auswertung läuft im Server – der Browser kennt die Lösungen nicht.</li>
        <li>Eine Frage nach der anderen, keine Rückkehr. Läuft die Zeit einer Frage ab, gilt sie als unbeantwortet.</li>
        <li>Tab- und Fensterwechsel werden gezählt und mit dem Ergebnis vermerkt. Leg das Handy weg, schließ die anderen Tabs.</li>
        <li>Bestanden → Stufe „Zertifizierter Bonitätsmanager“, Urkunde als PDF und 5 Prozentpunkte mehr Provision.</li>
      </ul>
      {lage.letzte && <p className="ac-leise">Letzter Versuch am {datum(lage.letzte.am)}: {lage.letzte.punkte} von {lage.letzte.gesamt} – {lage.letzte.bestanden ? "bestanden" : "nicht bestanden"}{lage.letzte.tabwechsel ? ` · ${lage.letzte.tabwechsel} Tab-Wechsel` : ""}.</p>}
      {fehler && <p className="ac-fehler">{fehler}</p>}
      <div className="ac-uebung-fuss">
        {gesperrt ? <span className="ac-pr-sperre"><ShieldCheck size={16} /> Die Prüfung öffnet sich, wenn alle zehn Kapiteltests bestanden sind.</span>
          : sperre ? <span className="ac-pr-sperre"><Clock size={16} /> Nächster Versuch ab {datum(sperre)}.</span>
          : lage.versucheFrei <= 0 ? <span className="ac-pr-sperre"><Clock size={16} /> Höchstens {lage.regeln.versucheJeWoche} Versuche je Woche – bitte nächste Woche.</span>
          : <button type="button" className="ac-knopf gross" disabled={sendet} onClick={starten}>{lage.laufend ? "Laufende Prüfung fortsetzen" : zertifikat ? "Prüfung erneut ablegen" : "Prüfung starten"}</button>}
      </div>
    </div>
  );
}

export function Urkunde({ z }: { z: Zertifikat }) {
  return (
    <div className="ac-urkunde">
      <div className="ac-urkunde-siegel"><Award size={26} strokeWidth={1.5} /></div>
      <div className="ac-urkunde-text">
        <small>Deine Urkunde</small>
        <b>{z.stufe}</b>
        <span>Urkunde {z.nummer} · {new Date(z.bestandenAm).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })} · {z.punkte} von {z.gesamt} · Prüf-Code {z.pruefCode}</span>
      </div>
      <div className="ac-urkunde-knoepfe">
        <a className="ac-knopf" href="/api/fiaon/agent/academy/urkunde.pdf?download=1"><Download size={15} />PDF herunterladen</a>
        <a className="ac-knopf still" href="/api/fiaon/agent/academy/urkunde.pdf" target="_blank" rel="noreferrer"><Check size={15} />Ansehen</a>
      </div>
    </div>
  );
}
