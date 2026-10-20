// ═══════════════════════════════════════════════════════════════════════════
// REITER „PROBE“ in KI-Team › Aras — Mich anrufen, dein Urteil, dein Feedback, Ton, Stimme (E-408 · Cockpit 20.10.2026)
//
// Justin hört Aras NUR hier (19.10.2026: „bau mir einen Knopf, dass ich mich anrufen kann“). Dieselben Routen wie
// bisher (/chef/aras/probe/*): „Mich anrufen“ → POST /chef/aras/probe/anrufen, Stand → GET /chef/aras/probe/stand.
//
// Cockpit-Umbau (Justin 20.10.: „total unübersichtlich … viel cleaner“):
//   · „Mich anrufen“ groß und klar; Nummer, Gesprächsart, Stimme in EINER Zeile darüber.
//   · Das laufende Gespräch steht oben im Cockpit (ein Live-Kasten für die ganze Seite, keine zweite Live-Ansicht
//     hier). Nur wenn der Kern nicht angebunden ist (Leerzustand oben), liest die Probe ihren eigenen Strom
//     /chef/aras/probe/live?callId=… und zeigt Not-Aus/Leerlauf selbst (`ohneSchalter` = false).
//   · Danach der Daumen: hoch speichert sofort, runter fragt „Was hat gestört?“ (Gründe + eigene Worte).
//   · „Dein Feedback aus Probeanrufen“ (Routen des Kerns, ArasFeedback.tsx), dann Ton und Stimme nebeneinander.
// ═══════════════════════════════════════════════════════════════════════════
import { useContext, useEffect, useRef, useState } from "react";
import { useTakt, senden } from "./ki-teile";
import { SPIELART_TEXT, DIALEKTE, DIALEKT_TEXT, HINTERGRUENDE, HINTERGRUND_TEXT, HOERPROBE_SAETZE, type Spielart, type Dialekt, type Hintergrund } from "@shared/fiaon-aras";
import { ArasLageKontext, ArasLiveKontext, LiveKaesten, useArasLive } from "./aras/ArasLive";
import ArasFeedback from "./aras/ArasFeedback";
import { dauerText, endeText, euroText, zusammenfassungText } from "./aras/aras-texte";
import { FrageKnopf, Hinweis, Karte, Punkt, Segment, useHinweis, Zeichen } from "./aras/aras-teile";

interface Letzter {
  callId: number; arasAnrufId: number; am: string; spielart: string; stimme: string | null; status: string; ende: string | null; sekunden: number;
  kiHinweis: boolean; aufnahme: "ja" | "nein" | null; urteil: string | null; urteilGrund: string | null; fehler: string | null; zusammenfassung: string | null; laeuft: boolean;
}
interface Stand {
  ok: boolean;
  nummer: string | null; nummerQuelle: "einstellung" | "ausweis" | null;
  bereit: { stimme: { ok: boolean; grund?: string }; telefon: { ok: boolean; fehlt: string[] } };
  schalter: { notaus: boolean; leerlauf: boolean; an: boolean; stufe: number; tagEuro: number };
  kosten: { ki: number; telefon: number; euro: number };
  stimme: string; stimmen: string[]; satzVorgabe: string; arten: Spielart[];
  ton: Record<string, string>;
  letzter: Letzter | null;
}
interface Hoerprobe { id: number; stimme: string; text: string; dauerMs: number | null; bewertung: number | null; gewaehltAm: string | null; hatAudio: boolean; dialekt?: Dialekt | null }

