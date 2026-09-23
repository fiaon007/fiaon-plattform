// ═══════════════════════════════════════════════════════════════════════════
// DIE RUNDGÄNGE — was jeder Raum über sich selbst erzählt
//
// Justin (24.08.2026): „Jede Seite soll eine Einführung geben und genauestens
// beschreiben, wofür was ist, wie was geht — und mach es realitätsnah.“
//
// ── WIE DIESE TEXTE GESCHRIEBEN SIND ───────────────────────────────────────
// Nicht als Beschriftung („Hier siehst du deine Kunden“), sondern als das,
// was ein erfahrener Kollege am ersten Tag neben dir sagen würde: wofür der
// Raum da ist, was die Zahl bedeutet, und was man damit MACHT. Jeder Schritt
// beantwortet drei Fragen — Was ist das? Wofür brauche ich es? Was tue ich
// jetzt damit?
//
// Der `tipp` ist bewusst knapp und aus dem Alltag. Wenn ein Schritt keinen
// echten Praxishinweis hat, bleibt er leer — erfundene Weisheit ist schlimmer
// als keine.
//
// ── WÄHLER (ziel) ──────────────────────────────────────────────────────────
// Findet der Wähler nichts (leerer Raum, Element noch nicht geladen), zeigt
// der Rundgang die Karte einfach mittig ohne Scheinwerfer. Ein Rundgang darf
// nie an einem fehlenden Element hängen bleiben.
//
// Kunden werden gesiezt, Mitarbeiter geduzt — auch hier.
// ═══════════════════════════════════════════════════════════════════════════
import type { RundgangSchritt } from "@/components/agent/Rundgang";

export const RUNDGANG_PIPELINE: RundgangSchritt[] = [
  {
    titel: "Hier verdienst du dein Geld.",
    text: "Die Pipeline ist dein Arbeitsraum für alles, was gerade Geld bringt: Menschen, die "
      + "sich gemeldet haben, die einen Antrag offen haben, die eine Zahlung angekündigt haben — "
      + "und seit dem 08.09. auch deine eigenen Kunden, deren nächste Rate fällig geworden ist. "
      + "Du arbeitest sie von oben nach unten ab — die Reihenfolge macht das System, nicht du. "
      + "Sie heißt Hitze: Zusage und Termin zuerst, dann fällige Rückrufe, dann das frischeste "
      + "Ereignis — Minuten schlagen Tage. Eine gestern fällige Rate steht deshalb neben einem "
      + "gestrigen Antrag, eine drei Wochen alte Rate hinter beiden. Das ist Absicht: Wird eine "
      + "Rate in den ersten Tagen angesprochen, zahlen 18,6 %; nach der fünften Mahnstufe nur "
      + "noch 3,4 %. Leads ohne Antrag kommen erst, wenn nichts Heißes mehr da ist.",
    tipp: "Wer morgens die Pipeline leerarbeitet und erst danach in andere Räume geht, hat den besten Monat.",
  },
  {
    // 08.09.2026 mitgezogen (E-165): der neue Grund, aus dem jemand hier steht.
    titel: "„Rate fällig“ heißt: dein Kunde, nicht dein Schuldner.",
    text: "Steht auf der Karte „Rate fällig seit X Tagen“, ist das ein Mensch, der schon einmal "
      + "bezahlt hat und dessen nächste Rate jetzt dran ist. Bis zum 08.09. tauchte er in keiner "
      + "Liste auf — 213 solcher Kunden mit zusammen 16.943 € lagen still. Jetzt kommt er zu dir, "
      + "und zwar zu dir persönlich, weil du sein Betreuer bist.",
    tipp: "Der Leitfaden dazu ist der weiche Reaktivierungs-Weg, kein Inkasso-Ton. Holst du die Rate zurück, gehören dir 50 % davon.",
  },
  {
    ziel: ".pi-fokus-karte",
    titel: "Die Karte oben ist dein nächster Anruf.",
    text: "Sie zeigt dir, wer dran ist, in welcher Lage der Mensch steckt und was dich das Gespräch "
      + "wert ist: den Vertragswert über zwölf Raten und deine Provision daraus. Der Satz darunter "
      + "sagt dir in einem Zug, warum genau dieser Mensch jetzt oben steht. Die kleine Zeile über dem Namen "
      + "sagt, wie heiß er ist — „Antrag vor 12 Min · noch ohne Anruf“ ist das Beste, was dir passieren kann.",
    tipp: "Lies den Satz einmal laut, bevor du wählst. Dann weißt du im ersten Moment des Gesprächs, worum es geht.",
  },
  {
    ziel: ".pi-starten",
    titel: "„Starten“ öffnet die Akte — dort passiert alles.",
    text: "Früher standen hier sieben Knöpfe nebeneinander. Jetzt gibt es einen: Er öffnet die "
      + "Kundenakte. Darin findest du anrufen, die Unterlagen, den Termin, den Versand und am Ende "
      + "das Ergebnis — alles an einer Stelle, in der richtigen Reihenfolge für genau diese Lage.",
    tipp: "Die Akte bleibt während des Telefonats offen — und das Telefon bleibt dran, auch wenn du im Office die Seite wechselst. Ändert sich etwas — Adresse, E-Mail, Paket — trägst du es sofort ein.",
  },
  {
    // 11.09.2026 (E-184, Team-Feedback 3): Zustimmungen gibt nur der Kunde — der Weg dorthin per Mail oder WhatsApp.
    titel: "Zustimmungen gibt nur der Kunde — du schickst ihm den Weg.",
    text: "Fehlen AGB/Datenschutz, Bonitätsprüfung oder die Vertragsannahme, zeigt die Akte die Vertragslücke mit zwei "
      + "Knöpfen: „Zustimmungs-Link per E-Mail senden“ und „Per WhatsApp“. Der Link gilt 30 Tage; der Verlauf sagt "
      + "ehrlich, ob die Mail rausging. Bestätigt der Kunde, stellt das Haus die erste Rechnung von selbst und schickt "
      + "die Zahlungsdaten in deinem Namen — die Zahlungsdaten selbst kannst du immer senden, auch vor der Zustimmung.",
    tipp: "Am Telefon: WhatsApp drücken, Nachricht abschicken, Kunde klickt zwei Kästchen — fertig.",
  },
  {
    // 24.08.2026, mit dem WhatsApp-Knopf zusammen angelegt. Justin: „Sowas muss
    // unbedingt mit aufgenommen werden für die Einführung — denke da IMMER mit."
    // Es gibt kein Ziel-Element, das immer da ist (der Knopf erscheint nur bei
    // offener Zahlung und vorhandener Nummer). Ohne `ziel` steht die Karte
    // mittig und erklärt trotzdem — besser als ein Scheinwerfer auf nichts.
    titel: "Zahlungsdaten auch per WhatsApp.",
    text: "Viele Menschen sagen im Gespräch „schicken Sie mir das bitte per WhatsApp“. Frag ruhig "
      + "selbst danach: „Darf ich Ihnen die Zahlungsdaten per WhatsApp UND per E-Mail schicken?“ Steht "
      + "eine Zahlung offen, findest du in der Akte einen grünen Knopf „Per WhatsApp“. Er öffnet "
      + "WhatsApp — am Rechner im Browser, am Telefon in der App — mit der fertigen Nachricht samt "
      + "Empfänger, IBAN und Verwendungszweck. Abschicken musst du selbst.",
    tipp: "Beides zu schicken zahlt sich aus: Die Mail ist der Beleg, WhatsApp wird gelesen. Jeder Versand steht danach im Verlauf der Akte.",
  },
  {
    // 25.08.2026, mit den Gesprächsangaben zusammen angelegt (AGENTS.md: keine
    // sichtbare Änderung ohne Abgleich mit den Rundgängen). Rückmeldung von
    // Daniel und Florentine aus dem Plattformtest.
    titel: "Was du im Gespräch erfährst, gehört in die Akte.",
    text: "Im Reiter „Sein Antrag“ steht oben rechts „Angaben nachtragen“. Dort trägst du ein, was "
      + "der Mensch dir am Telefon erzählt: Beruf, Einkommen, Miete, feste Ausgaben, offene "
      + "Verpflichtungen und wofür er den Rahmen braucht. Was im Monat übrig bleibt, rechnet das "
      + "System selbst aus — du siehst es schon beim Tippen.",
    tipp: "Zwei Minuten, die sich beim nächsten Anruf auszahlen: Der Kunde muss nichts wiederholen, und du weißt vor dem Wählen, worüber ihr sprecht.",
  },
  {
    // 21.09.2026 (E-202): die Boni-Ampel im Kopf der Akte. Ohne `ziel` — sie
    // steht nur in der geöffneten Akte, nicht auf der Pipeline selbst.
    titel: "Oben in der Akte: die Boni-Ampel.",
    text: "Jeder Kunde hat jetzt eine Ampel neben Stufe und Mandat — FIAONs eigene Einschätzung seiner Lage aus fünf Teilen: "
      + "Adresse, Einkommen, Ausgaben, Schulden und SCHUFA, je bis 20 Punkte. Grün heißt „Gute Lage“, Gelb „Machbar“, "
      + "Rot „Erst aufräumen“ — vor dem Antrag gibt es Arbeit, genau dafür ist FIAON da. Tippst du sie an, siehst du jeden Teil "
      + "mit seiner Herkunft: aus dem Kontoauszug, aus der SCHUFA, aus dem Antrag oder „Annahme“, wenn noch nichts vorliegt. "
      + "Belege schlagen Angaben; ein harter Befund (etwa harte SCHUFA-Einträge oder mehr Ausgaben als Einnahmen) hält sie von Grün fern, zwei machen sie rot.",
    tipp: "„geschätzt“ hinter der Zahl heißt: Die Unterlagen fehlen noch — Kontoauszüge, Ausweis, Auskunft. Und nie eine Farbe als Zusage verkaufen: Über die Karte entscheidet die Bank.",
  },
  {
    ziel: ".pi-trenner",
    titel: "Darunter stehen die, die danach kommen.",
    text: "Deine Arbeitsliste hat immer genau sechs Plätze: zwei Menschen, die eine Zahlung gemeldet "
      + "haben, zwei mit offenem Antrag und zwei Neukunden. Sobald du einen abschließt, rückt der "
      + "nächste nach. So arbeitest du nie an einem Berg, sondern immer an sechs Namen.",
    // 25.08.2026 mitgezogen: Der unberührte Vorrat ist seitdem unsichtbar.
    tipp: "Deine sechs kommen aus dem gemeinsamen Kundenpool — niemand besitzt einen Kunden, bevor das Mandat steht. Wen du anrufst, der bleibt bei dir; was du drei Tage liegen lässt, geht zurück in den Pool.",
  },
  {
    ziel: ".pi-kar",
    titel: "Wischen, tippen, nach vorn holen.",
    text: "Die Karten kannst du mit dem Finger oder der Maus zur Seite ziehen. Tippst du auf eine, "
      + "rückt sie nach vorn und wird dein nächster Fall. Du bestimmst die Reihenfolge innerhalb "
      + "deiner sechs — welche sechs es sind, bestimmt das System.",
  },
  {
    ziel: ".pi-legende",
    titel: "Die Leitfäden sagen dir, wie du das Gespräch führst.",
    text: "Jede Lage hat ihren eigenen Gesprächsweg: „Zahlung gemeldet“ führst du anders als einen "
      + "Neukunden. Klick den Leitfaden auf, der zu deinem Fall gehört — dort stehen der Einstieg, "
      + "die Fragen und die Sätze für die häufigsten Einwände.",
    tipp: "Am Anfang den Leitfaden offen lassen. Nach zwei Wochen brauchst du ihn nur noch bei Einwänden.",
  },
  {
    // 25.08.2026 mitgezogen: der Gesprächs-Modus (§10).
    titel: "Während du telefonierst, denkt die Akte mit.",
    text: "Sobald ein Anruf läuft, erscheint oben in der Akte der Gesprächs-Modus: genau EIN Schritt, "
      + "passend zur Lage des Kunden — bei einem Neukunden etwa „Interesse prüfen“, dann „Daten aufnehmen“. "
      + "Hak ihn ab, und der nächste kommt. Nach dem Auflegen übernimmt die Daumen-Frage.",
    tipp: "Du musst dir nie merken, was als Nächstes dran ist — es steht immer genau eine Sache da.",
  },
  {
    // 07.09.2026 mitgezogen (E-154): die Karte „Mein FIAON“ im Überblick der Akte.
    ziel: ".kbk",
    titel: "Was dein Kunde in seinem Bereich sieht, siehst du hier.",
    text: "Die Karte „Mein FIAON“ zeigt seinen Weg (Schritt x von 11), seine Vorgänge, Ansprüche, "
      + "die Vollmacht und den letzten Monatsbericht — dieselben Daten wie auf seinem Bildschirm. "
      + "Sagt er dir am Telefon „bei mir steht 5 von 11“, kannst du es bestätigen, ohne den Raum zu wechseln. "
      + "Der Knopf „Girokonto eröffnet“ trägt die Kontoeröffnung mit Datum ein; er sieht den Schritt sofort. "
      + "Die 10 € Kontoprovision entstehen davon nicht — die kommen nur mit der Bestätigung des Partners.",
    // 07.09.2026 nachgeschärft: „daneben“ zeigte auf die Kopfzeile der Leitung —
    // die sieht ein Betreuer gar nicht (LeitungsZeile rendert nur mit
    // darfVerschieben). Der Knopf, den JEDER Mitarbeiter hat, steht im Reiter
    // „Antrag“ und heißt „Portal ansehen als <Vorname>“.
    tipp: "Im Reiter „Antrag“ steht „Portal ansehen als …“ — damit liest du in seinem Portal mit. Nur bei deinen eigenen Kunden, nur lesend, 30 Minuten.",
  },
  {
    // 09.09.2026 (E-168, Team-Feedback): Nicht erreicht = morgen rechts, nicht heute.
    titel: "Wen du nicht erreichst, siehst du heute nicht wieder — morgen rechts unter „Wieder dran“.",
    text: "Klickst du „nicht erreicht“, verschwindet der Mensch für heute aus der Pipeline, die Liste "
      + "zieht frischen Nachschub, und seine Wiedervorlage steht auf morgen. Dann taucht er rechts "
      + "unter „Wieder dran“ auf — mit Zahl der Versuche. Sobald du ihn erreichst (egal mit welchem "
      + "Ergebnis), ist der Zähler zurück auf null.",
    tipp: "Ab dem sechsten Fehlversuch geht die Terminlink-Mail von selbst raus, ab dem neunten ruht der Mensch — beides bleibt wie bisher.",
  },
  {
    // 07.09.2026 (Justin, abends): zwei Spalten.
    ziel: ".pi-spalten",
    titel: "Links neu, rechts wieder dran.",
    text: "Unter deiner Fokus-Karte stehen zwei Reihen. Links „Neu für dich“: Menschen, die noch NIE "
      + "jemand angerufen hat — neuer Antrag, kein einziger Versuch. Rechts „Wieder dran“: alle, die "
      + "schon einmal Kontakt hatten und heute wieder etwas brauchen — nicht erreicht und fällig, Zusage "
      + "nicht gehalten, Rückruf vereinbart, Termin heute, Rate fällig, Wiedervorlage. Schließt du einen ab, "
      + "rückt der nächste nach. Links steht zuerst, wer laut Antrag JETZT erreichbar sein will (8–12, 12–15, "
      + "15–18, 18–20 Uhr) — „Flexibel“ oder keine Angabe zählt immer. Wer außerhalb seines Fensters liegt, "
      + "rückt erst nach, wenn niemand Passendes mehr da ist; die Karte zeigt das Fenster unten.",
    tipp: "Links: Wen rufe ich heute zum ersten Mal an? Rechts: Welche Fälle brauchen mich noch einmal? Die Karte rechts sagt, warum sie dort liegt — und wann der Mensch angerufen werden will.",
  },
  {
    // 07.09.2026 (Justin): Kündigung in der Akte.
    titel: "Kündigen und reaktivieren kannst du selbst — im Reiter „Antrag“.",
    text: "Sagt ein Kunde am Telefon, er will raus, drückst du „Kündigung durchsetzen“ und schreibst seinen Satz dazu. "
      + "Ab da kommen keine Zahlungsmails mehr, nur die Bestätigung; die letzte Rate bleibt fällig, spätere entfallen "
      + "(Kulanz-Haken: sofort Schluss, offene Raten entfallen). Überlegt er es sich im Gespräch anders, drückst du "
      + "„Kündigung zurücknehmen“ — die Raten kommen zurück, das Konto läuft weiter. Beides steht im Verlauf und "
      + "der Kunde sieht es in seinem Bereich.",
    tipp: "Kein Geld anfassen: Rückerstattungen entscheidet weiter nur die Geschäftsführung.",
  },
];

