// ═══════════════════════════════════════════════════════════════════════════
// Schritt 8 · Die persönliche FIAON-PIN (05.10.2026, E-282)
//
// Justin: „Nach der Bonitätsprüfung soll der Kunde einen 4-stelligen
// persönlichen Code auswählen (mach daraus eine coole Animation)."
//
// Ablauf: vier Ziffern wählen → zur Bestätigung noch einmal → gespeichert.
// Jede Ziffer fällt als Punkt in ihre Zelle (mit Lichtwelle), die Karte oben
// blitzt kurz auf. Passt die Bestätigung nicht, schütteln die Zellen. Zum
// Schluss schließen sich die Zellen nacheinander, ein Schloss erscheint, ein
// Lichtring läuft aus, und die Karte leuchtet warm.
//
// Am Handy eine eigene Zifferntastatur (kein System-Tastenfeld, kein Zoom), am
// Computer die Tastatur. Die PIN verlässt den Browser genau einmal (POST) und
// wird nirgends gemerkt. Sie ist KEINE Karten-PIN — so steht es auch hier.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { pinPruefen } from "@shared/fiaon-antrag-neu";
import { Ico, Knopf, Lead, Titel, useAntrag } from "./bausteine";
import { api } from "./api";

type Phase = "waehlen" | "bestaetigen" | "speichert" | "gesichert";

