// ═══════════════════════════════════════════════════════════════════════════
// ARAS — DER AUFTRAGS-CHAT IN DER AKTE (E-408, Akte-Steuerung, 20.10.2026)
//
// Justin: „… am besten öffnet sich so ein kurzer Chat wo genau abgefragt wird damit ARAS perfekt arbeiten kann“
//
// Öffnet sich IN der Karte „ARAS“ (kein Fenster über der Seite; am Handy nimmt er die ganze Karte ein):
//   1. ARAS kennt die Akte und macht EINEN Vorschlag mit Knöpfen („Ja, wegen der Rate“ · „Etwas anderes“).
//   2. Höchstens drei kurze Rückfragen — dann die Auftragskarte: Ziel · Sagen · Fragen · Nicht versprechen · Achten auf · Wann.
//   3. „Passt – ARAS anrufen lassen“ plant genau diesen Text ein; „Ändern“ macht die Karte zum Formular.
//   Geht Anrufen gerade nicht: EIN Satz warum, dazu „Soll Mara stattdessen schreiben?“.
//   Verbotenes beantwortet ARAS im Chat mit einer besseren Formulierung („Das darf ich so ned sagen — wie wär's mit …“).
// Server: server/routes/fiaon-aras-briefing-chat.ts · Leitfaden: shared/fiaon-aras-briefing-chat.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/pages/agent/shared";
import type { BriefingChip, BriefingKarte, BriefingSicht, BriefingWann } from "@shared/fiaon-aras-briefing-chat";

type Melden = (art: "gut" | "schlecht" | "info", titel: string, text?: string) => void;
interface Entwurf { ziel: string; sagen: string; fragen: string; nicht: string; achtung: string }

const WANN_TEXT: Record<BriefingWann, string> = { bald: "So bald wie möglich", heute_ab: "Heute ab", morgen: "Morgen ab" };
const zeitKurz = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
/** Ungefähr so lang wird der Auftrag (die genaue Zahl rechnet der Server beim Übernehmen). */
const ungefaehr = (e: Entwurf) => 60 + e.ziel.length + e.sagen.length + e.fragen.length + e.nicht.length + e.achtung.length;
const entwurfAus = (k: BriefingKarte): Entwurf => ({ ziel: k.ziel, sagen: k.sagen, fragen: k.fragen.join("\n"), nicht: k.nichtVersprechen.join("\n"), achtung: k.achtung });

function Zeichen({ art }: { art: "zu" | "senden" }) {
  return art === "zu" ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 3l8 8M11 3l-8 8" /></svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 8h10M8.5 3.5L13 8l-4.5 4.5" /></svg>
  );
}

