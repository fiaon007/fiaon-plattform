// ═══════════════════════════════════════════════════════════════════════════
// LIVE — nur, wenn ein Gespräch läuft (Cockpit, 20.10.2026)
//
// Ein Strom für die ganze Seite: SSE /chef/aras/live (Vertrag § 9) — Ereignisse je Anruf und die Sätze. Dazu der
// Gegencheck GET /chef/aras/live/stand: alle 2 s, solange ein Kasten steht (sonst alle 15 s), damit ein Kasten
// spätestens wenige Sekunden nach dem Auflegen verschwindet — auch ohne Ende-Ereignis (Regeln: aras-live.ts).
// Probe-Rückfall: Ist der Kern nicht angebunden, liest die Probe ihren eigenen Strom /chef/aras/probe/live?callId=…
// mit demselben Haken (quelle) und ohne Gegencheck.
// ═══════════════════════════════════════════════════════════════════════════
import { createContext, useCallback, useEffect, useReducer, useRef, useState } from "react";
import { API, holen, senden } from "../ki-teile";
import { LIVE_LEER, liveReduzieren, type LiveSitzung, type StandSitzung } from "./aras-live";
import { spielartText, zustandText } from "./aras-texte";
import { FrageKnopf, Verlauf } from "./aras-teile";

export type StromZustand = "offen" | "verbindet" | "aus";

export interface ArasLiveHaken {
  sitzungen: LiveSitzung[];
  strom: StromZustand;
  /** Nach „Mich anrufen“: eine Minute lang alle 2 s abgleichen, damit das Klingeln sofort oben steht. */
  beschleunigen: () => void;
  auflegen: (s: LiveSitzung) => Promise<void>;
  uebernehmen: (s: LiveSitzung) => Promise<void>;
  /** Von außen: dieser Anruf ist vorbei (z. B. der Probe-Stand sagt „läuft nicht mehr“). */
  weg: (callId: number) => void;
  busy: number | null;
  meldung: { text: string; rot: boolean } | null;
}

/** Der Live-Haken der Seite — der Reiter „Probe“ liest ihn (Klingeln sofort zeigen, Kasten wegnehmen, wenn sein Stand „vorbei“ sagt). */
export const ArasLiveKontext = createContext<ArasLiveHaken | null>(null);
/** Der Schalterstand oben (Not-Aus, Leerlauf, an, Stufe) als Schlüssel — ändert er sich, holt die Probe ihren Stand sofort neu. */
export const ArasLageKontext = createContext<string>("");

