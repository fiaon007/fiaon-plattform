// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/dispo-rechner — Was der Dauer-Dispo kostet und was der
// Ausstieg bringt (02.09.2026, E-080)
//
// Durchschnittlicher Dispozins in Deutschland: rund 11,3 Prozent (Verivox,
// November 2025; Stiftung Warentest Juni 2025: 11,22 Prozent). Spanne der
// Banken etwa 7 bis 17 Prozent. Der Rechner nimmt den eigenen Zinssatz der
// Bank (steht im Preisaushang) und vergleicht drei Wege: weiter im Minus,
// Ratenkredit zur Ablösung, Abbau in festen Monatsraten aus dem Spielraum.
//
// Warum das Werkzeug hier steht: Für Kartenpartner und Banken ist ein
// dauerhaft ausgereizter Dispo das Negativmerkmal, das keine Auskunftei
// zeigt – es steht im Kontoauszug. Wer ihn abbaut, baut Bonität.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };

/** Annuität: Monatsrate für Betrag B, Jahreszins p, n Monate. */
const annuitaet = (B: number, p: number, n: number) => { const i = p / 100 / 12; return i === 0 ? B / n : (B * i) / (1 - Math.pow(1 + i, -n)); };
/** Monate bis null bei fester Rate R und Jahreszins p (Restschuld verzinst). */
function monateBisNull(B: number, p: number, R: number): { monate: number; zinsen: number } | null {
  const i = p / 100 / 12; if (R <= B * i) return null;
  let rest = B, zinsen = 0, m = 0;
  while (rest > 0.005 && m < 600) { const z = rest * i; zinsen += z; rest = rest + z - R; m++; }
  return { monate: m, zinsen };
}

const FRAGEN = [
  { f: "Schadet ein Dispo meiner SCHUFA?", a: "Der eingeräumte Dispo wird der SCHUFA in der Regel nicht gemeldet – erst eine Kündigung mit offener Forderung oder eine geduldete Überziehung, die die Bank als Vertragsverletzung wertet. Aber: Banken und Kartenpartner lesen den Kontoauszug. Ein dauerhaft ausgereizter Dispo ist dort das deutlichste Warnsignal, unabhängig vom Score." },
  { f: "Ist ein Ratenkredit zur Ablösung des Dispos sinnvoll?", a: "Rechnerisch fast immer, wenn der Kreditzins deutlich unter dem Dispozins liegt (typisch 5 bis 9 Prozent gegenüber 11 und mehr) und Sie die Rate sicher tragen. Voraussetzung: Der Dispo wird danach nicht wieder aufgebaut. Fragen Sie mit einer Konditionsanfrage an, nicht mit einer Kreditanfrage – sie ist SCHUFA-neutral." },
  { f: "Was, wenn die Bank den Dispo kündigt?", a: "Sie darf das mit angemessener Frist – und die offene Summe wird auf einmal fällig. Reagieren Sie sofort schriftlich mit einem Ratenangebot; eine geplatzte Rückzahlung nach Kündigung ist der Weg zum Negativeintrag. Der Ratenplan-Rechner formuliert das Angebot." },
  { f: "Wie komme ich aus dem Dispo, wenn kein Kredit möglich ist?", a: "Mit einem festen Abbau-Betrag pro Monat, direkt nach dem Gehaltseingang, und einem Dispo-Limit, das Sie selbst bei der Bank senken lassen – Schritt für Schritt, damit der alte Stand nicht wieder erreicht wird. Der Rechner zeigt, wie viele Monate das dauert und was es an Zinsen spart, wenn Sie den Betrag nur um 50 Euro erhöhen." },
  { f: "Was ist eine geduldete Überziehung?", a: "Alles, was über das eingeräumte Dispo-Limit hinausgeht. Dafür verlangen viele Banken einen noch höheren Zins – oft 14 bis 18 Prozent – und dürfen die Überziehung jederzeit zurückfordern. Die geduldete Überziehung ist die teuerste Form von Kredit, die es im Alltag gibt." },
];