export const RUNDGANG_BESTAND: RundgangSchritt[] = [
  {
    titel: "Das hier ist dein Vermögen.",
    text: "Im Bestand stehen deine Mandate — die Menschen, die du zur Zahlung gebracht hast und die "
      + "du seitdem begleitest. Jeder von ihnen zahlt zwölf Raten, und an jeder bankbestätigten Rate "
      + "verdienst du mit. Anders als die Pipeline leert sich dieser Raum nie: Er wächst.",
    tipp: "Ein Kunde, der bleibt, ist mehr wert als zwei neue. Deshalb lohnt sich hier jeder Anruf.",
  },
  {
    ziel: ".be-kopf-zahlen",
    titel: "Was dein Bestand dir monatlich zahlt.",
    text: "Die Summe aller Monatsraten deiner Mandate, multipliziert mit deinem Provisionssatz. "
      + "Das ist kein Versprechen, sondern die Rechnung für den Fall, dass alle pünktlich zahlen — "
      + "und genau deshalb lohnt es sich, hinter offenen Raten her zu sein.",
  },
  {
    ziel: ".be-chips",
    // 24.08.2026 nachgezogen: Mit „Bereit für Konto & Karte" sind es vier statt
    // drei. Ein Rundgang, der „drei Filter" sagt und vier zeigt, ist der
    // schnellste Weg, dass ihm niemand mehr glaubt (AGENTS.md).
    titel: "Vier Filter, die dir den Tag sortieren.",
    text: "„Überfällig“ zeigt dir, wo Geld fehlt. „Termin fällig“ zeigt, mit wem du heute sprichst. "
      + "„Bereit für Konto & Karte“ zeigt die, bei denen alles zusammen ist — der Anruf, auf den die "
      + "ganze Betreuung hinausläuft. „Alle“ ist dein ganzer Bestand. Mehr gibt es bewusst nicht: "
      + "Wer zehn Filter hat, benutzt keinen.",
  },
  {
    ziel: ".be-karte",
    titel: "Eine Karte je Mensch.",
    text: "Name, Monatsrate, wie viele Raten schon bezahlt sind, wann du zuletzt gesprochen hast. "
      + "Jede Rate zahlt der Kunde per Überweisung — die Zahlungsdaten bekommt er mit jeder "
      + "Zahlungsmail, und sie stehen in seinem Kundenbereich.",
    tipp: "Seit 19.09.2026 gibt es keine Lastschrift mehr: Jede Rate zahlt der Kunde per Überweisung (Daten in der Zahlungsmail und im Kundenbereich). "
      + "Fragt ein Kunde nach einer Rückbuchung: Bereits per Lastschrift eingezogene Beträge erstattet FIAON; die Rate überweist er dann selbst.",
  },
  {
    // 24.08.2026, mit der Konto-&-Karte-Funktion zusammen angelegt (AGENTS.md:
    // keine sichtbare Änderung ohne Abgleich mit den Rundgängen). Kein `ziel`:
    // Der Hinweis erscheint nur auf Karten, deren Kunde wirklich bereit ist —
    // bei allen anderen läge der Scheinwerfer auf nichts.
    // 21.09.2026 (E-206) nachgezogen: ab der ersten Rate, automatisch.
    titel: "Konto & Karte — worauf alles hinausläuft.",
    text: "Fast jeder kommt mit dem Satz „Ich brauche eine Kreditkarte“. Seit dem 21.09. bekommt jeder Kunde "
      + "die Einladung unserer Partnerbank automatisch, sobald seine erste Zahlung gebucht ist (Antrag "
      + "vollständig vorausgesetzt) — die Mail heißt „Ihr Link zur Karte ist da“. In der Antragszeit lädt er "
      + "Kontoauszüge (sechs Monate), Ausweis und Auskunft hoch; daraus machen wir die Bonitätsanalyse. Der "
      + "Knopf „Karte bestellen“ in der Akte bleibt für den Nachversand. Erst das Konto, dann die Karte: "
      + "Die Kreditkarte gibt es nur als Zubuchung aus dem fertigen Banking heraus.",
    tipp: "Ruf nach der Einladung kurz an und begleite ihn durch den Antrag. Die 10 € je bestätigter Eröffnung bekommst du als sein Betreuer — auch wenn die Automatik die Mail geschickt hat.",
  },
  {
    // 11.09.2026 (E-175/E-178): Auskunft und Kontoauszug werden gelesen — der
    // Betreuer sieht das Ergebnis im Reiter „Dokumente“, nicht nur die Datei.
    titel: "Unter „Dokumente“ steht, was Auskunft und Kontoauszug SAGEN.",
    text: "Eine hochgeladene Bonitätsauskunft wird gelesen: Ampel, Score, jeder Posten mit Löschfrist und "
      + "Rechtsgrundlage, dazu die Auswertung als PDF und das fertige Schreiben an die Auskunftei. Ein "
      + "Kontoauszug wird Buchung für Buchung erfasst und gegen den Kontostand geprüft: Einnahmen, Ausgaben, "
      + "Einkommen, feste Zahlungen mit Tag im Monat, Warnungen. Beides steht im Reiter „Dokumente“ direkt "
      + "unter der Datei — und der Kunde sieht dieselben Zahlen in seinem Bereich. Aufklappbar darunter: "
      + "„Kontoauszug im Detail“ — jede Einkommensquelle mit Tag, alle Ausgaben bis zur einzelnen Buchung, "
      + "die größten Kostenpunkte und was sich sofort optimieren lässt.",
    tipp: "Vor dem Anruf einmal reinschauen: Wer weiß, was jeden Monat abgeht, wovon der Kunde lebt und an welchem Tag das Geld kommt, führt ein anderes Gespräch — und legt die Rate auf die Tage danach.",
  },
  {
    // 09.09.2026 (E-168): Der Menüpunkt ist weg — der Filter bleibt als Nachschlagewerk.
    titel: "Der Filter „Nicht erreicht“ ist dein Nachschlagewerk.",
    text: "Der Filter zeigt alle Menschen, die du (oder ein Kollege) nicht erreicht habt — mit Versuchen "
      + "und Wiedervorlage. Anrufen tust du sie aus der Pipeline: Sobald die Wiedervorlage fällig ist, "
      + "stehen sie rechts unter „Wieder dran“. Hier schaust du nur nach, wenn du jemanden suchst.",
    tipp: "Der Menüpunkt „Nicht erreicht“ im Office öffnet genau diesen Filter.",
  },
];

export const RUNDGANG_CALENDAR: RundgangSchritt[] = [
  {
    titel: "Alle deine Termine — nicht nur Startgespräche.",
    text: "Im Kalender steht jede Verabredung, die du mit einem Menschen hast: Vertriebsgespräche, "
      + "Rückrufe, Zahlungsgespräche und Startgespräche. Manche hast du selbst eingetragen, andere "
      + "hat der Kunde über seinen Terminlink gebucht.",
  },
  {
    ziel: ".ca-arten",
    titel: "Die Farbe sagt dir, welche Art es ist.",
    text: "Blau ist ein Vertriebsgespräch — der Mensch hat noch nicht bezahlt. Grün ist ein "
      + "Startgespräch nach der Zahlung. Braun ist ein Rückruf, den du selbst notiert hast. "
      + "Bernstein geht um eine offene Rate. Wer das vorher weiß, geht anders ins Gespräch. "
      // 17.09.2026 (E-188) mitgezogen: die Marke „FIAON Global" und ihr Sprung ins Firmen-Cockpit.
      + "Steht auf einer Karte „FIAON Global“, hat ein Unternehmen über fiaon.com/business ein "
      + "Erstgespräch gebucht: 30 Minuten, du rufst an — und „Zur Akte“ führt dich ins "
      + "Firmen-Cockpit, wo Firma, Paketwunsch und Verlauf liegen.",
    tipp: "Auf jeder Terminkarte steht außerdem, ob der Kunde selbst gebucht hat oder ob du den Termin eingetragen hast.",
  },
  {
    ziel: ".ca-knopf",
    titel: "Termin anlegen — und der Platz ist weg.",
    text: "Trägst du hier einen Termin ein, ist der Zeitpunkt für alle anderen blockiert: Kein "
      + "zweiter Kunde kann sich über seinen Link auf dieselbe Zeit buchen. Das gilt in beide "
      + "Richtungen — hat ein Kunde eine Zeit genommen, bekommst du sie nicht mehr angeboten.",
  },
  {
    ziel: ".ca-reiter",
    titel: "Tag oder Woche.",
    // 25.08.2026 mitgezogen: Der Kalender öffnet jetzt auf HEUTE (Florentine).
    text: "Der Kalender öffnet auf dem heutigen Tag — zuerst deine Termine, darunter das Überfällige "
      + "zum Aufräumen. Die Wochenansicht ist zum Planen da; am Handy siehst du sie als Liste, "
      + "Tag für Tag, jeder Termin eine eigene Karte mit Anrufen-Knopf.",
  },
  {
    // 25.08.2026 mitgezogen: Terminart beim Anlegen (Florentine Punkt 6).
    titel: "Beim Anlegen sagst du, worum es geht.",
    text: "Rückruf, Zahlung, Vertrieb oder Onboarding — die Art steht danach im Termin, und der "
      + "passende Leitfaden öffnet sich im Gespräch von selbst. Ein Rückruf braucht eine kurze "
      + "Begründung: Sie steht im Termin, damit du beim Klingeln weißt, warum du anrufst.",
    tipp: "Sagst DU einen Termin ab, wird diese Zeit dem Kunden nicht wieder angeboten — du hast ja abgesagt, weil du sie nicht kannst.",
  },
];

