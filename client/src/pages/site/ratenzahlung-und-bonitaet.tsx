// ═══════════════════════════════════════════════════════════════════════════
// /ratenzahlung-und-bonitaet — der Pfeiler zur Raten-Suche (30.08.2026)
//
// Suchintention: „raten zahlen schufa auswirkung“. Die Botschaft der Seite
// ist eine einzige, in beide Richtungen: Pünktliche Raten sind der stärkste
// Hebel, den man selbst in der Hand hat — und Rückstände eskalieren in
// bekannten, vorhersehbaren Stufen. Die 12er-Ratenleiste ist dieselbe
// Bildsprache wie in unseren Kunden-Mails: zwölf Felder, die sich füllen.
// JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Fragen, Karten, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Verbessern pünktliche Raten wirklich meine Bonität?", a: "Ja — Zahlungsverhalten ist das Kernmerkmal jedes Risiko-Modells. Ein Ratenvertrag, der über Monate vertragsgemäß läuft, erzeugt fortlaufend Positivdaten: Historie, Verlässlichkeit, Stabilität. Eine konkrete Score-Zahl kann daraus niemand seriös versprechen — die Richtung ist aber eindeutig, und sie liegt komplett in Ihrer Hand." },
  { f: "Schadet ein Ratenkauf grundsätzlich dem Score?", a: "Ein einzelner, bedienter Ratenvertrag ist kein Makel. Was das Bild kippt: viele parallele Finanzierungen, ausgereizte Rahmen und Null-Prozent-Käufe im Dutzend — sie lesen sich als dünne Decke. Faustregel: so wenige parallele Verträge wie möglich, und jeder davon pünktlich." },
  { f: "Was passiert nach EINER verpassten Rate?", a: "Eine einzelne verspätete Rate löst noch keinen SCHUFA-Eintrag aus — sie startet die Eskalation: Erinnerung, Mahnung, Verzugskosten. Gefährlich wird es ab der zweiten Mahnung mit Meldedrohung (§ 31 BDSG verlangt genau diese Kette vor einer Meldung). Wer in dieser Phase reagiert und zahlt oder eine Vereinbarung trifft, verhindert den Eintrag fast immer." },
  { f: "Rücklastschrift — wie schlimm ist das?", a: "Eine Rücklastschrift kostet Gebühren und ist ein Warnsignal an den Vertragspartner, wird aber nicht automatisch gemeldet. Häufige Rückgaben führen zu Kündigungen von Verträgen — und DIE landen dann in der Auskunft. Der beste Schutz ist banal: Dauerauftrag oder Lastschrift aufs richtige Konto und ein Blick in den Kalender vor dem Abbuchungstag." },
  { f: "Bringt es etwas, Raten VORZEITIG zu zahlen?", a: "Für die Bonität zählt vor allem VERTRAGSGEMÄSS — pünktlich ist der Standard, den die Modelle belohnen. Vorzeitige Ablösung spart Zinsen und schließt den Vertrag positiv ab; ein Turbo für den Score ist sie nicht. Wichtiger ist, dass nie eine Rate reißt." },
  { f: "Ich habe schon einen Rückstand — was ist jetzt klug?", a: "Sofort handeln, schriftlich: Kontakt zum Gläubiger, realistische Raten anbieten, Bestätigung einholen. Wird eine gemeldete Forderung innerhalb von 100 Tagen vollständig ausgeglichen, verkürzt sich die Speicherfrist auf 18 Monate. Und prüfen Sie parallel, ob eine bereits erfolgte Meldung überhaupt zulässig war — die Regeln stehen in unserem Inkasso-Ratgeber." },
];

