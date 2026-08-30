// ═══════════════════════════════════════════════════════════════════════════
// /schufa-neutral-anfragen — der Pfeiler zur Anfrage-Suche (30.08.2026)
//
// Suchintention: „kreditanfrage schufa neutral“. Der ganze Unterschied liegt
// in zwei Wörtern auf dem Bankformular: „Anfrage Kredit“ gegen „Anfrage
// Kreditkonditionen". Die Gegenüberstellung mit Umschalter macht ihn
// fühlbar — zwei Glas-Karten, eine leuchtet. JSON-LD: Article + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Auf, Glas } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Was genau bedeutet „SCHUFA-neutral“?", a: "Neutral heißt: Die Anfrage wird als Konditionsanfrage gespeichert — nur für Sie sichtbar, ohne jede Wirkung auf Ihren Score. Banken, die später anfragen, sehen sie nicht. Die Kreditanfrage dagegen ist zehn Tage für andere Institute sichtbar und fließt in die Berechnung ein." },
  { f: "Bekomme ich mit einer Konditionsanfrage schlechtere Angebote?", a: "Nein. Die Bank prüft dieselben Daten und nennt Ihnen die Konditionen, die sie bei einem echten Antrag anbieten würde. Der Unterschied liegt allein in der Meldung an die SCHUFA — nicht in der Qualität des Angebots. Erst wenn Sie den Vertrag wirklich wollen, wird aus der Konditions- eine Kreditanfrage." },
  { f: "Wie erkenne ich, welche Anfrageart die Bank stellt?", a: "Fragen Sie wörtlich: „Stellen Sie eine Konditionsanfrage oder eine Kreditanfrage?“ Seriöse Institute und Vergleichsportale antworten klar und werben oft selbst mit „SCHUFA-neutral“. Im Zweifel steht es in den Unterlagen — das Merkmal heißt „Anfrage Kreditkonditionen“." },
  { f: "Was tue ich, wenn eine Konditionsanfrage falsch als Kreditanfrage gespeichert wurde?", a: "Das kommt vor und ist korrigierbar: Verlangen Sie bei der Bank die Umschlüsselung und bei der SCHUFA die Berichtigung (Art. 16 DSGVO), mit Ihrem Schriftverkehr als Beleg. In der eigenen Datenkopie sehen Sie, wie jede Anfrage gespeichert ist." },
  { f: "Wie stark drücken mehrere Kreditanfragen den Score?", a: "Eine exakte Zahl nennt die SCHUFA nicht — die Formel ist Geschäftsgeheimnis. Belegt ist der Mechanismus: Mehrere Kreditanfragen in kurzer Zeit lesen sich als gescheiterte Finanzierungsversuche. Deshalb gilt: vergleichen ausschließlich über Konditionsanfragen, die echte Kreditanfrage erst für den Vertrag, den Sie wirklich abschließen." },
  { f: "Gilt der Unterschied auch bei Girokonten und Handyverträgen?", a: "Dort läuft es anders: Konto- und Vertragsanfragen sind eigene Anfragearten mit eigener Behandlung. Der Konditions-Trick ist ein Kredit-Thema. Bei Konten zählt eher, wie viele Sie führen — dazu mehr auf der Score-Seite." },
];

