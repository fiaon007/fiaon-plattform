// ═══════════════════════════════════════════════════════════════════════════
// /schufa-score-verstehen — der Pfeiler zur Verständnis-Suche
// (30.08.2026; NEU GESCHRIEBEN 02.09.2026 für den neuen SCHUFA-Score, E-081)
//
// ── WARUM NEU ─────────────────────────────────────────────────────────────
// Seit dem 17. März 2026 gibt es den neuen SCHUFA-Score: eine Skala von 100
// bis 999 Punkten, zwölf veröffentlichte Kriterien mit Höchstpunkten, fünf
// Score-Klassen. Er ersetzt den Basisscore (0–100 Prozent) und die sechs
// Branchenscores (Übergangsfrist für Unternehmen bis Ende 2028). Die alte
// Fassung dieser Seite erklärte den Prozentwert und „97,5 %" — auf einer
// YMYL-Seite ein Vertrauensrisiko, sobald der Leser die neue Zahl sieht.
//
// Quellen: schufa.de/scoring-daten/neuer-score/ (Klassen, Anteile,
// Übergangsfrist); schufa.de Kriterienseiten (Höchstpunkte je Kriterium);
// SCHUFA-Pressemitteilung 17.03.2026 (presseportal.de/pm/121716/6235040);
// Verbraucherzentrale, „Neuer Schufa-Score: Die wichtigsten Infos"
// (26.06.2026). Suchintention: „schufa score bedeutung / tabelle / neuer
// score". JSON-LD: Article + FAQPage (SeoDaten).
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Karten, Fragen, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Was ist ein guter SCHUFA-Score?", a: "Seit März 2026 läuft die Skala von 100 bis 999 Punkten. Ab 776 Punkten gilt die Bonität als „hervorragend“, von 709 bis 775 als „gut“, von 642 bis 708 als „akzeptabel“, darunter als „ausreichend“. Wer eine offene Zahlungsstörung hat, bekommt keinen Punktwert, sondern die Klasse „ungenügend“. Nach Angaben der SCHUFA liegen rund 62 Prozent der Menschen in der besten Klasse." },
  { f: "Wo sehe ich meinen SCHUFA-Score kostenlos?", a: "Seit dem 17. März 2026 digital und kostenlos: im SCHUFA-Account (app.schufa.de) oder über die bonify-App – mit allen zwölf Kriterien und den Punkten je Kriterium. Daneben bleibt die Datenkopie nach Art. 15 DSGVO per Post kostenlos; nur sie zeigt, welche Stelle was gemeldet hat. FIAON bestellt die Datenkopie im Rahmen der Bonitätsauskunft für Sie mit." },
  { f: "Was ist aus dem Basisscore und den Branchenscores geworden?", a: "Der Basisscore (0 bis 100 Prozent) ist mit dem 17. März 2026 abgelöst. Die sechs Branchenscores – für Banken, Sparkassen, Genossenschaftsbanken, Telekommunikation, Handel und Versandhandel – werden durch den einen neuen Score ersetzt; für Unternehmen gilt eine Übergangsfrist bis Ende 2028. Die Verbraucherzentrale stellte im Juni 2026 fest, dass erst etwa ein Viertel der Vertragspartner den neuen Score nutzte – Ihre Bank kann übergangsweise noch mit einem alten Wert arbeiten." },
  { f: "Wie oft wird der SCHUFA-Score neu berechnet?", a: "Der neue Score wird bei jeder Anfrage aus den aktuell gespeicherten Daten berechnet – nicht mehr vierteljährlich wie der alte Basisscore. Eine Löschung oder Berichtigung wirkt deshalb beim nächsten Abruf, sobald die Auskunftei die Daten geändert hat." },
  { f: "Warum bekomme ich bei zwei Banken unterschiedliche Entscheidungen bei gleichem Score?", a: "Weil der SCHUFA-Score nur EIN Baustein ist. Banken rechnen eigene Scorings mit eigenen Grenzen und gewichten Einkommen, Kontoführung und Produktart dazu. Dieselben 720 Punkte können bei der einen Bank für eine Karte reichen und bei der anderen nicht – deshalb ist der Kontoauszug oft entscheidender als die Zahl." },
  { f: "Wie schnell verbessert sich die Zahl nach einer Löschung?", a: "Der Eintrag verschwindet mit der Löschung aus der Auskunft; beim nächsten Abruf rechnet der Score ohne ihn. Eine erledigte Zahlungsstörung wirkt nach den veröffentlichten Kriterien allerdings bis zu drei Jahre nach Erledigung abgeschwächt nach – anders als eine gelöschte, die nie hätte gemeldet werden dürfen. Ein Versprechen, dass eine bestimmte Zahl erreicht wird, kann niemand seriös geben." },
];

