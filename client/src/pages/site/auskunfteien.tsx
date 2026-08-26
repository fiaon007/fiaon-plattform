// ═══════════════════════════════════════════════════════════════════════════
// /auskunfteien — SCHUFA, KSV1870, CRIF im Vergleich (26.08.2026)
//
// Die DACH-Seite, die niemand hat: Wer in Österreich oder der Schweiz lebt
// (oder dorthin zieht), findet zu „KSV Eintrag" und „CRIF Auskunft" fast
// nichts Brauchbares. FIAON arbeitet in allen drei Ländern — diese Seite
// ist der Beweis und der Verteiler auf /oesterreich und /schweiz.
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const FRAGEN = [
  { f: "Welche Auskunftei ist für mich zuständig?", a: "Die des Landes, in dem Sie Verträge schließen: in Deutschland vor allem SCHUFA (daneben Creditreform Boniversum und CRIF), in Österreich KSV1870 und CRIF Österreich, in der Schweiz CRIF und Intrum. Wer umzieht oder grenzüberschreitend arbeitet, hat oft in zwei Ländern Daten — und sollte beide prüfen." },
  { f: "Bekomme ich überall eine kostenlose Auskunft?", a: "Ja. In Deutschland und Österreich über Art. 15 DSGVO, in der Schweiz über Art. 25 des revidierten Datenschutzgesetzes. Die Auskunfteien verkaufen daneben Bezahlprodukte — für die Prüfung der eigenen Daten reicht die kostenlose Datenkopie immer." },
  { f: "Werden Daten zwischen den Ländern ausgetauscht?", a: "Nicht automatisch: SCHUFA-Einträge sieht eine Schweizer Bank nicht, ein KSV-Eintrag bleibt in Österreich. Aber internationale Konzerne wie CRIF sind in mehreren Ländern aktiv, und bei grenzüberschreitenden Verträgen (etwa Auto-Leasing) fragen Anbieter mitunter im Nachbarland an. Verlassen sollte man sich auf die Trennung nicht." },
  { f: "Gelten die Löschfristen überall gleich?", a: "Nein — das ist der wichtigste Unterschied: Deutschland löscht erledigte Forderungen nach drei Jahren (18 Monate mit 100-Tage-Regel), Österreich kennt für den „KSV-Eintrag“ nach vollständiger Zahlung eine Löschung nach drei Jahren in der Warnliste, die Schweiz speichert Betreibungen fünf Jahre im Betreibungsregister. Wer Fristen aus einem Land aufs andere überträgt, rechnet falsch." },
  { f: "Hilft FIAON in allen drei Ländern?", a: "Ja — das ist der Kern des Angebots: Beschaffung, Prüfung und Durchsetzung bei SCHUFA, KSV1870 und CRIF aus einer Hand, mit den jeweiligen Landesregeln. Die Länderseiten für Österreich und die Schweiz erklären die Besonderheiten." },
];

