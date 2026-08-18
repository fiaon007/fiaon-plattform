// ═══════════════════════════════════════════════════════════════════════════
// DIE FIAON ACADEMY — DIE KAPITEL DER DREI REISEN
//
// ── WOFÜR ──────────────────────────────────────────────────────────────────
// Der Betreiber teilt den Bildschirm und führt einen neuen Mitarbeiter durch
// den perfekten Ablauf seiner Abteilung. Jedes Kapitel ist eine Bühne: ein
// Satz groß, wer handelt, die echte Oberfläche, und wenn eine Mail fließt, ihre
// echte Vorschau.
//
// ── NICHTS IST ERFUNDEN ────────────────────────────────────────────────────
// Jedes Kapitel verweist auf eine Stelle, die es GIBT: eine Route der
// Oberfläche (`weg`), ein Registry-Ereignis (`mailEvent`) oder eine Datei
// (`quelle`). Der Prüfstand `pruef-academy.ts` gleicht die Ereignisnamen gegen
// `server/lib/fiaon-mail-events.ts` ab — ein Kapitel, das eine Mail zeigt, die
// es nicht gibt, wäre eine Schulung in etwas Falsches.
//
// Die 23 Ereignisse der Registry (Stand 26.08.2026):
//   welcome · payment_details · payment_reminder · claim_received ·
//   payment_confirmed · abo_payment_reminder · nicht_erreicht_termin ·
//   termin_bestaetigung · termin_erinnerung · onboarding_einladung ·
//   number_update_request · lead_followup · lead_application_link ·
//   documents_change_request · schufa_requested · schufa_approved ·
//   schufa_rejected · account_activated · account_suspended ·
//   payment_cancelled · payment_reactivated · profile_query · gdpr_deleted
//
// ── WARUM KEINE EINGEBETTETEN KOMPONENTEN UND KEINE BUILD-SCREENSHOTS ──────
// Der Auftrag ließ die Wahl. Beide Wege haben wir verworfen:
//
//   Einbettung der echten Komponenten (read-only):
//     Sie brauchen Anmeldung, Kundendaten, Zustand und ihre eigenen Abrufe. Ein
//     Kapitel über das Onboarding-Cockpit müsste einen echten Kunden laden —
//     also einen echten Menschen im Schulungsbild. Und jede Änderung an der
//     Komponente kann die Schulung weiß machen (der Haken-Fehler vom 16.08.
//     hat genau das getan).
//
//   Screenshots beim Build:
//     Sie brauchen einen laufenden Server mit Anmeldung IM Build, veralten
//     lautlos und zeigen echte Kundennamen. Ein Bild, das seit drei Wochen
//     falsch ist, schult falsch — und niemand merkt es.
//
//   GEWÄHLT: der WEG statt des Bildes. Jedes Kapitel nennt die echte Route und
//     zeigt einen Knopf „Live öffnen" (neuer Tab). Der Betreiber führt am
//     echten System vor — das ist ohnehin überzeugender als ein Bild. Dazu die
//     ECHTEN Texte aus dem Repo (die sieben Agenda-Schritte kommen aus
//     `shared/fiaon-onboarding-agenda.ts`, nicht aus einer Kopie), und für
//     Mails die BESTEHENDE Brevo-Vorschau.
//
//     Wartbarkeit: Eine geänderte Route fällt im Prüfstand auf. Ein geänderter
//     Agenda-Text wandert von selbst mit, weil er aus derselben Datei kommt.
// ═══════════════════════════════════════════════════════════════════════════
import { AGENDA } from "./fiaon-onboarding-agenda";

// ═══════════════════════════════════════════════════════════════════════════
// DIE KERNBOTSCHAFT — DER WORTLAUT DER GESCHÄFTSFÜHRUNG
//
// ── WARUM SIE HIER STEHT UND NICHT IN EINER SEITE ─────────────────────────
// Sie erscheint an DREI Stellen: als Kapitel in der Vertriebs-Reise, als
// Kapitel in der Onboarding-Reise und als Einblendung im Onboarding-Cockpit
// beim Schritt „Abo-Klarheit". Drei Kopien desselben Satzes wären drei Sätze,
// die auseinanderlaufen — und bei einer Aussage über die SCHUFA wäre das kein
// Schönheitsfehler.
//
// ── UND WARUM ER NICHT ABGESCHWÄCHT IST ───────────────────────────────────
// Der Wortlaut ist von der Geschäftsführung freigegeben. Er steht hier
// BUCHSTABENGETREU. Wer ihn ändern will, ändert ihn hier — und dann überall,
// mit derselben Freigabe.
// ═══════════════════════════════════════════════════════════════════════════

/** Der freigegebene Wortlaut. Nicht umformulieren. */
export const KERNBOTSCHAFT = "Wenn jemand einen Vertrag mit uns hat, diesen "
  + "pünktlich und positiv bezahlt UND unsere Empfehlungen in Anspruch nimmt, "
  + "dann verbessert sich die Bonität. Nichtzahlungen werden an die SCHUFA "
  + "gemeldet.";

/** Die zwei Pfade — für die zweigeteilte Karte. */
export const KERNBOTSCHAFT_PFADE = {
  aufbau: {
    titel: "Pünktlich + Empfehlungen = Aufbau",
    punkte: [
      "Vertrag läuft, Raten kommen pünktlich",
      "Der Kunde nimmt unsere Empfehlungen in Anspruch",
      "→ die Bonität verbessert sich",
    ],
  },
  meldung: {
    titel: "Nichtzahlung = Meldung",
    punkte: [
      "Raten bleiben offen",
      "Mahnstufen laufen durch",
      "→ Nichtzahlungen werden an die SCHUFA gemeldet",
    ],
  },
} as const;

