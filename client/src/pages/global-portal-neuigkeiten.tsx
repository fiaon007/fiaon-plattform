// ═══════════════════════════════════════════════════════════════════════════
// „NEU FÜR SIE" — DAS FENSTER BEIM ÖFFNEN DES GLOBAL-PORTALS (E-456, 29.10.2026)
//
// Justin: „… beim nächsten Login ein Pop-up, was aufkommt (natürlich im HIGH-END-Apple-Design), was ihn dann direkt
//          dahin weiterleitet — egal ob es die Nummer, die Gründung, die Adresse, der Agent, EIN, ITIN … ist."
//
// Ein Glasblatt in der Mitte (am Telefon ein Blatt von unten), dahinter das Portal weich abgedunkelt und unscharf.
// Genau EINE Neuigkeit: ihr Wert groß und dünn (die US-Nummer, die EIN …). Mehrere: je eine ruhige Zeile mit Titel,
// Satz und „Ansehen". Die Liste baut der Server (shared/fiaon-global-neuigkeiten.ts) — hier steht nur die Bühne.
//
// Tastatur: Esc schließt, Tab bleibt im Fenster, der Fokus kehrt danach dorthin zurück, wo er war. Bewegung nur
// über transform/opacity, und gar keine bei „Bewegung reduzieren".
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GLOBAL_NEUIGKEITEN_WOERTER, type GlobalNeuigkeit, type GlobalNeuigkeitZiel } from "@shared/fiaon-global-neuigkeiten";
import "@/styles/global-portal-neuigkeiten.css";

const ruhig = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FOKUSSIERBAR = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

export default function PortalNeuigkeiten({ liste, weitere, s, vorschau, onZiel, onZu }: {
  liste: GlobalNeuigkeit[]; weitere: number; s: "de" | "en"; vorschau: boolean;
  /** „Ansehen": Fenster zu (als gesehen vermerkt) und auf die Seite der Neuigkeit. */
  onZiel: (ziel: GlobalNeuigkeitZiel) => void;
  /** „Verstanden", Esc oder Klick daneben: Fenster zu (als gesehen vermerkt). */
  onZu: () => void;
}) {
  const w = GLOBAL_NEUIGKEITEN_WOERTER[s];
  const blatt = useRef<HTMLDivElement>(null);
  const [geht, setGeht] = useState(false);
  const eins = liste.length === 1 ? liste[0] : null;

  // Erst ausblenden, dann schließen — das Blatt sinkt sanft weg statt zu verschwinden.
  const schliessen = useCallback((danach: () => void) => {
    if (geht) return;
    if (ruhig()) { danach(); return; }
    setGeht(true);
    window.setTimeout(danach, 240);
  }, [geht]);

  useEffect(() => {
    const vorher = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const alt = { html: html.style.overflow, body: document.body.style.overflow };
    html.style.overflow = "hidden"; document.body.style.overflow = "hidden";
    const zeit = window.setTimeout(() => blatt.current?.focus({ preventScroll: true }), 30);
    return () => {
      window.clearTimeout(zeit);
      html.style.overflow = alt.html; document.body.style.overflow = alt.body;
      try { vorher?.focus?.({ preventScroll: true }); } catch { /* egal */ }
    };
  }, []);

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); schliessen(onZu); return; }
      if (e.key !== "Tab" || !blatt.current) return;
      // Der Fokus bleibt im Fenster: am Ende wieder vorn, vor dem Anfang wieder hinten.
      const ziele = Array.from(blatt.current.querySelectorAll<HTMLElement>(FOKUSSIERBAR));
      if (!ziele.length) { e.preventDefault(); return; }
      const erstes = ziele[0]; const letztes = ziele[ziele.length - 1];
      const aktiv = document.activeElement;
      if (e.shiftKey && (aktiv === erstes || aktiv === blatt.current)) { e.preventDefault(); letztes.focus(); }
      else if (!e.shiftKey && (aktiv === letztes || !blatt.current.contains(aktiv))) { e.preventDefault(); erstes.focus(); }
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [onZu, schliessen]);

  const adresse = (wert: string) => wert.includes("\n");

  return createPortal(
    <div className={`gpneu-schleier${geht ? " gpneu-geht" : ""}`} data-fiaon="portal-neuigkeiten"
      onMouseDown={(e) => { if (e.target === e.currentTarget) schliessen(onZu); }}>
      <div ref={blatt} className={`gpneu-blatt${eins ? " gpneu-eins" : ""}`} role="dialog" aria-modal="true"
        aria-labelledby="gpneu-titel" aria-describedby="gpneu-lead" tabIndex={-1}>
        <span className="gpneu-griff" aria-hidden="true" />
        <p className="gpneu-auge">FIAON Global</p>
        <h2 id="gpneu-titel" className="gpneu-titel">{w.titel}</h2>
        <p id="gpneu-lead" className="gpneu-lead">{eins ? w.leadEins : w.lead}</p>

        {eins ? (
          <div className="gpneu-buehne">
            {eins.gross && (
              <div className="gpneu-gross">
                <span className="gpneu-gross-titel">{eins.gross.titel}</span>
                <span className={`gpneu-gross-wert${adresse(eins.gross.wert) ? " gpneu-gross-adresse" : ""}`}>{eins.gross.wert}</span>
              </div>
            )}
            <p className="gpneu-eins-titel">{eins.handeln && <span className="gpneu-sr">{w.zuTun}: </span>}{eins.titel}</p>
            <p className="gpneu-eins-satz">{eins.satz}</p>
          </div>
        ) : (
          <ul className="gpneu-liste">
            {liste.map((n, i) => (
              <li key={n.id} className={`gpneu-zeile${n.handeln ? " gpneu-handeln" : ""}`} style={{ ["--i" as any]: i }}>
                <span className="gpneu-punkt" aria-hidden="true" />
                <div className="gpneu-text">
                  <b>{n.handeln && <span className="gpneu-sr">{w.zuTun}: </span>}{n.titel}</b>
                  <span>{n.satz}</span>
                </div>
                <button type="button" className="gpneu-link" onClick={() => schliessen(() => onZiel(n.ziel))}
                  aria-label={`${w.ansehen}: ${n.titel}`} data-fiaon={`neuigkeit-${n.art}`}>{w.ansehen}</button>
              </li>
            ))}
          </ul>
        )}
        {!eins && weitere > 0 && <p className="gpneu-weitere">{w.weitere(weitere)}</p>}

        <div className="gpneu-fuss">
          {eins ? (
            <>
              <button type="button" className="gpneu-leise" onClick={() => schliessen(onZu)}>{w.verstanden}</button>
              <button type="button" className="gpneu-haupt" onClick={() => schliessen(() => onZiel(eins.ziel))} data-fiaon={`neuigkeit-${eins.art}`}>{w.ansehen}</button>
            </>
          ) : (
            <button type="button" className="gpneu-haupt" onClick={() => schliessen(onZu)}>{w.verstanden}</button>
          )}
        </div>
        {vorschau && <p className="gpneu-vorschau" role="note">{w.vorschau}</p>}
      </div>
    </div>,
    document.body,
  );
}
