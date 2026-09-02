// ═══════════════════════════════════════════════════════════════════════════
// /transparenz — der Transparenzbericht (02.09.2026, E-083)
//
// Seite 8 im Zehn-Seiten-Plan — das, was kein Marktteilnehmer hat:
// öffentliche Kennzahlen mit Definition, Stand und Herkunft. Was gemessen
// ist, steht mit Zahl; was noch nicht belastbar gemessen ist, steht als
// „in Messung" — nicht als Schätzung. Zahlen: Datenbank, nur bankbestätigt
// (E-075/E-082), Skript scripts/tmp/zahlen-oeffentlich.ts. Stand sichtbar.
// Nordstern-Kennzahlen (Definitionen von /investoren): Zeit bis zur ersten
// Einsicht, Antwortquote auf Schreiben, Graduation-Rate, Raten-Einzugsquote.
// Für die vier braucht es einen öffentlichen Endpunkt (bei TFO angefragt);
// bis dahin Definition + Status.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Kennzahlen, Zeilen, Karten, Glas, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const STAND = "2. September 2026";

const FRAGEN = [
  { f: "Warum veröffentlicht FIAON Kennzahlen?", a: "Weil Vertrauen prüfbar sein muss. Wer „Erfahrungen“ sucht, findet sonst nur Behauptungen. Hier stehen Zahlen mit Definition, Stand und Herkunft – und ehrlich das, was noch nicht belastbar gemessen ist." },
  { f: "Woher kommen die Zahlen?", a: "Aus der Datenbank der Plattform, mit derselben Definition, die das Chefbüro intern nutzt: zahlende Kunden nur mit bankbestätigter Zahlung und ohne Testkonten, Raten nur mit Zahlungsdatum. Abgerundet, nie geschätzt." },
  { f: "Wie oft wird aktualisiert?", a: "Alle vier Wochen, jeweils mit neuem Stand-Datum. Die vier Nordstern-Kennzahlen folgen, sobald sie über mindestens ein Quartal belastbar sind – Ziel ist ein Quartalsbericht." },
  { f: "Was veröffentlicht FIAON nicht?", a: "Keine Bewertungen, die es noch nicht gibt; keine Umsatzzahlen außerhalb des Datenraums für Investoren; keine Einzelfälle ohne Freigabe der Kunden. Und keine Zahl ohne Definition." },
];

