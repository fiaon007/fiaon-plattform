// ═══════════════════════════════════════════════════════════════════════════
// /agent/tools/gespraech — Gesprächs-Begleiter (23.08.2026, Plan §4/§11)
//
// Live-Leitfaden während des Anrufs: Gesprächsart (Erstanruf, Rückruf,
// Startgespräch, Zahlungserinnerung), Timer, Abhak-Schritte mit Sätzen in der
// Sie-Form, Einwand-Schnellhilfe (aufklappbar), Notizfeld. Kunde per Suche
// (GET /agent/kunden/liste?q=) oder ?person=ID. Am Ende „Ins Kontaktprotokoll“
// → POST /agent/crm/kunden/:id/aktivitaet { art: "notiz" } – derselbe Endpunkt
// wie die Notiz in der Akte.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Phone, Play, Pause, RotateCcw, Check, Search, X, FileText } from "lucide-react";
import { AgentShell, api } from "../shared";
import { useOffice } from "../OfficeShell";
import "@/styles/office-tools.css";

// 02.09.2026: Die Leitfäden sind nach shared/fiaon-leitfaeden.ts umgezogen —
// der Copilot liest dieselben Texte auf dem Server. Re-Export, damit die
// Pipeline (import aus "./tools/gespraech") unverändert weiterläuft.
export { ARTEN, type Art, type Schritt, type Einwand } from "@shared/fiaon-leitfaeden";
import { ARTEN, type Art } from "@shared/fiaon-leitfaeden";

interface Treffer { personId: number; name: string; telefonWaehlbar: string | null; telefon: string | null; stufe: { marke: string; text: string } | null; produkt: string | null; tier: number; buchungen?: { bezeichnung: string; erledigt: boolean }[] }

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const anrufen = (k: Treffer) => { if (!k.telefonWaehlbar) return; window.dispatchEvent(new CustomEvent("fiaon-anrufen", { detail: { nummer: k.telefonWaehlbar, personId: k.personId, name: k.name } })); };

export default function AgentGespraechPage() { return <AgentShell><GespraechInnen /></AgentShell>; }

function GespraechInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Tools · Gesprächs-Begleiter"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [art, setArt] = useState<Art>("stufe_a");
  const vorlage = useMemo(() => ARTEN.find((a) => a.key === art)!, [art]);
  const [haken, setHaken] = useState<Set<number>>(new Set());
  const [notiz, setNotiz] = useState("");
  const [sek, setSek] = useState(0);
  const [laeuft, setLaeuft] = useState(false);
  const [kunde, setKunde] = useState<Treffer | null>(null);
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Treffer[]>([]);
  const [sucht, setSucht] = useState(false);
  const [speichert, setSpeichert] = useState(false);
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const start = useRef<number | null>(null);

  useEffect(() => { setHaken(new Set()); }, [art]);
  useEffect(() => {
    if (!laeuft) return;
    const i = setInterval(() => setSek((s) => s + 1), 1000);
    return () => clearInterval(i);
  }, [laeuft]);
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("person"));
    if (!id) return;
    api(`/agent/crm/kunden/${id}`).then((r) => { if (r.ok && r.json?.kunde) setKunde(r.json.kunde); });
  }, []);
  useEffect(() => {
    const q = suche.trim();
    if (q.length < 2) { setTreffer([]); return; }
    setSucht(true);
    const t = setTimeout(() => {
      api(`/agent/kunden/liste?q=${encodeURIComponent(q)}&limit=20`).then((r) => { setTreffer(r.ok ? (r.json.kunden || []) : []); setSucht(false); });
    }, 260);
    return () => clearTimeout(t);
  }, [suche]);

  const umschalten = (i: number) => setHaken((h) => { const n = new Set(h); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const starten = () => { if (!start.current) start.current = Date.now(); setLaeuft(true); };
  const zuruecksetzen = () => { setLaeuft(false); setSek(0); start.current = null; };

  const protokollText = () => {
    const schritte = vorlage.schritte.map((s, i) => `${haken.has(i) ? "✓" : "–"} ${s.titel}`).join(", ");
    return `${vorlage.label} (${mmss(sek)} Min): ${schritte}.${notiz.trim() ? ` Notiz: ${notiz.trim()}` : ""}`;
  };
  const insProtokoll = async () => {
    if (!kunde) return;
    setSpeichert(true); setMeldung(null);
    const r = await api(`/agent/crm/kunden/${kunde.personId}/aktivitaet`, { method: "POST", body: JSON.stringify({ art: "notiz", notiz: protokollText() }) });
    setSpeichert(false);
    if (r.ok) { setMeldung({ gut: true, text: `Gespeichert – steht im Verlauf von ${kunde.name}. Das Ergebnis (zahlt, Rückruf, nicht erreicht) buchst du in der Akte.` }); setNotiz(""); setHaken(new Set()); zuruecksetzen(); }
    else setMeldung({ gut: false, text: r.json?.error || "Nicht gespeichert. Bitte erneut versuchen." });
  };
  const fortschritt = Math.round((haken.size / vorlage.schritte.length) * 100);
  const paket = (k: Treffer) => (k.buchungen ?? []).filter((b) => !b.erledigt).map((b) => b.bezeichnung).join(" · ") || k.produkt || "kein Paket";

  return (
    <div className="to">
      <section className="to-kopf">
        <div>
          <span className="to-pille">Tools · Gesprächs-Begleiter</span>
          <h1>Dein Leitfaden <span className="to-verlauf">während des Anrufs.</span></h1>
          <p>Gesprächsart wählen, Kunden suchen, Timer starten. Schritte abhaken, Einwände aufklappen, Notiz tippen – und am Ende mit einem Klick ins Kontaktprotokoll.</p>
          {/* 26.08.2026, Florentines Punkt 10: Dieselbe Klarstellung wie in
              der Academy — und zwar DORT, wo das Wort im Satz steht. Wer
              mitten im Gespräch stutzt, blättert nicht in die Academy. */}
          <p className="to-wortregel">
            <b>Zu den Wörtern:</b> „Kreditkarte“ und „Kredit“ darfst du sagen — sie stehen so im
            Leitfaden und auf unserer Website. Gesperrt sind <b>beraten · Beratung · Garantie ·
            garantiert</b> sowie die Wendung <b>„Kredit ohne SCHUFA“</b>. Der Unterschied ist nicht
            das Wort, sondern das Versprechen: Über Karte und Kredit entscheidet die Bank.
          </p>
        </div>
        <Link href="/agent/tools" className="to-zurueck"><ArrowLeft size={15} strokeWidth={1.75} /> Alle Tools</Link>
      </section>

      <div className="to-spalten breit">
        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-block">
            <div className="to-tabs">{ARTEN.map((a) => <button key={a.key} type="button" className={`to-tab${art === a.key ? " an" : ""}`} onClick={() => setArt(a.key)}>{a.label}</button>)}</div>
            <p className="leise">{vorlage.kurz}</p>
            <div className="to-fortschritt"><i style={{ width: `${fortschritt}%` }} /></div>
            <div className="to-schritte">
              {vorlage.schritte.map((s, i) => (
                <button key={s.titel} type="button" className={`to-schritt${haken.has(i) ? " an" : ""}`} onClick={() => umschalten(i)} aria-pressed={haken.has(i)}>
                  <span className="haken"><Check size={14} strokeWidth={2.5} /></span>
                  <span><b>{i + 1}. {s.titel}</b>{s.text && <span>{s.text}</span>}{s.satz && <q>{s.satz}</q>}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="to-block leicht">
            <div className="to-block-kopf"><b>Einwand-Schnellhilfe</b><small>antippen zum Aufklappen</small></div>
            {vorlage.einwaende.map((e) => (
              <details key={e.frage} className="to-einwand"><summary>{e.frage}</summary><p>{e.antwort}</p></details>
            ))}
          </section>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <section className="to-block">
            <div className="to-block-kopf"><b>Kunde</b>{kunde && <button type="button" className="to-link" onClick={() => setKunde(null)}>wechseln</button>}</div>
            {kunde ? (
              <>
                <div className="to-kunde">
                  <span className={`marke ${kunde.stufe?.marke ?? (kunde.tier === 0 ? "OK" : "")}`}>{kunde.stufe?.marke ?? (kunde.tier === 0 ? "✓" : "–")}</span>
                  <div><b>{kunde.name}</b><small>{paket(kunde)}{kunde.telefon ? ` · ${kunde.telefon}` : ""}</small></div>
                </div>
                <div className="to-reihe">
                  <button type="button" className="to-knopf" disabled={!kunde.telefonWaehlbar} onClick={() => anrufen(kunde)}><Phone size={15} strokeWidth={1.75} /> Anrufen</button>
                  <Link href={`/agent/pipeline?person=${kunde.personId}`} className="to-knopf still"><FileText size={15} strokeWidth={1.75} /> Akte</Link>
                </div>
              </>
            ) : (
              <>
                <label className="to-eingabe" style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8" }}>
                  <Search size={15} strokeWidth={1.75} />
                  <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Name, E-Mail, Nummer, Referenz" style={{ flex: 1, background: "transparent", border: 0, outline: "none", color: "#fff", font: "inherit" }} />
                  {suche && <button type="button" className="to-link" onClick={() => setSuche("")} aria-label="leeren"><X size={14} /></button>}
                </label>
                {sucht && <p className="leise">Suche …</p>}
                {!sucht && suche.trim().length >= 2 && treffer.length === 0 && <p className="leise">Kein Treffer in deinem Bestand.</p>}
                {treffer.length > 0 && (
                  <div className="to-treffer">
                    {treffer.map((t) => <button key={t.personId} type="button" onClick={() => { setKunde(t); setSuche(""); setTreffer([]); }}><b>{t.name}</b><small>{t.stufe ? `Stufe ${t.stufe.marke} · ` : ""}{paket(t)}</small></button>)}
                  </div>
                )}
                {!suche && <p className="leise">Ohne Kunden läuft der Leitfaden trotzdem – nur das Protokoll braucht einen.</p>}
              </>
            )}
          </section>

          <section className="to-block">
            <div className="to-block-kopf"><b>Timer</b><small>{laeuft ? "läuft" : sek > 0 ? "pausiert" : "bereit"}</small></div>
            <div className={`to-timer${laeuft ? " laeuft" : ""}`}>
              <b>{mmss(sek)}</b>
              <div className="to-reihe">
                {laeuft ? <button type="button" className="to-knopf still" onClick={() => setLaeuft(false)}><Pause size={15} strokeWidth={1.75} /> Pause</button>
                  : <button type="button" className="to-knopf" onClick={starten}><Play size={15} strokeWidth={1.75} /> {sek > 0 ? "Weiter" : "Start"}</button>}
                <button type="button" className="to-knopf still klein" onClick={zuruecksetzen} disabled={sek === 0 && !laeuft}><RotateCcw size={14} strokeWidth={1.75} /></button>
              </div>
            </div>
          </section>

          <section className="to-block">
            <div className="to-block-kopf"><b>Notiz</b><small>{haken.size}/{vorlage.schritte.length} Schritte</small></div>
            <textarea className="to-eingabe" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Was der Kunde gesagt hat, was vereinbart ist …" />
            {meldung && <p className={meldung.gut ? "to-meldung" : "to-fehler"}>{meldung.text}</p>}
            <button type="button" className="to-knopf" disabled={!kunde || speichert} onClick={() => void insProtokoll()} title={kunde ? "Speichert Gesprächsart, Dauer, Schritte und Notiz als Eintrag im Verlauf" : "Zuerst einen Kunden wählen"}>
              {speichert ? "Speichert …" : "Ins Kontaktprotokoll"}
            </button>
            <p className="to-fussnote">Das Ergebnis des Gesprächs (zahlt sofort, zahlt am …, Rückruf, nicht erreicht) buchst du in der Akte – dort sitzt die Ergebniswahl.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
