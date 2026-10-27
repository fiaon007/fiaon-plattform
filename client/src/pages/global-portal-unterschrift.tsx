// ═══════════════════════════════════════════════════════════════════════════
// DIGITAL UNTERSCHREIBEN — das Fenster im Global-Portal (22.10.2026)
//
// Justin: „So einfach wie möglich für den Kunden.“ Kein Zeichenfeld, kein
// Fremdanbieter. Vier ruhige Schritte, mobil als Blatt von unten:
//   1 Lesen (das Dokument im Fenster, auch in neuem Tab)
//   2 Zustimmen (elektronische Dokumente und Unterschriften, mit Hinweis)
//   3 Name (vorbelegt, muss zum Dokument passen) → „Unterschreiben“
//   4 Code aus der E-Mail → fertig: unterschriebene Fassung mit Zertifikat im Tresor.
// Alle Sätze: UNTERSCHRIFT_WOERTER (shared/fiaon-global-unterschrift.ts) — dieselben,
// die der Server in den Nachweis schreibt (Fassung ESIGN_FASSUNG).
// IRS-Formulare kommen hier nie an (Portal wählt den Weg, der Server lehnt zusätzlich ab).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { UNTERSCHRIFT_WOERTER, namePasst } from "@shared/fiaon-global-unterschrift";
import "@/styles/global-portal-unterschrift.css";

type T = Record<string, any>;

async function post(url: string, body: unknown): Promise<{ ok: boolean; [k: string]: any }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? j : { ok: false, error: j.error || `Fehler ${r.status}` };
  } catch { return { ok: false, error: "" }; }
}

