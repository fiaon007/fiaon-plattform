// /datenraum — Due Diligence. Zeigt, WIE das Unternehmen geführt wird, bevor jemand Zahlen sieht.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";

export default function Datenraum() {
  return (
    <Dunkel seite="datenraum" titel="Datenraum · Due Diligence" beschreibung="FIAON wird geführt, als würde morgen verkauft: Entscheidungsregister, Logbuch, Kennzahlen, Verträge und Technik-Dokumentation – auf Anfrage unter NDA.">
      <Hero
        pille="Due Diligence"
        titel={<>Geführt, als würde <span className="dk-verlauf">morgen verkauft.</span></>}
        lead="Seit dem ersten Tag hält FIAON jede Entscheidung, jede Änderung und jede Zahl fest – nicht für den Verkauf, sondern weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Der Datenraum ist die Folge davon."
        knoepfe={<><Knopf href="#anfrage">Zugang anfragen</Knopf><Knopf href="#kapitel" still>Die sechs Kapitel</Knopf></>}
        szene={<SchichtenSzene namen={["Entscheidungen", "Logbuch", "Kennzahlen"]} className="absolute inset-0" />}
      />

      <Block pille="Prinzipien" titel={<>Drei Regeln, die <span className="dk-verlauf">jeden Tag gelten.</span></>}>
        <Karten items={[
          { tag: "Regel 1", titel: "Jede Entscheidung ist ein Eintrag.", text: "Das Entscheidungsregister hält fest, was beschlossen wurde, warum, welche Alternativen es gab und was es kostet. Nummeriert, datiert, unveränderlich." },
          { tag: "Regel 2", titel: "Jeder Tag hat ein Logbuch.", text: "Was gebaut, geändert, ausgerollt wurde – mit Uhrzeit und Ergebnis. Wer den Datenraum öffnet, kann die Geschichte des Unternehmens Tag für Tag nachlesen." },
          { tag: "Regel 3", titel: "Eine Quelle für jede Zahl.", text: "Preise, Provisionen, Kennzahlen: Es gibt genau eine Stelle, an der sie stehen. Website, Antrag, Rechnung und Akte lesen dieselbe Quelle. Zwei Kopien wären zwei Wahrheiten." },
        ]} />
      </Block>

      <Block id="kapitel" pille="Inhalt" titel={<>Sechs <span className="dk-verlauf">Kapitel.</span></>}
             lead="Der Datenraum ist wie ein Buch aufgebaut. Jedes Kapitel hat einen Index, jede Datei ein Datum.">
        <Karten items={[
          { tag: "01", titel: "Unternehmen", text: "FIAON LTD, London. Gründungsunterlagen, Gesellschafter, Director, Beschlüsse, Sitz und Vertretung." },
          { tag: "02", titel: "Finanzen", text: "Umsatz je Paket, Raten-Einzugsquote, offene Forderungen, Kosten, Planung. Monatlich aus der Plattform gezogen – keine Handarbeit." },
          { tag: "03", titel: "Produkt und Technik", text: "Architektur, Kundenweg, Agentenportal, Schnittstellen (Auskunfteien, SEPA, KI), Deploy-Protokolle, Testberichte." },
          { tag: "04", titel: "Recht und Datenschutz", text: "AGB, Widerruf, Datenschutz, Einwilligungen, Vorlagen der Schreiben mit anwaltlicher Freigabe, Verfahrensverzeichnis." },
          { tag: "05", titel: "Team und Verträge", text: "Organisation, Handelsvertreterverträge, Provisionsregeln, Academy-Inhalte, Dienstleister." },
          { tag: "06", titel: "Markt", text: "DACH-Marktdaten, Wettbewerb, Partnergespräche, Roadmap Österreich und Schweiz, Europa." },
        ]} />
      </Block>

      <Block eng>
        <Kennzahlen items={[
          { wert: "täglich", label: "Logbuch-Einträge – jede Änderung an Plattform und Betrieb" },
          { wert: "monatlich", label: "Kennzahlen-Auszug aus der Plattform, ohne manuelle Nacharbeit" },
          { wert: "jede", label: "Entscheidung im Register – seit dem ersten Tag nummeriert" },
          { wert: "1", label: "Quelle für Preise, Provisionen und Kennzahlen" },
        ]} />
      </Block>

      <Zwischenruf text="Die Plattform selbst ist der beste Beleg. Der Kundenweg ist öffentlich – vom Antrag bis zum Bereich." knopf="Startseite ansehen" href="/" still={{ knopf: "Für Investoren", href: "/investoren" }} />

      <Block pille="Ablauf" titel={<>Vom ersten Kontakt zum <span className="dk-verlauf">Gespräch.</span></>}>
        <Schritte items={[
          { titel: "Anfrage", text: "Sie nennen Name, Unternehmen und Zweck. Wir antworten innerhalb von zwei Werktagen – persönlich, nicht automatisch." },
          { titel: "NDA", text: "Eine kurze, beidseitige Vertraulichkeitsvereinbarung. Danach erhalten Sie den Index aller Kapitel." },
          { titel: "Zugang", text: "Schrittweise Freigabe der Kapitel, zugeschnitten auf Ihren Zweck. Jede Datei mit Datum und Verantwortlichem." },
          { titel: "Fragen und Gespräch", text: "Schriftliche Fragerunde, dann ein Gespräch mit der Geschäftsführung – mit der Plattform auf dem Bildschirm." },
        ]} />
      </Block>

      <Block pille="Was Sie erhalten" titel={<>Nicht Ordner. <span className="dk-verlauf">Antworten.</span></>} schmal>
        <Auf>
          <Glas ruhig>
            <ul className="dk-liste" style={{ marginTop: 0 }}>
              <li>Das vollständige Entscheidungsregister – jede Entscheidung mit Begründung, Alternativen und Kosten.</li>
              <li>Das Logbuch seit Tag 1 – was wann gebaut, geändert, ausgerollt wurde.</li>
              <li>Kennzahlen je Monat: Kunden, Pakete, Raten, Einzug, Schreiben, Antworten, Zugang.</li>
              <li>Alle Verträge und Vorlagen – inklusive der anwaltlich geprüften Schreiben an Auskunfteien und Gläubiger.</li>
              <li>Die Technik-Dokumentation: Architektur, Schnittstellen, Sicherheitskonzept, Deploy-Protokolle.</li>
              <li>Einen Ansprechpartner, der jede Frage innerhalb eines Werktags beantwortet.</li>
            </ul>
          </Glas>
        </Auf>
      </Block>

      <Block id="anfrage" pille="Zugang" titel={<>Zugang <span className="dk-verlauf">anfragen.</span></>}
             lead="Bitte nennen Sie uns den Zweck Ihrer Anfrage. Der Zugang wird nach Unterzeichnung einer Vertraulichkeitsvereinbarung freigeschaltet." schmal>
        <Anfrage art="datenraum" knopf="Zugang anfragen" hinweis="Vertraulich. Antwort innerhalb von zwei Werktagen."
                 felder={[
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "firma", label: "Unternehmen", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel" },
                   { name: "rolle", label: "Zweck", pflicht: true, optionen: ["Beteiligung", "Übernahme", "Partnerschaft", "Finanzierung", "Sonstiges"] },
                   { name: "kapitel", label: "Welche Kapitel zuerst?", optionen: ["Alle", "Finanzen", "Produkt und Technik", "Recht und Datenschutz", "Markt"] },
                   { name: "text", label: "Ihre Nachricht", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Warum ein Datenraum, wenn nicht verkauft wird?", a: "Weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Der Datenraum ist kein Projekt, sondern der Zustand, in dem FIAON immer ist." },
          { f: "Wie aktuell sind die Unterlagen?", a: "Das Logbuch täglich, die Kennzahlen monatlich, das Register bei jeder Entscheidung. Jede Datei trägt ihr Datum." },
          { f: "Wer sieht meine Anfrage?", a: "Justin Schwarzott persönlich. Ihre Angaben werden nicht weitergegeben und nicht für Werbung genutzt." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Transparenz ist kein Versprechen. <span className="dk-verlauf">Sie ist eine Gewohnheit.</span></>}
        text="Dieselbe Gewohnheit, mit der FIAON seinen Kunden ihre Auskunft zeigt, gilt für das Unternehmen selbst: Alles ist einsehbar, alles ist erklärbar, alles hat ein Datum."
        knoepfe={<><Knopf href="#anfrage">Zugang anfragen</Knopf><Knopf href="/investoren" still>Das Investment verstehen</Knopf></>}
      />
    </Dunkel>
  );
}
