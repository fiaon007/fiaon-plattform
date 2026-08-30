// ═══════════════════════════════════════════════════════════════════════════
// /schufa-score-verstehen — der Pfeiler zur Verständnis-Suche (30.08.2026)
//
// Suchintention: „schufa score bedeutung / tabelle“. Wer das sucht, hat eine
// Zahl vor sich und versteht sie nicht. Die Seite beantwortet genau das:
// die Bereiche als Tabelle, die Hebel dahinter, und was FIAON daraus macht.
// Message-Match für Anzeigen: Die H1 spiegelt die Suche wörtlich.
// JSON-LD: Article + FAQPage (über SeoDaten).
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Karten, Fragen, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Was ist ein guter SCHUFA-Score?", a: "Als Faustregel gilt: Ab etwa 97,5 % stufen die meisten Banken das Ausfallrisiko als sehr gering ein, zwischen 95 und 97,5 % als gering. Unter 90 % wird es spürbar — Ratenkäufe, Verträge und Kredite werden teurer oder scheitern. Wichtig: Jede Bank legt die Grenzen selbst fest; dieselbe Zahl kann bei zwei Instituten zwei verschiedene Antworten auslösen." },
  { f: "Wo sehe ich meinen SCHUFA-Score kostenlos?", a: "Über die Datenkopie nach Art. 15 DSGVO — sie ist gesetzlich kostenlos und enthält Ihre gespeicherten Daten samt Score-Informationen. FIAON bestellt sie im Rahmen der Bonitätsauskunft für Sie mit und erklärt jeden Eintrag. Die Bezahlprodukte der Auskunfteien zeigen nicht mehr Daten als die Datenkopie." },
  { f: "Wie oft wird der SCHUFA-Score aktualisiert?", a: "Der Basisscore wird alle drei Monate neu berechnet. Branchenscores, die Banken abfragen, entstehen tagesaktuell im Moment der Anfrage. Eine Löschung oder Berichtigung wirkt deshalb nicht immer sofort sichtbar — beim nächsten Berechnungslauf aber schon." },
  { f: "Warum bekomme ich bei zwei Banken unterschiedliche Entscheidungen bei gleichem Score?", a: "Weil der SCHUFA-Score nur EIN Baustein ist. Banken rechnen eigene Scorings mit eigenen Grenzen und gewichten Einkommen, Kontoführung und Produktart dazu. Deshalb formulieren wir bei FIAON immer gleich: Die Entscheidung trifft die Bank — der Score öffnet oder verschließt nur die Tür zum Gespräch." },
  { f: "Schaden Kontowechsel oder viele Girokonten dem Score?", a: "Viele parallel geführte Konten und Karten können sich auswirken, weil sie als Merkmal in die Berechnung einfließen. Ein normaler Kontowechsel ist unkritisch. Kritischer sind viele KREDITanfragen in kurzer Zeit — dafür gibt es die Konditionsanfrage, die scorefrei bleibt." },
  { f: "Wie schnell verbessert sich die Zahl nach einer Löschung?", a: "Der Eintrag verschwindet mit der Löschung aus der Auskunft; die Score-Neuberechnung folgt im nächsten Lauf, beim Basisscore also binnen bis zu drei Monaten. Ein Versprechen, dass eine bestimmte Zahl erreicht wird, gibt es nicht — die Berechnungsformel ist Geschäftsgeheimnis der SCHUFA." },
];

const HEBEL = [
  { tag: "Hebel 1", titel: "Zahlungsverhalten", text: "Pünktlich bediente Rechnungen, Raten und Verträge sind das stärkste Positivmerkmal. Ein einziger harter Negativeintrag — eine gemeldete offene Forderung — wiegt dagegen schwerer als jahrelanges Wohlverhalten. Deshalb beginnt jede Verbesserung mit der Frage: Welche Negativmerkmale stehen drin, und sind sie überhaupt zulässig gemeldet?" },
  { tag: "Hebel 2", titel: "Kreditanfragen", text: "Jede echte Kreditanfrage wird zwölf Monate gespeichert und ist zehn Tage für andere Banken sichtbar. Mehrere Anfragen in kurzer Zeit lesen sich wie Geldnot. Die Lösung ist keine Zurückhaltung, sondern die richtige Anfrageart: die Konditionsanfrage — sie liefert dieselben Zahlen und bleibt scorefrei." },
  { tag: "Hebel 3", titel: "Anzahl der Konten und Karten", text: "Girokonten, Kreditkarten und Handyverträge werden als Vertragsdaten gespeichert. Eine gewachsene, ruhige Kontenlandschaft wirkt stabil. Viele junge Konten, häufige Wechsel und ungenutzte Kreditkarten erzeugen das Gegenteil. Aufräumen ist erlaubt — kündigen Sie, was Sie nicht brauchen." },
  { tag: "Hebel 4", titel: "Alter der Kredithistorie", text: "Ein Konto, das seit zehn Jahren sauber läuft, erzählt eine bessere Geschichte als drei neue. Deshalb ist das älteste Konto oft das wertvollste — wer Konten schließt, schließt zuletzt das älteste. Und wer neu anfängt, braucht vor allem eines: Zeit und pünktliche Zahlungen." },
  { tag: "Hebel 5", titel: "Laufende Kredite und Bürgschaften", text: "Ein bedienter Ratenkredit ist kein Makel — er beweist Rückzahlung. Viele parallele Kredite, Null-Prozent-Finanzierungen und Bürgschaften summieren sich aber zu einer Last, die das Risiko-Modell einpreist. Eine Umschuldung auf EINEN Kredit ordnet das Bild." },
  { tag: "Hebel 6", titel: "Veraltete und falsche Daten", text: "Erledigte Forderungen, die länger als drei Jahre stehen, doppelte Einträge, falsche Beträge: Solche Daten dürfen nicht mehr einfließen — sie tun es aber, bis jemand widerspricht. Genau hier setzt die Prüfung an: Datenkopie ziehen, jeden Eintrag gegen die Fristen und § 31 BDSG halten." },
];