export default function SchufaNeutralAnfragen() {
  const [seite, setSeite] = useState<"konditionen" | "kredit">("konditionen");

  return (
    <Dunkel seite="ratgeber" titel="SCHUFA-neutral anfragen: Konditions- statt Kreditanfrage" beschreibung="Kredit anfragen ohne Score-Wirkung: der Unterschied zwischen Konditions- und Kreditanfrage, die richtigen Sätze für die Bank. Jetzt richtig anfragen.">
      <SeoDaten
        pfad="/schufa-neutral-anfragen"
        titel="SCHUFA-neutral anfragen: so geht es richtig | FIAON"
        beschreibung="Kredit anfragen ohne Score-Wirkung: der Unterschied zwischen Konditions- und Kreditanfrage, die richtigen Sätze für die Bank. Jetzt richtig anfragen."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "SCHUFA-neutral anfragen: Konditionsanfrage statt Kreditanfrage", stand: "2026-08-30" }}
        krumen={[{ name: "SCHUFA-neutral anfragen", pfad: "/schufa-neutral-anfragen" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Zwei Wörter, großer Unterschied</span>
          <h1 className="dk-h1">SCHUFA-neutral anfragen: <span className="dk-verlauf">Konditionen statt Kredit.</span></h1>
          <p className="dk-lead">
            Wer Kredite vergleicht, kann sich den Vergleich versalzen — mit der falschen Anfrageart.
            Der Unterschied zwischen Konditions- und Kreditanfrage kostet ein Wort im Gespräch mit
            der Bank und entscheidet, ob Ihr Score davon erfährt.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* Die Gegenüberstellung mit Umschalter. */}
        <Block schmal titel="Die Gegenüberstellung" lead="Beide Anfragen liefern dieselben Zahlen. Nur eine hinterlässt Spuren, die andere Banken sehen.">
          <div style={{ textAlign: "center" }}>
            <div className="sx-umschalter" role="tablist" aria-label="Anfrageart wählen">
              <button type="button" role="tab" aria-selected={seite === "konditionen"} className={seite === "konditionen" ? "an" : ""} onClick={() => setSeite("konditionen")}>Konditionsanfrage</button>
              <button type="button" role="tab" aria-selected={seite === "kredit"} className={seite === "kredit" ? "an" : ""} onClick={() => setSeite("kredit")}>Kreditanfrage</button>
            </div>
          </div>
          <div className="sx-vergleich">
            <Glas className={seite === "konditionen" ? "an" : "matt"} tag="Anfrage Kreditkonditionen" titel="Die neutrale Anfrage">
              <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 8, fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
                <li>wird gespeichert, ist aber <b>nur für Sie</b> sichtbar</li>
                <li><b>fließt nicht in den Score ein</b> — beliebig oft möglich</li>
                <li>liefert dieselben Zinsen und Raten wie ein echter Antrag</li>
                <li>das richtige Werkzeug zum <b>Vergleichen</b></li>
              </ul>
            </Glas>
            <Glas className={seite === "kredit" ? "an" : "matt"} tag="Anfrage Kredit" titel="Die echte Kreditanfrage">
              <ul style={{ margin: 0, padding: "0 0 0 18px", display: "grid", gap: 8, fontSize: 14, lineHeight: 1.6, color: "#334155" }}>
                <li><b>10 Tage</b> für andere Banken sichtbar, 12 Monate gespeichert</li>
                <li><b>fließt in die Score-Berechnung ein</b></li>
                <li>mehrere in kurzer Zeit lesen sich als Geldnot</li>
                <li>gehört erst an den Vertrag, den Sie <b>wirklich abschließen</b></li>
              </ul>
            </Glas>
          </div>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            Merkzettel: Vergleichen mit Konditionsanfragen — die eine echte Kreditanfrage erst ganz
            am Ende, beim Gewinner.
          </p>
        </Block>

        {/* So fragen Sie richtig an. */}
        <Block schmal titel="So fragen Sie richtig an" lead="Vier Schritte — und der wichtigste ist ein einziger Satz.">
          <div className="wz-fragen">
            <div className="wz-frage">
              <p className="wz-nr">Schritt 1</p>
              <h3>Vorbereiten: Datenlage kennen</h3>
              <p className="wz-hinweis">Vor jeder Anfrage lohnt der Blick in die eigene Datenkopie: Steht dort ein angreifbarer Eintrag, holen Sie sich mit dessen Bereinigung bessere Karten, BEVOR die Bank schaut. Die Checkliste zum Lesen finden Sie auf der Selbstauskunft-Seite.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 2</p>
              <h3>Den Satz sagen</h3>
              <p className="wz-hinweis">Wörtlich: „Bitte stellen Sie ausschließlich eine Konditionsanfrage — keine Kreditanfrage.“ Bei Online-Vergleichen auf die Kennzeichnung „SCHUFA-neutral“ achten. Seriöse Anbieter bestätigen das ohne Zögern.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 3</p>
              <h3>Vergleichen, in Ruhe</h3>
              <p className="wz-hinweis">Konditionsanfragen kosten nichts und hinterlassen keine sichtbaren Spuren — vergleichen Sie also gründlich: Effektivzins, Gesamtkosten, Sondertilgung. Zeitdruck ist bei neutralen Anfragen kein Argument mehr.</p>
            </div>
            <div className="wz-frage">
              <p className="wz-nr">Schritt 4</p>
              <h3>Abschließen — jetzt erst die echte Anfrage</h3>
              <p className="wz-hinweis">Beim Gewinner wird aus der Konditions- die Kreditanfrage: Sie ist Pflichtteil des Vertragsabschlusses und völlig normal. EINE Kreditanfrage mit anschließendem Vertrag ist ein gesunder Vorgang — zehn ohne Vertrag sind ein Muster.</p>
            </div>
          </div>
        </Block>

        {/* Wirkung auf den Score. */}
        <Block schmal titel="Die Wirkung auf den Score" lead="Warum die Modelle Anfragen überhaupt zählen — und was gespeichert bleibt.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">&nbsp;</th><th scope="col">Konditionsanfrage</th><th scope="col">Kreditanfrage</th></tr></thead>
              <tbody>
                <tr><td>Speicherdauer</td><td>12 Monate</td><td>12 Monate</td></tr>
                <tr><td>Sichtbar für andere Banken</td><td>nie</td><td>10 Tage</td></tr>
                <tr><td>Wirkung auf den Score</td><td>keine</td><td>fließt ein — mehrere verstärken sich</td></tr>
                <tr><td>Typischer Zweck</td><td>vergleichen</td><td>abschließen</td></tr>
              </tbody>
            </table>
          </div>
          <Auf>
            <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7, color: "#475569", maxWidth: "68ch" }}>
              Die Logik dahinter: Wer binnen zwei Wochen bei fünf Banken einen KREDIT beantragt,
              sieht für ein Risiko-Modell aus wie jemand, der viermal abgelehnt wurde. Dass in
              Wahrheit nur verglichen wurde, kann das Modell nicht wissen — es sieht nur die
              Anfrageart. Genau dafür wurde die Konditionsanfrage geschaffen: gleiche Auskunft
              für Sie, kein falsches Signal an die Modelle.
            </p>
          </Auf>
          <p className="dk-leise" style={{ marginTop: 16 }}>
            Wie der Score insgesamt rechnet, steht unter{" "}
            <a href="/schufa-score-verstehen" style={{ color: "#1d4ed8" }}>SCHUFA-Score verstehen</a> —
            und was bei laufenden Krediten zählt, unter{" "}
            <a href="/ratenzahlung-und-bonitaet" style={{ color: "#1d4ed8" }}>Ratenzahlung und Bonität</a>.
            Zum Durchrechnen: der kostenlose{" "}
            <a href="/werkzeuge/kreditrechner" style={{ color: "#1d4ed8" }}>Kreditrechner</a>.
          </p>
        </Block>

        <Block schmal titel="Häufige Fragen zur neutralen Anfrage">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Stand August 2026 — keine Rechtsberatung im Einzelfall. Ob Ihre bisherigen Anfragen
            richtig gespeichert sind, zeigt nur die eigene Datenkopie — FIAON beschafft und prüft
            sie mit der <a href="/bonitaetsauskunft-beantragen" style={{ color: "#1d4ed8" }}>Bonitätsauskunft</a>.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Erst wissen, was gespeichert ist. Dann anfragen."
        satz="FIAON beschafft Ihre Auskünfte, prüft jede Anfrage und jeden Eintrag auf Richtigkeit und bereinigt, was angreifbar ist — damit Ihre nächste Anfrage auf sauberer Grundlage läuft."
      />
    </Dunkel>
  );
}
