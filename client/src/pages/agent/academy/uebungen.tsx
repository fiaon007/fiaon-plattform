// ═══════════════════════════════════════════════════════════════════════════
// FIAON Academy — Übungen: Einwand-Trainer, Anruf-Simulator, Rechner
// (Löschfrist, Verjährung, Inkassokosten – Logik aus den öffentlichen
// Werkzeugen), Fallstudie, Kapiteltest (23.08.2026, Plan §11)
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Send, PhoneOff, RotateCcw, ChevronRight, Star } from "lucide-react";
import { api } from "../shared";
import type { Einwand, Fall, Frage, RechnerArt, RechnerErgebnis } from "./typen";

// ── Einwand-Trainer ───────────────────────────────────────────────────────
export function EinwandTrainer({ einwaende, fertig, onFertig }: { einwaende: Einwand[]; fertig: boolean; onFertig: (e: any) => void }) {
  const reihenfolge = useMemo(() => einwaende.map((e) => { const idx = e.antworten.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }), [einwaende]);
  const [aktiv, setAktiv] = useState(0);
  const [wahl, setWahl] = useState<Record<number, number>>({});
  const e = einwaende[aktiv];
  const gewaehlt = wahl[aktiv];
  const beantwortet = Object.keys(wahl).length;
  const punkte = Object.entries(wahl).reduce((s, [i, a]) => s + (einwaende[Number(i)].antworten[a].bewertung === "gut" ? 1 : 0), 0);
  const alle = beantwortet === einwaende.length;
  const farbe = { gut: "gut", mittel: "mittel", schlecht: "schlecht" } as const;
  return (
    <div className="ac-einwand">
      <div className="ac-einwand-kopf"><span>Einwand {aktiv + 1} von {einwaende.length}</span><span>{punkte} gut · {beantwortet} beantwortet</span></div>
      <div className="ac-einwand-spur">{einwaende.map((_, i) => <button key={i} type="button" className={`ac-spur-punkt${i === aktiv ? " an" : ""}${wahl[i] !== undefined ? ` ${farbe[einwaende[i].antworten[wahl[i]].bewertung]}` : ""}`} onClick={() => setAktiv(i)} aria-label={`Einwand ${i + 1}`} />)}</div>
      <div className="ac-einwand-karte">
        <small>Der Kunde sagt</small>
        <h3>{e.einwand}</h3>
        {e.kontext && <p className="ac-einwand-kontext">{e.kontext}</p>}
        <div className="ac-antworten">
          {reihenfolge[aktiv].map((ai) => { const a = e.antworten[ai]; const offen = gewaehlt !== undefined; return (
            <button key={ai} type="button" disabled={offen} className={`ac-antwort${offen ? ` zeig-${farbe[a.bewertung]}` : ""}${gewaehlt === ai ? " gewaehlt" : ""}`} onClick={() => setWahl({ ...wahl, [aktiv]: ai })}>
              <span className="ac-antwort-text">{a.text}</span>
              {offen && <span className={`ac-bewertung ${farbe[a.bewertung]}`}>{a.bewertung === "gut" ? "Gut" : a.bewertung === "mittel" ? "Geht" : "Schadet"}</span>}
              {offen && <span className="ac-begruendung">{a.begruendung}</span>}
            </button>
          ); })}
        </div>
        <div className="ac-zl-nav"><button type="button" className="ac-knopf still" disabled={aktiv === 0} onClick={() => setAktiv(aktiv - 1)}>Zurück</button><span /><button type="button" className="ac-knopf" disabled={aktiv === einwaende.length - 1 || gewaehlt === undefined} onClick={() => setAktiv(aktiv + 1)}>Nächster Einwand<ChevronRight size={16} /></button></div>
      </div>
      <div className="ac-uebung-fuss">
        {fertig ? <span className="ac-fertig-marke"><Check size={15} /> Trainer abgeschlossen</span> : <button type="button" className="ac-knopf" disabled={!alle} onClick={() => onFertig({ punkte, gesamt: einwaende.length })}>Trainer abschließen ({punkte} von {einwaende.length} gut)</button>}
        {!alle && !fertig && <small>Alle {einwaende.length} Einwände beantworten – dann abschließen. Dein Ergebnis wird gespeichert.</small>}
      </div>
    </div>
  );
}

