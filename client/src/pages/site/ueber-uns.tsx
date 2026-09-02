// ═══════════════════════════════════════════════════════════════════════════
// /ueber-uns — die Geschichte und die Haltung (02.09.2026, E-083)
//
// Seite 5 im Zehn-Seiten-Plan. /team zeigt Menschen, /was-ist-fiaon das
// Modell — die Gründungsgeschichte, die Meilensteine und die Haltung
// fehlten. E-E-A-T: Wer steht dahinter, seit wann, warum, und woran hält
// sich das Haus. Alle Daten aus Register, Logbuch und Datenbank; keine
// Erzählung, die sich nicht belegen lässt. Sitz London + Kunden DACH wird
// erklärt statt versteckt (Prüfer fragen danach).
// Meilensteine: Handelsregister (Company No. 17318250), erste bank-
// bestätigte Zahlung 04.07.2026 (Datenbank), Umzug der Server nach
// Frankfurt 24.08.2026 (Logbuch), 443 zahlende Kunden am 02.09.2026.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Karten, Kennzahlen, Zitat, Auf, Szenenbild, Fragen } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Warum sitzt FIAON in London, wenn die Kunden in Deutschland, Österreich und der Schweiz sind?", a: "Die Gesellschaft wurde als FIAON LTD im britischen Handelsregister gegründet (Company No. 17318250) – schnell, transparent und mit öffentlich einsehbaren Unterlagen. Der Betrieb, das Team und die Server sind in der DACH-Region: Server in Frankfurt, Support mit Schweizer Nummer, Kunden in drei Ländern. Eine Gesellschaft im EWR ist in Vorbereitung." },
  { f: "Wer steht hinter FIAON?", a: "Gründer und Geschäftsführer Justin Schwarzott; Florentine Lombardi (Menschen und Onboarding) und Daniel Stripling (Vertrieb) als Gesellschafter im operativen Betrieb; ein Team aus Vertrieb, Onboarding und Forderungsmanagement – viele davon selbst ehemalige Kunden. Investor und Partner: Schwarzott Capital Partners AG, Zürich. Namen und Gesichter stehen auf der Team-Seite." },
  { f: "Ist FIAON eine Bank, ein Inkasso oder eine Kanzlei?", a: "Nichts davon. FIAON ist eine Bonitätsplattform: Auskunft beschaffen und erklären, Einträge nach DSGVO und § 31 BDSG angreifen, Raten verhandeln, Konto und Karte beim Partnerinstitut vorbereiten. Keine Rechtsberatung im Einzelfall, keine Kreditvermittlung, keine eigenen Konten." },
  { f: "Wie verdient FIAON Geld?", a: "Mit Festpreisen: der Bonitätsauskunft (74 Euro einmalig) und Paketen über zwölf Monatsraten. Keine Erfolgsbeteiligung, keine Gebühr je Schreiben. Über Partnerbanken kann später eine Vergütung je vermitteltem Konto hinzukommen – das steht offen auf der Partner-Seite." },
  { f: "Warum führt FIAON ein öffentliches Entscheidungsregister?", a: "Weil ein Unternehmen, das jederzeit geprüft werden kann, besser geführt wird. Jede Entscheidung mit Datum, Alternativen und Begründung; jeder Tag im Logbuch. Investoren sehen es im Datenraum, Kunden merken es daran, dass Regeln nicht über Nacht wechseln." },
];

