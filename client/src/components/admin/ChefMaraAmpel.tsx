// ═══════════════════════════════════════════════════════════════════════════
// MARA-STEUERPULT › CHIP „AMPEL“ — JE WERKZEUG GRÜN, GELB ODER ROT (E-406 B3, 19.10.2026)
//
// Justin, Vorschlag 3: „Grün: Mara macht es allein. Gelb: Mara macht es, es steht in ‚Mara heute‘, und du kannst es
// 24 Stunden lang rückgängig machen. Rot: nur als Karte. … Erstattungen bleiben immer rot.“
// Kein neuer Reiter — ein Aufklapper wie „KI“ und „Maras Bilanz“. GET/POST /chef/mara/ampel (Stufe Inhaber).
//   · Je Werkzeug drei Knöpfe; nur die Stufen, die der Server wirklich kann, sind wählbar — der Rest sagt, warum nicht.
//   · Daneben die Stichprobe der Trainerin (4 Wochen) und der Vorschlag „auf Grün“ (nie automatisch).
//   · Gelb → Grün ohne Vorschlag fragt einmal nach (Justin entscheidet).
// Regeln: shared/fiaon-mara-ampel.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";

const API = "/api/fiaon";
type Stufe = "gruen" | "gelb" | "rot";
const STUFEN: Stufe[] = ["gruen", "gelb", "rot"];
const TEXT: Record<Stufe, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" };

interface Werkzeug {
  key: string; label: string; satz: string; kanal: string; start: Stufe; stufen: Stufe[];
  fest?: string; rueckgaengig?: string | null; ohneRueckgaengig?: string; gelb?: string; rot?: string; fehlt?: string;
}
interface Stich { werkzeug: string; quote4: { n: number; nichtOk: number; quote: number | null }; aufstieg: { vorschlag: boolean; grund: string } }
interface Daten {
  werkzeuge: Werkzeug[]; stand: Record<string, Stufe>; geaendertAm: string | null; stichprobe: Stich[];
  verlauf: { key: string; von: Stufe; nach: Stufe; wer: string; am: string }[];
}

