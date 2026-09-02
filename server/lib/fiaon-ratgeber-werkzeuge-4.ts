// ═══════════════════════════════════════════════════════════════════════════
// Ratgeber zum neuen SCHUFA-Score (02.09.2026, E-081)
//
// Seit dem 17. März 2026 rechnet die SCHUFA anders: 100 bis 999 Punkte,
// zwölf veröffentlichte Kriterien, fünf Klassen. Unsere Seiten erklärten
// noch den Basisscore in Prozent — dieser Text ist die Korrektur und
// zugleich das Suchthema des Jahres („neuer schufa score").
// Quellen: schufa.de/scoring-daten/neuer-score/ (Klassen, Anteile,
// Übergangsfrist Unternehmen bis Ende 2028), SCHUFA-Pressemitteilung
// 17.03.2026, Verbraucherzentrale 26.06.2026 (Kritik, Nutzungsquote),
// schufa.de Kriterienseiten (Höchstpunkte je Kriterium).
// ═══════════════════════════════════════════════════════════════════════════
import type { StartArtikel } from "./fiaon-ratgeber-start";

export const WERKZEUG_ARTIKEL_4: StartArtikel[] = [
  {
    slug: "neuer-schufa-score-2026-was-sich-aendert",
    titel: "Der neue SCHUFA-Score seit März 2026: 100 bis 999 Punkte, zwölf Kriterien – und was das für Ihre Einträge bedeutet",
    untertitel: "Zum ersten Mal sagt die SCHUFA, was zählt und wie viel. Wer die zwölf Kriterien kennt, weiß, wo 264 Punkte an einem einzigen Eintrag hängen – und warum die Prüfung der Auskunft wichtiger geworden ist, nicht unwichtiger.",
    teaser: "Seit 17. März 2026: Skala 100–999, fünf Klassen, zwölf veröffentlichte Kriterien mit Höchstpunkten. Was sich für Verbraucher ändert, was gleich bleibt – und welche Einträge jetzt am meisten kosten.",
    kategorie: "score", land: "DE", keyword: "neuer schufa score",
    schlagworte: ["SCHUFA-Score 2026", "neuer Score", "Score-Klassen", "12 Kriterien", "Zahlungsstörung", "Basisscore"],
    metaTitel: "Neuer SCHUFA-Score 2026: Skala, Klassen, 12 Kriterien",
    metaBeschreibung: "Seit 17. März 2026: SCHUFA-Score von 100 bis 999, fünf Klassen, zwölf veröffentlichte Kriterien mit Punkten. Was sich ändert, was bleibt – und welche Einträge am meisten kosten.",
    faq: [
      { frage: "Seit wann gilt der neue SCHUFA-Score?", antwort: "Seit dem 17. März 2026. Er ersetzt den Basisscore (0 bis 100 Prozent) und die sechs Branchenscores. Für Unternehmen gilt nach Angaben der SCHUFA eine Übergangsfrist bis Ende 2028 – bis dahin können Vertragspartner noch alte Scorewerte abfragen." },
      { frage: "Welche Klassen gibt es?", antwort: "Hervorragend (776–999 Punkte, rund 62 Prozent der Menschen), gut (709–775, rund 20 Prozent), akzeptabel (642–708, rund 8 Prozent), ausreichend (100–641, rund 2 Prozent) und ungenügend – kein Punktwert, weil eine offene Zahlungsstörung vorliegt (rund 8 Prozent). Quelle: SCHUFA." },
      { frage: "Welches Kriterium wiegt am schwersten?", antwort: "Zahlungsstörungen mit bis zu 264 von 999 Punkten. Ohne Zahlungsstörung gibt es die vollen 264; eine erledigte zählt zunächst 100, nach einem Jahr 135, ab zwei Jahren 152 Punkte – bis zu drei Jahre nach Erledigung. Eine offene Zahlungsstörung setzt den Score ganz aus." },
      { frage: "Wie sehe ich meinen neuen Score?", antwort: "Kostenlos und digital im SCHUFA-Account (app.schufa.de) oder über die bonify-App – mit allen zwölf Kriterien und den Punkten je Kriterium. Die Datenkopie nach Art. 15 DSGVO per Post bleibt daneben kostenlos und enthält alle gespeicherten Daten inklusive der meldenden Stellen." },
      { frage: "Ändert der neue Score etwas an den Löschfristen?", antwort: "Nein. Die Speicherfristen der Verhaltensregeln bleiben: erledigte Forderungen drei Jahre, bei Ausgleich innerhalb von 100 Tagen 18 Monate, Restschuldbefreiung sechs Monate, Anfragen zwölf Monate. Neu ist, dass ein erledigter Eintrag im Score über drei Jahre abgestuft nachwirkt – und ein unzulässiger nach der Löschung gar nicht mehr." },
    ],
    inhalt: `Jahrzehntelang war der SCHUFA-Score eine Zahl, deren Zustandekommen niemand außerhalb der SCHUFA kannte: ein Prozentwert, vierteljährlich berechnet, dazu sechs Branchenscores, die Banken und Händler tagesaktuell abriefen – und eine Formel, die als Geschäftsgeheimnis galt. Verbraucher sahen einen Wert, Vertragspartner einen anderen, und was einen Punkt nach oben oder unten bewegte, blieb Vermutung.

Seit dem 17. März 2026 ist das anders. Die SCHUFA hat den Score neu gebaut: eine Skala von 100 bis 999 Punkten, zwölf veröffentlichte Kriterien mit Höchstpunkten, fünf Klassen – und dieselbe Zahl für Verbraucher und Unternehmen. Dieser Text erklärt, was sich geändert hat, was gleich geblieben ist und was die Veröffentlichung der Kriterien für die Prüfung Ihrer Auskunft bedeutet.

## Was der neue Score ist

Der neue SCHUFA-Score ist ein Wert zwischen 100 und 999 Punkten. Je höher, desto geringer schätzt die SCHUFA die Wahrscheinlichkeit einer Zahlungsstörung. Er wird aus zwölf Kriterien berechnet, die die SCHUFA erstmals vollständig veröffentlicht hat – mit der maximalen Punktzahl je Kriterium. Die Summe der Höchstpunkte ergibt 999.

Er ersetzt den bisherigen Basisscore, der als Prozentwert zwischen 0 und 100 vierteljährlich berechnet wurde, und die sechs Branchenscores für Banken, Sparkassen, Genossenschaftsbanken, Telekommunikation, Handel und Versandhandel. Für Unternehmen gilt nach Angaben der SCHUFA eine Übergangsfrist bis Ende 2028; die Verbraucherzentrale stellte im Juni 2026 fest, dass erst etwa ein Viertel der Vertragspartner den neuen Score nutzte. In dieser Übergangszeit können Sie also einen neuen Score sehen, während Ihre Bank noch mit einem alten Wert arbeitet.

*Quelle: SCHUFA, „Neuer SCHUFA-Score: Alle Kriterien und Punkte" (schufa.de); SCHUFA-Pressemitteilung vom 17.03.2026; Verbraucherzentrale, Stand 26.06.2026.*

## Die fünf Klassen

Die SCHUFA ordnet jeden Score einer Klasse zu. Nach ihren Angaben zum Start verteilen sich die Menschen so: **hervorragend** (776 bis 999 Punkte) – rund 62 Prozent; **gut** (709 bis 775) – rund 20 Prozent; **akzeptabel** (642 bis 708) – rund 8 Prozent; **ausreichend** (100 bis 641) – rund 2 Prozent; **ungenügend** – kein Punktwert, weil eine offene Zahlungsstörung vorliegt – rund 8 Prozent.

Die letzte Zahl ist die wichtigste in diesem Text: Rund acht Prozent der gespeicherten Personen haben eine offene Zahlungsstörung und damit gar keinen Score. Das ist die Gruppe, für die FIAON gebaut ist – und für die die Prüfung, ob die Zahlungsstörung überhaupt zulässig gemeldet wurde, über alles entscheidet.

Was die Klassen nicht sind: eine Zusage. Jede Bank setzt ihre eigenen Grenzen und rechnet Einkommen, Kontoführung und Produkt dazu. Dieselben 720 Punkte können bei einer Bank für eine Karte reichen und bei der nächsten nicht.

*Quelle: schufa.de/scoring-daten/neuer-score/ (Anteile zum Start am 17.03.2026).*

## Die zwölf Kriterien – und was jedes wert ist

Die SCHUFA hat die Kriterien und ihre Höchstpunkte veröffentlicht. In der Reihenfolge ihres Gewichts:

1. **Zahlungsstörungen** – bis zu 264 Punkte. Ohne Zahlungsstörung die vollen 264. Eine erledigte Zahlungsstörung zählt zunächst 100 Punkte, nach einem Jahr 135, ab zwei Jahren 152 – bis zu drei Jahre nach Erledigung.
2. **Anfragen und Abschlüsse für Girokonten und Kreditkarten in den letzten zwölf Monaten** – bis zu 117 Punkte.
3. **Anfragen außerhalb des Bankenbereichs in den letzten zwölf Monaten** – bis zu 99 Punkte (Mobilfunk, Versandhandel, Energie).
4. **Alter der aktuellen Adresse** – bis zu 94 Punkte.
5. **Alter der ältesten Kreditkarte** – bis zu 81 Punkte.
6. **Alter des ältesten Bankvertrags** – bis zu 69 Punkte: unter drei Monaten null, nach einem Jahr zwölf, nach vier Jahren 23, nach zehn Jahren 49, ab 20 Jahren die vollen 69.
7. **Aufgenommene Ratenkredite in den letzten zwölf Monaten** – bis zu 66 Punkte.
8. **Längste Restlaufzeit aller Ratenkredite** – bis zu 61 Punkte.
9. **Immobilienkredit** – bis zu 55 Punkte.
10. **Vorliegen einer Identitätsprüfung** – bis zu 38 Punkte.
11. **Alter des jüngsten Rahmenkredits** – bis zu 36 Punkte.
12. **Kreditstatus** – bis zu 19 Punkte.

Zwei Dinge fallen auf. Erstens: Mehr als ein Viertel aller Punkte hängt an einem einzigen Kriterium – den Zahlungsstörungen. Zweitens: Die Kriterien zwei und drei bewerten Anfragen der letzten zwölf Monate mit zusammen 216 Punkten. Wer in einem Jahr fünf Girokonten, drei Kreditkarten und zwei Handyverträge angefragt hat, verliert dort mehr als mancher mit einer alten, erledigten Zahlungsstörung.

*Quelle: schufa.de, Kriterienseiten zum neuen Score (abgerufen 02.09.2026).*

## Was sich für Verbraucher wirklich ändert

Die SCHUFA selbst sagt, dass sich für den Großteil der Menschen durch die Umstellung nichts ändert; nach Medienberichten zum Start werden etwa acht Prozent schlechter und etwa neun Prozent besser eingestuft als vorher. Was sich ändert, ist die Transparenz: Zum ersten Mal können Sie sehen, welches Kriterium wie viele Punkte bringt – kostenlos, digital, im SCHUFA-Account oder in der bonify-App.

Das hat eine praktische Folge, die in vielen Texten zum neuen Score fehlt: Die Prüfung der eigenen Auskunft ist wichtiger geworden, nicht unwichtiger. Wer früher einen Prozentwert von 88 sah, wusste nicht, woran er lag. Wer heute 620 Punkte und „100 Punkte bei Zahlungsstörungen" sieht, weiß es – und kann fragen, ob die Zahlungsstörung, die diese 164 Punkte kostet, überhaupt zulässig gemeldet wurde. War sie es nicht, wird sie gelöscht und zählt gar nicht mehr. War sie es, zählt sie über drei Jahre abgestuft nach.

*Quelle: Verbraucherzentrale, Stand 26.06.2026; SCHUFA-Pressemitteilung 17.03.2026.*

## Was gleich bleibt

Die Löschfristen. Sie stehen in den Verhaltensregeln der Wirtschaftsauskunfteien und nicht im Score: erledigte Forderungen drei Jahre taggenau, bei vollständigem Ausgleich innerhalb von 100 Tagen nach der Meldung 18 Monate (seit 1. Januar 2025 automatisch), Restschuldbefreiung sechs Monate, Anfragen zwölf Monate. Der [Löschfrist-Rechner](/werkzeuge/loeschfrist) nennt das Datum für Ihren Eintrag.

Auch die Voraussetzungen einer Meldung bleiben: fällige, unbestrittene Forderung, zwei Mahnungen mit mindestens vier Wochen Abstand, rechtzeitiger Hinweis auf die Meldung (§ 31 Abs. 2 BDSG). Und die Rechte: Datenkopie nach Art. 15 DSGVO, Berichtigung nach Art. 16, Löschung nach Art. 17, Beschwerde nach Art. 77. Der neue Score ändert die Rechenweise – nicht das Recht.

## Schritt für Schritt: Den neuen Score lesen

1. **Score abrufen.** Im SCHUFA-Account oder der bonify-App kostenlos – mit der Punktzahl je Kriterium. Parallel die Datenkopie per Post anfordern; der [Selbstauskunft-Generator](/werkzeuge/selbstauskunft) schreibt den Brief. Nur sie zeigt, WER gemeldet hat.
2. **Klasse einordnen.** Über 776: nichts zu tun außer bewahren. 709 bis 775: die Kriterien mit Punktabzug ansehen. Unter 709 oder „ungenügend": Datenkopie lesen, Eintrag für Eintrag.
3. **Zahlungsstörungen prüfen.** Für jede gemeldete Forderung: zwei Mahnungen? Hinweis auf die Meldung? Bestritten? Erledigt-Vermerk mit Datum? Der [Eintrag-Prüfer](/werkzeuge/eintrag-pruefen) stellt die fünf Fragen; der [Widerspruch-Generator](/werkzeuge/widerspruch) schreibt den Löschantrag.
4. **Anfragen zählen.** Kriterien zwei und drei: Welche Anfragen stehen da, und waren es wirklich Kreditanfragen – oder Konditionsanfragen, die gar nicht zählen dürften? Falsch gespeicherte Anfragen sind nach Art. 16 DSGVO zu berichtigen.
5. **Alte Verträge behalten.** Ältester Bankvertrag und älteste Kreditkarte: zusammen 150 Punkte. Das älteste Konto ist das wertvollste – Zweitkonten schließen, das erste nie.
6. **In drei Monaten neu abrufen.** Der Score rechnet tagesaktuell; jede Löschung, jede Berichtigung zeigt sich beim nächsten Abruf. Wer den Verlauf notiert, sieht, was wirkt.

## Was nicht geht

Niemand kann Punkte „kaufen", und niemand kann versprechen, dass ein bestimmter Wert erreicht wird – auch FIAON nicht. Eine berechtigte, zulässig gemeldete und erledigte Zahlungsstörung wirkt drei Jahre lang nach; das steht so in den veröffentlichten Kriterien, und kein Schreiben ändert es. Was sich ändern lässt, ist alles, was falsch, unzulässig oder verfristet gespeichert ist – und das ist nach unserer Erfahrung aus den Auskünften, die wir prüfen, ein erheblicher Teil.

Aus der FIAON-Praxis: Die Veröffentlichung der Kriterien ist das Beste, was Verbrauchern seit der DSGVO passiert ist. Zum ersten Mal lässt sich belegen, was ein einzelner Eintrag kostet – in Punkten, nicht in Vermutungen. FIAON beschafft die Auskunft, prüft jeden Eintrag gegen § 31 BDSG und die Fristen, versendet die Schreiben und verfolgt die Antworten. Die Tabelle aller Klassen und Kriterien steht auf der Seite [SCHUFA-Score verstehen](/schufa-score-verstehen).`,
  },
];