const TIPPS = [
  { tag: "Tipp 1", titel: "Ein Abbuchungstag für alles", text: "Legen Sie alle Raten auf denselben Tag — am besten direkt nach dem Gehaltseingang. Ein einziger Kontrolltermin im Monat statt fünf verstreuter Fallen. Die meisten Anbieter ändern den Abbuchungstag auf kurze Nachricht hin." },
  { tag: "Tipp 2", titel: "Puffer aufs Zahlkonto", text: "Eine Monatsrate als stehender Puffer auf dem Konto, von dem abgebucht wird, fängt fast jede Panne ab: die verspätete Gehaltszahlung, die vergessene Jahresrechnung. Rücklastschriften entstehen selten aus Armut — meist aus Timing." },
  { tag: "Tipp 3", titel: "Erinnerung vor Fälligkeit", text: "Zwei Tage vor jedem Abbuchungstermin eine Erinnerung — im Handy-Kalender oder im FIAON-Zahlungskalender, der Kunden automatisch vor jeder Rate erinnert. Wer erinnert wird, dem platzt nichts." },
  { tag: "Tipp 4", titel: "Nicht stapeln", text: "Vor jedem neuen Ratenkauf die ehrliche Frage: Läuft schon einer? Zwei parallele Finanzierungen sind Alltag, fünf sind ein Muster — und Muster lesen die Modelle. Lieber einen Vertrag abschließen (fertig zahlen) und dann den nächsten." },
  { tag: "Tipp 5", titel: "Bei Engpass: reden statt reißen lassen", text: "Ein Anruf VOR der geplatzten Rate ist Verhandlung, einer danach ist Schadensbegrenzung. Gläubiger stunden und strecken erstaunlich oft — eine angepasste Rate, die läuft, ist ihnen mehr wert als eine hohe, die platzt. Immer schriftlich bestätigen lassen." },
  { tag: "Tipp 6", titel: "Erledigtes dokumentieren", text: "Jede abbezahlte Finanzierung ist ein Beleg. Schlusszahlung, Datum, Bestätigung aufheben — und nach drei Jahren prüfen, ob der erledigte Eintrag wirklich gelöscht wurde. Verfristete Reste sind häufiger, als man denkt." },
];