const STIMME_TEXT: Record<string, string> = { flitz: "Flitz · männlich", nuri: "Nuri · weiblich", juni: "Juni · weiblich" };
const stimmeName = (s: string | null | undefined) => (s ? (STIMME_TEXT[s] ?? (s.startsWith("eigene:") ? "eigene Stimme" : s)).split(" ·")[0] : "—");
const PROBE_ARTEN: Spielart[] = ["zuruf", "rate", "stufe_a", "zusage", "termin", "auftrag", "lead"];
const GRUENDE = ["klingt nach KI", "zu langsam", "zu schnell", "zu viele Füllwörter", "wiederholt sich", "fällt mir ins Wort", "Unterbrechen hakt", "versteht schlecht", "zu aufdringlich", "Begrüßung holprig", "Schluss zu abrupt"];
/** Die Ton-Regler — zwei ruhige Gruppen (wie er klingt · wie er führt). Schlüssel = PROBE_TON_SCHLUESSEL des Kerns. */
const TON: { gruppe: string; key: string; label: string; werte: { w: string; t: string }[] }[] = [
  { gruppe: "Wie er klingt", key: "aras_dialekt", label: "Dialekt", werte: [{ w: "hochdeutsch", t: "Hochdeutsch" }, { w: "oesterreichisch_leicht", t: "leicht österr." }, { w: "oesterreichisch", t: "österreichisch" }] },
  { gruppe: "Wie er klingt", key: "aras_energie", label: "Energie", werte: [{ w: "ruhig", t: "ruhig" }, { w: "lebendig", t: "lebendig" }, { w: "vollgas", t: "Vollgas" }] },
  { gruppe: "Wie er klingt", key: "aras_tempo", label: "Tempo", werte: [{ w: "ruhig", t: "ruhig" }, { w: "normal", t: "normal" }, { w: "zuegig", t: "zügig" }] },
  { gruppe: "Wie er klingt", key: "aras_hintergrund", label: "Hintergrund", werte: [{ w: "aus", t: "aus" }, { w: "buero_leise", t: "Büro leise" }, { w: "buero", t: "Büro" }] },
  { gruppe: "Wie er klingt", key: "aras_lachen", label: "Kurzes Lachen", werte: [{ w: "aus", t: "aus" }, { w: "an", t: "an" }] },
  { gruppe: "Wie er führt", key: "aras_fuellwoerter", label: "Füllwörter", werte: [{ w: "sparsam", t: "sparsam" }, { w: "normal", t: "normal" }, { w: "viel", t: "viel" }] },
  { gruppe: "Wie er führt", key: "aras_zuhoeren", label: "Zuhören", werte: [{ w: "geduldig", t: "geduldig" }, { w: "normal", t: "normal" }, { w: "flott", t: "flott" }] },
  { gruppe: "Wie er führt", key: "aras_zuhoerlaute", label: "Zuhör-Laute", werte: [{ w: "sparsam", t: "wenige" }, { w: "normal", t: "normal" }] },
  { gruppe: "Wie er führt", key: "aras_abschluss", label: "Nachfragen", werte: [{ w: "sanft", t: "sanft" }, { w: "klar", t: "klar" }, { w: "hartnaeckig", t: "hartnäckig" }] },
];
const seitText = (am: string) => {
  const min = Math.round((Date.now() - new Date(am).getTime()) / 60_000);
  if (min < 1) return "gerade eben"; if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60); if (h < 24) return `vor ${h} Std.`;
  return new Date(am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
};

