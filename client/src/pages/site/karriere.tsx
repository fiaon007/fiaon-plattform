// Karriere — „Werde Teil des FIAON Teams" (E-026: Kunden werden Mitarbeiter)
import { useEffect, useState } from "react";
import { SiteShell, Auf, Abschnitt, Anfrage } from "@/components/site/SiteShell";

export default function Karriere() {
  const [vor, setVor] = useState<Record<string, string> | undefined>(undefined);
  useEffect(() => {
    // Aus dem Kundenbereich kommt der Kunde mit ?ref= — dann ist alles vorbelegt.
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref) { setVor({}); return; }
    fetch(`/api/fiaon/kunde/${encodeURIComponent(ref)}/bereich`, { credentials: "include" }).then((r) => r.json()).then((j) => {
      const k = j?.kunde; if (!k) { setVor({}); return; }
      setVor({ name: [k.vorname, k.nachname].filter(Boolean).join(" "), email: k.email || "", telefon: k.telefon || "", kunde: "Ja, ich bin FIAON-Kunde", land: k.land === "AT" ? "Österreich" : k.land === "CH" ? "Schweiz" : "Deutschland" });
    }).catch(() => setVor({}));
  }, []);
  return (
    <SiteShell seite="karriere" titel="Werden Sie Teil des FIAON Teams" beschreibung="Arbeiten Sie von zuhause — für das, was Ihnen selbst geholfen hat. Start auf Provision, Fixum bei Bewährung.">
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}><div className="ws-rahmen">
        <Auf><p className="ws-ueber">Karriere</p><h1 className="ws-h1">Arbeiten Sie von zuhause — für das, was Ihnen <span className="ws-verlauf">selbst geholfen hat.</span></h1>
        <p className="ws-lead">Die besten FIAON-Mitarbeiter waren FIAON-Kunden. Sie wissen, wie sich ein Eintrag anfühlt, den niemand erklärt — und wie es ist, wenn sich etwas bewegt. Genau das brauchen unsere Kunden am Telefon.</p>
        <a className="ws-knopf" href="#bewerben" style={{ marginTop: 24 }}>In 60 Sekunden bewerben</a></Auf>
      </div></section>

      <Abschnitt ueber="So arbeiten Sie" titel="Homeoffice, Telefon, Plattform.">
        <div className="ws-raster">
          {[["Zuerst lernen", "Die FIAON-Academy ist Pflicht, bevor Sie den ersten Kunden sprechen: Produkt, Gesprächsführung, Recht. Online, in Ihrem Tempo."], ["Dann sprechen", "Sie rufen Menschen an, die einen Antrag gestellt haben, und begleiten sie zur Aktivierung. Alles läuft im Portal: Kundenliste, Telefon, Ergebnisse, Verdienst."], ["Dann wachsen", "Vertrieb, Onboarding oder Forderungsmanagement — drei Wege, eine Plattform. Wer gut ist, bekommt mehr Verantwortung."]].map(([t, b], i) => (
            <Auf key={t} verzoegerung={i * 100}><div className="ws-karte hoch"><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)" }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Vergütung" titel="Ehrlich: Provision zuerst." lead="Jeder startet auf Provision — je Abschluss und je eingezogener Rate, transparent im Portal. Wer sich bewährt, bekommt ein Fixum angeboten.">
        <ul className="ws-liste">
          <li>Selbständige Tätigkeit als Handelsvertreter; der Vertrag wird digital unterschrieben.</li>
          <li>Kein Anspruch auf Abschlüsse — aber eine Liste, ein Telefon und ein Team, das hilft.</li>
          <li>Provision nie auf das eigene Abo. Wer Kunde bleibt, zahlt sein Abo wie jeder andere.</li>
          <li>Auszahlung auf Anforderung, mit Abrechnung als PDF.</li>
        </ul>
      </Abschnitt>

      <Abschnitt id="bewerben" ueber="Bewerbung" titel="In 60 Sekunden." lead="Kein Lebenslauf nötig. Wir rufen Sie an — das ist auch schon das erste Gespräch.">
        <div className="ws-karte hoch">{vor !== undefined && <Anfrage art="karriere" knopf="Bewerbung senden" hinweis="Wir melden uns innerhalb von zwei Werktagen." vorbelegt={vor}
          felder={[{ name: "name", label: "Name", pflicht: true }, { name: "email", label: "E-Mail", typ: "email", pflicht: true }, { name: "telefon", label: "Telefon", typ: "tel", pflicht: true }, { name: "land", label: "Land", optionen: ["Deutschland", "Österreich", "Schweiz"], pflicht: true }, { name: "kunde", label: "Sind Sie FIAON-Kunde?", optionen: ["Ja, ich bin FIAON-Kunde", "Nein, noch nicht"], pflicht: true }, { name: "erfahrung", label: "Erfahrung", optionen: ["Keine — ich lerne schnell", "Kundenkontakt / Service", "Vertrieb am Telefon", "Finanzbranche"], pflicht: true }, { name: "text", label: "Warum FIAON?", typ: "textarea", breit: true }]} />}</div>
      </Abschnitt>
    </SiteShell>
  );
}
