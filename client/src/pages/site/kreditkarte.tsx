// ═══════════════════════════════════════════════════════════════════════════
// /kreditkarte — Kreditkarte trotz Eintrag: der Weg über die Auskunft (23.08.2026)
//
// Pitch-Seite für die Karte (Privatkunden): Bühne mit Kartenbild, Kennzahlen,
// die drei Kartenwege, interaktive Rahmen-Zeitachse, „Was Herausgeber sehen",
// Karten-Check-Einstieg, Fragen, Abschluss. Keine Zusagen — die Bank entscheidet.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import "@/styles/kreditkarte.css";

const ETAPPEN = [
  { monat: "Monat 0", titel: "Auskunft", text: "FIAON beschafft Ihre Auskunft und erklärt jeden Eintrag. Sie wissen, was Herausgeber sehen – bevor Sie irgendwo anfragen.", rahmen: "–" },
  { monat: "Monat 1–2", titel: "Bereinigen", text: "Angreifbare Einträge werden angegriffen, alte Anfragen und Adressfehler bereinigt. Das Girokonto wird eröffnet und sauber geführt.", rahmen: "Girokonto" },
  { monat: "Monat 2–4", titel: "Erste Karte", text: "Sobald die Auskunft trägt, bereitet FIAON den Kartenantrag vor. Bei erledigten Einträgen oft mit kleinem Rahmen – die Tür ist offen.", rahmen: "500 – 2.000 €" },
  { monat: "Monat 6", titel: "Erste Anpassung", text: "Sechs Monate pünktlich abgerechnet: Herausgeber prüfen den Rahmen neu. FIAON bereitet die Anfrage mit aktueller Auskunft vor.", rahmen: "2.000 – 5.000 €" },
  { monat: "Monat 12", titel: "Volle Karte", text: "Ein Jahr sauber, Einträge gelöscht oder abgelaufen: Jetzt ist der Rahmen realistisch, den Einkommen und Spielraum hergeben – bis 25.000 € bei guter Bonität.", rahmen: "bis 25.000 €" },
];