// ── Anruf-Simulator ───────────────────────────────────────────────────────
interface Szenario { key: string; titel: string; beschreibung: string; ziel: string }
interface Nachricht { rolle: "kunde" | "manager"; text: string }
interface Bewertung { note: number; staerken: string[]; schwaechen: string[]; text: string; wortregelVerstoesse: string[] }

export function Simulator({ fertig, onFertig }: { fertig: boolean; onFertig: (e: any) => void }) {
  const [szenarien, setSzenarien] = useState<Szenario[]>([]);
  const [szenario, setSzenario] = useState<Szenario | null>(null);
  const [verlauf, setVerlauf] = useState<Nachricht[]>([]);
  const [eingabe, setEingabe] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bewertung, setBewertung] = useState<Bewertung | null>(null);
  const ende = useRef<HTMLDivElement>(null);
  useEffect(() => { api("/agent/academy/szenarien").then((r) => { if (r.ok) setSzenarien(r.json.szenarien); }); }, []);
  useEffect(() => { ende.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [verlauf, bewertung]);

  const starten = async (s: Szenario) => {
    setSzenario(s); setVerlauf([]); setBewertung(null); setFehler(null); setLaedt(true);
    const r = await api("/agent/academy/simulator", { method: "POST", body: JSON.stringify({ szenario: s.key, nachrichten: [] }) });
    setLaedt(false);
    if (r.ok) setVerlauf([{ rolle: "kunde", text: r.json.antwort }]); else setFehler(r.json?.error || "Der Simulator ist gerade nicht erreichbar.");
  };
  const senden = async () => {
    const text = eingabe.trim(); if (!text || !szenario || laedt) return;
    const neu: Nachricht[] = [...verlauf, { rolle: "manager", text }];
    setVerlauf(neu); setEingabe(""); setLaedt(true); setFehler(null);
    const r = await api("/agent/academy/simulator", { method: "POST", body: JSON.stringify({ szenario: szenario.key, nachrichten: neu }) });
    setLaedt(false);
    if (r.ok) setVerlauf([...neu, { rolle: "kunde", text: r.json.antwort }]); else setFehler(r.json?.error || "Der KI-Kunde antwortet gerade nicht.");
  };
  const beenden = async () => {
    if (!szenario || laedt) return;
    setLaedt(true); setFehler(null);
    const r = await api("/agent/academy/simulator", { method: "POST", body: JSON.stringify({ szenario: szenario.key, nachrichten: verlauf, beenden: true }) });
    setLaedt(false);
    if (r.ok) { setBewertung(r.json.bewertung); if (!fertig && r.json.bewertung.note <= 3) onFertig({ szenario: szenario.key, note: r.json.bewertung.note, punkte: 6 - r.json.bewertung.note, gesamt: 5, nachrichten: verlauf.length }); }
    else setFehler(r.json?.error || "Die Bewertung ist gerade nicht möglich.");
  };

  if (!szenario) return (
    <div className="ac-sim-wahl">
      {szenarien.length === 0 && <p className="ac-leise">Lade Szenarien …</p>}
      {szenarien.map((s) => <button key={s.key} type="button" className="ac-sim-szenario" onClick={() => starten(s)}><b>{s.titel}</b><p>{s.beschreibung}</p><small>Dein Ziel: {s.ziel}</small></button>)}
      {fertig && <div className="ac-uebung-fuss"><span className="ac-fertig-marke"><Check size={15} /> Simulator abgeschlossen – du kannst weiter üben.</span></div>}
    </div>
  );
  return (
    <div className="ac-sim">
      <div className="ac-sim-kopf"><div><small>Szenario</small><b>{szenario.titel}</b></div><button type="button" className="ac-knopf still klein" onClick={() => { setSzenario(null); setVerlauf([]); setBewertung(null); }}><RotateCcw size={14} />Anderes Szenario</button></div>
      <p className="ac-sim-ziel">{szenario.ziel}</p>
      <div className="ac-sim-verlauf">
        {verlauf.map((n, i) => <div key={i} className={`ac-sim-blase ${n.rolle}`}><small>{n.rolle === "kunde" ? "Kunde" : "Du"}</small><p>{n.text}</p></div>)}
        {laedt && !bewertung && <div className="ac-sim-blase kunde tippt"><small>Kunde</small><p>…</p></div>}
        {bewertung && (
          <div className="ac-sim-bewertung">
            <div className="ac-sim-note"><b>Note {bewertung.note}</b><span>{[1, 2, 3, 4, 5].map((n) => <Star key={n} size={16} fill={n <= 6 - bewertung.note ? "#fbbf24" : "none"} color="#fbbf24" />)}</span><small>{bewertung.note <= 2 ? "Sehr gut" : bewertung.note === 3 ? "Bestanden" : "Noch einmal üben"}</small></div>
            <p>{bewertung.text}</p>
            <div className="ac-sim-spalten">
              <div><b>Stärken</b><ul>{bewertung.staerken.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              <div><b>Schwächen</b><ul>{bewertung.schwaechen.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
            </div>
            {bewertung.wortregelVerstoesse.length > 0 && <p className="ac-sim-verstoss">Wortregel-Verstöße: {bewertung.wortregelVerstoesse.join(" · ")}</p>}
            <div className="ac-zl-nav"><button type="button" className="ac-knopf still" onClick={() => starten(szenario)}><RotateCcw size={14} />Noch einmal</button><span /><button type="button" className="ac-knopf" onClick={() => { setSzenario(null); setVerlauf([]); setBewertung(null); }}>Anderes Szenario</button></div>
          </div>
        )}
        <div ref={ende} />
      </div>
      {fehler && <p className="ac-fehler">{fehler}</p>}
      {!bewertung && (
        <div className="ac-sim-eingabe">
          <textarea value={eingabe} onChange={(e) => setEingabe(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); senden(); } }} placeholder="Was sagst du? (Enter sendet, Shift+Enter neue Zeile)" rows={2} disabled={laedt} />
          <button type="button" className="ac-knopf" onClick={senden} disabled={laedt || !eingabe.trim()}><Send size={15} />Sagen</button>
          <button type="button" className="ac-knopf still" onClick={beenden} disabled={laedt || verlauf.length < 3} title="Gespräch beenden und bewerten lassen"><PhoneOff size={15} />Beenden</button>
        </div>
      )}
    </div>
  );
}

