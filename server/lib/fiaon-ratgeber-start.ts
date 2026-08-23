// ═══════════════════════════════════════════════════════════════════════════
// Die ersten drei Ratgeber — von Hand geschrieben, nicht generiert (23.08.2026)
//
// Sie setzen den Maßstab für alles, was der Generator später liefert: ehrlich,
// konkret, mit Paragrafen, Fristen und einem klaren „Was nicht geht“. Werden
// beim ersten Start in `fiaon_ratgeber` eingetragen (ON CONFLICT DO NOTHING)
// und sind sofort veröffentlicht.
// ═══════════════════════════════════════════════════════════════════════════

export interface StartArtikel {
  slug: string; titel: string; untertitel: string; teaser: string; kategorie: string; land: string; keyword: string;
  schlagworte: string[]; metaTitel: string; metaBeschreibung: string; faq: { frage: string; antwort: string }[]; inhalt: string;
}

export const START_ARTIKEL: StartArtikel[] = [
  {
    slug: "schufa-eintrag-loeschen-lassen",
    titel: "SCHUFA-Eintrag löschen lassen: Welche Einträge angreifbar sind – und wie Sie vorgehen",
    untertitel: "Nicht jeder Eintrag ist berechtigt. Viele stehen zu lange, manche hätten nie gemeldet werden dürfen. So finden Sie heraus, welcher Eintrag fallen kann – und was Sie dafür tun müssen.",
    teaser: "Welche SCHUFA-Einträge angreifbar sind, welche Fristen gelten und wie ein Löschantrag nach Art. 17 DSGVO funktioniert – Schritt für Schritt.",
    kategorie: "eintraege", land: "DE", keyword: "schufa eintrag löschen",
    schlagworte: ["SCHUFA-Eintrag", "Löschantrag", "Art. 17 DSGVO", "§ 31 BDSG", "Löschfristen", "Erledigungsvermerk"],
    metaTitel: "SCHUFA-Eintrag löschen lassen: So gehen Sie vor",
    metaBeschreibung: "Welche SCHUFA-Einträge angreifbar sind, welche Löschfristen gelten und wie Sie einen Löschantrag nach Art. 17 DSGVO stellen – mit Schritt-für-Schritt-Anleitung.",
    faq: [
      { frage: "Kann ich einen berechtigten SCHUFA-Eintrag vorzeitig löschen lassen?", antwort: "In der Regel nicht. Ein Eintrag, der zu Recht gemeldet wurde und dessen Frist noch läuft, bleibt stehen. Was Sie tun können: die Forderung begleichen, damit der Erledigungsvermerk gesetzt wird – dann läuft die Löschfrist. Seit 2024 verkürzt sie sich auf 18 Monate, wenn Sie innerhalb von 100 Tagen nach der Meldung zahlen und keine weiteren Einträge hinzukommen." },
      { frage: "Wie lange dauert es, bis die SCHUFA auf einen Löschantrag antwortet?", antwort: "Nach Art. 12 DSGVO muss die Auskunftei innerhalb eines Monats reagieren; in komplizierten Fällen darf sie die Frist um zwei Monate verlängern, muss das aber mitteilen. In der Praxis kommen Antworten häufig nach zwei bis vier Wochen." },
      { frage: "Muss ich den Löschantrag an die SCHUFA oder an den Gläubiger schicken?", antwort: "An beide ist oft sinnvoll. Die SCHUFA prüft auf Ihren Antrag hin, ob der Eintrag die Voraussetzungen erfüllt, und fragt dazu beim meldenden Unternehmen nach. Ein gleichzeitiges Schreiben an den Gläubiger beschleunigt das, weil er die Meldung selbst zurücknehmen kann." },
      { frage: "Was passiert, wenn die SCHUFA die Löschung ablehnt?", antwort: "Dann haben Sie drei Wege: die Beschwerde beim SCHUFA-Ombudsmann, die Beschwerde bei der zuständigen Datenschutzbehörde nach Art. 77 DSGVO und – als letzter Schritt – die Klage. Welcher Weg passt, hängt davon ab, woran die Löschung gescheitert ist." },
      { frage: "Kostet die Löschung eines Eintrags etwas?", antwort: "Der Antrag bei der SCHUFA selbst ist kostenlos. Kosten entstehen nur, wenn Sie Hilfe in Anspruch nehmen – etwa einen Anwalt oder eine Plattform wie FIAON, die die Schreiben vorbereitet, versendet und die Fristen verfolgt." },
    ],
    inhalt: `Ein negativer SCHUFA-Eintrag fühlt sich endgültig an. Die Bank sagt Nein, der Mobilfunkanbieter will Vorkasse, und niemand erklärt, was genau dort eigentlich steht. Dabei ist ein Eintrag kein Urteil, sondern eine Meldung – und Meldungen unterliegen Regeln. Wer die Regeln kennt, stellt fest: Ein erheblicher Teil der Einträge ist angreifbar.

Dieser Text erklärt, welche Einträge Sie löschen lassen können, welche nicht, und wie der Weg dorthin konkret aussieht. Ohne Versprechen – aber mit den Fristen und Paragrafen, auf die es ankommt.

## Welche Einträge überhaupt angreifbar sind

Angreifbar ist ein Eintrag immer dann, wenn er eine Voraussetzung nicht erfüllt, die das Gesetz oder die Verhaltensregeln der Auskunfteien verlangen. In der Praxis sind es vier Gruppen:

**1. Der Eintrag ist falsch.** Falscher Betrag, falsche Person, eine Forderung, die nie bestand. Hier greift Art. 16 DSGVO: Sie haben ein Recht auf Berichtigung – und bei einer Forderung, die es nie gab, auf Löschung.

**2. Die Forderung wurde ohne die vorgeschriebenen Mahnungen gemeldet.** § 31 Abs. 2 BDSG verlangt für die Meldung einer offenen Forderung, dass sie fällig ist, dass Sie sie nicht bestritten haben, dass Sie mindestens zweimal schriftlich gemahnt wurden (mit mindestens vier Wochen Abstand) und dass Sie in einer Mahnung auf die mögliche Meldung hingewiesen wurden. Die Meldung darf frühestens vier Wochen nach der ersten Mahnung erfolgen. Fehlt eine dieser Voraussetzungen, ist die Meldung unzulässig. Ausnahme: Die Forderung ist tituliert (Vollstreckungsbescheid, Urteil) oder Sie haben sie ausdrücklich anerkannt.

**3. Die Forderung ist bezahlt, der Eintrag steht aber zu lange.** Eine beglichene Forderung bekommt einen Erledigungsvermerk und wird nach den Verhaltensregeln der Auskunfteien drei Jahre nach der Erledigung gelöscht – taggenau. Seit 2024 gilt eine kürzere Frist von 18 Monaten, wenn die Forderung innerhalb von 100 Tagen nach der Meldung beglichen wurde und keine weiteren Negativmerkmale vorliegen. Steht der Eintrag länger, ist er angreifbar.

**4. Der Eintrag stammt aus einer abgeschlossenen Insolvenz.** Der Bundesgerichtshof hat 2023 entschieden: Die Information über die Restschuldbefreiung darf nur so lange gespeichert werden wie im öffentlichen Insolvenzportal – sechs Monate. Danach muss sie weg.

Nicht angreifbar ist ein Eintrag, der zu Recht gemeldet wurde, noch offen ist oder dessen Löschfrist noch läuft. Das ist die ehrliche Hälfte dieses Textes, und sie steht bewusst am Anfang.

## Die Löschfristen im Überblick

| Eintragsart | Löschung |
|---|---|
| Beglichene Forderung (Erledigungsvermerk) | 3 Jahre nach Erledigung, taggenau |
| Beglichen innerhalb von 100 Tagen nach Meldung, keine weiteren Einträge | 18 Monate |
| Anfragen (Kredit, Konto) | nach 12 Monaten; für Dritte nur 10 Tage sichtbar |
| Restschuldbefreiung | 6 Monate nach Veröffentlichung |
| Girokonto, Kreditkarte, Kredit (Vertragsdaten) | mit Ende des Vertrags bzw. Rückzahlung |
| Offene, berechtigte Forderung | bleibt bis zur Erledigung stehen |

Die Fristen stammen aus den Verhaltensregeln der Auskunfteien, die der Verband „Die Wirtschaftsauskunfteien e. V.“ mit den Datenschutzbehörden abgestimmt hat. Sie sind keine Kulanz, sondern die Grundlage, auf die Sie sich in einem Schreiben berufen können.

## Schritt für Schritt zum Löschantrag

1. **Datenkopie anfordern.** Bevor Sie etwas angreifen, brauchen Sie den exakten Wortlaut. Die Datenkopie nach Art. 15 DSGVO ist kostenlos und zeigt jeden Eintrag mit Datum, Betrag, meldendem Unternehmen und Erledigungsvermerk.
2. **Jeden Eintrag einordnen.** Welche der vier Gruppen trifft zu? Ein Eintrag kann in mehrere fallen – bezahlt und ohne Mahnung gemeldet, zum Beispiel.
3. **Belege sammeln.** Kontoauszug mit der Zahlung, die Mahnungen (oder der Nachweis, dass keine kamen), Schriftwechsel mit dem Gläubiger, Insolvenzbeschluss.
4. **Löschantrag schreiben.** An die SCHUFA, mit Bezug auf Art. 17 DSGVO, unter Nennung des Eintrags, der Begründung und der Belege. Fristsetzung: ein Monat. Bei unzulässiger Meldung zusätzlich an den Gläubiger, mit der Aufforderung, die Meldung zurückzunehmen.
5. **Per Einschreiben versenden und Frist notieren.** Der Rückschein ist Ihr Beweis, dass der Antrag angekommen ist. Die Frist läuft ab Zugang.
6. **Antwort prüfen.** Löschung bestätigt: Datenkopie erneut anfordern und kontrollieren. Abgelehnt: nächste Stufe.
7. **Nächste Stufe.** Ombudsmann der SCHUFA (kostenlos, unabhängig), Beschwerde bei der Datenschutzbehörde nach Art. 77 DSGVO (zuständig ist die Behörde Ihres Bundeslandes oder die des Landes Hessen für die SCHUFA), danach Klage.

## Wie ein wirksames Schreiben aussieht

Ein Löschantrag ist kein Bittbrief. Er benennt den Eintrag, die Rechtsgrundlage und die Frist – mehr nicht. Was ihn wirksam macht:

- **Ein Eintrag pro Absatz.** Wer drei Einträge in einem Satz angreift, bekommt eine Antwort zu einem.
- **Die konkrete Voraussetzung, die fehlt.** Nicht „der Eintrag ist ungerecht“, sondern „die Forderung wurde ohne die nach § 31 Abs. 2 BDSG erforderlichen zwei Mahnungen gemeldet".
- **Belege als Anlage, nummeriert.** Die Auskunftei prüft Papier, keine Geschichten.
- **Eine Frist und die Ankündigung der nächsten Stufe.** „Sollte bis zum … keine Löschung erfolgen, werde ich mich an die zuständige Datenschutzbehörde wenden."
- **Kein Ton.** Ärger ist verständlich, hilft aber nicht. Sachlich gewinnt.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft, zerlegt sie in einzelne Einträge und ordnet jeden ein: berechtigt, bezahlt-aber-nicht-gelöscht, ohne Mahnung gemeldet, falsch. Für jeden angreifbaren Eintrag liegt das passende Schreiben aus anwaltlich geprüften Vorlagen bereit – Sie geben frei, FIAON versendet per Einschreiben, setzt die Frist, erfasst die Antwort und bereitet bei Ablehnung die nächste Stufe vor. Danach: Girokonto für jeden Kunden, Kreditkarte, sobald der Wert reicht.

## Was nicht geht

- Ein berechtigter, offener Eintrag lässt sich nicht „weglöschen“. Er verschwindet, wenn die Forderung erledigt ist und die Frist abgelaufen.
- Niemand kann Ihnen eine Löschung garantieren – weder eine Kanzlei noch eine Plattform. Wer das verspricht, verkauft etwas anderes.
- Ein Eintrag verschwindet nicht dadurch, dass die Forderung verjährt. Die Verjährung gibt Ihnen ein Recht, die Zahlung zu verweigern; der Eintrag bleibt, solange die Forderung als offen gilt.
- Mehrfache Löschanträge ohne neue Belege ändern nichts. Neue Stufe statt Wiederholung.

## Das Wichtigste in drei Sätzen

Ein SCHUFA-Eintrag ist angreifbar, wenn er falsch ist, ohne die vorgeschriebenen Mahnungen gemeldet wurde, nach Zahlung zu lange steht oder aus einer abgeschlossenen Insolvenz stammt. Der Weg führt über die kostenlose Datenkopie, einen sauberen Löschantrag nach Art. 17 DSGVO mit Belegen und Frist, und bei Ablehnung über Ombudsmann und Datenschutzbehörde. Berechtigte, offene Einträge bleiben – hier hilft nur Erledigung und Geduld.`,
  },
  {
    slug: "kreditkarte-trotz-schufa-eintrag",
    titel: "Kreditkarte trotz SCHUFA-Eintrag: Was realistisch ist – und was nicht",
    untertitel: "„Kreditkarte ohne SCHUFA“ ist ein Suchbegriff, kein Produkt. Was es wirklich gibt, was es kostet und wie aus einer Debitkarte eine echte Kreditkarte wird.",
    teaser: "Debit, Prepaid, Kaution oder echte Kreditkarte: Was mit negativem Eintrag möglich ist, was davon sinnvoll ist – und wann die echte Karte in Reichweite kommt.",
    kategorie: "karte", land: "DE", keyword: "kreditkarte trotz schufa",
    schlagworte: ["Kreditkarte", "Debitkarte", "Prepaid", "Basiskonto", "SCHUFA", "Kartenrahmen"],
    metaTitel: "Kreditkarte trotz SCHUFA: Was realistisch ist",
    metaBeschreibung: "Kreditkarte trotz negativem SCHUFA-Eintrag: Welche Karten es wirklich gibt, was sie kosten, worauf Sie achten müssen – und wie die echte Karte erreichbar wird.",
    faq: [
      { frage: "Gibt es eine echte Kreditkarte ohne SCHUFA-Abfrage?", antwort: "Eine Karte mit Kreditrahmen, bei der die Bank Ihnen Geld vorstreckt, gibt es ohne Bonitätsprüfung praktisch nicht – die Bank trägt das Risiko und prüft deshalb. Was es gibt: Debit- und Prepaid-Karten mit Visa- oder Mastercard-Logo, die ohne Abfrage ausgegeben werden, weil kein Kredit dahintersteht." },
      { frage: "Reicht eine Debitkarte für Hotel und Mietwagen?", antwort: "Meistens ja, aber nicht immer. Viele Hotels und die meisten Mietwagenfirmen blockieren eine Kaution auf der Karte; das funktioniert bei Debitkarten, sofern Guthaben da ist. Einige Autovermieter verlangen ausdrücklich eine Kreditkarte – das steht in den Mietbedingungen." },
      { frage: "Was ist mit Karten, die „ohne SCHUFA“ beworben werden?", antwort: "Prüfen Sie drei Dinge: Gibt es einen echten Kreditrahmen (meist nicht)? Welche Gebühren fallen an (Jahresgebühr, Aufladegebühr, Auslandsgebühr)? Und wer ist der Herausgeber – eine lizenzierte Bank oder ein Zahlungsdienstleister? Seriöse Angebote beantworten das auf der ersten Seite." },
      { frage: "Wie lange dauert es, bis ich nach einer Löschung eine echte Karte bekomme?", antwort: "Das hängt vom Wert nach der Löschung ab. Erfahrungsgemäß prüfen Kartenherausgeber den aktuellen Score und die Kontoführung der letzten Monate. Wer nach der Löschung einige Monate ein Konto ohne Rücklastschriften führt, hat realistische Chancen – eine feste Zahl gibt es nicht." },
      { frage: "Ist eine Prepaid-Kreditkarte gut für die Bonität?", antwort: "Sie schadet nicht, hilft aber auch nicht direkt: Prepaid-Karten werden in der Regel nicht an die SCHUFA gemeldet, weil kein Kredit besteht. Für die Bonität zählt eher, dass das dahinterliegende Konto sauber läuft." },
    ],
    inhalt: `„Kreditkarte ohne SCHUFA“ gehört zu den meistgesuchten Begriffen rund um Bonität. Das Problem: Es ist ein Suchbegriff, kein Produkt. Eine Karte, bei der eine Bank Ihnen Geld vorstreckt, ohne Ihre Bonität zu prüfen, gibt es nicht – und wer sie anbietet, verkauft meist etwas anderes, als auf der Verpackung steht.

Was es gibt, ist eine Reihe von Karten, die trotz negativem Eintrag funktionieren. Einige davon sind sinnvoll, einige teuer, und eine davon ist der Weg zur echten Kreditkarte. Dieser Text sortiert sie.

## Vier Arten von Karte – und was die SCHUFA damit zu tun hat

**Debitkarte mit Visa- oder Mastercard-Logo.** Die Karte zum Girokonto. Sie zahlen, der Betrag wird sofort abgebucht. Kein Kredit, deshalb in der Regel keine Bonitätsprüfung für die Karte – nur für das Konto, und dafür gibt es das Basiskonto (dazu unten). Funktioniert online, im Ausland, in den meisten Hotels.

**Prepaid-Karte.** Sie laden Guthaben auf, die Karte gibt nur das aus, was drauf ist. Keine Abfrage, keine Meldung. Der Haken: Gebühren. Jahresgebühr, Aufladegebühr, Fremdwährungsgebühr – bei manchen Anbietern zusammen über 100 Euro im Jahr für eine Karte, die nichts vorstreckt.

**Kreditkarte mit Kaution (Secured Card).** Sie hinterlegen einen Betrag – etwa 500 Euro –, die Bank gibt Ihnen eine echte Kreditkarte mit genau diesem Rahmen. Die Karte wird als Kreditkarte geführt und meist auch an die Auskunftei gemeldet, was bei pünktlicher Rückzahlung ein positives Merkmal ist. In Deutschland selten, in Österreich und der Schweiz gelegentlich angeboten.

**Echte Kreditkarte mit Rahmen.** Die Bank streckt vor, Sie zahlen monatlich oder in Raten zurück. Hier prüft jeder Herausgeber die Bonität, weil er das Risiko trägt. Mit einem offenen negativen Eintrag ist die Zusage unwahrscheinlich; nach Löschung und einigen sauberen Monaten wird sie realistisch.

## Was Sie mit negativem Eintrag sofort bekommen

Das **Basiskonto** ist der Schlüssel. Seit dem Zahlungskontengesetz (2016) hat jeder Verbraucher mit rechtmäßigem Aufenthalt in der EU Anspruch auf ein Girokonto mit grundlegenden Funktionen – unabhängig von der Bonität. Die Bank darf es nur in engen Ausnahmefällen ablehnen, etwa wenn Sie bereits ein Konto haben. Zum Basiskonto gehört eine Debitkarte; damit sind Online-Einkauf, Zahlung im Ausland und die meisten Alltagssituationen abgedeckt.

Viele Banken bieten Konten mit Debit-Mastercard oder Visa-Debit auch ohne den Umweg über den Basiskonto-Antrag an, teils kostenlos. FIAON-Kunden eröffnen beispielsweise ein Girokonto bei der DKB – unabhängig von der Bonität, als ersten Schritt im Fahrplan.

## Woran Sie unseriöse Angebote erkennen

Die Suche nach „Kreditkarte ohne SCHUFA“ führt auf Seiten, die von Ihrer Lage leben. Fünf Warnsignale:

- **Gebühren vor der Karte.** Eine „Bearbeitungsgebühr“ oder „Prüfgebühr“, bevor irgendetwas geliefert wurde.
- **Kein Herausgeber genannt.** Eine Karte wird immer von einer Bank oder einem lizenzierten E-Geld-Institut ausgegeben. Steht das nicht klar auf der Seite, Finger weg.
- **„Garantiert“ und „100 %“.** Niemand kann eine Karte garantieren.
- **Kreditrahmen ohne Prüfung.** Widerspruch in sich. Ein Rahmen ist ein Kredit, ein Kredit wird geprüft.
- **Druck.** „Nur heute“, „letzte Chance“. Eine Bank hat das nicht nötig.

## Schritt für Schritt zur echten Kreditkarte

1. **Konto in Ordnung bringen.** Girokonto oder Basiskonto eröffnen, Gehalt dorthin, keine Rücklastschriften. Die Kontoführung der letzten Monate ist das, was Kartenherausgeber neben dem Score am stärksten gewichten.
2. **Auskunft beschaffen und Einträge ordnen.** Welche Einträge sind angreifbar (falsch, ohne Mahnung gemeldet, zu lange gespeichert)? Welche sind berechtigt und müssen erledigt werden?
3. **Angreifbare Einträge löschen lassen.** Löschantrag nach Art. 17 DSGVO, Belege, Frist, Einschreiben. Jeder gelöschte Eintrag bewegt den Wert.
4. **Berechtigte Einträge erledigen.** Ratenvereinbarung oder Vergleich, Erledigungsvermerk sichern. Seit 2024 verkürzt sich die Löschfrist auf 18 Monate, wenn Sie innerhalb von 100 Tagen nach der Meldung zahlen.
5. **Keine neuen Anfragen streuen.** Jede Kreditanfrage wird zwölf Monate gespeichert und ist zehn Tage für andere sichtbar. Fünf abgelehnte Kartenanträge in einem Monat sind ein schlechtes Signal.
6. **Erst prüfen, dann beantragen.** Wenn die angreifbaren Einträge gefallen sind und das Konto einige Monate sauber läuft, bei einem Herausgeber beantragen – nicht bei fünf.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft, erklärt jeden Eintrag und bereitet die Schreiben vor, mit denen angreifbare Einträge fallen. Parallel öffnet die Plattform das Girokonto. Aus Einträgen, Einkommen und Kontoverhalten berechnet FIAON, wie weit die echte Kreditkarte entfernt ist – mit Meilensteinen, nicht mit Versprechen. Sobald der Wert die Schwelle des Kartenpartners erreicht, ist der Antrag vorbereitet.

## Was nicht geht

- Eine echte Kreditkarte mit Rahmen ohne jede Prüfung. Wer das verspricht, liefert eine Prepaid-Karte mit Gebühren.
- Eine Prepaid-Karte „baut“ keine Bonität auf. Sie wird meist nicht gemeldet.
- Eine Karte, die Sie nicht brauchen. Wer nur online zahlen und reisen will, kommt mit einer Debitkarte aus – ohne Jahresgebühr.
- Ein Zeitplan auf den Tag genau. Wann die echte Karte kommt, hängt von Ihren Einträgen und Ihrer Kontoführung ab, nicht von einem Kalender.

## Das Wichtigste in drei Sätzen

Mit negativem Eintrag bekommen Sie sofort ein Girokonto mit Debitkarte – per Basiskonto sogar mit Rechtsanspruch – und damit fast alles, was im Alltag gebraucht wird. Prepaid-Karten funktionieren, kosten aber oft mehr, als sie bringen; „Kreditkarten ohne SCHUFA“ mit Rahmen gibt es nicht. Die echte Karte kommt über den Umweg, nicht über die Abkürzung: Einträge ordnen, angreifbare löschen lassen, Konto sauber führen, dann gezielt beantragen.`,
  },
  {
    slug: "schufa-auskunft-kostenlos-datenkopie",
    titel: "SCHUFA-Auskunft kostenlos: Die Datenkopie nach Art. 15 DSGVO – Schritt für Schritt",
    untertitel: "Sie haben ein Recht darauf zu erfahren, was über Sie gespeichert ist – kostenlos, so oft es angemessen ist. Wie Sie die Datenkopie anfordern, was drinsteht und wie Sie sie lesen.",
    teaser: "Die kostenlose SCHUFA-Datenkopie nach Art. 15 DSGVO: Unterschied zur Bonitätsauskunft, Anforderung in fünf Schritten, Lesehilfe und was Sie danach tun.",
    kategorie: "auskunft", land: "DE", keyword: "schufa auskunft kostenlos",
    schlagworte: ["SCHUFA-Auskunft", "Datenkopie", "Art. 15 DSGVO", "Selbstauskunft", "Bonitätsauskunft", "Basisscore"],
    metaTitel: "SCHUFA-Auskunft kostenlos: Datenkopie anfordern",
    metaBeschreibung: "So fordern Sie die kostenlose SCHUFA-Datenkopie nach Art. 15 DSGVO an, was darin steht und wie Sie jeden Eintrag lesen – mit Anleitung und Musterformulierung.",
    faq: [
      { frage: "Ist die SCHUFA-Auskunft wirklich kostenlos?", antwort: "Die Datenkopie nach Art. 15 DSGVO ist kostenlos – die SCHUFA darf nur bei offensichtlich unbegründeten oder übermäßig häufigen Anfragen eine Gebühr verlangen oder ablehnen. Kostenpflichtig ist die „Bonitätsauskunft“, ein separates Dokument für Vermieter oder Vertragspartner." },
      { frage: "Wie lange dauert es, bis die Datenkopie kommt?", antwort: "Die SCHUFA muss innerhalb eines Monats antworten. In der Praxis kommt die Datenkopie per Post meist nach ein bis drei Wochen; online ist der Zugang bei vorheriger Identifizierung schneller." },
      { frage: "Was ist der Unterschied zwischen Datenkopie und Bonitätsauskunft?", antwort: "Die Datenkopie ist für Sie: alle gespeicherten Daten, alle Einträge, Score-Werte, Anfragen, Empfänger. Die Bonitätsauskunft ist für Dritte: ein Zertifikat, das nur zeigt, ob negative Merkmale vorliegen, ohne Einzelheiten. Für die Prüfung Ihrer Einträge brauchen Sie die Datenkopie." },
      { frage: "Steht in der Datenkopie auch mein Score?", antwort: "Ja. Die Datenkopie enthält den Basisscore und die an Vertragspartner übermittelten Branchenscores der letzten zwölf Monate, jeweils mit Datum. Die genaue Berechnungsformel bleibt Geschäftsgeheimnis der SCHUFA." },
      { frage: "Kann FIAON die Datenkopie für mich anfordern?", antwort: "FIAON beschafft die Auskunft mit Ihrer Vollmacht, liest sie mit Ihnen durch und ordnet jeden Eintrag ein. Den Antrag auf die kostenlose Datenkopie können Sie aber jederzeit auch selbst stellen – dieser Text zeigt, wie." },
    ],
    inhalt: `Die meisten Menschen erfahren von ihrem SCHUFA-Eintrag, wenn es zu spät ist: bei der abgelehnten Kontoeröffnung, beim Handyvertrag, beim Vermieter. Dabei hätten sie es vorher wissen können – kostenlos und mit wenigen Minuten Aufwand. Art. 15 der Datenschutz-Grundverordnung gibt Ihnen das Recht auf eine Kopie aller Daten, die ein Unternehmen über Sie speichert. Für die SCHUFA heißt das: jeder Eintrag, jeder Score, jede Anfrage, jeder Empfänger.

Dieser Text zeigt, wie Sie die Datenkopie anfordern, was drinsteht, wie Sie die einzelnen Zeilen lesen – und was Sie mit dem Ergebnis tun.

## Datenkopie oder Bonitätsauskunft? Der Unterschied, der Geld spart

Die SCHUFA bietet zwei Dokumente an, die oft verwechselt werden:

| | Datenkopie (Art. 15 DSGVO) | Bonitätsauskunft |
|---|---|---|
| Für wen | für Sie selbst | für Dritte (Vermieter, Vertragspartner) |
| Kosten | kostenlos | kostenpflichtig (derzeit rund 30 Euro) |
| Inhalt | alle Daten, Einträge, Scores, Anfragen, Empfänger | Zertifikat: negative Merkmale ja/nein, ohne Details |
| Zweck | prüfen, berichtigen, löschen lassen | vorzeigen |

Wer wissen will, was gespeichert ist, braucht die Datenkopie. Die Bonitätsauskunft ist ein Vorzeigedokument – nützlich für den Vermieter, nutzlos für die Prüfung Ihrer Einträge. Auf der Website der SCHUFA liegt die kostenpflichtige Variante prominenter; die kostenlose finden Sie unter „Datenkopie nach Art. 15 DS-GVO“.

## Schritt für Schritt zur kostenlosen Datenkopie

1. **Formular aufrufen.** Auf der SCHUFA-Website das Formular „Datenkopie (nach Art. 15 DS-GVO)“ wählen – nicht die Bonitätsauskunft. Alternativ schriftlich per Brief.
2. **Angaben machen.** Name, Geburtsdatum, aktuelle Anschrift, frühere Anschriften der letzten Jahre. Je vollständiger, desto sicherer wird die richtige Person gefunden – Namensgleichheiten führen sonst zu fremden Einträgen in Ihrer Kopie.
3. **Identität nachweisen.** Kopie von Vorder- und Rückseite des Ausweises. Nicht benötigte Angaben (Augenfarbe, Größe) dürfen Sie schwärzen; Name, Geburtsdatum, Anschrift und Gültigkeit müssen lesbar bleiben.
4. **Absenden und Datum notieren.** Die Frist von einem Monat läuft ab Eingang. Kommt nichts, erinnern – schriftlich, mit Bezug auf Art. 12 Abs. 3 DSGVO.
5. **Kopie prüfen.** Zeile für Zeile, nach der Lesehilfe unten. Fremde Einträge, falsche Beträge, fehlende Erledigungsvermerke notieren.

Wer lieber schreibt als klickt, kann diesen Satz verwenden: „Hiermit beantrage ich gemäß Art. 15 DSGVO eine vollständige Kopie der bei Ihnen zu meiner Person gespeicherten Daten, einschließlich der Score-Werte der letzten zwölf Monate, der Empfänger und der Herkunft der Daten." Dazu Name, Geburtsdatum, Anschrift(en), Ausweiskopie, Unterschrift.

## Was in der Datenkopie steht – und wie Sie es lesen

Die Datenkopie ist mehrere Seiten lang und wirkt auf den ersten Blick technisch. Sie besteht aus wenigen Blöcken:

**Personendaten.** Name, Geburtsdatum, Anschriften. Prüfen Sie frühere Adressen: Ein Tippfehler hier ist oft die Ursache für fremde Einträge.

**Vertragsdaten (Positivmerkmale).** Girokonten, Kreditkarten, Kredite, Mobilfunkverträge – mit Beginn, gegebenenfalls Ende und dem meldenden Unternehmen. Ein laufender Kredit, der pünktlich bedient wird, ist hier ein gutes Zeichen, kein schlechtes.

**Negativmerkmale.** Die Einträge, um die es geht: offene Forderungen, erledigte Forderungen mit Erledigungsvermerk, titulierte Forderungen, Insolvenz. Zu jedem Eintrag: Datum der Meldung, Betrag, meldendes Unternehmen, gegebenenfalls Erledigungsdatum. Die Löschfrist beginnt mit dem Erledigungsdatum – drei Jahre, in bestimmten Fällen 18 Monate.

**Anfragen.** Wer hat in den letzten zwölf Monaten Daten über Sie abgefragt? Eine „Anfrage Kreditkonditionen“ ist für andere unsichtbar und beeinflusst den Score nicht; eine „Anfrage Kredit“ ist zehn Tage sichtbar und zählt. Viele Kreditanfragen in kurzer Zeit sind ein Signal, das Sie vermeiden sollten.

**Score-Werte.** Der Basisscore in Prozent (quartalsweise aktualisiert) und die Branchenscores, die in den letzten zwölf Monaten an Vertragspartner übermittelt wurden – jeweils mit Datum, Empfänger und Ratingstufe. Die genaue Formel veröffentlicht die SCHUFA nicht; welche Merkmale einfließen, schon: Zahlungsverhalten, Anzahl und Art der Verträge, Anfragen, Adresswechsel, Alter der Daten.

**Empfänger.** An wen Ihre Daten übermittelt wurden. Hier sehen Sie, welche Bank oder welcher Händler tatsächlich nachgefragt hat.

## Was Sie nach dem Lesen tun

Die Datenkopie ist kein Ziel, sondern ein Werkzeug. Drei Ergebnisse sind typisch:

- **Alles richtig, keine Negativmerkmale.** Dann ist der abgelehnte Antrag nicht an der SCHUFA gescheitert, sondern an anderen Kriterien der Bank (Einkommen, Haushaltsrechnung, Anfragehäufung). Das lässt sich klären.
- **Einträge, die nicht stimmen oder zu lange stehen.** Berichtigung nach Art. 16, Löschung nach Art. 17 DSGVO – mit Belegen, Frist, Einschreiben.
- **Berechtigte, offene Einträge.** Hier hilft keine Löschung, sondern Erledigung: Ratenvereinbarung, Vergleich, Erledigungsvermerk sichern. Seit 2024 verkürzt Zahlung innerhalb von 100 Tagen nach der Meldung die Löschfrist auf 18 Monate.

Fordern Sie die Datenkopie in angemessenen Abständen erneut an – etwa nach jeder Löschung und einmal im Jahr. Sie ist kostenlos, solange die Anfragen nicht übermäßig häufig sind.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft mit Ihrer Vollmacht und liest sie nicht nur, sondern zerlegt sie: Jeder Eintrag wird einzeln eingeordnet – berechtigt, bezahlt-aber-nicht-gelöscht, ohne Mahnung gemeldet, falsch – mit Erklärung in Menschensprache und dem nächsten Schritt. Für angreifbare Einträge liegt das Schreiben bereit; FIAON versendet, verfolgt die Frist und holt die Antwort ein. Und es fragt in festen Abständen erneut ab, damit neue Einträge nicht erst beim nächsten abgelehnten Antrag auffallen.

## Was nicht geht

- Eine „Sofort-Auskunft“ kostenlos und online ohne Identifizierung. Die SCHUFA muss sicherstellen, dass nur Sie Ihre Daten bekommen – das dauert oder verlangt eine Registrierung.
- Die Datenkopie als Nachweis für den Vermieter. Sie enthält zu viele Details; dafür ist die Bonitätsauskunft gedacht.
- Der Score auf die Nachkommastelle erklären. Die Formel ist Geschäftsgeheimnis. Was sich ändern lässt, sind die Merkmale, die hineinfließen.

## Das Wichtigste in drei Sätzen

Die Datenkopie nach Art. 15 DSGVO ist kostenlos, enthält jeden Eintrag, jede Anfrage und Ihre Score-Werte, und sie kommt innerhalb eines Monats. Wählen Sie bewusst die Datenkopie und nicht die kostenpflichtige Bonitätsauskunft, und prüfen Sie jede Zeile – vor allem Adressen, Erledigungsvermerke und Anfragen. Was falsch ist oder zu lange steht, lässt sich berichtigen oder löschen; was berechtigt ist, erledigen Sie – und fordern die Kopie danach erneut an.`,
  },
];
