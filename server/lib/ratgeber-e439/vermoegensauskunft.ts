// ═══════════════════════════════════════════════════════════════════════════
// Privat-Ratgeber: Vermögensauskunft beim Gerichtsvollzieher — Ablauf und Folgen (27.10.2026, E-439)
//
// Recherche: .arbeit/recherche/privat.md, Prio 5. Quellen am 27.10.2026 selbst geprüft:
// §§ 788, 802a, 802b, 802c, 802d, 802e, 802f, 802g, 802i, 802j, 802k, 802l, 850k, 882c, 882d, 882e ZPO,
// §§ 156, 161 StGB, § 284 AO (gesetze-im-internet.de), Verbraucherzentrale (Stand 30.01.2025),
// SCHUFA-FAQ Speicherfristen und Hinweise zur Vermögensauskunft, Justiz NRW (Schuldnerverzeichnis).
// Haft-Höchstdauer sechs Monate jetzt im Gesetzestext belegt (§ 802j Abs. 1 ZPO), nicht nur über die VZ.
// Fachprüfung 27.10.2026: alle Quellen erneut geöffnet. Korrigiert: Zahlungsplan-Ausnahme steht in
// § 882c Abs. 1 Nr. 3 selbst (Wortlaut), nicht bei Nr. 2; § 802l nur „soweit erforderlich“;
// § 788 nur notwendige Kosten; VZ-Zitate wortgenau („eher selten“, „auswirken“, keine Wertgegenstände-Liste);
// § 284 AO mit Hinweispflicht; 18-Monats-Regel greift nicht bei Schuldnerverzeichnis (HBDI 18.12.2024).
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";