const prozent = (q: number | null) => (q == null ? "—" : `${(q * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`);
const wann = (iso: string) => new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function ChefMaraAmpel() {
  const [d, setD] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const laden = useCallback(() => {
    fetch(`${API}/chef/mara/ampel`, { credentials: "include" })
      .then(async (r) => { const j = await r.json().catch(() => null); if (j?.ok) setD(j); else setFehler(j?.error || "Die Ampel ließ sich nicht laden."); })
      .catch(() => setFehler("Keine Verbindung zum Server."));
  }, []);
  useEffect(() => { laden(); }, [laden]);

  const setzen = async (w: Werkzeug, stufe: Stufe, trotzdem = false) => {
    if (!d || d.stand[w.key] === stufe) return;
    if (!trotzdem && stufe === "rot" && !window.confirm(`„${w.label}“ auf Rot?\n\n${w.rot ?? "Nur noch als Entscheidungskarte."}`)) return;
    setBusy(w.key);
    let nochmal = false;
    try {
      const r = await fetch(`${API}/chef/mara/ampel`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ werkzeug: w.key, stufe, trotzdem }),
      });
      const j = await r.json().catch(() => null);
      if (r.status === 409 && j?.code === "AUFSTIEG_FEHLT") {
        // Die Stichprobe schlägt Grün noch nicht vor — Justin entscheidet trotzdem selbst.
        nochmal = window.confirm(`${j.error}\n\nTrotzdem auf Grün stellen?`);
      } else if (!j?.ok) {
        setMeldung({ text: j?.error || "Nicht gespeichert.", fehler: true });
      } else {
        setD((alt) => (alt ? { ...alt, stand: j.stand, verlauf: j.verlauf } : alt));
        setMeldung({ text: `„${w.label}“ steht jetzt auf ${TEXT[stufe]} — wirkt spätestens in einer Minute.`, fehler: false });
      }
    } finally { setBusy(null); }
    if (nochmal) await setzen(w, stufe, true);
  };

  if (fehler) return <section id="mara-p-ampel" className="mara-aufklapper" aria-label="Ampel"><p className="mara-still">{fehler}</p></section>;
  if (!d) return <section id="mara-p-ampel" className="mara-aufklapper" aria-label="Ampel"><p className="mara-still">Die Ampel lädt …</p></section>;
  const namen = Object.fromEntries(d.werkzeuge.map((w) => [w.key, w.label]));

  return (
    <section id="mara-p-ampel" className="mara-aufklapper ma-ampel" aria-label="Ampel je Werkzeug">
      <div className="mara-kopfzeile">
        <div>
          <h2>Ampel je Werkzeug</h2>
          <p className="mara-leise mara-satz">Grün: Mara macht es allein · Gelb: steht in „Mara heute“, 24 h zurück · Rot: nur als Karte.</p>
        </div>
      </div>
      <div className="ma-liste" role="table" aria-label="Werkzeuge">
        {d.werkzeuge.map((w) => {
          const jetzt = d.stand[w.key] ?? w.start;
          const st = d.stichprobe.find((s) => s.werkzeug === w.key);
          const info = jetzt === "gelb" ? (w.gelb ?? (w.rueckgaengig ? `Rückgängig: „${w.rueckgaengig}“.` : `Nicht rückgängig: ${w.ohneRueckgaengig ?? "—"}`))
            : jetzt === "rot" ? (w.rot ?? w.fest ?? "") : (w.fest ?? "");
          return (
            <div key={w.key} className="ma-zeile" role="row" data-werkzeug={w.key}>
              <div className="ma-was" role="cell">
                <b title={w.satz}>{w.label}</b>
                <small className="mara-still">{w.kanal}{info ? ` · ${info}` : ""}</small>
              </div>
              <div className="ma-knoepfe" role="cell" aria-label={`${w.label}: Stufe`}>
                {STUFEN.map((s) => {
                  const erlaubt = w.stufen.includes(s);
                  return (
                    <button key={s} type="button" className={`ma-stufe ${s}${jetzt === s ? " an" : ""}`} aria-pressed={jetzt === s}
                      disabled={!erlaubt || !!busy} title={erlaubt ? (s === "gelb" ? (w.rueckgaengig ? `Rückgängig: ${w.rueckgaengig}` : w.ohneRueckgaengig ?? "") : s === "rot" ? (w.rot ?? "") : "Mara macht es allein.") : (w.fest ?? w.fehlt ?? "Gibt es hier nicht.")}
                      onClick={() => void setzen(w, s)}>{TEXT[s]}</button>
                  );
                })}
              </div>
              <div className="ma-stich" role="cell">
                {st && st.quote4.n > 0
                  ? <small title="Stichprobe der Trainerin, letzte 4 vollen Wochen">{st.quote4.nichtOk}/{st.quote4.n} nicht ok ({prozent(st.quote4.quote)})</small>
                  : <small className="mara-still" title="Stichprobe der Trainerin, letzte 4 vollen Wochen">noch keine Stichprobe</small>}
                {jetzt === "gelb" && (st?.aufstieg.vorschlag
                  ? <span className="mp-chip gruen" title={st.aufstieg.grund}>Vorschlag: auf Grün</span>
                  : <small className="mara-still" title={st?.aufstieg.grund}>{st?.aufstieg.grund ?? ""}</small>)}
              </div>
            </div>
          );
        })}
      </div>
      {meldung && <p className={`mara-meldung${meldung.fehler ? " fehler" : ""}`} role="status"><span>{meldung.text}</span></p>}
      {d.verlauf.length > 0 && (
        <details className="mara-klappe ma-verlauf">
          <summary>Zuletzt geändert{d.geaendertAm ? ` · ${wann(d.geaendertAm)}` : ""}</summary>
          <ul>
            {d.verlauf.map((v, i) => (
              <li key={i}><span className="mara-still">{wann(v.am)}</span> {namen[v.key] ?? v.key}: {TEXT[v.von]} → <b>{TEXT[v.nach]}</b> · {v.wer}</li>
            ))}
          </ul>
        </details>
      )}
      <style>{`
        .ma-liste { display: grid; gap: 8px; margin-top: 12px; }
        .ma-zeile { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(150px, 210px); gap: 12px; align-items: center;
          padding: 8px 0; border-top: 1px solid var(--m-linie, rgba(255,255,255,.08)); }
        .ma-was { display: grid; gap: 2px; min-width: 0; }
        .ma-was small { line-height: 1.4; }
        .ma-knoepfe { display: inline-flex; gap: 4px; }
        .ma-stufe { min-width: 54px; padding: 5px 10px; border-radius: 999px; font-size: 12.5px; cursor: pointer;
          border: 1px solid var(--m-linie-2, rgba(255,255,255,.18)); background: transparent; color: inherit; }
        .ma-stufe:disabled { opacity: .3; cursor: not-allowed; }
        .ma-stufe.gruen.an { background: rgba(61,214,140,.18); border-color: rgba(61,214,140,.6); color: #8DF0C0; }
        .ma-stufe.gelb.an { background: rgba(242,182,76,.18); border-color: rgba(242,182,76,.6); color: #F6D9A4; }
        .ma-stufe.rot.an { background: rgba(240,113,120,.18); border-color: rgba(240,113,120,.6); color: #F7C5C9; }
        .ma-stich { display: grid; gap: 4px; justify-items: start; }
        .ma-verlauf ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 4px; font-size: 12.5px; }
        @media (max-width: 720px) { .ma-zeile { grid-template-columns: 1fr; gap: 6px; } }
      `}</style>
    </section>
  );
}