export default function Auskunfteien() {
  return (
    <Dunkel seite="ratgeber" titel="SCHUFA, KSV1870, CRIF · Auskunfteien im Vergleich" beschreibung="Die Auskunfteien in Deutschland, Österreich und der Schweiz im Vergleich: Wer speichert was, welche Rechte gelten, welche Löschfristen laufen – SCHUFA, KSV1870, CRIF und das Schweizer Betreibungsregister, verständlich erklärt.">
      <SeoDaten
        pfad="/auskunfteien"
        titel="SCHUFA, KSV1870, CRIF · Auskunfteien im Vergleich"
        beschreibung="Wer speichert was in Deutschland, Österreich und der Schweiz – Rechte, Löschfristen und Unterschiede, verständlich erklärt."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "Auskunfteien in DACH: SCHUFA, KSV1870 und CRIF im Vergleich", stand: "2026-08-26" }}
        krumen={[{ name: "Auskunfteien im Vergleich", pfad: "/auskunfteien" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/karte.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Deutschland · Österreich · Schweiz</span>
          <h1 className="dk-h1">Drei Länder, drei Regelwerke — <span className="dk-verlauf">ein Überblick.</span></h1>
          <p className="dk-lead">SCHUFA, KSV1870, CRIF: Wer was speichert, welche Rechte gelten und welche Fristen laufen. Wer die Unterschiede kennt, verschenkt keine Ansprüche.</p>
        </div>
      </section>
      <Licht>
        <Block titel="Die drei Systeme" lead="Gleicher Zweck, verschiedene Regeln — die Unterschiede stecken in Fristen und Rechtsgrundlagen.">
          <Karten items={[
            { tag: "Deutschland", titel: "SCHUFA und die DSGVO", text: "Rund 68 Millionen erfasste Personen, Datengrundlage sind Vertrags- und Zahlungsdaten der Vertragspartner. Rechte: kostenlose Datenkopie (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17). Meldevoraussetzungen für offene Forderungen regelt § 31 BDSG. Erledigte Einträge: drei Jahre, mit 100-Tage-Regel 18 Monate." },
            { tag: "Österreich", titel: "KSV1870 und die Warnliste", text: "Der Kreditschutzverband führt neben Bonitätsdaten die „Warnliste“ der Banken. Die DSGVO gilt unmittelbar — Auskunft, Berichtigung und Löschung wie in Deutschland, aber eigene Löschpraxis: Nach vollständiger Zahlung bleibt ein Warnlisten-Eintrag üblicherweise drei Jahre. Daneben ist CRIF Österreich vor allem im Handel die maßgebliche Auskunftei." },
            { tag: "Schweiz", titel: "CRIF, Intrum — und das Betreibungsregister", text: "Die Besonderheit liegt beim Staat: Das Betreibungsregister der Betreibungsämter wiegt schwerer als jede private Auskunftei — Vermieter und Arbeitgeber verlangen den Auszug. Betreibungen bleiben fünf Jahre sichtbar; bezahlte lassen sich unter Voraussetzungen für Dritte sperren (Art. 8a SchKG). Privatrechte regelt das revidierte DSG (Art. 25: Auskunft)." },
          ]} />
        </Block>

        <Block schmal titel="Der direkte Vergleich" lead="Die Zahlen, die man ständig braucht — nebeneinander.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">&nbsp;</th><th scope="col">Deutschland</th><th scope="col">Österreich</th><th scope="col">Schweiz</th></tr></thead>
              <tbody>
                <tr><td>Wichtigste Stelle</td><td>SCHUFA</td><td>KSV1870, CRIF</td><td>Betreibungsregister, CRIF</td></tr>
                <tr><td>Kostenlose Auskunft</td><td>Art. 15 DSGVO</td><td>Art. 15 DSGVO</td><td>Art. 25 DSG</td></tr>
                <tr><td>Erledigte Forderung sichtbar</td><td>3 Jahre (18 Monate mit 100-Tage-Regel)</td><td>i. d. R. 3 Jahre (Warnliste)</td><td>5 Jahre (Betreibung)</td></tr>
                <tr><td>Nach Privatinsolvenz</td><td>6 Monate</td><td>Löschung nach Abschöpfungsverfahren</td><td>Verlustscheine bis 20 Jahre</td></tr>
                <tr><td>Aufsicht</td><td>Datenschutzbehörden der Länder</td><td>Datenschutzbehörde (DSB)</td><td>EDÖB, Betreibungsämter</td></tr>
              </tbody>
            </table>
          </div>
        </Block>

        <Zwischenruf text={<><b>In welchem Land stehen Ihre Daten?</b> Der Datenkopie-Generator erzeugt das passende Schreiben für jede der drei Stellen — kostenlos.</>} knopf="Datenkopie anfordern" href="/werkzeuge/selbstauskunft" />

        <Block titel="Für Österreich und die Schweiz im Detail" lead="Die Länderseiten erklären Besonderheiten, Wege und Fristen vor Ort.">
          <div className="dk-knoepfe">
            <Knopf href="/oesterreich">FIAON in Österreich</Knopf>
            <Knopf href="/schweiz">FIAON in der Schweiz</Knopf>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Redaktionelle Einordnung, Stand August 2026. Fristen und Praxis der Auskunfteien können sich ändern;
            maßgeblich sind die jeweils aktuellen Verhaltensregeln und Gesetze. Keine Rechtsberatung im Einzelfall.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Drei Länder, ein Ansprechpartner.</b> FIAON beschafft und prüft Ihre Daten bei SCHUFA, KSV1870 und CRIF — mit den Regeln des jeweiligen Landes.</>} knopf="Prüfung starten" href="/antrag" />
    </Dunkel>
  );
}
