// ============================================================================
// Agenten-Changelog — die agentengerechte Fassung unserer GitHub-Updates.
//
// Jeder echte GitHub-Push, der den Agenten betrifft, bekommt hier EINEN Eintrag
// in einfacher Sprache: „Was wurde gemacht" + „So bedienst du es" (Schritt für
// Schritt). Reine Commit-Texte sind zu technisch — das hier ist die Version,
// die der Agent versteht und bedienen kann. Neueste zuerst.
//
// VERBINDLICHE REGEL (siehe SYSTEM_DIAGNOSE.md 0.12):
// Jede Änderung, die im Agent-Portal SICHTBAR ist, bekommt im SELBEN Commit
// einen Eintrag hier — genauso verbindlich wie der Eintrag im CHANGELOG.md.
// Ein Update ohne Eintrag gilt als unfertig.
// ============================================================================

export type UpdateCategory = "Neu" | "Verbessert" | "Behoben" | "Hintergrund";

export interface AgentUpdate {
  /** Stabile, eindeutige ID (Datum + Kürzel) — steuert den „gesehen"-Status. */
  id: string;
  /** ISO-Datum (YYYY-MM-DD). */
  date: string;
  category: UpdateCategory;
  title: string;
  /** Ein-Satz-Zusammenfassung (immer sichtbar). */
  summary: string;
  /** Was konkret geändert wurde. */
  changes: string[];
  /** So bedienst du es — konkrete Schritte (optional). */
  howto?: string[];
  /** Direktlink in den passenden Bereich (optional). */
  link?: { href: string; label: string };
  /**
   * „Wichtig" markiert Änderungen, die der Agent kennen MUSS (neue Arbeitsweise,
   * geänderte Zuständigkeit, Geld). Sie erscheinen beim nächsten Login einmalig
   * als kurzer Hinweis — danach nie wieder.
   */
  important?: boolean;
}