export const RUNDGANG_ONBOARDING: RundgangSchritt[] = [
  {
    // 28.08.2026, mit der Notiz-Prüfung (P1) zusammen angelegt.
    titel: "Eine Notiz statt sechs Kästchen.",
    text: "Im Gesprächs-Cockpit gibt es oben EIN Notizfeld: Du tippst während des Telefonats mit, "
      + "klickst \u201eNotiz prüfen & abhaken\u201c — und die Prüfung erkennt, welche Gesprächspunkte "
      + "deine Notiz belegt, hakt sie ab und füllt ihre Pflichtnotizen. Nur was fehlt, wird dir "
      + "als \u201eFEHLT NOCH\u201c angezeigt: Dann klärst du es im Gespräch, ergänzt die Notiz und "
      + "prüfst erneut. Sind alle Punkte belegt, schließt EIN Klick ab.",
    tipp: "Schreib ganze Sätze, keine Stichwort-Fetzen — die Prüfung (und der nächste Kollege) versteht dann beides.",
  },
  {
    titel: "Fünfzehn Minuten, die über den Kunden entscheiden.",
    text: "Hier führst du die Startgespräche: Der Mensch hat bezahlt, sein Konto wartet auf die "
      + "Freischaltung. In diesem Gespräch erklärst du ihm, was jetzt passiert, prüfst seine "
      + "Unterlagen und schaltest ihn frei. Wer dieses Gespräch gut führt, hat einen Kunden, der bleibt.",
    tipp: "Pünktlichkeit wird gemessen. Ruf lieber zwei Minuten zu früh an als eine Minute zu spät.",
  },
  {
    ziel: ".ob-fokus-innen",
    titel: "Dein nächstes Startgespräch.",
    text: "Oben steht, wer als Nächstes dran ist, mit einem Countdown bis zum vereinbarten "
      + "Zeitpunkt. Der große Knopf öffnet das Gesprächs-Cockpit — dort läuft eine Uhr mit, du "
      + "hakst die Agenda ab und schreibst deine Notizen, während ihr sprecht.",
  },
  {
    ziel: ".ob-block",
    titel: "Wartende, Termine, Erledigte.",
    text: "Wer bezahlt hat und noch keinen Termin hat, steht bei den Wartenden — dort schickst du "
      + "mit einem Klick die Einladung, und der Kunde wählt seine Zeit selbst. Erscheint jemand "
      + "nicht, meldest du das; er bekommt sofort eine E-Mail mit dem Link auf einen neuen Termin. "
      // 11.09.2026 (E-184, Team-Feedback 4): Leitung sieht alle, Sammelversand mit Vorschau.
      + "Als Vertriebsleitung siehst du hier die Wartenden aller Mitarbeiter: Der Filter „Kein Startgespräch "
      + "gebucht“ steht voreingestellt, ein Auswahlfeld zeigt jeden Betreuer mit Anzahl. Setze Haken oder nimm "
      + "„Alle offenen einladen“ — erst zeigt dir eine Vorschau, wer die Einladung bekommt und wer warum "
      + "übersprungen wird (zum Beispiel, weil er in den letzten 7 Tagen schon eine bekam), dann sendest du. "
      + "Jede Einladung steht danach in der Akte des Kunden.",
  },
  {
    // P10 (01.09.2026): Termin-Haken ≠ Onboarding-Abschluss.
    titel: "Termin bestätigt heißt noch nicht abgeschlossen.",
    text: "Seit dem 01.09. gilt: Der Kalender-Haken „stattgefunden“ schaltet das Konto des "
      + "Kunden frei — aber der Kunde bleibt unter „Zu dokumentieren“, bis du im Cockpit "
      + "die Pflicht-Agenda mit Notizen abgeschlossen hast. Erst dieser dokumentierte Abschluss "
      + "bucht auch deine Onboarding-Vergütung. So ist ein Gespräch erst fertig, wenn der "
      + "nächste Kollege lesen kann, was besprochen wurde.",
    tipp: "Direkt nach dem Telefonat die Notiz ins Cockpit — zwei Minuten, und Doku plus Vergütung sind erledigt.",
  },
  {
    // 07.09.2026 mitgezogen (E-154): der Schritt „Ansprüche prüfen“ vor dem Abschluss.
    titel: "Das Gespräch endet mit einer Liste, nicht mit „schön, dass wir gesprochen haben“.",
    text: "Vor dem Abschluss steht jetzt „Ansprüche prüfen“: zehn Fragen zu Konto, Einkommen und "
      + "Verträgen, eine nach der anderen. Jede Antwort ist sofort gespeichert — auch wenn das Gespräch "
      + "abbricht. Was schon im Antrag steht, liest du vor und lässt es nur bestätigen. Am Ende steht in "
      + "deiner Akte und in seinem Bereich dieselbe Liste dessen, was er beantragen kann. Der Schritt hakt "
      + "sich von selbst ab, sobald alle Fragen beantwortet sind.",
    tipp: "Wortlaut fürs Ende: „Das können Sie beantragen. Über den Betrag entscheidet die Stelle.“ — nichts versprechen.",
  },
];

export const RUNDGANG_COLLECTIONS: RundgangSchritt[] = [
  {
    // P15/P16 (01.09.2026): Suche + sichtbare Zusagen.
    titel: "Suchen statt scrollen — und Zusagen im Blick.",
    text: "Oben gibt es jetzt eine Kundensuche (Name, Telefon in jedem Format, E-Mail oder "
      + "Referenz) — sie findet auch Kunden, die gerade eine Zusage gegeben haben. Und das "
      + "vierte Fenster „Zusagen offen“ zeigt jeden, der ein Zahlungsdatum genannt hat: "
      + "Eine Zusage ist eine Stufe (Zahlung ausstehend), kein Verschwinden.",
    tipp: "Ruft ein Kunde zurück, such ihn hier — auch wenn er nicht in der Tagesliste steht.",
  },
  {
    titel: "Geld zurückholen — freundlich, nicht als Inkasso.",
    text: "Hier stehen die offenen Raten deiner eigenen Kunden. Diese Menschen haben schon einmal "
      + "bezahlt und sind in Rückstand geraten — das ist kein Vergehen, sondern meistens ein "
      + "vergessener Dauerauftrag oder ein enger Monat. Der Ton entscheidet, ob der Kunde bleibt.",
    tipp: "Einsteigen mit „ist mir aufgefallen, ich wollte kurz nachfragen“ — nie mit „Sie haben nicht bezahlt“.",
  },
  {
    ziel: ".co-fenster",
    titel: "Überfällig, heute, nächste sieben Tage.",
    text: "Fang immer bei „Überfällig“ an — dort liegt das Geld, das schon fehlt. „Nächste 7 Tage“ "
      + "ist für den ruhigen Nachmittag: ein kurzer Anruf vorher verhindert die Hälfte der "
      + "Rückstände.",
  },
  {
    ziel: ".co-karte",
    titel: "Eine Karte je Mensch, nicht je Rate.",
    text: "Hat jemand mehrere Raten offen, siehst du trotzdem nur eine Karte — sonst rufst du "
      + "denselben Menschen dreimal an. Die Bänder oben sagen dir, was los ist: Anruf-Pflicht, "
      + "gebrochene Zusage, eine Zusage mit Datum oder ein zweites Abo.",
  },
];

export const RUNDGANG_DASHBOARD: RundgangSchritt[] = [
  {
    titel: "Dein Tag auf einen Blick.",
    text: "Das Dashboard informiert, es arbeitet nicht. Es sagt dir, was heute ansteht und wo du "
      + "stehst — gearbeitet wird in der Pipeline, im Bestand und im Kalender.",
  },
  {
    ziel: ".st-kachel",
    titel: "Die drei Zahlen, die zählen.",
    text: "Termine heute, offene Aufgaben und die Größe deines Bestands. Jede Kachel führt dich "
      + "mit einem Klick dorthin, wo du etwas damit machen kannst.",
  },
  {
    ziel: ".st-block",
    titel: "„Jetzt dran“ ist deine Startliste.",
    text: "Zuerst die Termine von heute in ihrer Reihenfolge, danach die Rückrufe, die du zugesagt "
      + "hast. Wer diese Liste von oben nach unten abarbeitet, hat am Abend nichts vergessen.",
    tipp: "Zugesagte Rückrufe sind Versprechen. Sie stehen deshalb bewusst vor allem anderen, was du dir selbst vorgenommen hast.",
  },
];

export const RUNDGANG_GEHALT: RundgangSchritt[] = [
  {
    titel: "Was du verdienst — und woraus es entsteht.",
    text: "Dein Geld kommt aus mehreren Quellen: aus jeder bankbestätigten Rate deiner Mandate, "
      + "aus Startgesprächen mit SCHUFA-Abschluss, aus zurückgeholten Raten des Altbestands und "
      + "aus den Boni. Hier siehst du, wie sich das zusammensetzt.",
  },
  {
    ziel: ".gh-bausteine",
    titel: "Die Bausteine deiner Provision.",
    text: "Der Grundsatz gilt je Rate, nicht je Abschluss: Du verdienst zwölfmal an einem Kunden, "
      + "nicht einmal. Mit dem Zertifikat der Academy steigt dein Satz — das ist der schnellste "
      + "Hebel, den du selbst in der Hand hast.",
  },
  {
    ziel: ".gh-boni",
    titel: "Die Boni sind erreichbar, nicht theoretisch.",
    text: "Sie hängen an der Größe deines Bestands. Wer stetig Mandate holt und seine Kunden hält, "
      + "läuft von selbst hinein — sie sind ausdrücklich nicht für einen einzelnen guten Monat "
      + "gedacht, sondern für den, der bleibt.",
  },
];


export const RUNDGANG_WALLET: RundgangSchritt[] = [
  {
    titel: "Deine Auszahlungen, offen einsehbar.",
    text: "Im Wallet siehst du, was für dich zusammengekommen ist, was schon ausgezahlt wurde und was noch "
      + "aussteht. Jede Zeile lässt sich nachvollziehen — welcher Kunde, welche Rate, welcher Betrag. "
      + "Es gibt hier keine Sammelposten, hinter denen man nichts erkennt.",
  },
  {
    ziel: ".wa-block",
    titel: "Was schon bestätigt ist — und was noch nicht.",
    text: "Eine Provision entsteht, wenn die Zahlung bei FIAON bankbestätigt eingegangen ist, nicht schon beim "
      + "Abschluss. Deshalb stehen manche Beträge als offen: Das Geld ist unterwegs oder die Bestätigung fehlt "
      + "noch. Was bestätigt ist, geht in die nächste Abrechnung.",
    tipp: "Wenn dir eine Zeile fehlt, prüf zuerst im Bestand, ob die Rate wirklich schon eingegangen ist.",
  },
  {
    // 08.09.2026 mitgezogen (E-166, Justin): Auszahlungstag und Vorgemerktes.
    titel: "Ab dem 15. wird ausgebucht — du musst nichts beantragen.",
    text: "Alles, was bestätigt ist, geht ab dem 15. jeden Monats automatisch in die Auszahlung. Du kannst "
      + "trotzdem jederzeit anfordern, auch wenn eine ältere Anforderung noch offen ist. „Vorgemerkt“ heißt: "
      + "Der Betrag ist dir fest zugesagt — Gehalt zum Beispiel — und wird am genannten Tag frei. Bis dahin "
      + "siehst du ihn, kannst ihn aber noch nicht anfordern.",
    tipp: "Ohne IBAN im Profil bleibt dein Guthaben stehen. Trag sie einmal ein, dann läuft es von selbst.",
  },
];

export const RUNDGANG_TICKETS: RundgangSchritt[] = [
  {
    titel: "Wenn du selbst Hilfe brauchst.",
    text: "Tickets sind dein Weg zur Betreuung: technische Störungen, Fragen zu einem Kunden, alles, was du nicht "
      + "allein lösen kannst. Schreib, was du erwartet hast und was stattdessen passiert ist — mit dieser einen "
      + "Angabe wird ein Ticket meist beim ersten Mal gelöst.",
    tipp: "Geht es um einen bestimmten Kunden, nenn seinen Namen und die Referenznummer. Das spart eine Rückfrage.",
  },
  {
    ziel: ".ti-karte-kopf",
    titel: "Der Verlauf bleibt lesbar.",
    text: "Jede Antwort steht im Ticket, mit Namen und Zeitpunkt. Du musst nichts in einem Chat suchen und "
      + "niemand muss raten, was zuletzt besprochen wurde.",
  },
  {
    // 25.08.2026 mitgezogen: Die Sichtbarkeit wurde an diesem Tag eingegrenzt.
    titel: "Du siehst deine — nicht die der anderen.",
    text: "In der Liste stehen die Anliegen, die dir zugewiesen sind, und die deiner eigenen Kunden. "
      + "Was Kollegen schreiben, siehst du nicht: In einem Anliegen steht oft, was ein Mensch uns über "
      + "sein Geld, seine Schulden oder eine Kündigung anvertraut hat. Das gehört zu dem, der ihn betreut.",
    tipp: "Ein herrenloses Anliegen eines fremden Kunden landet bei der Leitung — sie teilt es zu. Du musst es nicht suchen.",
  },
];

export const RUNDGANG_SPACE: RundgangSchritt[] = [
  {
    titel: "Der Raum, in dem das Team miteinander redet.",
    text: "Hier stehen Neuigkeiten, Erfolge und die Fragen der Kollegen. Er ersetzt keinen Anruf beim Betreuer und "
      + "kein Ticket — er ist der Ort für das, was alle angeht.",
  },
  {
    ziel: ".sp-tagesleiste",
    titel: "Deine Zahlen des Tages.",
    text: "Verdienst im laufenden Monat, wie viele Kontakte du heute dokumentiert hast, und wie viele Menschen "
      + "gerade in deiner Arbeitsliste stehen. Die Arbeitsliste hat immer höchstens sechs Plätze — steht daneben "
      + "eine größere Zahl, ist das dein Bestand, nicht deine Liste.",
  },
];


