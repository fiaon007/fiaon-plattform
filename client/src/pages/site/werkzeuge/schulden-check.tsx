// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge/schulden-check — Der Schulden-Check (26.08.2026)
//
// Einnahmen, Ausgaben, Raten, Rückstände → eine ehrliche Ampel mit den
// Kennzahlen, die auch eine Schuldnerberatung ansetzen würde. Alles im
// Browser, nichts wird gespeichert.
//
// ── DIE VERANTWORTUNG DIESER SEITE ────────────────────────────────────────
// Wer „bin ich überschuldet" sucht, ist oft in echter Not. Deshalb gilt hier:
//
//   · Bei Rot steht die KOSTENLOSE staatlich anerkannte Schuldnerberatung
//     VOR jedem FIAON-Knopf. Wer in der Krise zuerst verkauft, hat die
//     Seite nicht verdient, auf der solche Menschen landen.
//   · Keine Beschönigung: „angespannt" heißt angespannt.
//   · Die Regeln sind die der Praxis: Überschuldung liegt vor, wenn nach
//     den notwendigen Lebenshaltungskosten die fälligen Zahlungspflichten
//     dauerhaft nicht bedient werden können.
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const eur0 = (n: number) => Math.round(n).toLocaleString("de-DE") + " €";
const num = (s: string) => { const n = Number(s.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) && n >= 0 ? n : 0; };

const FRAGEN = [
  { f: "Ab wann gilt man als überschuldet?", a: "Überschuldet ist, wer seine fälligen Zahlungsverpflichtungen mit dem verfügbaren Einkommen und Vermögen auf Dauer nicht mehr erfüllen kann. Ein einzelner enger Monat ist keine Überschuldung — entscheidend ist, ob sich die Lücke Monat für Monat wiederholt und die Rückstände wachsen." },
  { f: "Welche Schuldenquote ist noch in Ordnung?", a: "Als Faustregel der Kreditpraxis gilt: Alle Raten zusammen sollten 30 bis 35 Prozent des Nettoeinkommens nicht übersteigen. Oberhalb von 40 Prozent wird es eng, weil unvorhergesehene Ausgaben keinen Platz mehr haben. Der Check rechnet genau diese Quote aus." },
  { f: "Was macht eine Schuldnerberatung — und was kostet sie?", a: "Staatlich anerkannte Schuldnerberatungsstellen (etwa von Caritas, Diakonie, AWO oder den Verbraucherzentralen) sind kostenlos. Sie verschaffen einen Überblick, verhandeln mit Gläubigern, schützen das Existenzminimum (P-Konto) und begleiten notfalls in die Verbraucherinsolvenz." },
  { f: "Ist die Verbraucherinsolvenz das Ende?", a: "Nein — sie ist ein geregelter Neuanfang: Seit 2020 dauert das Verfahren nur noch drei Jahre, danach sind die restlichen Schulden erlassen. Der Eintrag über die Restschuldbefreiung wird seit 2023 bereits sechs Monate nach der Erteilung gelöscht." },
  { f: "Speichert dieser Check meine Angaben?", a: "Nein. Alle Berechnungen laufen in Ihrem Browser. Es wird nichts übertragen, nichts gespeichert und keine Anmeldung verlangt." },
];