export default function UnterschriftDigital({ dok, titel, ansichtUrl, startUrl, codeNeuUrl, sendenUrl, namen, s, vorschau, onFertig, onZu }: {
  dok: T; titel: string; ansichtUrl: string; startUrl: string; codeNeuUrl: string; sendenUrl: string; namen: string[];
  s: "de" | "en"; vorschau: boolean; onFertig: () => void; onZu: () => void;
}) {
  const W = UNTERSCHRIFT_WOERTER[s];
  const keineVerbindung = s === "en" ? "No connection — please try again." : "Keine Verbindung — bitte noch einmal.";
  const [zustimmung, setZustimmung] = useState(false);
  const [hinweisAuf, setHinweisAuf] = useState(false);
  const [name, setName] = useState(namen[0] ?? "");
  const [schritt, setSchritt] = useState<"form" | "code" | "fertig">("form");
  const [vorgang, setVorgang] = useState("");
  const [maske, setMaske] = useState("");
  const [code, setCode] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [meldung, setMeldung] = useState("");
  const [wartenBis, setWartenBis] = useState(0);
  const [jetzt, setJetzt] = useState(Date.now());
  const zuKnopf = useRef<HTMLButtonElement>(null);
  const codeFeld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const zu = (e: KeyboardEvent) => { if (e.key === "Escape" && !laeuft) onZu(); };
    window.addEventListener("keydown", zu);
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => zuKnopf.current?.focus(), 40);
    return () => { window.removeEventListener("keydown", zu); document.body.style.overflow = ""; window.clearTimeout(t); };
  }, [onZu, laeuft]);
  useEffect(() => {
    if (schritt !== "code") return;
    const t = window.setInterval(() => setJetzt(Date.now()), 1000);
    window.setTimeout(() => codeFeld.current?.focus(), 60);
    return () => window.clearInterval(t);
  }, [schritt]);

  const namePasstEiner = namen.length === 0 || namen.some((n) => namePasst(name, n));
  const darf = !vorschau && zustimmung && name.trim().split(/\s+/).length >= 2 && namePasstEiner && !laeuft;

  const starten = async () => {
    if (!darf) return;
    setLaeuft(true); setFehler(""); setMeldung("");
    const j = await post(startUrl, { zustimmung: true, name: name.trim() });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || keineVerbindung); return; }
    setVorgang(String(j.vorgang)); setMaske(String(j.maske)); setCode(""); setSchritt("code"); setJetzt(Date.now()); setWartenBis(Date.now() + 60_000);
  };
  const neuSenden = async () => {
    setLaeuft(true); setFehler(""); setMeldung("");
    const j = await post(codeNeuUrl, { vorgang });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || keineVerbindung); return; }
    setMeldung(String(j.meldung || W.codeNeuOk)); setJetzt(Date.now()); setWartenBis(Date.now() + 60_000);
  };
  const bestaetigen = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6 || laeuft) return;
    setLaeuft(true); setFehler(""); setMeldung("");
    const j = await post(sendenUrl, { vorgang, code: c });
    setLaeuft(false);
    if (!j.ok) { setFehler(j.error || keineVerbindung); setCode(""); return; }
    setSchritt("fertig"); onFertig();
  };
  const restSek = Math.max(0, Math.ceil((wartenBis - jetzt) / 1000));
  // 1 Lesen · 2 Zustimmen · 3 Name · 4 Code — mit der Zustimmung ist Schritt 3 dran, mit dem Code Schritt 4.
  const stufe = schritt === "form" ? (zustimmung ? 3 : 1) : schritt === "code" ? 4 : 5;

  return (
    <div className="gp-schleier gph-schleier" role="dialog" aria-modal="true" aria-labelledby="gpu-titel" onMouseDown={(e) => { if (e.target === e.currentTarget && !laeuft) onZu(); }}>
      <div className="gp-dialog gph gpu" data-fiaon="signatur-dialog">
        <button ref={zuKnopf} type="button" className="gp-dialog-zu" onClick={onZu} aria-label={s === "en" ? "Close" : "Schließen"} disabled={laeuft}>×</button>
        {schritt === "fertig" ? (
          <div className="gp-fertig" role="status" data-fiaon="signatur-fertig">
            <svg className="gp-haken-gross" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" /><path d="M15 27 l7 7 l15 -16" /></svg>
            <h3>{W.fertigTitel}</h3>
            <p>{W.fertigText}</p>
            <button type="button" className="gp-knopf" onClick={onZu}>{s === "en" ? "Close" : "Schließen"}</button>
          </div>
        ) : (
          <>
            <span className="gp-auge">{W.titel}</span>
            <h3 id="gpu-titel">{titel || dok.titel || dok.artText}</h3>
            <ol className="gpu-stufen" aria-label={s === "en" ? "Steps" : "Schritte"}>
              {W.schritte.map((x, i) => <li key={x} className={i + 1 < stufe ? "fertig" : i + 1 === stufe ? "jetzt" : ""}><i aria-hidden="true">{i + 1}</i>{x}</li>)}
            </ol>

            {schritt === "form" && (
              <>
                <div className="gpu-dok">
                  <iframe src={ansichtUrl} title={titel} />
                  <a href={ansichtUrl} target="_blank" rel="noopener" className="gp-link">{W.oeffnen}</a>
                </div>
                <p className="gpu-leise">{W.lesen}</p>
                <label className="gp-haken gpu-zustimmung">
                  <input type="checkbox" checked={zustimmung} onChange={(e) => setZustimmung(e.target.checked)} data-fiaon="signatur-zustimmung" />
                  <span>{W.zustimmung}</span>
                </label>
                <button type="button" className="gpu-hinweis-knopf" aria-expanded={hinweisAuf} onClick={() => setHinweisAuf((x) => !x)}>{W.hinweisTitel}</button>
                {hinweisAuf && <ul className="gpu-hinweis">{W.hinweis.map((h) => <li key={h}>{h}</li>)}</ul>}
                <label className="gp-feldname">{W.name}
                  <input className="gp-eingabe" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} data-fiaon="signatur-name" aria-invalid={!namePasstEiner} />
                  <small className="gpu-leise">{namePasstEiner ? W.nameHilfe : W.nameFalsch(namen.join(s === "en" ? " or " : " oder "))}</small>
                </label>
                {name.trim() && (
                  <div className="gpu-vorschau" aria-hidden="true"><span>/s/ {name.trim()}</span></div>
                )}
                {fehler && <p className="gp-meldung schlecht" role="alert">{fehler}</p>}
                {vorschau && <p className="gp-meldung" role="note">{W.vorschau}</p>}
                <button type="button" className="gp-knopf gross" disabled={!darf} onClick={() => void starten()} data-fiaon="signatur-unterschreiben">
                  {laeuft ? W.laeuft : W.unterschreiben}
                </button>
              </>
            )}

            {schritt === "code" && (
              <form className="gpu-code" onSubmit={(e) => { e.preventDefault(); void bestaetigen(); }}>
                <p>{W.codeText(maske)}</p>
                <label className="gp-feldname">{W.codeEingabe}
                  <input ref={codeFeld} className="gp-eingabe gpu-code-feld" value={code} inputMode="numeric" autoComplete="one-time-code" maxLength={7}
                    onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} data-fiaon="signatur-code" />
                </label>
                {fehler && <p className="gp-meldung schlecht" role="alert">{fehler}</p>}
                {meldung && <p className="gp-meldung" role="status">{meldung}</p>}
                <button type="submit" className="gp-knopf gross" disabled={code.replace(/\D/g, "").length !== 6 || laeuft} data-fiaon="signatur-bestaetigen">
                  {laeuft ? W.laeuft : W.bestaetigen}
                </button>
                <button type="button" className="gpu-hinweis-knopf" disabled={restSek > 0 || laeuft} onClick={() => void neuSenden()}>
                  {restSek > 0 ? `${W.neuSenden} (${restSek})` : W.neuSenden}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
