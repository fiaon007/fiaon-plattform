// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 5 — Rechtswissen: Grundlagen (23.08.2026, Plan §11)
// Quellen: shared/fiaon-wissen.ts (Rechtliches Wissen), Ratgeber
// (server/lib/fiaon-ratgeber-*.ts), Werkzeuge unter client/src/pages/site/werkzeuge/.
// Keine Rechtsberatung: Mitarbeiter lernen Regeln und Wege, der Kunde entscheidet.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, ol, merk, warn, tab, sagen, muster, quellen, frage } from "./typen";

export const KAPITEL_5: KapitelInhalt = {
  inhalte: {
    dsgvo: {
      einleitung: "Die Datenschutz-Grundverordnung gilt in Deutschland und Österreich unmittelbar. Sieben Artikel, die du im Schlaf kennen musst – weil jedes Schreiben von FIAON auf einem davon steht.",
      bloecke: [
        tab(["Artikel", "Recht", "Was es für den Kunden bedeutet", "Frist"],
          ["Art. 15", "Auskunft (Datenkopie)", "Kostenlos erfahren, was gespeichert ist: Einträge, Anfragen, Score-Werte, Empfänger der letzten zwölf Monate, Herkunft der Daten.", "Antwort innerhalb eines Monats (Art. 12 Abs. 3), verlängerbar nur mit Begründung"],
          ["Art. 16", "Berichtigung", "Falsche Daten (Betrag, Datum, Erledigungsvermerk) müssen berichtigt werden.", "unverzüglich"],
          ["Art. 17", "Löschung", "Daten müssen gelöscht werden, wenn sie unrechtmäßig verarbeitet wurden oder nicht mehr erforderlich sind – z. B. Meldung ohne § 31-Voraussetzungen, abgelaufene Frist.", "unverzüglich"],
          ["Art. 21", "Widerspruch", "Gegen eine Verarbeitung aus berechtigtem Interesse kann widersprochen werden; die Stelle muss zwingende Gründe nachweisen.", "–"],
          ["Art. 22", "Automatisierte Entscheidung", "Keine Entscheidung mit rechtlicher Wirkung allein durch Automatik – Recht auf menschliches Eingreifen, Darlegung des Standpunkts, Anfechtung, aussagekräftige Information über die Logik (EuGH C-634/21 zum Scoring).", "–"],
          ["Art. 77", "Beschwerde", "Bei der Datenschutzbehörde – in Deutschland die Landesbehörde (für die SCHUFA: Hessen), in Österreich die Datenschutzbehörde in Wien.", "–"],
          ["Art. 82", "Schadensersatz", "Materieller und immaterieller Schaden bei Verstößen – der Schaden muss dargelegt werden (EuGH C-300/21). Das ist Anwaltssache, nicht unsere.", "–"],
        ),
        p("Die Reihenfolge, in der FIAON diese Rechte benutzt: erst Art. 15 (wissen, was steht), dann Art. 16/17 beim Gläubiger und bei der Auskunftei (berichtigen, löschen), bei Weigerung Art. 77 (Behörde) – und Art. 82 nur als Hinweis, dass ein Anwalt weiterhelfen kann."),
        warn("Die Datenkopie nach Art. 15 ist nicht die kostenpflichtige SCHUFA-BonitätsAuskunft. Die Datenkopie ist vollständig und kostenlos; die BonitätsAuskunft ist ein Dokument zum Vorzeigen (Vermieter). Kunden verwechseln das täglich."),
        merk("Frist überschritten? Eine Auskunftei, die nach einem Monat nicht geantwortet hat, verstößt gegen Art. 12 Abs. 3. Erinnern, dann Beschwerde."),
        quellen("Verordnung (EU) 2016/679 (DSGVO), Art. 12, 15, 16, 17, 21, 22, 77, 82", "EuGH, Urteil vom 7.12.2023, C-634/21 (SCHUFA Scoring)", "EuGH, Urteil vom 4.5.2023, C-300/21 (Österreichische Post, Art. 82)"),
      ],
    },
    bdsg31: {
      einleitung: "§ 31 Abs. 2 BDSG ist der Paragraf, an dem die meisten Einträge scheitern. Wer ihn kennt, findet die angreifbaren Einträge.",
      bloecke: [
        p("Eine offene Forderung darf nur dann an eine Auskunftei gemeldet werden, wenn die Forderung fällig ist und mindestens eine dieser Voraussetzungen erfüllt ist:"),
        ol(
          "Die Forderung ist durch ein rechtskräftiges oder vorläufig vollstreckbares Urteil festgestellt oder es liegt ein Schuldtitel vor (Vollstreckungsbescheid, Urteil, Vergleich).",
          "Die Forderung ist nach § 794 ZPO vollstreckbar.",
          "Der Betroffene hat die Forderung ausdrücklich anerkannt.",
          "Der Betroffene wurde nach Eintritt der Fälligkeit mindestens zweimal schriftlich gemahnt, zwischen der ersten Mahnung und der Meldung liegen mindestens vier Wochen, er wurde rechtzeitig vor der Meldung – frühestens bei der ersten Mahnung – auf die mögliche Meldung hingewiesen, und er hat die Forderung nicht bestritten.",
          "Das Vertragsverhältnis kann wegen Zahlungsrückständen fristlos gekündigt werden und der Betroffene wurde auf die bevorstehende Meldung hingewiesen.",
        ),
        p("In der Praxis ist Nummer 4 der Regelfall – und dort fehlt regelmäßig etwas:"),
        tab(["Was fehlt", "Wie oft (Beobachtung aus FIAON-Akten, keine Statistik)", "Wie man es findet"],
          ["Die Forderung war bestritten", "häufig bei Versandhandel („Ware nie erhalten“) und Mobilfunk („gekündigt zum …“)", "Eigener Schriftverkehr des Kunden – jede schriftliche Reklamation vor der Meldung ist ein Bestreiten"],
          ["Mahnungen nicht zugegangen", "häufig nach Umzug; der Gläubiger trägt die Beweislast für den Zugang", "Nachweisanforderung: Mahnungen mit Zugangsnachweis vorlegen lassen"],
          ["Hinweis auf die Meldung fehlte", "bei manchen Standardmahnungen", "Mahnungstexte prüfen"],
          ["Fristen nicht eingehalten", "bei automatisierten Prozessen: zwei Mahnungen in zehn Tagen, Meldung in Woche drei", "Daten der Mahnungen und Meldedatum (Datenkopie) vergleichen"],
        ),
        merk("Ein Eintrag über 80 Euro sperrt dieselben Türen wie einer über 8.000 – und kleine Forderungen werden oft nachlässig gemahnt. Der Aufwand lohnt sich doppelt."),
        warn("Zugang ist nicht Lesen. Wer umzieht, ohne Vertragspartner zu informieren, kann sich nicht darauf berufen, die Mahnung nicht gelesen zu haben. Und eine Forderung, die man anerkannt hat, lässt sich nicht nachträglich „bestreiten“."),
        quellen("§ 31 Abs. 2 BDSG", "Ratgeber „Mobilfunk und Versandhaus: Warum die häufigsten Einträge oft die schwächsten sind“ (fiaon.com/ratgeber)"),
      ],
    },
    loeschfristen: {
      einleitung: "Die Lösch- und Prüffristen stehen nicht im Gesetz, sondern in den Verhaltensregeln der Wirtschaftsauskunfteien („Code of Conduct“, Fassung 2024), abgestimmt mit den Datenschutzbehörden.",
      bloecke: [
        tab(["Eintrag", "Frist", "Ab wann"],
          ["Erledigte Forderung (bezahlt)", "3 Jahre, taggenau", "Erledigungsdatum, das der Gläubiger meldet"],
          ["Erledigte Forderung, 100-Tage-Regel (seit 2024)", "18 Monate", "Erledigung – wenn innerhalb von 100 Tagen nach der Meldung vollständig beglichen und keine weiteren Negativmerkmale vorliegen"],
          ["Offene Forderung", "keine Löschfrist", "bleibt bis zur Erledigung – oder bis die Meldung als unzulässig erkannt wird"],
          ["Titulierte Forderung", "3 Jahre nach Erledigung", "Erledigung"],
          ["Restschuldbefreiung", "6 Monate", "Erteilung (EuGH 7.12.2023, C-26/22/C-64/22; SCHUFA-Praxis seit März 2023)"],
          ["Kreditanfrage", "12 Monate gespeichert, 10 Tage für Dritte sichtbar", "Anfrage – Konditionsanfragen sind neutral"],
          ["Girokonto, Kreditkarte, Kredit", "Konto/Karte bis zur Auflösung; Kredit 3 Jahre nach Tilgung, taggenau", "–"],
          ["Gekündigtes Konto/Karte (durch die Bank)", "3 Jahre", "Erledigung"],
        ),
        p("Frühere Fassung (bis 2023): Kleinforderungen bis 2.000 Euro, die innerhalb von sechs Wochen nach der Meldung beglichen wurden, konnten vorzeitig gelöscht werden, sofern keine weiteren Negativmerkmale vorlagen. Die Fassung 2024 hat das durch die 100-Tage-Regel (18 Monate) ersetzt. Für die Praxis zählt immer: Welche Fassung galt bei der Meldung – und was steht in der Datenkopie."),
        ul(
          "Falle 1: Die 100 Tage laufen ab Meldung, nicht ab Mahnung. Das Meldedatum steht nur in der Datenkopie.",
          "Falle 2: Ratenvereinbarung ist keine Begleichung. Fällt die letzte Rate nach Tag 100, gilt die lange Frist.",
          "Falle 3: Ein zweiter Eintrag – auch ein erledigter – kann die kurze Frist aushebeln.",
          "Die Frist läuft ab dem gemeldeten Erledigungsdatum. Meldet der Gläubiger nicht oder falsch, verschiebt sich alles: Zahlungsbeleg sichern, Gläubiger schriftlich zur Erledigungsmeldung auffordern (Frist zwei Wochen), nach vier bis sechs Wochen Datenkopie prüfen.",
        ),
        merk("Eine überschrittene Frist ist der klarste Löschgrund, den es gibt. Der Rechner im nächsten Schritt nennt das Datum taggenau."),
        quellen("Die Wirtschaftsauskunfteien e. V.: Verhaltensregeln für die Prüf- und Löschfristen (Fassung 2024)", "SCHUFA Holding AG: Informationen zu Speicher- und Löschfristen", "EuGH, 7.12.2023, C-26/22 und C-64/22"),
      ],
    },
    "rechner-loeschfrist": {
      einleitung: "Derselbe Rechner wie auf fiaon.com/werkzeuge/loeschfrist – hier zum Üben. Löse die Aufgabe; der Schritt gilt als abgeschlossen, wenn dein Ergebnis stimmt.",
      uebung: { art: "rechner", rechner: "loeschfrist", aufgabe: { text: "Eine Kundin hat eine Forderung ihres Mobilfunkanbieters laut Datenkopie am 05.01.2025 gemeldet bekommen und sie am 20.02.2025 vollständig bezahlt. Weitere Einträge gibt es nicht. Bilde den Fall im Rechner ab.", erwartet: "Kurze Frist (100-Tage-Regel): Löschung 18 Monate nach Erledigung, also am 20. August 2026.", pruefe: (e) => e.art === "loeschfrist" && e.kurz === true && String(e.datum || "").startsWith("2026-08-20") } },
    },
    verjaehrung: {
      einleitung: "Verjährung ist die zweite große Prüfung bei jeder alten Forderung – und die, bei der ein falscher Schritt des Kunden alles zurücksetzt.",
      bloecke: [
        tab(["Regel", "Paragraf", "Inhalt"],
          ["Regelmäßige Verjährung", "§§ 195, 199 BGB", "Drei Jahre. Beginn mit dem Ende des Jahres, in dem die Forderung fällig wurde und der Gläubiger davon wusste. Fällig 15.05.2022 → Verjährung 31.12.2025."],
          ["Titulierte Forderung", "§ 197 Abs. 1 Nr. 3 BGB", "30 Jahre ab Titel (Vollstreckungsbescheid, Urteil, vollstreckbarer Vergleich). Ein Mahnbescheid allein ist kein Titel."],
          ["Neubeginn", "§ 212 BGB", "Anerkenntnis (Teilzahlung, Ratenvereinbarung, Stundungsbitte) lässt die Verjährung neu beginnen – ab Ende dieses Jahres."],
          ["Hemmung", "§§ 203, 204 BGB", "Verhandlungen, zugestellter Mahnbescheid, Klage hemmen die Verjährung; die Zeit wird nicht mitgerechnet, in der Regel bis sechs Monate nach Ende des Verfahrens."],
        ),
        p("Verjährung wirkt nicht von selbst: Der Kunde muss sich darauf berufen (Einrede). Und sie wirkt nur, solange er nicht zahlt, nicht anerkennt und nichts „zur Prüfung“ zusagt. Deshalb ist der wichtigste Satz bei einer alten Forderung: nichts überweisen, nichts vereinbaren, erst prüfen."),
        muster("Einrede der Verjährung (aus dem Werkzeug)", "Die geltend gemachte Forderung ist nach meiner Prüfung verjährt (Verjährungseintritt am [Datum], §§ 195, 199 BGB). Ich erhebe hiermit ausdrücklich die Einrede der Verjährung und werde keine Zahlung leisten. Bitte bestätigen Sie die Einstellung der Beitreibung. Eine Meldung an Auskunfteien ist unzulässig; sollte eine Meldung erfolgt sein, fordere ich die unverzügliche Rücknahme."),
        warn("Verjährte Forderungen dürfen nicht mehr gemeldet werden – und eine bestehende Meldung ist angreifbar. Aber: Wer eine Rate zahlt, hat anerkannt. Deshalb nie „zahlen Sie erst mal“."),
        quellen("§§ 195, 197, 199, 203, 204, 212 BGB", "Werkzeug fiaon.com/werkzeuge/verjaehrung"),
      ],
    },
    "rechner-verjaehrung": {
      einleitung: "Der Verjährungs-Rechner von fiaon.com/werkzeuge/verjaehrung. Löse die Aufgabe.",
      uebung: { art: "rechner", rechner: "verjaehrung", aufgabe: { text: "Ein Interessent bekommt heute einen Inkassobrief für eine Versandhausrechnung, die am 15.05.2022 fällig wurde. Es gibt keinen Titel, er hat nie etwas gezahlt oder zugesagt, ein Mahnbescheid wurde nie zugestellt. Bilde den Fall ab.", erwartet: "Verjährung mit Ablauf des 31. Dezember 2025 – die Forderung ist heute voraussichtlich verjährt; Einrede erheben, nichts zahlen.", pruefe: (e) => e.art === "verjaehrung" && e.verjaehrt === true && String(e.datum || "").startsWith("2025-12-31") } },
    },
    inkasso: {
      einleitung: "Seit dem 1. Oktober 2021 gelten gesetzliche Obergrenzen für Inkassokosten. Auf dem Brief steht die Forderung – nicht die Obergrenze.",
      bloecke: [
        tab(["Regel", "Grundlage", "Inhalt"],
          ["Kopplung an das RVG", "§ 13e RDG", "Inkassounternehmen dürfen höchstens die Gebühren verlangen, die ein Rechtsanwalt nach dem Rechtsanwaltsvergütungsgesetz abrechnen könnte."],
          ["0,5-Gebühr", "§ 13e RDG, RVG", "Bei unstreitiger Forderung, die nach dem ersten Schreiben beglichen wird, ist in der Regel nur eine 0,5-Geschäftsgebühr angemessen. 0,9 ist der Regelfall bei weiterer Tätigkeit; 1,3 nur bei umfangreicher oder schwieriger Sache."],
          ["Deckel Kleinforderungen", "§ 13e RDG", "Bei Hauptforderungen bis 50 Euro höchstens 30 Euro Gebühr."],
          ["Auslagen", "RVG Nr. 7002", "Pauschale 20 % der Gebühr, höchstens 20 Euro."],
          ["Keine Doppelabrechnung", "RDG", "Erst Inkasso, dann Anwalt: Die Gebühren dürfen nicht addiert werden."],
          ["Informationspflichten", "§ 13a RDG", "Das erste Schreiben muss Forderung, Gläubiger, Kosten und Rechte des Schuldners nennen."],
          ["Verzugszinsen", "§ 288 BGB", "Fünf Prozentpunkte über dem Basiszins – gesondert geschuldet, nicht Teil der Inkassokosten."],
          ["Aufsicht", "RDG", "Seit 2025 beim Bundesamt für Justiz (vorher Landesjustizverwaltungen); Beschwerden dort und bei Verbraucherzentralen."],
        ),
        tab(["Posten (Beispiel 89 € Hauptforderung, erstes Schreiben)", "Gefordert", "Zulässig (ca.)"],
          ["Hauptforderung", "89,00 €", "89,00 €"],
          ["Inkassogebühr", "70,20 €", "24,50 € (0,5 bei Gegenstandswert bis 500 €)"],
          ["Auslagenpauschale", "20,00 €", "4,90 € (20 % der Gebühr)"],
          ["„Kontoführung“ / „Adressermittlung“", "18,00 €", "0 € (ohne Nachweis nicht erstattungsfähig)"],
          ["Verzugszinsen (1 Jahr)", "12,80 €", "rund 7 €"],
          ["Summe", "210,00 €", "rund 125 €"],
        ),
        p("Die vier Prüfungen vor jedem Euro: Besteht die Forderung? Stimmt der Betrag? Ist sie verjährt? Sind die Kosten zulässig? Erst dann: Hauptforderung plus angemessene Kosten zahlen, überhöhten Teil schriftlich zurückweisen – und nach der Zahlung die Erledigungsmeldung einfordern."),
        warn("Nicht alle Kosten pauschal verweigern: Angemessene Inkassokosten sind Verzugsschaden und geschuldet. Und die Hauptforderung wegen überhöhter Kosten nicht zu zahlen, setzt den Verzug fort."),
        quellen("Gesetz zur Verbesserung des Verbraucherschutzes im Inkassorecht (BGBl. 2020 I S. 3320)", "§§ 13a, 13e RDG; RVG Anlage 2", "BDIU: Branchenreports (mehr als 20 Millionen Forderungen jährlich)", "Ratgeber „Inkasso in Zahlen“ (fiaon.com/ratgeber)"),
      ],
    },
    "rechner-inkassokosten": {
      einleitung: "Der Inkassokosten-Prüfer von fiaon.com/werkzeuge/inkassokosten. Rechne das Beispiel nach.",
      uebung: { art: "rechner", rechner: "inkassokosten", aufgabe: { text: "Inkassobrief: Hauptforderung 89,00 €, geforderte Inkassogebühr 70,20 €, Auslagen 20,00 €, „Kontoführung“ 18,00 €. Es ist das erste Schreiben, die Forderung ist unstreitig.", erwartet: "Zulässig sind rund 29,40 € Inkassokosten (24,50 € Gebühr + 4,90 € Auslagen); die Forderung ist um rund 78,80 € überhöht.", pruefe: (e) => e.art === "inkassokosten" && e.ueberhoeht === true && Math.abs((e.zulaessig ?? 0) - 29.4) < 0.05 } },
    },
    basiskonto: {
      einleitung: "Ohne Konto kein Gehalt, keine Miete, kein Vertrag. Seit 2016 hat jeder Verbraucher in der EU Anspruch auf ein Konto – unabhängig von der Bonität.",
      bloecke: [
        ul(
          "Deutschland: Basiskonto nach dem Zahlungskontengesetz (ZKG) – Rechtsanspruch bei jeder Bank, die Zahlungskonten anbietet; Ablehnung nur aus engen Gründen (z. B. bestehendes Konto, Straftat gegen die Bank), schriftlich begründet; Beschwerde bei der BaFin.",
          "Österreich: Verbraucherzahlungskontogesetz (VZKG) – Konto mit grundlegenden Funktionen, angemessenes Entgelt.",
          "Schweiz: kein allgemeiner Rechtsanspruch; PostFinance hat einen Grundversorgungsauftrag, und FIAON arbeitet mit Partnerbanken.",
          "Funktionen: Ein- und Auszahlungen, Überweisungen, Lastschriften, Karte – kein Dispo.",
        ),
        p("Für FIAON ist das Basiskonto die erste Tür in Schicht 3: Jeder Kunde bekommt ein Girokonto (z. B. DKB), unabhängig von der Bonität. Über die Kreditkarte entscheidet der Kartenpartner, sobald der Wert die Schwelle erreicht."),
        quellen("Zahlungskontengesetz (ZKG), §§ 31 ff.", "Verbraucherzahlungskontogesetz (VZKG, Österreich)", "Ratgeber „Girokonto trotz SCHUFA“ (fiaon.com/ratgeber)"),
      ],
    },
    grenze: {
      einleitung: "Die wichtigste Regel dieses Kapitels: Du erklärst Regeln, ordnest ein, was FIAON übernimmt – und triffst keine Entscheidung für den Kunden. Rechtsberatung im Einzelfall gibt FIAON nicht.",
      bloecke: [
        p("Das Rechtsdienstleistungsgesetz erlaubt Rechtsberatung nur Anwälten und registrierten Stellen. FIAON ist keine davon – und will keine sein. Was wir tun, ist erlaubt und wertvoll: allgemein verständliche Information über Regeln, Beschaffung der Auskunft mit Vollmacht, Vorbereitung von Schreiben aus anwaltlich geprüften Vorlagen, die der Kunde freigibt und in seinem Namen versendet werden."),
        sagen(
          ["„Die Regel ist: … Das bedeutet in Ihrem Fall voraussichtlich … Entscheiden müssen Sie.“", "„FIAON bereitet das Schreiben vor – Sie geben es frei, wir versenden es per Einschreiben.“", "„Wenn Sie eine rechtliche Bewertung im Einzelfall brauchen, ist das Anwaltssache – ich sage Ihnen gern, welche Unterlagen Sie dafür brauchen.“", "„Ich erkläre Ihnen, was die Datenkopie zeigt. Was Sie daraus machen, besprechen wir – die Entscheidung ist Ihre.“"],
          ["„Ich rate Ihnen, nicht zu zahlen.“", "„An Ihrer Stelle würde ich …“", "„Das ist rechtswidrig, da bekommen Sie Schadensersatz.“", "„Ich berate Sie dazu gern.“", "„Das klappt garantiert vor Gericht.“"],
        ),
        merk("Der Unterschied liegt im Verb: erklären, zeigen, vorbereiten, versenden, nachhalten – nicht raten, empfehlen, beraten, versprechen."),
        warn("Ein „Tipp“ am Telefon („lassen Sie die Frist verstreichen“, „zahlen Sie nicht“) kann Rechtsberatung sein – und wenn er schiefgeht, haftet FIAON. Die sichere Form ist immer dieselbe: Regel nennen, Folgen nennen, Entscheidung beim Kunden lassen, in die Akte schreiben."),
      ],
    },
  },
  test: [
    frage("Ein Gläubiger hat einmal gemahnt und zehn Tage später gemeldet. Die Forderung war nicht bestritten.", ["Zulässig", "Unzulässig – zwei Mahnungen, vier Wochen Abstand, Hinweis, Meldung frühestens vier Wochen nach der ersten Mahnung (§ 31 Abs. 2 Nr. 4 BDSG)", "Zulässig ab 100 €", "Nur mit Zustimmung"], 1, "Nummer 4 ist der Regelfall – und hier fehlen gleich zwei Voraussetzungen."),
    frage("Erledigt am 10.03.2025, keine 100-Tage-Regel. Löschung am …", ["31.12.2025", "10.03.2028", "10.09.2026", "nie"], 1, "Drei Jahre taggenau ab Erledigung."),
    frage("Restschuldbefreiung vor 14 Monaten, Vermerk noch da. Was gilt?", ["Normal, drei Jahre", "Frist (6 Monate) überschritten – Löschung nach Art. 17 DSGVO, Verweis EuGH C-26/22", "Frist ist ein Jahr", "Nur die Bank löscht"], 1, "Sechs Monate – bestätigt durch den EuGH am 7.12.2023."),
    frage("Fällig 15.05.2022, kein Titel, keine Anerkennung, keine Hemmung. Verjährung …", ["15.05.2025", "mit Ablauf des 31.12.2025", "31.12.2052", "nie"], 1, "Drei Jahre ab Jahresende."),
    frage("Hauptforderung 40 €, erstes Schreiben, unstreitig. Höchstzulässige Gebühr?", ["70,20 €", "49 €", "30 €", "0 €"], 2, "Deckel für Forderungen bis 50 €."),
    frage("Wie lange ist eine Kreditanfrage für Dritte sichtbar?", ["12 Monate", "10 Tage", "3 Jahre", "gar nicht"], 1, "12 Monate gespeichert, 10 Tage sichtbar; Konditionsanfragen neutral."),
    frage("Der Kunde fragt: „Soll ich zahlen oder nicht?“", ["„Nicht zahlen.“", "„Zahlen Sie.“", "Regel und Folgen erklären, was FIAON übernimmt – die Entscheidung trifft er", "Schweigen"], 2, "Keine Rechtsberatung im Einzelfall."),
    frage("Was ist das Basiskonto?", ["Ein Konto nur für Beamte", "Ein Rechtsanspruch nach dem ZKG, unabhängig von der Bonität, ohne Dispo", "Ein Sparkonto", "Eine Kreditkarte"], 1, "Seit 2016; Beschwerde bei der BaFin."),
  ],
};
