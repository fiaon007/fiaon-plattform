// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/spielraum — Spielraum-Rechner (23.08.2026, für die Startseite)
//
// Einnahmen und Fixkosten → monatlicher Spielraum, Quote, und was Banken
// bei Karte und Rahmen daraus lesen (Richtwerte). Alles im Browser.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf } from "@/components/site/DunkleBuehne";
import "@/styles/ratgeber.css";

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const z = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) && n >= 0 ? n : 0; };
const FELDER: [string, string, string][] = [["miete", "Miete inkl. Nebenkosten", "z. B. 850"], ["energie", "Strom, Gas, Internet, Handy", "z. B. 180"], ["versicherung", "Versicherungen", "z. B. 90"], ["mobil", "Auto, ÖPNV, Sprit", "z. B. 220"], ["raten", "Laufende Raten und Abos", "z. B. 150"], ["leben", "Lebensmittel und Alltag", "z. B. 400"]];

export default function Spielraum() {
  const [ein, setEin] = useState("");
  const [ein2, setEin2] = useState("");
  const [k, setK] = useState<Record<string, string>>({});
  const e = useMemo(() => {
    const einnahmen = z(ein) + z(ein2); if (!einnahmen) return null;
    const fix = FELDER.reduce((s, [key]) => s + z(k[key] || ""), 0);
    const spiel = einnahmen - fix; const quote = fix / einnahmen;
    const raten = z(k.raten || "");
    const stufe = spiel < 0 ? { label: "Im Minus", farbe: "#b91c1c" } : quote > 0.85 ? { label: "Eng", farbe: "#b45309" } : quote > 0.7 ? { label: "Solide", farbe: "#1d4ed8" } : { label: "Komfortabel", farbe: "#047857" };
    const rahmen = Math.max(0, Math.min(25000, Math.round(spiel * 8 / 500) * 500));
    return { einnahmen, fix, spiel, quote, raten, stufe, rahmen };
  }, [ein, ein2, k]);

  return (
    <Dunkel seite="ratgeber" titel="Spielraum-Rechner · Was bleibt im Monat – und was liest eine Bank daraus?" beschreibung="Kostenlos, ohne Anmeldung: Einnahmen und Fixkosten eingeben – der Rechner zeigt Ihren monatlichen Spielraum, die Fixkostenquote und was Kartenpartner daraus ablesen.">
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Was bleibt <span className="dk-verlauf">im Monat?</span></h1>
          <p className="dk-lead">Dieselbe Rechnung, die Banken mit Ihrem Kontoauszug machen – nur vorher, und nur für Sie.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was kommt im Monat rein?</h3>
              <div className="wz-felder drei">
                <label><span>Nettoeinkommen</span><input inputMode="decimal" placeholder="z. B. 2.300" value={ein} onChange={(ev) => setEin(ev.target.value)} /></label>
                <label><span>Weitere regelmäßige Einnahmen</span><input inputMode="decimal" placeholder="Kindergeld, Nebenjob, Unterhalt" value={ein2} onChange={(ev) => setEin2(ev.target.value)} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Was geht fest raus?</h3>
              <div className="wz-felder drei">{FELDER.map(([key, l, ph]) => <label key={key}><span>{l}</span><input inputMode="decimal" placeholder={ph} value={k[key] || ""} onChange={(ev) => setK({ ...k, [key]: ev.target.value })} /></label>)}</div>
            </div>
          </div>
          {e && (
            <div className="wz-ergebnis" style={{ borderColor: e.stufe.farbe }}>
              <span className="wz-stufe" style={{ background: e.stufe.farbe }}>{e.stufe.label}</span>
              <h3>{e.spiel < 0 ? `Es fehlen ${euro(-e.spiel)} im Monat.` : `Ihr Spielraum: ${euro(e.spiel)} im Monat.`}</h3>
              <table className="wz-tabelle"><tbody>
                <tr><td>Einnahmen</td><td>{euro(e.einnahmen)}</td></tr>
                <tr><td>Fixkosten</td><td>− {euro(e.fix)}</td></tr>
                <tr><td>Fixkostenquote</td><td>{Math.round(e.quote * 100)} %</td></tr>
                <tr className="summe"><td>Spielraum</td><td>{euro(e.spiel)}</td></tr>
              </tbody></table>
              <p>{e.spiel < 0 ? "Mit negativem Spielraum lehnt jeder Herausgeber einen Rahmen ab – und Lastschriften platzen. Zuerst die Fixkosten prüfen: Abos kündigen, Raten bündeln, Energieanbieter wechseln. Bei bedrohter Existenz ist die kostenlose Schuldnerberatung der erste Weg." : e.quote > 0.85 ? "Eine Fixkostenquote über 85 Prozent lesen Banken als eng: Ein Kartenrahmen ist möglich, bleibt aber klein. Jeder gesenkte Fixposten wirkt direkt." : e.quote > 0.7 ? "Solide: Banken sehen Luft für Raten und Rahmen. Faustregel vieler Herausgeber: Rahmen bis zum Acht- bis Zehnfachen des monatlichen Spielraums – bei sauberer Auskunft." : "Komfortabel: Mit dieser Quote sind Rahmen bis zur Schwelle des Kartenpartners realistisch. Entscheidend ist dann nur noch, was die Auskunft zeigt."}</p>
              {e.spiel > 0 && <div className="wz-schritt"><small>Richtwert Kartenrahmen (Faustregel, keine Zusage)</small><p>Etwa {euro(Math.max(500, e.rahmen))} – bei sauberer Auskunft und pünktlich geführtem Konto. Über den Rahmen entscheidet die Bank.</p></div>}
              <div className="wz-knoepfe"><Knopf href="/werkzeuge/karten-check">Karten-Check machen</Knopf><Knopf href="/antrag" still>Auskunft beschaffen</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Richtwerte, keine Beratung. Nichts verlässt Ihren Browser; FIAON speichert diese Eingaben nicht.</p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Im Kundenbereich rechnet FIAON das aus Ihrem Kontoauszug.</b> Automatisch, jeden Monat, mit Spielraum-Verlauf.</>} knopf="Den Bereich ansehen" href="/demo/kundenbereich" />
    </Dunkel>
  );
}
