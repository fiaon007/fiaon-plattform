// ═══════════════════════════════════════════════════════════════════════════
// /sicherheit — Datenschutz & Sicherheit (23.08.2026)
//
// Was mit den sensibelsten Daten passiert, die es über einen Menschen gibt:
// Hosting, Verschlüsselung, Vollmacht, Freigabe, Löschung, Zahlungen, Rechte.
// Werkzeug: Datenschutz-Check (was darf wer, in 6 Fragen). Ehrlich, konkret.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";
import { SUPPORT } from "@shared/fiaon-wissen";
import "@/styles/ratgeber.css";

const CHECK = [
  { f: "Darf eine Bank meine SCHUFA-Daten ohne mein Wissen abfragen?", a: "Nur mit Rechtsgrundlage – in der Regel Ihrer Einwilligung im Antrag (SCHUFA-Klausel) oder einem berechtigten Interesse bei Vertragsanbahnung. Jede Abfrage steht als Anfrage in Ihrer Datenkopie, mit Datum und Empfänger." },
  { f: "Darf mein Vermieter eine Bonitätsauskunft verlangen?", a: "Er darf sie erbitten, Sie müssen sie nicht geben – praktisch ist sie aber üblich. Geben Sie die Bonitätsauskunft für Vermieter (ohne Details), nie die vollständige Datenkopie." },
  { f: "Darf ein Inkassobüro meine Daten an die SCHUFA melden?", a: "Nur unter den Voraussetzungen des § 31 Abs. 2 BDSG: fällige, unbestrittene Forderung, zwei Mahnungen, Hinweis auf die Meldung. Fehlt eines davon, ist die Meldung unzulässig." },
  { f: "Darf FIAON meine Auskunft an Dritte weitergeben?", a: "Nein. FIAON gibt Daten nur weiter, wenn Sie es für einen konkreten Zweck freigeben – etwa die Unterlagen für einen Kartenantrag an den Kartenpartner. Nie zu Werbezwecken, nie verkauft." },
  { f: "Darf ich die Löschung meiner Daten bei FIAON verlangen?", a: "Jederzeit (Art. 17 DSGVO). Nach Vertragsende löschen wir Auskunft und Unterlagen; gesetzliche Aufbewahrungspflichten für Rechnungen bleiben (zehn Jahre, nur Buchhaltungsdaten)." },
  { f: "Darf eine Auskunftei Daten aus sozialen Netzwerken nutzen?", a: "Nach den Verhaltensregeln der Auskunfteien nicht; der Gesetzentwurf zum Scoring (2024) soll das ausdrücklich verbieten, ebenso Daten über Herkunft, Gesundheit oder Anschrift als Score-Merkmal." },
];

