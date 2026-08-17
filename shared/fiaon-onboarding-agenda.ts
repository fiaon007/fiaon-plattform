// ═══════════════════════════════════════════════════════════════════════════
// DIE AGENDA DES STARTGESPRÄCHS — sechs Schritte, kuratiert
//
// ── WARUM DIE TEXTE IM REPO STEHEN ─────────────────────────────────────────
// Ein Startgespräch, das jeder anders führt, ist sechsmal ein anderes Produkt.
// Der Kunde erzählt seinem Bekannten davon, der Bekannte ruft an und bekommt
// etwas anderes zu hören. Deshalb stehen die Stichpunkte hier und nicht im
// Kopf des Mitarbeiters — und deshalb sind sie in `shared/`: Das Cockpit zeigt
// sie, der Prüfstand prüft sie.
//
// ── WORTHYGIENE, UND SIE IST NICHT VERHANDELBAR ────────────────────────────
// Die 74 € sind eine BONITÄTSAUSKUNFT. Kein Rat, keine Beratung, keine
// Empfehlung, keine Bewertung. Wer im Gespräch „wir beraten Sie" oder „wir
// verbessern Ihren Score" sagt, verspricht eine Leistung, die wir nicht
// erbringen — und begibt sich in einen Bereich, der erlaubnispflichtig ist.
//
// Erlaubt: „Auskunft", „Übersicht", „Handlungsplan", „Sie sehen".
// Verboten: „Beratung", „wir beraten", „Empfehlung", „wir verbessern",
//           „Garantie", „sicher", „auf jeden Fall".
//
// Die Liste unten wird vom Prüfstand gegen den Text jedes Schritts geprüft.
// Ein Wort, das man nicht sagen soll, gehört in eine Prüfung — nicht in eine
// Schulung, die man vergisst.
// ═══════════════════════════════════════════════════════════════════════════

export interface AgendaSchritt {
  /** Stabiler Schlüssel — er landet in `fiaon_termine.agenda_stand`. */
  key: string;
  /** Die Überschrift, die der Mitarbeiter sieht. */
  titel: string;
  /** Ein Satz: worum es in diesem Schritt geht. */
  zweck: string;
  /**
   * Zwei bis drei Stichpunkte ZUM VORLESEN bzw. Vorzeigen. Bewusst kurz:
   * Wer einen Absatz vorliest, klingt vorgelesen.
   */
  punkte: string[];
  /** Braucht dieser Schritt zwingend eine Notiz? */
  notizPflicht?: boolean;
  /** Was in die Notiz gehört — als Platzhalter im Feld. */
  notizFrage?: string;
}

export const AGENDA: AgendaSchritt[] = [
  {
    key: "begruessung",
    titel: "Begrüßung & Erwartung klären",
    zweck: "Der Kunde soll wissen, wer anruft, wie lange es dauert und was danach passiert.",
    punkte: [
      "Name, FIAON, und: „Ich habe fünfzehn Minuten für Sie eingeplant.“",
      "„Danach ist Ihr Konto vollständig freigeschaltet — Sie sehen dann auch Ihren Fahrplan.“",
      "Fragen: Was erwarten Sie von uns? Was ist Ihr Ziel?",
    ],
    notizPflicht: true,
    notizFrage: "Was ist das Ziel des Kunden, in seinen Worten?",
  },
  {
    key: "tour",
    titel: "Plattform-Tour — was er wo findet",
    zweck: "Einmal gemeinsam durchklicken. Wer den Weg einmal gegangen ist, findet ihn wieder.",
    punkte: [
      "Übersicht: sein Stand auf einen Blick. Fahrplan: die Schritte. Unterlagen: was fehlt.",
      "„Mein Konto“: Adresse und Telefonnummer kann er selbst ändern — bitte tun, wenn sich was ändert.",
      "Hilfe-Bereich zeigen: dort steht, wie er uns erreicht.",
    ],
  },
  {
    key: "fahrplan",
    titel: "Fahrplan erklärt",
    zweck: "Der Fahrplan ist der Grund für dieses Gespräch. Er wird erklärt, nicht vorgelesen.",
    punkte: [
      "Die Schritte in der Reihenfolge, in der sie für IHN kommen — nicht die allgemeine Liste.",
      "Was er selbst tun muss, und was wir tun. Wo er wartet, und auf wen.",
      "Ehrlich zu Zeiträumen: keine Zusage, die von Dritten abhängt.",
    ],
    notizPflicht: true,
    notizFrage: "Bei welchem Schritt steht der Kunde, und was ist sein nächster?",
  },
  {
    key: "unterlagen",
    titel: "Unterlagen: was fehlt, wie hochladen",
    zweck: "Fehlende Unterlagen sind der häufigste Grund, warum es nicht weitergeht.",
    punkte: [
      "Konkret sagen, WAS fehlt — nicht „Ihre Unterlagen“, sondern „Kontoauszug der letzten drei Monate“.",
      "Den Upload-Weg zeigen: Unterlagen → hochladen. Handy-Foto reicht, wenn alles lesbar ist.",
      "Bank-Anleitung erwähnen: dort steht, wie er den Auszug bei SEINER Bank herunterlädt.",
    ],
  },
  {
    key: "bonitaet",
    titel: "Bonitätsauskunft erklärt (74 €)",
    zweck: "Eine Auskunft, kein Rat. Der Kunde entscheidet selbst — und weiß, wie er zahlt.",
    punkte: [
      "Was er bekommt: eine tagesaktuelle Auskunft über seine Bonität, plus einen Handlungsplan.",
      "Der Abruf ist neutral — er verändert seinen Score nicht.",
      "74 € einmalig, kein Abo. Den Zahlweg im Portal zeigen: Verwendungszweck ist Pflicht.",
    ],
    notizFrage: "Wollte der Kunde die Auskunft? Wenn nein: warum nicht?",
  },
  {
    key: "abschluss",
    titel: "Nächste Schritte & Erreichbarkeit",
    zweck: "Das Gespräch endet mit einer Verabredung, nicht mit einem Gruß.",
    punkte: [
      "Zusammenfassen: „Sie machen X, wir machen Y, wir hören voneinander am Z.“",
      "Wie er uns erreicht — und dass er sich melden soll, bevor etwas hakt.",
      "„Ihr Konto ist ab jetzt vollständig freigeschaltet.“",
    ],
    notizPflicht: true,
    notizFrage: "Was wurde konkret verabredet?",
  },
];