const MEILENSTEINE = [
  { zeit: "2025", titel: "Gründung als FIAON LTD", text: "Eintragung im britischen Handelsregister (Company No. 17318250). Die Idee: Der Platz zwischen Auskunftei und Bank ist unbesetzt – Score-Apps zeigen, Banken entscheiden, dazwischen hilft niemand." },
  { zeit: "Frühjahr 2026", titel: "Die Plattform wird gebaut", text: "Kundenbereich, Antrag, Startgespräch, Schreiben aus anwaltlich geprüften Vorlagen. Zahlungen per Überweisung und SEPA-Lastschrift über einen verifizierten Kreditor – nie Vorkasse für Unerbrachtes." },
  { zeit: "4. Juli 2026", titel: "Erste bankbestätigte Zahlung", text: "Der erste Kunde, dessen Zahlung die Bank bestätigt hat – seither zählt FIAON nur, was bankbestätigt ist. Keine Anmeldungen, keine Absichten." },
  { zeit: "August 2026", titel: "Team, Academy, Ratgeber, Werkzeuge", text: "Acht Menschen in Vertrieb, Onboarding und Forderungsmanagement; niemand spricht mit Kunden, bevor er die Academy bestanden hat. Der Ratgeber mit Quellen je Zahl, die ersten kostenlosen Werkzeuge." },
  { zeit: "24. August 2026", titel: "Server nach Frankfurt", text: "Anwendung und Datenbank ziehen aus den USA in die EU-Region Frankfurt um. Seither: Deploys ohne Unterbrechung über einen Gesundheitspfad, Praxistest gegen die echte Datenbank vor jedem Release." },
  { zeit: "2. September 2026", titel: "Über 440 zahlende Kunden, 20 Werkzeuge", text: "443 zahlende Kunden in Deutschland, Österreich und der Schweiz, 450 bezahlte Raten, 20 kostenlose Werkzeuge, 57 Ratgeber – und die Korrektur aller Texte auf den neuen SCHUFA-Score." },
];