export default function DispoRechner() {
  const [stand, setStand] = useState("");
  const [zins, setZins] = useState("11,3");
  const [abbau, setAbbau] = useState("");
  const [kreditZins, setKreditZins] = useState("7,5");
  const [laufzeit, setLaufzeit] = useState(24);
  const B = zahl(stand), p = zahl(zins), R = zahl(abbau), pk = zahl(kreditZins);

  const e = useMemo(() => {
    if (B <= 0 || p <= 0) return null;
    const jahrZins = B * p / 100;
    const ratenRate = annuitaet(B, pk, laufzeit);
    const ratenZinsen = ratenRate * laufzeit - B;
    const plan = R > 0 ? monateBisNull(B, p, R) : null;
    const planPlus = R > 0 ? monateBisNull(B, p, R + 50) : null;
    return { jahrZins, ratenRate, ratenZinsen, plan, planPlus };
  }, [B, p, R, pk, laufzeit]);

  return (
    <Dunkel seite="ratgeber" titel="Dispo-Rechner · Was der Dauer-Dispo kostet" beschreibung="Dispo-Stand und Zins eingeben – der Rechner zeigt, was das Minus im Jahr kostet, was ein Ratenkredit zur Ablösung spart und wie lange der Abbau in festen Raten dauert. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/dispo-rechner" titel="Dispo-Rechner: Was der Dauer-Dispo wirklich kostet" beschreibung="Dispo-Stand und Zins eingeben – der Rechner zeigt, was das Minus im Jahr kostet, was ein Ratenkredit zur Ablösung spart und wie lange der Abbau in festen Raten dauert." fragen={FRAGEN} werkzeug={{ name: "Dispo-Rechner" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Dispo-Rechner", pfad: "/werkzeuge/dispo-rechner" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Das Minus, das <span className="dk-verlauf">jeden Monat mitläuft.</span></h1>
          <p className="dk-lead">Rund 11 Prozent Zinsen, jeden Tag, ohne Ende – und für jede Bank das Warnsignal Nummer eins im Kontoauszug. Der Rechner zeigt, was Ihr Dispo kostet und welcher Ausstieg wie viel spart.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Ihr Dispo heute</h3>
              <p className="wz-hinweis">Der Zinssatz steht im Preisaushang Ihrer Bank oder im Online-Banking unter „Konditionen“. Der deutsche Durchschnitt liegt bei rund 11,3 Prozent (Verivox, November 2025).</p>
              <div className="wz-felder drei">
                <label><span>Dispo-Stand (€ im Minus)</span><input value={stand} onChange={(ev) => setStand(ev.target.value)} inputMode="decimal" placeholder="z. B. 1.800" /></label>
                <label><span>Dispozins (% p. a.)</span><input value={zins} onChange={(ev) => setZins(ev.target.value)} inputMode="decimal" /></label>
                <label><span>Möglicher Abbau je Monat (€)</span><input value={abbau} onChange={(ev) => setAbbau(ev.target.value)} inputMode="decimal" placeholder="z. B. 150" /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Zum Vergleich: ein Ratenkredit zur Ablösung</h3>
              <p className="wz-hinweis">Nur, wenn Sie den Dispo danach nicht wieder aufbauen. Der Zwei-Drittel-Zins der Bank steht im Angebot (§ 6a PAngV).</p>
              <div className="wz-felder drei">
                <label><span>Kreditzins (% eff. p. a.)</span><input value={kreditZins} onChange={(ev) => setKreditZins(ev.target.value)} inputMode="decimal" /></label>
                <label><span>Laufzeit</span><select value={laufzeit} onChange={(ev) => setLaufzeit(Number(ev.target.value))}>{[12, 18, 24, 36, 48].map((n) => <option key={n} value={n}>{n} Monate</option>)}</select></label>
              </div>
            </div>
          </div>
          {e && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#b45309" }}>Ihr Dispo kostet</span>
              <h3>{eur(e.jahrZins)} im Jahr – {eur(e.jahrZins / 12)} jeden Monat, solange nichts passiert.</h3>
              <p>Das ist der Preis fürs Stehenlassen: Zinsen auf {eur(B)} bei {p.toLocaleString("de-DE")} Prozent. Über drei Jahre sind das {eur(e.jahrZins * 3)} – ohne dass ein Cent vom Minus verschwindet.</p>
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td>Weiter im Dispo (3 Jahre)</td><td>{eur(e.jahrZins * 3)} Zinsen, Minus bleibt</td></tr>
                  <tr><td>Ratenkredit {laufzeit} Monate zu {pk.toLocaleString("de-DE")} %</td><td>{eur(e.ratenRate)}/Monat, {eur(e.ratenZinsen)} Zinsen gesamt</td></tr>
                  {e.plan && <tr><td>Abbau mit {eur(R)} im Monat</td><td>{e.plan.monate} Monate, {eur(e.plan.zinsen)} Zinsen</td></tr>}
                  {e.planPlus && <tr className="summe"><td>Abbau mit {eur(R + 50)} im Monat</td><td>{e.planPlus.monate} Monate, {eur(e.planPlus.zinsen)} Zinsen</td></tr>}
                </tbody>
              </table></div>
              {R > 0 && !e.plan && <p className="wz-hinweis">Mit {eur(R)} im Monat decken Sie nicht einmal die Zinsen ({eur(e.jahrZins / 12)}). Der Dispo wächst. Dann ist der Ratenkredit – oder ein Gespräch mit der Bank über eine feste Rückführung – der einzige Weg, der rechnet.</p>}
              <div className="wz-schritt"><small>Was Banken daraus lesen</small><p>Ein Kontoauszug mit dauerhaftem Minus ist für Kartenpartner das stärkste Negativmerkmal – stärker als mancher alte Eintrag. Ein Konto, das in sechs Monaten von {eur(B)} auf null geht, erzählt dagegen genau die Geschichte, die eine Bank sehen will: Kontrolle. Der <a href="/werkzeuge/spielraum">Spielraum-Rechner</a> zeigt, welcher Abbau-Betrag realistisch ist.</p></div>
              <div className="wz-schritt"><small>Drei Handgriffe</small><p>1. Abbau-Betrag als Dauerauftrag auf ein Unterkonto am Tag nach dem Gehalt – der Dispo sinkt, ohne dass Sie es jeden Monat entscheiden müssen. 2. Dispo-Limit bei der Bank schrittweise senken lassen. 3. Für die Ablösung nur eine <a href="/schufa-neutral-anfragen">Konditionsanfrage</a> stellen, keine Kreditanfrage.</p></div>
              <div className="wz-knoepfe"><Knopf href="/werkzeuge/umschuldung" still>Umschuldung durchrechnen</Knopf><Knopf href="/werkzeuge/spielraum" still>Spielraum ermitteln</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Rechenweg: Dispozins als einfache Jahresverzinsung des Standes; Ratenkredit nach Annuitätenformel mit monatlicher Verzinsung; Abbau mit monatlicher Zinsbelastung auf die Restschuld. Durchschnittszins 11,3 Prozent: Verivox, November 2025; Stiftung Warentest Juni 2025: 11,22 Prozent. Keine Kreditvermittlung, keine Anlageberatung. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Der Kontoauszug ist die Wahrheit der Bank.</b> FIAON liest ihn mit Ihnen: Einnahmen, Fixkosten, Dispo, Rücklastschriften – und baut daraus den Fahrplan zu Konto und Karte.</>} knopf="Fahrplan ansehen" href="/privatkunden" still={{ knopf: "Bonität verbessern", href: "/bonitaet-verbessern" }} />
    </Dunkel>
  );
}