// ── Rechner ───────────────────────────────────────────────────────────────
const tage = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);
const plusMonate = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const fmt = (d: Date) => d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" });
const iso = (d: Date) => d.toLocaleDateString("sv-SE");
const parse = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + "T12:00:00") : null);
const jahresende = (d: Date, plusJahre: number) => new Date(d.getFullYear() + plusJahre, 11, 31, 23, 59, 59);
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };
const TABELLE: [number, number][] = [[500, 49], [1000, 88], [1500, 127], [2000, 166], [3000, 222], [4000, 278], [5000, 334], [6000, 390], [7000, 446], [8000, 502], [9000, 558], [10000, 614], [13000, 666], [16000, 718], [19000, 770], [22000, 822], [25000, 874], [30000, 955], [35000, 1036], [40000, 1117], [45000, 1198], [50000, 1279]];
const gebuehr10 = (wert: number) => { for (const [bis, g] of TABELLE) if (wert <= bis) return g; return 1279 + Math.ceil((wert - 50000) / 15000) * 110; };

export function Rechner({ rechner, aufgabe, fertig, onFertig }: { rechner: RechnerArt; aufgabe: { text: string; erwartet: string; pruefe: (e: RechnerErgebnis) => boolean }; fertig: boolean; onFertig: (e: any) => void }) {
  const [ergebnis, setErgebnis] = useState<RechnerErgebnis | null>(null);
  const geloest = !!ergebnis && aufgabe.pruefe(ergebnis);
  return (
    <div className="ac-rechner">
      <div className="ac-aufgabe"><small>Aufgabe</small><p>{aufgabe.text}</p></div>
      <div className="ac-rechner-karte">
        {rechner === "loeschfrist" && <Loeschfrist onErgebnis={setErgebnis} />}
        {rechner === "verjaehrung" && <Verjaehrung onErgebnis={setErgebnis} />}
        {rechner === "inkassokosten" && <Inkassokosten onErgebnis={setErgebnis} />}
      </div>
      <div className="ac-uebung-fuss">
        {fertig ? <span className="ac-fertig-marke"><Check size={15} /> Übung abgeschlossen</span> : geloest ? <button type="button" className="ac-knopf" onClick={() => onFertig({ rechner, ergebnis, punkte: 1, gesamt: 1 })}>Stimmt – Übung abschließen</button> : <small>Erwartet: {aufgabe.erwartet}</small>}
      </div>
    </div>
  );
}