export default function SchufaScoreVerstehen() {
  return (
    <Dunkel seite="ratgeber" titel="SCHUFA-Score verstehen: Tabelle und Bedeutung" beschreibung="Was Ihr SCHUFA-Score wirklich bedeutet: alle Score-Bereiche als Tabelle, die sechs größten Hebel und was FIAON für Sie prüft. Jetzt Auskunft sichern.">
      <SeoDaten
        pfad="/schufa-score-verstehen"
        titel="SCHUFA-Score verstehen: Tabelle und Bedeutung | FIAON"
        beschreibung="Was Ihr SCHUFA-Score wirklich bedeutet: alle Score-Bereiche als Tabelle, die sechs größten Hebel und was FIAON für Sie prüft. Jetzt Auskunft sichern."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "SCHUFA-Score verstehen: Was Ihre Zahl wirklich bedeutet", stand: "2026-08-30" }}
        krumen={[{ name: "SCHUFA-Score verstehen", pfad: "/schufa-score-verstehen" }]}
      />

      {/* Über dem Falz: H1 im Wortlaut der Suche, ein Vertrauenssatz, zwei Wege. */}
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Verstehen · Prüfen · Handeln</span>
          <h1 className="dk-h1">SCHUFA-Score verstehen: <span className="dk-verlauf">Was Ihre Zahl wirklich bedeutet.</span></h1>
          <p className="dk-lead">
            Eine Zahl entscheidet mit über Wohnung, Vertrag und Kredit — und kaum jemand erklärt sie.
            Hier steht die Tabelle, die Hebel dahinter und der Weg, falsche Einträge loszuwerden.
            Geprüft wird nach Gesetz, nicht nach Gefühl.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* S1: Die Skala — ein Bild sagt, wo man steht. */}
        <Block schmal titel="Die Skala: von kritisch bis ausgezeichnet" lead="Der Basisscore ist ein Prozentwert zwischen 0 und 100 — er schätzt die Wahrscheinlichkeit, dass Sie Ihre Verpflichtungen erfüllen.">
          <Auf>
            <div className="sx-skala" aria-hidden="true">
              <div className="sx-skala-band"><span className="sx-skala-zeiger" /></div>
              <div className="sx-skala-marken"><span>0 %</span><span>50 %</span><span>80 %</span><span>90 %</span><span>97,5 %</span><span>100 %</span></div>
            </div>
            <p className="lesart" style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.65, color: "#475569" }}>
              100 % erreicht niemand — selbst der beste Wert bleibt knapp darunter, weil ein Restrisiko
              (statistisch) immer bleibt. Entscheidend ist nicht die Zahl allein, sondern der Bereich,
              in dem sie liegt.
            </p>
          </Auf>
        </Block>

        {/* S2: Die Tabelle — das, was gesucht wurde. */}
        <Block schmal titel="Die Score-Tabelle: Bereiche und ihre Bedeutung" lead="Die gängige Lesart des Basisscores. Jede Bank setzt ihre Grenzen selbst — dieselbe Zahl kann zwei verschiedene Antworten auslösen.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Basisscore</th><th scope="col">Lesart der Banken</th></tr></thead>
              <tbody>
                <tr><td>über 97,5 %</td><td>sehr geringes Risiko — beste Konditionen erreichbar</td></tr>
                <tr><td>95 % bis 97,5 %</td><td>geringes bis überschaubares Risiko</td></tr>
                <tr><td>90 % bis 95 %</td><td>zufriedenstellend bis leicht erhöht — erste Aufschläge</td></tr>
                <tr><td>80 % bis 90 %</td><td>deutlich erhöhtes Risiko — Absagen werden häufiger</td></tr>
                <tr><td>50 % bis 80 %</td><td>hohes Risiko — Verträge meist nur gegen Sicherheiten</td></tr>
                <tr><td>unter 50 %</td><td>sehr kritisch — fast immer liegt ein Negativmerkmal vor</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Unter 90 % lohnt immer der Blick in die Datenkopie: Häufig drückt ein einzelner — oft
            angreifbarer — Eintrag die Zahl. Welche Einträge angreifbar sind, steht im Ratgeber
            {" "}<a href="/schufa-eintrag-loeschen" style={{ color: "#1d4ed8" }}>SCHUFA-Eintrag löschen lassen</a>.
          </p>
        </Block>

        {/* S3: Was den Score bewegt — sechs Karten. */}
        <Block titel="Was den Score bewegt" lead="Die Berechnungsformel ist Geschäftsgeheimnis — die Merkmale dahinter sind bekannt. Sechs Hebel, sortiert nach Wirkung.">
          <Karten items={HEBEL.map((h) => ({ tag: h.tag, titel: h.titel, text: h.text }))} />
        </Block>

        {/* S4: Was FIAON tut — drei Schritte. */}
        <Block schmal titel="Was FIAON daraus macht" lead="Verstehen ist der Anfang. Danach kommt Arbeit mit Fristen und Paragrafen — die übernehmen wir.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p>
              <h3>Auskünfte beschaffen</h3>
              <p className="wz-hinweis">FIAON holt Ihre Daten bei SCHUFA, KSV (Österreich) und CRIF (Schweiz) ein — vollständig, als Datenkopie mit allen Meldedaten. Sie sehen den Eingang in Ihrem Kundenbereich, meist innerhalb von 24 Stunden nach Vorliegen.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p>
              <h3>Jeden Eintrag erklären und prüfen</h3>
              <p className="wz-hinweis">Jede Zeile wird gegen die gesetzlichen Voraussetzungen gehalten: § 31 BDSG (zulässige Meldung), Art. 16/17 DSGVO (Berichtigung, Löschung), die Löschfristen der Verhaltensregeln. Sie bekommen Klartext: Was steht da, was bedeutet es, was ist angreifbar.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p>
              <h3>Schriftwechsel führen, Fristen halten</h3>
              <p className="wz-hinweis">Für angreifbare Einträge bereitet FIAON die Schreiben an Auskunftei und meldende Stelle vor und verfolgt die Fristen. Was berechtigt und zulässig gemeldet ist, bleibt — das sagen wir genauso deutlich, denn ein Versprechen darauf wäre unseriös.</p>
            </div>
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/bonitaetsauskunft-beantragen">So läuft die Bonitätsauskunft</Knopf>
            <Knopf href="/werkzeuge/selbstauskunft" still>Selbst anfordern (kostenlos)</Knopf>
          </div>
        </Block>

        {/* S5: Das Rechen-Beispiel als Geschichte. */}
        <Block schmal titel="Ein Beispiel aus der Praxis" lead="Ein nachgestellter, typischer Fall — ein Beispiel, kein Versprechen.">
          <Auf>
            <Glas ruhig>
              <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.75 }}>
                Lena, 29, sieht bei einer Finanzierungsanfrage zum ersten Mal ihre Zahl: 88,6 %.
                Die Datenkopie zeigt den Grund — eine Mobilfunkforderung über 214 Euro aus einem
                Umzugsjahr, gemeldet als offene Forderung. Die Prüfung ergibt: Es gab nur EINE
                Mahnung, nicht die zwei, die § 31 BDSG verlangt — der Eintrag war nie zulässig.
                Nach dem Widerspruch mit Fristsetzung löscht die Auskunftei. Beim nächsten
                Berechnungslauf springt Lenas Basisscore in den Bereich über 95 % — nicht, weil
                jemand „den Score verbessert“ hätte, sondern weil eine unzulässige Information
                nicht mehr mitrechnet. Ob die Bank finanziert, entscheidet weiterhin die Bank.
              </p>
            </Glas>
          </Auf>
        </Block>

        {/* S6: FAQ */}
        <Block schmal titel="Häufige Fragen zum SCHUFA-Score">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Vertiefen: <a href="/eintrag-verjaehrung" style={{ color: "#1d4ed8" }}>Wann Einträge verjähren</a> ·{" "}
            <a href="/schufa-neutral-anfragen" style={{ color: "#1d4ed8" }}>SCHUFA-neutral anfragen</a> ·{" "}
            <a href="/glossar-bonitaet" style={{ color: "#1d4ed8" }}>alle Begriffe im Glossar</a> ·{" "}
            <a href="/bonitaet-verbessern" style={{ color: "#1d4ed8" }}>Bonität Schritt für Schritt aufbauen</a>.
            Redaktionelle Einordnung, Stand August 2026 — keine Rechtsberatung im Einzelfall.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Erst die Auskunft, dann die Klarheit."
        satz="FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext und greift an, was angreifbar ist. Konto in zwei Minuten eröffnet — den Rest sehen Sie in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
