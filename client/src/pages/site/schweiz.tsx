// ═══════════════════════════════════════════════════════════════════════════
// /schweiz — FIAON in der Schweiz (23.08.2026)
//
// CRIF, Intrum und das Betreibungsregister, Rechte nach DSG und SchKG,
// Fristen, der Weg, Werkzeuge, Fragen. Bühne: Zürich bei Nacht (Higgsfield).
// ═══════════════════════════════════════════════════════════════════════════
import { Dunkel, Hero, Block, Licht, Knopf, Auf, Glas, Kennzahlen, Schritte, Zeilen, Fragen, Zwischenruf, Abschluss, Szenenbild } from "@/components/site/DunkleBuehne";

export default function Schweiz() {
  return (
    <Dunkel seite="privatkunden" titel="FIAON in der Schweiz · Betreibungsregister, CRIF, Intrum" beschreibung="Bonität in der Schweiz: Betreibungsregisterauszug, CRIF und Intrum erklärt, Auskunft nach Art. 25 DSG, Löschung unbegründeter Betreibungen (Art. 8a SchKG) – und wie FIAON Einträge prüft, bereinigt und Konto und Karte vorbereitet.">
      <Hero pille="Schweiz" titel={<>Bonität in der Schweiz, <span className="dk-verlauf">Klartext.</span></>}
            lead="Betreibungsregister, CRIF, Intrum: In der Schweiz entscheidet oft ein Auszug vom Betreibungsamt über Wohnung, Handy und Karte – und fünf Jahre sind lang. FIAON kennt die Wege, ihn zu bereinigen."
            knoepfe={<><Knopf href="/antrag">Auskunft beschaffen</Knopf><Knopf href="/werkzeuge/selbstauskunft" still>Auskunftsbrief (kostenlos)</Knopf></>}
            szene={<Szenenbild src="/kino/zuerich.jpg" tief />} />

      <section className="dk-block" style={{ paddingTop: 10 }}>
        <div className="dk-rahmen"><Kennzahlen items={[{ wert: "5", label: "Jahre bleibt eine Betreibung im Registerauszug sichtbar" }, { wert: "3", label: "Monate Frist, eine unbegründete Betreibung sperren zu lassen (Art. 8a SchKG)" }, { wert: "30", label: "Tage Frist für die Auskunft nach Art. 25 DSG" }, { wert: "17 CHF", label: "kostet der Betreibungsregisterauszug beim Amt" }]} /></div>
      </section>

      <Block pille="Wer speichert was" titel={<>Die Stellen, <span className="dk-verlauf">die über Sie entscheiden.</span></>}>
        <div className="dk-raster" style={{ marginTop: 36 }}>
          <Auf><Glas tag="Betreibungsregister" titel="Das Amt am Wohnort">Jede Betreibung – auch eine unberechtigte – steht fünf Jahre im Auszug des Betreibungsamts. Vermieter, Arbeitgeber, Mobilfunkanbieter verlangen ihn. Der wichtigste Hebel in der Schweiz.</Glas></Auf>
          <Auf verzoegerung={80}><Glas tag="CRIF" titel="Die private Auskunftei">Sammelt Zahlungserfahrungen aus Handel, Telekommunikation und Kredit und berechnet Scores, die Online-Händler und Banken abfragen. Auskunft nach Art. 25 DSG kostenlos.</Glas></Auf>
          <Auf verzoegerung={160}><Glas tag="Intrum" titel="Inkasso und Auskunft">Intrum bearbeitet Inkassofälle und führt eigene Bonitätsdaten. Wer einmal Post von Intrum hatte, ist meist auch in deren Datenbank – und sollte das prüfen.</Glas></Auf>
        </div>
      </Block>

      <Licht>
        <Block pille="Ihre Rechte" titel={<>Was Sie verlangen <span className="dk-verlauf">können.</span></>}>
          <Zeilen items={[
            ["Auskunft", "Nach Art. 25 DSG (revidiert seit September 2023) kostenlos bei CRIF, Intrum und jedem Unternehmen, das Daten über Sie bearbeitet. Antwort innerhalb von 30 Tagen. Der Betreibungsregisterauszug kostet 17 Franken beim Amt."],
            ["Unbegründete Betreibung sperren", "Art. 8a Abs. 3 lit. d SchKG: Wer innerhalb von drei Monaten nach Zustellung des Zahlungsbefehls Rechtsvorschlag erhebt und der Gläubiger kein Rechtsöffnungsverfahren einleitet, kann beim Betreibungsamt verlangen, dass Dritte die Betreibung nicht mehr sehen."],
            ["Löschung nach Bezahlung", "Eine bezahlte Betreibung bleibt sichtbar – mit Vermerk „bezahlt“. Nur die Rückzugserklärung des Gläubigers lässt sie verschwinden. FIAON bereitet das Gesuch vor; viele Gläubiger unterschreiben gegen Zahlung."],
            ["Berichtigung und Löschung bei CRIF/Intrum", "Falsche oder veraltete Daten sind zu berichtigen oder zu löschen (Art. 32 DSG). Erledigte Forderungen dürfen nicht unbegrenzt gespeichert bleiben."],
            ["Beschwerde", "Der Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB) und die Aufsichtsbehörde des Betreibungsamts (kantonal) – bei Weigerung der Gegenseite."],
          ]} />
        </Block>

        <Block pille="Der Weg mit FIAON" titel={<>Vom Registerauszug <span className="dk-verlauf">zur Karte.</span></>}>
          <Schritte items={[
            { titel: "Auszug und Auskünfte", text: "FIAON beschafft den Betreibungsregisterauszug sowie die Auskünfte bei CRIF und Intrum – mit Vollmacht, ohne Behördengang." },
            { titel: "Jede Betreibung erklärt", text: "Gläubiger, Betrag, Stand, Rechtsvorschlag, Frist. Welche lässt sich sperren, welche zurückziehen, welche bleibt." },
            { titel: "Gesuche und Schreiben", text: "Nichtbekanntgabe nach Art. 8a SchKG, Rückzugserklärung vom Gläubiger, Berichtigung bei CRIF und Intrum – per Einschreiben, mit Frist." },
            { titel: "Konto und Karte", text: "Konto bei einer Partnerbank, Kreditkarte, sobald der Auszug trägt. Die Bank entscheidet – FIAON bereitet vor." },
          ]} />
        </Block>
      </Licht>

      <Block pille="Werkzeuge" titel={<>Kostenlos, <span className="dk-verlauf">sofort.</span></>} mitte>
        <div className="hw-raster">
          <Auf><a href="/werkzeuge/selbstauskunft" className="hw-karte"><span className="hw-tag">Auskunft</span><h3>Fertiger Brief an CRIF und Intrum</h3><p>Art. 25 DSG, richtig formuliert – ausdrucken, unterschreiben, abschicken. Antwort in 30 Tagen.</p><span className="hw-mehr">Brief erstellen</span></a></Auf>
          <Auf verzoegerung={90}><a href="/werkzeuge/verjaehrung" className="hw-karte"><span className="hw-tag">Verjährung</span><h3>Ist die Forderung verjährt?</h3><p>Rechner für deutsche Fristen – für die Schweiz gelten abweichende (OR Art. 127 ff.); der Ansprechpartner prüft.</p><span className="hw-mehr">Rechner öffnen</span></a></Auf>
        </div>
      </Block>

      <Licht>
        <Block schmal pille="Häufige Fragen">
          <Fragen items={[
            { f: "Eine Betreibung war unberechtigt – warum steht sie trotzdem im Auszug?", a: "Weil das Register jede Betreibung einträgt, unabhängig von ihrer Berechtigung. Sichtbar bleibt sie fünf Jahre – es sei denn, Sie lassen sie nach Art. 8a SchKG sperren oder der Gläubiger zieht sie zurück." },
            { f: "Ich habe bezahlt – ist die Betreibung jetzt weg?", a: "Nein, sie trägt den Vermerk „bezahlt“ und bleibt sichtbar. Erst die Rückzugserklärung des Gläubigers entfernt sie. FIAON formuliert das Gesuch – oft als Bedingung der Zahlung." },
            { f: "Gilt die deutsche SCHUFA in der Schweiz?", a: "Nein. Schweizer Banken und Händler fragen Betreibungsregister, CRIF und Intrum ab. Wer aus Deutschland zuzieht, beginnt ohne Historie – und sollte den ersten Auszug früh prüfen." },
            { f: "Bekomme ich mit Betreibungen ein Konto?", a: "Banken dürfen ablehnen; PostFinance führt Konten für Personen mit Wohnsitz in der Schweiz weitgehend unabhängig von Betreibungen. FIAON bereitet die Eröffnung vor." },
            { f: "Wie lange dauert die Nichtbekanntgabe nach Art. 8a?", a: "Das Gesuch ist frühestens drei Monate nach Zustellung des Zahlungsbefehls möglich; das Amt fragt den Gläubiger an, der 20 Tage Zeit hat, ein Verfahren nachzuweisen. Danach wird die Betreibung Dritten nicht mehr angezeigt." },
          ]} />
        </Block>
      </Licht>

      <Zwischenruf text={<><b>Sie sind in der Schweiz?</b> Der Antrag erkennt Ihr Land und beschafft Registerauszug, CRIF- und Intrum-Auskunft.</>} knopf="Auskunft beschaffen" href="/antrag" still={{ knopf: "Österreich", href: "/oesterreich" }} />
      <Abschluss titel={<>Ihr Weg beginnt <span className="dk-verlauf">mit einer E-Mail-Adresse.</span></>} text="Antrag in zwei Minuten, Auskünfte innerhalb von 24 Stunden nach Eingang, ein Mensch, der Sie durch alles Weitere begleitet." knoepfe={<><Knopf href="/antrag">Jetzt starten</Knopf><Knopf href="/preise" still>Preise</Knopf></>} />
    </Dunkel>
  );
}
