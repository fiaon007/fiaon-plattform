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
    link: { href: "/agent/meine-kunden", label: "Meine Kunden öffnen" },
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
    link: { href: "/agent/meine-kunden", label: "Zu meinen Kunden" },
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
    link: { href: "/agent/meine-kunden", label: "Zu meinen Kunden" },
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
    link: { href: "/agent/meine-kunden", label: "Zu meinen Kunden" },
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
    link: { href: "/agent/meine-kunden", label: "Zu meinen Kunden" },
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
