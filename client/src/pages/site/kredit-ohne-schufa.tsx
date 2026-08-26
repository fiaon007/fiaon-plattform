// ═══════════════════════════════════════════════════════════════════════════
// /kredit-ohne-schufa — der ehrliche Pfeiler zum härtesten Suchwort
// (26.08.2026)
//
// „Kredit ohne Schufa" wird hunderttausendfach gesucht — und die Treffer
// sind fast durchweg Lockangebote. Diese Seite gewinnt nicht, indem sie
// dasselbe verspricht, sondern indem sie als Einzige erklärt, was wirklich
// dahintersteckt: was es gibt, was es kostet, woran man Betrug erkennt —
// und dass der bessere Weg fast immer ist, die Auskunft in Ordnung zu
// bringen, statt sie zu umgehen. YMYL-Seiten gewinnen mit Vertrauen.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten, Schritte } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const FRAGEN = [
  { f: "Gibt es seriöse Kredite ohne SCHUFA?", a: "Ja, aber nur eine schmale Kategorie: sogenannte Schweizer Kredite ausländischer Banken, die keine SCHUFA-Abfrage stellen und nicht an sie melden. Sie sind auf kleine Summen begrenzt (meist 3.500 bis 7.500 Euro), deutlich teurer als normale Ratenkredite und setzen ein pfändbares Einkommen voraus. Ohne festes Einkommen gibt es auch dort nichts — wer anderes verspricht, verkauft kein Darlehen, sondern eine Falle." },
  { f: "Woran erkenne ich unseriöse Anbieter?", a: "An drei Mustern: Vorkosten (Gebühren, Auslagen oder „Versicherungen“, die vor der Auszahlung fällig werden), Hausbesuche oder Vertreterverträge mit Nebenprodukten, und Garantieversprechen wie „100 % Zusage trotz negativer Schufa“. Seriöse Kreditgeber verlangen niemals Geld, bevor Geld fließt." },
  { f: "Was kostet ein Kredit ohne SCHUFA?", a: "Deutlich mehr: Die effektiven Jahreszinsen liegen üblicherweise zwischen 10 und 16 Prozent — beim regulären Ratenkredit mit ordentlicher Bonität sind es 5 bis 9. Auf 5.000 Euro über 40 Monate macht das schnell 1.000 Euro und mehr Unterschied." },
  { f: "Sieht meine Bank, dass ich einen Kredit ohne SCHUFA aufgenommen habe?", a: "In der Auskunftei nicht — genau das ist der Zweck. Aber die Rate erscheint auf Ihrem Kontoauszug, und bei jeder späteren Kreditprüfung zählt sie in der Haushaltsrechnung mit. Verschwiegene Raten, die dort auftauchen, kosten mehr Vertrauen als ein erklärter Eintrag." },
  { f: "Was ist der bessere Weg?", a: "In den meisten Fällen: die Auskunft in Ordnung bringen statt sie umgehen. Viele Negativeinträge sind angreifbar — falsch gemeldet, verfristet oder ohne die gesetzlichen Voraussetzungen eingetragen. Ist die Auskunft sauber, steht der normale Kreditmarkt wieder offen, zu normalen Zinsen." },
  { f: "Hilft FIAON bei der Kreditvermittlung?", a: "Nein — FIAON vermittelt keine Kredite und verkauft keine Finanzprodukte. FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF, prüft jeden Eintrag auf Angreifbarkeit und setzt Löschung oder Berichtigung durch, wo die Rechtslage es hergibt. Das Ziel ist, dass Sie keinen Umgehungskredit brauchen." },
];

