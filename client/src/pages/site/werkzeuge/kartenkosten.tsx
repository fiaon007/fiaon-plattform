// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/kartenkosten — Kartenkosten-Vergleich: Kaution, Prepaid, Debit
// (02.09.2026, E-080)
//
// Wer trotz Eintrag eine Karte will, bekommt drei Angebote vorgelegt, die
// sich nicht vergleichen lassen: eine Kreditkarte mit Sicherheitsleistung
// (Kaution, Jahresgebühr, das Geld liegt fest), eine Prepaid-Karte (Jahres-
// gebühr, Aufladegebühr, Bargeldgebühr) und die Debitkarte zum Girokonto
// (Kontoführung, meist keine Aufladung). Der Rechner legt alle drei auf
// drei Jahre um – inklusive der Opportunitätskosten der Kaution – und sagt,
// welche Karte was leistet (Hotel/Mietwagen, Rahmen, Bonitätsaufbau).
//
// Keine Anbieternamen, keine Vermittlung: FIAON bekommt für keine Karte
// Provision auf dieser Seite. Der Nutzer trägt die Zahlen aus seinen
// Angeboten ein; die Vorbelegungen sind marktübliche Größenordnungen.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const zahl = (s: string) => { const n = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
const JAHRE = 3;

const FRAGEN = [
  { f: "Was ist eine Kreditkarte mit Sicherheitsleistung?", a: "Eine echte Kreditkarte, deren Rahmen durch eine Kaution gedeckt ist, die Sie vorher hinterlegen – meist in Höhe des Rahmens. Der Herausgeber trägt kein Risiko, deshalb gibt es sie oft auch mit negativen Einträgen. Die Kaution liegt fest, solange die Karte läuft; manche Herausgeber zahlen keine Zinsen darauf. Der Vorteil: Sie funktioniert wie eine Kreditkarte – Hotel, Mietwagen, Kaution – und meldet bei einigen Anbietern eine Zahlungshistorie." },
  { f: "Ist Prepaid dasselbe wie Debit?", a: "Nein. Prepaid-Karten laden Sie auf; sie hängen an keinem Girokonto und kosten oft Aufladegebühren. Debitkarten (Visa Debit, Debit Mastercard) buchen sofort vom Girokonto ab – ohne Aufladung, ohne Rahmen. Für Alltag und Online-Kauf sind beide gleichwertig; bei Hotels und Mietwagen werden Prepaid und Debit häufig abgelehnt, weil keine Kaution blockiert werden kann." },
  { f: "Welche Karte baut Bonität auf?", a: "Nur eine Karte, deren Zahlungsverhalten gemeldet wird – das sind in Deutschland vor allem echte Kreditkarten mit Rahmen und Vertragsmeldung an die SCHUFA. Prepaid- und Debitkarten werden in der Regel nicht gemeldet; sie schaden nicht, bauen aber nichts auf. Was Bonität wirklich baut, ist das geführte Girokonto dahinter: Gehaltseingänge, keine Rückgaben, kein Dauer-Dispo." },
  { f: "Was sind Opportunitätskosten der Kaution?", a: "Das Geld, das als Kaution liegt, arbeitet nicht: Bei 1.000 Euro Kaution und 2,5 Prozent Tagesgeldzins verlieren Sie rund 25 Euro im Jahr – zusätzlich zur Jahresgebühr. Der Rechner zählt das mit, damit Kaution und Prepaid ehrlich vergleichbar werden. Wer die Kaution später zurückbekommt, hat sie nicht verloren – aber drei Jahre nicht nutzen können." },
  { f: "Welche Karte bekomme ich über FIAON?", a: "Das entscheidet der Kartenpartner anhand Ihrer Akte – FIAON bereitet vor und stellt den Antrag, wenn Ihre Readiness die Schwelle erreicht. Für jeden Kunden gibt es zunächst ein Girokonto mit Debitkarte; die Kreditkarte mit Rahmen kommt, wenn Auskunft und Kontoführung sie tragen. Kein Versprechen, sondern ein Weg mit Etappen." },
];

