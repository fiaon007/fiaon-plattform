// ═══════════════════════════════════════════════════════════════════════════
// DER GESPRÄCHS-MODUS — genau eine Sache auf einmal (25.08.2026, Justins §10)
//
// Die Frage hinter diesem Bauvorhaben: „Kann ein Mitarbeiter ohne Erklärung
// erkennen, was er als Nächstes tun muss?" Während eines Telefonats ist die
// Antwort bisher NEIN gewesen: Die Akte zeigt sieben Reiter, den Verlauf, die
// Zahlungen — alles gleichzeitig, nichts zuerst. Wer telefoniert, hat aber
// keine freie Hand und keinen freien Kopf.
//
// Der Gesprächs-Modus zeigt deshalb GENAU EINEN Schritt. Erst wenn der
// Mitarbeiter ihn abhakt, kommt der nächste. Die Schritte hängen an der Lage
// des Kunden (KundenSituation.art, neun Arten) — dieselbe Quelle, die auch
// die Fokus-Kachel und die Leitfäden speist. Eine zweite Wahrheit über „was
// jetzt zu tun ist" wäre der Anfang vom Ende.
//
// Diese Datei ist bewusst REIN (keine Abhängigkeiten): Der Prüfstand kann sie
// vollständig durchrechnen, und Client wie Server lesen dieselben Schritte.
// ═══════════════════════════════════════════════════════════════════════════

/** Ein Reiter der Akte, zu dem ein Schritt springen kann. */
export type SchrittReiter = "antrag" | "daten" | "zahlungen" | "dokumente" | "gespraeche";

export interface GespraechsSchritt {
  /** Kurz und imperativ — steht groß auf der Karte. */
  titel: string;
  /** Ein Satz, der sagt WIE — oder was man wörtlich sagen kann. */
  satz: string;
  /** Öffnet beim Anklicken diesen Reiter der Akte. */
  reiter?: SchrittReiter;
}

/**
 * Die Schritte je Lage. Reihenfolge = Gesprächsreihenfolge.
 * Der LETZTE Schritt ist immer derselbe Gedanke: Das Ergebnis wird nach dem
 * Auflegen gebucht — dafür gibt es die Daumen-Frage der Anruf-Bühne, deshalb
 * steht hier kein eigener „Ergebnis"-Schritt.
 */
export const GESPRAECHS_SCHRITTE: Record<string, GespraechsSchritt[]> = {
  lead_ohne_antrag: [
    { titel: "Interesse prüfen.", satz: "„Sie hatten sich bei uns nach einem Rahmen erkundigt — passt es gerade?“ Erst zuhören, dann anbieten." },
    { titel: "Daten aufnehmen.", satz: "Name, Geburtsdatum, Anschrift, E-Mail — direkt im Antrag ergänzen, nicht auf einem Zettel.", reiter: "antrag" },
    { titel: "Bonitätsauskunft verkaufen.", satz: "74 € — sie ist die Grundlage für alles Weitere. Paket am Telefon annehmen lassen.", reiter: "daten" },
  ],
  zahlung_gemeldet: [
    { titel: "Zahlung verifizieren.", satz: "Wann überwiesen, von welcher Bank, mit welcher Referenz? Erst prüfen, dann danken.", reiter: "zahlungen" },
    { titel: "Nächsten Schritt setzen.", satz: "Sobald das Geld da ist, folgt das Startgespräch — den Termin gleich jetzt anbieten." },
  ],
  rechnung_offen: [
    { titel: "An die Rechnung erinnern.", satz: "Betrag und Verwendungszweck nennen — beides steht im Zahlungen-Reiter.", reiter: "zahlungen" },
    { titel: "Zahlweg klären.", satz: "Zahlungsdaten per E-Mail oder WhatsApp senden — der Knopf ist in der Akte." },
    { titel: "Zusage mit Datum holen.", satz: "Nicht „bald“, sondern ein Tag. Ohne Datum lässt sich nicht nachfassen." },
  ],
  rate_ueberfaellig: [
    { titel: "Die Rate ansprechen.", satz: "Ruhig und konkret: welche Rate, wie viel, seit wann. Kein Vorwurf — ein Angebot, es zu lösen.", reiter: "zahlungen" },
    { titel: "Lösung vereinbaren.", satz: "Heute zahlen oder ein festes Datum. Bei Engpass: eine Rate aussetzen ist besser als Schweigen." },
    { titel: "Zusage festhalten.", satz: "Das Datum kommt beim Auflegen in die Daumen-Frage — es wird automatisch nachgefasst." },
  ],
  zusage_gebrochen: [
    { titel: "Auf die Zusage beziehen.", satz: "„Wir hatten den … vereinbart — ist etwas dazwischengekommen?“ Zuhören, nicht mahnen." },
    { titel: "Neue, engere Zusage.", satz: "Kleinerer Betrag mit echtem Datum schlägt großes Versprechen ohne Termin." },
  ],
  rueckruf_faellig: [
    { titel: "An das letzte Gespräch anknüpfen.", satz: "Der Verlauf sagt, wo ihr stehen geblieben seid — kurz reinsehen, bevor du sprichst.", reiter: "gespraeche" },
    { titel: "Den offenen Punkt schließen.", satz: "Genau das eine Thema zu Ende bringen, wegen dem der Rückruf vereinbart war." },
  ],
  bezahlt_ohne_termin: [
    { titel: "Danken — und das Startgespräch anbieten.", satz: "Die Zahlung ist da. Jetzt fehlt nur der Termin, mit dem die Betreuung wirklich beginnt." },
    { titel: "Termin direkt buchen.", satz: "Nicht auf den Link verweisen — im Gespräch zwei Vorschläge machen und sofort eintragen." },
  ],
  termin_heute: [
    { titel: "Dem Leitfaden des Termins folgen.", satz: "Der heutige Termin hat eine Gesprächsart — ihr Leitfaden steht in der Akte bereit." },
    { titel: "Das Ziel des Termins erreichen.", satz: "Ein Termin ohne Ergebnis ist ein verlorener Platz im Kalender — halte fest, was vereinbart wurde." },
  ],
  alles_gut: [
    { titel: "Anliegen erfragen.", satz: "Bei diesem Menschen ist nichts offen — klären, worum es geht, und es im Verlauf notieren." },
  ],
};

/** Die Schritte zur Lage — mit sicherem Rückfall, falls eine neue Lage dazukommt. */
export function schritteFuer(art: string | null | undefined): GespraechsSchritt[] {
  return GESPRAECHS_SCHRITTE[String(art ?? "")] ?? GESPRAECHS_SCHRITTE.alles_gut;
}
