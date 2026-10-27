// ═══════════════════════════════════════════════════════════════════════════
// Privat-Ratgeber: Ohne SCHUFA-Historie — Bonität von null aufbauen (27.10.2026, E-439)
//
// Recherche: .arbeit/recherche/privat.md, Prio 3. Quellen am 27.10.2026 selbst geprüft:
// SCHUFA-FAQ 42122 (kein Score bei wenigen Daten) und 42123 (Datenkopie vs. Account),
// SCHUFA-Speicherfristen (Girokonto/Kreditkarte: Löschung unmittelbar nach Beendigung),
// SCHUFA-Datenschutz-Information Art. 14 DSGVO (Herkunft der Daten), Verbraucherzentrale
// Niedersachsen 17.08.2026, Verbraucherzentrale NRW 13.03.2026, vzbv-Bericht 18.06.2026,
// ADAC 02.04.2026 (Punktspannen der zwölf Kriterien), §§ 31, 34–37, 48 ZKG, § 17 BMG,
// § 172 TKG, § 551 BGB, § 305 InsO, DSK-Orientierungshilfe Mietinteressent:innen V2.0
// (Januar 2026), BGH PM 199/2009 (VIII ZR 238/08), KSV1870 (Eigenauskunft kostenlos,
// KSV-Auszug 48 €), Die Post (Betreibungsregisterauszug).
// Fachprüfung 27.10.2026: Ablehnungsgründe Basiskonto = §§ 35 bis 37 ZKG (§ 34 Abs. 1), nicht
// nur 35/36; § 36-Titel korrigiert; „Blankobauspardarlehen“ (SCHUFA-Wortlaut); Anfrage-Kriterien
// nach ADAC-Wortlaut; Meldebestätigung als Verbraucherbericht (vzbv); BGH-Urteil mit Primärquelle.
// Bewusst NICHT verwendet: „1,5 % ohne Score“ (nur Such-Auszug, nicht belegbar).
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";

