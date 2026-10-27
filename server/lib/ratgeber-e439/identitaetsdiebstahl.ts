// ═══════════════════════════════════════════════════════════════════════════
// Privat-Ratgeber: Identitätsdiebstahl und fremde Einträge in der SCHUFA (27.10.2026, E-439)
//
// Recherche: .arbeit/recherche/privat.md, Abschnitt „Prio 2“. Quellen am 27.10.2026 selbst geprüft:
// SCHUFA-Informationsblatt (Stand März 2025, PDF-Text gelesen), SCHUFA-Seite zur Meldung von
// Identitätsbetrug (englische Fassung), DSGVO (EUR-Lex), § 31 BDSG, § 158 StPO, §§ 263, 269 StGB,
// §§ 339, 692, 694, 699, 700 ZPO, § 27 PAuswG, § 305 InsO, Verbraucherzentrale Bundesverband
// (Stand 04.09.2025) und Verbraucherzentrale Niedersachsen (Stand 13.11.2025).
// Nicht übernommen: SCHUFA-Umfragezahl und IdentChecker (nur Such-Auszug, Seite nicht lesbar).
// Fach- und Rechtsprüfung 27.10.2026: alle Quellen erneut geöffnet (EUR-Lex nur über den bekannten
// Wortlaut, Seite für das Prüfwerkzeug gesperrt). Korrigiert: Bezahldienst-Mahnungen = VZ Bundesverband,
// nicht VZ Niedersachsen; Passwortwechsel nur bei fremdem Zugriff; Online-Wache-Bezug auch zum
// Betrugsvorwurf; „rückstandslos“ nicht als deutsches Zitat (Quelle englisch); § 31 BDSG genauer;
// Art. 77 DSGVO = Mitgliedstaat; Bonitätsauswertung nicht „in jedem Paket“; RDG-Grenze geschärft.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";

