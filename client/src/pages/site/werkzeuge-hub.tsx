// ═══════════════════════════════════════════════════════════════════════════
// /werkzeuge — die Werkzeugbank (26.08.2026)
//
// Zehn Werkzeuge existierten, aber keine Seite, die sie versammelt: Wer nicht
// zufällig aus einem Ratgeber-Artikel kam, fand keines. Diese Seite ist der
// Verteiler — und für die Suche der eine Ort, an dem „kostenlose Schufa-
// Werkzeuge" eine Adresse hat.
//
// SEO: ItemList über alle Werkzeuge, Brotkrumen, FAQ. Jede Karte nennt in
// einem Satz, welche Frage das Werkzeug beantwortet — die Karten sind
// zugleich die Sprungmarken, auf die Anzeigen zeigen können.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Auf } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const WERKZEUGE: { pfad: string; name: string; frage: string; satz: string; gruppe: "eintrag" | "geld" | "karte" }[] = [
  { pfad: "/werkzeuge/selbstauskunft", name: "Datenkopie anfordern", frage: "Was steht über mich in den Auskunfteien?", satz: "Erzeugt das fertige Schreiben nach Art. 15 DSGVO — für SCHUFA, KSV und CRIF, kostenlos statt Bezahl-Abo.", gruppe: "eintrag" },
  { pfad: "/werkzeuge/eintrag-pruefen", name: "Ist mein Eintrag angreifbar?", frage: "Kann dieser Eintrag gelöscht werden?", satz: "Fünf Fragen, eine ehrliche Einschätzung nach § 31 BDSG und der Rechtsprechung.", gruppe: "eintrag" },
  { pfad: "/werkzeuge/loeschfrist", name: "Löschfrist-Rechner", frage: "Wann ist mein Eintrag von selbst weg?", satz: "Taggenaues Löschdatum — mit 100-Tage-Regel und Sechs-Monats-Frist nach Insolvenz.", gruppe: "eintrag" },
  { pfad: "/werkzeuge/verjaehrung", name: "Verjährungs-Prüfer", frage: "Muss ich diese alte Forderung noch zahlen?", satz: "Prüft die regelmäßige Verjährung und was sie unterbricht.", gruppe: "eintrag" },
  { pfad: "/werkzeuge/inkassokosten", name: "Inkassokosten-Prüfer", frage: "Darf das Inkasso so viel verlangen?", satz: "Vergleicht die Forderung mit den gesetzlichen Obergrenzen.", gruppe: "eintrag" },
  { pfad: "/werkzeuge/kreditrechner", name: "Kreditrechner", frage: "Was kostet dieser Kredit wirklich?", satz: "Monatsrate, Gesamtkosten, Tilgungsplan — und die Rate beim Zwei-Drittel-Zins.", gruppe: "geld" },
  { pfad: "/werkzeuge/umschuldung", name: "Umschuldungsrechner", frage: "Weiterzahlen oder zusammenlegen?", satz: "Alte Kredite und Dispo gegen ein neues Angebot gerechnet — mit Vorfälligkeitsentschädigung.", gruppe: "geld" },
  { pfad: "/werkzeuge/schulden-check", name: "Schulden-Check", frage: "Wie ernst ist meine Lage?", satz: "Schuldenquote und freies Einkommen — mit ehrlicher Ampel und den nächsten Schritten.", gruppe: "geld" },
  { pfad: "/werkzeuge/spielraum", name: "Spielraum-Rechner", frage: "Wie viel Rate trage ich?", satz: "Haushaltsrechnung, wie eine Bank sie ansetzt.", gruppe: "geld" },
  { pfad: "/werkzeuge/karten-check", name: "Karten-Check", frage: "Welche Kreditkarte ist realistisch?", satz: "Debit, Prepaid oder echter Rahmen — was heute geht und was den nächsten Schritt öffnet.", gruppe: "karte" },
];

const GRUPPEN = [
  { key: "eintrag" as const, titel: "Einträge und Forderungen", satz: "Wissen, was gespeichert ist — und was davon weg kann." },
  { key: "geld" as const, titel: "Kredit und Haushalt", satz: "Rechnen, bevor Sie unterschreiben." },
  { key: "karte" as const, titel: "Karte und Konto", satz: "Realistisch einschätzen statt hoffen." },
];