/** Die zwölf Kriterien mit Höchstpunkten — Quelle: schufa.de, Kriterienseiten zum neuen Score (Stand 02.09.2026). */
const KRITERIEN: { nr: number; name: string; punkte: number; was: string }[] = [
  { nr: 1, name: "Zahlungsstörungen", punkte: 264, was: "Ohne Zahlungsstörung die vollen 264 Punkte. Eine erledigte Zahlungsstörung zählt zunächst 100 Punkte, nach einem Jahr 135, ab zwei Jahren 152 – bis zu drei Jahre nach Erledigung." },
  { nr: 2, name: "Anfragen und Abschlüsse für Girokonten und Kreditkarten (12 Monate)", punkte: 117, was: "Viele Konto- und Kartenanfragen in kurzer Zeit kosten Punkte." },
  { nr: 3, name: "Anfragen außerhalb des Bankenbereichs (12 Monate)", punkte: 99, was: "Mobilfunk, Versandhandel, Energie: Auch diese Anfragen zählen." },
  { nr: 4, name: "Alter der aktuellen Adresse", punkte: 94, was: "Je länger Sie an derselben Anschrift gemeldet sind, desto mehr Punkte." },
  { nr: 5, name: "Alter der ältesten Kreditkarte", punkte: 81, was: "Eine alte, laufende Kreditkarte ist ein Positivmerkmal – Kündigen kostet Historie." },
  { nr: 6, name: "Alter des ältesten Bankvertrags", punkte: 69, was: "Unter drei Monaten null Punkte, nach einem Jahr zwölf, nach vier Jahren 23, nach zehn Jahren 49, ab 20 Jahren die vollen 69." },
  { nr: 7, name: "Aufgenommene Ratenkredite (12 Monate)", punkte: 66, was: "Mehrere neue Kredite in einem Jahr senken den Wert." },
  { nr: 8, name: "Längste Restlaufzeit aller Ratenkredite", punkte: 61, was: "Sehr lange Restlaufzeiten wirken sich aus." },
  { nr: 9, name: "Immobilienkredit", punkte: 55, was: "Ein laufender Immobilienkredit zählt positiv." },
  { nr: 10, name: "Vorliegen einer Identitätsprüfung", punkte: 38, was: "Eine dokumentierte Identitätsprüfung bringt Punkte." },
  { nr: 11, name: "Alter des jüngsten Rahmenkredits", punkte: 36, was: "Ein ganz frischer Rahmenkredit zählt weniger als ein eingespielter." },
  { nr: 12, name: "Kreditstatus", punkte: 19, was: "Der Stand laufender Kredite." },
];

