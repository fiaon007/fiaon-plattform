// Reiter „Stimme“ (E-409): Stimmen-Studio — Hörproben nebeneinander, Sterne, „Diese nehmen“, Satz vorsprechen; Regie-Schalter.
import { useState } from "react";
import type { HoerprobeZeile } from "@shared/fiaon-ki-team";
import { API, useTakt, senden, useMeldung, Meldung, Fehler, NichtVerbunden, tagZeit } from "../ki-teile";

const VORGABE_SATZ = "Hallo, hier ist Aras von FIAON – ich bin eine KI. Darf ich kurz stören?";
const STIMME_TEXT: Record<string, string> = { flitz: "Flitz (männlich)", nuri: "Nuri (weiblich)", juni: "Juni (weiblich)" };
const REGIE = ["aras_stimme", "aras_fuellwoerter", "aras_lachen", "aras_tempo", "aras_zuhoerlaute"];

export default function ArasStimme({ verbunden, eigeneStimmen }: { verbunden: boolean; eigeneStimmen: boolean }) {
  const { daten, fehler, status, neu } = useTakt<{ ok: boolean; zeilen: HoerprobeZeile[]; stimmen: string[]; adapter: string[] }>(verbunden ? "/chef/aras/hoerproben" : null, 0);
  const regie = useTakt<{ ok: boolean; register: any[]; werte: Record<string, string> }>(verbunden ? "/chef/ki/einstellungen" : null, 0);
  const [text, setText] = useState(VORGABE_SATZ);
  const [stimme, setStimme] = useState("flitz");
  const [beschreibung, setBeschreibung] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  if (!verbunden || status === 404) return <NichtVerbunden />;
  const stimmen = daten?.stimmen?.length ? daten.stimmen : ["flitz", "nuri", "juni"];
  const erzeugen = async () => {
    setBusy("neu");
    try { await senden("/chef/aras/hoerprobe", { adapter: "openai_live", stimme: beschreibung ? `eigene:${beschreibung.slice(0, 24).replace(/\s+/g, "-").toLowerCase()}` : stimme, beschreibung: beschreibung || undefined, text }); meld.gut("Hörprobe erzeugt."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const waehlen = async (h: HoerprobeZeile) => {
    setBusy(`w${h.id}`);
    try { await senden(`/chef/aras/hoerprobe/${h.id}/waehlen`); meld.gut(`Aras spricht jetzt mit „${STIMME_TEXT[h.stimme] ?? h.stimme}“.`); neu(); regie.neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const bewerten = async (h: HoerprobeZeile, b: number) => {
    setBusy(`b${h.id}`);
    try { await senden(`/chef/aras/hoerprobe/${h.id}/bewerten`, { bewertung: b }); neu(); } catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const regieSetzen = async (schluessel: string, wert: string) => {
    setBusy(schluessel);
    try { await senden("/chef/ki/einstellung", { schluessel, wert }); meld.gut("Gespeichert."); regie.neu(); } catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const eintrag = (k: string) => (regie.daten?.register ?? []).find((e) => e.schluessel === k);
  return (
    <div>
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <div className="ki-karte" data-ki="studio">
        <h2>Stimmen-Studio <span className="ki-still ki-klein">· derselbe Satz, mehrere Stimmen — du klickst deine Wahl</span></h2>
        <div className="ki-chips">
          <input type="text" className="breit" value={text} onChange={(e) => setText(e.target.value)} maxLength={400} aria-label="Satz zum Vorsprechen" />
          <select value={stimme} onChange={(e) => setStimme(e.target.value)} aria-label="Stimme">{stimmen.map((s) => <option key={s} value={s}>{STIMME_TEXT[s] ?? s}</option>)}</select>
          {eigeneStimmen ? <input type="text" placeholder="oder: Stimme beschreiben (z. B. warm, ruhig, Mitte 30)" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} maxLength={400} style={{ width: 300 }} aria-label="Neue Stimme beschreiben" /> : null}
          <button type="button" className="ki-knopf klein haupt" disabled={busy === "neu" || text.trim().length < 5} onClick={erzeugen}>Vorsprechen lassen</button>
          <Meldung m={meld.m} />
        </div>
        {!daten?.zeilen.length ? <p className="ki-still ki-abstand">Noch keine Hörprobe — klick „Vorsprechen lassen“.</p> : (
          <div className="ki-live ki-abstand">
            {daten.zeilen.map((h) => (
              <article key={h.id} className="ki-sitzung" data-ki-hoerprobe={h.id}>
                <div className="ki-chips"><b className="ki-leise">{STIMME_TEXT[h.stimme] ?? h.stimme}</b>{h.gewaehltAm ? <span className="ki-pille gut">gewählt</span> : null}<span className="ki-still ki-klein">{tagZeit(h.createdAt)}{h.dauerMs ? ` · ${(h.dauerMs / 1000).toFixed(1)} s` : ""}</span></div>
                {h.beschreibung ? <p className="ki-still ki-klein">{h.beschreibung}</p> : null}
                <audio controls preload="none" src={`${API}/chef/aras/hoerprobe/${h.id}/audio`} style={{ width: "100%", marginTop: 8 }} />
                <p className="ki-still ki-klein" style={{ marginTop: 6 }}>„{h.text}“</p>
                <div className="ki-sitzung-knoepfe">
                  <span className="ki-sterne" role="group" aria-label="Bewertung">{[1, 2, 3, 4, 5].map((b) => <button key={b} type="button" className={(h.bewertung ?? 0) >= b ? "an" : ""} disabled={busy === `b${h.id}`} onClick={() => bewerten(h, b)} aria-label={`${b} Sterne`}>★</button>)}</span>
                  {!h.gewaehltAm ? <button type="button" className="ki-knopf klein haupt" disabled={busy === `w${h.id}`} onClick={() => waehlen(h)}>Diese nehmen</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="ki-karte ki-abstand" data-ki="regie">
        <h2>Regie <span className="ki-still ki-klein">· Füllwörter, Lachen, Tempo, Zuhör-Laute — wirkt beim nächsten Anruf</span></h2>
        {REGIE.map((k) => {
          const e = eintrag(k); if (!e) return null;
          const w = regie.daten?.werte[k] ?? e.vorgabe;
          return (
            <div key={k} className="ki-feld">
              <label title={e.satz}>{e.label}</label><small>{e.satz}</small>
              <div className="ki-eingabe">
                {e.typ === "an_aus" ? <button type="button" className={`ki-schalter${w === "an" ? " an" : ""}`} aria-pressed={w === "an"} disabled={busy === k} onClick={() => regieSetzen(k, w === "an" ? "aus" : "an")}><span className="bahn" aria-hidden="true" /><span>{w === "an" ? "an" : "aus"}</span></button>
                  : e.typ === "enum" ? <div className="ki-segment">{(e.enum ?? []).map((o: string) => <button key={o} type="button" className={w === o ? "an" : ""} disabled={busy === k} onClick={() => regieSetzen(k, o)}>{e.enumText?.[o] ?? o}</button>)}</div>
                  : <span className="ki-leise">{STIMME_TEXT[w] ?? w}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
