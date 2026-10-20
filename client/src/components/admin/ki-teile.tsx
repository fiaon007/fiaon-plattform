// ═══════════════════════════════════════════════════════════════════════════
// BAUSTEINE DES KI-RAUMS (E-409, 19.10.2026) — holen, senden, Takt, Leerzustand
//
// Jede Seite des Raums liest ihre Daten über `useTakt` (nur bei sichtbarem Tab,
// Takt je Seite) und schreibt über `senden`. `NichtVerbunden` ist der eine
// Leerzustand, den der Raum zeigt, solange Team 1 den Aras-Kern nicht angebunden hat.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { API } from "./chef-teile";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGAENGE } from "@/pages/agent/rundgaenge";
import "@/styles/office-rundgang.css";
import "@/styles/chef-ki.css";

export { API };
export const euro = (n: number | null | undefined) => `${Number(n ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
export const zahl = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("de-DE");
export const uhr = (s: string | null | undefined) => (s ? new Date(s).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—");
export const tagZeit = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }) : "—");
export const seitKurz = (s: string | null | undefined): string => {
  if (!s) return "—";
  const min = Math.round((Date.now() - new Date(s).getTime()) / 60_000);
  if (min < 1) return "gerade eben"; if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60); if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} T.`;
};

export class RouteFehler extends Error { constructor(public status: number, text: string, public daten: any = null) { super(text); } }

export async function holen<T = any>(pfad: string): Promise<T> {
  const r = await fetch(`${API}${pfad}`, { credentials: "include" });
  const j = await r.json().catch(() => null);
  if (r.status === 401) throw new RouteFehler(401, "Die Anmeldung ist abgelaufen — bitte neu anmelden.", j);
  if (!r.ok || (j && j.ok === false)) throw new RouteFehler(r.status, j?.fehler || j?.error || "Das ließ sich nicht laden.", j);
  return j as T;
}

