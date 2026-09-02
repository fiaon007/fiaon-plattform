// ═══════════════════════════════════════════════════════════════════════════
// Zehn Ratgeber zu den zehn neuen Werkzeugen — Teil 2 (02.09.2026, E-080)
// Regeln wie in Teil 1: jede Zahl mit Quelle, Sie-Form, keine Schuldnerberatung,
// keine Garantie, ehrlicher Abschnitt „Was nicht geht“, ein Werkzeug je Text.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "./fiaon-ratgeber-start";

export const WERKZEUG_ARTIKEL_2: StartArtikel[] = [
  {
    slug: "basiskonto-abgelehnt-bafin-verwaltungsverfahren",
    titel: "Basiskonto abgelehnt? Warum die Bank Sie nicht abweisen darf – und wie die BaFin das Konto anordnet",
    untertitel: "Seit 2016 hat jeder Verbraucher Anspruch auf ein Girokonto – auch mit Einträgen, auch ohne festen Wohnsitz. Trotzdem lehnen Banken ab, verschleppen oder verweisen an andere. Was das Gesetz erlaubt, welche Fristen gelten und wie das kostenlose Verwaltungsverfahren funktioniert.",
    teaser: "Ein SCHUFA-Eintrag ist kein Ablehnungsgrund: Die Bank hat zehn Geschäftstage und vier zulässige Gründe. Wie die BaFin das Konto anordnet.",
    kategorie: "karte", land: "DE", keyword: "basiskonto abgelehnt",
    schlagworte: ["Basiskonto", "§ 31 ZKG", "BaFin", "Verwaltungsverfahren", "Girokonto trotz SCHUFA", "Zahlungskontengesetz"],
    metaTitel: "Basiskonto abgelehnt: Ihr Recht und der Weg zur BaFin",
    metaBeschreibung: "Basiskonto abgelehnt? Ein SCHUFA-Eintrag ist kein Grund: zehn Geschäftstage, vier zulässige Ablehnungsgründe, kostenloses BaFin-Verfahren (§ 48 ZKG).",
    faq: [
      { frage: "Darf eine Bank das Basiskonto wegen eines SCHUFA-Eintrags ablehnen?", antwort: "Nein. Die Bonität gehört nicht zu den Ablehnungsgründen, die das Zahlungskontengesetz abschließend aufzählt (§§ 35, 36 ZKG). Das Basiskonto wird auf Guthabenbasis geführt – die Bank trägt kein Kreditrisiko. Eine Ablehnung „wegen der SCHUFA“ ist unzulässig." },
      { frage: "Wie lange darf die Bank sich Zeit lassen?", antwort: "Zehn Geschäftstage nach Eingang des vollständigen Antrags (§ 33 Abs. 3 ZKG). Innerhalb dieser Frist muss sie den Vertrag anbieten oder schriftlich und mit Begründung ablehnen. Verstreicht die Frist ohne Antwort, können Sie das Verwaltungsverfahren bei der BaFin beantragen." },
      { frage: "Was kostet das Basiskonto?", antwort: "Ein angemessenes Entgelt, das sich an marktüblichen Kontoführungsentgelten und dem Nutzerverhalten orientiert (§ 41 ZKG). Der BGH hat 2020 die Preisklausel einer Großbank für Basiskonten gekippt, weil sie die Kosten der Kontoführung für Basiskontoinhaber überproportional belastete (XI ZR 119/19). Gebühren zwischen null und rund zehn Euro im Monat sind heute üblich." },
      { frage: "Was macht die BaFin genau?", antwort: "Auf Ihren Antrag prüft die Bundesanstalt für Finanzdienstleistungsaufsicht, ob die Ablehnung oder Verzögerung rechtmäßig war. War sie es nicht, ordnet sie gegenüber der Bank die Eröffnung an (§ 48 ZKG). Das Verfahren ist kostenlos; der Antrag geht online oder per Formular an die BaFin in Bonn." },
      { frage: "Gibt es das Basiskonto auch in Österreich und der Schweiz?", antwort: "In Österreich ja – das Verbraucherzahlungskontogesetz (VZKG) gibt seit 2016 denselben Anspruch, zuständig ist die FMA. In der Schweiz gibt es keinen gesetzlichen Anspruch; PostFinance ist per Grundversorgungsauftrag verpflichtet, Konten zu führen, und lehnt nur in engen Grenzen ab." },
    ],
    inhalt: `„Wir können Ihnen leider kein Konto eröffnen.“ Der Satz fällt am Schalter, und er fällt oft mit einem Blick auf den Bildschirm, der nichts erklärt. Für Menschen mit einem negativen Eintrag fühlt er sich an wie das Ende – kein Konto, kein Gehalt, keine Miete, kein Handyvertrag. Dabei ist er seit dem 19. Juni 2016 in den allermeisten Fällen schlicht rechtswidrig.

An diesem Tag trat das Zahlungskontengesetz in Kraft, das die europäische Zahlungskontenrichtlinie umsetzt. Sein Kern in einem Satz: Jeder Verbraucher mit rechtmäßigem Aufenthalt in der EU hat Anspruch auf ein Basiskonto bei jeder Bank, die Zahlungskonten für Verbraucher anbietet. Dieser Text erklärt, was das bedeutet, was die Bank darf, und wie Sie den Anspruch durchsetzen – ohne Anwalt, ohne Kosten.

## Wer den Anspruch hat

§ 31 ZKG spricht von Verbrauchern mit rechtmäßigem Aufenthalt in der Europäischen Union – ausdrücklich auch von Menschen ohne festen Wohnsitz, Asylsuchenden und Geduldeten. Es kommt nicht auf Einkommen, nicht auf Bonität, nicht auf Einträge bei Auskunfteien an. Das Basiskonto ist ein Konto auf Guthabenbasis: Ein- und Auszahlungen, Überweisungen, Lastschriften, Daueraufträge, eine Karte zum Bezahlen. Kein Dispo, kein Kredit – deshalb trägt die Bank kein Risiko, und deshalb spielt Ihre Bonität keine Rolle.

Verpflichtet ist jede Bank, die auf dem deutschen Markt Zahlungskonten für Verbraucher anbietet (§ 31 Abs. 1 ZKG): Sparkassen, Volks- und Raiffeisenbanken, Privatbanken, Direktbanken. Die Bank darf Sie nicht an „die Sparkasse“ oder „Ihre Hausbank“ verweisen – Sie wählen.

*Quelle: §§ 30, 31 ZKG; Richtlinie 2014/92/EU.*

## Die zehn Geschäftstage

Nach Eingang eines vollständigen Antrags hat die Bank zehn Geschäftstage, um Ihnen den Abschluss des Basiskontovertrags anzubieten – oder den Antrag schriftlich und mit Begründung abzulehnen (§§ 33, 34 ZKG). Vollständig heißt: Antragsformular, Ausweisdokument, bei fehlender Meldeadresse eine Erreichbarkeitsanschrift. Die Bank muss Ihnen ein Antragsformular zur Verfügung stellen; das gesetzliche Muster ist einheitlich.

Aus der Praxis: Der häufigste Fehler ist der mündliche Antrag. Wer am Schalter fragt und ein „Das geht nicht“ hört, hat keinen Antrag gestellt und keine Frist ausgelöst. Stellen Sie den Antrag schriftlich, lassen Sie sich den Eingang quittieren – oder schicken Sie ihn per Einschreiben. Ab dann läuft die Zeit. Der [Basiskonto-Helfer](/werkzeuge/basiskonto) rechnet die zehn Geschäftstage ab Ihrem Antragsdatum und erzeugt, wenn die Frist verstrichen ist, die Erinnerung an die Bank.

## Die vier Gründe – und was nicht dazugehört

Das Gesetz zählt die Ablehnungsgründe abschließend auf. Eine Bank darf ablehnen, wenn Sie bereits ein Zahlungskonto bei einer Bank in Deutschland haben, das Sie tatsächlich nutzen können (§ 35 Abs. 1 ZKG); wenn Sie in den letzten drei Jahren wegen einer vorsätzlichen Straftat gegen diese Bank oder ihre Mitarbeiter verurteilt wurden; wenn ein früheres Konto bei dieser Bank wegen einer schweren Vertragsverletzung – etwa Zahlungsverzug bei Entgelten trotz Mahnung oder missbräuchlicher Nutzung – gekündigt wurde; oder wenn die Eröffnung gegen das Geldwäschegesetz verstoßen würde (§ 36 ZKG).

Nicht in dieser Liste stehen: negative Einträge bei Auskunfteien, eine laufende Insolvenz, Pfändungen, geringes oder fehlendes Einkommen, eine frühere Kündigung bei einer anderen Bank. Wer mit einer dieser Begründungen abgelehnt wird, wird rechtswidrig abgelehnt.

*Quelle: §§ 35, 36 ZKG.*

## Was das Konto kosten darf

Das Entgelt für das Basiskonto muss angemessen sein und sich an den marktüblichen Entgelten sowie am Nutzerverhalten orientieren (§ 41 ZKG). Der Bundesgerichtshof hat 2020 entschieden, dass eine Bank die Kosten des Basiskontos nicht gezielt auf die Basiskontoinhaber umlegen darf – eine Klausel mit 8,99 Euro Grundgebühr plus Buchungsentgelten war unwirksam, weil sie Basiskontoinhaber gegenüber anderen Kunden benachteiligte (Urteil vom 30.06.2020, XI ZR 119/19). Seither liegen die Gebühren bei den meisten Instituten im Bereich der normalen Kontoführung; die Spanne ist groß, vergleichen lohnt sich.

*Quelle: § 41 ZKG; BGH, Urteil vom 30.06.2020, XI ZR 119/19.*

## Das Verwaltungsverfahren bei der BaFin

Lehnt die Bank ab oder lässt sie die Frist verstreichen, können Sie bei der Bundesanstalt für Finanzdienstleistungsaufsicht ein Verwaltungsverfahren beantragen (§ 48 ZKG). Das Formular „Antrag auf Durchführung eines Verwaltungsverfahrens bei Ablehnung eines Basiskontos“ gibt es online und als PDF; beizufügen sind die Kopie Ihres Antrags bei der Bank, die Ablehnung (falls schriftlich erfolgt) und eine Ausweiskopie. Der Antrag geht an die BaFin, Referat VBS 12, Graurheindorfer Straße 108, 53117 Bonn.

Die BaFin bestätigt den Eingang, fordert die Bank zur Stellungnahme auf, prüft die Ablehnungsgründe – und ordnet die Eröffnung des Kontos an, wenn die Ablehnung unrechtmäßig war. Das Verfahren ist gebührenfrei. Nach Angaben der BaFin gehen jährlich mehrere hundert solcher Anträge ein; in einem erheblichen Teil eröffnen die Banken das Konto bereits, sobald die Aufsicht nachfragt.

*Quelle: § 48 ZKG; BaFin, Verbraucherinformation Basiskonto.*

## Der parallele Weg

Sie müssen nicht warten. Das Verwaltungsverfahren dauert Wochen; ein Antrag bei einer zweiten Bank kann schneller sein. Beides schließt sich nicht aus – das Gesetz verlangt nur, dass Sie nicht bereits ein nutzbares Konto haben. Stellen Sie den zweiten Antrag genauso: schriftlich, mit Quittung, mit Frist. Und lassen Sie sich von keiner Bank erzählen, das Basiskonto sei „nur etwas für Härtefälle“ oder „nur für Bestandskunden“ – beides steht nicht im Gesetz.

## Basiskonto oder FIAON-Weg

Das Basiskonto ist Ihr gesetzliches Recht, unabhängig von uns. Es ist der Boden, auf dem alles Weitere steht: Gehaltseingänge, pünktliche Abbuchungen, keine Rückgaben – die Kontoführung, die Banken lesen, wenn sie später über eine Karte oder einen Kredit entscheiden. Der FIAON-Weg baut darauf: Auskunft in Ordnung bringen, Konto sauber führen, dann den Kartenantrag stellen, wenn die Akte ihn trägt. Über die Vergabe entscheidet die Bank – aber sie entscheidet nach der Akte, und die lässt sich bauen. Mehr auf der Seite [Girokonto trotz negativer Bonität](/girokonto-trotz-negativer-bonitaet).

## Schritt für Schritt: Vom Antrag zum Konto

1. **Bank wählen.** Jede Bank mit Verbraucherkonten ist verpflichtet. Sinnvoll ist eine mit Filiale oder gutem Online-Zugang, angemessener Gebühr und Debitkarte ohne Aufpreis – vergleichen Sie die Preisverzeichnisse.
2. **Antrag schriftlich stellen.** Das Antragsformular der Bank (sie muss es Ihnen geben) oder ein formloses Schreiben: „Hiermit beantrage ich den Abschluss eines Basiskontovertrags nach § 31 ZKG.“ Ausweiskopie beilegen, bei fehlender Meldeadresse eine Erreichbarkeitsanschrift.
3. **Eingang nachweisen.** Quittung am Schalter, Einschreiben oder das Datum der Online-Einreichung. Ab dem vollständigen Eingang laufen die zehn Geschäftstage – der [Basiskonto-Helfer](/werkzeuge/basiskonto) rechnet den letzten Tag.
4. **Antwort prüfen.** Vertrag: unterschreiben, Gebühr kontrollieren. Ablehnung: Begründung gegen die vier zulässigen Gründe halten. Keine Antwort: Erinnerung mit Nachfrist, Ankündigung des BaFin-Verfahrens.
5. **BaFin-Antrag stellen.** Formular ausfüllen, Kopien von Antrag, Ablehnung und Ausweis beifügen, absenden. Parallel den Antrag bei einer zweiten Bank stellen – beides schließt sich nicht aus.
6. **Konto in Betrieb nehmen.** Gehalt oder Leistung auf das neue Konto umleiten, Lastschriften umstellen, Dauerauftrag für Miete – und ab dem ersten Monat so führen, wie eine Bank es später lesen will: pünktlich, ohne Rückgaben.

Zwei Missverständnisse begegnen uns in Kundengesprächen immer wieder. Das erste: „Ich habe schon ein Konto, das gesperrt ist – dann bekomme ich kein Basiskonto.“ Falsch. Ein Konto, über das Sie nicht verfügen können – gekündigt, gepfändet ohne P-Konto-Schutz, im Ausland –, ist kein nutzbares Zahlungskonto im Sinne von § 35 ZKG. Das zweite: „Die Bank hat gesagt, ich müsse erst die alten Schulden bei ihr begleichen.“ Auch falsch. Offene Forderungen der Bank gegen Sie sind kein Ablehnungsgrund; nur eine frühere Kündigung wegen schwerer Vertragsverletzung bei genau dieser Bank kann einer sein – und auch die muss die Bank belegen.

Für Menschen in der Insolvenz gilt ein Zusatz: Das Basiskonto steht ihnen zu, und der Insolvenzverwalter hat kein Vetorecht. Sinnvoll ist, das Konto sofort als P-Konto führen zu lassen, damit Eingänge bis zum Freibetrag geschützt sind – der [Pfändungsrechner](/werkzeuge/pfaendungsrechner) nennt den Betrag.

## Was nicht geht

Das Basiskonto ist kein Weg zu Dispo oder Kreditkarte mit Rahmen – es ist ein Guthabenkonto, und die Bank darf Überziehungen ablehnen. Die BaFin kann die Eröffnung anordnen, aber keine Gebühr festsetzen und keinen Schadensersatz zusprechen. Und der Anspruch gilt gegenüber Banken, die Zahlungskonten für Verbraucher anbieten – reine Kreditkarten- oder Bausparinstitute fallen nicht darunter. Für alles andere gilt: Der Anspruch ist eindeutig, die Fristen sind kurz, das Verfahren kostet nichts. Nutzen Sie es.`,
  },
  {
    slug: "pfaendungsfreigrenze-2026-p-konto-was-bleibt",
    titel: "Pfändungsfreigrenze 2026: 1.587,40 Euro – was Ihnen bei einer Pfändung bleibt und wie das P-Konto schützt",
    untertitel: "Seit dem 1. Juli 2026 gelten neue Freibeträge. Wer sie kennt, weiß, was der Gläubiger bekommt, was auf dem Konto sicher ist und welche Bescheinigung den Schutz für Kinder und Partner freischaltet.",
    teaser: "Ab 1. Juli 2026 sind 1.587,40 € unpfändbar, +597,42 € für die erste Unterhaltsperson, +332,83 € je weitere. Tabelle, P-Konto, Bescheinigung.",
    kategorie: "grundlagen", land: "DE", keyword: "pfändungsfreigrenze 2026",
    schlagworte: ["Pfändungsfreigrenze", "P-Konto", "§ 850c ZPO", "Pfändungstabelle 2026", "Kontopfändung", "Lohnpfändung"],
    metaTitel: "Pfändungsfreigrenze 2026: Beträge, Tabelle, P-Konto",
    metaBeschreibung: "Pfändungsfreigrenze ab 1. Juli 2026: 1.587,40 € unpfändbar, +597,42 € erste Unterhaltsperson, +332,83 € je weitere. Tabelle, P-Konto, Bescheinigung.",
    faq: [
      { frage: "Wie hoch ist die Pfändungsfreigrenze 2026?", antwort: "Seit dem 1. Juli 2026 beträgt der unpfändbare Grundbetrag 1.587,40 Euro netto im Monat für Schuldner ohne Unterhaltspflichten. Für die erste unterhaltsberechtigte Person kommen 597,42 Euro hinzu, für die zweite bis fünfte je 332,83 Euro. Ab 4.866,30 Euro netto ist alles darüber voll pfändbar (Pfändungsfreigrenzenbekanntmachung 2026)." },
      { frage: "Was ist mit Einkommen über dem Freibetrag?", antwort: "Vom Betrag über dem Freibetrag bleiben drei Zehntel unpfändbar, bei einer Unterhaltspflicht fünf Zehntel, bei jeder weiteren ein Zehntel mehr – bis neun Zehntel bei fünf Personen (§ 850c Abs. 3 ZPO). Die amtliche Tabelle rechnet das in 10-Euro-Stufen aus; der Pfändungsrechner nennt den Betrag für Ihr Netto." },
      { frage: "Schützt das P-Konto automatisch auch meine Kinder?", antwort: "Nein. Sofort gilt nur der Grundfreibetrag. Die Erhöhungen für Unterhaltspflichten, Kindergeld und bestimmte Sozialleistungen muss die Bank erst eintragen – nach Vorlage einer Bescheinigung (§ 903 ZPO), etwa von der Schuldnerberatung, dem Arbeitgeber, der Familienkasse oder dem Sozialamt." },
      { frage: "Kann ich unverbrauchtes Geld auf dem P-Konto ansparen?", antwort: "Ja, bis zu drei Monate: Nicht verbrauchtes geschütztes Guthaben wird in die folgenden drei Monate übertragen (§ 899 Abs. 2 ZPO). Danach ist es pfändbar. Nachzahlungen und Weihnachtsgeld sollten Sie deshalb zeitlich planen." },
      { frage: "Wie schnell muss die Bank mein Konto umwandeln?", antwort: "Innerhalb von vier Geschäftstagen nach Ihrem Verlangen (§ 850k Abs. 2 ZPO) – auch wenn bereits eine Pfändung läuft. Die Umwandlung darf nichts extra kosten, und es darf nur ein P-Konto je Person geben; die Bank prüft das über die SCHUFA." },
    ],
    inhalt: `Die Pfändung kommt selten überraschend – vorher gab es Mahnungen, einen Mahnbescheid, einen Titel. Aber der Moment, in dem der Arbeitgeber den Pfändungsbeschluss auf den Tisch bekommt oder die Bank das Konto sperrt, überrascht trotzdem fast jeden. Die erste Frage lautet dann nicht „Wie werde ich das los?“, sondern „Wovon lebe ich diesen Monat?“.

Die Antwort steht im Gesetz, und sie ist konkreter, als die meisten glauben: Ein Teil des Einkommens ist unpfändbar, in jeder Lage, für jeden Gläubiger. Wie groß dieser Teil ist, legt die Pfändungstabelle zu § 850c ZPO fest – und die wurde zum 1. Juli 2026 neu bekannt gemacht. Dieser Text erklärt die Beträge, die Rechenlogik und den Unterschied zwischen Lohnpfändung und Kontoschutz.

## Die Beträge ab 1. Juli 2026

Die Pfändungsfreigrenzen werden seit 2021 jährlich zum 1. Juli an die Entwicklung des steuerlichen Grundfreibetrags angepasst. Für den Zeitraum vom 1. Juli 2026 bis zum 30. Juni 2027 gilt nach der Pfändungsfreigrenzenbekanntmachung 2026, veröffentlicht im Bundesgesetzblatt am 26. März 2026: Der unpfändbare Grundbetrag steigt von 1.555,00 auf **1.587,40 Euro** netto im Monat. Für die erste Person, der Sie gesetzlich Unterhalt schulden, kommen **597,42 Euro** hinzu (vorher 585,23), für die zweite bis fünfte Person je **332,83 Euro** (vorher 326,04). Der Höchstbetrag, ab dem alles darüber voll pfändbar ist, liegt bei **4.866,30 Euro**.

Zur Einordnung: Eine alleinstehende Person mit 2.100 Euro netto hat 512,60 Euro über dem Grundbetrag; davon sind sieben Zehntel pfändbar – rund 359 Euro. Eine Person mit zwei Unterhaltspflichten und demselben Netto liegt unter ihrem Freibetrag von 2.517,65 Euro – nichts ist pfändbar.

*Quelle: Pfändungsfreigrenzenbekanntmachung 2026, BGBl. 2026 I (26.03.2026); § 850c ZPO.*

## Wie die Tabelle rechnet

§ 850c Abs. 3 ZPO regelt, was mit dem Einkommen über dem Freibetrag passiert: Drei Zehntel des Mehrbetrags bleiben unpfändbar, bei einer Unterhaltspflicht weitere zwei Zehntel, bei jeder weiteren Person – bis zur fünften – ein weiteres Zehntel. Ohne Unterhaltspflicht sind also 70 Prozent des Mehrbetrags pfändbar, bei einer Person 50 Prozent, bei zwei 40, bei drei 30, bei vier 20, bei fünf 10 Prozent. Oberhalb des Höchstbetrags von 4.866,30 Euro ist alles pfändbar.

Die amtliche Tabelle listet das für Nettoeinkommen in 10-Euro-Stufen; das Ergebnis weicht deshalb um wenige Cent von der reinen Formel ab. Der [Pfändungsrechner](/werkzeuge/pfaendungsrechner) wendet die Stufen an und zeigt für Ihr Netto und Ihre Unterhaltspflichten den pfändbaren und den geschützten Betrag – für 2026 und, zum Vergleich, für den vorherigen Zeitraum.

## Wer als unterhaltsberechtigt zählt

Ehegatten und eingetragene Lebenspartner, Kinder – auch volljährige, solange Unterhalt tatsächlich geleistet wird –, in Ausnahmefällen Eltern. Entscheidend ist die gesetzliche Unterhaltspflicht und die tatsächliche Leistung. Hat der Partner eigenes Einkommen, kann das Vollstreckungsgericht ihn auf Antrag des Gläubigers ganz oder teilweise unberücksichtigt lassen (§ 850c Abs. 6 ZPO). Höchstens fünf Personen werden berücksichtigt.

## Lohnpfändung und Kontopfändung sind zwei Dinge

Bei der Lohnpfändung erhält der Arbeitgeber den Pfändungs- und Überweisungsbeschluss, behält den pfändbaren Teil ein und überweist ihn an den Gläubiger. Sie bekommen den unpfändbaren Rest. Bei der Kontopfändung geht der Beschluss an die Bank – und die sperrt zunächst das gesamte Guthaben, auch das, was aus dem unpfändbaren Lohn stammt. Der Schutz auf dem Konto kommt nicht von selbst: Er kommt vom Pfändungsschutzkonto.

## Das P-Konto

Jedes Girokonto kann auf Verlangen in ein P-Konto umgewandelt werden; die Bank muss das innerhalb von vier Geschäftstagen tun, auch bei laufender Pfändung (§ 850k ZPO). Es darf nur ein P-Konto je Person geben. Auf dem P-Konto ist Guthaben bis zum Grundfreibetrag geschützt – seit 1. Juli 2026 also 1.587,40 Euro im Monat (§ 899 ZPO) –, unabhängig davon, woher das Geld kommt: Lohn, Rente, Sozialleistungen, Geschenke.

Der entscheidende Punkt, den viele übersehen: Die Erhöhungen für Unterhaltspflichten, für Kindergeld, für bestimmte Sozialleistungen gelten auf dem P-Konto nicht automatisch. Sie müssen der Bank durch eine Bescheinigung nachgewiesen werden (§§ 902, 903 ZPO). Ausstellen dürfen sie Arbeitgeber, Familienkasse, Sozialleistungsträger, anerkannte Schuldnerberatungsstellen, Rechtsanwälte und Steuerberater. Ohne Bescheinigung schützt das P-Konto einer Mutter mit zwei Kindern nur 1.587,40 Euro – mit Bescheinigung 2.517,65 Euro plus Kindergeld.

*Quelle: §§ 850k, 899, 902, 903 ZPO.*

## Was mit dem Rest passiert

Guthaben über dem Freibetrag ist nicht sofort weg: Die Bank darf es erst nach Ablauf des Folgemonats an den Gläubiger auszahlen (§ 900 ZPO). Und nicht verbrauchtes geschütztes Guthaben nehmen Sie mit – bis zu drei Monate (§ 899 Abs. 2 ZPO). Wer im Januar 300 Euro vom Freibetrag nicht ausgibt, hat sie im Februar zusätzlich. Wer eine Nachzahlung erwartet, sollte sie deshalb auf mehrere Monate verteilen lassen, wo das möglich ist.

## Schritt für Schritt: Wenn die Pfändung kommt

1. **Beschluss lesen.** Wer pfändet, für welche Forderung, in welcher Höhe, seit wann. Der Pfändungs- und Überweisungsbeschluss nennt Gläubiger und Titel – prüfen Sie, ob Sie den Titel kennen und ob die Forderung darin stimmt.
2. **Konto zum P-Konto machen.** Schriftlich bei der Bank verlangen; sie hat vier Geschäftstage (§ 850k ZPO). Rückwirkend gilt der Schutz für den laufenden Monat, wenn Sie innerhalb von vier Wochen nach der Pfändung umwandeln.
3. **Bescheinigung besorgen.** Bei Unterhaltspflichten, Kindergeld oder Sozialleistungen: Schuldnerberatung, Arbeitgeber, Familienkasse oder Sozialamt stellen sie aus. Ohne Bescheinigung gilt nur der Grundbetrag.
4. **Freibetrag berechnen.** Mit dem [Pfändungsrechner](/werkzeuge/pfaendungsrechner) prüfen, was der Arbeitgeber einbehalten darf und was auf dem Konto sicher ist – und die Abrechnung des Arbeitgebers damit vergleichen.
5. **Fixkosten sichern.** Miete, Energie, Versicherungen aus dem geschützten Betrag zuerst – per Dauerauftrag am Tag nach dem Eingang. Was nicht ausgegeben wird, bleibt bis zu drei Monate geschützt.
6. **Die Forderung dahinter angehen.** Ratenangebot an den Gläubiger, das die Pfändung ersetzt; Prüfung, ob der Titel auf einer verjährten oder falschen Forderung beruht; bei mehreren Gläubigern die Schuldnerberatung.

Ein häufiger Irrtum betrifft die Reihenfolge mehrerer Pfändungen. Pfänden zwei Gläubiger, gilt das Prioritätsprinzip: Der erste Beschluss wird vollständig bedient, bevor der zweite etwas bekommt – der Freibetrag verdoppelt sich nicht. Für Sie ändert das nichts am geschützten Betrag; für die Gläubiger bedeutet es, dass der zweite lange wartet. Deshalb sind Gläubiger, die noch keinen Titel haben, an einem Ratenplan interessiert – die Pfändung würde sie hinten anstellen.

Zu den Sozialleistungen: Bürgergeld, Wohngeld und Kindergeld sind auf dem P-Konto durch die Bescheinigung zusätzlich geschützt; Kindergeld für das eigene Kind erhöht den Freibetrag in voller Höhe (§ 902 Nr. 5 ZPO). Bei Rentenbeziehern gilt der Grundbetrag wie bei Erwerbstätigen; eine Rente ist pfändbar, soweit sie den Freibetrag übersteigt.

*Quelle: §§ 850k, 899, 900, 902, 903 ZPO; § 804 Abs. 3 ZPO (Rangfolge).*

## Was nicht geht

Der Freibetrag schützt nicht gegen alles. Bei Unterhaltspfändungen – wenn der Gläubiger ein unterhaltsberechtigtes Kind ist – gelten niedrigere Grenzen (§ 850d ZPO); das Gericht legt fest, was Ihnen bleiben muss. Und der Freibetrag verhindert keine Pfändung, er begrenzt sie. Wer aus der Pfändung heraus will, muss die Forderung dahinter klären: Ist der Titel berechtigt? Ist die Forderung vielleicht längst verjährt gewesen, als er erging? Lässt sich mit dem Gläubiger ein Ratenplan vereinbaren, der die Pfändung ersetzt? Der [Ratenplan-Rechner](/werkzeuge/ratenplan) rechnet die Rate, die trägt.

Aus der FIAON-Praxis: Eine Pfändung ist fast immer das Ende einer Kette, die mit einer unbeantworteten Mahnung begann. Wer die Kette früher unterbricht – Nachweise verlangen, Kosten prüfen, Raten anbieten –, kommt selten bis hierher. Und wer schon hier ist, hat mit dem P-Konto, der Bescheinigung und der kostenlosen Schuldnerberatung drei Werkzeuge, die sofort wirken. Mehr zum Weg zurück auf der Seite [Ratenzahlung und Bonität](/ratenzahlung-und-bonitaet).`,
  },
  {
    slug: "dispo-dauerhaft-im-minus-kosten-ausweg",
    titel: "Dauerhaft im Dispo: Was 11 Prozent wirklich kosten, was Banken darin lesen – und die drei Wege raus",
    untertitel: "Der Dispo ist der bequemste Kredit Deutschlands und einer der teuersten. Wer dauerhaft im Minus steht, zahlt nicht nur Zinsen – er hinterlässt im Kontoauszug das Signal, das Kartenpartner am wenigsten sehen wollen.",
    teaser: "Rund 11,3 % Dispozins im Schnitt, ohne Ende. Was der Dauer-Dispo kostet, warum er für Banken das stärkste Warnsignal ist – und drei Wege raus.",
    kategorie: "score", land: "DE", keyword: "dispo dauerhaft im minus",
    schlagworte: ["Dispo", "Dispozinsen", "Kontoauszug", "Bonität", "Ratenkredit", "Überziehung"],
    metaTitel: "Dauerhaft im Dispo: Kosten, Bonität und der Weg raus",
    metaBeschreibung: "Dauer-Dispo: Was rund 11,3 % Zinsen im Jahr kosten, warum das Minus für Banken das stärkste Warnsignal ist – und drei Wege raus. Mit Rechner.",
    faq: [
      { frage: "Wie hoch sind Dispozinsen aktuell?", antwort: "Im Durchschnitt rund 11,3 Prozent im Jahr (Verivox, Auswertung November 2025; Stiftung Warentest, Juni 2025: 11,22 Prozent). Die Spanne zwischen den Banken reicht von etwa 7 bis 17 Prozent. Für die geduldete Überziehung über das Limit hinaus verlangen viele Institute noch mehr." },
      { frage: "Meldet die Bank meinen Dispo an die SCHUFA?", antwort: "Der eingeräumte Dispo wird in der Regel nicht als Kredit gemeldet. Gemeldet wird eine Kündigung mit offener Forderung oder eine Überziehung, die die Bank als Vertragsverletzung wertet. Unabhängig davon lesen Banken und Kartenpartner den Kontoauszug – und dort ist ein dauerhaft ausgereizter Dispo sofort sichtbar." },
      { frage: "Lohnt sich ein Ratenkredit zur Ablösung?", antwort: "Rechnerisch fast immer, wenn der Kreditzins deutlich unter dem Dispozins liegt und die Rate sicher tragbar ist. Der Dispo-Rechner zeigt die Differenz. Voraussetzung ist, dass der Dispo danach nicht wieder aufgebaut wird – sonst haben Sie zwei Schulden statt einer. Fragen Sie mit einer Konditionsanfrage an, sie ist SCHUFA-neutral." },
      { frage: "Was ist eine geduldete Überziehung?", antwort: "Alles, was über das eingeräumte Limit hinausgeht. Die Bank duldet es, muss es aber nicht – sie kann die Überziehung jederzeit zurückfordern und verlangt oft einen höheren Zins. Die geduldete Überziehung ist die teuerste Kreditform im Alltag und ein Grund für Kündigungen." },
      { frage: "Kann die Bank meinen Dispo einfach kündigen?", antwort: "Ja, mit angemessener Frist – dann wird die Summe auf einmal fällig. Reagieren Sie sofort schriftlich mit einem Ratenangebot; eine geplatzte Rückführung nach Kündigung führt zur Meldung. Der Ratenplan-Rechner formuliert das Angebot." },
    ],
    inhalt: `Der Dispo hat keinen Vertrag, den man unterschreibt, keine Rate, die man plant, kein Ende, an dem man ankommt. Er ist einfach da – und für Millionen Menschen ist er nicht die Reserve für den Notfall, sondern der Normalzustand. Nach einer Auswertung der Verbraucherzentrale Hamburg nutzt ein erheblicher Teil der Kontoinhaber den Dispo regelmäßig; wie viele dauerhaft darin stehen, erfasst keine Statistik genau. Aus Kontoauszügen, die FIAON mit Kunden liest, ist es der häufigste Befund überhaupt.

Dieser Text rechnet, was das kostet, erklärt, warum der Dauer-Dispo für Banken schwerer wiegt als mancher alte Eintrag – und beschreibt die drei Wege, die aus dem Minus führen.

## Was der Dispo kostet

Die Zinsen für Dispokredite lagen in Deutschland im November 2025 nach einer Auswertung von Verivox über mehr als 1.000 Banken im Schnitt bei 11,31 Prozent; Stiftung Warentest ermittelte im Juni 2025 einen Durchschnitt von 11,22 Prozent, nach über zwölf Prozent im Jahr davor. Die Spanne ist groß: Einzelne Institute verlangen um 7 Prozent, andere über 16. Für die geduldete Überziehung – alles über dem Limit – kommen häufig weitere Prozentpunkte hinzu.

Konkret: Wer dauerhaft 1.800 Euro im Minus steht, zahlt bei 11,3 Prozent rund 203 Euro Zinsen im Jahr – etwa 17 Euro im Monat, jeden Monat, ohne dass sich am Minus etwas ändert. Über drei Jahre sind das mehr als 600 Euro für nichts. Der [Dispo-Rechner](/werkzeuge/dispo-rechner) rechnet es für Ihren Stand und Ihren Zinssatz, der im Preisaushang Ihrer Bank steht.

*Quelle: Verivox, Dispozins-Auswertung November 2025; Stiftung Warentest, Finanztest Juni 2025.*

## Was Banken darin lesen

Der eingeräumte Dispo wird der SCHUFA in der Regel nicht als Kredit gemeldet. Das führt zu einem Missverständnis: Viele glauben, der Dispo sei für ihre Bonität unsichtbar. Für die Auskunftei ja – für die Bank nein. Wer eine Kreditkarte, einen Ratenkredit oder auch nur ein neues Konto beantragt, legt in aller Regel Kontoauszüge vor, und Kartenpartner lesen sie mit einer Frage: Kommt diese Person mit ihrem Geld aus?

Ein Konto, das seit Monaten am Limit steht, beantwortet die Frage. Es ist das Negativmerkmal, das keine Auskunft zeigt, und in der Praxis der Kartenvergabe wiegt es schwerer als ein drei Jahre alter, erledigter Eintrag. Umgekehrt gilt: Ein Konto, das in sechs Monaten von 1.800 Euro Minus auf null geht, erzählt genau die Geschichte, die eine Bank sehen will – Kontrolle.

## Weg 1: Der Ratenkredit zur Ablösung

Ein Ratenkredit über die Dispo-Summe zu 6 bis 9 Prozent, mit fester Rate über 24 oder 36 Monate, ist rechnerisch fast immer günstiger als der Dispo – der Rechner zeigt die Differenz in Euro. Er hat zwei Voraussetzungen. Erstens: Eine Bank muss ihn geben; mit negativen Einträgen ist das schwierig, und die Anfrage sollte als Konditionsanfrage gestellt werden, damit sie den Score nicht berührt. Zweitens, und wichtiger: Der Dispo darf danach nicht wieder aufgebaut werden. Wer den Kredit aufnimmt und drei Monate später wieder im Minus steht, hat zwei Schulden. Lassen Sie sich das Limit senken, wenn der Kredit läuft.

## Weg 2: Der feste Abbau

Ohne Kredit funktioniert es mit Disziplin und einem Dauerauftrag: ein fester Betrag am Tag nach dem Gehaltseingang auf ein Unterkonto oder ein Tagesgeldkonto, das den Dispo Monat für Monat sinken lässt. Bei 1.800 Euro und 150 Euro im Monat dauert das rund 13 Monate; bei 200 Euro rund 10. Der Rechner zeigt, was 50 Euro mehr ausmachen – oft mehrere Monate.

Der Trick ist die Automatik: Wer jeden Monat neu entscheidet, entscheidet irgendwann anders. Wer den Dauerauftrag einrichtet und das Limit parallel schrittweise senken lässt, kann nicht zurück.

## Weg 3: Das Limit senken

Der unterschätzte Hebel. Die Bank räumt den Dispo ein, aber Sie bestimmen die Höhe – Sie können ihn jederzeit senken lassen, auch stufenweise: von 2.000 auf 1.500, drei Monate später auf 1.000. Das erzwingt den Abbau und verhindert den Rückfall. Wer den Dispo ganz auf null setzt, bevor das Konto es hergibt, riskiert allerdings Rücklastschriften – und die sind schlimmer als der Dispo. Senken Sie in dem Tempo, in dem Sie abbauen.

## Wenn die Bank kündigt

Die Bank darf den Dispo mit angemessener Frist kündigen; dann wird die Summe auf einmal fällig. Das ist der Moment, in dem aus dem unsichtbaren Minus ein sichtbarer Eintrag werden kann: Wer nicht zurückzahlt, wird gemahnt und gemeldet. Reagieren Sie sofort und schriftlich mit einem Ratenangebot – der [Ratenplan-Rechner](/werkzeuge/ratenplan) formuliert es –, und bitten Sie ausdrücklich darum, während der pünktlichen Rückführung keine Meldung zu veranlassen.

## Schritt für Schritt: In sechs Monaten aus dem Minus

1. **Den Stand ehrlich aufschreiben.** Dispo-Betrag, Zinssatz aus dem Preisaushang, Limit. Dazu die letzten drei Kontoauszüge: Wann im Monat ist der Stand am tiefsten, wann am höchsten? Das zeigt, wie viel „Minus“ wirklich strukturell ist und wie viel Timing.
2. **Spielraum ermitteln.** Mit dem [Spielraum-Rechner](/werkzeuge/spielraum) Einnahmen gegen Fixkosten und Lebenshaltung stellen. Der Betrag, der übrig bleibt, ist die Obergrenze für den Abbau – und die Hälfte davon die Rate, die auch im schlechten Monat hält.
3. **Weg wählen.** Ratenkredit, wenn eine Bank ihn zu einem Zins unter dem Dispo gibt – per Konditionsanfrage. Sonst fester Abbau per Dauerauftrag. Der [Dispo-Rechner](/werkzeuge/dispo-rechner) zeigt beide in Monaten und Euro.
4. **Automatik einrichten.** Dauerauftrag auf ein Unterkonto am Tag nach dem Gehaltseingang; das Unterkonto tilgt den Dispo. Wer den Betrag jeden Monat neu überweisen muss, überweist ihn irgendwann nicht.
5. **Limit senken lassen.** Alle drei Monate um den Betrag, den Sie abgebaut haben. So kann der alte Stand nicht zurückkommen – und die Bank sieht, dass Sie das Konto führen, nicht das Konto Sie.
6. **Rückschläge einplanen.** Ein Puffer von einer Monatsrate auf dem Girokonto fängt Autoreparatur oder Nachzahlung ab, ohne dass der Dispo wieder wächst. Fehlt der Puffer, geht er vor dem Abbau.

Ein Rechenbeispiel macht die Wirkung greifbar. 1.800 Euro Dispo bei 11,3 Prozent, 150 Euro Abbau im Monat: Nach 13 Monaten steht das Konto auf null, die Zinsen bis dahin betragen rund 110 Euro. Mit 200 Euro im Monat sind es zehn Monate und rund 85 Euro Zinsen. Der Ratenkredit über 1.800 Euro zu 7,5 Prozent auf 24 Monate kostet rund 81 Euro Rate und rund 143 Euro Zinsen – teurer als der zügige Abbau, aber mit einer festen Rate, die den Dispo sofort auf null setzt und die Versuchung beendet. Welcher Weg der richtige ist, entscheidet weniger die Rechnung als die Frage, ob Sie sich zutrauen, das Limit nicht wieder auszureizen.

Für Kunden, die über FIAON auf eine Kreditkarte hinarbeiten, gilt eine Faustregel aus der Kartenvergabe: Der Kontoauszug der letzten drei Monate sollte keinen dauerhaften Dispo mehr zeigen, wenn der Antrag gestellt wird. Ein kurzes Minus um den Monatswechsel ist unproblematisch; ein Konto, das nie über null steigt, ist ein Ausschlusskriterium – unabhängig vom Score.

## Was nicht geht

Der Dispo lässt sich nicht „wegverhandeln“, und ein niedrigerer Zins bei derselben Bank ist selten – die Sätze sind Preisaushang, nicht Verhandlungssache. Ein Kontowechsel zu einer günstigeren Bank hilft nur, wenn die neue Bank den Dispo überhaupt einräumt, was mit Einträgen unwahrscheinlich ist. Und keine der drei Wege wirkt, wenn das Grundproblem – Ausgaben über Einnahmen – nicht angegangen wird. Der [Spielraum-Rechner](/werkzeuge/spielraum) zeigt, ob überhaupt Luft für einen Abbau da ist; wenn nicht, ist die kostenlose Schuldnerberatung der bessere erste Schritt.

FIAON liest den Kontoauszug mit Ihnen – Einnahmen, Fixkosten, Dispo, Rücklastschriften – und baut daraus den Fahrplan, an dessen Ende Konto und Karte stehen. Der Dispo ist darin fast immer die erste Etappe. Mehr auf der Seite [Bonität verbessern](/bonitaet-verbessern).`,
  },
  {
    slug: "mahngebuehren-wie-hoch-erlaubt-bgh",
    titel: "Mahngebühren: Ein Brief kostet einen Euro, nicht 7,50 – was Gläubiger verlangen dürfen und was der BGH dazu sagt",
    untertitel: "Die erste Mahnung ist meist kostenlos, die zweite darf Porto und Papier kosten, die 40-Euro-Pauschale gilt nur zwischen Unternehmen. Wer die Regeln kennt, zahlt die Rechnung – und streicht die Gebühren.",
    teaser: "Der BGH kippte 2,50 € Mahnpauschale gegenüber Verbrauchern. Was Mahnungen kosten dürfen, wann die erste kostenlos ist – und warum die 40-€-Pauschale Sie nicht betrifft.",
    kategorie: "inkasso", land: "DE", keyword: "mahngebühren höhe erlaubt",
    schlagworte: ["Mahngebühren", "Mahnkosten", "BGH VIII ZR 95/18", "§ 286 BGB", "§ 288 BGB", "Verzugspauschale"],
    metaTitel: "Mahngebühren: Wie hoch dürfen Mahnkosten sein?",
    metaBeschreibung: "Mahngebühren: Der BGH kippte 2,50 € Pauschale gegenüber Verbrauchern. Wann die erste Mahnung kostenlos ist, was danach erlaubt ist. Mit Prüfer.",
    faq: [
      { frage: "Darf die erste Mahnung etwas kosten?", antwort: "In der Regel nicht. Die erste Mahnung nach Fälligkeit begründet den Verzug erst (§ 286 Abs. 1 BGB); ihre Kosten entstehen vor dem Verzug und sind kein ersatzfähiger Verzugsschaden. Anders ist es, wenn Sie schon vorher in Verzug waren – bei einem kalendermäßig bestimmten Zahlungstermin oder 30 Tage nach einer Rechnung mit entsprechendem Hinweis (§ 286 Abs. 2, 3 BGB)." },
      { frage: "Wie viel darf eine Mahnung ab Verzug kosten?", antwort: "Nur den tatsächlich entstandenen Schaden: Porto, Papier, Druck – typischerweise um einen Euro. Personal-, Software- und Verwaltungskosten dürfen nicht umgelegt werden. Der BGH hat eine Pauschale von 2,50 Euro gegenüber Verbrauchern für unwirksam erklärt, weil die nachgewiesenen Kosten bei 0,76 Euro lagen (Urteil vom 26.06.2019, VIII ZR 95/18)." },
      { frage: "Gilt die 40-Euro-Verzugspauschale auch für mich?", antwort: "Nein. § 288 Abs. 5 BGB gewährt die Pauschale nur, wenn der Schuldner kein Verbraucher ist – also im Geschäftsverkehr zwischen Unternehmen. In einer Mahnung an eine Privatperson ist sie unzulässig, ebenso wie Bearbeitungs-, Kontoführungs- oder Adressermittlungsgebühren ohne konkreten Nachweis." },
      { frage: "Welche Verzugszinsen sind erlaubt?", antwort: "Fünf Prozentpunkte über dem Basiszinssatz der Deutschen Bundesbank (§ 288 Abs. 1 BGB), der halbjährlich zum 1. Januar und 1. Juli festgelegt wird. Ein höherer Zins muss vertraglich vereinbart oder als konkreter Schaden nachgewiesen sein." },
      { frage: "Was mache ich mit überhöhten Mahngebühren?", antwort: "Die Hauptforderung zahlen, wenn sie berechtigt ist, und die überhöhten Nebenkosten schriftlich zurückweisen – der Mahngebühren-Prüfer formuliert den Text. Der Gläubiger müsste die Gebühren einklagen und nachweisen; bei wenigen Euro Streitwert geschieht das praktisch nie." },
    ],
    inhalt: `Auf der Mahnung steht: Rechnungsbetrag 49,90 Euro, Mahngebühr 7,50 Euro. Bei der zweiten Mahnung sind es 15 Euro Gebühren, bei der dritten 25 – und die Forderung ist inzwischen zur Hälfte aus Kosten gemacht, die niemandem entstanden sind. Mahngebühren sind der Ort, an dem Gläubiger am häufigsten zu viel verlangen, weil fast niemand nachrechnet. Dabei ist die Rechtslage ungewöhnlich klar, und ein Bundesgerichtshof hat sie 2019 auf einen Betrag gebracht: 0,76 Euro.

## Wann eine Mahnung überhaupt Kosten verursachen darf

Mahnkosten sind Verzugsschaden – sie sind nur ersatzfähig, wenn der Schuldner im Verzug ist. Verzug tritt nach § 286 Abs. 1 BGB ein, wenn der Schuldner nach Fälligkeit gemahnt wird und trotzdem nicht zahlt. Die erste Mahnung ist also das, was den Verzug überhaupt erst auslöst – ihre Kosten entstehen vor dem Verzug und sind kein Verzugsschaden. Die erste Mahnung ist deshalb in der Regel kostenlos.

Es gibt zwei Ausnahmen (§ 286 Abs. 2 und 3 BGB): Steht im Vertrag ein fester Zahlungstermin – „zahlbar bis 15. März“ –, tritt der Verzug mit dem Termin ein, ohne Mahnung. Und ein Verbraucher, der eine Rechnung erhält, die auf diese Folge hinweist, ist 30 Tage nach Zugang der Rechnung in Verzug. In beiden Fällen darf auch die erste Mahnung Kosten verursachen. Ohne Termin und ohne Hinweis: nicht.

*Quelle: § 286 Abs. 1–3 BGB.*

## Was eine Mahnung kosten darf

Ab Verzug schuldet der Schuldner den Schaden, der dem Gläubiger durch die Verzögerung entsteht (§§ 280, 286 BGB). Bei einer Mahnung sind das die Sachkosten: Porto, Papier, Druck, Umschlag. Nicht ersatzfähig sind die Kosten, die ohnehin anfallen – Personal, Software, Räume, Verwaltung. Der Gläubiger darf seinen Mahnbetrieb nicht auf den einzelnen Schuldner umlegen.

Ein Standardbrief kostet seit dem 1. Januar 2025 bei der Deutschen Post 0,95 Euro Porto. Mit Papier und Umschlag liegt der tatsächliche Schaden einer Mahnung um einen Euro. Alles darüber muss der Gläubiger konkret nachweisen – und das gelingt bei Massenverfahren nicht.

## Das Urteil, das die Zahl nennt

Der Bundesgerichtshof hat am 26. Juni 2019 über die Allgemeinen Geschäftsbedingungen eines Energieversorgers entschieden, der eine Mahnpauschale von 2,50 Euro berechnete (Az. VIII ZR 95/18). Der Versorger konnte nachweisen, dass ihm pro Mahnung 0,76 Euro an Sachkosten entstanden. Der BGH erklärte die Klausel für unwirksam: Nach § 309 Nr. 5 Buchst. a BGB darf eine Pauschale den nach dem gewöhnlichen Lauf der Dinge zu erwartenden Schaden nicht übersteigen – und 2,50 Euro waren mehr als das Dreifache des tatsächlichen Schadens.

Die Entscheidung gilt für Verbraucherverträge und für Pauschalen in AGB. Sie sagt nicht, dass jede Mahnung genau 0,76 Euro kosten darf – die Zahl war der Nachweis dieses einen Unternehmens. Sie sagt, dass Pauschalen am tatsächlichen Schaden gemessen werden. Gerichte halten seither Pauschalen im Bereich von rund einem Euro für vertretbar; 2,50 Euro und mehr nicht.

*Quelle: BGH, Urteil vom 26.06.2019, VIII ZR 95/18; § 309 Nr. 5 BGB.*

## Die 40-Euro-Pauschale

Seit 2014 steht in § 288 Abs. 5 BGB eine Verzugspauschale von 40 Euro – und sie taucht seither in Mahnungen an Privatpersonen auf, in die sie nicht gehört. Die Vorschrift ist eindeutig: Die Pauschale gilt nur, wenn der Schuldner kein Verbraucher ist. Sie ist ein Instrument des Geschäftsverkehrs, mit dem Unternehmen säumige Geschäftskunden belasten können. In einer Mahnung an einen Verbraucher ist sie unzulässig, egal wie sie bezeichnet wird.

Das Gleiche gilt für die kreative Nachbarschaft der Mahngebühr: „Bearbeitungsgebühr“, „Kontoführungsgebühr“, „Adressermittlung“, „Bonitätsauskunft“. Ohne konkreten Nachweis eines konkreten Schadens sind sie nicht ersatzfähig.

*Quelle: § 288 Abs. 5 BGB.*

## Verzugszinsen

Neben den Mahnkosten darf der Gläubiger Verzugszinsen verlangen: fünf Prozentpunkte über dem Basiszinssatz, den die Deutsche Bundesbank zum 1. Januar und 1. Juli festlegt (§ 288 Abs. 1 BGB). Ein höherer Zins ist nur mit vertraglicher Vereinbarung oder Nachweis eines höheren Schadens zulässig. Auf eine Forderung von 49,90 Euro ergeben Verzugszinsen über einige Monate wenige Cent – wer in der Mahnung „Zinsen 12,00 Euro“ liest, sollte die Berechnung verlangen.

## So rechnen Sie nach

Der [Mahngebühren-Prüfer](/werkzeuge/mahngebuehren) fragt drei Dinge: Wie viele Mahnungen, welche Gebühr je Mahnung, und ob Sie schon vor der ersten Mahnung in Verzug waren. Daraus ergibt sich, was vertretbar ist – ein Euro Richtwert je Mahnung ab Verzug, Pauschalen bis 1,50 Euro als Toleranz – und was zu viel verlangt wurde. Der Prüfer formuliert die Zurückweisung: Hauptforderung anerkannt, Nebenkosten in nachgewiesener Höhe akzeptiert, der Rest zurückgewiesen mit Verweis auf § 309 Nr. 5 BGB und das BGH-Urteil.

## Schritt für Schritt: Mahnung prüfen und antworten

1. **Verzug feststellen.** Stand im Vertrag ein Zahlungsdatum? Kam die Rechnung vor mehr als 30 Tagen mit Hinweis auf den Verzug? Wenn nein, war die erste Mahnung die Verzugsauslösung – und kostenlos.
2. **Posten trennen.** Hauptforderung, Mahngebühren, Verzugszinsen, „sonstige Kosten“. Jede Position einzeln, denn jede folgt einer anderen Regel.
3. **Gebühren nachrechnen.** Mit dem [Mahngebühren-Prüfer](/werkzeuge/mahngebuehren): Anzahl der Mahnungen ab Verzug mal rund ein Euro, Pauschalen bis 1,50 Euro als Toleranz. Alles darüber ist Verhandlungsmasse – und meist schlicht unbegründet.
4. **Zinsen nachrechnen.** Basiszinssatz der Bundesbank plus fünf Punkte, tagegenau auf die Hauptforderung. Bei 49,90 Euro über vier Monate sind das wenige Cent – ein Betrag in Euro-Höhe ist ein Rechenfehler oder eine Behauptung.
5. **Hauptforderung begleichen, Rest zurückweisen.** Überweisung mit Verwendungszweck „Rechnung Nr. … – ohne Mahnkosten“, dazu ein kurzes Schreiben, das die Nebenkosten mit Verweis auf § 309 Nr. 5 BGB und das BGH-Urteil zurückweist.
6. **Bei Inkasso-Übergabe neu prüfen.** Für Inkassokosten gelten eigene Grenzen (§ 13e RDG). Ein Inkassounternehmen darf die überhöhten Mahngebühren des Gläubigers nicht einfach übernehmen – und muss seine eigenen belegen.

Ein Gedanke zur Verhältnismäßigkeit: Bei einer Forderung von 49,90 Euro streiten sich Menschen um 7,50 Euro Mahngebühr, und aus Prinzip wird die ganze Rechnung nicht bezahlt. Das ist der teuerste Fehler in diesem Kapitel, denn die unbezahlte Hauptforderung – nicht die Gebühr – führt nach der zweiten Mahnung mit Hinweis zur Meldung an die Auskunftei. Zahlen Sie das, was Sie schulden, und streiten Sie über das, was Sie nicht schulden. Die Reihenfolge ist entscheidend.

Ein zweiter Gedanke zur Verjährung der Nebenkosten: Mahngebühren und Verzugszinsen verjähren mit der Hauptforderung – regelmäßig in drei Jahren zum Jahresende. Eine Forderung von 2022, für die 2026 noch Mahngebühren verlangt werden, ist mit hoher Wahrscheinlichkeit insgesamt verjährt. Der [Verjährungs-Rechner](/werkzeuge/verjaehrung) sagt es; die Einrede gehört dann in denselben Brief.

*Quelle: §§ 195, 199, 286, 288 BGB; § 13e RDG.*

## Was nicht geht

Überhöhte Mahngebühren machen die Hauptforderung nicht unberechtigt. Wer die Rechnung schuldet, schuldet sie – und wer sie nach zwei Mahnungen mit Hinweis nicht bezahlt, riskiert die Meldung an Auskunfteien, unabhängig davon, ob die Gebühren stimmten. Zahlen Sie die Hauptforderung, streichen Sie die Gebühren, und tun Sie beides schriftlich. Kommt später ein Inkassounternehmen dazu, gelten für dessen Kosten eigene Grenzen – der [Inkassokosten-Prüfer](/werkzeuge/inkassokosten) rechnet sie nach.

Aus der FIAON-Praxis: Mahngebühren sind selten der Grund, warum jemand einen Eintrag bekommt – aber oft der Grund, warum aus 50 Euro 200 werden, bevor jemand reagiert. Wer die Regeln kennt, reagiert früher. Mehr zur ganzen Treppe von der Mahnung zum Eintrag auf der Seite [Inkasso-Brief erhalten](/inkasso-brief-erhalten).`,
  },
];
