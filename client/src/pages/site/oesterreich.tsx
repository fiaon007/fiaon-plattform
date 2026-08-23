// ═══════════════════════════════════════════════════════════════════════════
// /oesterreich — FIAON in Österreich (23.08.2026)
//
// KSV1870 und CRIF, Rechte nach DSGVO und GewO, Fristen, der Weg, Werkzeuge,
// Fragen. Bühne: Wien bei Nacht (Higgsfield, 08_Medien_Higgsfield).
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";

export default function Oesterreich() {
  return (
    <Dunkel seite="privatkunden" titel="FIAON in Österreich · KSV1870, CRIF, Ihre Rechte" beschreibung="Bonität in Österreich: KSV1870 und CRIF erklärt, Selbstauskunft nach Art. 15 DSGVO, Löschfristen, Bonitätsdatenbanken der Banken – und wie FIAON Einträge prüft, bereinigt und Konto und Karte vorbereitet.">
      <Hero pille="Österreich" titel={<>Bonität in Österreich, <span className="dk-verlauf">Klartext.</span></>}
            lead="KSV1870, CRIF, die Warnlisten der Banken: In Österreich entscheiden andere Stellen über Konto, Karte und Handyvertrag als in Deutschland – mit eigenen Regeln und eigenen Fristen. FIAON kennt sie."
            knoepfe={<><Knopf href="/antrag">Auskunft beschaffen</Knopf><Knopf href="/werkzeuge/selbstauskunft" still>Selbstauskunft-Brief (kostenlos)</Knopf></>}
            szene={<Szenenbild src="/kino/wien.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "2", label: "große Auskunfteien: KSV1870 und CRIF" }, { wert: "1", label: "Monat Frist für die Selbstauskunft (Art. 15 DSGVO)" }, { wert: "3", label: "Jahre übliche Speicherdauer nach Erledigung" }, { wert: "0 €", label: "kostet die Auskunft über Ihre Daten" }]} /></div>
      </section>

      <Block pille="Wer speichert was" titel={<>Die Stellen, <span className="dk-verlauf">die über Sie entscheiden.</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="KSV1870" titel="Der Kreditschutzverband">Die größte Auskunftei des Landes. Speichert Zahlungserfahrungen, Inkassofälle, Exekutionen und Insolvenzdaten – und berechnet einen Score, den Banken, Leasinggeber und Händler abfragen.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="CRIF" titel="Die zweite Auskunftei">Stark bei Telekommunikation, Versandhandel und Konsumentenkrediten. Viele Ablehnungen beim Handyvertrag gehen auf CRIF zurück, nicht auf den KSV.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Warnlisten der Banken" titel="Die interne Liste">Die Kreditinstitute führen gemeinsame Warnlisten (etwa über gekündigte Konten oder Kredite). Wer dort steht, bekommt oft auch ohne Negativeintrag bei KSV oder CRIF kein Konto – deshalb muss auch diese Auskunft her.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block pille="Ihre Rechte" titel={<>Was Sie verlangen <span className="dk-verlauf">können.</span></>}>
          <Zeilen items={[
            ["Auskunft", "Kostenlose Selbstauskunft nach Art. 15 DSGVO bei KSV1870, CRIF und jeder Bank, die eine Warnliste führt. Antwort innerhalb eines Monats. Einmal jährlich ohne Angabe von Gründen."],
            ["Richtigstellung", "Falsche oder unvollständige Daten müssen berichtigt werden (Art. 16 DSGVO). Dazu gehören erledigte Forderungen ohne Erledigungsvermerk und Verwechslungen."],
            ["Löschung", "Daten dürfen nur so lange gespeichert werden, wie es für den Zweck nötig ist (Art. 17 DSGVO). Erledigte Forderungen: in der Regel drei Jahre; danach ist die Löschung zu verlangen."],
            ["Widerspruch", "Gegen die Verarbeitung in Konsumentendatenbanken können Sie Widerspruch einlegen (Art. 21 DSGVO); die Auskunftei muss dann zwingende Gründe nachweisen."],
            ["Beschwerde", "Die Datenschutzbehörde in Wien ist zuständig, wenn Auskunftei oder Bank nicht reagieren. Daneben gilt § 152 GewO für Kreditauskunfteien: Betroffene haben ein Recht auf Auskunft und Richtigstellung."],
          ]} />
        </Block>

        <Block pille="Der Weg mit FIAON" titel={<>Von der Auskunft <span className="dk-verlauf">zur Karte.</span></>}>
          <Schritte items={[
            { titel: "Vollmacht und Auskünfte", text: "FIAON fordert Ihre Daten bei KSV1870, CRIF und – mit Ihrer Freigabe – bei den Banken an. Sie füllen kein Formular aus." },
            { titel: "Jeder Eintrag erklärt", text: "Was steht da, wer hat es gemeldet, ist es berechtigt, wann ist es weg. In Menschensprache, im Kundenbereich." },
            { titel: "Schreiben nach österreichischem Recht", text: "Richtigstellung, Löschung, Widerspruch – mit den richtigen Paragraphen, per Einschreiben, mit Frist." },
            { titel: "Konto und Karte", text: "Girokonto über Partnerbanken, die auch bei Einträgen eröffnen; Kreditkarte, sobald die Auskunft trägt. Die Bank entscheidet." },
          ]} />
        </Block>
      </Licht>

      <Block pille="Werkzeuge" titel={<>Kostenlos, <span className="dk-verlauf">sofort.</span></>} mitte>
        <div className="hw-raster">
          <Auf><a href="/werkzeuge/selbstauskunft" className="hw-karte"><span className="hw-tag">Selbstauskunft</span><h3>Fertiger Brief an KSV1870 und CRIF</h3><p>Art. 15 DSGVO, richtig formuliert, mit allen nötigen Angaben – ausdrucken, unterschreiben, abschicken.</p><span className="hw-mehr">Brief erstellen</span></a></Auf>
          <Auf verzoegerung={90}><a href="/werkzeuge/eintrag-pruefen" className="hw-karte"><span className="hw-tag">Eintrag prüfen</span><h3>Ist mein Eintrag angreifbar?</h3><p>Fünf Fragen zu Mahnungen, Fristen und Bestreiten – eine ehrliche Einschätzung.</p><span className="hw-mehr">Jetzt prüfen</span></a></Auf>
        </div>
      </Block>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Gibt es in Österreich die SCHUFA?", a: "Nein. Die Rolle übernehmen KSV1870 und CRIF, daneben die Warnlisten der Banken. Wer aus Deutschland nach Österreich zieht, beginnt bei KSV und CRIF ohne Historie – die SCHUFA-Daten werden nicht übertragen." },
            { f: "Wie lange bleibt ein Eintrag beim KSV?", a: "Erledigte Forderungen in der Regel drei Jahre nach Erledigung; Insolvenzdaten entsprechend der Ediktsdatei. Länger gespeicherte Daten sind nach Art. 17 DSGVO zu löschen." },
            { f: "Warum wurde mein Handyvertrag abgelehnt, obwohl der KSV nichts hat?", a: "Mobilfunkanbieter fragen häufig bei CRIF an. Fordern Sie dort die Selbstauskunft – FIAON tut das für Sie." },
            { f: "Kann ich trotz Eintrag ein Konto eröffnen?", a: "Ja. Auf ein Basiskonto besteht nach dem Verbraucherzahlungskontogesetz ein Rechtsanspruch. FIAON bereitet die Eröffnung bei einer Partnerbank vor." },
            { f: "Arbeitet FIAON mit österreichischem Recht?", a: "Ja. Schreiben, Fristen und Paragraphen sind für Österreich angepasst: DSGVO, DSG, GewO, Verbraucherzahlungskontogesetz. Der Ansprechpartner kennt beide Länder." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Sie sind in Österreich?</b> Der Antrag erkennt Ihr Land und beschafft KSV- und CRIF-Auskunft.</>} knopf="Auskunft beschaffen" href="/antrag" still={{ knopf: "Schweiz", href: "/schweiz" }} />
      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>} text="Antrag in zwei Minuten, Auskünfte innerhalb von 24 Stunden nach Eingang, ein Mensch, der Sie durch alles Weitere begleitet." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/preise" still>Preise</Knopf></>} />
    </Dunkel>
  );
}