/**
 * Wörter, die in diesen Texten NICHT vorkommen dürfen.
 *
 * Der Prüfstand geht damit über jeden Schritt. Eine Regel, die nur in einer
 * Schulung steht, gilt bis zur ersten Vertretung.
 */
export const VERBOTENE_WORTE = [
  "beraten", "beratung", "empfehlung", "empfehlen",
  "garantie", "garantiert", "sicher zu", "auf jeden fall",
  "score verbessern", "verbessern ihren", "bonitätsberatung",
] as const;

/** Prüft einen Text auf Worthygiene. Gibt die gefundenen Verstöße zurück. */
export function worthygiene(text: string): string[] {
  const t = text.toLowerCase();
  return VERBOTENE_WORTE.filter((w) => t.includes(w));
}

/** Der Schlüssel-Satz aller Schritte — für die Fortschrittsrechnung. */
export const AGENDA_KEYS = AGENDA.map((a) => a.key);

/** Wie viele Schritte müssen abgehakt sein, damit ein Gespräch „geführt" ist? */
export const AGENDA_PFLICHT = AGENDA.filter((a) => a.notizPflicht).map((a) => a.key);

export interface AgendaStand {
  /** Abgehakte Schritte. */
  erledigt: string[];
  /** Notizen je Schritt. */
  notizen: Record<string, string>;
}

/** Der Fortschritt in Prozent — an einer Stelle gerechnet. */
export function fortschritt(stand: AgendaStand): number {
  if (AGENDA_KEYS.length === 0) return 0;
  const getan = AGENDA_KEYS.filter((k) => stand.erledigt.includes(k)).length;
  return Math.round((getan / AGENDA_KEYS.length) * 100);
}

/**
 * Darf abgeschlossen werden?
 *
 * Die Pflichtschritte brauchen eine Notiz von mindestens zehn Zeichen. Ein
 * Gespräch, von dem nichts festgehalten ist, hat für den nächsten Menschen am
 * Telefon nicht stattgefunden.
 */
export function darfAbschliessen(stand: AgendaStand): { ok: boolean; fehlt: string[] } {
  const fehlt: string[] = [];
  for (const key of AGENDA_PFLICHT) {
    if (!stand.erledigt.includes(key)) {
      fehlt.push(AGENDA.find((a) => a.key === key)?.titel ?? key);
      continue;
    }
    if ((stand.notizen[key] ?? "").trim().length < 10) {
      fehlt.push(`${AGENDA.find((a) => a.key === key)?.titel ?? key} (Notiz fehlt)`);
    }
  }
  return { ok: fehlt.length === 0, fehlt };
}
