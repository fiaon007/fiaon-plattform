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
//
// ============================================================================
// DAS DATUM WIRD GELESEN, NICHT WEITERGEZÄHLT (19.08.2026)
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// Diese Datei enthielt Einträge „Was am 30. und 31.08.2026 dazugekommen ist" —
// an einem 19.08.2026. Achtzehn Einträge lagen in der Zukunft, der vorderste
// zwölf Tage.
//
// ── DIE URSACHE, GEMESSEN (scripts/mess-update-daten.ts) ───────────────────
// Nicht die Systemuhr: Sie liefert den 19.08.2026, und der jüngste Commit im
// Repo trägt dasselbe Datum — beide kommen aus derselben Quelle. Auch kein
// Tippfehler: Der Versatz war nicht zufällig, sondern wuchs MONOTON.
//
//     Eintrag                       eingetragen   Commit       Versatz
//     2026-08-17-betrieb            17.08.        17.08.        0 Tage
//     2026-08-18-kundenweg          18.08.        17.08.       +1 Tag
//     2026-08-19-kundensicht        19.08.        17.08.       +2 Tage
//     2026-08-20-ablauf             20.08.        17.08.       +3 Tage
//     …
//     2026-08-31-richtiges-paket    31.08.        19.08.      +12 Tage
//
// Das ist die Signatur einer Gewohnheit: Jede Sitzung hat auf den obersten
// Eintrag gesehen und EINEN TAG DAZUGEZÄHLT, statt das Datum der Umgebung zu
// lesen. Am 17. und 18.08. liefen je mehrere Sitzungen — jede zählte weiter,
// und so wurde aus einem Tag Vorsprung ein knapper Monat.
//
// ── DIE KORREKTUR ──────────────────────────────────────────────────────────
// Alle 21 betroffenen `date`-Felder stehen jetzt auf dem Datum des Commits, der
// sie eingeführt hat. Dass mehrere Einträge denselben Tag tragen, ist richtig:
// An einem Tag liefen wirklich mehrere Sitzungen.
//
// ── WARUM DIE `id` IHR ALTES DATUM BEHÄLT ──────────────────────────────────
// Die `id` ist der stabile Schlüssel für den „gesehen"-Stand im Browser des
// Agenten (`getUnseenCount` sucht sie). Wer sie ändert, macht bei jedem
// Menschen alle Einträge wieder ungelesen. Sie ist ein SCHLÜSSEL, kein Datum —
// wer ein Datum braucht, nimmt `date`. Aus einer `id` eines Datum ableiten wäre
// derselbe Fehler wie oben, nur eine Ebene tiefer.
//
// ── DIE WAND ───────────────────────────────────────────────────────────────
// `scripts/pruef-daten-zukunft.ts` prüft ab jetzt, dass hier und im
// CHANGELOG.md kein Datum in der Zukunft liegt — gemessen gegen die ZEIT DER
// DATENBANK, nicht gegen die lokale Uhr. Eine Regel, die man sich merken muss,
// hat man schon vergessen.
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
    id: "2026-08-19-neun-punkte",
    date: "2026-08-19",
    category: "Behoben",
    title: "Neun Meldungen aus Vertrieb und Onboarding — was jetzt anders ist",
    summary:
      "Der tote Knopf „Erreicht – Sonstiges“ geht wieder. Anträge, die fertig "
      + "sind, gelten als fertig. Und wo etwas nicht klappt, steht ab jetzt "
      + "warum — statt einer leeren Fläche.",
    changes: [
      "„ERREICHT – SONSTIGES“ ÖFFNET JETZT DAS NOTIZFELD. Es war dreimal "
      + "gemeldet, und dreimal zu Recht: Der Klick setzte im Hintergrund einen "
      + "Zustand, für den es kein Feld gab. Es ging also nicht einmal eine "
      + "Anfrage raus — deshalb kam auch keine Fehlermeldung. Jetzt klappt "
      + "direkt ein Textfeld auf, mit Zeichenzähler und vier antippbaren "
      + "Vorlagen: „Rückzahlung erwartet“, „intern weitergegeben“, „überlegt "
      + "noch“, „individuelle Absprache“. Ab 10 Zeichen wird gespeichert.",

      "WARUM ES DREIMAL PASSIERT IST: Die Liste der Ergebnisse stand an fünf "
      + "Stellen im Programm. Der Fix von letzter Woche landete in einer Datei, "
      + "die keine Seite mehr lädt — und wurde beim Aufräumen mitgelöscht. "
      + "Jetzt gibt es die Liste EINMAL und ein Bauteil, das alle Seiten "
      + "benutzen. Ein neues Ergebnis ist eine Zeile, nicht fünf.",

      "„ANTRAG STEHT NOCH IM FORMULAR“ BEI FERTIGEN ANTRÄGEN: GEMESSEN — 35 "
      + "Anträge waren komplett ausgefüllt (alle Zustimmungen, E-Mail, "
      + "Gehaltstag) und wurden trotzdem blockiert. Ursache war ein Zählfehler "
      + "im Antragsformular: Der LETZTE Schritt schrieb den ERSTEN Status "
      + "zurück. Alle 35 sind korrigiert und rechnungsreif — bei jedem von "
      + "euch. Behoben ist auch die Ursache.",

      "UND DIE KARTE SAGT JETZT, WAS FEHLT. Statt „ruf an und hilf beim "
      + "Fertigstellen“ steht dort „Es fehlt: Geburtsdatum, IBAN“ — namentlich, "
      + "mit einem Knopf „Fehlendes am Telefon ergänzen“. Kein Rätselraten mehr.",

      "„RECHNUNG STELLEN & SENDEN“: Der Dialog schloss sich vorher SOFORT — "
      + "auch wenn der Versand scheiterte. Jetzt bleibt er offen und zeigt den "
      + "Grund in Rot. Klappt es, steht der Vorgang sofort im Verlauf der "
      + "Karte, mit der Adresse. Du siehst also immer, was passiert ist. "
      + "(Eine Mail wurde intern sogar als Erfolg gemeldet, ohne dass sie raus "
      + "war — das ist behoben.)",

      "KUNDEN, DIE NIEMAND ERREICHT, RUHEN JETZT. GEMESSEN: 26 Menschen mit "
      + "9 bis 20 erfolglosen Anrufen standen weiter in den Tageslisten. Neue "
      + "Staffel: ab dem 3. Versuch Wiedervorlage +3 Tage, ab dem 6. +7 Tage "
      + "und Terminlink-Mail, ab dem 9. „Ruhend“ — raus aus der Liste, "
      + "sichtbar im Filter „Ruhend“. Bucht der Kunde selbst einen Termin oder "
      + "meldet er sich, ist er sofort wieder oben. 228 Wiedervorlagen wurden "
      + "gestreckt: Deine Liste ist heute kürzer und enthält mehr Menschen, mit "
      + "denen ein Gespräch möglich ist.",

      "TERMINE ZEIGEN, WER ZUSTÄNDIG IST. Auf der Startseite steht an jedem "
      + "Termin eine Marke: „Onboarding“ (der Kunde hat bezahlt und wird "
      + "freigeschaltet), „Vertrieb“ (noch nicht bezahlt, beraten) oder "
      + "„Rückruf“ (selbst notiert). Bisher gab es die Marke überall — nur "
      + "nicht in der Leiste, die du den ganzen Tag offen hast.",

      "VERTRIEBSLEITUNG: KEINE LEEREN FLÄCHEN MEHR. Die Kundenakte zeigte ein "
      + "leeres Fenster, wenn eine Abfrage scheiterte — ohne ein Wort. Jetzt "
      + "steht dort eine Karte mit dem Grund und „Neu laden“. Dasselbe für die "
      + "ganze Seite: Lädt etwas nicht, sagt sie es, statt endlos graue Balken "
      + "zu zeigen.",

      "ONBOARDING — „GESPRÄCH FÜHREN“ STEHT JETZT AUF DER KARTE. Vorher lag "
      + "der Knopf zwei Klicks tief: Man musste erst den Kundennamen anklicken. "
      + "Sichtbar war nur „Anrufen“ — und das war ein Telefon-Link, der am "
      + "Rechner nichts tut. Jetzt: „Gespräch führen“ als Hauptknopf, und "
      + "„Anrufen“ öffnet das FIAON-Telefon.",

      "ONBOARDING — NOTIZEN BLEIBEN. Sie ließen sich vorher nur zusammen mit "
      + "einem Ergebnis speichern, landeten am Termin statt am Kunden, und der "
      + "nächste Klick setzte sie auf leer. Jetzt: eigener Knopf „Notiz "
      + "speichern“, Ablage im Verlauf des KUNDEN, sofort sichtbar.",

      "ONBOARDING — ERLEDIGTE VERSCHWINDEN. Zwei Reiter mit Zählern: „Offen“ "
      + "und „Erledigt“. Abgeschlossene Gespräche tragen ein grünes Häkchen mit "
      + "Uhrzeit und stehen nicht mehr zwischen den offenen.",
    ],
    howto: [
      "Erreicht – Sonstiges: Kundenkarte öffnen → „Erreicht – Sonstiges“ → das "
      + "Feld klappt auf. Vorlage antippen oder frei tippen, ab 10 Zeichen wird "
      + "der Knopf frei. Der Zähler sagt, wie viele Zeichen noch fehlen.",
      "Antrag unvollständig: Steht am gesperrten Sende-Knopf „Es fehlt: …“, "
      + "frag genau diese Angaben am Telefon ab und trag sie über „Fehlendes am "
      + "Telefon ergänzen“ nach. Danach ist der Knopf frei.",
      "Ruhende Kunden ansehen: In der Kundenliste auf den Filter „Ruhend“. "
      + "Dort stehen die, die neunmal nicht erreichbar waren — sie sind nicht "
      + "verloren, nur nicht mehr im Weg.",
      "Onboarding: Startgespräche öffnen → beim Termin „Gespräch führen“ → die "
      + "7 Schritte durchgehen und je Schritt notieren → „Gespräch abschließen "
      + "& freischalten“.",
    ],
    important: true,
  },
  {
    id: "2026-08-19-anrufgrenze-warnt",
    date: "2026-08-19",
    category: "Behoben",
    title: "Die Anrufgrenze blockiert nicht mehr — sie warnt nur noch",
    summary:
      "Heute Mittag ging bei Lucas und Nikita das Wählen nicht mehr. Das war "
      + "kein Fehler in der Technik, sondern eine Grenze, die zu niedrig stand. "
      + "Sie sperrt ab jetzt nichts mehr.",
    changes: [
      "WAS PASSIERT IST: Es gab eine Tagesgrenze von 100 Anrufen je Rufnummer. "
      + "Wer sie erreichte, konnte nicht mehr wählen. GEMESSEN: Zwischen 13:18 "
      + "und 15:14 Uhr hat sie 26 Anrufe verhindert — 18 bei Lucas, 8 bei "
      + "Nikita. 9 Kunden waren in dieser Zeit nicht erreichbar.",

      "WARUM DIE ZAHL FALSCH WAR: Im Code stand „100 Anrufe am Tag erreicht "
      + "niemand“. Das war geschätzt, nicht gemessen. Nachgezählt über 14 Tage: "
      + "bis zu 252 Anrufe an einem Tag über eine Nummer, Spitze bei einem "
      + "einzelnen Menschen 117 (Lucas am 17.08.). Die Grenze lag also unter "
      + "dem, was ihr normal telefoniert.",

      "WAS JETZT GILT: Die Grenze sperrt NIE mehr einen Anruf. Ab 300 Anrufen "
      + "über eine Nummer steht ein grauer Satz im Telefon-Panel („Heute bereits "
      + "N Anrufe über diese Nummer“) — und dabei steht ausdrücklich, dass ihr "
      + "normal weiterarbeiten könnt. Ab 450 bekommt die Verwaltung eine "
      + "Warnung, damit sie eine zweite Rufnummer einrichten kann. Euch betrifft "
      + "das nicht.",

      "WARUM ES DIESE ZAHL ÜBERHAUPT GIBT: Sehr viele Anrufe von einer Nummer "
      + "können beim Netzbetreiber eine Spam-Markierung auslösen — danach "
      + "klingelt die Nummer bei niemandem mehr durch. Das ist ein echtes "
      + "Risiko. Aber es rechtfertigt nicht, dass ihr aufhören müsst zu "
      + "arbeiten.",

      "DASSELBE BEIM MAILVERSAND: Der vierte Versand derselben Mail an einen "
      + "Kunden am selben Tag wurde bisher abgelehnt. Jetzt geht er raus, und du "
      + "liest daneben, dass es der vierte ist. Was weiterhin gesperrt bleibt, "
      + "ist nur, was gesperrt sein MUSS: keine Adresse, Kontaktsperre des "
      + "Kunden, DSGVO-Löschung, schon bezahlt.",

      "NEUE HAUSREGEL: Ein Schutzmechanismus warnt die Verwaltung, er hält "
      + "eure Arbeit nicht an. Wenn dich noch irgendwo eine Zahl am Arbeiten "
      + "hindert, ist das ein Fehler — melde ihn.",
    ],
    howto: [
      "Telefon öffnen und wählen wie immer. Wenn ein grauer Satz über dem "
      + "Wählfeld steht, ist das eine Information — kein Stopp.",
      "Zahlungsdaten senden: Steht „Das wäre die 4. Sendung heute“, geht sie "
      + "trotzdem raus. Überleg nur kurz, ob ein Anruf nicht besser wäre.",
    ],
    important: true,
  },
  {
    id: "2026-08-19-anruf-player",
    date: "2026-08-19",
    category: "Verbessert",
    title: "Aufnahmen: Fortschritt, Tempo 1,5×/2× und Herunterladen",
    summary:
      "Der Abspieler für Gesprächsaufnahmen ist überall derselbe und kann "
      + "jetzt etwas.",
    changes: [
      "An allen vier Stellen, an denen Aufnahmen laufen (Mitarbeiter-Profil, "
      + "Kundenakte, Forderungsmanagement), steht jetzt derselbe Abspieler.",
      "NEU: Fortschrittsbalken zum Springen, Zeitanzeige, und Tempo 1× / 1,5× / "
      + "2× — wer zwanzig Gespräche nachhört, spart damit eine Stunde.",
      "NEU: Herunterladen als MP3. Der Dateiname trägt Kunde und Datum "
      + "(mueller_2026-08-19.mp3), damit man die Datei später wiederfindet.",
      "WICHTIG: Sowohl das Anhören ALS AUCH das Herunterladen steht im "
      + "Kundenverlauf — mit deinem Namen. Das ist Absicht: Es sind Aufnahmen "
      + "echter Gespräche mit echten Menschen.",
    ],
    howto: [
      "Gespräche-Liste → „Anhören“ an der Zeile → der Abspieler klappt auf.",
      "Das Feld mit „1×“ schaltet auf 1,5× und 2× durch.",
      "Der Pfeil nach unten lädt die Aufnahme herunter.",
    ],
  },
  {
    id: "2026-08-19-leeres-portal",
    date: "2026-08-19",
    category: "Behoben",
    title: "Warum euer Portal heute leer war — und warum bei Daniel „Vertrieb“ fehlte",
    summary:
      "Ein einziger Fehler in einer Datenbankabfrage hat heute Mittag die ganze "
      + "Startseite abgeschaltet. Ihr habt es gemeldet, es lag nicht an euch.",
    changes: [
      "WAS IHR GESEHEN HABT: „Verdienst konnte nicht geladen werden“, 0,00 €, "
      + "„Bankdaten fehlen“ (obwohl die IBAN drin steht) und 0 Kunden. Bei Daniel "
      + "war zusätzlich der Menüpunkt „Vertrieb“ verschwunden.",

      "DIE URSACHE: In der Abfrage, die eure Startseite füllt, fehlte ein einziges "
      + "Kürzel für eine Tabelle. Die Datenbank hat die Abfrage abgelehnt, der "
      + "Server hat mit einem Fehler geantwortet — und die Seite hat daraus 0,00 € "
      + "gemacht. Der Fehler kam heute um 11:42 rein und ist jetzt behoben.",

      "WARUM DER MENÜPUNKT MITGING: Eure Rolle kommt aus derselben Antwort. Kam "
      + "keine Antwort, galt jeder als „agent“ — und „Vertrieb“ sehen nur "
      + "Vertriebsleiter. Die Rolle hat jetzt einen zweiten Weg: Fällt die "
      + "Startseite aus, bleibt das Menü trotzdem richtig.",

      "UND: 0,00 € STEHT NICHT MEHR DA, WENN WIR ES NICHT WISSEN. Statt einer "
      + "erfundenen Null seht ihr einen Strich, den GRUND im Klartext und einen "
      + "Knopf „Noch einmal versuchen“. Ein Betrag, der falsch ist, ist schlimmer "
      + "als ein Betrag, der fehlt.",

      "ZUM VERGLEICH, was wirklich dastand: Daniel hatte in diesem Moment "
      + "734,50 € Guthaben, 1.351,80 € diesen Monat und 1.012 offene Kunden.",
    ],
    howto: [
      "Startseite öffnen. Wenn dort ein oranger Kasten steht, sagt er, was los "
      + "ist — und der Knopf daneben versucht es neu.",
      "Vertriebsleitung: Der Punkt „Vertrieb“ ist wieder im Menü. Wenn er einmal "
      + "fehlt, melde es sofort — das heißt, dass eine Antwort ausgefallen ist.",
    ],
    important: true,
  },
  {
    id: "2026-08-19-betrag-und-empfaenger",
    date: "2026-08-19",
    category: "Behoben",
    title: "„0,80 €“ im Bestätigungsfenster — und der Kunde, dessen E-Mail nicht gefunden wurde",
    summary:
      "Zwei Fehler im Fenster „Das bekommt …“, das es seit gestern gibt. Beide "
      + "betreffen Geld beziehungsweise den Versand — beide sind weg.",
    changes: [
      "DER BETRAG WAR UM DEN FAKTOR 100 FALSCH. Im Fenster stand „FIAON Ultra "
      + "0,80 €“ statt 79,99 €, bei High End „1,00 €“ statt 99,99 €. Das war ein "
      + "Rechenfehler in der ANZEIGE — in der Datenbank standen immer die "
      + "richtigen Beträge, und jede Mail an einen Kunden trug ebenfalls den "
      + "richtigen. Wir haben 4.132 Zahlungsmails der letzten 30 Tage geprüft: "
      + "keine einzige mit einem falschen Betrag.",

      "NEU: EINE WARNMARKE AM BETRAG. Weicht der Betrag einer Bestellung vom "
      + "Katalogpreis ab, steht es jetzt im Fenster: „Ungewöhnlicher Betrag — "
      + "Katalogpreis wäre 79,99 €“. Dann bitte nachsehen, bevor der Kunde "
      + "überweist.",

      "DIE E-MAIL WURDE IM FENSTER NICHT GEFUNDEN. Bei Kunden, deren Adresse nur "
      + "in den Stammdaten steht (nicht an der Bestellung), sagte das Fenster "
      + "„Für diesen Kunden ist keine E-Mail-Adresse hinterlegt“ — während in der "
      + "Akte eine steht. Beweisfall Joachim Rechtsteiner: Das Fenster zeigt jetzt "
      + "euro-tec@t-online.de und sagt dazu, dass sie aus den Stammdaten kommt.",

      "OHNE ADRESSE IST „SENDEN“ JETZT SICHTBAR GESPERRT — grau statt blassblau. "
      + "Vorher sah der Knopf aus, als ginge er, und ein Klick hätte einen "
      + "Serverfehler erzeugt. Und direkt daneben steht ein Feld, in das ihr die "
      + "Adresse eintragen könnt; sie wird in der Akte gespeichert, danach geht "
      + "die Mail sofort raus.",

      "PREISE KOMMEN NUR NOCH AUS DEM KATALOG. In der Akte ließ sich der Betrag "
      + "früher frei eintippen, und ein Paketwechsel ließ den alten Betrag stehen "
      + "(dann hatte ein High-End-Kunde 59,99 € offen). Beides geht nicht mehr: "
      + "Der Betrag folgt dem Paket. Zwei Bonitätsauskünfte, die 99,99 € statt "
      + "74,00 € offen hatten, sind korrigiert.",
    ],
    howto: [
      "Kundenkarte → „Zahlungsdaten senden“ → das Fenster lesen, BEVOR ihr "
      + "bestätigt: Paket, Betrag, Verwendungszweck, Empfänger.",
      "Steht eine orange Marke am Betrag: nicht senden, sondern das Paket in der "
      + "Akte prüfen.",
      "Steht „keine Adresse“: das Feld im Fenster benutzen — kein Seitenwechsel "
      + "nötig.",
    ],
    important: true,
  },
  {
    id: "2026-08-19-knopf-geht-wieder",
    date: "2026-08-19",
    category: "Behoben",
    title: "„Ich kann keine Rechnung schicken“ — 91 Kunden mehr, die du erreichst",
    summary:
      "Florentine hat gemeldet, dass über 11 Kunden auf ihre Rechnung warten und "
      + "nichts rausgeht. Sie hatte recht, und es waren mehr als 11.",
    changes: [
      "WAS LOS WAR: Bei 139 Kunden in Florentines Liste sah die Karte so aus, als "
      + "ginge „Zahlungsdaten senden“ — und der Server hat trotzdem abgelehnt. Du "
      + "dr\u00fcckst, und nichts passiert. Zwei Gr\u00fcnde:",

      "1. DIE E-MAIL WURDE NICHT GEFUNDEN. Bei 21 Kunden stand die Adresse in den "
      + "Stammdaten, aber nicht an der Bestellung — und der Server hat nur an der "
      + "Bestellung nachgesehen. Er nimmt jetzt beide.",

      "2. DER ANTRAG GALT ALS UNFERTIG. Bei 63 Kunden stand der Antrag auf "
      + "„Zahlung ausstehend“ — also genau an der Stelle, wo eine Rechnung "
      + "hingeh\u00f6rt. Das System hat diesen Stand nicht als rechnungsreif gez\u00e4hlt "
      + "und geantwortet, der Antrag sei noch nicht fertig. Die \u00e4ltesten dieser "
      + "Kunden warten seit dem 2. Juli.",

      "DAS ERGEBNIS: Bei Florentine sind statt 154 jetzt 245 Kunden sendbar. Im "
      + "ganzen Bestand 911. Wenn bei dir Kunden lagen, bei denen der Knopf "
      + "„nichts getan“ hat — probier es noch einmal.",

      "UND DIE KARTE R\u00c4T NICHT MEHR: Ob gesendet werden kann, sagt jetzt der "
      + "Server, bei jedem \u00d6ffnen frisch. Steht ein Grund da, stimmt er auch — "
      + "vorher konnte die Karte etwas freigeben, das der Server ablehnt.",

      "STARTGESPR\u00c4CHE: Ein Kunde hat angerufen, weil er im Kalender keine Zeit "
      + "w\u00e4hlen konnte. Im Protokoll standen 38 Versuche von ihm, alle abgelehnt. "
      + "Die Seite bot Zeiten an, die Buchung wies sie ab. Behoben. Wenn ein Kunde "
      + "dir sagt, der Terminlink gehe nicht: Er hat wahrscheinlich recht gehabt.",
    ],
    howto: [
      "Kundenkarte → wenn „Zahlungsdaten senden“ da ist, geht es auch. Wenn ein "
      + "Grund dasteht, ist er echt (keine Adresse, keine Bestellung, alles "
      + "bezahlt oder Antrag noch im Formular).",
      "Steht „Der Antrag steht noch im Formular“: Da hilft ein Anruf, keine "
      + "Rechnung — der Kunde ist mitten in der Strecke stecken geblieben.",
      "Terminlink f\u00fcr ein Startgespr\u00e4ch: Der Kunde sieht jetzt 15 Minuten und "
      + "eine Onboarding-Kraft. Klappt eine Buchung nicht, steht der Grund auf der "
      + "Seite und die anderen Zeiten bleiben w\u00e4hlbar.",
    ],
    important: true,
  },
  {
    id: "2026-08-31-richtiges-paket",
    date: "2026-08-19",
    category: "Behoben",
    title: "Warum eure Rechnung jetzt immer das richtige Paket trägt",
    summary:
      "Florentine hat gemeldet, dass ein Kunde eine High-End-Rechnung bekam, "
      + "obwohl sie das Paket rausgenommen und Pro eingetragen hatte. Sie hatte "
      + "recht — und es lag nicht an ihr.",
    changes: [
      "WAS PASSIERT IST: Wenn du ein Paket rausnimmst, wird die Bestellung "
      + "archiviert. Beim Senden der Zahlungsdaten hat das System die archivierte "
      + "Bestellung trotzdem noch mitgezählt — und weil sie oft die zuletzt "
      + "angelegte war, gewann sie. Der Kunde bekam Betrag und Verwendungszweck "
      + "des Pakets, das gar nicht mehr gilt.",

      "WARUM DAS SCHLIMM WAR: Der Kunde überweist dann den falschen Betrag mit "
      + "dem falschen Verwendungszweck. Der Kontoabgleich findet das Geld nicht, "
      + "die Abo-Rate entsteht auf dem falschen Preis — und die Provision auch. "
      + "Betroffen waren 8 Mails in 14 Tagen, fünf davon an denselben Kunden.",

      "NEU: DU SIEHST VORHER, WAS RAUSGEHT. „Zahlungsdaten senden“ öffnet jetzt "
      + "ein kurzes Fenster mit Paket, Betrag, Verwendungszweck und "
      + "Empfängeradresse. Erst der zweite Klick sendet. Wenn ein Kunde mehrere "
      + "offene Buchungen hat, steht das ausdrücklich da: „2 offene Buchungen — "
      + "gesendet wird die neueste: Pro 59,99 €.“",

      "UND WENN DU GERADE GETAUSCHT HAST: Der Server prüft die Bestellung noch "
      + "einmal, bevor er sendet. Zeigt deine Karte noch das alte Paket, wird der "
      + "Versand ABGELEHNT mit dem Hinweis, was jetzt gilt — statt die falsche "
      + "Mail rauszuschicken. Lade dann die Seite neu und sende erneut.",

      "FALSCHE L\u00c4NDERVORWAHL BEHOBEN: Bei 18 Kunden aus \u00d6sterreich, der "
      + "Schweiz, Rum\u00e4nien und der Slowakei wurde die Nummer als DEUTSCHE "
      + "gew\u00e4hlt — da klingelte es bei einem Fremden. Das Land stand die ganze "
      + "Zeit in der Akte, es wurde nur nicht gelesen. Diese 18 sind ohne dein "
      + "Zutun wieder richtig anrufbar.",

      "NEUER FILTER „NUMMER NICHT W\u00c4HLBAR“: Bleibt eine Nummer \u00fcbrig, bei der "
      + "das System nicht wei\u00df, wohin sie geh\u00f6rt, steht sie in diesem Filter — "
      + "aktuell genau eine. Dort erg\u00e4nzt du das Land direkt an der Karte: "
      + "ausw\u00e4hlen, Vorschau lesen, speichern. Geraten wird nichts mehr: Eine "
      + "geratene Vorwahl ergibt eine g\u00fcltige Nummer, die einem anderen Menschen "
      + "geh\u00f6rt.",
    ],
    howto: [
      "Kundenkarte → „Zahlungsdaten senden“ → im Fenster pr\u00fcfen, ob Paket und "
      + "Betrag stimmen → „Jetzt senden“. Wenn dort etwas anderes steht, als du "
      + "erwartest: NICHT senden, sondern die Seite neu laden.",
      "Kundenliste → Filter „Nummer nicht w\u00e4hlbar“ → beim Kunden das Land "
      + "w\u00e4hlen → die Vorschau zeigt dir die fertige Nummer → speichern. Der "
      + "Z\u00e4hler im Filter geht um eins runter.",
      "Der Vorschlag beim Land kommt aus PLZ und Ort. Bitte einmal pr\u00fcfen — er "
      + "ist ein Vorschlag, kein Wissen.",
    ],
    important: true,
  },
  {
    id: "2026-08-31-telefon-mikrofon",
    date: "2026-08-19",
    category: "Behoben",
    title: "Vor dem ersten Anruf: Sprechprobe machen",
    summary:
      "Wir haben ausgewertet, warum Kunden „abnehmen und niemand spricht“. Zwei "
      + "Ursachen, beide behoben: ein stummes Mikrofon, das niemandem auffiel, und "
      + "eine Anzeige, die „im Gespräch“ sagte, w\u00e4hrend es beim Kunden noch klingelte.",
    changes: [
      "MACH EINMAL DIE SPRECHPROBE: Im Telefon steht jetzt ein Knopf "
      + "„Sprechprobe“. Er nimmt zwei Sekunden auf und spielt sie sofort ab. "
      + "H\u00f6rst du dich selbst, bist du sendebereit — das ist der einzige Beweis, "
      + "den du ohne Messtechnik f\u00fchren kannst. Bitte einmal am Morgen, bevor du "
      + "den ersten Kunden anrufst. Die Aufnahme verl\u00e4sst deinen Rechner nicht.",

      "ANRUFEN IST GESPERRT, WENN DEIN MIKROFON NICHTS LIEFERT: Bisher stand am "
      + "Balken „sehr leise“ und der Anruf ging trotzdem raus. Jetzt heißt der "
      + "Knopf „Mikrofon pr\u00fcfen“ und l\u00e4sst sich nicht dr\u00fccken, bis wieder etwas "
      + "ankommt. Das kostet dich einen Anruf, der ohnehin nichts geworden w\u00e4re — "
      + "und dem Kunden das Erlebnis, das unsere Nummer bei ihm verbrennt.",

      "DU KANNST DEIN MIKROFON JETZT AUSW\u00c4HLEN: Neu ist eine Liste "
      + "„Eingabeger\u00e4t“. Das war die Hauptursache: Die Telefonie nahm immer das "
      + "Standardger\u00e4t des Browsers — auch wenn das ein stummes Headset oder ein "
      + "Monitor-Mikrofon war, und du konntest nichts dagegen tun. Deine Wahl wird "
      + "gemerkt und beim Anruf wirklich benutzt.",

      "DIE ANZEIGE SAGT JETZT DIE WAHRHEIT: Nach dem Klick stand „IM GESPR\u00c4CH · "
      + "00:00“ mit laufender Uhr, obwohl es beim Kunden erst klingelte. Jetzt "
      + "steht „Verbinde …“, dann „Es klingelt beim Kunden“ und erst beim echten "
      + "Abheben „Im Gespr\u00e4ch“. Die Uhr l\u00e4uft erst dann. WICHTIG: Sprich nicht ins "
      + "Freizeichen — wenn du deine Begr\u00fc\u00dfung schon w\u00e4hrend des Klingelns sagst, "
      + "ist sie vorbei, sobald der Kunde dran ist.",

      "WARNUNG IM GESPR\u00c4CH: Kommt an deinem Mikrofon 8 Sekunden lang nichts an, "
      + "steht es rot im Gespr\u00e4chsfenster. Dann h\u00f6rt dich der Kunde vermutlich "
      + "nicht — Stummschalter am Headset pr\u00fcfen.",

      "FALSCHE L\u00c4NDERVORWAHL BEHOBEN: Bei Nummern ohne Vorwahl (die mit 0 "
      + "beginnen) hat das System bisher „+49“ geraten. Bei 18 Kunden war das "
      + "falsch — sie wohnen in \u00d6sterreich, der Schweiz, Rum\u00e4nien oder der "
      + "Slowakei. Da wurde eine fremde Nummer angerufen. Solche Nummern werden "
      + "jetzt ABGELEHNT statt geraten: Wenn du die Meldung „Ländervorwahl fehlt“ "
      + "siehst, erg\u00e4nze die Nummer in der Akte mit +43…, +49… oder +41…",
    ],
    howto: [
      "Telefon \u00f6ffnen \u2192 oben steht der Mikrofon-Kasten. Sag etwas: Schl\u00e4gt der "
      + "Balken gr\u00fcn aus, liefert dein Mikro. Bleibt er leer, w\u00e4hl unter "
      + "„Eingabeger\u00e4t“ ein anderes und dr\u00fcck „Sprechprobe“.",
      "Wenn „Anrufen“ zu „Mikrofon pr\u00fcfen“ wird, ist das kein Fehler der "
      + "Anwendung: Es kommt gerade nichts an deinem Mikrofon an.",
      "Im klingelnden Zustand: warten, bis der Kunde wirklich dran ist. Die "
      + "Anzeige sagt dir, wann.",
    ],
    important: true,
  },
  {
    id: "2026-08-30-tageslauf-waechter",
    date: "2026-08-18",
    category: "Behoben",
    title: "Die Automatik war 15 Tage aus — und niemand konnte es sehen",
    summary:
      "Der t\u00e4gliche Lauf, der Kunden verteilt und gebrochene Zahlungszusagen "
      + "auf den Tisch legt, hat 15 Tage nicht gearbeitet. 96 \u00fcberf\u00e4llige Zusagen "
      + "sind dadurch liegengeblieben. Beides ist behoben \u2014 und k\u00fcnftig f\u00e4llt es auf.",
    changes: [
      "WAS PASSIERT IST: Der Tageslauf durfte nur in der 6-Uhr-Stunde arbeiten. "
      + "War der Server in genau dieser Stunde nicht wach, war der Tag verloren \u2014 "
      + "und der n\u00e4chste, und der \u00fcbern\u00e4chste. Vom 03. bis zum 18.08. ist er kein "
      + "einziges Mal durchgekommen.",

      "WAS DADURCH LIEGENBLIEB: 96 \u00fcberf\u00e4llige Zahlungszusagen wurden nicht "
      + "eskaliert \u2014 die \u00e4lteste 33 Tage alt. Das sind Kunden, die Zahlung "
      + "versprochen haben und niemandem auf den Tisch gekommen sind. Sie stehen "
      + "in deiner Liste unter „\u00dcberf\u00e4llig“ \u2014 bitte sieh dort nach. Dazu 4 Kunden "
      + "ohne Zust\u00e4ndigen und 8 falsch eingestufte; beides ist nachgezogen.",

      "WAS JETZT ANDERS IST: Der Lauf fragt nicht mehr „ist es 6 Uhr?“, sondern "
      + "„ist der letzte erfolgreiche Durchlauf mehr als 20 Stunden her?“. Verpasst "
      + "er den Morgen, holt er beim n\u00e4chsten Takt nach \u2014 genau EINMAL, nicht "
      + "dreimal.",

      "UND ES F\u00c4LLT AUF: Jeder Lauf schreibt jetzt mit, wann er lief, wie lange "
      + "und mit welchem Ergebnis. Bleibt einer \u00fcber 26 Stunden aus, steht das mit "
      + "Ampel auf dem Verwaltungs-Dashboard \u2014 samt dem Satz, WAS dadurch "
      + "ausf\u00e4llt \u2014 und der Betreiber bekommt eine Mail.",

      "KEINE NACHTR\u00c4GLICHEN MAILS: Es wurden KEINE Mahnungen oder Erinnerungen "
      + "r\u00fcckwirkend verschickt. 15 Tage Mahnungen auf einmal w\u00e4ren f\u00fcr die Kunden "
      + "eine Lawine \u2014 und danach landen auch unsere richtigen Mails im Spam. Die "
      + "laufenden Mahnstufen holen die F\u00e4lle in den n\u00e4chsten Tagen von selbst ein.",
    ],
    howto: [
      "Schau in deiner Kundenliste unter „\u00dcberf\u00e4llig“: Dort stehen die Kunden mit "
      + "gebrochener Zahlungszusage. Bei Florentine 43, bei Daniel 27, bei Lucas 17, "
      + "bei Nikita 9 \u2014 die \u00e4ltesten zuerst.",
      "Wenn dir auff\u00e4llt, dass eine Automatik nicht arbeitet (keine Wiedervorlagen, "
      + "keine neuen Zuteilungen), sag es bitte sofort. Auf dem Dashboard der "
      + "Verwaltung steht jetzt, welcher Lauf steht.",
    ],
    important: true,
  },
  {
    id: "2026-08-30-teamfeedback-3",
    date: "2026-08-18",
    category: "Neu",
    title: "Euer Feedback, Teil 3: Termin-Art, Blockier-Knopf, Mikrofon-Balken",
    summary:
      "Ihr sieht jetzt bei jedem Termin, WAS f\u00fcr ein Gespr\u00e4ch es ist. Das "
      + "Forderungsmanagement hat den Blockier-Knopf. Und das Telefon zeigt vor "
      + "dem Anruf, ob dein Mikrofon liefert.",
    changes: [
      "TERMIN-ART \u00dcBERALL: Jeder Termin tr\u00e4gt eine Marke \u2014 „Onboarding“ "
      + "(bezahlt, freischalten), „Vertrieb“ (noch nicht bezahlt, beraten) oder "
      + "„R\u00fcckruf“ (selbst notiert). Im Kalender, in der oberen Leiste, in der "
      + "Termin-Zentrale und in der Startgespr\u00e4ch-Liste. Vorher stand dort „Kunde "
      + "hat gebucht“ \u2014 das sagt, WOHER der Termin kommt, aber nicht, worauf du "
      + "dich einstellen musst.",

      "BLOCKIER-KNOPF IM FORDERUNGSMANAGEMENT: Neues Ergebnis „Nummer blockiert "
      + "uns“. Es markiert die Nummer und legt die Rate 30 Tage still. Vorher "
      + "blieb dir nur „Nicht erreicht“ \u2014 und die Rate kam am n\u00e4chsten Tag "
      + "wieder, also hast du dieselbe Nummer gew\u00e4hlt, die dich wegdr\u00fcckt. Die "
      + "Mahnungen laufen weiter, nur der Anrufweg ist zu.",

      "MIKROFON-BALKEN VOR DEM ANRUF: „Der Kunde nimmt ab, aber es spricht "
      + "niemand“ \u2014 gemeldet und verstanden. Dass der Browser das Mikrofon "
      + "ERLAUBT hat, hei\u00dft nicht, dass es liefert: stummes Headset, falsches "
      + "Eingabeger\u00e4t, Schalter am Kabel. Sag einmal „Test“ und du SIEHST, ob es "
      + "ankommt \u2014 bevor ein Kunde in der Leitung ist.",

      "WARNUNG IM GESPR\u00c4CH: Liegt dein Eingang \u00fcber 10 Sekunden bei null, steht "
      + "es im Gespr\u00e4chsblatt: „Dein Mikrofon liefert kein Signal.“ Zehn Sekunden, "
      + "damit eine normale Sprechpause keinen Fehlalarm ausl\u00f6st.",

      "SCHUTZ F\u00dcR UNSERE RUFNUMMER: Es gibt jetzt eine Tagesgrenze (Vorgabe 100 "
      + "Anrufe je Nummer). Sehr viele Anrufe von einer Nummer f\u00fchren beim "
      + "Netzbetreiber zu einer Spam-Markierung \u2014 danach klingelt sie bei "
      + "NIEMANDEM mehr durch. Den Stand siehst du im Telefon-Panel, bevor der "
      + "Knopf nicht mehr geht. Im Normalbetrieb erreicht das niemand.",

      "VERST\u00c4NDLICHE ABLEHNUNG BEI DER TERMINBUCHUNG: Wenn ein Kunde einen Slot "
      + "w\u00e4hlt, der gerade weg ist, steht jetzt da, wie viele Zeiten noch frei "
      + "sind \u2014 statt nur „nicht mehr frei“. Und jeder Buchungsversuch wird "
      + "protokolliert, auch der erfolgreiche. Damit l\u00e4sst sich die Meldung "
      + "„Buchung klappt nicht zuverl\u00e4ssig“ endlich mit Zahlen pr\u00fcfen statt "
      + "sch\u00e4tzen.",
    ],
    howto: [
      "Telefon \u00f6ffnen \u2192 unter der Tastatur steht der Mikrofon-Balken. Sag etwas: "
      + "Schl\u00e4gt er gr\u00fcn aus, liefert dein Mikro. Bleibt er bernstein bei „kein "
      + "Signal“, pr\u00fcf den Stummschalter am Headset und das Eingabeger\u00e4t im Browser.",
      "Forderungsmanagement \u2192 „Ergebnis festhalten“ \u2192 „Nummer blockiert uns“.",
      "Kalender: Die Art steht als farbige Marke neben der Uhrzeit. Fahr mit der "
      + "Maus dar\u00fcber, dann steht da, worauf du dich einstellst.",
    ],
    important: true,
  },
  {
    id: "2026-08-30-teamfeedback-2",
    date: "2026-08-18",
    category: "Behoben",
    title: "Euer Feedback, Teil 2: Rufnummern, verpasste Termine, Stufen und Betreuer",
    summary:
      "Das +49 +49 im Forderungsmanagement ist weg \u2014 und es war schlimmer als "
      + "gedacht. Verpasste Termine lassen sich jetzt wirklich abschlie\u00dfen. Und "
      + "142 Kunden mit offener Rechnung lagen im kalten Fach.",
    changes: [
      "GEMELDET: „+49 +49 vor der Nummer im Forderungsmanagement.“ \u2014 URSACHE: "
      + "Der Vertrieb bekommt die Nummer fertig vom Server, das "
      + "Forderungsmanagement setzte sie selbst zusammen. Stand vor der Nummer "
      + "schon ein „+“, kam noch eins davor. GEMESSEN: 21 Zeilen. \u2014 SCHLIMMER: "
      + "Bei \u00f6sterreichischen Nummern ohne getrennte Vorwahl wurde „+49“ "
      + "davorgeh\u00e4ngt. H\u00e4tte man nur das doppelte Plus entfernt, h\u00e4ttet ihr einen "
      + "FREMDEN Menschen angerufen. \u2014 JETZT: Eine einzige Stelle berechnet die "
      + "Nummer, f\u00fcr Anzeige UND Wahl. 39 kaputte Nummern im Bestand sind "
      + "bereinigt. Ist eine Nummer nicht w\u00e4hlbar, steht der GRUND da statt "
      + "eines Knopfes, der ins Leere ruft.",

      "GEMELDET: „‚Nicht erschienen \u2014 bitte abschlie\u00dfen‘ h\u00e4ngt.“ \u2014 URSACHE: Der "
      + "Satz erschien bei JEDEM verpassten Termin, auch bei den l\u00e4ngst "
      + "abgearbeiteten \u2014 und es gab kein „Abschlie\u00dfen“. Wer nochmal dr\u00fcckte, "
      + "schrieb dasselbe nochmal: Die Karte verschwand kurz und war nach dem "
      + "n\u00e4chsten Laden zur\u00fcck. GEMESSEN: 19 von 47 verpassten Terminen waren "
      + "fertig und standen trotzdem da; bei einem Kollegen 26 St\u00fcck. \u2014 JETZT: "
      + "Ein Klick auf „Nicht erschienen“ schlie\u00dft den Vorgang \u2014 Fehlversuch "
      + "gez\u00e4hlt, Folge-Einladung l\u00e4uft, Karte weg. Stehen bleiben nur die, die "
      + "der Nachlauf markiert hat und die noch niemand bearbeitet hat.",

      "142 KUNDEN LAGEN IM FALSCHEN FACH: Gemeldet war „Kunden mit Zahlung "
      + "stehen auf Stufe C“. Das gibt es nicht (gepr\u00fcft: 0 F\u00e4lle) \u2014 aber die "
      + "gespeicherte Stufe wich bei 181 Menschen von der Berechnung ab. Bei 142 "
      + "davon stand Stufe C, obwohl eine RECHNUNG OFFEN ist. Die haben in "
      + "niemandes Arbeitsliste gelegen. Alle 188 sind nachgezogen \u2014 dein Bestand "
      + "kann dadurch gewachsen sein.",

      "88 BEZAHLTE HATTEN KEINEN ZUST\u00c4NDIGEN: Wer bezahlt hat, ohne vorher Stufe "
      + "A oder B zu sein (Direktzahler), fiel aus der Verteilung \u2014 vorher zu "
      + "fr\u00fch, nachher „ist ja schon Kunde“. Niemand f\u00fchrte sein Startgespr\u00e4ch. "
      + "Alle 88 sind jetzt zugeteilt; wer dokumentiert betreut wurde, ist bei "
      + "SEINEM Betreuer gelandet, nicht beim n\u00e4chstbesten.",

      "„OHNE BETREUER“ WAR TEILS EIN ANZEIGEFEHLER: Die Zahlungsansicht las den "
      + "Zust\u00e4ndigen von der BESTELLUNG statt von der Person. Nach "
      + "Zusammenf\u00fchrungen laufen die auseinander \u2014 GEMESSEN: bei 36 bezahlten "
      + "Bestellungen stand „ohne Betreuer“, obwohl einer eingetragen war. Jetzt "
      + "gilt die Person, die Bestellung nur als R\u00fcckfall.",

      "PROVISION: NIE MEHR EIN LEERES FELD. Wo eine Provision gebucht ist, steht "
      + "der Betrag. Wo die Wand griff, steht „Direktzahler \u2014 keine Provision“. "
      + "Wo beides fehlt (61 F\u00e4lle), steht „kein Vermerk \u2014 bitte pr\u00fcfen“. Ein "
      + "leeres Feld hat bisher nicht unterschieden, ob es keine Provision gibt "
      + "oder ob niemand nachgesehen hat.",
    ],
    howto: [
      "Forderungsmanagement: Der Anruf-Knopf steht nur noch da, wo die Nummer "
      + "wirklich w\u00e4hlbar ist. Fehlt die Vorwahl, steht das als Text daneben \u2014 "
      + "dann bitte in der Akte erg\u00e4nzen, danach ist der Knopf da.",
      "Kalender: Verpasste Termine mit „Nicht erschienen“ abschlie\u00dfen. Die Karte "
      + "verschwindet danach. Kommt sie zur\u00fcck, ist das ein Fehler \u2014 bitte melden.",
      "Deine Liste kann gewachsen sein: 142 Kunden mit offener Rechnung sind aus "
      + "dem kalten Fach nach vorn gewandert, und 88 bezahlte Kunden haben einen "
      + "Zust\u00e4ndigen bekommen.",
    ],
    important: true,
  },
  {
    id: "2026-08-30-teamfeedback",
    date: "2026-08-18",
    category: "Behoben",
    title: "Euer Feedback: was ihr gemeldet habt, was die Ursache war, was jetzt gilt",
    summary:
      "Dreizehn Meldungen. Zwei davon hatten dieselbe Ursache \u2014 eine einzige "
      + "fehlende Zeile. Und der Verdacht auf falsch zusammengef\u00fchrte Kunden hat "
      + "sich nach 742 nachgerechneten F\u00e4llen NICHT best\u00e4tigt.",
    changes: [
      "GEMELDET: „Bei verschiedenen Kunden erscheinen dieselben Stammdaten.“ — "
      + "URSACHE: Nicht die Zusammenf\u00fchrung. Das Telefon-Panel hat die Kundendaten "
      + "beim ERSTEN Anruf geladen und danach nie wieder. Ab dem zweiten Gespr\u00e4ch "
      + "standen dort die Daten des ersten Kunden \u2014 genau Paket, Offen, "
      + "Verwendungszweck, E-Mail und Ort. — JETZT: Die Daten geh\u00f6ren zum Kunden, "
      + "nicht zum Gespr\u00e4ch. Passt die Kennung nicht, steht „Wird geladen …“ da "
      + "statt fremder Angaben. Ein falscher Name am Telefon ist schlimmer als eine L\u00fccke.",

      "GEMELDET: „E-Mail erg\u00e4nzt \u2014 Versand bleibt trotzdem gesperrt.“ UND "
      + "„Produkt anlegen: keine Bestellung vorhanden.“ — URSACHE: Dasselbe Problem. "
      + "Nach jeder \u00c4nderung holt die Karte sich frisch \u2014 und die Antwort enthielt "
      + "die Bestellungen nicht. Die Karte hat sie dabei nicht nur nicht erneuert, "
      + "sondern GEL\u00d6SCHT. Deshalb wurde es schlimmer, je mehr ihr getan habt: Wer "
      + "die E-Mail nachtrug, sperrte sich damit den Versand. — JETZT: Die "
      + "Bestellungen sind immer dabei. E-Mail erg\u00e4nzen \u2192 sofort senden. Produkt "
      + "anlegen \u2192 sofort senden. Ohne Umweg.",

      "GEMELDET: „Ein Kunde steht bei Hans UND bei Diana.“ — URSACHE: Die Zuteilung "
      + "verteilte jede RATE einzeln an den mit der kleinsten Last. Wer mehrere "
      + "offene Raten hatte, landete bei zwei Menschen. Gemessen: 7 Kunden. — "
      + "JETZT: Ein Mensch, ein Zust\u00e4ndiger. Alle Raten eines Kunden geh\u00f6ren einem "
      + "von euch; neue Raten folgen dem, der schon zust\u00e4ndig ist. Die 7 F\u00e4lle sind "
      + "zusammengef\u00fchrt und stehen mit Begr\u00fcndung im Verlauf.",

      "GEMELDET: „Diana & Nikita gleichzeitig.“ — URSACHE: Beides war richtig. Ein "
      + "Kunde hat zwei Zust\u00e4ndige: einen im Vertrieb und einen im "
      + "Forderungsmanagement. Es stand nur nirgends, welcher welcher ist. — JETZT: "
      + "Zwei beschriftete Felder \u2014 „Betreuung Vertrieb“ und „Forderungsmanagement“. "
      + "Nie mehr ein unbeschriftetes „betreut von“. Ist niemand zust\u00e4ndig, steht "
      + "„niemand“ da statt eines leeren Feldes.",

      "GEPR\u00dcFT UND NICHT BEST\u00c4TIGT: Der Verdacht, die automatische "
      + "Zusammenf\u00fchrung habe \u00fcber Platzhalter (0000, info@, Firmennummern) fremde "
      + "Menschen verschmolzen. Nachgerechnet wurden alle 742 Zusammenf\u00fchrungen: "
      + "Kein einziger Fall betraf zwei verschiedene Menschen. Von 61 mehrfach "
      + "belegten Rufnummern geh\u00f6ren 58 zu genau EINEM Nachnamen \u2014 das ist "
      + "derselbe Mensch, mehrfach angelegt. Es wurde deshalb nichts getrennt: Ein "
      + "Undo h\u00e4tte Dubletten erzeugt, um ein Problem zu l\u00f6sen, das es nicht gibt.",

      "TROTZDEM H\u00c4RTER: K\u00fcnftig wird nicht mehr automatisch zusammengef\u00fchrt, wenn "
      + "ein hartes Merkmal widerspricht \u2014 anderer Nachname, anderes Geburtsdatum "
      + "oder Stra\u00dfe und PLZ gemeinsam abweichend. Solche Paare werden Kandidat und "
      + "warten auf einen Menschen. Ein vertipptes Geburtsdatum (eine Stelle) bleibt "
      + "zusammenf\u00fchrbar \u2014 sonst h\u00e4tte die Regel mehr kaputtgemacht als geholfen.",
    ],
    howto: [
      "Zahlungsdaten senden: Kunde \u00f6ffnen \u2192 fehlt die E-Mail, tr\u00e4gst du sie direkt "
      + "am Knopf ein \u2192 „Speichern“ \u2192 der Knopf ist sofort frei. Kein Neuladen n\u00f6tig.",
      "Kunde ohne Bestellung: „Produkt anlegen“ \u2192 Paket w\u00e4hlen \u2192 danach Zahlungsdaten "
      + "senden. Beides in einem Vorgang, ohne die Seite zu wechseln.",
      "Am Telefon: Klapp „Kundendaten“ im Panel auf. Steht dort „Wird geladen …“, "
      + "warte einen Moment \u2014 das ist die Absicherung, dass du NIE fremde Daten liest.",
      "Im Forderungsmanagement: Du siehst jetzt alle Raten eines Menschen, wenn er "
      + "dir geh\u00f6rt \u2014 nicht mehr einzelne Raten quer verteilt.",
    ],
    important: true,
  },
  {
    id: "2026-08-30-schaubilder",
    date: "2026-08-18",
    category: "Neu",
    title: "Die Academy hat jetzt Schaubilder \u2014 und die Mails siehst du wie am Handy",
    summary:
      "Drei gezeichnete \u00dcbersichten: der Kundenweg, die Stufen A/B/C als Trichter "
      + "und der Abo-Zyklus als Kreis. Dazu die Mail-Vorschau umschaltbar.",
    changes: [
      "DER KUNDENWEG ALS BILD: Antrag \u2192 Zahlung \u2192 Gate \u2192 Gespr\u00e4ch \u2192 Freischaltung \u2192 Abo, als eine Linie. Der Abzweig ins Forderungsmanagement geht gestrichelt nach unten \u2014 er ist der Ausnahmefall, nicht die Fortsetzung.",
      "MIT DEN ECHTEN ZAHLEN: „336 warten hier“ steht am Gate (bezahlte Kunden ohne Termin), „120 von 120 Terminen kamen aus einem verschickten Link“ \u00fcber dem Gespr\u00e4ch.",
      "DIE STUFEN A/B/C ALS TRICHTER: Die Breite zeigt die Menge, die Reihenfolge die Dringlichkeit. Darunter steht, warum: „Wer C zuerst anruft, arbeitet an der falschen Stelle.“",
      "DER ABO-ZYKLUS ALS KREIS: Jahrestag, Rechnung, T+1, Mahnstufen, Zahlung oder Sperre \u2014 und zur\u00fcck. Ein Abo hat kein Ende, nur einen Jahrestag.",
      "DIE MAIL-VORSCHAU IST UMSCHALTBAR: Desktop oder Handy. Die meisten Kunden lesen am Telefon \u2014 so siehst du, was sie sehen.",
      "F\u00dcR DIE LEITUNG: Eine eigene Schulungsseite (Mehr \u2192 Schulung) mit den drei Reisen, der Kernbotschaft, dem Stand des Teams und dem Funktionskatalog.",
      "UND IN DER TEAM-ZENTRALE steht bei jedem Menschen, wie weit er in der Academy ist \u2014 kein Urteil, nur ein Stand.",
    ],
    howto: [
      "Mehr \u2192 Academy \u2192 Reise \u00f6ffnen. Die Schaubilder stehen in den Kapiteln, zu denen sie geh\u00f6ren.",
      "Bei einer Mail: „Desktop“ / „Handy“ umschalten.",
      "Wenn du Bewegung im System abgeschaltet hast, stehen die Bilder still \u2014 vollst\u00e4ndig sichtbar.",
    ],
    link: { href: "/agent/academy", label: "Zur Academy" },
    important: false,
  },
  {
    id: "2026-08-29-produkt",
    date: "2026-08-18",
    category: "Behoben",
    title: "„Produkt anlegen“ geht jetzt \u2014 und Tauschen ist ein Klick",
    summary:
      "Der Knopf hat nichts getan. Das war unser Fehler: Die Funktion war im Server "
      + "fertig, aber es gab keinen Dialog dazu. Jetzt gibt es ihn.",
    changes: [
      "DAS WAR DER FEHLER: Der Knopf war ein Link auf eine Stelle, die es nicht gibt \u2014 deshalb passierte nichts. Die Funktion selbst war seit vier Tagen fertig, nur unerreichbar. Entschuldigung.",
      "JETZT: In der Kundenkarte steht „Produkt tauschen“ (wenn ein Paket offen ist) oder „Produkt hinzuf\u00fcgen“. Ein Klick \u00f6ffnet die Auswahl.",
      "TAUSCHEN IST EIN KLICK: Neues Paket w\u00e4hlen, „Tauschen“. Die alte offene Bestellung wird stillgelegt \u2014 der Kunde bekommt nur EINE Zahlungsaufforderung, mit neuem Verwendungszweck.",
      "DAS SCHON OFFENE PAKET IST GESPERRT: Man kann Pro nicht gegen Pro tauschen. Und die Bonit\u00e4tsauskunft ist gesperrt, wenn sie schon offen oder bezahlt ist.",
      "DIE ZAHLUNGSDATEN-MAIL TR\u00c4GT DIE NEUEN WERTE: neues Paket, neuer Betrag, neuer Verwendungszweck. Kein alter Wert bleibt stehen \u2014 das pr\u00fcfen wir jetzt Feld f\u00fcr Feld.",
      "STAMMDATEN AN DERSELBEN KARTE: Fehlt die E-Mail, kannst du sie direkt am gesperrten Zahlungsdaten-Knopf eintippen und speichern.",
      "UND F\u00dcR DIE LEITUNG: Florentine und Daniel k\u00f6nnen die Academy jetzt im Team-Portal pr\u00e4sentieren \u2014 Vollbild, gro\u00dfe Schrift, Pfeiltasten.",
    ],
    howto: [
      "Kundenkarte \u2192 „Produkt tauschen“ bzw. „hinzuf\u00fcgen“ \u2192 Paket w\u00e4hlen \u2192 best\u00e4tigen.",
      "Danach „Zahlungsdaten senden“ \u2014 die Mail hat automatisch die neuen Werte.",
      "Wenn etwas nicht geht: Der Knopf sagt jetzt, warum. Steht dort nichts und passiert nichts, bitte melden \u2014 genau das war der Fehler.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-28-academy-team",
    date: "2026-08-18",
    category: "Neu",
    title: "Die Academy ist f\u00fcr euch offen \u2014 deine Reise unter „Mehr“",
    summary:
      "Der komplette Ablauf deines Bereichs, Kapitel f\u00fcr Kapitel. Dein Stand wird "
      + "gespeichert \u2014 du kannst jederzeit aufh\u00f6ren und sp\u00e4ter weitermachen.",
    changes: [
      "MEHR \u2192 ACADEMY: Dort steht DEINE Reise. Vertrieb, Onboarding oder Forderungsmanagement \u2014 je nach Bereich. Die Leitung sieht alle drei.",
      "JEDES KAPITEL ZEIGT: was passiert (ein Satz), wer handelt, den Ablauf, die Zahlen dahinter \u2014 und einen Knopf zur echten Seite im System.",
      "„WARUM DIESER SCHRITT?“ steht bei jedem Kapitel zum Aufklappen. Nicht nur die Anleitung, sondern der Grund \u2014 fast jedes Kapitel gibt es, weil einmal etwas schiefging.",
      "DEIN STAND BLEIBT: Wenn du bei Kapitel 6 aufh\u00f6rst, geht es dort weiter. Zur\u00fcckbl\u00e4ttern kostet nichts.",
      "KEINE PR\u00dcFUNG, KEINE NOTE. Es steht nur da, wie weit du gekommen bist \u2014 damit die Leitung wei\u00df, mit wem sie noch einmal durchgehen sollte.",
      "AM HANDY: Ein Kapitel je Seite, gro\u00dfe Kn\u00f6pfe, nichts verrutscht.",
    ],
    howto: [
      "Mehr \u2192 Academy \u2192 Reise antippen \u2192 „Reise starten“.",
      "Mit „Weiter“ durchbl\u00e4ttern \u2014 am Rechner gehen auch die Pfeiltasten.",
      "Am Ende „Fertig“ \u2014 dann steht deine Reise als durchgearbeitet.",
      "Wenn dir etwas fehlt oder falsch klingt: Mehr \u2192 Feedback. Die H\u00e4lfte dieser Kapitel gibt es, weil jemand etwas gemeldet hat.",
    ],
    link: { href: "/agent/academy", label: "Zur Academy" },
    important: true,
  },
  {
    id: "2026-08-27-knopf",
    date: "2026-08-18",
    category: "Behoben",
    title: "Der Zahlungsdaten-Knopf sagt jetzt, warum er nicht geht \u2014 und was zu tun ist",
    summary:
      "Daniel hat gemeldet, dass sich die Zahlungsdaten nicht jedem schicken lassen. "
      + "Gemessen: bei 477 von 600 Kunden war der Knopf gesperrt \u2014 ohne zu sagen, warum.",
    changes: [
      "DAS WAR DAS PROBLEM: Der Knopf war grau, und der Grund stand nur im Tooltip \u2014 den sieht am Handy niemand.",
      "GEMESSEN an 600 Kunden der Tagesliste: 123 sendbar. Gesperrt: 219 ohne offene Bestellung, 165 ohne E-Mail-Adresse, 93 haben schon bezahlt. Meistens sperrt der Knopf also ZU RECHT \u2014 es fehlte die Auskunft.",
      "JETZT STEHT DER GRUND ALS TEXT am Knopf, in Bernstein: „Keine E-Mail-Adresse“, „Keine offene Bestellung“ oder „Alles bezahlt“.",
      "UND DER N\u00c4CHSTE SCHRITT DANEBEN: Fehlt die E-Mail, kannst du sie direkt dort eintippen und speichern \u2014 ohne die Seite zu wechseln. Danach ist der Knopf frei.",
      "GUT ZU WISSEN: Bei „Zahlung gemeldet“ ging es immer schon \u2014 genau dann fragen Kunden am h\u00e4ufigsten nach den Daten. Das betrifft 243 Personen.",
      "AU\u00dfERDEM: Die Zweig-Ampel in der Verwaltung ordnet Testmails jetzt \u00fcber eine eigene Adresse je Ereignis zu (dev+welcome@\u2026). Vorher wurde \u00fcber den Betreff geraten \u2014 bei 305 gefundenen Ereignissen passte „keins“.",
      "UND: Kunden mit Nummern-Anfrage rutschen nicht mehr zur\u00fcck in die Tagesliste. Der Nachtrag l\u00e4uft ab jetzt t\u00e4glich von selbst.",
    ],
    howto: [
      "Kundenkarte \u00f6ffnen. Ist der Zahlungsdaten-Knopf bernstein statt blau, steht der Grund darunter.",
      "Fehlt die E-Mail: ins Feld daneben tippen, „Speichern“, dann senden.",
      "Fehlt die Bestellung: „Produkt anlegen“ \u2192 f\u00fchrt in die Liste, dort „+ Kunde anlegen“.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-26-academy",
    date: "2026-08-18",
    category: "Neu",
    title: "Es gibt jetzt die FIAON Academy \u2014 so wird eingeschult",
    summary:
      "Drei Reisen durch die drei Abteilungen, Kapitel f\u00fcr Kapitel. Bildschirm teilen, "
      + "Reise starten, vorf\u00fchren \u2014 mit den echten Wegen im System.",
    changes: [
      "VERWALTUNG \u2192 FIAON ACADEMY: Drei Reisen \u2014 Vertrieb (12 Kapitel), Onboarding (15) und Forderungsmanagement (9).",
      "JEDES KAPITEL ZEIGT: was passiert (ein Satz, gro\u00df), wer handelt, den Ablauf, die Zahlen dahinter \u2014 und wenn eine Mail flie\u00dft, ihre echte Vorschau mit Absender und Betreff.",
      "KNOPF „PR\u00c4SENTIEREN“: Vollbild, gro\u00dfe Schrift, nur Pfeiltasten. F\u00fcr den geteilten Bildschirm im Einschulungsgespr\u00e4ch. Esc beendet.",
      "„WARUM DIESER SCHRITT?“ steht bei jedem Kapitel zum Aufklappen \u2014 die Begr\u00fcndung, nicht nur die Anleitung.",
      "DIE SIEBEN SCHRITTE DES STARTGESPR\u00c4CHS sind einzelne Kapitel, mit den echten Stichpunkten aus dem Cockpit. Wenn sich dort etwas \u00e4ndert, \u00e4ndert sich die Schulung mit.",
      "KEINE BILDER, SONDERN WEGE: Jedes Kapitel hat einen Knopf „live \u00f6ffnen“ zur echten Seite. So schult niemand veraltete Screenshots.",
      "AU\u00dfERDEM NEU: Die Termin-Zentrale (Verwaltung \u2192 Termin-Zentrale) zeigt alle Termine aller Mitarbeiter \u2014 mit Erledigt- und No-Show-Quote je Mensch und den bezahlten Kunden, die noch keinen Termin haben.",
    ],
    howto: [
      "Verwaltung \u2192 FIAON Academy \u2192 Reise w\u00e4hlen \u2192 „Reise starten“.",
      "Zum Vorf\u00fchren: „Pr\u00e4sentieren“ dr\u00fccken, dann mit den Pfeiltasten bl\u00e4ttern.",
      "Am Handy geht alles genauso \u2014 die Kapitel stapeln sich, nichts verrutscht.",
      "Kein Ton, kein Video: Die Academy erz\u00e4hlt in Text und zeigt echte Oberfl\u00e4chen.",
    ],
    link: { href: "/admin/schulung", label: "Zur FIAON Academy" },
    important: true,
  },
  {
    id: "2026-08-25-vollpfleger",
    date: "2026-08-18",
    category: "Neu",
    title: "Ihr k\u00f6nnt jetzt Kunden komplett anlegen \u2014 so geht's",
    summary:
      "Kunde am Telefon? Anlegen, Paket w\u00e4hlen, Zahlungsdaten schicken, Termin anbieten \u2014 "
      + "alles in einem Fenster, ohne die Verwaltung zu fragen.",
    changes: [
      "DAS GING VORHER NICHT: Es gab keine M\u00f6glichkeit, einen Kunden selbst anzulegen. Ihr hattet den Menschen am Telefon und musstet die Verwaltung bitten.",
      "JETZT: Kunden \u2192 Knopf „+ Kunde anlegen“. Vorname, Nachname, dazu E-Mail ODER Telefon. Paket aus der Liste (Preise stehen fest, nichts zu tippen). Fertig.",
      "WIR PR\u00dcFEN AUF DOPPELG\u00c4NGER, W\u00c4HREND IHR TIPPT: Steht der Mensch schon im System, seht ihr es sofort \u2014 mit dem Grund (E-Mail oder Nummer), dem betreuenden Kollegen und einem Knopf zur Akte. Kein zweiter Datensatz.",
      "DANACH BLEIBT DAS FENSTER OFFEN und zeigt drei Schritte: 1. Zahlungsdaten senden ODER kopieren (f\u00fcr WhatsApp) 2. Terminlink senden ODER kopieren 3. Zur Akte.",
      "WARUM DER TERMIN WICHTIG IST: Alle 120 gebuchten Termine kamen aus einem verschickten Link. Wer im Gespr\u00e4ch einen bekommt, bucht \u2014 sp\u00e4ter erreicht ihn niemand mehr.",
      "PRODUKT AN BESTEHENDE KUNDEN: In der Akte l\u00e4sst sich ein Paket hinzuf\u00fcgen. Ein Upgrade legt die alte offene Bestellung still \u2014 der Kunde bekommt nur EINE Zahlungsaufforderung. Die Bonit\u00e4tsauskunft geht zus\u00e4tzlich, aber nur einmal.",
      "STAMMDATEN: Name, E-Mail, Telefon, Adresse und Geburtsdatum k\u00f6nnt ihr bei euren Kunden \u00e4ndern. Jede \u00c4nderung steht im Verlauf, und die alte Nummer bleibt als Nebennummer erhalten \u2014 ruft der Kunde von ihr an, wird er erkannt.",
      "WAS NICHT GEHT: Preise tippen (die kommen aus dem Katalog) und bezahlte Bestellungen \u00e4ndern. Beides w\u00fcrde in Rechnung und Provision landen.",
    ],
    howto: [
      "Kunden \u2192 „+ Kunde anlegen“ \u2192 Name + E-Mail oder Telefon \u2192 Paket \u2192 anlegen.",
      "Erscheint der Doppelg\u00e4nger-Hinweis: Ist es derselbe Mensch? Dann „Akte \u00f6ffnen“ und dort ein Produkt hinzuf\u00fcgen.",
      "Nach dem Anlegen: Zahlungsdaten senden (oder kopieren und in WhatsApp einf\u00fcgen), dann Terminlink.",
      "Am Handy geht alles genauso \u2014 die Felder stapeln sich, die Kn\u00f6pfe sind gro\u00df genug.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-24-reste",
    date: "2026-08-18",
    category: "Behoben",
    title: "Sieben zahlende Kunden standen t\u00e4glich auf der Liste \u2014 ohne dass ihr etwas tun konntet",
    summary:
      "Wer per Mail um seine Nummer gebeten wird, verschwindet f\u00fcr sieben Tage aus der Tagesliste. "
      + "Bei sieben Kunden war das nie gesetzt worden \u2014 sie kamen jeden Morgen wieder.",
    changes: [
      "DAS WAR DAS PROBLEM: Ihr habt einem Kunden die Nummer-Korrektur-Mail geschickt. Danach k\u00f6nnt ihr nichts tun \u2014 die Nummer stimmt nicht, die Antwort steht beim Kunden. Sieben solche F\u00e4lle standen trotzdem jeden Tag auf der Liste, alle mit gemeldeter Zahlung.",
      "Jetzt sind sie f\u00fcr sieben Tage im Wartezustand und kommen von selbst zur\u00fcck: wenn der Kunde seine Nummer eintr\u00e4gt, wenn er einen Termin bucht, oder wenn die sieben Tage um sind. Niemand muss daran denken.",
      "Sie sind NICHT verschwunden: Filter „Wartend“ zeigt sie. Es wurde auch keine zweite Mail geschickt \u2014 die Anfrage ist ja raus.",
      "NOTIZPFLICHT BEI „ERREICHT \u2014 SONSTIGES“: In der Kundenliste konnte man dieses Ergebnis ohne Notiz speichern (im Softphone ging das nie). Jetzt braucht es \u00fcberall mindestens 10 Zeichen \u2014 mit Z\u00e4hler, der sagt, wie viele noch fehlen.",
      "Warum: „Sonstiges“ ohne Notiz ist ein verlorenes Gespr\u00e4ch. Der n\u00e4chste Anrufer f\u00e4ngt bei Null an und fragt dasselbe noch mal.",
      "ZUSTELLPROTOKOLL DURCHSUCHBAR (Verwaltung): Filter nach Zeitraum, Ereignis und Empf\u00e4nger (Name ODER Adresse), 50 je Seite, CSV-Export des gefilterten Ausschnitts. Jede Zeile klappt auf und zeigt die Zustellkette mit Zeiten.",
    ],
    howto: [
      "Falsche Nummer wie bisher erfassen \u2014 der Wartezustand wird automatisch gesetzt.",
      "Wartende sehen: Kundenliste \u2192 Filter „Wartend“.",
      "Bei „Erreicht \u2014 Sonstiges“: kurz schreiben, was besprochen wurde. Ein Satz gen\u00fcgt.",
      "Protokoll: Verwaltung \u2192 E-Mail-Events \u2192 ganz unten (oder „Zum Zustellprotokoll“ oben).",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-23-geduld",
    date: "2026-08-17",
    category: "Behoben",
    title: "Die Zweig-Pr\u00fcfung gab zu fr\u00fch auf \u2014 34 Zweige waren zu Unrecht rot",
    summary:
      "Der Pr\u00fcflauf meldete „Testmail kam nicht an“ f\u00fcr 34 Ereignisse \u2014 obwohl die Mails "
      + "im Postfach lagen. Brevo tr\u00e4gt Zustellungen mit 1\u20133 Minuten Verzug ein, wir fragten nach 25 Sekunden.",
    changes: [
      "DAS WAR DAS PROBLEM: Wir haben den Lauf schneller gemacht (von 2 Minuten auf 34 Sekunden) \u2014 und dabei zu schnell. Brevo braucht 1 bis 3 Minuten, bis eine Zustellung in seiner Statistik steht.",
      "JETZT FRAGEN WIR MEHRMALS: Erste Nachfrage nach 30 Sekunden, dann alle 30 Sekunden, bis zu 4 Minuten. Sind alle Zweige in Ordnung, ist der Lauf nach etwa einer Minute fertig \u2014 nur bei echten L\u00fccken wartet er l\u00e4nger.",
      "Die Anzeige z\u00e4hlt jetzt mit: „L\u00e4uft seit 45 s \u00b7 n\u00e4chste Nachfrage in 15 s“. Bitte NICHT abbrechen \u2014 ein Abbruch war der Grund f\u00fcr die falschen roten Marken.",
      "NEUER KNOPF „NUR NACHSEHEN“: Fragt Brevo erneut, OHNE neue Probemails zu schicken. Falls ein Lauf zu fr\u00fch aufgegeben hat: einmal dr\u00fccken, dann werden die Zweige gr\u00fcn, deren Mails inzwischen angekommen sind.",
      "FOLLOW-UP 48H F\u00c4LLT RAUS: Dieses Ereignis wird nie mehr gefeuert (gemessen: null Vers\u00e4nde). Es bekam trotzdem eine Probemail und z\u00e4hlte als „Zweig fehlt“. Jetzt steht es als „veraltet \u2014 darf in Make gel\u00f6scht werden“ und z\u00e4hlt nirgends mit. Aus 35 werden 34 echte Ereignisse.",
      "BESSERE FEHLERMELDUNG: Klemmt es, steht jetzt dabei, welche Adresse gesucht wurde, in welchem Zeitfenster und wie viele Brevo-Ereignisse insgesamt gefunden wurden. Bei 0 gefundenen sagt der Text ausdr\u00fccklich, dass es NICHT am Zweig liegt.",
    ],
    howto: [
      "Verwaltung \u2192 E-Mail-Events. Zuerst einmal „Nur nachsehen“ dr\u00fccken \u2014 das holt die Ergebnisse der letzten L\u00e4ufe nach, ohne neue Mails.",
      "F\u00fcr einen frischen Lauf: Testadresse oben eintragen, dann „Alle Zweige pr\u00fcfen“. Fenster offen lassen, bis zu 4 Minuten.",
      "Steht „Zweig fehlt“: Die Liste zum Kopieren steht darunter \u2014 damit in Make nachsehen.",
      "Steht „Pr\u00fcfung gest\u00f6rt“: Nichts tun, das ist unsere Baustelle.",
    ],
    link: { href: "/admin/events", label: "Zu den E-Mail-Events" },
    important: true,
  },
  {
    id: "2026-08-22-bonitaet",
    date: "2026-08-17",
    category: "Behoben",
    title: "Kunden wurden zum Kauf aufgefordert, obwohl sie schon bezahlt hatten",
    summary:
      "35 zahlende Kunden hatten ihre Bonit\u00e4tsauskunft bezahlt und sahen im Portal trotzdem "
      + "„Bonit\u00e4ts-Check starten“. 31 weitere hatten ihre Auskunft selbst hochgeladen \u2014 und sahen dasselbe.",
    changes: [
      "DAS WAR DAS PROBLEM: Es gab DREI getrennte Angaben \u2014 „hat bezahlt“, „Dokument liegt vor“, „Dokument gepr\u00fcft“. Jede Ansicht mischte sie anders. Deshalb forderte das Portal Menschen zum Kauf auf, die l\u00e4ngst bezahlt hatten.",
      "Jetzt gibt es EINEN Status mit sechs Stufen: keine Auskunft \u00b7 bestellt, Zahlung offen \u00b7 bezahlt, wird beschafft \u00b7 liegt zur Pr\u00fcfung \u00b7 gepr\u00fcft \u00b7 beanstandet. Portal, Akte und Verwaltung zeigen dasselbe.",
      "WICHTIG F\u00dcR EUCH: 35 Auskunft-Dokumente liegen zur Pr\u00fcfung \u2014 und KEINES ist gepr\u00fcft. In der Akte steht jetzt „Ein Mitarbeiter muss das Dokument pr\u00fcfen“. Vorher hat das niemand gesehen.",
      "Im Portal steht neben dem Kauf jetzt: „Du hast deine Auskunft schon? Dann lade sie einfach hoch \u2014 du musst nichts kaufen.“ Wer seine Auskunft zu Hause hat, muss keine 74 \u20ac ausgeben.",
      "PAKET-BEZEICHNUNGEN: 39 bezahlte Bestellungen zeigten kein Paket. F\u00fcnf konnten wir aus dem Betrag zur\u00fcckholen (7,99 / 79,99 / 99,99 \u20ac sind eindeutig). Bei den anderen 34 gibt es keinen Hinweis \u2014 dort steht jetzt „Paket unbekannt \u00b7 nachtragen“ statt eines Striches.",
      "Wir raten das Paket NICHT: Ein geratener Name landet in der Rechnung und in der Provisionsrechnung. Bitte im Gespr\u00e4ch kl\u00e4ren und eintragen.",
    ],
    howto: [
      "Auskunft-Dokumente pr\u00fcfen: Kundenakte \u2192 Reiter SCHUFA \u2192 „SCHUFA genehmigen“ oder „Neues Dokument anfordern“.",
      "Steht in einer Liste „Paket unbekannt \u00b7 nachtragen“: Kunde anrufen, Paket kl\u00e4ren, in der Akte eintragen.",
      "Fragt ein Kunde nach seiner Auskunft: Die Akte sagt jetzt genau, woran es liegt und wer dran ist.",
    ],
    link: { href: "/admin/kunden", label: "Zur Kunden-Zentrale" },
    important: true,
  },
  {
    id: "2026-08-21-zweigampel",
    date: "2026-08-17",
    category: "Behoben",
    title: "Die „35 Zweige fehlen“-Meldung war unser Fehler, nicht euer",
    summary:
      "Die Zweigpr\u00fcfung meldete bei allen 35 Ereignissen einen Fehler \u2014 obwohl die Mails ankamen. "
      + "Schuld war eine falsche Abfrage in unserem Code. Und der Pr\u00fcflauf dauert jetzt 30 Sekunden statt zwei Minuten.",
    changes: [
      "DAS WAR DAS PROBLEM: Unsere Abfrage an Brevo fragte nach Daten „bis morgen“. Brevo lehnt Zukunftsdaten ab \u2014 mit einem Fehler, den die Seite als „35 Zweige fehlen“ anzeigte. Die Zweige waren die ganze Zeit in Ordnung.",
      "DREI ZUST\u00c4NDE STATT ZWEI: Die Ampel unterscheidet jetzt „best\u00e4tigt“, „Zweig fehlt“ und „Pr\u00fcfung gest\u00f6rt“. Der dritte z\u00e4hlt NICHT als fehlender Zweig \u2014 er hei\u00dft nur: Wir konnten nicht nachsehen.",
      "Ist der Fehler bei uns, steht das jetzt dran: eine violette Marke „unser Fehler“, dazu der Satz „Nichts in Make zu tun“ und Brevos Originalantwort zum Aufklappen.",
      "SCHNELLER: Der Pr\u00fcflauf schickte 35 Mails einzeln und wartete jedes Mal. Jetzt gehen alle sofort raus, dann wird EINMAL bei Brevo nachgesehen \u2014 etwa 30 Sekunden statt zwei Minuten.",
      "NEUE SEITENORDNUNG: Oben die Ampel und „Alle Zweige pr\u00fcfen“, dann die Ereignisliste, GANZ UNTEN das Zustellprotokoll. Ihr musstet vorher an einer 14-Tage-Liste vorbeiscrollen. Ein Sprungknopf f\u00fchrt direkt zum Protokoll.",
    ],
    howto: [
      "Verwaltung \u2192 E-Mail-Events \u2192 „Alle Zweige pr\u00fcfen“. Vorher oben eine Testadresse eintragen.",
      "Steht „Pr\u00fcfung gest\u00f6rt“: Nichts tun \u2014 das ist unsere Baustelle, nicht Make.",
      "Steht „Zweig fehlt“: Dann lohnt der Blick ins Make-Szenario. Die Liste zum Kopieren steht darunter.",
    ],
    link: { href: "/admin/events", label: "Zu den E-Mail-Events" },
    important: true,
  },
  {
    id: "2026-08-20-eine-quelle",
    date: "2026-08-17",
    category: "Behoben",
    title: "Warum eure E-Mail-Probleme jetzt vorbei sind",
    summary:
      "169 Kunden konnten keine Mail bekommen — obwohl ihre Adresse im System stand. "
      + "Sie stand nur an der falschen Stelle. Das ist behoben, und es kann nicht wiederkommen.",
    changes: [
      "DAS WAR DAS PROBLEM: Eine E-Mail-Adresse konnte an der BESTELLUNG stehen, aber nicht am KUNDEN. Der Versand liest den Kunden — also fand er keine Adresse und tat nichts. Gemessen: 169 Menschen betroffen, davon 17 zahlende Kunden.",
      "Genau das waren die Fälle, die ihr gemeldet habt: Pietro Bianco und Joachim Rechtsteiner. Beide haben jetzt ihre Adresse am Kunden — der Versand findet sie.",
      "ES KANN NICHT WIEDERKOMMEN: Ab jetzt wandert jede Adresse und jede Nummer automatisch an den Kunden, egal wo sie eingetragen wird — Antragsformular, Lead, Kundenakte, Import. Es gibt keinen Weg mehr daran vorbei.",
      "Trägt jemand eine ZWEITE Adresse ein, behält der Kunde seine erste, und die neue wird als Nebenadresse gespeichert. Die Suche findet beide. Nichts geht verloren, nichts überschreibt sich.",
      "DOPPELTE KUNDEN: Weil die Adressen jetzt am Kunden stehen, findet das System Doppelgänger, die vorher unsichtbar waren. Aus 3 Vorschlägen wurden 37 — darunter Maik Matzke, Manuela Schlabs und Pietro Bianco.",
      "Ein Teil davon war früher schon abgelehnt worden („nur der Name passt, kein zweiter Beweis“) — damals richtig, weil die E-Mail fehlte. Jetzt gibt es den zweiten Beweis, und die Vorschläge kommen wieder.",
      "E-MAIL-EVENTS: Die gelben Marken „nicht bestätigt“ bedeuten NICHT, dass Zweige fehlen. Es fehlt ein Zugangsschlüssel zum Mail-Anbieter — ohne ihn kann die Plattform die Zustellung nicht nachprüfen. Das steht jetzt als Karte ganz oben, statt euch rätseln zu lassen.",
      "Und „E-Mail-Events“ hat ein eigenes Zeichen im Menü — vorher dasselbe wie „Mail-Zentrale“ direkt darüber.",
    ],
    howto: [
      "Nichts zu tun — die Umstellung ist gelaufen.",
      "Wenn ihr eine Adresse oder Nummer ändert: Einfach wie bisher in der Kundenakte. Sie landet automatisch an der richtigen Stelle.",
      "Doppelte Kunden: Verwaltung → Dubletten. Dort stehen die 37 Vorschläge mit Begründung.",
      "Wichtig: Zusammenführen ist nicht umkehrbar. Bei Zweifel „keine Dublette“ mit Begründung — Vater und Sohn heißen manchmal gleich.",
    ],
    link: { href: "/admin/dubletten", label: "Zu den Dubletten" },
    important: true,
  },
  {
    id: "2026-08-20-ablauf",
    date: "2026-08-17",
    category: "Neu",
    title: "Der Kundenstatus stimmt jetzt · Kundenakte mit Ablauf-Leiste · 364 Kunden warten auf ihr Startgespräch",
    summary:
      "Bisher stand bei fast jedem bezahlten Kunden „Aktiv“ — auch ohne Startgespräch. "
      + "Jetzt wird der Status aus dem echten Ablauf berechnet, und du siehst in einer Sekunde, wo ein Kunde steht.",
    changes: [
      "DER STATUS WAR FALSCH: Bei 364 von 365 bezahlten Kunden stand „Aktiv · Freigeschaltet“ — obwohl NULL davon je ein Startgespräch geführt hatte. Die Anzeige las eine gespeicherte Spalte statt zu rechnen.",
      "Jetzt gibt es drei klare Zustände: „Kein Zugang“ (nicht bezahlt), „Wartet auf Startgespräch“ (bezahlt, Gespräch fehlt), „Voll aktiv“ (Gespräch geführt). Portal, Akte und dein Cockpit zeigen ALLE dasselbe.",
      "364 KUNDEN SEHEN JETZT DAS GATE: Alle bezahlten Kunden ohne Startgespräch sehen beim nächsten Login die Terminwahl — Bestand eingeschlossen. Sie bekommen keine Mail-Flut: Die Einladung läuft gestaffelt mit höchstens 50 am Tag.",
      "Und sie können wirklich buchen: Weil es noch keinen Onboarding-Mitarbeiter gibt, stellen Vertrieb und Leitung die Termine (5 Zeiten je Tag). Ohne diesen Rückfall hätten 364 Menschen vor einer Tür ohne Termine gestanden.",
      "DEINE KUNDENAKTE: Im Kopf steht jetzt eine ABLAUF-LEISTE — Antrag ✓ · Zahlung ✓ · Startgespräch ○ · Auskunft ○ · Voll aktiv ○ · Abo läuft. Darunter „Nächster Schritt“ mit Knopf. Du siehst in einer Sekunde, was zu tun ist.",
      "Derselbe Kopf steht in deiner Kunden-Schublade im Vertriebs-Cockpit — ein Bauteil, keine zwei Fassungen mehr.",
      "GATE MIT ZWEI KARTEN: Der Kunde sieht Startgespräch UND Bonitätsauskunft (74 €) gleichzeitig, mit Fortschrittsleiste. Die Auskunft ist als „freiwillig“ gekennzeichnet — sie ist keine Bedingung für die Freischaltung.",
      "HÄRTEFÄLLE: In der Akte gibt es „Onboarding-Pflicht aussetzen“ — mit Grund (Pflicht) und deinem Namen, im Kundenverlauf protokolliert. Für Kunden, die wirklich kein Gespräch führen können.",
    ],
    howto: [
      "Kundenakte öffnen: Im Kopf steht die Ablauf-Leiste und darunter „Nächster Schritt“.",
      "Steht dort „Startgespräch einladen“, drück „Einladung senden“ — der Kunde bekommt den Terminlink.",
      "Im Vertriebs-Cockpit: Kunde anklicken, der Kopf zeigt dasselbe Bild.",
      "Härtefall: Akte → „Onboarding-Pflicht aussetzen“ → Grund eintragen. Ohne Grund geht es nicht.",
      "Startgespräche führen kannst du selbst — solange es keinen Onboarding-Mitarbeiter gibt, kommen die Termine zu Vertrieb und Leitung.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-19-datenkosmetik",
    date: "2026-08-17",
    category: "Behoben",
    title: "Paketnamen und Kundennamen werden jetzt richtig angezeigt",
    summary:
      "Im Kundenportal stand „Guten Abend, Justin .\u201c mit hängendem Punkt und in der "
      + "Paket-Kachel nur „Maximum)\u201c. Beides ist behoben — auch in Mails und Listen.",
    changes: [
      "PAKETNAMEN: 6.589 von 6.852 Bestellungen trugen einen Zeilenumbruch mitten im Paketnamen "
      + "(„FIAON High End\u201c / „(Das Maximum)\u201c). Überall, wo der Name einzeilig gebraucht wird "
      + "— Kacheln, Betreffzeilen, Listen, Rechnungen — brach die Anzeige ab.",
      "7.163 Zeilen bereinigt. Und die Ursache ist weg: Die Paketliste im Antrag trennt jetzt Namen und Beisatz, und der Server räumt beim Speichern zusätzlich auf.",
      "KUNDENNAMEN: 1.247 Vornamen und 1.122 Nachnamen hatten ein Leerzeichen am Rand "
      + "(„Violeta \u201c). Daraus wurde in jeder Anrede „Hallo Violeta ,\u201c und im Portal "
      + "„Guten Abend, Violeta .\u201c.",
      "2.642 Felder bereinigt, in Bestellungen und Personen. Ab jetzt räumt der Server bei JEDEM Weg auf: Antrag, deine Stammdaten-Korrektur, Lead-Eingang und Lead-Import.",
      "Geändert wird nur Leerraum — kein Buchstabe, keine Groß-/Kleinschreibung. Ein Name gehört dem Menschen.",
      "PAKET-KACHEL: Sie zeigte „Maximum)\u201c — das letzte Wort samt Klammer. Jetzt steht dort "
      + "„High End\u201c. Das war ein eigener Fehler, den der Zeilenumbruch nur verdeckt hatte.",
    ],
    howto: [
      "Du musst nichts tun. Wenn du einen Namen korrigierst, räumt der Server Leerzeichen automatisch weg.",
      "Falls dir irgendwo noch ein abgeschnittener Paketname auffällt: melde ihn — dann ist dort "
      + "noch eine Stelle, die den Namen zerlegt.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
  },
  {
    id: "2026-08-19-kundensicht",
    date: "2026-08-17",
    category: "Neu",
    title: "Portal ansehen als Kunde (Leitung) · „Wir rufen an“ steht jetzt überall · Nummer groß im Cockpit",
    summary:
      "Die Vertriebsleitung kann das Kundenportal so sehen, wie der Kunde es sieht — Nur-Ansicht. Und auf der Terminseite steht unübersehbar, dass angerufen wird.",
    changes: [
      "PORTAL ANSEHEN (nur Vertriebsleitung): In der Kunden-Schublade unter „Verwaltung“ steht „Portal ansehen als [Vorname]“. Öffnet das echte Kundenportal in einem neuen Tab — genau so, wie der Kunde es sieht.",
      "NUR-ANSICHT: In dieser Sitzung ist JEDE Aktion abgeschaltet. Du kannst nichts bestellen, melden, hochladen oder ändern — auch nicht versehentlich. Ein blauer Balken oben zeigt durchgehend, dass du im Portal eines anderen bist.",
      "30 MINUTEN, dann ist Schluss. Start und Ende stehen im Verlauf des Kunden — das ist Absicht: Wenn ein Kunde fragt, wer in sein Konto gesehen hat, muss die Antwort dort stehen.",
      "NUR EIGENE UND ZUGEWIESENE Kunden. Bei einem fremden Kunden sagt der Server, warum es nicht geht. Agenten ohne Leitungsrolle haben diesen Knopf nicht.",
      "„WIR RUFEN AN“: Auf der Terminseite und in der Startgespräch-Tafel steht jetzt in einer eigenen Zeile mit Telefon-Zeichen: „[Name] ruft dich zur vereinbarten Zeit an — halte dein Telefon bereit.“ Vorher stand das am Ende eines Absatzes und wurde überlesen.",
      "Der Grund: Wer heute einen Termin bucht, erwartet einen Video-Link und sitzt dann vor dem Rechner, während sein Telefon klingelt. Danach glaubt er, WIR hätten uns nicht gemeldet.",
      "Derselbe Satz fährt jetzt auch in der Bestätigungs- und Erinnerungsmail mit.",
      "COCKPIT: Die Rufnummer steht GROSS im Kopf, in Gruppen und zum Ablesen — mit Anrufen-Knopf daneben. Wenn das Softphone gerade nicht will, wählst du vom Handy, ohne im Gesprächsblatt zu suchen.",
      "Fehlt die Nummer ganz, steht das jetzt als Warnung im Kopf statt als leere Stelle.",
    ],
    howto: [
      "Kunden-Schublade öffnen → Reiter „Verwaltung“ → „Portal ansehen als …“. Neuer Tab geht auf.",
      "Oben im blauen Balken steht der Name des Kunden und die Restzeit. „Beenden“ bringt dich zurück.",
      "Wenn du im Portal etwas anklickst, das etwas verändern würde, kommt ein Hinweis „Nur-Ansicht“ — nichts passiert.",
      "Startgespräch: Die Nummer im Kopf ist antippbar (wählt am Gerät) — oder „Anrufen“ für das Softphone.",
    ],
    link: { href: "/agent/vertrieb", label: "Zum Vertriebs-Cockpit" },
    important: true,
  },
  {
    id: "2026-08-18-kundenweg",
    date: "2026-08-17",
    category: "Neu",
    title: "Deine Leads bekommen jetzt dauerhaft Post · Nur noch 5 Termine je Tag · 15 € je Startgespräch",
    summary:
      "Die Mail-Strecke an Leads endet nicht mehr nach sechs Mails. Kunden sehen weniger freie Termine — das lässt den Kalender voll wirken. Und Startgespräche werden vergütet.",
    changes: [
      "LEADS BEKOMMEN DAUERHAFT POST: Bisher endete die Strecke nach sechs Mails, danach war Funkstille. Gemessen: 1.483 deiner Leads standen an diesem Ende und bekamen nichts mehr — 2.700 warten insgesamt auf eine Fortsetzung. Und 23 Kunden kamen erst NACH der achten Mail.",
      "Neuer Takt: Tag 1, 3, 7, 14, 30 — danach einmal im Monat, ohne Ende. Zwölf verschiedene Texte wechseln sich ab, damit nie zweimal dasselbe kommt.",
      "STOPP HEISST STOPP: Sobald ein Lead einen Antrag stellt, hört die Strecke auf — dann rufst DU an, und niemand bekommt beides. Ebenso bei Zahlung, Abmeldung oder toter Adresse.",
      "Jede Mail hat jetzt einen Abmelde-Link. Wer klickt, ist sofort draußen. Das ist besser als der Spam-Knopf, der alle unsere Mails mit runterzieht.",
      "NUR NOCH 5 TERMINE JE TAG: Ein Kunde sah 27 freie Zeiten pro Tag — das sagt „hier ist nichts los“. Jetzt sieht er fünf, verteilt über den Tag. Deine Verfügbarkeit ändert sich NICHT, nur was der Kunde sieht.",
      "BONITÄTSAUSKUNFT AN DER RICHTIGEN STELLE: Nach dem Buchen des Startgesprächs sieht der Kunde die Auskunft (74 €) mit Kopierknöpfen für IBAN und Verwendungszweck. Gemessen: 287 bezahlte Kunden haben noch keine.",
      "STARTGESPRÄCH: Neuer Pflichtschritt „Abo-Klarheit“ — laufende Kosten, Kündigungsweg, und dass die 74 € einmalig sind. Mit Notizpflicht. Jeder Streitfall beginnt mit „Ich dachte, das war einmalig“.",
      "15 € JE ERLEDIGTES STARTGESPRÄCH, automatisch gutgeschrieben. Genau eine Gutschrift je Kunde — ein zweites Gespräch mit demselben Menschen bringt keine zweite.",
    ],
    howto: [
      "Für die Lead-Strecke musst du nichts tun — sie läuft von selbst. Wenn ein Lead antwortet oder bestellt, hört sie automatisch auf.",
      "Startgespräch führen: Die Agenda hat jetzt sieben Schritte. Bei „Abo-Klarheit“ Betrag und nächstes Abbuchungsdatum nennen, Kündigungsweg erklären, und die Antwort des Kunden in die Notiz.",
      "Ohne diese Notiz lässt sich das Gespräch nicht abschließen — das ist Absicht.",
      "Deine Onboarding-Vergütung steht in der Provisionsübersicht als eigene Zeile.",
    ],
    link: { href: "/agent/onboarding", label: "Zum Onboarding-Bereich" },
    important: true,
  },
  {
    id: "2026-08-17-betrieb",
    date: "2026-08-17",
    category: "Behoben",
    title: "Mehrere Buchungen auf einmal wegräumen · Termin-Erinnerungen kommen wieder an",
    summary:
      "Häkchen an den Buchungen und EIN Dialog statt achtzehn. Und: Erinnerungen, die nicht rausgingen, gelten nicht mehr als verschickt.",
    changes: [
      "MEHRFACH WEGRÄUMEN: Ein Kunde hatte 18 offene Buchungen — einzeln wegräumen heißt 18 Bestätigungsdialoge. Gemessen: 406 Menschen mit 1.083 Mehrfach-Buchungen. Jetzt gibt es Häkchen und einen Sammelknopf.",
      "Der Dialog nennt Anzahl und Summe. Gebucht wird der Reihe nach — und wenn eine nicht wegkann (bezahlt, oder es ist die letzte), sagt die Meldung WELCHE und warum. Bezahlte Buchungen und die letzte verbleibende bleiben in jedem Fall stehen.",
      "TERMIN-ERINNERUNGEN: 35 Erinnerungen galten als verschickt, obwohl keine Mail rausging — der Kunde wusste von seinem Termin nichts mehr. Von 63 erinnerten Terminen wurden 54 zu No-Shows. Ab jetzt gilt eine Erinnerung nur als verbraucht, wenn sie WIRKLICH rausging.",
      "5 Erinnerungen für kommende Termine sind neu eingeplant. Für vergangene Termine wird nichts nachgeschickt — eine Erinnerung an ein Gespräch von vorgestern ist peinlich.",
      "Nebenbei: Die Zähler-Marken im Menü zeigen jetzt dieselbe Zahl wie die Seite dahinter. Vorher stand bei den Aufgaben eine 0, während acht offen waren.",
    ],
    howto: [
      "Kundenkarte öffnen, „Details“ aufklappen. Bei den Buchungen steht neben jeder unbezahlten ein Häkchen „wählen“.",
      "Mehrere anhaken → oben erscheint „Auswahl wegräumen (N)“. Einmal drücken, einmal bestätigen, fertig.",
      "„Auswahl aufheben“ nimmt die Häkchen zurück, ohne etwas zu tun.",
      "Einzeln geht weiter wie bisher über „Doppelt — wegräumen“.",
    ],
    link: { href: "/agent/kunden", label: "Zu meinen Kunden" },
    important: true,
  },
  {
    id: "2026-08-16-onboarding-pflicht",
    date: "2026-08-16",
    category: "Neu",
    title: "Das Startgespräch schaltet das Konto frei — und es gibt eine Gesprächsbühne dafür",
    summary:
      "Ein bezahlter Kunde kommt ins Portal, sieht aber seinen Fahrplan erst nach dem Startgespräch. Freischalten kann nur das Onboarding-Team — mit EINEM Knopf.",
    changes: [
      "Neue Regel: Zahlung gebucht → Kunde bekommt Zugang → PFLICHT-Startgespräch → erst danach ist sein Konto voll freigeschaltet. Vorher war das Gespräch ein Angebot, das man wegklicken konnte.",
      "Der Kunde ist nie ausgesperrt: Er sieht sein Konto, seine Rechnungen, den Stand seiner Unterlagen und die Bonitätsauskunft samt Zahlweg. Nur Fahrplan und Inhalte warten — hinter einer Karte, die den Grund NENNT, nicht hinter einer Fehlerseite.",
      "Für BESTANDSKUNDEN ändert sich nichts am Zugang. Gemessen hatten 349 bezahlte Kunden noch kein Startgespräch — die auszusperren wäre Support-Feuer gewesen. Sie bekommen einen Banner und eine Einladung.",
      "NEU im Onboarding-Bereich: die Gesprächsbühne. Termin öffnen → „Gespräch führen“. Darin: Kunde und Zahlungsstand im Kopf, Anrufen-Knopf, mitlaufende Uhr, sechs abhakbare Agenda-Schritte mit Stichpunkten zum Vorlesen, Notizfeld je Schritt.",
      "Ein Knopf schließt ab: „Gespräch abschließen & freischalten“. Er setzt den Termin erledigt, schaltet das Konto frei und schreibt eure Notizen als EIN Protokoll in die Akte. „Kunde nicht erschienen“ steht daneben und lädt ihn erneut ein.",
      "Wichtig zur Bonitätsauskunft: Es ist eine AUSKUNFT, keine Beratung. Die Stichpunkte im Cockpit sind so formuliert — bitte auch am Telefon so sagen. „Wir beraten Sie“ verspricht eine Leistung, die wir nicht erbringen.",
      "Neuer Kennzahlen-Kopf: heute geplant · heute erledigt · nicht erschienen · Ø Dauer · freigeschaltet in 7 Tagen · Erledigungsquote.",
    ],
    howto: [
      "„Startgespräche“ öffnen. Oben stehen die sechs Zahlen für deinen Tag.",
      "Einen Termin anklicken, dann „Gespräch führen“ — die Bühne öffnet sich über der Liste.",
      "„Anrufen“ drücken: Das Telefon öffnet sich mit dem richtigen Kunden. Die Uhr läuft ab jetzt mit; 15 Minuten sind zugesagt.",
      "Schritt für Schritt durchgehen: auf den Titel tippen klappt die Stichpunkte auf, der Haken links hakt ab. Bei drei Schritten ist eine Notiz Pflicht — ohne sie bleibt der Abschluss-Knopf grau und sagt, was fehlt.",
      "Am Ende „Gespräch abschließen & freischalten“. Erst dann sieht der Kunde seinen Fahrplan.",
      "Ist er nicht dran: „Kunde nicht erschienen“. Das zählt als Fehlversuch und lädt ihn automatisch neu ein — das Konto bleibt eingeschränkt.",
    ],
    link: { href: "/agent/startgespraeche", label: "Zu den Startgesprächen" },
    important: true,
  },
  {
    id: "2026-08-16-arbeitsfluss",
    date: "2026-08-16",
    category: "Behoben",
    title: "Termine abhaken geht wieder · Telefon-Ergebnis wirkt jetzt auf die Liste · Rückrufe mit Frist",
    summary:
      "Sieben Sachen aus eurem Feedback. Bei zwei davon war die Ursache schlimmer als gemeldet.",
    changes: [
      "TERMINE ABHAKEN: Ging bei kundengebuchten Terminen nicht — und hätte, wenn es „gegangen“ wäre, den Rückruf eines FREMDEN Kunden als erledigt abgestempelt. Der Kalender mischt zwei Tabellen, deren Nummern sich überschneiden: 101 Termine trugen eine Nummer, die auch ein Verlaufseintrag trug, bei 33 davon gehörte er einem anderen Menschen. Passiert ist es noch nicht. Jetzt trifft der Haken die richtige Stelle.",
      "Dazu: 54 Termine standen auf „verpasst“ und ließen sich deshalb nie abschließen — sie kamen nach jedem Neuladen wieder. Auch das geht jetzt. Und wer einen Kunden betreut, kann seinen Termin abhaken, auch wenn der Termin ursprünglich einem anderen gehörte.",
      "ABSAGEN: Sagte ein Kunde ab, war der Termin sofort aus jeder Ansicht verschwunden — niemand hat es erfahren. 10 Absagen, keine einzige gemeldet. Ab jetzt: E-Mail an dich bei Buchung UND Absage, und der Termin bleibt 7 Tage im Kalender stehen mit „Abgesagt am … durch den Kunden“.",
      "TELEFON-ERGEBNIS: „Nicht erreicht“ aus dem Telefon-Panel wirkte nicht auf die Kundenliste. Gemessen: 554 von 842 Anrufen mit Ergebnis hatten KEINEN Eintrag in der Akte. Am schlimmsten bei Rückrufen — die kamen nie in den Kalender und wurden nie fällig. Panel und Liste gehen jetzt denselben Weg.",
      "„ERREICHT — SONSTIGES“: Im Telefon-Panel gab es kein Notizfeld, in der Akte stand nur „Sonstiges“. Jetzt ist die Notiz dort Pflicht (min. 10 Zeichen) und bei allen anderen Ergebnissen freiwillig möglich.",
      "FALSCHE NUMMER: Nach der Bitte an den Kunden stand die Karte weiter jeden Tag in deiner Liste, obwohl du nichts tun konntest — 185 solche Fälle, 120 davon älter als eine Woche. Sie liegen jetzt im neuen Filter „Wartend (Kunde)“ und kommen von selbst zurück, sobald der Kunde die Nummer einträgt oder einen Termin bucht.",
      "RÜCKRUFE: Ein Kunde ruft an, es wird notiert, niemand meldet sich — 18 Rückrufe waren länger als 24 Stunden überfällig, ohne dass es jemand erfuhr. Jeder Rückruf-Wunsch bekommt jetzt 24 Stunden Frist und eine dringende Aufgabe bei dir. Reißt die Frist, erfährt es die Leitung. Erledigen geht nur mit einer Notiz, was besprochen wurde.",
      "Und: „Gelesen“ auf deiner Startseite machte die Seite manchmal weiß. Behoben.",
    ],
    howto: [
      "Kalender öffnen: Kundentermine haben jetzt zwei Knöpfe — den Haken für „erledigt“ und „Nicht erschienen“. Abgesagte Termine stehen in Orange da, mit Zeit und „durch den Kunden“.",
      "Telefon-Panel: Nach dem Gespräch ein Ergebnis drücken wie bisher. Bei „Erreicht – Sonstiges“ öffnet sich ein Notizfeld — ohne Text geht es nicht weiter. Bei allen anderen kannst du über „Notiz hinzufügen“ freiwillig etwas festhalten.",
      "In „Meine Kunden“ gibt es den neuen Filter „Wartend (Kunde)“. Dort stehen die, bei denen wir auf eine Antwort warten. Du musst da nichts tun — die Karten kommen von selbst zurück.",
      "Rückrufe stehen in deinen Aufgaben, dringend und mit Frist. Zum Abhaken kurz eintragen, was besprochen wurde.",
    ],
    link: { href: "/agent/kalender", label: "Zum Kalender" },
    important: true,
  },
  {
    id: "2026-08-16-abo-motor",
    date: "2026-08-16",
    category: "Verbessert",
    title: "Eine Karte je Mensch — und der Abo-Termin ist jetzt „sein Tag“",
    summary:
      "Die Inkasso-Liste zeigt jeden Kunden nur noch EINMAL. Und die Monatsrate ist am Jahrestag der Buchung fällig, nicht mehr alle 30 Tage.",
    changes: [
      "Euer Befund: „Zusner dreimal, Namen wiederholen sich beim Scrollen.“ Gemessen waren es 213 Zeilen für 180 Menschen — 21 Namen kamen mehrfach vor. Jede Rate war eine eigene Zeile.",
      "Jetzt gibt es EINE Karte je Mensch. Darauf steht die dringendste Rate; „Alle N Raten zeigen“ klappt die übrigen auf. Jede Rate behält ihren eigenen Ergebnis-Knopf — eine Zusage gehört zu Rate 3, nicht zu dem Menschen.",
      "Neu auf der Karte: „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch raus.“ Das ist die Antwort auf die häufigste Rückfrage am Telefon („wieso schon wieder?“) — ohne die Akte zu öffnen.",
      "Neu: die Warnung „Zweites Abo — 2 Bestellungen laufen parallel. Vor dem Mahnen klären.“ Peter Zußner hatte zwei bezahlte Pro-Bestellungen und wurde doppelt abgerechnet. Wer da mahnt, mahnt eine Doppelbelastung ein.",
      "Der Abo-Termin: Wer am 05.07. bezahlt hat, ist am 05.08., 05.09., 05.10. fällig — sein Tag. Vorher rechnete das System +30 Tage, und der Termin wanderte jeden Monat nach vorn: 266 von 289 Raten lagen daneben. 266 Fälligkeiten wurden korrigiert, meist um einen Tag.",
      "Behoben: Manche von euch trugen Mahnstufe 1, ohne je eine Mahnung bekommen zu haben — aus einem alten Bestandsnachtrag. Eine Mahnstufe steigt jetzt nur, wenn eine vorherige Mahnung WIRKLICH rausging. Vier Raten an unbezahlten Bestellungen wurden storniert.",
    ],
    howto: [
      "Forderungsmanagement öffnen. Über der Liste steht jetzt „X Menschen · Y offene Raten“.",
      "Eine Karte lesen: Name, Summe ALLER offenen Raten, dringendste Fälligkeit, Abo-Zyklus im Klartext.",
      "Mehr als eine Rate? „Alle N Raten zeigen“ drücken — dann steht jede Rate mit ihrem Verwendungszweck da, jede mit eigenem „Ergebnis“-Knopf.",
      "Steht „Zweites Abo“ auf der Karte: NICHT mahnen, sondern an die Leitung geben. Der Kunde zahlt zweimal für dasselbe.",
    ],
    link: { href: "/agent/inkasso", label: "Zum Forderungsmanagement" },
    important: true,
  },
  {
    id: "2026-08-16-anruf-nummer",
    date: "2026-08-16",
    category: "Behoben",
    title: "Der Anruf gehört jetzt zu der Nummer, die du gewählt hast",
    summary:
      "Vorher konnte eine Aufnahme in einer fremden Akte landen. Das Panel sagt dir jetzt VOR dem Wählen, wen du anrufst.",
    changes: [
      "Euer Befund: „Mehrfach steht ‚Diana — Mailbox gesprochen‘, aber die Aufnahme gehört zu einer komplett anderen Person.“ Ihr hattet recht, und die Ursache war ein Fehler von uns.",
      "Der Anruf wurde der offenen KUNDENKARTE zugeordnet, nicht der gewählten Nummer. Wer eine Karte offen hatte und nebenher eine andere Nummer eintippte, hängte Aufnahme, Transkript und KI-Notiz an die falsche Akte.",
      "Gemessen: 5 von 1.002 Anrufen waren betroffen, einer mit Aufnahme. 2 wurden eindeutig umgehängt (samt Aufnahme, Transkript und Zusammenfassung), 4 unklare tragen jetzt „Zuordnung prüfen“.",
      "Ab jetzt entscheidet die gewählte Nummer — auch eine frühere Nummer des Kunden wird erkannt. Ergebnis, Transkript und KI-Notiz folgen immer der Person, die wirklich am Apparat war.",
      "Im Panel steht vor dem Wählen grün „Du rufst [Name] an.“ Bei einer unbekannten Nummer steht gelb „Unbekannte Nummer — der Anruf wird keiner Akte zugeordnet“; dann ordne ihn im Ergebnis-Schritt zu.",
      "Ebenfalls behoben: Du kannst Stammdaten deiner Kunden jetzt wirklich bearbeiten. Forderungsmanagement, Onboarding und Vertriebsleitung bekamen vorher „nicht gefunden“ — das Forderungsmanagement durfte anrufen, aber eine falsche Nummer nicht korrigieren.",
      "Eine geänderte Nummer erreicht jetzt auch deine Kollegen: Sie wird an der PERSON gespeichert, nicht nur an der Bestellung. Die alte Nummer bleibt als Zweitnummer erhalten — ruft der Kunde von ihr an, wird er weiter erkannt.",
    ],
    howto: [
      "Nummer ins Panel tippen. Nach kurzem Moment erscheint „Du rufst [Name] an.“",
      "Steht dort ein ANDERER Name als auf der offenen Karte: Das ist richtig — es zählt die Nummer. Prüfe, ob du die richtige Nummer hast.",
      "Steht „Unbekannte Nummer“: Du kannst telefonieren, musst den Anruf danach aber im Ergebnis-Schritt einem Kunden zuordnen.",
      "Falsche Telefonnummer oder E-Mail? Im Kunden aufklappen, Bleistift antippen, korrigieren. Alt → neu wird mit deinem Namen protokolliert.",
    ],
    important: true,
  },
  {
    id: "2026-08-13-doppelte-buchungen",
    date: "2026-08-13",
    category: "Neu",
    title: "Doppelte Buchungen kannst du selbst wegräumen",
    summary:
      "Hat ein Kunde denselben Antrag mehrfach gestellt? Frag am Telefon, welchen er will — die anderen räumst du weg.",
    changes: [
      "Daniels Frage: „Man sieht jetzt alle Anträge. Fragt man dann am Telefon nach, welchen die Person möchte, löscht die anderen und sendet die Zahlungsdaten? Weil Anträge rauslöschen geht nicht.“ Ab jetzt geht es.",
      "An jeder doppelten Buchung steht „Doppelt — wegräumen“. Sie verschwindet aus deiner Liste. Alle Rollen dürfen das: Vertrieb, Vertriebsleitung, Onboarding und Forderungsmanagement.",
      "WICHTIG: Es wird archiviert, nicht gelöscht. Für dich sieht es gleich aus — aber Provisionsnachweis und Zahlungsspur bleiben, und die Vertriebsleitung kann eine falsch weggeräumte Buchung zurückholen.",
      "Bezahlte Buchungen lassen sich NICHT wegräumen. Sie stehen in den Umsatzzahlen; eine bezahlte Bestellung herauszunehmen wäre eine Umsatzkorrektur, keine Aufräumarbeit.",
      "Die letzte Buchung bleibt immer stehen. Ein Kunde ohne Bestellung hat keinen Anlass mehr — wenn er ganz weg soll, melde ihn als Testeintrag.",
      "Daniels zweite Frage („oder wird die E-Mail bei dem Antrag geschickt, wo Zahlung gemeldet steht?“): Ja. Wenn eine der Buchungen „Zahlung gemeldet“ trägt, steht das jetzt im Buchungs-Block — der Kunde hat sich für DIESE entschieden. Bei 59 Kunden ist das so.",
      "Gemessen: 420 Kunden haben mehrere offene Buchungen. Einer hat 19.",
    ],
    howto: [
      "Kunde aufklappen, Abschnitt „Buchungen“ ansehen.",
      "Am Telefon fragen, welches Paket er wirklich will — oder nachsehen, ob eine Buchung „Zahlung gemeldet“ trägt.",
      "Bei den anderen „Doppelt — wegräumen“ drücken.",
      "Dann „Zahlungsdaten senden“ für die richtige Buchung.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-verkaufsstart",
    date: "2026-08-11",
    category: "Neu",
    title: "Verkaufsstart: 264 Kunden warten auf ihre erste Rechnung",
    summary:
      "Kunden mit fertigem Antrag, denen nie jemand eine Rechnung geschickt hat. Ab heute stehen sie in eurer Liste.",
    changes: [
      "WORUM ES GEHT: 450 Kunden haben einen vollständigen Antrag gestellt — Paket gewählt, Daten eingetragen, abgeschickt. Und dann? Nichts. Ihnen wurde nie eine Rechnung geschickt. Manche warten seit über zwei Monaten.",
      "WARUM DAS PASSIERT IST: Das System hat diese Kunden unter „Antrag fertig – Rechnung offen“ geführt. Der Name war falsch: Es gab keine Rechnung. Der Knopf „Zahlungsdaten senden“ meldete deshalb „Dieser Kunde hat keine offene Bestellung“ — und niemand kam weiter.",
      "WAS SICH GEÄNDERT HAT: Derselbe Knopf stellt die Rechnung jetzt selbst. Er setzt den Betrag aus dem gebuchten Paket, eine Zahlungsfrist von sieben Tagen und den Verwendungszweck — und verschickt alles.",
      "EURE LISTE: Der neue Filter „Rechnung stellen“ zeigt genau diese Kunden. Die Zahl daneben ist eure eigene, nicht die vom ganzen Haus.",
      "ALLE KUNDEN SIND VERTEILT: 22 Kunden hatten keinen Betreuer. Sie sind auf die Kollegen mit der kleinsten Last aufgeteilt.",
      "WAS DAS FÜR EUCH HEISST: Das sind keine kalten Leads. Diese Menschen haben sich ENTSCHIEDEN und einen Antrag gestellt. Sie warten nur darauf, zahlen zu können.",
    ],
    howto: [
      "Kundenliste öffnen, Filter „Rechnung stellen“ antippen.",
      "WICHTIG: Erst anrufen, dann senden. Bei einem zwei Monate alten Antrag kommt eine Rechnung aus dem Nichts — ein kurzer Anruf („Ihr Antrag liegt bei uns, ich schicke Ihnen jetzt die Zahlungsdaten“) macht den Unterschied zwischen Zahlung und Rückfrage.",
      "Dann „Zahlungsdaten senden“ drücken. Betrag, Verwendungszweck und Frist gehen automatisch mit.",
      "Steht ein Hindernis an der Karte — meist „Keine E-Mail hinterlegt“ — erfragt die Adresse am Telefon und tragt sie in der Akte nach.",
      "Nach dem Senden steht der Kunde unter „Rechnung offen“. Ab da läuft der normale Nachfass-Weg.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-erste-rechnung",
    date: "2026-08-11",
    category: "Neu",
    title: "Neuer Filter „Rechnung stellen“ — hier liegt Arbeit",
    summary:
      "Kunden mit fertigem Antrag, die nie eine Rechnung bekamen. Ein Knopf stellt sie und verschickt sie.",
    changes: [
      "Der neue Filter zeigt Kunden, deren Antrag vollständig ist, denen aber nie eine Rechnung geschickt wurde. Bei manchen liegt das über zwei Monate zurück.",
      "„Zahlungsdaten senden“ tut jetzt beides: Es setzt Betrag (aus dem Paket) und Zahlungsfrist (sieben Tage) und verschickt die Rechnung. Vorher kam dort „Dieser Kunde hat keine offene Bestellung“ — das war der Grund, warum bei euch nichts ging.",
      "Wo es nicht geht, steht warum: „Keine E-Mail hinterlegt“ oder „Der Antrag ist noch nicht abgeschlossen (Stand: contract)“. Dann ist ein Anruf dran, keine Mail.",
      "In den Buchungen steht jetzt der Preis aus dem Paket, auch wenn noch kein Betrag gebucht ist. Vorher stand dort „Offen insgesamt: 0,00 €“, obwohl 59,99 € offen waren.",
      "Zusätzlich läuft täglich ein Versand für höchstens 50 Kunden. Euer Knopf ist trotzdem wichtiger: Bei einem zwei Monate alten Antrag ist ein Anruf vor der Rechnung mehr wert als jede Automatik.",
    ],
    howto: [
      "Kundenliste öffnen, Filter „Rechnung stellen“ antippen.",
      "Kunden anrufen, Paket bestätigen, dann „Zahlungsdaten senden“ drücken.",
      "Steht ein Hindernis dabei: erst das lösen — meist fehlt die E-Mail-Adresse.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-rueckmeldung-punkt-1-5",
    date: "2026-08-11",
    category: "Behoben",
    title: "Eure Rückmeldung: Punkte 1 bis 5",
    summary:
      "Listen und Zahlen stimmen wieder. Was gemeldet wurde, was dahintersteckte, was jetzt gilt.",
    changes: [
      "1 · ANTRAG FERTIG – RECHNUNG OFFEN: Der Titel versprach eine Rechnung, die es nicht gab. Gemessen: Von 866 Kunden mit diesem Grund hatte GENAU EINER eine offene Rechnung. Heißt jetzt „Antrag fertig — Rechnung noch nicht gestellt“. Eure Aufgabe dort ist, die ERSTE Rechnung zu schicken — danach wird daraus ein Fall für die Nachfass-Liste.",
      "1b · Warum „Lead“ und „Antrag fertig“ sich ähnelten: Bei beiden wurde nie Geld gefordert. Der Unterschied steht jetzt im Titel.",
      "2 · BEZAHLT: Die Einstufung nahm den höchsten Rang — ein bezahltes Paket schlug eine offene Bonitätsauskunft. Jetzt schlägt eine echte offene Rechnung das „Bezahlt“. 39 Kunden sind zurück im Vertrieb, wo sie hingehören.",
      "2b · Ein alter abgebrochener Antrag wirft euch NICHT zurück in die Liste. Der erste Entwurf hätte das getan — 134 bezahlte Kunden wären fälschlich zurückgekommen.",
      "3 · BUCHUNGEN IN DEN STAMMDATEN: Aufgeklappt seht ihr jetzt alles — welches Paket, welche Zusatzleistung (als solche markiert), was bezahlt und was offen ist, wann der Antrag gestellt wurde. Dazu der Verwendungszweck und die Summe des Offenen. Für JEDEN Mitarbeiter, nicht nur die Leitung.",
      "4 · PAKET VERSCHWINDET: Die Karte zeigte nur die NEUESTE Bestellung. Bei Shahed Mohammad gewann seit dem 31.07. die Bonitätsauskunft — das Paket verschwand. 410 Kunden haben mehr als eine offene Buchung; bei allen fehlte etwas. Jetzt seht ihr beides.",
      "4b · Zur Frage, wie er die Bonitätsauskunft ohne Zahlung beantragen konnte: Sein Konto war nie freigeschaltet. Die Bonitätsauskunft ist ein Einmalprodukt über ein eigenes Formular und braucht kein Konto. Das ist so gewollt — es fehlte nur die Sichtbarkeit.",
      "5 · ZAHLEN STIMMEN NICHT: Die Zähler oben zählten Testeinträge und ruhende Kunden mit, die Liste nicht. Heute ergab das zufällig dieselbe Zahl — sobald jemand in den Ruhe-Pool wandert, klaffte es wieder. Beide zählen jetzt dieselbe Menge.",
    ],
    howto: [
      "Nichts einzurichten. Wenn eine Zahl oben nicht zur Liste passt: sagt es sofort — genau so ist das hier gefunden worden.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-rueckmeldung-punkt-6-10",
    date: "2026-08-11",
    category: "Behoben",
    title: "Eure Rückmeldung: Punkte 6 bis 10",
    summary:
      "Termine, Erinnerungen und das Telefon. Ein Punkt davon war ein Rechtsproblem.",
    changes: [
      "6 · RÜCKRUFTERMINE VERSCHOBEN SICH: „Morgen 10:00“ wurde 12:00. Zwei Routen schrieben die Uhrzeit als UTC statt als Berliner Zeit. Behoben. WICHTIG: Acht bestehende Termine standen noch falsch — schaut eure Rückrufe bitte einmal durch, drei lagen nach 21 Uhr.",
      "7 · TERMIN-ERINNERUNG: Eine Leiste am oberen Rand zeigt anstehende UND überfällige Termine, zählt herunter und führt mit einem Klick zum Kunden. Sie blockiert nichts. Wegklicken hält sie fünf Minuten still — ein Termin, den man wegklickt, ist nicht erledigt.",
      "8 · TERMIN FÜHRT ZUM KUNDEN: Der Sprung war gebaut, ging aber ins Leere, wenn der Kunde nicht in der gerade gefilterten Liste stand. Jetzt landet ihr immer beim richtigen — auch wenn er ruht oder bezahlt hat.",
      "9 · ERREICHT – SONSTIGES: Neuer Status für Gespräche ohne klares Ergebnis. Beim Anklicken öffnet sich direkt die Notiz. Zählt als Gespräch (nicht als Fehlversuch), setzt keine Zusage, Wiedervorlage in drei Tagen. Ohne Text wird nicht gespeichert — in drei Tagen weiß sonst niemand mehr, worum es ging.",
      "10 · DIE ANSAGE HÖRTE NUR IHR: Das war ein Rechtsproblem, kein Schönheitsfehler. Die Aufzeichnungs-Ansage lief, BEVOR der Kunde gewählt wurde — er wurde also ohne Hinweis aufgezeichnet. §201 StGB verlangt, dass der Hinweis den erreicht, der aufgezeichnet wird. Jetzt hört sie der Kunde beim Abnehmen; ihr spart dabei zwölf Sekunden je Anruf.",
      "10b · ERGEBNIS VERSCHWAND: Ein abgebrochener Wählversuch erzeugt eine eigene Zeile. Euer Ergebnis landete am zweiten Versuch, der erste blieb ewig offen. Jetzt gilt ein Ergebnis für alle Versuche desselben Gesprächs (zwei Stunden Fenster).",
      "10c · Vier Anrufe hingen auf „läuft“, weil der Browser geschlossen wurde, bevor Twilio den Schlussvermerk schicken konnte. Nach einer Stunde gelten sie als beendet und verschwinden aus der Liste.",
      "10d · STAMMDATEN IM GESPRÄCH: Paket, offener Betrag, Verwendungszweck, E-Mail und Ort stehen jetzt eingeklappt im Telefon. Wer gefragt wird „welches Paket habe ich denn?“, muss das Gespräch nicht mehr verlassen.",
    ],
    howto: [
      "Prüft eure bestehenden Rückruftermine — acht standen mit falscher Uhrzeit.",
      "Zur Lautstärke: Die lag nicht am System, sondern an der Audio-Ausgabe des Rechners. Prüft in den Systemeinstellungen, ob der Browser auf dem richtigen Lautsprecher liegt.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-eingehende-anrufe",
    date: "2026-08-11",
    category: "Neu",
    title: "Kunden können dich jetzt anrufen",
    summary:
      "Wenn ein Kunde anruft, klingelt es beim Zuständigen — und du siehst sofort, wer dran ist und worum es geht.",
    changes: [
      "Es klingelt NICHT bei allen. Zuerst beim Zuständigen: bei offener Rate im Forderungsmanagement, sonst beim betreuenden Ansprechpartner.",
      "Im Klingelfenster steht der Name des Kunden, sein Paket und der Grund — zum Beispiel „Rate seit 75 Tagen offen (179,97 €)“.",
      "Steht dort „Vertretung“, ist eigentlich jemand anderes zuständig und du springst nur ein.",
      "„Weitergeben“ beendet den Anruf NICHT — er geht an den nächsten Kollegen.",
      "Während du telefonierst, klingelt es bei dir nicht. Der Anruf läuft automatisch weiter.",
      "Im Display steht „Bereit · erreichbar“, wenn Anrufe bei dir ankommen können. Schließt du den Tab, bist du nicht erreichbar.",
    ],
    howto: [
      "Nichts einzurichten. Halte das Portal offen, dann bist du erreichbar.",
      "Beim Annehmen öffnet sich das Telefon mit dem Kunden — Ergebnis und Notiz gleich zur Hand.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-inkasso-akte",
    date: "2026-08-11",
    category: "Neu",
    title: "Forderungsmanagement: die Akte zum Telefonieren",
    summary:
      "Ein Klick auf „Akte öffnen“ zeigt sofort, seit wann die Rate offen ist, den Betrag, die Mahnstufe — und die Nummer zum Anrufen.",
    changes: [
      "Ganz oben: seit wie vielen Tagen die Rate offen ist. Das ist dein erster Satz am Telefon.",
      "Daneben: Betrag, Mahnstufe, wie viele Erinnerungen schon raus sind, wie viele Raten der Kunde schon bezahlt hat.",
      "„Anrufen“ mit der richtigen Nummer und „Rechnung jetzt schicken“ — beides ohne Wartezeit bedienbar.",
      "Bankdaten zum Vorlesen, mit dem Verwendungszweck in gleichbreiter Schrift (damit man 0 und O nicht verwechselt).",
      "Alle Raten auf einen Blick: bezahlt grün, überfällig rot.",
      "Jedes Gespräch, das über die Plattform geführt wurde — mit Dauer, Ergebnis und der Aufnahme zum Anhören.",
      "Dazu: verschickte Mails und der ganze Verlauf.",
    ],
    howto: [
      "Forderungen öffnen, bei einem Fall auf „Akte öffnen“ — der Kopf steht sofort, der Rest lädt nach.",
      "„Rechnung jetzt schicken“ verschickt die Zahlungserinnerung mit Betrag, Bankdaten und Verwendungszweck. Die Mahnstufe steigt dadurch NICHT.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-richtlinie-im-display",
    date: "2026-08-11",
    category: "Behoben",
    title: "Telefon-Richtlinie lässt sich jetzt annehmen",
    summary:
      "Sie stand hinter dem Telefon und war nicht erreichbar. Jetzt liest und unterschreibst du sie direkt im Display.",
    changes: [
      "Neue Mitarbeiter kamen nicht weiter: Die Richtlinie erschien HINTER dem Telefon-Fenster — man sah nur einen verschwommenen Schemen.",
      "Jetzt steht sie im Display selbst. Volltext zum Scrollen, Haken, Namensfeld und Knopf an einer Stelle.",
      "Du musst das Telefon nicht mehr verlassen, um sie anzunehmen.",
      "MOBIL: Während eines Gesprächs schalten wir jetzt Hintergrundvideo, Weichzeichnung und Animationen ab. Das soll das Klackern am Handy beheben — sag uns bitte, ob es besser ist.",
    ],
    howto: [
      "Telefon öffnen, Richtlinie lesen, Haken setzen, vollständigen Namen eintippen, „Annehmen und telefonieren“.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-auto-advance",
    date: "2026-08-11",
    category: "Neu",
    title: "Telefon: Der nächste Kunde steht schon da",
    summary:
      "Nach „Nicht erreicht“ lädt das Telefon direkt den nächsten aus deiner Liste. Zwei Klicks weniger pro Gespräch.",
    changes: [
      "Bisher: Ergebnis buchen → du landest wieder auf der Tastatur, mit der Nummer DESSELBEN Kunden. Dann „Anderen Kunden wählen“, dann suchen, dann tippen.",
      "Jetzt: Ergebnis buchen → der Nächste steht da, mit Name und Nummer. Ein Griff zum grünen Knopf.",
      "Er wird geladen, nicht automatisch angerufen — du entscheidest, wann es losgeht. Wenn du noch eine Notiz fertig schreiben willst, hast du Zeit.",
      "Die Reihenfolge ist dieselbe wie in deiner Kundenliste. Wen du gerade dokumentiert hast, kommt nicht nochmal.",
      "Wenn du zwischendurch jemanden von Hand anrufst: Der Knopf „Nächsten aus meiner Liste holen“ bringt dich zurück in den Takt.",
      "Hat der Nächste eine kaputte Nummer, steht das da — mit Namen, damit du sie korrigieren lassen kannst.",
      "FORDERUNGSMANAGEMENT: Die Kollegen dort sehen ab jetzt ausschließlich Kunden mit offener Abo-Rate. Vertriebskunden landen nicht mehr bei ihnen.",
    ],
    howto: [
      "Anrufen, Ergebnis klicken, nächster Kunde steht da, wieder anrufen. Du musst zwischendurch nichts suchen.",
      "Willst du jemand anderen: „Anderen wählen“ neben dem Namen tippen.",
    ],
    link: { href: "/agent/kunden", label: "Zu den Kunden" },
    important: true,
  },
  {
    id: "2026-08-11-nicht-erreicht-raus",
    date: "2026-08-11",
    category: "Behoben",
    title: "„Nicht erreicht“ nimmt den Kunden jetzt aus der Liste",
    summary:
      "Wer nicht erreichbar war, verschwindet aus der Anrufliste und bekommt einen Buchungslink. Du rufst niemanden mehr zweimal an.",
    changes: [
      "Einer von euch hat gemeldet: „Wenn ich den Kunden nicht erreicht klicke, bleibt er trotzdem in der Liste — verschwinden tut er bei mir nicht.“ Das war ein echter Fehler: 311 Kunden standen doppelt drin.",
      "Jetzt: Nach „nicht erreicht“, „Mailbox“, „Rückruf vereinbart“ oder „falsche Nummer“ geht die Karte raus. Du siehst kurz die Marke, dann gleitet sie aus.",
      "Bei „zahlt sofort“ bleibt der Kunde — sein Geld wird ja erwartet.",
      "Oben steht eine grüne Leiste: „90 warten auf ihren Termin“. Antippen zeigt sie. Die haben ihren Buchungslink und wählen selbst eine Uhrzeit — ruf sie nicht erneut an.",
      "KALENDER: Wenn ein Kunde selbst einen Termin buchst, steht er jetzt in DEINEM Kalender mit der Marke „Kunde hat gebucht“. Vorher fehlte er dort komplett — der Kunde hatte eine Bestätigung, du wusstest nichts davon.",
      "Diesen Termin kannst du nicht verschieben: Der Kunde hat die Zeit gewählt. Passt sie nicht, ruf ihn an.",
      "FORDERUNGSMANAGEMENT: Die Liste zeigt nur noch, was überfällig, heute fällig oder in den nächsten 7 Tagen fällig ist. Vorher standen dort 153 Raten, bei denen es nichts zu tun gab.",
    ],
    howto: [
      "Nach „nicht erreicht“ ist der Kunde für heute fertig. Er kommt von selbst zurück, wenn er einen Termin bucht — dann steht er in deinem Kalender.",
      "Die grüne Leiste oben ist keine Aufgabe, sondern eine Auskunft: Diese Leute sind dran, aber nicht bei dir.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-liste-haelt-still",
    date: "2026-08-11",
    category: "Behoben",
    title: "Die Kundenliste springt nicht mehr — und Telefonieren geht",
    summary:
      "Wenn du ein Ergebnis buchst, bleibt der Kunde da, wo er war. Vorher rutschte er zwei bis drei Plätze weg.",
    changes: [
      "DIE LISTE HÄLT STILL: Einer von euch hat gemeldet: „Wenn ich ‚zahlt sofort‘ oder ‚nicht erreicht‘ drücke, rutscht er einfach 2–3 Leute runter, komme so echt durcheinander.“ Das war ein echter Fehler.",
      "Ursache: Die Liste sortiert nach Zusagedatum und Wiedervorlage — also nach genau den Feldern, die dein Ergebnis setzt. Wer bucht, verschob damit den Kunden.",
      "Jetzt bleibt die Karte, wo sie ist. Sie wird nur blasser und bekommt die Marke „Ergebnis gebucht“.",
      "Oben erscheint ein Knopf „3 Ergebnisse gebucht“. Erst wenn du DEN drückst, wird neu geordnet. Deine Zeile bleibt, bis du sie aufgibst.",
      "TELEFON: Der Anruf geht jetzt. Der Grund war ein Anmeldeschritt, der für eingehende Anrufe gedacht ist — unser Zugang erlaubt aber nur ausgehende. Er ist raus.",
      "Falls du das Telefon offen hattest: einmal hart neu laden (Strg+Umschalt+R bzw. Cmd+Umschalt+R).",
    ],
    howto: [
      "Arbeite die Liste von oben nach unten ab. Nach jedem Ergebnis bleibt die Karte an ihrer Stelle — du musst nicht suchen, wo du warst.",
      "Wenn du eine Runde fertig hast: oben auf „Ergebnisse gebucht“ tippen, dann ist die Liste wieder frisch sortiert.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-mikrofon",
    date: "2026-08-11",
    category: "Behoben",
    title: "Telefon: Mikrofon wird jetzt gefragt — das war der Grund",
    summary:
      "Der Anruf startete nicht, weil das Mikrofon nie freigegeben wurde. Das Panel fragt jetzt danach, bevor du wählst.",
    changes: [
      "MIKROFON: Ganz oben im Telefon steht jetzt „Mikrofon erlauben“. Einmal antippen, der Browser fragt, fertig. Ohne Freigabe kann kein Anruf aufgebaut werden — das war der Grund, warum nichts passierte.",
      "Wenn der Browser ablehnt, steht da WARUM und was du tun kannst — je nach Fall sieben verschiedene Erklärungen.",
      "Kein Mikrofon angeschlossen? Von einem anderen Programm belegt? Keine gesicherte Verbindung? Jeder Fall hat seinen eigenen Satz.",
      "FEHLERMELDUNGEN: Statt „der Fehler nennt keinen Grund“ steht jetzt der echte Twilio-Grund da — oder, wenn es wirklich keinen gibt, die drei häufigsten Ursachen zum Durchprobieren.",
      "Wenn beim Telefonieren etwas klemmt, wird der Fehler automatisch an den Vorgesetzten gemeldet. Du musst nichts abschreiben.",
    ],
    howto: [
      "Telefon öffnen, oben „Mikrofon erlauben“ antippen, im Browser auf „Zulassen“. Der Knopf verschwindet dann.",
      "Am iPhone: Es muss Safari sein. Andere Browser auf dem iPhone können kein Telefon.",
      "Wenn du im Firmen-WLAN keine Verbindung bekommst: einmal über Mobilfunk versuchen. Manche Netze blockieren Telefonie.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-pipeline-cockpit",
    date: "2026-08-11",
    category: "Neu",
    title: "Gespräche anhören, Transkripte lesen — und das Cockpit für die Leitung",
    summary:
      "In der Kundenakte kannst du jetzt Aufnahmen abspielen und Transkripte lesen. Du siehst auf einen Blick, wie weit die Nachbereitung ist.",
    changes: [
      "AUFNAHMEN: In der Akte unter „Anrufe“ gibt es einen Player. Dass du eine Aufnahme angehört hast, steht im Kundenverlauf — das ist Absicht, es geht um Kundengespräche.",
      "TRANSKRIPT: Aufklappbar unter jedem Anruf.",
      "STATUSKETTE: Drei Punkte zeigen, wie weit es ist — aufgezeichnet, transkribiert, zusammengefasst. Vorher stand da entweder eine Zusammenfassung oder nichts, und „nichts“ konnte dreierlei bedeuten.",
      "Wenn ein Transkript gescheitert ist, steht der Grund da und ein Knopf zum Nachholen.",
      "Hat ein Kunde der Aufzeichnung widersprochen, steht das als eigener Zustand — keine Lücke.",
      "AUFBEWAHRUNG: Aufnahmen werden nach 90 Tagen automatisch gelöscht. Transkript und Zusammenfassung bleiben — sie sind das Arbeitsergebnis.",
      "FÜR DIE LEITUNG: Die Kundenschublade in /agent/vertrieb hat jetzt sieben Reiter — Lage, Zugang, Zahlung, Verwaltung, Stammdaten, Verlauf, Zuweisungen.",
      "„Ich komme nicht rein“: Der Reiter „Zugang“ sagt dir, WAS los ist und welcher der drei Wege der richtige ist. Jeder braucht einen Grund, der im Protokoll steht.",
      "„Anrufen“ öffnet jetzt überall das FIAON-Telefon statt der Telefon-App — nur so landet das Gespräch in der Akte.",
      "MAIL-ZENTRALE trägt dieselbe Gestaltung wie der Space: helle Glasblasen über dem Hintergrund.",
    ],
    howto: [
      "Aufnahme anhören: Akte öffnen, Abschnitt „Anrufe“, dann „Aufnahme anhören“.",
      "Die drei Punkte je Anruf: grün heißt fertig, gelb läuft noch, rot ist gescheitert, grau steht noch aus.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-space-v5",
    date: "2026-08-11",
    category: "Neu",
    title: "Space v5: heller Feed über dem Video — und der Mail-Bug ist weg",
    summary:
      "Der Space ist wieder hell: Die Beiträge schweben als Glasblasen über dem Hintergrundvideo. Und wenn du eine E-Mail-Adresse eintippst, geht sie nicht mehr verloren.",
    changes: [
      "SPACE: Die dunkle Bühne ist weg. Der Feed liegt jetzt als helle Glasblasen über dem Hintergrundvideo — Fließtext liest sich auf Hell einfach besser.",
      "Die Blasen sind 720 Pixel breit, mit weichen Rundungen und einem sanften blauen Schatten. Beim Zeigen heben sie sich leicht.",
      "Neue Beiträge blühen auf, statt einfach zu erscheinen. Der Reaktionszähler federt.",
      "Angepinntes steht als schmale Leiste — beide Titel nebeneinander, antippen klappt auf.",
      "MAIL: Wenn du eine Adresse eintippst und direkt auf „Vorschau & senden“ gehst, wird sie jetzt übernommen. Vorher hieß es „kein Empfänger“, obwohl die Adresse im Feld stand.",
      "Ein Tippfehler in der Adresse bekommt einen Hinweis direkt am Feld.",
      "Adressen lassen sich mit Komma trennen — du musst nicht mehr jedes Mal Enter drücken.",
      "MENÜ: „Mail“ steht jetzt vor „Aufgaben“, und Space ist der erste Punkt.",
      "VERTRIEB: Im Bestand je Mitarbeiter brechen die Namen nicht mehr um. Die Zahlen stehen in einer eigenen Zeile, auf dem Handy als Raster.",
      "TELEFON: Der Grund, warum Anrufe nicht rausgingen, ist gefunden — die Absendernummer kam bei Twilio leer an. Wenn etwas fehlt, sagt die Ansage jetzt WAS.",
    ],
    howto: [
      "Mail: Adresse eintippen und direkt senden geht jetzt. Mehrere Adressen mit Komma trennen.",
      "Space: Der Hintergrund lässt sich abschwächen — der Vorgesetzte findet den Regler unter Einstellungen → Design.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-11-telefon-geraet",
    date: "2026-08-11",
    category: "Neu",
    title: "Das Telefon ist ein Telefon geworden — und es gibt eine Richtlinie",
    summary:
      "Beim Klick auf den Telefonknopf erscheint jetzt ein echtes Gerat mit Wähltastatur. Vorher musst du einmal die Telefon-Richtlinie lesen und annehmen.",
    changes: [
      "DAS GERÄT: Der Telefonknopf öffnet ein zentriertes Gerät mit Wähltastatur, Kundensuche und Gesprächsanzeige. Am Handy ist es ein Blatt, das von unten hochkommt.",
      "KUNDENSUCHE: Tippe den Namen, statt die Nummer zu suchen. Du findest nur Kunden aus deinem eigenen Bereich.",
      "RICHTLINIE: Vor dem ersten Anruf musst du die Telefon-Richtlinie einmal lesen und annehmen. Das ist keine Formalie — wer ein Gespräch ohne Hinweis aufzeichnet, macht sich nach § 201 StGB PERSÖNLICH strafbar.",
      "Solange du sie nicht angenommen hast, ist das Wählen gesperrt.",
      "DER PFLICHTSATZ steht über dem Anrufknopf: „Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet — sind Sie damit einverstanden?“ Sag ihn zu Beginn, jedes Mal.",
      "OHNE AUFZEICHNUNG: Widerspricht der Kunde, drückst du im Gespräch auf „Ohne Aufzeichnung fortsetzen“. Die Aufnahme stoppt sofort, das Gespräch läuft weiter, und am Anruf steht, dass es so war. Kein Nachfragen, kein Überreden.",
      "Aufnahmen werden nach 90 Tagen automatisch gelöscht.",
    ],
    howto: [
      "Lies die Richtlinie in Ruhe — es sind sechs Punkte, und sie betreffen dich, nicht die Firma.",
      "Zum Annehmen brauchst du den Haken und deinen vollen Namen. Beides wird mit Zeitpunkt festgehalten.",
      "Wenn ein Kunde bei der Aufzeichnung zögert: Knopf drücken, weiterreden. Das ist der richtige Weg, nicht die Ausnahme.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-telefon-space-breit",
    date: "2026-08-11",
    category: "Behoben",
    title: "Telefonieren geht wieder — und der Space nutzt den ganzen Bildschirm",
    summary:
      "Der Grund, warum Anrufe nicht rausgingen, ist gefunden: ein Parametername, den Twilio für sich reserviert. Dazu der Space in voller Breite mit euren echten Zahlen.",
    changes: [
      "TELEFON: Anrufe aus dem Browser kamen bei Twilio ohne Rufnummer an. Ursache: Wir haben die Nummer im Feld „To“ übergeben — das setzt Twilio bei Browser-Anrufen selbst und hat unsere Angabe überschrieben. Jetzt heißt das Feld „An“.",
      "Wenn beim Telefonieren etwas klemmt, nennt die Meldung den Twilio-Code und was zu tun ist — kein „undefined“ mehr.",
      "SPACE: Der Feed ist von 760 auf 900 Pixel gewachsen und nutzt den ganzen Bildschirm.",
      "Der Hintergrund mit dem Planeten ist jetzt überall deutlich zu sehen — auch im Space.",
      "Rechts stehen jetzt EURE Zahlen: Verdienst im Monat, Kontakte heute, offene Stufe-A-Kunden. Vorher standen dort zwei Karten ohne eine einzige Zahl.",
      "Auf dem Handy stehen die Zahlen als Kachelreihe über dem Feed.",
      "ZAHLUNGSDATEN: In Kunden-Mails steht jetzt das richtige Konto — FIAON LTD, BE09 9058 9276 3957. Wenn ein Kunde nach der Bankverbindung fragt, ist die aus dem System immer die richtige.",
      "Das Wort „Betreiber“ heißt im ganzen System jetzt „Vorgesetzter“.",
    ],
    howto: [
      "Falls du das Telefon offen hattest: einmal die Seite neu laden (Strg+Umschalt+R bzw. Cmd+Umschalt+R), damit die neue Fassung greift.",
      "Den Hintergrund kann der Vorgesetzte in den Einstellungen abschwächen oder abschalten.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-11-space-v4",
    date: "2026-08-11",
    category: "Neu",
    title: "Der Space ist dunkel geworden — und deutlich breiter",
    summary:
      "Neue Bühne in unserem Dunkelblau, breiterer Feed, mehr Luft. Und wenn du einen Beitrag entfernst, steht die Rückfrage direkt an der Karte statt ganz unten.",
    changes: [
      "DUNKLE BÜHNE: Der Space liegt jetzt auf tiefem FIAON-Blau. Die Beiträge selbst bleiben helle Karten — Fließtext liest sich auf Hell einfach besser.",
      "BREITER: Der Feed ist von 620 auf 760 Pixel gewachsen. Lange Beiträge brauchen weniger Zeilenumbrüche.",
      "MEHR LUFT: Nichts klebt mehr an der Kopfzeile.",
      "Wenn du „Zurücknehmen“ oder „Entfernen“ drückst, erscheint die Rückfrage IN der Karte. Vorher musstest du nach unten scrollen, um eine Frage zu beantworten, die du oben gestellt hast.",
      "Angepinnte Beiträge stehen als schmale Leiste oben — antippen klappt sie auf.",
      "Alles andere bleibt: Gefällt mir, Antworten auf Kommentare, Akten anhängen, Bilder, unendliches Scrollen.",
    ],
    howto: [
      "Der Space ist deine Startseite. Wenn du dich anmeldest, bist du hier.",
      "Zum Entfernen eines eigenen Beitrags: oben rechts an der Karte auf „Zurücknehmen“ — die Rückfrage erscheint direkt darunter.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-11-raum-telefon",
    date: "2026-08-11",
    category: "Neu",
    title: "Ein Hintergrund für FIAON — und klare Telefon-Fehler",
    summary:
      "Hinter der Oberfläche dreht sich jetzt langsam ein Planet. Und wenn das Telefon nicht startet, steht endlich da, warum.",
    changes: [
      "HINTERGRUND: Ein ruhig drehender Planet liegt hinter allen Seiten — im Team-Portal, in der Verwaltung, im Kundenportal.",
      "Er lädt NACH dem Seiteninhalt, damit nichts langsamer wird. Auf dem Handy kommt eine kleinere Fassung.",
      "Wer im Browser „Bewegung reduzieren“ eingestellt hat oder im Datensparmodus surft, sieht nur ein Standbild.",
      "TELEFON: Statt „Das Telefon konnte nicht starten: undefined“ steht jetzt der echte Grund da — mit Twilio-Code und dem Handgriff, der ihn behebt.",
      "Wenn der Browser das Mikrofon nicht freigegeben hat, steht das jetzt genau so da, statt dass der Anruf stumm scheitert.",
      "E-MAILS an Kunden tragen jetzt nur noch FIAON in der Fußzeile, dazu Impressum und Datenschutz. Bei Sammelmails steht ein Abmelde-Hinweis dabei.",
      "Mails gehen jetzt zweiteilig raus (Text und HTML) — sie landen dadurch seltener im Spam.",
    ],
    howto: [
      "Wenn beim Telefonieren etwas klemmt: Der Text im Panel nennt den Grund. Schick ihn dem Vorgesetzten, dann weiß er sofort, wo es hakt.",
      "Der Hintergrund lässt sich abschalten — der Vorgesetzte findet den Regler unter Einstellungen → Design.",
    ],
    important: true,
  },
  {
    id: "2026-08-11-space-v3",
    date: "2026-08-11",
    category: "Neu",
    title: "Space: Gefällt mir, Antworten, eigene Beiträge löschen",
    summary:
      "Ihr könnt jetzt auf Kommentare antworten, eigene Beiträge zurücknehmen und binnen 15 Minuten ändern. Dazu ein neues Gesicht für FIAON-Beiträge.",
    changes: [
      "REAKTIONEN: Statt vier Zeichen, deren Bedeutung niemand kannte, gibt es jetzt „Gefällt mir“ und „Gefällt mir nicht“. Eure bisherigen Reaktionen sind erhalten geblieben.",
      "ANTWORTEN: Unter jedem Kommentar steht „Antworten“. Die Antwort hängt sichtbar am richtigen Kommentar.",
      "EIGENE BEITRÄGE: „Zurücknehmen“ entfernt euren Beitrag. „Ändern“ geht 15 Minuten lang — danach nicht mehr, weil andere ihn inzwischen gelesen haben. Geänderte Beiträge tragen eine Marke.",
      "Eigene Kommentare könnt ihr jederzeit löschen.",
      "Ab drei Kommentaren wird eingeklappt — „weitere anzeigen“ holt den Rest.",
      "Angepinnte Beiträge stehen jetzt als schmale Leiste oben statt als große Karten. Antippen klappt sie auf.",
      "FIAON-Beiträge haben ein eigenes Zeichen bekommen — dasselbe, das ihr jetzt auch im Browser-Tab seht.",
      "Jede Beitragsart trägt eine Kennmarke: „Gedanke des Tages“, „Der Tag in Zahlen“, „Verkaufs-Impuls“.",
    ],
    howto: [
      "Antworten: unter dem Kommentar auf „Antworten“ tippen, dann unten schreiben. Über dem Feld steht, an wen die Antwort geht.",
      "Eigenen Beitrag ändern: oben rechts an der Karte auf „Ändern“. Der Knopf verschwindet 15 Minuten nach dem Schreiben.",
      "Wenn beim E-Mail-Versand etwas schiefgeht, steht der Grund jetzt direkt in der Meldung — nicht mehr „siehe Protokoll“.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-11-gesicht-tiefe",
    date: "2026-08-11",
    category: "Verbessert",
    title: "Dein Profilbild ist jetzt überall zu sehen",
    summary:
      "Wer ein Bild hinterlegt hat, sieht es ab sofort in der Kopfzeile, im Space und unter jedem Beitrag. Dazu: der Space hat Tiefe bekommen, und die ersten Schritte erkennen mehr von selbst.",
    changes: [
      "PROFILBILD: Bisher standen überall nur deine Initialen — auch wenn du längst ein Bild hochgeladen hattest. Das lag daran, dass die Anmeldung das Bild gar nicht mitgeladen hat. Jetzt schon, an einer Stelle für alle Seiten.",
      "Der Space hat Tiefe: Beiträge treten beim Laden nach vorn, kommen dir beim Überfahren entgegen, und das Schreibfeld hebt sich an, sobald du hineinklickst.",
      "Alles in Glas — der Hintergrund scheint durch die Karten.",
      "ERSTE SCHRITTE: „Im Space vorbeischauen“ hakt sich jetzt von selbst ab, sobald du dort warst. Vorher musstest du es zusätzlich von Hand bestätigen.",
      "Wenn du auf den Knopf eines Schritts klickst, gilt der Schritt als gemacht. Du musst nicht mehr zurückkommen und abhaken.",
      "Der Schritt „Verpflichtungserklärung“ stand fälschlich in jeder Liste. Es gibt sie nur für Vertriebsleitung, Onboarding und Forderungsmanagement — im Vertrieb war es ein Häkchen, das sich nie setzen ließ. Ist raus.",
      "Der Schritt „Vertrag unterschrieben“ stand offen, obwohl daneben stand, dass er erledigt ist. Behoben.",
    ],
    howto: [
      "Bild hochladen: „Mehr“ → „Profil“ → Bild wählen. Danach siehst du es sofort oben rechts.",
      "Deine offenen Schritte stehen unter „Start“ ganz oben. Was dort noch offen ist, ist auch wirklich offen.",
    ],
    link: { href: "/agent/profil", label: "Zum Profil" },
    important: true,
  },
  {
    id: "2026-08-11-space-lebt",
    date: "2026-08-11",
    category: "Neu",
    title: "Der Space ist voll — und ihr könnt Akten anhängen",
    summary:
      "Im Feed stehen jetzt über tausend Beiträge, davon viele aus euren echten Abschlüssen der letzten Wochen. Jeden Tag kommen rund zwanzig dazu.",
    changes: [
      "Der Feed hat eine Vergangenheit: 60 Tage rückwärts, mit euren ECHTEN Abschlusszahlen und Tagesranglisten. Scrollt mal runter.",
      "Jeden Tag erscheinen rund 20 Beiträge, verteilt zwischen 7 und 19 Uhr — Gedanken, Verkaufs-Impulse, Zahlen des Tages.",
      "Wenn jemand einen Abschluss holt, steht das ein paar Minuten später im Feed. Mit Vornamen und Zahl, nie mit Kundendaten.",
      "Um 18 Uhr kommt die Tagesrangliste, montags früh der Wochenrückblick.",
      "NEU: Ihr könnt eine Kundenakte an einen Beitrag anhängen. Im Feed steht dann nur die Referenz — kein Name, kein Betrag. Wer klickt und berechtigt ist, landet in der Akte.",
      "Bilder gehen jetzt auch. Sie werden automatisch verkleinert, bevor sie hochgeladen werden.",
      "Der Feed lädt beim Scrollen von selbst nach. Kommen neue Beiträge, erscheint oben eine Pille zum Antippen — nichts springt euch weg.",
      "Höchstens zwei Beiträge können gleichzeitig angepinnt sein.",
    ],
    howto: [
      "Zum Anhängen einer Akte: Ins Schreibfeld klicken, dann unten „Akte anhängen“ — such nach Name oder Referenz.",
      "Das ist der RICHTIGE Weg, wenn es um einen bestimmten Kunden geht. Namen und Nummern im Fließtext weist das System weiterhin ab.",
      "Für ein Bild: „Bild“ unter dem Schreibfeld. JPEG, PNG oder WebP.",
      "Wenn oben „3 neue Beiträge“ steht, tippe drauf — dann springt der Feed nach oben und lädt neu.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-11-woche",
    date: "2026-08-11",
    category: "Verbessert",
    title: "Was sich diese Woche geändert hat",
    summary:
      "Der Space ist jetzt deine Startseite und sieht aus wie ein richtiges Netzwerk. Dazu: alle Dialoge neu gebaut, Filter aufgeräumt, ein Gesprächsblatt, das man in fünf Sekunden liest.",
    changes: [
      "SPACE IST DIE STARTSEITE. Nach dem Anmelden landest du im Space statt bei den Zahlen. „Start“ mit Verdienst und Terminen liegt direkt daneben.",
      "Der Space sieht aus wie ein soziales Netzwerk: Beiträge als Karten, Reaktionen mit Animation, Kommentare zum Aufklappen, links dein Profil, rechts „Heute“.",
      "Auf dem Handy ist der Space randlos — wie eine App, nicht wie eine Webseite.",
      "Alle Fenster wurden neu gebaut: E-Mail senden, Gesprächsblatt, Telefon. Statt eines weißen Kastens auf schwarzem Hintergrund kommen sie jetzt aus der Tiefe, mit Glas-Optik.",
      "Auf dem Handy kannst du jedes Fenster nach unten wegwischen.",
      "Das Gesprächsblatt beginnt mit drei Zeilen: wer, wie steht es, was ist der nächste Schritt. Die Einwände sind Karten zum Aufklappen statt einer Textwand.",
      "Das Telefon-Panel sieht aus wie ein Gerät — mit Tasten, die sich drücken lassen, und einer Statuszeile mit Gesprächsdauer.",
    ],
    howto: [
      "Nach dem Anmelden bist du im Space. Schreib etwas ins Feld oben — es öffnet sich, sobald du hineinklickst.",
      "Zum Reagieren tippst du eines der vier Zeichen unter einem Beitrag. Nochmal tippen nimmt es zurück.",
      "„Kommentieren“ klappt die Antworten auf. Enter schickt deinen Kommentar.",
      "Denk an die Regel: keine Kundendaten im Space. Keine Namen, keine Nummern, keine Beträge. Die gehören in die Akte.",
    ],
    link: { href: "/agent/space", label: "Zum Space" },
    important: true,
  },
  {
    id: "2026-08-10-erste-schritte",
    date: "2026-08-10",
    category: "Neu",
    title: "Geführte erste Schritte — und ein Bereich für Ratenzahlungen",
    summary:
      "Neu im Team? Auf der Startseite steht jetzt eine Tafel, die dir zeigt, was zuerst dran ist — passend zu deiner Rolle. Und: Für offene Abo-Raten gibt es einen eigenen Arbeitsbereich.",
    changes: [
      "Neue Kollegen sehen auf der Startseite eine Checkliste mit den ersten Schritten, dazu kurze Erklärkarten zu Stufen, Ergebnissen und Telefon.",
      "Manche Punkte haken sich selbst ab: Sobald du dein erstes Ergebnis dokumentierst, ist der Punkt erledigt — du musst nichts bestätigen.",
      "Die Tafel blockiert nichts. Klick sie weg, wenn du sofort loswillst; über dein Profil findest du sie jederzeit wieder.",
      "Neu: Wer die Rolle Forderungsmanagement hat, bekommt einen eigenen Bereich für offene Abo-Raten — mit Arbeitsliste, Telefon und Zeiterfassung.",
      "Die Verwaltung sieht jetzt, wer bei der Einarbeitung hängt, und kann dir eine Nachricht schicken statt dich zu übersehen.",
    ],
    howto: [
      "Die Tafel steht oben auf „Start“. Jeder Punkt sagt in einem Satz, warum er dran ist.",
      "Unter der Checkliste stehen drei Karten mit den wichtigsten Grundlagen. Zwei Minuten lesen spart eine Woche Rätselraten.",
      "Ganz unten wartet die erste echte Aufgabe. Wenn du die erledigt hast, bist du drin.",
    ],
    link: { href: "/agent/start", label: "Zur Startseite" },
    important: true,
  },
  {
    id: "2026-08-10-telefon-blatt",
    date: "2026-08-10",
    category: "Neu",
    title: "Gesprächsblatt vor dem Anruf — und ein Telefon im System",
    summary:
      "Ein Klick zeigt dir vor dem Anruf alles Wichtige zu einer Person. Und unten rechts wartet ein Telefon: sobald der Anschluss freigeschaltet ist, telefonierst du direkt aus FIAON.",
    changes: [
      "Neu auf jeder Kundenkarte: „Gesprächsblatt“. Kurzprofil, Aufhänger, was bisher besprochen wurde, der nächste Schritt und Antworten auf die häufigsten Einwände.",
      "Der Verwendungszweck steht ganz oben im Blatt — das Feld, nach dem am Telefon am häufigsten gefragt wird.",
      "Unten rechts liegt jetzt ein Telefon-Knopf. Solange der Anschluss nicht freigeschaltet ist, sagt er das ruhig; du telefonierst weiter wie bisher.",
      "Wenn er freigeschaltet ist: Anrufen aus der Kundenkarte, Gespräch wird aufgezeichnet (mit Ansage zu Beginn), und nach dem Auflegen klickst du dein Ergebnis wie gewohnt.",
      "Kein Anruf bleibt undokumentiert: Solange ein Ergebnis fehlt, steht eine Marke am Telefon-Knopf.",
      "Nach dem Gespräch schreibt das System eine kurze Zusammenfassung in den Verlauf — beschreibend, ohne Bewertung.",
      "In der Akte siehst du jetzt, welche Unterlagen vorliegen und welche fehlen.",
    ],
    howto: [
      "Öffne eine Kundenkarte und klick „Gesprächsblatt“. Jeder Abschnitt hat einen Kopieren-Knopf.",
      "Unter „Wenn er das sagt“ stehen fertige Antworten auf Preis-, Zweifel- und Seriositätsfragen. Sprich sie in deinen Worten.",
      "Auf dem Blatt steht unten: automatisch erstellt. Prüf im Zweifel in der Akte nach — die Fakten kommen aus deinen eigenen Einträgen.",
      "Der Telefon-Knopf öffnet ein Tastenfeld. Du kannst auch aus der Kundenkarte heraus anrufen, dann kennt das Telefon den Kunden schon.",
    ],
    link: { href: "/agent/kunden", label: "Zur Kundenliste" },
    important: true,
  },
  {
    id: "2026-08-09-zentralen",
    date: "2026-08-09",
    category: "Verbessert",
    title: "Nachrichten von der Leitung — und 734 Kunden neu verteilt",
    summary:
      "Die Leitung kann dir jetzt eine Nachricht direkt ins Portal stellen. Und: Über 700 Kunden mit fertigem Antrag und offener Rechnung hatten niemanden — die sind jetzt verteilt.",
    changes: [
      "Neu: Nachrichten der Leitung erscheinen als Banner ganz oben, über allem. Mit „Verstanden“ bestätigst du, dass du sie gelesen hast.",
      "734 Kunden auf Stufe B (fertiger Antrag, Rechnung offen) hatten keinen Zuständigen und tauchten in niemandes Liste auf. Sie sind gleichmäßig verteilt — dein Bestand ist dadurch gewachsen.",
      "Deine bereits betreuten Kunden wurden dabei NICHT angefasst. Das wurde einzeln nachgeprüft.",
      "Kleiner Nebeneffekt: Wer von einem Testkonto „betreut“ wurde, hing bisher in der Luft. Solche Fälle werden jetzt normal verteilt.",
    ],
    howto: [
      "Ein Banner der Leitung bleibt stehen, bis du „Verstanden“ klickst — oder bis die Frist abläuft.",
      "Deine neuen Kunden stehen in der Kundenliste unter Stufe B. Die Arbeitsreihenfolge sortiert sie automatisch ein.",
      "Wenn dir ein Kunde zugeteilt wurde, der eigentlich zu jemand anderem gehört: melde es der Vertriebsleitung, sie kann ihn umhängen.",
    ],
    link: { href: "/agent/kunden", label: "Zur Kundenliste" },
    important: true,
  },
  {
    id: "2026-08-09-mail-zentrale",
    date: "2026-08-09",
    category: "Neu",
    title: "E-Mails: selbst schreiben, selbst senden, wirklich sehen ob sie ankam",
    summary:
      "Neuer Menüpunkt „Mail“ zum Schreiben an eigene Kunden. Auf jeder Kundenkarte ein Knopf „E-Mail senden“. Und im Protokoll steht jetzt, ob eine Mail wirklich zugestellt wurde.",
    changes: [
      "Neuer Bereich „Mail“: Kunden suchen (auch über alte Adressen), schreiben, senden. Bis zu 10 Empfänger pro Versand.",
      "Bausteine per Klick: Anrede, Zahlungsdaten mit Verwendungszweck, Terminlink, Portal-Login. Der Server füllt sie für JEDEN Empfänger einzeln — jeder bekommt seinen eigenen Verwendungszweck.",
      "KI-Hilfe: Entwurf aus Stichpunkten, Ton glätten, kürzen. Die KI schlägt vor, du sendest — und Zusagen zu Limits werden automatisch entfernt.",
      "Auf jeder Kundenkarte: „E-Mail senden“. Alle Vorlagen nach Thema sortiert, mit Klartext dazu, was wann an wen rausgeht.",
      "Grau statt bunt: Wenn ein Knopf nicht geht, steht der Grund im Klartext darunter — bezahlt, gesperrt, keine Adresse, Tageslimit.",
      "Im Protokoll steht jetzt der ECHTE Zustellstand: angenommen, zugestellt, geöffnet oder unzustellbar. Vorher hieß alles „gesendet“.",
      "Kunden, die Stufe A oder B erreichen, bekommen sofort einen Zuständigen — nicht erst am nächsten Morgen.",
      "Testeinträge aus unserer eigenen Erprobung sind aus der Kundenliste raus (7 Stück).",
    ],
    howto: [
      "Öffne „Mail“ im Menü. Tipp einen Namen ins Suchfeld — schon ab dem ersten Buchstaben kommen Vorschläge.",
      "Schreib Betreff und Text. Mit den Knöpfen unter dem Textfeld setzt du Bausteine ein, zum Beispiel {Zahlungsdaten}.",
      "„Test an mich“ schickt die Mail zuerst an dich selbst. Ab zwei Empfängern musst du die Vorschau ansehen.",
      "Auf einer Kundenkarte findest du „E-Mail senden“ im Bereich E-Mails. Dort siehst du auch, was schon rausging und ob es ankam.",
      "Steht bei einer Vorlage „Zweig ungeprüft“, heißt das nur: Wir haben noch nicht nachgemessen, ob sie ankommt. Senden geht trotzdem.",
    ],
    link: { href: "/agent/mail-zentrale", label: "Zur Mail-Zentrale" },
    important: true,
  },
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
      "Bei Zahlungsfragen, fehlenden Unterlagen oder Login-Problemen deiner Kunden musst du nicht mehr auf den Vorgesetzten warten — die Vertriebsleitung kann das jetzt selbst klären.",
    changes: [
      "Sagt dein Kunde, er habe überwiesen: Die Vertriebsleitung sieht die Bankeingänge und kann ihn bei belegtem Geld selbst auf „bezahlt“ setzen. Das Konto geht sofort auf und der Kunde bekommt seine Bestätigung.",
      "Gebucht wird nur mit Nachweis — passender Verwendungszweck im Bankeingang oder ein Überweisungsbeleg, den der Kunde gezeigt hat. Ohne Nachweis und ohne echtes Eingangsdatum geht der Knopf nicht.",
      "Fehlende Unterlagen sind sichtbar: Bei welchen bezahlten Kunden noch Ausweis, Kontoauszug oder SCHUFA-Auskunft fehlt. Die Dokumente selbst bleiben beim Vorgesetzter.",
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
      "Am Menü-Symbol steht eine Zahl, wenn etwas auf dich wartet: Antwort vom Vorgesetzter, neue Neuerungen oder Akten, die bald zurück in die Kartei laufen.",
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
