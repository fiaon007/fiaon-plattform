// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/schuldenplan — Schuldenfrei-Plan: Lawine oder Schneeball
// (02.09.2026, E-080)
//
// Bis zu sechs Schulden (Betrag, Zins, Mindestrate) und ein monatliches
// Budget. Der Rechner simuliert Monat für Monat zwei Strategien:
//   Lawine   – Extra-Geld auf die teuerste Schuld (höchster Zins): am
//              wenigsten Zinsen, mathematisch optimal.
//   Schneeball – Extra-Geld auf die kleinste Schuld: erste Erfolge früh,
//              psychologisch stabiler; kostet meist etwas mehr Zinsen.
// Ergebnis: Monate bis schuldenfrei, Zinsen gesamt, Reihenfolge der
// Tilgung, und die Differenz der beiden Wege. Dazu die ehrliche Grenze: Wenn
// das Budget die Mindestraten nicht deckt, gehört der Fall in die
// kostenlose Schuldnerberatung – nicht in einen Rechner.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };

type Schuld = { name: string; betrag: string; zins: string; rate: string };
const LEER: Schuld = { name: "", betrag: "", zins: "", rate: "" };

function simulieren(schulden: { name: string; rest: number; zins: number; rate: number }[], budget: number, strategie: "lawine" | "schneeball") {
  const s = schulden.map((x) => ({ ...x }));
  let monat = 0, zinsen = 0; const reihenfolge: { name: string; monat: number }[] = [];
  while (s.some((x) => x.rest > 0.005) && monat < 600) {
    monat++;
    let frei = budget;
    for (const x of s) { if (x.rest <= 0) continue; const z = x.rest * x.zins / 100 / 12; x.rest += z; zinsen += z; }
    for (const x of s) { if (x.rest <= 0) continue; const p = Math.min(x.rate, x.rest); x.rest -= p; frei -= p; }
    const offen = s.filter((x) => x.rest > 0.005);
    if (offen.length && frei > 0) {
      const ziel = strategie === "lawine" ? offen.reduce((a, b) => (b.zins > a.zins ? b : a)) : offen.reduce((a, b) => (b.rest < a.rest ? b : a));
      const p = Math.min(frei, ziel.rest); ziel.rest -= p; frei -= p;
      if (frei > 0) { for (const x of offen) { if (frei <= 0 || x.rest <= 0) continue; const q = Math.min(frei, x.rest); x.rest -= q; frei -= q; } }
    }
    for (const x of s) if (x.rest <= 0.005 && !reihenfolge.find((r) => r.name === x.name)) { x.rest = 0; reihenfolge.push({ name: x.name, monat }); }
  }
  return { monate: monat, zinsen, reihenfolge };
}