export default function ChefArasProbe({ eingebettet = false, ohneSchalter = false }: { eingebettet?: boolean; ohneSchalter?: boolean } = {}) {
  const seitenLive = useContext(ArasLiveKontext);
  const lageSchluessel = useContext(ArasLageKontext);
  const [aktiv, setAktiv] = useState<number | null>(null);
  // Neu laden, wenn ein Anruf startet/endet oder oben Not-Aus, Leerlauf, „an“ oder die Stufe umspringt.
  const stand = useTakt<Stand>("/chef/aras/probe/stand", 30_000, [aktiv, lageSchluessel]);
  const s = stand.daten;
  const letzter = s?.letzter ?? null;
  const laeuft = !!letzter?.laeuft;
  // Rückfall ohne Kern-Anbindung: der eigene Strom dieses einen Probeanrufs (sonst steht das Gespräch oben im Cockpit).
  const rueckfallId = !ohneSchalter ? (aktiv ?? (laeuft ? letzter?.callId ?? null : null)) : null;
  const rueckfall = useArasLive(!!rueckfallId, { quelle: rueckfallId ? `/chef/aras/probe/live?callId=${rueckfallId}` : null, abgleich: false, auflegenPfad: (id) => `/chef/aras/probe/${id}/auflegen` });
  const proben = useTakt<{ ok: boolean; zeilen: Hoerprobe[] }>("/chef/aras/probe/hoerproben", 0);
  const testpersonen = useTakt<{ ok: boolean; zeilen: { id: number; name: string }[] }>("/chef/aras/probe/testpersonen", 0);
  const hinweis = useHinweis();
  const [busy, setBusy] = useState<string | null>(null);
  const [spielart, setSpielart] = useState<Spielart>("zuruf");
  const [stimme, setStimme] = useState("");
  const [testperson, setTestperson] = useState("");
  const [nummer, setNummer] = useState("");
  const [nummerOffen, setNummerOffen] = useState(false);
  const [daumen, setDaumen] = useState<"runter" | null>(null);
  const [gruende, setGruende] = useState<string[]>([]);
  const [freitext, setFreitext] = useState("");
  const [deckel, setDeckel] = useState("");
  const [feedbackRunde, setFeedbackRunde] = useState(0);
  const neuRef = useRef(stand.neu);
  neuRef.current = stand.neu;

  // Während ein Probeanruf läuft (oder gerade gewählt wird): alle 2,5 s den Stand holen — so steht der Daumen sofort da.
  useEffect(() => {
    if (!laeuft && !aktiv) return;
    const t = window.setInterval(() => neuRef.current(), 2500);
    return () => window.clearInterval(t);
  }, [laeuft, aktiv]);
  // Der gewählte Anruf ist vorbei → die Ansicht „Letzter Probeanruf“ mit dem Daumen; oben verschwindet der Kasten.
  const rueckfallWeg = rueckfall.weg;
  const seitenWeg = seitenLive?.weg;
  useEffect(() => {
    if (letzter && !letzter.laeuft) { seitenWeg?.(letzter.callId); rueckfallWeg(letzter.callId); }
    if (letzter && aktiv === letzter.callId && !letzter.laeuft) setAktiv(null);
  }, [letzter, aktiv, seitenWeg, rueckfallWeg]);
  // Verschwindet der Kasten oben (aufgelegt, Not-Aus), ist der Anruf vorbei — sofort, nicht erst beim nächsten Stand.
  const obenGesehen = useRef(false);
  const obenDa = !!aktiv && !!seitenLive?.sitzungen.some((x) => x.callId === aktiv);
  useEffect(() => {
    if (!aktiv) { obenGesehen.current = false; return; }
    if (obenDa) { obenGesehen.current = true; return; }
    if (obenGesehen.current) { obenGesehen.current = false; setAktiv(null); neuRef.current(); }
  }, [aktiv, obenDa]);
  useEffect(() => { if (s && !deckel) setDeckel(String(s.schalter.tagEuro)); }, [s, deckel]);
  useEffect(() => { setDaumen(null); setGruende([]); setFreitext(""); }, [letzter?.callId]);

  const tun = async (name: string, f: () => Promise<void>) => {
    setBusy(name);
    try { await f(); } catch (e) { hinweis.rot((e as Error).message); } finally { setBusy(null); }
  };
  const bereit = !!s?.bereit.stimme.ok && !!s?.bereit.telefon.ok;
  const gesperrt = !!s?.schalter.notaus || !!s?.schalter.leerlauf;
  const deckelVoll = !!s && s.kosten.euro >= s.schalter.tagEuro;
  const warum = !s ? "" : !s.nummer ? "Trag zuerst deine Nummer ein." : !s.bereit.stimme.ok ? `Die Stimme ist nicht bereit: ${s.bereit.stimme.grund ?? "unbekannt"}`
    : !s.bereit.telefon.ok ? `Das Telefon ist nicht bereit (fehlt: ${s.bereit.telefon.fehlt.join(", ")}).` : s.schalter.notaus ? "Not-Aus ist an — oben „Wieder an“."
    : s.schalter.leerlauf ? "Leerlauf ist an — oben ausschalten." : deckelVoll ? "Der Tagesdeckel ist erreicht." : "";

  const anrufen = () => tun("anrufen", async () => {
    const r = await senden<{ ok: boolean; callId: number }>("/chef/aras/probe/anrufen", { spielart, stimme: stimme || undefined, testpersonId: testperson || undefined });
    setAktiv(r.callId);
    seitenLive?.beschleunigen();
    stand.neu();
    hinweis.gut("Aras wählt — dein Handy klingelt gleich. Das Gespräch siehst du oben live.");
    if (eingebettet) document.querySelector("[data-ki='cockpit']")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const nummerSpeichern = () => tun("nummer", async () => {
    const r = await senden<{ ok: boolean; nummer: string }>("/chef/aras/probe/nummer", { nummer });
    setNummer(""); setNummerOffen(false); stand.neu();
    hinweis.gut(`Gespeichert (${r.nummer}) — nur diese Nummer ruft Aras im Test an.`);
  });
  const urteilen = (d: "hoch" | "runter") => tun(`urteil-${d}`, async () => {
    if (!letzter) return;
    await senden(`/chef/aras/probe/${letzter.callId}/urteil`, { daumen: d, grund: [...gruende, freitext.trim()].filter(Boolean).join(" · ") || undefined });
    stand.neu(); setFeedbackRunde((n) => n + 1);
    hinweis.gut(d === "hoch" ? "Daumen hoch gespeichert." : "Daumen runter gespeichert — das fließt in den nächsten Feinschliff.");
  });
  const setzen = (schluessel: string, wert: string, satz = "Gespeichert — gilt ab dem nächsten Anruf.") => tun(schluessel, async () => {
    await senden("/chef/aras/probe/einstellung", { schluessel, wert }); stand.neu(); hinweis.gut(satz);
  });

  const nummerZeile = s && (s.nummer && !nummerOffen ? (
    <span className="ar-nummer" data-ap="nummer"><Zeichen art="telefon" /> <b>{s.nummer}</b> <span className="ar-leise">{s.nummerQuelle === "ausweis" ? "aus deinem Ausweis" : "deine Probe-Nummer"}</span>
      <button type="button" className="ar-knopf-text" onClick={() => setNummerOffen(true)}>ändern</button></span>
  ) : (
    <span className="ar-nummer offen" data-ap="nummer">
      <input type="tel" inputMode="tel" placeholder="+49 151 …" value={nummer} onChange={(e) => setNummer(e.target.value)} aria-label="Deine Handynummer" />
      <button type="button" className="ar-knopf klein haupt" disabled={busy === "nummer" || nummer.replace(/\D/g, "").length < 8} onClick={() => void nummerSpeichern()}>Speichern</button>
      {nummerOffen ? <button type="button" className="ar-knopf-text" onClick={() => { setNummerOffen(false); setNummer(""); }}>abbrechen</button> : null}
      <span className="ar-leise">Einmal eintragen — nur diese Nummer ruft Aras im Test an.</span>
    </span>
  ));

  const tonGruppen = Array.from(new Set(TON.map((t) => t.gruppe)));
  return (
    <div className="ar-probe">
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      {stand.fehler && !s ? <p className="ar-fehler-text">Der Stand ließ sich nicht laden: {stand.fehler} <button type="button" className="ar-knopf-text" onClick={stand.neu}>Nochmal</button></p> : null}
      {!s && !stand.fehler ? <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div> : null}

      {s ? (
        <Karte klasse="ar-anrufen" data="mich-anrufen" titel="Mich anrufen" satz="Aras ruft nur deine Nummer an — so hörst du, wie er klingt."
          rechts={(
            <span className="ar-bereit" data-ap="kopf">
              <span title={s.bereit.stimme.ok ? "Die Stimme ist eingestellt." : s.bereit.stimme.grund ?? ""}><Punkt klasse={s.bereit.stimme.ok ? "gut" : "krit"} />Stimme</span>
              <span title={s.bereit.telefon.ok ? "Telefon und Absendernummer sind da." : `Fehlt: ${s.bereit.telefon.fehlt.join(", ")}`}><Punkt klasse={s.bereit.telefon.ok ? "gut" : "krit"} />Telefon</span>
            </span>
          )}>
          <div className="ar-anrufen-wahl">
            {nummerZeile}
            <label className="ar-feld">Gesprächsart
              <select className="ar-wahl" value={spielart} onChange={(e) => setSpielart(e.target.value as Spielart)}>
                {PROBE_ARTEN.map((a) => <option key={a} value={a}>{SPIELART_TEXT[a]}</option>)}
              </select>
            </label>
            <div className="ar-feld">Stimme
              <Segment label="Stimme für diesen Anruf" wert={stimme} onWahl={setStimme} klein werte={[{ w: "", t: `${stimmeName(s.stimme)} (gewählt)` }, ...s.stimmen.filter((x) => x !== s.stimme).map((x) => ({ w: x, t: stimmeName(x) }))]} />
            </div>
            {(testpersonen.daten?.zeilen.length ?? 0) > 0 ? (
              <label className="ar-feld" title="Mit der Akte einer Testperson laufen Aras' Werkzeuge echt (Link, Zusage, Termin) — gewählt wird trotzdem nur deine Nummer.">Mit Akte von
                <select className="ar-wahl" value={testperson} onChange={(e) => setTestperson(e.target.value)}>
                  <option value="">Probe-Daten</option>
                  {testpersonen.daten!.zeilen.map((t) => <option key={t.id} value={t.id}>{t.name} (Testperson)</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className="ar-anrufen-los">
            <button type="button" className="ar-knopf gross haupt" data-ap="mich-anrufen-knopf" disabled={!!busy || !s.nummer || !bereit || gesperrt || deckelVoll || laeuft || !!aktiv} onClick={() => void anrufen()}>
              <Zeichen art="telefon" groesse={18} />{laeuft || aktiv ? "Aras ruft dich an …" : busy === "anrufen" ? "wählt …" : "Mich anrufen"}
            </button>
            {laeuft || aktiv ? <span className="ar-leise">{ohneSchalter ? "Das Gespräch steht oben live — dort auch „Auflegen“." : "Das Gespräch steht direkt darunter."}</span>
              : warum ? <span className="ar-leise">{warum}</span> : <span className="ar-leise">Teste: unterbrich ihn · schweig drei Sekunden · sag „Nein“ zur Aufzeichnung · frag „Sind Sie ein Mensch?“</span>}
          </div>
          {!ohneSchalter ? (
            // Rückfall ohne Kern-Anbindung: Not-Aus/Leerlauf über die Probe-Routen, das Gespräch über den eigenen Strom.
            <div className="ar-rueckfall">
              {rueckfall.sitzungen.length ? <LiveKaesten live={rueckfall} /> : null}
              <div className="ar-zeile-knopf">
                {s.schalter.notaus
                  ? <FrageKnopf klasse="haupt" frage="Aras wieder wählen lassen?" ja="Wieder an" onJa={() => void tun("start", async () => { await senden("/chef/aras/probe/wieder-an"); stand.neu(); hinweis.gut("Not-Aus aufgehoben."); })}>Wieder an</FrageKnopf>
                  : <FrageKnopf klasse="rot" frage="Aras sofort stoppen?" ja="Stoppen" onJa={() => void tun("notaus", async () => { await senden("/chef/aras/probe/notaus", { grund: "Knopf auf der Probe-Seite" }); stand.neu(); hinweis.gut("Not-Aus ist an."); })}>Not-Aus</FrageKnopf>}
                <button type="button" className={`ar-knopf klein${s.schalter.leerlauf ? " an" : ""}`} disabled={!!busy} onClick={() => void tun("leerlauf", async () => { await senden("/chef/aras/probe/leerlauf", { an: !s.schalter.leerlauf }); stand.neu(); })}>{s.schalter.leerlauf ? "Leerlauf aus" : "Leerlauf"}</button>
              </div>
            </div>
          ) : null}

          {letzter && !laeuft && !aktiv ? (
            <div className="ar-letzter" data-ap="urteil">
              <p className="ar-letzter-kopf">
                <b>Letzter Probeanruf</b>
                <span>{seitText(letzter.am)} · {SPIELART_TEXT[letzter.spielart as Spielart] ?? letzter.spielart} · {stimmeName(letzter.stimme)} · {dauerText(letzter.sekunden)}
                  {letzter.ende ? ` · ${endeText(letzter.ende, true)}` : ""}{letzter.sekunden > 0 ? ` · KI-Hinweis ${letzter.kiHinweis ? "gesagt" : "fehlte"} · Aufnahme ${letzter.aufnahme === "ja" ? "Ja" : letzter.aufnahme === "nein" ? "Nein" : "nicht gefragt"}` : ""}</span>
              </p>
              {letzter.fehler ? <p className="ar-fehler-text">Technik: {letzter.fehler}</p> : null}
              {letzter.zusammenfassung ? <p className="ar-text">{zusammenfassungText(letzter.zusammenfassung, true)}</p> : null}
              {letzter.urteil ? (
                <p className="ar-urteil-zeile"><Zeichen art={letzter.urteil === "hoch" ? "hoch" : "runter"} /> Dein Urteil: <b>{letzter.urteil === "hoch" ? "gut genug" : "noch nicht"}</b>{letzter.urteilGrund ? <span className="ar-leise"> · {letzter.urteilGrund}</span> : null}</p>
              ) : (
                <div className="ar-daumen-wahl">
                  <span>Wie war er?</span>
                  <button type="button" className="ar-knopf" disabled={!!busy} onClick={() => void urteilen("hoch")} data-ar="daumen-hoch"><Zeichen art="hoch" />Gut genug</button>
                  <button type="button" className={`ar-knopf${daumen === "runter" ? " an" : ""}`} disabled={!!busy} onClick={() => setDaumen(daumen === "runter" ? null : "runter")} data-ar="daumen-runter" aria-expanded={daumen === "runter"}><Zeichen art="runter" />Noch nicht</button>
                </div>
              )}
              {!letzter.urteil && daumen === "runter" ? (
                <div className="ar-gruende-feld">
                  <span className="ar-leise">Was hat gestört? (mehrere gehen)</span>
                  <div className="ar-gruende">
                    {GRUENDE.map((g) => <button key={g} type="button" className={`ar-chip${gruende.includes(g) ? " an" : ""}`} aria-pressed={gruende.includes(g)} onClick={() => setGruende((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}>{g}</button>)}
                  </div>
                  <div className="ar-zeile-knopf">
                    <input type="text" className="ar-breit" placeholder="oder in eigenen Worten …" value={freitext} onChange={(e) => setFreitext(e.target.value)} maxLength={300} aria-label="Grund in eigenen Worten" />
                    <button type="button" className="ar-knopf haupt" disabled={!!busy || (!gruende.length && freitext.trim().length < 3)} onClick={() => void urteilen("runter")} data-ar="daumen-speichern">Speichern</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </Karte>
      ) : null}

      <ArasFeedback neuSignal={feedbackRunde} />

      {s ? (
        <div className="ar-zwei">
          <Karte titel="Ton" satz="Jede Änderung gilt ab dem nächsten Anruf." data="ton">
            {tonGruppen.map((g) => (
              <div key={g} className="ar-ton-gruppe">
                <h3>{g}</h3>
                {TON.filter((t) => t.gruppe === g).map((t) => (
                  <div key={t.key} className="ar-ton-zeile" data-ar-ton={t.key}>
                    <span>{t.label}</span>
                    <Segment label={t.label} klein busy={busy === t.key} wert={String(s.ton[t.key] ?? "")} onWahl={(w) => void setzen(t.key, w)} werte={t.werte} />
                  </div>
                ))}
              </div>
            ))}
            <div className="ar-ton-gruppe">
              <h3>Geld</h3>
              <div className="ar-ton-zeile">
                <span>Deckel je Tag</span>
                <span className="ar-zeile-knopf">
                  <input type="number" min={0} max={300} value={deckel} onChange={(e) => setDeckel(e.target.value)} aria-label="Tagesdeckel in Euro" />
                  <span className="ar-leise">€</span>
                  {deckel !== String(s.schalter.tagEuro) ? <button type="button" className="ar-knopf klein haupt" disabled={busy === "aras_tag_euro"} onClick={() => void setzen("aras_tag_euro", deckel, "Deckel gespeichert.")}>Speichern</button> : <span className="ar-leise">heute {euroText(s.kosten.euro)}</span>}
                </span>
              </div>
            </div>
            <p className="ar-leise ar-fest">Fest eingebaut: KI-Hinweis im ersten Satz · Aufnahme nur nach Ja · kein Druck · keine Lastschrift · kein Vertrag am Telefon.</p>
          </Karte>
          <StimmenStudio stand={s} proben={proben} busy={busy} tun={tun} hinweis={hinweis} onNeu={stand.neu} />
        </div>
      ) : null}
    </div>
  );
}

function StimmenStudio({ stand: s, proben, busy, tun, hinweis, onNeu }: {
  stand: Stand; proben: { daten: { zeilen: Hoerprobe[] } | null; fehler: string | null; neu: () => void }; busy: string | null;
  tun: (name: string, f: () => Promise<void>) => Promise<void>; hinweis: { gut: (t: string) => void }; onNeu: () => void;
}) {
  const [dialekt, setDialekt] = useState<Dialekt>(() => (DIALEKTE as readonly string[]).includes(s.ton.aras_dialekt) ? (s.ton.aras_dialekt as Dialekt) : "hochdeutsch");
  const [atmo, setAtmo] = useState<Hintergrund>("aus");
  const [satz, setSatz] = useState(() => HOERPROBE_SAETZE[(DIALEKTE as readonly string[]).includes(s.ton.aras_dialekt) ? (s.ton.aras_dialekt as Dialekt) : "hochdeutsch"]);
  const [satzOffen, setSatzOffen] = useState(false);
  const stimmen = s.stimmen?.length ? s.stimmen : ["flitz", "nuri", "juni"];
  const zeilen = proben.daten?.zeilen ?? [];
  const jeStimme = stimmen.map((st) => {
    const gleich = (x: Hoerprobe) => (x.dialekt ?? "hochdeutsch") === dialekt;
    return { st, h: zeilen.find((x) => x.stimme === st && x.text === satz && gleich(x)) ?? zeilen.find((x) => x.stimme === st && gleich(x)) ?? zeilen.find((x) => x.stimme === st) ?? null };
  });
  const alleVorsprechen = () => tun("alle", async () => {
    for (const st of stimmen) {
      hinweis.gut(`${stimmeName(st)} spricht …`);
      await senden("/chef/aras/probe/hoerprobe", { stimme: st, text: satz, dialekt });
      proben.neu();
    }
    hinweis.gut("Alle drei sind da — hör sie dir nebeneinander an.");
  });
  return (
    <Karte titel="Stimme" satz={`Aras spricht mit ${stimmeName(s.stimme)} — hör die drei nebeneinander und nimm eine.`} data="studio">
      <div className="ar-ton-zeile"><span title="Nur für die Hörprobe hier — Aras' Dialekt im Gespräch stellst du links unter „Ton“ ein.">Akzent</span>
        <Segment label="Akzent der Hörprobe" klein wert={dialekt} werte={DIALEKTE.map((d) => ({ w: d, t: d === "oesterreichisch_leicht" ? "leicht österr." : DIALEKT_TEXT[d] }))}
          onWahl={(d) => { setDialekt(d); if (!satz.trim() || Object.values(HOERPROBE_SAETZE).includes(satz)) setSatz(HOERPROBE_SAETZE[d]); }} />
      </div>
      <div className="ar-ton-zeile"><span>Beim Anhören</span>
        <Segment label="Hintergrund beim Anhören" klein wert={atmo} werte={HINTERGRUENDE.map((h) => ({ w: h, t: h === "aus" ? "ohne Büro" : HINTERGRUND_TEXT[h] }))} onWahl={setAtmo} />
      </div>
      <div className="ar-satz">
        <p className="ar-leise">„{satz}“ <button type="button" className="ar-knopf-text" onClick={() => setSatzOffen(!satzOffen)}>{satzOffen ? "fertig" : "Satz ändern"}</button></p>
        {satzOffen ? <textarea value={satz} onChange={(e) => setSatz(e.target.value)} maxLength={400} aria-label="Satz für die Hörprobe" /> : null}
      </div>
      <div className="ar-zeile-knopf">
        <button type="button" className="ar-knopf haupt" disabled={!!busy || satz.trim().length < 10 || !s.bereit.stimme.ok} onClick={() => void alleVorsprechen()} data-ar="vorsprechen">{busy === "alle" ? "spricht …" : "Alle drei vorsprechen lassen"}</button>
        <span className="ar-leise">in Telefon-Qualität</span>
      </div>
      {proben.fehler ? <p className="ar-fehler-text">Die Hörproben ließen sich nicht laden. <button type="button" className="ar-knopf-text" onClick={proben.neu}>Nochmal</button></p> : null}
      <ul className="ar-stimmen">
        {jeStimme.map(({ st, h }) => {
          const gewaehlt = s.stimme === st;
          return (
            <li key={st} className={gewaehlt ? "gewaehlt" : ""} data-ap-hoerprobe={h?.id ?? ""}>
              <div className="ar-stimme-kopf">
                <b>{STIMME_TEXT[st] ?? st}</b>
                {gewaehlt ? <span className="ar-marke gut"><Punkt klasse="gut" />Aras spricht so</span> : h ? (
                  <button type="button" className="ar-knopf klein" disabled={!!busy} data-ar="diese-nehmen"
                    onClick={() => void tun(`nehmen-${h.id}`, async () => { await senden(`/chef/aras/probe/hoerprobe/${h.id}/waehlen`); proben.neu(); onNeu(); hinweis.gut(`Aras spricht ab jetzt mit ${stimmeName(h.stimme)}${h.dialekt && h.dialekt !== "hochdeutsch" ? `, ${DIALEKT_TEXT[h.dialekt]}` : ""}.`); })}>Diese nehmen</button>
                ) : null}
              </div>
              {h?.hatAudio ? <audio key={`${h.id}-${atmo}`} controls preload="none" src={`/api/fiaon/chef/aras/probe/hoerprobe/${h.id}/audio${atmo !== "aus" ? `?atmo=${atmo}` : ""}`} /> : <p className="ar-leise">Noch keine Hörprobe in diesem Akzent.</p>}
              {h ? (
                <span className="ar-sterne" role="group" aria-label={`Bewertung ${stimmeName(st)}`}>
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={(h.bewertung ?? 0) >= n ? "an" : ""} aria-label={`${n} von 5`} aria-pressed={(h.bewertung ?? 0) >= n}
                    onClick={() => void tun(`stern-${h.id}`, async () => { await senden(`/chef/aras/probe/hoerprobe/${h.id}/bewerten`, { bewertung: n }); proben.neu(); })}>★</button>)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Karte>
  );
}
