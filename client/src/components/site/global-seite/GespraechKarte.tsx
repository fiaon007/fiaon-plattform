// ═══════════════════════════════════════════════════════════════════════════
// DAS ERSTGESPRÄCH AUF DEN UNTERSEITEN — ERST AUF WUNSCH (06.10.2026, E-293, Scheibe D)
//
// Bauplan Kapitel 5, Punkt 12: Bis heute stand auf jeder der 78 Unterseiten der
// volle Kalender (GlobalGespraech) — mit einer Anfrage an
// /api/fiaon/global/termine/frei bei jedem Aufruf, auch wenn niemand bis ganz
// nach unten liest. Jetzt steht dort eine ruhige Karte „Erstgespräch: dreißig
// Minuten, kostenfrei“ mit „Zeit wählen“; erst der Klick lädt den Kalender
// (dynamischer Import) an derselben Stelle. Jeder Weg zum Gespräch auf der
// Seite (Kopf, Tafel, Schlussband, Handyleiste) öffnet ihn ebenfalls, und wer
// mit #gespraech ankommt, sieht ihn sofort. Der Messpunkt
// werbeKonversion("gespraech") bleibt unverändert in GlobalGespraech.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useEffect, useRef } from "react";
import { Pfeil } from "@/components/site/global/GlobalTafel";
import { GLOBAL_SEITE_WOERTER } from "@/i18n/global-seite";

const GlobalGespraech = lazy(() => import("@/components/site/GlobalGespraech"));

export default function GespraechKarte({ sp, offen, onOeffnen, paket }: {
  sp: "de" | "en";
  offen: boolean;
  onOeffnen: () => void;
  paket?: string | null;
}) {
  const u = GLOBAL_SEITE_WOERTER[sp];
  const rahmen = useRef<HTMLDivElement>(null);
  // Nach dem Öffnen per Knopf landet der Fokus im Kalender — nicht wieder oben auf der Seite.
  const perKnopf = useRef(false);
  useEffect(() => {
    if (!offen || !perKnopf.current) return;
    const id = window.setTimeout(() => (rahmen.current?.querySelector("button, input, select, textarea") as HTMLElement | null)?.focus({ preventScroll: true }), 420);
    return () => window.clearTimeout(id);
  }, [offen]);

  if (offen) {
    return (
      <div ref={rahmen} className="fd-gespraech-kalender">
        <Suspense fallback={<div className="fd-gespraech-laedt" aria-busy="true" />}>
          <GlobalGespraech paket={paket} punkte={false} />
        </Suspense>
      </div>
    );
  }
  return (
    <div className="fd-gespraech-karte">
      <span className="fd-gespraech-zeichen" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.8V7.5 M15.5 3.8V7.5" /><path d="M12 12.6v2.6l1.8 1.1" />
        </svg>
      </span>
      <b>{u.gespraechKarte}</b>
      <button type="button" className="fg-knopf" onClick={() => { perKnopf.current = true; onOeffnen(); }}>{u.zeitWaehlen}<Pfeil /></button>
    </div>
  );
}
