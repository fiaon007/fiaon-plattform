import { SiteShell, Auf, Abschnitt, Anfrage } from "@/components/site/SiteShell";

export default function Partner() {
  return (
    <SiteShell seite="partner" titel="Partner" beschreibung="Banken, Auskunfteien, Inkasso und Vermittler: Kunden, deren Bonität repariert ist, sind die besten Kunden.">
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}><div className="ws-rahmen">
        <Auf><p className="ws-ueber">Geschäftspartner</p><h1 className="ws-h1">Kunden, deren Bonität repariert ist, sind die <span className="ws-verlauf">besten Kunden.</span></h1>
        <p className="ws-lead">FIAON begleitet Menschen von der Einsicht über die Reparatur bis zum Produkt. Wer am Ende dieses Wegs steht, ist dokumentiert, erreichbar und bereit. Das ist Ihr Vorteil.</p></Auf>
      </div></section>

      <Abschnitt ueber="Für wen" titel="Vier Partnerschaften.">
        <div className="ws-raster">
          {[["Banken & Kartenherausgeber", "Reparierte, dokumentierte Bonität, Kontoanbindung mit Einwilligung, ein Startgespräch vor jeder Freischaltung. Girokonto-Referral heute, Karten und Finanzierungen als Ziel."], ["Auskunfteien", "API-Partnerschaft für DE/AT/CH (SCHUFA, KSV1870, CRIF). Wir übersetzen Ihre Daten in Handlung — und reduzieren unberechtigte Anfragen."], ["Inkasso", "Ratenvereinbarungen mit Antwort-Tracking statt Briefen ins Leere: Der Kunde antwortet über die Plattform, Fristen laufen automatisch."], ["Vermittler & Affiliates", "Provision je Abschluss und je eingezogener Rate. Link, Tracking, Auszahlung — nachvollziehbar im Portal."]].map(([t, b], i) => (
            <Auf key={t} verzoegerung={i * 90}><div className="ws-karte hoch"><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)" }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Kontakt" titel="Partner werden." lead="Sagen Sie uns, was Sie anbieten und was Sie brauchen — wir antworten mit einem Vorschlag, nicht mit einem Formular.">
        <div className="ws-karte hoch"><Anfrage art="partner" knopf="Anfrage senden"
          felder={[{ name: "name", label: "Name", pflicht: true }, { name: "firma", label: "Unternehmen", pflicht: true }, { name: "email", label: "E-Mail", typ: "email", pflicht: true }, { name: "rolle", label: "Art der Partnerschaft", optionen: ["Bank / Kartenherausgeber", "Auskunftei", "Inkasso", "Vermittler / Affiliate", "Sonstiges"], pflicht: true }, { name: "text", label: "Worum geht es?", typ: "textarea", breit: true }]} /></div>
      </Abschnitt>
    </SiteShell>
  );
}