export default function Kartenkosten() {
  const [k, setK] = useState({ kaution: "500", kautionGebuehr: "49", kautionZins: "2,5", prepaidGebuehr: "29", prepaidAuflade: "1,50", aufladungen: "12", prepaidBargeld: "2,00", bargeld: "6", debitKonto: "4,90" });
  const set = (f: keyof typeof k) => (ev: React.ChangeEvent<HTMLInputElement>) => setK({ ...k, [f]: ev.target.value });
  const [bedarf, setBedarf] = useState<"alltag" | "reise" | "aufbau" | "">("");

  const e = useMemo(() => {
    const kaution = zahl(k.kaution), kg = zahl(k.kautionGebuehr), kz = zahl(k.kautionZins);
    const pg = zahl(k.prepaidGebuehr), pa = zahl(k.prepaidAuflade), n = zahl(k.aufladungen), pb = zahl(k.prepaidBargeld), b = zahl(k.bargeld), dk = zahl(k.debitKonto);
    const kautionKosten = JAHRE * (kg + kaution * kz / 100);
    const prepaidKosten = JAHRE * (pg + pa * n + pb * b);
    const debitKosten = JAHRE * 12 * dk;
    return { kautionKosten, prepaidKosten, debitKosten, kaution };
  }, [k]);

  const empfehlung = (() => {
    switch (bedarf) {
      case "reise": return "Für Hotel und Mietwagen brauchen Sie eine Karte, die eine Kaution blockieren kann – das leistet zuverlässig nur die Kreditkarte mit Rahmen, auch die mit Sicherheitsleistung. Prepaid und Debit werden dort häufig abgelehnt, egal wie günstig sie sind.";
      case "aufbau": return "Bonität baut das Girokonto, nicht die Karte: Gehaltseingänge, pünktliche Abbuchungen, kein Dauer-Dispo. Nehmen Sie die günstigste Karte zum Konto (Debit) und stecken Sie das gesparte Geld in den Abbau des Dispos – das liest jede Bank im Kontoauszug. Die Kreditkarte mit Rahmen kommt, wenn die Akte sie trägt.";
      case "alltag": return "Für Online-Kauf, Tanken und Supermarkt reicht die Debitkarte zum Girokonto – sie ist meist die günstigste und braucht keine Aufladung. Prepaid lohnt nur, wenn Sie bewusst ein festes Budget getrennt vom Konto halten wollen.";
      default: return "";
    }
  })();

  return (
    <Dunkel seite="ratgeber" titel="Kartenkosten-Vergleich · Kaution, Prepaid oder Debit?" beschreibung="Kreditkarte mit Kaution, Prepaid-Karte oder Debitkarte: Der Rechner legt Gebühren, Aufladekosten und die festliegende Kaution auf drei Jahre um und sagt, welche Karte was wirklich leistet. Kostenlos.">
      <SeoDaten pfad="/werkzeuge/kartenkosten" titel="Kreditkarte mit Kaution vs. Prepaid vs. Debit: Kostenvergleich" beschreibung="Kreditkarte mit Kaution, Prepaid-Karte oder Debitkarte: Der Rechner legt Gebühren, Aufladekosten und die festliegende Kaution auf drei Jahre um und sagt, welche Karte was leistet." fragen={FRAGEN} werkzeug={{ name: "Kartenkosten-Vergleich" }} krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Kartenkosten-Vergleich", pfad: "/werkzeuge/kartenkosten" }]} />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Drei Karten, <span className="dk-verlauf">ein ehrlicher Preis.</span></h1>
          <p className="dk-lead">Kaution, Prepaid oder Debit – die Angebote sehen alle günstig aus, bis man sie auf drei Jahre umlegt. Tragen Sie die Zahlen aus Ihren Angeboten ein; der Rechner zählt auch das Geld mit, das als Kaution stillliegt.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Wofür brauchen Sie die Karte vor allem?</h3>
              <div className="wz-optionen" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
                <button type="button" className={`wz-option${bedarf === "alltag" ? " an" : ""}`} onClick={() => setBedarf("alltag")}><b>Alltag und Online-Kauf</b></button>
                <button type="button" className={`wz-option${bedarf === "reise" ? " an" : ""}`} onClick={() => setBedarf("reise")}><b>Hotel, Mietwagen, Reisen</b></button>
                <button type="button" className={`wz-option${bedarf === "aufbau" ? " an" : ""}`} onClick={() => setBedarf("aufbau")}><b>Bonität aufbauen</b></button>
              </div>
              {empfehlung && <div className="wz-schritt" style={{ marginTop: 14 }}><small>Einordnung</small><p>{empfehlung}</p></div>}
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Die Zahlen aus Ihren Angeboten</h3>
              <p className="wz-hinweis">Vorbelegt sind marktübliche Größenordnungen (Stand 2026). Ersetzen Sie sie durch die Werte aus dem Preisverzeichnis des jeweiligen Anbieters.</p>
              <div className="wz-felder drei">
                <label><span>Kaution (€)</span><input value={k.kaution} onChange={set("kaution")} inputMode="decimal" /></label>
                <label><span>Kautionskarte: Jahresgebühr (€)</span><input value={k.kautionGebuehr} onChange={set("kautionGebuehr")} inputMode="decimal" /></label>
                <label><span>Entgangener Zins auf die Kaution (% p. a.)</span><input value={k.kautionZins} onChange={set("kautionZins")} inputMode="decimal" /></label>
                <label><span>Prepaid: Jahresgebühr (€)</span><input value={k.prepaidGebuehr} onChange={set("prepaidGebuehr")} inputMode="decimal" /></label>
                <label><span>Prepaid: Gebühr je Aufladung (€)</span><input value={k.prepaidAuflade} onChange={set("prepaidAuflade")} inputMode="decimal" /></label>
                <label><span>Aufladungen im Jahr</span><input value={k.aufladungen} onChange={set("aufladungen")} inputMode="numeric" /></label>
                <label><span>Prepaid: Gebühr je Bargeldabhebung (€)</span><input value={k.prepaidBargeld} onChange={set("prepaidBargeld")} inputMode="decimal" /></label>
                <label><span>Abhebungen im Jahr</span><input value={k.bargeld} onChange={set("bargeld")} inputMode="numeric" /></label>
                <label><span>Debit: Kontoführung je Monat (€)</span><input value={k.debitKonto} onChange={set("debitKonto")} inputMode="decimal" /></label>
              </div>
            </div>
          </div>
          <div className="wz-ergebnis">
            <span className="wz-stufe" style={{ background: "#1d4ed8" }}>Kosten über {JAHRE} Jahre</span>
            <h3>{[["Kreditkarte mit Kaution", e.kautionKosten], ["Prepaid-Karte", e.prepaidKosten], ["Debitkarte zum Girokonto", e.debitKosten]].sort((a, b) => (a[1] as number) - (b[1] as number))[0][0]} ist bei Ihren Zahlen am günstigsten.</h3>
            <div className="wz-tabelle-huelle"><table className="wz-tabelle">
              <tbody>
                <tr><td>Kreditkarte mit Kaution ({eur(e.kaution)} liegen fest)</td><td>{eur(e.kautionKosten)}</td></tr>
                <tr><td>Prepaid-Karte (Jahresgebühr, Aufladen, Bargeld)</td><td>{eur(e.prepaidKosten)}</td></tr>
                <tr><td>Debitkarte (Kontoführung)</td><td>{eur(e.debitKosten)}</td></tr>
              </tbody>
            </table></div>
            <p>Kosten sind nur die halbe Wahrheit – die andere Hälfte ist, was die Karte kann:</p>
            <div className="wz-tabelle-huelle"><table className="wz-tabelle">
              <tbody>
                <tr><td>Hotel- und Mietwagenkaution</td><td>Kaution ✓ · Prepaid meist ✗ · Debit oft ✗</td></tr>
                <tr><td>Echter Kreditrahmen</td><td>Kaution ✓ (gedeckt) · Prepaid ✗ · Debit ✗</td></tr>
                <tr><td>Wird an Auskunfteien gemeldet</td><td>Kaution teils · Prepaid ✗ · Debit ✗</td></tr>
                <tr><td>Geht mit negativem Eintrag</td><td>Kaution meist ✓ · Prepaid ✓ · Debit ✓ (Basiskonto)</td></tr>
              </tbody>
            </table></div>
            <div className="wz-schritt"><small>Der FIAON-Weg</small><p>Erst das Girokonto mit Debitkarte – es baut die Kontohistorie. Dann die Kreditkarte mit Rahmen, wenn Auskunft und Kontoführung sie tragen. Der <a href="/werkzeuge/karten-check">Karten-Check</a> sagt in fünf Angaben, wo Sie heute stehen.</p></div>
            <div className="wz-knoepfe"><Knopf href="/werkzeuge/karten-check" still>Karten-Check</Knopf><Knopf href="/kreditkarte" still>Kreditkarte trotz Eintrag</Knopf></div>
          </div>
          <p className="dk-leise" style={{ marginTop: 18 }}>Rechenweg: Jahreskosten × {JAHRE}; bei der Kautionskarte zusätzlich der entgangene Zins auf die Kaution. Vorbelegte Werte sind Größenordnungen, keine Angebote. FIAON nennt keine Kartenanbieter und erhält auf dieser Seite keine Provision. Über die Vergabe einer Karte entscheidet der Herausgeber. Nichts wird gespeichert.</p>
        </Block>
      </Licht>
      <Block schmal titel="Häufige Fragen"><Fragen items={FRAGEN} /></Block>
      <Zwischenruf text={<><b>Die Karte kommt über die Auskunft.</b> FIAON bereitet Konto und Kartenantrag vor, sobald Ihre Akte sie trägt – ohne Kaution, ohne Vorkasse, mit einem Menschen am Telefon.</>} knopf="Den Weg ansehen" href="/kreditkarte" still={{ knopf: "Antrag stellen", href: "/antrag" }} />
    </Dunkel>
  );
}
