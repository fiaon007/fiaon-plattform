// ═══════════════════════════════════════════════════════════════════════════
// Privat-Ratgeber: Rundfunkbeitrag, Finanzamt, Stadtkasse — öffentliche Schulden und SCHUFA (27.10.2026, E-439)
//
// Recherche: .arbeit/recherche/privat.md, Prio 4. Quellen am 27.10.2026 selbst geprüft:
// §§ 30, 222, 234, 238, 240, 249, 254, 258, 284, 309, 361 AO, § 5 VwVG, § 80 VwGO, §§ 802b, 882b, 882c, 882e ZPO
// (gesetze-im-internet.de), RBStV §§ 4, 7, 10 (BRAVORS Brandenburg), rundfunkbeitrag.de (Zahlung, Widerspruch,
// Sozialleistungen, Beitragsservice), Jahresbericht 2025 des Beitragsservice (S. 8, 18–20, 23),
// SCHUFA-Datenschutzinformation nach Art. 14 DSGVO (Stand Dezember 2023), SCHUFA-FAQ Speicherfristen,
// BGH I ZB 64/14 (Volltext rewis.io), VG München M 26a S 25.8971 (gesetze-bayern.de), Service Berlin 327028.
// Fachprüfung 27.10.2026: alle Quellen erneut geöffnet; ergänzt § 882d ZPO und SCHUFA-Datenkopie (meineschufa.de);
// Aussagen ohne Primärbeleg umformuliert (Pfändung als Merkmal, Steuerkonto, Stadtkasse, Härtefall § 4 Abs. 6 RBStV).
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "../fiaon-ratgeber-start";