export default function SchuldenCheck() {
  const [netto, setNetto] = useState("");
  const [wohnen, setWohnen] = useState("");
  const [leben, setLeben] = useState("");
  const [raten, setRaten] = useState("");
  const [rueckstand, setRueckstand] = useState("");
  const [mahnungen, setMahnungen] = useState<"" | "keine" | "mahnungen" | "inkasso">("");

  const lage = useMemo(() => {
    const n = num(netto);
    if (n < 100) return null;
    const w = num(wohnen), l = num(leben), r = num(raten), rs = num(rueckstand);
    const frei = n - w - l - r;
    const quote = n > 0 ? (r / n) * 100 : 0;
    // Wie viele Monate bräuchte das freie Einkommen, um die Rückstände zu tilgen?
    const monate = rs > 0 ? (frei > 0 ? rs / frei : Infinity) : 0;

    let stufe: "gruen" | "gelb" | "rot";
    if (frei < 0 || monate === Infinity || mahnungen === "inkasso") stufe = "rot";
    else if (quote > 40 || monate > 12 || mahnungen === "mahnungen") stufe = "gelb";
    else stufe = "gruen";

    return { n, frei, quote, rs, monate, stufe };
  }, [netto, wohnen, leben, raten, rueckstand, mahnungen]);

  return (
    <Dunkel seite="ratgeber" titel="Schulden-Check · Bin ich überschuldet?" beschreibung="Kostenloser Schulden-Check: Einnahmen, Ausgaben und Raten eingeben – eine ehrliche Einschätzung mit Schuldenquote, freiem Einkommen und den nächsten Schritten. Bei ernster Lage: der Weg zur kostenlosen Schuldnerberatung. Ohne Anmeldung.">
      <SeoDaten
        pfad="/werkzeuge/schulden-check"
        titel="Schulden-Check · Bin ich überschuldet?"
        beschreibung="Einnahmen, Ausgaben und Raten eingeben – eine ehrliche Einschätzung mit Schuldenquote und den nächsten Schritten."
        fragen={FRAGEN}
        werkzeug={{ name: "FIAON Schulden-Check" }}
        krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }, { name: "Schulden-Check", pfad: "/werkzeuge/schulden-check" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/hero.jpg" alt="" decoding="async" /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Werkzeug · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Wie ernst ist die Lage <span className="dk-verlauf">wirklich?</span></h1>
          <p className="dk-lead">Fünf Zahlen, eine ehrliche Antwort — mit denselben Kennzahlen, die auch eine Schuldnerberatung ansetzen würde.</p>
        </div>
      </section>
      <Licht>
        <Block schmal>
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p><h3>Was kommt herein, was geht hinaus?</h3>
              <p className="wz-hinweis">Monatliche Zahlen, ehrlich geschätzt. Der Check läuft vollständig in Ihrem Browser.</p>
              <div className="wz-felder">
                <label><span>Nettoeinkommen (Haushalt)</span><input inputMode="decimal" value={netto} onChange={(e) => setNetto(e.target.value)} placeholder="z. B. 2400" /></label>
                <label><span>Wohnen (Miete, Nebenkosten, Strom)</span><input inputMode="decimal" value={wohnen} onChange={(e) => setWohnen(e.target.value)} placeholder="z. B. 950" /></label>
                <label><span>Leben (Essen, Fahrt, Versicherung, Handy)</span><input inputMode="decimal" value={leben} onChange={(e) => setLeben(e.target.value)} placeholder="z. B. 700" /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p><h3>Ihre Schulden</h3>
              <div className="wz-felder">
                <label><span>Alle Kreditraten zusammen</span><input inputMode="decimal" value={raten} onChange={(e) => setRaten(e.target.value)} placeholder="z. B. 480" /></label>
                <label><span>Offene Rückstände gesamt</span><input inputMode="decimal" value={rueckstand} onChange={(e) => setRueckstand(e.target.value)} placeholder="Mahnungen, offene Rechnungen" /></label>
              </div>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p><h3>Wie weit ist es schon gekommen?</h3>
              <div className="wz-optionen">
                <button type="button" className={`wz-option${mahnungen === "keine" ? " an" : ""}`} onClick={() => setMahnungen("keine")}><b>Alles wird pünktlich bezahlt</b><small>Keine Mahnungen.</small></button>
                <button type="button" className={`wz-option${mahnungen === "mahnungen" ? " an" : ""}`} onClick={() => setMahnungen("mahnungen")}><b>Es gibt Mahnungen</b><small>Einzelne Rechnungen liegen.</small></button>
                <button type="button" className={`wz-option${mahnungen === "inkasso" ? " an" : ""}`} onClick={() => setMahnungen("inkasso")}><b>Inkasso oder gekündigte Verträge</b><small>Forderungen wurden übergeben oder Konten gekündigt.</small></button>
              </div>
            </div>
          </div>

          {lage && mahnungen && (
            <div className={`wz-ergebnis${lage.stufe === "rot" ? " alarm" : ""}`}>
              <span className="wz-stufe" style={{ background: lage.stufe === "rot" ? "#b91c1c" : lage.stufe === "gelb" ? "#b45309" : "#047857" }}>
                {lage.stufe === "rot" ? "Ernste Lage" : lage.stufe === "gelb" ? "Angespannt" : "Tragfähig"}
              </span>
              <h3>
                {lage.frei < 0
                  ? `Ihnen fehlen jeden Monat rund ${eur0(-lage.frei)}`
                  : `Ihnen bleiben rund ${eur0(lage.frei)} im Monat — Schuldenquote ${Math.round(lage.quote)} %`}
              </h3>
              <p>
                {lage.stufe === "rot" && lage.frei < 0 &&
                  "Die laufenden Verpflichtungen sind höher als das Einkommen. Das ist mit Sparen allein nicht zu schließen — es braucht eine Ordnung der Forderungen: Priorisieren (Wohnen und Energie zuerst), Ratenpläne, notfalls ein geregeltes Verfahren."}
                {lage.stufe === "rot" && lage.frei >= 0 &&
                  "Übergebene Forderungen oder gekündigte Verträge bedeuten: Die Gläubiger haben die Geduld verloren. Jetzt zählt, das Existenzminimum zu schützen und mit einem Plan zu verhandeln statt mit einzelnen Zahlungen zu löschen, wo es gerade brennt."}
                {lage.stufe === "gelb" &&
                  `Noch trägt es sich, aber ohne Reserve: ${lage.quote > 40 ? `Die Raten binden ${Math.round(lage.quote)} % des Einkommens — oberhalb von 40 % hat Unvorhergesehenes keinen Platz mehr.` : ""} ${lage.rs > 0 && lage.monate > 12 ? `Die Rückstände von ${eur0(lage.rs)} bräuchten beim jetzigen freien Einkommen über ein Jahr.` : ""} Jetzt zu handeln ist deutlich billiger als in sechs Monaten.`}
                {lage.stufe === "gruen" &&
                  "Einkommen, Ausgaben und Raten stehen in einem tragfähigen Verhältnis. Der richtige Moment, die Bonität aktiv zu ordnen — nicht, weil etwas brennt, sondern weil bessere Konditionen bares Geld sind."}
              </p>
              <div className="wz-schritt">
                <small>Ihr nächster Schritt</small>
                {lage.stufe === "rot" ? (
                  <p>
                    <b>Zuerst: eine staatlich anerkannte Schuldnerberatung — sie ist kostenlos.</b> Beratungsstellen von
                    Verbraucherzentrale, Caritas, Diakonie oder AWO finden Sie über die Suche „Schuldnerberatung“ mit Ihrem Ort;
                    sie schützen Ihr Konto (P-Konto), verhandeln mit Gläubigern und begleiten notfalls in die Verbraucherinsolvenz.
                    FIAON kann parallel Ihre Auskunft ordnen — aber der erste Anruf gehört der Beratungsstelle.
                  </p>
                ) : lage.stufe === "gelb" ? (
                  <p>
                    Verschaffen Sie sich die Datenkopie aller Auskunfteien und prüfen Sie jeden Eintrag — und rechnen Sie durch,
                    ob eine Zusammenlegung der Kredite die Rate senkt, bevor Rückstände entstehen.
                  </p>
                ) : (
                  <p>
                    Auskunft anfordern, Einträge prüfen, Dispo ausgleichen — die drei Schritte, die den Score messbar heben,
                    stehen im Bonitäts-Ratgeber.
                  </p>
                )}
              </div>
              <div className="wz-knoepfe">
                {lage.stufe !== "rot" && <Knopf href="/werkzeuge/umschuldung">Zusammenlegung durchrechnen</Knopf>}
                <Knopf href={lage.stufe === "rot" ? "/kontakt" : "/antrag"} still>
                  {lage.stufe === "rot" ? "Mit FIAON sprechen" : "Bonität ordnen lassen"}
                </Knopf>
              </div>
            </div>
          )}

          <h2 className="dk-h2" style={{ marginTop: 56 }}>Häufige Fragen</h2>
          <Fragen items={FRAGEN} />

          <p className="dk-leise" style={{ marginTop: 18 }}>
            Der Check ist eine Selbsteinschätzung anhand der üblichen Kennzahlen der Kredit- und Beratungspraxis — keine
            Schuldner- oder Rechtsberatung. Staatlich anerkannte Schuldnerberatungsstellen arbeiten kostenlos. Nichts wird
            gespeichert.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Ordnung ist der erste Schritt aus jeder Lage.</b> FIAON beschafft Ihre Auskünfte, prüft jeden Eintrag und baut mit Ihnen den Fahrplan — ehrlich, auch wenn die Antwort erst einmal „Schuldnerberatung" heißt.</>} knopf="Lage besprechen" href="/kontakt" />
    </Dunkel>
  );
}
