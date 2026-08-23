// ═══════════════════════════════════════════════════════════════════════════
// /privatkunden — die meistbesuchte Seite, neu gebaut (23.08.2026, Justin:
// „komplett neu, PERFEKT, High End — und pitche stark die Kreditkarte.
// Wer hier ein Paket wählt, startet direkt in der Antragssequenz.")
//
// Dramaturgie: Die Karte ist das Ziel, FIAON der Weg. Hero mit der Karte →
// Zahlen → der Weg in vier Etappen → die Pakete (ein Klick = Antrag, Schritt 1,
// Paket gesetzt) → was FIAON tut → ehrlicher Vergleich → die Karte im Detail
// (Readiness) → Vertrauen → Fragen → Abschluss. Wenig Text je Block, jeder
// Satz in Sie-Form, keine Versprechen: Über Konto, Karte und Rahmen entscheidet
// die Bank — FIAON bereitet vor.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Licht, Szenenbild } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import { paket as paketVon, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import "@/styles/privatkunden.css";

const preis = (key: string) => ((paketVon(key)?.preisCents ?? 0) / 100).toFixed(2).replace(".", ",");

const PAKETE = [
  { key: "start", name: "FIAON Start", sub: "Der Einstieg", lim: 500, ziel: "Wissen, was gespeichert ist", bg: "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)",
    feats: ["Auskunft bei SCHUFA, KSV oder CRIF – beschafft und erklärt", "Kontoauszug-Analyse mit Ihrem Spielraum", "Ihr Bereich mit Fahrplan", "Unterstützung per E-Mail"] },
  { key: "pro", name: "FIAON Pro", sub: "Standard", lim: 5000, rec: true, ziel: "Einträge bereinigen, Konto eröffnen", bg: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)",
    feats: ["Alles aus Start", "Löschanträge und Widersprüche – vorbereitet, versendet, verfolgt", "Ratenvereinbarungen mit Antwort-Verfolgung", "Startgespräch und feste Ansprechpartnerin", "Girokonto für jeden Kunden"] },
  { key: "ultra", name: "FIAON Ultra", sub: "Mit Karte", lim: 15000, ziel: "Kreditkarte bis 15.000 € bei guter Bonität", bg: "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)",
    feats: ["Alles aus Pro", "Begleitung bis zur Kreditkarte – Readiness, Meilensteine, Antrag", "Bevorzugte Bearbeitung Ihrer Schreiben", "Telefonische Betreuung"] },
  { key: "highend", name: "FIAON High End", sub: "Das Maximum", lim: 25000, ziel: "Karte bis 25.000 €, Finanzierung, persönliche Betreuung", bg: "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)",
    feats: ["Alles aus Ultra", "Persönlicher Betreuer für Ihre Akte", "Vorbereitung auf Finanzierungen", "Erreichbar auch außerhalb der Bürozeiten"] },
];

function Readiness() {
  const [p, setP] = useState(0);
  useEffect(() => { const t = setTimeout(() => setP(72), 400); return () => clearTimeout(t); }, []);
  const r = 78, u = 2 * Math.PI * r;
  return (
    <div className="pk-ready">
      <svg viewBox="0 0 180 180" width="180" height="180" aria-hidden="true">
        <defs><linearGradient id="pkRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#60a5fa" /><stop offset="1" stopColor="#2563eb" /></linearGradient></defs>
        <circle cx="90" cy="90" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="10" />
        <circle cx="90" cy="90" r={r} fill="none" stroke="url(#pkRing)" strokeWidth="10" strokeLinecap="round" strokeDasharray={u} strokeDashoffset={u * (1 - p / 100)} transform="rotate(-90 90 90)" style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="pk-ready-mitte"><b className="zahl">{p}%</b><small>Karten-Readiness</small></div>
    </div>
  );
}