export default function Kreditkarte() {
  const [i, setI] = useState(0);
  return (
    <Dunkel seite="privatkunden" titel="Kreditkarte trotz SCHUFA-Eintrag · Der Weg über die Auskunft" beschreibung="Kreditkarte trotz Eintrag: Welche Karte heute realistisch ist, wie der Rahmen in zwölf Monaten wächst und was Herausgeber wirklich sehen. FIAON bereitet vor – die Bank entscheidet.">
      <Hero pille="Kreditkarte" titel={<>Die Karte kommt <span className="dk-verlauf">über die Auskunft.</span></>}
            lead="Nicht über Tricks, nicht über Anbieter, die „garantiert“ versprechen – sondern darüber, dass das, was Herausgeber über Sie lesen, stimmt. FIAON sorgt dafür. Über Karte und Rahmen entscheidet die Bank."
            knoepfe={<><Knopf href="/werkzeuge/karten-check">Karten-Check (kostenlos)</Knopf><Knopf href="#weg" still>Wie der Rahmen wächst</Knopf></>}
            szene={<Szenenbild src="/kino/karte.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "25k", label: "Euro Rahmen bei guter Bonität – die Schwelle des Kartenpartners" }, { wert: "10", label: "Tage, die eine Kreditanfrage für andere sichtbar bleibt" }, { wert: "18", label: "Monate Speicherfrist bei Zahlung innerhalb von 100 Tagen" }, { wert: "0", label: "Anfragen, die FIAON ohne Ihre Freigabe stellt" }]} /></div>
      </section>

      <Block pille="Drei Wege" titel={<>Welche Karte <span className="dk-verlauf">heute geht.</span></>} lead="Es gibt nicht „die“ Kreditkarte. Es gibt drei Wege – und für jede Lage einen, der offen ist.">
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="Weg 1" titel="Debit- oder Prepaid-Karte">Funktioniert überall, wo eine Karte verlangt wird: Hotel, Mietwagen, Online-Kauf. Kein Rahmen, keine Auskunft nötig. Der Weg für offene Einträge und Rücklastschriften – solange die Bereinigung läuft.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="Weg 2" titel="Kreditkarte mit kleinem Rahmen">Echte Kreditkarte mit 500 bis 2.000 Euro. Herausgeber starten so bei erledigten Einträgen, befristeten Verträgen, kurzer Historie. Pünktlich abgerechnet, wächst der Rahmen.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Weg 3" titel="Kreditkarte mit vollem Rahmen">Bis 25.000 Euro bei guter Bonität und entsprechendem Spielraum. Der Weg für saubere Auskünfte – und das Ziel für alle anderen nach zwölf Monaten.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block id="weg" pille="Zeitachse" titel={<>So wächst <span className="dk-verlauf">der Rahmen.</span></>} lead="Klicken Sie durch die zwölf Monate. Kein Versprechen – der typische Verlauf, wenn Auskunft, Konto und Abrechnung stimmen.">
          <div className="kk-zeit">
            <div className="kk-punkte">{ETAPPEN.map((e, n) => <button key={e.monat} type="button" className={`kk-punkt${i === n ? " an" : ""}${n < i ? " vorbei" : ""}`} onClick={() => setI(n)}><span>{e.monat}</span><b>{e.titel}</b></button>)}</div>
            <div className="kk-karte" key={i}>
              <small>{ETAPPEN[i].monat}</small>
              <h3>{ETAPPEN[i].titel}</h3>
              <p>{ETAPPEN[i].text}</p>
              <div className="kk-rahmen"><span>Typischer Rahmen</span><b>{ETAPPEN[i].rahmen}</b></div>
              <div className="kk-knoepfe"><button type="button" className="dk-knopf still" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Zurück</button><button type="button" className="dk-knopf" onClick={() => setI(Math.min(ETAPPEN.length - 1, i + 1))} disabled={i === ETAPPEN.length - 1}>Weiter</button></div>
            </div>
          </div>
        </Block>

        <Block pille="Was Herausgeber sehen" titel={<>Die fünf Dinge, <span className="dk-verlauf">die zählen.</span></>} lead="Kartenpartner lesen Ihre Auskunft in einer Minute. Das sind die Stellen, an denen sie hängen bleiben – und was FIAON daran tut.">
          <Zeilen items={[
            ["Negativmerkmale", "Offene Forderungen sperren fast immer; erledigte bremsen. FIAON prüft jede auf ihre Voraussetzungen (§ 31 BDSG) und ihre Frist – viele sind angreifbar, manche längst zu löschen."],
            ["Anfragen", "Drei Kreditanfragen in vier Wochen lesen sich wie Not. FIAON stellt keine Anfrage ohne Freigabe und rät zu Konditionsanfragen, die neutral sind."],
            ["Konto", "Rücklastschriften und Dauer-Dispo sind sichtbar, wenn der Kontoauszug verlangt wird. Drei saubere Monate sind die Währung."],
            ["Adresse und Identität", "Falsche Schreibweisen, alte Adressen, Verwechslungen – erstaunlich häufig. Berichtigung nach Art. 16 DSGVO, von FIAON vorbereitet."],
            ["Spielraum", "Einkommen minus Fixkosten. Faustregel vieler Herausgeber: Rahmen bis zum Acht- bis Zehnfachen des Spielraums. Rechnen Sie es aus – Spielraum-Rechner."],
          ]} />
          <div className="dk-knoepfe" style={{ marginTop: 26 }}><Knopf href="/werkzeuge/spielraum">Spielraum-Rechner</Knopf><Knopf href="/werkzeuge/eintrag-pruefen" still>Ist mein Eintrag angreifbar?</Knopf></div>
        </Block>
      </Licht>

      <Block pille="Ehrlichkeit" titel={<>Was wir <span className="dk-verlauf">nicht versprechen.</span></>} mitte>
        <div className="dk-raster" style={{ textAlign: "left", marginTop: 28 }}>
          <Auf><Glas tag="Keine Garantie" titel="Die Bank entscheidet">Niemand kann eine Kreditkarte garantieren – wer es tut, verkauft Prepaid oder Gebühren. FIAON bereitet vor und sagt vorher, was realistisch ist.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="Kein Score-Trick" titel="Nur, was nicht hingehört, geht weg">Berechtigte Einträge bleiben, bis ihre Frist abläuft. FIAON nennt das Datum – und nutzt die 100-Tage-Regel, wo sie greift.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Keine Anfragen-Flut" titel="Erst die Auskunft, dann der Antrag">FIAON stellt den Kartenantrag erst, wenn die Auskunft trägt. Eine Ablehnung kostet Zeit – und steht zwölf Monate in der Auskunft.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Bekomme ich mit einem offenen Eintrag eine Kreditkarte?", a: "Mit Rahmen praktisch nie. Eine Debit- oder Prepaid-Karte ja – und parallel gehört der Eintrag geprüft: Ist er berechtigt? Wann läuft die Frist? Oft ist die Sperre kürzer als gedacht." },
            { f: "Wie hoch ist der Rahmen am Anfang?", a: "Bei erledigten Einträgen oder kurzer Historie meist 500 bis 2.000 Euro. Nach sechs Monaten pünktlicher Abrechnung prüfen Herausgeber neu. Die Schwelle des Kartenpartners liegt bei 25.000 Euro." },
            { f: "Schadet die Anfrage für die Karte meiner Auskunft?", a: "Eine Kreditanfrage wird zwölf Monate gespeichert und ist zehn Tage für andere sichtbar. Deshalb stellt FIAON den Antrag erst, wenn die Auskunft trägt – und nie mehrere gleichzeitig." },
            { f: "Welche Karte bekomme ich über FIAON?", a: "Eine Kreditkarte eines Kartenpartners, je nach Profil Mastercard oder Visa, mit Monatsabrechnung. Welche konkret, klärt das Startgespräch anhand Ihrer Auskunft." },
            { f: "Was kostet die Karte?", a: "Die Kartengebühr legt der Herausgeber fest und wird vorher genannt. FIAON nimmt keine Provision auf Karte oder Rahmen – der Paketpreis ist der Preis." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Fünf Angaben, eine ehrliche Einordnung.</b> Der Karten-Check stellt keine Anfrage und hinterlässt keine Spur.</>} knopf="Karten-Check starten" href="/werkzeuge/karten-check" still={{ knopf: "Pakete ansehen", href: "/privatkunden" }} />
      <Abschluss titel={<>Die Karte beginnt <span className="dk-verlauf">mit der Auskunft.</span></>} text="Antrag in zwei Minuten, Auskunft innerhalb von 24 Stunden, Kartenantrag vorbereitet, sobald sie trägt." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/preise" still>Preise</Knopf></>} />
    </Dunkel>
  );
}