export const KERNBOTSCHAFT_FUSSNOTE = "Wortlaut freigegeben durch die Geschäftsführung.";

/** Wer in diesem Kapitel handelt. */
export type Handelnder =
  | "kunde" | "agent" | "onboarding" | "inkasso" | "leitung" | "automatik";

export const HANDELNDER_TEXT: Record<Handelnder, string> = {
  kunde: "Der Kunde",
  agent: "Der Vertriebsmitarbeiter",
  onboarding: "Das Onboarding",
  inkasso: "Das Forderungsmanagement",
  leitung: "Die Vertriebsleitung",
  automatik: "Die Automatik",
};

export interface Kapitel {
  /** Eindeutig innerhalb der Reise — steht in der Adresse (#kapitel). */
  key: string;
  /** WAS passiert — ein Satz, groß gesetzt. Kein Nebensatz. */
  was: string;
  /** WER handelt. */
  wer: Handelnder;
  /** Zwei bis vier Sätze: der Ablauf im Detail. */
  text: string;
  /** „Warum dieser Schritt" — aufklappbar. Die Begründung, nicht die Anleitung. */
  warum: string;
  /** Die echte Stelle in der Oberfläche. */
  weg?: { pfad: string; label: string };
  /** Fließt hier eine Mail? Muss ein Registry-Ereignis sein. */
  mailEvent?: string;
  /** Zahlen, die den Schritt belegen — aus Messungen, mit Datum. */
  zahlen?: string[];
  /** Wo im Quelltext das steckt — für Rückfragen. */
  quelle?: string;
  /**
   * Hervorgehoben darstellen — zweigeteilte Karte, groß.
   *
   * Nur für die Kernbotschaft. Ein zweites hervorgehobenes Kapitel würde das
   * erste entwerten: Wenn alles wichtig ist, ist nichts wichtig.
   */
  hervorgehoben?: boolean;
  /**
   * Stichpunkte zum VORLESEN — bewusst kurz.
   *
   * Aus der Onboarding-Agenda: „Wer einen Absatz vorliest, klingt vorgelesen."
   * Die Academy zeigt sie groß, damit der Betreiber sie im geteilten Bildschirm
   * benutzen kann.
   */
  punkte?: string[];
}

export interface Reise {
  key: "vertrieb" | "onboarding" | "inkasso";
  titel: string;
  /**
   * Die Akzentfarbe der Reise.
   *
   * ── WARUM JE REISE EINE EIGENE (27.08.2026) ─────────────────────────────
   * Wer drei Reisen hintereinander vorführt, verliert sonst die Orientierung:
   * Alles sieht gleich aus, und niemand weiß mehr, in welcher Abteilung er ist.
   * Eine Farbe je Reise beantwortet das ohne ein Wort.
   *
   * Alle drei sind gegen den Navy-Grund (#0A1A3C) auf mindestens 4.5:1 geprüft
   * — der Prüfstand rechnet sie nach.
   */
  ton: { akzent: string; hell: string; verlauf: string };
  /** Ein Satz, der die Abteilung erklärt. */
  unterzeile: string;
  /** Geschätzte Dauer der Vorführung. */
  dauerMin: number;
  /** Welche Rollen diese Reise sehen sollen — für die spätere Ausrollung. */
  fuerRollen: string[];
  kapitel: Kapitel[];
}

