// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/pfaendungsrechner — Pfändungsfreigrenze und P-Konto-Schutz
// (02.09.2026, E-080)
//
// Werte der Pfändungsfreigrenzenbekanntmachung 2026 (BGBl. vom 26.03.2026),
// gültig ab 1. Juli 2026 bis 30. Juni 2027:
//   Grundbetrag ohne Unterhaltspflicht      1.587,40 €
//   Erhöhung erste unterhaltsberechtigte Person  597,42 €
//   Erhöhung zweite bis fünfte Person je     332,83 €
//   Höchstbetrag: ab 4.866,30 € netto ist alles darüber voll pfändbar
// Vom Mehrbetrag über dem Freibetrag bleiben unpfändbar: 3/10 (ohne
// Unterhaltspflicht) + 2/10 für die erste + 1/10 für jede weitere Person
// (§ 850c Abs. 3 ZPO). Die amtliche Tabelle rechnet in 10-Euro-Stufen; das
// Werkzeug rundet das Netto auf die volle 10-Euro-Stufe ab und trifft die
// Tabelle damit auf wenige Cent.
// Zum Vergleich hinterlegt: der Satz vom 1.7.2025 (1.555,00 / 585,23 / 326,04).
// P-Konto: Der Grundfreibetrag entspricht dem Grundbetrag (§ 899 ZPO); die
// Erhöhungen für Unterhalt, Kindergeld und bestimmte Sozialleistungen müssen
// mit Bescheinigung bei der Bank eingetragen werden (§ 902, § 903 ZPO).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };

// QUELLEN (für die Review nachschlagbar):
//  · 2026: Pfändungsfreigrenzenbekanntmachung 2026, BGBl. 2026 I, veröffentlicht am
//    26.03.2026 (Angabe TK/Lohnsteuer-kompakt/IHK Hannover; BGBl-Nummer beim
//    Review gegen www.recht.bund.de prüfen): Grundbetrag 1.587,40 €, erste
//    unterhaltsberechtigte Person +597,42 €, zweite bis fünfte je +332,83 €,
//    Höchstbetrag 4.866,30 € (darüber voll pfändbar). Sekundärquellen:
//    tk.de (Pfändungsfreigrenzen 2026/2027), ihk.de/hannover, lohnsteuer-kompakt.de,
//    infodienst-schuldnerberatung.de — alle abgerufen 02.09.2026.
//  · 2025: Pfändungsfreigrenzenbekanntmachung 2025 (gültig 01.07.2025–30.06.2026):
//    1.555,00 / 585,23 / 326,04 / Höchstbetrag 4.766,90 € (finanztip.de, juraforum.de).
//  · Quoten: § 850c Abs. 3 ZPO (3/10 + 2/10 + je 1/10 des Mehrbetrags unpfändbar).
const SAETZE = {
  "2026": { ab: "1. Juli 2026", grund: 1587.40, erste: 597.42, weitere: 332.83, hoechst: 4866.30 },
  "2025": { ab: "1. Juli 2025", grund: 1555.00, erste: 585.23, weitere: 326.04, hoechst: 4766.90 },
} as const;

type Satz = { ab: string; grund: number; erste: number; weitere: number; hoechst: number };
function rechnen(netto: number, unterhalt: number, satz: Satz) {
  const u = Math.min(5, Math.max(0, unterhalt));
  const frei = satz.grund + (u >= 1 ? satz.erste : 0) + Math.max(0, u - 1) * satz.weitere;
  const stufe = Math.floor(netto / 10) * 10;
  if (stufe <= frei) return { frei, pfaendbar: 0, unpfaendbar: netto, quote: 0 };
  const quoteUnpf = 0.3 + (u >= 1 ? 0.2 : 0) + Math.max(0, u - 1) * 0.1; // Anteil des Mehrbetrags, der bleibt
  const mehr = Math.min(stufe, satz.hoechst) - frei;
  let unpf = frei + mehr * quoteUnpf;
  if (stufe > satz.hoechst) unpf = frei + (satz.hoechst - frei) * quoteUnpf; // darüber alles pfändbar
  const pfaendbar = Math.max(0, Math.round((netto - unpf) * 100) / 100);
  return { frei, pfaendbar, unpfaendbar: netto - pfaendbar, quote: 1 - quoteUnpf };
}