export function SchrittPin() {
  const { S, setze, gehe, buehne, sitzung, ereignis, ruhig, lichtStreif } = useAntrag();
  const [phase, setPhase] = useState<Phase>(S.pinGesetzt ? "gesichert" : "waehlen");
  const [ziffern, setZiffern] = useState("");
  const [meldung, setMeldung] = useState<{ text: string; fehler: boolean } | null>(null);
  const [schuetteln, setSchuetteln] = useState(false);
  const [zeigen, setZeigen] = useState(false);
  const [feier, setFeier] = useState(false);
  const erste = useRef("");
  // Die Ziffern auch als Ref: Schnelle Tipps zwischen zwei Renders sehen sonst einen alten Stand.
  const zifRef = useRef("");
  // Nach der vierten Ziffer bis zum Leeren keine Eingabe — sonst bestätigte ein fünfter Tipp
  // die eben gewählte PIN gleich selbst (oder speicherte sie doppelt).
  const sperre = useRef(false);
  // Ging eine frühere Speicherung ohne Antwort verloren? Dann kann schon eine PIN gelten.
  const versucht = useRef(false);
  const [schon, setSchon] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);
  const beruehrung = useMemo(() => { try { return window.matchMedia("(pointer: coarse)").matches; } catch { return false; } }, []);
  const geburt = { tag: Number(S.gt) || undefined, monat: Number(S.gm) || undefined, jahr: Number(S.gj) || undefined };
  const fertigZeit = useRef<number | null>(null);

  useEffect(() => {
    if (!beruehrung && phase !== "gesichert") setTimeout(() => { try { eingabe.current?.focus({ preventScroll: true }); } catch { /* egal */ } }, 450);
    return () => { if (fertigZeit.current) clearTimeout(fertigZeit.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leeren = () => { zifRef.current = ""; setZiffern(""); sperre.current = false; };

  const fehler = (text: string, detail: string) => {
    setMeldung({ text, fehler: true });
    setSchuetteln(false);
    requestAnimationFrame(() => setSchuetteln(true));
    setTimeout(() => setSchuetteln(false), 560);
    setTimeout(leeren, 380);
    ereignis("fehler", { schritt: "pin", detail });
    try { navigator.vibrate?.(70); } catch { /* egal */ }
  };

  const speichern = async (pin: string) => {
    if (!S.ref) return;
    setPhase("speichert");
    setMeldung({ text: "Ihre PIN wird gesichert …", fehler: false });
    const r = await api.pin(S.ref, pin, sitzung);
    // „schon": Es gilt bereits eine PIN (zweiter Tab, oder eine frühere Speicherung kam an, ihre Antwort nicht).
    let lage: "neu" | "schon" | "fehler" = r.ok ? ((r.json as any)?.schon ? "schon" : "neu") : "fehler";
    if (lage === "fehler" && r.status === 0) {
      // Keine Antwort — vielleicht kam die PIN trotzdem an. Erst nachsehen, dann neu fragen.
      const st = await api.stand(S.ref);
      if (st.ok && (st.json as any)?.pinGesetzt) lage = versucht.current ? "schon" : "neu";
    }
    if (lage === "fehler") {
      if (r.status === 0) versucht.current = true;
      erste.current = "";
      setPhase("waehlen");
      fehler(r.status === 0
        ? "Keine Verbindung – Ihre PIN ist noch nicht gesichert. Bitte geben Sie sie noch einmal ein."
        : (r.json as any)?.error || "Ihre PIN konnte gerade nicht gespeichert werden. Bitte wählen Sie sie noch einmal.", "pin_server");
      return;
    }
    if (lage === "schon") {
      setSchon(true);
      setMeldung(null);
      setze({ pinGesetzt: true });
      setPhase("gesichert");
      return;
    }
    setPhase("gesichert");
    setFeier(true);
    setMeldung(null);
    setze({ pinGesetzt: true });
    const b = buehne();
    b?.funkeln();
    setTimeout(() => { lichtStreif(); b?.warmLicht(); }, ruhig() ? 0 : 520);
    fertigZeit.current = window.setTimeout(() => gehe("paket"), ruhig() ? 700 : 2100);
  };

  const vier = (pin: string) => {
    if (phase === "waehlen") {
      const grund = pinPruefen(pin, geburt);
      if (grund) return fehler(grund, "pin_schwach");
      erste.current = pin;
      setPhase("bestaetigen");
      setMeldung({ text: "Bitte geben Sie Ihre PIN zur Bestätigung noch einmal ein.", fehler: false });
      setTimeout(leeren, 260);
      buehne()?.puls(1.4);
    } else if (phase === "bestaetigen") {
      if (pin !== erste.current) {
        erste.current = "";
        setPhase("waehlen");
        return fehler("Die beiden Eingaben stimmen nicht überein. Bitte wählen Sie Ihre PIN noch einmal.", "pin_ungleich");
      }
      void speichern(pin);
    }
  };

  const setzen = (neu: string) => {
    if (phase !== "waehlen" && phase !== "bestaetigen") return;
    if (sperre.current) return;
    const v = neu.replace(/\D/g, "").slice(0, 4);
    if (v.length > zifRef.current.length) buehne()?.puls(0.7);
    if (meldung?.fehler && v.length) setMeldung(phase === "bestaetigen" ? { text: "Bitte geben Sie Ihre PIN zur Bestätigung noch einmal ein.", fehler: false } : null);
    zifRef.current = v;
    setZiffern(v);
    if (v.length === 4) { sperre.current = true; setTimeout(() => vier(v), 200); }
  };
  const taste = (t: string) => {
    if (t === "zurueck") return setzen(zifRef.current.slice(0, -1));
    setzen(zifRef.current + t);
  };

  const gesichert = phase === "gesichert";
  const aktivIndex = phase === "waehlen" || phase === "bestaetigen" ? Math.min(ziffern.length, 3) : -1;

  return (
    <>
      <Titel text={gesichert && !feier ? "Ihre persönliche PIN ist festgelegt." : "Ihre persönliche FIAON-PIN."} />
      <Lead>
        {gesichert
          ? "Damit erkennen wir Sie am Telefon. Ändern können Sie sie jederzeit in Ihrem Kundenbereich."
          : "Wählen Sie vier Ziffern, die nur Sie kennen. Damit erkennen wir Sie am Telefon. Ändern können Sie sie jederzeit in Ihrem Kundenbereich."}
      </Lead>
      <div className="an-pin">
        <div className={`an-pin-ring${feier ? " an-an" : ""}`} aria-hidden="true" />
        <div className={`an-pin-zellen${schuetteln ? " an-schuetteln" : ""}${gesichert ? " an-gesichert" : ""}`}
          onClick={() => { if (!beruehrung) eingabe.current?.focus(); }} data-feld="pin">
          {[0, 1, 2, 3].map((i) => {
            const voll = gesichert || i < ziffern.length;
            return (
              <div key={i} className={`an-pin-zelle${voll ? " an-voll" : ""}${i === aktivIndex ? " an-aktiv" : ""}`} aria-hidden="true">
                {zeigen && !gesichert && ziffern[i] ? <span style={{ fontSize: 24, fontWeight: 300, color: "var(--tief)" }}>{ziffern[i]}</span> : <span className="an-pin-punkt" />}
              </div>
            );
          })}
          {!beruehrung && !gesichert ? (
            <input ref={eingabe} className="an-pin-eingabe" id="an-pin" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4}
              aria-label={phase === "bestaetigen" ? "PIN zur Bestätigung" : "Vier Ziffern für Ihre PIN"} value={ziffern}
              onChange={(e) => setzen(e.target.value)} disabled={phase === "speichert"} />
          ) : null}
        </div>
        {gesichert ? (
          <div className="an-pin-gesichert-text">
            <div className={`an-pin-schloss${feier || !ruhig() ? " an-an" : ""}`} aria-hidden="true"><Ico name="schloss" klasse="" /></div>
            <b>Gesichert.</b>
            {schon
              ? <span className="an-klein">Ihre PIN war schon festgelegt – es gilt die zuerst gewählte. Ändern können Sie sie jederzeit in Ihrem Kundenbereich.</span>
              : <span className="an-klein">Gespeichert nur als geschützter Prüfwert, nie im Klartext – nirgends angezeigt oder gemailt.</span>}
          </div>
        ) : (
          <div className={`an-pin-status${meldung?.fehler ? " an-fehler" : ""}`} role={meldung?.fehler ? "alert" : "status"} aria-live="polite">
            {meldung?.text ?? (phase === "waehlen" ? "Vier Ziffern, ganz nach Ihrer Wahl." : "")}
          </div>
        )}
        {beruehrung && !gesichert ? (
          <div className="an-pin-tastatur" role="group" aria-label="Zifferntastatur">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "zurueck"].map((t, i) => (
              t === "" ? <span key={i} className="an-pin-taste an-leer" aria-hidden="true" /> : (
                <button key={i} type="button" className="an-pin-taste" onClick={() => taste(t)} disabled={phase === "speichert"}
                  aria-label={t === "zurueck" ? "Letzte Ziffer löschen" : t}>
                  {t === "zurueck"
                    ? <svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7.5 5h8a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-8L3 10z" /><path d="M10 8l4 4M14 8l-4 4" /></svg>
                    : t}
                </button>
              )
            ))}
          </div>
        ) : null}
        {!gesichert ? (
          <button type="button" className="an-knopf an-text" style={{ alignSelf: "center" }} onClick={() => setZeigen(!zeigen)} aria-pressed={zeigen}>
            {zeigen ? "Ziffern verbergen" : "Ziffern beim Tippen zeigen"}
          </button>
        ) : null}
      </div>
      <p className="an-klein" style={{ margin: 0, textAlign: "center" }}>Nicht die PIN Ihrer Karte – die vergibt allein Ihre Bank. Geben Sie Ihre FIAON-PIN nie an Dritte weiter.</p>
      {gesichert && !feier ? <Knopf text="Weiter zur Paketwahl" onClick={() => gehe("paket")} /> : null}
    </>
  );
}
