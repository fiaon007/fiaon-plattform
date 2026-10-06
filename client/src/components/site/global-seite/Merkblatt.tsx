// ═══════════════════════════════════════════════════════════════════════════
// DAS MERKBLATT ALS KARTEIKARTE (06.10.2026, E-293, Scheibe D)
//
// Bauplan Kapitel 5, Punkt 2: Das Merkblatt „Auf einen Blick“ stand mit sechs
// bis sieben Zeilen offen im Kopf jeder Unterseite — zusammen mit Lead, Ziffern
// und „Kurz beantwortet“ 153–254 Wörter, bevor der erste Abschnitt begann.
// Jetzt ist es eine Karteikarte: Kennung, drei Zeilen, der Rest hinter „Alle
// Angaben“; Stand und Companies House im Kartenfuß. Am Handy ist die ganze
// Karte zugeklappt — eine Zeile „Auf einen Blick · {n} Punkte“; geöffnet zeigt
// sie dort alle Punkte auf einmal (keine Klappe in der Klappe).
//
// Alles bleibt im DOM (<details>, nie display:none für Inhalt). Ein einziges
// <details>: am Desktop offen und nicht zuklappbar (die Kopfzeile ist dann nur
// Beschriftung), am Handy zu. Der Wechsel folgt der Breite (matchMedia).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";

const BREIT = "(min-width: 1021px)";
const SICHTBAR = 3;

export default function Merkblatt({ titel, kennung, zeilen, alle, punkte, stand, firma }: {
  /** „Auf einen Blick“ */
  titel: string;
  kennung: string;
  zeilen: [string, string][];
  /** „Alle Angaben“ */
  alle: string;
  /** „Auf einen Blick · {n} Punkte“ */
  punkte: string;
  /** „Stand 6. Oktober 2026“ */
  stand: string;
  /** „FIAON LTD · Companies House 17318250“ */
  firma: string;
}) {
  const [breit, setBreit] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.(BREIT).matches);
  const [mobilOffen, setMobilOffen] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(BREIT);
    if (!mq) return;
    const neu = () => setBreit(mq.matches);
    mq.addEventListener?.("change", neu);
    return () => mq.removeEventListener?.("change", neu);
  }, []);
  const offen = breit || mobilOffen;
  const zeile = ([k, v]: [string, string]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>;

  return (
    <details className={`fd-karteikarte${breit ? " breit" : ""}`} open={offen}
      onToggle={(e) => { if (!breit) setMobilOffen((e.currentTarget as HTMLDetailsElement).open); }}>
      <summary aria-label={breit ? titel : undefined} tabIndex={breit ? -1 : undefined}
        onClick={(e) => { if (breit) e.preventDefault(); }}>
        <b className="gross">{titel}</b>
        <b className="klein">{punkte}</b>
        <span className="kennung">{kennung}</span>
      </summary>
      {/* 06.10.2026 (E-293): Am Handy hat die Karte selbst schon „Auf einen Blick · {n} Punkte“ geöffnet — dort stehen
          alle Zeilen in einem dl, keine zweite Klappe. „Alle Angaben“ gibt es nur am Desktop, wo die Karte immer offen ist. */}
      <dl>{(breit ? zeilen.slice(0, SICHTBAR) : zeilen).map(zeile)}</dl>
      {breit && zeilen.length > SICHTBAR && (
        <details className="fd-karteikarte-mehr">
          <summary>{alle}</summary>
          <dl>{zeilen.slice(SICHTBAR).map(zeile)}</dl>
        </details>
      )}
      <div className="fd-karteikarte-fuss"><span>{stand}</span><span>{firma}</span></div>
    </details>
  );
}
