// ═══════════════════════════════════════════════════════════════════════════
// VON HAND UNTERSCHREIBEN — das Fenster im Global-Portal (22.10.2026)
//
// Unser Registered-Agent-Partner verlangt für das IRS-Formular SS-4 (Kunden ohne
// SSN/ITIN) eine Unterschrift mit Tinte. Für diese Formulare gibt es deshalb NIE
// ein Zeichenfeld, sondern vier ruhige Schritte, mobil zuerst:
//   1 Herunterladen & prüfen → 2 Ausdrucken, unterschreiben, datieren →
//   3 Mit dem Handy als PDF scannen (Anleitungen iPhone/Android) → 4 Hier hochladen.
// Angenommen wird nur ein PDF — die Seite prüft den Dateikopf (%PDF-) schon vor dem
// Senden, der Server noch einmal. Alle Sätze: HANDSCHRIFT_WOERTER (shared/fiaon-global-akte.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { HANDSCHRIFT_SCAN_HILFE, HANDSCHRIFT_WOERTER, istPdfInhalt } from "@shared/fiaon-global-akte";

type T = Record<string, any>;

export default function HandschriftDialog({ dok, titel, oeffnenUrl, sendenUrl, s, vorschau, onFertig, onZu }: {
  dok: T; titel: string; oeffnenUrl: string; sendenUrl: string; s: "de" | "en"; vorschau: boolean; onFertig: () => void; onZu: () => void;
}) {
  const W = HANDSCHRIFT_WOERTER[s];
  const [datei, setDatei] = useState<File | null>(null);
  const [stand, setStand] = useState<"" | "laeuft" | "fertig">("");
  const [fehler, setFehler] = useState("");
  const eingabe = useRef<HTMLInputElement>(null);
  const zuKnopf = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape" && stand !== "laeuft") onZu(); };
    window.addEventListener("keydown", zu);
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => zuKnopf.current?.focus(), 40);
    return () => { window.removeEventListener("keydown", zu); document.body.style.overflow = ""; window.clearTimeout(t); };
  }, [onZu, stand]);

  /** Nur ein PDF: Dateikopf lesen, bevor etwas gesendet wird. Ein Foto bekommt den freundlichen Satz. */
  const waehlen = async (f: File | null) => {
    setFehler(""); setDatei(null);
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setFehler(W.zuGross); return; }
    const kopf = new Uint8Array(await f.slice(0, 8).arrayBuffer());
    if (!istPdfInhalt(kopf)) { setFehler(W.nurPdf); if (eingabe.current) eingabe.current.value = ""; return; }
    setDatei(f);
  };
  const hochladen = async () => {
    if (!datei || vorschau) return;
    setStand("laeuft"); setFehler("");
    try {
      const fd = new FormData(); fd.append("datei", datei);
      const r = await fetch(sendenUrl, { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setStand("fertig"); onFertig(); } else { setStand(""); setFehler(j.error || W.nurPdf); }
    } catch { setStand(""); setFehler(s === "en" ? "No connection — please try again." : "Keine Verbindung — bitte noch einmal."); }
  };

  return (
    <div className="gp-schleier gph-schleier" role="dialog" aria-modal="true" aria-labelledby="gph-titel" onMouseDown={(e) => { if (e.target === e.currentTarget && stand !== "laeuft") onZu(); }}>
      <div className="gp-dialog gph" data-fiaon="handschrift-dialog">
        <button ref={zuKnopf} type="button" className="gp-dialog-zu" onClick={onZu} aria-label={s === "en" ? "Close" : "Schließen"} disabled={stand === "laeuft"}>×</button>
        {stand === "fertig" ? (
          <div className="gp-fertig" role="status">
            <svg className="gp-haken-gross" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
            <h3>{W.fertigTitel}</h3>
            <p>{W.fertigText}</p>
            <button type="button" className="gp-knopf" onClick={onZu}>{s === "en" ? "Close" : "Schließen"}</button>
          </div>
        ) : (
          <>
            <span className="gp-auge">{W.titel}</span>
            <h3 id="gph-titel">{titel || dok.titel || dok.artText}</h3>
            <p className="gph-lead">{W.lead}</p>
            <ol className="gph-schritte">
              {W.schritte.map((x, i) => (
                <li key={x.titel} className={i === 3 && datei ? "bereit" : ""}>
                  <span className="gph-nr" aria-hidden="true">{i + 1}</span>
                  <div>
                    <b>{x.titel}</b>
                    <small>{x.text}</small>
                    {i === 0 && <a className="gp-knopf leise klein gph-weg" href={oeffnenUrl} target="_blank" rel="noopener">{W.herunterladen}</a>}
                    {i === 2 && (
                      <span className="gph-hilfe">
                        <a href={HANDSCHRIFT_SCAN_HILFE.iphone} target="_blank" rel="noopener noreferrer">{W.hilfeIphone}</a>
                        <a href={HANDSCHRIFT_SCAN_HILFE.android} target="_blank" rel="noopener noreferrer">{W.hilfeAndroid}</a>
                      </span>
                    )}
                    {i === 3 && (
                      <label className="gph-datei">
                        <input ref={eingabe} type="file" accept="application/pdf,.pdf" onChange={(e) => void waehlen(e.target.files?.[0] ?? null)} data-fiaon="handschrift-datei" />
                        <span>{datei ? datei.name : W.waehlen}</span>
                      </label>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {fehler && <p className="gp-meldung schlecht" role="alert">{fehler}</p>}
            {vorschau && <p className="gp-meldung" role="note">{W.vorschau}</p>}
            <button type="button" className="gp-knopf gross" disabled={!datei || vorschau || stand === "laeuft"} onClick={() => void hochladen()} data-fiaon="handschrift-hochladen">
              {stand === "laeuft" ? W.laeuft : W.hochladen}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
