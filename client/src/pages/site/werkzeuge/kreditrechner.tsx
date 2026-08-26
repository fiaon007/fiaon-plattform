// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/kreditrechner — Kreditrechner (26.08.2026)
//
// Betrag, Laufzeit, Zins → Monatsrate, Gesamtkosten, Zinsanteil, Tilgungsplan.
// Annuitätenformel, kaufmännisch gerundet. Alles im Browser, nichts wird
// gespeichert.
//
// ── DIE EHRLICHKEIT DIESES RECHNERS ───────────────────────────────────────
// Vergleichsportale rechnen mit dem Schaufensterzins, den zwei Drittel der
// Antragsteller nie bekommen. Dieser Rechner zeigt daneben die Rate beim
// Zwei-Drittel-Zins (§ 6a PAngV) — der Unterschied IST die Botschaft: Wer
// seine Bonität ordnet, zahlt für denselben Kredit weniger. Genau da setzt
// FIAON an. Das ist der Werbetext, ohne dass einer dasteht.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const eur0 = (n: number) => Math.round(n).toLocaleString("de-DE") + " €";

/** Annuität: Rate = K · q^n · (q−1) / (q^n − 1), q = 1 + Monatszins. */
function annuitaet(kredit: number, zinsJahr: number, monate: number) {
  if (kredit <= 0 || monate <= 0) return null;
  if (zinsJahr <= 0) return { rate: kredit / monate, gesamt: kredit, zinsen: 0 };
  const q = 1 + zinsJahr / 100 / 12;
  const qn = Math.pow(q, monate);
  const rate = (kredit * qn * (q - 1)) / (qn - 1);
  return { rate, gesamt: rate * monate, zinsen: rate * monate - kredit };
}

const FRAGEN = [
  { f: "Wie wird die Monatsrate bei einem Ratenkredit berechnet?", a: "Nach der Annuitätenformel: Die Rate bleibt jeden Monat gleich, aber ihre Zusammensetzung ändert sich. Am Anfang steckt viel Zins und wenig Tilgung darin, am Ende ist es umgekehrt. Der Rechner nutzt genau diese Formel mit monatlicher Verzinsung." },
  { f: "Was ist der Zwei-Drittel-Zins?", a: "Banken müssen nach § 6a der Preisangabenverordnung angeben, zu welchem effektiven Jahreszins mindestens zwei Drittel der Kunden den beworbenen Kredit tatsächlich bekommen. Der Schaufensterzins in der Werbung gilt oft nur für die beste Bonität — der Zwei-Drittel-Zins ist die realistischere Zahl." },
  { f: "Warum bekomme ich einen höheren Zins als beworben?", a: "Die meisten Banken vergeben bonitätsabhängige Zinsen: Je besser Score und Kapitaldienstfähigkeit, desto günstiger der Kredit. Negativeinträge, viele Anfragen in kurzer Zeit oder ein ausgereizter Dispo verteuern denselben Kredit erheblich — oft um mehrere Prozentpunkte." },
  { f: "Lohnt sich eine kürzere Laufzeit?", a: "Fast immer, wenn die Rate tragbar bleibt: Bei gleichem Zins sinken die Gesamtkosten mit jeder eingesparten Monatsrate. Der Rechner zeigt die Gesamtkosten für Ihre Eingabe — verändern Sie die Laufzeit und vergleichen Sie selbst." },
  { f: "Speichert dieser Rechner meine Daten?", a: "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt." },
];

