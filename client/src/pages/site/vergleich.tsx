// ═══════════════════════════════════════════════════════════════════════════
// /vergleich — FIAON, Anwalt, Score-App, Selbermachen (02.09.2026, E-083)
//
// Seite 4 im Zehn-Seiten-Plan. Suchintentionen: „schufa eintrag löschen
// anwalt kosten", „bonify alternative", „schufa eintrag löschen lassen
// anbieter". Vergleichsseiten ranken, weil sie die Entscheidung abnehmen —
// und sie konvertieren nur, wenn sie ehrlich sind: Der Anwalt ist bei
// Klage und Schadensersatz besser, Selbermachen reicht bei einem klaren
// Eintrag, die Score-App zeigt kostenlos. Keine Anbieternamen außer den
// allgemein bekannten Kategorien; keine Herabsetzung.
// Werkzeug: Entscheidungsbaum mit drei Fragen → Empfehlung des Wegs (nicht
// des Anbieters) — die Wortregel „empfehlen" wird vermieden: „passt zu".
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Karten, Fragen, Glas, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Wann ist der Anwalt der bessere Weg?", a: "Wenn die Auskunftei eine eindeutig unzulässige Meldung trotz Löschantrag nicht löscht, wenn Schadensersatz nach Art. 82 DSGVO im Raum steht oder wenn bereits geklagt wird. Dann braucht es jemanden, der vor Gericht auftreten darf. FIAON ist keine Rechtsberatung – und sagt Ihnen, wenn dieser Punkt erreicht ist." },
  { f: "Was kostet ein Anwalt für einen SCHUFA-Eintrag?", a: "Ein anwaltliches Schreiben nach RVG liegt je nach Gegenstandswert typischerweise bei 150 bis 300 Euro; Erstberatungen werden oft pauschal bis 190 Euro angeboten. Bei mehreren Einträgen und Nachfassen summiert sich das schnell. Rechtsschutzversicherungen decken Datenschutzstreitigkeiten teils ab – fragen Sie vorher nach." },
  { f: "Reicht eine kostenlose Score-App?", a: "Zum Anschauen ja: Score, Einträge, Warnungen. Zum Handeln nein: Keine App schreibt den Löschantrag, verfolgt die Frist oder verhandelt Raten. Nutzen Sie die App für die Einsicht – und die kostenlosen FIAON-Werkzeuge oder ein Paket für die Aktion." },
  { f: "Kann ich das wirklich alles selbst machen?", a: "Ja. Die Datenkopie ist kostenlos, die Gesetze sind öffentlich, und die 20 FIAON-Werkzeuge schreiben die Briefe. Was Sie mitbringen müssen: Zeit (rund drei Stunden je Eintrag), Disziplin beim Nachfassen und die Bereitschaft, Fristen selbst im Blick zu behalten." },
  { f: "Was unterscheidet FIAON von einem Anwalt?", a: "FIAON ist Verfolgung und Weg: Auskunft beschaffen, jeden Eintrag einordnen, anwaltlich geprüfte Schreiben versenden, Antworten nachhalten, Ratenangebote, Konto und Karte vorbereiten – zu einem Festpreis über zwölf Raten. Ein Anwalt vertritt Sie rechtlich im Einzelfall und darf klagen. Beides schließt sich nicht aus." },
];

