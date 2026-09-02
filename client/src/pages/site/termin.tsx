// ═══════════════════════════════════════════════════════════════════════════
// /termin — Startgespräch buchen (02.09.2026, E-083)
//
// Seite 1 im Zehn-Seiten-Plan: Jeder Marktführer hat den Termin-Knopf im
// Menü; bei FIAON führte bisher alles in den Antrag. Wer erst reden will,
// hatte keinen Weg — und die Funnel-Analyse zeigt, dass Speed-to-Lead und
// No-Show die beiden größten Lecks sind. Diese Seite sammelt: Wunsch-
// Zeitfenster, Telefon, Anliegen — und schickt es als Anfrage der Art
// „termin" an /api/fiaon/anfrage (fiaon-anfragen.ts), wo sie als Aufgabe
// beim Betreiber landet (Fälligkeit zwei Tage). Kein Kalender-Widget:
// Der Rückruf kommt aus dem Team, das die Akte kennt.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Anfrage, Karten, Schritte, Fragen, Kennzahlen, Zwischenruf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Was kostet das Gespräch?", a: "Nichts. Es ist ein Telefonat von rund 15 Minuten, ohne Verpflichtung. Danach wissen Sie, was Ihre Auskunft hergibt, welches Paket passt – oder dass die kostenlosen Werkzeuge in Ihrem Fall reichen. Das sagen wir Ihnen genauso." },
  { f: "Wer ruft mich an?", a: "Ein Mitarbeiter aus Vertrieb oder Onboarding – ein Mensch mit Namen, der die Plattform selbst täglich nutzt; viele im Team waren selbst Kunden. Kein Callcenter, kein Bot." },
  { f: "Was sollte ich bereithalten?", a: "Nichts Pflichtiges. Hilfreich sind: der Brief oder die Auskunft, um die es geht, die ungefähre Höhe offener Forderungen und ein Blick auf den Kontoauszug der letzten drei Monate. Wer schon eine Datenkopie hat, legt sie neben das Telefon." },
  { f: "Wie schnell kommt der Rückruf?", a: "Im gewünschten Zeitfenster, spätestens am nächsten Werktag. Wer „so schnell wie möglich“ wählt, wird in der Regel innerhalb weniger Stunden angerufen – zu den Telefonzeiten des Teams (werktags 9 bis 19 Uhr)." },
  { f: "Ist das schon das Startgespräch?", a: "Wenn Sie danach ein Paket wählen und die erste Rate eingeht, wird derselbe Termin zum Startgespräch – Sie brauchen keinen zweiten. Wer nur reden wollte, hat geredet. Beides ist in Ordnung." },
  { f: "Ich bin schon Kunde – wo buche ich?", a: "Im Kundenbereich unter Hilfe erreichen Sie Ihre Ansprechpartnerin direkt; dort steht auch der nächste Termin. Diese Seite ist für alle, die FIAON noch nicht kennen." },
];

