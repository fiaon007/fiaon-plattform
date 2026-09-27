// ═══════════════════════════════════════════════════════════════════════════
// KI-PAUSE IM CHEFBÜRO (27.09.2026, E-246)
//
// Justin: „Wenn OpenAI nicht abbuchen kann, dann soll alles, was über OpenAI
// läuft, pausieren … einfach Pause, bis ich es wieder aktiviere."
//
// Zwei Stellen, keine neue Seite:
//   · KiPauseBand — rotes Band oben auf JEDER /chef-Seite, nur solange die KI
//     pausiert ist. Die Pause betrifft mehr als Mara (Auswertungen,
//     Transkripte, Postfach, Radar, Copilot) — sie muss dort sichtbar sein, wo
//     Justin gerade arbeitet.
//   · KiPauseKarte — im Mara-Steuerpult (/chef/s/mara), immer sichtbar:
//     Zustand, Verlauf, „KI jetzt pausieren" / „KI wieder aktivieren".
// Aktivieren und Pausieren darf nur die Stufe Inhaber (der Server prüft es).
// Die Regeln stehen in server/lib/fiaon-ki-pause.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { API } from "./chef-teile";

interface Ereignis { am: string; was: "pausiert" | "aktiviert" | "probe_gescheitert"; von: string; grund: string | null }
export interface KiPauseZustand {
  an: boolean; art: "abrechnung" | "zugang" | "hand" | null; grund: string | null; fehler: string | null;
  dienst: string | null; seit: string | null; von: string | null; aufgehobenAm: string | null; aufgehobenVon: string | null;
  /** Fingerabdruck des Schlüssels („…ab12cd"), mit dem der Fehler kam. */
  schluessel?: string | null;
  /** Nur im Prozess dieses Servers pausiert (kein Produktionsdienst) — nie gespeichert. */
  nurLokal?: boolean;
  verlauf: Ereignis[];
}
interface Liegen { whatsapp: number; mails: number; auswertungen: number; transkripte: number }

const KI_PAUSE_NEU = "fiaon-ki-pause-neu";
const zeit = (s: string | null) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const WAS: Record<Ereignis["was"], string> = { pausiert: "pausiert", aktiviert: "wieder aktiviert", probe_gescheitert: "Aktivieren abgelehnt (Probe)" };

/** Den Zustand lesen — beim Öffnen, jede Minute und wenn das Fenster wieder nach vorn kommt. */
export function useKiPause() {
  const [zustand, setZustand] = useState<KiPauseZustand | null>(null);
  const [liegen, setLiegen] = useState<Liegen | null>(null);
  const laden = useCallback(async () => {
    try {
      const r = await fetch(`${API}/chef/ki-pause`, { credentials: "include" });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) { setZustand(j.zustand); setLiegen(j.liegen ?? null); }
    } catch { /* ohne Netz bleibt der letzte Stand */ }
  }, []);
  useEffect(() => {
    void laden();
    const uhr = window.setInterval(() => void laden(), 60_000);
    const vorn = () => { if (document.visibilityState === "visible") void laden(); };
    const neu = () => void laden();
    document.addEventListener("visibilitychange", vorn);
    // Band und Karte lesen getrennt — ein Klick in der einen Stelle frischt die andere sofort auf.
    window.addEventListener(KI_PAUSE_NEU, neu);
    return () => { window.clearInterval(uhr); document.removeEventListener("visibilitychange", vorn); window.removeEventListener(KI_PAUSE_NEU, neu); };
  }, [laden]);
  return { zustand, liegen, laden, setZustand };
}

async function senden(pfad: string, body: unknown = {}): Promise<any> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  try { window.dispatchEvent(new Event(KI_PAUSE_NEU)); } catch { /* nur Anzeige */ }
  if (!r.ok || !j?.ok) throw new Error(j?.error || "Das hat nicht geklappt.");
  return j;
}

function liegenText(l: Liegen | null): string {
  if (!l) return "";
  const teile = [
    `${l.whatsapp} WhatsApp seit Pausenbeginn`,
    `${l.mails} Mail${l.mails === 1 ? "" : "s"} zurückgelegt`,
    `${l.auswertungen} Auswertung${l.auswertungen === 1 ? "" : "en"}`,
    `${l.transkripte} Transkript${l.transkripte === 1 ? "" : "e"}`,
  ];
  return `Liegen geblieben: ${teile.join(" · ")}. Neue Mails bleiben ungelesen im Posteingang — `
    + "entweder direkt im Postfach support@/welcome@ beantworten UND in Gmail archivieren oder liegen lassen, Mara holt nach. "
    + "Wer anders antwortet (eigenes Postfach, Telefon, WhatsApp), archiviert die Mail.";
}

