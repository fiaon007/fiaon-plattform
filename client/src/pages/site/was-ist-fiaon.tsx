// /was-ist-fiaon — die Vision, genau erklärt. Zwölf Blöcke, cinematisch, auf der dunklen Bühne.
// Quelle der Inhalte: 05_Vision/VISION.md (der eine Satz, drei Schichten, Markt, Nordstern).
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Knopf, Auf, Szenenbild } from "@/components/site/DunkleBuehne";
import { Team } from "@/components/site/Team";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import ArasCore from "@/components/home3d/ArasCore";
import SchichtenSzene from "@/components/home3d/SchichtenSzene";
import KartenSzene from "@/components/home3d/KartenSzene";

export default function WasIstFiaon() {
  return (
    <Dunkel seite="was-ist-fiaon" titel="Was ist FIAON" beschreibung="FIAON ist das Betriebssystem für Bonität: Wir zeigen Ihnen, was Auskunfteien über Sie wissen, reparieren es mit Ihnen – und öffnen die Tür zu Konto, Karte und Finanzierung. Die Vision, genau erklärt.">
      {/* 1 · Hero */}
      <Hero
        pille="Was ist FIAON"
        titel={<>Das Betriebssystem <span className="dk-verlauf">für Bonität.</span></>}
        lead="FIAON zeigt Ihnen, was Auskunfteien über Sie wissen, repariert es mit Ihnen – und öffnet Ihnen dann die Tür zu echten Finanzprodukten. Ein Satz, drei Schichten, ein Weg."
        knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="#schichten" still>Die drei Schichten</Knopf></>}
        szene={<NeuralSphere variant="hero" className="absolute inset-0" />}
        bild="/kino/hero.jpg"
      />

      {/* 2 · Die Idee */}
      <Block pille="Die Idee" titel={<>Bonität ist kein Urteil. <span className="dk-verlauf">Sie ist ein Zustand.</span></>}
             lead="Und Zustände kann man ändern. Heute entscheidet eine Auskunft, die Sie nie gesehen haben, über Konto, Karte, Wohnung und Kredit. FIAON dreht das um: Zuerst sehen Sie, was gespeichert ist. Dann ändern Sie es. Dann öffnet sich die Tür." mitte>
        <div className="dk-raster" style={{ textAlign: "left" }}>
          {[
            { tag: "Schicht 1", titel: "Einsicht", text: "FIAON kennt Ihre Bonität besser als Sie selbst – und erklärt sie Ihnen in Klartext." },
            { tag: "Schicht 2", titel: "Aktion", text: "FIAON tut wirklich etwas: Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen – vorbereitet, geprüft, versendet." },
            { tag: "Schicht 3", titel: "Zugang", text: "Am Ende steht ein Ziel: Girokonto, Kreditkarte, Finanzierung. Niemand geht leer aus." },
          ].map((k, i) => <Auf key={k.tag} verzoegerung={i * 90}><Glas tag={k.tag} titel={k.titel}>{k.text}</Glas></Auf>)}
        </div>
      </Block>

      {/* 3 · Warum es FIAON gibt */}
      <Block pille="Warum es FIAON gibt" titel={<>Ein Markt, der nur <span className="dk-verlauf">anzeigt.</span></>}
             lead="100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Allein in Deutschland gelten sechs Millionen als überschuldet. Und niemand besetzt die Schicht dazwischen.">
        <Karten items={[
          { tag: "Score-Apps", titel: "Zeigen eine Zahl. Dann nichts.", text: "Sie sehen einen Wert und einen Tipp. Den Löschantrag, den Widerspruch, die Ratenvereinbarung schreibt keine dieser Apps." },
          { tag: "Schuldnerberatung", titel: "Wertvoll – und analog.", text: "Wartelisten, Papier, Termine. Wer heute einen Eintrag prüfen will, wartet Wochen auf ein Gespräch." },
          { tag: "Banken", titel: "Entscheiden nach der Akte, nicht nach dem Menschen.", text: "Ein erledigter, aber nie gelöschter Eintrag kostet Sie die Karte – und die Bank einen Kunden, der längst zahlungsfähig ist." },
        ]} />
        <Auf><p className="dk-lead" style={{ marginTop: 40, color: "#e5e7eb" }}>FIAON besetzt genau diesen Platz – <span className="dk-verlauf">zwischen Auskunftei und Bank.</span></p></Auf>
      </Block>

      <Szenenbild src="/kino/akten.jpg" titel={<>Drei Schichten. <span className="dk-verlauf">Ein Weg.</span></>} text="So arbeitet FIAON – Schicht für Schicht, vom ersten Blick in die Auskunft bis zur Karte in der Hand." />

      {/* 4 · Schicht 1: Einsicht */}
      <Block id="schichten" pille="Schicht 1 · Einsicht" titel={<>„FIAON kennt mich besser <span className="dk-verlauf">als ich selbst."</span></>}
             lead="Bevor sich etwas ändern lässt, muss es sichtbar sein. FIAON holt Ihre Auskunft, liest Ihre Finanzen und erklärt beides in Menschensprache.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <Auf><div className="dk-szene gross"><SchichtenSzene namen={["SCHUFA", "KSV", "CRIF"]} className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 18 }}>
            <Auf><Glas tag="Auskunft" titel="Beantragt durch FIAON.">Deutschland: SCHUFA. Österreich: KSV. Schweiz: CRIF. Sie füllen kein Formular aus – FIAON stellt die Anfrage und liest die Antwort. Jeder Eintrag wird eingeordnet: erledigt, löschbar, berichtigbar, angreifbar.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Finanzen" titel="Ihr Kontoauszug, gelesen.">Einnahmen, Fixkosten, Abos, Risiken, monatlicher Spielraum – die FIAON-Analyse erkennt, wo Sie stehen, und zeigt es als Bogen, nicht als Tabelle.</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="Cockpit" titel="Ein Bild statt vieler Briefe.">Alles in Ihrem Bereich: Wert, Einträge, Spielraum, nächster Schritt. Mit konkreten Handlungsempfehlungen – „Das müssen Sie tun, um wieder normal zu finanzieren."</Glas></Auf>
          </div>
        </div>
        <Kennzahlen items={[
          { wert: "3", label: "Auskunfteien, an die FIAON für Sie die Anfrage stellt" },
          { wert: "< 24 h", label: "von der Anmeldung bis zur ersten Einsicht" },
          { wert: "1", label: "Cockpit statt eines Stapels Briefe" },
          { wert: "0", label: "Formulare, die Sie selbst ausfüllen müssen" },
        ]} />
      </Block>

      {/* 5 · Schicht 2: Aktion */}
      <Block pille="Schicht 2 · Aktion" titel={<>FIAON tut <span className="dk-verlauf">wirklich etwas.</span></>}
             lead="Das ist der Unterschied zu allem, was es bisher gab – und der Grund, warum FIAON ein Betriebssystem ist und keine App: Aus jeder Einsicht wird ein Schreiben, das hinausgeht.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <div style={{ display: "grid", gap: 18 }}>
            <Auf><Glas tag="Ein Klick" titel="Löschung, Berichtigung, Widerspruch.">Löschanträge (Art. 17 DSGVO), Berichtigungen (Art. 16), Widersprüche gegen Einträge – fertig vorbereitet, digital freigegeben, mit einem Klick an die zuständige Auskunftei oder das Inkasso.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Einigung" titel="Ratenvereinbarungen, die halten.">Für offene Forderungen schlägt FIAON Raten vor, die zu Ihrem Spielraum passen – und verfolgt die Antwort: „Antwort erhalten? Eintragen, FIAON plant den nächsten Schritt."</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="Recht" titel="Anwaltlich geprüft, versioniert.">Jeder Brieftyp wird vom Anwaltsteam freigegeben und versioniert. Kein Schreiben geht hinaus, das nicht geprüft ist – und keines ohne Ihre Freigabe.</Glas></Auf>
            <Auf verzoegerung={300}><Glas tag="Erinnerung" titel="Fristen, Termine, Nachfassen.">Eine Erinnerungs-Engine hält Fristen und Zahlungstermine – seriös, auf Augenhöhe, kurz. Sie vergessen nichts, weil FIAON nichts vergisst.</Glas></Auf>
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Szenenbild src="/kino/tuer.jpg" titel={<>Dann die <span className="dk-verlauf">Tür.</span></>} text="Wer Einsicht hat und gehandelt hat, soll etwas bekommen. Das ist das Versprechen – und der Grund, warum niemand bei FIAON ohne nächstes Ziel bleibt." />

      {/* 6 · Schicht 3: Zugang */}
      <Block pille="Schicht 3 · Zugang" titel={<>Niemand geht leer aus. <span className="dk-verlauf">Jeder hat ein nächstes Ziel.</span></>}
             lead="Die Logik ist einfach und ehrlich: Bonität gut – Karte sofort. Bonität schlecht – FIAON-Programm, Karte später. Über die Vergabe entscheidet immer die Bank; FIAON bereitet Sie darauf vor und begleitet Sie bis dorthin.">
        <div className="dk-zweispaltig" style={{ marginTop: 56 }}>
          <Auf><div className="dk-szene gross"><KartenSzene anzahl={1} className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 18 }}>
            <Auf><Glas tag="Für jeden" titel="Girokonto.">Ein Girokonto über eine Partnerbank – erreichbar für jeden Kunden, unabhängig von der Ausgangslage.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Bei guter Bonität" titel="Kreditkarte bis 25.000 €.">Mit bereinigter Akte und dokumentierter Zahlungshistorie wird der Kunde der Partnerbank vorgestellt – mit Einwilligung und allen Unterlagen.</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="Später" titel="Finanzierung.">Die dritte Tür: Ratenkredit und Umschuldung über Partner – für Kunden, deren Akte es trägt.</Glas></Auf>
          </div>
        </div>
      </Block>

      {/* 7 · Der Weg eines Kunden */}
      <Block pille="Der Weg" titel={<>Von der E-Mail-Adresse <span className="dk-verlauf">zur Karte.</span></>} mitte>
        <div style={{ textAlign: "left" }}>
          <Schritte items={[
            { titel: "Konto anlegen", text: "E-Mail-Adresse, wenige Angaben, zwei Minuten. Ihr Bereich ist sofort aktiv." },
            { titel: "Startgespräch", text: "Ein Mensch ruft Sie an, erklärt die Auskunft, prüft Paket und Zahlung, legt den ersten Schritt fest." },
            { titel: "Einsicht", text: "Innerhalb von 24 Stunden liegt Ihre Auskunft erklärt im Bereich – mit Kontoauszug-Analyse und Fahrplan." },
            { titel: "Aktion", text: "Schreiben freigeben, Raten vereinbaren, Antworten verfolgen. Etappe für Etappe, mit festem Ansprechpartner." },
            { titel: "Zugang", text: "Konto, Karte, später Finanzierung – vorgestellt bei Partnerbanken, die eine dokumentierte Bonität sehen." },
          ]} />
        </div>
      </Block>

      {/* 8 · Nordstern */}
      <Block pille="Woran wir uns messen" titel={<>Drei Zahlen, die <span className="dk-verlauf">ehrlich sind.</span></>}
             lead="Keine Nutzerzahlen zum Angeben. Drei Kennzahlen, die den Nutzen für den Kunden messen – und damit den Wert des Unternehmens.">
        <Karten items={[
          { tag: "Einsicht", titel: "Zeit bis zur ersten Einsicht", text: "Von der Anmeldung bis zur fertigen Bonitätsanalyse im Bereich. Ziel: unter 24 Stunden." },
          { tag: "Aktion", titel: "Versendete Schreiben", text: "Löschanträge, Widersprüche, Ratenvorschläge pro Monat – und wie viele davon eine positive Antwort bekommen." },
          { tag: "Zugang", titel: "Graduations", text: "Kunden, die aus dem Programm in Konto, Karte oder Finanzierung aufgestiegen sind. Die Zahl, die zählt." },
        ]} />
      </Block>

      {/* 9 · Der Markt */}
      <Block pille="Der Markt" titel={<>Warum das <span className="dk-verlauf">groß</span> ist.</>}
             lead="Drei Länder, eine Sprache, drei Auskunfteien – und eine Schicht, die niemand besetzt. Erst Deutschland perfekt, dann Österreich und die Schweiz, dann Europa.">
        <Kennzahlen items={[
          { wert: "100 Mio.", label: "Menschen im DACH-Raum mit einem Eintrag bei einer Auskunftei" },
          { wert: "6 Mio.", label: "überschuldete Personen allein in Deutschland – fast jede mit löschbaren oder angreifbaren Einträgen" },
          { wert: "3", label: "Erlösquellen: Abo, Bonitätsauskunft, Partnerprovision – aus einer Akte" },
          { wert: "DE → AT/CH → EU", label: "Reihenfolge: ein Land perfekt, dann die Nachbarn, dann Europa" },
        ]} />
      </Block>

      {/* 10 · Die Menschen */}
      <Block pille="Die Menschen dahinter" titel={<>Gesellschafter, die <span className="dk-verlauf">selbst im Betrieb stehen.</span></>}
             lead="FIAON wird nicht von einer Zentrale geführt. Die drei Gesellschafter sehen täglich Kunden – im Startgespräch, im Vertrieb, in der Akte.">
        <Team kompakt />
        <div className="dk-knoepfe"><Knopf href="/team" still>Das Team kennenlernen</Knopf></div>
      </Block>

      {/* 11 · Grundsätze */}
      <Block pille="Grundsätze" titel={<>Woran wir uns <span className="dk-verlauf">halten.</span></>}>
        <Karten items={[
          { tag: "Respekt", titel: "Sie-Form, immer.", text: "Wer bei FIAON anruft, spricht mit jemandem, der seine Akte kennt – nicht mit einer Warteschleife." },
          { tag: "Ehrlich", titel: "Keine Fantasiezahlen.", text: "Über Konto und Karte entscheidet die Bank. Wir versprechen, was wir halten: Einsicht in 24 Stunden, geprüfte Schreiben, ein Mensch am Telefon." },
          { tag: "Festgehalten", titel: "Jede Entscheidung ein Eintrag.", text: "Register, Logbuch, eine Quelle für jede Zahl. Wer das Unternehmen prüft, findet alles – vom ersten Tag an." },
          { tag: "Aus Kunden", titel: "Wem geholfen wurde, hilft.", text: "Viele im Team waren selbst Kunden. Sie erklären den Weg, weil sie ihn gegangen sind." },
        ]} zwei />
      </Block>

      <Block eng schmal>
        <Zitat text="Wir bauen kein Produkt, das Bonität anzeigt. Wir bauen die Infrastruktur, mit der 100 Millionen Menschen sie ändern können." wer="Justin Schwarzott, Gründer FIAON" />
      </Block>

      <Zwischenruf text="Ihr Konto ist in zwei Minuten angelegt – Ihre Auskunft liegt innerhalb von 24 Stunden in Ihrem Bereich." knopf="Jetzt starten" href="/antrag" still={{ knopf: "Pakete ansehen", href: "/#setups" }} />

      {/* 12 · Fragen */}
      <Block schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Ist FIAON eine Bank?", a: "Nein. FIAON ist kein Kreditinstitut und vergibt weder Konten noch Karten. Über die Vergabe entscheidet immer die jeweilige Partnerbank. FIAON bereitet Sie vor und dokumentiert Ihre Bonität." },
          { f: "Was unterscheidet FIAON von einer Score-App?", a: "Eine Score-App zeigt eine Zahl. FIAON holt die Auskunft, erklärt jeden Eintrag, bereitet das Schreiben vor und versendet es nach Ihrer Freigabe – und verfolgt die Antwort. Anzeigen ist die erste Schicht. FIAON hat drei." },
          { f: "Wer prüft die Schreiben?", a: "Jeder Brieftyp wird vom Anwaltsteam freigegeben und versioniert. Kein Schreiben geht hinaus, das nicht geprüft ist – und keines ohne Ihre Freigabe." },
          { f: "Für welche Länder gilt das?", a: "Deutschland (SCHUFA), Österreich (KSV) und die Schweiz (CRIF). Die Plattform erkennt Ihr Land und stellt die Anfrage bei der richtigen Auskunftei." },
          { f: "Was kostet FIAON?", a: "Pakete ab 7,99 € im Monat, zwölf Raten per SEPA-Lastschrift, danach entscheiden Sie, ob Sie bleiben. Nur die Auskunft? 74 € einmalig." },
          { f: "Wo liegen meine Daten?", a: "Verschlüsselt auf Servern in der EU, DSGVO-konform. Sie entscheiden, was Sie hochladen, und können es jederzeit löschen lassen." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Einsicht. Aktion. Zugang. <span className="dk-verlauf">Ihr Weg beginnt mit einer E-Mail-Adresse.</span></>}
        text="Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie durch alles Weitere begleitet."
        knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/team" still>Wer das baut</Knopf></>}
      />
    </Dunkel>
  );
}