// Neueste zuerst.
export const AGENT_UPDATES: AgentUpdate[] = [
  {
    id: "2026-08-08-space-startgespraeche",
    date: "2026-08-08",
    category: "Neu",
    title: "Der Space ist da, Kunden bekommen ein Startgespräch",
    summary:
      "Neuer Menüpunkt „Space“: unser gemeinsamer Raum. Und jeder bezahlte Kunde bekommt künftig 15 Minuten mit einem Menschen, in denen ihm das System erklärt wird.",
    changes: [
      "Neuer Bereich „Space“ im Menü — für alle im Team. Dort stehen Beiträge von Kolleginnen und Kollegen, der Gedanke des Tages und Hinweise der Leitung.",
      "Du kannst schreiben, mit vier Marken reagieren (Daumen, Herz, Stern, Blitz) und antworten. Die Marke am Menüpunkt zeigt, wie viel neu ist.",
      "WICHTIG: Keine Kundendaten im Space. Keine Namen, keine Nummern, keine Beträge. Das System weist Beiträge mit Rufnummern, IBANs oder E-Mail-Adressen ab.",
      "Bezahlte Kunden werden beim ersten Login zu einem 15-minütigen Startgespräch eingeladen und wählen ihre Uhrzeit selbst.",
      "Diese Gespräche führt die neue Rolle „Onboarding“ — sie hat einen eigenen Bereich und sieht die Kundenlage nur lesend.",
      "Neu auf jeder Kundenkarte: der Bereich „E-Mails“. Du siehst, was an den Kunden rausging, und kannst es mit einem Klick erneut schicken (höchstens 3× pro Tag).",
      "Sprache: Aus „Mitarbeiter“ wird „Team“, und die Startseite begrüßt dich mit Namen und Tageszeit.",
      "Kundenseitig duzen wir jetzt überall — im Antrag, im Portal, auf der Terminseite.",
    ],
    howto: [
      "Öffne „Space“ im Menü. Oben stehen drei angepinnte Beiträge, die erklären, was hierher gehört.",
      "Schreib etwas ins Feld oben und klick „Veröffentlichen“. Ein Satz genügt.",
      "Zum Reagieren tippst du eine der vier Marken unter einem Beitrag an. Nochmal tippen nimmt sie zurück.",
      "Wenn du eine Rufnummer oder IBAN in einen Beitrag schreibst, lehnt das System ihn ab und sagt dir warum. Kundendaten gehören in die Akte.",
      "Auf einer Kundenkarte findest du unter „E-Mails“ die Versandhistorie — dort siehst du sofort, ob der Kunde die Zahlungsdaten wirklich bekommen hat.",
      "Steht ein Knopf auf grau, sagt der Text darunter, warum: bezahlt, gesperrt, keine E-Mail oder Tageslimit erreicht.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-08-lead-pipeline-termine",
    date: "2026-08-08",
    category: "Neu",
    title: "Stufen A/B/C, Schluss mit dem 5. Anruf, Kunden buchen selbst",
    summary:
      "Deine Liste sagt jetzt, WARUM sie so sortiert ist. Wen du zweimal nicht erreichst, bekommt automatisch einen Terminlink — und sucht sich selbst eine Uhrzeit aus.",
    changes: [
      "Jede Karte trägt eine Stufe: A = Zahlung gemeldet (heißester Fall), B = Antrag fertig und Rechnung offen (auch „Frist abgelaufen“), C = Lead ohne Antrag.",
      "Oben in der Liste steht dein Vorrat je Stufe, z. B. „A: 4 · B: 31 · C: 642“ — du siehst sofort, ob du in der Pflicht (A/B) oder in der Kür (C) bist.",
      "Stufe C war bisher leer: 2.518 Leads lagen im System, aber niemandem zugeteilt. Sie sind jetzt gleichmäßig verteilt — rund 642 pro Kopf.",
      "Gebuchte Termine des Tages stehen ganz oben, noch vor Zusagen und Rückrufen.",
      "Nach dem 2. erfolglosen Versuch geht automatisch eine Mail mit Terminlink raus — genau einmal je Kunde in 30 Tagen, nicht bei jedem Versuch.",
      "Nach dem 4. erfolglosen Versuch ruht der Fall 14 Tage und verschwindet aus deiner Tagesliste. Er ist NICHT weg: Filter „Ruhend“.",
      "Ausnahme: Stufe A ruht nie — da hängt gemeldetes Geld dran, das geprüft werden muss.",
      "Erreichst du den Kunden oder bucht er einen Termin, springt der Zähler zurück auf 0.",
      "Auf der Karte steht die Vorgeschichte: 4× nicht erreicht, zuletzt 21.07.2026, Terminlink versandt 22.07.2026.",
      "Kunden ohne E-Mail: Knopf „Terminlink per WhatsApp senden“ kopiert den persönlichen Link — wie der Zahlungsdaten-Knopf.",
      "Neu unter Profil: deine Erreichbarkeit für Termine (Vorgabe Mo–Fr 09:00–18:00, Gespräche à 20 Minuten).",
      "Kunden können auch direkt nach dem Antrag einen Termin buchen, statt sofort zu überweisen.",
    ],
    howto: [
      "Öffne „Kunden“. Ganz oben siehst du deinen Vorrat je Stufe.",
      "Arbeite von oben nach unten. Termine und Zusagen zuerst, dann A, dann B. Stufe C ist dran, wenn A und B leer sind.",
      "Trag deine Erreichbarkeit unter „Profil“ ein → „Erreichbarkeit für Termine“. Ohne Eintrag giltst du Mo–Fr 09:00–18:00 als buchbar.",
      "Dokumentiere „nicht erreicht“ wie bisher — die Terminlink-Mail löst sich von selbst aus. Du musst nichts extra tun.",
      "Hat ein Kunde keine E-Mail, nimm den Knopf „Terminlink per WhatsApp senden“ auf seiner Karte.",
      "Steht ein Kunde auf „Ruhend“: nicht anrufen. Er hat den Link und meldet sich selbst; nach 14 Tagen ist er wieder in deiner Liste.",
      "Erscheint ein Kunde nicht zum Termin, dokumentiere „nicht erschienen“ — das zählt wie ein erfolgloser Anruf.",
    ],
    link: { href: "/agent/kunden", label: "Zu deinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-08-massen-zusammenfuehrung",
    date: "2026-08-08",
    category: "Verbessert",
    title: "Ein Mensch, eine Karte — die doppelten Kunden sind weg",
    summary:
      "Viele Kunden lagen mehrfach in der Kartei: derselbe Mensch als zwei, fünf, in einem Fall zwanzig Karten — mit getrennten Bestellungen und getrennten Gesprächsverläufen. Diese Sätze sind jetzt zusammengeführt. Du siehst pro Mensch eine Karte, mit allem darauf.",
    changes: [
      "Zusammengeführt wurde nur, was beweisbar derselbe Mensch ist: gleiche Rufnummer UND gleicher Name, gleiche Rufnummer UND gleiches Geburtsdatum, gleiche E-Mail UND passender Name. Ein einzelnes Merkmal hat nie gereicht.",
      "Ein gemeinsamer Anschluss allein führt NICHT zusammen. Eheleute und Familien mit einer Nummer bleiben getrennte Kunden — sie sind geprüft und als „keine Dublette“ abgehakt, tauchen also auch nicht mehr als Verdacht auf.",
      "Alles wandert mit: alle Bestellungen, der GESAMTE Gesprächsverlauf, Zusagen, Wiedervorlagen und Provisionen. Es wurde nichts gelöscht und nichts stillgelegt, was Geld betrifft.",
      "Frühere Angaben bleiben auffindbar: Hatte ein Kunde zwei Adressen oder zwei Schreibweisen seines Namens, findest du ihn weiterhin unter beiden.",
      "Hatte ein Mensch zwei offene Rechnungen für dasselbe Paket, bleibt jetzt eine. Eine Bonitätsauskunft (74 €) ist ein Zusatzprodukt und bleibt IMMER daneben bestehen — Abo plus Auskunft ist richtig und keine Dublette.",
      "War bei einem zusammengeführten Kunden mehr als ein Betreuer dokumentiert, ist ab jetzt der zuständig, der zuletzt mit ihm gesprochen hat. Bereits gebuchte Provisionen bleiben unverändert — sie hängen an der Bestellung, nicht an der Zuständigkeit.",
    ],
    howto: [
      "Wenn ein Kunde plötzlich mehr Bestellungen und einen längeren Verlauf hat als gestern: Das ist die Zusammenführung. Im Verlauf steht eine Zeile, welche Karten zusammengelegt wurden.",
      "Suchst du jemanden unter einer alten Adresse oder Schreibweise: einfach eintippen, du findest ihn.",
      "Fällt dir trotzdem noch ein doppelter Kunde auf: der Vertriebsleitung mit beiden Namen melden.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-08-verwendungszweck-und-beleg",
    date: "2026-08-08",
    category: "Neu",
    title: "Jeder Kunde hat ab sofort einen Verwendungszweck — auch ohne E-Mail",
    summary:
      "Bisher entstand der Verwendungszweck erst beim Rechnungsversand. Hattest du einen Kunden ohne E-Mail am Telefon, gab es keinen — und sein Geld lag später ohne Namen in der Buchhaltung. Jetzt steht er auf jeder Kundenkarte, fertig zum Vorlesen oder Verschicken.",
    changes: [
      "Auf der Kundenkarte steht der Verwendungszweck immer sichtbar — auch bei Kunden ohne E-Mail-Adresse.",
      "Der Knopf „Zahlungsdaten kopieren“ legt Empfänger, IBAN, Betrag und Verwendungszweck als fertigen Text in die Zwischenablage. Einfügen in WhatsApp oder SMS, fertig. Am Telefon liest du dieselben Angaben vor — es gibt nur noch eine Fassung.",
      "Neu: „Überweisungsbeleg hinterlegen“. Sagt dein Kunde „ich habe überwiesen“ und schickt dir den Screenshot, lädst du ihn direkt an der Bestellung hoch. Er liegt dann bei der Verbuchung sichtbar neben dem Bankeingang, statt in einer WhatsApp-Gruppe zu versanden.",
      "Der Beleg ist freiwillig und beschleunigt die Prüfung — er ist aber KEIN Zahlungsnachweis. Gebucht wird weiter nur, was wirklich auf dem Konto liegt.",
      "Die Statustexte sind überall dieselben. „Kunde meldet Zahlung“ trägt jetzt immer den Zusatz „noch nicht bankbestätigt“ — damit niemand „Zahlung“ liest und aufhört zu prüfen. Der widersprüchliche Satz „Antrag abgeschlossen, keine Zahlung“ ist weg.",
      "Namen werden beim Eingang richtig getrennt. Kunden, bei denen der ganze Name im Vornamen stand, sind nachträglich sortiert — deshalb sehen manche Karten sauberer aus als vorher.",
    ],
    howto: [
      "Kunde am Telefon, keine E-Mail: Karte öffnen, den Verwendungszweck unter „VERWENDUNGSZWECK“ vorlesen. Er ist kurz und für jeden Kunden verschieden.",
      "Kunde hat WhatsApp: „Zahlungsdaten kopieren“ drücken und in den Chat einfügen — Empfänger, IBAN, Betrag und Zweck sind schon drin.",
      "Kunde schickt einen Überweisungs-Screenshot: „Überweisungsbeleg hinterlegen“, Bild auswählen, kurz notieren, woher er kommt. Danach nicht auf „bezahlt“ hoffen — die Buchung macht weiterhin nur, wer das Konto sieht.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-08-dubletten-und-kein-abschalten",
    date: "2026-08-08",
    category: "Neu",
    title: "Kunden liegen nicht mehr doppelt — und kein Konto schaltet sich mehr selbst ab",
    summary:
      "Derselbe Mensch stand mehrfach in der Kartei, mit getrennten Bestellungen und getrennten Gesprächsverläufen. Das lässt sich jetzt zusammenführen, ohne dass etwas verloren geht — und eine abgelaufene Zahlungsfrist wirft deinen Kunden nicht mehr aus dem System.",
    changes: [
      "Eine abgelaufene Zahlungsfrist ist ab jetzt nur noch ein Hinweis. Sie sperrt kein Konto, nimmt den Kunden aus keiner Liste und stoppt keine Erinnerung. Ein Kunde mit abgelaufener Frist ist ein Anruf — kein Abfall.",
      "Konten, die sich in der Vergangenheit ohne Entscheidung eines Menschen abgeschaltet hatten, sind wieder offen. Darunter war ein Kunde, der bezahlt hatte und trotzdem nicht in sein Konto kam. Es wurden dafür keine Mails verschickt.",
      "Doppelte Kunden führt die Vertriebsleitung im neuen Bereich „Dubletten“ zusammen. Beim Zusammenführen wandern ALLE Bestellungen und der GESAMTE Gesprächsverlauf mit — auch deine Einträge. Nichts wird gelöscht und nichts stillgelegt.",
      "Abweichende Angaben gehen nicht verloren: Hatte ein Kunde zwei E-Mail-Adressen, findest du ihn weiterhin unter der alten. Die Suche in deiner Kundenliste sucht ab jetzt auch über frühere Adressen und Rufnummern.",
      "Deine Provision bleibt deine. Ein Zusammenschluss verschiebt die Zuständigkeit, nicht den Anspruch — der folgt dem dokumentierten Kontakt. Sind bei einem Kunden zwei Betreuer dokumentiert, wird gar nichts automatisch entschieden: Die Vertriebsleitung muss ausdrücklich wählen, und die Wahl steht mit Namen im Protokoll.",
      "Neu in der Kundenkarte: „Kein echter Kunde? Als Testeintrag melden“. Damit meldest du Fake- und Testeinträge an die Vertriebsleitung, die sie ins Archiv legt. Du entfernst selbst nichts — und der Kunde bleibt bis zur Entscheidung in deiner Liste.",
    ],
    howto: [
      "Wenn dir zwei Karten mit demselben Menschen auffallen: Sag es der Vertriebsleitung mit beiden Namen. Zusammenführen ist ab jetzt ein Klick und verliert nichts.",
      "Suchst du einen Kunden, der sich mit einer anderen E-Mail gemeldet hat: Tipp die alte Adresse in die Suche — du findest ihn trotzdem.",
      "Findest du einen erfundenen Eintrag, öffne die Karte, klapp den Verlauf auf und meld ihn als Testeintrag. Ein Satz zur Begründung genügt.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-06-vertrieb-service",
    date: "2026-08-06",
    category: "Neu",
    title: "Vertriebsleitung hilft jetzt direkt: Zahlungen, Unterlagen, Zugang",
    summary:
      "Bei Zahlungsfragen, fehlenden Unterlagen oder Login-Problemen deiner Kunden musst du nicht mehr auf den Betreiber warten — die Vertriebsleitung kann das jetzt selbst klären.",
    changes: [
      "Sagt dein Kunde, er habe überwiesen: Die Vertriebsleitung sieht die Bankeingänge und kann ihn bei belegtem Geld selbst auf „bezahlt“ setzen. Das Konto geht sofort auf und der Kunde bekommt seine Bestätigung.",
      "Gebucht wird nur mit Nachweis — passender Verwendungszweck im Bankeingang oder ein Überweisungsbeleg, den der Kunde gezeigt hat. Ohne Nachweis und ohne echtes Eingangsdatum geht der Knopf nicht.",
      "Fehlende Unterlagen sind sichtbar: Bei welchen bezahlten Kunden noch Ausweis, Kontoauszug oder SCHUFA-Auskunft fehlt. Die Dokumente selbst bleiben beim Betreiber.",
      "Login-Probleme sind erklärbar: Es steht da, WARUM ein Kunde nicht in sein Konto kommt (kein Passwort gesetzt, Zahlung offen, Konto gesperrt) und was konkret hilft.",
      "Deine Provision bleibt deine: Eine Buchung durch die Vertriebsleitung geht auf den dokumentierten Betreuer — also auf den, der die Arbeit gemacht hat.",
    ],
    howto: [
      "Ruf bei deinem Kunden etwas an, das du selbst nicht klären kannst, wende dich an die Vertriebsleitung.",
      "Bei Zahlungen halte den Beleg des Kunden bereit — Datum, Betrag und Empfänger müssen darauf zu sehen sein.",
    ],
  },
  {
    id: "2026-08-06-vertriebsleitung-zusage",
    date: "2026-08-06",
    category: "Neu",
    title: "Vertriebsleitung: Übergabe mit Verpflichtungserklärung",
    summary:
      "Zwei Kollegen führen den Vertrieb und sehen dafür alle Kunden. Bevor sie das können, müssen sie eine Erklärung annehmen — damit du weißt, woran sie gebunden sind.",
    changes: [
      "Wer die Vertriebsleitung übertragen bekommt, sieht beim ersten Öffnen des Bereichs eine Einführung: was dort möglich ist und was ausdrücklich nicht.",
      "Danach folgt eine Verpflichtungserklärung in zehn Punkten — Zweckbindung, Vertraulichkeit, keine Selbstbevorteilung bei Zuweisungen, Meldepflicht bei Vorfällen. Sie muss gelesen und mit dem eigenen Namen angenommen werden.",
      "Ohne diese Annahme bleibt der Bereich verschlossen: Der Server liefert keine Kundendaten aus. Das ist keine Formalie, sondern die Bedingung.",
      "Die Vertriebsleitung kann Kunden zuweisen und Stammdaten berichtigen. Sie kann KEINE Zahlungen buchen, keine Provisionen ändern und keine Bankdaten sehen.",
      "Wichtig für dich: Eine Zuweisung verschiebt die Zuständigkeit, nicht den Provisionsanspruch. Der folgt dem dokumentierten Kontakt — also deiner Arbeit.",
    ],
    howto: [
      "Für dich ändert sich nichts an der Bedienung.",
      "Fällt dir bei einem deiner Kunden etwas auf, das du nicht erklären kannst, sprich die Vertriebsleitung an — jede Änderung dort ist mit Namen und Zeit protokolliert.",
    ],
  },
  {
    id: "2026-08-06-anrufer-blockiert",
    date: "2026-08-06",
    category: "Neu",
    important: true,
    title: "Neuer Knopf: „Anrufer blockiert“ — der Kunde geht sofort an einen Kollegen",
    summary:
      "Wenn ein Kunde deine Nummer blockiert hat, gibst du ihn mit einem Klick weiter. Ein Kollege mit einer anderen Nummer ruft an, statt dass der Fall bei dir liegen bleibt.",
    changes: [
      "In der Kundenliste steht bei jedem Kunden ein achter Knopf: „Anrufer blockiert“.",
      "Der Kunde geht an den Kollegen mit dem kleinsten Bestand, der bei diesem Kunden noch nicht blockiert wurde. Er verschwindet aus deiner Liste, du bekommst dafür Nachschub.",
      "Der Kunde wird NICHT gesperrt und landet beim Kollegen sofort auf heute — er soll ja erreicht werden, nur eben von einer anderen Nummer.",
      "Hat jeder Kollege bei diesem Kunden schon eine Blockade dokumentiert, wird nichts verschoben. Du bekommst dann den Hinweis, das mit der Vertriebsleitung zu klären.",
      "Ehrlich dazu: Die Provision folgt dem, der den Abschluss dokumentiert. Macht der Kollege den Abschluss, gehört sie ihm. Das steht auch in der Rückfrage vor dem Klick.",
    ],
    howto: [
      "Kunden öffnen, beim Kunden auf „Anrufer blockiert“ tippen.",
      "Die Rückfrage lesen und bestätigen — danach siehst du, wer übernimmt.",
    ],
    link: { href: "/agent/kunden", label: "Kundenliste öffnen" },
  },
  {
    id: "2026-08-05-eine-kundenliste",
    date: "2026-08-05",
    category: "Neu",
    important: true,
    title: "Aus „Heute“ und „Meine Kunden“ wird EINE Liste — und dein Kunde bleibt dein Kunde",
    summary:
      "Es gibt nur noch eine Arbeitsliste: „Kunden“. Die neue Startseite zeigt Zahlen und Termine; gearbeitet wird an einer Stelle. Und niemand nimmt dir einen betreuten Kunden mehr weg.",
    changes: [
      "„Heute“ ist weg. Zwei Listen über denselben Bestand waren zwei Wahrheiten — deshalb konnte es passieren, dass zwei von euch denselben Menschen angerufen haben.",
      "„Kunden“ ist jetzt DIE Liste. Die Reihenfolge steht schon: oben Zusagen und Rückrufe, die heute dran sind, dann gemeldete Zahlungen, dann offene Rechnungen, dann Leads. Von oben nach unten abarbeiten.",
      "Jede Karte kann alles: anrufen, mailen, Ergebnis festhalten, Zusage eintragen, Rückruf setzen, Zahlungsdaten senden, Rufnummer korrigieren. Kein Seitenwechsel mehr.",
      "Jede Rufnummer hat jetzt die Ländervorwahl — Antippen wählt direkt, auch bei österreichischen und schweizerischen Nummern.",
      "BESITZSCHUTZ: Sobald du bei einem Kunden ein Ergebnis dokumentiert hast, gehört er dir. Die automatische Verteilung fasst ihn nicht mehr an. Vorher konnte sie ihn dir wegnehmen — genau das ist passiert und ist jetzt abgestellt.",
      "18 Bestellungen hatten einen anderen Zuständigen als die Kundenakte. Das war der Grund, warum ein Kunde auf einer Seite da war und auf der anderen fehlte. Ist abgeglichen.",
      "Die neue Startseite zeigt: Verdienst diesen Monat, Guthaben zur Auszahlung, was deine offenen Kunden wert wären, und deine Termine für heute.",
    ],
    howto: [
      "Nach dem Login landest du auf „Start“. Dort stehen deine Zahlen und deine Termine — gearbeitet wird dort nicht.",
      "Tippe auf „Kunden“. Arbeite die Liste von oben nach unten ab; die Reihenfolge ist die Arbeitsreihenfolge.",
      "Willst du etwas Bestimmtes, nimm oben einen Filter oder die Suche (Name, Nummer, Referenz).",
      "Deine alten Lesezeichen auf „Heute“ funktionieren weiter — sie führen jetzt auf „Start“.",
    ],
    link: { href: "/agent/kunden", label: "Kundenliste öffnen" },
  },
  {
    id: "2026-07-29-personenmodell-teil2",
    date: "2026-07-29",
    category: "Verbessert",
    title: "Dein Lead bleibt dein Kunde — auch nach dem Antrag",
    summary:
      "Bisher zerfiel derselbe Mensch in eine Lead-Karte und eine Kundenkarte. Ab jetzt ist es eine Akte.",
    changes: [
      "Stellt einer deiner Leads später einen Antrag, erkennt das System ihn an E-Mail oder Rufnummer wieder. Verlauf, Notizen und dein Betreuungsnachweis bleiben zusammen — auch „Zahlung angekündigt“.",
      "Wer den Bonitäts-Check kauft, bekommt keine zweite Karte mehr. Das war auch der Grund, warum manche Kunden sich plötzlich nicht mehr einloggen konnten — dieser Fehler ist strukturell nicht mehr möglich.",
      "Bestellt ein Kunde ein zweites Mal, ist das eine weitere Bestellung an derselben Akte statt ein neuer Kunde.",
      "Jede Adresse und jede Nummer, die ein Kunde je genutzt hat, bleibt suchbar. Auch wenn zwei Akten zusammengelegt werden, geht keine davon verloren.",
      "Sind ausnahmsweise zwei Agenten an einer Person beteiligt, entscheidet das System NICHT von allein. Der Fall wird markiert und von der Leitung geklärt — deine Zuordnung wird dir nicht automatisch weggenommen.",
    ],
    howto: [
      "Du musst nichts anders machen. Suche wie bisher nach Name, E-Mail oder Nummer.",
      "Findest du denselben Menschen trotzdem zweimal: melden, nicht selbst zusammenführen. Wir lösen das zentral auf.",
    ],
    important: true,
  },
  {
    id: "2026-07-29-personenmodell-teil1",
    date: "2026-07-29",
    category: "Hintergrund",
    title: "Wir bauen die Kundendatenbank auf „ein Mensch = eine Akte\" um",
    summary:
      "Heute steht derselbe Kunde bis zu zwölfmal in der Datenbank. Das ändern wir — Schritt eins ist gemacht, für dich ändert sich noch nichts.",
    changes: [
      "Gemessen: 5.963 Zeilen stehen für 2.142 Menschen. Über die Hälfte der Zeilen sind abgebrochene Anträge ohne jeden Kontakt — die zählen ab jetzt nirgends mehr als Kunde.",
      "Wir zählen aktuell 264 bezahlte Kunden, es sind 254 Menschen. Wer den Bonitäts-Check kauft, wurde doppelt gezählt.",
      "Jede E-Mail-Adresse und jede Nummer, die ein Kunde je genutzt hat, wird künftig gespeichert. Damit findest du ihn auch über eine alte Adresse — und beim Zusammenführen von Dubletten geht nichts mehr verloren.",
      "757 Leads sind längst Antragsteller. Sie werden zu EINER Akte zusammengeführt, damit dein Lead nach dem Antrag bei dir sichtbar bleibt.",
      "An deinen Kunden, deiner Zuordnung und deiner Provision wurde nichts verändert — die Provisionssumme wurde auf den Cent gegengeprüft.",
    ],
    howto: [
      "Für dich ändert sich in diesem Schritt nichts — Kartei, Kunden und Leads arbeiten unverändert weiter.",
      "Wenn du eine Dublette siehst: nicht selbst zusammenführen, sondern melden. Ab dem nächsten Schritt erkennt das System sie von allein.",
    ],
  },
  {
    id: "2026-07-28-bestand-und-gruss",
    date: "2026-07-28",
    category: "Behoben",
    title: "„Guten Abend“ am Morgen — behoben, dazu dein Bestand auf der Startseite",
    summary: "Die Begrüßung stimmt jetzt zur Uhrzeit. Neu darunter: dein eigener Bestand mit deinen letzten Abschlüssen.",
    changes: [
      "Die Startseite hat morgens „Guten Abend“ gesagt. Ursache war ein Rechenfehler bei der Uhrzeit — behoben und mit festen Testzeiten abgesichert (auch Mitternacht und Zeitumstellung).",
      "Kann die Uhrzeit einmal nicht bestimmt werden, steht dort neutral „Hallo“ — nie mehr eine falsche Tageszeit.",
      "Neu: „Mein Bestand“ unter dem großen Knopf. Drei Zahlen — In Betreuung, Zahlung angekündigt, Abgeschlossen. Ein Tipp darauf öffnet „Meine Kunden“ mit genau diesem Filter.",
      "Darunter stehen deine letzten drei Abschlüsse mit Paket und Provision. Boni erscheinen dort nicht — sie sind kein Abschluss.",
      "Hast du noch keine eigene Akte, steht dort, wie du deine erste übernimmst.",
      "Der Zähler am Menü-Knopf stimmt jetzt mit den Zahlen im Menü überein. Vorher zählte er Akten mit, die bald zurücklaufen, zeigte sie aber nirgends — diese Zahl steht ab sofort am Menüpunkt „Kartei“.",
      "Alles etwas kleiner und ruhiger gesetzt; am Computer stehen Kontostand und Bestand jetzt nebeneinander statt in einer schmalen Spalte.",
    ],
    howto: [
      "Öffne „Mein Tag“ — unter dem blauen Knopf steht „Mein Bestand“.",
      "Tippe auf eine der drei Zahlen, um genau diese Akten zu sehen.",
      "„Alle Abschlüsse“ führt zu Verdienst, wo deine komplette Liste steht.",
    ],
    link: { href: "/agent", label: "Startseite ansehen" },
  },
  {
    id: "2026-07-28-startseite",
    date: "2026-07-28",
    category: "Verbessert",
    important: true,
    title: "Neue Startseite: dein Kontostand und ein Knopf",
    summary: "„Mein Tag“ zeigt jetzt drei Dinge: Begrüßung, deinen Kontostand — groß — und „Nächste Akte öffnen“. Sonst nichts.",
    changes: [
      "Der Kontostand ist der Held der Seite: dein verfügbares Guthaben, groß und ruhig, mit „Auszahlung“ direkt daneben.",
      "Darunter steht dezent, was diese Woche und diesen Monat dazugekommen ist.",
      "Liegt dein Guthaben unter dem Mindestbetrag, sagt die Karte das freundlich und nennt den fehlenden Betrag — statt dir einen Knopf anzubieten, der dann nicht funktioniert. Läuft eine Auszahlung, steht das dort.",
      "Es gibt nur noch EINEN großen Knopf: „Nächste Akte öffnen“. Der zusätzliche schwebende Knopf unten ist auf der Startseite weg.",
      "Hast du eine Akte offen, heißt der Knopf „Akte fortsetzen“ und öffnet sie direkt.",
      "Die Begrüßung nennt jetzt, wie viele Kunden auf Betreuung warten — und, falls vorhanden, wie viele Rückrufe heute fällig sind. Ohne Namen: die stehen in deiner nächsten Akte ganz oben.",
      "Weg sind: die Tagesziel-Ringe, der Team-Vergleich („beste Wochenleistung“), der Kollegen-Feed und die Kundenliste „Jetzt dran“. Gearbeitet wird in der Kartei — nicht auf der Startseite.",
      "Deine Abschlüsse, das Wunschgehalt und das Partner-Programm findest du unverändert unter „Verdienst“.",
      "„Erste Schritte“ steht jetzt unter „Mehr“.",
      "An deinem Geld ändert sich nichts: Es sind dieselben Zahlen aus derselben Quelle wie unter „Verdienst“ und „Auszahlung“.",
    ],
    howto: [
      "Öffne „Mein Tag“ — oben steht dein Kontostand.",
      "Willst du auszahlen: „Auszahlung“ in der Kontostand-Karte antippen.",
      "Willst du arbeiten: den großen blauen Knopf antippen — er bringt dich zur nächsten wichtigen Akte.",
    ],
    link: { href: "/agent", label: "Startseite ansehen" },
  },
  {
    id: "2026-07-27-akten-fluss",
    date: "2026-07-27",
    category: "Behoben",
    important: true,
    title: "Akte gibt jetzt frei — und das Ergebnis geht in zwei Schritten",
    summary: "Nach einem dokumentierten Kunden-Gespräch bliebst du hängen: „Du hast eine Akte in Bearbeitung“. Behoben. Dazu die Ergebnis-Erfassung neu.",
    changes: [
      "Bei Kunden wurde die Akte nach dem Kontakt-Ergebnis nicht geschlossen — bei Leads schon. Deshalb war die Kartei danach gesperrt. Das ist behoben, ebenso beim Aussortieren.",
      "Neu: „Ohne Ergebnis schließen“ gibt es jetzt auch bei Kunden — mit kurzer Begründung. Zählt nicht als Betreuung.",
      "Akten, die gar keine offene Karte mehr sein können (bezahlt, aussortiert, konvertiert), werden ab sofort automatisch freigegeben. Kein Zustand kann dich noch dauerhaft blockieren.",
      "Nach dem Abschließen steht direkt „Nächste Akte öffnen“ da — dokumentieren, weiter, nächste.",
      "Das Kontakt-Ergebnis läuft jetzt in zwei Schritten: erst „Erreicht“ oder „Nicht erreicht“, dann die Feinheit. Statt sieben Knöpfen auf einmal.",
      "Optionen, die eine E-Mail auslösen, sagen das vorher im Klartext.",
      "„Zahlung angekündigt“ steht ab sofort immer ganz oben in der Kartei — vor allem anderen.",
      "Ein Rückruf lässt sich nicht mehr in der Vergangenheit speichern. Ein solcher Termin wurde nie fällig und ist lautlos verschwunden.",
    ],
    howto: [
      "Öffne eine Akte und tippe auf „Erreicht“ oder „Nicht erreicht“ — die passenden Optionen erscheinen darunter.",
      "Nach dem Speichern tippe auf „Nächste Akte öffnen“.",
      "Kommst du nicht weiter: „Ohne Ergebnis schließen“ mit kurzer Begründung.",
    ],
    link: { href: "/agent/kartei", label: "Kartei öffnen" },
  },
  {
    id: "2026-07-27-kartei-zeitlimit",
    date: "2026-07-27",
    category: "Behoben",
    title: "Kartei lädt wieder — die Abfrage war zu langsam gebaut",
    summary: "Der Zähler zeigte 773 freie Karten, die Liste lief in eine Zeitgrenze. Ursache gefunden und umgebaut.",
    changes: [
      "Um doppelte Kunden zu erkennen, hat das System für jeden Lead die komplette Antragsliste durchsucht — fast 15 Millionen Vergleiche bei jedem Aufruf der Seite.",
      "Jetzt wird die Vergleichsliste einmal vorbereitet, statt sie jedes Mal neu zu durchsuchen. Gleiches Ergebnis, ein Bruchteil der Zeit.",
      "Zusätzlich lief die Abfrage doppelt: einmal für die Reihenfolge, einmal für den Wartezeit-Ausgleich. Das ist jetzt ein Durchgang.",
      "Sollte es trotzdem einmal zu lange dauern, siehst du die Karten in einer vereinfachten Ansicht statt einer Fehlermeldung — nach Frische sortiert, mit Hinweis. Arbeiten kannst du damit normal.",
      "An der Auswahl der Karten ändert sich nichts. Es sind dieselben Akten in derselben Reihenfolge.",
    ],
    howto: [
      "Öffne „Kartei“ — die freien Karten sind wieder da.",
      "Steht oben „Vereinfachte Ansicht“, stimmt die Reihenfolge gerade nicht. Die Karten selbst sind vollständig.",
    ],
    link: { href: "/agent/kartei", label: "Kartei öffnen" },
  },
  {
    id: "2026-07-27-kartei-serverfehler",
    date: "2026-07-27",
    category: "Behoben",
    title: "Kartei war kurz nicht erreichbar — behoben",
    summary: "Nach dem letzten Update meldete die Kartei „Serverfehler“. Ursache war eine Umstellung im Hintergrund, nicht deine Daten.",
    changes: [
      "Beim Beschleunigen der Datenbank wurde eine Wartungsroutine an die falsche Stelle gesetzt. Schlug sie fehl, blockierte sie die gesamte Kartei.",
      "Diese Routine läuft jetzt getrennt im Hintergrund. Geht dort etwas schief, arbeitet die Kartei trotzdem weiter — nur etwas langsamer.",
      "Wenn doch einmal ein Fehler auftritt, steht ab sofort im Klartext auf dem Bildschirm, woran es liegt, statt nur „Serverfehler“.",
      "Deine Akten waren zu keinem Zeitpunkt betroffen — es war reine Anzeige.",
    ],
    howto: [
      "Öffne „Kartei“ und tippe bei Bedarf auf „Erneut laden“.",
    ],
    link: { href: "/agent/kartei", label: "Kartei öffnen" },
  },
  {
    id: "2026-07-27-kartei-laedt",
    date: "2026-07-27",
    category: "Behoben",
    important: true,
    title: "Die Kartei zeigt jetzt wirklich alle freien Karten",
    summary: "Oben stand „768 frei“, darunter „Die Kartei ist gerade leer“. Der Fehler ist gefunden und behoben.",
    changes: [
      "Zähler und Liste haben zwei verschiedene Abfragen benutzt. Der Zähler lief, die Liste brach ab — und der Abbruch wurde stillschweigend verschluckt.",
      "Die Oberfläche hat daraus „leer“ gemacht. Ein Fehler sah damit genauso aus wie ein normaler leerer Bestand.",
      "Ab sofort wird sauber unterschieden: Es lädt · Es ist wirklich leer · Es ist ein Fehler. Bei einem Fehler steht das im Klartext da, samt „Erneut laden“.",
      "Derselbe Fehler steckte in „Meine Kunden“ — auch dort behoben.",
      "Wichtig für dich: Es war nie ein Datenverlust. Die Akten waren die ganze Zeit vollständig vorhanden, sie wurden nur nicht angezeigt.",
    ],
    howto: [
      "Öffne „Kartei“ — du siehst jetzt die freien Karten, oben die lohnendsten.",
      "Sollte doch einmal etwas klemmen, steht der Grund auf dem Bildschirm. Tippe auf „Erneut laden“.",
    ],
    link: { href: "/agent/kartei", label: "Kartei öffnen" },
  },
  {
    id: "2026-07-27-menue",
    date: "2026-07-27",
    category: "Neu",
    title: "Neues Menü — seitlich statt unten",
    summary: "Die Leiste am unteren Rand ist weg. Das Menü fährt jetzt von links ein und gibt dir mehr Platz zum Arbeiten.",
    changes: [
      "Tippe oben links auf das Menü-Symbol — oder wisch einfach vom linken Bildschirmrand nach rechts.",
      "Schließen: nach links wischen, daneben tippen oder die Zurück-Taste.",
      "Am Menü-Symbol steht eine Zahl, wenn etwas auf dich wartet: Antwort vom Betreiber, neue Neuerungen oder Akten, die bald zurück in die Kartei laufen.",
      "„Nächste Akte“ bleibt immer als Knopf sichtbar, auch wenn das Menü zu ist — eine Handbewegung bis zur Arbeit.",
      "Alles ist einhändig erreichbar, alle Tippflächen mindestens 44 Pixel.",
    ],
    howto: [
      "Menü öffnen: oben links tippen oder vom linken Rand nach rechts wischen.",
      "Hast du „Bewegung reduzieren“ im Handy eingestellt, erscheint das Menü ohne Animation.",
    ],
  },
  {
    id: "2026-07-27-tempo",
    date: "2026-07-27",
    category: "Verbessert",
    title: "Das Portal lädt spürbar schneller",
    summary: "Weniger Ballast beim Laden, schnellere Datenbank-Abfragen — vor allem auf dem Handy und im mobilen Netz.",
    changes: [
      "Beim Öffnen wurde bisher der komplette Verwaltungsbereich mitgeladen, den du gar nicht siehst. Das ist jetzt getrennt: rund 40 Prozent weniger Ladelast.",
      "Die Datenbank hat für die Kartei bei jeder Anfrage alle Bestellungen durchsucht. Mit den passenden Suchregistern geht das jetzt direkt.",
      "Die Verbindungen zur Datenbank laufen über einen gemeinsamen Vorrat statt über achtzehn getrennte. Das verhindert, dass unter Last Anfragen abgewiesen werden.",
      "An deinen Zahlen, Provisionen und Akten ändert das nichts — nur an der Geschwindigkeit.",
    ],
  },
  {
    id: "2026-07-27-kartei",
    date: "2026-07-27",
    category: "Neu",
    important: true,
    title: "Die Kartei: alle Kunden offen für alle",
    summary: "Es gibt keine zugeteilten Listen mehr. Alle Akten liegen in einer gemeinsamen Kartei — du nimmst dir, was du bearbeiten willst.",
    changes: [
      "Früher hat das System dir Leads zugeteilt. Damit ist Schluss: Es gibt jetzt EINE Kartei für alle.",
      "Freie Karten zeigen zuerst nur neutrale Angaben — Status, Alter, Paket, offener Betrag, Quelle, PLZ-Gebiet. Name und Nummer erscheinen erst nach der Übernahme.",
      "Bearbeitet ein Kollege eine Akte, steht das direkt auf der Karte. So ruft niemand doppelt an.",
      "Du kannst immer nur EINE Akte gleichzeitig in Bearbeitung haben — das schützt dich und die Kollegen vor Wildwuchs.",
      "Die Reihenfolge macht der Server: oben liegt, was sich am meisten lohnt. Du musst nicht suchen — arbeite von oben nach unten.",
      "Akten, die niemand anfasst, gehen nach einigen Tagen automatisch zurück in die Kartei. Du wirst vorher gewarnt.",
    ],
    howto: [
      "Öffne unten in der Leiste „Kartei“.",
      "Im Reiter „Frei“ siehst du alles, was noch niemand betreut.",
      "Tippe auf die oberste Karte — es erscheint eine Nachfrage mit allen Angaben.",
      "Bestätige mit „Übernehmen“. Danach siehst du Name und Nummer und bist zuständig.",
      "Passt die Akte doch nicht? Tippe auf „Zurückgeben“, gib kurz den Grund an — sie liegt dann wieder frei.",
    ],
    link: { href: "/agent/kartei", label: "Kartei öffnen" },
  },
  {
    id: "2026-07-27-meine-kunden",
    date: "2026-07-27",
    category: "Neu",
    title: "„Meine Kunden“: nichts verschwindet mehr",
    summary: "Alles, was du je übernommen hast, bleibt an einem Ort sichtbar — auch bezahlt, abgelaufen oder zusammengeführt.",
    changes: [
      "Die frühere Seite „Kunden“ heißt jetzt „Meine Kunden“ und zeigt deinen kompletten Bestand.",
      "Filter: Offen · Angekündigt · Bezahlt · Rückruf · Abgelaufen · Tot.",
      "Wurde eine Akte mit einer anderen zusammengeführt, steht jetzt im Klartext da, wo die Betreuung weiterläuft — statt dass der Kunde scheinbar verschwindet.",
    ],
    howto: [
      "Öffne unten „Meine Kunden“.",
      "Oben wählst du den Filter, unten suchst du über Name, Nummer oder Referenz.",
    ],
    link: { href: "/agent/kunden", label: "Meine Kunden öffnen" },
  },
  {
    id: "2026-07-27-popup-email",
    date: "2026-07-27",
    category: "Verbessert",
    important: true,
    title: "Du siehst jetzt immer, wenn eine E-Mail rausgeht",
    summary: "Vor jeder Aktion, die eine E-Mail an den Kunden auslöst, steht jetzt ausdrücklich da, wer sie bekommt und was drinsteht.",
    changes: [
      "Zwei Aktionen haben vorher OHNE jede Rückfrage eine echte Kunden-E-Mail verschickt: „Zahlungsdaten senden“ und „Antrags-/Zahlungslink senden“. Beide fragen jetzt vorher nach.",
      "Im Popup steht der Empfänger und was die E-Mail auslöst — keine Überraschungen mehr.",
      "Auch „Akte übernehmen“, „Akte zurückgeben“, „Aussortieren“ und „Auszahlung beantragen“ fragen jetzt einheitlich nach.",
      "Wo KEINE E-Mail rausgeht, steht das auch ausdrücklich — damit du dich traust zu tippen.",
    ],
    howto: [
      "Du musst nichts umstellen. Lies im Popup den Satz unter „Was passiert“ — dort steht die Folge.",
      "Mit „Abbrechen“ passiert garantiert nichts.",
    ],
  },
  {
    id: "2026-07-27-wunschgehalt",
    date: "2026-07-27",
    category: "Behoben",
    title: "Wunschgehalt: endlich realistische Zahlen",
    summary: "Die Rechnung nannte absurde Werte wie „2.812 Abschlüsse“. Ursache gefunden und behoben.",
    changes: [
      "Früher wurde dein Durchschnitt schon ab dem ERSTEN Abschluss gebildet. Ein einzelnes Starter-Paket (7,99 €) hat die ganze Rechnung verzerrt.",
      "Jetzt gilt: Erst ab fünf eigenen Abschlüssen zählt dein eigener Schnitt — vorher der Team-Durchschnitt der letzten 90 Tage.",
      "Boni und Team-Beteiligungen zählen zu deinem Verdienst, aber NICHT als Abschluss. Sie verfälschen den Schnitt nicht mehr.",
      "Ist ein Ziel rechnerisch nicht erreichbar, wird keine Fantasiezahl mehr angezeigt. Stattdessen bekommst du ein realistisches Zwischenziel vorgeschlagen.",
      "„Meine Abschlüsse“ trennt jetzt sauber: echte Abschlüsse oben, Boni klar abgesetzt darunter. Zähler und Liste widersprechen sich nicht mehr.",
    ],
    howto: [
      "Öffne „Mein Tag“ oder „Verdienst“.",
      "Tippe unter der Rechnung auf „Wie wird das gerechnet?“ — dort stehen alle Annahmen.",
    ],
    link: { href: "/agent/verdienst", label: "Verdienst ansehen" },
  },
  {
    id: "2026-07-20-auszahlung-schwellen",
    date: "2026-07-20",
    category: "Verbessert",
    title: "Auszahlung: klare Regeln, klare Schwellen",
    summary: "Wann du wie viel auszahlen lassen kannst, steht jetzt eindeutig im Vertrag und im Portal.",
    changes: [
      "Die Auszahlungsregelung im Agentenvertrag wurde präzisiert (Ziffer 6.7).",
      "Mindestbetrag und Bearbeitungszeit sind im Portal sichtbar — keine Unklarheit mehr.",
      "Beim Beantragen steht jetzt im Popup, dass zunächst nur eine Anforderung entsteht und die Überweisung nach Prüfung manuell erfolgt.",
    ],
    howto: [
      "Öffne Mehr → Auszahlung.",
      "Hinterlege zuerst deine Bankdaten im Profil, falls noch nicht geschehen.",
      "Ab dem Mindestbetrag ist der Knopf aktiv.",
    ],
    link: { href: "/agent/auszahlung", label: "Auszahlung öffnen" },
  },
  {
    id: "2026-07-20-dokumente-pdf",
    date: "2026-07-20",
    category: "Behoben",
    title: "Deine Dokumente laden zuverlässig als PDF",
    summary: "Vertrag und Provisions-Abrechnungen öffnen jetzt stabil als PDF — auch wenn im Hintergrund etwas klemmt.",
    changes: [
      "Die PDF-Erzeugung wurde doppelt abgesichert: Es entsteht immer ein gültiges PDF.",
      "Betrifft deinen Vertrag und deine Provisions-Abrechnungen unter „Meine Dokumente“.",
    ],
    howto: [
      "Öffne Mehr → Meine Dokumente.",
      "Tippe bei einem Eintrag auf „PDF“ — das Dokument öffnet sich in einem neuen Tab.",
      "Von dort kannst du es speichern oder ausdrucken.",
    ],
    link: { href: "/agent/dokumente", label: "Meine Dokumente öffnen" },
  },
  {
    id: "2026-07-20-onboarding-vertrag",
    date: "2026-07-20",
    category: "Neu",
    title: "Start-Ablauf: Zustimmung + digitaler Vertrag",
    summary: "Beim ersten Login bestätigst du kurz drei Hinweise und unterschreibst deinen Vertrag digital — danach ist dein Portal freigeschaltet.",
    changes: [
      "Drei kurze Zustimmungen: Datenschutz, Verhalten/Seriosität und Nutzungsbedingungen.",
      "Danach liest und unterschreibst du deinen Handelsvertretervertrag direkt im Portal.",
      "Alle Dokumente sind danach jederzeit als PDF abrufbar.",
      "Bei jeder Auszahlung entsteht automatisch eine Provisions-Abrechnung für dich.",
    ],
    howto: [
      "Nach dem Login erscheint der Ablauf automatisch — er lässt sich nicht überspringen.",
      "Klappe jeden der drei Hinweise auf, lies ihn und setze das Häkchen.",
      "Lies den Vertrag bis zum Ende (nach unten scrollen).",
      "Unterschreibe mit dem Finger bzw. der Maus — oder tippe deinen vollständigen Namen.",
      "Bestätige zum Schluss. Dein Portal ist ab sofort frei.",
      "Deine Unterlagen findest du danach unter Mehr → Meine Dokumente.",
    ],
    link: { href: "/agent/dokumente", label: "Meine Dokumente" },
  },
  {
    id: "2026-07-20-bestaetigung",
    date: "2026-07-20",
    category: "Verbessert",
    title: "Klare Bestätigung statt doppeltem Tippen",
    summary: "Wichtige Aktionen fragen jetzt in einem deutlichen Popup nach — kein verstecktes zweites Tippen mehr.",
    changes: [
      "Neuer Bestätigungsdialog mit Titel, Name und Hinweis auf Folgen (z. B. „Der Kunde erhält eine E-Mail“).",
      "Den Rückruf-Termin wählst du direkt im Dialog (Datum + Uhrzeit).",
      "Optimiert fürs Handy: große Tippflächen, mit „Abbrechen“ jederzeit zurück.",
    ],
    howto: [
      "Tippe wie gewohnt auf ein Kontakt-Ergebnis (z. B. „Erreicht“ oder „Nicht erreicht“).",
      "Es öffnet sich ein Popup — prüfe kurz die Angaben.",
      "Bei „Rückruf“ wählst du Datum und Uhrzeit direkt im Popup (deutsche Zeit).",
      "Tippe „Bestätigen“ — oder „Abbrechen“, falls du dich vertippt hast.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-19-kalender",
    date: "2026-07-19",
    category: "Neu",
    title: "Kalender mit Tagesdetail",
    summary: "Deine Rückrufe und Termine übersichtlich im Monat — mit Detailansicht pro Tag.",
    changes: [
      "Der Kalender zeigt deine vereinbarten Rückrufe und Termine im Monatsüberblick.",
      "Ein Tap auf einen Tag öffnet alle Vorgänge dieses Tages.",
      "Überfällige Rückrufe sind deutlich hervorgehoben.",
    ],
    howto: [
      "Öffne unten „Kalender“.",
      "Tippe auf einen markierten Tag — die Vorgänge erscheinen darunter.",
      "Von dort kommst du direkt in die Kundenakte.",
    ],
    link: { href: "/agent/kalender", label: "Kalender öffnen" },
  },
  {
    id: "2026-07-19-nummer-falsch",
    date: "2026-07-19",
    category: "Neu",
    title: "Falsche Telefonnummer schnell korrigieren",
    summary: "Stimmt die Nummer eines Kunden nicht, löst du eine Korrektur aus — der Kunde bekommt eine E-Mail und aktualisiert sie selbst.",
    changes: [
      "Neue Strecke „Nummer aktualisieren“: Der Kunde korrigiert seine Nummer über einen Link selbst.",
      "Der E-Mail-Versand dahinter wurde vollständig geprüft und kundenfertig gemacht.",
    ],
    howto: [
      "Öffne die Kundenakte des betroffenen Kunden.",
      "Wähle beim Kontakt-Ergebnis „Nummer falsch“.",
      "Bestätige im Popup — der Kunde erhält automatisch eine E-Mail mit Korrektur-Link.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-16-berlin-zeit",
    date: "2026-07-16",
    category: "Verbessert",
    title: "Alle Zeiten in deutscher Zeit (Berlin)",
    summary: "Termine, Rückrufe und Verlauf zeigen überall einheitlich die deutsche Uhrzeit.",
    changes: [
      "Die Zeitzone ist durchgängig auf Deutschland (Europe/Berlin) umgestellt.",
      "Betrifft Kalender, Rückruf-Termine und den Verlauf in der Kundenakte.",
    ],
    howto: [
      "Du musst nichts umstellen — deine Zeiten stimmen jetzt automatisch.",
      "Beim Anlegen eines Rückrufs steht der Hinweis „deutsche Zeit“ direkt am Feld.",
    ],
    link: { href: "/agent/kalender", label: "Zum Kalender" },
  },
  {
    id: "2026-07-16-tickets-13-16",
    date: "2026-07-16",
    category: "Verbessert",
    title: "Nummernsuche, Reaktivieren & Aussortieren",
    summary: "Mehrere Verbesserungen aus eurem Feedback: nach Telefonnummer suchen, Kunden reaktivieren und Akten sauber aussortieren.",
    changes: [
      "Die Suche findet Kunden jetzt auch über die Telefonnummer (auch einzelne Ziffernfolgen).",
      "Abgelaufene oder inaktive Kunden lassen sich reaktivieren.",
      "Eine Akte ohne Ergebnis kannst du mit kurzer Pflicht-Begründung schließen (aussortieren).",
    ],
    howto: [
      "Suche: Gib oben Ziffern der Rufnummer ein — passende Kunden erscheinen sofort.",
      "Reaktivieren: In der Akte auf „Reaktivieren“ tippen und im Popup bestätigen.",
      "Aussortieren: „Akte schließen“ wählen und im Popup kurz den Grund angeben.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-07-16-soft-merge",
    date: "2026-07-16",
    category: "Hintergrund",
    title: "Nichts wird gelöscht — nur zusammengeführt",
    summary: "Doppelte Datensätze werden zusammengeführt statt gelöscht. Deine Historie bleibt vollständig erhalten.",
    changes: [
      "„Soft-Merge“ statt Löschen: Verläufe und Zuordnungen bleiben nachweisbar bestehen.",
      "Das passiert in der Verwaltung — an deiner Bedienung ändert sich nichts.",
    ],
    howto: [
      "Du musst nichts tun. Ein früher doppelter Kunde erscheint künftig nur noch einmal — mit vollständiger Historie.",
    ],
  },
  {
    id: "2026-07-16-ki-cockpit",
    date: "2026-07-16",
    category: "Hintergrund",
    title: "Internes KI-Werkzeug modernisiert",
    summary: "Ein internes Werkzeug der Verwaltung wurde überarbeitet. Für dein Portal ändert sich nichts.",
    changes: [
      "Redesign des internen KI-Bereichs (nur Verwaltung).",
      "Keine Auswirkung auf deine tägliche Arbeit — hier nur zur Transparenz.",
    ],
  },
  {
    id: "2026-07-15-eine-wahrheit",
    date: "2026-07-15",
    category: "Verbessert",
    title: "Provision & Zahlen: eine verlässliche Quelle",
    summary: "Deine Provisionszahlen kommen aus einer einzigen, geprüften Berechnung — überall gleich.",
    changes: [
      "Provision entsteht nur bei aktiver Betreuung (mit fairem Stichtag).",
      "Der Abgleich bezahlter Bestellungen mit den Kontoeingängen wurde verbessert.",
      "Die Zahlen in „Verdienst“ und in deiner Abrechnung stimmen jetzt überein.",
    ],
    howto: [
      "Deine aktuellen Zahlen siehst du jederzeit unter „Verdienst“.",
      "Details zu Auszahlungen findest du als Abrechnungs-PDF unter Mehr → Meine Dokumente.",
    ],
    link: { href: "/agent/verdienst", label: "Zu meinem Verdienst" },
  },
  {
    id: "2026-07-15-lifecycle",
    date: "2026-07-15",
    category: "Verbessert",
    title: "Abgelaufene Kunden verschwinden nicht mehr",
    summary: "Kunden mit abgelaufener Frist bleiben sichtbar, statt aus deiner Liste zu fallen — du verlierst niemanden aus dem Blick.",
    changes: [
      "Einheitlicher Kunden-Lebenszyklus mit klaren Status.",
      "Abgelaufene Kunden bleiben in deiner Liste (mit eigenem Status).",
    ],
    howto: [
      "In deiner Kundenliste kannst du nach Status filtern und abgelaufene Kunden gezielt reaktivieren.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
];

// ── „Gesehen"-Status (rein lokal, kein Server nötig) ─────────────────────────
const SEEN_KEY = "fiaon-agent-updates-seen";

export function latestUpdateId(): string {
  return AGENT_UPDATES[0]?.id ?? "";
}

/** Anzahl Updates, die neuer sind als das zuletzt gesehene. */
export function getUnseenCount(): number {
  try {
    const seen = localStorage.getItem(SEEN_KEY);
    if (!seen) return AGENT_UPDATES.length;
    const idx = AGENT_UPDATES.findIndex((u) => u.id === seen);
    return idx < 0 ? AGENT_UPDATES.length : idx; // alles vor dem gesehenen Eintrag ist neu
  } catch {
    return 0;
  }
}

// ── Einmaliger Hinweis für WICHTIGE Updates ───────────────────────────
const IMPORTANT_KEY = "fiaon-agent-updates-important-seen";

/**
 * Wichtige Updates, die dieser Agent noch nie bestätigt hat. Absichtlich über
 * eine eigene ID-Liste (nicht über den Index), damit ein später ergänzter
 * älterer Eintrag nicht versehentlich erneut auftaucht.
 */
export function getUnseenImportant(): AgentUpdate[] {
  try {
    const raw = localStorage.getItem(IMPORTANT_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    return AGENT_UPDATES.filter((u) => u.important && !seen.includes(u.id));
  } catch {
    return [];
  }
}

/** Bestätigt die wichtigen Hinweise — sie erscheinen danach nie wieder. */
export function markImportantSeen(ids: string[]): void {
  try {
    const raw = localStorage.getItem(IMPORTANT_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    const merged = seen.concat(ids.filter((id) => !seen.includes(id)));
    localStorage.setItem(IMPORTANT_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage evtl. gesperrt — dann erscheint der Hinweis erneut, kein Schaden */
  }
  window.dispatchEvent(new CustomEvent("agent-updates-seen"));
}

/** Markiert alle aktuellen Updates als gesehen und benachrichtigt Banner/Badge. */
export function markUpdatesSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, latestUpdateId());
  } catch {
    /* localStorage evtl. gesperrt — kein Problem */
  }
  window.dispatchEvent(new CustomEvent("agent-updates-seen"));
}

export function fmtUpdateDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return iso;
  }
}