export const ARTIKEL: StartArtikel = {
  slug: "identitaetsdiebstahl-schufa-eintrag-loeschen",
  titel: "Identitätsdiebstahl und SCHUFA: Fremde Einträge erkennen, bestreiten und löschen lassen",
  untertitel: "Eine Mahnung für ein Handy, das Sie nie bestellt haben, eine Bankanfrage, die Sie nicht kennen: So prüfen Sie Ihre Datenkopie, erstatten Anzeige, widersprechen beim Unternehmen und verlangen Berichtigung und Löschung – Schritt für Schritt, mit den Unterlagen, die SCHUFA und Unternehmen verlangen.",
  teaser: "Fremde Bestellung, unbekannte Anfrage, Inkasso für einen Vertrag, den Sie nie geschlossen haben: die Schritte bei Identitätsdiebstahl bis zum Löschantrag.",
  kategorie: "eintraege",
  land: "DE",
  keyword: "identitätsdiebstahl schufa",
  schlagworte: ["Identitätsdiebstahl", "Identitätsbetrug", "SCHUFA-Datenkopie", "Art. 15 DSGVO", "Strafanzeige", "Art. 16 DSGVO", "Art. 17 DSGVO", "SCHUFA-FraudPool"],
  metaTitel: "Identitätsdiebstahl & SCHUFA: fremde Einträge löschen",
  metaBeschreibung: "Fremde Verträge oder Inkasso in Ihrem Namen? So erkennen Sie Identitätsdiebstahl in der SCHUFA-Datenkopie und gehen Schritt für Schritt bis zum Löschantrag.",
  faq: [
    { frage: "Woran erkenne ich, dass jemand unter meinem Namen Verträge geschlossen hat?", antwort: "Meist an der Post: Rechnungen, Mahnungen oder Inkassoschreiben zu Bestellungen, die Sie nicht kennen. Klarheit bringt die Datenkopie nach Art. 15 DSGVO. Achten Sie dort auf Verträge, Anfragen und Anschriften, die nicht zu Ihnen passen, und auf Zahlungsstörungen unbekannter Unternehmen. Prüfen Sie vorher, ob hinter einem fremden Namen ein Bezahldienst oder eine Bank steht, über die Sie selbst gekauft haben." },
    { frage: "Muss ich eine Forderung aus einem fremden Vertrag bezahlen?", antwort: "Grundsätzlich nein. Wer eine Forderung geltend macht, muss im Streitfall belegen, dass der Vertrag mit Ihnen zustande kam – die Verbraucherzentrale sagt das für Inkassounternehmen ausdrücklich. Ignorieren sollten Sie das Schreiben trotzdem nicht. Bestreiten Sie die Forderung schriftlich und legen Sie die Bestätigung Ihrer Strafanzeige bei. Eine bestrittene Forderung fällt aus der Fallgruppe heraus, nach der offene Forderungen nach zwei Mahnungen ohne Urteil in einen Score-Wert einfließen dürfen (§ 31 Abs. 2 Satz 1 Nr. 4 BDSG)." },
    { frage: "Reicht die Bestätigung der Online-Wache für die SCHUFA?", antwort: "Nicht immer. Nach eigenen Angaben genügt der SCHUFA eine Eingangsbestätigung einer Online-Wache ohne klaren Bezug zu Ihrer Person und zum Betrugsvorwurf nicht. Sie verlangt einen Nachweis der Strafanzeige mit Betrugsvorwurf, etwa eine Bescheinigung der zuständigen Polizeidienststelle. Als Verletzter können Sie nach § 158 Abs. 1 StPO eine schriftliche Bestätigung mit Tatzeit, Tatort und angezeigter Tat beantragen." },
    { frage: "Was bewirkt die Meldung als Identitätsbetrugsopfer bei der SCHUFA?", antwort: "Die SCHUFA speichert den Hinweis in Ihrem Datenbestand und im SCHUFA-FraudPool. Nach ihren Angaben verringert das das Risiko, dass Ihre Daten weiter für Betrugsversuche verwendet werden. Unternehmen, die Ihre Daten abfragen, sehen ihn und prüfen Anträge unter Ihrem Namen gegebenenfalls gesondert. Auf den Score hat der Hinweis nach Angaben der SCHUFA keinen Einfluss. Die Meldung ist freiwillig und jederzeit widerrufbar. Einzelne fremde Einträge löscht sie nicht – dafür braucht es den Antrag nach Art. 16 und 17 DSGVO." },
    { frage: "Werden fremde Einträge in jedem Fall gelöscht?", antwort: "Eine Zusage gibt es nicht. Die SCHUFA gibt an, Negativeinträge, die nachweislich auf Identitätsbetrug beruhen, ohne Rückstände zu löschen. Entscheidend ist der Nachweis: Anzeige mit Aktenzeichen, Ihr schriftliches Bestreiten und möglichst die Angaben des Unternehmens zu Lieferadresse und Kontaktdaten. Lehnt eine Stelle ab, bleibt die Beschwerde bei der Datenschutzaufsicht nach Art. 77 DSGVO." },
    { frage: "Muss ich auch andere Auskunfteien informieren?", antwort: "Ja, wenn dort Einträge stehen. Fordern Sie auch dort die Datenkopie nach Art. 15 DSGVO an. Die Verbraucherzentrale Niedersachsen rät zu einer kostenfreien Auskunft bei der SCHUFA und anderen Auskunfteien und nennt neben der SCHUFA CRIF als Auskunftei, bei der Sie Identitätsmissbrauch melden können. Die Opfermeldung bei der SCHUFA wirkt nur in deren Datenbestand." },
    { frage: "Was kostet das Vorgehen?", antwort: "Die Datenkopie nach Art. 15 DSGVO ist grundsätzlich kostenlos (Art. 12 Abs. 5 DSGVO). Drücken zusätzlich eigene Schulden, hilft die staatlich anerkannte Schuldnerberatung kostenlos. Kosten entstehen, wenn Sie Hilfe in Anspruch nehmen – einen Anwalt oder eine Plattform wie FIAON, die die Schreiben vorbereitet, versendet und die Fristen verfolgt." },
  ],
  inhalt: `Der erste Hinweis ist selten die SCHUFA. Meist ist es ein Brief: eine Mahnung für ein Smartphone, das Sie nie bestellt haben, ein Inkassoschreiben über einen Ratenkauf, von dem Sie nichts wissen, oder die Ablehnung eines Kontos, obwohl Sie immer pünktlich gezahlt haben. Dahinter kann Identitätsdiebstahl stehen: Jemand hat mit Ihrem Namen, Ihrem Geburtsdatum und einer fremden Lieferadresse Verträge geschlossen – und die offenen Rechnungen landen bei Ihnen.

Das Gute vorweg: Für einen Vertrag, den Sie nicht geschlossen haben, schulden Sie grundsätzlich nichts. Die SCHUFA gibt an, Negativeinträge, die nachweislich auf Identitätsbetrug beruhen, ohne Rückstände zu löschen. Entscheidend ist also der Nachweis. Dieser Text zeigt, wie Sie ihn aufbauen – Schritt für Schritt, mit den Unterlagen, die Polizei, Unternehmen und SCHUFA nach eigenen Angaben verlangen.

Ein Hinweis vorab: Wenn neben den fremden Forderungen eigene Schulden drücken, die Sie nicht mehr bedienen können, ist die kostenlose, staatlich anerkannte Schuldnerberatung der richtige erste Weg. Mehr dazu weiter unten.

## Woran Sie fremde Verträge und Einträge erkennen

Identitätsdiebstahl fällt meist an einer von drei Stellen auf.

**In Ihrer Post.** Rechnungen, Mahnungen oder Inkassoschreiben zu Bestellungen, die Sie nicht kennen; Paketbenachrichtigungen; Zahlungsaufforderungen eines Bezahldienstes, bei dem Sie nie ein Konto angelegt haben. Die Verbraucherzentrale Niedersachsen beschreibt das typische Muster: Kriminelle bestellen Waren auf fremden Namen und lassen sie an eine andere Adresse liefern; Rechnung, Mahnung und Inkassoschreiben gehen an die echte Person. Legen die Täter ein Konto bei einem Bezahldienst mit einer von ihnen gewählten E-Mail-Adresse an, sind frühere Mahnungen nach Angaben der Verbraucherzentrale Bundesverband meist nicht bei Ihnen angekommen – oft erfahren Sie erst durch das Inkassounternehmen davon.

**In Ihrem Postfach.** Bestellbestätigungen, Willkommensmails neuer Kundenkonten, Nachrichten über geänderte Passwörter oder Telefonnummern.

**In Ihrer Datenkopie.** Hier wird es konkret. Achten Sie auf:

- Verträge oder Konten, die nicht von Ihnen stammen – Girokonto, Kreditkarte, Mobilfunk, Ratenkauf, Kundenkonto mit Rechnungskauf;
- Anfragen von Banken, Händlern oder Mobilfunkanbietern, mit denen Sie keinen Kontakt hatten;
- Anschriften, unter denen Sie nie gewohnt haben;
- Zahlungsstörungen von Unternehmen, deren Namen Sie nicht kennen;
- abweichende Schreibweisen Ihres Namens oder ein falsches Geburtsdatum bei einzelnen Einträgen.

Nicht jeder unbekannte Name ist Betrug. In der Auskunft steht unter Umständen nicht der Shop, sondern der Bezahldienst oder die Bank, die den Rechnungskauf abgewickelt hat; nach einem Forderungsverkauf kann ein Inkassounternehmen unter eigenem Namen auftreten. Gleichen Sie deshalb jeden unbekannten Eintrag zuerst mit Ihren eigenen Käufen ab. Das Werkzeug [Eintrag prüfen](/werkzeuge/eintrag-pruefen) hilft, die Zeilen einzuordnen.

## Die ersten Schritte: Belege sichern, Zugänge schließen

Bevor Sie den ersten Brief schreiben, sichern Sie, was Sie haben. Bewahren Sie jedes Schreiben mit Umschlag auf, speichern Sie E-Mails vollständig und notieren Sie zu jedem Fall Datum, Unternehmen, Kundennummer und Aktenzeichen. Eine einfache Tabelle reicht. Sie brauchen diese Liste für die Anzeige, für jedes Widerspruchsschreiben und später für die Auskunfteien.

Dann schließen Sie die Türen, durch die die Täter vielleicht gekommen sind. Die Verbraucherzentrale Niedersachsen rät: Hatten Fremde Zugang zu einem wichtigen Konto – etwa E-Mail, Online-Banking, soziale Netzwerke, Online-Bezahldienste oder Kundenkonten –, ändern Sie Zugangsdaten und Passwörter und schalten Sie, wo möglich, die Zwei-Faktor-Anmeldung ein. Beginnen Sie beim E-Mail-Postfach: Über dieses Postfach lassen sich viele andere Passwörter zurücksetzen.

Ist Ihr Personalausweis verloren gegangen oder gestohlen worden, müssen Sie den Verlust unverzüglich der Personalausweisbehörde melden (§ 27 Abs. 1 Nr. 3 PAuswG). Auch diese Meldung gehört in Ihre Unterlagen.

## Die Datenkopie nach Art. 15 DSGVO: das vollständige Bild

Art. 15 DSGVO gibt Ihnen das Recht zu erfahren, welche Daten ein Unternehmen über Sie speichert, woher sie stammen und an wen sie weitergegeben wurden. Die Auskunft ist grundsätzlich kostenlos (Art. 12 Abs. 5 DSGVO). Das Unternehmen muss unverzüglich antworten, spätestens innerhalb eines Monats; wenn es wegen der Komplexität und der Zahl der Anträge nötig ist, darf es die Frist um zwei weitere Monate verlängern, muss Ihnen das aber innerhalb des ersten Monats mit Gründen mitteilen (Art. 12 Abs. 3 DSGVO).

Bei Identitätsdiebstahl nutzen Sie dieses Recht zweimal.

**Bei den Auskunfteien.** Die Datenkopie der SCHUFA bestellen Sie online über meineSCHUFA.de oder telefonisch; sie zeigt die gespeicherten Verträge, Anfragen, Anschriften und Zahlungsstörungen – und später auch, ob Sie als Opfer eines Identitätsbetrugs gemeldet sind. Die Verbraucherzentrale Niedersachsen rät zu einer kostenfreien Auskunft bei der SCHUFA und anderen Auskunfteien und nennt für die Meldung von Identitätsmissbrauch neben der SCHUFA ausdrücklich CRIF; weitere Auskunfteien finden Sie in der [Übersicht der Auskunfteien](/auskunfteien). Wie die Anfrage abläuft, zeigt das Werkzeug [Selbstauskunft](/werkzeuge/selbstauskunft).

**Beim meldenden Unternehmen.** Fragen Sie das Unternehmen, das die fremde Forderung stellt, nach Art. 15 DSGVO, welche Daten zu dem angeblichen Vertrag gespeichert sind: Name, Anschrift, Lieferadresse, E-Mail-Adresse, Telefonnummer, Zeitpunkt der Bestellung. Nach Art. 15 Abs. 1 Buchst. c und g DSGVO muss es auch sagen, an wen die Daten gingen – etwa an ein Inkassounternehmen oder eine Auskunftei – und woher es sie hat, wenn es sie nicht bei Ihnen erhoben hat. Eine fremde Lieferadresse oder eine E-Mail-Adresse, die nicht Ihnen gehört, ist für die Anzeige und für jeden Widerspruch ein wichtiger Anhaltspunkt.

## Strafanzeige: der Nachweis, den alle verlangen

Das Strafgesetzbuch kennt „Identitätsdiebstahl“ nicht als eigenen Tatbestand. Angezeigt wird, was die Täter mit Ihren Daten getan haben – in der Regel Betrug (§ 263 StGB), bei gefälschten Online-Daten auch die Fälschung beweiserheblicher Daten (§ 269 StGB). Sie müssen das nicht selbst einordnen. Schildern Sie, was passiert ist; die Polizei ordnet es zu.

Eine Anzeige können Sie bei jeder Polizeidienststelle, bei der Staatsanwaltschaft oder beim Amtsgericht erstatten (§ 158 Abs. 1 StPO). Die Polizei bietet dafür Online-Wachen an; die Verbraucherzentrale verweist ausdrücklich darauf. Wichtig ist, was Sie danach in der Hand haben. Als Verletzter können Sie verlangen, dass der Eingang Ihrer Anzeige schriftlich bestätigt wird – mit einer kurzen Zusammenfassung von Tatzeit, Tatort und angezeigter Tat (§ 158 Abs. 1 StPO). Beantragen Sie diese Bestätigung ausdrücklich und notieren Sie das Aktenzeichen.

Der Grund: Die SCHUFA verlangt für die Opfermeldung einen Nachweis einer Strafanzeige mit Betrugsvorwurf. Eine Eingangsbestätigung einer Online-Wache ohne klaren Bezug zu Ihrer Person und zum Betrugsvorwurf genügt ihr nach eigenen Angaben nicht; nötig ist eine Bescheinigung der zuständigen Polizeidienststelle. Auch Unternehmen können eine Kopie der Anzeige verlangen, bevor sie einen Eintrag zurücknehmen. Die Verbraucherzentrale Niedersachsen rät, jeden Einzelfall anzuzeigen. Taucht später ein weiterer fremder Vertrag auf, zeigen Sie auch ihn an und nennen Sie das Aktenzeichen der ersten Anzeige.

Zur Ehrlichkeit gehört auch das: Wer einen eigenen, berechtigten Vertrag als Identitätsdiebstahl ausgibt, riskiert selbst ein Strafverfahren. Die SCHUFA weist ausdrücklich darauf hin, dass eine ungerechtfertigte Meldung als Identitätsbetrugsopfer strafrechtliche Folgen haben kann.

## Widerspruch beim Unternehmen und beim Inkasso

Mit dem Aktenzeichen schreiben Sie jedes Unternehmen an, das eine fremde Forderung stellt – den Händler, den Bezahldienst, das Inkassounternehmen. Die Verbraucherzentrale rät, der Forderung unverzüglich und schriftlich zu widersprechen und dem Inkassounternehmen eine Kopie der Anzeige beizulegen. Ignorieren sollten Sie eine Mahnung nach ihren Angaben nicht.

Ein solches Schreiben enthält:

- die Erklärung, dass Sie den Vertrag nicht geschlossen haben und die Forderung bestreiten;
- das Aktenzeichen der Strafanzeige und die Bestätigung in Kopie;
- die Aufforderung, die Mahnungen einzustellen, keine Daten an Auskunfteien zu melden und eine bereits erfolgte Meldung zurückzunehmen;
- Ihr Auskunftsersuchen nach Art. 15 DSGVO zu den Vertragsdaten.

Warum das Bestreiten so wichtig ist: § 31 Abs. 2 BDSG legt fest, welche offenen Forderungen in einen Score-Wert einer Auskunftei einfließen dürfen. Neben Forderungen aus einem Urteil oder einem Schuldtitel nach § 794 ZPO (Satz 1 Nr. 1) gibt es eine Fallgruppe, die auf Mahnungen aufbaut (Satz 1 Nr. 4). Sie verlangt unter anderem mindestens zwei schriftliche Mahnungen nach Fälligkeit, eine erste Mahnung, die mindestens vier Wochen zurückliegt, einen vorherigen Hinweis auf die mögliche Berücksichtigung durch eine Auskunftei – und dass die betroffene Person die Forderung nicht bestritten hat. Ein schriftliches, belegbares Bestreiten ist deshalb Ihr erster Hebel gegen neue Negativeinträge.

Zur Beweislage: Wer eine Forderung geltend macht, muss im Streitfall belegen, dass der Vertrag mit Ihnen zustande kam. Die Verbraucherzentrale formuliert es für das Inkasso ausdrücklich: Das Unternehmen muss den Beweis liefern. Nach Ihrem Widerspruch können Sie weitere bloße Mahnschreiben nach Angaben der Verbraucherzentrale ignorieren – Post vom Gericht nie. Für die Antwort auf ein Inkassoschreiben gibt es das Werkzeug [Inkasso-Antwort](/werkzeuge/inkasso-antwort); welche Angaben ein Inkassounternehmen Ihnen machen muss, steht im Ratgeber [Inkasso: Diese Angaben muss Ihnen das Unternehmen liefern](/ratgeber/inkasso-nachweise-verlangen-13a-rdg).

## Wenn ein Mahnbescheid kommt

Ein Schreiben vom Mahngericht ändert die Lage. Gegen einen Mahnbescheid legen Sie binnen zwei Wochen ab Zustellung Widerspruch ein (§ 692 Abs. 1 Nr. 3 ZPO). Das Gericht prüft im Mahnverfahren nicht, ob die Forderung besteht; darauf weist schon der Mahnbescheid hin (§ 692 Abs. 1 Nr. 2 ZPO). Der Widerspruch kann sich gegen den ganzen Anspruch oder einen Teil richten (§ 694 Abs. 1 ZPO); bei einem Vertrag, den Sie nie geschlossen haben, geht es in der Regel um den ganzen Anspruch. Solange noch kein Vollstreckungsbescheid verfügt ist, wird auch ein verspäteter Widerspruch berücksichtigt (§ 694 Abs. 1 ZPO) – verlassen sollten Sie sich darauf nicht.

Bleibt der Widerspruch aus, kann der Gläubiger einen Vollstreckungsbescheid beantragen (§ 699 ZPO). Er steht einem vorläufig vollstreckbaren Versäumnisurteil gleich (§ 700 Abs. 1 ZPO); dagegen bleibt dann der Einspruch, wieder mit zwei Wochen Frist ab Zustellung, und diese Frist ist eine Notfrist (§ 339 Abs. 1 ZPO). Und: Eine Forderung, für die ein vollstreckbarer Titel vorliegt, darf nach § 31 Abs. 2 Satz 1 Nr. 1 BDSG in einen Score-Wert einfließen – auf Ihr Bestreiten nach Nr. 4 kommt es dann nicht mehr an. Spätestens hier gehört der Fall zu einem Anwalt oder zur Verbraucherzentrale. Einzelheiten stehen im Ratgeber [Mahnbescheid erhalten](/ratgeber/mahnbescheid-erhalten-zwei-wochen-widerspruch) und im Werkzeug [Mahnbescheid](/werkzeuge/mahnbescheid).

## Berichtigung und Löschung nach Art. 16 und 17 DSGVO

Steht ein fremder Vertrag, eine fremde Anschrift oder eine fremde Zahlungsstörung in Ihrer Datenkopie, haben Sie zwei Rechte, die zusammengehören. Art. 16 DSGVO gibt Ihnen das Recht, unrichtige Daten unverzüglich berichtigen zu lassen – und ein Vertrag, den Sie nie geschlossen haben, ist eine unrichtige Angabe zu Ihrer Person. Art. 17 Abs. 1 Buchst. d DSGVO gibt Ihnen ein Recht auf Löschung, wenn Daten unrechtmäßig verarbeitet wurden.

Solange geprüft wird, können Sie zusätzlich nach Art. 18 Abs. 1 Buchst. a DSGVO verlangen, dass die Verarbeitung eingeschränkt wird: Bestreiten Sie die Richtigkeit der Daten, darf der Eintrag für die Dauer der Prüfung nur noch eingeschränkt verwendet werden. Löscht oder berichtigt das meldende Unternehmen die Daten, muss es das grundsätzlich allen Empfängern mitteilen, denen es sie offengelegt hat (Art. 19 DSGVO) – also auch der Auskunftei.

In der Praxis heißt das: Die Löschung beginnt bei dem Unternehmen, das gemeldet hat. Die SCHUFA rät selbst, sich zuerst an dieses Unternehmen zu wenden; parallel können Sie sich direkt an die SCHUFA richten. Legen Sie jedem Antrag die Anzeigebestätigung, eine Kopie Ihres Widerspruchs und – wenn vorhanden – die Antwort des Unternehmens bei. Wie ein Löschantrag aufgebaut ist, zeigt der Ratgeber [Löschantrag gegen einen SCHUFA-Eintrag](/ratgeber/loeschantrag-schufa-eintrag-vorlage-widerspruch); die allgemeinen Wege stehen unter [SCHUFA-Eintrag löschen](/schufa-eintrag-loeschen).

Antwortet niemand oder wird der Antrag abgelehnt, bleibt die Beschwerde bei einer Datenschutzaufsichtsbehörde (Art. 77 DSGVO) – nach dem Gesetz insbesondere in dem Mitgliedstaat, in dem Sie gewöhnlich wohnen oder arbeiten.

## Die Auskunfteien informieren: die Opfermeldung bei der SCHUFA

Unabhängig von einzelnen Einträgen können Sie sich bei der SCHUFA als Opfer eines Identitätsbetrugs melden. Nach dem Informationsblatt (Stand März 2025) und der Internetseite der SCHUFA gilt:

- Sie verwenden ausschließlich das Formular zur Einmeldung für Opfer von Identitätsbetrug, füllen es vollständig aus und schicken es an die dort genannte Adresse – zusammen mit einer Kopie Ihres Ausweises mit Lichtbild (nach der Internetseite Vorder- und Rückseite, gut lesbar) und einem Nachweis über eine Strafanzeige mit Betrugsvorwurf.
- Unvollständige Unterlagen werden nicht berücksichtigt und datenschutzkonform vernichtet; eine Rückmeldung gibt es dann nicht.
- Die schriftliche Bestätigung kommt nach Angaben der SCHUFA in der Regel am folgenden Arbeitstag.
- Gespeichert wird der Hinweis in Ihrem regulären SCHUFA-Datenbestand und im SCHUFA-FraudPool, einer gesonderten Datenbank, über die teilnehmende Unternehmen – in der Regel Kreditinstitute und Finanzdienstleister – Informationen zu Betrugsverdachtsfällen und Betrugsversuchen austauschen.
- Der Hinweis hat keinerlei Einfluss auf die Scoreberechnung.
- Die Meldung ist freiwillig und jederzeit ohne Begründung widerrufbar; der Hinweis wird dann gelöscht.

Der Hinweis hat eine Kehrseite, die Sie kennen sollten: Unternehmen, die Ihre Daten abfragen, sehen ihn und stoßen womöglich eine gesonderte Prüfung an, ob wirklich Sie der Antragsteller sind. Ein eigener Antrag – etwa für ein Konto oder einen Handyvertrag – kann dadurch länger dauern. Zugleich verringert die Meldung nach Angaben der SCHUFA das Risiko, dass Ihre Daten weiter für Betrugsversuche verwendet werden.

Die Opfermeldung ersetzt nicht den Antrag zu einzelnen Einträgen. Sie mahnt Unternehmen zur Vorsicht, löscht aber keine fremde Zahlungsstörung. Dafür braucht es die Schritte des vorigen Abschnitts. Informieren Sie außerdem die anderen Auskunfteien, bei denen fremde Einträge auftauchen.

## Schritt für Schritt: die Reihenfolge

1. **Belege sichern.** Jedes Schreiben, jede E-Mail und jede Paketnachricht aufheben; eine Liste mit Datum, Unternehmen und Aktenzeichen anlegen.
2. **Zugänge schließen.** Hatten Fremde Zugriff, Passwörter ändern, beim E-Mail-Postfach beginnen, Zwei-Faktor-Anmeldung einschalten; einen verlorenen Ausweis der Personalausweisbehörde melden.
3. **Strafanzeige erstatten.** Online oder auf der Wache; die schriftliche Bestätigung mit Tatzeit, Tatort und Tat ausdrücklich beantragen und das Aktenzeichen notieren. Für die SCHUFA braucht es eine Bescheinigung mit Bezug zu Ihrer Person und zum Betrugsvorwurf.
4. **Datenkopien anfordern.** Bei der SCHUFA und den anderen Auskunfteien nach Art. 15 DSGVO, dazu die Auskunft beim meldenden Unternehmen.
5. **Forderungen schriftlich bestreiten.** An Händler, Bezahldienst und Inkasso, mit Aktenzeichen und Anzeigebestätigung; die Rücknahme jeder Meldung an Auskunfteien verlangen.
6. **Gerichtspost sofort beantworten.** Gegen einen Mahnbescheid binnen zwei Wochen ab Zustellung Widerspruch einlegen.
7. **Berichtigung und Löschung beantragen.** Beim Unternehmen und bei der Auskunftei nach Art. 16 und 17 DSGVO, für die Dauer der Prüfung die Einschränkung nach Art. 18 DSGVO.
8. **Opfermeldung bei der SCHUFA.** Formular, Ausweiskopie, Nachweis der Anzeige.
9. **Nachkontrolle.** Nach den Antworten eine neue Datenkopie anfordern und prüfen, ob die fremden Einträge verschwunden sind; bei Ablehnung Beschwerde nach Art. 77 DSGVO.

## Wenn mehr dahintersteckt: die Schuldnerberatung

Identitätsdiebstahl trifft auch Menschen, deren Geld ohnehin knapp ist. Wenn neben den fremden Forderungen eigene Rechnungen offen bleiben, eine Pfändung droht oder Sie nicht mehr wissen, wie Sie über den Monat kommen, ist die kostenlose, staatlich anerkannte Schuldnerberatung der richtige Weg – etwa bei Wohlfahrtsverbänden, Kommunen oder Verbraucherzentralen. Anerkannte Stellen begleiten, wenn nötig, auch den außergerichtlichen Einigungsversuch, den § 305 InsO vor einer Verbraucherinsolvenz verlangt. FIAON ist keine Schuldnerberatung und ersetzt sie nicht. Einen ersten Überblick über Ihre Lage gibt der [Schulden-Check](/werkzeuge/schulden-check).

## Was FIAON übernimmt

FIAON ist eine Abo-Plattform für Ihre Bonität. Bei Identitätsdiebstahl übernimmt FIAON den Teil, der viel Zeit und Nerven kostet: Papier, Reihenfolge und Fristen.

- **Datenkopie erklären.** Sie fordern Ihre Datenkopie selbst an und geben sie FIAON. FIAON erklärt jede Zeile; Verträge, Anfragen, Anschriften und Zahlungsstörungen, die Sie nicht zuordnen können, werden in Ihrer Akte markiert.
- **Schreiben vorbereiten.** Das Bestreiten gegenüber Händler, Bezahldienst und Inkasso, das Auskunftsersuchen nach Art. 15 DSGVO an das meldende Unternehmen, die Anträge auf Einschränkung, Berichtigung und Löschung an die Auskunfteien – jeweils mit Ihrem Aktenzeichen und den passenden Anlagen. Grundlage sind Ihre eigenen Angaben: Dass Sie einen Vertrag nicht geschlossen haben, erklären Sie selbst.
- **Versenden und Fristen halten.** Sie geben jedes Schreiben frei, FIAON versendet es per Einschreiben, verfolgt Antwort und Frist und bereitet die Beschwerde bei der Datenschutzaufsicht vor, wenn eine Antwort ausbleibt oder abgelehnt wird.
- **Eine Akte für alle Fälle.** Aktenzeichen, Belege, Schreiben und Antworten liegen an einem Ort – wichtig, wenn Wochen später der nächste fremde Vertrag auftaucht.
- **Nachkontrolle.** Liegt eine neue Datenkopie vor, erklärt FIAON auch sie – so sehen Sie, ob die fremden Einträge verschwunden sind und ob Neues dazugekommen ist.

Dazu kommt die [FIAON-Bonitätsauswertung](/bonitaetsauskunft) aus Ihren Kontoauszügen: Sie zeigt Ihre Bonität aus Sicht einer Bank – unabhängig davon, was bei den Auskunfteien steht. Sie ist keine Auskunft einer Auskunftei und kein Score. Die Pakete finden Sie unter [Preise](/preise), den Überblick für Privatkunden unter [Privatkunden](/privatkunden). Wie ein regelmäßiger Abgleich neue Einträge früh sichtbar macht, erklärt der Ratgeber [Bonität überwachen](/ratgeber/bonitaet-monitoring-warum).

## Was nicht geht

- **Eine Löschung zusagen.** Ob ein Eintrag fällt, entscheiden das meldende Unternehmen und die Auskunftei – nach der Beweislage. FIAON bereitet die Nachweise auf, entscheidet aber nicht.
- **Die Strafanzeige stellen.** Das tun Sie selbst, bei der Polizei oder online. Auch das Opferformular der SCHUFA füllen Sie selbst aus.
- **Eigene Verträge zu Betrug erklären.** Ein berechtigter Eintrag bleibt berechtigt. Wer ihn als Identitätsdiebstahl ausgibt, riskiert ein Strafverfahren.
- **Den Score über die Opfermeldung bewegen.** Der Hinweis hat nach Angaben der SCHUFA keinerlei Einfluss auf die Scoreberechnung. Es geht allein um die Löschung der fremden Negativeinträge, über die das meldende Unternehmen und die Auskunftei entscheiden.
- **Die Rechtslage im Einzelfall prüfen.** Ob eine Forderung rechtlich besteht, prüft FIAON nicht. Die Schreiben beruhen auf Ihren Angaben und Unterlagen.
- **Vor Gericht vertreten.** FIAON ist keine Kanzlei und erbringt keine Rechtsdienstleistung. Kommt es zu einem Gerichtsverfahren, gehört der Fall zu einem Anwalt; die Verbraucherzentralen helfen bei der Einschätzung.
- **Künftigen Missbrauch ausschließen.** Niemand kann verhindern, dass Ihre Daten erneut benutzt werden. Was hilft, ist, es früh zu bemerken.
- **Kredite vergeben oder Schulden übernehmen.** FIAON vergibt keine Kredite und ist keine Schuldnerberatung.

## Quellen

- [SCHUFA: Informationsblatt zur Meldung als Identitätsbetrugsopfer (Stand März 2025)](https://www.schufa.de/media/dokumente/informationsblatt_identitaetsbetrug_2503.pdf)
- [SCHUFA: Einmeldung von Identitätsbetrug (englische Fassung) – Unterlagen, Online-Wache, Löschung von Negativeinträgen](https://www.schufa.de/en/contact-us/registration-identity-fraud/index.jsp)
- [Datenschutz-Grundverordnung (EU) 2016/679, Art. 12, 15 bis 19 und 77 (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [§ 31 BDSG – Schutz des Wirtschaftsverkehrs bei Scoring und Bonitätsauskünften](https://www.gesetze-im-internet.de/bdsg_2018/__31.html)
- [§ 158 StPO – Strafanzeige, Strafantrag](https://www.gesetze-im-internet.de/stpo/__158.html)
- [§ 263 StGB – Betrug](https://www.gesetze-im-internet.de/stgb/__263.html)
- [§ 269 StGB – Fälschung beweiserheblicher Daten](https://www.gesetze-im-internet.de/stgb/__269.html)
- [§ 692 ZPO – Mahnbescheid](https://www.gesetze-im-internet.de/zpo/__692.html)
- [§ 694 ZPO – Widerspruch gegen den Mahnbescheid](https://www.gesetze-im-internet.de/zpo/__694.html)
- [§ 699 ZPO – Vollstreckungsbescheid](https://www.gesetze-im-internet.de/zpo/__699.html)
- [§ 700 ZPO – Einspruch gegen den Vollstreckungsbescheid](https://www.gesetze-im-internet.de/zpo/__700.html)
- [§ 339 ZPO – Einspruchsfrist](https://www.gesetze-im-internet.de/zpo/__339.html)
- [§ 27 PAuswG – Pflichten des Ausweisinhabers](https://www.gesetze-im-internet.de/pauswg/__27.html)
- [§ 305 InsO – Eröffnungsantrag des Schuldners](https://www.gesetze-im-internet.de/inso/__305.html)
- [Verbraucherzentrale: Was tun, wenn Kriminelle in Ihrem Namen einkaufen? (Stand 04.09.2025)](https://www.verbraucherzentrale.de/wissen/digitale-welt/onlinedienste/was-tun-wenn-kriminelle-in-ihrem-namen-einkaufen-75174)
- [Verbraucherzentrale Niedersachsen: Identitätsdiebstahl – unerklärliche Post vom Inkassounternehmen (Stand 13.11.2025)](https://www.verbraucherzentrale-niedersachsen.de/wissen/digitale-welt/datenschutz/identitaetsdiebstahl-unerklaerliche-post-vom-inkassounternehmen-so-reagieren-sie-richtig-120390)`,
};