export function ArasBriefingChat({ personId, melden, onZu, onGeaendert }: { personId: number; melden: Melden; onZu: () => void; onGeaendert: () => void }) {
  const [sicht, setSicht] = useState<BriefingSicht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [denkt, setDenkt] = useState(false);
  const [eingabe, setEingabe] = useState("");
  const [wartend, setWartend] = useState<string | null>(null);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState<Entwurf | null>(null);
  const [wann, setWann] = useState<BriefingWann>("bald");
  const [abHeute, setAbHeute] = useState("17:00");
  const [abMorgen, setAbMorgen] = useState("09:00");
  const [benachrichtigen, setBenachrichtigen] = useState(true);
  const [hinweise, setHinweise] = useState<string[]>([]);
  const listeRef = useRef<HTMLDivElement | null>(null);
  const feldRef = useRef<HTMLTextAreaElement | null>(null);

  const starten = useCallback(async (neu = false) => {
    setFehler(null); setDenkt(true); setBearbeiten(false); setHinweise([]);
    const r = await api(`/agent/kunden/${personId}/aras/briefing`, { method: "POST", body: JSON.stringify({ neu }) });
    setDenkt(false);
    if (r.ok) setSicht(r.json.briefing); else setFehler(r.json?.error ?? "Der Chat ließ sich nicht öffnen.");
  }, [personId]);
  useEffect(() => { void starten(false); }, [starten]);
  // Die Karte bringt ihr „Wann“ mit — die Knöpfe darunter starten dort.
  const karte = sicht?.karte ?? null;
  useEffect(() => {
    if (!karte) return;
    setWann(karte.wann);
    if (karte.wann === "heute_ab" && karte.ab) setAbHeute(karte.ab);
    if (karte.wann === "morgen") setAbMorgen(karte.ab ?? "09:00");
  }, [karte?.wann, karte?.ab]);
  // Die jüngste Nachricht in den Blick: am Rechner scrollt die Liste, am Handy (Liste ohne eigene Höhe) die Akte.
  useEffect(() => {
    const el = listeRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    (el.lastElementChild as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
  }, [sicht?.zeilen.length, denkt, wartend, bearbeiten, sicht?.schritt]);

  async function schicken(pfad: string, body: unknown): Promise<any> {
    setFehler(null); setDenkt(true);
    const r = await api(`/agent/kunden/${personId}/aras/briefing/${sicht?.id}/${pfad}`, { method: "POST", body: JSON.stringify(body ?? {}) });
    setDenkt(false); setWartend(null);
    if (r.json?.briefing) setSicht(r.json.briefing);
    if (!r.ok && !r.json?.briefing) setFehler(r.json?.error ?? "Bitte noch einmal versuchen.");
    return r;
  }
  async function antworten(text: string, wert: string | null = null) {
    const t = text.trim();
    if (!sicht || denkt || (!t && !wert)) return;
    setWartend(t); setEingabe(""); setHinweise([]);
    const r = await schicken("antwort", { text: t, wert });
    if (Array.isArray(r.json?.briefing?.hinweise)) setHinweise(r.json.briefing.hinweise);
    feldRef.current?.focus();
  }
  async function knopf(c: BriefingChip) {
    if (!c.wert.startsWith("aktion:")) { await antworten(c.text, c.wert || null); return; }
    const aktion = c.wert.slice(7);
    setWartend(c.text);
    const r = await schicken("aktion", { aktion, text: c.text });
    if (aktion === "schliessen") { onZu(); return; }
    if (aktion === "mara" && r.ok) { melden("gut", "Mara schreibt", r.json?.meldung ?? undefined); onGeaendert(); }
    if ((aktion === "wieder_an" || aktion === "zuruecknehmen") && r.ok) onGeaendert();
  }
  async function beauftragen() {
    if (!sicht) return;
    setWartend("Passt – ARAS anrufen lassen");
    const r = await schicken("beauftragen", { wann, ab: wann === "heute_ab" ? abHeute : wann === "morgen" ? abMorgen : null, benachrichtigen });
    if (r.ok) { melden("gut", "ARAS ist beauftragt", r.json?.meldung ?? undefined); onGeaendert(); }
    else { setHinweise(Array.isArray(r.json?.hinweise) ? r.json.hinweise : []); melden("schlecht", "Nicht eingeplant", r.json?.error ?? undefined); }
  }
  async function uebernehmen() {
    if (!entwurf) return;
    const r = await schicken("karte", { karte: {
      ziel: entwurf.ziel, sagen: entwurf.sagen, fragen: entwurf.fragen.split("\n"), nichtVersprechen: entwurf.nicht.split("\n"), achtung: entwurf.achtung,
      wann, ab: wann === "heute_ab" ? abHeute : wann === "morgen" ? abMorgen : null,
    } });
    if (r.ok) { setBearbeiten(false); setHinweise([]); } else setHinweise(Array.isArray(r.json?.hinweise) ? r.json.hinweise : []);
  }

  const offen = sicht?.status === "offen";
  // Nach dem Auftrag steht die Karte unten unter „Geplant“ (mit „Chat nachlesen“) — hier nur noch der Satz dazu.
  const zeigeKarte = !!karte && sicht?.status === "offen" && sicht?.schritt === "karte";
  const fertig = !!sicht && !offen;
  return (
    <div className="akc" role="region" aria-label="Auftrag an ARAS" data-fiaon="aras-chat">
      <div className="akc-kopf">
        <span className="akc-bild" aria-hidden="true">A</span>
        <div className="akc-titel"><b>ARAS</b><small>Sag mir, was ich beim Anruf sagen oder fragen soll.</small></div>
        <button type="button" className="akc-zu" onClick={onZu} aria-label="Chat schließen" title="Schließen — der Chat wartet zwei Stunden auf dich"><Zeichen art="zu" /></button>
      </div>

      <div className="akc-verlauf" ref={listeRef} aria-live="polite">
        {!sicht && !fehler && <p className="akc-leise">ARAS liest die Akte …</p>}
        {sicht?.zeilen.map((z, i) => (
          <div key={`${i}-${z.am}`} className={`akc-zeile ${z.wer}`}>
            <p className="akc-blase">{z.text}</p>
            <small>{z.wer === "aras" ? "ARAS" : "Du"} · {zeitKurz(z.am)}</small>
          </div>
        ))}
        {wartend && <div className="akc-zeile du"><p className="akc-blase">{wartend}</p></div>}
        {zeigeKarte && karte && (
          <div className="akc-karte" data-fiaon="aras-auftragskarte">
            <div className="akc-karte-kopf">
              <b>Auftrag an ARAS</b>
              <small title="So viele Zeichen bekommt ARAS — höchstens so viele passen in einen Auftrag.">
                {bearbeiten && entwurf ? `ca. ${ungefaehr(entwurf)}` : sicht?.zeichen}/{sicht?.max} Zeichen
              </small>
            </div>
            {bearbeiten && entwurf ? (
              <div className="akc-form">
                <label>Ziel<input className="pi-eingabe" value={entwurf.ziel} maxLength={140} onChange={(e) => setEntwurf({ ...entwurf, ziel: e.target.value })} /></label>
                <label>Sagen<textarea className="pi-eingabe" rows={2} maxLength={220} value={entwurf.sagen} onChange={(e) => setEntwurf({ ...entwurf, sagen: e.target.value })} /></label>
                <label>Fragen <small>(eine je Zeile, höchstens drei)</small><textarea className="pi-eingabe" rows={2} value={entwurf.fragen} onChange={(e) => setEntwurf({ ...entwurf, fragen: e.target.value })} /></label>
                <label>Nicht versprechen <small>(eine je Zeile)</small><textarea className="pi-eingabe" rows={2} value={entwurf.nicht} onChange={(e) => setEntwurf({ ...entwurf, nicht: e.target.value })} /></label>
                <label>Achten auf<input className="pi-eingabe" value={entwurf.achtung} maxLength={160} onChange={(e) => setEntwurf({ ...entwurf, achtung: e.target.value })} placeholder="Uhrzeit, Ton, heikle Themen" /></label>
              </div>
            ) : (
              <dl className="akc-felder">
                <dt>Ziel</dt><dd>{karte.ziel}</dd>
                {karte.sagen && <><dt>Sagen</dt><dd>{karte.sagen}</dd></>}
                {karte.fragen.length > 0 && <><dt>Fragen</dt><dd><ul>{karte.fragen.map((f) => <li key={f}>{f}</li>)}</ul></dd></>}
                {karte.nichtVersprechen.length > 0 && <><dt>Nicht versprechen</dt><dd><ul>{karte.nichtVersprechen.map((f) => <li key={f}>{f}</li>)}</ul></dd></>}
                {karte.achtung && <><dt>Achten auf</dt><dd>{karte.achtung}</dd></>}
              </dl>
            )}
            {offen ? (
              <>
                <div className="akc-wann" role="group" aria-label="Wann soll ARAS anrufen?">
                  <span>Wann</span>
                  {(["bald", "heute_ab", "morgen"] as BriefingWann[]).map((w) => (
                    <button key={w} type="button" className={wann === w ? "an" : ""} aria-pressed={wann === w} onClick={() => setWann(w)}>{WANN_TEXT[w]}</button>
                  ))}
                  {wann === "heute_ab" && <input type="time" className="pi-eingabe akc-uhr" value={abHeute} min="08:00" max="20:30" step={900} onChange={(e) => setAbHeute(e.target.value)} aria-label="Heute ab Uhrzeit" />}
                  {wann === "morgen" && <input type="time" className="pi-eingabe akc-uhr" value={abMorgen} min="08:00" max="20:30" step={900} onChange={(e) => setAbMorgen(e.target.value)} aria-label="Morgen ab Uhrzeit" />}
                </div>
                <label className="akc-haken"><input type="checkbox" checked={benachrichtigen} onChange={(e) => setBenachrichtigen(e.target.checked)} /> Mich nach dem Anruf benachrichtigen</label>
                {hinweise.length > 0 && <ul className="akc-hinweise">{hinweise.map((h) => <li key={h}>{h}</li>)}</ul>}
                <div className="akc-tun">
                  {bearbeiten ? (
                    <>
                      <button type="button" className="pi-knopf" disabled={denkt} onClick={() => void uebernehmen()}>{denkt ? "Prüft …" : "Übernehmen"}</button>
                      <button type="button" className="pi-knopf still" disabled={denkt} onClick={() => { setBearbeiten(false); setHinweise([]); }}>Abbrechen</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="pi-knopf" disabled={denkt} onClick={() => void beauftragen()}>{denkt ? "Plant …" : "Passt – ARAS anrufen lassen"}</button>
                      <button type="button" className="pi-knopf still" disabled={denkt} onClick={() => { setEntwurf(entwurfAus(karte)); setBearbeiten(true); setHinweise([]); }}>Ändern</button>
                    </>
                  )}
                </div>
                {!bearbeiten && <p className="akc-leise">Oder schreib mir unten, was anders sein soll.</p>}
              </>
            ) : null}
          </div>
        )}
        {denkt && (
          <div className="akc-zeile aras" aria-label="ARAS schreibt">
            <p className="akc-blase akc-tippt"><i /><i /><i /></p>
          </div>
        )}
      </div>

      {fehler && <p className="akc-fehler" role="alert">{fehler} <button type="button" className="ak-link" onClick={() => void starten(false)}>Nochmal</button></p>}
      {offen && !denkt && (sicht?.chips.length ?? 0) > 0 && (
        <div className="akc-chips">
          {sicht!.chips.map((c) => <button key={`${c.wert}-${c.text}`} type="button" onClick={() => void knopf(c)}>{c.text}</button>)}
        </div>
      )}
      {offen && sicht?.schritt !== "kann_nicht" && (
        <form className="akc-eingabe" onSubmit={(e) => { e.preventDefault(); void antworten(eingabe); }}>
          <textarea ref={feldRef} className="pi-eingabe" rows={1} maxLength={600} value={eingabe} disabled={denkt}
                    onChange={(e) => setEingabe(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void antworten(eingabe); } }}
                    placeholder={sicht?.schritt === "karte" ? "Was soll anders sein?" : "Deine Nachricht an ARAS …"} aria-label="Nachricht an ARAS" />
          <button type="submit" className="akc-senden" disabled={denkt || !eingabe.trim()} aria-label="Senden"><Zeichen art="senden" /></button>
        </form>
      )}
      {fertig && (
        <div className="akc-tun akc-fuss">
          {sicht?.status === "beauftragt" && <p className="akc-leise akc-voll">Den Auftrag siehst du unten unter „Geplant“ — dort kannst du ihn auch zurücknehmen.</p>}
          <button type="button" className="pi-knopf klein" onClick={onZu}>Fertig</button>
          {sicht?.status !== "beauftragt" && <button type="button" className="pi-knopf klein still" onClick={() => void starten(true)}>Neuer Auftrag</button>}
        </div>
      )}
    </div>
  );
}

