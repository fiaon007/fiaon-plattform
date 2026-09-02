// ═══════════════════════════════════════════════════════════════════════════
// Zehn Ratgeber zu den zehn neuen Werkzeugen — Teil 1 (02.09.2026, E-080)
//
// Justin: „10 hoch konvertierende Artikel für den Ratgeber UND mit wirklich
// helfenden Werkzeugen, veröffentliche diese direkt."
//
// Regeln (wie bei den Insider-Artikeln): jede Zahl mit Quelle und Jahr,
// Sie-Form, keine Schuldnerberatung, keine Garantie, kein „Score verbessern“,
// ehrlicher Abschnitt „Was nicht geht“. Jeder Artikel führt zu genau EINEM
// Werkzeug und zu genau einer Pfeilerseite; der Prüfstand läuft beim Insert.
// Autorin: Johanna Brecht (AUTORIN aus shared/fiaon-ratgeber.ts).
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "./fiaon-ratgeber-start";

export const WERKZEUG_ARTIKEL_1: StartArtikel[] = [
  {
    slug: "loeschantrag-schufa-eintrag-vorlage-widerspruch",
    titel: "Löschantrag gegen einen SCHUFA-Eintrag: Welche vier Begründungen tragen – und wie das Schreiben aussieht",
    untertitel: "Ein Löschantrag ist kein Bittbrief. Er ist ein Rechtsanspruch – wenn einer von vier Gründen vorliegt. Welche das sind, was in den Brief gehört und was passiert, wenn die Auskunftei nicht antwortet.",
    teaser: "Vier Gründe machen einen Eintrag angreifbar: fehlende Mahnungen, bestrittene Forderung, abgelaufene Frist, falsche Daten. Für jeden gibt es den passenden Antrag – mit Paragrafen, Frist und Eskalation.",
    kategorie: "eintraege", land: "DE", keyword: "löschantrag schufa vorlage",
    schlagworte: ["Löschantrag", "Widerspruch SCHUFA", "Art. 17 DSGVO", "§ 31 BDSG", "Musterbrief", "Datenschutzaufsicht"],
    metaTitel: "Löschantrag SCHUFA-Eintrag: Vorlage und vier Gründe",
    metaBeschreibung: "Vier Gründe machen einen SCHUFA-Eintrag angreifbar: fehlende Mahnungen, bestrittene Forderung, Frist abgelaufen, falsche Daten. Der Löschantrag mit Generator.",
    faq: [
      { frage: "Kann ich jeden SCHUFA-Eintrag löschen lassen?", antwort: "Nein. Ein inhaltlich richtiger und zulässig gemeldeter Eintrag bleibt bis zum Ablauf der Speicherfrist stehen – daran ändert kein Schreiben etwas. Angreifbar ist ein Eintrag, wenn die Meldung die Voraussetzungen des § 31 Abs. 2 BDSG nicht erfüllt hat, wenn die Daten unrichtig sind oder wenn die Löschfrist abgelaufen ist." },
      { frage: "An wen schicke ich den Löschantrag?", antwort: "An die Auskunftei, die die Daten speichert – sie ist datenschutzrechtlich verantwortlich und muss innerhalb eines Monats antworten (Art. 12 Abs. 3 DSGVO). Parallel lohnt ein Schreiben an den Gläubiger, der die Meldung veranlasst hat: Er kann sie selbst zurücknehmen, und das geht oft schneller." },
      { frage: "Was mache ich, wenn die Auskunftei ablehnt?", antwort: "Beschwerde bei der zuständigen Datenschutzaufsichtsbehörde nach Art. 77 DSGVO – für die SCHUFA ist das der Hessische Beauftragte für Datenschutz und Informationsfreiheit. Das Verfahren ist kostenlos. Zusätzlich gibt es den SCHUFA-Ombudsmann als Schlichtungsstelle." },
      { frage: "Brauche ich einen Anwalt?", antwort: "Für den Antrag selbst nicht – er ist ein formloses Schreiben mit klarem Verlangen und Frist. Ein Anwalt wird sinnvoll, wenn die Auskunftei die Löschung trotz eindeutiger Rechtslage verweigert oder wenn Schadensersatz nach Art. 82 DSGVO im Raum steht. FIAON arbeitet mit anwaltlich geprüften Vorlagen und übernimmt Versand und Nachverfolgung." },
      { frage: "Wie lange dauert es, bis der Eintrag weg ist?", antwort: "Die Auskunftei hat einen Monat für die Antwort; in der Praxis dauert die Prüfung bei klaren Fällen zwei bis vier Wochen, bei Rückfragen an den Gläubiger länger. Nach der Löschung rechnet der neue SCHUFA-Score (seit März 2026) beim nächsten Abruf ohne den Eintrag – die Zahl ändert sich also, sobald die Auskunftei die Daten geändert hat." },
    ],
    inhalt: `Die Datenkopie liegt auf dem Tisch, und da steht er: ein Eintrag über eine Forderung, die längst bezahlt ist, oder eine, von der Sie nie eine Mahnung gesehen haben. Die meisten Menschen tun jetzt eines von zwei Dingen. Sie rufen bei der Auskunftei an – und erfahren, dass am Telefon nichts geprüft wird. Oder sie schreiben einen Brief, der mit „Ich bitte Sie höflich“ beginnt und mit „Vielen Dank im Voraus“ endet, und der in der Ablage verschwindet.

Ein Löschantrag ist kein Bittbrief. Er ist die Geltendmachung eines Rechts, das die DSGVO Ihnen gibt – und er wirkt, wenn er einen der vier Gründe benennt, die eine Auskunftei tatsächlich zur Löschung verpflichten. Dieser Text erklärt die vier Gründe, zeigt, was in das Schreiben gehört, und sagt ehrlich, wo die Grenze liegt.

## Was das Gesetz von einer Meldung verlangt

Eine offene Forderung darf nur dann an eine Auskunftei gemeldet werden, wenn die Voraussetzungen des § 31 Abs. 2 BDSG erfüllt sind. Für den häufigsten Fall – die nicht titulierte, nicht anerkannte Forderung – heißt das nach Nr. 4 der Vorschrift: Die Forderung muss fällig sein, der Schuldner muss **mindestens zweimal schriftlich gemahnt** worden sein, zwischen der ersten Mahnung und der Meldung müssen **mindestens vier Wochen** liegen, der Schuldner muss **rechtzeitig, mindestens aber in der ersten Mahnung, auf die bevorstehende Meldung hingewiesen** worden sein – und er darf die Forderung **nicht bestritten** haben.

Jede dieser Voraussetzungen ist ein möglicher Angriffspunkt. Fehlt eine, war die Meldung unzulässig – und unzulässig verarbeitete Daten sind nach Art. 17 Abs. 1 Buchst. d DSGVO zu löschen. Das ist kein Ermessen der Auskunftei, sondern eine Pflicht.

*Quelle: § 31 Abs. 2 BDSG; Art. 17 DSGVO.*

## Grund 1: Die zwei Mahnungen fehlen

Der häufigste Fall in der Praxis. Ein Versandhändler oder ein Mobilfunkanbieter übergibt an ein Inkassounternehmen, das Inkassounternehmen meldet – und der Betroffene hat vorher eine einzige Zahlungserinnerung gesehen, oft an eine alte Adresse. Die Meldung setzt zwei Mahnungen mit vier Wochen Abstand voraus. Wer sie nicht erhalten hat, kann verlangen, dass der Gläubiger sie vorlegt. Kann er das nicht, ist die Meldung unzulässig.

Wichtig für den Antrag: Sie müssen nicht beweisen, dass keine Mahnungen kamen. Sie erklären, dass Sie keine erhalten haben, und verlangen die Vorlage. Die Beweislast für die Voraussetzungen der Meldung liegt beim Meldenden.

## Grund 2: Sie hatten widersprochen

Bestrittene Forderungen dürfen nicht gemeldet werden (§ 31 Abs. 2 Nr. 4 Buchst. d BDSG). Ein Widerspruch muss nicht juristisch begründet sein – ein Schreiben mit dem Inhalt „Ich bestreite diese Forderung, ich habe nichts bestellt“ genügt. Entscheidend ist, dass er vor der Meldung zugegangen ist und dass Sie das belegen können. Deshalb der Rat, der in jedem Ratgeber zum Thema Inkasso steht: schriftlich, nachweisbar, nie am Telefon.

Ist gemeldet worden, obwohl Sie widersprochen hatten, ist die Meldung von Anfang an rechtswidrig. Der Löschantrag benennt das Datum Ihres Widerspruchs und verlangt die Löschung nach Art. 17 Abs. 1 Buchst. d DSGVO.

## Grund 3: Die Löschfrist ist abgelaufen

Erledigte Forderungen werden nach den Verhaltensregeln der Wirtschaftsauskunfteien, die seit 2024 gelten, taggenau drei Jahre nach dem Erledigungsdatum gelöscht. Wer eine gemeldete Forderung innerhalb von 100 Tagen nach der Meldung vollständig ausgleicht und keine weiteren Negativmerkmale hat, ist nach 18 Monaten raus. Die Restschuldbefreiung nach einer Insolvenz wird sechs Monate nach ihrer Erteilung gelöscht – das hat der Bundesgerichtshof 2023 bestätigt.

Steht ein Eintrag nach Ablauf dieser Fristen noch, ist die weitere Speicherung nicht mehr erforderlich – Löschgrund nach Art. 17 Abs. 1 Buchst. a DSGVO. Der [Löschfrist-Rechner](/werkzeuge/loeschfrist) nennt das taggenaue Datum; steht es in der Vergangenheit, gehört das Datum in den Antrag.

*Quelle: Verhaltensregeln für die Prüf- und Löschfristen von personenbezogenen Daten durch die deutschen Wirtschaftsauskunfteien (Stand 2024); BGH, Urteil vom 27.03.2024, VI ZR 1370/20 (Restschuldbefreiung).*

## Grund 4: Die Daten sind falsch

Falscher Betrag, falsches Datum, die Forderung eines Namensvetters, doppelt gemeldet – einmal vom Gläubiger, einmal vom Inkasso –, oder eine bezahlte Forderung ohne Erledigt-Vermerk. Unrichtige Daten sind nach Art. 16 DSGVO unverzüglich zu berichtigen. Hier ist der Antrag ein Berichtigungsantrag, hilfsweise ein Löschantrag: Kann die Auskunftei die Richtigkeit nicht belegen, muss sie löschen.

Ein besonders häufiger Fall ist der fehlende Erledigt-Vermerk. Die Forderung ist bezahlt, aber der Gläubiger hat die Erledigung nie nachgemeldet. Für Banken sieht das wie eine offene Forderung aus. Der Antrag verlangt hier den Erledigt-Vermerk mit dem Zahlungsdatum – denn erst dieses Datum startet die Dreijahresfrist.

## Was in das Schreiben gehört

Ein wirksamer Löschantrag ist kurz und hat sechs Bestandteile: Ihre vollständigen Daten mit Geburtsdatum (sonst kann die Auskunftei Sie nicht zuordnen); die Bezeichnung des Eintrags (Gläubiger, Betrag, Kennzeichen); den Grund mit der Rechtsgrundlage; das klare Verlangen – Löschung oder Berichtigung; eine Frist, sinnvoll sind vier Wochen; und die Ankündigung, was bei Fristablauf folgt.

Dazu zwei Zusätze, die oft vergessen werden: die Bitte um Mitteilung, an welche Vertragspartner der Eintrag in den letzten zwölf Monaten übermittelt wurde (Art. 15 Abs. 1 Buchst. c DSGVO), und die Aufforderung, diese Empfänger über die Löschung zu informieren (Art. 19 DSGVO). Denn ein gelöschter Eintrag nützt wenig, wenn die Bank ihn noch in ihrer eigenen Akte hat.

Der [Widerspruch-Generator](/werkzeuge/widerspruch) setzt aus Ihrem Grund und Ihren Angaben beide Schreiben zusammen – das an die Auskunftei und das an den Gläubiger. Beides sind Mustertexte zum Selbst-Anpassen; sie ersetzen keine Prüfung Ihres Einzelfalls.

## Was passiert, wenn nichts passiert

Die Auskunftei muss innerhalb eines Monats antworten (Art. 12 Abs. 3 DSGVO). Kommt nichts, oder kommt eine Ablehnung ohne Begründung, steht der Weg zur Aufsichtsbehörde offen: Beschwerde nach Art. 77 DSGVO, für die SCHUFA beim Hessischen Beauftragten für Datenschutz und Informationsfreiheit. Das Verfahren ist kostenlos und dauert Wochen bis Monate – aber es hat Gewicht, weil die Behörde Löschungen anordnen und Bußgelder verhängen kann.

Parallel gibt es den Ombudsmann der SCHUFA, eine Schlichtungsstelle, die ebenfalls kostenlos arbeitet. Und in klaren Fällen bleibt die Klage auf Löschung, verbunden mit Schadensersatz nach Art. 82 DSGVO – der Europäische Gerichtshof hat 2023 klargestellt, dass auch immaterieller Schaden ersatzfähig ist, ohne Bagatellgrenze.

*Quelle: Art. 12, 77, 82 DSGVO; EuGH, Urteil vom 04.05.2023, C-300/21.*

## Was nicht geht

Ehrlich gesagt: Der berechtigte Eintrag bleibt. Wer eine Rechnung nach zwei Mahnungen mit Hinweis nicht bezahlt hat und gemeldet wurde, hat keinen Löschanspruch vor Fristablauf – und wer Ihnen das Gegenteil verspricht, verkauft Hoffnung. Was in diesem Fall hilft, ist der Ausgleich der Forderung innerhalb von 100 Tagen nach der Meldung, weil das die Frist auf 18 Monate verkürzt, und danach eine saubere Zahlungshistorie.

Aus der FIAON-Praxis: Bei den Auskünften, die wir prüfen, ist ein erheblicher Teil der Negativeinträge in mindestens einem Punkt angreifbar – fehlende zweite Mahnung, fehlender Erledigt-Vermerk, abgelaufene Frist. Das ist keine Statistik, sondern eine Beobachtung aus Akten. Sie erklärt, warum sich die Prüfung lohnt, auch wenn das Ergebnis manchmal „berechtigt“ lautet.

## So gehen Sie vor

Erst die Datenkopie anfordern – kostenlos nach Art. 15 DSGVO, der [Selbstauskunft-Generator](/werkzeuge/selbstauskunft) schreibt den Brief. Dann jeden Eintrag durch den [Eintrag-Prüfer](/werkzeuge/eintrag-pruefen) laufen lassen, der die fünf entscheidenden Fragen stellt. Für jeden angreifbaren Eintrag den Antrag erzeugen, per Einschreiben an Auskunftei und Gläubiger, Zugang notieren, vier Wochen warten. Kommt die Löschung: neue Datenkopie anfordern und nachsehen. Kommt sie nicht: Aufsichtsbehörde.

Wer das nicht selbst nachhalten will, gibt es ab: FIAON prüft die Auskunft, versendet anwaltlich geprüfte Schreiben per Einschreiben, verfolgt die Antworten und eskaliert bei Bedarf – Sie geben frei, wir tun den Rest. Der Unterschied zum kostenlosen Muster ist nicht der Text, sondern die Verfolgung. Mehr dazu auf der Seite [SCHUFA-Eintrag löschen lassen](/schufa-eintrag-loeschen).`,
  },
  {
    slug: "mahnbescheid-erhalten-zwei-wochen-widerspruch",
    titel: "Mahnbescheid erhalten: Zwei Wochen, ein Kreuz – und warum das Gericht nichts geprüft hat",
    untertitel: "Der gelbe Umschlag vom Amtsgericht wirkt wie ein Urteil. Er ist das Gegenteil: ein ungeprüfter Antrag mit einer Frist. Was Sie in den 14 Tagen tun müssen, was danach passiert und wann es wirklich ernst wird.",
    teaser: "Ein Mahnbescheid wird nicht geprüft, nur zugestellt. Zwei Wochen für den Widerspruch entscheiden, ob eine Forderung 30 Jahre vollstreckbar wird. Fristen, Formular, Folgen.",
    kategorie: "inkasso", land: "DE", keyword: "mahnbescheid erhalten was tun",
    schlagworte: ["Mahnbescheid", "Widerspruch", "Vollstreckungsbescheid", "§ 694 ZPO", "Mahngericht", "Frist"],
    metaTitel: "Mahnbescheid erhalten: Frist, Widerspruch, Folgen",
    metaBeschreibung: "Mahnbescheid erhalten: Zwei Wochen Widerspruchsfrist entscheiden, ob eine Forderung 30 Jahre vollstreckbar wird. Fristen, Formular, Folgen – mit Rechner.",
    faq: [
      { frage: "Hat das Gericht geprüft, ob ich das Geld schulde?", antwort: "Nein. Das Mahnverfahren ist ein automatisiertes Verfahren; das Mahngericht prüft nur, ob der Antrag formal vollständig ist. Ob die Forderung besteht, ob sie verjährt oder überhöht ist, wird nicht geprüft. Deshalb kommen auch unberechtigte Forderungen als Mahnbescheid – der Widerspruch ist Ihr einziger Hebel." },
      { frage: "Muss ich den Widerspruch begründen?", antwort: "Nein. Ein Kreuz im Feld „Ich widerspreche dem Anspruch insgesamt“, Datum und Unterschrift auf dem beiliegenden Formular genügen (§ 694 ZPO). Die Begründung folgt erst im streitigen Verfahren, falls der Gläubiger klagt." },
      { frage: "Wie wird die Zwei-Wochen-Frist gerechnet?", antwort: "Ab dem Tag der Zustellung – der steht auf dem gelben Umschlag –, wobei der Zustelltag nicht mitzählt. Endet die Frist an einem Samstag, Sonntag oder gesetzlichen Feiertag, gilt der nächste Werktag (§ 222 ZPO). Entscheidend ist der Eingang beim Gericht, nicht der Poststempel." },
      { frage: "Ich habe die Frist verpasst – was jetzt?", antwort: "Der Gläubiger kann einen Vollstreckungsbescheid beantragen. Gegen den haben Sie erneut zwei Wochen ab Zustellung für den Einspruch (§ 700 ZPO). Erst wenn auch diese Frist verstreicht, ist die Forderung tituliert und 30 Jahre vollstreckbar. Ein verspäteter Widerspruch wird als Einspruch gewertet." },
      { frage: "Kostet der Widerspruch etwas?", antwort: "Nein. Weder Gerichtskosten noch Gebühren. Kosten entstehen erst, wenn der Gläubiger nach dem Widerspruch klagt und Sie verlieren – dann tragen Sie die Kosten des Verfahrens. Bei einer berechtigten Forderung ist deshalb ein Ratenangebot oft klüger als ein Widerspruch." },
    ],
    inhalt: `Der Umschlag ist gelb, der Absender ein Amtsgericht, und oben steht in Großbuchstaben MAHNBESCHEID. Wer das zum ersten Mal in der Hand hält, liest die Summe, liest „Gericht“, und schließt: Es ist entschieden. Das ist der Moment, in dem die meisten Fehler passieren – entweder aus Angst zu zahlen, was nicht geschuldet ist, oder aus Lähmung eine Frist verstreichen zu lassen, die über Jahrzehnte entscheidet.

Ein Mahnbescheid ist kein Urteil. Er ist ein Antrag, den ein Gläubiger ausgefüllt hat und den ein Computer des Mahngerichts formal geprüft und versendet hat. Niemand hat nachgesehen, ob die Forderung besteht. Das erklärt, warum verjährte, überhöhte und schlicht erfundene Forderungen als Mahnbescheid ankommen – und warum es einen einzigen Hebel gibt, der alles entscheidet: den Widerspruch, innerhalb von zwei Wochen.

## Was das Mahnverfahren ist – und was nicht

Das gerichtliche Mahnverfahren (§§ 688 ff. ZPO) ist ein vereinfachtes Verfahren, mit dem ein Gläubiger schnell und billig zu einem Vollstreckungstitel kommt, wenn der Schuldner sich nicht wehrt. Die zentralen Mahngerichte – in vielen Bundesländern ein einziges Amtsgericht für das ganze Land – bearbeiten jährlich Millionen Anträge maschinell. Nach Angaben der Justizverwaltungen lag die Zahl der Mahnbescheide in Deutschland in den vergangenen Jahren im Bereich von mehreren Millionen pro Jahr.

Geprüft wird ausschließlich, ob der Antrag die formalen Anforderungen erfüllt: Parteien, Forderungsbetrag, Bezeichnung des Anspruchs. Ob der Vertrag existiert, ob die Ware geliefert wurde, ob die Forderung verjährt ist – all das prüft niemand. Der Bescheid enthält deshalb den Satz, den fast alle überlesen: „Das Gericht hat nicht geprüft, ob der geltend gemachte Anspruch besteht.“

*Quelle: §§ 688–703d ZPO; Hinweistext auf dem amtlichen Mahnbescheidsformular.*

## Die zwei Wochen – und wie sie gerechnet werden

Gegen den Mahnbescheid kann der Antragsgegner innerhalb von zwei Wochen ab Zustellung Widerspruch einlegen (§ 694 Abs. 1 ZPO). Zugestellt wird in der Regel per Postzustellungsurkunde – der gelbe Umschlag –, und das Datum der Zustellung vermerkt der Zusteller auf dem Umschlag. Dieses Datum zählt, nicht das Datum des Bescheids.

Die Frist beginnt am Tag nach der Zustellung und endet mit Ablauf des Tages, der durch seine Benennung dem Zustelltag entspricht – zwei Wochen später (§ 222 ZPO in Verbindung mit §§ 187, 188 BGB). Fällt dieser Tag auf einen Samstag, Sonntag oder gesetzlichen Feiertag, endet die Frist am nächsten Werktag. Entscheidend ist der Eingang des Widerspruchs beim Mahngericht, nicht der Poststempel.

Der [Mahnbescheid-Fristenrechner](/werkzeuge/mahnbescheid) rechnet das taggenau, mit Wochenenden und bundesweiten Feiertagen. Landesfeiertage kennt er nicht – lassen Sie einen Tag Reserve, und schicken Sie das Formular nicht am letzten Tag per Post.

## Das Kreuz, das genügt

Dem Mahnbescheid liegt ein Formular bei: „Widerspruch gegen den Mahnbescheid“. Darauf gibt es ein Feld „Ich widerspreche dem Anspruch insgesamt“ und eines für den Teilwiderspruch. Für den vollständigen Widerspruch genügt das Kreuz im ersten Feld, Datum, Unterschrift. Eine Begründung ist nicht erforderlich und nicht vorgesehen – sie folgt erst im streitigen Verfahren, wenn der Gläubiger klagt.

Der Widerspruch ist kostenlos. Er geht an das Mahngericht, das auf dem Bescheid steht – nicht an den Gläubiger, nicht an das Inkassounternehmen. Am sichersten ist die Übermittlung per Fax mit Sendebericht, persönlich gegen Eingangsstempel oder per Einschreiben mit ausreichend Vorlauf. In vielen Ländern ist auch die elektronische Einlegung über das Online-Mahnverfahren möglich.

## Was nach dem Widerspruch passiert

Mit dem Widerspruch endet das Mahnverfahren. Der Gläubiger muss jetzt entscheiden, ob er die Forderung im streitigen Verfahren durchsetzen will – das heißt: klagen, mit Klageschrift, Begründung, Beweisen. Erst dann sieht ein Richter die Forderung. Erst dann zählen Ihre Einwände: dass Sie nie bestellt haben, dass die Forderung verjährt ist, dass die Inkassokosten überhöht sind.

Viele Inkassounternehmen klagen nach einem Widerspruch nicht – jedenfalls dann nicht, wenn die Forderung schwach ist oder der Streitwert klein. Das ist kein Freibrief, sondern eine Beobachtung: Der Mahnbescheid ist billig, die Klage ist es nicht. Wer widerspricht, zwingt die Gegenseite, ihre Karten aufzudecken.

## Wenn die Frist verstrichen ist

Ohne Widerspruch kann der Gläubiger frühestens zwei Wochen nach Zustellung den Vollstreckungsbescheid beantragen (§ 699 ZPO). Auch der kommt im gelben Umschlag, auch gegen ihn gibt es eine Frist: zwei Wochen ab Zustellung für den Einspruch (§ 700 Abs. 1 in Verbindung mit § 339 ZPO). Ein verspätet eingelegter Widerspruch wird automatisch als Einspruch gegen den Vollstreckungsbescheid behandelt.

Der Unterschied zum Widerspruch: Der Vollstreckungsbescheid ist bereits ein vorläufig vollstreckbarer Titel. Der Einspruch hält die Vollstreckung nicht automatisch auf – Sie müssen zusätzlich die einstweilige Einstellung der Zwangsvollstreckung beantragen (§ 719 ZPO). Wer diese zweite Frist auch verstreichen lässt, hat einen rechtskräftigen Titel gegen sich: 30 Jahre vollstreckbar (§ 197 Abs. 1 Nr. 3 BGB), pfändbar, und als titulierte Forderung an Auskunfteien meldefähig – unabhängig davon, ob Sie die Forderung je bestritten haben.

*Quelle: §§ 699, 700, 719 ZPO; § 197 BGB.*

## Die Verbindung zur Auskunft

Ein Mahnbescheid allein wird nicht an die SCHUFA gemeldet. Ein Vollstreckungsbescheid dagegen ist eine titulierte Forderung, und für die gelten die Voraussetzungen des § 31 Abs. 2 Nr. 4 BDSG – zwei Mahnungen, kein Widerspruch – nicht. Titulierte Forderungen dürfen nach Nr. 1 der Vorschrift gemeldet werden, ohne dass es auf Ihr Bestreiten ankommt. Das ist der Grund, warum die Widerspruchsfrist die wichtigste Frist im ganzen Weg von der Rechnung zum Eintrag ist: Vor ihr ist eine bestrittene Forderung geschützt, nach ihr nicht mehr.

## Widersprechen oder zahlen?

Widerspruch ist richtig, wenn die Forderung zweifelhaft ist: unbekannt, verjährt, überhöht, doppelt. Er ist auch richtig, wenn Sie schlicht Zeit brauchen, um Unterlagen zu prüfen – ein Widerspruch lässt sich zurücknehmen, eine verstrichene Frist nicht. Widerspruch ist nicht sinnvoll bei einer Forderung, die Sie kennen und die berechtigt ist: Dann klagt der Gläubiger, gewinnt, und Sie tragen die Kosten des Verfahrens obendrauf. In diesem Fall ist ein Ratenangebot der bessere Weg – der [Ratenplan-Rechner](/werkzeuge/ratenplan) formuliert es.

## Schritt für Schritt: Vom Umschlag bis zum Widerspruch

1. **Zustelldatum sichern.** Den gelben Umschlag aufheben – der handschriftliche Vermerk des Zustellers ist der Beweis für den Fristbeginn. Datum notieren, Frist mit dem [Fristenrechner](/werkzeuge/mahnbescheid) berechnen, Termin in den Kalender, zwei Tage Reserve.
2. **Den Bescheid lesen, nicht nur die Summe.** Wer ist Antragsteller, wer der ursprüngliche Gläubiger, wie setzt sich der Betrag zusammen – Hauptforderung, Zinsen, Kosten des Verfahrens, Inkassokosten? Jede Position ist ein möglicher Einwand für später.
3. **Unterlagen suchen.** Vertrag, Rechnung, Mahnungen, eigene Schreiben, Zahlungsbelege. Was fehlt, fehlt – das ist kein Grund zur Panik, sondern ein Argument: Der Gläubiger muss belegen, Sie nicht.
4. **Widerspruch ausfüllen und absenden.** Das beiliegende Formular, Kreuz bei „insgesamt“, Datum, Unterschrift. Per Fax mit Sendebericht, persönlich gegen Stempel oder Einschreiben mit Vorlauf – an das Mahngericht, das auf dem Bescheid steht.
5. **Nachweis aufheben.** Sendebericht, Einlieferungsbeleg oder Kopie mit Eingangsstempel gehören in denselben Ordner wie der Umschlag. Ohne Nachweis steht im Streitfall Ihr Wort gegen die Akte des Gerichts.
6. **Auf die Klage vorbereiten – oder auf die Stille.** Kommt die Klage, läuft ein normales Verfahren mit Fristen zur Erwiderung. Kommt nichts, bleibt die Forderung offen, aber ohne Titel – und die Verjährung läuft weiter.

Ein Sonderfall verdient einen eigenen Absatz: der Mahnbescheid an eine alte Adresse. Wird der Bescheid an eine Anschrift zugestellt, unter der Sie nicht mehr wohnen, gilt er unter Umständen trotzdem als zugestellt – und die Frist läuft, ohne dass Sie davon wissen. Wer umzieht und offene Forderungen hat, sollte den Nachsendeauftrag verlängern und Gläubigern die neue Adresse mitteilen. Erfahren Sie nachträglich von einem Bescheid, prüfen Sie die Zustellung: Eine Ersatzzustellung an eine Adresse, an der Sie nachweislich nicht mehr gewohnt haben, ist unwirksam, und die Frist hat nie begonnen.

Der zweite Sonderfall ist der Teilwiderspruch. Wer die Hauptforderung anerkennt, aber die Nebenkosten für überhöht hält, kann dem Anspruch nur teilweise widersprechen – das Formular sieht das vor. Dann wird über den anerkannten Teil ein Vollstreckungsbescheid erlassen, über den bestrittenen Teil muss der Gläubiger klagen. In der Praxis ist der vollständige Widerspruch meist der klarere Weg: Er verschafft Zeit, und die Hauptforderung lässt sich danach immer noch begleichen oder in Raten vereinbaren.

## Was nicht geht

Der Mahnbescheid lässt sich nicht „aussitzen“, nicht am Telefon erledigen und nicht durch ein Schreiben an das Inkassounternehmen stoppen. Nur das Formular an das Mahngericht zählt. Und: Wer nach dem Widerspruch die Forderung anerkennt oder eine Rate zahlt, lässt die Verjährung neu beginnen (§ 212 BGB) – prüfen Sie die Verjährung deshalb vor jedem Angebot mit dem [Verjährungs-Rechner](/werkzeuge/verjaehrung).

Aus der FIAON-Praxis: Der Mahnbescheid ist die Stelle, an der Kunden am häufigsten Hilfe suchen – und die, an der ein Kalender mehr wert ist als jeder Anwalt. Wer die Frist kennt und das Kreuz setzt, hat die Kontrolle zurück. Alles Weitere ist Prüfung: Forderung, Kosten, Verjährung. Mehr zum Ablauf davor auf der Seite [Inkasso-Brief erhalten](/inkasso-brief-erhalten).`,
  },
  {
    slug: "inkasso-nachweise-verlangen-13a-rdg",
    titel: "Inkasso: Diese Angaben muss Ihnen das Unternehmen liefern – und was Sie tun, wenn sie fehlen",
    untertitel: "Seit Oktober 2021 gilt § 13a RDG: Wer eine Forderung eintreibt, muss beim ersten Schreiben Auftraggeber, Vertragsgrund, Vertragsdatum und die Kostenaufstellung nennen. Die meisten Briefe tun das nicht vollständig. Was das für Sie bedeutet.",
    teaser: "Ein Inkassobrief muss Auftraggeber, Vertragsdatum und Kosten nennen (§ 13a RDG). Fehlt das: Nachweise verlangen – und die Forderung gilt als bestritten.",
    kategorie: "inkasso", land: "DE", keyword: "inkasso forderung bestreiten nachweise",
    schlagworte: ["§ 13a RDG", "Inkasso", "Forderung bestreiten", "Informationspflichten", "Inkassokosten", "Verbraucherschutz"],
    metaTitel: "Inkasso: Nachweise verlangen nach § 13a RDG – so geht es",
    metaBeschreibung: "Ein Inkassobrief muss Auftraggeber, Vertragsgrund, Datum und Kosten nennen (§ 13a RDG). Fehlt das: Nachweise verlangen, Forderung bestreiten. Mit Brief.",
    faq: [
      { frage: "Was muss ein Inkassounternehmen im ersten Schreiben angeben?", antwort: "Nach § 13a Abs. 1 RDG: Name und Anschrift des Auftraggebers, den Forderungsgrund – bei Verträgen den Vertragsgegenstand und das Datum des Vertragsschlusses –, bei abgetretenen Forderungen den ursprünglichen Gläubiger, die Berechnung von Zinsen, sowie Art, Höhe und Entstehungsgrund der Inkassokosten. Bei Ratenvereinbarungen zusätzlich Hinweise zu deren Kosten." },
      { frage: "Was passiert, wenn diese Angaben fehlen?", antwort: "Die Forderung wird dadurch nicht ungültig – aber das Unternehmen verletzt seine Berufspflichten, und Sie sind nicht verpflichtet, auf ein unvollständiges Schreiben zu zahlen. Verlangen Sie die Angaben und Nachweise schriftlich und bestreiten Sie die Forderung bis zur Vorlage. Verstöße können bei der Aufsicht (Bundesamt für Justiz) gemeldet werden." },
      { frage: "Ist eine Forderung bestritten, wenn ich Nachweise verlange?", antwort: "Ja, wenn Sie es so formulieren: „Ich bestreite die Forderung dem Grunde und der Höhe nach und bitte um Vorlage der Nachweise.“ Eine bestrittene Forderung darf nicht an Auskunfteien gemeldet werden (§ 31 Abs. 2 Nr. 4 Buchst. d BDSG). Heben Sie den Nachweis über den Zugang Ihres Schreibens auf." },
      { frage: "Darf ich die Nachweise auch bei berechtigten Forderungen verlangen?", antwort: "Ja. Es ist Ihr Recht, zu wissen, wofür Sie zahlen sollen – und die Kostenaufstellung zu prüfen. Stellt sich die Hauptforderung als berechtigt heraus, zahlen Sie sie oder bieten Raten an; die Inkassokosten prüfen Sie getrennt mit dem Inkassokosten-Prüfer." },
      { frage: "Wer beaufsichtigt Inkassounternehmen?", antwort: "Seit 2025 zentral das Bundesamt für Justiz, das die Registrierung nach dem RDG führt und Beschwerden entgegennimmt. Dort können Sie prüfen, ob ein Unternehmen überhaupt registriert ist – ein nicht registriertes „Inkasso“ darf keine Forderungen eintreiben." },
    ],
    inhalt: `Der Brief kommt von einem Unternehmen, dessen Namen Sie noch nie gehört haben, im Auftrag eines Gläubigers, den Sie nicht zuordnen können, über einen Betrag, der aus Hauptforderung, Zinsen, „Auslagen“ und „Inkassokosten“ besteht. Unten steht eine Frist von sieben Tagen und der Hinweis auf „weitere Maßnahmen“. So sehen Inkassobriefe seit Jahrzehnten aus – und genau das sollte seit dem 1. Oktober 2021 nicht mehr möglich sein.

Mit dem Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht hat der Gesetzgeber in § 13a RDG festgelegt, was ein Inkassounternehmen einer Privatperson beim ersten Schreiben mitteilen muss. Die Liste ist konkret. Wer sie kennt, kann die meisten Inkassobriefe auf einen Blick einordnen – und weiß, welchen Satz er zurückschreibt.

## Was § 13a RDG verlangt

Registrierte Inkassodienstleister müssen bei der ersten Geltendmachung einer Forderung gegenüber einer Privatperson klar und verständlich in Textform mitteilen: den Namen oder die Firma des Auftraggebers und dessen Anschrift; den Forderungsgrund – bei Verträgen unter konkreter Darlegung des Vertragsgegenstands und des Datums des Vertragsschlusses; bei abgetretenen Forderungen den Namen des ursprünglichen Gläubigers; wenn Zinsen verlangt werden, deren Berechnung mit Zinssatz und Zeitraum; wenn ein höherer als der gesetzliche Verzugszins verlangt wird, dessen Grund; und wenn Inkassokosten geltend gemacht werden, deren Art, Höhe und Entstehungsgrund.

Auf Anfrage muss das Unternehmen zusätzlich unverzüglich mitteilen, wer der ursprüngliche Vertragspartner war, und die Forderung durch Vorlage der maßgeblichen Unterlagen belegen. Diese Pflichten gelten für jedes Inkassounternehmen mit Registrierung nach dem Rechtsdienstleistungsgesetz – und damit für praktisch jeden Brief, der Ihnen mit „Inkasso“ im Absender ins Haus kommt.

*Quelle: § 13a Rechtsdienstleistungsgesetz (RDG) in der Fassung des Gesetzes vom 22.12.2020, in Kraft seit 01.10.2021.*

## Warum das Gesetz kam

Der Gesetzgeber hat die Reform mit einer Beobachtung begründet, die jeder kennt, der je einen Inkassobrief bekommen hat: Betroffene konnten häufig nicht erkennen, wofür sie überhaupt zahlen sollten. Dazu kamen Inkassokosten, die die Hauptforderung überstiegen. Nach dem Jahresbericht des Bundesverbands Deutscher Inkasso-Unternehmen (BDIU) bearbeiten die Mitgliedsunternehmen jährlich Forderungen im zweistelligen Milliardenbereich – eine Größenordnung, bei der Transparenzpflichten kein Formalismus sind.

Mit der Reform kam neben § 13a auch § 13e RDG: Inkassokosten sind nur bis zu der Höhe erstattungsfähig, die einem Rechtsanwalt nach dem Rechtsanwaltsvergütungsgesetz zustünde – und bei einer unbestrittenen Forderung, die nach der ersten Mahnung beglichen wird, nur eine Geschäftsgebühr von 0,5. Wer eine Forderung von 60 Euro bekommt und dazu 90 Euro Inkassokosten, hat einen klaren Fall.

*Quelle: BDIU, Jahresberichte; § 13e RDG; Gesetzesbegründung BT-Drs. 19/20348.*

## Die Angaben, die am häufigsten fehlen

Aus der FIAON-Praxis, nicht als Statistik: Am häufigsten fehlt das Datum des Vertragsschlusses – der Brief nennt „Forderung aus Kaufvertrag“ oder „Mobilfunkvertrag“, aber nicht wann und was. Fast ebenso häufig fehlt die Aufschlüsselung der Kosten: Es steht ein Gesamtbetrag, und darunter „inkl. Inkassokosten und Auslagen“. Beides ist ein Verstoß, und beides ist der Grund, warum der erste Brief zurück an das Unternehmen immer derselbe Satz ist: Bitte legen Sie die Angaben nach § 13a RDG und die Nachweise vor.

Ein dritter, seltenerer Fall: Der Absender ist gar kein registriertes Inkassounternehmen. Die Registrierung lässt sich im Rechtsdienstleistungsregister prüfen, das seit 2025 beim Bundesamt für Justiz geführt wird. Ein nicht registriertes Unternehmen darf keine fremden Forderungen eintreiben – der Brief ist dann keine Inkassotätigkeit, sondern ein Rechtsverstoß.

## Nachweise verlangen ist kein Trick

Manche Betroffene zögern, Nachweise zu verlangen, weil sie fürchten, das wirke wie ein Eingeständnis oder verzögere nur das Unvermeidliche. Beides stimmt nicht. Wer Geld von Ihnen will, muss belegen, wofür – das gilt vor Gericht und davor. Und der Brief, der Nachweise verlangt, enthält einen zweiten Satz, der Sie schützt: „Ich bestreite die Forderung dem Grunde und der Höhe nach.“ Eine bestrittene Forderung darf nach § 31 Abs. 2 Nr. 4 Buchst. d BDSG nicht an Auskunfteien gemeldet werden. Der Brief ist damit der Schutz vor dem Eintrag, solange nichts geklärt ist.

Der [Inkasso-Antwortbrief](/werkzeuge/inkasso-antwort) formuliert genau dieses Schreiben – als Mustertext zum Selbst-Anpassen. Er verlangt die Angaben nach § 13a RDG, setzt eine Frist von 14 Tagen, bestreitet die Forderung bis zur Vorlage und widerspricht jeder Meldung an Auskunfteien.

## Wenn die Nachweise kommen

Kommen Vertrag, Rechnung und Mahnungen, ändert sich die Lage: Dann ist die Hauptforderung zu prüfen – und, wenn sie stimmt, zu zahlen oder in Raten zu vereinbaren. Die Nebenforderungen bleiben getrennt zu prüfen. Der [Inkassokosten-Prüfer](/werkzeuge/inkassokosten) rechnet die Gebühren nach RVG und § 13e RDG nach; der [Mahngebühren-Prüfer](/werkzeuge/mahngebuehren) die Mahnkosten des Gläubigers. Was zu viel ist, weisen Sie zurück – und zahlen den Rest.

Zwei Zahlen sind dabei wichtig. Erstens: Wer eine gemeldete Forderung innerhalb von 100 Tagen nach der Meldung vollständig ausgleicht, ist nach den Verhaltensregeln der Auskunfteien nach 18 Monaten statt drei Jahren aus der Auskunft. Zweitens: Eine Ratenvereinbarung gilt als Anerkenntnis und lässt die Verjährung neu beginnen (§ 212 BGB) – prüfen Sie die Verjährung vorher.

## Wenn nichts kommt

Bleibt das Unternehmen die Nachweise schuldig und mahnt trotzdem weiter, gibt es zwei Wege. Der erste ist die Beschwerde bei der Aufsicht – dem Bundesamt für Justiz, das Verstöße gegen § 13a RDG ahnden kann. Der zweite ist Geduld: Nicht zahlen, nicht anrufen, jeden Brief abheften. Kommt ein Mahnbescheid, gilt die Zwei-Wochen-Frist für den Widerspruch – der [Fristenrechner](/werkzeuge/mahnbescheid) nennt den Tag. Erst wenn der Gläubiger klagt, muss er vor einem Richter belegen, was er Ihnen schriftlich verweigert hat.

## Schritt für Schritt: Der erste Brief zurück

1. **Absender prüfen.** Steht das Unternehmen im Rechtsdienstleistungsregister? Fehlt es dort, ist der Brief keine Inkassotätigkeit – und gehört zur Aufsicht, nicht in Ihre Überweisung.
2. **Die sechs Angaben abhaken.** Auftraggeber mit Anschrift, Forderungsgrund mit Vertragsgegenstand und Datum, ursprünglicher Gläubiger bei Abtretung, Zinsberechnung, Kostenaufstellung nach Art, Höhe und Grund. Was fehlt, kommt in den Brief.
3. **Haltung festlegen.** Kennen Sie die Forderung nicht: bestreiten und Nachweise verlangen. Kennen Sie sie, stimmen aber die Kosten nicht: Hauptforderung anerkennen, Nebenkosten zurückweisen. Ist sie alt: Verjährung prüfen, bevor Sie irgendetwas schreiben.
4. **Brief erzeugen, prüfen, absenden.** Der [Inkasso-Antwortbrief](/werkzeuge/inkasso-antwort) liefert das Muster; Sie passen Aktenzeichen, Beträge und Daten an. Per Einschreiben, Beleg aufheben, Kopie in den Ordner.
5. **Frist notieren.** 14 Tage für die Antwort des Unternehmens – danach entscheiden Sie neu: Nachweise da und Forderung berechtigt, dann zahlen oder Raten anbieten; Nachweise nicht da, dann abwarten und nichts anerkennen.
6. **Nie am Telefon.** Anrufe des Inkassos nicht annehmen oder mit einem Satz beenden: „Bitte schriftlich.“ Am Telefon wird nichts bewiesen, aber vieles versehentlich anerkannt.

Was Sie nicht tun sollten, ist ebenso wichtig wie das, was Sie tun: keine „Anzahlung zur Prüfung“, keine Rate „als Zeichen guten Willens“, keine Unterschrift unter ein Schuldanerkenntnis, das dem Brief beiliegt. Jede dieser Handlungen kann als Anerkenntnis gelten, die Verjährung neu starten (§ 212 BGB) und die Position aufgeben, die der Brief gerade aufgebaut hat. Wer zahlen will, zahlt nach der Prüfung – vollständig, gegen Bestätigung und mit dem Verwendungszweck, den das Unternehmen nennt.

Ein Wort zu den Kosten, weil sie den Streit so oft entscheiden: Die Deckelung nach § 13e RDG bindet Inkassokosten an das Rechtsanwaltsvergütungsgesetz. Für eine Forderung bis 500 Euro liegt eine 1,3-fache Geschäftsgebühr nach der Gebührentabelle bei rund 63 Euro zuzüglich Auslagenpauschale; bei unbestrittener Forderung und Zahlung nach der ersten Mahnung ist nur eine 0,5-fache Gebühr angemessen – rund 24 Euro. Wer in einem Brief über 60 Euro Hauptforderung 120 Euro Inkassokosten liest, hat damit den Maßstab.

*Quelle: § 13e RDG; Anlage 2 zu § 13 RVG (Gebührentabelle, Stand 2025).*

## Was nicht geht

§ 13a RDG macht eine berechtigte Forderung nicht unberechtigt. Wer eine Rechnung schuldig ist, schuldet sie auch dann, wenn der Inkassobrief schlecht war – nur die Nebenkosten und die Meldung an Auskunfteien stehen zur Debatte. Und die Vorschrift gilt für registrierte Inkassodienstleister; ein Rechtsanwalt, der für einen Gläubiger mahnt, unterliegt anderen Regeln, wenn auch ähnlichen Kostengrenzen.

FIAON ist kein Inkasso und keine rechtliche Prüfung im Einzelfall – FIAON ist die Gegenprüfung: Wir prüfen den Brief, verlangen die Nachweise, rechnen die Kosten nach, formulieren Ratenangebote und verfolgen jede Antwort, damit aus einer unklaren Forderung kein Eintrag wird. Mehr dazu auf der Seite [Inkasso-Brief erhalten](/inkasso-brief-erhalten).`,
  },
];