export default function Termin() {
  return (
    <Dunkel seite="kontakt" titel="Startgespräch buchen · 15 Minuten, ein Mensch" beschreibung="Lieber erst reden? Wählen Sie ein Zeitfenster – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos, ohne Verpflichtung, werktags 9 bis 19 Uhr.">
      <SeoDaten pfad="/termin" titel="Startgespräch buchen: 15 Minuten mit einem Menschen" beschreibung="Lieber erst reden? Zeitfenster wählen – ein Mitarbeiter ruft Sie an, erklärt, was Ihre Auskunft hergibt und welches Paket passt. Kostenlos, ohne Verpflichtung." fragen={FRAGEN} krumen={[{ name: "Startgespräch buchen", pfad: "/termin" }]} />

      <Hero
        bild="/kino/presse.jpg"
        pille="Startgespräch · kostenlos, ohne Verpflichtung"
        titel={<>Lieber erst <span className="dk-verlauf">reden?</span></>}
        lead="15 Minuten am Telefon, ein Mensch, der die Auskunft lesen kann. Sie sagen, was Sie beschäftigt – wir sagen, was geht, was nicht geht und was es kosten würde. Wählen Sie ein Zeitfenster; der Rückruf kommt spätestens am nächsten Werktag."
        knoepfe={<><Knopf href="#buchen">Zeitfenster wählen</Knopf><Knopf href="/antrag" still>Lieber direkt starten</Knopf></>}
      />

      <Block eng>
        <Kennzahlen items={[{ wert: "15", label: "Minuten, mehr braucht es selten" }, { wert: "0 €", label: "kostet das Gespräch" }, { wert: "9–19", label: "Uhr, werktags erreichbar" }, { wert: "1", label: "Mensch, danach mit Namen" }]} />
      </Block>

      <Licht>
        <Block schmal titel={<>Was in den 15 Minuten <span className="dk-verlauf">passiert.</span></>} lead="Dieselbe Agenda, nach der unsere Mitarbeiter jedes Startgespräch führen – Sie wissen vorher, was kommt.">
          <Schritte items={[
            { titel: "Ihre Lage", text: "Was ist passiert – Ablehnung, Brief, Eintrag, Kündigung? Welche Auskunftei, welches Land? Zwei Minuten, keine Formulare." },
            { titel: "Was die Auskunft hergibt", text: "Wir erklären, was ein Eintrag rechtlich bedeutet, ob er angreifbar sein könnte und welche Frist läuft – ohne Versprechen, mit Paragrafen." },
            { titel: "Ihr Ziel", text: "Nur Klarheit? Einträge weg? Konto, Karte, Finanzierung? Das Ziel bestimmt den Weg – und ob FIAON überhaupt der richtige ist." },
            { titel: "Der ehrliche Vorschlag", text: "Kostenlose Werkzeuge, die Auskunft für 74 Euro oder ein Paket – wir nennen das, was zu Ihrem Fall passt, nicht das teuerste." },
            { titel: "Die nächsten Schritte", text: "Wenn Sie wollen: Paket, erste Rate, Vollmacht, Auskunft. Wenn nicht: eine Zusammenfassung per E-Mail und die Links zu den Werkzeugen." },
          ]} />
        </Block>

        <Block id="buchen" schmal titel={<>Zeitfenster wählen – <span className="dk-verlauf">wir rufen an.</span></>} lead="Ihre Angaben gehen direkt ins Team; niemand außerhalb von FIAON sieht sie. Sie bekommen eine Bestätigung per E-Mail.">
          <Anfrage
            art="termin"
            felder={[
              { name: "name", label: "Vor- und Nachname", pflicht: true },
              { name: "telefon", label: "Telefon (für den Rückruf)", typ: "tel", pflicht: true },
              { name: "email", label: "E-Mail (Bestätigung)", typ: "email", pflicht: true },
              { name: "land", label: "Land", optionen: ["Deutschland", "Österreich", "Schweiz"], pflicht: true },
              { name: "rolle", label: "Wunsch-Zeitfenster", optionen: ["So schnell wie möglich", "Heute 9–12 Uhr", "Heute 12–15 Uhr", "Heute 15–19 Uhr", "Morgen vormittags", "Morgen nachmittags", "Nächste Woche"], pflicht: true },
              { name: "kunde", label: "Worum geht es?", optionen: ["Ablehnung bei Konto/Karte/Kredit", "Brief von Inkasso oder Mahnbescheid", "Eintrag in der Auskunft", "Ich will nur wissen, was drinsteht", "Konto oder Karte gesucht", "Etwas anderes"], pflicht: true },
              { name: "text", label: "Was sollten wir vorher wissen? (optional)", typ: "textarea", breit: true },
            ]}
            knopf="Rückruf anfordern"
            hinweis="Kostenlos, ohne Verpflichtung. Wir rufen im gewünschten Zeitfenster an, spätestens am nächsten Werktag. Mit dem Absenden stimmen Sie der Verarbeitung Ihrer Angaben zur Terminvereinbarung zu (Datenschutzerklärung)."
          />
        </Block>

        <Block titel={<>Warum reden, bevor Sie <span className="dk-verlauf">etwas kaufen?</span></>} lead="Weil die Antwort manchmal „Sie brauchen uns nicht“ lautet.">
          <Karten items={[
            { tag: "Ehrlich", titel: "Manchmal reichen die Werkzeuge", text: "Ein einziger, klar erledigter Eintrag: Der Löschantrag-Generator schreibt den Brief kostenlos. Das sagen wir am Telefon – und schicken den Link." },
            { tag: "Konkret", titel: "Die Frist, die gerade läuft", text: "Mahnbescheid, Inkassofrist, Löschfrist: Am Telefon klären wir in zwei Minuten, welcher Tag der letzte ist – bevor Sie ein Paket wählen." },
            { tag: "Passend", titel: "Das richtige Paket, nicht das größte", text: "Start, Pro, Ultra oder nur die Auskunft: Der Unterschied liegt darin, wie viel FIAON übernimmt. Wer allein nachhalten kann, braucht weniger." },
          ]} />
        </Block>

        <Block schmal titel="Häufige Fragen zum Gespräch"><Fragen items={FRAGEN} /></Block>
      </Licht>

      <Zwischenruf text={<><b>Lieber schriftlich?</b> Der FIAON-Assistent auf der Kontaktseite beantwortet Fragen sofort – oder Sie schreiben an support@fiaon.com.</>} knopf="Zur Kontaktseite" href="/kontakt" still={{ knopf: "Eintrag kostenlos prüfen", href: "/werkzeuge/eintrag-pruefen" }} />
    </Dunkel>
  );
}