export default function Privatkunden() {
  const start = (key: string) => { try { sessionStorage.setItem("fiaon_paket", key); } catch { /* egal */ } window.location.href = `/antrag?pack=${key}&src=privatkunden`; };
  return (
    <Dunkel seite="privatkunden" titel="Privatkunden · Bonität, Konto, Kreditkarte" beschreibung="Einträge bereinigen, Girokonto eröffnen, Kreditkarte bis 25.000 € – FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, versendet die Schreiben und öffnet die Tür. Pakete ab 7,99 € im Monat.">
      <Hero
        bild="/kino/karte.jpg"
        pille="Für Privatkunden · Deutschland, Österreich, Schweiz"
        titel={<>Die Kreditkarte, die am Ende <span className="dk-verlauf">Ihrer Bonität wartet.</span></>}
        lead="Ein Eintrag ist kein Urteil. FIAON beschafft Ihre Auskunft, erklärt jeden Eintrag, lässt angreifbare löschen – und öffnet dann die Tür: Girokonto sofort, Kreditkarte, sobald Ihr Wert reicht."
        knoepfe={<><Knopf href="#pakete">Paket wählen</Knopf><Knopf href="/werkzeuge/eintrag-pruefen" still>Ist mein Eintrag angreifbar?</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: "24 h", label: "bis Sie sehen, was SCHUFA, KSV oder CRIF über Sie gespeichert haben" },
          { wert: "25.000 €", label: "Kreditkarten-Rahmen, der bei guter Bonität erreichbar wird" },
          { wert: "0 Formulare", label: "FIAON stellt die Anfrage bei der Auskunftei für Sie" },
          { wert: "12 Raten", label: "monatlich per Lastschrift – danach entscheiden Sie, ob Sie bleiben" },
        ]} />
      </Block>

      <Block id="weg" pille="Der Weg" titel={<>Vier Etappen. <span className="dk-verlauf">Ein Ziel.</span></>}
             lead="Niemand bekommt eine Karte, weil er sie beantragt. Er bekommt sie, weil seine Akte sie trägt. Genau daran arbeitet FIAON – in dieser Reihenfolge.">
        <Schritte items={[
          { titel: "Einsicht", text: "Ihre Auskunft, innerhalb von 24 Stunden, jeder Eintrag erklärt: berechtigt, bezahlt-aber-nicht-gelöscht, ohne Mahnung gemeldet, falsch." },
          { titel: "Aktion", text: "Löschanträge, Widersprüche, Ratenvereinbarungen – anwaltlich geprüft, von Ihnen freigegeben, per Einschreiben versendet. FIAON hält jede Frist." },
          { titel: "Konto", text: "Ein Girokonto für jeden Kunden, unabhängig von der Bonität. Ab hier läuft Ihr Zahlungsverhalten sauber – das zählt für jede Bank." },
          { titel: "Karte", text: "Aus Einträgen, Einkommen und Kontoverhalten berechnet FIAON Ihre Readiness. Reicht der Wert, ist der Antrag beim Kartenpartner vorbereitet." },
        ]} />
      </Block>

      <Licht>
        <Block id="pakete" pille="Ihr Paket" titel={<>Wählen Sie, wie weit Sie gehen. <span className="dk-verlauf">Nicht, ob.</span></>}
               lead="Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto näher rückt die Karte. Ein Klick – und Sie sind im Antrag, Schritt 1, Paket gesetzt." mitte>
          <div className="pk-pakete">
            {PAKETE.map((p, i) => (
              <Auf key={p.key} verzoegerung={i * 90}>
                <button type="button" className="pk-paket" data-top={p.rec ? "1" : undefined} onClick={() => start(p.key)} aria-label={`${p.name} wählen und Antrag starten`}>
                  {p.rec && <span className="band">Beliebt</span>}
                  <div className="pk-karte" style={{ background: p.bg }}>
                    <span className="chip" /><span className="wort">FIAON</span>
                    <span className="limit">{p.lim.toLocaleString("de-DE")} €</span>
                    <span className="inhaber">Ziel-Rahmen</span>
                  </div>
                  <p className="name">{p.name}</p>
                  <p className="sub">{p.sub}</p>
                  <p className="betrag dk-verlauf zahl">{preis(p.key)} €<small>/ Monat</small></p>
                  <p className="ziel">Ziel: {p.ziel}</p>
                  <ul className="dk-liste">{p.feats.map((f) => <li key={f}>{f}</li>)}</ul>
                  <span className={`dk-knopf${p.rec ? "" : " still"}`}>Mit {p.name.replace("FIAON ", "")} starten</span>
                </button>
              </Auf>
            ))}
          </div>
          <p className="dk-leise" style={{ marginTop: 26, maxWidth: "72ch", marginLeft: "auto", marginRight: "auto" }}>
            Alle Pakete: monatlich per SEPA-Lastschrift oder Überweisung · zwölf Raten, danach entscheiden Sie · Paket im Antrag jederzeit änderbar · Nur die Auskunft? Bonitätsauskunft {SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig. Über Konto, Karte und Rahmen entscheidet immer die Bank.
          </p>
        </Block>

        <Block pille="Was FIAON für Sie tut" titel={<>Einsicht. Aktion. <span className="dk-verlauf">Zugang.</span></>} mitte>
          <div style={{ textAlign: "left" }}>
            <Karten items={[
              { tag: "Schicht 1 · Einsicht", titel: "Die Auskunft, erklärt.", text: "FIAON stellt die Anfrage bei SCHUFA, KSV oder CRIF und liest Ihren Kontoauszug. Sie sehen, was gespeichert ist – und was sich ändern lässt. Ohne Fachsprache." },
              { tag: "Schicht 2 · Aktion", titel: "Schreiben, die wirken.", text: "Für jeden angreifbaren Eintrag liegt das passende Schreiben bereit. Sie geben frei, FIAON versendet per Einschreiben, verfolgt Antwort und Frist – bis zur Datenschutzbehörde." },
              { tag: "Schicht 3 · Zugang", titel: "Konto, Karte, Finanzierung.", text: "Girokonto für jeden Kunden, Kreditkarte, sobald Ihre Readiness die Schwelle erreicht, Finanzierung später. Jeder hat ein nächstes Ziel." },
            ]} />
          </div>
        </Block>

        <Block pille="Ehrlicher Vergleich" titel={<>Was andere tun – <span className="dk-verlauf">und was FIAON tut.</span></>} mitte>
          <div className="pk-vergleich">
            <table>
              <thead><tr><th></th><th>Score-App</th><th>Anwalt</th><th className="fiaon">FIAON</th></tr></thead>
              <tbody>
                {[
                  ["Auskunft beschaffen", "Sie selbst", "Sie selbst", "FIAON, in 24 h"],
                  ["Jeden Eintrag einordnen", "–", "im Einzelfall", "jeder, mit Erfolgsaussicht"],
                  ["Schreiben versenden, Fristen halten", "–", "ja, je Stunde", "inklusive, per Einschreiben"],
                  ["Girokonto", "–", "–", "für jeden Kunden"],
                  ["Weg zur Kreditkarte", "–", "–", "Readiness, Meilensteine, Antrag"],
                  ["Ein Mensch mit Namen", "–", "ja", "Startgespräch + feste Ansprechpartnerin"],
                  ["Preis", "0–10 €/Mt.", "150–300 €/Std.", "ab 7,99 €/Mt."],
                ].map((z) => <tr key={z[0]}><td>{z[0]}</td><td>{z[1]}</td><td>{z[2]}</td><td className="fiaon">{z[3]}</td></tr>)}
              </tbody>
            </table>
          </div>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/karte.jpg" titel={<>Die Karte ist <span className="dk-verlauf">kein Zufall.</span></>} text="Sie ist das Ergebnis einer Akte, die in Ordnung ist. FIAON macht aus „irgendwann vielleicht“ einen Wert, den Sie jeden Monat steigen sehen." />

      <Block id="karte" pille="Die Kreditkarte" titel={<>So nah ist <span className="dk-verlauf">Ihre Karte.</span></>}
             lead="FIAON berechnet aus Einträgen, Einkommen und Kontoverhalten Ihre Karten-Readiness – und zeigt, welcher Schritt sie wie weit bewegt. Kein Versprechen, sondern ein Fortschrittsbalken, der steigt.">
        <div className="dk-zweispaltig" style={{ marginTop: 48, alignItems: "center" }}>
          <div className="pk-ready-text">
            <div className="dk-raster zwei" style={{ marginTop: 0 }}>
              {[
                { tag: "Heute", titel: "Girokonto", text: "Für jeden Kunden, unabhängig von der Bonität. Mit Debitkarte – online, im Ausland, im Alltag." },
                { tag: "In Reichweite", titel: "Kreditkarte bis 5.000 €", text: "Sobald angreifbare Einträge gefallen sind und das Konto einige Monate sauber läuft." },
                { tag: "Das Ziel", titel: "Bis 25.000 € Rahmen", text: "Bei guter Bonität, über unseren Kartenpartner – Antrag aus Ihrer Akte heraus, vorausgefüllt." },
                { tag: "Ohne Risiko", titel: "Keine Abfrage, die schadet", text: "Die Vorqualifizierung läuft über Ihre FIAON-Daten. Erst wenn es passt, stellt die Bank die Anfrage." },
              ].map((k, i) => <Auf key={k.titel} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
            </div>
          </div>
          <Auf verzoegerung={150}><div className="pk-ready-buehne"><Readiness /><p>Beispiel: Ein Kunde nach vier Monaten – ein Eintrag gelöscht, einer läuft. Die Karte ist in rund drei Monaten realistisch.</p></div></Auf>
        </div>
      </Block>

      <Block pille="Ihr Vertrauen" titel={<>Geführt wie ein Finanzinstitut. <span className="dk-verlauf">Gebaut wie eine App.</span></>}
             lead="FIAON LTD mit Sitz in London, Kunden in Deutschland, Österreich und der Schweiz. Jedes Schreiben anwaltlich geprüft, jede Zahlung per SEPA, jede Akte verschlüsselt in der EU.">
        <div className="dk-raster" style={{ marginTop: 48 }}>
          {[
            { tag: "01", titel: "Anwaltlich geprüft", text: "Jede Vorlage ist vom Anwaltsteam freigegeben. Kein Schreiben geht hinaus, ohne dass Sie es freigeben." },
            { tag: "02", titel: "Ein Mensch am Telefon", text: "Jeder Kunde beginnt mit einem Startgespräch. Danach kennen Sie Ihre Ansprechpartnerin mit Namen." },
            { tag: "03", titel: "Ehrlich bis zum Nein", text: "Berechtigte Einträge lassen sich nicht weglöschen. Wir sagen es – und zeigen, was stattdessen geht." },
          ].map((k, i) => <Auf key={k.tag} verzoegerung={i * 80}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
      </Block>

      <Block eng schmal>
      </Block>

      <Zwischenruf text="Unsicher, welches Paket passt? Wählen Sie eines – im Startgespräch prüfen wir es gemeinsam und ändern es, wenn nötig." knopf="Paket wählen" href="#pakete" still={{ knopf: "Erst die Auskunft", href: "/bonitaet" }} />

      <Block schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Bekomme ich garantiert eine Kreditkarte?", a: "Nein – über Karte und Rahmen entscheidet die Bank. Was FIAON tut: Ihre Akte in Ordnung bringen, Ihre Readiness berechnen und den Antrag vorbereiten, wenn es realistisch ist. Ein Girokonto bekommt jeder Kunde." },
          { f: "Wie schnell sehe ich meine Auskunft?", a: "In der Regel innerhalb von 24 Stunden nach der Aktivierung. FIAON stellt die Anfrage bei SCHUFA, KSV oder CRIF mit Ihrer Vollmacht – Sie füllen kein Formular aus." },
          { f: "Was passiert, wenn ein Eintrag berechtigt ist?", a: "Dann sagen wir es. Berechtigte Einträge verschwinden, wenn die Forderung erledigt ist und die Frist abläuft – seit 2024 schon nach 18 Monaten, wenn Sie innerhalb von 100 Tagen nach der Meldung zahlen. FIAON hilft bei Ratenvereinbarung und Erledigungsvermerk." },
          { f: "Was kostet es – und wie lange bin ich gebunden?", a: `Pakete ab ${preis("start")} € im Monat, zwölf Raten per Lastschrift. Nach der zwölften fragen wir, ob Sie bleiben. Nur die Auskunft: ${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig.` },
          { f: "Kann ich das Paket später ändern?", a: "Ja – im Antrag direkt, und im Startgespräch prüfen wir gemeinsam, ob es passt." },
          { f: "Gilt das auch in Österreich und der Schweiz?", a: "Ja. FIAON arbeitet mit KSV1870 und CRIF (Österreich) sowie CRIF und Intrum (Schweiz). Die Rechte aus DSGVO bzw. DSG sind vergleichbar, die Fristen unterscheiden sich – wir kennen beide." },
          { f: "Was braucht FIAON von mir?", a: "Für den Antrag nur wenige Angaben. Danach Ausweis und Kontoauszug der letzten drei Monate – ein Handyfoto genügt. Die Auskunft beschafft FIAON." },
          { f: "Wie erreiche ich meine Ansprechpartnerin?", a: "Im Bereich, per E-Mail, telefonisch – und für viele Kunden per WhatsApp. Jede Frage landet bei der Person, die Ihre Akte kennt." },
        ]} />
      </Block>

      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einem Klick.</span></>}
                 text="Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie bis zur Karte begleitet."
                 knoepfe={<><Knopf href="#pakete">Paket wählen</Knopf><Knopf href="/demo/kundenbereich" still>Den Bereich ansehen</Knopf></>} />
    </Dunkel>
  );
}