export function useArasLive(verbunden: boolean, opt: { quelle?: string | null; abgleich?: boolean; auflegenPfad?: (callId: number) => string } = {}): ArasLiveHaken {
  const quelle = opt.quelle === undefined ? "/chef/aras/live" : opt.quelle;
  const mitAbgleich = opt.abgleich !== false;
  const [stand, tun] = useReducer(liveReduzieren, LIVE_LEER);
  const [strom, setStrom] = useState<StromZustand>("verbindet");
  const [schnell, setSchnell] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; rot: boolean } | null>(null);
  const [, setUhr] = useState(0);
  const abgleichJetzt = useRef<() => void>(() => {});
  const viele = stand.sitzungen.length > 0;

  // ── Gegencheck mit dem Server (Gürtel und Hosenträger) ───────────────────
  useEffect(() => {
    if (!verbunden || !mitAbgleich) { abgleichJetzt.current = () => {}; return; }
    let weg = false, unterwegs = false;
    const holenJetzt = async () => {
      if (weg || unterwegs) return;
      unterwegs = true;
      const ab = Date.now();
      try {
        const j = await holen<{ verbunden?: boolean; laufend?: StandSitzung[]; klingelt?: StandSitzung[] }>("/chef/aras/live/stand");
        // Ohne Kern-Anbindung sagt der Stand nichts über die Brücke — dann nichts wegnehmen.
        if (!weg && j.verbunden !== false) tun({ typ: "abgleich", laufend: j.laufend ?? [], klingelt: Array.isArray(j.klingelt) ? j.klingelt : null, abgefragtAm: ab, jetzt: Date.now() });
      } catch { /* nächster Takt — der Strom läuft weiter */ } finally { unterwegs = false; }
    };
    abgleichJetzt.current = () => void holenJetzt();
    void holenJetzt();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") void holenJetzt(); }, viele || schnell ? 2000 : 15_000);
    const sicht = () => { if (document.visibilityState === "visible") void holenJetzt(); };
    document.addEventListener("visibilitychange", sicht);
    return () => { weg = true; window.clearInterval(t); document.removeEventListener("visibilitychange", sicht); };
  }, [verbunden, mitAbgleich, viele, schnell]);

  // ── Der Strom ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!verbunden || !quelle) { setStrom("aus"); return; }
    let es: EventSource | null = null, versuch = 0, zu = false, timer = 0;
    const verbinden = () => {
      if (zu) return;
      setStrom("verbindet");
      es = new EventSource(`${API}${quelle}`, { withCredentials: true });
      es.onopen = () => { versuch = 0; setStrom("offen"); abgleichJetzt.current(); };
      es.addEventListener("aras", (ev: MessageEvent) => {
        let e: any;
        try { e = JSON.parse(ev.data); } catch { return; }
        const art = String(e?.art ?? "");
        if (art === "verbunden") { setStrom("offen"); return; }
        if (art === "nicht_verbunden") { setStrom("aus"); return; }
        if (art === "herzschlag") { tun({ typ: "herz", e, jetzt: Date.now() }); return; }
        tun({ typ: "ereignis", e, jetzt: Date.now() });
      });
      es.onerror = () => {
        es?.close(); setStrom("verbindet"); versuch++;
        timer = window.setTimeout(verbinden, Math.min(30_000, 1000 * 2 ** versuch));
      };
    };
    verbinden();
    return () => { zu = true; es?.close(); window.clearTimeout(timer); };
  }, [verbunden, quelle]);

  // ── Uhr: Sekunden im Kasten, alte Merker weg ─────────────────────────────
  useEffect(() => {
    if (!viele) return;
    let n = 0;
    const t = window.setInterval(() => { setUhr((x) => x + 1); if (++n % 10 === 0) tun({ typ: "uhr", jetzt: Date.now() }); }, 1000);
    return () => window.clearInterval(t);
  }, [viele]);
  useEffect(() => { if (!schnell) return; const t = window.setTimeout(() => setSchnell(false), 60_000); return () => window.clearTimeout(t); }, [schnell]);
  useEffect(() => { if (!meldung) return; const t = window.setTimeout(() => setMeldung(null), meldung.rot ? 9000 : 4500); return () => window.clearTimeout(t); }, [meldung]);

  const beschleunigen = useCallback(() => { setSchnell(true); abgleichJetzt.current(); }, []);
  const weg = useCallback((callId: number) => tun({ typ: "weg", callId, jetzt: Date.now() }), []);
  const auflegenPfad = opt.auflegenPfad;
  const auflegen = useCallback(async (s: LiveSitzung) => {
    setBusy(s.callId);
    tun({ typ: "endet", callId: s.callId });
    try {
      await senden(auflegenPfad ? auflegenPfad(s.callId) : `/chef/aras/live/${s.callId}/beenden`, { grund: "chef" });
      setMeldung({ text: s.probe ? "Aufgelegt." : "Aras verabschiedet sich und legt auf.", rot: false });
    } catch (e) {
      setMeldung({ text: `Auflegen ging nicht: ${(e as Error).message}`, rot: true });
    } finally {
      setBusy(null);
      abgleichJetzt.current();
      window.setTimeout(() => abgleichJetzt.current(), 1500);
    }
  }, [auflegenPfad]);
  const uebernehmen = useCallback(async (s: LiveSitzung) => {
    setBusy(s.callId);
    try {
      await senden(`/chef/aras/live/${s.callId}/uebernehmen`, { grund: "Chefbüro" });
      setMeldung({ text: "Aras verbindet — dein Softphone klingelt gleich.", rot: false });
    } catch (e) {
      setMeldung({ text: `Übernehmen ging nicht: ${(e as Error).message}`, rot: true });
    } finally { setBusy(null); abgleichJetzt.current(); }
  }, []);

  return { sitzungen: stand.sitzungen, strom, beschleunigen, auflegen, uebernehmen, weg, busy, meldung };
}