export const ARTIKEL: StartArtikel = {
  slug: "vermoegensauskunft-gerichtsvollzieher-ablauf-folgen",
  titel: "Vermögensauskunft beim Gerichtsvollzieher: Ablauf und Folgen",
  untertitel: "Ladung, Termin, Vermögensverzeichnis – und was danach im Schuldnerverzeichnis und in Ihrer SCHUFA-Auskunft steht. Mit dem Weg über einen Zahlungsplan und der Frage, wann zuerst die kostenlose Schuldnerberatung dran ist.",
  teaser: "Was im Termin beim Gerichtsvollzieher passiert, was Sie angeben müssen, welche Folgen es hat – und was ein Zahlungsplan bewirkt.",
  kategorie: "inkasso",
  land: "DE",
  keyword: "vermögensauskunft folgen",
  schlagworte: ["Vermögensauskunft", "§ 802c ZPO", "Gerichtsvollzieher", "eidesstattliche Versicherung", "Schuldnerverzeichnis", "Zahlungsplan", "SCHUFA"],
  metaTitel: "Vermögensauskunft: Ablauf, Folgen und Schuldnerverzeichnis",
  metaBeschreibung: "Vermögensauskunft beim Gerichtsvollzieher: Ablauf des Termins, Pflichtangaben, Haftbefehl, Schuldnerverzeichnis, SCHUFA – und was ein Zahlungsplan bewirkt.",
  faq: [
    {
      frage: "Was passiert, wenn ich nicht zum Termin gehe?",
      antwort: "Bleiben Sie ohne Entschuldigung weg, kann das Gericht auf Antrag des Gläubigers einen Haftbefehl erlassen, um die Abgabe zu erzwingen (§ 802g ZPO). Die Haft darf sechs Monate nicht übersteigen; sobald Sie die Vermögensauskunft abgeben, werden Sie entlassen (§§ 802i, 802j ZPO). Außerdem ordnet der Gerichtsvollzieher die Eintragung ins Schuldnerverzeichnis an (§ 882c Abs. 1 Nr. 1 ZPO) und darf, soweit es für die Vollstreckung nötig ist, Arbeitgeber, Konten und Fahrzeug bei Dritten erfragen (§ 802l ZPO). Können Sie nicht kommen, melden Sie sich vorher mit einem belegbaren Grund beim Gerichtsvollzieher.",
    },
    {
      frage: "Welche Folgen hat die Vermögensauskunft für die SCHUFA?",
      antwort: "Das Vermögensverzeichnis selbst dürfen Auskunfteien nicht abrufen (§ 802k ZPO). Entscheidend ist, ob danach ein Eintrag im Schuldnerverzeichnis folgt, etwa weil die Vollstreckung nach Ihrem Verzeichnis den Gläubiger offensichtlich nicht befriedigen würde. Diesen Eintrag übernehmen die Auskunfteien; die SCHUFA löscht ihn nach eigenen Angaben nach drei Jahren oder früher, wenn ihr die Löschung durch das zentrale Vollstreckungsgericht nachgewiesen wird.",
    },
    {
      frage: "Kann ich die Vermögensauskunft mit Raten abwenden?",
      antwort: "Aufschieben lässt sie sich. Hat der Gläubiger eine Zahlungsvereinbarung nicht ausgeschlossen, kann der Gerichtsvollzieher Raten gestatten, wenn Sie glaubhaft darlegen, dass Sie sie leisten können; die Tilgung soll in der Regel binnen zwölf Monaten abgeschlossen sein. Mit dem festgesetzten Plan ist die Vollstreckung aufgeschoben (§ 802b Abs. 2 ZPO). Widerspricht der Gläubiger unverzüglich oder geraten Sie mit einer Rate mehr als zwei Wochen in Rückstand, ist der Plan hinfällig (§ 802b Abs. 3 ZPO). Die Verbraucherzentrale schreibt, dass solche Pläne in der Praxis eher selten zustande kommen.",
    },
    {
      frage: "Wie oft muss ich die Vermögensauskunft abgeben?",
      antwort: "Nach einer Abgabe müssen Sie zwei Jahre lang keine neue Vermögensauskunft abgeben, es sei denn, ein Gläubiger macht eine wesentliche Veränderung Ihrer Vermögensverhältnisse glaubhaft (§ 802d Abs. 1 ZPO). Ein weiterer Gläubiger bekommt in dieser Zeit stattdessen einen Ausdruck Ihres letzten Vermögensverzeichnisses. Auch dann kann eine Eintragung ins Schuldnerverzeichnis folgen, wenn Sie nicht binnen eines Monats die vollständige Befriedigung dieses Gläubigers nachweisen.",
    },
    {
      frage: "Was muss ich im Vermögensverzeichnis angeben?",
      antwort: "Alles, was Ihnen gehört: Einkommen, Arbeitgeber, Konten, Fahrzeuge, Kapitallebensversicherungen, Bargeld, Wertgegenstände und Forderungen gegen andere mit Grund und Beweismitteln (§ 802c Abs. 2 ZPO). Dazu kommen entgeltliche Veräußerungen an nahestehende Personen aus den zwei Jahren vor dem Termin und unentgeltliche Leistungen aus den vier Jahren davor. Bestimmte offensichtlich unpfändbare Sachen, etwa für eine bescheidene Lebens- und Haushaltsführung, müssen Sie in der Regel nicht angeben.",
    },
    {
      frage: "Was passiert bei falschen oder unvollständigen Angaben?",
      antwort: "Sie versichern Ihre Angaben an Eides statt. Eine vorsätzlich falsche Versicherung ist nach § 156 StGB mit Freiheitsstrafe bis zu drei Jahren oder Geldstrafe bedroht, eine fahrlässig falsche nach § 161 StGB mit Freiheitsstrafe bis zu einem Jahr oder Geldstrafe. Wer eine fahrlässig falsche Angabe rechtzeitig berichtigt, bleibt nach § 161 Abs. 2 StGB straffrei. Kennen Sie einen Wert nicht genau, sagen Sie das im Termin offen.",
    },
    {
      frage: "Wer sieht meine Angaben?",
      antwort: "Der Gläubiger, der den Auftrag gegeben hat, bekommt einen Ausdruck Ihres Vermögensverzeichnisses (§ 802f Abs. 8 ZPO); weitere Gläubiger erhalten in den zwei Jahren danach ebenfalls einen Ausdruck (§ 802d Abs. 1 ZPO). Das Verzeichnis selbst liegt beim zentralen Vollstreckungsgericht Ihres Bundeslandes und wird nach zwei Jahren gelöscht. Abrufen dürfen es nur Gerichtsvollzieher, Vollstreckungsbehörden sowie bestimmte Gerichte und Strafverfolgungsbehörden für ihre Aufgaben (§ 802k ZPO) – Banken und Vermieter nicht.",
    },
  ],
  inhalt: `Ein Brief vom Gerichtsvollzieher: eine Zahlungsaufforderung, und gleich dazu eine Ladung zum Termin zur Abgabe der Vermögensauskunft, mit einem mehrseitigen Formular. Viele Menschen erschrecken bei diesem Brief – und legen ihn genau deshalb zur Seite. Genau das macht die Lage meist schwerer.

Die Vermögensauskunft ist kein Strafverfahren, sondern ein Schritt der Zwangsvollstreckung. Sie wirkt aber weit über die einzelne Forderung hinaus: auf Ihr Konto, Ihren Lohn und Ihre Bonität. Dieser Text erklärt, wann der Gerichtsvollzieher die Auskunft verlangen darf, wie der Termin abläuft, was Sie angeben müssen, was beim Nichterscheinen passiert – und was ein Zahlungsplan bewirkt. Wenn mehrere Forderungen offen sind und das Geld nicht für alle reicht, ist die kostenlose, staatlich anerkannte Schuldnerberatung der erste Weg. Dazu unten mehr.

## Was die Vermögensauskunft ist

Ein Gläubiger kann nicht einfach pfänden lassen, weil eine Rechnung offen ist. Er braucht zuerst einen Titel, meist einen Vollstreckungsbescheid oder ein Urteil. Mit diesem Titel beauftragt er den Gerichtsvollzieher. Was der dann tun darf, zählt § 802a Abs. 2 ZPO auf: eine gütliche Erledigung versuchen, die Vermögensauskunft des Schuldners einholen, Auskünfte Dritter über das Vermögen einholen, Sachen pfänden und eine Vorpfändung durchführen.

Die Vermögensauskunft selbst regelt § 802c ZPO. Auf Verlangen des Gerichtsvollziehers müssen Sie Auskunft über Ihr Vermögen geben und Geburtsnamen, Geburtsdatum und Geburtsort nennen. Am Ende versichern Sie an Eides statt, dass Ihre Angaben richtig und vollständig sind (§ 802c Abs. 3 ZPO). Früher hieß das Verfahren „eidesstattliche Versicherung“ oder umgangssprachlich „Offenbarungseid“, so erklärt es die Verbraucherzentrale.

Für den Gläubiger ist die Auskunft eine Landkarte: Er erfährt, ob und wo er pfänden kann – beim Arbeitgeber, auf dem Konto, beim Auto. Auch Behörden können eine Vermögensauskunft verlangen, etwa das Finanzamt, wenn Sie nach einer Zahlungsaufforderung mit Hinweis auf die Auskunftspflicht nicht binnen zwei Wochen zahlen (§ 284 Abs. 1 AO).

## Ladung und Frist: wie es zum Termin kommt

Der Gerichtsvollzieher darf die Vermögensauskunft nicht sofort abnehmen. § 802f Abs. 1 ZPO verlangt drei Dinge: Er hat Sie vorher zur Zahlung aufgefordert, seitdem sind mindestens zwei Wochen vergangen, und die Forderung ist nicht vollständig beglichen. Die Ladung zum Termin darf er schon zusammen mit der Zahlungsaufforderung schicken. Deshalb kommt beides oft in einem Brief.

Der Termin findet alsbald nach Ablauf der zwei Wochen statt. Den Ort bestimmt der Gerichtsvollzieher (§ 802f Abs. 2 ZPO): seine Geschäftsräume, Ihre Wohnung, einen anderen geeigneten Ort oder eine Bild- und Tonübertragung. Legt er den Termin in Ihre Wohnung, an einen anderen Ort oder in eine Übertragung per Bild und Ton, können Sie dem innerhalb einer Woche widersprechen (§ 802f Abs. 4 ZPO). Eine solche Übertragung darf nicht aufgezeichnet werden (§ 802f Abs. 3 ZPO).

Zuständig ist der Gerichtsvollzieher bei dem Amtsgericht, in dessen Bezirk Sie bei Erteilung des Auftrags wohnen (§ 802e ZPO). Die für die Auskunft nötigen Unterlagen müssen Sie zum Termin mitbringen (§ 802f Abs. 4 ZPO). Mit der Ladung muss er Sie belehren – unter anderem über diese Pflicht, über die Folgen einer pflichtwidrigen Nichtabgabe, darüber, dass Auskünfte bei Dritten eingeholt werden können, und dass eine Eintragung ins Schuldnerverzeichnis möglich ist (§ 802f Abs. 5 ZPO). Lesen Sie diese Belehrung ganz. Sie ist die Gebrauchsanweisung für Ihren Fall.

Können Sie den Termin nicht wahrnehmen, melden Sie sich sofort beim Gerichtsvollzieher – die Verbraucherzentrale nennt Telefon, Fax oder E-Mail – und nennen Sie einen triftigen, möglichst belegbaren Grund. Ein Termin, der ohne Nachricht verstreicht, kann zum Haftbefehl führen.

## Was im Vermögensverzeichnis steht

Mit dem Schreiben des Gerichtsvollziehers erhalten Sie nach der Verbraucherzentrale ein mehrseitiges Formular, das Vermögensverzeichnis. Was hineingehört, sagt § 802c Abs. 2 ZPO: alle Ihnen gehörenden Vermögensgegenstände, bei Forderungen gegen andere zusätzlich deren Grund und die Beweismittel. Die Verbraucherzentrale nennt die Bereiche, nach denen das Formular fragt:

- Einkommen und Unterhaltsansprüche,
- Arbeitgeber,
- Konten,
- Pkw,
- Bargeld,
- Kapitallebensversicherungen,
- Aktien und vieles mehr.

Gefragt wird auch nach dem Einkommen von Ehepartnern und Kindern. Das heißt nicht, dass diese für Ihre Schulden haften. Es geht nach der Verbraucherzentrale darum, ob Unterhaltsansprüche gegen Sie bestehen – und das kann sich auf Ihre Pfändungsfreigrenze auswirken. Was Ihnen bei einer Pfändung bleibt, zeigt der [Pfändungsrechner](/werkzeuge/pfaendungsrechner).

Zwei Punkte werden oft übersehen. Erstens gehören bestimmte frühere Geschäfte ins Verzeichnis: entgeltliche Veräußerungen an nahestehende Personen aus den zwei Jahren vor dem Termin und unentgeltliche Leistungen aus den vier Jahren davor, jeweils bis zur Abgabe; gebräuchliche Gelegenheitsgeschenke geringen Wertes sind ausgenommen (§ 802c Abs. 2 ZPO). Zweitens müssen Sie bestimmte Sachen, die offensichtlich unpfändbar sind, nicht aufführen – etwa was Sie für eine bescheidene Lebens- und Haushaltsführung benötigen (§ 811 Abs. 1 Nr. 1 Buchst. a ZPO) –, es sei denn, eine Austauschpfändung kommt in Betracht.

## Der Termin und die eidesstattliche Versicherung

Im Termin geht der Gerichtsvollzieher Ihre Angaben mit Ihnen durch und erstellt daraus ein elektronisches Vermögensverzeichnis. Bevor Sie die Richtigkeit versichern, liest er Ihnen die Angaben vor oder zeigt sie Ihnen am Bildschirm; auf Verlangen bekommen Sie einen Ausdruck (§ 802f Abs. 7 ZPO). Nutzen Sie diesen Moment. Was jetzt fehlt oder falsch ist, lässt sich noch richtigstellen.

Dann versichern Sie zu Protokoll an Eides statt, dass Ihre Angaben richtig und vollständig sind. Das ist ernst gemeint: Eine vorsätzlich falsche Versicherung an Eides statt ist nach § 156 StGB mit Freiheitsstrafe bis zu drei Jahren oder Geldstrafe bedroht. Auch eine fahrlässig falsche Angabe ist strafbar, mit Freiheitsstrafe bis zu einem Jahr oder Geldstrafe (§ 161 StGB); wer sie rechtzeitig berichtigt, bleibt straffrei. Versichert wird nach bestem Wissen und Gewissen (§ 802c Abs. 3 ZPO): Kennen Sie einen Wert nicht genau, sagen Sie das offen und kennzeichnen Sie eine Schätzung als Schätzung.

Das fertige Verzeichnis hinterlegt der Gerichtsvollzieher beim zentralen Vollstreckungsgericht; der Gläubiger bekommt unverzüglich einen Ausdruck (§ 802f Abs. 8 ZPO). Gelöscht wird das Verzeichnis nach zwei Jahren seit der Abgabe oder wenn ein neues eingeht (§ 802k Abs. 1 ZPO). Abrufen dürfen es Gerichtsvollzieher, Vollstreckungsbehörden sowie bestimmte Gerichte und Strafverfolgungsbehörden für ihre Aufgaben (§ 802k Abs. 2 ZPO) – Banken und Vermieter gehören nicht dazu.

## Wenn Sie nicht erscheinen: Haftbefehl und Haft

Bleiben Sie dem Termin ohne Entschuldigung fern oder verweigern Sie die Auskunft ohne Grund, erlässt das Gericht auf Antrag des Gläubigers einen Haftbefehl, um die Abgabe zu erzwingen (§ 802g Abs. 1 ZPO). Die Verhaftung nimmt ein Gerichtsvollzieher vor (§ 802g Abs. 2 ZPO). Nach der Verbraucherzentrale wird der Haftbefehl nicht zur Fahndung ausgeschrieben, er ermöglicht aber die Vorführung durch die Polizei.

Die Haft hat einen einzigen Zweck: die Auskunft. Sie können jederzeit verlangen, die Vermögensauskunft beim Gerichtsvollzieher am Haftort abzugeben, und werden danach entlassen (§ 802i ZPO). Die Haft darf sechs Monate nicht übersteigen (§ 802j Abs. 1 ZPO).

Zwei weitere Folgen kommen unabhängig vom Haftbefehl hinzu. Wer seiner Pflicht zur Vermögensauskunft nicht nachkommt, wird auf Anordnung des Gerichtsvollziehers ins Schuldnerverzeichnis eingetragen (§ 882c Abs. 1 Nr. 1 ZPO). Und der Gerichtsvollzieher darf dann, soweit es für die Vollstreckung nötig ist, selbst nachforschen (§ 802l Abs. 1 ZPO): bei der Rentenversicherung den aktuellen Arbeitgeber, über das Bundeszentralamt für Steuern die Banken, bei denen Sie Konten führen, beim Kraftfahrt-Bundesamt die Daten eines Fahrzeugs, dessen Halter Sie sind. Wegbleiben verhindert also nicht, dass der Gläubiger erfährt, wo er pfänden kann. Es macht den Weg nur länger – und die notwendigen Kosten der Zwangsvollstreckung trägt nach § 788 Abs. 1 ZPO der Schuldner.

## Die Folgen der Vermögensauskunft

Auch wer den Termin wahrnimmt und alles richtig angibt, muss mit Folgen rechnen. Ist nach Ihrem Verzeichnis keine vollständige Befriedigung des Gläubigers zu erwarten, darf der Gerichtsvollzieher ebenfalls Auskünfte bei Dritten einholen (§ 802l Abs. 1 ZPO). Der Überblick:

| Folge | Was passiert | Grundlage |
|---|---|---|
| Pfändung | Der Gläubiger kennt Arbeitgeber und Konten und kann Lohn oder Konto pfänden lassen. | § 802f Abs. 8 ZPO, Verbraucherzentrale |
| Schuldnerverzeichnis | Eintrag, wenn die Vollstreckung offensichtlich nicht zur vollständigen Befriedigung führt oder Sie nicht binnen eines Monats die vollständige Befriedigung nachweisen | § 882c Abs. 1 ZPO |
| Dauer des Eintrags | drei Jahre ab dem Tag der Eintragungsanordnung, vorher nur in den Fällen des Gesetzes | § 882e ZPO |
| Auskunfteien | übernehmen den Eintrag; die SCHUFA löscht nach drei Jahren oder früher mit Nachweis der Löschung | SCHUFA-Angaben |
| Sperrfrist | zwei Jahre keine neue Vermögensauskunft, außer bei wesentlicher Veränderung | § 802d Abs. 1 ZPO |

**Der Eintrag im Schuldnerverzeichnis.** Ihn ordnet der Gerichtsvollzieher von Amts wegen an, wenn einer von drei Gründen vorliegt (§ 882c Abs. 1 ZPO): Sie haben die Vermögensauskunft nicht abgegeben, die Vollstreckung nach Ihrem Verzeichnis würde den Gläubiger offensichtlich nicht vollständig befriedigen, oder Sie weisen nicht binnen eines Monats nach der Abgabe die vollständige Befriedigung nach. Gegen die Eintragungsanordnung können Sie binnen zwei Wochen ab Bekanntgabe Widerspruch beim zuständigen Vollstreckungsgericht einlegen. Der Widerspruch allein hält die Eintragung nicht auf; das Vollstreckungsgericht kann sie auf Antrag einstweilen aussetzen (§ 882d ZPO). Die Verbraucherzentrale rät, sich eine Kopie der Eintragungsanordnung geben zu lassen – sie wird später für die Löschung gebraucht. Der Eintrag wird drei Jahre nach dem Tag der Anordnung gelöscht, früher etwa dann, wenn Sie die vollständige Befriedigung des Gläubigers nachweisen (§ 882e ZPO).

**Die SCHUFA.** Die SCHUFA speichert nach eigenen Angaben nur die Tatsache der Eintragung aus den Schuldnerverzeichnissen der zentralen Vollstreckungsgerichte und übernimmt spätere Änderungen. Gelöscht wird nach drei Jahren, vorzeitig, wenn ihr die Löschung durch das zentrale Vollstreckungsgericht nachgewiesen wird. Ist der Gläubiger selbst Partner der SCHUFA, etwa eine Bank oder ein Telefonanbieter, steht nach der Verbraucherzentrale oft schon vorher sein eigener Eintrag in der Auskunft. Der folgt seiner eigenen Frist: Erledigte Forderungen löscht die SCHUFA nach eigenen Angaben taggenau drei Jahre nach der Erledigung. Die kürzere Frist von 18 Monaten für Forderungen, die binnen 100 Tagen nach der Meldung ausgeglichen werden, greift nach Angaben des Hessischen Beauftragten für Datenschutz und Informationsfreiheit nicht, wenn Informationen aus dem Schuldnerverzeichnis vorliegen. Das Datum für Ihren Fall rechnet das Werkzeug [Löschfrist](/werkzeuge/loeschfrist) aus; den Weg zur Löschung beschreibt [SCHUFA-Eintrag löschen](/schufa-eintrag-loeschen).

**Zwei Jahre Ruhe – mit einer Lücke.** Nach § 802d Abs. 1 ZPO müssen Sie zwei Jahre lang keine neue Vermögensauskunft abgeben, solange kein Gläubiger eine wesentliche Veränderung Ihrer Vermögensverhältnisse glaubhaft macht. Ein weiterer Gläubiger bekommt stattdessen einen Ausdruck Ihres letzten Verzeichnisses, und Sie werden darüber informiert. Wichtig: Die Sperrfrist schützt vor einem neuen Termin, nicht vor einem neuen Eintrag. Weisen Sie diesem Gläubiger nicht binnen eines Monats nach der Bekanntgabe die vollständige Befriedigung nach, kann auch dafür eine Eintragung folgen (§ 882c Abs. 1 Nr. 3 ZPO).

## Zahlungsplan: wie Raten die Vollstreckung aufschieben

Der Gerichtsvollzieher soll in jeder Lage des Verfahrens auf eine gütliche Erledigung bedacht sein (§ 802b Abs. 1 ZPO). Hat der Gläubiger eine Zahlungsvereinbarung nicht ausgeschlossen, kann er Ihnen eine Zahlungsfrist einräumen oder Raten gestatten, wenn Sie glaubhaft darlegen, dass Sie die Zahlungen leisten können. Die Tilgung soll in der Regel binnen zwölf Monaten abgeschlossen sein. Mit dem festgesetzten Plan ist die Vollstreckung aufgeschoben (§ 802b Abs. 2 ZPO).

Der Plan hat zwei Bruchstellen (§ 802b Abs. 3 ZPO). Widerspricht der Gläubiger unverzüglich, wird er mit Ihrer Unterrichtung hinfällig. Und er wird hinfällig, wenn Sie mit einer festgesetzten Zahlung ganz oder teilweise länger als zwei Wochen in Rückstand geraten. Die Verbraucherzentrale schreibt, dass ein solcher Plan in der Praxis eher selten zustande kommt.

Gelingt er, ist der Nutzen groß: Solange ein Zahlungsplan festgesetzt und nicht hinfällig ist, gilt die Monatsfrist für den Nachweis der Befriedigung nicht, und eine Eintragung aus diesem Grund unterbleibt (§ 882c Abs. 1 Nr. 3 ZPO). Diese Ausnahme steht im Gesetz nur bei der Monatsfrist (Nr. 3), nicht für den Fall, dass die Vollstreckung nach Ihrem Verzeichnis offensichtlich nicht zur vollständigen Befriedigung führt (Nr. 2). Entscheidend ist eine Rate, die Sie wirklich halten können. Eine zu hohe Rate scheitert am ersten knappen Monat. Ihren Spielraum zeigt der [Spielraum-Rechner](/werkzeuge/spielraum), eine tragfähige Rate und das Angebotsschreiben der [Ratenplan-Rechner](/werkzeuge/ratenplan).

Wie sich der Termin ganz vermeiden lässt, steht in § 802f Abs. 1 ZPO selbst: Ist die Forderung vollständig beglichen, darf die Vermögensauskunft nicht abgenommen werden. Wer innerhalb der zwei Wochen zahlen kann, sollte dem Gerichtsvollzieher den Zahlungsnachweis schicken.

## Schritt für Schritt: von der Ladung bis nach dem Termin

1. **Brief lesen und Daten notieren.** Datum der Zahlungsaufforderung, Termin, Ort, Aktenzeichen des Gerichtsvollziehers, Gläubiger und Betrag. Prüfen Sie, aus welchem Titel vollstreckt wird – etwa ein Vollstreckungsbescheid nach einem [Mahnbescheid](/ratgeber/mahnbescheid-erhalten-zwei-wochen-widerspruch).
2. **Lage ehrlich einschätzen.** Sind mehrere Forderungen offen, läuft schon eine Pfändung oder sind Miete und Strom in Gefahr, melden Sie sich sofort bei einer Schuldnerberatungsstelle. Eine erste Einordnung gibt der [Schulden-Check](/werkzeuge/schulden-check).
3. **Vollständige Zahlung prüfen.** Reicht das Geld für die ganze Forderung samt Kosten, zahlen Sie innerhalb der zwei Wochen und schicken dem Gerichtsvollzieher den Nachweis.
4. **Ratenangebot vorbereiten.** Schreiben Sie Einnahmen und feste Ausgaben auf und rechnen Sie eine Rate aus, mit der die Forderung in der Regel binnen zwölf Monaten getilgt ist und die Sie durchhalten. Legen Sie Belege dazu, damit Sie die Rate im Termin glaubhaft darlegen können.
5. **Ort prüfen.** Hat der Gerichtsvollzieher Ihre Wohnung, einen anderen Ort oder eine Übertragung per Bild und Ton bestimmt und wollen Sie das nicht, widersprechen Sie innerhalb einer Woche.
6. **Formular ausfüllen und Unterlagen sammeln.** Zum Beispiel Lohn- oder Rentenabrechnungen, Leistungsbescheide, eine Übersicht Ihrer Konten, Fahrzeugpapiere, Versicherungsscheine und Belege über Forderungen gegen andere. Fragen zum Formular können Sie dem Gerichtsvollzieher stellen.
7. **Konto schützen.** Verlangen Sie bei Ihrer Bank, dass Ihr Girokonto als Pfändungsschutzkonto geführt wird. Das können Sie jederzeit verlangen (§ 850k Abs. 1 ZPO). Was dann geschützt ist, erklärt der Ratgeber zur [Pfändungsfreigrenze und zum P-Konto](/ratgeber/pfaendungsfreigrenze-2026-p-konto-was-bleibt).
8. **Termin wahrnehmen.** Lassen Sie sich die Angaben vorlesen oder zeigen, korrigieren Sie Fehler, verlangen Sie einen Ausdruck und tragen Sie Ihr Ratenangebot vor.
9. **Fristen nach dem Termin notieren.** Die Monatsfrist für den Nachweis der Befriedigung, die zwei Wochen für einen Widerspruch gegen eine Eintragungsanordnung und – bei einem Zahlungsplan – jede einzelne Rate.
10. **Auskünfte prüfen.** Fordern Sie Ihre Datenkopie bei der SCHUFA nach Art. 15 DSGVO an und sehen Sie nach, ob ein Merkmal aus dem Schuldnerverzeichnis eingetragen ist. Wo das bei den anderen [Auskunfteien](/auskunfteien) geht, zeigt das Werkzeug [Selbstauskunft](/werkzeuge/selbstauskunft).

## Wenn die Lage ernst ist: zuerst die Schuldnerberatung

Vor einer Vermögensauskunft steht immer ein Titel, etwa aus einem Mahn- oder Gerichtsverfahren. Wenn Sie nicht alle Forderungen bezahlen können, eine Pfändung läuft oder droht oder Miete und Strom in Gefahr sind, ist der erste Weg die kostenlose, staatlich anerkannte Schuldnerberatung – etwa bei Verbraucherzentralen, Wohlfahrtsverbänden oder Ihrer Kommune. Die Verbraucherzentrale rät, sich dort Rat und Unterstützung zu holen, soweit das zeitnah möglich ist; Verständnisfragen zum Formular können Sie sonst dem Gerichtsvollzieher stellen.

Dort wird mit Ihnen geklärt, welche Forderungen zuerst dran sind, ob ein Vergleich mit den Gläubigern in Frage kommt und ob eine Verbraucherinsolvenz der bessere Weg ist. Wartezeiten lassen sich nutzen: Unterlagen ordnen, Einnahmen und Ausgaben aufschreiben, Fristen notieren. Dabei helfen der [Pfändungsrechner](/werkzeuge/pfaendungsrechner) und der [Schuldenplan](/werkzeuge/schuldenplan). FIAON ersetzt diese Stelle nicht.

## Was FIAON übernimmt

FIAON ist eine Abo-Plattform für Ihre Bonität – keine Bank, keine Kanzlei, keine Schuldnerberatung. Rund um die Vermögensauskunft heißt das:

- **Vor dem Termin: eine Rate, die hält.** Die [Bonitätsauswertung](/bonitaetsauskunft) aus Ihren Kontoauszügen zeigt, was eine Bank aus Ihren Konten liest, und Ihren monatlichen Spielraum. Daraus bereitet FIAON ein Ratenangebot mit Haushaltsübersicht vor, das Sie dem Gerichtsvollzieher vorlegen oder dem Gläubiger schicken können. Ob der Gläubiger mitgeht und ob ein Zahlungsplan festgesetzt wird, entscheiden die beiden.
- **Unterlagen ordnen.** Sie bekommen eine Liste der Unterlagen für das Vermögensverzeichnis und legen sie in Ihrer Akte ab. Das Formular selbst füllen Sie aus; rechtlich bewertet FIAON Ihre Angaben nicht.
- **Nach dem Termin: Einträge erklären.** Sie fordern Ihre Datenkopie selbst an. FIAON erklärt jede Zeile, auch ein Merkmal aus dem Schuldnerverzeichnis, und zeigt, ob daneben ein eigener Eintrag des Gläubigers steht.
- **Schreiben vorbereiten, versenden, Fristen halten.** Die Bitte an den Gläubiger um die aktuelle Gesamtforderung und um die Bestätigung der vollständigen Befriedigung, der Antrag auf vorzeitige Löschung beim zentralen Vollstreckungsgericht und das Schreiben an die Auskunftei liegen als Vorlagen bereit. Sie prüfen und geben frei, FIAON versendet nachweisbar und erinnert an die Fristen aus dem Verfahren.

Was das kostet und welche Pakete es gibt, steht unter [Preise](/preise); den Überblick für Privatkunden finden Sie unter [Privatkunden](/privatkunden).

## Was nicht geht

- Den Termin ohne triftigen Grund absagen oder die Auskunft verweigern, ohne Haftbefehl und Eintrag in Kauf zu nehmen.
- Einen Zahlungsplan erzwingen. Der Gläubiger kann ihn ausschließen oder ihm widersprechen; festsetzen kann ihn nur der Gerichtsvollzieher.
- Vermögen weglassen oder kurz vorher verschieben. Die Angaben müssen vollständig sein, und Geschäfte mit nahestehenden Personen aus den zwei Jahren vor dem Termin gehören ins Verzeichnis.
- Einen berechtigten Eintrag im Schuldnerverzeichnis vor Ablauf der drei Jahre entfernen, ohne dass der Gläubiger vollständig befriedigt ist, der Grund wegfällt oder eine gerichtliche Entscheidung vorliegt. Niemand kann Ihnen das Ergebnis zusagen.
- Im Einzelfall rechtlich prüfen, ob der Titel, die Forderung oder ein Widerspruch Bestand hat. Das ist Rechtsdienstleistung und gehört zu einer Anwältin, einem Anwalt oder der Schuldnerberatung.
- Einen Kredit beschaffen, um die Forderung abzulösen. FIAON vergibt und vermittelt keine Kredite.

## Das Wichtigste in Kürze

Die Vermögensauskunft verlangt der Gerichtsvollzieher frühestens zwei Wochen nach einer Zahlungsaufforderung; wer nicht kommt, riskiert einen Haftbefehl und einen Eintrag im Schuldnerverzeichnis. Im Termin versichern Sie Ihre vollständigen Angaben an Eides statt, der Gläubiger erfährt Arbeitgeber und Konten, und ein Eintrag im Schuldnerverzeichnis bleibt drei Jahre – auch bei der SCHUFA. Ein Zahlungsplan nach § 802b ZPO schiebt die Vollstreckung auf und schützt, solange er hält, vor einer Eintragung wegen der Monatsfrist; bei mehreren Forderungen ist zuerst die kostenlose Schuldnerberatung der richtige Weg.

## Quellen

- [§ 802a ZPO – Grundsätze der Vollstreckung, Regelbefugnisse des Gerichtsvollziehers](https://www.gesetze-im-internet.de/zpo/__802a.html)
- [§ 802b ZPO – Gütliche Erledigung, Zahlungsplan](https://www.gesetze-im-internet.de/zpo/__802b.html)
- [§ 802c ZPO – Vermögensauskunft des Schuldners](https://www.gesetze-im-internet.de/zpo/__802c.html)
- [§ 802d ZPO – Weitere Vermögensauskunft (Sperrfrist)](https://www.gesetze-im-internet.de/zpo/__802d.html)
- [§ 802e ZPO – Zuständigkeit](https://www.gesetze-im-internet.de/zpo/__802e.html)
- [§ 802f ZPO – Verfahren zur Abnahme der Vermögensauskunft](https://www.gesetze-im-internet.de/zpo/__802f.html)
- [§ 802g ZPO – Erzwingungshaft](https://www.gesetze-im-internet.de/zpo/__802g.html)
- [§ 802i ZPO – Vermögensauskunft des verhafteten Schuldners](https://www.gesetze-im-internet.de/zpo/__802i.html)
- [§ 802j ZPO – Dauer der Haft](https://www.gesetze-im-internet.de/zpo/__802j.html)
- [§ 802k ZPO – Zentrale Verwaltung der Vermögensverzeichnisse](https://www.gesetze-im-internet.de/zpo/__802k.html)
- [§ 802l ZPO – Auskunftsrechte des Gerichtsvollziehers](https://www.gesetze-im-internet.de/zpo/__802l.html)
- [§ 788 ZPO – Kosten der Zwangsvollstreckung](https://www.gesetze-im-internet.de/zpo/__788.html)
- [§ 811 ZPO – Unpfändbare Sachen](https://www.gesetze-im-internet.de/zpo/__811.html)
- [§ 850k ZPO – Pfändungsschutzkonto](https://www.gesetze-im-internet.de/zpo/__850k.html)
- [§ 882c ZPO – Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882c.html)
- [§ 882d ZPO – Widerspruch gegen die Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882d.html)
- [§ 882e ZPO – Löschung](https://www.gesetze-im-internet.de/zpo/__882e.html)
- [§ 156 StGB – Falsche Versicherung an Eides statt](https://www.gesetze-im-internet.de/stgb/__156.html)
- [§ 161 StGB – Fahrlässige falsche Versicherung an Eides statt](https://www.gesetze-im-internet.de/stgb/__161.html)
- [§ 284 AO – Vermögensauskunft des Vollstreckungsschuldners (Behörden)](https://www.gesetze-im-internet.de/ao_1977/__284.html)
- [Art. 15 DSGVO – Auskunftsrecht (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [Verbraucherzentrale: Vermögensauskunft – das gilt es zu beachten (Stand 30.01.2025)](https://www.verbraucherzentrale.de/wissen/geld-versicherungen/kredit-schulden-insolvenz/vermoegensauskunft-das-gilt-es-zu-beachten-32431)
- [SCHUFA: Wie lange speichert die SCHUFA personenbezogene Daten?](https://www.schufa.de/faq/privatpersonen/daten/wie-lange-speichert-die-schufa-personenbezogene-daten.jsp)
- [SCHUFA: Hinweise zur Vermögensauskunft und zum Schuldnerverzeichnis in der Auskunft](https://www.schufa.de/en/faq/private-individuals/information/why-does-my-information-say-not-complied-with-statement-of-assets-or-satisfaction-of-creditors-excluded.jsp)
- [Justiz NRW: Schuldnerverzeichnis](https://www.justiz.nrw/BS/recht_a_z/S/Schuldnerverzeichnis)
- [Hessischer Beauftragter für Datenschutz und Informationsfreiheit: Schufa speichert ausgeglichene Forderungen nur noch 18 Monate (18.12.2024)](https://datenschutz.hessen.de/presse/engagement-des-hbdi-zahlt-sich-aus-schufa-speichert-ausgeglichene-forderungen-nur-noch-18-monate)`,
};