type Antwort = Record<string, string>;
const BAUM = [
  { key: "lage", frage: "Was beschreibt Ihre Lage am besten?", optionen: [["klar", "Ein Eintrag, klarer Fall (bezahlt, aber noch da)"], ["mehrere", "Mehrere Einträge oder Inkassobriefe"], ["streit", "Die Auskunftei hat eine Löschung bereits abgelehnt"], ["nur", "Ich will nur wissen, wo ich stehe"]] },
  { key: "zeit", frage: "Wie viel Zeit haben Sie für Briefe, Fristen und Nachfassen?", optionen: [["viel", "Genug – ich mache das gern selbst"], ["wenig", "Wenig – ich will es abgeben"]] },
  { key: "ziel", frage: "Was soll am Ende stehen?", optionen: [["sauber", "Eine saubere Auskunft"], ["konto", "Konto oder Karte"], ["recht", "Schadensersatz oder ein Urteil"]] },
];
function weg(a: Antwort): { titel: string; text: string; href: string; knopf: string } | null {
  if (!a.lage || !a.zeit || !a.ziel) return null;
  if (a.ziel === "recht" || a.lage === "streit") return { titel: "Ein Anwalt passt zu Ihrer Lage.", text: "Eine bereits abgelehnte Löschung oder ein Schadensersatzanspruch nach Art. 82 DSGVO gehört zu jemandem, der klagen darf. Nehmen Sie Ihre Datenkopie, den Löschantrag und die Ablehnung mit – der Widerspruch-Generator liefert die Vorstufe kostenlos. Prüfen Sie, ob eine Rechtsschutzversicherung Datenschutzstreitigkeiten deckt.", href: "/werkzeuge/widerspruch", knopf: "Löschantrag als Vorstufe" };
  if (a.lage === "nur") return { titel: "Die kostenlose Datenkopie passt – plus eine Score-App zum Beobachten.", text: "Sie wollen wissen, wo Sie stehen: Datenkopie nach Art. 15 DSGVO (kostenlos, der Generator schreibt den Brief) und der kostenlose SCHUFA-Account für den Score. FIAON brauchen Sie erst, wenn etwas zu tun ist – oder wenn Sie die Auskunft erklärt haben möchten (74 Euro).", href: "/werkzeuge/selbstauskunft", knopf: "Datenkopie anfordern" };
  if (a.lage === "klar" && a.zeit === "viel") return { titel: "Selbermachen passt – mit den kostenlosen Werkzeugen.", text: "Ein klarer Eintrag, Zeit zum Nachfassen: Der Löschantrag-Generator schreibt beide Briefe, der Löschfrist-Rechner das Datum. Zwei Einschreiben, vier Wochen Geduld, notfalls die Datenschutzaufsicht. Das ist ehrlich gesagt der günstigste Weg.", href: "/werkzeuge/widerspruch", knopf: "Löschantrag erzeugen" };
  if (a.ziel === "konto") return { titel: "FIAON Pro passt – wegen des Wegs nach der Auskunft.", text: "Konto und Karte entstehen aus der Akte: bereinigte Einträge, Kontoführung, Zahlungshistorie. Das ist genau der Teil, den weder Anwalt noch App noch Werkzeug abdecken – FIAON bereitet Konto und Karte beim Partnerinstitut vor, die Bank entscheidet.", href: "/preise#finder", knopf: "Paket ansehen" };
  return { titel: "FIAON passt – Verfolgung statt Selbermachen.", text: "Mehrere Einträge oder wenig Zeit: Der Unterschied zwischen einem Brief und einer bereinigten Auskunft ist das Nachfassen. FIAON beschafft, prüft, versendet per Einschreiben, hält Fristen und eskaliert – zum Festpreis über zwölf Raten, monatlich kündbar.", href: "/preise", knopf: "Preise ansehen" };
}