export const RUNDGANG_ACADEMY: RundgangSchritt[] = [
  {
    titel: "Die Ausbildung, die deinen Satz erhöht.",
    text: "In der Academy lernst du das Handwerk: Wie eine SCHUFA-Auskunft aufgebaut ist, welche Fristen für "
      + "Einträge gelten, was rechtlich geht und was nicht, und wie du ein Gespräch führst. Am Ende steht eine "
      + "Prüfung, danach das Zertifikat als Bonitätsmanager — und mit ihm ein höherer Provisionssatz.",
    tipp: "Das Zertifikat ist der schnellste Hebel, den du selbst in der Hand hast. Er wirkt auf jede Rate, die danach kommt.",
  },
  {
    titel: "Ehrlich bleiben zahlt sich aus.",
    text: "Die Prüfung merkt sich, wenn das Fenster gewechselt wird — nicht um dich zu ärgern, sondern weil ein "
      + "Zertifikat wertlos ist, das jeder bekommt. Nimm dir die Zeit und mach sie einmal richtig.",
  },
  {
    titel: "Was du hier lernst, brauchst du am Telefon.",
    text: "Die häufigsten Einwände kommen aus Unwissen des Kunden — über Fristen, über die eigene Auskunft, über "
      + "das, was FIAON tut und was nicht. Wer die Antworten kennt, muss nicht überreden. FIAON gibt keine "
      + "Rechtsberatung und verspricht kein Ergebnis; das ist keine Einschränkung, sondern dein Schutz.",
  },
];

export const RUNDGANG_MORE: RundgangSchritt[] = [
  {
    titel: "Alles, was du selten brauchst — aber dann sofort.",
    text: "Unter „More“ liegen dein Profil, deine Unterlagen, die Leitfäden, die Updates und die Werkzeuge. "
      + "Nichts davon brauchst du täglich, aber wenn du es brauchst, soll es an einer Stelle stehen.",
  },
  {
    ziel: ".mo-ich",
    titel: "Dein Profil — und dein Bild.",
    text: "Dein Foto sehen die Kollegen im Team-Feed und im Flur. Deine Erreichbarkeit pflegst du nicht hier, "
      + "sondern unter Availability: Dort trägst du ein, wann Kunden bei dir Termine buchen können.",
    tipp: "Wer keine Zeiten hinterlegt, bekommt keine gebuchten Termine. Das ist der häufigste Grund für einen leeren Kalender.",
  },
  {
    ziel: ".mo-doks",
    titel: "Deine Unterlagen.",
    text: "Vertrag, Abrechnungen, Bescheinigungen — hier liegen sie zum Nachlesen und Herunterladen. Die "
      + "monatliche Abrechnung erscheint automatisch, sobald sie erstellt wurde.",
  },
];

export const RUNDGANG_AVAILABILITY: RundgangSchritt[] = [
  {
    titel: "Wann Kunden dich buchen können.",
    text: "Hier trägst du deine Arbeitszeiten ein. Genau daraus entstehen die freien Termine, die ein Kunde über "
      + "seinen Link sehen kann — trägst du nichts ein, bekommt er keinen einzigen Vorschlag und du keinen Termin.",
    tipp: "Trag lieber weniger Zeiten ein und halte sie zuverlässig, als viele, bei denen du nicht ans Telefon gehst. Termintreue wird gemessen.",
  },
  {
    // 25.08.2026 mitgezogen: Florentine konnte einen Termin nicht anlegen und
    // wusste nicht, dass diese Zeiten auch dafür gelten.
    titel: "Auch für Termine, die du selbst einträgst.",
    text: "Diese Zeiten gelten nicht nur für den Kunden-Link. Legst du im Kalender selbst einen Termin an, "
      + "prüft die Plattform ihn gegen genau dieselben Zeiten. Steht hier für den Mittwoch 10 bis 14:30, "
      + "lässt sich für Mittwoch 9 Uhr kein Termin eintragen — auch nicht von dir.",
    tipp: "Bekommst du „Zu dieser Zeit werden keine Gespräche angeboten“, liegt es fast immer an dieser Seite.",
  },
  {
    titel: "Was schon gebucht ist, bleibt gebucht.",
    text: "Änderst du deine Zeiten, verschwinden bereits gebuchte Termine nicht — das wäre gegenüber dem Kunden "
      + "nicht in Ordnung. Sie stehen weiter in deinem Kalender, auch wenn sie außerhalb deiner neuen Zeiten liegen; "
      + "der Kalender kennzeichnet sie dann.",
  },
];

/** Alle Rundgänge unter dem Schlüssel ihres Raums — der Schlüssel wird auch
 *  als Merker gespeichert und darf sich deshalb nie ändern. */

/**
 * Der Raum der Leitung (25.08.2026, mit dem Neubau angelegt).
 *
 * Justin: „Der Vertriebsleiter soll ‚alles' machen können." Genau das muss der
 * Rundgang sagen — sonst sucht jemand mit voller Berechtigung nach einer
 * Erlaubnis, die er längst hat.
 */
export const RUNDGANG_VERTRIEB: RundgangSchritt[] = [
  {
    titel: "Hier siehst du alles.",
    text: "Dieser Raum kennt keine Grenzen: jeden Menschen in der Kartei, jede Zahlung, jeden "
      + "Mitarbeiter. Was du hier änderst, wirkt sofort und steht mit deinem Namen im Verlauf — "
      + "das ist kein Misstrauen, sondern der Grund, warum du es überhaupt darfst.",
    tipp: "Die fünf Bereiche folgen dem Arbeitstag, nicht der Technik: Lage · Kunden · Team · Geld · Ordnung.",
  },
  {
    ziel: ".lt-punkte",
    titel: "Die Lage zeigt nur, was eine Entscheidung braucht.",
    text: "Keine Kachelwand mit allen Zahlen, die es gibt — nur die, zu denen du etwas TUN musst: "
      + "Menschen ohne Betreuer, gebrochene Zusagen, bezahlte Kunden ohne Startgespräch. Ist die "
      + "Seite leer, ist wirklich nichts offen.",
    tipp: "Jeder Punkt ist anklickbar und führt genau dorthin, wo man ihn abarbeitet.",
  },
  {
    ziel: ".lt-such-feld",
    titel: "Die Suche geht über die GANZE Kartei.",
    text: "Name, E-Mail, Telefon, Vorgangsnummer oder Verwendungszweck — und sie verzeiht "
      + "Tippfehler im Namen. Anders als in deiner eigenen Arbeitsliste ist hier niemand "
      + "ausgeblendet: auch bezahlte Kunden, auch gesperrte, auch die ohne Betreuer.",
    tipp: "Jede Zeile öffnet DIESELBE Akte wie in Pipeline und Bestand. Es gibt nur eine Akte im ganzen Haus.",
  },
  {
    titel: "Zahlungen buchst du in der Akte, nicht in einer Liste.",
    text: "Im Bereich „Geld“ siehst du, wo Geld fehlt — buchen tust du es in der Akte unter "
      + "„Zahlungen & Raten“. Dort liegt der Beleg dabei, das Abo startet und die Provision "
      + "entsteht. Ein zweiter Weg von der Liste aus wäre ein zweiter Ort, an dem dasselbe "
      + "passiert, und beide liefen mit der Zeit auseinander.",
  },
  {
    titel: "Ordnung ist die Arbeit, die sonst liegen bleibt.",
    text: "Dubletten, Testeinträge und die Befunde der Bestandswache. Ein Mensch, der zweimal in "
      + "der Kartei steht, bekommt zwei Rechnungen und zwei Anrufe. Zusammenführen ist NICHT "
      + "umkehrbar — deshalb steht der Knopf dafür in der Akte, wo du beide Seiten vollständig "
      + "siehst, und nicht in der Trefferliste.",
    tipp: "Einmal die Woche reicht. Aber dann wirklich.",
  },
];


// 28.08.2026, mit der Mail-Galerie zusammen angelegt (Rundgang-Pflicht:
// jede neue Seite erklaert sich selbst).
export const RUNDGANG_MAILS: RundgangSchritt[] = [
  {
    titel: "Jede Mail des Hauses — bevor der Kunde sie sieht.",
    text: "Diese Galerie zeigt saemtliche E-Mails, die FIAON an Kunden verschickt — mit "
      + "Beispieldaten, aber pixelgenau so, wie sie im Postfach ankommen. Wenn du am Telefon "
      + "sagst \u201eSie bekommen gleich eine E-Mail von uns\u201c, weisst du hier vorher, "
      + "was drinsteht und wie sie aussieht.",
    tipp: "Einmal durchklicken lohnt sich: Wer die Mails kennt, beantwortet Rueckfragen dazu in Sekunden.",
  },
  {
    titel: "Senden geht in der Akte — mit Vorschau.",
    text: "Von hier aus wird nichts verschickt. In der Kundenakte gibt es den Knopf "
      + "\u201eE-Mail senden\u201c: Dort waehlst du die Mail, siehst die Vorschau mit den ECHTEN "
      + "Daten dieses Kunden — Name, Betrag, Verwendungszweck — und schickst erst dann ab. "
      + "Jeder Versand steht danach im Verlauf und im Protokoll. Und mit \u201eFreie Nachricht\u201c schreibst du eigenen Text, der automatisch im FIAON-Design ankommt \u2014 Kopf, Fu\u00df und Anrede setzt das System.",
    tipp: "Erst die Vorschau lesen, dann senden. Steht dort ein leeres Feld, stimmt etwas an den Kundendaten.",
  },
];

export const RUNDGANG_ASSISTENT: RundgangSchritt[] = [
  {
    titel: "Das ist dein Copilot — er erledigt, du entscheidest.",
    text: "Du sagst in normalem Deutsch, was passieren soll: „Fasse den Kunden Michael zusammen“, "
      + "„Sende ihm die Zahlungsdaten“, „Buche morgen 14 Uhr einen Termin“. Der Copilot sucht den "
      + "Kunden, liest die Akte und arbeitet mit denselben Wegen, die du auch von Hand nehmen würdest — "
      + "er hat keinen einzigen Knopf, den du nicht auch hättest.",
    tipp: "Sprich mit ihm wie mit einem Kollegen, nicht wie mit einer Suchmaschine. Ganze Sätze funktionieren am besten. Morgens reicht „Was steht heute an?“ — er schreibt dir den Tagesbrief; vor einem Anruf „Bereite den Anruf mit … vor“.",
  },
  {
    ziel: "[data-fiaon='assistent-eingabe']",
    titel: "Ein Feld, alles drin.",
    text: "Hier tippst du deinen Auftrag. Enter sendet, Shift+Enter macht eine neue Zeile. Solange der "
      + "Copilot arbeitet, siehst du seine Antwort live entstehen — und jedes Werkzeug, das er benutzt, "
      + "erscheint als eigene Karte mit Status.",
  },
  {
    titel: "Alles mit Folgen wartet auf DICH.",
    text: "Mails, Termine, Bestellungen, Kontosperren, Einmal-Passwörter: Solche Aktionen führt der "
      + "Copilot NIE selbst aus. Er bereitet sie vollständig vor — bei Mails siehst du die echte Vorschau, "
      + "genau wie sie ankommt — und du klickst auf „Ausführen“ oder „Abbrechen“. Nach 15 Minuten "
      + "verfällt eine vorbereitete Aktion von selbst.",
    tipp: "Lies die Karte, bevor du bestätigst — du unterschreibst hier mit deinem Namen: Jede Aktion steht als „KI-Assistent im Auftrag von dir“ im Verlauf der Akte.",
  },
  {
    ziel: "[data-fiaon='assistent-anheften']",
    titel: "Eine Akte anheften spart dir jedes „bei Kunde X“.",
    text: "Such hier einen Kunden und heft seine Akte an die Sitzung. Ab dann beziehen sich alle "
      + "Aufträge auf diesen Menschen: „Was ist offen?“, „Schick ihm die Zahlungsdaten“, „Notiere: "
      + "ruft Montag zurück“ — ohne dass du den Namen wiederholst.",
  },
  {
    ziel: "[data-fiaon='assistent-sitzungen']",
    titel: "Deine Sitzungen bleiben da.",
    text: "Links liegen deine letzten Unterhaltungen — umbenennen und archivieren geht über die kleinen "
      + "Zeichen. Ein Klick öffnet den Verlauf samt aller Aktionskarten, auch die noch offenen "
      + "Bestätigungen. Über das Zeichen mit den drei Strichen oben links klappst du die Leiste ein "
      + "und aus — eingeklappt gehört die ganze Bühne dem Copilot.",
  },
  {
    ziel: "[data-fiaon='assistent-legende']",
    titel: "Was er kann — und was er nie kann.",
    text: "Hier steht ehrlich, welche Werkzeuge der Copilot hat und welche davon deine Bestätigung "
      + "brauchen. Was er grundsätzlich NICHT kann: löschen, Zahlungen oder Raten buchen, mehr als fünf "
      + "Kunden in einem Auftrag anfassen. Diese Grenzen stehen im Code, nicht in einer Bitte.",
    tipp: "In Kundentexten blockt der Copilot verbotene Wörter (Beratung, Garantie, Score-Versprechen) von selbst — die Entscheidung trifft immer die Bank.",
  },
];

