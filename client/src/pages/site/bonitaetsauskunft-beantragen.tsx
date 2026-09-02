// ═══════════════════════════════════════════════════════════════════════════
// /bonitaetsauskunft-beantragen — der Pfeiler zum Beschaffungs-Suchwort
// (30.08.2026)
//
// Suchintention: „bonitätsauskunft beantragen / kostenlos“. Die Seite ist
// ehrlich: Der kostenlose Weg (Datenkopie nach Art. 15 DSGVO) steht ganz
// vorne — und daneben der FIAON-Weg für alle, die Beschaffung, Erklärung
// und Prüfung abgeben wollen (74 €, einmalig). Ehrlichkeit ist hier keine
// Tugend, sondern die Verkaufsstrategie: Wer den Gratisweg verschweigt,
// wirkt wie die Anbieter, vor denen wir warnen.
// JSON-LD: Service + FAQPage.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Fragen, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import KartenAufruf from "@/components/site/KartenAufruf";
import "@/styles/ratgeber.css";
import "@/styles/seo-seiten.css";

const FRAGEN = [
  { f: "Ist eine Bonitätsauskunft wirklich kostenlos möglich?", a: "Ja. Die Datenkopie nach Art. 15 DSGVO ist gesetzlich kostenlos — bei SCHUFA, KSV und CRIF. Sie enthält alle gespeicherten Daten samt Meldedatum und meldender Stelle. Kostenpflichtig ist bei den Auskunfteien nur die Verpackung (Bonitätszertifikat zum Weitergeben) — und bei FIAON die Arbeit drumherum: beschaffen, erklären, prüfen." },
  { f: "Was kostet die Bonitätsauskunft über FIAON?", a: "74 Euro, einmalig. Darin enthalten: die Beschaffung Ihrer Auskünfte, die Aufbereitung in Klartext, die Prüfung jedes Eintrags auf Zulässigkeit und Verfristung sowie ein Handlungsplan. Keine Erfolgsbeteiligung, kein Abo-Zwang — seriöse Arbeit rechnet nicht pro „gelöschtem Eintrag“ ab." },
  { f: "Wie lange dauert es, bis ich meine Auskunft habe?", a: "Der Antrag dauert etwa zwei Minuten. Die Auskunfteien liefern die Datenkopie je nach Haus und Weg innerhalb weniger Tage bis etwa vier Wochen (gesetzliche Obergrenze: ein Monat). Sobald sie vorliegt, sehen Sie Aufbereitung und Prüfung in Ihrem Kundenbereich — in der Regel binnen 24 Stunden." },
  { f: "Was ist der Unterschied zwischen Datenkopie und Bonitätszertifikat?", a: "Die Datenkopie ist für SIE: vollständig, mit jedem Eintrag und jedem Detail — und kostenlos. Das Bonitätszertifikat der Auskunfteien ist für DRITTE (z. B. Vermieter): gekürzt, dafür zum Vorzeigen gedacht und kostenpflichtig. Wer seine Lage verstehen oder verbessern will, braucht die Datenkopie." },
  { f: "Sieht die SCHUFA, dass ich eine Auskunft beantrage?", a: "Die Eigenauskunft ist neutral: Sie wird nicht als Anfrage gespeichert, die andere Banken sehen, und sie verändert Ihren Score nicht. Sie können sie so oft anfordern, wie Sie wollen." },
  { f: "Prüft FIAON auch KSV (Österreich) und CRIF (Schweiz)?", a: "Ja. FIAON arbeitet für den gesamten DACH-Raum und beschafft die Auskünfte aller drei Häuser aus einer Hand. Die Rechte sind vergleichbar: In Österreich gilt die DSGVO unmittelbar, die Schweiz kennt mit dem revidierten DSG eigene Auskunfts- und Berichtigungsrechte." },
  { f: "Kann FIAON garantieren, dass Einträge gelöscht werden?", a: "Nein — und niemand kann das seriös. Berechtigte, zulässig gemeldete Einträge bleiben bis zum Fristablauf. Was FIAON leistet: jeden Eintrag gegen die gesetzlichen Voraussetzungen halten und angreifen, was angreifbar ist. Anbieter mit Löschgarantie erkennen Sie als unseriös." },
];