/** Der Knopf „KI wieder aktivieren" mit Rückfrage — für Band und Karte derselbe. */
function AktivierenKnopf({ onFertig }: { onFertig: (meldung: string, fehler?: boolean) => void }) {
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const los = async () => {
    setLaeuft(true);
    try {
      const j = await senden("/chef/ki-pause/aktivieren");
      onFertig(j.hinweis || "KI wieder aktiv. Liegen Gebliebenes holen die Läufe jetzt nach.");
    } catch (e: any) {
      onFertig(e.message, true);
    } finally { setLaeuft(false); setFrage(false); }
  };
  if (!frage) return <button type="button" className="kip-knopf" onClick={() => setFrage(true)}>KI wieder aktivieren</button>;
  return (
    <span className="kip-frage" role="group" aria-label="Rückfrage">
      <span>Guthaben bei OpenAI aufgeladen? Vor dem Aktivieren läuft ein Probe-Aufruf.</span>
      <button type="button" className="kip-knopf" disabled={laeuft} onClick={() => void los()}>{laeuft ? "Prüfe …" : "Ja, aktivieren"}</button>
      <button type="button" className="kip-knopf still" disabled={laeuft} onClick={() => setFrage(false)}>Abbrechen</button>
    </span>
  );
}

/** Das Band im Kopf jeder Chefbüro-Seite — nur solange pausiert. */
export function KiPauseBand({ inhaber }: { inhaber: boolean }) {
  const { zustand, liegen, laden } = useKiPause();
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  if (!zustand?.an && !meldung) return null;
  if (!zustand?.an && meldung) {
    return (
      <div className="kip-band ok" role="status">
        <p>{meldung.text}</p>
        <button type="button" className="kip-knopf still" onClick={() => setMeldung(null)}>Schließen</button>
      </div>
    );
  }
  const z = zustand!;
  return (
    <div className="kip-band" role="alert">
      <div className="kip-band-text">
        <b>KI pausiert seit {zeit(z.seit)}</b>
        <p>
          {z.grund || "OpenAI konnte nicht abbuchen."}
          {z.dienst && z.art !== "hand" ? ` Erster Fehler bei: ${z.dienst}${z.schluessel ? ` (Schlüssel ${z.schluessel})` : ""}.` : ""}
          {z.nurLokal ? " Nur auf diesem Server pausiert (kein Produktionsdienst) — nichts gespeichert." : ""}
          {" "}Nichts, was OpenAI braucht, geht an Kunden — alles wartet.
        </p>
        {liegen && <p className="kip-leise">{liegenText(liegen)}</p>}
        {meldung && <p className={meldung.fehler ? "kip-fehler" : "kip-leise"}>{meldung.text}</p>}
      </div>
      {inhaber
        ? <AktivierenKnopf onFertig={(t, f) => { setMeldung({ text: t, fehler: !!f }); void laden(); }} />
        : <span className="kip-leise">Aktivieren kann nur der Inhaber.</span>}
    </div>
  );
}

/** Die Karte im Mara-Steuerpult — Zustand, Verlauf, beide Knöpfe. */
export function KiPauseKarte() {
  const { zustand, laden } = useKiPause();
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  if (!zustand) return null;
  const pausieren = async () => {
    if (!window.confirm("Alle KI-Funktionen jetzt anhalten? Mara (WhatsApp, Postfach, Aktion), Auswertungen, Transkripte, Radar und Copilot warten dann, bis du sie wieder aktivierst. Es geht nichts an Kunden.")) return;
    setLaeuft(true);
    try {
      await senden("/chef/ki-pause/pausieren", { grund: "Von Hand im Chefbüro angehalten." });
      setMeldung({ text: "KI pausiert. Nichts, was OpenAI braucht, läuft weiter.", fehler: false });
    } catch (e: any) { setMeldung({ text: e.message, fehler: true }); } finally { setLaeuft(false); void laden(); }
  };
  return (
    <section className={`kip-karte${zustand.an ? " aus" : ""}`} aria-label="KI-Zustand">
      <div className="kip-karte-kopf">
        <span className={`kip-punkt${zustand.an ? "" : " an"}`} aria-hidden="true" />
        <div>
          <b>{zustand.an ? `KI pausiert seit ${zeit(zustand.seit)}` : "KI aktiv"}</b>
          {/* Pausiert: Grund, Zahlen und der Knopf stehen im roten Band darüber — hier nicht noch einmal. */}
          <p>{zustand.an
            ? `Ausgelöst: ${zustand.von ?? "—"}${zustand.dienst && zustand.art !== "hand" ? ` (erster Fehler bei ${zustand.dienst})` : ""}. „KI wieder aktivieren“ steht im roten Band oben.`
            : "Kann OpenAI nicht abbuchen, pausiert sie von selbst — und du bekommst genau eine Aufgabe."}</p>
          {meldung && <p className={meldung.fehler ? "kip-fehler" : "kip-leise"}>{meldung.text}</p>}
        </div>
        {!zustand.an && (
          <div className="kip-karte-knoepfe">
            <button type="button" className="kip-knopf still" disabled={laeuft} onClick={() => void pausieren()}>{laeuft ? "…" : "KI jetzt pausieren"}</button>
          </div>
        )}
      </div>
      {zustand.verlauf.length > 0 && (
        <details className="kip-verlauf">
          <summary>Verlauf ({zustand.verlauf.length})</summary>
          <ol>
            {zustand.verlauf.slice(0, 10).map((v, i) => (
              <li key={`${v.am}-${i}`}><time>{zeit(v.am)}</time> {WAS[v.was] ?? v.was} · {v.von}{v.grund ? ` — ${v.grund}` : ""}</li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