export default function Sicherheit() {
  const [offen, setOffen] = useState<number | null>(null);
  return (
    <Dunkel seite="was-ist-fiaon" titel="Datenschutz & Sicherheit · FIAON" beschreibung="Wie FIAON mit den sensibelsten Daten umgeht, die es über Sie gibt: EU-Hosting, Verschlüsselung, Vollmacht, Freigabe vor jedem Schreiben, Löschung auf Wunsch. Plus Datenschutz-Check: Wer darf was mit Ihren Bonitätsdaten?">
      <Hero pille="Datenschutz & Sicherheit" titel={<>Das sensibelste Dokument <span className="dk-verlauf">über Sie.</span></>}
            lead="Ihre Bonitätsauskunft sagt mehr über Sie als jedes Zeugnis. Deshalb ist Sicherheit bei FIAON keine Seite im Impressum, sondern der Bauplan: nichts ohne Ihre Vollmacht, nichts ohne Ihre Freigabe, nichts länger als nötig."
            knoepfe={<><Knopf href="#check">Datenschutz-Check</Knopf><Knopf href="#prinzipien" still>Die Prinzipien</Knopf></>}
            szene={<Szenenbild src="/kino/datenraum.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "EU", label: "Server in der Europäischen Union, DSGVO" }, { wert: "TLS 1.3", label: "Verschlüsselung bei Übertragung, AES bei Ablage" }, { wert: "0", label: "Datensätze verkauft oder zu Werbezwecken geteilt" }, { wert: "1", label: "Klick zur Löschung Ihrer Akte nach Vertragsende" }]} /></div>
      </section>

      <Block id="prinzipien" pille="Fünf Prinzipien" titel={<>So gehen wir <span className="dk-verlauf">mit Ihren Daten um.</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="1 · Vollmacht" titel="Nichts ohne Ihre Unterschrift">FIAON beschafft Auskünfte nur mit Ihrer digitalen Vollmacht – und nur bei den Stellen, die Sie freigeben. Keine Abfrage auf Verdacht.</Glas></Auf>
          <Auf verzoegerung={60}><Glas tag="2 · Freigabe" titel="Kein Schreiben ohne Sie">Jedes Schreiben sehen Sie vor dem Versand. Sie geben frei, FIAON versendet. Nichts verlässt das Haus, was Sie nicht gelesen haben.</Glas></Auf>
          <Auf verzoegerung={120}><Glas tag="3 · Zweckbindung" titel="Nur wofür es gedacht ist">Ihre Daten dienen Ihrer Akte. Nicht der Werbung, nicht Partnern, nicht Statistiken mit Ihrem Namen. Anonymisierte Erfahrungen fließen in bessere Schreiben – ohne Personenbezug.</Glas></Auf>
          <Auf verzoegerung={180}><Glas tag="4 · Zugriff" titel="Wer darf hineinsehen">Ihr Ansprechpartner und die Mitarbeiter an Ihrer Akte – jeder Zugriff protokolliert. Die Geschäftsführung sieht Akten nur auf Ihren Wunsch oder bei Beschwerden.</Glas></Auf>
          <Auf verzoegerung={240}><Glas tag="5 · Löschung" titel="Ihre Daten, Ihr Ende">Nach Vertragsende löschen wir Auskunft und Unterlagen auf Wunsch vollständig. Sie können jederzeit eine Kopie Ihrer Akte anfordern – als Datei, in 30 Tagen.</Glas></Auf>
          <Auf verzoegerung={300}><Glas tag="Zahlungen" titel="SEPA über einen verifizierten Kreditor">Keine Kartendaten bei FIAON. Lastschriften laufen über einen verifizierten SEPA-Kreditor; jede Rate steht im Zahlungskalender Ihres Bereichs.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block pille="Technik" titel={<>Unter der <span className="dk-verlauf">Haube.</span></>}>
          <Zeilen items={[
            ["Hosting", "Server in der EU, Betreiber mit DSGVO-Auftragsverarbeitungsvertrag. Keine Datenübermittlung in Drittländer für Kundendaten."],
            ["Übertragung", "Ausschließlich über HTTPS (TLS 1.3), HSTS erzwungen; Sitzungen mit signierten, ablaufenden Cookies."],
            ["Ablage", "Datenbank verschlüsselt; Unterlagen (Ausweis, Kontoauszug) getrennt vom Profil gespeichert; tägliche Sicherungen, verschlüsselt."],
            ["Zugang", "Kundenbereich mit Passwort und Anmelde-Codes; Mitarbeiterzugänge rollenbasiert, jede Aktion protokolliert; Admin-Bereich zusätzlich mit Code gesichert."],
            ["Künstliche Intelligenz", "Der FIAON-Assistent auf der Kontaktseite sieht keine Kundendaten. Die Analyse von Auskünften läuft auf europäischer Infrastruktur; Entscheidungen trifft ein Mensch."],
            ["Aufbewahrung", "Akte bis Vertragsende plus 90 Tage (Widerruf, Rückfragen), dann Löschung; Rechnungsdaten zehn Jahre nach Handels- und Steuerrecht."],
          ]} />
        </Block>

        <Block id="check" pille="Werkzeug · Datenschutz-Check" titel={<>Wer darf was <span className="dk-verlauf">mit Ihren Daten?</span></>} lead="Sechs Fragen, die uns Kunden immer wieder stellen. Klicken Sie auf eine – die Antwort nennt die Rechtsgrundlage." mitte>
          <div className="wz-fragen" style={{ maxWidth: 820, margin: "36px auto 0", textAlign: "left" }}>
            {CHECK.map((c, i) => (
              <button key={c.f} type="button" className={`wz-frage sc-frage${offen === i ? " offen" : ""}`} onClick={() => setOffen(offen === i ? null : i)} aria-expanded={offen === i}>
                <h3>{c.f}</h3>
                {offen === i && <p className="sc-antwort">{c.a}</p>}
              </button>
            ))}
          </div>
        </Block>

        <Block pille="Ihre Rechte bei FIAON" titel={<>Drei Wege, <span className="dk-verlauf">sofort.</span></>}>
          <Schritte items={[
            { titel: "Auskunft (Art. 15)", text: `Kopie Ihrer Akte als Datei: im Kundenbereich unter „Mein Konto“ oder per E-Mail an ${SUPPORT.email}. Antwort innerhalb von 30 Tagen, meist in Tagen.` },
            { titel: "Berichtigung (Art. 16)", text: "Falsche Angaben in Ihrem Profil ändern Sie selbst; Angaben in der Akte korrigiert Ihr Ansprechpartner auf Zuruf." },
            { titel: "Löschung (Art. 17)", text: "Nach Vertragsende mit einem Klick unter „Abo & Zahlungen“ oder per E-Mail. Bestätigung innerhalb von 30 Tagen." },
          ]} />
        </Block>
      </Licht>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Sieht FIAON mein Online-Banking?", a: "Nein. Sie laden einen Kontoauszug als Foto oder PDF hoch. Die Kontoanbindung (Open Banking) kommt als Option – ausdrücklich von Ihnen freigeschaltet, jederzeit widerrufbar." },
            { f: "Wer ist für den Datenschutz verantwortlich?", a: `${SUPPORT.firma}, ${SUPPORT.adresse}. Datenschutzanfragen an ${SUPPORT.email}. Zuständige Aufsicht für Kunden in Deutschland: die Landesdatenschutzbehörde Ihres Wohnsitzes.` },
            { f: "Werden meine Daten für KI-Training verwendet?", a: "Nein. Personenbezogene Daten werden nicht zum Training von Modellen genutzt. Anonymisierte Erfahrungen (welche Schreiben wirken) verbessern Vorlagen – ohne Namen, ohne Referenzen." },
            { f: "Was passiert bei einer Datenpanne?", a: "Meldung an die Aufsichtsbehörde innerhalb von 72 Stunden und Information der Betroffenen, wenn ein Risiko besteht (Art. 33, 34 DSGVO). Dafür gibt es einen Plan, keine Improvisation." },
            { f: "Kann ich FIAON nutzen, ohne Unterlagen hochzuladen?", a: "Die Auskunft lässt sich mit Vollmacht beschaffen; für die Finanzauswertung braucht es den Kontoauszug, für Konto und Karte den Ausweis. Was Sie nicht hochladen, bleibt außen vor – und wir sagen, was dann nicht geht." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Fragen zum Datenschutz?</b> Der Assistent kennt die Regeln; für Ihre Akte antwortet ein Mensch.</>} knopf="Kontakt & Support" href="/kontakt" still={{ knopf: "Datenschutzerklärung", href: "/datenschutz" }} />
      <Abschluss titel={<>Sicherheit ist <span className="dk-verlauf">kein Feature.</span></>} text="Sie ist die Bedingung dafür, dass Sie uns das sensibelste Dokument über sich anvertrauen. Wir wissen das." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/plattform-konzept" still>Die Plattform</Knopf></>} />
    </Dunkel>
  );
}
