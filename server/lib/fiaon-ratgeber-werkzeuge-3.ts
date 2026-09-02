// ═══════════════════════════════════════════════════════════════════════════
// Zehn Ratgeber zu den zehn neuen Werkzeugen — Teil 3 (02.09.2026, E-080)
// Regeln wie in Teil 1: jede Zahl mit Quelle, Sie-Form, keine Schuldnerberatung,
// keine Garantie, ehrlicher Abschnitt „Was nicht geht“, ein Werkzeug je Text.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "./fiaon-ratgeber-start";

export const WERKZEUG_ARTIKEL_3: StartArtikel[] = [
  {
    slug: "kreditkarte-kaution-prepaid-debit-kostenvergleich",
    titel: "Kreditkarte mit Kaution, Prepaid oder Debit: Der ehrliche Vergleich über drei Jahre – Kosten, Können, Bonität",
    untertitel: "Drei Kartenwege stehen Menschen mit Eintrag offen, und keiner lässt sich auf den ersten Blick mit dem anderen vergleichen. Wer die Gebühren, die stillliegende Kaution und die Frage „Was kann die Karte eigentlich?“ zusammen betrachtet, kommt zu einer anderen Antwort als die Werbung.",
    teaser: "Kaution, Prepaid oder Debit: Was die drei Kartenwege über drei Jahre kosten, was jede bei Hotel, Mietwagen und Bonität leistet – und warum das Konto wichtiger ist.",
    kategorie: "karte", land: "DACH", keyword: "kreditkarte mit kaution vergleich prepaid",
    schlagworte: ["Kreditkarte mit Kaution", "Prepaid-Kreditkarte", "Debitkarte", "Kartenkosten", "Kreditkarte trotz SCHUFA", "Kostenvergleich"],
    metaTitel: "Kreditkarte mit Kaution, Prepaid oder Debit: Vergleich",
    metaBeschreibung: "Kreditkarte mit Kaution, Prepaid oder Debit: Kosten über drei Jahre, was jede Karte bei Hotel, Mietwagen und Bonität leistet. Mit Rechner.",
    faq: [
      { frage: "Was ist eine Kreditkarte mit Sicherheitsleistung?", antwort: "Eine echte Kreditkarte, deren Rahmen durch eine vorab hinterlegte Kaution gedeckt ist – meist in Höhe des Rahmens. Der Herausgeber trägt kein Risiko und gibt sie deshalb oft auch bei negativen Einträgen. Die Kaution liegt fest, solange die Karte läuft; einige Herausgeber verzinsen sie nicht." },
      { frage: "Was ist der Unterschied zwischen Prepaid und Debit?", antwort: "Prepaid-Karten laden Sie auf; sie hängen an keinem Girokonto und kosten häufig Aufladegebühren. Debitkarten (Visa Debit, Debit Mastercard) buchen sofort vom Girokonto ab – ohne Aufladung und ohne Rahmen. Für Alltag und Online-Kauf sind beide gleichwertig; bei Hotels und Mietwagen werden beide oft abgelehnt." },
      { frage: "Welche Karte baut meine Bonität auf?", antwort: "Nur eine Karte, deren Vertrag und Zahlungsverhalten an Auskunfteien gemeldet wird – in Deutschland vor allem echte Kreditkarten mit Rahmen. Prepaid und Debit werden in der Regel nicht gemeldet. Was wirklich Bonität baut, ist das Girokonto dahinter: Gehaltseingänge, keine Rückgaben, kein Dauer-Dispo." },
      { frage: "Warum zählt der Rechner die Kaution als Kosten?", antwort: "Weil das Geld drei Jahre nicht arbeitet. Bei 1.000 Euro Kaution und 2,5 Prozent Tagesgeldzins sind das rund 25 Euro im Jahr zusätzlich zur Jahresgebühr. Die Kaution ist nicht verloren – aber der Vergleich mit Prepaid ist nur ehrlich, wenn man ihren Preis mitrechnet." },
      { frage: "Welche Karte bekomme ich über FIAON?", antwort: "Das entscheidet der Kartenpartner anhand Ihrer Akte. Jeder Kunde beginnt mit einem Girokonto und Debitkarte; die Kreditkarte mit Rahmen kommt, wenn Auskunft und Kontoführung sie tragen. FIAON bereitet vor und stellt den Antrag – ein Weg mit Etappen, kein Versprechen." },
    ],
    inhalt: `Wer mit einem negativen Eintrag nach einer Kreditkarte sucht, findet in zehn Minuten drei Angebote, die alle „ohne SCHUFA“ versprechen: eine Kreditkarte mit Kaution, eine Prepaid-Karte und – meist übersehen – die Debitkarte zum eigenen Girokonto. Alle drei sind seriös, alle drei sind für verschiedene Menschen richtig, und keine lässt sich mit den anderen vergleichen, solange man nur auf die Jahresgebühr schaut.

Dieser Text legt die drei Wege nebeneinander – über drei Jahre, mit allen Gebühren, mit dem Geld, das als Kaution stillliegt, und mit der Frage, die die Werbung nicht beantwortet: Was kann die Karte, wenn Sie an der Hotelrezeption stehen?

## Die drei Wege

Die **Kreditkarte mit Sicherheitsleistung** ist eine echte Kreditkarte: Sie hat einen Rahmen, die Abrechnung kommt monatlich, Hotels und Mietwagenfirmen können eine Kaution blockieren. Der Rahmen ist durch eine Kaution gedeckt, die Sie vorab hinterlegen – typisch 500 bis 2.000 Euro. Weil der Herausgeber kein Risiko trägt, prüft er die Bonität kaum. Die Kaution liegt fest, solange die Karte läuft.

Die **Prepaid-Karte** hängt an keinem Konto. Sie laden Guthaben auf, zahlen davon, und wenn es leer ist, ist es leer. Keine Bonitätsprüfung, kein Rahmen – und oft eine Reihe von Gebühren: Jahresgebühr, Aufladegebühr, Bargeldgebühr, Inaktivitätsgebühr.

Die **Debitkarte** kommt zum Girokonto – als Visa Debit oder Debit Mastercard bei fast allen Banken. Sie bucht sofort vom Konto ab, funktioniert online und im Ausland, kostet meist nichts über die Kontoführung hinaus. Und sie ist Bestandteil jedes Basiskontos, das jedem Verbraucher zusteht.

## Die Kosten über drei Jahre

Eine Kautionskarte mit 49 Euro Jahresgebühr und 500 Euro Kaution kostet über drei Jahre 147 Euro Gebühren – plus den entgangenen Zins auf die Kaution: bei 2,5 Prozent Tagesgeld rund 37 Euro. Zusammen gut 180 Euro. Eine Prepaid-Karte mit 29 Euro Jahresgebühr, 1,50 Euro je Aufladung bei zwölf Aufladungen im Jahr und 2 Euro je Bargeldabhebung bei sechs Abhebungen kostet über drei Jahre rund 177 Euro. Eine Debitkarte zu einem Konto mit 4,90 Euro Kontoführung kostet über drei Jahre rund 176 Euro – wobei das Konto ohnehin da sein muss.

Die drei Wege liegen bei typischen Zahlen also erstaunlich nah beieinander. Der [Kartenkosten-Vergleich](/werkzeuge/kartenkosten) rechnet es mit den Werten aus Ihren Angeboten – die Unterschiede kommen fast immer aus den Nebengebühren, nicht aus der Jahresgebühr.

*Quelle: Beispielrechnung mit marktüblichen Größenordnungen, Stand 2026; die Bandbreite der Anbieter ist erheblich.*

## Was die Karte können muss

Hier trennen sich die Wege. An der Hotelrezeption und beim Mietwagen wird eine Kaution auf der Karte blockiert – das setzt einen Rahmen voraus. Prepaid- und Debitkarten werden dort häufig abgelehnt, weil kein Rahmen da ist, den man sperren könnte; manche Häuser akzeptieren Debit gegen höhere Kaution, viele nicht. Wer reist, braucht eine Kreditkarte mit Rahmen – und mit Eintrag ist die Kautionskarte oft die einzige, die es gibt.

Im Alltag – Supermarkt, Tanken, Online-Kauf, Abonnements – sind alle drei gleichwertig. Für den Alltag ist die Debitkarte zum Konto deshalb fast immer der günstigste Weg.

## Was die Karte für die Bonität tut

Die verbreitete Annahme: „Eine Kreditkarte baut Bonität auf.“ Das stimmt nur für Karten, deren Vertrag und Zahlungsverhalten an Auskunfteien gemeldet werden – in Deutschland vor allem echte Kreditkarten mit Rahmen, bei denen der Herausgeber Vertragspartner der SCHUFA ist. Prepaid-Karten werden nicht gemeldet; Debitkarten sind Teil des Girokontos, das als Vertragsdatum erscheint, aber ohne Zahlungshistorie. Bei Kautionskarten hängt es vom Herausgeber ab; nicht jeder meldet.

Was Bonität tatsächlich aufbaut, ist etwas anderes: das Girokonto dahinter. Regelmäßige Gehaltseingänge, pünktliche Lastschriften, keine Rückgaben, kein Dauer-Dispo – das ist der Kontoauszug, den Kartenpartner lesen, wenn sie über einen Rahmen entscheiden. Eine Prepaid-Karte kann das nicht ersetzen, und eine Kautionskarte auch nicht.

## Der Weg, den FIAON geht

Deshalb beginnt jeder Kunde bei FIAON mit dem Girokonto und der Debitkarte – nicht, weil die Kreditkarte unwichtig wäre, sondern weil sie am Ende des Weges steht. Erst die Auskunft in Ordnung bringen, dann das Konto sauber führen, dann den Kartenantrag stellen, wenn die Akte ihn trägt. Über Karte und Rahmen entscheidet der Kartenpartner. Der [Karten-Check](/werkzeuge/karten-check) sagt in fünf Angaben, welcher Weg heute realistisch ist.

## Schritt für Schritt: Die richtige Karte wählen

1. **Den Bedarf benennen.** Alltag und Online-Kauf, Reisen mit Hotel und Mietwagen oder gezielter Bonitätsaufbau – die Antwort entscheidet mehr als jede Gebühr. Für den Alltag reicht Debit; für Reisen braucht es einen Rahmen; für den Aufbau zählt das Konto.
2. **Angebote sammeln – mit Preisverzeichnis.** Nicht die Werbeseite, sondern das Preis- und Leistungsverzeichnis: Jahresgebühr, Aufladegebühr, Bargeldgebühr, Fremdwährungsgebühr, Inaktivitätsgebühr, Kautionshöhe, Verzinsung der Kaution.
3. **Auf drei Jahre rechnen.** Mit dem [Kartenkosten-Vergleich](/werkzeuge/kartenkosten) alle drei Wege nebeneinander – inklusive des entgangenen Zinses auf die Kaution. Erst über drei Jahre werden Aufladegebühren sichtbar, die im ersten Monat unbedeutend wirken.
4. **Das Können prüfen.** Bei Kautionskarten: Wird an Auskunfteien gemeldet? Gibt es die Kaution nach zwölf sauberen Monaten zurück oder wird sie in einen Rahmen umgewandelt? Bei Prepaid: Wird die Karte bei Hotels und Mietwagen akzeptiert? Bei Debit: Ist die Karte Teil eines Basiskontos?
5. **Konto zuerst.** Ohne Girokonto keine Debitkarte, ohne Kontoführung keine Bonität. Wer noch kein Konto hat, beginnt mit dem Basiskonto – der [Basiskonto-Helfer](/werkzeuge/basiskonto) zeigt den Weg.
6. **Nach zwölf Monaten neu bewerten.** Ein Jahr sauberer Kontoführung und bereinigter Auskunft verändert die Ausgangslage; die Kautionskarte, die heute nötig war, ist dann vielleicht durch eine normale Kreditkarte ersetzbar.

Was in Vergleichen fast nie steht: die Fremdwährungsgebühr. Wer die Karte im Urlaub außerhalb des Euroraums nutzt, zahlt bei vielen Prepaid- und Kautionskarten 1,5 bis 2,5 Prozent Aufschlag auf jeden Umsatz – bei 1.500 Euro Urlaubsausgaben 22 bis 37 Euro, also mehr als manche Jahresgebühr. Debitkarten großer Banken sind hier oft günstiger, manche gebührenfrei. Der Rechner hat dafür kein Feld, weil der Bedarf zu verschieden ist; wer reist, sollte die Zahl aus dem Preisverzeichnis dazuzählen.

Und ein Hinweis zur Kaution: Sie ist rechtlich Ihr Geld, das der Herausgeber als Sicherheit hält. Lesen Sie in den Bedingungen nach, wann und wie sie zurückfließt – bei Kündigung nach Ausgleich aller Umsätze, nach einer Frist von meist vier bis acht Wochen – und ob Insolvenz des Herausgebers das Geld gefährdet. Bei Karten mit E-Geld-Lizenz sind Kundengelder getrennt zu verwahren; fragen Sie nach, wenn das nirgends steht.

## Was nicht geht

Keine der drei Karten hebt einen Eintrag auf, und keine ersetzt die Auskunft. Die Kautionskarte gibt es nur, wenn Sie die Kaution aufbringen – Geld, das drei Jahre nicht verfügbar ist. Die Prepaid-Karte schützt vor Schulden, aber ihre Gebühren summieren sich unbemerkt. Und die Debitkarte scheitert an der Hotelrezeption. Wer sich für einen Weg entscheidet, sollte wissen, wofür.

FIAON nennt auf dieser Seite und im Rechner keine Anbieter und erhält keine Provision für Karten – die Zahlen sind Ihre, das Ergebnis ist ehrlich. Mehr zur Karte am Ende des Weges auf der Seite [Kreditkarte trotz Eintrag](/kreditkarte).`,
  },
  {
    slug: "ratenplan-berechnen-halbe-rate-haelt",
    titel: "Ratenplan berechnen: Warum die halbe Rate die bessere ist – und wie Sie sie dem Gläubiger anbieten",
    untertitel: "Gläubiger nehmen nicht das höchste Angebot an, sondern das, das hält. Wer die Rate aus dem echten Spielraum ableitet statt aus dem Wunsch, schnell fertig zu sein, zahlt am Ende weniger – an Zinsen, an Vertrauen und an Einträgen.",
    teaser: "Gläubiger nehmen das Angebot an, das hält – nicht das höchste. Wie Sie die Rate aus dem Spielraum ableiten und was ins Angebot gehört.",
    kategorie: "inkasso", land: "DE", keyword: "ratenplan berechnen rate gläubiger",
    schlagworte: ["Ratenplan", "Ratenzahlung", "Spielraum", "Ratenvereinbarung", "§ 212 BGB", "Meldeverzicht"],
    metaTitel: "Ratenplan berechnen: Die Rate, die der Gläubiger annimmt",
    metaBeschreibung: "Ratenplan berechnen: Gläubiger nehmen das Angebot an, das hält. Wie Sie die Rate aus dem Spielraum ableiten und was ins Angebot gehört. Mit Brief.",
    faq: [
      { frage: "Wie hoch sollte meine Rate sein?", antwort: "So hoch, dass sie auch in einem schlechten Monat sicher kommt. Faustregel aus der Schuldnerberatung: höchstens die Hälfte dessen, was nach Fixkosten und Lebenshaltung übrig bleibt. Der Ratenplan-Rechner schlägt eine sichere und eine zügige Variante vor und zeigt die Laufzeit beider." },
      { frage: "Muss der Gläubiger mein Angebot annehmen?", antwort: "Nein – eine Forderung ist auf einmal fällig, Ratenzahlung ist Entgegenkommen. In der Praxis nehmen Gläubiger und Inkassounternehmen tragfähige Angebote fast immer an, weil die Alternative Vollstreckung mit ungewissem Ausgang ist. Entscheidend ist ein realistischer Betrag und ein fester erster Termin." },
      { frage: "Was gehört in das Angebot?", antwort: "Forderung, Rate, erster Zahlungstermin, Laufzeit – und drei Bitten: Verzicht auf weitere Zinsen und Kosten ab Beginn der Ratenzahlung, keine Meldung an Auskunfteien während der pünktlichen Zahlung, Ruhen der Beitreibung. Alles schriftlich bestätigen lassen." },
      { frage: "Ist ein Ratenplan ein Schuldanerkenntnis?", antwort: "Er kann so gewertet werden und lässt die Verjährung neu beginnen (§ 212 BGB). Prüfen Sie vor dem Angebot, ob die Forderung berechtigt und nicht verjährt ist und ob die Nebenkosten stimmen. Ein Ratenplan gehört zu einer berechtigten Forderung – nicht zu einer zweifelhaften." },
      { frage: "Was passiert, wenn ich eine Rate nicht zahlen kann?", antwort: "Melden Sie sich vorher, nicht nachher. Ein Anruf oder ein Schreiben vor dem Fälligkeitstag ist Verhandlung; eine geplatzte Rate danach ist Vertragsbruch und oft der Anlass für die Meldung. Die meisten Gläubiger stunden eine Rate, wenn sie rechtzeitig gefragt werden." },
    ],
    inhalt: `Die Forderung liegt bei 1.840 Euro, das Inkasso will „umgehend“ den vollen Betrag, und der Kontostand sagt: nicht möglich. In dieser Lage machen viele Menschen ein Angebot, das aus Scham zu hoch ist – 250 Euro im Monat, weil 100 „so wenig“ wirken. Drei Monate später platzt die vierte Rate, das Inkasso kündigt die Vereinbarung, und die Meldung an die Auskunftei ist da, die der Ratenplan verhindern sollte.

Der Fehler liegt nicht im Ratenplan, sondern in der Rate. Dieser Text erklärt, wie Sie sie aus dem echten Spielraum ableiten, warum die kleinere Rate fast immer die bessere ist, was in das Angebot gehört und was ein Ratenplan rechtlich bedeutet.

## Erst der Spielraum, dann die Rate

Die Rate beginnt nicht bei der Forderung, sondern beim Haushalt. Einnahmen minus Fixkosten – Miete, Energie, Versicherungen, Mobilfunk, laufende Raten – minus Lebenshaltung ergibt den Betrag, der monatlich tatsächlich frei ist. Wer das nicht auf den Euro weiß, schätzt zu hoch: Nach der Überschuldungsstatistik des Statistischen Bundesamts gehört „unwirtschaftliche Haushaltsführung“ zwar nicht zu den Hauptauslösern von Überschuldung, aber Schuldnerberatungen berichten, dass die meisten Ratsuchenden ihre monatlichen Ausgaben unterschätzen. Der [Spielraum-Rechner](/werkzeuge/spielraum) rechnet es mit denselben Kategorien, die eine Bank ansetzt.

*Quelle: Statistisches Bundesamt, Überschuldungsstatistik 2023.*

## Die Hälfte hält

Die Faustregel aus der Praxis der Schuldnerberatung: Bieten Sie höchstens die Hälfte des Spielraums an. Der Grund ist nicht Vorsicht, sondern Arithmetik. Ein Spielraum ist ein Durchschnitt – in einem Monat mit Autoreparatur oder Nachzahlung ist er halb so groß, in einem anderen doppelt. Eine Rate, die im Durchschnittsmonat gerade so passt, platzt im schlechten Monat. Eine Rate in Höhe der Hälfte des Spielraums kommt auch dann.

Der [Ratenplan-Rechner](/werkzeuge/ratenplan) schlägt zwei Varianten vor: die sichere Rate bei der Hälfte des Spielraums und die zügige bei 70 Prozent – Letztere nur bei stabilen Einnahmen. Er zeigt für beide die Laufzeit und die letzte Rate und stellt die ehrliche Gegenfrage: Wenn Ihr Spielraum 20 Prozent kleiner ist als gedacht – trägt die Rate dann noch?

## Warum Gläubiger die kleinere Rate annehmen

Ein Inkassounternehmen bewertet ein Ratenangebot nicht nach der Höhe, sondern nach der Wahrscheinlichkeit, dass es eingehalten wird. Eine Vereinbarung, die nach drei Raten scheitert, kostet den Gläubiger Verwaltungsaufwand und bringt ihn dem Geld nicht näher. 80 Euro über 23 Monate, pünktlich, sind für ihn mehr wert als 200 Euro, die dreimal kommen. Das erklärt, warum tragfähige Angebote fast immer angenommen werden – und warum ein Angebot, das mit einer Haushaltsrechnung begründet ist, besser ankommt als eines ohne.

Lange Laufzeiten – über drei Jahre – akzeptieren viele Gläubiger nur mit Nachweis. Dann lohnt die Frage, ob eine Einmalzahlung mit Teilverzicht möglich ist, etwa aus einem Darlehen im Familienkreis, oder ob die kostenlose Schuldnerberatung einen Vergleich verhandelt.

## Was in das Angebot gehört

Forderung, Rate, erster Zahlungstermin, Laufzeit, letzte Rate – und drei Bitten, die den Unterschied machen. Erstens: Verzicht auf weitere Verzugszinsen und Kosten ab Beginn der Ratenzahlung – viele Gläubiger stimmen zu, weil die Sicherheit mehr wert ist als die Zinsen. Zweitens: keine Meldung an Auskunfteien während der vereinbarungsgemäßen Zahlung, beziehungsweise der Erledigt-Vermerk für eine bestehende Meldung. Drittens: Ruhen der Beitreibung. Dazu die Bitte um Bankverbindung und Verwendungszweck und die Zusage, die erste Rate nach Bestätigung zu überweisen.

Der Rechner erzeugt das Angebotsschreiben als Mustertext – zum Anpassen, nicht als rechtliche Prüfung im Einzelfall. Was der Text bewusst enthält: den Vorbehalt, dass die Höhe der Nebenforderungen zur Prüfung bleibt. Überhöhte Inkassokosten gehören nicht in den Ratenplan; der [Inkassokosten-Prüfer](/werkzeuge/inkassokosten) rechnet sie vorher nach.

## Was ein Ratenplan rechtlich bedeutet

Eine Ratenvereinbarung kann als Anerkenntnis der Forderung gewertet werden – und ein Anerkenntnis lässt die Verjährung neu beginnen (§ 212 BGB). Wer eine Forderung in Raten zahlt, die eigentlich verjährt war, hat sie wiederbelebt. Deshalb steht vor jedem Angebot die Prüfung: Ist die Forderung berechtigt? Ist sie nicht verjährt? Der [Verjährungs-Rechner](/werkzeuge/verjaehrung) beantwortet die zweite Frage in einer Minute.

Umgekehrt schützt der Ratenplan: Solange eine Vereinbarung besteht und eingehalten wird, gilt die Forderung in der Regel nicht mehr als fällig im Sinne von § 31 Abs. 2 BDSG – eine Meldung wäre angreifbar. Lassen Sie sich das schriftlich bestätigen; die Bestätigung ist später der Beleg für den Erledigt-Vermerk.

*Quelle: § 212 BGB; § 31 Abs. 2 BDSG.*

## Wie der Plan hält

Alle Raten auf denselben Tag – direkt nach dem Gehaltseingang. Dauerauftrag statt Handüberweisung. Eine Monatsrate als Puffer auf dem Konto, von dem abgebucht wird. Bei Engpass: vor dem Fälligkeitstag melden, nicht danach – ein Anruf vorher ist Verhandlung, eine geplatzte Rate danach ist Vertragsbruch. Und jede Bestätigung aufheben.

Jede pünktliche Rate ist dabei mehr als Tilgung: Sie ist ein Positivdatum, das eine Historie baut. Zwölf Raten, zwölf Beweise – die Seite [Ratenzahlung und Bonität](/ratenzahlung-und-bonitaet) erklärt, warum das für Kartenpartner zählt.

## Schritt für Schritt: Vom Spielraum zur Zusage

1. **Forderung prüfen, bevor Sie anbieten.** Berechtigt? Nicht verjährt? Nebenkosten korrekt? Ein Ratenangebot kann als Anerkenntnis gelten – es gehört nur zu einer Forderung, die Sie nach Prüfung tatsächlich schulden.
2. **Spielraum rechnen, nicht schätzen.** Drei Kontoauszüge, alle Fixkosten, ehrliche Lebenshaltung. Der [Spielraum-Rechner](/werkzeuge/spielraum) liefert die Zahl, aus der die Rate folgt.
3. **Rate wählen.** Die Hälfte des Spielraums als sichere Variante, 70 Prozent nur bei stabilem Einkommen. Der [Ratenplan-Rechner](/werkzeuge/ratenplan) zeigt Laufzeit und letzte Rate für beide.
4. **Angebot schreiben.** Rate, erster Termin, Laufzeit – und die drei Bitten: Zins- und Kostenverzicht, keine Meldung während der Zahlung, Ruhen der Beitreibung. Schriftlich, per Einschreiben, mit der Bitte um Bankverbindung.
5. **Zusage sichern.** Erst nach schriftlicher Bestätigung überweisen. Die Bestätigung ist der Beleg für den Erledigt-Vermerk und für den Fall, dass später doch gemeldet wird.
6. **Automatisieren und durchhalten.** Dauerauftrag am Tag nach dem Gehalt, Puffer von einer Rate, bei Engpass vor dem Termin melden. Nach der letzten Rate: Erledigungsbestätigung anfordern und aufheben.

Zur Verhandlung selbst: Ein Gegenangebot des Gläubigers – höhere Rate, kürzere Laufzeit – ist kein Grund, nachzugeben, wenn die Zahl nicht trägt. Antworten Sie mit der Haushaltsrechnung und bleiben Sie bei Ihrer Rate; ein Gläubiger, der ein tragfähiges Angebot ablehnt, muss vollstrecken und bekommt auf diesem Weg meist weniger und später. Anders bei einem Angebot der Gegenseite, das Ihnen entgegenkommt – etwa eine Einmalzahlung mit Teilverzicht von 20 bis 40 Prozent. Das ist bei alten Forderungen üblich und oft günstiger als jeder Ratenplan, wenn die Summe aus dem Umfeld aufzubringen ist.

Ein letzter Punkt, der in Ratenvereinbarungen oft fehlt: die Klausel für den Fall des Scheiterns. Viele Inkassounternehmen schreiben in ihre Bestätigung, dass bei einer einzigen verspäteten Rate die gesamte Restforderung sofort fällig wird. Bitten Sie um eine Formulierung mit Nachfrist – zum Beispiel: Verzug erst, wenn eine Rate 14 Tage nach schriftlicher Erinnerung nicht eingegangen ist. Nicht jeder Gläubiger stimmt zu, aber wer fragt, bekommt es häufiger, als man denkt.

## Was nicht geht

Ein Ratenplan löst keine Überschuldung. Deckt das Budget die Mindestraten aller Gläubiger nicht, hilft kein Angebot – dann gehört der Fall in die kostenlose, staatlich anerkannte Schuldnerberatung, die Raten bündeln und Vergleiche verhandeln kann. Der [Schuldenfrei-Plan](/werkzeuge/schuldenplan) sagt es ehrlich, wenn Sie an diesem Punkt sind.

Aus der FIAON-Praxis: Die Ratenvereinbarungen, die halten, haben eine Gemeinsamkeit – sie wurden aus dem Kontoauszug abgeleitet, nicht aus dem schlechten Gewissen. FIAON macht genau das: Spielraum aus dem Kontoauszug, Angebote, die passen, Versand und Verfolgung jeder Antwort.`,
  },
  {
    slug: "schuldenfrei-plan-lawine-schneeball-rechnen",
    titel: "Schuldenfrei-Plan: Lawine oder Schneeball – welche Reihenfolge Sie wirklich schneller rausbringt",
    untertitel: "Zwei Strategien, ein Budget: Die teuerste Schuld zuerst spart Zinsen, die kleinste zuerst spart Nerven. Was die Rechnung sagt, was die Psychologie sagt – und woran Sie erkennen, dass kein Plan mehr reicht.",
    teaser: "Lawine (Zins zuerst) oder Schneeball (kleinste zuerst)? Monat für Monat gerechnet, wann der Unterschied zählt – und wann kein Plan mehr reicht.",
    kategorie: "score", land: "DACH", keyword: "schulden abbauen reihenfolge lawine schneeball",
    schlagworte: ["Schuldenfrei", "Schneeball-Methode", "Lawinen-Methode", "Schulden abbauen", "Tilgungsplan", "Schuldnerberatung"],
    metaTitel: "Schuldenfrei-Plan: Lawine oder Schneeball?",
    metaBeschreibung: "Schuldenfrei-Plan: Höchster Zins zuerst oder kleinste Schuld zuerst? Monat für Monat gerechnet, was beide Wege kosten. Mit Rechner.",
    faq: [
      { frage: "Was ist die Lawinen-Methode?", antwort: "Alle Schulden bekommen ihre Mindestrate; jedes Extra-Geld fließt in die Schuld mit dem höchsten Zinssatz. Ist sie getilgt, wandert ihre Rate zur nächstteuersten. Mathematisch ist das der Weg mit den geringsten Gesamtzinsen und der kürzesten Laufzeit." },
      { frage: "Was ist die Schneeball-Methode?", antwort: "Gleiches Prinzip, andere Reihenfolge: Das Extra-Geld geht in die kleinste Schuld. Sie ist schnell getilgt, ein Gläubiger weniger, und die freigewordene Rate rollt auf die nächste – der Schneeball wächst. Das kostet meist etwas mehr Zinsen, hält aber viele Menschen im Plan, weil der erste Erfolg früh kommt." },
      { frage: "Welche Methode ist besser?", antwort: "Rechnerisch die Lawine, praktisch oft der Schneeball. Der Rechner zeigt die Differenz bei Ihren Zahlen: Liegt sie bei wenigen Dutzend Euro, nehmen Sie den Schneeball – die Wahrscheinlichkeit, durchzuhalten, ist mehr wert. Ist sie groß, lohnt die Lawine, wenn Sie monatelang ohne sichtbaren Erfolg auskommen." },
      { frage: "Was, wenn mein Budget die Mindestraten nicht deckt?", antwort: "Dann ist kein Plan die Lösung, sondern Verhandlung: niedrigere Raten bei den Gläubigern (Ratenplan-Rechner) und die kostenlose, staatlich anerkannte Schuldnerberatung, die bündeln, stunden und Vergleiche verhandeln kann. Der Rechner sagt Ihnen offen, wenn Sie an diesem Punkt sind." },
      { frage: "Sollte ich Schulden lieber umschulden als abbezahlen?", antwort: "Wenn ein neuer Kredit alle teuren Schulden zu einem deutlich niedrigeren Zins ablöst und die Rate ins Budget passt: ja – der Umschuldungsrechner rechnet es. Mit negativen Einträgen gibt es diesen Kredit aber selten. Dann ist der Plan mit vorhandenen Mitteln der realistische Weg." },
    ],
    inhalt: `Drei Schulden, ein Budget: ein Ratenkredit mit 4.000 Euro Restschuld zu 7 Prozent, ein Dispo mit 1.500 Euro zu 11,3 Prozent, eine Kreditkarte mit 800 Euro zu 15 Prozent. Nach den Mindestraten bleiben 120 Euro im Monat übrig. Wohin damit? Die meisten Menschen entscheiden das nach Gefühl – auf die Schuld, die am meisten nervt, oder auf die, deren Gläubiger zuletzt angerufen hat. Beides ist teuer.

Es gibt zwei Strategien mit Namen, und beide funktionieren. Die Lawine zahlt die teuerste Schuld zuerst. Der Schneeball zahlt die kleinste zuerst. Welche für Sie richtig ist, hängt von zwei Zahlen ab, die der Rechner ausspuckt – und von einer ehrlichen Einschätzung Ihrer Selbst.

## Die Lawine: Zins zuerst

Alle Schulden bekommen ihre Mindestrate, damit keine Vereinbarung platzt. Das Extra-Geld – die 120 Euro – geht komplett in die Schuld mit dem höchsten Zinssatz, im Beispiel die Kreditkarte zu 15 Prozent. Ist sie getilgt, wandert ihre Mindestrate plus das Extra-Geld zur nächstteuersten, dem Dispo. Zuletzt der Ratenkredit.

Das ist mathematisch der optimale Weg: Jeder Euro Extra-Tilgung spart dort die meisten Zinsen, wo der Zins am höchsten ist. Im Beispiel dauert die Lawine je nach Mindestraten rund zwei bis drei Jahre, und sie kostet die geringsten Gesamtzinsen aller möglichen Reihenfolgen.

## Der Schneeball: Kleinste zuerst

Gleiche Mindestraten, anderes Ziel für das Extra-Geld: die kleinste Schuld – im Beispiel ebenfalls die Kreditkarte, aber nur zufällig; oft ist die kleinste Schuld nicht die teuerste. Sie ist nach wenigen Monaten weg. Ein Gläubiger weniger, ein Brief weniger, eine Abbuchung weniger. Die freigewordene Rate rollt auf die nächstkleinere Schuld – der Schneeball wächst mit jeder Tilgung.

Der Schneeball kostet meist mehr Zinsen als die Lawine, weil er teure Schulden länger laufen lässt. Aber er liefert den ersten Erfolg früh – und das ist keine Kleinigkeit. Verhaltensökonomische Untersuchungen zur Schuldentilgung, unter anderem an der Kellogg School of Management, kamen zu dem Ergebnis, dass Menschen, die kleine Schulden zuerst abschließen, mit höherer Wahrscheinlichkeit den gesamten Plan durchhalten. Der Plan, der durchgehalten wird, schlägt den Plan, der optimal war.

*Quelle: Gal/McShane, „Can Small Victories Help Win the War? Evidence from Consumer Debt Management“, Journal of Marketing Research, 2012.*

## Die Differenz, die entscheidet

Der [Schuldenfrei-Plan](/werkzeuge/schuldenplan) simuliert beide Strategien Monat für Monat mit Ihren Zahlen – bis zu sechs Schulden mit Restschuld, Zins und Mindestrate, ein Budget – und nennt für beide das Datum, die Gesamtzinsen und die Reihenfolge der Tilgung. Die entscheidende Zahl ist die Differenz der Zinsen. Liegt sie bei 30, 50, 80 Euro über die gesamte Laufzeit, ist die Frage beantwortet: Schneeball, weil der frühe Erfolg mehr wert ist als 50 Euro. Liegt sie bei mehreren hundert Euro – bei großen Schulden mit stark unterschiedlichen Zinsen –, lohnt die Lawine, wenn Sie sich zutrauen, ein Jahr ohne sichtbaren Erfolg durchzuhalten.

## Woran der Rechner die Grenze erkennt

Zwei Ergebnisse zeigt der Rechner nicht als Plan, sondern als Warnung. Erstens: Das Budget deckt die Mindestraten nicht. Dann ist kein Plan der Welt die Lösung, sondern Verhandlung – niedrigere Raten bei den Gläubigern, mit einem Angebot aus dem [Ratenplan-Rechner](/werkzeuge/ratenplan), und die kostenlose, staatlich anerkannte Schuldnerberatung, die bündeln, stunden und Vergleiche verhandeln kann. Nach dem SchuldnerAtlas der Creditreform galten 2024 rund 5,56 Millionen Erwachsene in Deutschland als überschuldet; die Schuldnerberatungsstellen sind der Ort, an dem dieser Fall hingehört – nicht eine Tabelle.

Zweitens: Bei einer Schuld ist die Mindestrate kleiner als die monatlichen Zinsen. Diese Schuld wächst, egal wie lange Sie zahlen – ein typisches Muster bei Kreditkartenrahmen mit Mindesttilgung und bei Dispos. Sie braucht als Erstes das Extra-Geld oder eine Umschuldung, unabhängig von jeder Strategie.

*Quelle: Creditreform, SchuldnerAtlas Deutschland 2024.*

## Umschuldung als dritte Strategie

Wenn ein neuer Kredit alle teuren Schulden zu einem deutlich niedrigeren Zins ablöst und die Rate ins Budget passt, schlägt die Umschuldung beide Strategien – der [Umschuldungsrechner](/werkzeuge/umschuldung) rechnet es inklusive Vorfälligkeitsentschädigung. Die Voraussetzung ist eine Bank, die den Kredit gibt, und die fehlt mit negativen Einträgen meistens. Dann ist der Plan mit vorhandenen Mitteln der realistische Weg – und die Umschuldung das Ziel, das nach einem Jahr sauberer Zahlungshistorie wieder erreichbar wird.

## Wie der Plan hält

Alle Raten und das Extra-Geld per Dauerauftrag am Tag nach dem Gehalt – wer jeden Monat neu entscheidet, entscheidet irgendwann anders. Ist eine Schuld getilgt, wandert ihre Rate sofort auf die nächste, nicht in den Alltag. Eine Rate als Puffer auf dem Konto. Und jede pünktliche Rate ist ein Positivdatum: Sie baut die Zahlungshistorie, die Banken später lesen. Die Seite [Ratenzahlung und Bonität](/ratenzahlung-und-bonitaet) erklärt, warum zwölf pünktliche Raten mehr wert sind als jede Score-App.

## Schritt für Schritt: Den Plan aufsetzen

1. **Alle Schulden auf eine Seite.** Gläubiger, Restschuld, Zinssatz, Mindestrate, Fälligkeitstag – für jede Position. Was Sie nicht wissen, steht im Vertrag oder in der letzten Abrechnung; der Dispozins im Preisaushang.
2. **Budget aus dem Kontoauszug.** Nicht aus dem Gefühl. Einnahmen minus Fixkosten minus Lebenshaltung, gerechnet über drei Monate – der [Spielraum-Rechner](/werkzeuge/spielraum) hilft.
3. **Strategie wählen.** Beide Wege im [Schuldenfrei-Plan](/werkzeuge/schuldenplan) rechnen. Kleine Zinsdifferenz: Schneeball. Große Differenz und Disziplin: Lawine. Eine Schuld, deren Rate die Zinsen nicht deckt: zuerst, egal welche Strategie.
4. **Raten bündeln.** Alle Fälligkeiten auf einen Tag direkt nach dem Gehalt legen – die meisten Gläubiger stimmen einer Verschiebung des Abbuchungstags zu. Dauerauftrag für das Extra-Geld auf die Zielschuld.
5. **Monatlich prüfen, nicht täglich.** Einmal im Monat der Blick auf die Liste: Restschulden aktualisieren, getilgte Position streichen, freigewordene Rate weiterrollen. Der Plan lebt von der Wiederholung, nicht von der Kontrolle.
6. **Meilensteine markieren.** Jede getilgte Schuld ist ein Datum, das in den Kalender gehört – und ein Gläubiger, bei dem Sie die Erledigungsbestätigung anfordern und aufheben, damit später kein Eintrag ohne Erledigt-Vermerk stehen bleibt.

Ein Wort zur Reihenfolge, wenn Gläubiger drängen: Der Plan gilt für Schulden mit vereinbarter Rate. Kommt währenddessen eine neue Forderung – Inkasso, Mahnbescheid –, hat sie Vorrang vor jeder Strategie, weil dort Fristen laufen. Prüfen, antworten, gegebenenfalls eine Rate vereinbaren, dann die neue Position in den Plan aufnehmen. Was der Plan nicht abbilden kann, sind titulierte Forderungen mit laufender Pfändung; sie bedienen sich selbst aus dem pfändbaren Einkommen, und das Budget ist entsprechend kleiner anzusetzen.

Und zur Frage, die fast jeder stellt: „Soll ich erst sparen oder erst tilgen?“ Bei Zinsen von 11 Prozent auf dem Dispo und 2 bis 3 Prozent auf dem Tagesgeld ist die Antwort rechnerisch eindeutig – tilgen. Die Ausnahme ist der Notgroschen: Eine Rücklage von einer Monatsrate, besser von einem halben Monatsnetto, verhindert, dass die nächste Autoreparatur auf dem Dispo landet und den Plan zurückwirft. Diese Rücklage kommt vor dem Extra-Geld; alles darüber hinaus kommt in die Tilgung.

## Was nicht geht

Kein Plan senkt Zinsen, verhandelt mit Gläubigern oder löscht Einträge – er ordnet, was da ist. Er rechnet ohne Sondertilgungsgebühren und ohne Vorfälligkeitsentschädigung, und er kennt Ihre Verträge nicht. Wer einen Ratenkredit vorzeitig ablöst, sollte vorher in den Vertrag sehen. Und wer zwischen Schneeball und Lawine schwankt: Beide sind besser als gar keine Reihenfolge. Fangen Sie an.

FIAON schreibt die Ratenangebote, verfolgt die Antworten und räumt nebenbei die Einträge auf, die schon entstanden sind – der Plan kommt von Ihnen, die Umsetzung kann von uns kommen. Mehr auf der Seite [Bonität verbessern](/bonitaet-verbessern).`,
  },
];
