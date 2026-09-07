// ═══════════════════════════════════════════════════════════════════════════
// DIE AGENDA DES STARTGESPRÄCHS — die Schritte, kuratiert
//
// ── WARUM DIE TEXTE IM REPO STEHEN ─────────────────────────────────────────
// Ein Startgespräch, das jeder anders führt, ist jedes Mal ein anderes Produkt.
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
      "„Danach ist Ihr Konto vollständig nutzbar — Sie sehen dann auch Ihren Fahrplan.“",
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
  // ═════════════════════════════════════════════════════════════════════
  // ABO-KLARHEIT — DER PFLICHTSCHRITT (18.08.2026)
  //
  // ── DER AUFTRAG DES BETREIBERS ──────────────────────────────────────
  // „Ein Pflichtpunkt: Der Kunde bestätigt, dass er versteht, dass es ein
  // laufendes Abo ist, wie es kündbar ist, und dass die Bonitätsauskunft
  // einmalig extra kostet."
  //
  // ── WARUM ER VOR DEM ABSCHLUSS STEHT UND NICHT DANACH ───────────────
  // Nach dem Abschluss („Ihr Konto ist freigeschaltet") ist der Kunde
  // gedanklich fertig. Wer DANN noch über Zahlungspflichten spricht, klingt,
  // als hätte er etwas zurückgehalten. Vor dem Abschluss ist es Teil der
  // Aufklärung; danach wäre es ein Nachtrag.
  //
  // ── WARUM DAS DER TEUERSTE MISSVERSTAND IST ─────────────────────────
  // Jede Rückbuchung, jede Beschwerde und jeder Inkassofall dieses Hauses
  // beginnt mit demselben Satz: „Ich dachte, das war einmalig." Fünfzehn
  // Sekunden im Startgespräch verhindern Monate Auseinandersetzung. Deshalb
  // ist dieser Schritt nicht nur Pflicht, er verlangt auch eine NOTIZ — der
  // Mitarbeiter muss festhalten, dass der Kunde es bestätigt hat.
  // ═════════════════════════════════════════════════════════════════════
  {
    key: "abo_klarheit",
    titel: "Abo-Klarheit — laufende Kosten bestätigen",
    zweck: "Der häufigste Streitfall beginnt mit „Ich dachte, das war einmalig\u201c. "
      + "Dieser Schritt räumt ihn aus, bevor er entsteht.",
    punkte: [
      "„Ihr Paket ist ein laufendes Abo: Der Betrag kommt jeden Monat, nicht einmalig.“ "
        + "Den Betrag NENNEN und das Datum der nächsten Abbuchung.",
      "„Kündbar zum Ende des laufenden Monats — schriftlich per E-Mail, formlos, "
        + "kein Grund nötig.“ Keine Mindestlaufzeit erfinden.",
      "„Die Bonitätsauskunft ist davon getrennt: 74 € EINMALIG, kein Abo.“ "
        + "Wenn er sie nicht will, ändert das nichts an seinem Paket.",
      "Rückfragen: „Ist das so für Sie in Ordnung?“ — die Antwort in die Notiz.",
    ],
    notizPflicht: true,
    notizFrage: "Hat der Kunde die laufenden Kosten und den Kündigungsweg bestätigt? Wörtlich, was er gesagt hat.",
  },
  // ═════════════════════════════════════════════════════════════════════
  // ANSPRÜCHE PRÜFEN — DER SCHRITT MIT DEM ERGEBNIS (06.09.2026, Scheibe 7)
  //
  // ── WARUM ER DAZUKOMMT ──────────────────────────────────────────────
  // Lücken-Audit 06.09.2026: 393 von 521 zahlenden Kunden hängen an
  // Schritt 3, dem Startgespräch. Das Gespräch endete bis dahin ohne
  // etwas, das man in die Hand nehmen kann — den Anspruchs-Check gab es
  // nur im Kundenbereich, nicht im Cockpit. Der Kunde legte auf und hatte
  // ein nettes Gespräch gehabt. Danach nichts.
  //
  // ── WAS DIESER SCHRITT ANDERS MACHT ─────────────────────────────────
  // Danach steht in der Akte UND in seinem Bereich DIESELBE Liste mit
  // denselben Beträgen — gerechnet aus denselben zehn Antworten, mit
  // derselben Funktion (shared/fiaon-ansprueche.ts). Nicht zwei Listen,
  // die auseinanderlaufen: eine.
  //
  // ── KEINE PFLICHTNOTIZ, ABER EINE PFLICHT ───────────────────────────
  // Das Ergebnis dieses Schritts sind Daten, keine Prosa: Der Schritt gilt
  // als erledigt, wenn ALLE Fragen beantwortet sind (die Zahl steht in
  // shared/fiaon-ansprueche.ts, nicht hier) — das hakt
  // das Cockpit selbst ab. Eine Notiz obendrauf ist freiwillig; erzwungen
  // wird, was zählt.
  //
  // ── DIE SPRACHREGEL IST BINDEND ─────────────────────────────────────
  // „Das können Sie beantragen. Über den Betrag entscheidet die Stelle.“
  // Nie „Ihnen stehen zu“, nie ein Betrag ohne die Stelle dahinter. Wer
  // hier eine Zusage macht, macht sie über fremdes Geld.
  //
  // ── WARUM ER AM ENDE STEHT UND NICHT IN DER MITTE ───────────────────
  // Der Check braucht die zehn ehrlichsten Antworten des Gesprächs —
  // Pfändung, Einkommen, Leistungsbezug. Die gibt niemand in Minute zwei.
  // Nach der Abo-Klarheit und der Verabredung ist das Vertrauen da; hier
  // kostet die Frage nach der Pfändung nichts mehr.
  // ═════════════════════════════════════════════════════════════════════
  {
    key: "ansprueche",
    titel: "Ansprüche prüfen",
    // ── WARUM DIESER ZWECK-SATZ NEUTRAL IST ─────────────────────────────
    // `zweck` bleibt nicht intern: client/src/pages/site/plattform-konzept.tsx
    // rendert Titel und Zweck jedes Agenda-Schritts ÖFFENTLICH (/plattform-konzept
    // und /en/how-the-platform-works), und shared/fiaon-wissen.ts gibt dieselbe
    // Zeile dem Kunden-Assistenten. Ein Satz in Mitarbeitersicht („in seiner
    // Akte“) stünde dort als achter Punkt zwischen sieben neutralen — und eine
    // zugesagte „Liste mit Beträgen“ wäre eine Zusage über fremdes Geld: Die
    // Liste kann leer sein, das Cockpit hat dafür einen eigenen Leerzustand.
    // Die Anweisungen an den Mitarbeiter stehen in `punkte`; die liest keine
    // öffentliche Seite.
    zweck: "Fragen zu Konto, Einkommen und Verträgen — danach steht in der Akte und im Kundenbereich dieselbe Liste dessen, was sich beantragen lässt. Über den Betrag entscheidet die zuständige Stelle.",
    punkte: [
      "Die Fragen stehen unten im Schritt, eine nach der anderen. Jede Antwort ist sofort gespeichert — auch wenn das Gespräch abbricht.",
      "Was schon im Antrag steht, liest du vor und fragst: „Stimmt das noch?“ Erst wenn er widerspricht, änderst du es. Nichts doppelt erheben.",
      "Am Ende die Liste vorlesen — Punkt, Betrag, Stelle. Wortlaut: „Das können Sie beantragen. Über den Betrag entscheidet die Stelle.“",
    ],
    notizPflicht: false,
    notizFrage: "Was ist herausgekommen, und was hat der Kunde dazu gesagt?",
  },
  // 07.09.2026 (TFO-Prüfung Scheibe 7): „Ansprüche prüfen“ steht VOR dem Abschluss —
  // die Agenda endet mit dem Abschluss (Prüfstand pruef-onboarding-pflicht), und ein
  // Gespräch, das nach dem Abschied noch zehn Fragen stellt, gibt es nicht.
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