export default function RatenzahlungUndBonitaet() {
  return (
    <Dunkel seite="ratgeber" titel="Ratenzahlung und Bonität: Ihr stärkster Hebel" beschreibung="Wie Raten auf SCHUFA und Bonität wirken: die 12-Raten-Logik, die Eskalationsstufen bei Rückstand und sechs Praxis-Tipps. Jetzt Bonität aufbauen.">
      <SeoDaten
        pfad="/ratenzahlung-und-bonitaet"
        titel="Ratenzahlung und Bonität: der stärkste Hebel | FIAON"
        beschreibung="Wie Raten auf SCHUFA und Bonität wirken: die 12-Raten-Logik, die Eskalationsstufen bei Rückstand und sechs Praxis-Tipps. Jetzt Bonität aufbauen."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "Ratenzahlung und Bonität: Pünktliche Raten sind Ihr stärkster Hebel", stand: "2026-08-30" }}
        krumen={[{ name: "Ratenzahlung und Bonität", pfad: "/ratenzahlung-und-bonitaet" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Der Hebel in Ihrer Hand</span>
          <h1 className="dk-h1">Ratenzahlung und Bonität: <span className="dk-verlauf">Pünktlich zahlt sich aus.</span></h1>
          <p className="dk-lead">
            Kein Merkmal bewegt Ihre Bonität so verlässlich wie Ihr Zahlungsverhalten — in beide
            Richtungen. Hier steht, wie zwölf pünktliche Raten wirken, in welchen Stufen ein
            Rückstand eskaliert und wie Sie beides im Griff behalten.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Die 12er-Ratenleiste — die Bildsprache unserer Mails. */}
        <Block schmal titel="Pünktliche Raten sind Ihr stärkster Hebel" lead="Zwölf Raten, zwölf Beweise. Jede pünktliche Zahlung ist ein Positivdatum — zusammen ergeben sie eine Historie, die Modelle belohnen.">
          <Auf>
            <div className="sx-raten" role="img" aria-label="Zwölf Monatsraten, die sich nacheinander grün füllen — Sinnbild für ein Jahr pünktlicher Zahlungen">
              {Array.from({ length: 12 }).map((_, i) => (
                <div className="sx-rate" key={i}>
                  <span className="balken" style={{ ["--v" as any]: `${0.15 + i * 0.12}s` }} />
                  <small>{i + 1}</small>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.65, color: "#475569", maxWidth: "68ch" }}>
              So arbeitet auch das FIAON-Modell: Die Pakete laufen über zwölf Monatsraten. Jede
              bezahlte Rate füllt ein Feld — und baut nebenbei genau die Zahlungs-Historie auf, um
              die es auf dieser Seite geht. Wer das Jahr durchzahlt, hat mehr als ein erledigtes
              Paket: eine dokumentierte, saubere Zahlungsreihe.
            </p>
          </Auf>
        </Block>

        {/* Die Eskalationstreppe. */}
        <Block schmal titel="Was bei Rückständen passiert" lead="Die Eskalation ist kein Schicksal — sie ist eine Treppe mit vier Stufen, und auf jeder kann man sie anhalten.">
          <Auf>
            <div className="sx-treppe">
              <div className="sx-stufe s1">
                <span>Stufe 1 · Tag 1 bis 14</span>
                <b>Erinnerung</b>
                <p>Die Rate ist geplatzt, der Anbieter erinnert freundlich. Kosten: meist keine oder gering. Wer JETZT zahlt oder anruft, beendet die Sache geräuschlos — nichts davon erreicht eine Auskunftei.</p>
              </div>
              <div className="sx-stufe s2">
                <span>Stufe 2 · ab etwa Woche 2</span>
                <b>Mahnung mit Verzugskosten</b>
                <p>Jetzt läuft Verzug: Mahngebühren, Verzugszinsen. Spätestens hier gilt: reagieren, nicht aussitzen. Eine schriftliche Ratenvereinbarung stoppt die Treppe zuverlässig — solange sie eingehalten wird.</p>
              </div>
              <div className="sx-stufe s3">
                <span>Stufe 3 · nach 2. Mahnung + 4 Wochen</span>
                <b>Meldedrohung — die letzte Ausfahrt</b>
                <p>§ 31 BDSG verlangt vor einer SCHUFA-Meldung zwei Mahnungen mit mindestens vier Wochen Abstand und einen klaren Hinweis auf die bevorstehende Meldung. Dieser Hinweis ist die letzte Ausfahrt: Zahlung oder begründeter Widerspruch verhindern den Eintrag.</p>
              </div>
              <div className="sx-stufe s4">
                <span>Stufe 4 · danach</span>
                <b>Eintrag, Inkasso, Titel</b>
                <p>Die Forderung wird gemeldet und wandert ins Inkasso; am Ende drohen Mahnbescheid und Titel (30 Jahre vollstreckbar). Selbst hier gilt: Ausgleich binnen 100 Tagen nach Meldung verkürzt die Speicherfrist auf 18 Monate — und unzulässige Meldungen bleiben angreifbar.</p>
              </div>
            </div>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            Der Brief ist schon da? Der ruhige Plan steht unter{" "}
            <a href="/inkasso-brief-erhalten" style={{ color: "#1d4ed8" }}>Inkasso-Brief erhalten</a> —
            und die Fristen unter <a href="/eintrag-verjaehrung" style={{ color: "#1d4ed8" }}>Eintrag und Verjährung</a>.
          </p>
        </Block>

        {/* Sechs Praxis-Tipps. */}
        <Block titel="Sechs Tipps aus der Praxis" lead="Unspektakulär, aber wirksam — Rückstände entstehen meist aus Organisation, nicht aus Geldmangel.">
          <Karten items={TIPPS.map((t) => ({ tag: t.tag, titel: t.titel, text: t.text }))} />
        </Block>

        {/* Zahlungskalender-Teaser. */}
        <Block schmal mitte titel="Der FIAON-Zahlungskalender" lead="Für Kunden eingebaut: keine Rate ohne Erinnerung.">
          <Auf>
            <Glas ruhig>
              <p className="dk-text" style={{ fontSize: 15, lineHeight: 1.7 }}>
                Jeder FIAON-Kunde sieht in seinem Bereich den Zahlungskalender: alle zwölf Raten mit
                Datum und Stand, jede kommende Rate mit Erinnerung per E-Mail — und wer eine Rate
                bezahlt hat, sieht das Feld sich füllen, wie oben in der Leiste. So bleibt keine
                Zahlung dem Zufall überlassen, und die Zahlungsreihe bleibt sauber.
              </p>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 18 }}>
                <Knopf href="/preise">Pakete und Raten ansehen</Knopf>
                <Knopf href="/werkzeuge/spielraum" still>Monatlichen Spielraum berechnen</Knopf>
              </div>
            </Glas>
          </Auf>
        </Block>

        <Block schmal titel="Häufige Fragen zu Raten und Bonität">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Vertiefen: <a href="/schufa-score-verstehen" style={{ color: "#1d4ed8" }}>SCHUFA-Score verstehen</a> ·{" "}
            <a href="/bonitaet-verbessern" style={{ color: "#1d4ed8" }}>Bonität Schritt für Schritt</a> ·{" "}
            <a href="/glossar-bonitaet" style={{ color: "#1d4ed8" }}>Begriffe im Glossar</a>.
            Stand August 2026 — keine Rechtsberatung im Einzelfall.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Zwölf Raten. Ein Plan. Kein Zufall."
        satz="FIAON hält Ihre Zahlungen im Kalender, erinnert vor jeder Rate und prüft parallel Ihre Auskünfte bei SCHUFA, KSV und CRIF — damit die Historie wächst, statt zu reißen."
      />
    </Dunkel>
  );
}
