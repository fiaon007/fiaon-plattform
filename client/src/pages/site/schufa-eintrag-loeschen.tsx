// ═══════════════════════════════════════════════════════════════════════════
// /schufa-eintrag-loeschen — der Pfeiler zum Kauf-Suchwort (26.08.2026)
//
// „Schufa Eintrag löschen lassen" ist DIE Suche mit Handlungsabsicht in
// diesem Markt. Die Seite beantwortet sie vollständig: welche Einträge
// angreifbar sind, die Fristen als Tabelle, der Weg in vier Schritten —
// und verlinkt auf die drei Werkzeuge, die jeden Schritt kostenlos
// vorbereiten. HowTo- und FAQ-Markup für die Rich Results.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { Dunkel, Block, Licht, Knopf, Zwischenruf, Fragen, Karten } from "@/components/site/DunkleBuehne";
import SeoDaten from "@/components/site/SeoDaten";
import "@/styles/ratgeber.css";

const SCHRITTE = [
  { name: "Datenkopie anfordern", text: "Kostenlos nach Art. 15 DSGVO bei SCHUFA, KSV und CRIF. Nur die Datenkopie zeigt alle Einträge mit Meldedatum, Erledigungsdatum und meldender Stelle — die Bezahlprodukte zeigen nicht mehr." },
  { name: "Jeden Eintrag gegen die Regeln halten", text: "Zulässig gemeldet ist eine offene Forderung nur unter den Voraussetzungen des § 31 BDSG: mindestens zwei Mahnungen, vier Wochen Abstand, rechtzeitiger Hinweis auf die drohende Meldung, Forderung nicht bestritten. Fehlt eine Voraussetzung, ist der Eintrag angreifbar — unabhängig davon, ob die Forderung berechtigt war." },
  { name: "Löschung oder Berichtigung verlangen", text: "Schriftlich an die Auskunftei UND an die meldende Stelle, mit Begründung und Frist (üblich: vier Wochen). Grundlage sind Art. 17 DSGVO (Löschung) und Art. 16 DSGVO (Berichtigung). Die Auskunftei muss prüfen und antworten." },
  { name: "Bei Weigerung: Beschwerde und Aufsicht", text: "Bleibt die Auskunftei untätig, sind der Ombudsmann und die Datenschutz-Aufsichtsbehörde der nächste Schritt — kostenlos. Parallel lohnt der Blick auf die Frist: Viele Einträge sind schlicht verfristet und müssen ohnehin weg." },
];

const FRAGEN = [
  { f: "Kann man einen berechtigten SCHUFA-Eintrag löschen lassen?", a: "Einen inhaltlich richtigen, zulässig gemeldeten Eintrag vor Fristablauf: nein — Anbieter, die genau das pauschal versprechen, arbeiten unseriös. Aber ein erheblicher Teil der Einträge ist eben NICHT zulässig gemeldet: ohne die zwei vorgeschriebenen Mahnungen, trotz bestrittener Forderung oder nach Ablauf der Löschfrist. Diese Einträge sind angreifbar, und ihre Löschung ist ein Rechtsanspruch." },
  { f: "Wie lange bleibt ein erledigter Eintrag gespeichert?", a: "Grundsätzlich drei Jahre ab Erledigung, taggenau. Seit 2024 gilt die 100-Tage-Regel: Wer innerhalb von 100 Tagen nach der Meldung bezahlt und sonst keine Negativmerkmale hat, ist nach 18 Monaten raus. Die Restschuldbefreiung nach Insolvenz wird schon nach sechs Monaten gelöscht." },
  { f: "Was kostet es, einen Eintrag löschen zu lassen?", a: "Selbst machen kostet nichts außer Zeit: Datenkopie, Prüfung, Schreiben, Fristen — alle Vorlagen und Regeln sind öffentlich, unsere Werkzeuge bereiten jeden Schritt kostenlos vor. Wer die Beschaffung, Prüfung und Durchsetzung abgeben will, beauftragt einen Dienst wie FIAON mit transparenten Paketpreisen — seriöse Anbieter rechnen nie erfolgsabhängig pro „gelöschtem Eintrag“ ab und versprechen keine Garantien." },
  { f: "Bringt die Löschung eines Eintrags wirklich etwas?", a: "Ja, oft erheblich: Negativeinträge sind das schwerste Einzelmerkmal im Score. Fällt der Eintrag, verbessern sich Score-Klasse und Konditionen — vom Handyvertrag über die Wohnung bis zum Kreditzins. Die Wirkung tritt nicht über Nacht ein; die Auskunfteien rechnen ihre Scores in Abständen neu." },
  { f: "Kann ich das auch bei KSV (Österreich) und CRIF (Schweiz) machen?", a: "Ja. Die DSGVO gilt in Österreich unmittelbar, die Schweiz hat mit dem revidierten DSG vergleichbare Auskunfts- und Berichtigungsrechte. Die Fristen und Gepflogenheiten unterscheiden sich im Detail — die Länderseiten für Österreich und die Schweiz erklären sie." },
];

