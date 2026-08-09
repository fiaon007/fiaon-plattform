// ═══════════════════════════════════════════════════════════════════════════
// ERSTE SCHRITTE — je Rolle kuratiert
//
// Ein neuer Mitarbeiter hat nach Vertrag und Verpflichtungserklärung eine
// leere Liste vor sich und keine Ahnung, was zuerst zu tun ist. Die Antwort
// „schau dich um“ ist bequem für uns und ratlos für ihn.
//
// DIESE TAFEL BLOCKIERT NIE. Sie ist ein Angebot, kein Tor. Wer sofort
// arbeiten will, klickt sie weg und findet sie im Profil wieder — und wer die
// Anleitung braucht, muss nicht nachfragen.
//
// Die Schemata sind GEZEICHNET, keine Screenshots: Ein Bildschirmfoto ist am
// Tag nach dem nächsten Umbau falsch, und niemand merkt es. Eine Zeichnung
// erklärt das Prinzip und veraltet nicht.
// ═══════════════════════════════════════════════════════════════════════════

export type Rolle = "agent" | "vertriebsleiter" | "onboarding" | "inkasso";

export interface Schritt {
  schluessel: string;
  titel: string;
  /** Ein Satz, warum das jetzt dran ist. */
  warum: string;
  /** Wohin es führt. Leer, wenn der Schritt nur gelesen wird. */
  ziel?: { href: string; label: string };
  /** Wird automatisch als erledigt erkannt (Serverprüfung), nicht angeklickt. */
  automatisch?: boolean;
}

export interface Karte {
  titel: string;
  text: string;
  /** Welches Schema dazu gezeichnet wird. */
  schema: "stufen" | "ergebnis" | "telefon" | "termin" | "raten" | "zusage";
}

export interface Strecke {
  begruessung: string;
  schritte: Schritt[];
  karten: Karte[];
  /** Die erste echte Arbeit — der Moment, ab dem jemand dabei ist. */
  ersteAufgabe: { titel: string; text: string; href: string };
}

// ── WAS ALLE ROLLEN GEMEINSAM HABEN ────────────────────────────────────────
// Die Verpflichtungserklärung steht hier NICHT MEHR (11.08.2026). Sie gibt es
// nur für Vertriebsleitung, Onboarding und Forderungsmanagement — die Rolle
// „agent" hat keine Stelle, an der man sie annehmen könnte. Der Schritt stand
// trotzdem in jeder Liste und war für drei von sechs Menschen im Team eine
// Sackgasse: ein Häkchen, das sich nicht setzen ließ, egal was man tat.
const GEMEINSAM: Schritt[] = [
  {
    schluessel: "vertrag",
    titel: "Vertrag unterschrieben",
    warum: "Ohne Vertrag kein Zugang — das war der erste Schritt und ist schon erledigt.",
    automatisch: true,
  },
  {
    schluessel: "profil",
    titel: "Profil vervollständigen",
    warum: "Dein Name steht in jeder Mail an einen Kunden. Foto und Telefonnummer helfen den Kollegen.",
    ziel: { href: "/agent/profil", label: "Zum Profil" },
  },
  {
    schluessel: "space",
    titel: "Im Space vorbeischauen",
    warum: "Dort stehen Ansagen, Erfolge und Fragen des Teams. Ein Blick genügt fürs Erste.",
    ziel: { href: "/agent/space", label: "Zum Space" },
  },
];