export default function UeberUns() {
  return (
    <Dunkel seite="team" titel="Über FIAON · Geschichte, Meilensteine, Haltung" beschreibung="Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, jede Entscheidung im Register. Sitz London, Betrieb in DACH.">
      <SeoDaten pfad="/ueber-uns" titel="Über FIAON: Geschichte, Meilensteine und Haltung" beschreibung="Warum es FIAON gibt, wer dahintersteht, was seit der Gründung passiert ist und woran sich das Haus hält: Sie-Form, keine Garantien, jede Entscheidung im Register." fragen={FRAGEN} krumen={[{ name: "Über FIAON", pfad: "/ueber-uns" }]} />

      <Hero
        bild="/kino/investoren.jpg"
        pille="Über FIAON"
        titel={<>Der Platz, den <span className="dk-verlauf">niemand besetzt hatte.</span></>}
        lead="Score-Apps zeigen eine Zahl. Banken entscheiden. Dazwischen stand niemand – bis FIAON. Hier steht, warum es uns gibt, was seit der Gründung passiert ist und woran wir uns halten. Mit Daten, nicht mit Gefühlen."
        knoepfe={<><Knopf href="#meilensteine">Die Meilensteine</Knopf><Knopf href="/team" still>Das Team</Knopf></>}
      />

      <Block eng>
        <Kennzahlen items={[{ wert: "2025", label: "gegründet, FIAON LTD" }, { wert: "440+", label: "zahlende Kunden, bankbestätigt" }, { wert: "3", label: "Länder: DE, AT, CH" }, { wert: "8", label: "Menschen im Team" }]} />
        <p className="dk-leise" style={{ textAlign: "center", marginTop: 14 }}>Stand 2. September 2026.</p>
      </Block>

      <Licht>
        <Block schmal titel={<>Warum es FIAON <span className="dk-verlauf">gibt.</span></>} lead="Eine Beobachtung, die jeder kennt, der je eine Ablehnung ohne Erklärung bekommen hat.">
          <Auf>
            <p className="dk-text" style={{ fontSize: 16, lineHeight: 1.8 }}>100 Millionen Menschen in Deutschland, Österreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Die meisten wissen nicht, was dort steht. Wer es herausfindet, steht vor einem Berg: Paragrafen, Fristen, Formulare, Briefe, die niemand zurückverfolgt. Score-Apps zeigen die Zahl und lassen einen dann allein. Anwälte sind für die Klage da, nicht für den zwölften Nachfass-Brief. Schuldnerberatungen sind wertvoll – und haben Wartelisten.</p>
            <p className="dk-text" style={{ fontSize: 16, lineHeight: 1.8, marginTop: 14 }}>FIAON besetzt den Platz dazwischen: Einsicht (die Auskunft, erklärt), Aktion (Schreiben, die rausgehen und verfolgt werden), Zugang (das Konto, die Karte, später die Finanzierung). Ein Betriebssystem für Bonität – gebaut wie eine Bank, gesprochen wie ein Mensch.</p>
          </Auf>
        </Block>

        <Block id="meilensteine" schmal titel={<>Was seit der Gründung <span className="dk-verlauf">passiert ist.</span></>} lead="Jeder Punkt lässt sich belegen – im Handelsregister, im Logbuch, in der Datenbank.">
          <Auf>
            <div className="sx-zeitleiste">
              {MEILENSTEINE.map((m, i) => (
                <div key={m.zeit} className="sx-etappe">
                  <div className="spur"><span className="punkt">{i + 1}</span>{i < MEILENSTEINE.length - 1 && <span className="faden" />}</div>
                  <div className="inhalt"><span className="dauer">{m.zeit}</span><h3>{m.titel}</h3><p>{m.text}</p></div>
                </div>
              ))}
            </div>
          </Auf>
        </Block>
      </Licht>

      <Szenenbild tief src="/kino/kugel.jpg" titel={<>Erst ein Land perfekt. <span className="dk-verlauf">Dann die Nachbarn.</span></>} text="Deutschland mit der SCHUFA, Österreich mit KSV1870 und CRIF, die Schweiz mit CRIF, Intrum und dem Betreibungsregister – dieselbe Plattform, drei Regelwerke. Danach Europa: dasselbe Betriebssystem, weitere Auskunfteien." />

      <Licht>
        <Block titel={<>Woran wir uns <span className="dk-verlauf">halten.</span></>} lead="Vier Regeln, die in jedem Gespräch, jedem Schreiben und jeder Entscheidung gelten.">
          <Karten items={[
            { tag: "Respekt", titel: "Sie-Form, immer", text: "Kunden werden gesiezt. Wer bei FIAON anruft, spricht mit jemandem, der seine Akte kennt – nicht mit einer Warteschleife und nicht mit einem Bot." },
            { tag: "Ehrlichkeit", titel: "Keine Fantasiezahlen", text: "Über Konto und Karte entscheidet die Bank. Berechtigte Einträge lassen sich nicht weglöschen. Wir versprechen, was wir halten: Einsicht binnen 24 Stunden nach Vorliegen, geprüfte Schreiben, verfolgte Antworten." },
            { tag: "Prüfbarkeit", titel: "Jede Entscheidung ein Eintrag", text: "Entscheidungsregister und Logbuch seit Tag eins, eine Quelle für jede Zahl. Wer das Unternehmen prüft, findet alles – Investoren im Datenraum, Kunden in ihrer Akte." },
            { tag: "Herkunft", titel: "Wem geholfen wurde, hilft", text: "Viele im Team waren selbst Kunden. Sie erklären den Weg, weil sie ihn gegangen sind – nach der Academy, mit Prüfung, bevor sie das erste Gespräch führen." },
          ]} />
        </Block>

        <Block schmal titel={<>Sitz London, <span className="dk-verlauf">Betrieb in DACH.</span></>} lead="Eine Frage, die Prüfer stellen – deshalb steht die Antwort hier.">
          <p className="dk-text" style={{ fontSize: 15.5, lineHeight: 1.75 }}>FIAON LTD ist im britischen Handelsregister eingetragen (Company No. 17318250, 128 City Road, London EC1V 2NX) – mit öffentlich einsehbaren Unterlagen. Der Betrieb liegt in der DACH-Region: Server und Datenbank in Frankfurt am Main, Support unter einer Schweizer Nummer, Team und Kunden in Deutschland, Österreich und der Schweiz, Investor in Zürich. Eine Gesellschaft im Europäischen Wirtschaftsraum ist in Vorbereitung; Entscheidung und Begründung stehen im Register.</p>
        </Block>

        <Block schmal><Zitat text="Ein Unternehmen, das jederzeit geprüft werden kann, wird besser geführt. Deshalb halten wir alles fest – nicht für den Verkauf, sondern für die Kunden." wer="Justin Schwarzott, Gründer und Geschäftsführer" /></Block>

        <Block schmal titel="Häufige Fragen zu FIAON"><Fragen items={FRAGEN} /></Block>
      </Licht>

      <Block schmal>
        <div className="dk-knoepfe" style={{ justifyContent: "center" }}>
          <Knopf href="/team">Das Team kennenlernen</Knopf>
          <Knopf href="/fiaon-erfahrungen" still>So arbeitet FIAON</Knopf>
          <Knopf href="/presse" still>Presse</Knopf>
        </div>
      </Block>
    </Dunkel>
  );
}