export default function SchufaEintragLoeschen() {
  // HowTo-Markup: die vier Schritte, wie sie sichtbar auf der Seite stehen.
  useEffect(() => {
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "SCHUFA-Eintrag löschen lassen: der Weg in vier Schritten",
      step: SCHRITTE.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  return (
    <Dunkel seite="ratgeber" titel="SCHUFA-Eintrag löschen lassen · Fristen, Rechte, Weg" beschreibung="SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind (§ 31 BDSG), alle Löschfristen als Tabelle, der Weg in vier Schritten mit kostenlosen Werkzeugen – und woran Sie unseriöse Anbieter erkennen.">
      <SeoDaten
        pfad="/schufa-eintrag-loeschen"
        titel="SCHUFA-Eintrag löschen lassen · Fristen, Rechte, Weg"
        beschreibung="Welche Einträge angreifbar sind, alle Löschfristen als Tabelle, der Weg in vier Schritten – mit kostenlosen Werkzeugen."
        fragen={FRAGEN}
        artikel={{ ueberschrift: "SCHUFA-Eintrag löschen lassen: Fristen, Rechte und der Weg", stand: "2026-08-26" }}
        krumen={[{ name: "SCHUFA-Eintrag löschen", pfad: "/schufa-eintrag-loeschen" }]}
      />
      <section className="dk-hero kurz">
        <div className="dk-hero-bild" aria-hidden="true"><img src="/kino/akten.jpg" alt="" decoding="async" {...({ fetchpriority: "high" } as any)} /><div className="schleier" /></div>
        <div className="dk-rahmen">
          <span className="dk-pille">Rechte kennen · Fristen nutzen</span>
          <h1 className="dk-h1">SCHUFA-Eintrag <span className="dk-verlauf">löschen lassen.</span></h1>
          <p className="dk-lead">Nicht jeder Eintrag muss bleiben: Viele sind falsch gemeldet, verfristet oder ohne die gesetzlichen Voraussetzungen eingetragen. Hier stehen die Regeln, die Fristen und der Weg — Schritt für Schritt.</p>
        </div>
      </section>
      <Licht>
        <Block titel="Welche Einträge angreifbar sind" lead="Drei Angriffspunkte, die in der Praxis am häufigsten tragen.">
          <Karten items={[
            { tag: "§ 31 BDSG", titel: "Ohne die Voraussetzungen gemeldet", text: "Eine offene Forderung darf nur gemeldet werden nach zwei Mahnungen mit vier Wochen Abstand, rechtzeitigem Hinweis auf die Meldung — und nur, wenn Sie die Forderung nicht bestritten haben. In der Praxis fehlt erstaunlich oft eine dieser Voraussetzungen. Dann ist der Eintrag angreifbar, selbst wenn die Forderung selbst berechtigt war." },
            { tag: "Fristablauf", titel: "Verfristet und trotzdem noch da", text: "Drei Jahre nach Erledigung, 18 Monate bei der 100-Tage-Regel, sechs Monate nach Restschuldbefreiung, zwölf Monate für Kreditanfragen: Wer die Fristen kennt, findet Einträge, die längst gelöscht sein müssten. Eine überschrittene Frist ist der klarste Löschgrund überhaupt." },
            { tag: "Art. 16 DSGVO", titel: "Schlicht falsch", text: "Falscher Betrag, falsches Datum, falsche Person, doppelt gemeldet, Erledigung nie nachgetragen: Unrichtige Daten müssen berichtigt werden — unverzüglich, nicht irgendwann. Der Abgleich von Datenkopie und eigenen Unterlagen bringt es an den Tag." },
          ]} />
        </Block>

        <Block schmal titel="Die Löschfristen auf einen Blick" lead="Stand der Verhaltensregeln 2024 — taggenau gerechnet, nicht mehr zum Jahresende.">
          <div className="wz-tabelle-huelle">
            <table className="wz-tabelle">
              <thead><tr><th scope="col">Eintrag</th><th scope="col">Löschfrist</th></tr></thead>
              <tbody>
                <tr><td>Erledigte Forderung</td><td>3 Jahre nach Erledigung</td></tr>
                <tr><td>Erledigt innerhalb von 100 Tagen nach Meldung (ohne weitere Negativmerkmale)</td><td>18 Monate</td></tr>
                <tr><td>Restschuldbefreiung nach Insolvenz</td><td>6 Monate</td></tr>
                <tr><td>Kreditanfrage</td><td>12 Monate (nur 10 Tage für andere sichtbar)</td></tr>
                <tr><td>Girokonto, Kreditkarte (Vertragsdaten)</td><td>bei Beendigung</td></tr>
                <tr><td>Offene, nicht bestrittene Forderung</td><td>keine — erst ab Erledigung läuft die Frist</td></tr>
              </tbody>
            </table>
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 22 }}>
            <Knopf href="/werkzeuge/loeschfrist">Meine Frist taggenau berechnen</Knopf>
          </div>
        </Block>

        <Block titel="Der Weg in vier Schritten" lead="Alles davon können Sie selbst tun — die Werkzeuge bereiten jeden Schritt kostenlos vor.">
          <div className="wz-fragen">
            {SCHRITTE.map((s, i) => (
              <div className="wz-frage" key={s.name}>
                <p className="wz-nr">Schritt {i + 1}</p>
                <h3>{s.name}</h3>
                <p className="wz-hinweis">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="dk-knoepfe" style={{ marginTop: 26 }}>
            <Knopf href="/werkzeuge/selbstauskunft">Datenkopie anfordern</Knopf>
            <Knopf href="/werkzeuge/eintrag-pruefen" still>Eintrag prüfen</Knopf>
          </div>
        </Block>

        <Block schmal titel="Häufige Fragen">
          <Fragen items={FRAGEN} />
          <p className="dk-leise" style={{ marginTop: 22 }}>
            Redaktionelle Einordnung nach § 31 BDSG, Art. 15–17 DSGVO und den Verhaltensregeln der Wirtschaftsauskunfteien
            (Fassung 2024), Stand August 2026. Keine Rechtsberatung im Einzelfall. FIAON verspricht keine Löschung
            berechtigter, zulässig gemeldeter Einträge.
          </p>
        </Block>
      </Licht>
      <Zwischenruf text={<><b>Selbst machen ist möglich. Machen lassen ist schneller.</b> FIAON beschafft alle Auskünfte, prüft jeden Eintrag gegen jede Regel und führt den Schriftwechsel mit Fristenlauf — Sie sehen jeden Schritt in Ihrem Kundenbereich.</>} knopf="Prüfung beauftragen" href="/antrag" />
    </Dunkel>
  );
}
