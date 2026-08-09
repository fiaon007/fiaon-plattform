// ═══════════════════════════════════════════════════════════════════════════
// VERPFLICHTUNGSERKLÄRUNG INKASSO
//
// Nach demselben Muster wie Vertrieb und Onboarding: eigene Datei, eigene
// Fassung, dieselbe `bereich`-Maschinerie (fiaon-vertrieb-zusage.ts).
//
// WARUM DIESER BEREICH EINE EIGENE ERKLÄRUNG BRAUCHT
// Inkasso spricht mit Menschen an ihrem schlechtesten Tag. Wer eine Rate nicht
// zahlt, hat meistens keinen Grund dazu, sondern kein Geld. Das ist ein
// Unterschied, und er entscheidet über den Ton.
//
// Zwei Fehler wären in diesem Bereich existenzbedrohend:
//   · Drohsprache. Wer am Telefon mit Schufa, Gericht oder Inkassobüro droht,
//     erzeugt einen Straftatbestand, keine Zahlung — und FIAON haftet dafür.
//   · Eigenmächtige Nachlässe. Ein zugesagter Erlass ist ein Vertrag. Wer ihn
//     ohne Vorgesetzter zusagt, verschenkt Geld, das ihm nicht gehört.
// Deshalb existieren Erlass, Stundung und Storno im Bereich GAR NICHT — nicht
// als gesperrter Knopf, sondern überhaupt nicht.
// ═══════════════════════════════════════════════════════════════════════════

import type { ZusageText } from "./fiaon-vertrieb-zusage";

export const INKASSO_ZUSAGE_VERSION = "1.0";

