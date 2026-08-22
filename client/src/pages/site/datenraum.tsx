import { SiteShell, Auf, Abschnitt, Anfrage } from "@/components/site/SiteShell";

export default function Datenraum() {
  const kapitel = [
    ["01 · Unternehmen", "Gesellschaft, Gesellschafter, Organigramm, Verträge mit Gründern"],
    ["02 · Finanzen", "Kontoauszüge, Umsatz je Monat, ARR-Run-Rate, Forderungen, Auszahlungen, Provisionsregeln"],
    ["03 · Produkt & Technik", "Architektur, Datenmodell, Deploy, Sicherheitsmaßnahmen, Abhängigkeiten, technische Schulden"],
    ["04 · Recht & Datenschutz", "AGB, Datenschutz, Auftragsverarbeiter, juristische Freigaben der Schreiben, Beschwerden"],
    ["05 · Team & Verträge", "Handelsvertreterverträge, Vergütungsmodelle, Onboarding, Academy"],
    ["06 · Markt & Kunden", "Marktdaten DACH, Kundenzahlen, Funnel-Kennzahlen, Kündigungen, Zufriedenheit"],
    ["07 · Entscheidungen", "Das Entscheidungsregister (ADR-Stil): jede Regel mit Datum, Grund und Folge"],
  ];
  return (
    <SiteShell seite="datenraum" titel="Datenraum" beschreibung="Due Diligence bei FIAON: geführt, als würde morgen verkauft. Zugang unter NDA.">
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}><div className="ws-rahmen">
        <Auf><p className="ws-ueber">Due Diligence</p><h1 className="ws-h1">Geführt, als würde <span className="ws-verlauf">morgen verkauft.</span></h1>
        <p className="ws-lead">FIAON führt seit Gründung ein Entscheidungsregister, ein tägliches Logbuch und eine nachvollziehbare Kennzahlenspur. Wer prüfen will, findet keine Folien, sondern Belege.</p></Auf>
      </div></section>

      <Abschnitt ueber="Struktur" titel="Sieben Kapitel.">
        <div className="ws-raster">
          {kapitel.map(([t, b], i) => (
            <Auf key={t} verzoegerung={i * 70}><div className="ws-karte"><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)", fontSize: 14.5 }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Zugang" titel="Anfragen." lead="Der Zugang wird nach Unterzeichnung einer Vertraulichkeitsvereinbarung (NDA) persönlich freigeschaltet. Bitte nennen Sie Gesellschaft und Zweck.">
        <div className="ws-karte hoch"><Anfrage art="datenraum" knopf="Zugang anfragen" hinweis="NDA wird nach Ihrer Anfrage zugeschickt."
          felder={[{ name: "name", label: "Name", pflicht: true }, { name: "firma", label: "Gesellschaft", pflicht: true }, { name: "email", label: "E-Mail", typ: "email", pflicht: true }, { name: "rolle", label: "Rolle", optionen: ["Investor", "Käufer", "Bank / Partner", "Berater", "Sonstiges"], pflicht: true }, { name: "text", label: "Zweck der Prüfung", typ: "textarea", pflicht: true, breit: true }]} /></div>
      </Abschnitt>
    </SiteShell>
  );
}