const HEBEL = [
  { tag: "Hebel 1", titel: "Keine offene Zahlungsstörung", text: "264 von 999 Punkten hängen allein an diesem Kriterium. Eine gemeldete offene Forderung setzt den Score aus – Klasse „ungenügend“. Ist sie erledigt, kommen die Punkte über drei Jahre zurück. Deshalb steht die Prüfung jedes Eintrags ganz vorn: Ein Eintrag, der nie hätte gemeldet werden dürfen, wird gelöscht – und zählt dann gar nicht mehr." },
  { tag: "Hebel 2", titel: "Anfragen bündeln", text: "Zwei Kriterien mit zusammen 216 Punkten bewerten Anfragen der letzten zwölf Monate – bei Banken und außerhalb. Wer Konten, Karten und Verträge vergleicht, sollte das mit Konditionsanfragen tun und Abschlüsse nicht stapeln." },
  { tag: "Hebel 3", titel: "Alte Verträge behalten", text: "Ältester Bankvertrag (69) und älteste Kreditkarte (81) zählen zusammen 150 Punkte. Wer das älteste Konto kündigt, um Gebühren zu sparen, verschenkt Historie. Zweitkonten schließen – das erste nie." },
  { tag: "Hebel 4", titel: "Adresse stabil halten", text: "94 Punkte für das Alter der aktuellen Anschrift. Umzüge lassen sich nicht vermeiden – aber die Ummeldung bei Vertragspartnern und Auskunfteien sollte sofort erfolgen, damit keine Post ins Leere geht und keine Mahnung unbemerkt bleibt." },
  { tag: "Hebel 5", titel: "Kredite maßvoll", text: "Neue Ratenkredite (66), Restlaufzeit (61), Rahmenkredit (36): Ein bedienter Kredit ist kein Makel – mehrere neue in einem Jahr schon. Ein Kredit statt drei ist oft der bessere Weg." },
  { tag: "Hebel 6", titel: "Falsche Daten raus", text: "Erledigte Forderungen ohne Erledigt-Vermerk, doppelte Einträge, falsche Beträge: Solche Daten dürfen nicht einfließen – sie tun es aber, bis jemand widerspricht. Genau hier setzt FIAON an." },
];