/** Der Auftrag aus dem Chat, kurz — für „Geplant“ und „Was ARAS gemacht hat“ (wer hat was angewiesen). */
export function BriefingKurz({ b }: { b: BriefingSicht }) {
  const [chat, setChat] = useState(false);
  const k = b.karte;
  return (
    <div className="akc-kurz" data-fiaon="aras-auftrag-kurz">
      <span className="ak-still">Auftrag von {b.vonDat}{b.beauftragtAm ? `, ${new Date(b.beauftragtAm).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}</span>
      {k && (
        <dl className="akc-felder klein">
          <dt>Ziel</dt><dd>{k.ziel}</dd>
          {k.sagen && <><dt>Sagen</dt><dd>{k.sagen}</dd></>}
          {k.fragen.length > 0 && <><dt>Fragen</dt><dd>{k.fragen.join(" · ")}</dd></>}
          {k.nichtVersprechen.length > 0 && <><dt>Nicht versprechen</dt><dd>{k.nichtVersprechen.join(" · ")}</dd></>}
          {k.achtung && <><dt>Achten auf</dt><dd>{k.achtung}</dd></>}
        </dl>
      )}
      <button type="button" className="ak-link" aria-expanded={chat} onClick={() => setChat((x) => !x)}>{chat ? "Chat zuklappen" : "Chat nachlesen"}</button>
      {chat && (
        <div className="akc-nachlesen">
          {b.zeilen.map((z, i) => <p key={i}><b>{z.wer === "aras" ? "ARAS" : z.von ?? "Du"}:</b> {z.text}</p>)}
        </div>
      )}
    </div>
  );
}