const FRAGEN = [
  { f: "Lawine oder Schneeball – was ist besser?", a: "Rechnerisch die Lawine: Wer das Extra-Geld immer auf die Schuld mit dem höchsten Zins legt, zahlt am wenigsten Zinsen und ist am frühesten fertig. Praktisch gewinnt oft der Schneeball: Wer die kleinste Schuld zuerst tilgt, hat nach wenigen Monaten einen Gläubiger weniger – und hält deshalb durch. Der Rechner zeigt, wie groß der Unterschied bei Ihren Zahlen ist. Ist er klein, nehmen Sie den Schneeball." },
  { f: "Welche Schulden gehören in den Plan?", a: "Alle mit fester Rate: Ratenkredite, Dispo (mit dem Betrag, den Sie monatlich abbauen wollen), Kreditkartenrahmen, Ratenkäufe, Inkassoforderungen mit Ratenvereinbarung. Nicht hinein gehören Miete, Strom und laufende Verträge – das sind Fixkosten, die im Budget vorher abgezogen sind." },
  { f: "Was, wenn das Budget die Mindestraten nicht deckt?", a: "Dann ist kein Plan der Welt die Lösung, sondern ein Gespräch: mit den Gläubigern über niedrigere Raten (Ratenplan-Rechner) und mit einer kostenlosen, staatlich anerkannten Schuldnerberatung. Sie kann Raten bündeln, Vergleiche verhandeln und – wenn nötig – den Weg in die Verbraucherinsolvenz begleiten. Der Rechner sagt Ihnen ehrlich, wenn Sie an diesem Punkt sind." },
  { f: "Sollte ich lieber umschulden?", a: "Wenn ein neuer Kredit alle teuren Schulden zu einem deutlich niedrigeren Zins ablöst und die Rate ins Budget passt: ja – der Umschuldungsrechner rechnet es durch. Voraussetzung ist eine Bank, die den Kredit gibt; mit negativen Einträgen ist das schwer. Dann ist der Plan mit vorhandenen Mitteln der realistische Weg." },
  { f: "Wie halte ich den Plan durch?", a: "Alle Raten auf einen Tag direkt nach dem Gehalt, per Dauerauftrag. Das Extra-Geld ebenfalls automatisch. Einen Puffer von einer Monatsrate auf dem Konto. Jeden getilgten Gläubiger feiern – und dessen Rate sofort auf die nächste Schuld legen, statt sie im Alltag zu verbrauchen. Genau das ist der Schneeball-Effekt." },
];

