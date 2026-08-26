// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/umschuldung — Umschuldungsrechner (26.08.2026)
//
// Bis zu vier bestehende Kredite (plus Dispo) → was kostet das Weiterlaufen,
// was kostet die Zusammenlegung, wo liegt die Ersparnis. Alles im Browser.
//
// ── WARUM DER DISPO EIN EIGENES FELD IST ──────────────────────────────────
// Der teuerste Kredit der meisten Haushalte ist keiner, den sie „aufgenommen"
// haben: Der Dispo läuft bei 10–13 % und taucht in keiner Kreditliste auf.
// Ihn in die Rechnung zu holen ist oft die halbe Ersparnis.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const eur0 = (n: number) => Math.round(n).toLocaleString("de-DE") + " €";
const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

function annuitaet(kredit: number, zinsJahr: number, monate: number) {
  if (kredit <= 0 || monate <= 0) return { rate: 0, gesamt: 0, zinsen: 0 };
  if (zinsJahr <= 0) return { rate: kredit / monate, gesamt: kredit, zinsen: 0 };
  const q = 1 + zinsJahr / 100 / 12;
  const qn = Math.pow(q, monate);
  const rate = (kredit * qn * (q - 1)) / (qn - 1);
  return { rate, gesamt: rate * monate, zinsen: rate * monate - kredit };
}

interface AlterKredit { rest: string; rate: string; zins: string }
const LEER: AlterKredit = { rest: "", rate: "", zins: "" };

const FRAGEN = [
  { f: "Was ist eine Umschuldung?", a: "Sie nehmen einen neuen Kredit auf und lösen damit bestehende Kredite und den Dispo ab. Sinnvoll ist das, wenn der neue Zins niedriger ist als der gewichtete Zins der alten Verträge — dann sinken Rate, Gesamtkosten oder beides." },
  { f: "Wann lohnt sich eine Umschuldung?", a: "Als Faustregel: je höher die alten Zinsen und je länger die Restlaufzeit, desto größer der Hebel. Am stärksten wirkt die Ablösung eines dauerhaft genutzten Dispos, der mit 10 bis 13 Prozent verzinst wird. Bei Altkrediten mit Restlaufzeit unter einem Jahr lohnt der Aufwand selten." },
  { f: "Darf ich meinen Ratenkredit vorzeitig ablösen?", a: "Ja. Bei Verbraucherdarlehen ist die vorzeitige Rückzahlung gesetzlich erlaubt (§ 500 BGB). Die Bank darf eine Vorfälligkeitsentschädigung von höchstens einem Prozent der Restschuld verlangen — bei weniger als zwölf Monaten Restlaufzeit höchstens 0,5 Prozent." },
  { f: "Verschlechtert eine Umschuldung meinen Score?", a: "Kurzfristig kann die neue Kreditanfrage sichtbar sein; stellen Sie sie als Konditionsanfrage, ist sie score-neutral. Mittelfristig wirkt eine Umschuldung oft positiv: weniger parallele Verträge, ein ausgeglichener Dispo und pünktliche Raten sind genau das, was Auskunfteien als Ordnung lesen." },
  { f: "Speichert dieser Rechner meine Daten?", a: "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt." },
];