export const STRECKEN: Record<Rolle, Strecke> = {
  // ── VERTRIEB ─────────────────────────────────────────────────────────────
  agent: {
    begruessung:
      "Willkommen. Deine Arbeit besteht aus einer Liste und einem Telefon. "
      + "Wenn du beides verstanden hast, kannst du anfangen — der Rest kommt beim Tun.",
    schritte: [
      ...GEMEINSAM,
      {
        schluessel: "verfuegbarkeit",
        titel: "Verfügbarkeit setzen",
        warum: "Kunden buchen Gespräche in deinen Kalender. Ohne Zeiten bekommst du keine Termine.",
        // Die Zeiten trägt man im PROFIL ein — eine Seite /agent/verfuegbarkeit
        // gibt es nicht und gab es nie. Der Knopf führte ins Leere.
        ziel: { href: "/agent/profil#erreichbarkeit", label: "Zeiten eintragen" },
      },
      {
        schluessel: "liste_verstanden",
        titel: "Die Kundenliste verstehen",
        warum: "Drei Karten unten erklären die Reihenfolge. Zwei Minuten, dann weißt du, warum wer oben steht.",
      },
      {
        schluessel: "erstes_ergebnis",
        titel: "Erstes Gesprächsergebnis dokumentieren",
        warum: "Damit gehört dir dieser Kunde — und der Tag hat angefangen.",
        ziel: { href: "/agent/kunden", label: "Zur Kundenliste" },
        automatisch: true,
      },
    ],
    karten: [
      {
        titel: "Stufe A, B, C — die Reihenfolge",
        schema: "stufen",
        text:
          "Deine Liste ist sortiert, nicht zufällig. STUFE A: Der Kunde sagt, er habe "
          + "überwiesen — Beleg holen, fertig. STUFE B: Antrag durch, Rechnung offen — hier "
          + "liegt das meiste Geld. STUFE C: Interessent ohne Antrag. Von oben nach unten "
          + "arbeiten heißt: dort anfangen, wo am wenigsten fehlt.",
      },
      {
        titel: "Ergebnis dokumentieren — jedes Mal",
        schema: "ergebnis",
        text:
          "Nach jedem Gespräch ein Klick: zahlt sofort, zahlt am, nicht erreicht, Rückruf, "
          + "abgelehnt. Das ist keine Bürokratie — daraus entsteht deine Wiedervorlage, dein "
          + "Besitzanspruch auf den Kunden und am Monatsende deine Provision. Ein "
          + "undokumentiertes Gespräch hat für das System nicht stattgefunden.",
      },
      {
        titel: "Das Telefon im System",
        schema: "telefon",
        text:
          "Unten rechts liegt ein Telefon. Vor dem Anruf öffnest du das Gesprächsblatt — es "
          + "zeigt dir in fünf Sekunden, worum es bei diesem Menschen geht. Nach dem Auflegen "
          + "klickst du dein Ergebnis. Solange eines fehlt, siehst du eine Marke am Knopf.",
      },
    ],
    ersteAufgabe: {
      titel: "Ruf den ersten Kunden auf Stufe A an",
      text:
        "Ganz oben in deiner Liste steht jemand, der gesagt hat, er habe bezahlt. Das ist "
        + "das leichteste Gespräch, das du haben kannst: Du fragst nach dem Beleg. "
        + "Dokumentiere danach dein Ergebnis — dann ist dieser Schritt erledigt.",
      href: "/agent/kunden?stufe=A",
    },
  },

  // ── VERTRIEBSLEITUNG ─────────────────────────────────────────────────────
  vertriebsleiter: {
    begruessung:
      "Willkommen in der Vertriebsleitung. Du siehst mehr als die anderen — und trägst "
      + "dafür die Verantwortung, dass niemand liegen bleibt.",
    schritte: [
      {
        schluessel: "zusage",
        titel: "Verpflichtungserklärung annehmen",
        warum: "Sie beschreibt, was du in dieser Rolle darfst und was nicht. Ohne sie bleibt der Bereich zu.",
        automatisch: true,
        ziel: { href: "/agent/vertrieb", label: "Erklärung lesen" },
      },
      ...GEMEINSAM,
      {
        schluessel: "verfuegbarkeit",
        titel: "Verfügbarkeit setzen",
        warum: "Du führst auch selbst Gespräche.",
        // Die Zeiten trägt man im PROFIL ein — eine Seite /agent/verfuegbarkeit
        // gibt es nicht und gab es nie. Der Knopf führte ins Leere.
        ziel: { href: "/agent/profil#erreichbarkeit", label: "Zeiten eintragen" },
      },
      {
        schluessel: "gesamtsicht",
        titel: "Die Gesamtsicht ansehen",
        warum: "Dort steht, wo etwas hängt: Kunden ohne Zuständigen, alte Zusagen, stille Bestände.",
        ziel: { href: "/agent/vertrieb", label: "Zur Gesamtsicht" },
      },
      {
        schluessel: "erstes_ergebnis",
        titel: "Erstes Gesprächsergebnis dokumentieren",
        warum: "Auch die Leitung dokumentiert — sonst weiß niemand, was du besprochen hast.",
        ziel: { href: "/agent/kunden", label: "Zur Kundenliste" },
        automatisch: true,
      },
    ],
    karten: [
      {
        titel: "Stufe A, B, C — die Reihenfolge",
        schema: "stufen",
        text:
          "Dieselbe Reihenfolge wie für alle: A ist gemeldete Zahlung, B ist fertiger Antrag "
          + "mit offener Rechnung, C ist Interessent. In der Gesamtsicht siehst du diese "
          + "Verteilung je Mitarbeiter — ein großer C-Berg bei kleinem B heißt meistens, dass "
          + "jemand die leichten Fälle liegen lässt.",
      },
      {
        titel: "Umhängen, nicht wegnehmen",
        schema: "ergebnis",
        text:
          "Du kannst Kunden neu zuweisen. Tu es mit Ansage: Wer einen Kunden verliert, "
          + "verliert die Chance auf die Provision. Ein Satz im Space oder eine Nachricht "
          + "verhindert die Hälfte aller Konflikte.",
      },
      {
        titel: "Was du NICHT kannst",
        schema: "zusage",
        text:
          "Buchungen zurücknehmen, Provisionssätze ändern, Kundendokumente öffnen, "
          + "Mitarbeiter anlegen. Das steht so in deiner Verpflichtungserklärung — nicht als "
          + "Misstrauen, sondern damit klar ist, wo eine Entscheidung hingehört.",
      },
    ],
    ersteAufgabe: {
      titel: "Sieh nach, wer ohne Zuständigen dasteht",
      text:
        "In der Gesamtsicht gibt es einen Filter für Kunden ohne Betreuer. Das ist die "
        + "teuerste Lücke im Haus: ein fertiger Antrag, den niemand anruft. Weise die "
        + "ersten davon zu.",
      href: "/agent/vertrieb",
    },
  },

  // ── ONBOARDING ───────────────────────────────────────────────────────────
  onboarding: {
    begruessung:
      "Willkommen. Du führst die Startgespräche — das erste Gespräch, das ein Kunde nach "
      + "seiner Zahlung mit einem Menschen hat. Was du hier tust, entscheidet, ob er bleibt.",
    schritte: [
      {
        schluessel: "zusage",
        titel: "Verpflichtungserklärung annehmen",
        warum: "Sie beschreibt, was du in dieser Rolle darfst und was nicht. Ohne sie bleibt der Bereich zu.",
        automatisch: true,
        ziel: { href: "/agent/startgespraeche", label: "Erklärung lesen" },
      },
      ...GEMEINSAM,
      {
        schluessel: "verfuegbarkeit",
        titel: "Verfügbarkeit setzen",
        warum: "Kunden buchen ihr Startgespräch selbst in deinen Kalender. Ohne Zeiten passiert nichts.",
        // Die Zeiten trägt man im PROFIL ein — eine Seite /agent/verfuegbarkeit
        // gibt es nicht und gab es nie. Der Knopf führte ins Leere.
        ziel: { href: "/agent/profil#erreichbarkeit", label: "Zeiten eintragen" },
      },
      {
        schluessel: "startgespraeche",
        titel: "Die Startgespräch-Liste ansehen",
        warum: "Dort stehen die gebuchten Termine und die Kunden, die noch keinen haben.",
        ziel: { href: "/agent/startgespraeche", label: "Zu den Startgesprächen" },
      },
      {
        schluessel: "erstes_ergebnis",
        titel: "Erstes Startgespräch dokumentieren",
        warum: "Damit weiß der Vertrieb, dass der Kunde angekommen ist.",
        ziel: { href: "/agent/startgespraeche", label: "Zur Liste" },
        automatisch: true,
      },
    ],
    karten: [
      {
        titel: "Was ein Startgespräch ist",
        schema: "termin",
        text:
          "Der Kunde hat bezahlt und wartet. Im Startgespräch klärst du, was er bekommt, "
          + "welche Unterlagen noch fehlen und wie es weitergeht. Kein Verkauf — der ist "
          + "gelaufen. Es geht um Ankommen.",
      },
      {
        titel: "Termine kommen zu dir",
        schema: "telefon",
        text:
          "Kunden buchen selbst in deine freien Zeiten. Du bekommst eine Erinnerung, der "
          + "Kunde auch. Erscheint er nicht, wird der Termin als verpasst festgehalten und du "
          + "kannst einen neuen anbieten — ohne Vorwurf, das passiert.",
      },
      {
        titel: "Sprache",
        schema: "zusage",
        text:
          "Du sagst „Du“ und vermeidest das Wort „Beratung“ — FIAON begleitet, berät nicht. "
          + "Das ist keine Feinheit: Der Unterschied entscheidet darüber, welche Erlaubnisse "
          + "das Unternehmen braucht.",
      },
    ],
    ersteAufgabe: {
      titel: "Trag deine Zeiten für diese Woche ein",
      text:
        "Ohne freie Zeiten kann kein Kunde buchen, und deine Liste bleibt leer. Zwei "
        + "Nachmittage genügen für den Anfang.",
      href: "/agent/profil#erreichbarkeit",
    },
  },

  // ── INKASSO ──────────────────────────────────────────────────────────────
  inkasso: {
    begruessung:
      "Willkommen im Forderungsmanagement. Du sprichst mit Menschen, die eine Rate nicht "
      + "bezahlt haben — meistens nicht, weil sie nicht wollen, sondern weil sie nicht "
      + "können. Dieser Unterschied ist dein wichtigstes Werkzeug.",
    schritte: [
      {
        schluessel: "zusage",
        titel: "Verpflichtungserklärung annehmen",
        warum: "Sie beschreibt, was du in dieser Rolle darfst und was nicht. Ohne sie bleibt der Bereich zu.",
        automatisch: true,
        ziel: { href: "/agent/inkasso", label: "Erklärung lesen" },
      },
      ...GEMEINSAM,
      {
        schluessel: "liste_verstanden",
        titel: "Die Ratenliste verstehen",
        warum: "Die Reihenfolge macht das System. Die Karten unten erklären, warum was oben steht.",
      },
      {
        schluessel: "stunden",
        titel: "Erste Arbeitszeit erfassen",
        warum: "Deine Stunden werden monatlich bestätigt und abgerechnet. Trag sie am selben Tag ein.",
        ziel: { href: "/agent/inkasso?tab=stunden", label: "Zur Zeiterfassung" },
      },
      {
        schluessel: "erstes_ergebnis",
        titel: "Erstes Ratenergebnis dokumentieren",
        warum: "Ohne dokumentierte Bearbeitung gibt es auch keine Prämie für die Rate.",
        ziel: { href: "/agent/inkasso", label: "Zur Arbeitsliste" },
        automatisch: true,
      },
    ],
    karten: [
      {
        titel: "Die Reihenfolge deiner Liste",
        schema: "raten",
        text:
          "Ganz oben: Fälle mit Anruf-Pflicht — dort ist der automatische Mahnlauf zu Ende "
          + "und ein Mensch muss ran. Dann gebrochene Zusagen: Wer ein Datum genannt und "
          + "nicht gehalten hat, ist erreichbar — das ist mehr wert als ein Fall, der noch nie "
          + "geantwortet hat. Dann überfällig nach Mahnstufe, die höchste zuerst. Dann heute "
          + "fällig.",
      },
      {
        titel: "Vier Ergebnisse, kein fünftes",
        schema: "ergebnis",
        text:
          "Zahlt am (mit Datum), überwiesen mit Beleg, nicht erreicht, oder Weitergabe an den "
          + "Vorgesetzter. Was es NICHT gibt: Erlass, Stundung, Kürzung, Storno. Diese Wege "
          + "existieren in deinem Bereich nicht — nicht als gesperrter Knopf, sondern "
          + "überhaupt nicht. Wer einen Nachlass braucht, geht über die Weitergabe.",
      },
      {
        titel: "Der Ton",
        schema: "zusage",
        text:
          "Du drohst nicht. Nicht mit Schufa, nicht mit Gericht, nicht mit Kosten, auch nicht "
          + "angedeutet. Du nennst die offene Rate, den Betrag und fragst, wann sie kommt. "
          + "Wenn jemand offensichtlich nicht kann, ist die richtige Antwort nicht mehr Druck, "
          + "sondern die Weitergabe. Deine Gespräche werden aufgezeichnet — das schützt auch "
          + "dich.",
      },
    ],
    ersteAufgabe: {
      titel: "Arbeite den obersten Fall ab",
      text:
        "Ganz oben steht der dringendste Fall. Öffne ihn, sieh dir an, welche Erinnerungen "
        + "der Kunde schon bekommen hat, ruf an und dokumentiere das Ergebnis.",
      href: "/agent/inkasso",
    },
  },
};

export function streckeFuer(rolle: string): Strecke {
  return STRECKEN[(rolle as Rolle)] ?? STRECKEN.agent;
}
