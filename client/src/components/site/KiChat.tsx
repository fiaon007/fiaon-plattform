// ═══════════════════════════════════════════════════════════════════════════
// KiChat — der FIAON-Assistent als Glasfläche (23.08.2026)
//
// Fragen zu FIAON und Bonität, Antworten aus dem Wissen der Plattform
// (shared/fiaon-wissen.ts über POST /api/fiaon/kontakt/chat). Das Gespräch
// bleibt im Browser (sessionStorage), nichts wird gespeichert. Vorschläge zum
// Einstieg, Tipp-Anzeige, Links in Antworten werden klickbar.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";

interface Nachricht { rolle: "kunde" | "assistent"; text: string }
const VORSCHLAEGE = ["Was kostet FIAON und was bekomme ich dafür?", "Kann ein bezahlter Eintrag gelöscht werden?", "Wie läuft das Startgespräch ab?", "Bekomme ich trotz Eintrag eine Kreditkarte?", "Was ist die 100-Tage-Regel?", "Wie kündige ich mein Abo?"];
const START: Nachricht = { rolle: "assistent", text: "Guten Tag. Ich bin der FIAON-Assistent und kenne die Plattform, die Pakete, den Ablauf und die wichtigsten Regeln rund um SCHUFA, KSV und CRIF. Was möchten Sie wissen?" };

function mitLinks(text: string) {
  const teile = text.split(/(fiaon\.com\/[a-z0-9\-/?=&]+)/gi);
  return teile.map((t, i) => /^fiaon\.com\//i.test(t) ? <a key={i} href={"/" + t.replace(/^fiaon\.com\//i, "")}>{t}</a> : <span key={i}>{t}</span>);
}

export default function KiChat({ kompakt = false }: { kompakt?: boolean }) {
  const [verlauf, setVerlauf] = useState<Nachricht[]>(() => { try { const v = sessionStorage.getItem("fiaon_chat"); return v ? JSON.parse(v) : [START]; } catch { return [START]; } });
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const ende = useRef<HTMLDivElement>(null);
  useEffect(() => { try { sessionStorage.setItem("fiaon_chat", JSON.stringify(verlauf.slice(-30))); } catch { /* egal */ } ende.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [verlauf, laeuft]);

  const senden = async (text: string) => {
    const t = text.trim(); if (!t || laeuft) return;
    const neu = [...verlauf, { rolle: "kunde" as const, text: t }];
    setVerlauf(neu); setEingabe(""); setLaeuft(true);
    try {
      const r = await fetch("/api/fiaon/kontakt/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nachrichten: neu.slice(-12) }) });
      const j = await r.json().catch(() => null);
      setVerlauf((v) => [...v, { rolle: "assistent", text: j?.antwort || j?.error || "Gerade klemmt es – bitte versuchen Sie es gleich noch einmal oder rufen Sie uns an: +41 44 244 93 01." }]);
    } catch { setVerlauf((v) => [...v, { rolle: "assistent", text: "Keine Verbindung. Unser Support hilft: +41 44 244 93 01 oder support@fiaon.com." }]); }
    finally { setLaeuft(false); }
  };

  return (
    <div className={`kc${kompakt ? " kompakt" : ""}`}>
      <div className="kc-kopf">
        <span className="kc-kugel" aria-hidden="true"><img src="/kino/kugel.jpg" alt="" decoding="async" /></span>
        <div><b>FIAON-Assistent</b><small>kennt Pakete, Ablauf, Rechte – antwortet sofort</small></div>
        <span className="kc-punkt" aria-hidden="true" />
      </div>
      <div className="kc-verlauf" aria-live="polite">
        {verlauf.map((n, i) => <div key={i} className={`kc-blase ${n.rolle}`}><p>{mitLinks(n.text)}</p></div>)}
        {laeuft && <div className="kc-blase assistent tippt"><i /><i /><i /></div>}
        <div ref={ende} />
      </div>
      {verlauf.length <= 1 && (
        <div className="kc-vorschlaege">{VORSCHLAEGE.map((v) => <button key={v} type="button" onClick={() => senden(v)}>{v}</button>)}</div>
      )}
      <form className="kc-eingabe" onSubmit={(e) => { e.preventDefault(); senden(eingabe); }}>
        <input value={eingabe} onChange={(e) => setEingabe(e.target.value)} placeholder="Ihre Frage an FIAON …" aria-label="Frage" maxLength={1500} />
        <button type="submit" className="dk-knopf" disabled={laeuft || !eingabe.trim()}>Senden</button>
      </form>
      <p className="kc-leise">Der Assistent erklärt Regeln und Abläufe; er ersetzt keine Rechtsberatung und sieht keine Kundendaten. Nichts wird gespeichert.</p>
    </div>
  );
}