export const ARTIKEL: StartArtikel = {
  slug: "keine-schufa-historie-bonitaet-aufbauen",
  titel: "Ohne SCHUFA-Historie: Bonität von null aufbauen",
  untertitel: "Neu in Deutschland, zurück aus dem Ausland oder gerade 18: Ein leeres Profil ist kein gutes Profil. Was die SCHUFA ohne Daten tut, welche Verträge eine Geschichte anlegen und wie Sie Konto, Handy und Wohnung in der Zwischenzeit regeln.",
  teaser: "Keine SCHUFA-Historie heißt oft: kein Score. Welche Verträge eine Geschichte anlegen, warum Zeit zählt und wie Konto, Handy und Wohnung trotzdem gehen.",
  kategorie: "score",
  land: "DACH",
  keyword: "keine schufa historie",
  schlagworte: ["SCHUFA-Historie", "kein SCHUFA-Score", "neu in Deutschland", "Bonität aufbauen", "Basiskonto", "Datenkopie", "Rückkehrer", "SCHUFA ab 18"],
  metaTitel: "Keine SCHUFA-Historie: So bauen Sie Bonität von null auf",
  metaBeschreibung: "Keine SCHUFA-Historie? Warum ein leeres Profil keinen guten Score bringt, welche Verträge zählen und wie Konto, Handy und Wohnung trotzdem gehen.",
  faq: [
    {
      frage: "Warum habe ich keinen SCHUFA-Score, obwohl ich keine Schulden habe?",
      antwort: "Weil die SCHUFA nur rechnet, wenn sie genug über Sie weiß. Kennt sie Sie gar nicht, gibt es keinen Score. Kennt sie Sie seit weniger als sechs Monaten und ist kein Bankvertrag gemeldet, ebenfalls nicht. Nach sechs Monaten ohne Bankvertrag rechnet sie einen Score, weist das anfragende Unternehmen aber darauf hin, dass nur wenige Informationen vorliegen. Sobald ein laufender oder erledigter Bankvertrag gemeldet ist, etwa ein Girokonto, rechnet sie immer einen vollen Score.",
    },
    {
      frage: "Wird meine Kredithistorie aus dem Ausland übernommen?",
      antwort: "Darauf sollten Sie nicht bauen. Die SCHUFA nennt als Quellen ihre Vertragspartner und öffentliche Verzeichnisse; eine Auskunftei in Ihrem früheren Land führt ihren eigenen Datenbestand. Was die SCHUFA tatsächlich über Sie gespeichert hat, zeigt die kostenlose Datenkopie nach Art. 15 DSGVO.",
    },
    {
      frage: "Welcher Vertrag legt am ehesten eine Historie an?",
      antwort: "Ein Bankvertrag. Die SCHUFA zählt dazu unter anderem Girokonten, Kreditkarten, Leasingverträge, Bürgschaften, Blankobauspardarlehen und Kredite. Für die meisten Menschen ist das Girokonto der Anfang. Positive Daten kommen aber nur an, wenn die Bank an die SCHUFA meldet – fragen Sie bei der Kontoeröffnung danach.",
    },
    {
      frage: "Bekomme ich ohne SCHUFA-Daten überhaupt ein Konto?",
      antwort: "Ja, über das Basiskonto. Nach § 31 ZKG hat jeder Verbraucher mit rechtmäßigem Aufenthalt in der Europäischen Union Anspruch darauf, auch ohne festen Wohnsitz. Die Bank muss den Vertrag spätestens zehn Geschäftstage nach Eingang des Antrags anbieten. Ablehnen darf sie nur aus den Gründen der §§ 35 bis 37 ZKG – eine schwache oder fehlende Bonität gehört nicht dazu.",
    },
    {
      frage: "Was darf der Vermieter verlangen, wenn meine Auskunft fast leer ist?",
      antwort: "Nach der Orientierungshilfe der Datenschutzbehörden (Version 2.0, Januar 2026) darf er, sobald er sich für Sie entschieden hat, Einkommensnachweise verlangen – Gehaltsabrechnung, Kontoauszug oder Steuerbescheid, nicht nötige Angaben geschwärzt. Die vollständige Datenkopie nach Art. 15 DSGVO darf er nicht verlangen, eine Mietschuldenfreiheitsbescheinigung auch nicht. Die Kaution ist nach § 551 BGB auf drei Monatsmieten ohne Betriebskosten begrenzt.",
    },
    {
      frage: "Wie lange dauert es, bis ich eine gute Historie habe?",
      antwort: "Einen vollen Score gibt es, sobald ein Bankvertrag gemeldet ist. Mehrere Kriterien des neuen Scores messen aber das Alter – des ältesten Bankvertrags, der ältesten Kreditkarte und der aktuellen Anschrift. Diese Punkte wachsen nur mit der Zeit. Einen Zeitpunkt, ab dem eine bestimmte Klasse erreicht ist, kann Ihnen niemand nennen.",
    },
    {
      frage: "Hilft es, viele Konten oder Karten auf einmal zu beantragen?",
      antwort: "Nein. Anfragen und Abschlüsse für Konten und Kreditkarten der letzten zwölf Monate sind ein eigenes Kriterium, Anfragen von Telekommunikationsunternehmen, Onlineshops und Händlern ein weiteres. Viele Anträge in kurzer Zeit können dort Punkte kosten. Anfragen löscht die SCHUFA nach zwölf Monaten.",
    },
  ],
  inhalt: `Sie zahlen Ihre Miete pünktlich, haben keine Schulden – und trotzdem lehnt der Onlinehändler den Kauf auf Rechnung ab, der Mobilfunkanbieter möchte eine Kaution, und die Bank sagt bei der Kreditkarte Nein. Der Grund steht oft nicht in einem Eintrag, sondern in einer Lücke: Die SCHUFA weiß zu wenig über Sie. Das betrifft Menschen, die neu nach Deutschland gezogen sind, Deutsche, die nach Jahren im Ausland zurückkommen, und junge Erwachsene mit ihrem ersten eigenen Konto.

Dieser Text erklärt, warum keine Daten nicht dasselbe sind wie gute Daten, welche Verträge eine Historie anlegen und wie Sie in der Zwischenzeit zu Konto, Handy und Wohnung kommen. Und er erklärt, warum Geduld hier kein Trostwort ist, sondern Teil der Rechnung.

## Warum „keine Daten“ kein guter Score ist

Die SCHUFA rechnet nur dann einen Score, wenn sie genug über eine Person weiß. Die Regeln dafür hat sie veröffentlicht:

- **Unbekannt:** Kennt die SCHUFA Sie gar nicht, gibt es keinen Score. Fragt ein Unternehmen an, erfährt es, dass keine Daten vorliegen.
- **Weniger als sechs Monate bekannt, kein Bankvertrag:** kein Score.
- **Mehr als sechs Monate bekannt, kein Bankvertrag:** Es gibt einen Score, aber das anfragende Unternehmen erhält den Hinweis, dass bisher nur wenige Informationen vorliegen.
- **Ein laufender oder erledigter Bankvertrag:** Dann rechnet die SCHUFA immer einen uneingeschränkten Score – unabhängig davon, wie lange sie Sie schon kennt.

Für Minderjährige rechnet die SCHUFA keinen Score, ebenso wenig bei einer offenen Zahlungsstörung. Als Bankverträge nennt sie unter anderem Girokonten, Kreditkarten, Leasingverträge, Bürgschaften, Blankobauspardarlehen und Kredite.

Für ein Unternehmen ist „kein Score“ keine neutrale Auskunft. Es soll über einen Vertrag entscheiden und hat keinen Anhaltspunkt. Wie es damit umgeht, legt jedes Unternehmen selbst fest: Manche verlangen dann Vorkasse, eine Kaution oder weitere Nachweise, andere lehnen ab. Eine leere Akte schützt Sie also nicht. Sie lässt die Frage offen – und offene Fragen werden im Zweifel vorsichtig beantwortet.

## Wer betroffen ist – und aus welchem Grund

**Neu in Deutschland.** Die SCHUFA erhält ihre Daten nach eigenen Angaben von ihren Vertragspartnern – Banken, Kartenanbietern, Händlern, Telekommunikations- und Energieunternehmen – und aus öffentlichen Verzeichnissen wie den Schuldnerverzeichnissen und Insolvenzbekanntmachungen. Eine Auskunftei in Ihrem früheren Land führt ihren eigenen Datenbestand. Was dort über Jahre gewachsen ist, steht deshalb nicht von selbst in Ihrer SCHUFA-Akte. Was die SCHUFA tatsächlich über Sie weiß, zeigt nur die Datenkopie.

**Zurück aus dem Ausland.** Wer früher in Deutschland Konto und Kreditkarte hatte, geht oft davon aus, dass die alte Geschichte noch da ist. Das stimmt nur zum Teil. Daten über störungsfreie Girokonten, Basiskonten und Kreditkarten löscht die SCHUFA nach eigenen Angaben unmittelbar, nachdem das Unternehmen ihr die Beendigung gemeldet hat. Frühere Anschriften bleiben drei Jahre gespeichert. Wer vor dem Wegzug Konto und Karte aufgelöst hat, kommt also häufig mit einer Akte zurück, in der kein Girokonto und keine Kreditkarte mehr steht.

**Gerade volljährig.** Für Minderjährige gibt es keinen Score. Mit 18 beginnt die Historie bei vielen erst – und gerade die Kriterien, die Zeit belohnen, stehen dann naturgemäß weit unten. Die Verbraucherzentrale Niedersachsen weist darauf hin, dass junge Menschen im neuen Score häufig mit einer niedrigeren Einstufung beginnen als ältere, weil ihnen langfristige Verträge und ein Wohnort fehlen, an dem sie schon lange gemeldet sind. Der Verbraucherzentrale Bundesverband hat im Juni 2026 Beschwerden ausgewertet, in denen genau das beklagt wird: Kurze Vertrags- und Wohnhistorien wirken zusammen und drücken den Wert, ohne dass daraus ein höheres Ausfallrisiko ersichtlich wäre.

## Welche Verträge eine Historie anlegen

Seit dem 17. März 2026 rechnet die SCHUFA mit einem neuen Score: 100 bis 999 Punkte aus zwölf Kriterien. Für Unternehmen gilt nach Angaben der SCHUFA eine Übergangsfrist bis Ende 2028. Mehrere Kriterien messen schlicht Zeit – und genau dort steht bei einem leeren Profil die Null.

| Kriterium | Punktspanne |
|---|---|
| Alter der aktuellen Adresse | 0 bis 94 |
| Alter der ältesten Kreditkarte | 0 bis 81 |
| Alter des ältesten Bankvertrags | 0 bis 69 |
| Vorliegen einer Identitätsprüfung | 0 bis 38 |

Beim Kriterium Identitätsprüfung zählt nach Angaben des ADAC eine bestätigte Identität, etwa per Online-Ausweis. Dazu kommen zwei Kriterien, die Anträge zählen: Anfragen und Abschlüsse für Konten und Kreditkarten in den letzten zwölf Monaten (0 bis 117 Punkte) und Bonitätsprüfungen außerhalb des Bankenbereichs, etwa durch Telekommunikationsunternehmen, Onlineshops oder Händler (0 bis 99 Punkte). Viele Anträge in kurzer Zeit können dort Punkte kosten. Anfragen löscht die SCHUFA nach zwölf Monaten. Welche Ihrer Daten in welches Kriterium einfließen, zeigt das Erklär-Werkzeug im kostenlosen SCHUFA-Account.

Daraus folgt eine schlichte Reihenfolge. Den Anfang macht ein Bankvertrag, für die meisten Menschen das Girokonto. Er sorgt dafür, dass die SCHUFA überhaupt einen vollen Score rechnet, und er startet die Uhr beim ältesten Bankvertrag. Eine Kreditkarte startet später eine zweite Uhr. Wichtig dabei: Positive Daten kommen nur an, wenn die Bank sie meldet. Die Verbraucherzentrale Niedersachsen weist darauf hin, dass nicht alle Banken und Sparkassen Kunden der SCHUFA sind und positive Informationen fehlen, wenn Vertragspartner sie nicht übermitteln. Fragen Sie deshalb bei der Kontoeröffnung nach, ob die Bank Vertragspartner der SCHUFA ist.

Pünktlich gezahlte Miete, ein Prepaid-Tarif oder ein Stromvertrag sind keine Bankverträge im Sinne der SCHUFA. Sie machen das Profil nicht „voll“. In Ihren Kontoauszügen sind sie trotzdem sichtbar – und genau dort liest eine Bank, wie Ihr Haushalt läuft.

## Zuerst nachsehen: die Datenkopie

Bevor Sie etwas abschließen, lohnt der Blick in die eigene Akte. Nach Art. 15 DSGVO haben Sie das Recht auf Auskunft und auf eine Kopie Ihrer Daten; die erste Kopie ist kostenlos. Antworten muss die Auskunftei nach Art. 12 Abs. 3 DSGVO grundsätzlich binnen eines Monats. Bei der SCHUFA bestellen Sie die Datenkopie über meineschufa.de. Sie kommt per Post und enthält Ihre gespeicherten Daten und die Scores, die in den letzten zwölf Monaten an Unternehmen übermittelt wurden. Der kostenlose SCHUFA-Account zeigt die Daten digital und ordnet jedes Datum einem Kriterium zu. Für die Anmeldung ist nach Angaben der Verbraucherzentrale Niedersachsen eine Identitätsprüfung nötig – mit Online-Ausweis oder per Brief.

Achten Sie in der Datenkopie auf drei Dinge:

- **Stimmen Name, Geburtsdatum und Anschrift?** Ein falsches Einzugsdatum verkürzt das Alter der aktuellen Adresse. Falsche Daten lassen sich nach Art. 16 DSGVO berichtigen. In einem Bericht des Verbraucherzentrale Bundesverbands schildert ein Verbraucher, die SCHUFA habe ihm die Korrektur des Wohnalters nur gegen Vorlage einer kostenpflichtigen Meldebestätigung angeboten – die Meldebescheinigung griffbereit zu haben, lohnt sich also.
- **Steht ein Bankvertrag darin?** Wenn nicht, obwohl Sie ein Konto haben, meldet Ihre Bank möglicherweise nicht an die SCHUFA.
- **Gibt es Einträge, die Sie nicht kennen?** Dann geht es nicht mehr um Aufbau, sondern um Prüfung. Der [Eintrag-Prüfer](/werkzeuge/eintrag-pruefen) hilft beim Sortieren.

Neben der SCHUFA speichern auch andere Auskunfteien Daten. Die Übersicht [Auskunfteien](/auskunfteien) nennt sie, der [Selbstauskunft-Generator](/werkzeuge/selbstauskunft) schreibt die Briefe.

## Schritt für Schritt: Bonität von null aufbauen

1. **Anmelden.** Wer eine Wohnung bezieht, muss sich nach § 17 Abs. 1 BMG innerhalb von zwei Wochen nach dem Einzug bei der Meldebehörde anmelden. Die Meldebescheinigung brauchen Sie für Konto und Verträge – und im Zweifel für die Berichtigung Ihrer Anschrift.
2. **Datenkopie anfordern.** Kostenlos nach Art. 15 DSGVO. Dann wissen Sie, ob die SCHUFA Sie kennt und was sie gespeichert hat.
3. **Ein Girokonto eröffnen – bei einer Bank, die an die SCHUFA meldet.** Das ist der Bankvertrag, mit dem die SCHUFA einen vollen Score rechnet. Lehnt eine Bank ab, bleibt das Basiskonto.
4. **Den Alltag über dieses Konto führen.** Gehalt, Miete, Strom, Handy: Ein Konto, auf dem Einnahmen und feste Ausgaben regelmäßig sichtbar sind, ist später ein zentraler Nachweis – für Vermieter und für jede Bank, die Kontoauszüge sehen will.
5. **Anträge gezielt stellen.** Jede Anfrage einer Bank, eines Händlers oder eines Mobilfunkanbieters steht zwölf Monate in der Akte und zählt in einem der beiden Anfrage-Kriterien. Wer fünf Anträge auf einmal stellt, um zu sehen, wer zusagt, riskiert dort Punkte.
6. **Eine Kreditkarte, wenn Sie eine brauchen.** Sie startet ein eigenes Zeitkriterium. Reicht die Bonität dafür noch nicht, ist eine [Kreditkarte mit Sicherheitsleistung](/ratgeber/kreditkarte-mit-sicherheitsleistung) ein Weg. Über die Karte entscheidet die Bank.
7. **Alte Verträge behalten.** Der älteste Bankvertrag und die älteste Kreditkarte zählen mit ihrem Alter. Wer das erste Konto auflöst, verliert diese Zeit, denn die SCHUFA löscht die Daten zu einem störungsfreien Girokonto oder einer Kreditkarte, sobald ihr die Beendigung gemeldet ist.
8. **Nach einigen Monaten erneut nachsehen.** Ob die Bank meldet und die Anschrift stimmt, zeigt die nächste Datenkopie oder der SCHUFA-Account; die Daten dort aktualisiert die SCHUFA nach eigenen Angaben in der Regel zum Beginn jedes Quartals.

## Konto, Handy, Wohnung: Wege in der Zwischenzeit

### Konto

Ohne Konto keine Historie – und ohne Historie lehnen manche Banken ab. Für diesen Fall gibt es das Basiskonto. Nach § 31 ZKG hat jeder Verbraucher mit rechtmäßigem Aufenthalt in der Europäischen Union Anspruch darauf, ausdrücklich auch Menschen ohne festen Wohnsitz, Asylsuchende und Menschen ohne Aufenthaltstitel, die aus rechtlichen oder tatsächlichen Gründen nicht abgeschoben werden können. Die Bank muss den Vertrag unverzüglich anbieten, spätestens zehn Geschäftstage nach Eingang des Antrags. Ablehnen darf sie nach § 34 Abs. 1 ZKG nur aus den Gründen der §§ 35 bis 37 ZKG – etwa wenn Sie bereits ein nutzbares Zahlungskonto bei einem Institut in Deutschland haben, wenn sie ihre Sorgfaltspflichten nach dem Geldwäschegesetz nicht erfüllen kann oder wenn sie Ihnen im Jahr vor dem Antrag ein Basiskonto berechtigt gekündigt hat, etwa wegen Zahlungsverzugs. Eine schwache oder fehlende Bonität gehört nicht dazu. Eine Ablehnung muss die Bank in derselben Frist erklären, kostenlos in Textform begründen und auf das Verwaltungsverfahren nach § 48 ZKG bei der Finanzaufsicht hinweisen (§ 34 ZKG). Der [Basiskonto-Helfer](/werkzeuge/basiskonto) zeigt die Frist und den Weg, wenn eine Bank ablehnt; mehr dazu im Ratgeber [Girokonto trotz SCHUFA](/ratgeber/girokonto-trotz-schufa).

### Handy

Schon beim Abschluss eines Mobilfunkvertrags werden Verbraucher regelmäßig auf ihre Bonität geprüft, schreibt der Verbraucherzentrale Bundesverband. Ohne Score entscheidet der Anbieter nach eigenen Regeln. Ein Prepaid-Tarif ist ein Weg für die Zwischenzeit: Sie laden vorab Guthaben auf. Vor der Freischaltung muss der Anbieter nach § 172 Abs. 2 TKG Ihren Namen und Ihr Geburtsdatum anhand eines Ausweisdokuments prüfen, etwa Personalausweis, Reisepass oder Aufenthaltstitel. Ein Prepaid-Tarif ist allerdings kein Bankvertrag und baut keine SCHUFA-Historie auf. Er überbrückt die Zeit, bis die Akte trägt. Weitere Wege stehen im Ratgeber [Handyvertrag trotz SCHUFA](/ratgeber/handyvertrag-trotz-schufa).

### Wohnung

Was ein Vermieter wann fragen darf, beschreibt die Orientierungshilfe der Datenschutzbehörden von Bund und Ländern (Version 2.0, Januar 2026). Sie unterscheidet drei Zeitpunkte: die Besichtigung, die Phase, in der Sie erklären, eine bestimmte Wohnung mieten zu wollen, und die Entscheidung des Vermieters für Sie. Für eine Lage mit dünner Akte sind diese Punkte wichtig:

- **Einkommen nachweisen.** Hat sich der Vermieter für Sie entschieden, darf er Einkommensnachweise verlangen – eine Gehaltsabrechnung, einen Kontoauszug oder einen Einkommensteuerbescheid in Kopie, nicht nötige Angaben geschwärzt. Nach Beruf und Arbeitgeber darf er fragen, nach der Dauer der Beschäftigung nicht.
- **Keine vollständige Datenkopie.** Die Datenkopie nach Art. 15 DSGVO darf der Vermieter nicht verlangen, weil sie weit mehr enthält, als er braucht. Zulässig ist eine Bonitätsauskunft, die eigens für die Anmietung gedacht ist und die Sie selbst bei einer Auskunftei anfordern – der Ratgeber [Bonitätsauskunft für den Vermieter](/ratgeber/bonitaetsauskunft-fuer-vermieter) erklärt die Unterschiede.
- **Keine Pflicht-Bescheinigung vom Vorvermieter.** Ohne eigene Vereinbarung im Mietvertrag müssen frühere Vermieter keine Mietschuldenfreiheitsbescheinigung ausstellen, sondern nur Quittungen über erhaltene Miete (BGH, Urteil vom 30.09.2009, VIII ZR 238/08). Nach der Orientierungshilfe kann der neue Vermieter sie deshalb nicht verlangen.
- **Kaution mit Obergrenze.** Die Mietsicherheit darf nach § 551 BGB höchstens drei Monatsmieten ohne Betriebskosten betragen; eine Geldkaution dürfen Sie in drei gleichen Monatsraten leisten.

Mit einer fast leeren Auskunft tragen die übrigen Nachweise mehr Gewicht. Ein Konto, auf dem Gehalt und feste Ausgaben seit einigen Monaten regelmäßig laufen, ist dann ein gewichtiges Argument.

## Österreich und die Schweiz: andere Register, ähnliche Lage

**Österreich.** Der KSV1870 gibt Privatpersonen auf Antrag nach Art. 15 DSGVO kostenlos Auskunft über die gespeicherten Daten, nach eigenen Angaben in höchstens einem Monat per E-Mail. Der KSV-Auszug, den etwa Firmen oder Behörden sehen wollen, ist ein eigenes Produkt und kostet nach Angaben des KSV1870 48 Euro. Wer neu in Österreich ist, sieht mit der kostenlosen Auskunft, ob dort überhaupt Daten vorliegen. Mehr dazu im Ratgeber [KSV-Auskunft in Österreich](/ratgeber/ksv-auskunft-oesterreich) und auf der Seite [Österreich](/oesterreich).

**Schweiz.** Der Betreibungsregisterauszug zeigt nach Angaben der Post, ob gegen eine Person seit dem Zuzug an den aktuellen Wohnort oder während höchstens der letzten fünf Jahre eine Betreibung eröffnet wurde. Bestellt wird er online für CHF 26.90 oder am Postschalter für CHF 35.00. Für Zugezogene ist er deshalb häufig leer. Das hilft bei der Wohnungssuche, ersetzt aber keine Kreditgeschichte. Einordnung im Ratgeber [Betreibungsauszug in der Schweiz](/ratgeber/betreibungsauszug-schweiz-erklaert) und auf der Seite [Schweiz](/schweiz).

## Geduld: was Zeit bringt – und was nicht

Drei der vier Kriterien aus der Tabelle oben messen das Alter: der Anschrift, der ältesten Kreditkarte, des ältesten Bankvertrags. Daran ist nichts abzukürzen. Kein Produkt macht aus einem Konto, das drei Monate alt ist, eines mit zehn Jahren. Wer das weiß, spart sich Geld für Angebote, die genau das versprechen.

Zeit wirkt, wenn Sie drei Dinge tun: das erste Konto behalten, Anträge gezielt stellen und die Datenkopie gelegentlich prüfen. Zeit wirkt nicht bei falschen Daten. Ein falsches Einzugsdatum oder ein fremder Eintrag wächst sich nicht aus – das muss berichtigt werden.

Ein Umzug setzt das Alter der aktuellen Adresse neu an. Die Verbraucherzentrale NRW kritisiert genau das: Wer ausbildungs- oder berufsbedingt häufiger umzieht, wird schlechter gestellt, obwohl er pünktlich zahlt. Niemand muss für einen Score in einer Wohnung bleiben. Es hilft aber zu wissen, warum der Wert nach einem Umzug zunächst sinken kann.

## Wenn Schulden dazukommen: zuerst die Schuldnerberatung

Wer ohne Historie startet, hat meist keine Einträge. Anders ist es, wenn neben dem Neuanfang Schulden stehen – aus dem Ausland, aus dem Studium oder aus Verträgen, die Sie nicht mehr bedienen können. Dann geht es nicht mehr um Aufbau, sondern um einen Plan für die Schulden. Der erste Weg führt dann zur kostenlosen, staatlich anerkannten Schuldnerberatung, etwa bei Wohlfahrtsverbänden, Kommunen oder Verbraucherzentralen. Anerkannte Stellen dürfen auch die Bescheinigung ausstellen, die für ein Verbraucherinsolvenzverfahren nötig ist; welche Stellen geeignet sind, bestimmen die Länder (§ 305 InsO). Bei manchen Stellen hängt die Kostenfreiheit vom Einkommen ab – bei der Verbraucherzentrale Hamburg etwa ist sie unterhalb bestimmter Einkommensgrenzen kostenlos. Planen Sie Wartezeit ein; dort sind es nach eigenen Angaben derzeit fast vier Monate. FIAON ist keine Schuldnerberatung und ersetzt sie nicht. Einen ersten Überblick gibt der [Schuldenplan](/werkzeuge/schuldenplan).

## Was FIAON übernimmt

FIAON ist eine Abo-Plattform für Ihre Bonität – keine Bank, keine Kanzlei, keine Schuldnerberatung, kein Kreditgeber. Bei einem dünnen Profil heißt das konkret:

- **Einordnen.** Sie fordern Ihre Datenkopien selbst an. FIAON erklärt jede Zeile: ob die SCHUFA Sie kennt, ob ein Bankvertrag gemeldet ist, ob Anschrift und Einzugsdatum stimmen.
- **Vorbereiten und versenden.** Ist etwas falsch – eine alte Anschrift, ein falsches Einzugsdatum, ein Eintrag, der nicht zu Ihnen gehört –, bereitet FIAON das Schreiben an die Auskunftei vor. Sie prüfen und geben frei, FIAON versendet nachweisbar, legt die Antwort in Ihre Akte und behält die Frist der Auskunftei im Blick.
- **Der Blick der Bank.** Wo die SCHUFA noch wenig weiß, zeigt die [FIAON-Bonitätsauswertung](/bonitaetsauskunft), wie eine Bank Ihre eigenen Konten liest. Aus Ihrem Ausweis und Ihren Kontoauszügen der letzten drei Monate entstehen Haushaltsrechnung, die neun Merkmale einer Kreditprüfung, jede Ausgabe nach Empfänger, eine Ampel und Ihr Plan für zwölf Monate; ein Mensch prüft und gibt frei. Die Bonitätsauswertung ist keine Auskunft einer Auskunftei und kein Score. Sie ersetzt die fehlende Historie nicht – sie zeigt Ihnen, was in Ihren Konten für Sie spricht und was eine Bank stören würde, bevor Sie einen Antrag stellen.
- **Der nächste Schritt.** Für neue Paketkunden ist die Bonitätsauswertung im Paket enthalten; sie ist der Schritt vor dem Link unserer Partnerbank für Ihren Kartenantrag. Über Konto, Karte und Rahmen entscheidet die Bank.

Die Auswertung ist für Sie gedacht, nicht als Unterlage, die Sie einem Vermieter geben müssen – was er verlangen darf, steht oben im Abschnitt zur Wohnung. Was das Paket kostet, steht unter [Preise](/preise); den Überblick für Privatkunden finden Sie unter [Privatkunden](/privatkunden).

## Was nicht geht

- Eine SCHUFA-Historie kaufen, übertragen oder abkürzen. Das Alter eines Vertrags wächst nur mit der Zeit.
- Darauf setzen, dass die Zahlungsgeschichte aus dem Ausland mitkommt. Maßgeblich ist, was die SCHUFA von ihren Vertragspartnern und aus öffentlichen Verzeichnissen erhält.
- Einen bestimmten Score oder eine Zusage von Bank, Vermieter oder Mobilfunkanbieter in Aussicht stellen. Die Entscheidung trifft immer das Unternehmen – nicht FIAON.
- Mit vielen Anträgen auf einmal Daten sammeln. Jede Anfrage steht zwölf Monate in der Akte.
- Im Einzelfall rechtlich prüfen, ob eine Ablehnung zulässig war. Das ist Rechtsdienstleistung und gehört zu einer Anwältin, einem Anwalt oder einer Verbraucherzentrale.
- Einen Kredit beschaffen. FIAON vergibt keine Kredite.

## Das Wichtigste in Kürze

Ohne SCHUFA-Historie gibt es oft keinen Score – und „kein Score“ ist für Unternehmen keine gute Nachricht, sondern eine offene Frage. Der erste Bankvertrag, meist das Girokonto bei einer Bank, die an die SCHUFA meldet, sorgt dafür, dass ein voller Score gerechnet wird; ein Basiskonto steht jedem Verbraucher mit rechtmäßigem Aufenthalt in der EU zu. Danach zählt Zeit: das erste Konto behalten, Anträge gezielt stellen, die Datenkopie gelegentlich prüfen. Bis die Akte gewachsen ist, tragen Einkommensnachweise und Kontoauszüge die Last – bei Vermietern genauso wie bei Banken.

## Quellen

- [SCHUFA-FAQ: Warum sehe ich keinen Score? (wenige Daten, Bankverträge, Minderjährige)](https://www.schufa.de/faq/privatpersonen/scoring/warum-sehe-ich-keinen-score.jsp)
- [SCHUFA-FAQ: Unterschied zwischen kostenloser Datenkopie und SCHUFA-Account](https://www.schufa.de/faq/privatpersonen/scoring/wo-liegt-der-unterschied-zwischen-der-kostenlosen-datenkopie-und-dem-schufa-account.jsp)
- [SCHUFA: Neuer SCHUFA-Score – Klassen und Übergangsfrist](https://www.schufa.de/scoring-daten/neuer-score/)
- [SCHUFA: Wie lange speichert die SCHUFA personenbezogene Daten?](https://www.schufa.de/faq/privatpersonen/daten/wie-lange-speichert-die-schufa-personenbezogene-daten.jsp)
- [SCHUFA: Datenschutz-Information nach Art. 14 DSGVO (Herkunft der Daten)](https://www.schufa.de/global/datenschutz-dsgvo/)
- [SCHUFA: Datenkopie nach Art. 15 DSGVO bestellen](https://www.meineschufa.de/service/datenkopie)
- [Verbraucherzentrale Niedersachsen: Neuer SCHUFA-Score verunsichert Verbraucherinnen und Verbraucher (17.08.2026)](https://www.verbraucherzentrale-niedersachsen.de/wissen/digitale-welt/datenschutz/neuer-schufascore-verunsichert-verbraucherinnen-und-verbraucher-125040)
- [Verbraucherzentrale NRW: Neuer Schufa-Score ab 17. März – was sich ändert und was nicht (13.03.2026)](https://www.verbraucherzentrale.nrw/pressemitteilungen/neuer-schufascore-ab-17-maerz-was-sich-aendert-und-was-nicht-118286)
- [vzbv: Der neue SCHUFA-Score – Beschwerden zu Transparenz und Nachvollziehbarkeit (18.06.2026)](https://www.vzbv.de/sites/default/files/2026-07/26-06-03_Bericht_vzbv_Schufa-Scoring.pdf)
- [ADAC: SCHUFA-Score 2026 – die zwölf Kriterien mit Punktspannen (02.04.2026)](https://www.adac.de/produkte/finanzdienstleistungen/finanzratgeber/schufa-score/)
- [Art. 12, 15 und 16 DSGVO (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [§ 17 BMG – Anmeldung bei der Meldebehörde](https://www.gesetze-im-internet.de/bmg/__17.html)
- [§ 31 ZKG – Anspruch auf ein Basiskonto](https://www.gesetze-im-internet.de/zkg/__31.html)
- [§ 34 ZKG – Ablehnung des Antrags auf Abschluss eines Basiskontovertrags](https://www.gesetze-im-internet.de/zkg/__34.html)
- [§ 35 ZKG – Ablehnung wegen eines bereits vorhandenen Zahlungskontos](https://www.gesetze-im-internet.de/zkg/__35.html)
- [§ 36 ZKG – Ablehnung wegen strafbaren Verhaltens oder wegen Verstoßes gegen ein gesetzliches Verbot](https://www.gesetze-im-internet.de/zkg/__36.html)
- [§ 37 ZKG – Ablehnung bei früherer Kündigung wegen Zahlungsverzugs](https://www.gesetze-im-internet.de/zkg/__37.html)
- [§ 48 ZKG – Verwaltungsverfahren](https://www.gesetze-im-internet.de/zkg/__48.html)
- [§ 172 TKG – Daten für Auskunftsersuchen der Sicherheitsbehörden (Abs. 2: Identitätsprüfung bei Prepaid)](https://www.gesetze-im-internet.de/tkg_2021/__172.html)
- [§ 551 BGB – Begrenzung und Anlage von Mietsicherheiten](https://www.gesetze-im-internet.de/bgb/__551.html)
- [Datenschutzkonferenz: Orientierungshilfe zur Einholung von Selbstauskünften bei Mietinteressent:innen, Version 2.0 (Januar 2026)](https://www.datenschutzkonferenz-online.de/media/oh/OH_Einholung_von_Selbstauskuenften_Mietinteressenten_V2.pdf)
- [BGH, Pressemitteilung Nr. 199/2009 zum Urteil vom 30.09.2009, VIII ZR 238/08 (Mietschuldenfreiheitsbescheinigung)](https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2009/2009199.html)
- [§ 305 InsO – Eröffnungsantrag des Schuldners, Bescheinigung einer geeigneten Stelle](https://www.gesetze-im-internet.de/inso/__305.html)
- [Verbraucherzentrale Hamburg: Anmeldung zur Schuldnerberatung](https://www.vzhh.de/themen/schulden/anmeldung-zur-schuldnerberatung)
- [KSV1870 in einfacher Sprache: kostenlose Auskunft nach Art. 15 DSGVO und KSV-Auszug](https://www.ksv.at/unternehmen/ksv-einfacher-sprache)
- [Die Post: Betreibungsregisterauszug bestellen](https://www.post.ch/de/weitere-angebote/behoerdendienstleistungen/betreibungsregisterauszug)`,
};
