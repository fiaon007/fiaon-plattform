// ═══════════════════════════════════════════════════════════════════════════
// VERKAUFSMOTOR (E-509) — was Startseite und Konfigurator vom Server brauchen
//
// GET /api/fiaon/global/verkauf liefert den Kurs (damit der Preis hier mit demselben Kurs rechnet wie der Vertrag),
// das Zeit-Siegel für das Absenden und „an“: Entsteht für DIESEN Besucher am Ende sofort ein Angebot (true) oder geht
// seine Anfrage den persönlichen Weg (false — Notschalter oder Probebetrieb; die Seite sagt dann nirgends „Ihr Angebot
// öffnet sich sofort“). Bis die Antwort da ist, rechnet die Seite mit dem Rückfall-Kurs aus
// shared/fiaon-global-verkauf.ts — derselbe Wert, den der Server ohne eigene Einstellung nimmt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { VERKAUF_KURS_VORGABE, VERKAUF_RAHMEN } from "@shared/fiaon-global-verkauf";

export interface VerkaufSicht {
  geladen: boolean;
  an: boolean;
  kursUsdJeEur: number;
  kursDatum: string;
  selbstMaxUsd: number;
  siegel: string;
}
const START: VerkaufSicht = {
  geladen: false, an: false, kursUsdJeEur: VERKAUF_KURS_VORGABE.kursUsdJeEur, kursDatum: VERKAUF_KURS_VORGABE.kursDatum,
  selbstMaxUsd: VERKAUF_RAHMEN.selbstMaxUsd, siegel: "",
};

let laeuft: Promise<VerkaufSicht> | null = null;
function holen(): Promise<VerkaufSicht> {
  return fetch("/api/fiaon/global/verkauf", { credentials: "same-origin", cache: "no-store" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d): VerkaufSicht => ({
      geladen: true, an: d?.an === true,
      kursUsdJeEur: Number(d?.kursUsdJeEur) > 0 ? Number(d.kursUsdJeEur) : START.kursUsdJeEur,
      kursDatum: /^\d{4}-\d{2}-\d{2}$/.test(String(d?.kursDatum ?? "")) ? String(d.kursDatum) : START.kursDatum,
      selbstMaxUsd: Number(d?.selbstMaxUsd) > 0 ? Number(d.selbstMaxUsd) : START.selbstMaxUsd,
      siegel: String(d?.siegel ?? ""),
    }));
}

/** Die Einstellung des Verkaufsmotors — einmal je Seitenaufruf geladen, mit `neu()` für ein frisches Siegel. */
export function useVerkaufSicht(): { sicht: VerkaufSicht; neu: () => Promise<VerkaufSicht> } {
  const [sicht, setSicht] = useState<VerkaufSicht>(START);
  const lebt = useRef(true);
  useEffect(() => {
    lebt.current = true;
    laeuft ??= holen();
    laeuft.then((s) => { if (lebt.current) setSicht(s); }).catch(() => { laeuft = null; });
    return () => { lebt.current = false; };
  }, []);
  const neu = () => {
    laeuft = holen();
    return laeuft.then((s) => { if (lebt.current) setSicht(s); return s; });
  };
  return { sicht, neu };
}

/** „06.11.2026“ / „6 November 2026“ */
export function verkaufTag(iso: string, en: boolean): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  if (!en) return `${m[3]}.${m[2]}.${m[1]}`;
  const monate = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${Number(m[3])} ${monate[Number(m[2]) - 1]} ${m[1]}`;
}
/** „1,1165“ / „1.1165“ */
export function verkaufKurs(kurs: number, en: boolean): string {
  return kurs.toLocaleString(en ? "en-GB" : "de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