export const RUNDGANG_FIRMEN: RundgangSchritt[] = [
  {
    titel: "Hier holst du Unternehmen ins Haus.",
    // 17.09.2026 (E-188): Das Cockpit verkauft FIAON Global — die US-Struktur
    // für Unternehmen zum Einmalpreis. Die Business-Abos sind eingestellt.
    text: "Seit dem 17.09.2026 verkaufst du hier FIAON Global: FIAON gründet für Unternehmen die "
      + "US-Gesellschaft, bereitet Steuernummern, Adresse, Dokumente sowie Konto- und Kartenanträge "
      + "vor — mit einem Team vor Ort in den USA. Vier Pakete, jedes ein EINMALPREIS, kein Abo. "
      + "Dein Auftrag: 50 Anrufe am Tag. Alles, was du dafür brauchst, liegt in diesem einen Raum.",
    tipp: "Blocke dir feste Anrufzeiten. 50 Anrufe sind 3–4 Stunden konzentriertes Telefonieren — der Ring oben zeigt dir live, wo du stehst.",
  },
  {
    ziel: ".fk-ring",
    titel: "Der Ring ist dein Tag.",
    text: "Er zählt jeden festgehaltenen Anruf aufs 50er-Ziel. Darunter stehen deine Treffer der "
      + "Woche — Termine und Abschlüsse. Der Ring füllt sich nur, wenn du nach jedem Gespräch "
      + "ein Ergebnis klickst. Kein Klick, kein Zähler, kein Nachweis.",
    tipp: "",
  },
  {
    ziel: ".fk-liste",
    titel: "Die Liste sagt dir, wer dran ist.",
    text: "„Jetzt dran\u201c zeigt zuerst fällige Wiedervorlagen (Menschen, denen du einen Anruf "
      + "versprochen hast), dann Neues. Ein Klick öffnet rechts die Anruf-Karte. Nachschub holst "
      + "du dir über „Liste einkleben\u201c — eine Excel-Kopie reicht, Doppelte sortiert das System aus. "
      // 17.09.2026 (E-188) mitgezogen: der Eingang von fiaon.com/business.
      + "Ganz oben stehen außerdem Unternehmen, die sich SELBST gemeldet haben: Wer auf "
      + "fiaon.com/business ein Erstgespräch zu FIAON Global bucht oder um einen Anruf bittet, "
      + "erscheint hier mit dem Zusatz „FIAON Global\u201c — mit Paketwunsch auf der Karte und der "
      + "Buchung im Verlauf. Das gebuchte Gespräch steht zusätzlich in deinem Kalender.",
    tipp: "Wiedervorlagen zuerst. Ein gehaltenes Versprechen verkauft besser als zehn Kaltanrufe.",
  },
  {
    ziel: ".fk-karte",
    titel: "Die Anruf-Karte: ein Blick, alles da.",
    text: "Große Nummer zum Antippen, Website, Verlauf, Notizfeld. Und der wichtigste Knopf: "
      + "„KI-Vorbereitung\u201c — ein Klick, und das System liest die Website der Firma und legt dir "
      + "Gesprächseinstieg, Anknüpfungspunkte, kluge Fragen und das passende Paket hin. "
      + "Dreißig Sekunden Vorbereitung, die dich klingen lassen wie einen, der die Firma kennt.",
    tipp: "Erst Vorbereitung lesen, dann wählen. Der Einstiegssatz ist zum laut Vorlesen gebaut.",
  },
  {
    ziel: ".fk-ergebnisse",
    titel: "Nach JEDEM Gespräch: ein Klick.",
    text: "Sieben Ausgänge, mehr gibt es nicht. Das System setzt Status und Wiedervorlage von "
      + "selbst: Nicht erreicht kommt in zwei Tagen wieder, Mailbox morgen, Interesse morgen. "
      + "Du musst dir nichts merken — du musst nur ehrlich klicken.",
    tipp: "",
  },
  {
    titel: "Interesse? Dann gibt es zwei Wege.",
    text: "Weg 1: „Info-Mail senden\u201c — die Firma bekommt sofort eine persönliche Mail mit deinem "
      + "Namen, den vier Paketen, den Pflichthinweisen und dem Link zum Auftrag. „Auftragslink "
      + "kopieren\u201c gibt dir denselben Link für WhatsApp: Dort wählt der Kunde das Paket, "
      + "unterschreibt den Vertrag selbst und überweist auf Rechnung. Weg 2: „Abschluss am Telefon\u201c — "
      + "ihr legt die Bestellung GEMEINSAM an, du wählst das Global-Paket (Einmalpreis aus dem Katalog), "
      + "und die Zahlungsdaten gehen an seine E-Mail. Den Vertrag unterschreibt er danach selbst über den "
      + "Auftragslink — am Telefon wird keine Zustimmung vermerkt. Der Zahlungseingang ist der Start.",
    tipp: "Wer „schick mir was\u201c sagt, bekommt die Mail UND einen festen Rückruf-Termin. Wer zögert, unterschreibt selten von allein.",
  },
  {
    titel: "Was du NIE versprichst.",
    text: "Keine Karte, kein Konto, keinen Rahmen oder Dollarbetrag, keinen Zinssatz, keine Frist, "
      + "keine Steuerersparnis, kein Darlehen — und du nennst keine Bank als Zusage. Über Konto, Karte "
      + "und Rahmen entscheidet allein das Institut; die Dollar-Zahl am Paket ist der Kapitalrahmen des "
      + "Kunden, kein Ergebnis. Steuer- und Rechtsfragen beantworten Steuerberater und Anwälte auf "
      + "eigenes Mandat — nicht du. Unsere Karte ist die Seriosität: Wir sagen zu, was wir selbst liefern.",
    tipp: "Der Leitfaden über der Liste hat für jeden Einwand eine Antwort — einmal am Tag durchlesen, bis er sitzt.",
  },
];

// 05.09.2026 (Kundenbereich /app, Scheibe 5): ein Vorgang des Kunden — Antrag oder Brief — aus Mitarbeitersicht.
export const RUNDGANG_APP_VORGANG: RundgangSchritt[] = [
  {
    titel: "Das hier hat der Kunde selbst ausgelöst.",
    text: "Ein Antrag, den der Kunde in seinem Bereich vorbereitet und mit dem Finger unterschrieben hat — oder ein "
      + "Brief, den er fotografiert hat. Du bist der Mensch dazwischen: Du versendest, du quittierst, du trägst das "
      + "Ergebnis ein. Nichts davon passiert automatisch, und der Kunde sieht jeden deiner Schritte sofort in seinem Bereich.",
    tipp: "Öffne die Akte über den Kundennamen oben, wenn du den Zusammenhang brauchst — hier bleibt nur der eine Vorgang.",
  },
  {
    ziel: ".av-stand",
    titel: "Der Stand sagt dir, was als Nächstes dran ist.",
    text: "„Unterschrieben — bitte versenden“ heißt: Das PDF liegt unten unter Dokumente, du schickst es an die Stelle und "
      + "bestätigst den Versand. „Versandt“ heißt: Warten auf Antwort. „Überfällig“ heißt: Der Fristenwächter hat dir eine "
      + "Aufgabe gegeben — frag bei der Stelle nach und trag es hier ein.",
    tipp: "Das Datum „Wir fragen nach am“ ist unser eigener Termin, keine gesetzliche Frist. Setz es realistisch.",
  },
  {
    ziel: ".av-form",
    titel: "Jeder Satz hier landet wörtlich beim Kunden.",
    text: "Was du in „Ein Satz für den Kunden“ oder „Zwei Sätze“ schreibst, steht Sekunden später in seinem Bereich unter "
      + "Vorgänge — in Sie-Form. Sag, was wir tun und was als Nächstes passiert. Sag nicht, was ein Brief „bedeutet“, und "
      + "versprich kein Ergebnis: Über Anspruch, Betrag, Karte und Rahmen entscheidet die Stelle oder die Bank.",
    tipp: "Kurz und konkret: „Ihre Bank hat den höheren Freibetrag ab 1. Oktober bestätigt. Der Bescheid liegt in Ihrer Akte.“",
  },
  {
    ziel: ".av-liste",
    titel: "Dokumente: das Unterschriebene und das, was zurückkam.",
    text: "Hier liegen das unterschriebene Schreiben als PDF, die Vollmacht und — wenn der Kunde geantwortet hat — der "
      + "fotografierte Bescheid. Öffnen, prüfen, Ergebnis eintragen. Du musst nichts herunterladen oder ablegen; die Akte hat es.",
  },
  {
    ziel: ".av-zeit",
    titel: "Der Verlauf ist dieselbe Zeitleiste, die der Kunde sieht.",
    text: "Jeder Punkt hier steht auch beim Kunden — mit Datum. Deshalb gibt es keine zwei Wahrheiten zwischen Telefon und "
      + "Bildschirm: Was du hier siehst, sieht er auch.",
  },
];

// ── BEWERBUNGEN (E-177, 11.09.2026) — Chefbüro Team → Bewerbungen und /admin/team ─
// Bis zum 11.09.2026 gab es diese Liste nicht: zehn Bewerbungen lagen ohne
// Status und ohne Zuständigen. Der Rundgang erklärt, wie das Versprechen der
// Website („Florentine Lombardi meldet sich persönlich") hier eingelöst wird.
export const RUNDGANG_BEWERBUNGEN: RundgangSchritt[] = [
  {
    titel: "Hier liegen die Menschen, die bei uns arbeiten wollen.",
    text: "Jede Bewerbung über fiaon.com/karriere landet in dieser Liste — mit allem, was der Bewerber angegeben hat, "
      + "und mit ihrem Stand: neu, im Gespräch, zugesagt, abgesagt. Die Website verspricht: „Florentine Lombardi meldet "
      + "sich persönlich bei Ihnen.“ Dieses Versprechen wird hier eingelöst — von einem Menschen, nicht von einer Automatik.",
    tipp: "Fast alle Bewerber sind Kunden. Wer vor dem Anruf die Akte öffnet, weiß, wie das Kundenverhältnis gerade läuft.",
  },
  {
    ziel: ".bw-standard",
    titel: "Wer neue Bewerbungen bekommt.",
    text: "Jede neue Bewerbung wird als Auftrag an diese Person übergeben — mit Mail „Neuer Auftrag für dich“ und Eintrag "
      + "unter Aufgaben → Aufträge. Die Geschäftsführung wechselt die Person hier, ohne dass jemand Code anfasst.",
  },
  {
    ziel: ".bw-filter",
    titel: "Offen, entschieden, Tests.",
    text: "„Offen“ zeigt, was Arbeit braucht: neu und im Gespräch. „Entschieden“ ist das Archiv. Eigene Probeeinträge "
      + "werden als Test markiert statt gelöscht — die Tabelle vergisst nichts, die Liste zeigt es nur nicht mehr.",
  },
  {
    ziel: ".bw-karte",
    titel: "Eine Bewerbung, alles auf einen Blick.",
    text: "Bereich, Land, Erfahrung, gewünschte Zusammenarbeit, frühester Start, Stunden pro Woche, Kontaktdaten — und ob "
      + "der Bewerber Kunde ist: dann stehen Betreuer und Akte daneben. Darunter der Satz, warum er zu FIAON will.",
  },
  {
    ziel: ".bw-knoepfe",
    titel: "Übernehmen, übergeben, entscheiden.",
    text: "„Übernehmen“ macht dich zuständig und legt den Auftrag bei dir an. „Übergeben an …“ gibt ihn jemand anderem. "
      + "„Zusagen“ und „Absagen“ schicken je eine Mail an den Bewerber — vorher siehst du sie in der Vorschau. Nach der "
      + "Zusage öffnet sich die Mitarbeiter-Einladung mit den Daten aus der Bewerbung; sie schickt den Zugangslink.",
    tipp: "Erst sprechen, dann klicken. Die Mails sind freundlich und ohne Fristen — die Entscheidung fällt im Gespräch.",
  },
  {
    ziel: ".bw-notiz",
    titel: "Die Notiz ist das Gedächtnis des Gesprächs.",
    text: "Was besprochen wurde, wann der Rückruf ist, was noch fehlt — hier hinein, damit die nächste Person nicht von "
      + "vorn anfängt. Gespeichert wird beim Verlassen des Felds.",
  },
];

