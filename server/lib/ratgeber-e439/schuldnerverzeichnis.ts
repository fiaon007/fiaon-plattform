// ═══════════════════════════════════════════════════════════════════════════
// Privat-Ratgeber: Schuldnerverzeichnis — Eintrag prüfen und vorzeitig löschen (27.10.2026, E-439)
//
// Recherche: .arbeit/recherche/privat.md, Prio 1. Quellen am 27.10.2026 selbst geprüft:
// §§ 882b–882h, 802b ZPO und §§ 26, 303a InsO (gesetze-im-internet.de), Service Berlin
// (Selbstauskunft 327028, vorzeitige Löschung 327068), Stadt Heidelberg (Kosten BW),
// Verbraucherzentrale (Stand 30.01.2025), SCHUFA-FAQ Speicherfristen und Hinweise zum
// Schuldnerverzeichnis, BGH I ZR 97/25 (Wiedergabe auf curia.europa.eu).
// Fachprüfung 27.10.2026: alle Quellen erneut geöffnet; BGH jetzt mit Pressemitteilung 233/2025
// (bundesgerichtshof.de) belegt, § 284 AO ergänzt; Unbelegtes („häufigster Weg“, „die meisten
// Anleitungen“, „vorgeschriebene Mahnungen“, Superlative) gestrichen; § 882e Abs. 2 = Erinnerung.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";

