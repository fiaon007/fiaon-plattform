// /presse — FIAON in den Medien. Alles, was ein Journalist in fünf Minuten braucht.
import { Dunkel, Hero, Block, Karten, Kennzahlen, Zeilen, Glas, Zitat, Fragen, Zwischenruf, Abschluss, Anfrage, Knopf, Auf } from "@/components/site/DunkleBuehne";
import ArasCore from "@/components/home3d/ArasCore";
import KartenSzene from "@/components/home3d/KartenSzene";

export default function Presse() {
  return (
    <Dunkel seite="presse" titel="Presse" beschreibung="FIAON in den Medien: Kurzprofil, Fakten, Zahlen zum Zitieren, Bildmaterial und Ansprechpartner für Journalistinnen und Journalisten.">
      <Hero
        pille="Presse"
        titel={<>FIAON in den <span className="dk-verlauf">Medien.</span></>}
        lead="Das Betriebssystem für Bonität: FIAON zeigt Menschen in Deutschland, Österreich und der Schweiz, was Auskunfteien über sie wissen – repariert es mit ihnen und öffnet danach die Tür zu Konto, Karte und Finanzierung. Hier finden Sie alles für Ihre Recherche."
        knoepfe={<><Knopf href="#anfrage">Presseanfrage stellen</Knopf><Knopf href="#fakten" still>Fakten auf einen Blick</Knopf></>}
      />

      <Block id="fakten" eng>
        <div className="dk-raster zwei">
          <Auf>
            <Glas ruhig tag="Kurzprofil · 50 Wörter">
              <p className="dk-text" style={{ fontSize: 16, color: "#e5e7eb" }}>
                FIAON ist eine Bonitätsplattform für Deutschland, Österreich und die Schweiz. Sie beantragt für ihre Kunden die Auskunft bei SCHUFA, KSV oder CRIF, erklärt jeden Eintrag, bereitet anwaltlich geprüfte Löschanträge und Widersprüche vor und begleitet den Weg zu Girokonto, Kreditkarte und Finanzierung. Sitz: London. Kunden: DACH.
              </p>
            </Glas>
          </Auf>
          <Auf verzoegerung={100}>
            <Glas ruhig tag="Fakten">
              <Zeilen items={[
                ["Unternehmen", "FIAON LTD, London"],
                ["Gründer und Director", "Justin Schwarzott"],
                ["Märkte", "Deutschland · Österreich · Schweiz"],
                ["Produkt", "Einsicht · Aktion · Zugang"],
                ["Preise", "7,99 € bis 99,99 € / Monat"],
                ["Bonitätsauskunft", "74 € einmalig"],
                ["Zahlung", "SEPA-Lastschrift, 12 Raten"],
                ["Presse", "presse@fiaon.com"],
              ]} />
            </Glas>
          </Auf>
        </div>
      </Block>

      <Block pille="Zahlen zum Zitieren" titel={<>Der Markt in <span className="dk-verlauf">vier Zahlen.</span></>}>
        <Kennzahlen items={[
          { wert: "100 Mio.", label: "Menschen im DACH-Raum mit einem Eintrag bei einer Auskunftei" },
          { wert: "6 Mio.", label: "überschuldete Personen allein in Deutschland" },
          { wert: "< 24 h", label: "von der Anmeldung bis zur ersten Einsicht in die eigene Auskunft" },
          { wert: "25.000 €", label: "Kreditkartenrahmen, der bei guter Bonität über Partner erreichbar ist" },
        ]} />
      </Block>

      <Block pille="Die Geschichte" titel={<>In drei Sätzen <span className="dk-verlauf">erzählt.</span></>}
             lead="Wer FIAON in einem Absatz beschreiben will, braucht nur die drei Schichten.">
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <Auf><Glas tag="1 · Einsicht" titel="Menschen sehen zum ersten Mal ihre Auskunft.">FIAON stellt die Anfrage bei SCHUFA, KSV oder CRIF. Innerhalb eines Tages liegt die Auskunft erklärt im Kundenbereich – zusammen mit einer Analyse des Kontoauszugs.</Glas></Auf>
            <Auf verzoegerung={100}><Glas tag="2 · Aktion" titel="Dann ändern sie, was falsch ist.">Erledigte Forderungen, veraltete Daten, angreifbare Einträge: Das Schreiben ist vorbereitet und anwaltlich geprüft. Der Kunde gibt frei, FIAON versendet und verfolgt die Antwort.</Glas></Auf>
            <Auf verzoegerung={200}><Glas tag="3 · Zugang" titel="Und bekommen, was ihnen vorher verwehrt war.">Girokonto für jeden Kunden, Kreditkarte bei guter Bonität, Finanzierung später – über Partnerbanken, die eine dokumentierte Bonität sehen statt eines Antrags.</Glas></Auf>
          </div>
          <Auf verzoegerung={150}><div className="dk-szene gross"><ArasCore className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Block eng schmal>
        <Zitat text="Niemand sollte abgelehnt werden wegen eines Eintrags, der längst erledigt ist. Wir haben eine Plattform gebaut, die das ändert – nicht nur anzeigt." wer="Justin Schwarzott, Gründer FIAON" />
      </Block>

      <Block pille="Themen" titel={<>Worüber wir <span className="dk-verlauf">sprechen können.</span></>}
             lead="Justin Schwarzott steht für Interviews, Hintergrundgespräche und Gastbeiträge zur Verfügung.">
        <Karten items={[
          { tag: "Verbraucher", titel: "Was steht eigentlich in meiner SCHUFA?", text: "Wie Einträge entstehen, warum erledigte Forderungen oft stehen bleiben und was jeder Mensch dagegen tun kann – mit echten, anonymisierten Fällen." },
          { tag: "Markt", titel: "Warum Score-Apps nicht reichen", text: "Eine Zahl ist keine Hilfe. Der Unterschied zwischen Anzeigen und Handeln – und warum die Aktion die schwerste Schicht ist." },
          { tag: "Technik", titel: "KI, die Kontoauszüge liest", text: "Wie die FIAON-Analyse Einnahmen, Fixkosten und Spielraum erkennt, welche Grenzen wir ziehen und warum jedes Schreiben von Menschen freigegeben wird." },
          { tag: "Gesellschaft", titel: "Kunden werden Mitarbeiter", text: "Wer FIAON erlebt hat, arbeitet von zuhause für FIAON – auf Provision, nach Academy. Ein Vertriebsmodell, das mit seinen Kunden wächst." },
        ]} zwei />
      </Block>

      <Zwischenruf text="Sie wollen die Plattform selbst ausprobieren? Der Kundenweg ist öffentlich – Sie brauchen nur eine E-Mail-Adresse." knopf="Konto als Testperson anlegen" href="/antrag" still={{ knopf: "Startseite ansehen", href: "/" }} />

      <Block pille="Pressemitteilungen" titel={<>Aktuelle <span className="dk-verlauf">Meldungen.</span></>}>
        <div className="dk-raster zwei">
          <Auf><Glas ruhig tag="2026 · in Vorbereitung" titel="FIAON liest den Kontoauszug: Analyse in unter einer Minute">Die Kontoauszug-Analyse zeigt Kunden Einnahmen, Fixkosten, Abos und den monatlichen Spielraum – die Grundlage jeder Ratenvereinbarung. Volltext auf Anfrage.</Glas></Auf>
          <Auf verzoegerung={100}><Glas ruhig tag="2026 · in Vorbereitung" titel="Jeder Kunde beginnt mit einem Startgespräch">FIAON führt das persönliche Startgespräch als Pflicht ein: Kein Kunde arbeitet allein an seiner Bonität. Volltext auf Anfrage.</Glas></Auf>
        </div>
      </Block>

      <Block pille="Bildmaterial" titel={<>Wortmarke und <span className="dk-verlauf">Produktansichten.</span></>}
             lead="Druckfähige Dateien, Screenshots des Kundenbereichs und ein Porträt des Gründers erhalten Sie auf Anfrage innerhalb eines Werktags.">
        <div className="dk-zweispaltig" style={{ marginTop: 44 }}>
          <Auf>
            <Glas ruhig tag="Wortmarke">
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", textAlign: "center" }}><span className="fiaon-gradient-text-animated" style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.03em" }}>FIAON</span></div>
                <div style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,.1)", borderRadius: 16, padding: "28px 24px", textAlign: "center" }}><span style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-.03em", color: "#fff" }}>FIAON</span></div>
              </div>
              <p className="dk-leise" style={{ marginTop: 14 }}>Bitte nur so verwenden: Wortmarke in Blau auf Weiß oder Weiß auf Nachtblau. Keine Verzerrung, kein Schatten.</p>
            </Glas>
          </Auf>
          <Auf verzoegerung={120}><div className="dk-szene"><KartenSzene anzahl={1} className="absolute inset-0" /></div></Auf>
        </div>
      </Block>

      <Block id="anfrage" pille="Ansprechpartner" titel={<>Ihre <span className="dk-verlauf">Presseanfrage.</span></>}
             lead="Schreiben Sie uns Medium, Thema und Frist. Sie erhalten eine Antwort von einem Menschen – in der Regel am selben Werktag." schmal>
        <Anfrage art="presse" knopf="Anfrage senden" hinweis="Oder direkt: presse@fiaon.com"
                 felder={[
                   { name: "name", label: "Ihr Name", pflicht: true },
                   { name: "firma", label: "Medium / Redaktion", pflicht: true },
                   { name: "email", label: "E-Mail", typ: "email", pflicht: true },
                   { name: "telefon", label: "Telefon", typ: "tel" },
                   { name: "thema", label: "Thema", pflicht: true },
                   { name: "frist", label: "Frist", typ: "date" },
                   { name: "text", label: "Ihre Fragen", typ: "textarea", breit: true },
                 ]} />
      </Block>

      <Block eng schmal pille="Häufige Fragen">
        <Fragen items={[
          { f: "Darf ich Kunden von FIAON befragen?", a: "Ja, auf Wunsch vermitteln wir Kundinnen und Kunden, die ihre Geschichte erzählen möchten – mit deren Einwilligung und auf Wunsch anonymisiert." },
          { f: "Gibt es Zahlen zu Kunden und Umsatz?", a: "Für die Berichterstattung stellen wir geprüfte Kennzahlen auf Anfrage bereit. Quellen zu den Marktzahlen nennen wir auf Nachfrage." },
          { f: "Ist FIAON eine Bank oder ein Kreditvermittler?", a: "Weder noch. FIAON ist eine Plattform, die Bonität sichtbar macht und repariert. Über Konto, Karte und Rahmen entscheidet immer die jeweilige Partnerbank." },
        ]} />
      </Block>

      <Abschluss
        titel={<>Die beste Geschichte schreibt ein Kunde, der seine erste Karte <span className="dk-verlauf">in der Hand hält.</span></>}
        text="Alles auf dieser Seite führt dorthin: Einsicht, Aktion, Zugang. Wenn Sie diese Geschichte erzählen wollen, helfen wir Ihnen – mit Fakten, Menschen und Zugang zur Plattform."
        knoepfe={<><Knopf href="#anfrage">Presseanfrage stellen</Knopf><Knopf href="/investoren" still>Für Investoren</Knopf></>}
      />
    </Dunkel>
  );
}