// ── /chef/s/global-auftraege (17.09.2026, E-188) ────────────────────────────
export const RUNDGANG_GLOBAL_AUFTRAEGE: RundgangSchritt[] = [
  {
    titel: "Hier liegen die Aufträge der Unternehmen.",
    text: "FIAON Global ist der Aufbau einer US-Unternehmensstruktur — vier Pakete, 2.499 bis 35.999 €, einmalig. Ein Unternehmen "
      + "liest den Auftrag auf fiaon.com/business/start, unterschreibt auf dem Pad und bekommt Vertrag und Rechnung als PDF. "
      + "Bezahlt wird per Überweisung. Mit dem Zahlungseingang startet der Auftrag von selbst.",
    tipp: "Geld wird hier nicht gebucht. Der Zahlungseingang läuft über „Zahlungen verbuchen“ wie bei jedem Kunden.",
  },
  {
    ziel: ".cg-zahlen",
    titel: "Vier Zahlen, zwei davon sind Alarm.",
    text: "„Bezahlt, nicht gestartet“ heißt: Das Geld ist da, aber die Aufgabe oder die Startmail hing. „Gestartet ohne Stichtag“ "
      + "heißt: Das Startgespräch ist noch nicht geführt oder nicht eingetragen. Beide sollten null sein.",
  },
  {
    ziel: ".cg-marke",
    titel: "Offen, bezahlt, gestartet.",
    text: "Offen wartet auf die Überweisung — die zuständige Person hat dazu eine Aufgabe. Bezahlt wird beim Buchen der Zahlung; "
      + "gestartet wird erst, wenn die Aufgabe „US-Struktur starten“ bei jemandem liegt. Erst dann geht die Startmail an den Kunden, "
      + "denn sie sagt: „Ihr Ansprechpartner meldet sich bei Ihnen.“",
  },
  {
    ziel: ".cg-marke",
    titel: "Bleibt die Zahlung aus, fasst das System ruhig nach.",
    text: "Am dritten und am siebten Tag nach dem Auftrag bekommt das Unternehmen eine sachliche Erinnerung: ein Satz Anlass, der Knopf zur "
      + "Zahlungsseite, Vertrag und Rechnung über „Mein Auftrag“. Keine Mahnstufe, keine Bankdaten im Text, nie nachts oder sonntags. "
      + "Am zehnten Tag kommt keine Mail mehr, sondern eine dringende Aufgabe an die zuständige Person: anrufen. Unter dem Stand steht, "
      + "wann was rausging — und in Rot, wenn etwas den Takt aufgehalten hat (zum Beispiel eine unzustellbare Adresse).",
    tipp: "Hat der Kunde auf der Zahlungsseite „überwiesen“ gemeldet, bekommt er keine Erinnerung. Die Aufgabe am zehnten Tag entsteht trotzdem.",
  },
  {
    ziel: ".cg-knopf-storno",
    titel: "Auftrag stornieren — mit Grund, ohne Geldbewegung.",
    text: "Der Grund ist Pflicht; bei einem bezahlten Auftrag ein ganzer Satz. „Mit Erstattung“ bewegt kein Geld: Justin bekommt die dringende "
      + "Aufgabe „Erstattung veranlassen“ und überweist von Hand, die Bestellung geht auf storniert und gebuchte Provisionen werden "
      + "zurückgenommen. Ohne Erstattung bleibt die Zahlung gebucht — storniert wird dann nur der Auftrag. In beiden Fällen erfährt es die "
      + "zuständige Person als Aufgabe; der Kunde bekommt keine automatische Mail.",
    tipp: "Ein Storno lässt sich hier nicht zurücknehmen. Vertrag, Rechnung und Verlauf bleiben in der Akte.",
  },
  {
    ziel: ".cg-knopf-stichtag",
    titel: "Der Stichtag — an ihm hängt die Geld-zurück-Zusage.",
    text: "Ziffer 6 des Auftrags: Stehen Gesellschaft und EIN nicht zum vereinbarten Stichtag, erstatten wir den Paketpreis. Der Tag wird "
      + "im Startgespräch gemeinsam festgelegt und HIER eingetragen. Mit dem Haken bekommt der Kunde ihn sofort per Mail — der Auftrag "
      + "sagt diese Mitteilung in Textform zu.",
    tipp: "Trage nur ein, was mit dem Kunden besprochen ist. Der Stichtag ist ein Vertragsdatum, keine Planungsgröße.",
  },
  {
    ziel: ".cg-knopf-zustaendig",
    titel: "Zuständig ändern.",
    text: "Die offene Aufgabe wandert mit, die neue Person bekommt eine Mail und steht ab dann als Ansprechpartner in den Kundenmails. "
      + "Wer NEUE Aufträge bekommt, steht bei den Schaltern im Raum Rückholung (FIAON Global) — dort auch Provisionssatz und "
      + "Umsatzsteuer-Modus der Rechnung.",
  },
  {
    ziel: ".cg-links",
    titel: "Vertrag und Rechnung — dieselben Dateien, die der Kunde hat.",
    text: "Der Vertrag trägt Unterschrift, Zeitpunkt, IP-Adresse und einen Hash über den Text. Die Rechnung nennt die Firma mit "
      + "Anschrift und USt-IdNr. und „einmalig“. Steht in einer Zeile „Kein unterschriebener Auftrag“, wurde die Bestellung nicht "
      + "über /business/start angelegt — dann den Kunden dort unterschreiben lassen.",
  },
  {
    // 19.09.2026 (E-196) mitgezogen — ohne `ziel`: Die Zeile steht nur bei Aufträgen mit Jahresbetreuung.
    titel: "„Jahresbetreuung gebucht (ab Jahr 2)“ unter dem Paket.",
    text: "Die Jahresbetreuung kreuzt der Kunde im Auftrag an: Ab dem zweiten Jahr nach der Gründung übernimmt FIAON Registered Agent, "
      + "US-Adresse, Telefonnummer, US-Meldung und Jahresmeldung beim Bundesstaat samt Staatsgebühr — zum Preis in der Zeile, alle "
      + "Gebühren inklusive. Heute berechnet ist nur der Paketpreis; die Rechnung nennt die Jahresbetreuung als Hinweis. Sie verlängert "
      + "sich nicht von selbst: Rund einen Monat vor dem ersten Jahrestag bekommt die zuständige Person die Aufgabe, die Rechnung fürs "
      + "zweite Jahr zu stellen — mit deren Zahlung beginnt das Betreuungsjahr.",
  },
];

// ── /agent/global (17.09.2026, E-188) — die Liste der Global-Aufträge ───────
// Das Werkzeug der zuständigen Person. Der Rundgang erklärt, was oben steht und
// warum — und dass hier kein Geld gebucht und nichts zugesagt wird.
export const RUNDGANG_GLOBAL: RundgangSchritt[] = [
  {
    titel: "Hier lieferst du, was FIAON Global verspricht.",
    text: "Ein Unternehmen hat auf fiaon.com/business/start unterschrieben und überweist einmalig. Dafür sagen die Pakete einen "
      + "eigenen Dokumentenraum, einen Pflichtenkalender, einen festen Ansprechpartner und den monatlichen Durchgang zu. Der Kunde "
      + "sieht das alles auf seiner Seite „Mein Auftrag“ — und du pflegst es hier. Diesen Raum sieht nur, wer für einen "
      + "Global-Auftrag zuständig ist, und die Vertriebsleitung.",
    tipp: "Geld wird hier nicht gebucht. Der Zahlungseingang läuft über den einen Weg des Hauses — mit ihm startet der Auftrag von selbst.",
  },
  {
    ziel: ".gl-zahlen",
    titel: "Vier Zahlen. Zwei davon wollen heute etwas von dir.",
    text: "„Offen, unbezahlt“ wartet auf die Überweisung — ein kurzer Anruf hilft. „Bezahlt, nicht gestartet“ heißt: Das Geld ist da, "
      + "das Startgespräch fehlt. „In Arbeit“ sind deine laufenden Aufträge. „Fristen in 30 Tagen“ zählt Aufträge, bei denen eine "
      + "Frist aus dem Pflichtenkalender fällig wird oder schon überfällig ist.",
    tipp: "Steht bei „Bezahlt, nicht gestartet“ keine Null, fang dort an. Der Kunde hat bezahlt und erwartet deinen Anruf.",
  },
  {
    ziel: ".gl-leiste",
    titel: "Filter und Suche.",
    text: "„Laufend“ zeigt alles, was Arbeit braucht; Abgeschlossenes und Storniertes blendet es aus. Die Suche findet Firma, Ort, "
      + "Referenz, Paket und den Text des nächsten Schritts.",
  },
  {
    ziel: ".gl-tafel",
    titel: "Die Reihenfolge macht die Liste, nicht du.",
    text: "Ganz oben steht, wer bezahlt hat und noch nicht gestartet ist. Danach geht es nach der nächsten Frist, dann nach dem "
      + "Alter des Auftrags. Je Zeile: Stand, Etappe als vier Striche, Stichtag, nächster Schritt des Kunden, fehlende Unterlagen "
      + "und die nächste Frist. Ein Klick — oder Enter — öffnet die Akte.",
    tipp: "Steht beim Stichtag „fehlt“, ist der Auftrag gestartet, aber der Tag aus dem Startgespräch noch nicht eingetragen. An ihm hängt die Geld-zurück-Zusage.",
  },
  {
    // 19.09.2026 (E-196) mitgezogen — ohne `ziel`: Die Marke steht nur an Aufträgen mit Jahresbetreuung.
    titel: "Grüne Marke „Jahresbetreuung gebucht (ab Jahr 2)“.",
    text: "Der Kunde hat im Auftrag die Jahresbetreuung angekreuzt: Ab dem zweiten Jahr übernimmt FIAON Registered Agent, US-Adresse, "
      + "Telefonnummer, US-Meldung und Jahresmeldung beim Bundesstaat samt Staatsgebühr — alle Gebühren inklusive. Heute bezahlt er nur "
      + "den Paketpreis. Rund einen Monat vor dem ersten Jahrestag der Gründung bekommst du die Aufgabe, die Rechnung fürs zweite Jahr "
      + "zu stellen; sie verlängert sich nicht von selbst.",
    tipp: "Ohne Marke hat der Kunde sie nicht gebucht. Schreibt er, dass er sie dazunehmen möchte, gib es an die Leitung.",
  },
];

// ── /agent/global/:ref (17.09.2026, E-188) — die Akte eines Global-Auftrags ──
export const RUNDGANG_GLOBAL_AKTE: RundgangSchritt[] = [
  {
    titel: "Eine Akte, zwei Spalten: links arbeitest du, rechts liest du nach.",
    text: "Links liegen vier Reiter — Stand, Gesellschaft & Pflichten, Dokumente, Verlauf. Rechts stehen Kontakt, Firmendaten, "
      + "Vertrag und Rechnung. Alles, was du hier für den Kunden sichtbar speicherst, steht Sekunden später auf seiner Seite "
      + "„Mein Auftrag“ — wörtlich.",
    tipp: "Schreibst du an den Kunden, liest das Werkzeug mit: Steht unter dem Feld ein gelber Hinweis, prüf den Satz, bevor du speicherst.",
  },
  {
    ziel: ".gl-knoepfe",
    titel: "Anrufen, schreiben, mit den Augen des Kunden sehen.",
    text: "„Kundenansicht öffnen“ zeigt dir in einem neuen Fenster genau das, was der Kunde sieht. „Zugang senden“ schickt ihm "
      + "einen frischen Link per E-Mail — dafür ist der Knopf da, wenn er seinen Link nicht mehr findet oder der alte abgelaufen ist.",
  },
  {
    ziel: ".gl-etappen",
    titel: "Vier Etappen — ein Klick setzt sie.",
    text: "Gründung und Dokumente, die erste Firmenkarte, die Kartenleiter, das Bankdarlehen. Ein Klick auf eine Etappe öffnet den "
      + "Dialog: Text für den Kunden (vorbelegt, änderbar) und der Haken „Kunden benachrichtigen“. Nicht jedes Paket reicht bis "
      + "Etappe 4 — was nicht dazugehört, ist blass und mit „nicht im Paket“ beschriftet.",
    tipp: "Der Text sagt, was FIAON gerade TUT. Keine Frist, keine Zusage — über Konto, Karte, Rahmen und Darlehen entscheidet das Institut.",
  },
  {
    ziel: ".gl-ab-schritt",
    titel: "Der nächste Schritt gehört dem Kunden.",
    text: "Dieser Satz steht ganz oben auf seiner Seite: was ER als Nächstes tut, wenn du magst mit Datum. Ist es erledigt, leer "
      + "den Schritt — dann liest er: „Im Moment ist nichts von Ihnen nötig.“",
  },
  {
    ziel: ".gl-ab-stichtag",
    titel: "Der Stichtag ist ein Vertragsdatum.",
    text: "Im Startgespräch vereinbart ihr, bis wann Gesellschaft und EIN stehen. An diesem Tag hängt die Geld-zurück-Zusage aus "
      + "Ziffer 6 des Auftrags. Mit dem Haken bekommt der Kunde den Tag sofort per E-Mail — der Auftrag sagt ihm diese Mitteilung zu.",
    tipp: "Trag nur ein, was besprochen ist. Die Zusage gilt für Gesellschaft und EIN — nie für eine Entscheidung einer Bank.",
  },
  {
    ziel: '[data-reiter="gesellschaft"]',
    titel: "Gesellschaft eintragen — der Pflichtenkalender füllt sich von selbst.",
    text: "Sobald Name, Form, Bundesstaat und Gründungsdatum gespeichert sind, setzt der Server die Regel-Fristen in den Kalender — "
      + "die wiederkehrenden US-Meldungen und Staatsgebühren, die zu dieser Gesellschaft gehören. Du hakst ab, was erledigt ist, und "
      + "legst eigene Fristen dazu — zum Beispiel den monatlichen Durchgang, den die Pakete ab Global Banking zusagen.",
    tipp: "Ob eine Frist für diesen Kunden gilt, bestätigt sein Steuerberater bzw. US-CPA auf eigenes Mandat. Du erinnerst — du berätst nicht.",
  },
  {
    ziel: '[data-reiter="dokumente"]',
    titel: "Dokumente: was fehlt, was da ist, was du dazulegst.",
    text: "Oben die Liste der Unterlagen, die der Kunde liefern muss — mit „fehlt noch“ oder „liegt vor“. Darunter lädst du selbst "
      + "hoch: Art wählen, Datei wählen (PDF, JPG, PNG, HEIC bis 15 MB), entscheiden, ob der Kunde es sieht. Im Dokumentenraum "
      + "liegen beide Richtungen; „Ansehen“ öffnet, „Löschen“ blendet aus und steht im Verlauf.",
    tipp: "Gründungsdokument, EIN-Bestätigung, Operating Agreement: immer „für den Kunden sichtbar“ — das ist der Dokumentenraum, den er gekauft hat.",
  },
  {
    ziel: '[data-reiter="verlauf"]',
    titel: "Der Verlauf ist das Gedächtnis — mit zwei Farben.",
    text: "Grün markiert ist, was der Kunde sieht; grau bleibt intern. Eine Notiz ist zuerst intern. Erst mit dem Haken „für den "
      + "Kunden sichtbar“ landet sie in seinem Verlauf — dann in Sie-Form und ohne Zusage.",
    tipp: "Halt den monatlichen Durchgang hier fest: intern, was besprochen wurde — sichtbar, was als Nächstes passiert.",
  },
  {
    // 19.09.2026 (E-196) mitgezogen — ohne `ziel`: Marke und Zeile stehen nur bei gebuchter Jahresbetreuung.
    titel: "Jahresbetreuung gebucht? Dann steht es oben — und rechts, wann die Rechnung kommt.",
    text: "Hat der Kunde im Auftrag die Jahresbetreuung angekreuzt, trägt der Kopf die grüne Marke „Jahresbetreuung gebucht (ab Jahr 2)“. "
      + "Rechts unter „Vertrag und Rechnung“ steht der Preis je Betreuungsjahr, wann das zweite Jahr beginnt und ab wann du die Rechnung "
      + "dafür stellst — an diesem Tag kommt die Aufgabe „Jahresbetreuung: Rechnung für das zweite Betreuungsjahr stellen“. Gerechnet "
      + "wird ab dem Gründungstag; solange er fehlt, ab dem Start.",
    tipp: "Die Jahresbetreuung verlängert sich nicht von selbst. Mit der Zahlung der Jahresrechnung beginnt das Betreuungsjahr — bleibt sie aus, endet sie.",
  },
  {
    ziel: ".gl-nicht",
    titel: "Was du dem Kunden NICHT zusagst.",
    text: "Keine Karte, kein Konto, kein Rahmen, kein Zinssatz, keine Frist, keine Steuerersparnis, kein Darlehen — und keine "
      + "Banknamen als Versprechen. Steuer- und Rechtsfragen beantworten Steuerberater und Anwälte auf eigenes Mandat. Der Kasten "
      + "hält die Sätze bereit, mit denen du das dem Kunden freundlich sagst.",
  },
  {
    ziel: ".gl-karte-abschluss",
    titel: "Abschließen, wenn alles aus dem Paket geliefert ist.",
    text: "„Auftrag abschließen“ setzt den Stand auf abgeschlossen und die Etappe auf 5. Der Kunde liest deinen Abschlusstext in "
      + "seinem Verlauf; Dokumente und Pflichtenkalender bleiben für ihn sichtbar.",
  },
];