export const ARTIKEL: StartArtikel = {
  slug: "schuldnerverzeichnis-eintrag-pruefen-loeschen",
  titel: "Schuldnerverzeichnis: Eintrag prüfen und vorzeitig löschen",
  untertitel: "Drei Jahre steht ein Eintrag im amtlichen Register – es sei denn, Sie weisen etwa nach, dass der Gläubiger vollständig befriedigt ist. Wie Sie selbst nachsehen, was das Gericht als Nachweis annimmt und warum die SCHUFA nicht in jedem Fall im selben Moment leer ist.",
  teaser: "Wie Sie Ihren Eintrag im Vollstreckungsportal finden, wann er nach § 882e ZPO wegfällt, was für die vorzeitige Löschung zählt – und was in der SCHUFA bleibt.",
  kategorie: "eintraege",
  land: "DE",
  keyword: "schuldnerverzeichnis eintrag löschen",
  schlagworte: ["Schuldnerverzeichnis", "§ 882e ZPO", "Vollstreckungsportal", "Eintragungsanordnung", "vorzeitige Löschung", "Gerichtsvollzieher", "SCHUFA"],
  metaTitel: "Schuldnerverzeichnis: Eintrag prüfen und löschen lassen",
  metaBeschreibung: "Eintrag im Schuldnerverzeichnis: So sehen Sie kostenlos nach, wann er nach drei Jahren fällt, wie die vorzeitige Löschung läuft und was die SCHUFA tut.",
  faq: [
    {
      frage: "Wie lange bleibt ein Eintrag im Schuldnerverzeichnis?",
      antwort: "Drei Jahre, gerechnet ab dem Tag der Eintragungsanordnung (§ 882e Abs. 1 ZPO). Danach löscht das zentrale Vollstreckungsgericht den Eintrag von sich aus – ob die Forderung bezahlt ist, spielt für diese Regelfrist keine Rolle. Früher geht es nur in den Fällen des § 882e Abs. 3 ZPO, vor allem mit dem Nachweis, dass der Gläubiger vollständig befriedigt ist.",
    },
    {
      frage: "Reicht es, die Forderung zu bezahlen?",
      antwort: "Nein, die Zahlung allein löscht nichts. Sie müssen sie dem zentralen Vollstreckungsgericht nachweisen. Die Berliner Justiz verlangt dafür eine schriftliche Erklärung des Gläubigers oder seines Vertreters, dass die Forderung vollständig befriedigt ist; die Verbraucherzentrale rät, sich eine Kopie der Eintragungsanordnung vom Gerichtsvollzieher geben zu lassen, weil das Gericht die Zahlung sonst nicht zuordnen kann. Eine Quittung allein, eine Ratenzahlungsvereinbarung oder das bloße Einverständnis des Gläubigers mit der Löschung genügen nicht.",
    },
    {
      frage: "Wie sehe ich nach, ob ich eingetragen bin?",
      antwort: "Über das gemeinsame Vollstreckungsportal der Länder (vollstreckungsportal.de). Sie registrieren sich mit dem Online-Ausweis oder über „Registrierung Auskunft“; im zweiten Fall kommt eine Freischaltnummer per Brief. Als Grund wählen Sie die Auskunft über die eigenen Eintragungen. Diese Selbstauskunft ist kostenlos; fremde Datensätze kosten etwa in Baden-Württemberg 4,50 Euro je Datensatz.",
    },
    {
      frage: "Kostet die vorzeitige Löschung etwas?",
      antwort: "Gebühren fallen dafür nach Angaben der Verbraucherzentrale und der Berliner Justiz nicht an; Berlin weist nur auf mögliche Auslagen für Zustellungen hin. Kosten entstehen allenfalls, wenn Sie sich Unterstützung holen, etwa bei einer Anwältin, einem Anwalt oder einer Plattform wie FIAON, die die Schreiben vorbereitet und versendet. Ist Ihre Lage ernst – mehrere Gläubiger, laufende Pfändung –, ist die kostenlose, staatlich anerkannte Schuldnerberatung die erste Stelle.",
    },
    {
      frage: "Verschwindet der Eintrag dann auch bei der SCHUFA?",
      antwort: "Das Merkmal aus dem Schuldnerverzeichnis löscht die SCHUFA nach eigenen Angaben nach drei Jahren, vorzeitig dann, wenn ihr die Löschung durch das zentrale Vollstreckungsgericht nachgewiesen wird. Ist der Gläubiger selbst Partner der SCHUFA, etwa eine Bank oder ein Telefonanbieter, steht daneben oft sein eigener Eintrag. Der gilt nach Ihrer Zahlung als erledigt und folgt seiner eigenen Frist – nach Angaben der SCHUFA taggenau drei Jahre ab Erledigung. Die Registerlöschung nimmt ihn nicht mit.",
    },
    {
      frage: "Kann ich die Eintragung noch verhindern?",
      antwort: "Solange die Anordnung nicht übermittelt ist, gibt es Wege. Gegen die Eintragungsanordnung können Sie binnen zwei Wochen nach der Bekanntgabe Widerspruch beim zuständigen Vollstreckungsgericht einlegen (§ 882d ZPO); der Widerspruch allein hält die Eintragung nicht auf, auf Antrag kann das Gericht sie aber einstweilen aussetzen. Erfährt der Gerichtsvollzieher vor der Übermittlung, dass die Voraussetzungen fehlen oder weggefallen sind, hebt er die Anordnung auf. Und solange ein Zahlungsplan nach § 802b ZPO festgesetzt und nicht hinfällig ist, greift der Eintragungsgrund nach § 882c Abs. 1 Satz 1 Nr. 3 ZPO nicht. Ob ein Widerspruch in Ihrem Fall Aussicht hat, klären eine Anwältin, ein Anwalt oder die kostenlose Schuldnerberatung.",
    },
  ],
  inhalt: `Ein Brief vom Gerichtsvollzieher mit dem Wort „Eintragungsanordnung“. Eine Absage der Bank mit dem Hinweis auf ein Merkmal aus dem Schuldnerverzeichnis. Oder die Forderung ist längst bezahlt – und der Eintrag steht trotzdem noch da. Ein Eintrag im Schuldnerverzeichnis steht nicht nur im Register: Nach Angaben der Verbraucherzentrale fragen die SCHUFA und andere Auskunfteien das Verzeichnis regelmäßig ab und übernehmen die Einträge. So kann er in Auskünfte einfließen, die etwa Banken einholen.

Zugleich beschreibt das Gesetz den Weg hinaus genau, vor allem in § 882e ZPO. Dieser Text erklärt, was das Verzeichnis ist, wie Sie selbst nachsehen, wann ein Eintrag von allein verschwindet, wie die vorzeitige Löschung funktioniert – und warum Ihre SCHUFA-Auskunft danach nicht in jedem Fall leer ist.

## Was das Schuldnerverzeichnis ist

Das Schuldnerverzeichnis ist ein amtliches Register. Es wird nicht von einer Auskunftei geführt, sondern von der Justiz: In jedem Bundesland gibt es dafür ein zentrales Vollstreckungsgericht (§ 882h Abs. 1 ZPO). Abrufen lässt sich der Inhalt über eine zentrale, länderübergreifende Abfrage im Internet – das gemeinsame Vollstreckungsportal der Länder.

Was in einem Eintrag steht, regelt § 882b ZPO: Name, Vorname und Geburtsname, Geburtsdatum und Geburtsort, Wohnsitz, dazu das Aktenzeichen, das Gericht oder die Behörde, die die Eintragung angeordnet hat, das Datum der Anordnung und ihr Grund. Was dort nicht steht: der Betrag und der Name des Gläubigers. Das ist für später wichtig. Das Gericht, das über eine vorzeitige Löschung entscheidet, kann Ihre Zahlung nur zuordnen, wenn Sie ihm die Unterlagen dazu liefern.

Einsehen darf das Verzeichnis nicht jeder aus Neugier, sondern nur, wer darlegt, die Angaben für einen der Zwecke in § 882f Abs. 1 ZPO zu brauchen. Dazu zählen die Zwangsvollstreckung, die Erfüllung gesetzlicher Pflichten zur Prüfung der wirtschaftlichen Zuverlässigkeit, die Abwendung wirtschaftlicher Nachteile durch nicht erfüllte Zahlungspflichten – und ausdrücklich die Auskunft über die eigenen Eintragungen (Nr. 6).

## Wie ein Eintrag zustande kommt

Eingetragen wird nur auf Anordnung. Drei Stellen dürfen sie treffen (§ 882b Abs. 1 ZPO):

- **der Gerichtsvollzieher** nach § 882c ZPO,
- **eine Vollstreckungsbehörde**, etwa das Finanzamt, nach § 284 Abs. 9 der Abgabenordnung oder einer gleichwertigen Regelung,
- **das Insolvenzgericht**, wenn ein Insolvenzantrag mangels Masse abgewiesen wurde (§ 26 Abs. 2 InsO) oder die Restschuldbefreiung versagt oder widerrufen wurde (§ 303a InsO).

Der Gerichtsvollzieher ordnet die Eintragung von Amts wegen an, wenn einer von drei Gründen vorliegt (§ 882c Abs. 1 ZPO): Sie sind der Pflicht zur Abgabe der Vermögensauskunft nicht nachgekommen, zum Beispiel weil Sie den Termin versäumt haben. Oder die Vollstreckung nach dem Inhalt Ihres Vermögensverzeichnisses würde den Gläubiger offensichtlich nicht vollständig befriedigen. Oder Sie haben nicht binnen eines Monats nach Abgabe der Vermögensauskunft – oder nach der Mitteilung, dass ein vorhandenes Vermögensverzeichnis dem Gläubiger zugeleitet wurde – nachgewiesen, dass der Gläubiger vollständig befriedigt ist. Für das Finanzamt und andere Vollstreckungsbehörden nennt § 284 Abs. 9 AO vergleichbare Gründe.

Der dritte Grund greift nicht, solange ein Zahlungsplan nach § 802b ZPO festgesetzt und nicht hinfällig ist. Einen solchen Plan kann der Gerichtsvollzieher festsetzen, wenn der Gläubiger eine Zahlungsvereinbarung nicht ausgeschlossen hat und Sie glaubhaft darlegen, dass Sie die Raten nach Höhe und Zeitpunkt leisten können. Die Tilgung soll binnen zwölf Monaten abgeschlossen sein. Der Plan wird hinfällig, wenn der Gläubiger unverzüglich widerspricht oder wenn Sie mit einer festgesetzten Zahlung ganz oder teilweise länger als zwei Wochen in Rückstand geraten.

Gegen die Eintragungsanordnung können Sie binnen zwei Wochen nach der Bekanntgabe Widerspruch beim zuständigen Vollstreckungsgericht einlegen (§ 882d Abs. 1 ZPO). Der Widerspruch hält die Vollziehung nicht auf; auf Antrag kann das Gericht aber anordnen, dass die Eintragung einstweilen ausgesetzt wird. Nach Ablauf der Frist übermittelt der Gerichtsvollzieher die Anordnung an das zentrale Vollstreckungsgericht. Erfährt er vorher, dass die Voraussetzungen fehlen oder weggefallen sind, hebt er sie auf und teilt Ihnen das mit. Ob das in Ihrem Fall so ist, entscheidet er. Wer in diesem Zeitraum die vollständige Befriedigung des Gläubigers belegen kann, legt ihm den Nachweis deshalb gleich vor. Ob ein Widerspruch im Einzelfall Aussicht hat, ist eine Rechtsfrage – dafür sind eine Anwältin, ein Anwalt oder die kostenlose Schuldnerberatung die richtige Stelle.

## So sehen Sie nach, ob Sie eingetragen sind

Ihre eigenen Einträge dürfen Sie jederzeit einsehen. Der Weg führt über das Vollstreckungsportal der Länder unter vollstreckungsportal.de. Die Berliner Justiz beschreibt den Ablauf so:

- **Mit Online-Ausweis:** Sie registrieren sich über die Schaltfläche für den neuen Personalausweis; die AusweisApp führt Sie durch die Schritte.
- **Ohne Online-Ausweis:** Sie wählen „Registrierung Auskunft“, füllen die Pflichtfelder aus und bekommen eine E-Mail mit den nächsten Schritten. Die Freischaltnummer für die erste Einsicht kommt danach per Brief an Ihre Anschrift.
- **Bei der Abfrage** wählen Sie als Grund die Auskunft über die Sie selbst betreffenden Eintragungen.
- **Ohne Internet:** Mit der Freischaltnummer können Sie nach Angaben der Berliner Justiz auch persönlich bei einem Amtsgericht als Vollstreckungsgericht einsehen.

Die Selbstauskunft ist kostenlos – so steht es bei der Berliner Justiz und in der Verfahrensbeschreibung der Stadt Heidelberg für Baden-Württemberg. Wer fremde Daten abruft, zahlt dagegen, in Baden-Württemberg 4,50 Euro je übermitteltem Datensatz. Achten Sie also darauf, wirklich den Grund „eigene Eintragungen“ zu wählen. Einzelheiten der Registrierung können je Bundesland abweichen.

Der zweite Blick gehört Ihrer Datenkopie bei der SCHUFA. Nach Art. 15 DSGVO haben Sie ein Recht darauf, die erste Kopie ist unentgeltlich (Art. 15 Abs. 3 DSGVO). Dort sehen Sie, ob die SCHUFA das Merkmal aus dem Register übernommen hat und ob daneben ein Eintrag des Gläubigers selbst steht. Wo Sie die Datenkopien bei SCHUFA und den anderen [Auskunfteien](/auskunfteien) anfordern, zeigt das Werkzeug [Selbstauskunft](/werkzeuge/selbstauskunft).

## Wann der Eintrag von allein verschwindet

Das zentrale Vollstreckungsgericht löscht einen Eintrag nach Ablauf von drei Jahren seit dem Tag der Eintragungsanordnung (§ 882e Abs. 1 ZPO). Maßgeblich ist also das Datum der Anordnung – nicht der Tag, an dem Sie bezahlt haben, und nicht der Tag, an dem Sie den Eintrag entdeckt haben. Die Löschung läuft von allein. Die Verbraucherzentrale weist darauf hin, dass sie unabhängig davon erfolgt, ob die Forderung beglichen ist.

Ein Beispiel: Die Anordnung stammt vom März 2025. Dann endet die Regelfrist im März 2028 – auch wenn die Forderung bis dahin offen bleibt. Wer im April 2025 bezahlt und nichts weiter unternimmt, steht trotzdem bis März 2028 im Register. Genau für diesen Fall gibt es die vorzeitige Löschung.

Über Einwendungen gegen eine Löschung oder ihre Ablehnung entscheidet der Urkundsbeamte der Geschäftsstelle; dagegen ist die Erinnerung nach § 573 ZPO möglich (§ 882e Abs. 2 ZPO). Für das Register selbst brauchen Sie keinen Rechner: Datum der Anordnung plus drei Jahre.

## Vorzeitige Löschung: die drei Wege – und was nicht reicht

§ 882e Abs. 3 ZPO nennt drei Fälle, in denen das zentrale Vollstreckungsgericht einen Eintrag vor Ablauf der drei Jahre löscht:

- **Vollständige Befriedigung:** Ihnen gelingt der Nachweis, dass der Gläubiger vollständig befriedigt ist. Nach der Verbraucherzentrale zählt dazu auch, dass der Gläubiger die Restforderung erlassen hat.
- **Fehlen oder Wegfall des Grundes:** Dem Gericht wird bekannt, dass der Grund für die Eintragung fehlt oder weggefallen ist. Als Nachweis nennt die Berliner Justiz etwa eine Entscheidung, die den Vollstreckungstitel aufhebt oder die Zwangsvollstreckung für unzulässig erklärt.
- **Gerichtliche Entscheidung:** Ihnen liegt eine vollstreckbare Entscheidung vor, aus der sich ergibt, dass die Eintragungsanordnung aufgehoben oder einstweilen ausgesetzt ist.

Daneben gilt § 882e Abs. 4 ZPO: War der Inhalt eines Eintrags von Anfang an fehlerhaft – etwa ein falscher Name oder ein falsches Geburtsdatum –, ändert ihn der Urkundsbeamte der Geschäftsstelle.

Mindestens genauso wichtig ist, was nicht reicht. Die Berliner Justiz schreibt ausdrücklich: Ratenzahlungsvereinbarungen und das bloße Einverständnis des Gläubigers mit einer vorzeitigen Löschung genügen nicht. Die Verbraucherzentrale ergänzt, dass ein Zahlungsnachweis oder eine Quittung allein nicht ausreicht. Die Berliner Justiz verlangt eine schriftliche Erklärung des Gläubigers oder seines Vertreters – bei einem Inkassofall ist das oft das beauftragte Unternehmen –, dass die Forderung vollständig befriedigt ist. Gebühren fallen für die vorzeitige Löschung nach Angaben beider Stellen nicht an; Berlin nennt nur mögliche Auslagen für Zustellungen.

## Schritt für Schritt zur vorzeitigen Löschung

1. **Selbstauskunft holen.** Rufen Sie Ihre Einträge im Vollstreckungsportal ab und notieren Sie je Eintrag Aktenzeichen, Datum der Anordnung, Grund und anordnende Stelle. Jede Eintragungsanordnung ist ein eigener Eintrag – bei mehreren Gläubigern gehen Sie jeden einzeln an.
2. **Eintragungsanordnung heraussuchen.** Ohne sie kann das Gericht Ihren Fall nach Angaben der Verbraucherzentrale nicht zuordnen, weil es Gläubiger und Titel nicht kennt. Fehlt sie, fordern Sie beim Gerichtsvollzieher unter seinem Aktenzeichen eine Kopie an. Berlin nennt außerdem die Ladung zur Vermögensauskunft als Unterlage.
3. **Gesamtforderung erfragen.** Bitten Sie den Gläubiger schriftlich um eine aktuelle Aufstellung: Hauptforderung, Zinsen, Kosten. Vollständig befriedigt heißt: Es ist nichts mehr offen.
4. **Begleichen oder Erlass schriftlich festhalten.** Zahlen Sie den offenen Betrag laut Aufstellung. Erlässt der Gläubiger einen Rest, lassen Sie sich das schriftlich bestätigen.
5. **Erklärung des Gläubigers anfordern.** Bitten Sie um die schriftliche Bestätigung, dass die Forderung vollständig befriedigt ist – mit Ihrem Namen, Geburtsdatum und dem Aktenzeichen des Gerichtsvollziehers.
6. **Antrag an das zentrale Vollstreckungsgericht stellen.** Formlos schriftlich genügt; Berlin stellt zusätzlich ein Formular bereit. Entscheiden tut das zentrale Vollstreckungsgericht des Bundeslandes, in dessen Verzeichnis der Eintrag steht; in Berlin lässt sich der Antrag nach Angaben der Justiz bei jedem Amtsgericht abgeben. Geben Sie die Verfahrensnummer des zentralen Vollstreckungsgerichts an. Anlagen: die Erklärung des Gläubigers, die Kopie der Eintragungsanordnung, wenn vorhanden die Ladung zur Vermögensauskunft.
7. **Nachweisbar versenden und Kopien behalten.** Notieren Sie das Datum des Versands.
8. **Ergebnis kontrollieren.** Prüfen Sie im Portal, ob der Eintrag gelöscht ist. Danach sehen Sie in Ihrer SCHUFA-Datenkopie nach. Steht das Merkmal dort noch, schicken Sie der SCHUFA die Löschungsbestätigung des zentralen Vollstreckungsgerichts.

## Was die Löschung für Ihre SCHUFA bedeutet

In der SCHUFA-Auskunft können zwei verschiedene Einträge zur selben Schuld stehen. Für jeden gilt eine eigene Regel.

**Erstens das Merkmal aus dem Schuldnerverzeichnis.** Die SCHUFA speichert nach eigenen Angaben nur die Tatsache der Eintragung und folgt späteren Änderungen im Register. Ihre Speicherfrist für Daten aus Schuldnerverzeichnissen: nach drei Jahren, vorzeitig, wenn ihr die Löschung durch das zentrale Vollstreckungsgericht nachgewiesen wird. Dazu passt § 882g Abs. 6 ZPO: Wer Abdrucke aus dem Verzeichnis bezieht – dazu gehören Stellen, die daraus nicht öffentliche zentrale Schuldnerverzeichnisse führen –, wird über vorzeitige Löschungen binnen eines Monats unterrichtet und muss den Eintrag in den eigenen Aufzeichnungen unverzüglich löschen. Bleibt das Merkmal nach der Registerlöschung trotzdem stehen, können Sie der SCHUFA nach deren Angaben eine Löschungsbestätigung des zuständigen zentralen Vollstreckungsgerichts schicken; sie prüft den Eintrag dann und berichtigt ihn.

**Zweitens der Eintrag des Gläubigers selbst.** Ist der Gläubiger Partner der SCHUFA – die Verbraucherzentrale nennt Banken, Telekommunikationsanbieter und Versandhändler –, hat er die offene Forderung oft schon vorher gemeldet. Dieser Eintrag ist unabhängig vom Register. Nach Ihrer Zahlung gilt er als erledigt und wird nach den Angaben der SCHUFA taggenau drei Jahre nach der Erledigung gelöscht; das Datum für Ihren Fall rechnet das Werkzeug [Löschfrist](/werkzeuge/loeschfrist) aus. Die vorzeitige Registerlöschung hilft dann in der SCHUFA wenig, schreibt die Verbraucherzentrale. Anders bei Gläubigern, die keine SCHUFA-Partner sind – die Verbraucherzentrale nennt Vermieter, Ärzte und Heilpraktiker: Hier führt die vorzeitige Löschung aus dem Schuldnerverzeichnis nach ihren Angaben auch zur vorzeitigen Löschung bei der SCHUFA.

Der Bundesgerichtshof hat am 18.12.2025 (I ZR 97/25) entschieden, dass die Obergrenze der Speicherdauer für Zahlungsstörungen, die Vertragspartner an eine Auskunftei melden, nicht aus der Löschfrist des Schuldnerverzeichnisses folgt. Als Orientierung für die Abwägung sieht er grundsätzlich die Verhaltensregeln der Wirtschaftsauskunfteien zu Prüf- und Speicherfristen an (Ziffer IV.1 Buchst. b), die der Hessische Beauftragte für Datenschutz und Informationsfreiheit zum 01.01.2025 genehmigt hat; die Besonderheiten des Einzelfalls sind dabei zu berücksichtigen. Nach der Pressemitteilung des Gerichts sehen diese Regeln für ausgeglichene Forderungen grundsätzlich drei Jahre vor. Die Verkürzung auf 18 Monate setzt unter anderem voraus, dass keine Informationen aus dem Schuldnerverzeichnis vorliegen. Wer also im Register gelöscht ist, kann daraus nicht ableiten, dass auch der Eintrag des Gläubigers sofort gehen muss. Ob dieser Eintrag selbst zu Recht gemeldet wurde, ist eine eigene Frage – dazu mehr unter [SCHUFA-Eintrag löschen](/schufa-eintrag-loeschen) und im Werkzeug [Eintrag prüfen](/werkzeuge/eintrag-pruefen).

## Wenn die Lage ernst ist: zuerst die Schuldnerberatung

Ein Eintrag im Schuldnerverzeichnis steht selten allein. Meist ging eine Vollstreckung voraus, oft gibt es mehrere Gläubiger. Wenn Sie nicht alle Forderungen bezahlen können, eine Pfändung läuft oder droht oder Miete und Strom in Gefahr sind, ist der erste Weg die kostenlose, staatlich anerkannte Schuldnerberatung – etwa bei Verbraucherzentralen, Wohlfahrtsverbänden oder Ihrer Kommune. Dort wird mit Ihnen geklärt, welche Forderungen zuerst dran sind, ob ein Vergleich mit den Gläubigern in Frage kommt und ob eine Verbraucherinsolvenz der bessere Weg ist. Die Wartezeit lässt sich nutzen: Selbstauskunft holen, Unterlagen ordnen, Einnahmen und Ausgaben aufschreiben. Dabei helfen der [Pfändungsrechner](/werkzeuge/pfaendungsrechner) und der [Schuldenplan](/werkzeuge/schuldenplan). FIAON ersetzt diese Stelle nicht.

## Was FIAON übernimmt

FIAON ist eine Abo-Plattform für Ihre Bonität – keine Bank, keine Kanzlei, keine Schuldnerberatung. Bei einem Eintrag im Schuldnerverzeichnis heißt das konkret:

- **Einordnen.** Sie fordern Ihre Datenkopie selbst an. FIAON erklärt jede Zeile, auch das Merkmal aus dem Schuldnerverzeichnis, und zeigt, ob daneben ein eigener Eintrag des Gläubigers steht – also, welche der beiden Ebenen von einer Registerlöschung überhaupt erfasst wird.
- **Vorbereiten.** Die Schreiben liegen als Vorlagen bereit: die Bitte an den Gläubiger um die aktuelle Gesamtforderung und um die schriftliche Bestätigung der vollständigen Befriedigung, der Antrag an das zentrale Vollstreckungsgericht mit Anlagenliste und das Schreiben an die Auskunftei mit dem Nachweis der Löschung.
- **Versenden und nachhalten.** Sie prüfen und geben frei, FIAON versendet nachweisbar, legt jede Antwort in Ihre Akte und erinnert an den nächsten Schritt, bis die Auskunftei nachgezogen hat.
- **Blick der Bank.** Die [Bonitätsauswertung](/bonitaetsauskunft) aus Ihren Kontoauszügen zeigt, was eine Bank aus Ihren Konten liest – unabhängig davon, wie lange ein Eintrag noch steht.

Was das kostet und welche Pakete es gibt, steht unter [Preise](/preise); den Überblick für Privatkunden finden Sie unter [Privatkunden](/privatkunden).

## Was nicht geht

- Einen berechtigten Eintrag vor Ablauf der drei Jahre entfernen, ohne dass der Gläubiger befriedigt ist, der Grund weggefallen ist oder eine gerichtliche Entscheidung vorliegt.
- Mit einer Ratenzahlungsvereinbarung, einer Quittung allein oder dem bloßen Einverständnis des Gläubigers die vorzeitige Löschung erreichen.
- Über die Löschung entscheiden. Das tut das zentrale Vollstreckungsgericht – nicht der Gläubiger, nicht FIAON. Niemand kann Ihnen das Ergebnis zusagen.
- Den Eintrag eines SCHUFA-Partners mit der Registerlöschung mitnehmen. Er folgt seiner eigenen Frist.
- Im Einzelfall rechtlich prüfen, ob ein Widerspruch gegen die Eintragungsanordnung Aussicht hat. Das ist Rechtsdienstleistung und gehört zu einer Anwältin, einem Anwalt oder der Schuldnerberatung.
- Einen Kredit beschaffen. FIAON vergibt keine Kredite.

## Das Wichtigste in Kürze

Ein Eintrag im Schuldnerverzeichnis wird drei Jahre nach dem Tag der Eintragungsanordnung gelöscht – vorher nur, wenn Sie dem zentralen Vollstreckungsgericht die vollständige Befriedigung des Gläubigers mit seiner schriftlichen Erklärung nachweisen, der Grund wegfällt oder eine gerichtliche Entscheidung vorliegt. Nachsehen können Sie kostenlos im Vollstreckungsportal. In der SCHUFA verschwindet danach das Merkmal aus dem Register; der eigene Eintrag eines Gläubigers, der SCHUFA-Partner ist, folgt seiner eigenen Frist.

## Quellen

- [§ 882b ZPO – Inhalt des Schuldnerverzeichnisses](https://www.gesetze-im-internet.de/zpo/__882b.html)
- [§ 882c ZPO – Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882c.html)
- [§ 882d ZPO – Widerspruch gegen die Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882d.html)
- [§ 882e ZPO – Löschung](https://www.gesetze-im-internet.de/zpo/__882e.html)
- [§ 882f ZPO – Einsicht in das Schuldnerverzeichnis](https://www.gesetze-im-internet.de/zpo/__882f.html)
- [§ 882g ZPO – Erteilung von Abdrucken](https://www.gesetze-im-internet.de/zpo/__882g.html)
- [§ 882h ZPO – Zuständigkeit, Führung des Verzeichnisses](https://www.gesetze-im-internet.de/zpo/__882h.html)
- [§ 802b ZPO – Gütliche Erledigung, Zahlungsplan](https://www.gesetze-im-internet.de/zpo/__802b.html)
- [§ 284 AO – Vermögensauskunft des Vollstreckungsschuldners](https://www.gesetze-im-internet.de/ao_1977/__284.html)
- [§ 26 InsO – Abweisung mangels Masse](https://www.gesetze-im-internet.de/inso/__26.html)
- [§ 303a InsO – Eintragung in das Schuldnerverzeichnis](https://www.gesetze-im-internet.de/inso/__303a.html)
- [Art. 15 DSGVO – Auskunftsrecht (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [Service Berlin: Schuldnerverzeichnis – Selbstauskunft](https://service.berlin.de/dienstleistung/327028/)
- [Service Berlin: Schuldnerverzeichnis – vorzeitige Löschung beantragen](https://service.berlin.de/dienstleistung/327068/)
- [Stadt Heidelberg: Schuldnerverzeichnis – Einsicht nehmen](https://www.heidelberg.de/-/Verfahrensbeschreibung/schuldnerverzeichnis---einsicht-nehmen/vbid304)
- [Verbraucherzentrale: Vermögensauskunft – das gilt es zu beachten (Stand 30.01.2025)](https://www.verbraucherzentrale.de/wissen/geld-versicherungen/kredit-schulden-insolvenz/vermoegensauskunft-das-gilt-es-zu-beachten-32431)
- [SCHUFA: Wie lange speichert die SCHUFA personenbezogene Daten?](https://www.schufa.de/faq/privatpersonen/daten/wie-lange-speichert-die-schufa-personenbezogene-daten.jsp)
- [SCHUFA: Einträge aus dem Schuldnerverzeichnis in der Auskunft (englische Fassung)](https://www.schufa.de/en/faq/private-individuals/information/why-does-my-information-say-not-complied-with-statement-of-assets-or-satisfaction-of-creditors-excluded.jsp)
- [BGH, Pressemitteilung Nr. 233/2025 zum Urteil vom 18.12.2025 – I ZR 97/25](https://www.bundesgerichtshof.de/SharedDocs/Pressemitteilungen/DE/2025/2025233.html)
- [BGH, Urteil vom 18.12.2025 – I ZR 97/25 (Leitsätze, Wiedergabe auf curia.europa.eu)](https://curia.europa.eu/site/jcms/p1_1000081705/de/bundesgerichtshof-urteil-vom-18-dezember-2025-i-zr-97/25)`,
};
