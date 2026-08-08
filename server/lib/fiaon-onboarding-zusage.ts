// ═══════════════════════════════════════════════════════════════════════════
// VERPFLICHTUNGSERKLÄRUNG FÜR DAS ONBOARDING
//
// Wer Startgespräche führt, sieht die Lage jedes bezahlten Kunden: was er
// gekauft hat, ob Unterlagen fehlen, warum sein Zugang klemmt. Das ist weniger
// als die Vertriebsleitung sieht — aber es sind trotzdem Daten von Menschen,
// die diese Person nie beauftragt haben.
//
// WARUM EIGENER TEXT UND NICHT DERSELBE
// Die Vertriebs-Erklärung hat zwölf Punkte, von denen sechs von Dingen
// handeln, die das Onboarding gar nicht kann: Zahlungen buchen, Kunden
// zuweisen, Provisionen, Selbstbevorteilung. Eine Erklärung, in der die Hälfte
// nicht zutrifft, wird überflogen statt gelesen — und eine überflogene
// Erklärung ist als Nachweis wenig wert. Deshalb sechs Punkte, die alle
// zutreffen.
//
// Die MASCHINERIE ist dieselbe (fiaon-vertrieb-zusage.ts): Fassung, Prüfwert
// über den Wortlaut, getippter Name als Unterschrift, Roboterabwehr, Widerruf.
// Nur der Text ist ein anderer.
// ═══════════════════════════════════════════════════════════════════════════
import type { ZusageText } from "./fiaon-vertrieb-zusage";

export const ONBOARDING_ZUSAGE_VERSION = "1.0-2026-08-08";