type LfArt = "erledigt" | "offen" | "titel" | "rsb" | "anfrage" | "konto";
const LF_ARTEN: { wert: LfArt; label: string }[] = [{ wert: "erledigt", label: "Erledigte Forderung (bezahlt)" }, { wert: "offen", label: "Offene Forderung" }, { wert: "titel", label: "Titulierte Forderung" }, { wert: "rsb", label: "Restschuldbefreiung" }, { wert: "anfrage", label: "Kreditanfrage" }, { wert: "konto", label: "Gekündigtes Konto / Karte (durch die Bank)" }];
function Loeschfrist({ onErgebnis }: { onErgebnis: (e: RechnerErgebnis) => void }) {
  const [art, setArt] = useState<LfArt | "">(""); const [erledigt, setErledigt] = useState(""); const [gemeldet, setGemeldet] = useState(""); const [weitere, setWeitere] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);
  const e = useMemo(() => {
    if (!art) return null;
    const ed = parse(erledigt), m = parse(gemeldet);
    if (art === "offen") return { titel: "Keine Löschfrist – der Eintrag bleibt, bis die Forderung erledigt oder die Meldung unzulässig ist.", datum: null as Date | null, regel: "Offene Forderungen werden erst nach Erledigung gelöscht (drei Jahre taggenau). Zuerst prüfen: War die Meldung zulässig (§ 31 Abs. 2 BDSG)? Begleichung innerhalb von 100 Tagen nach Meldung → 18 Monate.", kurz: false };
    if (!ed) return { titel: art === "anfrage" ? "Datum der Anfrage eingeben." : art === "rsb" ? "Datum der Restschuldbefreiung eingeben." : "Erledigungsdatum eingeben.", datum: null, regel: "", kurz: false };
    if (art === "anfrage") return { titel: `Löschung am ${fmt(plusMonate(ed, 12))}`, datum: plusMonate(ed, 12), regel: "Kreditanfragen: zwölf Monate gespeichert, zehn Tage für Dritte sichtbar. Konditionsanfragen sind neutral.", kurz: false };
    if (art === "rsb") { const d = plusMonate(ed, 6); return { titel: d < heute ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)}`, datum: d, regel: "Seit März 2023 nur noch sechs Monate (EuGH 7.12.2023, C-26/22, C-64/22).", kurz: false }; }
    let monate = 36, regel = "Erledigte, titulierte Forderungen und bankseitige Kündigungen: drei Jahre nach dem Erledigungsdatum, taggenau.", kurz = false;
    if (art === "erledigt" && m && weitere === "nein") { const frist = tage(m, ed); if (frist >= 0 && frist <= 100 && m >= new Date("2024-01-01")) { monate = 18; kurz = true; regel = `Innerhalb von ${frist} Tagen nach der Meldung beglichen, keine weiteren Negativmerkmale: kurze Frist der Verhaltensregeln 2024 – Löschung 18 Monate nach Erledigung.`; } else if (frist > 100) regel += ` Die 100-Tage-Regel greift nicht: ${frist} Tage zwischen Meldung und Begleichung.`; }
    else if (art === "erledigt" && m && weitere === "ja") regel += " Mit weiteren Negativmerkmalen bleibt es bei drei Jahren.";
    const d = plusMonate(ed, monate); const rest = tage(heute, d);
    return { titel: rest < 0 ? `Der Eintrag hätte am ${fmt(d)} gelöscht sein müssen.` : `Löschung am ${fmt(d)} – in ${rest} Tagen`, datum: d, regel, kurz };
  }, [art, erledigt, gemeldet, weitere, heute]);
  useEffect(() => { if (e) onErgebnis({ art: "loeschfrist", datum: e.datum ? iso(e.datum) : null, kurz: e.kurz, titel: e.titel }); }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="ac-rc-feld"><small>1 · Art des Eintrags</small><div className="ac-optionen">{LF_ARTEN.map((a) => <button key={a.wert} type="button" className={`ac-option${art === a.wert ? " an" : ""}`} onClick={() => setArt(a.wert)}>{a.label}</button>)}</div></div>
      {art && art !== "offen" && <div className="ac-rc-feld"><small>2 · {art === "anfrage" ? "Datum der Anfrage" : art === "rsb" ? "Datum der Restschuldbefreiung" : "Erledigungsdatum laut Datenkopie"}</small><input type="date" value={erledigt} onChange={(ev) => setErledigt(ev.target.value)} /></div>}
      {art === "erledigt" && <div className="ac-rc-feld"><small>3 · Für die 100-Tage-Regel: Meldedatum und weitere Einträge</small><input type="date" value={gemeldet} onChange={(ev) => setGemeldet(ev.target.value)} /><div className="ac-optionen"><button type="button" className={`ac-option${weitere === "nein" ? " an" : ""}`} onClick={() => setWeitere("nein")}>Keine weiteren Negativeinträge</button><button type="button" className={`ac-option${weitere === "ja" ? " an" : ""}`} onClick={() => setWeitere("ja")}>Es gibt weitere Einträge</button></div></div>}
      {e && <div className={`ac-rc-ergebnis${e.datum && e.datum < heute ? " alarm" : e.kurz ? " gut" : ""}`}><span className="ac-rc-stufe">{e.datum && e.datum < heute ? "Frist überschritten" : e.kurz ? "Kurze Frist" : "Reguläre Frist"}</span><h4>{e.titel}</h4>{e.regel && <p>{e.regel}</p>}</div>}
    </>
  );
}

function Verjaehrung({ onErgebnis }: { onErgebnis: (e: RechnerErgebnis) => void }) {
  const [faellig, setFaellig] = useState(""); const [titel, setTitel] = useState<"nein" | "ja" | "">(""); const [anerkannt, setAnerkannt] = useState(""); const [gehemmt, setGehemmt] = useState<"nein" | "ja" | "">("");
  const heute = useMemo(() => new Date(), []);
  const e = useMemo(() => {
    const f = parse(faellig); if (!f || !titel) return null; const a = parse(anerkannt);
    if (titel === "ja") { const d = new Date(f); d.setFullYear(d.getFullYear() + 30); return { datum: d, verjaehrt: d < heute, regel: "Titulierte Forderungen verjähren erst nach 30 Jahren (§ 197 Abs. 1 Nr. 3 BGB). Ein Mahnbescheid allein ist kein Titel – er hemmt nur.", hinweis: "", fertig: true }; }
    let start = f; let grund = "Regelmäßige Verjährung drei Jahre ab Ende des Jahres der Fälligkeit (§§ 195, 199 BGB).";
    if (a && a > f) { start = a; grund += ` Anerkennung am ${fmt(a)} → Neubeginn (§ 212 BGB) ab Ende dieses Jahres.`; }
    const d = jahresende(start, 3); const hinweis = gehemmt === "ja" ? "Mahnbescheid, Klage oder Verhandlungen hemmen die Verjährung (§§ 203, 204 BGB) – das Datum verschiebt sich; prüfen lassen." : "";
    return { datum: d, verjaehrt: d < heute && gehemmt !== "ja", regel: grund, hinweis, fertig: gehemmt !== "" };
  }, [faellig, titel, anerkannt, gehemmt, heute]);
  useEffect(() => { if (e && e.fertig) onErgebnis({ art: "verjaehrung", datum: iso(e.datum), verjaehrt: e.verjaehrt }); }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="ac-rc-feld"><small>1 · Fälligkeit der Forderung</small><input type="date" value={faellig} onChange={(ev) => setFaellig(ev.target.value)} /></div>
      <div className="ac-rc-feld"><small>2 · Gibt es einen Titel?</small><div className="ac-optionen"><button type="button" className={`ac-option${titel === "nein" ? " an" : ""}`} onClick={() => setTitel("nein")}>Nein – nur Mahnungen und Inkasso</button><button type="button" className={`ac-option${titel === "ja" ? " an" : ""}`} onClick={() => setTitel("ja")}>Ja – Vollstreckungsbescheid, Urteil, Vergleich</button></div></div>
      {titel === "nein" && <div className="ac-rc-feld"><small>3 · Anerkennung (optional) und Hemmung</small><input type="date" value={anerkannt} onChange={(ev) => setAnerkannt(ev.target.value)} /><div className="ac-optionen"><button type="button" className={`ac-option${gehemmt === "nein" ? " an" : ""}`} onClick={() => setGehemmt("nein")}>Kein Mahnbescheid, keine Klage</button><button type="button" className={`ac-option${gehemmt === "ja" ? " an" : ""}`} onClick={() => setGehemmt("ja")}>Mahnbescheid oder Klage zugestellt</button></div></div>}
      {e && e.fertig && <div className={`ac-rc-ergebnis${e.verjaehrt ? " gut" : e.hinweis ? " warn" : ""}`}><span className="ac-rc-stufe">{e.verjaehrt ? "Voraussichtlich verjährt" : e.hinweis ? "Prüfung nötig" : "Noch nicht verjährt"}</span><h4>{e.verjaehrt ? `Verjährt seit dem ${fmt(e.datum)}.` : `Verjährung ${e.hinweis ? "frühestens " : ""}am ${fmt(e.datum)}.`}</h4><p>{e.regel}</p>{e.hinweis && <p>{e.hinweis}</p>}{e.verjaehrt && <p><b>Wichtig:</b> Verjährung wirkt nur bei Einrede – nichts zahlen, nichts vereinbaren, nichts zusagen.</p>}</div>}
    </>
  );
}

function Inkassokosten({ onErgebnis }: { onErgebnis: (e: RechnerErgebnis) => void }) {
  const [haupt, setHaupt] = useState(""); const [kosten, setKosten] = useState(""); const [auslagen, setAuslagen] = useState(""); const [sonst, setSonst] = useState(""); const [lage, setLage] = useState<"erstes" | "weiter" | "">("");
  const e = useMemo(() => {
    const h = zahl(haupt); if (!h || !lage) return null; const satz = lage === "erstes" ? 0.5 : 0.9;
    let geb = Math.round(gebuehr10(h) * satz * 100) / 100; let deckel = ""; if (h <= 50 && geb > 30) { geb = 30; deckel = "Bei Hauptforderungen bis 50 Euro ist die Gebühr auf 30 Euro begrenzt."; }
    const ausl = Math.min(20, Math.round(geb * 0.2 * 100) / 100); const gef = zahl(kosten) + zahl(auslagen) + zahl(sonst); const zul = Math.round((geb + ausl) * 100) / 100; const diff = Math.round((gef - zul) * 100) / 100;
    return { h, satz, geb, ausl, zul, gef, diff, deckel };
  }, [haupt, kosten, auslagen, sonst, lage]);
  useEffect(() => { if (e) onErgebnis({ art: "inkassokosten", zulaessig: e.zul, differenz: e.diff, ueberhoeht: e.diff > 5 }); }, [e]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="ac-rc-feld"><small>1 · Was steht im Inkassoschreiben?</small><div className="ac-rc-zahlen"><label><span>Hauptforderung</span><input inputMode="decimal" placeholder="89,00" value={haupt} onChange={(ev) => setHaupt(ev.target.value)} /></label><label><span>Inkassogebühr</span><input inputMode="decimal" placeholder="70,20" value={kosten} onChange={(ev) => setKosten(ev.target.value)} /></label><label><span>Auslagen</span><input inputMode="decimal" placeholder="20,00" value={auslagen} onChange={(ev) => setAuslagen(ev.target.value)} /></label><label><span>Sonstige Posten</span><input inputMode="decimal" placeholder="18,00" value={sonst} onChange={(ev) => setSonst(ev.target.value)} /></label></div></div>
      <div className="ac-rc-feld"><small>2 · Lage</small><div className="ac-optionen"><button type="button" className={`ac-option${lage === "erstes" ? " an" : ""}`} onClick={() => setLage("erstes")}>Erstes Schreiben, unstreitig (0,5)</button><button type="button" className={`ac-option${lage === "weiter" ? " an" : ""}`} onClick={() => setLage("weiter")}>Mehrere Schreiben / Ratenvereinbarung (0,9)</button></div></div>
      {e && <div className={`ac-rc-ergebnis${e.diff > 5 ? " alarm" : " gut"}`}><span className="ac-rc-stufe">{e.diff > 5 ? `Um ${euro(e.diff)} überhöht` : "Im Rahmen"}</span><h4>{e.diff > 5 ? `Zulässig sind rund ${euro(e.zul)} – gefordert werden ${euro(e.gef)}.` : `Die geforderten Kosten von ${euro(e.gef)} liegen im Rahmen (rund ${euro(e.zul)}).`}</h4><table className="ac-tabelle klein"><tbody><tr><td>Geschäftsgebühr {e.satz.toFixed(1).replace(".", ",")} (Gegenstandswert {euro(e.h)})</td><td>{euro(e.geb)}</td></tr><tr><td>Auslagenpauschale (20 %, höchstens 20 €)</td><td>{euro(e.ausl)}</td></tr><tr><td>Sonstige Posten ohne Nachweis</td><td>0,00 €</td></tr><tr><td><b>Zulässige Inkassokosten (ohne Zinsen)</b></td><td><b>{euro(e.zul)}</b></td></tr></tbody></table>{e.deckel && <p>{e.deckel}</p>}</div>}
    </>
  );
}

// ── Fallstudie ────────────────────────────────────────────────────────────
export function FallStudie({ fall, fertig, onFertig }: { fall: Fall; fertig: boolean; onFertig: (e: any) => void }) {
  const [wahl, setWahl] = useState<number | null>(null);
  const richtig = wahl !== null && !!fall.optionen[wahl].richtig;
  return (
    <div className="ac-fall">
      <div className="ac-fall-situation"><small>Die Situation</small><p>{fall.situation}</p></div>
      {fall.akte && <div className="ac-fall-akte"><small>Aus der Akte</small><ul>{fall.akte.map((a, i) => <li key={i}>{a}</li>)}</ul></div>}
      <p className="ac-frage-text">{fall.frage}</p>
      <div className="ac-antworten">{fall.optionen.map((o, i) => <button key={i} type="button" disabled={wahl !== null} className={`ac-antwort${wahl !== null ? (o.richtig ? " zeig-gut" : i === wahl ? " zeig-schlecht" : "") : ""}${wahl === i ? " gewaehlt" : ""}`} onClick={() => setWahl(i)}><span className="ac-antwort-text">{o.text}</span>{wahl !== null && <span className="ac-begruendung">{o.folge}</span>}</button>)}</div>
      {wahl !== null && (
        <div className={`ac-fall-aufloesung${richtig ? " gut" : ""}`}>
          <small>{richtig ? "Richtig entschieden" : "So wäre es richtig"}</small>
          <p>{fall.aufloesung}</p>
          <div className="ac-merk"><b>Die Lehre:</b> <span>{fall.lehre}</span></div>
          <div className="ac-uebung-fuss">{fertig ? <span className="ac-fertig-marke"><Check size={15} /> Fall abgeschlossen</span> : <button type="button" className="ac-knopf" onClick={() => onFertig({ wahl, richtig, punkte: richtig ? 1 : 0, gesamt: 1 })}>Fall abschließen</button>}{!richtig && !fertig && <button type="button" className="ac-knopf still" onClick={() => setWahl(null)}>Noch einmal entscheiden</button>}</div>
        </div>
      )}
    </div>
  );
}

// ── Kapiteltest ───────────────────────────────────────────────────────────
export function KapitelTest({ fragen, schwelle, gesperrt, bestanden, letztePunkte, onErgebnis }: { fragen: Frage[]; schwelle: number; gesperrt: boolean; bestanden: boolean; letztePunkte: { punkte: number; gesamt: number } | null; onErgebnis: (punkte: number, gesamt: number) => Promise<boolean> }) {
  const [antworten, setAntworten] = useState<(number | null)[]>(() => fragen.map(() => null));
  const [abgegeben, setAbgegeben] = useState(false);
  const [sendet, setSendet] = useState(false);
  const [ergebnisBestanden, setErgebnisBestanden] = useState<boolean | null>(null);
  const mischung = useMemo(() => fragen.map((f) => { const idx = f.antworten.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } return idx; }), [fragen]);
  const punkte = antworten.reduce<number>((s, a, i) => s + (a === fragen[i].richtig ? 1 : 0), 0);
  const alle = antworten.every((a) => a !== null);
  if (gesperrt) return <div className="ac-test-gesperrt"><p>Der Kapiteltest öffnet sich, wenn alle Schritte und Übungen dieses Kapitels abgeschlossen sind.</p></div>;
  const abgeben = async () => { setSendet(true); const ok = await onErgebnis(punkte, fragen.length); setSendet(false); setAbgegeben(true); setErgebnisBestanden(ok); };
  return (
    <div className="ac-test">
      {bestanden && !abgegeben && <div className="ac-test-stand gut"><Check size={16} /> Bestanden{letztePunkte ? ` – ${letztePunkte.punkte} von ${letztePunkte.gesamt}` : ""}. Du kannst den Test jederzeit wiederholen.</div>}
      {fragen.map((f, i) => (
        <div key={i} className="ac-test-frage">
          <small>Frage {i + 1} von {fragen.length}</small>
          <p className="ac-frage-text">{f.frage}</p>
          <div className="ac-antworten">{mischung[i].map((ai) => <button key={ai} type="button" disabled={abgegeben} className={`ac-antwort${abgegeben ? (ai === f.richtig ? " zeig-gut" : antworten[i] === ai ? " zeig-schlecht" : "") : antworten[i] === ai ? " gewaehlt" : ""}`} onClick={() => setAntworten(antworten.map((a, j) => (j === i ? ai : a)))}><span className="ac-antwort-text">{f.antworten[ai]}</span></button>)}</div>
          {abgegeben && <p className={`ac-erklaerung${antworten[i] === f.richtig ? " gut" : ""}`}>{f.erklaerung}</p>}
        </div>
      ))}
      {!abgegeben ? (
        <div className="ac-uebung-fuss"><button type="button" className="ac-knopf" disabled={!alle || sendet} onClick={abgeben}>{sendet ? "Wird ausgewertet …" : "Test abgeben"}</button><small>Bestanden ab {Math.round(schwelle * 100)} % – {Math.ceil(fragen.length * schwelle)} von {fragen.length} Fragen.</small></div>
      ) : (
        <div className={`ac-test-ergebnis${ergebnisBestanden ? " gut" : ""}`}>
          <b>{punkte} von {fragen.length} richtig</b>
          <p>{ergebnisBestanden ? "Bestanden – das nächste Kapitel ist frei." : `Nicht bestanden (nötig: ${Math.ceil(fragen.length * schwelle)}). Lies die Erklärungen und versuch es noch einmal.`}</p>
          {!ergebnisBestanden && <button type="button" className="ac-knopf still" onClick={() => { setAntworten(fragen.map(() => null)); setAbgegeben(false); setErgebnisBestanden(null); }}><RotateCcw size={14} />Noch einmal</button>}
        </div>
      )}
    </div>
  );
}
