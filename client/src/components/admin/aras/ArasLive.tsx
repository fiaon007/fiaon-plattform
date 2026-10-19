// ═══════════════════════════════════════════════════════════════════════════
// DIE LIVE-KARTE (E-409) — laufende Gespräche als Wellen, Transkript tickt mit
//
// SSE /chef/aras/live (Vertrag § 9): Ereignisse aras_* je Anruf und
// aras_transkript-Zeilen (nur über den Strom, nie in der DB — außer nach Aufnahme-Ja).
// Wiederverbindung mit Backoff; höchstens 5 Sitzungen; die Welle ist eine Canvas
// ohne Audio-Daten im Browser (Pegel = „gerade gesprochen“). Wellen pausieren im
// Hintergrund-Tab und stehen still bei „Bewegung reduzieren“.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { API, senden, useMeldung, Meldung, NichtVerbunden } from "../ki-teile";
import { SPIELART_TEXT, type ArasSpielart } from "./aras-teile";
import type { LiveSitzung } from "@shared/fiaon-ki-team";

interface Sitzung { callId: number; personId: number | null; spielart: ArasSpielart; seit: number; zustand: string; zeilen: { wer: "kunde" | "aras"; text: string }[]; zuletzt: number; name?: string | null }

function Welle({ aktiv }: { aktiv: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const ruhig = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let bild = 0, t = 0, laeuft = true;
    const zeichnen = () => {
      const w = c.width = c.clientWidth * (window.devicePixelRatio || 1), h = c.height = 44 * (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      const n = 36, bw = w / n;
      for (let i = 0; i < n; i++) {
        const amp = aktiv && !ruhig ? (0.25 + 0.75 * Math.abs(Math.sin(t / 9 + i * 0.55) * Math.cos(t / 23 + i * 0.3))) : 0.18;
        const bh = Math.max(2, amp * h * 0.9);
        ctx.fillStyle = aktiv ? "rgba(140, 194, 255, .85)" : "rgba(140, 194, 255, .35)";
        ctx.fillRect(i * bw + bw * 0.25, (h - bh) / 2, bw * 0.5, bh);
      }
      t++;
      if (laeuft && !ruhig && !document.hidden) bild = requestAnimationFrame(zeichnen);
    };
    const sicht = () => { if (!document.hidden && laeuft && !bild) bild = requestAnimationFrame(zeichnen); };
    document.addEventListener("visibilitychange", sicht);
    zeichnen();
    return () => { laeuft = false; if (bild) cancelAnimationFrame(bild); document.removeEventListener("visibilitychange", sicht); };
  }, [aktiv]);
  return <canvas ref={ref} aria-hidden="true" />;
}