export default function SchufaScoreVerstehen() {
  return (
    <Dunkel seite="ratgeber" titel="SCHUFA-Score verstehen: Tabelle und Bedeutung" beschreibung="Der neue SCHUFA-Score seit März 2026: Skala 100 bis 999, fünf Klassen, zwölf Kriterien mit Punkten – als Tabelle erklärt, mit den Hebeln dahinter.">
      <SeoDaten
        pfad="/schufa-score-verstehen"
        titel="SCHUFA-Score verstehen: neue Skala 100–999, Tabelle"
        beschreibung="Der neue SCHUFA-Score seit März 2026: Skala 100 bis 999, fünf Klassen, zwölf Kriterien mit Punkten – als Tabelle erklärt, mit den Hebeln dahinter."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "SCHUFA-Score verstehen: Was Ihre Zahl wirklich bedeutet", stand: "2026-09-02" }}
        krumen={[{ name: "SCHUFA-Score verstehen", pfad: "/schufa-score-verstehen" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Neuer Score seit 17. März 2026</span>
          <h1 className="dk-h1">SCHUFA-Score verstehen: <span className="dk-verlauf">Was Ihre Zahl wirklich bedeutet.</span></h1>
          <p className="dk-lead">
            Seit März 2026 ist der Score eine Zahl zwischen 100 und 999 – aus zwölf veröffentlichten Kriterien,
            in fünf Klassen. Hier steht die Tabelle, jedes Kriterium mit seinen Punkten, die Hebel dahinter
            und der Weg, falsche Einträge loszuwerden. Geprüft wird nach Gesetz, nicht nach Gefühl.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/werkzeuge/eintrag-pruefen" still>Eintrag kostenlos prüfen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        <Block schmal titel="Die Skala: 100 bis 999 Punkte" lead="Der neue SCHUFA-Score ersetzt den Basisscore in Prozent und die sechs Branchenscores. Je höher, desto geringer schätzt die SCHUFA das Ausfallrisiko.">
          <Auf>
            <div className="sx-skala" aria-hidden="true">
              <div className="sx-skala-band"><span className="sx-skala-zeiger" /></div>
              <div className="sx-skala-marken"><span>100</span><span>642</span><span>709</span><span>776</span><span>999</span></div>
            </div>
            <p className="lesart" style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.65, color: "#475569" }}>
              Wer eine offene Zahlungsstörung hat, bekommt keinen Punktwert, sondern die Klasse „ungenügend“.
              Der Score wird bei jeder Anfrage aus den aktuellen Daten berechnet – Änderungen wirken beim
              nächsten Abruf. Verbraucher und Vertragspartner sehen dieselbe Zahl; für Unternehmen gilt eine
              Übergangsfrist bis Ende 2028.
            </p>
          </Auf>
        </Block>

        <Block schmal titel="Die Score-Tabelle: fünf Klassen und ihre Bedeutung" lead="Die Klassen der SCHUFA mit den Anteilen zum Start des neuen Scores. Jede Bank setzt ihre Grenzen trotzdem selbst – dieselbe Zahl kann zwei verschiedene Antworten auslösen.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Punkte</th><th scope="col">Klasse</th><th scope="col">Lesart</th></tr></thead>
              <tbody>
                <tr><td>776 bis 999</td><td>hervorragend</td><td>sehr geringes Risiko – rund 62 % der Menschen</td></tr>
                <tr><td>709 bis 775</td><td>gut</td><td>geringes Risiko – rund 20 %</td></tr>
                <tr><td>642 bis 708</td><td>akzeptabel</td><td>leicht erhöhtes Risiko – rund 8 %, erste Aufschläge</td></tr>
                <tr><td>100 bis 641</td><td>ausreichend</td><td>deutlich erhöhtes Risiko – rund 2 %, Absagen werden häufiger</td></tr>
                <tr><td>kein Wert</td><td>ungenügend</td><td>offene Zahlungsstörung – rund 8 %; fast immer liegt ein angreifbarer oder erledigter Eintrag vor</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Quelle: SCHUFA, „Neuer SCHUFA-Score“ (schufa.de/scoring-daten/neuer-score, abgerufen 02.09.2026).
            Unter 709 Punkten lohnt immer der Blick in die Datenkopie: Häufig drückt ein einzelner – oft
            angreifbarer – Eintrag die Zahl. Welche Einträge angreifbar sind, steht im Ratgeber{" "}
            <a href="/schufa-eintrag-loeschen" style={{ color: "#1d4ed8" }}>SCHUFA-Eintrag löschen lassen</a>.
          </p>
        </Block>

        <Block schmal titel="Die zwölf Kriterien – und was jedes wert ist" lead="Erstmals veröffentlicht die SCHUFA, was zählt und wie viel. Die Höchstpunkte addieren sich auf 999.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Kriterium</th><th scope="col">max. Punkte</th></tr></thead>
              <tbody>
                {KRITERIEN.map((k) => (
                  <tr key={k.nr}><td><b>{k.nr}. {k.name}</b><br /><span style={{ color: "#475569", fontSize: 13 }}>{k.was}</span></td><td>{k.punkte}</td></tr>
                ))}
                <tr className="summe"><td>Summe</td><td>999</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Quelle: SCHUFA, Kriterienseiten zum neuen Score (schufa.de, abgerufen 02.09.2026). Die Punktverteilung
            innerhalb eines Kriteriums – etwa nach Alter des Vertrags – veröffentlicht die SCHUFA je Kriterium;
            die Beispiele in der Tabelle stammen von dort.
          </p>
        </Block>

        <Block titel="Was den Score bewegt" lead="Aus zwölf Kriterien werden sechs Hebel – sortiert nach Punkten, nicht nach Gefühl.">
          <Karten items={HEBEL.map((h) => ({ tag: h.tag, titel: h.titel, text: h.text }))} />
        </Block>

        <Block schmal titel="Was FIAON daraus macht" lead="Verstehen ist der Anfang. Danach kommt Arbeit mit Fristen und Paragrafen – die übernehmen wir.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p>
              <h3>Auskünfte beschaffen</h3>
              <p className="wz-hinweis">FIAON holt Ihre Daten bei SCHUFA, KSV (Österreich) und CRIF (Schweiz) ein – vollständig, als Datenkopie mit allen Meldedaten. Sie sehen den Eingang in Ihrem Kundenbereich, meist innerhalb von 24 Stunden nach Vorliegen.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p>
              <h3>Jeden Eintrag erklären und prüfen</h3>
              <p className="wz-hinweis">Jede Zeile wird gegen die gesetzlichen Voraussetzungen gehalten: § 31 BDSG (zulässige Meldung), Art. 16/17 DSGVO (Berichtigung, Löschung), die Löschfristen der Verhaltensregeln. Sie bekommen Klartext: Was steht da, was kostet es an Punkten, was lässt sich tun.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p>
              <h3>Schriftwechsel führen, Fristen halten</h3>
              <p className="wz-hinweis">Für angreifbare Einträge bereitet FIAON die Schreiben an Auskunftei und meldende Stelle vor und verfolgt die Fristen. Was berechtigt und zulässig gemeldet ist, bleibt – das sagen wir genauso deutlich, denn ein Versprechen wäre unseriös.</p>
            </div>
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/bonitaetsauskunft-beantragen">So läuft die Bonitätsauskunft</Knopf>
            <Knopf href="/werkzeuge/selbstauskunft" still>Selbst anfordern (kostenlos)</Knopf>
          </div>
        </Block>

        <Block schmal titel="Ein Beispiel aus der Praxis" lead="Ein nachgestellter, typischer Fall – ein Beispiel, kein Versprechen.">
          <Auf>
            <Glas ruhig>
              <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.75 }}>
                Lena, 29, sieht bei einer Finanzierungsanfrage zum ersten Mal ihre Klasse: „ungenügend“, kein
                Punktwert. Die Datenkopie zeigt den Grund – eine Mobilfunkforderung über 214 Euro aus einem
                Umzugsjahr, gemeldet als offene Forderung. Die Prüfung ergibt: Es gab nur EINE Mahnung, nicht
                die zwei, die § 31 BDSG verlangt – der Eintrag war nie zulässig. Nach dem Widerspruch mit
                Fristsetzung löscht die Auskunftei. Beim nächsten Abruf rechnet der Score ohne den Eintrag:
                264 Punkte für „keine Zahlungsstörung“ statt Aussetzung – Lena landet in der Klasse „gut“. Nicht,
                weil jemand „den Score verbessert“ hätte, sondern weil eine unzulässige Information nicht mehr
                mitrechnet. Ob die Bank finanziert, entscheidet weiterhin die Bank.
              </p>
            </Glas>
          </Auf>
        </Block>

        <Block schmal titel="Häufige Fragen zum SCHUFA-Score">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Vertiefen: <a href="/ratgeber/neuer-schufa-score-2026-was-sich-aendert" style={{ color: "#1d4ed8" }}>Der neue Score im Detail</a> ·{" "}
            <a href="/eintrag-verjaehrung" style={{ color: "#1d4ed8" }}>Wann Einträge verjähren</a> ·{" "}
            <a href="/schufa-neutral-anfragen" style={{ color: "#1d4ed8" }}>SCHUFA-neutral anfragen</a> ·{" "}
            <a href="/glossar-bonitaet" style={{ color: "#1d4ed8" }}>alle Begriffe im Glossar</a> ·{" "}
            <a href="/bonitaet-verbessern" style={{ color: "#1d4ed8" }}>Bonität Schritt für Schritt aufbauen</a>.
            Redaktionelle Einordnung, Stand 2. September 2026 – keine Rechtsberatung im Einzelfall.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Erst die Auskunft, dann die Klarheit."
        satz="FIAON beschafft Ihre Auskünfte bei SCHUFA, KSV und CRIF, erklärt jede Zeile in Klartext und greift an, was angreifbar ist. Konto in zwei Minuten eröffnet – den Rest sehen Sie in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
