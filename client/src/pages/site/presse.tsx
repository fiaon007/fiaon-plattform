import { SiteShell, Auf, Abschnitt, Anfrage } from "@/components/site/SiteShell";

export default function Presse() {
  return (
    <SiteShell seite="presse" titel="Presse" beschreibung="Fakten, Bildmaterial und Ansprechpartner für Journalistinnen und Journalisten.">
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}><div className="ws-rahmen">
        <Auf><p className="ws-ueber">Presse</p><h1 className="ws-h1">FIAON in den Medien.</h1>
        <p className="ws-lead">FIAON ist das Betriebssystem für Bonität: Wir zeigen Menschen, was die Auskunfteien über sie wissen, reparieren es mit ihnen — und öffnen ihnen dann die Tür zu echten Finanzprodukten. Gegründet in London, aktiv in Deutschland, Österreich und der Schweiz.</p></Auf>
      </div></section>

      <Abschnitt ueber="Fakten" titel="Auf einen Blick.">
        <div className="ws-karte">
          {[["Unternehmen", "FIAON LTD, 128 City Road, London EC1V 2NX · Companies House 17318250"], ["Gründer", "Justin Schwarzott"], ["Produkt", "Bonitäts-Plattform: Einsicht · Aktion · Zugang — Abo ab 7,99 €/Monat, Bonitätsauskunft 74 € einmalig"], ["Märkte", "Deutschland, Österreich, Schweiz (SCHUFA · KSV1870 · CRIF)"], ["Kundenkontakt", "Persönliches Startgespräch vor jeder Freischaltung; Support in Sie-Form, Telefon und Plattform"], ["Kennzahlen", "auf Anfrage — wir nennen Quellen, keine Schätzungen"]].map(([k, v]) => (
            <div className="ws-zeile" key={k}><span style={{ color: "var(--w-stumm)", minWidth: 130 }}>{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Meldungen" titel="Aktuell.">
        <div className="ws-raster">
          {[["22.08.2026", "Kontoauszug-Analyse gestartet", "FIAON wertet Kontoauszüge automatisch aus: Einnahmen, Fixkosten, Dispo, Rücklastschriften — in Minuten, in Menschensprache, mit Merksätzen."], ["22.08.2026", "Startgespräch vor jeder Freischaltung", "Kein Konto ohne Gespräch: Jeder Kunde spricht vor der Aktivierung mit einem Menschen, der seinen Fahrplan erklärt."], ["22.08.2026", "Erinnerung genau an der Stelle", "Wer den Antrag unterbricht, wird per E-Mail genau dort wieder abgeholt — keine zweite Dateneingabe."]].map(([d, t, b], i) => (
            <Auf key={t} verzoegerung={i * 100}><div className="ws-karte"><p className="ws-ueber">{d}</p><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)" }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Bildmaterial" titel="Wortmarke und Plattform." lead="Die Wortmarke FIAON in Blau (#1D4ED8) oder Weiß auf Blau — bitte nicht verzerren, nicht einfärben. Plattformansichten auf Anfrage in hoher Auflösung.">
        <div className="ws-raster">
          <div className="ws-karte" style={{ display: "grid", placeItems: "center", minHeight: 160 }}><span style={{ font: "800 44px/1 'Inter', sans-serif", letterSpacing: "-.05em", color: "var(--w-tief)" }}>FIAON</span></div>
          <div className="ws-karte" style={{ display: "grid", placeItems: "center", minHeight: 160, background: "linear-gradient(135deg,#2563EB,#1D4ED8)", border: 0 }}><span style={{ font: "800 44px/1 'Inter', sans-serif", letterSpacing: "-.05em", color: "#fff" }}>FIAON</span></div>
        </div>
      </Abschnitt>

      <Abschnitt ueber="Kontakt" titel="Presseanfrage." lead="Wir antworten innerhalb eines Werktags — mit Menschen, die Auskunft geben dürfen.">
        <div className="ws-karte hoch"><Anfrage art="presse" knopf="Anfrage senden"
          felder={[{ name: "name", label: "Name", pflicht: true }, { name: "firma", label: "Medium / Redaktion", pflicht: true }, { name: "email", label: "E-Mail", typ: "email", pflicht: true }, { name: "telefon", label: "Telefon", typ: "tel" }, { name: "text", label: "Ihre Frage, Ihr Thema, Ihre Deadline", typ: "textarea", pflicht: true, breit: true }]} /></div>
      </Abschnitt>
    </SiteShell>
  );
}