export default function BonitaetsauskunftBeantragen() {
  // Service-Markup: die Dienstleistung, wie sie sichtbar auf der Seite steht.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Service",
      name: "FIAON Bonitätsauskunft mit Prüfung",
      serviceType: "Beschaffung und Prüfung von Bonitätsauskünften (SCHUFA, KSV, CRIF)",
      provider: { "@type": "Organization", name: "FIAON", url: "https://fiaon.com" },
      areaServed: ["DE", "AT", "CH"],
      offers: { "@type": "Offer", price: "74", priceCurrency: "EUR" },
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="Bonitätsauskunft beantragen: kostenlos oder geprüft" beschreibung="Bonitätsauskunft beantragen: der kostenlose Weg nach Art. 15 DSGVO und der geprüfte FIAON-Weg für 74 € im Vergleich. In 2 Minuten starten.">
      <SeoDaten
        pfad="/bonitaetsauskunft-beantragen"
        titel="Bonitätsauskunft beantragen: beide Wege | FIAON"
        beschreibung="Bonitätsauskunft beantragen: der kostenlose Weg nach Art. 15 DSGVO und der geprüfte FIAON-Weg für 74 € im Vergleich. In 2 Minuten starten."
        fragen={FRAGEN}
        krumen={[{ name: "Bonitätsauskunft beantragen", pfad: "/bonitaetsauskunft-beantragen" }]}
      />

      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Zwei Wege, volle Klarheit</span>
          <h1 className="dk-h1">Bonitätsauskunft beantragen — <span className="dk-verlauf">kostenlos oder geprüft.</span></h1>
          <p className="dk-lead">
            Ihre Auskunft steht Ihnen gesetzlich kostenlos zu — das sagen wir zuerst.
            FIAON ist der Weg für alle, die Beschaffung, Klartext-Erklärung und die Prüfung
            jedes Eintrags abgeben wollen: einmalig 74 Euro, ohne Abo-Zwang.
          </p>
          <div className="dk-knoepfe">
            <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
            <Knopf href="/kontakt" still>Kostenlos prüfen lassen</Knopf>
          </div>
        </div>
      </section>

      <Licht>
        {/* S2: Der ehrliche Vergleich. */}
        <Block schmal titel="Selbst beantragen oder beschaffen lassen?" lead="Beides führt zur Auskunft. Der Unterschied ist, wer die Arbeit macht — und wer die Einträge versteht.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">&nbsp;</th><th scope="col">Selbstauskunft (Art. 15 DSGVO)</th><th scope="col">FIAON-Weg</th></tr></thead>
              <tbody>
                <tr><td>Preis</td><td>0 € — gesetzliches Recht</td><td>74 € einmalig</td></tr>
                <tr><td>Beschaffung</td><td>Sie beantragen selbst — je Auskunftei einzeln</td><td>FIAON beantragt für Sie: SCHUFA, KSV, CRIF aus einer Hand</td></tr>
                <tr><td>Form</td><td>Rohdaten, Fachbegriffe, Abkürzungen</td><td>Aufbereitet in Klartext, jede Zeile erklärt</td></tr>
                <tr><td>Prüfung</td><td>machen Sie selbst (unsere Werkzeuge helfen kostenlos)</td><td>jeder Eintrag gegen § 31 BDSG und die Löschfristen gehalten</td></tr>
                <tr><td>Danach</td><td>Schreiben selbst aufsetzen, Fristen selbst verfolgen</td><td>Handlungsplan; Schriftwechsel und Fristenlauf übernimmt FIAON</td></tr>
                <tr><td>Für wen</td><td>Zeit und Ruhe, sich einzuarbeiten</td><td>schnell Gewissheit, ohne Paragrafen-Arbeit</td></tr>
              </tbody>
            </table>
          </div>
          <p className="dk-leise" style={{ marginTop: 14 }}>
            Den Gratisweg bereiten unsere Werkzeuge kostenlos vor:{" "}
            <a href="/werkzeuge/selbstauskunft" style={{ color: "#1d4ed8" }}>Selbstauskunft anfordern</a> und{" "}
            <a href="/werkzeuge/eintrag-pruefen" style={{ color: "#1d4ed8" }}>Eintrag prüfen</a>.
            Wer beides anbietet und den Gratisweg verschweigt, verkauft Ihnen Ihr eigenes Recht.
          </p>
        </Block>

        {/* S3: Der Ablauf als Zeitleiste. */}
        <Block schmal titel="So läuft es ab" lead="Vier Etappen — Sie sehen jede davon live in Ihrem Kundenbereich.">
          <Auf>
            <div className="sx-zeitleiste">
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">1</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">2 Minuten</span>
                  <h3>Konto eröffnen und beauftragen</h3>
                  <p>Name, Anschrift, Geburtsdatum — mehr brauchen die Auskunfteien nicht, um Sie sicher zuzuordnen. Sie beauftragen die Bonitätsauskunft für einmalig 74 Euro.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">2</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">wenige Tage bis 4 Wochen</span>
                  <h3>FIAON beschafft die Auskünfte</h3>
                  <p>Wir fordern Ihre Datenkopien bei SCHUFA, KSV und CRIF an. Die Häuser haben gesetzlich einen Monat Zeit — meist geht es deutlich schneller. Sie müssen nichts tun.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">3</span><span className="faden" /></div>
                <div className="inhalt">
                  <span className="dauer">binnen 24 Stunden nach Eingang</span>
                  <h3>Klartext und Prüfung</h3>
                  <p>Jede Zeile wird erklärt und gegen die Regeln gehalten: zulässig gemeldet? Frist abgelaufen? Inhaltlich richtig? Sie sehen das Ergebnis als verständlichen Bericht.</p>
                </div>
              </div>
              <div className="sx-etappe">
                <div className="spur"><span className="punkt">4</span></div>
                <div className="inhalt">
                  <span className="dauer">danach</span>
                  <h3>Handlungsplan — und auf Wunsch die Umsetzung</h3>
                  <p>Für angreifbare Einträge bereitet FIAON die Schreiben vor und hält die Fristen nach. Ziel danach: Girokonto und Karte beim Partner — die Eröffnung entscheidet die Bank.</p>
                </div>
              </div>
            </div>
          </Auf>
        </Block>

        {/* S4: Was Sie erhalten — die Dokument-Attrappe im CI. */}
        <Block schmal mitte titel="Was Sie erhalten" lead="So sieht Ihr Ergebnis aus: kein Zahlenfriedhof, sondern eine geprüfte Übersicht.">
          <Auf>
            <div className="sx-dokument" role="img" aria-label="Beispielhafte Darstellung des FIAON-Prüfberichts: drei Einträge mit Bewertung">
              <div className="kopf"><b>FIAON Prüfbericht</b><span>Beispieldarstellung</span></div>
              <div className="rumpf">
                <div className="zeile"><span>Girokonto, geführt seit 2019</span><b className="gruen">Positivmerkmal</b></div>
                <div className="zeile"><span>Ratenkredit, vertragsgemäß bedient</span><b className="gruen">Positivmerkmal</b></div>
                <div className="zeile"><span>Forderung Mobilfunk, 214 €, erledigt 2022</span><b className="gelb">Frist prüfen — Löschung möglich</b></div>
                <div className="zeile"><span>SCHUFA-Score (100–999)</span><b>im Bericht erklärt</b></div>
              </div>
            </div>
          </Auf>
        </Block>

        {/* S5: Die Preis-Karte. */}
        <Block schmal mitte titel="Ein Preis, keine Überraschungen">
          <Auf>
            <div className="sx-preis">
              <div className="betrag">74 €<small> einmalig</small></div>
              <ul className="zeilen">
                {[
                  "Beschaffung bei SCHUFA, KSV und CRIF — aus einer Hand",
                  "Jede Zeile in Klartext erklärt",
                  "Prüfung auf Zulässigkeit (§ 31 BDSG) und Verfristung",
                  "Handlungsplan für angreifbare Einträge",
                  "Keine Erfolgsbeteiligung, keine versteckten Kosten",
                ].map((z) => (
                  <li key={z}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    {z}
                  </li>
                ))}
              </ul>
              <div className="dk-knoepfe" style={{ justifyContent: "center", marginTop: 22 }}>
                <Knopf href="/antrag">Jetzt Antrag starten</Knopf>
              </div>
            </div>
          </Auf>
        </Block>

        {/* S6: FAQ */}
        <Block schmal titel="Häufige Fragen zur Bonitätsauskunft">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Weiterlesen: <a href="/schufa-score-verstehen" style={{ color: "#1d4ed8" }}>Was der Score bedeutet</a> ·{" "}
            <a href="/selbstauskunft-checkliste" style={{ color: "#1d4ed8" }}>Selbstauskunft richtig lesen</a> ·{" "}
            <a href="/auskunfteien" style={{ color: "#1d4ed8" }}>SCHUFA, KSV und CRIF im Überblick</a> ·{" "}
            <a href="/preise" style={{ color: "#1d4ed8" }}>alle FIAON-Pakete</a>.
            Stand August 2026 — keine Rechtsberatung im Einzelfall.
          </p>
        </Block>
      </Licht>

      <KartenAufruf
        titel="Zwei Minuten Antrag, dann arbeitet FIAON."
        satz="Auskünfte aus drei Ländern, jede Zeile erklärt, jeder Eintrag geprüft — für einmalig 74 Euro. Sie verfolgen jeden Schritt in Ihrem Kundenbereich."
      />
    </Dunkel>
  );
}
