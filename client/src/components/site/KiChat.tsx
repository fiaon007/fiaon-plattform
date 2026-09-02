// ═══════════════════════════════════════════════════════════════════════════
// KiChat — der FIAON-Assistent als Glasfläche (23.08.2026)
//
// Fragen zu FIAON und Bonität, Antworten aus dem Wissen der Plattform
// (shared/fiaon-wissen.ts über POST /api/fiaon/kontakt/chat). Das Gespräch
// bleibt im Browser (sessionStorage), nichts wird gespeichert. Vorschläge zum
// Einstieg, Tipp-Anzeige, Links in Antworten werden klickbar.
// ═══════════════════════════════════════════════════════════════════════════
// 02.09.2026: zweisprachig — auf /en-Seiten englische Oberfläche, und der
// Server bekommt sprache "en", damit der Assistent auf Englisch antwortet.
import { useEffect, useRef, useState } from "react";
import { useSprache } from "@/i18n/sprache";

interface Nachricht { rolle: "kunde" | "assistent"; text: string }
const VORSCHLAEGE_EN = ["What does FIAON cost and what do I get for it?", "Can a paid entry be deleted?", "How does the onboarding call work?", "Can I get a credit card despite an entry?", "What is the 100-day rule?", "How do I cancel my subscription?"];
const START_EN: Nachricht = { rolle: "assistent", text: "Good day. I am the FIAON assistant and know the platform, the plans, the process and the most important rules around SCHUFA, KSV and CRIF. What would you like to know?" };
const VORSCHLAEGE = ["Was kostet FIAON und was bekomme ich dafür?", "Kann ein bezahlter Eintrag gelöscht werden?", "Wie läuft das Startgespräch ab?", "Bekomme ich trotz Eintrag eine Kreditkarte?", "Was ist die 100-Tage-Regel?", "Wie kündige ich mein Abo?"];
const START: Nachricht = { rolle: "assistent", text: "Guten Tag. Ich bin der FIAON-Assistent und kenne die Plattform, die Pakete, den Ablauf und die wichtigsten Regeln rund um SCHUFA, KSV und CRIF. Was möchten Sie wissen?" };

function mitLinks(text: string) {
  const teile = text.split(/(fiaon\.com\/[a-z0-9\-/?=&]+)/gi);
  return teile.map((t, i) => /^fiaon\.com\//i.test(t) ? <a key={i} href={"/" + t.replace(/^fiaon\.com\//i, "")}>{t}</a> : <span key={i}>{t}</span>);
}

export default function KiChat({ kompakt = false }: { kompakt?: boolean }) {
  const sprache = useSprache();
  const en = sprache === "en";
  const start = en ? START_EN : START;
  // Der Verlauf ist je Sprache getrennt gespeichert — ein deutscher Verlauf auf der englischen Seite wäre verwirrend.
  const speicher = en ? "fiaon_chat_en" : "fiaon_chat";
  const [verlauf, setVerlauf] = useState<Nachricht[]>(() => { try { const v = sessionStorage.getItem(speicher); return v ? JSON.parse(v) : [start]; } catch { return [start]; } });
  const [eingabe, setEingabe] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const ende = useRef<HTMLDivElement>(null);
  useEffect(() => { try { sessionStorage.setItem(speicher, JSON.stringify(verlauf.slice(-30))); } catch { /* egal */ } ende.current?.scrollIntoView({ block: "end", behavior: "smooth" }); }, [verlauf, laeuft, speicher]);

  const senden = async (text: string) => {
    const t = text.trim(); if (!t || laeuft) return;
    const neu = [...verlauf, { rolle: "kunde" as const, text: t }];
    setVerlauf(neu); setEingabe(""); setLaeuft(true);
    try {
      const r = await fetch("/api/fiaon/kontakt/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nachrichten: neu.slice(-12), sprache }) });
      const j = await r.json().catch(() => null);
      setVerlauf((v) => [...v, { rolle: "assistent", text: j?.antwort || j?.error || (en ? "Something is stuck on my side – please try again in a moment or call us: +41 44 244 93 01." : "Gerade klemmt es – bitte versuchen Sie es gleich noch einmal oder rufen Sie uns an: +41 44 244 93 01.") }]);
    } catch { setVerlauf((v) => [...v, { rolle: "assistent", text: en ? "No connection. Our support team helps: +41 44 244 93 01 or support@fiaon.com." : "Keine Verbindung. Unser Support hilft: +41 44 244 93 01 oder support@fiaon.com." }]); }
    finally { setLaeuft(false); }
  };

  return (
    <div className={`kc${kompakt ? " kompakt" : ""}`}>
      <div className="kc-kopf">
        <span className="kc-kugel" aria-hidden="true"><img src="/kino/kugel.jpg" alt="" decoding="async" /></span>
        <div><b>{en ? "FIAON assistant" : "FIAON-Assistent"}</b><small>{en ? "knows plans, process, rights – answers straight away" : "kennt Pakete, Ablauf, Rechte – antwortet sofort"}</small></div>
        <span className="kc-punkt" aria-hidden="true" />
      </div>
      <div className="kc-verlauf" aria-live="polite">
        {verlauf.map((n, i) => <div key={i} className={`kc-blase ${n.rolle}`}><p>{mitLinks(n.text)}</p></div>)}
        {laeuft && <div className="kc-blase assistent tippt"><i /><i /><i /></div>}
        <div ref={ende} />
      </div>
      {verlauf.length <= 1 && (
        <div className="kc-vorschlaege">{(en ? VORSCHLAEGE_EN : VORSCHLAEGE).map((v) => <button key={v} type="button" onClick={() => senden(v)}>{v}</button>)}</div>
      )}
      <form className="kc-eingabe" onSubmit={(e) => { e.preventDefault(); senden(eingabe); }}>
        <input value={eingabe} onChange={(e) => setEingabe(e.target.value)} placeholder={en ? "Your question to FIAON …" : "Ihre Frage an FIAON …"} aria-label={en ? "Question" : "Frage"} maxLength={1500} />
        <button type="submit" className="dk-knopf" disabled={laeuft || !eingabe.trim()}>{en ? "Send" : "Senden"}</button>
      </form>
      <p className="kc-leise">{en ? "The assistant explains rules and processes; it is no substitute for legal advice and sees no customer data. Nothing is stored." : "Der Assistent erklärt Regeln und Abläufe; er ersetzt keine Rechtsberatung und sieht keine Kundendaten. Nichts wird gespeichert."}</p>
    </div>
  );
}