// ═══════════════════════════════════════════════════════════════════════════
// REISE 1 — VERTRIEB
// ═══════════════════════════════════════════════════════════════════════════
const VERTRIEB: Kapitel[] = [
  {
    key: "lead-entsteht",
    was: "Ein Mensch füllt bei Facebook ein Formular aus — und ist zwei Sekunden später bei uns.",
    wer: "kunde",
    text: "Das Lead-Formular liegt bei Facebook. Make holt es ab und legt bei uns eine "
      + "Person an — mit Name, Nummer und der Kampagne, aus der sie kam. Ab dieser "
      + "Sekunde gehört der Mensch in eine Liste, nicht in ein Postfach.",
    warum: "Ein Lead, der in einem Postfach liegt, wird von niemandem angerufen. Wer "
      + "ihn zuerst sieht, hält ihn für erledigt. Deshalb entsteht sofort eine Person "
      + "mit Zuständigkeit — nicht erst, wenn jemand Zeit hat.",
    weg: { pfad: "/admin/kunden?stufe=c", label: "Leads in der Kunden-Zentrale" },
    quelle: "server/lib/fiaon-lead-strecke.ts",
  },
  {
    key: "ewige-strecke",
    was: "Er bekommt Nachfass-Mails — nicht sechs, sondern so lange es sinnvoll ist.",
    wer: "automatik",
    text: "Die alte Strecke schickte sechs Mails und markierte den Lead danach als tot. "
      + "Die ewige Strecke schickt weiter, in wachsenden Abständen, bis er reagiert oder "
      + "widerspricht. Der Schalter dafür steht in den Einstellungen — die Leitung kann "
      + "ihn jederzeit umlegen.",
    warum: "Beim Umbau wurden 1.483 Leads gefunden, die als „tot“ markiert waren — "
      + "genau die, für die die neue Strecke gebaut wurde. Ein Mensch, der auf die "
      + "vierte Mail nicht antwortet, hat nicht abgelehnt. Er hatte keine Zeit.",
    mailEvent: "lead_followup",
    zahlen: ["1.483 Leads standen als „tot“ in der Datenbank (18.08.2026)"],
    quelle: "server/lib/fiaon-lead-strecke.ts",
  },
  {
    key: "stufen-abc",
    was: "Jeder Kunde steht in einer von drei Stufen — und die Reihenfolge ist vorgegeben.",
    wer: "agent",
    text: "A heißt: Zahlung gemeldet, wir müssen prüfen. B heißt: Antrag fertig, Rechnung "
      + "offen — hier liegt das Geld. C heißt: Lead ohne Antrag. Die Arbeitsliste sortiert "
      + "von oben nach unten; wer sie von oben abarbeitet, arbeitet richtig.",
    warum: "Ohne Reihenfolge ruft jeder die an, die er kennt. Die Stufen machen aus einer "
      + "Meinung eine Rangfolge — und aus „ich habe viel telefoniert“ eine überprüfbare "
      + "Aussage.",
    weg: { pfad: "/agent/kunden", label: "Die Arbeitsliste" },
    quelle: "server/lib/tier.ts",
  },
  {
    key: "anruf",
    was: "Der Anruf läuft im Browser — mit dem Gesprächsblatt daneben.",
    wer: "agent",
    text: "Ein Klick auf die Nummer wählt. Während es klingelt, steht rechts das "
      + "Gesprächsblatt: was der Mensch bestellt hat, was er bezahlt hat, was beim letzten "
      + "Mal besprochen wurde. Niemand muss suchen, während jemand abhebt.",
    warum: "Die ersten fünf Sekunden entscheiden. Wer in ihnen blättert, hat das Gespräch "
      + "verloren — und der Kunde hört, dass er eine Nummer ist.",
    weg: { pfad: "/agent/kunden", label: "Softphone in der Kundenliste" },
    quelle: "client/src/components/Softphone.tsx",
  },
  {
    key: "ergebnis",
    was: "Nach dem Gespräch wird EIN Ergebnis geklickt — und das System zieht die Folgen.",
    wer: "agent",
    text: "„Zahlt sofort“ legt eine Wiedervorlage auf morgen. „Zahlt am …“ merkt sich das "
      + "Datum. „Abgelehnt“ nimmt den Kunden aus jeder Liste. Und „Erreicht — Sonstiges“ "
      + "verlangt eine Notiz von mindestens zehn Zeichen.",
    warum: "„Sonstiges“ ohne Notiz ist ein verlorenes Gespräch: Der nächste Anrufer fängt "
      + "bei Null an und fragt dasselbe noch einmal. Die Pflicht steht seit dem 24.08. im "
      + "Server, nicht nur in der Oberfläche — vorher kam der Listen-Weg ohne Notiz durch.",
    weg: { pfad: "/agent/kunden", label: "Kontakt-Ergebnisse" },
    quelle: "server/lib/fiaon-kontakt-ergebnis.ts",
  },
  {
    key: "nicht-erreicht",
    was: "Wer nicht abhebt, bekommt automatisch einen Terminlink.",
    wer: "automatik",
    text: "Nach dem Klick „nicht erreicht“ geht eine Mail raus: „Wir haben versucht, Sie "
      + "zu erreichen — wählen Sie selbst eine Uhrzeit.“ Der Kunde sieht freie Zeiten und "
      + "bucht. Der Termin landet beim zuständigen Mitarbeiter.",
    warum: "GEMESSEN: Alle 120 gebuchten Termine im System stammen aus einem verschickten "
      + "Link. Kein einziger entstand anders. Der Link ist der Hebel — und jeder nicht "
      + "verschickte ist ein verlorener Termin.",
    mailEvent: "nicht_erreicht_termin",
    zahlen: ["120 von 120 Terminen kamen über einen Terminlink (26.08.2026)"],
    weg: { pfad: "/admin/termine", label: "Termin-Zentrale" },
  },
  {
    key: "falsche-nummer",
    was: "Stimmt die Nummer nicht, fragt das System den Kunden — und legt den Fall schlafen.",
    wer: "automatik",
    text: "„Falsche Nummer“ verschickt eine Mail mit der Bitte um die richtige. Danach "
      + "verschwindet der Fall für sieben Tage aus der Tagesliste und kommt von selbst "
      + "zurück: wenn der Kunde antwortet, wenn er einen Termin bucht, oder wenn die "
      + "Woche um ist.",
    warum: "Eine Karte, bei der man nichts tun kann, ist keine Aufgabe — sie ist ein "
      + "Übungsstück im Überblättern. Und wer gelernt hat zu überblättern, überblättert "
      + "auch die zwei, bei denen es brennt.",
    mailEvent: "number_update_request",
    zahlen: ["7 zahlende Kunden standen täglich vergeblich auf der Liste (24.08.2026)"],
    quelle: "server/lib/fiaon-warten.ts",
  },
  {
    key: "neukunde",
    was: "Der Mitarbeiter legt den Kunden selbst an — im Gespräch, in einem Zug.",
    wer: "agent",
    text: "Name, dazu E-Mail oder Telefon, Paket aus dem Katalog. Während er tippt, prüft "
      + "das System auf Doppelgänger — über Adresse, Nummer und frühere Werte. Danach "
      + "bleibt das Fenster offen und zeigt drei Schritte: Zahlungsdaten, Termin, Akte.",
    warum: "Bis zum 25.08. gab es dafür keine Route: Der Mitarbeiter hatte den Menschen "
      + "am Telefon und musste die Verwaltung bitten. Und der Doppelgänger-Check läuft "
      + "VOR dem Speichern, weil ein Merge unumkehrbar ist.",
    weg: { pfad: "/agent/kunden", label: "„+ Kunde anlegen“" },
    quelle: "server/routes/fiaon-agent-anlage.ts",
  },
  {
    key: "zahlungsdaten",
    was: "Die Zahlungsdaten gehen raus — per Mail oder als Text für WhatsApp.",
    wer: "agent",
    text: "Die Mail enthält Verwendungszweck, Betrag und die Rechnung als PDF. Wer den "
      + "Kunden am Telefon hat, kopiert stattdessen den Text und schickt ihn über "
      + "WhatsApp. Der Preis kommt immer aus dem Katalog — es gibt kein Feld dafür.",
    warum: "Es gab einmal zwei Preislisten, die sich widersprachen: Ultra-Kunden kauften "
      + "für 79,99 € und bekamen Rechnungen über 99,99 €. Seit dem 16.08. steht jeder "
      + "Preis an genau einer Stelle.",
    mailEvent: "payment_details",
    quelle: "shared/fiaon-pakete.ts",
  },
  kernbotschaft("agent",
    "Das ist der Satz, mit dem wir verkaufen — und deshalb der Satz, an dem wir "
    + "gemessen werden. Wer mehr verspricht, erzeugt eine Rückbuchung und einen "
    + "verlorenen Kunden. Wer die Konsequenz weglässt, erzeugt einen Menschen, "
    + "der sich hinterher betrogen fühlt. Beides kostet mehr als ein ehrliches "
    + "Nein im ersten Gespräch."),
  {
    key: "zahlung-gemeldet",
    was: "Der Kunde meldet seine Zahlung — und wir prüfen sie, statt sie zu glauben.",
    wer: "kunde",
    text: "Über den Link in der Rechnung meldet der Kunde: „Ich habe überwiesen.“ Der "
      + "Zustand wird `claimed_paid` — gemeldet, nicht bestätigt. Erst der Kontoabgleich "
      + "macht daraus `paid`.",
    warum: "Zwischen Meldung und Eingang liegen zwei bis fünf Bankarbeitstage. Wer die "
      + "Meldung als Zahlung verbucht, schaltet Leistungen frei, die niemand bezahlt hat "
      + "— und wer sie ignoriert, mahnt einen Kunden, der längst überwiesen hat.",
    mailEvent: "claim_received",
    weg: { pfad: "/admin/kontoabgleich", label: "Kontoabgleich" },
  },
  {
    key: "verbuchung",
    was: "Der Kontoauszug wird abgeglichen — und die Zahlung landet am richtigen Kunden.",
    wer: "leitung",
    text: "Der Auszug kommt als Datei. Das System sucht den Verwendungszweck, sonst Betrag "
      + "und Name. Passt es, wird verbucht: Der Kunde ist bezahlt, seine offenen "
      + "Schwester-Bestellungen werden stillgelegt, die Bestätigungsmail geht raus.",
    warum: "Ohne Stilllegung bekäme ein Kunde, der von Pro auf Ultra gewechselt ist, zwei "
      + "Zahlungsaufforderungen. Die Bonitätsauskunft ist davon ausgenommen — diese "
      + "Kategoriegrenze fehlte einmal und kostete 583,98 € offenen Umsatz.",
    mailEvent: "payment_confirmed",
    weg: { pfad: "/admin/verbuchung", label: "Zahlungen verbuchen" },
  },
  {
    key: "provision",
    was: "Die Provision entsteht bei der ZAHLUNG — nicht beim Verkauf.",
    wer: "automatik",
    text: "Sobald eine Zahlung verbucht ist, prüft das System, wer den Kunden betreut hat, "
      + "und legt die Provision an. Genau einmal je Kunde: Die Grenze steht als "
      + "eindeutiger Index in der Datenbank, nicht im Programm.",
    warum: "Eine Provision im Code zu begrenzen reicht nicht: Zwei gleichzeitige "
      + "Abschlüsse lesen beide „noch keine da“ und schreiben beide. Eine Wand, die man "
      + "umgehen kann, wird umgangen.",
    weg: { pfad: "/admin/team", label: "Team-Zentrale, Provisionen" },
    quelle: "server/lib/fiaon-provision.ts",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REISE 2 — ONBOARDING (die wichtigste)
// ═══════════════════════════════════════════════════════════════════════════
//
// ── DIE SIEBEN AGENDA-SCHRITTE KOMMEN AUS DER ECHTEN QUELLE ───────────────
// `shared/fiaon-onboarding-agenda.ts` — dieselbe Datei, die das Cockpit
// benutzt. Eine Kopie hier wäre die zweite Wahrheit: Ändert jemand einen
// Schritt, schult die Academy weiter den alten.
const ONBOARDING: Kapitel[] = [
  {
    key: "zahlung-da",
    was: "Der Kunde hat bezahlt. Jetzt beginnt das, wofür er bezahlt hat.",
    wer: "automatik",
    text: "Mit der verbuchten Zahlung wird das Konto angelegt, aber noch nicht "
      + "freigeschaltet. Der Kunde bekommt seine Zugangsdaten und kann sich anmelden — "
      + "er sieht dann als Erstes ein Gate.",
    warum: "Ein Konto, das sofort alles zeigt, wird ohne Gespräch benutzt. Danach ruft "
      + "der Kunde an und fragt Dinge, die im Startgespräch geklärt gewesen wären — oder "
      + "er kündigt, weil er den Wert nicht sieht.",
    mailEvent: "payment_confirmed",
  },
  {
    key: "erst-login",
    was: "Beim ersten Anmelden stehen zwei Karten — und keine ist wegklickbar.",
    wer: "kunde",
    text: "Karte eins: „Buche dein Startgespräch.“ Karte zwei: „Deine Bonitätsauskunft "
      + "(74 €).“ Ohne Termin geht es nicht weiter. Die Auskunft ist freiwillig, steht "
      + "aber gleichberechtigt daneben.",
    warum: "Beide Karten sind hier, weil der Kunde genau jetzt aufmerksam ist. Wer die "
      + "Auskunft erst in drei Wochen anbietet, erreicht ihn nicht mehr — und wer sie "
      + "als Bedingung tarnt, verliert das Vertrauen für alles Weitere.",
    weg: { pfad: "/dashboard", label: "Das Kundenportal" },
    quelle: "client/src/components/PortalSperre.tsx",
  },
  {
    key: "buchung",
    was: "Der Kunde sieht höchstens fünf Zeiten — und wählt eine.",
    wer: "kunde",
    text: "Fünf Vorschläge, keine Wochenübersicht. Nach der Wahl kommt sofort die "
      + "Bestätigung mit Datum, Uhrzeit und dem Satz: „Wir rufen Sie an.“ Dazu ein "
      + "Absage-Link, der ohne Anmeldung funktioniert.",
    warum: "Zwanzig freie Termine sind keine Freiheit, sondern eine Entscheidung, die "
      + "aufgeschoben wird. Und der Satz „Wir rufen an“ verhindert die häufigste "
      + "Rückfrage: Wer muss wen anrufen?",
    mailEvent: "termin_bestaetigung",
    weg: { pfad: "/admin/termine", label: "Termin-Zentrale" },
  },
  {
    key: "erinnerung",
    was: "24 Stunden vorher erinnert das System — ohne dass jemand daran denkt.",
    wer: "automatik",
    text: "Eine Mail am Tag davor, mit Uhrzeit und Absage-Link. Wer nicht kann, sagt ab, "
      + "statt nicht zu erscheinen.",
    warum: "GEMESSEN: 43 von 120 Terminen wurden verpasst, bei einem Mitarbeiter 76 %. "
      + "Ein verpasster Termin kostet doppelt — die Zeit des Mitarbeiters und den "
      + "Anlauf beim Kunden. Eine Absage kostet nichts.",
    mailEvent: "termin_erinnerung",
    zahlen: ["43 von 120 Terminen verpasst; höchste Quote 76 % (26.08.2026)"],
  },
  // ── DIE SIEBEN SCHRITTE — AUS DER ECHTEN AGENDA ──────────────────────────
  ...AGENDA.map((a, i): Kapitel => ({
    key: `agenda-${a.key}`,
    was: `Schritt ${i + 1} von ${AGENDA.length}: ${a.titel}`,
    wer: "onboarding",
    // ── DIE FELDNAMEN AUS DER ECHTEN AGENDA ────────────────────────────
    // Ein erster Entwurf griff auf `a.leitfaden` und `a.warum` zu — die gibt es
    // dort nicht. Die Agenda führt `zweck` (ein Satz) und `punkte` (zwei bis
    // drei Stichpunkte zum Vorlesen). Wer eine fremde Datenform benutzt, liest
    // erst ihre Schnittstelle; geraten wäre `undefined` in der Schulung.
    text: a.zweck,
    punkte: a.punkte,
    warum: a.notizPflicht
      ? `Pflichtschritt: ${a.zweck} Ohne Notiz lässt sich das Gespräch nicht `
        + `abschließen — ${a.notizFrage ?? "die Antwort des Kunden gehört ins Protokoll"}.`
      : a.zweck,
    weg: { pfad: "/agent/startgespraeche", label: "Das Onboarding-Cockpit" },
    quelle: "shared/fiaon-onboarding-agenda.ts",
    zahlen: a.notizPflicht
      ? ["Pflichtschritt — ohne Notiz lässt sich das Gespräch nicht abschließen"]
      : undefined,
  })),
  kernbotschaft("onboarding",
    "Im Startgespräch hört der Kunde diesen Satz zum ersten Mal von einem "
    + "Menschen. Vorher stand er in einer Mail. Wer ihn hier klar sagt, "
    + "verhindert den Anruf in drei Monaten: „Das wusste ich nicht.“ Und wer die "
    + "Meldung an die SCHUFA verschweigt, macht aus einer offenen Rate einen "
    + "Vorwurf gegen uns."),
  {
    key: "abschluss",
    was: "Erst wenn alle Pflichtschritte stehen, lässt sich das Gespräch abschließen.",
    wer: "onboarding",
    text: "Das Cockpit prüft die Agenda. Fehlt eine Pflichtnotiz — allen voran „Abo-"
      + "Klarheit“ —, bleibt der Abschluss-Knopf gesperrt und nennt, was fehlt.",
    warum: "Die Abo-Klarheit steht bewusst spät: Wer sie zu früh bringt, klingt wie ein "
      + "Verkäufer, der noch etwas nachschieben will. Und ohne sie gibt es später Streit "
      + "über laufende Kosten — dann ist es das Wort des Kunden gegen unsere Notiz.",
    weg: { pfad: "/agent/startgespraeche", label: "Abschluss im Cockpit" },
    quelle: "shared/fiaon-onboarding-agenda.ts",
  },
  {
    key: "freischaltung",
    was: "Das Konto wird freigeschaltet — und der Kunde erfährt es sofort.",
    wer: "onboarding",
    text: "Mit dem Abschluss fällt das Gate. Der Kunde sieht seinen Fahrplan, kann "
      + "Unterlagen hochladen und die Analyse anstoßen. Die Mail sagt in einem Satz, "
      + "was jetzt offen ist.",
    warum: "Zwischen Gespräch und Freischaltung darf keine Stunde liegen. Wer nach einem "
      + "guten Gespräch vor einer gesperrten Seite sitzt, glaubt dem Gespräch nicht mehr.",
    mailEvent: "account_activated",
  },
  {
    key: "gutschrift",
    was: "Für das geführte Startgespräch entstehen 15 € Vergütung.",
    wer: "automatik",
    text: "Je abgeschlossenem Onboarding-Gespräch wird eine Gutschrift von 15 € gebucht — "
      + "genau einmal je Kunde, mit einem eindeutigen Index als Wand.",
    warum: "Eine Vergütung, die zweimal entstehen kann, entsteht irgendwann zweimal. Die "
      + "Grenze gehört in die Datenbank: Zwei gleichzeitige Abschlüsse lesen beide „noch "
      + "keine da“.",
    weg: { pfad: "/admin/team", label: "Vergütungen in der Team-Zentrale" },
    quelle: "db/migrations/057_onboarding_verguetung.sql",
  },
  {
    key: "no-show",
    was: "Erscheint der Kunde nicht, bekommt er eine neue Einladung — nicht eine Mahnung.",
    wer: "automatik",
    text: "Ein verpasster Termin wird als „verpasst“ markiert. Danach geht eine neue "
      + "Einladung raus, gestaffelt über höchstens 50 Mails am Tag.",
    warum: "GEMESSEN: 336 bezahlte Kunden hatten keinen Termin, die ältesten seit dem "
      + "04.07.2026 — und waren nie eingeladen worden. Ein Mensch, der einen Termin "
      + "verpasst, ist kein Fall für Druck, sondern für einen zweiten Anlauf.",
    mailEvent: "onboarding_einladung",
    zahlen: ["336 bezahlte Kunden ohne Termin, älteste Zahlung 04.07.2026 (26.08.2026)"],
    weg: { pfad: "/admin/termine", label: "Termin-Zentrale, Karte unten" },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REISE 3 — FORDERUNGSMANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
const INKASSO: Kapitel[] = [
  {
    key: "abo-zyklus",
    was: "Am Jahrestag der ersten Zahlung entsteht die nächste Rate — automatisch.",
    wer: "automatik",
    text: "Jedes Abo-Paket erzeugt eine monatliche Rate mit dem Preis aus dem Katalog. "
      + "Rechnung und Zahlungsaufforderung gehen ohne Zutun raus. Die Bonitätsauskunft "
      + "erzeugt nie eine Rate — sie ist ein Einmalkauf.",
    warum: "Wer Raten von Hand anlegt, vergisst sie. Und wer sie doppelt anlegt, mahnt "
      + "einen Kunden für Geld, das er nicht schuldet — das kostet mehr als die Rate.",
    mailEvent: "abo_payment_reminder",
    quelle: "server/lib/fiaon-abo-pflicht.ts",
  },
  {
    key: "t-plus-1",
    was: "Einen Tag nach Fälligkeit gilt die Rate als überfällig.",
    wer: "automatik",
    text: "Nicht am Tag selbst — Banken brauchen Zeit. Am Tag danach wechselt der "
      + "Zustand, und die Rate erscheint in der Arbeitsliste des Forderungsmanagements.",
    warum: "Wer am Fälligkeitstag mahnt, mahnt Menschen, deren Überweisung unterwegs ist. "
      + "Jede solche Mahnung erzeugt einen Anruf, der Zeit kostet und Vertrauen.",
    quelle: "server/lib/fiaon-abo-pflicht.ts",
  },
  {
    key: "zuteilung",
    was: "Die überfällige Rate bekommt einen Menschen zugeteilt.",
    wer: "leitung",
    text: "Nicht „das Team“ — ein Name. Die Zuteilung entscheidet, wer anruft, wer die "
      + "Zusage dokumentiert und wessen Prämie an der eingezogenen Rate hängt.",
    warum: "Eine Aufgabe, die allen gehört, gehört niemandem. Und ohne Zuteilung lässt "
      + "sich hinterher nicht sagen, ob die Rate an der Forderung oder am Zufall hing.",
    weg: { pfad: "/agent/inkasso", label: "Die Arbeitsliste" },
  },
  {
    key: "arbeitsliste",
    was: "Die Liste ist nach Mahnstufe sortiert — nicht nach Betrag.",
    wer: "inkasso",
    text: "Oben stehen die Fälle mit der höchsten Stufe, also die längst offenen. Wer von "
      + "oben abarbeitet, verhindert Eskalationen, statt große Beträge zu jagen.",
    warum: "Nach Betrag zu sortieren fühlt sich richtig an und ist falsch: Ein kleiner "
      + "Betrag, der drei Monate liegt, wird zum Rechtsfall. Ein großer, der zwei Tage "
      + "offen ist, kommt meist von selbst.",
    weg: { pfad: "/agent/inkasso", label: "Mahnstufen-Reihenfolge" },
  },
  {
    key: "ergebnisse",
    was: "Jedes Gespräch endet mit einem Ergebnis — und jedes löst etwas aus.",
    wer: "inkasso",
    text: "„Zusage“ merkt sich das Datum und legt eine Wiedervorlage auf den Tag danach. "
      + "„Beleg erhalten“ setzt die Rate auf gemeldet und wartet auf den Kontoabgleich. "
      + "„Nicht erreicht“ zählt hoch und verschickt eine Erinnerung. „Eskalation“ hebt "
      + "die Mahnstufe.",
    warum: "Ohne festgehaltenes Ergebnis ruft der nächste Mitarbeiter denselben Menschen "
      + "an und fragt dasselbe. Beim dritten Mal legt der Kunde auf — und zahlt dann "
      + "sicher nicht.",
    weg: { pfad: "/agent/inkasso", label: "Raten-Ergebnisse" },
  },
  {
    key: "mahnstufen",
    was: "Die Mahnmails werden strenger — im Inhalt, nicht im Ton.",
    wer: "automatik",
    text: "Stufe eins erinnert. Stufe zwei nennt die Folgen. Stufe drei setzt eine Frist. "
      + "Jede Stufe steht in der Registry und lässt sich im Sende-Menü in echt ansehen, "
      + "bevor sie rausgeht.",
    warum: "Eine Mahnung, die droht, erzeugt Widerstand. Eine, die die Folge sachlich "
      + "nennt, erzeugt eine Überweisung. Der Unterschied liegt in zwei Wörtern pro Satz.",
    mailEvent: "payment_reminder",
    weg: { pfad: "/admin/events", label: "E-Mail-Events, Vorschau" },
  },
  {
    key: "wuerdevoll",
    was: "Wir sprechen mit Menschen, die Geld schulden — nicht mit Schuldnern.",
    wer: "inkasso",
    text: "Keine Drohung, keine Belehrung, kein Duzen von oben. Wer nicht zahlen kann, "
      + "bekommt eine Rate angeboten. Wer nicht zahlen will, bekommt die Folgen genannt — "
      + "einmal, sachlich.",
    warum: "Die meisten offenen Raten sind Vergessenheit oder Engpass, nicht Absicht. Wer "
      + "alle wie Betrüger behandelt, verliert die Zahlungswilligen und überzeugt die "
      + "anderen trotzdem nicht.",
    quelle: "server/lib/fiaon-inkasso-richtlinie.ts",
  },
  {
    key: "verguetung",
    was: "Die Vergütung besteht aus Stunden plus Prämie je eingezogener Rate.",
    wer: "leitung",
    text: "Die Stunden werden erfasst, die Prämie entsteht mit der verbuchten Zahlung — "
      + "nicht mit der Zusage. Beides steht in der Team-Zentrale, für jeden Mitarbeiter "
      + "einsehbar.",
    warum: "Eine Prämie auf Zusagen belohnt Versprechen. Sie entsteht deshalb erst, wenn "
      + "das Geld da ist — dann belohnt sie das Ergebnis.",
    weg: { pfad: "/admin/team", label: "Team-Zentrale, Vergütung" },
  },
  {
    key: "sperre",
    was: "Zahlt der Kunde dauerhaft nicht, wird das Konto stillgelegt — nicht gelöscht.",
    wer: "automatik",
    text: "Nach der letzten Mahnstufe ohne Reaktion wird gesperrt. Der Kunde behält seine "
      + "Daten und kann jederzeit zurückkommen: Eine Zahlung reaktiviert das Konto.",
    warum: "Ein gelöschter Kunde kommt nie zurück. Ein gesperrter zahlt in einem Drittel "
      + "der Fälle Monate später — deshalb gibt es in diesem Haus keine Hard-Deletes.",
    mailEvent: "account_suspended",
  },
];

/**
 * Das Abschluss-Kapitel — „Du bist bereit".
 *
 * ── WARUM ES DIESELBE FORM HAT WIE DIE ANDEREN ────────────────────────────
 * Es könnte ein Sonderfall in der Anzeige sein. Als Kapitel ist es besser: Die
 * Fortschrittsleiste zählt es mit („Kapitel 13 / 13"), die Punkte-Navigation
 * kennt es, und der Prüfstand prüft es wie jedes andere.
 */
function abschluss(r: { titel: string; kapitelZahl: number; dauerMin: number }): Kapitel {
  return {
    key: "bereit",
    was: "Du bist bereit.",
    wer: "leitung",
    text: `${r.kapitelZahl} Kapitel, ${r.dauerMin} Minuten — das ist der ganze Ablauf `
      + `im Bereich ${r.titel}. Nichts davon musst du auswendig können: Jeder Schritt `
      + "steht im System an der Stelle, an der du ihn brauchst.",
    warum: "Eine Einschulung ohne Abschluss endet mit dem Satz „so, das war's“ — und "
      + "genau so bleibt sie im Gedächtnis. Wer weiß, dass er fertig ist, fängt an.",
    punkte: [
      "Was du nicht weißt, fragst du — lieber einmal zu oft als einen Kunden verlieren.",
      "Jeder Schritt hier ist aus einem echten Fehler entstanden. Sie sind alle "
        + "einmal teuer geworden.",
      "Und: Was dir auffällt, meldest du. Die Hälfte dieser Kapitel gibt es, weil "
        + "jemand etwas gemeldet hat.",
    ],
  };
}

/**
 * Das Kernbotschafts-Kapitel.
 *
 * Es steht in der Vertriebs- UND der Onboarding-Reise — an unterschiedlicher
 * Stelle, weil es unterschiedlich gebraucht wird: Im Vertrieb ist es das
 * VERSPRECHEN, das man gibt; im Onboarding ist es die KONSEQUENZ, die man
 * erklären muss.
 *
 * `hervorgehoben` markiert es für die Anzeige: zweigeteilte Karte, groß,
 * unübersehbar.
 */
function kernbotschaft(wer: Handelnder, warum: string): Kapitel {
  return {
    key: "versprechen",
    was: "Das Versprechen — und die Konsequenz.",
    wer,
    // Der Wortlaut, unverändert. Er ist der Kapiteltext, nicht eine Zusammenfassung.
    text: KERNBOTSCHAFT,
    warum,
    hervorgehoben: true,
    punkte: [
      ...KERNBOTSCHAFT_PFADE.aufbau.punkte,
      ...KERNBOTSCHAFT_PFADE.meldung.punkte,
    ],
  };
}

export const REISEN: Reise[] = [
  {
    key: "vertrieb",
        // Blau — die Farbe des Hauses.
    ton: { akzent: "#5b8cff", hell: "#c3d5ff",
           verlauf: "radial-gradient(circle, rgba(91,140,255,.22), transparent 62%)" },
    titel: "Vertrieb",
    unterzeile: "Vom Facebook-Formular bis zur verbuchten Zahlung — und was das System "
      + "dabei von selbst tut.",
    dauerMin: 12,
    fuerRollen: ["admin", "vertriebsleiter", "agent"],
    // Das Abschluss-Kapitel wird angehängt, nicht abgeschrieben — so trägt es
    // automatisch die richtige Kapitelzahl.
    kapitel: [...VERTRIEB, abschluss({ titel: "Vertrieb", kapitelZahl: VERTRIEB.length + 1, dauerMin: 12 })],
  },
  {
    key: "onboarding",
        // Türkis-Blau: Das Onboarding ist der Übergang vom Verkauf zur Betreuung —
    // die Farbe liegt bewusst zwischen dem Vertriebsblau und dem Grün der
    // bestätigten Zahlen.
    ton: { akzent: "#3fd0d4", hell: "#a8f0f2",
           verlauf: "radial-gradient(circle, rgba(63,208,212,.20), transparent 62%)" },
    titel: "Onboarding",
    unterzeile: "Die fünfzehn Minuten, die entscheiden, ob ein zahlender Kunde bleibt.",
    dauerMin: 15,
    fuerRollen: ["admin", "vertriebsleiter", "onboarding"],
    // Das Abschluss-Kapitel wird angehängt, nicht abgeschrieben — so trägt es
    // automatisch die richtige Kapitelzahl.
    kapitel: [...ONBOARDING, abschluss({ titel: "Onboarding", kapitelZahl: ONBOARDING.length + 1, dauerMin: 15 })],
  },
  {
    key: "inkasso",
        // Violett-Navy: ernst, aber nicht bedrohlich. Rot wäre falsch — wir
    // sprechen mit Menschen, die Geld schulden, nicht mit Schuldnern.
    ton: { akzent: "#9d8cff", hell: "#d6cdff",
           verlauf: "radial-gradient(circle, rgba(157,140,255,.20), transparent 62%)" },
    titel: "Forderungsmanagement",
    unterzeile: "Offene Raten einziehen, ohne Menschen zu verlieren.",
    dauerMin: 10,
    fuerRollen: ["admin", "vertriebsleiter", "inkasso"],
    // Das Abschluss-Kapitel wird angehängt, nicht abgeschrieben — so trägt es
    // automatisch die richtige Kapitelzahl.
    kapitel: [...INKASSO, abschluss({ titel: "Forderungsmanagement", kapitelZahl: INKASSO.length + 1, dauerMin: 10 })],
  },
];

export function reise(key: string): Reise | null {
  return REISEN.find((r) => r.key === key) ?? null;
}

/**
 * Die Reisen, die eine Rolle sehen soll.
 *
 * ── HEUTE UNGENUTZT, ABER VORBEREITET ──────────────────────────────────────
 * Der Auftrag sagt ausdrücklich: Die Route soll rollen-gefiltert
 * wiederverwendbar sein, aber NOCH NICHT im Team-Portal ausgerollt. Diese
 * Funktion ist der Anschlusspunkt — sie steht hier, damit die Filterregel an
 * EINER Stelle liegt, wenn es soweit ist.
 */
export function reisenFuerRolle(rolle: string): Reise[] {
  return REISEN.filter((r) => r.fuerRollen.includes(rolle));
}

/** Alle Registry-Ereignisse, die in Kapiteln vorkommen — für den Prüfstand. */
export function verwendeteMailEvents(): string[] {
  return Array.from(new Set(
    REISEN.flatMap((r) => r.kapitel.map((k) => k.mailEvent).filter((v): v is string => !!v)),
  )).sort();
}
