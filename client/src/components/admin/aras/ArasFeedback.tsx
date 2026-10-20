// ═══════════════════════════════════════════════════════════════════════════
// „DEIN FEEDBACK AUS PROBEANRUFEN“ (Cockpit, 20.10.2026)
//
// Was du nach Probeanrufen sagst (Daumen + Gründe), sammelt der Telefon-Kern als Punkte — du übernimmst sie oder
// verwirfst sie. Die Routen baut der Kern parallel:
//   GET  /chef/aras/probe/feedback                      → { ok, zeilen: [...] } (auch feedback/liste/eintraege)
//   POST /chef/aras/probe/feedback/:id/uebernehmen | /verwerfen
// Gibt es sie noch nicht (404), steht hier leise „kommt gleich“ — nie ein Fehler. Die Felder je Punkt liest die
// Seite großzügig (text/feedback/grund, vorschlag/aenderung, am/createdAt, status), damit kleine Namensunterschiede
// des Kerns nichts kaputt machen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { holen, senden, type RouteFehler } from "../ki-teile";
import { feedbackLesen, uhrzeit, type FeedbackPunkt } from "./aras-texte";
import { Hinweis, Karte, useHinweis, Zeichen } from "./aras-teile";

const amText = (am: string | null) => {
  if (!am) return "";
  const tag = new Date(am).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const heute = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  return tag === heute ? `heute ${uhrzeit(am)}` : new Date(am).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" });
};

export default function ArasFeedback({ neuSignal = 0 }: { neuSignal?: number }) {
  const [punkte, setPunkte] = useState<FeedbackPunkt[] | null>(null);
  const [kommtGleich, setKommtGleich] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [erledigteAuf, setErledigteAuf] = useState(false);
  const hinweis = useHinweis();
  useEffect(() => {
    let weg = false;
    holen<any>("/chef/aras/probe/feedback")
      .then((j) => { if (!weg) { setPunkte(feedbackLesen(j)); setKommtGleich(false); setFehler(null); } })
      .catch((e) => { if (weg) return; if ((e as RouteFehler).status === 404) setKommtGleich(true); else setFehler((e as Error).message); });
    return () => { weg = true; };
  }, [runde, neuSignal]);
  const tun = async (p: FeedbackPunkt, was: "uebernehmen" | "verwerfen") => {
    setBusy(`${p.id}-${was}`);
    try {
      await senden(`/chef/aras/probe/feedback/${encodeURIComponent(p.id)}/${was}`, {});
      setPunkte((alt) => (alt ?? []).map((x) => (x.id === p.id ? { ...x, status: was === "uebernehmen" ? "uebernommen" : "verworfen" } : x)));
      hinweis.gut(was === "uebernehmen" ? "Übernommen." : "Verworfen.");
      setRunde((r) => r + 1);
    } catch (e) {
      if ((e as RouteFehler).status === 404) { setKommtGleich(true); hinweis.gut("Kommt gleich — dieser Knopf geht mit dem nächsten Stand des Telefon-Kerns."); }
      else hinweis.rot((e as Error).message);
    } finally { setBusy(null); }
  };
  const offen = (punkte ?? []).filter((p) => p.status === "offen");
  const erledigt = (punkte ?? []).filter((p) => p.status !== "offen");
  return (
    <Karte titel="Dein Feedback aus Probeanrufen" satz="Was dir auffällt, sammelt Aras hier — du entscheidest, was er übernimmt." data="feedback"
      rechts={punkte && offen.length ? <span className="ar-marke leise">{offen.length} offen</span> : null}>
      <Hinweis h={hinweis.h} onWeg={hinweis.weg} />
      {kommtGleich ? (
        <p className="ar-leise ar-kommt" data-ar="feedback-kommt">Kommt gleich: Sobald der Telefon-Kern dein Feedback sammelt, steht es hier — mit „Übernehmen“ und „Verwerfen“.</p>
      ) : fehler ? (
        <p className="ar-leise">Das Feedback ließ sich gerade nicht laden. <button type="button" className="ar-knopf-text" onClick={() => setRunde((r) => r + 1)}>Nochmal</button></p>
      ) : !punkte ? (
        <div className="ar-zeile-lade" />
      ) : !punkte.length ? (
        <p className="ar-leise">Noch nichts — gib nach einem Probeanruf Daumen hoch oder runter, dann sammelt es sich hier.</p>
      ) : (
        <>
          {offen.length ? (
            <ul className="ar-feedback">
              {offen.map((p) => (
                <li key={p.id} data-ar-feedback={p.id}>
                  <div className="ar-feedback-text">
                    {p.daumen ? <span className={`ar-marke daumen ${p.daumen === "hoch" ? "hoch" : "runter"}`}><Zeichen art={p.daumen === "hoch" ? "hoch" : "runter"} /></span> : null}
                    <div>
                      <b>{p.text || p.vorschlag}</b>
                      {p.text && p.vorschlag ? <p>{p.vorschlag}</p> : null}
                      <small>{[amText(p.am), p.anrufe ? `${p.anrufe} Probeanruf${p.anrufe === 1 ? "" : "e"}` : ""].filter(Boolean).join(" · ")}</small>
                    </div>
                  </div>
                  <div className="ar-feedback-knoepfe">
                    <button type="button" className="ar-knopf klein haupt" disabled={!!busy} onClick={() => void tun(p, "uebernehmen")} data-ar="feedback-uebernehmen">{busy === `${p.id}-uebernehmen` ? "…" : "Übernehmen"}</button>
                    <button type="button" className="ar-knopf klein" disabled={!!busy} onClick={() => void tun(p, "verwerfen")} data-ar="feedback-verwerfen">{busy === `${p.id}-verwerfen` ? "…" : "Verwerfen"}</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="ar-leise">Alles entschieden.</p>}
          {erledigt.length ? (
            <div className="ar-erledigt-feedback">
              <button type="button" className="ar-knopf-text" aria-expanded={erledigteAuf} onClick={() => setErledigteAuf(!erledigteAuf)}>{erledigteAuf ? "Entschiedene ausblenden" : `${erledigt.length} entschieden — zeigen`}</button>
              {erledigteAuf ? <ul className="ar-feedback leise">{erledigt.map((p) => <li key={p.id}><div className="ar-feedback-text"><div><b>{p.text || p.vorschlag}</b><small>{p.status === "uebernommen" ? "übernommen" : "verworfen"}{p.am ? ` · ${amText(p.am)}` : ""}</small></div></div></li>)}</ul> : null}
            </div>
          ) : null}
        </>
      )}
    </Karte>
  );
}
