// ═══════════════════════════════════════════════════════════════════════════
// Sechs Insider-Ratgeber mit Quellen (23.08.2026, Justin: „wirklich INSIDER,
// aber belegbar — Statistiken, Quellen — und spannend geschrieben").
//
// Regel für diese Texte: Jede Zahl hat eine Quelle (Destatis, Creditreform
// SchuldnerAtlas, SCHUFA, EuGH, BDIU, Verbraucherzentrale) und steht mit
// Jahresangabe; wo eine Zahl schwankt, steht „rund". Beobachtungen aus
// FIAON-Akten sind als solche gekennzeichnet und nie als Statistik verkleidet.
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "./fiaon-ratgeber-start";

export const INSIDER_ARTIKEL: StartArtikel[] = [
  {
    slug: "bonitaet-in-zahlen-deutschland",
    titel: "Neun von zehn haben nur positive Einträge – und trotzdem 5,6 Millionen Überschuldete: Die Zahlen hinter der Bonität in Deutschland",
    untertitel: "Die SCHUFA speichert Daten zu rund 68 Millionen Menschen. Die allermeisten davon sind unauffällig. Und doch gilt jeder zwölfte Erwachsene als überschuldet. Was die Statistik über dieses Land erzählt – und was sie verschweigt.",
    teaser: "68 Millionen gespeicherte Personen, 5,6 Millionen Überschuldete, rund 31.000 Euro Schulden im Schnitt: Die wichtigsten Zahlen zur Bonität in Deutschland – mit Quellen, eingeordnet, ohne Panik.",
    kategorie: "grundlagen", land: "DE", keyword: "überschuldung deutschland statistik",
    schlagworte: ["Überschuldung", "SchuldnerAtlas", "SCHUFA Zahlen", "Destatis", "Bonität Deutschland", "Statistik"],
    metaTitel: "Bonität in Zahlen: Überschuldung in Deutschland",
    metaBeschreibung: "68 Mio. gespeicherte Personen, 5,6 Mio. Überschuldete, 31.000 € Schulden im Schnitt: Die Zahlen zur Bonität in Deutschland – mit Quellen (SCHUFA, Creditreform, Destatis).",
    faq: [
      { frage: "Wie viele Menschen in Deutschland gelten als überschuldet?", antwort: "Nach dem SchuldnerAtlas der Creditreform waren es 2024 rund 5,56 Millionen Erwachsene – eine Quote von rund 8,1 Prozent. 2023 lag die Zahl bei rund 5,65 Millionen. Überschuldet heißt: Die Schulden lassen sich aus Einkommen und Vermögen absehbar nicht mehr begleichen." },
      { frage: "Wie hoch sind die Schulden im Durchschnitt?", antwort: "Das Statistische Bundesamt erhebt die Überschuldungsstatistik aus Schuldnerberatungen: 2023 lag die durchschnittliche Schuldenhöhe bei rund 31.000 Euro. Das ist ein Durchschnitt – viele Fälle liegen deutlich darunter, wenige sehr weit darüber." },
      { frage: "Hat jeder mit Schulden einen negativen SCHUFA-Eintrag?", antwort: "Nein. Nach Angaben der SCHUFA liegen zu mehr als 90 Prozent der gespeicherten Personen ausschließlich positive Informationen vor. Ein negativer Eintrag entsteht erst, wenn eine Forderung nach den Regeln des § 31 BDSG gemeldet wird – nicht, weil jemand einen Kredit hat." },
      { frage: "Welche Rolle spielt die SCHUFA im Vergleich zu anderen Auskunfteien?", antwort: "Die SCHUFA ist die mit Abstand größte Auskunftei in Deutschland; daneben gibt es unter anderem Creditreform Boniversum, CRIF und infoscore. Alle unterliegen denselben Regeln der DSGVO und des BDSG – wer seine Datenkopie prüft, sollte sie bei mehreren anfordern." },
      { frage: "Woher stammen die Zahlen in diesem Text?", antwort: "Aus dem SchuldnerAtlas Deutschland der Creditreform (jährlich), der Überschuldungsstatistik des Statistischen Bundesamts (Destatis), den Unternehmensangaben der SCHUFA Holding AG und der Insolvenzstatistik von Destatis. Die Jahresangaben stehen jeweils dabei." },
    ],
    inhalt: `Wer einen negativen Eintrag hat, fühlt sich allein damit. Die Zahlen sagen etwas anderes – und gleichzeitig etwas Überraschendes: Die große Mehrheit der Menschen, über die Auskunfteien Daten speichern, ist vollkommen unauffällig. Beides stimmt. Zwischen diesen beiden Wahrheiten liegt das, was in Deutschland über Bonität selten erzählt wird.

Dieser Text legt die wichtigsten Zahlen nebeneinander, nennt ihre Quellen und ordnet ein, was sie für Sie bedeuten.

## 68 Millionen Menschen, eine Milliarde Datensätze

Die SCHUFA Holding AG speichert nach eigenen Angaben Daten zu rund 68 Millionen natürlichen Personen in Deutschland – praktisch jeder Erwachsene. Dazu kommen Daten zu Millionen Unternehmen. Pro Jahr beantworten die Systeme der SCHUFA mehr als 100 Millionen Anfragen von Vertragspartnern: Banken, Händler, Mobilfunkanbieter, Energieversorger, Vermieter.

Die Zahl, die am wenigsten bekannt ist: **Zu mehr als 90 Prozent der gespeicherten Personen liegen ausschließlich positive Informationen vor** – Konten, Karten, Verträge, die ordentlich laufen. Der negative Eintrag ist statistisch die Ausnahme. Wer einen hat, gehört zu einer Minderheit – aber zu einer Minderheit von mehreren Millionen Menschen.

*Quelle: SCHUFA Holding AG, Unternehmensangaben und Jahresberichte.*

## 5,6 Millionen Überschuldete – jeder zwölfte Erwachsene

Die Creditreform veröffentlicht jedes Jahr den SchuldnerAtlas Deutschland. Für 2024 weist er **rund 5,56 Millionen überschuldete Erwachsene** aus, eine Überschuldungsquote von **rund 8,1 Prozent**. 2023 waren es rund 5,65 Millionen (8,15 Prozent). Die Zahl sinkt seit einigen Jahren leicht – was die Creditreform unter anderem auf Beschäftigung und auf veränderte Zählweisen zurückführt, nicht auf ein Verschwinden des Problems.

Überschuldet bedeutet im SchuldnerAtlas: Die Summe der fälligen Zahlungsverpflichtungen übersteigt absehbar das, was aus Einkommen und Vermögen bezahlt werden kann. Das ist mehr als „Schulden haben“ – ein Kredit für ein Auto ist keine Überschuldung, solange die Raten laufen.

Die regionalen Unterschiede sind erheblich: In Bremen, Sachsen-Anhalt und Berlin liegen die Quoten seit Jahren deutlich über dem Bundesschnitt, in Bayern und Baden-Württemberg darunter. Innerhalb von Städten wiederholt sich das Muster zwischen Stadtteilen.

*Quelle: Creditreform, SchuldnerAtlas Deutschland 2023 und 2024.*

## Rund 31.000 Euro – und die drei Auslöser

Das Statistische Bundesamt erhebt die Überschuldungsstatistik aus den Daten der Schuldnerberatungsstellen. 2023 lag die **durchschnittliche Schuldenhöhe der beratenen Personen bei rund 31.000 Euro**. Der Durchschnitt täuscht: Viele Fälle liegen bei wenigen tausend Euro – Mobilfunk, Versandhandel, Energie –, einzelne Fälle mit Immobilien- oder Selbstständigenschulden ziehen den Mittelwert nach oben.

Die häufigsten Hauptauslöser nach Destatis, über die Jahre stabil: **Arbeitslosigkeit, Erkrankung/Sucht/Unfall und Trennung/Scheidung/Tod des Partners** – zusammen rund die Hälfte aller Fälle. „Unwirtschaftliche Haushaltsführung“ folgt erst dahinter. Mit anderen Worten: Die Mehrheit der Überschuldungen beginnt mit einem Lebensereignis, nicht mit Leichtsinn.

*Quelle: Statistisches Bundesamt (Destatis), Überschuldungsstatistik 2023.*

## Rund 70.000 Verbraucherinsolvenzen im Jahr

Die Verbraucherinsolvenz ist der letzte Ausweg – und sie wird genutzt: Destatis zählt in den letzten Jahren **rund 65.000 bis 72.000 Verbraucherinsolvenzverfahren pro Jahr** (2023: rund 66.000; 2024 leicht darüber). Seit der Verkürzung der Restschuldbefreiung auf drei Jahre (für Anträge ab Oktober 2020) ist das Verfahren attraktiver geworden.

Für die Bonität entscheidend: Die Information über die Restschuldbefreiung darf seit März 2023 nur noch **sechs Monate** gespeichert werden – vorher waren es drei Jahre. Die SCHUFA hat ihre Praxis nach Gerichtsentscheidungen und einem Verfahren vor dem Europäischen Gerichtshof angepasst.

*Quelle: Destatis, Insolvenzstatistik; SCHUFA, Mitteilung vom März 2023; EuGH, Urteil vom 7. Dezember 2023 (C-26/22 und C-64/22).*

## Was die Statistik nicht sieht

Die Zahlen erfassen, wer in einer Schuldnerberatung war oder wessen Überschuldung aus Negativmerkmalen erkennbar ist. Sie erfassen nicht:

- **Die Dunkelziffer.** Wer sich aus Scham nicht beraten lässt, taucht nirgends auf. Beratungsstellen schätzen die Zahl der Betroffenen deutlich höher als die der Beratenen.
- **Die „Beinahe“-Fälle.** Menschen, die jeden Monat gerade so durchkommen, mit Dispo und Ratenkauf – nicht überschuldet, aber einen Zwischenfall davon entfernt.
- **Die falschen Einträge.** Die Statistik zählt Einträge, nicht deren Berechtigung. In FIAON-Akten sehen wir regelmäßig Einträge ohne ordnungsgemäße Mahnung, mit falschen Beträgen oder zu langer Speicherung – wie häufig das bundesweit vorkommt, erfasst niemand.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft, zerlegt sie in Einträge und ordnet jeden ein – berechtigt, angreifbar, falsch. Aus tausenden Akten entsteht dabei etwas, das keine amtliche Statistik hat: Wissen darüber, welche Gläubiger wie melden, welche Fristen wo nicht eingehalten werden und welche Schreiben wirken. Dieses Wissen fließt in jede Einschätzung zurück.

## Was nicht geht

- Aus der Statistik ablesen, ob Ihr Eintrag berechtigt ist. Das zeigt nur Ihre Datenkopie.
- Mit dem Durchschnitt trösten. 31.000 Euro sind ein Mittelwert, nicht Ihr Fall.
- Die Zahlen auf Österreich oder die Schweiz übertragen. Dort gelten andere Systeme (KSV1870, CRIF, Betreibungsregister) und andere Zählweisen.

## Das Wichtigste in drei Sätzen

Die SCHUFA speichert Daten zu rund 68 Millionen Menschen – und zu mehr als 90 Prozent davon nur Positives; der negative Eintrag ist die Ausnahme. Trotzdem gelten rund 5,6 Millionen Erwachsene als überschuldet, im Schnitt mit rund 31.000 Euro, meist ausgelöst durch Jobverlust, Krankheit oder Trennung. Die Statistik zählt Einträge, nicht ihre Berechtigung – und genau dort beginnt die Arbeit.

## Quellen

- Creditreform: SchuldnerAtlas Deutschland 2023 und 2024 (creditreform.de)
- Statistisches Bundesamt: Überschuldungsstatistik 2023; Insolvenzstatistik 2023/2024 (destatis.de)
- SCHUFA Holding AG: Unternehmensangaben, Jahresberichte, Mitteilung zur Speicherdauer der Restschuldbefreiung (März 2023) (schufa.de)
- Gerichtshof der Europäischen Union: Urteile vom 7. Dezember 2023, Rechtssachen C-634/21 sowie C-26/22 und C-64/22 (curia.europa.eu)`,
  },
  {
    slug: "eugh-urteile-schufa-2023-was-sie-bedeuten",
    titel: "Der EuGH hat die SCHUFA 2023 zweimal getroffen: Was die Urteile für Ihren Score wirklich bedeuten",
    untertitel: "Am 7. Dezember 2023 hat der Europäische Gerichtshof in Luxemburg zwei Entscheidungen verkündet, die das Scoring in Deutschland verändern. Die Schlagzeilen waren groß, die Folgen sind konkret – und vielen Betroffenen unbekannt.",
    teaser: "EuGH C-634/21 und C-26/22: Scoring als automatisierte Entscheidung, Restschuldbefreiung nur sechs Monate gespeichert. Was die Urteile vom 7. Dezember 2023 für Ihren SCHUFA-Score bedeuten – und wie Sie sie nutzen.",
    kategorie: "score", land: "DE", keyword: "eugh schufa urteil",
    schlagworte: ["EuGH", "SCHUFA-Urteil", "Art. 22 DSGVO", "Scoring", "Restschuldbefreiung", "C-634/21"],
    metaTitel: "EuGH-Urteile zur SCHUFA 2023: Folgen für Ihren Score",
    metaBeschreibung: "Die EuGH-Urteile vom 7.12.2023 (C-634/21, C-26/22): Scoring als automatisierte Entscheidung, Restschuldbefreiung nur 6 Monate gespeichert. Was das für Sie bedeutet – und wie Sie es nutzen.",
    faq: [
      { frage: "Was hat der EuGH am 7. Dezember 2023 entschieden?", antwort: "Zwei Dinge. Erstens (C-634/21): Die Berechnung eines Score-Werts ist eine automatisierte Entscheidung im Sinne von Art. 22 DSGVO, wenn der Vertragspartner der Auskunftei dem Wert maßgeblich folgt – das löst besondere Rechte aus. Zweitens (C-26/22, C-64/22): Auskunfteien dürfen die Information über eine Restschuldbefreiung nicht länger speichern als das öffentliche Insolvenzregister, also sechs Monate." },
      { frage: "Ist der SCHUFA-Score jetzt verboten?", antwort: "Nein. Das Scoring bleibt zulässig. Aber wenn der Score die Entscheidung einer Bank maßgeblich bestimmt, gelten die Schutzrechte des Art. 22 DSGVO: Sie haben Anspruch auf aussagekräftige Informationen über die Logik, auf menschliches Eingreifen und darauf, die Entscheidung anzufechten." },
      { frage: "Was ändert sich für Menschen nach einer Insolvenz?", antwort: "Die Information über die Restschuldbefreiung wird nach sechs Monaten gelöscht – statt wie früher nach drei Jahren. Die SCHUFA hatte ihre Praxis bereits im März 2023 angepasst; der EuGH hat die Linie bestätigt. Wer eine ältere Speicherung findet, kann die Löschung verlangen." },
      { frage: "Kann ich mich auf die Urteile berufen, wenn eine Bank ablehnt?", antwort: "Sie können verlangen, dass ein Mensch die Entscheidung prüft, und Sie haben Anspruch auf Auskunft über die wesentlichen Gründe. Die Bank darf weiterhin ablehnen – aber nicht allein deshalb, weil ein Algorithmus eine Zahl ausgegeben hat, ohne dass jemand hingeschaut hat." },
      { frage: "Gibt es seit den Urteilen neue Gesetze?", antwort: "Die Bundesregierung hat 2024 eine Reform des Bundesdatenschutzgesetzes zum Scoring auf den Weg gebracht, die unter anderem regeln soll, welche Daten für Scores verwendet werden dürfen (etwa keine Anschriftendaten, keine Daten aus sozialen Netzwerken). Den jeweils aktuellen Stand finden Sie beim Bundesministerium des Innern." },
    ],
    inhalt: `Am 7. Dezember 2023 stand Wiesbaden vor Luxemburg. Der Europäische Gerichtshof verkündete zwei Urteile, die das Geschäftsmodell der größten deutschen Auskunftei betrafen – und damit die Bonität von 68 Millionen Menschen. Die Nachrichten sprachen von einer „Niederlage der SCHUFA“. Das ist nur halb richtig. Richtig ist: Seit diesem Tag haben Sie Rechte, die Sie vorher nicht hatten, und eine Frist, die vorher sechsmal länger war.

Dieser Text erklärt beide Entscheidungen ohne Juristendeutsch, zeigt, was sich in der Praxis geändert hat – und wie Sie die Urteile für sich nutzen.

## Urteil 1: Der Score ist eine Entscheidung (C-634/21)

Der Fall: Eine Frau aus Hessen bekam keinen Kredit, weil ihr SCHUFA-Score schlecht war. Sie verlangte Auskunft über die Berechnung – die SCHUFA verwies auf das Geschäftsgeheimnis und darauf, dass nicht sie entscheide, sondern die Bank. Das Verwaltungsgericht Wiesbaden legte die Frage dem EuGH vor.

Die Antwort des Gerichtshofs: Wenn ein Vertragspartner – etwa eine Bank – dem Score-Wert bei seiner Entscheidung **maßgeblich** folgt, dann ist bereits die Berechnung des Scores eine „automatisierte Entscheidung im Einzelfall“ nach Art. 22 DSGVO. Nicht erst das Nein der Bank, sondern die Zahl selbst.

Warum das wichtig ist: Art. 22 DSGVO verbietet Entscheidungen, die ausschließlich auf automatisierter Verarbeitung beruhen und rechtliche Wirkung entfalten – es sei denn, ein Gesetz erlaubt sie ausdrücklich und sieht Schutzmaßnahmen vor. Dazu gehören: das Recht auf **menschliches Eingreifen**, das Recht, den **eigenen Standpunkt darzulegen**, das Recht, die Entscheidung **anzufechten**, und das Recht auf **aussagekräftige Informationen über die involvierte Logik**.

Was sich daraus ergibt: Wer wegen eines Scores abgelehnt wird, kann verlangen, dass ein Mensch die Entscheidung prüft, und hat Anspruch darauf, die wesentlichen Gründe zu erfahren. Die SCHUFA selbst hat nach dem Urteil ihre Auskünfte erweitert und erklärt in der Datenkopie heute ausführlicher, welche Merkmalsgruppen den Wert beeinflussen. Die Formel bleibt geheim – der Anspruch auf Erklärung ist neu.

## Urteil 2: Sechs Monate, nicht drei Jahre (C-26/22 und C-64/22)

Der zweite Fall betraf Menschen nach einer Privatinsolvenz. Die Restschuldbefreiung wird im öffentlichen Insolvenzportal veröffentlicht und dort nach sechs Monaten gelöscht. Die SCHUFA speicherte dieselbe Information drei Jahre – mit der Folge, dass Menschen, die ihre Insolvenz hinter sich hatten, drei weitere Jahre keinen Mietvertrag, keinen Handyvertrag und kein normales Konto bekamen.

Der EuGH entschied: Eine private Auskunftei darf diese Daten nicht länger vorhalten als das öffentliche Register. Die Speicherung über sechs Monate hinaus ist nicht mit der DSGVO vereinbar. Die SCHUFA hatte ihre Praxis bereits im März 2023 – nach Urteilen des Oberlandesgerichts Schleswig – auf sechs Monate umgestellt; das Luxemburger Urteil machte daraus die verbindliche Linie für alle Auskunfteien.

Für Betroffene heißt das: Sechs Monate nach der Restschuldbefreiung muss der Eintrag weg sein. Wer in seiner Datenkopie eine ältere Speicherung findet, hat einen klaren Löschanspruch – und kann sich dabei auf ein Urteil berufen, das jede Sachbearbeiterin kennt.

## Was sich seitdem in der Praxis geändert hat

- **Datenkopien sind ausführlicher geworden.** Die Erklärungen zu den Score-Merkmalen sind länger; die übermittelten Branchenscores der letzten zwölf Monate stehen mit Datum und Empfänger drin.
- **Banken müssen Ablehnungen begründen können.** „Der Computer sagt Nein“ reicht nicht mehr, wenn der Score maßgeblich war.
- **Die Gesetzgebung bewegt sich.** Die Bundesregierung hat 2024 eine Änderung des Bundesdatenschutzgesetzes zum Scoring vorgelegt: Bestimmte Daten – etwa Anschriften, Daten aus sozialen Netzwerken, Informationen über Herkunft oder Gesundheit – sollen für Scores tabu sein. Den aktuellen Stand des Verfahrens finden Sie beim Bundesministerium des Innern.
- **Die Verhaltensregeln der Auskunfteien wurden 2024 überarbeitet**, unter anderem mit der 100-Tage-Regel für schnelle Zahler.

## Schritt für Schritt: die Urteile nutzen

1. **Datenkopie anfordern** (Art. 15 DSGVO, kostenlos). Prüfen: Gibt es einen Eintrag zur Restschuldbefreiung, der älter als sechs Monate ist? Löschantrag mit Hinweis auf C-26/22.
2. **Abgelehnt worden?** Schriftlich bei der Bank nachfragen, ob der Score maßgeblich war, und um Prüfung durch einen Menschen sowie um die wesentlichen Gründe bitten (Art. 22 Abs. 3 DSGVO).
3. **Bei der SCHUFA** aussagekräftige Informationen über die Logik des Scorings verlangen (Art. 15 Abs. 1 lit. h DSGVO) – die Antwort zeigt, welche Merkmalsgruppen bei Ihnen belasten.
4. **Belastende Merkmale bearbeiten.** Angreifbare Einträge löschen lassen, Anfragen vermeiden, Verträge pünktlich bedienen.
5. **Bei Weigerung:** Beschwerde bei der Datenschutzbehörde (Art. 77 DSGVO). Die Urteile sind dort bekannt.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft, prüft Speicherfristen – einschließlich der Sechs-Monats-Frist nach Insolvenz – und bereitet Löschanträge mit der richtigen Rechtsgrundlage vor. Wird ein Kunde wegen eines Scores abgelehnt, formuliert FIAON die Anfrage nach Art. 22 DSGVO an die Bank und die Auskunft nach Art. 15 an die Auskunftei, versendet per Einschreiben und verfolgt die Fristen.

## Was nicht geht

- Die Score-Formel erzwingen. Der EuGH hat die Erklärung der Logik gestärkt, nicht die Offenlegung des Algorithmus.
- Aus dem Urteil einen Kredit ableiten. Banken dürfen weiterhin ablehnen – nur nicht blind.
- Einträge löschen, die nichts mit der Insolvenz zu tun haben. Die Sechs-Monats-Frist gilt für die Restschuldbefreiung, nicht für alle Einträge.

## Das Wichtigste in drei Sätzen

Seit dem 7. Dezember 2023 gilt: Ein Score, dem eine Bank maßgeblich folgt, ist eine automatisierte Entscheidung – mit Ihrem Recht auf menschliche Prüfung, Begründung und Anfechtung. Die Restschuldbefreiung darf nur sechs Monate gespeichert werden, nicht drei Jahre. Beides steht nicht in jeder Datenkopie von selbst richtig drin – prüfen Sie, und berufen Sie sich auf Luxemburg.

## Quellen

- EuGH, Urteil vom 7. Dezember 2023, Rechtssache C-634/21 (SCHUFA Holding – Scoring) (curia.europa.eu)
- EuGH, Urteil vom 7. Dezember 2023, verbundene Rechtssachen C-26/22 und C-64/22 (SCHUFA Holding – Restschuldbefreiung) (curia.europa.eu)
- Art. 15 und Art. 22 DSGVO; § 31 BDSG
- SCHUFA Holding AG: Mitteilung zur verkürzten Speicherdauer der Restschuldbefreiung (28. März 2023) (schufa.de)
- Bundesministerium des Innern: Entwurf zur Änderung des BDSG (Scoring), 2024 (bmi.bund.de)`,
  },
  {
    slug: "100-tage-regel-schufa-2024",
    titel: "Die 100-Tage-Regel: Warum schnelle Zahler seit 2024 belohnt werden – und wer davon nichts weiß",
    untertitel: "Eine kleine Änderung in den Verhaltensregeln der Auskunfteien halbiert die Speicherdauer von Einträgen – für alle, die schnell reagieren. Die Regel ist seit 2024 in Kraft. Fast niemand kennt sie.",
    teaser: "Seit 2024: Wer eine gemeldete Forderung innerhalb von 100 Tagen begleicht, bekommt den Eintrag nach 18 Monaten gelöscht statt nach drei Jahren. Wie die Regel funktioniert, wo die Fallen liegen – und wie Sie sie nutzen.",
    kategorie: "eintraege", land: "DE", keyword: "schufa 100 tage regel",
    schlagworte: ["100-Tage-Regel", "Löschfrist", "18 Monate", "Verhaltensregeln Auskunfteien", "SCHUFA 2024", "Erledigungsvermerk"],
    metaTitel: "SCHUFA 100-Tage-Regel: Eintrag nach 18 Monaten weg",
    metaBeschreibung: "Die 100-Tage-Regel seit 2024: Forderung innerhalb von 100 Tagen nach der Meldung begleichen – der SCHUFA-Eintrag wird nach 18 Monaten gelöscht statt nach 3 Jahren. So funktioniert sie.",
    faq: [
      { frage: "Was genau besagt die 100-Tage-Regel?", antwort: "Wird eine an die Auskunftei gemeldete Forderung innerhalb von 100 Tagen nach der Meldung vollständig beglichen und liegen zu der Person keine weiteren Negativmerkmale vor, wird der Eintrag 18 Monate nach der Erledigung gelöscht – statt nach der regulären Frist von drei Jahren." },
      { frage: "Ab wann zählen die 100 Tage?", antwort: "Ab dem Tag der Meldung an die Auskunftei, nicht ab der Mahnung. Das Meldedatum steht in Ihrer Datenkopie. Wer die Datenkopie nicht kennt, kennt auch den Fristbeginn nicht – das ist die erste Falle." },
      { frage: "Gilt die Regel auch für ältere Einträge?", antwort: "Sie gilt für Einträge, die nach dem Inkrafttreten der überarbeiteten Verhaltensregeln 2024 entstanden sind. Für ältere Einträge bleibt es bei drei Jahren nach Erledigung. Prüfen Sie Meldedatum und Erledigungsdatum in der Datenkopie." },
      { frage: "Was, wenn ich zwei Einträge habe?", antwort: "Dann greift die kurze Frist nicht – Voraussetzung ist, dass keine weiteren Negativmerkmale vorliegen. Wer beide Forderungen innerhalb der 100 Tage begleicht, sollte die Auskunftei ausdrücklich auf die Regel hinweisen; die Auslegung kann im Einzelfall unterschiedlich sein." },
      { frage: "Zählt eine Ratenvereinbarung als Begleichung?", antwort: "Nein – begleichen heißt vollständig bezahlen. Eine Ratenvereinbarung, die über die 100 Tage hinausläuft, erfüllt die Voraussetzung nicht. Wenn es irgendwie geht, lohnt sich hier die Einmalzahlung, notfalls mit Hilfe aus dem Umfeld." },
    ],
    inhalt: `Es gibt Regeln, die in Pressemitteilungen stehen, und Regeln, die in Mahnungen fehlen. Die 100-Tage-Regel gehört zur zweiten Sorte. Sie steht in den überarbeiteten Verhaltensregeln der Wirtschaftsauskunfteien, die seit 2024 gelten, und sie halbiert die Speicherdauer eines Eintrags – für alle, die schnell zahlen. Inkassounternehmen erwähnen sie in ihren Schreiben nicht. Die meisten Betroffenen erfahren erst von ihr, wenn die 100 Tage vorbei sind.

Dieser Text erklärt die Regel, ihre Voraussetzungen und ihre Fallen – und was Sie tun müssen, damit sie für Sie greift.

## Die Regel in einem Absatz

Bisher galt für erledigte Forderungen eine einheitliche Frist: Löschung **drei Jahre** nach dem Erledigungsdatum, taggenau. Seit 2024 gibt es eine zweite Spur: Wer eine gemeldete Forderung **innerhalb von 100 Tagen nach der Meldung** vollständig begleicht und zu dem keine weiteren Negativmerkmale gespeichert sind, bekommt den Eintrag bereits **18 Monate nach der Erledigung** gelöscht.

Die Differenz sind 18 Monate – anderthalb Jahre früher ein normales Konto, ein Mietvertrag ohne Diskussion, eine Karte.

## Warum die Regel existiert

Die Verhaltensregeln der Auskunfteien („Code of Conduct“) sind eine Selbstverpflichtung des Verbands „Die Wirtschaftsauskunfteien e. V.“, abgestimmt mit den Datenschutzbehörden. Sie legen fest, wie lange welche Daten gespeichert werden. Die Überarbeitung 2024 folgte auf Kritik von Verbraucherschützern und Datenschutzbehörden, dass ein einmaliger Fehler – eine vergessene Rechnung, ein Umzug ohne Nachsendeauftrag – drei Jahre nachwirkt, auch wenn er sofort bereinigt wurde. Die Regel unterscheidet jetzt zwischen dem einmaligen Ausrutscher und dem dauerhaften Problem.

*Quelle: Die Wirtschaftsauskunfteien e. V., Verhaltensregeln für die Prüf- und Löschfristen von personenbezogenen Daten, Fassung 2024; SCHUFA Holding AG, Erläuterungen zu den Löschfristen.*

## Die drei Fallen

**Falle 1: Der Fristbeginn.** Die 100 Tage laufen ab **Meldung**, nicht ab Mahnung und nicht ab Rechnung. Wer erst mit dem Inkassobrief von der Sache erfährt, hat oft schon Wochen verloren – die Meldung kann vor dem Brief liegen. Das Meldedatum steht nur an einem Ort: in der Datenkopie nach Art. 15 DSGVO.

**Falle 2: Die Ratenvereinbarung.** Raten sind in vielen Fällen vernünftig – aber sie erfüllen die Voraussetzung „beglichen“ nicht, wenn die letzte Rate nach Tag 100 fällt. Wer die Summe irgendwie innerhalb der Frist aufbringen kann, sollte das tun. Eine Forderung von 300 Euro innerhalb von 100 Tagen zu zahlen ist der Unterschied zwischen 18 Monaten und drei Jahren Eintrag.

**Falle 3: Der zweite Eintrag.** Die kurze Frist gilt nur, wenn keine weiteren Negativmerkmale vorliegen. Ein zweiter Eintrag – auch ein erledigter – kann die Regel aushebeln. Wer zwei Forderungen hat, sollte beide innerhalb der Frist erledigen und die Auskunftei ausdrücklich auf die Regel hinweisen.

## Die Erledigung muss gemeldet werden

Die Frist läuft ab dem **Erledigungsdatum**, das der Gläubiger meldet. Meldet er gar nicht oder meldet er den falschen Tag, verschiebt sich alles. Nach der Zahlung gehören deshalb drei Dinge zusammen: Zahlungsbeleg aufbewahren, den Gläubiger schriftlich zur unverzüglichen Meldung der Erledigung auffordern, und nach vier bis sechs Wochen die Datenkopie prüfen.

## Schritt für Schritt: die Regel nutzen

1. **Sofort die Datenkopie anfordern**, wenn eine Mahnung mit Meldungsandrohung oder ein Inkassobrief kommt. Sie zeigt, ob und wann gemeldet wurde.
2. **Forderung prüfen.** Berechtigt? Dann zählt jeder Tag. Nicht berechtigt? Dann schriftlich bestreiten – eine bestrittene Forderung darf nicht gemeldet werden (§ 31 Abs. 2 BDSG).
3. **Innerhalb der 100 Tage vollständig bezahlen.** Mit Verwendungszweck, Beleg aufbewahren.
4. **Gläubiger zur Erledigungsmeldung auffordern.** Schriftlich, mit Zahlungsbeleg, Frist zwei Wochen.
5. **Auskunftei informieren.** Kurzes Schreiben: Forderung am … beglichen, Meldung am …, Bitte um Erledigungsvermerk und Löschung nach 18 Monaten gemäß den Verhaltensregeln.
6. **Löschdatum notieren** – 18 Monate nach Erledigung – und an diesem Tag die Datenkopie prüfen.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft und liest das Meldedatum – der Countdown ist damit sichtbar. Für berechtigte Forderungen bereitet FIAON die Zahlungsbestätigung an den Gläubiger und das Schreiben an die Auskunftei vor, mit Verweis auf die 100-Tage-Regel; für unberechtigte den Widerspruch. Jedes Löschdatum steht in der Akte, und am Tag danach prüft FIAON, ob die Löschung erfolgt ist.

## Was nicht geht

- Die 100 Tage rückwirkend retten. Wer nach Tag 101 zahlt, landet bei drei Jahren.
- Die Regel auf alte Einträge anwenden. Sie gilt für Meldungen nach Inkrafttreten der Fassung 2024.
- Eine Ratenvereinbarung als Begleichung verkaufen. Begleichen heißt bezahlen.

## Das Wichtigste in drei Sätzen

Seit 2024 wird ein gemeldeter Eintrag nach 18 Monaten statt nach drei Jahren gelöscht, wenn Sie die Forderung innerhalb von 100 Tagen nach der Meldung vollständig begleichen und sonst nichts vorliegt. Die Frist beginnt mit der Meldung – die Sie nur über die Datenkopie erfahren –, und sie scheitert an Ratenplänen und zweiten Einträgen. Wer schnell zahlt, Belege sichert und die Erledigungsmeldung einfordert, gewinnt anderthalb Jahre.

## Quellen

- Die Wirtschaftsauskunfteien e. V.: Verhaltensregeln für die Prüf- und Löschfristen von personenbezogenen Daten durch die deutschen Wirtschaftsauskunfteien (Fassung 2024)
- SCHUFA Holding AG: Informationen zu Speicher- und Löschfristen (schufa.de)
- § 31 Abs. 2 BDSG (Voraussetzungen der Meldung), Art. 15 und 17 DSGVO
- Verbraucherzentrale Bundesverband: Stellungnahmen zu Speicherfristen bei Auskunfteien (vzbv.de)`,
  },
  {
    slug: "mobilfunk-versandhaus-eintraege-die-schwaechsten",
    titel: "Mobilfunk und Versandhaus: Warum die häufigsten Einträge oft die schwächsten sind",
    untertitel: "Kein Kredit, keine Hypothek – die typische Forderung hinter einem negativen Eintrag ist eine Handyrechnung nach dem Umzug oder eine Bestellung, die nie ankam. Genau diese Einträge scheitern besonders oft an den Meldevoraussetzungen.",
    teaser: "Warum Mobilfunk- und Versandhaus-Forderungen so häufig zu Einträgen führen, welche Meldevoraussetzungen dabei regelmäßig fehlen – und wie Sie diese Einträge gezielt angreifen. Mit Rechtsgrundlagen und Praxisbeobachtungen.",
    kategorie: "eintraege", land: "DE", keyword: "schufa eintrag mobilfunk löschen",
    schlagworte: ["Mobilfunk SCHUFA", "Versandhaus Inkasso", "§ 31 BDSG", "Mahnung", "Eintrag anfechten", "Umzug"],
    metaTitel: "Mobilfunk & Versandhaus: Die schwächsten SCHUFA-Einträge",
    metaBeschreibung: "Handyvertrag nach Umzug, Bestellung nie erhalten: Warum Mobilfunk- und Versandhaus-Einträge so häufig sind, welche Meldevoraussetzungen oft fehlen – und wie Sie sie gezielt angreifen.",
    faq: [
      { frage: "Warum führen gerade Handyverträge so oft zu Einträgen?", antwort: "Weil sie lange laufen, monatlich abgerechnet werden und bei einem Umzug oder Kontowechsel leicht aus dem Blick geraten. Kündigungen scheitern an Fristen, Rechnungen gehen an alte Adressen, Rücklastschriften häufen sich – und Mobilfunkanbieter melden konsequent. Verbraucherzentralen zählen Telekommunikation seit Jahren zu den beschwerdestärksten Branchen." },
      { frage: "Darf ein Versandhaus melden, wenn ich die Ware nie bekommen habe?", antwort: "Nur eine unbestrittene, fällige Forderung darf gemeldet werden (§ 31 Abs. 2 BDSG). Wer die Lieferung schriftlich bestreitet – die Ware kam nicht, war beschädigt, wurde zurückgeschickt –, bestreitet die Forderung. Eine Meldung trotz Bestreitens ist unzulässig." },
      { frage: "Die Mahnungen gingen an meine alte Adresse – zählt das?", antwort: "Das ist der häufigste Streitpunkt. Der Gläubiger muss nachweisen, dass die Mahnungen zugegangen sind. Hat er an eine Adresse gemahnt, von der er wissen konnte, dass sie veraltet ist, oder lag eine Nachsendung vor, fehlt oft der Zugang – und damit eine Voraussetzung für die Meldung. Gleichzeitig gilt: Wer umzieht, ist für die Mitteilung seiner neuen Adresse verantwortlich." },
      { frage: "Lohnt sich der Aufwand bei 80 Euro?", antwort: "Der Betrag ist für die Wirkung eines Eintrags unerheblich – ein Eintrag über 80 Euro sperrt dieselben Türen wie einer über 8.000. Gerade kleine Forderungen werden aber oft nachlässig gemahnt und gemeldet; der Aufwand lohnt sich also doppelt." },
      { frage: "Was ist, wenn die Forderung berechtigt ist?", antwort: "Dann zahlen – möglichst innerhalb von 100 Tagen nach der Meldung, denn dann wird der Eintrag seit 2024 nach 18 Monaten gelöscht statt nach drei Jahren. Und den Gläubiger zur Meldung der Erledigung auffordern." },
    ],
    inhalt: `Wer „negativer SCHUFA-Eintrag“ hört, denkt an geplatzte Kredite. Die Realität in Beratungsstellen und in FIAON-Akten sieht anders aus: Der typische Eintrag stammt von einem Mobilfunkanbieter oder einem Versandhändler, liegt zwischen 50 und 500 Euro und hat eine Geschichte, die mit einem Umzug, einer Kündigung oder einem Paket beginnt, das nie ankam. Das Interessante daran: Genau diese Einträge scheitern besonders oft an den Voraussetzungen, die das Gesetz für eine Meldung verlangt.

Dieser Text erklärt, warum das so ist, welche Voraussetzungen regelmäßig fehlen – und wie Sie einen solchen Eintrag gezielt prüfen und angreifen.

## Warum ausgerechnet Mobilfunk und Versandhandel

Drei Eigenschaften machen diese Branchen zu Eintragsmaschinen:

**Laufende Verträge mit monatlicher Abrechnung.** Ein Handyvertrag läuft 24 Monate, verlängert sich automatisch und bucht monatlich ab. Ein Kontowechsel, eine geplatzte Lastschrift, eine Kündigung, die zwei Tage zu spät kam – und aus einem Vertrag wird eine Forderung. Die Bundesnetzagentur und die Verbraucherzentralen führen Telekommunikation seit Jahren unter den beschwerdestärksten Branchen; die Kündigung ist dabei das häufigste Thema.

**Adressabhängigkeit.** Rechnungen und Mahnungen gehen per Post oder an eine E-Mail-Adresse, die nach dem Providerwechsel nicht mehr gelesen wird. Wer umzieht, ohne jeden Vertragspartner zu informieren, bekommt die Mahnung nicht – der Gläubiger mahnt trotzdem.

**Industrialisiertes Forderungsmanagement.** Große Anbieter geben Forderungen nach festen Fristen automatisch an Inkasso ab und melden nach festem Schema. Das ist effizient – und fehleranfällig: Die Meldung erfolgt, ob die Mahnungen zugegangen sind oder nicht.

## Die Voraussetzungen, die fehlen

§ 31 Abs. 2 BDSG erlaubt die Meldung einer offenen Forderung nur, wenn sie fällig und unbestritten ist, wenn mindestens zweimal schriftlich gemahnt wurde (mit mindestens vier Wochen Abstand), wenn in einer Mahnung auf die mögliche Meldung hingewiesen wurde – und wenn die Meldung frühestens vier Wochen nach der ersten Mahnung erfolgt. In der Praxis scheitert es an vier Stellen:

1. **Die Forderung war bestritten.** Wer dem Versandhaus geschrieben hat „Ware nie erhalten“ oder dem Anbieter „Vertrag gekündigt zum …“, hat bestritten. Eine bestrittene Forderung darf nicht gemeldet werden – unabhängig davon, ob das Bestreiten berechtigt war.
2. **Die Mahnungen sind nicht zugegangen.** Der Gläubiger trägt die Beweislast für den Zugang. Eine Mahnung an eine Adresse, die er als veraltet kannte, reicht nicht.
3. **Der Hinweis auf die Meldung fehlte.** Manche Standardmahnungen enthalten ihn nicht oder nur versteckt.
4. **Die Fristen wurden nicht eingehalten.** Zwei Mahnungen innerhalb von zehn Tagen, Meldung in Woche drei – so etwas kommt in automatisierten Prozessen vor.

In FIAON-Akten sehen wir bei Mobilfunk- und Versandhaus-Einträgen regelmäßig, dass der Gläubiger auf Nachfrage die Mahnungen nicht vollständig vorlegen kann. Das ist keine Statistik, aber ein Muster.

## Schritt für Schritt: den Eintrag prüfen und angreifen

1. **Datenkopie anfordern** (Art. 15 DSGVO). Notieren: Gläubiger, Betrag, Meldedatum, Erledigungsvermerk.
2. **Eigene Unterlagen sichten.** Kündigung? Rücksendebeleg? Schriftwechsel, in dem Sie die Forderung bestritten haben? Umzugsdatum und Ummeldung?
3. **Gläubiger schriftlich auffordern**, die Mahnungen mit Zugangsnachweis und die Forderungsaufstellung vorzulegen. Frist 14 Tage. Per Einschreiben.
4. **Gleichzeitig die Auskunftei informieren**, dass die Meldevoraussetzungen nach § 31 Abs. 2 BDSG bestritten werden, und um Prüfung bitten. Die Auskunftei muss beim Gläubiger nachfragen.
5. **Kommt kein Nachweis:** Löschung nach Art. 17 DSGVO verlangen – vom Gläubiger die Rücknahme der Meldung, von der Auskunftei die Löschung.
6. **Bei Weigerung:** Datenschutzbehörde (Art. 77 DSGVO) oder Ombudsmann. Bei berechtigter Forderung: zahlen – innerhalb von 100 Tagen nach Meldung, dann nur 18 Monate Speicherung.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft, erkennt Mobilfunk- und Versandhaus-Einträge und bereitet die Nachweisanforderung an den Gläubiger sowie das Schreiben an die Auskunftei vor. Sie geben frei, FIAON versendet per Einschreiben, hält die Frist und bewertet die Antwort: vollständige Mahnungen vorgelegt – dann Erledigung organisieren; unvollständig – dann Löschantrag. Jeder Eintrag bekommt eine Erfolgsaussicht, die aus vergleichbaren Akten stammt.

## Was nicht geht

- Einen berechtigten, ordnungsgemäß gemahnten Eintrag mit „ich habe die Mahnung nicht gelesen“ kippen. Zugang ist nicht Lesen.
- Die Verantwortung für die eigene Adresse abgeben. Wer umzieht, muss Vertragspartner informieren – sonst gilt die alte Adresse oft als zugangsfähig.
- Eine Forderung nachträglich „bestreiten“, die man vorher anerkannt hat.

## Das Wichtigste in drei Sätzen

Die häufigsten negativen Einträge stammen aus Mobilfunk und Versandhandel – aus laufenden Verträgen, alten Adressen und automatisierten Mahnprozessen. Genau dort fehlen besonders oft die Meldevoraussetzungen des § 31 Abs. 2 BDSG: Bestreiten, Zugang der Mahnungen, Hinweis auf die Meldung, Fristen. Wer die Mahnungen mit Nachweis anfordert, erfährt in vielen Fällen, dass es sie so nicht gibt – und dann ist der Eintrag angreifbar.

## Quellen

- § 31 Abs. 2 BDSG; Art. 15, 17, 77 DSGVO
- Bundesnetzagentur: Jahresberichte Verbraucherservice Telekommunikation (bundesnetzagentur.de)
- Verbraucherzentrale Bundesverband: Beschwerdestatistik und Stellungnahmen zu Telekommunikation und Inkasso (vzbv.de)
- Die Wirtschaftsauskunfteien e. V.: Verhaltensregeln zu Prüf- und Löschfristen (Fassung 2024)
- Beobachtungen aus FIAON-Akten (anonymisiert, keine Statistik)`,
  },
  {
    slug: "ueberschuldung-ausloeser-krankheit-jobverlust-trennung",
    titel: "Krankheit, Jobverlust, Trennung: Die drei Auslöser, die kein Score sieht",
    untertitel: "Die Überschuldungsstatistik des Statistischen Bundesamts zeigt seit Jahren dasselbe Bild: Nicht Konsum stürzt Menschen in Schulden, sondern Lebensereignisse. Was das für die Bonität bedeutet – und warum der Eintrag oft die zweite Katastrophe ist.",
    teaser: "Destatis-Überschuldungsstatistik: Arbeitslosigkeit, Erkrankung und Trennung sind die häufigsten Auslöser – zusammen rund die Hälfte aller Fälle. Warum der Score das nicht sieht, was das für Betroffene heißt und welche Rechte helfen.",
    kategorie: "grundlagen", land: "DE", keyword: "ursachen überschuldung",
    schlagworte: ["Überschuldung Ursachen", "Destatis", "Arbeitslosigkeit", "Krankheit Schulden", "Trennung Schulden", "Schuldnerberatung"],
    metaTitel: "Überschuldung: Die drei Auslöser, die kein Score sieht",
    metaBeschreibung: "Arbeitslosigkeit, Krankheit, Trennung: Nach Destatis lösen Lebensereignisse rund die Hälfte aller Überschuldungen aus. Warum der SCHUFA-Score das nicht erkennt – und welche Rechte Betroffenen helfen.",
    faq: [
      { frage: "Was sind laut Statistik die häufigsten Gründe für Überschuldung?", antwort: "Nach der Überschuldungsstatistik des Statistischen Bundesamts (2023) sind die häufigsten Hauptauslöser Arbeitslosigkeit, Erkrankung/Sucht/Unfall sowie Trennung/Scheidung/Tod des Partners – zusammen rund die Hälfte der Fälle. Unwirtschaftliche Haushaltsführung und gescheiterte Selbstständigkeit folgen dahinter." },
      { frage: "Berücksichtigt die SCHUFA, warum jemand in Zahlungsverzug geriet?", antwort: "Nein. Der Score kennt Merkmale – Einträge, Verträge, Anfragen –, aber keine Gründe. Eine Krankheit, die zur Rücklastschrift führte, sieht im Score genauso aus wie Leichtsinn. Das ist der Kern des Problems und der Grund, warum Einträge erklärt und, wo möglich, bereinigt werden müssen." },
      { frage: "Gibt es Hilfe, wenn ein Lebensereignis zu Schulden geführt hat?", antwort: "Ja: kostenlose Schuldnerberatung (Wohlfahrtsverbände, Kommunen), das Pfändungsschutzkonto, Stundungs- und Ratenvereinbarungen mit Gläubigern, bei Krankheit Krankengeld und Härtefallregelungen. Und für die Bonität: die Prüfung jedes Eintrags auf seine Voraussetzungen." },
      { frage: "Wie lange dauert die Schuldnerberatung – und was kostet sie?", antwort: "Anerkannte Schuldnerberatungsstellen sind kostenlos; Wartezeiten von Wochen bis Monaten sind leider üblich. Die Beratung kann bis zur Verbraucherinsolvenz begleiten und stellt die dafür nötige Bescheinigung über den außergerichtlichen Einigungsversuch aus." },
      { frage: "Ist der Eintrag nach einer Krankheit anders zu bewerten?", antwort: "Rechtlich nicht – die Meldevoraussetzungen gelten unabhängig vom Grund. Praktisch schon: Viele Gläubiger stimmen bei nachgewiesener Erkrankung Stundungen oder Vergleichen zu, und manche Forderungen sind während einer schweren Erkrankung gar nicht ordnungsgemäß gemahnt worden." },
    ],
    inhalt: `Es gibt ein Bild vom überschuldeten Menschen, das in Talkshows und Kommentarspalten lebt: Flatscreen auf Raten, Urlaub auf Pump, keine Übersicht. Die Statistik kennt dieses Bild nicht. Sie kennt Menschen, die ihren Job verloren haben, die krank wurden, deren Ehe zerbrach – und die danach Rechnungen nicht mehr zahlen konnten, die vorher nie ein Problem waren.

Dieser Text zeigt, was die amtliche Überschuldungsstatistik seit Jahren belegt, warum der Bonitäts-Score diese Ursachen nicht sieht – und welche Rechte und Wege Menschen haben, die durch ein Lebensereignis in den Eintrag geraten sind.

## Was Destatis seit Jahren misst

Das Statistische Bundesamt wertet jedes Jahr die Daten der Schuldnerberatungsstellen aus. Die Statistik fragt nach dem **Hauptauslöser** der Überschuldung. Die Rangfolge ist seit Jahren stabil:

| Hauptauslöser (Destatis 2023) | Anteil, gerundet |
|---|---|
| Arbeitslosigkeit, reduzierte Arbeit | rund ein Fünftel |
| Erkrankung, Sucht, Unfall | rund ein Sechstel |
| Trennung, Scheidung, Tod des Partners | rund ein Achtel |
| Unwirtschaftliche Haushaltsführung | rund ein Zehntel |
| Gescheiterte Selbstständigkeit | rund ein Zwölftel |
| Längerfristiges Niedrigeinkommen | rund ein Zwölftel |

Die ersten drei zusammen – Jobverlust, Krankheit, Trennung – machen **rund die Hälfte** aller Fälle aus. Sie haben eines gemeinsam: Sie treffen Menschen, die vorher zurechtkamen. Das Einkommen bricht weg oder die Ausgaben verdoppeln sich (zwei Haushalte statt einem), und die laufenden Verträge laufen weiter.

*Quelle: Statistisches Bundesamt, Überschuldungsstatistik 2023. Die Anteile sind gerundet; die genauen Werte stehen in der Veröffentlichung.*

## Warum der Score nichts davon weiß

Ein Score wird aus Merkmalen berechnet: Negativeinträge, Verträge, Anfragen, Alter der Daten. Der Grund für eine Rücklastschrift ist kein Merkmal. Eine Krebserkrankung mit sechs Monaten Krankengeld und drei geplatzten Lastschriften sieht im Score genauso aus wie drei geplatzte Lastschriften aus Gleichgültigkeit. Das ist kein Fehler des Scores – er soll Zahlungsverhalten messen, nicht Schicksale bewerten –, aber es ist der Grund, warum Betroffene den Eintrag als zweite Katastrophe erleben: Die Krankheit ist überstanden, der Job wieder da, die Trennung verarbeitet – und die Bank sagt trotzdem Nein.

Die Konsequenz ist nicht, auf Mitleid zu hoffen, sondern den Eintrag dort zu prüfen, wo er geprüft werden kann: bei seinen Voraussetzungen. In Zeiten schwerer Krankheit oder nach einem Umzug in der Trennung werden Mahnungen nicht gelesen, nicht zugestellt, nicht beantwortet. Genau dort fehlen häufig die Voraussetzungen des § 31 Abs. 2 BDSG – Zugang der Mahnungen, Fristen, Hinweis auf die Meldung.

## Drei Situationen, drei Hebel

**Nach Jobverlust.** Verträge kündigen oder pausieren, bevor Lastschriften platzen; mit Gläubigern Stundung vereinbaren (schriftlich); Konto als P-Konto führen, wenn Pfändungen drohen. Für bestehende Einträge: 100-Tage-Regel nutzen, sobald wieder Einkommen da ist.

**Während und nach Krankheit.** Krankengeld und Härtefallregelungen der Krankenkasse prüfen; Gläubiger informieren – viele stunden bei Nachweis; Mahnungen, die während eines Klinikaufenthalts „zugingen“, auf Zugang und Fristen prüfen.

**Nach Trennung.** Gemeinsame Verträge und Konten trennen; für gemeinsame Schulden die Haftung klären (Gesamtschuld); Adressänderung an alle Vertragspartner, damit Mahnungen nicht beim Ex-Partner landen. Einträge, die aus Verträgen des Partners stammen, sind ein Fall für die Berichtigung.

## Schritt für Schritt: vom Ereignis zur geordneten Akte

1. **Überblick.** Alle Verträge, Forderungen, Mahnungen auf einen Tisch. Die kostenlose Datenkopie zeigt, was bereits gemeldet ist.
2. **Existenz sichern.** Miete, Energie, Krankenversicherung zuerst. Pfändungsschutzkonto einrichten, wenn Titel drohen.
3. **Gläubiger informieren.** Schriftlich, mit dem Ereignis als Grund und einem konkreten Vorschlag: Stundung bis …, Rate ab ….
4. **Einträge prüfen.** Jeden auf Mahnungen, Zugang, Fristen, Bestreiten. Angreifbare angreifen, berechtigte möglichst innerhalb von 100 Tagen nach Meldung begleichen.
5. **Hilfe holen.** Schuldnerberatung ist kostenlos; Wartezeiten überbrücken, indem Sie die Schritte 1–4 selbst beginnen.
6. **Wieder aufbauen.** Konto sauber führen, Verträge pünktlich – der Score folgt dem Verhalten, nicht der Geschichte.

## Was FIAON dabei übernimmt

FIAON beschafft die Auskunft und prüft jeden Eintrag auf seine Voraussetzungen – gerade die aus schwierigen Lebensphasen. Die Schreiben an Gläubiger (Stundung, Raten, Nachweisanforderung) und an die Auskunftei liegen bereit; FIAON versendet und verfolgt. Und FIAON sagt ehrlich, wenn ein Eintrag berechtigt ist – dann organisiert es die Erledigung so, dass die Frist möglichst kurz wird. FIAON ersetzt keine Schuldnerberatung; bei drohender Zahlungsunfähigkeit gehört diese an die erste Stelle.

## Was nicht geht

- Den Score mit dem Lebensereignis beeindrucken. Er kennt keine Gründe.
- Einträge löschen lassen, weil sie „unfair“ sind. Löschbar sind sie, wenn Voraussetzungen fehlen.
- Die Schuldnerberatung durch eine App ersetzen, wenn die Existenz bedroht ist.

## Das Wichtigste in drei Sätzen

Rund die Hälfte aller Überschuldungen beginnt nach Destatis mit Jobverlust, Krankheit oder Trennung – nicht mit Konsum. Der Score sieht keine Gründe, nur Merkmale; deshalb ist der Eintrag für Betroffene oft die zweite Katastrophe. Der Weg heraus führt über die Prüfung jedes Eintrags auf seine Voraussetzungen, über schriftliche Vereinbarungen mit Gläubigern und über kostenlose Schuldnerberatung, wenn die Existenz bedroht ist.

## Quellen

- Statistisches Bundesamt (Destatis): Überschuldungsstatistik 2023 – Hauptauslöser der Überschuldung (destatis.de)
- Creditreform: SchuldnerAtlas Deutschland 2024 (creditreform.de)
- § 31 Abs. 2 BDSG; §§ 850k ff. ZPO (Pfändungsschutzkonto); Art. 15, 17 DSGVO
- Arbeitsgemeinschaft Schuldnerberatung der Verbände (AG SBV): Hinweise zur Schuldnerberatung (agsbv.de)`,
  },
  {
    slug: "inkasso-in-zahlen-gebuehren-grenzen",
    titel: "Inkasso in Zahlen: Millionen Forderungen im Jahr – und wo die Gebühren zu hoch sind",
    untertitel: "Die deutsche Inkassobranche bearbeitet jedes Jahr Forderungen in zweistelliger Millionenzahl. Seit 2021 gelten Obergrenzen für die Kosten. Wer sie kennt, zahlt weniger – wer sie nicht kennt, zahlt, was auf dem Brief steht.",
    teaser: "Inkasso in Deutschland: Forderungen in zweistelliger Millionenzahl pro Jahr, Kostengrenzen seit der Reform 2021, typische überhöhte Posten. Mit Tabelle, Rechenbeispiel und Musterformulierung für den Widerspruch gegen Gebühren.",
    kategorie: "inkasso", land: "DE", keyword: "inkassokosten",
    schlagworte: ["Inkassokosten", "BDIU", "Inkasso Reform 2021", "RVG Gebühren", "Inkasso Gebühren prüfen", "Verbraucherschutz"],
    metaTitel: "Inkasso in Zahlen: Wo die Gebühren zu hoch sind",
    metaBeschreibung: "Inkasso in Deutschland: Forderungen in Millionenzahl, Kostengrenzen seit 2021, typische überhöhte Posten. Tabelle, Rechenbeispiel und Musterformulierung für den Widerspruch gegen Inkassokosten.",
    faq: [
      { frage: "Wie viele Forderungen bearbeiten Inkassounternehmen in Deutschland?", antwort: "Der Bundesverband Deutscher Inkasso-Unternehmen (BDIU) berichtet von jährlich mehr als 20 Millionen Forderungen, die seine Mitgliedsunternehmen bearbeiten; das Forderungsvolumen liegt nach Verbandsangaben im zweistelligen Milliardenbereich. Die Zahlen stammen aus den Branchenreports des Verbands." },
      { frage: "Was hat sich 2021 geändert?", antwort: "Mit dem Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht (in Kraft seit 1. Oktober 2021) wurden die erstattungsfähigen Inkassokosten an die Rechtsanwaltsvergütung gekoppelt und für unstreitige Forderungen sowie Kleinforderungen gedeckelt. Zudem müssen Inkassounternehmen beim ersten Schreiben über Kosten und Rechte informieren." },
      { frage: "Wie hoch dürfen Inkassokosten konkret sein?", antwort: "Bei einer unstreitigen Forderung, die nach dem ersten Schreiben beglichen wird, ist in der Regel nur eine Geschäftsgebühr von 0,5 nach RVG angemessen; bei Forderungen bis 50 Euro ist die Gebühr auf 30 Euro begrenzt. Dazu kommen Auslagen (Pauschale höchstens 20 Euro) und Verzugszinsen. Eine Gebühr von 1,3 ist nur bei umfangreicher oder schwieriger Tätigkeit zulässig." },
      { frage: "Was mache ich, wenn die Kosten zu hoch sind?", antwort: "Hauptforderung und angemessene Kosten zahlen, den überhöhten Teil schriftlich und begründet zurückweisen – mit Verweis auf § 13e RDG und das RVG. Das Inkassounternehmen muss die Berechtigung der Kosten darlegen." },
      { frage: "Wer kontrolliert Inkassounternehmen?", antwort: "Die Registrierung und Aufsicht liegt seit 2025 beim Bundesamt für Justiz (vorher bei den Landesjustizverwaltungen). Beschwerden über unseriöses Verhalten können dort und bei den Verbraucherzentralen eingereicht werden." },
    ],
    inhalt: `Ein Inkassobrief ist für die eine Seite Routine und für die andere ein Schock. Die Branche, die ihn verschickt, ist groß: Der Bundesverband Deutscher Inkasso-Unternehmen spricht von mehr als 20 Millionen Forderungen im Jahr, die allein seine Mitglieder bearbeiten, und von einem Volumen im zweistelligen Milliardenbereich. Und sie ist seit 2021 reguliert wie nie zuvor – mit Obergrenzen für das, was sie verlangen darf. Das Problem: Auf dem Brief steht die Forderung, nicht die Obergrenze.

Dieser Text nennt die Zahlen, erklärt die Kostenregeln nach der Reform und zeigt an einem Rechenbeispiel, wo die Posten überhöht sind – mit einer Formulierung, die Sie übernehmen können.

## Die Branche in Zahlen

Nach den Branchenberichten des BDIU bearbeiten die rund 500 Mitgliedsunternehmen des Verbands jährlich **mehr als 20 Millionen Forderungen** – überwiegend gegenüber Verbrauchern, überwiegend kleine Beträge. Das Gesamtvolumen der bearbeiteten Forderungen liegt nach Verbandsangaben bei **mehreren Dutzend Milliarden Euro**. Die größten Auftraggeber sind Telekommunikation, Versandhandel, Energie und Banken.

Zwei Dinge folgen daraus. Erstens: Der Inkassobrief ist ein Massenprodukt, erzeugt von Software, nicht von einem Sachbearbeiter, der Ihren Fall kennt. Zweitens: Wer widerspricht, trifft auf Prozesse, die auf Zahlung ausgelegt sind – aber auch auf Regeln, die seit 2021 klar sind.

*Quelle: Bundesverband Deutscher Inkasso-Unternehmen e. V. (BDIU), Branchenreports und Jahresberichte (bdiu.de).*

## Die Reform 2021: Was seitdem gilt

Das „Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht“ ist seit dem 1. Oktober 2021 in Kraft. Die wichtigsten Regeln:

- **Kopplung an das RVG.** Inkassounternehmen dürfen höchstens die Gebühren verlangen, die ein Rechtsanwalt nach dem Rechtsanwaltsvergütungsgesetz abrechnen könnte (§ 13e RDG).
- **Reduzierte Gebühr bei unstreitigen Forderungen.** Zahlt der Schuldner nach dem ersten Inkassoschreiben, ist in der Regel nur eine **0,5-Geschäftsgebühr** angemessen; 0,9 gilt als Regelfall bei weiterer Tätigkeit; 1,3 nur bei umfangreicher oder schwieriger Sache.
- **Deckel für Kleinforderungen.** Bei Hauptforderungen **bis 50 Euro** ist die Gebühr auf **30 Euro** begrenzt.
- **Keine doppelte Abrechnung.** Wer erst ein Inkassounternehmen und dann einen Anwalt einschaltet, darf die Gebühren nicht addieren.
- **Informationspflichten.** Das erste Schreiben muss über die Forderung, den Gläubiger, die Kosten und die Rechte des Schuldners informieren (§ 13a RDG).

*Quelle: Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht (BGBl. 2020 I S. 3320); §§ 13a, 13e RDG; RVG, Anlage 2.*

## Rechenbeispiel: 89 Euro werden 210 Euro

Eine typische Forderung: Versandhaus, 89 Euro Hauptforderung, ein Jahr alt, erstes Inkassoschreiben.

| Posten im Inkassobrief | Gefordert | Angemessen (ca.) |
|---|---|---|
| Hauptforderung | 89,00 € | 89,00 € |
| Inkassogebühr | 70,20 € | 24,50 € (0,5 Gebühr bei Gegenstandswert bis 500 €) |
| Auslagenpauschale | 20,00 € | 4,90 € (20 % der Gebühr, höchstens 20 €) |
| „Kontoführung“ / „Adressermittlung“ | 18,00 € | 0 € (ohne Nachweis nicht erstattungsfähig) |
| Verzugszinsen | 12,80 € | rund 7 € (5 Prozentpunkte über Basiszins für ein Jahr) |
| **Summe** | **210,00 €** | **rund 125 €** |

Die Differenz von rund 85 Euro entsteht nicht aus der Hauptforderung, sondern aus Gebührenposten. Sie dürfen die Hauptforderung plus angemessene Kosten zahlen und den Rest begründet zurückweisen. Die genauen Gebührenbeträge hängen vom Gegenstandswert ab – die Tabelle des RVG (Anlage 2) ist öffentlich.

## Die Formulierung für den Widerspruch gegen Kosten

„Die Hauptforderung in Höhe von … Euro sowie Inkassokosten in gesetzlich zulässiger Höhe (0,5-Geschäftsgebühr nach RVG zuzüglich Auslagenpauschale) habe ich am … überwiesen. Die darüber hinaus geforderten Kosten in Höhe von … Euro weise ich zurück; sie übersteigen die nach § 13e RDG erstattungsfähige Vergütung. Bitte legen Sie die Berechnung der Gebühren im Einzelnen dar oder bestätigen Sie die Erledigung.“

Schriftlich, mit Datum, per Einschreiben oder E-Mail mit Lesebestätigung.

## Schritt für Schritt

1. **Forderung prüfen.** Besteht sie? Stimmt der Betrag? Verjährt? (Drei Jahre ab Jahresende.)
2. **Kosten nachrechnen.** Gegenstandswert → RVG-Tabelle → 0,5 oder 0,9 Gebühr; Auslagen höchstens 20 Euro; Zinsen 5 Prozentpunkte über Basiszins.
3. **Angemessenen Betrag zahlen**, überhöhten Teil schriftlich zurückweisen (Formulierung oben).
4. **Bei Streit:** Verbraucherzentrale einschalten oder Beschwerde beim Bundesamt für Justiz, das seit 2025 die Aufsicht führt.
5. **Nach Zahlung:** Erledigungsmeldung an die Auskunfteien einfordern – falls gemeldet wurde.

## Was FIAON dabei übernimmt

FIAON prüft Inkassoschreiben auf Forderung, Verjährung, Mahnungen und Kosten, rechnet die zulässigen Gebühren nach und bereitet das Schreiben vor – Teilzahlung mit Zurückweisung der überhöhten Posten, oder Widerspruch, wenn die Forderung selbst nicht besteht. Versand per Einschreiben, Frist und Antwort in der Akte, Erledigungsvermerk nachgehalten.

## Was nicht geht

- Alle Kosten pauschal verweigern. Angemessene Inkassokosten sind Verzugsschaden und geschuldet.
- Die Hauptforderung wegen überhöhter Kosten nicht zahlen. Das setzt den Verzug fort.
- Sich auf „das steht aber im Brief“ verlassen. Der Brief ist ein Angebot zur Zahlung, kein Urteil.

## Das Wichtigste in drei Sätzen

Die Inkassobranche bearbeitet jedes Jahr Forderungen in zweistelliger Millionenzahl – automatisiert, und seit 2021 mit gesetzlichen Kostengrenzen: Gebühren höchstens wie beim Anwalt, bei unstreitigen Forderungen meist nur 0,5, bei Kleinforderungen bis 50 Euro höchstens 30 Euro. Rechnen Sie nach, zahlen Sie Hauptforderung und angemessene Kosten, und weisen Sie den Rest schriftlich zurück. Die Regeln sind öffentlich – der Brief nennt sie nur nicht.

## Quellen

- Bundesverband Deutscher Inkasso-Unternehmen e. V.: Branchenreports und Jahresberichte (bdiu.de)
- Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht, in Kraft seit 1. Oktober 2021 (BGBl. 2020 I S. 3320)
- §§ 13a, 13e Rechtsdienstleistungsgesetz (RDG); Rechtsanwaltsvergütungsgesetz (RVG) mit Anlage 2
- Bundesamt für Justiz: Aufsicht über Inkassodienstleister (bundesjustizamt.de)
- Verbraucherzentrale: Ratgeber Inkasso (verbraucherzentrale.de)`,
  },
];