// ── /chef/s/firmen-radar (19.09.2026, Fassung 2) ─────────────────────────────
export const RUNDGANG_FIRMEN_RADAR: RundgangSchritt[] = [
  {
    titel: "Der Radar findet Firmen, die zu FIAON Global passen.",
    text: "Jeden Tag sucht er zwischen 6 und 20 Uhr, bis 50 geprüfte Firmen aus Deutschland, Österreich und der Schweiz im Radar stehen. "
      + "Die KI schlägt vor, der Server prüft: erreichbare Website, Firmenname auf der Seite, und eine E-Mail, die wirklich dort steht — "
      + "im Impressum, hinter einem mailto-Verweis, hinter dem Cloudflare-Schutz oder als „info [at] firma [dot] de“. Ohne Adresse kommt "
      + "eine Firma gar nicht erst herein.",
    tipp: "Oben stehen die Zahlen des Tages und die KI-Kosten. Über dem Deckel sucht der Radar erst am nächsten Tag weiter.",
  },
  {
    ziel: ".cr-kopf-tun",
    titel: "Auf Knopfdruck suchen — oder eine bestimmte Firma aufnehmen.",
    text: "„Firmen suchen“ öffnet die zehn Bereiche, dazu Land und Stichwort. Eine Suche dauert ein bis zwei Minuten und bringt bis zu zehn "
      + "neue Firmen; was verworfen wurde, steht mit Grund im Laufbalken. „Website aufnehmen“ legt eine einzelne Firma an.",
  },
  {
    ziel: ".cr-reiter-liste",
    titel: "Die Reiter zeigen, wo eine Firma gerade steht.",
    text: "„Offen“ sind neue und gescannte Firmen, „Mail bereit“ heißt: geschrieben, wartet auf dich. „Ohne E-Mail“ sammelt die Firmen, bei "
      + "denen nichts zu finden war — dort kannst du nachsuchen lassen oder eine Adresse eintragen.",
  },
  {
    ziel: ".cr-tabelle-rahmen",
    titel: "Anhaken — auch mehrere auf einmal.",
    text: "Die Zahl links ist die Einschätzung der KI, wie gut die Firma passt. Mit den Häkchen wählst du mehrere Firmen; unten erscheint die "
      + "Leiste: „Mails vorbereiten“ (scannt und schreibt), „Als Entwürfe ins Postfach“ und „Senden“. Zwischen zwei Mails liegen 20 bis 45 "
      + "Sekunden, damit sie persönlich wirken und nicht im Spam landen.",
    tipp: "Ein Klick auf die Zeile öffnet die Akte rechts: Überblick, Website-Scan und die Mail.",
  },
  {
    titel: "Die Mail gehört dir — nichts geht ohne Klick hinaus.",
    text: "Im Reiter „Mail“ stehen Betreff, Vorschau und der Text zum Ändern. Sie nutzt nur Aufhänger, die wörtlich auf der Website belegt "
      + "sind, siezt, verspricht kein Kapital und trägt Absender, Impressum und Abmeldesatz. Verletzt sie eine Regel der Wortwand, sperrt "
      + "der Server Entwurf und Versand. Je Firma geht genau eine erste Mail; „Kein Interesse“ und „Sperren“ setzen sie auf die Sperrliste.",
    tipp: "Werbe-Mails an Firmen brauchen in DE, AT und CH eine vorherige Einwilligung — der Radar fragt deshalb vor jedem Versand.",
  },
];

// ── /chef/s/telefonkartei (21.09.2026, E-201) ────────────────────────────────
export const RUNDGANG_TELEFONKARTEI: RundgangSchritt[] = [
  {
    titel: "Deine Telefonkartei: alle Kunden als Karten.",
    text: "Jede Karte zeigt alles, ohne sie zu öffnen: Stufe, Stand, Paket, Wunschlimit, Verwendungszweck, wer ihn betreut, "
      + "wann zuletzt telefoniert wurde und wann er erreichbar sein will. Die frischesten stehen oben — wie in der Arbeitsliste des Teams.",
  },
  {
    // 21.09.2026 (E-202)
    ziel: ".ba-kapsel",
    titel: "Auf jeder Karte: die Boni-Ampel.",
    text: "FIAONs eigene Einschätzung aus Adresse, Einkommen, Ausgaben, Schulden und SCHUFA — je bis 20 Punkte, zusammen 100. "
      + "Grün = Gute Lage, Gelb = Machbar, Rot = Erst aufräumen. Antippen klappt die fünf Teile mit ihrer Herkunft auf: "
      + "Kontoauszug, SCHUFA, Antrag oder Annahme.",
    tipp: "Belege schlagen Angaben: Der ausgewertete Kontoauszug zählt vor dem getippten Einkommen, die gelesene Auskunft vor der Schulden-Angabe. „geschätzt“ heißt: Es liegt noch kaum etwas vor.",
  },
  {
    ziel: ".tk-reiter",
    titel: "A, B, C, Rate offen — die Stufen des Hauses.",
    text: "A = Zahlung gemeldet, B = Antrag fertig, Rechnung offen, C = Lead ohne Antrag, „Rate offen“ = bezahlt, aber eine Monatsrate ist fällig. "
      + "„Alle“ zeigt jeden, „Storniert“ die, die du storniert hast. Gesperrte (Vertriebssperre) blendest du über den Schalter ein.",
    tipp: "Die Suche findet jeden — auch Gesperrte, Stornierte und Testkonten, jeweils mit Schild auf der Karte.",
  },
  {
    titel: "„Anrufen“ speichert zuerst den Kontakt auf deinem iPhone.",
    text: "Beim ersten Tippen öffnet das iPhone die Kontaktkarte — „Neuen Kontakt erstellen“ antippen, fertig. Der Kontakt heißt dann "
      + "„Name (FIAON)“, damit du beim Rückruf sofort weißt, wer anruft. Danach wählt derselbe Knopf direkt.",
    tipp: "Ohne diesen einen Tipp speichert kein iPhone einen Kontakt — das lässt Apple keiner Webseite zu.",
  },
  {
    // 21.09.2026 (E-205): ein Knopf „Nachrichten" statt vier Kacheln.
    ziel: ".tk-nachrichten",
    titel: "Nach dem Gespräch: „Nachrichten“.",
    text: "Ein Knopf, ein Blatt mit vier Fällen. „Rechnung schicken“: Die Mail mit der Rechnung als PDF geht automatisch raus, "
      + "WhatsApp öffnet sich mit Zahlungsseite, Bankdaten und Rechnungslink — du tippst nur noch auf Senden. „Nicht erreicht“: "
      + "freundliche Mail und WhatsApp mit deinem persönlichen Kalender, Name und Nummer sind dort schon eingetragen. „Später "
      + "anrufen“: Uhrzeit wählen, der Rückruf steht oben auf der Seite und auf Wunsch im iPhone-Kalender. „Stornieren“: raus aus "
      + "allen Listen, keine Anrufe, keine Werbung. Alle WhatsApp-Texte sind ohne Emojis und klingen wie von dir getippt.",
    tipp: "Alles landet in der Akte des Kunden — die Mitarbeiter sehen, was du getan hast. Du wirst dabei nie sein Betreuer.",
  },
  {
    titel: "Persönliche Nachricht: du sagst, worum es geht.",
    text: "Unten im Blatt steht „Persönliche Nachricht“. Tipp in deinen Worten, was der Kunde lesen soll — zum Beispiel „wie "
      + "besprochen in Ruhe die Website ansehen und sich wieder melden“. Die KI schreibt daraus eine persönliche WhatsApp an "
      + "genau diesen Menschen, mit seinem Namen und seiner Lage, ohne Emojis und ohne Versprechen. Du kannst alles ändern, "
      + "„Neu formulieren“ drücken und dann „In WhatsApp öffnen“ — abschicken tust du selbst.",
    tipp: "Die KI bekommt weder Telefonnummer noch E-Mail noch Bankdaten; Links setzt der Server ein. Was sie schreibt, prüft die Wortwand — Hinweise stehen gelb unter dem Text.",
  },
  {
    titel: "Akte und Termine, ohne die Seite zu verlassen.",
    text: "„Akte öffnen“ unten auf der Karte zeigt die ganze Akte in einem Fenster über der Kartei — schließen mit dem Kreuz oder der "
      + "Esc-Taste, und die Karte ist danach frisch. Ganz unten stehen zuerst deine Termine (gebucht über fiaon.com/justin und dein "
      + "Kalender, mit Anliegen), darunter aufklappbar alle Termine des Teams.",
  },
  {
    titel: "Storniert ist nicht gelöscht.",
    text: "Unter „Storniert“ steht jeder mit Grund und Datum. „Zurückholen“ nimmt genau das zurück, was der Storno getan hat — "
      + "Bestellung, Lead, Sperren. Bezahlte Verträge folgen der Kündigungsregel: Die laufende Rate bleibt fällig, außer du setzt „Kulanz“.",
  },
];

// ── /chef/s/mara (21.09.2026) ─────────────────────────────────────────────────
export const RUNDGANG_MARA: RundgangSchritt[] = [
  {
    titel: "Maras Steuerpult: alles, was sie tut, an einer Stelle.",
    text: "Mara beantwortet das Postfach — und schreibt von sich aus jeden an, der noch nichts bezahlt hat: zuerst A (Zahlung "
      + "gemeldet, Geld nicht da), dann B (Antrag fertig, Rechnung offen), rund um die Uhr, die frischesten zuerst. Jede Mail "
      + "schreibt sie aus der Akte, dem ganzen Weg des Kunden und ihrem Gedächtnis — nie zweimal dieselbe.",
  },
  {
    ziel: ".mp-schalter",
    titel: "Ein Schalter: Aktion läuft oder pausiert.",
    text: "Pausiert heißt: keine neuen Mails aus der Aktion. Die Antworten im Postfach laufen weiter. Einschalten und die nächsten Mails gehen im Takt raus.",
  },
  {
    ziel: ".mp-zahlen",
    titel: "Oben steht, was wirkt.",
    text: "Heute gesendet (mit dem Deckel des Tages), die letzte Stunde, wer fällig ist, und was danach geschah: Antworten, "
      + "Zahlungsmeldungen und Zahlungen innerhalb von 14 Tagen nach einer Mara-Mail. Rechts die Kosten — eine Mail kostet rund einen halben Cent.",
  },
  {
    ziel: ".mp-steuer",
    titel: "Steuern: Takt, Deckel, wer, wie.",
    text: "Bis zu 50 Mails je Stunde. In den ersten drei Tagen hält Mara sich selbst zurück (200, 400, 800 am Tag) — ein Postfach, "
      + "das über Nacht auf über tausend Mails springt, landet bei Gmail im Spam, und mit ihm jede Rechnung von fiaon.com. "
      + "C-Leads bleiben gesperrt, bis ihre Mail-Einwilligung geprüft ist.",
    tipp: "„Probe“ zeigt die nächste Mail, ohne sie zu senden — auch für einen bestimmten Menschen aus der Schlange.",
  },
  {
    ziel: ".mp-reiter",
    titel: "Jede Mail, vollständig.",
    text: "„Gesendet“: jede Mail mit dem, was danach kam. Aufklappen zeigt den ganzen Text, was Mara sich zu dem Menschen gemerkt hat "
      + "(einzeln löschbar) und seine Mails an uns. „Aus der Aktion nehmen“ stoppt Mara für genau diesen Menschen. "
      + "„Zurückgehalten“: Mails, die die Prüfung nicht bestanden haben — sie gingen nicht raus.",
  },
  {
    titel: "Rücksicht ist eingebaut.",
    text: "Schreibt der Kunde selbst, antwortet Mara im Postfach und die Aktion wartet sieben Tage. Hat ein Mitarbeiter gerade mit "
      + "ihm gesprochen oder ging eben eine andere Mail raus, wartet sie auch. Werbesperre, Vertriebssperre, „Stopp“, Storno, "
      + "Kündigung und Zustellprobleme beenden die Aktion für diesen Menschen.",
  },
];

