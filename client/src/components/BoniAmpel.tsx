// ═══════════════════════════════════════════════════════════════════════════
// BONI-AMPEL — die Anzeige (21.09.2026, E-202)
//
// Eine kleine Ampel mit leuchtendem Licht, die Stufe in Worten und die
// Punktzahl; aufgeklappt die fünf Teile als Balken — jeweils mit der Herkunft
// (Kontoauszug, SCHUFA, Antrag oder Annahme), damit niemand eine Annahme für
// einen Beleg hält. Die Rechnung steht in shared/fiaon-boni-ampel.ts.
//
// Zwei Einsätze: in der Telefonkartei auf jeder Karte (BoniAmpelBlock, klappt
// in der Karte auf) und im Kopf der Mitarbeiter-Akte (BoniAmpelAkte, lädt
// selbst und zeigt die Teile in einem Fenster über der Akte).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BONI_QUELLE_TEXT, type BoniAmpel, type BoniTeil } from "@shared/fiaon-boni-ampel";
import "@/styles/boni-ampel.css";

const LICHTER = ["rot", "gelb", "gruen"] as const;

/** Der Ton eines Teils — nach seinem Anteil an den 20 Punkten. */
function teilTon(t: BoniTeil): "gruen" | "gelb" | "rot" {
  const q = t.punkte / 20;
  return q >= 0.8 ? "gruen" : q >= 0.55 ? "gelb" : "rot";
}

export function BoniAmpelKapsel({ ampel, offen, onClick, titel, klein }: {
  ampel: BoniAmpel; offen?: boolean; onClick?: () => void; titel?: string;
  /** Kompakt für Kopfzeilen mit kleinen Marken (Akte im Office). */
  klein?: boolean;
}) {
  const inhalt = (
    <>
      <span className="ba-gehaeuse" aria-hidden="true">
        {LICHTER.map((l) => <i key={l} className={`ba-licht ${l}${ampel.farbe === l ? " an" : ""}`} />)}
      </span>
      <span className="ba-text">
        <b>{ampel.label}</b>
        <small>{klein ? ampel.punkte : `Boni ${ampel.punkte}`}{ampel.geschaetzt ? " · geschätzt" : ""}</small>
      </span>
      {onClick && (
        <svg className={`ba-pfeil${offen ? " offen" : ""}`} viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      )}
    </>
  );
  const klasse = `ba-kapsel ${ampel.farbe}${klein ? " klein" : ""}`;
  const hilfe = titel ?? `FIAON Boni-Ampel: ${ampel.label}, ${ampel.punkte} von 100 Punkten`;
  return onClick
    ? <button type="button" className={klasse} onClick={onClick} aria-expanded={!!offen} title={hilfe}>{inhalt}</button>
    : <span className={klasse} title={hilfe}>{inhalt}</span>;
}

export function BoniAmpelDetails({ ampel }: { ampel: BoniAmpel }) {
  return (
    <div className="ba-details">
      <p className="ba-satz">{ampel.satz}</p>
      <ul className="ba-teile">
        {ampel.teile.map((t) => (
          <li key={t.key} className={teilTon(t)}>
            <div className="ba-zeile">
              <b>{t.label}</b>
              <span className="ba-balken" aria-hidden="true"><i style={{ width: `${Math.round((t.punkte / 20) * 100)}%` }} /></span>
              <em>{t.punkte}/20</em>
            </div>
            <p>
              {t.text} <span className={`ba-quelle ${t.quelle}`}>{BONI_QUELLE_TEXT[t.quelle]}</span>
            </p>
          </li>
        ))}
      </ul>
      {ampel.deckel && <p className="ba-deckel">{ampel.deckel}</p>}
      <p className="ba-fuss">
        {ampel.belegt} von 5 Teilen aus Angaben oder Belegen · FIAONs eigene Einschätzung, keine Kreditentscheidung
      </p>
    </div>
  );
}

/** Für die Karte der Telefonkartei: Kapsel, die in der Karte aufklappt. */
export function BoniAmpelBlock({ ampel }: { ampel: BoniAmpel }) {
  const [offen, setOffen] = useState(false);
  return (
    <div className={`ba-block${offen ? " offen" : ""}`}>
      <BoniAmpelKapsel ampel={ampel} offen={offen} onClick={() => setOffen((o) => !o)} />
      {offen && <BoniAmpelDetails ampel={ampel} />}
    </div>
  );
}

/**
 * Für den Kopf der Mitarbeiter-Akte: lädt die Ampel selbst
 * (GET /agent/kunden/:personId/boni-ampel) und zeigt die Teile in einem
 * Fenster über der Akte — der Kopf ist ein klebender Block, darin wäre für
 * fünf Balken kein Platz.
 */
export function BoniAmpelAkte({ personId, name }: { personId: number; name: string }) {
  const [ampel, setAmpel] = useState<BoniAmpel | null>(null);
  const [offen, setOffen] = useState(false);
  useEffect(() => {
    let weg = false;
    setAmpel(null);
    fetch(`/api/fiaon/agent/kunden/${personId}/boni-ampel`, { credentials: "include" })
      .then((r) => r.json().catch(() => null))
      .then((j) => { if (!weg && j?.ok) setAmpel(j.ampel as BoniAmpel); })
      .catch(() => null);
    return () => { weg = true; };
  }, [personId]);
  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(false); };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [offen]);
  if (!ampel) return null;
  return (
    <>
      <BoniAmpelKapsel ampel={ampel} offen={offen} onClick={() => setOffen(true)} klein />
      {offen && typeof document !== "undefined" && createPortal(
        <div className="ba-schleier" role="dialog" aria-modal="true" aria-label={`Boni-Ampel ${name}`} onClick={() => setOffen(false)}>
          <div className="ba-fenster" onClick={(e) => e.stopPropagation()}>
            <div className="ba-fenster-kopf">
              <div>
                <span>Boni-Ampel</span>
                <b>{name}</b>
              </div>
              <button type="button" className="ba-zu" onClick={() => setOffen(false)} aria-label="Schließen">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            </div>
            <BoniAmpelKapsel ampel={ampel} />
            <BoniAmpelDetails ampel={ampel} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
