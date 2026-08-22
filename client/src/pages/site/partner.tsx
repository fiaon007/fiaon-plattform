// /partner — Geschäftspartner: Banken, Kartenherausgeber, Auskunfteien, Inkasso, Vermittler.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Schritte, Glas, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import KartenSzene from "@/components/home3d/KartenSzene";

export default function Partner() {
  return (
    <Dunkel seite="partner" titel="Geschäftspartner" beschreibung="Banken, Kartenherausgeber, Auskunfteien, Inkasso und Vermittler: FIAON bringt Kunden mit reparierter, dokumentierter Bonität – und die Einwilligung gleich mit.">
      <Hero
        bild="/kino/partner.jpg"
        pille="Geschäftspartner"
        titel={<>Kunden, deren Bonität repariert ist, sind die <span className="dk-verlauf">besten Kunden.</span></>}
        lead="FIAON bringt Ihnen keinen Antrag, sondern eine Akte: bereinigte Einträge, dokumentierter Spielraum aus dem Kontoauszug, eine Zahlungshistorie aus zwölf Raten – und die Einwilligung des Kunden, Ihnen genau das zu zeigen."
        knoepfe={<><Knopf href="#anfrage">Partner werden</Knopf><Knopf href="#fuer-wen" still>Für wen das passt</Knopf></>}
        szene={<KartenSzene anzahl={2} className="absolute inset-0" />}
      />

      <Block eng>
        <Kennzahlen items={[
          { wert: "3", label: "Datenquellen je Kunde: Auskunft, Kontoauszug, Zahlungshistorie der Raten" },
          { wert: "12", label: "Raten per SEPA-Lastschrift, bevor ein Kunde die Tür zur Karte erreicht – jede dokumentiert" },
          { wert: "100 %", label: "der Kunden beginnen mit einem Startgespräch – kein anonymer Antrag" },
          { wert: "DACH", label: "Deutschland, Österreich, Schweiz – mit SCHUFA, KSV und CRIF" },
        ]} />
      </Block>

      <Block id="fuer-wen" pille="Für wen" titel={<>Vier Partner. <span className="dk-verlauf">Eine Akte.</span></>}>
        <Karten items={[
          { tag: "Banken und Kartenherausgeber", titel: "Neukunden mit Geschichte statt Antrag.", text: "Sie sehen bereinigte Einträge, den monatlichen Spielraum und zwölf pünktliche Raten – mit Einwilligung. Girokonto für jeden Kunden, Kreditkarte bei guter Bonität, Finanzierung später." },
          { tag: "Auskunfteien", titel: "Weniger Streit, saubere Daten.", text: "FIAON stellt Anfragen strukturiert und in einem Format, das Sie verarbeiten können. Löschanträge kommen geprüft und vollständig – für Deutschland, Österreich und die Schweiz." },
          { tag: "Inkasso und Gläubiger", titel: "Ratenvereinbarungen, die halten.", text: "Vorschläge, die zum Spielraum des Kunden passen – aus seinem Kontoauszug abgeleitet. Antwort-Tracking auf beiden Seiten, Erinnerungen an jede Frist." },
          { tag: "Vermittler und Affiliates", titel: "Provision je Abschluss.", text: "Sie bringen Kunden, FIAON begleitet sie bis zur Karte. Vergütung je Abschluss und je eingezogener Rate – transparent in Ihrem Bereich, festgelegt von der Vertriebsleitung." },
        ]} zwei />
      </Block>

      <Block pille="Der Kundenweg" titel={<>Was passiert, bevor ein Kunde <span className="dk-verlauf">bei Ihnen ankommt.</span></>}
             lead="Drei Etappen, jede dokumentiert. Am Ende steht ein Kunde, der weiß, was über ihn gespeichert ist – und es geändert hat.">
        <Schritte items={[
          { titel: "Einsicht", text: "FIAON beantragt die Auskunft und analysiert den Kontoauszug. Der Kunde sieht Einträge, Einnahmen, Fixkosten und Spielraum – erklärt." },
          { titel: "Aktion", text: "Erledigte und falsche Einträge werden per anwaltlich geprüftem Schreiben angegriffen, offene Forderungen in Raten umgewandelt. Jede Antwort wird erfasst." },
          { titel: "Zugang", text: "Mit bereinigter Akte und dokumentierter Zahlungshistorie wird der Kunde Ihnen vorgestellt – mit seiner Einwilligung und allen Unterlagen." },
        ]} />
      </Block>

      <Zwischenruf text="Sie sind Bank oder Kartenherausgeber und möchten die Akte sehen, wie der Kunde sie sieht?" knopf="Gespräch anfragen" href="#anfrage" still={{ knopf: "Kundenweg ansehen", href: "/" }} />

      <Block pille="Was Sie erhalten" titel={<>Mehr als einen <span className="dk-verlauf">Lead.</span></>}>
        <Karten items={[
          { tag: "Bonität", titel: "Dokumentiert statt behauptet", text: "Die Auskunft nach der Bereinigung – mit den Antworten der Auskunfteien als Beleg." },
          { tag: "Spielraum", titel: "Aus dem Kontoauszug", text: "Einnahmen, Fixkosten, Abos, Spielraum: aus den letzten Monaten gelesen, nicht aus einem Formular abgetippt." },
          { tag: "Zahlungshistorie", titel: "Zwölf Raten als Beweis", text: "Jede SEPA-Rate, jeder Einzug, jede Reaktion. Ein Kunde, der zwölf Monate pünktlich zahlt, hat es bewiesen." },
          { tag: "Einwilligung", titel: "DSGVO-sauber", text: "Der Kunde entscheidet, wem FIAON seine Akte zeigt. Die Einwilligung wird protokolliert und kann widerrufen werden." },
        ]} zwei />
      </Block>

      <Block pille="Zusammenarbeit" titel={<>In vier Schritten zum <span className="dk-verlauf">Pilot.</span></>}>
        <Schritte items={[
          { titel: "Anfrage", text: "Sie nennen uns Ihr Haus, Ihre Rolle und Ihr Ziel. Antwort innerhalb von zwei Werktagen." },
          { titel: "Gespräch", text: "Wir zeigen die Akte, den Kundenweg und die Einwilligung – mit der Plattform auf dem Bildschirm." },
          { titel: "Pilot", text: "Eine begrenzte Zahl Kunden, klar definierte Kriterien, gemeinsame Auswertung nach 90 Tagen." },
          { titel: "Anbindung", text: "Schnittstelle oder strukturierte Übergabe, Vergütungsregel, Reporting. Dann skalieren wir gemeinsam." },
        ]} />
      </Block>

      <Block pille="Für Vermittler" titel={<>Provision, die <span className="dk-verlauf">nachvollziehbar</span> ist.</>} schmal>
        <Auf>
          <Glas ruhig>
            <ul className="dk-liste" style={{ marginTop: 0 }}>
              <li>Vergütung je Abschluss und je eingezogener Rate – sichtbar in Ihrem Bereich, Monat für Monat.</li>
              <li>Die Vertriebsleitung legt die Provisionsregel fest und kann sie je Kunde begründet anpassen – jede Änderung wird protokolliert.</li>
              <li>Keine Provision auf eigene Abos, keine Provision auf stornierte Pakete. Ehrlich, weil es sonst nicht hält.</li>
              <li>Wer Kunden nicht nur bringen, sondern begleiten möchte: Die Academy steht Ihnen offen – danach auch das Agentenportal.</li>
            </ul>
            <div className="dk-knoepfe" style={{ marginTop: 24 }}><Knopf href="/karriere" still>Als Einzelperson mitarbeiten</Knopf></div>
          </Glas>
        </Auf>
      </Block>

      <Block id="anfrage" pille="Kontakt" titel={<>Partner <span className="dk-verlauf">werden.</span></>}
             lead="Schreiben Sie uns, wer Sie sind und was Sie suchen. Ein Mensch antwortet innerhalb von zwei Werktagen." schmal>
        <Anfrage art="partner" knopf="Anfrage senden" hinweis="Oder direkt: partner@fiaon.com"
                 felder={[
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "firma", label: "Unternehmen", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel" },
                   { name: "rolle", label: "Sie sind", pflicht: true, optionen: ["Bank / Kartenherausgeber", "Auskunftei", "Inkasso / Gläubiger", "Vermittler / Affiliate", "Sonstiges"] },
                   { name: "land", label: "Land", optionen: ["Deutschland", "Österreich", "Schweiz", "Mehrere"] },
                   { name: "text", label: "Ihr Ziel", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Bekomme ich Daten ohne Einwilligung des Kunden?", a: "Nein. Der Kunde entscheidet, wem FIAON seine Akte zeigt. Die Einwilligung wird protokolliert und kann jederzeit widerrufen werden." },
          { f: "Entscheidet FIAON über Konto oder Karte?", a: "Nein. FIAON bereitet vor und dokumentiert. Über Konto, Karte und Rahmen entscheiden Sie – nach Ihren Kriterien." },
          { f: "Wie wird die Vergütung geregelt?", a: "Je Abschluss, auf Wunsch je eingezogener Rate. Die Regel steht im Vertrag, jede Abrechnung ist in der Plattform nachvollziehbar." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Ein Kunde, dessen Bonität repariert ist, sucht ein Konto. Die Frage ist nur, <span className="dk-verlauf">bei wem.</span></>}
        text="Einsicht und Aktion leistet FIAON. Den Zugang öffnen Partner. Wer früh dabei ist, bekommt die Kunden, die zwölf Monate lang bewiesen haben, dass sie es wert sind."
        knoepfe={<><Knopf href="#anfrage">Partner werden</Knopf><Knopf href="/investoren" still>Für Investoren</Knopf></>}
      />
    </Dunkel>
  );
}
