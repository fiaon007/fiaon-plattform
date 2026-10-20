// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/aras-probe — Aras: Probeanruf, Stimmen-Studio, Ton (E-408, Scheibe 1)
//
// Justin hört Aras NUR hier (19.10.2026, 21:55: „bau mir einen Knopf, dass ich
// mich anrufen kann“). Läuft OHNE den Raum „KI-Team“ (E-409) — eigene Routen
// /chef/aras/probe/* (server/routes/fiaon-aras-chef.ts). Nach dem Zusammenführen
// kann der Raum diese Komponente in seinen Reiter „Probeanruf“ setzen.
//
//   1. Mich anrufen — nur die eine Nummer (einmal eintragen), Gesprächsart,
//      Stimme nur für diesen Anruf; dann live: wählt → spricht, die Sätze laufen mit.
//   2. Danach der Daumen: hoch oder runter, mit einem Grund („klingt nach KI“ …).
//   3. Stimmen-Studio: derselbe Satz in jeder deutschen Stimme — hören, eine nehmen.
//   4. Ton: Energie, Füllwörter, Lachen, Tempo, Zuhör-Laute, Nachfragen; Tagesdeckel.
// Im Kopf: Technik bereit?, Kosten heute, Not-Aus / Wieder an, Leerlauf.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { API, Geruest, Fehlermeldung, useDaten, seit } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGANG_ARAS_PROBE } from "@/pages/agent/rundgaenge";
import { SPIELART_TEXT, type HoerprobeZeile, type Spielart } from "@shared/fiaon-aras";
import "@/styles/office-rundgang.css";
import "@/styles/chef-aras-probe.css";

interface Letzter {
  callId: number; arasAnrufId: number; am: string; spielart: string; stimme: string | null; status: string; ende: string | null; sekunden: number;
  kiHinweis: boolean; aufnahme: "ja" | "nein" | null; urteil: string | null; urteilGrund: string | null; fehler: string | null; zusammenfassung: string | null; laeuft: boolean;
}
interface Stand {
  nummer: string | null; nummerQuelle: "einstellung" | "ausweis" | null;
  bereit: { stimme: { ok: boolean; grund?: string }; telefon: { ok: boolean; fehlt: string[] } };
  schalter: { notaus: boolean; leerlauf: boolean; an: boolean; stufe: number; tagEuro: number };
  kosten: { ki: number; telefon: number; euro: number };
  stimme: string; stimmen: string[]; satzVorgabe: string; arten: Spielart[];
  ton: Record<string, string>;
  letzter: Letzter | null;
}
type Zeile = { wer: "kunde" | "aras" | "info"; text: string };