export const ONBOARDING_ZUSAGE_TEXT: ZusageText = {
  version: ONBOARDING_ZUSAGE_VERSION,
  ueberschrift: "Onboarding",
  gratulation: "Willkommen im Onboarding — du bist die erste Stimme, die unsere Kunden hören.",
  einleitung:
    "Jeder Mensch, der bei uns bezahlt hat, bekommt von dir ein persönliches Startgespräch. "
    + "Für viele ist das der Moment, in dem aus einer Überweisung ein Verhältnis wird. Damit du "
    + "vorbereitet ins Gespräch gehst, siehst du zu jedem Termin die Lage des Kunden: was er "
    + "gebucht hat, ob seine Zahlung angekommen ist, welche Unterlagen noch fehlen und warum sein "
    + "Zugang eventuell klemmt. Das sind persönliche Daten von Menschen, die dich nicht kennen. "
    + "Bevor du den Bereich öffnest, lies bitte diese Erklärung und nimm sie an.",
  kann: [
    {
      titel: "Deine Startgespräche sehen",
      text: "Heutige und kommende Termine als Liste und im Kalender, mit Name, Uhrzeit und "
        + "Telefonnummer des Kunden.",
    },
    {
      titel: "Die Lage des Kunden lesen",
      text: "Zahlungsstand, gebuchte Produkte, fehlende Unterlagen und Zugangsprobleme — damit du "
        + "nicht im Gespräch nachfragen musst, was das System längst weiß. Ausschließlich lesend.",
    },
    {
      titel: "Gespräche dokumentieren",
      text: "Erledigt oder Kunde nicht erschienen, dazu eine Notiz. Die Notiz landet im Verlauf des "
        + "Kunden und ist für die Kollegen sichtbar.",
    },
    {
      titel: "Terminlink erneut senden",
      text: "Erscheint jemand nicht oder braucht einen neuen Termin, kannst du ihm die Einladung "
        + "erneut schicken.",
    },
    {
      titel: "Deine Erreichbarkeit festlegen",
      text: "Wann du buchbar bist. Kunden wählen ihre Uhrzeit selbst aus deinen Zeiten.",
    },
  ],
  kannNicht: [
    "Zahlungen buchen, stornieren oder erstatten — der Zahlungsstand ist für dich nur eine Auskunft.",
    "Provisionen sehen, ändern oder auslösen.",
    "Kundendokumente öffnen oder herunterladen (Ausweis, Kontoauszug, Bonitätsauskunft) — sichtbar ist nur, OB sie vorliegen.",
    "Vertriebslisten, fremde Kundenbestände oder Umsätze einsehen.",
    "Stammdaten ändern, Kunden zuweisen oder sperren.",
    "Passwörter von Kunden setzen oder einsehen.",
  ],
  pflichten: [
    {
      nr: 1,
      titel: "Zweckbindung",
      text: "Ich sehe mir die Lage eines Kunden nur an, weil ich mit ihm ein Startgespräch führe "
        + "oder geführt habe. Ich öffne keine Akte aus Neugier und suche nicht nach Personen, mit "
        + "denen ich privat zu tun habe.",
    },
    {
      nr: 2,
      titel: "Vertraulichkeit",
      text: "Ich gebe Kundendaten an niemanden weiter — nicht an Kollegen ohne Zuständigkeit, nicht "
        + "an Familie, nicht an Dritte. Ich mache keine Fotos, Bildschirmaufnahmen, Listen oder "
        + "Exporte und speichere nichts auf privaten Geräten oder in privaten Cloud-Diensten. Diese "
        + "Pflicht gilt unbefristet und auch nach dem Ende meiner Tätigkeit.",
    },
    {
      nr: 3,
      titel: "Keine Zahlungs- und Provisionsrechte",
      text: "Ich buche keine Zahlungen, verspreche keine Freischaltung und mache keine Angaben zu "
        + "Provisionen. Sagt ein Kunde, er habe überwiesen, halte ich das als Notiz fest und gebe es "
        + "weiter — ich bestätige es nicht. Ich versuche nicht, diese Grenze technisch oder über "
        + "andere Personen zu umgehen.",
    },
    {
      nr: 4,
      titel: "Was ich sage, stimmt",
      text: "Ich erkläre das Produkt und die nächsten Schritte. Ich mache keine Zusagen zu Fristen, "
        + "Ergebnissen oder Beträgen, die durch den Sachstand nicht gedeckt sind. Ich berate nicht zu "
        + "Finanzen, Krediten oder Geldanlagen — FIAON ist ein Software- und Begleitangebot, und was "
        + "darüber hinausgeht, gehört zu einer zugelassenen Stelle. Weiß ich etwas nicht, sage ich "
        + "das und gebe die Frage weiter.",
    },
    {
      nr: 5,
      titel: "Meldepflicht",
      text: "Bemerke ich einen möglichen Datenschutzvorfall — verlorenes oder gestohlenes Gerät, "
        + "Fehlversand, unbefugter Zugriff, offener Zugang — melde ich das unverzüglich, spätestens "
        + "innerhalb von 24 Stunden, an die Geschäftsführung. Auch einen Verdacht melde ich; die "
        + "Bewertung ist nicht meine Aufgabe.",
    },
    {
      nr: 6,
      titel: "Zugangsschutz und Folgen",
      text: "Mein Zugang ist persönlich; ich gebe ihn nicht weiter und lasse kein Gerät "
        + "unbeaufsichtigt eingeloggt. Mir ist bewusst, dass Verstöße arbeits- beziehungsweise "
        + "vertragsrechtliche Folgen haben können und dass Datenschutzverstöße behördliche Bußgelder "
        + "und Ansprüche betroffener Personen auslösen können.",
    },
  ],
  schlusssatz:
    "Ich habe diese Erklärung gelesen und verstanden. Ich nehme die Verantwortung an und verpflichte "
    + "mich, mich an die Punkte 1 bis 6 zu halten.",
  hinweisProtokoll:
    "Mit der Annahme werden Datum und Uhrzeit, die Fassung dieser Erklärung, ihr Prüfwert, dein "
    + "eingegebener Name, deine IP-Adresse und die Browserkennung gespeichert. Das ist der Nachweis, "
    + "dass diese Erklärung in genau dieser Fassung vorgelegen hat — für dich wie für uns.",
};
