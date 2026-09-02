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
    text: "Die Pipeline ist dein Arbeitsraum für alles, was noch KEIN Mandat ist: Menschen, die "
      + "sich gemeldet haben, die einen Antrag offen haben oder die eine Zahlung angekündigt haben. "
      + "Du arbeitest sie von oben nach unten ab — die Reihenfolge macht das System, nicht du.",
    tipp: "Wer morgens die Pipeline leerarbeitet und erst danach in andere Räume geht, hat den besten Monat.",
  },
  {
    ziel: ".pi-fokus-karte",
    titel: "Die Karte oben ist dein nächster Anruf.",
    text: "Sie zeigt dir, wer dran ist, in welcher Lage der Mensch steckt und was dich das Gespräch "
      + "wert ist: den Vertragswert über zwölf Raten und deine Provision daraus. Der Satz darunter "
      + "sagt dir in einem Zug, warum genau dieser Mensch jetzt oben steht.",
    tipp: "Lies den Satz einmal laut, bevor du wählst. Dann weißt du im ersten Moment des Gesprächs, worum es geht.",
  },
  {
    ziel: ".pi-starten",
    titel: "„Starten“ öffnet die Akte — dort passiert alles.",
    text: "Früher standen hier sieben Knöpfe nebeneinander. Jetzt gibt es einen: Er öffnet die "
      + "Kundenakte. Darin findest du anrufen, die Unterlagen, den Termin, den Versand und am Ende "
      + "das Ergebnis — alles an einer Stelle, in der richtigen Reihenfolge für genau diese Lage.",
    tipp: "Die Akte bleibt während des Telefonats offen. Ändert sich etwas — Adresse, E-Mail, Paket — trägst du es sofort ein.",
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
      + "Steht dort ein bernsteinfarbener Hinweis, fehlt die Lastschrift für die Folgeraten — ein "
      + "Klick darauf bittet den Kunden per E-Mail, sie in seinem Kundenbereich einzurichten.",
    tipp: "Kunden ohne Lastschrift werden am häufigsten überfällig. Diesen Hinweis solltest du nie stehen lassen.",
  },
  {
    // 24.08.2026, mit der Konto-&-Karte-Funktion zusammen angelegt (AGENTS.md:
    // keine sichtbare Änderung ohne Abgleich mit den Rundgängen). Kein `ziel`:
    // Der Hinweis erscheint nur auf Karten, deren Kunde wirklich bereit ist —
    // bei allen anderen läge der Scheinwerfer auf nichts.
    titel: "Konto & Karte — worauf alles hinausläuft.",
    text: "Fast jeder kommt mit dem Satz „Ich brauche eine Kreditkarte“. Sobald ein Kunde drei Dinge "
      + "erfüllt — Antrag vollständig, Paket und Auskunft bezahlt mit zwei gelaufenen Raten, "
      + "Kontoauszug und Ausweis da — steht auf seiner Karte „Bereit für Konto & Karte“, und der "
      + "Filter oben zeigt dir alle auf einmal. In der Akte schickst du ihm dann den Weg zum "
      + "kostenlosen Girokonto bei unserem Kooperationspartner. Erst das Konto, dann die Karte: "
      + "Die Kreditkarte gibt es nur als Zubuchung aus dem fertigen Banking heraus.",
    tipp: "Ruf vorher an, statt den Link wortlos zu schicken. Für dich sind es 10 € je bestätigter Eröffnung — und der Kunde bleibt, weil er endlich das bekommt, weswegen er gekommen ist.",
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
      + "Bernstein geht um eine offene Rate. Wer das vorher weiß, geht anders ins Gespräch.",
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
      + "nicht, meldest du das; er bekommt sofort eine E-Mail mit dem Link auf einen neuen Termin.",
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
      + "denselben Menschen dreimal an. Die Bänder oben sagen dir, was los ist: geplatzte "
      + "Lastschrift, gebrochene Zusage, fehlende Lastschrift.",
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
    tipp: "Sprich mit ihm wie mit einem Kollegen, nicht wie mit einer Suchmaschine. Ganze Sätze funktionieren am besten.",
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
    text: "Jede Firma braucht Liquidität — und Liquidität hängt an der Firmen-Bonität bei "
      + "Creditreform, SCHUFA und KSV. Dein Auftrag: 50 Anrufe am Tag, aus Fremden werden "
      + "Firmenkunden. Alles, was du dafür brauchst, liegt in diesem einen Raum.",
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
      + "du dir über „Liste einkleben\u201c — eine Excel-Kopie reicht, Doppelte sortiert das System aus.",
    tipp: "Wiedervorlagen zuerst. Ein gehaltenes Versprechen verkauft besser als zehn Kaltanrufe.",
  },
  {
    ziel: ".fk-karte",
    titel: "Die Anruf-Karte: ein Blick, alles da.",
    text: "Große Nummer zum Antippen, Website, Verlauf, Notizfeld. Und der wichtigste Knopf: "
      + "„KI-Vorbereitung\u201c — ein Klick, und das System liest die Website der Firma und legt dir "
      + "Gesprächseinstieg, Schmerzpunkte, kluge Fragen und eine Paket-Empfehlung hin. "
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
      + "Namen und dem Einstiegslink. Weg 2, der starke: „Abschluss am Telefon\u201c — ihr füllt den "
      + "Antrag GEMEINSAM aus, du wählst das Paket, und am Ende hast du den Zahlungslink, den du "
      + "ihm noch im Gespräch nennst. Aus einem Anruf wird ein Kunde, ohne dass er je ein Formular sieht.",
    tipp: "Wer „schick mir was\u201c sagt, bekommt die Mail UND einen festen Rückruf-Termin. Wer zögert, unterschreibt selten von allein.",
  },
  {
    titel: "Was du NIE versprichst.",
    text: "Keine garantierten Löschungen, keine Kredite, keine Score-Zusagen — und keine "
      + "Exklusiv-Verträge mit Auskunfteien. Unsere Karte ist die Seriosität: alles einsehbar, "
      + "jedes Schreiben anwaltlich geprüft, jeder Schritt dokumentiert. Genau das unterscheidet "
      + "uns von denen, vor denen Unternehmer gewarnt werden.",
    tipp: "Der Leitfaden über der Liste hat für jeden Einwand eine Antwort — einmal am Tag durchlesen, bis er sitzt.",
  },
];

export const RUNDGAENGE: Record<string, { titel: string; schritte: RundgangSchritt[] }> = {
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