const FRAGEN = [
  { f: "Was kosten die FIAON-Werkzeuge?", a: "Nichts. Alle Werkzeuge sind kostenlos, verlangen keine Anmeldung und keine E-Mail-Adresse. Die Berechnungen laufen in Ihrem Browser — es wird nichts übertragen und nichts gespeichert." },
  { f: "Ersetzen die Werkzeuge eine Beratung?", a: "Nein. Sie geben eine fundierte erste Einschätzung nach den geltenden Regeln — die verbindliche Prüfung Ihres Einzelfalls leisten sie nicht. Bei ernster Überschuldung gehört der erste Weg zur kostenlosen, staatlich anerkannten Schuldnerberatung." },
  { f: "Woher stammen die Regeln in den Werkzeugen?", a: "Aus den veröffentlichten Quellen: Verhaltensregeln der Wirtschaftsauskunfteien (Fassung 2024), § 31 BDSG, Art. 15 und 17 DSGVO, § 6a PAngV, §§ 195 ff. und 500 ff. BGB, RVG für Inkassokosten sowie der Rechtsprechung von BGH und EuGH. Jedes Werkzeug nennt seine Grundlage unten auf der Seite." },
  { f: "Warum stellt FIAON das kostenlos bereit?", a: "Weil die erste Frage — was steht über mich drin, und was davon ist angreifbar? — jeder selbst beantworten können sollte. Wer danach möchte, dass jemand die Beschaffung, Prüfung und Durchsetzung übernimmt, kennt uns dann schon." },
];

export default function WerkzeugeHub() {
  // ItemList je Werkzeug — die Auszeichnung, mit der eine Werkzeugsammlung
  // in der Suche als Sammlung erscheint.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: "FIAON Werkzeuge",
      itemListElement: WERKZEUGE.map((w, i) => ({
        "@type": "ListItem", position: i + 1, name: w.name, url: "https://fiaon.com" + w.pfad,
      })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="Werkzeuge · Zehn kostenlose Rechner und Prüfer" beschreibung="Zehn kostenlose Werkzeuge rund um SCHUFA, Bonität und Kredit: Datenkopie anfordern, Einträge und Löschfristen prüfen, Kredit- und Umschuldungsrechner, Schulden-Check. Ohne Anmeldung, nichts wird gespeichert.">
      <SeoDaten
        pfad="/werkzeuge"
        titel="Werkzeuge · Zehn kostenlose Rechner und Prüfer"
        beschreibung="Zehn kostenlose Werkzeuge rund um SCHUFA, Bonität und Kredit — ohne Anmeldung, nichts wird gespeichert."
        fragen={FRAGEN}
        krumen={[{ name: "Werkzeuge", pfad: "/werkzeuge" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Zehn Werkzeuge · kostenlos, ohne Anmeldung</span>
          <h1 className="dk-h1">Erst wissen, <span className="dk-verlauf">dann handeln.</span></h1>
          <p className="dk-lead">Jedes Werkzeug beantwortet eine Frage, die sonst Geld oder Wochen kostet. Alles läuft in Ihrem Browser — nichts wird gespeichert.</p>
        </div>
      </section>
      <Licht>
        {GRUPPEN.map((g) => (
          <Block key={g.key} titel={g.titel} lead={g.satz}>
            <div className="wzh-karten">
              {WERKZEUGE.filter((w) => w.gruppe === g.key).map((w, i) => (
                <Auf key={w.pfad} verzoegerung={i * 70}>
                  <a className="wzh-karte" href={w.pfad}>
                    <small>{w.frage}</small>
                    <b>{w.name}</b>
                    <p>{w.satz}</p>
                    <span className="wzh-pfeil" aria-hidden="true">→</span>
                  </a>
                </Auf>
              ))}
            </div>
          </Block>
        ))}
        <Block schmal titel="Häufige Fragen">
          <Fragen items={FRAGEN} />
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Die Werkzeuge zeigen, was möglich ist — FIAON setzt es durch.</b> Beschaffung aller Auskünfte, Prüfung jedes Eintrags, Schreiben mit Fristenlauf: ein Auftrag, ein Ansprechpartner.</>} knopf="So arbeitet FIAON" href="/was-ist-fiaon" />
    </Dunkel>
  );
}