export const INKASSO_ZUSAGE_TEXT: ZusageText = {
  version: INKASSO_ZUSAGE_VERSION,
  ueberschrift: "Forderungsmanagement — was du darfst und was du schuldest",
  gratulation:
    "Du übernimmst das Forderungsmanagement. Das ist die Stelle, an der FIAON "
    + "sein Geld tatsächlich sieht — und die Stelle, an der ein falscher Satz am "
    + "Telefon mehr kostet als jede offene Rate.",
  einleitung:
    "Du sprichst mit Menschen, die eine Rate nicht bezahlt haben. Die meisten "
    + "haben dafür keinen Grund, sondern kein Geld. Dieser Unterschied entscheidet "
    + "über deinen Ton. Bevor du den Bereich betreten kannst, bestätige die "
    + "folgenden Punkte — sie sind keine Formalie, sondern die Grenzen deiner "
    + "Vollmacht.",

  kann: [
    {
      titel: "Fällige und überfällige Raten sehen und abarbeiten",
      text:
        "Deine Liste zeigt bezahlte Kunden mit laufender Ratenzahlung: welche Rate "
        + "offen ist, seit wann, welchen Verwendungszweck sie hat und welche "
        + "Erinnerungen der Kunde bereits bekommen hat. Die Reihenfolge macht das "
        + "System — du arbeitest von oben nach unten.",
    },
    {
      titel: "Anrufen und dokumentieren",
      text:
        "Du telefonierst aus dem System heraus. Jedes Gespräch wird mit Ansage "
        + "aufgezeichnet, und du hältst am Ende fest, was dabei herauskam: Zusage "
        + "mit Datum, überwiesen mit Beleg, nicht erreicht, oder Weitergabe an den "
        + "Vorgesetzter.",
    },
    {
      titel: "Zahlungszusagen aufnehmen und Belege annehmen",
      text:
        "Wenn der Kunde ein Datum nennt, trägst du es ein — die Rate kommt dann an "
        + "diesem Tag wieder auf deinen Tisch. Schickt er einen Beleg, hängst du ihn "
        + "an; gebucht wird er vom Vorgesetzter nach Kontoabgleich.",
    },
    {
      titel: "Deine Vergütung jederzeit sehen",
      text:
        "Erfasste und bestätigte Stunden, dazu die Prämien für eingezogene Raten — "
        + "live und nachvollziehbar. Abgerechnet wird über denselben Weg wie im "
        + "Vertrieb.",
    },
  ],

  kannNicht: [
    "Forderungen erlassen, stunden, kürzen oder stornieren — diese Wege gibt es "
      + "in deinem Bereich nicht, auch nicht in Ausnahmefällen. Wer einen "
      + "Nachlass braucht, geht über den Vorgesetzten.",
    "Ratenbeträge, Fälligkeiten oder Verwendungszwecke ändern.",
    "Eine Zahlung als eingegangen buchen — das entscheidet der Kontoabgleich, "
      + "nicht ein Gespräch.",
    "Kunden ohne laufende Ratenzahlung sehen: keine Leads, keine unbezahlten "
      + "Bestellungen, keine Verkaufslisten.",
    "Kundendokumente öffnen oder herunterladen (Ausweis, Kontoauszug, SCHUFA).",
    "Kunden neu zuweisen, Mitarbeiter anlegen oder Provisionen ändern.",
  ],

  pflichten: [
    {
      nr: 1,
      titel: "Zweckbindung",
      text:
        "Du benutzt die Daten, die du siehst, ausschließlich für das "
        + "Forderungsmanagement von FIAON. Nicht für eigene Geschäfte, nicht für "
        + "Dritte, nicht für Neugier. Jeder Zugriff ist protokolliert.",
    },
    {
      nr: 2,
      titel: "Vertraulichkeit",
      text:
        "Was du über die Zahlungsfähigkeit eines Menschen erfährst, verlässt FIAON "
        + "nicht. Nicht im Freundeskreis, nicht als Beispiel, nicht anonymisiert. "
        + "Diese Pflicht gilt auch, nachdem du nicht mehr für FIAON arbeitest.",
    },
    {
      nr: 3,
      titel: "Keine Drohsprache",
      text:
        "Du drohst nicht — nicht mit Schufa-Einträgen, nicht mit Gericht, nicht mit "
        + "Inkassobüros, nicht mit Kosten, nicht mit Konsequenzen für die "
        + "Kreditwürdigkeit. Auch nicht angedeutet, auch nicht als Frage verpackt. "
        + "Du nennst die offene Rate, den Betrag und fragst, wann sie kommt. "
        + "Nachdruck entsteht durch Verbindlichkeit, nicht durch Angst.",
    },
    {
      nr: 4,
      titel: "Würde",
      text:
        "Du sprichst mit Menschen in Geldnot. Du machst niemandem Vorwürfe, "
        + "unterstellst keine Absicht und nutzt keine Notlage aus, um eine "
        + "schnellere Zusage zu bekommen. Wenn jemand offensichtlich nicht zahlen "
        + "kann, ist die richtige Antwort nicht mehr Druck, sondern die Weitergabe "
        + "an den Vorgesetzten.",
    },
    {
      nr: 5,
      titel: "Keine Zusagen, die dir nicht zustehen",
      text:
        "Du sagst keinen Erlass, keine Stundung, keine Ratenänderung und keine "
        + "Kulanz zu — auch nicht mündlich, auch nicht „inoffiziell“, auch nicht "
        + "unter Vorbehalt. Ein Satz wie „das kriegen wir hin“ ist am Telefon eine "
        + "Zusage, egal wie du es meinst.",
    },
    {
      nr: 6,
      titel: "Meldepflicht",
      text:
        "Härtefälle, angekündigte Insolvenz, Todesfälle, Drohungen gegen dich, "
        + "Beschwerden über den Ton eines Gesprächs und jeden Verdacht auf einen "
        + "Fehler in der Ratenkette meldest du sofort dem Vorgesetzten — über die "
        + "Weitergabe-Funktion, mit Notiz. Ein gemeldeter Fehler ist ein Fehler "
        + "weniger; ein verschwiegener wird teuer.",
    },
    {
      nr: 7,
      titel: "Aufzeichnung",
      text:
        "Deine Gespräche werden aufgezeichnet, nachdem der Kunde die Ansage gehört "
        + "hat. Das schützt beide Seiten: dich gegen den Vorwurf, etwas gesagt zu "
        + "haben, und den Kunden gegen einen Ton, den er nicht belegen könnte.",
    },
  ],

  schlusssatz:
    "Wenn du diese Punkte bestätigst, bekommst du Zugang zum Forderungs"
    + "management. Die Bestätigung wird mit Zeitpunkt, deinem getippten Namen und "
    + "dem Prüfwert dieses Textes festgehalten. Ändert FIAON den Text, wirst du "
    + "erneut gefragt — eine alte Zusage wird nicht stillschweigend erweitert.",

  hinweisProtokoll:
    "Festgehalten werden: Zeitpunkt, dein Name in deiner Schreibweise, die "
    + "Fassung dieses Textes und dessen Prüfwert. Du kannst die Zusage jederzeit "
    + "widerrufen — dann endet dein Zugang zum Bereich.",
};
