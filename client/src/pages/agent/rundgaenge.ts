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
// 26.09.2026 (E-243) · E-252 (28.09.2026): Die Auskunft-Preise stehen nicht mehr im Rundgang — der
// Auskunft-Rundgang ist auf einen Satz je Schritt gekürzt; die Preise zeigt die Seite selbst.

export const RUNDGANG_PIPELINE: RundgangSchritt[] = [
  {
    titel: "Hier verdienst du dein Geld.",
    text: "Die Pipeline ist dein Arbeitsraum für alles, was gerade Geld bringt: Menschen, die "
      + "sich gemeldet haben, die einen Antrag offen haben, die eine Zahlung angekündigt haben — "
      + "und seit dem 08.09. auch deine eigenen Kunden, deren nächste Rate fällig geworden ist. "
      + "Du arbeitest sie von oben nach unten ab — die Reihenfolge macht das System, nicht du. "
      + "Sie heißt Hitze. Ganz oben steht nur, was genau JETZT eine Uhrzeit hat: ein Termin in den "
      + "nächsten 15 Minuten, ein Rückruf, der gerade fällig ist. Direkt danach die Sofort-Spur: jeder "
      + "Antrag und jede Zahlungsmeldung der letzten 24 Stunden, die seither niemand angerufen hat — der "
      + "neueste zuerst, die Karte sagt „Neu · Antrag vor 12 Min“. Wer zahlt, zahlt fast immer in den "
      + "ersten drei Tagen; der erste Tag entscheidet. Danach Zusagen und Termine von heute, fällige "
      + "Rückrufe und das frischeste Ereignis — Minuten schlagen Tage. Eine gestern fällige Rate steht deshalb neben einem "
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
    // E-244 (26.09.2026): Knopf „Zahlungspflichtig annehmen" + Bestellübersicht auch über den Link.
    tipp: "Am Telefon: WhatsApp drücken, Nachricht abschicken, Kunde klickt die Kästchen. Fehlt die Vertragsannahme und steht "
      + "das Paket fest, heißt sein Knopf „Zahlungspflichtig annehmen“ – darüber sieht er Paket, Leistung, Monatsrate, zwölf "
      + "Monate Laufzeit, Gesamtbetrag und Kündigung. Steht kein Paket fest, kann er über den Link nur AGB und Bonitätsprüfung "
      + "bestätigen – den Vertrag schließt ihr dann über den Antrag.",
  },
  {
    // E-244 (26.09.2026, § 312j BGB): Justin: „ändere den Knopf auf zahlungspflichtig annehmen".
    titel: "Der Klick, der zahlt.",
    text: "Im Schritt „Vertrag“ sieht der Kunde seine Angaben (mit „Angaben ändern“ – ohne neue Prüfung zurück), darunter die "
      + "Bestellübersicht: Paket, Leistung, Rate, zwölf Monate fest, Gesamtbetrag, Überweisung, Kündigung. Erst „Zahlungspflichtig "
      + "annehmen“ schließt den Vertrag; „Weiter zum Vertrag“ in Schritt 5 bindet noch nicht. Die Haken allein reichen nicht: Bricht "
      + "der Kunde vor dem Knopf ab, steht in der Akte „Es fehlt: Zustimmung zum Vertrag“ — schick ihm dann den Zustimmungslink. Die "
      + "Bonitätsauskunft gehört nicht zum Paket: Das Paket wertet sie aus, beschaffen tun wir sie nur als Zusatz.",
    tipp: "Fragt der Kunde am Telefon, was er annimmt: genau die Zeilen der Übersicht vorlesen – nichts dazu versprechen.",
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
    // 05.10.2026 (E-282): die persönliche FIAON-PIN. Ohne `ziel` — Kennung und
    // Knopf stehen nur in der geöffneten Akte, nicht auf der Pipeline selbst.
    titel: "Am Telefon sicher sein: „PIN prüfen“.",
    text: "Kunden legen im neuen Antrag eine vierstellige persönliche FIAON-PIN fest; ändern können sie sie jederzeit in ihrem Bereich "
      + "unter „Mehr → Persönliche PIN“. Oben in der Akte, neben den Marken unter dem Namen, steht „PIN festgelegt“ oder „Keine PIN“ "
      + "und daneben der Knopf „PIN prüfen“. Willst du sicher sein, dass wirklich der Kunde am Telefon ist, drückst du ihn, lässt dir "
      + "die vier Ziffern nennen und tippst „Prüfen“. Du siehst nur das Ergebnis — „PIN stimmt“, „stimmt nicht“ mit den restlichen "
      + "Versuchen oder „gesperrt bis“ —, nie die PIN selbst. Nach fünf Fehlversuchen ist die Prüfung 15 Minuten gesperrt, und jede "
      + "Prüfung steht mit deinem Namen im Verlauf. Eine PIN gilt erst ab der ersten Zahlung — vorher steht dort „PIN gilt ab 1. Zahlung“. "
      // 05.10.2026 (E-283) mitgezogen: die Zeile zum Limit-Gespräch in der Akte.
      + "Bei Pro, Ultra und High-End steht außerdem „Limit-Gespräch: ab … / jetzt buchbar / gebucht …“.",
    tipp: "Frag nie nach der PIN einer Bankkarte — die vergibt allein die Bank. Hat der Kunde seine FIAON-PIN vergessen, tippt er in seinem Bereich auf „PIN vergessen?“ und legt über den Anmelde-Link eine neue fest.",
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
      + "rückt erst nach, wenn niemand Passendes mehr da ist; die Karte zeigt das Fenster unten. Neue Anträge "
      + "erscheinen von selbst: Die Liste lädt jede Minute neu — nur nicht während eines Anrufs und nicht, "
      + "solange eine Akte offen ist.",
    tipp: "Links: Wen rufe ich heute zum ersten Mal an? Rechts: Welche Fälle brauchen mich noch einmal? Die Karte rechts sagt, warum sie dort liegt — und wann der Mensch angerufen werden will.",
  },
  {
    // 07.09.2026 (Justin): Kündigung in der Akte.
    // 27.09.2026 (E-245): Unbezahlte Bestellung — ihre offenen Raten fallen mit weg und kommen nicht zurück.
    titel: "Kündigen und reaktivieren kannst du selbst — im Reiter „Antrag“.",
    text: "Sagt ein Kunde am Telefon, er will raus, drückst du „Kündigung durchsetzen“ und schreibst seinen Satz dazu. "
      + "Ab da kommen keine Zahlungsmails mehr, nur die Bestätigung; die letzte Rate bleibt fällig, spätere entfallen "
      + "(Kulanz-Haken: sofort Schluss, offene Raten entfallen). War die Bestellung nie bezahlt, wird sie storniert — "
      + "mit allen offenen Raten, es bleibt keine Forderung. Überlegt er es sich im Gespräch anders, drückst du "
      + "„Kündigung zurücknehmen“ — die Raten kommen zurück, das Konto läuft weiter (Raten einer nie bezahlten "
      + "Bestellung bleiben storniert). Beides steht im Verlauf und der Kunde sieht es in seinem Bereich.",
    tipp: "Kein Geld anfassen: Rückerstattungen entscheidet weiter nur die Geschäftsführung.",
  },
  {
    // E-IT-E (08.10.2026): zusammengeführte Personen und der Dubletten-Knopf der Leitung.
    // Kein „ziel": Band und Knopf erscheinen nur unter Bedingungen (Rundgang-Pflege, Regel 2).
    titel: "Zwei Akten, ein Mensch — und wer danach betreut.",
    text: "Öffnest du einen Kunden über einen alten Link (WhatsApp, Anruf, Termin) und er wurde inzwischen mit "
      + "einer zweiten Akte zusammengeführt, geht die gemeinsame Akte auf — oben steht dann, in welche Person er "
      + "aufgegangen ist, wann und von wem. Die Leitung führt Doppelte über „Dubletten zusammenführen“ zusammen: "
      + "Vor dem Klick steht dort, wer danach betreut. Gefragt wird nur, wenn BEIDE Akten einen aktiven Betreuer "
      + "haben; ist nur auf einer Seite jemand eingetragen, übernimmt er automatisch.",
    tipp: "Ausgeschiedene, gesperrte oder Test-Konten zählen nicht als Betreuer — die Liste zeigt sie mit dem Zusatz in Klammern.",
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
      + "Firmen-Cockpit, wo Firma, Paketwunsch und Verlauf liegen. "
      // 05.10.2026 (E-283) mitgezogen: Support heißt jetzt auch im Kalender so, dazu das Limit-Gespräch.
      + "„Support“ ist ein Hilfegespräch mit einem Bestandskunden nach dem Startgespräch. Violett ist ein "
      + "Limit-Gespräch: Kunden mit Pro, Ultra oder High-End buchen es alle drei Monate selbst in ihrem Bereich — "
      + "Raten, Stand der Akte, ein konkreter nächster Schritt, nie ein Limit zusagen. Danach als erledigt abhaken, "
      + "nur dann zählt es; „kam nicht zustande“ zählt nicht.",
    // 24.09.2026 (E-236) mitgezogen: Mara trägt Rückrufe selbst ein.
    tipp: "Auf jeder Terminkarte steht außerdem, ob der Kunde selbst gebucht hat oder ob du den Termin eingetragen hast. "
      + "„von Mara“ (im Wochenraster ein blauer Punkt) heißt: Mara hat den Rückruf per WhatsApp oder E-Mail mit dem Kunden "
      + "vereinbart — die Notiz darunter sagt, worum es geht. „über Maras Link“: der Kunde hat selbst über Maras Terminlink gebucht.",
  },
  {
    ziel: ".ca-knopf",
    titel: "Termin anlegen — und der Platz ist weg.",
    text: "Trägst du hier einen Termin ein, ist der Zeitpunkt für alle anderen blockiert: Kein "
      + "zweiter Kunde kann sich über seinen Link auf dieselbe Zeit buchen. Das gilt in beide "
      + "Richtungen — hat ein Kunde eine Zeit genommen, bekommst du sie nicht mehr angeboten.",
    // 05.10.2026 (E-283) mitgezogen: die Art „Limit-Gespräch“ beim Anlegen.
    tipp: "Ein Limit-Gespräch kannst du jederzeit selbst eintragen: „Termin anlegen“ → Art „Limit-Gespräch“. "
      + "Für dich gilt die Drei-Monats-Regel nicht, nur für die Buchung im Kundenbereich.",
  },
  {
    // 29.09.2026 (E-263): Justin — „mit 1 Klick in mein Google oder Apple Kalender".
    ziel: ".ca-abo",
    titel: "Deine Termine im Handy-Kalender.",
    text: "„In meinen Kalender“ richtet ein Abo ein: iPhone/Mac mit einem Tipp, Google über „per URL hinzufügen“, "
      + "Outlook über „Link kopieren“. Danach kommen neue Termine von selbst, verschobene ändern sich, abgesagte "
      + "verschwinden — nichts steht doppelt. Ein zweiter Klick zeigt, wann dein Kalender zuletzt abgerufen hat.",
    // Gegenprüfung 29.09.2026: Abo ODER Mail-Knopf — beides zusammen ergibt denselben Termin zweimal.
    tipp: "Google holt ein Abo nur alle paar Stunden, Apple nach Minuten — was gerade ansteht, zeigt immer dieser Calendar. "
      + "Mit Abo keinen Termin zusätzlich über den Knopf in der Termin-Mail eintragen, sonst steht er doppelt (die Mail "
      + "lässt die Knöpfe dann ohnehin weg). Google: beim FIAON-Kalender einmal „Benachrichtigung 10 Minuten vorher“ setzen. "
      + "Im Kalender steht keine Telefonnummer — angerufen wird über das FIAON-Telefon in der Akte.",
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
    // 27.09.2026 (E-245): Stornierte Raten zählen nirgends mehr als offen.
    text: "Hier stehen die offenen Raten deiner eigenen Kunden. Diese Menschen haben schon einmal "
      + "bezahlt und sind in Rückstand geraten — das ist kein Vergehen, sondern meistens ein "
      + "vergessener Dauerauftrag oder ein enger Monat. Der Ton entscheidet, ob der Kunde bleibt. "
      + "Raten, die mit einem Storno, einer Kündigung oder einer Erstattung entfallen sind, stehen "
      + "hier nicht — dort gibt es nichts zurückzuholen.",
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
  {
    // 24.09.2026 (E-236): Mara handelt selbst — der Block zeigt, was neu von ihr kommt.
    ziel: ".st-mara-block",
    titel: "Neu von Mara.",
    text: "Hier stehen die Rückrufe, die Mara in den letzten 72 Stunden per WhatsApp oder E-Mail für dich vereinbart hat, "
      + "und Termine, die Kunden über Maras Terminlink gewählt haben — mit "
      + "Uhrzeit, Name und der Notiz, worum es geht. Du bekommst dazu auch eine Mail. „Gesehen“ blendet den "
      + "Eintrag auf diesem Gerät aus; der Termin selbst bleibt im Kalender.",
    tipp: "Ruf pünktlich an: Mara hat dem Kunden genau diese Uhrzeit bestätigt.",
  },
  {
    // 24.09.2026 (E-240): Die Karte „Neu von Mara“ (components/AufgabenErinnerung.tsx)
    // hängt am Office-Rahmen, nicht an einer Seite — der Rahmen hat keinen eigenen
    // Rundgang, deshalb steht sie hier neben Maras Terminen. Ohne Karte (nichts
    // ungelesen) zeigt der Rundgang diesen Schritt mittig.
    ziel: ".fi-auf",
    titel: "Maras Aufgaben kommen zu dir.",
    text: "Legt Mara eine Aufgabe für dich an — ein Kunde hat geschrieben oder will auf WhatsApp einen Menschen "
      + "sprechen —, erscheint unten rechts über dem Telefonknopf die Karte „Neu von Mara“, auf jeder Seite im Office. "
      + "Oben steht die neueste mit Kunde und Maras Zusammenfassung, darunter bis zu vier weitere. „Öffnen“ bringt dich "
      + "in die Akte und zählt diese eine Aufgabe als gesehen. „Später“ blendet die Karte aus, ohne etwas als gesehen "
      + "zu zählen. Danach ruht die Karte, bis die nächste neue kommt — alle ungelesenen stehen weiter unter Tasks. "
      + "Ein roter Rand heißt: dringend."
      // E-244 (26.09.2026): „Kunde hat geschrieben" schließt sich, sobald die Antwort draußen ist.
      + " Hat Mara für einen Kunden einen Mail-Entwurf vorbereitet („Kunde hat geschrieben — bitte antworten“), schließt sich die "
      + "Aufgabe von selbst, sobald die Antwort auf genau diese Mail draußen ist: wenn du sendest oder „Übernommen“ wählst, wenn die "
      + "Leitung sie im Postfach freigibt oder wenn Mara sie selbst sendet. Bei Rückrufwunsch, Beschwerde, bestrittener Forderung, "
      + "Widerruf, rechtlichen Fragen oder Zahlungsunfähigkeit bleibt sie offen („Antwort gesendet — bitte selbst nachfassen“). "
      + "Schreibt der Kunde danach erneut, öffnet sie sich wieder.",
    // Gegenlesen 24.09.2026: Der Knopf zeigt den ZUSTAND („Ton an"), nicht die Handlung —
    // vorher verwies der Tipp auf einen Knopf „Ton aus", den man bei eingeschaltetem Ton nicht findet.
    tipp: "Trifft eine neue Aufgabe ein, während du arbeitest, klingt ein leiser Doppelton — nie während eines Gesprächs. Ein Tipp auf „Ton an“ unten in der Karte schaltet ihn ab.",
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
      + "der Kartei steht, bekommt zwei Rechnungen und zwei Anrufe. „Jetzt suchen“ zeigt die Paare "
      + "mit Grund und Betreuung beider Seiten. Zusammenführen ist NICHT umkehrbar — deshalb steht "
      + "der Knopf dafür in der Akte, wo du beide Seiten vollständig siehst, und nicht in der Trefferliste. "
      + "Eine Betreuer-Wahl verlangt das System nur bei zwei AKTIVEN Betreuern; sonst übernimmt der eine.",
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
  // E-240 (24.09.2026): Die gekaufte Bonitätsauskunft läuft über denselben Vorgang —
  // angelegt vom System nach der Zahlung, mit einer Mail an den Kunden beim Ergebnis.
  {
    titel: "Datenkopie bei einer Auskunftei: die gekaufte Auskunft.",
    text: "Hat der Kunde die Bonitätsauskunft bezahlt, legt das System je Auskunftei seines Landes so eine Anfrage an "
      + "(Deutschland: SCHUFA, CRIF, Creditreform Boniversum · Österreich: KSV1870, CRIF · Schweiz: CRIF, Intrum). Der Kunde "
      + "unterschreibt Vollmacht und Anfragen nacheinander, du versendest und quittierst. Kommt die Datenkopie, trägst du "
      + "„bewilligt“ ein — hier heißt das: Datenkopie eingegangen. „Abgelehnt“ heißt: Die Auskunftei hat eine Rückfrage. "
      + "Ausnahme von der Regel oben: In beiden Fällen bekommt der Kunde automatisch eine Mail — bei der Rückfrage mit deinem Satz "
      + "als Grund, beim Eingang mit dem Hinweis, von welcher Auskunftei die Antwort noch aussteht. "
      // Gegenlesen 24.09.2026: die Widerrufsfrist (fiaon-auskunft-lieferung.ts, Abschnitt 0).
      + "Hat der Kunde beim Kauf NICHT verlangt, dass wir vor Ablauf der Widerrufsfrist beginnen, lässt der Vorgang das "
      + "Quittieren des Versands erst ab dem Tag danach zu — Unterschriften darfst du vorher schon einholen.",
    tipp: "Lade die Datenkopie zusätzlich in der Akte unter Unterlagen als Bonitätsauskunft hoch — erst dann startet die Analyse.",
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
      + "Bezahlt wird per Überweisung. Mit dem Zahlungseingang startet der Auftrag von selbst. Daneben gibt es Individual- und "
      + "Firmenangebote mit eigenem Preis und eigenem Vertrag — sie stehen im Reiter „Individualangebote“.",
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
  // ── Individualangebot (01.10.2026, E-268) — drei Schritte, nur der erste mit `ziel` ──
  // Der Reiter steht immer da; Formular und Knöpfe erscheinen nur am jeweiligen Angebot.
  {
    ziel: ".cg-reiter",
    titel: "Zweiter Reiter: Individualangebote.",
    text: "Ein persönliches Angebot für eine Person — Teil 1 „Gründung“ sofort fällig, Teil 2 „Kapital-Begleitung“ erst, wenn die "
      + "Gesellschaft eingetragen ist und das erste Kapital ausgezahlt oder die erste Karte freigeschaltet ist. Dazu die "
      + "Bürgschaftszusage der Schwarzott Global LLC und die Kreditgarantie (E-271): Erhält die Gesellschaft in der Frist nicht den "
      + "Kreditrahmen und die Karten aus dem Angebot, erstattet FIAON alles, was der Kunde gezahlt hat. „Neues Individualangebot“ holt Name, Anschrift und Geburtsdatum aus dem jüngsten Antrag der Person.",
    tipp: "Angenommen wird nur vom Kunden über seinen Link. Öffnest du den Link aus dem Chefbüro, siehst du die Seite ohne Annahmeknopf.",
  },
  {
    titel: "Rot heißt: Der Kunde kann noch nicht annehmen.",
    text: "Solange ein Pflichtfeld der Bürgin fehlt (Registernummer, Vertretung, Funktion, Datum der eigenhändigen Unterschrift, "
      + "Abgleich mit dem Registerauszug) oder der Prüfbericht fehlt, liest der Kunde das Angebot, sieht aber statt des Knopfs einen "
      + "ruhigen Satz. „Pflichtfelder der Bürgin eintragen“ öffnet die Felder. Jede Änderung steht mit der alten Prüfsumme im Verlauf. "
      + "Davon getrennt ist der Versand: Steht statt „Link kopieren“ ein rotes „Versand gesperrt“, fehlt der Registernachweis der "
      + "Bürgin — Registerauszug (Status „Active“) in die Akte, die Document Number eintragen, als Grundlage „Registerauszug vom …“.",
    tipp: "Anlage 1 wird von Hand unterschrieben (§ 766 BGB) — das Original per Post an den Kunden, erst dann das Datum eintragen. Den Link immer aus dem Reiter kopieren, nie aus Notizen — alte Links laufen nicht länger als der heutige Nachlauf.",
  },
  {
    titel: "Nach der Annahme: Meilenstein, Garantie, Frist, Garantiefall.",
    text: "Mit dem Zahlungseingang von Teil 1 startet der Auftrag und die Frist läuft — Beginn und Ende stehen am Angebot, der Kunde "
      + "bekommt beides per Mail. „Meilenstein erreicht“ stellt die Rechnung über Teil 2 (Beleg in einem Satz, intern). „Frist hemmen“ "
      + "nur nach schriftlicher Aufforderung. Die Garantie läuft nach dem Meilenstein weiter: „Garantie erfüllt“ trägt ein, dass "
      + "Kreditrahmen und Karten vollständig da sind (Belege intern). Ist die Frist ohne „Garantie erfüllt“ abgelaufen, wird "
      + "„Garantiefall“ frei: alles Gezahlte zurück (Teil 1 und ein bezahlter Teil 2, eine offene Teil-2-Rechnung wird storniert), "
      + "Justin bekommt EINE dringende Aufgabe mit dem Gesamtbetrag und überweist von Hand, der Kunde bekommt eine Mail.",
    tipp: "Ein gesperrter Knopf nennt seinen Grund direkt daneben — zum Beispiel „Die Frist läuft bis …“.",
  },
  // E-273 (02.10.2026) — ohne `ziel`: Die Zeile steht nur an angenommenen Angeboten.
  {
    titel: "Das Startgespräch bucht das System.",
    text: "Mit der Annahme trägt das System das Startgespräch beim nächsten freien Termin ein — in Justins Kalender (dem Konto der "
      + "Seite /justin), dreißig Minuten, Montag bis Freitag, frühestens zwei Stunden nach der Annahme; bei „Starten ab“ ab dem "
      + "gewählten Tag. Der Kunde sieht Tag und Uhrzeit sofort und in seiner Bestätigung. Die Zeile „Startgespräch“ zeigt den Termin — "
      + "oder rot „nicht gebucht — von Hand buchen“ mit dem Grund (kein Platz in vierzehn Tagen, niemand mit Zeiten); dann liegt "
      + "bei Justin eine dringende Aufgabe. Ein technischer Fehler wird drei Tage lang im Stundenlauf nachgeholt, „Nachholen“ versucht es sofort. "
      // Gegenprüfung E-273 (recht-zeitpunkt, 02.10.2026): die zwei Zustände nach dem Termin.
      + "Nach dem Termin steht „Zeit vorbei — im Kalender abschließen“, bis das Ergebnis im Kalender steht; „kam nicht zustande“ heißt: "
      + "neuen Termin von Hand vereinbaren.",
    tipp: "Sagt der Kunde ab, wählt er über den Link bei Justin auf /justin eine neue Zeit — Justin bekommt dazu eine Aufgabe.",
  },
  // E-301 (07.10.2026) — ohne `ziel`: Der Block steht nur, wenn es ein Firmenangebot gibt.
  {
    titel: "Firmenangebote (B2B) haben einen eigenen Block.",
    text: "Ein Firmenangebot (Ref FIAON-IA-F…) legt nur das Import-Skript an — mit seinen Bildern, die nur hinter dem Link der Kundin "
      + "zu sehen sind. Der Link geht erst raus, wenn der Registerauszug der Bürgin mit Status „Active“ UND die Freigabe des Anwalts "
      + "eingetragen sind („Versand gesperrt“ nennt, was fehlt). Solange der Versand gesperrt ist, sieht den Link nur Justin; die Freigabe "
      + "des Anwalts trägt nur er ein. Die Freigabe gilt nur für die Fassung mit der angezeigten Prüfsumme — ändert sich danach ein Wort, "
      + "sperrt der Versand wieder. Nach der Annahme stehen alle Teile in einer Tabelle: Gründung, die Monatspauschalen (die Rechnung kommt "
      + "am Fälligkeitstag von selbst), Umsatz- und Verkaufsbeteiligung. „Bedingungen der Bürgschaft erfüllt“ startet die Garantiefrist der "
      + "ersten Runde, „Erste Runde erhalten“ beendet sie; ist die Frist ohne erste Runde abgelaufen, wird „Garantiefall“ frei — dann wird "
      + "die Gründung erstattet, der Vertrag läuft weiter. „Umsatz eintragen“ rechnet die Beteiligung selbst und stellt die Rechnung; jede "
      + "Umsatzmeldung zählt nur einmal. „Verkauf eintragen“ fragt zuerst, wer veräußert: die Auftraggeberin (Rechnung an die Firma) oder "
      + "Gesellschafter (KEINE Rechnung an die Firma — der Teil wird vorgemerkt, Justin klärt Schuldner und Umsatzsteuer). Derselbe Verkauf "
      + "lässt sich nur einmal eintragen. Beim Verkauf angeben, ob die Mehrheit oder der Betrieb im Ganzen übergeht — dann endet die "
      + "Umsatzbeteiligung. „Kündigung eintragen“ fragt, wer kündigt und ob ordentlich oder aus wichtigem Grund: Nur eine Kündigung aus "
      + "wichtigem Grund vor dem Fristende lässt die Garantie entfallen. Wird der Auftrag storniert — auch über die Zahlungsliste —, stellt "
      + "das System keine Rechnungen mehr.",
    tipp: "An die Kundin eines Firmenangebots geht KEINE automatische Mail — auch keine Zahlungs- oder Terminerinnerung. Vertrag, Rechnungen und Termine schickt der Ansprechpartner von Hand (er bekommt je Rechnung eine Aufgabe; am zehnten Tag ohne Zahlung die Aufgabe „anrufen“).",
  },
  // Angebot-Aufrufe (01.10.2026, E-268) — ohne `ziel`: Der Kasten steht nur, wenn es ein Angebot gibt.
  {
    titel: "Wann, wie oft und wo hat der Kunde geöffnet?",
    text: "Unter den Links jedes Angebots steht „Geöffnet: n× (zuletzt …)“ bzw. „Noch nicht geöffnet“, darunter „Kunde zuletzt“ mit "
      + "Zeit, Gerät und Ort. „Alle Aufrufe“ klappt die Liste auf: Zeit (Berlin), Seite oder PDF, Gerät, Ort und wer es war — „Kunde“, "
      + "„du“ oder „automatisch“. Den Ort schickt nur der Netzbetreiber mit; fehlt er, steht ehrlich „Ort unbekannt“. Die IP-Adresse "
      + "ist gekürzt gespeichert und steht nur hier, nicht in Aufgabe und Mail. 90 Tage nach Abschluss wird gelöscht — auch Zeiten, "
      + "Geräte und Orte in deiner Aufgabe; danach steht „Aufrufe gelöscht“.",
    tipp: "Öffnet der Kunde zum ersten Mal — und danach bei jedem neuen Besuch nach 30 Minuten Pause —, bekommst du eine Aufgabe auf "
      + "deinem Board (eine je Angebot, sie wird aktualisiert) und eine Mail an js@fiaon.com. Deine eigenen Aufrufe (Chefbüro, "
      + "Mitarbeiter-Sitzung, dein Anschluss der letzten 30 Tage) zählen als „du“ und lösen nichts aus.",
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
  {
    // 01.10.2026 (E-268) — ohne `ziel`: Der Block steht nur bei Aufträgen aus einem Individualangebot.
    titel: "Auftrag aus einem Individualangebot: Teile und Frist statt Stichtag.",
    text: "Kommt der Auftrag aus einem persönlichen Angebot, steht im Reiter „Stand“ statt des Stichtags der Block „Individualangebot“: "
      + "Teil 1 „Gründung“ (sofort fällig), Teil 2 „Kapital-Begleitung“ (erst beim Meilenstein) und das Fristende. Bis dahin "
      + "garantiert FIAON der Gesellschaft den Kreditrahmen und die Karten aus dem Angebot; sonst erstattet FIAON alles, was der Kunde "
      + "gezahlt hat. Ist das erste Kapital ausgezahlt oder die erste Karte freigeschaltet, sag es der Leitung — sie trägt den Meilenstein "
      + "ein, dann geht die Rechnung über Teil 2 raus. Sind Kreditrahmen und Karten vollständig da, ebenfalls der Leitung Bescheid geben. "
      // E-273 (02.10.2026): Das Startgespräch bucht das System nach der Annahme selbst.
      + "Die Zeile „Startgespräch“ nennt Tag, Uhrzeit und mit wem — das System hat es nach der Annahme selbst eingetragen.",
    tipp: "Fehlt eine Unterlage oder Unterschrift des Kunden, fordere sie schriftlich mit mindestens sieben Tagen Frist an und gib der Leitung Bescheid — nur dann darf die Frist ruhen.",
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
      + "wann zuletzt telefoniert wurde und wann er erreichbar sein will. Neben der Nummer steht, wie oft er schon angerufen wurde "
      + "(„noch nie angerufen“, „3 Versuche“ — gelb ab 5, rot ab 10).",
  },
  {
    // 29.09.2026 (E-259): Justin: „ganz oben immer den frischesten Kunden, der nicht schon 10× angerufen wurde —
    // A, dann B, dann C, die keine oder am wenigsten Anrufe bekommen haben."
    // Nachbesserung E-259: Ziel ist die erste Karte (Nummer + Versuche) — vorher das ganze Raster, der Rundgang
    // rollte damit in die Mitte der Liste. Die Wunschzeit sortiert erst innerhalb derselben Versuchsstufe.
    ziel: ".tk-raster > .tk-karte:first-child .tk-nummer-zeile",
    titel: "Die Reihenfolge: frisch, A vor B vor C, wenig Versuche.",
    text: "Ganz oben stehen die Frischen — Antrag, Zahlungsmeldung oder fällige Rate höchstens 3 Tage alt —, in „Alle“ erst A, dann B, "
      + "dann C, dann Rate offen; danach der Bestand in derselben Folge. Darin zuerst, wer am wenigsten angerufen wurde "
      + "(noch nie, dann 1–2, 3–5, 6–9 Versuche); bei gleich vielen Versuchen zuerst, wessen Wunschzeit aus dem Antrag jetzt passt. "
      + "Wer in den letzten 20 Stunden versucht wurde, eine Zusage, einen gebuchten Termin oder deinen Rückruf hat, rückt nach hinten; "
      + "ab 10 Versuchen ans Ende. „Weitere laden“ zeigt die nächsten, die du noch nicht gesehen hast.",
    tipp: "Gezählt werden Anrufe übers Softphone und jedes festgehaltene Ergebnis. Mehrmals wählen binnen 5 Minuten ist ein Versuch; "
      + "ein Wählen, das nie rausging, zählt nicht. Rufst du übers iPhone an, zählt der Versuch, sobald du danach einen Knopf drückst "
      + "— zum Beispiel „Nicht erreicht“.",
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
    titel: "Alle, A, B, C, Rate offen — die Stufen des Hauses.",
    text: "A = Zahlung gemeldet, B = Antrag fertig, Rechnung offen, C = Lead ohne Antrag, „Rate offen“ = bezahlt, aber eine Monatsrate ist fällig. "
      + "„Alle“ zeigt jeden (vorn), „Storniert“ die, die du storniert hast. Jeder Reiter reiht nach derselben Regel. "
      + "Gesperrte (Vertriebssperre) blendest du über den Schalter ein.",
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
    text: "Ein Knopf, ein Blatt mit vier Fällen. Mail UND WhatsApp schickt der Server — die WhatsApp über das FIAON-Konto bei Meta, "
      + "nicht über dein privates WhatsApp. „Rechnung schicken“: Mail mit der Rechnung als PDF und die WhatsApp-Vorlage „Ihre offene "
      + "Rechnung“ (bei Raten „Ihre Monatsrate“) mit Knopf zur Zahlungsseite. „Nicht erreicht“: Mail mit deinem Kalender und bei B, C "
      + "und Abbrechern die Vorlage „Wir haben Sie nicht erreicht“ — ihr Knopf führt ins allgemeine Terminformular, NICHT in deinen "
      + "Kalender; bei A und Bestandskunden keine WhatsApp-Vorlage. Höchstens alle 3 Tage und nicht, wenn heute schon eine WhatsApp "
      + "rausging. Kam in den letzten 24 Stunden eine Nachricht vom Kunden, geht statt der Vorlage dein eigener Text mit deinem Kalender. "
      + "„Antrag schicken“ trägt immer seinen persönlichen Link. „Später anrufen“: Uhrzeit wählen, der Rückruf steht oben und auf "
      + "Wunsch im iPhone-Kalender. „Stornieren“: raus aus allen Listen.",
    tipp: "Unter jedem Fall steht vorher, was rausgeht — oder warum keine WhatsApp (Werbesperre, Stopp, Festnetz, keine passende Vorlage). "
      + "Ein zweiter Tipp binnen 10 Minuten schickt nichts noch einmal, auch nicht von einem zweiten Gerät. "
      + "Alles steht im WhatsApp-Raum und in der Akte; nach einer Vorlage antwortet Mara, wenn der Kunde schreibt. Du wirst nie sein Betreuer.",
  },
  {
    titel: "Persönliche Nachricht: du sagst, worum es geht.",
    text: "Unten im Blatt steht „Persönliche Nachricht“. Tipp in deinen Worten, was der Kunde lesen soll — zum Beispiel „wie "
      + "besprochen in Ruhe die Website ansehen und sich wieder melden“. Die KI schreibt daraus eine persönliche WhatsApp an "
      + "genau diesen Menschen, mit seinem Namen und seiner Lage, ohne Emojis und ohne Versprechen. Du kannst alles ändern "
      + "und „Über FIAON-WhatsApp senden“ drücken. Das geht als freier Text nur, wenn in den letzten 24 Stunden eine Nachricht "
      + "vom Kunden kam; sonst schickst du erst die Rückfrage-Vorlage. Dein Text bleibt dann auf diesem Gerät als Entwurf und geht "
      + "nicht von selbst raus: Kommt eine Antwort, öffne die persönliche Nachricht wieder und sende ihn — bis dahin antwortet Mara. "
      + "Hat der Kunde „STOPP“ geschrieben, geht keine WhatsApp; bei Werbesperre, Vertriebssperre oder Kündigung nur mit Haken und ohne Verkauf.",
    tipp: "Die KI bekommt weder Telefonnummer noch E-Mail noch Bankdaten; Links setzt der Server ein. Was sie schreibt, prüft die Wortwand — Hinweise stehen gelb unter dem Text.",
  },
  {
    // 02.10.2026 (E-274): Justin: „ich brauch da ein Knopf wo ich den Kunden eine Email senden kann — wie jetzt,
    // ich hatte eben mit [einem Kunden] telefoniert, der will einbezahlen und braucht aber die Mail neu."
    // Gegenprüfung: NACH „Persönliche Nachricht" — der Schritt dort erklärt das Blatt „Nachrichten" weiter
    // („Unten im Blatt …"); dazwischen hätte er sich auf das Blatt „E-Mail" gelesen.
    ziel: ".tk-email",
    titel: "„E-Mail“: nur eine Mail, ohne Gesprächsergebnis.",
    text: "Unter „Anrufen“ und „Nachrichten“ steht „E-Mail“ mit der Adresse — dasselbe Blatt öffnet „E-Mail schreiben“ oben in der Akte "
      + "und unten im Blatt „Nachrichten“. Betreff und Text schreibst du selbst; die Anrede („Guten Tag …,“) setzt das System davor, Kopf "
      + "und Fuß das FIAON-Gerüst. Hat der Kunde eine offene Zahlung, füllt „Zahlungsdaten neu senden“ alles aus — Betrag, "
      + "Verwendungszweck, Link zur Zahlungsseite — und hängt die Rechnung als PDF an. „Vorschau“ zeigt die Mail so, wie sie ankommt; "
      + "„Senden“ schickt sie von welcome@fiaon.com. Anders als „Rechnung schicken“ bucht sie kein Ergebnis, setzt kein Zahlungsdatum "
      + "und schickt keine WhatsApp.",
    tipp: "Unten im Blatt stehen die letzten Mails an ihn mit ihrem Stand: erst „gesendet“, nach dem Abgleich mit Brevo (alle 20 Minuten) "
      + "„zugestellt“ oder „geöffnet“ — rot bei „blockiert“ oder „unzustellbar“. Die Mail steht im Verlauf der Akte. Zweimal „Senden“ "
      + "binnen 30 Sekunden schickt sie einmal. Ohne Adresse ist der Knopf aus. Kam die letzte Mail nicht an, steht das oben im Blatt, "
      + "bevor du schreibst — und beginnt dein Text mit „Hallo …“, sagt es dir, dass die Anrede schon davorsteht.",
  },
  {
    titel: "Akte und Termine, ohne die Seite zu verlassen.",
    text: "„Akte öffnen“ unten auf der Karte zeigt die ganze Akte in einem Fenster über der Kartei — schließen mit dem Kreuz oder der "
      + "Esc-Taste, und die Karte ist danach frisch. Ganz unten stehen zuerst deine Termine (gebucht über fiaon.com/justin und dein "
      + "Kalender, mit Anliegen), darunter aufklappbar alle Termine des Teams.",
  },
  {
    titel: "Storniert ist nicht gelöscht.",
    // 27.09.2026 (E-245): Offene Raten einer unbezahlten Bestellung kommen beim Zurückholen nicht wieder.
    text: "Unter „Storniert“ steht jeder mit Grund und Datum. „Zurückholen“ nimmt genau das zurück, was der Storno getan hat — "
      + "Bestellung, Lead, Sperren. Bezahlte Verträge folgen der Kündigungsregel: Die laufende Rate bleibt fällig, außer du setzt „Kulanz“. "
      + "Offene Raten einer nie bezahlten Bestellung fallen mit dem Storno weg und kommen beim Zurückholen nicht wieder.",
  },
];

// ── /chef/s/mara (21.09.2026) ─────────────────────────────────────────────────
// E-252 (28.09.2026): Das Steuerpult ist aufgeräumt (Justin: „völlig überladen, mach es
// cleaner und besser"). Ein Satz je Schritt, Wortlaut aus dem freigegebenen Entwurf E-250.
// Die langen Texte stehen jetzt auf der Seite selbst: KI im Aufklapper „KI", Bilanz im
// Aufklapper der Verkaufsleiste, „Rücksicht" wortgleich unter „So arbeitet Mara" (.mp-regeln).
// Ziele: .kip-karte → .mara-kopf, .mbz → .mara-leiste, .mp-schalter → .mp-aktion-schalter
// (die Dauerauftrag-Schalter im Aufklapper „Mara anweisen" träfen sonst zuerst),
// .mp-zahlen → .mp-kette, neu .mp-wen. Der E-248-Schritt zum Postfach bleibt, wie er war.
export const RUNDGANG_MARA: RundgangSchritt[] = [
  {
    ziel: ".mara-kopf",
    titel: "Oben: gilt für alle Reiter.",
    // E-260 (29.09.2026): vier Reiter — dazu „Termine". E-294 (06.10.2026): fünf — dazu „Social".
    text: "Oben stehen der KI-Zustand, der WhatsApp-Zustand und „Mara anweisen“ (dort auch Maras Ton) — das gilt für alle fünf Reiter.",
  },
  // E-261 (29.09.2026): die WhatsApp-Bremse — der Chip steht immer da (grün, gelb oder rot).
  {
    ziel: "[aria-controls=\"mara-p-wa\"]",
    titel: "Der Chip „WhatsApp“: die Bremse.",
    text: "Kann Meta nicht abbuchen (#131042, zweimal in 60 Minuten) oder sperrt Meta das Konto, pausiert WhatsApp von selbst: "
      + "keine Vorlage mehr, auf keinem Weg — und du bekommst genau eine Aufgabe. Ein Klick auf den Chip zeigt Zustand, "
      + "Meta-Qualität und die Fehler der letzten 24 Stunden; dort und im roten Band steht „WhatsApp wieder aktivieren“.",
    tipp: "Vor dem Aktivieren fragt das System Metas Kontostand ab, ohne eine Nachricht zu schicken — meldet Meta „gesperrt“ "
      + "oder lehnt den Zugang ab (#190), bleibt die Pause. Meta GELB halbiert die Automatik, Meta ROT stoppt die Werbung an bestehende "
      + "Kontakte: Die Zentrale schickt nur noch die Monatsrate; die Begrüßung frischer Leads (≤ 24 h), einzelne Termin-Nachrichten und Antworten laufen weiter. "
      // 01.10.2026: ROT bleibt, bis Meta GELB oder GRÜN meldet.
      + "Meldet Meta nach einem ROT nur „unbekannt“, gilt weiter ROT — erst GELB oder GRÜN gibt die Werbung wieder frei.",
  },
  {
    ziel: ".mara-leiste",
    titel: "Die Verkaufsleiste.",
    text: "Die Verkaufsleiste zeigt Geld nach Mara und je Weg, ob er läuft — ein Klick springt zu seinem Schalter.",
  },
  {
    ziel: ".mara-reiter",
    titel: "Fünf Reiter: WhatsApp, Mail, Bonitätsauskunft, Termine, Social.",
    text: "Die Adresse merkt sich den Reiter: /chef/s/mara?reiter=auskunft öffnet direkt die Bonitätsauskunft, "
      + "/chef/s/mara?reiter=termine alle Termine — die Zahl am Reiter „Termine“ sind Kunden, die gerade warten. "
      // E-294 (06.10.2026): das Social-Studio.
      + "/chef/s/mara?reiter=social ist das Social-Studio: die Zahl dort sind Posts, die auf deine Freigabe warten.",
  },
  {
    ziel: ".mp-aktion-schalter",
    titel: "Ein Schalter: Aktion läuft oder pausiert.",
    text: "Der Schalter startet oder pausiert die Aktion; Antworten im Postfach laufen weiter.",
  },
  // E-248 (28.09.2026, Justin: „Geh Mara komplett durch … einiges kann sie doch selbst machen").
  {
    titel: "Was Mara im Postfach selbst erledigt.",
    text: "Schreibt ein Kunde klar, dass er kündigen, stornieren oder widerrufen will, bucht Mara das sofort — Urkunde und "
      + "schriftliche Bestätigung verschickt das Haus. Nie bei „ich kündige nicht, ich will nur wissen …“, „sonst kündige ich“, "
      + "„bevor ich kündige …“, einem fremden Vertrag (Handy, Konto bei seiner Bank) oder wenn jemand anderes kündigen will. "
      + "Im Zweifel fragt sie einmal nach; ein kurzes „Ja“ darauf genügt. Storno oder Kündigung bietet sie nie von sich aus an — "
      + "„Stopp“ heißt nur: keine Werbung. Auf Stopp, Widerruf, Beschwerde oder „kann nicht zahlen“ gibt es keinen Zahlknopf; "
      + "beim Widerruf sagt sie „Ihren Widerruf prüft unsere Geschäftsführung“ und gibt dir eine Aufgabe. Links sind immer "
      + "seine persönlichen (Zahlungsseite, Antragslink mit Code), nie fiaon.com/antrag. Eine abgelaufene Bestellung schaltet "
      + "sie selbst neu frei, bevor sie die Zahlungsseite schickt.",
    tipp: "Ohne dich raus gehen nur: „Stopp“ mit gesetzter Werbesperre, der Storno einer unbezahlten Bestellung und eine "
      + "gebuchte Kündigung — und nur, wenn die Antwort sauber ist und keine andere Lampe brennt. Alles andere liegt als "
      + "Entwurf. Schickt jemand dieselbe Mail mehrmals, bekommt er EINE Antwort.",
  },
  {
    ziel: ".mp-kette",
    titel: "Die Wirkung in 14 Tagen.",
    text: "Die Wirkung zeigt: angeschrieben, Antworten, gebuchtes Geld in 14 Tagen.",
  },
  {
    ziel: ".mp-wen",
    titel: "Wen Mara anschreibt.",
    text: "Links: welche Stufen Mara anschreibt und wer als Nächstes dran ist.",
  },
  // E-276 (02.10.2026): die Runde für alle offenen Erstzahler.
  {
    ziel: "[data-mara-runde]",
    titel: "Die Runde: jeder offene Erstzahler einmal.",
    text: "„Runde jetzt starten“ schreibt jedem mit offener erster Zahlung (A und B) einmal — ohne die Pausen des Takts, "
      + "im Tempo des Takts, 24 Stunden lang. Gesperrte, „Stopp“, Global-Kunden und wer womöglich schon ungebucht gezahlt hat, "
      + "bleiben draußen. B liest „Zahlen Sie jetzt die Aktivierung …“, A nie eine Zahlungsbitte; kein Termin.",
  },
  {
    ziel: ".mp-steuer",
    titel: "Wie Mara schreibt: Takt, Deckel, Stil.",
    text: "Rechts: Takt (0 bis 500 Mails je Stunde), Kostendeckel, Stil — die Probe zeigt die nächste Mail, ohne zu senden.",
  },
  {
    ziel: ".mp-reiter",
    titel: "Jede Mail, vollständig.",
    text: "Unten jede Mail, die rausging, hängen blieb oder scheiterte.",
  },
];

// ── /chef/s/mara?reiter=termine (29.09.2026, E-260) ─────────────────────────
// Justin: „ALLE Termine, die MARA macht, muss ich sehen können … Die anderen
// Mitarbeiter arbeiten erst wieder am Freitag. Bis dahin schupfe ich das ganze."
// Ein Satz je Schritt wie im Steuerpult (E-252). Ziele: .mt-schalter, .mt-abo (E-263),
// .mt-filter, .mt-jetzt, .mt-knoepfe; „Kunde wartet" steht nur, wenn jemand
// wartet — deshalb ohne Ziel.
export const RUNDGANG_MARA_TERMINE: RundgangSchritt[] = [
  {
    ziel: ".mt-schalter",
    titel: "Ein Schalter: Team abwesend — Mara bucht bei dir.",
    // Vertretung (01.10.2026): Terminseite, Übergaben an den Vertreter, Gründer/Global nie umgeleitet.
    text: "Solange er an ist, trägt Mara neue Rückrufe (WhatsApp und Mail) bis „bis“ nur in den Kalender des Vertreters ein — "
      + "in seinem Raster, nie gleichzeitig mit einem Termin, den er für das Team anruft; auch die Terminseite (der Kunden-Link "
      + "„Termin buchen“) zeigt Kunden der Abwesenden bis dahin nur seine Zeiten. Danach geht es wie sonst zum Betreuer oder ins Team. "
      + "Ihre Übergaben bekommt der Vertreter — er öffnet dafür Akte und WhatsApp der Vertretenen; Heikles (Kündigung, Beschwerde, "
      + "Bestreiten, Zahlungsverweigerung, Löschwunsch, Anwalt) liegt zusätzlich auf deinem Board. Bist du selbst der Vertreter, landet alles auf deinem "
      + "Board. Die Kunden bleiben bei ihren Betreuern — auch die eines gesperrten Betreuers.",
    tipp: "Beim Einschalten wählst du „bis“ (Vorgabe: der nächste Freitag 09:00), wer anruft und für wen. Nach „bis“ geht "
      + "er von selbst aus; jedes An und Aus steht mit Namen im Chef-Protokoll. Gründer-Gespräche und FIAON Global bleiben "
      + "immer bei dem, der gebucht ist.",
  },
  {
    // 29.09.2026 (E-263); Gegenprüfung: die zwei Abos überschneiden sich nicht mehr.
    ziel: ".mt-abo",
    titel: "Termine in deinem Kalender — zwei Abos.",
    text: "„Meine Termine“ ist alles, was bei deinem Konto steht (Gründer-Gespräche, Maras Rückrufe in Abwesenheit); "
      + "„Termine des Teams“ sind die der Mitarbeiter, mit dem Namen vorn — ohne deine. Für alles beide abonnieren "
      + "(iPhone/Mac, Google oder Link kopieren): Jeder Termin steht genau einmal da, neu kommt dazu, abgesagt verschwindet.",
    tipp: "„Neuen Link erzeugen“ macht den alten sofort tot — der alte Kalender wird leer; einmal neu abonnieren und den "
      + "leeren löschen. Google holt nur alle paar Stunden; was gerade ansteht, siehst du hier in der Liste.",
  },
  {
    ziel: ".mt-filter",
    titel: "Alle, nur Mara oder bei Abwesenden.",
    text: "„Alle“ zeigt jeden Termin des Hauses, „Nur Mara“ die Rückrufe, die Mara per WhatsApp oder Mail vereinbart hat, "
      + "„Bei Abwesenden“ die, die du anrufst, weil der Betreuer nicht da ist.",
  },
  {
    ziel: ".mt-jetzt",
    titel: "Oben dein nächster Anruf.",
    text: "Die Glasfläche zeigt, wen du jetzt anrufst: einen Termin, der gerade dran ist — sonst den Kunden, der am dringendsten "
      + "wartet (A vor B vor offener Rate vor C) — sonst den nächsten Termin. Dazu wer, welche Stufe, was an Geld offen ist und "
      + "— bei Mara — ihre Zusage an den Kunden. So weißt du, was sie ihm versprochen hat, bevor du wählst.",
    tipp: "Hat jemand die Zeit nach Maras Buchung geändert, steht dort „Seit Maras Zusage verschoben“ statt ihres Satzes.",
  },
  {
    titel: "Kunde wartet: zuerst das Geld.",
    text: "Ist ein Termin verstrichen, ohne dass jemand angerufen hat, steht er rot gerahmt unter „Kunde wartet“ — bis zu 14 "
      + "Tage lang, A vor B vor offener Rate vor C, dann nach Betrag; der dringendste steht oben im Glas. Darunter Heute, "
      + "Morgen, Diese Woche; Später und Erledigtes sind zugeklappt.",
  },
  {
    ziel: ".mt-knoepfe",
    titel: "Anrufen, dann ein Knopf.",
    text: "„Anrufen“ wählt (am iPhone sichert es zuerst den Kontakt), „Akte“ öffnet die Akte. Danach „Erledigt“ oder "
      + "„Nicht erreicht“ — sonst setzt das System den Termin nach zwölf Stunden auf „verpasst“, und Mara entschuldigt sich "
      + "beim Kunden für ein Gespräch, das stattgefunden hat.",
    tipp: "„Nicht erreicht“ zählt als erfolgloser Versuch; ab dem sechsten bekommt der Kunde die Mail mit seinem Terminlink. "
      + "Startgespräche schließt du in der Akte ab — dort hängen Freischaltung und Gutschrift.",
  },
];

// E-210 (22.09.2026): Der Lead-Motor — die Facebook-Leads direkt von Meta, ohne Make.
export const RUNDGANG_WHATSAPP: RundgangSchritt[] = [
  {
    titel: "Hier schreibst du mit deinen Kunden.",
    text: "Alles läuft über eine Nummer des Hauses (+49 1511 0761284) — nie über dein privates Telefon. Jede Nachricht, "
      + "hin wie zurück, steht in der Akte des Menschen. Du musst nichts abtippen und nichts weiterleiten.",
  },
  // E-261 (29.09.2026): Der Hinweis erscheint nur, solange die Bremse greift — deshalb ohne Ziel (Rundgang-Regel 2).
  {
    titel: "Steht oben „WhatsApp pausiert“?",
    text: "Dann gehen gerade keine Vorlagen raus — Antworten im offenen Fenster schon (außer Meta hat das Konto gesperrt oder der "
      + "Meta-Zugang ist abgelaufen, dann gar nichts). Das passiert, wenn Meta nicht abbuchen kann; Justin klärt es und schaltet WhatsApp wieder frei. Steht dort "
      + "„Meta-Qualität ROT“, gehen nur die Werbe-Vorlagen nicht raus.",
    tipp: "Wer keine offene Nachricht hat, bekommt in der Zeit einen Anruf statt einer Vorlage. Dasselbe sagt die Akte, wenn du dort eine Vorlage schicken willst.",
  },
  // 28.09.2026 (E-248): Liste mit Absender in der Vorschau, eine Stufenfarbe, Autoantworten markiert.
  {
    ziel: ".wr-liste",
    titel: "Links stehen die Gespräche.",
    text: "Der blaue Punkt zählt ungelesene Nachrichten. Die Vorschau sagt, wer zuletzt geschrieben hat: „Mara:“, der Name "
      + "aus dem Team — oder gelb „Automatische Antwort“, wenn nur ein Anrufbeantworter geantwortet hat. „Fenster offen“ heißt: "
      + "Du darfst gerade frei schreiben. „Mara aus“ heißt: Hier antwortet die digitale Assistentin gerade nicht selbst.",
    tipp: "Hat jemand aus dem Team ein Gespräch offen, steht „jemand liest mit“ daran — dann antwortet ihr nicht doppelt.",
  },
  {
    ziel: ".wr-eingabe",
    titel: "Schreiben wie im Handy — nur mit Sicherheitsnetz.",
    text: "Am Rechner sendet Enter, Umschalt+Enter macht eine neue Zeile; am Handy sendet nur der runde Knopf. Ein Doppelklick "
      + "schickt nichts doppelt, und dein Entwurf bleibt beim Kunden, für den du ihn geschrieben hast — wechselst du das "
      + "Gespräch, wandert er nicht mit. Über dem Feld steht, wie lange das 24-Stunden-Fenster noch läuft. Ist es zu, "
      + "geht nur eine von Meta freigegebene Vorlage.",
    tipp: "Das Plus links öffnet Vorlagen und die PERSÖNLICHEN Links dieses Kunden: Antragslink mit seinem Code, seine "
      + "Zahlungsseite, sein Terminlink. Der Link, der zu seiner Lage passt, steht vorn. Einen nackten fiaon.com/antrag "
      + "gibt es hier nicht — nur der persönliche Link führt den Kunden genau an seine Stelle. Vorlagen, die zu seiner Lage "
      + "passen, stehen oben; die anderen sind grau („passt nicht zu seiner Lage“). Eine Vorlage geht in zwei Schritten raus: "
      + "„Ansehen“, dann „Diese Vorlage senden“.",
  },
  {
    titel: "Mahnungen gehören NICHT hierher.",
    text: "WhatsApp verbietet das Eintreiben von Forderungen. Offene Raten, Mahnungen und Rückstände laufen über Mail, "
      + "Telefon oder Brief. Der Raum lässt solche Nachrichten gar nicht erst raus — das schützt unsere Nummer.",
  },
  {
    ziel: ".wr-schalter",
    titel: "Mara und du am selben Tisch.",
    text: "Der Schalter sagt, ob Mara in diesem Gespräch selbst antwortet. Sobald du hier schreibst, pausiert sie "
      + "automatisch — du hast das letzte Wort. Im Verlauf erkennst du jeden Absender: Kunde links, Mara rechts in "
      + "Navy mit dem Zeichen „KI“, das Team rechts in Blau mit Namen. "
      // 24.09.2026 (E-236) · 28.09.2026 (E-248): Maras Handlungen gebündelt statt als Kastenflut.
      + "Was Mara intern getan hat — Zeiten geholt, Rückruf eingetragen, an einen Menschen übergeben, eine Antwort "
      + "verworfen — steht als EINE leise Zeile zwischen den Nachrichten („Mara · 3 interne Schritte“). Ein Klick klappt "
      + "sie auf; ein roter Punkt heißt: Da ist etwas schiefgegangen, schau hin. Im Kopf steht der Termin aus dem Kalender.",
    tipp: "Das Listen-Zeichen neben dem Schalter klappt alle internen Schritte auf einmal auf. Bei eingetragenen Terminen "
      + "zeigt eine Marke, ob die Nachprüfung stimmt („geprüft“) oder was fehlt.",
  },
  // E-248 (28.09.2026): Was Mara auf WhatsApp selbst tut — und wann sie dir etwas gibt.
  {
    titel: "Was Mara selbst tut — und wann du dran bist.",
    text: "Mara bucht Rückrufe echt in den Kalender und verschiebt Termine, die sie oder der Kunde selbst gebucht hat, auf "
      + "einen freien Platz desselben Betreuers. Klappt seine Wunschzeit nicht, sagt sie den wahren Grund („schon vergeben“ "
      + "nur, wenn der Platz belegt war; sonst „so kurzfristig klappt es nicht“). Eine abgelaufene Bestellung schaltet sie "
      + "neu frei, bevor sie die Zahlungsseite schickt. Auf Absage, Verschieben eines Team-Termins, Kündigung, Widerruf oder "
      + "„kann nicht zahlen“ schickt sie keinen Zahlungslink und gibt dir eine Aufgabe.",
    tipp: "Auf eine echte Autoantwort (Firma, Abwesenheit) und ein reines „Ok“ nach erledigter Sache schweigt sie. Hast "
      + "DU zuletzt eine Frage gestellt und der Kunde antwortet „Ok passt“, schweigt Mara ebenfalls — aber du bekommst "
      + "eine Aufgabe „Kunde hat zugestimmt“, und das Gespräch bleibt in der Warteliste. Schreibt ein Mensch „bitte "
      + "anrufen“, „mit jemandem sprechen“ oder nennt eine Uhrzeit, gilt das nie als Autoantwort.",
  },
];

export const RUNDGANG_LEAD_MOTOR: RundgangSchritt[] = [
  {
    titel: "Der Lead-Motor: jeder Facebook-Lead, direkt von Meta.",
    text: "Meta meldet jeden neuen Lead in Sekunden an die Plattform. Alle fünf Minuten fragt die Plattform zusätzlich jedes "
      + "Formular nach — fällt die Meldung einmal aus, geht trotzdem kein Lead verloren. Ein Lead, der auf beiden Wegen kommt, "
      + "wird einmal angelegt.",
  },
  // E-244 (26.09.2026): Kopfzeile sagt, ob der Webhook bewiesen ist und ob Meta überhaupt ausliefert.
  {
    ziel: ".lm-kopf",
    titel: "Die Kopfzeile sagt, ob Meta wirklich liefert.",
    text: "„Webhook bestätigt“ steht erst da, wenn Meta mindestens eine echte Lead-Meldung geschickt hat — eine grüne Prüfliste "
      + "oder der Knopf „Test“ im App-Dashboard reichen dafür nicht. Bis dahin steht „bisher nur Nachhol-Lauf“: Die Leads kommen trotzdem, "
      + "nur bis zu fünf Minuten später. Rot erscheint „Meta liefert seit … nicht aus“, wenn im eigenen Werbekonto gestern und heute "
      + "kein Geld geflossen ist, davor aber schon — oder „Meta-Leads eingebrochen“, wenn gestern weniger als ein Drittel der üblichen Leads kam.",
    tipp: "Den Webhook beweisen, ohne Geld auszugeben: developers.facebook.com/tools/lead-ads-testing → Seite FIAON → Formular → "
      + "„Lead erstellen“. Der Test-Lead wird erkannt: kein Kunde, keine Zuteilung, keine Mail. Liefert Meta nicht aus: zuerst prüfen, "
      + "ob die Kampagnen noch laufen, dann Werbeanzeigenmanager → Spalte „Auslieferung“ und Abrechnung & Zahlungen.",
  },
  // E-239 (24.09.2026): Werbekosten neben echtem Geld.
  {
    ziel: ".lm-kosten",
    titel: "Was ein zahlender Kunde wirklich kostet.",
    text: "Die Ausgaben je Kampagne kommen alle drei Stunden von Meta und stehen neben unserem Geld: Leads, fertige Anträge, "
      + "zahlende Kunden und Umsatz. Zahlend heißt, Rate 1 ist auf dem Konto gebucht — nicht „Kunde sagt, er hat bezahlt“. "
      + "Daraus rechnet die Karte die Kosten je Lead, je Antrag und je zahlendem Kunden auf den Cent. Gibt es noch keinen "
      + "zahlenden Kunden, steht genau das da — keine erfundene Zahl.",
    tipp: "Die alte Kampagne „DE Kampagne 2“ lief über ein anderes Werbekonto: Ihre Leads und Zahlenden stehen da, ihre Kosten nicht. "
      + "„Kosten jetzt abrufen“ holt den gewählten Zeitraum sofort.",
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
// E-252 (28.09.2026): ein Satz je Schritt (Entwurf E-250). Meta steht jetzt links in der
// Statuszeile (.wz-status), die Wirkung als Kette (.wz-kette); Rechnung und Stufe stehen
// hinter dem (i) „Wie Meta zählt", die Regel je Gruppe hinter „Wer genau" im Glas.
// „Was Mara getan hat" und der Verlauf bleiben zwei Schritte, damit jeder Scheinwerfer trifft.
export const RUNDGANG_WA_ZENTRALE: RundgangSchritt[] = [
  {
    ziel: ".mara-leiste",
    titel: "Oben: gilt für alle Reiter.",
    // E-261 (Gegenprüfung 29.09.): dazu der WhatsApp-Zustand — dieser Rundgang startet beim Öffnen, nicht der Mail-Rundgang.
    text: "Oben: KI, der WhatsApp-Zustand (Chip „WhatsApp“), „Mara anweisen“ und die Verkaufsleiste gelten für alle Reiter — Geld nach Mara und je Weg, ob er läuft.",
  },
  // E-261 (29.09.2026): Der Chip steht immer da (grün, gelb oder rot) — deshalb mit Ziel.
  {
    ziel: "[aria-controls=\"mara-p-wa\"]",
    titel: "Der Chip „WhatsApp“: die Bremse.",
    text: "Grün heißt: WhatsApp läuft. Kann Meta nicht abbuchen (#131042, zweimal in 60 Minuten), sperrt Meta das Konto oder ist "
      + "der Meta-Zugang abgelaufen (#190), pausiert WhatsApp von selbst — keine Vorlage mehr, auf keinem Weg, und du bekommst "
      + "genau eine Aufgabe. Ein Klick zeigt Zustand, Meta-Qualität und die Fehler der letzten 24 Stunden; dort steht auch "
      + "„WhatsApp wieder aktivieren“.",
    tipp: "Vor dem Aktivieren fragt das System Metas Kontostand ab, ohne eine Nachricht zu schicken — meldet Meta „gesperrt“ "
      + "oder lehnt den Zugang ab, bleibt die Pause.",
  },
  {
    ziel: ".wz-status",
    titel: "Die Statuszeile.",
    text: "Die Statuszeile zeigt, ob die Automatik läuft, was Meta heute frei gibt und ob Kunden warten.",
  },
  {
    ziel: ".wz-kette",
    titel: "Die Wirkung bis zum Geld.",
    text: "Die Wirkung zeigt die Kette bis zum Geld — mit dem nächsten Schritt, wenn Geld fehlt.",
  },
  {
    ziel: ".wz-wen",
    titel: "Wen anschreiben.",
    text: "Links wählst du die Gruppe; leere Gruppen stehen unten und sagen, warum.",
    // 28.09.2026 (E-253) — E-252: hier als Tipp, damit der Schritt ein Satz bleibt
    tipp: "Wer hier gezählt wird, besteht auch die Sperrprüfung beim Senden — dieselbe Regel an beiden Stellen. Eine "
      + "Vertriebssperre zählt nur, wenn der Kunde selbst gesperrt ist; die Marke, die jede zusammengeführte Doppel-Akte "
      + "automatisch trägt, ist keine Sperre des Menschen. Wer „Stopp“ gesagt hat — auf WhatsApp oder als Antwort auf eine "
      + "Mail, auch unter einer Doppel-Akte —, steht in keiner Gruppe.",
  },
  {
    ziel: ".wz-start",
    titel: "Vorlage, Anzahl, Vorschau — dann starten.",
    text: "Rechts in der hellen Fläche: Vorlage, Anzahl, Vorschau, Start — und was die Anzahl begrenzt.",
    // 28.09.2026 (E-253) — E-252: hier als Tipp, damit der Schritt ein Satz bleibt
    tipp: "Bis zu 500 je Versand (schnell wählen: 25, 50, 100, 250 oder alle), nie mehr, als Meta heute noch erlaubt. "
      + "Die Karte darunter zeigt den Stand live: gesendet, übersprungen (mit Grund), entfallen, Restzeit. Ein Neustart des "
      + "Servers unterbricht nur kurz („Kurz unterbrochen — geht gleich weiter“): Der Versand steht in der Datenbank und läuft "
      + "von selbst weiter; durch den Neustart bekommt niemand eine zweite Nachricht. Schreiben Verkaufstakt, Automatik oder "
      + "Begrüßung in derselben Sekunde denselben Menschen an, bekommt nur einer den Platz für heute — der andere lässt ihn aus. "
      + "„Entfallen“ heißt: Der Mensch hat seit dem Start geantwortet, bezahlt oder schon etwas bekommen — er wird dann nicht angeschrieben.",
  },
  // E-261 (29.09.2026): die Bremse — ohne Ziel, der Hinweis steht nur, solange sie greift (Rundgang-Regel 2).
  {
    titel: "Die Bremse: GELB halbiert, ROT stoppt Werbung, Kontofehler hält alles an.",
    text: "Meta bewertet unsere Nummer. Bei GELB schreibt die Automatik nur noch halb so viele an (25 → 13 je Stunde), ein "
      + "Versand von Hand höchstens die Hälfte dessen, was Meta heute frei gibt (die Monatsrate bleibt voll). Bei ROT geht hier "
      + "nur noch die Monatsrate raus — auch keine Termin-Einladung an Leads, das wäre Werbung an viele. Kann Meta nicht abbuchen "
      + "oder sperrt das Konto, pausiert WhatsApp ganz: Dann steht oben ein Hinweis, der Start ist gesperrt, die Automatik "
      + "steht auf „pausiert“, und „WhatsApp wieder aktivieren“ steht im Chip „WhatsApp“ ganz oben.",
    tipp: "Wer heute wegen der Pause keine Vorlage bekam, verliert nichts: Gescheiterte oder gebremste Vorlagen zählen nicht als "
      + "Kontakt — nach dem Aktivieren ist er von selbst wieder dran.",
  },
  {
    ziel: ".wz-automatik",
    titel: "Die Automatik.",
    // E-252: „Auskunft fehlt" ist ankreuzbar, aber aus (Justin, 28.09.) — daher „die angekreuzten".
    text: "Die Automatik schreibt im Takt die angekreuzten Gruppen in deiner Reihenfolge an — alle sechs sind wählbar.",
  },
  {
    ziel: ".wz-mara",
    titel: "Was Mara getan hat — und ob es stimmt.",
    text: "„Was Mara getan hat“ prüft jeden Termin nach.",
  },
  {
    ziel: ".wz-verlauf",
    titel: "Jede Vorlage mit Stand und Weg.",
    text: "Der Verlauf zeigt jede Vorlage mit Stand und Weg.",
  },
];

// ── /chef/s/auskunft (24.09.2026, E-240) — die Bonitätsauskunft verkaufen ─────
// 25.09.2026 (E-241): Trichter, Steuerung mit Kreis und zwei Tagesdeckeln, Liefermodus,
// Protokoll, 14 Tage mit Ziel-Balken und der Zähler der Beschaffung.
// 26.09.2026 (E-243): das Band „Verkauf scharf stellen" mit Rückfrage, das Segment Abbrecher,
// das Fenster Mo–So 07:00–20:30, die WhatsApp-Rangfolge und der Stand der Vorlagen bei Meta.
// E-252 (28.09.2026): ein Satz je Schritt (Entwurf E-250). Das Band ist der Kopf des Glases
// (.ak-steuer), Trichter und 14 Tage sind eine Karte (.ak-detail), die Beschaffung ist der
// Umschalter (.mara-ansicht). Die langen Texte stehen hinter den (i) der Seite — die
// Zahlungserinnerung wortgleich an der Karte „Bestellt, nicht bezahlt".
export const RUNDGANG_AUSKUNFT: RundgangSchritt[] = [
  {
    ziel: ".mara-ansicht",
    titel: "Verkauf oder Beschaffung.",
    text: "Oben schaltest du zwischen Verkauf und Beschaffung.",
  },
  {
    ziel: ".ak-status",
    titel: "Die Statuszeile.",
    text: "Die Statuszeile hat den einen Schalter für den Verkauf, den Stand der Vorlagen bei Meta und das offene Geld.",
  },
  {
    ziel: ".ak-heute",
    titel: "Heute gegen das Ziel.",
    text: "Die fünf Zahlen sind heute — Ziel 150 Bestellungen am Tag.",
  },
  {
    ziel: ".ak-steuer",
    titel: "Wie verkauft wird.",
    text: "Rechts in der hellen Fläche: ob der Verkauf scharf ist, der Knopf dafür, Kreis, Mengen, Vorlagen, Protokoll.",
  },
  {
    ziel: ".ak-pool",
    titel: "Wer sie noch nicht hat.",
    text: "Links: wer die Auskunft noch nicht hat und — aufklappbar — wer als Nächstes dran ist.",
  },
  {
    ziel: ".ak-offen",
    titel: "Bestellt, nicht bezahlt.",
    text: "Unten das Geld: bestellt, nicht bezahlt — mit der Zahlungserinnerung.",
  },
  {
    ziel: ".ak-rueckstand",
    titel: "Bezahlt, noch nicht geliefert.",
    text: "Darunter, wer bezahlt hat und die Auskunft noch nicht in der Akte hat — da sind wir dran.",
  },
  {
    ziel: ".ak-detail",
    titel: "Zahlen im Detail.",
    text: "„Zahlen im Detail“ zeigt dieselben Stufen je Weg, je Segment oder je Tag.",
  },
];

// ── /chef/s/auskunft-beschaffung (25.09.2026, E-241) — bis zur API kaufen wir sie selbst ─────
// E-252 (28.09.2026): ein Satz je Schritt (Entwurf E-250). Das Glas zeigt immer einen Auftrag
// oder den Leer-Satz — beide tragen .akb-karte, so zeigt der Scheinwerfer nie ins Leere.
// Ampel, Felder und Hochladen erklärt die Karte selbst; die Regeln stehen im Aufklapper.
export const RUNDGANG_AUSKUNFT_BESCHAFFUNG: RundgangSchritt[] = [
  {
    ziel: ".akb-status",
    titel: "Der Lieferweg.",
    text: "Oben der Lieferweg — die eine Stelle dafür, auch für den Verkauf.",
  },
  {
    ziel: ".akb-zahlen",
    titel: "Welche Aufträge du siehst.",
    text: "Links wählst du, welche Aufträge du siehst; die Zahlen sind zugleich die Filter.",
  },
  {
    ziel: ".akb-karte",
    titel: "Der Auftrag.",
    text: "Rechts steht immer ein Auftrag oder der Satz, dass nichts offen ist: Ampel, Warnungen, Daten zum Bestellen, Hochladen.",
  },
  {
    ziel: ".akb-regeln",
    titel: "Die Regeln der Beschaffung.",
    text: "Die Regeln der Beschaffung stehen links unten zum Aufklappen.",
  },
];

// ── /chef/s/mara?reiter=social (06.10.2026, E-294) ──────────────────────────
// Justin: „unser Content … muss auch auf der Plattform eine Seite haben, mit Termin,
// Post, Plattform, Texten … dass man auch echt was machen kann von dort aus."
// Drei Rundgänge, weil die Ziele nur in der offenen Unteransicht stehen:
// Plan (.so-heute, [data-so-filter], [data-so-woche], [data-so-plan]),
// Vorschau ([data-so-regler], [data-so-raster]) und Post-Detail (.so-handy,
// [data-so-aktionen], [data-so-texte], [data-so-dateien], [data-so-checkliste]).
export const RUNDGANG_SOCIAL_PLAN: RundgangSchritt[] = [
  {
    ziel: "[data-so-heute]",
    titel: "Heute zu posten.",
    text: "Oben steht, was heute dran ist — egal, welche Woche du gerade blätterst —, und der Countdown bis zum nächsten Termin. "
      + "„#1“, „#2“ … ist die Reihenfolge beim Posten, damit das Raster stimmt. „Post öffnen“ führt direkt ins Post-Detail — "
      + "dort kopierst du Texte, sicherst die Dateien und meldest den Post nach dem Hochladen als veröffentlicht.",
    tipp: "Claude spielt die Posts fertig ein; sie kommen immer als „Zur Freigabe“. Die Zahl am Reiter „Social“ zählt genau diese.",
  },
  // Prüfung 06.10.2026: „Zurück an Claude“ ehrlich — Claude liest die Notiz in Scheibe 1 nicht selbst.
  {
    ziel: "[data-so-bei-claude]",
    titel: "Liegt bei Claude.",
    text: "Posts, die du mit „Zurück an Claude“ zurückgegeben hast, stehen hier mit deiner Notiz. Claude sieht das noch nicht von selbst — "
      + "sag Claude in der Social-Sitzung Bescheid. Die neue Fassung kommt dann wieder als „Zur Freigabe“.",
  },
  {
    ziel: "[data-so-filter]",
    titel: "Filter: Kanal, Marke, Status.",
    text: "Grenzt den Plan ein — zum Beispiel nur „Zur Freigabe“, um alles Offene am Stück zu prüfen, oder nur FIAON Global. "
      + "Verworfene stehen nur, wenn du sie im Status-Filter wählst. Passt nichts, steht „Kein Post passt zum Filter“ mit „Filter zurücksetzen“.",
  },
  {
    ziel: "[data-so-woche]",
    titel: "Woche oder Monat.",
    text: "Mit den Pfeilen blätterst du, „Heute“ springt zurück. Darunter warnt die Planprüfung: zwei Reels zur selben Zeit, "
      + "ein Termin vorbei, aber noch nicht freigegeben, und Lücken ohne Post (zusammengefasst). Im Monat zeigt „+5“ die Woche dieses Tages.",
  },
  {
    ziel: "[data-so-plan]",
    titel: "Jede Karte ein Post.",
    text: "Reihenfolge (#1 …), Uhrzeit (oder „ganztags“, wenn keine feste Zeit geplant ist), Format, Titel, Vorschaubild, Kanäle und der Status-Punkt: "
      + "gelb wartet auf dich, blau ist freigegeben, grün ist online. „Wort-Check rot“ heißt: der Wort-Check hat etwas gefunden; "
      + "„KI“ heißt: KI-Kennzeichnung nötig. Ein Klick öffnet den Post, „Zurück“ bringt dich wieder zu dieser Karte.",
    tipp: "Am großen Bildschirm ziehst du eine Karte auf einen anderen Tag, um sie zu verschieben — die Uhrzeit bleibt. "
      + "Am Handy verschiebst du im Post-Detail.",
  },
];

export const RUNDGANG_SOCIAL_POST: RundgangSchritt[] = [
  {
    ziel: ".so-handy",
    titel: "So sieht es in der App aus.",
    text: "Links das Handy mit der echten Vorschau aus den eingespielten Dateien: Karussell zum Wischen (oder Ziehen mit der Maus, "
      + "Pfeiltasten), Reel zum Abspielen mit Ton und „Titelbild“, die Caption mit „… mehr“ wie bei Instagram.",
  },
  {
    ziel: "[data-so-aktionen]",
    titel: "Was jetzt? Die Knöpfe.",
    text: "„Freigeben“ gibt den Post frei — ist der Wort-Check rot, ist der Knopf gesperrt; nur der Inhaber kann mit Grund "
      + "„Trotzdem freigeben“, das steht dann im Verlauf. „Zurück an Claude“ verlangt, was anders sein soll, und legt den Post "
      + "als Entwurf mit deiner Notiz ab (im Plan unter „Liegt bei Claude“) — Claude liest das noch nicht selbst, sag in der "
      + "Social-Sitzung Bescheid. „Verschieben“ ändert Tag und Uhrzeit. „Verwerfen“ geht nur mit Grund.",
    tipp: "Gibt es eine neue Fassung von Claude, kommt der Post wieder zur Freigabe — nie still überschrieben.",
  },
  {
    ziel: '[data-so-knopf="veroeffentlicht"]',
    titel: "Als veröffentlicht melden.",
    text: "Nach dem Posten in der App: je Kanal den Link zum Beitrag einfügen — Datum und Uhrzeit setzt das System. "
      + "Braucht der Post eine KI-Kennzeichnung, ist der Haken „KI-Info“ in der Checkliste Pflicht, sonst bleibt das Feld gesperrt. "
      + "Den Link vorher prüfen: Ändern geht hier noch nicht.",
  },
  {
    ziel: "[data-so-website]",
    titel: "Auf der Website zeigen.",
    text: "Der Schalter holt den Post in das Instagram-Handy auf fiaon.com (Startseite, Privatkunden, Business, passende Ratgeber). "
      + "Gezeigt wird er erst, wenn er auf Instagram als veröffentlicht gemeldet ist (mit Link) und sein Plantag erreicht ist — "
      + "das Handy zeigt nur, was wirklich auf Instagram steht. Die Zeile darunter sagt, warum ein Post noch nicht zu sehen ist.",
    tipp: "Beim ersten „Als veröffentlicht melden“ für Instagram geht der Schalter von selbst an. Beim Einschalten rechnet der "
      + "Browser kleine Web-Bilder; geöffnete Seiten zeigen eine Änderung nach spätestens fünf Minuten.",
  },
  {
    ziel: "[data-so-texte]",
    titel: "Texte: kopieren und zählen.",
    text: "Caption, Hashtags, erster Kommentar und Alt-Text haben je einen Knopf „Kopieren“. Darunter die Zeichen je Kanal "
      + "(Instagram 2.200, LinkedIn 3.000, TikTok 2.200) — rot heißt zu lang für diesen Kanal. Am Handy steht neben der Caption "
      + "„In Fotos sichern“: alle Folien (bzw. Reel und Titelbild) in Reihenfolge ins Teilen-Blatt, von dort in Fotos — Instagram wählt aus Fotos.",
  },
  {
    ziel: "[data-so-dateien]",
    titel: "Dateien: einzeln oder als ZIP.",
    text: "Jede Datei heißt beim Laden nach ihrer Folie, das ZIP liegt in Upload-Reihenfolge — so lädst du in der App in der richtigen Reihenfolge hoch. "
      + "Am Handy ist „In Fotos sichern“ der schnellere Weg; Laden und ZIP landen dort in der Dateien-App.",
  },
  {
    ziel: "[data-so-checkliste]",
    titel: "Checkliste und KI-Kennzeichnung.",
    text: "Je Kanal das, was beim Hochladen gern vergessen wird: Titelbild, „Auch auf Facebook teilen“, Musik aus der Bibliothek, "
      + "Link in den ersten Kommentar. Oben steht, ob eine KI-Kennzeichnung nötig ist (Art. 50 KI-VO) — „Ändern“ setzt Ja/Nein mit Grund. "
      + "Abschalten darf nur der Inhaber (Grund mindestens 10 Zeichen), und nie, solange Claudes meta.json „nötig“ sagt. "
      + "Ist der Post schon freigegeben, geht er mit jeder Änderung zurück zur Freigabe.",
  },
];

export const RUNDGANG_SOCIAL_VORSCHAU: RundgangSchritt[] = [
  {
    ziel: "[data-so-raster]",
    titel: "Das Profil wie in der App.",
    text: "Das Raster schneidet jeden 4:5-Beitrag auf 3:4 aus der Mitte — so zeigt Instagram das Profil seit 2025. "
      + "Reels zeigen ihr Titelbild, Karussells das Mehrfach-Zeichen. Neueste oben links. Vorgabe ist „Wie in der App“: randlos, ohne Rahmen und Datum.",
  },
  // Prüfung 06.10.2026: EIN Raster @fiaon.ltd — FIAON und Global gemischt, wie es online steht.
  {
    ziel: "[data-so-konto]",
    titel: "Ein Konto, ein Raster.",
    text: "„@fiaon.ltd (alles, was dort erscheint)“ ist das echte Profil: FIAON- und Global-Posts in der Reihenfolge, in der sie online gehen. "
      + "„nur FIAON“ und „nur Global“ sind Filter darauf — für das echte Schachbrett immer das ganze Konto prüfen.",
    tipp: "Ein eigenes Konto @fiaon.global gibt es noch nicht. Sobald es angelegt ist, zeigt „nur Global“ dessen eigenes Raster.",
  },
  {
    ziel: "[data-so-regler]",
    titel: "Der Zeitregler.",
    text: "„In 7 Tagen“ und „In 30 Tagen“ stellen alles Geplante schon ins Raster. So siehst du das Schachbrett aus hellen und dunklen "
      + "Kacheln, bevor es entsteht. „Mit Markierungen“ zeigt je Kachel einen kleinen Punkt (blau geplant, gelb wartet auf Freigabe) und das Datum. "
      + "Ein Tipp öffnet den Post.",
  },
];

export const RUNDGAENGE: Record<string, { titel: string; schritte: RundgangSchritt[] }> = {
  auskunft:    { titel: "Auskunft-Verkauf", schritte: RUNDGANG_AUSKUNFT },
  auskunftBeschaffung: { titel: "Auskunft-Beschaffung", schritte: RUNDGANG_AUSKUNFT_BESCHAFFUNG },
  waZentrale:  { titel: "WhatsApp-Zentrale", schritte: RUNDGANG_WA_ZENTRALE },
  bewerbungen:  { titel: "Bewerbungen",  schritte: RUNDGANG_BEWERBUNGEN },
  globalAuftraege: { titel: "Global-Aufträge", schritte: RUNDGANG_GLOBAL_AUFTRAEGE },
  firmenRadar: { titel: "Firmen-Radar", schritte: RUNDGANG_FIRMEN_RADAR },
  telefonkartei: { titel: "Telefonkartei", schritte: RUNDGANG_TELEFONKARTEI },
  mara:        { titel: "Mara", schritte: RUNDGANG_MARA },
  maraTermine: { titel: "Termine", schritte: RUNDGANG_MARA_TERMINE },
  // E-294 (06.10.2026): Social-Studio im Mara-Steuerpult — je Unteransicht einer.
  socialPlan:     { titel: "Social · Plan", schritte: RUNDGANG_SOCIAL_PLAN },
  socialPost:     { titel: "Social · Post", schritte: RUNDGANG_SOCIAL_POST },
  socialVorschau: { titel: "Social · Vorschau", schritte: RUNDGANG_SOCIAL_VORSCHAU },
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