export default function Vergleich() {
  const [a, setA] = useState<Antwort>({});
  const w = useMemo(() => weg(a), [a]);
  return (
    <Dunkel seite="privatkunden" titel="Vergleich · FIAON, Anwalt, Score-App oder selbst?" beschreibung="SCHUFA-Eintrag löschen lassen: FIAON, Anwalt, Score-App oder Selbermachen im ehrlichen Vergleich – Kosten, Dauer, Verfolgung, Konto danach. Mit Entscheidungshilfe in drei Fragen.">
      <SeoDaten pfad="/vergleich" titel="FIAON, Anwalt, Score-App oder selbst? Der Vergleich" beschreibung="SCHUFA-Eintrag löschen lassen: FIAON, Anwalt, Score-App oder Selbermachen im ehrlichen Vergleich – Kosten, Dauer, Verfolgung, Konto danach. Mit Entscheidungshilfe." fragen={FRAGEN} krumen={[{ name: "Vergleich", pfad: "/vergleich" }]} />

      <Hero
        bild="/kino/akten.jpg"
        pille="Der ehrliche Vergleich"
        titel={<>Anwalt, App, selbst – <span className="dk-verlauf">oder FIAON?</span></>}
        lead="Vier Wege führen zu einer sauberen Auskunft, und keiner ist immer der richtige. Hier stehen Kosten, Dauer und Grenzen nebeneinander – inklusive der Fälle, in denen Sie uns nicht brauchen."
        knoepfe={<><Knopf href="#entscheiden">Was passt zu mir?</Knopf><Knopf href="#tabelle" still>Die Tabelle</Knopf></>}
      />

      <Licht>
        <Block id="tabelle" titel={<>Vier Wege <span className="dk-verlauf">nebeneinander.</span></>} lead="Richtwerte, Stand September 2026. Anwaltskosten nach RVG je Gegenstandswert; App-Angaben für kostenlose Score-Apps.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col"></th><th scope="col">Selbst + Werkzeuge</th><th scope="col">Score-App</th><th scope="col">Anwalt</th><th scope="col">FIAON</th></tr></thead>
              <tbody>
                <tr><td>Kosten</td><td>0 € + Porto</td><td>0 €</td><td>150–300 € je Schreiben</td><td>74 € Auskunft · 7,99–99,99 €/Monat, 12 Raten</td></tr>
                <tr><td>Auskunft beschaffen</td><td>selbst, kostenlos</td><td>zeigt Score</td><td>meist selbst</td><td>FIAON, mit Vollmacht, DE/AT/CH</td></tr>
                <tr><td>Jeden Eintrag einordnen</td><td>mit Eintrag-Prüfer</td><td>nein</td><td>ja, im Einzelfall</td><td>ja, Klartext je Eintrag</td></tr>
                <tr><td>Löschantrag schreiben</td><td>Generator (Muster)</td><td>nein</td><td>ja, individuell</td><td>ja, anwaltlich geprüfte Vorlage</td></tr>
                <tr><td>Versand, Nachfassen, Fristen</td><td>selbst</td><td>nein</td><td>gegen Honorar</td><td>inklusive (ab Pro)</td></tr>
                <tr><td>Ratenvereinbarungen</td><td>Ratenplan-Rechner</td><td>nein</td><td>gegen Honorar</td><td>inklusive (ab Pro)</td></tr>
                <tr><td>Klage, Schadensersatz</td><td>nein</td><td>nein</td><td><b>ja</b></td><td>nein – Verweis an Anwalt</td></tr>
                <tr><td>Konto und Karte danach</td><td>Basiskonto selbst</td><td>Produktangebote</td><td>nein</td><td><b>vorbereitet, Bank entscheidet</b></td></tr>
                <tr><td>Fester Ansprechpartner</td><td>–</td><td>–</td><td>Kanzlei</td><td>ja, mit Namen</td></tr>
                <tr><td>Dauer bis Löschung (klarer Fall)</td><td>4–8 Wochen</td><td>–</td><td>4–8 Wochen</td><td>4–8 Wochen</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>Die Dauer hängt an der Auskunftei (ein Monat Antwortfrist nach Art. 12 DSGVO), nicht am Weg. Kein Weg löscht berechtigte, zulässig gemeldete Einträge vor der Frist.</p>
        </Block>

        <Block id="entscheiden" schmal titel={<>Drei Fragen, <span className="dk-verlauf">ein Weg.</span></>} lead="Keine Verkaufslogik: Zwei der vier Antworten führen weg von FIAON.">
          <div className="wz-fragen">
            {BAUM.map((f, i) => (
              <div key={f.key} className="wz-frage">
                <p className="wz-nr">Frage {i + 1}</p><h3>{f.frage}</h3>
                <div className="wz-optionen zwei">{f.optionen.map(([k, l]) => <button key={k} type="button" className={`wz-option${a[f.key] === k ? " an" : ""}`} onClick={() => setA({ ...a, [f.key]: k })}><b>{l}</b></button>)}</div>
              </div>
            ))}
          </div>
          {w && (
            <div className="wz-ergebnis gut">
              <span className="wz-stufe" style={{ background: "#047857" }}>Ihr Weg</span>
              <h3>{w.titel}</h3>
              <p>{w.text}</p>
              <div className="wz-knoepfe"><Knopf href={w.href}>{w.knopf}</Knopf><Knopf href="/termin" still>Lieber erst reden</Knopf></div>
            </div>
          )}
        </Block>

        <Block titel={<>Die drei Alternativen – <span className="dk-verlauf">fair betrachtet.</span></>} lead="Jede hat ihren Platz. Das hier ist keine Abwertung, sondern eine Einordnung.">
          <Karten items={[
            { tag: "Selbermachen", titel: "Der günstigste Weg – wenn Sie dranbleiben", text: "Datenkopie kostenlos, 20 Werkzeuge für Briefe und Fristen, Gesetze öffentlich. Was fehlt: jemand, der nachfasst, wenn nach vier Wochen nichts kommt, und der weiß, wann die Datenschutzaufsicht dran ist. Bei einem klaren Eintrag: machen Sie es selbst." },
            { tag: "Score-App", titel: "Sehen, nicht handeln", text: "Kostenlose Apps zeigen Score und Einträge und warnen bei Änderungen – seit 2026 auch der neue SCHUFA-Score mit zwölf Kriterien. Den Löschantrag, den Widerspruch, die Ratenvereinbarung schreibt keine. Verbraucherschützer kritisieren zudem Produktangebote in den Apps." },
            { tag: "Anwalt", titel: "Unersetzlich, wenn es streitig wird", text: "Vor Gericht, bei Schadensersatz, bei einer Auskunftei, die sich weigert: Nur ein Anwalt darf Sie vertreten. Für den ersten Löschantrag ist er oft teurer als nötig – für die Klage danach die einzige Wahl. FIAON verweist an diesem Punkt weiter." },
          ]} />
        </Block>

        <Block schmal>
          <Glas ruhig tag="Was FIAON nicht ist" titel="Damit der Vergleich ehrlich bleibt">
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>FIAON ist keine Rechtsberatung, keine Bank und kein Kreditvermittler. FIAON beschafft, erklärt, schreibt aus geprüften Vorlagen, versendet, verfolgt, verhandelt Raten und bereitet Konto und Karte vor – zum Festpreis, monatlich kündbar. Wo ein Fall vor Gericht gehört, sagen wir es. Wo die Werkzeuge reichen, auch. Mehr dazu auf <a href="/fiaon-erfahrungen" style={{ color: "#1d4ed8" }}>So arbeitet FIAON</a>.</p>
          </Glas>
        </Block>

        <Block schmal titel="Häufige Fragen zum Vergleich"><Fragen items={FRAGEN} /></Block>
      </Licht>

      <Zwischenruf text={<><b>Unsicher, welcher Weg?</b> 15 Minuten am Telefon – wir sagen auch, wenn Sie uns nicht brauchen.</>} knopf="Startgespräch buchen" href="/termin" still={{ knopf: "Kostenlose Werkzeuge", href: "/werkzeuge" }} />
    </Dunkel>
  );
}