/** Die Welle: ruhig, bewegt sich nur, solange jemand spricht (CSS, steht still bei „Bewegung reduzieren“). */
function Welle({ aktiv }: { aktiv: boolean }) {
  return <span className={`ar-welle${aktiv ? " aktiv" : ""}`} aria-hidden="true">{Array.from({ length: 12 }).map((_, i) => <i key={i} />)}</span>;
}

const uhrText = (seit: number) => {
  const s = Math.max(0, Math.round((Date.now() - seit) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Die Kästen der laufenden Gespräche: wer, wie lange, der Text live, „Übernehmen“ / „Auflegen“. */
export function LiveKaesten({ live }: { live: ArasLiveHaken }) {
  return (
    <div className="ar-live-liste" aria-live="polite">
      {live.sitzungen.map((s) => {
        const klingelt = !s.zeilen.length && /^(|waehlt|gewaehlt|klingelt)$/.test(s.zustand);
        const wer = s.probe ? "Du" : s.name || (s.personId ? `Kunde #${s.personId}` : "Kunde");
        const art = s.probe ? `Probe${s.gespielt ? ` · ${spielartText(s.gespielt)}` : ""}` : spielartText(s.spielart);
        const zustand = klingelt ? "klingelt …" : zustandText(s.zustand) || "läuft";
        return (
          <article key={s.callId} className={`ar-live${s.endet ? " endet" : ""}`} data-ki-sitzung={s.callId}>
            <header className="ar-live-kopf">
              <span className="ar-live-marke"><i aria-hidden="true" />Live</span>
              <b>{wer}</b>
              <span className="ar-live-art">{art}</span>
              <span className="ar-live-uhr" title="Dauer">{uhrText(s.seit)}</span>
              <span className="ar-live-zustand">{zustand}</span>
              <Welle aktiv={!klingelt && Date.now() - s.zuletztRede < 2500} />
            </header>
            {klingelt ? (
              <p className="ar-live-klingelt">{s.probe ? "Es klingelt bei dir — nimm ab, oder lehne am Handy ab." : "Es klingelt beim Kunden …"}</p>
            ) : s.zeilen.length ? (
              <Verlauf zeilen={s.zeilen} probe={s.probe} kompakt />
            ) : (
              <p className="ar-live-klingelt">Verbunden — gleich kommt der erste Satz.</p>
            )}
            {!klingelt ? (
              <footer className="ar-live-knoepfe">
                {!s.probe ? (
                  <button type="button" className="ar-knopf haupt" disabled={live.busy === s.callId || s.endet} title="Aras übergibt an dein Softphone." onClick={() => void live.uebernehmen(s)}>Übernehmen</button>
                ) : null}
                {s.probe ? (
                  <button type="button" className="ar-knopf rot" disabled={live.busy === s.callId || s.endet} onClick={() => void live.auflegen(s)} data-ar="auflegen">{s.endet ? "legt auf …" : "Auflegen"}</button>
                ) : (
                  <FrageKnopf klasse="rot" frage="Aras verabschiedet sich und legt auf. Jetzt?" ja="Auflegen" disabled={live.busy === s.callId || s.endet} onJa={() => void live.auflegen(s)} data="auflegen">{s.endet ? "legt auf …" : "Auflegen"}</FrageKnopf>
                )}
              </footer>
            ) : null}
          </article>
        );
      })}
      {live.meldung ? <p className={`ar-hinweis${live.meldung.rot ? " rot" : ""}`} role={live.meldung.rot ? "alert" : "status"}>{live.meldung.text}</p> : null}
    </div>
  );
}