export default function Transparenz() {
  return (
    <Dunkel seite="ratgeber" titel="Transparenzbericht · Zahlen mit Definition und Stand" beschreibung="Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition, Stand und Herkunft. Und was noch in Messung ist.">
      <SeoDaten pfad="/transparenz" titel="FIAON Transparenzbericht: Zahlen mit Definition und Stand" beschreibung="Was FIAON misst und veröffentlicht: zahlende Kunden, bezahlte Raten, Länder, Werkzeuge, Ratgeber – bankbestätigt, mit Definition, Stand und Herkunft. Und was noch in Messung ist." fragen={FRAGEN} krumen={[{ name: "Transparenzbericht", pfad: "/transparenz" }]} />

      <Hero
        bild="/kino/datenraum.jpg"
        pille="Transparenzbericht · Stand 2. September 2026"
        titel={<>Zahlen, die man <span className="dk-verlauf">nachrechnen kann.</span></>}
        lead="Kein Marktteilnehmer zeigt, wie viele Kunden wirklich bezahlt haben und wie viele Raten wirklich eingegangen sind. FIAON tut es – mit Definition, Stand und Herkunft. Und sagt, was noch nicht gemessen ist."
        knoepfe={<><Knopf href="#zahlen">Die Zahlen</Knopf><Knopf href="/fiaon-erfahrungen" still>So arbeitet FIAON</Knopf></>}
      />

      <Block id="zahlen" eng>
        <Kennzahlen items={[{ wert: "443", label: "zahlende Kunden, bankbestätigt" }, { wert: "450", label: "bezahlte Monatsraten" }, { wert: "267 · 150 · 4", label: "Kunden in DE · AT · CH" }, { wert: "20 · 57", label: "Werkzeuge · Ratgeber" }]} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>Stand {STAND}, gemessen in der Datenbank der Plattform. Nächste Aktualisierung Anfang Oktober 2026.</p>
      </Block>

      <Licht>
        <Block schmal titel={<>Jede Zahl mit <span className="dk-verlauf">Definition.</span></>} lead="So wird gezählt – damit Sie es nachrechnen könnten, wenn Sie die Datenbank hätten.">
          <Zeilen items={[
            ["Zahlende Kunden", "Personen mit mindestens einer Bestellung, deren Zahlung die Bank bestätigt hat; Testkonten und zusammengeführte Dubletten ausgeschlossen. Nicht gezählt: Anmeldungen, gemeldete, aber nicht bestätigte Zahlungen."],
            ["Bezahlte Monatsraten", "Raten mit Zahlungsdatum im Bankbuch; stornierte Raten ausgeschlossen. Erste Raten per Überweisung und Folgeraten per SEPA zusammen."],
            ["Kunden nach Land", "Land der Bestellung des zahlenden Kunden. 22 Kunden ohne Landesangabe sind in der Summe enthalten, in der Länderzeile nicht."],
            ["Werkzeuge", "Kostenlose Rechner, Prüfer und Brief-Generatoren unter /werkzeuge – alle im Browser, ohne Anmeldung, nichts wird gespeichert."],
            ["Ratgeber", "Veröffentlichte Artikel unter /ratgeber, jede Zahl darin mit Quelle und Jahr."],
          ]} />
        </Block>

        <Block titel={<>Die vier Nordstern-Kennzahlen – <span className="dk-verlauf">in Messung.</span></>} lead="Sie messen Kundennutzen und Unternehmenswert zugleich. Veröffentlicht werden sie, sobald sie über ein Quartal belastbar sind – nicht vorher.">
          <Karten items={[
            { tag: "Einsicht · in Messung", titel: "Zeit bis zur ersten Einsicht", text: "Von der bankbestätigten Zahlung bis zur erklärten Auskunft im Kundenbereich. Ziel: unter 24 Stunden nach Vorliegen der Auskunft. Die Messung läuft seit Juli 2026; die Auskunfteien brauchen ein bis vier Wochen, das rechnen wir getrennt aus." },
            { tag: "Aktion · in Messung", titel: "Antwortquote auf Schreiben", text: "Anteil der versendeten Löschanträge, Widersprüche und Ratenvorschläge, die eine Antwort erhalten – und wie viele davon positiv ausfallen. Erste belastbare Werte nach einem vollen Quartal Schriftwechsel." },
            { tag: "Zugang · in Messung", titel: "Graduation-Rate", text: "Anteil der Kunden, die aus dem Programm in ein Konto oder eine Finanzierung übergehen. Die Zahl, die Partnerbanken interessiert – und die erst nach zwölf Raten der ersten Kunden ehrlich ist." },
            { tag: "Ertrag · in Messung", titel: "Raten-Einzugsquote", text: "Anteil der fälligen Raten, die beim ersten Versuch eingezogen werden, und nach Begleitung durch das Team. Die Umstellung auf SEPA-Lastschrift läuft seit September 2026; die Quote wird ab dem ersten vollen Lastschrift-Quartal veröffentlicht." },
          ]} />
        </Block>

        <Block schmal>
          <Glas ruhig tag="Was hier nicht steht" titel="Und warum nicht">
            <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>Keine Bewertungen – die Profile sind im Aufbau, und wir zeigen nichts, was es nicht gibt. Keine Umsätze – die stehen im Datenraum für Investoren unter NDA. Keine Einzelfälle – nur mit Freigabe der Kunden. Keine Erfolgsquote „gelöschter Einträge“ – bis die Antwortquote belastbar ist, wäre jede Zahl eine Behauptung. Wer Zahlen mit Definition sehen will, findet sie hier; wer Behauptungen sehen will, anderswo.</p>
          </Glas>
        </Block>

        <Block schmal titel="Häufige Fragen zum Bericht"><Fragen items={FRAGEN} /></Block>
      </Licht>

      <Block schmal>
        <div className="dk-knoepfe" style={{ justifyContent: "center" }}>
          <Knopf href="/fiaon-erfahrungen">So arbeitet FIAON</Knopf>
          <Knopf href="/status" still>Status und Sicherheit</Knopf>
          <Knopf href="/investoren" still>Für Investoren</Knopf>
        </div>
      </Block>
    </Dunkel>
  );
}
