// ═══════════════════════════════════════════════════════════════════════════
// EINWAND-BAUSTEINE — kuratiert, nicht generiert
//
// WARUM DAS EINE DATENDATEI IST UND KEIN KI-ERGEBNIS
// Ein Sprachmodell, das man nach einer Antwort auf „ist das seriös?" fragt,
// schreibt beruhigende Sätze — und beruhigend heißt hier schnell „garantiert",
// „sicher", „kein Risiko". Genau diese drei Wörter dürfen nie fallen.
//
// Deshalb stehen die Antworten HIER, von Menschen geschrieben und geprüft. Die
// KI wählt nur aus, welche zur Lage passt. Sie formuliert sie nicht.
//
// Jeder Baustein hält sich an dieselben Regeln:
//   · Keine Zusage zu Limit, Bewilligung oder Ergebnis.
//   · Kein „Beratung", kein „Berater".
//   · Kein Druck, keine erfundene Knappheit, kein Ausnutzen einer Notlage.
//   · Er nennt, was FIAON TUT — nicht, was der Kunde bekommt.
// ═══════════════════════════════════════════════════════════════════════════

export interface Einwand {
  schluessel: string;
  /** Was der Kunde sagt — in seinen Worten, nicht in unseren. */
  sagt: string;
  /** Wann dieser Baustein passt. */
  wann: string;
  /** Die Antwort. Sprechbar, nicht ablesbar. */
  antwort: string;
}

export const EINWAENDE: Einwand[] = [
  {
    schluessel: "preis",
    sagt: "Das ist mir zu teuer.",
    wann: "Rechnung offen, Zahlung nicht gemeldet",
    antwort:
      "Das kann ich nachvollziehen — es ist Geld, das jetzt weggeht. Was du dafür bekommst, ist die "
      + "vollständige Auskunft plus einen Plan, in welcher Reihenfolge du die Einträge angehst. "
      + "Ob du das selbst zusammensuchst oder wir es für dich tun, ist am Ende eine Frage von Zeit. "
      + "Soll ich dir aufschlüsseln, was genau enthalten ist?",
  },
  {
    schluessel: "ueberlegen",
    sagt: "Ich muss noch überlegen.",
    wann: "Immer",
    antwort:
      "Klar, überleg in Ruhe. Damit du nicht mit offenen Fragen dasitzt: Was ist der Punkt, bei dem "
      + "du unsicher bist — der Preis, der Ablauf, oder was danach passiert? Dann kläre ich genau den, "
      + "und du entscheidest mit allen Informationen.",
  },
  {
    schluessel: "seriositaet",
    sagt: "Ist das seriös? Das klingt nach Abzocke.",
    wann: "Neu, noch nichts bezahlt",
    antwort:
      "Die Frage ist berechtigt, in dem Bereich gibt es viel Unseriöses. Was du prüfen kannst: "
      + "Wir haben ein Impressum mit ladungsfähiger Anschrift, du bekommst eine ordentliche Rechnung, "
      + "und du zahlst per Überweisung — kein Abo, das sich versteckt verlängert. "
      + "Schau dir das an und meld dich, wenn etwas nicht zusammenpasst.",
  },
  {
    schluessel: "schon_bezahlt",
    sagt: "Ich habe doch schon überwiesen.",
    wann: "Stufe A — Zahlung gemeldet, nicht gebucht",
    antwort:
      "Danke, dann ist sie unterwegs. Überweisungen brauchen ein bis zwei Bankarbeitstage, bis sie bei "
      + "uns ankommen. Wenn du mir den Beleg schickst — ein Bildschirmfoto aus dem Onlinebanking genügt —, "
      + "schalte ich dich sofort frei, ohne auf die Buchung zu warten.",
  },
  {
    schluessel: "kein_geld",
    sagt: "Ich habe gerade kein Geld.",
    wann: "Rechnung offen, Frist läuft oder ist abgelaufen",
    antwort:
      "Danke, dass du es offen sagst. Dann lass uns einen Zeitpunkt finden, der wirklich passt — "
      + "lieber ein Datum, das hält, als eine Zusage, die uns beide in zwei Wochen wieder hier hat. "
      + "Wann wäre es realistisch?",
  },
  {
    schluessel: "was_bringt_das",
    sagt: "Was bringt mir das konkret?",
    wann: "Immer",
    antwort:
      "Du bekommst deine vollständige Auskunft und daraus eine Reihenfolge: welcher Eintrag zuerst, "
      + "was sich womit verbessern lässt, was Zeit braucht. Was am Ende dabei herauskommt, hängt von "
      + "deinen Einträgen ab — das entscheidet nicht FIAON. Wir sagen dir, woran du drehen kannst.",
  },
  {
    schluessel: "keine_zeit",
    sagt: "Ich habe jetzt keine Zeit.",
    wann: "Immer",
    antwort:
      "Kein Problem — sag mir einfach, wann es besser passt, dann rufe ich genau dann an. "
      + "Vormittags oder eher abends?",
  },
  {
    schluessel: "unterlagen",
    sagt: "Warum braucht ihr meinen Ausweis?",
    wann: "Unterlagen fehlen",
    antwort:
      "Damit wir sicher sind, dass wir die Auskunft der richtigen Person einholen — bei "
      + "Namensgleichheit geht das sonst schief. Die Unterlagen liegen verschlüsselt und werden nur "
      + "für die Prüfung verwendet.",
  },
  {
    schluessel: "abo",
    sagt: "Bindet mich das an ein Abo?",
    wann: "Neu, noch nichts bezahlt",
    antwort:
      "Bei den Einmalprodukten nicht — du zahlst einmal, damit ist es erledigt. "
      + "Wenn du ein monatliches Paket hast, steht die Laufzeit im Vertrag und du kannst kündigen. "
      + "Soll ich dir sagen, was für deine Bestellung gilt?",
  },
  {
    schluessel: "termin_verpasst",
    sagt: "(Kunde war beim vereinbarten Termin nicht erreichbar)",
    wann: "Verpasster Termin im Verlauf",
    antwort:
      "Kein Vorwurf — Termine platzen. Sollen wir einen neuen ausmachen, oder passt es dir "
      + "gerade jetzt für ein paar Minuten?",
  },
];

/** Bausteine, die zu einer Lage passen — die Vorauswahl vor der KI. */
export function einwaendeFuer(opts: {
  tier: number; grund: string; hatUnterlagen: boolean; verpassterTermin: boolean;
}): Einwand[] {
  const raus = new Set<string>();
  if (opts.tier === 1) raus.add("schon_bezahlt");
  if (opts.tier === 2) { raus.add("preis"); raus.add("kein_geld"); }
  if (opts.tier === 3) { raus.add("seriositaet"); raus.add("was_bringt_das"); raus.add("abo"); }
  if (!opts.hatUnterlagen) raus.add("unterlagen");
  if (opts.verpassterTermin) raus.add("termin_verpasst");
  // „Muss überlegen" und „keine Zeit" passen immer — sie sind die zwei
  // häufigsten Sätze am Telefon.
  raus.add("ueberlegen");
  raus.add("keine_zeit");
  return EINWAENDE.filter((e) => raus.has(e.schluessel));
}