const STIMME_TEXT: Record<string, string> = { flitz: "Flitz · männlich", nuri: "Nuri · weiblich", juni: "Juni · weiblich" };
const stimmeText = (s: string | null | undefined) => (s ? STIMME_TEXT[s] ?? (s.startsWith("eigene:") ? "eigene Stimme" : s) : "—");
const stimmeName = (s: string | null | undefined) => stimmeText(s).split(" ·")[0];
const PROBE_ARTEN: Spielart[] = ["zuruf", "rate", "stufe_a", "zusage", "termin", "lead"];
const GRUENDE = ["klingt nach KI", "zu langsam", "zu schnell", "zu viele Füllwörter", "Unterbrechen hakt", "versteht schlecht", "zu aufdringlich", "Begrüßung holprig"];
const TON: { key: string; label: string; werte: { w: string; t: string }[] }[] = [
  { key: "aras_energie", label: "Energie", werte: [{ w: "ruhig", t: "ruhig" }, { w: "lebendig", t: "lebendig" }, { w: "vollgas", t: "Vollgas" }] },
  { key: "aras_fuellwoerter", label: "Füllwörter", werte: [{ w: "sparsam", t: "sparsam" }, { w: "normal", t: "normal" }, { w: "viel", t: "viel" }] },
  { key: "aras_lachen", label: "Kurzes Lachen", werte: [{ w: "aus", t: "aus" }, { w: "an", t: "an" }] },
  { key: "aras_tempo", label: "Tempo", werte: [{ w: "ruhig", t: "ruhig" }, { w: "normal", t: "normal" }, { w: "zuegig", t: "zügig" }] },
  { key: "aras_zuhoerlaute", label: "Zuhör-Laute", werte: [{ w: "sparsam", t: "wenige" }, { w: "normal", t: "normal" }] },
  { key: "aras_abschluss", label: "Nachfragen", werte: [{ w: "sanft", t: "sanft" }, { w: "klar", t: "klar" }, { w: "hartnaeckig", t: "hartnäckig" }] },
];
const ZUSTAND_TEXT: Record<string, string> = {
  hallo: "verbunden", gewaehlt: "wählt …", angenommen: "du bist dran", ki_hinweis: "KI-Hinweis gesagt", aufnahme_ja: "Aufnahme: Ja", aufnahme_nein: "Aufnahme: Nein",
  werkzeug: "Werkzeug", mailbox: "Mailbox", ende: "beendet", fehler: "Technik-Fehler", notaus: "Not-Aus", uebergabe: "Übergabe",
};
const ENDE_TEXT: Record<string, string> = {
  kunde_aufgelegt: "du hast aufgelegt", aras_beendet: "Aras hat sich verabschiedet", mailbox: "Mailbox", stille: "Stille", notaus: "Not-Aus",
  fehler: "Technik-Fehler", zeitlimit: "Zeitlimit", uebergabe: "übergeben", deploy: "Neustart", kein_stream: "kein Ton-Strom", nicht_erreicht: "nicht erreicht", chef: "von hier beendet",
};
const euro = (n: number) => `${Number(n || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

async function senden<T = { ok: boolean }>(pfad: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j as T;
}

function Welle({ aktiv }: { aktiv: boolean }) {
  return <div className={`ap-welle${aktiv ? " aktiv" : ""}`} aria-hidden="true">{Array.from({ length: 14 }).map((_, i) => <b key={i} />)}</div>;
}

/** Der Live-Strom EINES Probeanrufs: die Sätze und der Zustand. */
function useLive(callId: number | null, beimEnde: () => void) {
  const [zeilen, setZeilen] = useState<Zeile[]>([]);
  const [zustand, setZustand] = useState("");
  const ende = useRef(beimEnde);
  ende.current = beimEnde;
  useEffect(() => {
    setZeilen([]); setZustand("");
    if (!callId) return;
    const es = new EventSource(`${API}/chef/aras/probe/live?callId=${callId}`, { withCredentials: true });
    es.addEventListener("aras", (ev) => {
      let e: { art?: string; wer?: string; text?: string };
      try { e = JSON.parse((ev as MessageEvent).data); } catch { return; }
      if (e.art === "aras_transkript") {
        const wer: Zeile["wer"] = e.wer === "kunde" ? "kunde" : "aras";
        if (String(e.text ?? "").trim()) setZeilen((z) => [...z, { wer, text: String(e.text) }].slice(-40));
        return;
      }
      const art = String(e.art ?? "").replace(/^aras_/, "");
      setZustand(art);
      if (e.text && art !== "werkzeug" && art !== "hallo") setZeilen((z) => [...z, { wer: "info" as const, text: String(e.text) }].slice(-40));
      if (art === "ende") ende.current();
    });
    return () => es.close();
  }, [callId]);
  return { zeilen, zustand };
}

export default function ChefArasProbe() {
  const stand = useDaten<Stand>("/chef/aras/probe/stand");
  const proben = useDaten<{ zeilen: HoerprobeZeile[] }>("/chef/aras/probe/hoerproben");
  const [meldung, setMeldung] = useState<{ text: string; rot?: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [spielart, setSpielart] = useState<Spielart>("zuruf");
  const [stimme, setStimme] = useState("");
  const [nummer, setNummer] = useState("");
  const [nummerOffen, setNummerOffen] = useState(false);
  const [satz, setSatz] = useState("");
  const [gruende, setGruende] = useState<string[]>([]);
  const [freitext, setFreitext] = useState("");
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [deckel, setDeckel] = useState("");
  const neuRef = useRef(stand.neu);
  neuRef.current = stand.neu;

  const s = stand.daten;
  const letzter = s?.letzter ?? null;
  const laeuft = !!letzter?.laeuft;
  const liveId = aktiv ?? (laeuft ? letzter?.callId ?? null : null);
  const live = useLive(liveId, () => window.setTimeout(() => neuRef.current(), 1500));

  // Während ein Probeanruf läuft (oder gerade gewählt wird): alle 2,5 s den Stand holen, sonst alle 30 s.
  useEffect(() => {
    const t = window.setInterval(() => neuRef.current(), laeuft || aktiv ? 2500 : 30_000);
    return () => window.clearInterval(t);
  }, [laeuft, aktiv]);
  useEffect(() => { if (s && !satz) setSatz(s.satzVorgabe); }, [s, satz]);
  useEffect(() => { if (s && !deckel) setDeckel(String(s.schalter.tagEuro)); }, [s, deckel]);
  // Der gewählte Anruf ist vorbei → zurück zur Ansicht „Letzter Probeanruf“ (mit dem Daumen).
  useEffect(() => { if (letzter && aktiv === letzter.callId && !letzter.laeuft) setAktiv(null); }, [letzter, aktiv]);

  const melden = (text: string, rot = false) => { setMeldung({ text, rot }); window.setTimeout(() => setMeldung((m) => (m?.text === text ? null : m)), 9000); };
  const tun = async (name: string, f: () => Promise<void>) => {
    setBusy(name);
    try { await f(); } catch (e) { melden((e as Error).message, true); } finally { setBusy(null); }
  };

  const bereit = !!s?.bereit.stimme.ok && !!s?.bereit.telefon.ok;
  const gesperrt = !!s?.schalter.notaus || !!s?.schalter.leerlauf;
  const deckelVoll = !!s && s.kosten.euro >= s.schalter.tagEuro;
  const warum = !s ? "" : !s.nummer ? "Erst deine Nummer eintragen." : !s.bereit.stimme.ok ? `Stimme: ${s.bereit.stimme.grund ?? "nicht bereit"}`
    : !s.bereit.telefon.ok ? `Telefon: fehlt ${s.bereit.telefon.fehlt.join(", ")}` : s.schalter.notaus ? "Not-Aus ist an." : s.schalter.leerlauf ? "Leerlauf ist an." : deckelVoll ? "Tagesdeckel erreicht." : "";

  const nummerSpeichern = () => tun("nummer", async () => {
    const r = await senden<{ ok: boolean; nummer: string }>("/chef/aras/probe/nummer", { nummer });
    setNummer(""); setNummerOffen(false); stand.neu();
    melden(`Gespeichert (${r.nummer}) — nur diese Nummer ruft Aras im Test an.`);
  });
  const anrufen = () => tun("anrufen", async () => {
    if (!window.confirm(`Aras ruft jetzt ${s?.nummer ?? "deine Nummer"} an — als „${SPIELART_TEXT[spielart]}“${stimme ? ` mit ${stimmeName(stimme)}` : ""}. Handy bereit?`)) return;
    const r = await senden<{ ok: boolean; callId: number }>("/chef/aras/probe/anrufen", { spielart, stimme: stimme || undefined });
    setAktiv(r.callId); setGruende([]); setFreitext(""); stand.neu();
    melden("Aras wählt … Rede mit ihm, unterbrich ihn, schweig mal drei Sekunden, sag „Nein“ zur Aufzeichnung.");
  });
  const auflegen = (callId: number) => tun("auflegen", async () => { await senden(`/chef/aras/probe/${callId}/auflegen`); stand.neu(); });
  const urteilen = (daumen: "hoch" | "runter") => tun(`urteil-${daumen}`, async () => {
    if (!letzter) return;
    await senden(`/chef/aras/probe/${letzter.callId}/urteil`, { daumen, grund: [...gruende, freitext.trim()].filter(Boolean).join(" · ") || undefined });
    stand.neu();
    melden(daumen === "hoch" ? "Daumen hoch gespeichert." : "Daumen runter gespeichert — das fließt in den nächsten Feinschliff.");
  });
  const alleVorsprechen = () => tun("alle", async () => {
    for (const st of s?.stimmen?.length ? s.stimmen : ["flitz", "nuri", "juni"]) {
      melden(`${stimmeName(st)} spricht …`);
      await senden("/chef/aras/probe/hoerprobe", { stimme: st, text: satz });
      proben.neu();
    }
    melden("Alle Stimmen sind da — hör sie dir nebeneinander an.");
  });
  const setzen = (schluessel: string, wert: string, satzOk = "Gespeichert — gilt ab dem nächsten Anruf.") => tun(schluessel, async () => {
    await senden("/chef/aras/probe/einstellung", { schluessel, wert }); stand.neu(); melden(satzOk);
  });
  const notaus = () => tun("notaus", async () => {
    if (!window.confirm("Not-Aus: Aras wählt nicht mehr, ein laufendes Gespräch endet mit einem Abschiedssatz. Jetzt?")) return;
    const r = await senden<{ ok: boolean; beendet: number }>("/chef/aras/probe/notaus", { grund: "Knopf auf der Probe-Seite" });
    stand.neu(); melden(`Not-Aus ist an.${r.beendet ? ` ${r.beendet} Gespräch beendet.` : ""}`);
  });
  const wiederAn = () => tun("start", async () => { await senden("/chef/aras/probe/wieder-an"); stand.neu(); melden("Not-Aus aufgehoben."); });
  const leerlauf = (an: boolean) => tun("leerlauf", async () => {
    await senden("/chef/aras/probe/leerlauf", { an }); stand.neu();
    melden(an ? "Leerlauf an: kein neuer Anruf, ein laufendes Gespräch endet normal." : "Leerlauf aus.");
  });

  // Je Stimme die neueste Hörprobe mit dem aktuellen Satz (sonst die neueste überhaupt)
  const jeStimme: HoerprobeZeile[] = [];
  for (const st of s?.stimmen ?? ["flitz", "nuri", "juni"]) {
    const z = proben.daten?.zeilen ?? [];
    const h = z.find((x) => x.stimme === st && x.text === satz) ?? z.find((x) => x.stimme === st);
    if (h) jeStimme.push(h);
  }

  return (
    <div className="ap">
      <Rundgang raum="aras-probe" titel="Aras · Probe" schritte={RUNDGANG_ARAS_PROBE} />
      <header className="ap-kopf" data-ap="kopf">
        <div>
          <h1>Aras</h1>
          <p>Dein KI-Kollege am Telefon. Hier rufst du dich selbst an, hörst seine Stimmen und stellst seinen Ton ein. Kunden ruft er noch nicht an.</p>
        </div>
        {s && (
          <div className="ap-chips">
            <span className={`ap-chip ${s.bereit.stimme.ok ? "gruen" : "rot"}`} title={s.bereit.stimme.ok ? "GPT-Live ist eingestellt." : s.bereit.stimme.grund ?? ""}><i />Stimme</span>
            <span className={`ap-chip ${s.bereit.telefon.ok ? "gruen" : "rot"}`} title={s.bereit.telefon.ok ? "Twilio und Absendernummer sind da." : `Fehlt: ${s.bereit.telefon.fehlt.join(", ")}`}><i />Telefon</span>
            <span className={`ap-chip ${deckelVoll ? "rot" : "gruen"}`} title="Kosten heute (Stimme + Telefon) und der Deckel je Tag."><i />{euro(s.kosten.euro)} von {euro(s.schalter.tagEuro)}</span>
            {s.schalter.notaus
              ? <button type="button" className="ap-chip knopf gruen" disabled={!!busy} onClick={wiederAn}><i />Not-Aus aufheben</button>
              : <button type="button" className="ap-chip knopf rot" disabled={!!busy} onClick={notaus}><i />Not-Aus</button>}
            <button type="button" className={`ap-chip knopf${s.schalter.leerlauf ? " gelb" : ""}`} disabled={!!busy} onClick={() => leerlauf(!s.schalter.leerlauf)} title="Leerlauf: kein neuer Anruf, ein laufendes Gespräch endet normal (vor jedem Deploy).">
              <i />{s.schalter.leerlauf ? "Leerlauf an" : "Leerlauf aus"}
            </button>
          </div>
        )}
      </header>
      {meldung && <p className={`ap-meldung${meldung.rot ? " rot" : ""}`} onClick={() => setMeldung(null)} role="status">{meldung.text}</p>}
      {stand.fehler && <Fehlermeldung text={stand.fehler} erneut={stand.neu} />}
      {!s && stand.laedt && <Geruest />}

      {s && (
        <section className="ap-buehne" data-ap="mich-anrufen" aria-label="Mich anrufen">
          <h2>Mich anrufen</h2>
          <div className="ap-zeile" data-ap="nummer">
            {s.nummer && !nummerOffen ? (
              <span style={{ color: "#fff" }}>{s.nummer} <span className="ap-still">· {s.nummerQuelle === "ausweis" ? "aus deinem Ausweis" : "deine Probe-Nummer"}</span>
                <button type="button" className="ap-text-knopf" onClick={() => setNummerOffen(true)}>ändern</button></span>
            ) : (
              <>
                <input className="ap-eingabe" type="tel" inputMode="tel" placeholder="+49 151 …" value={nummer} onChange={(e) => setNummer(e.target.value)} aria-label="Deine Handynummer" style={{ width: 180 }} />
                <button type="button" className="ap-knopf klein voll" disabled={busy === "nummer" || nummer.replace(/\D/g, "").length < 8} onClick={nummerSpeichern}>Speichern</button>
                {nummerOffen && <button type="button" className="ap-text-knopf" onClick={() => { setNummerOffen(false); setNummer(""); }}>abbrechen</button>}
                <span className="ap-still">Einmal eintragen — nur diese Nummer ruft Aras im Test an.</span>
              </>
            )}
          </div>
          <div className="ap-zeile">
            <label className="ap-feld">Gesprächsart
              <select value={spielart} onChange={(e) => setSpielart(e.target.value as Spielart)}>
                {PROBE_ARTEN.map((a) => <option key={a} value={a}>{SPIELART_TEXT[a]}</option>)}
              </select>
            </label>
            <div className="ap-feld">Stimme für diesen Anruf
              <div className="ap-segment" role="group" aria-label="Stimme für diesen Anruf">
                <button type="button" className={stimme === "" ? "an" : ""} onClick={() => setStimme("")}>gewählte ({stimmeName(s.stimme)})</button>
                {s.stimmen.map((st) => <button key={st} type="button" className={stimme === st ? "an" : ""} onClick={() => setStimme(st)}>{stimmeName(st)}</button>)}
              </div>
            </div>
          </div>
          <div className="ap-zeile">
            <button type="button" className="ap-knopf voll gross" data-ap="mich-anrufen-knopf" disabled={!!busy || !s.nummer || !bereit || gesperrt || deckelVoll || laeuft} onClick={anrufen}>
              {laeuft ? "Aras ist dran …" : busy === "anrufen" ? "Wählt …" : "Mich anrufen"}
            </button>
            {warum && !laeuft && <span className="ap-still">{warum}</span>}
          </div>

          {liveId && (
            <div className="ap-live" data-ap="live" aria-live="polite">
              <div className="ap-live-kopf">
                <Welle aktiv={laeuft} />
                <b>Live</b><small>{ZUSTAND_TEXT[live.zustand] ?? (live.zustand || "wählt …")}</small>
                {laeuft && <button type="button" className="ap-knopf klein rot" style={{ marginLeft: "auto" }} disabled={busy === "auflegen"} onClick={() => auflegen(liveId)}>Auflegen</button>}
              </div>
              <div className="ap-ticker">
                {live.zeilen.length ? live.zeilen.map((z, i) => <div key={i} className={z.wer}>{z.text}</div>) : <div className="info">Es klingelt bei dir …</div>}
              </div>
            </div>
          )}

          {letzter && !laeuft && !aktiv && (
            <div className="ap-urteil" data-ap="urteil">
              <p>
                <b>Letzter Probeanruf</b> <span className="ap-still">· {seit(letzter.am)} · {SPIELART_TEXT[letzter.spielart as Spielart] ?? letzter.spielart} · {stimmeName(letzter.stimme)} · {letzter.sekunden} s
                  {letzter.ende ? ` · Ende: ${ENDE_TEXT[letzter.ende] ?? letzter.ende}` : ""} · KI-Hinweis {letzter.kiHinweis ? "gesagt" : "fehlte"} · Aufnahme {letzter.aufnahme === "ja" ? "Ja" : letzter.aufnahme === "nein" ? "Nein" : "nicht gefragt"}</span>
              </p>
              {letzter.fehler && <p className="ap-still" style={{ color: "var(--ap-rot)" }}>Technik: {letzter.fehler}</p>}
              {letzter.zusammenfassung && <p className="ap-still">{letzter.zusammenfassung}</p>}
              {letzter.urteil ? (
                <p>Dein Urteil: <b>{letzter.urteil === "hoch" ? "Daumen hoch — gut genug" : "Daumen runter — klingt noch nicht so"}</b>{letzter.urteilGrund ? <span className="ap-still"> · {letzter.urteilGrund}</span> : null}</p>
              ) : (
                <>
                  <p>Wie war er? <span className="ap-still">Ein Klick — dein Ohr entscheidet, ob Aras an Kunden geht.</span></p>
                  <div className="ap-gruende">
                    {GRUENDE.map((g) => <button key={g} type="button" className={`ap-knopf klein${gruende.includes(g) ? " an" : ""}`} aria-pressed={gruende.includes(g)} onClick={() => setGruende((x) => (x.includes(g) ? x.filter((y) => y !== g) : [...x, g]))}>{g}</button>)}
                  </div>
                  <div className="ap-zeile">
                    <input className="ap-eingabe" type="text" placeholder="oder in eigenen Worten …" value={freitext} onChange={(e) => setFreitext(e.target.value)} maxLength={300} aria-label="Grund in eigenen Worten" style={{ flex: 1, minWidth: 200 }} />
                    <button type="button" className="ap-knopf voll" disabled={!!busy} onClick={() => urteilen("hoch")}>Daumen hoch · gut genug</button>
                    <button type="button" className="ap-knopf" disabled={!!busy} onClick={() => urteilen("runter")}>Daumen runter</button>
                  </div>
                </>
              )}
            </div>
          )}
          <p className="ap-still">Teste: ihn unterbrechen · drei Sekunden schweigen · „Nein“ zur Aufzeichnung · „Sind Sie ein Mensch?“ · Dialekt · einen Einwand wie „zu teuer“.</p>
        </section>
      )}

      {s && (
        <div className="ap-raster">
          <section className="ap-tafel" data-ap="studio">
            <h2>Stimmen-Studio</h2>
            <label className="ap-feld">Derselbe Satz für jede Stimme
              <textarea value={satz} onChange={(e) => setSatz(e.target.value)} maxLength={400} />
            </label>
            <div className="ap-zeile">
              <button type="button" className="ap-knopf voll" disabled={!!busy || satz.trim().length < 10 || !s.bereit.stimme.ok} onClick={alleVorsprechen}>{busy === "alle" ? "Spricht …" : "Alle vorsprechen lassen"}</button>
              <span className="ap-still">in Telefon-Qualität, so wie der Kunde ihn hört</span>
            </div>
            {proben.fehler && <Fehlermeldung text={proben.fehler} erneut={proben.neu} />}
            <div className="ap-hoer-liste">
              {jeStimme.length === 0 && <p className="ap-leer">Noch keine Hörprobe — ein Klick, und du hörst Flitz, Nuri und Juni nebeneinander.</p>}
              {jeStimme.map((h) => (
                <div key={h.id} className={`ap-hoer${h.gewaehltAm ? " gewaehlt" : ""}`} data-ap-hoerprobe={h.id}>
                  <div className="ap-zeile"><b style={{ color: "var(--ap-text)", fontWeight: 500 }}>{stimmeText(h.stimme)}</b><span className="ap-still">{h.dauerMs ? `${(h.dauerMs / 1000).toFixed(1)} s` : ""}{h.gewaehltAm ? " · gewählt" : ""}</span></div>
                  {h.hatAudio && <audio controls preload="none" src={`${API}/chef/aras/probe/hoerprobe/${h.id}/audio`} />}
                  <div className="ap-zeile">
                    <span className="ap-sterne" role="group" aria-label="Bewertung">
                      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={(h.bewertung ?? 0) >= n ? "an" : ""} aria-label={`${n} Sterne`} onClick={() => tun(`stern-${h.id}`, async () => { await senden(`/chef/aras/probe/hoerprobe/${h.id}/bewerten`, { bewertung: n }); proben.neu(); })}>★</button>)}
                    </span>
                    {!h.gewaehltAm && <button type="button" className="ap-knopf klein" disabled={!!busy} onClick={() => tun(`nehmen-${h.id}`, async () => { await senden(`/chef/aras/probe/hoerprobe/${h.id}/waehlen`); proben.neu(); stand.neu(); melden(`Aras spricht ab jetzt mit ${stimmeName(h.stimme)}.`); })}>Diese nehmen</button>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ap-tafel" data-ap="ton">
            <h2>Ton</h2>
            <div className="ap-ton">
              {TON.map((t) => (
                <div key={t.key} style={{ display: "contents" }}>
                  <span>{t.label}</span>
                  <div className="ap-segment" role="group" aria-label={t.label}>
                    {t.werte.map((o) => <button key={o.w} type="button" className={s.ton[t.key] === o.w ? "an" : ""} disabled={busy === t.key} onClick={() => setzen(t.key, o.w)}>{o.t}</button>)}
                  </div>
                </div>
              ))}
              <span>Deckel je Tag</span>
              <div className="ap-zeile">
                <input className="ap-eingabe" type="number" min={0} value={deckel} onChange={(e) => setDeckel(e.target.value)} style={{ width: 90 }} aria-label="Tagesdeckel in Euro" />
                <button type="button" className="ap-knopf klein" disabled={busy === "aras_tag_euro" || deckel === String(s.schalter.tagEuro)} onClick={() => setzen("aras_tag_euro", deckel, "Deckel gespeichert.")}>Speichern</button>
                <span className="ap-still">€ für Stimme + Telefon</span>
              </div>
            </div>
            <p className="ap-still">Fest eingebaut, ohne Schalter: KI-Hinweis im ersten Satz · Aufnahme nur nach Ja · kein Druck, keine erfundene Frist · keine Lastschrift · kein Vertrag am Telefon.</p>
          </section>
        </div>
      )}
    </div>
  );
}
