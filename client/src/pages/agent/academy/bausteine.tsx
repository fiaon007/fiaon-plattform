// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Bausteine: Inhaltsblöcke, Zeitleiste, Rundgang, Wortwächter,
// geführte Übung (23.08.2026, Plan §11)
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, ChevronRight, AlertTriangle, Quote, BookOpen } from "lucide-react";
import { worthygiene } from "@shared/fiaon-lead-strecke";
import type { Block, Frage, RundgangStation, ZeitStation } from "./typen";

// ── Inhaltsblöcke ─────────────────────────────────────────────────────────
export function Bloecke({ bloecke }: { bloecke: Block[] }) {
  return <div className="ac-bloecke">{bloecke.map((b, i) => <BlockAnsicht key={i} b={b} />)}</div>;
}

function BlockAnsicht({ b }: { b: Block }) {
  const [kopiert, setKopiert] = useState(false);
  switch (b.art) {
    case "absatz": return <p className="ac-absatz">{b.text}</p>;
    case "liste": return b.nummeriert ? <ol className="ac-liste nummeriert">{b.punkte.map((t, i) => <li key={i}>{t}</li>)}</ol> : <ul className="ac-liste">{b.punkte.map((t, i) => <li key={i}>{t}</li>)}</ul>;
    case "merksatz": return <div className="ac-merk"><BookOpen size={18} strokeWidth={1.75} /><p>{b.text}</p></div>;
    case "warnung": return <div className="ac-warn"><AlertTriangle size={18} strokeWidth={1.75} /><p>{b.text}</p></div>;
    case "zitat": return <blockquote className="ac-zitat"><Quote size={16} strokeWidth={1.75} /><p>{b.text}</p>{b.quelle && <cite>{b.quelle}</cite>}</blockquote>;
    case "tabelle": return (
      <div className="ac-tabelle-rahmen"><table className="ac-tabelle"><thead><tr>{b.kopf.map((k, i) => <th key={i}>{k}</th>)}</tr></thead><tbody>{b.zeilen.map((z, i) => <tr key={i}>{z.map((c, j) => <td key={j} data-kopf={b.kopf[j]}>{c}</td>)}</tr>)}</tbody></table></div>
    );
    case "sagen": return (
      <div className="ac-sagen">
        <div className="ac-sagen-spalte gut"><b>Was ich dem Kunden sage</b><ul>{b.sagen.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
        <div className="ac-sagen-spalte nie"><b>Was ich nie sage</b><ul>{b.nieSagen.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      </div>
    );
    case "schritte": return (
      <div className="ac-schritte">{b.titel && <b className="ac-schritte-titel">{b.titel}</b>}{b.schritte.map((s, i) => <div key={i} className="ac-schritt-zeile"><span className="ac-schritt-nr">{i + 1}</span><div><b>{s.titel}</b><p>{s.text}</p></div></div>)}</div>
    );
    case "drei-sichten": return (
      <div className="ac-sichten">
        <div><small>Was der Kunde sieht</small><p>{b.kunde}</p></div>
        <div><small>Was du siehst</small><p>{b.mitarbeiter}</p></div>
        <div><small>Was im Hintergrund passiert</small><p>{b.hintergrund}</p></div>
      </div>
    );
    case "muster": return (
      <div className="ac-muster">
        <div className="ac-muster-kopf"><b>{b.titel}</b><button type="button" className="ac-knopf still klein" onClick={async () => { try { await navigator.clipboard.writeText(b.text); setKopiert(true); setTimeout(() => setKopiert(false), 1800); } catch { /* egal */ } }}>{kopiert ? <Check size={14} /> : <Copy size={14} />}{kopiert ? "Kopiert" : "Kopieren"}</button></div>
        <p>{b.text}</p>
      </div>
    );
    case "kacheln": return <div className="ac-kacheln">{b.kacheln.map((k, i) => <div key={i} className="ac-kachel"><b>{k.titel}</b><p>{k.text}</p></div>)}</div>;
    case "link": return <a className="ac-knopf still" href={b.href} target="_blank" rel="noreferrer"><ExternalLink size={15} />{b.label}</a>;
    case "quellen": return <div className="ac-quellen"><small>Quellen</small><ul>{b.quellen.map((q, i) => <li key={i}>{q}</li>)}</ul></div>;
    case "leitfaden": return (
      <div className="ac-leitfaden">{b.phasen.map((ph, i) => (
        <div key={i} className="ac-phase">
          <div className="ac-phase-kopf"><b>{ph.titel}</b><span>{ph.ziel}</span></div>
          <ul>{ph.saetze.map((s, j) => <li key={j}>{s}</li>)}</ul>
          {ph.hinweis && <p className="ac-phase-hinweis">{ph.hinweis}</p>}
        </div>
      ))}</div>
    );
    default: return null;
  }
}

// ── Zeitleiste (Kapitel 3) ────────────────────────────────────────────────
export function Zeitleiste({ stationen, fertig, onFertig }: { stationen: ZeitStation[]; fertig: boolean; onFertig: (e: any) => void }) {
  const [aktiv, setAktiv] = useState(0);
  const [besucht, setBesucht] = useState<Set<number>>(() => new Set(fertig ? stationen.map((_, i) => i) : [0]));
  const s = stationen[aktiv];
  useEffect(() => { if (!fertig && besucht.size === stationen.length) onFertig({ stationen: stationen.length }); }, [besucht]); // eslint-disable-line react-hooks/exhaustive-deps
  const geh = (i: number) => { const z = Math.max(0, Math.min(stationen.length - 1, i)); setAktiv(z); setBesucht((b) => new Set(b).add(z)); };
  return (
    <div className="ac-zeitleiste">
      <div className="ac-zl-spur">{stationen.map((st, i) => <button key={i} type="button" className={`ac-zl-punkt${i === aktiv ? " an" : ""}${besucht.has(i) ? " besucht" : ""}`} onClick={() => geh(i)} title={st.titel}><span>{st.tag}</span><i /></button>)}</div>
      <div className="ac-zl-karte">
        <small>{s.tag} · {s.wer}</small>
        <h3>{s.titel}</h3>
        <p>{s.text}</p>
        {s.system && <div className="ac-zl-system"><b>Im System</b><p>{s.system}</p></div>}
        <div className="ac-zl-nav"><button type="button" className="ac-knopf still" disabled={aktiv === 0} onClick={() => geh(aktiv - 1)}>Zurück</button><span>{besucht.size} / {stationen.length} Stationen</span><button type="button" className="ac-knopf" disabled={aktiv === stationen.length - 1} onClick={() => geh(aktiv + 1)}>Nächste Station<ChevronRight size={16} /></button></div>
      </div>
    </div>
  );
}

// ── Rundgang durch das Demo-Konto (Kapitel 2) ─────────────────────────────
export function Rundgang({ stationen, fertig, onFertig }: { stationen: RundgangStation[]; fertig: boolean; onFertig: (e: any) => void }) {
  const [aktiv, setAktiv] = useState(0);
  const [besucht, setBesucht] = useState<Set<number>>(() => new Set(fertig ? stationen.map((_, i) => i) : [0]));
  const [demoOffen, setDemoOffen] = useState(true);
  const s = stationen[aktiv];
  useEffect(() => { if (!fertig && besucht.size === stationen.length) onFertig({ stationen: stationen.length }); }, [besucht]); // eslint-disable-line react-hooks/exhaustive-deps
  const geh = (i: number) => { const z = Math.max(0, Math.min(stationen.length - 1, i)); setAktiv(z); setBesucht((b) => new Set(b).add(z)); };
  return (
    <div className="ac-rundgang">
      <div className="ac-rg-liste">{stationen.map((st, i) => <button key={i} type="button" className={`ac-rg-punkt${i === aktiv ? " an" : ""}${besucht.has(i) ? " besucht" : ""}`} onClick={() => geh(i)}><em>{i + 1}</em><span>{st.titel}</span>{besucht.has(i) && <Check size={14} />}</button>)}</div>
      <div className="ac-rg-inhalt">
        <div className="ac-rg-karte">
          <small>Station {aktiv + 1} von {stationen.length}</small>
          <h3>{s.titel}</h3>
          <div className="ac-sichten zwei"><div><small>Was der Kunde sieht</small><p>{s.kunde}</p></div><div><small>Was das für dich heißt</small><p>{s.mitarbeiter}</p></div></div>
          <div className="ac-zl-nav"><button type="button" className="ac-knopf still" disabled={aktiv === 0} onClick={() => geh(aktiv - 1)}>Zurück</button><a className="ac-knopf still" href={`/demo/kundenbereich#${s.anker}`} target="_blank" rel="noreferrer"><ExternalLink size={15} />Im Demo öffnen</a><button type="button" className="ac-knopf" disabled={aktiv === stationen.length - 1} onClick={() => geh(aktiv + 1)}>Nächste Station<ChevronRight size={16} /></button></div>
        </div>
        <div className="ac-rg-demo">
          <div className="ac-rg-demo-kopf"><b>FIAON-DEMO · /demo/kundenbereich</b><button type="button" className="ac-knopf still klein" onClick={() => setDemoOffen(!demoOffen)}>{demoOffen ? "Ausblenden" : "Demo anzeigen"}</button></div>
          {demoOffen && <iframe title="Demo-Kundenbereich" src={`/demo/kundenbereich#${s.anker}`} loading="lazy" />}
        </div>
      </div>
    </div>
  );
}

// ── Wortwächter (Kapitel 1) ───────────────────────────────────────────────
export function Wortpruefer({ aufgaben, fertig, onFertig }: { aufgaben: { satz: string; hinweis: string }[]; fertig: boolean; onFertig: (e: any) => void }) {
  const [texte, setTexte] = useState<string[]>(() => aufgaben.map(() => ""));
  const pruefungen = useMemo(() => texte.map((t) => { const v = worthygiene(t); const lang = t.trim().length >= 40; return { verstoesse: v, ok: lang && v.length === 0, lang }; }), [texte]);
  const alle = pruefungen.every((p) => p.ok);
  return (
    <div className="ac-wort">
      {aufgaben.map((a, i) => (
        <div key={i} className={`ac-wort-aufgabe${pruefungen[i].ok ? " ok" : ""}`}>
          <small>Satz {i + 1} – so fällt er im Alltag</small>
          <p className="ac-wort-alt">„{a.satz}“</p>
          <p className="ac-wort-hinweis">{a.hinweis}</p>
          <textarea value={texte[i]} onChange={(e) => setTexte(texte.map((t, j) => (j === i ? e.target.value : t)))} placeholder="Schreib den Satz hier FIAON-tauglich um (mindestens 40 Zeichen) …" rows={3} />
          <div className="ac-wort-pruefung">
            {pruefungen[i].verstoesse.length > 0 && <span className="ac-wort-verstoss">Verbotene Wörter: {pruefungen[i].verstoesse.join(", ")}</span>}
            {pruefungen[i].verstoesse.length === 0 && !pruefungen[i].lang && texte[i].length > 0 && <span className="ac-wort-neutral">Noch etwas ausführlicher.</span>}
            {pruefungen[i].ok && <span className="ac-wort-ok"><Check size={14} /> Sauber – kein verbotenes Wort.</span>}
          </div>
        </div>
      ))}
      <div className="ac-uebung-fuss">
        {fertig ? <span className="ac-fertig-marke"><Check size={15} /> Übung abgeschlossen</span> : <button type="button" className="ac-knopf" disabled={!alle} onClick={() => onFertig({ saetze: texte, punkte: 3, gesamt: 3 })}>Übung abschließen</button>}
        {!alle && !fertig && <small>Alle drei Sätze müssen frei von verbotenen Wörtern sein.</small>}
      </div>
    </div>
  );
}

// ── Geführte Übung im Office (Kapitel 9) ──────────────────────────────────
export function UebungGefuehrt({ raum, schritte, frage, fertig, onFertig }: { raum: { href: string; label: string }; schritte: string[]; frage: Frage; fertig: boolean; onFertig: (e: any) => void }) {
  const [haken, setHaken] = useState<boolean[]>(() => schritte.map(() => fertig));
  const [wahl, setWahl] = useState<number | null>(null);
  const alle = haken.every(Boolean);
  const richtig = wahl !== null && wahl === frage.richtig;
  return (
    <div className="ac-gefuehrt">
      <a className="ac-knopf" href={raum.href} target="_blank" rel="noreferrer"><ExternalLink size={15} />{raum.label}</a>
      <div className="ac-haken-liste">{schritte.map((s, i) => <label key={i} className={`ac-haken${haken[i] ? " an" : ""}`}><input type="checkbox" checked={haken[i]} onChange={(e) => setHaken(haken.map((h, j) => (j === i ? e.target.checked : h)))} /><span className="ac-haken-box">{haken[i] && <Check size={13} />}</span><span>{s}</span></label>)}</div>
      <div className={`ac-kontrolle${alle ? "" : " gesperrt"}`}>
        <small>Kontrollfrage</small>
        <p className="ac-frage-text">{frage.frage}</p>
        <div className="ac-antworten">{frage.antworten.map((a, i) => <button key={i} type="button" disabled={!alle || fertig} className={`ac-antwort${wahl === i ? (i === frage.richtig ? " richtig" : " falsch") : ""}${fertig && i === frage.richtig ? " richtig" : ""}`} onClick={() => setWahl(i)}>{a}</button>)}</div>
        {wahl !== null && <p className={`ac-erklaerung${richtig ? " gut" : ""}`}>{richtig ? "Richtig. " : "Nicht ganz. "}{frage.erklaerung}</p>}
        <div className="ac-uebung-fuss">{fertig ? <span className="ac-fertig-marke"><Check size={15} /> Übung abgeschlossen</span> : <button type="button" className="ac-knopf" disabled={!richtig} onClick={() => onFertig({ schritte: schritte.length, punkte: 1, gesamt: 1 })}>Übung abschließen</button>}</div>
      </div>
    </div>
  );
}
