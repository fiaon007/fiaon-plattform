// /investoren — Für Investoren. Dunkle Bühne, viele kurze Blöcke, Zahlen nur dort, wo sie belegt sind.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Zeilen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";
import ArasCore from "@/components/home3d/ArasCore";
import { PAKETE, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";

export default function Investoren() {
  const privat = PAKETE.filter((p) => p.art === "privat" && p.abo);
  const business = PAKETE.filter((p) => p.art === "business");
  return (
    <Dunkel seite="investoren" titel="Für Investoren" beschreibung="FIAON besetzt den Platz zwischen Auskunftei und Bank: Einsicht, Aktion, Zugang für 100 Millionen Menschen im DACH-Raum. Datenraum auf Anfrage.">
      <Hero
        bild="/kino/investoren.jpg"
        pille="Für Investoren"
        titel={<>Der größte unbesetzte Platz im Finanzleben von <span className="dk-verlauf">100 Millionen Menschen.</span></>}
        lead="Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen steht niemand. FIAON besetzt diesen Platz: Wir zeigen die Bonität, reparieren sie mit dem Kunden – und öffnen dann die Tür zu Konto, Karte und Finanzierung."
        knoepfe={<><Knopf href="#anfrage">Datenraum anfragen</Knopf><Knopf href="#modell" still>Das Modell in drei Minuten</Knopf></>}
        szene={<KartenSzene anzahl={1} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: "100 Mio.", label: "Menschen in Deutschland, Österreich und der Schweiz mit einem Eintrag bei SCHUFA, KSV oder CRIF" },
          { wert: "6 Mio.", label: "Personen allein in Deutschland gelten als überschuldet – fast jede hat löschbare oder angreifbare Einträge" },
          { wert: "3", label: "Auskunfteien, an die FIAON die Anfrage für den Kunden stellt – ohne dass er ein Formular ausfüllt" },
          { wert: "12", label: "monatliche Raten je Paket per SEPA-Lastschrift; nach der zwölften entscheidet der Kunde, ob er bleibt" },
        ]} />
      </Block>

      <Block pille="Das Problem" titel={<>Ein Markt, der nur <span className="dk-verlauf">anzeigt.</span></>}
             lead="Bonität entscheidet über Konto, Karte, Wohnung und Kredit. Trotzdem ist sie für die meisten Menschen unsichtbar – und für die, die sie sehen, unveränderbar.">
        <Karten items={[
          { tag: "Der Kunde", titel: "Sieht nichts.", text: "Die Auskunft liegt bei der Auskunftei, die Entscheidung bei der Bank. Der Mensch dazwischen erfährt nur das Ergebnis: abgelehnt." },
          { tag: "Die Apps", titel: "Zeigen, handeln nicht.", text: "Score-Apps liefern eine Zahl und einen Tipp. Den Löschantrag, den Widerspruch, die Ratenvereinbarung schreibt keine von ihnen." },
          { tag: "Die Banken", titel: "Verlieren gute Kunden.", text: "Ein erledigter, aber nicht gelöschter Eintrag kostet die Bank einen Kunden, der längst zahlungsfähig ist. Niemand räumt auf." },
        ]} />
      </Block>

      <Block id="modell" pille="Die Lösung" titel={<>Drei Schichten. <span className="dk-verlauf">Der Burggraben liegt in der Mitte.</span></>}
             lead="Einsicht können viele. Zugang vermitteln viele. Die Aktion – anwaltlich geprüfte Schreiben, versendet und verfolgt – macht FIAON zum Betriebssystem statt zur App.">
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <Auf><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
          <div style={{ display: "grid", gap: 16 }}>
            <Auf><Glas tag="Schicht 1 · Einsicht" titel="Zuerst Klarheit.">Auskunft aus SCHUFA, KSV oder CRIF, Kontoauszug-Analyse durch FIAON, jeder Eintrag erklärt. Ziel: erste Einsicht innerhalb von 24 Stunden.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="Schicht 2 · Aktion — der Burggraben" titel="Dann Bewegung.">Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen: vorbereitet, anwaltlich geprüft, mit einem Klick versendet, Antwort verfolgt. Jede Antwort macht das System besser.</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="Schicht 3 · Zugang" titel="Dann die Tür.">Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität, Finanzierung später. Hier entstehen Partnererlöse – mit Kunden, deren Bonität dokumentiert ist.</Glas></Auf>
          </div>
        </div>
      </Block>

      <Zwischenruf text="Sie möchten die Plattform sehen, bevor Sie Zahlen sehen? Der Kundenweg ist öffentlich – vom ersten Klick bis zum Bereich." knopf="Startseite ansehen" href="/" still={{ knopf: "Konto als Testkunde", href: "/antrag" }} />

      <Block pille="Geschäftsmodell" titel={<>Drei Erlösquellen. <span className="dk-verlauf">Eine Beziehung.</span></>}
             lead="Der Kunde zahlt für Einsicht und Aktion. Der Partner zahlt für Zugang. Beides hängt an derselben Akte – deshalb wächst der Wert eines Kunden mit jeder Etappe.">
        <Karten items={[
          { tag: "Abo", titel: `${euro(privat[0].preisCents)} bis ${euro(privat[privat.length - 1].preisCents)} im Monat`, text: "Vier Privatpakete, vier Geschäftspakete. Zwölf Raten per SEPA-Lastschrift, danach die Frage, ob der Kunde bleibt. Jede Rate wird vom Inkasso-Team begleitet." },
          { tag: "Auskunft", titel: `${euro(SCHUFA_PREIS_EURO * 100)} einmalig`, text: "Die Bonitätsauskunft als Einstieg für Kunden, die zuerst nur wissen wollen, was über sie gespeichert ist. Der erste Schritt in die Akte." },
          { tag: "Partner", titel: "Provision je Abschluss", text: "Konto, Karte und Finanzierung über Partnerbanken. Der Partner bekommt einen Kunden mit dokumentierter, reparierter Bonität – und zahlt dafür." },
        ]} />
        <div className="dk-raster zwei" style={{ marginTop: 24 }}>
          <Auf><Glas ruhig tag="Privatkunden · monatlich"><Zeilen items={privat.map((p) => [p.label, euro(p.preisCents)] as [string, string])} /></Glas></Auf>
          <Auf verzoegerung={100}><Glas ruhig tag="Geschäftskunden · monatlich"><Zeilen items={business.map((p) => [p.label, euro(p.preisCents)] as [string, string])} /></Glas></Auf>
        </div>
        <p className="dk-leise" style={{ marginTop: 16 }}>Preise aus dem Paketkatalog der Plattform – dieselbe Quelle wie Antrag, Rechnung und Akte.</p>
      </Block>

      <Block pille="Burggraben" titel={<>Warum das schwer zu <span className="dk-verlauf">kopieren</span> ist.</>}>
        <Karten items={[
          { tag: "Recht", titel: "Geprüfte Schreiben, verfolgte Antworten", text: "Jede Vorlage ist anwaltlich geprüft. Jede Antwort einer Auskunftei oder eines Gläubigers wird erfasst. Daraus entsteht Wissen, das keine App hat: Was funktioniert, bei wem, wie schnell." },
          { tag: "Daten", titel: "Auskunft + Kontoauszug + Ergebnis", text: "FIAON sieht, was über den Kunden gespeichert ist, wie seine Finanzen wirklich aussehen und was sich ändern ließ. Drei Datenquellen in einer Akte – mit Einwilligung." },
          { tag: "Vertrieb", titel: "Kunden werden Mitarbeiter", text: "Wer FIAON selbst erlebt hat, verkauft es am besten. Kunden arbeiten von zuhause auf Provision – nach Pflicht-Academy. Der Vertrieb wächst mit der Kundenzahl, nicht mit dem Budget." },
          { tag: "Zugang", titel: "Partner bekommen dokumentierte Bonität", text: "Banken sehen keinen Antrag, sondern eine Akte: bereinigte Einträge, Spielraum, Zahlungshistorie der Raten. Das ist ein besserer Kunde – und ein Grund, exklusiv mit FIAON zu arbeiten." },
        ]} zwei />
      </Block>

      <Block pille="Nordstern" titel={<>Woran wir uns <span className="dk-verlauf">messen.</span></>}
             lead="Vier Kennzahlen, die den Kundennutzen und den Unternehmenswert gleichzeitig abbilden. Die aktuellen Werte liegen im Datenraum und werden monatlich aktualisiert.">
        <Karten items={[
          { tag: "Einsicht", titel: "Zeit bis zur ersten Einsicht", text: "Von der Anmeldung bis zur gelesenen Auskunft im Bereich. Ziel: unter 24 Stunden." },
          { tag: "Aktion", titel: "Antwortquote auf Schreiben", text: "Anteil der versendeten Löschanträge, Widersprüche und Ratenvorschläge, die eine Antwort erhalten – und wie viele davon positiv." },
          { tag: "Zugang", titel: "Graduation-Rate", text: "Anteil der Kunden, die aus dem Programm in Konto oder Karte übergehen. Die Zahl, die Partner interessiert." },
          { tag: "Ertrag", titel: "Raten-Einzugsquote", text: "Anteil der fälligen Raten, die beim ersten Versuch eingezogen werden – und nach Inkasso-Begleitung." },
        ]} zwei />
      </Block>

      <Block pille="Roadmap" titel={<>Erst ein Land <span className="dk-verlauf">perfekt.</span> Dann die Nachbarn.</>}>
        <Schritte items={[
          { titel: "Deutschland", text: "SCHUFA-Auskunft, Löschanträge, Ratenvereinbarungen, Konto und Karte. Der Kundenweg wird bis ins Detail gemessen und verbessert." },
          { titel: "Österreich und Schweiz", text: "KSV und CRIF als Auskunfteien, Länder-Erkennung im Antrag, lokale Partnerbanken. Die Plattform ist dafür bereits gebaut." },
          { titel: "Finanzierung", text: "Die dritte Tür: Ratenkredit und Umschuldung über Partner – für Kunden, deren Akte es trägt." },
          { titel: "Europa", text: "Dasselbe Betriebssystem, weitere Auskunfteien. Der Burggraben – geprüfte Schreiben und verfolgte Antworten – reist mit." },
        ]} />
      </Block>

      <Block pille="Team" titel={<>Wer das <span className="dk-verlauf">baut.</span></>}>
        <Karten items={[
          { tag: "Gründer", titel: "Justin Schwarzott", text: "Gründer und Director der FIAON LTD, London. Führt das Unternehmen seit dem ersten Tag so, als würde es morgen verkauft: Entscheidungsregister, Logbuch, eine Quelle für jede Zahl." },
          { tag: "Recht", titel: "Anwaltsteam", text: "Prüft jede Vorlage, bevor sie ein Kunde versenden kann – Löschantrag, Widerspruch, Ratenvereinbarung. Ohne diese Freigabe geht kein Schreiben hinaus." },
          { tag: "Betrieb", titel: "Vertrieb, Onboarding, Inkasso", text: "Drei Abteilungen mit eigenem Portal: Startgespräch mit jedem Kunden, feste Ansprechpartner, Begleitung jeder Rate. Viele davon waren selbst Kunden." },
        ]} />
      </Block>

      <Block eng schmal>
        <Zitat text="Bonität ist kein Urteil. Sie ist ein Zustand – und Zustände kann man ändern. Wer das für 100 Millionen Menschen tut, baut kein Produkt, sondern eine Infrastruktur." wer="Justin Schwarzott, Gründer FIAON" />
      </Block>

      <Block id="anfrage" pille="Datenraum" titel={<>Zahlen gibt es <span className="dk-verlauf">unter NDA.</span></>}
             lead="Entscheidungsregister, Kennzahlen, Verträge, Technik-Dokumentation. Schreiben Sie uns, wer Sie sind und was Sie suchen – Sie erhalten innerhalb von zwei Werktagen eine Antwort von Justin Schwarzott persönlich." schmal>
        <Anfrage art="investor" knopf="Datenraum anfragen" hinweis="Antwort innerhalb von zwei Werktagen. Kein Newsletter."
                 felder={[
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "firma", label: "Fonds / Unternehmen", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel" },
                   { name: "ticket", label: "Typische Ticketgröße", optionen: ["bis 250.000 €", "250.000 – 1 Mio. €", "1 – 5 Mio. €", "über 5 Mio. €", "Strategischer Partner"] },
                   { name: "rolle", label: "Was suchen Sie?", optionen: ["Seed / Pre-Seed", "Series A", "Strategische Beteiligung", "Übernahme", "Erst einmal verstehen"] },
                   { name: "text", label: "Ihre Nachricht", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Wie verdient FIAON Geld?", a: "Mit dem Abo des Kunden (7,99 € bis 99,99 € im Monat, zwölf Raten), mit der einmaligen Bonitätsauskunft und mit Provisionen der Partnerbanken, wenn ein Kunde über FIAON ein Konto, eine Karte oder eine Finanzierung erhält." },
          { f: "Ist FIAON eine Bank?", a: "Nein. FIAON ist kein Kreditinstitut. Über Konto, Karte und Rahmen entscheidet immer die jeweilige Partnerbank. FIAON bereitet den Kunden vor und dokumentiert seine Bonität." },
          { f: "Wo sitzt das Unternehmen?", a: "FIAON LTD, London (Companies House No. 17318250). Die Kunden sitzen in Deutschland, Österreich und der Schweiz; die Zahlungen laufen per SEPA-Lastschrift über einen verifizierten Kreditor." },
          { f: "Was bekomme ich im Datenraum?", a: "Sechs Kapitel: Unternehmen, Finanzen, Produkt und Technik, Recht und Datenschutz, Team und Verträge, Markt. Dazu das Entscheidungsregister und das Logbuch – beides wird seit dem ersten Tag geführt." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Jede Zahl beginnt mit einem Menschen, der seine Auskunft <span className="dk-verlauf">zum ersten Mal sieht.</span></>}
        text="Das ist der Zusammenhang: Einsicht wird Aktion, Aktion wird Zugang – und Zugang wird Umsatz. Für den Kunden zuerst. Dann für FIAON. Dann für Sie."
        knoepfe={<><Knopf href="#anfrage">Datenraum anfragen</Knopf><Knopf href="/datenraum" still>Wie der Datenraum geführt wird</Knopf></>}
      />
    </Dunkel>
  );
}