// E-210 (22.09.2026): Der Lead-Motor — die Facebook-Leads direkt von Meta, ohne Make.
export const RUNDGANG_WHATSAPP: RundgangSchritt[] = [
  {
    titel: "Hier schreibst du mit deinen Kunden.",
    text: "Alles läuft über eine Nummer des Hauses (+49 1511 0761284) — nie über dein privates Telefon. Jede Nachricht, "
      + "hin wie zurück, steht in der Akte des Menschen. Du musst nichts abtippen und nichts weiterleiten.",
  },
  {
    ziel: ".wr-liste",
    titel: "Links stehen die Gespräche.",
    text: "Der grüne Punkt zeigt ungelesene Nachrichten, „Fenster offen“ heißt: Du darfst gerade frei schreiben. "
      + "Steht „Mara“ daran, antwortet die digitale Assistentin hier selbst. Mit den Filtern siehst du nur Ungelesenes "
      + "oder nur die Gespräche, in denen das Fenster noch läuft.",
    tipp: "Hat jemand aus dem Team ein Gespräch offen, steht das an der Zeile — dann antwortet ihr nicht doppelt.",
  },
  {
    ziel: ".wr-eingabe",
    titel: "Das 24-Stunden-Fenster entscheidet, was du senden darfst.",
    text: "WhatsApp erlaubt freien Text nur, solange der Mensch in den letzten 24 Stunden geschrieben hat. Im Kopf steht, "
      + "wie lange das Fenster noch läuft. Ist es zu, sperrt sich das Feld und du wählst eine von Meta freigegebene "
      + "Vorlage — antwortet der Mensch darauf, kannst du wieder frei schreiben.",
  },
  {
    titel: "Mahnungen gehören NICHT hierher.",
    text: "WhatsApp verbietet das Eintreiben von Forderungen. Offene Raten, Mahnungen und Rückstände laufen über Mail, "
      + "Telefon oder Brief. Der Raum lässt solche Nachrichten gar nicht erst raus — das schützt unsere Nummer.",
  },
  {
    ziel: ".wr-schalter",
    titel: "Mara und du am selben Tisch.",
    text: "Der Schalter sagt, ob Mara in diesem Gespräch selbst antwortet. Sobald du hier schreibst, schweigt sie "
      + "automatisch — du hast das letzte Wort. Willst du sie wieder übernehmen lassen, schaltest du sie hier an.",
  },
];

export const RUNDGANG_LEAD_MOTOR: RundgangSchritt[] = [
  {
    titel: "Der Lead-Motor: jeder Facebook-Lead, direkt von Meta.",
    text: "Meta meldet jeden neuen Lead in Sekunden an die Plattform. Alle fünf Minuten fragt die Plattform zusätzlich jedes "
      + "Formular nach — fällt die Meldung einmal aus, geht trotzdem kein Lead verloren. Ein Lead, der auf beiden Wegen kommt, "
      + "wird einmal angelegt.",
  },
  {
    ziel: ".lm-verbindung",
    titel: "Die Prüfliste zeigt, was bei Meta steht.",
    text: "Jeder Punkt sagt in einem Satz, was fehlt und wo man es einträgt: Zugangswerte in Render, Token, Rechte, Seite, "
      + "Webhook, Abo der Seite, Formulare, WhatsApp. „Verbindung einrichten“ trägt den Webhook bei Meta ein, abonniert die "
      + "Seite und lädt die Formulare — alles mit einem Knopf.",
    tipp: "Die Zugangswerte gehören nur in Render — nie in einen Chat oder eine Mail.",
  },
  {
    ziel: ".lm-messung",
    titel: "Die Messung: Meta erfährt, wer wirklich zahlt.",
    text: "Pixel und Server melden dieselben vier Schritte — Antrag begonnen, Antrag abgeschickt, Zahlung gebucht, "
      + "Startgespräch — und dazu die Stufe des Leads („Antrag fertig“, „hat bezahlt“). Erst damit kann eine Kampagne auf "
      + "zahlende Menschen optimieren statt auf ausgefüllte Formulare. Name, E-Mail und Telefon gehen nur verschlüsselt raus, "
      + "und nur, wenn der Mensch im Cookie-Fenster Marketing erlaubt hat.",
    tipp: "„Probe senden“ mit dem Testcode aus dem Events-Manager zeigt in Sekunden, ob die Leitung steht — ohne die echten Zahlen zu verfälschen.",
  },
  {
    ziel: ".lm-willkommen",
    titel: "Die Begrüßungsmail geht in Sekunden raus.",
    text: "Eine Mail statt der zwei aus Make, gesiezt, mit dem persönlichen Link: Name, E-Mail und Telefon stehen im Antrag "
      + "schon drin. Einschalten erst, wenn in Make der Brevo-Weg gelöscht ist — sonst bekommt der Mensch zwei Begrüßungen.",
    tipp: "„Vorschau“ zeigt die Mail, wie ein bestimmter Lead sie bekäme; der Prüfversand geht an die Testadresse des Mailwerks.",
  },
  {
    ziel: ".lm-rueckstand",
    titel: "Rückstand nachholen.",
    text: "Meta hält jeden Lead 90 Tage bereit. Ein Datum wählen und „Nachholen“ — was fehlt, wird angelegt; wer schon da ist, "
      + "wird nicht doppelt angelegt. Nachgeholte Leads der letzten 14 Tage bekommen eine Begrüßung, die sich für die Verspätung entschuldigt.",
  },
  {
    ziel: ".lm-formulare",
    titel: "Jeder Lead darf eine WhatsApp bekommen.",
    text: "Die Erlaubnis steht im Hinweistext des Formulars — wer absendet, hat ihn gelesen. Ein Pflicht-Kästchen gibt es "
      + "bewusst nicht, es würde die Hälfte der Menschen aussperren. Nur wer ein vorhandenes Kontakt-Kästchen NICHT anhakt "
      + "oder „STOPP“ schreibt, bekommt keine. Ob wirklich eine WhatsApp rausgeht, hängt dann nur noch an der Nummer: "
      + "Festnetz kann kein WhatsApp.",
  },
  {
    ziel: ".lm-leads",
    titel: "Jeder Lead mit seinem Weg.",
    text: "Woher er kam (Meta direkt, nachgeholt, Make, Import), welche Kampagne und Anzeige, Facebook oder Instagram, ob er "
      + "WhatsApp erlaubt hat, ob die Begrüßung rausging, ob er seinen Link geöffnet hat und ob ein Antrag daraus wurde.",
  },
  {
    titel: "Der Wächter meldet Stille.",
    text: "Kommt tagsüber drei Stunden kein Lead, meldet der Webhook nichts mehr oder ist der Zugang abgelaufen, steht oben ein "
      + "Alarm — und in „Meine Liste“ eine Aufgabe mit dem Satz, was zu tun ist.",
  },
];

// WhatsApp-Zentrale (23.09.2026, E-229) — Maras Versand an Kundengruppen.
export const RUNDGANG_WA_ZENTRALE: RundgangSchritt[] = [
  {
    titel: "Die WhatsApp-Zentrale: wen Mara anschreibt — von Hand oder im Takt.",
    text: "Vier Gruppen, jede mit ihrer passenden Vorlage: neue Leads ohne Nachricht, Anträge mit offener erster Zahlung, "
      + "abgebrochene Anträge und Leads ohne Antrag. Antworten übernimmt Mara wie bisher im WhatsApp-Raum.",
  },
  {
    ziel: ".wz-meta",
    titel: "Oben rechts: was Meta heute noch erlaubt.",
    text: "Meta lässt je Nummer nur eine bestimmte Zahl neuer Gespräche in 24 Stunden zu. Die Zentrale rechnet mit 80 % davon "
      + "und zählt alles mit — Begrüßung, Kette, Hand und Automatik. Steht die Qualität auf Rot, sind Massenversände gesperrt, "
      + "sonst droht die Sperre der Nummer.",
  },
  {
    ziel: ".wz-gruppen",
    titel: "Gruppe wählen — die Zahl sagt, wer heute dran sein darf.",
    text: "Gezählt wird nur, wer alle Regeln erfüllt: heute noch keine WhatsApp, kein „STOPP“, keine Werbesperre, nichts bezahlt "
      + "oder gemeldet, genug Abstand zur letzten Vorlage, höchstens acht Vorlagen in 30 Tagen.",
  },
  {
    ziel: ".wz-start",
    titel: "Vorlage, Anzahl, Vorschau — dann „WhatsApp starten“.",
    text: "Die Vorschau zeigt die nächsten Empfänger mit genau dem Text, den sie bekommen. Der Versand läuft im Hintergrund, eine "
      + "Nachricht nach der anderen, und lässt sich jederzeit anhalten. Zwischen 21 und 7 Uhr geht nichts raus.",
    tipp: "„Passende Erinnerung“ wählt je Lead die Stufe nach seinem Alter — so bekommt niemand zweimal dieselbe.",
  },
  {
    ziel: ".wz-automatik",
    titel: "Die Automatik: z. B. 5 je Stunde von 07:40 bis 20:45.",
    text: "Gleichmäßig über die Stunde verteilt, Gruppen in der Reihenfolge, die hier steht. Solange sie läuft, pausiert die alte "
      + "Stundenkette. Die Sofort-Begrüßung neuer Leads läuft immer weiter.",
  },
  {
    ziel: ".wz-verlauf",
    titel: "Jede Nachricht mit dem, was danach kam.",
    text: "Zugestellt, gelesen, geantwortet — und bei Übersprungenen der Grund. Ein Klick auf den Namen öffnet die Akte.",
  },
];

export const RUNDGAENGE: Record<string, { titel: string; schritte: RundgangSchritt[] }> = {
  waZentrale:  { titel: "WhatsApp-Zentrale", schritte: RUNDGANG_WA_ZENTRALE },
  bewerbungen:  { titel: "Bewerbungen",  schritte: RUNDGANG_BEWERBUNGEN },
  globalAuftraege: { titel: "Global-Aufträge", schritte: RUNDGANG_GLOBAL_AUFTRAEGE },
  firmenRadar: { titel: "Firmen-Radar", schritte: RUNDGANG_FIRMEN_RADAR },
  telefonkartei: { titel: "Telefonkartei", schritte: RUNDGANG_TELEFONKARTEI },
  mara:        { titel: "Mara", schritte: RUNDGANG_MARA },
  leadMotor:   { titel: "Lead-Motor", schritte: RUNDGANG_LEAD_MOTOR },
  whatsapp:    { titel: "WhatsApp", schritte: RUNDGANG_WHATSAPP },
  global:      { titel: "FIAON Global", schritte: RUNDGANG_GLOBAL },
  globalAkte:  { titel: "Global-Akte",  schritte: RUNDGANG_GLOBAL_AKTE },
  appVorgang: { titel: "Vorgang", schritte: RUNDGANG_APP_VORGANG },
  firmen:      { titel: "Firmenkunden", schritte: RUNDGANG_FIRMEN },
  pipeline:    { titel: "Pipeline",     schritte: RUNDGANG_PIPELINE },
  vertrieb:    { titel: "Leitung",      schritte: RUNDGANG_VERTRIEB },
  bestand:     { titel: "Mein Bestand", schritte: RUNDGANG_BESTAND },
  calendar:    { titel: "Calendar",     schritte: RUNDGANG_CALENDAR },
  onboarding:  { titel: "Onboarding",   schritte: RUNDGANG_ONBOARDING },
  collections: { titel: "Collections",  schritte: RUNDGANG_COLLECTIONS },
  dashboard:   { titel: "Dashboard",    schritte: RUNDGANG_DASHBOARD },
  gehalt:      { titel: "Earnings",     schritte: RUNDGANG_GEHALT },
  wallet:      { titel: "Wallet",       schritte: RUNDGANG_WALLET },
  tickets:     { titel: "Tickets",      schritte: RUNDGANG_TICKETS },
  space:        { titel: "Team-Feed",    schritte: RUNDGANG_SPACE },
  academy:      { titel: "Academy",      schritte: RUNDGANG_ACADEMY },
  more:         { titel: "More",         schritte: RUNDGANG_MORE },
  availability: { titel: "Availability", schritte: RUNDGANG_AVAILABILITY },
  mails:        { titel: "Unsere E-Mails", schritte: RUNDGANG_MAILS },
  assistent:    { titel: "Copilot",        schritte: RUNDGANG_ASSISTENT },
};
