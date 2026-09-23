// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — der TAN-Dialog (E-228)
//
// Wie bei einer Bank: Die TAN kommt per Mail an die eigene Adresse, die Mail
// nennt den Vorgang im Klartext, und hier steht derselbe Vorgang noch einmal.
// Stimmen beide nicht überein, soll niemand die TAN eingeben.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, Knopf, Meldung, Segmente, Zeichen } from "./ui";

export function TanDialog({ offen, titel, anfordern, bestaetigen, onZu, onFertig, knopf = "Mit TAN bestätigen" }: {
  offen: boolean;
  titel: string;
  anfordern: () => Promise<{ beschreibung: string; an: string }>;
  bestaetigen: (tan: string) => Promise<void>;
  onZu: () => void;
  onFertig: () => void;
  knopf?: string;
}) {
  const [phase, setPhase] = useState<"sendet" | "bereit" | "prueft" | "fertig">("sendet");
  const [beschreibung, setBeschreibung] = useState("");
  const [an, setAn] = useState("");
  const [tan, setTan] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [nochSek, setNochSek] = useState(300);

  // WICHTIG: Die Aufrufer übergeben `anfordern` als neue Funktion bei jedem
  // Rendern. Hinge die Anforderung an ihrer Identität, ginge bei jedem
  // Sekundentakt des Countdowns eine neue TAN-Mail raus. Deshalb eine Referenz,
  // und angefordert wird nur beim Öffnen und auf ausdrücklichen Wunsch.
  const anfordernRef = useRef(anfordern);
  anfordernRef.current = anfordern;
  const holen = useCallback(async () => {
    setPhase("sendet"); setFehler(null); setTan("");
    try {
      const r = await anfordernRef.current();
      setBeschreibung(r.beschreibung); setAn(r.an); setPhase("bereit"); setNochSek(300);
    } catch (e: any) { setFehler(e.message); setPhase("bereit"); }
  }, []);

  useEffect(() => { if (offen) void holen(); }, [offen, holen]);

  useEffect(() => {
    if (!offen || phase !== "bereit") return;
    const t = setInterval(() => setNochSek((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [offen, phase]);

  const pruefen = async () => {
    setPhase("prueft"); setFehler(null);
    try {
      await bestaetigen(tan);
      setPhase("fertig");
      setTimeout(onFertig, 700);
    } catch (e: any) { setFehler(e.message); setPhase("bereit"); setTan(""); }
  };

  return (
    <Dialog offen={offen} titel={titel} onZu={onZu}>
      <div className="bk-tan">
        <div className="bk-tan-siegel" aria-hidden="true"><Zeichen n="schloss" g={22} /></div>
        {phase === "sendet" ? (
          <p className="bk-tan-satz">TAN wird erzeugt und versendet …</p>
        ) : (
          <>
            {beschreibung ? (
              <div className="bk-tan-vorgang">
                <span className="bk-tan-l">Vorgang</span>
                <span className="bk-tan-w">{beschreibung}</span>
              </div>
            ) : null}
            <p className="bk-tan-satz">
              {an ? <>Die TAN ist an <strong>{an}</strong> unterwegs. Sie gilt nur für diesen Vorgang.</> : null}
            </p>
            <Segmente gruppen={[3, 3]} wert={tan} onWert={setTan} erlaubt={/[0-9]/} autoFocus beschriftung="TAN" />
            <div className="bk-tan-zeit">
              {phase === "fertig" ? <span className="bk-gut-text"><Zeichen n="haken" g={14} /> Bestätigt</span>
                : nochSek > 0 ? <>Gültig noch {Math.floor(nochSek / 60)}:{String(nochSek % 60).padStart(2, "0")}</>
                : <>Abgelaufen</>}
              <button type="button" className="bk-link-knopf" onClick={() => void holen()} disabled={phase === "prueft"}>Neue TAN anfordern</button>
            </div>
          </>
        )}
        {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}
        <div className="bk-tan-knoepfe">
          <Knopf art="still" onClick={onZu}>Abbrechen</Knopf>
          <Knopf art="primaer" zeichen="schloss" disabled={tan.length !== 6 || phase !== "bereit" || nochSek === 0} onClick={() => void pruefen()}>
            {phase === "prueft" ? "Prüfe …" : knopf}
          </Knopf>
        </div>
      </div>
    </Dialog>
  );
}