export default function Schuldenplan() {
  const [schulden, setSchulden] = useState<Schuld[]>([{ ...LEER, name: "Ratenkredit" }, { ...LEER, name: "Dispo" }, { ...LEER, name: "Kreditkarte" }]);
  const [budget, setBudget] = useState("");
  const set = (i: number, f: keyof Schuld) => (ev: React.ChangeEvent<HTMLInputElement>) => setSchulden(schulden.map((s, j) => (j === i ? { ...s, [f]: ev.target.value } : s)));

  const e = useMemo(() => {
    const gueltig = schulden.map((s, i) => ({ name: s.name || `Schuld ${i + 1}`, rest: zahl(s.betrag), zins: zahl(s.zins), rate: zahl(s.rate) })).filter((s) => s.rest > 0 && s.rate > 0);
    const B = zahl(budget);
    if (!gueltig.length || B <= 0) return null;
    const mindest = gueltig.reduce((a, s) => a + s.rate, 0);
    const gesamt = gueltig.reduce((a, s) => a + s.rest, 0);
    if (B < mindest) return { fehlt: mindest - B, mindest, gesamt } as const;
    const zinsProblem = gueltig.filter((s) => s.rate <= s.rest * s.zins / 100 / 12);
    if (zinsProblem.length) return { zinsProblem, mindest, gesamt } as const;
    const lawine = simulieren(gueltig, B, "lawine"); const schneeball = simulieren(gueltig, B, "schneeball");
    return { lawine, schneeball, mindest, gesamt, extra: B - mindest } as const;
  }, [schulden, budget]);

  return (
    <Dunkel seite="ratgeber" titel="Schuldenfrei-Plan · Lawine oder Schneeball?" beschreibung="Bis zu sechs Schulden und Ihr Budget eingeben – der Rechner simuliert Lawine (teuerste zuerst) und Schneeball (kleinste zuerst): Monate bis schuldenfrei, Zinsen, Reihenfolge. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/schuldenplan" titel="Schuldenfrei-Plan: Lawine oder Schneeball? Rechner" beschreibung="Bis zu sechs Schulden und Ihr Budget eingeben – der Rechner simuliert Lawine (teuerste zuerst) und Schneeball (kleinste zuerst): Monate bis schuldenfrei, Zinsen, Reihenfolge." fragen={FRAGEN} werkzeug={{ name: "Schuldenfrei-Plan" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Schuldenfrei-Plan", pfad: "/werkzeuge/schuldenplan" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">In welcher Reihenfolge <span className="dk-verlauf">werde ich schuldenfrei?</span></h1>
          <p className="dk-lead">Teuerste Schuld zuerst oder kleinste zuerst? Der Rechner simuliert beide Wege Monat für Monat und nennt das Datum, die Zinsen und die Reihenfolge – ehrlich auch dann, wenn das Budget nicht reicht.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Ihre Schulden</h3>
              <p className="wz-hinweis">Restschuld, Zinssatz und die Mindestrate laut Vertrag. Beim Dispo: Betrag und Dispozins, als Rate den Betrag, den Sie mindestens monatlich abbauen. Bis zu sechs Positionen.</p>
              {schulden.map((s, i) => (
                <div key={i} className="wz-felder drei" style={{ marginBottom: 10 }}>
                  <label><span>Bezeichnung</span><input value={s.name} onChange={set(i, "name")} placeholder={`Schuld ${i + 1}`} /></label>
                  <label><span>Restschuld (€)</span><input value={s.betrag} onChange={set(i, "betrag")} inputMode="decimal" /></label>
                  <label><span>Zins (% p. a.)</span><input value={s.zins} onChange={set(i, "zins")} inputMode="decimal" /></label>
                  <label><span>Mindestrate (€/Monat)</span><input value={s.rate} onChange={set(i, "rate")} inputMode="decimal" /></label>
                </div>
              ))}
              <div className="wz-knoepfe">
                {schulden.length < 6 && <button type="button" className="dk-knopf still" onClick={() => setSchulden([...schulden, { ...LEER }])}>Weitere Schuld</button>}
                {schulden.length > 1 && <button type="button" className="dk-knopf still" onClick={() => setSchulden(schulden.slice(0, -1))}>Letzte entfernen</button>}
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Was können Sie monatlich für alle Schulden zusammen aufbringen?</h3>
              <p className="wz-hinweis">Alles, was nach Fixkosten und Lebenshaltung übrig ist – der <a href="/werkzeuge/spielraum">Spielraum-Rechner</a> hilft. Realistisch, nicht optimistisch: Der Plan hält nur, wenn die Zahl auch im schlechten Monat stimmt.</p>
              <div className="wz-felder"><label><span>Budget je Monat (€)</span><input value={budget} onChange={(ev) => setBudget(ev.target.value)} inputMode="decimal" placeholder="z. B. 450" /></label></div>
            </div>
          </div>
          {e && "fehlt" in e && (
            <div className="wz-ergebnis alarm">
              <span className="wz-stufe" style={{ background: "#b91c1c" }}>Budget reicht nicht</span>
              <h3>Die Mindestraten betragen {eur(e.mindest)} – es fehlen {eur(e.fehlt)} im Monat.</h3>
              <p>Das ist kein Rechenproblem, sondern ein Verhandlungsproblem: Die Raten müssen kleiner werden, bevor ein Plan tragen kann. Sprechen Sie die Gläubiger schriftlich an – der <a href="/werkzeuge/ratenplan">Ratenplan-Rechner</a> formuliert das Angebot – und holen Sie sich die kostenlose, staatlich anerkannte Schuldnerberatung. Sie kann bündeln, stunden und Vergleiche verhandeln. Gesamtschulden: {eur(e.gesamt)}.</p>
              <div className="wz-knoepfe"><Knopf href="/werkzeuge/ratenplan" still>Ratenangebot schreiben</Knopf><Knopf href="/werkzeuge/schulden-check" still>Schulden-Check</Knopf></div>
            </div>
          )}
          {e && "zinsProblem" in e && (
            <div className="wz-ergebnis alarm">
              <span className="wz-stufe" style={{ background: "#b45309" }}>Rate deckt die Zinsen nicht</span>
              <h3>Bei {e.zinsProblem.map((s) => s.name).join(", ")} ist die Mindestrate kleiner als die Monatszinsen.</h3>
              <p>Diese Schuld wächst, egal wie lange Sie zahlen. Prüfen Sie den Zinssatz (steht im Vertrag) und die Rate – und wenn beides stimmt: Diese Position braucht als Erstes das Extra-Geld oder eine <a href="/werkzeuge/umschuldung">Umschuldung</a>.</p>
            </div>
          )}
          {e && "lawine" in e && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>Ihr Plan</span>
              <h3>Schuldenfrei in {e.lawine.monate} Monaten (Lawine) oder {e.schneeball.monate} Monaten (Schneeball).</h3>
              <p>Mindestraten {eur(e.mindest)} plus {eur(e.extra)} Extra-Geld jeden Monat auf eine Schuld konzentriert. Gesamtschulden {eur(e.gesamt)}. Zinsen bis zum Ende: Lawine {eur(e.lawine.zinsen)}, Schneeball {eur(e.schneeball.zinsen)} – Unterschied {eur(Math.abs(e.schneeball.zinsen - e.lawine.zinsen))}. {Math.abs(e.schneeball.zinsen - e.lawine.zinsen) < 60 ? "Der Unterschied ist klein: Nehmen Sie den Schneeball – frühe Erfolge halten den Plan am Leben." : "Der Unterschied ist spürbar: Die Lawine lohnt sich, wenn Sie die Disziplin haben, monatelang auf den ersten sichtbaren Erfolg zu warten."}</p>
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td><b>Lawine</b> – teuerste Schuld zuerst</td><td>{e.lawine.monate} Monate · {eur(e.lawine.zinsen)} Zinsen</td></tr>
                  {e.lawine.reihenfolge.map((r, i) => <tr key={"l" + i}><td style={{ paddingLeft: 18 }}>{i + 1}. {r.name}</td><td>getilgt nach Monat {r.monat}</td></tr>)}
                  <tr><td><b>Schneeball</b> – kleinste Schuld zuerst</td><td>{e.schneeball.monate} Monate · {eur(e.schneeball.zinsen)} Zinsen</td></tr>
                  {e.schneeball.reihenfolge.map((r, i) => <tr key={"s" + i}><td style={{ paddingLeft: 18 }}>{i + 1}. {r.name}</td><td>getilgt nach Monat {r.monat}</td></tr>)}
                </tbody>
              </table></div>
              <div className="wz-schritt"><small>So bleibt der Plan am Leben</small><p>Alle Raten und das Extra-Geld per Dauerauftrag am Tag nach dem Gehalt. Ist eine Schuld getilgt, wandert ihre Rate sofort auf die nächste – nicht in den Alltag. Eine Rate als Puffer auf dem Konto. Jede pünktliche Rate ist ein Positivdatum für Ihre <a href="/ratenzahlung-und-bonitaet">Bonität</a>.</p></div>
              <div className="wz-knoepfe"><Knopf href="/werkzeuge/umschuldung" still>Umschuldung vergleichen</Knopf><Knopf href="/werkzeuge/dispo-rechner" still>Dispo-Rechner</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Rechenweg: monatliche Verzinsung der Restschuld, Mindestraten für alle Positionen, Extra-Geld nach Strategie; freiwerdende Raten fließen in die nächste Schuld. Ohne Sondertilgungsgebühren, ohne Vorfälligkeitsentschädigung (siehe Umschuldungsrechner). Keine Schuldnerberatung – bei Zahlungsunfähigkeit ist die kostenlose, staatlich anerkannte Beratung der richtige Ort. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Der Plan steht – die Gläubiger noch nicht?</b> FIAON schreibt die Ratenangebote, verfolgt die Antworten, hält die Fristen und räumt nebenbei die Einträge auf, die schon entstanden sind.</>} knopf="FIAON übernimmt das" href="/antrag" still={{ knopf: "Kostenlose Schuldnerberatung", href: "/werkzeuge/schulden-check" }} />
    </Dunkel>
  );
}