export default function KreditOhneSchufa() {
  return (
    <Dunkel seite="ratgeber" titel="Kredit ohne SCHUFA · Was wirklich dahintersteckt" beschreibung="Kredit ohne SCHUFA: Was es seriös gibt, was es kostet, woran Sie Betrug in 30 Sekunden erkennen – und warum der bessere Weg meist ist, die Auskunft in Ordnung zu bringen. Ehrlich erklärt, ohne Lockangebot.">
      <SeoDaten
        pfad="/kredit-ohne-schufa"
        titel="Kredit ohne SCHUFA · Was wirklich dahintersteckt"
        beschreibung="Was es seriös gibt, was es kostet, woran Sie Betrug erkennen – und der bessere Weg. Ehrlich erklärt, ohne Lockangebot."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "Kredit ohne SCHUFA: Was wirklich dahintersteckt", stand: "2026-08-26" }}
        krumen={[{ name: "Kredit ohne SCHUFA", pfad: "/kredit-ohne-schufa" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/tuer.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Ehrlich erklärt · kein Lockangebot</span>
          <h1 className="dk-h1">Kredit ohne SCHUFA — <span className="dk-verlauf">die ganze Wahrheit.</span></h1>
          <p className="dk-lead">Es gibt ihn. Er ist klein, teuer und streng geprüft — und um ihn herum steht die größte Betrugsindustrie des deutschen Kreditmarkts. Hier steht, was Sie wissen müssen, bevor Sie irgendwo unterschreiben.</p>
        </div>
      </section>
      <Licht>
        <Block titel="Was es seriös tatsächlich gibt" lead="Eine schmale Kategorie mit klaren Grenzen — alles darüber hinaus ist ein Warnsignal.">
          <Karten items={[
            { tag: "Der echte Fall", titel: "Der „Schweizer Kredit“", text: "Ausländische Banken (heute vor allem aus Liechtenstein) vergeben Kredite ohne SCHUFA-Abfrage und ohne Meldung. Feste Summen — üblich sind 3.500 bis 7.500 Euro —, feste Laufzeiten um 40 Monate, effektive Zinsen meist zweistellig. Voraussetzung ist ein unbefristetes, pfändbares Einkommen; geprüft wird streng, nur eben ohne Auskunftei." },
            { tag: "Die Grenze", titel: "Ohne Einkommen: nichts", text: "Auch ohne SCHUFA prüft jede seriöse Bank die Rückzahlungsfähigkeit — mit Gehaltsnachweisen und Kontoauszügen. Wer bei Arbeitslosigkeit, Probezeit oder laufender Insolvenz eine „Zusage“ bekommt, hat keinen Kredit bekommen, sondern ein Verkaufsgespräch." },
            { tag: "Der Preis", titel: "Teurer, immer", text: "10 bis 16 Prozent effektiv statt 5 bis 9 beim regulären Ratenkredit. Auf 5.000 Euro über 40 Monate ist das schnell ein vierstelliger Mehrpreis — Geld, das mit einer bereinigten Auskunft nicht anfiele." },
          ]} />
        </Block>

        <Block titel="Betrug in 30 Sekunden erkennen" lead="Drei Muster, ein Grundsatz: Seriöse Kreditgeber verlangen niemals Geld, bevor Geld fließt.">
          <Schritte items={[
            { titel: "Vorkosten", text: "Bearbeitungsgebühren, „Auslagen“, Wertgutachten oder Versicherungen, die VOR der Auszahlung fällig werden. Das ist das häufigste Muster — das Geld ist weg, der Kredit kommt nie." },
            { titel: "Hausbesuch und Nebenprodukte", text: "Ein Vermittler kommt vorbei und verkauft „zur Absicherung“ einen Bausparvertrag oder eine Versicherung. Die Provision dafür ist der eigentliche Zweck des Besuchs." },
            { titel: "Garantieversprechen", text: "„100 % Zusage“, „garantiert trotz negativer Schufa“, „ohne Einkommensnachweis“. Kein seriöser Kreditgeber garantiert eine Zusage vor der Prüfung — wer es tut, verdient am Antrag, nicht am Kredit." },
          ]} />
        </Block>

        <Zwischenruf text={<><b>Kurzer Realitätsabgleich gefällig?</b> Der Kreditrechner zeigt, was ein Angebot wirklich kostet — auch zum Zwei-Drittel-Zins.</>} knopf="Zum Kreditrechner" href="/werkzeuge/kreditrechner" />

        <Block titel="Der bessere Weg: die Auskunft in Ordnung bringen" lead="Der Umgehungskredit behandelt das Symptom. Die Ursache steht in Ihrer Auskunft — und ist oft angreifbar.">
          <Schritte items={[
            { titel: "Datenkopie anfordern", text: "Kostenlos nach Art. 15 DSGVO, bei allen Auskunfteien. Erst wer weiß, was gespeichert ist, kann handeln — unser Generator erzeugt das Schreiben in zwei Minuten." },
            { titel: "Jeden Eintrag prüfen", text: "Ein erheblicher Teil der Negativeinträge ist angreifbar: ohne die zwei vorgeschriebenen Mahnungen gemeldet, bestritten, verfristet oder schlicht falsch. Was angreifbar ist, kann gelöscht werden — und mit ihm der Grund für die Absage." },
            { titel: "Dann erst zum Kredit", text: "Mit bereinigter Auskunft und geordneten Unterlagen steht der normale Markt offen — zu Zinsen, die um Prozentpunkte unter dem Umgehungskredit liegen. Die Ersparnis bezahlt die Aufräumarbeit um ein Vielfaches." },
          ]} />
          <div className="dk-knoepfe" style={{ marginTop: 28 }}>
            <Knopf href="/werkzeuge/eintrag-pruefen">Eintrag kostenlos prüfen</Knopf>
            <Knopf href="/antrag" still>FIAON übernimmt das</Knopf>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen zum Kredit ohne SCHUFA">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            FIAON vermittelt keine Kredite und erhält keine Provisionen von Kreditgebern. Diese Seite ist eine redaktionelle
            Einordnung nach öffentlich zugänglichen Quellen (Stand August 2026) und keine Rechts- oder Anlageberatung.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Die Absage kam wegen der Auskunft?</b> FIAON beschafft sie, prüft jeden Eintrag und setzt durch, was angreifbar ist — damit der nächste Antrag ohne Umweg gelingt.</>} knopf="Auskunft prüfen lassen" href="/antrag" />
    </Dunkel>
  );
}
