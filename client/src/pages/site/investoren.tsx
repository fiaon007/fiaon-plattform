import { SiteShell, Auf, Abschnitt, Anfrage } from "@/components/site/SiteShell";
import { Buehne, Ebene, Karte3D } from "@/components/site/Buehne3D";

export default function Investoren() {
  return (
    <SiteShell seite="investoren" titel="Investoren" beschreibung="FIAON besetzt die Aktions-Schicht der Bonität — der größte unbesetzte Platz im Finanzleben von 100 Millionen Menschen.">
      <section className="ws-abschnitt" style={{ paddingTop: 40 }}><div className="ws-rahmen">
        <Buehne hoehe={460}>{(p) => (
          <div style={{ display: "grid", gap: 40, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", alignItems: "center" }}>
            <Ebene tiefe={0.2} scroll={p}>
              <p className="ws-ueber">Für Investoren</p>
              <h1 className="ws-h1">Der größte unbesetzte Platz im Finanzleben von <span className="ws-verlauf">100 Millionen Menschen.</span></h1>
              <p className="ws-lead">Score-Apps zeigen an. Schuldnerberatung ist analog. Niemand repariert — und öffnet danach die Tür. FIAON tut beides.</p>
              <a className="ws-knopf" href="#datenraum" style={{ marginTop: 24 }}>Datenraum anfragen</a>
            </Ebene>
            <div style={{ display: "grid", placeItems: "center" }}><Ebene tiefe={0.7} scroll={p}><Karte3D ziel="100 M€ ARR" name="DAS ZIEL" /></Ebene></div>
          </div>
        )}</Buehne>
      </div></section>

      <Abschnitt ueber="Das Problem" titel="Millionen Menschen wissen nicht, was über sie gespeichert ist — und niemand hilft ihnen, es zu ändern.">
        <div className="ws-raster">
          {[["~6 Mio.", "überschuldete Personen in Deutschland — dazu eine viel größere Schicht mit „unklarer“ Bonität."], ["DACH", "Drei Länder, eine Sprache, drei Auskunfteien (SCHUFA, KSV1870, CRIF) — ein Adapter je Land."], ["0", "Anbieter, der die Aktions-Schicht konsequent besetzt: Anträge, Widersprüche, Ratenvereinbarungen mit Antwort-Tracking."]].map(([z, t], i) => (
            <Auf key={z} verzoegerung={i * 100}><div className="ws-karte"><div className="ws-kennzahl">{z}</div><p style={{ marginTop: 10, color: "var(--w-leise)" }}>{t}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Die Lösung" titel="Drei Schichten. Der Burggraben ist die mittlere." lead="Einsicht (Daten + Analyse) · Aktion (1-Klick-Schreiben, juristisch geprüft, Fristen) · Zugang (Partnerprodukte: Konto heute, Karte als Ziel, Finanzierung später).">
        <div className="ws-raster">
          {[["Abo", "Vier Pakete von 7,99 € bis 99,99 € im Monat, 12 Raten, danach aktive Verlängerung. Wiederkehrend, per Lastschrift einziehbar."], ["Auskunft", "74 € einmalig je Bonitätsauskunft — Transaktionsumsatz mit jedem Start."], ["Partner", "Banken zahlen für reparierte, dokumentierte Kunden: Girokonto-Referral heute, Karten und Finanzierungen als nächste Säule."]].map(([t, b], i) => (
            <Auf key={t} verzoegerung={i * 100}><div className="ws-karte hoch"><h3 className="ws-h3">{t}</h3><p style={{ marginTop: 10, color: "var(--w-leise)" }}>{b}</p></div></Auf>
          ))}
        </div>
      </Abschnitt>

      <Abschnitt ueber="Nordstern-Metriken" titel="Drei Zahlen, die die Story tragen." lead="Wir berichten nicht, was bequem ist, sondern was den Fortschritt misst.">
        <div className="ws-karte">
          {[["Time to First Insight", "Antrag → fertige Bonitätsanalyse", "< 24 h"], ["Repair Actions Sent", "verschickte 1-Klick-Schreiben je Monat", "im Aufbau"], ["Graduations", "Kunden, die vom Programm zur Karte oder Finanzierung aufgestiegen sind", "im Aufbau"]].map(([t, b, w]) => (
            <div className="ws-zeile" key={t}><span><b>{t}</b><br /><span className="ws-hinweis">{b}</span></span><span className="zahl" style={{ fontWeight: 700, color: "var(--w-tief)" }}>{w}</span></div>
          ))}
        </div>
        <p className="ws-hinweis" style={{ marginTop: 12 }}>Traktion (Kunden, ARR-Run-Rate, Conversion) teilen wir im Datenraum unter NDA — mit Quelle, nicht als Folie.</p>
      </Abschnitt>

      <Abschnitt ueber="Der Weg" titel="DE perfektionieren. Dann AT/CH. Dann Europa." lead="Jede Stufe verzehnfacht den Markt. Kein Schritt wird übersprungen.">
        <ul className="ws-liste">
          <li><b>Jetzt:</b> Funnel repariert (Antrag → Zahlung → Startgespräch), Kontoauszug-Analyse, Lastschrift, Erinnerungsketten — alles live.</li>
          <li><b>Als Nächstes:</b> Bonitätsdaten per API (CRIF für DE/AT/CH), Kontoanbindung (PSD2), 1-Klick-Schreiben.</li>
          <li><b>Dann:</b> Partnernetz (Banken, Kartenherausgeber), Marketing-Maschine in DE, Mitarbeiter aus Kunden.</li>
          <li><b>Danach:</b> EU-Rollout über lokale Auskunfteien (BKR, Banque de France, ASNEF, CRIF).</li>
        </ul>
      </Abschnitt>

      <Abschnitt id="datenraum" ueber="Kontakt" titel="Datenraum anfragen." lead="Entscheidungsregister, Logbuch, Kennzahlen, Verträge, Technik — geführt, als würde morgen verkauft. Zugang unter NDA.">
        <div className="ws-karte hoch">
          <Anfrage art="investor" knopf="Zugang anfragen" hinweis="Antwort innerhalb von zwei Werktagen."
            felder={[{ name: "name", label: "Name", pflicht: true }, { name: "firma", label: "Gesellschaft / Fonds", pflicht: true }, { name: "email", label: "E-Mail", typ: "email", pflicht: true }, { name: "telefon", label: "Telefon", typ: "tel" }, { name: "text", label: "Worum geht es Ihnen?", typ: "textarea", breit: true }]} />
        </div>
      </Abschnitt>
    </SiteShell>
  );
}
