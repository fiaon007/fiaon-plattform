// ═══════════════════════════════════════════════════════════════════════════
// Academy · Kapitel 9 — Werkzeuge des Mitarbeiters (23.08.2026, Plan §11)
// Geführte Übungen im echten Office (Prüfkonto-Daten): Pipeline, Akte, Calendar,
// Wallet/Earnings, Tickets/Inbox; dazu das Telefon. Quellen: OfficeShell.tsx,
// Plan §4–§6, shared/fiaon-kundenstatus.ts, shared/fiaon-onboarding-schritte.ts.
// ═══════════════════════════════════════════════════════════════════════════
import { type KapitelInhalt, p, ul, merk, warn, tab, schritte, frage } from "./typen";

export const KAPITEL_9: KapitelInhalt = {
  inhalte: {
    pipeline: {
      einleitung: "Die Pipeline ist deine einzige Arbeitsliste. Öffne sie in einem neuen Tab, geh die Schritte durch, beantworte danach die Kontrollfrage. Auf dem Prüfkonto siehst du Beispieldaten; bei echten Kunden gilt dasselbe.",
      uebung: { art: "uebung", raum: { href: "/agent/kunden", label: "Pipeline öffnen" }, schritte: [
        "Öffne die Pipeline und finde die Phasen-Filter (Interessent · wartet auf Zahlung · Startgespräch · aktiv · Rate offen · Karte beantragt · pausiert).",
        "Sortiere gedanklich nach Stufe: A (Kunde meldet Zahlung) ganz oben, dann B (Antrag fertig, Rechnung offen), dann C (Lead ohne Antrag).",
        "Öffne bei einem Kunden die Akte: Finde Verlauf, Auskunft, Raten, Schreiben und das Gesprächsblatt.",
        "Suche über das Suchfeld nach einem Namen oder einer Telefonnummer – die Suche findet auch Leads.",
        "Finde den KI-Erklärer („Erkläre mir seine Auskunft in 3 Sätzen“) – er hilft beim Einstieg, ersetzt aber nicht deine Prüfung.",
      ], frage: frage("Ein Kunde steht unter „Kunde meldet Zahlung – noch nicht bankbestätigt“. Was tust du als Erstes?", ["Status auf „Bezahlt“ setzen", "Beleg erbitten und den Kontoabgleich abwarten – der Status bleibt, bis das Geld bestätigt ist", "Den Kunden anrufen und mahnen", "Den Kunden archivieren"], 1, "Stufe A: Beleg holen, Kontoabgleich entscheidet.") },
    },
    akte: {
      einleitung: "Eine Akte führen heißt: Jedes Gespräch hat ein Ergebnis, jeder nächste Schritt ein Datum, jede Zusage steht wörtlich drin.",
      uebung: { art: "uebung", raum: { href: "/agent/kunden", label: "Akte öffnen (über die Pipeline)" }, schritte: [
        "Öffne eine Akte und das Gesprächsblatt. Lies die letzten drei Einträge des Verlaufs – in fünf Sekunden solltest du wissen, worum es geht.",
        "Finde die Ergebnis-Knöpfe (zahlt sofort, zahlt am, nicht erreicht, Rückruf, abgelehnt …). Jedes Ergebnis löst etwas aus: Wiedervorlage, Terminlink, Mail.",
        "Finde, wo du einen Rückruf mit Datum und Uhrzeit planst – er erscheint dann auf dem Dashboard.",
        "Finde den Weg, ein Ticket an das Back-Office zu erzeugen (Schreiben an Gläubiger/Auskunftei, Erstattung, Mahnlauf).",
        "Finde die Notiz: Zusagen des Kunden stehen dort wörtlich („Ich überweise am 28.“).",
      ], frage: frage("Du hast mit einem Kunden gesprochen und kein Ergebnis geklickt. Was ist die Folge?", ["Keine", "Für das System hat das Gespräch nicht stattgefunden: keine Wiedervorlage, kein Besitzanspruch, Gefahr eines Doppelanrufs", "Die Akte wird gesperrt", "Die Provision wird gekürzt"], 1, "Ein undokumentiertes Gespräch existiert nicht.") },
    },
    calendar: {
      einleitung: "Calendar und Availability gehören zusammen: Kunden sehen nur Zeiten, in denen du laut Wochenplan arbeitest.",
      uebung: { art: "uebung", raum: { href: "/agent/arbeitszeiten", label: "Availability öffnen" }, schritte: [
        "Öffne Availability. Prüfe, ob dein Wochenplan mindestens 15 Stunden hat – sonst bekommst du keine Leads und Termine, und das Office erinnert dich alle fünf Minuten.",
        "Trage einen realistischen Wochenplan ein (Blöcke von mindestens einer Stunde). Vorlagen wie „Mo–Fr 9–13“ helfen.",
        "Öffne Calendar (/agent/kalender). Finde deine Termine: Startgespräche, Rückrufe, Zeit in Europe/Berlin.",
        "Verstehe die Buchung: Hat der Kunde schon einen Betreuer, sieht er nur dessen Zeiten; sonst Round-Robin nach Kapazität, Quote, Sprache/Land.",
        "Erinnerungen an den Kunden (24 h und 1 h vorher) laufen automatisch – du musst nichts senden.",
      ], frage: frage("Warum sieht ein Kunde bei der Buchung nur bestimmte Zeiten?", ["Zufall", "Weil nur Zeiten angeboten werden, in denen ein verfügbarer Bonitätsmanager laut Wochenplan arbeitet – bei bestehendem Betreuer nur dessen Zeiten", "Weil der Kalender voll ist", "Weil die Geschäftsführung die Zeiten festlegt"], 1, "Termine müssen dort ankommen, wo jemand arbeitet (E-039).") },
    },
    wallet: {
      einleitung: "Wallet zeigt, was angekommen ist; Earnings zeigt, was möglich ist. Beide rechnen mit demselben Provisionssatz.",
      uebung: { art: "uebung", raum: { href: "/agent/verdienst", label: "Wallet öffnen" }, schritte: [
        "Öffne das Wallet. Finde: Verdienst je Rate, Boni, nächste Auszahlung, Verlauf. Alles nur auf bankbestätigte Eingänge.",
        "Öffne Earnings (/agent/gehalt). Stell den Regler auf 5 Abschlüsse pro Tag (das Minimum) und lies Monat 1, 3, 6, 12 ab.",
        "Verschiebe den Paketmix: Was passiert mit Monat 12, wenn mehr High-End-Kunden dabei sind?",
        "Lies die drei Regeln unten: Ausgezahlt wird, was angekommen ist · Dein Kunde bleibt dein Kunde · Kein Deckel.",
        "Merke: Zertifizierte Bonitätsmanager (Academy bestanden) bekommen 5 Prozentpunkte mehr.",
      ], frage: frage("Worauf entsteht deine Provision?", ["Auf jeden Termin", "Auf jede bankbestätigte Rate deiner Kunden – ab der Startzahlung, zwölf Monate, auch in der Verlängerung", "Auf den Verkauf am Telefon", "Auf die Anzahl Anrufe"], 1, "Geld folgt dem Geld, das bei FIAON ankommt.") },
    },
    tickets: {
      einleitung: "Tickets sind zweierlei: Anliegen deiner Kunden aus „Hilfe“ – und deine Aufträge an das Back-Office. Inbox sind die Mails.",
      uebung: { art: "uebung", raum: { href: "/agent/anliegen", label: "Tickets öffnen" }, schritte: [
        "Öffne Tickets. Finde die Trennung: eigene Kunden zuerst, dann der Pool.",
        "Öffne ein Anliegen: Zustand (offen, in Arbeit, beantwortet), Antwortfeld, Verknüpfung zur Akte.",
        "Finde, wie du einen Auftrag an das Back-Office erzeugst (Schreiben, Mahnlauf, Sperre, Erstattung) – der Status kommt in die Akte zurück.",
        "Öffne Inbox (/agent/mail-zentrale): Mails deiner Kunden, Antworten mit Vorlagen. Eine unbeantwortete Kundenmail ist dringender als eine Aufgabe mit Frist.",
        "Öffne Tasks (/agent/aufgaben): Aufgaben von der Geschäftsführung und aus „Dringend melden“ – übernehmen, erledigen, zurückmelden.",
      ], frage: frage("Ein Kunde braucht ein Schreiben an einen Gläubiger per Einschreiben. Richtig ist:", ["Selbst per Post schicken", "Ticket an das Back-Office aus der Akte; Status kommt in die Akte zurück", "Dem Kunden sagen, er soll es selbst schreiben", "Die Geschäftsführung anrufen"], 1, "Versand, Einschreiben, Fristen – das ist das Back-Office.") },
    },
    softphone: {
      einleitung: "Das Telefon im Office: Wer bei dir anruft, wie du rausrufst, was danach passiert. Das neue Softphone wird gerade gebaut (Plan §6) – die Regeln gelten schon.",
      bloecke: [
        tab(["Situation", "Was passiert", "Was du tust"],
          ["Eingehend, Kunde hat dich als Betreuer", "Der Anruf geht an dich; die Akte öffnet sich", "Annehmen, Gesprächsblatt, Ergebnis"],
          ["Eingehend, du bist Offline/Pause", "Empfang: alle mit Status Online; die Akte öffnet sich beim Kollegen", "Kollege notiert, legt Rückruf-Auftrag für dich an"],
          ["Eingehend, niemand da", "Rückruf-Auftrag an dich + SMS an den Kunden („Wir rufen zurück“)", "Rückruf am nächsten Arbeitsblock, Ergebnis klicken"],
          ["Ausgehend", "Klick aus Akte oder Dashboard; Anzeige deiner Nummer (Caller-ID) oder der FIAON-Hauptnummer; optional Vorab-SMS", "Gesprächsblatt vorher öffnen"],
          ["Während des Gesprächs", "Gesprächsblatt: Ergebnis, nächste Aktion, Termin; Halten; Weiterleiten an Kollegen (Team-Raum)", "Zusagen wörtlich notieren"],
          ["Danach", "Aufzeichnung + KI-Zusammenfassung landen im Kontaktprotokoll; das Ergebnis setzt die Phase", "Zusammenfassung prüfen, nicht blind übernehmen"],
        ),
        ul(
          "Anruf auslösen: In jedem Raum über den Anruf-Knopf an der Akte. Technisch ein Ereignis `fiaon-anrufen` an das Softphone – du musst die Nummer nie tippen.",
          "Aufzeichnung: Der Kunde wird zu Beginn informiert (Ansage). Aufzeichnungen sind Teil der Akte und dienen Qualität und Nachweis.",
          "Nicht erreicht: Ergebnis klicken → das System sendet automatisch einen Terminlink (`nicht_erreicht_termin`). Falsche Nummer: Ergebnis klicken → der Kunde wird per Mail nach der richtigen gefragt (`number_update_request`), der Fall schläft bis zur Antwort.",
          "Status Pause = keine Anrufe, keine neuen Kunden. Wer telefoniert, ist Online.",
        ),
        warn("Bekannter Fehler, der gerade behoben wird (E-012): Eingehende Anrufe gingen an den Betreuer der Bestellung statt der Person. Wenn ein Anruf bei dir landet, der nicht zu dir gehört: Kollegen im Team-Raum suchen, weiterleiten, nichts selbst verändern – und melden."),
        merk("Das Telefon ist das Werkzeug, der Klick danach ist die Arbeit."),
      ],
    },
  },
  test: [
    frage("In welcher Reihenfolge arbeitest du die Pipeline?", ["C, B, A", "A, B, C – wo am wenigsten fehlt, zuerst", "Nach Paketpreis", "Nach Alphabet"], 1, "Stufe A zuerst: Beleg holen, fertig."),
    frage("Ohne Wochenplan mit mindestens 15 Stunden …", ["passiert nichts", "bekommst du keine Leads und Termine; das Office erinnert alle 5 Minuten", "wird dein Konto gelöscht", "halbiert sich die Provision"], 1, "Availability ist Pflicht (E-039)."),
    frage("Was zeigt das Wallet?", ["Umsätze aller Kollegen", "Deinen Verdienst auf bankbestätigte Raten, Boni, nächste Auszahlung", "Den Score des Kunden", "Die Termine"], 1, "Nur, was angekommen ist."),
    frage("Ein Anruf kommt bei dir an, aber der Kunde gehört einem Kollegen.", ["Kunden übernehmen", "Annehmen, Kollegen im Team-Raum suchen, weiterleiten oder Rückruf-Auftrag anlegen – und melden", "Auflegen", "Den Kunden archivieren"], 1, "Ein Kunde, ein Betreuer."),
    frage("„Nicht erreicht“ geklickt – was passiert?", ["Nichts", "Das System sendet einen Terminlink; Wiedervorlage entsteht", "Der Kunde wird gelöscht", "Die Geschäftsführung wird informiert"], 1, "Jedes Ergebnis löst etwas aus."),
    frage("Eine unbeantwortete Kundenmail und eine Aufgabe mit Frist – was zuerst?", ["Die Aufgabe", "Die Kundenmail – sie ist dringender", "Beides später", "Die Mail löschen"], 1, "Inbox steht vor Tasks."),
  ],
};
