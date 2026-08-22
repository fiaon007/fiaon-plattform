// /karriere — Werden Sie Teil des Teams (E-026: Jeder Kunde kann Mitarbeiter werden).
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import NeuralSphere from "@/components/home3d/NeuralSphere";

export default function Karriere() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const vorbelegt: Record<string, string> = {};
  if (params?.get("kunde") === "ja") vorbelegt.kunde = "Ja, ich bin Kunde";
  if (params?.get("email")) vorbelegt.email = params.get("email") || "";
  if (params?.get("name")) vorbelegt.name = params.get("name") || "";

  return (
    <Dunkel seite="karriere" titel="Karriere · Werden Sie Teil des Teams" beschreibung="Arbeiten Sie von zuhause für FIAON: Vertrieb, Startgespräche, Betreuung. Kunden, Quereinsteiger und Vertriebsprofis willkommen – Academy zuerst, dann echte Kunden.">
      <Hero
        bild="/kino/karriere.jpg"
        pille="Karriere · Homeoffice"
        titel={<>Arbeiten Sie von zuhause – für das, was Ihnen <span className="dk-verlauf">selbst geholfen hat.</span></>}
        lead="Die besten Menschen für FIAON sind die, die FIAON erlebt haben. Wer seine eigene Auskunft gesehen, einen Eintrag gelöscht und die erste Karte bekommen hat, kann das anderen erklären. Deshalb kann jeder Kunde Mitarbeiter werden – von zuhause, per Telefon und Plattform."
        knoepfe={<><Knopf href="#bewerbung">In 60 Sekunden bewerben</Knopf><Knopf href="#tag" still>So sieht ein Tag aus</Knopf></>}
        szene={<NeuralSphere variant="hero" className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: "100 %", label: "Homeoffice – Sie brauchen einen Rechner, ein Headset und eine ruhige Stunde" },
          { wert: "0 €", label: "Einstiegskosten – Academy, Softphone und Plattform stellt FIAON" },
          { wert: "zuerst", label: "die Academy, dann echte Kunden – niemand telefoniert ohne Vorbereitung" },
          { wert: "je Rate", label: "Provision je Abschluss und je eingezogener Rate – Monat für Monat sichtbar" },
        ]} />
      </Block>

      <Block pille="Warum FIAON" titel={<>Kunden werden <span className="dk-verlauf">Mitarbeiter.</span></>}
             lead="Das ist kein Slogan, sondern eine Entscheidung im Register: Jeder Kunde bekommt in seinem Bereich die Einladung, Teil des Teams zu werden. Wer FIAON kennt, erklärt es am besten.">
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <Auf><Glas ruhig><Zitat text="Ich habe bei FIAON angefangen, weil mir ein Mensch am Telefon erklärt hat, was in meiner SCHUFA steht. Heute bin ich dieser Mensch." wer="Vertriebsmitarbeiterin, ehemals Kundin" /></Glas></Auf>
          <div style={{ display: "grid", gap: 16 }}>
            <Auf verzoegerung={80}><Glas tag="Sinn" titel="Sie helfen Menschen, die da stehen, wo Sie standen.">Jeder Anruf beginnt mit einer Auskunft, die jemand zum ersten Mal sieht. Sie erklären, beruhigen und zeigen den nächsten Schritt.</Glas></Auf>
            <Auf verzoegerung={160}><Glas tag="Freiheit" titel="Ihre Zeit, Ihr Ort.">Homeoffice, eigene Einteilung, Kalender in der Plattform. Sie bestimmen, wie viele Kunden Sie betreuen.</Glas></Auf>
            <Auf verzoegerung={240}><Glas tag="Wachstum" titel="Vom Kunden zur Leitung.">Wer gut ist, führt: Onboarding, Inkasso, Vertriebsleitung – jede Abteilung hat ihr eigenes Portal und eigene Verantwortung.</Glas></Auf>
          </div>
        </div>
      </Block>

      <Block pille="Wer passt" titel={<>Drei Wege <span className="dk-verlauf">zu uns.</span></>}>
        <Karten items={[
          { tag: "Kunden", titel: "Sie kennen FIAON von innen.", text: "Sie haben Ihre Auskunft gesehen, Schreiben freigegeben, Raten gezahlt. Niemand erklärt den Weg besser als jemand, der ihn gegangen ist." },
          { tag: "Quereinsteiger", titel: "Sie können zuhören.", text: "Keine Vertriebserfahrung nötig. Die Academy bringt Ihnen Bonität, Auskunfteien und die Plattform bei – Modul für Modul, mit Prüfung." },
          { tag: "Vertriebsprofis", titel: "Sie wollen ein Produkt, das hält.", text: "Kein Verkaufen gegen den Kunden. Ein Paket, das ihm nachweislich hilft – und eine Provision, die mit jeder eingezogenen Rate wächst." },
        ]} />
      </Block>

      <Block id="tag" pille="Ein Tag" titel={<>So sieht ein Tag <span className="dk-verlauf">bei FIAON</span> aus.</>}>
        <Schritte items={[
          { titel: "Academy-Modul", text: "Zehn Minuten Wissen am Morgen: ein Eintragstyp, ein Schreiben, ein Einwand. Die Academy bleibt auch nach der Prüfung Ihr Werkzeug." },
          { titel: "Anrufe", text: "Das Softphone in der Plattform wählt, die Akte liegt daneben. Jedes Gespräch endet mit einem Ergebnis, das die Plattform weiterverarbeitet." },
          { titel: "Startgespräche", text: "Neue Kunden lernen Sie im Startgespräch kennen: Auskunft erklären, Paket und Zahlung prüfen, ersten Schritt festlegen." },
          { titel: "Akte pflegen", text: "Ergebnisse, Vermerke, Wiedervorlagen. Ihre Kunden bleiben Ihre Kunden – und Ihre Provision folgt ihnen." },
        ]} />
      </Block>

      <Zwischenruf text="Noch kein Kunde? Dann beginnen Sie dort, wo jeder bei FIAON beginnt: mit der eigenen Auskunft." knopf="Konto eröffnen" href="/antrag" still={{ knopf: "Trotzdem bewerben", href: "#bewerbung" }} />

      <Block pille="Die Academy" titel={<>Erst lernen, <span className="dk-verlauf">dann telefonieren.</span></>}
             lead="Niemand spricht mit Kunden, bevor er die Academy bestanden hat. Das schützt den Kunden – und Sie.">
        <Karten items={[
          { tag: "Modul 1", titel: "Bonität verstehen", text: "Wie Einträge entstehen, was SCHUFA, KSV und CRIF speichern, welche Einträge löschbar, berichtigbar oder angreifbar sind." },
          { tag: "Modul 2", titel: "Die Plattform", text: "Kundenweg, Akte, Softphone, Kalender, Ergebnisse. Sie üben am Testkunden, bevor Sie echte sehen." },
          { tag: "Modul 3", titel: "Das Gespräch", text: "Zuhören, erklären, nächsten Schritt festlegen. Einwände, Abbrüche, Zahlungsfragen – mit Sie-Form und Respekt." },
          { tag: "Prüfung", titel: "Freischaltung", text: "Eine Prüfung, ein Probegespräch mit der Leitung. Danach sehen Sie echte Kunden – und Ihre erste Provision." },
        ]} zwei />
      </Block>

      <Block pille="Vergütung" titel={<>Ehrlich, <span className="dk-verlauf">weil es sonst nicht hält.</span></>} schmal>
        <Auf>
          <Glas ruhig>
            <ul className="dk-liste" style={{ marginTop: 0 }}>
              <li>Provision je Abschluss und je eingezogener Rate – in Ihrem Bereich Monat für Monat einsehbar.</li>
              <li>Die Vertriebsleitung legt die Regel fest; jede Änderung an einer Provision ist begründet und protokolliert.</li>
              <li>Fixum bei Bewährung: Wer über Monate Kunden gut betreut, bekommt eine feste Grundlage.</li>
              <li>Selbständige Tätigkeit als Handelsvertreter. Kein Anspruch auf Abschlüsse, keine Provision auf eigene Abos.</li>
              <li>Ausstattung stellt FIAON: Softphone, Plattform, Academy. Sie bringen Rechner, Headset und Internet.</li>
            </ul>
          </Glas>
        </Auf>
      </Block>

      <Block pille="Werkzeuge" titel={<>Alles in <span className="dk-verlauf">einem Portal.</span></>}>
        <Karten items={[
          { tag: "Softphone", titel: "Anrufen aus der Akte", text: "Ein Klick wählt, das Ergebnis landet in der Akte. Kein Zettel, keine zweite App." },
          { tag: "Kalender", titel: "Startgespräche und Wiedervorlagen", text: "Termine, Erinnerungen, Übergaben – alles im Portal, alles nachvollziehbar." },
          { tag: "Akte", titel: "Der ganze Kunde", text: "Auskunft, Kontoauszug-Analyse, Schreiben, Raten, Gespräche. Sie sehen, was der Kunde sieht – und mehr." },
          { tag: "Updates", titel: "Was sich ändert", text: "Jede Neuerung der Plattform steht im Portal, bevor Sie sie beim Kunden brauchen." },
        ]} zwei />
      </Block>

      <Block id="bewerbung" pille="Bewerbung" titel={<>In 60 Sekunden <span className="dk-verlauf">bewerben.</span></>}
             lead="Kein Lebenslauf, kein Anschreiben. Name, Kontakt, ob Sie Kunde sind und was Sie mitbringen. Die Vertriebsleitung meldet sich innerhalb von zwei Werktagen." schmal>
        <Anfrage art="karriere" knopf="Bewerbung senden" hinweis="Antwort innerhalb von zwei Werktagen – von der Vertriebsleitung." vorbelegt={vorbelegt}
                 felder={[
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel", pflicht: true },
                   { name: "kunde", label: "Sind Sie Kunde bei FIAON?", pflicht: true, optionen: ["Ja, ich bin Kunde", "Nein, noch nicht"] },
                   { name: "land", label: "Land", pflicht: true, optionen: ["Deutschland", "Österreich", "Schweiz"] },
                   { name: "erfahrung", label: "Erfahrung", optionen: ["Keine – Quereinsteiger", "Kundenkontakt / Service", "Vertrieb", "Inkasso / Finanzen", "Führung"] },
                   { name: "text", label: "Was möchten Sie uns sagen?", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Brauche ich Vertriebserfahrung?", a: "Nein. Die Academy bringt Ihnen alles bei, was Sie brauchen – und Sie sprechen erst mit Kunden, wenn Sie die Prüfung bestanden haben." },
          { f: "Wie viel kann ich verdienen?", a: "Das hängt von Abschlüssen und eingezogenen Raten ab. Die Regel steht in Ihrem Vertrag, jede Abrechnung ist im Portal nachvollziehbar. Wir nennen keine Fantasiezahlen." },
          { f: "Bin ich angestellt?", a: "Sie arbeiten selbständig als Handelsvertreter. Bei Bewährung gibt es ein Fixum als feste Grundlage." },
          { f: "Muss ich Kunde sein?", a: "Nein – aber es hilft. Wer den Weg selbst gegangen ist, erklärt ihn am besten. Kunden finden die Einladung direkt in ihrem Bereich." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Der Kreis schließt sich: <span className="dk-verlauf">Wem geholfen wurde, hilft.</span></>}
        text="Einsicht, Aktion, Zugang – und dann ein vierter Schritt: Weitergeben. So wächst FIAON nicht mit Werbebudget, sondern mit Menschen, die wissen, wovon sie sprechen."
        knoepfe={<><Knopf href="#bewerbung">Jetzt bewerben</Knopf><Knopf href="/antrag" still>Zuerst Kunde werden</Knopf></>}
      />
    </Dunkel>
  );
}