export default function Umschuldung() {
  const [kredite, setKredite] = useState<AlterKredit[]>([{ ...LEER }, { ...LEER }]);
  const [dispo, setDispo] = useState("");
  const [dispoZins, setDispoZins] = useState("11,9");
  const [neuZins, setNeuZins] = useState("7,5");
  const [neuMonate, setNeuMonate] = useState("60");

  const setzen = (i: number, feld: keyof AlterKredit, wert: string) =>
    setKredite((ks) => ks.map((k, j) => (j === i ? { ...k, [feld]: wert } : k)));

  const zahlen = useMemo(() => {
    const alte = kredite
      .map((k) => ({ rest: num(k.rest), rate: num(k.rate), zins: num(k.zins.replace(",", ".")) }))
      .filter((k) => k.rest > 0 && k.rate > 0);
    const dispoBetrag = num(dispo);
    const dz = num(dispoZins);
    const gesamtRest = alte.reduce((s, k) => s + k.rest, 0) + dispoBetrag;
    if (gesamtRest < 500) return null;

    // Was das Weiterlaufen kostet: je Altkredit die Restlaufzeit aus Rest,
    // Rate und Zins herleiten; der Dispo läuft rechnerisch drei Jahre weiter —
    // die ehrliche Annahme für einen Dispo, der „eigentlich bald" ausgeglichen wird.
    let alteKosten = 0, alteRate = 0;
    for (const k of alte) {
      const mz = k.zins / 100 / 12;
      const zinsMonat = k.rest * mz;
      if (k.rate <= zinsMonat) { alteKosten += k.rest * 3; alteRate += k.rate; continue; }
      const n = mz > 0 ? Math.log(k.rate / (k.rate - k.rest * mz)) / Math.log(1 + mz) : k.rest / k.rate;
      alteKosten += k.rate * n;
      alteRate += k.rate;
    }
    const dispoKosten = dispoBetrag > 0 ? dispoBetrag + dispoBetrag * (dz / 100) * 3 : 0;

    const nz = num(neuZins);
    const nm = Math.max(6, Math.min(120, num(neuMonate)));
    const neu = annuitaet(gesamtRest, nz, nm);
    // Vorfälligkeit: gesetzliche Obergrenze 1 % der abgelösten Kreditreste.
    const vorfaelligkeit = alte.reduce((s, k) => s + k.rest, 0) * 0.01;
    const ersparnis = alteKosten + dispoKosten - (neu.gesamt + vorfaelligkeit);

    return {
      gesamtRest, alteKosten: alteKosten + dispoKosten, alteRate,
      dispoBetrag, neu, nm, nz, vorfaelligkeit, ersparnis,
    };
  }, [kredite, dispo, dispoZins, neuZins, neuMonate]);

  return (
    <Dunkel seite="ratgeber" titel="Umschuldungsrechner · Kredite zusammenlegen und sparen" beschreibung="Kostenloser Umschuldungsrechner: Bestehende Kredite und Dispo eintragen – sehen, was das Weiterlaufen kostet und was die Zusammenlegung spart. Mit Vorfälligkeitsentschädigung nach § 500 BGB. Ohne Anmeldung.">
      <SeoDaten
        pfad="/werkzeuge/umschuldung"
        titel="Umschuldungsrechner · Kredite zusammenlegen und sparen"
        beschreibung="Bestehende Kredite und Dispo eintragen – sehen, was das Weiterlaufen kostet und was die Zusammenlegung spart."
        fragen={FRAGEN}
        werkzeug={{ name: "FIAON Umschuldungsrechner" }}
        krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Umschuldungsrechner", pfad: "/werkzeuge/umschuldung" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Alte Kredite: weiterzahlen oder <span className="dk-verlauf">zusammenlegen?</span></h1>
          <p className="dk-lead">Tragen Sie ein, was läuft — der Rechner stellt beide Wege nebeneinander, einschließlich Dispo und Vorfälligkeitsentschädigung.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Ihre laufenden Kredite</h3>
              <p className="wz-hinweis">Restschuld und Monatsrate stehen im letzten Kontoauszug oder Jahreskontoauszug; der effektive Zins im Vertrag.</p>
              {kredite.map((k, i) => (
                <div className="wz-felder" key={i}>
                  <label><span>Restschuld Kredit {i + 1}</span><input inputMode="decimal" value={k.rest} onChange={(e) => setzen(i, "rest", e.target.value)} placeholder="z. B. 8500" /></label>
                  <label><span>Monatsrate</span><input inputMode="decimal" value={k.rate} onChange={(e) => setzen(i, "rate", e.target.value)} placeholder="z. B. 210" /></label>
                  <label><span>Effektiver Zins %</span><input inputMode="decimal" value={k.zins} onChange={(e) => setzen(i, "zins", e.target.value)} placeholder="z. B. 8,9" /></label>
                </div>
              ))}
              {kredite.length < 4 && (
                <button type="button" className="wz-option" style={{ marginTop: 10 }} onClick={() => setKredite((ks) => [...ks, { ...LEER }])}>
                  <b>+ weiteren Kredit eintragen</b>
                </button>
              )}
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Ihr Dispo — der teuerste Kredit, den niemand so nennt</h3>
              <div className="wz-felder">
                <label><span>Dauerhaft genutzter Dispo</span><input inputMode="decimal" value={dispo} onChange={(e) => setDispo(e.target.value)} placeholder="z. B. 1500 (oder leer)" /></label>
                <label><span>Dispozins %</span><input inputMode="decimal" value={dispoZins} onChange={(e) => setDispoZins(e.target.value)} /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p><h3>Das Angebot für den neuen Kredit</h3>
              <div className="wz-felder">
                <label><span>Effektiver Zins neu %</span><input inputMode="decimal" value={neuZins} onChange={(e) => setNeuZins(e.target.value)} /></label>
                <label><span>Laufzeit in Monaten</span><input inputMode="numeric" value={neuMonate} onChange={(e) => setNeuMonate(e.target.value)} /></label>
              </div>
            </div>
          </div>

          {zahlen && (
            <div className="wz-ergebnis">
              <span className="wz-stufe" style={{ background: zahlen.ersparnis > 0 ? "#047857" : "#b91c1c" }}>
                {zahlen.ersparnis > 0 ? `Ersparnis rund ${eur0(zahlen.ersparnis)}` : "Lohnt sich so nicht"}
              </span>
              <h3>
                {zahlen.ersparnis > 0
                  ? `Zusammenlegen spart rund ${eur0(zahlen.ersparnis)}`
                  : "Mit diesem Angebot ist das Weiterlaufen günstiger"}
              </h3>
              <p>
                Weiterlaufen kostet ab heute rund <b>{eur0(zahlen.alteKosten)}</b>
                {zahlen.dispoBetrag > 0 && " (einschließlich des Dispos über drei Jahre gerechnet)"}.
                Die Zusammenlegung von {eur0(zahlen.gesamtRest)} über {zahlen.nm} Monate zu {zahlen.nz.toLocaleString("de-DE")} %
                kostet <b>{eur0(zahlen.neu.gesamt + zahlen.vorfaelligkeit)}</b> — davon {eur0(zahlen.vorfaelligkeit)} gesetzlich
                gedeckelte Vorfälligkeitsentschädigung. Neue Rate: <b>{eur(zahlen.neu.rate)}</b> statt bisher {eur(zahlen.alteRate)}
                {zahlen.dispoBetrag > 0 && " plus Dispozinsen"}.
              </p>
              <div className="wz-schritt">
                <small>Ihr nächster Schritt</small>
                <p>
                  {zahlen.ersparnis > 0
                    ? "Das Angebot steht und fällt mit dem Zins — und der Zins mit Ihrer Bonität. Vor dem Antrag die Auskunft prüfen und Angreifbares entfernen lassen; als Konditionsanfrage anfragen, nicht als Kreditanfrage."
                    : "Verhandeln Sie den Zins nach oder verkürzen Sie die Laufzeit. Und prüfen Sie, ob Ihre Auskunft Einträge enthält, die den angebotenen Zins hochtreiben — oft liegt dort der eigentliche Hebel."}
                </p>
              </div>
              <div className="wz-knoepfe">
                <Knopf href="/werkzeuge/eintrag-pruefen">Auskunft auf Angreifbares prüfen</Knopf>
                <Knopf href="/antrag" still>FIAON übernimmt das</Knopf>
              </div>
            </div>
          )}

          <h2 className="dk-h2" style={{ marginTop: 56 }}>Häufige Fragen zur Umschuldung</h2>
          <Fragen items={FRAGEN} />

          <p className="dk-leise" style={{ marginTop: 18 }}>
            Beispielrechnung: Restlaufzeiten werden aus Restschuld, Rate und Zins hergeleitet; der Dispo wird über drei Jahre
            gerechnet; Vorfälligkeitsentschädigung mit der gesetzlichen Obergrenze von 1 % (§ 502 BGB). Keine Kreditvermittlung,
            keine Finanzberatung. Nichts wird gespeichert.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Die Ersparnis entscheidet sich vor dem Antrag.</b> FIAON prüft Ihre Auskunft, entfernt Angreifbares und ordnet Ihre Unterlagen — damit das Zusammenlegen zum besten Zins gelingt.</>} knopf="Bonität zuerst ordnen" href="/antrag" />
    </Dunkel>
  );
}