const FRAGEN = [
  { f: "Was ist der Unterschied zwischen Lohnpfändung und P-Konto?", a: "Bei der Lohnpfändung behält der Arbeitgeber den pfändbaren Teil ein und überweist ihn an den Gläubiger – Grundlage ist die Tabelle zu § 850c ZPO. Das P-Konto schützt das Guthaben auf dem Konto vor der Kontopfändung: Bis zum Freibetrag können Sie verfügen, egal woher das Geld kommt. Beides kann gleichzeitig laufen; das P-Konto schützt dann das, was nach der Lohnpfändung ankommt." },
  { f: "Wie bekomme ich ein P-Konto?", a: "Jedes Girokonto kann auf Verlangen in ein Pfändungsschutzkonto umgewandelt werden – die Bank muss das innerhalb von vier Geschäftstagen tun (§ 850k ZPO). Es darf nur ein P-Konto je Person geben; die Bank darf dafür kein höheres Entgelt verlangen als für das normale Konto. Der Grundfreibetrag gilt sofort; die Erhöhungen brauchen eine Bescheinigung." },
  { f: "Wer stellt die Bescheinigung für den erhöhten Freibetrag aus?", a: "Arbeitgeber, Familienkasse, Sozialleistungsträger, Schuldnerberatungsstellen, Rechtsanwälte, Steuerberater oder das Vollstreckungsgericht (§ 903 ZPO). Die kostenlose Schuldnerberatung ist der einfachste Weg. Ohne Bescheinigung gilt nur der Grundbetrag – auch wenn Sie Kinder haben." },
  { f: "Was passiert mit Geld über dem Freibetrag?", a: "Es ist für den Gläubiger reserviert – die Bank darf es aber erst im Folgemonat auskehren (Moratorium, § 900 ZPO). Nicht verbrauchtes Guthaben unter dem Freibetrag können Sie bis zu drei Monate ansparen (§ 899 Abs. 2 ZPO). Eine Nachzahlung wie Weihnachtsgeld ist deshalb nicht verloren, aber zeitlich zu planen." },
  { f: "Gilt die Tabelle auch in Österreich und der Schweiz?", a: "Nein. In Österreich gilt das Existenzminimum nach der Exekutionsordnung (§ 291a EO, jährlich angepasst), in der Schweiz das betreibungsrechtliche Existenzminimum, das das Betreibungsamt individuell nach den Richtlinien der Konferenz der Betreibungs- und Konkursbeamten berechnet. Dieses Werkzeug rechnet ausschließlich nach deutschem Recht." },
];