export async function senden<T = any>(pfad: string, body: unknown = {}): Promise<T> {
  const r = await fetch(`${API}${pfad}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j?.ok) throw new RouteFehler(r.status, j?.fehler || j?.error || "Das hat nicht geklappt.", j);
  return j as T;
}

/**
 * Holt Daten im Takt — nur bei sichtbarem Tab; `neu()` lädt sofort. Der alte Stand bleibt beim Neuladen stehen.
 *
 * E-409 Fund 12 (20.10.2026): Eine Fehlerantwort ({ ok: false, fehler } — auch „Anmeldung abgelaufen“) wird NIE als Daten
 * übernommen; vorher landete sie in `daten`, und die Seiten stürzten bei d.mara.an / d.stand.heute ab. Die Seite behält den
 * letzten guten Stand und zeigt den Fehler (Stand-Zeile). Fund 13: Die Hintergrund-Bremse liest einen Ref — vorher stand im
 * Abschluss immer das `geladenAm` vom ersten Rendern (null), und ein versteckter Tab fragte trotzdem alle 30 s.
 */
export function useTakt<T = any>(pfad: string | null, ms = 30_000, abhaengig: unknown[] = []): { daten: T | null; fehler: string | null; status: number | null; laedt: boolean; neu: () => void; geladenAm: number | null } {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(pfad !== null);
  const [geladenAm, setGeladenAm] = useState<number | null>(null);
  const [runde, setRunde] = useState(0);
  const weg = useRef(false);
  const geladenRef = useRef<number | null>(null);
  useEffect(() => {
    weg.current = false;
    if (pfad === null) { setLaedt(false); return; }
    let uhrId = 0;
    const laden = async () => {
      // Versteckter Tab: nicht nachladen, sobald einmal etwas da ist (beim Zurückkommen lädt „visibilitychange“ sofort).
      if (document.visibilityState !== "visible" && geladenRef.current) return;
      try {
        const j = await holen<T>(pfad);
        if (weg.current) return;
        geladenRef.current = Date.now();
        setDaten(j); setFehler(null); setStatus(200); setGeladenAm(geladenRef.current);
      } catch (e) {
        if (weg.current) return;
        const f = e as RouteFehler;
        setFehler(f.message); setStatus(f.status ?? 0);
      } finally { if (!weg.current) setLaedt(false); }
    };
    void laden();
    if (ms > 0) uhrId = window.setInterval(() => void laden(), ms);
    const vorn = () => { if (document.visibilityState === "visible") void laden(); };
    document.addEventListener("visibilitychange", vorn);
    return () => { weg.current = true; if (uhrId) window.clearInterval(uhrId); document.removeEventListener("visibilitychange", vorn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pfad, ms, runde, ...abhaengig]);
  return { daten, fehler, status, laedt, neu: useCallback(() => setRunde((r) => r + 1), []), geladenAm };
}

/** Rückmeldung am Auslöser — verschwindet nach ein paar Sekunden. */
export function useMeldung(): { m: { text: string; art: "gut" | "fehler" } | null; gut: (t: string) => void; fehler: (t: string) => void } {
  const [m, setM] = useState<{ text: string; art: "gut" | "fehler" } | null>(null);
  useEffect(() => { if (!m) return; const t = window.setTimeout(() => setM(null), m.art === "gut" ? 3500 : 7000); return () => window.clearTimeout(t); }, [m]);
  return { m, gut: (text) => setM({ text, art: "gut" }), fehler: (text) => setM({ text, art: "fehler" }) };
}
export function Meldung({ m }: { m: { text: string; art: "gut" | "fehler" } | null }) {
  if (!m) return null;
  return <span className={`ki-meldung ${m.art}`} role={m.art === "fehler" ? "alert" : "status"}><span className={`ki-punkt ${m.art === "gut" ? "gut" : "krit"}`} aria-hidden="true" />{m.text}</span>;
}

/** Der Leerzustand, solange Aras nicht angebunden ist. */
export function NichtVerbunden({ was = "Aras" }: { was?: string }) {
  return (
    <div className="ki-leer" role="status">
      <b>{was} ist noch nicht verbunden.</b>
      Der Telefon-Kern (E-408) meldet sich hier an, sobald er läuft — dann füllt sich diese Ansicht von selbst.
    </div>
  );
}

export function Kopf({ titel, satz, kinder }: { titel: string; satz: string; kinder?: ReactNode }) {
  return (
    <header className="ki-kopf">
      <div><h1>{titel}</h1><p className="ki-satz">{satz}</p></div>
      {kinder ? <div className="ki-chips">{kinder}</div> : null}
    </header>
  );
}

export function Schalter({ an, label, title, busy, onChange }: { an: boolean; label: string; title?: string; busy?: boolean; onChange: (an: boolean) => void }) {
  return (
    <button type="button" className={`ki-schalter${an ? " an" : ""}`} aria-pressed={an} title={title} disabled={busy} onClick={() => onChange(!an)}>
      <span className="bahn" aria-hidden="true" /><span>{label}</span>
    </button>
  );
}

export function KiRundgang({ schluessel, raum }: { schluessel: keyof typeof RUNDGAENGE; raum: string }) {
  const r = RUNDGAENGE[schluessel];
  if (!r) return null;
  return <Rundgang raum={raum} titel={r.titel} schritte={r.schritte} />;
}

export function Fehler({ text, erneut }: { text: string; erneut?: () => void }) {
  return <div className="ki-leer" role="alert"><b>{text}</b>{erneut ? <button type="button" className="ki-knopf klein" onClick={erneut}>Nochmal</button> : null}</div>;
}

/** Zeile „Stand von …“ mit Neu-Knopf — mit `fehler` sagt sie, dass der gezeigte Stand nicht mehr frisch ist (Fund 12). */
export function Stand({ am, neu, fehler }: { am: number | null; neu: () => void; fehler?: string | null }) {
  return (
    <span className="ki-still ki-klein">
      {am ? `Stand ${new Date(am).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : "lädt …"}
      {fehler && am ? <span className="ki-krit-t" role="alert"> · nicht aktuell: {fehler}</span> : null}
      {" · "}<button type="button" className="ki-knopf text ki-klein" onClick={neu}>neu laden</button>
    </span>
  );
}