export const ARTIKEL: StartArtikel = {
  slug: "rundfunkbeitrag-finanzamt-schulden-schufa-eintrag",
  titel: "Rundfunkbeitrag, Finanzamt, Stadtkasse: Wann öffentliche Schulden in der SCHUFA landen",
  untertitel: "Beitragsservice, Finanzamt und Stadtkasse melden nicht wie eine Bank an die SCHUFA. Trotzdem kann aus einem offenen Bescheid ein Eintrag werden – über Vollstreckung und Schuldnerverzeichnis. Wo dieser Weg beginnt, an welchen Stellen Sie ihn verlassen können und was nach einem Eintrag möglich ist.",
  teaser: "Behörden melden nicht wie Banken. In die SCHUFA führt der Weg über Vollstreckung und Schuldnerverzeichnis – mit mehreren Stellen, an denen Sie handeln können.",
  kategorie: "eintraege",
  land: "DE",
  keyword: "Rundfunkbeitrag SCHUFA Eintrag",
  schlagworte: ["Rundfunkbeitrag", "Beitragsservice", "Festsetzungsbescheid", "Finanzamt", "§ 284 AO", "Vollstreckungsersuchen", "Schuldnerverzeichnis", "SCHUFA"],
  metaTitel: "Rundfunkbeitrag und SCHUFA: Wann Behördenschulden zählen",
  metaBeschreibung: "Meldet der Beitragsservice an die SCHUFA? Meist nicht direkt. Der Weg führt über Vollstreckung und Schuldnerverzeichnis – so handeln Sie rechtzeitig.",
  faq: [
    {
      frage: "Meldet der Beitragsservice (früher GEZ) Rückstände an die SCHUFA?",
      antwort: "Nach allem, was SCHUFA und Beitragsservice selbst veröffentlichen, nicht wie eine Bank. Die SCHUFA nennt als Quellen ihre Partner – Banken, Handel, Energieversorger, Telekommunikation, Versicherungen, Inkassobereich – und öffentliche Verzeichnisse wie das Schuldnerverzeichnis. Der Beitragsservice beschreibt für Rückstände einen eigenen Weg: Festsetzungsbescheid, Mahnung, Vollstreckungsersuchen. In der SCHUFA erscheint ein Rückstand typischerweise erst, wenn daraus ein Eintrag im Schuldnerverzeichnis wird. Ob ein später beauftragtes Inkassounternehmen meldet, zeigt nur Ihre eigene Datenkopie.",
    },
    {
      frage: "Wann droht der Eintrag in das Schuldnerverzeichnis?",
      antwort: "Bei Behörden in drei Fällen (§ 284 Abs. 9 AO): wenn Sie die verlangte Vermögensauskunft nicht abgeben, wenn eine Vollstreckung nach Ihrer Auskunft offensichtlich nicht zur vollen Zahlung führen würde oder wenn Sie die Forderung nicht binnen eines Monats nach Abgabe der Auskunft vollständig begleichen. Die Anordnung einer Behörde geht einen Monat nach Zustellung an das zentrale Vollstreckungsgericht (§ 284 Abs. 10 AO). Vollstreckt ein Gerichtsvollzieher, gelten die gleichartigen Gründe des § 882c ZPO; gegen seine Anordnung ist binnen zwei Wochen Widerspruch möglich, danach übermittelt er sie (§ 882d Abs. 1 ZPO).",
    },
    {
      frage: "Kann ich den Rundfunkbeitrag in Raten zahlen?",
      antwort: "Ja, der Beitragsservice bietet eine Ratenzahlung an – wenn die monatliche Rate in einem angemessenen Verhältnis zum Rückstand steht, keine frühere Ratenvereinbarung geplatzt ist und noch keine Vollstreckung durch Vollstreckungsbehörde oder Gerichtsvollzieher läuft. Zinsen fallen nach Angaben des Beitragsservice nicht an, der laufende Beitrag kommt alle drei Monate hinzu. Läuft die Vollstreckung schon, klären Sie Raten mit der Vollstreckungsbehörde oder dem Gerichtsvollzieher.",
    },
    {
      frage: "Stoppt ein Widerspruch gegen den Festsetzungsbescheid die Vollstreckung?",
      antwort: "In der Regel nicht. Der Widerspruch ist binnen eines Monats nach Bekanntgabe möglich, schriftlich oder zur Niederschrift – eine einfache E-Mail oder ein Anruf reichen nicht. Verwaltungsgerichte wie das VG München ordnen die Festsetzung von Rundfunkbeiträgen als Anforderung öffentlicher Abgaben ein; dafür entfällt die aufschiebende Wirkung (§ 80 Abs. 2 Satz 1 Nr. 1 VwGO). Wer Aufschub will, beantragt zuerst bei der Behörde die Aussetzung der Vollziehung (§ 80 Abs. 6 VwGO).",
    },
    {
      frage: "Wer kann sich vom Rundfunkbeitrag befreien lassen?",
      antwort: "Auf Antrag unter anderem Menschen, die Grundsicherungsgeld (früher Bürgergeld), Hilfe zum Lebensunterhalt, Grundsicherung im Alter, Leistungen nach dem Asylbewerberleistungsgesetz oder – wenn sie nicht bei den Eltern wohnen – BAföG, Berufsausbildungsbeihilfe oder Ausbildungsgeld beziehen (§ 4 RBStV). Arbeitslosengeld I und Wohngeld reichen nicht. Die Befreiung kommt nicht automatisch, Sie brauchen eine Kopie des Bescheids. Rückwirkend geht es bis zu drei Jahre.",
    },
    {
      frage: "Was kann ich beim Finanzamt tun, wenn ich nicht zahlen kann?",
      antwort: "Zwei Wege sieht die Abgabenordnung vor: die Stundung nach § 222 AO, wenn die Zahlung bei Fälligkeit eine erhebliche Härte wäre – in der Regel auf Antrag und gegen Sicherheitsleistung, mit Zinsen von einem halben Prozent je Monat (§§ 234, 238 AO) –, und die einstweilige Einstellung oder Beschränkung der Vollstreckung, wenn sie im Einzelfall unbillig ist (§ 258 AO). Ohne Einigung kommen Säumniszuschläge von 1 Prozent je angefangenem Monat hinzu (§ 240 AO).",
    },
    {
      frage: "Wann ist die Schuldnerberatung der richtige Weg – und was übernimmt FIAON?",
      antwort: "Drücken mehrere Rückstände gleichzeitig, reicht das Einkommen nicht für die laufenden Kosten oder steht eine Vermögensauskunft an, ist die kostenlose, staatlich anerkannte Schuldnerberatung die erste Anlaufstelle. FIAON ist eine Abo-Plattform rund um Ihre Bonität: Sie erklärt Ihre selbst angeforderte Datenkopie, bereitet Ratenanfragen und Löschanträge vor, versendet sie nach Ihrer Freigabe und verfolgt die Fristen. Über Bescheide, Raten und Löschungen entscheiden die Behörden und Gerichte.",
    },
  ],
  inhalt: `Ein Festsetzungsbescheid vom Beitragsservice. Eine Mahnung vom Finanzamt. Ein Schreiben der Stadtkasse, in dem plötzlich von Vollstreckung die Rede ist. In diesem Moment stellen sich viele Menschen dieselbe Frage: Steht das jetzt in der SCHUFA?

Die ehrliche Antwort hat zwei Teile. Erstens: Behörden melden offene Beträge nicht so an eine Auskunftei, wie es eine Bank oder ein Mobilfunkanbieter tut. Zweitens: Es gibt trotzdem einen Weg in die SCHUFA. Er führt über die Vollstreckung und das amtliche Schuldnerverzeichnis. Dieser Text zeigt den Weg Stufe für Stufe, nennt die Stellen, an denen Sie noch eingreifen können, und erklärt, was nach einem Eintrag möglich ist.

## Behörden melden anders als Banken

Woher die SCHUFA ihre Daten hat, beschreibt sie in ihrer Datenschutzinformation nach Art. 14 DSGVO selbst. Zum einen von ihren Partnern: Banken, Sparkassen, Kreditkarten-, Factoring- und Leasingunternehmen sowie Unternehmen aus Handel, Dienstleistung, Vermietung, Energieversorgung, Telekommunikation, Versicherung und dem Inkassobereich. Zum anderen aus allgemein zugänglichen Quellen – ausdrücklich genannt sind Schuldnerverzeichnisse und Insolvenzbekanntmachungen. Behörden tauchen in der Aufzählung der Partner nicht auf.

Für das Finanzamt kommt das Steuergeheimnis hinzu. Amtsträger müssen es wahren; geschützte Daten dürfen sie nur in den Fällen des § 30 Abs. 4 AO offenbaren, etwa wenn ein Bundesgesetz das ausdrücklich zulässt oder Sie zustimmen. Steuerdaten weiterzugeben, ist damit nur in diesen gesetzlich geregelten Ausnahmen erlaubt.

Der Beitragsservice wiederum beschreibt auf seiner Seite zur Zahlung ein eigenes Verfahren für Rückstände: Festsetzungsbescheid, Mahnung, Vollstreckung. Von der SCHUFA oder anderen Auskunfteien ist dort keine Rede.

Der entscheidende Unterschied zu privaten Gläubigern liegt woanders: Eine Behörde braucht kein Gericht, um einen Titel zu bekommen. Ein Unternehmen muss erst einen Mahnbescheid beantragen oder klagen (mehr dazu im Ratgeber [Mahnbescheid erhalten](/ratgeber/mahnbescheid-erhalten-zwei-wochen-widerspruch)). Die Behörde erlässt den Bescheid selbst und vollstreckt ihn selbst oder lässt ihn von einer anderen Stelle vollstrecken. Nach § 10 Abs. 6 RBStV werden Festsetzungsbescheide über Rundfunkbeiträge im Verwaltungsvollstreckungsverfahren vollstreckt; der Beitragsservice nennt den Festsetzungsbescheid ausdrücklich einen vollstreckbaren Titel. Beim Finanzamt darf die Vollstreckung beginnen, wenn die Leistung fällig ist, ein Leistungsgebot ergangen ist und seit der Aufforderung mindestens eine Woche verstrichen ist (§ 254 Abs. 1 AO). Für Behörden des Bundes verweist das Verwaltungs-Vollstreckungsgesetz für das Verfahren auf die Abgabenordnung (§ 5 Abs. 1 VwVG), die Länder haben eigene Vollstreckungsgesetze.

## Wer bei welcher Schuld Gläubiger ist

Viele sprechen noch von der GEZ. Die Gebühreneinzugszentrale gibt es seit Januar 2013 nicht mehr; an ihre Stelle trat der Beitragsservice, eine Gemeinschaftseinrichtung von ARD, ZDF und Deutschlandradio mit Sitz in Köln. Der Beitragsservice zieht die Beiträge ein. Festgesetzt werden rückständige Rundfunkbeiträge aber durch die zuständige Landesrundfunkanstalt (§ 10 Abs. 5 RBStV) – sie ist die Gläubigerin, etwa der WDR, der BR oder der SWR.

Beim Finanzamt ist der Fall einfacher: Finanzämter und Hauptzollämter sind selbst Vollstreckungsbehörden (§ 249 Abs. 1 AO). Bei Städten und Gemeinden – Grundsteuer, Hundesteuer, Gebühren – gilt das Vollstreckungsrecht des jeweiligen Landes; welche Stelle, etwa die Stadtkasse, zuständig ist, steht im Bescheid.

Für Sie zählt vor allem eines: Wer auf dem Bescheid steht, ist Ihr Ansprechpartner für Raten, Stundung und Fragen zur Höhe. Das ist nicht immer dieselbe Stelle, die später vollstreckt.

## So führt der Weg ins Schuldnerverzeichnis

Wird nicht gezahlt, verlangt die Vollstreckungsbehörde irgendwann die Vermögensauskunft. Nach § 284 Abs. 1 AO ist sie fällig, wenn Sie die Forderung nicht binnen zwei Wochen begleichen, nachdem Sie dazu unter Hinweis auf diese Pflicht aufgefordert wurden. Der Termin soll frühestens einen Monat nach Zustellung der Ladung liegen (§ 284 Abs. 6 AO). In der Auskunft geben Sie Ihr Vermögen an und versichern die Angaben an Eides statt (§ 284 Abs. 2 und 3 AO).

Die Eintragung in das Schuldnerverzeichnis kann die Behörde nach § 284 Abs. 9 AO in drei Fällen anordnen:

- Sie sind der Pflicht zur Vermögensauskunft nicht nachgekommen.
- Eine Vollstreckung wäre nach dem Inhalt der Auskunft offensichtlich nicht geeignet, die Forderung vollständig zu begleichen.
- Sie haben die Forderung nicht binnen eines Monats nach Abgabe der Auskunft vollständig beglichen.

Ein Rechtsbehelf gegen diese Anordnung hat keine aufschiebende Wirkung. Einen Monat nach Zustellung übermittelt die Behörde die Anordnung an das zentrale Vollstreckungsgericht – außer es liegt ein aussichtsreicher Antrag auf Aussetzung der Vollziehung vor (§ 284 Abs. 10 AO). Das zentrale Vollstreckungsgericht führt das Verzeichnis; § 882b Abs. 1 Nr. 2 ZPO stellt die Anordnungen von Vollstreckungsbehörden nach § 284 Abs. 9 AO und nach gleichwertigen Regeln in Bundes- und Landesgesetzen ausdrücklich gleich.

Beim Rundfunkbeitrag hängt der Weg vom Bundesland ab. Je nach Land vollstrecken nach Angaben des Beitragsservice kommunale Vollstreckungsbehörden, Finanzbehörden oder Gerichtsvollzieher. Wie das aussieht, zeigt ein Fall, den der Bundesgerichtshof 2015 entschied: Der Südwestrundfunk hatte ein Vollstreckungsersuchen an die Gerichtsvollzieherverteilerstelle eines Amtsgerichts gerichtet. Die betroffene Person zahlte nicht und erschien nicht zum Termin für die Vermögensauskunft; der Gerichtsvollzieher ordnete die Eintragung nach § 882c Abs. 1 Nr. 1 ZPO an. Der BGH hielt das Ersuchen für wirksam (Beschluss vom 11.06.2015 – I ZB 64/14). Gegen eine Eintragungsanordnung des Gerichtsvollziehers ist binnen zwei Wochen Widerspruch beim Vollstreckungsgericht möglich; er hemmt die Vollziehung nicht, und nach Ablauf der Frist übermittelt der Gerichtsvollzieher die Anordnung an das zentrale Vollstreckungsgericht (§ 882d Abs. 1 ZPO).

Von dort ist es nur ein kleiner Schritt zur SCHUFA. Sie übernimmt Einträge aus dem Schuldnerverzeichnis und speichert sie nach eigenen Angaben drei Jahre; vorzeitig löscht sie, wenn ihr die Löschung durch das zentrale Vollstreckungsgericht nachgewiesen wird.

Wie oft das Verfahren bis zur Vollstreckung läuft, zeigen die Zahlen des Beitragsservice: 2025 erstellte er knapp 1,39 Mio. Vollstreckungsersuchen (2024: 1,59 Mio.). Zum 31.12.2025 standen rund 3,65 Mio. der knapp 47 Mio. Beitragskonten in einer Mahnstufe oder in der Vollstreckung, rund 1,2 Mio. davon in der Vollstreckung.

## Zwei Sonderfälle: Inkasso und Kontopfändung

Der Beitragsservice schreibt selbst: Wird der Vollstreckungsbetrag nicht oder nicht vollständig an Gerichtsvollzieher oder Vollstreckungsbehörde gezahlt, kann er die offene Forderung an ein Inkassounternehmen abgeben; dann ist dieses Unternehmen Ihr Ansprechpartner. Die SCHUFA nennt den Inkassobereich ausdrücklich unter ihren Partnern. Ob ein beauftragtes Unternehmen eine solche Forderung an eine Auskunftei meldet, sagt der Beitragsservice nicht. Verlässlich klärt das nur Ihre eigene Datenkopie. Wie Sie mit dem Schreiben umgehen, erklärt der Ratgeber [Inkasso-Schreiben erhalten](/ratgeber/inkasso-schreiben-erhalten-was-tun).

Der zweite Sonderfall ist das Konto. Das Finanzamt kann eine Geldforderung, also auch Ihr Guthaben bei der Bank, selbst pfänden – mit einer Pfändungsverfügung an die Bank, ohne Gericht (§ 309 AO). Eine Pfändung nennt die SCHUFA in ihrer Datenschutzinformation nicht als eigene Datenkategorie. Wer sein Konto daraufhin in ein Pfändungsschutzkonto umwandelt, sollte aber wissen: Pfändungsschutzkonten führt die SCHUFA dort ausdrücklich unter den Geschäftsbeziehungen auf. Was das bedeutet, steht im Ratgeber [P-Konto in der SCHUFA](/ratgeber/p-konto-in-der-schufa-was-der-rekord-2025-fuer-ihre-bonitaet-wirklich-bedeutet); wie viel Ihnen bleibt, zeigt der [Pfändungsrechner](/werkzeuge/pfaendungsrechner).

Achten Sie auch darauf, wer Ihnen schreibt. Eine Strom- oder Gasrechnung der Stadtwerke ist nicht automatisch eine Forderung der Stadt; Energieversorger zählt die SCHUFA zu ihren möglichen Partnern. Für solche Rechnungen gilt dasselbe wie bei jedem anderen Unternehmen, siehe [SCHUFA und Stromvertrag](/ratgeber/schufa-und-stromvertrag).

## Die Hebel vor der Vollstreckung: Raten, Stundung, Befreiung

**Rundfunkbeitrag.** Der Beitrag beträgt nach Angaben des Beitragsservice 18,36 Euro im Monat. Gesetzlich ist er in der Mitte eines Dreimonatszeitraums für jeweils drei Monate zu zahlen (§ 7 Abs. 3 RBStV), also 55,08 Euro. Gerät das Beitragskonto in Rückstand, folgt der Festsetzungsbescheid mit einem Säumniszuschlag von 1 Prozent der rückständigen Beitragsschuld, mindestens 8 Euro. Eine gesonderte Zahlungserinnerung muss der Beitragsservice nach eigenen Angaben nicht schicken; wer zum wiederholten Mal säumig ist, erhält den Bescheid laut Jahresbericht 2025 ohne vorherige Erinnerung.

Gegen den Bescheid ist binnen eines Monats Widerspruch möglich; der Bescheid gilt nach dem jeweiligen Landesrecht vier Tage nach Aufgabe zur Post als bekannt gegeben. In Bayern können Sie stattdessen direkt Klage beim Verwaltungsgericht erheben. Wichtig: Der Widerspruch hält die Zahlungspflicht in der Regel nicht auf. Verwaltungsgerichte ordnen die Festsetzung von Rundfunkbeiträgen als Anforderung öffentlicher Abgaben ein, so etwa das VG München (Beschluss vom 20.01.2026 – M 26a S 25.8971); dafür entfällt die aufschiebende Wirkung (§ 80 Abs. 2 Satz 1 Nr. 1 VwGO). Einen Antrag auf Aussetzung der Vollziehung stellen Sie zuerst bei der Behörde (§ 80 Abs. 6 VwGO).

Eine Ratenzahlung bietet der Beitragsservice an, wenn drei Bedingungen erfüllt sind: Die Rate steht in einem angemessenen Verhältnis zum Rückstand, frühere Ratenvereinbarungen wurden eingehalten, und es läuft noch keine Vollstreckung. Läuft sie schon, entscheidet die Vollstreckungsbehörde oder der Gerichtsvollzieher.

Prüfen Sie außerdem die Befreiung. Auf Antrag befreit werden unter anderem Menschen mit Grundsicherungsgeld (früher Bürgergeld), Sozialhilfe, Grundsicherung im Alter, Leistungen nach dem Asylbewerberleistungsgesetz sowie – wenn sie nicht bei den Eltern wohnen – mit BAföG, Berufsausbildungsbeihilfe oder Ausbildungsgeld (§ 4 Abs. 1 RBStV). Arbeitslosengeld I, Wohngeld und Übergangsgeld reichen nach Angaben des Beitragsservice nicht. Rückwirkend gilt die Befreiung frühestens ab drei Jahren vor dem Monat des Antrags (§ 4 Abs. 4 RBStV). Ein besonderer Härtefall liegt nach § 4 Abs. 6 RBStV insbesondere vor, wenn eine Sozialleistung abgelehnt wurde, weil Ihre Einkünfte die Bedarfsgrenze um weniger als die Höhe des Rundfunkbeitrags überschreiten; dafür ist ein gesonderter Antrag nötig. Zum 31.12.2025 waren nach dem Jahresbericht des Beitragsservice 2.379.190 Personen aus sozialen Gründen befreit.

**Finanzamt.** Die Stundung nach § 222 AO setzt voraus, dass die Zahlung bei Fälligkeit eine erhebliche Härte wäre und der Anspruch nicht gefährdet erscheint; sie soll in der Regel nur auf Antrag und gegen Sicherheitsleistung gewährt werden. Für die Dauer der Stundung fallen Zinsen an (§ 234 AO), ein halbes Prozent je Monat (§ 238 AO); darauf kann verzichtet werden, wenn ihre Erhebung unbillig wäre. Ist die Vollstreckung im Einzelfall unbillig, kann die Behörde sie einstweilen einstellen oder beschränken (§ 258 AO). Ohne Einigung wächst die Schuld: Der Säumniszuschlag beträgt 1 Prozent des auf 50 Euro abgerundeten Rückstands für jeden angefangenen Monat (§ 240 AO). Ein Einspruch gegen den Steuerbescheid hemmt die Vollziehung nicht (§ 361 Abs. 1 AO); die Aussetzung gibt es auf Antrag bei ernstlichen Zweifeln oder unbilliger Härte (§ 361 Abs. 2 AO).

**Stadtkasse und Gerichtsvollzieher.** Bei kommunalen Forderungen fragen Sie bei der Stelle nach, die im Bescheid steht. Vollstreckt ein Gerichtsvollzieher, kann er nach § 802b ZPO eine Zahlungsfrist oder Raten einräumen, sofern der Gläubiger das nicht ausgeschlossen hat und Sie glaubhaft machen, dass Sie zahlen können; die Tilgung soll binnen zwölf Monaten abgeschlossen sein. Solange ein solcher Zahlungsplan festgesetzt und nicht hinfällig ist, greift der Eintragungsgrund der nicht gezahlten Forderung nach § 882c Abs. 1 Nr. 3 ZPO nicht. Hinfällig wird der Plan, wenn der Gläubiger widerspricht oder Sie mit einer Rate mehr als zwei Wochen im Rückstand sind. Ausführlich: [Ratenzahlung vereinbaren](/ratgeber/ratenzahlung-vereinbaren-glaeubiger).

## Schritt für Schritt: So gehen Sie vor

1. **Post nach Absender und Stufe sortieren.** Zahlungserinnerung, Festsetzungs- oder Steuerbescheid, Mahnung, Ladung zur Vermögensauskunft, Eintragungsanordnung – jede Stufe hat andere Fristen. Notieren Sie das Datum jedes Schreibens.
2. **Den Stand prüfen.** Beim Rundfunkbeitrag fragen Sie den Kontostand online ab und gleichen ihn mit Ihren Zahlungen ab. Beim Finanzamt fragen Sie den Stand Ihres Steuerkontos nach.
3. **Befreiung klären.** Beziehen Sie eine der genannten Leistungen, stellen Sie den Antrag mit einer lesbaren Kopie des Bescheids – das kann auch zurückliegende Monate erfassen.
4. **Fehler fristgerecht rügen.** Stimmt ein Bescheid nicht, legen Sie Widerspruch oder Einspruch schriftlich innerhalb der Frist ein. Zahlungspflicht und Vollstreckung laufen in der Regel weiter; Aussetzung beantragen Sie gesondert bei der Behörde.
5. **Eine tragfähige Rate berechnen.** Mit dem [Spielraum-Rechner](/werkzeuge/spielraum) und dem [Ratenplan](/werkzeuge/ratenplan) sehen Sie, welcher Betrag jeden Monat wirklich übrig ist.
6. **Raten oder Stundung beantragen – so früh wie möglich.** Beim Beitragsservice geht das nur, solange noch keine Vollstreckung läuft; beim Finanzamt über Stundung oder Vollstreckungsaufschub.
7. **Laufende Beiträge weiterzahlen.** Sonst entsteht neben der Rate ein neuer Rückstand.
8. **Die Ladung zur Vermögensauskunft ernst nehmen.** Wer nicht erscheint, erfüllt den ersten Eintragungsgrund.
9. **Selbst nachsehen.** Fordern Sie Ihre kostenlose Datenkopie nach Art. 15 DSGVO an (Anschriften im Werkzeug [Selbstauskunft](/werkzeuge/selbstauskunft)) und nehmen Sie die kostenlose Selbstauskunft im Vollstreckungsportal der Länder.
10. **Nach vollständiger Zahlung die Löschung betreiben.** Weisen Sie dem zentralen Vollstreckungsgericht die Zahlung nach und schicken Sie den Löschnachweis an die Auskunftei.

## Wenn der Eintrag schon steht

Ein Eintrag im Schuldnerverzeichnis wird drei Jahre nach dem Tag der Eintragungsanordnung gelöscht (§ 882e Abs. 1 ZPO). Früher geht es nach § 882e Abs. 3 ZPO, wenn dem zentralen Vollstreckungsgericht die vollständige Befriedigung des Gläubigers nachgewiesen wird, der Eintragungsgrund gefehlt hat oder weggefallen ist oder eine vollstreckbare Entscheidung die Anordnung aufhebt. Bitten Sie die Behörde dafür um eine schriftliche Bestätigung, dass die Forderung vollständig beglichen ist.

Die SCHUFA zieht nach, wenn ihr die Löschung durch das Gericht nachgewiesen wird. Wann ein Eintrag regulär fällt, rechnet das Werkzeug [Löschfrist](/werkzeuge/loeschfrist) aus; den allgemeinen Weg beschreibt die Seite [SCHUFA-Eintrag löschen](/schufa-eintrag-loeschen). Gut zu wissen: Nach einer abgegebenen Vermögensauskunft müssen Sie für zwei Jahre keine weitere abgeben, außer Ihre Verhältnisse haben sich wesentlich geändert (§ 284 Abs. 4 AO).

## Wenn mehrere Forderungen drücken: zuerst die Schuldnerberatung

Rückstände beim Rundfunkbeitrag, beim Finanzamt und bei der Stadtkasse kommen selten allein. Reicht das Einkommen nicht für die laufenden Kosten, stehen mehrere Gläubiger gleichzeitig vor der Tür oder ist eine Vermögensauskunft angesetzt, ist die kostenlose, staatlich anerkannte Schuldnerberatung die erste Anlaufstelle – bei Verbraucherzentralen, Wohlfahrtsverbänden oder Ihrer Kommune. Sie hilft beim Gesamtplan bis hin zur Frage, ob ein Insolvenzverfahren sinnvoll ist. Eine erste Ordnung schaffen der [Schulden-Check](/werkzeuge/schulden-check) und der Ratgeber [Welche Schulden zuerst?](/ratgeber/schulden-priorisieren-welche-zuerst).

## Was FIAON übernimmt

FIAON ist eine Abo-Plattform rund um Ihre Bonität – keine Bank, keine Kanzlei, keine Schuldnerberatung. Bei öffentlichen Rückständen heißt das konkret:

- **Einordnen.** Sie fordern Ihre Datenkopie selbst an. FIAON erklärt jede Zeile und zeigt, ob ein Merkmal aus dem Schuldnerverzeichnis oder die Meldung eines Inkassounternehmens steht – und von wem sie stammt.
- **Vorbereiten.** Die Schreiben liegen als Vorlagen vor: die Ratenanfrage mit nachvollziehbarer Haushaltsrechnung, die Bitte um eine Bestätigung der vollständigen Zahlung, der Antrag auf vorzeitige Löschung an das zentrale Vollstreckungsgericht und das Schreiben an die Auskunftei mit dem Löschnachweis.
- **Versenden und nachhalten.** Sie prüfen und geben frei, FIAON versendet nachweisbar, legt jede Antwort in Ihre Akte und erinnert Sie an die Fristen aus Ihren Bescheiden.
- **Blick der Bank.** Die [Bonitätsauswertung](/bonitaetsauskunft) aus Ihren Kontoauszügen zeigt, was eine Bank aus Ihren Konten liest.

Was das kostet, steht unter [Preise](/preise); den Überblick für Privatkunden finden Sie unter [Privatkunden](/privatkunden).

## Was nicht geht

- Einen Bescheid aufheben oder Beiträge streichen. Über Widerspruch, Einspruch, Befreiung, Stundung und Raten entscheidet die Behörde – nicht FIAON. Niemand kann Ihnen das Ergebnis zusagen.
- Im Einzelfall rechtlich prüfen, ob ein Widerspruch oder Einspruch Aussicht hat. Das ist Rechtsdienstleistung und gehört zu einer Anwältin, einem Anwalt oder der Schuldnerberatung.
- Eine laufende Vollstreckung mit einem Schreiben allein anhalten.
- Einen berechtigten Eintrag im Schuldnerverzeichnis vor Ablauf der drei Jahre löschen lassen, ohne dass die Forderung beglichen ist, der Grund weggefallen ist oder eine gerichtliche Entscheidung vorliegt.
- Nicht zahlen als Strategie. Der Rundfunkbeitrag ist gesetzlich geschuldet; wer ihn liegen lässt, landet auf dem oben beschriebenen Weg.
- Einen Kredit beschaffen. FIAON vergibt keine Kredite.

## Das Wichtigste in Kürze

Beitragsservice, Finanzamt und Stadtkasse melden Rückstände nicht wie eine Bank an die SCHUFA. Sie schaffen sich aber selbst einen Titel und vollstrecken ohne Gericht. In die SCHUFA führt der Weg über die Vermögensauskunft und das Schuldnerverzeichnis. Bis dahin gibt es mehrere Stellen, an denen Sie handeln können: Befreiung, Raten, Stundung, Aussetzung – und der Termin zur Vermögensauskunft selbst. Steht der Eintrag schon, endet er nach drei Jahren oder früher mit dem Nachweis der vollständigen Zahlung.

## Quellen

- [§ 284 AO – Vermögensauskunft des Vollstreckungsschuldners](https://www.gesetze-im-internet.de/ao_1977/__284.html)
- [§ 249 AO – Vollstreckungsbehörden](https://www.gesetze-im-internet.de/ao_1977/__249.html)
- [§ 254 AO – Voraussetzungen für den Beginn der Vollstreckung](https://www.gesetze-im-internet.de/ao_1977/__254.html)
- [§ 30 AO – Steuergeheimnis](https://www.gesetze-im-internet.de/ao_1977/__30.html)
- [§ 222 AO – Stundung](https://www.gesetze-im-internet.de/ao_1977/__222.html)
- [§ 234 AO – Stundungszinsen](https://www.gesetze-im-internet.de/ao_1977/__234.html)
- [§ 238 AO – Höhe und Berechnung der Zinsen](https://www.gesetze-im-internet.de/ao_1977/__238.html)
- [§ 240 AO – Säumniszuschläge](https://www.gesetze-im-internet.de/ao_1977/__240.html)
- [§ 258 AO – Einstweilige Einstellung oder Beschränkung der Vollstreckung](https://www.gesetze-im-internet.de/ao_1977/__258.html)
- [§ 309 AO – Pfändung einer Geldforderung](https://www.gesetze-im-internet.de/ao_1977/__309.html)
- [§ 361 AO – Aussetzung der Vollziehung](https://www.gesetze-im-internet.de/ao_1977/__361.html)
- [§ 5 VwVG – Anzuwendende Vollstreckungsvorschriften](https://www.gesetze-im-internet.de/vwvg/__5.html)
- [§ 80 VwGO – Aufschiebende Wirkung](https://www.gesetze-im-internet.de/vwgo/__80.html)
- [§ 802b ZPO – Gütliche Erledigung, Zahlungsplan](https://www.gesetze-im-internet.de/zpo/__802b.html)
- [§ 882b ZPO – Inhalt des Schuldnerverzeichnisses](https://www.gesetze-im-internet.de/zpo/__882b.html)
- [§ 882c ZPO – Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882c.html)
- [§ 882d ZPO – Vollziehung der Eintragungsanordnung](https://www.gesetze-im-internet.de/zpo/__882d.html)
- [§ 882e ZPO – Löschung](https://www.gesetze-im-internet.de/zpo/__882e.html)
- [Rundfunkbeitragsstaatsvertrag, §§ 4, 7, 10 (BRAVORS Brandenburg)](https://bravors.brandenburg.de/vertraege/rbstv)
- [Beitragsservice: Zahlung, Festsetzungsbescheid, Ratenzahlung, Vollstreckung](https://www.rundfunkbeitrag.de/buergerinnen-und-buerger/informationen/zahlung)
- [Beitragsservice: Widerspruch gegen einen Festsetzungsbescheid](https://www.rundfunkbeitrag.de/widerspruch)
- [Beitragsservice: Befreiung für Empfänger von Sozialleistungen](https://www.rundfunkbeitrag.de/buergerinnen_und_buerger/informationen/empfaenger_von_sozialleistungen/index_ger.html)
- [Beitragsservice: Der Beitragsservice (hervorgegangen aus der GEZ)](https://www.rundfunkbeitrag.de/der-rundfunkbeitrag/beitragsservice)
- [Beitragsservice: Jahresbericht 2025 (PDF)](https://www.rundfunkbeitrag.de/pxy/assets/a57d6f68b12d9336c256fa6a67c93e4f08dc5c20/Jahresbericht_2025.pdf)
- [SCHUFA-Datenschutzinformation nach Art. 14 DSGVO](https://www.schufa.de/global/datenschutz-dsgvo/)
- [SCHUFA: Wie lange speichert die SCHUFA personenbezogene Daten?](https://www.schufa.de/faq/privatpersonen/daten/wie-lange-speichert-die-schufa-personenbezogene-daten.jsp)
- [BGH, Beschluss vom 11.06.2015 – I ZB 64/14 (Volltext bei rewis.io)](https://rewis.io/urteile/urteil/rg5-11-06-2015-i-zb-6414/)
- [VG München, Beschluss vom 20.01.2026 – M 26a S 25.8971 (gesetze-bayern.de)](https://www.gesetze-bayern.de/Content/Document/Y-300-Z-BECKRS-B-2026-N-692)
- [Art. 15 DSGVO – Auskunftsrecht (EUR-Lex)](https://eur-lex.europa.eu/legal-content/DE/TXT/?uri=CELEX:32016R0679)
- [SCHUFA: Kostenlose Datenkopie nach Art. 15 DSGVO](https://www.meineschufa.de/de/datenkopie)
- [Service Berlin: Schuldnerverzeichnis – Selbstauskunft](https://service.berlin.de/dienstleistung/327028/)`,
};
