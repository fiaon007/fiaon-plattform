// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/inkassokosten — Inkassokosten-Prüfer (23.08.2026)
//
// Hauptforderung + geforderte Posten → zulässige Kosten nach § 13e RDG und
// RVG (Anlage 2, Stand 2021), Differenz und fertige Formulierung für die
// Zurückweisung. Kostenlos, ohne Anmeldung, nichts wird gespeichert.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

// RVG Anlage 2 (Gebührentabelle, seit 1.1.2021): Gegenstandswert bis … → 1,0-Gebühr
const TABELLE: [number, number][] = [[500, 49], [1000, 88], [1500, 127], [2000, 166], [3000, 222], [4000, 278], [5000, 334], [6000, 390], [7000, 446], [8000, 502], [9000, 558], [10000, 614], [13000, 666], [16000, 718], [19000, 770], [22000, 822], [25000, 874], [30000, 955], [35000, 1036], [40000, 1117], [45000, 1198], [50000, 1279]];
const gebuehr10 = (wert: number) => { for (const [bis, g] of TABELLE) if (wert <= bis) return g; return 1279 + Math.ceil((wert - 50000) / 15000) * 110; };
const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };

export default function Inkassokosten() {
  const [haupt, setHaupt] = useState("");
  const [kosten, setKosten] = useState("");
  const [auslagen, setAuslagen] = useState("");
  const [sonst, setSonst] = useState("");
  const [lage, setLage] = useState<"erstes" | "weiter" | "">("");
  const [kopiert, setKopiert] = useState(false);

  const e = useMemo(() => {
    const h = zahl(haupt); if (!h || !lage) return null;
    const satz = lage === "erstes" ? 0.5 : 0.9;
    let geb = Math.round(gebuehr10(h) * satz * 100) / 100;
    let deckel = "";
    if (h <= 50 && geb > 30) { geb = 30; deckel = "Bei Hauptforderungen bis 50 Euro ist die Gebühr auf 30 Euro begrenzt."; }
    const ausl = Math.min(20, Math.round(geb * 0.2 * 100) / 100);
    const gef = zahl(kosten) + zahl(auslagen) + zahl(sonst);
    const zul = geb + ausl;
    const diff = Math.round((gef - zul) * 100) / 100;
    return { h, satz, geb, ausl, zul, gef, diff, deckel, sonst: zahl(sonst) };
  }, [haupt, kosten, auslagen, sonst, lage]);

  const text = e ? `Die Hauptforderung in Höhe von ${euro(e.h)} sowie Inkassokosten in gesetzlich zulässiger Höhe (${e.satz.toFixed(1).replace(".", ",")}-Geschäftsgebühr nach RVG: ${euro(e.geb)}, zuzüglich Auslagenpauschale ${euro(e.ausl)}) werde ich begleichen. Die darüber hinaus geforderten Kosten in Höhe von ${euro(Math.max(0, e.diff))} weise ich zurück; sie übersteigen die nach § 13e RDG in Verbindung mit dem RVG erstattungsfähige Vergütung.${e.sonst ? " Posten wie „Kontoführung“ oder „Adressermittlung“ sind ohne Nachweis nicht erstattungsfähig." : ""} Bitte legen Sie die Berechnung der Gebühren im Einzelnen dar oder bestätigen Sie die Erledigung mit Zahlung des genannten Betrags.` : "";

  return (
    <Dunkel seite="ratgeber" titel="Inkassokosten-Prüfer · Sind die Gebühren zu hoch?" beschreibung="Kostenlos: Hauptforderung und geforderte Inkassokosten eingeben – der Prüfer rechnet die zulässigen Gebühren nach RVG und § 13e RDG nach und liefert die Formulierung für die Zurückweisung.">
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Sind die Inkassokosten <span className="dk-verlauf">zu hoch?</span></h1>
          <p className="dk-lead">Seit Oktober 2021 gelten gesetzliche Obergrenzen. Der Prüfer rechnet nach, was zulässig ist – und formuliert die Zurückweisung.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was steht im Inkassoschreiben?</h3>
              <div className="wz-felder drei">
                <label><span>Hauptforderung</span><input inputMode="decimal" placeholder="z. B. 89,00" value={haupt} onChange={(ev) => setHaupt(ev.target.value)} /></label>
                <label><span>Geforderte Inkassogebühr</span><input inputMode="decimal" placeholder="z. B. 70,20" value={kosten} onChange={(ev) => setKosten(ev.target.value)} /></label>
                <label><span>Auslagen / Pauschalen</span><input inputMode="decimal" placeholder="z. B. 20,00" value={auslagen} onChange={(ev) => setAuslagen(ev.target.value)} /></label>
                <label><span>Sonstige Posten (Kontoführung, Adressermittlung …)</span><input inputMode="decimal" placeholder="z. B. 18,00" value={sonst} onChange={(ev) => setSonst(ev.target.value)} /></label>
              </div>
              <p className="wz-hinweis">Verzugszinsen bitte nicht eintragen – sie sind gesondert geschuldet (fünf Prozentpunkte über dem Basiszins).</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>In welcher Lage sind Sie?</h3>
              <div className="wz-optionen zwei">
                <button type="button" className={`wz-option${lage === "erstes" ? " an" : ""}`} onClick={() => setLage("erstes")}><b>Erstes Inkassoschreiben, Forderung unstreitig</b><small>Ich zahle jetzt – dann gilt in der Regel die 0,5-Gebühr.</small></button>
                <button type="button" className={`wz-option${lage === "weiter" ? " an" : ""}`} onClick={() => setLage("weiter")}><b>Schon mehrere Schreiben oder Ratenvereinbarung</b><small>Regelgebühr 0,9. Höher (bis 1,3) nur bei umfangreicher Sache.</small></button>
              </div>
            </div>
          </div>
          {e && (
            <div className={`wz-ergebnis${e.diff > 5 ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: e.diff > 5 ? "#b91c1c" : "#047857" }}>{e.diff > 5 ? `Um ${euro(e.diff)} überhöht` : "Im Rahmen"}</span>
              <h3>{e.diff > 5 ? `Zulässig sind rund ${euro(e.zul)} – gefordert werden ${euro(e.gef)}.` : `Die geforderten Kosten von ${euro(e.gef)} liegen im zulässigen Rahmen (rund ${euro(e.zul)}).`}</h3>
              <table className="wz-tabelle"><tbody>
                <tr><td>Geschäftsgebühr {e.satz.toFixed(1).replace(".", ",")} (Gegenstandswert {euro(e.h)})</td><td>{euro(e.geb)}</td></tr>
                <tr><td>Auslagenpauschale (20 %, höchstens 20 €)</td><td>{euro(e.ausl)}</td></tr>
                <tr><td>Sonstige Posten ohne Nachweis</td><td>0,00 €</td></tr>
                <tr className="summe"><td>Zulässige Inkassokosten (ohne Zinsen)</td><td>{euro(e.zul)}</td></tr>
              </tbody></table>
              {e.deckel && <p className="wz-hinweis">{e.deckel}</p>}
              {e.diff > 5 && (
                <>
                  <div className="wz-schritt"><small>Formulierung für Ihr Schreiben</small><p>{text}</p></div>
                  <div className="wz-knoepfe">
                    <button type="button" className="dk-knopf" onClick={async () => { try { await navigator.clipboard.writeText(text); setKopiert(true); setTimeout(() => setKopiert(false), 2000); } catch { /* egal */ } }}>{kopiert ? "Kopiert" : "Formulierung kopieren"}</button>
                    <Knopf href="/ratgeber/inkasso-in-zahlen-gebuehren-grenzen" still>Die Regeln im Detail</Knopf>
                  </div>
                </>
              )}
              {e.diff <= 5 && <div className="wz-schritt"><small>Ihr nächster Schritt</small><p>Prüfen Sie vor der Zahlung, ob die Forderung selbst besteht und nicht verjährt ist – und fordern Sie nach der Zahlung die Erledigungsmeldung an die Auskunfteien ein.</p></div>}
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: § 13e RDG, RVG mit Anlage 2 (Stand 2021), Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht. Richtwerte; im Einzelfall kann eine höhere Gebühr gerechtfertigt sein. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Inkassobrief auf dem Tisch?</b> FIAON prüft Forderung, Verjährung, Mahnungen und Kosten – und schreibt zurück, per Einschreiben.</>} knopf="FIAON übernimmt das" href="/antrag" />
    </Dunkel>
  );
}