export default function Pfaendungsrechner() {
  const [netto, setNetto] = useState("");
  const [unterhalt, setUnterhalt] = useState(0);
  const [satz, setSatz] = useState<keyof typeof SAETZE>("2026");
  const N = zahl(netto);
  const S = SAETZE[satz];
  const e = useMemo(() => (N > 0 ? rechnen(N, unterhalt, S) : null), [N, unterhalt, S]);

  return (
    <Dunkel seite="ratgeber" titel="Pfändungsrechner · Freibetrag und P-Konto 2026" beschreibung="Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag nach § 850c ZPO und den Schutz auf dem P-Konto. Werte ab 1. Juli 2026: 1.587,40 € Grundbetrag. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/pfaendungsrechner" titel="Pfändungsrechner 2026: Freibetrag und P-Konto-Schutz" beschreibung="Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag nach § 850c ZPO und den Schutz auf dem P-Konto. Werte ab 1. Juli 2026 (1.587,40 €)." fragen={FRAGEN} werkzeug={{ name: "Pfändungsrechner" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Pfändungsrechner", pfad: "/werkzeuge/pfaendungsrechner" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Was Ihnen bei einer Pfändung <span className="dk-verlauf">bleibt.</span></h1>
          <p className="dk-lead">Die Pfändungstabelle, ohne die Tabelle: Netto und Unterhaltspflichten eingeben – der Rechner nennt den pfändbaren Betrag und den Schutz auf dem P-Konto. Werte ab 1. Juli 2026.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Ihr monatliches Nettoeinkommen</h3>
              <p className="wz-hinweis">Nach Steuern und Sozialabgaben, wie es auf dem Konto ankommt. Bei schwankendem Einkommen den Durchschnitt der letzten drei Monate.</p>
              <div className="wz-felder">
                <label><span>Netto im Monat (€)</span><input value={netto} onChange={(ev) => setNetto(ev.target.value)} inputMode="decimal" placeholder="z. B. 2.150" /></label>
                <label><span>Tabelle</span><select value={satz} onChange={(ev) => setSatz(ev.target.value as keyof typeof SAETZE)}><option value="2026">ab 1. Juli 2026 (aktuell)</option><option value="2025">1. Juli 2025 – 30. Juni 2026</option></select></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Wie vielen Personen sind Sie gesetzlich zum Unterhalt verpflichtet?</h3>
              <p className="wz-hinweis">Ehegatte oder eingetragener Partner, Kinder, denen Sie tatsächlich Unterhalt leisten. Höchstens fünf zählen. Partner mit eigenem Einkommen kann das Gericht herausrechnen.</p>
              <div className="wz-optionen" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
                {[0, 1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`wz-option${unterhalt === n ? " an" : ""}`} onClick={() => setUnterhalt(n)}><b>{n}</b></button>)}
              </div>
            </div>
          </div>
          {e && (
            <div className={`wz-ergebnis${e.pfaendbar === 0 ? " gut" : ""}`}>
              <span className="wz-stufe" style={{ background: e.pfaendbar === 0 ? "#047857" : "#1d4ed8" }}>{e.pfaendbar === 0 ? "Nichts pfändbar" : "Pfändbarer Betrag"}</span>
              <h3>{e.pfaendbar === 0 ? `Ihr Einkommen liegt unter dem Freibetrag von ${eur(e.frei)}.` : `${eur(e.pfaendbar)} im Monat sind pfändbar – ${eur(e.unpfaendbar)} bleiben Ihnen.`}</h3>
              <p>Freibetrag bei {unterhalt} Unterhaltspflicht{unterhalt === 1 ? "" : "en"}: {eur(e.frei)} ({S.ab}). Vom Betrag darüber {e.quote > 0 ? `sind ${Math.round(e.quote * 100)} Prozent pfändbar` : "ist nichts pfändbar"}{N > S.hoechst ? `; ab ${eur(S.hoechst)} netto ist alles darüber voll pfändbar` : ""}. Die amtliche Tabelle rechnet in 10-Euro-Stufen – deshalb kann der Wert um wenige Cent abweichen.</p>
              <div className="wz-tabelle-huelle"><table className="wz-tabelle">
                <tbody>
                  <tr><td>Grundbetrag</td><td>{eur(S.grund)}</td></tr>
                  {unterhalt >= 1 && <tr><td>Erste unterhaltsberechtigte Person</td><td>{eur(S.erste)}</td></tr>}
                  {unterhalt >= 2 && <tr><td>{unterhalt - 1} weitere Person{unterhalt - 1 === 1 ? "" : "en"} à {eur(S.weitere)}</td><td>{eur((unterhalt - 1) * S.weitere)}</td></tr>}
                  <tr className="summe"><td>Unpfändbarer Freibetrag</td><td>{eur(e.frei)}</td></tr>
                  <tr><td>Ihr Netto</td><td>{eur(N)}</td></tr>
                  <tr className="summe"><td>Pfändbar</td><td>{eur(e.pfaendbar)}</td></tr>
                </tbody>
              </table></div>
              <div className="wz-schritt"><small>Stand und Quelle</small><p>Werte gültig {S.ab === "1. Juli 2026" ? "vom 1. Juli 2026 bis 30. Juni 2027" : "vom 1. Juli 2025 bis 30. Juni 2026"} nach der Pfändungsfreigrenzenbekanntmachung {S.ab === "1. Juli 2026" ? "2026 (BGBl. 2026 I, veröffentlicht am 26. März 2026)" : "2025"} zu § 850c ZPO. Rechenweg nach § 850c Abs. 3 ZPO. Keine Gewähr für Sonderfälle – maßgeblich ist die amtliche Tabelle.</p></div>
              <div className="wz-schritt"><small>Auf dem P-Konto</small><p>Der Grundfreibetrag von {eur(S.grund)} gilt sofort nach der Umwandlung. {unterhalt > 0 ? `Die Erhöhung um ${eur(e.frei - S.grund)} für Ihre Unterhaltspflichten gilt erst, wenn Sie der Bank eine Bescheinigung vorlegen (§ 903 ZPO) – von der Schuldnerberatung, dem Arbeitgeber oder der Familienkasse. Ohne Bescheinigung schützt das Konto nur den Grundbetrag.` : "Kindergeld und bestimmte Sozialleistungen erhöhen den Schutz zusätzlich – mit Bescheinigung."}</p></div>
              <div className="wz-schritt"><small>Was Sie jetzt tun können</small><p>Girokonto in ein P-Konto umwandeln lassen (die Bank hat vier Geschäftstage). Bescheinigung besorgen. Prüfen, ob die Forderung hinter der Pfändung überhaupt berechtigt und nicht <a href="/werkzeuge/verjaehrung">verjährt</a> ist – ein Titel kann auch auf einer verjährten Forderung beruhen, wenn niemand widersprochen hat. Bei mehreren Gläubigern: <a href="/werkzeuge/schulden-check">Schulden-Check</a> und Schuldnerberatung.</p></div>
              <div className="wz-knoepfe"><Knopf href="/werkzeuge/schulden-check" still>Schulden-Check</Knopf><Knopf href="/werkzeuge/ratenplan" still>Ratenplan statt Pfändung</Knopf></div>
            </div>
          )}
          <p className="dk-leise" style={{ marginTop: 18 }}>Grundlage: § 850c ZPO mit der Pfändungsfreigrenzenbekanntmachung 2026 (BGBl. vom 26.03.2026, gültig ab 1. Juli 2026); §§ 850k, 899–903 ZPO. Ohne Sonderfälle (Unterhaltspfändung nach § 850d ZPO, Zusammenrechnung mehrerer Einkommen, Pfändung von Sozialleistungen). Das Werkzeug ersetzt keine Schuldnerberatung – sie ist kostenlos und der richtige Ort, wenn gepfändet wird. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Bevor es zur Pfändung kommt:</b> Ein Ratenplan, der zum Spielraum passt, hält die meisten Gläubiger vom Titel ab. FIAON leitet den Spielraum aus dem Kontoauszug ab und schreibt die Angebote.</>} knopf="Lage prüfen lassen" href="/antrag" still={{ knopf: "Kostenlose Schuldnerberatung", href: "/werkzeuge/schulden-check" }} />
    </Dunkel>
  );
}