export default function Kreditrechner() {
  const [betrag, setBetrag] = useState("15000");
  const [monate, setMonate] = useState("60");
  const [zins, setZins] = useState("6,9");

  const zahlen = useMemo(() => {
    const k = Number(betrag.replace(/\./g, "").replace(",", "."));
    const m = Number(monate);
    const z = Number(zins.replace(",", "."));
    if (!Number.isFinite(k) || !Number.isFinite(m) || !Number.isFinite(z) || k < 100 || m < 6 || z < 0 || z > 30) return null;
    const beworben = annuitaet(k, z, m);
    // Erfahrungswert: Der Zwei-Drittel-Zins liegt bei bonitätsabhängigen
    // Angeboten häufig zwei bis vier Punkte über dem Schaufensterzins.
    const zweiDrittel = annuitaet(k, z + 3, m);
    if (!beworben || !zweiDrittel) return null;
    return { k, m, z, beworben, zweiDrittel, mehr: zweiDrittel.gesamt - beworben.gesamt };
  }, [betrag, monate, zins]);

  // Tilgungsverlauf für die ersten zwölf Monate — macht die Annuität greifbar.
  const verlauf = useMemo(() => {
    if (!zahlen) return [];
    const { k, z, beworben } = zahlen;
    const zeilen: { monat: number; zinsanteil: number; tilgung: number; rest: number }[] = [];
    let rest = k;
    for (let i = 1; i <= Math.min(12, zahlen.m); i++) {
      const zinsanteil = rest * (z / 100 / 12);
      const tilgung = beworben.rate - zinsanteil;
      rest = Math.max(0, rest - tilgung);
      zeilen.push({ monat: i, zinsanteil, tilgung, rest });
    }
    return zeilen;
  }, [zahlen]);

  return (
    <Dunkel seite="ratgeber" titel="Kreditrechner · Monatsrate und Gesamtkosten berechnen" beschreibung="Kostenloser Kreditrechner: Betrag, Laufzeit und Zins eingeben – Monatsrate, Gesamtkosten und Zinsanteil sofort sehen. Mit Zwei-Drittel-Zins nach § 6a PAngV und Tilgungsverlauf. Ohne Anmeldung.">
      <SeoDaten
        pfad="/werkzeuge/kreditrechner"
        titel="Kreditrechner · Monatsrate und Gesamtkosten berechnen"
        beschreibung="Kostenloser Kreditrechner: Monatsrate, Gesamtkosten und Zinsanteil sofort sehen – mit Zwei-Drittel-Zins nach § 6a PAngV."
        fragen={FRAGEN}
        werkzeug={{ name: "FIAON Kreditrechner" }}
        krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Kreditrechner", pfad: "/werkzeuge/kreditrechner" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Was kostet dieser Kredit <span className="dk-verlauf">wirklich?</span></h1>
          <p className="dk-lead">Monatsrate, Gesamtkosten, Zinsanteil — und daneben die Rate zu dem Zins, den zwei Drittel der Antragsteller tatsächlich bekommen.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Ihre Angaben</p><h3>Kreditbetrag, Laufzeit und beworbener Zins</h3>
              <p className="wz-hinweis">Den effektiven Jahreszins finden Sie in jedem Angebot — er enthält alle Kosten und ist die einzige vergleichbare Zahl.</p>
              <div className="wz-felder">
                <label><span>Kreditbetrag</span><input inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="15000" /></label>
                <label><span>Laufzeit in Monaten</span><input inputMode="numeric" value={monate} onChange={(e) => setMonate(e.target.value)} placeholder="60" /></label>
                <label><span>Effektiver Jahreszins in %</span><input inputMode="decimal" value={zins} onChange={(e) => setZins(e.target.value)} placeholder="6,9" /></label>
              </div>
            </div>
          </div>

          {zahlen && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: "#1d4ed8" }}>Beispielrechnung</span>
              <h3>{eur(zahlen.beworben.rate)} im Monat — {eur0(zahlen.beworben.gesamt)} insgesamt</h3>
              <p>
                Bei {eur0(zahlen.k)} über {zahlen.m} Monate zu {zahlen.z.toLocaleString("de-DE")} % effektiv zahlen Sie
                insgesamt {eur0(zahlen.beworben.zinsen)} Zinsen.
              </p>
              <div className="wz-schritt">
                <small>Und wenn Sie nicht den Schaufensterzins bekommen?</small>
                <p>
                  Beim Zwei-Drittel-Zins (hier: {(zahlen.z + 3).toLocaleString("de-DE")} %) wären es {eur(zahlen.zweiDrittel.rate)} im
                  Monat und {eur0(zahlen.zweiDrittel.gesamt)} insgesamt — <b>{eur0(zahlen.mehr)} mehr für denselben Kredit</b>.
                  Der Unterschied hängt fast nur an der Bonität. Genau dort setzt FIAON an, bevor Sie den Antrag stellen.
                </p>
              </div>
              {verlauf.length > 0 && (
                <div className="wz-tabelle-huelle">
                  <table className="wz-tabelle">
                    <caption>So setzt sich Ihre Rate im ersten Jahr zusammen</caption>
                    <thead><tr><th scope="col">Monat</th><th scope="col">Zinsanteil</th><th scope="col">Tilgung</th><th scope="col">Restschuld</th></tr></thead>
                    <tbody>
                      {verlauf.map((v) => (
                        <tr key={v.monat}><td>{v.monat}</td><td>{eur(v.zinsanteil)}</td><td>{eur(v.tilgung)}</td><td>{eur(v.rest)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="wz-knoepfe">
                <Knopf href="/werkzeuge/umschuldung">Bestehende Kredite zusammenlegen?</Knopf>
                <Knopf href="/antrag" still>Bonität zuerst ordnen</Knopf>
              </div>
            </div>
          )}

          <h2 className="dk-h2" style={{ marginTop: 56 }}>Häufige Fragen zum Kreditrechner</h2>
          <Fragen items={FRAGEN} />

          <p className="dk-leise" style={{ marginTop: 18 }}>
            Beispielrechnung nach der Annuitätenformel mit monatlicher Verzinsung; der Zwei-Drittel-Wert ist ein Erfahrungswert
            (§ 6a PAngV verpflichtet Banken zur Angabe des tatsächlichen Zwei-Drittel-Zinses im jeweiligen Angebot). Keine
            Anlage- oder Kreditberatung. Nichts wird gespeichert.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Der Zins ist keine Glückssache.</b> FIAON prüft Ihre Auskunft, räumt auf, was angreifbar ist, und ordnet Ihre Unterlagen — damit die Bank Sie im besten Licht sieht.</>} knopf="Jetzt Bonität ordnen" href="/antrag" />
    </Dunkel>
  );
}