export default function ArasLive({ verbunden, start, darfUebernehmen, onAenderung }: { verbunden: boolean; start: LiveSitzung[]; darfUebernehmen: boolean; onAenderung?: () => void }) {
  const [sitzungen, setSitzungen] = useState<Map<number, Sitzung>>(new Map());
  const [strom, setStrom] = useState<"offen" | "zu" | "nicht_verbunden">("zu");
  const [busy, setBusy] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const meld = useMeldung();
  // Startstand aus der Lage (Polling) — der Strom hält ihn danach aktuell.
  useEffect(() => {
    setSitzungen((alt) => {
      const neu = new Map(alt);
      for (const s of start) if (!neu.has(s.callId)) neu.set(s.callId, { callId: s.callId, personId: s.personId, spielart: s.spielart, seit: Date.now() - s.seitSek * 1000, zustand: s.zustand, zeilen: s.letzteZeilen ?? [], zuletzt: 0 });
      return neu;
    });
  }, [start]);
  useEffect(() => {
    if (!verbunden) { setStrom("nicht_verbunden"); return; }
    let es: EventSource | null = null, versuch = 0, zu = false, timer = 0;
    const verbinden = () => {
      if (zu) return;
      es = new EventSource(`${API}/chef/aras/live`, { withCredentials: true });
      es.onopen = () => { versuch = 0; setStrom("offen"); };
      es.addEventListener("aras", (ev: MessageEvent) => {
        let e: any; try { e = JSON.parse(ev.data); } catch { return; }
        if (e.art === "nicht_verbunden") { setStrom("nicht_verbunden"); return; }
        if (e.art === "herzschlag" || e.art === "verbunden") return;
        const id = Number(e.callId); if (!id) return;
        setSitzungen((alt) => {
          const neu = new Map(alt);
          const s: Sitzung = neu.get(id) ?? { callId: id, personId: e.personId ?? null, spielart: (e.spielart ?? "probe") as ArasSpielart, seit: Date.now(), zustand: "laeuft", zeilen: [], zuletzt: 0 };
          const werZ: "kunde" | "aras" = e.wer === "kunde" ? "kunde" : "aras";
          if (e.art === "aras_transkript") { s.zeilen = [...s.zeilen, { wer: werZ, text: String(e.text ?? "") }].slice(-6); s.zuletzt = Date.now(); }
          else if (e.art === "aras_ende" || e.art === "aras_mailbox" || e.art === "aras_notaus") { neu.delete(id); onAenderung?.(); return neu; }
          else { s.zustand = String(e.art).replace(/^aras_/, ""); if (e.text) { s.zeilen = [...s.zeilen, { wer: "aras" as const, text: String(e.text) }].slice(-6); } }
          neu.set(id, s);
          return neu;
        });
      });
      es.onerror = () => { es?.close(); setStrom("zu"); versuch++; timer = window.setTimeout(verbinden, Math.min(30_000, 1000 * 2 ** versuch)); };
    };
    verbinden();
    const uhr = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => { zu = true; es?.close(); window.clearTimeout(timer); window.clearInterval(uhr); };
  }, [verbunden, onAenderung]);
  const liste = Array.from(sitzungen.values()).slice(0, 5);
  const tun = async (s: Sitzung, was: "uebernehmen" | "beenden") => {
    if (was === "beenden" && !window.confirm("Dieses Gespräch beenden? Aras verabschiedet sich mit einem Satz.")) return;
    setBusy(s.callId);
    try { await senden(`/chef/aras/live/${s.callId}/${was}`, { grund: "Chefbüro" }); meld.gut(was === "uebernehmen" ? "Dein Softphone klingelt gleich." : "Beendet."); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <section className="ki-buehne" data-ki="live" aria-label="Laufende Gespräche">
      <div className="ki-chips" style={{ marginBottom: 12 }}>
        <span className="ki-etikett">Live</span>
        <span className={`ki-pille ${strom === "offen" ? "gut" : strom === "nicht_verbunden" ? "" : "warn"}`}><span className={`ki-punkt ${strom === "offen" ? "gut" : strom === "nicht_verbunden" ? "" : "warn"}`} aria-hidden="true" />{strom === "offen" ? "Strom verbunden" : strom === "nicht_verbunden" ? "kein Strom" : "verbindet …"}</span>
        <span className="ki-still ki-klein">{liste.length} {liste.length === 1 ? "Gespräch" : "Gespräche"}</span>
      </div>
      {!verbunden ? <NichtVerbunden /> : liste.length === 0 ? <div className="ki-leer"><b>Gerade kein Gespräch.</b>Sobald Aras wählt, erscheint hier jede Sitzung als Welle mit Transkript.</div> : (
        <div className="ki-live">
          {liste.map((s) => {
            const sek = Math.max(0, Math.round((Date.now() - s.seit) / 1000));
            return (
              <article key={s.callId} className="ki-sitzung" data-ki-sitzung={s.callId}>
                <div className="ki-chips"><b className="ki-leise">{SPIELART_TEXT[s.spielart] ?? s.spielart}</b><span className="ki-still ki-klein">{Math.floor(sek / 60)}:{String(sek % 60).padStart(2, "0")} · {s.zustand}</span>{s.personId ? <span className="ki-still ki-klein">#{s.personId}</span> : null}</div>
                <Welle aktiv={Date.now() - s.zuletzt < 2500} />
                <div className="ki-ticker" aria-live="polite">
                  {s.zeilen.length ? s.zeilen.map((z, i) => <p key={i}><b>{z.wer === "kunde" ? "Kunde" : "Aras"}:</b> {z.text}</p>) : <p className="ki-still">…</p>}
                </div>
                <div className="ki-sitzung-knoepfe">
                  {darfUebernehmen ? <button type="button" className="ki-knopf klein haupt" disabled={busy === s.callId} onClick={() => tun(s, "uebernehmen")} title="Aras übergibt an dein Softphone.">Übernehmen</button> : null}
                  <button type="button" className="ki-knopf klein krit" disabled={busy === s.callId} onClick={() => tun(s, "beenden")}>Beenden</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <Meldung m={meld.m} />
    </section>
  );
}
